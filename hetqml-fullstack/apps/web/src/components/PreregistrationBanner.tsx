/**
 * PreregistrationBanner
 *
 * Compact header banner shown above the page-hero on Initialize, Experiment,
 * and Validate. Cites the four preregistration hypotheses from
 * `hybrid-qml-kg-poc/preregistration/osf_preregistration_v1.md` §1.3 +
 * the §8.1 paired-bootstrap decision rule.
 *
 * Server component — no interactivity, ships zero JS.
 *
 * The banner is intentionally terse so it doesn't compete with the page
 * hero. Each hypothesis has a link target the rendering pages reference
 * for fuller text.
 */

interface PreregistrationBannerProps {
  /**
   * Which page is rendering this. Used to choose a slightly different
   * emphasis — e.g. Validate hides H3 (scaling) since it's irrelevant at
   * decision time.
   */
  page: "initialize" | "experiment" | "validate";
}

const HYPOTHESES = [
  {
    id: "H1",
    label: "QSVC alone vs each classical baseline",
    rule: "paired-bootstrap CI excludes zero in favorable direction (conjunction across all baselines)",
    relevant: { initialize: true, experiment: true, validate: true },
  },
  {
    id: "H1b",
    label: "Stacking ensemble vs each classical baseline (headline)",
    rule: "same decision rule as H1, applied to ensemble vs each model",
    relevant: { initialize: true, experiment: true, validate: true },
  },
  {
    id: "H2",
    label: "Hardware-evaluated QSVC + Pauli Path ZNE within ±5pp of simulator",
    rule: "95% bootstrap CI within ±5 percentage points",
    relevant: { initialize: true, experiment: true, validate: false },
  },
  {
    id: "H3",
    label: "Sub-quadratic scaling on IBM Torino at 10/15/20 qubit dims",
    rule: "log-log slope 95% CI upper bound < 2.0",
    relevant: { initialize: true, experiment: false, validate: false },
  },
] as const;

export function PreregistrationBanner({ page }: PreregistrationBannerProps) {
  const visible = HYPOTHESES.filter((h) => h.relevant[page]);
  return (
    <aside
      className="prereg-banner panel"
      style={{
        marginBottom: 16,
        padding: "12px 16px",
        background: "var(--paper-alt, #161310)",
        border: "1px solid var(--border-soft, #332D27)",
        borderRadius: 4,
      }}
      aria-label="Preregistration framing"
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          marginBottom: 6,
        }}
      >
        <span
          className="eyebrow"
          style={{ color: "var(--teal, #6BB5B5)", fontSize: 10, letterSpacing: "0.08em" }}
        >
          PREREGISTRATION · §1.3 · §8.1
        </span>
        <span style={{ fontSize: 11, color: "var(--faint, #857D75)" }}>
          decision rule below applies regardless of dashboard mode
        </span>
      </div>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          columnGap: 12,
          rowGap: 4,
          fontSize: 12,
          lineHeight: 1.45,
          color: "var(--muted, #B8AFA5)",
        }}
      >
        {visible.map((h) => (
          <PreregHypothesisRow key={h.id} hypothesis={h} />
        ))}
      </ul>
      <div
        style={{
          marginTop: 8,
          fontSize: 11,
          color: "var(--faint, #857D75)",
        }}
      >
        Decision rule: paired bootstrap, 10,000 resamples, seed{" "}
        <code style={{ color: "var(--ink, #E8E0D6)" }}>20260504</code>, 95% CI.
        See <code>preregistration/osf_preregistration_v1.md</code>.
      </div>
    </aside>
  );
}

function PreregHypothesisRow({
  hypothesis,
}: {
  hypothesis: (typeof HYPOTHESES)[number];
}) {
  return (
    <>
      <span
        style={{
          color: "var(--gold, #C8A45A)",
          fontFamily: "var(--font-mono, monospace)",
          fontWeight: 600,
        }}
      >
        {hypothesis.id}
      </span>
      <span>
        <strong style={{ color: "var(--ink, #E8E0D6)" }}>{hypothesis.label}.</strong>{" "}
        <span style={{ color: "var(--faint, #857D75)" }}>{hypothesis.rule}.</span>
      </span>
    </>
  );
}
