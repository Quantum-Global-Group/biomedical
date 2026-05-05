import { AppShell } from "@/components/shell/AppShell";
import { ExperimentClient } from "./ExperimentClient";

export default function ExperimentPage() {
  return (
    <AppShell active="/experiment">
      <ExperimentClient />
    </AppShell>
  );
}
