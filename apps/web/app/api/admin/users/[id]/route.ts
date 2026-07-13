import { NextResponse, type NextRequest } from "next/server";
import { canManageProfileRole, canUseAdminUsersPanel, getRouteAuthContext } from "@/lib/auth/api";
import { getSafeReturnPath, toAppUrl } from "@/lib/auth/redirects";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { AppRole, Profile } from "@/types/auth";

type RouteContext = {
  params: {
    id: string;
  };
};

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readRole(formData: FormData, fallback: AppRole): AppRole {
  const role = readText(formData, "role");
  return role === "operator" || role === "engineer" || role === "admin" ? role : fallback;
}

function missingColumnName(message?: string) {
  const match = message?.match(/'([^']+)' column of 'profiles'/i);
  return match?.[1];
}

async function updateProfileWithSchemaFallback(
  admin: NonNullable<ReturnType<typeof createAdminSupabaseClient>>,
  targetId: string,
  payload: Record<string, unknown>
) {
  const remaining = { ...payload };
  const legacyRfidValue = remaining.rfid_badge_id;

  for (let attempt = 0; attempt < Object.keys(payload).length + 2; attempt += 1) {
    const { error } = await admin.from("profiles").update(remaining).eq("id", targetId);
    if (!error) return null;

    const missingColumn = missingColumnName(error.message);
    if (!missingColumn || !(missingColumn in remaining)) return error.message;

    delete remaining[missingColumn];
    if (missingColumn === "rfid_badge_id" && legacyRfidValue !== undefined) {
      remaining.badge_rfid = legacyRfidValue;
    }
  }

  return "Mise a jour impossible avec le schema actuel de la table profiles.";
}

function redirectBack(request: NextRequest, params: Record<string, string>) {
  const url = toAppUrl(request, getSafeReturnPath(request, "/admin/users"));
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
    return "Action impossible: email, matricule ou badge deja utilise.";
  }
  if (/invalid input value for enum/i.test(clean)) {
    return "Action impossible: role non compatible avec le schema de la base de donnees.";
  }
  if (/foreign key|violates.*constraint/i.test(clean)) {
    return "Action impossible: ce compte est lie a des donnees historiques.";
  }
  if (/password/i.test(clean)) {
    return "Action impossible: le mot de passe ne respecte pas les regles de securite.";
  }
  return clean || fallback;
}

async function hasActiveCycles(admin: NonNullable<ReturnType<typeof createAdminSupabaseClient>>, profileId: string) {
  const { count, error } = await admin
    .from("cip_cycles")
    .select("id", { count: "exact", head: true })
    .eq("operator_id", profileId)
    .in("status", ["draft", "planned", "ready", "in_progress", "running"]);

  if (error) return true;
  return (count ?? 0) > 0;
}

async function hasAnyCycles(admin: NonNullable<ReturnType<typeof createAdminSupabaseClient>>, profileId: string) {
  const { count, error } = await admin
    .from("cip_cycles")
    .select("id", { count: "exact", head: true })
    .eq("operator_id", profileId);

  if (error) return true;
  return (count ?? 0) > 0;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await getRouteAuthContext();
  if (!auth || !canUseAdminUsersPanel(auth.profile)) {
    return redirectBack(request, { admin_error: "Acces non autorise." });
  }

  const admin = createAdminSupabaseClient();
  if (!admin) {
    return redirectBack(request, { admin_error: "Configuration serveur incomplete." });
  }

  const formData = await request.formData();
  const action = readText(formData, "action") || "update";
  const targetId = context.params.id;

  const { data: target, error: targetError } = await admin.from("profiles").select("*").eq("id", targetId).single();
  if (targetError || !target) {
    return redirectBack(request, { admin_error: "Profil introuvable." });
  }

  const targetProfile = target as Profile;
  const operation = action === "delete" ? "delete" : action === "reset_password" ? "reset_password" : action === "toggle" ? "toggle" : "update";
  if (!canManageProfileRole(auth.profile, targetProfile.role, operation)) {
    return redirectBack(request, { admin_error: "Votre role ne permet pas cette action sur ce compte." });
  }

  if (action === "delete") {
    if (targetId === auth.profile.id) {
      return redirectBack(request, { admin_error: "Suppression bloquee: vous ne pouvez pas supprimer votre propre compte." });
    }

    const confirmation = readText(formData, "confirmation");
    const acceptedConfirmation = confirmation === "SUPPRIMER" || confirmation === targetProfile.email || confirmation === targetProfile.full_name;
    if (!acceptedConfirmation) {
      return redirectBack(request, { admin_error: "Suppression annulee: confirmation obligatoire." });
    }

    const hasActiveOrPlannedCycles = await hasActiveCycles(admin, targetId);
    const hasRelatedCycles = hasActiveOrPlannedCycles || (await hasAnyCycles(admin, targetId));

    if (hasRelatedCycles) {
      const profileError = await updateProfileWithSchemaFallback(admin, targetId, {
        is_active: false,
        status: "inactive",
        deactivated_at: new Date().toISOString()
      });

      if (profileError) return redirectBack(request, { admin_error: formatAdminError(profileError, "Archivage impossible.") });

      await audit(admin, auth.profile, "user.archived", targetId, {
        email: targetProfile.email,
        role: targetProfile.role,
        reason: hasActiveOrPlannedCycles ? "active_or_planned_cycles" : "historical_cycles"
      });

      return redirectBack(request, { admin_archived: "1" });
    }

    await audit(admin, auth.profile, "user.deleted", targetId, {
      email: targetProfile.email,
      role: targetProfile.role
    });

    const { error: deleteError } = await admin.auth.admin.deleteUser(targetId);
    if (deleteError) return redirectBack(request, { admin_error: formatAdminError(deleteError.message, "Suppression impossible.") });

    return redirectBack(request, { admin_deleted: "1" });
  }

  if (action === "toggle") {
    const nextActive = targetProfile.is_active === false || targetProfile.status === "inactive";
    const nextStatus = nextActive ? "active" : "inactive";
    const profileError = await updateProfileWithSchemaFallback(admin, targetId, {
      is_active: nextActive,
      status: nextStatus,
      deactivated_at: nextActive ? null : new Date().toISOString()
    });

    if (profileError) return redirectBack(request, { admin_error: profileError });

    await audit(admin, auth.profile, nextActive ? "user.activated" : "user.deactivated", targetId, {
      email: targetProfile.email
    });
    return redirectBack(request, { admin_updated: "1" });
  }

  if (action === "reset_password") {
    const password = readText(formData, "password");
    if (password.length < 8) return redirectBack(request, { admin_error: "Nouveau mot de passe minimum 8 caracteres." });

    const { error } = await admin.auth.admin.updateUserById(targetId, { password });
    if (error) return redirectBack(request, { admin_error: formatAdminError(error.message, "Mot de passe non mis a jour.") });

    await audit(admin, auth.profile, "user.password_reset", targetId, {
      email: targetProfile.email
    });
    return redirectBack(request, { admin_updated: "1" });
  }

  const nextRole = readRole(formData, targetProfile.role);
  if (!canManageProfileRole(auth.profile, nextRole, "update")) {
    return redirectBack(request, { admin_error: "Votre role ne permet pas d'attribuer ce role." });
  }

  const fullName = readText(formData, "full_name") || targetProfile.full_name || "Utilisateur Formital";
  const email = readText(formData, "email").toLowerCase() || targetProfile.email || "";
  const status = readText(formData, "status") === "inactive" ? "inactive" : "active";
  const isActive = status === "active";
  const rfidBadgeId = readText(formData, "rfid_badge_id");

  if (targetId === auth.profile.id && (!isActive || nextRole !== targetProfile.role)) {
    return redirectBack(request, { admin_error: "Modification bloquee: vous ne pouvez pas changer votre propre role ou desactiver votre propre compte." });
  }

  if (!email.includes("@")) {
    return redirectBack(request, { admin_error: "Email invalide." });
  }

  const { error: authUpdateError } = await admin.auth.admin.updateUserById(targetId, {
    email,
    app_metadata: { role: nextRole },
    user_metadata: {
      full_name: fullName,
      role: nextRole,
      phone: readText(formData, "phone") || undefined,
      matricule: readText(formData, "matricule") || undefined,
      department: readText(formData, "department") || undefined,
      workshop: readText(formData, "workshop") || undefined,
      rfid_badge_id: rfidBadgeId || undefined
    }
  });

  if (authUpdateError) return redirectBack(request, { admin_error: formatAdminError(authUpdateError.message, "Compte auth non mis a jour.") });

  const profileError = await updateProfileWithSchemaFallback(admin, targetId, {
    email,
    full_name: fullName,
    role: nextRole,
    is_active: isActive,
    status,
    phone: readText(formData, "phone") || null,
    matricule: readText(formData, "matricule") || null,
    department: readText(formData, "department") || null,
    workshop: readText(formData, "workshop") || null,
    avatar_url: readText(formData, "avatar_url") || null,
    rfid_badge_id: rfidBadgeId || null,
    deactivated_at: isActive ? null : new Date().toISOString()
  });

  if (profileError) return redirectBack(request, { admin_error: formatAdminError(profileError, "Profil non mis a jour.") });

  await audit(admin, auth.profile, "user.updated", targetId, {
    email,
    role: nextRole,
    status,
    changed_fields: ["email", "full_name", "role", "status", "phone", "matricule", "department", "workshop", "rfid_badge_id"]
  });

  return redirectBack(request, { admin_updated: "1" });
}
