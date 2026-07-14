import type { CipDashboardData } from "@/lib/cip/data";
import type { Alert, CipCycle } from "@/lib/cip/mock-data";

export type ReportOptions = {
  format: string;
  reportType: string;
  startDate: string;
  endDate: string;
  equipment: string;
  solution: string;
  status: string;
  result: string;
  includeCycles: boolean;
  includeParameters: boolean;
  includeAlerts: boolean;
  includeWorkshops: boolean;
};

export type ReportAnalysisRule = {
  id: string;
  label: string;
  formula: string;
  threshold: "A valider";
  enabled: false;
};

export const REPORT_ANALYSIS_RULES: ReportAnalysisRule[] = [
  {
    id: "workshop_consumption_variation",
    label: "Variation de consommation par atelier",
    formula: "Comparer la consommation du cycle a une moyenne atelier validee par le responsable qualite.",
    threshold: "A valider",
    enabled: false
  },
  {
    id: "night_non_conformity_rate",
    label: "Taux de non-conformite nuit/jour",
    formula: "Comparer le taux de non-conformite nocturne au taux diurne avec un seuil qualite valide.",
    threshold: "A valider",
    enabled: false
  },
  {
    id: "duration_overrun",
    label: "Depassement de duree cible",
    formula: "Comparer duree reelle et duree cible avec une tolerance qualite validee.",
    threshold: "A valider",
    enabled: false
  }
];

function number1(value: number) {
  return Math.round(value * 10) / 10;
}

function stats(values: number[]) {
  if (values.length === 0) {
    return { average: 0, min: 0, max: 0 };
  }

  return {
    average: number1(values.reduce((sum, value) => sum + value, 0) / values.length),
    min: number1(Math.min(...values)),
    max: number1(Math.max(...values))
  };
}

export function pct(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

export function dateBoundary(value: string, endOfDay = false) {
  if (!value) return null;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseFrenchDate(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (!match) return null;
  const [, day, month, year, hour = "00", minute = "00"] = match;
  const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:00.000`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function cycleDate(cycle: CipCycle) {
  const rawDate = cycle.startedAt ?? cycle.plannedAt;
  const date = rawDate ? new Date(rawDate) : parseFrenchDate(cycle.date);
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

export function filterReportCycles(cycles: CipCycle[], options: ReportOptions) {
  const start = dateBoundary(options.startDate);
  const end = dateBoundary(options.endDate, true);

  return cycles.filter((cycle) => {
    const started = cycleDate(cycle);
    if (start && started && started < start) return false;
    if (end && started && started > end) return false;
    if (options.equipment !== "all" && cycle.equipment !== options.equipment) return false;
    if (options.solution !== "all" && cycle.solutionId !== options.solution && cycle.solution !== options.solution) return false;
    if (options.status === "completed" && cycle.status !== "Termine") return false;
    if (options.status === "active" && !["En cours", "Planifie"].includes(cycle.status)) return false;
    if (options.status === "blocked" && cycle.status !== "Bloque") return false;
    if (options.result === "compliant" && cycle.result !== "Conforme") return false;
    if (options.result === "non_compliant" && cycle.result !== "Non conforme") return false;
    if (options.result === "pending" && cycle.result !== "En attente") return false;
    return true;
  });
}

export function reportTypeLabel(value: string) {
  const labels: Record<string, string> = {
    complete: "Rapport complet",
    quality: "Qualite et conformite",
    consumption: "Consommation eau et produits",
    alerts: "Non conformites et alertes"
  };

  return labels[value] ?? labels.complete;
}

export function periodLabel(options: Pick<ReportOptions, "startDate" | "endDate">) {
  if (options.startDate && options.endDate) return `${options.startDate} au ${options.endDate}`;
  if (options.startDate) return `Depuis ${options.startDate}`;
  if (options.endDate) return `Jusqu'au ${options.endDate}`;
  return "Toutes les dates";
}

function dayKey(cycle: CipCycle) {
  const date = cycleDate(cycle);
  return date ? date.toISOString().slice(0, 10) : cycle.date.slice(0, 10);
}

function groupAlerts(alerts: Alert[], equipmentFilter = "all") {
  const selected = alerts.filter((alert) => equipmentFilter === "all" || alert.equipment === equipmentFilter);

  return {
    total: selected.length,
    active: selected.filter((alert) => alert.status === "Active").length,
    critical: selected.filter((alert) => alert.severity === "Critique").length,
    warnings: selected.filter((alert) => alert.severity === "Warning").length,
    info: selected.filter((alert) => alert.severity === "Info").length
  };
}

export function buildReportAnalytics(data: CipDashboardData, cycles: CipCycle[]) {
  const completed = cycles.filter((cycle) => cycle.status === "Termine");
  const compliant = completed.filter((cycle) => cycle.result === "Conforme").length;
  const nonCompliant = completed.filter((cycle) => cycle.result === "Non conforme").length;
  const active = cycles.filter((cycle) => cycle.status === "En cours").length;
  const planned = cycles.filter((cycle) => cycle.status === "Planifie").length;
  const blocked = cycles.filter((cycle) => cycle.status === "Bloque").length;
  const water = completed.reduce((sum, cycle) => sum + cycle.water, 0);
  const soda = completed.reduce((sum, cycle) => sum + cycle.soda, 0);
  const acid = completed.reduce((sum, cycle) => sum + cycle.acid, 0);
  const detergent = completed.reduce((sum, cycle) => sum + cycle.detergent, 0);
  const totalDuration = completed.reduce((sum, cycle) => sum + cycle.duration, 0);
  const equipmentByName = new Map(data.equipments.map((equipment) => [equipment.name, equipment]));

  const equipmentRows = new Map<string, { equipment: string; workshop: string; water: number; detergent: number; soda: number; acid: number; cycles: number }>();
  const dailyRows = new Map<string, { day: string; label: string; count: number; completed: number; active: number; planned: number; blocked: number }>();
  const workshopRows = new Map<string, { workshop: string; cycles: number; compliant: number; nonCompliant: number; water: number; detergent: number }>();
  const programRows = new Map<string, { program: string; cycles: number; compliant: number; nonCompliant: number; duration: number; water: number; detergent: number }>();
  const solutionRows = new Map<
    string,
    {
      solution: string;
      type: string;
      unit: string;
      cycles: number;
      causticValues: number[];
      acidValues: number[];
      missingValues: number;
      compliant: number;
      nonCompliant: number;
    }
  >();
  const workshopSolutionRows = new Map<
    string,
    {
      workshop: string;
      cycles: number;
      causticCycles: number;
      acidCycles: number;
      causticValues: number[];
      acidValues: number[];
      missingValues: number;
      compliant: number;
      nonCompliant: number;
      unit: string;
    }
  >();

  for (const cycle of cycles) {
    const equipment = equipmentByName.get(cycle.equipment);
    const workshop = equipment?.line ?? "Atelier non renseigne";
    const day = dayKey(cycle);
    const daily = dailyRows.get(day) ?? {
      day,
      label: day.includes("-") ? day.slice(5) : day,
      count: 0,
      completed: 0,
      active: 0,
      planned: 0,
      blocked: 0
    };
    daily.count += 1;
    if (cycle.status === "Termine") daily.completed += 1;
    if (cycle.status === "En cours") daily.active += 1;
    if (cycle.status === "Planifie") daily.planned += 1;
    if (cycle.status === "Bloque") daily.blocked += 1;
    dailyRows.set(day, daily);

    if (cycle.status !== "Termine") continue;
    const solutionName = cycle.solution ?? "Solution non renseignee";
    const solutionType = String(cycle.solutionType ?? "other");
    const concentrationUnit = cycle.concentrationUnit ?? "%";
    const hasCaustic = typeof cycle.causticConcentration === "number" && cycle.causticConcentration > 0;
    const hasAcid = typeof cycle.acidConcentration === "number" && cycle.acidConcentration > 0;
    const missingConcentration =
      (solutionType === "caustic" && !hasCaustic) ||
      (solutionType === "acid" && !hasAcid) ||
      (!["caustic", "acid"].includes(solutionType) && !hasCaustic && !hasAcid);

    const equipmentRow = equipmentRows.get(cycle.equipment) ?? {
      equipment: cycle.equipment,
      workshop,
      water: 0,
      detergent: 0,
      soda: 0,
      acid: 0,
      cycles: 0
    };
    equipmentRow.water += cycle.water;
    equipmentRow.detergent += cycle.detergent;
    equipmentRow.soda += cycle.soda;
    equipmentRow.acid += cycle.acid;
    equipmentRow.cycles += 1;
    equipmentRows.set(cycle.equipment, equipmentRow);

    const workshopRow = workshopRows.get(workshop) ?? { workshop, cycles: 0, compliant: 0, nonCompliant: 0, water: 0, detergent: 0 };
    workshopRow.cycles += 1;
    workshopRow.compliant += cycle.result === "Conforme" ? 1 : 0;
    workshopRow.nonCompliant += cycle.result === "Non conforme" ? 1 : 0;
    workshopRow.water += cycle.water;
    workshopRow.detergent += cycle.detergent;
    workshopRows.set(workshop, workshopRow);

    const programRow = programRows.get(cycle.process) ?? {
      program: cycle.process,
      cycles: 0,
      compliant: 0,
      nonCompliant: 0,
      duration: 0,
      water: 0,
      detergent: 0
    };
    programRow.cycles += 1;
    programRow.compliant += cycle.result === "Conforme" ? 1 : 0;
    programRow.nonCompliant += cycle.result === "Non conforme" ? 1 : 0;
    programRow.duration += cycle.duration;
    programRow.water += cycle.water;
    programRow.detergent += cycle.detergent;
    programRows.set(cycle.process, programRow);

    const solutionRow = solutionRows.get(solutionName) ?? {
      solution: solutionName,
      type: solutionType,
      unit: concentrationUnit,
      cycles: 0,
      causticValues: [],
      acidValues: [],
      missingValues: 0,
      compliant: 0,
      nonCompliant: 0
    };
    solutionRow.cycles += 1;
    solutionRow.compliant += cycle.result === "Conforme" ? 1 : 0;
    solutionRow.nonCompliant += cycle.result === "Non conforme" ? 1 : 0;
    if (hasCaustic) solutionRow.causticValues.push(cycle.causticConcentration ?? 0);
    if (hasAcid) solutionRow.acidValues.push(cycle.acidConcentration ?? 0);
    if (missingConcentration) solutionRow.missingValues += 1;
    solutionRows.set(solutionName, solutionRow);

    const workshopSolutionRow = workshopSolutionRows.get(workshop) ?? {
      workshop,
      cycles: 0,
      causticCycles: 0,
      acidCycles: 0,
      causticValues: [],
      acidValues: [],
      missingValues: 0,
      compliant: 0,
      nonCompliant: 0,
      unit: concentrationUnit
    };
    workshopSolutionRow.cycles += 1;
    workshopSolutionRow.causticCycles += solutionType === "caustic" ? 1 : 0;
    workshopSolutionRow.acidCycles += solutionType === "acid" ? 1 : 0;
    workshopSolutionRow.compliant += cycle.result === "Conforme" ? 1 : 0;
    workshopSolutionRow.nonCompliant += cycle.result === "Non conforme" ? 1 : 0;
    if (hasCaustic) workshopSolutionRow.causticValues.push(cycle.causticConcentration ?? 0);
    if (hasAcid) workshopSolutionRow.acidValues.push(cycle.acidConcentration ?? 0);
    if (missingConcentration) workshopSolutionRow.missingValues += 1;
    workshopSolutionRows.set(workshop, workshopSolutionRow);
  }

  return {
    metrics: {
      total: cycles.length,
      completed: completed.length,
      active,
      planned,
      blocked,
      compliant,
      nonCompliant,
      compliance: completed.length ? number1((compliant / completed.length) * 100) : 0,
      waterM3: number1(water / 1000),
      waterLiters: number1(water),
      detergent: number1(detergent),
      soda: number1(soda),
      acid: number1(acid),
      totalDuration: number1(totalDuration),
      averageDuration: completed.length ? number1(totalDuration / completed.length) : 0,
      equipmentsUsed: new Set(cycles.map((cycle) => cycle.equipment)).size
    },
    statusCounts: { completed: completed.length, active, planned, blocked },
    resultCounts: { compliant, nonCompliant, pending: cycles.filter((cycle) => cycle.result === "En attente").length },
    alertStats: groupAlerts(data.alerts),
    equipmentConsumption: Array.from(equipmentRows.values())
      .map((row) => ({
        ...row,
        water: number1(row.water),
        detergent: number1(row.detergent),
        soda: number1(row.soda),
        acid: number1(row.acid)
      }))
      .sort((a, b) => b.water + b.detergent - (a.water + a.detergent)),
    dailyCounts: Array.from(dailyRows.values()).sort((a, b) => a.day.localeCompare(b.day)),
    workshopStats: Array.from(workshopRows.values())
      .map((row) => ({ ...row, water: number1(row.water), detergent: number1(row.detergent) }))
      .sort((a, b) => b.cycles - a.cycles),
    programStats: Array.from(programRows.values())
      .map((row) => ({
        ...row,
        compliance: row.cycles ? number1((row.compliant / row.cycles) * 100) : 0,
        averageDuration: row.cycles ? number1(row.duration / row.cycles) : 0,
        water: number1(row.water),
        detergent: number1(row.detergent)
      }))
      .sort((a, b) => b.cycles - a.cycles),
    solutionStats: Array.from(solutionRows.values())
      .map((row) => {
        const caustic = stats(row.causticValues);
        const acidStats = stats(row.acidValues);
        return {
          solution: row.solution,
          type: row.type,
          unit: row.unit,
          cycles: row.cycles,
          causticAverage: caustic.average,
          causticMin: caustic.min,
          causticMax: caustic.max,
          acidAverage: acidStats.average,
          acidMin: acidStats.min,
          acidMax: acidStats.max,
          missingValues: row.missingValues,
          compliance: row.cycles ? number1((row.compliant / row.cycles) * 100) : 0
        };
      })
      .sort((a, b) => b.cycles - a.cycles),
    workshopSolutionStats: Array.from(workshopSolutionRows.values())
      .map((row) => {
        const caustic = stats(row.causticValues);
        const acidStats = stats(row.acidValues);
        return {
          workshop: row.workshop,
          cycles: row.cycles,
          causticCycles: row.causticCycles,
          acidCycles: row.acidCycles,
          unit: row.unit,
          causticAverage: caustic.average,
          causticMin: caustic.min,
          causticMax: caustic.max,
          acidAverage: acidStats.average,
          acidMin: acidStats.min,
          acidMax: acidStats.max,
          missingValues: row.missingValues,
          compliance: row.cycles ? number1((row.compliant / row.cycles) * 100) : 0
        };
      })
      .sort((a, b) => b.cycles - a.cycles),
    analysisRules: REPORT_ANALYSIS_RULES
  };
}
