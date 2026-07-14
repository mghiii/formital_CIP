import { NextResponse, type NextRequest } from "next/server";
import { getRouteAuthContext, isPrivilegedProfile } from "@/lib/auth/api";
import { getSafeReturnPath, safeAppPath, toAppUrl } from "@/lib/auth/redirects";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const editableEquipmentStatuses = new Set(["available", "cleaned"]);
const lockedEquipmentStatuses = new Set(["cleaning", "in_cleaning", "out_of_service"]);

function redirectWithError(request: NextRequest, returnTo: string, error: string) {
  return NextResponse.redirect(toAppUrl(request, `${returnTo}?error=${error}`));
}

export async function POST(request: NextRequest) {
  const context = await getRouteAuthContext();
  const formData = await request.formData();
  const returnTo = String(formData.get("return_to") ?? "").trim();
  const cleanReturnTo = returnTo ? safeAppPath(returnTo, getSafeReturnPath(request, "/engineer/equipments")) : getSafeReturnPath(request, "/engineer/equipments");
  const intent = String(formData.get("intent") ?? "").trim();

  if (!context) {
    return NextResponse.redirect(toAppUrl(request, "/login"));
  }

  if (intent === "status") {
    const equipmentId = String(formData.get("equipment_id") ?? "").trim();
    const status = String(formData.get("status") ?? "").trim();

    if (!equipmentId || !status) {
      return redirectWithError(request, cleanReturnTo, "missing-equipment-status-fields");
    }

    if (!editableEquipmentStatuses.has(status)) {
      return redirectWithError(request, cleanReturnTo, "equipment-status-invalid");
    }

    if (!["operator", "engineer", "admin"].includes(context.profile.role)) {
      return NextResponse.redirect(toAppUrl(request, "/unauthorized"));
    }

    const db = createAdminSupabaseClient() ?? context.supabase;
    const { data: equipment, error: equipmentError } = await db
      .from("equipments")
      .select("id,status,is_active")
      .eq("id", equipmentId)
      .single();

    if (equipmentError || !equipment) {
      return redirectWithError(request, cleanReturnTo, "equipment-not-found");
    }

    if (equipment.is_active === false) {
      return redirectWithError(request, cleanReturnTo, "equipment-inactive");
    }

    const currentStatus = String(equipment.status ?? "");
    if (lockedEquipmentStatuses.has(currentStatus)) {
      return redirectWithError(request, cleanReturnTo, "equipment-status-locked");
    }

    const { data: runningCycle, error: runningCycleError } = await db
      .from("cip_cycles")
      .select("id")
      .eq("equipment_id", equipmentId)
      .in("status", ["in_progress", "running"])
      .is("ended_at", null)
      .maybeSingle();

    if (runningCycleError) {
      return redirectWithError(request, cleanReturnTo, "equipment-status-check");
    }

    if (runningCycle?.id) {
      return redirectWithError(request, cleanReturnTo, "equipment-has-active-cycle");
    }

    const { error } = await db
      .from("equipments")
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq("id", equipmentId);

    if (error) {
      return redirectWithError(request, cleanReturnTo, "equipment-status-update");
    }

    return NextResponse.redirect(toAppUrl(request, `${cleanReturnTo}?updated=equipment-status`));
  }

  const processId = String(formData.get("process_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();

  if (!processId || !name) {
    return NextResponse.redirect(toAppUrl(request, `${cleanReturnTo}?error=missing-equipment-fields`));
  }

  if (!isPrivilegedProfile(context.profile)) {
    return NextResponse.redirect(toAppUrl(request, "/unauthorized"));
  }

  const { supabase } = context;
  const { error } = await supabase.from("equipments").insert({
    process_id: processId,
    name,
    status: "available",
    is_active: true
  });

  if (error) {
    return NextResponse.redirect(toAppUrl(request, `${cleanReturnTo}?error=equipment-create`));
  }

  return NextResponse.redirect(toAppUrl(request, `${cleanReturnTo}?created=equipment`));
}
