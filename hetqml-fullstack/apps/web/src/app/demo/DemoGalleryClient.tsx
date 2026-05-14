"use client";

import Link from "next/link";
import { DEMO_GALLERY_ENTRIES } from "@/lib/demo/gallery";
import { isLiteMode } from "@/lib/liteMode";

export function DemoGalleryClient() {
  const lite = isLiteMode();
  return (
    <>
      <div className="page-hero">
        <div>
          <div className="step">DEMO · GALLERY</div>
          <h1 className="h1">Canned investigations</h1>
          <p className="lede">
            Stable bookmarkable URLs for booths and reviews. Start the API with{" "}
            <code>HETQML_SEED_DEMO_JOBS=1</code> so these ids resolve (see full-stack{" "}
            README).
          </p>
        </div>
        <span className="pill">● curated</span>
      </div>
      {lite ? (
        <div className="panel">
          <p className="panel-purpose">
            The lite static export cannot reach a local FastAPI job store.
            Serve the full web app plus API, or use a remote{" "}
            <code>NEXT_PUBLIC_API_URL</code> backed by seeded jobs.
          </p>
        </div>
      ) : (
        <div className="grid-7-5" style={{ gap: 16 }}>
          {DEMO_GALLERY_ENTRIES.map((e) => (
            <section key={e.id} className="panel" data-testid={`demo-card-${e.family}`}>
              <div className="panel-head">
                <div>
                  <div className="eyebrow">{e.family.toUpperCase()} · FIXED ID</div>
                  <div className="panel-title">{e.label}</div>
                </div>
              </div>
              <code
                style={{
                  display: "block",
                  marginTop: 8,
                  marginBottom: 12,
                  fontSize: 11,
                  wordBreak: "break-all",
                }}
              >
                jobId={e.id}
              </code>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <Link
                  className="btn-primary"
                  href={`/experiment?jobId=${encodeURIComponent(e.id)}`}
                >
                  Experiment
                </Link>
                <Link className="btn" href={`/validate?jobId=${encodeURIComponent(e.id)}`}>
                  Validate
                </Link>
                <Link className="btn" href={`/visualize?jobId=${encodeURIComponent(e.id)}`}>
                  Visualize
                </Link>
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
