import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const moduleSource = await readFile(
  new URL("./run-path-chooser.js", import.meta.url),
  "utf8",
);
const {
  RUN_PATH_MODES,
  RUN_PATH_FAMILIES,
  getRunPathSelection,
  renderRunPathChooser,
} = await import(`data:text/javascript,${encodeURIComponent(moduleSource)}`);

test("defines quick/simple and configurable run-path modes", () => {
  assert.deepEqual(
    RUN_PATH_MODES.map((mode) => mode.id),
    ["quick", "custom"],
  );
});

test("defines classical, hybrid, and quantum family choices separately from mode", () => {
  assert.deepEqual(
    RUN_PATH_FAMILIES.map((family) => family.id),
    ["classical", "hybrid", "quantum"],
  );
});

test("defaults to the quick hybrid path used by the current demo", () => {
  const selection = getRunPathSelection({});

  assert.equal(selection.mode.id, "quick");
  assert.equal(selection.family.id, "hybrid");
  assert.match(selection.summary, /fast recommended default/i);
});

test("renders controls for quick mode and all run families", () => {
  const html = renderRunPathChooser({ mode: "custom", family: "quantum" });

  assert.match(html, /data-run-path-chooser/);
  assert.match(html, /Quick \/ Simple/);
  assert.match(html, /Classical/);
  assert.match(html, /Hybrid/);
  assert.match(html, /Quantum/);
  assert.match(html, /Quantum HW/);
});
