"use client";

/**
 * One announcement in the admin table, with a retire control.
 *
 * "Retire" is a soft delete (deleted_at) — business data is never hard-deleted.
 * The row stays visible, greyed, so an admin can see what was taken down.
 */
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Archive, Globe, Users } from "lucide-react";
import { retireAnnouncement } from "@/app/(admin)/admin/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LEVEL_CHIP = {
  info: "border-line text-text-muted",
  warning: "border-warning/40 bg-warning/10 text-warning",
  critical: "border-danger/50 bg-danger/10 text-danger",
} as const;

export function AnnouncementRow({
  id,
  title,
  body,
  scope,
  scopeLabel,
  level,
  activeFrom,
  activeTo,
  retired: initialRetired,
}: {
  id: string;
  title: string;
  body: string | null;
  scope: "global" | "community" | "event";
  scopeLabel: string;
  level: "info" | "warning" | "critical";
  activeFrom: string;
  activeTo: string | null;
  retired: boolean;
}) {
  const [retired, setRetired] = useState(initialRetired);
  const [pending, startTransition] = useTransition();

  const now = Date.now();
  const started = new Date(activeFrom).getTime() <= now;
  const ended = activeTo ? new Date(activeTo).getTime() <= now : false;
  const state = retired
    ? "Retired"
    : !started
      ? "Scheduled"
      : ended
        ? "Expired"
        : "Live";

  function retire() {
    startTransition(async () => {
      const res = await retireAnnouncement({ announcement_id: id });
      if (res.success) {
        setRetired(true);
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <div
      className={cn(
        "flex items-start gap-4 rounded-lg border border-line bg-surface/40 p-4",
        retired && "opacity-50",
      )}
    >
      {scope === "global" ? (
        <Globe className="mt-0.5 size-4 shrink-0 text-text-dim" />
      ) : (
        <Users className="mt-0.5 size-4 shrink-0 text-text-dim" />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{title}</p>
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[10px] capitalize",
              LEVEL_CHIP[level],
            )}
          >
            {level}
          </span>
          <span className="font-mono text-[10px] tracking-widest text-text-dim uppercase">
            {state}
          </span>
        </div>
        {body ? (
          <p className="mt-1 line-clamp-2 text-sm text-text-muted">{body}</p>
        ) : null}
        <p className="mt-1 font-mono text-[11px] text-text-dim">
          {scopeLabel}
          {activeTo ? ` · until ${new Date(activeTo).toLocaleString("en-IN")}` : ""}
        </p>
      </div>

      {!retired ? (
        <Button size="xs" variant="outline" disabled={pending} onClick={retire}>
          <Archive className="size-3" />
          Retire
        </Button>
      ) : null}
    </div>
  );
}
