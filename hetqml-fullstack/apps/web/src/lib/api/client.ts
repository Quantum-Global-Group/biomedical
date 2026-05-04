import type { Selection } from "@/lib/investigation/recommendations";
import type { RunPathChoice } from "@/lib/investigation/runPath";

export type JobStatus = "queued" | "running" | "completed" | "failed";

export interface JobMetrics {
  prAuc: number;
  rocAuc: number;
  brier: number;
  ece: number;
}

export interface Job {
  id: string;
  status: JobStatus;
  selection: Selection;
  runPath: { mode: string; family: string };
  createdAt: string;
  completedAt: string | null;
  metrics: JobMetrics | null;
  error: string | null;
}

function apiBase(): string {
  if (typeof window === "undefined") {
    return process.env.API_INTERNAL_URL ?? "http://localhost:8000";
  }
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let detail: string;
    try {
      detail = (await res.json()).detail ?? res.statusText;
    } catch {
      detail = res.statusText;
    }
    throw new Error(`${res.status} ${detail}`);
  }
  return res.json() as Promise<T>;
}

export interface RunInvestigationInput {
  selection: Selection;
  runPath: RunPathChoice;
}

export function startInvestigation(input: RunInvestigationInput): Promise<Job> {
  return request<Job>("/investigations/run", {
    method: "POST",
    body: JSON.stringify({
      selection: input.selection,
      run_path: {
        mode: input.runPath.mode ?? "quick",
        family: input.runPath.family ?? "hybrid",
      },
    }),
  });
}

export function getJob(id: string): Promise<Job> {
  return request<Job>(`/jobs/${encodeURIComponent(id)}`);
}
