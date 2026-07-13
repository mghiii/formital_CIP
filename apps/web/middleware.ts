import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { canAccessPath, getDashboardPath, isAppRole, isProtectedPath } from "@/lib/auth/roles";
import { redirectToAppPath, toAppUrl } from "@/lib/auth/redirects";
import { getPublicSupabaseConfig } from "@/lib/supabase/config";
import type { SupabaseCookieOptions } from "@/lib/supabase/cookies";
import type { Profile } from "@/types/auth";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  let response = NextResponse.next({ request });
  const config = getPublicSupabaseConfig();

  if (!config.isConfigured) {
    if (pathname !== "/setup") {
      return redirectToAppPath(request, "/setup");
    }

    return response;
  }

  const supabase = createServerClient(
    config.url,
    config.anonKey,
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

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user && isProtectedPath(pathname)) {
    const url = toAppUrl(request, "/login");
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (!user) {
    return response;
  }

  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const profile = data as Profile | null;

  if ((pathname === "/" || pathname === "/login") && profile?.is_active) {
    return redirectToAppPath(request, getDashboardPath(profile.role));
  }

  if (isProtectedPath(pathname)) {
    if (!profile) {
      console.error(`[auth] Profil manquant pour l'utilisateur ${user.id}.`);
      return redirectToAppPath(request, "/setup");
    }

    if (!profile.is_active) {
      return redirectToAppPath(request, "/inactive");
    }

    if (!isAppRole(profile.role)) {
      console.error(`[auth] Role invalide pour l'utilisateur ${user.id}: ${String(profile.role)}`);
      return redirectToAppPath(request, "/unauthorized");
    }

    if (!canAccessPath(profile, pathname)) {
      return redirectToAppPath(request, "/unauthorized");
    }

    response.headers.set("Cache-Control", "no-store, max-age=0");
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
