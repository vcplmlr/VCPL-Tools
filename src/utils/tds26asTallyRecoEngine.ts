import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';

export type RecoPeriodCode =
  | 'FY'
  | 'Q1'
  | 'Q2'
  | 'Q3'
  | 'Q4'
  | 'H1'
  | 'H2'
  | 'M3'
  | 'M4'
  | 'M5'
  | 'M6'
  | 'M7'
  | 'M8'
  | 'M9'
  | 'M10'
  | 'M11'
  | 'M0'
  | 'M1'
  | 'M2'
  | 'MR'
  | 'YTD'
  | 'LD'
  | 'MS'
  | 'CQ'
  | 'PQ'
  | 'QR'
  | 'LM'
  | 'FR'
  | 'CY'
  | 'C';

export type RecoDateBasis = 'txn' | 'book';
export type RecoScope = 'strict' | 'buf' | 'all';
export type RecoFinFilter = '' | 'F';

export interface Entry26AS {
  id: number;
  typ: 'TDS' | 'TCS';
  tan: string;
  pan: string;
  name: string;
  sec: string;
  td: string; // YYYY-MM-DD
  bd: string; // YYYY-MM-DD or ''
  st: string; // 'F' or other
  gross: number;
  amt: number;
  file: string;
  // runtime fields attached per reco run:
  d?: string;
  p?: MatchedPair | null;
  cat?: string;
}

export interface DeductorSummary {
  typ: 'TDS' | 'TCS';
  tan: string;
  pan: string;
  name: string;
  tot: number | null;
}

export interface Parsed26ASFile {
  fileName: string;
  entries: Entry26AS[];
  deds: Record<string, DeductorSummary>;
  lines: number;
  netted: number;
  bad: string[];
}

export interface TallyEntry {
  ledger: string;
  d: string; // YYYY-MM-DD
  vt: string;
  vno: string;
  part: string;
  amt: number;
  // runtime fields attached per reco run:
  typ?: 'TDS' | 'TCS';
  p?: MatchedPair | null;
  cat?: string;
}

export interface TallyLedger {
  name: string;
  typ: 'TDS' | 'TCS';
  entries: TallyEntry[];
  open: number;
  cov: { s: string; e: string } | null;
  sheets: string[];
}

export interface RawSheetData {
  name: string;
  fileName?: string;
  rows: unknown[][];
}

export interface ParsedTallyData {
  ledgers: TallyLedger[];
  warn: string[];
}

export interface MatchedPair {
  id: number;
  a: number[];
  t: number[];
  kind: 'exact' | 'tol' | 'many' | 'near';
  sa: number;
  st: number;
  diff: number;
  gap: number;
  ain: number[];
  tin: number[];
  inA: number;
  inT: number;
  full: boolean;
  cat: string;
}

export interface RecoGroup {
  n: number;
  ledgers: TallyLedger[];
  dk: string[];
  A: (Entry26AS & { d: string; p?: MatchedPair | null; cat?: string })[];
  T: (TallyEntry & { typ: 'TDS' | 'TCS'; p?: MatchedPair | null; cat?: string })[];
  name: string;
  lname: string;
  title: string;
  typ: 'TDS' | 'TCS';
  open: number;
  cov: { s: string; e: string } | null;
  hasL: boolean;
  hasD: boolean;
  manual: boolean;
  pairs: MatchedPair[];
  sA: number;
  sT: number;
  diff: number;
  uA: number;
  uO: number;
  uT: number;
  nA: number;
  nT: number;
  nO: number;
  misAmt: number;
  rnd: number;
  tim: number;
  manDiff: number;
  chk: number;
  nM: number;
  nNear: number;
  nTim: number;
  status: string;
}

export interface RecoOptions {
  code: RecoPeriodCode;
  fy: number;
  per: { s: string; e: string };
  ms: Set<string> | null;
  basis: RecoDateBasis;
  scope: RecoScope;
  buf: number;
  fin: RecoFinFilter;
  tol: number;
  win: number;
  bkt: number;
  periodLabelText: string;
  fyList: number[];
}

export interface RecoRunResult {
  groups: RecoGroup[];
  o: RecoOptions;
  P: { s: string; e: string };
}

export interface ManualRecoItem {
  k: string;
  src: '26AS' | 'Tally';
  grp: string;
  why: string;
  d: string;
  party: string;
  ref: string;
  amt: number;
  gn: number;
}

export interface GroupLedgerSheet {
  name: string;
  g: RecoGroup;
  hdr: [string, string | number][];
  h: string[];
  d: (string | number | null)[][];
}

export interface BuiltRecoSheets {
  sum: { h: string[]; d: (string | number | null)[][] };
  tva: { h: string[]; d: (string | number | null)[][] };
  avt: { h: string[]; d: (string | number | null)[][] };
  mis: { h: string[]; d: (string | number | null)[][] };
  mA: { h: string[]; d: (string | number | null)[][] };
  mT: { h: string[]; d: (string | number | null)[][] };
  man: { items: ManualRecoItem[]; d: ManualRecoItem[] };
  gl: Record<number, GroupLedgerSheet>;
  pw: { h: string[]; d: (string | number | null)[][] };
  bk: { h: string[]; d: (string | number | null)[][] };
  warn: string[];
}

export interface DashboardData {
  G: RecoGroup[];
  sA: number;
  sT: number;
  diff: number;
  miss: number;
  uT: number;
  misAmt: number;
  rnd: number;
  tim: number;
  manDiff: number;
  chk: number;
  cntMiss: number;
  cntUT: number;
  cntMis: number;
  mansA: number;
  byS: Record<string, number>;
  top: RecoGroup[];
  months: (string | number | null)[][];
  open: ManualRecoItem[];
  openA: number;
  sec: [string, number, number][];
  pct: number;
}

export interface RecoState {
  A26: Entry26AS[];
  deds: Record<string, DeductorSummary>;
  ledgers: TallyLedger[];
  map: Record<string, string[]>;
  inc: Record<string, boolean>;
  man: Record<string, number>;
  tw: RawSheetData[];
  twarn: string[];
  files26: Parsed26ASFile[];
  netted: number;
  bad: string[];
  fy: number;
}

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

export const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const FY_MONTH_LABELS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];

export const PERIOD_LABELS: Record<RecoPeriodCode, string> = {
  FY: 'Full financial year',
  Q1: 'Q1 (Apr–Jun)',
  Q2: 'Q2 (Jul–Sep)',
  Q3: 'Q3 (Oct–Dec)',
  Q4: 'Q4 (Jan–Mar)',
  H1: 'H1 (Apr–Sep)',
  H2: 'H2 (Oct–Mar)',
  M3: 'Apr',
  M4: 'May',
  M5: 'Jun',
  M6: 'Jul',
  M7: 'Aug',
  M8: 'Sep',
  M9: 'Oct',
  M10: 'Nov',
  M11: 'Dec',
  M0: 'Jan',
  M1: 'Feb',
  M2: 'Mar',
  MR: 'Month range',
  YTD: 'Year-to-date (FY start → as-on date)',
  LD: 'Last N days (to as-on date)',
  MS: 'Selected months / quarters',
  CQ: 'Current quarter (of as-on date)',
  PQ: 'Previous quarter (before as-on date)',
  QR: 'Quarter range',
  LM: 'Last N months (to as-on date)',
  FR: 'Multiple financial years',
  CY: 'Calendar year (Jan–Dec)',
  C: 'Custom from – to dates',
};

const p2 = (n: number): string => String(n).padStart(2, '0');
export const ISO = (y: number, m: number, d: number): string => `${y}-${p2(m + 1)}-${p2(d)}`;

export function pd(s: unknown): string | null {
  if (s instanceof Date && !Number.isNaN(s.getTime())) {
    const x = new Date(+s + 12 * 36e5);
    return ISO(x.getFullYear(), x.getMonth(), x.getDate());
  }
  if (typeof s === 'number') {
    if (s < 30000 || s > 80000) return null;
    const x = new Date(Math.round((s - 25569) * 864e5));
    return ISO(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate());
  }
  const str = String(s == null ? '' : s).trim();
  if (!str) return null;
  let m: RegExpMatchArray | null;
  if ((m = str.match(/^(\d{1,2})[- ]([A-Za-z]{3})[a-z]*[- ,]+(\d{2,4})$/))) {
    const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    const mo = MON[m[2].toLowerCase()];
    return mo == null ? null : ISO(y, mo, +m[1]);
  }
  if ((m = str.match(/^(\d{4})-(\d\d)-(\d\d)/))) {
    return m[0].slice(0, 10);
  }
  if ((m = str.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/))) {
    return ISO(+m[3], +m[2] - 1, +m[1]);
  }
  return null;
}

export const dfmt = (d?: string | null): string => {
  if (!d) return '';
  const parts = d.split('-');
  if (parts.length !== 3) return d;
  const [y, m, dd] = parts;
  return `${dd}-${MN[+m - 1] || m}-${y}`;
};

export const isNumLike = (s: unknown): boolean =>
  /^\(?-?[\d,]*\.?\d+\)?$/.test(String(s).trim()) && /\d/.test(String(s));

export function num(s: unknown): number | null {
  if (s == null || s === '') return null;
  if (typeof s === 'number') return Number.isFinite(s) ? s : null;
  let t = String(s).replace(/[₹,\s]/g, '');
  if (!t || t === '-') return null;
  const neg = /^\(.*\)$/.test(t) || /^-/.test(t);
  t = t.replace(/[()-]/g, '');
  const v = parseFloat(t);
  return Number.isNaN(v) ? null : neg ? -v : v;
}

export const r2 = (x: number): number => Math.round(x * 100) / 100;

export const fmtIN = (x: unknown): string => {
  if (x == null || x === '') return '';
  if (typeof x === 'number') {
    return x.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return String(x);
};

const TANRE = /^[A-Z]{4}\d{5}[A-Z]$/;
const PANRE = /^[A-Z]{5}\d{4}[A-Z]$/;
const SECRE = /^(\d{3,4}|19\d[A-Z0-9]{0,3}|206[A-Z0-9]{0,3}|9\d[A-Z]{0,2})$/i;

export const cellVal = (v: unknown): string =>
  v == null ? '' : v instanceof Date ? dfmt(pd(v)) : String(v).replace(/_x000D_|[\r\n]+/g, ' ').trim();

/* ---------- 26AS Parser ---------- */
export function parse26ASRows(rows: string[][], fileName: string): Parsed26ASFile {
  let part: 'TDS' | 'TCS' | null = null;
  let cur: DeductorSummary | null = null;
  let buf: string[] = [];
  let lastDed = false;
  const raw: Omit<Entry26AS, 'id'>[] = [];
  const deds: Record<string, DeductorSummary> = {};

  for (const t of rows) {
    if (!t.length) continue;
    const txt = t.join(' ');
    const m = txt.match(/^PART[\s-]*([IVX]+)\b/i);
    if (m) {
      const R = m[1].toUpperCase();
      const np: 'TDS' | 'TCS' | null = R === 'I' || R === 'II' ? 'TDS' : R === 'VI' ? 'TCS' : null;
      if (np !== part) cur = null;
      part = np;
      buf = [];
      continue;
    }
    if (!part) continue;

    const ti = t.findIndex((x) => TANRE.test(x));
    if (ti >= 0) {
      const s = /^\d+$/.test(t[0]) ? 1 : 0;
      const name = (buf.join(' ') + ' ' + t.slice(s, ti).join(' '))
        .replace(/^\d+\s+/, '')
        .replace(/\s+/g, ' ')
        .trim();
      let pan = '';
      let k = ti + 1;
      if (t[k] && PANRE.test(t[k])) {
        pan = t[k];
        k++;
      } else if (t[k] === '-') {
        k++;
      }
      const nums = t
        .slice(k)
        .filter(isNumLike)
        .map((v) => num(v) ?? 0);
      cur = {
        typ: part,
        tan: t[ti],
        pan,
        name,
        tot: nums.length >= 3 ? nums[nums.length - 2] : null,
      };
      deds[`${part}|${cur.tan}`] = cur;
      buf = [];
      lastDed = true;
      continue;
    }

    const di = t.findIndex((x) => pd(x) && /\d{4}$/.test(x) && /[-/]/.test(x));
    if (di > 0 && SECRE.test(t[di - 1]) && cur) {
      const d2 = t.findIndex((x, i) => i > di && pd(x) && /[-/]/.test(x));
      const st = (t[di + 1] || '')[0] == null ? '' : t[di + 1];
      const after = t
        .slice((d2 > 0 ? d2 : di) + 1)
        .filter(isNumLike)
        .map((v) => num(v) ?? 0);
      if (after.length >= 3) {
        const n = after.length;
        raw.push({
          typ: cur.typ,
          tan: cur.tan,
          pan: cur.pan,
          name: cur.name,
          sec: t[di - 1].toUpperCase(),
          td: pd(t[di]) || '',
          bd: d2 > 0 ? pd(t[d2]) || '' : '',
          st: /^(F|Final)$/i.test(st) ? 'F' : st,
          gross: after[n - 3],
          amt: after[n - 2],
          file: fileName,
        });
      }
      buf = [];
      lastDed = false;
      continue;
    }

    const hdr = /S\.No|Section|Transaction|Booking|Page \d|Data updated|Deductor|Collector|Amount|Remarks|Tax|TDS|TCS|Name of|Gross|Total|No transactions/.test(
      txt
    );
    if (!hdr) {
      if (lastDed && cur && !/\d/.test(txt)) {
        cur.name = `${cur.name} ${txt}`.trim();
      } else {
        buf.push(txt);
        if (buf.length > 2) buf.shift();
      }
    } else {
      lastDed = false;
    }
  }

  /* Net reversals (G / B remark pairs appear as negative lines) */
  const g: Record<string, { e: Omit<Entry26AS, 'id'>; n: number }> = {};
  const lines = raw.length;
  for (const e of raw) {
    const k = [e.typ, e.tan, e.sec, e.td, e.bd, Math.abs(e.amt).toFixed(2)].join('|');
    if (!g[k]) g[k] = { e, n: 0 };
    g[k].n += Math.sign(e.amt) || 0;
  }

  const out: Entry26AS[] = [];
  let seq = 0;
  for (const k of Object.keys(g)) {
    const { e, n } = g[k];
    for (let i = 0; i < Math.abs(n); i++) {
      out.push({
        ...e,
        id: seq++,
        amt: n > 0 ? Math.abs(e.amt) : -Math.abs(e.amt),
      });
    }
  }

  /* Validate vs deductor header totals */
  const sums: Record<string, number> = {};
  out.forEach((e) => {
    const k = `${e.typ}|${e.tan}`;
    sums[k] = (sums[k] || 0) + e.amt;
  });
  const bad: string[] = [];
  for (const k of Object.keys(deds)) {
    const d = deds[k];
    if (d.tot != null && Math.abs((sums[k] || 0) - d.tot) > 1) {
      bad.push(`${d.name}: lines ${r2(sums[k] || 0)} vs header ${d.tot}`);
    }
  }

  return { fileName, entries: out, deds, lines, netted: lines - out.length, bad };
}

export function merge26ASSources(list: Parsed26ASFile[]): {
  entries: Entry26AS[];
  deds: Record<string, DeductorSummary>;
  netted: number;
  bad: string[];
} {
  const cnt: Record<string, number> = {};
  const ent: Record<string, Entry26AS> = {};
  const deds: Record<string, DeductorSummary> = {};
  let netted = 0;
  let bad: string[] = [];

  for (const r of list) {
    netted += r.netted;
    bad = bad.concat(r.bad);
    for (const k of Object.keys(r.deds)) {
      const d = r.deds[k];
      if (!deds[k] || (d.name || '').length > deds[k].name.length) {
        deds[k] = { ...d };
      }
      if (!deds[k].pan && d.pan) {
        deds[k].pan = d.pan;
      }
    }
    const c: Record<string, number> = {};
    for (const e of r.entries) {
      const k = [e.typ, e.tan, e.sec, e.td, e.bd, e.amt.toFixed(2)].join('|');
      c[k] = (c[k] || 0) + 1;
      ent[k] = ent[k] || e;
    }
    for (const k of Object.keys(c)) {
      cnt[k] = Math.max(cnt[k] || 0, c[k]);
    }
  }

  const out: Entry26AS[] = [];
  for (const k of Object.keys(cnt)) {
    for (let i = 0; i < cnt[k]; i++) {
      const e: Entry26AS = { ...ent[k] };
      e.name = (deds[`${e.typ}|${e.tan}`] || e).name;
      out.push(e);
    }
  }
  out.sort((a, b) => (a.td < b.td ? -1 : a.td > b.td ? 1 : 0));
  out.forEach((e, i) => {
    e.id = i;
  });

  return { entries: out, deds, netted, bad };
}

/* ---------- Tally Parser ---------- */
const OPENING_ROW_RE = /\b(opening(\s*bal(ance)?)?|brought\s*forward|b\/f|op\.?\s*bal(ance)?)\b/i;
const CLOSING_STOP_RE = /\b(closing(\s*bal(ance)?)?|carried\s*forward|c\/f|current\s*total|grand\s*total)\b/i;

export function parseTallySheets(sheets: RawSheetData[]): ParsedTallyData {
  const L: Record<string, TallyLedger & { seen: Set<string> }> = {};
  const warn: string[] = [];
  let dup = 0;
  let skippedOpening = 0;
  let skippedCredits = 0;

  for (const sh of sheets) {
    const R = sh.rows;
    let foundLedgerHeader = false;

    for (let r = 0; r < R.length; r++) {
      const rowLen = (R[r] || []).length;
      for (let c = 0; c < rowLen; c++) {
        if (!/^ledger account$/i.test(cellVal(R[r][c]))) continue;
        const name = cellVal((R[r - 1] || [])[c]);
        if (!name) continue;
        foundLedgerHeader = true;

        let cov: { s: string; e: string } | null = null;
        let h = -1;
        for (let k = r + 1; k < Math.min(R.length, r + 10); k++) {
          const x = cellVal((R[k] || [])[c]);
          const m = x.match(/(\d{1,2}-[A-Za-z]{3}-\d{2,4})\s+to\s+(\d{1,2}-[A-Za-z]{3}-\d{2,4})/);
          if (m) {
            const s = pd(m[1]);
            const e = pd(m[2]);
            if (s && e) cov = { s, e };
          }
          if (/^date$/i.test(x)) {
            h = k;
            break;
          }
        }
        if (h < 0) continue;

        // Detect column offsets on header row R[h] (fallback to Tally standard +2/+3/+4/+5/+6)
        const hdrRow = R[h] || [];
        let cPart = c + 2;
        let cVt = c + 3;
        let cVno = c + 4;
        let cDr = c + 5;
        let cCr = c + 6;
        for (let col = c + 1; col < Math.min(hdrRow.length, c + 15); col++) {
          const hv = cellVal(hdrRow[col]).toLowerCase();
          if (/^particulars$/i.test(hv)) cPart = col;
          else if (/vch\s*type|voucher\s*type/i.test(hv)) cVt = col;
          else if (/vch\s*no|voucher\s*no/i.test(hv)) cVno = col;
          else if (/^debit(\s*amount|\s*\(.*\))?$|^dr\.?$/i.test(hv)) cDr = col;
          else if (/^credit(\s*amount|\s*\(.*\))?$|^cr\.?$/i.test(hv)) cCr = col;
        }

        const key = name.toLowerCase().replace(/\s+/g, ' ');
        if (!L[key]) {
          L[key] = {
            name,
            typ: /^\s*tcs/i.test(name) ? 'TCS' : 'TDS',
            entries: [],
            open: 0,
            cov,
            sheets: [],
            seen: new Set(),
          };
        }
        const led = L[key];
        if (cov && led.cov) {
          led.cov = {
            s: cov.s < led.cov.s ? cov.s : led.cov.s,
            e: cov.e > led.cov.e ? cov.e : led.cov.e,
          };
        } else if (cov) {
          led.cov = cov;
        }
        led.sheets.push(sh.name);

        const blockSeenKeys: string[] = [];
        let blankStreak = 0;

        for (let k = h + 1; k < R.length; k++) {
          const row = R[k] || [];
          if (/^ledger account$/i.test(cellVal(row[c]))) break;

          const rowText = row.map(cellVal).filter(Boolean).join(' ');
          if (!rowText) {
            blankStreak++;
            if (blankStreak >= 12) break;
            continue;
          }
          blankStreak = 0;

          if (CLOSING_STOP_RE.test(rowText)) break;
          if (OPENING_ROW_RE.test(rowText)) {
            skippedOpening++;
            continue;
          }

          const d = pd(row[c]);
          if (!d) continue;

          const part = cellVal(row[cPart]);
          if (OPENING_ROW_RE.test(part)) {
            skippedOpening++;
            continue;
          }
          if (CLOSING_STOP_RE.test(part)) break;

          // Always take Debit balance ONLY; never subtract or book Credit rows
          const dr = r2(num(row[cDr]) || 0);
          const cr = r2(num(row[cCr]) || 0);
          if (!(dr > 0)) {
            if (cr > 0) skippedCredits++;
            continue;
          }

          const e: TallyEntry = {
            ledger: led.name,
            d,
            vt: cellVal(row[cVt]),
            vno: cellVal(row[cVno]),
            part,
            amt: dr,
          };
          const sk = [d, e.vno, e.amt, part].join('|');
          if (led.seen.has(sk)) {
            dup++;
            continue;
          }
          blockSeenKeys.push(sk);
          led.entries.push(e);
        }

        blockSeenKeys.forEach((sk) => led.seen.add(sk));
      }
    }

    // Fallback: flat Tally ledger table (header row has Date + Particulars + Debit/Credit without "Ledger Account" label)
    if (!foundLedgerHeader) {
      for (let r = 0; r < Math.min(R.length, 30); r++) {
        const hdrRow = R[r] || [];
        let cDate = -1;
        let cPart = -1;
        let cVt = -1;
        let cVno = -1;
        let cDr = -1;
        let cCr = -1;
        for (let col = 0; col < hdrRow.length; col++) {
          const hv = cellVal(hdrRow[col]).toLowerCase();
          if (/^date$/i.test(hv) && cDate < 0) cDate = col;
          else if (/^particulars$/i.test(hv)) cPart = col;
          else if (/vch\s*type|voucher\s*type/i.test(hv)) cVt = col;
          else if (/vch\s*no|voucher\s*no/i.test(hv)) cVno = col;
          else if (/^debit(\s*amount|\s*\(.*\))?$|^dr\.?$/i.test(hv)) cDr = col;
          else if (/^credit(\s*amount|\s*\(.*\))?$|^cr\.?$/i.test(hv)) cCr = col;
        }
        if (cDate >= 0 && cDr >= 0) {
          const name = sh.name || sh.fileName || 'Tally Ledger';
          const key = name.toLowerCase().replace(/\s+/g, ' ');
          if (!L[key]) {
            L[key] = {
              name,
              typ: /^\s*tcs/i.test(name) ? 'TCS' : 'TDS',
              entries: [],
              open: 0,
              cov: null,
              sheets: [],
              seen: new Set(),
            };
          }
          const led = L[key];
          led.sheets.push(sh.name);
          const blockSeenKeys: string[] = [];
          for (let k = r + 1; k < R.length; k++) {
            const row = R[k] || [];
            const rowText = row.map(cellVal).filter(Boolean).join(' ');
            if (!rowText) continue;
            if (CLOSING_STOP_RE.test(rowText)) break;
            if (OPENING_ROW_RE.test(rowText)) {
              skippedOpening++;
              continue;
            }
            const d = pd(row[cDate]);
            if (!d) continue;
            const dr = r2(num(row[cDr]) || 0);
            const cr = cCr >= 0 ? r2(num(row[cCr]) || 0) : 0;
            if (!(dr > 0)) {
              if (cr > 0) skippedCredits++;
              continue;
            }
            const part = cPart >= 0 ? cellVal(row[cPart]) : '';
            const e: TallyEntry = {
              ledger: led.name,
              d,
              vt: cVt >= 0 ? cellVal(row[cVt]) : '',
              vno: cVno >= 0 ? cellVal(row[cVno]) : '',
              part,
              amt: dr,
            };
            const sk = [d, e.vno, e.amt, part].join('|');
            if (led.seen.has(sk)) {
              dup++;
              continue;
            }
            blockSeenKeys.push(sk);
            led.entries.push(e);
          }
          blockSeenKeys.forEach((sk) => led.seen.add(sk));
          break;
        }
      }
    }
  }

  if (skippedOpening) {
    warn.push(
      `${skippedOpening} Tally opening balance row(s) excluded (opening/B/F balances are never considered).`
    );
  }
  if (skippedCredits) {
    warn.push(
      `${skippedCredits} Tally credit-only row(s) excluded (only positive Debit voucher balances are considered).`
    );
  }
  if (dup) {
    warn.push(`${dup} duplicate Tally rows (same ledger repeated in more than one sheet) were ignored.`);
  }
  const leds: TallyLedger[] = Object.values(L).map(({ seen: _seen, ...rest }) => {
    rest.open = 0;
    rest.entries.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
    return rest;
  });

  return { ledgers: leds, warn };
}

/* ---------- Auto Mapping ---------- */
const STOP = new Set(
  'tds tcs asset assset ledger account ltd limited pvt private company co the and of llp india services service corporation corp'.split(
    ' '
  )
);
const ALIAS: Record<string, string> = { ins: 'insurance', fs: 'financial' };
const tok = (s: string) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .map((x) => ALIAS[x] || x)
    .filter((x) => x.length > 1 && !STOP.has(x) && !/^\d+$/.test(x));
const GEN = new Set([
  'insurance',
  'general',
  'bank',
  'assurance',
  'cars',
  'car',
  'motors',
  'motor',
  'auto',
  'automobiles',
  'steel',
  'steels',
]);
const tm = (a: string, b: string) => a === b || (a.length >= 5 && b.length >= 5 && a.slice(0, 5) === b.slice(0, 5));

export function autoMapLedgers(
  ledgers: TallyLedger[],
  deds: Record<string, DeductorSummary>,
  A: Entry26AS[],
  tol: number
): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  const byD: Record<string, number[]> = {};
  A.forEach((e) => {
    const k = `${e.typ}|${e.tan}`;
    (byD[k] = byD[k] || []).push(e.amt);
  });

  for (const L of ledgers) {
    const lt = tok(L.name);
    let best: string | null = null;
    let bs = 0;
    for (const k of Object.keys(deds)) {
      const D = deds[k];
      const dt = tok(D.name);
      const w = (x: string) => (GEN.has(x) ? 0.25 : 1);
      const denom = lt.reduce((a, x) => a + w(x), 0);
      const ns = lt.length && denom ? lt.filter((x) => dt.some((y) => tm(x, y))).reduce((a, x) => a + w(x), 0) / denom : 0;
      const am = byD[k] || [];
      const ent = L.entries.filter((e) => e.amt > 0);
      const hit = ent.length ? ent.filter((e) => am.some((a) => Math.abs(a - e.amt) <= tol)).length / ent.length : 0;
      const s = ns + 2 * hit + (D.typ === L.typ ? 0.3 : -1);
      if ((ns >= 0.3 || (ent.length >= 3 && hit >= 0.8)) && s >= 0.8 && s > bs) {
        bs = s;
        best = k;
      }
    }
    map[L.name] = best ? [best] : [];
  }
  return map;
}

/* ---------- Matching Engine ---------- */
const dayd = (a: string, b: string): number => Math.abs((Date.parse(a) - Date.parse(b)) / 864e5);

function subsetSum(c: { i: number; amt: number }[], target: number, tol: number, maxK: number): number[] | null {
  let best: number[] | null = null;
  let n = 0;
  function dfs(s: number, sum: number, pick: number[]) {
    if (best || n++ > 3e5) return;
    if (pick.length >= 2 && Math.abs(sum - target) <= tol) {
      best = pick.slice();
      return;
    }
    if (pick.length >= maxK) return;
    for (let x = s; x < c.length; x++) {
      const v = c[x].amt;
      if (sum + v > target + tol) continue;
      pick.push(c[x].i);
      dfs(x + 1, sum + v, pick);
      pick.pop();
      if (best) return;
    }
  }
  dfs(0, 0, []);
  return best;
}

export function matchGroup(
  A: { d: string; amt: number }[],
  T: { d: string; amt: number }[],
  o: { tol: number; win: number; scope?: RecoScope }
): { pairs: Omit<MatchedPair, 'id' | 'sa' | 'st' | 'diff' | 'gap' | 'ain' | 'tin' | 'inA' | 'inT' | 'full' | 'cat'>[]; ua: number[]; ut: number[] } {
  const ua = new Set(A.map((_, i) => i));
  const ut = new Set(T.map((_, i) => i));
  const pairs: { a: number[]; t: number[]; kind: MatchedPair['kind'] }[] = [];

  const pass = (thr: number, kind: MatchedPair['kind']) => {
    const c: [number, number, number, number][] = [];
    for (const i of ua) {
      for (const j of ut) {
        const df = Math.round(Math.abs(A[i].amt - T[j].amt) * 100);
        if (df <= Math.round(thr * 100)) c.push([df, dayd(A[i].d, T[j].d), i, j]);
      }
    }
    c.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    for (const [, , i, j] of c) {
      if (ua.has(i) && ut.has(j)) {
        ua.delete(i);
        ut.delete(j);
        pairs.push({ a: [i], t: [j], kind });
      }
    }
  };

  pass(0, 'exact');
  pass(o.tol, 'tol');

  const winPasses = o.scope === 'all' ? [o.win, 365] : [o.win];
  for (const win of winPasses) {
    [...ut]
      .filter((j) => T[j].amt > 0)
      .sort((x, y) => T[y].amt - T[x].amt)
      .forEach((j) => {
        if (!ut.has(j)) return;
        const c = [...ua]
          .filter((i) => A[i].amt > 0 && dayd(A[i].d, T[j].d) <= win)
          .sort((x, y) => dayd(A[x].d, T[j].d) - dayd(A[y].d, T[j].d))
          .slice(0, 22)
          .map((i) => ({ i, amt: A[i].amt }))
          .sort((x, y) => y.amt - x.amt);
        const s = subsetSum(c, T[j].amt, o.tol, 6);
        if (s) {
          s.forEach((i) => ua.delete(i));
          ut.delete(j);
          pairs.push({ a: s, t: [j], kind: 'many' });
        }
      });

    [...ua]
      .filter((i) => A[i].amt > 0)
      .sort((x, y) => A[y].amt - A[x].amt)
      .forEach((i) => {
        if (!ua.has(i)) return;
        const c = [...ut]
          .filter((j) => T[j].amt > 0 && dayd(A[i].d, T[j].d) <= win)
          .sort((x, y) => dayd(A[i].d, T[x].d) - dayd(A[i].d, T[y].d))
          .slice(0, 22)
          .map((j) => ({ i: j, amt: T[j].amt }))
          .sort((x, y) => y.amt - x.amt);
        const s = subsetSum(c, A[i].amt, o.tol, 6);
        if (s) {
          s.forEach((j) => ut.delete(j));
          ua.delete(i);
          pairs.push({ a: [i], t: s, kind: 'many' });
        }
      });
  }

  {
    const c: [number, number, number, number][] = [];
    for (const i of ua) {
      for (const j of ut) {
        const a = A[i].amt;
        const t = T[j].amt;
        const g = dayd(A[i].d, T[j].d);
        if (a > 0 && t > 0 && Math.abs(a - t) / Math.max(a, t) <= 0.1 && g <= o.win) {
          c.push([Math.abs(a - t) / Math.max(a, t), g, i, j]);
        }
      }
    }
    c.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    for (const [, , i, j] of c) {
      if (ua.has(i) && ut.has(j)) {
        ua.delete(i);
        ut.delete(j);
        pairs.push({ a: [i], t: [j], kind: 'near' });
      }
    }
  }

  return { pairs, ua: [...ua], ut: [...ut] };
}

/* ---------- Periods ---------- */
export function fyStart(A: Entry26AS[], ledgers: TallyLedger[] = []): number {
  const ds = [...A.map((e) => e.td), ...ledgers.flatMap((l) => l.entries.map((e) => e.d))]
    .filter(Boolean)
    .sort();
  if (!ds.length) return new Date().getFullYear();
  const [y, m] = ds[0].split('-').map(Number);
  return m >= 4 ? y : y - 1;
}

export interface PeriodExtraParams {
  m1?: number;
  m2?: number;
  asOn?: string;
  days?: number;
  ms?: string[] | null;
  f1?: number;
  f2?: number;
  q1?: number;
  q2?: number;
}

export function periodRange(
  code: string,
  fy: number,
  cs?: string,
  ce?: string,
  x: PeriodExtraParams = {}
): { s: string; e: string } {
  const S = (y: number, m: number, d: number) => ISO(y, m, d);
  const E = (y: number, m: number) => ISO(y, m, new Date(y, m + 1, 0).getDate());
  const q: Record<string, [[number, number], [number, number]]> = {
    Q1: [
      [fy, 3],
      [fy, 5],
    ],
    Q2: [
      [fy, 6],
      [fy, 8],
    ],
    Q3: [
      [fy, 9],
      [fy, 11],
    ],
    Q4: [
      [fy + 1, 0],
      [fy + 1, 2],
    ],
    H1: [
      [fy, 3],
      [fy, 8],
    ],
    H2: [
      [fy, 9],
      [fy + 1, 2],
    ],
    FY: [
      [fy, 3],
      [fy + 1, 2],
    ],
  };
  if (q[code]) return { s: S(q[code][0][0], q[code][0][1], 1), e: E(q[code][1][0], q[code][1][1]) };
  const my = (m: number) => (m >= 3 ? fy : fy + 1);
  if (/^M\d+$/.test(code)) {
    const m = +code.slice(1);
    return { s: S(my(m), m, 1), e: E(my(m), m) };
  }
  if (code === 'MR') {
    const idx1 = +(x.m1 ?? 0);
    const idx2 = +(x.m2 ?? 11);
    const loIdx = Math.min(idx1, idx2);
    const hiIdx = Math.max(idx1, idx2);
    const m1 = (3 + loIdx) % 12;
    const m2 = (3 + hiIdx) % 12;
    return { s: S(my(m1), m1, 1), e: E(my(m2), m2) };
  }
  if (code === 'FR') {
    const a = Math.min(+(x.f1 ?? fy), +(x.f2 ?? fy));
    const b = Math.max(+(x.f1 ?? fy), +(x.f2 ?? fy));
    return { s: S(a, 3, 1), e: E(b + 1, 2) };
  }
  if (code === 'MS') {
    const k = [...(x.ms || [])].sort();
    if (!k.length) return { s: S(fy, 3, 1), e: E(fy + 1, 2) };
    const [y1, m1] = k[0].split('-').map(Number);
    const [y2, m2] = k[k.length - 1].split('-').map(Number);
    return { s: S(y1, m1 - 1, 1), e: E(y2, m2 - 1) };
  }
  if (code === 'CY') return { s: S(fy, 0, 1), e: S(fy, 11, 31) };
  if (code === 'QR') {
    const a = +(x.q1 ?? 0);
    const b = x.q2 == null ? 3 : +x.q2;
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const ma = (3 + 3 * lo) % 12;
    const mb = (3 + 3 * hi + 2) % 12;
    return { s: S(my(ma), ma, 1), e: E(my(mb), mb) };
  }
  const as = x.asOn || ISO(fy + 1, 2, 31);
  const ym = (d: string): [number, number] => [+d.slice(0, 4), +d.slice(5, 7) - 1];
  const mo = (y: number, m: number, o: number): [number, number] => {
    const t = new Date(Date.UTC(y, m + o, 1));
    return [t.getUTCFullYear(), t.getUTCMonth()];
  };
  if (code === 'CQ' || code === 'PQ') {
    const [y, m] = ym(as);
    const sm = (3 + 3 * Math.floor(((m - 3 + 12) % 12) / 3)) % 12;
    const [sy, sm2] = mo(y, sm, code === 'PQ' ? -3 : 0);
    const [ey, em] = mo(sy, sm2, 2);
    return { s: S(sy, sm2, 1), e: E(ey, em) };
  }
  if (code === 'LM') {
    const [y, m] = ym(as);
    const [sy, sm] = mo(y, m, -((+(x.days ?? 3)) - 1));
    return { s: S(sy, sm, 1), e: as };
  }
  if (code === 'YTD') return { s: S(fy, 3, 1), e: as };
  if (code === 'LD') {
    const d = new Date(as + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - ((+(x.days ?? 30)) - 1));
    return { s: ISO(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()), e: as };
  }
  const sDate = cs || '0000-01-01';
  const eDate = ce || '9999-12-31';
  return sDate <= eDate ? { s: sDate, e: eDate } : { s: eDate, e: sDate };
}

export function buildPeriodLabel(o: Pick<RecoOptions, 'ms' | 'per' | 'periodLabelText'>): string {
  if (o.ms && o.ms.size > 0) {
    return (
      'Selected months: ' +
      [...o.ms]
        .sort()
        .map((k) => `${MN[+k.slice(5) - 1]}-${k.slice(2, 4)}`)
        .join(', ')
    );
  }
  return `${o.periodLabelText} (${dfmt(o.per.s)} to ${dfmt(o.per.e)})`;
}

export function scopeNoteText(o: Pick<RecoOptions, 'scope' | 'buf'>): string {
  if (o.scope === 'all') {
    return 'Scope: whole data is matched and the selected period only decides what is reported; entries booked in another period appear as "Timing – other period".';
  }
  if (o.scope === 'buf') {
    return `Scope: only transactions inside the period ± ${o.buf} days are considered; opening / closing balances and everything else are ignored.`;
  }
  return 'Scope: STRICT – only transactions dated inside the selected period are considered; nothing outside it and no opening / closing balance is used.';
}

/* ---------- Full Reconciliation ---------- */
export function runReco(S: RecoState, o: RecoOptions): RecoRunResult {
  const P = o.per;
  const msOK = (d: string) => !o.ms || o.ms.has(d.slice(0, 7));
  const inP = (d: string) => d >= P.s && d <= P.e && msOK(d);
  const sh = (d: string, n: number) => {
    if (!n || d < '0001' || d > '9998') return d;
    const x = new Date(d + 'T00:00:00Z');
    x.setUTCDate(x.getUTCDate() + n);
    return x.toISOString().slice(0, 10);
  };
  const lo = o.scope === 'all' ? '0000-01-01' : sh(P.s, -(o.buf || 0));
  const hi = o.scope === 'all' ? '9999-12-31' : sh(P.e, o.buf || 0);
  const msWindows =
    o.scope === 'buf' && o.ms && o.ms.size > 0
      ? [...o.ms].map((mk) => {
          const y = +mk.slice(0, 4);
          const m = +mk.slice(5, 7);
          const start = `${mk}-01`;
          const end = ISO(y, m - 1, new Date(y, m, 0).getDate());
          return { s: sh(start, -(o.buf || 0)), e: sh(end, o.buf || 0) };
        })
      : null;
  const inS = (d: string) => {
    if (d < lo || d > hi) return false;
    if (o.scope === 'strict') return msOK(d);
    if (o.scope === 'buf' && msWindows) {
      return msWindows.some((w) => d >= w.s && d <= w.e);
    }
    return true;
  };

  const A = S.A26.filter((e) => o.fin !== 'F' || !e.st || e.st === 'F')
    .map((e) => ({ ...e, d: o.basis === 'book' && e.bd ? e.bd : e.td }))
    .filter((e) => inS(e.d));
  const T: (TallyEntry & { typ: 'TDS' | 'TCS' })[] = [];
  S.ledgers.forEach((l) =>
    l.entries.forEach((e) => {
      if (inS(e.d)) T.push({ ...e, typ: l.typ });
    })
  );

  /* Union-Find over ledgers + deductors */
  const par: Record<string, string> = {};
  const find = (x: string): string => ((par[x] = par[x] || x) === x ? x : (par[x] = find(par[x])));
  const unite = (a: string, b: string) => {
    par[find(a)] = find(b);
  };
  const lk = (l: TallyLedger) => 'L|' + l.name;
  S.ledgers.forEach((l) => {
    find(lk(l));
    (S.map[l.name] || []).forEach((k) => unite(lk(l), 'D|' + k));
  });
  Object.keys(S.deds).forEach((k) => find('D|' + k));

  const G: Record<
    string,
    {
      ledgers: TallyLedger[];
      dk: string[];
      A: (Entry26AS & { d: string; p?: MatchedPair | null; cat?: string })[];
      T: (TallyEntry & { typ: 'TDS' | 'TCS'; p?: MatchedPair | null; cat?: string })[];
    }
  > = {};
  const gof = (x: string) => {
    const r = find(x);
    return (G[r] = G[r] || { ledgers: [], dk: [], A: [], T: [] });
  };
  S.ledgers.forEach((l) => gof(lk(l)).ledgers.push(l));
  Object.keys(S.deds).forEach((k) => gof('D|' + k).dk.push(k));
  A.forEach((e) => gof('D|' + e.typ + '|' + e.tan).A.push(e));
  T.forEach((e) => gof('L|' + e.ledger).T.push(e));

  const rawGroups = Object.values(G).filter(
    (g) => g.A.length || g.T.length || g.ledgers.length || g.dk.length
  );
  const outGroups: RecoGroup[] = [];

  for (const g of rawGroups) {
    const name = [...new Set(g.dk.map((k) => S.deds[k].name))].join(' + ');
    const lname = g.ledgers.map((l) => l.name).join(' + ');
    const title = name || lname;
    const typ = g.dk.length ? S.deds[g.dk[0]].typ : (g.ledgers[0]?.typ || 'TDS');
    const open = 0; // Opening balance is strictly ignored
    const cv = g.ledgers.map((l) => l.cov).filter(Boolean) as { s: string; e: string }[];
    const cov = cv.length
      ? { s: cv.map((c) => c.s).sort()[0], e: cv.map((c) => c.e).sort().reverse()[0] }
      : null;
    const hasL = g.ledgers.length > 0;
    const hasD = g.dk.length > 0;
    const manual = g.ledgers.some((l) => S.inc[l.name] === false);

    const m =
      g.A.length && g.T.length && !manual
        ? matchGroup(g.A, g.T, o)
        : { pairs: [], ua: g.A.map((_, i) => i), ut: g.T.map((_, i) => i) };

    const pairs: MatchedPair[] = m.pairs.map((rawP, pi) => {
      const sa = r2(rawP.a.reduce((s, i) => s + g.A[i].amt, 0));
      const st = r2(rawP.t.reduce((s, j) => s + g.T[j].amt, 0));
      const diff = r2(sa - st);
      const ad = rawP.a.map((i) => g.A[i].d);
      const td = rawP.t.map((j) => g.T[j].d);
      const gap = Math.round(Math.min(...ad.flatMap((x) => td.map((y) => dayd(x, y)))));
      const ain = rawP.a.filter((i) => inP(g.A[i].d));
      const tin = rawP.t.filter((j) => inP(g.T[j].d));
      const inA = r2(ain.reduce((s, i) => s + g.A[i].amt, 0));
      const inT = r2(tin.reduce((s, j) => s + g.T[j].amt, 0));
      const full = ain.length === rawP.a.length && tin.length === rawP.t.length;
      const cat = full
        ? rawP.kind === 'exact'
          ? 'Matched'
          : rawP.kind === 'tol'
            ? 'Rounding diff'
            : rawP.kind === 'near'
              ? 'Amount mismatch'
              : 'Grouped match'
        : ain.length || tin.length
          ? 'Timing – other period'
          : 'out';

      const mp: MatchedPair = {
        ...rawP,
        id: pi,
        sa,
        st,
        diff,
        gap,
        ain,
        tin,
        inA,
        inT,
        full,
        cat,
      };
      rawP.a.forEach((i) => {
        g.A[i].p = mp;
      });
      rawP.t.forEach((j) => {
        g.T[j].p = mp;
      });
      return mp;
    });

    const outside = (d: string) => cov && (d < cov.s || d > cov.e);
    m.ua.forEach((i) => {
      const e = g.A[i];
      e.cat = manual ? 'Manual' : outside(e.d) ? 'Outside Tally export range' : 'Not in Tally';
    });
    m.ut.forEach((j) => {
      g.T[j].cat = manual ? 'Manual' : 'Not in 26AS';
    });

    const aP = g.A.filter((e) => inP(e.d));
    const tP = g.T.filter((e) => inP(e.d));
    const sum = (x: { amt: number }[]) => r2(x.reduce((s, e) => s + e.amt, 0));
    const sA = sum(aP);
    const sT = sum(tP);
    const diff = r2(sA - sT);
    const uAList = aP.filter((e) => !e.p && e.cat === 'Not in Tally');
    const uOList = aP.filter((e) => !e.p && e.cat !== 'Not in Tally');
    const uTList = tP.filter((e) => !e.p);

    let uA = sum(uAList);
    let uO = sum(uOList);
    let uT = sum(uTList);
    let nA = uAList.length;
    let nT = uTList.length;
    let nO = uOList.length;
    let misAmt = r2(pairs.filter((p) => p.full && p.kind === 'near').reduce((s, p) => s + p.diff, 0));
    let rnd = r2(pairs.filter((p) => p.full && p.kind !== 'near').reduce((s, p) => s + p.diff, 0));
    let tim = r2(
      pairs.filter((p) => !p.full && p.cat !== 'out').reduce((s, p) => s + p.inA - p.inT, 0)
    );
    let manDiff = 0;
    let chk = r2(diff - (uA + uO - uT + misAmt + rnd + tim + manDiff));
    let nM = pairs.filter((p) => p.full).length;
    let nNear = pairs.filter((p) => p.full && p.kind === 'near').length;
    let nTim = pairs.filter((p) => p.cat.startsWith('Timing')).length;

    let status = !hasD
      ? 'Ledger not in 26AS'
      : !hasL
        ? 'No Tally ledger'
        : nA || nT || nO || nNear
          ? 'Mismatch'
          : nTim
            ? 'Timing difference'
            : 'Reconciled';

    if (manual) {
      uA = uO = uT = nA = nO = nT = tim = misAmt = rnd = 0;
      nM = nNear = nTim = 0;
      manDiff = diff;
      chk = r2(diff - manDiff);
      status = 'Manual reco';
    }
    if (!aP.length && !tP.length) status = 'No activity';

    outGroups.push({
      n: 0,
      ledgers: g.ledgers,
      dk: g.dk,
      A: g.A,
      T: g.T,
      name,
      lname,
      title,
      typ,
      open,
      cov,
      hasL,
      hasD,
      manual,
      pairs,
      sA,
      sT,
      diff,
      uA,
      uO,
      uT,
      nA,
      nT,
      nO,
      misAmt,
      rnd,
      tim,
      manDiff,
      chk,
      nM,
      nNear,
      nTim,
      status,
    });
  }

  outGroups.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff) || a.title.localeCompare(b.title));
  outGroups.forEach((g, i) => {
    g.n = i + 1;
  });

  return { groups: outGroups, o, P };
}

export function statusCategory(s: string): 'ok' | 'er' | 'wa' {
  if (/^(Matched|Reconciled)/.test(s)) return 'ok';
  if (/Not in|Mismatch|No Tally|not in 26AS|Outside|Amount/.test(s)) return 'er';
  return 'wa';
}

export function buildWarnings(S: RecoState, R: RecoRunResult): string[] {
  const w: string[] = [];
  const G = R.groups;
  const mg = G.filter((g) => g.manual);
  if (mg.length) {
    w.push(
      `${mg.length} group(s) are set to MANUAL reconciliation (unticked in the mapping table): ${mg
        .map((g) => g.title)
        .join('; ')}. Their 26AS and Tally entries are listed in the Manual reco tab; nothing was auto-matched for them.`
    );
  }
  (S.twarn || []).forEach((x) => w.push(x));
  if (S.files26.length > 1) {
    w.push(
      `${S.files26.length} 26AS files were merged; identical entries across files are counted only once.`
    );
  }
  w.push(
    `26AS reversal pairs (remark G / B) netted out: ${S.netted || 0} lines. Only net entries are reconciled.`
  );
  (S.bad || []).forEach((x) => w.push(`26AS file check: ${x}`));
  const nf = S.A26.filter((e) => e.st && e.st !== 'F').length;
  if (nf) {
    w.push(`${nf} 26AS entries are not in "Final" booking status – credit may not yet be available.`);
  }
  const nl = G.filter((g) => g.hasD && !g.hasL && g.sA);
  if (nl.length) {
    w.push(
      `${nl.length} 26AS deductors have no Tally ledger mapped (₹ ${fmtIN(
        nl.reduce((s, g) => s + g.sA, 0)
      )}). Check the mapping table.`
    );
  }
  const un = G.filter((g) => g.hasL && !g.hasD);
  if (un.length) {
    w.push(
      `${un.length} Tally ledgers are not mapped to any 26AS deductor: ${un
        .map((g) => g.lname)
        .join(', ')}.`
    );
  }
  S.ledgers
    .filter((l) => l.cov && (l.cov.s > R.P.s || l.cov.e < R.P.e))
    .forEach((l) =>
      w.push(
        `Ledger "${l.name}" was exported only for ${dfmt(l.cov!.s)} – ${dfmt(
          l.cov!.e
        )}; 26AS entries outside this range are flagged "Outside Tally export range", not "missing".`
      )
    );
  const fyE = ISO(S.fy + 1, 2, 31);
  const fyS = ISO(S.fy, 3, 1);
  const oo = S.ledgers.flatMap((l) => l.entries).filter((e) => e.d < fyS || e.d > fyE).length;
  if (oo) {
    w.push(`${oo} Tally entries fall outside FY ${S.fy}-${String(S.fy + 1).slice(2)}.`);
  }
  w.push(
    'Tally basis: Debit voucher entries only (Credit entries, Opening Balances, B/F, and Closing Balances are completely excluded).'
  );
  w.push(
    'Matching order: exact amount → within rounding tolerance → grouped (many 26AS = one Tally entry, or reverse) → near-amount (≤10% apart) flagged as Amount mismatch.'
  );
  w.push(scopeNoteText(R.o));
  return w;
}

export function buildRecoSheets(S: RecoState, R: RecoRunResult): BuiltRecoSheets {
  const o = R.o;
  const inP = (d: string) => d >= R.P.s && d <= R.P.e && (!o.ms || o.ms.has(d.slice(0, 7)));
  const G = R.groups;
  const join = <T,>(a: T[], f: (x: T) => string) => [...new Set(a.map(f))].join('; ');
  const dm = (a: string[]) => (a.length > 1 ? 'multiple' : dfmt(a[0]));

  const sum = {
    h: [
      '#',
      '26AS deductor / collector',
      'TAN',
      'Tally ledger(s)',
      'Type',
      '26AS total',
      'Tally debit total',
      'Difference (26AS − Tally)',
      'Not in Tally (₹)',
      'Not in Tally (#)',
      'Not in 26AS (₹)',
      'Not in 26AS (#)',
      'Amount mismatch (₹)',
      'Rounding diff (₹)',
      'Timing diff (₹)',
      'Manual diff (₹)',
      'Unexplained',
      'Status',
    ],
    d: G.filter((g) => g.status !== 'No activity').map((g) => [
      g.n,
      g.name || '—',
      g.dk.map((k) => S.deds[k]?.tan || '').join(', '),
      g.lname || '— no ledger —',
      g.typ,
      g.sA,
      g.sT,
      g.diff,
      r2(g.uA + g.uO),
      g.nA + g.nO,
      g.uT,
      g.nT,
      g.misAmt,
      g.rnd,
      g.tim,
      g.manDiff,
      g.chk,
      g.status,
    ]),
  };

  const tva = {
    h: [
      '#',
      'Group',
      'Tally ledger',
      'Vch date',
      'Vch type',
      'Vch no',
      'Particulars',
      'Tally amount',
      'Status',
      '26AS deductor',
      'TAN',
      '26AS txn date',
      '26AS booking date',
      'Section',
      '26AS amount',
      'Diff (Tally − 26AS)',
      'Remarks',
    ],
    d: [] as (string | number | null)[][],
  };

  const avt = {
    h: [
      '#',
      'Group',
      '26AS deductor',
      'TAN',
      'Type',
      'Section',
      'Txn date',
      'Booking date',
      '26AS status',
      '26AS amount',
      'Status',
      'Tally ledger',
      'Vch date',
      'Vch no',
      'Tally amount',
      'Diff (26AS − Tally)',
      'Remarks',
    ],
    d: [] as (string | number | null)[][],
  };

  const mis = {
    h: [
      '#',
      'Group',
      'Category',
      'Type',
      '26AS txn dates',
      'Sections',
      '26AS amount',
      'Tally ledger',
      'Tally vch dates',
      'Tally vch no',
      'Tally amount',
      'Difference',
      'Day gap',
      'Remarks',
    ],
    d: [] as (string | number | null)[][],
  };

  const mA = {
    h: [
      '#',
      'Group / 26AS deductor',
      'TAN',
      'Type',
      'Section',
      'Txn date',
      'Booking date',
      '26AS status',
      'Tax amount',
      'Reason',
    ],
    d: [] as (string | number | null)[][],
  };

  const mT = {
    h: ['#', 'Group', 'Tally ledger', 'Vch date', 'Vch type', 'Vch no', 'Particulars', 'Amount', 'Reason'],
    d: [] as (string | number | null)[][],
  };

  const MI: ManualRecoItem[] = [];
  const mi = (
    src: 'A' | 'T',
    g: RecoGroup,
    x: Entry26AS | TallyEntry,
    why: string
  ): ManualRecoItem => {
    if (src === 'A') {
      const aItem = x as Entry26AS & { d: string };
      return {
        k: `A|${aItem.id}`,
        src: '26AS',
        grp: g.title,
        why,
        d: aItem.d,
        party: aItem.name,
        ref: `${aItem.sec} · ${aItem.tan}`,
        amt: aItem.amt,
        gn: g.n,
      };
    }
    const tItem = x as TallyEntry;
    return {
      k: `T|${[tItem.ledger, tItem.d, tItem.vno, tItem.amt, tItem.part].join('|')}`,
      src: 'Tally',
      grp: g.title,
      why,
      d: tItem.d,
      party: tItem.ledger,
      ref: tItem.vno,
      amt: tItem.amt,
      gn: g.n,
    };
  };

  const gl: Record<number, GroupLedgerSheet> = {};
  let a = 0;
  let b = 0;
  let c = 0;
  let e = 0;
  let f = 0;

  for (const g of G) {
    if (g.manual) {
      g.A.forEach((x) => {
        if (inP(x.d)) MI.push(mi('A', g, x, 'Manual reco ledger'));
      });
      g.T.forEach((x) => {
        if (inP(x.d)) MI.push(mi('T', g, x, 'Manual reco ledger'));
      });
    }

    const L: [string, string, string, number | null, string, string, string, number | null, number, string, string][] = [];
    const sn = g.title.replace(/[\\/?*[\]:]/g, '').slice(0, 24) || `Group_${g.n}`;
    const remark = (p: MatchedPair) =>
      p.kind === 'many'
        ? p.a.length > 1
          ? `${p.a.length} 26AS entries = 1 Tally entry`
          : `${p.t.length} Tally entries = 1 26AS entry`
        : p.kind === 'near'
          ? 'Amount differs – verify booking'
          : p.gap > o.win
            ? `Date gap ${p.gap} days`
            : p.kind === 'tol'
              ? `Rounding ₹${fmtIN(p.diff)}`
              : '';

    if (!g.manual) {
      const seenPairTva = new Set<number>();
      const seenPairAvt = new Set<number>();

      g.T.forEach((t) => {
        if (!inP(t.d)) return;
        const p = t.p;
        const matchedA = p ? p.a.map((i) => g.A[i]) : [];
        const isFirstPairTva = p ? !seenPairTva.has(p.id) : false;
        if (p && isFirstPairTva) seenPairTva.add(p.id);
        tva.d.push([
          ++a,
          g.title,
          t.ledger,
          dfmt(t.d),
          t.vt,
          t.vno,
          t.part,
          t.amt,
          p ? p.cat : t.cat || '',
          matchedA.length ? join(matchedA, (x) => x.name) : '',
          matchedA.length ? join(matchedA, (x) => x.tan) : '',
          matchedA.length ? dm(matchedA.map((x) => x.td)) : '',
          matchedA.length ? dm(matchedA.map((x) => x.bd)) : '',
          matchedA.length ? join(matchedA, (x) => x.sec) : '',
          p ? (isFirstPairTva ? p.sa : '') : '',
          p ? (isFirstPairTva ? r2(p.st - p.sa) : '') : '',
          p
            ? isFirstPairTva
              ? remark(p)
              : `${remark(p)} (grouped total shown on 1st row)`
            : g.hasD
              ? 'Booked in Tally but not in 26AS'
              : 'Ledger not mapped to any 26AS deductor',
        ]);
        if (!p) {
          mT.d.push([
            ++e,
            g.title,
            t.ledger,
            dfmt(t.d),
            t.vt,
            t.vno,
            t.part,
            t.amt,
            g.hasD
              ? 'Not in 26AS (deductor has not reported / wrong TAN / wrong amount)'
              : 'Ledger not mapped to any 26AS deductor',
          ]);
        }
      });

      g.A.forEach((x) => {
        if (!inP(x.d)) return;
        const p = x.p;
        const matchedT = p ? p.t.map((j) => g.T[j]) : [];
        const isFirstPairAvt = p ? !seenPairAvt.has(p.id) : false;
        if (p && isFirstPairAvt) seenPairAvt.add(p.id);
        avt.d.push([
          ++b,
          g.title,
          x.name,
          x.tan,
          x.typ,
          x.sec,
          dfmt(x.td),
          dfmt(x.bd),
          x.st === 'F' ? 'Final' : x.st,
          x.amt,
          p ? p.cat : x.cat || '',
          matchedT.length ? join(matchedT, (y) => y.ledger) : '',
          matchedT.length ? dm(matchedT.map((y) => y.d)) : '',
          matchedT.length ? join(matchedT, (y) => y.vno) : '',
          p ? (isFirstPairAvt ? p.st : '') : '',
          p ? (isFirstPairAvt ? p.diff : '') : '',
          p
            ? isFirstPairAvt
              ? remark(p)
              : `${remark(p)} (grouped total shown on 1st row)`
            : g.hasL
              ? x.cat === 'Not in Tally'
                ? 'In 26AS but not booked in Tally'
                : 'Tally export does not cover this date'
              : 'No Tally ledger mapped for this deductor',
        ]);
        if (!p) {
          mA.d.push([
            ++f,
            g.title,
            x.tan,
            x.typ,
            x.sec,
            dfmt(x.td),
            dfmt(x.bd),
            x.st === 'F' ? 'Final' : x.st,
            x.amt,
            g.hasL
              ? x.cat === 'Not in Tally'
                ? 'Not booked in Tally'
                : 'Outside Tally export range'
              : 'No Tally ledger mapped',
          ]);
        }
      });

      g.pairs.forEach((p) => {
        if (p.cat === 'out') return;
        const matchedA = p.a.map((i) => g.A[i]);
        const matchedT = p.t.map((j) => g.T[j]);
        const gapBad = p.full && p.gap > o.win;
        if (p.cat !== 'Matched' || gapBad) {
          mis.d.push([
            ++c,
            g.title,
            p.cat === 'Matched' ? 'Date gap' : gapBad && p.cat !== 'Amount mismatch' ? `${p.cat} + Date gap` : p.cat,
            g.typ,
            dm(matchedA.map((x) => x.td)),
            join(matchedA, (x) => x.sec),
            p.sa,
            join(matchedT, (x) => x.ledger),
            dm(matchedT.map((x) => x.d)),
            join(matchedT, (x) => x.vno),
            p.st,
            p.diff,
            p.gap,
            remark(p),
          ]);
        }
        L.push([
          matchedA.map((x) => x.td).sort()[0] || matchedT[0]?.d || '',
          matchedA.length ? dm(matchedA.map((x) => x.td)) : '',
          join(matchedA, (x) => x.sec),
          p.sa,
          dm(matchedT.map((x) => x.d)),
          join(matchedT, (x) => x.vno),
          join(matchedT, (x) => x.ledger),
          p.st,
          p.diff,
          p.cat,
          remark(p),
        ]);
      });

      g.A.forEach((x) => {
        if (!x.p && inP(x.d)) {
          L.push([x.d, dfmt(x.td), x.sec, x.amt, '', '', '', null, x.amt, x.cat || '', '']);
          MI.push(mi('A', g, x, x.cat === 'Not in Tally' ? 'Not booked in Tally' : 'Outside Tally export range'));
        }
      });
      g.T.forEach((x) => {
        if (!x.p && inP(x.d)) {
          L.push([x.d, '', '', null, dfmt(x.d), x.vno, x.ledger, x.amt, -x.amt, 'Not in 26AS', '']);
          MI.push(mi('T', g, x, 'Not in 26AS'));
        }
      });
    }

    L.sort((p, q) => (p[0] < q[0] ? -1 : p[0] > q[0] ? 1 : 0));
    gl[g.n] = {
      name: `${g.n}-${sn}`,
      g,
      hdr: [
        ['Group', g.title],
        ['26AS deductor(s)', g.name || '—'],
        ['Tally ledger(s)', g.lname || '— none —'],
        ['Period', buildPeriodLabel(o)],
        ['26AS total', g.sA],
        ['Tally debit total', g.sT],
        ['Difference (26AS − Tally)', g.diff],
        [`  Not in Tally (${g.nA + g.nO})`, r2(g.uA + g.uO)],
        [`  Not in 26AS (${g.nT})`, g.uT],
        [`  Amount mismatch (${g.nNear})`, g.misAmt],
        ['  Rounding / grouped diff', g.rnd],
        ['  Timing (other period)', g.tim],
        ['  Manual reco diff', g.manDiff],
        ['Unexplained check (should be 0)', g.chk],
        ['Status', g.status],
      ],
      h: [
        '26AS txn date',
        'Section',
        '26AS amount',
        'Tally vch date',
        'Vch no',
        'Tally ledger',
        'Tally amount',
        'Diff (26AS − Tally)',
        'Status',
        'Remarks',
      ],
      d: L.map((r) => r.slice(1)),
    };
  }

  MI.sort((p, q) => p.gn - q.gn || (p.d < q.d ? -1 : p.d > q.d ? 1 : 0));
  const fy = o.fy;
  const PH = [
    'Period',
    'From',
    'To',
    '26AS total',
    'Tally debit total',
    'Difference (26AS − Tally)',
    'Not in Tally (₹)',
    'Not in Tally (#)',
    'Not in 26AS (₹)',
    'Not in 26AS (#)',
    'Amount mismatch (₹)',
    'Rounding / Manual (₹)',
    'Status',
  ];

  const evalRangeRow = (
    n: string,
    p: { s: string; e: string },
    extra: Pick<RecoOptions, 'scope' | 'buf' | 'ms'>
  ) => {
    const rr = runReco(S, { ...o, per: p, ...extra });
    let sa = 0;
    let stt = 0;
    let ua = 0;
    let na = 0;
    let ut = 0;
    let nt = 0;
    let misA = 0;
    let rndMan = 0;
    rr.groups.forEach((g) => {
      sa += g.sA;
      stt += g.sT;
      ua += g.uA + g.uO;
      na += g.nA + g.nO;
      ut += g.uT;
      nt += g.nT;
      misA += g.misAmt;
      rndMan += g.rnd + g.manDiff;
    });
    sa = r2(sa);
    stt = r2(stt);
    return [
      n,
      dfmt(p.s),
      dfmt(p.e),
      sa,
      stt,
      r2(sa - stt),
      r2(ua),
      na,
      r2(ut),
      nt,
      r2(misA),
      r2(rndMan),
      !na && !nt && Math.abs(sa - stt) <= o.tol * 10
        ? 'Reconciled'
        : sa || stt
          ? 'Mismatch'
          : 'No activity',
    ];
  };

  const prow = (n: string, p: { s: string; e: string }) =>
    evalRangeRow(n, p, { scope: 'strict', buf: 0, ms: null });

  const defs: [string, string][] = [
    ...FY_MONTH_LABELS.map((n, i): [string, string] => [n, `M${(3 + i) % 12}`]),
    ['Q1 (Apr–Jun)', 'Q1'],
    ['Q2 (Jul–Sep)', 'Q2'],
    ['Q3 (Oct–Dec)', 'Q3'],
    ['Q4 (Jan–Mar)', 'Q4'],
    ['H1 (Apr–Sep)', 'H1'],
    ['H2 (Oct–Mar)', 'H2'],
    [`Full FY ${fy}-${String(fy + 1).slice(2)}`, 'FY'],
  ];

  const pwRows = defs.map(([n, cd]) => prow(n, periodRange(cd, fy)));
  o.fyList
    .filter((y) => y !== fy)
    .forEach((y) => pwRows.push(prow(`Full FY ${y}-${String(y + 1).slice(2)}`, periodRange('FY', y))));

  const ds = [
    ...S.A26.filter((e) => o.fin !== 'F' || !e.st || e.st === 'F').map((e) =>
      o.basis === 'book' && e.bd ? e.bd : e.td
    ),
    ...S.ledgers.flatMap((l) => l.entries.map((e) => e.d)),
  ]
    .filter(Boolean)
    .sort();
  const addDays = (d: string, n: number) => {
    const x = new Date(d + 'T00:00:00Z');
    x.setUTCDate(x.getUTCDate() + n);
    return x.toISOString().slice(0, 10);
  };
  const bs = R.P.s > '0000-01-01' ? R.P.s : ds[0] || '';
  const be = R.P.e < '9999-12-31' ? R.P.e : ds[ds.length - 1] || '';
  const N = Math.max(1, o.bkt || 30);
  const bd: (string | number | null)[][] = [];
  if (bs && be && bs <= be) {
    for (let s0 = bs, k = 0; s0 <= be && k < 60; s0 = addDays(s0, N), k++) {
      const eRaw = addDays(s0, N - 1);
      const e0 = eRaw > be ? be : eRaw;
      if (o.ms && o.ms.size > 0) {
        const sYM = s0.slice(0, 7);
        const eYM = e0.slice(0, 7);
        const touchesSelected = [...o.ms].some((mk) => mk >= sYM && mk <= eYM);
        if (!touchesSelected) continue;
      }
      bd.push(
        evalRangeRow(`Bucket ${bd.length + 1}`, { s: s0, e: e0 }, {
          scope: o.scope === 'buf' ? 'buf' : 'strict',
          buf: o.scope === 'buf' ? o.buf : 0,
          ms: o.ms,
        })
      );
    }
  }

  return {
    sum,
    tva,
    avt,
    mis,
    mA,
    mT,
    man: { items: MI, d: MI },
    gl,
    pw: { h: PH, d: pwRows },
    bk: { h: PH, d: bd },
    warn: buildWarnings(S, R),
  };
}

export function buildDashboardData(S: RecoState, R: RecoRunResult, SH: BuiltRecoSheets): DashboardData {
  const G = R.groups.filter((g) => g.status !== 'No activity');
  const sm = (k: 'sA' | 'sT' | 'uA' | 'uO' | 'uT' | 'misAmt' | 'rnd' | 'tim' | 'manDiff' | 'chk' | 'nA' | 'nO' | 'nT' | 'nNear') =>
    r2(G.reduce((a, g) => a + g[k], 0));
  const sA = sm('sA');
  const sT = sm('sT');
  const diff = r2(sA - sT);
  const miss = r2(sm('uA') + sm('uO'));
  const uT = sm('uT');
  const misAmt = sm('misAmt');
  const rnd = sm('rnd');
  const tim = sm('tim');
  const manDiff = sm('manDiff');
  const chk = r2(diff - (miss - uT + misAmt + rnd + tim + manDiff));
  const cntMiss = Math.round(sm('nA') + sm('nO'));
  const cntUT = Math.round(sm('nT'));
  const cntMis = Math.round(sm('nNear'));
  const mansA = r2(G.filter((g) => g.manual).reduce((a, g) => a + g.sA, 0));
  const byS: Record<string, number> = {};
  G.forEach((g) => {
    byS[g.status] = (byS[g.status] || 0) + 1;
  });
  const top = [...G]
    .filter((g) => g.diff)
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
    .slice(0, 10);

  const inPer = (d: string) =>
    d >= R.P.s && d <= R.P.e && (!R.o.ms || R.o.ms.has(d.slice(0, 7)));
  const sec: Record<string, { t: number; u: number }> = {};
  G.forEach((g) =>
    g.A.forEach((x) => {
      if (!inPer(x.d)) return;
      const obj = (sec[x.sec] = sec[x.sec] || { t: 0, u: 0 });
      obj.t += x.amt;
      if (!x.p && (x.cat === 'Not in Tally' || x.cat === 'Outside Tally export range')) obj.u += x.amt;
    })
  );

  const open = SH.man.items.filter((i) => !S.man[i.k]);
  const openA = r2(open.filter((i) => i.src === '26AS').reduce((a, i) => a + i.amt, 0));

  return {
    G,
    sA,
    sT,
    diff,
    miss,
    uT,
    misAmt,
    rnd,
    tim,
    manDiff,
    chk,
    cntMiss,
    cntUT,
    cntMis,
    mansA,
    byS,
    top,
    months: SH.pw.d.slice(0, 12),
    open,
    openA,
    sec: Object.entries(sec)
      .map(([k, v]): [string, number, number] => [k, r2(v.t), r2(v.u)])
      .sort((a, b) => b[1] - a[1]),
    pct: sA ? Math.round(((sA - miss - mansA) / sA) * 1000) / 10 : 0,
  };
}

/* ---------- ExcelJS Professional Workbook ---------- */
export async function buildProRecoExcelWorkbook(
  S: RecoState,
  R: RecoRunResult,
  SH: BuiltRecoSheets,
  onProgress?: (pct: number) => void
): Promise<ArrayBuffer> {
  const o = R.o;
  const wb = new ExcelJS.Workbook();
  wb.creator = '26AS ⇄ Tally Ledger Reco · VCPL Tools';
  wb.created = new Date();

  const NAVY = 'FF1B2A49';
  const LG = 'FFEEF1F6';
  const BD: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: 'FFD0D5DD' } };
  const BR: Partial<ExcelJS.Borders> = { top: BD, left: BD, bottom: BD, right: BD };
  const FILL = { ok: 'FFE3F6EC', wa: 'FFFFF1DA', er: 'FFFDE7E7' };
  const FONT = { ok: 'FF0A8A4A', wa: 'FFB86E00', er: 'FFC62828' };
  const NUM = '#,##0.00;[Red]-#,##0.00';
  const solid = (argb: string): ExcelJS.Fill => ({
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb },
  });
  const INFO = `Period: ${buildPeriodLabel(o)}   |   26AS date basis: ${
    o.basis === 'book' ? 'Booking date' : 'Transaction date'
  }   |   Tally: Debit entries only (Opening/Closing/Credit excluded)   |   Tolerance ₹${o.tol}   |   Generated ${new Date().toLocaleString('en-IN')}`;
  const isCntCol = (h: string) => /^(#|\s*#\s*|Section|Day gap|Manual match|Not in .*\(#\))$/.test(String(h).trim());
  const isNoSumCol = (h: string) => /^(#|Section|Day gap|Manual match)$/.test(String(h).trim());

  const usedSheetNames = new Set<string>();
  const uniqueSheetName = (raw: string) => {
    const base = (raw || 'Sheet').replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 28) || 'Sheet';
    let candidate = base.slice(0, 31);
    let idx = 2;
    while (usedSheetNames.has(candidate.toLowerCase())) {
      const suf = ` (${idx++})`;
      candidate = `${base.slice(0, 31 - suf.length)}${suf}`;
    }
    usedSheetNames.add(candidate.toLowerCase());
    return candidate;
  };

  const add = (
    name: string,
    titleText: string,
    h: string[],
    rows: (string | number | null)[][],
    x: {
      hdr?: [string, string | number][];
      tab?: string;
      total?: boolean;
      after?: (ws: ExcelJS.Worksheet, hs: number) => void;
    } = {}
  ) => {
    const hs = 4 + (x.hdr ? x.hdr.length + 1 : 0);
    const n = h.length;
    const nc = Math.max(n, 4);
    const ws = wb.addWorksheet(uniqueSheetName(name), {
      properties: { tabColor: { argb: x.tab || 'FF1F5EFF' } },
      views: [{ state: 'frozen', ySplit: hs, showGridLines: false }],
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });

    ws.mergeCells(1, 1, 1, nc);
    ws.getCell(1, 1).value = titleText;
    ws.getCell(1, 1).font = { bold: true, size: 15, color: { argb: NAVY } };
    ws.getRow(1).height = 26;

    ws.mergeCells(2, 1, 2, nc);
    ws.getCell(2, 1).value = INFO;
    ws.getCell(2, 1).font = { italic: true, size: 10, color: { argb: 'FF667085' } };

    (x.hdr || []).forEach((r, i) => {
      const aCell = ws.getCell(3 + i, 1);
      const bCell = ws.getCell(3 + i, 2);
      aCell.value = r[0];
      aCell.font = { bold: true };
      aCell.fill = solid(LG);
      aCell.border = BR;
      bCell.value = r[1];
      bCell.font = { bold: true };
      bCell.border = BR;
      if (typeof r[1] === 'number') bCell.numFmt = NUM;
      bCell.alignment = { horizontal: 'left' };
    });

    const hr = ws.getRow(hs);
    h.forEach((v, i) => {
      const c = hr.getCell(i + 1);
      c.value = String(v).trim();
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = solid(NAVY);
      c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      c.border = BR;
    });
    hr.height = 30;

    const si = h.findIndex((v) => /^(Status|Category|Reason)$/.test(String(v).trim()));
    rows.forEach((r, ri) => {
      const row = ws.getRow(hs + 1 + ri);
      r.forEach((v, i) => {
        const c = row.getCell(i + 1);
        c.value = v === '' || v == null ? null : v;
        c.border = BR;
        if (ri % 2) c.fill = solid('FFF8F9FB');
        if (typeof v === 'number') {
          c.numFmt = isCntCol(h[i]) ? '0' : NUM;
          c.alignment = { horizontal: 'right' };
        }
        if (i === si && v) {
          const k = statusCategory(String(v));
          c.fill = solid(FILL[k]);
          c.font = { bold: true, color: { argb: FONT[k] } };
          c.alignment = { horizontal: 'center' };
        }
      });
    });

    const last = hs + rows.length;
    if (x.total && rows.length) {
      const row = ws.getRow(last + 1);
      row.getCell(1).value = 'TOTAL';
      h.forEach((v, i) => {
        const c = row.getCell(i + 1);
        c.fill = solid(LG);
        c.font = { bold: true };
        c.border = { top: { style: 'medium', color: { argb: NAVY } }, bottom: BD, left: BD, right: BD };
        if (i > 0 && !isNoSumCol(v) && rows.some((r) => typeof r[i] === 'number')) {
          const L = ws.getColumn(i + 1).letter;
          const tot = r2(rows.reduce((acc, r) => acc + (typeof r[i] === 'number' ? (r[i] as number) : 0), 0));
          c.value = { formula: `SUM(${L}${hs + 1}:${L}${last})`, result: tot };
          c.numFmt = isCntCol(v) ? '0' : NUM;
        }
      });
    }

    if (!rows.length) {
      ws.getCell(hs + 1, 1).value = 'No records';
      ws.getCell(hs + 1, 1).font = { italic: true, color: { argb: 'FF667085' } };
    }

    for (let i = 0; i < n; i++) {
      const col = ws.getColumn(i + 1);
      const smp = [
        String(h[i] || ''),
        ...rows.slice(0, 80).map((r) => String(r[i] == null ? '' : typeof r[i] === 'number' ? fmtIN(r[i]) : r[i])),
      ];
      if (i === 0 && x.hdr) smp.push(...x.hdr.map((r) => String(r[0])));
      col.width = Math.min(48, Math.max(11, ...smp.map((t) => t.length + 3)));
    }
    if (rows.length) ws.autoFilter = { from: { row: hs, column: 1 }, to: { row: hs, column: n } };
    if (x.after) x.after(ws, hs);
    return ws;
  };

  onProgress?.(20);

  /* Dashboard */
  {
    const D = buildDashboardData(S, R, SH);
    const ws = wb.addWorksheet(uniqueSheetName('Dashboard'), {
      properties: { tabColor: { argb: 'FF0A8A4A' } },
      views: [{ showGridLines: false }],
    });
    [42, 18, 18, 18, 34, 34].forEach((w, i) => {
      ws.getColumn(i + 1).width = w;
    });
    ws.mergeCells('A1:F1');
    ws.getCell('A1').value = '26AS ⇄ Tally Reconciliation – Dashboard';
    ws.getCell('A1').font = { bold: true, size: 18, color: { argb: NAVY } };
    ws.getRow(1).height = 30;
    ws.mergeCells('A2:F2');
    ws.getCell('A2').value = INFO;
    ws.getCell('A2').font = { italic: true, size: 10, color: { argb: 'FF667085' } };

    let r = 4;
    const title = (t: string) => {
      ws.mergeCells(r, 1, r, 6);
      const c = ws.getCell(r, 1);
      c.value = t;
      c.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
      c.fill = solid(NAVY);
      r++;
    };
    const head = (a: string[]) => {
      a.forEach((t, i) => {
        const c = ws.getCell(r, i + 1);
        c.value = t;
        c.font = { bold: true };
        c.fill = solid(LG);
        c.border = BR;
        c.alignment = { horizontal: i ? 'center' : 'left' };
      });
      r++;
    };
    const put = (a: (string | number | null)[], bars?: Record<number, string>) => {
      a.forEach((v, i) => {
        const c = ws.getCell(r, i + 1);
        c.value = v;
        c.border = BR;
        if (typeof v === 'number') c.numFmt = NUM;
        if (bars && bars[i]) {
          c.font = { color: { argb: bars[i] } };
          c.border = {};
        }
      });
      r++;
    };
    const bar = (v: number, m: number) => '█'.repeat(Math.max(v ? 1 : 0, Math.round((Math.abs(v) / m) * 28)));

    title('Key figures & reconciliation proof bridge');
    (
      [
        ['26AS total (period)', D.sA],
        ['Tally debit total (period, opening/credit excluded)', D.sT],
        ['Net difference (26AS − Tally Debit)', D.diff],
        ['26AS value reconciled (%)', D.pct],
        ['  (+) Pending: Not in Tally (₹)', D.miss],
        ['  (−) Pending: In Tally, not in 26AS (₹)', D.uT],
        ['  (±) Amount mismatch diff (₹)', D.misAmt],
        ['  (±) Rounding / grouped diff (₹)', D.rnd],
        ['  (±) Cross-period timing diff (₹)', D.tim],
        ['  (±) Manual reco ledger net diff (₹)', D.manDiff],
        ['Reconciliation residual / unexplained (must be 0)', D.chk],
        ['Manual items open (count)', D.open.length],
        ['Manual items open – 26AS value (₹)', D.openA],
      ] as [string, number][]
    ).forEach((a) => {
      put(a);
      ws.getCell(r - 1, 1).font = { bold: true };
      ws.getCell(r - 1, 2).font = { bold: true, size: 12 };
    });

    r++;
    title('Group status');
    head(['Status', 'Groups', '% of groups']);
    Object.entries(D.byS).forEach(([k, n]) => {
      const c = statusCategory(k);
      put([k, n, Math.round((n / (D.G.length || 1)) * 1000) / 10]);
      const aCell = ws.getCell(r - 1, 1);
      aCell.fill = solid(FILL[c]);
      aCell.font = { bold: true, color: { argb: FONT[c] } };
      ws.getCell(r - 1, 2).numFmt = '0';
      ws.getCell(r - 1, 3).numFmt = '0.0"%"';
    });

    r++;
    title('Top 10 differences (26AS − Tally)');
    head(['26AS deductor / ledger', '26AS', 'Tally', 'Difference', '']);
    const m1 = Math.max(1, ...D.top.map((g) => Math.abs(g.diff)));
    D.top.forEach((g) =>
      put([g.title, g.sA, g.sT, g.diff, bar(g.diff, m1)], {
        4: g.diff > 0 ? 'FFC62828' : 'FFB86E00',
      })
    );

    r++;
    title('Month-wise (selected FY)');
    head(['Month', '26AS', 'Tally', 'Difference', '26AS bar', 'Tally bar']);
    const m2 = Math.max(1, ...D.months.flatMap((x) => [Number(x[3] || 0), Number(x[4] || 0)]));
    D.months.forEach((x) =>
      put([x[0], x[3], x[4], x[5], bar(Number(x[3] || 0), m2), bar(Number(x[4] || 0), m2)], {
        4: 'FF1F5EFF',
        5: 'FF0A8A4A',
      })
    );

    r++;
    title('Section-wise 26AS');
    head(['Section', '26AS total', 'Not booked in Tally', '% not booked', '']);
    const m3 = Math.max(1, ...D.sec.map((x) => x[1]));
    D.sec.forEach((x) => {
      put([x[0], x[1], x[2], x[1] ? Math.round((x[2] / x[1]) * 1000) / 10 : 0, bar(x[1], m3)], {
        4: 'FF1F5EFF',
      });
      ws.getCell(r - 1, 4).numFmt = '0.0"%"';
    });
  }

  onProgress?.(40);

  const G = R.groups;
  add('Summary', 'Group-wise reconciliation summary', SH.sum.h, SH.sum.d, {
    total: true,
    tab: 'FF1B2A49',
  });

  (
    [
      ['Tally vs 26AS', 'tva', 'Tally debit ledger vs 26AS – every Tally debit entry'],
      ['26AS vs Tally', 'avt', '26AS vs Tally – every 26AS entry'],
      ['Mismatches', 'mis', 'Mismatches, rounding & timing differences'],
      ['Missing in Tally', 'mA', '26AS entries not booked in Tally'],
      ['Missing in 26AS', 'mT', 'Tally debit entries not found in 26AS'],
    ] as const
  ).forEach(([n, k, t]) =>
    add(n, t, SH[k].h, SH[k].d, {
      total: true,
      tab: k === 'mA' || k === 'mT' ? 'FFC62828' : 'FF1F5EFF',
    })
  );

  onProgress?.(60);

  /* Manual Reco Workbench + Live Formula Manual Links */
  {
    const it = SH.man.items;
    const mh = [
      '#',
      'Source',
      'Group',
      'Why listed',
      'Date',
      'Party / ledger',
      'Ref',
      'Amount',
      'Manual match no.',
      'Status',
      'Remarks',
    ];
    const rows = it.map((i, n) => [
      n + 1,
      i.src,
      i.grp,
      i.why,
      dfmt(i.d),
      i.party,
      i.ref,
      i.amt,
      S.man[i.k] || '',
      S.man[i.k] ? 'Matched manually' : 'Open',
      '',
    ]);
    add(
      'Manual Reco',
      'Manual reconciliation – 26AS extract & unreconciled items (type the same “Manual match no.” on 26AS and Tally rows)',
      mh,
      rows,
      {
        total: true,
        tab: 'FFB86E00',
        after: (ws, hs) => {
          rows.forEach((_, ri) => {
            const R0 = hs + 1 + ri;
            [9, 10, 11].forEach((c) => {
              ws.getCell(R0, c).fill = solid('FFFFFBEA');
            });
            ws.getCell(R0, 10).dataValidation = {
              type: 'list',
              allowBlank: true,
              formulae: ['"Open,Matched manually,Query raised,Write-off"'],
            };
          });
          ws.getColumn(11).width = 34;
        },
      }
    );

    if (it.length) {
      const L = 4 + it.length;
      const rg = (c: string) => `'Manual Reco'!$${c}$5:$${c}$${L}`;
      const ids = [...new Set(Object.values(S.man))];
      const N = Math.max(0, ...ids) + 40;
      const lr: [number, number, number, number, number, number, string][] = [];
      const agg = (id: number, src: '26AS' | 'Tally') =>
        it.filter((i) => S.man[i.k] === id && i.src === src);
      for (let id = 1; id <= N; id++) {
        const aList = agg(id, '26AS');
        const tList = agg(id, 'Tally');
        const sa = r2(aList.reduce((x, i) => x + i.amt, 0));
        const stt = r2(tList.reduce((x, i) => x + i.amt, 0));
        lr.push([
          id,
          aList.length,
          sa,
          tList.length,
          stt,
          r2(sa - stt),
          aList.length + tList.length ? (Math.abs(sa - stt) <= o.tol ? 'Reconciled' : 'Difference') : '',
        ]);
      }
      add(
        'Manual Links',
        'Manual matches – totals recalculate when you type match numbers in the Manual Reco sheet',
        [
          'Manual match no.',
          '26AS entries (#)',
          '26AS total',
          'Tally entries (#)',
          'Tally total',
          'Difference (26AS − Tally)',
          'Status',
        ],
        lr,
        {
          tab: 'FFB86E00',
          after: (ws, hs) => {
            lr.forEach((r, ri) => {
              const n = hs + 1 + ri;
              ws.getCell(n, 2).value = {
                formula: `COUNTIFS(${rg('I')},A${n},${rg('B')},"26AS")`,
                result: r[1],
              };
              ws.getCell(n, 3).value = {
                formula: `SUMIFS(${rg('H')},${rg('I')},A${n},${rg('B')},"26AS")`,
                result: r[2],
              };
              ws.getCell(n, 4).value = {
                formula: `COUNTIFS(${rg('I')},A${n},${rg('B')},"Tally")`,
                result: r[3],
              };
              ws.getCell(n, 5).value = {
                formula: `SUMIFS(${rg('H')},${rg('I')},A${n},${rg('B')},"Tally")`,
                result: r[4],
              };
              ws.getCell(n, 6).value = { formula: `C${n}-E${n}`, result: r[5] };
              ws.getCell(n, 7).value = {
                formula: `IF(B${n}+D${n}=0,"",IF(ABS(F${n})<=${o.tol},"Reconciled","Difference"))`,
                result: r[6],
              };
            });
          },
        }
      );
    }
  }

  add('Period-wise', 'Period-wise reconciliation (each period reconciled on its own transactions)', SH.pw.h, SH.pw.d, {
    total: false,
    tab: 'FF0A8A4A',
  });
  add('Day buckets', `Day-bucket reconciliation (every ${o.bkt || 30} days)`, SH.bk.h, SH.bk.d, {
    total: true,
    tab: 'FF0A8A4A',
  });
  add(
    'Notes',
    'Notes & warnings',
    ['#', 'Note'],
    SH.warn.map((x, i) => [i + 1, x]),
    {
      tab: 'FF667085',
      after: (ws) => {
        ws.getColumn(2).width = 130;
        ws.eachRow((row, n) => {
          if (n > 4) row.getCell(2).alignment = { wrapText: true, vertical: 'top' };
        });
      },
    }
  );

  onProgress?.(85);

  G.filter((g) => g.status !== 'No activity' && !g.manual).forEach((g) => {
    const x = SH.gl[g.n];
    if (x) add(x.name, g.title, x.h, x.d, { hdr: x.hdr, total: true, tab: 'FF98A2B3' });
  });

  onProgress?.(95);
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

/* ---------- Workbook & Text Helpers ---------- */
export function parseXlsxBufferToSheets(ab: ArrayBuffer, fileName: string): RawSheetData[] {
  const wb = XLSX.read(ab, { type: 'array', cellDates: true });
  return wb.SheetNames.map((n) => ({
    name: n,
    fileName,
    rows: XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: null, raw: true }) as unknown[][],
  }));
}
