import { NextResponse, type NextRequest } from "next/server";
import { getRouteAuthContext, isPrivilegedProfile } from "@/lib/auth/api";
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
  const cycleId = String(formData.get("cycle_id") ?? "");
  const intent = String(formData.get("intent") ?? "save");
  const cleanReturnTo = getSafeReturnPath(request, "/operator/dashboard");

  if (!cycleId) {
    return NextResponse.redirect(toAppUrl(request, `${cleanReturnTo}?error=missing-cycle`));
  }

  if (!context) {
    return NextResponse.redirect(toAppUrl(request, "/login"));
  }

  const { supabase, user, profile } = context;
  const isPrivileged = isPrivilegedProfile(profile);

  const { data: cycle } = await supabase
    .from("cip_cycles")
    .select("id, operator_id, status")
    .eq("id", cycleId)
    .single();

  const canEditCycle =
    isPrivileged ||
    cycle?.operator_id === user.id ||
    (profile.role === "operator" &&
      ["draft", "planned", "ready", "in_progress", "running"].includes(String(cycle?.status)));

  if (!cycle?.id || !canEditCycle) {
    return NextResponse.redirect(toAppUrl(request, "/unauthorized"));
  }

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

  const { error: checklistError } = await supabase.from("cip_checklists").upsert(payload, {
    onConflict: "cycle_id"
  });

  if (checklistError) {
    return NextResponse.redirect(toAppUrl(request, `${cleanReturnTo}?error=checklist-save`));
  }

  if (intent === "start") {
    if (!allValidated) {
      return NextResponse.redirect(toAppUrl(request, `${cleanReturnTo}?error=checklist-incomplete`));
    }

    const { data: startResult, error: cycleError } = await supabase.rpc("start_planned_cip_cycle", {
      p_cycle_id: cycleId,
      p_force: formData.get("force_start") === "on" && isPrivileged
    });

    const result = startResult as { ok?: boolean; code?: string } | null;
    if (cycleError || result?.ok !== true) {
      return NextResponse.redirect(toAppUrl(request, `${cleanReturnTo}?error=${encodeURIComponent(workflowErrorCode(result?.code))}`));
    }
  }

  return NextResponse.redirect(toAppUrl(request, `${cleanReturnTo}?updated=checklist`));
}
