"""Synthetic, seeded catalogs for diseases / compounds / genes / metaedges /
algorithms / integrity guards.

This is v1 placeholder data — it hits the counts the plan advertises (137,
1552, 20945, 24, 32, 23) so downstream UI panels can be built and tested
end-to-end. Real Hetionet pulls land in step 11 of the Phase 2 sequence.

Determinism: every list is generated from a fixed seed, so identical
requests return identical payloads. Each catalog response is wrapped in a
`CatalogEnvelope` with `synthetic=true` so consumers can audit provenance.
"""

from __future__ import annotations

import random
from functools import lru_cache

from hetqml_api.schemas import (
    AlgorithmCatalog,
    AlgorithmEntry,
    CompoundCatalog,
    CompoundEntry,
    DiseaseCatalog,
    DiseaseEntry,
    GeneCatalog,
    GeneEntry,
    IntegrityGuardCatalog,
    IntegrityGuardEntry,
    MetaedgeCatalog,
    MetaedgeEntry,
)

CATALOG_SEED = 20251102

DISEASE_CATEGORIES = [
    "renal",
    "oncology",
    "autoimmune",
    "cardiovascular",
    "metabolic",
    "neurology",
    "infectious",
    "hematological",
    "respiratory",
    "endocrine",
    "gastroenterology",
    "dermatology",
    "rheumatology",
    "ophthalmology",
    "psychiatry",
    "rare-genetic",
    "obstetric",
]

# Curated entries are kept verbatim at the top of the list so existing
# selections (e.g. APOL1 / Inaxaplin) continue to work.
CURATED_DISEASES: list[DiseaseEntry] = [
    DiseaseEntry(name="Hypertension-attributed ESKD", doid="DOID:2451", category="renal"),
    DiseaseEntry(name="Hypertension", doid="DOID:10763", category="cardiovascular"),
    DiseaseEntry(name="Kidney disease", doid="DOID:557", category="renal"),
    DiseaseEntry(name="Glomerulonephritis", doid="DOID:3744", category="renal"),
    DiseaseEntry(name="Chronic kidney disease", doid="DOID:11335", category="renal"),
    DiseaseEntry(name="Systemic lupus erythematosus", doid="DOID:9074", category="autoimmune"),
    DiseaseEntry(name="Multiple myeloma", doid="DOID:9538", category="hematological"),
    DiseaseEntry(name="Sickle cell disease", doid="DOID:8577", category="hematological"),
    DiseaseEntry(
        name="Castration-resistant prostate cancer", doid="DOID:10283", category="oncology"
    ),
    DiseaseEntry(name="Type 2 diabetes mellitus", doid="DOID:9352", category="metabolic"),
]

THERAPEUTIC_CLASSES = [
    "kinase-inhibitor",
    "monoclonal-antibody",
    "small-molecule",
    "anti-inflammatory",
    "anticoagulant",
    "antiviral",
    "antibiotic",
    "hormonal",
    "immunomodulator",
    "antineoplastic",
    "cardiovascular",
    "diuretic",
    "analgesic",
    "antidepressant",
    "antiepileptic",
    "antidiabetic",
    "lipid-lowering",
    "respiratory",
    "GI",
    "dermatologic",
]

CURATED_COMPOUNDS: list[CompoundEntry] = [
    # PubChem CIDs are the canonical 3D-conformer ids the Visualize · 3D
    # molecule viewer fetches via /molecule/{cid}. Synthetic compounds
    # below leave pubchem_cid=None and the viewer renders a "no 3D model
    # available" empty state.
    CompoundEntry(
        name="Inaxaplin",
        drugbank_id="DB17789",
        therapeutic_class="small-molecule",
        fda_approved=False,
        # Name-resolved CID on PubChem; 145953829 is a ChEMBL synonym record
        # without a 3D conformer (SDF?record_type=3d → 404).
        pubchem_cid=147289591,
    ),
    CompoundEntry(
        name="Venetoclax",
        drugbank_id="DB11581",
        therapeutic_class="antineoplastic",
        fda_approved=True,
        pubchem_cid=49846579,
    ),
    CompoundEntry(
        name="Hydroxyurea",
        drugbank_id="DB01005",
        therapeutic_class="antineoplastic",
        fda_approved=True,
        pubchem_cid=3657,
    ),
    CompoundEntry(
        name="Lisinopril",
        drugbank_id="DB00722",
        therapeutic_class="cardiovascular",
        fda_approved=True,
        pubchem_cid=5362119,
    ),
    CompoundEntry(
        name="Losartan",
        drugbank_id="DB00678",
        therapeutic_class="cardiovascular",
        fda_approved=True,
        pubchem_cid=3961,
    ),
]

GENE_CATEGORIES = [
    "kinase",
    "GPCR",
    "transcription-factor",
    "ion-channel",
    "transporter",
    "enzyme",
    "structural",
    "cell-cycle",
    "apoptosis",
    "immune",
    "metabolism",
    "DNA-repair",
    "epigenetic",
    "RNA-binding",
    "secreted",
    "membrane-receptor",
    "scaffold",
    "ubiquitin-ligase",
    "phosphatase",
    "protease",
    "growth-factor",
    "cytokine",
    "histone",
]

CURATED_GENES: list[GeneEntry] = [
    GeneEntry(symbol="APOL1", ncbi_id="8542", category="immune"),
    GeneEntry(symbol="BCL2", ncbi_id="596", category="apoptosis"),
    GeneEntry(symbol="HBB", ncbi_id="3043", category="structural"),
    GeneEntry(symbol="EGFR", ncbi_id="1956", category="kinase"),
    GeneEntry(symbol="TP53", ncbi_id="7157", category="transcription-factor"),
]

METAEDGES: list[MetaedgeEntry] = [
    MetaedgeEntry(code="CtD", label="Compound–treats–Disease", edge_count=755),
    MetaedgeEntry(code="CpD", label="Compound–palliates–Disease", edge_count=390),
    MetaedgeEntry(code="DaG", label="Disease–associates–Gene", edge_count=12623),
    MetaedgeEntry(code="DdG", label="Disease–downregulates–Gene", edge_count=7623),
    MetaedgeEntry(code="DuG", label="Disease–upregulates–Gene", edge_count=7731),
    MetaedgeEntry(code="DlA", label="Disease–localizes–Anatomy", edge_count=3602),
    MetaedgeEntry(code="DpS", label="Disease–presents–Symptom", edge_count=3357),
    MetaedgeEntry(code="DrD", label="Disease–resembles–Disease", edge_count=543),
    MetaedgeEntry(code="CbG", label="Compound–binds–Gene", edge_count=11571),
    MetaedgeEntry(code="CdG", label="Compound–downregulates–Gene", edge_count=21102),
    MetaedgeEntry(code="CuG", label="Compound–upregulates–Gene", edge_count=18756),
    MetaedgeEntry(code="CrC", label="Compound–resembles–Compound", edge_count=6486),
    MetaedgeEntry(code="CcSE", label="Compound–causes–Side-Effect", edge_count=138944),
    MetaedgeEntry(code="GiG", label="Gene–interacts–Gene", edge_count=147164),
    MetaedgeEntry(code="GcG", label="Gene–covaries–Gene", edge_count=61690),
    MetaedgeEntry(code="GrG", label="Gene–regulates–Gene", edge_count=265672),
    MetaedgeEntry(code="GpPW", label="Gene–participates–Pathway", edge_count=84372),
    MetaedgeEntry(code="GpBP", label="Gene–participates–Biological Process", edge_count=559504),
    MetaedgeEntry(code="GpCC", label="Gene–participates–Cellular Component", edge_count=73566),
    MetaedgeEntry(code="GpMF", label="Gene–participates–Molecular Function", edge_count=97222),
    MetaedgeEntry(code="GaA", label="Gene–anatomy-expresses", edge_count=526407),
    MetaedgeEntry(code="GuA", label="Gene–anatomy-upregulates", edge_count=102240),
    MetaedgeEntry(code="GdA", label="Gene–anatomy-downregulates", edge_count=102885),
    MetaedgeEntry(code="PCiC", label="Pharmacologic-Class–includes–Compound", edge_count=1029),
]

ALGORITHM_GROUPS: list[tuple[str, list[tuple[str, str, str]]]] = [
    # group_name -> list of (name, family, mech)
    (
        "Quantum kernels",
        [
            ("QSVC (Pauli)", "hybrid", "Pauli ZZ feature map → quantum kernel → classical SVM"),
            ("QSVC (Z)", "hybrid", "Z feature map → quantum kernel"),
            (
                "Fidelity Quantum Kernel",
                "hybrid",
                "|⟨ψ(x)|ψ(x′)⟩|² with hardware-efficient encoding",
            ),
            ("Projected Quantum Kernel", "hybrid", "projected kernel on subset of qubits"),
            ("Trainable Quantum Kernel", "hybrid", "kernel-target alignment optimization"),
        ],
    ),
    (
        "Variational quantum",
        [
            ("VQC", "hybrid", "parameterized circuit + classical optimizer (COBYLA)"),
            ("QAOA", "quantum", "cost + mixer Hamiltonian, depth p=3"),
            ("VQE-classifier", "quantum", "VQE-based ground-state distinguishability"),
            ("Hardware-efficient ansatz", "quantum", "hardware-native two-qubit blocks"),
            ("EfficientSU2", "hybrid", "EfficientSU2 ansatz with linear entanglement"),
        ],
    ),
    (
        "Classical baselines",
        [
            ("Stacking", "classical", "heterogeneous ensemble meta-learner"),
            ("XGBoost", "classical", "gradient boosted trees"),
            ("LightGBM", "classical", "histogram-based gradient boosting"),
            ("Random Forest", "classical", "bagged decision trees"),
            ("Logistic Regression", "classical", "L2-regularized logistic"),
            ("SVM (RBF)", "classical", "RBF kernel SVM"),
            ("MLP", "classical", "3-layer MLP with dropout"),
            ("CatBoost", "classical", "ordered boosting on categorical features"),
        ],
    ),
    (
        "KG embeddings",
        [
            ("RotatE", "classical", "relation rotation in complex space"),
            ("TransE", "classical", "translational embedding in real space"),
            ("ComplEx", "classical", "complex-valued bilinear scoring"),
            ("DistMult", "classical", "diagonal bilinear scoring"),
        ],
    ),
    (
        "Graph neural networks",
        [
            ("R-GCN", "classical", "relational GCN (one matrix per metaedge)"),
            ("CompGCN", "classical", "composition-based multi-relational GCN"),
            ("GraphSAGE", "classical", "inductive sampling-based aggregation"),
        ],
    ),
    (
        "Hybrid quantum-classical",
        [
            ("Quantum Kernel + Metapath", "hybrid", "metapath features → quantum kernel → SVM"),
            ("QGNN", "hybrid", "quantum-encoded node features → classical GNN"),
            ("QBoost", "hybrid", "quantum-annealed boosting weights"),
        ],
    ),
    (
        "Heuristic / metapath",
        [
            ("DWPC (Project Rephetio)", "classical", "Degree-Weighted Path Count"),
            ("Random Walk w/ Restart", "classical", "personalized PageRank from compound"),
            ("PathCount Geometric", "classical", "geometric mean of metapath counts"),
            ("Resistance Distance", "classical", "graph Laplacian pseudoinverse"),
        ],
    ),
]

# 23 guards bucketed into the six groups rendered on Initialize · Evidence
# posture. Group names mirror `hetqml-pages/initialize/index.html` verbatim so
# Initialize, Experiment, and Validate render the same five-group structure.
INTEGRITY_GUARDS: list[IntegrityGuardEntry] = [
    # --- Bias / equity (4) ------------------------------------------------
    IntegrityGuardEntry(
        id="ancestry-balance",
        label="Ancestry-balanced negatives",
        description="Hard negatives sampled per ancestry stratum",
        critical=True,
        default_on=True,
        group="Bias / equity",
    ),
    IntegrityGuardEntry(
        id="equity-flag",
        label="Equity caveat surfaced",
        description="Compound equity caveat shown when present",
        critical=True,
        default_on=True,
        group="Bias / equity",
    ),
    IntegrityGuardEntry(
        id="hard-negatives",
        label="Hard negatives included",
        description="Negatives drawn from co-treated diseases",
        critical=True,
        default_on=True,
        group="Bias / equity",
    ),
    IntegrityGuardEntry(
        id="negative-ratio",
        label="Hard-negative ratio",
        description="≥1:5 hard:positive negatives",
        critical=False,
        default_on=True,
        group="Bias / equity",
    ),
    # --- Data quality (4) -------------------------------------------------
    IntegrityGuardEntry(
        id="leakage-anchor",
        label="Anchor-target leakage check",
        description="Anchor gene held out from training metapaths",
        critical=True,
        default_on=True,
        group="Data quality",
    ),
    IntegrityGuardEntry(
        id="feature-leakage",
        label="Feature leakage check",
        description="No metapath includes the held-out edge",
        critical=True,
        default_on=True,
        group="Data quality",
    ),
    IntegrityGuardEntry(
        id="time-split",
        label="Time-split validation",
        description="Train < cutoff < test by curation date",
        critical=False,
        default_on=True,
        group="Data quality",
    ),
    IntegrityGuardEntry(
        id="provenance",
        label="Provenance hashed",
        description="Inputs SHA-256 hashed and logged",
        critical=False,
        default_on=True,
        group="Data quality",
    ),
    # --- Statistical rigor (5) -------------------------------------------
    IntegrityGuardEntry(
        id="bootstrap-ci",
        label="Bootstrap 95% CI",
        description="N=1000 bootstrap on metric of interest",
        critical=False,
        default_on=True,
        group="Statistical rigor",
    ),
    IntegrityGuardEntry(
        id="multi-seed",
        label="Multi-seed stability",
        description="≥3 seeds per configuration; report std",
        critical=False,
        default_on=True,
        group="Statistical rigor",
    ),
    IntegrityGuardEntry(
        id="calibration",
        label="Calibration check",
        description="Reliability diagram + ECE/MCE",
        critical=True,
        default_on=True,
        group="Statistical rigor",
    ),
    IntegrityGuardEntry(
        id="dwpc-baseline",
        label="DWPC baseline parity",
        description="Top model must beat DWPC by margin",
        critical=True,
        default_on=True,
        group="Statistical rigor",
    ),
    IntegrityGuardEntry(
        id="random-baseline",
        label="Random baseline parity",
        description="Top model must beat random by p<0.05",
        critical=True,
        default_on=True,
        group="Statistical rigor",
    ),
    # --- Reproducibility (3) ---------------------------------------------
    IntegrityGuardEntry(
        id="reviewer-blind",
        label="Reviewer-blind ranking",
        description="Top-K ranking computed without label peek",
        critical=True,
        default_on=True,
        group="Reproducibility",
    ),
    IntegrityGuardEntry(
        id="unit-tests",
        label="Unit tests green",
        description="`pytest` and `vitest` green on this branch",
        critical=False,
        default_on=True,
        group="Reproducibility",
    ),
    IntegrityGuardEntry(
        id="lodo",
        label="Leave-one-disease-out",
        description="Each fold withholds one disease entirely",
        critical=False,
        default_on=False,
        group="Reproducibility",
    ),
    # --- Quantum integrity (4) -------------------------------------------
    IntegrityGuardEntry(
        id="quantum-zne",
        label="ZNE error mitigation",
        description="Zero-noise extrapolation on quantum runs",
        critical=False,
        default_on=True,
        group="Quantum integrity",
    ),
    IntegrityGuardEntry(
        id="readout-mit",
        label="Readout error mitigation",
        description="M3 readout-error mitigation",
        critical=False,
        default_on=True,
        group="Quantum integrity",
    ),
    IntegrityGuardEntry(
        id="shot-budget",
        label="Shot-budget check",
        description="Total shots ≤ tier allocation",
        critical=False,
        default_on=True,
        group="Quantum integrity",
    ),
    IntegrityGuardEntry(
        id="kernel-spread",
        label="Kernel spread sanity",
        description="Kernel σ within plausible range",
        critical=False,
        default_on=True,
        group="Quantum integrity",
    ),
    # --- Hetionet integrity (3) ------------------------------------------
    IntegrityGuardEntry(
        id="degree-correction",
        label="Degree correction",
        description="DWPC-style hub penalty applied",
        critical=False,
        default_on=True,
        group="Hetionet integrity",
    ),
    IntegrityGuardEntry(
        id="path-length-cap",
        label="Path-length cap",
        description="Metapaths capped at length 4",
        critical=False,
        default_on=True,
        group="Hetionet integrity",
    ),
    IntegrityGuardEntry(
        id="loco",
        label="Leave-one-compound-out",
        description="Each fold withholds one compound entirely",
        critical=False,
        default_on=False,
        group="Hetionet integrity",
    ),
]


def _seeded(seed: int) -> random.Random:
    return random.Random(seed)


@lru_cache(maxsize=1)
def diseases_catalog() -> DiseaseCatalog:
    """137 deterministic synthetic diseases."""
    rng = _seeded(CATALOG_SEED ^ 0x01)
    items: list[DiseaseEntry] = list(CURATED_DISEASES)
    used = {d.doid for d in items}
    idx = 0
    while len(items) < 137:
        category = DISEASE_CATEGORIES[idx % len(DISEASE_CATEGORIES)]
        doid = f"DOID:{100000 + rng.randint(0, 899999)}"
        if doid in used:
            continue
        used.add(doid)
        items.append(
            DiseaseEntry(
                name=f"Synth {category.title()} disorder #{len(items) - len(CURATED_DISEASES) + 1}",
                doid=doid,
                category=category,
            )
        )
        idx += 1
    return DiseaseCatalog(seed=CATALOG_SEED, count=len(items), items=items)


@lru_cache(maxsize=1)
def compounds_catalog() -> CompoundCatalog:
    """1,552 deterministic synthetic compounds."""
    rng = _seeded(CATALOG_SEED ^ 0x02)
    items: list[CompoundEntry] = list(CURATED_COMPOUNDS)
    used = {c.drugbank_id for c in items}
    while len(items) < 1552:
        tc = THERAPEUTIC_CLASSES[rng.randint(0, len(THERAPEUTIC_CLASSES) - 1)]
        dbid = f"DB{rng.randint(1, 99999):05d}"
        if dbid in used:
            continue
        used.add(dbid)
        items.append(
            CompoundEntry(
                name=f"Synth-{dbid}",
                drugbank_id=dbid,
                therapeutic_class=tc,
                fda_approved=rng.random() < 0.55,
            )
        )
    return CompoundCatalog(seed=CATALOG_SEED, count=len(items), items=items)


@lru_cache(maxsize=1)
def genes_catalog() -> GeneCatalog:
    """20,945 deterministic synthetic genes."""
    rng = _seeded(CATALOG_SEED ^ 0x03)
    items: list[GeneEntry] = list(CURATED_GENES)
    used = {g.symbol for g in items}
    while len(items) < 20945:
        category = GENE_CATEGORIES[rng.randint(0, len(GENE_CATEGORIES) - 1)]
        sym = f"SYN{len(items):05d}"
        if sym in used:
            continue
        used.add(sym)
        items.append(
            GeneEntry(
                symbol=sym,
                ncbi_id=str(100000 + len(items)),
                category=category,
            )
        )
    return GeneCatalog(seed=CATALOG_SEED, count=len(items), items=items)


@lru_cache(maxsize=1)
def metaedges_catalog() -> MetaedgeCatalog:
    return MetaedgeCatalog(seed=CATALOG_SEED, count=len(METAEDGES), items=list(METAEDGES))


@lru_cache(maxsize=1)
def algorithms_catalog() -> AlgorithmCatalog:
    """32 algorithms across 7 groups (matches the plan's stated count)."""
    rng = _seeded(CATALOG_SEED ^ 0x04)
    items: list[AlgorithmEntry] = []
    statuses: list[tuple[str, float]] = [("live", 0.65), ("dev", 0.85), ("fallback", 1.0)]
    for group_name, rows in ALGORITHM_GROUPS:
        for name, family, mech in rows:
            r = rng.random()
            status = next(label for label, threshold in statuses if r < threshold)
            params = f"{rng.randint(8, 64)}p" if family != "classical" else f"{rng.randint(10, 999)}c"
            runtime = f"~{rng.choice([10, 30, 45, 90, 150, 180, 300])}s"
            items.append(
                AlgorithmEntry(
                    name=name,
                    group=group_name,
                    family=family,  # type: ignore[arg-type]
                    mech=mech,
                    params=params,
                    runtime=runtime,
                    status=status,  # type: ignore[arg-type]
                )
            )
    assert len(items) == 32, f"expected 32 algorithms, got {len(items)}"
    return AlgorithmCatalog(seed=CATALOG_SEED, count=len(items), items=items)


@lru_cache(maxsize=1)
def integrity_guards_catalog() -> IntegrityGuardCatalog:
    return IntegrityGuardCatalog(
        seed=CATALOG_SEED, count=len(INTEGRITY_GUARDS), items=list(INTEGRITY_GUARDS)
    )
