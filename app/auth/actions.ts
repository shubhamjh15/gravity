"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ok, fail, zodErrors, type ActionResult } from "@/lib/action-result";
import {
  signUpSchema,
  signInSchema,
  resetRequestSchema,
  updatePasswordSchema,
  safeNextPath,
} from "@/lib/validators/auth";
import { landingPathForRoles, type Role } from "@/lib/auth";

/**
 * Email + OAuth auth actions.
 *
 * Both paths land the same way: Supabase Auth creates the `auth.users` row and
 * the `handle_new_user` trigger creates the profile, the private-PII row, the
 * default `player` role and the stats shell. Roles are NEVER set here — that
 * would be a self-granted role, which #2 forbids.
 */

/** Sign the current user out and return home. */
export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}

/** Absolute origin for links in Supabase's emails. */
async function getOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");

  // Fall back to the request's own host so a preview deployment still sends
  // links that point at itself.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

async function landingForCurrentUser(): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "/profile";

  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  return landingPathForRoles((data ?? []).map((r) => r.role as Role));
}

// ---------------------------------------------------------------------------
// Email + password
// ---------------------------------------------------------------------------

export type SignUpResult = { needsConfirmation: boolean; redirectTo: string };

/**
 * Create an account with email + password.
 *
 * If the project requires email confirmation (Supabase's default) no session
 * exists yet and the user must click the emailed link — the UI says so rather
 * than pretending they're signed in.
 */
export async function signUpWithEmail(
  input: unknown,
): Promise<ActionResult<SignUpResult>> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", zodErrors(parsed.error.issues));
  }
  const { email, password, display_name } = parsed.data;
  const next = safeNextPath(parsed.data.next);

  const supabase = await createSupabaseServerClient();
  const origin = await getOrigin();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // handle_new_user reads full_name out of raw_user_meta_data, so the name
      // typed here becomes the profile display name — same as Google gives us.
      data: { full_name: display_name },
      emailRedirectTo: `${origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`,
    },
  });

  if (error) {
    // Supabase returns a clear message for a weak/duplicate password; anything
    // else stays generic so we don't narrate internals to the browser.
    if (/already registered|already exists/i.test(error.message)) {
      return fail(
        "An account with that email already exists. Try signing in instead.",
        { email: "This email is already registered." },
      );
    }
    if (/password/i.test(error.message)) {
      return fail(error.message, { password: error.message });
    }
    return fail("Could not create your account. Please try again.");
  }

  // A confirmed-instantly project returns a session; otherwise it doesn't.
  const needsConfirmation = !data.session;

  return ok(
    {
      needsConfirmation,
      redirectTo: needsConfirmation ? "/login" : (next ?? (await landingForCurrentUser())),
    },
    needsConfirmation
      ? "Check your email to confirm your account."
      : "Welcome to GRAVITY.",
  );
}

/** Sign in with email + password. */
export async function signInWithEmail(
  input: unknown,
): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", zodErrors(parsed.error.issues));
  }
  const { email, password } = parsed.data;
  const next = safeNextPath(parsed.data.next);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (/email not confirmed/i.test(error.message)) {
      return fail(
        "Confirm your email first — check your inbox for the link.",
        { email: "This address hasn't been confirmed yet." },
      );
    }
    // One message for both "no such account" and "wrong password": saying which
    // is which lets anyone test whether an email is registered here.
    return fail("That email or password isn't right.");
  }

  return ok({ redirectTo: next ?? (await landingForCurrentUser()) }, "Welcome back.");
}

/** Re-send the confirmation email. */
export async function resendConfirmation(input: {
  email: string;
}): Promise<ActionResult> {
  const parsed = resetRequestSchema.safeParse(input);
  if (!parsed.success) return fail("Enter a valid email address.");

  const supabase = await createSupabaseServerClient();
  const origin = await getOrigin();

  await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  // Always the same answer — see requestPasswordReset.
  return ok(undefined, "If that account needs confirming, the email is on its way.");
}

// ---------------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------------

/**
 * Send a reset link.
 *
 * The response is identical whether or not the address exists. Anything that
 * differs — wording, or even timing — turns this into an account-enumeration
 * oracle, which matters more than usual on a platform where an account is tied
 * to a UPI payout target.
 */
export async function requestPasswordReset(
  input: unknown,
): Promise<ActionResult> {
  const parsed = resetRequestSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Enter a valid email address.", zodErrors(parsed.error.issues));
  }

  const supabase = await createSupabaseServerClient();
  const origin = await getOrigin();

  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/update-password`,
  });

  return ok(
    undefined,
    "If an account exists for that email, a reset link is on its way.",
  );
}

/**
 * Set a new password. Requires the recovery session the emailed link created,
 * so this can't be called by someone who merely knows an email address.
 */
export async function updatePassword(input: unknown): Promise<ActionResult> {
  const parsed = updatePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", zodErrors(parsed.error.issues));
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return fail("That reset link has expired. Request a new one.");
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    return fail(
      /should be different/i.test(error.message)
        ? "Pick a password you haven't used here before."
        : "Could not update your password. Try requesting a new link.",
    );
  }

  return ok(undefined, "Password updated. You're signed in.");
}
