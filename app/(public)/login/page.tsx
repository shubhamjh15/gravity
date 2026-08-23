import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuroraBackground } from "@/components/gravity/aurora-background";
import { Logo } from "@/components/gravity/logo";
import { GoogleSignIn } from "@/components/gravity/auth/google-sign-in";
import { EmailAuthForm } from "@/components/gravity/auth/email-auth-form";
import { AuthErrorNotice } from "@/components/gravity/auth/auth-error-notice";
import { getAuthContext, landingPathForRoles } from "@/lib/auth";
import { safeNextPath } from "@/lib/validators/auth";

export const metadata: Metadata = {
  title: "Enter the Arena",
  description: "Log in to GRAVITY to compete, host tournaments and build your community.",
};

/**
 * One page for both auth methods. Email + password and Google land in exactly
 * the same place — Supabase Auth creates the user, the handle_new_user trigger
 * creates the profile and the default `player` role, and roles decide where
 * the user goes next.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; mode?: string; error?: string }>;
}) {
  const params = await searchParams;

  // Already signed in? Don't show a login form — send them where they belong.
  const { user, roles } = await getAuthContext();
  if (user) {
    // typedRoutes can't know a runtime-computed path is valid.
    redirect((safeNextPath(params.next) ?? landingPathForRoles(roles)) as never);
  }

  const mode = params.mode === "signup" ? "signup" : "signin";

  return (
    <section className="relative flex min-h-[100svh] items-center justify-center overflow-hidden px-4 py-20">
      <AuroraBackground />

      <div className="relative z-10 w-full max-w-md">
        <div className="gv-panel p-8 sm:p-10">
          <div className="flex flex-col items-center text-center">
            <Logo size="lg" href="/" />
            <h1 className="mt-8 font-display text-3xl tracking-tight">
              Enter the Arena
            </h1>
            <p className="mt-2 text-sm text-text-muted">
              One account to compete, host tournaments, and run communities.
              Your roles unlock as you go.
            </p>
          </div>

          <Suspense fallback={null}>
            <AuthErrorNotice />
          </Suspense>

          <div className="mt-7">
            <Suspense
              fallback={
                <div className="h-12 w-full animate-pulse rounded-lg bg-surface-2" />
              }
            >
              <GoogleSignIn />
            </Suspense>
          </div>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="font-mono text-[10px] tracking-widest text-text-dim uppercase">
              or with email
            </span>
            <span className="h-px flex-1 bg-line" />
          </div>

          <Suspense
            fallback={
              <div className="h-64 w-full animate-pulse rounded-lg bg-surface-2" />
            }
          >
            <EmailAuthForm initialMode={mode} />
          </Suspense>

          <p className="mt-6 text-center text-xs leading-relaxed text-text-dim">
            By continuing you agree to GRAVITY&apos;s Terms and acknowledge our
            Privacy Policy.
          </p>
        </div>

        <p className="mt-6 text-center text-sm text-text-muted">
          <Link
            href={"/" as never}
            className="transition-colors hover:text-crimson-300"
          >
            ← Back to home
          </Link>
        </p>
      </div>
    </section>
  );
}
