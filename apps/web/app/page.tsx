import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { getDashboardPath, isAppRole } from "@/lib/auth/roles";

export default async function HomePage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (!profile.is_active) {
    redirect("/inactive");
  }

  redirect(isAppRole(profile.role) ? getDashboardPath(profile.role) : "/unauthorized");
}
