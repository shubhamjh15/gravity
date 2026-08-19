"use client";

/**
 * Featured placements manager — curate which events/communities get a hype slot.
 *
 * Placements are unique per (kind, target), so adding an already-featured target
 * updates its reason/order instead of creating a duplicate; the server action
 * upserts on that pair.
 */
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Star, Trash2, Pause, Play } from "lucide-react";
import {
  setFeaturedPlacement,
  removeFeaturedPlacement,
} from "@/app/(admin)/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Kind = "event" | "community";
type Reason = "hype" | "deal" | "partner";

export type PlacementView = {
  id: string;
  kind: Kind;
  target_id: string;
  target_name: string;
  reason: Reason;
  sort_order: number;
  active: boolean;
};

export function FeaturedManager({
  placements: initial,
  events,
  communities,
}: {
  placements: PlacementView[];
  events: { id: string; title: string }[];
  communities: { id: string; name: string }[];
}) {
  const [placements, setPlacements] = useState(initial);
  const [kind, setKind] = useState<Kind>("event");
  const [targetId, setTargetId] = useState("");
  const [reason, setReason] = useState<Reason>("hype");
  const [sortOrder, setSortOrder] = useState("0");
  const [pending, startTransition] = useTransition();

  const targets =
    kind === "event"
      ? events.map((e) => ({ id: e.id, label: e.title }))
      : communities.map((c) => ({ id: c.id, label: c.name }));

  function add() {
    if (!targetId) {
      toast.error("Pick something to feature.");
      return;
    }
    const parsedOrder = Number.parseInt(sortOrder, 10);
    startTransition(async () => {
      const res = await setFeaturedPlacement({
        kind,
        target_id: targetId,
        reason,
        sort_order: Number.isFinite(parsedOrder) ? parsedOrder : 0,
        active: true,
      });
      if (res.success) {
        toast.success(res.message);
        // The server revalidates; reflect it locally so the list updates now.
        const label = targets.find((t) => t.id === targetId)?.label ?? "Unknown";
        setPlacements((list) => {
          const rest = list.filter(
            (p) => !(p.kind === kind && p.target_id === targetId),
          );
          return [
            ...rest,
            {
              id: `${kind}:${targetId}`,
              kind,
              target_id: targetId,
              target_name: label,
              reason,
              sort_order: Number.isFinite(parsedOrder) ? parsedOrder : 0,
              active: true,
            },
          ].sort((a, b) => a.sort_order - b.sort_order);
        });
        setTargetId("");
      } else {
        toast.error(res.message);
      }
    });
  }

  function toggleActive(p: PlacementView) {
    startTransition(async () => {
      const res = await setFeaturedPlacement({
        kind: p.kind,
        target_id: p.target_id,
        reason: p.reason,
        sort_order: p.sort_order,
        active: !p.active,
      });
      if (res.success) {
        setPlacements((list) =>
          list.map((x) => (x.id === p.id ? { ...x, active: !x.active } : x)),
        );
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    });
  }

  function remove(p: PlacementView) {
    startTransition(async () => {
      const res = await removeFeaturedPlacement({ placement_id: p.id });
      if (res.success) {
        setPlacements((list) => list.filter((x) => x.id !== p.id));
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <div className="rounded-xl border border-line bg-[image:var(--gv-grad-surface)] p-5">
      <div className="flex items-center gap-2">
        <Star className="size-4 text-crimson-400" />
        <h2 className="font-display text-lg tracking-tight">Featured placements</h2>
      </div>
      <p className="mt-1 text-sm text-text-muted">
        Curated slots on the landing page and listings. Lower sort order shows first.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="f-kind">Type</Label>
          <Select
            value={kind}
            onValueChange={(v) => {
              setKind(v as Kind);
              setTargetId("");
            }}
          >
            <SelectTrigger id="f-kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="event">Tournament</SelectItem>
              <SelectItem value="community">Community</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="f-target">Target</Label>
          <Select value={targetId} onValueChange={setTargetId}>
            <SelectTrigger id="f-target">
              <SelectValue placeholder={`Choose a ${kind}`} />
            </SelectTrigger>
            <SelectContent>
              {targets.length === 0 ? (
                <SelectItem value="__none" disabled>
                  Nothing to feature yet
                </SelectItem>
              ) : (
                targets.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="f-order">Sort order</Label>
          <Input
            id="f-order"
            type="number"
            min={0}
            max={999}
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="f-reason">Reason</Label>
          <Select value={reason} onValueChange={(v) => setReason(v as Reason)}>
            <SelectTrigger id="f-reason">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hype">Hype</SelectItem>
              <SelectItem value="deal">Deal</SelectItem>
              <SelectItem value="partner">Partner</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end sm:col-span-3">
          <Button variant="glow" disabled={pending} onClick={add}>
            <Star className="size-3.5" />
            Feature it
          </Button>
        </div>
      </div>

      <div className="mt-6">
        {placements.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line py-8 text-center text-sm text-text-muted">
            Nothing is featured right now.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {placements.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-lg border border-line bg-surface/40 px-4 py-2.5"
              >
                <span className="font-mono text-[10px] tracking-widest text-text-dim uppercase">
                  {p.kind}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {p.target_name}
                </span>
                <span className="rounded-full border border-crimson-700/40 bg-crimson-500/10 px-2 py-0.5 text-[10px] text-crimson-300 capitalize">
                  {p.reason}
                </span>
                <span className="font-mono text-xs text-text-dim">#{p.sort_order}</span>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  disabled={pending}
                  aria-label={p.active ? "Pause placement" : "Resume placement"}
                  onClick={() => toggleActive(p)}
                >
                  {p.active ? <Pause /> : <Play />}
                </Button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  disabled={pending}
                  aria-label="Remove placement"
                  onClick={() => remove(p)}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
