"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import { ok, fail, type ActionResult } from "@/lib/action-result";

/** Save the About page Tiptap JSON (super-admin only). Upserts the 'main' page. */
export async function saveAbout(input: {
  content_json: unknown;
}): Promise<ActionResult> {
  const { user, isSuperadmin } = await getAuthContext();
  if (!user || !isSuperadmin) return fail("Not authorized.");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("about_pages").upsert(
    {
      slug: "main",
      content_json: input.content_json as Record<string, unknown>,
      updated_by: user.id,
    },
    { onConflict: "slug" },
  );
  if (error) return fail("Could not save the About page.");

  revalidatePath("/about");
  return ok(undefined, "About page saved.");
}
