import { describe, expect, it } from "vitest";
import { COMPOUNDS } from "./compounds";
import { findCompoundEntryByName } from "./compoundLookup";

describe("findCompoundEntryByName", () => {
  it("resolves Inaxaplin with PubChem CID from seed", () => {
    const row = findCompoundEntryByName(COMPOUNDS, "Inaxaplin");
    expect(row?.pubchemCid).toBe(147289591);
    expect(row?.drugbank).toBe("DB17789");
  });

  it("resolves Venetoclax as an alternate demo compound with CID", () => {
    const row = findCompoundEntryByName(COMPOUNDS, "venetoclax");
    expect(row?.pubchemCid).toBe(49846579);
  });
});
