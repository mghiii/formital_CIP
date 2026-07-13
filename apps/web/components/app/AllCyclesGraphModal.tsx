"use client";

import { useMemo, useState } from "react";
import type { CipCycle, Equipment } from "@/lib/cip/mock-data";

type AllCyclesGraphModalProps = {
  cycles: CipCycle[];
  equipments?: Equipment[];
};

type DailyCycleRow = {
  key: string;
  label: string;
  total: number;
  completed: number;
  inProgress: number;
  planned: number;
  blocked: number;
};

function parseCycleDate(cycle: CipCycle) {
  if (cycle.startedAt) {
    const isoDate = new Date(cycle.startedAt);
    if (!Number.isNaN(isoDate.getTime())) return isoDate;
  }

  const match = cycle.date.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (!match) return null;

  const [, day, month, year, hour = "0", minute = "0"] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function displayDate(key: string) {
  const [, month, day] = key.split("-");
  return `${day}/${month}`;
}

function inputDate(value: string, endOfDay = false) {
  if (!value) return null;
  const date = new Date(`${value}T${endOfDay ? "23:59:59" : "00:00:00"}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function buildDailyRows(cycles: CipCycle[], startValue: string, endValue: string): DailyCycleRow[] {
  const parsedCycles = buildFilteredCycles(cycles, startValue, endValue);

  if (parsedCycles.length === 0) return [];

  const start = inputDate(startValue);
  const end = inputDate(endValue, true);
  const first = start ?? parsedCycles[0].date;
  const last = end ?? parsedCycles[parsedCycles.length - 1].date;
  const rows = new Map<string, DailyCycleRow>();

  for (let day = new Date(first); day <= last; day = addDays(day, 1)) {
    const key = dateKey(day);
    rows.set(key, {
      key,
      label: displayDate(key),
      total: 0,
      completed: 0,
      inProgress: 0,
      planned: 0,
      blocked: 0
    });
  }

  for (const { cycle, date } of parsedCycles) {
    const key = dateKey(date);
    const row = rows.get(key);
    if (!row) continue;

    row.total += 1;
    if (cycle.status === "Termine") row.completed += 1;
    if (cycle.status === "En cours") row.inProgress += 1;
    if (cycle.status === "Planifie") row.planned += 1;
    if (cycle.status === "Bloque") row.blocked += 1;
  }

  return Array.from(rows.values());
}

function buildFilteredCycles(cycles: CipCycle[], startValue: string, endValue: string) {
  const start = inputDate(startValue);
  const end = inputDate(endValue, true);

  return cycles
    .map((cycle) => ({ cycle, date: parseCycleDate(cycle) }))
    .filter((row): row is { cycle: CipCycle; date: Date } => Boolean(row.date))
    .filter((row) => (!start || row.date >= start) && (!end || row.date <= end))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

function StatusLegend() {
  const rows = [
    ["Termines", "bg-formital-green"],
    ["En cours", "bg-sky-500"],
    ["Planifies", "bg-amber-500"],
    ["Bloques", "bg-red-500"]
  ] as const;

  return (
    <div className="flex flex-wrap gap-3 text-xs font-bold text-slate-600 dark:text-slate-300">
      {rows.map(([label, color]) => (
        <span key={label} className="inline-flex items-center gap-2">
          <span className={`h-3 w-3 rounded-full ${color}`} />
          {label}
        </span>
      ))}
    </div>
  );
}

function cycleColor(cycle: CipCycle) {
  if (cycle.status === "Bloque") return "#ef4444";
  if (cycle.status === "Planifie") return "#f59e0b";
  if (cycle.status === "En cours") return "#0ea5e9";
  if (cycle.result === "Non conforme") return "#ef4444";
  return "#1f7a3a";
}

function formatCycleTime(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatCycleDuration(duration: number) {
  if (duration <= 0) return "< 1 min";
  return `${duration} min`;
}

function buildEquipmentMap(equipments: Equipment[]) {
  return new Map(equipments.map((equipment) => [equipment.name, equipment]));
}

function cycleWorkshop(cycle: CipCycle, equipmentMap: Map<string, Equipment>) {
  const equipment = equipmentMap.get(cycle.equipment);
  return equipment?.line || cycle.process || "Atelier non renseigne";
}

function cycleTooltip(cycle: CipCycle, date: Date, equipmentMap: Map<string, Equipment>) {
  const workshop = cycleWorkshop(cycle, equipmentMap);

  return [
    `Machine: ${cycle.equipment}`,
    `Atelier: ${workshop}`,
    `Programme: ${cycle.process}`,
    `Date: ${formatCycleTime(date)}`,
    `Duree: ${formatCycleDuration(cycle.duration)}`,
    `Statut: ${cycle.status}`,
    `Resultat: ${cycle.result}`,
    `Operateur: ${cycle.operator}`
  ].join("\n");
}

type GraphTooltip = {
  id: string;
  x: number;
  y: number;
  color: string;
  machine: string;
  workshop: string;
  program: string;
  date: string;
  duration: string;
  status: string;
  result: string;
  operator: string;
};

function CyclesGraph({
  cycles,
  equipmentMap
}: {
  cycles: Array<{ cycle: CipCycle; date: Date }>;
  equipmentMap: Map<string, Equipment>;
}) {
  const [tooltip, setTooltip] = useState<GraphTooltip | null>(null);

  if (cycles.length === 0) {
    return (
      <div className="grid h-80 place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm font-semibold text-slate-500 dark:border-[#315941] dark:bg-[#07170f]">
        Aucun cycle trouve pour cette periode.
      </div>
    );
  }

  const max = Math.max(...cycles.map(({ cycle }) => (cycle.duration > 0 ? cycle.duration : 1)), 1);
  const width = Math.max(1080, cycles.length * 128);
  const height = 420;
  const top = 32;
  const bottom = 330;
  const left = 68;
  const chartRight = width - 28;
  const chartWidth = chartRight - left;
  const slotWidth = chartWidth / cycles.length;
  const barWidth = Math.min(42, slotWidth * 0.56);
  const tooltipWidth = 268;

  return (
    <div className="responsive-table-shell rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-[#315941] dark:bg-[#07170f]">
      <div className="relative" style={{ width, height }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Graphe de tous les cycles CIP">
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = bottom - ratio * (bottom - top);
          return (
            <g key={ratio}>
              <line x1={left} x2={chartRight} y1={y} y2={y} stroke="#dfe6e3" strokeWidth="1" />
              <text x={left - 12} y={y + 5} textAnchor="end" className="fill-slate-500 text-xs font-bold">
                {Math.round(max * ratio)} min
              </text>
            </g>
          );
        })}
        {cycles.map(({ cycle, date }, index) => {
          const x = left + index * slotWidth + slotWidth / 2;
          const chartValue = cycle.duration > 0 ? cycle.duration : 1;
          const barHeight = Math.max(16, (chartValue / max) * (bottom - top));
          const y = bottom - barHeight;
          const shortName = cycle.equipment.length > 12 ? `${cycle.equipment.slice(0, 11)}...` : cycle.equipment;
          const tooltip = cycleTooltip(cycle, date, equipmentMap);
          const tooltipData = {
            id: cycle.id,
            x: Math.min(Math.max(8, x - tooltipWidth / 2), width - tooltipWidth - 8),
            y: Math.max(10, y - 132),
            color: cycleColor(cycle),
            machine: cycle.equipment,
            workshop: cycleWorkshop(cycle, equipmentMap),
            program: cycle.process,
            date: formatCycleTime(date),
            duration: formatCycleDuration(cycle.duration),
            status: cycle.status,
            result: cycle.result,
            operator: cycle.operator
          };

          return (
            <g
              key={cycle.id}
              className="cursor-help"
              tabIndex={0}
              onMouseEnter={() => setTooltip(tooltipData)}
              onMouseLeave={() => setTooltip(null)}
              onFocus={() => setTooltip(tooltipData)}
              onBlur={() => setTooltip(null)}
              aria-label={`${cycle.equipment}, ${tooltipData.workshop}, ${tooltipData.duration}`}
            >
              <title>{tooltip}</title>
              <rect x={x - slotWidth / 2} y={top} width={slotWidth} height={height - top} fill="transparent" style={{ pointerEvents: "all" }} />
              <rect x={x - barWidth / 2} y={y} width={barWidth} height={barHeight} rx="8" fill={cycleColor(cycle)} />
              <text x={x} y={Math.max(18, y - 8)} textAnchor="middle" className="fill-slate-950 text-xs font-bold dark:fill-white">
                {cycle.duration > 0 ? `${cycle.duration}m` : "<1m"}
              </text>
              <text x={x} y={bottom + 24} textAnchor="middle" className="fill-slate-500 text-xs font-bold">
                {formatCycleTime(date)}
              </text>
              <text x={x} y={bottom + 24} textAnchor="middle" className="fill-slate-500 text-xs font-bold">
                <tspan x={x} dy="18">{shortName}</tspan>
                <title>{tooltip}</title>
              </text>
            </g>
          );
        })}
      </svg>
      {tooltip ? (
        <div
          className="pointer-events-none absolute z-20 w-[268px] rounded-xl border border-formital-green/30 bg-white p-4 text-left shadow-2xl shadow-slate-950/15 dark:border-[#4d8b63] dark:bg-[#07170f]"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="flex items-start gap-3">
            <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: tooltip.color }} />
            <div className="min-w-0">
              <p className="truncate text-base font-black text-slate-950 dark:text-white">{tooltip.machine}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wide text-formital-green">{tooltip.workshop}</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-white/5">
              <span className="block text-muted">Programme</span>
              <b className="mt-1 block truncate text-slate-950 dark:text-white">{tooltip.program}</b>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-white/5">
              <span className="block text-muted">Duree</span>
              <b className="mt-1 block text-slate-950 dark:text-white">{tooltip.duration}</b>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-white/5">
              <span className="block text-muted">Statut</span>
              <b className="mt-1 block text-slate-950 dark:text-white">{tooltip.status}</b>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-white/5">
              <span className="block text-muted">Resultat</span>
              <b className="mt-1 block text-slate-950 dark:text-white">{tooltip.result}</b>
            </div>
          </div>
          <div className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-xs dark:bg-green-500/10">
            <span className="font-semibold text-muted">{tooltip.date}</span>
            <span className="mx-2 text-slate-300">|</span>
            <span className="font-bold text-formital-green">{tooltip.operator}</span>
          </div>
        </div>
      ) : null}
      </div>
    </div>
  );
}

function CyclesDetailsList({ cycles }: { cycles: Array<{ cycle: CipCycle; date: Date }> }) {
  if (cycles.length === 0) return null;

  return (
    <div className="mt-6 rounded-lg border border-slate-200 dark:border-[#315941]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-[#315941]">
        <h3 className="font-bold text-slate-950 dark:text-white">Tous les cycles affiches</h3>
        <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-formital-green dark:bg-green-500/10">
          {cycles.length} cycles
        </span>
      </div>
      <div className="responsive-table-shell max-h-80">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="sticky top-0 border-b border-slate-200 bg-white text-xs uppercase tracking-wide text-slate-500 dark:border-[#315941] dark:bg-[#0d1b13]">
            <tr>
              <th className="px-4 py-3">Date/heure</th>
              <th className="px-4 py-3">Equipement</th>
              <th className="px-4 py-3">Programme</th>
              <th className="px-4 py-3">Duree</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Resultat</th>
              <th className="px-4 py-3">Operateur</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#315941]">
            {cycles.map(({ cycle, date }) => (
              <tr key={cycle.id}>
                <td className="px-4 py-3 font-semibold">{formatCycleTime(date)}</td>
                <td className="px-4 py-3 font-semibold">{cycle.equipment}</td>
                <td className="px-4 py-3">{cycle.process}</td>
                <td className="px-4 py-3">{formatCycleDuration(cycle.duration)}</td>
                <td className="px-4 py-3">{cycle.status}</td>
                <td className="px-4 py-3">{cycle.result}</td>
                <td className="px-4 py-3">{cycle.operator}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AllCyclesGraphModal({ cycles, equipments = [] }: AllCyclesGraphModalProps) {
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const rows = useMemo(() => buildDailyRows(cycles, startDate, endDate), [cycles, startDate, endDate]);
  const filteredCycles = useMemo(() => buildFilteredCycles(cycles, startDate, endDate), [cycles, startDate, endDate]);
  const equipmentMap = useMemo(() => buildEquipmentMap(equipments), [equipments]);
  const total = filteredCycles.length;
  const completed = filteredCycles.filter(({ cycle }) => cycle.status === "Termine").length;
  const active = filteredCycles.filter(({ cycle }) => cycle.status === "En cours" || cycle.status === "Planifie").length;
  const blocked = filteredCycles.filter(({ cycle }) => cycle.status === "Bloque").length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-formital-green px-4 py-3 text-sm font-bold text-white transition hover:bg-formital-green-dark"
      >
        Voir graphe complet
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/60 px-0 py-0 backdrop-blur-sm sm:place-items-center sm:px-4 sm:py-6" role="dialog" aria-modal="true" aria-labelledby="all-cycles-graph-title">
          <div className="relative max-h-[92dvh] w-full max-w-7xl overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-5 pt-16 shadow-2xl dark:border-[#315941] dark:bg-[#0d1b13] sm:rounded-2xl sm:p-6 sm:pr-20">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 grid h-12 w-12 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-formital-green hover:text-formital-green dark:border-[#315941] dark:bg-[#102218] dark:text-slate-300"
              aria-label="Fermer"
            >
              X
            </button>
            <div>
              <div className="max-w-3xl">
                <p className="text-xs font-bold uppercase tracking-wide text-formital-green">Cycles CIP</p>
                <h2 id="all-cycles-graph-title" className="mt-1 text-2xl font-bold leading-tight text-slate-950 dark:text-white sm:text-3xl">
                  Graphe complet des cycles
                </h2>
                <p className="mt-2 text-sm text-muted">Par defaut, toutes les donnees disponibles sont affichees.</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
              <label className="grid gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                Date debut
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="min-h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-formital-green dark:border-[#315941]"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                Date fin
                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="min-h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-formital-green dark:border-[#315941]"
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
                className="min-h-11 rounded-lg border border-slate-200 px-4 text-sm font-bold text-formital-green transition hover:border-formital-green hover:bg-formital-green/10 dark:border-[#315941]"
              >
                Tout afficher
              </button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Total", `${total} cycles`, "bg-green-50 dark:bg-green-500/10"],
                ["Termines", `${completed} cycles`, "bg-slate-50 dark:bg-white/5"],
                ["En cours / planifies", `${active} cycles`, "bg-sky-50 dark:bg-sky-500/10"],
                ["Bloques", `${blocked} cycles`, "bg-red-50 dark:bg-red-500/10"]
              ].map(([label, value, tone]) => (
                <div key={label} className={`rounded-lg px-4 py-3 ${tone}`}>
                  <p className="text-sm text-muted">{label}</p>
                  <p className="mt-1 text-xl font-bold text-slate-950 dark:text-white">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <div className="mb-4 flex items-center justify-between gap-4">
                <StatusLegend />
                <span className="text-xs font-bold text-muted">{total} cycle{total > 1 ? "s" : ""} sur {rows.length} jour{rows.length > 1 ? "s" : ""}</span>
              </div>
              <CyclesGraph cycles={filteredCycles} equipmentMap={equipmentMap} />
              <CyclesDetailsList cycles={filteredCycles} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
