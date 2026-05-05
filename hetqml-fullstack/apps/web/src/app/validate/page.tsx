import { AppShell } from "@/components/shell/AppShell";
import { ValidateClient } from "./ValidateClient";

export default function ValidatePage() {
  return (
    <AppShell active="/validate">
      <ValidateClient />
    </AppShell>
  );
}
