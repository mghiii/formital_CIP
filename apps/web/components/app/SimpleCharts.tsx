type BarsProps = {
  values: number[];
  altValues?: number[];
};

export function MiniLineChart({ values }: { values: number[] }) {
  if (values.length === 0) {
    return <EmptyChart label="Aucun cycle sur la periode" />;
  }

  const max = Math.max(...values, 1);
  const points = values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * 100;
    const y = 100 - (value / max) * 86 - 7;
    return `${x},${y}`;
  });

  return (
    <svg viewBox="0 0 100 100" className="h-64 w-full" role="img" aria-label="Cycles par jour">
      {[20, 40, 60, 80].map((y) => (
        <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="#e5e7eb" strokeWidth="0.5" />
      ))}
      <polyline points={points.join(" ")} fill="none" stroke="#1f7a3a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((point) => {
        const [x, y] = point.split(",");
        return <circle key={point} cx={x} cy={y} r="2" fill="#1f7a3a" />;
      })}
    </svg>
  );
}

export function ComplianceDonut({ value }: { value: number }) {
  const offset = 100 - value;

  return (
    <div className="relative grid h-56 place-items-center">
      <svg viewBox="0 0 42 42" className="h-48 w-48 rotate-[-90deg]" role="img" aria-label="Conformite cycles">
        <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#eef2f7" strokeWidth="6" />
        <circle
          cx="21"
          cy="21"
          r="15.915"
          fill="transparent"
          stroke="#1f7a3a"
          strokeWidth="6"
          strokeDasharray={`${value} ${offset}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-4xl font-bold text-slate-950">{value}%</p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted">Conforme</p>
      </div>
    </div>
  );
}

export function ConsumptionBars({ values, altValues }: BarsProps) {
  if (values.length === 0 && (!altValues || altValues.length === 0)) {
    return <EmptyChart label="Aucune consommation enregistree" />;
  }

  const max = Math.max(...values, ...(altValues ?? []), 1);

  return (
    <div className="flex h-64 items-end gap-3">
      {values.map((value, index) => (
        <div key={`${value}-${index}`} className="flex flex-1 items-end justify-center gap-1">
          <span className="w-full rounded-t bg-sky-500" style={{ height: `${(value / max) * 100}%` }} />
          {altValues ? <span className="w-full rounded-t bg-formital-green" style={{ height: `${((altValues[index] ?? 0) / max) * 100}%` }} /> : null}
        </div>
      ))}
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="grid h-64 place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm font-semibold text-slate-500">
      {label}
    </div>
  );
}
