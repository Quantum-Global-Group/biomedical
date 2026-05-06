"use client";

// UmapScatterPanel — real Three.js scatter over JobResult.embedding.
//
// Engine is loaded via `import("three")` so:
//   - SSR never instantiates a WebGL context
//   - the lite build keeps the import literal behind an IS_LITE guard;
//     turbopack DCEs the chunk in the lite production trace.
//
// Coords come from `JobResult.embedding` (one row per
// `candidateSpotlight.ranking` row, in matching order). Color encodes
// score bucket (gold = focus pair, teal = strong, amber = weak); the
// focus pair gets a pulsing ring overlay so it reads at a glance even
// in tight clusters.

import { useEffect, useMemo, useRef, useState } from "react";
import type { JobResult } from "@/lib/api/client";
import { emitVizSync } from "@/lib/visualize/syncBus";

const IS_LITE = process.env.NEXT_PUBLIC_LITE_MODE === "true";

interface Props {
  result: JobResult;
  /** Currently-selected pair — drives the highlight ring. Defaults to
   * the focus pair (rank 1) on mount. */
  selectedCompound: string | null;
  selectedDisease: string | null;
  /** Whether auto-sync is enabled — controls whether clicking a point
   * broadcasts the pair via the viz-sync bus. */
  autoSync: boolean;
}

interface ScatterPoint {
  x: number;
  y: number;
  compound: string;
  disease: string;
  score: number;
  /** True for the rank-1 candidate; rendered with a pulsing ring. */
  isFocus: boolean;
  /** True for the user-selected pair (matches selectedCompound +
   * selectedDisease via the sync bus). Rendered slightly enlarged. */
  isSelected: boolean;
}

const COLOR_FOCUS = 0xd4a574; // gold — rank 1
const COLOR_STRONG = 0x6bb5b5; // teal — score >= 0.7
const COLOR_MID = 0xb0a0dd; // purple — score >= 0.5
const COLOR_WEAK = 0xe0a062; // amber — score < 0.5

function colorFor(point: ScatterPoint): number {
  if (point.isFocus) return COLOR_FOCUS;
  if (point.score >= 0.7) return COLOR_STRONG;
  if (point.score >= 0.5) return COLOR_MID;
  return COLOR_WEAK;
}

export function UmapScatterPanel({
  result,
  selectedCompound,
  selectedDisease,
  autoSync,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"idle" | "loading" | "ready" | "error" | "no-data">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Cursor tooltip — uses a ref so we don't repaint the whole panel on
  // every mouse move. The DOM node is owned by the canvas overlay.
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Build the point list once per (embedding, selection) — embedding
  // is parallel to ranking so the join is index-based.
  const points: ScatterPoint[] = useMemo(() => {
    const ranking = result.candidateSpotlight.ranking;
    const embedding = result.embedding;
    if (!embedding || embedding.length === 0) return [];
    return ranking.slice(0, embedding.length).map((row, i) => {
      const [x, y] = embedding[i] ?? [0, 0];
      return {
        x: x ?? 0,
        y: y ?? 0,
        compound: row.compound,
        disease: row.disease,
        score: row.score,
        isFocus: i === 0,
        isSelected:
          row.compound === selectedCompound &&
          row.disease === selectedDisease,
      };
    });
  }, [
    result.candidateSpotlight.ranking,
    result.embedding,
    selectedCompound,
    selectedDisease,
  ]);

  useEffect(() => {
    if (IS_LITE) {
      setPhase("no-data");
      return;
    }
    if (points.length === 0) {
      setPhase("no-data");
      return;
    }
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    let cleanup: (() => void) | null = null;
    setPhase("loading");
    setErrorMessage(null);

    import("three")
      .then((THREE) => {
        if (cancelled || !hostRef.current) return;
        const stage = hostRef.current;
        const width = stage.clientWidth || 600;
        const height = stage.clientHeight || 320;

        const scene = new THREE.Scene();
        scene.background = null;

        // Orthographic camera keeps the 2D projection square — the
        // embedding is genuinely 2D, so we render a top-down view with
        // a small Z offset for the focus ring.
        const aspect = width / height;
        const halfH = 1.4;
        const halfW = halfH * aspect;
        const camera = new THREE.OrthographicCamera(
          -halfW,
          halfW,
          halfH,
          -halfH,
          -10,
          10,
        );
        camera.position.set(0, 0, 5);

        const renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: true,
        });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setClearColor(0x000000, 0);
        stage.appendChild(renderer.domElement);

        // Subtle axes — quarter-length, dashed feel via low opacity.
        const axesMat = new THREE.LineBasicMaterial({
          color: 0x4a4035,
          transparent: true,
          opacity: 0.45,
        });
        const axesGeom = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(-halfW * 0.92, 0, 0),
          new THREE.Vector3(halfW * 0.92, 0, 0),
          new THREE.Vector3(0, -halfH * 0.92, 0),
          new THREE.Vector3(0, halfH * 0.92, 0),
        ]);
        scene.add(new THREE.LineSegments(axesGeom, axesMat));

        // Build per-point sprites — small flat circles. Using a shared
        // CircleGeometry + a per-mesh MeshBasicMaterial keeps the GPU
        // happy on 6-row spotlights and scales fine to 80+ if the
        // ranking grows.
        const circleGeom = new THREE.CircleGeometry(0.05, 24);
        type PointMesh = {
          mesh: InstanceType<typeof THREE.Mesh>;
          mat: InstanceType<typeof THREE.MeshBasicMaterial>;
          point: ScatterPoint;
        };
        const meshes: PointMesh[] = [];
        for (const p of points) {
          const mat = new THREE.MeshBasicMaterial({
            color: colorFor(p),
            transparent: true,
            opacity: p.isFocus ? 1 : Math.max(0.5, p.score),
          });
          const mesh = new THREE.Mesh(circleGeom, mat);
          mesh.position.set(p.x, p.y, 0);
          const scale = p.isFocus ? 1.6 : p.isSelected ? 1.35 : 1;
          mesh.scale.setScalar(scale);
          scene.add(mesh);
          meshes.push({ mesh, mat, point: p });
        }

        // Pulsing ring around the focus (and selected, if different) point.
        const ringGeom = new THREE.RingGeometry(0.08, 0.105, 32);
        const focusPoint = points.find((p) => p.isFocus) ?? points[0]!;
        const focusRingMat = new THREE.MeshBasicMaterial({
          color: COLOR_FOCUS,
          transparent: true,
          opacity: 0.85,
          side: THREE.DoubleSide,
        });
        const focusRing = new THREE.Mesh(ringGeom, focusRingMat);
        focusRing.position.set(focusPoint.x, focusPoint.y, 0.01);
        scene.add(focusRing);

        const selectedPoint = points.find(
          (p) => p.isSelected && !p.isFocus,
        );
        let selectedRing: InstanceType<typeof THREE.Mesh> | null = null;
        let selectedRingMat: InstanceType<typeof THREE.MeshBasicMaterial> | null =
          null;
        if (selectedPoint) {
          selectedRingMat = new THREE.MeshBasicMaterial({
            color: 0xfff1d6,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide,
          });
          selectedRing = new THREE.Mesh(ringGeom, selectedRingMat);
          selectedRing.position.set(selectedPoint.x, selectedPoint.y, 0.005);
          scene.add(selectedRing);
        }

        // Hover / click via raycasting. Build a flat pickable list of
        // meshes mapped back to their ScatterPoint.
        const raycaster = new THREE.Raycaster();
        const ndc = new THREE.Vector2();
        function pickFromEvent(ev: MouseEvent): PointMesh | null {
          const rect = renderer.domElement.getBoundingClientRect();
          ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
          ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
          raycaster.setFromCamera(ndc, camera);
          const hits = raycaster.intersectObjects(
            meshes.map((m) => m.mesh),
            false,
          );
          if (hits.length === 0) return null;
          const hit = hits[0]!;
          return meshes.find((m) => m.mesh === hit.object) ?? null;
        }

        function onPointerMove(ev: PointerEvent) {
          const tip = tooltipRef.current;
          const picked = pickFromEvent(ev);
          if (!tip) return;
          if (!picked) {
            tip.style.opacity = "0";
            return;
          }
          const rect = renderer.domElement.getBoundingClientRect();
          tip.style.opacity = "1";
          tip.style.left = `${ev.clientX - rect.left + 12}px`;
          tip.style.top = `${ev.clientY - rect.top - 12}px`;
          tip.textContent = `${picked.point.compound} → ${picked.point.disease} · ${picked.point.score.toFixed(3)}`;
        }
        function onPointerLeave() {
          if (tooltipRef.current) tooltipRef.current.style.opacity = "0";
        }
        function onClick(ev: MouseEvent) {
          const picked = pickFromEvent(ev);
          if (!picked) return;
          if (autoSync) {
            emitVizSync({
              compound: picked.point.compound,
              disease: picked.point.disease,
              source: "umap",
            });
          }
        }
        renderer.domElement.addEventListener("pointermove", onPointerMove);
        renderer.domElement.addEventListener("pointerleave", onPointerLeave);
        renderer.domElement.addEventListener("click", onClick);

        const onResize = () => {
          if (!stage) return;
          const w = stage.clientWidth || width;
          const h = stage.clientHeight || height;
          renderer.setSize(w, h);
          const a = w / h;
          camera.left = -halfH * a;
          camera.right = halfH * a;
          camera.updateProjectionMatrix();
        };
        const ro = new ResizeObserver(onResize);
        ro.observe(stage);

        let frame = 0;
        const t0 = performance.now();
        const animate = () => {
          frame = requestAnimationFrame(animate);
          const t = (performance.now() - t0) / 1000;
          // Pulse the focus ring scale + opacity at ~1.2 Hz so the
          // candidate marker reads as "live" without distracting the
          // rest of the scene.
          const pulse = 1 + Math.sin(t * 7.5) * 0.12;
          focusRing.scale.setScalar(pulse);
          focusRingMat.opacity = 0.55 + Math.sin(t * 7.5) * 0.3;
          if (selectedRing && selectedRingMat) {
            const sp = 1 + Math.sin(t * 5 + 1) * 0.08;
            selectedRing.scale.setScalar(sp);
            selectedRingMat.opacity = 0.45 + Math.sin(t * 5 + 1) * 0.2;
          }
          renderer.render(scene, camera);
        };
        animate();

        cleanup = () => {
          cancelAnimationFrame(frame);
          ro.disconnect();
          renderer.domElement.removeEventListener("pointermove", onPointerMove);
          renderer.domElement.removeEventListener("pointerleave", onPointerLeave);
          renderer.domElement.removeEventListener("click", onClick);
          for (const m of meshes) m.mat.dispose();
          circleGeom.dispose();
          ringGeom.dispose();
          focusRingMat.dispose();
          selectedRingMat?.dispose();
          axesGeom.dispose();
          axesMat.dispose();
          renderer.dispose();
          if (renderer.domElement.parentElement === stage) {
            stage.removeChild(renderer.domElement);
          }
        };
        setPhase("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setPhase("error");
        setErrorMessage(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
      if (cleanup) cleanup();
    };
  }, [points, autoSync]);

  const status =
    phase === "loading"
      ? "● loading"
      : phase === "ready"
        ? "● live"
        : phase === "error"
          ? "● error"
          : phase === "no-data"
            ? IS_LITE
              ? "○ lite mode"
              : "○ no embedding"
            : "○ idle";

  return (
    <section className="panel" data-panel="umap">
      <div className="panel-head">
        <div>
          <div className="eyebrow">VIEW · 3D UMAP</div>
          <div className="panel-title">Where this candidate sits</div>
        </div>
        <span className="badge">Three.js</span>
      </div>
      <p className="panel-purpose">
        2D projection of the candidate set — tight clustering with the
        candidate near a known centroid is mechanistic corroboration.
        Click a point to focus that pair across panels (when auto-sync
        is on).
      </p>

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
          ref={hostRef}
          role="img"
          aria-label="UMAP scatter of candidate embedding"
          style={{ position: "absolute", inset: 0 }}
        />
        <div
          ref={tooltipRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            padding: "4px 8px",
            borderRadius: 3,
            background: "rgba(20,17,14,0.92)",
            border: "1px solid var(--border)",
            color: "var(--ink)",
            fontSize: 11,
            fontFamily: "var(--font-mono), monospace",
            pointerEvents: "none",
            opacity: 0,
            transition: "opacity 120ms",
            whiteSpace: "nowrap",
          }}
        />
        {phase !== "ready" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: phase === "error" ? "var(--amber)" : "var(--faint)",
              fontSize: 12,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontFamily: "var(--font-mono), monospace",
              pointerEvents: "none",
              padding: "0 24px",
              textAlign: "center",
            }}
          >
            {phase === "loading" && "loading three.js…"}
            {phase === "no-data" &&
              (IS_LITE
                ? "lite build · scatter omitted"
                : "no embedding coords for this run")}
            {phase === "error" &&
              `unable to render scatter · ${errorMessage ?? "unknown error"}`}
            {phase === "idle" && "preparing scatter…"}
          </div>
        )}
        <div
          style={{
            position: "absolute",
            bottom: 8,
            left: 12,
            display: "flex",
            gap: 12,
            fontSize: 10,
            color: "var(--faint)",
            fontFamily: "var(--font-mono), monospace",
            letterSpacing: "0.04em",
            pointerEvents: "none",
          }}
        >
          <Legend swatch="#d4a574" label="focus" />
          <Legend swatch="#6bb5b5" label=">= 0.7" />
          <Legend swatch="#b0a0dd" label=">= 0.5" />
          <Legend swatch="#e0a062" label="< 0.5" />
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 8,
            right: 12,
            fontSize: 10,
            color: "var(--faint)",
            fontFamily: "var(--font-mono), monospace",
            letterSpacing: "0.04em",
            pointerEvents: "none",
          }}
        >
          {points.length} candidates
        </div>
      </div>

      <div className="panel-footer" style={{ marginTop: 12 }}>
        <span>RotatE 128D embeddings projected to 2D</span>
        <span>
          <em>
            {phase === "ready"
              ? "candidate at cluster centroid"
              : "embedding coords from JobResult.embedding"}
          </em>
        </span>
      </div>
    </section>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span
        aria-hidden="true"
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: swatch,
        }}
      />
      {label}
    </span>
  );
}
