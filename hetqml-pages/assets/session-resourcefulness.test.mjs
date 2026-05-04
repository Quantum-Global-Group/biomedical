import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const moduleSource = await readFile(
  new URL("./session-resourcefulness.js", import.meta.url),
  "utf8",
);
const {
  enrichSession,
  compareSessions,
  getSmartResumeSuggestion,
  renderSessionResourcefulness,
} = await import(`data:text/javascript,${encodeURIComponent(moduleSource)}`);

const baseSession = {
  id: "s1",
  name: "Inaxaplin -> ESKD",
  compound: "Inaxaplin",
  compoundId: "DB12015",
  disease: "Hypertension-attributed ESKD",
  gene: "APOL1",
  metaedge: "CtD",
  runPath: "hybrid",
  reviewer: "reviewer",
  updatedAt: Date.now() - 60_000,
};

test("enriches saved sessions with organization metadata", () => {
  const session = enrichSession(baseSession, { notes: "Ready for validation", tags: "renal, apol1" });

  assert.deepEqual(session.tags, ["renal", "apol1"]);
  assert.equal(session.notes, "Ready for validation");
  assert.equal(session.label, "Inaxaplin -> ESKD");
});

test("compares two saved investigations across the core parameters", () => {
  const changes = compareSessions(baseSession, {
    ...baseSession,
    compound: "Deucravacitinib",
    gene: "TYK2",
    runPath: "quantum",
  });

  assert.deepEqual(
    changes.map((change) => change.field),
    ["compound", "gene", "runPath"],
  );
});

test("suggests the most useful session to resume", () => {
  const suggestion = getSmartResumeSuggestion([
    { ...baseSession, id: "old", updatedAt: Date.now() - 86_400_000, notes: "" },
    { ...baseSession, id: "ready", updatedAt: Date.now() - 10_000, notes: "Needs validation", tags: ["renal"] },
  ]);

  assert.equal(suggestion.session.id, "ready");
  assert.match(suggestion.reason, /recent/i);
});

test("renders organize, compare, and smart resume tools", () => {
  const html = renderSessionResourcefulness([baseSession]);

  assert.match(html, /data-session-resourcefulness/);
  assert.match(html, /Smart resume/);
  assert.match(html, /Organize/);
  assert.match(html, /Compare/);
  assert.match(html, /Inaxaplin/);
});
