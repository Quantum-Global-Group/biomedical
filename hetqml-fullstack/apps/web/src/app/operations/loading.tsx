import { AppShell } from "@/components/shell/AppShell";

export default function OperationsLoading() {
  return (
    <AppShell active="/operations">
      <div className="page-hero">
        <div>
          <div className="step">SYSTEM · OPERATIONS</div>
          <h1 className="h1" aria-busy="true">
            Loading platform health…
          </h1>
          <p className="lede" style={{ opacity: 0.6 }}>
            Probing services, backends, queues, and budgets.
          </p>
        </div>
        <span className="pill">○ loading</span>
      </div>
      <div className="panel" aria-hidden="true">
        <div
          style={{
            height: 14,
            width: "45%",
            background: "var(--border-soft)",
            borderRadius: 4,
            marginBottom: 12,
          }}
        />
        <div
          style={{
            height: 10,
            width: "75%",
            background: "var(--border-soft)",
            borderRadius: 4,
          }}
        />
      </div>
    </AppShell>
  );
}
