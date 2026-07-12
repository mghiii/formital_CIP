import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { requirePublicSupabaseConfig } from "@/lib/supabase/config";

export function createServerSupabaseClient() {
  const cookieStore = cookies();
  const { url, anonKey } = requirePublicSupabaseConfig();

  return createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set() {
        // Server Components cannot mutate cookies; route handlers and middleware handle refreshes.
      },
      remove() {
        // Server Components cannot mutate cookies; route handlers and middleware handle refreshes.
      }
    }
  });
}
