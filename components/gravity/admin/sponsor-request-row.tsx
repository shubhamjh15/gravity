"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { approveSponsorship, rejectSponsorship } from "@/app/(admin)/admin/actions";
import { Button } from "@/components/ui/button";

export function SponsorRequestRow({
  id,
  name,
  email,
  details,
  status: initialStatus,
}: {
  id: string;
  name: string;
  email: string;
  details: string | null;
  status: string;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [pending, startTransition] = useTransition();

  function act(approve: boolean) {
    startTransition(async () => {
      const res = approve
        ? await approveSponsorship({ request_id: id })
        : await rejectSponsorship({ request_id: id });
      if (res.success) {
        setStatus(approve ? "published" : "rejected");
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <div className="gv-panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-medium">{name}</p>
        <p className="font-mono text-xs text-text-dim">{email}</p>
        {details ? <p className="mt-1 line-clamp-2 text-sm text-text-muted">{details}</p> : null}
      </div>
      {status === "pending" ? (
        <div className="flex gap-2">
          <Button size="sm" variant="glow" disabled={pending} onClick={() => act(true)}>
            <Check className="size-4" /> Publish
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => act(false)}>
            <X className="size-4" /> Reject
          </Button>
        </div>
      ) : (
        <span className="rounded-full border border-line px-3 py-1 text-xs capitalize text-text-muted">
          {status}
        </span>
      )}
    </div>
  );
}
