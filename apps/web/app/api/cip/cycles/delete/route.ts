import { NextResponse, type NextRequest } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function redirectAfterPost(url: URL) {
  return NextResponse.redirect(url, { status: 303 });
}

export async function GET(request: NextRequest) {
  return redirectAfterPost(new URL("/engineer/history?error=use-delete-form", request.url));
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const formData = await request.formData();
  const cycleId = String(formData.get("cycle_id") ?? "");
  const returnTo = request.headers.get("referer") ?? "/engineer/history";
  const cleanReturnTo = returnTo.split("?")[0];

  if (!cycleId) {
    return redirectAfterPost(new URL(`${cleanReturnTo}?error=missing-cycle`, request.url));
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return redirectAfterPost(new URL("/login", request.url));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  if (!profile?.is_active || !["engineer", "admin"].includes(String(profile.role))) {
    return redirectAfterPost(new URL("/unauthorized", request.url));
  }

  const db = createAdminSupabaseClient() ?? supabase;
  const { error } = await db.from("cip_cycles").delete().eq("id", cycleId);

  if (error) {
    return redirectAfterPost(new URL(`${cleanReturnTo}?error=cycle-delete`, request.url));
  }

  return redirectAfterPost(new URL(`${cleanReturnTo}?deleted=cycle`, request.url));
}
