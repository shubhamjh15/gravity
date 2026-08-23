"use client";

/**
 * Organizer application review queue.
 *
 * Approving grants the role — that happens inside a SECURITY DEFINER RPC which
 * records the decision and the grant in one transaction, so an approved
 * application can never end up without the role, and the role is never granted
 * without a recorded decision (#2).
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X, Inbox, ExternalLink } from "lucide-react";
import { reviewOrganizerApplication } from "@/app/(public)/become-organizer/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type OrganizerApplicationView = {
  id: string;
  user_id: string;
  applicant: string;
  email: string;
  org_name: string;
  games: string | null;
  experience: string;
  audience_size: string | null;
  links: string | null;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  review_note: string | null;
  created_at: string;
};

const STATUS_CHIP: Record<string, string> = {
  pending: "border-warning/40 bg-warning/10 text-warning",
  approved: "border-success/40 bg-success/10 text-success",
  rejected: "border-danger/40 bg-danger/10 text-danger",
  withdrawn: "border-line text-text-dim",
};

export function OrganizerReview({
  applications,
}: {
  applications: OrganizerApplicationView[];
}) {
  const pending = applications.filter((a) => a.status === "pending");
  const handled = applications.filter((a) => a.status !== "pending");

  if (applications.length === 0) {
    return (
      <div className="mt-6 flex flex-col items-center gap-2 rounded-xl border border-dashed border-line py-16 text-center">
        <Inbox className="size-8 text-text-dim" />
        <p className="font-display text-xl">No applications yet</p>
        <p className="text-sm text-text-muted">
          Anyone who applies at /become-organizer shows up here.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-10">
      {pending.length > 0 ? (
        <section>
          <h2 className="font-mono text-xs tracking-widest text-text-dim uppercase">
            Awaiting review ({pending.length})
          </h2>
          <div className="mt-3 flex flex-col gap-3">
            {pending.map((a) => (
              <ApplicationCard key={a.id} application={a} />
            ))}
          </div>
        </section>
      ) : null}

      {handled.length > 0 ? (
        <section>
          <h2 className="font-mono text-xs tracking-widest text-text-dim uppercase">
            Handled
          </h2>
          <div className="mt-3 flex flex-col gap-3">
            {handled.map((a) => (
              <ApplicationCard key={a.id} application={a} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ApplicationCard({
  application,
}: {
  application: OrganizerApplicationView;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(application.status);
  const [note, setNote] = useState("");
  const [pendingTx, startTransition] = useTransition();

  function review(approve: boolean) {
    startTransition(async () => {
      const res = await reviewOrganizerApplication({
        application_id: application.id,
        approve,
        review_note: note.trim() || undefined,
      });
      if (res.success) {
        setStatus(approve ? "approved" : "rejected");
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <article className="rounded-xl border border-line bg-surface/40 p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg">{application.org_name}</h3>
          <p className="mt-0.5 text-sm text-text-muted">
            {application.applicant}
            <span className="font-mono text-xs text-text-dim">
              {" · "}
              {application.email}
            </span>
          </p>
        </div>
        <span
          className={cn(
            "rounded-full border px-2.5 py-1 text-[11px] capitalize",
            STATUS_CHIP[status] ?? STATUS_CHIP.withdrawn,
          )}
        >
          {status}
        </span>
      </header>

      <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
        {application.games ? (
          <>
            <dt className="text-text-dim">Games</dt>
            <dd>{application.games}</dd>
          </>
        ) : null}
        {application.audience_size ? (
          <>
            <dt className="text-text-dim">Community</dt>
            <dd>{application.audience_size}</dd>
          </>
        ) : null}
        {application.links ? (
          <>
            <dt className="text-text-dim">Links</dt>
            <dd className="flex items-center gap-1 break-all">
              <ExternalLink className="size-3 shrink-0 text-text-dim" />
              {application.links}
            </dd>
          </>
        ) : null}
      </dl>

      <p className="mt-4 border-t border-line/60 pt-3 text-sm whitespace-pre-wrap text-text-muted">
        {application.experience}
      </p>

      {application.review_note && status !== "pending" ? (
        <p className="mt-3 rounded-md border border-line/70 bg-void/40 px-3 py-2 text-sm">
          <span className="text-text-dim">Review note: </span>
          {application.review_note}
        </p>
      ) : null}

      {status === "pending" ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line/60 pt-4">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note to the applicant (optional)"
            className="h-9 min-w-52 flex-1"
          />
          <Button
            size="sm"
            variant="glow"
            disabled={pendingTx}
            onClick={() => review(true)}
          >
            <Check className="size-3.5" />
            Approve &amp; grant organizer
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pendingTx}
            onClick={() => review(false)}
          >
            <X className="size-3.5" />
            Reject
          </Button>
        </div>
      ) : null}
    </article>
  );
}
