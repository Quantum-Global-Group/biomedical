import { AppShell } from "@/components/shell/AppShell";

export default function InitializeLoading() {
  return (
    <AppShell active="/initialize">
      <div className="page-hero">
        <div>
          <div className="step">01 · INITIALIZE</div>
          <h1 className="h1" aria-busy="true">
            Loading investigation form…
          </h1>
          <p className="lede" style={{ opacity: 0.6 }}>
            Hydrating the disease, compound, gene, and metaedge catalogs.
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
            width: "85%",
            background: "var(--border-soft)",
            borderRadius: 4,
            marginBottom: 8,
          }}
        />
        <div
          style={{
            height: 10,
            width: "70%",
            background: "var(--border-soft)",
            borderRadius: 4,
          }}
        />
      </div>
    </AppShell>
  );
}
