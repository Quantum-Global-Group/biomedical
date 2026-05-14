/**
 * Canonical demo job ids seeded when API runs with `HETQML_SEED_DEMO_JOBS=1`.
 * Keep in sync with `hetqml_api.jobs.demo_jobs.DEMO_JOB_SPECS`.
 */
export const DEMO_GALLERY_ENTRIES = [
  {
    id: "hetqml-demo-classical-v1",
    label: "Demo · Classical headline",
    family: "classical" as const,
  },
  {
    id: "hetqml-demo-hybrid-v1",
    label: "Demo · Hybrid kernel (Aer)",
    family: "hybrid" as const,
  },
  {
    id: "hetqml-demo-quantum-aer-v1",
    label: "Demo · Quantum path (IBM or Aer fallback)",
    family: "quantum" as const,
  },
] as const;
