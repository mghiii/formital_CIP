import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { canAccessPath, getRoleHomePath, isProtectedPath } from "@/lib/auth/roles";
import { getPublicSupabaseConfig } from "@/lib/supabase/config";
import type { SupabaseCookieOptions } from "@/lib/supabase/cookies";
import type { Profile } from "@/types/auth";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  let response = NextResponse.next({ request });
  const config = getPublicSupabaseConfig();

  if (!config.isConfigured) {
    if (pathname !== "/setup") {
      return NextResponse.redirect(new URL("/setup", request.url));
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
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (!user) {
    return response;
  }

  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const profile = data as Profile | null;

  if ((pathname === "/" || pathname === "/login") && profile?.is_active) {
    return NextResponse.redirect(new URL(getRoleHomePath(profile.role), request.url));
  }

  if (isProtectedPath(pathname)) {
    if (!profile) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    if (!profile.is_active) {
      return NextResponse.redirect(new URL("/inactive", request.url));
    }

    if (!canAccessPath(profile, pathname)) {
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
