/**
 * DataProvenanceCallout
 *
 * Surfaces the dashboard's data-ingestion posture on the Initialize page so a
 * reviewer can answer "is this real Hetionet data?" without reading the source.
 *
 * Key claim: the compound / disease / gene catalogs ARE curated subsets of
 * Hetionet v1.0 (real DOID / DrugBank / NCBI Gene identifiers), but they are
 * bundled at build time for fast local iteration, not pulled live from the KG.
 * Full live ingestion lives in the sibling hybrid-qml-kg-poc/ repository's
 * bootstrap CI.
 */
export function DataProvenanceCallout() {
  return (
    <div
      style={{
        marginTop: 12,
        marginBottom: 8,
        padding: "10px 14px",
        background: "var(--paper-alt, #161310)",
        border: "1px solid var(--border-soft, #332D27)",
        borderLeft: "3px solid var(--gold, #C8A45A)",
        borderRadius: 4,
        fontSize: 12,
        lineHeight: 1.6,
        color: "var(--muted)",
      }}
      role="note"
    >
      <div
        style={{
          fontSize: 10,
          color: "var(--gold)",
          fontFamily: "var(--font-mono, monospace)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: 4,
          fontWeight: 600,
        }}
      >
        ⓘ Data provenance
      </div>
      <p style={{ margin: 0 }}>
        Compound, disease, and gene catalogs are curated subsets of{" "}
        <strong>Hetionet v1.0</strong> (DOI{" "}
        <code>10.7554/eLife.26726</code>). Selectors use real{" "}
        <strong>DOID</strong>, <strong>DrugBank</strong>, and{" "}
        <strong>NCBI Gene</strong> identifiers — but the catalog is pre-bundled
        at build time for fast iteration in this dashboard, not pulled live
        from the KG on each run.
      </p>
      <p style={{ margin: "4px 0 0 0" }}>
        Full Hetionet ingestion (47k+ compounds, 137 metaedge types, real edge
        weights) lives in <code>hybrid-qml-kg-poc/</code> bootstrap CI. Edge
        weights surfaced in Visualize → Path Diagram are baked at build time;
        do not assume live querying.
      </p>
    </div>
  );
}
