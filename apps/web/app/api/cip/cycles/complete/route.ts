import { NextResponse, type NextRequest } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function decimal(formData: FormData, name: string) {
  const raw = String(formData.get(name) ?? "").trim().replace(",", ".");
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const formData = await request.formData();
  const cycleId = String(formData.get("cycle_id") ?? "");
  const result = String(formData.get("result") ?? "");
  const observation = String(formData.get("observation") ?? "").trim();
  const returnTo = request.headers.get("referer") ?? "/operator/dashboard";
  const cleanReturnTo = returnTo.split("?")[0];

  if (!cycleId || !["compliant", "non_compliant"].includes(result)) {
    return NextResponse.redirect(new URL(`${cleanReturnTo}?error=complete-fields`, request.url));
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const db = createAdminSupabaseClient() ?? supabase;

  const payload = {
    status: "completed",
    ended_at: new Date().toISOString(),
    result,
    temperature_c: decimal(formData, "temperature_c"),
    water_consumed_l: decimal(formData, "water_consumed_l"),
    soda_quantity: decimal(formData, "soda_quantity"),
    acid_quantity: decimal(formData, "acid_quantity"),
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
      action: "inform_supervisor",
      observation: observation || "Cycle CIP non conforme."
    });
  }

  return NextResponse.redirect(new URL(`${cleanReturnTo}?completed=cycle`, request.url));
}
