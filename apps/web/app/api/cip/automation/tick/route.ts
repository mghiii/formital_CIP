import { NextResponse } from "next/server";
import { getRouteAuthContext } from "@/lib/auth/api";
import { runCipAutomationTick } from "@/lib/cip/automation";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function POST() {
  const context = await getRouteAuthContext();

  if (!context) {
    return NextResponse.json({ message: "Session utilisateur requise." }, { status: 401 });
  }

  const admin = createAdminSupabaseClient();
  const result = await runCipAutomationTick({
    supabase: context.supabase,
    admin,
    profile: context.profile,
    userId: context.user.id
  });

  return NextResponse.json(result);
}

export async function GET() {
  return NextResponse.json({ message: "Utilisez POST pour executer l'automatisation CIP." }, { status: 405 });
}
