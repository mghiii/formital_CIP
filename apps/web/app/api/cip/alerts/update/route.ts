import { NextResponse, type NextRequest } from "next/server";
import { getRouteAuthContext, isPrivilegedProfile } from "@/lib/auth/api";
import { getSafeReturnPath, toAppUrl } from "@/lib/auth/redirects";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

function redirectAfterPost(request: NextRequest, path: string) {
  return NextResponse.redirect(toAppUrl(request, path), { status: 303 });
}

function schemaFallbackAllowed(message?: string) {
  return /schema cache|column|Could not find|resolution_comment/i.test(message ?? "");
}

export async function GET(request: NextRequest) {
  return redirectAfterPost(request, "/operator/alerts?error=use-alert-form");
}

export async function POST(request: NextRequest) {
  const context = await getRouteAuthContext();
  const formData = await request.formData();
  const alertId = String(formData.get("alert_id") ?? "");
  const intent = String(formData.get("intent") ?? "");
  const resolutionComment = String(formData.get("resolution_comment") ?? "").trim();
  const cleanReturnTo = getSafeReturnPath(request, "/operator/alerts");

  if (!context) {
    return redirectAfterPost(request, "/login");
  }

  if (!alertId || !["acknowledge", "resolve"].includes(intent)) {
    return redirectAfterPost(request, `${cleanReturnTo}?error=alert-fields`);
  }

  const { supabase, user, profile } = context;
  const isPrivileged = isPrivilegedProfile(profile);
  const db = createAdminSupabaseClient() ?? supabase;

  const { data: alert } = await db
    .from("cip_alerts")
    .select("id, operator_id, status")
    .eq("id", alertId)
    .single();

  if (!alert?.id || (!isPrivileged && alert.operator_id !== user.id)) {
    return redirectAfterPost(request, "/unauthorized");
  }

  if (intent === "resolve" && !isPrivileged) {
    return redirectAfterPost(request, "/unauthorized");
  }

  const resolvedAt = new Date().toISOString();
  const acknowledgedAt = new Date().toISOString();
  const payload =
    intent === "resolve"
      ? {
          status: "resolved",
          resolved_at: resolvedAt,
          resolved_by: user.id,
          resolution_comment: resolutionComment || null
        }
      : {
          status: "acknowledged",
          acknowledged_at: acknowledgedAt
        };

  let { error } = await db.from("cip_alerts").update(payload).eq("id", alert.id);

  if (error && intent === "resolve" && schemaFallbackAllowed(error.message)) {
    const fallbackPayload = {
      status: "resolved",
      resolved_at: resolvedAt,
      resolved_by: user.id
    };

    const fallbackResult = await db.from("cip_alerts").update(fallbackPayload).eq("id", alert.id);
    error = fallbackResult.error;
  }

  if (error) {
    return redirectAfterPost(request, `${cleanReturnTo}?error=alert-update`);
  }

  return redirectAfterPost(request, `${cleanReturnTo}?updated=alert`);
}
