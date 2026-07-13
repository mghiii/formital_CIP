import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getDashboardPath, isAppRole } from "@/lib/auth/roles";
import { redirectToAppPath, safeAppPath } from "@/lib/auth/redirects";
import { requirePublicSupabaseConfig } from "@/lib/supabase/config";
import type { SupabaseCookieOptions } from "@/lib/supabase/cookies";
import type { Profile } from "@/types/auth";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeAppPath(requestUrl.searchParams.get("next") ?? "", "/login");
  const cookieWrites: Array<{ name: string; value: string; options: SupabaseCookieOptions }> = [];

  if (!code) {
    return redirectToAppPath(request, next);
  }

  const { url, anonKey } = requirePublicSupabaseConfig();
  const supabase = createServerClient(
    url,
    anonKey,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: SupabaseCookieOptions) {
          cookieWrites.push({ name, value, options });
        },
        remove(name: string, options: SupabaseCookieOptions) {
          cookieWrites.push({ name, value: "", options });
        }
      }
    }
  );

  const { data } = await supabase.auth.exchangeCodeForSession(code);
  if (!data.user) {
    return redirectToAppPath(request, "/login");
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", data.user.id).single();
  if (!profile) {
    console.error(`[auth] Profil manquant apres callback pour l'utilisateur ${data.user.id}.`);
    return redirectToAppPath(request, "/setup");
  }

  const typedProfile = profile as Profile;
  const targetPath = typedProfile.is_active
    ? isAppRole(typedProfile.role)
      ? getDashboardPath(typedProfile.role)
      : "/unauthorized"
    : "/inactive";
  const response = redirectToAppPath(request, targetPath);
  for (const cookie of cookieWrites) {
    response.cookies.set({ name: cookie.name, value: cookie.value, ...cookie.options });
  }

  return response;
}
