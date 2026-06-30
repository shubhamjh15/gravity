import "server-only";

import { Resend } from "resend";
import { serverEnv } from "@/lib/env";

/**
 * Email via Resend. Used for room-credential delivery + notifications. Fails
 * soft: if RESEND_API_KEY isn't set (dev), we log and no-op rather than throw,
 * so the core flow keeps working without email configured.
 */
let _resend: Resend | null = null;
function client(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(serverEnv.resendApiKey);
  return _resend;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean }> {
  const resend = client();
  if (!resend) {
    // dev / unconfigured — don't block the flow.
    return { ok: false };
  }
  try {
    await resend.emails.send({
      from: serverEnv.resendFromEmail,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** Branded room-credential email. */
export function roomCredentialEmail(params: {
  playerName: string;
  eventTitle: string;
  roomId: string;
  roomPassword: string;
  eventUrl: string;
}): { subject: string; html: string } {
  const { playerName, eventTitle, roomId, roomPassword, eventUrl } = params;
  return {
    subject: `Your room for ${eventTitle} is live`,
    html: `
      <div style="background:#0b0a0c;color:#f5f5f7;font-family:system-ui,sans-serif;padding:32px;border-radius:12px;max-width:520px;margin:auto">
        <h1 style="color:#ff2d55;font-size:24px;margin:0 0 8px">GRAVITY</h1>
        <p style="color:#a59faf;margin:0 0 24px">Hey ${playerName}, your match room is ready.</p>
        <div style="background:#16121a;border:1px solid #262030;border-radius:10px;padding:20px;margin-bottom:20px">
          <p style="margin:0 0 4px;color:#7a7480;font-size:12px;text-transform:uppercase;letter-spacing:2px">${eventTitle}</p>
          <p style="margin:12px 0 4px"><strong>Room ID:</strong> <span style="font-family:monospace;font-size:18px">${roomId}</span></p>
          <p style="margin:4px 0"><strong>Password:</strong> <span style="font-family:monospace;font-size:18px">${roomPassword}</span></p>
        </div>
        <a href="${eventUrl}" style="display:inline-block;background:linear-gradient(135deg,#ff2d55,#ff6a3d);color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Open tournament</a>
        <p style="color:#7a7480;font-size:12px;margin-top:24px">Good luck. — GRAVITY</p>
      </div>
    `,
  };
}
