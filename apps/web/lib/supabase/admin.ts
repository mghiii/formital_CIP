import { createClient } from "@supabase/supabase-js";
import { requirePublicSupabaseConfig } from "@/lib/supabase/config";

export function createAdminSupabaseClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRoleKey) return null;

  const { url } = requirePublicSupabaseConfig();

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
