"use client";

/**
 * "Challenge" control on a public player profile — the entry point that was
 * missing for match invites (ROADMAP 3.6).
 *
 * Coordination only: no stake is held, and the dialog says so, so nobody
 * assumes GRAVITY is escrowing a wager.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Swords } from "lucide-react";
import { sendMatchInvite } from "@/app/(public)/communities/chat-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ChallengeButton({
  toUserId,
  toName,
  games,
}: {
  toUserId: string;
  toName: string;
  games: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [gameId, setGameId] = useState<string>("");
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await sendMatchInvite({
        to_user: toUserId,
        game_id: gameId || null,
        message: String(formData.get("message") ?? "") || undefined,
      });
      if (res.success) {
        toast.success(res.message);
        setOpen(false);
        setGameId("");
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="glow" size="sm">
          <Swords className="size-3.5" />
          Challenge
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Challenge {toName}</DialogTitle>
          <DialogDescription>
            Sends a 1-v-1 invite they can accept or decline. This coordinates a
            match — no entry fee or stake is held.
          </DialogDescription>
        </DialogHeader>

        <form action={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="challenge-game">Game</Label>
            <Select value={gameId} onValueChange={setGameId}>
              <SelectTrigger id="challenge-game">
                <SelectValue placeholder="Any game" />
              </SelectTrigger>
              <SelectContent>
                {games.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="challenge-message">Message</Label>
            <Textarea
              id="challenge-message"
              name="message"
              rows={3}
              maxLength={200}
              placeholder="Tonight at 9? Custom room, best of three."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="gradient" disabled={pending}>
              {pending ? "Sending…" : "Send challenge"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
