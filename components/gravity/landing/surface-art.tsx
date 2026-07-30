/**
 * Big, complex, multi-theme interactive SVG scenes for the nine surfaces.
 *
 * Each scene has its OWN color theme (crimson, ember, cyan, violet, lime, gold,
 * magenta, teal, blue) so the section isn't monochrome orange. They're built on
 * a 0..200 viewBox (larger, more detail), with:
 *  - a layered glow + grid backplate
 *  - multiple depth layers that parallax to the cursor (--px / --py)
 *  - draw-on / pulse / float reactions on hover (group-hover/glow:)
 *
 * The card passes a `theme` (two hex stops + a soft accent). The scene reads
 * gradient ids scoped per-card via the `gid` prop so multiple cards coexist.
 */
import type { ReactNode } from "react";

export type Theme = { from: string; to: string; accent: string };

export const THEMES: Theme[] = [
  { from: "#ff2d55", to: "#ff8a4d", accent: "#ff6478" }, // 1 crimson→ember
  { from: "#ffb020", to: "#ff7a18", accent: "#ffd16b" }, // 2 gold
  { from: "#22d3ee", to: "#3b82f6", accent: "#67e8f9" }, // 3 cyan→blue
  { from: "#a855f7", to: "#6366f1", accent: "#c4b5fd" }, // 4 violet
  { from: "#a3e635", to: "#22c55e", accent: "#bef264" }, // 5 lime→green
  { from: "#f43f5e", to: "#ec4899", accent: "#fb7185" }, // 6 rose→magenta
  { from: "#f59e0b", to: "#ef4444", accent: "#fbbf24" }, // 7 amber→red
  { from: "#2dd4bf", to: "#0ea5e9", accent: "#5eead4" }, // 8 teal→sky
  { from: "#818cf8", to: "#e879f9", accent: "#a5b4fc" }, // 9 indigo→fuchsia
];

function Frame({
  gid,
  theme,
  children,
}: {
  gid: string;
  theme: Theme;
  children: ReactNode;
}) {
  return (
    <svg viewBox="0 0 200 200" className="size-full overflow-visible" fill="none" aria-hidden>
      <defs>
        <linearGradient id={`${gid}-g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={theme.from} />
          <stop offset="100%" stopColor={theme.to} />
        </linearGradient>
        <linearGradient id={`${gid}-gv`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={theme.accent} />
          <stop offset="100%" stopColor={theme.to} />
        </linearGradient>
        <radialGradient id={`${gid}-glow`} cx="50%" cy="42%" r="60%">
          <stop offset="0%" stopColor={theme.from} stopOpacity="0.45" />
          <stop offset="100%" stopColor={theme.from} stopOpacity="0" />
        </radialGradient>
        <filter id={`${gid}-soft`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* glow + grid backplate */}
      <circle cx="100" cy="92" r="86" fill={`url(#${gid}-glow)`} className="opacity-50 transition-opacity duration-500 group-hover/glow:opacity-100" />
      <g
        className="origin-center transition-transform duration-700 group-hover/glow:rotate-12"
        style={{ transform: "translate(calc(var(--px,0)*-10px), calc(var(--py,0)*-10px))" }}
      >
        <circle cx="100" cy="98" r="76" stroke="#ffffff" strokeOpacity="0.05" strokeWidth="1" strokeDasharray="3 9" />
        <circle cx="100" cy="98" r="54" stroke="#ffffff" strokeOpacity="0.04" strokeWidth="1" />
      </g>
      {children}
    </svg>
  );
}

function Layer({ depth = 12, children }: { depth?: number; children: ReactNode }) {
  return (
    <g
      className="transition-transform duration-300 ease-out"
      style={{ transform: `translate(calc(var(--px,0) * ${depth}px), calc(var(--py,0) * ${depth}px))` }}
    >
      {children}
    </g>
  );
}

const draw =
  "[stroke-dasharray:340] [stroke-dashoffset:340] transition-[stroke-dashoffset] duration-[1100ms] ease-out group-hover/glow:[stroke-dashoffset:0]";

type ArtProps = { gid: string; theme: Theme };
const S = (gid: string) => ({
  stroke: `url(#${gid}-g)`,
  strokeWidth: 4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  fill: "none",
});

/** 1 — Events: tournament bracket tree with crossed blades at the root. */
export function ArtEvents({ gid }: ArtProps) {
  return (
    <Frame gid={gid} theme={THEMES[0]}>
      <Layer depth={6}>
        {/* bracket lines */}
        <path d="M40 56 h26 v40 h26 M40 140 h26 v-40 M160 56 h-26 v40 h-26 M160 140 h-26 v-40" stroke={`url(#${gid}-g)`} strokeWidth="2.5" className={draw} />
        <circle cx="40" cy="56" r="6" fill={`url(#${gid}-gv)`} />
        <circle cx="40" cy="140" r="6" fill={`url(#${gid}-gv)`} />
        <circle cx="160" cy="56" r="6" fill={`url(#${gid}-gv)`} />
        <circle cx="160" cy="140" r="6" fill={`url(#${gid}-gv)`} />
      </Layer>
      <Layer depth={18}>
        <line x1="78" y1="120" x2="122" y2="76" {...S(gid)} filter={`url(#${gid}-soft)`} className="origin-center transition-transform duration-500 group-hover/glow:-rotate-6" style={{ transformOrigin: "100px 98px" }} />
        <line x1="122" y1="120" x2="78" y2="76" {...S(gid)} filter={`url(#${gid}-soft)`} className="origin-center transition-transform duration-500 group-hover/glow:rotate-6" style={{ transformOrigin: "100px 98px" }} />
        <circle cx="100" cy="98" r="13" fill={`url(#${gid}-gv)`} className="animate-pulse-glow" />
      </Layer>
    </Frame>
  );
}

/** 2 — Prize pool: coin tower + floating ₹ + sparkles. */
export function ArtPrize({ gid }: ArtProps) {
  return (
    <Frame gid={gid} theme={THEMES[1]}>
      <Layer depth={6}>
        {[0, 1, 2, 3, 4].map((i) => (
          <ellipse key={i} cx="100" cy={150 - i * 18} rx="40" ry="13" fill="none" stroke={`url(#${gid}-gv)`} strokeWidth="4" style={{ transitionDelay: `${i * 60}ms` }} />
        ))}
      </Layer>
      <Layer depth={20}>
        <g className="transition-transform duration-500 group-hover/glow:-translate-y-3">
          <circle cx="100" cy="56" r="22" fill={`url(#${gid}-g)`} filter={`url(#${gid}-soft)`} />
          <text x="100" y="65" textAnchor="middle" fontSize="26" fontWeight="800" fill="#0b0a0c">₹</text>
        </g>
        <g className="opacity-0 transition-opacity duration-500 group-hover/glow:opacity-100">
          <path d="M150 50 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3 z" fill={THEMES[1].accent} />
          <path d="M52 70 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 z" fill={THEMES[1].accent} />
        </g>
      </Layer>
    </Frame>
  );
}

/** 3 — Results: a phone/screenshot with a leaderboard + a big check. */
export function ArtResults({ gid }: ArtProps) {
  return (
    <Frame gid={gid} theme={THEMES[2]}>
      <Layer depth={6}>
        <rect x="56" y="40" width="88" height="120" rx="14" {...S(gid)} />
        <rect x="68" y="58" width="64" height="10" rx="5" fill={`url(#${gid}-gv)`} opacity="0.9" />
        <rect x="68" y="78" width="50" height="7" rx="3.5" fill="#ffffff" opacity="0.18" />
        <rect x="68" y="92" width="58" height="7" rx="3.5" fill="#ffffff" opacity="0.14" />
        <rect x="68" y="106" width="44" height="7" rx="3.5" fill="#ffffff" opacity="0.1" />
      </Layer>
      <Layer depth={22}>
        <circle cx="138" cy="138" r="24" fill={`url(#${gid}-gv)`} filter={`url(#${gid}-soft)`} />
        <path d="M126 138 l9 9 l18 -19" stroke="#0b0a0c" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" className={draw} />
      </Layer>
    </Frame>
  );
}

/** 4 — Communities: a network graph that draws + pulses. */
export function ArtCommunities({ gid }: ArtProps) {
  const n: [number, number][] = [[100, 44], [50, 84], [150, 84], [68, 150], [132, 150], [100, 110]];
  return (
    <Frame gid={gid} theme={THEMES[3]}>
      <Layer depth={5}>
        <path d="M100 44 L50 84 M100 44 L150 84 M50 84 L68 150 M150 84 L132 150 M68 150 L132 150 M100 110 L100 44 M100 110 L50 84 M100 110 L150 84 M100 110 L68 150 M100 110 L132 150" stroke={`url(#${gid}-g)`} strokeWidth="2" className={draw} opacity="0.8" />
      </Layer>
      <Layer depth={16}>
        {n.map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r={i === 5 ? 13 : 10} fill={`url(#${gid}-gv)`} className="animate-pulse-glow" style={{ animationDelay: `${i * 150}ms` }} filter={`url(#${gid}-soft)`} />
          </g>
        ))}
      </Layer>
    </Frame>
  );
}

/** 5 — Leaderboards: podium + bars + a crown. */
export function ArtLeaderboard({ gid }: ArtProps) {
  const bars: [number, number][] = [[52, 50], [86, 84], [120, 36]];
  return (
    <Frame gid={gid} theme={THEMES[4]}>
      <Layer depth={6}>
        {bars.map(([x, h], i) => (
          <rect key={i} x={x} y={156 - h} width="26" height={h} rx="5" fill={`url(#${gid}-gv)`} className="origin-bottom scale-y-0 transition-transform duration-700 group-hover/glow:scale-y-100" style={{ transformOrigin: `${x + 13}px 156px`, transitionDelay: `${i * 110}ms` }} />
        ))}
        <line x1="36" y1="156" x2="164" y2="156" stroke={`url(#${gid}-g)`} strokeWidth="4" />
      </Layer>
      <Layer depth={20}>
        <path d="M86 56 l7 14 l13 -11 l-4 22 h-32 l-4 -22 l13 11 z" fill={`url(#${gid}-g)`} className="transition-transform duration-500 group-hover/glow:-translate-y-2" filter={`url(#${gid}-soft)`} />
      </Layer>
    </Frame>
  );
}

/** 6 — Store: a shopping bag with a swinging tag + barcode. */
export function ArtStore({ gid }: ArtProps) {
  return (
    <Frame gid={gid} theme={THEMES[5]}>
      <Layer depth={6}>
        <path d="M58 74 h84 l-9 76 a8 8 0 0 1 -8 7 h-42 a8 8 0 0 1 -8 -7 z" {...S(gid)} fill="rgba(244,63,94,0.06)" />
        <path d="M78 74 v-8 a22 22 0 0 1 44 0 v8" {...S(gid)} strokeWidth="3.5" />
        <g opacity="0.5">
          <line x1="80" y1="118" x2="80" y2="138" stroke={`url(#${gid}-g)`} strokeWidth="2" />
          <line x1="88" y1="118" x2="88" y2="138" stroke={`url(#${gid}-g)`} strokeWidth="3" />
          <line x1="96" y1="118" x2="96" y2="138" stroke={`url(#${gid}-g)`} strokeWidth="2" />
        </g>
      </Layer>
      <Layer depth={20}>
        <g className="origin-top transition-transform duration-500 group-hover/glow:rotate-12" style={{ transformOrigin: "100px 92px" }}>
          <line x1="100" y1="92" x2="100" y2="112" stroke={`url(#${gid}-g)`} strokeWidth="3" />
          <circle cx="100" cy="120" r="11" fill={`url(#${gid}-gv)`} filter={`url(#${gid}-soft)`} />
          <circle cx="100" cy="116" r="2.5" fill="#0b0a0c" />
        </g>
      </Layer>
    </Frame>
  );
}

/** 7 — Sponsors: interlocking rings + a handshake spark. */
export function ArtSponsors({ gid }: ArtProps) {
  return (
    <Frame gid={gid} theme={THEMES[6]}>
      <Layer depth={8}>
        <circle cx="78" cy="100" r="30" {...S(gid)} filter={`url(#${gid}-soft)`} />
        <circle cx="122" cy="100" r="30" {...S(gid)} filter={`url(#${gid}-soft)`} />
      </Layer>
      <Layer depth={22}>
        <rect x="90" y="90" width="20" height="20" rx="6" fill={`url(#${gid}-g)`} className="animate-pulse-glow" filter={`url(#${gid}-soft)`} />
        <path d="M150 64 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3 z" fill={THEMES[6].accent} className="opacity-0 transition-opacity duration-500 group-hover/glow:opacity-100" />
      </Layer>
    </Frame>
  );
}

/** 8 — Profiles: avatar ring + orbiting verified badge + stat ticks. */
export function ArtProfile({ gid }: ArtProps) {
  return (
    <Frame gid={gid} theme={THEMES[7]}>
      <Layer depth={6}>
        <circle cx="100" cy="84" r="26" {...S(gid)} />
        <path d="M58 154 a42 42 0 0 1 84 0" {...S(gid)} />
        <g opacity="0.6">
          <line x1="40" y1="60" x2="52" y2="60" stroke={`url(#${gid}-g)`} strokeWidth="3" />
          <line x1="148" y1="60" x2="160" y2="60" stroke={`url(#${gid}-g)`} strokeWidth="3" />
        </g>
      </Layer>
      <Layer depth={20}>
        <g className="origin-center transition-transform duration-700 group-hover/glow:rotate-45" style={{ transformOrigin: "100px 96px" }}>
          <circle cx="138" cy="58" r="15" fill={`url(#${gid}-gv)`} filter={`url(#${gid}-soft)`} />
          <path d="M131 58 l5 5 l9 -10" stroke="#0b0a0c" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </Layer>
    </Frame>
  );
}

/** 9 — Ledger: a shield with ledger rows + a glowing lock core. */
export function ArtLedger({ gid }: ArtProps) {
  return (
    <Frame gid={gid} theme={THEMES[8]}>
      <Layer depth={6}>
        <path d="M100 38 l44 16 v34 c0 34 -22 53 -44 64 c-22 -11 -44 -30 -44 -64 v-34 z" {...S(gid)} fill="rgba(129,140,248,0.06)" />
        <path d="M82 92 h36 M82 106 h36 M82 120 h22" stroke={`url(#${gid}-g)`} strokeWidth="3.5" className={draw} opacity="0.85" />
      </Layer>
      <Layer depth={18}>
        <circle cx="100" cy="104" r="13" fill={`url(#${gid}-gv)`} className="opacity-0 transition-opacity duration-500 group-hover/glow:opacity-100" filter={`url(#${gid}-soft)`} />
        <rect x="93" y="98" width="14" height="12" rx="3" fill="none" stroke={`url(#${gid}-g)`} strokeWidth="2.5" className="opacity-0 transition-opacity duration-500 group-hover/glow:opacity-100" />
      </Layer>
    </Frame>
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
