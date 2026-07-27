import "server-only";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { User } from "@supabase/supabase-js";

/**
 * `typedRoutes` makes redirect() want a known route literal, but these targets
 * are built dynamically (with a ?next= return path). This thin wrapper keeps
 * the dynamic-string ergonomics without sprinkling casts everywhere.
 * `redirect` accepts any string at runtime; the cast satisfies typed-routes.
 */
function redirectTo(path: string): never {
  redirect(path as Parameters<typeof redirect>[0]);
}

/**
 * Server-side auth + role helpers. RLS is the real security gate; these are for
 * ergonomics and UX (redirects, conditional UI). Never trust a role check on
 * the client.
 *
 * Roles live in `user_roles` (#2). We read them with the RLS-scoped server
 * client, which can always see the current user's own roles.
 */

export type Role = "player" | "organizer" | "superadmin";

/** The logged-in user, or null. Returns null when Supabase isn't configured. */
export async function getUser(): Promise<User | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Require a logged-in user or redirect to /login (with a return path). */
export async function requireUser(nextPath = "/"): Promise<User> {
  const user = await getUser();
  if (!user) {
    redirectTo(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  return user;
}

/** All roles held by the current user (empty if logged out). */
export async function getRoles(): Promise<Role[]> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (error || !data) return [];
  return data.map((r) => r.role as Role);
}

export async function hasRole(role: Role): Promise<boolean> {
  const roles = await getRoles();
  return roles.includes(role);
}

export async function isSuperadmin(): Promise<boolean> {
  return hasRole("superadmin");
}

export async function isOrganizer(): Promise<boolean> {
  return hasRole("organizer");
}

/** Require a specific role or redirect (default: home). Returns the user. */
export async function requireRole(
  role: Role,
  redirectPath = "/",
): Promise<User> {
  const user = await requireUser();
  const roles = await getRoles();
  if (!roles.includes(role)) {
    redirectTo(redirectPath);
  }
  return user;
}

/**
 * Bundle commonly-needed auth context in one call for a page/layout:
 * the user + their roles + boolean shortcuts.
 */
export async function getAuthContext() {
  if (!isSupabaseConfigured()) {
    return {
      user: null,
      roles: [] as Role[],
      isSuperadmin: false,
      isOrganizer: false,
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      user: null,
      roles: [] as Role[],
      isSuperadmin: false,
      isOrganizer: false,
    };
  }

  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  const roles = (data ?? []).map((r) => r.role as Role);
  return {
    user,
    roles,
    isSuperadmin: roles.includes("superadmin"),
    isOrganizer: roles.includes("organizer"),
  };
}
