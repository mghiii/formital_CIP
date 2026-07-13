import { NextResponse, type NextRequest } from "next/server";
import { getRouteAuthContext, isPrivilegedProfile } from "@/lib/auth/api";
import { getSafeReturnPath, toAppUrl } from "@/lib/auth/redirects";

export async function POST(request: NextRequest) {
  const context = await getRouteAuthContext();
  const formData = await request.formData();
  const equipmentId = String(formData.get("equipment_id") ?? "");
  const plannedAt = String(formData.get("planned_at") ?? "");
  const operatorId = String(formData.get("operator_id") ?? "").trim();
  const plannedDuration = Number(String(formData.get("planned_duration_minutes") ?? "45").replace(",", "."));
  const priority = String(formData.get("priority") ?? "normal").trim() || "normal";
  const instructions = String(formData.get("instructions") ?? "").trim();
  const observation = String(formData.get("observation") ?? "").trim();
  const cleanReturnTo = getSafeReturnPath(request, "/operator/cycles");

  if (!context) {
    return NextResponse.redirect(toAppUrl(request, "/login"));
  }

  if (!isPrivilegedProfile(context.profile)) {
    return NextResponse.redirect(toAppUrl(request, "/unauthorized"));
  }

  if (!equipmentId) {
    return NextResponse.redirect(toAppUrl(request, `${cleanReturnTo}?error=missing-equipment`));
  }

  const { supabase, user } = context;

  const { data: equipment, error: equipmentError } = await supabase
    .from("equipments")
    .select("id, process_id, status, is_active")
    .eq("id", equipmentId)
    .single();

  if (equipmentError || !equipment?.process_id || equipment.is_active === false) {
    return NextResponse.redirect(toAppUrl(request, `${cleanReturnTo}?error=equipment-process`));
  }

  if (["cleaning", "in_cleaning", "out_of_service"].includes(String(equipment.status))) {
    return NextResponse.redirect(toAppUrl(request, `${cleanReturnTo}?error=equipment-unavailable`));
  }

  const { data: activeCycle } = await supabase
    .from("cip_cycles")
    .select("id")
    .eq("equipment_id", equipment.id)
    .in("status", ["in_progress", "running"])
    .limit(1)
    .maybeSingle();

  if (activeCycle?.id) {
    return NextResponse.redirect(toAppUrl(request, `${cleanReturnTo}?error=equipment-has-active-cycle`));
  }

  const { data: cycle, error } = await supabase.from("cip_cycles").insert({
    operator_id: operatorId || null,
    equipment_id: equipment.id,
    process_id: equipment.process_id,
    status: "planned",
    started_at: plannedAt ? new Date(plannedAt).toISOString() : new Date().toISOString(),
    planned_start_time: plannedAt ? new Date(plannedAt).toISOString() : new Date().toISOString(),
    planned_duration_minutes: Number.isFinite(plannedDuration) && plannedDuration > 0 ? Math.round(plannedDuration) : 45,
    planned_by: user.id,
    priority,
    instructions: instructions || null,
    observation: observation || null
  }).select("id").single();

  if (error || !cycle?.id) {
    return NextResponse.redirect(toAppUrl(request, `${cleanReturnTo}?error=cycle-create`));
  }

  const { error: checklistError } = await supabase.from("cip_checklists").upsert({
    cycle_id: cycle.id
  }, {
    onConflict: "cycle_id"
  });

  if (checklistError) {
    return NextResponse.redirect(toAppUrl(request, `${cleanReturnTo}?error=checklist-create`));
  }

  return NextResponse.redirect(toAppUrl(request, `${cleanReturnTo}?created=cycle`));
}
