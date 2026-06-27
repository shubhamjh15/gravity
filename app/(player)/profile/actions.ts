"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import {
  profileSchema,
  privateProfileSchema,
  gameProfileSchema,
  documentUploadSchema,
} from "@/lib/validators/profile";
import { ok, fail, zodErrors, type ActionResult } from "@/lib/action-result";

/**
 * Profile server actions. Each validates input with Zod, then writes via the
 * RLS-scoped server client (so a user can only ever change their OWN rows).
 * PII goes to profiles_private. profile_completion_pct is recomputed by DB
 * triggers (migration 0007) — we never set it here.
 */

export async function updateProfile(
  input: unknown,
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return fail("You must be logged in.");

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", zodErrors(parsed.error.issues));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.display_name,
      age: parsed.data.age ?? null,
      gender: parsed.data.gender ?? null,
    })
    .eq("id", user.id);

  if (error) return fail("Could not save your profile. Try again.");
  revalidatePath("/profile");
  return ok(undefined, "Profile updated.");
}

export async function updatePrivateProfile(
  input: unknown,
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return fail("You must be logged in.");

  const parsed = privateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", zodErrors(parsed.error.issues));
  }

  const supabase = await createSupabaseServerClient();
  // Upsert: the row exists from signup, but be defensive.
  const { error } = await supabase.from("profiles_private").upsert(
    {
      user_id: user.id,
      phone: parsed.data.phone || null,
      upi_id: parsed.data.upi_id || null,
      gov_id_type: parsed.data.gov_id_type ?? null,
    },
    { onConflict: "user_id" },
  );

  if (error) return fail("Could not save your private details. Try again.");
  revalidatePath("/profile");
  return ok(undefined, "Private details saved.");
}

export async function upsertGameProfile(
  input: unknown,
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return fail("You must be logged in.");

  const parsed = gameProfileSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", zodErrors(parsed.error.issues));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("player_game_profiles").upsert(
    {
      user_id: user.id,
      game_id: parsed.data.game_id,
      in_game_id: parsed.data.in_game_id,
      ign: parsed.data.ign ?? null,
      ranking: parsed.data.ranking ?? null,
      kill_ratio: parsed.data.kill_ratio ?? null,
      win_ratio: parsed.data.win_ratio ?? null,
    },
    { onConflict: "user_id,game_id" },
  );

  if (error) return fail("Could not save your game profile. Try again.");
  revalidatePath("/profile");
  return ok(undefined, "Game profile saved.");
}

export async function saveDocument(input: unknown): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return fail("You must be logged in.");

  const parsed = documentUploadSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Upload failed validation.", zodErrors(parsed.error.issues));
  }

  const supabase = await createSupabaseServerClient();

  // Record the document (file already uploaded to the private bucket client-side).
  const { error: docErr } = await supabase.from("player_documents").insert({
    user_id: user.id,
    doc_type: parsed.data.doc_type,
    file_path: parsed.data.file_path,
  });
  if (docErr) return fail("Could not record the document. Try again.");

  // If it's a gov-id, stamp the path + type onto profiles_private.
  if (parsed.data.doc_type === "gov_id") {
    await supabase.from("profiles_private").upsert(
      {
        user_id: user.id,
        gov_id_doc_path: parsed.data.file_path,
        gov_id_type: parsed.data.gov_id_type ?? null,
      },
      { onConflict: "user_id" },
    );
  }

  revalidatePath("/profile");
  return ok(undefined, "Document uploaded for review.");
}
