import { NextResponse, type NextRequest } from "next/server";
import { getRouteAuthContext, isPrivilegedProfile } from "@/lib/auth/api";
import { getSafeReturnPath, toAppUrl } from "@/lib/auth/redirects";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  STARTABLE_CYCLE_STATUSES,
  RUNNING_CYCLE_STATUSES,
  checklistFromFormData,
  databaseErrorCode,
  isChecklistComplete,
  startCycleThroughWorkflow
} from "@/lib/cip/workflow";

const EDITABLE_OPERATOR_CYCLE_STATUSES = [...STARTABLE_CYCLE_STATUSES, ...RUNNING_CYCLE_STATUSES].map(String);

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
  const db = createAdminSupabaseClient() ?? supabase;

  const { data: cycle } = await supabase
    .from("cip_cycles")
    .select("id, operator_id, status")
    .eq("id", cycleId)
    .single();

  const canEditCycle =
    isPrivileged ||
    cycle?.operator_id === user.id ||
    (profile.role === "operator" &&
      !cycle?.operator_id &&
      EDITABLE_OPERATOR_CYCLE_STATUSES.includes(String(cycle?.status)));

  if (!cycle?.id || !canEditCycle) {
    return NextResponse.redirect(toAppUrl(request, "/unauthorized"));
  }

  const checklistFields = checklistFromFormData(formData);
  const payload = {
    cycle_id: cycleId,
    ...checklistFields,
    validated_at: null as string | null
  };

  const allValidated = isChecklistComplete(checklistFields);

  payload.validated_at = allValidated ? new Date().toISOString() : null;

  const { error: checklistError } = await db.from("cip_checklists").upsert(payload, {
    onConflict: "cycle_id"
  });

  if (checklistError) {
    return NextResponse.redirect(toAppUrl(request, `${cleanReturnTo}?error=${databaseErrorCode(checklistError)}`));
  }

  if (intent === "start") {
    if (!allValidated) {
      return NextResponse.redirect(toAppUrl(request, `${cleanReturnTo}?error=checklist-incomplete`));
    }

    const startResult = await startCycleThroughWorkflow({
      supabase,
      cycleId,
      forceStart: formData.get("force_start") === "on" && isPrivileged
    });

    if (!startResult.ok) {
      return NextResponse.redirect(toAppUrl(request, `${cleanReturnTo}?error=${encodeURIComponent(startResult.code)}`));
    }
  }

  return NextResponse.redirect(toAppUrl(request, `${cleanReturnTo}?updated=checklist`));
}
