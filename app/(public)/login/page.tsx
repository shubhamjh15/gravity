import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AuroraBackground } from "@/components/gravity/aurora-background";
import { Logo } from "@/components/gravity/logo";
import { GoogleSignIn } from "@/components/gravity/auth/google-sign-in";

export const metadata: Metadata = {
  title: "Enter the Arena",
  description: "Log in to GRAVITY to compete, host tournaments and build your community.",
};

export default function LoginPage() {
  return (
    <section className="relative flex min-h-[100svh] items-center justify-center overflow-hidden px-4 pt-16">
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

          <div className="mt-8">
            <Suspense
              fallback={
                <div className="h-12 w-full animate-pulse rounded-lg bg-surface-2" />
              }
            >
              <GoogleSignIn />
            </Suspense>
          </div>

          <p className="mt-6 text-center text-xs leading-relaxed text-text-dim">
            By continuing you agree to GRAVITY&apos;s Terms and acknowledge our
            Privacy Policy. New here? An account is created automatically on
            first sign-in.
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
