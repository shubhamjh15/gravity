import type { Metadata } from "next";
import Link from "next/link";
import { Swords, Calendar } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { formatPaise, paise } from "@/lib/money";
import { SectionHeading } from "@/components/gravity/section-heading";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "My Tournaments" };

const STATUS_STYLE: Record<string, string> = {
  confirmed: "border-success/40 bg-success/10 text-success",
  paid: "border-success/40 bg-success/10 text-success",
  slot_held: "border-warning/40 bg-warning/10 text-warning",
  waitlisted: "border-info/40 bg-info/10 text-info",
  cancelled: "border-line text-text-dim",
  refunded: "border-line text-text-dim",
  rejected: "border-danger/40 bg-danger/10 text-danger",
};

export default async function MyTournamentsPage() {
  const user = await requireUser("/my-tournaments");
  const supabase = await createSupabaseServerClient();

  const { data: regs } = await supabase
    .from("registrations")
    .select("id, event_id, status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const eventIds = (regs ?? []).map((r) => r.event_id);
  const { data: events } = eventIds.length
    ? await supabase
        .from("public_events")
        .select("id, slug, title, status, entry_fee_paise, starts_at, game_id")
        .in("id", eventIds)
    : { data: [] };

  // earnings from prizes
  const { data: earnings } = await supabase
    .from("event_results")
    .select("event_id, amount_paid_paise, rank")
    .eq("user_id", user.id)
    .eq("status", "published");

  const eventFor = (id: string) => events?.find((e) => e.id === id);
  const resultFor = (id: string) => earnings?.find((e) => e.event_id === id);

  return (
    <div className="mx-auto max-w-5xl px-4 pt-24 pb-24 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="Your history"
        title="My tournaments"
        lead="Every tournament you've joined, with your placement and winnings."
        as="h1"
      />

      {(regs ?? []).length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-line py-16 text-center">
          <Swords className="mx-auto size-8 text-text-dim" />
          <p className="mt-3 font-display text-xl">No tournaments yet</p>
          <p className="mt-1 text-sm text-text-muted">
            Jump into your first tournament and start competing.
          </p>
          <Button asChild variant="gradient" className="mt-5">
            <Link href={"/events" as never}>Browse tournaments</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-3">
          {(regs ?? []).map((r) => {
            const ev = eventFor(r.event_id);
            const result = resultFor(r.event_id);
            if (!ev) return null;
            return (
              <Link
                key={r.id}
                href={`/events/${ev.slug}` as never}
                className="gv-card-accent flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-display text-lg">{ev.title}</p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-text-muted">
                    {ev.starts_at ? (
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3" />
                        {new Date(ev.starts_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    ) : null}
                    <span className="font-mono">
                      {Number(ev.entry_fee_paise) === 0
                        ? "Free"
                        : formatPaise(paise(Number(ev.entry_fee_paise)), { compactWhole: true })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {result ? (
                    <div className="text-right">
                      {result.rank ? (
                        <p className="font-display text-sm">#{result.rank}</p>
                      ) : null}
                      {Number(result.amount_paid_paise) > 0 ? (
                        <p className="gv-text-gradient font-mono text-sm font-semibold">
                          +{formatPaise(paise(Number(result.amount_paid_paise)))}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize ${STATUS_STYLE[r.status] ?? STATUS_STYLE.cancelled}`}
                  >
                    {r.status.replace("_", " ")}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
