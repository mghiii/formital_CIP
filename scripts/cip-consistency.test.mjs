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

  it("automatise le demarrage planifie et la cloture a duree cible", () => {
    const automation = read("apps/web/lib/cip/automation.ts");
    const route = read("apps/web/app/api/cip/automation/tick/route.ts");
    const ticker = read("apps/web/components/app/CipAutomationTicker.tsx");
    const shell = read("apps/web/components/app/AppShell.tsx");

    assert.match(automation, /runCipAutomationTick/);
    assert.match(automation, /STARTABLE_CYCLE_STATUSES/);
    assert.match(automation, /RUNNING_CYCLE_STATUSES/);
    assert.match(automation, /planned_start_time/);
    assert.match(automation, /hasCompleteChecklist/);
    assert.match(automation, /startCycleThroughWorkflow/);
    assert.match(automation, /targetEndTime/);
    assert.match(automation, /status: "completed"/);
    assert.match(automation, /Cycle cloture automatiquement a la duree cible/);
    assert.match(route, /getRouteAuthContext/);
    assert.match(route, /runCipAutomationTick/);
    assert.match(route, /status: 401/);
    assert.match(route, /status: 405/);
    assert.match(ticker, /setInterval/);
    assert.match(ticker, /router\.refresh/);
    assert.match(shell, /CipAutomationTicker/);
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

  it("permet de basculer une machine entre nettoyee et disponible sans toucher aux cycles actifs", () => {
    const route = read("apps/web/app/api/cip/equipments/route.ts");
    const views = read("apps/web/components/app/CipViews.tsx");
    const operatorPage = read("apps/web/app/operator/equipments/page.tsx");
    const engineerPage = read("apps/web/app/engineer/equipments/page.tsx");
    const adminPage = read("apps/web/app/admin/equipments/page.tsx");

    assert.match(route, /intent === "status"/);
    assert.match(route, /editableEquipmentStatuses/);
    assert.match(route, /new Set\(\["available", "cleaned"\]\)/);
    assert.match(route, /lockedEquipmentStatuses/);
    assert.match(route, /new Set\(\["cleaning", "in_cleaning", "out_of_service"\]\)/);
    assert.match(route, /equipment-has-active-cycle/);
    assert.match(route, /createAdminSupabaseClient\(\) \?\? context\.supabase/);
    assert.match(views, /Rendre disponible/);
    assert.match(views, /Marquer nettoye/);
    assert.match(views, /equipmentStatusAction/);
    assert.match(views, /Statut machine mis a jour/);
    assert.match(operatorPage, /profile=\{profile\}/);
    assert.match(engineerPage, /profile=\{profile\}/);
    assert.match(adminPage, /profile=\{profile\}/);
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

  it("rend la solution CIP obligatoire au lancement et a la planification", () => {
    const views = read("apps/web/components/app/CipViews.tsx");
    const startRoute = read("apps/web/app/api/cip/cycles/start/route.ts");
    const planRoute = read("apps/web/app/api/cip/cycles/route.ts");
    const workflow = read("apps/web/lib/cip/workflow.ts");
    const migration = read("supabase/migrations/20260714000200_cip_solutions_and_concentrations.sql");

    assert.match(views, /name="solution_id"/);
    assert.match(views, /Solution de nettoyage utilisee/);
    assert.match(views, /Selectionnez une solution de nettoyage/);
    assert.match(startRoute, /validateActiveCipSolution/);
    assert.match(planRoute, /validateActiveCipSolution/);
    assert.match(startRoute, /p_solution_id/);
    assert.match(planRoute, /p_solution_id/);
    assert.match(workflow, /p_solution_id/);
    assert.match(migration, /create table if not exists public\.cip_solutions/);
    assert.match(migration, /solution_id uuid references public\.cip_solutions/);
    assert.match(migration, /grant select on public\.cip_solutions/);
  });

  it("enregistre et affiche les concentrations soude et acide", () => {
    const complete = read("apps/web/app/api/cip/cycles/complete/route.ts");
    const data = read("apps/web/lib/cip/data.ts");
    const details = read("apps/web/components/app/CycleDetailsTable.tsx");
    const views = read("apps/web/components/app/CipViews.tsx");
    const migration = read("supabase/migrations/20260714000200_cip_solutions_and_concentrations.sql");

    assert.match(complete, /caustic_concentration/);
    assert.match(complete, /acid_concentration/);
    assert.match(complete, /concentration_unit/);
    assert.match(complete, /component: "caustic"/);
    assert.match(complete, /component: "acid"/);
    assert.match(data, /causticConcentration/);
    assert.match(data, /acidConcentration/);
    assert.match(details, /Conc\. soude/);
    assert.match(details, /Conc\. acide/);
    assert.match(details, /concentrationSummary/);
    assert.match(views, /Concentration soude/);
    assert.match(views, /Concentration acide/);
    assert.match(migration, /caustic_concentration numeric/);
    assert.match(migration, /acid_concentration numeric/);
  });

  it("integre les solutions et concentrations dans les rapports PDF et Excel", () => {
    const reporting = read("apps/web/lib/cip/reporting.ts");
    const exportRoute = read("apps/web/app/api/cip/export/route.ts");

    assert.match(reporting, /solutionStats/);
    assert.match(reporting, /workshopSolutionStats/);
    assert.match(reporting, /causticAverage/);
    assert.match(reporting, /acidAverage/);
    assert.match(exportRoute, /Solutions utilisees/);
    assert.match(exportRoute, /Concentration par atelier/);
    assert.match(exportRoute, /addSolutionsPage/);
    assert.match(exportRoute, /Conc\. soude/);
    assert.match(exportRoute, /Conc\. acide/);
    assert.match(exportRoute, /Aucune donnee de concentration/);
  });
});
