import { NextResponse, type NextRequest } from "next/server";
import { getRouteAuthContext } from "@/lib/auth/api";
import { getSafeReturnPath, toAppUrl } from "@/lib/auth/redirects";
import {
  checklistFromFormData,
  createCycleThroughWorkflow,
  isChecklistComplete,
  startCycleThroughWorkflow
} from "@/lib/cip/workflow";

export async function POST(request: NextRequest) {
  const context = await getRouteAuthContext();
  const formData = await request.formData();
  const equipmentId = String(formData.get("equipment_id") ?? "");
  const cleanReturnTo = getSafeReturnPath(request, "/operator/dashboard");

  const checklist = checklistFromFormData(formData);
  const allValidated = isChecklistComplete(checklist);

  if (!equipmentId) {
    return NextResponse.redirect(toAppUrl(request, `${cleanReturnTo}?error=missing-equipment`));
  }

  if (!allValidated) {
    return NextResponse.redirect(toAppUrl(request, `${cleanReturnTo}?error=checklist-incomplete`));
  }

  if (!context) {
    return NextResponse.redirect(toAppUrl(request, "/login"));
  }

  const { supabase, user, profile } = context;

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

  const now = new Date().toISOString();
  const createResult = await createCycleThroughWorkflow({
    supabase,
    payload: {
      p_equipment_id: equipment.id,
      p_operator_id: profile.role === "operator" ? user.id : null,
      p_planned_start_time: now,
      p_planned_duration_minutes: 45,
      p_status: "planned",
      p_valves_open: checklist.valves_open,
      p_cleaning_product_available: checklist.cleaning_product_available,
      p_tank_empty: checklist.tank_empty,
      p_circuit_selected: checklist.circuit_selected,
      p_safety_conditions_checked: checklist.safety_conditions_checked
    }
  });

  if (!createResult.ok) {
    return NextResponse.redirect(toAppUrl(request, `${cleanReturnTo}?error=${encodeURIComponent(createResult.code)}`));
  }

  if (!createResult.cycleId) {
    return NextResponse.redirect(toAppUrl(request, `${cleanReturnTo}?error=database-error`));
  }

  const startResult = await startCycleThroughWorkflow({ supabase, cycleId: createResult.cycleId, forceStart: false });

  if (!startResult.ok) {
    return NextResponse.redirect(toAppUrl(request, `${cleanReturnTo}?error=${encodeURIComponent(startResult.code)}`));
  }

  return NextResponse.redirect(toAppUrl(request, `${cleanReturnTo}?started=cycle`));
}
