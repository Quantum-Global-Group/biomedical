"use client";

import { useEffect, useRef, useState } from "react";
import type { Selection } from "@/lib/investigation/recommendations";

interface Props {
  selection: Selection;
}

interface GraphNode {
  id: string;
  label: string;
  /** Node kind drives color + size. */
  kind: "compound" | "gene" | "disease" | "pathway" | "variant";
}

interface GraphEdge {
  source: string;
  target: string;
}

function buildGraph(selection: Selection): {
  nodes: GraphNode[];
  edges: GraphEdge[];
} {
  const compound = selection.compound || "Compound";
  const gene = selection.gene || "Anchor gene";
  const disease = selection.disease || "Disease";

  const nodes: GraphNode[] = [
    { id: "compound", label: compound, kind: "compound" },
    { id: "gene", label: gene, kind: "gene" },
    { id: "disease", label: disease, kind: "disease" },
    { id: "pathway", label: "Pathway", kind: "pathway" },
    { id: "variant", label: "Variant", kind: "variant" },
    // a couple of co-target / co-disease neighbors so the layout has body
    { id: "gene2", label: "Co-target", kind: "gene" },
    { id: "disease2", label: "Co-disease", kind: "disease" },
  ];
  const edges: GraphEdge[] = [
    { source: "compound", target: "gene" },
    { source: "gene", target: "disease" },
    { source: "gene", target: "pathway" },
    { source: "pathway", target: "disease" },
    { source: "gene", target: "variant" },
    { source: "compound", target: "gene2" },
    { source: "gene2", target: "disease" },
    { source: "disease", target: "disease2" },
  ];
  return { nodes, edges };
}

/**
 * Hash string to a deterministic 3-vector seed in [-1, 1].
 * Lets layout be repeatable for the same selection.
 */
function seedVec(s: string): [number, number, number] {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // unpack into 3 components
  const a = ((h >>> 0) % 1000) / 1000 - 0.5;
  const b = ((h >>> 10) % 1000) / 1000 - 0.5;
  const c = ((h >>> 20) % 1000) / 1000 - 0.5;
  return [a * 2, b * 2, c * 2];
}

const NODE_COLORS: Record<GraphNode["kind"], number> = {
  compound: 0x6bb5b5, // teal
  gene: 0xd4a574, // gold
  disease: 0xe08474, // sienna
  pathway: 0xb0a0dd, // purple
  variant: 0xe0a062, // amber
};

const NODE_RADIUS: Record<GraphNode["kind"], number> = {
  compound: 0.32,
  gene: 0.26,
  disease: 0.32,
  pathway: 0.22,
  variant: 0.18,
};

export function MiniKgPreview({ selection }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  const label =
    selection.compound && selection.gene && selection.disease
      ? `3D knowledge graph: ${selection.compound} → ${selection.gene} → ${selection.disease}`
      : "3D knowledge graph preview";

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    // Dynamic import keeps `three` (~600KB) out of the initial bundle.
    import("three")
      .then((THREE) => {
        if (cancelled || !containerRef.current) return;
        const host = containerRef.current;
        const width = host.clientWidth || 320;
        const height = host.clientHeight || 220;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0e0b08);

        const camera = new THREE.PerspectiveCamera(
          45,
          width / height,
          0.1,
          100,
        );
        camera.position.set(0, 0, 6);

        const renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: true,
        });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        host.appendChild(renderer.domElement);

        // Lights
        scene.add(new THREE.AmbientLight(0xffffff, 0.55));
        const dir = new THREE.DirectionalLight(0xffffff, 0.8);
        dir.position.set(3, 4, 5);
        scene.add(dir);

        // Build graph data
        const { nodes, edges } = buildGraph(selection);

        // Force-directed layout in 3D — simple repulsion + spring pass.
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
        const ITERATIONS = 140;
        const REPULSION = 0.7;
        const SPRING = 0.04;
        const SPRING_LEN = 1.6;
        const DAMP = 0.85;
        for (let step = 0; step < ITERATIONS; step++) {
          // Repulse all pairs
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
          // Spring along edges
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
          // Center gravity + integrate
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

        // Group that holds the whole graph so we can rotate it.
        const root = new THREE.Group();
        scene.add(root);

        // Edges as line segments
        const lineGeom = new THREE.BufferGeometry();
        const linePositions: number[] = [];
        for (const e of edges) {
          const a = sims.get(e.source)!.pos;
          const b = sims.get(e.target)!.pos;
          linePositions.push(a[0], a[1], a[2], b[0], b[1], b[2]);
        }
        lineGeom.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(linePositions, 3),
        );
        const lineMat = new THREE.LineBasicMaterial({
          color: 0x6b5e52,
          transparent: true,
          opacity: 0.7,
        });
        const lines = new THREE.LineSegments(lineGeom, lineMat);
        root.add(lines);

        // Nodes as Phong spheres + halo billboards
        const sphereGeom = new THREE.SphereGeometry(1, 18, 14);
        for (const n of nodes) {
          const s = sims.get(n.id)!;
          const mat = new THREE.MeshPhongMaterial({
            color: NODE_COLORS[n.kind],
            emissive: NODE_COLORS[n.kind],
            emissiveIntensity: 0.18,
            shininess: 35,
          });
          const mesh = new THREE.Mesh(sphereGeom, mat);
          mesh.position.set(s.pos[0], s.pos[1], s.pos[2]);
          mesh.scale.setScalar(NODE_RADIUS[n.kind]);
          root.add(mesh);

          // Halo: slightly larger, transparent, additive-style shell
          const halo = new THREE.Mesh(
            sphereGeom,
            new THREE.MeshBasicMaterial({
              color: NODE_COLORS[n.kind],
              transparent: true,
              opacity: 0.16,
            }),
          );
          halo.position.copy(mesh.position);
          halo.scale.setScalar(NODE_RADIUS[n.kind] * 1.55);
          root.add(halo);
        }

        // Drag-to-orbit + pause auto-rotation briefly after interaction.
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

        // Resize handling
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

        let frame = 0;
        const animate = () => {
          frame = requestAnimationFrame(animate);
          if (performance.now() > pauseUntil) {
            autoYaw += 0.0035;
          }
          root.rotation.y = autoYaw + manualYaw;
          root.rotation.x = manualPitch;
          renderer.render(scene, camera);
        };
        animate();

        cleanup = () => {
          cancelAnimationFrame(frame);
          ro.disconnect();
          renderer.domElement.removeEventListener("pointerdown", onPointerDown);
          renderer.domElement.removeEventListener("pointermove", onPointerMove);
          renderer.domElement.removeEventListener("pointerup", onPointerUp);
          renderer.domElement.removeEventListener("pointerleave", onPointerUp);
          // Dispose GL resources
          sphereGeom.dispose();
          lineGeom.dispose();
          lineMat.dispose();
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
    // Re-run when selection changes so the graph relabels and re-lays-out.
  }, [selection.compound, selection.gene, selection.disease]);

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
      <div
        ref={containerRef}
        role="img"
        aria-label={label}
        style={{
          width: "100%",
          height: 220,
          background: "#0E0B08",
          border: "1px solid var(--border)",
          borderRadius: 4,
          overflow: "hidden",
          position: "relative",
          touchAction: "none",
        }}
      >
        <div
          className="threed-hint"
          style={{
            position: "absolute",
            top: 8,
            left: 12,
            fontSize: 10,
            color: "var(--faint)",
            fontFamily: "monospace",
            zIndex: 2,
            pointerEvents: "none",
          }}
        >
          3D · {error ? `error · ${error}` : "drag to orbit · auto-rotates"}
        </div>
      </div>
      <div className="panel-footer">
        <span>hetionet-v1.0/edges.tsv</span>
        <span>
          <em>path score (demo)</em>
        </span>
      </div>
    </section>
  );
}
