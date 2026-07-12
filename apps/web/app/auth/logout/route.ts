import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { requirePublicSupabaseConfig } from "@/lib/supabase/config";
import type { SupabaseCookieOptions } from "@/lib/supabase/cookies";

async function signOut(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  const { url, anonKey } = requirePublicSupabaseConfig();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: SupabaseCookieOptions) {
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: SupabaseCookieOptions) {
        response.cookies.set({ name, value: "", ...options });
      }
    }
  });

  await supabase.auth.signOut();

  return response;
}

export async function POST(request: NextRequest) {
  return signOut(request);
}

export async function GET(request: NextRequest) {
  return signOut(request);
}
