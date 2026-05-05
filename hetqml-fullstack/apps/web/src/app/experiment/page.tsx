import { AppShell } from "@/components/shell/AppShell";
import { PreregistrationBanner } from "@/components/PreregistrationBanner";
import { ExperimentClient } from "./ExperimentClient";

export default function ExperimentPage() {
  return (
    <AppShell active="/experiment">
      <PreregistrationBanner page="experiment" />
      <ExperimentClient />
    </AppShell>
  );
}
