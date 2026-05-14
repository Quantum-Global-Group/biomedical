import { AppShell } from "@/components/shell/AppShell";
import { PreregistrationBanner } from "@/components/PreregistrationBanner";
import { DemoGalleryClient } from "./DemoGalleryClient";

export default function DemoPage() {
  return (
    <AppShell active="/demo">
      <PreregistrationBanner page="experiment" />
      <DemoGalleryClient />
    </AppShell>
  );
}
