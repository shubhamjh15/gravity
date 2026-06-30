"use client";

/**
 * Room credentials reveal — for paid participants only. The actual values come
 * from the get_room_credentials RPC (server-gated); this component fetches them
 * on demand and offers copy + a WhatsApp share link. Never rendered server-side
 * into HTML, so creds aren't in the page source for non-participants.
 */
import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, Copy, Check, MessageCircle, Loader2 } from "lucide-react";
import { getRoomCredentials } from "@/app/(public)/events/register-actions";
import { Button } from "@/components/ui/button";

export function RoomCredentials({
  eventId,
  eventTitle,
  released,
}: {
  eventId: string;
  eventTitle: string;
  released: boolean;
}) {
  const [creds, setCreds] = useState<{ roomId: string; roomPassword: string } | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function reveal() {
    setLoading(true);
    const res = await getRoomCredentials(eventId);
    setLoading(false);
    if (res.success && res.data.roomId) {
      setCreds({
        roomId: res.data.roomId,
        roomPassword: res.data.roomPassword ?? "",
      });
    } else {
      toast.error(res.success ? "Not available yet." : res.message);
    }
  }

  function copyAll() {
    if (!creds) return;
    const text = `${eventTitle}\nRoom ID: ${creds.roomId}\nPassword: ${creds.roomPassword}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied room details");
    setTimeout(() => setCopied(false), 1500);
  }

  const waLink = creds
    ? `https://wa.me/?text=${encodeURIComponent(
        `${eventTitle}\nRoom ID: ${creds.roomId}\nPassword: ${creds.roomPassword}`,
      )}`
    : "#";

  if (!released) {
    return (
      <div className="rounded-lg border border-line bg-surface-2/40 p-5 text-center">
        <KeyRound className="mx-auto size-6 text-text-dim" />
        <p className="mt-2 text-sm text-text-muted">
          Room credentials will appear here once the organizer releases them.
          You&apos;ll also get them by email and WhatsApp.
        </p>
      </div>
    );
  }

  return (
    <div className="gv-panel relative overflow-hidden p-5">
      <div className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-crimson-600/10 blur-3xl" />
      <div className="relative">
        <div className="flex items-center gap-2 font-display text-lg">
          <KeyRound className="size-5 text-crimson-400" />
          Match room
        </div>

        {!creds ? (
          <Button
            onClick={reveal}
            disabled={loading}
            variant="gradient"
            className="mt-4 w-full"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
            Reveal room credentials
          </Button>
        ) : (
          <div className="mt-4 space-y-3">
            <CredRow label="Room ID" value={creds.roomId} />
            <CredRow label="Password" value={creds.roomPassword} />
            <div className="flex gap-2 pt-1">
              <Button onClick={copyAll} variant="outline" size="sm" className="flex-1">
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button asChild variant="outline" size="sm" className="flex-1">
                <a href={waLink} target="_blank" rel="noreferrer">
                  <MessageCircle className="size-4" />
                  WhatsApp
                </a>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CredRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-line bg-background/40 px-3 py-2.5">
      <span className="font-mono text-[10px] tracking-widest text-text-dim uppercase">
        {label}
      </span>
      <span className="font-mono text-sm font-semibold tracking-wide">{value}</span>
    </div>
  );
}
