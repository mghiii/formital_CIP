import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getRoleHomePath } from "@/lib/auth/roles";
import type { SupabaseCookieOptions } from "@/lib/supabase/cookies";
import type { Profile } from "@/types/auth";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next");
  const response = NextResponse.redirect(new URL(next && next.startsWith("/") ? next : "/login", request.url));

  if (!code) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
    }
  );

  const { data } = await supabase.auth.exchangeCodeForSession(code);
  if (!data.user) {
    return response;
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", data.user.id).single();
  if (!profile) {
    return response;
  }

  const typedProfile = profile as Profile;
  return NextResponse.redirect(new URL(typedProfile.is_active ? getRoleHomePath(typedProfile.role) : "/inactive", request.url));
}
