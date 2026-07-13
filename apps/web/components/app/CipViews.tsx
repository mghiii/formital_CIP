import type { ReactNode } from "react";
import { AddEquipmentModal } from "@/components/app/AddEquipmentModal";
import { AllCyclesGraphModal } from "@/components/app/AllCyclesGraphModal";
import { ChecklistPreviewModal } from "@/components/app/ChecklistPreviewModal";
import { CycleDetailsTable } from "@/components/app/CycleDetailsTable";
import { CycleTimer } from "@/components/app/CycleTimer";
import { KpiCard } from "@/components/app/KpiCard";
import { ConsumptionBars, MiniLineChart } from "@/components/app/SimpleCharts";
import { checklistItems } from "@/lib/cip/mock-data";
import type { CipDashboardData } from "@/lib/cip/data";
import type { Alert } from "@/lib/cip/mock-data";
import type { Profile } from "@/types/auth";

const fallbackData: CipDashboardData = {
  cycles: [],
  equipments: [],
  workshops: [],
  alerts: [],
  instructions: [],
  metrics: {
    totalCycles: 0,
    compliance: 0,
    water: 0,
    detergent: 0,
    activeAlerts: 0
  },
  dailyCycles: [],
  waterConsumption: [],
  detergentConsumption: [],
  users: [],
  checklists: {},
  source: "unavailable",
  notice: "Donnees de la base de donnees non disponibles."
};

function StatusBadge({ value }: { value: string }) {
  const tone =
    value === "Conforme" || value === "Termine" || value === "Disponible" || value === "Nettoye" || value === "Resolue" || value === "Actif"
      ? "bg-green-50 text-formital-green"
      : value === "Non conforme" || value === "Bloque" || value === "Hors service" || value === "Critique" || value === "Inactif" || value === "Non nettoye"
        ? "bg-red-50 text-red-700"
        : "bg-amber-50 text-amber-700";

  return <span className={`inline-flex shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${tone}`}>{value}</span>;
}

function SectionCard({
  title,
  action,
  actionHref,
  actionNode,
  className = "",
  bodyClassName = "",
  children
}: {
  title: string;
  action?: string;
  actionHref?: string;
  actionNode?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <section className={`self-start rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-colors ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-slate-950">{title}</h2>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {actionNode}
          {action && actionHref ? (
            <a href={actionHref} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-formital-green">
              {action}
            </a>
          ) : action ? (
            <button className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-formital-green">{action}</button>
          ) : null}
        </div>
      </div>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-40 place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500">
      {children}
    </div>
  );
}

export function QualityDashboardView({ data = fallbackData }: { data?: CipDashboardData }) {
  const metrics = data.metrics;
  const completedCycles = data.cycles.filter((cycle) => cycle.status === "Termine");
  const activeCycles = data.cycles.filter((cycle) => ["En cours", "Planifie"].includes(cycle.status));
  const compliantCycles = completedCycles.filter((cycle) => cycle.result === "Conforme").length;
  const nonCompliantCycles = completedCycles.filter((cycle) => cycle.result === "Non conforme").length;
  const tallCard = "flex h-full min-h-[34rem] flex-col self-stretch";
  const mediumCard = "flex h-full min-h-[24rem] flex-col self-stretch";
  const tableCard = "flex h-full min-h-[32rem] flex-col self-stretch";
  const cardBody = "flex min-h-0 flex-1 flex-col";
  const completedResultRows = [
    ["Conformes", compliantCycles, "bg-formital-green"],
    ["Non conformes", nonCompliantCycles, "bg-red-500"]
  ] as const;

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Cycles termines" value={String(metrics.totalCycles)} trend="Base de donnees" tone="green" />
        <KpiCard label="Conformite des cycles" value={`${metrics.compliance}%`} trend={`${compliantCycles} OK`} tone="green" />
        <KpiCard label="Consommation eau" value={`${metrics.water} m3`} trend="Total" tone="blue" />
        <KpiCard label="Consommation detergent" value={`${metrics.detergent} L`} trend="Total" tone="green" />
      </div>
      <div className="grid items-stretch gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard title="Cycles par jour" action="10 derniers jours" actionNode={<AllCyclesGraphModal cycles={data.cycles} equipments={data.equipments} />} className={tallCard} bodyClassName={cardBody}>
          <MiniLineChart values={data.dailyCycles} />
        </SectionCard>
        <SectionCard title="Conformite des cycles" className={tallCard} bodyClassName={cardBody}>
          <ComplianceDonutLite value={metrics.compliance} compliant={compliantCycles} nonCompliant={nonCompliantCycles} />
        </SectionCard>
      </div>
      <div className="grid items-stretch gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <CyclesTable compact cycles={completedCycles} checklists={data.checklists} cardClassName={tableCard} bodyClassName={cardBody} />
        <SectionCard title="Consommation periode selectionnee" className={tableCard} bodyClassName={cardBody}>
          <ConsumptionBars values={data.waterConsumption} altValues={data.detergentConsumption} />
        </SectionCard>
      </div>
      <div className="grid items-stretch gap-6 xl:grid-cols-3">
        <SectionCard title="Resultats des cycles termines" className={mediumCard} bodyClassName={cardBody}>
          <HorizontalMetricBars rows={completedResultRows} total={Math.max(completedCycles.length, 1)} />
        </SectionCard>
        <SectionCard title="Machines par atelier" className={mediumCard} bodyClassName={cardBody}>
          <WorkshopLoadChart data={data} />
        </SectionCard>
        <SectionCard title="Statut des equipements" className={mediumCard} bodyClassName={cardBody}>
          <EquipmentStatusChart data={data} />
        </SectionCard>
      </div>
      <div className="grid items-stretch gap-6 xl:grid-cols-3">
        <SectionCard title="Performance par programme CIP" className={tallCard} bodyClassName={cardBody}>
          <ProcessDecisionMatrix cycles={completedCycles} />
        </SectionCard>
        <SectionCard title="Ecart duree cible / reel" className={tallCard} bodyClassName={cardBody}>
          <DurationGapChart cycles={completedCycles} />
        </SectionCard>
        <SectionCard title="Consommation moyenne par cycle" className={tallCard} bodyClassName={cardBody}>
          <ResourceEfficiencyChart cycles={completedCycles} />
        </SectionCard>
      </div>
      <div className="grid items-stretch gap-6 xl:grid-cols-[1fr_1fr]">
        <SectionCard title="Priorites d'amelioration" className={mediumCard} bodyClassName={cardBody}>
          <ImprovementPriorityBoard cycles={completedCycles} equipments={data.equipments} alerts={data.alerts} />
        </SectionCard>
        <SectionCard title="Suivi operationnel des cycles" className={mediumCard} bodyClassName={cardBody}>
          <CycleFollowUpChart cycles={data.cycles} />
        </SectionCard>
      </div>
      <div className="grid items-stretch gap-6 xl:grid-cols-2">
        <SectionCard title="Cycles en cours et planifies" className={tableCard} bodyClassName={cardBody}>
          <CycleDetailsTable cycles={activeCycles} checklists={data.checklists} />
        </SectionCard>
        <SectionCard title="Cycles termines" className={tableCard} bodyClassName={cardBody}>
          <CycleDetailsTable cycles={completedCycles} checklists={data.checklists} />
        </SectionCard>
      </div>
      <DashboardExportPanel />
    </div>
  );
}

function ComplianceDonutLite({ value, compliant, nonCompliant }: { value: number; compliant: number; nonCompliant: number }) {
  const total = compliant + nonCompliant;
  const compliantWidth = total > 0 ? Math.max(4, (compliant / total) * 100) : 0;
  const nonCompliantWidth = total > 0 ? Math.max(nonCompliant > 0 ? 4 : 0, (nonCompliant / total) * 100) : 0;
  const target = 95;
  const gap = Math.max(0, Math.round((target - value) * 10) / 10);

  if (total === 0) {
    return <EmptyState>Aucun cycle termine pour calculer la conformite.</EmptyState>;
  }

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-[#315941] dark:bg-[#07170f]">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-muted">Taux de conformite</p>
            <p className="mt-1 text-4xl font-bold tracking-tight text-slate-950">{value}%</p>
          </div>
          <span className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${value >= target ? "bg-green-50 text-formital-green" : "bg-amber-50 text-amber-700"}`}>
            Objectif {target}%
          </span>
        </div>
        <div className="relative mt-5 h-5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
          <div className="absolute inset-y-0 left-0 bg-formital-green" style={{ width: `${compliantWidth}%` }} />
          <div className="absolute inset-y-0 right-0 bg-red-500" style={{ width: `${nonCompliantWidth}%` }} />
          <div className="absolute inset-y-[-0.25rem] w-0.5 bg-slate-950/40 dark:bg-white/70" style={{ left: `${target}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-xs font-bold text-muted">
          <span>0%</span>
          <span>Objectif</span>
          <span>100%</span>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-green-50 px-4 py-3 dark:bg-green-500/10">
          <div className="flex items-center justify-between gap-3">
            <span className="font-bold text-formital-green">Conformes</span>
            <span className="font-bold text-slate-950">{compliant} cycles</span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-white dark:bg-white/10">
            <div className="h-2 rounded-full bg-formital-green" style={{ width: `${compliantWidth}%` }} />
          </div>
        </div>
        <div className="rounded-lg bg-red-50 px-4 py-3 dark:bg-red-500/10">
          <div className="flex items-center justify-between gap-3">
            <span className="font-bold text-red-700">Non conformes</span>
            <span className="font-bold text-slate-950">{nonCompliant} cycles</span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-white dark:bg-white/10">
            <div className="h-2 rounded-full bg-red-500" style={{ width: `${nonCompliantWidth}%` }} />
          </div>
        </div>
      </div>
      <div className={`mt-auto rounded-lg px-4 py-3 text-sm font-semibold ${gap > 0 ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10" : "bg-green-50 text-formital-green dark:bg-green-500/10"}`}>
        {gap > 0
          ? `Il manque ${gap} point${gap > 1 ? "s" : ""} pour atteindre l'objectif qualite. Priorite: analyser les cycles non conformes.`
          : "Objectif qualite atteint sur les cycles termines."}
      </div>
    </div>
  );
}

function HorizontalMetricBars({ rows, total }: { rows: ReadonlyArray<readonly [string, number, string]>; total: number }) {
  return (
    <div className="grid h-full content-start gap-4">
      {rows.map(([label, value, color]) => (
        <div key={label}>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-semibold text-slate-700">{label}</span>
            <span className="font-bold text-slate-950">{value}</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100">
            <div className={`h-2.5 rounded-full ${color}`} style={{ width: `${Math.min(100, (value / total) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function WorkshopLoadChart({ data }: { data: CipDashboardData }) {
  const rows = data.workshops
    .map((workshop) => [workshop.name, workshop.equipments.length, "bg-formital-green"] as const)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const max = Math.max(...rows.map((row) => row[1]), 1);

  if (rows.length === 0) return <EmptyState>Aucun atelier disponible.</EmptyState>;

  return <HorizontalMetricBars rows={rows} total={max} />;
}

function EquipmentStatusChart({ data }: { data: CipDashboardData }) {
  const rows = [
    ["Disponibles", data.equipments.filter((equipment) => equipment.status === "Disponible").length, "bg-formital-green"],
    ["En nettoyage", data.equipments.filter((equipment) => equipment.status === "En nettoyage").length, "bg-sky-500"],
    ["Nettoyes", data.equipments.filter((equipment) => equipment.status === "Nettoye").length, "bg-emerald-500"],
    ["Hors service", data.equipments.filter((equipment) => equipment.status === "Hors service").length, "bg-red-500"]
  ] as const;

  return <HorizontalMetricBars rows={rows} total={Math.max(data.equipments.length, 1)} />;
}

type ProcessStats = {
  name: string;
  count: number;
  compliant: number;
  nonCompliant: number;
  compliance: number;
  avgDuration: number;
  avgTarget: number;
  avgWater: number;
  avgDetergent: number;
  durationGap: number;
};

function average(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function groupProcessStats(cycles: CipDashboardData["cycles"]): ProcessStats[] {
  const groups = new Map<string, CipDashboardData["cycles"]>();

  for (const cycle of cycles) {
    const rows = groups.get(cycle.process) ?? [];
    rows.push(cycle);
    groups.set(cycle.process, rows);
  }

  return Array.from(groups.entries())
    .map(([name, rows]) => {
      const compliant = rows.filter((cycle) => cycle.result === "Conforme").length;
      const nonCompliant = rows.filter((cycle) => cycle.result === "Non conforme").length;
      const avgDuration = average(rows.map((cycle) => cycle.duration));
      const avgTarget = average(rows.map((cycle) => cycle.targetDurationMinutes));

      return {
        name,
        count: rows.length,
        compliant,
        nonCompliant,
        compliance: rows.length ? Math.round((compliant / rows.length) * 1000) / 10 : 0,
        avgDuration,
        avgTarget,
        avgWater: average(rows.map((cycle) => cycle.water)),
        avgDetergent: average(rows.map((cycle) => cycle.detergent)),
        durationGap: Math.round((avgDuration - avgTarget) * 10) / 10
      };
    })
    .sort((a, b) => b.count - a.count || a.compliance - b.compliance);
}

function ProcessDecisionMatrix({ cycles }: { cycles: CipDashboardData["cycles"] }) {
  const rows = groupProcessStats(cycles).slice(0, 6);

  if (rows.length === 0) return <EmptyState>Aucun cycle termine pour analyser les programmes.</EmptyState>;

  return (
    <div className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto pr-1">
      {rows.map((row) => (
        <div key={row.name} className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-[#315941] dark:bg-[#07170f]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-950">{row.name}</p>
              <p className="mt-1 text-xs text-muted">{row.count} cycles termines</p>
            </div>
            <span className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${row.compliance >= 90 ? "bg-green-50 text-formital-green" : row.compliance >= 75 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
              {row.compliance}%
            </span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-lg bg-white p-2 dark:bg-white/5">
              <span className="text-muted">Duree moy.</span>
              <b className="mt-1 block text-slate-950">{row.avgDuration} min</b>
            </div>
            <div className="rounded-lg bg-white p-2 dark:bg-white/5">
              <span className="text-muted">Eau/cycle</span>
              <b className="mt-1 block text-slate-950">{row.avgWater} L</b>
            </div>
            <div className="rounded-lg bg-white p-2 dark:bg-white/5">
              <span className="text-muted">Det./cycle</span>
              <b className="mt-1 block text-slate-950">{row.avgDetergent} L</b>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DurationGapChart({ cycles }: { cycles: CipDashboardData["cycles"] }) {
  const rows = groupProcessStats(cycles)
    .filter((row) => row.count > 0)
    .sort((a, b) => Math.abs(b.durationGap) - Math.abs(a.durationGap))
    .slice(0, 6);
  const maxGap = Math.max(...rows.map((row) => Math.abs(row.durationGap)), 1);

  if (rows.length === 0) return <EmptyState>Aucune duree terminee disponible.</EmptyState>;

  return (
    <div className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto pr-1">
      {rows.map((row) => {
        const delayed = row.durationGap > 0;
        return (
          <div key={row.name}>
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="truncate font-semibold text-slate-700">{row.name}</span>
              <span className={`shrink-0 whitespace-nowrap font-bold ${delayed ? "text-red-700" : "text-formital-green"}`}>
                {delayed ? "+" : ""}{row.durationGap} min
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-100 dark:bg-white/10">
              <div
                className={`h-2.5 rounded-full ${delayed ? "bg-red-500" : "bg-formital-green"}`}
                style={{ width: `${Math.max(8, (Math.abs(row.durationGap) / maxGap) * 100)}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-muted">Reel {row.avgDuration} min / cible {row.avgTarget} min</p>
          </div>
        );
      })}
    </div>
  );
}

function ResourceEfficiencyChart({ cycles }: { cycles: CipDashboardData["cycles"] }) {
  const rows = groupProcessStats(cycles).sort((a, b) => (b.avgWater + b.avgDetergent) - (a.avgWater + a.avgDetergent)).slice(0, 6);
  const maxValue = Math.max(...rows.flatMap((row) => [row.avgWater, row.avgDetergent]), 1);

  if (rows.length === 0) return <EmptyState>Aucune consommation terminee disponible.</EmptyState>;

  return (
    <div className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto pr-1">
      {rows.map((row) => (
        <div key={row.name}>
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="truncate font-semibold text-slate-700">{row.name}</span>
            <span className="shrink-0 text-xs font-bold text-muted">{row.count} cycles</span>
          </div>
          <div className="grid gap-2">
            <div className="grid grid-cols-[4rem_1fr_4.5rem] items-center gap-2 text-xs">
              <span className="font-bold text-sky-600">Eau</span>
              <div className="h-2.5 rounded-full bg-slate-100 dark:bg-white/10">
                <div className="h-2.5 rounded-full bg-sky-500" style={{ width: `${Math.max(5, (row.avgWater / maxValue) * 100)}%` }} />
              </div>
              <b className="text-right">{row.avgWater} L</b>
            </div>
            <div className="grid grid-cols-[4rem_1fr_4.5rem] items-center gap-2 text-xs">
              <span className="font-bold text-formital-green">Det.</span>
              <div className="h-2.5 rounded-full bg-slate-100 dark:bg-white/10">
                <div className="h-2.5 rounded-full bg-formital-green" style={{ width: `${Math.max(5, (row.avgDetergent / maxValue) * 100)}%` }} />
              </div>
              <b className="text-right">{row.avgDetergent} L</b>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ImprovementPriorityBoard({
  cycles,
  equipments,
  alerts
}: {
  cycles: CipDashboardData["cycles"];
  equipments: CipDashboardData["equipments"];
  alerts: CipDashboardData["alerts"];
}) {
  const processRows = groupProcessStats(cycles);
  const lowestProcess = processRows.filter((row) => row.count > 0).sort((a, b) => a.compliance - b.compliance || b.durationGap - a.durationGap)[0];
  const slowestProcess = processRows.filter((row) => row.durationGap > 0).sort((a, b) => b.durationGap - a.durationGap)[0];
  const resourceProcess = processRows.sort((a, b) => (b.avgWater + b.avgDetergent) - (a.avgWater + a.avgDetergent))[0];
  const riskyEquipment = equipments.filter((equipment) => equipment.compliance > 0).sort((a, b) => a.compliance - b.compliance)[0];
  const activeAlerts = alerts.filter((alert) => alert.status === "Active");
  const rows = [
    lowestProcess ? ["Qualite", lowestProcess.name, `${lowestProcess.compliance}% conformite`, "bg-red-50 text-red-700"] : null,
    slowestProcess ? ["Temps", slowestProcess.name, `+${slowestProcess.durationGap} min vs cible`, "bg-amber-50 text-amber-700"] : null,
    resourceProcess ? ["Ressources", resourceProcess.name, `${Math.round((resourceProcess.avgWater + resourceProcess.avgDetergent) * 10) / 10} L/cycle`, "bg-sky-100 text-sky-700"] : null,
    riskyEquipment ? ["Machine", riskyEquipment.name, `${riskyEquipment.compliance}% conformite`, "bg-red-50 text-red-700"] : null,
    activeAlerts.length ? ["Alertes", `${activeAlerts.length} alerte${activeAlerts.length > 1 ? "s" : ""} active${activeAlerts.length > 1 ? "s" : ""}`, "Action corrective a suivre", "bg-amber-50 text-amber-700"] : null
  ].filter(Boolean) as Array<[string, string, string, string]>;

  if (rows.length === 0) return <EmptyState>Aucune priorite critique detectee pour le moment.</EmptyState>;

  return (
    <div className="grid h-full content-start gap-3 md:grid-cols-2">
      {rows.slice(0, 4).map(([label, title, detail, tone]) => (
        <div key={`${label}-${title}`} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-[#315941] dark:bg-[#07170f]">
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${tone}`}>{label}</span>
          <p className="mt-3 font-bold text-slate-950">{title}</p>
          <p className="mt-1 text-sm text-muted">{detail}</p>
        </div>
      ))}
    </div>
  );
}

function CycleFollowUpChart({ cycles }: { cycles: CipDashboardData["cycles"] }) {
  const rows = [
    ["Planifies", cycles.filter((cycle) => cycle.status === "Planifie").length, "bg-amber-500"],
    ["En cours", cycles.filter((cycle) => cycle.status === "En cours").length, "bg-sky-500"],
    ["Termines", cycles.filter((cycle) => cycle.status === "Termine").length, "bg-formital-green"],
    ["Bloques", cycles.filter((cycle) => cycle.status === "Bloque").length, "bg-red-500"]
  ] as const;
  const total = Math.max(cycles.length, 1);

  return (
    <div className="grid h-full content-start gap-4">
      <HorizontalMetricBars rows={rows} total={total} />
      <div className="rounded-lg bg-slate-50 p-4 text-sm text-muted dark:bg-white/5">
        <b className="text-slate-950">{cycles.filter((cycle) => ["Planifie", "En cours"].includes(cycle.status)).length}</b> cycles demandent un suivi operationnel.
        Les statistiques qualite restent basees uniquement sur les cycles termines.
      </div>
    </div>
  );
}

function DashboardExportPanel() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-950">Export rapport</h2>
          <p className="mt-1 text-sm text-muted">Rapport qualite genere depuis les donnees visibles dans la base de donnees.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <a href="/api/cip/export?format=pdf" className="rounded-lg bg-formital-green px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-formital-green-dark">
            Exporter PDF
          </a>
          <a href="/api/cip/export?format=excel" className="rounded-lg border border-formital-green px-4 py-3 text-center text-sm font-bold text-formital-green transition hover:bg-formital-green/10">
            Exporter Excel
          </a>
        </div>
      </div>
    </section>
  );
}

function CycleExecutionWorkspace({
  profile,
  data = fallbackData,
  historyHref = "/operator/history"
}: {
  profile: Profile;
  data?: CipDashboardData;
  historyHref?: string;
}) {
  const activeCycles = data.cycles.filter((cycle) => ["En cours", "Planifie"].includes(cycle.status));
  const occupiedEquipmentNames = new Set(activeCycles.map((cycle) => cycle.equipment));
  const fallbackOperatorName = profile.full_name ?? profile.email ?? "Operateur";
  const availableEquipments = data.equipments.filter(
    (equipment) => !["En nettoyage", "Hors service"].includes(equipment.status) && !occupiedEquipmentNames.has(equipment.name)
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
      <SectionCard title="Cycles CIP actifs" action={activeCycles.length > 0 ? `${activeCycles.length} cycle${activeCycles.length > 1 ? "s" : ""}` : undefined}>
        {activeCycles.length > 0 ? (
          <div className="grid gap-5">
            {activeCycles.map((cycle) => (
              <ActiveCycleCard key={cycle.id} cycle={cycle} fallbackOperatorName={fallbackOperatorName} checklist={data.checklists[cycle.id]} />
            ))}
          </div>
        ) : (
          <div className="grid gap-4">
            <CycleTimer />
            <EmptyState>
              Aucun cycle en cours ou planifie dans la base de donnees.
            </EmptyState>
          </div>
        )}
      </SectionCard>
      <SectionCard title="Lancer un nouveau cycle">
        <StartCycleForm data={data} availableEquipments={availableEquipments} />
      </SectionCard>
      <div className="xl:col-span-2">
        <CyclesTable compact cycles={data.cycles} checklists={data.checklists} historyHref={historyHref} />
      </div>
    </div>
  );
}

export function OperatorDashboardView({ profile, data = fallbackData }: { profile: Profile; data?: CipDashboardData }) {
  return <CycleExecutionWorkspace profile={profile} data={data} historyHref="/operator/history" />;
}

function parameterValue(value: number | string | undefined | null, suffix = "") {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return "A renseigner";
    return `${value}${suffix}`;
  }

  if (!value || value === "Non renseigne" || value === "Aucune observation") return "A renseigner";
  return value;
}

function CurrentParameters({ cycle }: { cycle: CipDashboardData["cycles"][number] }) {
  const parameters = [
    ["Temp", parameterValue(cycle.temperature, " C")],
    ["Eau", parameterValue(cycle.water, " L")],
    ["Det.", parameterValue(cycle.detergent, " L")],
    ["Soude", parameterValue(cycle.soda, " L")],
    ["Acide", parameterValue(cycle.acid, " L")],
    ["Aspect", parameterValue(cycle.visualAspect)]
  ] as const;

  return (
    <div className="rounded-lg bg-formital-green p-5 text-white">
      <p className="text-sm text-white/80">Parametres actuels</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {parameters.map(([label, value]) => (
          <div key={label} className="rounded-lg bg-white/10 px-3 py-3">
            <b className="block text-lg leading-tight">{value}</b>
            <span className="text-sm text-white/75">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActiveCycleCard({
  cycle,
  fallbackOperatorName,
  checklist
}: {
  cycle: CipDashboardData["cycles"][number];
  fallbackOperatorName: string;
  checklist?: CipDashboardData["checklists"][string];
}) {
  const operatorName = cycle.operator || fallbackOperatorName;

  return (
    <article className="grid gap-5 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-[#315941] dark:bg-[#07170f]">
      <div className="grid gap-5 md:grid-cols-[1fr_0.95fr]">
        <div>
          <p className="text-sm text-muted">Equipement</p>
          <p className="mt-1 text-2xl font-bold text-slate-950">{cycle.equipment}</p>
          <p className="mt-2 text-sm text-muted">{cycle.process} - Operateur: {operatorName}</p>
          <p className="mt-3"><StatusBadge value={cycle.status} /></p>
        </div>
        <CycleTimer cycle={cycle} />
      </div>
      <CurrentParameters cycle={cycle} />
      {cycle.status === "Planifie" ? (
        <PlannedCycleStartForm cycleId={cycle.id} checklist={checklist} />
      ) : (
      <form action="/api/cip/cycles/complete" method="post" className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-[#315941] dark:bg-[#08160f]">
        <input type="hidden" name="cycle_id" value={cycle.id} />
        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Temperature C
            <input name="temperature_c" type="number" step="0.1" defaultValue={cycle.temperature || ""} className="min-h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-formital-green" />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Eau consommee L
            <input name="water_consumed_l" type="number" step="0.1" defaultValue={cycle.water || ""} className="min-h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-formital-green" />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Aspect visuel
            <select name="visual_aspect" defaultValue={cycle.visualAspect && cycle.visualAspect !== "Non renseigne" ? cycle.visualAspect : "Conforme"} className="min-h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-formital-green">
              <option value="Conforme">Conforme</option>
              <option value="A verifier">A verifier</option>
              <option value="Non conforme">Non conforme</option>
            </select>
          </label>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Soude L
            <input name="soda_quantity" type="number" step="0.1" defaultValue={cycle.soda || ""} className="min-h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-formital-green" />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Acide L
            <input name="acid_quantity" type="number" step="0.1" defaultValue={cycle.acid || ""} className="min-h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-formital-green" />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Observation
            <input name="observation" defaultValue={cycle.observation && cycle.observation !== "Aucune observation" ? cycle.observation : ""} className="min-h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-formital-green" placeholder="Commentaire operateur" />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <button name="result" value="compliant" className="min-h-11 rounded-lg bg-formital-green px-4 font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
            Terminer conforme
          </button>
          <button name="result" value="non_compliant" className="min-h-11 rounded-lg border border-red-300 bg-red-50 px-4 font-bold text-red-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400">
            Terminer non conforme
          </button>
        </div>
      </form>
      )}
    </article>
  );
}

function PlannedCycleStartForm({ cycleId, checklist }: { cycleId: string; checklist?: CipDashboardData["checklists"][string] }) {
  const checklistRows = [
    ["valves_open", checklistItems[0], checklist?.valves_open ?? false],
    ["cleaning_product_available", checklistItems[1], checklist?.cleaning_product_available ?? false],
    ["tank_empty", checklistItems[2], checklist?.tank_empty ?? false],
    ["circuit_selected", checklistItems[3], checklist?.circuit_selected ?? false],
    ["safety_conditions_checked", checklistItems[4], checklist?.safety_conditions_checked ?? false]
  ] as const;

  return (
    <form action="/api/cip/cycles/start-planned" method="post" className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-[#315941] dark:bg-[#08160f]">
      <input type="hidden" name="cycle_id" value={cycleId} />
      <div>
        <h3 className="font-bold text-slate-950">Demarrer le cycle planifie</h3>
        <p className="mt-1 text-sm text-muted">Validez la checklist pour passer ce cycle en cours et vous l&apos;assigner.</p>
      </div>
      {checklistRows.map(([name, item, checked]) => (
        <label key={item} className="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 text-sm font-semibold">
          <input
            name={name}
            type="checkbox"
            defaultChecked={checked}
            required
            className="h-4 w-4 rounded border-slate-300 text-formital-green focus:ring-formital-green"
          />
          {item}
        </label>
      ))}
      <button type="submit" className="min-h-11 rounded-lg bg-formital-green px-4 font-bold text-white transition hover:bg-formital-green-dark">
        Demarrer ce cycle planifie
      </button>
    </form>
  );
}

function StartCycleForm({ data, availableEquipments }: { data: CipDashboardData; availableEquipments: CipDashboardData["equipments"] }) {
  return (
    <form action="/api/cip/cycles/start" method="post" className="grid gap-3">
      <label className="grid gap-2 text-sm font-semibold text-slate-700">
        Selectionner la machine
        <select
          name="equipment_id"
          required
          disabled={availableEquipments.length === 0}
          className="min-h-12 rounded-lg border border-slate-200 bg-white px-3 outline-none focus:border-formital-green disabled:cursor-not-allowed disabled:bg-slate-100"
        >
          <option value="">Choisir une machine disponible</option>
          {data.workshops.map((workshop) => {
            const workshopEquipments = workshop.equipments.filter((equipment) => availableEquipments.some((available) => available.id === equipment.id));
            if (workshopEquipments.length === 0) return null;

            return (
              <optgroup key={workshop.id} label={workshop.name}>
                {workshopEquipments.map((equipment) => (
                  <option key={equipment.id} value={equipment.id}>
                    {equipment.name} - {equipment.status}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
      </label>
      {[
        ["valves_open", checklistItems[0]],
        ["cleaning_product_available", checklistItems[1]],
        ["tank_empty", checklistItems[2]],
        ["circuit_selected", checklistItems[3]],
        ["safety_conditions_checked", checklistItems[4]]
      ].map(([name, item]) => (
        <label key={item} className="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 text-sm font-semibold">
          <input
            name={name}
            type="checkbox"
            required
            className="h-4 w-4 rounded border-slate-300 text-formital-green focus:ring-formital-green"
          />
          {item}
        </label>
      ))}
      <button
        name="intent"
        value="start"
        disabled={availableEquipments.length === 0}
        className="min-h-11 rounded-lg bg-formital-green px-4 font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        Creer et demarrer le cycle
      </button>
      {availableEquipments.length === 0 ? (
        <p className="text-sm font-semibold text-amber-700">Aucune machine disponible pour demarrer un nouveau CIP.</p>
      ) : null}
    </form>
  );
}

export function CyclesTable({
  compact = false,
  cycles: cycleRows = fallbackData.cycles,
  checklists = fallbackData.checklists,
  historyHref = "/engineer/history",
  allowDelete = false,
  cardClassName = "",
  bodyClassName = ""
}: {
  compact?: boolean;
  cycles?: CipDashboardData["cycles"];
  checklists?: CipDashboardData["checklists"];
  historyHref?: string;
  allowDelete?: boolean;
  cardClassName?: string;
  bodyClassName?: string;
}) {
  return (
    <SectionCard
      title={compact ? "Derniers cycles" : "Tous les cycles CIP"}
      action={compact ? "Voir tout l'historique" : undefined}
      actionHref={compact ? historyHref : undefined}
      className={cardClassName}
      bodyClassName={bodyClassName}
    >
      <CycleDetailsTable cycles={cycleRows} checklists={checklists} allowDelete={allowDelete} />
    </SectionCard>
  );
}

export function CyclesWorkspace({ profile, data = fallbackData }: { profile: Profile; data?: CipDashboardData }) {
  const inProgress = data.cycles.filter((cycle) => cycle.status === "En cours").length;
  const planned = data.cycles.filter((cycle) => cycle.status === "Planifie").length;
  const nonCompliant = data.cycles.filter((cycle) => cycle.result === "Non conforme").length;

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard label="Cycles en cours" value={String(inProgress)} trend="Actif" tone="amber" />
        <KpiCard label="Cycles planifies" value={String(planned)} trend="Base de donnees" tone="blue" />
        <KpiCard label="Cycles non conformes" value={String(nonCompliant)} trend="Controle" tone="red" />
      </div>
      <CycleExecutionWorkspace profile={profile} data={data} historyHref="/engineer/history" />
      <SectionCard title="Planifier un cycle CIP">
        <form action="/api/cip/cycles" method="post" className="grid gap-4 md:grid-cols-[1.2fr_1fr_1fr_auto] md:items-end">
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Equipement
            <select name="equipment_id" required className="min-h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-formital-green">
              <option value="">Selectionner</option>
              {data.equipments.map((equipment) => (
                <option key={equipment.id} value={equipment.id}>
                  {equipment.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Date planifiee
            <input name="planned_at" type="datetime-local" className="min-h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-formital-green" />
          </label>
          <ChecklistPreviewModal />
          <button className="min-h-11 rounded-lg bg-formital-green px-4 font-bold text-white md:col-span-4">Enregistrer le cycle</button>
        </form>
      </SectionCard>
    </div>
  );
}

export function HistoryWorkspace({ data = fallbackData }: { data?: CipDashboardData }) {
  const completed = data.cycles.filter((cycle) => cycle.status === "Termine").length;
  const compliant = data.cycles.filter((cycle) => cycle.result === "Conforme").length;
  const nonCompliant = data.cycles.filter((cycle) => cycle.result === "Non conforme").length;

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard label="Cycles termines" value={String(completed)} trend="Historique" tone="green" />
        <KpiCard label="Conformes" value={String(compliant)} trend="Qualite" tone="green" />
        <KpiCard label="Non conformes" value={String(nonCompliant)} trend="Controle" tone="red" />
      </div>
      <CyclesTable cycles={data.cycles} checklists={data.checklists} />
    </div>
  );
}

export function EquipmentsWorkspace({ data = fallbackData }: { data?: CipDashboardData }) {
  const inCleaning = data.equipments.filter((equipment) => equipment.status === "En nettoyage").length;
  const outOfService = data.equipments.filter((equipment) => equipment.status === "Hors service").length;
  const averageCompliance = Math.round(data.equipments.reduce((sum, equipment) => sum + equipment.compliance, 0) / Math.max(data.equipments.length, 1));

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Equipements actifs" value={String(data.equipments.length)} trend="Base de donnees" tone="green" />
        <KpiCard label="En nettoyage" value={String(inCleaning)} trend="CIP" tone="blue" />
        <KpiCard label="Hors service" value={String(outOfService)} trend="Alerte" tone="red" />
        <KpiCard label="Conformite moyenne" value={`${averageCompliance}%`} trend="Cycles" tone="green" />
      </div>
      <SectionCard title="Ateliers et machines">
        {data.workshops.length === 0 ? (
          <EmptyState>
            Aucun atelier disponible dans la base de donnees.
          </EmptyState>
        ) : (
          <div className="grid gap-5">
            {data.workshops.map((workshop) => (
              <article key={workshop.id} className="rounded-lg border border-slate-200 bg-white p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-formital-green">Atelier</p>
                    <h3 className="mt-1 text-xl font-bold text-slate-950">{workshop.name}</h3>
                    <p className="mt-1 text-sm text-muted">{workshop.description}</p>
                    <p className="mt-2 text-sm font-semibold text-slate-700">{workshop.equipments.length} machines</p>
                  </div>
                  <AddEquipmentModal processId={workshop.id} workshopName={workshop.name} />
                </div>
                {workshop.equipments.length === 0 ? (
                  <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                    Aucune machine dans cet atelier.
                  </div>
                ) : (
                  <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {workshop.equipments.map((equipment) => (
                      <article key={equipment.id} className="rounded-lg border border-slate-200 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h4 className="mt-2 text-lg font-bold text-slate-950">{equipment.name}</h4>
                          </div>
                          <StatusBadge value={equipment.status} />
                        </div>
                        <div className="mt-4">
                          <div className="flex justify-between text-sm">
                            <span>Conformite</span>
                            <b>{equipment.compliance}%</b>
                          </div>
                          <div className="mt-2 h-2 rounded-full bg-slate-100">
                            <div className="h-2 rounded-full bg-formital-green" style={{ width: `${equipment.compliance}%` }} />
                          </div>
                        </div>
                        <p className="mt-4 text-sm text-muted">Dernier cycle: {equipment.lastCycle}</p>
                      </article>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

export function AlertsWorkspace({
  data = fallbackData,
  profile,
  alertUpdated = false,
  alertError
}: {
  data?: CipDashboardData;
  profile?: Profile;
  alertUpdated?: boolean;
  alertError?: string;
}) {
  const active = data.alerts.filter((alert) => alert.status === "Active").length;
  const acknowledged = data.alerts.filter((alert) => alert.status === "Acquittee").length;
  const resolved = data.alerts.filter((alert) => alert.status === "Resolue").length;
  const canResolve = profile?.role === "engineer" || profile?.role === "admin";
  const alertErrorMessage =
    alertError === "alert-update"
      ? "La mise a jour de l'alerte a echoue. Verifiez que les migrations alertes sont deployees."
      : alertError === "alert-fields"
        ? "Action alerte incomplete."
        : alertError === "use-alert-form"
          ? "Utilisez les boutons de la page pour traiter une alerte."
          : alertError;

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard label="Alertes actives" value={String(active)} trend="A traiter" tone="red" />
        <KpiCard label="Acquittees" value={String(acknowledged)} trend="Suivi" tone="amber" />
        <KpiCard label="Resolues" value={String(resolved)} trend="OK" tone="green" />
      </div>
      <SectionCard title="Centre des alertes" action="Exporter">
        {alertUpdated ? (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-bold text-formital-green">
            Alerte mise a jour avec succes.
          </div>
        ) : null}
        {alertErrorMessage ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {alertErrorMessage}
          </div>
        ) : null}
        {data.alerts.length === 0 ? (
          <EmptyState>
            Aucune alerte CIP active ou historisee.
          </EmptyState>
        ) : (
          <div className="grid gap-3">
            {data.alerts.map((alert: Alert) => (
              <article key={alert.id} className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted">{alert.createdAt}</p>
                  <h3 className="mt-1 font-bold text-slate-950">{alert.title}</h3>
                  <p className="mt-1 text-sm text-muted">{alert.equipment}</p>
                </div>
                <div className="flex flex-col gap-2 md:items-end">
                  <div className="flex items-center gap-2">
                  <StatusBadge value={alert.severity} />
                  <StatusBadge value={alert.status} />
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    {alert.status === "Active" ? (
                      <form action="/api/cip/alerts/update" method="post">
                        <input type="hidden" name="alert_id" value={alert.id} />
                        <input type="hidden" name="intent" value="acknowledge" />
                        <button type="submit" className="rounded-lg border border-formital-green px-4 py-2 text-sm font-bold text-formital-green transition hover:bg-formital-green hover:text-white">
                          Acquitter
                        </button>
                      </form>
                    ) : null}
                    {canResolve && alert.status !== "Resolue" ? (
                      <form action="/api/cip/alerts/update" method="post" className="flex flex-wrap gap-2">
                        <input type="hidden" name="alert_id" value={alert.id} />
                        <input type="hidden" name="intent" value="resolve" />
                        <input
                          name="resolution_comment"
                          placeholder="Commentaire"
                          className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-formital-green"
                        />
                        <button type="submit" className="rounded-lg bg-formital-green px-4 py-2 text-sm font-bold text-white">
                          Resoudre
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

export function InstructionsWorkspace({ data = fallbackData }: { data?: CipDashboardData }) {
  return (
    <div className="grid gap-6">
      <SectionCard title="Instructions CIP">
        {data.instructions.length === 0 ? (
          <EmptyState>
            Aucune instruction CIP active dans la base de donnees.
          </EmptyState>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.instructions.map((instruction) => (
              <article key={instruction.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-formital-green">{instruction.process}</p>
                    <h3 className="mt-2 text-lg font-bold text-slate-950">{instruction.title}</h3>
                  </div>
                  <span className="shrink-0 whitespace-nowrap rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">v{instruction.version}</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-muted">{instruction.equipment}</p>
                <p className="mt-4 whitespace-pre-line text-sm leading-6 text-slate-700">{instruction.content}</p>
              </article>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

export function ReportsWorkspace({ data = fallbackData }: { data?: CipDashboardData }) {
  const nonCompliant = data.cycles.filter((cycle) => cycle.result === "Non conforme").length;
  const completed = data.cycles.filter((cycle) => cycle.status === "Termine").length;
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard label="Cycles exportables" value={String(data.cycles.length)} trend="Base de donnees" tone="green" />
        <KpiCard label="Equipements inclus" value={String(data.equipments.length)} trend="Parc" tone="blue" />
        <KpiCard label="Cycles termines" value={String(completed)} trend="Qualite" tone="amber" />
        <KpiCard label="Non conformites" value={String(nonCompliant)} trend="Controle" tone="red" />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Generer un rapport">
          <form action="/api/cip/export" method="get" className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Date debut
                <input
                  name="start_date"
                  type="date"
                  defaultValue={thirtyDaysAgo}
                  className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 outline-none focus:border-formital-green"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Date fin
                <input
                  name="end_date"
                  type="date"
                  defaultValue={today}
                  className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 outline-none focus:border-formital-green"
                />
              </label>
            </div>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Equipement
              <select name="equipment" defaultValue="all" className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 outline-none focus:border-formital-green">
                <option value="all">Tous les equipements</option>
                {data.equipments.map((equipment) => (
                  <option key={equipment.id} value={equipment.name}>
                    {equipment.name} - {equipment.line}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Type de rapport
                <select name="report_type" defaultValue="complete" className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 outline-none focus:border-formital-green">
                  <option value="complete">Rapport complet</option>
                  <option value="quality">Qualite et conformite</option>
                  <option value="consumption">Consommation eau et produits</option>
                  <option value="alerts">Non conformites et alertes</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Format
                <select name="format" defaultValue="pdf" className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 outline-none focus:border-formital-green">
                  <option value="pdf">PDF</option>
                  <option value="excel">Excel</option>
                </select>
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Statut des cycles
                <select name="status" defaultValue="completed" className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 outline-none focus:border-formital-green">
                  <option value="completed">Cycles termines</option>
                  <option value="active">Cycles en cours et planifies</option>
                  <option value="all">Tous les cycles</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Resultat
                <select name="result" defaultValue="all" className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 outline-none focus:border-formital-green">
                  <option value="all">Tous les resultats</option>
                  <option value="compliant">Conformes</option>
                  <option value="non_compliant">Non conformes</option>
                  <option value="pending">En attente</option>
                </select>
              </label>
            </div>
            <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-950">Contenu a inclure</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["include_cycles", "Tableau des cycles"],
                  ["include_parameters", "Parametres CIP"],
                  ["include_alerts", "Alertes"],
                  ["include_workshops", "Ateliers et machines"]
                ].map(([name, label]) => (
                  <label key={name} className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                    <input name={name} type="checkbox" defaultChecked className="h-4 w-4 rounded border-slate-300 text-formital-green focus:ring-formital-green" />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <button className="min-h-12 rounded-lg bg-formital-green px-4 font-bold text-white transition hover:bg-formital-green-dark">
              Generer le rapport
            </button>
          </form>
        </SectionCard>
        <SectionCard title="Evolution consommation">
          <ConsumptionBars values={data.waterConsumption} altValues={data.detergentConsumption} />
        </SectionCard>
      </div>
    </div>
  );
}

export function UsersWorkspace({ data = fallbackData }: { data?: CipDashboardData }) {
  return (
    <div className="grid gap-6">
      <SectionCard title="Utilisateurs et roles" action="Creer un utilisateur">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="py-3 pr-4">Email</th><th className="py-3 pr-4">Nom</th><th className="py-3 pr-4">Role</th><th className="py-3 pr-4">Etat</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center font-semibold text-slate-500">
                    Aucun profil visible dans la base de donnees pour cette session.
                  </td>
                </tr>
              ) : (
                data.users.map(([email, name, role, status]) => (
                  <tr key={email}>
                    <td className="py-3 pr-4 font-semibold">{email}</td>
                    <td className="py-3 pr-4">{name}</td>
                    <td className="py-3 pr-4"><StatusBadge value={role} /></td>
                    <td className="py-3 pr-4"><StatusBadge value={status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

export function SettingsWorkspace({
  data = fallbackData,
  operatorCreated = false,
  operatorError
}: {
  data?: CipDashboardData;
  operatorCreated?: boolean;
  operatorError?: string;
}) {
  const operators = data.users.filter(([, , role]) => role === "operator");

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Parametres CIP">
          <div className="grid gap-4">
            {["Temperature minimale", "Duree minimale", "Conductivite cible", "Seuil alerte critique"].map((label) => (
              <label key={label} className="grid gap-2 text-sm font-semibold text-slate-700">
                {label}
                <input className="min-h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-formital-green" defaultValue="A configurer" />
              </label>
            ))}
          </div>
        </SectionCard>
        <SectionCard title="Securite et audit">
          <div className="grid gap-3 text-sm">
            {["RLS active sur les tables sensibles", "Roles: operator, engineer, admin", "Creation comptes via service_role uniquement", "Exports journalises"].map((item) => (
              <div key={item} className="rounded-lg border border-slate-200 px-4 py-3 font-semibold">{item}</div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Comptes operateurs">
        <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
          <form action="/api/auth/operators" method="post" className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-formital-green">Creation securisee</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Le compte est cree avec le role operateur et un profil actif dans la base de donnees.
              </p>
            </div>

            {operatorCreated ? (
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-bold text-formital-green">
                Compte operateur cree avec succes.
              </div>
            ) : null}

            {operatorError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                {operatorError}
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Nom complet
                <input
                  name="full_name"
                  required
                  minLength={2}
                  placeholder="Operateur Formital"
                  className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 outline-none focus:border-formital-green"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Email
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="operateur@formital.com"
                  className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 outline-none focus:border-formital-green"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Mot de passe
                <input
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  placeholder="Minimum 8 caracteres"
                  className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 outline-none focus:border-formital-green"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Badge RFID
                <input
                  name="rfid_badge_id"
                  placeholder="Optionnel"
                  className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 outline-none focus:border-formital-green"
                />
              </label>
            </div>

            <button className="min-h-12 rounded-lg bg-formital-green px-4 py-3 text-sm font-bold text-white transition hover:bg-formital-green-dark" type="submit">
              Creer le compte operateur
            </button>
          </form>

          <div className="rounded-lg border border-slate-200 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold uppercase tracking-wide text-slate-500">Operateurs actifs</p>
                <p className="text-3xl font-black text-slate-950">{operators.filter(([, , , status]) => status === "Actif").length}</p>
              </div>
              <StatusBadge value="Base de donnees" />
            </div>
            <div className="grid gap-3">
              {operators.length === 0 ? (
                <EmptyState>Aucun operateur visible pour cette session.</EmptyState>
              ) : (
                operators.map(([email, name, role, status]) => (
                  <div key={email} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-3">
                    <div>
                      <p className="font-bold text-slate-950">{name}</p>
                      <p className="text-sm font-semibold text-slate-500">{email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge value={role} />
                      <StatusBadge value={status} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
