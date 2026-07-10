"use client";

/**
 * Admin user row — shows a user + their roles with grant/revoke controls.
 * Reveals PII (email) is already visible to superadmin via RLS; this is the
 * audited management surface.
 */
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Shield, ShieldOff } from "lucide-react";
import { grantRole, revokeRole } from "@/app/(admin)/admin/actions";
import { Button } from "@/components/ui/button";

type Role = "player" | "organizer" | "superadmin";

export function UserRow({
  userId,
  name,
  email,
  roles: initialRoles,
}: {
  userId: string;
  name: string;
  email: string;
  roles: Role[];
}) {
  const [roles, setRoles] = useState<Role[]>(initialRoles);
  const [pending, startTransition] = useTransition();

  function toggle(role: Role) {
    const has = roles.includes(role);
    startTransition(async () => {
      const res = has
        ? await revokeRole({ user_id: userId, role })
        : await grantRole({ user_id: userId, role });
      if (res.success) {
        setRoles((r) => (has ? r.filter((x) => x !== role) : [...r, role]));
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <tr className="border-b border-line/50 last:border-0">
      <td className="px-4 py-3">
        <p className="font-medium">{name}</p>
        <p className="font-mono text-xs text-text-dim">{email}</p>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {roles.map((r) => (
            <span
              key={r}
              className="rounded-full border border-crimson-700/40 bg-crimson-500/10 px-2 py-0.5 text-[10px] text-crimson-300 capitalize"
            >
              {r}
            </span>
          ))}
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-2">
          <Button
            size="xs"
            variant={roles.includes("organizer") ? "outline" : "glow"}
            disabled={pending}
            onClick={() => toggle("organizer")}
          >
            {roles.includes("organizer") ? <ShieldOff className="size-3" /> : <Shield className="size-3" />}
            Organizer
          </Button>
          <Button
            size="xs"
            variant={roles.includes("superadmin") ? "outline" : "ghost"}
            disabled={pending}
            onClick={() => toggle("superadmin")}
          >
            Admin
          </Button>
        </div>
      </td>
    </tr>
  );
}
