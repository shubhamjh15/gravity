import "server-only";

import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";
import { bps, type Bps } from "@/lib/money";

/**
 * Platform settings (`app_settings`) — configurable business values that must
 * never be hardcoded (SCHEMA.md §7).
 *
 * RLS restricts this table to superadmins, so ordinary server paths that need a
 * fee rate read it through the service-role client. That's a deliberate,
 * narrow use: settings are non-user data with no PII, and the alternative
 * (a public read policy) would leak the platform's own commercials.
 *
 * Every getter has a defensible default so a missing row, an unconfigured
 * backend, or a bad value can never take a money path down — it falls back to
 * the documented seed value instead.
 */

export const SETTING_DEFAULTS = {
  platform_fee_bps: 550, // 5.5%
  fallback_gateway_fee_bps: 200, // 2%
  membership_default_paise: 0,
  slot_hold_ttl_seconds: 600,
  maintenance_mode: false,
  payouts_mode: "manual" as "manual" | "razorpayx",
  feature_flags: { store: true, sponsors: true, communities: true },
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;

export type SettingRow = {
  key: string;
  value: unknown;
  description: string | null;
  updated_at: string;
};

/** All settings, for the admin console (superadmin-scoped by RLS). */
export async function listSettings(): Promise<SettingRow[]> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("app_settings")
      .select("key, value, description, updated_at")
      .order("key");
    if (error) return [];
    return (data ?? []) as SettingRow[];
  } catch {
    return [];
  }
}

/**
 * Read one setting from trusted server code, falling back to the seed default.
 * Uses the service-role client because app_settings is superadmin-only and
 * these values are needed on paths a player triggers (registration, checkout).
 */
export async function getSetting<K extends SettingKey>(
  key: K,
): Promise<(typeof SETTING_DEFAULTS)[K]> {
  const fallback = SETTING_DEFAULTS[key];
  try {
    const supabase = createSupabaseServiceRoleClient();
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();

    if (error || data?.value === undefined || data?.value === null) {
      return fallback;
    }
    return data.value as (typeof SETTING_DEFAULTS)[K];
  } catch {
    return fallback;
  }
}

/**
 * The platform commission, as branded Bps.
 *
 * Clamped to 0–10000: a corrupted setting must not produce a negative fee
 * (which would pay the organizer out of platform funds) or one above 100%
 * (which would take more than was collected).
 */
export async function getPlatformFeeBps(): Promise<Bps> {
  const raw = await getSetting("platform_fee_bps");
  const value = Number(raw);
  if (!Number.isFinite(value)) return bps(SETTING_DEFAULTS.platform_fee_bps);
  return bps(Math.min(Math.max(Math.round(value), 0), 10_000));
}

/** Extra fee when the fallback gateway is used. Same clamping rationale. */
export async function getFallbackGatewayFeeBps(): Promise<Bps> {
  const raw = await getSetting("fallback_gateway_fee_bps");
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return bps(SETTING_DEFAULTS.fallback_gateway_fee_bps);
  }
  return bps(Math.min(Math.max(Math.round(value), 0), 10_000));
}

/** How long a slot stays reserved awaiting payment. */
export async function getSlotHoldTtlSeconds(): Promise<number> {
  const raw = Number(await getSetting("slot_hold_ttl_seconds"));
  if (!Number.isFinite(raw) || raw <= 0) {
    return SETTING_DEFAULTS.slot_hold_ttl_seconds;
  }
  // Bounded to 1 minute … 24 hours; anything else is a misconfiguration that
  // would either break checkout or park slots indefinitely.
  return Math.min(Math.max(Math.round(raw), 60), 86_400);
}

export async function isMaintenanceMode(): Promise<boolean> {
  return Boolean(await getSetting("maintenance_mode"));
}

export async function getFeatureFlags(): Promise<
  typeof SETTING_DEFAULTS.feature_flags
> {
  const raw = await getSetting("feature_flags");
  if (!raw || typeof raw !== "object") return SETTING_DEFAULTS.feature_flags;
  return { ...SETTING_DEFAULTS.feature_flags, ...(raw as object) };
}
