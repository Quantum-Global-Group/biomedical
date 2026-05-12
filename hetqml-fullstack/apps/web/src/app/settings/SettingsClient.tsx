"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  type ApiKeysSettings,
  type AppearanceSettings,
  type IbmConnectionSettings,
  type IbmSmokeTestResult,
  type NotificationSettings,
  type PipelineSettings,
  type PrivacySettings,
  type ProfileSettings,
  type QuantumSettings,
  type UserSettings,
  fetchSettings,
  saveSettings as saveSettingsRemote,
  smokeTestIbmConnection as smokeTestIbmConnectionRemote,
  validateIbmConnection as validateIbmConnectionRemote,
} from "@/lib/api/client";
import type { InitialSettings } from "@/lib/data/fetchSettingsServer";
import { DEFAULT_SETTINGS } from "@/lib/settings/defaults";
import { citationLine, versionLabel } from "@/lib/branding";
import { isLiteMode, useRemoteApiInLite } from "@/lib/liteMode";

const IS_LITE = isLiteMode();
const LITE_REMOTE_API = IS_LITE && useRemoteApiInLite();
const LITE_LOCALSTORAGE_KEY = "hetqml.liteSettings";

/** localStorage-backed save used by the lite (HF Space) build. The
 * static export has no `/settings` endpoint to PUT to, so changes are
 * persisted to the browser only. The promise still resolves with the
 * round-tripped draft so the UI's saved-status flow stays the same. */
async function saveSettingsLite(draft: UserSettings): Promise<UserSettings> {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        LITE_LOCALSTORAGE_KEY,
        JSON.stringify(draft),
      );
    } catch {
      /* quota / private-mode — ignore, the in-memory draft still applies */
    }
  }
  return draft;
}

/** Lite stub for validateIbmConnection.
 *
 * Honesty fix: previously this flipped `validated: true` so the form's green
 * "✓ Connected" pill lit up — but no IBM round-trip ever happened, so the
 * user could trust a fake green light. Now the lite path:
 *
 *   - Persists the credential edits to localStorage (so refresh keeps them).
 *   - **Leaves `validated: false`** because nothing was actually checked.
 *   - Tags `instanceName` with a `(demo · not verified)` suffix when blank,
 *     so the row never reads as "verified instance".
 *
 * The UI also surfaces a dedicated "lite mode — validation unavailable"
 * notice next to the button so the disabled state is explained, not just
 * silent.
 */
async function validateIbmConnectionLite(
  draft: UserSettings,
): Promise<UserSettings> {
  const updated: UserSettings = {
    ...draft,
    ibmConnection: {
      ...draft.ibmConnection,
      validated: false,
      planTier: draft.ibmConnection.planTier ?? "demo",
      instanceName:
        draft.ibmConnection.instanceName ?? "hetqml-lite (demo · not verified)",
    },
  };
  return saveSettingsLite(updated);
}

/** When lite + no remote API only: localStorage + fake IBM validate. */

const saveSettings: (draft: UserSettings) => Promise<UserSettings> =
  IS_LITE && !LITE_REMOTE_API ? saveSettingsLite : saveSettingsRemote;

// The remote validateIbmConnection takes no arguments — the FastAPI route
// reads the persisted draft from the database. Wrap it to share the
// `(draft) => Promise<UserSettings>` signature with the lite shim so call
// sites don't need to know which build target they are in.
const validateIbmConnection: (draft: UserSettings) => Promise<UserSettings> =
  IS_LITE && !LITE_REMOTE_API
    ? validateIbmConnectionLite
    : (_draft: UserSettings) => validateIbmConnectionRemote();

const smokeTestIbmConnectionImpl: () => Promise<IbmSmokeTestResult> =
  IS_LITE && !LITE_REMOTE_API
    ? async () => {
        throw new Error(
          "Enable NEXT_PUBLIC_LITE_REMOTE_API and NEXT_PUBLIC_API_URL for smoke test.",
        );
      }
    : () => smokeTestIbmConnectionRemote();

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

/* ---------- Settings JSON validator ----------------------------------- */

/**
 * Recursively validates an unknown payload against the DEFAULT_SETTINGS
 * shape. Returns either the parsed UserSettings or an error string
 * describing the first mismatch found. Used by the Import action to refuse
 * malformed JSON instead of silently overwriting the live document.
 *
 * The check is structural: every key present in DEFAULT_SETTINGS must
 * appear in the payload with a value whose primitive type matches.
 * `null` is allowed wherever the default is `null` (apiKeys fields,
 * IBM planTier / instanceName).
 */
function validateUserSettings(payload: unknown): UserSettings | { error: string } {
  if (typeof payload !== "object" || payload === null) {
    return { error: "expected a JSON object at the top level" };
  }
  const out: Record<string, unknown> = {};
  for (const [groupKey, groupDefault] of Object.entries(
    DEFAULT_SETTINGS as unknown as Record<string, Record<string, unknown>>,
  )) {
    const groupVal = (payload as Record<string, unknown>)[groupKey];
    if (typeof groupVal !== "object" || groupVal === null) {
      return { error: `missing or invalid section "${groupKey}"` };
    }
    const groupOut: Record<string, unknown> = {};
    for (const [fieldKey, defaultFieldVal] of Object.entries(groupDefault)) {
      const incoming = (groupVal as Record<string, unknown>)[fieldKey];
      if (incoming === undefined) {
        return {
          error: `missing field "${groupKey}.${fieldKey}"`,
        };
      }
      // null is acceptable iff the default is null
      if (incoming === null) {
        if (defaultFieldVal === null) {
          groupOut[fieldKey] = null;
          continue;
        }
        return {
          error: `field "${groupKey}.${fieldKey}" cannot be null`,
        };
      }
      // Primitive type match against the default. Where the default is
      // null, accept whatever string / number primitive the payload offers
      // — those are the BYOK / IBM optional-string fields.
      const expected = defaultFieldVal === null ? typeof incoming : typeof defaultFieldVal;
      if (typeof incoming !== expected) {
        return {
          error: `field "${groupKey}.${fieldKey}" expected ${expected}, got ${typeof incoming}`,
        };
      }
      groupOut[fieldKey] = incoming;
    }
    out[groupKey] = groupOut;
  }
  return out as unknown as UserSettings;
}

function timestampForFilename(): string {
  // 2026-05-05T14-32-08 — filesystem-safe, sortable.
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
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
  const [smokeTesting, setSmokeTesting] = useState(false);
  const [smokeError, setSmokeError] = useState<string | null>(null);
  const [smokeResult, setSmokeResult] = useState<IbmSmokeTestResult | null>(
    null,
  );
  const [importError, setImportError] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Lite (HF Space): rehydrate from localStorage so a refresh preserves
  // the user's edits. Runs once after mount; if the stored payload is
  // invalid we silently keep the schema-default `initial` instead.
  useEffect(() => {
    if (!IS_LITE || LITE_REMOTE_API || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(LITE_LOCALSTORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as UserSettings;
      setBase(parsed);
      setDraft(parsed);
    } catch {
      /* malformed payload — stick with defaults */
    }
  }, []);

  useEffect(() => {
    if (!LITE_REMOTE_API || typeof window === "undefined") return;
    let cancel = false;
    void fetchSettings()
      .then((settings) => {
        if (cancel) return;
        setBase(settings);
        setDraft(settings);
        setStatus({ kind: "idle" });
      })
      .catch((e) => {
        if (cancel) return;
        setStatus({
          kind: "error",
          message: `Settings API: ${e instanceof Error ? e.message : String(e)}`,
        });
      });
    return () => {
      cancel = true;
    };
  }, []);

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
      const updated = await validateIbmConnection(target);
      setBase(updated);
      setDraft(updated);
      setStatus({ kind: "saved", at: new Date() });
    } catch (e) {
      setValidateError(e instanceof Error ? e.message : String(e));
    } finally {
      setValidating(false);
    }
  }, [base, draft]);

  const onSmokeTestIbm = useCallback(async () => {
    if (IS_LITE && !LITE_REMOTE_API) return;
    setSmokeTesting(true);
    setSmokeError(null);
    setSmokeResult(null);
    try {
      if (!eq(base.ibmConnection, draft.ibmConnection)) {
        const saved = await saveSettings(draft);
        setBase(saved);
        setDraft(saved);
      }
      const result = await smokeTestIbmConnectionImpl();
      setSmokeResult(result);
    } catch (e) {
      setSmokeError(e instanceof Error ? e.message : String(e));
    } finally {
      setSmokeTesting(false);
    }
  }, [base, draft]);

  /* ---------- Export · Import · Reset ----- */

  // Snapshot the *current draft* (what the user sees) so a partially-edited
  // form can still be exported. Filename includes a sortable timestamp.
  const onExportSettings = useCallback(() => {
    try {
      const json = JSON.stringify(draft, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hetqml-settings-${timestampForFilename()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Defer revoke so Safari has time to start the download.
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setImportError(null);
      setImportNotice("exported current draft");
      window.setTimeout(() => setImportNotice(null), 2500);
    } catch (e) {
      setImportError(
        `export failed — ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }, [draft]);

  // Stage the import into `draft` (does NOT auto-save). The user can then
  // review the imported values and click Save changes to commit, matching
  // the existing dirty-tracking flow.
  const onImportFileSelected = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      // Reset the input value so picking the same file twice still fires
      // onChange.
      event.target.value = "";
      if (!file) return;
      setImportError(null);
      setImportNotice(null);
      try {
        const text = await file.text();
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch (e) {
          setImportError(
            `invalid JSON — ${e instanceof Error ? e.message : String(e)}`,
          );
          return;
        }
        const result = validateUserSettings(parsed);
        if ("error" in result) {
          setImportError(`schema mismatch — ${result.error}`);
          return;
        }
        setDraft(result);
        setStatus({ kind: "idle" });
        setImportNotice(
          `imported "${file.name}" — review the form, then Save changes`,
        );
        window.setTimeout(() => setImportNotice(null), 4000);
      } catch (e) {
        setImportError(
          `import failed — ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    },
    [],
  );

  const onTriggerImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Stages defaults into `draft`. User must Save to commit, which keeps
  // server-side decisions / sessions / notes untouched (those live in
  // separate tables and are not part of UserSettings).
  const onResetToDefaults = useCallback(() => {
    const ok = window.confirm(
      "Reset all settings to defaults?\n\n" +
        "This stages the default values into the form. Your existing " +
        "decisions, sessions, and skeptic notes are not touched. Click " +
        "Save changes to commit.",
    );
    if (!ok) return;
    setDraft(DEFAULT_SETTINGS);
    setStatus({ kind: "idle" });
    setImportError(null);
    setImportNotice("reset to defaults — review and Save to commit");
    window.setTimeout(() => setImportNotice(null), 4000);
  }, []);

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
            {IS_LITE
              ? "Three sections of the full settings surface — your reviewer profile, pipeline defaults, and IBM Quantum credentials. Changes save to your browser only (this static demo has no backend); the full version persists every field server-side."
              : "Settings persist server-side and apply to every investigation, run, and export. Edit any field and click "}
            {IS_LITE ? null : <strong>Save changes</strong>}
            {IS_LITE
              ? null
              : " to commit. The IBM connection panel has a dedicated validator."}
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

      {IS_LITE ? (
        // Lite (HF Space) layout — keep only the three panels that are
        // meaningful without a backend: identity (Profile), pipeline /
        // quantum defaults (matching the full app's two-column pairing),
        // and IBM Quantum BYOK fields. The rest [...]
        // (Appearance, Quantum, Notifications, Privacy, the secondary
        // API Keys, Keyboard Shortcuts, About) are server-bound or
        // operationally meaningless in a static demo and would just
        // pad the page.
        <>
          <ProfilePanel
            value={draft.profile}
            onChange={(patch) => update("profile", patch)}
            dirty={dirtyKeys.has("profile")}
          />
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
          <IbmConnectionPanel
            value={draft.ibmConnection}
            onChange={(patch) => update("ibmConnection", patch)}
            dirty={dirtyKeys.has("ibmConnection")}
            validating={validating}
            onValidate={onValidateIbm}
            validateError={validateError}
            smokeTesting={LITE_REMOTE_API ? smokeTesting : undefined}
            smokeError={LITE_REMOTE_API ? smokeError : undefined}
            smokeResult={LITE_REMOTE_API ? smokeResult : undefined}
            onSmokeTest={LITE_REMOTE_API ? onSmokeTestIbm : undefined}
            badgeLabel={ibmBadgeLabel}
            badgeColor={ibmBadgeColor}
            lite={!LITE_REMOTE_API}
          />
        </>
      ) : (
        <>
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
            smokeTesting={smokeTesting}
            smokeError={smokeError}
            smokeResult={smokeResult}
            onSmokeTest={onSmokeTestIbm}
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
        </>
      )}

      {IS_LITE ? null : <div className="how-to">
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
      </div>}

      {importError ? (
        <div
          className="skeptic-warning"
          role="alert"
          style={{ marginTop: 14, borderColor: "var(--sienna)" }}
        >
          Import: {importError}
        </div>
      ) : null}

      {importNotice ? (
        <div
          className="skeptic-warning"
          style={{
            marginTop: 14,
            borderColor: "var(--green)",
            color: "var(--green)",
          }}
        >
          {importNotice}
        </div>
      ) : null}

      <div className="footer-actions">
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
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
          <span
            aria-hidden="true"
            style={{
              width: 1,
              height: 20,
              background: "var(--faint)",
              opacity: 0.3,
              margin: "0 4px",
            }}
          />
          <button
            type="button"
            className="btn"
            onClick={onExportSettings}
            title="Download current form as JSON"
          >
            ↓ Export settings
          </button>
          <button
            type="button"
            className="btn"
            onClick={onTriggerImport}
            title="Load settings from a JSON file (validates before applying)"
          >
            ↑ Import settings
          </button>
          <button
            type="button"
            className="btn"
            onClick={onResetToDefaults}
            title="Stage factory defaults into the form (preserves decisions / sessions / notes)"
          >
            ↺ Reset to defaults
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={onImportFileSelected}
            style={{ display: "none" }}
            aria-hidden="true"
            tabIndex={-1}
          />
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
        <div className="settings-row">
          <div className="settings-label">ORCID iD</div>
          <input
            className="settings-input"
            type="text"
            inputMode="numeric"
            placeholder="0000-0000-0000-0000"
            value={value.orcid}
            onChange={(e) => onChange({ orcid: e.target.value })}
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
            <option value="4096">4,096 (default)</option>
            <option value="8192">8,192</option>
            <option value="16384">16,384</option>
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
  smokeTesting,
  smokeError,
  smokeResult,
  onSmokeTest,
  badgeLabel,
  badgeColor,
  lite,
}: {
  value: IbmConnectionSettings;
  onChange: (patch: Partial<IbmConnectionSettings>) => void;
  dirty: boolean;
  validating: boolean;
  onValidate: () => void;
  validateError: string | null;
  smokeTesting?: boolean;
  smokeError?: string | null;
  smokeResult?: IbmSmokeTestResult | null;
  onSmokeTest?: () => void;
  badgeLabel: string;
  badgeColor: string;
  /** Lite layout — hide the instance-name / plan-tier rows, leaving
   * just API token + CRN + the validate action. The full version
   * keeps all four for operational diligence. */
  lite?: boolean;
}) {
  // BYOK IBM Quantum API token. Persisted to the backend (sqlite settings
  // table) so the job runner can read it when family=quantum and submit
  // to IBM hardware. Reflected back through the normal `ibmConnection`
  // panel value so dirty-tracking + Save changes work the same as every
  // other field.
  const token = value.apiToken;
  const updateToken = (next: string) => onChange({ apiToken: next });

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
        + <strong>CRN</strong> identify and bill the IBM Cloud quantum-instance.
        {lite
          ? " In this static demo, both fields save to your browser only — there's no backend to submit real-hardware jobs from. Plug them in to feel the flow; nothing leaves the page."
          : " Both are persisted server-side in the dashboard sqlite store so the job runner can submit real-hardware jobs when you pick the Quantum run path. Empty token → runner falls back to the local Aer simulator."}
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
        {lite ? null : (
          <>
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
                onChange={(e) =>
                  onChange({ planTier: e.target.value || null })
                }
              />
            </div>
          </>
        )}
        <div className="settings-row">
          <div className="settings-label">Connection</div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              flex: 1,
              minWidth: 0,
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <button
                type="button"
                className="btn"
                onClick={onValidate}
                disabled={validating || (smokeTesting ?? false)}
              >
                {validating ? "Validating…" : "⌥ Validate connection"}
              </button>
              {lite || !onSmokeTest ? null : (
                <button
                  type="button"
                  className="btn"
                  onClick={onSmokeTest}
                  disabled={validating || (smokeTesting ?? false)}
                  title="Runs a 1-qubit sampler job on IBM (may queue on hardware)."
                >
                  {smokeTesting ? "Smoke test…" : "⌥ Run smoke test"}
                </button>
              )}
              <span
                style={{
                  fontSize: 11,
                  color: validateError
                    ? "var(--sienna)"
                    : lite
                      ? "var(--gold)"
                      : value.validated
                        ? "var(--green)"
                        : "var(--faint)",
                  fontFamily: "monospace",
                }}
              >
                {validateError
                  ? `— ${validateError}`
                  : lite
                    ? "— lite mode · NOT validated against IBM (no FastAPI to call)"
                    : value.validated
                      ? `— validated · ${value.planTier ?? "no plan"}`
                      : "— not validated"}
              </span>
            </div>
            {lite ? (
              <span
                style={{
                  fontSize: 11,
                  color: "var(--faint)",
                  fontFamily: "monospace",
                  wordBreak: "break-word",
                }}
              >
                Validate stores credentials in your browser only. Hetionet Full
                runs a real IBM Quantum probe via FastAPI before flipping the
                connected pill — switch to the linked build to verify.
              </span>
            ) : null}
            {lite || (!smokeError && !smokeResult) ? null : (
              <span
                style={{
                  fontSize: 11,
                  color: smokeError ? "var(--sienna)" : "var(--green)",
                  fontFamily: "monospace",
                  wordBreak: "break-word",
                }}
              >
                {smokeError
                  ? `smoke: ${smokeError}`
                  : smokeResult
                    ? `smoke: ${smokeResult.message} · ${smokeResult.outcomeSummary} · ${smokeResult.backend}${smokeResult.simulator ? " (sim)" : ""} · ${smokeResult.shots} shots · ${smokeResult.elapsedMs}ms · ${smokeResult.runtimeJobId}`
                    : null}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="panel-footer">
        <span>{lite ? "ibm_quantum · browser-only (demo)" : "ibm_quantum · sqlite-persisted"}</span>
        <span>
          <em>
            {lite
              ? "fields save to localStorage; no calls leave this page"
              : "token + CRN read by runner when family=quantum"}
          </em>
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
    ["Version", versionLabel()],
    ["Build", process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev"],
    ["Hetionet", "v1.0 · DOI 10.7554/eLife.26726"],
    ["License", "Apache 2.0 (dashboard) · CC0 1.0 (Hetionet data)"],
    ["Repository", "github.com/quantumGlobalGroup/acm"],
    ["Citation", citationLine()],
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
