import { NextResponse, type NextRequest } from "next/server";
import { getRouteAuthContext } from "@/lib/auth/api";
import { getSafeReturnPath, toAppUrl } from "@/lib/auth/redirects";

function checked(formData: FormData, name: string) {
  return formData.get(name) === "on";
}

function workflowErrorCode(code?: string) {
  return (code ?? "cycle-start").toLowerCase().replaceAll("_", "-");
}

export async function POST(request: NextRequest) {
  const context = await getRouteAuthContext();
  const formData = await request.formData();
  const equipmentId = String(formData.get("equipment_id") ?? "");
  const cleanReturnTo = getSafeReturnPath(request, "/operator/dashboard");

  const checklist = {
    valves_open: checked(formData, "valves_open"),
    cleaning_product_available: checked(formData, "cleaning_product_available"),
    tank_empty: checked(formData, "tank_empty"),
    circuit_selected: checked(formData, "circuit_selected"),
    safety_conditions_checked: checked(formData, "safety_conditions_checked")
  };

  const allValidated = Object.values(checklist).every(Boolean);

  if (!equipmentId) {
    return NextResponse.redirect(toAppUrl(request, `${cleanReturnTo}?error=missing-equipment`));
  }

  if (!allValidated) {
    return NextResponse.redirect(toAppUrl(request, `${cleanReturnTo}?error=checklist-incomplete`));
  }

  if (!context) {
    return NextResponse.redirect(toAppUrl(request, "/login"));
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

  const { data: cycle, error: cycleError } = await supabase
    .from("cip_cycles")
    .insert({
      operator_id: user.id,
      equipment_id: equipment.id,
      process_id: equipment.process_id,
      status: "planned",
      started_at: new Date().toISOString(),
      planned_start_time: new Date().toISOString(),
      planned_duration_minutes: 45
    })
    .select("id")
    .single();

  if (cycleError || !cycle?.id) {
    return NextResponse.redirect(toAppUrl(request, `${cleanReturnTo}?error=cycle-create`));
  }

  const { error: checklistError } = await supabase.from("cip_checklists").upsert({
    cycle_id: cycle.id,
    ...checklist,
    validated_at: new Date().toISOString()
  }, {
    onConflict: "cycle_id"
  });

  if (checklistError) {
    return NextResponse.redirect(toAppUrl(request, `${cleanReturnTo}?error=checklist-create`));
  }

  const { data: startResult, error: startError } = await supabase.rpc("start_planned_cip_cycle", {
    p_cycle_id: cycle.id,
    p_force: false
  });

  const result = startResult as { ok?: boolean; code?: string } | null;
  if (startError || result?.ok !== true) {
    return NextResponse.redirect(toAppUrl(request, `${cleanReturnTo}?error=${encodeURIComponent(workflowErrorCode(result?.code))}`));
  }

  return NextResponse.redirect(toAppUrl(request, `${cleanReturnTo}?started=cycle`));
}
