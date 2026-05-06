/**
 * Canonical Hetionet v1.0 totals — the "TOTAL IN HETIONET" suffix on the
 * Initialize comboboxes. The live `/catalog/*` envelopes only return the
 * curated subset (the entries that have a complete row of metadata); this
 * file is the upstream-of-Hetionet count quoted in the static export and
 * the plan, and is what reviewers expect to see in the count line.
 *
 * If the backend ever exposes these, swap to the live values.
 */
export const HETIONET_TOTALS = {
  diseases: "137 total in Hetionet",
  compounds: "1,552 total in Hetionet",
  genes: "20,945 total in Hetionet",
  metaedges: "24 metaedges · 2,250,197 edges",
} as const;
