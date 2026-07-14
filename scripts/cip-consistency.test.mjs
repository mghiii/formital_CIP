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

  it("centralise les calculs des rapports CIP", () => {
    const route = read("apps/web/app/api/cip/export/route.ts");
    const reporting = read("apps/web/lib/cip/reporting.ts");
    assert.match(route, /buildReportAnalytics/);
    assert.match(route, /filterReportCycles/);
    assert.doesNotMatch(route, /function cycleMetrics/);
    assert.doesNotMatch(route, /function dailyCounts/);
    assert.match(reporting, /export function buildReportAnalytics/);
    assert.match(reporting, /workshopStats/);
    assert.match(reporting, /programStats/);
    assert.match(reporting, /equipmentConsumption/);
  });

  it("documente les regles d'analyse sans seuil metier invente", () => {
    const reporting = read("apps/web/lib/cip/reporting.ts");
    const route = read("apps/web/app/api/cip/export/route.ts");
    assert.match(reporting, /REPORT_ANALYSIS_RULES/);
    assert.match(reporting, /threshold: "A valider"/);
    assert.match(reporting, /enabled: false/);
    assert.match(route, /seuils metier a valider/);
    assert.match(route, /Formital CIP/);
  });

  it("genere les graphiques PDF avec une grille paysage stable", () => {
    const route = read("apps/web/app/api/cip/export/route.ts");
    assert.match(route, /const PDF_LAYOUT/);
    assert.match(route, /pageWidth:\s*842/);
    assert.match(route, /pageHeight:\s*595/);
    assert.match(route, /MediaBox \[0 0 \$\{PDF_LAYOUT\.pageWidth\} \$\{PDF_LAYOUT\.pageHeight\}\]/);
    assert.match(route, /function ReportChartCard/);
    assert.match(route, /function pdfHorizontalBars/);
    assert.match(route, /function pdfVerticalHistogram/);
    assert.match(route, /labelWidthRatio:\s*0\.35/);
    assert.match(route, /valueWidthRatio:\s*0\.12/);
    assert.match(route, /row\.value === 0 \? 0/);
    assert.match(route, /addConsumptionPage/);
    assert.doesNotMatch(route, /MediaBox \[0 0 595 842\]/);
    assert.doesNotMatch(route, /function pdfBar/);
  });

  it("controle l'acces avant de modifier une checklist ou terminer un cycle", () => {
    const checklist = read("apps/web/app/api/cip/checklist/route.ts");
    const complete = read("apps/web/app/api/cip/cycles/complete/route.ts");
    assert.match(checklist, /canEditCycle/);
    assert.match(checklist, /cycle\?\.operator_id === user\.id/);
    assert.match(checklist, /startCycleThroughWorkflow/);
    assert.match(complete, /existingCycle\.operator_id !== user\.id/);
    assert.match(complete, /cycle-already-closed/);
    assert.match(complete, /cycle-not-running/);
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
    const migration = read("supabase/migrations/20260714000100_start_cip_cycle_rpc.sql");
    assert.match(migration, /cip_cycles_one_running_per_equipment_idx/);
    assert.match(migration, /where status in \('in_progress', 'running'\)/);
    assert.match(migration, /create_cip_cycle/);
    assert.match(migration, /start_cip_cycle/);
    assert.match(migration, /start_planned_cip_cycle/);
    assert.match(migration, /for update/);
    assert.match(migration, /EQUIPMENT_BUSY/);
    assert.match(migration, /INVALID_CYCLE_STATUS/);
    assert.match(migration, /CHECKLIST_INCOMPLETE/);
    assert.match(migration, /START_WINDOW_NOT_OPEN/);
  });

  it("cree un cycle et sa checklist via une RPC atomique", () => {
    const route = read("apps/web/app/api/cip/cycles/route.ts");
    const startRoute = read("apps/web/app/api/cip/cycles/start/route.ts");
    const workflow = read("apps/web/lib/cip/workflow.ts");
    const migration = read("supabase/migrations/20260714000100_start_cip_cycle_rpc.sql");

    assert.match(route, /createCycleThroughWorkflow/);
    assert.match(startRoute, /createCycleThroughWorkflow/);
    assert.match(workflow, /create_cip_cycle/);
    assert.match(workflow, /CreateCycleWorkflowPayload/);
    assert.match(migration, /returns jsonb/);
    assert.match(migration, /insert into public\.cip_cycles/);
    assert.match(migration, /insert into public\.cip_checklists/);
    assert.match(migration, /on conflict \(cycle_id\) do update/);
    assert.match(migration, /OPERATOR_INACTIVE/);
    assert.match(migration, /EQUIPMENT_PROCESS_MISSING/);
    assert.match(migration, /grant execute on function public\.create_cip_cycle/);
    assert.doesNotMatch(route, /from\("cip_cycles"\)\.insert/);
    assert.doesNotMatch(startRoute, /from\("cip_cycles"\)\.insert/);
  });

  it("centralise le demarrage des cycles CIP avec une RPC transactionnelle", () => {
    const startRoute = read("apps/web/app/api/cip/cycles/start/route.ts");
    const startPlannedRoute = read("apps/web/app/api/cip/cycles/start-planned/route.ts");
    const workflow = read("apps/web/lib/cip/workflow.ts");
    const migration = read("supabase/migrations/20260714000100_start_cip_cycle_rpc.sql");
    const timer = read("apps/web/components/app/CycleTimer.tsx");

    assert.match(startRoute, /p_status: "planned"/);
    assert.match(startRoute, /startCycleThroughWorkflow/);
    assert.match(startPlannedRoute, /startCycleThroughWorkflow/);
    assert.match(workflow, /start_cip_cycle/);
    assert.match(workflow, /start_planned_cip_cycle/);
    assert.match(workflow, /isRpcNotAvailable/);
    assert.doesNotMatch(startPlannedRoute, /status:\s*"in_progress"/);
    assert.doesNotMatch(startRoute, /status:\s*"in_progress"/);
    assert.match(migration, /operator_id = case/);
    assert.match(migration, /started_by = actor_id/);
    assert.match(migration, /update public\.equipments/);
    assert.match(migration, /status = 'cleaning'/);
    assert.match(migration, /'cycle', to_jsonb\(cycle_row\)/);
    assert.match(migration, /launch_window interval := interval '30 minutes'/);
    assert.match(migration, /where id = cycle_row\.id\s+and status::text in/);
    assert.match(timer, /cycleStatus !== "En cours"/);
  });

  it("affiche toujours une raison avant de bloquer un cycle planifie", () => {
    const views = read("apps/web/components/app/CipViews.tsx");
    assert.match(views, /getPlannedCycleReadiness/);
    assert.match(views, /Cycle bloque/);
    assert.match(views, /Checklist a valider avant le demarrage/);
    assert.match(views, /Cette machine est deja en nettoyage/);
    assert.match(views, /Ce cycle est assigne a un autre operateur/);
    assert.match(views, /readiness\.hardBlockers\.length > 0/);
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
