"use client";

/**
 * Sponsorship request form — public. Submits to the super-admin inbox.
 */
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { submitSponsorshipRequest } from "@/app/(public)/sponsors/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/gravity/profile/field-error";

export function SponsorRequestForm() {
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  function submit(formData: FormData) {
    setErrors({});
    const budget = String(formData.get("budget") ?? "").trim();
    const input = {
      sponsor_name: String(formData.get("sponsor_name") ?? "").trim(),
      contact_email: String(formData.get("contact_email") ?? "").trim(),
      contact_phone: String(formData.get("contact_phone") ?? "").trim() || undefined,
      details: String(formData.get("details") ?? "").trim() || undefined,
      budget_rupees: budget ? Number(budget) : undefined,
    };
    startTransition(async () => {
      const res = await submitSponsorshipRequest(input);
      if (res.success) {
        toast.success(res.message);
        setDone(true);
      } else {
        if (res.errors) setErrors(res.errors);
        toast.error(res.message);
      }
    });
  }

  if (done) {
    return (
      <div className="gv-panel p-8 text-center">
        <p className="font-display text-2xl">Thank you! 🎉</p>
        <p className="mt-2 text-sm text-text-muted">
          Your sponsorship request is in. We&apos;ll be in touch shortly.
        </p>
      </div>
    );
  }

  return (
    <form action={submit} className="gv-panel flex flex-col gap-4 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="sponsor_name">Brand / sponsor name</Label>
          <Input id="sponsor_name" name="sponsor_name" placeholder="Acme Gaming" />
          <FieldError message={errors.sponsor_name} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="contact_email">Email</Label>
          <Input id="contact_email" name="contact_email" type="email" placeholder="brand@acme.com" />
          <FieldError message={errors.contact_email} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="contact_phone">Phone (optional)</Label>
          <Input id="contact_phone" name="contact_phone" placeholder="9876543210" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="budget">Budget ₹ (optional)</Label>
          <Input id="budget" name="budget" type="number" min={0} placeholder="50000" />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="details">Tell us about your sponsorship goals</Label>
        <Textarea id="details" name="details" rows={4} placeholder="What are you looking to achieve?" />
      </div>
      <div className="flex justify-end">
        <Button type="submit" variant="gradient" disabled={pending}>
          <Send className="size-4" /> {pending ? "Submitting…" : "Submit request"}
        </Button>
      </div>
    </form>
  );
}
