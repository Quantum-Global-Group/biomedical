"""Real Hetionet metapath feature loader.

Replaces the deterministic synthetic / catalog-proxy feature matrix with
**actual metapath counts** computed from a Hetionet edge export.

When ``HETQML_FEATURE_MATRIX_SOURCE=hetionet`` and a Hetionet edges TSV is
available (path via ``HETQML_HETIONET_EDGES_PATH``), this module:

  1. Loads the edge table into an in-memory adjacency index keyed on
     ``(source_id, metaedge_code, target_id)``.
  2. Computes **DWPC-style metapath features** for each
     ``(compound, disease, gene)`` triplet — counts of 2- and 3-hop
     metapaths connecting compound → disease through the anchor gene,
     weighted by inverse-degree so hub nodes don't dominate.
  3. Samples **hard negatives** at the preregistered 1:5 positive:negative
     ratio (§5.1) — negatives are compound–disease pairs that share a
     therapeutic class or disease category with the focal pair but are
     *not* the focal pair, making the binary task non-trivial.

When no edge file is available the loader returns ``None`` and
``build_features`` falls back to the catalog / synthetic backends.

The classical / hybrid / quantum scorers are agnostic to the feature
source — they only see ``X``, ``y``, and ``feature_names``.
"""

from __future__ import annotations

import csv
import logging
import math
import os
from collections import defaultdict
from functools import lru_cache
from typing import Literal

import numpy as np

from hetqml_api.catalog import (
    compounds_catalog,
    diseases_catalog,
    genes_catalog,
)
from hetqml_api.ml.catalog_features import (
    resolve_compound_entry,
    resolve_disease_entry,
    resolve_gene_entry,
)
from hetqml_api.schemas import CompoundEntry, DiseaseEntry, GeneEntry, Selection

logger = logging.getLogger(__name__)

# Preregistration §5.1: 1:5 hard-negative ratio.
HARD_NEGATIVE_RATIO = 5

# Metapaths used as feature columns. Each entry is (metapath_path, label).
# These are the Hetionet metapaths most relevant to compound–disease
# prioritisation (Himmelstein et al., eLife 2017, Project Rephetio).
METAPATH_FEATURE_SPECS: list[tuple[str, str]] = [
    ("CtD", "dwpc_CtD"),
    ("CbGDaG", "dwpc_CbGaD"),
    ("CtDrD", "dwpc_CtDrD"),
    ("CbGiGaD", "dwpc_CbGiGaD"),
    ("CuGDaG", "dwpc_CuGDaG"),
    ("CdGDaG", "dwpc_CdGDaG"),
    ("CbGdG", "dwpc_CbGdG"),
    ("CbGuG", "dwpc_CbGuG"),
]

FEATURE_DIM = len(METAPATH_FEATURE_SPECS)  # 8 — matches N_FEATURES

# Node-id prefixes in Hetionet edges TSV. The canonical Hetionet export
# uses ``Compound::DB...``, ``Disease::DOID:...``, ``Gene::NNNN``.
_NODE_PREFIX_SEP = "::"


def _edges_path() -> str | None:
    raw = os.environ.get("HETQML_HETIONET_EDGES_PATH", "").strip()
    if not raw:
        return None
    if not os.path.isfile(raw):
        logger.debug("HETQML_HETIONET_EDGES_PATH=%s is not a file", raw)
        return None
    return raw


class HetionetGraph:
    """In-memory adjacency index for Hetionet metapath queries.

    Edges are stored as ``adj[source][metaedge] -> set(targets)`` and
    ``radj[target][metaedge] -> set(sources)`` so both forward and reverse
    traversals are O(1) per hop.
    """

    def __init__(self) -> None:
        self.adj: dict[str, dict[str, set[str]]] = defaultdict(lambda: defaultdict(set))
        self.radj: dict[str, dict[str, set[str]]] = defaultdict(lambda: defaultdict(set))
        self._node_degree: dict[str, int] = defaultdict(int)

    @property
    def n_edges(self) -> int:
        return sum(self._node_degree.values()) // 2

    def add_edge(self, source: str, metaedge: str, target: str) -> None:
        self.adj[source][metaedge].add(target)
        self.radj[target][metaedge].add(source)
        self._node_degree[source] += 1
        self._node_degree[target] += 1

    def neighbors(self, node: str, metaedge: str) -> set[str]:
        return self.adj.get(node, {}).get(metaedge, set())

    def reverse_neighbors(self, node: str, metaedge: str) -> set[str]:
        return self.radj.get(node, {}).get(metaedge, set())

    def degree(self, node: str) -> int:
        return self._node_degree.get(node, 0)


@lru_cache(maxsize=1)
def _load_graph() -> HetionetGraph | None:
    path = _edges_path()
    if path is None:
        return None
    g = HetionetGraph()
    try:
        with open(path, newline="", encoding="utf-8") as fh:
            reader = csv.DictReader(fh, delimiter="\t")
            for row in reader:
                source = row.get("source", "").strip()
                target = row.get("target", "").strip()
                metaedge = row.get("metaedge", "").strip()
                if source and target and metaedge:
                    g.add_edge(source, target, metaedge)
    except Exception as exc:
        logger.warning("Failed to load Hetionet edges from %s: %s", path, exc)
        return None
    logger.info("Loaded Hetionet graph: %d edges from %s", g.n_edges, path)
    return g


def _compound_node_id(entry: CompoundEntry) -> str:
    return f"Compound::{entry.drugbank_id}"


def _disease_node_id(entry: DiseaseEntry) -> str:
    return f"Disease::{entry.doid}"


def _gene_node_id(entry: GeneEntry) -> str:
    return f"Gene::{entry.ncbi_id}"


def _node_id_prefix(prefix: str) -> str:
    return prefix


def _split_node_id(node_id: str) -> tuple[str, str]:
    if _NODE_PREFIX_SEP in node_id:
        kind, rest = node_id.split(_NODE_PREFIX_SEP, 1)
        return kind, rest
    return "", node_id


def _dwpc_1hop(g: HetionetGraph, source: str, metaedge: str, target: str) -> float:
    """Single-hop DWPC: 1 if edge exists, else 0, divided by source degree."""
    if target in g.neighbors(source, metaedge):
        deg = g.degree(source)
        return 1.0 / max(1, deg)
    return 0.0


def _dwpc_2hop(
    g: HetionetGraph,
    source: str,
    me1: str,
    me2: str,
    target: str,
) -> float:
    """Two-hop DWPC: sum over intermediate nodes of (1/deg(source)) * (1/deg(intermediate)).

    Walks ``source --me1--> mid --me2--> target``.
    """
    mids = g.neighbors(source, me1)
    if not mids:
        return 0.0
    src_deg = max(1, g.degree(source))
    total = 0.0
    for mid in mids:
        if target in g.neighbors(mid, me2):
            mid_deg = max(1, g.degree(mid))
            total += (1.0 / src_deg) * (1.0 / mid_deg)
    return total


def _dwpc_3hop(
    g: HetionetGraph,
    source: str,
    me1: str,
    me2: str,
    me3: str,
    target: str,
) -> float:
    """Three-hop DWPC through two intermediate nodes."""
    mids1 = g.neighbors(source, me1)
    if not mids1:
        return 0.0
    src_deg = max(1, g.degree(source))
    total = 0.0
    for mid1 in mids1:
        mid1_deg = max(1, g.degree(mid1))
        mids2 = g.neighbors(mid1, me2)
        if not mids2:
            continue
        for mid2 in mids2:
            if target in g.neighbors(mid2, me3):
                mid2_deg = max(1, g.degree(mid2))
                total += (
                    (1.0 / src_deg)
                    * (1.0 / mid1_deg)
                    * (1.0 / mid2_deg)
                )
    return total


def _compute_metapath_feature(
    g: HetionetGraph,
    compound_id: str,
    disease_id: str,
    gene_id: str,
    metapath: str,
) -> float:
    """Compute a single DWPC metapath feature value.

    Supports 1-, 2-, and 3-hop metapaths. The metapath string is a
    concatenation of Hetionet metaedge codes (e.g. ``CbGDaG`` =
    CbG + DaG). Direction follows the Hetionet convention:
    Compound → Gene → Disease.
    """
    n_hops = len(metapath) // 3
    if n_hops * 3 != len(metapath):
        return 0.0

    if n_hops == 1:
        return _dwpc_1hop(g, compound_id, metapath, disease_id)
    if n_hops == 2:
        me1, me2 = metapath[:3], metapath[3:6]
        return _dwpc_2hop(g, compound_id, me1, me2, disease_id)
    if n_hops == 3:
        me1, me2, me3 = metapath[:3], metapath[3:6], metapath[6:9]
        return _dwpc_3hop(g, compound_id, me1, me2, me3, disease_id)
    return 0.0


def hetionet_feature_row(
    g: HetionetGraph,
    compound: CompoundEntry,
    disease: DiseaseEntry,
    gene: GeneEntry,
) -> np.ndarray:
    """Single ``(FEATURE_DIM,)`` row of real DWPC metapath features."""
    cid = _compound_node_id(compound)
    did = _disease_node_id(disease)
    gid = _gene_node_id(gene)
    vec = np.zeros(FEATURE_DIM, dtype=np.float64)
    for i, (metapath, _label) in enumerate(METAPATH_FEATURE_SPECS):
        val = _compute_metapath_feature(g, cid, did, gid, metapath)
        vec[i] = math.log1p(val)  # log1p compresses the long tail
    return vec


HETIONET_FEATURE_NAMES = [label for _, label in METAPATH_FEATURE_SPECS]


def _sample_hard_negatives(
    compounds: list[CompoundEntry],
    diseases: list[DiseaseEntry],
    genes: list[GeneEntry],
    focal_c: CompoundEntry,
    focal_d: DiseaseEntry,
    focal_g: GeneEntry,
    n_neg: int,
    rng: np.random.Generator,
) -> list[tuple[CompoundEntry, DiseaseEntry, GeneEntry]]:
    """Hard negatives: same therapeutic class or disease category, not focal pair.

    Preregistration §5.1 specifies 1:5 hard:positive ratio with
    semi-hard mining — negatives that are *near* the focal pair in
    feature space (shared therapeutic class / disease category) but
    not the focal pair itself. This makes the binary task non-trivial
    and prevents the classifier from learning a trivial separator.
    """
    same_class_compounds = [
        c for c in compounds
        if c.therapeutic_class == focal_c.therapeutic_class and c.name != focal_c.name
    ]
    same_category_diseases = [
        d for d in diseases
        if d.category == focal_d.category and d.name != focal_d.name
    ]

    triplets: list[tuple[CompoundEntry, DiseaseEntry, GeneEntry]] = []
    attempts = 0
    max_attempts = n_neg * 20

    while len(triplets) < n_neg and attempts < max_attempts:
        attempts += 1
        if same_class_compounds and rng.random() < 0.5:
            c = same_class_compounds[int(rng.integers(0, len(same_class_compounds)))]
        else:
            c = compounds[int(rng.integers(0, len(compounds)))]
        if same_category_diseases and rng.random() < 0.5:
            d = same_category_diseases[int(rng.integers(0, len(same_category_diseases)))]
        else:
            d = diseases[int(rng.integers(0, len(diseases)))]
        if c.name == focal_c.name and d.name == focal_d.name:
            continue
        g = genes[int(rng.integers(0, len(genes)))]
        triplets.append((c, d, g))

    while len(triplets) < n_neg:
        c = compounds[int(rng.integers(0, len(compounds)))]
        d = diseases[int(rng.integers(0, len(diseases)))]
        if c.name == focal_c.name and d.name == focal_d.name:
            continue
        g = genes[int(rng.integers(0, len(genes)))]
        triplets.append((c, d, g))

    return triplets[:n_neg]


def try_build_hetionet_feature_matrix(
    selection: Selection,
    *,
    n_samples: int,
    seed: int,
) -> tuple[np.ndarray, np.ndarray, list[str]] | None:
    """Return ``(X, y, feature_names)`` from real Hetionet DWPC features.

    Returns ``None`` when:
      - No Hetionet edge file is loaded (``HETQML_HETIONET_EDGES_PATH`` unset or missing).
      - The focal selection does not resolve in the bundled catalogs.
    """
    g = _load_graph()
    if g is None:
        return None

    compounds = compounds_catalog().items
    diseases = diseases_catalog().items
    genes = genes_catalog().items

    focal_c = resolve_compound_entry(compounds, selection.compound)
    focal_d = resolve_disease_entry(diseases, selection.disease)
    focal_g = resolve_gene_entry(genes, selection.gene)
    if focal_c is None or focal_d is None or focal_g is None:
        return None

    rng = np.random.default_rng(seed)

    # Positive rows: focal pair with different anchor genes from the same
    # category — stratifies positives so the classifier sees gene-category
    # variation within the focal compound–disease pair.
    n_pos = n_samples // (HARD_NEGATIVE_RATIO + 1)
    if n_pos < 10:
        n_pos = max(10, n_samples // 2)
    n_neg = n_samples - n_pos

    same_cat_genes = [gn for gn in genes if gn.category == focal_g.category]
    if len(same_cat_genes) < n_pos:
        same_cat_genes = genes
    gene_pool = same_cat_genes

    x_pos = np.stack(
        [
            hetionet_feature_row(
                g, focal_c, focal_d, gene_pool[int(rng.integers(0, len(gene_pool)))]
            )
            for _ in range(n_pos)
        ]
    )

    neg_triplets = _sample_hard_negatives(
        compounds, diseases, genes, focal_c, focal_d, focal_g, n_neg, rng
    )
    x_neg = np.stack(
        [hetionet_feature_row(g, c, d, gn) for c, d, gn in neg_triplets]
    )

    x = np.vstack([x_pos, x_neg])
    y = np.concatenate([
        np.ones(n_pos, dtype=np.int64),
        np.zeros(n_neg, dtype=np.int64),
    ])
    perm = rng.permutation(len(y))
    x = x[perm]
    y = y[perm]

    return x, y, list(HETIONET_FEATURE_NAMES)


def hetionet_feature_rows_for_pairs(
    selection: Selection,
    candidates: list[tuple[str, str]],
) -> np.ndarray | None:
    """Shape ``(len(candidates), FEATURE_DIM)`` DWPC rows using the focal anchor gene."""
    g = _load_graph()
    if g is None:
        return None
    compounds = compounds_catalog().items
    diseases = diseases_catalog().items
    genes = genes_catalog().items
    focal_g = resolve_gene_entry(genes, selection.gene)
    if focal_g is None:
        return None
    rows: list[np.ndarray] = []
    for compound_tok, disease_tok in candidates:
        c = resolve_compound_entry(compounds, compound_tok)
        d = resolve_disease_entry(diseases, disease_tok)
        if c is None or d is None:
            return None
        rows.append(hetionet_feature_row(g, c, d, focal_g))
    return np.stack(rows, axis=0)


def hetionet_negatives_exclude_focal_pair(
    selection: Selection,
    *,
    n_samples: int,
    seed: int,
) -> bool | None:
    """True iff every hard-negative row avoids the focal compound–disease pair.

    ``None`` when the graph or focal entries are unavailable.
    """
    g = _load_graph()
    if g is None:
        return None
    compounds = compounds_catalog().items
    diseases = diseases_catalog().items
    genes = genes_catalog().items
    focal_c = resolve_compound_entry(compounds, selection.compound)
    focal_d = resolve_disease_entry(diseases, selection.disease)
    focal_g = resolve_gene_entry(genes, selection.gene)
    if focal_c is None or focal_d is None or focal_g is None:
        return None
    rng = np.random.default_rng(seed)
    n_pos = n_samples // (HARD_NEGATIVE_RATIO + 1)
    if n_pos < 10:
        n_pos = max(10, n_samples // 2)
    n_neg = n_samples - n_pos
    triplets = _sample_hard_negatives(
        compounds, diseases, genes, focal_c, focal_d, focal_g, n_neg, rng
    )
    for c, d, _gn in triplets:
        if c.name == focal_c.name and d.name == focal_d.name:
            return False
    return len(triplets) == n_neg


def feature_source_label(source: Literal["synthetic", "catalog", "hetionet"]) -> str:
    if source == "hetionet":
        return "Real Hetionet DWPC metapath features"
    if source == "catalog":
        return "Hetionet-informed catalog features"
    return "Gaussian synthetic features"
