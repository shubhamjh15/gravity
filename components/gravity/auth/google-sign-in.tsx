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
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35 24 35c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.6 20-21 0-1.2-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 5.1 29.6 3 24 3 16 3 9.1 7.6 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 45c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 36 26.7 37 24 37c-5.3 0-9.7-2.6-11.3-7l-6.5 5C9.1 42.3 16 45 24 45z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.3 5.3C41.4 36.9 44 31 44 24c0-1.2-.1-2.3-.4-3.5z"
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
