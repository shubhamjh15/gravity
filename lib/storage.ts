import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Storage helpers. Public buckets get plain public URLs; private buckets
 * (gov-id, skill-proof, leaderboard-screenshots) are served via SHORT-TTL
 * signed URLs (#6 — PII files never public). Path convention is
 * "<auth.uid()>/<filename>" so RLS storage policies match the owner folder.
 */

export const PUBLIC_BUCKETS = [
  "avatars",
  "banners",
  "store-images",
  "community-gallery",
] as const;

export const PRIVATE_BUCKETS = [
  "gov-id",
  "skill-proof",
  "leaderboard-screenshots",
] as const;

export type PublicBucket = (typeof PUBLIC_BUCKETS)[number];
export type PrivateBucket = (typeof PRIVATE_BUCKETS)[number];

/** Public URL for an object in a public bucket. */
export async function publicUrl(
  bucket: PublicBucket,
  path: string,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Short-lived signed URL for a private object (default 60s). The caller must be
 * allowed to read the object (RLS storage policy enforces owner/superadmin).
 */
export async function signedUrl(
  bucket: PrivateBucket,
  path: string,
  expiresInSeconds = 60,
): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data) return null;
  return data.signedUrl;
}

/** Build the owner-scoped object path used everywhere: "<uid>/<name>". */
export function ownerPath(userId: string, filename: string): string {
  const safe = filename.replace(/[^\w.\-]+/g, "_");
  return `${userId}/${Date.now()}_${safe}`;
}
