import type { Metadata } from "next";
import Link from "next/link";
import { Plus, LayoutDashboard, Wallet, Trophy, Users } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { formatPaise, paise } from "@/lib/money";
import { SectionHeading } from "@/components/gravity/section-heading";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Organizer Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser("/dashboard");
  const supabase = await createSupabaseServerClient();

  const [eventsRes, earningsRes] = await Promise.all([
    supabase
      .from("events")
      .select("id, slug, title, status, entry_fee_paise, max_slots, starts_at")
      .eq("organizer_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("ledger_entries")
      .select("amount_paise, source_type, direction")
      .eq("organizer_id", user.id)
      .in("status", ["captured", "settled"]),
  ]);

  const events = eventsRes.data ?? [];

  // Organizer profit from the ledger.
  const profit = (earningsRes.data ?? [])
    .filter((r) => r.source_type === "organizer_profit" && r.direction === "in")
    .reduce((s, r) => s + Number(r.amount_paise ?? 0), 0);

  const liveCount = events.filter((e) =>
    ["upcoming", "ongoing"].includes(e.status),
  ).length;

  return (
    <div className="mx-auto max-w-7xl px-4 pt-24 pb-24 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading
          eyebrow="Organizer"
          title="Your dashboard"
          lead="Create tournaments, manage registrations, publish results and pay winners."
          as="h1"
        />
        <Button asChild variant="gradient" size="lg">
          <Link href={"/dashboard/create" as never}>
            <Plus className="size-4" /> New tournament
          </Link>
        </Button>
      </div>

      {/* stats */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <DashStat icon={<Trophy className="size-4" />} label="Tournaments" value={String(events.length)} />
        <DashStat icon={<Users className="size-4" />} label="Live now" value={String(liveCount)} />
        <DashStat
          icon={<Wallet className="size-4" />}
          label="Profit"
          value={formatPaise(paise(Math.max(0, profit)), { compactWhole: true })}
        />
      </div>

      {/* events */}
      <h2 className="mt-12 flex items-center gap-2 font-display text-2xl tracking-tight">
        <LayoutDashboard className="size-5 text-crimson-400" />
        Your tournaments
      </h2>

      {events.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-line py-16 text-center">
          <p className="font-display text-xl">No tournaments yet</p>
          <p className="mt-1 text-sm text-text-muted">
            Create your first tournament and start collecting registrations.
          </p>
          <Button asChild variant="gradient" className="mt-5">
            <Link href={"/dashboard/create" as never}>
              <Plus className="size-4" /> Create tournament
            </Link>
          </Button>
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-lg border border-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2/60 text-left font-mono text-[10px] tracking-widest text-text-dim uppercase">
                <th className="px-4 py-3">Tournament</th>
                <th className="px-4 py-3">Status</th>
                <th className="hidden px-4 py-3 sm:table-cell">Entry</th>
                <th className="px-4 py-3 text-right">Manage</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-b border-line/50 last:border-0">
                  <td className="px-4 py-3 font-medium">
                    <Link
                      href={`/events/${e.slug}` as never}
                      className="hover:text-crimson-300"
                    >
                      {e.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-line px-2 py-0.5 text-[11px] capitalize">
                      {e.status}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 font-mono sm:table-cell">
                    {Number(e.entry_fee_paise) === 0
                      ? "Free"
                      : formatPaise(paise(Number(e.entry_fee_paise)), { compactWhole: true })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/dashboard/manage/${e.id}` as never}>Manage</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DashStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="gv-panel flex items-center gap-3 p-4">
      <span className="grid size-10 place-items-center rounded-md border border-crimson-700/40 bg-crimson-500/10 text-crimson-300">
        {icon}
      </span>
      <div>
        <p className="font-mono text-[10px] tracking-widest text-text-dim uppercase">{label}</p>
        <p className="font-display text-xl">{value}</p>
      </div>
    </div>
  );
}
