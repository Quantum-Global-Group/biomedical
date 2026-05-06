import { AppShell } from "@/components/shell/AppShell";
import { fetchJobForServerComponent } from "@/lib/data/fetchJobServer";
import { VisualizeClient } from "./VisualizeClient";

interface PageProps {
  // Next 16 — searchParams is async.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function VisualizePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const raw = params.jobId;
  const jobIdFromUrl = Array.isArray(raw) ? raw[0] : raw ?? null;

  const initialJob = jobIdFromUrl
    ? await fetchJobForServerComponent(jobIdFromUrl)
    : null;

  return (
    <AppShell active="/visualize">
      <VisualizeClient
        jobIdFromUrl={jobIdFromUrl ?? null}
        initialJob={initialJob}
      />
    </AppShell>
  );
}
