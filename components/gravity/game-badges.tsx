/**
 * Stylized game badges — ORIGINAL emblems that evoke each title without copying
 * any trademarked logo. Free Fire → flame, BGMI → tactical helmet, PUBG → pan +
 * crosshair. Bold, premium, single confident mark per game, themed to the
 * crimson/ember palette by default (override `from`/`to` per use).
 *
 * They double as the public-facing "games we support" marks and as the fallback
 * when a real game artwork image (public/games/<slug>.*) isn't present.
 */
import { cn } from "@/lib/utils";

type BadgeProps = {
  className?: string;
  from?: string;
  to?: string;
  /** unique id so multiple gradients coexist on one page */
  gid?: string;
};

function Defs({ gid, from, to }: { gid: string; from: string; to: string }) {
  return (
    <defs>
      <linearGradient id={`${gid}-g`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={from} />
        <stop offset="100%" stopColor={to} />
      </linearGradient>
      <filter id={`${gid}-glow`} x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="2.5" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
}

/** Free Fire — a clean, sharp flame. */
export function FreeFireBadge({ className, from = "#ff2d55", to = "#ff8a4d", gid = "ff" }: BadgeProps) {
  return (
    <svg viewBox="0 0 64 64" className={cn("size-full", className)} fill="none" aria-label="Free Fire">
      <Defs gid={gid} from={from} to={to} />
      <path
        d="M32 6c5 8 1 13 4 18 2-2 3-5 3-8 6 6 11 14 11 22a18 18 0 0 1-36 0c0-6 3-11 7-15 1 4 3 6 6 7-3-8 0-16 5-24Z"
        fill={`url(#${gid}-g)`}
        filter={`url(#${gid}-glow)`}
      />
      <path
        d="M32 30c3 4 5 7 5 11a5 5 0 0 1-10 0c0-3 2-6 5-11Z"
        fill="#0b0a0c"
        fillOpacity="0.55"
      />
    </svg>
  );
}

/** BGMI — a tactical/esports helmet silhouette with a visor. */
export function BgmiBadge({ className, from = "#ffb020", to = "#ff6a18", gid = "bgmi" }: BadgeProps) {
  return (
    <svg viewBox="0 0 64 64" className={cn("size-full", className)} fill="none" aria-label="BGMI">
      <Defs gid={gid} from={from} to={to} />
      {/* helmet shell */}
      <path
        d="M12 34a20 20 0 0 1 40 0v6a4 4 0 0 1-4 4H40l-2 6H26l-2-6h-8a4 4 0 0 1-4-4v-6Z"
        fill={`url(#${gid}-g)`}
        filter={`url(#${gid}-glow)`}
      />
      {/* visor slit */}
      <rect x="22" y="30" width="20" height="7" rx="3.5" fill="#0b0a0c" fillOpacity="0.6" />
      {/* side comms */}
      <rect x="44" y="34" width="9" height="6" rx="3" fill={`url(#${gid}-g)`} />
      <circle cx="32" cy="20" r="2.5" fill="#0b0a0c" fillOpacity="0.5" />
    </svg>
  );
}

/** PUBG — a frying pan crossed with a crosshair (the "winner winner" nod). */
export function PubgBadge({ className, from = "#22d3ee", to = "#3b82f6", gid = "pubg" }: BadgeProps) {
  return (
    <svg viewBox="0 0 64 64" className={cn("size-full", className)} fill="none" aria-label="PUBG">
      <Defs gid={gid} from={from} to={to} />
      {/* pan */}
      <circle cx="26" cy="34" r="16" fill={`url(#${gid}-g)`} filter={`url(#${gid}-glow)`} />
      <circle cx="26" cy="34" r="9" fill="#0b0a0c" fillOpacity="0.4" />
      <rect x="40" y="31" width="20" height="6" rx="3" transform="rotate(-2 50 34)" fill={`url(#${gid}-g)`} />
      {/* crosshair overlay */}
      <g stroke={to} strokeWidth="2.5" strokeLinecap="round" opacity="0.9">
        <circle cx="26" cy="34" r="20" fill="none" strokeDasharray="6 7" />
        <line x1="26" y1="8" x2="26" y2="16" />
        <line x1="26" y1="52" x2="26" y2="60" />
        <line x1="2" y1="34" x2="8" y2="34" />
      </g>
    </svg>
  );
}

/** Generic controller badge — fallback for any other game. */
export function GameBadge({ className, from = "#a855f7", to = "#6366f1", gid = "game" }: BadgeProps) {
  return (
    <svg viewBox="0 0 64 64" className={cn("size-full", className)} fill="none" aria-label="Game">
      <Defs gid={gid} from={from} to={to} />
      <path
        d="M20 22h24a12 12 0 0 1 11.7 14.6l-2 9A8 8 0 0 1 42 50l-4-6H26l-4 6a8 8 0 0 1-13.7-4.4l-2-9A12 12 0 0 1 20 22Z"
        fill={`url(#${gid}-g)`}
        filter={`url(#${gid}-glow)`}
      />
      <circle cx="42" cy="33" r="3" fill="#0b0a0c" fillOpacity="0.6" />
      <circle cx="48" cy="39" r="3" fill="#0b0a0c" fillOpacity="0.6" />
      <rect x="16" y="31" width="10" height="3" rx="1.5" fill="#0b0a0c" fillOpacity="0.6" />
      <rect x="19.5" y="27.5" width="3" height="10" rx="1.5" fill="#0b0a0c" fillOpacity="0.6" />
    </svg>
  );
}

/** Map a game slug → its badge component. */
export function badgeForSlug(slug: string) {
  switch (slug) {
    case "free_fire":
      return FreeFireBadge;
    case "bgmi":
      return BgmiBadge;
    case "pubg":
      return PubgBadge;
    default:
      return GameBadge;
  }
}

export const SUPPORTED_GAMES = [
  { slug: "free_fire", name: "Free Fire", Badge: FreeFireBadge, from: "#ff2d55", to: "#ff8a4d" },
  { slug: "bgmi", name: "BGMI", Badge: BgmiBadge, from: "#ffb020", to: "#ff6a18" },
  { slug: "pubg", name: "PUBG", Badge: PubgBadge, from: "#22d3ee", to: "#3b82f6" },
] as const;
