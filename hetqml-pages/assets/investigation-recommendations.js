export const RECOMMENDATION_PROFILES = [
  {
    disease: "Hypertension-attributed ESKD",
    compound: "Inaxaplin",
    gene: "APOL1",
    metaedge: "CtD · Compound–treats–Disease",
    confidence: "High",
    rationale: "APOL1 ancestry-aware kidney signal: compound mechanism, anchor gene, and disease context all point at the same causal axis.",
    nextStep: "Use Hybrid or Quantum HW if you want to test parameter-efficient advantage over the classical baseline.",
  },
  {
    disease: "Systemic lupus erythematosus",
    compound: "Deucravacitinib",
    gene: "TYK2",
    metaedge: "CtD · Compound–treats–Disease",
    confidence: "High",
    rationale: "TYK2 inhibition matches autoimmune inflammatory signaling and a treatment-oriented compound-to-disease query.",
    nextStep: "Keep CtD so the comparison asks whether the compound treats the disease, not just whether it binds the target.",
  },
  {
    disease: "Multiple myeloma",
    compound: "Venetoclax",
    gene: "BCL2",
    metaedge: "CtD · Compound–treats–Disease",
    confidence: "High",
    rationale: "BCL-2 dependence creates a clear mechanism bridge between the compound and hematologic malignancy context.",
    nextStep: "Run Classical first if you want a fast baseline before escalating to hybrid kernels.",
  },
  {
    disease: "Hypertension",
    compound: "Empagliflozin",
    gene: "SLC5A2",
    metaedge: "CtD · Compound–treats–Disease",
    confidence: "Medium",
    rationale: "SGLT2 kidney-cardiometabolic biology supports a plausible disease link, but the hypertension signal is more indirect.",
    nextStep: "Use the detailed metrics page to inspect calibration before trusting probability scores.",
  },
  {
    disease: "Sickle cell disease",
    compound: "Decitabine",
    gene: "DNMT1",
    metaedge: "CtD · Compound–treats–Disease",
    confidence: "Medium",
    rationale: "Epigenetic fetal-hemoglobin induction gives a biologically plausible bridge but requires stricter evidence posture.",
    nextStep: "Keep bias and ancestry guards enabled because population structure can dominate this signal.",
  },
  {
    disease: "Castration-resistant prostate cancer",
    compound: "Capivasertib",
    gene: "AKT1",
    metaedge: "CtD · Compound–treats–Disease",
    confidence: "Medium",
    rationale: "AKT pathway targeting is mechanistically coherent, but disease heterogeneity makes the model agreement check important.",
    nextStep: "Prefer the Benchmark Suite after running to compare ranking and calibration, not only PR-AUC.",
  },
];

const FIELD_LABELS = {
  disease: "Disease",
  compound: "Compound",
  gene: "Anchor gene",
  metaedge: "Metaedge",
};
const FIELD_ORDER = ["disease", "compound", "gene", "metaedge"];
export const CASCADE_ORDER = ["disease", "compound", "gene", "metaedge"];

const FIELD_WEIGHTS = {
  disease: 24,
  compound: 28,
  gene: 26,
  metaedge: 22,
};
export const PARAMETER_PLACEHOLDERS = {
  disease: "Search 137 diseases (DOID)...",
  compound: "Search 1,552 compounds (DrugBank)...",
  gene: "Search 20,945 genes (NCBI / HGNC)...",
  metaedge: "Choose a Hetionet metaedge type...",
};
export const RECOMMENDATION_UPDATE_EVENTS = ["change", "focusout", "keyup"];

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function fieldMatches(selected, expected) {
  const selectedNorm = normalize(selected);
  const expectedNorm = normalize(expected);

  return Boolean(selectedNorm) && (selectedNorm === expectedNorm || selectedNorm.includes(expectedNorm) || expectedNorm.includes(selectedNorm));
}

function fieldMatchesExact(selected, expected) {
  const selectedNorm = normalize(selected);
  const expectedNorm = normalize(expected);

  return Boolean(selectedNorm) && selectedNorm === expectedNorm;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function scoreProfile(selection, profile) {
  return Object.keys(FIELD_WEIGHTS).reduce((score, field) => {
    return score + (fieldMatches(selection[field], profile[field]) ? FIELD_WEIGHTS[field] : 0);
  }, 0);
}

function selectedFields(selection) {
  return FIELD_ORDER.filter((field) => normalize(selection[field]));
}

function recommendationCandidates(selection) {
  const anchorOrder = ["compound", "gene", "disease", "metaedge"];

  for (const field of anchorOrder) {
    if (!normalize(selection[field])) {
      continue;
    }

    const anchored = RECOMMENDATION_PROFILES.filter((profile) => fieldMatches(selection[field], profile[field]));
    if (anchored.length > 0) {
      return anchored;
    }
  }

  return RECOMMENDATION_PROFILES;
}

export function allowedValuesForField(field, selection) {
  const fieldIndex = CASCADE_ORDER.indexOf(field);
  if (fieldIndex <= 0) {
    return null;
  }

  const upstreamFields = CASCADE_ORDER.slice(0, fieldIndex);
  const setUpstream = upstreamFields.filter((f) => normalize(selection?.[f]));
  if (setUpstream.length === 0) {
    return null;
  }

  const matching = RECOMMENDATION_PROFILES.filter((profile) =>
    setUpstream.every((f) => fieldMatchesExact(selection[f], profile[f])),
  );

  return new Set(matching.map((profile) => profile[field]));
}

export function isOptionGuided(field, optionName, selection) {
  const allowed = allowedValuesForField(field, selection);
  if (allowed === null) {
    return true;
  }

  for (const value of allowed) {
    if (fieldMatchesExact(optionName, value)) {
      return true;
    }
  }

  return false;
}

export function evaluateInvestigation(selection) {
  const safeSelection = {
    disease: selection?.disease ?? "",
    compound: selection?.compound ?? "",
    gene: selection?.gene ?? "",
    metaedge: selection?.metaedge ?? "",
  };
  const selected = selectedFields(safeSelection);
  const candidates = recommendationCandidates(safeSelection);
  const ranked = candidates
    .map((profile) => ({ profile, score: scoreProfile(safeSelection, profile) }))
    .sort((a, b) => b.score - a.score);
  const alternatives = RECOMMENDATION_PROFILES
    .filter((profile) => profile !== ranked[0]?.profile)
    .map((profile) => ({ profile, score: scoreProfile(safeSelection, profile) }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const missing = Object.keys(FIELD_WEIGHTS).filter((field) => !normalize(safeSelection[field]));
  const mismatched = Object.keys(FIELD_WEIGHTS).filter((field) => normalize(safeSelection[field]) && !fieldMatches(safeSelection[field], best.profile[field]));
  const normalizedScore = selected.length === 0 ? 0 : Math.round((best.score / 100) * 100);
  const label = normalizedScore >= 90
    ? "Strong fit"
    : normalizedScore >= 55
      ? "Partial fit"
      : selected.length > 0
        ? "Needs review"
        : "Pick a starting point";

  return {
    score: normalizedScore,
    label,
    missing,
    mismatched,
    primaryRecommendation: best.profile,
    alternatives: alternatives.slice(0, 3).map(({ profile, score }) => ({ ...profile, score })),
    reasons: [
      best.profile.rationale,
      missing.length
        ? `Recommended next fields: ${missing.map((field) => FIELD_LABELS[field]).join(", ")}.`
        : "All four investigation fields are populated.",
      mismatched.length
        ? `Review mismatched fields: ${mismatched.map((field) => FIELD_LABELS[field]).join(", ")}.`
        : best.profile.nextStep,
    ],
  };
}

export function getNextRecommendedField(selection) {
  const result = evaluateInvestigation(selection);
  const rec = result.primaryRecommendation;
  const nextField = FIELD_ORDER.find((field) => !fieldMatches(selection?.[field], rec[field]));

  if (!nextField) {
    return null;
  }

  return {
    field: nextField,
    label: FIELD_LABELS[nextField],
    value: rec[nextField],
  };
}

function renderField(field, label, value, highlighted = false, locked = false) {
  const classes = ["inv-rec-field"];
  if (highlighted) classes.push("recommended");
  if (locked) classes.push("locked");

  return `<button class="${classes.join(" ")}" type="button" data-recommended-field="${escapeHtml(field)}" data-recommended-value="${escapeHtml(value)}"${locked ? " disabled aria-disabled=\"true\"" : ""}>
    <span>${escapeHtml(label)}</span>
    <strong>${escapeHtml(value)}</strong>
  </button>`;
}

export function renderInvestigationRecommendations(selection) {
  const result = evaluateInvestigation(selection);
  const rec = result.primaryRecommendation;
  const selected = selectedFields(selection);
  const emptyState = selected.length === 0;
  const nextRecommended = getNextRecommendedField(selection);

  return `<section class="inv-rec" data-investigation-recommendations>
    <div class="inv-rec-head">
      <div>
        <div class="eyebrow">TOOL · RECOMMENDATION ENGINE</div>
        <div class="panel-title">Recommended combination for this investigation</div>
      </div>
      <span class="inv-rec-score">${escapeHtml(result.label)} · ${escapeHtml(result.score)}%</span>
    </div>
    <p class="panel-purpose">${emptyState ? "Pick any disease, compound, anchor gene, or metaedge to get a recommended full investigation bundle." : "Based on the current selections, this bundle is the most coherent disease-compound-gene-metaedge combination to investigate next."}</p>
    ${nextRecommended ? `<button class="inv-rec-next" type="button" data-apply-recommendation="${escapeHtml(nextRecommended.field)}" data-recommended-value="${escapeHtml(nextRecommended.value)}">
      <span>Click recommended ${escapeHtml(nextRecommended.label.toLowerCase())}</span>
      <strong>${escapeHtml(nextRecommended.value)}</strong>
    </button>` : `<div class="inv-rec-next complete"><span>Recommended sequence complete</span><strong>All four parameters are aligned.</strong></div>`}
    <div class="inv-rec-grid">
      ${renderField("disease", "Disease", rec.disease, result.missing.includes("disease") || result.mismatched.includes("disease"), nextRecommended ? nextRecommended.field !== "disease" : false)}
      ${renderField("compound", "Compound", rec.compound, result.missing.includes("compound") || result.mismatched.includes("compound"), nextRecommended ? nextRecommended.field !== "compound" : false)}
      ${renderField("gene", "Anchor gene", rec.gene, result.missing.includes("gene") || result.mismatched.includes("gene"), nextRecommended ? nextRecommended.field !== "gene" : false)}
      ${renderField("metaedge", "Metaedge", rec.metaedge, result.missing.includes("metaedge") || result.mismatched.includes("metaedge"), nextRecommended ? nextRecommended.field !== "metaedge" : false)}
    </div>
    <div class="inv-rec-body">
      <div>
        <div class="metric-label">WHY THIS COMBINATION</div>
        <ul>${result.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}</ul>
      </div>
      <div>
        <div class="metric-label">ALTERNATIVES</div>
        ${result.alternatives.map((alt) => `<div class="inv-rec-alt"><strong>${escapeHtml(alt.compound)}</strong><span>${escapeHtml(alt.gene)} → ${escapeHtml(alt.disease)}</span></div>`).join("")}
      </div>
    </div>
  </section>`;
}

function recommendationStyles() {
  return `.inv-rec{margin-top:18px;padding:16px;border:1px solid var(--border-soft);border-radius:6px;background:rgba(255,255,255,.025)}
.inv-rec-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}
.inv-rec-score{border:1px solid var(--teal);background:var(--teal-bg);color:var(--teal);border-radius:999px;padding:6px 9px;font-size:11px;font-weight:700;white-space:nowrap}
.inv-rec-next{box-sizing:border-box;width:100%;margin-top:12px;border:1px solid var(--teal);border-radius:6px;background:var(--teal-bg);padding:11px;text-align:left;color:var(--ink);cursor:pointer}
.inv-rec-next.complete{border-color:var(--border-soft);background:rgba(0,0,0,.12);cursor:default}
.inv-rec-next span{display:block;color:var(--faint);font-size:10px;text-transform:uppercase;letter-spacing:.08em}
.inv-rec-next strong{display:block;margin-top:5px;color:var(--ink);font-size:14px}
.inv-rec-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:14px}
.inv-rec-field{border:1px solid var(--border-soft);border-radius:5px;padding:10px;background:rgba(0,0,0,.12);text-align:left;cursor:pointer}
.inv-rec-field.recommended{border-color:var(--gold);background:rgba(216,167,92,.08)}
.inv-rec-field.locked{cursor:not-allowed;opacity:.55;filter:grayscale(.4)}
.inv-rec-field.locked:hover{background:rgba(0,0,0,.12)}
.inv-rec-field span{display:block;color:var(--faint);font-size:10px;text-transform:uppercase;letter-spacing:.08em}
.inv-rec-field strong{display:block;margin-top:6px;color:var(--ink);font-size:13px;line-height:1.35}
.inv-rec-body{display:grid;grid-template-columns:1.4fr .8fr;gap:18px;margin-top:16px;padding-top:14px;border-top:1px solid var(--border-soft)}
.inv-rec ul{margin:8px 0 0;padding-left:18px;color:var(--muted);font-size:12px;line-height:1.6}
.inv-rec-alt{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid var(--border-soft);padding:8px 0;font-size:12px}
.inv-rec-alt strong{color:var(--ink)}
.inv-rec-alt span{color:var(--faint);text-align:right}
@media (max-width:900px){.inv-rec-grid,.inv-rec-body{grid-template-columns:1fr}.inv-rec-head{display:block}.inv-rec-score{display:inline-block;margin-top:10px}}`;
}

function injectStyles(documentRef) {
  if (documentRef.getElementById("investigation-recommendations-styles")) {
    return;
  }

  const style = documentRef.createElement("style");
  style.id = "investigation-recommendations-styles";
  style.textContent = recommendationStyles();
  documentRef.head.appendChild(style);
}

function getInputValue(documentRef, placeholder) {
  return documentRef.querySelector(`input[placeholder="${placeholder}"]`)?.value ?? "";
}

function getInputForField(documentRef, field) {
  return documentRef.querySelector(`input[placeholder="${PARAMETER_PLACEHOLDERS[field]}"]`);
}

function readSelection(documentRef) {
  return {
    disease: getInputValue(documentRef, PARAMETER_PLACEHOLDERS.disease),
    compound: getInputValue(documentRef, PARAMETER_PLACEHOLDERS.compound),
    gene: getInputValue(documentRef, PARAMETER_PLACEHOLDERS.gene),
    metaedge: getInputValue(documentRef, PARAMETER_PLACEHOLDERS.metaedge),
  };
}

export function shouldDeferRecommendationUpdate(selection, activePlaceholder) {
  const activeField = Object.entries(PARAMETER_PLACEHOLDERS).find(([, placeholder]) => placeholder === activePlaceholder)?.[0];

  return Boolean(activeField && !normalize(selection[activeField]));
}

export function isParameterPlaceholder(placeholder) {
  return Object.values(PARAMETER_PLACEHOLDERS).includes(placeholder);
}

function findInvestigationPanel(documentRef) {
  return Array.from(documentRef.querySelectorAll(".panel")).find((panel) => {
    const eyebrow = panel.querySelector(".eyebrow");
    return eyebrow?.textContent?.trim() === "TOOL · INVESTIGATION PARAMETERS";
  });
}

export function mountInvestigationRecommendations(documentRef = globalThis.document) {
  if (!documentRef) {
    return false;
  }

  const panel = findInvestigationPanel(documentRef);
  if (!panel) {
    return false;
  }

  injectStyles(documentRef);

  let container = panel.querySelector("[data-investigation-recommendations]");
  if (!container) {
    const wrapper = documentRef.createElement("div");
    wrapper.innerHTML = renderInvestigationRecommendations(readSelection(documentRef));
    container = wrapper.firstElementChild;
    panel.appendChild(container);
  } else {
    const wrapper = documentRef.createElement("div");
    wrapper.innerHTML = renderInvestigationRecommendations(readSelection(documentRef));
    container.replaceWith(wrapper.firstElementChild);
  }

  return true;
}

if (typeof window !== "undefined") {
  const setInputValue = (input, value) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const scheduleMount = () => {
    window.clearTimeout(window.__hetqmlInvestigationRecTimer);
    window.__hetqmlInvestigationRecTimer = window.setTimeout(() => {
      const activePlaceholder = window.document.activeElement?.getAttribute?.("placeholder");
      const selection = readSelection(window.document);

      if (shouldDeferRecommendationUpdate(selection, activePlaceholder)) {
        return;
      }

      mountInvestigationRecommendations(window.document);
    }, 180);
  };
  const bindOptionFallback = () => {
    if (window.document.documentElement.dataset.invRecOptionFallbackBound) {
      return;
    }

    window.document.documentElement.dataset.invRecOptionFallbackBound = "true";
    window.document.addEventListener("focusin", (event) => {
      const placeholder = event.target?.getAttribute?.("placeholder");
      if (isParameterPlaceholder(placeholder)) {
        window.__hetqmlLastParameterInput = event.target;
      }
    }, true);
    const handleOptionPointer = (event) => {
      const option = event.target.closest(".combo-option");
      const optionName = option?.querySelector(".combo-option-name")?.textContent?.trim()
        ?? event.target.closest(".combo-option-name")?.textContent?.trim();
      const activeInput = isParameterPlaceholder(window.document.activeElement?.getAttribute?.("placeholder"))
        ? window.document.activeElement
        : window.__hetqmlLastParameterInput;
      const activePlaceholder = activeInput?.getAttribute?.("placeholder");

      if (!optionName || !activeInput || !isParameterPlaceholder(activePlaceholder)) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();

      const applySelection = () => {
        if (activeInput.value !== optionName) {
          setInputValue(activeInput, optionName);
        }
        activeInput.blur();
        mountInvestigationRecommendations(window.document);
      };

      window.setTimeout(applySelection, 0);
      window.setTimeout(applySelection, 60);
      window.setTimeout(applySelection, 160);
    };

    ["pointerdown", "mousedown", "click"].forEach((eventName) => {
      window.document.addEventListener(eventName, handleOptionPointer, true);
    });
  };
  const bindRecommendationActions = () => {
    if (window.document.documentElement.dataset.invRecActionsBound) {
      return;
    }

    window.document.documentElement.dataset.invRecActionsBound = "true";
    window.document.addEventListener("click", (event) => {
      const action = event.target.closest("[data-apply-recommendation], [data-recommended-field]");
      if (!action) {
        return;
      }

      if (action.disabled || action.getAttribute("aria-disabled") === "true") {
        event.preventDefault();
        return;
      }

      const field = action.dataset.applyRecommendation ?? action.dataset.recommendedField;
      const value = action.dataset.recommendedValue;
      const input = getInputForField(window.document, field);
      if (!field || !value || !input) {
        return;
      }

      event.preventDefault();
      setInputValue(input, value);
      input.blur();
      mountInvestigationRecommendations(window.document);
    }, true);
  };

  const ensureCascadeStyles = () => {
    if (window.document.getElementById("investigation-cascade-styles")) {
      return;
    }
    const style = window.document.createElement("style");
    style.id = "investigation-cascade-styles";
    style.textContent = `.inv-cascade-toggle{display:flex;gap:6px;align-items:center;padding:6px 10px;border-bottom:1px solid var(--border-soft);font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--faint)}
.inv-cascade-toggle button{cursor:pointer;border:1px solid var(--border-soft);border-radius:999px;background:transparent;color:var(--faint);font-size:10px;padding:3px 9px;text-transform:uppercase;letter-spacing:.08em}
.inv-cascade-toggle button.active{border-color:var(--teal);background:var(--teal-bg);color:var(--teal)}
.combo-option.inv-cascade-guided{box-shadow:inset 3px 0 0 var(--teal)}
.combo-option.inv-cascade-hidden{display:none !important}`;
    window.document.head.appendChild(style);
  };

  const getCascadeMode = () => window.__hetqmlCascadeMode === "all" ? "all" : "guided";
  const setCascadeMode = (mode) => {
    window.__hetqmlCascadeMode = mode === "all" ? "all" : "guided";
    applyCascade();
  };

  const ensureCascadeToggle = (combo) => {
    if (combo.querySelector("[data-cascade-toggle]")) {
      return;
    }
    const list = combo.querySelector(".combo-list");
    if (!list) {
      return;
    }
    const wrap = window.document.createElement("div");
    wrap.className = "inv-cascade-toggle";
    wrap.setAttribute("data-cascade-toggle", "true");
    wrap.innerHTML = `<span>Guide</span><button type="button" data-cascade-set="guided">Recommended</button><button type="button" data-cascade-set="all">All</button>`;
    const head = list.querySelector(".combo-list-head");
    if (head) {
      head.parentNode.insertBefore(wrap, head);
    } else {
      list.insertBefore(wrap, list.firstChild);
    }
  };

  const applyCascade = () => {
    const selection = readSelection(window.document);
    const mode = getCascadeMode();
    CASCADE_ORDER.forEach((field) => {
      const combo = window.document.querySelector(`.combo[data-field="${field}"]`);
      if (!combo) {
        return;
      }
      ensureCascadeToggle(combo);
      combo.querySelectorAll("[data-cascade-set]").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.cascadeSet === mode);
      });
      const allowed = allowedValuesForField(field, selection);
      const hasConstraint = allowed !== null && allowed.size > 0;
      combo.querySelectorAll(".combo-option").forEach((option) => {
        const name = option.querySelector(".combo-option-name")?.textContent?.trim() ?? "";
        const guided = !hasConstraint || isOptionGuided(field, name, selection);
        option.classList.toggle("inv-cascade-guided", hasConstraint && guided);
        option.classList.toggle("inv-cascade-hidden", hasConstraint && !guided && mode === "guided");
      });
    });
  };

  let cascadeObserver = null;
  const ensureCascadeObserver = () => {
    if (cascadeObserver) {
      return;
    }
    const panel = findInvestigationPanel(window.document);
    if (!panel || typeof MutationObserver === "undefined") {
      return;
    }
    let scheduled = false;
    cascadeObserver = new MutationObserver(() => {
      if (scheduled) {
        return;
      }
      scheduled = true;
      window.requestAnimationFrame(() => {
        scheduled = false;
        applyCascade();
      });
    });
    cascadeObserver.observe(panel, { childList: true, subtree: true });
  };

  const bindCascadeToggle = () => {
    if (window.document.documentElement.dataset.invCascadeBound) {
      return;
    }
    window.document.documentElement.dataset.invCascadeBound = "true";
    window.document.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-cascade-set]");
      if (!btn) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setCascadeMode(btn.dataset.cascadeSet);
    }, true);
  };

  const mount = () => {
    mountInvestigationRecommendations(window.document);
    bindOptionFallback();
    bindRecommendationActions();
    ensureCascadeStyles();
    bindCascadeToggle();
    ensureCascadeObserver();
    applyCascade();
    const panel = findInvestigationPanel(window.document);
    if (panel && !panel.dataset.invRecBound) {
      panel.dataset.invRecBound = "true";
      RECOMMENDATION_UPDATE_EVENTS.forEach((eventName) => {
        panel.addEventListener(eventName, scheduleMount, true);
      });
      panel.addEventListener("change", applyCascade, true);
      panel.addEventListener("focusout", applyCascade, true);
    }
  };

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
