import type { User } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/auth";
import type { AppRole } from "@/types/auth";

export type RouteAuthContext = {
  supabase: ReturnType<typeof createServerSupabaseClient>;
  user: User;
  profile: Profile;
};

export async function getRouteAuthContext(): Promise<RouteAuthContext | null> {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.is_active === false || profile.status === "inactive") {
    return null;
  }

  return {
    supabase,
    user,
    profile: profile as Profile
  };
}

export function isPrivilegedProfile(profile: Pick<Profile, "role">) {
  return profile.role === "engineer" || profile.role === "admin";
}

export type AdminUserAction = "create" | "read" | "update" | "delete" | "toggle" | "reset_password";

export function canManageProfileRole(actor: Pick<Profile, "role" | "id">, targetRole: AppRole, action: AdminUserAction) {
  if (actor.role === "admin") return true;
  if (actor.role !== "engineer") return false;

  if (action === "read" && targetRole === "engineer") {
    return true;
  }

  return targetRole === "operator";
}

export function canUseAdminUsersPanel(profile: Pick<Profile, "role">) {
  return profile.role === "admin" || profile.role === "engineer";
}
