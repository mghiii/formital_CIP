import { NextResponse, type NextRequest } from "next/server";
import { canManageProfileRole, canUseAdminUsersPanel, getRouteAuthContext } from "@/lib/auth/api";
import { toAppUrl } from "@/lib/auth/redirects";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { AppRole, Profile } from "@/types/auth";

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readRole(formData: FormData): AppRole {
  const role = readText(formData, "role");
  return role === "admin" || role === "engineer" ? role : "operator";
}

function missingColumnName(message?: string) {
  const match = message?.match(/'([^']+)' column of 'profiles'/i);
  return match?.[1];
}

function redirectUsers(request: NextRequest, params: Record<string, string>) {
  const url = toAppUrl(request, "/admin/users");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return NextResponse.redirect(url, { status: 303 });
}

async function audit(
  admin: NonNullable<ReturnType<typeof createAdminSupabaseClient>>,
  actor: Pick<Profile, "id" | "role">,
  action: string,
  targetId: string,
  details: Record<string, unknown>
) {
  await admin.from("admin_audit_log").insert({
    actor_id: actor.id,
    action,
    target_id: targetId,
    details: {
      actor_role: actor.role,
      ...details
    }
  });
}

function formatAdminError(message: string | undefined, fallback: string) {
  const clean = message ?? "";
  if (/already registered|already been registered|already exists|duplicate key/i.test(clean)) {
    return "Creation impossible: email, matricule ou badge deja utilise.";
  }
  if (/invalid input value for enum/i.test(clean)) {
    return "Creation impossible: role non compatible avec le schema de la base de donnees.";
  }
  if (/password/i.test(clean)) {
    return "Creation impossible: le mot de passe ne respecte pas les regles de securite.";
  }
  return clean || fallback;
}

async function upsertProfileWithSchemaFallback(
  admin: NonNullable<ReturnType<typeof createAdminSupabaseClient>>,
  payload: Record<string, unknown>
) {
  const remaining = { ...payload };
  const legacyRfidValue = remaining.rfid_badge_id;

  for (let attempt = 0; attempt < Object.keys(payload).length + 2; attempt += 1) {
    const { error } = await admin.from("profiles").upsert(remaining, { onConflict: "id" });
    if (!error) return null;

    const missingColumn = missingColumnName(error.message);
    if (!missingColumn || !(missingColumn in remaining)) return error.message;

    delete remaining[missingColumn];
    if (missingColumn === "rfid_badge_id" && legacyRfidValue !== undefined) {
      remaining.badge_rfid = legacyRfidValue;
    }
  }

  return "Creation impossible avec le schema actuel de la table profiles.";
}

export async function POST(request: NextRequest) {
  const auth = await getRouteAuthContext();
  if (!auth || !canUseAdminUsersPanel(auth.profile)) {
    return redirectUsers(request, { admin_error: "Acces non autorise." });
  }

  const admin = createAdminSupabaseClient();
  if (!admin) {
    return redirectUsers(request, { admin_error: "Configuration serveur incomplete." });
  }

  const formData = await request.formData();
  const role = readRole(formData);

  if (!canManageProfileRole(auth.profile, role, "create")) {
    return redirectUsers(request, { admin_error: "Votre role ne permet pas de creer ce type de compte." });
  }

  const fullName = readText(formData, "full_name");
  const email = readText(formData, "email").toLowerCase();
  const password = readText(formData, "password");
  const status = readText(formData, "status") === "inactive" ? "inactive" : "active";
  const rfidBadgeId = readText(formData, "rfid_badge_id");

  if (fullName.length < 2) return redirectUsers(request, { admin_error: "Nom complet obligatoire." });
  if (!email.includes("@")) return redirectUsers(request, { admin_error: "Email invalide." });
  if (password.length < 8) return redirectUsers(request, { admin_error: "Mot de passe minimum 8 caracteres." });

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role },
    user_metadata: {
      full_name: fullName,
      role,
      phone: readText(formData, "phone") || undefined,
      matricule: readText(formData, "matricule") || undefined,
      department: readText(formData, "department") || undefined,
      workshop: readText(formData, "workshop") || undefined,
      rfid_badge_id: rfidBadgeId || undefined
    }
  });

  if (createError || !created.user) {
    return redirectUsers(request, { admin_error: formatAdminError(createError?.message, "Creation impossible.") });
  }

  const profilePayload: Record<string, unknown> = {
    id: created.user.id,
    email,
    full_name: fullName,
    username: email.split("@")[0] || null,
    role,
    is_active: status === "active",
    status,
    phone: readText(formData, "phone") || null,
    matricule: readText(formData, "matricule") || null,
    department: readText(formData, "department") || null,
    workshop: readText(formData, "workshop") || null,
    avatar_url: readText(formData, "avatar_url") || null,
    rfid_badge_id: rfidBadgeId || null
  };

  const profileError = await upsertProfileWithSchemaFallback(admin, profilePayload);
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return redirectUsers(request, { admin_error: formatAdminError(profileError, "Profil non synchronise.") });
  }

  await audit(admin, auth.profile, "user.created", created.user.id, {
    email,
    role,
    status
  });

  return redirectUsers(request, { admin_created: "1" });
}
