import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * NEXT 16: `middleware.ts` was renamed to `proxy.ts` and the export must be
 * named `proxy` (runtime is nodejs, no edge). This keeps the Supabase auth
 * session fresh on every matched request.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  /**
   * Run on everything except static assets and image optimization. We exclude
   * the Razorpay webhook from session work — it authenticates via HMAC, not a
   * user cookie, and must read the raw body untouched.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
