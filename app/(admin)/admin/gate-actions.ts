"use server";

import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import {
  checkAdminPassword,
  openAdminSession,
  closeAdminSession,
} from "@/lib/admin-gate";

/** Log in to the console with the shared admin password. */
export async function unlockAdmin(input: {
  password: string;
}): Promise<ActionResult> {
  const result = await checkAdminPassword(input.password);

  if (!result.ok) {
    if (result.lockedFor) {
      const mins = Math.ceil(result.lockedFor / 60);
      return fail(`Too many attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`);
    }
    return fail("Wrong password.");
  }

  // If they happen to be signed in, tie the session to their allowlist row so
  // it lands in the audit trail. Not required to get in.
  const user = await getUser();
  await openAdminSession(user?.id);

  return ok(undefined, "Welcome to the control room.");
}

export async function lockAdmin(): Promise<void> {
  await closeAdminSession();
  redirect("/");
}
