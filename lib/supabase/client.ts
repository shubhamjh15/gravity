"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/types";

/**
 * Browser-side Supabase client. Uses the public anon key (RLS-limited, safe to
 * ship to the browser). For Client Components that need realtime (chat,
 * notifications, live slot counts) or client-side reads.
 *
 * A module-level singleton avoids creating a new client per render.
 */
let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createSupabaseBrowserClient() {
  if (client) return client;
  client = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return client;
}
