"use client";

/**
 * Join community button. Free -> joins instantly (or pending if approval).
 * Paid -> Razorpay checkout for the membership, settled by the webhook.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus, Loader2, Check } from "lucide-react";
import { joinCommunity } from "@/app/(public)/communities/actions";
import { isSupabaseConfigured } from "@/lib/env";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export function JoinButton({
  communityId,
  membershipStatus,
  displayName,
  email,
}: {
  communityId: string;
  membershipStatus?: string;
  displayName: string;
  email: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (membershipStatus === "active") {
    return (
      <Button variant="glow" disabled className="w-full">
        <Check className="size-4" /> Member
      </Button>
    );
  }
  if (membershipStatus === "pending") {
    return (
      <Button variant="outline" disabled className="w-full">
        Request pending…
      </Button>
    );
  }

  async function join() {
    if (!isSupabaseConfigured()) {
      toast.error("Joining needs the backend configured.");
      return;
    }
    setLoading(true);
    const res = await joinCommunity({ community_id: communityId });
    if (!res.success) {
      toast.error(res.message);
      setLoading(false);
      return;
    }
    if (!res.data.paid) {
      toast.success(res.message);
      router.refresh();
      setLoading(false);
      return;
    }
    const order = res.data.order;
    if (!order || !(await loadRazorpay()) || !window.Razorpay) {
      toast.error("Could not open payment.");
      setLoading(false);
      return;
    }
    const rzp = new window.Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      name: "GRAVITY",
      description: "Community membership",
      order_id: order.id,
      prefill: { name: displayName, email },
      theme: { color: "#ff2d55" },
      handler: () => {
        toast.success("Payment received! Activating membership…");
        setTimeout(() => router.refresh(), 2500);
      },
      modal: { ondismiss: () => setLoading(false) },
    });
    rzp.open();
    setLoading(false);
  }

  return (
    <Button onClick={join} disabled={loading} variant="gradient" size="lg" className="w-full">
      {loading ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
      Join community
    </Button>
  );
}
