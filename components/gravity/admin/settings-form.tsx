"use client";

/**
 * Platform settings form (ROADMAP 6.1).
 *
 * Fees are STORED and submitted in basis points — that's the unit lib/money
 * applies (#1) — but a human thinks in percent, so the field takes percent and
 * shows the resulting bps live. The conversion happens in one place, via
 * percentToBps, and the label states both units so there's no ambiguity about
 * what got saved.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Settings, TriangleAlert } from "lucide-react";
import { updatePlatformSettings } from "@/app/(admin)/admin/settings/actions";
import { percentToBps, bpsToPercent, bps, formatPaise, paise } from "@/lib/money";
import { FieldError } from "@/components/gravity/profile/field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SettingsValues = {
  platform_fee_bps: number;
  fallback_gateway_fee_bps: number;
  slot_hold_ttl_seconds: number;
  membership_default_paise: number;
  maintenance_mode: boolean;
  payouts_mode: "manual" | "razorpayx";
  feature_flags: { store: boolean; sponsors: boolean; communities: boolean };
};

export function SettingsForm({ initial }: { initial: SettingsValues }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  // Percent in the UI, bps on the wire.
  const [feePct, setFeePct] = useState(
    String(bpsToPercent(bps(initial.platform_fee_bps))),
  );
  const [fallbackPct, setFallbackPct] = useState(
    String(bpsToPercent(bps(initial.fallback_gateway_fee_bps))),
  );
  const [payoutsMode, setPayoutsMode] = useState(initial.payouts_mode);
  const [maintenance, setMaintenance] = useState(initial.maintenance_mode);

  const feeBpsPreview = safeBps(feePct);
  const fallbackBpsPreview = safeBps(fallbackPct);

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await updatePlatformSettings({
        platform_fee_bps: feeBpsPreview,
        fallback_gateway_fee_bps: fallbackBpsPreview,
        slot_hold_ttl_seconds: Number(formData.get("slot_hold_ttl_seconds") ?? 600),
        membership_default_paise: Number(
          formData.get("membership_default_paise") ?? 0,
        ),
        maintenance_mode: maintenance,
        payouts_mode: payoutsMode,
        feature_store: formData.get("feature_store") === "on",
        feature_sponsors: formData.get("feature_sponsors") === "on",
        feature_communities: formData.get("feature_communities") === "on",
      });

      if (res.success) {
        setErrors({});
        toast.success(res.message);
        router.refresh();
      } else {
        setErrors(res.errors ?? {});
        toast.error(res.message);
      }
    });
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-8">
      {/* Money */}
      <section className="rounded-xl border border-line bg-[image:var(--gv-grad-surface)] p-5">
        <div className="flex items-center gap-2">
          <Settings className="size-4 text-crimson-400" />
          <h2 className="font-display text-lg tracking-tight">Fees &amp; money</h2>
        </div>
        <p className="mt-1 text-sm text-text-muted">
          Applied to every paid registration. Stored in basis points, the unit
          the prize engine works in.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fee">Platform commission (%)</Label>
            <Input
              id="fee"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={feePct}
              onChange={(e) => setFeePct(e.target.value)}
            />
            <p className="font-mono text-xs text-text-dim">
              = {feeBpsPreview} bps
            </p>
            <FieldError message={errors.platform_fee_bps} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fallback">Fallback gateway surcharge (%)</Label>
            <Input
              id="fallback"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={fallbackPct}
              onChange={(e) => setFallbackPct(e.target.value)}
            />
            <p className="font-mono text-xs text-text-dim">
              = {fallbackBpsPreview} bps
            </p>
            <FieldError message={errors.fallback_gateway_fee_bps} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="membership_default_paise">
              Default membership cost (paise)
            </Label>
            <Input
              id="membership_default_paise"
              name="membership_default_paise"
              type="number"
              min={0}
              step={1}
              defaultValue={initial.membership_default_paise}
            />
            <p className="font-mono text-xs text-text-dim">
              ={" "}
              {formatPaise(paise(Math.max(0, initial.membership_default_paise)), {
                compactWhole: true,
              })}{" "}
              · 0 means the organizer decides
            </p>
            <FieldError message={errors.membership_default_paise} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="slot_hold_ttl_seconds">Slot hold (seconds)</Label>
            <Input
              id="slot_hold_ttl_seconds"
              name="slot_hold_ttl_seconds"
              type="number"
              min={60}
              max={86400}
              defaultValue={initial.slot_hold_ttl_seconds}
            />
            <p className="text-xs text-text-dim">
              How long a slot is reserved while the player pays.
            </p>
            <FieldError message={errors.slot_hold_ttl_seconds} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payouts_mode">Payouts mode</Label>
            <Select
              value={payoutsMode}
              onValueChange={(v) => setPayoutsMode(v as "manual" | "razorpayx")}
            >
              <SelectTrigger id="payouts_mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual UPI transfer (v1)</SelectItem>
                <SelectItem value="razorpayx">RazorpayX (automated)</SelectItem>
              </SelectContent>
            </Select>
            {payoutsMode === "razorpayx" ? (
              <p className="flex items-start gap-1.5 text-xs text-warning">
                <TriangleAlert className="mt-0.5 size-3 shrink-0" />
                RazorpayX isn&apos;t implemented yet — payouts still run through
                the manual worklist.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {/* Surfaces */}
      <section className="rounded-xl border border-line bg-[image:var(--gv-grad-surface)] p-5">
        <h2 className="font-display text-lg tracking-tight">Surfaces</h2>
        <p className="mt-1 text-sm text-text-muted">
          Turn a whole surface off without deploying.
        </p>

        <div className="mt-4 flex flex-col gap-2">
          <Toggle
            name="feature_store"
            label="Store"
            defaultChecked={initial.feature_flags.store}
          />
          <Toggle
            name="feature_sponsors"
            label="Sponsors"
            defaultChecked={initial.feature_flags.sponsors}
          />
          <Toggle
            name="feature_communities"
            label="Communities"
            defaultChecked={initial.feature_flags.communities}
          />
        </div>
      </section>

      {/* Maintenance */}
      <section className="rounded-xl border border-line bg-[image:var(--gv-grad-surface)] p-5">
        <h2 className="font-display text-lg tracking-tight">Maintenance mode</h2>
        <label className="mt-3 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={maintenance}
            onChange={(e) => setMaintenance(e.target.checked)}
            className="mt-0.5 size-4 accent-crimson-500"
          />
          <span>
            Show a maintenance screen to everyone.
            <span className="mt-0.5 block text-xs text-text-muted">
              The Razorpay webhook keeps running regardless — money already in
              flight must still settle.
            </span>
          </span>
        </label>
        {maintenance ? (
          <p
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
            Maintenance mode is on — the public site is closed to visitors.
          </p>
        ) : null}
      </section>

      <div className="flex justify-end">
        <Button type="submit" variant="gradient" size="lg" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </form>
  );
}

function Toggle({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="size-4 accent-crimson-500"
      />
      {label}
    </label>
  );
}

/** Percent string → whole bps, clamped. Never throws on a half-typed value. */
function safeBps(percentInput: string): number {
  const value = Number(percentInput);
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(percentToBps(Math.min(value, 100)) as number, 10_000);
}
