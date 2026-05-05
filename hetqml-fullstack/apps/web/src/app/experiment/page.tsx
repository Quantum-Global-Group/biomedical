import { AppShell } from "@/components/shell/AppShell";
import { PreregistrationBanner } from "@/components/PreregistrationBanner";
import { fetchJobForServerComponent } from "@/lib/data/fetchJobServer";
import { isLiteMode } from "@/lib/liteMode";
import { ExperimentClient } from "./ExperimentClient";

interface PageProps {
  // Next 16 — searchParams is async.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// `output: "export"` forbids reading searchParams during prerender, and
// `dynamic` must be a static literal (Next 16 — see settings/page.tsx
// note). The lite build short-circuits BEFORE the `await searchParams`
// so the lite tree is fully static; the await stays dead-code on the
// `if (isLiteMode())` branch.
export default async function ExperimentPage({ searchParams }: PageProps) {
  if (isLiteMode()) {
    return (
      <AppShell active="/experiment">
        <PreregistrationBanner page="experiment" />
        <ExperimentClient />
      </AppShell>
    );
  }

  const params = await searchParams;
  const raw = params.jobId;
  const jobIdFromUrl = Array.isArray(raw) ? raw[0] : raw ?? null;

  // If the URL carries a jobId, hydrate the client with the server-side
  // fetch so SSR renders the actual completed view (not a skeleton).
  // localStorage fallback still happens client-side.
  const initialJob = jobIdFromUrl
    ? await fetchJobForServerComponent(jobIdFromUrl)
    : null;

  return (
    <AppShell active="/experiment">
      <PreregistrationBanner page="experiment" />
      <ExperimentClient
        jobIdFromUrl={jobIdFromUrl ?? null}
        initialJob={initialJob}
      />
    </AppShell>
  );
}
