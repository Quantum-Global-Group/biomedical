"use client";

// MiniKgPreview — build-time-switched dispatcher.
//
// In standalone (full) builds, defers to `MiniKgPreviewFull` which loads
// three.js (~676 KB chunk) and renders the interactive 3D Hetionet
// subgraph. In lite (HF Space, `BUILD_TARGET=lite`) builds, defers to
// `MiniKgPreviewLite` which renders a static SVG schematic and ships
// zero extra JS.
//
// `IS_LITE` reads `process.env.NEXT_PUBLIC_LITE_MODE`, which Next inlines
// at build time. Both branches sit on opposite sides of an `if (IS_LITE)`
// guard:
//
//   - lite build: `IS_LITE === true`, the early-return runs, and the
//     `next/dynamic` call referencing `./MiniKgPreviewFull` is dead code.
//     Turbopack DCEs it along with the `three` package.
//   - full build: `IS_LITE === false`, the early return is dead code,
//     `MiniKgPreviewLite` is unused, and Turbopack DCEs the lite SVG.
//
// Splitting `MiniKgPreviewFull` into its own module — only reachable via
// the dynamic import literal in the dead branch — is what lets the
// bundler trace three out of the lite production graph entirely.

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { Selection } from "@/lib/investigation/recommendations";
import { MiniKgPreview as MiniKgPreviewLite } from "./MiniKgPreviewLite";

const IS_LITE = process.env.NEXT_PUBLIC_LITE_MODE === "true";

const KG_PREVIEW_PLACEHOLDER_H = 360;

function MiniKgFullChunkLoadingPlaceholder() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading Three.js KG preview chunk"
      style={{
        width: "100%",
        minHeight: KG_PREVIEW_PLACEHOLDER_H,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        borderRadius: 6,
        border: "1px solid var(--border-soft)",
        background:
          "radial-gradient(ellipse at center, #1a1612 0%, #0f0c09 80%)",
        color: "var(--muted)",
        fontSize: 12,
        textAlign: "center",
        padding: "24px",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono), monospace",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--faint)",
        }}
      >
        loading knowledge-graph preview…
      </span>
      <span style={{ fontSize: 11, lineHeight: 1.45 }}>
        Fetching Three.js (~first visit). Panels fill once the viewer chunk arrives.
      </span>
    </div>
  );
}

interface Props {
  selection: Selection;
}

// Wrap the `dynamic(() => import("./MiniKgPreviewFull"))` call in a
// build-time-dead `if (!IS_LITE)` branch. In the lite build IS_LITE
// constant-folds to `true`, the negation is `false`, and SWC's dead-code
// pass eliminates the entire branch — including the `import()` literal,
// the lazy chunk emission, and the trace into three.js. In the full build
// IS_LITE is `false`, the branch is live, dynamic() runs at module init,
// and three.js is fetched on first render of MiniKgPreviewFull.
//
// This is the only reliable way to keep `three` (~676 KB) out of the
// lite production bundle: bundlers preserve any `import()` literal they
// can statically reach, regardless of whether the surrounding component
// is ever rendered.
let MiniKgPreviewFull: ComponentType<Props>;
if (!IS_LITE) {
  MiniKgPreviewFull = dynamic(
    () =>
      import("./MiniKgPreviewFull").then((m) => ({
        default: m.MiniKgPreviewFull,
      })),
    {
      ssr: false,
      loading: () => <MiniKgFullChunkLoadingPlaceholder />,
    },
  );
} else {
  // Stub used only as a type-level placeholder; the dispatcher's early
  // return below ensures this is never rendered in lite builds.
  MiniKgPreviewFull = () => null;
}

export function MiniKgPreview({ selection }: Props) {
  if (IS_LITE) {
    return <MiniKgPreviewLite selection={selection} />;
  }
  return <MiniKgPreviewFull selection={selection} />;
}
