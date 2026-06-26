import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/types";

/**
 * Session refresher used by the root `proxy.ts` (Next 16's renamed middleware).
 *
 * Supabase access tokens expire; this re-issues them on each request and writes
 * the refreshed cookies onto the response so Server Components downstream see a
 * valid session. Returns the response (possibly with updated cookies).
 *
 * IMPORTANT: do not run heavy logic here. Auth gating of specific routes is
 * done in layouts/server actions with RLS as the real backstop. This only keeps
 * the session fresh and can optionally redirect unauthenticated users away from
 * protected path prefixes.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh the session (also validates the JWT). Do not remove.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Route-prefix gating (cosmetic; RLS is the real gate). Unauthenticated
  // users hitting a protected area get bounced to /login.
  const protectedPrefixes = ["/profile", "/wallet", "/my-tournaments", "/dashboard"];
  const path = request.nextUrl.pathname;
  const needsAuth = protectedPrefixes.some((p) => path.startsWith(p));

  if (needsAuth && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  return response;
}
