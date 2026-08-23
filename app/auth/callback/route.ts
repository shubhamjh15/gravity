import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/validators/auth";
import { landingPathForRoles, type Role } from "@/lib/auth";

/**
 * The single auth landing point. Three kinds of link arrive here:
 *
 *   1. OAuth (Google)      — `?code=…`, exchanged for a session.
 *   2. Email confirmation  — `?token_hash=…&type=signup`, verified as an OTP.
 *   3. Password recovery   — `?token_hash=…&type=recovery`, same, then the user
 *                            is sent to /update-password to set a new one.
 *
 * Handling all three in one route matters because Supabase's email templates
 * point at whatever redirect URL we register; a callback that only understood
 * `code` would silently drop every confirmation and reset link.
 *
 * NEXT 16: searchParams are read synchronously off `request.nextUrl` (this is a
 * Route Handler, not a page component).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  // Never redirect anywhere but our own site — `next` comes from a query string.
  const next = safeNextPath(searchParams.get("next"));

  // Supabase reports provider-side failures on the query string (e.g. the user
  // hit "cancel" on Google's consent screen).
  const providerError =
    searchParams.get("error_description") ?? searchParams.get("error");
  if (providerError) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(providerError)}`,
    );
  }

  const supabase = await createSupabaseServerClient();

  let verified = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    verified = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    verified = !error;
  }

  if (!verified) {
    return NextResponse.redirect(`${origin}/login?error=link`);
  }

  // A recovery link must land on the form that sets a new password, whatever
  // `next` says — otherwise the user is silently signed in with a password they
  // can't remember and never gets the chance to change it.
  if (type === "recovery") {
    return NextResponse.redirect(`${origin}/update-password`);
  }

  if (next) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  // No explicit destination: send them where their roles belong.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=session`);
  }

  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  const landing = landingPathForRoles(
    (roleRows ?? []).map((r) => r.role as Role),
  );

  return NextResponse.redirect(`${origin}${landing}`);
}
