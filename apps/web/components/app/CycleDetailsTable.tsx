"use client";

import { useState } from "react";
import type { ChecklistState } from "@/lib/cip/data";
import type { CipCycle } from "@/lib/cip/mock-data";

type CycleDetailsTableProps = {
  cycles: CipCycle[];
  checklists?: Record<string, ChecklistState>;
  allowDelete?: boolean;
};

function formatCycleDuration(duration: number) {
  if (duration <= 0) return "< 1 min";
  return `${duration} min`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "Non renseigne";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Non renseigne";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function valueOrDash(value: number | string | undefined | null, suffix = "") {
  if (value === undefined || value === null || value === "") return "-";
  if (typeof value === "number" && value === 0) return "-";
  return `${value}${suffix}`;
}

function StatusBadge({ value }: { value: string }) {
  const tone =
    value === "Conforme" || value === "Termine" || value === "Disponible" || value === "Nettoye" || value === "Resolue" || value === "Actif"
      ? "bg-green-50 text-formital-green dark:bg-green-500/15 dark:text-[#64d889]"
      : value === "Non conforme" || value === "Bloque" || value === "Hors service" || value === "Critique" || value === "Inactif" || value === "Non nettoye"
        ? "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-200"
        : "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200";

  return <span className={`inline-flex shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${tone}`}>{value}</span>;
}

function DetailTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-[#315941] dark:bg-[#0b1d13]">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 text-base font-bold text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}

function checklistItems(checklist?: ChecklistState) {
  return [
    ["Vannes ouvertes et circuit isole", checklist?.valves_open],
    ["Produit detergent disponible", checklist?.cleaning_product_available],
    ["Cuve vide avant nettoyage", checklist?.tank_empty],
    ["Programme CIP selectionne", checklist?.circuit_selected],
    ["Conditions de securite validees", checklist?.safety_conditions_checked]
  ] as const;
}

export function CycleDetailsTable({ cycles, checklists = {}, allowDelete = false }: CycleDetailsTableProps) {
  const [selectedCycle, setSelectedCycle] = useState<CipCycle | null>(null);
  const selectedChecklist = selectedCycle ? checklists[selectedCycle.id] : undefined;
  const columnCount = allowDelete ? 8 : 7;

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="py-3 pr-4">Date/Heure</th>
              <th className="py-3 pr-4">Equipement</th>
              <th className="py-3 pr-4">Programme</th>
              <th className="py-3 pr-4">Duree</th>
              <th className="py-3 pr-4">Statut</th>
              <th className="py-3 pr-4">Resultat</th>
              <th className="py-3 pr-4">Operateur</th>
              {allowDelete ? <th className="py-3 pr-4 text-right">Action</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cycles.length === 0 ? (
              <tr>
                <td colSpan={columnCount} className="py-8 text-center font-semibold text-slate-500">
                  Aucun cycle CIP enregistre dans la base de donnees.
                </td>
              </tr>
            ) : (
              cycles.map((cycle) => (
                <tr
                  key={cycle.id}
                  onClick={() => setSelectedCycle(cycle)}
                  className="cursor-pointer transition hover:bg-formital-green/5 dark:hover:bg-white/5"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedCycle(cycle);
                    }
                  }}
                  aria-label={`Afficher les details du cycle ${cycle.equipment}`}
                >
                  <td className="py-3 pr-4 font-medium">{cycle.date}</td>
                  <td className="py-3 pr-4">{cycle.equipment}</td>
                  <td className="py-3 pr-4">{cycle.process}</td>
                  <td className="py-3 pr-4">{formatCycleDuration(cycle.duration)}</td>
                  <td className="py-3 pr-4"><StatusBadge value={cycle.status} /></td>
                  <td className="py-3 pr-4"><StatusBadge value={cycle.result} /></td>
                  <td className="py-3 pr-4">{cycle.operator}</td>
                  {allowDelete ? (
                    <td className="py-3 pr-4 text-right" onClick={(event) => event.stopPropagation()}>
                      <form
                        action="/api/cip/cycles/delete"
                        method="post"
                        onSubmit={(event) => {
                          if (!window.confirm(`Supprimer le cycle ${cycle.equipment} du ${cycle.date} ? Cette action est definitive.`)) {
                            event.preventDefault();
                          }
                        }}
                      >
                        <input type="hidden" name="cycle_id" value={cycle.id} />
                        <button type="submit" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100 dark:border-red-400/40 dark:bg-red-500/10 dark:text-red-200">
                          Supprimer
                        </button>
                      </form>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedCycle ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="cycle-details-title">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-[#315941] dark:bg-[#0d1b13]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-formital-green">Details cycle CIP</p>
                <h2 id="cycle-details-title" className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">
                  {selectedCycle.equipment}
                </h2>
                <p className="mt-1 text-sm text-muted">{selectedCycle.process} - {selectedCycle.operator}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCycle(null)}
                className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-formital-green hover:text-formital-green dark:border-[#315941] dark:text-slate-300"
                aria-label="Fermer"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                </svg>
              </button>
            </div>
            {allowDelete ? (
              <form
                action="/api/cip/cycles/delete"
                method="post"
                onSubmit={(event) => {
                  if (!window.confirm(`Supprimer le cycle ${selectedCycle.equipment} du ${selectedCycle.date} ? Cette action est definitive.`)) {
                    event.preventDefault();
                  }
                }}
                className="mt-5"
              >
                <input type="hidden" name="cycle_id" value={selectedCycle.id} />
                <button type="submit" className="min-h-10 rounded-lg border border-red-200 bg-red-50 px-4 text-sm font-bold text-red-700 transition hover:bg-red-100 dark:border-red-400/40 dark:bg-red-500/10 dark:text-red-200">
                  Supprimer ce cycle
                </button>
              </form>
            ) : null}

            <div className="mt-6 grid gap-4 md:grid-cols-4">
              <DetailTile label="Statut" value={selectedCycle.status} />
              <DetailTile label="Resultat" value={selectedCycle.result} />
              <DetailTile label="Duree" value={formatCycleDuration(selectedCycle.duration)} />
              <DetailTile label="Aspect visuel" value={selectedCycle.visualAspect ?? "Non renseigne"} />
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <DetailTile label="Temperature" value={valueOrDash(selectedCycle.temperature, " C")} />
              <DetailTile label="Eau consommee" value={valueOrDash(selectedCycle.water, " L")} />
              <DetailTile label="Detergent total" value={valueOrDash(selectedCycle.detergent, " L")} />
              <DetailTile label="Soude" value={valueOrDash(selectedCycle.soda, " L")} />
              <DetailTile label="Acide" value={valueOrDash(selectedCycle.acid, " L")} />
              <DetailTile label="Duree cible" value={`${selectedCycle.targetDurationMinutes} min`} />
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <DetailTile label="Debut" value={formatDateTime(selectedCycle.startedAt)} />
              <DetailTile label="Fin" value={formatDateTime(selectedCycle.endedAt)} />
            </div>

            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-[#315941] dark:bg-[#0b1d13]">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Observation</p>
              <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">{selectedCycle.observation ?? "Aucune observation"}</p>
            </div>

            <div className="mt-5 rounded-lg border border-slate-200 p-4 dark:border-[#315941]">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Checklist pre-demarrage</p>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {checklistItems(selectedChecklist).map(([label, checked]) => (
                  <div key={label} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold dark:bg-white/5">
                    <span>{label}</span>
                    <span className={checked ? "text-formital-green dark:text-[#64d889]" : "text-slate-400"}>
                      {checked ? "Valide" : "Non valide"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
