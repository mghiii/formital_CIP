"use client";

import { useEffect, useMemo, useState } from "react";
import type { CipCycle } from "@/lib/cip/mock-data";

function secondsBetween(startedAt?: string, endedAt?: string | null, now = Date.now()) {
  if (!startedAt) return 0;
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : now;
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
  return Math.floor((end - start) / 1000);
}

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

type CycleTimerProps = {
  cycle?: CipCycle | null;
};

export function CycleTimer({ cycle }: CycleTimerProps) {
  const [now, setNow] = useState<number | null>(null);
  const cycleStatus = cycle?.status;

  useEffect(() => {
    setNow(Date.now());
    if (cycleStatus !== "En cours") return undefined;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [cycleStatus]);

  const elapsedSeconds = useMemo(() => {
    if (!cycle) return 0;
    if (cycle.status === "Termine" && cycle.duration > 0) return cycle.duration * 60;
    if (now === null) return 0;
    return secondsBetween(cycle.startedAt, cycle.endedAt, now);
  }, [cycle, now]);

  const targetSeconds = Math.max((cycle?.targetDurationMinutes ?? 45) * 60, 60);
  const remainingSeconds = Math.max(targetSeconds - elapsedSeconds, 0);
  const progress = Math.min(100, Math.round((elapsedSeconds / targetSeconds) * 100));
  const isRunning = cycle?.status === "En cours";
  const showLiveValues = cycle ? cycle.status === "Termine" || now !== null : false;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 transition-colors dark:border-[#315941] dark:bg-[#0b1d13]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-formital-green dark:text-[#64d889]">Compteur CIP</p>
          <p className="mt-2 font-mono text-4xl font-bold tracking-normal text-slate-950 dark:text-white">
            {showLiveValues ? formatDuration(elapsedSeconds) : "--:--:--"}
          </p>
        </div>
        <span className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${isRunning ? "bg-green-100 text-formital-green dark:bg-green-500/15 dark:text-[#64d889]" : "bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-white/70"}`}>
          {cycle?.status === "Planifie" ? "Planifie" : isRunning ? "En marche" : cycle ? cycle.status : "Aucun cycle"}
        </span>
      </div>
      <div className="mt-5 h-2 rounded-full bg-white shadow-inner dark:bg-black/25">
        <div className="h-2 rounded-full bg-formital-green transition-all dark:bg-[#64d889]" style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg bg-white p-3 dark:bg-white/5">
          <p className="text-muted">Temps restant</p>
          <p className="mt-1 font-mono font-bold text-slate-950 dark:text-white">{showLiveValues ? formatDuration(remainingSeconds) : "--:--:--"}</p>
        </div>
        <div className="rounded-lg bg-white p-3 dark:bg-white/5">
          <p className="text-muted">Duree cible</p>
          <p className="mt-1 font-mono font-bold text-slate-950 dark:text-white">{cycle ? `${cycle.targetDurationMinutes} min` : "--"}</p>
        </div>
      </div>
    </div>
  );
}
