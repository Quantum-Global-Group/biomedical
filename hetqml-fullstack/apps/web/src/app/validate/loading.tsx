import { AppShell } from "@/components/shell/AppShell";

export default function ValidateLoading() {
  return (
    <AppShell active="/validate">
      <div className="page-hero">
        <div>
          <div className="step">03 · VALIDATE</div>
          <h1 className="h1" aria-busy="true">
            Loading validation context…
          </h1>
          <p className="lede" style={{ opacity: 0.6 }}>
            Restoring decision history and skeptic notes.
          </p>
        </div>
        <span className="pill">○ loading</span>
      </div>
      <div className="panel" aria-hidden="true">
        <div
          style={{
            height: 14,
            width: "50%",
            background: "var(--border-soft)",
            borderRadius: 4,
            marginBottom: 12,
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
