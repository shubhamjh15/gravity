import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { UserRow } from "@/components/gravity/admin/user-row";

export const metadata: Metadata = { title: "Users & Roles", robots: { index: false } };

type Role = "player" | "organizer" | "superadmin";

export default async function AdminUsersPage() {
  const supabase = await createSupabaseServerClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, email")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);

  const ids = (profiles ?? []).map((p) => p.id);
  const { data: roleRows } = ids.length
    ? await supabase.from("user_roles").select("user_id, role").in("user_id", ids)
    : { data: [] as { user_id: string; role: string }[] };

  const rolesFor = (uid: string): Role[] =>
    (roleRows ?? [])
      .filter((r) => r.user_id === uid)
      .map((r) => r.role as Role);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-3xl tracking-tight">Users &amp; Roles</h1>
      <p className="mt-1 text-sm text-text-muted">
        Promote players to organizers, or grant admin access. Every change is
        audited.
      </p>

      <div className="mt-8 overflow-hidden rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-2/60 text-left font-mono text-[10px] tracking-widest text-text-dim uppercase">
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Roles</th>
              <th className="px-4 py-3 text-right">Manage</th>
            </tr>
          </thead>
          <tbody>
            {(profiles ?? []).map((p) => (
              <UserRow
                key={p.id}
                userId={p.id}
                name={p.display_name ?? "Player"}
                email={p.email ?? "—"}
                roles={rolesFor(p.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
