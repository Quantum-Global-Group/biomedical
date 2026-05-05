"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  type ApiKeysSettings,
  type AppearanceSettings,
  type IbmConnectionSettings,
  type NotificationSettings,
  type PipelineSettings,
  type PrivacySettings,
  type ProfileSettings,
  type QuantumSettings,
  type UserSettings,
  saveSettings,
  validateIbmConnection,
} from "@/lib/api/client";
import type { InitialSettings } from "@/lib/data/fetchSettingsServer";

/* ---------- Helpers --------------------------------------------------- */

type PanelKey =
  | "profile"
  | "appearance"
  | "pipeline"
  | "quantum"
  | "ibmConnection"
  | "notifications"
  | "privacy"
  | "apiKeys";

type SaveStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: Date }
  | { kind: "error"; message: string };

function eq(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function pluralEnabled(n: NotificationSettings): string {
  const flags = [n.email, n.slack, n.browserPush];
  const on = flags.filter(Boolean).length;
  return `${on}/${flags.length}`;
}

function defaultRunPathBlurb(p: PipelineSettings): string {
  switch (p.defaultRunPath) {
    case "classical":
      return "8 classical models · ~1m";
    case "hybrid":
      return "QSVC + classical · ~2m";
    case "quantum":
      return "Pure quantum HW · ~7m";
  }
}

/* ---------- Tiny presentational helpers ------------------------------- */

function Toggle({
  on,
  onChange,
  desc,
  label,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  desc: string;
  label?: string;
}) {
  return (
    <div className="settings-toggle-wrap">
      <div
        className={on ? "settings-toggle on" : "settings-toggle"}
        role="switch"
        aria-checked={on}
        aria-label={label ?? desc}
        tabIndex={0}
        onClick={() => onChange(!on)}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            onChange(!on);
          }
        }}
      />
      <span className="settings-toggle-desc">{desc}</span>
    </div>
  );
}

function Segment<T extends string>({
  options,
  value,
  onChange,
  itemStyle,
}: {
  options: ReadonlyArray<{ value: T; label: string; style?: React.CSSProperties }>;
  value: T;
  onChange: (next: T) => void;
  itemStyle?: React.CSSProperties;
}) {
  return (
    <div className="settings-segment">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={
            opt.value === value ? "settings-seg-btn active" : "settings-seg-btn"
          }
          style={{ ...itemStyle, ...opt.style }}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function PasswordField({
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  ariaLabel: string;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className="api-key-input">
      <input
        type={shown ? "text" : "password"}
        placeholder={placeholder}
        autoComplete="new-password"
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        className="reveal-btn"
        onClick={() => setShown((s) => !s)}
      >
        {shown ? "hide" : "show"}
      </button>
    </div>
  );
}

/* ---------- Main client ----------------------------------------------- */

export function SettingsClient({ initial }: { initial: InitialSettings }) {
  const [base, setBase] = useState<UserSettings>(initial.settings);
  const [draft, setDraft] = useState<UserSettings>(initial.settings);
  const [status, setStatus] = useState<SaveStatus>({ kind: "idle" });
  const [validating, setValidating] = useState(false);
  const [validateError, setValidateError] = useState<string | null>(null);

  const dirty = useMemo(() => !eq(base, draft), [base, draft]);

  const dirtyKeys = useMemo<ReadonlySet<PanelKey>>(() => {
    const set = new Set<PanelKey>();
    (Object.keys(draft) as PanelKey[]).forEach((k) => {
      if (!eq(base[k], draft[k])) {
        set.add(k);
      }
    });
    return set;
  }, [base, draft]);

  const update = useCallback(
    <K extends PanelKey>(key: K, patch: Partial<UserSettings[K]>) => {
      setDraft((prev) => ({
        ...prev,
        [key]: { ...prev[key], ...patch },
      }));
    },
    [],
  );

  const onSave = useCallback(async () => {
    setStatus({ kind: "saving" });
    try {
      const saved = await saveSettings(draft);
      setBase(saved);
      setDraft(saved);
      setStatus({ kind: "saved", at: new Date() });
    } catch (e) {
      setStatus({
        kind: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }, [draft]);

  const onReset = useCallback(() => {
    setDraft(base);
    setStatus({ kind: "idle" });
  }, [base]);

  const onValidateIbm = useCallback(async () => {
    setValidating(true);
    setValidateError(null);
    try {
      // Persist any pending edits to the IBM panel first so the validator
      // sees the current crn/instance.
      let target = base;
      if (!eq(base.ibmConnection, draft.ibmConnection)) {
        target = await saveSettings(draft);
        setBase(target);
        setDraft(target);
      }
      const updated = await validateIbmConnection();
      setBase(updated);
      setDraft(updated);
      setStatus({ kind: "saved", at: new Date() });
    } catch (e) {
      setValidateError(e instanceof Error ? e.message : String(e));
    } finally {
      setValidating(false);
    }
  }, [base, draft]);

  /* ---------- Status pill text ----- */
  const pillText =
    status.kind === "saving"
      ? "○ saving…"
      : status.kind === "error"
        ? "● save failed"
        : dirty
          ? "● unsaved changes"
          : "● settings synced";
  const pillClass =
    status.kind === "error"
      ? "pill amber"
      : dirty || status.kind === "saving"
        ? "pill"
        : "pill";

  const lastSavedLabel =
    status.kind === "saved"
      ? `last saved · ${fmtTime(status.at)}`
      : status.kind === "saving"
        ? "saving…"
        : "loading…";

  const ibm = draft.ibmConnection;
  const ibmBadgeLabel = ibm.validated
    ? `✓ Connected · ${ibm.planTier ?? "—"}`
    : ibm.crn.trim().length > 0
      ? "● Pending"
      : "Not configured";
  const ibmBadgeColor = ibm.validated
    ? "var(--green)"
    : ibm.crn.trim().length > 0
      ? "var(--gold)"
      : "var(--faint)";

  /* ---------- Render ----- */
  return (
    <>
      <div className="page-hero">
        <div>
          <div className="step">SYSTEM · SETTINGS</div>
          <h1 className="h1">Personalize the dashboard and platform defaults</h1>
          <p className="lede">
            Settings persist server-side and apply to every investigation, run,
            and export. Edit any field and click <strong>Save changes</strong>{" "}
            to commit. The IBM connection panel has a dedicated validator.
          </p>
        </div>
        <span className={pillClass}>{pillText}</span>
      </div>

      {/* Metric strip */}
      <div className="metrics">
        <div className="metric">
          <div className="metric-label">REVIEWER</div>
          <div className="metric-value" style={{ fontSize: 18 }}>
            {draft.profile.reviewerName.trim() || "—"}
          </div>
          <div className="metric-sub">{draft.profile.role || "unassigned"}</div>
        </div>
        <div className="metric">
          <div className="metric-label">DEFAULT RUN PATH</div>
          <div className="metric-value teal" style={{ fontSize: 18 }}>
            {draft.pipeline.defaultRunPath}
          </div>
          <div className="metric-sub">{defaultRunPathBlurb(draft.pipeline)}</div>
        </div>
        <div className="metric">
          <div className="metric-label">NOTIFICATIONS</div>
          <div className="metric-value green" style={{ fontSize: 18 }}>
            {pluralEnabled(draft.notifications)}
          </div>
          <div className="metric-sub">channels enabled</div>
        </div>
        <div className="metric">
          <div className="metric-label">SETTINGS SOURCE</div>
          <div className="metric-value mono" style={{ fontSize: 18 }}>
            {initial.source}
          </div>
          <div className="metric-sub">{lastSavedLabel}</div>
        </div>
      </div>

      {initial.error ? (
        <div className="skeptic-warning" style={{ marginTop: 14 }}>
          API offline at hydration time — showing fallback defaults. (
          {initial.error})
        </div>
      ) : null}

      {status.kind === "error" ? (
        <div
          className="skeptic-warning"
          role="alert"
          style={{ marginTop: 14, borderColor: "var(--sienna)" }}
        >
          Save failed: {status.message}
        </div>
      ) : null}

      {/* Profile + Appearance */}
      <div className="grid-2">
        <ProfilePanel
          value={draft.profile}
          onChange={(patch) => update("profile", patch)}
          dirty={dirtyKeys.has("profile")}
        />
        <AppearancePanel
          value={draft.appearance}
          onChange={(patch) => update("appearance", patch)}
          dirty={dirtyKeys.has("appearance")}
        />
      </div>

      {/* Pipeline + Quantum */}
      <div className="grid-2">
        <PipelinePanel
          value={draft.pipeline}
          onChange={(patch) => update("pipeline", patch)}
          dirty={dirtyKeys.has("pipeline")}
        />
        <QuantumPanel
          value={draft.quantum}
          onChange={(patch) => update("quantum", patch)}
          dirty={dirtyKeys.has("quantum")}
        />
      </div>

      {/* Notifications + Privacy */}
      <div className="grid-2">
        <NotificationsPanel
          value={draft.notifications}
          onChange={(patch) => update("notifications", patch)}
          dirty={dirtyKeys.has("notifications")}
        />
        <PrivacyPanel
          value={draft.privacy}
          onChange={(patch) => update("privacy", patch)}
          dirty={dirtyKeys.has("privacy")}
        />
      </div>

      {/* IBM Quantum connection */}
      <IbmConnectionPanel
        value={draft.ibmConnection}
        onChange={(patch) => update("ibmConnection", patch)}
        dirty={dirtyKeys.has("ibmConnection")}
        validating={validating}
        onValidate={onValidateIbm}
        validateError={validateError}
        badgeLabel={ibmBadgeLabel}
        badgeColor={ibmBadgeColor}
      />

      {/* API Keys */}
      <ApiKeysPanel
        value={draft.apiKeys}
        onChange={(patch) => update("apiKeys", patch)}
        dirty={dirtyKeys.has("apiKeys")}
      />

      {/* Reference panels (static, no API) */}
      <div className="grid-2">
        <KeyboardShortcutsPanel />
        <AboutPanel />
      </div>

      <div className="how-to">
        <div className="how-to-h">⊙ HOW TO READ THIS PAGE</div>
        <div className="how-to-title">
          What this view answers — and what to question
        </div>
        <p className="how-lede">
          Settings is the configuration surface for everything else. Profile +
          Appearance + Pipeline Defaults shape your investigations. Quantum
          Preferences govern compute. Notifications + Privacy decide what data
          leaves your browser. API Keys + Shortcuts handle integration and
          ergonomics.
        </p>
        <div className="how-section">
          <div className="how-section-head">
            <span className="how-section-num">01</span>
            <span className="how-section-name">
              Profile · Appearance · Pipeline Defaults
            </span>
            <span className="how-section-badge">personal · per-deployment</span>
          </div>
          <div className="how-grid">
            <div>
              <div className="how-col-h ans">PROVIDES</div>
              <div className="how-item">
                <span className="icon-c">✓</span>
                <span>
                  Reviewer identity (used on Validate decisions),
                  theme/accent/density, default investigation parameters
                </span>
              </div>
              <div className="how-item">
                <span className="icon-c">✓</span>
                <span>
                  Strict posture toggle: block any run when a critical guard is
                  off — opt-in stricter operating mode
                </span>
              </div>
            </div>
            <div>
              <div className="how-col-h q">INTERROGATE</div>
              <div className="how-item">
                <span className="icon-q">⊙</span>
                <span>
                  If your name appears on logged decisions, is it spelled the
                  way collaborators expect?
                </span>
              </div>
              <div className="how-item">
                <span className="icon-q">⊙</span>
                <span>
                  Should strict posture be on for production work? It prevents
                  accidentally publishing audit-blocked numbers
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="how-section">
          <div className="how-section-head">
            <span className="how-section-num">02</span>
            <span className="how-section-name">
              Quantum Preferences · Notifications
            </span>
            <span className="how-section-badge">compute · alerts</span>
          </div>
          <div className="how-grid">
            <div>
              <div className="how-col-h ans">PROVIDES</div>
              <div className="how-item">
                <span className="icon-c">✓</span>
                <span>
                  Default backend, shot budget, job timeout, ZNE on/off,
                  pulse-level access
                </span>
              </div>
              <div className="how-item">
                <span className="icon-c">✓</span>
                <span>
                  Email / Slack / browser-push alert channels with severity
                  threshold
                </span>
              </div>
            </div>
            <div>
              <div className="how-col-h q">INTERROGATE</div>
              <div className="how-item">
                <span className="icon-q">⊙</span>
                <span>
                  Are shots high enough for your statistical tolerance? 4,096
                  is fast but noisier; 16,384 is the project default
                </span>
              </div>
              <div className="how-item">
                <span className="icon-q">⊙</span>
                <span>
                  If you turn off email alerts, will you remember to check the
                  dashboard manually?
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="how-section">
          <div className="how-section-head">
            <span className="how-section-num">03</span>
            <span className="how-section-name">
              Privacy · API Keys · About
            </span>
            <span className="how-section-badge">
              data sharing · BYOK · build info
            </span>
          </div>
          <div className="how-grid">
            <div>
              <div className="how-col-h ans">PROVIDES</div>
              <div className="how-item">
                <span className="icon-c">✓</span>
                <span>
                  Telemetry / error reporting / crash diagnostics opt-out
                  toggles. Decision retention cap (30 / 90 / 365 / forever)
                </span>
              </div>
              <div className="how-item">
                <span className="icon-c">✓</span>
                <span>
                  Bring-your-own-key fields for IBM Quantum, OpenAI, custom
                  services. Keys never transmitted by the dashboard backend
                </span>
              </div>
              <div className="how-item">
                <span className="icon-c">✓</span>
                <span>
                  Build version, commit SHA, license, citation, support links
                </span>
              </div>
            </div>
            <div>
              <div className="how-col-h q">INTERROGATE</div>
              <div className="how-item">
                <span className="icon-q">⊙</span>
                <span>
                  Is the IBM Quantum API key in your account or a shared one?
                  Costs accrue to whichever account owns the key
                </span>
              </div>
              <div className="how-item">
                <span className="icon-q">⊙</span>
                <span>
                  Is decision retention long enough for the audit period your
                  research demands?
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="footer-actions">
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            className="btn"
            onClick={onReset}
            disabled={!dirty || status.kind === "saving"}
          >
            ↺ Discard changes
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={onSave}
            disabled={!dirty || status.kind === "saving"}
          >
            {status.kind === "saving" ? "Saving…" : "Save changes"}
          </button>
          <span style={{ fontSize: 11, color: "var(--faint)", marginLeft: 8 }}>
            {dirty
              ? `${dirtyKeys.size} section${dirtyKeys.size === 1 ? "" : "s"} pending`
              : status.kind === "saved"
                ? `synced · ${fmtTime(status.at)}`
                : "all changes saved"}
          </span>
        </div>
        <Link href="/initialize" className="btn-primary">
          Back to Initialize →
        </Link>
      </div>
    </>
  );
}

/* ---------- Sub-panels ------------------------------------------------ */

function PanelHead({
  eyebrow,
  title,
  badge,
  badgeStyle,
  dirty,
}: {
  eyebrow: string;
  title: string;
  badge: string;
  badgeStyle?: React.CSSProperties;
  dirty?: boolean;
}) {
  return (
    <div className="panel-head">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <div className="panel-title">{title}</div>
      </div>
      <span className="badge" style={badgeStyle}>
        {dirty ? "● modified" : badge}
      </span>
    </div>
  );
}

function ProfilePanel({
  value,
  onChange,
  dirty,
}: {
  value: ProfileSettings;
  onChange: (patch: Partial<ProfileSettings>) => void;
  dirty: boolean;
}) {
  return (
    <div className="panel">
      <PanelHead
        eyebrow="TOOL · PROFILE"
        title="Reviewer identity"
        badge="Personal"
        dirty={dirty}
      />
      <p className="panel-purpose">
        Used as the reviewer for decisions logged on the Validate page and the
        contact for export/share emails.
      </p>
      <div className="settings-form">
        <div className="settings-row">
          <div className="settings-label">Reviewer name</div>
          <input
            className="settings-input"
            type="text"
            placeholder="Last name, first"
            value={value.reviewerName}
            onChange={(e) => onChange({ reviewerName: e.target.value })}
          />
        </div>
        <div className="settings-row">
          <div className="settings-label">Role</div>
          <select
            className="settings-input"
            value={value.role}
            onChange={(e) => onChange({ role: e.target.value })}
          >
            <option value="">— select —</option>
            <option value="researcher">Researcher</option>
            <option value="reviewer">Reviewer / KOL</option>
            <option value="data-scientist">Data scientist</option>
            <option value="clinician">Clinician</option>
            <option value="platform-engineer">Platform engineer</option>
            <option value="executive">Executive / sponsor</option>
          </select>
        </div>
        <div className="settings-row">
          <div className="settings-label">Organization</div>
          <input
            className="settings-input"
            type="text"
            placeholder="Institution name"
            value={value.organization}
            onChange={(e) => onChange({ organization: e.target.value })}
          />
        </div>
        <div className="settings-row">
          <div className="settings-label">Contact email</div>
          <input
            className="settings-input"
            type="email"
            placeholder="name@example.org"
            value={value.contactEmail}
            onChange={(e) => onChange({ contactEmail: e.target.value })}
          />
        </div>
      </div>
      <div className="panel-footer">
        <span>profile · server</span>
        <span>
          <em>save to commit</em>
        </span>
      </div>
    </div>
  );
}

function AppearancePanel({
  value,
  onChange,
  dirty,
}: {
  value: AppearanceSettings;
  onChange: (patch: Partial<AppearanceSettings>) => void;
  dirty: boolean;
}) {
  return (
    <div className="panel">
      <PanelHead
        eyebrow="TOOL · APPEARANCE"
        title="Theme & density"
        badge="UI"
        dirty={dirty}
      />
      <p className="panel-purpose">
        Visual preferences. Theme is the colour scheme; density adjusts panel
        padding for laptop vs desktop.
      </p>
      <div className="settings-form">
        <div className="settings-row">
          <div className="settings-label">Theme</div>
          <Segment<AppearanceSettings["theme"]>
            value={value.theme}
            onChange={(theme) => onChange({ theme })}
            options={[
              { value: "light", label: "☼ Light" },
              { value: "dark", label: "☾ Dark" },
              { value: "auto", label: "▢ Auto" },
            ]}
          />
        </div>
        <div className="settings-row">
          <div className="settings-label">Accent</div>
          <Segment<string>
            value={value.accent}
            onChange={(accent) => onChange({ accent })}
            options={[
              { value: "teal", label: "● Teal", style: { color: "var(--teal)" } },
              { value: "gold", label: "● Gold", style: { color: "var(--gold)" } },
              {
                value: "purple",
                label: "● Purple",
                style: { color: "var(--purple)" },
              },
              {
                value: "green",
                label: "● Green",
                style: { color: "var(--green)" },
              },
            ]}
          />
        </div>
        <div className="settings-row">
          <div className="settings-label">Density</div>
          <Segment<AppearanceSettings["density"]>
            value={value.density}
            onChange={(density) => onChange({ density })}
            options={[
              { value: "compact", label: "Compact" },
              { value: "comfortable", label: "Comfortable" },
            ]}
          />
        </div>
        <div className="settings-row">
          <div className="settings-label">Reduce motion</div>
          <Toggle
            on={value.reduceMotion}
            onChange={(reduceMotion) => onChange({ reduceMotion })}
            desc="Disable rotation / fade animations"
          />
        </div>
      </div>
      <div className="panel-footer">
        <span>appearance · server</span>
        <span>
          <em>applies dashboard-wide</em>
        </span>
      </div>
    </div>
  );
}

function PipelinePanel({
  value,
  onChange,
  dirty,
}: {
  value: PipelineSettings;
  onChange: (patch: Partial<PipelineSettings>) => void;
  dirty: boolean;
}) {
  return (
    <div className="panel">
      <PanelHead
        eyebrow="TOOL · PIPELINE DEFAULTS"
        title="Investigation defaults"
        badge="Preset"
        dirty={dirty}
      />
      <p className="panel-purpose">
        What the Initialize page should pre-populate with, and how aggressive
        the integrity guards are by default.
      </p>
      <div className="settings-form">
        <div className="settings-row">
          <div className="settings-label">Default run path</div>
          <Segment<PipelineSettings["defaultRunPath"]>
            value={value.defaultRunPath}
            onChange={(defaultRunPath) => onChange({ defaultRunPath })}
            options={[
              { value: "classical", label: "Classical" },
              { value: "hybrid", label: "Hybrid" },
              { value: "quantum", label: "Quantum HW" },
            ]}
          />
        </div>
        <div className="settings-row">
          <div className="settings-label">Default metaedge</div>
          <select
            className="settings-input"
            value={value.defaultMetaedge}
            onChange={(e) => onChange({ defaultMetaedge: e.target.value })}
          >
            <option value="CtD">CtD · Compound–treats–Disease</option>
            <option value="CpD">CpD · Compound–palliates–Disease</option>
            <option value="CbG">CbG · Compound–binds–Gene</option>
          </select>
        </div>
        <div className="settings-row">
          <div className="settings-label">Hard-negative ratio</div>
          <select
            className="settings-input"
            value={value.hardNegativeRatio}
            onChange={(e) =>
              onChange({
                hardNegativeRatio: e.target
                  .value as PipelineSettings["hardNegativeRatio"],
              })
            }
          >
            <option value="1:3">1:3 (lenient)</option>
            <option value="1:5">1:5 (default)</option>
            <option value="1:10">1:10 (aggressive)</option>
          </select>
        </div>
        <div className="settings-row">
          <div className="settings-label">Strict posture</div>
          <Toggle
            on={value.strictPosture}
            onChange={(strictPosture) => onChange({ strictPosture })}
            desc="Block runs when any critical guard is off"
          />
        </div>
        <div className="settings-row">
          <div className="settings-label">Auto-save sessions</div>
          <Toggle
            on={value.autosaveSessions}
            onChange={(autosaveSessions) => onChange({ autosaveSessions })}
            desc="Snapshot after every parameter change"
          />
        </div>
      </div>
      <div className="panel-footer">
        <span>pipeline_defaults · server</span>
        <span>
          <em>applied at Initialize</em>
        </span>
      </div>
    </div>
  );
}

function QuantumPanel({
  value,
  onChange,
  dirty,
}: {
  value: QuantumSettings;
  onChange: (patch: Partial<QuantumSettings>) => void;
  dirty: boolean;
}) {
  return (
    <div className="panel">
      <PanelHead
        eyebrow="TOOL · QUANTUM PREFERENCES"
        title="IBM hardware defaults"
        badge="Compute"
        dirty={dirty}
      />
      <p className="panel-purpose">
        Default backend selection, shot budget, and noise-mitigation defaults
        applied to every quantum / hybrid run.
      </p>
      <div className="settings-form">
        <div className="settings-row">
          <div className="settings-label">Default backend</div>
          <select
            className="settings-input"
            value={value.defaultBackend}
            onChange={(e) => onChange({ defaultBackend: e.target.value })}
          >
            <option value="ibm_torino">
              ibm_torino · Heron r2 · 156 qubits
            </option>
            <option value="ibm_brisbane">
              ibm_brisbane · Eagle r3 · 127 qubits
            </option>
            <option value="ibm_kyoto">
              ibm_kyoto · Eagle r3 · 127 qubits
            </option>
            <option value="ibm_simulator">
              ibm_simulator · noiseless · 32 qubits
            </option>
          </select>
        </div>
        <div className="settings-row">
          <div className="settings-label">Shots per circuit</div>
          <select
            className="settings-input"
            value={String(value.shotsPerCircuit)}
            onChange={(e) =>
              onChange({ shotsPerCircuit: Number(e.target.value) })
            }
          >
            <option value="4096">4,096 (fast)</option>
            <option value="8192">8,192</option>
            <option value="16384">16,384 (default)</option>
            <option value="32768">32,768 (max)</option>
          </select>
        </div>
        <div className="settings-row">
          <div className="settings-label">Job timeout</div>
          <select
            className="settings-input"
            value={String(value.jobTimeoutSeconds)}
            onChange={(e) =>
              onChange({ jobTimeoutSeconds: Number(e.target.value) })
            }
          >
            <option value="300">5 minutes</option>
            <option value="900">15 minutes</option>
            <option value="1800">30 minutes (default)</option>
            <option value="3600">1 hour</option>
          </select>
        </div>
        <div className="settings-row">
          <div className="settings-label">Zero-noise extrapolation</div>
          <Toggle
            on={value.zneEnabled}
            onChange={(zneEnabled) => onChange({ zneEnabled })}
            desc="Apply ZNE on every QSVC run"
          />
        </div>
        <div className="settings-row">
          <div className="settings-label">Pulse-level access</div>
          <Toggle
            on={value.pulseLevelAccess}
            onChange={(pulseLevelAccess) => onChange({ pulseLevelAccess })}
            desc="Enable Qiskit Pulse for custom gates"
          />
        </div>
      </div>
      <div className="panel-footer">
        <span>quantum_prefs · server</span>
        <span>
          <em>per-job override available</em>
        </span>
      </div>
    </div>
  );
}

function NotificationsPanel({
  value,
  onChange,
  dirty,
}: {
  value: NotificationSettings;
  onChange: (patch: Partial<NotificationSettings>) => void;
  dirty: boolean;
}) {
  return (
    <div className="panel">
      <PanelHead
        eyebrow="TOOL · NOTIFICATIONS"
        title="Where to send alerts"
        badge="Channels"
        dirty={dirty}
      />
      <p className="panel-purpose">
        Channel configuration for run completion, integrity-guard failures,
        and budget warnings.
      </p>
      <div className="settings-form">
        <div className="settings-row">
          <div className="settings-label">Email alerts</div>
          <Toggle
            on={value.email}
            onChange={(email) => onChange({ email })}
            desc="Send job completion to contact email"
          />
        </div>
        <div className="settings-row">
          <div className="settings-label">Slack webhook</div>
          <Toggle
            on={value.slack}
            onChange={(slack) => onChange({ slack })}
            desc="Post to your Slack channel"
          />
        </div>
        <div className="settings-row">
          <div className="settings-label">Browser push</div>
          <Toggle
            on={value.browserPush}
            onChange={(browserPush) => onChange({ browserPush })}
            desc="In-browser notifications"
          />
        </div>
        <div className="settings-row">
          <div className="settings-label">Alert threshold</div>
          <select
            className="settings-input"
            value={value.severityThreshold}
            onChange={(e) =>
              onChange({
                severityThreshold: e.target
                  .value as NotificationSettings["severityThreshold"],
              })
            }
          >
            <option value="info">All events</option>
            <option value="warn">Warning + critical</option>
            <option value="crit">Critical only</option>
          </select>
        </div>
        <div className="settings-row">
          <div className="settings-label">Slack webhook URL</div>
          <input
            className="settings-input"
            type="text"
            placeholder="https://hooks.slack.com/..."
            value={value.slackWebhookUrl}
            onChange={(e) => onChange({ slackWebhookUrl: e.target.value })}
          />
        </div>
      </div>
      <div className="panel-footer">
        <span>notifications · server</span>
        <span>
          <em>encrypted at rest</em>
        </span>
      </div>
    </div>
  );
}

function PrivacyPanel({
  value,
  onChange,
  dirty,
}: {
  value: PrivacySettings;
  onChange: (patch: Partial<PrivacySettings>) => void;
  dirty: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="panel">
      <PanelHead
        eyebrow="TOOL · PRIVACY & TELEMETRY"
        title="Data sharing controls"
        badge="Privacy"
        dirty={dirty}
      />
      <p className="panel-purpose">
        Opt-in / opt-out toggles for telemetry, error reporting, and anonymous
        usage analytics.
      </p>
      <div className="settings-form">
        <div className="settings-row">
          <div className="settings-label">Anonymous usage</div>
          <Toggle
            on={value.anonymousUsage}
            onChange={(anonymousUsage) => onChange({ anonymousUsage })}
            desc="Page views and feature counts (no PII)"
          />
        </div>
        <div className="settings-row">
          <div className="settings-label">Error reporting</div>
          <Toggle
            on={value.errorReporting}
            onChange={(errorReporting) => onChange({ errorReporting })}
            desc="Send stack traces to Sentry"
          />
        </div>
        <div className="settings-row">
          <div className="settings-label">Crash diagnostics</div>
          <Toggle
            on={value.crashDiagnostics}
            onChange={(crashDiagnostics) => onChange({ crashDiagnostics })}
            desc="Include browser memory + last actions"
          />
        </div>
        <div className="settings-row">
          <div className="settings-label">Decision retention</div>
          <select
            className="settings-input"
            value={String(value.decisionRetentionDays)}
            onChange={(e) =>
              onChange({
                decisionRetentionDays: Number(e.target.value) as
                  | 30
                  | 90
                  | 365
                  | 0,
              })
            }
          >
            <option value="30">30 days</option>
            <option value="90">90 days</option>
            <option value="365">1 year (default)</option>
            <option value="0">Forever</option>
          </select>
        </div>
        <button
          type="button"
          className="btn"
          style={{
            width: "100%",
            padding: 8,
            background: "var(--sienna-bg)",
            color: "var(--sienna)",
            borderColor: "var(--sienna)",
          }}
          onClick={() => {
            if (confirming) {
              try {
                window.localStorage.clear();
                window.sessionStorage.clear();
              } catch {
                /* no-op */
              }
              setConfirming(false);
            } else {
              setConfirming(true);
              window.setTimeout(() => setConfirming(false), 4000);
            }
          }}
        >
          {confirming
            ? "⚠ Confirm — click again to clear browser storage"
            : "⚠ Clear all locally-stored data"}
        </button>
      </div>
      <div className="panel-footer">
        <span>privacy · server</span>
        <span>
          <em>privacy-first defaults</em>
        </span>
      </div>
    </div>
  );
}

function IbmConnectionPanel({
  value,
  onChange,
  dirty,
  validating,
  onValidate,
  validateError,
  badgeLabel,
  badgeColor,
}: {
  value: IbmConnectionSettings;
  onChange: (patch: Partial<IbmConnectionSettings>) => void;
  dirty: boolean;
  validating: boolean;
  onValidate: () => void;
  validateError: string | null;
  badgeLabel: string;
  badgeColor: string;
}) {
  // BYOK API token — held in component state only, never sent to dashboard
  // backend. Persisted only in the browser session.
  const [token, setToken] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      return window.sessionStorage.getItem("hetqml.ibm.token") ?? "";
    } catch {
      return "";
    }
  });

  const updateToken = (next: string) => {
    setToken(next);
    try {
      if (next) window.sessionStorage.setItem("hetqml.ibm.token", next);
      else window.sessionStorage.removeItem("hetqml.ibm.token");
    } catch {
      /* no-op */
    }
  };

  return (
    <div className="panel">
      <PanelHead
        eyebrow="TOOL · IBM QUANTUM CONNECTION"
        title="API token + Cloud Resource Name (CRN)"
        badge={badgeLabel}
        badgeStyle={{ color: badgeColor }}
        dirty={dirty}
      />
      <p className="panel-purpose">
        Connect your IBM Quantum Platform account. The <strong>API token</strong>{" "}
        authenticates you (kept in browser session storage, never sent to the
        dashboard backend); the <strong>CRN</strong> identifies the IBM Cloud
        quantum-instance to bill / route jobs through. Both required to view
        workload on the Operations page or to submit jobs from the Hybrid /
        Quantum HW run paths.
      </p>
      <div className="settings-form" style={{ marginTop: 8 }}>
        <div className="settings-row">
          <div className="settings-label">API token</div>
          <PasswordField
            value={token}
            onChange={updateToken}
            placeholder="Paste IBM Quantum Platform token..."
            ariaLabel="IBM Quantum API token"
          />
        </div>
        <div className="settings-row">
          <div className="settings-label">CRN</div>
          <input
            className="settings-input"
            type="text"
            placeholder="crn:v1:bluemix:public:quantum-computing:us-east:a/<account>:<instance>::"
            autoComplete="off"
            value={value.crn}
            onChange={(e) => onChange({ crn: e.target.value })}
          />
        </div>
        <div className="settings-row">
          <div className="settings-label">Instance name</div>
          <input
            className="settings-input"
            type="text"
            placeholder="hub/group/project or instance display name"
            autoComplete="off"
            value={value.instanceName ?? ""}
            onChange={(e) =>
              onChange({ instanceName: e.target.value || null })
            }
          />
        </div>
        <div className="settings-row">
          <div className="settings-label">Plan tier</div>
          <input
            className="settings-input"
            type="text"
            placeholder="open · standard · premium"
            autoComplete="off"
            value={value.planTier ?? ""}
            onChange={(e) => onChange({ planTier: e.target.value || null })}
          />
        </div>
        <div className="settings-row">
          <div className="settings-label">Connection</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              className="btn"
              onClick={onValidate}
              disabled={validating}
            >
              {validating ? "Validating…" : "⌥ Validate connection"}
            </button>
            <span
              style={{
                fontSize: 11,
                color: validateError
                  ? "var(--sienna)"
                  : value.validated
                    ? "var(--green)"
                    : "var(--faint)",
                fontFamily: "monospace",
              }}
            >
              {validateError
                ? `— ${validateError}`
                : value.validated
                  ? `— validated · ${value.planTier ?? "no plan"}`
                  : "— not validated"}
            </span>
          </div>
        </div>
      </div>
      <div className="panel-footer">
        <span>ibm_quantum · server (token in sessionStorage)</span>
        <span>
          <em>credentials never transmitted to dashboard backend</em>
        </span>
      </div>
    </div>
  );
}

function ApiKeysPanel({
  value,
  onChange,
  dirty,
}: {
  value: ApiKeysSettings;
  onChange: (patch: Partial<ApiKeysSettings>) => void;
  dirty: boolean;
}) {
  const rows: Array<{
    key: keyof ApiKeysSettings;
    name: string;
    sub: string;
  }> = [
    {
      key: "openai",
      name: "OpenAI",
      sub: "For text-to-investigation features (optional)",
    },
    {
      key: "anthropic",
      name: "Anthropic",
      sub: "Claude models for narrative summarization (optional)",
    },
    {
      key: "pubchemPremium",
      name: "PubChem premium",
      sub: "Higher rate limits · optional · cloud.ncbi",
    },
    {
      key: "drugbankPro",
      name: "DrugBank Pro",
      sub: "Full clinical annotations · drugbank.com",
    },
    {
      key: "sentryDsn",
      name: "Sentry DSN",
      sub: "Custom error reporting endpoint (optional)",
    },
  ];

  return (
    <div className="panel">
      <PanelHead
        eyebrow="TOOL · OTHER API KEYS & INTEGRATIONS"
        title="External service credentials"
        badge="Secrets"
        dirty={dirty}
      />
      <p className="panel-purpose">
        Bring-your-own-key model. Keys are persisted server-side in encrypted
        form for the deployment&apos;s reviewer account; the dashboard never
        proxies them to upstream services on its own — routers that need a key
        look it up here at request time.
      </p>
      <div>
        {rows.map((row) => {
          const v = value[row.key] ?? "";
          const set = v.length > 0;
          return (
            <div className="api-key-row" key={row.key}>
              <div className="api-key-name">
                {row.name}
                <span className="sub">{row.sub}</span>
              </div>
              <PasswordField
                value={v}
                onChange={(next) =>
                  onChange({ [row.key]: next.length > 0 ? next : null } as Partial<ApiKeysSettings>)
                }
                placeholder="Paste key here..."
                ariaLabel={`${row.name} API key`}
              />
              <div className={set ? "api-key-status set" : "api-key-status unset"}>
                {set ? "set" : "unset"}
              </div>
            </div>
          );
        })}
      </div>
      <div className="panel-footer">
        <span>api_keys · server (encrypted at rest)</span>
        <span>
          <em>BYOK · never proxied without explicit request</em>
        </span>
      </div>
    </div>
  );
}

/* ---------- Static reference panels ----------------------------------- */

function KeyboardShortcutsPanel() {
  const rows: Array<{ action: string; sub: string; keys: string[] }> = [
    { action: "Initialize page", sub: "navigate", keys: ["1"] },
    { action: "Experiment page", sub: "navigate", keys: ["2"] },
    { action: "Validate page", sub: "navigate", keys: ["3"] },
    { action: "Visualize page", sub: "navigate", keys: ["4"] },
    { action: "Operations page", sub: "navigate", keys: ["5"] },
    { action: "Settings page", sub: "navigate", keys: ["6"] },
    { action: "Save current investigation", sub: "session", keys: ["⌘", "S"] },
    { action: "Quick resume last session", sub: "session", keys: ["⌘", "R"] },
    { action: "Toggle compound combobox", sub: "form", keys: ["/"] },
    { action: "Log Keep decision", sub: "validate", keys: ["K"] },
    { action: "Log Review decision", sub: "validate", keys: ["V"] },
    { action: "Log Reject decision", sub: "validate", keys: ["X"] },
    { action: "Export evidence", sub: "visualize", keys: ["⌘", "E"] },
  ];
  return (
    <div className="panel">
      <PanelHead
        eyebrow="TOOL · KEYBOARD SHORTCUTS"
        title="Bindings reference"
        badge="Reference"
      />
      <p className="panel-purpose">
        Standard shortcuts for navigating the dashboard. Bindings are
        currently fixed — customization arrives in a later release.
      </p>
      <div>
        {rows.map((r) => (
          <div className="shortcut-row" key={r.action}>
            <div className="shortcut-action">
              {r.action}
              <span className="sub">{r.sub}</span>
            </div>
            <div className="shortcut-keys">
              {r.keys.map((k) => (
                <span className="shortcut-key" key={k}>
                  {k}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="panel-footer">
        <span>shortcuts · static</span>
        <span>
          <em>—</em>
        </span>
      </div>
    </div>
  );
}

function AboutPanel() {
  const [diag, setDiag] = useState<{ ua: string; storage: string }>({
    ua: "—",
    storage: "—",
  });

  // Hydrate browser-only diagnostics after mount to avoid SSR mismatch.
  useEffect(() => {
    let storage = "—";
    try {
      const used = JSON.stringify(window.localStorage).length;
      storage = `${(used / 1024).toFixed(1)} KB`;
    } catch {
      /* no-op */
    }
    setDiag({
      ua: navigator.userAgent.split(" ").slice(-2).join(" "),
      storage,
    });
  }, []);

  const rows: Array<[string, string]> = [
    ["Version", "v0.7.2 · Hetionet · QML"],
    ["Build", process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev"],
    ["Hetionet", "v1.0 · DOI 10.7554/eLife.26726"],
    ["License", "Apache 2.0 (dashboard) · CC0 1.0 (Hetionet data)"],
    ["Repository", "github.com/quantumGlobalGroup/acm"],
    ["Citation", "Anderson et al. (2026) Hetionet QML Dashboard v0.7.2"],
    ["Support", "support@quantumgg.dev · docs.quantumgg.dev"],
    ["Browser", diag.ua],
    ["localStorage", diag.storage],
  ];

  return (
    <div className="panel">
      <PanelHead
        eyebrow="TOOL · ABOUT & DIAGNOSTICS"
        title="Build info, version, support"
        badge="Info"
      />
      <p className="panel-purpose">
        Reference info for citation, support, and reproducibility.
      </p>
      <div>
        {rows.map(([label, val]) => (
          <div className="about-row" key={label}>
            <div className="about-label">{label}</div>
            <div className="about-value">{val}</div>
          </div>
        ))}
      </div>
      <div className="panel-footer">
        <span>build/manifest.json</span>
        <span>
          <em>—</em>
        </span>
      </div>
    </div>
  );
}
