import type { Metadata } from "next";
import Link from "next/link";
import {
  Download,
  Wallet,
  TrendingUp,
  Trophy,
  Landmark,
  UsersRound,
  Receipt,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getOrganizerFinance } from "@/lib/data/organizer";
import { formatPaise, paise } from "@/lib/money";
import { SectionHeading } from "@/components/gravity/section-heading";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Finances" };

/**
 * Organizer ledger view (ROADMAP 2.10) + community earning dashboard (3.4).
 *
 * Every row is RLS-scoped to what this organizer owns — their events and their
 * communities. There is no organizer-id parameter anywhere in this page or its
 * export route; the database decides visibility.
 */

const SOURCE_LABELS: Record<string, string> = {
  event_entry: "Tournament entry",
  membership: "Membership",
  sponsorship: "Sponsorship",
  store: "Store",
  prize: "Prize payout",
  platform_fee: "Platform fee",
  organizer_profit: "Your profit",
  manual: "Manual",
};

export default async function FinancePage() {
  await requireUser("/dashboard/finance");
  const finance = await getOrganizerFinance();

  const monthLabel = (ym: string) =>
    new Date(`${ym}-01T00:00:00Z`).toLocaleDateString("en-IN", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });

  const peakMonthGross = Math.max(
    1,
    ...finance.byMonth.map((m) => m.grossPaise),
  );

  return (
    <div className="mx-auto max-w-5xl px-4 pt-24 pb-24 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading
          eyebrow="Organizer"
          title="Finances"
          lead="Everything your tournaments and communities have earned."
          as="h1"
        />
        <Button asChild variant="outline">
          {/* A route handler, not a Link-navigable page — plain anchor. */}
          <a href="/dashboard/finance/export" download>
            <Download className="size-4" />
            Export CSV
          </a>
        </Button>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label="Collected"
          value={formatPaise(paise(finance.grossPaise), { compactWhole: true })}
          Icon={TrendingUp}
          hint="Entry fees + memberships"
        />
        <Tile
          label="Your profit"
          value={formatPaise(paise(finance.profitPaise), { compactWhole: true })}
          Icon={Wallet}
          hint="Recorded when results publish"
          accent
        />
        <Tile
          label="Prizes paid"
          value={formatPaise(paise(finance.prizesPaise), { compactWhole: true })}
          Icon={Trophy}
          hint="Transferred to winners"
        />
        <Tile
          label="Platform fee"
          value={formatPaise(paise(finance.platformFeePaise), { compactWhole: true })}
          Icon={Landmark}
          hint="GRAVITY's cut"
        />
      </div>

      {finance.membershipPaise > 0 ? (
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-line bg-surface/40 px-4 py-3">
          <UsersRound className="size-4 text-crimson-400" />
          <p className="text-sm text-text-muted">
            Community memberships contributed{" "}
            <span className="font-mono font-semibold text-foreground">
              {formatPaise(paise(finance.membershipPaise), { compactWhole: true })}
            </span>{" "}
            of the collected total.
          </p>
        </div>
      ) : null}

      {/* Monthly trend — a bar per month, sized against the best month. */}
      {finance.byMonth.length > 0 ? (
        <section className="mt-12">
          <h2 className="font-mono text-xs tracking-widest text-text-dim uppercase">
            Monthly
          </h2>
          <div className="mt-4 flex flex-col gap-2">
            {finance.byMonth.map((m) => (
              <div key={m.month} className="flex items-center gap-3">
                <span className="w-20 shrink-0 font-mono text-xs text-text-muted">
                  {monthLabel(m.month)}
                </span>
                <div className="h-6 flex-1 overflow-hidden rounded-md bg-surface-2">
                  <div
                    className="h-full rounded-md [background-image:var(--gv-grad-accent)]"
                    style={{
                      width: `${Math.max(2, Math.round((m.grossPaise / peakMonthGross) * 100))}%`,
                    }}
                  />
                </div>
                <span className="w-24 shrink-0 text-right font-mono text-xs">
                  {formatPaise(paise(m.grossPaise), { compactWhole: true })}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-12">
        <h2 className="font-mono text-xs tracking-widest text-text-dim uppercase">
          Transactions
        </h2>

        {finance.transactions.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-line py-16 text-center">
            <Receipt className="mx-auto size-8 text-text-dim" />
            <p className="mt-3 font-display text-xl">No transactions yet</p>
            <p className="mt-1 text-sm text-text-muted">
              Once players pay to enter one of your tournaments, every rupee
              appears here.
            </p>
            <Button asChild variant="gradient" className="mt-5">
              <Link href={"/dashboard/create" as never}>Create a tournament</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[38rem] text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="px-4 py-2.5 font-mono text-[10px] tracking-widest text-text-dim uppercase">
                    Date
                  </th>
                  <th className="px-4 py-2.5 font-mono text-[10px] tracking-widest text-text-dim uppercase">
                    Category
                  </th>
                  <th className="px-4 py-2.5 font-mono text-[10px] tracking-widest text-text-dim uppercase">
                    Status
                  </th>
                  <th className="px-4 py-2.5 text-right font-mono text-[10px] tracking-widest text-text-dim uppercase">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {finance.transactions.map((t) => (
                  <tr key={t.id} className="border-b border-line/50 last:border-0">
                    <td className="px-4 py-3 font-mono text-xs text-text-muted">
                      {new Date(t.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      {SOURCE_LABELS[t.source_type] ?? t.source_type}
                      {t.direction === "internal" ? (
                        <span className="ml-2 rounded-full border border-line px-1.5 py-0.5 text-[10px] text-text-dim">
                          split
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-text-muted capitalize">
                      {t.status}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatPaise(paise(Number(t.amount_paise)))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Tile({
  label,
  value,
  Icon,
  hint,
  accent,
}: {
  label: string;
  value: string;
  Icon: typeof Wallet;
  hint: string;
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
            ? "gv-text-gradient mt-3 font-display text-2xl"
            : "mt-3 font-display text-2xl"
        }
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-text-dim">{hint}</p>
    </div>
  );
}
