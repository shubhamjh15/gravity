"use client";

/**
 * Event create form (organizer). Builds the full tournament + prize structure
 * with a LIVE pool-validation indicator: as the organizer types prizes, we show
 * in real time whether the split equals the collected pool (using the same
 * money rules as the server). Publishing is blocked client-side until it
 * balances (the server re-validates regardless).
 */
import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Check, AlertTriangle } from "lucide-react";
import { createEvent } from "@/app/(organizer)/dashboard/event-actions";
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
import { FieldError } from "@/components/gravity/profile/field-error";

type Game = { id: string; name: string };
type RankPrize = { rank: number; amount: number };

export function EventCreateForm({ games }: { games: Game[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  // core
  const [title, setTitle] = useState("");
  const [gameId, setGameId] = useState("");
  const [maxSlots, setMaxSlots] = useState(50);
  const [entryFee, setEntryFee] = useState(40);
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState("");
  const [dos, setDos] = useState("");

  // prize structure (rupees)
  const [rankPrizes, setRankPrizes] = useState<RankPrize[]>([
    { rank: 1, amount: 700 },
    { rank: 2, amount: 300 },
    { rank: 3, amount: 100 },
  ]);
  const [perKill, setPerKill] = useState(10);
  const [killCap, setKillCap] = useState(490);
  const [adminCut, setAdminCut] = useState(110);
  const [organizerProfit, setOrganizerProfit] = useState(300);
  const [fillPolicy, setFillPolicy] = useState<"scale_down" | "guaranteed">("scale_down");
  const [killSurplus, setKillSurplus] = useState<
    "to_organizer" | "to_admin" | "to_prize" | "destroy"
  >("to_organizer");

  // Live validation: committed total vs full pool (rupees).
  const validation = useMemo(() => {
    const pool = entryFee * maxSlots;
    const ranks = rankPrizes.reduce((s, r) => s + (r.amount || 0), 0);
    const committed = ranks + killCap + adminCut + organizerProfit;
    const delta = Math.round((committed - pool) * 100) / 100;
    return { pool, committed, delta, ok: delta === 0, free: entryFee === 0 };
  }, [entryFee, maxSlots, rankPrizes, killCap, adminCut, organizerProfit]);

  function addRank() {
    const nextRank = (rankPrizes[rankPrizes.length - 1]?.rank ?? 0) + 1;
    setRankPrizes([...rankPrizes, { rank: nextRank, amount: 0 }]);
  }
  function removeRank(i: number) {
    setRankPrizes(rankPrizes.filter((_, idx) => idx !== i));
  }
  function updateRank(i: number, amount: number) {
    setRankPrizes(rankPrizes.map((r, idx) => (idx === i ? { ...r, amount } : r)));
  }

  function submit(publish: boolean) {
    setErrors({});
    if (!gameId) {
      setErrors({ game_id: "Pick a game." });
      return;
    }
    if (publish && !validation.free && !validation.ok) {
      toast.error(
        `Prize split is off by ₹${Math.abs(validation.delta)}. Balance it before publishing.`,
      );
      return;
    }

    const input = {
      title,
      game_id: gameId,
      description: description || undefined,
      rules: rules || undefined,
      dos_and_donts: dos || undefined,
      visibility: "public" as const,
      requires_approval: false,
      gov_id_required: false,
      max_slots: maxSlots,
      entry_fee_rupees: entryFee,
      registration_fields: [],
      rank_prizes_rupees: rankPrizes,
      per_kill_rupees: perKill,
      kill_budget_cap_rupees: killCap,
      admin_cut_rupees: adminCut,
      organizer_profit_rupees: organizerProfit,
      fill_policy: fillPolicy,
      kill_surplus_policy: killSurplus,
    };

    startTransition(async () => {
      const res = await createEvent(input, { publish });
      if (res.success) {
        toast.success(res.message);
        router.push(`/events/${res.data.slug}` as never);
      } else {
        if (res.errors) setErrors(res.errors);
        toast.error(res.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Basics */}
      <Card title="Tournament basics">
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Friday Night Free Fire Showdown"
            />
            <FieldError message={errors.title} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label>Game</Label>
              <Select value={gameId} onValueChange={setGameId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {games.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={errors.game_id} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="slots">Max slots</Label>
              <Input
                id="slots"
                type="number"
                min={2}
                value={maxSlots}
                onChange={(e) => setMaxSlots(Number(e.target.value) || 0)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="fee">Entry fee (₹)</Label>
              <Input
                id="fee"
                type="number"
                min={0}
                value={entryFee}
                onChange={(e) => setEntryFee(Number(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="desc">Description</Label>
            <Textarea
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this tournament about?"
              rows={3}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="rules">Rules</Label>
              <Textarea id="rules" value={rules} onChange={(e) => setRules(e.target.value)} rows={4} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dos">Do&apos;s &amp; Don&apos;ts</Label>
              <Textarea id="dos" value={dos} onChange={(e) => setDos(e.target.value)} rows={4} />
            </div>
          </div>
        </div>
      </Card>

      {/* Prize structure */}
      <Card title="Prize structure">
        <div className="grid gap-5">
          {/* rank prizes */}
          <div>
            <Label>Rank prizes (₹)</Label>
            <div className="mt-2 flex flex-col gap-2">
              {rankPrizes.map((rp, i) => (
                <div key={rp.rank} className="flex items-center gap-2">
                  <span className="w-16 font-mono text-sm text-text-muted">
                    #{rp.rank}
                  </span>
                  <Input
                    type="number"
                    min={0}
                    value={rp.amount}
                    onChange={(e) => updateRank(i, Number(e.target.value) || 0)}
                    className="flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => removeRank(i)}
                    className="rounded-md border border-line p-2 text-text-dim hover:border-danger hover:text-danger"
                    aria-label="Remove rank"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addRank} className="mt-2">
              <Plus className="size-4" /> Add rank
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <NumberField label="Per kill (₹)" value={perKill} onChange={setPerKill} />
            <NumberField label="Kill budget cap (₹)" value={killCap} onChange={setKillCap} />
            <NumberField label="Platform cut (₹)" value={adminCut} onChange={setAdminCut} />
            <NumberField label="Your profit (₹)" value={organizerProfit} onChange={setOrganizerProfit} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Under-fill policy</Label>
              <Select value={fillPolicy} onValueChange={(v) => setFillPolicy(v as typeof fillPolicy)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scale_down">Scale prizes down</SelectItem>
                  <SelectItem value="guaranteed">Guaranteed prizes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Leftover kill budget</Label>
              <Select value={killSurplus} onValueChange={(v) => setKillSurplus(v as typeof killSurplus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="to_organizer">To organizer</SelectItem>
                  <SelectItem value="to_admin">To platform</SelectItem>
                  <SelectItem value="to_prize">To top prize</SelectItem>
                  <SelectItem value="destroy">Keep in pool</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* live validation */}
          {!validation.free ? (
            <div
              className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                validation.ok
                  ? "border-success/40 bg-success/10 text-success"
                  : "border-warning/40 bg-warning/10 text-warning"
              }`}
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                {validation.ok ? <Check className="size-4" /> : <AlertTriangle className="size-4" />}
                {validation.ok
                  ? "Split balances with the pool"
                  : `Off by ₹${Math.abs(validation.delta)}`}
              </div>
              <div className="font-mono text-xs">
                committed ₹{validation.committed} / pool ₹{validation.pool}
              </div>
            </div>
          ) : (
            <p className="rounded-lg border border-line bg-surface-2/40 px-4 py-3 text-sm text-text-muted">
              Free tournament — no pool validation needed.
            </p>
          )}
        </div>
      </Card>

      {/* Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button variant="outline" disabled={pending} onClick={() => submit(false)}>
          Save draft
        </Button>
        <Button
          variant="gradient"
          disabled={pending || (!validation.free && !validation.ok)}
          onClick={() => submit(true)}
        >
          {pending ? "Publishing…" : "Publish tournament"}
        </Button>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="gv-panel p-5 sm:p-6">
      <h2 className="mb-4 font-display text-xl tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </div>
  );
}
