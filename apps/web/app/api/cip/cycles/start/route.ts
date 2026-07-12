import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function checked(formData: FormData, name: string) {
  return formData.get(name) === "on";
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient();
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

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { data: equipment, error: equipmentError } = await supabase
    .from("equipments")
    .select("id, process_id, status")
    .eq("id", equipmentId)
    .single();

  if (equipmentError || !equipment?.process_id) {
    return NextResponse.redirect(new URL(`${cleanReturnTo}?error=equipment-process`, request.url));
  }

  if (["in_cleaning", "out_of_service"].includes(String(equipment.status))) {
    return NextResponse.redirect(new URL(`${cleanReturnTo}?error=equipment-unavailable`, request.url));
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
