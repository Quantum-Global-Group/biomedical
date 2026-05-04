import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const moduleSource = await readFile(
  new URL("./investigation-recommendations.js", import.meta.url),
  "utf8",
);
const {
  evaluateInvestigation,
  getNextRecommendedField,
  renderInvestigationRecommendations,
  RECOMMENDATION_PROFILES,
  RECOMMENDATION_UPDATE_EVENTS,
  isParameterPlaceholder,
  shouldDeferRecommendationUpdate,
  allowedValuesForField,
  isOptionGuided,
  CASCADE_ORDER,
} = await import(`data:text/javascript,${encodeURIComponent(moduleSource)}`);

test("scores the APOL1 Inaxaplin kidney investigation as a strong fit", () => {
  const result = evaluateInvestigation({
    disease: "Hypertension-attributed ESKD",
    compound: "Inaxaplin",
    gene: "APOL1",
    metaedge: "CtD · Compound–treats–Disease",
  });

  assert.equal(result.label, "Strong fit");
  assert.equal(result.score >= 90, true);
  assert.equal(result.primaryRecommendation.compound, "Inaxaplin");
  assert.equal(result.missing.length, 0);
});

test("recommends the remaining fields when only a compound is selected", () => {
  const result = evaluateInvestigation({
    disease: "",
    compound: "Deucravacitinib",
    gene: "",
    metaedge: "",
  });

  assert.equal(result.primaryRecommendation.compound, "Deucravacitinib");
  assert.equal(result.primaryRecommendation.gene, "TYK2");
  assert.equal(result.primaryRecommendation.disease, "Systemic lupus erythematosus");
  assert.deepEqual(result.missing, ["disease", "gene", "metaedge"]);
});

test("uses a selected compound as the recommendation anchor when other fields conflict", () => {
  const result = evaluateInvestigation({
    disease: "Hypertension-attributed ESKD",
    compound: "Deucravacitinib",
    gene: "APOL1",
    metaedge: "CtD · Compound–treats–Disease",
  });

  assert.equal(result.primaryRecommendation.compound, "Deucravacitinib");
  assert.equal(result.primaryRecommendation.gene, "TYK2");
  assert.deepEqual(result.mismatched, ["disease", "gene"]);
});

test("renders recommendation markup with a score, recommended combination, and rationale", () => {
  const html = renderInvestigationRecommendations({
    disease: "Hypertension-attributed ESKD",
    compound: "Inaxaplin",
    gene: "APOL1",
    metaedge: "CtD · Compound–treats–Disease",
  });

  assert.equal(RECOMMENDATION_PROFILES.length >= 5, true);
  assert.match(html, /data-investigation-recommendations/);
  assert.match(html, /Strong fit/);
  assert.match(html, /Recommended combination/);
  assert.match(html, /APOL1 ancestry-aware kidney signal/);
});

test("guides the next recommended field in disease to compound to gene to metaedge order", () => {
  assert.deepEqual(
    getNextRecommendedField({
      disease: "Hypertension-attributed ESKD",
      compound: "",
      gene: "",
      metaedge: "",
    }),
    {
      field: "compound",
      label: "Compound",
      value: "Inaxaplin",
    },
  );

  assert.deepEqual(
    getNextRecommendedField({
      disease: "Hypertension-attributed ESKD",
      compound: "Inaxaplin",
      gene: "",
      metaedge: "",
    }),
    {
      field: "gene",
      label: "Anchor gene",
      value: "APOL1",
    },
  );

  assert.deepEqual(
    getNextRecommendedField({
      disease: "Hypertension-attributed ESKD",
      compound: "Inaxaplin",
      gene: "APOL1",
      metaedge: "",
    }),
    {
      field: "metaedge",
      label: "Metaedge",
      value: "CtD · Compound–treats–Disease",
    },
  );
});

test("renders the next recommended field as a clickable action", () => {
  const html = renderInvestigationRecommendations({
    disease: "Hypertension-attributed ESKD",
    compound: "",
    gene: "",
    metaedge: "",
  });

  assert.match(html, /data-apply-recommendation="compound"/);
  assert.match(html, /Click recommended compound/);
  assert.match(html, /Inaxaplin/);
});

test("renders all recommendation fields with click metadata", () => {
  const html = renderInvestigationRecommendations({
    disease: "Hypertension-attributed ESKD",
    compound: "Inaxaplin",
    gene: "",
    metaedge: "",
  });

  assert.match(html, /data-recommended-field="compound"/);
  assert.match(html, /data-recommended-field="gene"/);
  assert.match(html, /data-recommended-field="metaedge"/);
});

test("locks every tile except the current step in the disease to compound to gene to metaedge sequence", () => {
  const tileFor = (html, field) => {
    const match = html.match(new RegExp(`<button[^>]*data-recommended-field="${field}"[^>]*>`));
    return match ? match[0] : "";
  };
  const isLocked = (tile) => tile.includes("locked") && tile.includes("disabled");

  const afterDisease = renderInvestigationRecommendations({
    disease: "Hypertension-attributed ESKD",
    compound: "",
    gene: "",
    metaedge: "",
  });
  assert.equal(isLocked(tileFor(afterDisease, "disease")), true);
  assert.equal(isLocked(tileFor(afterDisease, "compound")), false);
  assert.equal(isLocked(tileFor(afterDisease, "gene")), true);
  assert.equal(isLocked(tileFor(afterDisease, "metaedge")), true);

  const afterCompound = renderInvestigationRecommendations({
    disease: "Hypertension-attributed ESKD",
    compound: "Inaxaplin",
    gene: "",
    metaedge: "",
  });
  assert.equal(isLocked(tileFor(afterCompound, "compound")), true);
  assert.equal(isLocked(tileFor(afterCompound, "gene")), false);
  assert.equal(isLocked(tileFor(afterCompound, "metaedge")), true);

  const afterGene = renderInvestigationRecommendations({
    disease: "Hypertension-attributed ESKD",
    compound: "Inaxaplin",
    gene: "APOL1",
    metaedge: "",
  });
  assert.equal(isLocked(tileFor(afterGene, "gene")), true);
  assert.equal(isLocked(tileFor(afterGene, "metaedge")), false);

  const complete = renderInvestigationRecommendations({
    disease: "Hypertension-attributed ESKD",
    compound: "Inaxaplin",
    gene: "APOL1",
    metaedge: "CtD · Compound–treats–Disease",
  });
  assert.equal(isLocked(tileFor(complete, "disease")), false);
  assert.equal(isLocked(tileFor(complete, "compound")), false);
  assert.equal(isLocked(tileFor(complete, "gene")), false);
  assert.equal(isLocked(tileFor(complete, "metaedge")), false);
});

test("defers recommendation rerender while a parameter combobox is open and temporarily empty", () => {
  assert.equal(
    shouldDeferRecommendationUpdate(
      {
        disease: "Hypertension-attributed ESKD",
        compound: "",
        gene: "APOL1",
        metaedge: "CtD · Compound–treats–Disease",
      },
      "Search 1,552 compounds (DrugBank)...",
    ),
    true,
  );

  assert.equal(
    shouldDeferRecommendationUpdate(
      {
        disease: "Hypertension-attributed ESKD",
        compound: "Deucravacitinib",
        gene: "APOL1",
        metaedge: "CtD · Compound–treats–Disease",
      },
      "Search 1,552 compounds (DrugBank)...",
    ),
    false,
  );
});

test("does not subscribe recommendation updates to combobox click or input events", () => {
  assert.deepEqual(RECOMMENDATION_UPDATE_EVENTS, ["change", "focusout", "keyup"]);
});

test("recognizes only investigation parameter inputs for selection fallback", () => {
  assert.equal(isParameterPlaceholder("Search 1,552 compounds (DrugBank)..."), true);
  assert.equal(isParameterPlaceholder("Filter saved sessions..."), false);
});

test("cascades guided values disease to compound to gene to metaedge", () => {
  assert.deepEqual(CASCADE_ORDER, ["disease", "compound", "gene", "metaedge"]);
});

test("returns null allowed set when no upstream field is selected", () => {
  assert.equal(
    allowedValuesForField("disease", { disease: "", compound: "", gene: "", metaedge: "" }),
    null,
  );
});

test("constrains compound options to profiles that match the selected disease", () => {
  const allowed = allowedValuesForField("compound", {
    disease: "Hypertension-attributed ESKD",
    compound: "",
    gene: "",
    metaedge: "",
  });

  assert.ok(allowed instanceof Set);
  assert.equal(allowed.has("Inaxaplin"), true);
  assert.equal(allowed.has("Deucravacitinib"), false);
  assert.equal(allowed.has("Empagliflozin"), false);
});

test("constrains gene options to profiles that match disease and compound", () => {
  const allowed = allowedValuesForField("gene", {
    disease: "Hypertension-attributed ESKD",
    compound: "Inaxaplin",
    gene: "",
    metaedge: "",
  });

  assert.equal(allowed.has("APOL1"), true);
  assert.equal(allowed.has("TYK2"), false);
});

test("falls back to wider profile match when only a downstream field is set", () => {
  const allowed = allowedValuesForField("metaedge", {
    disease: "",
    compound: "Venetoclax",
    gene: "",
    metaedge: "",
  });

  assert.equal(allowed.has("CtD · Compound–treats–Disease"), true);
});

test("returns empty allowed set when upstream selection has no matching profile", () => {
  const allowed = allowedValuesForField("compound", {
    disease: "Some unmapped disease that nothing matches",
    compound: "",
    gene: "",
    metaedge: "",
  });

  assert.ok(allowed instanceof Set);
  assert.equal(allowed.size, 0);
});

test("does not constrain a field by itself", () => {
  const allowed = allowedValuesForField("disease", {
    disease: "Hypertension-attributed ESKD",
    compound: "",
    gene: "",
    metaedge: "",
  });

  assert.equal(allowed, null);
});

test("isOptionGuided is permissive when there is no upstream constraint", () => {
  assert.equal(
    isOptionGuided("compound", "Random Drug", { disease: "", compound: "", gene: "", metaedge: "" }),
    true,
  );
});

test("isOptionGuided rejects compounds that do not match the chosen disease", () => {
  const selection = { disease: "Hypertension-attributed ESKD", compound: "", gene: "", metaedge: "" };

  assert.equal(isOptionGuided("compound", "Inaxaplin", selection), true);
  assert.equal(isOptionGuided("compound", "Deucravacitinib", selection), false);
});
