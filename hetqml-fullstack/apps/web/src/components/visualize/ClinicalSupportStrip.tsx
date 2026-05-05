import type { Job, JobResult } from "@/lib/api/client";

interface Props {
  job: Job;
  result: JobResult;
}

/**
 * Top-of-page summary strip: 4 cards collapsing the visual layers into a
 * one-line read. Mirrors the static export's header band.
 */
export function ClinicalSupportStrip({ job, result }: Props) {
  // Live-data ratio across the evidence matrix
  const liveCells = result.evidenceMatrix.cells.filter(
    (c) => c.state === "live" || c.state === "supports",
  ).length;
  const totalCells = result.evidenceMatrix.cells.length;
  const livePct = totalCells > 0 ? Math.round((liveCells / totalCells) * 100) : 0;

  // Path support
  const pathOk = result.evidencePath.plausibility >= result.evidencePath.threshold;

  // Agreement verdict
  const verdict = result.modelAgreement.verdict;
  const agreementGood = verdict === "STRONG_AGREEMENT";
  const agreementWarn = verdict === "PARTIAL_DIVERGENCE";

  // Quality
  const failed = result.qualityFlags.filter((q) => q.state === "fail").length;
  const warned = result.qualityFlags.filter((q) => q.state === "warn").length;
  const qOk = failed === 0 && warned === 0;

  const cards: CardSpec[] = [
    {
      title: "Live evidence",
      value: `${livePct}%`,
      hint: `${liveCells}/${totalCells} cells live or supportive`,
      tone: livePct >= 70 ? "good" : livePct >= 40 ? "warn" : "bad",
    },
    {
      title: "Path threshold",
      value: pathOk ? "cleared" : "below",
      hint: `${result.evidencePath.plausibility.toFixed(2)} vs ${result.evidencePath.threshold.toFixed(2)}`,
      tone: pathOk ? "good" : "bad",
    },
    {
      title: "Family agreement",
      value: agreementGood ? "strong" : agreementWarn ? "partial" : "branch",
      hint: `spread ${result.modelAgreement.spread.toFixed(3)}`,
      tone: agreementGood ? "good" : agreementWarn ? "warn" : "bad",
    },
    {
      title: "Quality flags",
      value: qOk ? "all green" : `${failed} fail · ${warned} warn`,
      hint: `${result.qualityFlags.length} controls evaluated`,
      tone: qOk ? "good" : failed > 0 ? "bad" : "warn",
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: 12,
        margin: "0 0 18px",
      }}
      data-job={job.id}
    >
      {cards.map((c) => (
        <Card key={c.title} {...c} />
      ))}
    </div>
  );
}

type Tone = "good" | "warn" | "bad";

interface CardSpec {
  title: string;
  value: string;
  hint: string;
  tone: Tone;
}

const TONE_STYLE: Record<
  Tone,
  { bg: string; ring: string; ink: string; glow: string }
> = {
  good: {
    bg: "var(--green-bg)",
    ring: "var(--green)",
    ink: "var(--green)",
    glow: "rgba(123,196,153,0.18)",
  },
  warn: {
    bg: "var(--amber-bg)",
    ring: "var(--amber)",
    ink: "var(--amber)",
    glow: "rgba(224,160,98,0.18)",
  },
  bad: {
    bg: "var(--sienna-bg)",
    ring: "var(--sienna)",
    ink: "var(--sienna)",
    glow: "rgba(224,132,116,0.22)",
  },
};

function Card({ title, value, hint, tone }: CardSpec) {
  const sty = TONE_STYLE[tone];
  return (
    <div
      style={{
        padding: "12px 14px",
        background: sty.bg,
        border: `1px solid ${sty.ring}`,
        borderRadius: 6,
        boxShadow: `0 0 18px ${sty.glow}`,
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: sty.ink,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          fontWeight: 600,
          opacity: 0.85,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: "var(--ink)",
          marginTop: 4,
          fontFamily: "var(--font-mono), monospace",
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 11,
          color: "var(--muted)",
          marginTop: 2,
        }}
      >
        {hint}
      </div>
    </div>
  );
}
