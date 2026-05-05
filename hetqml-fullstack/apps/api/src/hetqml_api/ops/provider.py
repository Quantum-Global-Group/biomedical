"""Operations data provider.

The page contract (Operations dashboard) needs eight panel feeds:
health, ibm-workload, backends, jobs, resources, cost, sources, alerts.

v1 ships a `CannedOpsProvider` that returns deterministic synthetic shapes
keyed off a daily seed. The interface is a Protocol so a real probe — one
that pings IBM Quantum, scrapes the job store, hits cloud-billing APIs —
can be substituted later without touching routers.

`synthetic=True` envelope is intentionally not added; the routers expose
each panel as its own resource. Consumers know v1 is canned because the
api root advertises it (and the static plan documents it).
"""

from __future__ import annotations

import hashlib
import random
from datetime import UTC, datetime, timedelta
from typing import Protocol

from hetqml_api.schemas import (
    AlertEntry,
    CostBucket,
    CostSummary,
    DataSourceSnapshot,
    HealthState,
    IbmBackendAccess,
    IbmRecentJob,
    IbmUsageMTD,
    IbmWorkload,
    JobHistoryEntry,
    JobQueueEntry,
    OpsAlerts,
    OpsBackends,
    OpsHealth,
    OpsJobs,
    OpsResources,
    OpsService,
    OpsSources,
    QuantumBackend,
    ResourceCounter,
)


class OpsProvider(Protocol):
    """Read-only feeds for the Operations page.

    Each method is a single resource. Implementations may cache; routers
    do not. A real provider would replace `_seed` with live polling.
    """

    def health(self) -> OpsHealth: ...
    def ibm_workload(self) -> IbmWorkload: ...
    def backends(self) -> OpsBackends: ...
    def jobs(self) -> OpsJobs: ...
    def resources(self) -> OpsResources: ...
    def cost(self) -> CostSummary: ...
    def sources(self) -> OpsSources: ...
    def alerts(self) -> OpsAlerts: ...


# --- Canned implementation -------------------------------------------------

_SERVICES: list[tuple[str, str]] = [
    ("ibm-torino", "IBM Quantum · ibm_torino"),
    ("ibm-brisbane", "IBM Quantum · ibm_brisbane"),
    ("classical-compute", "Classical compute"),
    ("hetionet-cache", "Hetionet KG cache"),
    ("pubchem", "PubChem REST"),
    ("clinicaltrials", "ClinicalTrials.gov"),
    ("drugbank", "DrugBank API"),
    ("mlflow", "MLflow registry"),
    ("api-gateway", "API gateway"),
]

_BACKEND_PROFILES: list[tuple[str, str, int]] = [
    ("ibm_torino", "Heron r2", 133),
    ("ibm_brisbane", "Eagle r3", 127),
    ("ibm_kyoto", "Eagle r3", 127),
]

_SOURCE_PROFILES: list[tuple[str, int]] = [
    ("Hetionet v1.0", 168),
    ("PubChem", 24),
    ("ClinicalTrials.gov", 24),
    ("DrugBank", 168),
    ("Reactome", 168),
    ("DisGeNET", 168),
]

_COST_BUCKETS: list[str] = [
    "IBM Quantum",
    "AWS EC2",
    "AWS S3",
    "GPU",
    "API quotas",
    "Monitoring",
]

_RESOURCE_PROFILES: list[tuple[str, float, str]] = [
    ("CPU-hours", 480.0, "h"),
    ("Quantum-seconds", 3_600.0, "s"),
    ("GPU-hours", 96.0, "h"),
    ("Storage", 250.0, "GB"),
    ("API calls", 250_000.0, "calls"),
    ("Cache hit rate", 100.0, "%"),
]


def _daily_seed(salt: str = "") -> int:
    today = datetime.now(UTC).strftime("%Y-%m-%d")
    payload = f"{today}|{salt}".encode()
    digest = hashlib.sha256(payload).digest()
    return int.from_bytes(digest[:8], "big", signed=False)


def _state_from(rng: random.Random, healthy_bias: float = 0.85) -> HealthState:
    r = rng.random()
    if r < healthy_bias:
        return "healthy"
    if r < healthy_bias + 0.10:
        return "degraded"
    return "down"


class CannedOpsProvider:
    """Deterministic-per-day synthetic Operations feeds.

    The output is stable for the duration of a UTC day so the dashboard
    doesn't shimmer on every poll, but rolls over once a day so the page
    feels live during demos.
    """

    def __init__(self, *, ibm_crn: str | None = None) -> None:
        self._ibm_crn = ibm_crn

    # health ---------------------------------------------------------------

    def health(self) -> OpsHealth:
        rng = random.Random(_daily_seed("health"))
        now = datetime.now(UTC)
        services: list[OpsService] = []
        for sid, label in _SERVICES:
            state = _state_from(rng, healthy_bias=0.78 if "ibm" in sid else 0.92)
            services.append(
                OpsService(
                    id=sid,
                    label=label,
                    state=state,
                    latency_ms=round(20 + 200 * rng.random(), 1),
                    uptime_30d=round(0.985 + 0.013 * rng.random(), 4),
                    last_probe=now - timedelta(seconds=rng.randint(5, 120)),
                )
            )
        healthy = sum(1 for s in services if s.state == "healthy")
        if healthy == len(services):
            overall: HealthState = "healthy"
        elif any(s.state == "down" for s in services):
            overall = "down"
        else:
            overall = "degraded"
        return OpsHealth(
            overall=overall,
            services=services,
            healthy_count=healthy,
            total_count=len(services),
        )

    # ibm-workload ---------------------------------------------------------

    def ibm_workload(self) -> IbmWorkload:
        if not self._ibm_crn:
            return IbmWorkload(configured=False, validated=False)
        rng = random.Random(_daily_seed(f"ibm|{self._ibm_crn}"))
        usage = IbmUsageMTD(
            quantum_seconds_used=round(120 + 600 * rng.random(), 1),
            quantum_seconds_allocated=900.0,
            concurrent_jobs=rng.randint(0, 3),
            jobs_this_month=rng.randint(20, 180),
            success_rate=round(0.88 + 0.10 * rng.random(), 3),
            spend_usd=round(20 + 80 * rng.random(), 2),
        )
        access = [
            IbmBackendAccess(backend="ibm_torino", access="allowed"),
            IbmBackendAccess(backend="ibm_brisbane", access="allowed"),
            IbmBackendAccess(backend="ibm_kyoto", access="sim"),
            IbmBackendAccess(backend="ibm_sherbrooke", access="locked"),
        ]
        recent = [
            IbmRecentJob(
                id=f"ibmq-{rng.randint(10**6, 10**7-1):07d}",
                backend=rng.choice(["ibm_torino", "ibm_brisbane"]),
                status=rng.choice(["completed", "completed", "completed", "failed"]),
                duration_seconds=round(8 + 120 * rng.random(), 1),
            )
            for _ in range(5)
        ]
        return IbmWorkload(
            configured=True,
            validated=True,
            account="acct-hetqml",
            instance="hetqml/main",
            region="us-east",
            plan="Premium",
            usage=usage,
            backend_access=access,
            recent_jobs=recent,
        )

    # backends -------------------------------------------------------------

    def backends(self) -> OpsBackends:
        rng = random.Random(_daily_seed("backends"))
        now = datetime.now(UTC)
        backends: list[QuantumBackend] = []
        for bid, processor, qubits in _BACKEND_PROFILES:
            backends.append(
                QuantumBackend(
                    id=bid,
                    processor=processor,
                    queue=rng.randint(0, 18),
                    qubits=qubits,
                    t1_us=round(180 + 80 * rng.random(), 1),
                    t2_us=round(120 + 70 * rng.random(), 1),
                    readout_fidelity=round(0.972 + 0.022 * rng.random(), 4),
                    two_q_gate_error=round(0.005 + 0.012 * rng.random(), 4),
                    last_calibration=now - timedelta(hours=rng.randint(1, 18)),
                )
            )
        return OpsBackends(backends=backends)

    # jobs (queue + history) -----------------------------------------------

    def jobs(self) -> OpsJobs:
        rng = random.Random(_daily_seed("jobs"))
        queue: list[JobQueueEntry] = []
        for i in range(5):
            status = rng.choice(["queued", "running", "transpiling", "measuring"])
            progress = (
                rng.randint(0, 5)
                if status == "queued"
                else rng.randint(15, 95)
            )
            queue.append(
                JobQueueEntry(
                    id=f"job-{rng.randint(10**6, 10**7-1):07d}",
                    type=rng.choice(["QSVC", "VQC", "Stacking", "RotatE"]),
                    candidate=f"DB{rng.randint(1, 99999):05d} → DOID:{rng.randint(1000, 99999):05d}",
                    backend=rng.choice(["ibm_torino", "ibm_brisbane", "cpu-pool"]),
                    status=status,
                    progress_pct=progress,
                    eta_seconds=rng.randint(15, 900),
                )
            )

        history: list[JobHistoryEntry] = []
        for i in range(11):
            family = rng.choice(["classical", "hybrid", "quantum"])
            status = rng.choice(["completed", "completed", "completed", "completed", "failed"])
            history.append(
                JobHistoryEntry(
                    id=f"job-{rng.randint(10**6, 10**7-1):07d}",
                    candidate=f"DB{rng.randint(1, 99999):05d}",
                    disease=f"DOID:{rng.randint(1000, 99999):05d}",
                    top_model=rng.choice(
                        ["Stacking", "QSVC (Pauli)", "VQC", "RotatE", "DWPC"]
                    ),
                    family=family,
                    status=status,
                    duration_seconds=round(20 + 600 * rng.random(), 1),
                    cost_usd=round(0.1 + 4.0 * rng.random(), 2),
                    started_ago_seconds=rng.randint(120, 86_400),
                )
            )
        return OpsJobs(queue=queue, history=history)

    # resources ------------------------------------------------------------

    def resources(self) -> OpsResources:
        rng = random.Random(_daily_seed("resources"))
        counters: list[ResourceCounter] = []
        for label, cap, unit in _RESOURCE_PROFILES:
            if label == "Cache hit rate":
                used = round(82 + 14 * rng.random(), 1)
            else:
                used = round(cap * (0.30 + 0.55 * rng.random()), 1)
            counters.append(ResourceCounter(label=label, used=used, cap=cap, unit=unit))
        return OpsResources(counters=counters)

    # cost ------------------------------------------------------------------

    def cost(self) -> CostSummary:
        rng = random.Random(_daily_seed("cost"))
        budget = 1_500.0
        # day-of-month / 30 as a coarse linear pace
        day = datetime.now(UTC).day
        pace_target = round(budget * day / 30, 2)
        buckets: list[CostBucket] = []
        spent = 0.0
        for service in _COST_BUCKETS:
            v = round(budget * (0.04 + 0.18 * rng.random()) / len(_COST_BUCKETS) * 6, 2)
            spent += v
            ratio = v / max(0.01, pace_target / len(_COST_BUCKETS))
            if ratio > 1.20:
                pace = "over"
            elif ratio < 0.80:
                pace = "under"
            else:
                pace = "on-pace"
            buckets.append(CostBucket(service=service, spend_usd=v, pace=pace))  # type: ignore[arg-type]
        return CostSummary(
            mtd_spend=round(spent, 2),
            monthly_budget=budget,
            linear_pace=pace_target,
            buckets=buckets,
        )

    # sources ---------------------------------------------------------------

    def sources(self) -> OpsSources:
        rng = random.Random(_daily_seed("sources"))
        now = datetime.now(UTC)
        out: list[DataSourceSnapshot] = []
        for name, sla_hours in _SOURCE_PROFILES:
            age_hours = rng.randint(1, sla_hours * 2)
            sha = hashlib.sha256(f"{name}|{now.date()}".encode()).hexdigest()
            out.append(
                DataSourceSnapshot(
                    name=name,
                    sha256=sha,
                    last_sync=now - timedelta(hours=age_hours),
                    sla_hours=sla_hours,
                    fresh=age_hours <= sla_hours,
                )
            )
        return OpsSources(sources=out)

    # alerts ---------------------------------------------------------------

    def alerts(self) -> OpsAlerts:
        rng = random.Random(_daily_seed("alerts"))
        active: list[AlertEntry] = []
        # 0-3 active alerts
        for i in range(rng.randint(0, 3)):
            sev = rng.choice(["warn", "warn", "crit"])
            active.append(
                AlertEntry(
                    severity=sev,  # type: ignore[arg-type]
                    title=rng.choice(
                        [
                            "ibm_torino queue depth above threshold",
                            "Cache hit rate dropped below 85%",
                            "DrugBank sync stale (>3d)",
                            "Quantum-seconds usage > 80% of monthly cap",
                        ]
                    ),
                    source=rng.choice(
                        ["ops/probe.py", "alerts/cache.py", "ops/billing.py", "ops/ibm.py"]
                    ),
                    age_seconds=rng.randint(120, 18_000),
                    resolved=False,
                )
            )
        recent: list[AlertEntry] = []
        for _ in range(rng.randint(2, 5)):
            recent.append(
                AlertEntry(
                    severity=rng.choice(["ok", "warn"]),  # type: ignore[arg-type]
                    title=rng.choice(
                        [
                            "ClinicalTrials.gov sync recovered",
                            "Backend ibm_brisbane returned to allowed",
                            "Storage warning resolved",
                        ]
                    ),
                    source="ops/probe.py",
                    age_seconds=rng.randint(3_600, 7 * 24 * 3600),
                    resolved=True,
                )
            )
        return OpsAlerts(active=active, recent_resolved=recent)
