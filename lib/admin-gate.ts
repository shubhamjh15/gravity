import "server-only";

import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

/**
 * Admin console password gate.
 *
 * Go to /admin, type the password, you're in. No secret URL, no role required.
 *
 * The password is compared in plain text against ADMIN_PASSWORD — it is NOT
 * hashed, because there is nothing to hash it against: anyone who can read the
 * env var can read a hash of it too.
 *
 * The session COOKIE is signed, and that part is load-bearing. Without a
 * signature anyone could set `gv_admin_gate=<anything>` in devtools and walk
 * straight past the password. The HMAC is what makes typing the password
 * actually mean something.
 */

const COOKIE = "gv_admin_gate";

/** How long a login lasts before the password is asked for again. */
const SESSION_TTL_HOURS = 12;

/** Below this length a gate is decoration rather than a control. */
const MIN_PASSWORD_LENGTH = 8;

/** Wrong guesses allowed per IP before that IP is locked out for a while. */
const MAX_ATTEMPTS = 8;
const LOCKOUT_MINUTES = 15;

/**
 * In-memory attempt counter keyed by IP.
 *
 * Deliberately not a table: this is throttling, not an audit trail, and losing
 * it on restart is fine. Across several instances each throttles on its own —
 * still enough to make guessing a short password impractical.
 */
const attempts = new Map<string, { count: number; until: number }>();

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

/** Constant-time compare — `===` leaks length and position through timing. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/** Configured at all? An unset password FAILS CLOSED — it never means "open". */
export function isGateConfigured(): boolean {
  const pw = process.env.ADMIN_PASSWORD;
  return Boolean(pw && pw.length >= MIN_PASSWORD_LENGTH);
}

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

/** Seconds of lockout remaining for this IP, or 0. */
export async function lockoutSeconds(): Promise<number> {
  const record = attempts.get(await clientIp());
  if (!record || record.until <= Date.now()) return 0;
  return Math.ceil((record.until - Date.now()) / 1000);
}

/**
 * Check the password, rate-limited per IP.
 *
 * Returns a reason rather than a bare boolean so the form can say "try again in
 * N minutes" instead of repeating "wrong password" at someone already locked
 * out.
 */
export async function checkAdminPassword(
  candidate: string,
): Promise<{ ok: boolean; lockedFor?: number }> {
  const ip = await clientIp();
  const record = attempts.get(ip);

  if (record && record.until > Date.now()) {
    return {
      ok: false,
      lockedFor: Math.ceil((record.until - Date.now()) / 1000),
    };
  }

  const expected = process.env.ADMIN_PASSWORD ?? "";
  if (expected.length < MIN_PASSWORD_LENGTH) return { ok: false };

  if (safeEqual(candidate, expected)) {
    attempts.delete(ip);
    return { ok: true };
  }

  const count = (record?.count ?? 0) + 1;
  attempts.set(ip, {
    count,
    until: count >= MAX_ATTEMPTS ? Date.now() + LOCKOUT_MINUTES * 60_000 : 0,
  });

  return {
    ok: false,
    lockedFor: count >= MAX_ATTEMPTS ? LOCKOUT_MINUTES * 60 : undefined,
  };
}

/**
 * Start a console session and set the signed cookie.
 *
 * `userId` is optional — the password alone gets you in. When someone IS signed
 * in and on the platform_admins allowlist, the session is also recorded against
 * that row so it appears in the audit trail and dies with the allowlist entry.
 */
export async function openAdminSession(userId?: string): Promise<void> {
  const jar = await cookies();
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3_600_000);

  let sessionId: string | null = null;

  if (userId) {
    try {
      const supabase = createSupabaseServiceRoleClient();
      const h = await headers();

      // admin_sessions.admin_id references platform_admins.id, NOT
      // auth.users.id — the allowlist row is its own record.
      const { data: allowlisted } = await supabase
        .from("platform_admins")
        .select("id")
        .eq("user_id", userId)
        .eq("is_active", true)
        .maybeSingle();

      if (allowlisted) {
        const { data } = await supabase
          .from("admin_sessions")
          .insert({
            admin_id: allowlisted.id,
            ip: await clientIp(),
            user_agent: h.get("user-agent") ?? null,
            expires_at: expiresAt.toISOString(),
            last_seen: new Date().toISOString(),
          })
          .select("id")
          .single();

        sessionId = data?.id ?? null;

        await supabase.rpc("write_audit_log", {
          p_action: "admin_gate_unlocked",
          p_target_table: "admin_sessions",
          p_target_id: userId,
        });
      }
    } catch {
      // Recording the session is a nice-to-have; never block the login on it.
    }
  }

  // No database row to point at (anonymous unlock) still needs something
  // unguessable to sign.
  const value = sessionId ?? crypto.randomUUID();

  jar.set(COOKIE, `${value}.${sign(value)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/**
 * Is there a valid console session?
 *
 * Signature-only: a valid HMAC proves this server minted the cookie, which is
 * exactly what the password bought. No database round trip, so checking costs
 * nothing on every admin page load. The browser enforces expiry.
 */
export async function hasAdminSession(): Promise<boolean> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return false;

  const idx = raw.lastIndexOf(".");
  if (idx <= 0) return false;

  return safeEqual(raw.slice(idx + 1), sign(raw.slice(0, idx)));
}

/** Log out of the console. Leaves any normal user session alone. */
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
    // The cookie is gone either way; a stale row expires on its own.
  }
}
