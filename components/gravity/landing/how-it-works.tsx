"use client";

/**
 * "From entry fee to payout" — the core loop, as a GSAP ScrollTrigger scrubbed
 * timeline. A vertical progress line fills as you scroll the section; each step
 * lights up when the line reaches it. No fragile pinning / no giant empty
 * section — the effect is scrubbed to the section's own scroll range and always
 * leaves the content readable. The canonical ₹2000 math panel sits sticky
 * alongside on desktop.
 */
import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, ScrollTrigger, prefersReducedMotion } from "@/components/gravity/scroll/gsap";
import { SectionHeading } from "@/components/gravity/section-heading";
import { cn } from "@/lib/utils";

const STEPS = [
  { n: "01", title: "Players register & pay", body: "Entry fees collected via Razorpay. Money settles only on the signed webhook, and a slot is reserved the moment payment confirms." },
  { n: "02", title: "Organizer opens the room", body: "A custom in-game room is created. The Room ID and password are revealed only to paid players, and pushed by email and WhatsApp." },
  { n: "03", title: "The match is played", body: "Players drop in and compete. No fragile game API, the room is hosted exactly like every real Indian tournament." },
  { n: "04", title: "Results from a screenshot", body: "The organizer uploads the final leaderboard and enters ranks and kills. The prize engine computes every payout instantly." },
  { n: "05", title: "Winnings transferred", body: "Payouts hit winners' UPI and post to the public results, every rupee written to one immutable ledger." },
] as const;

const ROWS = [
  { label: "1st place", value: "₹700", step: 4 },
  { label: "2nd place", value: "₹300", step: 4 },
  { label: "3rd place", value: "₹100", step: 4 },
  { label: "Per-kill bounty (cap ₹490)", value: "₹490", step: 4 },
  { label: "Platform cut", value: "₹110", step: 5 },
  { label: "Organizer profit", value: "₹300", step: 5 },
] as const;

export function HowItWorks() {
  const root = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(1);

  useGSAP(
    () => {
      if (!root.current || !lineRef.current) return;

      if (prefersReducedMotion()) {
        gsap.set(lineRef.current, { scaleY: 1 });
        setActive(STEPS.length);
        return;
      }

      // Fill the progress line as the steps column scrolls through center.
      gsap.fromTo(
        lineRef.current,
        { scaleY: 0 },
        {
          scaleY: 1,
          ease: "none",
          scrollTrigger: {
            trigger: "[data-steps]",
            start: "top 70%",
            end: "bottom 70%",
            scrub: 0.5,
            onUpdate: (self) => {
              const idx = Math.min(STEPS.length, Math.ceil(self.progress * STEPS.length) || 1);
              setActive((prev) => (prev === idx ? prev : idx));
            },
          },
        },
      );

      ScrollTrigger.refresh();
    },
    { scope: root },
  );

  return (
    <section ref={root} className="relative border-y border-line/60 bg-void/40 py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="The core loop"
          title={<>From entry fee to <span className="gv-text-gradient">payout</span></>}
          lead="A real paid tournament, end to end."
          align="center"
          className="mx-auto"
        />

        <div className="mt-16 grid gap-12 lg:grid-cols-2">
          {/* steps with scrubbed progress line */}
          <ol data-steps className="relative flex flex-col gap-10 pl-2">
            {/* track + fill */}
            <span aria-hidden className="absolute top-2 bottom-2 left-[21px] w-px bg-line" />
            <span
              ref={lineRef}
              aria-hidden
              className="absolute top-2 bottom-2 left-[21px] w-px origin-top bg-linear-to-b from-crimson-500 to-ember-500"
            />

            {STEPS.map((step, i) => {
              const isActive = i < active;
              return (
                <li key={step.n} className="relative flex gap-5">
                  <span
                    className={cn(
                      "relative z-10 grid size-11 shrink-0 place-items-center rounded-full border font-mono text-sm transition-all duration-500",
                      isActive
                        ? "border-crimson-500 bg-crimson-500/15 text-crimson-300 shadow-glow"
                        : "border-line bg-background text-text-dim",
                    )}
                  >
                    {step.n}
                  </span>
                  <div
                    className={cn(
                      "pb-1 transition-opacity duration-500",
                      isActive ? "opacity-100" : "opacity-45",
                    )}
                  >
                    <h3 className="font-display text-2xl tracking-tight">{step.title}</h3>
                    <p className="mt-1.5 max-w-md text-sm leading-relaxed text-text-muted">
                      {step.body}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>

          {/* canonical math panel (sticky on desktop) */}
          <div className="lg:sticky lg:top-28 lg:h-fit">
            <div className="gv-panel relative overflow-hidden p-8">
              <div className="pointer-events-none absolute -top-20 -right-20 size-64 rounded-full bg-crimson-600/10 blur-3xl" />
              <p className="font-mono text-xs tracking-[0.2em] text-text-dim uppercase">
                Canonical split · live validation
              </p>
              <p className="mt-3 font-display text-3xl">
                50 players × ₹40 = <span className="gv-text-gradient">₹2,000 pool</span>
              </p>
              <div className="mt-6 space-y-2 font-mono text-sm">
                {ROWS.map((r) => (
                  <div
                    key={r.label}
                    className={cn(
                      "flex items-center justify-between rounded-md px-3 py-2 transition-colors duration-500",
                      active >= r.step ? "bg-crimson-500/10 text-foreground" : "text-text-muted",
                    )}
                  >
                    <span>{r.label}</span>
                    <span className="tabular-nums">{r.value}</span>
                  </div>
                ))}
                <div className="gv-rule my-3" />
                <div className="flex items-center justify-between px-3 text-base">
                  <span className="text-foreground">Total</span>
                  <span className="gv-text-gradient font-semibold">₹2,000 ✓</span>
                </div>
              </div>
              <p className="mt-5 text-xs text-text-dim">
                The engine refuses to publish unless the split equals the
                collected pool, to the paise.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
