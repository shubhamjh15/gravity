"use client";

/**
 * Elite tier panel (ROADMAP 3.7).
 *
 * Three faces depending on who's looking:
 *  - Owner: set the bar, then work the review queue.
 *  - Active member: see the bar, apply, track their application.
 *  - Everyone else: read-only summary of what elite requires.
 *
 * The approve button can fail — the database enforces the community's own
 * gov-ID and kill-ratio policy, and an owner cannot wave someone past it. The
 * error is surfaced verbatim rather than hidden, so the reviewer understands
 * why it was refused.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShieldCheck, Crown, Check, X, Clock } from "lucide-react";
import {
  saveElitePolicy,
  applyForElite,
  withdrawEliteApplication,
  reviewEliteApplication,
} from "@/app/(public)/communities/elite-actions";
import { FieldError } from "@/components/gravity/profile/field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type ElitePolicy = {
  requires_gov_id: boolean;
  min_kill_ratio: number | null;
  rules: string | null;
};

export type EliteApplication = {
  id: string;
  user_id: string;
  applicant_name: string;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  kill_ratio_claimed: number | null;
  note: string | null;
  review_note: string | null;
};

export function ElitePanel({
  communityId,
  isOwner,
  isActiveMember,
  isElite,
  policy,
  myApplication,
  queue,
}: {
  communityId: string;
  isOwner: boolean;
  isActiveMember: boolean;
  isElite: boolean;
  policy: ElitePolicy | null;
  myApplication: EliteApplication | null;
  queue: EliteApplication[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <PolicySummary policy={policy} />

      {isOwner ? (
        <>
          <PolicyEditor communityId={communityId} policy={policy} />
          <ReviewQueue queue={queue} />
        </>
      ) : isElite ? (
        <div className="flex items-center gap-2 rounded-lg border border-crimson-700/40 bg-crimson-500/10 px-4 py-3">
          <Crown className="size-4 text-crimson-300" />
          <p className="text-sm">
            You&apos;re an <strong>elite</strong> member of this community.
          </p>
        </div>
      ) : isActiveMember ? (
        <ApplicantView communityId={communityId} application={myApplication} />
      ) : (
        <p className="text-sm text-text-muted">
          Join this community to apply for elite status.
        </p>
      )}
    </div>
  );
}

function PolicySummary({ policy }: { policy: ElitePolicy | null }) {
  if (!policy) {
    return (
      <div className="rounded-lg border border-dashed border-line px-4 py-6 text-center">
        <ShieldCheck className="mx-auto size-6 text-text-dim" />
        <p className="mt-2 text-sm text-text-muted">
          This community hasn&apos;t set an elite policy yet.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line bg-surface/40 p-4">
      <h3 className="flex items-center gap-2 font-display text-lg">
        <ShieldCheck className="size-4 text-crimson-400" />
        Elite requirements
      </h3>
      <ul className="mt-3 flex flex-col gap-1.5 text-sm text-text-muted">
        <li className="flex items-center gap-2">
          <Check className="size-3.5 text-crimson-400" />
          {policy.requires_gov_id
            ? "A verified government ID"
            : "No government ID required"}
        </li>
        {policy.min_kill_ratio !== null ? (
          <li className="flex items-center gap-2">
            <Check className="size-3.5 text-crimson-400" />
            Kill ratio of at least{" "}
            <span className="font-mono text-foreground">
              {policy.min_kill_ratio}
            </span>
          </li>
        ) : null}
      </ul>
      {policy.rules ? (
        <p className="mt-3 border-t border-line/60 pt-3 text-sm whitespace-pre-wrap text-text-muted">
          {policy.rules}
        </p>
      ) : null}
    </div>
  );
}

function PolicyEditor({
  communityId,
  policy,
}: {
  communityId: string;
  policy: ElitePolicy | null;
}) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    const ratioRaw = String(formData.get("min_kill_ratio") ?? "").trim();
    startTransition(async () => {
      const res = await saveElitePolicy({
        community_id: communityId,
        requires_gov_id: formData.get("requires_gov_id") === "on",
        min_kill_ratio: ratioRaw === "" ? null : Number(ratioRaw),
        rules: String(formData.get("rules") ?? "") || undefined,
      });
      if (res.success) {
        setErrors({});
        toast.success(res.message);
        router.refresh();
      } else {
        setErrors(res.errors ?? {});
        toast.error(res.message);
      }
    });
  }

  return (
    <form action={onSubmit} className="rounded-lg border border-line bg-surface/40 p-4">
      <h3 className="font-display text-lg">Set the elite bar</h3>

      <div className="mt-4 flex flex-col gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="requires_gov_id"
            defaultChecked={policy?.requires_gov_id ?? true}
            className="size-4 accent-crimson-500"
          />
          Require a verified government ID
        </label>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="min_kill_ratio">Minimum kill ratio</Label>
          <Input
            id="min_kill_ratio"
            name="min_kill_ratio"
            type="number"
            min={0}
            max={100}
            step="0.01"
            defaultValue={policy?.min_kill_ratio ?? ""}
            placeholder="3.5"
            className="max-w-40"
          />
          <FieldError message={errors.min_kill_ratio} />
          <p className="text-xs text-text-dim">Leave empty for no threshold.</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rules">Extra rules</Label>
          <Textarea
            id="rules"
            name="rules"
            rows={3}
            defaultValue={policy?.rules ?? ""}
            placeholder="What elite members are expected to do."
          />
          <FieldError message={errors.rules} />
        </div>
      </div>

      <Button type="submit" variant="glow" className="mt-4" disabled={pending}>
        {pending ? "Saving…" : "Save policy"}
      </Button>
    </form>
  );
}

function ApplicantView({
  communityId,
  application,
}: {
  communityId: string;
  application: EliteApplication | null;
}) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function apply(formData: FormData) {
    const ratioRaw = String(formData.get("kill_ratio_claimed") ?? "").trim();
    startTransition(async () => {
      const res = await applyForElite({
        community_id: communityId,
        kill_ratio_claimed: ratioRaw === "" ? null : Number(ratioRaw),
        note: String(formData.get("note") ?? "") || undefined,
      });
      if (res.success) {
        setErrors({});
        toast.success(res.message);
        router.refresh();
      } else {
        setErrors(res.errors ?? {});
        toast.error(res.message);
      }
    });
  }

  function withdraw() {
    if (!application) return;
    startTransition(async () => {
      const res = await withdrawEliteApplication({
        application_id: application.id,
      });
      if (res.success) {
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  if (application?.status === "pending") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3">
        <Clock className="size-4 text-warning" />
        <p className="flex-1 text-sm">
          Your elite application is awaiting review.
        </p>
        <Button size="xs" variant="outline" disabled={pending} onClick={withdraw}>
          Withdraw
        </Button>
      </div>
    );
  }

  return (
    <form action={apply} className="rounded-lg border border-line bg-surface/40 p-4">
      <h3 className="font-display text-lg">Apply for elite</h3>

      {application?.status === "rejected" ? (
        <p className="mt-2 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm">
          Your last application was rejected
          {application.review_note ? `: ${application.review_note}` : "."} You can
          apply again below.
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="kill_ratio_claimed">Your kill ratio</Label>
          <Input
            id="kill_ratio_claimed"
            name="kill_ratio_claimed"
            type="number"
            min={0}
            max={100}
            step="0.01"
            placeholder="3.2"
            className="max-w-40"
          />
          <FieldError message={errors.kill_ratio_claimed} />
          <p className="text-xs text-text-dim">
            Verified against your per-game profiles when the organizer reviews.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="note">Anything else?</Label>
          <Textarea
            id="note"
            name="note"
            rows={3}
            placeholder="Tournaments you've placed in, your main squad…"
          />
          <FieldError message={errors.note} />
        </div>
      </div>

      <Button type="submit" variant="gradient" className="mt-4" disabled={pending}>
        {pending ? "Submitting…" : "Submit application"}
      </Button>
    </form>
  );
}

function ReviewQueue({ queue }: { queue: EliteApplication[] }) {
  const pendingApps = queue.filter((a) => a.status === "pending");

  return (
    <div className="rounded-lg border border-line bg-surface/40 p-4">
      <h3 className="font-display text-lg">
        Applications ({pendingApps.length} pending)
      </h3>

      {pendingApps.length === 0 ? (
        <p className="mt-3 text-sm text-text-muted">
          No applications waiting on you.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {pendingApps.map((a) => (
            <ReviewRow key={a.id} application={a} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ReviewRow({ application }: { application: EliteApplication }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<string | null>(null);

  function review(approve: boolean) {
    startTransition(async () => {
      const res = await reviewEliteApplication({
        application_id: application.id,
        approve,
      });
      if (res.success) {
        setDone(res.data.outcome);
        toast.success(res.message);
        router.refresh();
      } else {
        // The DB refused because the community's own policy wasn't met.
        toast.error(res.message);
      }
    });
  }

  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-md border border-line/70 bg-void/40 px-3 py-2.5",
        done && "opacity-50",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{application.applicant_name}</p>
        <p className="font-mono text-[11px] text-text-dim">
          {application.kill_ratio_claimed !== null
            ? `Claims K/D ${application.kill_ratio_claimed}`
            : "No kill ratio given"}
        </p>
        {application.note ? (
          <p className="mt-1 line-clamp-2 text-xs text-text-muted">
            {application.note}
          </p>
        ) : null}
      </div>

      {done ? (
        <span className="font-mono text-[11px] tracking-widest text-text-dim uppercase">
          {done}
        </span>
      ) : (
        <div className="flex gap-2">
          <Button
            size="xs"
            variant="glow"
            disabled={pending}
            onClick={() => review(true)}
          >
            <Check className="size-3" />
            Approve
          </Button>
          <Button
            size="xs"
            variant="ghost"
            disabled={pending}
            onClick={() => review(false)}
          >
            <X className="size-3" />
            Reject
          </Button>
        </div>
      )}
    </li>
  );
}
