"use client";

/**
 * 1-v-1 match invites (ROADMAP 3.6).
 *
 * The server actions have existed since the community phase with no interface
 * at all — invites could be created but never seen or answered. This is that
 * interface.
 *
 * Open question in the roadmap: whether invites are coordination-only or carry
 * stakes. They are coordination-only here — no money changes hands — which the
 * copy says plainly so nobody assumes a wager is escrowed.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Swords, Check, X, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { respondMatchInvite } from "@/app/(public)/communities/chat-actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type InviteView = {
  id: string;
  status: "invited" | "accepted" | "declined" | "cancelled";
  message: string | null;
  game_name: string | null;
  counterpart_name: string;
  counterpart_id: string;
  created_at: string;
  direction: "incoming" | "outgoing";
};

const STATUS_STYLE: Record<string, string> = {
  invited: "border-warning/40 bg-warning/10 text-warning",
  accepted: "border-success/40 bg-success/10 text-success",
  declined: "border-line text-text-dim",
  cancelled: "border-line text-text-dim",
};

export function MatchInvites({ invites }: { invites: InviteView[] }) {
  const incoming = invites.filter((i) => i.direction === "incoming");
  const outgoing = invites.filter((i) => i.direction === "outgoing");

  if (invites.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line py-16 text-center">
        <Swords className="mx-auto size-8 text-text-dim" />
        <p className="mt-3 font-display text-xl">No challenges yet</p>
        <p className="mt-1 text-sm text-text-muted">
          Open a player&apos;s profile and challenge them to a 1-v-1.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {incoming.length > 0 ? (
        <section>
          <h2 className="font-mono text-xs tracking-widest text-text-dim uppercase">
            Waiting on you ({incoming.filter((i) => i.status === "invited").length})
          </h2>
          <div className="mt-3 flex flex-col gap-2">
            {incoming.map((i) => (
              <InviteRow key={i.id} invite={i} />
            ))}
          </div>
        </section>
      ) : null}

      {outgoing.length > 0 ? (
        <section>
          <h2 className="font-mono text-xs tracking-widest text-text-dim uppercase">
            Sent by you
          </h2>
          <div className="mt-3 flex flex-col gap-2">
            {outgoing.map((i) => (
              <InviteRow key={i.id} invite={i} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function InviteRow({ invite }: { invite: InviteView }) {
  const router = useRouter();
  const [status, setStatus] = useState(invite.status);
  const [pending, startTransition] = useTransition();

  function respond(accept: boolean) {
    startTransition(async () => {
      const res = await respondMatchInvite({
        invite_id: invite.id,
        accept,
      });
      if (res.success) {
        setStatus(accept ? "accepted" : "declined");
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  const Icon = invite.direction === "incoming" ? ArrowDownLeft : ArrowUpRight;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface/40 px-4 py-3">
      <Icon
        className={cn(
          "size-4 shrink-0",
          invite.direction === "incoming" ? "text-crimson-400" : "text-text-dim",
        )}
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">
          <span className="text-text-muted">
            {invite.direction === "incoming" ? "From" : "To"}{" "}
          </span>
          <span className="font-medium">{invite.counterpart_name}</span>
          {invite.game_name ? (
            <span className="text-text-dim"> · {invite.game_name}</span>
          ) : null}
        </p>
        {invite.message ? (
          <p className="mt-0.5 line-clamp-2 text-xs text-text-muted">
            &ldquo;{invite.message}&rdquo;
          </p>
        ) : null}
        <p className="mt-0.5 font-mono text-[11px] text-text-dim">
          {new Date(invite.created_at).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
          })}
        </p>
      </div>

      {invite.direction === "incoming" && status === "invited" ? (
        <div className="flex gap-2">
          <Button
            size="xs"
            variant="glow"
            disabled={pending}
            onClick={() => respond(true)}
          >
            <Check className="size-3" />
            Accept
          </Button>
          <Button
            size="xs"
            variant="ghost"
            disabled={pending}
            onClick={() => respond(false)}
          >
            <X className="size-3" />
            Decline
          </Button>
        </div>
      ) : (
        <span
          className={cn(
            "rounded-full border px-2.5 py-1 text-[11px] capitalize",
            STATUS_STYLE[status] ?? STATUS_STYLE.cancelled,
          )}
        >
          {status}
        </span>
      )}
    </div>
  );
}
