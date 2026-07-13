import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { canAccessPath, getDashboardPath, isAppRole } from "@/lib/auth/roles";
import { getPublicSupabaseConfig } from "@/lib/supabase/config";
import type { Profile } from "@/types/auth";

export async function getCurrentProfile(): Promise<Profile | null> {
  if (!getPublicSupabaseConfig().isConfigured) {
    return null;
  }

  const supabase = createServerSupabaseClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  if (error || !data) {
    return null;
  }

  return data as Profile;
}

export async function requireProfile(pathname: string): Promise<Profile> {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect(`/login?next=${encodeURIComponent(pathname)}`);
  }

  if (profile.is_active === false || profile.status === "inactive") {
    redirect("/inactive");
  }

  if (!isAppRole(profile.role)) {
    redirect("/unauthorized");
  }

  if (!canAccessPath(profile, pathname)) {
    redirect("/unauthorized");
  }

  return profile;
}

export async function redirectAuthenticatedUser() {
  const profile = await getCurrentProfile();

  if (profile?.is_active && profile.status !== "inactive") {
    redirect(isAppRole(profile.role) ? getDashboardPath(profile.role) : "/unauthorized");
  }
}
