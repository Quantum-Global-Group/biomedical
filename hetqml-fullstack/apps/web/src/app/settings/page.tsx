import { StubPage } from "@/components/shell/StubPage";

export default function SettingsPage() {
  return (
    <StubPage
      active="/settings"
      step="06 · SETTINGS"
      title="Preferences"
      blurb="Profile, appearance, pipeline defaults, quantum preferences, notifications, privacy, IBM connection, API keys."
      legacyHref="../hetqml-pages/settings/"
    />
  );
}
