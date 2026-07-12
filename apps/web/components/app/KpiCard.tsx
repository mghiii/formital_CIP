type KpiCardProps = {
  label: string;
  value: string;
  trend: string;
  tone?: "green" | "blue" | "red" | "amber";
};

const toneClass = {
  green: "bg-formital-green/10 text-formital-green",
  blue: "bg-sky-100 text-sky-700",
  red: "bg-red-100 text-red-700",
  amber: "bg-amber-100 text-amber-700"
};

export function KpiCard({ label, value, trend, tone = "green" }: KpiCardProps) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{value}</p>
          <p className="mt-2 text-xs text-slate-500">vs periode precedente</p>
        </div>
        <span className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${toneClass[tone]}`}>{trend}</span>
      </div>
    </article>
  );
}
