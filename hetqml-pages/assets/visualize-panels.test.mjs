import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const moduleSource = await readFile(
  new URL("./visualize-panels.js", import.meta.url),
  "utf8",
);
const {
  VISUALIZE_DATA,
  renderControlBar,
  renderMetricStrip,
  renderClinicalStrip,
  renderEvidenceMatrix,
  renderPathDiagram,
  renderModelAgreement,
  renderEvidenceOverlays,
  renderProvenanceTimeline,
  renderQualityFlags,
  renderInterpretationPanel,
  renderVisualizePanels,
  mountVisualizePanels,
  renderMigrationChecklist,
  renderMolecule3D,
  renderKnowledgeGraph3D,
  renderUmap3D,
  renderKernelCircuit,
} = await import(`data:text/javascript,${encodeURIComponent(moduleSource)}`);

test("VISUALIZE_DATA exposes every section the panels render", () => {
  for (const key of [
    "investigation",
    "metricStrip",
    "clinicalStrip",
    "evidenceMatrix",
    "pathDiagram",
    "modelAgreement",
    "evidenceOverlays",
    "provenance",
    "qualityFlags",
    "interpretation",
    "migrationChecklist",
    "molecule",
    "knowledgeGraph",
    "umap",
    "kernelCircuit",
  ]) {
    assert.ok(key in VISUALIZE_DATA, `VISUALIZE_DATA missing ${key}`);
  }

  assert.equal(VISUALIZE_DATA.metricStrip.length, 4);
  assert.equal(VISUALIZE_DATA.clinicalStrip.length, 4);
  assert.equal(VISUALIZE_DATA.evidenceMatrix.rows.length, 6);
  assert.equal(VISUALIZE_DATA.evidenceMatrix.columns.length, 5);
  for (const row of VISUALIZE_DATA.evidenceMatrix.rows) {
    assert.equal(row.cells.length, VISUALIZE_DATA.evidenceMatrix.columns.length);
  }
  assert.equal(VISUALIZE_DATA.modelAgreement.models.length, 3);
  assert.equal(VISUALIZE_DATA.migrationChecklist.length, 10);
  assert.equal(
    VISUALIZE_DATA.migrationChecklist.every((item) => item.status === "done"),
    true,
    "every checklist row should be marked done now that all panels render live",
  );
  assert.ok(VISUALIZE_DATA.molecule.sdf.includes("M  END"), "molecule SDF should be a valid sdf block");
  assert.ok(VISUALIZE_DATA.knowledgeGraph.nodes.length > 5);
  assert.ok(VISUALIZE_DATA.knowledgeGraph.edges.length > 5);
  assert.ok(VISUALIZE_DATA.umap.points.length > 100, "umap should have a meaningful number of points");
  assert.equal(VISUALIZE_DATA.umap.points.some((point) => point.highlight === true), true);
});

test("control bar renders the investigation summary and Sync / Export actions", () => {
  const html = renderControlBar();
  assert.match(html, /data-viz-controlbar/);
  assert.match(html, /Inaxaplin/);
  assert.match(html, /Hypertension-attributed ESKD/);
  assert.match(html, /data-viz-action="sync"/);
  assert.match(html, /data-viz-action="export"/);
});

test("metric strip renders four metric cards with label, value, sub", () => {
  const html = renderMetricStrip();
  assert.match(html, /data-viz-metric-strip/);
  for (const card of VISUALIZE_DATA.metricStrip) {
    assert.match(html, new RegExp(card.label.replaceAll("-", "\\-")));
    assert.match(html, new RegExp(card.value.replaceAll(".", "\\.").replaceAll("(", "\\(").replaceAll(")", "\\)").replaceAll("-", "\\-")));
  }
  const cardCount = (html.match(/viz-metric-value/g) ?? []).length;
  assert.equal(cardCount, 4);
});

test("clinical strip renders one card per item with the correct tone marker", () => {
  const html = renderClinicalStrip();
  for (const card of VISUALIZE_DATA.clinicalStrip) {
    assert.match(html, new RegExp(`data-tone="${card.tone}"`));
  }
});

test("evidence matrix renders six rows by five columns with strength glyphs", () => {
  const html = renderEvidenceMatrix();
  assert.match(html, /data-viz-matrix/);
  const rowMatches = html.match(/<th scope="row">/g) ?? [];
  assert.equal(rowMatches.length, 6);
  for (const cell of ["strong", "weak", "absent"]) {
    assert.ok(html.includes(`data-cell="${cell}"`), `expected at least one cell with strength ${cell}`);
  }
});

test("path diagram renders four labeled nodes connected by three metaedges", () => {
  const html = renderPathDiagram();
  assert.match(html, /data-viz-path/);
  for (const node of VISUALIZE_DATA.pathDiagram.nodes) {
    assert.ok(html.includes(node.label), `path diagram missing node ${node.label}`);
  }
  for (const edge of VISUALIZE_DATA.pathDiagram.edges) {
    assert.ok(html.includes(edge.metaedge), `path diagram missing metaedge ${edge.metaedge}`);
  }
});

test("model agreement renders bars for every model and a percentage gauge", () => {
  const html = renderModelAgreement();
  assert.match(html, /data-viz-agreement/);
  for (const model of VISUALIZE_DATA.modelAgreement.models) {
    assert.ok(html.includes(model.label), `model agreement missing ${model.label}`);
  }
  const expectedPct = Math.round(VISUALIZE_DATA.modelAgreement.agreement * 100);
  assert.match(html, new RegExp(`${expectedPct}%`));
});

test("evidence overlays render claim cards with strength tags and source lists", () => {
  const html = renderEvidenceOverlays();
  assert.match(html, /data-viz-overlays/);
  for (const overlay of VISUALIZE_DATA.evidenceOverlays) {
    assert.ok(html.includes(`data-overlay-id="${overlay.id}"`), `overlay missing ${overlay.id}`);
  }
});

test("provenance timeline renders one item per audit event", () => {
  const html = renderProvenanceTimeline();
  const itemCount = (html.match(/viz-prov-item/g) ?? []).length;
  assert.equal(itemCount, VISUALIZE_DATA.provenance.length);
});

test("quality flags render with the correct level tag for each entry", () => {
  const html = renderQualityFlags();
  const seenLevels = new Set();
  for (const flag of VISUALIZE_DATA.qualityFlags) {
    seenLevels.add(flag.level.toUpperCase());
  }
  for (const level of seenLevels) {
    assert.ok(html.includes(`>${level}<`), `quality flag tag for ${level} missing`);
  }
});

test("interpretation panel renders the headline and every bullet", () => {
  const html = renderInterpretationPanel();
  assert.match(html, /data-viz-interpretation/);
  const escape = (value) => String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
  assert.ok(html.includes(escape(VISUALIZE_DATA.interpretation.headline)));
  for (const bullet of VISUALIZE_DATA.interpretation.bullets) {
    assert.ok(html.includes(escape(bullet)), `interpretation missing bullet ${bullet.slice(0, 30)}...`);
  }
});

test("renderVisualizePanels composes every panel exactly once", () => {
  const html = renderVisualizePanels();
  for (const marker of [
    "data-viz-migration",
    "data-viz-controlbar",
    "data-viz-metric-strip",
    "data-viz-clinical",
    "data-viz-matrix",
    "data-viz-path",
    "data-viz-agreement",
    "data-viz-overlays",
    "data-viz-provenance",
    "data-viz-flags",
    "data-viz-interpretation",
    "data-viz-molecule",
    "data-viz-kg",
    "data-viz-umap",
    "data-viz-circuit",
  ]) {
    const matches = html.match(new RegExp(`${marker}(?![\\w-])`, "g")) ?? [];
    assert.equal(matches.length, 1, `${marker} should appear exactly once, found ${matches.length}`);
  }
});

test("migration checklist renders one row per item with the matching status tone", () => {
  const html = renderMigrationChecklist();
  assert.match(html, /data-viz-migration/);
  for (const item of VISUALIZE_DATA.migrationChecklist) {
    assert.match(html, new RegExp(`data-mig-id="${item.id}"`));
    assert.match(html, new RegExp(`data-mig-status="${item.status}"`));
  }
  const completed = VISUALIZE_DATA.migrationChecklist.filter((item) => item.status === "done").length;
  const total = VISUALIZE_DATA.migrationChecklist.length;
  assert.match(html, new RegExp(`Migration checklist · ${completed} / ${total}`));
});

test("3D molecule panel renders a stage with PubChem CID and SDF style hint", () => {
  const html = renderMolecule3D();
  assert.match(html, /data-viz-molecule/);
  assert.match(html, /data-pubchem-cid="145953829"/);
  assert.match(html, /data-style="stick"/);
  assert.match(html, /3Dmol\.js/);
});

test("3D knowledge graph panel renders a stage and reports node/edge counts", () => {
  const html = renderKnowledgeGraph3D();
  assert.match(html, /data-viz-kg/);
  const nodeCount = VISUALIZE_DATA.knowledgeGraph.nodes.length;
  const edgeCount = VISUALIZE_DATA.knowledgeGraph.edges.length;
  assert.match(html, new RegExp(`${nodeCount} nodes · ${edgeCount} edges`));
});

test("3D UMAP panel renders a stage and the projection note", () => {
  const html = renderUmap3D();
  assert.match(html, /data-viz-umap/);
  assert.match(html, /data-viz-umap-stage/);
  assert.ok(html.includes(VISUALIZE_DATA.umap.note.split(".")[0]));
});

test("kernel circuit panel renders a stage with qubit and depth metadata", () => {
  const html = renderKernelCircuit();
  assert.match(html, /data-viz-circuit/);
  const k = VISUALIZE_DATA.kernelCircuit;
  assert.match(html, new RegExp(`data-qubits="${k.qubits}"`));
  assert.match(html, new RegExp(`data-depth="${k.depth}"`));
  assert.match(html, new RegExp(`${k.qubits} qubits · depth ${k.depth}`));
});

test("mountVisualizePanels replaces the original migration checklist with the live panel cluster", () => {
  const fakeDoc = createFakeDocument(`<!DOCTYPE html><html><head></head><body>
    <main class="main">
      <div class="page-hero"><h1>Visualize</h1></div>
      <div class="panel"><div class="panel-head"><div><div class="eyebrow">PAGE STATUS</div><div class="panel-title">Migration checklist</div></div></div><p>3D molecule viewer — 3Dmol.js (use dynamic import with ssr:false)</p></div>
      <div class="footer-actions"><a class="btn" href="/initialize/">Back</a></div>
    </main>
  </body></html>`);

  const result = mountVisualizePanels(fakeDoc);
  assert.equal(result, true);
  assert.equal(fakeDoc.querySelector("[data-visualize-panels]") !== null, true);
  assert.equal(fakeDoc.querySelector("[data-viz-migration]") !== null, true, "live migration checklist should be present");
  assert.equal(fakeDoc.querySelector("[data-viz-controlbar]") !== null, true);
  assert.equal(fakeDoc.querySelector("[data-viz-molecule]") !== null, true);
  assert.equal(fakeDoc.querySelector("[data-viz-kg]") !== null, true);
  assert.equal(fakeDoc.querySelector("[data-viz-umap]") !== null, true);
  assert.equal(fakeDoc.querySelector("[data-viz-circuit]") !== null, true);
  assert.equal(
    fakeDoc.body.innerHTML.includes("use dynamic import with ssr:false"),
    false,
    "the original placeholder text should be gone after mount",
  );

  const second = mountVisualizePanels(fakeDoc);
  assert.equal(second, false, "remount should be a no-op while the panels are present");
});

test("mountVisualizePanels falls back to inserting before the footer when no migration panel exists", () => {
  const fakeDoc = createFakeDocument(`<!DOCTYPE html><html><head></head><body>
    <main class="main">
      <div class="page-hero"></div>
      <div class="footer-actions"><a class="btn">x</a></div>
    </main>
  </body></html>`);

  const result = mountVisualizePanels(fakeDoc);
  assert.equal(result, true);
  const main = fakeDoc.querySelector("main.main");
  const children = Array.from(main.children).map((child) => child.className);
  assert.equal(children[children.length - 1], "footer-actions");
  assert.ok(children.some((cls) => cls === ""), "panel cluster wrapper should be inserted before the footer");
});

function createFakeDocument(html) {
  const elementById = new Map();
  let nextId = 0;
  let current;

  const makeElement = (tag) => {
    const id = ++nextId;
    const node = {
      __id: id,
      tagName: tag.toUpperCase(),
      children: [],
      parentNode: null,
      attributes: new Map(),
      classList: new Set(),
      textContent: "",
      _innerHTML: "",
      get className() { return Array.from(this.classList).join(" "); },
      set className(value) {
        this.classList.clear();
        for (const part of String(value).split(/\s+/).filter(Boolean)) {
          this.classList.add(part);
        }
      },
      setAttribute(name, value) {
        this.attributes.set(name, String(value));
        if (name === "class") this.className = value;
        if (name === "id") elementById.set(value, this);
      },
      getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; },
      appendChild(child) {
        child.parentNode = this;
        this.children.push(child);
        return child;
      },
      insertBefore(child, ref) {
        const index = this.children.indexOf(ref);
        child.parentNode = this;
        if (index < 0) this.children.push(child);
        else this.children.splice(index, 0, child);
        return child;
      },
      replaceWith(replacement) {
        if (!this.parentNode) return;
        const siblings = this.parentNode.children;
        const index = siblings.indexOf(this);
        if (index >= 0) {
          replacement.parentNode = this.parentNode;
          siblings.splice(index, 1, replacement);
          this.parentNode = null;
        }
      },
      querySelector(selector) {
        return findFirst(this, parseSelector(selector));
      },
      querySelectorAll(selector) {
        return findAll(this, parseSelector(selector));
      },
      get firstElementChild() { return this.children[0] ?? null; },
      get innerHTML() { return this._innerHTML; },
      set innerHTML(value) {
        this._innerHTML = String(value);
        this.children = parseChildren(String(value), this);
      },
    };
    return node;
  };

  const parseAttributes = (raw) => {
    const attrs = new Map();
    const regex = /([\w:-]+)(?:=("[^"]*"|'[^']*'))?/g;
    let match;
    while ((match = regex.exec(raw)) !== null) {
      const name = match[1];
      const value = match[2] ? match[2].slice(1, -1) : "";
      attrs.set(name, value);
    }
    return attrs;
  };

  const parseChildren = (html, parent) => {
    const tokens = [];
    const regex = /<\/?([\w:-]+)([^>]*)>/g;
    let last = 0;
    let match;
    while ((match = regex.exec(html)) !== null) {
      if (match.index > last) {
        tokens.push({ type: "text", value: html.slice(last, match.index) });
      }
      const isClose = html[match.index + 1] === "/";
      const isSelfClose = match[0].endsWith("/>");
      tokens.push({ type: isClose ? "close" : "open", tag: match[1], raw: match[2], selfClose: isSelfClose });
      last = match.index + match[0].length;
    }
    if (last < html.length) tokens.push({ type: "text", value: html.slice(last) });

    const root = parent;
    const stack = [root];
    for (const token of tokens) {
      const top = stack[stack.length - 1];
      if (token.type === "text") {
        if (token.value.trim()) top.textContent = (top.textContent ?? "") + token.value;
        continue;
      }
      if (token.type === "open") {
        const node = makeElement(token.tag);
        const attrs = parseAttributes(token.raw.trim());
        for (const [name, value] of attrs) {
          node.setAttribute(name, value);
        }
        top.appendChild(node);
        if (!token.selfClose && !["br", "img", "input", "meta", "link"].includes(token.tag.toLowerCase())) {
          stack.push(node);
        }
        continue;
      }
      if (token.type === "close") {
        for (let i = stack.length - 1; i > 0; i--) {
          if (stack[i].tagName.toLowerCase() === token.tag.toLowerCase()) {
            stack.length = i;
            break;
          }
        }
      }
    }
    return root.children;
  };

  const parseSelector = (selector) => {
    return selector.split(",").map((part) => part.trim()).map((part) => {
      const tokens = part.split(/\s+/);
      return tokens.map((token) => {
        const node = { tag: null, classes: [], attrs: [], id: null };
        const remainder = token.replace(/\[(.*?)\]/g, (_, attr) => {
          const [k, v] = attr.split("=");
          node.attrs.push({ name: k, value: v ? v.replace(/['"]/g, "") : null });
          return "";
        });
        const segments = remainder.split(/(?=[.#])/);
        for (const segment of segments) {
          if (!segment) continue;
          if (segment.startsWith(".")) node.classes.push(segment.slice(1));
          else if (segment.startsWith("#")) node.id = segment.slice(1);
          else node.tag = segment.toLowerCase();
        }
        return node;
      });
    });
  };

  const matchesNode = (node, descriptor) => {
    if (descriptor.tag && node.tagName.toLowerCase() !== descriptor.tag) return false;
    for (const cls of descriptor.classes) if (!node.classList.has(cls)) return false;
    for (const attr of descriptor.attrs) {
      if (!node.attributes.has(attr.name)) return false;
      if (attr.value !== null && node.attributes.get(attr.name) !== attr.value) return false;
    }
    if (descriptor.id && node.attributes.get("id") !== descriptor.id) return false;
    return true;
  };

  const flatten = (node, out = []) => {
    out.push(node);
    for (const child of node.children) flatten(child, out);
    return out;
  };

  const findAll = (root, selectors) => {
    const all = flatten(root).slice(1);
    const results = [];
    for (const chain of selectors) {
      outer: for (const node of all) {
        const last = chain[chain.length - 1];
        if (!matchesNode(node, last)) continue;
        let cursor = node;
        for (let i = chain.length - 2; i >= 0; i--) {
          let parent = cursor.parentNode;
          let ok = false;
          while (parent) {
            if (matchesNode(parent, chain[i])) {
              ok = true;
              cursor = parent;
              break;
            }
            parent = parent.parentNode;
          }
          if (!ok) continue outer;
        }
        results.push(node);
      }
    }
    return results;
  };

  const findFirst = (root, selectors) => {
    const all = findAll(root, selectors);
    return all[0] ?? null;
  };

  const root = makeElement("html");
  current = root;
  const head = makeElement("head");
  const body = makeElement("body");
  root.appendChild(head);
  root.appendChild(body);

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/);
  if (bodyMatch) parseChildren(bodyMatch[1], body);

  return {
    documentElement: root,
    head,
    body,
    createElement: makeElement,
    getElementById(id) { return elementById.get(id) ?? null; },
    querySelector(selector) { return findFirst(root, parseSelector(selector)); },
    querySelectorAll(selector) { return findAll(root, parseSelector(selector)); },
  };
}
