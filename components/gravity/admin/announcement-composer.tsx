"use client";

/**
 * Announcement composer — publishes a global or community-scoped notice.
 *
 * Scope drives which extra field appears: a global announcement has no target,
 * a community one needs a community picked from the list the server passed in.
 * That mirrors the DB CHECK (announcements_scope_target) so the form can't
 * submit a shape the database will reject.
 */
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Megaphone } from "lucide-react";
import { createAnnouncement } from "@/app/(admin)/admin/actions";
import { FieldError } from "@/components/gravity/profile/field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Scope = "global" | "community";
type Level = "info" | "warning" | "critical";

export function AnnouncementComposer({
  communities,
}: {
  communities: { id: string; name: string }[];
}) {
  const [scope, setScope] = useState<Scope>("global");
  const [scopeId, setScopeId] = useState<string>("");
  const [level, setLevel] = useState<Level>("info");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    const title = String(formData.get("title") ?? "");
    const body = String(formData.get("body") ?? "");
    const activeTo = String(formData.get("active_to") ?? "");

    startTransition(async () => {
      const res = await createAnnouncement({
        scope,
        scope_id: scope === "global" ? null : scopeId || null,
        title,
        body: body || undefined,
        level,
        // datetime-local gives a local wall-clock string; send a real instant.
        active_to: activeTo ? new Date(activeTo).toISOString() : null,
      });

      if (res.success) {
        setErrors({});
        toast.success(res.message);
        // Reset so the next notice starts clean.
        setScopeId("");
        setLevel("info");
        (document.getElementById("announcement-form") as HTMLFormElement | null)?.reset();
      } else {
        setErrors(res.errors ?? {});
        toast.error(res.message);
      }
    });
  }

  return (
    <form
      id="announcement-form"
      action={onSubmit}
      className="rounded-xl border border-line bg-[image:var(--gv-grad-surface)] p-5"
    >
      <div className="flex items-center gap-2">
        <Megaphone className="size-4 text-crimson-400" />
        <h2 className="font-display text-lg tracking-tight">New announcement</h2>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="scope">Scope</Label>
          <Select value={scope} onValueChange={(v) => setScope(v as Scope)}>
            <SelectTrigger id="scope">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="global">Everyone (global)</SelectItem>
              <SelectItem value="community">A single community</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="level">Severity</Label>
          <Select value={level} onValueChange={(v) => setLevel(v as Level)}>
            <SelectTrigger id="level">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {scope === "community" ? (
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="scope_id">Community</Label>
            {communities.length === 0 ? (
              <p className="text-sm text-text-muted">
                No communities exist yet — create one before targeting it.
              </p>
            ) : (
              <Select value={scopeId} onValueChange={setScopeId}>
                <SelectTrigger id="scope_id">
                  <SelectValue placeholder="Choose a community" />
                </SelectTrigger>
                <SelectContent>
                  {communities.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <FieldError message={errors.scope_id} />
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            name="title"
            required
            maxLength={120}
            placeholder="Scheduled maintenance on Sunday"
          />
          <FieldError message={errors.title} />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="body">Details</Label>
          <Textarea
            id="body"
            name="body"
            rows={3}
            maxLength={4000}
            placeholder="Payouts may be delayed by a few hours while we upgrade."
          />
          <FieldError message={errors.body} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="active_to">Hide after (optional)</Label>
          <Input id="active_to" name="active_to" type="datetime-local" />
          <FieldError message={errors.active_to} />
          <p className="text-xs text-text-dim">
            Leave empty to keep it up until you retire it.
          </p>
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <Button type="submit" variant="glow" disabled={pending}>
          {pending ? "Publishing…" : "Publish announcement"}
        </Button>
      </div>
    </form>
  );
}
