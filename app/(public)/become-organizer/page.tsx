import type { Metadata } from "next";
import Link from "next/link";
import { Trophy, Wallet, Users, ShieldCheck } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import { SectionHeading } from "@/components/gravity/section-heading";
import {
  OrganizerApplicationForm,
  type MyApplication,
} from "@/components/gravity/organizer/organizer-application-form";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Become an Organizer",
  description:
    "Run your own tournaments on GRAVITY — collect entry fees, publish results and pay winners.",
};

/**
 * The organizer application (ROADMAP acceptance: "register + become verified").
 *
 * This route used to not exist: the footer's "Become an organizer" link pointed
 * at /login, which bounces a signed-in user to their profile — a dead end with
 * no way to even express interest.
 *
 * Signed-out visitors still see the pitch (it's a marketing page too) with a
 * login CTA that returns them here afterwards.
 */
const PERKS = [
  {
    Icon: Trophy,
    title: "Run real tournaments",
    body: "Custom rules, dynamic registration fields, room credentials released only to players who paid.",
  },
  {
    Icon: Wallet,
    title: "Keep your cut",
    body: "Set rank prizes, per-kill bounties and your own profit. The engine validates the split to the paise before anything publishes.",
  },
  {
    Icon: Users,
    title: "Build a community",
    body: "Your own space with chat, memberships, an elite tier and a monthly earnings dashboard.",
  },
];

export default async function BecomeOrganizerPage() {
  const { user, isOrganizer } = await getAuthContext();

  let application: MyApplication = null;
  if (user) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("organizer_applications")
      .select("id, status, org_name, review_note")
      .eq("user_id", user.id)
      .maybeSingle();
    application = (data as MyApplication) ?? null;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pt-24 pb-24 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="Host on GRAVITY"
        title="Become an organizer"
        lead="Run paid tournaments for your community — we handle the money, the room credentials and the payouts."
        as="h1"
      />

      <div className="mt-12 grid gap-10 lg:grid-cols-[1.1fr_1fr]">
        <section className="flex flex-col gap-4">
          {PERKS.map(({ Icon, title, body }) => (
            <div
              key={title}
              className="flex gap-4 rounded-xl border border-line bg-surface/40 p-5"
            >
              <Icon className="mt-0.5 size-5 shrink-0 text-crimson-400" />
              <div>
                <h3 className="font-display text-lg">{title}</h3>
                <p className="mt-1 text-sm text-text-muted">{body}</p>
              </div>
            </div>
          ))}

          <div className="flex gap-3 rounded-xl border border-line/70 bg-void/40 p-5">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-text-dim" />
            <div>
              <h3 className="font-display text-lg">Why we review</h3>
              <p className="mt-1 text-sm text-text-muted">
                Organizers collect real entry fees from real players. Every
                application is read by a human before the role is granted, and
                every prize split is validated against the pool that was actually
                collected.
              </p>
            </div>
          </div>
        </section>

        <section className="gv-panel h-fit p-6 sm:p-8">
          {user ? (
            <OrganizerApplicationForm
              application={application}
              alreadyOrganizer={isOrganizer}
            />
          ) : (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <h2 className="font-display text-xl">Log in to apply</h2>
              <p className="text-sm text-text-muted">
                You need an account first — it takes a few seconds, and we&apos;ll
                bring you straight back here.
              </p>
              <Button asChild variant="gradient" size="xl" className="w-full">
                <Link href={"/login?next=/become-organizer" as never}>
                  Log in or sign up
                </Link>
              </Button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
