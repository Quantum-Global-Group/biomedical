/**
 * Product naming and release metadata. Lite vs full split at build time
 * via `NEXT_PUBLIC_LITE_MODE` (see `isLiteMode()`).
 */
import { isLiteMode } from "@/lib/liteMode";

export const APP_RELEASE = "v0.7.2";

/** Primary wordmark in sidebar / chrome. */
export function productBrandName(): string {
  return isLiteMode() ? "Hetionet · QML" : "Hetionet Full";
}

/** Secondary line under the wordmark (full app only). */
export function productTagline(): string | null {
  return isLiteMode()
    ? null
    : "Graph-bridged evidence · quantum & classical modeling";
}

/** Browser tab title. */
export function siteTitle(): string {
  return isLiteMode() ? "Hetionet · QML · Demo" : "Hetionet Full";
}

export function siteDescription(): string {
  return isLiteMode()
    ? "Click-through demo of the investigation workflow — static build, mock data."
    : "Research dashboard for Hetionet-informed investigations: evidence, validation, and quantum–classical model inspection.";
}

/** Settings “Version” row and similar. */
export function versionLabel(): string {
  return isLiteMode()
    ? `${APP_RELEASE} · Hetionet · QML (demo)`
    : `${APP_RELEASE} · Hetionet Full`;
}

/** Provenance / citation line in About. */
export function citationLine(): string {
  return isLiteMode()
    ? `Anderson et al. (2026) Hetionet · QML (demo) ${APP_RELEASE}`
    : `Anderson et al. (2026) Hetionet Full ${APP_RELEASE}`;
}
