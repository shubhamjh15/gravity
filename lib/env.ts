/**
 * Validated environment access.
 *
 * Public vars (NEXT_PUBLIC_*) are safe in the browser. Server secrets are read
 * through `serverEnv()` which throws if called where it shouldn't be, and is
 * only ever imported by server code. We validate lazily (not at import) so the
 * app can boot in dev before every key is filled in.
 */

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required environment variable: ${name}. See .env.local.example.`,
    );
  }
  return value;
}

/** Public, browser-safe config. */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  razorpayKeyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "",
};

/**
 * Server-only secrets. Accessing a getter validates that secret is present.
 * Importing this object is fine; throwing only happens when you read a missing
 * value, so optional integrations don't block boot.
 */
export const serverEnv = {
  get supabaseServiceRoleKey() {
    return required(
      "SUPABASE_SERVICE_ROLE_KEY",
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
  },
  get razorpayKeyId() {
    return required("RAZORPAY_KEY_ID", process.env.RAZORPAY_KEY_ID);
  },
  get razorpayKeySecret() {
    return required("RAZORPAY_KEY_SECRET", process.env.RAZORPAY_KEY_SECRET);
  },
  get razorpayWebhookSecret() {
    return required(
      "RAZORPAY_WEBHOOK_SECRET",
      process.env.RAZORPAY_WEBHOOK_SECRET,
    );
  },
  get resendApiKey() {
    return required("RESEND_API_KEY", process.env.RESEND_API_KEY);
  },
  get resendFromEmail() {
    return process.env.RESEND_FROM_EMAIL ?? "GRAVITY <onboarding@resend.dev>";
  },
  get adminUrlSegment() {
    return required("ADMIN_URL_SEGMENT", process.env.ADMIN_URL_SEGMENT);
  },
} as const;

/** True when all core Supabase env is present (used to gate auth-dependent UI). */
export function isSupabaseConfigured(): boolean {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);
}
