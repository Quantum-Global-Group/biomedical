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

/** Lite export built with HF ↔ Fly linkage: hits `NEXT_PUBLIC_API_URL` like full. */
export function useRemoteApiInLite(): boolean {
  return process.env.NEXT_PUBLIC_LITE_REMOTE_API === "true";
}

/** Static demo lite (fixtures + localStorage) — opposite of linked backend. */
export function isLiteStaticDemo(): boolean {
  return isLiteMode() && !useRemoteApiInLite();
}

export const LITE_BACKEND_LINKED_BODY =
  "This build is linked to the HetQML API (`NEXT_PUBLIC_API_URL`). Operations polls " +
  "live feeds; Settings saves to the server SQLite store and IBM validate / smoke test " +
  "call FastAPI — same as Hetionet Full. Ensure CORS allows this origin and avoid " +
  "production secrets unless you intend to.";

/** Used inside lite-mode UI — short string for sidebars / pills. */
export const LITE_BADGE_LABEL = "Demo · HF Space";

/**
 * What lite-mode visitors should know up-front. Used under Operations
 * (HF Space builds) between the metric strip and IBM workload panels, and at
 * the top of the sidebar. Settings no longer swaps in a blocker page — it
 * uses the full form backed by localStorage.
 */
export const LITE_BANNER_BODY =
  "Hetionet Lite is a public static build — no backend, no IBM auth, no decision " +
  "logging. Initialize / Experiment / Validate render with mock data so " +
  "you can click through the workflow. Hetionet Full (live FastAPI + " +
  "IBM Quantum BYOK + decision audit) is the Fly.io / internal deployment.";
