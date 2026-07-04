import type { Metadata } from "next";
import Image from "next/image";
import { Handshake } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { SectionHeading } from "@/components/gravity/section-heading";
import { SponsorRequestForm } from "@/components/gravity/sponsors/sponsor-request-form";
import { GlowCard } from "@/components/gravity/glow-card";

export const metadata: Metadata = {
  title: "Sponsors",
  description: "Our partners, and how to sponsor GRAVITY tournaments.",
};

function logoUrl(path: string | null): string | null {
  if (!path || !publicEnv.supabaseUrl) return null;
  return `${publicEnv.supabaseUrl}/storage/v1/object/public/store-images/${path}`;
}

export default async function SponsorsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: sponsors } = await supabase
    .from("sponsors")
    .select("id, name, logo_path, website, details")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-6xl px-4 pt-24 pb-24 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="Partners"
        title={
          <>
            Our <span className="gv-text-gradient">sponsors</span>
          </>
        }
        lead="The brands powering India's grassroots esports. Want to join them?"
        as="h1"
        align="center"
        className="mx-auto"
      />

      {sponsors && sponsors.length > 0 ? (
        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {sponsors.map((s) => {
            const logo = logoUrl(s.logo_path);
            return (
              <GlowCard key={s.id} flat className="h-full">
                <div className="flex h-full flex-col items-center gap-3 p-6 text-center">
                  {logo ? (
                    <Image src={logo} alt={s.name} width={80} height={80} className="size-16 object-contain" unoptimized />
                  ) : (
                    <span className="grid size-16 place-items-center rounded-xl border border-crimson-700/40 bg-crimson-500/10 font-display text-2xl text-crimson-300">
                      {s.name[0]?.toUpperCase()}
                    </span>
                  )}
                  <p className="font-display text-base">{s.name}</p>
                </div>
              </GlowCard>
            );
          })}
        </div>
      ) : (
        <div className="mt-12 flex flex-col items-center gap-3 rounded-xl border border-dashed border-line py-16 text-center">
          <Handshake className="size-8 text-text-dim" />
          <p className="font-display text-xl">Be our first sponsor</p>
          <p className="max-w-sm text-sm text-text-muted">
            Reach thousands of engaged gamers across India. Submit a request below.
          </p>
        </div>
      )}

      {/* request form */}
      <div className="mt-20">
        <SectionHeading
          eyebrow="Become a sponsor"
          title="Partner with GRAVITY"
          lead="Tell us about your brand and we'll craft a sponsorship that fits."
          align="center"
          className="mx-auto"
        />
        <div className="mx-auto mt-8 max-w-2xl">
          <SponsorRequestForm />
        </div>
      </div>
    </div>
  );
}
