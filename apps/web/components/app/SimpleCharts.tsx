type BarsProps = {
  values: number[];
  altValues?: number[];
};

export function MiniLineChart({ values }: { values: number[] }) {
  if (values.length === 0) {
    return <EmptyChart label="Aucun cycle sur la periode" />;
  }

  const max = Math.max(...values, 1);
  const chartTop = 34;
  const chartBottom = 292;
  const chartLeft = 64;
  const chartRight = 954;
  const chartWidth = chartRight - chartLeft;
  const points = values.map((value, index) => {
    const x = chartLeft + (index / Math.max(values.length - 1, 1)) * chartWidth;
    const y = chartBottom - (value / max) * (chartBottom - chartTop);
    return { x, y, value, label: index === values.length - 1 ? "J" : `J-${values.length - index - 1}` };
  });
  const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${chartLeft},${chartBottom} ${polyline} ${chartLeft + chartWidth},${chartBottom}`;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <svg viewBox="0 0 1000 360" className="min-h-[20rem] w-full flex-1 overflow-visible" role="img" aria-label="Cycles par jour">
        <defs>
          <linearGradient id="cycle-line-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#1f7a3a" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#1f7a3a" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = chartBottom - ratio * (chartBottom - chartTop);
          const label = Math.round(max * ratio);
          return (
            <g key={ratio}>
              <line x1={chartLeft} x2={chartRight} y1={y} y2={y} stroke="#dfe6e3" strokeWidth="2.5" />
              <text x={chartLeft - 18} y={y + 8} textAnchor="end" className="fill-slate-500 text-[22px] font-bold">
                {label}
              </text>
            </g>
          );
        })}
        <polygon points={area} fill="url(#cycle-line-fill)" />
        <polyline points={polyline} fill="none" stroke="#1f7a3a" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point) => (
          <g key={`${point.label}-${point.x}`}>
            <line x1={point.x} x2={point.x} y1={chartBottom} y2={chartBottom + 15} stroke="#94a3b8" strokeWidth="2" />
            <circle cx={point.x} cy={point.y} r="11" fill="#1f7a3a" stroke="#ffffff" strokeWidth="5" />
            {point.value > 0 ? (
              <text x={point.x} y={Math.max(22, point.y - 18)} textAnchor="middle" className="fill-formital-green text-[22px] font-bold">
                {point.value}
              </text>
            ) : null}
            <text x={point.x} y={chartBottom + 42} textAnchor="middle" className="fill-slate-500 text-[22px] font-bold">
              {point.label}
            </text>
          </g>
        ))}
      </svg>
      <div className="grid gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-lg bg-green-50 px-4 py-3 dark:bg-green-500/10">
          <span className="text-muted">Total</span>
          <b className="mt-1 block text-slate-950">{values.reduce((sum, value) => sum + value, 0)} cycles</b>
        </div>
        <div className="rounded-lg bg-slate-50 px-4 py-3 dark:bg-white/5">
          <span className="text-muted">Pic jour</span>
          <b className="mt-1 block text-slate-950">{max} cycles</b>
        </div>
        <div className="rounded-lg bg-slate-50 px-4 py-3 dark:bg-white/5">
          <span className="text-muted">Moyenne</span>
          <b className="mt-1 block text-slate-950">{Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10} / jour</b>
        </div>
      </div>
    </div>
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
  const length = Math.max(values.length, altValues?.length ?? 0);
  const rows = Array.from({ length }, (_, index) => ({
    label: `J-${length - index - 1}`,
    water: values[index] ?? 0,
    detergent: altValues?.[index] ?? 0
  }));
  const totalWater = Math.round(rows.reduce((sum, row) => sum + row.water, 0) * 10) / 10;
  const totalDetergent = Math.round(rows.reduce((sum, row) => sum + row.detergent, 0) * 10) / 10;
  const max = Math.max(...rows.flatMap((row) => [row.water, row.detergent]), 0);

  if (rows.length === 0) {
    return <EmptyChart label="Aucune consommation enregistree" />;
  }

  if (max <= 0) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-4">
        <EmptyChart label="Aucune valeur eau ou detergent n'est encore renseignee pour cette periode." />
        <ConsumptionLegend water={totalWater} detergent={totalDetergent} />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="relative min-h-[20rem] flex-1 rounded-lg border border-slate-200 bg-slate-50 px-4 pb-10 pt-5 dark:border-[#315941] dark:bg-[#07170f]">
        <div className="absolute inset-x-4 top-5 h-[calc(100%-4.5rem)]">
          {[0, 1, 2, 3].map((line) => (
            <div key={line} className="absolute left-0 right-0 border-t border-slate-200 dark:border-[#315941]" style={{ bottom: `${line * 33.33}%` }} />
          ))}
        </div>
        <div className="relative z-10 flex h-full items-end gap-2">
          {rows.map((row, index) => {
            const waterHeight = row.water > 0 ? Math.max(8, (row.water / max) * 100) : 0;
            const detergentHeight = row.detergent > 0 ? Math.max(8, (row.detergent / max) * 100) : 0;

            return (
              <div key={`${row.label}-${index}`} className="flex h-full flex-1 flex-col justify-end gap-2">
                <div className="flex h-full items-end justify-center gap-1">
                  <span
                    className="w-full rounded-t bg-sky-500 shadow-sm"
                    title={`Eau: ${row.water} m3`}
                    style={{ height: `${waterHeight}%` }}
                  />
                  <span
                    className="w-full rounded-t bg-formital-green shadow-sm"
                    title={`Detergent: ${row.detergent} L`}
                    style={{ height: `${detergentHeight}%` }}
                  />
                </div>
                <span className="text-center text-[10px] font-bold text-slate-500 dark:text-slate-300">
                  {index === rows.length - 1 ? "J" : row.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <ConsumptionLegend water={totalWater} detergent={totalDetergent} />
    </div>
  );
}

function ConsumptionLegend({ water, detergent }: { water: number; detergent: number }) {
  return (
    <div className="grid gap-3 text-sm sm:grid-cols-2">
      <div className="flex items-center justify-between rounded-lg bg-sky-50 px-4 py-3 dark:bg-sky-500/10">
        <span className="font-bold text-sky-600">Eau</span>
        <span className="font-bold text-slate-950">{water} m3</span>
      </div>
      <div className="flex items-center justify-between rounded-lg bg-green-50 px-4 py-3 dark:bg-green-500/10">
        <span className="font-bold text-formital-green">Detergent</span>
        <span className="font-bold text-slate-950">{detergent} L</span>
      </div>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="grid min-h-64 flex-1 place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm font-semibold text-slate-500">
      {label}
    </div>
  );
}
