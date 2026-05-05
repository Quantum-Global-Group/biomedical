import { AppShell } from "@/components/shell/AppShell";
import { PreregistrationBanner } from "@/components/PreregistrationBanner";
import { ValidateClient } from "./ValidateClient";

export default function ValidatePage() {
  return (
    <AppShell active="/validate">
      <PreregistrationBanner page="validate" />
      <ValidateClient />
    </AppShell>
  );
}
