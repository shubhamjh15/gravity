"use client";

/**
 * Room credential setter (organizer). Saves the Room ID + password, which the
 * server reveals to paid players via the get_room_credentials RPC and which we
 * deliver by email/WhatsApp. Once set, room_released_at is stamped.
 */
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { setRoomCredentials } from "@/app/(organizer)/dashboard/event-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RoomSetter({
  eventId,
  initialRoomId,
  released,
}: {
  eventId: string;
  initialRoomId: string | null;
  released: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [roomId, setRoomId] = useState(initialRoomId ?? "");
  const [password, setPassword] = useState("");

  function save() {
    if (!roomId.trim() || !password.trim()) {
      toast.error("Enter both Room ID and password.");
      return;
    }
    startTransition(async () => {
      const res = await setRoomCredentials({
        event_id: eventId,
        room_id: roomId.trim(),
        room_password: password.trim(),
      });
      if (res.success) toast.success(res.message);
      else toast.error(res.message);
    });
  }

  return (
    <div className="gv-panel p-5">
      <div className="flex items-center gap-2 font-display text-lg">
        <KeyRound className="size-5 text-crimson-400" />
        Match room
        {released ? (
          <span className="ml-auto rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[11px] text-success">
            Released
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-text-muted">
        Set the in-game room. It&apos;s revealed only to paid players and pushed
        by email &amp; WhatsApp.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="room_id">Room ID</Label>
          <Input
            id="room_id"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            placeholder="12345678"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="room_pw">Password</Label>
          <Input
            id="room_pw"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••"
          />
        </div>
      </div>

      <Button onClick={save} disabled={pending} variant="gradient" className="mt-4">
        {pending ? "Saving…" : released ? "Update room" : "Release room"}
      </Button>
    </div>
  );
}
