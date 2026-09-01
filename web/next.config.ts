import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a self-contained ./dist/standalone build (server + only the deps it
  // actually needs) — this is the container-portable output mode, not tied to any
  // specific host. Deliberately not using any Vercel-specific config here so this
  // stays deployable to a plain Docker container (ECS/EC2/etc.) later.
  output: "standalone",

  // Next.js's dev server blocks cross-origin requests to its own dev assets/HMR by
  // default (CSRF hardening) — needed here because dev is accessed through a tunnel
  // (ngrok) rather than localhost directly. Dev-only; irrelevant to `next build`/prod.
  allowedDevOrigins: process.env.NEXT_DEV_TUNNEL_HOST ? [process.env.NEXT_DEV_TUNNEL_HOST] : undefined,

  // Server-side proxy to the NestJS API, so the browser only ever talks to this
  // app's own origin (same-site cookies, one dev tunnel instead of two, no
  // cross-origin CORS/interstitial issues). NEXT_PUBLIC_API_URL should point at
  // this app's own public URL when this is active — see README "Testing the
  // Shopify login flow". Mirrors how production is expected to sit behind one
  // shared domain anyway.
  async rewrites() {
    const apiOrigin = process.env.API_PROXY_TARGET ?? "http://localhost:3000";
    return [
      { source: "/auth/:path*", destination: `${apiOrigin}/auth/:path*` },
      { source: "/members/:path*", destination: `${apiOrigin}/members/:path*` },
      { source: "/staff/:path*", destination: `${apiOrigin}/staff/:path*` },
      { source: "/health", destination: `${apiOrigin}/health` },
      { source: "/webhooks/:path*", destination: `${apiOrigin}/webhooks/:path*` },
    ];
  },
};

export default nextConfig;
