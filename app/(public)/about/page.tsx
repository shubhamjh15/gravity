import type { Metadata } from "next";
import Image from "next/image";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { TiptapContent } from "@/lib/tiptap-render";
import { SectionHeading } from "@/components/gravity/section-heading";
import { AuroraBackground } from "@/components/gravity/aurora-background";

export const metadata: Metadata = {
  title: "About",
  description: "About GRAVITY — the arena for Indian esports.",
};

function galleryUrl(path: string): string | null {
  if (!publicEnv.supabaseUrl) return null;
  return `${publicEnv.supabaseUrl}/storage/v1/object/public/community-gallery/${path}`;
}

export default async function AboutPage() {
  const supabase = await createSupabaseServerClient();
  const { data: about } = await supabase
    .from("about_pages")
    .select("content_json, gallery, company_details")
    .eq("slug", "main")
    .maybeSingle();

  const gallery = (about?.gallery ?? []) as { path: string; caption?: string }[];
  const company = (about?.company_details ?? {}) as Record<string, string>;
  const hasContent =
    about?.content_json && Object.keys(about.content_json).length > 0;

  return (
    <div className="relative">
      <section className="relative overflow-hidden pt-32 pb-16">
        <AuroraBackground />
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <SectionHeading
            eyebrow="Our story"
            title={
              <>
                Built for the <span className="gv-text-gradient">grind</span>
              </>
            }
            lead="GRAVITY is the arena for India's grassroots esports — where organizers run tournaments, players win real cash, and communities thrive."
            as="h1"
            align="center"
            className="mx-auto"
          />
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 pb-24 sm:px-6">
        {hasContent ? (
          <article className="prose-invert">
            <TiptapContent doc={about!.content_json} />
          </article>
        ) : (
          <div className="space-y-6 text-text-muted">
            <p className="leading-relaxed">
              There&apos;s no official API for Free Fire or BGMI — so we built
              GRAVITY around how Indian tournaments actually run. Organizers host
              custom rooms, share credentials with paid players, and results come
              from the final leaderboard screenshot. Every rupee — entry fees,
              prizes, memberships, store — flows through one transparent ledger.
            </p>
            <p className="leading-relaxed">
              Whether you&apos;re a player chasing prize pools or an organizer
              building a community, GRAVITY gives you everything in one place.
            </p>
          </div>
        )}

        {/* gallery */}
        {gallery.length > 0 ? (
          <div className="mt-12">
            <h2 className="font-display text-2xl tracking-tight">Gallery</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {gallery.map((g, i) => {
                const url = galleryUrl(g.path);
                if (!url) return null;
                return (
                  <div key={i} className="relative aspect-square overflow-hidden rounded-lg border border-line">
                    <Image src={url} alt={g.caption ?? ""} fill className="object-cover" sizes="300px" unoptimized />
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* company details */}
        {Object.keys(company).length > 0 ? (
          <div className="mt-12 gv-panel p-6">
            <h2 className="font-display text-xl tracking-tight">Company</h2>
            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              {Object.entries(company).map(([k, v]) => (
                <div key={k} className="flex flex-col">
                  <dt className="font-mono text-[10px] tracking-widest text-text-dim uppercase">{k}</dt>
                  <dd className="text-text-muted">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </div>
    </div>
  );
}
