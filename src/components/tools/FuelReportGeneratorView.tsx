import React, { useMemo, useRef, useState } from 'react';
import ExcelJS from 'exceljs';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import * as XLSX from 'xlsx';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Fuel,
  HardDrive,
  Info,
  RotateCcw,
  Search,
  Upload,
} from 'lucide-react';
import { ToolCatalogItem } from '../../types/tools';
import { useFileDrop } from './FileDropZone';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface FuelReportGeneratorViewProps {
  tool?: ToolCatalogItem;
  onBack?: () => void;
}

interface ColumnDef {
  header: string;
  source: string | null;
  width: number;
  kind: 'sno' | 'int' | 'text' | 'num';
}

const COLUMNS: ColumnDef[] = [
  { header: 'SNo.', source: null, width: 7.1, kind: 'sno' },
  { header: 'Terminal ID', source: 'Terminal ID', width: 15.9, kind: 'int' },
  { header: 'Merchant ID', source: 'Merchant ID', width: 16.3, kind: 'int' },
  { header: 'Merchant Name', source: 'Merchant Name', width: 36.8, kind: 'text' },
  { header: 'Merchant PAN', source: 'Merchant PAN', width: 15, kind: 'text' },
  { header: 'Merchant State', source: 'Merchant State', width: 15.9, kind: 'text' },
  { header: 'Location', source: 'Location', width: 40.8, kind: 'text' },
  { header: 'Customer ID/Card PAN', source: 'Customer ID/Card PAN', width: 28.1, kind: 'text' },
  { header: 'Name of Card Holder', source: 'Name of Card Holder', width: 20.7, kind: 'text' },
  { header: 'Txn ID', source: 'Txn ID', width: 13, kind: 'int' },
  { header: ' Txn Date', source: 'Txn Date', width: 20.3, kind: 'text' },
  { header: 'Txn Type', source: 'Txn Type', width: 10.4, kind: 'text' },
  { header: 'Txn Mode', source: 'Txn Mode', width: 11.3, kind: 'text' },
  { header: 'Txn Mode Value', source: 'Txn Mode Value', width: 20.9, kind: 'text' },
  { header: 'Product', source: 'Product', width: 9.6, kind: 'text' },
  { header: 'Currency', source: 'Currency', width: 10.4, kind: 'text' },
  { header: 'Price', source: 'RSP', width: 8.6, kind: 'num' },
  { header: 'Quantity', source: 'Quantity', width: 11.6, kind: 'num' },
  { header: 'Amount', source: 'Amount', width: 13.3, kind: 'num' },
];

const EXCEL_NUM_FMT = '_ * #,##0.00_ ;_ * \\-#,##0.00_ ;_ * "-"??_ ;_ @_ ';
const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

interface FuelSaleRow {
  sno: number;
  terminalId: number | null;
  merchantId: number | null;
  merchantName: string;
  merchantPan: string;
  merchantState: string;
  location: string;
  customerCardPan: string;
  cardHolderName: string;
  txnId: number | null;
  txnDateText: string;
  txnDateObj: Date | null;
  txnType: string;
  txnMode: string;
  txnModeValue: string;
  product: string;
  currency: string;
  price: number;
  quantity: number;
  amount: number;
  status: string;
  hasBlankPrice: boolean;
  hasBlankQty: boolean;
  hasBlankAmount: boolean;
}

interface ProductBreakdown {
  product: string;
  count: number;
  quantity: number;
  amount: number;
}

interface PdfCheckState {
  fileName: string;
  ccmsSale: number | null;
  opBal: number | null;
  recharge: number | null;
  matched: boolean | null;
  diff: number | null;
  message: string;
}

interface PdfParsedResult {
  fileName: string;
  report: ParsedFuelReport;
  ccmsSale: number | null;
  opBal: number | null;
  recharge: number | null;
}

interface ParsedFuelReport {
  fileName: string;
  sourceKind: 'excel' | 'pdf';
  label: string;
  outputFileName: string;
  periodText: string;
  startDate: Date;
  endDate: Date;
  totalSourceRows: number;
  typeCounts: Array<{ type: string; count: number }>;
  sales: FuelSaleRow[];
  products: ProductBreakdown[];
  totalQuantity: number;
  totalAmount: number;
  issues: string[];
  notes: string[];
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function formatInr(n: number, decimals = 2): string {
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatDateDmy(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatMonthLabel(d: Date): string {
  const mon = MONTHS_SHORT[d.getMonth()] ?? 'Jan';
  const yy = String(d.getFullYear()).slice(-2);
  return `${mon}'${yy}`;
}

function parseDmyString(raw: string): Date | null {
  const trimmed = raw.trim();
  const m = trimmed.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]) - 1;
  const year = Number(m[3]);
  const hour = Number(m[4] ?? 0);
  const min = Number(m[5] ?? 0);
  const sec = Number(m[6] ?? 0);
  const d = new Date(year, month, day, hour, min, sec);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseTxnDate(rawVal: unknown, formattedVal: string): { text: string; date: Date | null } {
  if (rawVal instanceof Date && !Number.isNaN(rawVal.getTime())) {
    return { text: formattedVal || formatDateDmy(rawVal), date: rawVal };
  }
  if (typeof rawVal === 'number' && Number.isFinite(rawVal) && rawVal > 20000) {
    const parsed = XLSX.SSF.parse_date_code(rawVal);
    if (parsed) {
      const d = new Date(
        parsed.y,
        (parsed.m || 1) - 1,
        parsed.d || 1,
        parsed.H || 0,
        parsed.M || 0,
        Math.floor(parsed.S || 0)
      );
      const timeStr = `${String(parsed.H || 0).padStart(2, '0')}:${String(parsed.M || 0).padStart(2, '0')}:${String(Math.floor(parsed.S || 0)).padStart(2, '0')}`;
      return {
        text: formattedVal || `${formatDateDmy(d)} ${timeStr}`,
        date: d,
      };
    }
  }
  const str = String(formattedVal || rawVal || '').trim();
  return { text: str, date: parseDmyString(str) };
}

function readSheetGrid(sheet: XLSX.WorkSheet): Array<Array<{ raw: unknown; text: string }>> {
  const ref = sheet['!ref'];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const rows: Array<Array<{ raw: unknown; text: string }>> = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: Array<{ raw: unknown; text: string }> = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[addr] as XLSX.CellObject | undefined;
      if (!cell) {
        row.push({ raw: null, text: '' });
      } else {
        const raw = cell.v ?? null;
        const text =
          cell.w !== undefined && cell.w !== null
            ? String(cell.w).trim()
            : raw !== null
              ? String(raw).trim()
              : '';
        row.push({ raw, text });
      }
    }
    rows.push(row);
  }
  return rows;
}

function toFiniteNumber(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  const cleaned = String(val).replace(/,/g, '').trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseIoclWorkbook(fileName: string, buffer: ArrayBuffer): ParsedFuelReport {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('The uploaded workbook contains no worksheets.');
  }
  const grid = readSheetGrid(wb.Sheets[firstSheetName]);
  if (!grid.length) {
    throw new Error('The first worksheet is empty.');
  }

  let headerRowIdx = -1;
  const maxScan = Math.min(grid.length, 40);
  for (let i = 0; i < maxScan; i++) {
    const labels = grid[i].map((c) => c.text);
    if (labels.includes('Txn Type') && labels.includes('Amount')) {
      headerRowIdx = i;
      break;
    }
  }
  if (headerRowIdx === -1) {
    throw new Error(
      'Could not locate the header row containing "Txn Type" and "Amount". Please upload an IOCL Easy Fuel Customer Transaction Details Excel file.'
    );
  }

  let periodText = '';
  for (let i = 0; i < headerRowIdx; i++) {
    for (const cell of grid[i]) {
      if (cell.text.includes('Period')) {
        periodText = cell.text;
        break;
      }
    }
    if (periodText) break;
  }

  const colIndexByName = new Map<string, number>();
  grid[headerRowIdx].forEach((cell, idx) => {
    const name = cell.text;
    if (name && !colIndexByName.has(name)) {
      colIndexByName.set(name, idx);
    }
  });

  const snoIdx = colIndexByName.get('SNo.');
  if (snoIdx === undefined) {
    throw new Error('Header row is missing the "SNo." column.');
  }

  const getCell = (row: Array<{ raw: unknown; text: string }>, colName: string) => {
    const idx = colIndexByName.get(colName);
    return idx !== undefined ? row[idx] : { raw: null, text: '' };
  };

  const validRows: Array<Array<{ raw: unknown; text: string }>> = [];
  const typeCountMap = new Map<string, number>();

  for (let i = headerRowIdx + 1; i < grid.length; i++) {
    const row = grid[i];
    const hasAny = row.some((c) => c.raw !== null && String(c.raw).trim() !== '');
    if (!hasAny) continue;

    const snoNum = toFiniteNumber(row[snoIdx]?.raw ?? row[snoIdx]?.text);
    if (snoNum === null) continue; // drop footers/totals

    validRows.push(row);
    const txnType = String(getCell(row, 'Txn Type').raw ?? getCell(row, 'Txn Type').text ?? '').trim() || 'Blank';
    typeCountMap.set(txnType, (typeCountMap.get(txnType) ?? 0) + 1);
  }

  const salesRaw = validRows.filter((row) => {
    const t = String(getCell(row, 'Txn Type').raw ?? getCell(row, 'Txn Type').text ?? '').trim();
    return t === 'Sale';
  });

  if (salesRaw.length === 0) {
    throw new Error('No rows with Txn Type = "Sale" were found in this workbook.');
  }

  const mappedSales: FuelSaleRow[] = salesRaw.map((row) => {
    const getText = (name: string) => {
      const c = getCell(row, name);
      if (c.raw === null || c.raw === undefined) return '';
      if (typeof c.raw === 'number') {
        // Keep exact formatted text when available for long 16-digit PAN / card numbers
        return c.text || String(c.raw);
      }
      return String(c.raw).trim();
    };

    const terminalId = toFiniteNumber(getCell(row, 'Terminal ID').raw);
    const merchantId = toFiniteNumber(getCell(row, 'Merchant ID').raw);
    const txnId = toFiniteNumber(getCell(row, 'Txn ID').raw);
    const dateCell = getCell(row, 'Txn Date');
    const parsedDate = parseTxnDate(dateCell.raw, dateCell.text);

    const priceNum = toFiniteNumber(getCell(row, 'RSP').raw);
    const qtyNum = toFiniteNumber(getCell(row, 'Quantity').raw);
    const amtNum = toFiniteNumber(getCell(row, 'Amount').raw);

    return {
      sno: 0,
      terminalId: terminalId !== null ? Math.trunc(terminalId) : null,
      merchantId: merchantId !== null ? Math.trunc(merchantId) : null,
      merchantName: getText('Merchant Name'),
      merchantPan: getText('Merchant PAN'),
      merchantState: getText('Merchant State'),
      location: getText('Location'),
      customerCardPan: getText('Customer ID/Card PAN'),
      cardHolderName: getText('Name of Card Holder'),
      txnId: txnId !== null ? Math.trunc(txnId) : null,
      txnDateText: parsedDate.text,
      txnDateObj: parsedDate.date,
      txnType: getText('Txn Type'),
      txnMode: getText('Txn Mode'),
      txnModeValue: getText('Txn Mode Value'),
      product: getText('Product').toUpperCase(),
      currency: getText('Currency'),
      price: priceNum ?? 0,
      quantity: qtyNum ?? 0,
      amount: amtNum ?? 0,
      status: getText('Status'),
      hasBlankPrice: priceNum === null,
      hasBlankQty: qtyNum === null,
      hasBlankAmount: amtNum === null,
    };
  });

  // Sort by Txn ID ascending (oldest first) and renumber SNo. 1..N
  mappedSales.sort((a, b) => (a.txnId ?? 0) - (b.txnId ?? 0));
  mappedSales.forEach((row, idx) => {
    row.sno = idx + 1;
  });

  // Determine statement period (from Period line or min/max Txn Date)
  let startDate: Date | null = null;
  let endDate: Date | null = null;
  const pm = periodText.match(/(\d{2}\/\d{2}\/\d{4})\s*To\s*(\d{2}\/\d{2}\/\d{4})/i);
  if (pm) {
    startDate = parseDmyString(pm[1]);
    endDate = parseDmyString(pm[2]);
  }
  if (!startDate || !endDate) {
    const dates = mappedSales
      .map((s) => s.txnDateObj)
      .filter((d): d is Date => d !== null)
      .sort((a, b) => a.getTime() - b.getTime());
    if (dates.length > 0) {
      startDate = new Date(dates[0].getFullYear(), dates[0].getMonth(), dates[0].getDate());
      const lastD = dates[dates.length - 1];
      endDate = new Date(lastD.getFullYear(), lastD.getMonth(), lastD.getDate());
    } else {
      const now = new Date();
      startDate = now;
      endDate = now;
    }
  }

  const label = formatMonthLabel(startDate);
  const outputFileName = `${label.replace("'", ' ')} - report.xlsx`;

  // Product summary: PETROL, DIESEL first, then alphabetical
  const prodMap = new Map<string, { count: number; quantity: number; amount: number }>();
  for (const s of mappedSales) {
    const pKey = s.product || 'UNKNOWN';
    const cur = prodMap.get(pKey) ?? { count: 0, quantity: 0, amount: 0 };
    cur.count += 1;
    cur.quantity += s.quantity;
    cur.amount += s.amount;
    prodMap.set(pKey, cur);
  }
  const foundProds = Array.from(prodMap.keys());
  const orderedProds = [
    ...['PETROL', 'DIESEL'].filter((p) => foundProds.includes(p)),
    ...foundProds.filter((p) => p !== 'PETROL' && p !== 'DIESEL').sort(),
  ];
  const products: ProductBreakdown[] = orderedProds.map((p) => {
    const stats = prodMap.get(p)!;
    return {
      product: p,
      count: stats.count,
      quantity: round2(stats.quantity),
      amount: round2(stats.amount),
    };
  });

  const totalQuantity = round2(mappedSales.reduce((acc, s) => acc + s.quantity, 0));
  const totalAmount = round2(mappedSales.reduce((acc, s) => acc + s.amount, 0));

  // Sanity checks (mirroring run_checks in fuel_report.py)
  const issues: string[] = [];
  const notes: string[] = [];

  const seenIds = new Set<number>();
  const dupIds: number[] = [];
  for (const s of mappedSales) {
    if (s.txnId !== null) {
      if (seenIds.has(s.txnId)) dupIds.push(s.txnId);
      seenIds.add(s.txnId);
    }
  }
  if (dupIds.length > 0) {
    issues.push(`Duplicate Txn IDs: ${dupIds.join(', ')}`);
  }

  if (colIndexByName.has('Status')) {
    const badStatus = mappedSales.filter((s) => s.status !== 'PT');
    if (badStatus.length > 0) {
      issues.push(
        `${badStatus.length} sale(s) with Status other than PT: ${badStatus.map((s) => s.txnId ?? '?').join(', ')}`
      );
    }
  }

  const blankMerch = mappedSales.filter((s) => !s.merchantName).length;
  const blankHolder = mappedSales.filter((s) => !s.cardHolderName).length;
  const blankProd = mappedSales.filter((s) => !s.product).length;
  const blankPrice = mappedSales.filter((s) => s.hasBlankPrice).length;
  const blankQty = mappedSales.filter((s) => s.hasBlankQty).length;
  const blankAmt = mappedSales.filter((s) => s.hasBlankAmount).length;
  if (blankMerch) issues.push(`${blankMerch} sale(s) with blank 'Merchant Name'`);
  if (blankHolder) issues.push(`${blankHolder} sale(s) with blank 'Name of Card Holder'`);
  if (blankProd) issues.push(`${blankProd} sale(s) with blank 'Product'`);
  if (blankQty) issues.push(`${blankQty} sale(s) with blank 'Quantity'`);
  if (blankPrice) issues.push(`${blankPrice} sale(s) with blank 'RSP'`);
  if (blankAmt) issues.push(`${blankAmt} sale(s) with blank 'Amount'`);

  const mathOff = mappedSales.filter((s) => Math.abs(s.quantity * s.price - s.amount) > 1.0);
  if (mathOff.length > 0) {
    issues.push(
      `${mathOff.length} sale(s) where Qty × Price differs from Amount by > ₹1: ${mathOff.map((s) => s.txnId ?? '?').join(', ')}`
    );
  }

  const endExclusive = new Date(
    endDate.getFullYear(),
    endDate.getMonth(),
    endDate.getDate() + 1
  ).getTime();
  const startFloor = new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate()
  ).getTime();
  const outOfRange = mappedSales.filter((s) => {
    if (!s.txnDateObj) return false;
    const t = s.txnDateObj.getTime();
    return t < startFloor || t >= endExclusive;
  });
  if (outOfRange.length > 0) {
    issues.push(`${outOfRange.length} sale(s) dated outside the statement period`);
  }

  const extraProducts = foundProds.filter((p) => p !== 'PETROL' && p !== 'DIESEL').sort();
  if (extraProducts.length > 0) {
    notes.push(`Extra product(s) found and added to summary: ${extraProducts.join(', ')}`);
  }

  const typeCounts = Array.from(typeCountMap.entries()).map(([type, count]) => ({
    type,
    count,
  }));

  return {
    fileName,
    sourceKind: 'excel',
    label,
    outputFileName,
    periodText,
    startDate,
    endDate,
    totalSourceRows: validRows.length,
    typeCounts,
    sales: mappedSales,
    products,
    totalQuantity,
    totalAmount,
    issues,
    notes,
  };
}

function buildProductsSummary(sales: FuelSaleRow[]): ProductBreakdown[] {
  const prodMap = new Map<string, { count: number; quantity: number; amount: number }>();
  for (const s of sales) {
    const pKey = s.product || 'FUEL';
    const cur = prodMap.get(pKey) ?? { count: 0, quantity: 0, amount: 0 };
    cur.count += 1;
    cur.quantity += s.quantity;
    cur.amount += s.amount;
    prodMap.set(pKey, cur);
  }
  const foundProds = Array.from(prodMap.keys());
  const orderedProds = [
    ...['PETROL', 'DIESEL'].filter((p) => foundProds.includes(p)),
    ...foundProds.filter((p) => p !== 'PETROL' && p !== 'DIESEL').sort(),
  ];
  return orderedProds.map((p) => {
    const stats = prodMap.get(p)!;
    return {
      product: p,
      count: stats.count,
      quantity: round2(stats.quantity),
      amount: round2(stats.amount),
    };
  });
}

function normalizeProductName(raw: string): string {
  const up = raw.trim().toUpperCase();
  if (!up) return 'FUEL';
  if (up === 'MS' || up.includes('PETROL') || up.includes('XP95') || up.includes('XP100')) {
    return up.includes('XP') ? up : 'PETROL';
  }
  if (up === 'HSD' || up.includes('DIESEL') || up.includes('XTRAMILE')) {
    return 'DIESEL';
  }
  if (up.includes('CNG')) return 'CNG';
  return up;
}

interface PdfTextAtom {
  x: number;
  y: number;
  str: string;
}

interface PdfLine {
  y: number;
  atoms: PdfTextAtom[];
  text: string;
}

function clusterPdfPageLines(atoms: PdfTextAtom[]): PdfLine[] {
  const clean = atoms.filter((a) => a.str.trim() !== '');
  clean.sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: PdfLine[] = [];
  for (const atom of clean) {
    const prev = lines[lines.length - 1];
    if (prev && Math.abs(prev.y - atom.y) <= 2.8) {
      prev.atoms.push(atom);
    } else {
      lines.push({ y: atom.y, atoms: [atom], text: '' });
    }
  }
  for (const line of lines) {
    line.atoms.sort((a, b) => a.x - b.x);
    line.text = line.atoms
      .map((a) => a.str.trim())
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return lines;
}

function parseTrailingNumericTokens(lineText: string): { nums: number[]; prefix: string } {
  const tokens = lineText.trim().split(/\s+/);
  const trailing: number[] = [];
  let idx = tokens.length - 1;
  while (idx >= 0 && trailing.length < 4) {
    const clean = tokens[idx].replace(/^(?:₹|Rs\.?|INR)\s*/i, '').replace(/,/g, '');
    if (/^\d+(?:\.\d{1,4})?$/.test(clean)) {
      trailing.unshift(Number(clean));
      idx -= 1;
    } else {
      break;
    }
  }
  return { nums: trailing, prefix: tokens.slice(0, idx + 1).join(' ') };
}

async function parseIoclStatementPdf(file: File): Promise<PdfParsedResult> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf.slice(0) }).promise;

  let periodText = '';
  let startDate: Date | null = null;
  let endDate: Date | null = null;
  let ccmsSale: number | null = null;
  let opBal: number | null = null;
  let recharge: number | null = null;

  const pageLinesList: PdfLine[][] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    const atoms: PdfTextAtom[] = [];
    for (const item of tc.items) {
      if ('str' in item && 'transform' in item) {
        atoms.push({
          x: Number(item.transform[4] ?? 0),
          y: Number(item.transform[5] ?? 0),
          str: item.str,
        });
      }
    }
    const lines = clusterPdfPageLines(atoms);
    pageLinesList.push(lines);

    const joined = lines.map((l) => l.text).join(' ');
    if (!startDate || !endDate) {
      const pm = joined.match(
        /(?:Period[^0-9]{0,20})?(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})\s*(?:To|-|–)\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/i
      );
      if (pm) {
        periodText = pm[0];
        startDate = parseDmyString(pm[1]);
        endDate = parseDmyString(pm[2]);
      }
    }
    if (ccmsSale === null) {
      const m = joined.match(
        /CCMS\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)/i
      );
      if (m) {
        const toNum = (s: string) => Number(s.replace(/,/g, ''));
        opBal = toNum(m[1]);
        recharge = toNum(m[2]);
        ccmsSale = toNum(m[3]);
      }
    }
  }

  // Strategy 1: Coordinate-mapped table when PDF contains IOCL Transaction Details columns
  interface HeaderBand {
    key: string;
    x: number;
  }
  const KNOWN_COL_KEYS: Array<{ match: RegExp; key: string }> = [
    { match: /^S\.?No\.?$/i, key: 'SNo.' },
    { match: /Terminal\s*ID/i, key: 'Terminal ID' },
    { match: /Merchant\s*ID/i, key: 'Merchant ID' },
    { match: /Merchant\s*Name|Station|RO\s*Name|Outlet/i, key: 'Merchant Name' },
    { match: /Merchant\s*PAN/i, key: 'Merchant PAN' },
    { match: /Merchant\s*State|State/i, key: 'Merchant State' },
    { match: /^Location$|City/i, key: 'Location' },
    { match: /Customer\s*ID|Card\s*PAN|Card\s*No/i, key: 'Customer ID/Card PAN' },
    { match: /Card\s*Holder|Vehicle|Driver/i, key: 'Name of Card Holder' },
    { match: /Txn\s*ID|Trans\.?\s*ID|Batch/i, key: 'Txn ID' },
    { match: /Txn\s*Date|Trans\.?\s*Date|^Date$/i, key: 'Txn Date' },
    { match: /Txn\s*Type|Trans\.?\s*Type/i, key: 'Txn Type' },
    { match: /Txn\s*Mode\s*Value/i, key: 'Txn Mode Value' },
    { match: /^Txn\s*Mode$/i, key: 'Txn Mode' },
    { match: /Product|Fuel/i, key: 'Product' },
    { match: /Currency/i, key: 'Currency' },
    { match: /^RSP$|^Price$|Rate/i, key: 'RSP' },
    { match: /Quantity|Qty|Volume|Litre/i, key: 'Quantity' },
    { match: /^Amount$|Sale\s*Amt|Value/i, key: 'Amount' },
    { match: /^Status$/i, key: 'Status' },
  ];

  let activeHeaderBands: HeaderBand[] | null = null;
  const tableSales: FuelSaleRow[] = [];
  const typeCountMap = new Map<string, number>();
  let totalSourceRows = 0;

  for (const lines of pageLinesList) {
    for (const line of lines) {
      const hasTxnTypeHeader = /Txn\s*Type/i.test(line.text) && /Amount/i.test(line.text);
      if (hasTxnTypeHeader) {
        const bands: HeaderBand[] = [];
        for (const atom of line.atoms) {
          const hit = KNOWN_COL_KEYS.find((k) => k.match.test(atom.str.trim()));
          if (hit) bands.push({ key: hit.key, x: atom.x });
        }
        if (bands.length >= 4) {
          activeHeaderBands = bands;
          continue;
        }
      }

      if (!activeHeaderBands) continue;
      if (/^(?:Total|Grand\s*Total|Page\s+\d+)/i.test(line.text)) continue;

      const rowMap = new Map<string, string[]>();
      for (const atom of line.atoms) {
        let bestBand = activeHeaderBands[0];
        let bestDist = Infinity;
        for (const b of activeHeaderBands) {
          const d = Math.abs(atom.x - b.x);
          if (d < bestDist) {
            bestDist = d;
            bestBand = b;
          }
        }
        if (bestBand) {
          const list = rowMap.get(bestBand.key) ?? [];
          list.push(atom.str.trim());
          rowMap.set(bestBand.key, list);
        }
      }

      const getVal = (k: string) => (rowMap.get(k) ?? []).join(' ').trim();
      const snoNum = toFiniteNumber(getVal('SNo.'));
      const amtNum = toFiniteNumber(getVal('Amount'));
      if (snoNum === null && amtNum === null) continue;

      const txnType = getVal('Txn Type') || 'Sale';
      totalSourceRows += 1;
      typeCountMap.set(txnType, (typeCountMap.get(txnType) ?? 0) + 1);
      if (txnType.toLowerCase() !== 'sale') continue;

      const priceNum = toFiniteNumber(getVal('RSP'));
      const qtyNum = toFiniteNumber(getVal('Quantity'));
      const dateRaw = getVal('Txn Date');
      const parsedDate = parseTxnDate(dateRaw, dateRaw);
      const terminalId = toFiniteNumber(getVal('Terminal ID'));
      const merchantId = toFiniteNumber(getVal('Merchant ID'));
      const txnId = toFiniteNumber(getVal('Txn ID'));

      tableSales.push({
        sno: tableSales.length + 1,
        terminalId: terminalId !== null ? Math.trunc(terminalId) : null,
        merchantId: merchantId !== null ? Math.trunc(merchantId) : null,
        merchantName: getVal('Merchant Name'),
        merchantPan: getVal('Merchant PAN'),
        merchantState: getVal('Merchant State'),
        location: getVal('Location'),
        customerCardPan: getVal('Customer ID/Card PAN'),
        cardHolderName: getVal('Name of Card Holder'),
        txnId: txnId !== null ? Math.trunc(txnId) : null,
        txnDateText: parsedDate.text,
        txnDateObj: parsedDate.date,
        txnType: 'Sale',
        txnMode: getVal('Txn Mode') || 'CARD',
        txnModeValue: getVal('Txn Mode Value'),
        product: normalizeProductName(getVal('Product')),
        currency: getVal('Currency') || 'INR',
        price: priceNum ?? 0,
        quantity: qtyNum ?? 0,
        amount: amtNum ?? 0,
        status: getVal('Status') || 'PT',
        hasBlankPrice: priceNum === null,
        hasBlankQty: qtyNum === null,
        hasBlankAmount: amtNum === null,
      });
    }
  }

  // Strategy 2: Parse IOCL Monthly Statement line-by-line transactions if Strategy 1 found 0 rows
  let finalSales = tableSales;
  const notes: string[] = [];

  if (finalSales.length === 0) {
    const lineSales: FuelSaleRow[] = [];
    const SKIP_LINE =
      /\b(?:RECHARGE|ALLOCATION|FUND\s*TRANSFER|OPENING\s*BAL|CLOSING\s*BAL|OP\.?\s*BAL|CCMS|SUBTOTAL|GRAND\s*TOTAL|STATEMENT\s*SUMMARY|PAGE\s+\d+|PERIOD)\b/i;

    for (const lines of pageLinesList) {
      for (const line of lines) {
        const text = line.text;
        if (!text || SKIP_LINE.test(text)) continue;

        const dateMatch = text.match(
          /\b(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?\b/
        );
        if (!dateMatch) continue;

        const { nums, prefix } = parseTrailingNumericTokens(text);
        if (nums.length === 0) continue;

        let amount = nums[nums.length - 1];
        let quantity = 0;
        let price = 0;
        let hasBlankQty = true;
        let hasBlankPrice = true;

        if (nums.length >= 3) {
          const pCand = nums[nums.length - 3];
          const qCand = nums[nums.length - 2];
          const aCand = nums[nums.length - 1];
          if (Math.abs(pCand * qCand - aCand) <= 2.5 && pCand > 0 && qCand > 0) {
            price = pCand;
            quantity = qCand;
            amount = aCand;
            hasBlankPrice = false;
            hasBlankQty = false;
          }
        }
        if (hasBlankQty && nums.length >= 2) {
          const qCand = nums[nums.length - 2];
          const aCand = nums[nums.length - 1];
          const impliedPrice = qCand > 0 ? aCand / qCand : 0;
          if (impliedPrice >= 40 && impliedPrice <= 185) {
            quantity = qCand;
            amount = aCand;
            price = round2(impliedPrice);
            hasBlankQty = false;
            hasBlankPrice = false;
          }
        }

        if (amount <= 0) continue;

        const dateStr = dateMatch[2] ? `${dateMatch[1]} ${dateMatch[2]}` : dateMatch[1];
        const parsedD = parseDmyString(dateStr);
        const cardMatch = prefix.match(/\b(\d{4}[X*\d]{4,12}\d{2,4}|\d{16})\b/i);
        const prodMatch = prefix.match(/\b(PETROL|DIESEL|XP95|XP100|XTRAMILE|CNG|MS|HSD)\b/i);
        const txnIdMatch = prefix.match(/\b(\d{8,12})\b/);

        let merchantDesc = prefix
          .replace(dateMatch[0], '')
          .replace(cardMatch?.[0] ?? '', '')
          .replace(prodMatch?.[0] ?? '', '')
          .replace(/\b(?:Sale|INR|Rs\.?)\b/gi, '')
          .replace(/\s+/g, ' ')
          .trim();
        if (!merchantDesc) merchantDesc = 'IOCL Fuel Station (Statement PDF)';

        totalSourceRows += 1;
        typeCountMap.set('Sale', (typeCountMap.get('Sale') ?? 0) + 1);

        lineSales.push({
          sno: lineSales.length + 1,
          terminalId: null,
          merchantId: null,
          merchantName: merchantDesc.slice(0, 80),
          merchantPan: '',
          merchantState: '',
          location: '',
          customerCardPan: cardMatch ? cardMatch[1] : '',
          cardHolderName: '',
          txnId: txnIdMatch ? Number(txnIdMatch[1]) : null,
          txnDateText: dateStr,
          txnDateObj: parsedD,
          txnType: 'Sale',
          txnMode: 'CARD',
          txnModeValue: cardMatch ? cardMatch[1] : '',
          product: normalizeProductName(prodMatch ? prodMatch[1] : 'FUEL'),
          currency: 'INR',
          price,
          quantity,
          amount,
          status: 'PT',
          hasBlankPrice,
          hasBlankQty,
          hasBlankAmount: false,
        });
      }
    }

    if (lineSales.length > 0) {
      finalSales = lineSales;
      const missingQtyCount = lineSales.filter((s) => s.hasBlankQty).length;
      if (missingQtyCount > 0) {
        notes.push(
          `Extracted ${lineSales.length} Sale transaction(s) directly from your PDF statement. ${missingQtyCount} line(s) in this PDF omit Price/Quantity; upload the Transaction Details Excel if you need litre-level breakdowns.`
        );
      } else {
        notes.push(`Extracted ${lineSales.length} Sale transaction(s) with Quantity & Amount directly from PDF.`);
      }
    }
  } else {
    notes.push(`Parsed ${finalSales.length} itemized Sale transaction(s) from PDF table.`);
  }

  // Strategy 3: CCMS Summary-Only PDF fallback so any readable IOCL statement PDF works standalone
  if (finalSales.length === 0 && ccmsSale !== null && ccmsSale > 0) {
    const summaryDateText = startDate ? formatDateDmy(startDate) : formatDateDmy(new Date());
    totalSourceRows = 1;
    typeCountMap.set('Sale', 1);
    finalSales = [
      {
        sno: 1,
        terminalId: null,
        merchantId: null,
        merchantName: 'IOCL CCMS Monthly Statement Summary',
        merchantPan: '',
        merchantState: '',
        location: periodText || 'Monthly CCMS Statement PDF',
        customerCardPan: '',
        cardHolderName: 'Fleet Consolidated CCMS Sale',
        txnId: null,
        txnDateText: summaryDateText,
        txnDateObj: startDate ?? new Date(),
        txnType: 'Sale',
        txnMode: 'CCMS',
        txnModeValue: '',
        product: 'FUEL',
        currency: 'INR',
        price: 0,
        quantity: 0,
        amount: ccmsSale,
        status: 'PT',
        hasBlankPrice: true,
        hasBlankQty: true,
        hasBlankAmount: false,
      },
    ];
    notes.push(
      `This IOCL PDF contains summary CCMS totals (CCMS SALE ₹${formatInr(ccmsSale)}) without itemized fuel rows. Generated a summary report from the PDF — upload the Easy Fuel Excel if itemized vehicle/litre rows are also required.`
    );
  }

  if (finalSales.length === 0) {
    throw new Error(
      'Could not extract Sale rows or CCMS SALE totals from this PDF. Please verify it is a text-based IOCL Easy Fuel PDF (not a scanned image) or upload the Transaction Details Excel.'
    );
  }

  // Sort by Txn ID when present, preserving file order otherwise, and renumber 1..N
  if (finalSales.some((s) => s.txnId !== null)) {
    finalSales.sort((a, b) => (a.txnId ?? 0) - (b.txnId ?? 0));
  }
  finalSales.forEach((row, idx) => {
    row.sno = idx + 1;
  });

  if (!startDate || !endDate) {
    const dates = finalSales
      .map((s) => s.txnDateObj)
      .filter((d): d is Date => d !== null)
      .sort((a, b) => a.getTime() - b.getTime());
    if (dates.length > 0) {
      startDate = new Date(dates[0].getFullYear(), dates[0].getMonth(), dates[0].getDate());
      const lastD = dates[dates.length - 1];
      endDate = new Date(lastD.getFullYear(), lastD.getMonth(), lastD.getDate());
    } else {
      const now = new Date();
      startDate = now;
      endDate = now;
    }
  }

  const label = formatMonthLabel(startDate);
  const outputFileName = `${label.replace("'", ' ')} - report.xlsx`;
  const products = buildProductsSummary(finalSales);
  const totalQuantity = round2(finalSales.reduce((acc, s) => acc + s.quantity, 0));
  const totalAmount = round2(finalSales.reduce((acc, s) => acc + s.amount, 0));

  const issues: string[] = [];
  if (ccmsSale !== null && Math.abs(ccmsSale - totalAmount) >= 0.01) {
    issues.push(
      `Parsed PDF line total ₹${formatInr(totalAmount)} differs from PDF CCMS SALE ₹${formatInr(ccmsSale)} (diff ₹${formatInr(round2(ccmsSale - totalAmount))}).`
    );
  }

  const typeCounts = Array.from(typeCountMap.entries()).map(([type, count]) => ({
    type,
    count,
  }));

  return {
    fileName: file.name,
    ccmsSale,
    opBal,
    recharge,
    report: {
      fileName: file.name,
      sourceKind: 'pdf',
      label,
      outputFileName,
      periodText,
      startDate,
      endDate,
      totalSourceRows,
      typeCounts,
      sales: finalSales,
      products,
      totalQuantity,
      totalAmount,
      issues,
      notes,
    },
  };
}

async function exportFuelReportWorkbook(report: ParsedFuelReport): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const safeTitle = report.label.replace(/[:\\/?*[\]]/g, '').slice(0, 31) || 'Report';
  const ws = wb.addWorksheet(safeTitle);

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  };
  const hdrFont: Partial<ExcelJS.Font> = { name: 'Calibri', size: 11, bold: true };
  const bodyFont: Partial<ExcelJS.Font> = { name: 'Calibri', size: 11 };
  const bold12Font: Partial<ExcelJS.Font> = { name: 'Calibri', size: 12, bold: true };

  // Configure column widths & header row
  COLUMNS.forEach((col, idx) => {
    const colNo = idx + 1;
    ws.getColumn(colNo).width = col.width;
    const cell = ws.getCell(1, colNo);
    cell.value = col.header;
    cell.font = hdrFont;
    cell.border = thinBorder;
  });

  // Body rows
  report.sales.forEach((row, rIdx) => {
    const excelRow = rIdx + 2;
    const values: Array<string | number | null> = [
      row.sno,
      row.terminalId,
      row.merchantId,
      row.merchantName || null,
      row.merchantPan || null,
      row.merchantState || null,
      row.location || null,
      row.customerCardPan || null,
      row.cardHolderName || null,
      row.txnId,
      row.txnDateText || null,
      row.txnType || null,
      row.txnMode || null,
      row.txnModeValue || null,
      row.product || null,
      row.currency || null,
      row.hasBlankPrice ? null : row.price,
      row.hasBlankQty ? null : row.quantity,
      row.hasBlankAmount ? null : row.amount,
    ];

    values.forEach((val, cIdx) => {
      const cell = ws.getCell(excelRow, cIdx + 1);
      cell.value = val;
      cell.font = bodyFont;
      cell.border = thinBorder;
      if (COLUMNS[cIdx].kind === 'num') {
        cell.numFmt = EXCEL_NUM_FMT;
      }
    });
  });

  const first = 2;
  const last = 1 + report.sales.length;
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: last, column: 19 },
  };
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  // Summary block with live formulas matching fuel_report.py
  const totRow = last + 2;
  ws.mergeCells(totRow, 10, totRow, 16);
  const titleCell = ws.getCell(totRow, 10);
  titleCell.value = `Fuel Statements for the Month of ${report.label}`;
  titleCell.font = bold12Font;
  titleCell.alignment = { horizontal: 'center' };

  const totLblCell = ws.getCell(totRow, 17);
  totLblCell.value = 'Total';
  totLblCell.font = bold12Font;

  const totQtyCell = ws.getCell(`R${totRow}`);
  totQtyCell.value = { formula: `SUM(R${first}:R${last})`, result: report.totalQuantity };
  totQtyCell.font = bold12Font;
  totQtyCell.numFmt = EXCEL_NUM_FMT;

  const totAmtCell = ws.getCell(`S${totRow}`);
  totAmtCell.value = { formula: `SUM(S${first}:S${last})`, result: report.totalAmount };
  totAmtCell.font = bold12Font;
  totAmtCell.numFmt = EXCEL_NUM_FMT;

  let pr = totRow + 2;
  const pFirst = pr;
  report.products.forEach((prod) => {
    const pCell = ws.getCell(pr, 17);
    pCell.value = prod.product;
    pCell.font = bodyFont;

    const pqCell = ws.getCell(`R${pr}`);
    pqCell.value = {
      formula: `SUMIF($O$${first}:$O$${last},$Q${pr},$R$${first}:$R$${last})`,
      result: prod.quantity,
    };
    pqCell.font = bodyFont;
    pqCell.numFmt = EXCEL_NUM_FMT;

    const paCell = ws.getCell(`S${pr}`);
    paCell.value = {
      formula: `SUMIF($O$${first}:$O$${last},$Q${pr},$S$${first}:$S$${last})`,
      result: prod.amount,
    };
    paCell.font = bodyFont;
    paCell.numFmt = EXCEL_NUM_FMT;

    pr += 1;
  });

  const pLast = pr - 1;
  const gt = pr + 1;
  const gtLblCell = ws.getCell(gt, 17);
  gtLblCell.value = 'Total';
  gtLblCell.font = bold12Font;

  const gtQtyCell = ws.getCell(`R${gt}`);
  gtQtyCell.value = { formula: `SUM(R${pFirst}:R${pLast})`, result: report.totalQuantity };
  gtQtyCell.font = bold12Font;
  gtQtyCell.numFmt = EXCEL_NUM_FMT;

  const gtAmtCell = ws.getCell(`S${gt}`);
  gtAmtCell.value = { formula: `SUM(S${pFirst}:S${pLast})`, result: report.totalAmount };
  gtAmtCell.font = bold12Font;
  gtAmtCell.numFmt = EXCEL_NUM_FMT;

  const chkLblCell = ws.getCell(gt + 2, 10);
  chkLblCell.value = 'Check (grand total - total, must be 0):';
  chkLblCell.font = bodyFont;

  const chkQtyCell = ws.getCell(`R${gt + 2}`);
  chkQtyCell.value = { formula: `ROUND(R${gt}-R${totRow},2)`, result: 0 };
  chkQtyCell.font = bodyFont;
  chkQtyCell.numFmt = EXCEL_NUM_FMT;

  const chkAmtCell = ws.getCell(`S${gt + 2}`);
  chkAmtCell.value = { formula: `ROUND(S${gt}-S${totRow},2)`, result: 0 };
  chkAmtCell.font = bodyFont;
  chkAmtCell.numFmt = EXCEL_NUM_FMT;

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = report.outputFileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

type SortKey =
  | 'sno'
  | 'txnId'
  | 'txnDateText'
  | 'cardHolderName'
  | 'merchantName'
  | 'product'
  | 'price'
  | 'quantity'
  | 'amount';

export const FuelReportGeneratorView: React.FC<FuelReportGeneratorViewProps> = ({
  tool,
  onBack,
}) => {
  const excelInputRef = useRef<HTMLInputElement | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);

  const [excelReport, setExcelReport] = useState<ParsedFuelReport | null>(null);
  const [pdfResult, setPdfResult] = useState<PdfParsedResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [productFilter, setProductFilter] = useState<string>('ALL');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
    key: 'sno',
    dir: 'asc',
  });

  // Excel takes priority for full 19-column detail when both are uploaded; PDF works standalone too
  const report = excelReport ?? pdfResult?.report ?? null;

  const pdfCheck: PdfCheckState | null = useMemo(() => {
    if (!pdfResult) return null;
    if (pdfResult.ccmsSale === null) {
      return {
        fileName: pdfResult.fileName,
        ccmsSale: null,
        opBal: pdfResult.opBal,
        recharge: pdfResult.recharge,
        matched: null,
        diff: null,
        message: `Loaded PDF report (${pdfResult.report.sales.length} Sale row(s)). No CCMS summary block was printed on this PDF.`,
      };
    }
    const compareTotal = report?.totalAmount ?? pdfResult.report.totalAmount;
    const diff = round2(pdfResult.ccmsSale - compareTotal);
    const matched = Math.abs(diff) < 0.005;
    return {
      fileName: pdfResult.fileName,
      ccmsSale: pdfResult.ccmsSale,
      opBal: pdfResult.opBal,
      recharge: pdfResult.recharge,
      matched,
      diff,
      message: matched
        ? `PDF reconciliation OK: CCMS SALE ₹${formatInr(pdfResult.ccmsSale)} matches report total.`
        : `PDF CCMS SALE ₹${formatInr(pdfResult.ccmsSale)} differs from report total ₹${formatInr(compareTotal)} (diff ₹${formatInr(diff)}).`,
    };
  }, [pdfResult, report]);

  const handleExcelFile = async (file: File) => {
    setIsBusy(true);
    setErrorMsg('');
    try {
      const buf = await file.arrayBuffer();
      const parsed = parseIoclWorkbook(file.name, buf);
      setExcelReport(parsed);
      setProductFilter('ALL');
      setSearchQuery('');
      setSortConfig({ key: 'sno', dir: 'asc' });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to parse the Excel file.');
    } finally {
      setIsBusy(false);
    }
  };

  const handlePdfFile = async (file: File) => {
    setIsBusy(true);
    setErrorMsg('');
    try {
      const parsed = await parseIoclStatementPdf(file);
      setPdfResult(parsed);
      if (!excelReport) {
        setProductFilter('ALL');
        setSearchQuery('');
        setSortConfig({ key: 'sno', dir: 'asc' });
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to read the statement PDF.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleAnyDroppedFile = (files: File[]) => {
    const file = files[0];
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.pdf') || file.type === 'application/pdf') {
      void handlePdfFile(file);
    } else {
      void handleExcelFile(file);
    }
  };

  const excelDrop = useFileDrop({
    accept: '.xlsx,.xls,.csv',
    multiple: false,
    disabled: isBusy,
    onFiles: (files) => {
      if (files[0]) void handleExcelFile(files[0]);
    },
  });

  const pdfDrop = useFileDrop({
    accept: 'application/pdf,.pdf',
    multiple: false,
    disabled: isBusy,
    onFiles: (files) => {
      if (files[0]) void handlePdfFile(files[0]);
    },
  });

  const emptyAnyDrop = useFileDrop({
    accept: '.xlsx,.xls,.csv,.pdf,application/pdf',
    multiple: false,
    disabled: isBusy,
    onFiles: handleAnyDroppedFile,
  });

  const handleReset = () => {
    setExcelReport(null);
    setPdfResult(null);
    setErrorMsg('');
    setSearchQuery('');
    setProductFilter('ALL');
    if (excelInputRef.current) excelInputRef.current.value = '';
    if (pdfInputRef.current) pdfInputRef.current.value = '';
  };

  const handleExportCsv = () => {
    if (!report) return;
    const esc = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const headerRow = COLUMNS.map((c) => esc(c.header)).join(',');
    const bodyRows = report.sales.map((r) =>
      [
        r.sno,
        r.terminalId,
        r.merchantId,
        r.merchantName,
        r.merchantPan,
        r.merchantState,
        r.location,
        r.customerCardPan,
        r.cardHolderName,
        r.txnId,
        r.txnDateText,
        r.txnType,
        r.txnMode,
        r.txnModeValue,
        r.product,
        r.currency,
        r.hasBlankPrice ? '' : r.price.toFixed(2),
        r.hasBlankQty ? '' : r.quantity.toFixed(2),
        r.hasBlankAmount ? '' : r.amount.toFixed(2),
      ]
        .map(esc)
        .join(',')
    );
    const csv = `\ufeff${[headerRow, ...bodyRows].join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = report.outputFileName.replace(/\.xlsx$/i, '.csv');
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1200);
  };

  const filteredSales = useMemo(() => {
    if (!report) return [];
    const q = searchQuery.trim().toLowerCase();
    const rows = report.sales.filter((r) => {
      if (productFilter !== 'ALL' && r.product !== productFilter) return false;
      if (!q) return true;
      return (
        String(r.txnId ?? '').includes(q) ||
        r.cardHolderName.toLowerCase().includes(q) ||
        r.merchantName.toLowerCase().includes(q) ||
        r.location.toLowerCase().includes(q) ||
        r.customerCardPan.toLowerCase().includes(q) ||
        r.txnModeValue.toLowerCase().includes(q) ||
        r.product.toLowerCase().includes(q)
      );
    });

    const dir = sortConfig.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const k = sortConfig.key;
      const va = a[k] ?? '';
      const vb = b[k] ?? '';
      if (typeof va === 'number' && typeof vb === 'number') {
        return (va - vb) * dir;
      }
      return String(va).localeCompare(String(vb)) * dir;
    });
  }, [report, productFilter, searchQuery, sortConfig]);

  const toggleSort = (key: SortKey) => {
    setSortConfig((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }
    );
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="w-3 h-3 opacity-55" />;
    return sortConfig.dir === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-[#F9C80E]" />
    ) : (
      <ArrowDown className="w-3 h-3 text-[#F9C80E]" />
    );
  };

  return (
    <div className="space-y-6">
      {/* Workspace Header */}
      <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 sm:p-6 shadow-[0_4px_0_#2F3E4E] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#475569]">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#CEE5DC] border border-[#2F3E4E] text-[11px] font-mono font-bold text-[#2F3E4E]">
              <Fuel className="w-3.5 h-3.5 text-[#12805C]" aria-hidden="true" />
              <span>{tool?.code ?? 'VC-07'} · IOCL Easy Fuel</span>
            </span>
            <span className="inline-flex items-center gap-1 text-[#12805C] font-bold">
              <HardDrive className="w-3.5 h-3.5" aria-hidden="true" />
              <span>100% Browser-Local</span>
            </span>
          </div>

          <h1 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] tracking-tight">
            {tool?.title ?? 'Monthly Fuel Report Generator'}
          </h1>
          <p className="text-xs sm:text-sm text-[#475569] max-w-3xl leading-relaxed">
            Upload <strong>either</strong> an IOCL Easy Fuel Excel/CSV export <strong>or</strong> a
            Monthly Statement PDF (or both to cross-verify CCMS SALE) via click or drag-and-drop,
            and download a formula-linked{' '}
            <span className="font-mono font-semibold text-[#2F3E4E]">&lt;Mon YY&gt; - report.xlsx</span>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {report && (
            <>
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FFFDF5] hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] cursor-pointer transition whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Export CSV</span>
              </button>

              <button
                type="button"
                disabled={isExporting}
                onClick={async () => {
                  setIsExporting(true);
                  try {
                    await exportFuelReportWorkbook(report);
                  } finally {
                    setIsExporting(false);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#F9C80E] hover:bg-[#eab308] text-xs font-extrabold text-[#2F3E4E] shadow-[0_2px_0_#2F3E4E] cursor-pointer transition whitespace-nowrap disabled:opacity-50"
              >
                <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
                <span>{isExporting ? 'Generating XLSX...' : `Download ${report.outputFileName}`}</span>
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#FFE1B3] text-xs font-bold text-[#2F3E4E] cursor-pointer transition whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Reset</span>
              </button>
            </>
          )}

          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="px-3.5 py-2 min-h-[40px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] cursor-pointer transition whitespace-nowrap"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Upload Row — Either Excel or PDF generates the report */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Input 1: IOCL Excel / CSV */}
        <div
          {...excelDrop.dropProps}
          className={`border-[1.5px] rounded-2xl p-5 shadow-[0_4px_0_#2F3E4E] flex flex-col justify-between gap-4 transition-colors ${
            excelDrop.isDragActive
              ? 'border-[#2F3E4E] bg-[#F9C80E]/30 ring-2 ring-[#F9C80E]'
              : excelReport
                ? 'border-[#12805C] bg-[#FFFDF5]'
                : 'border-[#2F3E4E] bg-[#FFFDF5]'
          }`}
        >
          <div className="space-y-1">
            <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#12805C]">
              Option A · Excel / CSV Input (Drag &amp; Drop Supported)
            </p>
            <h2 className="font-display font-extrabold text-base text-[#2F3E4E]">
              IOCL Easy Fuel Transaction Details (.xlsx / .xls / .csv)
            </h2>
            <p className="text-xs text-[#475569] leading-relaxed">
              Drag &amp; drop or click to load the Excel export. Keeps only{' '}
              <span className="font-mono font-semibold text-[#2F3E4E]">Sale</span> rows, sorts by
              Txn ID, and checks Qty × RSP.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={excelInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleExcelFile(f);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              disabled={isBusy}
              onClick={() => excelInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[42px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#2F3E4E] hover:bg-[#1E293B] text-xs font-bold text-[#F9C80E] shadow-[0_2px_0_#1E293B] cursor-pointer transition whitespace-nowrap disabled:opacity-50"
            >
              <Upload className="w-4 h-4" aria-hidden="true" />
              <span>{excelReport ? 'Replace IOCL Excel' : 'Select or Drop IOCL Excel'}</span>
            </button>
            {excelReport && (
              <span className="text-xs font-mono font-semibold text-[#12805C] truncate max-w-[260px]">
                {excelReport.fileName}
              </span>
            )}
          </div>
        </div>

        {/* Input 2: Statement PDF (Standalone Report OR Cross-Check) */}
        <div
          {...pdfDrop.dropProps}
          className={`border-[1.5px] rounded-2xl p-5 shadow-[0_4px_0_#2F3E4E] flex flex-col justify-between gap-4 transition-colors ${
            pdfDrop.isDragActive
              ? 'border-[#2F3E4E] bg-[#F9C80E]/30 ring-2 ring-[#F9C80E]'
              : pdfResult
                ? 'border-[#12805C] bg-[#FFFDF5]'
                : 'border-[#2F3E4E] bg-[#FFFDF5]'
          }`}
        >
          <div className="space-y-1">
            <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#2F3E4E]">
              Option B · PDF Input or Cross-Check (Drag &amp; Drop Supported)
            </p>
            <h2 className="font-display font-extrabold text-base text-[#2F3E4E]">
              Easy Fuel Statement / Transaction PDF (.pdf)
            </h2>
            <p className="text-xs text-[#475569] leading-relaxed">
              Upload any IOCL PDF directly to generate the Monthly Fuel Report on its own, or drop
              it alongside Excel to verify <span className="font-mono font-semibold text-[#2F3E4E]">CCMS SALE</span>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={pdfInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handlePdfFile(f);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              disabled={isBusy}
              onClick={() => pdfInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[42px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#CEE5DC] hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] cursor-pointer transition whitespace-nowrap disabled:opacity-50"
            >
              <FileText className="w-4 h-4" aria-hidden="true" />
              <span>
                {pdfResult
                  ? 'Replace Statement PDF'
                  : excelReport
                    ? 'Verify Against Statement PDF'
                    : 'Select or Drop Statement PDF'}
              </span>
            </button>
            {pdfResult && (
              <span className="text-xs font-mono font-semibold text-[#2F3E4E] truncate max-w-[260px]">
                {pdfResult.fileName}
              </span>
            )}
          </div>
        </div>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="bg-[#FFE1B3] border-[1.5px] border-[#2F3E4E] rounded-xl p-4 flex items-start gap-3 text-xs sm:text-sm text-[#9E2A2B] font-semibold"
        >
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      {!report ? (
        /* Empty State — Universal Dropzone for Either Excel or PDF */
        <div
          {...emptyAnyDrop.dropProps}
          className={`border-[1.5px] border-dashed rounded-2xl p-8 text-center space-y-3 transition-colors ${
            emptyAnyDrop.isDragActive
              ? 'border-[#2F3E4E] bg-[#F9C80E]/30 ring-2 ring-[#F9C80E]'
              : 'border-[#2F3E4E] bg-[#FFFDF5]'
          }`}
        >
          <div className="w-12 h-12 mx-auto rounded-xl bg-[#CEE5DC] border-[1.5px] border-[#2F3E4E] flex items-center justify-center text-[#2F3E4E]">
            <Fuel className="w-6 h-6" aria-hidden="true" />
          </div>
          <h3 className="font-display font-extrabold text-lg text-[#2F3E4E]">
            {emptyAnyDrop.isDragActive
              ? 'Drop Your IOCL PDF or Excel File Here'
              : 'Drag & Drop or Upload Any IOCL Excel OR PDF File to Generate Report'}
          </h3>
          <p className="text-xs sm:text-sm text-[#475569] max-w-2xl mx-auto leading-relaxed">
            Accepts <strong>either</strong> <span className="font-mono">.xlsx / .xls / .csv</span>{' '}
            Transaction Details <strong>or</strong> an IOCL <span className="font-mono">.pdf</span>{' '}
            Statement (or both). Generates PETROL / DIESEL breakdowns with live Excel{' '}
            <span className="font-mono">SUM</span> &amp; <span className="font-mono">SUMIF</span>{' '}
            formulas ready for accounting sign-off.
          </p>
        </div>
      ) : (
        <>
          {/* Summary KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-xl p-4 shadow-[0_3px_0_#2F3E4E]">
              <p className="text-[11px] font-bold text-[#475569] uppercase tracking-wide">
                Statement Period
              </p>
              <p className="font-display font-extrabold text-lg text-[#2F3E4E] mt-1 tabular-nums">
                {report.label}
              </p>
              <p className="text-[11px] font-mono text-[#475569] mt-0.5 tabular-nums">
                {formatDateDmy(report.startDate)} – {formatDateDmy(report.endDate)}
              </p>
            </div>

            <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-xl p-4 shadow-[0_3px_0_#2F3E4E]">
              <p className="text-[11px] font-bold text-[#475569] uppercase tracking-wide">
                Sale Transactions
              </p>
              <p className="font-display font-extrabold text-lg text-[#2F3E4E] mt-1 tabular-nums">
                {report.sales.length.toLocaleString('en-IN')}
              </p>
              <p className="text-[11px] font-mono text-[#475569] mt-0.5 tabular-nums">
                Out of {report.totalSourceRows.toLocaleString('en-IN')} source rows
              </p>
            </div>

            <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-xl p-4 shadow-[0_3px_0_#2F3E4E]">
              <p className="text-[11px] font-bold text-[#475569] uppercase tracking-wide">
                Total Quantity
              </p>
              <p className="font-display font-extrabold text-lg text-[#2F3E4E] mt-1 font-mono tabular-nums">
                {formatInr(report.totalQuantity, 3)} L
              </p>
              <p className="text-[11px] text-[#475569] mt-0.5">
                Across {report.products.length} fuel product{report.products.length === 1 ? '' : 's'}
              </p>
            </div>

            <div className="bg-[#CEE5DC] border-[1.5px] border-[#2F3E4E] rounded-xl p-4 shadow-[0_3px_0_#2F3E4E]">
              <p className="text-[11px] font-bold text-[#2F3E4E] uppercase tracking-wide">
                Total Sale Amount
              </p>
              <p className="font-display font-extrabold text-lg text-[#2F3E4E] mt-1 font-mono tabular-nums">
                ₹ {formatInr(report.totalAmount)}
              </p>
              <p className="text-[11px] font-mono text-[#2F3E4E] mt-0.5 truncate">
                {pdfCheck
                  ? pdfCheck.matched
                    ? 'Matches PDF CCMS SALE'
                    : pdfCheck.diff !== null
                      ? `PDF diff: ₹ ${formatInr(pdfCheck.diff)}`
                      : 'PDF check unavailable'
                  : 'Upload PDF to verify CCMS SALE'}
              </p>
            </div>
          </div>

          {/* Product Breakdown & Sanity Audit */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Product Summary Table */}
            <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 shadow-[0_4px_0_#2F3E4E] space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display font-extrabold text-base text-[#2F3E4E]">
                  Fuel Statements for the Month of {report.label}
                </h3>
                <span className="text-[11px] font-mono font-semibold text-[#475569]">
                  SUMIF Summary
                </span>
              </div>

              <div className="overflow-x-auto border border-[#2F3E4E]/25 rounded-xl bg-white">
                <table className="w-full text-xs sm:text-sm border-collapse">
                  <thead>
                    <tr className="bg-[#2F3E4E] text-[#FFFDF5]">
                      <th className="text-left px-3 py-2 font-bold">Product</th>
                      <th className="text-right px-3 py-2 font-bold">Sales</th>
                      <th className="text-right px-3 py-2 font-bold">Quantity (L)</th>
                      <th className="text-right px-3 py-2 font-bold">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2F3E4E]/15 font-mono tabular-nums">
                    {report.products.map((p) => (
                      <tr key={p.product} className="hover:bg-[#FEF2C8]/55">
                        <td className="px-3 py-2 font-sans font-bold text-[#2F3E4E]">{p.product}</td>
                        <td className="px-3 py-2 text-right text-[#475569]">{p.count}</td>
                        <td className="px-3 py-2 text-right text-[#2F3E4E]">
                          {formatInr(p.quantity, 3)}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-[#2F3E4E]">
                          {formatInr(p.amount)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-[#FEF2C8] font-bold text-[#2F3E4E]">
                      <td className="px-3 py-2.5 font-sans">Grand Total</td>
                      <td className="px-3 py-2.5 text-right">{report.sales.length}</td>
                      <td className="px-3 py-2.5 text-right">
                        {formatInr(report.totalQuantity, 3)}
                      </td>
                      <td className="px-3 py-2.5 text-right">{formatInr(report.totalAmount)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sanity Checks & Source Row Breakdown */}
            <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 shadow-[0_4px_0_#2F3E4E] space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display font-extrabold text-base text-[#2F3E4E]">
                  Audit &amp; Reconciliation Checks
                </h3>
                {report.issues.length === 0 && (!pdfCheck || pdfCheck.matched !== false) ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-[#12805C]">
                    <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                    <span>All checks passed</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-[#B45309]">
                    <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                    <span>Review items below</span>
                  </span>
                )}
              </div>

              <div className="space-y-2 text-xs">
                {/* Source Txn Type breakdown */}
                <div className="p-3 rounded-xl bg-[#FEF2C8]/75 border border-[#2F3E4E]/20">
                  <p className="font-bold text-[#2F3E4E] mb-1">Rows in IOCL File by Txn Type</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[#475569]">
                    {report.typeCounts.map((tc) => (
                      <span key={tc.type}>
                        <strong className="text-[#2F3E4E]">{tc.type}</strong>: {tc.count}
                      </span>
                    ))}
                  </div>
                </div>

                {/* PDF Reconciliation Notice */}
                {pdfCheck && (
                  <div
                    className={`p-3 rounded-xl border flex items-start gap-2 ${
                      pdfCheck.matched === true
                        ? 'bg-[#CEE5DC]/75 border-[#12805C] text-[#2F3E4E]'
                        : pdfCheck.matched === false
                          ? 'bg-[#FFE1B3] border-[#9E2A2B] text-[#9E2A2B]'
                          : 'bg-[#FEF2C8] border-[#2F3E4E]/30 text-[#475569]'
                    }`}
                  >
                    {pdfCheck.matched ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#12805C]" />
                    ) : (
                      <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-0.5">
                      <p className="font-bold">{pdfCheck.message}</p>
                      {pdfCheck.opBal !== null && pdfCheck.recharge !== null && (
                        <p className="font-mono text-[11px] opacity-90">
                          PDF CCMS Opening: ₹{formatInr(pdfCheck.opBal)} · Recharge: ₹
                          {formatInr(pdfCheck.recharge)}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {report.notes.map((n, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-[#CEE5DC]/50 border border-[#2F3E4E]/20 text-[#2F3E4E] flex items-start gap-2"
                  >
                    <Info className="w-4 h-4 shrink-0 mt-0.5 text-[#12805C]" aria-hidden="true" />
                    <span>{n}</span>
                  </div>
                ))}

                {/* Issues or Clean Banner */}
                {report.issues.length > 0 ? (
                  report.issues.map((issue, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-[#FFE1B3] border border-[#9E2A2B]/50 text-[#9E2A2B] font-semibold flex items-start gap-2"
                    >
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                      <span>{issue}</span>
                    </div>
                  ))
                ) : (
                  <div className="p-2.5 rounded-lg bg-[#CEE5DC]/60 border border-[#12805C]/40 text-[#12805C] font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>
                      No duplicate Txn IDs, missing fields, non-PT statuses, out-of-period dates,
                      or Qty × Price discrepancies found.
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Interactive 19-Column Report Preview Table */}
          <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 shadow-[0_4px_0_#2F3E4E] space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="font-display font-extrabold text-base text-[#2F3E4E]">
                  Generated Report Preview ({filteredSales.length} of {report.sales.length} Sale
                  rows)
                </h3>
                <p className="text-xs text-[#475569]">
                  Sorted by Txn ID ascending with renumbered SNo. 1..{report.sales.length} and{' '}
                  <span className="font-mono">Price = RSP</span>. Click column headers to sort.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Product segmented filter */}
                <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#FEF2C8] border border-[#2F3E4E]/30">
                  {['ALL', ...report.products.map((p) => p.product)].map((prod) => (
                    <button
                      key={prod}
                      type="button"
                      onClick={() => setProductFilter(prod)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                        productFilter === prod
                          ? 'bg-[#2F3E4E] text-[#F9C80E]'
                          : 'text-[#2F3E4E] hover:bg-white/70'
                      }`}
                    >
                      {prod === 'ALL' ? 'All Products' : prod}
                    </button>
                  ))}
                </div>

                {/* Live Search */}
                <div className="relative">
                  <Search
                    className="w-3.5 h-3.5 text-[#475569] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search Txn ID, card holder, station..."
                    className="pl-8 pr-3 py-1.5 min-h-[36px] w-60 rounded-xl border-[1.5px] border-[#2F3E4E]/45 bg-white text-xs font-medium text-[#2F3E4E] focus:outline-none focus:border-[#2F3E4E]"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-auto max-h-[540px] border border-[#2F3E4E]/30 rounded-xl bg-white">
              <table className="w-full text-xs border-collapse whitespace-nowrap">
                <thead className="sticky top-0 z-10 bg-[#2F3E4E] text-[#FFFDF5]">
                  <tr>
                    <th className="px-2.5 py-2.5 text-left font-bold">
                      <button
                        type="button"
                        onClick={() => toggleSort('sno')}
                        className="inline-flex items-center gap-1 cursor-pointer hover:text-[#F9C80E]"
                      >
                        <span>SNo.</span>
                        {renderSortIcon('sno')}
                      </button>
                    </th>
                    <th className="px-2.5 py-2.5 text-left font-bold">Terminal ID</th>
                    <th className="px-2.5 py-2.5 text-left font-bold">Merchant ID</th>
                    <th className="px-2.5 py-2.5 text-left font-bold">
                      <button
                        type="button"
                        onClick={() => toggleSort('merchantName')}
                        className="inline-flex items-center gap-1 cursor-pointer hover:text-[#F9C80E]"
                      >
                        <span>Merchant Name</span>
                        {renderSortIcon('merchantName')}
                      </button>
                    </th>
                    <th className="px-2.5 py-2.5 text-left font-bold">Merchant PAN</th>
                    <th className="px-2.5 py-2.5 text-left font-bold">Merchant State</th>
                    <th className="px-2.5 py-2.5 text-left font-bold">Location</th>
                    <th className="px-2.5 py-2.5 text-left font-bold">Customer ID/Card PAN</th>
                    <th className="px-2.5 py-2.5 text-left font-bold">
                      <button
                        type="button"
                        onClick={() => toggleSort('cardHolderName')}
                        className="inline-flex items-center gap-1 cursor-pointer hover:text-[#F9C80E]"
                      >
                        <span>Name of Card Holder</span>
                        {renderSortIcon('cardHolderName')}
                      </button>
                    </th>
                    <th className="px-2.5 py-2.5 text-left font-bold">
                      <button
                        type="button"
                        onClick={() => toggleSort('txnId')}
                        className="inline-flex items-center gap-1 cursor-pointer hover:text-[#F9C80E]"
                      >
                        <span>Txn ID</span>
                        {renderSortIcon('txnId')}
                      </button>
                    </th>
                    <th className="px-2.5 py-2.5 text-left font-bold">
                      <button
                        type="button"
                        onClick={() => toggleSort('txnDateText')}
                        className="inline-flex items-center gap-1 cursor-pointer hover:text-[#F9C80E]"
                      >
                        <span>Txn Date</span>
                        {renderSortIcon('txnDateText')}
                      </button>
                    </th>
                    <th className="px-2.5 py-2.5 text-left font-bold">Txn Type</th>
                    <th className="px-2.5 py-2.5 text-left font-bold">Txn Mode</th>
                    <th className="px-2.5 py-2.5 text-left font-bold">Txn Mode Value</th>
                    <th className="px-2.5 py-2.5 text-left font-bold">
                      <button
                        type="button"
                        onClick={() => toggleSort('product')}
                        className="inline-flex items-center gap-1 cursor-pointer hover:text-[#F9C80E]"
                      >
                        <span>Product</span>
                        {renderSortIcon('product')}
                      </button>
                    </th>
                    <th className="px-2.5 py-2.5 text-left font-bold">Currency</th>
                    <th className="px-2.5 py-2.5 text-right font-bold">
                      <button
                        type="button"
                        onClick={() => toggleSort('price')}
                        className="inline-flex items-center gap-1 cursor-pointer hover:text-[#F9C80E]"
                      >
                        <span>Price</span>
                        {renderSortIcon('price')}
                      </button>
                    </th>
                    <th className="px-2.5 py-2.5 text-right font-bold">
                      <button
                        type="button"
                        onClick={() => toggleSort('quantity')}
                        className="inline-flex items-center gap-1 cursor-pointer hover:text-[#F9C80E]"
                      >
                        <span>Quantity</span>
                        {renderSortIcon('quantity')}
                      </button>
                    </th>
                    <th className="px-2.5 py-2.5 text-right font-bold">
                      <button
                        type="button"
                        onClick={() => toggleSort('amount')}
                        className="inline-flex items-center gap-1 cursor-pointer hover:text-[#F9C80E]"
                      >
                        <span>Amount</span>
                        {renderSortIcon('amount')}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2F3E4E]/12 font-mono tabular-nums text-[#2F3E4E]">
                  {filteredSales.length === 0 ? (
                    <tr>
                      <td colSpan={19} className="px-4 py-8 text-center font-sans text-[#475569]">
                        No matching Sale rows found for &ldquo;{searchQuery}&rdquo;.
                      </td>
                    </tr>
                  ) : (
                    filteredSales.map((r) => (
                      <tr key={`${r.sno}-${r.txnId}`} className="hover:bg-[#FEF2C8]/60">
                        <td className="px-2.5 py-2">{r.sno}</td>
                        <td className="px-2.5 py-2">{r.terminalId ?? ''}</td>
                        <td className="px-2.5 py-2">{r.merchantId ?? ''}</td>
                        <td className="px-2.5 py-2 font-sans">{r.merchantName}</td>
                        <td className="px-2.5 py-2">{r.merchantPan}</td>
                        <td className="px-2.5 py-2 font-sans">{r.merchantState}</td>
                        <td className="px-2.5 py-2 font-sans">{r.location}</td>
                        <td className="px-2.5 py-2">{r.customerCardPan}</td>
                        <td className="px-2.5 py-2 font-sans font-medium">{r.cardHolderName}</td>
                        <td className="px-2.5 py-2">{r.txnId ?? ''}</td>
                        <td className="px-2.5 py-2">{r.txnDateText}</td>
                        <td className="px-2.5 py-2 font-sans">{r.txnType}</td>
                        <td className="px-2.5 py-2 font-sans">{r.txnMode}</td>
                        <td className="px-2.5 py-2">{r.txnModeValue}</td>
                        <td className="px-2.5 py-2 font-sans font-bold">{r.product}</td>
                        <td className="px-2.5 py-2 font-sans">{r.currency}</td>
                        <td className="px-2.5 py-2 text-right">{r.hasBlankPrice ? '—' : formatInr(r.price)}</td>
                        <td className="px-2.5 py-2 text-right">{r.hasBlankQty ? '—' : formatInr(r.quantity)}</td>
                        <td className="px-2.5 py-2 text-right font-bold">{r.hasBlankAmount ? '—' : formatInr(r.amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
