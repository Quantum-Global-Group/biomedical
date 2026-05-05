/**
 * LiteUnavailablePanel
 *
 * Rendered in place of the Operations and Settings client trees when
 * `BUILD_TARGET=lite`. Those routes call live backend endpoints
 * (ops/health, ops/jobs, decisions, notes, settings) that don't exist
 * in the static export — better to surface a friendly "this lives in
 * the full version" panel than to ship a broken page.
 *
 * Server component; ships zero JS.
 */
import Link from "next/link";

import { LITE_BANNER_BODY } from "@/lib/liteMode";

interface Props {
  /** Which page is showing this — drives the page-hero + step label. */
  page: "operations" | "settings";
}

const PAGE_COPY: Record<
  Props["page"],
  { step: string; title: string; lede: string }
> = {
  operations: {
    step: "SYSTEM · OPERATIONS (LITE)",
    title: "Operations is live-only",
    lede:
      "Operations surfaces platform health, IBM workload, and the active job " +
      "queue — all of those need a live FastAPI + IBM Quantum connection. The " +
      "static export ships no backend, so this page is intentionally locked.",
  },
  settings: {
    step: "SYSTEM · SETTINGS (LITE)",
    title: "Settings is live-only",
    lede:
      "Settings stores reviewer identity, IBM Quantum API key/CRN, and " +
      "preference toggles in localStorage tied to a backend. The static export " +
      "has no backend to validate keys against, so this page is intentionally " +
      "locked.",
  },
};

export function LiteUnavailablePanel({ page }: Props) {
  const copy = PAGE_COPY[page];
  return (
    <>
      <div className="page-hero">
        <div>
          <div className="step">{copy.step}</div>
          <h1 className="h1">{copy.title}</h1>
          <p className="lede">{copy.lede}</p>
        </div>
        <span
          className="pill"
          style={{ background: "var(--paper-alt)", color: "var(--gold)" }}
        >
          ● lite mode
        </span>
      </div>

      <div
        className="panel"
        style={{ borderColor: "var(--gold, #C8A45A)" }}
      >
        <div className="panel-head">
          <div>
            <div className="eyebrow">CONTEXT · LITE BUILD</div>
            <div className="panel-title">What you can still do here</div>
          </div>
          <span className="badge">Demo</span>
        </div>
        <p className="panel-purpose">{LITE_BANNER_BODY}</p>
        <ul
          style={{
            listStyle: "disc",
            margin: "12px 0 0 22px",
            padding: 0,
            color: "var(--muted, #B8AFA5)",
            fontSize: 13,
            lineHeight: 1.7,
          }}
        >
          <li>
            <strong style={{ color: "var(--ink, #E8E0D6)" }}>Initialize</strong>{" "}
            — pick a compound, disease, run path, integrity guards. Mock
            catalogs (8 compounds, 9 diseases) drive the dropdowns.
          </li>
          <li>
            <strong style={{ color: "var(--ink, #E8E0D6)" }}>Experiment</strong>{" "}
            — see the leaderboard, candidate spotlight, detailed metrics, and
            QC controls. Demo numbers in demo mode; the project&rsquo;s
            preregistered five-row panel (Stacking 0.7987 → QSVC 0.7216) in
            headline mode.
          </li>
          <li>
            <strong style={{ color: "var(--ink, #E8E0D6)" }}>Validate</strong>{" "}
            — Trust Scorecard, reliability diagram, skeptic view. Headline
            mode swaps in the preregistration § citations on every applicable
            axis.
          </li>
        </ul>
        <div className="footer-actions" style={{ marginTop: 20 }}>
          <Link className="btn" href="/initialize">
            ← Back to Initialize
          </Link>
          <Link className="btn-primary" href="/experiment">
            Open Experiment →
          </Link>
        </div>
      </div>
    </>
  );
}
