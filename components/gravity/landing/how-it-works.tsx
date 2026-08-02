"use client";

/**
 * ============================================================================
 * HOW IT WORKS — "From entry fee to payout" as a PINNED HORIZONTAL TRACK
 * ============================================================================
 *
 * Direction: on desktop (lg+) the section PINS to the viewport and a six-panel
 * rail — the 5 loop steps + the canonical ₹2,000 prize-math FINALE — translates
 * sideways, driven 1:1 by vertical scroll progress. You "scroll down" and the
 * core loop walks left → right, landing on the finale card whose figures count
 * up and whose proportion bars grow to prove the pool resolves to exactly
 * ₹2,000 ✓.
 *
 * Three synchronized read-outs share ONE scrubbed progress (0→1):
 *   1. The RAIL — `gsap.to(rail, { x })` slides the panels; `onUpdate` publishes
 *      the centered panel index that lights badges, the dot tracker + the count.
 *   2. The TOP PROGRESS BAR — a crimson→ember fill scrubbed over the same range.
 *   3. The FINALE — once it scrolls in, rows light, bars grow to each row's share
 *      of the pool, and the grand total COUNTS UP 0 → ₹2,000.
 *
 * Robust by construction — no fragile pin math, no empty voids:
 *   - The pin's scroll length is DERIVED from the rail's real horizontal travel
 *     (`scrollWidth - innerWidth`), via a function-based `end` + function-based
 *     `x` target + `invalidateOnRefresh`. So the pin always ends exactly when the
 *     last card lands flush — it can never leave a blank tail, clip a card, or
 *     drift when the viewport, fonts, or SVG scenes settle.
 *   - Everything is GSAP via `useGSAP` scoped to the root ref, set up inside a
 *     `gsap.context` so all triggers self-clean; one `ScrollTrigger.refresh()`
 *     runs after setup.
 *   - `prefers-reduced-motion` OR < lg → no pin, no sideways scroll: the panels
 *     stack into a clean vertical column rendered in their final, fully-lit,
 *     fully-counted state.
 *
 * Tokens only: crimson/ember, gv-panel, gv-card-accent, gv-text-gradient,
 * gv-rule, gv-grid-bg, font-display/mono, text-muted/dim, border-line,
 * shadow-glow, ease-gv, animate-pulse-glow/animate-aurora. The only literal hex
 * is BRAND, which feeds the surface-art SVG scenes (they require real gradient
 * stops); it mirrors --gv-grad-accent (crimson→ember).
 * ============================================================================
 */
import { useRef, useState, type ComponentType, type RefObject } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, ScrollTrigger, prefersReducedMotion } from "@/components/gravity/scroll/gsap";
import { SectionHeading } from "@/components/gravity/section-heading";
import {
  ArtEvents,
  ArtProfile,
  ArtLeaderboard,
  ArtResults,
  ArtLedger,
  THEMES,
  type Theme,
} from "@/components/gravity/landing/surface-art";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------------------
 * Content (canonical copy + math — unchanged)
 * ------------------------------------------------------------------------- */
type Art = ComponentType<{ gid: string; theme: Theme }>;

const STEPS: ReadonlyArray<{ n: string; title: string; body: string; art: Art }> = [
  {
    n: "01",
    title: "Players register & pay",
    body: "Entry fees collected via Razorpay. Money settles only on the signed webhook, and a slot is reserved the moment payment confirms.",
    art: ArtEvents,
  },
  {
    n: "02",
    title: "Organizer opens the room",
    body: "A custom in-game room is created. The Room ID and password are revealed only to paid players, and pushed by email and WhatsApp.",
    art: ArtProfile,
  },
  {
    n: "03",
    title: "The match is played",
    body: "Players drop in and compete. No fragile game API, the room is hosted exactly like every real Indian tournament.",
    art: ArtLeaderboard,
  },
  {
    n: "04",
    title: "Results from a screenshot",
    body: "The organizer uploads the final leaderboard and enters ranks and kills. The prize engine computes every payout instantly.",
    art: ArtResults,
  },
  {
    n: "05",
    title: "Winnings transferred",
    body: "Payouts hit winners' UPI and post to the public results, every rupee written to one immutable ledger.",
    art: ArtLedger,
  },
];

/** Canonical split. `value` (rupees) feeds the row, the bar share + the tally. */
const ROWS: ReadonlyArray<{ label: string; value: number; step: 4 | 5 }> = [
  { label: "1st place", value: 700, step: 4 },
  { label: "2nd place", value: 300, step: 4 },
  { label: "3rd place", value: 100, step: 4 },
  { label: "Per-kill bounty (cap ₹490)", value: 490, step: 4 },
  { label: "Platform cut", value: 110, step: 5 },
  { label: "Organizer profit", value: 300, step: 5 },
];

const POOL = ROWS.reduce((s, r) => s + r.value, 0); // 2000 — derived, never wrong

// Crimson→ember brand theme (surface-art THEMES[0]). The literal hex it carries
// only feeds the SVG scenes, which require real gradient stops; mirrors
// --gv-grad-accent.
const BRAND: Theme = THEMES[0];

// Panels riding the rail: 5 steps + the prize finale.
const PANELS = STEPS.length + 1;
const FINALE = PANELS - 1; // 0-based index of the finale panel

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/* ===========================================================================
 * Component
 * ========================================================================= */
export function HowItWorks() {
  const root = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);
  const tallyRef = useRef<HTMLSpanElement>(null);

  // 0-based index of the panel currently centered in the rail.
  const [active, setActive] = useState(0);
  // True once the finale prize card is on screen (gates rows / bars / tally).
  const [finaleIn, setFinaleIn] = useState(false);

  useGSAP(
    () => {
      const pin = pinRef.current;
      const rail = railRef.current;
      if (!pin || !rail) return;

      const finalState = () => {
        setActive(FINALE);
        setFinaleIn(true);
        if (tallyRef.current) tallyRef.current.textContent = inr(POOL);
        if (progressRef.current) gsap.set(progressRef.current, { scaleX: 1 });
      };

      const isDesktop = window.matchMedia("(min-width: 1024px)").matches;

      // Reduced motion OR small screens → render the final, fully-lit state.
      if (prefersReducedMotion() || !isDesktop) {
        finalState();
        return;
      }

      const ctx = gsap.context(() => {
        // Horizontal travel = how far the rail overflows one viewport width.
        const distance = () => Math.max(1, rail.scrollWidth - window.innerWidth);

        // Master horizontal tween — scrubbed by the pinned scroll range. The pin
        // length equals the travel distance, so the loop ends exactly on the
        // finale card (no blank tail, no clipped card).
        gsap.to(rail, {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: {
            trigger: pin,
            start: "top top",
            end: () => `+=${distance()}`,
            pin: true,
            scrub: 0.6,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              const idx = Math.round(self.progress * FINALE);
              setActive((prev) => (prev === idx ? prev : idx));
              const inFinale = idx >= FINALE;
              setFinaleIn((prev) => (prev === inFinale ? prev : inFinale));
            },
          },
        });

        // Top progress-bar fill — same range, its own scrub for a buttery feel.
        if (progressRef.current) {
          gsap.fromTo(
            progressRef.current,
            { scaleX: 0 },
            {
              scaleX: 1,
              ease: "none",
              scrollTrigger: {
                trigger: pin,
                start: "top top",
                end: () => `+=${distance()}`,
                scrub: 0.6,
                invalidateOnRefresh: true,
              },
            },
          );
        }

        // Count-up: the grand total rolls 0 → ₹2,000 across the final stretch,
        // i.e. while the finale card is sliding into center.
        if (tallyRef.current) {
          const counter = { v: 0 };
          gsap.to(counter, {
            v: POOL,
            ease: "none",
            scrollTrigger: {
              trigger: pin,
              start: () => `top+=${(distance() * (FINALE - 0.6)) / FINALE} top`,
              end: () => `top+=${distance()} top`,
              scrub: 0.4,
              invalidateOnRefresh: true,
            },
            onUpdate: () => {
              if (tallyRef.current) tallyRef.current.textContent = inr(counter.v);
            },
          });
        }
      }, root);

      // Recompute once fonts / SVG scenes settle so travel distance is accurate.
      ScrollTrigger.refresh();

      return () => ctx.revert();
    },
    { scope: root, dependencies: [] },
  );

  return (
    <section
      ref={root}
      className="relative border-y border-line/60 bg-void/40"
      aria-label="How a GRAVITY tournament works, end to end"
    >
      {/* faint moving grid backplate (radially masked at top) for depth */}
      <div aria-hidden className="gv-grid-bg pointer-events-none absolute inset-0 opacity-70" />

      {/* ===================== DESKTOP: pinned horizontal track (lg+) ========= */}
      <div ref={pinRef} className="relative hidden lg:block">
        <div className="relative flex h-dvh flex-col overflow-hidden">
          {/* drifting crimson core for depth */}
          <div
            aria-hidden
            className="animate-aurora pointer-events-none absolute top-1/4 left-1/4 size-[40rem] rounded-full bg-crimson-600/[0.07] blur-[130px]"
          />

          {/* heading + progress bar — fixed while the rail translates beneath */}
          <div className="relative z-20 mx-auto w-full max-w-7xl px-8 pt-14">
            <SectionHeading
              eyebrow="The core loop"
              title={<>From entry fee to <span className="gv-text-gradient">payout</span></>}
              lead="A real paid tournament, end to end — scroll to walk the loop."
            />
            <div className="mt-8 flex items-center gap-4">
              <div className="relative h-px flex-1 overflow-hidden rounded-full bg-line">
                <span
                  ref={progressRef}
                  aria-hidden
                  className="absolute inset-0 origin-left scale-x-0 bg-linear-to-r from-crimson-500 to-ember-500 shadow-glow"
                />
              </div>
              <div className="flex shrink-0 items-center gap-2" aria-hidden>
                {Array.from({ length: PANELS }).map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "size-2 rounded-full transition-all duration-500",
                      i <= active ? "scale-125 bg-crimson-500 shadow-glow" : "bg-line-strong",
                    )}
                  />
                ))}
              </div>
              <span className="shrink-0 font-mono text-xs tabular-nums text-text-dim">
                {String(Math.min(active + 1, PANELS)).padStart(2, "0")}
                <span className="text-text-dim/50"> / {String(PANELS).padStart(2, "0")}</span>
              </span>
            </div>
          </div>

          {/* the translating rail */}
          <div className="relative z-10 flex flex-1 items-center">
            <div ref={railRef} className="flex h-full items-center gap-8 px-8 will-change-transform">
              {STEPS.map((step, i) => (
                <StepPanel key={step.n} step={step} index={i} active={i <= active} gid={`hiw-${step.n}`} />
              ))}
              <PrizePanel finaleIn={finaleIn} active={active >= FINALE} tallyRef={tallyRef} />
            </div>
          </div>

          {/* scroll affordance */}
          <div className="pointer-events-none absolute right-8 bottom-6 z-20 flex items-center gap-2 font-mono text-[0.65rem] tracking-[0.2em] text-text-dim uppercase">
            <span>Scroll</span>
            <span aria-hidden className="animate-pulse-glow inline-block h-4 w-px bg-crimson-500/70" />
          </div>
        </div>
      </div>

      {/* ===================== MOBILE / reduced-motion: vertical (< lg) ======= */}
      <div className="lg:hidden">
        <div className="mx-auto max-w-2xl px-4 py-24 sm:px-6">
          <SectionHeading
            eyebrow="The core loop"
            title={<>From entry fee to <span className="gv-text-gradient">payout</span></>}
            lead="A real paid tournament, end to end."
          />
          <ol className="mt-12 flex flex-col gap-6">
            {STEPS.map((step, i) => (
              <li key={step.n}>
                <StepPanel step={step} index={i} active gid={`hiw-m-${step.n}`} stacked />
              </li>
            ))}
            <li>
              <PrizePanel finaleIn active tallyRef={tallyRef} stacked />
            </li>
          </ol>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------------
 * One step panel — number + on-theme SVG scene + display type.
 * `group/glow` lets the surface-art scenes run their draw-on / pulse reactions.
 * ------------------------------------------------------------------------- */
function StepPanel({
  step,
  index,
  active,
  gid,
  stacked = false,
}: {
  step: (typeof STEPS)[number];
  index: number;
  active: boolean;
  gid: string;
  stacked?: boolean;
}) {
  const Scene = step.art;
  return (
    <article
      className={cn(
        "group/glow gv-panel gv-card-accent relative flex flex-col overflow-hidden p-8 transition-opacity duration-700",
        stacked ? "w-full" : "h-[clamp(22rem,64vh,34rem)] w-[clamp(20rem,42vw,30rem)] shrink-0",
        active ? "opacity-100" : "opacity-55",
      )}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-crimson-600/10 blur-3xl transition-opacity duration-700",
          active ? "opacity-100" : "opacity-0",
        )}
      />

      <div className="relative z-10 flex items-center gap-4">
        <span
          className={cn(
            "grid size-12 shrink-0 place-items-center rounded-full border font-mono text-sm tabular-nums transition-all duration-500",
            active
              ? "animate-pulse-glow border-crimson-500 bg-crimson-500/15 text-crimson-300"
              : "border-line bg-background text-text-dim",
          )}
        >
          {step.n}
        </span>
        <span className="font-mono text-[0.65rem] tracking-[0.25em] text-text-dim uppercase">
          {index === STEPS.length - 1 ? "Settlement" : `Step ${step.n}`}
        </span>
      </div>

      {/* SVG scene fills the body and reacts to hover (draw-on via group/glow) */}
      <div className={cn("relative z-10 mt-2 w-full", stacked ? "h-44" : "min-h-0 flex-1")}>
        <Scene gid={gid} theme={BRAND} />
      </div>

      <div className="relative z-10 mt-auto pt-4">
        <h3 className="font-display text-2xl leading-tight tracking-tight text-balance sm:text-3xl">
          {step.title}
        </h3>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-text-muted">{step.body}</p>
      </div>
    </article>
  );
}

/* ---------------------------------------------------------------------------
 * Prize finale — canonical ₹2,000 split with count-up total + proportion bars.
 * ------------------------------------------------------------------------- */
function PrizePanel({
  finaleIn,
  active,
  tallyRef,
  stacked = false,
}: {
  finaleIn: boolean;
  active: boolean;
  tallyRef: RefObject<HTMLSpanElement | null>;
  stacked?: boolean;
}) {
  return (
    <article
      className={cn(
        "gv-panel relative flex flex-col overflow-hidden p-8 transition-opacity duration-700",
        stacked ? "w-full" : "h-[clamp(22rem,64vh,34rem)] w-[clamp(22rem,48vw,36rem)] shrink-0",
        active ? "opacity-100" : "opacity-55",
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-20 size-64 rounded-full bg-crimson-600/10 blur-3xl"
      />

      <p className="relative z-10 font-mono text-[0.65rem] tracking-[0.2em] text-text-dim uppercase">
        Canonical split · live validation
      </p>
      <p className="relative z-10 mt-3 font-display text-2xl sm:text-3xl">
        50 players × ₹40 = <span className="gv-text-gradient">₹2,000 pool</span>
      </p>

      <div className="relative z-10 mt-5 flex-1 space-y-1.5 overflow-hidden font-mono text-sm">
        {ROWS.map((r, i) => {
          // Rows light + bars grow once the finale card is on screen.
          const on = finaleIn;
          const pct = (r.value / POOL) * 100;
          return (
            <div
              key={r.label}
              className={cn(
                "relative overflow-hidden rounded-md px-3 py-2 transition-colors duration-500",
                on ? "bg-crimson-500/10 text-foreground" : "text-text-muted",
              )}
            >
              {/* proportion bar grows to this row's share of the pool */}
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 origin-left bg-linear-to-r from-crimson-500/15 to-ember-500/10 transition-transform duration-700 ease-gv"
                style={{
                  width: `${pct}%`,
                  transform: on ? "scaleX(1)" : "scaleX(0)",
                  transitionDelay: `${i * 70}ms`,
                }}
              />
              <span className="relative flex items-center justify-between">
                <span>{r.label}</span>
                <span className="tabular-nums">{inr(r.value)}</span>
              </span>
            </div>
          );
        })}

        <div className="gv-rule my-3" />

        <div className="flex items-center justify-between px-3 text-base">
          <span className="text-foreground">Total</span>
          <span className="font-mono tabular-nums">
            <span ref={tallyRef} className="gv-text-gradient font-semibold">
              {finaleIn ? inr(POOL) : "₹0"}
            </span>{" "}
            <span
              aria-hidden
              className={cn(
                "text-success transition-opacity duration-500",
                finaleIn ? "opacity-100" : "opacity-0",
              )}
            >
              ✓
            </span>
          </span>
        </div>
      </div>

      <p className="relative z-10 mt-4 text-xs text-text-dim">
        The engine refuses to publish unless the split equals the collected pool,
        to the paise.
      </p>
    </article>
  );
}
