"use client";

/**
 * <GameLogo> — shows a REAL game logo from public/games/<slug>.(svg|png|webp)
 * if you've dropped one in; otherwise falls back to the built-in stylized
 * badge (so the UI never looks empty and you stay clear of trademark issues
 * until you supply licensed assets).
 *
 * Drop files at: public/games/free_fire.svg, public/games/bgmi.svg, etc.
 */
import { useState } from "react";
import Image from "next/image";
import {
  FreeFireBadge,
  BgmiBadge,
  PubgBadge,
  GameBadge,
} from "@/components/gravity/game-badges";

export function GameLogo({
  slug,
  name,
  from,
  to,
  className,
}: {
  slug: string;
  name: string;
  from?: string;
  to?: string;
  className?: string;
}) {
  // Try the supplied real logo first; on error, fall back to the badge.
  const [src, setSrc] = useState<string | null>(`/games/${slug}.svg`);

  if (!src) {
    return <BadgeFallback slug={slug} from={from} to={to} />;
  }

  return (
    <Image
      src={src}
      alt={name}
      fill
      className={className ?? "object-contain"}
      sizes="80px"
      unoptimized
      onError={() => {
        // try other extensions, then give up to the stylized badge
        if (src.endsWith(".svg")) setSrc(`/games/${slug}.png`);
        else if (src.endsWith(".png")) setSrc(`/games/${slug}.webp`);
        else setSrc(null);
      }}
    />
  );
}

/** Stable fallback — render each badge directly (no dynamic component var). */
function BadgeFallback({
  slug,
  from,
  to,
}: {
  slug: string;
  from?: string;
  to?: string;
}) {
  if (slug === "free_fire") return <FreeFireBadge gid={slug} from={from} to={to} />;
  if (slug === "bgmi") return <BgmiBadge gid={slug} from={from} to={to} />;
  if (slug === "pubg") return <PubgBadge gid={slug} from={from} to={to} />;
  return <GameBadge gid={slug} from={from} to={to} />;
}
