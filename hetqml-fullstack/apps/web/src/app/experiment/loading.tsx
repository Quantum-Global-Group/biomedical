import { AppShell } from "@/components/shell/AppShell";

export default function ExperimentLoading() {
  return (
    <AppShell active="/experiment">
      <div className="page-hero">
        <div>
          <div className="step">02 · EXPERIMENT</div>
          <h1 className="h1" aria-busy="true">
            Loading evidence…
          </h1>
          <p className="lede" style={{ opacity: 0.6 }}>
            Resolving job and rendering leaderboard, benchmarks, and quality
            controls.
          </p>
        </div>
        <span className="pill">○ loading</span>
      </div>
      <div className="panel" aria-hidden="true">
        <div
          style={{
            height: 14,
            width: "40%",
            background: "var(--border-soft)",
            borderRadius: 4,
            marginBottom: 12,
          }}
        />
        <div
          style={{
            height: 10,
            width: "80%",
            background: "var(--border-soft)",
            borderRadius: 4,
          }}
        />
      </div>
    </AppShell>
  );
}
