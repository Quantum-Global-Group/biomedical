/**
 * Lite-mode helpers.
 *
 * The "lite" build target (BUILD_TARGET=lite) produces a fully static
 * export for Hugging Face Space deployment with no live backend. It
 * inlines NEXT_PUBLIC_LITE_MODE="true" into the client bundle (see
 * next.config.mjs); read via the helpers here rather than touching
 * process.env directly so consumers stay easy to test.
 *
 * Server components and client components both call `isLiteMode()` —
 * Next inlines `process.env.NEXT_PUBLIC_LITE_MODE` at build time, so
 * the call is constant-folded and shouldn't carry a runtime cost.
 */

export function isLiteMode(): boolean {
  // Direct comparison so the bundler can constant-fold this when the
  // env var is statically inlined at build time.
  return process.env.NEXT_PUBLIC_LITE_MODE === "true";
}

/** Used inside lite-mode UI — short string for sidebars / pills. */
export const LITE_BADGE_LABEL = "Demo · HF Space";

/**
 * What lite-mode visitors should know up-front. Used as the banner copy
 * on the Operations + Settings unavailable panels and (optionally) at
 * the top of the sidebar.
 */
export const LITE_BANNER_BODY =
  "Hetionet Lite is a public static build — no backend, no IBM auth, no decision " +
  "logging. Initialize / Experiment / Validate render with mock data so " +
  "you can click through the workflow. Hetionet Full (live FastAPI + " +
  "IBM Quantum BYOK + decision audit) is the Fly.io / internal deployment.";
