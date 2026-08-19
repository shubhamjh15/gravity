"use client";

/**
 * Email + password sign-in / sign-up.
 *
 * One component with two modes so the user can flip without losing what they've
 * typed — the email carries across, which is the field people get wrong when a
 * form resets under them.
 *
 * Everything is validated server-side too; the client rules exist to give
 * immediate feedback, never as the enforcement.
 */
import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Mail, Lock, User, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import {
  signInWithEmail,
  signUpWithEmail,
  resendConfirmation,
} from "@/app/auth/actions";
import { FieldError } from "@/components/gravity/profile/field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Mode = "signin" | "signup";

export function EmailAuthForm({ initialMode = "signin" }: { initialMode?: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? undefined;

  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [pending, startTransition] = useTransition();

  function switchMode(to: Mode) {
    setMode(to);
    setErrors({});
    setAwaitingConfirmation(false);
  }

  function onSubmit(formData: FormData) {
    const payload = {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      next,
    };

    startTransition(async () => {
      if (mode === "signin") {
        const res = await signInWithEmail(payload);
        if (res.success) {
          setErrors({});
          toast.success(res.message);
          // Full navigation, not router.push: the auth cookies were just set on
          // the server and every layout above needs to re-read them.
          window.location.assign(res.data.redirectTo);
        } else {
          setErrors(res.errors ?? {});
          toast.error(res.message);
        }
        return;
      }

      const res = await signUpWithEmail({
        ...payload,
        display_name: String(formData.get("display_name") ?? ""),
        confirm_password: String(formData.get("confirm_password") ?? ""),
      });

      if (res.success) {
        setErrors({});
        toast.success(res.message);
        if (res.data.needsConfirmation) {
          setAwaitingConfirmation(true);
        } else {
          window.location.assign(res.data.redirectTo);
        }
      } else {
        setErrors(res.errors ?? {});
        toast.error(res.message);
      }
    });
  }

  function resend() {
    startTransition(async () => {
      const res = await resendConfirmation({ email });
      toast[res.success ? "success" : "error"](res.message);
    });
  }

  // Post-signup: the account exists but has no session until the link is clicked.
  if (awaitingConfirmation) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <CheckCircle2 className="size-10 text-success" />
        <div>
          <h2 className="font-display text-xl">Check your inbox</h2>
          <p className="mt-1 text-sm text-text-muted">
            We sent a confirmation link to{" "}
            <span className="font-medium text-foreground">{email}</span>. Click
            it and you&apos;re in.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2">
          <Button variant="outline" disabled={pending} onClick={resend}>
            {pending ? "Sending…" : "Resend the email"}
          </Button>
          <Button variant="ghost" onClick={() => switchMode("signin")}>
            Back to sign in
          </Button>
        </div>
        <p className="text-xs text-text-dim">
          Nothing yet? Check spam — confirmation mail often lands there.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* mode switch */}
      <div
        role="tablist"
        aria-label="Sign in or create an account"
        className="grid grid-cols-2 gap-1 rounded-lg border border-line bg-void/40 p-1"
      >
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            role="tab"
            type="button"
            aria-selected={mode === m}
            onClick={() => switchMode(m)}
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium transition-colors",
              mode === m
                ? "bg-surface-2 text-foreground shadow-soft"
                : "text-text-muted hover:text-foreground",
            )}
          >
            {m === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <form action={onSubmit} className="mt-5 flex flex-col gap-4">
        {mode === "signup" ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="display_name">Your name</Label>
            <div className="relative">
              <User className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-dim" />
              <Input
                id="display_name"
                name="display_name"
                required
                autoComplete="name"
                placeholder="Your gamer name"
                className="pl-9"
              />
            </div>
            <FieldError message={errors.display_name} />
          </div>
        ) : null}

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
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="pl-9"
            />
          </div>
          <FieldError message={errors.email} />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            {mode === "signin" ? (
              <Link
                href={"/forgot-password" as never}
                className="text-xs text-text-muted transition-colors hover:text-crimson-300"
              >
                Forgot it?
              </Link>
            ) : null}
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-dim" />
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              placeholder={mode === "signup" ? "At least 10 characters" : "••••••••"}
              className="pr-10 pl-9"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-text-dim transition-colors hover:text-foreground"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <FieldError message={errors.password} />
        </div>

        {mode === "signup" ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm_password">Confirm password</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-dim" />
              <Input
                id="confirm_password"
                name="confirm_password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="new-password"
                placeholder="••••••••"
                className="pl-9"
              />
            </div>
            <FieldError message={errors.confirm_password} />
          </div>
        ) : null}

        <Button type="submit" variant="gradient" size="xl" disabled={pending} className="mt-1">
          {pending
            ? mode === "signin"
              ? "Signing in…"
              : "Creating account…"
            : mode === "signin"
              ? "Sign in"
              : "Create account"}
        </Button>
      </form>
    </div>
  );
}
