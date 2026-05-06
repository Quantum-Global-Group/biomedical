"use client";

// MoleculeViewerPanel — real 3Dmol.js viewer + PubChem proxy fetch.
//
// Engine is loaded via a runtime `import("3dmol")` so:
//   - SSR never touches the WebGL/jQuery globals 3Dmol injects
//   - the lite (HF Space) build can DCE the entire module graph by
//     keeping the dynamic-import literal behind an `IS_LITE` guard
//     (mirrors the MiniKgPreview dispatcher pattern)
//
// Data flow:
//   compound name → useCatalogs() lookup → PubChem CID
//                → /molecule/{cid} (cached) → SDF text
//                → viewer.addModel(text, "sdf")

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getMoleculeSdf } from "@/lib/api/client";
import { useCatalogs } from "@/lib/data/useCatalogs";
import { emitVizSync } from "@/lib/visualize/syncBus";

const IS_LITE = process.env.NEXT_PUBLIC_LITE_MODE === "true";

type StyleId = "stick" | "sphere" | "ball-and-stick" | "line";

interface Props {
  compound: string;
  disease: string;
  /** Whether auto-sync is enabled. When true, clicking the panel
   * broadcasts the compound/disease via the viz-sync bus. */
  autoSync: boolean;
}

const STYLE_OPTIONS: { id: StyleId; label: string }[] = [
  { id: "stick", label: "Stick" },
  { id: "ball-and-stick", label: "Ball + stick" },
  { id: "sphere", label: "Sphere" },
  { id: "line", label: "Line" },
];

// The 3Dmol API is loosely typed; we narrow the surface we actually
// use rather than depending on an external @types package.
interface ThreeDMolViewer {
  addModel: (data: string, format: string) => unknown;
  setStyle: (sel: object, style: object) => void;
  zoomTo: () => void;
  render: () => void;
  zoom: (factor: number, durationMs?: number) => void;
  spin?: (axis: string | boolean) => void;
  clear: () => void;
  resize: () => void;
}

interface ThreeDMolGlobal {
  createViewer: (
    element: HTMLElement,
    config: { backgroundColor?: string },
  ) => ThreeDMolViewer;
}

function styleSelector(style: StyleId): object {
  switch (style) {
    case "stick":
      return { stick: { radius: 0.18 } };
    case "ball-and-stick":
      return { stick: { radius: 0.14 }, sphere: { scale: 0.22 } };
    case "sphere":
      return { sphere: { scale: 0.6 } };
    case "line":
      return { line: { linewidth: 1.4 } };
  }
}

export function MoleculeViewerPanel({ compound, disease, autoSync }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<ThreeDMolViewer | null>(null);
  const [style, setStyle] = useState<StyleId>("stick");
  const [spin, setSpin] = useState(false);
  const [phase, setPhase] = useState<
    "idle" | "loading" | "ready" | "error" | "no-cid"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const catalogs = useCatalogs();
  const compoundEntry = useMemo(
    () => catalogs.compounds.find((c) => c.name === compound) ?? null,
    [catalogs.compounds, compound],
  );
  const cid = compoundEntry?.pubchemCid ?? null;

  const onPanelClick = useCallback(() => {
    if (!autoSync) return;
    if (!compound || !disease) return;
    emitVizSync({ compound, disease, source: "molecule" });
  }, [autoSync, compound, disease]);

  // Engine bootstrap + SDF fetch. Re-runs on CID change. Returns a
  // cleanup that disposes the viewer DOM so route navigation doesn't
  // leak WebGL contexts.
  useEffect(() => {
    if (IS_LITE) {
      // Lite build never loads 3Dmol; render the fallback state.
      setPhase("no-cid");
      return;
    }
    if (!cid) {
      setPhase("no-cid");
      return;
    }
    const stage = stageRef.current;
    if (!stage) return;

    let cancelled = false;
    setPhase("loading");
    setErrorMessage(null);

    (async () => {
      try {
        // Wrap 3dmol in a separate dynamic import so the chunk only
        // loads when this panel actually renders. The library expects
        // window/document — guarded by `'use client'` + the IS_LITE
        // bypass above.
        const moduleNs = (await import("3dmol")) as unknown;
        const $3Dmol = (moduleNs as { default?: ThreeDMolGlobal })
          .default ?? (moduleNs as ThreeDMolGlobal);
        if (cancelled) return;

        // Reset stage between runs — 3Dmol mutates the host element.
        stage.innerHTML = "";
        const viewer = $3Dmol.createViewer(stage, {
          backgroundColor: "#0e0e10",
        });
        viewerRef.current = viewer;

        let sdf: string;
        try {
          sdf = await getMoleculeSdf(cid);
        } catch (err) {
          if (cancelled) return;
          setPhase("error");
          setErrorMessage(
            err instanceof Error ? err.message : String(err),
          );
          return;
        }
        if (cancelled) return;

        viewer.addModel(sdf, "sdf");
        viewer.setStyle({}, styleSelector(style));
        viewer.zoomTo();
        viewer.render();
        viewer.zoom(1.1, 600);
        setPhase("ready");
      } catch (err) {
        if (cancelled) return;
        setPhase("error");
        setErrorMessage(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      cancelled = true;
      const viewer = viewerRef.current;
      if (viewer) {
        try {
          viewer.clear();
        } catch {
          // 3Dmol clear can throw if the canvas was already removed —
          // safe to ignore on cleanup.
        }
      }
      viewerRef.current = null;
      if (stage) stage.innerHTML = "";
    };
    // We deliberately omit `style` from deps — re-applying style is
    // handled in the next effect to avoid tearing down the viewer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cid]);

  // Re-apply style on toggle without rebuilding the viewer.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || phase !== "ready") return;
    viewer.setStyle({}, styleSelector(style));
    viewer.render();
  }, [style, phase]);

  // Spin toggle.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || phase !== "ready" || !viewer.spin) return;
    viewer.spin(spin ? "y" : false);
  }, [spin, phase]);

  const status =
    phase === "loading"
      ? "● fetching SDF"
      : phase === "ready"
        ? "● live"
        : phase === "error"
          ? "● error"
          : phase === "no-cid"
            ? "○ no PubChem CID"
            : "○ idle";

  const statusBg =
    phase === "ready"
      ? "var(--green-bg)"
      : phase === "error"
        ? "var(--sienna-bg)"
        : "var(--paper-alt)";
  const statusColor =
    phase === "ready"
      ? "var(--green)"
      : phase === "error"
        ? "var(--sienna)"
        : "var(--muted)";

  return (
    <section
      className="panel"
      data-panel="molecule-3d"
      onClick={onPanelClick}
      style={{ cursor: autoSync ? "pointer" : "default" }}
    >
      <div className="panel-head">
        <div>
          <div className="eyebrow">VIEW · 3D MOLECULE</div>
          <div className="panel-title">{compound || "Compound"}</div>
        </div>
        <span
          className="pill"
          style={{ background: statusBg, color: statusColor }}
        >
          {status}
        </span>
      </div>
      <p className="panel-purpose">
        Atomic-resolution view of the candidate compound. Drag to rotate
        · scroll to zoom. SDF served via the API&apos;s cached PubChem
        proxy.
      </p>

      {/* Style toggle row — disabled until the viewer is live. */}
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          margin: "0 0 10px",
          fontSize: 11,
        }}
      >
        {STYLE_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className="btn"
            onClick={(e) => {
              e.stopPropagation();
              setStyle(opt.id);
            }}
            disabled={phase !== "ready"}
            style={{
              padding: "4px 10px",
              fontSize: 11,
              background:
                style === opt.id ? "var(--gold-bg)" : "var(--paper-alt)",
              color: style === opt.id ? "var(--gold)" : "var(--muted)",
              borderColor:
                style === opt.id ? "var(--gold)" : "var(--border)",
            }}
          >
            {opt.label}
          </button>
        ))}
        <button
          type="button"
          className="btn"
          onClick={(e) => {
            e.stopPropagation();
            setSpin((s) => !s);
          }}
          disabled={phase !== "ready"}
          style={{
            padding: "4px 10px",
            fontSize: 11,
            marginLeft: "auto",
            background: spin ? "var(--teal-bg)" : "var(--paper-alt)",
            color: spin ? "var(--teal)" : "var(--muted)",
            borderColor: spin ? "var(--teal)" : "var(--border)",
          }}
          title="Toggle auto-rotate"
        >
          ↻ {spin ? "Spinning" : "Spin"}
        </button>
      </div>

      <div
        style={{
          position: "relative",
          height: 320,
          border: "1px solid var(--border-soft)",
          borderRadius: 6,
          background:
            "radial-gradient(ellipse at center, #1a1612 0%, #0f0c09 80%)",
          overflow: "hidden",
        }}
      >
        <div
          ref={stageRef}
          role="img"
          aria-label={`3D molecule viewer: ${compound || "compound"}`}
          style={{ position: "absolute", inset: 0 }}
        />
        {phase !== "ready" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color:
                phase === "error" ? "var(--amber)" : "var(--faint)",
              fontFamily: "var(--font-mono), monospace",
              padding: "0 24px",
              textAlign: "center",
              pointerEvents: "none",
            }}
          >
            {phase === "loading" && "loading 3Dmol.js…"}
            {phase === "no-cid" &&
              (IS_LITE
                ? "lite build · 3D viewer omitted"
                : "no PubChem CID for this compound")}
            {phase === "error" &&
              `unable to load 3D structure · ${errorMessage ?? "unknown error"}`}
            {phase === "idle" && "preparing viewer…"}
          </div>
        )}
      </div>

      <div className="panel-footer" style={{ marginTop: 12 }}>
        <span>
          formula :: {compoundEntry?.drugbank ?? "—"}
          {compoundEntry?.category ? ` · ${compoundEntry.category}` : ""}
        </span>
        <span>
          <em>
            {cid ? `PubChem CID ${cid}` : "no PubChem mapping"}
          </em>
        </span>
      </div>
    </section>
  );
}
