import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Logo } from "@/components/gravity/logo";
import { AuroraBackground } from "@/components/gravity/aurora-background";
import { AdminGateForm } from "@/components/gravity/admin/admin-gate-form";
import {
  isAdminSegment,
  isGateConfigured,
  hasAdminSession,
} from "@/lib/admin-gate";

/**
 * The hidden unlock page for the admin console.
 *
 * A wrong segment 404s exactly like any unknown path — the page must be
 * indistinguishable from "no such route", or the URL space itself becomes
 * enumerable. Nothing links here; the address is the first factor.
 */
export const metadata: Metadata = {
  title: "Not Found",
  robots: { index: false, follow: false },
};

export default async function AdminGatePage({
  params,
}: {
  params: Promise<{ segment: string }>;
}) {
  const { segment } = await params;

  // Unconfigured behaves as non-existent rather than as an open door.
  if (!isGateConfigured() || !isAdminSegment(segment)) {
    notFound();
  }

  // Already unlocked — don't make them type it twice.
  if (await hasAdminSession()) {
    redirect("/admin");
  }

  return (
    <section className="relative flex min-h-[100svh] items-center justify-center overflow-hidden px-4 py-20">
      <AuroraBackground />

      <div className="relative z-10 w-full max-w-sm">
        <div className="gv-panel p-8">
          <div className="flex flex-col items-center text-center">
            <Logo size="lg" href="/" />
            <h1 className="mt-8 font-display text-2xl tracking-tight">
              Control room
            </h1>
            <p className="mt-2 text-sm text-text-muted">
              Enter the console passphrase to continue.
            </p>
          </div>

          <div className="mt-8">
            <AdminGateForm segment={segment} />
          </div>
        </div>
      </div>
    </section>
  );
}
