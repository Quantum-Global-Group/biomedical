/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,

  experimental: {
    optimizePackageImports: ["three"],
    turbopackFileSystemCacheForDev: true,
  },

  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
