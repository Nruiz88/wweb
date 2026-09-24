import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // NOTE: output: "standalone" breaks alias resolution in Next 16.3.2.
  // This project targets Coolify (npm run build + npm run start).
  // The default output is used so the @/ alias resolves via tsconfig paths.
  // If you re-enable standalone for Docker/Dokploy, remove `resolve` below
  // and add "paths" resolution with tsconfig-paths in the Dockerfile.
};

export default nextConfig;
