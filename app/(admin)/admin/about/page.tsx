import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AboutEditor } from "@/components/gravity/admin/about-editor";

export const metadata: Metadata = { title: "About Editor", robots: { index: false } };

export default async function AdminAboutPage() {
  const supabase = await createSupabaseServerClient();
  const { data: about } = await supabase
    .from("about_pages")
    .select("content_json")
    .eq("slug", "main")
    .maybeSingle();

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl tracking-tight">About page editor</h1>
      <p className="mt-1 text-sm text-text-muted">
        Edit the public About page. Changes go live immediately.
      </p>
      <div className="mt-8">
        <AboutEditor initial={about?.content_json ?? null} />
      </div>
    </div>
  );
}
