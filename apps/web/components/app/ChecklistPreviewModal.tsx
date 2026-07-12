"use client";

import { useState } from "react";
import { checklistItems } from "@/lib/cip/mock-data";

export function ChecklistPreviewModal() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <input type="hidden" name="mode" value="draft" />
      <div className="grid gap-2 text-sm font-semibold text-slate-700">
        Etat initial
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-11 items-center justify-between rounded-lg border border-slate-200 px-3 text-left font-bold text-slate-950 outline-none transition hover:border-formital-green hover:text-formital-green dark:border-[#315941] dark:text-white"
        >
          <span>Planifie avec checklist</span>
          <span className="shrink-0 whitespace-nowrap rounded-full bg-formital-green/10 px-3 py-1 text-xs text-formital-green dark:bg-green-500/15 dark:text-[#64d889]">
            Voir
          </span>
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="checklist-preview-title">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-[#315941] dark:bg-[#0d1b13]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-formital-green">Checklist CIP</p>
                <h2 id="checklist-preview-title" className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">
                  Controles avant demarrage
                </h2>
                <p className="mt-1 text-sm text-muted">Ces points devront etre valides par l'operateur avant le lancement du cycle.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-formital-green hover:text-formital-green dark:border-[#315941] dark:text-slate-300"
                aria-label="Fermer"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                </svg>
              </button>
            </div>

            <div className="mt-6 grid gap-3">
              {checklistItems.map((item, index) => (
                <div key={item} className="flex items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-[#315941] dark:bg-[#0b1d13]">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-formital-green text-sm font-bold text-white">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-bold text-slate-950 dark:text-white">{item}</p>
                    <p className="mt-1 text-sm text-muted">Validation obligatoire avant demarrage.</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-6 min-h-11 w-full rounded-lg bg-formital-green px-4 font-bold text-white transition hover:bg-formital-green-dark"
            >
              Fermer la checklist
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
