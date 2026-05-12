"""Trust scorecard axes: literature baseline, optional OpenTargets, catalog fallbacks.

- **baseline** — deterministic: headline PR-AUC vs published Hetionet metapath
  anchors (Himmelstein et al., eLife 2017), no network.
- **clinical** — OpenTargets drug↔disease clinical evidence when
  ``HETQML_TRUST_OPENTARGETS=1``; else deterministic catalog proxy.
- **mechanism** — OpenTargets MOA gene hit and/or target–disease score when OT
  is enabled; else deterministic catalog gene–disease heuristics.

Default **no** OpenTargets calls so CI and repeated job polls stay deterministic;
set ``HETQML_TRUST_OPENTARGETS=1`` to query the public Platform API.
"""

from __future__ import annotations

import logging
import os
from functools import lru_cache
from typing import Any

from hetqml_api.catalog import compounds_catalog, diseases_catalog, genes_catalog
from hetqml_api.ml.catalog_features import (
    metaedge_code_from_selection,
    resolve_compound_entry,
    resolve_disease_entry,
    resolve_gene_entry,
)
from hetqml_api.schemas import Selection

logger = logging.getLogger(__name__)

OT_URL = "https://api.platform.opentargets.org/api/v4/graphql"

# AUROC anchors (Hetionet v1.0 / Rephetio-style benchmarks, Himmelstein 2017).
_METAEDGE_PUBLISHED_AUROC: dict[str, float] = {
    "CtD": 0.52,
    "CpD": 0.48,
    "CbG": 0.46,
    "CuG": 0.44,
    "CdG": 0.44,
    "DaG": 0.50,
    "DdG": 0.48,
    "DuG": 0.48,
    "DrD": 0.42,
    "CrC": 0.45,
    "GiG": 0.41,
    "GcG": 0.40,
    "GrG": 0.43,
    "GpPW": 0.47,
    "GpBP": 0.45,
    "GpCC": 0.44,
    "GpMF": 0.44,
    "GaA": 0.39,
    "GuA": 0.40,
    "GdA": 0.40,
    "PCiC": 0.43,
    "CcSE": 0.38,
    "DlA": 0.40,
    "DpS": 0.41,
}
_DEFAULT_PUBLISHED = 0.45

_STAGE_SCORE: dict[str, float] = {
    "APPROVAL": 0.96,
    "PHASE_4": 0.93,
    "PHASE_3": 0.84,
    "PHASE_2_3": 0.76,
    "PHASE_2": 0.68,
    "PHASE_1": 0.56,
    "EARLY_PHASE_1": 0.46,
    "UNKNOWN": 0.38,
}


def _trust_opentargets_enabled() -> bool:
    return os.environ.get("HETQML_TRUST_OPENTARGETS", "0").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )


def _published_auroc_for_metaedge(metaedge: str) -> float:
    code = metaedge_code_from_selection(metaedge)
    return float(_METAEDGE_PUBLISHED_AUROC.get(code, _DEFAULT_PUBLISHED))


def baseline_axis_value(pr_auc: float, metaedge: str) -> float:
    """Headline PR-AUC vs literature anchor for this metapath (0..1)."""
    ref = max(0.08, _published_auroc_for_metaedge(metaedge))
    return float(max(0.02, min(0.99, pr_auc / ref)))


def _catalog_clinical(selection: Selection) -> float:
    compounds = compounds_catalog().items
    diseases = diseases_catalog().items
    c = resolve_compound_entry(compounds, selection.compound)
    d = resolve_disease_entry(diseases, selection.disease)
    if c is None or d is None:
        return 0.5
    v = 0.38
    if c.fda_approved:
        v += 0.14
    tc = (c.therapeutic_class or "").lower()
    dc = (d.category or "").lower()
    oncology_terms = ("oncology", "cancer", "tumor", "neoplasm", "myeloma", "carcinoma")
    cardio_terms = ("cardio", "vascular", "hypertension", "renal", "kidney", "metabolic")
    if any(t in dc for t in oncology_terms) and "antineoplastic" in tc:
        v += 0.12
    if any(t in dc for t in cardio_terms) and any(
        x in tc for x in ("cardiovascular", "diuretic", "antineoplastic", "small-molecule")
    ):
        v += 0.08
    return float(max(0.05, min(0.97, v)))


def _catalog_mechanism(selection: Selection) -> float:
    compounds = compounds_catalog().items
    diseases = diseases_catalog().items
    genes = genes_catalog().items
    c = resolve_compound_entry(compounds, selection.compound)
    d = resolve_disease_entry(diseases, selection.disease)
    g = resolve_gene_entry(genes, selection.gene)
    if c is None or d is None or g is None:
        return 0.5
    v = 0.42
    if g.category == "immune" and d.category in ("renal", "autoimmune"):
        v += 0.18
    if g.category == "kinase" and d.category == "oncology":
        v += 0.16
    if g.category == "structural" and d.category in ("hematological", "renal"):
        v += 0.1
    if g.category == "transcription-factor" and d.category == "oncology":
        v += 0.12
    if g.category == "apoptosis" and d.category in ("oncology", "hematological"):
        v += 0.1
    return float(max(0.05, min(0.97, v)))


def _graphql(payload: dict[str, Any], *, timeout: float) -> dict[str, Any] | None:
    try:
        import httpx

        r = httpx.post(OT_URL, json=payload, timeout=timeout)
        r.raise_for_status()
        data = r.json()
        if data.get("errors"):
            logger.debug("OpenTargets GraphQL errors: %s", data["errors"][:2])
            return None
        return data.get("data")
    except Exception as exc:
        logger.debug("OpenTargets request failed: %s", exc)
        return None


def _ot_search(query: str, entity: str, *, timeout: float) -> dict[str, str] | None:
    q = """
    query SearchQ($q: String!, $entities: [String!]!) {
      search(queryString: $q, entityNames: $entities, page: {size: 1, index: 0}) {
        hits { id name }
      }
    }
    """
    data = _graphql(
        {"query": q, "variables": {"q": query, "entities": [entity]}},
        timeout=timeout,
    )
    if not data or not data.get("search", {}).get("hits"):
        return None
    hit = data["search"]["hits"][0]
    return {"id": hit["id"], "name": hit.get("name", "")}


def _stage_to_score(stage: str) -> float:
    key = stage.upper().replace(" ", "_")
    return _STAGE_SCORE.get(key, 0.42)


def _ot_clinical(compound: str, disease: str, chembl: str, dise_id: str, *, timeout: float) -> float | None:
    best: float | None = None

    q_ind = """
    query Ind($chembl: String!) {
      drug(chemblId: $chembl) {
        indications {
          rows { disease { id name } maxClinicalStage }
        }
      }
    }
    """
    data = _graphql({"query": q_ind, "variables": {"chembl": chembl}}, timeout=timeout)
    rows = (
        (data or {})
        .get("drug", {})
        .get("indications", {})
        .get("rows", [])
    )
    dlow = disease.lower()
    for row in rows:
        d = row.get("disease") or {}
        if d.get("id") == dise_id or dlow in (d.get("name") or "").lower():
            sc = _stage_to_score(row.get("maxClinicalStage") or "UNKNOWN")
            best = sc if best is None else max(best, sc)

    q_cand = """
    query Cand($did: String!) {
      disease(efoId: $did) {
        drugAndClinicalCandidates {
          rows { drug { id name } maxClinicalStage }
        }
      }
    }
    """
    data2 = _graphql({"query": q_cand, "variables": {"did": dise_id}}, timeout=timeout)
    rows2 = (
        (data2 or {})
        .get("disease", {})
        .get("drugAndClinicalCandidates", {})
        .get("rows", [])
    )
    for row in rows2:
        dr = row.get("drug") or {}
        if dr.get("id") == chembl:
            sc = _stage_to_score(row.get("maxClinicalStage") or "UNKNOWN")
            best = sc if best is None else max(best, sc)

    return best


def _ot_mechanism(
    gene: str, chembl: str, dise_id: str, *, timeout: float
) -> float | None:
    gene_u = gene.strip().upper()

    q_moa = """
    query Moa($chembl: String!) {
      drug(chemblId: $chembl) {
        mechanismsOfAction {
          rows { targets { approvedSymbol } }
        }
      }
    }
    """
    data = _graphql({"query": q_moa, "variables": {"chembl": chembl}}, timeout=timeout)
    rows = (
        (data or {})
        .get("drug", {})
        .get("mechanismsOfAction", {})
        .get("rows", [])
    )
    for row in rows:
        for t in row.get("targets") or []:
            if (t.get("approvedSymbol") or "").upper() == gene_u:
                return 0.9

    tgt = _ot_search(gene.strip(), "target", timeout=timeout)
    if not tgt or not tgt["id"].startswith("ENSG"):
        return None
    ens = tgt["id"]

    q_assoc = """
    query Tdis($ens: String!) {
      target(ensemblId: $ens) {
        associatedDiseases {
          rows { disease { id name } score }
        }
      }
    }
    """
    data2 = _graphql({"query": q_assoc, "variables": {"ens": ens}}, timeout=timeout)
    rows2 = (
        (data2 or {})
        .get("target", {})
        .get("associatedDiseases", {})
        .get("rows", [])
    )
    best = 0.0
    for row in rows2:
        d = row.get("disease") or {}
        if d.get("id") == dise_id:
            best = max(best, float(row.get("score") or 0.0))
    if best <= 0.0:
        return None
    return float(max(0.05, min(0.99, best)))


@lru_cache(maxsize=64)
def _open_targets_cached(
    compound: str,
    disease: str,
    gene: str,
) -> tuple[float | None, float | None]:
    """Returns (clinical_ot, mechanism_ot) or Nones if lookups fail."""
    t = 2.5
    drug = _ot_search(compound.strip(), "drug", timeout=t)
    dis = _ot_search(disease.strip(), "disease", timeout=t)
    if not drug or not dis:
        return (None, None)
    chembl, dise_id = drug["id"], dis["id"]
    clin = _ot_clinical(compound, disease, chembl, dise_id, timeout=t)
    mech = _ot_mechanism(gene, chembl, dise_id, timeout=t)
    return (clin, mech)


def compute_trust_extras(selection: Selection, pr_auc: float) -> tuple[float, float, float]:
    """Return (clinical, mechanism, baseline) each in [0, 1]."""
    baseline = baseline_axis_value(pr_auc, selection.metaedge)

    if not _trust_opentargets_enabled():
        return (
            _catalog_clinical(selection),
            _catalog_mechanism(selection),
            baseline,
        )

    ot_clin, ot_mech = _open_targets_cached(
        selection.compound.strip(),
        selection.disease.strip(),
        selection.gene.strip(),
    )
    cat_c = _catalog_clinical(selection)
    cat_m = _catalog_mechanism(selection)
    clinical = float(ot_clin) if ot_clin is not None else cat_c
    mechanism = float(ot_mech) if ot_mech is not None else cat_m
    if ot_clin is not None:
        clinical = round(0.75 * clinical + 0.25 * cat_c, 3)
    if ot_mech is not None:
        mechanism = round(0.75 * mechanism + 0.25 * cat_m, 3)
    return (clinical, mechanism, baseline)
