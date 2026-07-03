import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAuthContext } from "@/lib/auth";
import { SectionHeading } from "@/components/gravity/section-heading";
import { CommunityCreateForm } from "@/components/gravity/community/community-create-form";

export const metadata: Metadata = { title: "Create Community" };

export default async function CreateCommunityPage() {
  const { user, isOrganizer, isSuperadmin } = await getAuthContext();
  if (!user) redirect("/login?next=/communities/create");
  if (!isOrganizer && !isSuperadmin) redirect("/communities");

  return (
    <div className="mx-auto max-w-3xl px-4 pt-24 pb-24 sm:px-6 lg:px-8">
      <Link
        href={"/communities" as never}
        className="inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-crimson-300"
      >
        <ArrowLeft className="size-4" /> Back to communities
      </Link>
      <div className="mt-4">
        <SectionHeading
          eyebrow="New community"
          title="Build your community"
          lead="Create a hub for your players — host tournaments, chat, and grow your following."
          as="h1"
        />
      </div>
      <div className="mt-8">
        <CommunityCreateForm />
      </div>
    </div>
  );
}
