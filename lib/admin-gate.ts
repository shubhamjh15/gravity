import "server-only";

import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

/**
 * The hidden-admin gate — a SECOND factor in front of the console.
 *
 * The superadmin role is still the real authorization (RLS enforces it on
 * every query, and the admin layout re-checks it server-side). This adds a
 * separate thing-you-know on top, so a stolen or borrowed session alone cannot
 * open the console: you also need the secret URL and the passphrase.
 *
 * NON-NEGOTIABLE #4 says the hidden URL is cosmetic and RLS is the real gate.
 * That still holds — nothing here replaces a permission check. It only raises
 * the cost of reaching the surface at all.
 *
 * Sessions are recorded in `admin_sessions` (created in migration 0005 and,
 * until now, unused) so an admin can see and revoke their own open sessions,
 * and so an unlock leaves an audit trail.
 */

const COOKIE = "gv_admin_gate";

/** Short by design — the console holds PII reveals and money controls. */
const SESSION_TTL_MINUTES = 60;

/**
 * The signing key. Falls back to the service-role key so the gate still works
 * before a dedicated secret is set, but a dedicated one is preferred: rotating
 * it then invalidates every open admin session without touching the database
 * key that everything else depends on.
 */
function signingKey(): string {
  return (
    process.env.ADMIN_GATE_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ""
  );
}

function sign(value: string): string {
  return crypto.createHmac("sha256", signingKey()).update(value).digest("hex");
}

/** Constant-time compare — a plain === leaks length and position by timing. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/** True when the configured URL segment matches what was requested. */
export function isAdminSegment(segment: string): boolean {
  const expected = process.env.ADMIN_URL_SEGMENT;
  if (!expected || expected.length < 8) return false;
  return safeEqual(segment, expected);
}

/**
 * Check the passphrase.
 *
 * Compared in constant time, and deliberately refuses when unset rather than
 * defaulting to open — a missing secret must fail closed.
 */
export function isAdminPassphrase(candidate: string): boolean {
  const expected = process.env.ADMIN_PASSPHRASE;
  if (!expected || expected.length < 8) return false;
  return safeEqual(candidate, expected);
}

/** Is the gate configured at all? Used to explain a locked-out state. */
export function isGateConfigured(): boolean {
  return Boolean(
    process.env.ADMIN_URL_SEGMENT &&
      process.env.ADMIN_URL_SEGMENT.length >= 8 &&
      process.env.ADMIN_PASSPHRASE &&
      process.env.ADMIN_PASSPHRASE.length >= 8,
  );
}

/**
 * Record an unlock and set the gate cookie.
 *
 * The cookie carries `<sessionId>.<hmac>`; the id alone is useless without a
 * signature made with the server key, so a guessed or copied id won't open
 * anything. httpOnly keeps it away from any script on the page.
 *
 * NOTE the indirection: admin_sessions.admin_id references PLATFORM_ADMINS.id,
 * not auth.users.id. The allowlist row is its own record — being a superadmin
 * is not the same as being on the console allowlist, and the session hangs off
 * the allowlist entry so removing someone from it drops their live sessions
 * via ON DELETE CASCADE.
 */
export async function openAdminSession(userId: string): Promise<void> {
  const supabase = createSupabaseServiceRoleClient();
  const h = await headers();

  const { data: allowlisted } = await supabase
    .from("platform_admins")
    .select("id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (!allowlisted) {
    throw new Error(
      "Not on the platform_admins allowlist. Run: npm run db:promote <email> superadmin",
    );
  }

  const expiresAt = new Date(Date.now() + SESSION_TTL_MINUTES * 60_000);

  const { data, error } = await supabase
    .from("admin_sessions")
    .insert({
      admin_id: allowlisted.id,
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      user_agent: h.get("user-agent") ?? null,
      expires_at: expiresAt.toISOString(),
      last_seen: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !data) {
    // Surface the real reason — a silent generic failure here is what made
    // this bug take three checks to find.
    throw new Error(
      `Could not open an admin session: ${error?.message ?? "no row returned"}`,
    );
  }

  const jar = await cookies();
  jar.set(COOKIE, `${data.id}.${sign(data.id)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  await supabase.rpc("write_audit_log", {
    p_action: "admin_gate_unlocked",
    p_target_table: "admin_sessions",
    p_target_id: userId,
  });
}

/**
 * Is there a live, signed gate session?
 *
 * Verifies the signature BEFORE touching the database, so a forged cookie
 * costs an HMAC and not a query.
 */
export async function hasAdminSession(): Promise<boolean> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return false;

  const [id, mac] = raw.split(".");
  if (!id || !mac) return false;
  if (!safeEqual(mac, sign(id))) return false;

  try {
    const supabase = createSupabaseServiceRoleClient();
    const { data } = await supabase
      .from("admin_sessions")
      .select("id, expires_at")
      .eq("id", id)
      .maybeSingle();

    if (!data) return false;
    if (new Date(data.expires_at).getTime() <= Date.now()) return false;

    // Best-effort activity stamp; never block the request on it.
    void supabase
      .from("admin_sessions")
      .update({ last_seen: new Date().toISOString() })
      .eq("id", id);

    return true;
  } catch {
    // If the check itself cannot run, fail CLOSED.
    return false;
  }
}

/** Sign out of the console without touching the Supabase auth session. */
export async function closeAdminSession(): Promise<void> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  jar.delete(COOKIE);

  const id = raw?.split(".")[0];
  if (!id) return;

  try {
    const supabase = createSupabaseServiceRoleClient();
    await supabase.from("admin_sessions").delete().eq("id", id);
  } catch {
    // The cookie is already gone; a stale row expires on its own.
  }
}

/** Where the unlock form lives. Never rendered anywhere a visitor can find. */
export function adminGatePath(): string {
  return `/gate/${process.env.ADMIN_URL_SEGMENT ?? ""}`;
}
