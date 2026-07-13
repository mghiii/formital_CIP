import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { redirectToAppPath } from "@/lib/auth/redirects";
import { requirePublicSupabaseConfig } from "@/lib/supabase/config";
import type { SupabaseCookieOptions } from "@/lib/supabase/cookies";

async function signOut(request: NextRequest) {
  const response = redirectToAppPath(request, "/login", 303);
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
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith("sb-") || cookie.name.toLowerCase().includes("supabase")) {
      response.cookies.set({ name: cookie.name, value: "", path: "/", maxAge: 0 });
    }
  }
  response.headers.set("Cache-Control", "no-store, max-age=0");

  return response;
}

export async function POST(request: NextRequest) {
  return signOut(request);
}

export async function GET(request: NextRequest) {
  return signOut(request);
}
