import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Google OAuth callback. Supabase redirects here with a `code` after the user
 * authorizes. We exchange it for a session (sets the auth cookies) and bounce
 * to the `next` path (defaults to the profile/home).
 *
 * NEXT 16: searchParams on the request URL are read synchronously off
 * `request.nextUrl` (this is a Route Handler, not a page component).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/profile";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Something went wrong — send them back to login with a flag.
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
