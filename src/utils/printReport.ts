import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import {
  BorderStyle,
  Document as DocxDocument,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';

export interface PrintHtmlOptions {
  title: string;
  bodyHtml: string;
  orientation?: 'portrait' | 'landscape';
  pageMargin?: string;
  extraCss?: string;
}

export interface PrintElementOptions {
  element: HTMLElement | null;
  title: string;
  orientation?: 'portrait' | 'landscape';
  pageMargin?: string;
  extraCss?: string;
  prepareClone?: (clone: HTMLElement) => void;
}

export interface ReportSectionInput {
  heading?: string;
  title?: string;
  paragraphs?: string[];
  lines?: string[];
  body?: string;
  rows?: { label: string; value: string }[];
  table?: {
    title?: string;
    headers: string[];
    rows: (string | number)[][];
  };
}

export interface PdfTableOptions {
  title: string;
  subtitle?: string;
  filename?: string;
  orientation?: 'portrait' | 'landscape';
  kpis?: { label: string; value: string }[];
  breakdown?: { label: string; value: string }[];
  notes?: string[];
  sections?: ReportSectionInput[];
  table?: {
    title?: string;
    headers: string[];
    rows: (string | number)[][];
  };
}

export interface CsvExportOptions {
  filename: string;
  headers: string[];
  rows: (string | number)[][];
  preambleLines?: (string | number)[][];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeCsvCell(cell: string | number): string {
  const str = String(cell ?? '');
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Downloads a UTF-8 CSV with BOM (\uFEFF) so Microsoft Excel opens currency
 * symbols (₹, €, £) and special characters cleanly without mojibake.
 */
export function downloadBomCsv(options: CsvExportOptions): void;
export function downloadBomCsv(
  headers: string[],
  rows: (string | number)[][],
  filename: string
): void;
export function downloadBomCsv(
  arg1: CsvExportOptions | string[],
  arg2?: (string | number)[][],
  arg3?: string
): void {
  const {
    filename,
    headers,
    rows,
    preambleLines = [],
  }: CsvExportOptions = Array.isArray(arg1)
    ? {
        headers: arg1,
        rows: arg2 ?? [],
        filename: arg3 || 'export.csv',
      }
    : arg1;
  const lines: string[] = [];

  for (const pre of preambleLines) {
    lines.push(pre.map(escapeCsvCell).join(','));
  }
  if (preambleLines.length > 0) {
    lines.push('');
  }

  lines.push(headers.map(escapeCsvCell).join(','));
  for (const row of rows) {
    lines.push(row.map(escapeCsvCell).join(','));
  }

  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Prints a clean, standalone HTML document via a hidden iframe so ONLY the
 * intended report/table/slip prints — never the website navbar, sidebar, or footer.
 */
export async function printHtmlDocument({
  title,
  bodyHtml,
  orientation = 'portrait',
  pageMargin = '12mm',
  extraCss = '',
}: PrintHtmlOptions): Promise<void> {
  const existing = document.getElementById('vcpl-isolated-print-frame');
  if (existing?.parentNode) {
    existing.parentNode.removeChild(existing);
  }

  const iframe = document.createElement('iframe');
  iframe.id = 'vcpl-isolated-print-frame';
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  document.body.appendChild(iframe);

  const iframeWin = iframe.contentWindow;
  const iframeDoc = iframeWin?.document;
  if (!iframeWin || !iframeDoc) {
    window.print();
    return;
  }

  iframeDoc.open();
  iframeDoc.write(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      @page {
        size: A4 ${orientation};
        margin: ${pageMargin};
      }
      * {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      html, body {
        margin: 0;
        padding: 0;
        background: #ffffff;
        color: #0f172a;
        font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
        font-size: 11px;
        line-height: 1.45;
      }
      h1, h2, h3 {
        margin: 0 0 6px 0;
        color: #0f172a;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 8px;
      }
      thead {
        display: table-header-group;
      }
      tr {
        break-inside: avoid;
        page-break-inside: avoid;
      }
      th, td {
        border: 1px solid #cbd5e1;
        padding: 5px 7px;
        text-align: left;
        font-variant-numeric: tabular-nums;
      }
      th {
        background: #f1f5f9;
        font-weight: 700;
        color: #0f172a;
      }
      .num {
        text-align: right;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      }
      .kpi-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 8px;
        margin: 10px 0 14px;
      }
      .kpi-card {
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        padding: 8px 10px;
        background: #f8fafc;
      }
      .kpi-label {
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #475569;
        font-weight: 700;
      }
      .kpi-val {
        font-size: 14px;
        font-weight: 800;
        color: #0f172a;
        margin-top: 2px;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      }
      .no-print, .print\\:hidden {
        display: none !important;
      }
      ${extraCss}
    </style>
  </head>
  <body>${bodyHtml}</body>
</html>`);
  iframeDoc.close();

  if (iframeDoc.fonts?.ready) {
    await Promise.race([
      iframeDoc.fonts.ready,
      new Promise((resolve) => window.setTimeout(resolve, 500)),
    ]);
  }

  const cleanup = () => {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  };
  iframeWin.addEventListener('afterprint', cleanup, { once: true });
  window.setTimeout(cleanup, 60000);

  iframeWin.focus();
  iframeWin.print();
}

/**
 * Clones ONLY a specific DOM element and all active stylesheets into an isolated
 * print iframe so Tailwind styling is preserved 100% while hiding the rest of the website.
 */
export async function printTargetElement({
  element,
  title,
  orientation = 'portrait',
  pageMargin = '8mm',
  extraCss = '',
  prepareClone,
}: PrintElementOptions): Promise<void> {
  if (!element) {
    window.print();
    return;
  }

  const existing = document.getElementById('vcpl-isolated-print-frame');
  if (existing?.parentNode) {
    existing.parentNode.removeChild(existing);
  }

  const iframe = document.createElement('iframe');
  iframe.id = 'vcpl-isolated-print-frame';
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  document.body.appendChild(iframe);

  const iframeWin = iframe.contentWindow;
  const iframeDoc = iframeWin?.document;
  if (!iframeWin || !iframeDoc) {
    window.print();
    return;
  }

  const headStyles = Array.from(
    document.querySelectorAll('link[rel="stylesheet"], style')
  )
    .map((node) => node.outerHTML)
    .join('\n');

  const clone = element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.no-print, .print\\:hidden').forEach((n) => n.remove());
  if (prepareClone) {
    prepareClone(clone);
  }

  iframeDoc.open();
  iframeDoc.write(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    ${headStyles}
    <style>
      @page {
        size: A4 ${orientation};
        margin: ${pageMargin};
      }
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      html, body {
        background: #ffffff !important;
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
        height: auto !important;
        overflow: visible !important;
      }
      .no-print, .print\\:hidden {
        display: none !important;
      }
      ${extraCss}
    </style>
  </head>
  <body class="bg-white text-slate-900">
    <div id="vcpl-print-root"></div>
  </body>
</html>`);
  iframeDoc.close();

  const printRoot = iframeDoc.getElementById('vcpl-print-root');
  if (printRoot) {
    printRoot.appendChild(iframeDoc.importNode(clone, true));
  }

  if (iframeDoc.fonts?.ready) {
    await Promise.race([
      iframeDoc.fonts.ready,
      new Promise((resolve) => window.setTimeout(resolve, 600)),
    ]);
  }

  const imgs = Array.from(iframeDoc.images);
  if (imgs.length > 0) {
    await Promise.race([
      Promise.all(
        imgs.map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                img.onload = () => resolve();
                img.onerror = () => resolve();
              })
        )
      ),
      new Promise<void>((resolve) => window.setTimeout(resolve, 1500)),
    ]);
  }

  const cleanup = () => {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  };
  iframeWin.addEventListener('afterprint', cleanup, { once: true });
  window.setTimeout(cleanup, 60000);

  iframeWin.focus();
  iframeWin.print();
}

/**
 * Exports a DOM element directly to a multi-page A4 PDF file without opening
 * the browser print dialog.
 */
export async function exportElementToPdf(params: {
  element: HTMLElement | null;
  filename: string;
  orientation?: 'portrait' | 'landscape';
  backgroundColor?: string;
  prepareClone?: (clonedDoc: Document) => void;
}): Promise<void> {
  const {
    element,
    filename,
    orientation = 'portrait',
    backgroundColor = '#ffffff',
    prepareClone,
  } = params;
  if (!element) return;

  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor,
    onclone: (clonedDoc) => {
      clonedDoc.querySelectorAll('.no-print, .print\\:hidden').forEach((n) => {
        (n as HTMLElement).style.display = 'none';
      });
      if (prepareClone) prepareClone(clonedDoc);
    },
  });

  const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
  const pageWidthMm = orientation === 'landscape' ? 297 : 210;
  const pageHeightMm = orientation === 'landscape' ? 210 : 297;
  const margin = 8;
  const printableW = pageWidthMm - margin * 2;
  const renderedH = (canvas.height * printableW) / canvas.width;
  const imgData = canvas.toDataURL('image/jpeg', 0.95);

  const printableH = pageHeightMm - margin * 2;
  let heightLeft = renderedH;
  let position = margin;

  const maskMargins = () => {
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageWidthMm, margin, 'F');
    pdf.rect(0, pageHeightMm - margin, pageWidthMm, margin, 'F');
  };

  pdf.addImage(imgData, 'JPEG', margin, position, printableW, renderedH);
  maskMargins();
  heightLeft -= printableH;

  while (heightLeft > 2) {
    position -= printableH;
    pdf.addPage();
    pdf.addImage(imgData, 'JPEG', margin, position, printableW, renderedH);
    maskMargins();
    heightLeft -= printableH;
  }

  pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

function sanitizePdfText(input: string | number): string {
  // jsPDF standard Helvetica handles WinAnsi; replace ₹ with Rs. so PDF text is crisp without font tofu
  return String(input ?? '')
    .replace(/₹/g, 'Rs. ')
    .replace(/−/g, '-')
    .replace(/×/g, 'x')
    .replace(/·/g, '|')
    .replace(/[^\x20-\x7E]/g, ' ');
}

/**
 * Generates a crisp multi-page vector A4 PDF for financial summaries and long
 * amortization schedules using jsPDF directly (no image clipping).
 */
export function exportStructuredReportPdf(options: PdfTableOptions): void {
  const {
    title,
    subtitle,
    filename = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'report'}.pdf`,
    orientation = 'portrait',
    kpis = [],
    breakdown = [],
    notes = [],
    sections = [],
    table,
  } = options;

  const extraBreakdown = [
    ...breakdown,
    ...sections.flatMap((s) => s.rows ?? []),
  ];
  const resolvedTable = table ?? sections.find((s) => s.table)?.table;

  const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
  const pageW = orientation === 'landscape' ? 297 : 210;
  const pageH = orientation === 'landscape' ? 210 : 297;
  const margin = 12;
  const contentW = pageW - margin * 2;
  let y = margin;

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > pageH - margin) {
      pdf.addPage();
      y = margin;
      return true;
    }
    return false;
  };

  // Header
  pdf.setFillColor(47, 62, 78);
  pdf.rect(margin, y, contentW, 16, 'F');
  pdf.setTextColor(255, 253, 245);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.text(sanitizePdfText(title), margin + 4, y + 7);
  if (subtitle) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.text(sanitizePdfText(subtitle), margin + 4, y + 12.5);
  }
  y += 20;

  // KPIs row
  if (kpis.length > 0) {
    const cols = Math.min(4, kpis.length);
    const boxW = (contentW - (cols - 1) * 3) / cols;
    kpis.slice(0, 4).forEach((kpi, idx) => {
      const x = margin + idx * (boxW + 3);
      pdf.setFillColor(241, 245, 249);
      pdf.setDrawColor(203, 213, 225);
      pdf.rect(x, y, boxW, 15, 'FD');
      pdf.setTextColor(71, 85, 105);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.5);
      pdf.text(sanitizePdfText(kpi.label).slice(0, 30), x + 2.5, y + 5);
      pdf.setTextColor(15, 23, 42);
      pdf.setFontSize(10.5);
      pdf.text(sanitizePdfText(kpi.value).slice(0, 26), x + 2.5, y + 11.5);
    });
    y += 19;
  }

  // Breakdown rows
  if (extraBreakdown.length > 0) {
    ensureSpace(12);
    pdf.setTextColor(15, 23, 42);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text('Summary Breakdown', margin, y);
    y += 4;

    extraBreakdown.forEach((row, idx) => {
      ensureSpace(7);
      if (idx % 2 === 0) {
        pdf.setFillColor(248, 250, 252);
        pdf.rect(margin, y, contentW, 6.2, 'F');
      }
      pdf.setDrawColor(226, 232, 240);
      pdf.line(margin, y + 6.2, margin + contentW, y + 6.2);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      pdf.setTextColor(51, 65, 85);
      pdf.text(sanitizePdfText(row.label).slice(0, 65), margin + 2, y + 4.3);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(15, 23, 42);
      pdf.text(sanitizePdfText(row.value), margin + contentW - 2, y + 4.3, {
        align: 'right',
      });
      y += 6.2;
    });
    y += 5;
  }

  // Sections prose
  for (const sec of sections) {
    const secHeading = sec.heading ?? sec.title;
    const paras = sec.paragraphs ?? sec.lines ?? (sec.body ? [sec.body] : []);
    if (secHeading && paras.length > 0) {
      ensureSpace(12);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9.5);
      pdf.setTextColor(15, 23, 42);
      pdf.text(sanitizePdfText(secHeading), margin, y);
      y += 4.5;
    }
    if (paras.length > 0) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.2);
      pdf.setTextColor(51, 65, 85);
      for (const p of paras) {
        const wrapped = pdf.splitTextToSize(sanitizePdfText(p), contentW);
        ensureSpace(wrapped.length * 4 + 2);
        pdf.text(wrapped, margin, y);
        y += wrapped.length * 4 + 1.5;
      }
      y += 2;
    }
  }

  // Notes
  if (notes.length > 0) {
    ensureSpace(12);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(71, 85, 105);
    for (const note of notes) {
      const wrapped = pdf.splitTextToSize(`* ${sanitizePdfText(note)}`, contentW);
      ensureSpace(wrapped.length * 4 + 2);
      pdf.text(wrapped, margin, y);
      y += wrapped.length * 4 + 1;
    }
    y += 3;
  }

  // Table with repeating header across pages
  if (resolvedTable && resolvedTable.rows.length > 0) {
    ensureSpace(18);
    if (resolvedTable.title) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(15, 23, 42);
      pdf.text(sanitizePdfText(resolvedTable.title), margin, y);
      y += 4.5;
    }

    const colCount = resolvedTable.headers.length;
    const colW = contentW / colCount;
    const headerH = 7;
    const rowH = 5.6;

    const drawTableHeader = () => {
      pdf.setFillColor(47, 62, 78);
      pdf.rect(margin, y, contentW, headerH, 'F');
      pdf.setTextColor(255, 253, 245);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(colCount > 8 ? 6.5 : 7.5);
      resolvedTable.headers.forEach((h, i) => {
        const text = sanitizePdfText(h).slice(0, colCount > 8 ? 14 : 22);
        pdf.text(text, margin + i * colW + 1.5, y + 4.7);
      });
      y += headerH;
    };

    drawTableHeader();

    resolvedTable.rows.forEach((row, rIdx) => {
      if (y + rowH > pageH - margin) {
        pdf.addPage();
        y = margin;
        drawTableHeader();
      }
      if (rIdx % 2 === 1) {
        pdf.setFillColor(248, 250, 252);
        pdf.rect(margin, y, contentW, rowH, 'F');
      }
      pdf.setDrawColor(226, 232, 240);
      pdf.line(margin, y + rowH, margin + contentW, y + rowH);
      pdf.setTextColor(15, 23, 42);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(colCount > 8 ? 6.4 : 7.3);

      row.forEach((cell, cIdx) => {
        const str = sanitizePdfText(cell).slice(0, colCount > 8 ? 16 : 24);
        pdf.text(str, margin + cIdx * colW + 1.5, y + 4);
      });
      y += rowH;
    });
  }

  // Footer page numbers
  const totalPages = pdf.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(100, 116, 139);
    pdf.text(
      `Generated locally via VCPL Tools · Page ${p} of ${totalPages}`,
      pageW / 2,
      pageH - 5,
      { align: 'center' }
    );
  }

  pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadJsonFile(params: { filename: string; data: unknown }): void;
export function downloadJsonFile(filename: string, data: unknown): void;
export function downloadJsonFile(data: unknown, filename: string): void;
export function downloadJsonFile(
  arg1: { filename: string; data: unknown } | string | unknown,
  arg2?: unknown
): void {
  let filename = 'export.json';
  let data: unknown = {};
  if (arg2 !== undefined) {
    if (typeof arg1 === 'string') {
      filename = arg1;
      data = arg2;
    } else if (typeof arg2 === 'string') {
      filename = arg2;
      data = arg1;
    }
  } else if (arg1 && typeof arg1 === 'object' && 'filename' in arg1 && 'data' in arg1) {
    const typed = arg1 as { filename: string; data: unknown };
    filename = typed.filename;
    data = typed.data;
  } else {
    data = arg1;
  }
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  triggerBlobDownload(blob, filename.endsWith('.json') ? filename : `${filename}.json`);
}

export interface ExcelSheetSpec {
  name: string;
  preambleLines?: (string | number)[][];
  headers?: string[];
  rows: (string | number)[][];
}

/**
 * Exports one or more sheets as a real .xlsx Excel workbook with auto-sized column widths.
 */
export function downloadExcelWorkbook(params: {
  filename: string;
  sheets: ExcelSheetSpec[];
}): void;
export function downloadExcelWorkbook(
  filename: string,
  sheets: ExcelSheetSpec[]
): void;
export function downloadExcelWorkbook(
  arg1: { filename: string; sheets: ExcelSheetSpec[] } | string,
  arg2?: ExcelSheetSpec[]
): void {
  const { filename, sheets } =
    typeof arg1 === 'string'
      ? { filename: arg1, sheets: arg2 ?? [] }
      : arg1;
  const wb = XLSX.utils.book_new();

  sheets.forEach((sheetSpec, idx) => {
    const aoa: (string | number)[][] = [];
    if (sheetSpec.preambleLines && sheetSpec.preambleLines.length > 0) {
      sheetSpec.preambleLines.forEach((line) => aoa.push(line));
      aoa.push([]);
    }
    if (sheetSpec.headers && sheetSpec.headers.length > 0) {
      aoa.push(sheetSpec.headers);
    }
    sheetSpec.rows.forEach((r) => aoa.push(r));

    const ws = XLSX.utils.aoa_to_sheet(aoa.length > 0 ? aoa : [['No data']]);
    const maxCols = aoa.reduce((m, r) => Math.max(m, r.length), 1);
    ws['!cols'] = Array.from({ length: maxCols }, (_, colIdx) => {
      let maxLen = 12;
      for (const r of aoa) {
        const valLen = String(r[colIdx] ?? '').length;
        if (valLen + 3 > maxLen) maxLen = Math.min(48, valLen + 3);
      }
      return { wch: maxLen };
    });

    const safeName = (sheetSpec.name || `Sheet_${idx + 1}`)
      .replace(/[\\/?*[\]:]/g, ' ')
      .trim()
      .slice(0, 31) || `Sheet_${idx + 1}`;
    XLSX.utils.book_append_sheet(wb, ws, safeName);
  });

  const outArray = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([outArray], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerBlobDownload(blob, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

export interface WordReportOptions {
  filename?: string;
  title: string;
  subtitle?: string;
  kpis?: { label: string; value: string }[];
  breakdown?: { label: string; value: string }[];
  notes?: string[];
  sections?: ReportSectionInput[];
  table?: {
    title?: string;
    headers: string[];
    rows: (string | number)[][];
  };
}

/**
 * Generates and downloads a real Microsoft Word (.docx) document with KPI cards,
 * breakdown key-value tables, prose sections, and data tables.
 */
export async function downloadWordDocument(options: WordReportOptions): Promise<void>;
export async function downloadWordDocument(
  title: string,
  sections: ReportSectionInput[],
  filename?: string
): Promise<void>;
export async function downloadWordDocument(
  arg1: WordReportOptions | string,
  arg2?: ReportSectionInput[],
  arg3?: string
): Promise<void> {
  const options: WordReportOptions =
    typeof arg1 === 'string'
      ? {
          title: arg1,
          sections: arg2 ?? [],
          filename: arg3 || `${arg1.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'report'}.docx`,
        }
      : arg1;

  const {
    filename = `${options.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'report'}.docx`,
    title,
    subtitle,
    kpis = [],
    breakdown = [],
    notes = [],
    sections = [],
    table,
  } = options;

  const children: (Paragraph | Table)[] = [];

  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 100 },
      children: [new TextRun({ text: title, bold: true, size: 32, color: '1E293B' })],
    })
  );

  if (subtitle) {
    children.push(
      new Paragraph({
        spacing: { after: 180 },
        children: [new TextRun({ text: subtitle, size: 20, color: '475569' })],
      })
    );
  }

  const cellBorders = {
    top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
    left: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
    right: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
  };

  if (kpis.length > 0) {
    const kpiRows = kpis.map(
      (k) =>
        new TableRow({
          children: [
            new TableCell({
              borders: cellBorders,
              shading: { fill: 'F1F5F9' },
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: k.label, bold: true, size: 20, color: '334155' })],
                }),
              ],
            }),
            new TableCell({
              borders: cellBorders,
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: k.value, bold: true, size: 22, color: '0F172A' })],
                }),
              ],
            }),
          ],
        })
    );
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: kpiRows }));
    children.push(new Paragraph({ text: '', spacing: { after: 160 } }));
  }

  if (breakdown.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 120, after: 80 },
        children: [new TextRun({ text: 'Calculation Breakdown', bold: true, size: 24, color: '0F172A' })],
      })
    );
    const bRows = breakdown.map(
      (b) =>
        new TableRow({
          children: [
            new TableCell({
              borders: cellBorders,
              margins: { top: 70, bottom: 70, left: 110, right: 110 },
              children: [new Paragraph({ children: [new TextRun({ text: b.label, size: 20 })] })],
            }),
            new TableCell({
              borders: cellBorders,
              margins: { top: 70, bottom: 70, left: 110, right: 110 },
              children: [new Paragraph({ children: [new TextRun({ text: b.value, bold: true, size: 20 })] })],
            }),
          ],
        })
    );
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: bRows }));
    children.push(new Paragraph({ text: '', spacing: { after: 160 } }));
  }

  for (const sec of sections) {
    const secHeading = sec.heading ?? sec.title ?? '';
    if (secHeading) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 120, after: 80 },
          children: [new TextRun({ text: secHeading, bold: true, size: 24, color: '0F172A' })],
        })
      );
    }
    const paragraphs = sec.paragraphs ?? sec.lines ?? (sec.body ? [sec.body] : []);
    for (const para of paragraphs) {
      children.push(
        new Paragraph({
          spacing: { after: 100 },
          children: [new TextRun({ text: para, size: 21, color: '1E293B' })],
        })
      );
    }
  }

  if (table && table.rows.length > 0) {
    if (table.title) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 140, after: 80 },
          children: [new TextRun({ text: table.title, bold: true, size: 24, color: '0F172A' })],
        })
      );
    }
    const headerRow = new TableRow({
      children: table.headers.map(
        (h) =>
          new TableCell({
            borders: cellBorders,
            shading: { fill: '2F3E4E' },
            margins: { top: 80, bottom: 80, left: 100, right: 100 },
            children: [
              new Paragraph({
                children: [new TextRun({ text: String(h), bold: true, size: 19, color: 'FFFFFF' })],
              }),
            ],
          })
      ),
    });
    const dataRows = table.rows.map(
      (r, rIdx) =>
        new TableRow({
          children: r.map(
            (cell) =>
              new TableCell({
                borders: cellBorders,
                shading: rIdx % 2 === 1 ? { fill: 'F8FAFC' } : undefined,
                margins: { top: 65, bottom: 65, left: 100, right: 100 },
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: String(cell ?? ''), size: 19, color: '0F172A' })],
                  }),
                ],
              })
          ),
        })
    );
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [headerRow, ...dataRows],
      })
    );
    children.push(new Paragraph({ text: '', spacing: { after: 160 } }));
  }

  if (notes.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 120, after: 60 },
        children: [new TextRun({ text: 'Notes & Reference', bold: true, size: 22, color: '334155' })],
      })
    );
    for (const note of notes) {
      children.push(
        new Paragraph({
          spacing: { after: 60 },
          children: [new TextRun({ text: `• ${note}`, size: 19, color: '475569' })],
        })
      );
    }
  }

  const doc = new DocxDocument({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  triggerBlobDownload(blob, filename.endsWith('.docx') ? filename : `${filename}.docx`);
}

