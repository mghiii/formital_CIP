import { NextResponse, type NextRequest } from "next/server";
import { getSafeReturnPath, toAppUrl } from "@/lib/auth/redirects";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function redirectAfterPost(request: NextRequest, path: string) {
  return NextResponse.redirect(toAppUrl(request, path), { status: 303 });
}

export async function GET(request: NextRequest) {
  return redirectAfterPost(request, "/engineer/history?error=use-delete-form");
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const formData = await request.formData();
  const cycleId = String(formData.get("cycle_id") ?? "");
  const cleanReturnTo = getSafeReturnPath(request, "/engineer/history");

  if (!cycleId) {
    return redirectAfterPost(request, `${cleanReturnTo}?error=missing-cycle`);
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return redirectAfterPost(request, "/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  if (!profile?.is_active || !["engineer", "admin"].includes(String(profile.role))) {
    return redirectAfterPost(request, "/unauthorized");
  }

  const db = createAdminSupabaseClient() ?? supabase;
  const { error } = await db.from("cip_cycles").delete().eq("id", cycleId);

  if (error) {
    return redirectAfterPost(request, `${cleanReturnTo}?error=cycle-delete`);
  }

  return redirectAfterPost(request, `${cleanReturnTo}?deleted=cycle`);
}
