"use client";

/**
 * Community admin tools (ROADMAP 3.8) — owner-only.
 *
 * Announcements and community-scoped referral codes both existed in the
 * database, but the only composer lived in the superadmin console, so a
 * community owner had no way to use either. This is that surface.
 *
 * Scope is fixed to this community in both the UI and the server action: an
 * owner must never be able to announce platform-wide or mint a code that
 * discounts the whole store.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Megaphone, Ticket, Power } from "lucide-react";
import {
  postCommunityAnnouncement,
  createCommunityCode,
  deactivateCommunityCode,
} from "@/app/(public)/communities/admin-actions";
import { formatPaise, paise } from "@/lib/money";
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
import { cn } from "@/lib/utils";

export type CommunityCode = {
  id: string;
  code: string;
  discount_kind: "pct" | "flat";
  discount_value: number;
  max_uses: number | null;
  used_count: number;
  is_active: boolean;
};

export function CommunityAdminPanel({
  communityId,
  codes,
}: {
  communityId: string;
  codes: CommunityCode[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <AnnouncementBox communityId={communityId} />
      <CodesBox communityId={communityId} codes={codes} />
    </div>
  );
}

function AnnouncementBox({ communityId }: { communityId: string }) {
  const router = useRouter();
  const [level, setLevel] = useState<"info" | "warning" | "critical">("info");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await postCommunityAnnouncement({
        scope: "community",
        scope_id: communityId,
        title: String(formData.get("title") ?? ""),
        body: String(formData.get("body") ?? "") || undefined,
        level,
      });
      if (res.success) {
        setErrors({});
        toast.success(res.message);
        (
          document.getElementById("community-announce") as HTMLFormElement | null
        )?.reset();
        router.refresh();
      } else {
        setErrors(res.errors ?? {});
        toast.error(res.message);
      }
    });
  }

  return (
    <form
      id="community-announce"
      action={onSubmit}
      className="rounded-lg border border-line bg-surface/40 p-4"
    >
      <h3 className="flex items-center gap-2 font-display text-lg">
        <Megaphone className="size-4 text-crimson-400" />
        Announce to your community
      </h3>
      <p className="mt-1 text-sm text-text-muted">
        Shown to members at the top of the page while it&apos;s live.
      </p>

      <div className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ann-title">Title</Label>
          <Input
            id="ann-title"
            name="title"
            required
            maxLength={120}
            placeholder="Scrims moved to Sunday 9pm"
          />
          <FieldError message={errors.title} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ann-body">Details</Label>
          <Textarea id="ann-body" name="body" rows={3} maxLength={4000} />
          <FieldError message={errors.body} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ann-level">Severity</Label>
          <Select
            value={level}
            onValueChange={(v) => setLevel(v as typeof level)}
          >
            <SelectTrigger id="ann-level" className="max-w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button type="submit" variant="glow" className="mt-4" disabled={pending}>
        {pending ? "Posting…" : "Post announcement"}
      </Button>
    </form>
  );
}

function CodesBox({
  communityId,
  codes: initial,
}: {
  communityId: string;
  codes: CommunityCode[];
}) {
  const router = useRouter();
  const [codes, setCodes] = useState(initial);
  const [kind, setKind] = useState<"pct" | "flat">("pct");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    const maxUsesRaw = String(formData.get("max_uses") ?? "").trim();
    startTransition(async () => {
      const res = await createCommunityCode({
        community_id: communityId,
        code: String(formData.get("code") ?? ""),
        kind: "discount",
        discount_kind: kind,
        discount_value: Number(formData.get("discount_value") ?? 0),
        max_uses: maxUsesRaw === "" ? null : Number(maxUsesRaw),
        per_user_limit: 1,
      });
      if (res.success) {
        setErrors({});
        toast.success(res.message);
        (
          document.getElementById("community-code") as HTMLFormElement | null
        )?.reset();
        router.refresh();
      } else {
        setErrors(res.errors ?? {});
        toast.error(res.message);
      }
    });
  }

  function deactivate(id: string) {
    startTransition(async () => {
      const res = await deactivateCommunityCode({ code_id: id });
      if (res.success) {
        setCodes((list) =>
          list.map((c) => (c.id === id ? { ...c, is_active: false } : c)),
        );
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <div className="rounded-lg border border-line bg-surface/40 p-4">
      <h3 className="flex items-center gap-2 font-display text-lg">
        <Ticket className="size-4 text-crimson-400" />
        Discount codes
      </h3>
      <p className="mt-1 text-sm text-text-muted">
        Only valid on this community&apos;s events. A code is consumed when a
        payment actually lands, not at checkout.
      </p>

      <form
        id="community-code"
        action={onSubmit}
        className="mt-4 grid gap-3 sm:grid-cols-4"
      >
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="code">Code</Label>
          <Input
            id="code"
            name="code"
            required
            placeholder="SQUAD10"
            autoCapitalize="characters"
            spellCheck={false}
          />
          <FieldError message={errors.code} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="code-kind">Type</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
            <SelectTrigger id="code-kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pct">Percent off</SelectItem>
              <SelectItem value="flat">Flat ₹ off</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="discount_value">
            {kind === "pct" ? "Percent" : "Rupees"}
          </Label>
          <Input
            id="discount_value"
            name="discount_value"
            type="number"
            min={0}
            max={kind === "pct" ? 100 : undefined}
            step={kind === "pct" ? 1 : "0.01"}
            required
          />
          <FieldError message={errors.discount_value} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="max_uses">Max uses</Label>
          <Input
            id="max_uses"
            name="max_uses"
            type="number"
            min={1}
            placeholder="∞"
          />
          <FieldError message={errors.max_uses} />
        </div>

        <div className="flex items-end sm:col-span-3">
          <Button type="submit" variant="glow" disabled={pending}>
            Create code
          </Button>
        </div>
      </form>

      {codes.length > 0 ? (
        <ul className="mt-5 flex flex-col gap-2">
          {codes.map((c) => (
            <li
              key={c.id}
              className={cn(
                "flex flex-wrap items-center gap-3 rounded-md border border-line/70 bg-void/40 px-3 py-2",
                !c.is_active && "opacity-50",
              )}
            >
              <span className="font-mono text-sm font-semibold">{c.code}</span>
              <span className="text-sm text-text-muted">
                {c.discount_kind === "pct"
                  ? `${c.discount_value}% off`
                  : `${formatPaise(paise(Math.max(0, c.discount_value)), { compactWhole: true })} off`}
              </span>
              <span className="font-mono text-[11px] text-text-dim">
                {c.used_count}
                {c.max_uses ? ` / ${c.max_uses}` : ""} used
              </span>
              <span className="flex-1" />
              {c.is_active ? (
                <Button
                  size="xs"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => deactivate(c.id)}
                >
                  <Power className="size-3" />
                  Disable
                </Button>
              ) : (
                <span className="font-mono text-[10px] tracking-widest text-text-dim uppercase">
                  Disabled
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-text-muted">No codes yet.</p>
      )}
    </div>
  );
}
