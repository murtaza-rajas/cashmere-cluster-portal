"use client";

import { useState } from "react";

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  color: string;
}

// A 2px surface-color gap separates touching segments (the dataviz skill's
// "surface gap" spacer) rather than a stroke drawn around each one.
const DONUT_GAP_PX = 3;

// Shared by /staff/reports (Members by tier) and /staff (Dashboard's
// Members by Level) — same chart, same tier->color mapping, so identity
// stays consistent across the whole admin app rather than each page
// inventing its own palette for the same four tiers.
export function DonutChart({
  slices,
  centerLabel = "members",
  className = "",
}: {
  slices: DonutSlice[];
  centerLabel?: string;
  className?: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const size = 176;
  const thickness = 26;
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;
  const total = slices.reduce((sum, s) => sum + s.value, 0);

  const arcs = slices
    .filter((s) => s.value > 0)
    .reduce<Array<DonutSlice & { dashArray: string; dashOffset: number; percent: number }>>((acc, s) => {
      const cumulative = acc.reduce((sum, a) => sum + a.value / total, 0);
      const fraction = total > 0 ? s.value / total : 0;
      const rawDash = fraction * circumference;
      const dash = Math.max(rawDash - DONUT_GAP_PX, 0);
      const dashOffset = -cumulative * circumference;
      acc.push({ ...s, dashArray: `${dash} ${circumference - dash}`, dashOffset, percent: Math.round(fraction * 100) });
      return acc;
    }, []);

  const activeSlice = slices.find((s) => s.key === active);
  const activePercent = activeSlice && total > 0 ? Math.round((activeSlice.value / total) * 100) : null;

  return (
    <div className={`flex flex-col items-center gap-6 sm:flex-row sm:items-center ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`${slices.map((s) => `${s.label} ${s.value}`).join(", ")}`}
      >
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e6ddd0" strokeWidth={thickness} />
        {arcs.map((arc) => (
          <circle
            key={arc.key}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={arc.color}
            strokeWidth={active === arc.key ? thickness + 4 : thickness}
            strokeDasharray={arc.dashArray}
            strokeDashoffset={arc.dashOffset}
            strokeLinecap="butt"
            transform={`rotate(-90 ${cx} ${cy})`}
            opacity={active && active !== arc.key ? 0.55 : 1}
            tabIndex={0}
            role="img"
            aria-label={`${arc.label}: ${arc.value} (${arc.percent}%)`}
            className="cursor-pointer outline-none transition-[stroke-width,opacity]"
            onMouseEnter={() => setActive(arc.key)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(arc.key)}
            onBlur={() => setActive(null)}
          />
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" className="fill-cashmere-text font-serif text-2xl">
          {activeSlice ? activeSlice.value : total}
        </text>
        <text x={cx} y={cy + 16} textAnchor="middle" className="fill-cashmere-text-muted text-[10px] uppercase tracking-wide">
          {activeSlice ? `${activeSlice.label} · ${activePercent}%` : centerLabel}
        </text>
      </svg>

      <div className="flex flex-1 flex-col gap-2">
        {slices.map((s) => {
          const percent = total > 0 ? Math.round((s.value / total) * 100) : 0;
          return (
            <div
              key={s.key}
              tabIndex={0}
              className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-0.5 text-sm outline-none transition-colors hover:bg-cashmere-sidebar/60 focus:bg-cashmere-sidebar/60"
              onMouseEnter={() => setActive(s.key)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(s.key)}
              onBlur={() => setActive(null)}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="flex-1 text-cashmere-text">{s.label}</span>
              <span className="text-xs text-cashmere-text-muted">{percent}%</span>
              <span className="w-8 shrink-0 text-right text-xs font-medium text-cashmere-text">{s.value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Fixed tier -> hue mapping shared by every chart in the admin app that
// shows the four membership tiers — see reports/page.tsx's original
// comment for the full validation detail (dataviz skill's default
// categorical palette, re-checked as a closed 4-ring). Kept here so
// Dashboard's line chart and donut can both import the exact same colors
// as Reports' donut, rather than each page picking its own.
export const TIER_ORDER = ["FOUNDING", "ANNUAL", "MONGOLIA", "NEWSLETTER"] as const;
export const TIER_LABELS: Record<(typeof TIER_ORDER)[number], string> = {
  FOUNDING: "Founding",
  ANNUAL: "Annual",
  MONGOLIA: "Mongolia",
  NEWSLETTER: "Newsletter",
};
export const TIER_COLORS: Record<(typeof TIER_ORDER)[number], string> = {
  FOUNDING: "#2a78d6",
  ANNUAL: "#eb6834",
  MONGOLIA: "#1baf7a",
  NEWSLETTER: "#eda100",
};
