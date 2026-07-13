import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("module administration utilisateurs", () => {
  it("ajoute les fondations SQL profils et audit", () => {
    const migration = read("supabase/migrations/20260713000600_admin_user_management.sql");
    assert.match(migration, /add column if not exists phone text/);
    assert.match(migration, /add column if not exists matricule text/);
    assert.match(migration, /add column if not exists department text/);
    assert.match(migration, /add column if not exists workshop text/);
    assert.match(migration, /create table if not exists public\.roles/);
    assert.match(migration, /Roles are readable by authenticated users/);
    assert.match(migration, /create table if not exists public\.admin_audit_log/);
    assert.match(migration, /Engineers can update operator profiles/);
    assert.match(migration, /Admins can read audit log/);
  });

  it("protege les actions admin cote serveur", () => {
    const permissions = read("apps/web/lib/auth/api.ts");
    const createRoute = read("apps/web/app/api/admin/users/route.ts");
    const updateRoute = read("apps/web/app/api/admin/users/[id]/route.ts");
    assert.match(permissions, /canManageProfileRole/);
    assert.match(createRoute, /canUseAdminUsersPanel/);
    assert.match(createRoute, /admin\.auth\.admin\.createUser/);
    assert.match(updateRoute, /hasActiveCycles/);
    assert.match(updateRoute, /hasAnyCycles/);
    assert.match(updateRoute, /hasActiveOrPlannedCycles/);
    assert.match(updateRoute, /hasRelatedCycles/);
    assert.match(updateRoute, /Suppression bloquee/);
    assert.match(updateRoute, /vous ne pouvez pas supprimer votre propre compte/);
    assert.match(updateRoute, /user\.archived/);
    assert.match(updateRoute, /active_or_planned_cycles/);
    assert.match(updateRoute, /historical_cycles/);
    assert.match(updateRoute, /admin_archived/);
    assert.match(updateRoute, /confirmation/);
    assert.match(updateRoute, /SUPPRIMER/);
    assert.match(updateRoute, /admin\.auth\.admin\.deleteUser/);
    assert.match(updateRoute, /user\.password_reset/);
    assert.match(updateRoute, /actor_role/);
    assert.match(updateRoute, /formatAdminError/);
    assert.match(createRoute, /upsertProfileWithSchemaFallback/);
    assert.match(createRoute, /actor_role/);
    assert.match(createRoute, /formatAdminError/);
    assert.match(updateRoute, /updateProfileWithSchemaFallback/);
    assert.match(updateRoute, /missingColumnName/);
    assert.match(updateRoute, /rfid_badge_id/);
  });

  it("couvre creation, synchronisation auth et profiles sans compte orphelin", () => {
    const createRoute = read("apps/web/app/api/admin/users/route.ts");
    assert.match(createRoute, /admin\.auth\.admin\.createUser/);
    assert.match(createRoute, /email_confirm: true/);
    assert.match(createRoute, /app_metadata:\s*\{\s*role\s*\}/);
    assert.match(createRoute, /user_metadata/);
    assert.match(createRoute, /profilePayload/);
    assert.match(createRoute, /username: email\.split/);
    assert.match(createRoute, /status/);
    assert.match(createRoute, /phone/);
    assert.match(createRoute, /matricule/);
    assert.match(createRoute, /department/);
    assert.match(createRoute, /workshop/);
    assert.match(createRoute, /rfid_badge_id/);
    assert.match(createRoute, /await admin\.auth\.admin\.deleteUser\(created\.user\.id\)/);
    assert.match(createRoute, /user\.created/);
  });

  it("couvre modification, activation, suppression et reset mot de passe", () => {
    const updateRoute = read("apps/web/app/api/admin/users/[id]/route.ts");
    assert.match(updateRoute, /action === "toggle"/);
    assert.match(updateRoute, /user\.activated/);
    assert.match(updateRoute, /user\.deactivated/);
    assert.match(updateRoute, /action === "reset_password"/);
    assert.match(updateRoute, /admin\.auth\.admin\.updateUserById\(targetId, \{ password \}\)/);
    assert.match(updateRoute, /action === "delete"/);
    assert.match(updateRoute, /hasActiveCycles/);
    assert.match(updateRoute, /hasAnyCycles/);
    assert.match(updateRoute, /user\.archived/);
    assert.match(updateRoute, /active_or_planned_cycles/);
    assert.match(updateRoute, /admin_archived/);
    assert.match(updateRoute, /admin\.auth\.admin\.deleteUser\(targetId\)/);
    assert.match(updateRoute, /const operation = action === "delete" \? "delete"/);
    assert.match(updateRoute, /nextRole !== targetProfile\.role/);
    assert.match(updateRoute, /changed_fields/);
  });

  it("verifie les permissions et RLS du module admin", () => {
    const permissions = read("apps/web/lib/auth/api.ts");
    const roles = read("apps/web/lib/auth/roles.ts");
    const migration = read("supabase/migrations/20260713000600_admin_user_management.sql");
    assert.match(permissions, /if \(actor\.role === "admin"\) return true/);
    assert.match(permissions, /targetRole === "operator"/);
    assert.match(roles, /role === "admin"/);
    assert.match(roles, /pathname === "\/admin\/users"/);
    assert.match(migration, /alter table public\.admin_audit_log enable row level security/);
    assert.match(migration, /create policy "Admins can manage all profiles"/);
    assert.match(migration, /create policy "Engineers can update operator profiles"/);
    assert.match(migration, /prevent_profile_privilege_escalation/);
    assert.match(migration, /public\.current_profile_role\(\) = 'engineer' and role = 'operator'/);
    assert.match(migration, /create policy "Admins can read audit log"/);
    assert.match(migration, /create policy "Engineers can read operator audit log"/);
  });

  it("alimente dashboard et audit admin depuis les donnees reelles", () => {
    const dashboard = read("apps/web/app/admin/dashboard/page.tsx");
    const audit = read("apps/web/app/admin/audit/page.tsx");
    assert.match(dashboard, /getCipDashboardData\(profile\)/);
    assert.match(dashboard, /data\.users/);
    assert.match(dashboard, /admin_audit_log/);
    assert.match(dashboard, /operators/);
    assert.match(dashboard, /engineers/);
    assert.match(dashboard, /admins/);
    assert.match(audit, /admin_audit_log/);
    assert.match(audit, /actor_id/);
    assert.match(audit, /target_id/);
    assert.match(audit, /details/);
  });

  it("bloque les profils inactifs meme si is_active reste vrai", () => {
    const session = read("apps/web/lib/auth/session.ts");
    assert.match(session, /profile\.is_active === false \|\| profile\.status === "inactive"/);
    assert.match(session, /profile\?\.is_active && profile\.status !== "inactive"/);
  });

  it("expose une interface admin exploitable et responsive", () => {
    const users = read("apps/web/components/app/AdminUsersWorkspace.tsx");
    const detail = read("apps/web/app/admin/users/[id]/page.tsx");
    const dashboard = read("apps/web/app/admin/dashboard/page.tsx");
    const audit = read("apps/web/app/admin/audit/page.tsx");
    assert.match(users, /Rechercher nom, email, atelier/);
    assert.match(users, /Tous roles/);
    assert.match(users, /ModalShell/);
    assert.match(users, /createOpen/);
    assert.match(users, /deleteConfirmation/);
    assert.match(users, /Creer un utilisateur/);
    assert.match(users, /Supprimer ou archiver/);
    assert.match(users, /sera archive et desactive/);
    assert.match(users, /Badge RFID/);
    assert.match(users, /name="email"/);
    assert.match(users, /Ingenieurs/);
    assert.match(users, /Operateurs/);
    assert.match(users, /Page \{safePage\}/);
    assert.match(users, /md:hidden/);
    assert.match(detail, /Cycles total/);
    assert.match(detail, /Historique audit/);
    assert.match(detail, /badge_rfid/);
    assert.match(dashboard, /Derniers comptes/);
    assert.match(dashboard, /Dernieres connexions/);
    assert.match(audit, /Filtrer par action/);
  });

  it("journalise la creation rapide des operateurs", () => {
    const operatorRoute = read("apps/web/app/api/auth/operators/route.ts");
    assert.match(operatorRoute, /isPrivilegedProfile/);
    assert.match(operatorRoute, /admin_audit_log/);
    assert.match(operatorRoute, /actor_role/);
    assert.match(operatorRoute, /operator_settings/);
    assert.match(operatorRoute, /formatOperatorError/);
  });
});
