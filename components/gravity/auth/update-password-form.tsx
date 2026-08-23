"use client";

/**
 * Set a new password after following a recovery link.
 *
 * Reachable only with the recovery session that link created — the server
 * re-checks, so landing here without one produces a clear "request a new link"
 * rather than a silent no-op.
 */
import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Lock, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { updatePassword } from "@/app/auth/actions";
import { FieldError } from "@/components/gravity/profile/field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function UpdatePasswordForm({ landingPath }: { landingPath: string }) {
  const [show, setShow] = useState(false);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await updatePassword({
        password: String(formData.get("password") ?? ""),
        confirm_password: String(formData.get("confirm_password") ?? ""),
      });
      if (res.success) {
        setErrors({});
        setDone(true);
        toast.success(res.message);
        // Hard navigation so every layout re-reads the refreshed session.
        setTimeout(() => window.location.assign(landingPath), 900);
      } else {
        setErrors(res.errors ?? {});
        toast.error(res.message);
      }
    });
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <ShieldCheck className="size-10 text-success" />
        <h2 className="font-display text-xl">Password updated</h2>
        <p className="text-sm text-text-muted">Taking you to your account…</p>
      </div>
    );
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">New password</Label>
        <div className="relative">
          <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-dim" />
          <Input
            id="password"
            name="password"
            type={show ? "text" : "password"}
            required
            autoComplete="new-password"
            placeholder="At least 10 characters"
            className="pr-10 pl-9"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-text-dim transition-colors hover:text-foreground"
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        <FieldError message={errors.password} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirm_password">Confirm new password</Label>
        <div className="relative">
          <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-dim" />
          <Input
            id="confirm_password"
            name="confirm_password"
            type={show ? "text" : "password"}
            required
            autoComplete="new-password"
            placeholder="••••••••"
            className="pl-9"
          />
        </div>
        <FieldError message={errors.confirm_password} />
      </div>

      <Button type="submit" variant="gradient" size="xl" disabled={pending}>
        {pending ? "Updating…" : "Set new password"}
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
