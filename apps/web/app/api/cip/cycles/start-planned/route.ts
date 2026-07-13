import { NextResponse, type NextRequest } from "next/server";
import { getRouteAuthContext } from "@/lib/auth/api";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

function checked(formData: FormData, name: string) {
  return formData.get(name) === "on";
}

function redirectAfterPost(url: URL) {
  return NextResponse.redirect(url, { status: 303 });
}

export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/operator/dashboard?error=use-cycle-form", request.url), { status: 303 });
}

export async function POST(request: NextRequest) {
  const context = await getRouteAuthContext();
  const formData = await request.formData();
  const cycleId = String(formData.get("cycle_id") ?? "");
  const returnTo = request.headers.get("referer") ?? "/operator/dashboard";
  const cleanReturnTo = returnTo.split("?")[0];

  if (!cycleId) {
    return redirectAfterPost(new URL(`${cleanReturnTo}?error=missing-cycle`, request.url));
  }

  if (!context) {
    return redirectAfterPost(new URL("/login", request.url));
  }

  const { supabase, user } = context;
  const db = createAdminSupabaseClient() ?? supabase;

  const { data: plannedCycle } = await db
    .from("cip_cycles")
    .select("id, equipment_id, status, equipments(status, is_active)")
    .eq("id", cycleId)
    .eq("status", "draft")
    .single();

  const equipment = Array.isArray(plannedCycle?.equipments) ? plannedCycle?.equipments[0] : plannedCycle?.equipments;

  if (!plannedCycle?.id || equipment?.is_active === false || ["cleaning", "in_cleaning", "out_of_service"].includes(String(equipment?.status ?? ""))) {
    return redirectAfterPost(new URL(`${cleanReturnTo}?error=cycle-unavailable`, request.url));
  }

  const checklist = {
    cycle_id: cycleId,
    valves_open: checked(formData, "valves_open"),
    cleaning_product_available: checked(formData, "cleaning_product_available"),
    tank_empty: checked(formData, "tank_empty"),
    circuit_selected: checked(formData, "circuit_selected"),
    safety_conditions_checked: checked(formData, "safety_conditions_checked"),
    validated_at: new Date().toISOString()
  };

  const allValidated = [
    checklist.valves_open,
    checklist.cleaning_product_available,
    checklist.tank_empty,
    checklist.circuit_selected,
    checklist.safety_conditions_checked
  ].every(Boolean);

  if (!allValidated) {
    return redirectAfterPost(new URL(`${cleanReturnTo}?error=checklist-incomplete`, request.url));
  }

  const { error: checklistError } = await db.from("cip_checklists").upsert(checklist, {
    onConflict: "cycle_id"
  });

  if (checklistError) {
    return redirectAfterPost(new URL(`${cleanReturnTo}?error=checklist-save`, request.url));
  }

  const { data: cycle, error: cycleError } = await db
    .from("cip_cycles")
    .update({
      operator_id: user.id,
      status: "in_progress",
      started_at: new Date().toISOString()
    })
    .eq("id", cycleId)
    .eq("status", "draft")
    .select("id")
    .single();

  if (cycleError || !cycle?.id) {
    return redirectAfterPost(new URL(`${cleanReturnTo}?error=cycle-start`, request.url));
  }

  return redirectAfterPost(new URL(`${cleanReturnTo}?started=planned-cycle`, request.url));
}
