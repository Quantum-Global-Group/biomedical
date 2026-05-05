import { AppShell } from "@/components/shell/AppShell";
import { OperationsClient } from "./OperationsClient";

export default function OperationsPage() {
  return (
    <AppShell active="/operations">
      <OperationsClient />
    </AppShell>
  );
}
