import { AppShell } from "@/components/shell/AppShell";
import { LiteUnavailablePanel } from "@/components/LiteUnavailablePanel";
import { isLiteMode } from "@/lib/liteMode";
import { fetchSettingsForServerComponent } from "@/lib/data/fetchSettingsServer";
import { SettingsClient } from "./SettingsClient";

// Next 16 requires `dynamic` to be a static string literal — a ternary
// (or any non-literal) trips the route-segment-config validator and 500s
// every route in the app. Two-build behavior is achieved without it:
//
//   - Standalone build: the `await fetch` below is a dynamic data source,
//     so Next renders the page dynamically on each request.
//   - Lite build (output: "export"): `isLiteMode()` constant-folds to
//     `true`, the body returns the `LiteUnavailablePanel` early, the
//     `await fetch` is dead-code eliminated, and the route exports
//     statically without needing an explicit `force-static` directive.
export default async function SettingsPage() {
  // Lite builds have no backend to read/write Settings. Skip the fetch
  // entirely and render the locked panel; SettingsClient is tree-shaken
  // out of the lite bundle when the constant-folded branch is dead.
  if (isLiteMode()) {
    return (
      <AppShell active="/settings">
        <LiteUnavailablePanel page="settings" />
      </AppShell>
    );
  }

  const initial = await fetchSettingsForServerComponent();

  return (
    <AppShell active="/settings">
      <SettingsClient initial={initial} />
    </AppShell>
  );
}
