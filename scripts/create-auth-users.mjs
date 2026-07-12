import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(new URL("..", import.meta.url).pathname);

function loadEnvFile(path) {
  if (!existsSync(path)) {
    return;
  }

  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [rawKey, ...rawValueParts] = trimmed.split("=");
    const key = rawKey.trim();
    const value = rawValueParts.join("=").trim().replace(/^["']|["']$/g, "");

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(resolve(projectRoot, ".env.local"));
loadEnvFile(resolve(projectRoot, "apps/web/.env.local"));

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const normalizedSupabaseUrl = supabaseUrl?.replace(/\/$/, "");

const roles = ["admin", "engineer", "operator"];
const users = roles
  .map((role) => {
    const prefix = `DIGITAL_CIP_${role.toUpperCase()}`;
    return {
      role,
      email: process.env[`${prefix}_EMAIL`],
      password: process.env[`${prefix}_PASSWORD`],
      fullName: process.env[`${prefix}_FULL_NAME`] || `Digital CIP ${role}`,
      username: process.env[`${prefix}_USERNAME`] || role,
      rfidBadgeId: process.env[`${prefix}_RFID_BADGE_ID`] || undefined
    };
  })
  .filter((user) => user.email || user.password);

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

if (!supabaseUrl) {
  fail("SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_URL est manquant dans .env.local.");
} else if (!serviceRoleKey) {
  fail("SUPABASE_SERVICE_ROLE_KEY est manquant dans .env.local. Ne mets jamais cette cle dans le frontend ni dans Git.");
} else if (users.length === 0) {
  fail(
    [
      "Aucun compte a creer. Ajoute au moins ces variables dans .env.local :",
      "DIGITAL_CIP_ADMIN_EMAIL=admin@example.com",
      "DIGITAL_CIP_ADMIN_PASSWORD=mot_de_passe_temporaire",
      "DIGITAL_CIP_ADMIN_FULL_NAME=Administrateur Digital CIP",
      "",
      "Tu peux aussi definir DIGITAL_CIP_ENGINEER_* et DIGITAL_CIP_OPERATOR_*."
    ].join("\n")
  );
} else if (users.some((user) => !user.email || !user.password)) {
  fail("Chaque compte doit avoir EMAIL et PASSWORD. Verifie les variables DIGITAL_CIP_* dans .env.local.");
} else {
  async function requestJson(path, options = {}) {
    const response = await fetch(`${normalizedSupabaseUrl}${path}`, {
      ...options,
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        ...(options.headers ?? {})
      }
    });
    const payload = await response.json().catch(() => ({}));

    return { response, payload };
  }

  async function findAuthUserByEmail(email) {
    const { response, payload } = await requestJson("/auth/v1/admin/users?page=1&per_page=1000");

    if (!response.ok) {
      throw new Error(payload.msg || payload.message || response.statusText);
    }

    const authUsers = Array.isArray(payload.users) ? payload.users : [];
    return authUsers.find((authUser) => authUser.email?.toLowerCase() === email.toLowerCase()) ?? null;
  }

  async function upsertProfilePayload(payload) {
    const response = await fetch(`${normalizedSupabaseUrl}/rest/v1/profiles?on_conflict=id`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        "content-type": "application/json",
        prefer: "resolution=merge-duplicates"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.message || payload.msg || response.statusText);
    }
  }

  async function upsertProfile(userId, user) {
    const basePayload = {
      id: userId,
      email: user.email,
      full_name: user.fullName,
      role: user.role,
      is_active: true
    };
    const payloads = [
      {
        ...basePayload,
        username: user.username,
        rfid_badge_id: user.rfidBadgeId
      },
      {
        ...basePayload,
        badge_rfid: user.rfidBadgeId
      },
      basePayload
    ];
    let lastError;

    for (const payload of payloads) {
      try {
        await upsertProfilePayload(payload);
        return;
      } catch (error) {
        lastError = error;
        if (!/schema cache|column|Could not find/i.test(error.message)) {
          break;
        }
      }
    }

    throw lastError;
  }

  for (const user of users) {
    let authUserId;
    try {
      const { response, payload } = await requestJson("/auth/v1/admin/users", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          email: user.email,
          password: user.password,
          email_confirm: true,
          app_metadata: {
            role: user.role
          },
          user_metadata: {
            full_name: user.fullName,
            username: user.username,
            rfid_badge_id: user.rfidBadgeId
          }
        })
      });

      if (response.ok) {
        authUserId = payload.id;
        console.log(`Compte auth cree: ${user.email} (${authUserId})`);
      } else if (/already|registered|exists/i.test(payload.msg || payload.message || "")) {
        const existingUser = await findAuthUserByEmail(user.email);
        if (!existingUser?.id) {
          throw new Error(`compte deja existant mais id introuvable pour ${user.email}`);
        }
        authUserId = existingUser.id;
        console.log(`Compte auth deja existant: ${user.email} (${authUserId})`);
      } else {
        console.error(`Echec creation ${user.role} <${user.email}>: ${payload.msg || payload.message || response.statusText}`);
        process.exitCode = 1;
        continue;
      }
    } catch (error) {
      console.error(`Impossible de joindre Supabase pour ${user.email}: ${error.message}`);
      process.exitCode = 1;
      continue;
    }

    try {
      await upsertProfile(authUserId, user);
    } catch (error) {
      console.error(`Compte cree, mais profil non synchronise pour ${user.email}: ${error.message}`);
      process.exitCode = 1;
      continue;
    }

    console.log(`Profil ${user.role} synchronise: ${user.email} (${authUserId})`);
  }
}
