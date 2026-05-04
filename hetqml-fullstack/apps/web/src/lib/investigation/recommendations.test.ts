import { describe, it, expect } from "vitest";
import {
  evaluateInvestigation,
  getNextRecommendedField,
  allowedValuesForField,
  isOptionGuided,
  isCascadeFieldUnlocked,
  isOptionGuidedInCascade,
  emptySelection,
  CASCADE_ORDER,
  RECOMMENDATION_PROFILES,
} from "./recommendations";

describe("evaluateInvestigation", () => {
  it("scores the APOL1 Inaxaplin kidney investigation as a strong fit", () => {
    const result = evaluateInvestigation({
      disease: "Hypertension-attributed ESKD",
      compound: "Inaxaplin",
      gene: "APOL1",
      metaedge: "CtD · Compound–treats–Disease",
    });
    expect(result.label).toBe("Strong fit");
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.primaryRecommendation.compound).toBe("Inaxaplin");
    expect(result.missing).toHaveLength(0);
  });

  it("recommends remaining fields when only a compound is selected", () => {
    const result = evaluateInvestigation({
      ...emptySelection(),
      compound: "Deucravacitinib",
    });
    expect(result.primaryRecommendation.compound).toBe("Deucravacitinib");
    expect(result.primaryRecommendation.gene).toBe("TYK2");
    expect(result.primaryRecommendation.disease).toBe(
      "Systemic lupus erythematosus",
    );
    expect(result.missing).toEqual(["disease", "gene", "metaedge"]);
  });

  it("uses a selected compound as anchor when other fields conflict", () => {
    const result = evaluateInvestigation({
      disease: "Hypertension-attributed ESKD",
      compound: "Deucravacitinib",
      gene: "APOL1",
      metaedge: "CtD · Compound–treats–Disease",
    });
    expect(result.primaryRecommendation.compound).toBe("Deucravacitinib");
    expect(result.primaryRecommendation.gene).toBe("TYK2");
    expect(result.mismatched).toEqual(["disease", "gene"]);
  });
});

describe("getNextRecommendedField", () => {
  it("guides the user disease → compound → gene → metaedge", () => {
    expect(
      getNextRecommendedField({
        disease: "Hypertension-attributed ESKD",
        compound: "",
        gene: "",
        metaedge: "",
      }),
    ).toEqual({ field: "compound", label: "Compound", value: "Inaxaplin" });

    expect(
      getNextRecommendedField({
        disease: "Hypertension-attributed ESKD",
        compound: "Inaxaplin",
        gene: "",
        metaedge: "",
      }),
    ).toEqual({ field: "gene", label: "Anchor gene", value: "APOL1" });

    expect(
      getNextRecommendedField({
        disease: "Hypertension-attributed ESKD",
        compound: "Inaxaplin",
        gene: "APOL1",
        metaedge: "",
      }),
    ).toEqual({
      field: "metaedge",
      label: "Metaedge",
      value: "CtD · Compound–treats–Disease",
    });
  });

  it("returns null when all four fields align with the recommendation", () => {
    expect(
      getNextRecommendedField({
        disease: "Hypertension-attributed ESKD",
        compound: "Inaxaplin",
        gene: "APOL1",
        metaedge: "CtD · Compound–treats–Disease",
      }),
    ).toBeNull();
  });
});

describe("cascade order", () => {
  it("is disease → compound → gene → metaedge", () => {
    expect(CASCADE_ORDER).toEqual([
      "disease",
      "compound",
      "gene",
      "metaedge",
    ]);
  });

  it("ships at least 6 profiles", () => {
    expect(RECOMMENDATION_PROFILES.length).toBeGreaterThanOrEqual(6);
  });
});

describe("allowedValuesForField", () => {
  it("returns null when no upstream is set", () => {
    expect(allowedValuesForField("disease", emptySelection())).toBeNull();
    expect(allowedValuesForField("compound", emptySelection())).toBeNull();
  });

  it("constrains compound options to profiles matching disease (exact)", () => {
    const allowed = allowedValuesForField("compound", {
      ...emptySelection(),
      disease: "Hypertension-attributed ESKD",
    });
    expect(allowed).toBeInstanceOf(Set);
    expect(allowed?.has("Inaxaplin")).toBe(true);
    expect(allowed?.has("Empagliflozin")).toBe(false);
    expect(allowed?.has("Deucravacitinib")).toBe(false);
  });

  it("constrains gene options to profiles matching disease + compound", () => {
    const allowed = allowedValuesForField("gene", {
      ...emptySelection(),
      disease: "Hypertension-attributed ESKD",
      compound: "Inaxaplin",
    });
    expect(allowed?.has("APOL1")).toBe(true);
    expect(allowed?.has("TYK2")).toBe(false);
  });

  it("returns empty set when upstream selection has no profile", () => {
    const allowed = allowedValuesForField("compound", {
      ...emptySelection(),
      disease: "Some unmapped disease",
    });
    expect(allowed?.size).toBe(0);
  });

  it("does not constrain a field by itself", () => {
    expect(
      allowedValuesForField("disease", {
        ...emptySelection(),
        disease: "Hypertension-attributed ESKD",
      }),
    ).toBeNull();
  });
});

describe("isOptionGuided", () => {
  it("permits any option when there is no upstream constraint", () => {
    expect(isOptionGuided("compound", "Random Drug", emptySelection())).toBe(
      true,
    );
  });

  it("rejects compounds inconsistent with the chosen disease", () => {
    const sel = {
      ...emptySelection(),
      disease: "Hypertension-attributed ESKD",
    };
    expect(isOptionGuided("compound", "Inaxaplin", sel)).toBe(true);
    expect(isOptionGuided("compound", "Deucravacitinib", sel)).toBe(false);
  });
});

describe("isCascadeFieldUnlocked", () => {
  it("unlocks disease always; gates compound/gene/metaedge on upstream", () => {
    const empty = emptySelection();
    expect(isCascadeFieldUnlocked("disease", empty)).toBe(true);
    expect(isCascadeFieldUnlocked("compound", empty)).toBe(false);
    expect(isCascadeFieldUnlocked("gene", empty)).toBe(false);
    expect(isCascadeFieldUnlocked("metaedge", empty)).toBe(false);

    const d = {
      ...empty,
      disease: "Hypertension-attributed ESKD",
    };
    expect(isCascadeFieldUnlocked("compound", d)).toBe(true);
    expect(isCascadeFieldUnlocked("gene", d)).toBe(false);

    const dc = { ...d, compound: "Inaxaplin" };
    expect(isCascadeFieldUnlocked("gene", dc)).toBe(true);
    expect(isCascadeFieldUnlocked("metaedge", dc)).toBe(false);

    const dcg = { ...dc, gene: "APOL1" };
    expect(isCascadeFieldUnlocked("metaedge", dcg)).toBe(true);
  });
});

describe("isOptionGuidedInCascade", () => {
  it("in guided mode limits disease to names that appear in a profile", () => {
    const sel = emptySelection();
    expect(
      isOptionGuidedInCascade("disease", "Hypertension-attributed ESKD", sel),
    ).toBe(true);
    expect(isOptionGuidedInCascade("disease", "Not a catalog disease", sel)).toBe(
      false,
    );
  });

  it("matches isOptionGuided for non-disease fields", () => {
    const sel = {
      ...emptySelection(),
      disease: "Hypertension-attributed ESKD",
    };
    expect(isOptionGuidedInCascade("compound", "Inaxaplin", sel)).toBe(
      isOptionGuided("compound", "Inaxaplin", sel),
    );
  });
});
