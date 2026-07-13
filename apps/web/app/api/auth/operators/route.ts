import { NextResponse, type NextRequest } from "next/server";
import { getRouteAuthContext, isPrivilegedProfile } from "@/lib/auth/api";
import { getSafeReturnPath, toAppUrl } from "@/lib/auth/redirects";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

function redirectToSettings(request: NextRequest, params: Record<string, string>) {
  const url = toAppUrl(request, getSafeReturnPath(request, "/engineer/settings"));

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return NextResponse.redirect(url, { status: 303 });
}

function readFormText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function schemaFallbackAllowed(message?: string) {
  return /schema cache|column|Could not find/i.test(message ?? "");
}

function formatOperatorError(message: string | undefined, fallback: string) {
  const clean = message ?? "";
  if (/already registered|already been registered|already exists|duplicate key/i.test(clean)) {
    return "Creation impossible: email, matricule ou badge deja utilise.";
  }
  if (/password/i.test(clean)) {
    return "Creation impossible: le mot de passe ne respecte pas les regles de securite.";
  }
  if (/schema cache|column|Could not find/i.test(clean)) {
    return "Creation impossible: le profil n'est pas compatible avec le schema actuel de la base.";
  }
  return clean || fallback;
}

export async function POST(request: NextRequest) {
  const auth = await getRouteAuthContext();

  if (!auth) {
    return redirectToSettings(request, { operator_error: "Session introuvable." });
  }

  if (!isPrivilegedProfile(auth.profile)) {
    return redirectToSettings(request, { operator_error: "Acces reserve aux ingenieurs et administrateurs." });
  }

  const admin = createAdminSupabaseClient();
  if (!admin) {
    return redirectToSettings(request, { operator_error: "Configuration serveur incomplete pour creer les comptes." });
  }

  const formData = await request.formData();
  const fullName = readFormText(formData, "full_name");
  const email = readFormText(formData, "email").toLowerCase();
  const password = readFormText(formData, "password");
  const rfidBadgeId = readFormText(formData, "rfid_badge_id");
  const phone = readFormText(formData, "phone");
  const matricule = readFormText(formData, "matricule");
  const department = readFormText(formData, "department");
  const workshop = readFormText(formData, "workshop");

  if (fullName.length < 2) {
    return redirectToSettings(request, { operator_error: "Le nom complet est obligatoire." });
  }

  if (!email.includes("@")) {
    return redirectToSettings(request, { operator_error: "Email operateur invalide." });
  }

  if (password.length < 8) {
    return redirectToSettings(request, { operator_error: "Le mot de passe doit contenir au moins 8 caracteres." });
  }

  const { data: createdUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: {
      role: "operator"
    },
    user_metadata: {
      full_name: fullName,
      role: "operator",
      ...(rfidBadgeId ? { rfid_badge_id: rfidBadgeId } : {}),
      ...(phone ? { phone } : {}),
      ...(matricule ? { matricule } : {}),
      ...(department ? { department } : {}),
      ...(workshop ? { workshop } : {})
    }
  });

  if (authError || !createdUser.user) {
    return redirectToSettings(request, {
      operator_error: formatOperatorError(authError?.message, "Creation du compte impossible.")
    });
  }

  const basePayload = {
    id: createdUser.user.id,
    email,
    full_name: fullName,
    role: "operator",
    is_active: true
  };
  const username = email.split("@")[0] || null;
  const payloads = [
    {
      ...basePayload,
      username,
      rfid_badge_id: rfidBadgeId || null,
      phone: phone || null,
      matricule: matricule || null,
      department: department || null,
      workshop: workshop || null
    },
    {
      ...basePayload,
      badge_rfid: rfidBadgeId || null,
      phone: phone || null,
      matricule: matricule || null,
      department: department || null,
      workshop: workshop || null
    },
    basePayload
  ];

  let lastProfileError: string | undefined;
  for (const payload of payloads) {
    const { error } = await admin.from("profiles").upsert(payload, { onConflict: "id" }).select("id").single();

    if (!error) {
      await admin.from("admin_audit_log").insert({
        actor_id: auth.profile.id,
        action: "user.created",
        target_id: createdUser.user.id,
        details: {
          actor_role: auth.profile.role,
          role: "operator",
          email,
          source: "operator_settings"
        }
      });
      return redirectToSettings(request, { operator_created: "1" });
    }

    lastProfileError = error.message;
    if (!schemaFallbackAllowed(error.message)) {
      break;
    }
  }

  await admin.auth.admin.deleteUser(createdUser.user.id);

  return redirectToSettings(request, {
    operator_error: formatOperatorError(lastProfileError, "Profil operateur non synchronise.")
  });
}
