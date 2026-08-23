"use client";

/**
 * Request a password-reset link.
 *
 * The success state is shown for ANY valid email, whether or not an account
 * exists — the server deliberately answers identically. Reflecting "no such
 * account" here would hand anyone a way to test which emails are registered,
 * which on this platform maps an address to a UPI payout target.
 */
import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Mail, MailCheck } from "lucide-react";
import { requestPasswordReset } from "@/app/auth/actions";
import { FieldError } from "@/components/gravity/profile/field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    const value = String(formData.get("email") ?? "");
    startTransition(async () => {
      const res = await requestPasswordReset({ email: value });
      if (res.success) {
        setErrors({});
        setEmail(value);
        setSent(true);
        toast.success(res.message);
      } else {
        setErrors(res.errors ?? {});
        toast.error(res.message);
      }
    });
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <MailCheck className="size-10 text-success" />
        <div>
          <h2 className="font-display text-xl">Check your inbox</h2>
          <p className="mt-1 text-sm text-text-muted">
            If an account exists for{" "}
            <span className="font-medium text-foreground">{email}</span>, a reset
            link is on its way. It expires in an hour.
          </p>
        </div>
        <Button asChild variant="outline" className="w-full">
          <Link href={"/login" as never}>Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-dim" />
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="pl-9"
          />
        </div>
        <FieldError message={errors.email} />
      </div>

      <Button type="submit" variant="gradient" size="xl" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>

      <Link
        href={"/login" as never}
        className="text-center text-sm text-text-muted transition-colors hover:text-crimson-300"
      >
        ← Back to sign in
      </Link>
    </form>
  );
}
