/** @type {import('next').NextConfig} */
//
// Two build targets:
//
//   default  -> output: "standalone", Node.js runtime (Fly.io / Docker)
//   BUILD_TARGET=lite  -> output: "export", static-only (Hugging Face Space)
//
// The lite target exposes `NEXT_PUBLIC_LITE_MODE=true` for demo-banner UI.
// Optional `NEXT_PUBLIC_LITE_REMOTE_API=true` (+ `NEXT_PUBLIC_API_URL`)
// wires Settings (PUT/validate/smoke) and Operations polling to Fly or any
// public hetqml-api origin (requires CORS — see hf_space/README).
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
//   - apps/web/src/app/visualize/page.tsx returns the LiteUnavailablePanel
//     in lite, dropping VisualizeClient + its 13 panels (and their three
//     imports) from the lite trace.
//
const isLite = process.env.BUILD_TARGET === "lite";

// In `next dev`, route browser fetches through Next rewrites so requests stay
// same-origin (fixes WSL2: Windows localhost:3000 → WSL Next, but JS calling
// localhost:8000 hits Windows, not uvicorn in WSL).
const devApiRewrites =
  !isLite && process.env.NODE_ENV === "development"
    ? {
        async rewrites() {
          const target =
            process.env.HETQML_DEV_API_PROXY_TARGET?.replace(/\/$/, "") ||
            "http://127.0.0.1:8000";
          return [
            {
              source: "/__hetqml_api/:path*",
              destination: `${target}/:path*`,
            },
          ];
        },
      }
    : {};

const nextConfig = {
  output: isLite ? "export" : "standalone",
  reactStrictMode: true,
  ...devApiRewrites,

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
    NEXT_PUBLIC_LITE_REMOTE_API:
      process.env.NEXT_PUBLIC_LITE_REMOTE_API === "true" ? "true" : "false",
  },
};

export default nextConfig;
