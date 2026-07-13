import { NextResponse } from "next/server";
import { getRouteAuthContext, isPrivilegedProfile } from "@/lib/auth/api";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

function redirectToSettings(request: Request, params: Record<string, string>) {
  const url = new URL("/engineer/settings", request.url);

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

export async function POST(request: Request) {
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
      ...(rfidBadgeId ? { rfid_badge_id: rfidBadgeId } : {})
    }
  });

  if (authError || !createdUser.user) {
    return redirectToSettings(request, {
      operator_error: authError?.message ?? "Creation du compte impossible."
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
      rfid_badge_id: rfidBadgeId || null
    },
    {
      ...basePayload,
      badge_rfid: rfidBadgeId || null
    },
    basePayload
  ];

  let lastProfileError: string | undefined;
  for (const payload of payloads) {
    const { error } = await admin.from("profiles").upsert(payload, { onConflict: "id" }).select("id").single();

    if (!error) {
      return redirectToSettings(request, { operator_created: "1" });
    }

    lastProfileError = error.message;
    if (!schemaFallbackAllowed(error.message)) {
      break;
    }
  }

  await admin.auth.admin.deleteUser(createdUser.user.id);

  return redirectToSettings(request, {
    operator_error: lastProfileError ?? "Profil operateur non synchronise."
  });
}
