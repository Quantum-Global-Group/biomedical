import type { Selection } from "@/lib/investigation/recommendations";
import type { RunPathChoice } from "@/lib/investigation/runPath";

export const SESSIONS_KEY = "hetqml.sessions";

export interface StoredSession {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  selection: Selection;
  runPath: RunPathChoice;
}

function parse(raw: string | null): StoredSession[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as unknown;
    return Array.isArray(data) ? (data as StoredSession[]) : [];
  } catch {
    return [];
  }
}

export function loadSessions(): StoredSession[] {
  if (typeof window === "undefined") return [];
  return parse(window.localStorage.getItem(SESSIONS_KEY)).sort(
    (a, b) => b.updatedAt - a.updatedAt,
  );
}

export function persistSessions(sessions: StoredSession[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

export function appendSession(
  name: string,
  selection: Selection,
  runPath: RunPathChoice,
): StoredSession {
  const sessions = loadSessions();
  const now = Date.now();
  const entry: StoredSession = {
    id: `s_${now}`,
    name,
    createdAt: now,
    updatedAt: now,
    selection: { ...selection },
    runPath: { ...runPath },
  };
  persistSessions([entry, ...sessions]);
  return entry;
}

export function removeSession(id: string) {
  persistSessions(loadSessions().filter((s) => s.id !== id));
}

export function clearAllSessions() {
  persistSessions([]);
}
