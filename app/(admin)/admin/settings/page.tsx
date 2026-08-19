import type { Metadata } from "next";
import { listSettings, SETTING_DEFAULTS } from "@/lib/data/settings";
import {
  SettingsForm,
  type SettingsValues,
} from "@/components/gravity/admin/settings-form";

export const metadata: Metadata = {
  title: "Platform Settings",
  robots: { index: false },
};

/**
 * Platform settings console (ROADMAP 6.1 "fallback-fee config").
 *
 * app_settings was seeded from day one but had no screen — changing the
 * commission meant opening the SQL editor. Values fall back to the documented
 * seed defaults so the form still renders correctly against a database where a
 * key was never inserted.
 */
export default async function AdminSettingsPage() {
  const rows = await listSettings();
  const byKey = new Map(rows.map((r) => [r.key, r.value]));

  function num(key: keyof typeof SETTING_DEFAULTS, fallback: number): number {
    const raw = Number(byKey.get(key));
    return Number.isFinite(raw) ? raw : fallback;
  }

  const flagsRaw = byKey.get("feature_flags");
  const flags =
    flagsRaw && typeof flagsRaw === "object"
      ? { ...SETTING_DEFAULTS.feature_flags, ...(flagsRaw as object) }
      : SETTING_DEFAULTS.feature_flags;

  const payoutsRaw = byKey.get("payouts_mode");
  const initial: SettingsValues = {
    platform_fee_bps: num("platform_fee_bps", SETTING_DEFAULTS.platform_fee_bps),
    fallback_gateway_fee_bps: num(
      "fallback_gateway_fee_bps",
      SETTING_DEFAULTS.fallback_gateway_fee_bps,
    ),
    slot_hold_ttl_seconds: num(
      "slot_hold_ttl_seconds",
      SETTING_DEFAULTS.slot_hold_ttl_seconds,
    ),
    membership_default_paise: num(
      "membership_default_paise",
      SETTING_DEFAULTS.membership_default_paise,
    ),
    maintenance_mode: Boolean(byKey.get("maintenance_mode")),
    payouts_mode: payoutsRaw === "razorpayx" ? "razorpayx" : "manual",
    feature_flags: flags,
  };

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl tracking-tight">Platform settings</h1>
      <p className="mt-1 text-sm text-text-muted">
        Business values that must never be hardcoded. Every change is audited
        with its before and after.
      </p>

      <div className="mt-8">
        <SettingsForm initial={initial} />
      </div>

      {rows.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-line px-4 py-3 text-sm text-text-muted">
          No settings rows found — showing the documented defaults. Saving will
          create them.
        </p>
      ) : null}
    </div>
  );
}
