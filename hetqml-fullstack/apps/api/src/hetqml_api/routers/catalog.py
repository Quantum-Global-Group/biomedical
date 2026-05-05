"""Catalog endpoints — synthetic, seeded, deterministic.

Each response is wrapped with `synthetic=true` so consumers can audit data
provenance. Real Hetionet pulls land in step 11 of the Phase 2 sequence.
"""

from __future__ import annotations

from fastapi import APIRouter

from hetqml_api.catalog import (
    algorithms_catalog,
    compounds_catalog,
    diseases_catalog,
    genes_catalog,
    integrity_guards_catalog,
    metaedges_catalog,
)
from hetqml_api.schemas import (
    AlgorithmCatalog,
    CompoundCatalog,
    DiseaseCatalog,
    GeneCatalog,
    IntegrityGuardCatalog,
    MetaedgeCatalog,
)

router = APIRouter(prefix="/catalog", tags=["catalog"])


@router.get("/diseases", response_model=DiseaseCatalog)
async def get_diseases() -> DiseaseCatalog:
    return diseases_catalog()


@router.get("/compounds", response_model=CompoundCatalog)
async def get_compounds() -> CompoundCatalog:
    return compounds_catalog()


@router.get("/genes", response_model=GeneCatalog)
async def get_genes() -> GeneCatalog:
    return genes_catalog()


@router.get("/metaedges", response_model=MetaedgeCatalog)
async def get_metaedges() -> MetaedgeCatalog:
    return metaedges_catalog()


@router.get("/algorithms", response_model=AlgorithmCatalog)
async def get_algorithms() -> AlgorithmCatalog:
    return algorithms_catalog()


@router.get("/integrity-guards", response_model=IntegrityGuardCatalog)
async def get_integrity_guards() -> IntegrityGuardCatalog:
    return integrity_guards_catalog()
