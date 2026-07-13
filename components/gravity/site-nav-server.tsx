import { getAuthContext } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import { SiteNav } from "./site-nav";
import { NotificationBell } from "./notification-bell";
import { UserMenu } from "./user-menu";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Server wrapper for the nav: resolves auth + roles and injects the logged-in
 * controls (notification bell + user menu) into the client SiteNav. When logged
 * out, SiteNav falls back to the login buttons.
 */
function avatarUrl(path: string | null): string | null {
  if (!path || !publicEnv.supabaseUrl) return null;
  return `${publicEnv.supabaseUrl}/storage/v1/object/public/avatars/${path}`;
}

export async function SiteNavServer() {
  const { user, isOrganizer, isSuperadmin } = await getAuthContext();

  if (!user) {
    return <SiteNav />;
  }

  // Resolve display name + avatar from the profile.
  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_path")
    .eq("id", user.id)
    .maybeSingle();

  const name = profile?.display_name ?? user.email ?? "Player";

  return (
    <SiteNav
      authSlot={
        <div className="flex items-center gap-2">
          <NotificationBell userId={user.id} />
          <UserMenu
            name={name}
            avatarUrl={avatarUrl(profile?.avatar_path ?? null)}
            isOrganizer={isOrganizer}
            isSuperadmin={isSuperadmin}
          />
        </div>
      }
    />
  );
}
