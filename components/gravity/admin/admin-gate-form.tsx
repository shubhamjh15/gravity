"use client";

/**
 * Admin console login — password only.
 *
 * Shown in place of the console when there's no valid session. On success the
 * server sets a signed cookie and we hard-navigate so the layout re-reads it.
 */
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ShieldCheck, Lock, Eye, EyeOff } from "lucide-react";
import { unlockAdmin } from "@/app/(admin)/admin/gate-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AdminGateForm() {
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await unlockAdmin({
        password: String(formData.get("password") ?? ""),
      });
      if (res.success) {
        setError(null);
        toast.success(res.message);
        window.location.assign("/admin");
      } else {
        setError(res.message);
        toast.error(res.message);
      }
    });
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Admin password</Label>
        <div className="relative">
          <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-dim" />
          <Input
            id="password"
            name="password"
            type={show ? "text" : "password"}
            required
            autoComplete="current-password"
            autoFocus
            placeholder="••••••••"
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
        {error ? (
          <p role="alert" className="text-xs font-medium text-crimson-400">
            {error}
          </p>
        ) : null}
      </div>

      <Button type="submit" variant="gradient" size="xl" disabled={pending}>
        <ShieldCheck className="size-4" />
        {pending ? "Checking…" : "Enter console"}
      </Button>
    </form>
  );
}
