"use client";

/**
 * Admin user row — roles with grant/revoke controls, plus an audited PII reveal.
 *
 * PII (UPI / phone / gov-ID type) is NEVER in this page's initial payload. It
 * is fetched on an explicit click through reveal_player_pii(), which re-checks
 * superadmin in the database and writes an audit_log row before returning
 * anything (#6). The button says so, because someone should know their lookup
 * is on record before they make it.
 */
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Shield, ShieldOff, Eye, EyeOff } from "lucide-react";
import {
  grantRole,
  revokeRole,
  revealPlayerPii,
  type RevealedPii,
} from "@/app/(admin)/admin/actions";
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
  const [pii, setPii] = useState<RevealedPii | null>(null);
  const [pending, startTransition] = useTransition();

  function togglePii() {
    if (pii) {
      setPii(null);
      return;
    }
    startTransition(async () => {
      const res = await revealPlayerPii({
        user_id: userId,
        reason: "admin_directory_lookup",
      });
      if (res.success) {
        setPii(res.data);
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    });
  }

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
        {pii ? (
          <dl className="mt-2 grid gap-x-3 gap-y-0.5 border-l-2 border-crimson-700/50 pl-2 font-mono text-[11px] sm:grid-cols-[auto_1fr]">
            <dt className="text-text-dim">UPI</dt>
            <dd>{pii.upi_id ?? "—"}</dd>
            <dt className="text-text-dim">Phone</dt>
            <dd>{pii.phone ?? "—"}</dd>
            <dt className="text-text-dim">Gov ID</dt>
            <dd>
              {pii.gov_id_type ?? "—"}
              {pii.kyc_status ? ` · ${pii.kyc_status}` : ""}
            </dd>
          </dl>
        ) : null}
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
            variant="ghost"
            disabled={pending}
            onClick={togglePii}
            title={
              pii
                ? "Hide details"
                : "Reveal UPI / phone / gov-ID — this lookup is logged"
            }
          >
            {pii ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
            {pii ? "Hide" : "Reveal"}
          </Button>
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
