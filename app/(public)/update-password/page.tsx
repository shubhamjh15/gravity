import type { Metadata } from "next";
import Link from "next/link";
import { AuroraBackground } from "@/components/gravity/aurora-background";
import { Logo } from "@/components/gravity/logo";
import { UpdatePasswordForm } from "@/components/gravity/auth/update-password-form";
import { getAuthContext, landingPathForRoles } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Set a new password",
  robots: { index: false },
};

/**
 * Reached from a recovery link, which the auth callback verifies into a session
 * before redirecting here. Without that session there is nothing to update, so
 * we say so plainly instead of showing a form that can only fail.
 */
export default async function UpdatePasswordPage() {
  const { user, roles } = await getAuthContext();

  return (
    <section className="relative flex min-h-[100svh] items-center justify-center overflow-hidden px-4 py-20">
      <AuroraBackground />
      <div className="relative z-10 w-full max-w-md">
        <div className="gv-panel p-8 sm:p-10">
          <div className="flex flex-col items-center text-center">
            <Logo size="lg" href="/" />
            <h1 className="mt-8 font-display text-3xl tracking-tight">
              {user ? "Set a new password" : "Link expired"}
            </h1>
            <p className="mt-2 text-sm text-text-muted">
              {user
                ? "Choose something you haven't used here before."
                : "That reset link has expired or was already used."}
            </p>
          </div>

          <div className="mt-8">
            {user ? (
              <UpdatePasswordForm landingPath={landingPathForRoles(roles)} />
            ) : (
              <Button asChild variant="gradient" size="xl" className="w-full">
                <Link href={"/forgot-password" as never}>Request a new link</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
