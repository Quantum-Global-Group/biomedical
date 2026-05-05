"""Pydantic schemas for the hetqml API.

The `JobResult` payload is intentionally one big nested object so the UI can
make a single poll and render every panel from it. ML-derived fields are
populated by `simulate_run` until the real pipeline lands (Phase 2 step 11);
they are wire-stable so the UI build does not have to wait on the ML work.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


def _to_camel(name: str) -> str:
    head, *rest = name.split("_")
    return head + "".join(part.capitalize() for part in rest)


class CamelModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=_to_camel)


# --- Selection / run path -------------------------------------------------


class Selection(BaseModel):
    disease: str
    compound: str
    gene: str
    metaedge: str


class RunPath(BaseModel):
    mode: Literal["quick", "custom"] = "quick"
    family: Literal["classical", "hybrid", "quantum"] = "hybrid"


class RunInvestigationRequest(BaseModel):
    selection: Selection
    run_path: RunPath = Field(default_factory=RunPath)


JobStatus = Literal["queued", "running", "completed", "failed"]


# --- Catalog entries (returned by /catalog/* endpoints) -------------------


class DiseaseEntry(CamelModel):
    name: str
    doid: str
    category: str


class CompoundEntry(CamelModel):
    name: str
    drugbank_id: str
    therapeutic_class: str
    fda_approved: bool


class GeneEntry(CamelModel):
    symbol: str
    ncbi_id: str
    category: str


class MetaedgeEntry(CamelModel):
    code: str
    label: str
    edge_count: int


class AlgorithmEntry(CamelModel):
    name: str
    group: str
    family: Literal["classical", "hybrid", "quantum"]
    mech: str
    params: str
    runtime: str
    status: Literal["live", "dev", "fallback"]


class IntegrityGuardEntry(CamelModel):
    id: str
    label: str
    description: str
    critical: bool
    default_on: bool


class CatalogEnvelope(CamelModel):
    """Wrapper around catalog payloads. `synthetic=true` flags v1 data."""

    synthetic: bool = True
    seed: int
    count: int


class DiseaseCatalog(CatalogEnvelope):
    items: list[DiseaseEntry]


class CompoundCatalog(CatalogEnvelope):
    items: list[CompoundEntry]


class GeneCatalog(CatalogEnvelope):
    items: list[GeneEntry]


class MetaedgeCatalog(CatalogEnvelope):
    items: list[MetaedgeEntry]


class AlgorithmCatalog(CatalogEnvelope):
    items: list[AlgorithmEntry]


class IntegrityGuardCatalog(CatalogEnvelope):
    items: list[IntegrityGuardEntry]


# --- JobResult payload ----------------------------------------------------


class JobMetrics(CamelModel):
    """Top-line classification metrics. Kept stable for backward compat."""

    pr_auc: float
    roc_auc: float
    brier: float
    ece: float


class MetricCI(CamelModel):
    """Bootstrap 95% confidence interval for a single metric."""

    name: str
    value: float
    ci_low: float
    ci_high: float


class CVFold(CamelModel):
    fold: int
    pr_auc: float
    roc_auc: float


class DetailedMetrics(CamelModel):
    metric_cis: list[MetricCI]
    cv_folds: list[CVFold]
    cv_strategy: str = "5-fold stratified"


class LeaderboardRow(CamelModel):
    model: str
    family: Literal["classical", "hybrid", "quantum"]
    pr_auc: float
    roc_auc: float
    delta_classical: float
    is_top: bool = False


class BenchmarkRow(CamelModel):
    """One row of the 6-tab benchmark suite — values stored as strings so
    formatted units (e.g. '4m 12s', '$2.14', '16,432') round-trip cleanly."""

    model: str
    family: Literal["Classical", "Hybrid", "Quantum"]
    status: str
    cells: dict[str, str]


class StatComparisonRow(CamelModel):
    label: str
    delta: float
    p_value: float
    effect_size: float
    significance: Literal["ns", "marginal", "significant", "highly-significant"]


class CandidateRankingRow(CamelModel):
    rank: int
    compound: str
    disease: str
    score: float
    delta_classical: float


class CandidateSpotlight(CamelModel):
    score: float
    reasons: list[str]
    ranking: list[CandidateRankingRow]


class IntegrityGuardState(CamelModel):
    id: str
    label: str
    passing: bool
    critical: bool


class TrustAxis(CamelModel):
    """One spoke of the radar — value is 0..1, computed from clinical /
    mechanism / model / baseline / artifact evidence."""

    axis: Literal["clinical", "mechanism", "model", "baseline", "artifact"]
    value: float
    passing: bool


class TrustScorecard(CamelModel):
    composite: float
    axes: list[TrustAxis]


class CalibrationBin(CamelModel):
    bin_low: float
    bin_high: float
    predicted: float
    observed: float
    count: int


class ReliabilityDiagram(CamelModel):
    bins: list[CalibrationBin]
    brier: float
    ece: float
    mce: float
    log_loss: float


class SkepticWarning(CamelModel):
    source: Literal[
        "equity",
        "cv-variance",
        "delta-classical",
        "top-loses-to-classical",
        "guards",
        "calibration",
        "anchor-mismatch",
    ]
    severity: Literal["info", "warn", "crit"]
    message: str


class EvidenceMatrixCell(CamelModel):
    layer: Literal["molecule", "kg", "mechanism", "clinical", "classical", "quantum"]
    state: Literal["live", "fallback", "missing", "supports", "weakens"]
    note: str


class EvidenceMatrix(CamelModel):
    cells: list[EvidenceMatrixCell]
    summary: str


class ModelAgreementBar(CamelModel):
    family: Literal["classical", "hybrid", "quantum"]
    score: float
    delta_reference: float


class ModelAgreement(CamelModel):
    bars: list[ModelAgreementBar]
    spread: float
    mean: float
    verdict: Literal["STRONG_AGREEMENT", "PARTIAL_DIVERGENCE", "BRANCH_DIVERGENCE"]


class ProvenanceEvent(CamelModel):
    timestamp: str  # HH:MM:SS UTC
    label: str
    source: str
    fallback: bool = False


class QualityFlag(CamelModel):
    label: str
    state: Literal["pass", "warn", "fail"]
    detail: str


class EvidenceOverlay(CamelModel):
    column: Literal["target_pathway", "relation", "model_score"]
    items: list[str]


class InterpretationPanel(CamelModel):
    plausible: list[str]
    weak: list[str]


class QuantumCircuitInfo(CamelModel):
    backend: str | None = None
    qubits: int | None = None
    shots: int | None = None
    depth: int | None = None
    fidelity: float | None = None
    zne_enabled: bool = False
    title: str
    note: str | None = None


class EvidencePathStep(CamelModel):
    """One labelled edge in the candidate evidence path diagram."""

    from_node: str = Field(alias="from")
    to_node: str = Field(alias="to")
    metaedge: str
    weight: float
    sources: list[str]


class EvidencePath(CamelModel):
    steps: list[EvidencePathStep]
    plausibility: float
    threshold: float = 0.40


class JobResult(CamelModel):
    """Full ML-output payload. `metrics` mirrors the legacy top-line so the
    UI can fall back to it; the richer panels read from the deeper fields."""

    # ML-derived (stubbed by simulate_run for now)
    metrics: JobMetrics
    detailed_metrics: DetailedMetrics
    leaderboard: list[LeaderboardRow]
    benchmark_rows: list[BenchmarkRow]
    stat_comparison: list[StatComparisonRow]
    candidate_spotlight: CandidateSpotlight

    # Validate-page payloads
    integrity_guards: list[IntegrityGuardState]
    trust_scorecard: TrustScorecard
    reliability: ReliabilityDiagram
    skeptic_warnings: list[SkepticWarning]

    # Visualize-page payloads
    evidence_matrix: EvidenceMatrix
    model_agreement: ModelAgreement
    provenance: list[ProvenanceEvent]
    quality_flags: list[QualityFlag]
    evidence_overlays: list[EvidenceOverlay]
    interpretation: InterpretationPanel
    quantum_circuit: QuantumCircuitInfo
    evidence_path: EvidencePath


class Job(CamelModel):
    id: str
    status: JobStatus
    selection: Selection
    run_path: RunPath
    created_at: datetime
    completed_at: datetime | None = None
    metrics: JobMetrics | None = None
    result: JobResult | None = None
    error: str | None = None


# --- Persistence (decisions, skeptic notes, settings) ---------------------


DecisionVerdict = Literal["keep", "review", "reject"]


class DecisionRecord(CamelModel):
    id: str
    pair_key: str  # f"{compoundId}::{diseaseId}"
    verdict: DecisionVerdict
    reviewer: str
    session_id: str
    selection: Selection
    run_path: RunPath
    top_model: str
    model_score: float
    trust_score: float
    trust_axes: list[TrustAxis]
    guards_compromised: int
    timestamp: datetime
    note: str | None = None


class DecisionCreateRequest(CamelModel):
    pair_key: str
    verdict: DecisionVerdict
    reviewer: str
    session_id: str
    selection: Selection
    run_path: RunPath
    top_model: str
    model_score: float
    trust_score: float
    trust_axes: list[TrustAxis]
    guards_compromised: int
    note: str | None = None


class SkepticNote(CamelModel):
    pair_key: str  # f"{compoundId}::{diseaseId}"
    body: str
    updated_at: datetime


class SkepticNoteUpsertRequest(CamelModel):
    pair_key: str
    body: str


# Settings is intentionally permissive — the schema only validates
# the well-known sections. Unknown keys are dropped.


class ProfileSettings(CamelModel):
    reviewer_name: str = ""
    role: str = ""
    organization: str = ""
    contact_email: str = ""


class AppearanceSettings(CamelModel):
    theme: Literal["light", "dark", "auto"] = "dark"
    accent: str = "teal"
    density: Literal["comfortable", "compact"] = "comfortable"
    reduce_motion: bool = False


class PipelineSettings(CamelModel):
    default_run_path: Literal["classical", "hybrid", "quantum"] = "hybrid"
    default_metaedge: str = "CtD"
    hard_negative_ratio: Literal["1:3", "1:5", "1:10"] = "1:5"
    strict_posture: bool = True
    autosave_sessions: bool = True


class QuantumSettings(CamelModel):
    default_backend: str = "ibm_torino"
    shots_per_circuit: int = 16384
    job_timeout_seconds: int = 1800
    zne_enabled: bool = True
    pulse_level_access: bool = False


class IbmConnectionSettings(CamelModel):
    crn: str = ""
    validated: bool = False
    plan_tier: str | None = None
    instance_name: str | None = None


class NotificationSettings(CamelModel):
    email: bool = True
    slack: bool = False
    browser_push: bool = False
    severity_threshold: Literal["info", "warn", "crit"] = "warn"
    slack_webhook_url: str = ""


class PrivacySettings(CamelModel):
    anonymous_usage: bool = True
    error_reporting: bool = True
    crash_diagnostics: bool = False
    decision_retention_days: Literal[30, 90, 365, 0] = 365  # 0 = forever


class ApiKeysSettings(CamelModel):
    """BYOK fields for external integrations.

    All optional. The dashboard backend never proxies these to upstream
    services on its own — the credentials are persisted so the user does
    not have to re-enter them, and they are surfaced back to the page so
    masking / status indicators can render. Routers that require a key
    look it up here at request time.
    """

    openai: str | None = None
    anthropic: str | None = None
    pubchem_premium: str | None = None
    drugbank_pro: str | None = None
    sentry_dsn: str | None = None


class UserSettings(CamelModel):
    profile: ProfileSettings = Field(default_factory=ProfileSettings)
    appearance: AppearanceSettings = Field(default_factory=AppearanceSettings)
    pipeline: PipelineSettings = Field(default_factory=PipelineSettings)
    quantum: QuantumSettings = Field(default_factory=QuantumSettings)
    ibm_connection: IbmConnectionSettings = Field(default_factory=IbmConnectionSettings)
    notifications: NotificationSettings = Field(default_factory=NotificationSettings)
    privacy: PrivacySettings = Field(default_factory=PrivacySettings)
    api_keys: ApiKeysSettings = Field(default_factory=ApiKeysSettings)


# --- Operations (canned for v1, behind a provider interface) --------------


HealthState = Literal["healthy", "degraded", "down"]


class OpsHealth(CamelModel):
    overall: HealthState
    services: list["OpsService"]
    healthy_count: int
    total_count: int


class OpsService(CamelModel):
    id: str
    label: str
    state: HealthState
    latency_ms: float
    uptime_30d: float
    last_probe: datetime


OpsHealth.model_rebuild()


class IbmUsageMTD(CamelModel):
    quantum_seconds_used: float
    quantum_seconds_allocated: float
    concurrent_jobs: int
    jobs_this_month: int
    success_rate: float
    spend_usd: float


class IbmBackendAccess(CamelModel):
    backend: str
    access: Literal["allowed", "sim", "locked"]


class IbmRecentJob(CamelModel):
    id: str
    backend: str
    status: str
    duration_seconds: float


class IbmWorkload(CamelModel):
    configured: bool
    validated: bool
    account: str | None = None
    instance: str | None = None
    region: str | None = None
    plan: str | None = None
    usage: IbmUsageMTD | None = None
    backend_access: list[IbmBackendAccess] = Field(default_factory=list)
    recent_jobs: list[IbmRecentJob] = Field(default_factory=list)


class QuantumBackend(CamelModel):
    id: str
    processor: str
    queue: int
    qubits: int
    t1_us: float
    t2_us: float
    readout_fidelity: float
    two_q_gate_error: float
    last_calibration: datetime


class JobQueueEntry(CamelModel):
    id: str
    type: str
    candidate: str
    backend: str
    status: Literal["queued", "running", "transpiling", "measuring"]
    progress_pct: int
    eta_seconds: int


class JobHistoryEntry(CamelModel):
    id: str
    candidate: str
    disease: str
    top_model: str
    family: Literal["classical", "hybrid", "quantum"]
    status: Literal["completed", "failed"]
    duration_seconds: float
    cost_usd: float
    started_ago_seconds: int


class OpsJobs(CamelModel):
    queue: list[JobQueueEntry]
    history: list[JobHistoryEntry]


class ResourceCounter(CamelModel):
    label: str
    used: float
    cap: float
    unit: str


class CostBucket(CamelModel):
    service: str
    spend_usd: float
    pace: Literal["under", "on-pace", "over"]


class CostSummary(CamelModel):
    mtd_spend: float
    monthly_budget: float
    linear_pace: float
    buckets: list[CostBucket]


class DataSourceSnapshot(CamelModel):
    name: str
    sha256: str
    last_sync: datetime
    sla_hours: int
    fresh: bool


class AlertEntry(CamelModel):
    severity: Literal["ok", "warn", "crit"]
    title: str
    source: str
    age_seconds: int
    resolved: bool


class OpsAlerts(CamelModel):
    active: list[AlertEntry]
    recent_resolved: list[AlertEntry]


class OpsBackends(CamelModel):
    backends: list[QuantumBackend]


class OpsResources(CamelModel):
    counters: list[ResourceCounter]


class OpsSources(CamelModel):
    sources: list[DataSourceSnapshot]
