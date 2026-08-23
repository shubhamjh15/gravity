"use client";

/**
 * Cancel a tournament registration.
 *
 * cancelRegistration has existed since the events phase with nothing calling
 * it — a player who registered had no way to back out, which also meant an
 * unpaid slot_held row sat on the event until the TTL sweep collected it.
 *
 * Only offered while the registration is still cancellable. Once money has
 * settled this is a refund question, not a self-service cancel, so the control
 * disappears rather than failing on click.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X } from "lucide-react";
import { cancelRegistration } from "@/app/(public)/events/register-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function CancelRegistrationButton({
  registrationId,
  eventTitle,
  paid,
}: {
  registrationId: string;
  eventTitle: string;
  paid: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function cancel() {
    startTransition(async () => {
      const res = await cancelRegistration(registrationId);
      if (res.success) {
        toast.success(res.message || "Registration cancelled.");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="xs"
          variant="ghost"
          className="text-text-dim hover:text-danger"
        >
          <X className="size-3" />
          Cancel
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel your registration?</DialogTitle>
          <DialogDescription>
            You&apos;ll give up your slot in {eventTitle}
            {paid
              ? ". You've already paid, so a refund is handled by the organizer — cancelling here does not issue one automatically."
              : ". Your held slot is released immediately and someone else can take it."}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Keep my slot
          </Button>
          <Button variant="destructive" disabled={pending} onClick={cancel}>
            {pending ? "Cancelling…" : "Cancel registration"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
