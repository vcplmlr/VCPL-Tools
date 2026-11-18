import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  ExtractedPageRows,
  InvoiceLineItem,
  InvoiceRecord,
} from '../types/invoice';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface RawWordItem {
  str: string;
  x: number;
  y: number;
  w: number;
}

interface PositionedWord {
  s: string;
  x: number;
  x2: number;
  y: number;
}

interface LineSegment {
  t: string;
  x: number;
  x2: number;
}

interface PdfLine {
  y: number;
  w: PositionedWord[];
  t: string;
  segs: LineSegment[];
}

type ColKindType =
  | 'sl'
  | 'mat'
  | 'desc'
  | 'hsn'
  | 'qty'
  | 'uom'
  | 'price'
  | 'gross'
  | 'disc'
  | 'net'
  | 'amt'
  | 'tax'
  | 'cess'
  | 'skip';

interface ColKind {
  k: ColKindType;
  ty?: 'IGST' | 'CGST' | 'SGST' | 'GST';
  md?: 'r' | 'a' | '?';
}

interface TableColumn {
  t: string;
  x: number;
  x2: number;
  k: ColKind;
}

interface TableParserState {
  cols: TableColumn[] | null;
  done: boolean;
  cur: (InvoiceLineItem & { _r: Record<string, number>; _amt: number }) | null;
  pageIdx: number;
  lastItemPage: number;
  lastItemY: number | null;
  tableDisc: number;
  tableTaxes: { IGST: number; CGST: number; SGST: number; CESS: number };
  tableRoundOff: number;
  tablePrintedTotal: number;
}

export const round2 = (x: number): number => Math.round((x + Number.EPSILON) * 100) / 100;

export function parseNumber(raw: unknown): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  const str = String(raw ?? '').trim();
  if (!str) return 0;
  const isNeg =
    /^\(\s*-?\s*\)/.test(str) ||
    str.startsWith('(-)') ||
    str.startsWith('-') ||
    (/^\(.*\)$/.test(str) && !/\(-\)/.test(str) && /\d/.test(str));
  const cleaned = str.replace(/[^0-9.]/g, '');
  if (!cleaned) return 0;
  const val = parseFloat(cleaned);
  if (!Number.isFinite(val)) return 0;
  return isNeg ? -val : val;
}

const isDateLikeToken = (s: string): boolean =>
  /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(s) ||
  /^\d{1,2}-[A-Za-z]{3}-\d{2,4}$/.test(s);

const isNumericToken = (s: string): boolean =>
  /^(\(-\)|\(|\+|-)?[\d,]*\.?\d+\)?%?$/.test(s) && !isDateLikeToken(s);

const cleanDescPrefix = (s: string): string => s.replace(/\s+/g, ' ').trim();

// GSTIN validation & Indian states map
const GST_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function gstinChecksum(base14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const val = GST_CHARS.indexOf(base14[i]) * (i % 2 === 1 ? 2 : 1);
    sum += Math.floor(val / 36) + (val % 36);
  }
  return GST_CHARS[(36 - (sum % 36)) % 36];
}

export function isValidGstin(gstin: string): boolean {
  const g = (gstin || '').trim().toUpperCase();
  if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g)) return false;
  return gstinChecksum(g) === g[14];
}

export function makeSampleGstin(base14: string): string {
  return base14 + gstinChecksum(base14);
}

export const INDIAN_STATES: Record<string, string> = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli and Daman & Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
  '97': 'Other Territory',
  '99': 'Centre Jurisdiction',
};

export const STANDARD_GST_SLABS = [0, 0.25, 1.5, 3, 5, 12, 18, 28, 40];

const MONTHS: Record<string, number> = {
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

function makeValidDate(y: number, m: number, d: number): Date | null {
  const dt = new Date(y, m, d);
  return dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d ? dt : null;
}

export function parseInvoiceDate(raw: string): Date | null {
  const s = String(raw || '').trim();
  if (!s) return null;

  // YYYY-MM-DD
  let m = s.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (m) return makeValidDate(+m[1], +m[2] - 1, +m[3]);

  // DD/MM/YYYY or DD.MM.YYYY or DD-MM-YY
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (m) {
    let y = +m[3];
    if (y < 100) y += 2000;
    return makeValidDate(y, +m[2] - 1, +m[1]);
  }

  // DD-MMM-YY or DD MMM YYYY
  m = s.match(/^(\d{1,2})[\s-]+([A-Za-z]{3})[A-Za-z]*[\s,-]*(\d{2,4})$/);
  if (m) {
    let y = +m[3];
    if (y < 100) y += 2000;
    const mo = MONTHS[m[2].toLowerCase()];
    return mo === undefined ? null : makeValidDate(y, mo, +m[1]);
  }
  return null;
}

function mkWords(items: RawWordItem[]): PositionedWord[] {
  const out: PositionedWord[] = [];
  for (const it of items) {
    const s = it.str || '';
    if (!s.trim()) continue;
    const cw = (it.w || s.length * 5) / s.length;
    for (const m of s.matchAll(/\S+/g)) {
      const idx = m.index ?? 0;
      out.push({
        s: m[0],
        x: it.x + idx * cw,
        x2: it.x + (idx + m[0].length) * cw,
        y: it.y,
      });
    }
  }
  return out;
}

function mkLines(words: PositionedWord[], gap = 16): PdfLine[] {
  const sorted = words.slice().sort((a, b) => b.y - a.y);
  const grouped: { y: number; w: PositionedWord[] }[] = [];
  for (const w of sorted) {
    const last = grouped[grouped.length - 1];
    if (last && Math.abs(last.y - w.y) <= 2.6) {
      last.w.push(w);
    } else {
      grouped.push({ y: w.y, w: [w] });
    }
  }
  return grouped.map((g) => {
    g.w.sort((a, b) => a.x - b.x);
    const t = g.w.map((w) => w.s).join(' ');
    const segs: LineSegment[] = [];
    let cur: LineSegment | null = null;
    for (const w of g.w) {
      if (cur && w.x - cur.x2 <= gap) {
        cur.t += ' ' + w.s;
        cur.x2 = w.x2;
      } else {
        cur = { t: w.s, x: w.x, x2: w.x2 };
        segs.push(cur);
      }
    }
    return { y: g.y, w: g.w, t, segs };
  });
}

const KW = {
  desc: /descr|particular|item\s*name|goods|product|material/i,
  hsn: /hsn|sac/i,
  qty: /\bqty|quantit|\bnos\b/i,
  price: /rate|price|mrp/i,
  amt: /amount|value|total/i,
  tax: /gst|tax/i,
};

const headerScore = (t: string): number =>
  Object.values(KW).filter((r) => r.test(t)).length;

const ST_SPLIT =
  /^(gross|net|discount|disc\.?|rate|price|amount|amt|taxable|unit|total|cgst|sgst|igst|utgst|gst|tax|qty\.?|uom|quantity|hsn\/?sac|hsn|sac|description|particulars|material|materialno\.?|item|sl\.?|no\.?|mrp|cess|per|task)$/i;
const EN_SPLIT =
  /^(value|price|amount|amt|quantity|qty\.?|uom|discount|disc\.?|rate|%|description|item|no\.?|goods|particulars|per|task)$/i;

function splitPhrases(line: PdfLine, gap = 7): LineSegment[] {
  const out: LineSegment[] = [];
  let cur: LineSegment | null = null;
  let prev: PositionedWord | null = null;
  for (const w of line.w) {
    if (
      cur &&
      w.x - cur.x2 <= gap &&
      !(prev && ST_SPLIT.test(w.s) && EN_SPLIT.test(prev.s))
    ) {
      cur.t += ' ' + w.s;
      cur.x2 = w.x2;
    } else {
      cur = { t: w.s, x: w.x, x2: w.x2 };
      out.push(cur);
    }
    prev = w;
  }
  return out;
}

function classifyColumn(title: string): ColKind {
  const l = title.toLowerCase().trim();
  if (/hsn|sac/.test(l)) return { k: 'hsn' };
  if (/taxable/.test(l)) return { k: 'net' };
  if (/\bcess\b/.test(l)) return { k: 'cess' };
  const taxMatch = l.match(/igst|cgst|sgst|utgst|\bgst|\btax|\bvat/);
  if (taxMatch) {
    const ty = /igst/.test(l)
      ? 'IGST'
      : /cgst/.test(l)
        ? 'CGST'
        : /sgst|utgst/.test(l)
          ? 'SGST'
          : 'GST';
    const md = /%|rate/.test(l) ? 'r' : /amt|amount|value/.test(l) ? 'a' : '?';
    return { k: 'tax', ty, md };
  }
  if (/disc/.test(l)) return { k: 'disc' };
  if (/gross/.test(l)) return { k: /price|rate/.test(l) ? 'price' : 'gross' };
  if (/qty|quantit/.test(l)) return { k: 'qty' };
  if (/material\s*no|part\s*(no|code)|item\s*code|sku/.test(l)) return { k: 'mat' };
  if (/^per$|^\buom\b$|^\bunit\b$/.test(l)) return { k: 'uom' };
  if (/\btask\b/.test(l)) return { k: 'skip' };
  if (/price|rate|mrp/.test(l)) return { k: 'price' };
  if (/net/.test(l)) return { k: 'net' };
  if (/amount|value|total/.test(l)) return { k: 'amt' };
  if (/^(item|sl\.?|s\.?\s*no\.?|sr\.?|#|sl\.?\s*no\.?|item\s*no\.?|no\.?)$/.test(l))
    return { k: 'sl' };
  if (/desc|particular|item|goods|product|name/.test(l)) return { k: 'desc' };
  return { k: 'skip' };
}

function buildColumns(h1: PdfLine, h2: PdfLine | null): TableColumn[] {
  const p1 = splitPhrases(h1);
  let rawCols: LineSegment[] = [];

  if (h2) {
    const p2 = splitPhrases(h2);
    const used = new Set<LineSegment>();
    for (const a of p1) {
      const children = p2.filter(
        (b) => Math.min(a.x2, b.x2) - Math.max(a.x, b.x) > -4
      );
      if (children.length && /gst|tax|disc|cess|vat|unit|qty|sl/i.test(a.t)) {
        if (children.length === 1 && !/gst|tax|cess/i.test(a.t)) {
          used.add(children[0]);
          rawCols.push({
            t: `${a.t} ${children[0].t}`,
            x: Math.min(a.x, children[0].x),
            x2: Math.max(a.x2, children[0].x2),
          });
        } else {
          children.forEach((b) => {
            used.add(b);
            rawCols.push({ t: `${a.t} ${b.t}`, x: b.x, x2: b.x2 });
          });
        }
      } else {
        rawCols.push(a);
      }
    }
    p2.forEach((b) => {
      if (used.has(b)) return;
      const parent = p1
        .filter(
          (a) => /gst|tax|disc|cess|vat|unit|sl/i.test(a.t) && a.x <= b.x + 20 && b.x - a.x < 130
        )
        .pop();
      if (parent && /^(amt|amount|rate|%|value|price|no\.?)$/i.test(b.t.trim())) {
        rawCols.push({ t: `${parent.t} ${b.t}`, x: b.x, x2: b.x2 });
      } else {
        rawCols.push(b);
      }
    });
  } else {
    rawCols = p1;
  }

  const cols: TableColumn[] = rawCols
    .sort((a, b) => a.x - b.x)
    .map((c) => ({ ...c, k: classifyColumn(c.t) }));

  cols.forEach((c, idx) => {
    const next = cols[idx + 1];
    if (next && /^(sl|mat|desc|hsn)$/.test(c.k.k)) {
      c.x2 = Math.max(c.x2, next.x - 2);
    }
  });
  return cols;
}

function columnOfWord(w: PositionedWord, cols: TableColumn[]): TableColumn | null {
  let best: TableColumn | null = null;
  let bestOverlap = 0;
  for (const c of cols) {
    const overlap = Math.min(w.x2, c.x2) - Math.max(w.x, c.x);
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      best = c;
    }
  }
  if (best) return best;
  let bestDist = Infinity;
  const wx = (w.x + w.x2) / 2;
  for (const c of cols) {
    const d = Math.abs(wx - (c.x + c.x2) / 2);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

const isTableHeaderLine = (l: PdfLine, next?: PdfLine): boolean => {
  const combined = l.t + ' ' + (next ? next.t : '');
  const s1 = headerScore(l.t);
  const sComb = headerScore(combined);
  const hasDescOrQty = KW.desc.test(combined) && (KW.qty.test(combined) || KW.amt.test(combined));
  return s1 >= 2 && sComb >= 3 && hasDescOrQty && !/\d+\.\d{2}/.test(l.t);
};

const isHeaderContinuationLine = (h1: PdfLine, n?: PdfLine): boolean => {
  if (!n) return false;
  if (h1.y - n.y >= 18) return false;
  if (/\d+\.\d{2}/.test(n.t)) return false;
  if (n.w.length > 12) return false;
  // Never treat line-item sub-rows (HSN/SAC codes, tax sublines, part codes, or item numbers) as header rows
  if (/\b(?:HSN\s*\/?\s*SAC|HSN(?:\s*Code)?|SAC(?:\s*Code)?)\s*[-:.#]?\s*\d{4,8}\b/i.test(n.t)) {
    return false;
  }
  if (/@\s*\d|\b(?:IGST|CGST|SGST|UTGST|CESS)\b.*\d/i.test(n.t)) return false;
  if (/\b\d{4,}\b/.test(n.t) || /^\d{3,4}\s+/.test(n.t)) return false;
  return headerScore(n.t) >= 1 || /\b(no\.?|price|%|uom|amount|rate)\b/i.test(n.t);
};

const STOP_RE =
  /^(sub\s*-?total|total\b|grand\s*total|taxable\s*value\s+[\d,]|invoice\s*(amount|total)|amount\s*(in\s*words|chargeable)|bank\s*(details|name)|terms\s*(&|and)|declaration|in\s*words|bmw\s+parts\b|total\s+amount\s+incl)/i;

const FOOTER_NOISE_RE =
  /^(company$|bmw\s+india|private\s+limited$|a\s+bmw\s+group|registered\s*(&|office)|2nd\s+floor|no\.\s*\d+,?$|dlf\s+cyber|gurugram|haryana|cop?orate\s+identity|pan\s+number|telephone|fax$|email$|internet$|www\.|page\s+\d|print\s+date|customer\s*:|address\s*:|po\s+box\b|place\s+of\s+supply|invoice\s+(no|date)|order\s+number|delivery\s+no|po\s+number|vmpp\d+)/i;

const TAX_SUBLINE_RE =
  /\b(IGST|CGST|SGST|UTGST)\b[^\d\n]{0,12}?([\d.]+)\s*%[^\d\n]{0,10}?([\d,]+\.\d{2})/gi;

const LEDGER_DISCOUNT_RE = /^less\s*[:\-]?\s*(discount[^0-9(-]*)/i;
const LEDGER_TAX_RE = /^(IGST|CGST|SGST|UTGST|CESS)\b(?:\s*@?\s*([\d.]+)\s*%)?\s+[\d,]+\.\d{2}/i;
const LEDGER_ROUND_RE = /^round\s*off\.?\s*([-+]?\s*[\d,]+\.\d{2})/i;

function parseTablePage(lines: PdfLine[], st: TableParserState): InvoiceLineItem[] {
  const pageItems: InvoiceLineItem[] = [];
  let startIdx = 0;

  if (!st.cols) {
    let hi = -1;
    for (let i = 0; i < lines.length; i++) {
      if (isTableHeaderLine(lines[i], lines[i + 1])) {
        hi = i;
        break;
      }
    }
    if (hi < 0) return pageItems;
    const h2 = isHeaderContinuationLine(lines[hi], lines[hi + 1]) ? lines[hi + 1] : null;
    st.cols = buildColumns(lines[hi], h2);
    const hasAmtOrNet = st.cols.some((c) =>
      ['amt', 'net', 'gross', 'price'].includes(c.k.k)
    );
    if (!hasAmtOrNet) {
      st.cols = null;
      return pageItems;
    }
    startIdx = hi + (h2 ? 2 : 1);
  } else {
    // On pages 2..N, if the table header repeats, jump straight past the page-top header/address block
    const repHdrIdx = lines.findIndex((line, idx) => isTableHeaderLine(line, lines[idx + 1]));
    if (repHdrIdx >= 0) {
      const h2 = isHeaderContinuationLine(lines[repHdrIdx], lines[repHdrIdx + 1])
        ? lines[repHdrIdx + 1]
        : null;
      startIdx = repHdrIdx + (h2 ? 2 : 1);
    }
  }

  for (let i = startIdx; i < lines.length; i++) {
    const l = lines[i];
    if (st.done) break;

    // Skip any additional repeated table headers mid-page
    if (isTableHeaderLine(l, lines[i + 1])) {
      if (isHeaderContinuationLine(l, lines[i + 1])) {
        i++;
      }
      continue;
    }

    // Stop triggers
    if (STOP_RE.test(l.t)) {
      const nums = l.t.match(/[\d,]+\.\d{2}/g);
      if (/^(total\b|grand\s*total|invoice\s*amount|total\s+amount\s+incl)/i.test(l.t) && nums?.length) {
        st.tablePrintedTotal = parseNumber(nums[nums.length - 1]);
      }
      st.done = true;
      break;
    }

    // Skip page footer / header noise
    if (FOOTER_NOISE_RE.test(l.t)) continue;

    // Tally-style discount rows ("Less : Discounts on Cars (-)3,80,690.00")
    if (LEDGER_DISCOUNT_RE.test(l.t)) {
      const m = l.t.match(/(\(-\)\s*[\d,]+\.\d{2}|-?[\d,]+\.\d{2})/);
      if (m) {
        const discVal = Math.abs(parseNumber(m[1]));
        st.tableDisc = round2(st.tableDisc + discVal);
        if (st.cur) {
          st.cur.disc = round2(st.cur.disc + discVal);
        }
      }
      continue;
    }

    // Tally-style Round Off row inside table
    const roundMatch = l.t.match(LEDGER_ROUND_RE);
    if (roundMatch) {
      st.tableRoundOff = round2(st.tableRoundOff + parseNumber(roundMatch[1]));
      continue;
    }

    // Tally-style Tax Ledger row inside table (e.g. "CGST 4,23,862.04", "CESS 5,14,689.62")
    const ledgerTax = l.t.match(LEDGER_TAX_RE);
    if (ledgerTax && !/\b\d{4,8}\b/.test(l.t.split(/\s+/)[0] || '')) {
      const ty = ledgerTax[1].toUpperCase() === 'UTGST' ? 'SGST' : ledgerTax[1].toUpperCase();
      const nums = l.t.match(/[\d,]+\.\d{2}/g);
      if (nums && nums.length) {
        const amt = parseNumber(nums[nums.length - 1]);
        if (ty === 'IGST' || ty === 'CGST' || ty === 'SGST' || ty === 'CESS') {
          st.tableTaxes[ty] = round2(st.tableTaxes[ty] + amt);
        }
      }
      continue;
    }

    const cell: Record<number, string[]> = {};
    for (const w of l.w) {
      const col = columnOfWord(w, st.cols);
      if (col) {
        const idx = st.cols.indexOf(col);
        (cell[idx] = cell[idx] || []).push(w.s);
      }
    }

    const grouped: Partial<Record<ColKindType, { c: ColKind; v: string[] }[]>> = {};
    st.cols.forEach((col, idx) => {
      if (cell[idx]) {
        const list = (grouped[col.k.k] = grouped[col.k.k] || []);
        list.push({ c: col.k, v: cell[idx] });
      }
    });

    const qRawTokens = grouped.qty ? grouped.qty[0].v : [];
    const qNums = qRawTokens.filter(isNumericToken);
    const qUomFromQty = qRawTokens.filter((tok) => !isNumericToken(tok)).join(' ');
    const explicitUom = grouped.uom ? grouped.uom.map((x) => x.v.join(' ')).join(' ') : '';
    const uom = cleanDescPrefix(explicitUom || qUomFromQty);

    const moneyTokens = (['price', 'gross', 'net', 'amt', 'disc'] as const).flatMap((k) =>
      (grouped[k] || []).flatMap((x) => x.v.filter(isNumericToken))
    );
    const decCount = moneyTokens.filter((s) => /\./.test(s)).length;

    const descText = (grouped.desc || []).map((x) => x.v.join(' ')).join(' ').trim();
    const slText = grouped.sl ? grouped.sl[0].v.join(' ').trim() : '';
    const hsnText = grouped.hsn ? grouped.hsn[0].v.join('').replace(/\D/g, '') : '';

    const hasQtyRow = qNums.length > 0 && (decCount >= 1 || moneyTokens.length >= 2);
    const hasServiceRow =
      !qNums.length &&
      decCount >= 1 &&
      Boolean(slText || hsnText) &&
      descText.length >= 3 &&
      !/^(tax|igst|cgst|sgst|cess|round\s*off|total|sub\s*total)/i.test(descText);

    if (hasQtyRow || hasServiceRow) {
      const firstNum = (k: ColKindType): number => {
        const arr = grouped[k];
        if (!arr || !arr.length) return 0;
        const found = arr[0].v.filter(isNumericToken)[0];
        return found ? parseNumber(found) : 0;
      };

      const looksLikePartCode =
        Boolean(slText) && (/[A-Za-z]/.test(slText) || slText.length >= 6);
      const rawMat = (grouped.mat || []).map((x) => x.v.join(' ')).join(' ').trim();

      const itemObj: InvoiceLineItem & { _r: Record<string, number>; _amt: number } = {
        item: looksLikePartCode ? String(pageItems.length + 1) : slText || String(pageItems.length + 1),
        mat: rawMat || (looksLikePartCode ? slText : ''),
        desc: cleanDescPrefix(descText),
        hsn: hsnText,
        qty: qNums.length ? parseNumber(qNums[0]) : 1,
        uom,
        price: firstNum('price'),
        gross: firstNum('gross'),
        disc: firstNum('disc'),
        net: firstNum('net'),
        rate: 0,
        IGST: 0,
        CGST: 0,
        SGST: 0,
        cessRate: 0,
        cessAmt: 0,
        _r: {},
        _amt: firstNum('amt'),
      };

      // Handle discount % vs discount amount
      const discCols = grouped.disc || [];
      if (discCols.length) {
        let pctDisc = 0;
        let amtDisc = 0;
        for (const dc of discCols) {
          const isPctHdr = /%/.test(dc.v.join(' ')) || dc.v.some((t) => t === '%');
          for (const tok of dc.v.filter(isNumericToken)) {
            const val = Math.abs(parseNumber(tok));
            if (isPctHdr || /%/.test(tok) || (val > 0 && val < 100 && itemObj.gross > 0 && !amtDisc)) {
              pctDisc = val;
            } else {
              amtDisc += val;
            }
          }
        }
        if (amtDisc > 0) {
          itemObj.disc = round2(amtDisc);
        } else if (pctDisc > 0 && itemObj.gross > 0) {
          itemObj.disc = round2((itemObj.gross * pctDisc) / 100);
        }
      }

      // Inline tax columns (e.g. BMW Service CGST 9.0% / SGST 9.0% or Zoho IGST Amt)
      for (const txCol of grouped.tax || []) {
        const ty = txCol.c.ty || 'GST';
        for (const tok of txCol.v.filter(isNumericToken)) {
          const v = parseNumber(tok);
          const isRate =
            /%/.test(tok) ||
            txCol.c.md === 'r' ||
            (txCol.c.md === '?' && v <= 40 && Number.isInteger(v * 4));
          if (isRate) {
            itemObj._r[ty] = v;
          } else {
            (itemObj as unknown as Record<string, number>)[ty] = round2(
              ((itemObj as unknown as Record<string, number>)[ty] || 0) + v
            );
          }
        }
      }

      pageItems.push(itemObj);
      st.cur = itemObj;
      st.lastItemPage = st.pageIdx;
      st.lastItemY = l.y;
      continue;
    }

    // Continuation / sub-rows attached to current line item (including HSN/SAC & tax lines spilled onto next page)
    if (st.cur) {
      const hsnSub = l.t.match(
        /\b(?:HSN\s*\/?\s*SAC|HSN(?:\s*Code)?|SAC(?:\s*Code)?)\s*[-:.#]?\s*(\d{4,8})\b/i
      );
      if (hsnSub && !st.cur.hsn) {
        st.cur.hsn = hsnSub[1];
      }

      let foundTaxSub = false;
      for (const m of l.t.matchAll(TAX_SUBLINE_RE)) {
        foundTaxSub = true;
        const ty = m[1].toUpperCase() === 'UTGST' ? 'SGST' : (m[1].toUpperCase() as 'IGST' | 'CGST' | 'SGST');
        st.cur[ty] = round2(st.cur[ty] + parseNumber(m[3]));
        st.cur._r[ty] = parseNumber(m[2]);
      }

      const isSamePageAdjacent =
        st.lastItemPage === st.pageIdx &&
        st.lastItemY !== null &&
        st.lastItemY - l.y >= 0 &&
        st.lastItemY - l.y <= 22;

      if (
        !hsnSub &&
        !foundTaxSub &&
        isSamePageAdjacent &&
        !/^(delivery|order|po\b|gi\s*date|batch:|page\b|customer|invoice)/i.test(l.t) &&
        !/^\d+\s+(nos|pcs|units?|kgs?|box)/i.test(l.t) &&
        Object.keys(cell).length > 0 &&
        Object.keys(cell).every((idxStr) => st.cols![Number(idxStr)].k.k === 'desc') &&
        st.cur.desc.length < 90
      ) {
        st.cur.desc = cleanDescPrefix(`${st.cur.desc} ${l.t}`);
        st.lastItemY = l.y;
      }
    }
  }

  return pageItems;
}

const DATE_RE =
  /\b(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{1,2}[\s-][A-Za-z]{3,9}[\s,-]*\d{2,4}|\d{4}-\d{2}-\d{2})\b/;

export function parseInvoiceDocument(
  rawPages: RawWordItem[][],
  fileName: string
): Omit<InvoiceRecord, 'fid' | 'key'> {
  const st: TableParserState = {
    cols: null,
    done: false,
    cur: null,
    pageIdx: 0,
    lastItemPage: -1,
    lastItemY: null,
    tableDisc: 0,
    tableTaxes: { IGST: 0, CGST: 0, SGST: 0, CESS: 0 },
    tableRoundOff: 0,
    tablePrintedTotal: 0,
  };

  const rawItems: (InvoiceLineItem & { _r: Record<string, number>; _amt: number })[] = [];
  const allSegs: { t: string; l: PdfLine; x: number }[] = [];
  const allTextLines: string[] = [];
  const pagesData: ExtractedPageRows[] = [];

  for (let pageIdx = 0; pageIdx < rawPages.length; pageIdx++) {
    st.pageIdx = pageIdx;
    const pageWords = rawPages[pageIdx];
    const lines = mkLines(mkWords(pageWords));
    pagesData.push({
      n: pagesData.length + 1,
      rows: lines.map((l) => l.segs.map((s) => s.t)),
    });
    for (const l of lines) {
      for (const s of l.segs) {
        allSegs.push({ t: s.t, l, x: s.x });
      }
      allTextLines.push(l.t);
    }
    rawItems.push(
      ...(parseTablePage(lines, st) as (InvoiceLineItem & {
        _r: Record<string, number>;
        _amt: number;
      })[])
    );
  }

  const allText = allTextLines.join('\n');

  const kv = (labelRe: RegExp, valRe?: RegExp): string => {
    for (let i = 0; i < allSegs.length; i++) {
      const m = allSegs[i].t.match(labelRe);
      if (!m) continue;
      let rest = allSegs[i].t
        .slice((m.index ?? 0) + m[0].length)
        .replace(/^[\s:.\-#]+/, '');
      if (!rest) {
        const nextSeg = allSegs[i + 1];
        if (nextSeg && Math.abs(nextSeg.l.y - allSegs[i].l.y) <= 16) {
          rest = nextSeg.t;
        }
      }
      const v = valRe ? (rest.match(valRe) || [])[1] || (rest.match(valRe) || [])[0] : rest;
      if (v && /\S/.test(v)) return v.trim();
    }
    return '';
  };

  // GSTINs & Buyer/Seller role detection
  const GSTIN_RE = /\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/g;
  const gstins = [...new Set(allText.match(GSTIN_RE) || [])];
  const BUYER_KW =
    /(customer\s*(name)?\s*:|\bbuyer|\bbill(ed)?\s*to|\bsold\s*to|\bconsignee|\bship(ped)?\s*to|\bparty\b)/i;
  const SELLER_KW =
    /(\bseller|\bsupplier|\bconsigner|\bconsignor|\bsold\s*by|\bregistered\s*office|\bfrom\s*:|\bcompany\b|\bvarsha\s*cars|\bbmw\s*india)/i;

  const detectRole = (g: string): 'B' | 'S' | '' => {
    const idx = allSegs.findIndex((s) => s.t.includes(g));
    if (idx < 0) return '';
    for (let d = 0; d <= 10; d++) {
      for (const j of [idx - d, idx + d]) {
        const s = allSegs[j];
        if (!s || Math.abs(s.x - allSegs[idx].x) > 160) continue;
        const b = BUYER_KW.test(s.t);
        const q = SELLER_KW.test(s.t);
        if (b !== q) return b ? 'B' : 'S';
      }
    }
    return '';
  };

  let roles = gstins.slice(0, 2).map(detectRole);
  if (roles.length === 2) {
    if (roles[0] === roles[1] || !roles[0] || !roles[1]) {
      const first = roles[0] || (roles[1] ? (roles[1] === 'S' ? 'B' : 'S') : 'S');
      roles = [first, first === 'S' ? 'B' : 'S'];
    }
  } else if (roles.length === 1 && !roles[0]) {
    roles = ['S'];
  }

  const buyerGstin = gstins[roles.indexOf('B')] || '';
  const supplierGstin = gstins[roles.indexOf('S')] || '';

  // IRN extraction (handles 2-line wraps with or without trailing hyphen)
  let irn = kv(/\bIRN\b\s*[:\-]?/i, /([0-9a-f-]{16,})/i).replace(/-/g, '');
  if (irn && irn.length < 64) {
    const idx = allSegs.findIndex((s) => /\bIRN\b/i.test(s.t));
    if (idx >= 0) {
      for (let step = 1; step <= 2; step++) {
        const nxt = allSegs[idx + step];
        if (nxt && /^[0-9a-f]{4,}$/i.test(nxt.t.trim())) {
          irn += nxt.t.trim();
        }
      }
    }
  }

  // Printed invoice amount & Round Off
  const amtMatches = [
    ...allText.matchAll(
      /(?:total\s*amount\s*incl\.?\s*gst|invoice\s*(?:amount|total|value)|grand\s*total|total\s*amount|net\s*payable|amount\s*payable)\s*[:\-]?\s*(?:INR|Rs\.?|₹)?\s*([\d,]+\.\d{2})/gi
    ),
  ].map((m) => parseNumber(m[1]));

  const roundOffMatch = allText.match(/round\s*off\.?\s*[:\-]?\s*([-+]?\s*[\d,]+\.\d{2})/i);
  const roundOff = st.tableRoundOff || (roundOffMatch ? parseNumber(roundOffMatch[1]) : 0);

  // Invoice number across SAP/BMW, Tally, and BMW Service Document No.
  const invNo =
    kv(
      /(?:tax\s*)?(?:invoice|inv|bill|document)\s*(?:no\.?|number|num|#)/i,
      /([A-Z0-9][A-Z0-9/-]*\d[A-Z0-9/-]*)/i
    ) || fileName.replace(/\.pdf$/i, '');

  const invDate =
    kv(/(?:invoice|inv|bill|document)\s*date|\bdated\b/i, DATE_RE) ||
    (allText.match(DATE_RE) || [])[1] ||
    '';

  let cust =
    kv(
      /^(?:customer(?:\s*name)?|buyer|bill(?:ed)?\s*to|sold\s*to|consignee|party(?:\s*name)?)\s*:/i
    ) ||
    kv(/^(?:customer|buyer|bill(?:ed)?\s*to|sold\s*to|consignee|party)\b\s*(?=[A-Za-z])/i);

  if (!cust) {
    // BMW Service style: customer name sits directly above "Survey No ..." or "Address"
    const custIdx = allTextLines.findIndex((l) => /PAN\s*:\s*[A-Z]{5}\d{4}[A-Z]/i.test(l));
    if (custIdx >= 3) {
      const candidate = allTextLines[custIdx - 4] || allTextLines[custIdx - 3] || '';
      if (candidate && candidate.length > 2 && !/invoice|document|page/i.test(candidate)) {
        cust = candidate.trim();
      }
    }
  }
  if (!cust) {
    const m = allSegs.find(
      (s) =>
        /customer/i.test(s.t) &&
        /[A-Za-z]{3}/.test(s.t.replace(/customer|address|phone|id/gi, ''))
    );
    if (m) cust = m.t.replace(/customer\s*:?/i, '').trim();
  }

  let sup = kv(/^(?:seller|supplier|consigner|consignor|sold\s*by|company|from)\b\s*:?/i).replace(
    /^address.*/i,
    ''
  );
  if (!sup || sup.length < 3) {
    const pvtMatch = allSegs.find(
      (s) =>
        /\b(pvt|private|ltd|limited|llp)\b/i.test(s.t) &&
        (!cust || !s.t.toLowerCase().includes(cust.toLowerCase()))
    );
    if (pvtMatch) sup = pvtMatch.t;
  }

  const pos = kv(/place\s*of\s*supply\s*[:\-]?/i);
  const del = kv(/(?:delivery|challan|dispatch)\s*(?:no|number)\.?\s*[:\-]?/i, /(\S*\d\S*)/);
  const ord = kv(
    /^(?:order|purchase\s*order|sales\s*order|po)\s*(?:no|number)?\.?\s*[:\-]?/i,
    /(\S*\d\S*)/
  );
  const rc = kv(/reverse\s*charge/i, /\b(yes|no)\b/i);
  const pay = kv(/^payment(?:\s*terms?)?\b\s*:?/i);
  const gi = kv(/\bGI\s*date/i, DATE_RE);
  const code = kv(/^customer\b(?!\s*name)\s*(?:code|no\.?|id\.?)?\s*:?/i, /^(\d{3,})\b/);

  // Bottom Tally / Summary Tax Table extraction
  const bottomRates: Record<string, { rate: number; amt: number }> = {};
  const tallySummaryRow = allText.match(
    /([\d,]+\.\d{2})\s+(\d+(?:\.\d+)?)%\s+([\d,]+\.\d{2})\s+(\d+(?:\.\d+)?)%\s+([\d,]+\.\d{2})(?:\s+(\d+(?:\.\d+)?)%\s+([\d,]+\.\d{2}))?\s+([\d,]+\.\d{2})/
  );
  if (tallySummaryRow) {
    bottomRates.CGST = { rate: parseNumber(tallySummaryRow[2]), amt: parseNumber(tallySummaryRow[3]) };
    bottomRates.SGST = { rate: parseNumber(tallySummaryRow[4]), amt: parseNumber(tallySummaryRow[5]) };
    if (tallySummaryRow[6] && tallySummaryRow[7]) {
      bottomRates.CESS = { rate: parseNumber(tallySummaryRow[6]), amt: parseNumber(tallySummaryRow[7]) };
    }
  }

  // Check explicit CGST Total / SGST Total / IGST Total summary lines (BMW Service)
  const cgstTotMatch = allText.match(/CGST\s*Total\s*[:\-]?\s*([\d,]+\.\d{2})/i);
  const sgstTotMatch = allText.match(/SGST\s*Total\s*[:\-]?\s*([\d,]+\.\d{2})/i);
  const igstTotMatch = allText.match(/IGST\s*Total\s*[:\-]?\s*([\d,]+\.\d{2})/i);

  // Strategy 2 Fallback: Non-tabular / text-only PDF invoice
  let parserMode = 'Table Engine';
  if (rawItems.length === 0) {
    parserMode = 'Summary Fallback';
    const taxableMatch = allText.match(
      /(?:taxable\s*(?:value|amount)|sub\s*total|subtotal)\s*[:\-]?\s*(?:INR|Rs\.?|₹)?\s*([\d,]+\.\d{2})/i
    );
    const cgstVal =
      st.tableTaxes.CGST ||
      (cgstTotMatch ? parseNumber(cgstTotMatch[1]) : 0) ||
      bottomRates.CGST?.amt ||
      0;
    const sgstVal =
      st.tableTaxes.SGST ||
      (sgstTotMatch ? parseNumber(sgstTotMatch[1]) : 0) ||
      bottomRates.SGST?.amt ||
      0;
    const igstVal = st.tableTaxes.IGST || (igstTotMatch ? parseNumber(igstTotMatch[1]) : 0);
    const cessVal = st.tableTaxes.CESS || bottomRates.CESS?.amt || 0;
    const hsnVal = (allText.match(/\b(\d{4,8})\b/) || [])[1] || '';
    const printedAmt = st.tablePrintedTotal || (amtMatches.length ? amtMatches[amtMatches.length - 1] : 0);
    const netVal = taxableMatch
      ? parseNumber(taxableMatch[1])
      : Math.max(0, round2(printedAmt - cgstVal - sgstVal - igstVal - cessVal - roundOff));

    if (netVal > 0 || printedAmt > 0) {
      const totalTax = cgstVal + sgstVal + igstVal;
      const effRate = netVal > 0 ? round2((totalTax / netVal) * 100) / 100 : 0;
      rawItems.push({
        item: '1',
        mat: '',
        desc: `Consolidated Invoice (${invNo})`,
        hsn: hsnVal,
        qty: 1,
        uom: '',
        price: netVal,
        gross: netVal,
        disc: 0,
        net: netVal,
        rate: effRate,
        IGST: igstVal,
        CGST: cgstVal,
        SGST: sgstVal,
        cessRate: netVal > 0 && cessVal > 0 ? round2((cessVal / netVal) * 100) / 100 : 0,
        cessAmt: cessVal,
        _r: {},
        _amt: netVal,
      });
    }
  }

  // Normalize line items (compute net, gross, rates, taxes, cess)
  const sameState =
    gstins.length >= 2 &&
    Boolean(buyerGstin) &&
    Boolean(supplierGstin) &&
    buyerGstin.slice(0, 2) === supplierGstin.slice(0, 2);

  // If no line-level taxes were captured, apply table-level or summary taxes
  const hasAnyLineTaxAmt = rawItems.some((i) => i.IGST + i.CGST + i.SGST > 0);
  const totalSummaryTax: Record<'IGST' | 'CGST' | 'SGST', number> = {
    IGST: st.tableTaxes.IGST || (igstTotMatch ? parseNumber(igstTotMatch[1]) : 0),
    CGST: st.tableTaxes.CGST || (cgstTotMatch ? parseNumber(cgstTotMatch[1]) : 0) || bottomRates.CGST?.amt || 0,
    SGST: st.tableTaxes.SGST || (sgstTotMatch ? parseNumber(sgstTotMatch[1]) : 0) || bottomRates.SGST?.amt || 0,
  };

  // Pre-normalize gross, disc, net first
  for (const it of rawItems) {
    if (!it.gross) {
      it.gross = it.price > 0 ? round2(it.qty * it.price) : it._amt || 0;
    }
    if (!it.net) {
      const afterDisc = round2(it.gross - it.disc);
      const inlineTx = it.IGST + it.CGST + it.SGST;
      it.net =
        it._amt && inlineTx && Math.abs(it._amt - afterDisc - inlineTx) < 1.5
          ? afterDisc
          : it._amt
            ? round2(it._amt - it.disc)
            : afterDisc;
    } else if (st.tableDisc > 0 && it.disc > 0 && it.net === it.gross) {
      it.net = round2(it.gross - it.disc);
    }
    if (!it.price && it.qty) {
      it.price = round2(it.gross / it.qty);
    }
  }

  // Distribute or calculate taxes per item
  const totalNet = rawItems.reduce((s, i) => s + i.net, 0) || 1;
  const totalCessAmt = st.tableTaxes.CESS || bottomRates.CESS?.amt || 0;

  for (const it of rawItems) {
    // If line has rate % (e.g. BMW Service 9.0% CGST & 9.0% SGST) but no tax amounts yet
    if (it.IGST + it.CGST + it.SGST === 0) {
      if (it._r.CGST || it._r.SGST || it._r.IGST || it._r.GST) {
        if (it._r.IGST) it.IGST = round2((it.net * it._r.IGST) / 100);
        if (it._r.CGST) it.CGST = round2((it.net * it._r.CGST) / 100);
        if (it._r.SGST) it.SGST = round2((it.net * it._r.SGST) / 100);
        if (it._r.GST) {
          if (sameState) {
            it.CGST = round2((it.net * it._r.GST) / 200);
            it.SGST = round2((it.net * it._r.GST) / 200);
            it._r.CGST = it._r.GST / 2;
            it._r.SGST = it._r.GST / 2;
          } else {
            it.IGST = round2((it.net * it._r.GST) / 100);
            it._r.IGST = it._r.GST;
          }
        }
      } else if (!hasAnyLineTaxAmt) {
        if (totalSummaryTax.IGST > 0) {
          it.IGST =
            rawItems.length === 1
              ? totalSummaryTax.IGST
              : round2((totalSummaryTax.IGST * it.net) / totalNet);
        }
        if (totalSummaryTax.CGST > 0) {
          it.CGST =
            rawItems.length === 1
              ? totalSummaryTax.CGST
              : round2((totalSummaryTax.CGST * it.net) / totalNet);
          if (bottomRates.CGST?.rate) it._r.CGST = bottomRates.CGST.rate;
        }
        if (totalSummaryTax.SGST > 0) {
          it.SGST =
            rawItems.length === 1
              ? totalSummaryTax.SGST
              : round2((totalSummaryTax.SGST * it.net) / totalNet);
          if (bottomRates.SGST?.rate) it._r.SGST = bottomRates.SGST.rate;
        }
      }
    }

    if (totalCessAmt > 0) {
      it.cessAmt =
        rawItems.length === 1 ? totalCessAmt : round2((totalCessAmt * it.net) / totalNet);
      it.cessRate = bottomRates.CESS?.rate
        ? round2(bottomRates.CESS.rate) / 100
        : it.net > 0
          ? round2((it.cessAmt / it.net) * 10000) / 10000
          : 0;
    }

    const totalTaxAmt = it.IGST + it.CGST + it.SGST;
    let pctRate = (it._r.IGST || 0) + (it._r.CGST || 0) + (it._r.SGST || 0);
    if (!pctRate && it.net > 0) {
      pctRate = Math.round((totalTaxAmt / it.net) * 10000) / 100;
    }
    it.rate = Math.round(pctRate * 100) / 10000;
  }

  const finalItems: InvoiceLineItem[] = rawItems.map(({ _r, _amt, ...clean }) => clean);

  const computedTotal = round2(
    finalItems.reduce((s, i) => s + i.net + i.IGST + i.CGST + i.SGST + i.cessAmt, 0) + roundOff
  );
  const printedAmount =
    amtMatches.length > 0
      ? amtMatches[amtMatches.length - 1]
      : st.tablePrintedTotal || computedTotal;

  return {
    file: fileName,
    no: invNo,
    date: invDate,
    cust,
    code,
    cgst: buyerGstin,
    sup,
    sgst: supplierGstin,
    pos,
    irn,
    del,
    ord,
    gi,
    rc,
    pay,
    amt: printedAmount,
    roundOff,
    cess: round2(finalItems.reduce((s, i) => s + i.cessAmt, 0)),
    items: finalItems,
    pages: pagesData,
    parserMode,
  };
}

export async function readPdfInvoiceFile(
  buffer: ArrayBuffer,
  fileName: string,
  onProgress: (msg: string) => void,
  requestPassword: (fileName: string, isRetry: boolean) => Promise<string | null>
): Promise<{
  invoice: Omit<InvoiceRecord, 'fid' | 'key'>;
  passwordUsed?: string;
}> {
  let currentPassword: string | undefined;
  let attempts = 0;

  while (true) {
    try {
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(buffer.slice(0)),
        password: currentPassword,
      });
      const pdf = await loadingTask.promise;
      const rawPages: RawWordItem[][] = [];

      for (let p = 1; p <= pdf.numPages; p++) {
        onProgress(`Reading page ${p}/${pdf.numPages}...`);
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        const pageWords: RawWordItem[] = [];
        for (const item of content.items) {
          if ('str' in item && item.str) {
            const tr = item.transform as number[];
            pageWords.push({
              str: item.str,
              x: tr?.[4] ?? 0,
              y: tr?.[5] ?? 0,
              w: 'width' in item ? Number(item.width) || 0 : 0,
            });
          }
        }
        rawPages.push(pageWords);
      }

      const plainTextLen = rawPages
        .flat()
        .map((w) => w.str)
        .join('')
        .replace(/\s+/g, '').length;
      if (plainTextLen < 20) {
        throw new Error(
          'No selectable text found (this looks like a flat scanned image PDF).'
        );
      }

      const invoice = parseInvoiceDocument(rawPages, fileName);
      if (invoice.items.length === 0) {
        throw new Error(
          'No invoice amounts or table lines could be detected in this PDF.'
        );
      }
      return { invoice, passwordUsed: currentPassword };
    } catch (err: unknown) {
      const e = err as { name?: string; message?: string };
      if (e?.name === 'PasswordException') {
        const pw = await requestPassword(fileName, attempts > 0);
        if (pw === null) {
          throw new Error('Password-protected PDF skipped.');
        }
        currentPassword = pw;
        attempts++;
        continue;
      }
      throw err;
    }
  }
}

export function parsePastedInvoiceText(
  text: string,
  fileName: string
): Omit<InvoiceRecord, 'fid' | 'key'> {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const wordsPerLine: RawWordItem[] = lines.map((line, idx) => ({
    str: line,
    x: 40,
    y: 800 - idx * 14,
    w: line.length * 5,
  }));
  return parseInvoiceDocument([wordsPerLine], fileName);
}
