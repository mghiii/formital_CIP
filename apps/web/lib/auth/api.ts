import type { User } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/auth";

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

  if (profileError || !profile || profile.is_active === false) {
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
