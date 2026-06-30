import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { SectionHeading } from "@/components/gravity/section-heading";
import { EventCreateForm } from "@/components/gravity/organizer/event-create-form";

export const metadata: Metadata = { title: "Create Tournament" };

export default async function CreateEventPage() {
  await requireUser("/dashboard/create");
  const supabase = await createSupabaseServerClient();
  const { data: games } = await supabase
    .from("games")
    .select("id, name")
    .eq("is_active", true)
    .order("sort_order");

  return (
    <div className="mx-auto max-w-4xl px-4 pt-24 pb-24 sm:px-6 lg:px-8">
      <Link
        href={"/dashboard" as never}
        className="inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-crimson-300"
      >
        <ArrowLeft className="size-4" /> Back to dashboard
      </Link>

      <div className="mt-4">
        <SectionHeading
          eyebrow="New tournament"
          title="Create a tournament"
          lead="Configure the basics and prize structure. The pool must balance before you can publish a paid tournament."
          as="h1"
        />
      </div>

      <div className="mt-8">
        <EventCreateForm games={games ?? []} />
      </div>
    </div>
  );
}
