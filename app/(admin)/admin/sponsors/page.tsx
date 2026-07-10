import type { Metadata } from "next";
import { Handshake } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SponsorRequestRow } from "@/components/gravity/admin/sponsor-request-row";

export const metadata: Metadata = { title: "Sponsorships", robots: { index: false } };

export default async function AdminSponsorsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: requests } = await supabase
    .from("sponsorship_requests")
    .select("id, sponsor_name, contact_email, details, status, created_at")
    .order("created_at", { ascending: false });

  const pending = (requests ?? []).filter((r) => r.status === "pending");
  const handled = (requests ?? []).filter((r) => r.status !== "pending");

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-3xl tracking-tight">Sponsorship inbox</h1>
      <p className="mt-1 text-sm text-text-muted">
        Approve requests to publish them to the public sponsors page.
      </p>

      {(requests ?? []).length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-3 rounded-xl border border-dashed border-line py-16 text-center">
          <Handshake className="size-8 text-text-dim" />
          <p className="font-display text-xl">No requests yet</p>
        </div>
      ) : (
        <>
          {pending.length > 0 ? (
            <section className="mt-8">
              <h2 className="font-mono text-xs tracking-widest text-text-dim uppercase">
                Pending ({pending.length})
              </h2>
              <div className="mt-3 flex flex-col gap-3">
                {pending.map((r) => (
                  <SponsorRequestRow
                    key={r.id}
                    id={r.id}
                    name={r.sponsor_name}
                    email={r.contact_email}
                    details={r.details}
                    status={r.status}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {handled.length > 0 ? (
            <section className="mt-10">
              <h2 className="font-mono text-xs tracking-widest text-text-dim uppercase">
                Handled
              </h2>
              <div className="mt-3 flex flex-col gap-3">
                {handled.map((r) => (
                  <SponsorRequestRow
                    key={r.id}
                    id={r.id}
                    name={r.sponsor_name}
                    email={r.contact_email}
                    details={r.details}
                    status={r.status}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
