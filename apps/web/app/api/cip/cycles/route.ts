import { NextResponse, type NextRequest } from "next/server";
import { getRouteAuthContext, isPrivilegedProfile } from "@/lib/auth/api";

export async function POST(request: NextRequest) {
  const context = await getRouteAuthContext();
  const formData = await request.formData();
  const equipmentId = String(formData.get("equipment_id") ?? "");
  const plannedAt = String(formData.get("planned_at") ?? "");
  const returnTo = request.headers.get("referer") ?? "/operator/cycles";
  const cleanReturnTo = returnTo.split("?")[0];

  if (!context) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!isPrivilegedProfile(context.profile)) {
    return NextResponse.redirect(new URL("/unauthorized", request.url));
  }

  if (!equipmentId) {
    return NextResponse.redirect(new URL(`${cleanReturnTo}?error=missing-equipment`, request.url));
  }

  const { supabase, user } = context;

  const { data: equipment, error: equipmentError } = await supabase
    .from("equipments")
    .select("id, process_id, status, is_active")
    .eq("id", equipmentId)
    .single();

  if (equipmentError || !equipment?.process_id || equipment.is_active === false) {
    return NextResponse.redirect(new URL(`${cleanReturnTo}?error=equipment-process`, request.url));
  }

  if (["cleaning", "in_cleaning", "out_of_service"].includes(String(equipment.status))) {
    return NextResponse.redirect(new URL(`${cleanReturnTo}?error=equipment-unavailable`, request.url));
  }

  const { data: activeCycle } = await supabase
    .from("cip_cycles")
    .select("id")
    .eq("equipment_id", equipment.id)
    .in("status", ["draft", "in_progress"])
    .limit(1)
    .maybeSingle();

  if (activeCycle?.id) {
    return NextResponse.redirect(new URL(`${cleanReturnTo}?error=equipment-has-active-cycle`, request.url));
  }

  const { data: cycle, error } = await supabase.from("cip_cycles").insert({
    operator_id: user.id,
    equipment_id: equipment.id,
    process_id: equipment.process_id,
    status: "draft",
    started_at: plannedAt ? new Date(plannedAt).toISOString() : new Date().toISOString()
  }).select("id").single();

  if (error || !cycle?.id) {
    return NextResponse.redirect(new URL(`${cleanReturnTo}?error=cycle-create`, request.url));
  }

  const { error: checklistError } = await supabase.from("cip_checklists").insert({
    cycle_id: cycle.id
  });

  if (checklistError) {
    return NextResponse.redirect(new URL(`${cleanReturnTo}?error=checklist-create`, request.url));
  }

  return NextResponse.redirect(new URL(`${cleanReturnTo}?created=cycle`, request.url));
}
