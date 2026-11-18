import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import mammoth from 'mammoth';
import PptxGenJS from 'pptxgenjs';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas-pro';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface RawTextToken {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName: string;
}

export interface ExtractedLine {
  y: number;
  tokens: RawTextToken[];
  text: string;
  avgHeight: number;
  isBold: boolean;
  columns: string[];
}

export interface ExtractedPdfPage {
  pageNumber: number;
  width: number;
  height: number;
  lines: ExtractedLine[];
  rawText: string;
}

export async function extractStructuredPdfContent(
  buffer: ArrayBuffer,
  onProgress?: (current: number, total: number) => void
): Promise<ExtractedPdfPage[]> {
  const loadingTask = pdfjsLib.getDocument({ data: buffer.slice(0) });
  const pdfDoc = await loadingTask.promise;
  const total = pdfDoc.numPages;
  const pages: ExtractedPdfPage[] = [];

  for (let p = 1; p <= total; p++) {
    onProgress?.(p, total);
    const page = await pdfDoc.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();

    const tokens: RawTextToken[] = [];
    for (const item of textContent.items as any[]) {
      if (!item || typeof item.str !== 'string') continue;
      const trimmed = item.str;
      if (!trimmed.trim()) continue;
      const tx = item.transform || [1, 0, 0, 1, 0, 0];
      const fontSize = Math.max(6, Math.hypot(tx[0], tx[1]) || item.height || 10);
      tokens.push({
        str: trimmed,
        x: tx[4] ?? 0,
        y: viewport.height - (tx[5] ?? 0),
        width: item.width || trimmed.length * fontSize * 0.5,
        height: fontSize,
        fontName: String(item.fontName || ''),
      });
    }

    // Group tokens into horizontal lines by Y coordinate
    tokens.sort((a, b) => a.y - b.y || a.x - b.x);
    const lineGroups: RawTextToken[][] = [];
    for (const tok of tokens) {
      const lastGroup = lineGroups[lineGroups.length - 1];
      if (lastGroup && Math.abs(lastGroup[0].y - tok.y) <= Math.max(4, tok.height * 0.45)) {
        lastGroup.push(tok);
      } else {
        lineGroups.push([tok]);
      }
    }

    const lines: ExtractedLine[] = lineGroups.map((group) => {
      group.sort((a, b) => a.x - b.x);
      const avgHeight =
        group.reduce((sum, t) => sum + t.height, 0) / Math.max(1, group.length);
      const isBold = group.some((t) => /bold|black|heavy|demi/i.test(t.fontName));

      // Split into columns where horizontal gap exceeds ~16px or 1.4x font size
      const columns: string[] = [];
      let currentCol = '';
      let prevRight = group[0]?.x ?? 0;

      let fullText = '';
      for (let i = 0; i < group.length; i++) {
        const t = group[i];
        const gap = i === 0 ? 0 : t.x - prevRight;
        if (i > 0 && gap > Math.max(18, avgHeight * 1.6)) {
          if (currentCol.trim()) columns.push(currentCol.trim());
          currentCol = t.str;
          fullText += '  ' + t.str;
        } else {
          const needsSpace = i > 0 && gap > Math.max(2, avgHeight * 0.18);
          currentCol += (needsSpace ? ' ' : '') + t.str;
          fullText += (needsSpace ? ' ' : '') + t.str;
        }
        prevRight = t.x + t.width;
      }
      if (currentCol.trim()) columns.push(currentCol.trim());

      return {
        y: group[0].y,
        tokens: group,
        text: fullText.trim(),
        avgHeight,
        isBold,
        columns,
      };
    });

    pages.push({
      pageNumber: p,
      width: viewport.width,
      height: viewport.height,
      lines,
      rawText: lines.map((l) => l.text).join('\n'),
    });
  }

  return pages;
}

export async function convertPdfToDocx(
  buffer: ArrayBuffer,
  onProgress?: (current: number, total: number) => void
): Promise<{ blob: Blob; pages: ExtractedPdfPage[]; tableCount: number }> {
  const pages = await extractStructuredPdfContent(buffer, onProgress);

  // Determine median body font height across document
  const allHeights = pages.flatMap((p) => p.lines.map((l) => l.avgHeight)).sort((a, b) => a - b);
  const medianHeight = allHeights.length ? allHeights[Math.floor(allHeights.length / 2)] : 11;

  const children: (Paragraph | Table)[] = [];
  let tableCount = 0;

  pages.forEach((page, pageIdx) => {
    if (pageIdx > 0) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }

    let i = 0;
    while (i < page.lines.length) {
      const line = page.lines[i];

      // Detect contiguous multi-column table block (>= 2 adjacent rows with >= 2 columns)
      if (line.columns.length >= 2) {
        const tableLines: ExtractedLine[] = [line];
        let j = i + 1;
        while (j < page.lines.length && page.lines[j].columns.length >= 2) {
          tableLines.push(page.lines[j]);
          j++;
        }

        if (tableLines.length >= 2) {
          tableCount++;
          const maxCols = Math.max(...tableLines.map((tl) => tl.columns.length));
          const rows = tableLines.map((tl, rowIdx) => {
            const cells = Array.from({ length: maxCols }, (_, colIdx) => {
              const cellText = tl.columns[colIdx] || '';
              return new TableCell({
                shading: rowIdx === 0 ? { fill: 'F3F4F6' } : undefined,
                margins: { top: 80, bottom: 80, left: 110, right: 110 },
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                  bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                  left: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                  right: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: cellText,
                        bold: rowIdx === 0 || tl.isBold,
                        size: 20,
                      }),
                    ],
                  }),
                ],
              });
            });
            return new TableRow({ children: cells });
          });

          children.push(
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows,
            })
          );
          children.push(new Paragraph({ text: '', spacing: { after: 120 } }));
          i = j;
          continue;
        }
      }

      const isHeading1 = line.avgHeight >= medianHeight * 1.45 && line.text.length < 120;
      const isHeading2 =
        !isHeading1 &&
        ((line.avgHeight >= medianHeight * 1.18 && line.text.length < 140) ||
          (line.isBold && line.text.length < 90));

      const fontSizeHalfPt = Math.min(48, Math.max(18, Math.round(line.avgHeight * 1.9)));

      children.push(
        new Paragraph({
          heading: isHeading1
            ? HeadingLevel.HEADING_1
            : isHeading2
            ? HeadingLevel.HEADING_2
            : undefined,
          spacing: { after: isHeading1 || isHeading2 ? 160 : 100 },
          alignment: AlignmentType.LEFT,
          children: [
            new TextRun({
              text: line.text,
              bold: line.isBold || isHeading1 || isHeading2,
              size: isHeading1 || isHeading2 ? fontSizeHalfPt : 22,
            }),
          ],
        })
      );
      i++;
    }
  });

  if (children.length === 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'No selectable text was found in this PDF (it may be a scanned image PDF).',
          }),
        ],
      })
    );
  }

  const doc = new Document({
    sections: [{ children }],
  });

  const blob = await Packer.toBlob(doc);
  return { blob, pages, tableCount };
}

export async function convertDocxToHtmlAndPdf(
  buffer: ArrayBuffer
): Promise<{ html: string; pdfBlob: Blob; pageCount: number }> {
  const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
  const html = result.value || '<p>(Empty document)</p>';

  const pdfBlob = await renderHtmlToPdfBlob(html);
  const pageCount = Math.max(1, Math.ceil(html.length / 2600));
  return { html, pdfBlob, pageCount };
}

export async function renderHtmlToPdfBlob(rawHtml: string): Promise<Blob> {
  // Strip unsafe script tags before rendering in DOM
  const safeHtml = rawHtml
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '');

  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-99999px';
  host.style.top = '0';
  host.style.width = '794px';
  host.style.background = '#FFFFFF';
  host.style.color = '#111827';
  host.style.padding = '48px 52px';
  host.style.fontFamily = "'DM Sans', system-ui, -apple-system, sans-serif";
  host.style.fontSize = '13.5px';
  host.style.lineHeight = '1.6';
  host.innerHTML = `
    <style>
      .vcpl-doc-render h1 { font-size: 22px; font-weight: 700; margin: 0 0 12px; color: #0F172A; }
      .vcpl-doc-render h2 { font-size: 17px; font-weight: 700; margin: 18px 0 8px; color: #1E293B; }
      .vcpl-doc-render h3 { font-size: 14.5px; font-weight: 700; margin: 14px 0 6px; color: #1E293B; }
      .vcpl-doc-render p { margin: 0 0 10px; }
      .vcpl-doc-render ul, .vcpl-doc-render ol { margin: 0 0 12px 22px; }
      .vcpl-doc-render li { margin-bottom: 4px; }
      .vcpl-doc-render table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }
      .vcpl-doc-render th, .vcpl-doc-render td { border: 1px solid #CBD5E1; padding: 6px 8px; text-align: left; }
      .vcpl-doc-render th { background: #F1F5F9; font-weight: 700; }
      .vcpl-doc-render img { max-width: 100%; height: auto; }
    </style>
    <div class="vcpl-doc-render">${safeHtml}</div>
  `;
  document.body.appendChild(host);

  try {
    const canvas = await html2canvas(host, {
      scale: 2,
      backgroundColor: '#FFFFFF',
      useCORS: true,
      logging: false,
    });

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const totalImgHeight = (canvas.height * imgWidth) / canvas.width;

    // Slice rendered canvas into clean A4 page strips
    const pageCanvas = document.createElement('canvas');
    const pxPerPage = Math.floor((pageHeight / totalImgHeight) * canvas.height);
    const totalPages = Math.max(1, Math.ceil(canvas.height / Math.max(1, pxPerPage)));

    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      const srcY = pageIdx * pxPerPage;
      const sliceH = Math.min(pxPerPage, canvas.height - srcY);
      if (sliceH <= 0) break;

      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceH;
      const ctx = pageCanvas.getContext('2d');
      if (!ctx) continue;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      ctx.drawImage(canvas, 0, srcY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

      const sliceData = pageCanvas.toDataURL('image/jpeg', 0.94);
      const renderedSliceHeight = (sliceH * imgWidth) / canvas.width;
      if (pageIdx > 0) pdf.addPage();
      pdf.addImage(sliceData, 'JPEG', 0, 0, imgWidth, renderedSliceHeight);
    }

    return pdf.output('blob');
  } finally {
    document.body.removeChild(host);
  }
}

export async function convertPdfToExcelBlob(
  buffer: ArrayBuffer,
  onProgress?: (current: number, total: number) => void
): Promise<{ blob: Blob; previewRows: string[][]; sheetCount: number; rowCount: number }> {
  const pages = await extractStructuredPdfContent(buffer, onProgress);
  const workbook = XLSX.utils.book_new();
  const combinedRows: string[][] = [];

  pages.forEach((page) => {
    const sheetRows: string[][] = page.lines.map((line) =>
      line.columns.length > 0 ? line.columns : [line.text]
    );
    const sheet = XLSX.utils.aoa_to_sheet(sheetRows.length ? sheetRows : [['(Empty page)']]);
    XLSX.utils.book_append_sheet(workbook, sheet, `Page_${page.pageNumber}`);
    sheetRows.forEach((r) => combinedRows.push(r));
  });

  if (pages.length > 1) {
    const allSheet = XLSX.utils.aoa_to_sheet(combinedRows.length ? combinedRows : [['No data']]);
    XLSX.utils.book_append_sheet(workbook, allSheet, 'All_Pages');
  }

  const outArray = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([outArray], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  return {
    blob,
    previewRows: combinedRows.slice(0, 25),
    sheetCount: workbook.SheetNames.length,
    rowCount: combinedRows.length,
  };
}

export async function convertExcelToPdfBlob(buffer: ArrayBuffer): Promise<{
  blob: Blob;
  sheetNames: string[];
  previewRows: string[][];
}> {
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheetNames = wb.SheetNames;
  const firstSheet = wb.Sheets[sheetNames[0]];
  const previewRows = firstSheet
    ? (XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' }) as string[][]).slice(0, 15)
    : [];

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 36;

  sheetNames.forEach((name, sIdx) => {
    if (sIdx > 0) pdf.addPage();
    const ws = wb.Sheets[name];
    const rows = (XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][]).map((r) =>
      r.map((cell) => String(cell ?? ''))
    );

    let cursorY = margin;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.setTextColor(47, 62, 78);
    pdf.text(`Sheet: ${name}`, margin, cursorY);
    cursorY += 20;

    const maxCols = Math.max(1, Math.min(10, ...rows.map((r) => r.length)));
    const colWidth = (pageWidth - margin * 2) / maxCols;
    const rowHeight = 20;

    rows.forEach((row, rIdx) => {
      if (cursorY + rowHeight > pageHeight - margin) {
        pdf.addPage();
        cursorY = margin;
      }

      if (rIdx === 0) {
        pdf.setFillColor(47, 62, 78);
        pdf.rect(margin, cursorY, pageWidth - margin * 2, rowHeight, 'F');
        pdf.setTextColor(255, 253, 245);
        pdf.setFont('helvetica', 'bold');
      } else {
        if (rIdx % 2 === 0) {
          pdf.setFillColor(248, 250, 252);
          pdf.rect(margin, cursorY, pageWidth - margin * 2, rowHeight, 'F');
        }
        pdf.setTextColor(30, 41, 59);
        pdf.setFont('helvetica', 'normal');
      }

      pdf.setDrawColor(203, 213, 225);
      pdf.setFontSize(8.5);

      for (let c = 0; c < maxCols; c++) {
        const cellX = margin + c * colWidth;
        pdf.rect(cellX, cursorY, colWidth, rowHeight, 'S');
        const text = String(row[c] ?? '').slice(0, 28);
        pdf.text(text, cellX + 4, cursorY + 13);
      }

      cursorY += rowHeight;
    });
  });

  return {
    blob: pdf.output('blob'),
    sheetNames,
    previewRows: previewRows.map((r) => r.map((c) => String(c ?? ''))),
  };
}

export async function convertPdfToPptxBlob(
  buffer: ArrayBuffer,
  onProgress?: (current: number, total: number) => void
): Promise<{ blob: Blob; slideCount: number }> {
  const loadingTask = pdfjsLib.getDocument({ data: buffer.slice(0) });
  const pdfDoc = await loadingTask.promise;
  const total = pdfDoc.numPages;

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';

  for (let p = 1; p <= total; p++) {
    onProgress?.(p, total);
    const page = await pdfDoc.getPage(p);
    const viewport = page.getViewport({ scale: 1.8 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx as any, canvas, viewport } as any).promise;

    const imgData = canvas.toDataURL('image/png');
    const textContent = await page.getTextContent();
    const notesText = (textContent.items as any[])
      .map((item) => item?.str || '')
      .join(' ')
      .trim();

    const slide = pptx.addSlide();
    const slideW = 10;
    const slideH = 5.625;
    const ratio = Math.min(slideW / canvas.width, slideH / canvas.height);
    const w = canvas.width * ratio;
    const h = canvas.height * ratio;
    slide.addImage({
      data: imgData,
      x: (slideW - w) / 2,
      y: (slideH - h) / 2,
      w,
      h,
    });
    if (notesText) {
      slide.addNotes(notesText);
    }
  }

  const out = await pptx.write({ outputType: 'blob' });
  return { blob: out as Blob, slideCount: total };
}

export async function convertPdfToTextFormats(
  buffer: ArrayBuffer,
  format: 'txt' | 'html' | 'csv' | 'rtf',
  onProgress?: (current: number, total: number) => void
): Promise<{ blob: Blob; previewText: string; pageCount: number }> {
  const pages = await extractStructuredPdfContent(buffer, onProgress);

  if (format === 'txt') {
    const text = pages
      .map((p) => `--- Page ${p.pageNumber} ---\n${p.rawText}`)
      .join('\n\n');
    return {
      blob: new Blob([text], { type: 'text/plain;charset=utf-8' }),
      previewText: text,
      pageCount: pages.length,
    };
  }

  if (format === 'csv') {
    const escapeCsv = (val: string) =>
      /[",\n]/.test(val) ? `"${val.replace(/"/g, '""')}"` : val;
    const csvLines: string[] = [];
    pages.forEach((p) => {
      p.lines.forEach((line) => {
        const cols = line.columns.length ? line.columns : [line.text];
        csvLines.push(cols.map(escapeCsv).join(','));
      });
    });
    const csv = csvLines.join('\r\n');
    return {
      blob: new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }),
      previewText: csv,
      pageCount: pages.length,
    };
  }

  if (format === 'rtf') {
    const escapeRtf = (str: string) =>
      str
        .replace(/\\/g, '\\\\')
        .replace(/\{/g, '\\{')
        .replace(/\}/g, '\\}')
        .replace(/[^\x20-\x7E]/g, (ch) => `\\u${ch.charCodeAt(0)}?`);
    const body = pages
      .map(
        (p) =>
          `{\\b --- Page ${p.pageNumber} ---}\\par\n` +
          p.lines.map((l) => `${escapeRtf(l.text)}\\par`).join('\n')
      )
      .join('\n\\page\n');
    const rtf = `{\\rtf1\\ansi\\deff0\n{\\fonttbl{\\f0 Arial;}}\n\\fs22\n${body}\n}`;
    return {
      blob: new Blob([rtf], { type: 'application/rtf' }),
      previewText: pages.map((p) => p.rawText).join('\n\n'),
      pageCount: pages.length,
    };
  }

  // HTML
  const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const sections = pages
    .map(
      (p) =>
        `<section data-page="${p.pageNumber}" style="margin-bottom:2rem;">\n` +
        p.lines
          .map((l) =>
            l.isBold
              ? `  <h3>${escapeHtml(l.text)}</h3>`
              : `  <p>${escapeHtml(l.text)}</p>`
          )
          .join('\n') +
        `\n</section>`
    )
    .join('\n');
  const html = `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8" />\n  <title>Converted PDF Document</title>\n  <style>body{font-family:system-ui,sans-serif;max-width:820px;margin:2rem auto;padding:0 1rem;line-height:1.6;color:#1e293b;}</style>\n</head>\n<body>\n${sections}\n</body>\n</html>`;

  return {
    blob: new Blob([html], { type: 'text/html;charset=utf-8' }),
    previewText: html,
    pageCount: pages.length,
  };
}
