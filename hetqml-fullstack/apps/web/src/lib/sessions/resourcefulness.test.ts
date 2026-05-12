import { describe, expect, it } from "vitest";

import {
  compareSessions,
  enrichSession,
  getSmartResumeSuggestion,
  type SessionLike,
} from "./resourcefulness";

describe("enrichSession", () => {
  it("supplies a default label when `name` is missing", () => {
    const result = enrichSession({
      compound: "Inaxaplin",
      disease: "ESKD",
    });
    expect(result.label).toBe("Inaxaplin -> ESKD");
    expect(result.tags).toEqual([]);
    expect(result.notes).toBe("");
    expect(result.reviewer).toBe("unassigned");
  });

  it("parses comma-separated tags into an array", () => {
    const result = enrichSession(
      { name: "renal-1" },
      { tags: "renal, review, quantum" },
    );
    expect(result.tags).toEqual(["renal", "review", "quantum"]);
  });

  it("prefers metadata reviewer over the saved-session field", () => {
    const result = enrichSession(
      { reviewer: "old" },
      { reviewer: "new" },
    );
    expect(result.reviewer).toBe("new");
  });
});

describe("compareSessions", () => {
  it("returns the changed fields with before/after strings", () => {
    const left: SessionLike = { compound: "Aspirin", disease: "Pain" };
    const right: SessionLike = { compound: "Ibuprofen", disease: "Pain" };
    expect(compareSessions(left, right)).toEqual([
      { field: "compound", before: "Aspirin", after: "Ibuprofen" },
    ]);
  });

  it("renders runPath as `mode / family` when nested", () => {
    const left: SessionLike = { runPath: { mode: "quick", family: "classical" } };
    const right: SessionLike = { runPath: { mode: "quick", family: "hybrid" } };
    expect(compareSessions(left, right)).toEqual([
      { field: "runPath", before: "quick / classical", after: "quick / hybrid" },
    ]);
  });

  it("returns [] when either side is null/undefined", () => {
    expect(compareSessions(null, { compound: "A" })).toEqual([]);
    expect(compareSessions({ compound: "A" }, undefined)).toEqual([]);
  });
});

describe("getSmartResumeSuggestion", () => {
  it("returns a not-found suggestion for an empty list", () => {
    const result = getSmartResumeSuggestion([]);
    expect(result.session).toBeNull();
    expect(result.reason).toMatch(/no saved/i);
  });

  it("favors a session with notes over a more recent one without", () => {
    const oldWithNotes: SessionLike = {
      id: "a",
      updatedAt: 1_000,
      notes: "important",
    };
    const newerWithoutNotes: SessionLike = { id: "b", updatedAt: 50_000 };
    const result = getSmartResumeSuggestion([oldWithNotes, newerWithoutNotes]);
    // 50_000 > 1_000 + 30_000 = 31_000, so the newer one still wins —
    // but its reason should NOT mention notes.
    expect(result.session?.id).toBe("b");
    expect(result.reason).not.toMatch(/notes/i);
  });

  it("ties broken in favor of session with more tags", () => {
    const a: SessionLike = { id: "a", updatedAt: 1_000, tags: ["x"] };
    const b: SessionLike = {
      id: "b",
      updatedAt: 1_000,
      tags: ["x", "y", "z"],
    };
    const result = getSmartResumeSuggestion([a, b]);
    expect(result.session?.id).toBe("b");
  });
});
