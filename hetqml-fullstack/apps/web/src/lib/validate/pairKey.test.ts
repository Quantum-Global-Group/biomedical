import { describe, expect, it } from "vitest";
import { buildPairKey } from "./pairKey";

const compounds = [
  { name: "Inaxaplin", drugbank: "DB17789", category: "targeted-therapy" },
  { name: "Empagliflozin", drugbank: "DB09038", category: "metabolic" },
] as const;

const diseases = [
  { name: "Hypertension-attributed ESKD", doid: "DOID:2451", category: "renal" },
  { name: "Systemic lupus erythematosus", doid: "DOID:9074", category: "autoimmune" },
] as const;

describe("buildPairKey", () => {
  it("resolves compound + disease names to drugbank::doid", () => {
    expect(
      buildPairKey(
        {
          compound: "Inaxaplin",
          disease: "Hypertension-attributed ESKD",
        },
        { compounds, diseases },
      ),
    ).toBe("DB17789::DOID:2451");
  });

  it("falls back to the literal name when catalog has no entry", () => {
    expect(
      buildPairKey(
        { compound: "Mystery Drug", disease: "Hypertension-attributed ESKD" },
        { compounds, diseases },
      ),
    ).toBe("Mystery Drug::DOID:2451");
  });

  it("falls back on both sides when catalogs are empty", () => {
    expect(
      buildPairKey(
        { compound: "X", disease: "Y" },
        { compounds: [], diseases: [] },
      ),
    ).toBe("X::Y");
  });
});
