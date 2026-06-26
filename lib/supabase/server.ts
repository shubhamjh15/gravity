import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/supabase/types";

/**
 * Server-side Supabase client (RLS-enforced, acts as the logged-in user).
 *
 * NEXT 16: `cookies()` is async — we MUST await it. This client is for Server
 * Components, Server Actions, and Route Handlers. It respects RLS, so it can
 * only see what the current user is allowed to see.
 *
 * In a Server Component (read-only context) cookie writes are not allowed;
 * we swallow the write error there. Session refresh happens in proxy.ts.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component where cookies are read-only.
            // proxy.ts handles refreshing the session cookie; safe to ignore.
          }
        },
      },
    },
  );
}

/**
 * Service-role client — BYPASSES RLS. Use ONLY in trusted server code for
 * privileged operations that must transcend a single user's row visibility
 * (e.g. the Razorpay webhook writing ledger rows, admin tooling).
 *
 * NEVER import this into a Client Component. The service-role key must never
 * reach the browser. Prefer SECURITY DEFINER RPCs over broad service-role use.
 */
export function createSupabaseServiceRoleClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set — service-role client unavailable.",
    );
  }
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
    {
      // No cookie session for the service role; it is not a user.
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          /* no-op */
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
