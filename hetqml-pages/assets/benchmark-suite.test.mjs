import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const moduleSource = await readFile(
  new URL("./benchmark-suite.js", import.meta.url),
  "utf8",
);
const {
  BENCHMARK_TABS,
  BENCHMARK_ROWS,
  renderBenchmarkSuite,
} = await import(`data:text/javascript,${encodeURIComponent(moduleSource)}`);

test("defines the six reviewer-facing benchmark tabs", () => {
  assert.deepEqual(
    BENCHMARK_TABS.map((tab) => tab.id),
    [
      "classification",
      "ranking",
      "calibration",
      "efficiency",
      "quantum-hw",
      "cv-strategy",
    ],
  );
});

test("renders a benchmark table for every tab", () => {
  for (const tab of BENCHMARK_TABS) {
    const html = renderBenchmarkSuite(tab.id);

    assert.match(html, /role="tablist"/);
    assert.match(html, new RegExp(`data-tab-panel="${tab.id}"`));
    assert.match(html, /<table class="benchmark-table"/);
    assert.match(html, /Quantum Kernel \+ Metapath/);
  }
});

test("rendered benchmark suite replaces the old port-pending placeholder", () => {
  const html = renderBenchmarkSuite("classification");

  assert.equal(BENCHMARK_ROWS.length >= 6, true);
  assert.doesNotMatch(html, /port pending/i);
  assert.match(html, /benchmark_suite_v1\.json/);
  assert.match(html, /5-fold stratified CV/);
});
