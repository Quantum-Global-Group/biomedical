import "server-only";

import type { UserSettings } from "@/lib/api/client";

export type SettingsSource = "live" | "fallback";

export interface InitialSettings {
  source: SettingsSource;
  settings: UserSettings;
  error: string | null;
}

const REVALIDATE_SECONDS = 30;

function serverApiBase(): string {
  return process.env.API_INTERNAL_URL ?? "http://localhost:8000";
}

/** Mirrors `UserSettings` defaults from `hetqml_api.schemas`. Used as a
 * last-resort fallback so the page can render even when the API is offline.
 * Keep in sync with the Pydantic defaults. */
export const SETTINGS_FALLBACK: UserSettings = {
  profile: {
    reviewerName: "",
    role: "",
    organization: "",
    contactEmail: "",
    orcid: "",
  },
  appearance: {
    theme: "dark",
    accent: "teal",
    density: "comfortable",
    reduceMotion: false,
  },
  pipeline: {
    defaultRunPath: "hybrid",
    defaultMetaedge: "CtD",
    hardNegativeRatio: "1:5",
    strictPosture: true,
    autosaveSessions: true,
  },
  quantum: {
    defaultBackend: "ibm_torino",
    shotsPerCircuit: 4096,
    jobTimeoutSeconds: 1800,
    zneEnabled: true,
    pulseLevelAccess: false,
  },
  ibmConnection: {
    crn: "",
    apiToken: "",
    validated: false,
    planTier: null,
    instanceName: null,
  },
  notifications: {
    email: true,
    slack: false,
    browserPush: false,
    severityThreshold: "warn",
    slackWebhookUrl: "",
  },
  privacy: {
    anonymousUsage: true,
    errorReporting: true,
    crashDiagnostics: false,
    decisionRetentionDays: 365,
  },
  apiKeys: {
    openai: null,
    anthropic: null,
    pubchemPremium: null,
    drugbankPro: null,
    sentryDsn: null,
  },
};

/** Server-side settings fetch with a short revalidate window. Never throws —
 * a partial failure falls back to the schema defaults so the form still
 * renders, and the `error` field surfaces a hint to the client. Pair with
 * `SettingsClient` which owns dirty-state on top of `initial`. */
export async function fetchSettingsForServerComponent(): Promise<InitialSettings> {
  try {
    const res = await fetch(`${serverApiBase()}/settings`, {
      headers: { "content-type": "application/json" },
      next: { revalidate: REVALIDATE_SECONDS, tags: ["settings"] },
    });
    if (!res.ok) {
      return {
        source: "fallback",
        settings: SETTINGS_FALLBACK,
        error: `${res.status} ${res.statusText}`,
      };
    }
    const settings = (await res.json()) as UserSettings;
    return { source: "live", settings, error: null };
  } catch (e) {
    return {
      source: "fallback",
      settings: SETTINGS_FALLBACK,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
