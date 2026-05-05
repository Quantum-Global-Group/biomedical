import { AppShell } from "@/components/shell/AppShell";

export default function VisualizeLoading() {
  return (
    <AppShell active="/visualize">
      <div className="page-hero">
        <div>
          <div className="step">04 · VISUALIZE</div>
          <h1 className="h1" aria-busy="true">
            Loading evidence layers…
          </h1>
          <p className="lede" style={{ opacity: 0.6 }}>
            Resolving job, evidence matrix, model agreement, and quantum
            circuit.
          </p>
        </div>
        <span className="pill">○ loading</span>
      </div>
      <div className="panel" aria-hidden="true">
        <div
          style={{
            height: 14,
            width: "55%",
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
