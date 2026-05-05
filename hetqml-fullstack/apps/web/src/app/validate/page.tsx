import { AppShell } from "@/components/shell/AppShell";
import { PreregistrationBanner } from "@/components/PreregistrationBanner";
import { fetchJobForServerComponent } from "@/lib/data/fetchJobServer";
import { isLiteMode } from "@/lib/liteMode";
import { ValidateClient } from "./ValidateClient";

interface PageProps {
  // Next 16 — searchParams is async.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// Lite (output: "export") build short-circuits before `await searchParams`
// so the route prerenders fully static. See settings/page.tsx + experiment/
// page.tsx for the same pattern; Next 16 forbids expression-valued
// `dynamic` exports, so this is the only way to two-build the route.
export default async function ValidatePage({ searchParams }: PageProps) {
  if (isLiteMode()) {
    return (
      <AppShell active="/validate">
        <PreregistrationBanner page="validate" />
        <ValidateClient />
      </AppShell>
    );
  }

  const params = await searchParams;
  const raw = params.jobId;
  const jobIdFromUrl = Array.isArray(raw) ? raw[0] : raw ?? null;

  // Hydrate when the URL carries a jobId so SSR renders the validation
  // panels rather than the EmptyState. localStorage fallback runs client-
  // side in useValidate.
  const initialJob = jobIdFromUrl
    ? await fetchJobForServerComponent(jobIdFromUrl)
    : null;

  return (
    <AppShell active="/validate">
      <PreregistrationBanner page="validate" />
      <ValidateClient
        jobIdFromUrl={jobIdFromUrl ?? null}
        initialJob={initialJob}
      />
    </AppShell>
  );
}
