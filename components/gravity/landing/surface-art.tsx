/**
 * Surface marks — BOLD, PREMIUM, RECOGNIZABLE icon-illustrations (one confident
 * mark per surface). Deliberately restrained: a single filled glyph with a
 * gradient + soft glow + one subtle accent, on a clean radial halo. No orbit
 * clutter, no busy linework — they read instantly and look premium.
 *
 * Each surface keeps its own color theme. Gentle continuous motion (a slow bob)
 * keeps them alive without noise; cursor-parallax via --px/--py adds depth.
 */
import type { ReactNode } from "react";

export type Theme = { from: string; to: string; accent: string };

export const THEMES: Theme[] = [
  { from: "#ff2d55", to: "#ff8a4d", accent: "#ff8fa3" }, // 1 crimson→ember
  { from: "#ffb020", to: "#ff6a18", accent: "#ffd884" }, // 2 gold→amber
  { from: "#22d3ee", to: "#3b82f6", accent: "#7dd3fc" }, // 3 cyan→blue
  { from: "#b06bff", to: "#6366f1", accent: "#cbb5ff" }, // 4 violet→indigo
  { from: "#a3e635", to: "#22c55e", accent: "#d9f99d" }, // 5 lime→green
  { from: "#fb7185", to: "#ec4899", accent: "#fda4af" }, // 6 rose→magenta
  { from: "#fbbf24", to: "#ef4444", accent: "#fcd34d" }, // 7 amber→red
  { from: "#2dd4bf", to: "#0ea5e9", accent: "#99f6e4" }, // 8 teal→sky
  { from: "#a5b4fc", to: "#e879f9", accent: "#c7d2fe" }, // 9 indigo→fuchsia
];

type ArtProps = { gid: string; theme?: Theme };

function Mark({
  gid,
  theme,
  children,
}: {
  gid: string;
  theme: Theme;
  children: ReactNode;
}) {
  return (
    <svg viewBox="0 0 120 120" className="size-full overflow-visible" fill="none" aria-hidden>
      <defs>
        <linearGradient id={`${gid}-g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={theme.from} />
          <stop offset="100%" stopColor={theme.to} />
        </linearGradient>
        <linearGradient id={`${gid}-soft`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={theme.from} stopOpacity="0.22" />
          <stop offset="100%" stopColor={theme.to} stopOpacity="0.05" />
        </linearGradient>
        <radialGradient id={`${gid}-halo`} cx="50%" cy="44%" r="55%">
          <stop offset="0%" stopColor={theme.from} stopOpacity="0.45" />
          <stop offset="100%" stopColor={theme.from} stopOpacity="0" />
        </radialGradient>
        <filter id={`${gid}-blur`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* soft halo (brightens on hover) */}
      <circle cx="60" cy="56" r="46" fill={`url(#${gid}-halo)`} className="opacity-60 transition-opacity duration-500 group-hover/glow:opacity-100" />

      {/* the mark — gently bobs, parallaxes to cursor, lifts on hover */}
      <g
        className="animate-bob transition-transform duration-500 group-hover/glow:scale-105"
        style={{
          transformOrigin: "60px 60px",
          transform: "translate(calc(var(--px,0)*8px), calc(var(--py,0)*8px))",
        }}
      >
        {children}
      </g>
    </svg>
  );
}

const lineFill = (gid: string) => ({
  fill: `url(#${gid}-soft)`,
  stroke: `url(#${gid}-g)`,
  strokeWidth: 4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

/* 1 · Events — a ticket. */
export function ArtEvents({ gid }: ArtProps) {
  const t = THEMES[0];
  return (
    <Mark gid={gid} theme={t}>
      <path
        d="M30 44a6 6 0 0 1 6-6h48a6 6 0 0 1 6 6v8a8 8 0 0 0 0 16v8a6 6 0 0 1-6 6H36a6 6 0 0 1-6-6v-8a8 8 0 0 0 0-16v-8Z"
        {...lineFill(gid)}
        filter={`url(#${gid}-blur)`}
      />
      <line x1="60" y1="42" x2="60" y2="50" stroke={t.accent} strokeWidth="3" strokeLinecap="round" strokeDasharray="2 5" />
      <line x1="60" y1="58" x2="60" y2="78" stroke={t.accent} strokeWidth="3" strokeLinecap="round" strokeDasharray="2 5" />
    </Mark>
  );
}

/* 2 · Prize — a trophy. */
export function ArtPrize({ gid }: ArtProps) {
  const t = THEMES[1];
  return (
    <Mark gid={gid} theme={t}>
      <path d="M44 34h32v12a16 16 0 0 1-32 0V34Z" {...lineFill(gid)} filter={`url(#${gid}-blur)`} />
      <path d="M44 38H34a8 8 0 0 0 8 10M76 38h10a8 8 0 0 1-8 10" stroke={`url(#${gid}-g)`} strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M56 62h8v10h8a4 4 0 0 1 4 4v6H44v-6a4 4 0 0 1 4-4h8V62Z" {...lineFill(gid)} />
      <circle cx="60" cy="44" r="5" fill={t.accent} className="animate-pulse-glow" />
    </Mark>
  );
}

/* 3 · Results — a checklist / clipboard with a check. */
export function ArtResults({ gid }: ArtProps) {
  const t = THEMES[2];
  return (
    <Mark gid={gid} theme={t}>
      <rect x="36" y="32" width="48" height="58" rx="8" {...lineFill(gid)} filter={`url(#${gid}-blur)`} />
      <rect x="50" y="28" width="20" height="10" rx="3" fill={`url(#${gid}-g)`} />
      <path d="M46 54l5 5 9-10" stroke={t.accent} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="64" y1="54" x2="76" y2="54" stroke={`url(#${gid}-g)`} strokeWidth="4" strokeLinecap="round" />
      <line x1="46" y1="72" x2="74" y2="72" stroke={`url(#${gid}-g)`} strokeWidth="4" strokeLinecap="round" opacity="0.6" />
    </Mark>
  );
}

/* 4 · Communities — three people. */
export function ArtCommunities({ gid }: ArtProps) {
  const t = THEMES[3];
  return (
    <Mark gid={gid} theme={t}>
      <circle cx="60" cy="44" r="12" {...lineFill(gid)} filter={`url(#${gid}-blur)`} />
      <path d="M40 88a20 20 0 0 1 40 0Z" {...lineFill(gid)} />
      <circle cx="36" cy="52" r="9" fill={`url(#${gid}-soft)`} stroke={`url(#${gid}-g)`} strokeWidth="3.5" />
      <circle cx="84" cy="52" r="9" fill={`url(#${gid}-soft)`} stroke={`url(#${gid}-g)`} strokeWidth="3.5" />
      <circle cx="60" cy="44" r="4" fill={t.accent} className="animate-pulse-glow" />
    </Mark>
  );
}

/* 5 · Leaderboard — a podium. */
export function ArtLeaderboard({ gid }: ArtProps) {
  const t = THEMES[4];
  return (
    <Mark gid={gid} theme={t}>
      <rect x="48" y="44" width="24" height="44" rx="4" {...lineFill(gid)} filter={`url(#${gid}-blur)`} />
      <rect x="26" y="58" width="22" height="30" rx="4" {...lineFill(gid)} />
      <rect x="72" y="66" width="22" height="22" rx="4" {...lineFill(gid)} />
      <path d="M60 30l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" fill={t.accent} className="animate-pulse-glow" />
    </Mark>
  );
}

/* 6 · Store — a shopping bag. */
export function ArtStore({ gid }: ArtProps) {
  const t = THEMES[5];
  return (
    <Mark gid={gid} theme={t}>
      <path d="M38 48h44l-4 38a6 6 0 0 1-6 6H48a6 6 0 0 1-6-6l-4-38Z" {...lineFill(gid)} filter={`url(#${gid}-blur)`} />
      <path d="M48 48v-6a12 12 0 0 1 24 0v6" stroke={`url(#${gid}-g)`} strokeWidth="4" strokeLinecap="round" fill="none" />
      <circle cx="60" cy="68" r="5" fill={t.accent} className="animate-pulse-glow" />
    </Mark>
  );
}

/* 7 · Sponsors — a handshake-ish badge / ribbon. */
export function ArtSponsors({ gid }: ArtProps) {
  const t = THEMES[6];
  return (
    <Mark gid={gid} theme={t}>
      <circle cx="60" cy="50" r="22" {...lineFill(gid)} filter={`url(#${gid}-blur)`} />
      <path d="M50 50l7 7 13-14" stroke={t.accent} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M48 70l-6 20 18-8 18 8-6-20" {...lineFill(gid)} />
    </Mark>
  );
}

/* 8 · Profiles — an ID card / avatar badge. */
export function ArtProfile({ gid }: ArtProps) {
  const t = THEMES[7];
  return (
    <Mark gid={gid} theme={t}>
      <rect x="30" y="36" width="60" height="48" rx="8" {...lineFill(gid)} filter={`url(#${gid}-blur)`} />
      <circle cx="48" cy="56" r="9" fill={`url(#${gid}-g)`} />
      <path d="M40 76a8 8 0 0 1 16 0Z" fill={`url(#${gid}-g)`} />
      <line x1="64" y1="52" x2="80" y2="52" stroke={t.accent} strokeWidth="4" strokeLinecap="round" />
      <line x1="64" y1="62" x2="80" y2="62" stroke={`url(#${gid}-g)`} strokeWidth="4" strokeLinecap="round" opacity="0.6" />
    </Mark>
  );
}

/* 9 · Ledger — a shield. */
export function ArtLedger({ gid }: ArtProps) {
  const t = THEMES[8];
  return (
    <Mark gid={gid} theme={t}>
      <path d="M60 30l26 10v20c0 20-13 31-26 38-13-7-26-18-26-38V40l26-10Z" {...lineFill(gid)} filter={`url(#${gid}-blur)`} />
      <path d="M50 60l7 8 14-16" stroke={t.accent} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    </Mark>
  );
}

export const SURFACE_ART = [
  ArtEvents,
  ArtPrize,
  ArtResults,
  ArtCommunities,
  ArtLeaderboard,
  ArtStore,
  ArtSponsors,
  ArtProfile,
  ArtLedger,
] as const;
