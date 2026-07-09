import type { Metadata } from "next";
import {
  TrendingUp,
  Users,
  Trophy,
  UsersRound,
  ShoppingBag,
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  Handshake,
} from "lucide-react";
import { getRevenueSummary, getPlatformCounts } from "@/lib/data/admin";
import { formatPaise, paise, type Paise } from "@/lib/money";

export const metadata: Metadata = { title: "Admin Overview", robots: { index: false } };

const CATEGORY_LABELS: Record<string, string> = {
  event_entry: "Tournament entries",
  membership: "Memberships",
  store: "Store",
  sponsorship: "Sponsorships",
  prize: "Prizes",
  platform_fee: "Platform fees",
  organizer_profit: "Organizer profit",
  manual: "Manual",
};

export default async function AdminOverviewPage() {
  const [revenue, counts] = await Promise.all([
    getRevenueSummary(),
    getPlatformCounts(),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="font-display text-3xl tracking-tight">Overview</h1>
      <p className="mt-1 text-sm text-text-muted">
        The whole platform at a glance. All revenue figures are computed from the
        unified ledger.
      </p>

      {/* revenue headline */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <BigStat
          icon={<TrendingUp className="size-5" />}
          label="Gross revenue"
          value={formatPaise(paise(revenue.grossPaise) as Paise, { compactWhole: true })}
          accent
        />
        <BigStat
          icon={<ArrowDownRight className="size-5" />}
          label="Payouts"
          value={formatPaise(paise(revenue.payoutsPaise) as Paise, { compactWhole: true })}
        />
        <BigStat
          icon={<ArrowUpRight className="size-5" />}
          label="Net"
          value={formatPaise(paise(Math.max(0, revenue.netPaise)) as Paise, { compactWhole: true })}
        />
      </div>

      {/* revenue by category */}
      <section className="mt-8">
        <h2 className="font-display text-xl tracking-tight">Revenue by category</h2>
        {revenue.byCategory.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">No revenue recorded yet.</p>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {revenue.byCategory.map((c) => (
              <div key={c.source_type}>
                <div className="flex items-center justify-between text-sm">
                  <span>{CATEGORY_LABELS[c.source_type] ?? c.source_type}</span>
                  <span className="font-mono">
                    {formatPaise(paise(c.amount) as Paise, { compactWhole: true })}{" "}
                    <span className="text-text-dim">({(c.fractionBps / 100).toFixed(1)}%)</span>
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-line">
                  <div
                    className="h-full rounded-full bg-[image:var(--gv-grad-accent)]"
                    style={{ width: `${c.fractionBps / 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* platform counts */}
      <section className="mt-10">
        <h2 className="font-display text-xl tracking-tight">Platform</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <MiniStat icon={<Users className="size-4" />} label="Users" value={counts.users} />
          <MiniStat icon={<Wallet className="size-4" />} label="Organizers" value={counts.organizers} />
          <MiniStat icon={<Trophy className="size-4" />} label="Tournaments" value={counts.events} />
          <MiniStat icon={<UsersRound className="size-4" />} label="Communities" value={counts.communities} />
          <MiniStat icon={<ShoppingBag className="size-4" />} label="Orders" value={counts.orders} />
          <MiniStat icon={<Handshake className="size-4" />} label="Sponsor reqs" value={counts.pendingSponsorships} />
        </div>
      </section>
    </div>
  );
}

function BigStat({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="gv-panel p-5">
      <div className="flex items-center gap-2 text-text-dim">
        {icon}
        <span className="font-mono text-[10px] tracking-widest uppercase">{label}</span>
      </div>
      <p className={`mt-2 font-display text-3xl ${accent ? "gv-text-gradient" : ""}`}>{value}</p>
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="gv-panel flex flex-col gap-1 p-4">
      <span className="flex items-center gap-1.5 text-text-dim">
        {icon}
        <span className="font-mono text-[10px] tracking-widest uppercase">{label}</span>
      </span>
      <span className="font-display text-2xl">{value}</span>
    </div>
  );
}
