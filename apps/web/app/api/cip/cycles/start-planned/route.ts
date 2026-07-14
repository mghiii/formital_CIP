import { NextResponse, type NextRequest } from "next/server";
import { getRouteAuthContext, isPrivilegedProfile } from "@/lib/auth/api";
import { getSafeReturnPath, toAppUrl } from "@/lib/auth/redirects";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  STARTABLE_CYCLE_STATUSES,
  checklistFromFormData,
  databaseErrorCode,
  isChecklistComplete,
  startCycleThroughWorkflow
} from "@/lib/cip/workflow";

function redirectAfterPost(request: NextRequest, path: string) {
  return NextResponse.redirect(toAppUrl(request, path), { status: 303 });
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

  const { supabase, profile, user } = context;
  const db = createAdminSupabaseClient() ?? supabase;

  const { data: cycle } = await supabase
    .from("cip_cycles")
    .select("id, operator_id, status")
    .eq("id", cycleId)
    .single();

  const canStartCycle =
    isPrivilegedProfile(profile) ||
    cycle?.operator_id === user.id ||
    (profile.role === "operator" &&
      !cycle?.operator_id &&
      STARTABLE_CYCLE_STATUSES.includes(String(cycle?.status) as (typeof STARTABLE_CYCLE_STATUSES)[number]));

  if (!cycle?.id || !canStartCycle) {
    return redirectAfterPost(request, `${cleanReturnTo}?error=cycle-permission`);
  }

  const checklistFields = checklistFromFormData(formData);
  const checklist = {
    cycle_id: cycleId,
    ...checklistFields,
    validated_at: new Date().toISOString()
  };

  if (!isChecklistComplete(checklistFields)) {
    return redirectAfterPost(request, `${cleanReturnTo}?error=checklist-incomplete`);
  }

  const { error: checklistError } = await db.from("cip_checklists").upsert(checklist, {
    onConflict: "cycle_id"
  });

  if (checklistError) {
    return redirectAfterPost(request, `${cleanReturnTo}?error=${databaseErrorCode(checklistError)}`);
  }

  const forceStart = formData.get("force_start") === "on" && isPrivilegedProfile(profile);
  const startResult = await startCycleThroughWorkflow({ supabase, cycleId, forceStart });

  if (!startResult.ok) {
    const code = startResult.code;
    return redirectAfterPost(request, `${cleanReturnTo}?error=${code}`);
  }

  return redirectAfterPost(request, `${cleanReturnTo}?started=planned-cycle`);
}
