import { NextResponse, type NextRequest } from "next/server";
import { getRouteAuthContext, isPrivilegedProfile } from "@/lib/auth/api";
import { getSafeReturnPath, toAppUrl } from "@/lib/auth/redirects";

function checked(formData: FormData, name: string) {
  return formData.get(name) === "on";
}

function redirectAfterPost(request: NextRequest, path: string) {
  return NextResponse.redirect(toAppUrl(request, path), { status: 303 });
}

function encodeWorkflowError(result: unknown) {
  if (!result || typeof result !== "object") {
    return "cycle-start";
  }

  const payload = result as { code?: unknown };
  return String(payload.code ?? "cycle-start").toLowerCase().replaceAll("_", "-");
}

export async function GET(request: NextRequest) {
  return redirectAfterPost(request, "/operator/dashboard?error=use-cycle-form");
}

export async function POST(request: NextRequest) {
  const context = await getRouteAuthContext();
  const formData = await request.formData();
  const cycleId = String(formData.get("cycle_id") ?? "");
  const cleanReturnTo = getSafeReturnPath(request, "/operator/dashboard");

  if (!cycleId) {
    return redirectAfterPost(request, `${cleanReturnTo}?error=missing-cycle`);
  }

  if (!context) {
    return redirectAfterPost(request, "/login");
  }

  const { supabase, profile } = context;

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
    return redirectAfterPost(request, `${cleanReturnTo}?error=checklist-incomplete`);
  }

  const { error: checklistError } = await supabase.from("cip_checklists").upsert(checklist, {
    onConflict: "cycle_id"
  });

  if (checklistError) {
    return redirectAfterPost(request, `${cleanReturnTo}?error=checklist-save`);
  }

  const forceStart = formData.get("force_start") === "on" && isPrivilegedProfile(profile);
  const { data: startResult, error: rpcError } = await supabase.rpc("start_planned_cip_cycle", {
    p_cycle_id: cycleId,
    p_force: forceStart
  });

  const result = startResult as { ok?: boolean; message?: string } | null;

  if (rpcError || result?.ok !== true) {
    const code = rpcError ? "cycle-start" : encodeWorkflowError(result);
    return redirectAfterPost(request, `${cleanReturnTo}?error=${code}`);
  }

  return redirectAfterPost(request, `${cleanReturnTo}?started=planned-cycle`);
}
