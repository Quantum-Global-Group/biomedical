"""Stubbed async job runner.

Establishes the queued → running → completed lifecycle the real ML pipeline
will use. For v1 the ML-derived fields in `JobResult` are filled with
deterministic seeded values so the UI exercises every panel. The real
pipeline (step 11 of Phase 2) swaps `_simulate_result` for a real
implementation while keeping the wire shape identical.
"""

from __future__ import annotations

import asyncio
import hashlib
import random
from datetime import UTC, datetime

from hetqml_api.catalog import algorithms_catalog, integrity_guards_catalog
from hetqml_api.jobs.store import JobStore
from hetqml_api.schemas import (
    BenchmarkRow,
    CalibrationBin,
    CandidateRankingRow,
    CandidateSpotlight,
    CVFold,
    DetailedMetrics,
    EvidenceMatrix,
    EvidenceMatrixCell,
    EvidenceOverlay,
    EvidencePath,
    EvidencePathStep,
    IntegrityGuardState,
    InterpretationPanel,
    Job,
    JobMetrics,
    JobResult,
    LeaderboardRow,
    MetricCI,
    ModelAgreement,
    ModelAgreementBar,
    ProvenanceEvent,
    QualityFlag,
    QuantumCircuitInfo,
    ReliabilityDiagram,
    SkepticWarning,
    StatComparisonRow,
    TrustAxis,
    TrustScorecard,
)


def _seed_for(job: Job) -> int:
    """Stable per-selection seed; differs by run-path family on purpose."""
    seed_input = "|".join(
        [
            job.selection.disease,
            job.selection.compound,
            job.selection.gene,
            job.selection.metaedge,
            job.run_path.family,
        ]
    )
    digest = hashlib.sha256(seed_input.encode("utf-8")).digest()
    return int.from_bytes(digest[:8], "big", signed=False)


def _metrics_from(rng: random.Random) -> JobMetrics:
    return JobMetrics(
        pr_auc=round(0.55 + 0.40 * rng.random(), 4),
        roc_auc=round(0.60 + 0.35 * rng.random(), 4),
        brier=round(0.05 + 0.10 * rng.random(), 4),
        ece=round(0.01 + 0.06 * rng.random(), 4),
    )


def _detailed(rng: random.Random, base: JobMetrics) -> DetailedMetrics:
    def ci(name: str, value: float, span: float) -> MetricCI:
        return MetricCI(
            name=name,
            value=round(value, 4),
            ci_low=round(max(0.0, value - span), 4),
            ci_high=round(min(1.0, value + span), 4),
        )

    folds = [
        CVFold(
            fold=i + 1,
            pr_auc=round(base.pr_auc + (rng.random() - 0.5) * 0.08, 4),
            roc_auc=round(base.roc_auc + (rng.random() - 0.5) * 0.06, 4),
        )
        for i in range(5)
    ]
    return DetailedMetrics(
        metric_cis=[
            ci("PR-AUC", base.pr_auc, 0.04),
            ci("ROC-AUC", base.roc_auc, 0.03),
            ci("F1", 0.62 + 0.25 * rng.random(), 0.04),
            ci("Brier", base.brier, 0.02),
            ci("MCC", 0.55 + 0.20 * rng.random(), 0.05),
        ],
        cv_folds=folds,
        cv_strategy="5-fold stratified · ancestry-aware",
    )


def _leaderboard(rng: random.Random, family: str) -> list[LeaderboardRow]:
    cat = algorithms_catalog()
    rows: list[LeaderboardRow] = []
    # Seeded permutation so output is stable per selection.
    pool = list(cat.items)
    rng.shuffle(pool)
    take = pool[:13]
    classical_best_pr = max(
        (0.55 + 0.30 * rng.random()) for _ in [0]
    )  # establishes baseline below
    classical_best_pr = round(0.66 + 0.10 * rng.random(), 4)
    for algo in take:
        pr = round(0.55 + 0.40 * rng.random(), 4)
        rows.append(
            LeaderboardRow(
                model=algo.name,
                family=algo.family,
                pr_auc=pr,
                roc_auc=round(0.60 + 0.35 * rng.random(), 4),
                delta_classical=round(pr - classical_best_pr, 4),
                is_top=False,
            )
        )
    rows.sort(key=lambda r: r.pr_auc, reverse=True)
    # Top model is path-aware: best within active family if any.
    same_family = [r for r in rows if r.family == family]
    top = same_family[0] if same_family else rows[0]
    top.is_top = True
    return rows


def _benchmarks(rng: random.Random, leaderboard: list[LeaderboardRow]) -> list[BenchmarkRow]:
    out: list[BenchmarkRow] = []
    for row in leaderboard:
        family_label = row.family.capitalize()
        out.append(
            BenchmarkRow(
                model=row.model,
                family=family_label,  # type: ignore[arg-type]
                status="LIVE" if rng.random() < 0.8 else "DEV",
                cells={
                    # classification
                    "prAuc": f"{row.pr_auc:.3f}",
                    "rocAuc": f"{row.roc_auc:.3f}",
                    "f1": f"{0.55 + 0.30 * rng.random():.3f}",
                    "mcc": f"{0.50 + 0.30 * rng.random():.3f}",
                    # ranking
                    "map": f"{0.50 + 0.25 * rng.random():.3f}",
                    "ndcg10": f"{0.60 + 0.30 * rng.random():.3f}",
                    "hit10": f"{0.65 + 0.30 * rng.random():.3f}",
                    "deltaClassical": f"{row.delta_classical:+.3f}",
                    # calibration
                    "brier": f"{0.05 + 0.10 * rng.random():.3f}",
                    "ece": f"{0.02 + 0.06 * rng.random():.3f}",
                    "mce": f"{0.04 + 0.10 * rng.random():.3f}",
                    "slope": f"{0.85 + 0.15 * rng.random():.2f}",
                    # efficiency
                    "runtime": f"{rng.randint(0, 9)}m {rng.randint(0, 59):02d}s",
                    "params": f"{rng.randint(8, 999)}",
                    "cost": f"${rng.uniform(0.10, 5.00):.2f}",
                    "cpuHours": f"{rng.uniform(0.05, 1.50):.2f}",
                    # quantum-hw
                    "backend": "ibm_torino" if row.family != "classical" else "—",
                    "shots": f"{rng.randint(4096, 32768):,}" if row.family != "classical" else "—",
                    "depth": f"{rng.randint(20, 80)}" if row.family != "classical" else "—",
                    "readout": (
                        f"{0.95 + 0.04 * rng.random():.3f}" if row.family != "classical" else "—"
                    ),
                    # cv-strategy
                    "folds": "5 stratified",
                    "std": f"{0.005 + 0.020 * rng.random():.3f}",
                    "split": "ancestry-aware",
                    "leakage": "none",
                },
            )
        )
    return out


def _stat_comparison(rng: random.Random, top_pr: float) -> list[StatComparisonRow]:
    def row(label: str, ref: float, sig_floor: float) -> StatComparisonRow:
        delta = round(top_pr - ref, 4)
        p = max(0.0001, min(0.5, sig_floor + (rng.random() - 0.5) * 0.05))
        if p < 0.005:
            sig = "highly-significant"
        elif p < 0.05:
            sig = "significant"
        elif p < 0.1:
            sig = "marginal"
        else:
            sig = "ns"
        return StatComparisonRow(
            label=label,
            delta=delta,
            p_value=round(p, 4),
            effect_size=round(abs(delta) * 4.5, 3),
            significance=sig,  # type: ignore[arg-type]
        )

    return [
        row("vs best classical", 0.72, 0.03),
        row("vs best hybrid", 0.79, 0.06),
        row("vs best quantum", 0.74, 0.05),
        row("vs DWPC", 0.65, 0.005),
        row("vs random predictor", 0.50, 0.0005),
    ]


def _candidate_spotlight(rng: random.Random, base: JobMetrics, job: Job) -> CandidateSpotlight:
    reasons = [
        f"Anchor gene {job.selection.gene} matches curated targets",
        f"{job.run_path.family.title()} pipeline emphasizes metapath {job.selection.metaedge}",
        "Subgroup ancestry caveat surfaced — review before deployment",
    ]
    ranking = [
        CandidateRankingRow(
            rank=i + 1,
            compound=f"Synth-{rng.randint(1000, 99999):05d}",
            disease=job.selection.disease,
            score=round(base.pr_auc - 0.02 * i + (rng.random() - 0.5) * 0.01, 4),
            delta_classical=round((rng.random() - 0.4) * 0.08, 4),
        )
        for i in range(6)
    ]
    return CandidateSpotlight(
        score=round(base.pr_auc + (rng.random() - 0.5) * 0.02, 4),
        reasons=reasons,
        ranking=ranking,
    )


def _integrity_guards(rng: random.Random) -> list[IntegrityGuardState]:
    cat = integrity_guards_catalog()
    out: list[IntegrityGuardState] = []
    for guard in cat.items:
        passing = guard.default_on and rng.random() > (0.10 if guard.critical else 0.20)
        out.append(
            IntegrityGuardState(
                id=guard.id,
                label=guard.label,
                passing=passing,
                critical=guard.critical,
            )
        )
    return out


def _trust(rng: random.Random, base: JobMetrics, guards: list[IntegrityGuardState]) -> TrustScorecard:
    artifact_pass_rate = sum(1 for g in guards if g.passing) / max(1, len(guards))
    axes = [
        TrustAxis(axis="clinical", value=round(0.55 + 0.40 * rng.random(), 3), passing=True),
        TrustAxis(axis="mechanism", value=round(0.55 + 0.40 * rng.random(), 3), passing=True),
        TrustAxis(axis="model", value=round(min(0.99, base.pr_auc + 0.05), 3), passing=base.pr_auc > 0.65),
        TrustAxis(
            axis="baseline",
            value=round(0.50 + 0.45 * rng.random(), 3),
            passing=rng.random() > 0.2,
        ),
        TrustAxis(
            axis="artifact",
            value=round(artifact_pass_rate, 3),
            passing=artifact_pass_rate > 0.85,
        ),
    ]
    composite = round(sum(a.value for a in axes) / len(axes), 3)
    return TrustScorecard(composite=composite, axes=axes)


def _reliability(rng: random.Random, base: JobMetrics) -> ReliabilityDiagram:
    bins = []
    for i in range(10):
        lo = i / 10
        hi = (i + 1) / 10
        predicted = (lo + hi) / 2
        observed = max(0.0, min(1.0, predicted + (rng.random() - 0.5) * 0.06))
        bins.append(
            CalibrationBin(
                bin_low=lo,
                bin_high=hi,
                predicted=round(predicted, 3),
                observed=round(observed, 3),
                count=rng.randint(40, 220),
            )
        )
    return ReliabilityDiagram(
        bins=bins,
        brier=base.brier,
        ece=base.ece,
        mce=round(base.ece * 1.6 + 0.01 * rng.random(), 4),
        log_loss=round(0.40 + 0.20 * rng.random(), 4),
    )


def _skeptic(
    rng: random.Random,
    base: JobMetrics,
    guards: list[IntegrityGuardState],
    leaderboard: list[LeaderboardRow],
    family: str,
) -> list[SkepticWarning]:
    warnings: list[SkepticWarning] = []
    crit_off = [g for g in guards if g.critical and not g.passing]
    if crit_off:
        warnings.append(
            SkepticWarning(
                source="guards",
                severity="crit",
                message=f"Audit BLOCKED · {len(crit_off)} critical guard(s) failing",
            )
        )
    if base.ece > 0.05:
        warnings.append(
            SkepticWarning(
                source="calibration",
                severity="warn",
                message=f"ECE={base.ece:.3f} above 0.05 threshold — calibrate before clinical use",
            )
        )
    top = next((r for r in leaderboard if r.is_top), None)
    if top and top.delta_classical < 0.01:
        warnings.append(
            SkepticWarning(
                source="delta-classical",
                severity="warn",
                message=f"Top model only {top.delta_classical:+.3f} vs best classical",
            )
        )
    if family != "classical" and top and top.family == "classical":
        warnings.append(
            SkepticWarning(
                source="top-loses-to-classical",
                severity="warn",
                message="Top scoring model is classical — quantum branch did not win",
            )
        )
    if rng.random() < 0.3:
        warnings.append(
            SkepticWarning(
                source="cv-variance",
                severity="info",
                message="CV variance near 0.025 — multi-seed stability borderline",
            )
        )
    return warnings


def _evidence_matrix(rng: random.Random) -> EvidenceMatrix:
    layers = ["molecule", "kg", "mechanism", "clinical", "classical", "quantum"]
    cells = []
    for layer in layers:
        state = rng.choice(["live", "live", "live", "fallback", "supports", "weakens"])
        cells.append(
            EvidenceMatrixCell(
                layer=layer,  # type: ignore[arg-type]
                state=state,  # type: ignore[arg-type]
                note=f"{layer} evidence — {state}",
            )
        )
    supporting = sum(1 for c in cells if c.state in ("live", "supports"))
    return EvidenceMatrix(
        cells=cells,
        summary=f"{supporting}/{len(cells)} layers supportive",
    )


def _model_agreement(rng: random.Random) -> ModelAgreement:
    classical_score = round(0.65 + 0.20 * rng.random(), 3)
    hybrid_score = round(0.65 + 0.20 * rng.random(), 3)
    quantum_score = round(0.65 + 0.20 * rng.random(), 3)
    bars = [
        ModelAgreementBar(family="classical", score=classical_score, delta_reference=0.0),
        ModelAgreementBar(
            family="hybrid", score=hybrid_score, delta_reference=round(hybrid_score - classical_score, 3)
        ),
        ModelAgreementBar(
            family="quantum",
            score=quantum_score,
            delta_reference=round(quantum_score - classical_score, 3),
        ),
    ]
    spread = round(max(b.score for b in bars) - min(b.score for b in bars), 3)
    mean = round(sum(b.score for b in bars) / len(bars), 3)
    if spread < 0.04:
        verdict = "STRONG_AGREEMENT"
    elif spread < 0.10:
        verdict = "PARTIAL_DIVERGENCE"
    else:
        verdict = "BRANCH_DIVERGENCE"
    return ModelAgreement(bars=bars, spread=spread, mean=mean, verdict=verdict)  # type: ignore[arg-type]


def _provenance(rng: random.Random, job: Job) -> list[ProvenanceEvent]:
    base = job.created_at
    events = [
        ("Hetionet snapshot loaded", "hetionet/v1.0/edges.tsv", False),
        (f"Selection: {job.selection.compound} → {job.selection.disease}", "ui/initialize", False),
        ("Hard-negative sampler primed", "pipeline/sampler.py", False),
        (
            f"{job.run_path.family.title()} pipeline launched",
            f"pipeline/{job.run_path.family}.py",
            False,
        ),
        ("Cross-validation folds materialized", "pipeline/cv.py", False),
        ("Calibration computed", "pipeline/calibration.py", False),
        ("Trust scorecard updated", "validate/trust.py", False),
        ("Provenance hash committed", f"runs/{job.id}/provenance.json", False),
    ]
    out = []
    for i, (label, source, fallback) in enumerate(events):
        ts = base.replace(second=(base.second + i * 7) % 60)
        out.append(
            ProvenanceEvent(
                timestamp=ts.strftime("%H:%M:%S UTC"),
                label=label,
                source=source,
                fallback=fallback or rng.random() < 0.1,
            )
        )
    return out


def _quality_flags(rng: random.Random, base: JobMetrics) -> list[QualityFlag]:
    def flag(label: str, score: float, warn: float, fail: float, detail: str) -> QualityFlag:
        if score < fail:
            state = "fail"
        elif score < warn:
            state = "warn"
        else:
            state = "pass"
        return QualityFlag(label=label, state=state, detail=detail)  # type: ignore[arg-type]

    return [
        flag("PR-AUC 95% CI", base.pr_auc, 0.65, 0.55, "Bootstrap N=1000"),
        flag("ECE", 1 - base.ece, 0.93, 0.88, f"ECE={base.ece:.3f}"),
        flag("Multi-seed stability", 0.75 + 0.20 * rng.random(), 0.85, 0.75, "3 seeds"),
        flag("Kernel spread", 0.70 + 0.25 * rng.random(), 0.80, 0.65, "σ within range"),
        flag("Baseline parity (DWPC)", 0.70 + 0.25 * rng.random(), 0.80, 0.65, "Δ vs DWPC"),
        flag("Quantum advantage", 0.65 + 0.30 * rng.random(), 0.80, 0.65, "Δ vs best classical"),
    ]


def _evidence_overlays(job: Job) -> list[EvidenceOverlay]:
    return [
        EvidenceOverlay(
            column="target_pathway",
            items=[
                f"Anchor: {job.selection.gene}",
                "Pathway: WikiPathways WP4148",
                "Reactome R-HSA-1234",
            ],
        ),
        EvidenceOverlay(
            column="relation",
            items=[
                f"3-hop {job.selection.compound} → {job.selection.gene} → {job.selection.disease}",
                "RotatE plausibility 0.71",
                "DWPC weight 0.43",
            ],
        ),
        EvidenceOverlay(
            column="model_score",
            items=[
                f"Top model: {job.run_path.family.title()} ensemble",
                "Kernel separation 1.42",
                "Param ratio 0.87",
            ],
        ),
    ]


def _interpretation(rng: random.Random, family: str) -> InterpretationPanel:
    plausible = [
        "Anchor gene matches curated mechanism",
        f"{family.title()} pipeline aligns with clinical context",
        "Hard-negative variance acceptable",
        "Subgroup data reasonably balanced",
    ]
    weak = [
        "Equity caveat present — review subgroup",
        "Calibration borderline (ECE>0.05)" if rng.random() < 0.5 else "CV variance near threshold",
        "Δ vs classical is small",
        "Quantum-branch fidelity below 0.985" if family != "classical" else "No quantum evidence",
    ]
    return InterpretationPanel(plausible=plausible, weak=weak)


def _quantum_circuit(rng: random.Random, family: str, top_model: str) -> QuantumCircuitInfo:
    if family == "classical":
        return QuantumCircuitInfo(
            title="No quantum job · classical run path",
            note="Switch run path to hybrid or quantum for circuit metadata",
        )
    return QuantumCircuitInfo(
        backend="ibm_torino",
        qubits=rng.choice([12, 16, 20, 24]),
        shots=rng.choice([4096, 8192, 16384, 32768]),
        depth=rng.randint(20, 80),
        fidelity=round(0.97 + 0.02 * rng.random(), 4),
        zne_enabled=True,
        title=f"{top_model} circuit",
    )


def _evidence_path(rng: random.Random, job: Job) -> EvidencePath:
    weight_a = round(0.6 + 0.3 * rng.random(), 3)
    weight_b = round(0.5 + 0.4 * rng.random(), 3)
    weight_c = round(0.55 + 0.35 * rng.random(), 3)
    steps = [
        EvidencePathStep(
            **{
                "from": job.selection.compound,
                "to": job.selection.gene,
                "metaedge": "CbG",
                "weight": weight_a,
                "sources": ["DrugBank", "ChEMBL"],
            }
        ),
        EvidencePathStep(
            **{
                "from": job.selection.gene,
                "to": "Pathway/WP4148",
                "metaedge": "GpPW",
                "weight": weight_b,
                "sources": ["Reactome", "WikiPathways"],
            }
        ),
        EvidencePathStep(
            **{
                "from": "Pathway/WP4148",
                "to": job.selection.disease,
                "metaedge": "DaG",
                "weight": weight_c,
                "sources": ["DisGeNET", "DOID"],
            }
        ),
    ]
    plausibility = round(weight_a * weight_b * weight_c, 4)
    return EvidencePath(steps=steps, plausibility=plausibility)


def simulate_run(job: Job) -> JobResult:
    """Deterministic full `JobResult` payload.

    Two selections that differ only in run-path family produce different
    output so the UI shows the family choice mattering. The shape is
    wire-stable: the real ML pipeline (Phase 2 step 11) will populate the
    same fields with non-stub values.
    """
    rng = random.Random(_seed_for(job))
    metrics = _metrics_from(rng)
    detailed = _detailed(rng, metrics)
    leaderboard = _leaderboard(rng, job.run_path.family)
    benchmarks = _benchmarks(rng, leaderboard)
    top = next((r for r in leaderboard if r.is_top), leaderboard[0])
    stat_cmp = _stat_comparison(rng, top.pr_auc)
    spotlight = _candidate_spotlight(rng, metrics, job)
    guards = _integrity_guards(rng)
    trust = _trust(rng, metrics, guards)
    reliability = _reliability(rng, metrics)
    skeptic = _skeptic(rng, metrics, guards, leaderboard, job.run_path.family)
    matrix = _evidence_matrix(rng)
    agreement = _model_agreement(rng)
    provenance = _provenance(rng, job)
    quality = _quality_flags(rng, metrics)
    overlays = _evidence_overlays(job)
    interpretation = _interpretation(rng, job.run_path.family)
    circuit = _quantum_circuit(rng, job.run_path.family, top.model)
    path = _evidence_path(rng, job)

    return JobResult(
        metrics=metrics,
        detailed_metrics=detailed,
        leaderboard=leaderboard,
        benchmark_rows=benchmarks,
        stat_comparison=stat_cmp,
        candidate_spotlight=spotlight,
        integrity_guards=guards,
        trust_scorecard=trust,
        reliability=reliability,
        skeptic_warnings=skeptic,
        evidence_matrix=matrix,
        model_agreement=agreement,
        provenance=provenance,
        quality_flags=quality,
        evidence_overlays=overlays,
        interpretation=interpretation,
        quantum_circuit=circuit,
        evidence_path=path,
    )


class Runner:
    """Schedules background simulation of jobs against a JobStore."""

    def __init__(self, store: JobStore, *, runtime_seconds: float = 2.0) -> None:
        self._store = store
        self._runtime_seconds = runtime_seconds

    def schedule(self, job: Job) -> asyncio.Task[None]:
        return asyncio.create_task(self._run(job.id))

    async def _run(self, job_id: str) -> None:
        job = await self._store.get(job_id)
        if job is None:
            return
        running = job.model_copy(update={"status": "running"})
        await self._store.update(running)

        try:
            await asyncio.sleep(self._runtime_seconds)
            result = simulate_run(running)
            completed = running.model_copy(
                update={
                    "status": "completed",
                    "metrics": result.metrics,
                    "result": result,
                    "completed_at": datetime.now(UTC),
                }
            )
            await self._store.update(completed)
        except Exception as exc:  # pragma: no cover - defensive
            failed = running.model_copy(
                update={
                    "status": "failed",
                    "error": str(exc),
                    "completed_at": datetime.now(UTC),
                }
            )
            await self._store.update(failed)
