import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const formData = await request.formData();
  const processId = String(formData.get("process_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const returnTo = request.headers.get("referer") ?? "/engineer/equipments";
  const cleanReturnTo = returnTo.split("?")[0];

  if (!processId || !name) {
    return NextResponse.redirect(new URL(`${cleanReturnTo}?error=missing-equipment-fields`, request.url));
  }

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
