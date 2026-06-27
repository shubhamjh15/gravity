"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { ok, fail, type ActionResult } from "@/lib/action-result";

/**
 * Persist avatar/banner object paths after a client-side upload to the public
 * buckets. Paths are validated to live under the user's own folder so a user
 * can't point their profile at someone else's object.
 */
const mediaSchema = z
  .object({
    avatar_path: z.string().min(1).optional(),
    banner_path: z.string().min(1).optional(),
  })
  .refine((v) => v.avatar_path || v.banner_path, {
    message: "Nothing to update.",
  });

export async function saveAvatarBanner(input: unknown): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return fail("You must be logged in.");

  const parsed = mediaSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid media update.");

  // Enforce owner-folder convention: "<uid>/...".
  const ownsPath = (p?: string) => !p || p.startsWith(`${user.id}/`);
  if (!ownsPath(parsed.data.avatar_path) || !ownsPath(parsed.data.banner_path)) {
    return fail("Invalid file path.");
  }

  const update: Record<string, string> = {};
  if (parsed.data.avatar_path) update.avatar_path = parsed.data.avatar_path;
  if (parsed.data.banner_path) update.banner_path = parsed.data.banner_path;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", user.id);

  if (error) return fail("Could not save the image. Try again.");
  revalidatePath("/profile");
  return ok(undefined, "Image saved.");
}
