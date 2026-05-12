"""Hetionet-informed feature rows derived from bundled catalog + v1.0 metaedge counts.

This is **not** a live DWPC query over the full Hetionet Neo4j export. It *is*
deterministic, reproducible, and grounded in:

  - Published **Hetionet v1.0** undirected edge totals per metaedge (see
    ``catalog.METAEDGES`` and Himmelstein et al., eLife 2017).
  - The same **compound / disease / gene** records the Initialize comboboxes
    expose (DrugBank IDs, DOIDs, NCBI gene symbols, therapeutic class, …).

Training rows vary across positives (focal compound–disease with different
anchor genes drawn from the same gene category) and negatives (random catalog
triplets that are not the focal pair), so stratified CV sees non-degenerate
feature geometry while labels encode a real binary task: *is this the focal
compound–disease pair?*
"""

from __future__ import annotations

import hashlib
import math
from typing import Literal

import numpy as np

from hetqml_api.catalog import (
    compounds_catalog,
    diseases_catalog,
    genes_catalog,
    metaedges_catalog,
)
from hetqml_api.schemas import CompoundEntry, DiseaseEntry, GeneEntry, Selection

# Must match ``N_FEATURES`` in ``ml.features`` (quantum + classical pipelines).
FEATURE_DIM = 8


CATALOG_FEATURE_NAMES = [
    "log1p_edges_selected_metaedge",
    "log1p_edges_CbG",
    "log1p_edges_DaG",
    "log1p_edges_CuG",
    "compound_fda_approved",
    "compound_therapeutic_class_index",
    "disease_category_index",
    "gene_category_pubchem_proxy",
]


def metaedge_code_from_selection(metaedge: str) -> str:
    """Strip UI suffix ``' · label'`` so ``'CtD · Compound–treats–Disease'`` → ``CtD``."""
    s = metaedge.strip()
    if " · " in s:
        return s.split(" · ", 1)[0].strip()
    if len(s) >= 3 and s[3:].startswith(" "):
        return s[:3].strip()
    return s[:8].strip()


def _edge_count(edge_by_code: dict[str, int], code: str) -> int:
    return int(edge_by_code.get(code, 0))


def _norm_hash(label: str, salt: str) -> float:
    digest = hashlib.sha256(f"{salt}|{label}".encode("utf-8")).digest()
    return int.from_bytes(digest[:4], "big", signed=False) / float(2**32)


def resolve_compound_entry(compounds: list[CompoundEntry], token: str) -> CompoundEntry | None:
    t = token.strip()
    for c in compounds:
        if c.name == t or c.drugbank_id == t:
            return c
    return None


def resolve_disease_entry(diseases: list[DiseaseEntry], token: str) -> DiseaseEntry | None:
    t = token.strip()
    for d in diseases:
        if d.name == t or d.doid == t:
            return d
    return None


def _normalize_gene_token(token: str) -> str:
    t = token.strip()
    if t.upper().startswith("NCBIGENE:"):
        return t.split(":", 1)[1]
    return t


def resolve_gene_entry(genes: list[GeneEntry], token: str) -> GeneEntry | None:
    t = _normalize_gene_token(token)
    for g in genes:
        if g.symbol == t or g.ncbi_id == t:
            return g
    return None


def catalog_feature_row(
    compound: CompoundEntry,
    disease: DiseaseEntry,
    gene: GeneEntry,
    meta_code: str,
    edge_by_code: dict[str, int],
) -> np.ndarray:
    """Single ``(N_FEATURES,)`` row — interpretable scalars, no RNG."""
    sel_edges = _edge_count(edge_by_code, meta_code)
    vec = np.array(
        [
            math.log1p(sel_edges),
            math.log1p(_edge_count(edge_by_code, "CbG")),
            math.log1p(_edge_count(edge_by_code, "DaG")),
            math.log1p(_edge_count(edge_by_code, "CuG")),
            1.0 if compound.fda_approved else 0.0,
            _norm_hash(compound.therapeutic_class, "tc"),
            _norm_hash(disease.category, "dc"),
            _norm_hash(gene.category, "gc") + 0.15 * math.log1p(compound.pubchem_cid or 0) / 25.0,
        ],
        dtype=np.float64,
    )
    assert vec.shape == (FEATURE_DIM,)
    return vec


def _gene_pool_same_category(
    anchor: GeneEntry,
    genes: list[GeneEntry],
    rng: np.random.Generator,
    *,
    min_size: int,
) -> list[GeneEntry]:
    pool = [g for g in genes if g.category == anchor.category]
    if anchor not in pool:
        pool = [anchor, *pool]
    order = np.arange(len(pool))
    rng.shuffle(order)
    shuffled = [pool[i] for i in order]
    if len(shuffled) < min_size:
        # Rare for huge catalogs; pad with replacement from same pool.
        extra = rng.integers(0, len(shuffled), size=min_size - len(shuffled))
        shuffled.extend(shuffled[int(i)] for i in extra)
    return shuffled[:max(min_size, len(shuffled))]


def _sample_catalog_negative_triplets(
    compounds: list[CompoundEntry],
    diseases: list[DiseaseEntry],
    genes: list[GeneEntry],
    focal_c: CompoundEntry,
    focal_d: DiseaseEntry,
    n_neg: int,
    rng: np.random.Generator,
) -> list[tuple[CompoundEntry, DiseaseEntry, GeneEntry]]:
    """Random (compound, disease, gene) triplets with (compound, disease) ≠ focal pair."""
    ci = rng.integers(0, len(compounds), size=n_neg * 4)
    di = rng.integers(0, len(diseases), size=n_neg * 4)
    triplets: list[tuple[CompoundEntry, DiseaseEntry, GeneEntry]] = []
    for k in range(len(ci)):
        if len(triplets) >= n_neg:
            break
        c, d = compounds[int(ci[k])], diseases[int(di[k])]
        if c.name == focal_c.name and d.name == focal_d.name:
            continue
        gi = int(rng.integers(0, len(genes)))
        triplets.append((c, d, genes[gi]))
    while len(triplets) < n_neg:
        c = compounds[int(rng.integers(0, len(compounds)))]
        d = diseases[int(rng.integers(0, len(diseases)))]
        if c.name == focal_c.name and d.name == focal_d.name:
            continue
        gi = int(rng.integers(0, len(genes)))
        triplets.append((c, d, genes[gi]))
    return triplets[:n_neg]


def catalog_negatives_exclude_focal_pair(
    selection: Selection,
    *,
    n_samples: int,
    seed: int,
) -> bool | None:
    """True iff every catalog negative row avoids the focal compound–disease pair.

    ``None`` when focal entries do not resolve in the bundled catalogs.
    """
    compounds = compounds_catalog().items
    diseases = diseases_catalog().items
    genes = genes_catalog().items
    focal_c = resolve_compound_entry(compounds, selection.compound)
    focal_d = resolve_disease_entry(diseases, selection.disease)
    if focal_c is None or focal_d is None or resolve_gene_entry(genes, selection.gene) is None:
        return None
    rng = np.random.default_rng(seed)
    n_neg = n_samples - n_samples // 2
    triplets = _sample_catalog_negative_triplets(
        compounds, diseases, genes, focal_c, focal_d, n_neg, rng
    )
    for c, d, _g in triplets:
        if c.name == focal_c.name and d.name == focal_d.name:
            return False
    return len(triplets) == n_neg


def max_abs_pearson_feature_target_correlation(X: np.ndarray, y: np.ndarray) -> float:
    """Largest |ρ| between any feature column and binary ``y`` (ignores degenerate columns)."""
    yf = y.astype(np.float64)
    if yf.size < 2 or np.std(yf) < 1e-12:
        return 0.0
    best = 0.0
    for j in range(X.shape[1]):
        col = X[:, j].astype(np.float64)
        if np.std(col) < 1e-12:
            continue
        r = np.corrcoef(col, yf)[0, 1]
        if np.isfinite(r):
            best = max(best, abs(float(r)))
    return best


def try_build_catalog_feature_matrix(
    selection: Selection,
    *,
    n_samples: int,
    seed: int,
) -> tuple[np.ndarray, np.ndarray, list[str]] | None:
    """Return ``(X, y, feature_names)`` for a catalog-backed matrix, or ``None``."""
    compounds = compounds_catalog().items
    diseases = diseases_catalog().items
    genes = genes_catalog().items
    meta_code = metaedge_code_from_selection(selection.metaedge)
    edge_by_code = {m.code: m.edge_count for m in metaedges_catalog().items}

    focal_c = resolve_compound_entry(compounds, selection.compound)
    focal_d = resolve_disease_entry(diseases, selection.disease)
    focal_g = resolve_gene_entry(genes, selection.gene)
    if focal_c is None or focal_d is None or focal_g is None:
        return None

    rng = np.random.default_rng(seed)
    n_pos = n_samples // 2
    n_neg = n_samples - n_pos

    gene_variants = _gene_pool_same_category(focal_g, genes, rng, min_size=n_pos)

    x_pos = np.stack(
        [
            catalog_feature_row(focal_c, focal_d, gene_variants[i % len(gene_variants)], meta_code, edge_by_code)
            for i in range(n_pos)
        ]
    )

    neg_triplets = _sample_catalog_negative_triplets(
        compounds, diseases, genes, focal_c, focal_d, n_neg, rng
    )
    x_neg_list = [
        catalog_feature_row(c, d, g, meta_code, edge_by_code) for c, d, g in neg_triplets
    ]

    x_neg = np.stack(x_neg_list[:n_neg])
    x = np.vstack([x_pos, x_neg])
    y = np.concatenate([np.ones(n_pos, dtype=np.int64), np.zeros(n_neg, dtype=np.int64)])
    perm = rng.permutation(n_samples)
    x = x[perm]
    y = y[perm]

    return x, y, list(CATALOG_FEATURE_NAMES)


def catalog_feature_rows_for_pairs(
    selection: Selection,
    candidates: list[tuple[str, str]],
    *,
    edge_by_code: dict[str, int] | None = None,
    genes: list[GeneEntry] | None = None,
    compounds: list[CompoundEntry] | None = None,
    diseases: list[DiseaseEntry] | None = None,
) -> np.ndarray | None:
    """Shape ``(len(candidates), N_FEATURES)`` using the focal anchor gene.

    Returns ``None`` if any candidate pair fails catalog resolution.
    """
    if edge_by_code is None:
        edge_by_code = {m.code: m.edge_count for m in metaedges_catalog().items}
    if genes is None:
        genes = genes_catalog().items
    if compounds is None:
        compounds = compounds_catalog().items
    if diseases is None:
        diseases = diseases_catalog().items

    focal_g = resolve_gene_entry(genes, selection.gene)
    if focal_g is None:
        return None
    meta_code = metaedge_code_from_selection(selection.metaedge)
    rows: list[np.ndarray] = []
    for compound_tok, disease_tok in candidates:
        c = resolve_compound_entry(compounds, compound_tok)
        d = resolve_disease_entry(diseases, disease_tok)
        if c is None or d is None:
            return None
        rows.append(catalog_feature_row(c, d, focal_g, meta_code, edge_by_code))
    return np.stack(rows, axis=0)


def feature_source_label(source: Literal["synthetic", "catalog"]) -> str:
    return "Hetionet-informed catalog features" if source == "catalog" else "Gaussian synthetic features"
