import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("phase Authentification et roles", () => {
  it("redirige chaque role vers son espace", () => {
    const roles = read("apps/web/lib/auth/roles.ts");
    assert.equal(roles.includes('operator: "/operator/dashboard"'), true);
    assert.equal(roles.includes('engineer: "/engineer/dashboard"'), true);
    assert.equal(roles.includes('admin: "/admin/dashboard"'), true);
    assert.match(roles, /function getDashboardPath/);
  });

  it("encode les autorisations attendues par role", () => {
    const roles = read("apps/web/lib/auth/roles.ts");
    assert.equal(roles.includes('pathname.startsWith("/admin")'), true);
    assert.equal(roles.includes('role === "admin"'), true);
    assert.equal(roles.includes('pathname === "/admin/users"'), true);
    assert.equal(roles.includes('pathname.startsWith("/admin/users/")'), true);
    assert.equal(roles.includes('pathname.startsWith("/engineer")'), true);
    assert.equal(roles.includes('return role === "engineer";'), true);
    assert.equal(roles.includes('pathname.startsWith("/operator")'), true);
    assert.equal(roles.includes('return role === "operator";'), true);
    assert.equal(roles.includes("isAppRole"), true);
  });

  it("protege les routes et les comptes inactifs", () => {
    const middleware = read("apps/web/middleware.ts");
    const homePage = read("apps/web/app/page.tsx");
    assert.match(middleware, /isProtectedPath/);
    assert.match(middleware, /canAccessPath/);
    assert.equal(middleware.includes("/inactive"), true);
    assert.equal(middleware.includes("/unauthorized"), true);
    assert.equal(middleware.includes("/setup"), true);
    assert.equal(homePage.includes('redirect("/login")'), true);
  });

  it("securise les redirections Render et le logout", () => {
    const redirects = read("apps/web/lib/auth/redirects.ts");
    const logout = read("apps/web/app/auth/logout/route.ts");
    const callback = read("apps/web/app/auth/callback/route.ts");
    const middleware = read("apps/web/middleware.ts");

    assert.equal(redirects.includes('"0.0.0.0"'), true);
    assert.match(redirects, /NEXT_PUBLIC_APP_URL/);
    assert.match(redirects, /APP_URL/);
    assert.match(logout, /supabase\.auth\.signOut\(\)/);
    assert.match(logout, /response\.cookies\.set/);
    assert.match(logout, /redirectToAppPath\(request, "\/login", 303\)/);
    assert.equal(logout.includes('new URL("/login", request.url)'), false);
    assert.equal(callback.includes("cookieWrites"), true);
    assert.equal(callback.includes("getDashboardPath"), true);
    assert.equal(middleware.includes('toAppUrl(request, "/login")'), true);
  });

  it("refuse les profils invalides et ne force pas operator par defaut", () => {
    const bootstrap = read("apps/web/app/api/auth/profile-bootstrap/route.ts");
    const login = read("apps/web/components/auth/LoginForm.tsx");
    const session = read("apps/web/lib/auth/session.ts");
    const api = read("apps/web/lib/auth/api.ts");
    const roles = read("apps/web/lib/auth/roles.ts");

    assert.match(bootstrap, /return null/);
    assert.equal(bootstrap.includes('return "operator";\n}'), false);
    assert.match(bootstrap, /Profil manquant/);
    assert.match(login, /router\.replace\("\/unauthorized"\)/);
    assert.match(session, /redirect\("\/unauthorized"\)/);
    assert.match(session, /profile\.is_active === false \|\| profile\.status === "inactive"/);
    assert.match(api, /profile\.is_active === false \|\| profile\.status === "inactive"/);
    assert.match(roles, /profile\.is_active === false \|\| profile\.status === "inactive"/);
  });

  it("n'expose pas la service role dans le frontend", () => {
    const frontend = [
      read("apps/web/lib/supabase/client.ts"),
      read("apps/web/lib/supabase/server.ts"),
      read("apps/web/components/auth/LoginForm.tsx"),
      read("apps/web/middleware.ts")
    ].join("\n");
    assert.equal(frontend.includes("SUPABASE_SERVICE_ROLE_KEY"), false);
    assert.equal(frontend.includes("SERVICE_ROLE"), false);
  });

  it("permet aux ingenieurs de creer des comptes operateurs cote serveur", () => {
    const route = read("apps/web/app/api/auth/operators/route.ts");
    const settings = read("apps/web/components/app/CipViews.tsx");

    assert.match(route, /isPrivilegedProfile/);
    assert.match(route, /createAdminSupabaseClient/);
    assert.match(route, /role: "operator"/);
    assert.match(route, /admin\.auth\.admin\.createUser/);
    assert.match(settings, /Comptes operateurs/);
    assert.match(settings, /Creer le compte operateur/);
    assert.match(settings, /edit-operator-/);
    assert.match(settings, /delete-operator-/);
    assert.match(settings, /Supprimer ou archiver/);
    assert.match(settings, /Enregistrer les modifications/);
  });

  it("connecte le backend aux endpoints Supabase Auth et profiles", () => {
    const service = read("apps/api/app/services/supabase_auth.py");
    assert.equal(service.includes("/auth/v1/user"), true);
    assert.equal(service.includes("/rest/v1/profiles"), true);
    assert.equal(service.includes("Authorization"), true);
    assert.equal(service.includes("Bearer"), true);
  });

  it("met a jour le schema profiles et le role admin", () => {
    const migration = read("supabase/migrations/20260712000100_auth_roles_profiles.sql");
    assert.match(migration, /add value 'admin'/);
    assert.match(migration, /username text/);
    assert.match(migration, /rfid_badge_id text/);
    assert.equal(migration.includes("public.is_admin"), true);
  });
});
