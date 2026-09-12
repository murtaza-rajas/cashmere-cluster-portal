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
  //
  // /staff/* is deliberately NOT a single blanket rewrite (unlike /auth, /members,
  // /webhooks) — the admin app added real Next.js pages under /staff/* (2026-09-05/07:
  // /staff, /staff/directory, /staff/data-requests, /staff/members, /staff/members/[id]),
  // so that namespace is now shared between frontend pages and backend API routes.
  // Per Next's own routing order (rewrites.md: non-dynamic pages are checked BEFORE
  // afterFiles rewrites, but dynamic routes are only checked AFTER them), a blanket
  // /staff/:path* rewrite would swallow the dynamic /staff/members/[id] page — a real,
  // reproduced bug (confirmed: a direct page navigation there returned the API's raw
  // 404 JSON instead of rendering the page). Listing only the real backend sub-paths
  // here avoids that; none of them collide with the frontend's own /staff/* segments.
  //
  // NOT YET FIXED, flagged rather than guessed at: GET/POST /staff itself (the staff
  // list/create endpoint) is the one genuinely irreducible collision — the bare
  // "/staff" path means both a real backend endpoint AND the frontend's own staff
  // home page, and Next always serves the (non-dynamic) page first for a plain GET.
  // Doesn't reproduce in local dev (NEXT_PUBLIC_API_URL points straight at
  // localhost:3000, bypassing this proxy entirely — see .env.local), but will once
  // this is tested through the single-tunnel/production-style setup this proxy exists
  // for. Needs a real decision (most likely: namespacing all backend API routes under
  // a prefix like /api/* that no frontend page will ever occupy) before that happens —
  // see PROJECT_TRACKER.md.
  async rewrites() {
    const apiOrigin = process.env.API_PROXY_TARGET ?? "http://localhost:3000";
    return [
      { source: "/auth/:path*", destination: `${apiOrigin}/auth/:path*` },
      { source: "/members/:path*", destination: `${apiOrigin}/members/:path*` },
      { source: "/staff/me", destination: `${apiOrigin}/staff/me` },
      { source: "/staff/roles", destination: `${apiOrigin}/staff/roles` },
      { source: "/staff/:id/roles", destination: `${apiOrigin}/staff/:id/roles` },
      { source: "/staff/:id/roles/:roleName", destination: `${apiOrigin}/staff/:id/roles/:roleName` },
      { source: "/data-subject-requests/:path*", destination: `${apiOrigin}/data-subject-requests/:path*` },
      // Staff Benefits/Offers CRUD — deliberately not /benefits, see
      // benefits.controller.ts's comment: that bare path is already the
      // member-facing "My Benefits" frontend page. This path has no frontend
      // page at all, so (unlike /staff) a blanket rewrite here is safe.
      { source: "/benefit-catalog/:path*", destination: `${apiOrigin}/benefit-catalog/:path*` },
      { source: "/site-image-catalog/:path*", destination: `${apiOrigin}/site-image-catalog/:path*` },
      // Staff Events & Invitations CRUD — no frontend page at /event-catalog,
      // so (like /benefit-catalog) a blanket rewrite here is safe.
      { source: "/event-catalog/:path*", destination: `${apiOrigin}/event-catalog/:path*` },
      // Staff Care & Repair guide CRUD — no frontend page at
      // /care-guide-catalog, so a blanket rewrite here is safe.
      { source: "/care-guide-catalog/:path*", destination: `${apiOrigin}/care-guide-catalog/:path*` },
      // Staff-uploaded photos themselves (main.ts's useStaticAssets serves
      // these from the API) — the browser requests this path directly from
      // whatever origin rendered the <img>/<Image> tag (this app), so it
      // needs the same proxying as any other backend route, independent of
      // whether NEXT_PUBLIC_API_URL itself is proxied for JSON calls.
      { source: "/uploads/:path*", destination: `${apiOrigin}/uploads/:path*` },
      // Audit Log viewer — no frontend page at /audit-log, so a blanket
      // rewrite here is safe (same reasoning as /benefit-catalog).
      { source: "/audit-log/:path*", destination: `${apiOrigin}/audit-log/:path*` },
      // Reports & Analytics — no frontend page at /reports, so a blanket
      // rewrite here is safe.
      { source: "/reports/:path*", destination: `${apiOrigin}/reports/:path*` },
      // Integrations & Settings — no frontend page at /integrations, so a
      // blanket rewrite here is safe.
      { source: "/integrations/:path*", destination: `${apiOrigin}/integrations/:path*` },
      // Staff Dashboard overview data — no frontend page at
      // /staff-dashboard, so a blanket rewrite here is safe.
      { source: "/staff-dashboard/:path*", destination: `${apiOrigin}/staff-dashboard/:path*` },
      // Founders' Design Lab staff CRUD — no frontend page at
      // /design-catalog, so a blanket rewrite here is safe.
      { source: "/design-catalog/:path*", destination: `${apiOrigin}/design-catalog/:path*` },
      // Cashmere Lovers Club Mongolia staff CRUD — no frontend page at
      // /mongolia-catalog, so a blanket rewrite here is safe.
      { source: "/mongolia-catalog/:path*", destination: `${apiOrigin}/mongolia-catalog/:path*` },
      // Shopify & Orders admin view — no frontend page at /order-catalog,
      // so a blanket rewrite here is safe (same reasoning as /benefit-catalog).
      { source: "/order-catalog/:path*", destination: `${apiOrigin}/order-catalog/:path*` },
      { source: "/health", destination: `${apiOrigin}/health` },
      { source: "/webhooks/:path*", destination: `${apiOrigin}/webhooks/:path*` },
    ];
  },
};

export default nextConfig;
