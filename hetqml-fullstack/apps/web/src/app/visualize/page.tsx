import { AppShell } from "@/components/shell/AppShell";
import { VisualizeClient } from "./VisualizeClient";

export default function VisualizePage() {
  return (
    <AppShell active="/visualize">
      <VisualizeClient />
    </AppShell>
  );
}
