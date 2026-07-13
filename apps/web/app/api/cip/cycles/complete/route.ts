import { NextResponse, type NextRequest } from "next/server";
import { getRouteAuthContext, isPrivilegedProfile } from "@/lib/auth/api";
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
  const returnTo = request.headers.get("referer") ?? "/operator/dashboard";
  const cleanReturnTo = returnTo.split("?")[0];

  if (!cycleId || !["compliant", "non_compliant"].includes(result)) {
    return NextResponse.redirect(new URL(`${cleanReturnTo}?error=complete-fields`, request.url));
  }

  if (!context) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { supabase, user, profile } = context;
  const isPrivileged = isPrivilegedProfile(profile);
  const db = createAdminSupabaseClient() ?? supabase;
  const { data: existingCycle } = await db
    .from("cip_cycles")
    .select("id, operator_id, equipment_id, status")
    .eq("id", cycleId)
    .single();

  if (!existingCycle?.id || (!isPrivileged && existingCycle.operator_id !== user.id)) {
    return NextResponse.redirect(new URL("/unauthorized", request.url));
  }

  if (existingCycle.status === "completed" || existingCycle.status === "cancelled") {
    return NextResponse.redirect(new URL(`${cleanReturnTo}?error=cycle-already-closed`, request.url));
  }

  const temperature = decimal(formData, "temperature_c");
  const water = decimal(formData, "water_consumed_l");
  const soda = decimal(formData, "soda_quantity");
  const acid = decimal(formData, "acid_quantity");

  const payload = {
    status: "completed",
    ended_at: new Date().toISOString(),
    result,
    temperature_c: temperature,
    water_consumed_l: water,
    soda_quantity: soda,
    acid_quantity: acid,
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
    return NextResponse.redirect(new URL(`${cleanReturnTo}?error=cycle-complete`, request.url));
  }

  const parameterRows = [
    { parameter: "temperature", value: temperature, unit: "degC" },
    { parameter: "water_consumed", value: water, unit: "L" },
    { parameter: "soda_quantity", value: soda, unit: "L" },
    { parameter: "acid_quantity", value: acid, unit: "L" }
  ].filter((row): row is { parameter: string; value: number; unit: string } => row.value !== null);

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

  return NextResponse.redirect(new URL(`${cleanReturnTo}?completed=cycle`, request.url));
}
