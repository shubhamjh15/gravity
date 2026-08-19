"use client";

/**
 * Turns the `?error=` the auth callback sets into something a person can act on.
 *
 * The callback can only pass a short code through a redirect, so the mapping to
 * wording lives here. Anything unrecognised falls back to a generic line rather
 * than printing a raw provider string at the user.
 */
import { useSearchParams } from "next/navigation";
import { TriangleAlert } from "lucide-react";

const MESSAGES: Record<string, string> = {
  auth: "That sign-in didn't complete. Please try again.",
  link: "That link has expired or was already used. Request a new one.",
  session: "We couldn't start your session. Please try signing in again.",
  access_denied: "You cancelled the sign-in — no harm done.",
};

export function AuthErrorNotice() {
  const error = useSearchParams().get("error");
  if (!error) return null;

  const message =
    MESSAGES[error] ??
    // Provider errors arrive as a human-readable description; show it if it
    // looks like prose, otherwise stay generic.
    (/^[\w\s.,'’-]{8,140}$/.test(error)
      ? error
      : "Something went wrong signing you in. Please try again.");

  return (
    <div
      role="alert"
      className="mt-6 flex items-start gap-2.5 rounded-lg border border-danger/40 bg-danger/10 px-3.5 py-3"
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
