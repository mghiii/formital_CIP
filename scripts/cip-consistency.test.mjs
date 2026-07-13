import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("coherence cycles CIP", () => {
  it("charge les donnees selon le role de la session", () => {
    const data = read("apps/web/lib/cip/data.ts");
    assert.match(data, /getCipDashboardData\(profile\?: Pick<Profile, "role">\)/);
    assert.match(data, /profile\?\.role === "engineer" \|\| profile\?\.role === "admin"/);
    assert.match(data, /createAdminSupabaseClient\(\) \?\? sessionClient/);
  });

  it("protege les exports avec la session active", () => {
    const route = read("apps/web/app/api/cip/export/route.ts");
    assert.match(route, /getCurrentProfile/);
    assert.match(route, /Votre session a expire/);
    assert.match(route, /getCipDashboardData\(profile\)/);
  });

  it("controle l'acces avant de modifier une checklist ou terminer un cycle", () => {
    const checklist = read("apps/web/app/api/cip/checklist/route.ts");
    const complete = read("apps/web/app/api/cip/cycles/complete/route.ts");
    assert.match(checklist, /canEditCycle/);
    assert.match(checklist, /cycle\?\.operator_id === user\.id/);
    assert.match(complete, /existingCycle\.operator_id !== user\.id/);
    assert.match(complete, /cycle-already-closed/);
  });

  it("enregistre les parametres et utilise une action anomalie valide", () => {
    const complete = read("apps/web/app/api/cip/cycles/complete/route.ts");
    assert.match(complete, /cip_parameters/);
    assert.match(complete, /temperature/);
    assert.match(complete, /water_consumed/);
    assert.match(complete, /inform_manager/);
    assert.equal(complete.includes("inform_supervisor"), false);
  });

  it("renforce les garanties SQL non destructives", () => {
    const migration = read("supabase/migrations/20260713000100_cycle_consistency_guards.sql");
    assert.match(migration, /cip_cycles_one_running_per_equipment_idx/);
    assert.match(migration, /where status = 'in_progress'/);
    assert.match(migration, /add column if not exists unit text/);
    assert.match(migration, /Equipment % already has a running CIP cycle/);
  });

  it("aligne le statut equipement cleaning avec compatibilite ancienne valeur", () => {
    const migration = read("supabase/migrations/20260713000200_equipment_status_consistency.sql");
    const data = read("apps/web/lib/cip/data.ts");
    const startRoute = read("apps/web/app/api/cip/cycles/start/route.ts");
    assert.match(migration, /rename value 'in_cleaning' to 'cleaning'/);
    assert.match(migration, /set status = 'cleaning'/);
    assert.match(data, /value === "cleaning" \|\| value === "in_cleaning"/);
    assert.match(startRoute, /\["cleaning", "in_cleaning", "out_of_service"\]/);
  });

  it("ajoute le workflow de traitement des alertes", () => {
    const route = read("apps/web/app/api/cip/alerts/update/route.ts");
    const migration = read("supabase/migrations/20260713000300_alert_resolution_workflow.sql");
    const views = read("apps/web/components/app/CipViews.tsx");
    assert.match(route, /intent === "resolve"/);
    assert.match(route, /resolved_by: user\.id/);
    assert.match(route, /acknowledged_at/);
    assert.match(migration, /resolution_comment text/);
    assert.match(views, /Acquitter/);
    assert.match(views, /Resoudre/);
  });

  it("affiche les cycles sous forme de cartes sur mobile", () => {
    const table = read("apps/web/components/app/CycleDetailsTable.tsx");
    assert.match(table, /md:hidden/);
    assert.match(table, /md:block/);
    assert.match(table, /Details/);
  });
});
