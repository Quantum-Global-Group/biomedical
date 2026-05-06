"use client";

// MiniKgPreviewFull — three.js-backed 3D knowledge-graph preview.
//
// This module is loaded ONLY by the standalone (full) build. The lite
// (HF Space) build's `MiniKgPreview.tsx` dispatcher delegates to
// `MiniKgPreviewLite` and the `next/dynamic` import of this file sits
// inside a build-time-dead branch so Turbopack's DCE drops it (and
// `three`) from the lite production trace.
//
// Importing this file pulls in the `import("three")` chunk (~676 KB
// minified). Keep all WebGL/three code here, not in MiniKgPreview.tsx.

import { useEffect, useRef, useState } from "react";
import type { Selection } from "@/lib/investigation/recommendations";

interface Props {
  selection: Selection;
}

type NodeKind = "compound" | "gene" | "disease" | "pathway" | "variant";

interface GraphNode {
  id: string;
  label: string;
  kind: NodeKind;
  /** Focus nodes (the user's actual disease/compound/gene picks) get larger
   * size + brighter emissive + a subtle pulse. */
  focus: boolean;
}

interface GraphEdge {
  source: string;
  target: string;
  /** True when both endpoints are focus nodes — the "spine" of the run. */
  primary: boolean;
  /** Hetionet metaedge code shown on the edge label. */
  metaedge: string;
}

function buildGraph(selection: Selection): {
  nodes: GraphNode[];
  edges: GraphEdge[];
} {
  const compound = selection.compound || "Compound";
  const gene = selection.gene || "Anchor gene";
  const disease = selection.disease || "Disease";

  const nodes: GraphNode[] = [
    { id: "compound", label: compound, kind: "compound", focus: true },
    { id: "gene", label: gene, kind: "gene", focus: true },
    { id: "disease", label: disease, kind: "disease", focus: true },
    { id: "pathway", label: "Pathway", kind: "pathway", focus: false },
    { id: "variant", label: "Variant", kind: "variant", focus: false },
    { id: "gene2", label: "Co-target", kind: "gene", focus: false },
    { id: "disease2", label: "Co-disease", kind: "disease", focus: false },
  ];
  const edges: GraphEdge[] = [
    { source: "compound", target: "gene", primary: true, metaedge: "CbG" },
    { source: "gene", target: "disease", primary: true, metaedge: "GaD" },
    { source: "gene", target: "pathway", primary: false, metaedge: "GpPW" },
    { source: "pathway", target: "disease", primary: false, metaedge: "PWaD" },
    { source: "gene", target: "variant", primary: false, metaedge: "GaV" },
    { source: "compound", target: "gene2", primary: false, metaedge: "CbG" },
    { source: "gene2", target: "disease", primary: false, metaedge: "GaD" },
    { source: "disease", target: "disease2", primary: false, metaedge: "DrD" },
  ];
  return { nodes, edges };
}

function seedVec(s: string): [number, number, number] {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const a = ((h >>> 0) % 1000) / 1000 - 0.5;
  const b = ((h >>> 10) % 1000) / 1000 - 0.5;
  const c = ((h >>> 20) % 1000) / 1000 - 0.5;
  return [a * 2, b * 2, c * 2];
}

const NODE_COLORS: Record<NodeKind, number> = {
  compound: 0x6bb5b5, // teal
  gene: 0xd4a574, // gold
  disease: 0xe08474, // sienna
  pathway: 0xb0a0dd, // purple
  variant: 0xe0a062, // amber
};

// Mirror the WebGL hex into CSS rgb for the legend swatches.
const NODE_HEX_CSS: Record<NodeKind, string> = {
  compound: "#6bb5b5",
  gene: "#d4a574",
  disease: "#e08474",
  pathway: "#b0a0dd",
  variant: "#e0a062",
};

const NODE_RADIUS: Record<NodeKind, number> = {
  compound: 0.36,
  gene: 0.30,
  disease: 0.36,
  pathway: 0.24,
  variant: 0.20,
};

const FOCUS_BOOST = 1.18;

const CANVAS_HEIGHT = 360;

export function MiniKgPreviewFull({ selection }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const labelLayerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ nodes: number; edges: number }>({
    nodes: 0,
    edges: 0,
  });

  const allChosen = !!(selection.compound && selection.gene && selection.disease);
  const ariaLabel = allChosen
    ? `3D knowledge graph: ${selection.compound} → ${selection.gene} → ${selection.disease}`
    : "3D knowledge graph preview";

  useEffect(() => {
    const container = containerRef.current;
    const labelLayer = labelLayerRef.current;
    if (!container || !labelLayer) return;
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    import("three")
      .then((THREE) => {
        if (cancelled || !containerRef.current || !labelLayerRef.current)
          return;
        const host = containerRef.current;
        const labels = labelLayerRef.current;
        const width = host.clientWidth || 320;
        const height = host.clientHeight || CANVAS_HEIGHT;

        const scene = new THREE.Scene();
        scene.background = null; // CSS gradient shows through transparent canvas

        const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
        camera.position.set(0, 0, 6.2);

        const renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: true,
        });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setClearColor(0x000000, 0);
        host.appendChild(renderer.domElement);

        // 3-light setup: key (warm), fill (cool, low), rim (cool, edge-glow).
        scene.add(new THREE.AmbientLight(0xffffff, 0.42));
        const key = new THREE.DirectionalLight(0xfff1d6, 0.95);
        key.position.set(3.5, 4, 5);
        scene.add(key);
        const fill = new THREE.DirectionalLight(0x88aacc, 0.4);
        fill.position.set(-4, -1, 2);
        scene.add(fill);
        const rim = new THREE.DirectionalLight(0xffffff, 0.55);
        rim.position.set(0, 0, -6);
        scene.add(rim);

        const { nodes, edges } = buildGraph(selection);
        setStats({ nodes: nodes.length, edges: edges.length });

        type Sim = {
          pos: [number, number, number];
          vel: [number, number, number];
        };
        const sims = new Map<string, Sim>();
        for (const n of nodes) {
          sims.set(n.id, {
            pos: seedVec(n.id + selection.compound),
            vel: [0, 0, 0],
          });
        }
        const ITERATIONS = 160;
        const REPULSION = 0.85;
        const SPRING = 0.045;
        const SPRING_LEN = 1.7;
        const DAMP = 0.85;
        for (let step = 0; step < ITERATIONS; step++) {
          for (let i = 0; i < nodes.length; i++) {
            const a = sims.get(nodes[i]!.id)!;
            for (let j = i + 1; j < nodes.length; j++) {
              const b = sims.get(nodes[j]!.id)!;
              const dx = a.pos[0] - b.pos[0];
              const dy = a.pos[1] - b.pos[1];
              const dz = a.pos[2] - b.pos[2];
              const d2 = dx * dx + dy * dy + dz * dz + 0.01;
              const f = REPULSION / d2;
              const d = Math.sqrt(d2);
              const fx = (dx / d) * f;
              const fy = (dy / d) * f;
              const fz = (dz / d) * f;
              a.vel[0] += fx;
              a.vel[1] += fy;
              a.vel[2] += fz;
              b.vel[0] -= fx;
              b.vel[1] -= fy;
              b.vel[2] -= fz;
            }
          }
          for (const e of edges) {
            const a = sims.get(e.source)!;
            const b = sims.get(e.target)!;
            const dx = b.pos[0] - a.pos[0];
            const dy = b.pos[1] - a.pos[1];
            const dz = b.pos[2] - a.pos[2];
            const d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.001;
            const f = SPRING * (d - SPRING_LEN);
            const fx = (dx / d) * f;
            const fy = (dy / d) * f;
            const fz = (dz / d) * f;
            a.vel[0] += fx;
            a.vel[1] += fy;
            a.vel[2] += fz;
            b.vel[0] -= fx;
            b.vel[1] -= fy;
            b.vel[2] -= fz;
          }
          for (const n of nodes) {
            const s = sims.get(n.id)!;
            s.vel[0] -= s.pos[0] * 0.005;
            s.vel[1] -= s.pos[1] * 0.005;
            s.vel[2] -= s.pos[2] * 0.005;
            s.vel[0] *= DAMP;
            s.vel[1] *= DAMP;
            s.vel[2] *= DAMP;
            s.pos[0] += s.vel[0];
            s.pos[1] += s.vel[1];
            s.pos[2] += s.vel[2];
          }
        }

        const root = new THREE.Group();
        scene.add(root);

        // Edges — split into primary (spine) and secondary so we can render
        // the primary path with a brighter colour + larger glow pass.
        const buildLines = (
          subset: GraphEdge[],
          color: number,
          opacity: number,
        ) => {
          if (!subset.length) return null;
          const geom = new THREE.BufferGeometry();
          const positions: number[] = [];
          for (const e of subset) {
            const a = sims.get(e.source)!.pos;
            const b = sims.get(e.target)!.pos;
            positions.push(a[0], a[1], a[2], b[0], b[1], b[2]);
          }
          geom.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(positions, 3),
          );
          const mat = new THREE.LineBasicMaterial({
            color,
            transparent: true,
            opacity,
          });
          const seg = new THREE.LineSegments(geom, mat);
          root.add(seg);
          return { geom, mat, seg };
        };
        const primaryLines = buildLines(
          edges.filter((e) => e.primary),
          0xe7d4bb,
          0.95,
        );
        const secondaryLines = buildLines(
          edges.filter((e) => !e.primary),
          0x8a7a6b,
          0.55,
        );

        // Edge metaedge labels — DOM-projected like node labels but
        // smaller, monospaced, and edge-tinted by primary/secondary so
        // the spine reads at a glance.
        type EdgeRender = {
          source: [number, number, number];
          target: [number, number, number];
          label: HTMLDivElement;
          primary: boolean;
        };
        const renderEdges: EdgeRender[] = edges.map((e) => {
          const a = sims.get(e.source)!.pos;
          const b = sims.get(e.target)!.pos;
          const label = document.createElement("div");
          label.textContent = e.metaedge;
          label.style.cssText = [
            "position:absolute",
            "transform:translate(-50%, -50%)",
            "padding:1px 6px",
            "border-radius:2px",
            `background:rgba(20,17,14,${e.primary ? "0.92" : "0.78"})`,
            `border:1px solid ${e.primary ? "#d4a574aa" : "#332d27"}`,
            `color:${e.primary ? "#e0a062" : "#857d75"}`,
            `font-size:${e.primary ? "10px" : "9.5px"}`,
            "font-family:var(--font-mono),SF Mono,Monaco,monospace",
            "font-weight:600",
            "letter-spacing:0.04em",
            "white-space:nowrap",
            "pointer-events:none",
            "will-change:transform,opacity",
          ].join(";");
          labels.appendChild(label);
          return {
            source: [a[0], a[1], a[2]],
            target: [b[0], b[1], b[2]],
            label,
            primary: e.primary,
          };
        });

        // "Flow particles" — small bright spheres that travel along the
        // primary spine to convey directionality and signal the live
        // model path. One particle per primary edge; particle position
        // interpolates from source → target with a 1.6s loop, looped.
        type Flow = {
          mesh: InstanceType<typeof THREE.Mesh>;
          source: [number, number, number];
          target: [number, number, number];
          phaseOffset: number; // staggers particles along the spine
        };
        const flowGeom = new THREE.SphereGeometry(0.08, 12, 10);
        const flowMat = new THREE.MeshBasicMaterial({
          color: 0xfff1d6,
          transparent: true,
          opacity: 0.95,
        });
        const flows: Flow[] = [];
        const primaryEdgeList = edges.filter((e) => e.primary);
        primaryEdgeList.forEach((e, i) => {
          const a = sims.get(e.source)!.pos;
          const b = sims.get(e.target)!.pos;
          const mesh = new THREE.Mesh(flowGeom, flowMat);
          root.add(mesh);
          flows.push({
            mesh,
            source: [a[0], a[1], a[2]],
            target: [b[0], b[1], b[2]],
            phaseOffset: i * 0.5,
          });
        });

        // Nodes
        const sphereGeom = new THREE.SphereGeometry(1, 22, 18);
        type NodeRender = {
          mesh: InstanceType<typeof THREE.Mesh>;
          mat: InstanceType<typeof THREE.MeshPhongMaterial>;
          haloMat: InstanceType<typeof THREE.MeshBasicMaterial>;
          baseEmissive: number;
          focus: boolean;
          label: HTMLDivElement;
          pos: [number, number, number];
        };
        const renderNodes: NodeRender[] = [];
        for (const n of nodes) {
          const s = sims.get(n.id)!;
          const baseEmissive = n.focus ? 0.3 : 0.14;
          const mat = new THREE.MeshPhongMaterial({
            color: NODE_COLORS[n.kind],
            emissive: NODE_COLORS[n.kind],
            emissiveIntensity: baseEmissive,
            shininess: 60,
          });
          const mesh = new THREE.Mesh(sphereGeom, mat);
          mesh.position.set(s.pos[0], s.pos[1], s.pos[2]);
          const r = NODE_RADIUS[n.kind] * (n.focus ? FOCUS_BOOST : 1);
          mesh.scale.setScalar(r);
          root.add(mesh);

          const haloMat = new THREE.MeshBasicMaterial({
            color: NODE_COLORS[n.kind],
            transparent: true,
            opacity: n.focus ? 0.22 : 0.12,
          });
          const halo = new THREE.Mesh(sphereGeom, haloMat);
          halo.position.copy(mesh.position);
          halo.scale.setScalar(r * (n.focus ? 1.85 : 1.5));
          root.add(halo);

          // HTML label, projected from world space each frame.
          const label = document.createElement("div");
          label.className = "kg-node-label";
          label.textContent = n.label;
          label.style.cssText = [
            "position:absolute",
            "transform:translate(-50%, calc(-100% - 8px))",
            "padding:2px 7px",
            "border-radius:3px",
            `background:rgba(34,30,26,${n.focus ? "0.92" : "0.78"})`,
            `border:1px solid ${NODE_HEX_CSS[n.kind]}55`,
            `color:${n.focus ? "#f0eae0" : "#b8afa5"}`,
            "font-size:11px",
            "font-weight:" + (n.focus ? "600" : "500"),
            "white-space:nowrap",
            "pointer-events:none",
            "letter-spacing:0.01em",
            "box-shadow:0 2px 8px rgba(0,0,0,0.35)",
            "max-width:140px",
            "overflow:hidden",
            "text-overflow:ellipsis",
            "will-change:transform,opacity",
          ].join(";");
          labels.appendChild(label);

          renderNodes.push({
            mesh,
            mat,
            haloMat,
            baseEmissive,
            focus: n.focus,
            label,
            pos: [s.pos[0], s.pos[1], s.pos[2]],
          });
        }

        // Drag-to-orbit
        let autoYaw = 0;
        let manualYaw = 0;
        let manualPitch = 0;
        let dragging = false;
        let lastX = 0;
        let lastY = 0;
        let pauseUntil = 0;

        const onPointerDown = (ev: PointerEvent) => {
          dragging = true;
          lastX = ev.clientX;
          lastY = ev.clientY;
          (ev.target as Element).setPointerCapture?.(ev.pointerId);
        };
        const onPointerMove = (ev: PointerEvent) => {
          if (!dragging) return;
          const dx = ev.clientX - lastX;
          const dy = ev.clientY - lastY;
          lastX = ev.clientX;
          lastY = ev.clientY;
          manualYaw += dx * 0.01;
          manualPitch += dy * 0.01;
          manualPitch = Math.max(-0.8, Math.min(0.8, manualPitch));
          pauseUntil = performance.now() + 2500;
        };
        const onPointerUp = () => {
          dragging = false;
        };
        renderer.domElement.addEventListener("pointerdown", onPointerDown);
        renderer.domElement.addEventListener("pointermove", onPointerMove);
        renderer.domElement.addEventListener("pointerup", onPointerUp);
        renderer.domElement.addEventListener("pointerleave", onPointerUp);

        const onResize = () => {
          if (!host) return;
          const w = host.clientWidth || width;
          const h = host.clientHeight || height;
          renderer.setSize(w, h);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
        };
        const ro = new ResizeObserver(onResize);
        ro.observe(host);

        const projected = new THREE.Vector3();
        const halfW = () => host.clientWidth / 2;
        const halfH = () => host.clientHeight / 2;

        let frame = 0;
        let t0 = performance.now();
        const animate = () => {
          frame = requestAnimationFrame(animate);
          const t = (performance.now() - t0) / 1000;
          if (performance.now() > pauseUntil) {
            autoYaw += 0.0035;
          }
          root.rotation.y = autoYaw + manualYaw;
          root.rotation.x = manualPitch;

          // Subtle pulse on focus node emissive — gives the "live" feel
          // without animating the whole scene.
          for (const r of renderNodes) {
            if (r.focus) {
              r.mat.emissiveIntensity =
                r.baseEmissive + Math.sin(t * 1.6) * 0.08;
            }
          }

          renderer.render(scene, camera);

          // Project node positions for HTML labels.
          const w = halfW();
          const h = halfH();
          for (const r of renderNodes) {
            projected.set(r.pos[0], r.pos[1], r.pos[2]);
            // Apply the same rotation as `root` so the label tracks the node.
            projected.applyEuler(root.rotation);
            projected.project(camera);
            const x = projected.x * w + w;
            const y = -projected.y * h + h;
            const visible = projected.z < 1 && projected.z > -1;
            r.label.style.transform =
              `translate(${x}px, ${y}px) translate(-50%, calc(-100% - 8px))`;
            // Fade with depth so back-of-graph labels don't crowd the front.
            const depthFade = visible
              ? Math.max(0.25, 1 - Math.max(0, projected.z) * 1.1)
              : 0;
            r.label.style.opacity = String(depthFade);
          }
        };
        animate();

        cleanup = () => {
          cancelAnimationFrame(frame);
          ro.disconnect();
          renderer.domElement.removeEventListener("pointerdown", onPointerDown);
          renderer.domElement.removeEventListener("pointermove", onPointerMove);
          renderer.domElement.removeEventListener("pointerup", onPointerUp);
          renderer.domElement.removeEventListener("pointerleave", onPointerUp);
          for (const r of renderNodes) {
            r.label.remove();
            r.mat.dispose();
            r.haloMat.dispose();
          }
          sphereGeom.dispose();
          primaryLines?.geom.dispose();
          primaryLines?.mat.dispose();
          secondaryLines?.geom.dispose();
          secondaryLines?.mat.dispose();
          renderer.dispose();
          if (renderer.domElement.parentElement === host) {
            host.removeChild(renderer.domElement);
          }
        };
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
      });

    return () => {
      cancelled = true;
      if (cleanup) cleanup();
    };
  }, [selection.compound, selection.gene, selection.disease]);

  const legend: { kind: NodeKind; label: string }[] = [
    { kind: "compound", label: "Compound" },
    { kind: "gene", label: "Gene" },
    { kind: "disease", label: "Disease" },
    { kind: "pathway", label: "Pathway" },
    { kind: "variant", label: "Variant" },
  ];

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">TOOL · LIVE KG PREVIEW</div>
          <div className="panel-title">What the model will see</div>
        </div>
        <span className="badge">Preview</span>
      </div>
      <p className="panel-purpose">
        A 3-hop subgraph from your selections, drawn before the run. Drag to
        orbit; the view auto-rotates after 2.5s of inactivity.
      </p>

      {/* Legend strip — six tiny chips so colors carry meaning */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          margin: "0 0 10px",
          fontSize: 11,
          color: "var(--muted)",
        }}
      >
        {legend.map((l) => (
          <span
            key={l.kind}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: NODE_HEX_CSS[l.kind],
                boxShadow: `0 0 6px ${NODE_HEX_CSS[l.kind]}66`,
                flexShrink: 0,
              }}
            />
            {l.label}
          </span>
        ))}
      </div>

      <div
        style={{
          position: "relative",
          width: "100%",
          height: CANVAS_HEIGHT,
          border: "1px solid var(--border)",
          borderRadius: 6,
          overflow: "hidden",
          // Radial paper-toned gradient — sits inside the panel rather than
          // contrasting with a hard black box.
          background:
            "radial-gradient(ellipse at 50% 40%, #221c16 0%, #14110e 65%, #0d0a08 100%)",
        }}
      >
        <div
          ref={containerRef}
          role="img"
          aria-label={ariaLabel}
          style={{
            position: "absolute",
            inset: 0,
            touchAction: "none",
          }}
        />
        {/* Label overlay — pointer-events: none so the canvas keeps drag */}
        <div
          ref={labelLayerRef}
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            overflow: "hidden",
          }}
        />
        {/* Top-left status caption */}
        <div
          style={{
            position: "absolute",
            top: 10,
            left: 12,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 9px",
            background: "rgba(20,17,14,0.72)",
            border: "1px solid var(--border)",
            borderRadius: 99,
            fontSize: 10.5,
            color: "var(--muted)",
            fontFamily: "var(--font-mono), monospace",
            letterSpacing: "0.03em",
            backdropFilter: "blur(4px)",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: error ? "var(--sienna)" : "var(--teal)",
              boxShadow: error
                ? "0 0 6px var(--sienna)"
                : "0 0 6px var(--teal)",
            }}
          />
          {error
            ? `error · ${error}`
            : `${stats.nodes} nodes · ${stats.edges} edges`}
        </div>
        {/* Bottom-right interaction hint */}
        <div
          style={{
            position: "absolute",
            bottom: 10,
            right: 12,
            padding: "4px 9px",
            background: "rgba(20,17,14,0.72)",
            border: "1px solid var(--border)",
            borderRadius: 99,
            fontSize: 10.5,
            color: "var(--faint)",
            fontFamily: "var(--font-mono), monospace",
            letterSpacing: "0.03em",
            pointerEvents: "none",
            backdropFilter: "blur(4px)",
          }}
        >
          drag to orbit
        </div>
      </div>

      <div className="panel-footer">
        <span>hetionet-v1.0/edges.tsv</span>
        <span>
          {allChosen ? (
            <em>focus path: compound → gene → disease</em>
          ) : (
            <em>preview · pick a disease/compound/gene to anchor</em>
          )}
        </span>
      </div>
    </section>
  );
}
