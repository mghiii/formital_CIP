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

export const appRoles = ["operator", "engineer", "admin"] as const;

export const dashboardPath: Record<AppRole, AppRoute> = {
  operator: "/operator/dashboard",
  engineer: "/engineer/dashboard",
  admin: "/admin/dashboard"
};

export const protectedPrefixes = ["/operator", "/engineer", "/admin"] as const;

export function isAppRole(role: unknown): role is AppRole {
  return typeof role === "string" && appRoles.includes(role as AppRole);
}

export function getDashboardPath(role: AppRole | string | null | undefined): AppRoute {
  return isAppRole(role) ? dashboardPath[role] : "/unauthorized";
}

export function getRoleHomePath(role: AppRole): AppRoute {
  return getDashboardPath(role);
}

export function getSafeRedirectPath(next: string | null, fallback: AppRoute, role?: AppRole | string | null): AppRoute {
  const allowedRoutes: AppRoute[] = [
    "/operator/dashboard",
    "/engineer/dashboard",
    "/admin/dashboard",
    "/inactive",
    "/unauthorized"
  ];

  if (!next || !allowedRoutes.includes(next as AppRoute)) {
    return fallback;
  }

  if (role && isProtectedPath(next) && !canRoleAccessPath(role, next)) {
    return fallback;
  }

  return next as AppRoute;
}

export function canRoleAccessPath(role: AppRole | string | null | undefined, pathname: string): boolean {
  if (!isAppRole(role)) {
    return false;
  }

  if (pathname.startsWith("/admin")) {
    return role === "admin";
  }

  if (pathname.startsWith("/engineer")) {
    return role === "engineer";
  }

  if (pathname.startsWith("/operator")) {
    return role === "operator";
  }

  return true;
}

export function canAccessPath(profile: Profile, pathname: string): boolean {
  if (!profile.is_active) {
    return false;
  }

  return canRoleAccessPath(profile.role, pathname);
}

export function isProtectedPath(pathname: string): boolean {
  return protectedPrefixes.some((prefix) => pathname.startsWith(prefix));
}
