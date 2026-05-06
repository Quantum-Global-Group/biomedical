import { AppShell } from "@/components/shell/AppShell";
import { isLiteMode } from "@/lib/liteMode";
import { fetchSettingsForServerComponent } from "@/lib/data/fetchSettingsServer";
import { SETTINGS_LITE_DEMO } from "@/lib/settings/defaults";
import { SettingsClient } from "./SettingsClient";

// Settings renders in both build targets:
//   - Standalone (full): server fetches /settings, hydrates the form.
//   - Lite (HF Space, static export): no backend at build time, so we
//     SETTINGS_LITE_DEMO so the IBM panel matches Operations fixtures; the client
//     swaps its save/validate calls for localStorage-only persistence
//     when isLiteMode() is true (see SettingsClient.tsx).
//
// Next 16 forbids expression-valued `dynamic` exports, so the lite branch
// short-circuits before any `await fetch` — see settings docstring on
// fetchSettingsServer.ts for the original rationale.
export default async function SettingsPage() {
  if (isLiteMode()) {
    return (
      <AppShell active="/settings">
        <SettingsClient
          initial={{
            source: "fallback",
            settings: SETTINGS_LITE_DEMO,
            error: null,
          }}
        />
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
