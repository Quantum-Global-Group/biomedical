import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const hetqmlPagesRoot = join(__dirname, "..");

function assetScriptsFromHtml(html) {
  const out = new Set();
  for (const m of html.matchAll(/src="(\/assets\/[^"?]+\.js)/g)) {
    out.add(m[1].slice("/assets/".length));
  }
  return [...out];
}

test("every hetqml-pages HTML reference to /assets/*.js resolves on disk", async () => {
  const entries = await readdir(hetqmlPagesRoot, { withFileTypes: true });
  const htmlFiles = [];
  for (const e of entries) {
    if (e.isDirectory() && e.name !== "_next") {
      const p = join(hetqmlPagesRoot, e.name, "index.html");
      if (existsSync(p)) htmlFiles.push(p);
    }
  }
  htmlFiles.push(join(hetqmlPagesRoot, "index.html"));
  if (existsSync(join(hetqmlPagesRoot, "404.html"))) {
    htmlFiles.push(join(hetqmlPagesRoot, "404.html"));
  }

  for (const htmlPath of htmlFiles) {
    const html = await readFile(htmlPath, "utf8");
    for (const base of assetScriptsFromHtml(html)) {
      const abs = join(__dirname, base);
      assert.ok(
        existsSync(abs),
        `${htmlPath} references /assets/${base} but file is missing`,
      );
    }
  }
});

test("every wired /assets/*.js module has a colocated node:test file (*.test.mjs)", async () => {
  const wired = new Set();
  const entries = await readdir(hetqmlPagesRoot, { withFileTypes: true });
  const htmlFiles = [];
  for (const e of entries) {
    if (e.isDirectory() && e.name !== "_next") {
      const p = join(hetqmlPagesRoot, e.name, "index.html");
      if (existsSync(p)) htmlFiles.push(p);
    }
  }
  htmlFiles.push(join(hetqmlPagesRoot, "index.html"));

  for (const htmlPath of htmlFiles) {
    const html = await readFile(htmlPath, "utf8");
    for (const base of assetScriptsFromHtml(html)) {
      wired.add(base);
    }
  }

  assert.ok(wired.size > 0, "expected at least one /assets/*.js wired from HTML");

  for (const base of wired) {
    const testPath = join(__dirname, base.replace(/\.js$/, ".test.mjs"));
    assert.ok(
      existsSync(testPath),
      `/assets/${base} is wired from HTML but missing ${base.replace(/\.js$/, ".test.mjs")} (TDD for static modules)`,
    );
  }
});

test("workflow route shells exist under hetqml-pages", () => {
  const routes = [
    "initialize",
    "experiment",
    "validate",
    "visualize",
    "operations",
    "settings",
  ];
  for (const r of routes) {
    const p = join(hetqmlPagesRoot, r, "index.html");
    assert.ok(existsSync(p), `missing route shell: ${r}/index.html`);
  }
});

test("root index announces redirect toward Initialize", async () => {
  const html = await readFile(join(hetqmlPagesRoot, "index.html"), "utf8");
  assert.match(html, /\/initialize/i);
});
