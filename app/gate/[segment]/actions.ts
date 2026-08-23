"use server";

import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import {
  isAdminSegment,
  isAdminPassphrase,
  openAdminSession,
  closeAdminSession,
} from "@/lib/admin-gate";

/**
 * Unlock the admin console.
 *
 * Three things must all hold: the URL segment is right, the caller already
 * holds the superadmin role, and the passphrase matches. The role check comes
 * FIRST — someone who guessed the link and passphrase but has no role must not
 * get a session, and must not learn whether the passphrase was correct.
 */
export async function unlockAdmin(input: {
  segment: string;
  passphrase: string;
}): Promise<ActionResult> {
  if (!isAdminSegment(input.segment)) {
    return fail("That link isn't valid.");
  }

  const { user, isSuperadmin } = await getAuthContext();
  if (!user || !isSuperadmin) {
    // Same wording as a wrong passphrase: no oracle for either factor.
    return fail("That passphrase isn't right.");
  }

  if (!isAdminPassphrase(input.passphrase)) {
    return fail("That passphrase isn't right.");
  }

  await openAdminSession(user.id);
  return ok(undefined, "Console unlocked.");
}

/** End the gate session (leaves the normal login alone). */
export async function lockAdmin(): Promise<void> {
  await closeAdminSession();
  redirect("/");
}
