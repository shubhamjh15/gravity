import "server-only";

import crypto from "node:crypto";
import Razorpay from "razorpay";
import { serverEnv } from "@/lib/env";
import { paise, type Paise } from "@/lib/money";

/**
 * Razorpay server wrapper. NON-NEGOTIABLE #5: money settles ONLY from the
 * signed webhook, never from a client callback. These helpers create orders
 * and verify signatures; settlement (ledger writes) lives in the webhook route.
 */

let _client: Razorpay | null = null;

/** Lazily-constructed Razorpay client (server only). */
export function razorpay(): Razorpay {
  if (_client) return _client;
  _client = new Razorpay({
    key_id: serverEnv.razorpayKeyId,
    key_secret: serverEnv.razorpayKeySecret,
  });
  return _client;
}

/**
 * Create an order for a paise amount. Razorpay expects the amount in the
 * smallest unit (paise for INR) — which is exactly how we store money, so no
 * conversion fudge. `receipt` should be a stable internal reference.
 */
export async function createRazorpayOrder(params: {
  amount: Paise;
  receipt: string;
  notes?: Record<string, string>;
}) {
  const order = await razorpay().orders.create({
    amount: params.amount as number, // already paise
    currency: "INR",
    receipt: params.receipt,
    notes: params.notes,
  });
  return order;
}

/**
 * Verify a WEBHOOK signature (the `X-Razorpay-Signature` header) against the
 * RAW request body using the webhook secret. Constant-time comparison.
 * This is the gate that makes webhook-driven settlement trustworthy.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
): boolean {
  const expected = crypto
    .createHmac("sha256", serverEnv.razorpayWebhookSecret)
    .update(rawBody)
    .digest("hex");
  return timingSafeEqualHex(expected, signature);
}

/**
 * Verify a CHECKOUT signature returned to the browser after payment
 * (razorpay_order_id + "|" + razorpay_payment_id, HMAC with key secret).
 * Useful as a fast optimistic check, but it is NOT a substitute for the
 * webhook — the webhook remains the source of truth for settlement.
 */
export function verifyPaymentSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const expected = crypto
    .createHmac("sha256", serverEnv.razorpayKeySecret)
    .update(`${params.orderId}|${params.paymentId}`)
    .digest("hex");
  return timingSafeEqualHex(expected, params.signature);
}

/** Constant-time hex string comparison (avoids timing leaks). */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

/** Re-export for callers that build amounts. */
export { paise };
