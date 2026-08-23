import type { Metadata } from "next";
import { AuroraBackground } from "@/components/gravity/aurora-background";
import { Logo } from "@/components/gravity/logo";
import { ForgotPasswordForm } from "@/components/gravity/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Reset your password",
  robots: { index: false },
};

export default function ForgotPasswordPage() {
  return (
    <section className="relative flex min-h-[100svh] items-center justify-center overflow-hidden px-4 py-20">
      <AuroraBackground />
      <div className="relative z-10 w-full max-w-md">
        <div className="gv-panel p-8 sm:p-10">
          <div className="flex flex-col items-center text-center">
            <Logo size="lg" href="/" />
            <h1 className="mt-8 font-display text-3xl tracking-tight">
              Reset your password
            </h1>
            <p className="mt-2 text-sm text-text-muted">
              Enter your email and we&apos;ll send you a link to set a new one.
            </p>
          </div>
          <div className="mt-8">
            <ForgotPasswordForm />
          </div>
        </div>
      </div>
    </section>
  );
}
