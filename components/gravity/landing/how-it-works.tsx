"use client";

/**
 * "How a tournament runs" — a pinned, scrubbed sequence that advances through
 * the real prize/results flow as you scroll. The active step lights up; a side
 * panel shows the canonical ₹2000 pool math so the mechanic is concrete.
 */
import { Pin } from "@/components/gravity/scroll/pin";
import { SectionHeading } from "@/components/gravity/section-heading";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    n: "01",
    title: "Players register & pay",
    body: "Entry fees collected via Razorpay. Money settles only on the signed webhook — a slot is reserved the moment payment confirms.",
  },
  {
    n: "02",
    title: "Organizer opens the room",
    body: "A custom in-game room is created. The Room ID + password are revealed only to paid players, and pushed by email & WhatsApp.",
  },
  {
    n: "03",
    title: "The match is played",
    body: "Players drop in and compete. No fragile game API — the room is hosted exactly like every real Indian tournament.",
  },
  {
    n: "04",
    title: "Results from a screenshot",
    body: "The organizer uploads the final leaderboard and enters ranks & kills. The prize engine computes every payout instantly.",
  },
  {
    n: "05",
    title: "Winnings transferred",
    body: "Payouts hit winners' UPI and post to the public results — every rupee written to one immutable ledger.",
  },
] as const;

export function HowItWorks() {
  return (
    <section className="relative border-y border-line/60 bg-void/40">
      <div className="mx-auto max-w-7xl px-4 pt-24 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="The core loop"
          title={
            <>
              From entry fee to{" "}
              <span className="gv-text-gradient">payout</span>
            </>
          }
          lead="Scroll to watch a real paid tournament run end to end."
          align="center"
          className="mx-auto"
        />
      </div>

      <Pin steps={STEPS.length} heightVh={420}>
        {(active) => (
          <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
            {/* steps */}
            <ol className="flex flex-col gap-6">
              {STEPS.map((step, i) => {
                const isActive = i === active;
                const isPast = i < active;
                return (
                  <li
                    key={step.n}
                    className={cn(
                      "flex gap-5 transition-all duration-500",
                      isActive ? "opacity-100" : "opacity-35",
                    )}
                  >
                    <div className="flex flex-col items-center">
                      <span
                        className={cn(
                          "flex size-11 shrink-0 items-center justify-center rounded-full border font-mono text-sm transition-all duration-500",
                          isActive
                            ? "border-crimson-500 bg-crimson-500/15 text-crimson-300 shadow-glow"
                            : isPast
                              ? "border-crimson-700/50 bg-crimson-500/5 text-crimson-400"
                              : "border-line text-text-dim",
                        )}
                      >
                        {step.n}
                      </span>
                      {i < STEPS.length - 1 ? (
                        <span
                          className={cn(
                            "my-1 w-px flex-1 transition-colors duration-500",
                            isPast ? "bg-crimson-700/60" : "bg-line",
                          )}
                        />
                      ) : null}
                    </div>
                    <div className="pb-2">
                      <h3 className="font-display text-2xl tracking-tight">
                        {step.title}
                      </h3>
                      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-text-muted">
                        {step.body}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>

            {/* the canonical math panel */}
            <div className="gv-panel relative hidden overflow-hidden p-8 lg:block">
              <div className="pointer-events-none absolute -top-20 -right-20 size-64 rounded-full bg-crimson-600/10 blur-3xl" />
              <p className="font-mono text-xs tracking-[0.2em] text-text-dim uppercase">
                Canonical split · live validation
              </p>
              <p className="mt-3 font-display text-3xl">
                50 players × ₹40 ={" "}
                <span className="gv-text-gradient">₹2,000 pool</span>
              </p>
              <div className="mt-6 space-y-2.5 font-mono text-sm">
                <Row label="1st place" value="₹700" highlight={active >= 3} />
                <Row label="2nd place" value="₹300" highlight={active >= 3} />
                <Row label="3rd place" value="₹100" highlight={active >= 3} />
                <Row
                  label="Per-kill bounty (cap ₹490)"
                  value="₹490"
                  highlight={active >= 3}
                />
                <Row label="Platform cut" value="₹110" highlight={active >= 4} />
                <Row
                  label="Organizer profit"
                  value="₹300"
                  highlight={active >= 4}
                />
                <div className="gv-rule my-3" />
                <div className="flex items-center justify-between text-base">
                  <span className="text-foreground">Total</span>
                  <span className="gv-text-gradient font-semibold">
                    ₹2,000 ✓
                  </span>
                </div>
              </div>
              <p className="mt-5 text-xs text-text-dim">
                The engine refuses to publish unless the split equals the
                collected pool — to the paise.
              </p>
            </div>
          </div>
        )}
      </Pin>
    </section>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-md px-3 py-2 transition-colors duration-500",
        highlight ? "bg-crimson-500/10 text-foreground" : "text-text-muted",
      )}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
