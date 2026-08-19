import { describe, it, expect, beforeAll, vi } from "vitest";
import crypto from "node:crypto";

/**
 * Webhook + checkout signature verification (NON-NEGOTIABLE #5).
 *
 * This is the gate that makes webhook-driven settlement trustworthy: if it can
 * be fooled, anyone who knows an order id can mint money. The secrets are set
 * before importing the module because lib/env reads them lazily on access.
 */
const WEBHOOK_SECRET = "test_webhook_secret";
const KEY_SECRET = "test_key_secret";

vi.mock("server-only", () => ({}));

beforeAll(() => {
  process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
  process.env.RAZORPAY_KEY_SECRET = KEY_SECRET;
  process.env.RAZORPAY_KEY_ID = "rzp_test_key";
});

const { verifyWebhookSignature, verifyPaymentSignature } = await import(
  "@/lib/razorpay"
);

function sign(body: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

describe("verifyWebhookSignature", () => {
  const body = JSON.stringify({
    event: "payment.captured",
    payload: { payment: { entity: { id: "pay_1", amount: 4000 } } },
  });

  it("accepts a correctly signed body", () => {
    expect(verifyWebhookSignature(body, sign(body, WEBHOOK_SECRET))).toBe(true);
  });

  it("rejects a body signed with the wrong secret", () => {
    expect(verifyWebhookSignature(body, sign(body, "attacker_secret"))).toBe(
      false,
    );
  });

  it("rejects a tampered amount under the original signature", () => {
    // The core attack: inflate the amount, keep the signature.
    const signature = sign(body, WEBHOOK_SECRET);
    const tampered = body.replace('"amount":4000', '"amount":40000000');
    expect(verifyWebhookSignature(tampered, signature)).toBe(false);
  });

  it("rejects an empty signature", () => {
    expect(verifyWebhookSignature(body, "")).toBe(false);
  });

  it("rejects a signature of the wrong length without throwing", () => {
    expect(verifyWebhookSignature(body, "abcd")).toBe(false);
  });

  it("rejects non-hex junk without throwing", () => {
    expect(() => verifyWebhookSignature(body, "z".repeat(64))).not.toThrow();
    expect(verifyWebhookSignature(body, "z".repeat(64))).toBe(false);
  });

  it("is whitespace-sensitive — a re-serialised body must not validate", () => {
    // Why the route reads the RAW body and verifies before JSON.parse.
    const signature = sign(body, WEBHOOK_SECRET);
    const reserialised = JSON.stringify(JSON.parse(body), null, 2);
    expect(verifyWebhookSignature(reserialised, signature)).toBe(false);
  });
});

describe("verifyPaymentSignature", () => {
  const orderId = "order_abc";
  const paymentId = "pay_xyz";
  const good = sign(`${orderId}|${paymentId}`, KEY_SECRET);

  it("accepts a correct checkout signature", () => {
    expect(
      verifyPaymentSignature({ orderId, paymentId, signature: good }),
    ).toBe(true);
  });

  it("rejects a swapped payment id", () => {
    expect(
      verifyPaymentSignature({
        orderId,
        paymentId: "pay_other",
        signature: good,
      }),
    ).toBe(false);
  });

  it("rejects a swapped order id", () => {
    expect(
      verifyPaymentSignature({
        orderId: "order_other",
        paymentId,
        signature: good,
      }),
    ).toBe(false);
  });

  it("rejects a signature made with the webhook secret", () => {
    // The two secrets are distinct and must not be interchangeable.
    expect(
      verifyPaymentSignature({
        orderId,
        paymentId,
        signature: sign(`${orderId}|${paymentId}`, WEBHOOK_SECRET),
      }),
    ).toBe(false);
  });
});
