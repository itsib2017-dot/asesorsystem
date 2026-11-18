/**
 * src/lib/supabase/client.ts
 *
 * Browser-side Supabase client using @supabase/ssr.
 * Strictly for Auth and Storage only (per ground_rules_v5.md §A.2).
 */
import { createBrowserClient } from "@supabase/ssr";

let client: ReturnType<typeof createBrowserClient> | undefined;

export function getSupabaseBrowserClient() {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "[Supabase Browser Client] NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set.",
    );
  }

  client = createBrowserClient(url, anonKey);
  return client;
}
