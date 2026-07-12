import type { AppRole, Profile } from "@/types/auth";

export type AppRoute =
  | "/login"
  | "/forgot-password"
  | "/reset-password"
  | "/operator/dashboard"
  | "/engineer/dashboard"
  | "/admin/dashboard"
  | "/inactive"
  | "/unauthorized";

export const roleHomePath: Record<AppRole, AppRoute> = {
  operator: "/operator/dashboard",
  engineer: "/engineer/dashboard",
  admin: "/admin/dashboard"
};

export const protectedPrefixes = ["/operator", "/engineer", "/admin"] as const;

export function getRoleHomePath(role: AppRole): AppRoute {
  return roleHomePath[role];
}

export function getSafeRedirectPath(next: string | null, fallback: AppRoute): AppRoute {
  const allowedRoutes: AppRoute[] = [
    "/operator/dashboard",
    "/engineer/dashboard",
    "/admin/dashboard",
    "/inactive",
    "/unauthorized"
  ];

  return next && allowedRoutes.includes(next as AppRoute) ? (next as AppRoute) : fallback;
}

export function canAccessPath(profile: Profile, pathname: string): boolean {
  if (!profile.is_active) {
    return false;
  }

  if (pathname.startsWith("/admin")) {
    return profile.role === "admin";
  }

  if (pathname.startsWith("/engineer")) {
    return profile.role === "engineer" || profile.role === "admin";
  }

  if (pathname.startsWith("/operator")) {
    return profile.role === "operator" || profile.role === "engineer" || profile.role === "admin";
  }

  return true;
}

export function isProtectedPath(pathname: string): boolean {
  return protectedPrefixes.some((prefix) => pathname.startsWith(prefix));
}
