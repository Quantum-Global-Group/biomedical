/**
 * Seed (fallback) Operations data.
 *
 * Used as the initial render and as the offline/API-down fallback. Once the
 * eight `/ops/*` endpoints resolve, the OperationsClient swaps each panel's
 * data to the live response. The numbers below are derived from the static
 * export at hetqml-pages/operations/index.html so the page looks like the
 * design when the API is unreachable.
 */

import type {
  IbmWorkloadResponse,
  OpsAlertsResponse,
  OpsBackendsResponse,
  OpsCostResponse,
  OpsHealthResponse,
  OpsJobsResponse,
  OpsResourcesResponse,
  OpsSourcesResponse,
} from "@/lib/api/client";

const NOW_ISO = new Date(0).toISOString(); // deterministic for SSR

export const SEED_HEALTH: OpsHealthResponse = {
  overall: "degraded",
  healthyCount: 8,
  totalCount: 9,
  services: [
    {
      id: "ibm-torino",
      label: "IBM Quantum · ibm_torino",
      state: "healthy",
      latencyMs: 38,
      uptime30d: 0.997,
      lastProbe: NOW_ISO,
    },
    {
      id: "ibm-brisbane",
      label: "IBM Quantum · ibm_brisbane",
      state: "healthy",
      latencyMs: 41,
      uptime30d: 0.995,
      lastProbe: NOW_ISO,
    },
    {
      id: "classical-compute",
      label: "Classical compute",
      state: "healthy",
      latencyMs: 12,
      uptime30d: 0.999,
      lastProbe: NOW_ISO,
    },
    {
      id: "hetionet-cache",
      label: "Hetionet KG cache",
      state: "healthy",
      latencyMs: 8,
      uptime30d: 0.998,
      lastProbe: NOW_ISO,
    },
    {
      id: "pubchem",
      label: "PubChem REST",
      state: "degraded",
      latencyMs: 184,
      uptime30d: 0.991,
      lastProbe: NOW_ISO,
    },
    {
      id: "clinicaltrials",
      label: "ClinicalTrials.gov",
      state: "healthy",
      latencyMs: 62,
      uptime30d: 0.996,
      lastProbe: NOW_ISO,
    },
    {
      id: "drugbank",
      label: "DrugBank API",
      state: "healthy",
      latencyMs: 71,
      uptime30d: 0.994,
      lastProbe: NOW_ISO,
    },
    {
      id: "mlflow",
      label: "MLflow registry",
      state: "healthy",
      latencyMs: 22,
      uptime30d: 0.998,
      lastProbe: NOW_ISO,
    },
    {
      id: "api-gateway",
      label: "API gateway",
      state: "healthy",
      latencyMs: 19,
      uptime30d: 0.999,
      lastProbe: NOW_ISO,
    },
  ],
};

export const SEED_IBM: IbmWorkloadResponse = {
  configured: false,
  validated: false,
  account: null,
  instance: null,
  region: null,
  plan: null,
  usage: null,
  backendAccess: [],
  recentJobs: [],
};

/** IBM workload fixture for BUILD_TARGET=lite (HF Space) — mirrors validated Settings + full panel layout. */
export const SEED_IBM_LITE: IbmWorkloadResponse = {
  configured: true,
  validated: true,
  account: "demo-account",
  instance: "hetqml_hf_demo",
  region: "us-east",
  plan: "open",
  usage: {
    quantumSecondsUsed: 420,
    quantumSecondsAllocated: 5000,
    concurrentJobs: 2,
    jobsThisMonth: 18,
    successRate: 0.94,
    spendUsd: 42.5,
  },
  backendAccess: [
    { backend: "ibm_torino", access: "allowed" },
    { backend: "ibm_brisbane", access: "allowed" },
    { backend: "ibm_kyoto", access: "sim" },
    { backend: "ibm_marrakesh", access: "locked" },
  ],
  recentJobs: [
    {
      id: "runtime-c7a2-demo",
      backend: "ibm_torino",
      status: "completed",
      durationSeconds: 38,
    },
    {
      id: "runtime-b991-demo",
      backend: "ibm_torino",
      status: "completed",
      durationSeconds: 52,
    },
    {
      id: "runtime-a884-demo",
      backend: "ibm_brisbane",
      status: "failed",
      durationSeconds: 12,
    },
  ],
};

/** All-green health strip for lite export (avoids ambiguous “degraded” on demo). */
export const SEED_HEALTH_LITE: OpsHealthResponse = {
  ...SEED_HEALTH,
  overall: "healthy",
  healthyCount: SEED_HEALTH.totalCount,
  services: SEED_HEALTH.services.map((s) =>
    s.state === "degraded" || s.state === "down"
      ? {
          ...s,
          state: "healthy",
          latencyMs: Math.min(s.latencyMs, 120),
        }
      : s,
  ),
};

export const SEED_BACKENDS: OpsBackendsResponse = {
  backends: [
    {
      id: "ibm_torino",
      processor: "Heron r2",
      queue: 2,
      qubits: 156,
      t1Us: 232,
      t2Us: 158,
      readoutFidelity: 0.972,
      twoQGateError: 0.012,
      lastCalibration: NOW_ISO,
    },
    {
      id: "ibm_brisbane",
      processor: "Eagle r3",
      queue: 8,
      qubits: 127,
      t1Us: 198,
      t2Us: 142,
      readoutFidelity: 0.964,
      twoQGateError: 0.016,
      lastCalibration: NOW_ISO,
    },
    {
      id: "ibm_kyoto",
      processor: "Eagle r3",
      queue: 0,
      qubits: 127,
      t1Us: 207,
      t2Us: 138,
      readoutFidelity: 0.961,
      twoQGateError: 0.018,
      lastCalibration: NOW_ISO,
    },
  ],
};

export const SEED_JOBS: OpsJobsResponse = {
  queue: [
    {
      id: "job_a3f24c",
      type: "QSVC (Pauli) kernel eval",
      candidate: "Decitabine → SCD",
      backend: "ibm_torino",
      status: "running",
      progressPct: 67,
      etaSeconds: 58,
    },
    {
      id: "job_a3f25b",
      type: "VQC training",
      candidate: "Capivasertib → CRPC",
      backend: "ibm_torino",
      status: "transpiling",
      progressPct: 12,
      etaSeconds: 180,
    },
    {
      id: "job_a3f26d",
      type: "Stacking ensemble (CV)",
      candidate: "Empagliflozin → Salt-HTN",
      backend: "cpu_pool",
      status: "running",
      progressPct: 88,
      etaSeconds: 12,
    },
    {
      id: "job_a3f27e",
      type: "QGNN forward pass",
      candidate: "Venetoclax → MM",
      backend: "ibm_brisbane",
      status: "queued",
      progressPct: 0,
      etaSeconds: 360,
    },
    {
      id: "job_a3f28a",
      type: "Calibration sweep",
      candidate: "Inaxaplin → ESKD",
      backend: "cpu_pool",
      status: "queued",
      progressPct: 0,
      etaSeconds: 240,
    },
  ],
  history: [
    {
      id: "job_8a3f21",
      candidate: "Inaxaplin",
      disease: "DOID:10763",
      topModel: "Quantum Kernel + Metapath",
      family: "hybrid",
      status: "completed",
      durationSeconds: 252,
      costUsd: 4.82,
      startedAgoSeconds: 240,
    },
    {
      id: "job_8a3f1f",
      candidate: "Venetoclax",
      disease: "DOID:9538",
      topModel: "QSVC (Pauli)",
      family: "hybrid",
      status: "completed",
      durationSeconds: 228,
      costUsd: 4.35,
      startedAgoSeconds: 1800,
    },
    {
      id: "job_8a3f1c",
      candidate: "Deucravacitinib",
      disease: "DOID:9074",
      topModel: "Stacking ensemble",
      family: "classical",
      status: "completed",
      durationSeconds: 52,
      costUsd: 0.18,
      startedAgoSeconds: 3600,
    },
    {
      id: "job_8a3f1a",
      candidate: "Empagliflozin",
      disease: "DOID:10763",
      topModel: "QSVC (Pauli)",
      family: "hybrid",
      status: "completed",
      durationSeconds: 242,
      costUsd: 4.65,
      startedAgoSeconds: 7200,
    },
    {
      id: "job_8a3f18",
      candidate: "Decitabine",
      disease: "DOID:10923",
      topModel: "QGNN",
      family: "hybrid",
      status: "failed",
      durationSeconds: 74,
      costUsd: 0.92,
      startedAgoSeconds: 10800,
    },
    {
      id: "job_8a3f15",
      candidate: "Capivasertib",
      disease: "DOID:10283",
      topModel: "Quantum Kernel + Metapath",
      family: "hybrid",
      status: "completed",
      durationSeconds: 236,
      costUsd: 4.41,
      startedAgoSeconds: 18000,
    },
    {
      id: "job_8a3f12",
      candidate: "Imatinib",
      disease: "DOID:8552",
      topModel: "Stacking ensemble",
      family: "classical",
      status: "completed",
      durationSeconds: 48,
      costUsd: 0.16,
      startedAgoSeconds: 21600,
    },
    {
      id: "job_8a3f10",
      candidate: "Aspirin",
      disease: "DOID:1287",
      topModel: "Logistic Regression",
      family: "classical",
      status: "completed",
      durationSeconds: 12,
      costUsd: 0.04,
      startedAgoSeconds: 32400,
    },
    {
      id: "job_8a3f0e",
      candidate: "Doxorubicin",
      disease: "DOID:1612",
      topModel: "XGBoost",
      family: "classical",
      status: "completed",
      durationSeconds: 38,
      costUsd: 0.13,
      startedAgoSeconds: 39600,
    },
    {
      id: "job_8a3f0c",
      candidate: "Trastuzumab",
      disease: "DOID:1612",
      topModel: "QAOA",
      family: "quantum",
      status: "completed",
      durationSeconds: 318,
      costUsd: 6.12,
      startedAgoSeconds: 50400,
    },
    {
      id: "job_8a3f0a",
      candidate: "Pembrolizumab",
      disease: "DOID:1909",
      topModel: "VQC",
      family: "hybrid",
      status: "completed",
      durationSeconds: 202,
      costUsd: 3.88,
      startedAgoSeconds: 61200,
    },
  ],
};

export const SEED_RESOURCES: OpsResourcesResponse = {
  counters: [
    { label: "CPU-hours", used: 412, cap: 1000, unit: "h" },
    { label: "Quantum-seconds", used: 1840, cap: 5000, unit: "s" },
    { label: "GPU-hours", used: 38, cap: 200, unit: "h" },
    { label: "Storage", used: 142, cap: 500, unit: "GB" },
    { label: "API calls", used: 8400, cap: 50000, unit: "calls" },
    { label: "Cache hit rate", used: 94, cap: 100, unit: "%" },
  ],
};

export const SEED_COST: OpsCostResponse = {
  mtdSpend: 87.4,
  monthlyBudget: 500,
  linearPace: 75,
  buckets: [
    { service: "IBM Quantum runtime", spendUsd: 38.42, pace: "over" },
    { service: "AWS EC2 (CPU pool)", spendUsd: 22.18, pace: "on-pace" },
    { service: "AWS S3 (artifacts)", spendUsd: 8.45, pace: "under" },
    { service: "GPU (A100 hours)", spendUsd: 12.16, pace: "on-pace" },
    { service: "API quotas", spendUsd: 4.92, pace: "under" },
    { service: "Monitoring", spendUsd: 1.27, pace: "under" },
  ],
};

export const SEED_SOURCES: OpsSourcesResponse = {
  sources: [
    {
      name: "Hetionet v1.0",
      sha256: "f8e2000000000000000000000000000000000000000000000000000000000091",
      lastSync: NOW_ISO,
      slaHours: 168,
      fresh: true,
    },
    {
      name: "PubChem snapshot",
      sha256: "c1d9000000000000000000000000000000000000000000000000000000000e4b",
      lastSync: NOW_ISO,
      slaHours: 24,
      fresh: true,
    },
    {
      name: "ClinicalTrials.gov",
      sha256: "7a2f0000000000000000000000000000000000000000000000000000000000c8",
      lastSync: NOW_ISO,
      slaHours: 24,
      fresh: true,
    },
    {
      name: "DrugBank Open Data",
      sha256: "9b4e00000000000000000000000000000000000000000000000000000000003e",
      lastSync: NOW_ISO,
      slaHours: 168,
      fresh: true,
    },
    {
      name: "DOID ontology",
      sha256: "2f6c0000000000000000000000000000000000000000000000000000000000d0",
      lastSync: NOW_ISO,
      slaHours: 720,
      fresh: true,
    },
    {
      name: "NCBI Gene",
      sha256: "5e8a000000000000000000000000000000000000000000000000000000000b3f",
      lastSync: NOW_ISO,
      slaHours: 168,
      fresh: true,
    },
  ],
};

export const SEED_ALERTS: OpsAlertsResponse = {
  active: [
    {
      severity: "warn",
      title: "PubChem API p95 latency above 150ms for 14m",
      source: "health-probe · pubchem.rest",
      ageSeconds: 14 * 60,
      resolved: false,
    },
    {
      severity: "warn",
      title: "ibm_kyoto out of service for scheduled calibration",
      source: "ibm_runtime · backends",
      ageSeconds: 4 * 60,
      resolved: false,
    },
  ],
  recentResolved: [
    {
      severity: "ok",
      title: "Hetionet KG cache rebuilt successfully (12.4 GB)",
      source: "hetionet/refresh.py",
      ageSeconds: 2 * 3600,
      resolved: true,
    },
    {
      severity: "warn",
      title: "job_8a3f18 failed: QGNN OOM on 12-qubit circuit",
      source: "jobs/8a3f18/error.log",
      ageSeconds: 3 * 3600,
      resolved: true,
    },
    {
      severity: "crit",
      title: "AWS S3 throughput throttled — increased limit to 500 req/s",
      source: "aws/cloudwatch",
      ageSeconds: 86_400,
      resolved: true,
    },
  ],
};
