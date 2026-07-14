import { NextResponse, type NextRequest } from "next/server";
import { getRouteAuthContext, isPrivilegedProfile } from "@/lib/auth/api";
import { getSafeReturnPath, toAppUrl } from "@/lib/auth/redirects";
import { createCycleThroughWorkflow } from "@/lib/cip/workflow";

const MANAGEABLE_CYCLE_ROLES = ["operator", "engineer", "admin"] as const;

function toIsoOrNull(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function POST(request: NextRequest) {
  const context = await getRouteAuthContext();
  const formData = await request.formData();
  const equipmentId = String(formData.get("equipment_id") ?? "");
  const plannedAt = String(formData.get("planned_at") ?? "");
  const operatorId = String(formData.get("operator_id") ?? "").trim();
  const plannedDuration = Number(String(formData.get("planned_duration_minutes") ?? "45").replace(",", "."));
  const priority = String(formData.get("priority") ?? "normal").trim() || "normal";
  const instructions = String(formData.get("instructions") ?? "").trim();
  const observation = String(formData.get("observation") ?? "").trim();
  const cleanReturnTo = getSafeReturnPath(request, "/operator/cycles");

  if (!context) {
    return NextResponse.redirect(toAppUrl(request, "/login"));
  }

  if (!MANAGEABLE_CYCLE_ROLES.includes(context.profile.role as (typeof MANAGEABLE_CYCLE_ROLES)[number])) {
    return NextResponse.redirect(toAppUrl(request, "/unauthorized"));
  }

  if (!equipmentId) {
    return NextResponse.redirect(toAppUrl(request, `${cleanReturnTo}?error=missing-equipment`));
  }

  const { supabase, user } = context;
  const isPrivileged = isPrivilegedProfile(context.profile);
  const assignedOperatorId = isPrivileged ? operatorId || null : user.id;

  if (!isPrivileged && operatorId && operatorId !== user.id) {
    return NextResponse.redirect(toAppUrl(request, `${cleanReturnTo}?error=cycle-permission`));
  }

  const plannedStartTime = toIsoOrNull(plannedAt);
  if (plannedAt && !plannedStartTime) {
    return NextResponse.redirect(toAppUrl(request, `${cleanReturnTo}?error=invalid-date`));
  }

  const createResult = await createCycleThroughWorkflow({
    supabase,
    payload: {
      p_equipment_id: equipmentId,
      p_operator_id: assignedOperatorId,
      p_planned_start_time: plannedStartTime,
      p_planned_duration_minutes: Number.isFinite(plannedDuration) && plannedDuration > 0 ? Math.round(plannedDuration) : 45,
      p_priority: priority,
      p_instructions: instructions || null,
      p_observation: observation || null,
      p_status: "planned"
    }
  });

  if (!createResult.ok) {
    return NextResponse.redirect(toAppUrl(request, `${cleanReturnTo}?error=${encodeURIComponent(createResult.code)}`));
  }

  return NextResponse.redirect(toAppUrl(request, `${cleanReturnTo}?created=cycle`));
}
