export const RUN_PATH_MODES = [
  {
    id: "quick",
    label: "Quick / Simple",
    description: "Use the recommended preset for the selected family with conservative defaults.",
  },
  {
    id: "custom",
    label: "Pick family",
    description: "Choose whether this investigation should run classical, hybrid, or quantum.",
  },
];

export const RUN_PATH_FAMILIES = [
  {
    id: "classical",
    label: "Classical",
    preset: "Classical",
    summary: "Fast CPU baseline with stacking, GBDT, and KGE models. Best for quick sanity checks.",
    runtime: "~50s",
    algorithms: "8 algorithms",
  },
  {
    id: "hybrid",
    label: "Hybrid",
    preset: "Hybrid QSVC",
    summary: "fast recommended default: quantum kernels plus classical baselines for parameter-efficient comparison.",
    runtime: "~2m",
    algorithms: "3 hybrid + 8 baselines",
  },
  {
    id: "quantum",
    label: "Quantum",
    preset: "Quantum HW",
    summary: "Hardware-validated path with QAOA / VQE and classical baselines. Best when reviewer evidence needs backend traces.",
    runtime: "~4m",
    algorithms: "2 quantum + 8 baselines",
  },
];

const STORAGE_KEY = "hetqml.run-path-choice";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function byId(collection, id, fallbackIndex = 0) {
  return collection.find((item) => item.id === id) ?? collection[fallbackIndex];
}

export function getRunPathSelection(choice = {}) {
  const mode = byId(RUN_PATH_MODES, choice.mode, 0);
  const family = byId(RUN_PATH_FAMILIES, choice.family, 1);

  return {
    mode,
    family,
    summary: mode.id === "quick"
      ? `${family.summary} Quick mode keeps default shots, folds, and guard parity.`
      : `${family.summary} Custom mode lets the family choice be explicit before downstream evidence is read.`,
  };
}

function renderSegment(items, selectedId, dataAttr) {
  return items.map((item) => {
    const active = item.id === selectedId;
    return `<button class="run-choice-btn ${active ? "active" : ""}" type="button" data-${dataAttr}="${escapeHtml(item.id)}" aria-pressed="${active}">
      <strong>${escapeHtml(item.label)}</strong>
      <span>${escapeHtml(item.description ?? item.preset)}</span>
    </button>`;
  }).join("");
}

export function renderRunPathChooser(choice = {}) {
  const selection = getRunPathSelection(choice);

  return `<section class="run-path-chooser" data-run-path-chooser>
    <div class="run-path-chooser-head">
      <div>
        <div class="eyebrow">RUN PATH OPTION</div>
        <div class="panel-title">Choose quick mode, then choose the run family</div>
      </div>
      <span class="run-path-pill">${escapeHtml(selection.family.preset)} · ${escapeHtml(selection.mode.label)}</span>
    </div>
    <p class="panel-purpose">Use Quick / Simple for the default card setup, or explicitly pick whether the investigation should run Classical, Hybrid, or Quantum.</p>
    <div class="run-choice-label">1 · Setup depth</div>
    <div class="run-choice-grid mode-grid">${renderSegment(RUN_PATH_MODES, selection.mode.id, "run-mode")}</div>
    <div class="run-choice-label">2 · Run family</div>
    <div class="run-choice-grid family-grid">${renderSegment(RUN_PATH_FAMILIES, selection.family.id, "run-family")}</div>
    <div class="run-path-summary">
      <div>
        <span>Selected path</span>
        <strong>${escapeHtml(selection.family.preset)}</strong>
      </div>
      <div>
        <span>Runtime</span>
        <strong>${escapeHtml(selection.family.runtime)}</strong>
      </div>
      <div>
        <span>Coverage</span>
        <strong>${escapeHtml(selection.family.algorithms)}</strong>
      </div>
    </div>
    <p class="run-path-note">${escapeHtml(selection.summary)}</p>
  </section>`;
}

function chooserStyles() {
  return `.run-path-chooser{margin:16px 0;padding:16px;border:1px solid var(--border-soft);border-radius:6px;background:rgba(255,255,255,.025)}
.run-path-chooser-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}
.run-path-pill{border:1px solid var(--teal);background:var(--teal-bg);color:var(--teal);border-radius:999px;padding:6px 9px;font-size:11px;font-weight:700;white-space:nowrap}
.run-choice-label{margin-top:14px;color:var(--gold);font-family:monospace;font-size:11px;text-transform:uppercase;letter-spacing:.08em}
.run-choice-grid{display:grid;gap:10px;margin-top:8px}
.mode-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
.family-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
.run-choice-btn{border:1px solid var(--border-soft);border-radius:5px;background:rgba(0,0,0,.12);padding:11px;text-align:left;color:var(--muted);cursor:pointer}
.run-choice-btn.active{border-color:var(--teal);background:var(--teal-bg)}
.run-choice-btn strong{display:block;color:var(--ink);font-size:13px;margin-bottom:5px}
.run-choice-btn span{display:block;color:var(--faint);font-size:11px;line-height:1.4}
.run-path-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:14px}
.run-path-summary div{border:1px solid var(--border-soft);border-radius:4px;padding:10px}
.run-path-summary span{display:block;color:var(--faint);font-size:10px;text-transform:uppercase;letter-spacing:.08em}
.run-path-summary strong{display:block;color:var(--ink);font-size:13px;margin-top:5px}
.run-path-note{margin:12px 0 0;color:var(--muted);font-size:12px;line-height:1.55}
@media (max-width:900px){.run-path-chooser-head{display:block}.run-path-pill{display:inline-block;margin-top:10px}.mode-grid,.family-grid,.run-path-summary{grid-template-columns:1fr}}`;
}

function readStoredChoice(windowRef) {
  try {
    return JSON.parse(windowRef.localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function writeStoredChoice(windowRef, choice) {
  try {
    windowRef.localStorage.setItem(STORAGE_KEY, JSON.stringify(choice));
  } catch {
    // Static export enhancement: localStorage may be unavailable in hardened contexts.
  }
}

function injectStyles(documentRef) {
  if (documentRef.getElementById("run-path-chooser-styles")) {
    return;
  }

  const style = documentRef.createElement("style");
  style.id = "run-path-chooser-styles";
  style.textContent = chooserStyles();
  documentRef.head.appendChild(style);
}

function findRunPathPanel(documentRef) {
  return Array.from(documentRef.querySelectorAll(".panel")).find((panel) => {
    const eyebrow = panel.querySelector(".eyebrow");
    return eyebrow?.textContent?.trim() === "TOOL · RUN PATH";
  });
}

function applyCardHighlight(panel, familyId) {
  const family = byId(RUN_PATH_FAMILIES, familyId, 1);
  const cards = Array.from(panel.querySelectorAll("button"));

  for (const card of cards) {
    const active = card.textContent.toLowerCase().includes(family.preset.toLowerCase().split(" ")[0]);
    card.style.outline = active ? "2px solid var(--teal)" : "";
    card.style.outlineOffset = active ? "2px" : "";
  }
}

export function mountRunPathChooser(documentRef = globalThis.document, windowRef = globalThis.window) {
  if (!documentRef) {
    return false;
  }

  const panel = findRunPathPanel(documentRef);
  if (!panel) {
    return false;
  }

  injectStyles(documentRef);

  const choice = windowRef ? readStoredChoice(windowRef) : {};
  let container = panel.querySelector("[data-run-path-chooser]");
  const wrapper = documentRef.createElement("div");
  wrapper.innerHTML = renderRunPathChooser(choice);

  if (container) {
    container.replaceWith(wrapper.firstElementChild);
  } else {
    const purpose = panel.querySelector(".panel-purpose");
    purpose?.insertAdjacentElement("afterend", wrapper.firstElementChild);
  }

  applyCardHighlight(panel, getRunPathSelection(choice).family.id);

  const mounted = panel.querySelector("[data-run-path-chooser]");
  if (mounted && !mounted.dataset.bound) {
    mounted.dataset.bound = "true";
    mounted.addEventListener("click", (event) => {
      const modeButton = event.target.closest("[data-run-mode]");
      const familyButton = event.target.closest("[data-run-family]");
      if (!modeButton && !familyButton) {
        return;
      }

      const current = windowRef ? readStoredChoice(windowRef) : {};
      const next = {
        mode: modeButton?.dataset.runMode ?? current.mode ?? "quick",
        family: familyButton?.dataset.runFamily ?? current.family ?? "hybrid",
      };
      if (windowRef) {
        writeStoredChoice(windowRef, next);
      }
      mountRunPathChooser(documentRef, windowRef);
    });
  }

  return true;
}

if (typeof window !== "undefined") {
  const mount = () => mountRunPathChooser(window.document, window);

  const scheduleInitialMount = () => {
    window.setTimeout(mount, 1200);
    window.setTimeout(mount, 2500);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleInitialMount, { once: true });
  } else {
    scheduleInitialMount();
  }

  window.addEventListener("load", scheduleInitialMount, { once: true });
}
