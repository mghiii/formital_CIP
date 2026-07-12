import { NextResponse, type NextRequest } from "next/server";
import { getCipDashboardData } from "@/lib/cip/data";
import type { CipCycle } from "@/lib/cip/mock-data";

type ExportOptions = {
  format: string;
  reportType: string;
  startDate: string;
  endDate: string;
  equipment: string;
  status: string;
  result: string;
  includeCycles: boolean;
  includeParameters: boolean;
  includeAlerts: boolean;
  includeWorkshops: boolean;
};

function boolParam(params: URLSearchParams, name: string, hasExplicitIncludes: boolean) {
  return hasExplicitIncludes ? params.get(name) === "on" : true;
}

function exportOptions(request: NextRequest): ExportOptions {
  const params = request.nextUrl.searchParams;
  const includeFields = ["include_cycles", "include_parameters", "include_alerts", "include_workshops"];
  const hasExplicitIncludes = includeFields.some((name) => params.has(name));

  return {
    format: params.get("format") ?? "pdf",
    reportType: params.get("report_type") ?? "complete",
    startDate: params.get("start_date") ?? "",
    endDate: params.get("end_date") ?? "",
    equipment: params.get("equipment") ?? "all",
    status: params.get("status") ?? "completed",
    result: params.get("result") ?? "all",
    includeCycles: boolParam(params, "include_cycles", hasExplicitIncludes),
    includeParameters: boolParam(params, "include_parameters", hasExplicitIncludes),
    includeAlerts: boolParam(params, "include_alerts", hasExplicitIncludes),
    includeWorkshops: boolParam(params, "include_workshops", hasExplicitIncludes)
  };
}

function dateBoundary(value: string, endOfDay = false) {
  if (!value) return null;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function cycleDate(cycle: CipCycle) {
  const date = cycle.startedAt ? new Date(cycle.startedAt) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function filterCycles(cycles: CipCycle[], options: ExportOptions) {
  const start = dateBoundary(options.startDate);
  const end = dateBoundary(options.endDate, true);

  return cycles.filter((cycle) => {
    const started = cycleDate(cycle);
    if (start && started && started < start) return false;
    if (end && started && started > end) return false;
    if (options.equipment !== "all" && cycle.equipment !== options.equipment) return false;
    if (options.status === "completed" && cycle.status !== "Termine") return false;
    if (options.status === "active" && !["En cours", "Planifie"].includes(cycle.status)) return false;
    if (options.result === "compliant" && cycle.result !== "Conforme") return false;
    if (options.result === "non_compliant" && cycle.result !== "Non conforme") return false;
    if (options.result === "pending" && cycle.result !== "En attente") return false;
    return true;
  });
}

function reportTypeLabel(value: string) {
  const labels: Record<string, string> = {
    complete: "Rapport complet",
    quality: "Qualite et conformite",
    consumption: "Consommation eau et produits",
    alerts: "Non conformites et alertes"
  };

  return labels[value] ?? labels.complete;
}

function periodLabel(options: ExportOptions) {
  if (options.startDate && options.endDate) return `${options.startDate} au ${options.endDate}`;
  if (options.startDate) return `Depuis ${options.startDate}`;
  if (options.endDate) return `Jusqu'au ${options.endDate}`;
  return "Toutes les dates";
}

function cycleMetrics(cycles: CipCycle[]) {
  const completed = cycles.filter((cycle) => cycle.status === "Termine");
  const compliant = completed.filter((cycle) => cycle.result === "Conforme").length;
  const nonCompliant = completed.filter((cycle) => cycle.result === "Non conforme").length;
  const water = completed.reduce((sum, cycle) => sum + cycle.water, 0);
  const detergent = completed.reduce((sum, cycle) => sum + cycle.detergent, 0);

  return {
    total: cycles.length,
    completed: completed.length,
    active: cycles.filter((cycle) => ["En cours", "Planifie"].includes(cycle.status)).length,
    compliant,
    nonCompliant,
    compliance: completed.length ? Math.round((compliant / completed.length) * 1000) / 10 : 0,
    waterM3: Math.round((water / 1000) * 10) / 10,
    detergent: Math.round(detergent * 10) / 10
  };
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function htmlCell(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function pdfText(value: unknown) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)")
    .replace(/[^\x20-\x7E]/g, "");
}

function equipmentConsumption(cycles: CipCycle[]) {
  const rows = new Map<string, { water: number; detergent: number; cycles: number }>();

  for (const cycle of cycles) {
    const current = rows.get(cycle.equipment) ?? { water: 0, detergent: 0, cycles: 0 };
    current.water += cycle.water;
    current.detergent += cycle.detergent;
    current.cycles += 1;
    rows.set(cycle.equipment, current);
  }

  return Array.from(rows.entries())
    .map(([equipment, values]) => ({ equipment, ...values }))
    .sort((a, b) => b.water + b.detergent - (a.water + a.detergent))
    .slice(0, 6);
}

function dailyCounts(cycles: CipCycle[]) {
  const rows = new Map<string, number>();
  for (const cycle of cycles) {
    const day = cycle.startedAt ? cycle.startedAt.slice(0, 10) : cycle.date.slice(0, 10);
    rows.set(day, (rows.get(day) ?? 0) + 1);
  }

  return Array.from(rows.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([day, count]) => ({ day: day.slice(5), count }));
}

function pct(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function buildExcelReportHtml(data: Awaited<ReturnType<typeof getCipDashboardData>>, options: ExportOptions, cycles: CipCycle[]) {
  const metrics = cycleMetrics(cycles);
  const consumption = equipmentConsumption(cycles);
  const daily = dailyCounts(cycles);
  const maxWater = Math.max(...consumption.map((row) => row.water), 1);
  const maxDaily = Math.max(...daily.map((row) => row.count), 1);
  const cyclesRows = cycles
    .map((cycle) => {
      const workshop = data.equipments.find((equipment) => equipment.name === cycle.equipment)?.line ?? "";
      return `
        <tr>
          <td>${htmlCell(cycle.date)}</td>
          <td>${htmlCell(cycle.equipment)}</td>
          <td>${htmlCell(workshop)}</td>
          <td>${htmlCell(cycle.process)}</td>
          <td>${htmlCell(cycle.duration)} min</td>
          <td>${htmlCell(cycle.status)}</td>
          <td>${htmlCell(cycle.result)}</td>
          <td>${htmlCell(cycle.operator)}</td>
          <td>${htmlCell(cycle.temperature)}</td>
          <td>${htmlCell(cycle.water)}</td>
          <td>${htmlCell(cycle.detergent)}</td>
          <td>${htmlCell(cycle.soda)}</td>
          <td>${htmlCell(cycle.acid)}</td>
          <td>${htmlCell(cycle.visualAspect ?? "")}</td>
          <td>${htmlCell(cycle.observation ?? "")}</td>
        </tr>`;
    })
    .join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Arial, sans-serif; color: #102016; }
    .header { background: #1f7a3a; color: white; padding: 22px; }
    .subtitle { color: #d9f5df; font-size: 12px; }
    .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 18px 0; }
    .card { border: 1px solid #d6e6dc; padding: 14px; background: #f7fbf8; }
    .label { color: #607466; font-size: 12px; font-weight: bold; }
    .value { font-size: 28px; font-weight: bold; color: #102016; }
    .section { margin-top: 22px; }
    h2 { color: #1f7a3a; font-size: 18px; }
    table { border-collapse: collapse; width: 100%; margin-top: 10px; }
    th { background: #1f7a3a; color: white; text-align: left; padding: 8px; }
    td { border: 1px solid #dce8df; padding: 8px; }
    .bar-bg { background: #e8f2eb; height: 14px; width: 220px; }
    .bar-green { background: #1f7a3a; height: 14px; }
    .bar-red { background: #ef4444; height: 14px; }
    .bar-blue { background: #0ea5e9; height: 14px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Digital CIP - ${htmlCell(reportTypeLabel(options.reportType))}</h1>
    <div class="subtitle">Periode: ${htmlCell(periodLabel(options))} | Equipement: ${htmlCell(options.equipment === "all" ? "Tous les equipements" : options.equipment)}</div>
  </div>
  <div class="cards">
    <div class="card"><div class="label">Cycles filtres</div><div class="value">${metrics.total}</div></div>
    <div class="card"><div class="label">Conformite</div><div class="value">${metrics.compliance}%</div></div>
    <div class="card"><div class="label">Eau</div><div class="value">${metrics.waterM3} m3</div></div>
    <div class="card"><div class="label">Detergent</div><div class="value">${metrics.detergent} L</div></div>
  </div>
  <div class="section">
    <h2>Conformite des cycles termines</h2>
    <table>
      <tr><th>Resultat</th><th>Nombre</th><th>Graphique</th></tr>
      <tr><td>Conformes</td><td>${metrics.compliant}</td><td><div class="bar-bg"><div class="bar-green" style="width:${pct(metrics.compliant, metrics.completed)}%"></div></div></td></tr>
      <tr><td>Non conformes</td><td>${metrics.nonCompliant}</td><td><div class="bar-bg"><div class="bar-red" style="width:${pct(metrics.nonCompliant, metrics.completed)}%"></div></div></td></tr>
    </table>
  </div>
  <div class="section">
    <h2>Cycles par jour</h2>
    <table>
      <tr><th>Jour</th><th>Cycles</th><th>Graphique</th></tr>
      ${daily.map((row) => `<tr><td>${htmlCell(row.day)}</td><td>${row.count}</td><td><div class="bar-bg"><div class="bar-green" style="width:${pct(row.count, maxDaily)}%"></div></div></td></tr>`).join("")}
    </table>
  </div>
  <div class="section">
    <h2>Consommation par equipement</h2>
    <table>
      <tr><th>Equipement</th><th>Eau L</th><th>Detergent L</th><th>Graphique eau</th></tr>
      ${consumption.map((row) => `<tr><td>${htmlCell(row.equipment)}</td><td>${Math.round(row.water * 10) / 10}</td><td>${Math.round(row.detergent * 10) / 10}</td><td><div class="bar-bg"><div class="bar-blue" style="width:${pct(row.water, maxWater)}%"></div></div></td></tr>`).join("")}
    </table>
  </div>
  <div class="section">
    <h2>Cycles CIP</h2>
    <table>
      <tr><th>Date</th><th>Equipement</th><th>Atelier</th><th>Programme</th><th>Duree</th><th>Statut</th><th>Resultat</th><th>Operateur</th><th>Temp C</th><th>Eau L</th><th>Det. L</th><th>Soude L</th><th>Acide L</th><th>Aspect</th><th>Observation</th></tr>
      ${cyclesRows || '<tr><td colspan="15">Aucun cycle dans cette selection.</td></tr>'}
    </table>
  </div>
</body>
</html>`;
}

function buildPdfDocument(content: string) {

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 6 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"
  ];

  let body = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n`;
  body += "0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) {
    body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return body;
}

function rgb(hex: string) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)}`;
}

function pdfTextAt(text: string, x: number, y: number, size = 10, bold = false, color = "#102016") {
  return `BT ${rgb(color)} rg /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y} Td (${pdfText(text)}) Tj ET`;
}

function pdfRect(x: number, y: number, width: number, height: number, color: string) {
  return `${rgb(color)} rg ${x} ${y} ${width} ${height} re f`;
}

function pdfLine(x1: number, y1: number, x2: number, y2: number, color = "#d8e7de") {
  return `${rgb(color)} RG 0.8 w ${x1} ${y1} m ${x2} ${y2} l S`;
}

function pdfBar(label: string, value: number, total: number, x: number, y: number, width: number, color: string) {
  const barWidth = Math.max(2, Math.min(width, (value / Math.max(total, 1)) * width));
  return [
    pdfTextAt(label, x, y + 4, 8, true, "#33463a"),
    pdfRect(x + 130, y, width, 10, "#e8f2eb"),
    pdfRect(x + 130, y, barWidth, 10, color),
    pdfTextAt(String(Math.round(value * 10) / 10), x + 135 + width, y + 2, 8, true, "#102016")
  ].join("\n");
}

function buildPdf(data: Awaited<ReturnType<typeof getCipDashboardData>>, options: ExportOptions, cycles: CipCycle[]) {
  const metrics = cycleMetrics(cycles);
  const consumption = equipmentConsumption(cycles);
  const daily = dailyCounts(cycles);
  const maxWater = Math.max(...consumption.map((row) => row.water), 1);
  const maxDaily = Math.max(...daily.map((row) => row.count), 1);
  const commands: string[] = [
    pdfRect(0, 764, 595, 78, "#1f7a3a"),
    pdfTextAt("Digital CIP", 42, 807, 24, true, "#ffffff"),
    pdfTextAt(reportTypeLabel(options.reportType), 42, 786, 12, false, "#d9f5df"),
    pdfTextAt(`Periode: ${periodLabel(options)}`, 365, 808, 9, true, "#ffffff"),
    pdfTextAt(`Equipement: ${options.equipment === "all" ? "Tous" : options.equipment}`, 365, 790, 9, false, "#d9f5df"),
    pdfTextAt("Synthese", 42, 735, 16, true, "#1f7a3a")
  ];

  const cards = [
    ["Cycles", String(metrics.total), "#f1f8f3"],
    ["Conformite", `${metrics.compliance}%`, "#f1f8f3"],
    ["Eau", `${metrics.waterM3} m3`, "#edf8ff"],
    ["Detergent", `${metrics.detergent} L`, "#f1f8f3"]
  ] as const;

  cards.forEach(([label, value, color], index) => {
    const x = 42 + index * 128;
    commands.push(pdfRect(x, 672, 112, 48, color));
    commands.push(pdfTextAt(label, x + 10, 704, 8, true, "#607466"));
    commands.push(pdfTextAt(value, x + 10, 682, 16, true, "#102016"));
  });

  commands.push(pdfTextAt("Conformite des cycles termines", 42, 642, 13, true, "#102016"));
  commands.push(pdfBar("Conformes", metrics.compliant, Math.max(metrics.completed, 1), 42, 618, 260, "#1f7a3a"));
  commands.push(pdfBar("Non conformes", metrics.nonCompliant, Math.max(metrics.completed, 1), 42, 596, 260, "#ef4444"));

  commands.push(pdfTextAt("Cycles par jour", 42, 560, 13, true, "#102016"));
  daily.forEach((row, index) => {
    const x = 48 + index * 34;
    const height = Math.max(3, (row.count / maxDaily) * 72);
    commands.push(pdfRect(x, 462, 18, 80, "#edf4ef"));
    commands.push(pdfRect(x, 462, 18, height, "#1f7a3a"));
    commands.push(pdfTextAt(row.day, x - 2, 448, 7, false, "#607466"));
  });

  commands.push(pdfTextAt("Consommation par equipement", 330, 642, 13, true, "#102016"));
  consumption.slice(0, 5).forEach((row, index) => {
    commands.push(pdfBar(row.equipment.slice(0, 20), row.water, maxWater, 330, 618 - index * 23, 120, "#0ea5e9"));
  });

  commands.push(pdfTextAt("Derniers cycles CIP", 42, 415, 13, true, "#102016"));
  commands.push(pdfRect(42, 390, 510, 18, "#1f7a3a"));
  commands.push(pdfTextAt("Date", 48, 396, 8, true, "#ffffff"));
  commands.push(pdfTextAt("Equipement", 126, 396, 8, true, "#ffffff"));
  commands.push(pdfTextAt("Programme", 246, 396, 8, true, "#ffffff"));
  commands.push(pdfTextAt("Statut", 365, 396, 8, true, "#ffffff"));
  commands.push(pdfTextAt("Resultat", 438, 396, 8, true, "#ffffff"));

  cycles.slice(0, 12).forEach((cycle, index) => {
    const y = 370 - index * 20;
    if (index % 2 === 0) commands.push(pdfRect(42, y - 4, 510, 18, "#f7fbf8"));
    commands.push(pdfTextAt(cycle.date.slice(0, 16), 48, y, 7, false, "#102016"));
    commands.push(pdfTextAt(cycle.equipment.slice(0, 22), 126, y, 7, false, "#102016"));
    commands.push(pdfTextAt(cycle.process.slice(0, 22), 246, y, 7, false, "#102016"));
    commands.push(pdfTextAt(cycle.status, 365, y, 7, true, "#102016"));
    commands.push(pdfTextAt(cycle.result, 438, y, 7, true, cycle.result === "Non conforme" ? "#b91c1c" : "#1f7a3a"));
    commands.push(pdfLine(42, y - 8, 552, y - 8, "#dce8df"));
  });

  commands.push(pdfTextAt(`Generation: ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date())}`, 42, 36, 8, false, "#607466"));

  return buildPdfDocument(commands.join("\n"));
}

export async function GET(request: NextRequest) {
  const data = await getCipDashboardData();
  const options = exportOptions(request);
  const cycles = filterCycles(data.cycles, options);
  const slug = `${options.reportType}-${options.format}`.replace(/[^a-z0-9-]/gi, "-").toLowerCase();

  if (options.format === "excel") {
    return new NextResponse(buildExcelReportHtml(data, options, cycles), {
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="digital-cip-${slug}.xls"`
      }
    });
  }

  return new NextResponse(buildPdf(data, options, cycles), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="digital-cip-${slug}.pdf"`
    }
  });
}
