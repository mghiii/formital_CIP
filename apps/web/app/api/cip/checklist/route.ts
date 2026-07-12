import { NextResponse, type NextRequest } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function checked(formData: FormData, name: string) {
  return formData.get(name) === "on";
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const formData = await request.formData();
  const cycleId = String(formData.get("cycle_id") ?? "");
  const intent = String(formData.get("intent") ?? "save");
  const returnTo = request.headers.get("referer") ?? "/operator/dashboard";
  const cleanReturnTo = returnTo.split("?")[0];

  if (!cycleId) {
    return NextResponse.redirect(new URL(`${cleanReturnTo}?error=missing-cycle`, request.url));
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const db = createAdminSupabaseClient() ?? supabase;

  const payload = {
    cycle_id: cycleId,
    valves_open: checked(formData, "valves_open"),
    cleaning_product_available: checked(formData, "cleaning_product_available"),
    tank_empty: checked(formData, "tank_empty"),
    circuit_selected: checked(formData, "circuit_selected"),
    safety_conditions_checked: checked(formData, "safety_conditions_checked"),
    validated_at: null as string | null
  };

  const allValidated =
    payload.valves_open &&
    payload.cleaning_product_available &&
    payload.tank_empty &&
    payload.circuit_selected &&
    payload.safety_conditions_checked;

  payload.validated_at = allValidated ? new Date().toISOString() : null;

  const { error: checklistError } = await db.from("cip_checklists").upsert(payload, {
    onConflict: "cycle_id"
  });

  if (checklistError) {
    return NextResponse.redirect(new URL(`${cleanReturnTo}?error=checklist-save`, request.url));
  }

  if (intent === "start") {
    if (!allValidated) {
      return NextResponse.redirect(new URL(`${cleanReturnTo}?error=checklist-incomplete`, request.url));
    }

    const { error: cycleError } = await db
      .from("cip_cycles")
      .update({
        status: "in_progress",
        started_at: new Date().toISOString()
      })
      .eq("id", cycleId);

    if (cycleError) {
      return NextResponse.redirect(new URL(`${cleanReturnTo}?error=cycle-start`, request.url));
    }
  }

  return NextResponse.redirect(new URL(`${cleanReturnTo}?updated=checklist`, request.url));
}
