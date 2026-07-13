import { NextResponse, type NextRequest } from "next/server";
import { getRouteAuthContext, isPrivilegedProfile } from "@/lib/auth/api";

export async function POST(request: NextRequest) {
  const context = await getRouteAuthContext();
  const formData = await request.formData();
  const processId = String(formData.get("process_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const returnTo = request.headers.get("referer") ?? "/engineer/equipments";
  const cleanReturnTo = returnTo.split("?")[0];

  if (!processId || !name) {
    return NextResponse.redirect(new URL(`${cleanReturnTo}?error=missing-equipment-fields`, request.url));
  }

  if (!context) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!isPrivilegedProfile(context.profile)) {
    return NextResponse.redirect(new URL("/unauthorized", request.url));
  }

  const { supabase } = context;
  const { error } = await supabase.from("equipments").insert({
    process_id: processId,
    name,
    status: "available",
    is_active: true
  });

  if (error) {
    return NextResponse.redirect(new URL(`${cleanReturnTo}?error=equipment-create`, request.url));
  }

  return NextResponse.redirect(new URL(`${cleanReturnTo}?created=equipment`, request.url));
}
