import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Requerido para Docker/Dokploy: genera .next/standalone con server.js
  output: "standalone",
};

export default nextConfig;
