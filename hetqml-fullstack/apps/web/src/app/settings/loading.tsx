import { AppShell } from "@/components/shell/AppShell";

export default function SettingsLoading() {
  return (
    <AppShell active="/settings">
      <div className="page-hero">
        <div>
          <div className="step">SYSTEM · SETTINGS</div>
          <h1 className="h1" aria-busy="true">
            Loading preferences…
          </h1>
          <p className="lede" style={{ opacity: 0.6 }}>
            Hydrating profile, pipeline defaults, quantum preferences, IBM
            connection, notifications, privacy, and BYOK keys.
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
