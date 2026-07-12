import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const requiredFiles = [
  "package.json",
  ".env.example",
  "apps/web/app/login/page.tsx",
  "apps/web/app/forgot-password/page.tsx",
  "apps/web/app/reset-password/page.tsx",
  "apps/web/app/auth/callback/route.ts",
  "apps/web/app/operator/dashboard/page.tsx",
  "apps/web/app/engineer/dashboard/page.tsx",
  "apps/web/app/admin/dashboard/page.tsx",
  "apps/web/middleware.ts",
  "apps/web/lib/auth/roles.ts",
  "apps/web/lib/auth/session.ts",
  "apps/web/lib/supabase/client.ts",
  "apps/web/lib/supabase/server.ts",
  "apps/api/app/main.py",
  "apps/api/app/core/security.py",
  "apps/api/app/schemas/auth.py",
  "apps/api/app/api/v1/auth.py",
  "apps/api/tests/test_auth_contract.py",
  "supabase/migrations/20260712000100_auth_roles_profiles.sql"
];

const failures = [];

for (const file of requiredFiles) {
  if (!existsSync(join(root, file))) {
    failures.push(`Fichier manquant: ${file}`);
  }
}

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

const migration = read("supabase/migrations/20260712000100_auth_roles_profiles.sql");
for (const snippet of ["add value 'admin'", "username text", "rfid_badge_id text", "public.is_admin"]) {
  if (!migration.includes(snippet)) {
    failures.push(`Migration auth incomplete: ${snippet}`);
  }
}

const roles = read("apps/web/lib/auth/roles.ts");
for (const snippet of ['operator: "/operator/dashboard"', 'engineer: "/engineer/dashboard"', 'admin: "/admin/dashboard"']) {
  if (!roles.includes(snippet)) {
    failures.push(`Redirection role manquante: ${snippet}`);
  }
}

for (const snippet of [
  'pathname.startsWith("/admin")',
  'profile.role === "admin"',
  'pathname.startsWith("/engineer")',
  'profile.role === "engineer" || profile.role === "admin"',
  'pathname.startsWith("/operator")',
  'profile.role === "operator" || profile.role === "engineer" || profile.role === "admin"'
]) {
  if (!roles.includes(snippet)) {
    failures.push(`Controle d'acces role incomplet: ${snippet}`);
  }
}

const webSources = [
  "apps/web/lib/supabase/client.ts",
  "apps/web/lib/supabase/server.ts",
  "apps/web/components/auth/LoginForm.tsx",
  "apps/web/middleware.ts"
].map(read).join("\n");

if (webSources.includes("SERVICE_ROLE") || webSources.includes("SUPABASE_SERVICE_ROLE_KEY")) {
  failures.push("La service_role ne doit pas apparaitre dans le code frontend.");
}

const middleware = read("apps/web/middleware.ts");
for (const snippet of ["/inactive", "/unauthorized", "isProtectedPath", "canAccessPath"]) {
  if (!middleware.includes(snippet)) {
    failures.push(`Middleware de protection incomplet: ${snippet}`);
  }
}

const callback = read("apps/web/app/auth/callback/route.ts");
for (const snippet of ["exchangeCodeForSession", "profiles", "getRoleHomePath", "/inactive"]) {
  if (!callback.includes(snippet)) {
    failures.push(`Callback auth incomplet: ${snippet}`);
  }
}

const apiSecurity = read("apps/api/app/core/security.py");
for (const snippet of ["HTTPBearer", "get_current_user", "get_current_profile", "require_roles"]) {
  if (!apiSecurity.includes(snippet)) {
    failures.push(`Securite API incomplete: ${snippet}`);
  }
}

const apiAuth = read("apps/api/app/services/supabase_auth.py");
for (const snippet of ["/auth/v1/user", "/rest/v1/profiles", "Authorization", "Bearer"]) {
  if (!apiAuth.includes(snippet)) {
    failures.push(`Validation Supabase API incomplete: ${snippet}`);
  }
}

if (failures.length > 0) {
  console.error("Validation phase Auth echouee:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Validation phase Auth OK");
