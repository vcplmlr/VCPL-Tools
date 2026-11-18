import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { createWorker, type Worker as TesseractWorker } from 'tesseract.js';
import * as XLSX from 'xlsx';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export type ConfidenceLevel = 'High' | 'Medium' | 'Missing' | 'Edited';

export interface LedgerLine {
  date: Date | null;
  side: 'Dr' | 'Cr';
  part: string;
  vt: string;
  vno: string;
  amt: number;
  src: string;
  after: boolean;
  f?: string;
}

export type LedgerSourceKind = 'pdf' | 'pdf-ocr' | 'excel' | 'csv' | 'text' | 'image-ocr';

export interface ParsedLedger {
  id: string;
  file: string;
  header: string;
  rows: LedgerLine[];
  after: boolean;
  sourceKind: LedgerSourceKind;
  previewUrl?: string;
  rawText?: string;
  drTotal: number;
  crTotal: number;
  balanced: boolean;
}

export interface DealSheetShot {
  id: string;
  name: string;
  url: string;
  sourceKind: 'image' | 'pdf' | 'pdf-ocr' | 'spreadsheet' | 'text';
  vin: string;
  cust: string;
  vcpl: string;
  mar: string;
  ocrStatus?: 'pending' | 'running' | 'done' | 'error' | 'skipped';
  rawText?: string;
}

export interface TemplateSheetPreview {
  sourceName: string;
  rowCount: number;
  headers: string[];
  hasVin: boolean;
  hasCustomer: boolean;
  hasSc: boolean;
  isValid: boolean;
}

export type EvidenceTuple = [string | number | Date, string, ConfidenceLevel, string];

export interface ReviewItem {
  row: number;
  col: number;
  cust: string;
  f: string;
  v: string;
  c: ConfidenceLevel;
  n: string;
}

export interface DealRecord {
  row: number;
  vin: string;
  cust: string;
  sc: string;
  ev: Record<string, EvidenceTuple>;
  nl: number;
}

export interface LedgerCheck {
  file: string;
  n: number;
  dr: number;
  cr: number;
  ok: boolean;
  sourceKind?: LedgerSourceKind;
}

export interface GeneratedReportResult {
  wb: ExcelJS.Workbook;
  ws: ExcelJS.Worksheet;
  hdr: Record<string, number>;
  rv: ExcelJS.Worksheet;
  review: ReviewItem[];
  deals: DealRecord[];
  alerts: Array<['High' | 'Medium', string]>;
  checks: LedgerCheck[];
  unmatched: number;
  usedL: number;
  total: number;
}

export const HM: Record<string, string> = {
  'booking date': 'booking_date',
  'booking amount': 'booking_amount',
  'tr/pr date': 'trpr_date',
  'vcpl discount if any': 'vcpl_discount',
  'accessories discount if any': 'acc_discount',
  'accessories sold- amount': 'acc_amount',
  'bsi- foc or customer paid': 'bsi',
  'ew - foc or customer paid': 'ew',
  'trade in': 'trade_in',
  'dsa case yes/no': 'dsa',
  'whether margin retention is below 50k': 'margin_flag',
  'finance - full cash/ inhouse- irfan': 'finance_type',
  'finance amount-irfan': 'finance_amount',
  'insurance - inhouse (insurance company)- irfan': 'insurance_co',
};

export const IRF = new Set(['finance_type', 'finance_amount', 'insurance_co']);
export const IDX: Record<string, string> = {
  vin: 'vin',
  'delivered to': 'customer',
  'sold by': 'sc',
  model: 'model',
};

export const STD_HEADERS = [
  'SL No.',
  'Model ',
  'VIN',
  'Exterior Color',
  'Delivered To',
  'Sold By',
  'Vehicle received date-',
  'Delivery date-',
  'DMS invoice date-',
  'Booking date',
  'Booking amount',
  'TR/PR date',
  'vcpl discount if any',
  'ACCessories discount if any',
  'Accessories sold- Amount',
  'BSI- FOC or customer paid',
  'EW - FOC or customer paid',
  'Trade IN ',
  'Finance - Full cash/ Inhouse- Irfan',
  'Finance Amount-Irfan',
  'Insurance - Inhouse (Insurance company)- Irfan',
  'DSA case YES/NO',
  'Whether Margin retention is below 50K',
];

export const RULES: Array<[string, RegExp]> = [
  ['car_sale', /car sales/i],
  ['tcs', /tax collection at source|tcs/i],
  ['road_tax', /life tax|road tax|registration|\brto\b|tr\/pr/i],
  ['fastag', /fast ?tag|hsrp/i],
  ['ew', /extended warranty|\bEW\b|warranty/i],
  ['bsi', /\bBSI\b|basic service inclusive|service inclusive/i],
  [
    'insurance',
    /insurance|allianz|icici lombard|tata aig|hdfc ergo|new india|oriental|national ins|reliance gen|bajaj/i,
  ],
  ['facilitation', /facilitation/i],
  ['trade_in', /used car|trade[- ]?in|exchange|pre[- ]?owned/i],
  [
    'finance',
    /bmw fs|loan disb|disbursement|finance|hdfc bank|icici bank|\bsbi\b|axis bank|kotak|bank of/i,
  ],
  ['dsa', /\bDSA\b|dsa commission|payout/i],
  ['acc_discount', /accessor\w* discount|discount.*accessor/i],
  ['accessories', /accessor|sale of spares|spares|genuine/i],
  ['booking', /booking|advance|token/i],
  ['receipt', /cash-in-hand|phonepe|bank|cheque|neft|rtgs|upi|receipt|paytm/i],
];

const VT = [
  'Cash Receipt',
  'PhonePe Receipt',
  'Bank Receipt',
  'Car Sales',
  'Sales Service',
  'VAS - Sales',
  'Journal',
  'Others',
  'Sales',
  'Receipt',
  'Payment',
  'Contra',
  'Credit Note',
  'Debit Note',
].sort((a, b) => b.length - a.length);

const RCT = new Set(['cash receipt', 'phonepe receipt', 'bank receipt', 'receipt']);

const MON: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

export const INR_FMT = '[>=10000000]##\\,##\\,##\\,##0;[>=100000]##\\,##\\,##0;##,##0';
export const DATEF = new Set(['booking_date', 'trpr_date']);
export const NUMF = new Set([
  'booking_amount',
  'vcpl_discount',
  'acc_discount',
  'acc_amount',
  'trade_in',
  'finance_amount',
]);
const FIELDS = new Set(RULES.map((r) => r[0]));
const NOISE = new Set(
  'dr mr mrs ms shri smt pvt ltd private limited and co ledger vouchers aftersales after sales s o late of the'.split(
    ' '
  )
);

export const norm = (s: unknown): string =>
  String(s ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

export function cellTxt(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'object') {
    if (v instanceof Date) return fmtDate(v);
    const obj = v as {
      richText?: Array<{ text: string }>;
      result?: unknown;
      text?: string;
    };
    if (Array.isArray(obj.richText)) return obj.richText.map((r) => r.text).join('');
    if (obj.result !== undefined) return String(obj.result);
    if (obj.text) return obj.text;
  }
  return String(v);
}

export function fmtDate(d: Date | null): string {
  if (!d || Number.isNaN(+d)) return '';
  return d
    .toLocaleDateString('en-GB', {
      timeZone: 'UTC',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
    .replace(/\//g, '-');
}

function parseFlexibleDate(raw: unknown): Date | null {
  if (raw instanceof Date && !Number.isNaN(+raw)) {
    return new Date(Date.UTC(raw.getUTCFullYear(), raw.getUTCMonth(), raw.getUTCDate()));
  }
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const dm = s.match(/^(\d{1,2})[-/\s]([A-Za-z]{3})[-/\s](\d{2,4})\b/);
  if (dm) {
    const monthIdx = MON[dm[2].toLowerCase()];
    if (monthIdx !== undefined) {
      const y = dm[3].length === 2 ? 2000 + Number(dm[3]) : Number(dm[3]);
      return new Date(Date.UTC(y, monthIdx, Number(dm[1])));
    }
  }
  const nm = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (nm) {
    const y = nm[3].length === 2 ? 2000 + Number(nm[3]) : Number(nm[3]);
    return new Date(Date.UTC(y, Number(nm[2]) - 1, Number(nm[1])));
  }
  return null;
}

function toks(s: string): string[] {
  return String(s || '')
    .toLowerCase()
    .replace(/\(\d+\)|[_\-&.,]/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !NOISE.has(t) && !/^\d+$/.test(t));
}

function lcs(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m || !n) return 0;
  let prev = Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    const cur = [0];
    for (let j = 1; j <= n; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    }
    prev = cur;
  }
  return (2 * prev[n]) / (m + n);
}

export function nameScore(a: string, b: string): number {
  const ta = toks(a);
  const tb = toks(b);
  if (!ta.length || !tb.length) return 0;
  const sa = new Set(ta);
  const sb = new Set(tb);
  let overlap = 0;
  sa.forEach((t) => {
    if (sb.has(t)) overlap++;
  });
  return Math.max(
    (0.9 * overlap) / Math.min(sa.size, sb.size),
    lcs([...ta].sort().join(' '), [...tb].sort().join(' '))
  );
}

function computeTotals(rows: LedgerLine[]) {
  const drTotal = rows.filter((l) => l.side === 'Dr').reduce((t, l) => t + l.amt, 0);
  const crTotal = rows.filter((l) => l.side === 'Cr').reduce((t, l) => t + l.amt, 0);
  return {
    drTotal,
    crTotal,
    balanced: rows.length > 0 && Math.abs(drTotal - crTotal) < 1,
  };
}

export function parseLines(
  lines: string[],
  fname: string,
  af?: boolean,
  sourceKind: LedgerSourceKind = 'text',
  previewUrl?: string
): ParsedLedger {
  let header = '';
  const li = lines.findIndex((l) => /Ledger Account/i.test(l));
  for (let j = li - 1; j >= Math.max(0, li - 4); j--) {
    if (lines[j] && lines[j].trim()) {
      header = lines[j].trim();
      break;
    }
  }
  if (!header) {
    const firstNonVoucher = lines.find(
      (l) =>
        l.trim().length > 3 &&
        !/^(?:Dr|Cr)\b/i.test(l.trim()) &&
        !/^\d{1,2}[-/][A-Za-z0-9]{2,3}[-/]\d{2,4}/.test(l.trim()) &&
        !/particulars|vch type|debit|credit|opening balance|closing balance|page\s+\d+/i.test(l)
    );
    if (firstNonVoucher) header = firstNonVoucher.trim().slice(0, 80);
  }

  const out: LedgerLine[] = [];
  let cur: Date | null = null;
  const isAfter = af ?? /after ?sales|service/i.test(fname);

  for (const rawLine of lines) {
    const ln = rawLine.replace(/[|]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!ln) continue;

    const dm = ln.match(/^(\d{1,2})[-/]([A-Za-z]{3})[-/](\d{2,4})\b/);
    if (dm) {
      const parsed = parseFlexibleDate(`${dm[1]}-${dm[2]}-${dm[3]}`);
      if (parsed) cur = parsed;
    } else {
      const dmNum = ln.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
      if (dmNum) {
        const parsed = parseFlexibleDate(`${dmNum[1]}-${dmNum[2]}-${dmNum[3]}`);
        if (parsed) cur = parsed;
      }
    }

    const s = ln.match(
      /^(?:\d{1,2}[-/][A-Za-z0-9]{2,3}[-/]\d{2,4}\s+)?(Dr|Cr)\.?\s+(.*)$/i
    );
    if (!s) continue;
    const side = s[1].toLowerCase() === 'dr' ? 'Dr' : 'Cr';

    const a = s[2].match(/\s([\d,]+(?:\.\d{1,2})?)\s*(?:Dr|Cr)?\s*$/i);
    if (!a || a.index === undefined) continue;
    const amt = parseFloat(a[1].replace(/,/g, ''));
    if (!Number.isFinite(amt) || amt <= 0) continue;

    let body = s[2].slice(0, a.index).trim();
    const v = body.match(/(\S*\d\S*)$/);
    const vno = v ? v[1] : '';
    if (v && v.index !== undefined) body = body.slice(0, v.index).trim();

    let vt = '';
    for (const t of VT) {
      if (body.toLowerCase().endsWith(t.toLowerCase())) {
        vt = t;
        body = body.slice(0, -t.length).trim();
        break;
      }
    }

    if (!body) continue;

    out.push({
      date: cur,
      side,
      part: body,
      vt,
      vno,
      amt,
      src: fname,
      after: isAfter,
    });
  }

  const totals = computeTotals(out);
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    file: fname,
    header,
    rows: out,
    after: isAfter,
    sourceKind,
    previewUrl,
    rawText: lines.join('\n'),
    ...totals,
  };
}

// Lazy serialized Tesseract OCR worker
let ocrWorkerPromise: Promise<TesseractWorker> | null = null;
let ocrQueue: Promise<unknown> = Promise.resolve();

async function getOcrWorker(): Promise<TesseractWorker> {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = createWorker('eng', 1).catch((err) => {
      ocrWorkerPromise = null;
      throw err;
    });
  }
  return ocrWorkerPromise;
}

async function prepareImageForOcr(input: File | Blob | HTMLCanvasElement | string): Promise<HTMLCanvasElement> {
  if (input instanceof HTMLCanvasElement) {
    return input;
  }
  const url = typeof input === 'string' ? input : URL.createObjectURL(input);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Failed to decode image for OCR'));
      el.src = url;
    });
    const scale = img.naturalWidth < 1100 ? 1.8 : 1.0;
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(img.naturalWidth * scale));
    cv.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = cv.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.filter = 'contrast(1.12)';
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
    }
    return cv;
  } finally {
    if (typeof input !== 'string') URL.revokeObjectURL(url);
  }
}

export function runSerializedOcr(
  input: File | Blob | HTMLCanvasElement | string,
  onStatus?: (msg: string) => void
): Promise<string> {
  const task = ocrQueue.then(async () => {
    onStatus?.('Preparing image for OCR…');
    const canvas = await prepareImageForOcr(input);
    onStatus?.('Initializing browser OCR engine…');
    const worker = await getOcrWorker();
    onStatus?.('Reading text from screenshot…');
    const { data } = await worker.recognize(canvas);
    return data.text || '';
  });
  ocrQueue = task.catch(() => '');
  return task;
}

export async function parsePdfLedgerFile(
  file: File,
  autoOcr = true,
  onProgress?: (msg: string) => void
): Promise<ParsedLedger> {
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const lines: string[] = [];
  let usedOcr = false;

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    const rows: Array<{ y: number; t: Array<{ x: number; s: string }> }> = [];
    for (const item of tc.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      const y = item.transform[5];
      let row = rows.find((r) => Math.abs(r.y - y) < 3);
      if (!row) {
        row = { y, t: [] };
        rows.push(row);
      }
      row.t.push({ x: item.transform[4], s: item.str.trim() });
    }

    const pageLines = rows
      .sort((a, b) => b.y - a.y)
      .map((r) =>
        r.t
          .sort((a, b) => a.x - b.x)
          .map((t) => t.s)
          .join(' ')
      );

    const charCount = pageLines.join('').replace(/\s+/g, '').length;
    if (charCount < 25 && autoOcr) {
      usedOcr = true;
      onProgress?.(`Scanned PDF detected — OCR reading ${file.name} page ${p}/${pdf.numPages}…`);
      const vp = page.getViewport({ scale: 2.0 });
      const cv = document.createElement('canvas');
      cv.width = vp.width;
      cv.height = vp.height;
      const ctx = cv.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, cv.width, cv.height);
        await page.render({ canvasContext: ctx, viewport: vp, canvas: cv }).promise;
        const ocrText = await runSerializedOcr(cv);
        ocrText
          .split(/\r?\n/)
          .map((x) => x.trim())
          .filter(Boolean)
          .forEach((x) => lines.push(x));
      }
    } else {
      lines.push(...pageLines);
    }
  }

  return parseLines(lines, file.name, undefined, usedOcr ? 'pdf-ocr' : 'pdf');
}

export async function parseSpreadsheetLedgerFile(file: File): Promise<ParsedLedger> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '' });
  const sourceKind: LedgerSourceKind = /\.csv$/i.test(file.name) ? 'csv' : 'excel';
  const isAfter = /after ?sales|service/i.test(file.name);

  // Check if structured Tally export with Date / Particulars / Debit / Credit columns
  let headerIdx = -1;
  let dateCol = -1;
  let partCol = -1;
  let vtCol = -1;
  let vnoCol = -1;
  let drCol = -1;
  let crCol = -1;
  let ledgerHeader = '';

  for (let i = 0; i < Math.min(20, matrix.length); i++) {
    const rowNorm = matrix[i].map((c) => norm(cellTxt(c)));
    const pIdx = rowNorm.findIndex((c) => /particulars|account|ledger/.test(c));
    const dIdx = rowNorm.findIndex((c) => c === 'debit' || c === 'dr' || c === 'debit amount');
    const cIdx = rowNorm.findIndex((c) => c === 'credit' || c === 'cr' || c === 'credit amount');
    if (pIdx >= 0 && (dIdx >= 0 || cIdx >= 0)) {
      headerIdx = i;
      partCol = pIdx;
      drCol = dIdx;
      crCol = cIdx;
      dateCol = rowNorm.findIndex((c) => c === 'date' || c.includes('vch date'));
      vtCol = rowNorm.findIndex((c) => /vch type|voucher type/.test(c));
      vnoCol = rowNorm.findIndex((c) => /vch no|voucher no/.test(c));
      for (let j = i - 1; j >= 0; j--) {
        const txt = matrix[j].map(cellTxt).join(' ').trim();
        if (txt && !/ledger account/i.test(txt)) {
          ledgerHeader = txt.slice(0, 80);
          break;
        }
      }
      break;
    }
  }

  if (headerIdx >= 0) {
    const parsedRows: LedgerLine[] = [];
    let lastDate: Date | null = null;
    for (let r = headerIdx + 1; r < matrix.length; r++) {
      const row = matrix[r];
      const part = cellTxt(row[partCol]).trim();
      if (!part || /^(closing balance|opening balance|total|by balance|to balance)/i.test(part)) {
        continue;
      }
      const d = dateCol >= 0 ? parseFlexibleDate(row[dateCol]) : null;
      if (d) lastDate = d;
      const vt = vtCol >= 0 ? cellTxt(row[vtCol]).trim() : '';
      const vno = vnoCol >= 0 ? cellTxt(row[vnoCol]).trim() : '';
      const drAmt =
        drCol >= 0 ? parseFloat(String(row[drCol] ?? '').replace(/,/g, '')) || 0 : 0;
      const crAmt =
        crCol >= 0 ? parseFloat(String(row[crCol] ?? '').replace(/,/g, '')) || 0 : 0;
      if (drAmt > 0) {
        parsedRows.push({
          date: lastDate,
          side: 'Dr',
          part: part.replace(/^(Dr|Cr)\s+/i, '').trim(),
          vt,
          vno,
          amt: drAmt,
          src: file.name,
          after: isAfter,
        });
      }
      if (crAmt > 0) {
        parsedRows.push({
          date: lastDate,
          side: 'Cr',
          part: part.replace(/^(Dr|Cr)\s+/i, '').trim(),
          vt,
          vno,
          amt: crAmt,
          src: file.name,
          after: isAfter,
        });
      }
    }
    if (parsedRows.length > 0) {
      const totals = computeTotals(parsedRows);
      return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file: file.name,
        header: ledgerHeader,
        rows: parsedRows,
        after: isAfter,
        sourceKind,
        ...totals,
      };
    }
  }

  // Fallback to text-line parsing
  const textLines = matrix
    .map((row) => row.map((c) => cellTxt(c).trim()).filter(Boolean).join(' '))
    .filter(Boolean);
  return parseLines(textLines, file.name, isAfter, sourceKind);
}

export async function parseImageLedgerFile(
  file: File,
  onProgress?: (msg: string) => void
): Promise<ParsedLedger> {
  const previewUrl = URL.createObjectURL(file);
  const text = await runSerializedOcr(file, onProgress);
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const parsed = parseLines(lines, file.name, undefined, 'image-ocr', previewUrl);
  parsed.rawText = text;
  return parsed;
}

export function dealFromText(t: string): { vin: string; cust: string; vcpl: string; mar: string } {
  const raw = String(t || '');
  const s = raw.replace(/\s+/g, ' ');

  // Match VIN cleanly (handle occasional spaces inside OCR text)
  const compact = s.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const vinMatch =
    s.toUpperCase().replace(/\s+/g, '').match(/W[A-Z0-9]{2}[A-Z0-9]{14}/) ||
    compact.match(/W[A-Z0-9]{16}/) ||
    s.toUpperCase().replace(/\s+/g, '').match(/[A-HJ-NPR-Z0-9]{17}/);

  const custMatch =
    s.match(
      /(?:Customer Name|Buyer Name|Client Name|Party Name|Delivered To)\s*[:\-]?\s*(.+?)(?=\s+(?:Road Tax|Ex[- ]?showroom|BMW|VCPL|Model|VIN|Chassis|Date|Mobile|Phone|Sales|SC\b|$)|$)/i
    ) || raw.match(/^\s*(?:Customer Name|Customer)\s*[:\-]\s*(.+)$/im);

  const vcplMatch = s.match(
    /(?:VCPL\s*Discount|Dealer\s*Discount|Special\s*Discount|Cash\s*Discount|VCPL\s*Disc\.?|Discount\s*\(?VCPL\)?)\s*[:\-]?\s*(?:₹|Rs\.?|INR)?\s*([\d,]+(?:\.\d{1,2})?)/i
  );

  const marMatch = s.match(
    /(?:Total\s*Retained\s*Margin|Retained\s*Margin|Net\s*Margin|Dealer\s*Margin)\s*[:\-]?\s*(?:₹|Rs\.?|INR)?\s*(-?[\d,]+(?:\.\d{1,2})?)/i
  );

  return {
    vin: vinMatch ? vinMatch[0] : '',
    cust: custMatch ? custMatch[1].trim().replace(/[:\-|]+$/, '').trim() : '',
    vcpl: vcplMatch ? vcplMatch[1].replace(/,/g, '') : '',
    mar: marMatch ? marMatch[1].replace(/,/g, '') : '',
  };
}

export async function parseSpreadsheetDealSheets(file: File): Promise<DealSheetShot[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '' });
  if (!matrix.length) return [];

  const hdr = matrix[0].map((c) => norm(cellTxt(c)));
  const vinCol = hdr.findIndex((h) => h.includes('vin') || h.includes('chassis'));
  const custCol = hdr.findIndex((h) => h.includes('customer') || h.includes('delivered') || h.includes('party'));
  const vcplCol = hdr.findIndex((h) => h.includes('vcpl') || h.includes('discount'));
  const marCol = hdr.findIndex((h) => h.includes('margin') || h.includes('retained'));

  if (vinCol >= 0 || custCol >= 0) {
    const out: DealSheetShot[] = [];
    for (let r = 1; r < matrix.length; r++) {
      const row = matrix[r];
      const vin = vinCol >= 0 ? cellTxt(row[vinCol]).trim().toUpperCase() : '';
      const cust = custCol >= 0 ? cellTxt(row[custCol]).trim() : '';
      const vcpl = vcplCol >= 0 ? cellTxt(row[vcplCol]).replace(/,/g, '').trim() : '';
      const mar = marCol >= 0 ? cellTxt(row[marCol]).replace(/,/g, '').trim() : '';
      if (!vin && !cust && !vcpl && !mar) continue;
      out.push({
        id: `${Date.now()}-${r}-${Math.random().toString(36).slice(2, 7)}`,
        name: `${file.name} #${r}`,
        url: '',
        sourceKind: 'spreadsheet',
        vin,
        cust,
        vcpl: vcpl.replace(/[^\d.-]/g, ''),
        mar: mar.replace(/[^\d.-]/g, ''),
        ocrStatus: 'done',
      });
    }
    return out;
  }

  // Fallback: extract text per row or block
  const fullText = matrix.map((r) => r.map(cellTxt).join(' ')).join('\n');
  const parsed = dealFromText(fullText);
  return [
    {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: file.name,
      url: '',
      sourceKind: 'spreadsheet',
      vin: parsed.vin,
      cust: parsed.cust,
      vcpl: parsed.vcpl,
      mar: parsed.mar,
      ocrStatus: 'done',
      rawText: fullText,
    },
  ];
}

export async function loadWorkbookFromInput(
  tplFile: File | null,
  pastedExcelText: string
): Promise<{ wb: ExcelJS.Workbook; ws: ExcelJS.Worksheet; isFromInput: boolean }> {
  const wb = new ExcelJS.Workbook();
  let ws: ExcelJS.Worksheet;
  const trimmed = pastedExcelText.trim();

  if (tplFile) {
    if (/\.xlsx$/i.test(tplFile.name)) {
      await wb.xlsx.load(await tplFile.arrayBuffer());
      ws = wb.worksheets[0];
    } else {
      // .xls, .csv, .tsv via SheetJS
      const parsed = XLSX.read(await tplFile.arrayBuffer(), { type: 'array', cellDates: true });
      const firstSheet = parsed.Sheets[parsed.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
        header: 1,
        raw: true,
        defval: '',
      });
      ws = wb.addWorksheet(parsed.SheetNames[0] || 'requested');
      rows.forEach((row) => ws.addRow(row));
    }
    return { wb, ws, isFromInput: true };
  }

  if (trimmed) {
    ws = wb.addWorksheet('requested');
    const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const delimiter = lines[0]?.includes('\t') ? '\t' : ',';
    lines.forEach((line) => {
      const cells =
        delimiter === '\t'
          ? line.split('\t').map((c) => c.trim())
          : line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
      ws.addRow(cells);
    });
    return { wb, ws, isFromInput: true };
  }

  ws = wb.addWorksheet('requested');
  ws.addRow(STD_HEADERS);
  return { wb, ws, isFromInput: false };
}

export async function inspectTemplatePreview(
  tplFile: File | null,
  pastedExcelText: string
): Promise<TemplateSheetPreview | null> {
  if (!tplFile && !pastedExcelText.trim()) return null;
  try {
    const { ws } = await loadWorkbookFromInput(tplFile, pastedExcelText);
    const headers: string[] = [];
    ws.getRow(1).eachCell({ includeEmpty: false }, (c) => {
      headers.push(cellTxt(c.value).trim());
    });
    const normHeaders = headers.map((h) => norm(h));
    const hasVin = normHeaders.some((h) => h === 'vin');
    const hasCustomer = normHeaders.some((h) => h === 'delivered to');
    const hasSc = normHeaders.some((h) => h === 'sold by');
    let dataRows = 0;
    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      let hasText = false;
      row.eachCell({ includeEmpty: false }, (c) => {
        if (cellTxt(c.value).trim()) hasText = true;
      });
      if (hasText) dataRows++;
    }
    return {
      sourceName: tplFile ? tplFile.name : 'Pasted Excel / CSV Grid',
      rowCount: dataRows,
      headers,
      hasVin,
      hasCustomer,
      hasSc,
      isValid: hasVin && hasCustomer,
    };
  } catch {
    return {
      sourceName: tplFile ? tplFile.name : 'Pasted text',
      rowCount: 0,
      headers: [],
      hasVin: false,
      hasCustomer: false,
      hasSc: false,
      isValid: false,
    };
  }
}

export function parseCustomRules(raw: string): Array<[string, RegExp]> {
  const out: Array<[string, RegExp]> = [];
  raw.split(/\n/).forEach((s) => {
    const i = s.indexOf('=');
    if (i < 1) return;
    const f = s.slice(0, i).trim();
    const q = s.slice(i + 1).trim();
    if (!FIELDS.has(f) || !q) return;
    try {
      out.push([f, new RegExp(q, 'i')]);
    } catch {
      // Ignore invalid regex line
    }
  });
  return out;
}

export function buildDealEvidence(
  lines: LedgerLine[],
  customRules: Array<[string, RegExp]>,
  noneLabel: string,
  countSpares: boolean
): Record<string, EvidenceTuple> {
  const classify = (l: LedgerLine): string => {
    for (const [f, rx] of [...customRules, ...RULES]) {
      if (rx.test(l.part)) {
        if (f === 'insurance' && /\bEW\b|warranty/i.test(l.part)) return 'ew';
        if (f === 'accessories' && !countSpares && !/accessor/i.test(l.part)) continue;
        return f;
      }
    }
    return 'other';
  };

  lines.forEach((l) => {
    const base = classify(l);
    l.f =
      l.after && ['accessories', 'other'].includes(base) && (countSpares || /accessor/i.test(l.part))
        ? 'accessories'
        : base;
  });

  const ev: Record<string, EvidenceTuple> = {};
  const by = (f: string) => lines.filter((l) => l.f === f);
  const sum = (a: LedgerLine[]) => a.reduce((t, l) => t + l.amt, 0);
  const fm = (a: LedgerLine[]) =>
    a
      .map((l) => `${l.vno} ${fmtDate(l.date)} ${l.part.slice(0, 38)} ${l.amt.toLocaleString('en-IN')}`)
      .join('; ');

  const sale = by('car_sale');
  const saleDates = sale.map((l) => (l.date ? +l.date : NaN)).filter((x) => !Number.isNaN(x));
  const sd = saleDates.length ? Math.min(...saleDates) : null;

  const rt = by('road_tax');
  const rtDates = rt.map((l) => (l.date ? +l.date : NaN)).filter((x) => !Number.isNaN(x));
  if (rt.length && rtDates.length) {
    ev.trpr_date = [
      new Date(Math.min(...rtDates)),
      fm(rt),
      'High',
      'Date of Life Tax / Registration voucher',
    ];
  }

  const ti = by('trade_in');
  ev.trade_in = [
    sum(ti),
    ti.length ? fm(ti) : 'No used-car voucher',
    ti.length ? 'High' : 'Medium',
    ti.length ? '' : 'Assumed 0, no trade-in voucher',
  ];

  for (const f of ['bsi', 'ew']) {
    const a = by(f);
    const L = f.toUpperCase();
    ev[f] = a.length
      ? ['Yes - Customer Paid', fm(a), 'High', `${L} billed to customer`]
      : [
          noneLabel,
          `No ${L} voucher`,
          'Medium',
          `${L} not billed, written as ‘${noneLabel || 'blank'}’. Confirm with the sales team`,
        ];
  }

  const acc = by('accessories');
  ev.acc_amount = [
    sum(acc),
    acc.length ? fm(acc) : 'No accessory voucher',
    'Medium',
    'Sale of Spares / Accessories vouchers. Verify these are accessories',
  ];

  const ad = by('acc_discount');
  if (ad.length) ev.acc_discount = [sum(ad), fm(ad), 'High', ''];

  const bk = lines.filter(
    (l) => l.f === 'booking' || (RCT.has(l.vt.toLowerCase()) && (!sd || (l.date && +l.date <= sd)))
  );
  const bkDates = bk.map((l) => (l.date ? +l.date : NaN)).filter((x) => !Number.isNaN(x));
  if (bk.length && bkDates.length) {
    const first = Math.min(...bkDates);
    const same = bk.filter((l) => l.date && +l.date === first);
    ev.booking_date = [
      new Date(first),
      fm(same),
      'Medium',
      'Earliest receipt on or before invoice date',
    ];
    ev.booking_amount = [sum(same), fm(same), 'Medium', 'Amount received on that date'];
  }

  const ds = by('dsa');
  ev.dsa = [ds.length ? 'YES' : 'NO', ds.length ? fm(ds) : 'No DSA voucher', ds.length ? 'High' : 'Medium', ''];

  const fin = by('finance');
  ev.finance_type = [
    fin.length ? 'Inhouse' : 'Full cash',
    fin.length ? fm(fin) : 'No finance voucher',
    fin.length ? 'High' : 'Medium',
    '',
  ];
  ev.finance_amount = [sum(fin), fm(fin), fin.length ? 'High' : 'Medium', ''];

  const ins = by('insurance');
  ev.insurance_co = [
    ins.length
      ? ins[0].part
          .replace(/\(.*?\)/g, '')
          .split(/\s-\s/)[0]
          .replace(/[ .-]+$/, '')
      : 'Outside / not in ledger',
    ins.length ? fm(ins) : 'No insurance voucher',
    ins.length ? 'High' : 'Medium',
    '',
  ];

  return ev;
}

export interface LiveDealRowSummary {
  row: number;
  cust: string;
  vin: string;
  sc: string;
  bookingDate: string;
  bookingAmt: string;
  trprDate: string;
  vcplDisc: string;
  accAmt: string;
  bsi: string;
  ew: string;
  marginFlag: string;
  ledgersMatched: number;
}

export function buildDealsMatrixRows(result: GeneratedReportResult): LiveDealRowSummary[] {
  const getCellStr = (row: number, field: string) => {
    const col = result.hdr[field];
    if (!col) return '';
    return cellTxt(result.ws.getCell(row, col).value).trim();
  };

  return result.deals.map((d) => ({
    row: d.row,
    cust: d.cust,
    vin: d.vin,
    sc: d.sc || '-',
    bookingDate: getCellStr(d.row, 'booking_date') || '-',
    bookingAmt: getCellStr(d.row, 'booking_amount') || '0',
    trprDate: getCellStr(d.row, 'trpr_date') || '-',
    vcplDisc: getCellStr(d.row, 'vcpl_discount') || '0',
    accAmt: getCellStr(d.row, 'acc_amount') || '0',
    bsi: getCellStr(d.row, 'bsi') || '-',
    ew: getCellStr(d.row, 'ew') || '-',
    marginFlag: getCellStr(d.row, 'margin_flag') || 'Blank',
    ledgersMatched: d.nl,
  }));
}

export function exportPdfAuditReport(params: {
  result: GeneratedReportResult;
  scSummary: Array<[string, { n: number; l: number; a: number; v: number }]>;
  marginLimit: number;
  thr: number;
}): void {
  const { result, scSummary, marginLimit, thr } = params;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const mX = 12;
  let y = 14;

  const checkPage = (needed = 14) => {
    if (y + needed > pageH - 14) {
      doc.addPage();
      y = 14;
    }
  };

  // Title Header Banner
  doc.setFillColor(47, 62, 78);
  doc.roundedRect(mX, y, pageW - mX * 2, 18, 2, 2, 'F');
  doc.setTextColor(249, 200, 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('VCPL Dealership Incentive Reconciliation & Audit Report', mX + 5, y + 7.5);
  doc.setTextColor(255, 253, 245);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(
    `Generated: ${new Date().toLocaleString('en-IN')}  |  Margin Limit: INR ${marginLimit.toLocaleString('en-IN')}  |  Match Threshold: ${thr}%`,
    mX + 5,
    y + 13.5
  );
  y += 23;

  // KPI Strip
  const kpis: Array<[string, string]> = [
    ['Cars Processed', String(result.deals.length)],
    ['Ledgers Matched', `${result.usedL} / ${result.total}`],
    ['To Verify (Medium)', String(result.review.filter((x) => x.c === 'Medium').length)],
    ['Missing Fields', String(result.review.filter((x) => x.c === 'Missing').length)],
    ['Audit Alerts', String(result.alerts.length)],
  ];
  const cardW = (pageW - mX * 2 - 12) / 5;
  kpis.forEach(([label, val], idx) => {
    const x = mX + idx * (cardW + 3);
    doc.setFillColor(254, 242, 200);
    doc.setDrawColor(47, 62, 78);
    doc.roundedRect(x, y, cardW, 14, 1.5, 1.5, 'FD');
    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(label, x + 3, y + 5);
    doc.setTextColor(47, 62, 78);
    doc.setFontSize(11);
    doc.text(val, x + 3, y + 11.2);
  });
  y += 19;

  // SC Summary Table
  if (scSummary.length > 0) {
    checkPage(24);
    doc.setTextColor(47, 62, 78);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text('Sales Consultant Summary', mX, y);
    y += 3;

    const cols = [75, 32, 42, 42, 60];
    const headers = ['Sold By', 'Cars Sold', 'Below Margin Limit', 'Above Margin Limit', 'Total VCPL Discount (INR)'];
    doc.setFillColor(47, 62, 78);
    doc.rect(mX, y, pageW - mX * 2, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    let cx = mX + 2;
    headers.forEach((h, i) => {
      doc.text(h, cx, y + 4.8);
      cx += cols[i];
    });
    y += 7;

    scSummary.forEach(([name, o], rIdx) => {
      checkPage(8);
      doc.setFillColor(rIdx % 2 === 0 ? 255 : 250, rIdx % 2 === 0 ? 253 : 246, rIdx % 2 === 0 ? 245 : 230);
      doc.rect(mX, y, pageW - mX * 2, 6.5, 'F');
      doc.setTextColor(47, 62, 78);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      let rx = mX + 2;
      [name, String(o.n), String(o.l), String(o.a), o.v.toLocaleString('en-IN')].forEach((val, i) => {
        doc.text(val.slice(0, 38), rx, y + 4.5);
        rx += cols[i];
      });
      y += 6.5;
    });
    y += 6;
  }

  // Reconciled Deals Matrix
  const matrix = buildDealsMatrixRows(result);
  if (matrix.length > 0) {
    checkPage(24);
    doc.setTextColor(47, 62, 78);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text(`Reconciled Deals Matrix (${matrix.length})`, mX, y);
    y += 3;

    const dCols = [52, 39, 32, 24, 24, 24, 24, 24, 30];
    const dHeaders = ['Customer', 'VIN', 'Sold By', 'Booking Dt', 'Booking Amt', 'TR/PR Dt', 'VCPL Disc', 'Acc Amt', 'Margin Flag'];
    const drawDealsHeader = () => {
      doc.setFillColor(47, 62, 78);
      doc.rect(mX, y, pageW - mX * 2, 7, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      let dx = mX + 2;
      dHeaders.forEach((h, i) => {
        doc.text(h, dx, y + 4.8);
        dx += dCols[i];
      });
      y += 7;
    };
    drawDealsHeader();

    matrix.forEach((row, rIdx) => {
      if (y + 7 > pageH - 14) {
        doc.addPage();
        y = 14;
        drawDealsHeader();
      }
      doc.setFillColor(rIdx % 2 === 0 ? 255 : 248, rIdx % 2 === 0 ? 253 : 246, rIdx % 2 === 0 ? 245 : 235);
      doc.rect(mX, y, pageW - mX * 2, 6.5, 'F');
      doc.setTextColor(47, 62, 78);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      let dx = mX + 2;
      const vals = [
        row.cust,
        row.vin || '-',
        row.sc,
        row.bookingDate,
        row.bookingAmt,
        row.trprDate,
        row.vcplDisc,
        row.accAmt,
        row.marginFlag,
      ];
      vals.forEach((v, i) => {
        doc.text(String(v).slice(0, i === 0 ? 28 : 20), dx, y + 4.5);
        dx += dCols[i];
      });
      y += 6.5;
    });
    y += 6;
  }

  // Audit Alerts
  if (result.alerts.length > 0) {
    checkPage(20);
    doc.setTextColor(47, 62, 78);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text(`Audit Alerts (${result.alerts.length})`, mX, y);
    y += 5;
    result.alerts.forEach(([sev, msg]) => {
      const wrapped = doc.splitTextToSize(`[${sev}] ${msg}`, pageW - mX * 2 - 4);
      checkPage(wrapped.length * 4.5 + 2);
      doc.setTextColor(sev === 'High' ? 158 : 146, sev === 'High' ? 42 : 64, sev === 'High' ? 43 : 14);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(wrapped, mX + 2, y);
      y += wrapped.length * 4.5 + 1.5;
    });
  }

  // Page Footers
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`VCPL Tools · Local Incentive Reconciliation Report  |  Page ${p} of ${pages}`, mX, pageH - 6);
  }

  doc.save('Incentive_Audit_Report.pdf');
}
