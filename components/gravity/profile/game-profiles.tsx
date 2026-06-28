"use client";

/**
 * Per-game profiles — add/edit your in-game identity for each supported title
 * (Free Fire, BGMI, PUBG). One row per game; upserts via the server action.
 * Cards show saved profiles; a form adds/edits one. Fully responsive.
 */
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Gamepad2, Plus, Pencil } from "lucide-react";
import { upsertGameProfile } from "@/app/(player)/profile/actions";
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
import { FieldError } from "@/components/gravity/profile/field-error";

type Game = { id: string; slug: string; name: string };
type GameProfile = {
  id: string;
  game_id: string;
  in_game_id: string | null;
  ign: string | null;
  ranking: string | null;
  kill_ratio: number | null;
  win_ratio: number | null;
};

export function GameProfiles({
  games,
  existing,
}: {
  games: Game[];
  existing: GameProfile[];
}) {
  const [editing, setEditing] = useState<GameProfile | null>(null);
  const [showForm, setShowForm] = useState(existing.length === 0);

  const gameName = (id: string) => games.find((g) => g.id === id)?.name ?? "Game";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-text-muted">
          <Gamepad2 className="size-4 text-crimson-400" />
          Your games
        </div>
        {!showForm ? (
          <Button
            size="sm"
            variant="glow"
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
          >
            <Plus className="size-4" /> Add game
          </Button>
        ) : null}
      </div>

      {/* saved cards */}
      {existing.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {existing.map((gp) => (
            <div
              key={gp.id}
              className="gv-card-accent flex items-start justify-between gap-3 p-4"
            >
              <div className="min-w-0">
                <p className="font-display text-base">{gameName(gp.game_id)}</p>
                <p className="truncate font-mono text-xs text-text-muted">
                  ID: {gp.in_game_id ?? "—"}
                  {gp.ign ? ` · ${gp.ign}` : ""}
                </p>
                <div className="mt-1.5 flex gap-3 font-mono text-[11px] text-text-dim">
                  {gp.kill_ratio != null ? <span>K/D {gp.kill_ratio}</span> : null}
                  {gp.win_ratio != null ? <span>Win {gp.win_ratio}%</span> : null}
                  {gp.ranking ? <span>{gp.ranking}</span> : null}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditing(gp);
                  setShowForm(true);
                }}
                className="shrink-0 rounded-md border border-line p-1.5 text-text-muted transition-colors hover:border-crimson-500 hover:text-crimson-300"
                aria-label="Edit"
              >
                <Pencil className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {showForm ? (
        <GameForm
          games={games}
          editing={editing}
          usedGameIds={existing.map((g) => g.game_id)}
          onDone={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}

function GameForm({
  games,
  editing,
  usedGameIds,
  onDone,
}: {
  games: Game[];
  editing: GameProfile | null;
  usedGameIds: string[];
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [gameId, setGameId] = useState<string>(editing?.game_id ?? "");

  // When editing, allow the current game; when adding, hide already-used games.
  const available = games.filter(
    (g) => g.id === editing?.game_id || !usedGameIds.includes(g.id),
  );

  function onSubmit(formData: FormData) {
    setErrors({});
    const num = (k: string) => {
      const v = String(formData.get(k) ?? "").trim();
      return v === "" ? null : Number(v);
    };
    const input = {
      game_id: gameId,
      in_game_id: String(formData.get("in_game_id") ?? "").trim(),
      ign: String(formData.get("ign") ?? "").trim() || undefined,
      ranking: String(formData.get("ranking") ?? "").trim() || undefined,
      kill_ratio: num("kill_ratio"),
      win_ratio: num("win_ratio"),
    };
    startTransition(async () => {
      const res = await upsertGameProfile(input);
      if (res.success) {
        toast.success(res.message);
        onDone();
      } else {
        if (res.errors) setErrors(res.errors);
        toast.error(res.message);
      }
    });
  }

  return (
    <form
      action={onSubmit}
      className="flex flex-col gap-4 rounded-lg border border-line bg-surface-2/40 p-4"
    >
      <div className="grid gap-2">
        <Label htmlFor="game_id">Game</Label>
        <Select value={gameId} onValueChange={setGameId}>
          <SelectTrigger id="game_id">
            <SelectValue placeholder="Choose a title" />
          </SelectTrigger>
          <SelectContent>
            {available.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError message={errors.game_id} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="in_game_id">In-game ID</Label>
          <Input
            id="in_game_id"
            name="in_game_id"
            defaultValue={editing?.in_game_id ?? ""}
            placeholder="123456789"
            aria-invalid={Boolean(errors.in_game_id)}
          />
          <FieldError message={errors.in_game_id} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ign">In-game name (IGN)</Label>
          <Input id="ign" name="ign" defaultValue={editing?.ign ?? ""} placeholder="ProGamer" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ranking">Rank</Label>
          <Input
            id="ranking"
            name="ranking"
            defaultValue={editing?.ranking ?? ""}
            placeholder="Heroic / Conqueror"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label htmlFor="kill_ratio">K/D</Label>
            <Input
              id="kill_ratio"
              name="kill_ratio"
              type="number"
              step="0.01"
              defaultValue={editing?.kill_ratio ?? ""}
              placeholder="3.2"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="win_ratio">Win %</Label>
            <Input
              id="win_ratio"
              name="win_ratio"
              type="number"
              step="0.1"
              defaultValue={editing?.win_ratio ?? ""}
              placeholder="22"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit" variant="gradient" disabled={pending}>
          {pending ? "Saving…" : editing ? "Update" : "Add game"}
        </Button>
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
