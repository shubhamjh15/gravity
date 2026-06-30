import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { formatPaise, paise } from "@/lib/money";
import { RoomSetter } from "@/components/gravity/organizer/room-setter";
import { ResultsUploader } from "@/components/gravity/organizer/results-uploader";
import { PayoutsWorklist } from "@/components/gravity/organizer/payouts-worklist";

export const metadata: Metadata = { title: "Manage Tournament" };

export default async function ManageEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(`/dashboard/manage/${id}`);
  const supabase = await createSupabaseServerClient();

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .single();

  if (!event) notFound();
  if (event.organizer_id !== user.id) redirect("/dashboard");

  // Registrations (organizer can read own event's by RLS) + participant names.
  const { data: regs } = await supabase
    .from("registrations")
    .select("id, user_id, status, created_at")
    .eq("event_id", id)
    .order("created_at", { ascending: true });

  const userIds = (regs ?? []).map((r) => r.user_id);
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", userIds)
    : { data: [] };
  const nameFor = (uid: string) =>
    profiles?.find((p) => p.id === uid)?.display_name ?? "Player";

  const paidParticipants = (regs ?? [])
    .filter((r) => ["paid", "confirmed"].includes(r.status))
    .map((r) => ({ user_id: r.user_id, name: nameFor(r.user_id) }));

  // Existing results?
  const { count: resultCount } = await supabase
    .from("event_results")
    .select("id", { count: "exact", head: true })
    .eq("event_id", id);

  // Payouts.
  const { data: payouts } = await supabase
    .from("payouts")
    .select("id, user_id, amount_paise, status, utr")
    .eq("event_id", id)
    .order("amount_paise", { ascending: false });
  const payoutRows = (payouts ?? []).map((p) => ({
    id: p.id,
    name: nameFor(p.user_id),
    amount_paise: Number(p.amount_paise),
    status: p.status,
    utr: p.utr,
  }));

  return (
    <div className="mx-auto max-w-5xl px-4 pt-24 pb-24 sm:px-6 lg:px-8">
      <Link
        href={"/dashboard" as never}
        className="inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-crimson-300"
      >
        <ArrowLeft className="size-4" /> Back to dashboard
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl tracking-tight">{event.title}</h1>
          <p className="mt-1 text-sm text-text-muted">
            <span className="capitalize">{event.status}</span> ·{" "}
            {Number(event.entry_fee_paise) === 0
              ? "Free"
              : formatPaise(paise(Number(event.entry_fee_paise)), { compactWhole: true })}{" "}
            entry · {paidParticipants.length}/{event.max_slots} confirmed
          </p>
        </div>
        <Link
          href={`/events/${event.slug}` as never}
          className="text-sm text-crimson-300 hover:underline"
        >
          View public page →
        </Link>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <RoomSetter
          eventId={event.id}
          initialRoomId={event.room_id}
          released={Boolean(event.room_released_at)}
        />

        {/* registrations summary */}
        <div className="gv-panel p-5">
          <div className="flex items-center gap-2 font-display text-lg">
            <Users className="size-5 text-crimson-400" />
            Registrations ({regs?.length ?? 0})
          </div>
          <div className="mt-3 max-h-56 overflow-y-auto">
            {(regs ?? []).length === 0 ? (
              <p className="text-sm text-text-muted">No registrations yet.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {(regs ?? []).map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between rounded-md border border-line bg-surface-2/40 px-3 py-2 text-sm"
                  >
                    <span>{nameFor(r.user_id)}</span>
                    <span className="rounded-full border border-line px-2 py-0.5 text-[11px] capitalize text-text-muted">
                      {r.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <ResultsUploader
          eventId={event.id}
          organizerId={user.id}
          participants={paidParticipants}
          hasResults={(resultCount ?? 0) > 0}
        />
      </div>

      <div className="mt-6">
        <PayoutsWorklist payouts={payoutRows} />
      </div>
    </div>
  );
}
