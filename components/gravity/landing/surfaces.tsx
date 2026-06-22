"use client";

/**
 * "Everything in one arena" — the nine product surfaces from the plan, as
 * cinematic GlowCards that reveal on scroll. This is the feature showcase.
 */
import {
  Swords,
  Trophy,
  Users,
  BarChart3,
  ShoppingBag,
  Megaphone,
  UserCircle,
  Coins,
  ShieldCheck,
} from "lucide-react";
import { GlowCard } from "@/components/gravity/glow-card";
import { SectionHeading } from "@/components/gravity/section-heading";
import { Reveal } from "@/components/gravity/scroll/reveal";

const SURFACES = [
  {
    icon: Swords,
    title: "Events & Registration",
    body: "Filter, discover, register and pay. Room ID + password delivered to paid players by email & WhatsApp.",
  },
  {
    icon: Coins,
    title: "Prize Pools & Payouts",
    body: "Set entry fee, rank prizes, per-kill bounties and caps. The engine validates the split to the rupee.",
  },
  {
    icon: Trophy,
    title: "Screenshot Results",
    body: "Upload the final leaderboard, enter kills & ranks — winnings compute and publish automatically.",
  },
  {
    icon: Users,
    title: "Communities",
    body: "Paid or free join, member chat, small groups, 1-v-1 invites, elite tiers and an earning dashboard.",
  },
  {
    icon: BarChart3,
    title: "Leaderboards",
    body: "Ranked by kill-ratio, win-ratio and net earnings — by event, community, daily, monthly or all-time.",
  },
  {
    icon: ShoppingBag,
    title: "Store",
    body: "Jerseys, gear and passes. Full inventory, partial payments, verified-purchase reviews.",
  },
  {
    icon: Megaphone,
    title: "Sponsors",
    body: "A sponsor directory and request flow routed to the right community admin to publish.",
  },
  {
    icon: UserCircle,
    title: "Player Profiles",
    body: "Per-game IDs, ranking, earnings, badges and verified gov-ID — your complete gaming identity.",
  },
  {
    icon: ShieldCheck,
    title: "One Secure Ledger",
    body: "Every rupee — entry, membership, store, payout, refund — is one auditable row. Money done right.",
  },
] as const;

export function Surfaces() {
  return (
    <section className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="One platform, nine surfaces"
        title={
          <>
            Everything a tournament needs,{" "}
            <span className="gv-text-gradient">in one arena</span>
          </>
        }
        lead="From the first registration to the final payout — and the community that keeps players coming back."
        align="center"
        className="mx-auto"
      />

      <Reveal
        as="div"
        stagger={0.06}
        y={36}
        className="mt-16 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
      >
        {SURFACES.map((s) => {
          const Icon = s.icon;
          return (
            <GlowCard key={s.title} className="h-full">
              <div className="flex h-full flex-col gap-4 p-6">
                <span className="inline-flex size-11 items-center justify-center rounded-lg border border-crimson-700/40 bg-crimson-500/10 text-crimson-300">
                  <Icon className="size-5" />
                </span>
                <div>
                  <h3 className="font-display text-xl tracking-tight">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-muted">
                    {s.body}
                  </p>
                </div>
              </div>
            </GlowCard>
          );
        })}
      </Reveal>
    </section>
  );
}
