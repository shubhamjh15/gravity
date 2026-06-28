"use client";

/**
 * Private details form — phone, UPI, gov-ID type. Writes to profiles_private
 * (PII, owner-only by RLS). UPI is required to receive winnings, so we nudge
 * that clearly. Mirrors the server Zod schema for fast feedback.
 */
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Lock, ShieldCheck } from "lucide-react";
import { updatePrivateProfile } from "@/app/(player)/profile/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldError } from "@/components/gravity/profile/field-error";

type PrivateData = {
  phone: string | null;
  upi_id: string | null;
  gov_id_type: string | null;
  kyc_status: string | null;
};

export function PrivateForm({ initial }: { initial: PrivateData }) {
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [govType, setGovType] = useState<string>(initial.gov_id_type ?? "");

  function onSubmit(formData: FormData) {
    setErrors({});
    const input = {
      phone: String(formData.get("phone") ?? "").trim(),
      upi_id: String(formData.get("upi_id") ?? "").trim(),
      gov_id_type: (govType || null) as PrivateData["gov_id_type"],
    };
    startTransition(async () => {
      const res = await updatePrivateProfile(input);
      if (res.success) toast.success(res.message);
      else {
        if (res.errors) setErrors(res.errors);
        toast.error(res.message);
      }
    });
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-text-muted">
          <Lock className="size-4 text-crimson-400" />
          Private &amp; payout details
        </div>
        <KycBadge status={initial.kyc_status} />
      </div>

      <p className="rounded-md border border-line bg-surface-2/60 px-3 py-2 text-xs text-text-dim">
        Only you and platform admins can ever see these. Your UPI ID is where
        tournament winnings are sent.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="phone">Mobile number</Label>
          <Input
            id="phone"
            name="phone"
            inputMode="numeric"
            defaultValue={initial.phone ?? ""}
            placeholder="9876543210"
            aria-invalid={Boolean(errors.phone)}
          />
          <FieldError message={errors.phone} />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="upi_id">UPI ID</Label>
          <Input
            id="upi_id"
            name="upi_id"
            defaultValue={initial.upi_id ?? ""}
            placeholder="name@bank"
            aria-invalid={Boolean(errors.upi_id)}
          />
          <FieldError message={errors.upi_id} />
        </div>
      </div>

      <div className="grid gap-2 sm:max-w-xs">
        <Label htmlFor="gov_id_type">Government ID type</Label>
        <Select value={govType} onValueChange={setGovType}>
          <SelectTrigger id="gov_id_type">
            <SelectValue placeholder="Select ID type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="aadhaar">Aadhaar</SelectItem>
            <SelectItem value="pan">PAN</SelectItem>
            <SelectItem value="dl">Driving License</SelectItem>
            <SelectItem value="passport">Passport</SelectItem>
            <SelectItem value="voter">Voter ID</SelectItem>
          </SelectContent>
        </Select>
        <FieldError message={errors.gov_id_type} />
      </div>

      <div>
        <Button type="submit" variant="gradient" disabled={pending}>
          {pending ? "Saving…" : "Save private details"}
        </Button>
      </div>
    </form>
  );
}

function KycBadge({ status }: { status: string | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    verified: { label: "KYC verified", cls: "border-success/40 text-success" },
    pending: { label: "KYC pending", cls: "border-warning/40 text-warning" },
    rejected: { label: "KYC rejected", cls: "border-danger/40 text-danger" },
  };
  const s = map[status ?? "pending"] ?? map.pending;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${s.cls}`}
    >
      <ShieldCheck className="size-3" />
      {s.label}
    </span>
  );
}
