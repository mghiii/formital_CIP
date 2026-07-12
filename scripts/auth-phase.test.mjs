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
  });

  it("encode les autorisations attendues par role", () => {
    const roles = read("apps/web/lib/auth/roles.ts");
    assert.equal(roles.includes('pathname.startsWith("/admin")'), true);
    assert.equal(roles.includes('return profile.role === "admin";'), true);
    assert.equal(roles.includes('profile.role === "engineer" || profile.role === "admin"'), true);
    assert.equal(roles.includes('profile.role === "operator" || profile.role === "engineer" || profile.role === "admin"'), true);
  });

  it("protege les routes et les comptes inactifs", () => {
    const middleware = read("apps/web/middleware.ts");
    const homePage = read("apps/web/app/page.tsx");
    assert.match(middleware, /isProtectedPath/);
    assert.match(middleware, /canAccessPath/);
    assert.equal(middleware.includes("/inactive"), true);
    assert.equal(middleware.includes("/unauthorized"), true);
    assert.equal(homePage.includes('redirect("/login")'), true);
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
