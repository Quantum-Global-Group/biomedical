/**
 * Schema-faithful defaults for the Settings page.
 *
 * Mirrors `hetqml_api.schemas.UserSettings` field-for-field. Used as the
 * initial state for `useSettings()` (before the server's GET resolves) and
 * as the target for the "Reset to defaults" footer action. Keeping the
 * defaults co-located on the client means a settings PUT never has to
 * fail-open on missing keys.
 */

import type { UserSettings } from "@/lib/api/client";

export const DEFAULT_SETTINGS: UserSettings = {
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

/** HF Space / static-lite initial document: aligns Settings IBM panel with Operations demo fixtures */
export const SETTINGS_LITE_DEMO: UserSettings = {
  ...DEFAULT_SETTINGS,
  profile: {
    reviewerName: "Demo reviewer",
    role: "Space visitor",
    organization: "(Hugging Face demo)",
    contactEmail: "",
    orcid: "",
  },
  ibmConnection: {
    apiToken: "",
    crn: "crn:v1:bluemix:public:quantum-computing:us-east:a/demo:c4d89e11::",
    validated: true,
    planTier: "open",
    instanceName: "hetqml_hf_demo",
  },
};
