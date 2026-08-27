import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a self-contained ./dist/standalone build (server + only the deps it
  // actually needs) — this is the container-portable output mode, not tied to any
  // specific host. Deliberately not using any Vercel-specific config here so this
  // stays deployable to a plain Docker container (ECS/EC2/etc.) later.
  output: "standalone",
};

export default nextConfig;
