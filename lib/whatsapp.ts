import "server-only";

/**
 * WhatsApp delivery for room credentials (ROADMAP 2.7 / SETUP.md §5).
 *
 * Two modes, chosen by whether a provider key is configured:
 *
 *  - v1 (free, default): we cannot push a WhatsApp message without a Business
 *    API provider, so we build a `wa.me` deep link the PLAYER taps to send
 *    themselves the details. `buildRoomCredentialsLink` is the shareable URL.
 *
 *  - provider (paid): with WHATSAPP_PROVIDER_API_KEY + WHATSAPP_PROVIDER_URL
 *    set, `sendWhatsApp` POSTs a text message. Kept deliberately generic —
 *    Gupshup and Interakt both accept a phone + text payload — so switching
 *    vendors is a config change, not a rewrite.
 *
 * Fails soft, exactly like lib/email.ts: an unconfigured or failing provider
 * must never break room release. The in-app RLS-gated reveal is the source of
 * truth; email and WhatsApp are convenience copies.
 */

/**
 * Indian numbers get typed a dozen ways; normalise to E.164 digits.
 *
 * Handles: a bare 10-digit mobile, the STD form with a leading 0, an existing
 * 91 country code, and the 00 international prefix — in any spacing or
 * punctuation. Returns null rather than guessing at anything else; a wrong
 * number means someone else receives a room password.
 */
export function toE164India(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");

  // Strip international prefixes: 00XX… → XX…, then a single trunk 0.
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);

  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;

  return null;
}

/** The message body shared across both delivery modes. */
export function roomCredentialsMessage(params: {
  eventTitle: string;
  roomId: string;
  roomPassword: string;
  eventUrl: string;
}): string {
  return [
    `GRAVITY — your room for ${params.eventTitle} is live.`,
    ``,
    `Room ID: ${params.roomId}`,
    `Password: ${params.roomPassword}`,
    ``,
    `Details: ${params.eventUrl}`,
    `Good luck.`,
  ].join("\n");
}

/**
 * A `wa.me` link that opens WhatsApp with the message prefilled.
 * Omit `phone` to let the sender pick a recipient.
 */
export function buildRoomCredentialsLink(params: {
  eventTitle: string;
  roomId: string;
  roomPassword: string;
  eventUrl: string;
  phone?: string;
}): string {
  const text = encodeURIComponent(roomCredentialsMessage(params));
  const to = params.phone ? toE164India(params.phone) : null;
  return to ? `https://wa.me/${to}?text=${text}` : `https://wa.me/?text=${text}`;
}

/** True when a paid provider is configured; otherwise we're in wa.me mode. */
export function isWhatsAppProviderConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_PROVIDER_API_KEY && process.env.WHATSAPP_PROVIDER_URL,
  );
}

/**
 * Push a WhatsApp message via the configured provider.
 * Returns `{ ok: false }` (never throws) when unconfigured or on failure.
 */
export async function sendWhatsApp(params: {
  phone: string;
  message: string;
}): Promise<{ ok: boolean; skipped?: boolean }> {
  if (!isWhatsAppProviderConfigured()) {
    return { ok: false, skipped: true };
  }

  const to = toE164India(params.phone);
  if (!to) return { ok: false, skipped: true };

  try {
    const res = await fetch(process.env.WHATSAPP_PROVIDER_URL as string, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.WHATSAPP_PROVIDER_API_KEY}`,
      },
      body: JSON.stringify({ to, type: "text", text: { body: params.message } }),
      // Room release fans out to every paid player; a hung provider must not
      // hold the request open.
      signal: AbortSignal.timeout(8000),
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}
