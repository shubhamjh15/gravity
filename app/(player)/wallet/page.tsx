import type { Metadata } from "next";
import Link from "next/link";
import {
  Wallet as WalletIcon,
  ArrowDownLeft,
  ArrowUpRight,
  Hourglass,
  TriangleAlert,
  Receipt,
} from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { formatPaise, paise } from "@/lib/money";
import { SectionHeading } from "@/components/gravity/section-heading";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Wallet" };

/**
 * The player's wallet (ROADMAP §2 folder plan) — previously missing.
 *
 * GRAVITY has no stored-value balance: prize money goes straight to the
 * winner's UPI. So "wallet" here means an honest statement — lifetime earnings,
 * what is still queued for transfer, what has been spent on entry fees and
 * orders, and the full ledger history.
 *
 * Every figure is read from ledger_entries, the single source for every rupee
 * (#3). Nothing is recomputed from a parallel tally.
 */

const SOURCE_LABELS: Record<string, string> = {
  event_entry: "Tournament entry",
  membership: "Community membership",
  sponsorship: "Sponsorship",
  store: "Store purchase",
  prize: "Prize winnings",
  platform_fee: "Platform fee",
  organizer_profit: "Organizer profit",
  manual: "Manual adjustment",
};

export default async function WalletPage() {
  const user = await requireUser("/wallet");
  const supabase = await createSupabaseServerClient();

  const [ledgerRes, payoutsRes, privateRes] = await Promise.all([
    // RLS restricts this to the caller's own rows.
    supabase
      .from("ledger_entries")
      .select(
        "id, entry_type, source_type, direction, amount_paise, status, created_at, meta",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("payouts")
      .select("id, amount_paise, status, created_at")
      .eq("user_id", user.id)
      .eq("status", "pending"),
    supabase
      .from("profiles_private")
      .select("upi_id")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const entries = ledgerRes.data ?? [];
  const settled = entries.filter((e) =>
    ["captured", "settled"].includes(e.status),
  );

  // Earned = settled prize payouts to this player.
  const earnedPaise = settled
    .filter((e) => e.entry_type === "payout" && e.source_type === "prize")
    .reduce((sum, e) => sum + Number(e.amount_paise), 0);

  // Spent = money this player put in (entries, memberships, store).
  const spentPaise = settled
    .filter((e) => e.direction === "in" && e.entry_type === "charge")
    .reduce((sum, e) => sum + Number(e.amount_paise), 0);

  // Queued = prizes won but not yet transferred (payouts still pending).
  const pendingPaise = (payoutsRes.data ?? []).reduce(
    (sum, p) => sum + Number(p.amount_paise),
    0,
  );

  const hasUpi = Boolean(privateRes.data?.upi_id);

  return (
    <div className="mx-auto max-w-4xl px-4 pt-24 pb-24 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="Your money"
        title="Wallet"
        lead="Winnings, spending and every transaction on your account."
        as="h1"
      />

      {/* Prizes settle to UPI directly — without one, a payout can't be sent. */}
      {!hasUpi && (pendingPaise > 0 || earnedPaise > 0) ? (
        <div
          role="alert"
          className="mt-8 flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
          <div className="flex-1">
            <p className="text-sm font-medium">Add your UPI ID to get paid</p>
            <p className="mt-0.5 text-sm text-text-muted">
              Winnings are transferred to your UPI. We can&apos;t send a payout
              without it.
            </p>
          </div>
          <Button asChild size="sm" variant="glow">
            <Link href={"/profile" as never}>Add UPI</Link>
          </Button>
        </div>
      ) : null}

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Total won"
          value={formatPaise(paise(earnedPaise), { compactWhole: true })}
          Icon={ArrowDownLeft}
          accent
        />
        <StatTile
          label="Awaiting transfer"
          value={formatPaise(paise(pendingPaise), { compactWhole: true })}
          Icon={Hourglass}
        />
        <StatTile
          label="Total spent"
          value={formatPaise(paise(spentPaise), { compactWhole: true })}
          Icon={ArrowUpRight}
        />
      </div>

      <section className="mt-12">
        <h2 className="font-mono text-xs tracking-widest text-text-dim uppercase">
          Transactions
        </h2>

        {entries.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-line py-16 text-center">
            <WalletIcon className="mx-auto size-8 text-text-dim" />
            <p className="mt-3 font-display text-xl">No transactions yet</p>
            <p className="mt-1 text-sm text-text-muted">
              Join a tournament and your entry, and any winnings, appear here.
            </p>
            <Button asChild variant="gradient" className="mt-5">
              <Link href={"/events" as never}>Browse tournaments</Link>
            </Button>
          </div>
        ) : (
          <ul className="mt-4 overflow-hidden rounded-lg border border-line">
            {entries.map((e) => {
              // Direction is written from the PLATFORM's point of view: a prize
              // payout is 'out' for the platform but money IN for the player.
              // Flip it here so the player's statement reads correctly.
              const incoming = e.entry_type === "payout" || e.entry_type === "refund";
              const label = SOURCE_LABELS[e.source_type] ?? e.source_type;
              const settledRow = ["captured", "settled"].includes(e.status);

              return (
                <li
                  key={e.id}
                  className="flex items-center gap-4 border-b border-line/50 px-4 py-3.5 last:border-0"
                >
                  <div
                    className={
                      incoming
                        ? "grid size-9 shrink-0 place-items-center rounded-full border border-success/40 bg-success/10 text-success"
                        : "grid size-9 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-text-muted"
                    }
                  >
                    {incoming ? (
                      <ArrowDownLeft className="size-4" />
                    ) : (
                      <ArrowUpRight className="size-4" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{label}</p>
                    <p className="font-mono text-[11px] text-text-dim">
                      {new Date(e.created_at).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {!settledRow ? ` · ${e.status}` : ""}
                    </p>
                  </div>

                  <span
                    className={
                      incoming
                        ? "font-mono text-sm font-semibold text-success"
                        : "font-mono text-sm text-text-muted"
                    }
                  >
                    {incoming ? "+" : "−"}
                    {formatPaise(paise(Number(e.amount_paise)))}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {entries.length >= 100 ? (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-text-dim">
            <Receipt className="size-3" />
            Showing your 100 most recent transactions.
          </p>
        ) : null}
      </section>
    </div>
  );
}

function StatTile({
  label,
  value,
  Icon,
  accent,
}: {
  label: string;
  value: string;
  Icon: typeof WalletIcon;
  accent?: boolean;
}) {
  return (
    <div className="gv-panel p-5">
      <div className="flex items-center gap-2">
        <Icon className={accent ? "size-4 text-crimson-400" : "size-4 text-text-dim"} />
        <p className="font-mono text-[10px] tracking-widest text-text-dim uppercase">
          {label}
        </p>
      </div>
      <p
        className={
          accent
            ? "gv-text-gradient mt-3 font-display text-3xl"
            : "mt-3 font-display text-3xl"
        }
      >
        {value}
      </p>
    </div>
  );
}
