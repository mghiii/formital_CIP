"use client";

import { createBrowserClient } from "@supabase/ssr";
import { requirePublicSupabaseConfig } from "@/lib/supabase/config";

export function createBrowserSupabaseClient() {
  const { url, anonKey } = requirePublicSupabaseConfig();

  return createBrowserClient(url, anonKey);
}
