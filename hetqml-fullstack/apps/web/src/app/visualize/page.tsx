import { AppShell } from "@/components/shell/AppShell";
import { fetchJobForServerComponent } from "@/lib/data/fetchJobServer";
import { isLiteMode } from "@/lib/liteMode";
import { VisualizeClient } from "./VisualizeClient";
import { VisualizeLite } from "./VisualizeLite";

interface PageProps {
  // Next 16 — searchParams is async.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// Lite (output: "export") build short-circuits before `await searchParams`
// so the route prerenders fully static and `VisualizeClient` is tree-shaken
// out of the lite bundle. The full visualizer pulls three.js (3D KG,
// molecule viewer) plus the quantum-circuit renderer; lite renders a
// 3-panel demo (path / evidence matrix / model agreement) using static
// fixtures instead.
//
// Next 16 forbids expression-valued `dynamic` exports — see
// settings/page.tsx for the same two-build pattern using a
// constant-folded `isLiteMode()` guard.
export default async function VisualizePage({ searchParams }: PageProps) {
  if (isLiteMode()) {
    return (
      <AppShell active="/visualize">
        <VisualizeLite />
      </AppShell>
    );
  }

  const params = await searchParams;
  const raw = params.jobId;
  const jobIdFromUrl = Array.isArray(raw) ? raw[0] : raw ?? null;

  // If the URL carries a jobId, hydrate the client with the server-side
  // fetch so SSR renders the actual panels (not a loading skeleton).
  // localStorage fallback still happens client-side in VisualizeClient.
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
