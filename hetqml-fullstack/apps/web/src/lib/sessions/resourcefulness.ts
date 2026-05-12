/**
 * Session resourcefulness — pure logic ported from
 * `hetqml-pages/assets/session-resourcefulness.js`.
 *
 * The static export's "More resourceful save and resume" panel mounted via
 * MutationObserver and rendered template strings into the DOM. In the Next
 * port the React tree owns the rendering, so only the pure helpers were
 * kept: `enrichSession`, `compareSessions`, `getSmartResumeSuggestion`. The
 * DOM mounting (`mountSessionResourcefulness`, `injectStyles`,
 * `rerender`) was discarded.
 *
 * Wire shape stays compatible with `lib/sessions/storage.ts` so a saved
 * session can be enriched in place before display.
 */

export interface SessionLike {
  id?: string;
  name?: string;
  compound?: string | null;
  disease?: string | null;
  gene?: string | null;
  metaedge?: string | null;
  runPath?: string | { mode?: string; family?: string } | null;
  reviewer?: string | null;
  notes?: string | null;
  tags?: string[] | string | null;
  updatedAt?: number;
  savedAt?: number;
  createdAt?: number;
  ts?: number;
}

export interface SessionMetadata {
  reviewer?: string;
  notes?: string;
  tags?: string[] | string;
}

export interface EnrichedSession extends SessionLike {
  label: string;
  notes: string;
  tags: string[];
  reviewer: string;
}

export interface SessionDiff {
  field: string;
  before: string;
  after: string;
}

export interface ResumeSuggestion {
  session: EnrichedSession | null;
  reason: string;
}

const COMPARE_FIELDS = ["compound", "disease", "gene", "metaedge", "runPath"] as const;

function parseTags(value: string[] | string | null | undefined): string[] {
  if (Array.isArray(value)) {
    return value.map((tag) => String(tag).trim()).filter(Boolean);
  }
  return String(value ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function sessionTime(session: SessionLike): number {
  return Number(
    session.updatedAt ?? session.savedAt ?? session.createdAt ?? session.ts ?? 0,
  );
}

function fieldValue(session: SessionLike, field: string): string {
  const raw = (session as Record<string, unknown>)[field];
  if (raw == null) return "";
  if (typeof raw === "object") {
    // runPath may arrive as `{ mode, family }` — render both.
    const obj = raw as { mode?: string; family?: string };
    return [obj.mode, obj.family].filter(Boolean).join(" / ");
  }
  return String(raw);
}

/**
 * Attach derived label/notes/tags/reviewer to a saved session so the UI
 * can render it without per-call defaulting. Idempotent — calling
 * `enrichSession` on an already-enriched session returns the same shape.
 */
export function enrichSession(
  session: SessionLike,
  metadata: SessionMetadata = {},
): EnrichedSession {
  const tags = parseTags(metadata.tags ?? session.tags ?? null);
  const notes = String(metadata.notes ?? session.notes ?? "").trim();
  const compound = session.compound ?? "Candidate";
  const disease = session.disease ?? "Disease";
  const label = session.name ?? `${compound} -> ${disease}`;
  return {
    ...session,
    label,
    notes,
    tags,
    reviewer: metadata.reviewer ?? session.reviewer ?? "unassigned",
  };
}

/**
 * Diff two sessions on the comparable fields. Returns an array of changed
 * fields with their before/after strings. Returns `[]` when either side
 * is null — defensive against an empty session list.
 */
export function compareSessions(
  left: SessionLike | null | undefined,
  right: SessionLike | null | undefined,
): SessionDiff[] {
  if (!left || !right) return [];
  return COMPARE_FIELDS.filter(
    (field) => fieldValue(left, field) !== fieldValue(right, field),
  ).map((field) => ({
    field,
    before: fieldValue(left, field) || "not set",
    after: fieldValue(right, field) || "not set",
  }));
}

/**
 * Heuristic ranking that surfaces the "most ready to resume" session.
 * Score = recency + bonus for notes + bonus per tag. The tie-break is
 * stable on `updatedAt` so two equivalent sessions get the same suggestion
 * across renders.
 */
export function getSmartResumeSuggestion(
  sessions: SessionLike[],
): ResumeSuggestion {
  const enriched = sessions.map((session) => enrichSession(session));
  if (enriched.length === 0) {
    return {
      session: null,
      reason:
        "No saved sessions yet. Save a snapshot to make resume suggestions useful.",
    };
  }
  const ranked = [...enriched].sort((a, b) => {
    const aScore = sessionTime(a) + (a.notes ? 30_000 : 0) + a.tags.length * 10_000;
    const bScore = sessionTime(b) + (b.notes ? 30_000 : 0) + b.tags.length * 10_000;
    return bScore - aScore;
  });
  // `enriched.length === 0` is handled above, so `ranked` always has at
  // least one entry. Pull it out into a typed local so `noUncheckedIndexed
  // Access` doesn't insist `ranked[0]` is `T | undefined`.
  const top = ranked[0] as EnrichedSession;
  return {
    session: top,
    reason: top.notes
      ? "Most recent session with notes, so it is likely ready to resume."
      : "Most recent saved investigation.",
  };
}
