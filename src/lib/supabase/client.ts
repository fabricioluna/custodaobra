import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/types/database";

import { getSupabasePublishableKey, getSupabaseUrl } from "./env";

/** Cliente do Supabase para Client Components. Respeita RLS. */
export function createClient() {
  return createBrowserClient<Database>(
    getSupabaseUrl(),
    getSupabasePublishableKey(),
  );
}
