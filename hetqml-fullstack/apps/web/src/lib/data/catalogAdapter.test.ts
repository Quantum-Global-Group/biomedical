import { describe, expect, it } from "vitest";
import {
  adaptAlgorithmsToGroups,
  adaptCompound,
  adaptDisease,
  adaptGene,
  adaptMetaedge,
  pickGeneralist,
} from "./catalogAdapter";
import type { CatalogGroup } from "./algorithmCatalog";

describe("adapter helpers", () => {
  it("adapts a disease entry verbatim", () => {
    expect(
      adaptDisease({ name: "X", doid: "DOID:1", category: "renal" }),
    ).toEqual({ name: "X", doid: "DOID:1", category: "renal" });
  });

  it("maps drugbankId → drugbank and therapeuticClass → category", () => {
    expect(
      adaptCompound({
        name: "X",
        drugbankId: "DB1",
        therapeuticClass: "kinase-inhibitor",
        fdaApproved: true,
        pubchemCid: 12345,
      }),
    ).toEqual({
      name: "X",
      drugbank: "DB1",
      category: "kinase-inhibitor",
      pubchemCid: 12345,
    });
  });

  it("normalizes a missing pubchem CID to null", () => {
    expect(
      adaptCompound({
        name: "Y",
        drugbankId: "DB2",
        therapeuticClass: "metabolic",
        fdaApproved: false,
        pubchemCid: null,
      }),
    ).toEqual({
      name: "Y",
      drugbank: "DB2",
      category: "metabolic",
      pubchemCid: null,
    });
  });

  it("fills PubChem CID from local seed when API omits it (demo compounds)", () => {
    expect(
      adaptCompound({
        name: "Inaxaplin",
        drugbankId: "DB17789",
        therapeuticClass: "small-molecule",
        fdaApproved: false,
        pubchemCid: null,
      }),
    ).toMatchObject({
      name: "Inaxaplin",
      drugbank: "DB17789",
      pubchemCid: 147289591,
    });
  });

  it("keeps API PubChem CID when present (Venetoclax)", () => {
    expect(
      adaptCompound({
        name: "Venetoclax",
        drugbankId: "DB11581",
        therapeuticClass: "antineoplastic",
        fdaApproved: true,
        pubchemCid: 49846579,
      }),
    ).toEqual({
      name: "Venetoclax",
      drugbank: "DB11581",
      category: "antineoplastic",
      pubchemCid: 49846579,
    });
  });

  it("prefixes ncbiId with NCBIGene: when missing", () => {
    expect(
      adaptGene({ symbol: "APOL1", ncbiId: "8542", category: "immune" }),
    ).toEqual({ name: "APOL1", ncbi: "NCBIGene:8542", category: "immune" });
    expect(
      adaptGene({
        symbol: "APOL1",
        ncbiId: "NCBIGene:8542",
        category: "immune",
      }),
    ).toEqual({ name: "APOL1", ncbi: "NCBIGene:8542", category: "immune" });
  });

  it("formats metaedge name as code · label", () => {
    expect(
      adaptMetaedge({
        code: "CtD",
        label: "Compound–treats–Disease",
        edgeCount: 755,
      }),
    ).toEqual({
      name: "CtD · Compound–treats–Disease",
      description: "Compound–treats–Disease",
      edges: 755,
      directed: false,
    });
  });

  it("groups algorithm entries by group field", () => {
    const groups = adaptAlgorithmsToGroups([
      {
        name: "QSVC",
        group: "Quantum kernels",
        family: "hybrid",
        mech: "z",
        params: "16p",
        runtime: "~2m",
        status: "live",
      },
      {
        name: "VQC",
        group: "Variational quantum",
        family: "hybrid",
        mech: "v",
        params: "24p",
        runtime: "~3m",
        status: "live",
      },
      {
        name: "QSVC2",
        group: "Quantum kernels",
        family: "hybrid",
        mech: "z2",
        params: "12p",
        runtime: "~2m",
        status: "dev",
      },
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0]!.name).toBe("Quantum kernels");
    expect(groups[0]!.rows).toHaveLength(2);
    expect(groups[1]!.name).toBe("Variational quantum");
  });
});

describe("pickGeneralist", () => {
  const groups: CatalogGroup[] = [
    {
      name: "Hybrid quantum-classical",
      rows: [
        {
          name: "Quantum Kernel + Metapath",
          mech: "metapath",
          path: "hybrid",
          params: "28p",
          runtime: "~3m",
          status: "live",
        },
      ],
    },
    {
      name: "Quantum kernels",
      rows: [
        {
          name: "QSVC (Pauli)",
          mech: "Pauli",
          path: "hybrid",
          params: "16p",
          runtime: "~2m",
          status: "live",
        },
      ],
    },
    {
      name: "Classical baselines",
      rows: [
        {
          name: "Stacking",
          mech: "ensemble",
          path: "classical",
          params: "12c",
          runtime: "~45s",
          status: "live",
        },
        {
          name: "XGBoost",
          mech: "gbdt",
          path: "classical",
          params: "np",
          runtime: "~30s",
          status: "live",
        },
      ],
    },
    {
      name: "Variational quantum",
      rows: [
        {
          name: "QAOA",
          mech: "cost+mixer",
          path: "quantum",
          params: "36p",
          runtime: "~5m",
          status: "live",
        },
      ],
    },
  ];

  it("picks Stacking for classical (Classical baselines group ranks first)", () => {
    expect(pickGeneralist("classical", groups)?.name).toBe("Stacking");
  });

  it("picks Hybrid Quantum Kernel + Metapath for hybrid", () => {
    expect(pickGeneralist("hybrid", groups)?.name).toBe(
      "Quantum Kernel + Metapath",
    );
  });

  it("picks QAOA for quantum", () => {
    expect(pickGeneralist("quantum", groups)?.name).toBe("QAOA");
  });

  it("returns null when no algorithm matches the family", () => {
    expect(pickGeneralist("quantum", groups.slice(0, 1))).toBeNull();
  });

  it("is stable: same input always returns the same row", () => {
    const a = pickGeneralist("classical", groups);
    const b = pickGeneralist("classical", groups);
    expect(a?.name).toBe(b?.name);
  });
});
