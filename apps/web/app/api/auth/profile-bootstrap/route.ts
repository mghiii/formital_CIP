import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requirePublicSupabaseConfig } from "@/lib/supabase/config";
import type { AppRole, Profile } from "@/types/auth";

const appRoles: AppRole[] = ["operator", "engineer", "admin"];

function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && appRoles.includes(value as AppRole);
}

function inferRole(email: string | undefined, appMetadataRole: unknown): AppRole {
  if (isAppRole(appMetadataRole)) {
    return appMetadataRole;
  }

  if (email?.toLowerCase().startsWith("ingenieur@")) {
    return "engineer";
  }

  return "operator";
}

function normalizeProfile(profile: Record<string, unknown>): Profile {
  return {
    id: String(profile.id),
    full_name: typeof profile.full_name === "string" ? profile.full_name : null,
    username: typeof profile.username === "string" ? profile.username : null,
    email: typeof profile.email === "string" ? profile.email : null,
    role: isAppRole(profile.role) ? profile.role : "operator",
    rfid_badge_id:
      typeof profile.rfid_badge_id === "string"
        ? profile.rfid_badge_id
        : typeof profile.badge_rfid === "string"
          ? profile.badge_rfid
          : null,
    is_active: typeof profile.is_active === "boolean" ? profile.is_active : true,
    created_at: typeof profile.created_at === "string" ? profile.created_at : new Date().toISOString(),
    updated_at: typeof profile.updated_at === "string" ? profile.updated_at : new Date().toISOString()
  };
}

export async function POST() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ message: "Session introuvable." }, { status: 401 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRoleKey) {
    return NextResponse.json({ message: "Configuration serveur incomplete." }, { status: 503 });
  }

  const { url } = requirePublicSupabaseConfig();
  const admin = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
  const email = user.email ?? null;
  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : null;
  const username = typeof user.user_metadata?.username === "string" ? user.user_metadata.username : null;
  const rfidBadgeId = typeof user.user_metadata?.rfid_badge_id === "string" ? user.user_metadata.rfid_badge_id : null;
  const role = inferRole(user.email, user.app_metadata?.role);
  const basePayload = {
    id: user.id,
    email,
    full_name: fullName,
    role,
    is_active: true
  };
  const payloads = [
    {
      ...basePayload,
      username,
      rfid_badge_id: rfidBadgeId
    },
    {
      ...basePayload,
      badge_rfid: rfidBadgeId
    },
    basePayload
  ];

  let lastError: unknown;
  for (const payload of payloads) {
    const { data, error } = await admin.from("profiles").upsert(payload, { onConflict: "id" }).select("*").single();

    if (!error && data) {
      return NextResponse.json({ profile: normalizeProfile(data as Record<string, unknown>) });
    }

    lastError = error;
    if (!/schema cache|column|Could not find/i.test(error?.message ?? "")) {
      break;
    }
  }

  return NextResponse.json(
    { message: lastError instanceof Error ? lastError.message : "Profil non synchronise." },
    { status: 500 }
  );
}
