import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const formData = await request.formData();
  const equipmentId = String(formData.get("equipment_id") ?? "");
  const plannedAt = String(formData.get("planned_at") ?? "");
  const returnTo = request.headers.get("referer") ?? "/operator/cycles";

  if (!equipmentId) {
    return NextResponse.redirect(new URL(`${returnTo.split("?")[0]}?error=missing-equipment`, request.url));
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { data: equipment, error: equipmentError } = await supabase
    .from("equipments")
    .select("id, process_id")
    .eq("id", equipmentId)
    .single();

  if (equipmentError || !equipment?.process_id) {
    return NextResponse.redirect(new URL(`${returnTo.split("?")[0]}?error=equipment-process`, request.url));
  }

  const { data: cycle, error } = await supabase.from("cip_cycles").insert({
    operator_id: user.id,
    equipment_id: equipment.id,
    process_id: equipment.process_id,
    status: "draft",
    started_at: plannedAt ? new Date(plannedAt).toISOString() : new Date().toISOString()
  }).select("id").single();

  if (error || !cycle?.id) {
    return NextResponse.redirect(new URL(`${returnTo.split("?")[0]}?error=cycle-create`, request.url));
  }

  const { error: checklistError } = await supabase.from("cip_checklists").insert({
    cycle_id: cycle.id
  });

  if (checklistError) {
    return NextResponse.redirect(new URL(`${returnTo.split("?")[0]}?error=checklist-create`, request.url));
  }

  return NextResponse.redirect(new URL(`${returnTo.split("?")[0]}?created=cycle`, request.url));
}
