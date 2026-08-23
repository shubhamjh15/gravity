"use client";

/**
 * Google sign-in button. Kicks off Supabase OAuth; on return the user lands on
 * /auth/callback which exchanges the code for a session. `next` is preserved
 * so users come back to where they were headed.
 */
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";
import { Button } from "@/components/ui/button";

function GoogleGlyph() {
  /**
   * Google's canonical four-colour "G", 48x48 coordinate space.
   *
   * The previous version used hand-rounded approximations of these paths and
   * rendered as an orange smear: the arcs no longer met, so the yellow ring
   * painted over everything instead of being masked by the blue and green
   * segments. These are the official coordinates, unrounded — the brand mark
   * only reads correctly at full precision.
   */
  return (
    <svg viewBox="0 0 48 48" className="size-5 shrink-0" aria-hidden focusable="false">
      <path
        fill="#FFC107"
        d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"
      />
      <path
        fill="#FF3D00"
        d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"
      />
      <path
        fill="#1976D2"
        d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"
      />
    </svg>
  );
}

export function GoogleSignIn() {
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/profile";

  async function signIn() {
    if (!isSupabaseConfigured()) {
      toast.error("Sign-in isn't wired yet", {
        description:
          "Add your Supabase keys to .env.local and enable Google in the Supabase dashboard.",
      });
      return;
    }
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      toast.error("Could not start sign-in", { description: error.message });
      setLoading(false);
    }
    // On success the browser is redirected to Google.
  }

  return (
    <Button
      onClick={signIn}
      disabled={loading}
      variant="outline"
      size="xl"
      className="w-full bg-surface/60"
    >
      <GoogleGlyph />
      {loading ? "Redirecting…" : "Continue with Google"}
    </Button>
  );
}
