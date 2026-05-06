/**
 * Product naming and release metadata. Lite vs full split at build time
 * via `NEXT_PUBLIC_LITE_MODE` (see `isLiteMode()`).
 */
import { isLiteMode } from "@/lib/liteMode";

export const APP_RELEASE = "v0.7.2";

/** Primary wordmark in sidebar / chrome. */
export function productBrandName(): string {
  return isLiteMode() ? "Hetionet Lite" : "Hetionet Full";
}

/** Shared SEO / metadata blurb (lite uses the same copy as full; title differs via `siteTitle`). */
const SITE_DESCRIPTION =
  "Research dashboard for Hetionet-informed investigations: evidence, validation, and quantum–classical model inspection.";

const PRODUCT_TAGLINE =
  "Graph-bridged evidence · quantum & classical modeling";

/** Secondary line under the wordmark. */
export function productTagline(): string | null {
  return PRODUCT_TAGLINE;
}

/** Browser tab title. */
export function siteTitle(): string {
  return isLiteMode() ? "Hetionet Lite" : "Hetionet Full";
}

export function siteDescription(): string {
  return SITE_DESCRIPTION;
}

/** Settings “Version” row and similar. */
export function versionLabel(): string {
  return isLiteMode()
    ? `${APP_RELEASE} · Hetionet Lite (demo)`
    : `${APP_RELEASE} · Hetionet Full`;
}

/** Provenance / citation line in About. */
export function citationLine(): string {
  return isLiteMode()
    ? `Anderson et al. (2026) Hetionet Lite (demo) ${APP_RELEASE}`
    : `Anderson et al. (2026) Hetionet Full ${APP_RELEASE}`;
}
