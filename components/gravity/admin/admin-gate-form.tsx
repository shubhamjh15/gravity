"use client";

/**
 * Admin console unlock.
 *
 * Second factor in front of the console: you need the secret link AND the
 * passphrase AND the superadmin role. The role is still what authorizes every
 * query (RLS); this only controls whether the surface opens at all.
 *
 * Deliberately says nothing about which factor failed — a distinct "you're not
 * an admin" would confirm the link and passphrase to whoever found them.
 */
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ShieldCheck, Lock, Eye, EyeOff } from "lucide-react";
import { unlockAdmin } from "@/app/gate/[segment]/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AdminGateForm({ segment }: { segment: string }) {
  const [show, setShow] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await unlockAdmin({
        segment,
        passphrase: String(formData.get("passphrase") ?? ""),
      });
      if (res.success) {
        toast.success(res.message);
        // Hard navigation: the gate cookie was just set server-side and the
        // admin layout must re-read it.
        window.location.assign("/admin");
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="passphrase">Passphrase</Label>
        <div className="relative">
          <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-dim" />
          <Input
            id="passphrase"
            name="passphrase"
            type={show ? "text" : "password"}
            required
            autoComplete="off"
            autoFocus
            placeholder="••••••••••••"
            className="pr-10 pl-9"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Hide passphrase" : "Show passphrase"}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-text-dim transition-colors hover:text-foreground"
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      <Button type="submit" variant="gradient" size="xl" disabled={pending}>
        <ShieldCheck className="size-4" />
        {pending ? "Unlocking…" : "Unlock console"}
      </Button>

      <p className="text-center text-xs text-text-dim">
        Sessions expire after an hour and every unlock is recorded.
      </p>
    </form>
  );
}
