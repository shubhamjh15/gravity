"use client";

/**
 * Register button + Razorpay checkout. For free events it registers directly;
 * for paid events it reserves a slot, opens Razorpay Checkout, and lets the
 * webhook settle (we poll the registration status to reflect confirmation).
 *
 * Razorpay's checkout.js is loaded on demand. The browser flow is optimistic;
 * the SERVER (webhook) is the source of truth for 'paid'.
 */
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Ticket } from "lucide-react";
import { registerForEvent } from "@/app/(public)/events/register-actions";
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

export function RegisterButton({
  eventId,
  free,
  alreadyRegistered,
  registrationStatus,
  full,
  closed,
  displayName,
  email,
}: {
  eventId: string;
  free: boolean;
  alreadyRegistered: boolean;
  registrationStatus?: string;
  full: boolean;
  closed: boolean;
  displayName: string;
  email: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const register = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      toast.error("Registration needs the backend configured (Supabase keys).");
      return;
    }
    setLoading(true);
    const res = await registerForEvent({ event_id: eventId });

    if (!res.success) {
      toast.error(res.message);
      setLoading(false);
      return;
    }

    // Free event — done.
    if (res.data.free) {
      toast.success(res.message);
      router.refresh();
      setLoading(false);
      return;
    }

    // Paid event — open Razorpay.
    const order = res.data.order;
    if (!order) {
      toast.error("Could not start payment.");
      setLoading(false);
      return;
    }

    const ok = await loadRazorpay();
    if (!ok || !window.Razorpay) {
      toast.error("Could not load the payment window. Check your connection.");
      setLoading(false);
      return;
    }

    const rzp = new window.Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      name: "GRAVITY",
      description: "Tournament entry fee",
      order_id: order.id,
      prefill: { name: displayName, email },
      theme: { color: "#ff2d55" },
      handler: () => {
        // Payment captured client-side; the webhook confirms server-side.
        toast.success("Payment received! Confirming your slot…");
        // Give the webhook a moment, then refresh to show confirmed state.
        setTimeout(() => router.refresh(), 2500);
      },
      modal: {
        ondismiss: () => {
          toast("Payment cancelled. Your slot hold will expire soon.");
          setLoading(false);
        },
      },
    });
    rzp.open();
    setLoading(false);
  }, [eventId, displayName, email, router]);

  if (alreadyRegistered) {
    const confirmed =
      registrationStatus === "confirmed" || registrationStatus === "paid";
    return (
      <Button variant={confirmed ? "glow" : "outline"} disabled className="w-full">
        {confirmed ? "You're registered ✓" : "Awaiting confirmation…"}
      </Button>
    );
  }

  if (closed) {
    return (
      <Button variant="outline" disabled className="w-full">
        Registration closed
      </Button>
    );
  }

  if (full) {
    return (
      <Button variant="outline" disabled className="w-full">
        Tournament full
      </Button>
    );
  }

  return (
    <Button
      onClick={register}
      disabled={loading}
      variant="gradient"
      size="xl"
      className="w-full"
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Ticket className="size-4" />
      )}
      {free ? "Register free" : "Register & pay"}
    </Button>
  );
}
