import { NextResponse, type NextRequest } from "next/server";
import { getRouteAuthContext, isPrivilegedProfile } from "@/lib/auth/api";
import { getSafeReturnPath, toAppUrl } from "@/lib/auth/redirects";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

function decimal(formData: FormData, name: string) {
  const raw = String(formData.get(name) ?? "").trim().replace(",", ".");
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export async function POST(request: NextRequest) {
  const context = await getRouteAuthContext();
  const formData = await request.formData();
  const cycleId = String(formData.get("cycle_id") ?? "");
  const result = String(formData.get("result") ?? "");
  const observation = String(formData.get("observation") ?? "").trim();
  const cleanReturnTo = getSafeReturnPath(request, "/operator/dashboard");

  if (!cycleId || !["compliant", "non_compliant"].includes(result)) {
    return NextResponse.redirect(toAppUrl(request, `${cleanReturnTo}?error=complete-fields`));
  }

  if (!context) {
    return NextResponse.redirect(toAppUrl(request, "/login"));
  }

  const { supabase, user, profile } = context;
  const isPrivileged = isPrivilegedProfile(profile);
  const db = createAdminSupabaseClient() ?? supabase;
  const { data: existingCycle } = await db
    .from("cip_cycles")
    .select("id, operator_id, equipment_id, status, solution_id, concentration_unit")
    .eq("id", cycleId)
    .single();

  if (!existingCycle?.id || (!isPrivileged && existingCycle.operator_id !== user.id)) {
    return NextResponse.redirect(toAppUrl(request, "/unauthorized"));
  }

  if (existingCycle.status === "completed" || existingCycle.status === "cancelled" || existingCycle.status === "failed") {
    return NextResponse.redirect(toAppUrl(request, `${cleanReturnTo}?error=cycle-already-closed`));
  }

  if (!["in_progress", "running"].includes(String(existingCycle.status))) {
    return NextResponse.redirect(toAppUrl(request, `${cleanReturnTo}?error=cycle-not-running`));
  }

  const temperature = decimal(formData, "temperature_c");
  const water = decimal(formData, "water_consumed_l");
  const soda = decimal(formData, "soda_quantity");
  const acid = decimal(formData, "acid_quantity");
  const causticConcentration = decimal(formData, "caustic_concentration");
  const acidConcentration = decimal(formData, "acid_concentration");
  const concentrationUnit = String(existingCycle.concentration_unit ?? "%").trim() || "%";

  const payload = {
    status: "completed",
    ended_at: new Date().toISOString(),
    result,
    temperature_c: temperature,
    water_consumed_l: water,
    soda_quantity: soda,
    acid_quantity: acid,
    caustic_concentration: causticConcentration,
    acid_concentration: acidConcentration,
    concentration_unit: concentrationUnit,
    visual_aspect: String(formData.get("visual_aspect") ?? "").trim() || null,
    observation: observation || null
  };

  const { data: cycle, error: updateError } = await db
    .from("cip_cycles")
    .update(payload)
    .eq("id", cycleId)
    .select("id, operator_id, equipment_id")
    .single();

  if (updateError || !cycle?.id) {
    return NextResponse.redirect(toAppUrl(request, `${cleanReturnTo}?error=cycle-complete`));
  }

  const parameterRows = [
    { parameter: "temperature", value: temperature, unit: "degC" },
    { parameter: "water_consumed", value: water, unit: "L" },
    { parameter: "soda_quantity", value: soda, unit: "L" },
    { parameter: "acid_quantity", value: acid, unit: "L" },
    { parameter: "concentration", value: causticConcentration, unit: concentrationUnit, component: "caustic" },
    { parameter: "concentration", value: acidConcentration, unit: concentrationUnit, component: "acid" }
  ].filter((row): row is { parameter: string; value: number; unit: string; component?: string } => row.value !== null);

  if (parameterRows.length > 0) {
    const parameterNames = parameterRows.map((row) => row.parameter);
    await db
      .from("cip_parameters")
      .delete()
      .eq("cycle_id", cycle.id)
      .eq("source", "manual")
      .in("parameter", parameterNames);

    await db.from("cip_parameters").insert(
      parameterRows.map((row) => ({
        cycle_id: cycle.id,
        solution_id: existingCycle.solution_id ?? null,
        component: row.component ?? null,
        parameter: row.parameter,
        value: row.value,
        unit: row.unit,
        source: "manual",
        recorded_by: user.id
      }))
    );
  }

  if (result === "non_compliant") {
    const { data: alert } = await db
      .from("cip_alerts")
      .insert({
        cycle_id: cycle.id,
        operator_id: cycle.operator_id,
        equipment_id: cycle.equipment_id,
        severity: "warning",
        title: "Cycle CIP non conforme",
        message: observation || "Le cycle a ete cloture avec un resultat non conforme."
      })
      .select("id")
      .single();

    await db.from("cip_anomalies").insert({
      cycle_id: cycle.id,
      alert_id: alert?.id ?? null,
      action: "inform_manager",
      observation: observation || "Cycle CIP non conforme."
    });
  }

  return NextResponse.redirect(toAppUrl(request, `${cleanReturnTo}?completed=cycle`));
}
