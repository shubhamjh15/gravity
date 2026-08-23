"use client";

/**
 * Publish a draft tournament.
 *
 * publishEvent has existed since the events phase, fully implemented — it
 * re-validates the prize split against the full pool before flipping status —
 * but nothing ever called it. An organizer could create a draft and had no way
 * to make it live.
 *
 * The re-validation is the point: a draft can be saved with a broken split, so
 * publish is where the engine's invariant is enforced. A rejection here is
 * useful information, so the message is surfaced verbatim rather than
 * flattened into "something went wrong".
 */
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Rocket } from "lucide-react";
import { publishEvent } from "@/app/(organizer)/dashboard/event-actions";
import { Button } from "@/components/ui/button";

export function PublishEventButton({
  eventId,
  size = "xs",
}: {
  eventId: string;
  size?: "xs" | "sm" | "default";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function publish() {
    startTransition(async () => {
      const res = await publishEvent(eventId);
      if (res.success) {
        toast.success(res.message || "Tournament published.");
        router.refresh();
      } else {
        // Usually "prize split is off by ₹X" — the organizer needs the number.
        toast.error(res.message, { duration: 8000 });
      }
    });
  }

  return (
    <Button size={size} variant="glow" disabled={pending} onClick={publish}>
      <Rocket className="size-3.5" />
      {pending ? "Publishing…" : "Publish"}
    </Button>
  );
}
