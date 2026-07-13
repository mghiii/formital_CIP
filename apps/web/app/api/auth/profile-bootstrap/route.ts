import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requirePublicSupabaseConfig } from "@/lib/supabase/config";
import type { AppRole, Profile } from "@/types/auth";

const appRoles: AppRole[] = ["operator", "engineer", "admin"];

function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && appRoles.includes(value as AppRole);
}

function inferRole(email: string | undefined, appMetadataRole: unknown): AppRole | null {
  if (isAppRole(appMetadataRole)) {
    return appMetadataRole;
  }

  if (email?.toLowerCase().startsWith("ingenieur@")) {
    return "engineer";
  }

  if (email?.toLowerCase().startsWith("operateur@")) {
    return "operator";
  }

  if (email?.toLowerCase().startsWith("admin@")) {
    return "admin";
  }

  return null;
}

function normalizeProfile(profile: Record<string, unknown>): Profile {
  if (!isAppRole(profile.role)) {
    throw new Error("Role de profil invalide.");
  }

  return {
    id: String(profile.id),
    full_name: typeof profile.full_name === "string" ? profile.full_name : null,
    username: typeof profile.username === "string" ? profile.username : null,
    email: typeof profile.email === "string" ? profile.email : null,
    role: profile.role,
    rfid_badge_id:
      typeof profile.rfid_badge_id === "string"
        ? profile.rfid_badge_id
        : typeof profile.badge_rfid === "string"
          ? profile.badge_rfid
          : null,
    phone: typeof profile.phone === "string" ? profile.phone : null,
    matricule: typeof profile.matricule === "string" ? profile.matricule : null,
    department: typeof profile.department === "string" ? profile.department : null,
    workshop: typeof profile.workshop === "string" ? profile.workshop : null,
    status:
      profile.status === "active" || profile.status === "inactive" || profile.status === "pending"
        ? profile.status
        : typeof profile.is_active === "boolean" && !profile.is_active
          ? "inactive"
          : "active",
    avatar_url: typeof profile.avatar_url === "string" ? profile.avatar_url : null,
    last_sign_in_at: typeof profile.last_sign_in_at === "string" ? profile.last_sign_in_at : null,
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
  if (!role) {
    console.error(`[auth] Profil absent et role impossible a deduire pour ${user.id}.`);
    return NextResponse.json({ message: "Profil manquant. Contactez un administrateur." }, { status: 409 });
  }
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
      try {
        return NextResponse.json({ profile: normalizeProfile(data as Record<string, unknown>) });
      } catch (caughtError) {
        console.error(`[auth] Profil invalide cree pour ${user.id}:`, caughtError);
        return NextResponse.json({ message: "Role de profil invalide." }, { status: 422 });
      }
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
