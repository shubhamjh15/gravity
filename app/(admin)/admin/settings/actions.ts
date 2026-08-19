"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import { ok, fail, zodErrors, type ActionResult } from "@/lib/action-result";
import { platformSettingsSchema } from "@/lib/validators/admin";

/**
 * Platform settings (ROADMAP 6.1 "fallback-fee config").
 *
 * app_settings existed and was seeded from day one, but nothing could change a
 * value without opening the SQL editor. These are business-critical numbers —
 * the commission taken from every paid registration, how long a slot is held —
 * so they get a real screen, full validation, and an audit trail.
 */
export async function updatePlatformSettings(
  input: unknown,
): Promise<ActionResult> {
  const { user, isSuperadmin } = await getAuthContext();
  if (!user || !isSuperadmin) return fail("Not authorized.");

  const parsed = platformSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the settings.", zodErrors(parsed.error.issues));
  }
  const s = parsed.data;

  const supabase = await createSupabaseServerClient();

  // Capture the previous values so the audit entry shows what actually changed.
  const { data: before } = await supabase
    .from("app_settings")
    .select("key, value");
  const beforeMap = Object.fromEntries(
    (before ?? []).map((r) => [r.key, r.value]),
  );

  // jsonb columns: every value is stored as JSON, including scalars.
  const rows = [
    { key: "platform_fee_bps", value: s.platform_fee_bps },
    { key: "fallback_gateway_fee_bps", value: s.fallback_gateway_fee_bps },
    { key: "slot_hold_ttl_seconds", value: s.slot_hold_ttl_seconds },
    { key: "membership_default_paise", value: s.membership_default_paise },
    { key: "maintenance_mode", value: s.maintenance_mode },
    { key: "payouts_mode", value: s.payouts_mode },
    {
      key: "feature_flags",
      value: {
        store: s.feature_store,
        sponsors: s.feature_sponsors,
        communities: s.feature_communities,
      },
    },
  ].map((r) => ({ ...r, updated_by: user.id }));

  const { error } = await supabase
    .from("app_settings")
    .upsert(rows, { onConflict: "key" });
  if (error) return fail("Could not save settings.");

  await supabase.rpc("write_audit_log", {
    p_action: "update_platform_settings",
    p_target_table: "app_settings",
    p_before: beforeMap,
    p_after: Object.fromEntries(rows.map((r) => [r.key, r.value])),
  });

  // Fee changes affect what gets quoted on every paid surface.
  revalidatePath("/admin/settings");
  revalidatePath("/events");
  revalidatePath("/store");
  return ok(undefined, "Settings saved.");
}
