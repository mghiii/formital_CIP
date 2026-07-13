import { NextResponse, type NextRequest } from "next/server";
import { getRouteAuthContext, isPrivilegedProfile } from "@/lib/auth/api";
import { getSafeReturnPath, toAppUrl } from "@/lib/auth/redirects";

export async function POST(request: NextRequest) {
  const context = await getRouteAuthContext();
  const formData = await request.formData();
  const processId = String(formData.get("process_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const cleanReturnTo = getSafeReturnPath(request, "/engineer/equipments");

  if (!processId || !name) {
    return NextResponse.redirect(toAppUrl(request, `${cleanReturnTo}?error=missing-equipment-fields`));
  }

  if (!context) {
    return NextResponse.redirect(toAppUrl(request, "/login"));
  }

  if (!isPrivilegedProfile(context.profile)) {
    return NextResponse.redirect(toAppUrl(request, "/unauthorized"));
  }

  const { supabase } = context;
  const { error } = await supabase.from("equipments").insert({
    process_id: processId,
    name,
    status: "available",
    is_active: true
  });

  if (error) {
    return NextResponse.redirect(toAppUrl(request, `${cleanReturnTo}?error=equipment-create`));
  }

  return NextResponse.redirect(toAppUrl(request, `${cleanReturnTo}?created=equipment`));
}
