/** @type {import('next').NextConfig} */
//
// Two build targets:
//
//   default  -> output: "standalone", Node.js runtime (Fly.io / Docker)
//   BUILD_TARGET=lite  -> output: "export", static-only (Hugging Face Space)
//
// The lite target also exposes `NEXT_PUBLIC_LITE_MODE=true` to the client
// so components can render demo-banner UI and lock out routes that depend
// on a live FastAPI (Operations + Settings call ops/decisions/notes
// endpoints; the static build can't reach a backend).
//
// Trigger:
//   pnpm --filter hetqml-web build         # standalone (default)
//   pnpm --filter hetqml-web build:lite    # static export -> apps/web/out/
//
// Lite-vs-full module switch happens INSIDE individual components by
// branching on `process.env.NEXT_PUBLIC_LITE_MODE` (which Next inlines at
// build time so the dead branch DCEs out). Specifically:
//   - apps/web/src/components/initialize/MiniKgPreview.tsx exports the
//     three.js-backed 3D preview in full mode and the SVG schematic
//     (./MiniKgPreviewLite.tsx) in lite mode.
//   - apps/web/src/app/visualize/page.tsx returns the lite visualize
//     experience in lite, dropping VisualizeClient + its 13 panels from
//     the lite trace when VisualizeLite is used.
//
const isLite = process.env.BUILD_TARGET === "lite";

const nextConfig = {
  output: isLite ? "export" : "standalone",
  reactStrictMode: true,

  // HF Space serves directories: /initialize -> /initialize/index.html.
  // Demo build keeps clean URLs so Next can route via the standalone server.
  trailingSlash: isLite,

  experimental: {
    optimizePackageImports: ["three"],
    turbopackFileSystemCacheForDev: true,
  },

  // next/image requires the runtime image-optimizer; static export needs
  // images served as-is.
  images: isLite ? { unoptimized: true } : { remotePatterns: [] },

  // Inlined into the client bundle at build time. Read via
  // process.env.NEXT_PUBLIC_LITE_MODE in client code; absent or "false"
  // means full mode.
  env: {
    NEXT_PUBLIC_LITE_MODE: isLite ? "true" : "false",
  },
};

export default nextConfig;
