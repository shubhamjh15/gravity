/**
 * Client-side Razorpay checkout helper.
 *
 * The checkout script is loaded on demand (never in the root layout — it would
 * cost every visitor a third-party script for a page they may never buy from),
 * and only once per document.
 *
 * NON-NEGOTIABLE #5: nothing here settles money. The `onPaid` callback fires
 * when Razorpay's modal reports success, which is a UI hint only — the order is
 * confirmed by the signed webhook. Never grant anything on this callback.
 */

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

/** GRAVITY crimson, for the Razorpay modal's accent. */
const CHECKOUT_THEME_COLOR = "#ff2d55";

let scriptPromise: Promise<boolean> | null = null;

/** Load checkout.js once; concurrent callers share the same promise. */
export function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<boolean>((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      // Allow a later retry rather than caching the failure forever.
      scriptPromise = null;
      resolve(false);
    };
    document.body.appendChild(script);
  });

  return scriptPromise;
}

export type CheckoutOrder = {
  id: string;
  amount: number;
  currency: string;
  keyId: string;
};

/**
 * Open the Razorpay modal for a server-created order.
 * Resolves true once the modal is open, false if it couldn't be shown.
 */
export async function openRazorpayCheckout(params: {
  order: CheckoutOrder;
  name: string;
  description: string;
  prefill?: { name?: string; email?: string; contact?: string };
  onPaid: () => void;
  onDismiss?: () => void;
}): Promise<boolean> {
  const loaded = await loadRazorpayScript();
  if (!loaded || !window.Razorpay) return false;

  const rzp = new window.Razorpay({
    key: params.order.keyId,
    amount: params.order.amount,
    currency: params.order.currency,
    name: params.name,
    description: params.description,
    order_id: params.order.id,
    prefill: params.prefill ?? {},
    theme: { color: CHECKOUT_THEME_COLOR },
    handler: params.onPaid,
    modal: { ondismiss: params.onDismiss },
  });

  rzp.open();
  return true;
}
