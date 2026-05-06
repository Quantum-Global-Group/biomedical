import type { Selection } from "@/lib/investigation/recommendations";
import type { RunFamilyId, RunPathChoice } from "@/lib/investigation/runPath";

export type JobStatus = "queued" | "running" | "completed" | "failed";

export interface JobMetrics {
  prAuc: number;
  rocAuc: number;
  brier: number;
  ece: number;
}

// --- JobResult sub-types (mirror hetqml_api.schemas) ----------------------

export interface MetricCI {
  name: string;
  value: number;
  ciLow: number;
  ciHigh: number;
}

export interface CVFold {
  fold: number;
  prAuc: number;
  rocAuc: number;
}

export interface DetailedMetrics {
  metricCis: MetricCI[];
  cvFolds: CVFold[];
  cvStrategy: string;
}

export interface LeaderboardRow {
  model: string;
  family: RunFamilyId;
  prAuc: number;
  rocAuc: number;
  deltaClassical: number;
  isTop: boolean;
  /** Display-formatted parameter count (e.g. "28", "2.1k", "n"). Plain
   * number-like strings are used by the leaderboard footer to compute the
   * path-aware "params / classical" ratio. Defaults to "—" when omitted. */
  params?: string;
}

export type BenchmarkFamily = "Classical" | "Hybrid" | "Quantum";

export interface BenchmarkRow {
  model: string;
  family: BenchmarkFamily;
  status: string;
  cells: Record<string, string>;
}

export type StatSignificance =
  | "ns"
  | "marginal"
  | "significant"
  | "highly-significant";

export interface StatComparisonRow {
  label: string;
  delta: number;
  pValue: number;
  effectSize: number;
  significance: StatSignificance;
}

export interface CandidateRankingRow {
  rank: number;
  compound: string;
  disease: string;
  score: number;
  deltaClassical: number;
}

export interface CandidateSpotlight {
  score: number;
  reasons: string[];
  ranking: CandidateRankingRow[];
}

export interface IntegrityGuardState {
  id: string;
  label: string;
  passing: boolean;
  critical: boolean;
}

export type TrustAxisName =
  | "clinical"
  | "mechanism"
  | "model"
  | "baseline"
  | "artifact";

export interface TrustAxis {
  axis: TrustAxisName;
  value: number;
  passing: boolean;
}

export interface TrustScorecard {
  composite: number;
  axes: TrustAxis[];
}

export interface CalibrationBin {
  binLow: number;
  binHigh: number;
  predicted: number;
  observed: number;
  count: number;
}

export interface ReliabilityDiagram {
  bins: CalibrationBin[];
  brier: number;
  ece: number;
  mce: number;
  logLoss: number;
}

export type SkepticSource =
  | "equity"
  | "cv-variance"
  | "delta-classical"
  | "top-loses-to-classical"
  | "guards"
  | "calibration"
  | "anchor-mismatch";

export interface SkepticWarning {
  source: SkepticSource;
  severity: "info" | "warn" | "crit";
  message: string;
}

export type EvidenceLayer =
  | "molecule"
  | "kg"
  | "mechanism"
  | "clinical"
  | "classical"
  | "quantum";
export type EvidenceState =
  | "live"
  | "fallback"
  | "missing"
  | "supports"
  | "weakens";

export interface EvidenceMatrixCell {
  layer: EvidenceLayer;
  state: EvidenceState;
  note: string;
}

export interface EvidenceMatrix {
  cells: EvidenceMatrixCell[];
  summary: string;
}

export interface ModelAgreementBar {
  family: RunFamilyId;
  score: number;
  deltaReference: number;
}

export type ModelAgreementVerdict =
  | "STRONG_AGREEMENT"
  | "PARTIAL_DIVERGENCE"
  | "BRANCH_DIVERGENCE";

export interface ModelAgreement {
  bars: ModelAgreementBar[];
  spread: number;
  mean: number;
  verdict: ModelAgreementVerdict;
}

export interface ProvenanceEvent {
  timestamp: string;
  label: string;
  source: string;
  fallback: boolean;
}

export interface QualityFlag {
  label: string;
  state: "pass" | "warn" | "fail";
  detail: string;
}

export interface EvidenceOverlay {
  column: "target_pathway" | "relation" | "model_score";
  items: string[];
}

export interface InterpretationPanel {
  plausible: string[];
  weak: string[];
}

export interface QuantumCircuitInfo {
  backend: string | null;
  qubits: number | null;
  shots: number | null;
  depth: number | null;
  fidelity: number | null;
  zneEnabled: boolean;
  title: string;
  note: string | null;
}

export interface EvidencePathStep {
  from: string;
  to: string;
  metaedge: string;
  weight: number;
  sources: string[];
}

export interface EvidencePath {
  steps: EvidencePathStep[];
  plausibility: number;
  threshold: number;
}

export interface JobResult {
  metrics: JobMetrics;
  detailedMetrics: DetailedMetrics;
  leaderboard: LeaderboardRow[];
  benchmarkRows: BenchmarkRow[];
  statComparison: StatComparisonRow[];
  candidateSpotlight: CandidateSpotlight;
  integrityGuards: IntegrityGuardState[];
  trustScorecard: TrustScorecard;
  reliability: ReliabilityDiagram;
  skepticWarnings: SkepticWarning[];
  evidenceMatrix: EvidenceMatrix;
  modelAgreement: ModelAgreement;
  provenance: ProvenanceEvent[];
  qualityFlags: QualityFlag[];
  evidenceOverlays: EvidenceOverlay[];
  interpretation: InterpretationPanel;
  quantumCircuit: QuantumCircuitInfo;
  evidencePath: EvidencePath;
  /** 2D embedding coordinates parallel to `candidateSpotlight.ranking`.
   * The first row is the focus pair (rank 1) and the Visualize · UMAP
   * scatter highlights it. Coords are deterministic from the job seed
   * so re-rendering doesn't shuffle the layout. Approx range [-1, 1].
   * Null when the job hasn't completed; populated for completed jobs. */
  embedding: number[][] | null;
}

export interface Job {
  id: string;
  status: JobStatus;
  selection: Selection;
  runPath: { mode: string; family: RunFamilyId };
  createdAt: string;
  completedAt: string | null;
  metrics: JobMetrics | null;
  result: JobResult | null;
  error: string | null;
}

function apiBase(): string {
  if (typeof window === "undefined") {
    return process.env.API_INTERNAL_URL ?? "http://localhost:8000";
  }
  const lite =
    process.env.NEXT_PUBLIC_LITE_MODE === "true" ||
    process.env.NEXT_PUBLIC_LITE_MODE === "1";
  const disableProxy =
    process.env.NEXT_PUBLIC_DISABLE_DEV_API_PROXY === "true" ||
    process.env.NEXT_PUBLIC_DISABLE_DEV_API_PROXY === "1";
  if (
    process.env.NODE_ENV === "development" &&
    !lite &&
    !disableProxy
  ) {
    return "/__hetqml_api";
  }
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    signal:
      init?.signal ??
      AbortSignal.timeout(90_000),
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let detail: string;
    try {
      detail = (await res.json()).detail ?? res.statusText;
    } catch {
      detail = res.statusText;
    }
    throw new Error(`${res.status} ${detail}`);
  }
  return res.json() as Promise<T>;
}

export interface RunInvestigationInput {
  selection: Selection;
  runPath: RunPathChoice;
}

export function startInvestigation(input: RunInvestigationInput): Promise<Job> {
  return request<Job>("/investigations/run", {
    method: "POST",
    body: JSON.stringify({
      selection: input.selection,
      run_path: {
        mode: input.runPath.mode ?? "quick",
        family: input.runPath.family ?? "hybrid",
      },
    }),
  });
}

export function getJob(id: string): Promise<Job> {
  return request<Job>(`/jobs/${encodeURIComponent(id)}`);
}

// --- Catalog API ----------------------------------------------------------

export interface CatalogEnvelope {
  synthetic: boolean;
  seed: number;
  count: number;
}

export interface ApiDiseaseEntry {
  name: string;
  doid: string;
  category: string;
}
export interface ApiCompoundEntry {
  name: string;
  drugbankId: string;
  therapeuticClass: string;
  fdaApproved: boolean;
  /** PubChem CID for the Visualize · 3D molecule viewer. Null for
   * synthetic compounds — the viewer falls back to an empty state. */
  pubchemCid: number | null;
}
export interface ApiGeneEntry {
  symbol: string;
  ncbiId: string;
  category: string;
}
export interface ApiMetaedgeEntry {
  code: string;
  label: string;
  edgeCount: number;
}
export type AlgoFamily = "classical" | "hybrid" | "quantum";
export interface ApiAlgorithmEntry {
  name: string;
  group: string;
  family: AlgoFamily;
  mech: string;
  params: string;
  runtime: string;
  status: "live" | "dev" | "fallback";
}
export interface ApiIntegrityGuardEntry {
  id: string;
  label: string;
  description: string;
  critical: boolean;
  defaultOn: boolean;
  /** Top-level group as rendered on Initialize · Evidence posture. */
  group: string;
}

export interface DiseaseCatalogResponse extends CatalogEnvelope {
  items: ApiDiseaseEntry[];
}
export interface CompoundCatalogResponse extends CatalogEnvelope {
  items: ApiCompoundEntry[];
}
export interface GeneCatalogResponse extends CatalogEnvelope {
  items: ApiGeneEntry[];
}
export interface MetaedgeCatalogResponse extends CatalogEnvelope {
  items: ApiMetaedgeEntry[];
}
export interface AlgorithmCatalogResponse extends CatalogEnvelope {
  items: ApiAlgorithmEntry[];
}
export interface IntegrityGuardCatalogResponse extends CatalogEnvelope {
  items: ApiIntegrityGuardEntry[];
}

export function fetchDiseasesCatalog(): Promise<DiseaseCatalogResponse> {
  return request<DiseaseCatalogResponse>("/catalog/diseases");
}
export function fetchCompoundsCatalog(): Promise<CompoundCatalogResponse> {
  return request<CompoundCatalogResponse>("/catalog/compounds");
}
export function fetchGenesCatalog(): Promise<GeneCatalogResponse> {
  return request<GeneCatalogResponse>("/catalog/genes");
}
export function fetchMetaedgesCatalog(): Promise<MetaedgeCatalogResponse> {
  return request<MetaedgeCatalogResponse>("/catalog/metaedges");
}
export function fetchAlgorithmsCatalog(): Promise<AlgorithmCatalogResponse> {
  return request<AlgorithmCatalogResponse>("/catalog/algorithms");
}
export function fetchIntegrityGuardsCatalog(): Promise<IntegrityGuardCatalogResponse> {
  return request<IntegrityGuardCatalogResponse>("/catalog/integrity-guards");
}

// --- Molecule SDF --------------------------------------------------------

/** Fetch a 3D SDF for a PubChem CID via the API's cached PubChem proxy.
 *
 * Returns the raw SDF text (suitable for `viewer.addModel(text, "sdf")`
 * with 3Dmol). Throws on 404 ("CID not found") and other non-2xx
 * responses; callers should display an empty/error state. */
export async function getMoleculeSdf(cid: number): Promise<string> {
  const res = await fetch(`${apiBase()}/molecule/${cid}`, {
    headers: { accept: "chemical/x-mdl-sdfile,text/plain;q=0.9" },
  });
  if (!res.ok) {
    let detail: string;
    try {
      detail = (await res.json()).detail ?? res.statusText;
    } catch {
      detail = res.statusText;
    }
    throw new Error(`${res.status} ${detail}`);
  }
  return res.text();
}

// --- Operations API ------------------------------------------------------
//
// Eight panel feeds for the Operations dashboard. Wire-shape mirrors
// hetqml_api.schemas.* (CamelModel → camelCase). Datetimes arrive as ISO
// strings.

export type OpsHealthState = "healthy" | "degraded" | "down";

export interface OpsService {
  id: string;
  label: string;
  state: OpsHealthState;
  latencyMs: number;
  uptime30d: number;
  lastProbe: string;
}
export interface OpsHealthResponse {
  overall: OpsHealthState;
  services: OpsService[];
  healthyCount: number;
  totalCount: number;
}

export interface IbmUsageMTD {
  quantumSecondsUsed: number;
  quantumSecondsAllocated: number;
  concurrentJobs: number;
  jobsThisMonth: number;
  successRate: number;
  spendUsd: number;
}
export interface IbmBackendAccess {
  backend: string;
  access: "allowed" | "sim" | "locked";
}
export interface IbmRecentJob {
  id: string;
  backend: string;
  status: string;
  durationSeconds: number;
}
export interface IbmWorkloadResponse {
  configured: boolean;
  validated: boolean;
  account: string | null;
  instance: string | null;
  region: string | null;
  plan: string | null;
  usage: IbmUsageMTD | null;
  backendAccess: IbmBackendAccess[];
  recentJobs: IbmRecentJob[];
}

export interface QuantumBackend {
  id: string;
  processor: string;
  queue: number;
  qubits: number;
  t1Us: number;
  t2Us: number;
  readoutFidelity: number;
  twoQGateError: number;
  lastCalibration: string;
}
export interface OpsBackendsResponse {
  backends: QuantumBackend[];
}

export type OpsJobQueueStatus =
  | "queued"
  | "running"
  | "transpiling"
  | "measuring";
export interface OpsJobQueueEntry {
  id: string;
  type: string;
  candidate: string;
  backend: string;
  status: OpsJobQueueStatus;
  progressPct: number;
  etaSeconds: number;
}
export interface OpsJobHistoryEntry {
  id: string;
  candidate: string;
  disease: string;
  topModel: string;
  family: "classical" | "hybrid" | "quantum";
  status: "completed" | "failed";
  durationSeconds: number;
  costUsd: number;
  startedAgoSeconds: number;
}
export interface OpsJobsResponse {
  queue: OpsJobQueueEntry[];
  history: OpsJobHistoryEntry[];
}

export interface OpsResourceCounter {
  label: string;
  used: number;
  cap: number;
  unit: string;
}
export interface OpsResourcesResponse {
  counters: OpsResourceCounter[];
}

export type OpsCostPace = "under" | "on-pace" | "over";
export interface OpsCostBucket {
  service: string;
  spendUsd: number;
  pace: OpsCostPace;
}
export interface OpsCostResponse {
  mtdSpend: number;
  monthlyBudget: number;
  linearPace: number;
  buckets: OpsCostBucket[];
}

export interface OpsDataSourceSnapshot {
  name: string;
  sha256: string;
  lastSync: string;
  slaHours: number;
  fresh: boolean;
}
export interface OpsSourcesResponse {
  sources: OpsDataSourceSnapshot[];
}

export type OpsAlertSeverity = "ok" | "warn" | "crit";
export interface OpsAlertEntry {
  severity: OpsAlertSeverity;
  title: string;
  source: string;
  ageSeconds: number;
  resolved: boolean;
}
export interface OpsAlertsResponse {
  active: OpsAlertEntry[];
  recentResolved: OpsAlertEntry[];
}

export function fetchOpsHealth(): Promise<OpsHealthResponse> {
  return request<OpsHealthResponse>("/ops/health");
}
export function fetchIbmWorkload(): Promise<IbmWorkloadResponse> {
  return request<IbmWorkloadResponse>("/ops/ibm-workload");
}
export function fetchOpsBackends(): Promise<OpsBackendsResponse> {
  return request<OpsBackendsResponse>("/ops/backends");
}
export function fetchOpsJobs(): Promise<OpsJobsResponse> {
  return request<OpsJobsResponse>("/ops/jobs");
}
export function fetchOpsResources(): Promise<OpsResourcesResponse> {
  return request<OpsResourcesResponse>("/ops/resources");
}
export function fetchOpsCost(): Promise<OpsCostResponse> {
  return request<OpsCostResponse>("/ops/cost");
}
export function fetchOpsSources(): Promise<OpsSourcesResponse> {
  return request<OpsSourcesResponse>("/ops/sources");
}
export function fetchOpsAlerts(): Promise<OpsAlertsResponse> {
  return request<OpsAlertsResponse>("/ops/alerts");
}

// --- Decisions API -------------------------------------------------------
//
// Mirrors hetqml_api.schemas.DecisionRecord / DecisionCreateRequest.

export type DecisionVerdict = "keep" | "review" | "reject";

/** Re-uses the JobResult `TrustAxisName` definition above. */
export interface DecisionTrustAxis {
  axis: TrustAxisName;
  value: number;
  passing: boolean;
}

export interface DecisionSelection {
  disease: string;
  compound: string;
  gene: string;
  metaedge: string;
}

export interface DecisionRunPath {
  mode: "quick" | "custom";
  family: "classical" | "hybrid" | "quantum";
}

/** Snapshot row of the integrity-guard panel at decision time. Mirrors
 * `hetqml_api.schemas.IntegrityGuardState` so a future audit can replay
 * which guards were on/off when the reviewer clicked Keep/Review/Reject. */
export interface DecisionIntegrityGuard {
  id: string;
  label: string;
  passing: boolean;
  critical: boolean;
}

export interface DecisionCreateInput {
  pairKey: string;
  verdict: DecisionVerdict;
  reviewer: string;
  sessionId: string;
  selection: DecisionSelection;
  runPath: DecisionRunPath;
  topModel: string;
  modelScore: number;
  trustScore: number;
  trustAxes: DecisionTrustAxis[];
  guardsCompromised: number;
  /** Full per-guard snapshot — not just the compromised count. */
  integrityGuards?: DecisionIntegrityGuard[];
  /** ML run id (jobId) so the decision binds to a specific run, not just a pair. */
  jobId?: string;
  /** CV PR-AUC std across folds, captured server-side at decision time. */
  cvStd?: number;
  /** Provenance / evidence-source paths surfaced on Visualize at decision time. */
  evidenceSources?: string[];
  note?: string | null;
}

export interface DecisionRecord {
  id: string;
  pairKey: string;
  verdict: DecisionVerdict;
  reviewer: string;
  sessionId: string;
  selection: DecisionSelection;
  runPath: DecisionRunPath;
  topModel: string;
  modelScore: number;
  trustScore: number;
  trustAxes: DecisionTrustAxis[];
  guardsCompromised: number;
  integrityGuards?: DecisionIntegrityGuard[] | null;
  jobId?: string | null;
  cvStd?: number | null;
  evidenceSources?: string[];
  timestamp: string;
  note: string | null;
}

export function createDecision(
  input: DecisionCreateInput,
): Promise<DecisionRecord> {
  return request<DecisionRecord>("/decisions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listDecisions(opts?: {
  pairKey?: string;
  limit?: number;
}): Promise<DecisionRecord[]> {
  const params = new URLSearchParams();
  if (opts?.pairKey) params.set("pair_key", opts.pairKey);
  if (typeof opts?.limit === "number") params.set("limit", String(opts.limit));
  const qs = params.toString();
  return request<DecisionRecord[]>(`/decisions${qs ? `?${qs}` : ""}`);
}

// --- Notes API -----------------------------------------------------------
//
// Per-pair freeform skeptic notes. GET on an unknown pair returns 404 — the
// `getNote` helper rethrows that as a typed error so callers can distinguish
// "never had a note" from "empty note string".

export interface SkepticNote {
  pairKey: string;
  body: string;
  updatedAt: string;
}

export interface SkepticNoteUpsertInput {
  pairKey: string;
  body: string;
}

export function getNote(pairKey: string): Promise<SkepticNote> {
  return request<SkepticNote>(`/notes/${encodeURIComponent(pairKey)}`);
}

export function upsertNote(
  pairKey: string,
  body: SkepticNoteUpsertInput,
): Promise<SkepticNote> {
  return request<SkepticNote>(`/notes/${encodeURIComponent(pairKey)}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

// --- Settings API --------------------------------------------------------
//
// Wire-shape mirrors hetqml_api.schemas.UserSettings exactly.

export interface ProfileSettings {
  reviewerName: string;
  role: string;
  organization: string;
  contactEmail: string;
}
export interface AppearanceSettings {
  theme: "light" | "dark" | "auto";
  accent: string;
  density: "comfortable" | "compact";
  reduceMotion: boolean;
}
export interface PipelineSettings {
  defaultRunPath: "classical" | "hybrid" | "quantum";
  defaultMetaedge: string;
  hardNegativeRatio: "1:3" | "1:5" | "1:10";
  strictPosture: boolean;
  autosaveSessions: boolean;
}
export interface QuantumSettings {
  defaultBackend: string;
  shotsPerCircuit: number;
  jobTimeoutSeconds: number;
  zneEnabled: boolean;
  pulseLevelAccess: boolean;
}
export interface IbmConnectionSettings {
  crn: string;
  /** IBM Quantum Platform API token (BYOK). When set together with `crn`,
   * the runner submits real-hardware quantum jobs. Empty → local Aer
   * simulator. */
  apiToken: string;
  validated: boolean;
  planTier: string | null;
  instanceName: string | null;
}
export interface NotificationSettings {
  email: boolean;
  slack: boolean;
  browserPush: boolean;
  severityThreshold: "info" | "warn" | "crit";
  slackWebhookUrl: string;
}
export interface PrivacySettings {
  anonymousUsage: boolean;
  errorReporting: boolean;
  crashDiagnostics: boolean;
  decisionRetentionDays: 30 | 90 | 365 | 0;
}

export interface ApiKeysSettings {
  openai: string | null;
  anthropic: string | null;
  pubchemPremium: string | null;
  drugbankPro: string | null;
  sentryDsn: string | null;
}

export interface UserSettings {
  profile: ProfileSettings;
  appearance: AppearanceSettings;
  pipeline: PipelineSettings;
  quantum: QuantumSettings;
  ibmConnection: IbmConnectionSettings;
  notifications: NotificationSettings;
  privacy: PrivacySettings;
  apiKeys: ApiKeysSettings;
}

export function fetchSettings(): Promise<UserSettings> {
  return request<UserSettings>("/settings");
}

export function saveSettings(body: UserSettings): Promise<UserSettings> {
  return request<UserSettings>("/settings", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

/** Stub validator (v1) — flips ibmConnection.validated when crn + instance
 * are non-empty.  400 with a missing-fields detail when something's empty.
 * Returns the full updated `UserSettings` document so the client can
 * overwrite local state without a follow-up GET. */
export interface IbmSmokeTestResult {
  backend: string;
  runtimeJobId: string;
  shots: number;
  elapsedMs: number;
  simulator: boolean;
  outcomeSummary: string;
  message: string;
}

export function smokeTestIbmConnection(): Promise<IbmSmokeTestResult> {
  // Runtime jobs can queue; align with API smoke timeout (~5 min).
  return request<IbmSmokeTestResult>("/settings/ibm/smoke-test", {
    method: "POST",
    signal: AbortSignal.timeout(360_000),
  });
}

export function validateIbmConnection(): Promise<UserSettings> {
  return request<UserSettings>("/settings/ibm/validate", {
    method: "POST",
  });
}
