import { NextResponse, type NextRequest } from "next/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { getCipDashboardData, type CipDashboardData } from "@/lib/cip/data";
import type { CipCycle } from "@/lib/cip/mock-data";
import {
  buildReportAnalytics,
  filterReportCycles,
  pct,
  periodLabel,
  reportTypeLabel,
  type ReportOptions
} from "@/lib/cip/reporting";

function boolParam(params: URLSearchParams, name: string, hasExplicitIncludes: boolean) {
  return hasExplicitIncludes ? params.get(name) === "on" : true;
}

function exportOptions(request: NextRequest): ReportOptions {
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

function htmlCell(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function pdfText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)")
    .replace(/[^\x20-\x7E]/g, "");
}

function emptyRow(message: string, columns: number) {
  return `<tr><td colspan="${columns}" class="empty">${htmlCell(message)}</td></tr>`;
}

function buildExcelReportHtml(data: CipDashboardData, options: ReportOptions, cycles: CipCycle[]) {
  const analytics = buildReportAnalytics(data, cycles);
  const { metrics } = analytics;
  const consumption = analytics.equipmentConsumption.slice(0, 8);
  const daily = analytics.dailyCounts.slice(-12);
  const maxWater = Math.max(...consumption.map((row) => row.water), 1);
  const maxDaily = Math.max(...daily.map((row) => row.count), 1);
  const cyclesRows = cycles
    .map((cycle) => {
      const workshop = data.equipments.find((equipment) => equipment.name === cycle.equipment)?.line ?? "Atelier non renseigne";
      return `
        <tr>
          <td>${htmlCell(cycle.date)}</td>
          <td>${htmlCell(cycle.equipment)}</td>
          <td>${htmlCell(workshop)}</td>
          <td>${htmlCell(cycle.process)}</td>
          <td>${htmlCell(cycle.duration)} min</td>
          <td>${htmlCell(cycle.targetDurationMinutes)} min</td>
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

  const dailyRows =
    daily
      .map(
        (row) => `<tr>
          <td>${htmlCell(row.label)}</td>
          <td>${row.count}</td>
          <td>${row.completed}</td>
          <td>${row.active}</td>
          <td>${row.planned}</td>
          <td>${row.blocked}</td>
          <td><div class="bar-bg"><div class="bar-green" style="width:${pct(row.count, maxDaily)}%"></div></div></td>
        </tr>`
      )
      .join("") || emptyRow("Aucune donnee cycle disponible pour cette selection.", 7);

  const consumptionRows =
    consumption
      .map(
        (row) => `<tr>
          <td>${htmlCell(row.equipment)}</td>
          <td>${htmlCell(row.workshop)}</td>
          <td>${row.cycles}</td>
          <td>${row.water}</td>
          <td>${row.detergent}</td>
          <td>${row.soda}</td>
          <td>${row.acid}</td>
          <td><div class="bar-bg"><div class="bar-blue" style="width:${pct(row.water, maxWater)}%"></div></div></td>
        </tr>`
      )
      .join("") || emptyRow("Aucune consommation terminee pour cette selection.", 8);

  const workshopRows =
    analytics.workshopStats
      .map(
        (row) => `<tr>
          <td>${htmlCell(row.workshop)}</td>
          <td>${row.cycles}</td>
          <td>${row.compliant}</td>
          <td>${row.nonCompliant}</td>
          <td>${row.water}</td>
          <td>${row.detergent}</td>
        </tr>`
      )
      .join("") || emptyRow("Aucun atelier avec cycle termine dans cette selection.", 6);

  const programRows =
    analytics.programStats
      .map(
        (row) => `<tr>
          <td>${htmlCell(row.program)}</td>
          <td>${row.cycles}</td>
          <td>${row.compliance}%</td>
          <td>${row.averageDuration} min</td>
          <td>${row.water}</td>
          <td>${row.detergent}</td>
        </tr>`
      )
      .join("") || emptyRow("Aucun programme avec cycle termine dans cette selection.", 6);

  const rulesRows = analytics.analysisRules
    .map(
      (rule) => `<tr>
        <td>${htmlCell(rule.label)}</td>
        <td>${htmlCell(rule.formula)}</td>
        <td>${htmlCell(rule.threshold)}</td>
        <td>Desactive jusqu'a validation qualite</td>
      </tr>`
    )
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
    td { border: 1px solid #dce8df; padding: 8px; vertical-align: top; }
    .empty { color: #607466; font-weight: bold; text-align: center; padding: 18px; }
    .bar-bg { background: #e8f2eb; height: 14px; width: 220px; }
    .bar-green { background: #1f7a3a; height: 14px; }
    .bar-red { background: #ef4444; height: 14px; }
    .bar-blue { background: #0ea5e9; height: 14px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Formital CIP - ${htmlCell(reportTypeLabel(options.reportType))}</h1>
    <div class="subtitle">Periode: ${htmlCell(periodLabel(options))} | Equipement: ${htmlCell(options.equipment === "all" ? "Tous les equipements" : options.equipment)}</div>
  </div>
  <div class="cards">
    <div class="card"><div class="label">Cycles filtres</div><div class="value">${metrics.total}</div></div>
    <div class="card"><div class="label">Cycles termines</div><div class="value">${metrics.completed}</div></div>
    <div class="card"><div class="label">Conformite terminee</div><div class="value">${metrics.compliance}%</div></div>
    <div class="card"><div class="label">Alertes actives</div><div class="value">${analytics.alertStats.active}</div></div>
    <div class="card"><div class="label">Eau</div><div class="value">${metrics.waterM3} m3</div></div>
    <div class="card"><div class="label">Detergent</div><div class="value">${metrics.detergent} L</div></div>
    <div class="card"><div class="label">Duree moyenne</div><div class="value">${metrics.averageDuration} min</div></div>
    <div class="card"><div class="label">Equipements</div><div class="value">${metrics.equipmentsUsed}</div></div>
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
      <tr><th>Jour</th><th>Total</th><th>Termines</th><th>En cours</th><th>Planifies</th><th>Bloques</th><th>Graphique</th></tr>
      ${dailyRows}
    </table>
  </div>
  <div class="section">
    <h2>Consommation par equipement</h2>
    <table>
      <tr><th>Equipement</th><th>Atelier</th><th>Cycles</th><th>Eau L</th><th>Detergent L</th><th>Soude L</th><th>Acide L</th><th>Graphique eau</th></tr>
      ${consumptionRows}
    </table>
  </div>
  <div class="section">
    <h2>Ateliers</h2>
    <table>
      <tr><th>Atelier</th><th>Cycles</th><th>Conformes</th><th>Non conformes</th><th>Eau L</th><th>Detergent L</th></tr>
      ${workshopRows}
    </table>
  </div>
  <div class="section">
    <h2>Programmes CIP</h2>
    <table>
      <tr><th>Programme</th><th>Cycles</th><th>Conformite</th><th>Duree moyenne</th><th>Eau L</th><th>Detergent L</th></tr>
      ${programRows}
    </table>
  </div>
  <div class="section">
    <h2>Analyse automatique - regles a valider</h2>
    <table>
      <tr><th>Regle</th><th>Formule</th><th>Seuil</th><th>Etat</th></tr>
      ${rulesRows}
    </table>
  </div>
  <div class="section">
    <h2>Cycles CIP</h2>
    <table>
      <tr><th>Date</th><th>Equipement</th><th>Atelier</th><th>Programme</th><th>Duree</th><th>Duree cible</th><th>Statut</th><th>Resultat</th><th>Operateur</th><th>Temp C</th><th>Eau L</th><th>Det. L</th><th>Soude L</th><th>Acide L</th><th>Aspect</th><th>Observation</th></tr>
      ${cyclesRows || emptyRow("Aucun cycle dans cette selection.", 16)}
    </table>
  </div>
</body>
</html>`;
}

const PDF_LAYOUT = {
  pageWidth: 842,
  pageHeight: 595,
  pageMargin: 30,
  columnGap: 18,
  headerHeight: 58,
  cardGap: 14,
  cardPadding: 16,
  chartHeight: 168,
  rowHeight: 24,
  footerHeight: 20,
  labelWidthRatio: 0.35,
  valueWidthRatio: 0.12
} as const;

const PDF_COLORS = {
  green: "#1f7a3a",
  greenSoft: "#edf8f0",
  greenDark: "#102016",
  red: "#ef4444",
  redSoft: "#fff1f1",
  blue: "#0ea5e9",
  yellow: "#f59e0b",
  ink: "#102016",
  muted: "#607466",
  line: "#d8e7de",
  panel: "#f7fbf8",
  white: "#ffffff"
} as const;

type PdfPage = string[];
type ReportChartCardBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};
type ReportChartCardOptions = ReportChartCardBounds & {
  title: string;
  subtitle?: string;
};
type HorizontalBarRow = {
  label: string;
  value: number;
  total: number;
  valueText: string;
  color: string;
  muted?: boolean;
};
type HistogramRow = {
  label: string;
  value: number;
  color: string;
};

function buildPdfDocument(pages: string[]) {
  const pageObjectIds = pages.map((_, index) => 3 + index * 2);
  const contentObjectIds = pages.map((_, index) => 4 + index * 2);
  const regularFontObjectId = 3 + pages.length * 2;
  const boldFontObjectId = regularFontObjectId + 1;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`
  ];

  pages.forEach((content, index) => {
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_LAYOUT.pageWidth} ${PDF_LAYOUT.pageHeight}] /Resources << /Font << /F1 ${regularFontObjectId} 0 R /F2 ${boldFontObjectId} 0 R >> >> /Contents ${contentObjectIds[index]} 0 R >>`
    );
    objects.push(`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`);
  });

  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

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

function pdfStrokeRect(x: number, y: number, width: number, height: number, color = PDF_COLORS.line, lineWidth = 0.8) {
  return `${rgb(color)} RG ${lineWidth} w ${x} ${y} ${width} ${height} re S`;
}

function pdfLine(x1: number, y1: number, x2: number, y2: number, color = "#d8e7de") {
  return `${rgb(color)} RG 0.8 w ${x1} ${y1} m ${x2} ${y2} l S`;
}

function pdfFitText(value: string, maxChars: number) {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, Math.max(1, maxChars - 3))}...`;
}

function pdfMetricCard(page: PdfPage, x: number, y: number, width: number, label: string, value: string, tone: string = PDF_COLORS.panel) {
  page.push(pdfRect(x, y, width, 44, tone));
  page.push(pdfStrokeRect(x, y, width, 44, PDF_COLORS.line));
  page.push(pdfTextAt(label, x + 10, y + 28, 7.5, true, PDF_COLORS.muted));
  page.push(pdfTextAt(value, x + 10, y + 10, 14, true, PDF_COLORS.ink));
}

function ReportChartCard(page: PdfPage, options: ReportChartCardOptions) {
  const { x, y, width, height, title, subtitle } = options;
  page.push(pdfRect(x, y, width, height, PDF_COLORS.white));
  page.push(pdfStrokeRect(x, y, width, height, PDF_COLORS.line));
  page.push(pdfTextAt(title, x + PDF_LAYOUT.cardPadding, y + height - 24, 13, true, PDF_COLORS.ink));
  if (subtitle) {
    page.push(pdfTextAt(subtitle, x + PDF_LAYOUT.cardPadding, y + height - 40, 8, false, PDF_COLORS.muted));
  }

  const chartTopOffset = subtitle ? 48 : 38;
  return {
    x: x + PDF_LAYOUT.cardPadding,
    y: y + PDF_LAYOUT.cardPadding,
    width: width - PDF_LAYOUT.cardPadding * 2,
    height: height - PDF_LAYOUT.cardPadding - chartTopOffset
  };
}

function pdfHorizontalBars(page: PdfPage, rows: HorizontalBarRow[], bounds: ReportChartCardBounds) {
  const rowHeight = PDF_LAYOUT.rowHeight;
  const labelWidth = bounds.width * PDF_LAYOUT.labelWidthRatio;
  const valueWidth = bounds.width * PDF_LAYOUT.valueWidthRatio;
  const barGap = 10;
  const barX = bounds.x + labelWidth + barGap;
  const barWidth = bounds.width - labelWidth - valueWidth - barGap * 2;
  const valueX = barX + barWidth + barGap;

  rows.forEach((row, index) => {
    const y = bounds.y + bounds.height - (index + 1) * rowHeight + 5;
    if (y < bounds.y) return;
    const width = row.value === 0 ? 0 : Math.min(barWidth, (row.value / Math.max(row.total, 1)) * barWidth);
    page.push(pdfTextAt(pdfFitText(row.label, 24), bounds.x, y + 1, 8.5, true, row.muted ? PDF_COLORS.muted : PDF_COLORS.ink));
    page.push(pdfRect(barX, y, barWidth, 7, "#e8f2eb"));
    if (width > 0) {
      page.push(pdfRect(barX, y, width, 7, row.color));
    }
    page.push(pdfTextAt(row.valueText, valueX, y + 1, 8.5, true, row.color));
  });
}

function pdfVerticalHistogram(page: PdfPage, rows: HistogramRow[], bounds: ReportChartCardBounds) {
  const plotLeft = bounds.x + 44;
  const plotRight = bounds.x + bounds.width - 8;
  const plotBottom = bounds.y + 26;
  const plotTop = bounds.y + bounds.height - 12;
  const plotWidth = plotRight - plotLeft;
  const plotHeight = plotTop - plotBottom;
  const maxValue = Math.max(...rows.map((row) => row.value), 1);
  const ticks = [0, Math.ceil(maxValue * 0.33), Math.ceil(maxValue * 0.66), maxValue].filter(
    (value, index, all) => all.indexOf(value) === index
  );
  const visibleCount = Math.max(rows.length, 1);
  const centeredSlots = rows.length <= 2 ? Math.max(2, rows.length) * 92 : plotWidth;
  const slotWidth = rows.length <= 2 ? centeredSlots / Math.max(rows.length, 1) : plotWidth / visibleCount;
  const startX = rows.length <= 2 ? plotLeft + (plotWidth - centeredSlots) / 2 : plotLeft;
  const barWidth = Math.max(12, Math.min(28, slotWidth * 0.44));

  ticks.forEach((tick) => {
    const y = plotBottom + (tick / Math.max(maxValue, 1)) * plotHeight;
    page.push(pdfLine(plotLeft, y, plotRight, y, PDF_COLORS.line));
    page.push(pdfTextAt(String(tick), bounds.x + 4, y - 3, 7.5, true, PDF_COLORS.muted));
  });

  rows.forEach((row, index) => {
    const center = startX + index * slotWidth + slotWidth / 2;
    const x = center - barWidth / 2;
    const height = row.value === 0 ? 0 : Math.max(2, (row.value / Math.max(maxValue, 1)) * plotHeight);
    if (height > 0) {
      page.push(pdfRect(x, plotBottom, barWidth, height, row.color));
      page.push(pdfTextAt(String(row.value), center - 3, plotBottom + height + 5, 8, true, row.color));
    }
    page.push(pdfTextAt(pdfFitText(row.label, 12), center - 18, bounds.y + 7, 7, true, PDF_COLORS.muted));
  });
}

function addPdfHeader(page: PdfPage, title: string, options: ReportOptions, pageNumber: number) {
  page.push(pdfRect(0, PDF_LAYOUT.pageHeight - PDF_LAYOUT.headerHeight, PDF_LAYOUT.pageWidth, PDF_LAYOUT.headerHeight, PDF_COLORS.green));
  page.push(pdfTextAt("Formital CIP", PDF_LAYOUT.pageMargin, PDF_LAYOUT.pageHeight - 25, 18, true, PDF_COLORS.white));
  page.push(pdfTextAt(title, PDF_LAYOUT.pageMargin, PDF_LAYOUT.pageHeight - 43, 9, false, "#d9f5df"));
  page.push(pdfTextAt(`Periode: ${periodLabel(options)}`, PDF_LAYOUT.pageWidth - 292, PDF_LAYOUT.pageHeight - 24, 8, true, PDF_COLORS.white));
  page.push(
    pdfTextAt(
      `Equipement: ${options.equipment === "all" ? "Tous les equipements" : pdfFitText(options.equipment, 28)}`,
      PDF_LAYOUT.pageWidth - 292,
      PDF_LAYOUT.pageHeight - 42,
      8,
      false,
      "#d9f5df"
    )
  );
  page.push(pdfTextAt(`Page ${pageNumber}`, PDF_LAYOUT.pageWidth - 78, 18, 8, false, PDF_COLORS.muted));
}

function addConsumptionPage(pages: string[], options: ReportOptions, rows: ReturnType<typeof buildReportAnalytics>["equipmentConsumption"], pageNumber: number) {
  const page: PdfPage = [];
  addPdfHeader(page, "Consommation par equipement", options, pageNumber);
  const columnWidth = (PDF_LAYOUT.pageWidth - PDF_LAYOUT.pageMargin * 2 - PDF_LAYOUT.columnGap) / 2;
  const leftX = PDF_LAYOUT.pageMargin;
  const rightX = leftX + columnWidth + PDF_LAYOUT.columnGap;
  const top = PDF_LAYOUT.pageHeight - PDF_LAYOUT.headerHeight - PDF_LAYOUT.cardGap;
  const rowGroups = rows.reduce<Array<typeof rows>>((groups, row) => {
    const last = groups.at(-1);
    if (!last || last.length === 10) groups.push([row]);
    else last.push(row);
    return groups;
  }, []);

  rowGroups.slice(0, 2).forEach((group, index) => {
    const x = index === 0 ? leftX : rightX;
    const bounds = ReportChartCard(page, {
      x,
      y: PDF_LAYOUT.pageMargin + PDF_LAYOUT.footerHeight,
      width: columnWidth,
      height: top - PDF_LAYOUT.pageMargin - PDF_LAYOUT.footerHeight,
      title: index === 0 ? "Consommation par equipement" : "Consommation par equipement - suite",
      subtitle: `${group.length} lignes affichees`
    });
    const max = Math.max(...group.map((row) => row.water + row.detergent + row.soda + row.acid), 1);
    pdfHorizontalBars(
      page,
      group.map((row) => ({
        label: `${row.equipment} - ${row.workshop}`,
        value: row.water + row.detergent + row.soda + row.acid,
        total: max,
        valueText: `${row.water}L eau / ${row.detergent}L det.`,
        color: row.water > 0 ? PDF_COLORS.blue : PDF_COLORS.green,
        muted: row.cycles === 0
      })),
      bounds
    );
  });

  if (rowGroups.length === 0) {
    const bounds = ReportChartCard(page, {
      x: leftX,
      y: PDF_LAYOUT.pageMargin + PDF_LAYOUT.footerHeight,
      width: PDF_LAYOUT.pageWidth - PDF_LAYOUT.pageMargin * 2,
      height: top - PDF_LAYOUT.pageMargin - PDF_LAYOUT.footerHeight,
      title: "Consommation par equipement"
    });
    page.push(pdfTextAt("Aucune consommation terminee pour cette selection.", bounds.x, bounds.y + bounds.height - 20, 9, true, PDF_COLORS.muted));
  }

  if (rowGroups.length > 2) {
    pages.push(page.join("\n"));
    addConsumptionPage(pages, options, rows.slice(20), pageNumber + 1);
    return;
  }

  pages.push(page.join("\n"));
}

function buildPdf(data: CipDashboardData, options: ReportOptions, cycles: CipCycle[]) {
  const analytics = buildReportAnalytics(data, cycles);
  const { metrics } = analytics;
  const consumption = analytics.equipmentConsumption.sort(
    (left, right) => right.water + right.detergent + right.soda + right.acid - (left.water + left.detergent + left.soda + left.acid)
  );
  const daily = analytics.dailyCounts.slice(-10);
  const pages: string[] = [];
  const page: PdfPage = [];
  const columnWidth = (PDF_LAYOUT.pageWidth - PDF_LAYOUT.pageMargin * 2 - PDF_LAYOUT.columnGap) / 2;
  const leftX = PDF_LAYOUT.pageMargin;
  const rightX = leftX + columnWidth + PDF_LAYOUT.columnGap;

  addPdfHeader(page, reportTypeLabel(options.reportType), options, 1);

  const cards = [
    ["Cycles filtres", String(metrics.total), PDF_COLORS.greenSoft],
    ["Cycles termines", String(metrics.completed), PDF_COLORS.greenSoft],
    ["Conformite", `${metrics.compliance}%`, PDF_COLORS.greenSoft],
    ["Alertes actives", String(analytics.alertStats.active), "#fff7ed"],
    ["Eau", `${metrics.waterM3} m3`, "#edf8ff"],
    ["Detergent", `${metrics.detergent} L`, PDF_COLORS.greenSoft],
    ["Duree moyenne", `${metrics.averageDuration} min`, PDF_COLORS.panel],
    ["Equipements", String(metrics.equipmentsUsed), PDF_COLORS.panel]
  ] as const;

  cards.forEach(([label, value, color], index) => {
    const x = PDF_LAYOUT.pageMargin + (index % 4) * ((PDF_LAYOUT.pageWidth - PDF_LAYOUT.pageMargin * 2 - 3 * 10) / 4 + 10);
    const y = PDF_LAYOUT.pageHeight - PDF_LAYOUT.headerHeight - 58 - (index < 4 ? 0 : 50);
    pdfMetricCard(page, x, y, (PDF_LAYOUT.pageWidth - PDF_LAYOUT.pageMargin * 2 - 3 * 10) / 4, label, value, color);
  });

  const gridTop = PDF_LAYOUT.pageHeight - PDF_LAYOUT.headerHeight - 118;
  const graphHeight = 206;
  const graphY = gridTop - graphHeight;
  const complianceY = graphY;
  const lowerY = PDF_LAYOUT.pageMargin + PDF_LAYOUT.footerHeight;
  const lowerHeight = complianceY - lowerY - PDF_LAYOUT.cardGap;
  const cyclesBounds = ReportChartCard(page, {
    x: leftX,
    y: graphY,
    width: columnWidth,
    height: graphHeight,
    title: "Cycles par jour",
    subtitle: `${daily.length || 0} jours affiches`
  });

  if (daily.length === 0) {
    page.push(pdfTextAt("Aucune donnee cycle disponible.", cyclesBounds.x, cyclesBounds.y + cyclesBounds.height - 20, 9, true, PDF_COLORS.muted));
  } else {
    pdfVerticalHistogram(
      page,
      daily.map((row) => ({ label: row.label, value: row.count, color: PDF_COLORS.green })),
      cyclesBounds
    );
  }

  const complianceBounds = ReportChartCard(page, {
    x: rightX,
    y: complianceY,
    width: columnWidth,
    height: graphHeight,
    title: "Conformite des cycles termines",
    subtitle: `Objectif qualite: a definir par Formital`
  });
  pdfHorizontalBars(
    page,
    [
      {
        label: "Conformes",
        value: metrics.compliant,
        total: Math.max(metrics.completed, 1),
        valueText: `${metrics.compliant} cycles - ${pct(metrics.compliant, metrics.completed)}%`,
        color: PDF_COLORS.green
      },
      {
        label: "Non conformes",
        value: metrics.nonCompliant,
        total: Math.max(metrics.completed, 1),
        valueText: `${metrics.nonCompliant} cycles - ${pct(metrics.nonCompliant, metrics.completed)}%`,
        color: PDF_COLORS.red
      }
    ],
    {
      ...complianceBounds,
      y: complianceBounds.y + complianceBounds.height / 2 - PDF_LAYOUT.rowHeight,
      height: PDF_LAYOUT.rowHeight * 2
    }
  );
  page.push(pdfTextAt(`Taux: ${metrics.compliance}%`, complianceBounds.x, complianceBounds.y + 18, 18, true, PDF_COLORS.green));

  const consumptionBounds = ReportChartCard(page, {
    x: leftX,
    y: lowerY,
    width: PDF_LAYOUT.pageWidth - PDF_LAYOUT.pageMargin * 2,
    height: lowerHeight,
    title: "Consommation par equipement",
    subtitle: "Total eau, detergent, soude et acide - lignes triees par consommation"
  });
  const firstPageConsumption = consumption.slice(0, 9);
  if (firstPageConsumption.length === 0) {
    page.push(pdfTextAt("Aucune consommation terminee pour cette selection.", consumptionBounds.x, consumptionBounds.y + consumptionBounds.height - 20, 9, true, PDF_COLORS.muted));
  } else {
    const maxConsumption = Math.max(...firstPageConsumption.map((row) => row.water + row.detergent + row.soda + row.acid), 1);
    pdfHorizontalBars(
      page,
      firstPageConsumption.map((row) => ({
        label: `${row.equipment} - ${row.workshop}`,
        value: row.water + row.detergent + row.soda + row.acid,
        total: maxConsumption,
        valueText: `${row.water}L eau / ${row.detergent}L det.`,
        color: row.water > 0 ? PDF_COLORS.blue : PDF_COLORS.green
      })),
      consumptionBounds
    );
  }

  page.push(pdfTextAt("Analyse automatique: seuils metier a valider avant activation.", PDF_LAYOUT.pageMargin, 18, 8, true, "#92400e"));
  pages.push(page.join("\n"));

  if (consumption.length > firstPageConsumption.length) {
    addConsumptionPage(pages, options, consumption.slice(firstPageConsumption.length), pages.length + 1);
  }

  return buildPdfDocument(pages);
}

export async function GET(request: NextRequest) {
  const profile = await getCurrentProfile();

  if (!profile?.is_active) {
    return NextResponse.json({ message: "Votre session a expire." }, { status: 401 });
  }

  const data = await getCipDashboardData(profile);
  const options = exportOptions(request);
  const cycles = filterReportCycles(data.cycles, options);
  const slug = `${options.reportType}-${options.format}`.replace(/[^a-z0-9-]/gi, "-").toLowerCase();

  if (options.format === "excel") {
    return new NextResponse(buildExcelReportHtml(data, options, cycles), {
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="formital-cip-${slug}.xls"`
      }
    });
  }

  return new NextResponse(buildPdf(data, options, cycles), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="formital-cip-${slug}.pdf"`
    }
  });
}
