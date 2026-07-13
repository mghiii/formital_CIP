import { NextResponse, type NextRequest } from "next/server";
import { getRouteAuthContext } from "@/lib/auth/api";

function checked(formData: FormData, name: string) {
  return formData.get(name) === "on";
}

export async function POST(request: NextRequest) {
  const context = await getRouteAuthContext();
  const formData = await request.formData();
  const equipmentId = String(formData.get("equipment_id") ?? "");
  const returnTo = request.headers.get("referer") ?? "/operator/dashboard";
  const cleanReturnTo = returnTo.split("?")[0];

  const checklist = {
    valves_open: checked(formData, "valves_open"),
    cleaning_product_available: checked(formData, "cleaning_product_available"),
    tank_empty: checked(formData, "tank_empty"),
    circuit_selected: checked(formData, "circuit_selected"),
    safety_conditions_checked: checked(formData, "safety_conditions_checked")
  };

  const allValidated = Object.values(checklist).every(Boolean);

  if (!equipmentId) {
    return NextResponse.redirect(new URL(`${cleanReturnTo}?error=missing-equipment`, request.url));
  }

  if (!allValidated) {
    return NextResponse.redirect(new URL(`${cleanReturnTo}?error=checklist-incomplete`, request.url));
  }

  if (!context) {
    return NextResponse.redirect(new URL("/login", request.url));
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

  const { data: cycle, error: cycleError } = await supabase
    .from("cip_cycles")
    .insert({
      operator_id: user.id,
      equipment_id: equipment.id,
      process_id: equipment.process_id,
      status: "draft",
      started_at: new Date().toISOString()
    })
    .select("id")
    .single();

  if (cycleError || !cycle?.id) {
    return NextResponse.redirect(new URL(`${cleanReturnTo}?error=cycle-create`, request.url));
  }

  const { error: checklistError } = await supabase.from("cip_checklists").insert({
    cycle_id: cycle.id,
    ...checklist,
    validated_at: new Date().toISOString()
  });

  if (checklistError) {
    return NextResponse.redirect(new URL(`${cleanReturnTo}?error=checklist-create`, request.url));
  }

  const { error: startError } = await supabase
    .from("cip_cycles")
    .update({
      status: "in_progress",
      started_at: new Date().toISOString()
    })
    .eq("id", cycle.id);

  if (startError) {
    return NextResponse.redirect(new URL(`${cleanReturnTo}?error=cycle-start`, request.url));
  }

  return NextResponse.redirect(new URL(`${cleanReturnTo}?started=cycle`, request.url));
}
