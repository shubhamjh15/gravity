"use client";

/**
 * Community create form (organizers). Name, about, location, rules, and the
 * paid-membership toggle + cost. Wires to createCommunity.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createCommunity } from "@/app/(public)/communities/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/gravity/profile/field-error";

export function CommunityCreateForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPaid, setIsPaid] = useState(false);
  const [requiresApproval, setRequiresApproval] = useState(false);

  function submit(formData: FormData) {
    setErrors({});
    const cost = String(formData.get("membership_cost") ?? "").trim();
    const input = {
      name: String(formData.get("name") ?? "").trim(),
      about: String(formData.get("about") ?? "").trim() || undefined,
      location: String(formData.get("location") ?? "").trim() || undefined,
      rules: String(formData.get("rules") ?? "").trim() || undefined,
      visibility: "public" as const,
      is_paid: isPaid,
      requires_approval: requiresApproval,
      membership_cost_rupees: isPaid && cost ? Number(cost) : 0,
    };
    startTransition(async () => {
      const res = await createCommunity(input);
      if (res.success) {
        toast.success(res.message);
        router.push(`/communities/${res.data.slug}` as never);
      } else {
        if (res.errors) setErrors(res.errors);
        toast.error(res.message);
      }
    });
  }

  return (
    <form action={submit} className="flex flex-col gap-6">
      <div className="gv-panel p-5 sm:p-6">
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Community name</Label>
            <Input id="name" name="name" placeholder="Mumbai Fire Squad" />
            <FieldError message={errors.name} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="about">About</Label>
            <Textarea id="about" name="about" rows={3} placeholder="What's your community about?" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="location">Location</Label>
              <Input id="location" name="location" placeholder="Mumbai, India" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="rules">Rules</Label>
            <Textarea id="rules" name="rules" rows={4} placeholder="Community guidelines…" />
          </div>
        </div>
      </div>

      <div className="gv-panel p-5 sm:p-6">
        <h2 className="font-display text-lg">Membership</h2>
        <div className="mt-4 flex flex-col gap-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={isPaid}
              onChange={(e) => setIsPaid(e.target.checked)}
              className="size-4 accent-crimson-500"
            />
            <span className="text-sm">Paid membership</span>
          </label>
          {isPaid ? (
            <div className="grid gap-2 sm:max-w-xs">
              <Label htmlFor="membership_cost">Membership cost (₹)</Label>
              <Input id="membership_cost" name="membership_cost" type="number" min={0} placeholder="99" />
            </div>
          ) : null}
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={requiresApproval}
              onChange={(e) => setRequiresApproval(e.target.checked)}
              className="size-4 accent-crimson-500"
            />
            <span className="text-sm">Require approval to join</span>
          </label>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" variant="gradient" disabled={pending}>
          {pending ? "Creating…" : "Create community"}
        </Button>
      </div>
    </form>
  );
}
