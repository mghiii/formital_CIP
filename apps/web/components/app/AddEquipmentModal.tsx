"use client";

import { useState } from "react";

type AddEquipmentModalProps = {
  processId: string;
  workshopName: string;
};

export function AddEquipmentModal({ processId, workshopName }: AddEquipmentModalProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center justify-center rounded-lg bg-formital-green px-4 text-sm font-bold text-white transition hover:bg-formital-green-dark"
      >
        Ajouter une machine
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/55 px-0 py-0 backdrop-blur-sm sm:place-items-center sm:px-4 sm:py-6" role="dialog" aria-modal="true" aria-labelledby={`add-equipment-${processId}`}>
          <div className="w-full max-w-lg rounded-t-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-[#244234] dark:bg-[#111f17] sm:rounded-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-formital-green">Atelier</p>
                <h2 id={`add-equipment-${processId}`} className="mt-1 text-2xl font-bold text-slate-950">
                  Ajouter une machine
                </h2>
                <p className="mt-1 text-sm text-muted">{workshopName}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-formital-green hover:text-formital-green dark:border-[#244234] dark:text-slate-300"
                aria-label="Fermer"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                </svg>
              </button>
            </div>

            <form action="/api/cip/equipments" method="post" className="mt-6 grid gap-4">
              <input type="hidden" name="process_id" value={processId} />
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Nom de la machine
                <input
                  name="name"
                  required
                  autoFocus
                  placeholder="Ex: Citerne reception B14"
                  className="min-h-12 rounded-lg border border-slate-200 bg-white px-4 text-base outline-none transition focus:border-formital-green focus:ring-4 focus:ring-formital-green/10"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => setOpen(false)} className="min-h-12 rounded-lg border border-slate-200 px-4 font-bold text-slate-700 transition hover:border-formital-green hover:text-formital-green dark:border-[#244234] dark:text-slate-200">
                  Annuler
                </button>
                <button className="min-h-12 rounded-lg bg-formital-green px-4 font-bold text-white transition hover:bg-formital-green-dark">
                  Ajouter
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
