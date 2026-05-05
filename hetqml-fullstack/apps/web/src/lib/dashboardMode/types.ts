/**
 * Dashboard mode — switches the dashboard between two narratives:
 *
 *   "demo"     — fictional walkthrough (Inaxaplin → Hypertension-attributed
 *                ESKD, PR-AUC 0.827 for "Quantum Kernel + Metapath"). Default
 *                for HF Spaces public visitors. Shows the workflow shape with
 *                a concrete pair so reviewers can click through end-to-end.
 *
 *   "headline" — the project's actual preregistered study (Hetionet CtD,
 *                stacking ensemble PR-AUC 0.7987 / QSVC alone 0.7216 / the
 *                full 5-baseline H1+H1b decision). References
 *                preregistration/osf_preregistration_v1.md §1.3 + §8.1.
 *
 * Persisted in localStorage under the key in PERSIST_KEY.
 */
export type DashboardMode = "demo" | "headline";

export const DEFAULT_MODE: DashboardMode = "demo";

export const PERSIST_KEY = "hetqml.dashboardMode";

export const MODE_LABELS: Record<DashboardMode, string> = {
  demo: "Demo",
  headline: "Headline",
};

export const MODE_DESCRIPTIONS: Record<DashboardMode, string> = {
  demo: "Inaxaplin → ESKD walkthrough · fictional candidate · 0.827 PR-AUC",
  headline:
    "Hetionet CtD · preregistered H1+H1b · stacking ensemble 0.7987 PR-AUC",
};
