"use client";

/**
 * Organizer application form.
 *
 * Deliberately asks for no phone or ID. That is PII and belongs in
 * profiles_private (#6) — a reviewer who needs it uses the audited reveal path
 * rather than having it copied into a second table.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Clock, CheckCircle2, XCircle, ShieldCheck } from "lucide-react";
import {
  applyForOrganizer,
  withdrawOrganizerApplication,
} from "@/app/(public)/become-organizer/actions";
import { FieldError } from "@/components/gravity/profile/field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type MyApplication = {
  id: string;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  org_name: string;
  review_note: string | null;
} | null;

export function OrganizerApplicationForm({
  application,
  alreadyOrganizer,
}: {
  application: MyApplication;
  alreadyOrganizer: boolean;
}) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  // Already have the role — nothing to apply for.
  if (alreadyOrganizer) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <ShieldCheck className="size-10 text-success" />
        <div>
          <h2 className="font-display text-xl">You&apos;re an organizer</h2>
          <p className="mt-1 text-sm text-text-muted">
            Your dashboard is open — create a tournament whenever you&apos;re ready.
          </p>
        </div>
        <Button asChild variant="gradient" size="lg">
          <Link href={"/dashboard" as never}>Go to your dashboard</Link>
        </Button>
      </div>
    );
  }

  if (application?.status === "pending") {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <Clock className="size-10 text-warning" />
        <div>
          <h2 className="font-display text-xl">Application under review</h2>
          <p className="mt-1 text-sm text-text-muted">
            We&apos;re reviewing <strong>{application.org_name}</strong>. You&apos;ll
            get a notification the moment there&apos;s a decision.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await withdrawOrganizerApplication();
              toast[res.success ? "success" : "error"](res.message);
              if (res.success) router.refresh();
            })
          }
        >
          Withdraw application
        </Button>
      </div>
    );
  }

  if (application?.status === "approved") {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <CheckCircle2 className="size-10 text-success" />
        <h2 className="font-display text-xl">Approved</h2>
        <p className="text-sm text-text-muted">
          Sign out and back in if your dashboard isn&apos;t showing yet — your
          session needs to pick up the new role.
        </p>
        <Button asChild variant="gradient">
          <Link href={"/dashboard" as never}>Open the dashboard</Link>
        </Button>
      </div>
    );
  }

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await applyForOrganizer({
        org_name: String(formData.get("org_name") ?? ""),
        games: String(formData.get("games") ?? "") || undefined,
        experience: String(formData.get("experience") ?? ""),
        audience_size: String(formData.get("audience_size") ?? "") || undefined,
        links: String(formData.get("links") ?? "") || undefined,
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
    <form action={onSubmit} className="flex flex-col gap-5">
      {application?.status === "rejected" ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-danger/40 bg-danger/10 px-3.5 py-3"
        >
          <XCircle className="mt-0.5 size-4 shrink-0 text-danger" />
          <div className="text-sm">
            <p className="font-medium">Your last application wasn&apos;t approved.</p>
            {application.review_note ? (
              <p className="mt-0.5 text-text-muted">{application.review_note}</p>
            ) : null}
            <p className="mt-1 text-text-muted">
              You can update the details below and apply again.
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="org_name">Org or team name</Label>
        <Input
          id="org_name"
          name="org_name"
          required
          maxLength={80}
          defaultValue={application?.org_name ?? ""}
          placeholder="Mumbai Fire Esports"
        />
        <FieldError message={errors.org_name} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="games">Games you run</Label>
        <Input
          id="games"
          name="games"
          maxLength={200}
          placeholder="Free Fire, BGMI"
        />
        <FieldError message={errors.games} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="experience">Your experience</Label>
        <Textarea
          id="experience"
          name="experience"
          rows={5}
          required
          maxLength={4000}
          placeholder="Tournaments you've run, roughly how many players, how you handle prize money and disputes…"
        />
        <FieldError message={errors.experience} />
        <p className="text-xs text-text-dim">
          You&apos;ll be collecting real entry fees, so tell us how you&apos;ve run
          things before. A couple of honest sentences beats a sales pitch.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audience_size">Community size</Label>
          <Input
            id="audience_size"
            name="audience_size"
            maxLength={80}
            placeholder="~2,000 in Discord"
          />
          <FieldError message={errors.audience_size} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="links">Links</Label>
          <Input
            id="links"
            name="links"
            maxLength={500}
            placeholder="Instagram, YouTube, Discord…"
          />
          <FieldError message={errors.links} />
        </div>
      </div>

      <Button type="submit" variant="gradient" size="xl" disabled={pending}>
        {pending ? "Submitting…" : "Apply to become an organizer"}
      </Button>
    </form>
  );
}
