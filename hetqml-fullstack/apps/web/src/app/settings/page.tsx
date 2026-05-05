import { AppShell } from "@/components/shell/AppShell";
import { fetchSettingsForServerComponent } from "@/lib/data/fetchSettingsServer";
import { SettingsClient } from "./SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const initial = await fetchSettingsForServerComponent();

  return (
    <AppShell active="/settings">
      <SettingsClient initial={initial} />
    </AppShell>
  );
}
