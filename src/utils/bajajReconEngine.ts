import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import * as XLSX from 'xlsx';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export type BajajZone = 'claim' | 'dms' | 'bank';
export type BajajFileType = 'claim' | 'chq' | 'inv' | 'cn' | 'tally' | 'bank' | '?';
export type BajajSegment = 'Insurance' | 'Warranty';
export type BajajTabKey =
  | 'sum'
  | 'aud'
  | 'master'
  | 'ins'
  | 'war'
  | 'rec'
  | 'gst'
  | 'utr'
  | 'exc';

export interface BajajOptions {
  asOnDate: string;
  tdsRate: number;
  tol: number;
  tdsTol: number;
  warrantyKeyword: string;
  productMap: string;
  defaultSegment: BajajSegment;
  buckets: string;
  dedupPayApp: boolean;
  includeChqOnly: boolean;
  bajajInvoicesOnly: boolean;
}

export const DEFAULT_BAJAJ_OPTIONS: BajajOptions = {
  asOnDate: new Date().toISOString().slice(0, 10),
  tdsRate: 2,
  tol: 2,
  tdsTol: 0.2,
  warrantyKeyword: '_EW_',
  productMap: '1801=Insurance,1817=Warranty,1825=Insurance,1854=Insurance,1870=Insurance',
  defaultSegment: 'Insurance',
  buckets: '30,60,90',
  dedupPayApp: true,
  includeChqOnly: true,
  bajajInvoicesOnly: true,
};

export interface ClaimRow {
  claim: string;
  pa: string;
  apd: Date | null;
  appr: number;
  utr: string;
  utrd: Date | null;
  net: number;
  rem: string;
  gst: number;
  tds: number;
  rel: number;
  bill: string;
  veh: string;
  res: string;
  bank: string;
  bd: Date | null;
}

export interface ChequeRow {
  claim: string;
  pa: string;
  utr: string;
  utrd: Date | null;
  amt: number;
  bill: string;
  appr: number;
  gst: number;
  tds: number;
}

export interface DmsInvoiceRow {
  no: string;
  date: Date | null;
  cust: string;
  to: string;
  plate: string;
  ex: number;
  incl: number;
  st: string;
  seg?: BajajSegment;
}

export interface DmsCreditNoteRow {
  no: string;
  date: Date | null;
  amt: number;
  inv: string;
  name: string;
}

export interface TallyVoucherRow {
  no: string;
  date: Date | null;
  party: string;
  vt: string;
  amt: number;
  txt: string;
  cn: boolean;
  rc: boolean;
}

export interface BankStatementRow {
  txt: string;
  amt: number;
}

export interface IngestedBajajFile {
  id: string;
  name: string;
  type: BajajFileType;
  zone: BajajZone;
  asked: BajajZone;
  rows: unknown[];
  why?: string;
}

export interface MasterPayAppRow extends ClaimRow {
  base: string;
  type: 'Claim Payment' | 'GST Release';
  prod: string;
  src: 'Claim report' | 'Cheque report only';
  dup: number;
  seg: BajajSegment;
  key: string;
  chq: number | null;
  math: number;
  mchk: 'OK' | 'DIFF';
  cm: 'Matched' | 'AMT DIFF' | 'Not in cheque rpt';
  tdsp: number | null;
}

export interface BillReconRow {
  key: string;
  seg: BajajSegment;
  claim: string;
  veh: string;
  bd?: Date | null;
  appr: number;
  gst: number;
  tds: number;
  net: number;
  rel: number;
  u1: string;
  d1: Date | null;
  u2: string;
  d2: Date | null;
  inv: number | null;
  idate: Date | null;
  ist: string;
  cn: string;
  cna: number;
  netinv: number | null;
  pend: number;
  cash: number;
  settled: number;
  var: number | null;
  tdsp: number | null;
  status: string;
  flags: string;
}

export interface GstTrackerRow {
  base: string;
  claim: string;
  bill: string;
  seg: BajajSegment;
  res: string;
  veh: string;
  held: number;
  rel: number;
  cd: Date | null;
  cu: string;
  rd: Date | null;
  ru: string;
  pend: number;
  status: string;
  days: number | null;
  age: string;
  ao: number;
}

export interface UtrBankRow {
  utr: string;
  date: Date | null;
  lines: number;
  appr: number;
  gst: number;
  tds: number;
  net: number;
  ins: number;
  war: number;
  chq: number;
  bank: number | null;
  tl: '' | 'Booked' | 'Not in Tally';
  cd: number | null;
  bd: number | null;
  status: string;
}

export interface TallyDmsRecoRow {
  doc: string;
  type: 'Invoice' | 'Credit note';
  seg: string;
  ddate: Date | null;
  dparty: string;
  damt: number | null;
  tdate: Date | null;
  tparty: string;
  tamt: number | null;
  diff: number | null;
  appr: number | null;
  settled: number | null;
  bal: number | null;
  status: string;
  note: string;
}

export type AuditSeverity = 'High' | 'Medium' | 'Info';

export interface ExceptionAuditRow {
  cat: string;
  sev: AuditSeverity;
  ref: string;
  detail: string;
  amt: number | null;
  status: string;
}

export interface SegmentSummaryMetrics {
  'Bills / keys': number;
  'Approved (incl GST)': number;
  'GST held': number;
  'TDS deducted': number;
  'Net credited': number;
  'GST released': number;
  'GST still pending': number;
  'Total cash received': number;
  'Settled incl TDS': number;
  'Invoice value': number;
  'Credit notes': number;
}

export interface BajajColDef {
  label: string;
  key: string;
  fmt?: 'd' | 'n' | 'n2' | 'p' | 'i';
}

export interface BajajReconResult {
  M: MasterPayAppRow[];
  bills: BillReconRow[];
  gst: GstTrackerRow[];
  utr: UtrBankRow[];
  ex: ExceptionAuditRow[];
  rec: TallyDmsRecoRow[];
  hasT: boolean;
  hasD: boolean;
  rng: {
    u: [Date, Date] | null;
    d: [Date, Date] | null;
    t: [Date, Date] | null;
  };
  opt: {
    tol: number;
    asOn: Date;
    bk: number[];
  };
  segSummary: {
    Insurance: SegmentSummaryMetrics;
    Warranty: SegmentSummaryMetrics;
    Total: SegmentSummaryMetrics;
  };
  auditGroups: Record<string, { sev: AuditSeverity; n: number; a: number }>;
  auditKeys: string[];
}

export const BAJAJ_FILE_LABELS: Record<BajajFileType, string> = {
  claim: 'Claim payments',
  chq: 'Cheque report',
  inv: 'DMS invoices',
  cn: 'DMS credit notes',
  tally: 'Tally register',
  bank: 'Bank statement',
  '?': 'Not recognised',
};

export const BAJAJ_AUDIT_CHECKS: Record<string, AuditSeverity> = {
  'Conflicting duplicate pay-app': 'High',
  'Payment without UTR': 'High',
  'Approved − GST − TDS ≠ net credited': 'High',
  'Cheque report amount differs': 'High',
  'GST released, original payment row missing': 'High',
  'GST over-released': 'High',
  'GST pending beyond oldest ageing bucket': 'High',
  'Approved exceeds net invoice': 'High',
  'UTR not tallied with bank': 'High',
  'Tally ≠ DMS amount': 'High',
  'In DMS, not in Tally': 'High',
  'Bajaj paid, not in Tally': 'High',
  'GST release dated before claim payment': 'Medium',
  'GST held is not 18/118 of approval': 'Medium',
  'TDS rate differs from standard': 'Medium',
  'No TDS deducted': 'Medium',
  'Paid before approval date': 'Medium',
  'DMS “Paid In Full” with no claim receipt or credit note': 'Medium',
  'Non-standard bill number': 'Medium',
  'No bill number on Bajaj report': 'Medium',
  'Invoice awaiting claim payment': 'Medium',
  'UTR not booked in Tally receipts': 'Medium',
  'In Tally, not in DMS': 'Medium',
  'In Tally & Bajaj claims, not in DMS': 'Medium',
  'Credit note on Bajaj invoice': 'Info',
  'Possible re-bill (same plate & amount)': 'Info',
  'Duplicate pay-apps merged': 'Info',
};

export const BAJAJ_TABS: Array<{ key: BajajTabKey; label: string }> = [
  { key: 'sum', label: 'Summary' },
  { key: 'aud', label: 'Audit' },
  { key: 'master', label: 'Bajaj Master' },
  { key: 'ins', label: 'Bajaj Insurance' },
  { key: 'war', label: 'Bajaj Warranty' },
  { key: 'rec', label: 'Tally / DMS Reco' },
  { key: 'gst', label: 'GST Tracker' },
  { key: 'utr', label: 'UTR / Bank' },
  { key: 'exc', label: 'Exceptions' },
];

export const BAJAJ_COLUMNS: Record<
  Exclude<BajajTabKey, 'sum' | 'aud'>,
  BajajColDef[]
> = {
  master: [
    { label: 'Claim Ref', key: 'claim' },
    { label: 'Pay App', key: 'pa' },
    { label: 'Type', key: 'type' },
    { label: 'UTR Date', key: 'utrd', fmt: 'd' },
    { label: 'Bill No', key: 'bill' },
    { label: 'Vehicle', key: 'veh' },
    { label: 'Reserve', key: 'res' },
    { label: 'Segment', key: 'seg' },
    { label: 'Approved', key: 'appr', fmt: 'n' },
    { label: 'GST Held', key: 'gst', fmt: 'n' },
    { label: 'TDS', key: 'tds', fmt: 'n' },
    { label: 'Net Credited', key: 'net', fmt: 'n' },
    { label: 'GST Released', key: 'rel', fmt: 'n' },
    { label: 'UTR (Txn ID)', key: 'utr' },
    { label: 'Remarks', key: 'rem' },
    { label: 'Math', key: 'mchk' },
    { label: 'Cheque check', key: 'cm' },
    { label: 'Source', key: 'src' },
  ],
  ins: [],
  war: [],
  gst: [
    { label: 'Claim Ref', key: 'claim' },
    { label: 'Bill No', key: 'bill' },
    { label: 'Segment', key: 'seg' },
    { label: 'Pay App', key: 'base' },
    { label: 'Reserve', key: 'res' },
    { label: 'Vehicle', key: 'veh' },
    { label: 'Paid On', key: 'cd', fmt: 'd' },
    { label: 'Claim UTR', key: 'cu' },
    { label: 'GST Held', key: 'held', fmt: 'n' },
    { label: 'Released On', key: 'rd', fmt: 'd' },
    { label: 'Release UTR', key: 'ru' },
    { label: 'GST Released', key: 'rel', fmt: 'n' },
    { label: 'GST Pending', key: 'pend', fmt: 'n' },
    { label: 'Status', key: 'status' },
    { label: 'Days', key: 'days', fmt: 'i' },
    { label: 'Ageing', key: 'age' },
  ],
  utr: [
    { label: 'UTR (Txn ID)', key: 'utr' },
    { label: 'Date', key: 'date', fmt: 'd' },
    { label: 'Lines', key: 'lines', fmt: 'i' },
    { label: 'Gross Approved', key: 'appr', fmt: 'n' },
    { label: 'GST Held', key: 'gst', fmt: 'n' },
    { label: 'TDS', key: 'tds', fmt: 'n' },
    { label: 'Net Credited', key: 'net', fmt: 'n' },
    { label: 'Insurance', key: 'ins', fmt: 'n' },
    { label: 'Warranty', key: 'war', fmt: 'n' },
    { label: 'Cheque Rpt', key: 'chq', fmt: 'n' },
    { label: 'Cheque Diff', key: 'cd', fmt: 'n' },
    { label: 'Bank Stmt', key: 'bank', fmt: 'n' },
    { label: 'Bank Diff', key: 'bd', fmt: 'n' },
    { label: 'In Tally', key: 'tl' },
    { label: 'Status', key: 'status' },
  ],
  exc: [
    { label: 'Severity', key: 'sev' },
    { label: 'Check', key: 'cat' },
    { label: 'Reference', key: 'ref' },
    { label: 'Detail', key: 'detail' },
    { label: 'Amount', key: 'amt', fmt: 'n2' },
  ],
  rec: [
    { label: 'Doc No', key: 'doc' },
    { label: 'Type', key: 'type' },
    { label: 'Segment', key: 'seg' },
    { label: 'DMS Date', key: 'ddate', fmt: 'd' },
    { label: 'DMS Bill-To', key: 'dparty' },
    { label: 'DMS Amount', key: 'damt', fmt: 'n2' },
    { label: 'Tally Date', key: 'tdate', fmt: 'd' },
    { label: 'Tally Party', key: 'tparty' },
    { label: 'Tally Amount', key: 'tamt', fmt: 'n2' },
    { label: 'Tally − DMS', key: 'diff', fmt: 'n2' },
    { label: 'Bajaj Approved', key: 'appr', fmt: 'n' },
    { label: 'Bajaj Settled (incl TDS)', key: 'settled', fmt: 'n' },
    { label: 'Balance after Bajaj', key: 'bal', fmt: 'n2' },
    { label: 'Status', key: 'status' },
    { label: 'Note', key: 'note' },
  ],
};

const BILL_COLUMNS: BajajColDef[] = [
  { label: 'Bill / Key', key: 'key' },
  { label: 'Inv Date', key: 'idate', fmt: 'd' },
  { label: 'Vehicle', key: 'veh' },
  { label: 'Claim Ref', key: 'claim' },
  { label: 'Inv Status', key: 'ist' },
  { label: 'Invoice (incl tax)', key: 'inv', fmt: 'n2' },
  { label: 'Credit Note', key: 'cn' },
  { label: 'CN Amt', key: 'cna', fmt: 'n2' },
  { label: 'Net Invoice', key: 'netinv', fmt: 'n2' },
  { label: 'Approved', key: 'appr', fmt: 'n' },
  { label: 'GST Held', key: 'gst', fmt: 'n' },
  { label: 'TDS', key: 'tds', fmt: 'n' },
  { label: 'Net Credited', key: 'net', fmt: 'n' },
  { label: 'GST Released', key: 'rel', fmt: 'n' },
  { label: 'GST Pending', key: 'pend', fmt: 'n' },
  { label: 'Cash Received', key: 'cash', fmt: 'n' },
  { label: 'Settled incl TDS', key: 'settled', fmt: 'n' },
  { label: 'Inv − Approved', key: 'var', fmt: 'n' },
  { label: 'Status', key: 'status' },
  { label: 'First UTR', key: 'u1' },
  { label: 'UTR Date', key: 'd1', fmt: 'd' },
  { label: 'GST UTR', key: 'u2' },
  { label: 'GST Date', key: 'd2', fmt: 'd' },
  { label: 'TDS %', key: 'tdsp', fmt: 'p' },
  { label: 'Flags', key: 'flags' },
];

BAJAJ_COLUMNS.ins = BILL_COLUMNS;
BAJAJ_COLUMNS.war = BILL_COLUMNS;

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function parseNum(x: unknown): number {
  if (typeof x === 'number') return Number.isFinite(x) ? x : 0;
  const v = parseFloat(String(x ?? '').replace(/[,₹\s]/g, ''));
  return Number.isFinite(v) ? v : 0;
}

export function parseDate(x: unknown): Date | null {
  if (x instanceof Date) return Number.isNaN(x.getTime()) ? null : x;
  if (x === '' || x == null) return null;
  if (typeof x === 'number' && x > 30000 && x < 60000) {
    return new Date(Date.UTC(1899, 11, 30) + Math.floor(x) * 864e5);
  }
  const s = String(x).replace(/'/g, '').trim();
  let m = s.match(/^(\d{1,2})[-/ ]([A-Za-z]{3})[a-z]*[-/ ](\d{2,4})/);
  if (m) {
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    const mi = MON.findIndex((a) => a.toLowerCase() === m![2].toLowerCase());
    if (mi >= 0) return new Date(Date.UTC(y, mi, Number(m[1])));
  }
  if (/^\d{5}(\.\d+)?$/.test(s)) return parseDate(Number(s));
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) return new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fmtDateShort(d: Date | null | undefined): string {
  if (!d) return '';
  return (
    String(d.getUTCDate()).padStart(2, '0') +
    '-' +
    MON[d.getUTCMonth()] +
    '-' +
    String(d.getUTCFullYear()).slice(2)
  );
}

export function fmtInr(v: unknown, dp = 0): string {
  if (v === '' || v == null) return '';
  const num = Number(v);
  if (!Number.isFinite(num)) return '';
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp || 2,
  });
}

export function fmtCellValue(v: unknown, fmt?: BajajColDef['fmt']): string {
  if (fmt === 'd') return fmtDateShort(v as Date | null | undefined);
  if (fmt === 'n') return fmtInr(v, 0);
  if (fmt === 'n2') return fmtInr(v, 2);
  if (fmt === 'p') return v == null ? '' : `${(Number(v) * 100).toFixed(2)}%`;
  if (fmt === 'i') return v == null ? '' : String(v);
  return v == null ? '' : String(v);
}

export type BajajTone = 'ok' | 'wn' | 'am' | '';

export function getBajajStatusTone(s: unknown): BajajTone {
  const str = String(s ?? '');
  if (
    /DIFF|NOT TALLIED|Not in Tally|missing|ending|awaited|Over-|differs|not in (Tally|DMS)|^High$/.test(
      str
    )
  ) {
    return 'wn';
  }
  if (/Partial|Credit|Awaiting|awaiting|Outside|uploaded|^Medium$/.test(str)) {
    return 'am';
  }
  if (/Matched|Tallied|Released|reconciled|OK|agrees|Booked/.test(str)) {
    return 'ok';
  }
  return '';
}

function buildHeaderMap(row: unknown[]): Record<string, number> {
  const m: Record<string, number> = {};
  row.forEach((c, i) => {
    const k = String(c ?? '').trim().toLowerCase();
    if (k && !(k in m)) m[k] = i;
  });
  return m;
}

function pickCol(m: Record<string, number>, ...names: string[]): number {
  for (const n of names) {
    if (n in m) return m[n];
  }
  return -1;
}

async function readPdfRows(file: File): Promise<unknown[][][]> {
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const rows: unknown[][] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    const lines: Record<number, Array<[number, string]>> = {};
    tc.items.forEach((item) => {
      if (!('str' in item) || !('transform' in item)) return;
      const y = Math.round(item.transform[5] / 3);
      (lines[y] = lines[y] || []).push([item.transform[4], item.str]);
    });
    Object.keys(lines)
      .map(Number)
      .sort((a, b) => b - a)
      .forEach((y) => {
        const sorted = lines[y].sort((a, b) => a[0] - b[0]);
        const row: string[] = [];
        let last = -99;
        let cur = '';
        sorted.forEach(([x, str]) => {
          if (x - last > 14 && cur) {
            row.push(cur.trim());
            cur = '';
          }
          cur += (cur ? ' ' : '') + str;
          last = x + str.length * 4.5;
        });
        row.push(cur.trim());
        const cleaned = row.filter((c) => c !== '');
        if (cleaned.length > 0) rows.push(cleaned);
      });
  }
  return [rows];
}

function classifySheet(rows: unknown[][]): [Exclude<BajajFileType, '?'> | null, number] {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const s = rows[i].map((c) => String(c ?? '').toLowerCase().trim());
    const joined = '|' + s.join('|') + '|';
    const has = (k: string) => s.includes(k);

    if (has('pay app no') && has('chq utr no')) return ['claim', i];
    if ((has('approval no.') || has('approval no')) && has('utr no')) return ['chq', i];
    if (has('invoice no.') && has('bill to customer')) return ['inv', i];
    if (has('document number') && has('created from')) return ['cn', i];
    if (
      s.some((c) =>
        /^(vch|voucher)\.?\s*(no|number)|^invoice\s*(no|number)|^bill\s*no|^doc(ument)?\s*(no|number)/.test(
          c
        )
      ) &&
      s.some((c) => /debit|credit|gross|amount|value|total/.test(c)) &&
      s.some((c) => /date/.test(c))
    ) {
      return ['tally', i];
    }
    if (
      /utr|ref/.test(joined) &&
      /credit|deposit|amount/.test(joined) &&
      s.length >= 3 &&
      s.some((c) => /date/.test(c))
    ) {
      return ['bank', i];
    }
  }
  return [null, 0];
}

function parseSheetRows(
  type: Exclude<BajajFileType, '?'>,
  rows: unknown[][],
  headerIndex: number
): unknown[] {
  const m = buildHeaderMap(rows[headerIndex].slice(0, type === 'claim' ? 39 : 99));
  const out: unknown[] = [];
  const g = (r: unknown[], ...names: string[]) => {
    const idx = pickCol(m, ...names);
    return idx < 0 ? '' : r[idx];
  };

  for (let r of rows.slice(headerIndex + 1)) {
    if (r.every((c) => c === '' || c == null)) continue;

    if (type === 'claim') {
      if (String(r[5] ?? '').startsWith('OC-')) r = r.slice(5);
      const first = String(r[0] ?? '');
      if (first === 'BAGIC Claim Ref' || !first.startsWith('OC-')) continue;
      if (String(g(r, 'pay status')).toUpperCase() !== 'PAID') continue;
      const bill = String(g(r, 'bill no')).trim();
      const veh = String(g(r, 'ref text')).trim();
      out.push({
        claim: first.trim(),
        pa: String(g(r, 'pay app no')).trim(),
        apd: parseDate(g(r, 'approval date')),
        appr: parseNum(g(r, 'approval amount')),
        utr: String(g(r, 'chq utr no')).replace(/'/g, '').trim(),
        utrd: parseDate(g(r, 'chq utr date')),
        net: parseNum(g(r, 'payment amt')),
        rem: String(g(r, 'remarks') ?? ''),
        gst: parseNum(g(r, 'service tax gst')),
        tds: parseNum(g(r, 'tds amount gst')),
        rel: parseNum(g(r, 'gst paid amt')),
        bill: bill && bill !== '-' ? bill : '',
        veh: veh && veh !== '-' ? veh : '',
        res: String(g(r, 'r reserve desc') ?? ''),
        bank: String(g(r, 'payment bank') ?? ''),
        bd: parseDate(g(r, 'bill date')),
      } satisfies ClaimRow);
    } else if (type === 'chq') {
      const pa = String(g(r, 'approval no.', 'approval no'))
        .replace(/\.0$/, '')
        .trim();
      if (!pa) continue;
      out.push({
        claim: String(g(r, 'claim no', 'bagic claim ref')).trim(),
        pa,
        utr: String(g(r, 'utr no')).replace(/'/g, '').trim(),
        utrd: parseDate(g(r, 'cheque date')),
        amt: parseNum(g(r, 'cheque amount')),
        bill: String(g(r, 'bill_no')).trim(),
        appr: parseNum(g(r, 'approved amount')),
        gst: parseNum(g(r, 'service tax')),
        tds: parseNum(g(r, 'tds')),
      } satisfies ChequeRow);
    } else if (type === 'inv') {
      const no = String(g(r, 'invoice no.')).trim();
      if (!no) continue;
      out.push({
        no,
        date: parseDate(g(r, 'invoice date')),
        cust: String(g(r, 'customer name') ?? ''),
        to: String(g(r, 'bill to customer') ?? ''),
        plate: String(g(r, 'plate no.') ?? ''),
        ex: parseNum(g(r, 'sum of amount')),
        incl: parseNum(g(r, 'average of amount with tax', 'amount with tax', 'total')),
        st: String(g(r, 'status') ?? ''),
      } satisfies DmsInvoiceRow);
    } else if (type === 'cn') {
      const no = String(g(r, 'document number')).trim();
      if (!no) continue;
      out.push({
        no,
        date: parseDate(g(r, 'date')),
        amt: Math.abs(parseNum(g(r, 'amount'))),
        inv: String(g(r, 'created from') ?? '')
          .replace(/invoice\s*#/i, '')
          .trim(),
        name: String(g(r, 'name') ?? ''),
      } satisfies DmsCreditNoteRow);
    } else if (type === 'tally') {
      const fx = (re: RegExp) => {
        const k = Object.keys(m).find((key) => re.test(key));
        return k == null ? -1 : m[k];
      };
      const ix = {
        d: fx(/date/),
        n: fx(/^(vch|voucher)\.?\s*(no|number)|^invoice\s*(no|number)|^bill\s*no|^doc/),
        p: fx(/particular|party|ledger|customer|name|account/),
        t: fx(/voucher type|vch type|^type/),
        db: fx(/debit/),
        cr: fx(/credit/),
        a: fx(/gross|amount|value|total/),
      };
      const v = (k: keyof typeof ix) => (ix[k] < 0 ? '' : r[ix[k]]);
      const no = String(v('n')).trim();
      const pt = String(v('p') ?? '');
      if (!no || /total/i.test(pt)) continue;
      const vt = String(v('t') ?? '');
      const a = Math.max(
        Math.abs(parseNum(v('db'))),
        Math.abs(parseNum(v('cr'))),
        Math.abs(parseNum(v('a')))
      );
      out.push({
        no,
        date: parseDate(v('d')),
        party: pt,
        vt,
        amt: a,
        txt: r.join(' ').toUpperCase(),
        cn: /credit/i.test(vt) || /VMSC/i.test(no),
        rc: /receipt/i.test(vt),
      } satisfies TallyVoucherRow);
    } else if (type === 'bank') {
      let ai = -1;
      Object.keys(m).forEach((k) => {
        if (/credit|deposit/.test(k)) ai = m[k];
      });
      if (ai < 0) ai = pickCol(m, 'amount');
      const txt = r.join(' ').toUpperCase();
      const a = ai >= 0 ? parseNum(r[ai]) : 0;
      if (a && txt.length > 8) {
        out.push({ txt, amt: a } satisfies BankStatementRow);
      }
    }
  }
  return out;
}

const ZONE_BY_TYPE: Record<Exclude<BajajFileType, '?'>, BajajZone> = {
  claim: 'claim',
  chq: 'claim',
  inv: 'dms',
  cn: 'dms',
  tally: 'dms',
  bank: 'bank',
};

let fileCounter = 0;

export async function ingestBajajFiles(
  fileList: File[],
  askedZone: BajajZone
): Promise<IngestedBajajFile[]> {
  const results: IngestedBajajFile[] = [];

  for (const f of fileList) {
    const ext = f.name.split('.').pop()?.toLowerCase() || '';
    let hit = 0;
    try {
      let tabs: unknown[][][];
      if (ext === 'pdf') {
        tabs = await readPdfRows(f);
      } else {
        const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
        tabs = wb.SheetNames.map((n) =>
          XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[n], {
            header: 1,
            raw: true,
            defval: '',
          })
        );
      }

      for (const rows of tabs) {
        const [t, hi] = classifySheet(rows);
        if (!t) continue;
        results.push({
          id: `bj-${Date.now()}-${++fileCounter}`,
          name: f.name,
          type: t,
          rows: parseSheetRows(t, rows, hi),
          zone: ZONE_BY_TYPE[t],
          asked: askedZone,
        });
        hit++;
      }

      if (!hit) {
        results.push({
          id: `bj-${Date.now()}-${++fileCounter}`,
          name: f.name,
          type: '?',
          rows: [],
          zone: askedZone,
          asked: askedZone,
          why:
            ext === 'pdf'
              ? 'PDF text not recognised as a table'
              : 'headers not recognised',
        });
      }
    } catch {
      results.push({
        id: `bj-${Date.now()}-${++fileCounter}`,
        name: f.name,
        type: '?',
        rows: [],
        zone: askedZone,
        asked: askedZone,
        why: 'could not read',
      });
    }
  }

  return results;
}

export function runBajajReconciliation(
  files: IngestedBajajFile[],
  options: BajajOptions
): BajajReconResult | null {
  const allOf = <T,>(t: BajajFileType): T[] =>
    files.filter((f) => f.type === t).flatMap((f) => f.rows as T[]);

  const claims = allOf<ClaimRow>('claim');
  const chqs = allOf<ChequeRow>('chq');
  const invs = allOf<DmsInvoiceRow>('inv');
  const cns = allOf<DmsCreditNoteRow>('cn');
  const TL = allOf<TallyVoucherRow>('tally');
  const BK = allOf<BankStatementRow>('bank');

  if (!claims.length && !invs.length && !TL.length) {
    return null;
  }

  const tol = Number.isFinite(options.tol) ? options.tol : 2;
  const tdsr = (Number.isFinite(options.tdsRate) ? options.tdsRate : 2) / 100;
  const tdst = (Number.isFinite(options.tdsTol) ? options.tdsTol : 0.2) / 100;
  const kw = (options.warrantyKeyword || '_EW_').toUpperCase();
  const asOn = parseDate(options.asOnDate) || new Date();
  const bk = options.buckets
    .split(',')
    .map((x) => parseNum(x))
    .filter((x) => x > 0)
    .sort((a, b) => a - b);
  const safeBk = bk.length ? bk : [30, 60, 90];

  const pm: Record<string, BajajSegment> = {};
  options.productMap.split(',').forEach((p) => {
    const [a, b] = p.split('=');
    if (a && b) {
      pm[a.trim()] = /warr/i.test(b) ? 'Warranty' : 'Insurance';
    }
  });

  const base = (p: string) => p.replace(/G$/, '');
  const seen: Record<string, MasterPayAppRow> = {};
  const M: MasterPayAppRow[] = [];
  const conf: ClaimRow[] = [];

  claims.forEach((c) => {
    if (options.dedupPayApp && seen[c.pa]) {
      const q = seen[c.pa];
      if (q.net !== c.net || q.utr !== c.utr) conf.push(c);
      q.dup++;
      return;
    }
    const r: MasterPayAppRow = {
      ...c,
      base: base(c.pa),
      type: c.pa.endsWith('G') ? 'GST Release' : 'Claim Payment',
      prod: c.claim.split('-')[3] || '',
      src: 'Claim report',
      dup: 1,
      seg: options.defaultSegment,
      key: '',
      chq: null,
      math: 0,
      mchk: 'OK',
      cm: 'Not in cheque rpt',
      tdsp: null,
    };
    seen[c.pa] = r;
    M.push(r);
  });

  const cq: Record<string, ChequeRow & { k: string }> = {};
  [...chqs]
    .sort((a, b) => Number(Boolean(b.bill)) - Number(Boolean(a.bill)))
    .forEach((c) => {
      const k = `${base(c.pa)}|${c.utr}`;
      if (!cq[k]) cq[k] = { ...c, k };
    });

  const have = new Set(M.map((r) => `${r.base}|${r.utr}`));
  if (options.includeChqOnly) {
    Object.values(cq).forEach((c) => {
      if (!have.has(c.k)) {
        const rel = c.pa.endsWith('G');
        M.push({
          claim: c.claim,
          pa: c.pa,
          base: base(c.pa),
          type: rel ? 'GST Release' : 'Claim Payment',
          apd: null,
          bill: c.bill,
          veh: '',
          res: '',
          prod: c.claim.split('-')[3] || '',
          appr: c.appr,
          gst: c.gst,
          tds: c.tds,
          net: c.amt,
          rel: rel ? c.amt : 0,
          bank: '',
          utr: c.utr,
          utrd: c.utrd,
          bd: null,
          rem: rel ? 'GST PAID' : 'GST HOLD',
          src: 'Cheque report only',
          dup: 1,
          seg: options.defaultSegment,
          key: '',
          chq: null,
          math: 0,
          mchk: 'OK',
          cm: 'Not in cheque rpt',
          tdsp: null,
        });
      }
    });
  }

  const IV: Record<string, DmsInvoiceRow & { seg: BajajSegment }> = {};
  invs
    .filter((i) => !options.bajajInvoicesOnly || /bajaj/i.test(i.to))
    .forEach((i) => {
      const segVal: BajajSegment = i.to.toUpperCase().includes(kw) ? 'Warranty' : 'Insurance';
      IV[i.no] = { ...i, seg: segVal };
    });

  const CN: Record<string, DmsCreditNoteRow> = {};
  cns.forEach((c) => {
    if (IV[c.inv]) {
      const existing = CN[c.inv];
      if (existing) {
        existing.amt += c.amt;
        existing.no += `, ${c.no}`;
      } else {
        CN[c.inv] = { ...c };
      }
    }
  });

  const hasR = TL.some((t) => t.rc);
  const segOf = (bill: string, prod: string): BajajSegment =>
    IV[bill] ? IV[bill].seg : pm[prod] || options.defaultSegment;

  M.forEach((r) => {
    r.seg = segOf(r.bill, r.prod);
    r.key = r.bill || `NOBILL|${r.claim}`;
    const c = cq[`${r.base}|${r.utr}`];
    r.chq = c ? c.amt : null;
    r.math = r.type === 'Claim Payment' ? r.appr - r.gst - r.tds - r.net : r.rel - r.net;
    r.mchk = Math.abs(r.math) > tol ? 'DIFF' : 'OK';
    r.cm =
      c == null
        ? 'Not in cheque rpt'
        : Math.abs(c.amt - r.net) <= tol
        ? 'Matched'
        : 'AMT DIFF';
    r.tdsp = r.type === 'Claim Payment' && r.appr - r.gst > 0 ? r.tds / (r.appr - r.gst) : null;
  });

  M.sort(
    (a, b) =>
      ((a.utrd?.getTime() ?? 0) - (b.utrd?.getTime() ?? 0)) || a.claim.localeCompare(b.claim)
  );

  // Bills
  type PartialBill = {
    key: string;
    seg: BajajSegment;
    claim: string;
    veh: string;
    bd?: Date | null;
    appr: number;
    gst: number;
    tds: number;
    net: number;
    rel: number;
    u1: string;
    d1: Date | null;
    u2: string;
    d2: Date | null;
  };
  const B: Record<string, PartialBill> = {};
  M.forEach((r) => {
    const b =
      B[r.key] ||
      (B[r.key] = {
        key: r.key,
        seg: r.seg,
        claim: r.claim,
        veh: r.veh,
        bd: r.bd,
        appr: 0,
        gst: 0,
        tds: 0,
        net: 0,
        rel: 0,
        u1: '',
        d1: null,
        u2: '',
        d2: null,
      });
    if (r.type === 'Claim Payment') {
      b.appr += r.appr;
      b.gst += r.gst;
      b.tds += r.tds;
      b.net += r.net;
      if (!b.u1) {
        b.u1 = r.utr;
        b.d1 = r.utrd;
      }
    } else {
      b.rel += r.net;
      if (!b.u2) {
        b.u2 = r.utr;
        b.d2 = r.utrd;
      }
    }
  });

  Object.keys(IV).forEach((k) => {
    if (!B[k]) {
      B[k] = {
        key: k,
        seg: IV[k].seg,
        claim: '',
        veh: '',
        appr: 0,
        gst: 0,
        tds: 0,
        net: 0,
        rel: 0,
        u1: '',
        d1: null,
        u2: '',
        d2: null,
      };
    }
  });

  const bills: BillReconRow[] = Object.values(B)
    .map((b) => {
      const i = IV[b.key];
      const c = CN[b.key];
      const inv = i ? i.incl : null;
      const idate = i ? i.date : null;
      const veh = i ? i.plate : b.veh;
      const ist = i ? i.st : 'Not in register';
      const cn = c ? c.no : '';
      const cna = c ? c.amt : 0;
      const netinv = inv != null ? inv - cna : null;
      const pend = b.gst - b.rel;
      const cash = b.net + b.rel;
      const settled = cash + b.tds;
      const variance = netinv == null ? null : netinv - b.appr;
      const tdsp = b.appr - b.gst > 0 ? b.tds / (b.appr - b.gst) : null;
      const status =
        b.appr + b.rel === 0
          ? i
            ? netinv != null && netinv <= tol
              ? 'Credit-noted: nothing receivable'
              : 'Invoice raised – claim payment awaited'
            : 'No data'
          : pend < -tol
          ? 'GST released – claim row missing'
          : pend > tol
          ? 'GST pending with Bajaj'
          : !i
          ? 'Settled – invoice not in register'
          : variance != null && Math.abs(variance) <= tol
          ? 'Fully reconciled'
          : 'Settled – variance vs invoice';
      const flags = [
        tdsp != null && tdsp > 0 && Math.abs(tdsp - tdsr) > tdst ? 'TDS rate off' : '',
        cn ? 'Credit note raised' : '',
      ]
        .filter(Boolean)
        .join('; ');

      return {
        ...b,
        inv,
        idate,
        veh,
        ist,
        cn,
        cna,
        netinv,
        pend,
        cash,
        settled,
        var: variance,
        tdsp,
        status,
        flags,
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));

  // GST Tracker
  const G: Record<string, GstTrackerRow> = {};
  M.forEach((r) => {
    const g =
      G[r.base] ||
      (G[r.base] = {
        base: r.base,
        claim: r.claim,
        bill: r.bill,
        seg: r.seg,
        res: r.res,
        veh: r.veh,
        held: 0,
        rel: 0,
        cd: null,
        cu: '',
        rd: null,
        ru: '',
        pend: 0,
        status: '',
        days: null,
        age: '',
        ao: 0,
      });
    if (r.type === 'Claim Payment') {
      g.held += r.gst;
      if (!g.cu) {
        g.cd = r.utrd;
        g.cu = r.utr;
      }
    } else {
      g.rel += r.net;
      if (!g.ru) {
        g.rd = r.utrd;
        g.ru = r.utr;
      }
    }
  });

  const gst: GstTrackerRow[] = Object.values(G)
    .filter((g) => g.held > 0 || g.rel > 0)
    .map((g) => {
      g.pend = g.held - g.rel;
      g.status =
        g.held === 0 && g.rel > 0
          ? 'Release – hold row missing'
          : g.pend < -tol
          ? 'Over-released'
          : g.pend <= tol
          ? 'Released'
          : g.rel > 0
          ? 'Partially released'
          : 'Pending';
      g.days = g.cd ? Math.round(((g.rd || asOn).getTime() - g.cd.getTime()) / 864e5) : null;
      g.age = '';
      g.ao = 0;
      if (g.pend > tol && g.days != null) {
        const idx = safeBk.findIndex((x) => g.days! <= x);
        g.ao = idx < 0 ? safeBk.length : idx;
        g.age =
          idx < 0
            ? `${safeBk[safeBk.length - 1]}+ days`
            : `${idx ? safeBk[idx - 1] + 1 : 0}–${safeBk[idx]} days`;
      }
      return g;
    })
    .sort(
      (a, b) =>
        Number(b.pend > tol) - Number(a.pend > tol) ||
        (a.cd?.getTime() ?? 0) - (b.cd?.getTime() ?? 0)
    );

  // UTR / Bank
  const U: Record<string, UtrBankRow> = {};
  M.forEach((r) => {
    const u =
      U[r.utr] ||
      (U[r.utr] = {
        utr: r.utr,
        date: r.utrd,
        lines: 0,
        appr: 0,
        gst: 0,
        tds: 0,
        net: 0,
        ins: 0,
        war: 0,
        chq: 0,
        bank: null,
        tl: '',
        cd: null,
        bd: null,
        status: '',
      });
    u.lines++;
    u.appr += r.appr;
    u.gst += r.gst;
    u.tds += r.tds;
    u.net += r.net;
    if (r.seg === 'Warranty') u.war += r.net;
    else u.ins += r.net;
  });

  Object.values(cq).forEach((c) => {
    if (U[c.utr]) U[c.utr].chq += c.amt;
  });

  const utr: UtrBankRow[] = Object.values(U)
    .map((u) => {
      const UU = u.utr.toUpperCase();
      const bm = BK.filter((b) => b.txt.includes(UU));
      u.bank = bm.length ? bm.reduce((t, b) => t + b.amt, 0) : null;
      u.tl = hasR ? (TL.some((t) => t.rc && t.txt.includes(UU)) ? 'Booked' : 'Not in Tally') : '';
      u.cd = u.chq ? u.net - u.chq : null;
      u.bd = u.bank != null ? u.net - u.bank : null;
      u.status =
        u.bank != null
          ? Math.abs(u.bd!) <= tol
            ? 'Tallied with bank'
            : 'NOT TALLIED'
          : !u.chq
          ? 'Awaiting bank statement'
          : Math.abs(u.cd!) <= tol
          ? 'Cheque rpt agrees – awaiting bank'
          : 'Cheque rpt DIFF';
      return u;
    })
    .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));

  // Tally / DMS Reco
  const dmsI = Object.values(IV);
  const dmsC = cns.filter((c) => Boolean(IV[c.inv]));
  const hasD = invs.length > 0;
  const hasT = TL.length > 0;
  const nk = (x: string) => String(x).toUpperCase().replace(/[^A-Z0-9]/g, '');

  const dateRangeOf = (arr: Array<{ date: Date | null }>): [Date, Date] | null => {
    const dates = arr
      .map((x) => x.date)
      .filter((d): d is Date => Boolean(d))
      .sort((p, q) => p.getTime() - q.getTime());
    return dates.length ? [dates[0], dates[dates.length - 1]] : null;
  };

  const dr = dateRangeOf(invs);
  const tr = dateRangeOf(TL);
  const inR = (d: Date | null | undefined, r: [Date, Date] | null) =>
    !r || !d || (d.getTime() >= r[0].getTime() && d.getTime() <= r[1].getTime());

  const dn = new Set([...dmsI, ...dmsC].map((x) => nk(x.no)));
  const T: Record<string, TallyVoucherRow> = {};
  TL.filter((t) => !t.rc && (/bajaj/i.test(t.party) || dn.has(nk(t.no)))).forEach((t) => {
    T[nk(t.no)] = t;
  });

  const used = new Set<string>();
  const fT = (k: string): TallyVoucherRow | null => {
    const f = T[k]
      ? k
      : Object.keys(T).find(
          (x) => x.length >= 8 && k.length >= 8 && (x.includes(k) || k.includes(x))
        );
    if (f) used.add(f);
    return f ? T[f] : null;
  };

  const rec: TallyDmsRecoRow[] = [];
  const BI = Object.fromEntries(bills.map((b) => [b.key, b]));
  const dd1 = (a: Date | null, b: Date | null) =>
    a && b ? Math.round((a.getTime() - b.getTime()) / 864e5) : 0;

  const addRec = (o: {
    no: string;
    type: 'Invoice' | 'Credit note';
    date: Date | null;
    party: string;
    amt: number | null;
    seg?: string;
    t: TallyVoucherRow | null;
    b?: BillReconRow;
  }) => {
    const t = o.t;
    const b = o.b;
    const d = o.date || (t ? t.date : null);
    const diff = t && o.amt != null ? t.amt - o.amt : null;
    const baseAmt = b && b.netinv != null ? b.netinv : t ? t.amt : null;
    const settledVal = b ? b.settled : null;
    const bal =
      o.type === 'Invoice' && b && baseAmt != null ? baseAmt - b.settled : null;
    const status =
      o.amt != null
        ? t
          ? Math.abs(diff!) <= tol
            ? 'Matched'
            : 'Amount differs'
          : !hasT
          ? 'Tally not uploaded'
          : inR(d, tr)
          ? 'In DMS, not in Tally'
          : 'Outside Tally period'
        : !t
        ? d && inR(d, tr)
          ? 'Bajaj paid, not in Tally'
          : 'Outside Tally period'
        : !hasD
        ? 'DMS not uploaded'
        : inR(d, dr)
        ? b && b.appr
          ? 'In Tally & Bajaj claims, not in DMS'
          : 'In Tally, not in DMS'
        : 'Outside DMS period';

    const note = [
      t && dd1(t.date, o.date) ? `Date differs ${dd1(t.date, o.date)}d` : '',
      t && !/bajaj/i.test(t.party) ? `Tally party: ${t.party}` : '',
      b && b.cn ? `Credit note ${b.cn}` : '',
    ]
      .filter(Boolean)
      .join('; ');

    rec.push({
      doc: o.no,
      type: o.type,
      seg: o.seg || (b ? b.seg : '') || '',
      ddate: o.date,
      dparty: o.party,
      damt: o.amt,
      tdate: t ? t.date : null,
      tparty: t ? t.party : '',
      tamt: t ? t.amt : null,
      diff,
      appr: b ? b.appr : null,
      settled: settledVal,
      bal,
      status,
      note,
    });
  };

  dmsI.forEach((i) =>
    addRec({
      no: i.no,
      type: 'Invoice',
      date: i.date,
      party: i.to,
      amt: i.incl,
      seg: i.seg,
      t: fT(nk(i.no)),
      b: BI[i.no],
    })
  );

  dmsC.forEach((c) =>
    addRec({
      no: c.no,
      type: 'Credit note',
      date: c.date,
      party: c.name,
      amt: c.amt,
      seg: IV[c.inv].seg,
      t: fT(nk(c.no)),
    })
  );

  if (hasT) {
    bills.forEach((b) => {
      if (!IV[b.key] && /^VMSI/.test(b.key) && b.appr) {
        addRec({
          no: b.key,
          type: 'Invoice',
          date: b.bd ?? null,
          party: '',
          amt: null,
          seg: b.seg,
          t: fT(nk(b.key)),
          b,
        });
      }
    });
  }

  Object.keys(T).forEach((k) => {
    if (!used.has(k)) {
      const t = T[k];
      addRec({
        no: t.no,
        type: t.cn ? 'Credit note' : 'Invoice',
        date: null,
        party: '',
        amt: null,
        t,
        b: BI[t.no],
      });
    }
  });

  const SO = (x: string) =>
    /^(Amount|In DMS|Bajaj paid)/.test(x)
      ? 0
      : /^In Tally/.test(x)
      ? 1
      : /^Matched/.test(x)
      ? 3
      : 2;

  rec.sort((a, b) => SO(a.status) - SO(b.status) || String(a.doc).localeCompare(b.doc));

  // Audit / Exceptions
  const ex: ExceptionAuditRow[] = [];
  const pushEx = (cat: string, ref: string, detail: string, amt: number | null) =>
    ex.push({
      cat,
      sev: BAJAJ_AUDIT_CHECKS[cat] || 'Info',
      ref,
      detail,
      amt,
      status: cat,
    });

  conf.forEach((c) =>
    pushEx(
      'Conflicting duplicate pay-app',
      c.pa,
      `Same Pay App No, different amount / UTR – ${c.utr}`,
      c.net
    )
  );
  M.filter((r) => !r.utr).forEach((r) => pushEx('Payment without UTR', r.pa, r.claim, r.net));
  M.filter((r) => r.mchk === 'DIFF').forEach((r) =>
    pushEx('Approved − GST − TDS ≠ net credited', r.pa, r.claim, r.math)
  );
  M.filter((r) => r.cm === 'AMT DIFF').forEach((r) =>
    pushEx(
      'Cheque report amount differs',
      r.pa,
      `UTR ${r.utr} cheque ${fmtInr(r.chq)} vs paid ${fmtInr(r.net)}`,
      (r.chq ?? 0) - r.net
    )
  );
  gst
    .filter((g) => g.status.startsWith('Release –'))
    .forEach((g) =>
      pushEx(
        'GST released, original payment row missing',
        g.bill || g.base,
        `Pay app ${g.base}G on ${fmtDateShort(g.rd)} UTR ${g.ru}`,
        g.rel
      )
    );
  gst
    .filter((g) => g.status === 'Over-released')
    .forEach((g) => pushEx('GST over-released', g.base, g.claim, -g.pend));
  gst
    .filter((g) => g.pend > tol && (g.days ?? 0) > safeBk[safeBk.length - 1])
    .forEach((g) =>
      pushEx(
        'GST pending beyond oldest ageing bucket',
        g.base,
        `${g.claim} · ${g.days} days`,
        g.pend
      )
    );
  gst
    .filter((g) => g.rd && g.cd && g.rd.getTime() < g.cd.getTime())
    .forEach((g) => pushEx('GST release dated before claim payment', g.base, g.claim, g.rel));
  M.filter(
    (r) => r.type === 'Claim Payment' && r.gst > 0 && Math.abs(r.gst - Math.round((r.appr * 18) / 118)) > tol
  ).forEach((r) =>
    pushEx(
      'GST held is not 18/118 of approval',
      r.pa,
      `${r.claim} · held ${fmtInr(r.gst)} on ${fmtInr(r.appr)}`,
      r.gst
    )
  );
  M.filter((r) => r.tdsp != null && r.tdsp > 0 && Math.abs(r.tdsp - tdsr) > tdst).forEach((r) =>
    pushEx('TDS rate differs from standard', r.pa, `${(r.tdsp! * 100).toFixed(2)}%`, r.tds)
  );
  M.filter((r) => r.type === 'Claim Payment' && r.tds === 0 && r.appr > 0).forEach((r) =>
    pushEx('No TDS deducted', r.pa, `${r.claim} · ${r.rem}`, r.appr - r.gst)
  );
  M.filter((r) => r.apd && r.utrd && r.utrd.getTime() < r.apd.getTime()).forEach((r) =>
    pushEx('Paid before approval date', r.pa, r.claim, r.net)
  );
  bills
    .filter((b) => b.var != null && b.var < -tol && b.appr)
    .forEach((b) => pushEx('Approved exceeds net invoice', b.key, b.seg, -b.var!));
  bills
    .filter((b) => b.ist === 'Paid In Full' && !b.cash && !b.cn)
    .forEach((b) =>
      pushEx('DMS “Paid In Full” with no claim receipt or credit note', b.key, b.seg, b.inv)
    );
  [...new Set(M.map((r) => r.bill).filter((b) => b && !/^VMSI\d{7,}/.test(b)))].forEach((b) =>
    pushEx(
      'Non-standard bill number',
      b,
      'Cannot match to an invoice (typo?)',
      M.filter((r) => r.bill === b).reduce((t, r) => t + r.net, 0)
    )
  );
  bills
    .filter((b) => b.key.startsWith('NOBILL'))
    .forEach((b) => pushEx('No bill number on Bajaj report', b.claim, 'Grouped as NOBILL', b.net));
  bills
    .filter((b) => b.status.startsWith('Invoice raised'))
    .forEach((b) =>
      pushEx('Invoice awaiting claim payment', b.key, `${b.seg} · ${b.veh}`, b.netinv)
    );
  bills
    .filter((b) => b.cn)
    .forEach((b) => pushEx('Credit note on Bajaj invoice', b.cn, `Against ${b.key}`, b.cna));

  const pk: Record<string, string[]> = {};
  dmsI.forEach((i) => {
    const k = `${i.plate}|${i.incl}`;
    (pk[k] = pk[k] || []).push(i.no);
  });
  Object.values(pk)
    .filter((a) => a.length > 1)
    .forEach((a) =>
      pushEx(
        'Possible re-bill (same plate & amount)',
        a.join(' ↔ '),
        'Check insurance / warranty re-billing',
        null
      )
    );

  utr
    .filter((u) => u.status === 'NOT TALLIED')
    .forEach((u) =>
      pushEx(
        'UTR not tallied with bank',
        u.utr,
        `Bank ${fmtInr(u.bank)} vs report ${fmtInr(u.net)}`,
        u.bd
      )
    );
  utr
    .filter((u) => u.tl === 'Not in Tally')
    .forEach((u) => pushEx('UTR not booked in Tally receipts', u.utr, fmtDateShort(u.date), u.net));

  rec.forEach((r) => {
    const c =
      r.status === 'Amount differs'
        ? 'Tally ≠ DMS amount'
        : r.status === 'In DMS, not in Tally'
        ? 'In DMS, not in Tally'
        : r.status === 'Bajaj paid, not in Tally'
        ? 'Bajaj paid, not in Tally'
        : r.status === 'In Tally, not in DMS'
        ? 'In Tally, not in DMS'
        : r.status.startsWith('In Tally &')
        ? 'In Tally & Bajaj claims, not in DMS'
        : '';
    if (c) {
      pushEx(
        c,
        r.doc,
        r.type + (r.note ? ` · ${r.note}` : ''),
        c === 'Tally ≠ DMS amount' ? r.diff : r.damt != null ? r.damt : r.tamt
      );
    }
  });

  const dups = M.filter((r) => r.dup > 1).length;
  if (dups) {
    pushEx('Duplicate pay-apps merged', `${dups} pay-apps`, 'Appeared in more than one file', null);
  }

  const svOrder: Record<AuditSeverity, number> = { High: 0, Medium: 1, Info: 2 };
  ex.sort((a, b) => svOrder[a.sev] - svOrder[b.sev]);

  // Summary Seg
  const calcSeg = (s: BajajSegment | ''): SegmentSummaryMetrics => {
    const MSeg = M.filter((r) => !s || r.seg === s);
    const cl = MSeg.filter((r) => r.type === 'Claim Payment');
    const rl = MSeg.filter((r) => r.type !== 'Claim Payment');
    const bSeg = bills.filter((x) => !s || x.seg === s);
    const sumField = (arr: MasterPayAppRow[], k: 'appr' | 'gst' | 'tds' | 'net') =>
      arr.reduce((t, r) => t + r[k], 0);
    const pend = gst
      .filter((g) => (!s || g.seg === s) && g.pend > tol)
      .reduce((t, g) => t + g.pend, 0);

    return {
      'Bills / keys': bSeg.length,
      'Approved (incl GST)': sumField(cl, 'appr'),
      'GST held': sumField(cl, 'gst'),
      'TDS deducted': sumField(cl, 'tds'),
      'Net credited': sumField(cl, 'net'),
      'GST released': sumField(rl, 'net'),
      'GST still pending': pend,
      'Total cash received': sumField(cl, 'net') + sumField(rl, 'net'),
      'Settled incl TDS': sumField(cl, 'net') + sumField(rl, 'net') + sumField(cl, 'tds'),
      'Invoice value': bSeg
        .filter((x) => x.inv != null)
        .reduce((t, x) => t + (x.inv ?? 0), 0),
      'Credit notes': bSeg.reduce((t, x) => t + x.cna, 0),
    };
  };

  const segSummary = {
    Insurance: calcSeg('Insurance'),
    Warranty: calcSeg('Warranty'),
    Total: calcSeg(''),
  };

  const auditGroups: Record<string, { sev: AuditSeverity; n: number; a: number }> = {};
  ex.forEach((e) => {
    const x = auditGroups[e.cat] || (auditGroups[e.cat] = { sev: e.sev, n: 0, a: 0 });
    x.n++;
    x.a += Math.abs(e.amt ?? 0);
  });

  const auditKeys = Object.keys(BAJAJ_AUDIT_CHECKS).sort(
    (a, b) =>
      svOrder[BAJAJ_AUDIT_CHECKS[a]] - svOrder[BAJAJ_AUDIT_CHECKS[b]] ||
      (auditGroups[b]?.n || 0) - (auditGroups[a]?.n || 0)
  );

  return {
    M,
    bills,
    gst,
    utr,
    ex,
    rec,
    hasT,
    hasD,
    rng: {
      u: dateRangeOf(M.map((r) => ({ date: r.utrd }))),
      d: dr,
      t: tr,
    },
    opt: {
      tol,
      asOn,
      bk: safeBk,
    },
    segSummary,
    auditGroups,
    auditKeys,
  };
}

export function getBajajTabData(
  res: BajajReconResult,
  tab: Exclude<BajajTabKey, 'sum' | 'aud'>
): { cols: BajajColDef[]; rows: Array<Record<string, unknown>> } {
  const cols = BAJAJ_COLUMNS[tab];
  switch (tab) {
    case 'master':
      return { cols, rows: res.M as unknown as Array<Record<string, unknown>> };
    case 'ins':
      return {
        cols,
        rows: res.bills.filter((b) => b.seg === 'Insurance') as unknown as Array<
          Record<string, unknown>
        >,
      };
    case 'war':
      return {
        cols,
        rows: res.bills.filter((b) => b.seg === 'Warranty') as unknown as Array<
          Record<string, unknown>
        >,
      };
    case 'gst':
      return { cols, rows: res.gst as unknown as Array<Record<string, unknown>> };
    case 'utr':
      return { cols, rows: res.utr as unknown as Array<Record<string, unknown>> };
    case 'exc':
      return { cols, rows: res.ex as unknown as Array<Record<string, unknown>> };
    case 'rec':
      return { cols, rows: res.rec as unknown as Array<Record<string, unknown>> };
  }
}

function sheetFromCols(cols: BajajColDef[], rows: Array<Record<string, unknown>>) {
  const a: unknown[][] = [
    cols.map((c) => c.label),
    ...rows.map((r) =>
      cols.map((c) => {
        const v = r[c.key];
        if (v == null) return '';
        if (v instanceof Date) return v.getTime() / 864e5 + 25569;
        return v;
      })
    ),
  ];
  const ws = XLSX.utils.aoa_to_sheet(a);
  cols.forEach((c, j) => {
    for (let i = 1; i < a.length; i++) {
      const cell = ws[XLSX.utils.encode_cell({ r: i, c: j })];
      if (cell && c.fmt === 'd') cell.z = 'dd-mmm-yy';
      else if (cell && /n/.test(c.fmt || '')) cell.z = '#,##0.00';
    }
  });
  ws['!cols'] = cols.map((c) => ({ wch: Math.max(c.label.length + 2, 14) }));
  if (ws['!ref']) ws['!autofilter'] = { ref: ws['!ref'] };
  return ws;
}

export function buildBajajWorkbookBlob(res: BajajReconResult): Blob {
  const wb = XLSX.utils.book_new();
  const s = res.segSummary;
  const sa: unknown[][] = [
    ['Metric', 'Bajaj Insurance', 'Bajaj Warranty', 'Total'],
    ...(Object.keys(s.Total) as Array<keyof SegmentSummaryMetrics>).map((k) => [
      k,
      s.Insurance[k],
      s.Warranty[k],
      s.Total[k],
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sa), 'Summary');

  const sheetDefs: Array<[string, Exclude<BajajTabKey, 'sum' | 'aud'>]> = [
    ['Bajaj_Master', 'master'],
    ['Bajaj Insurance', 'ins'],
    ['Bajaj Warranty', 'war'],
    ['GST_Tracker', 'gst'],
    ['UTR_Bank', 'utr'],
    ['Tally_DMS_Reco', 'rec'],
    ['Exceptions', 'exc'],
  ];

  sheetDefs.forEach(([sheetName, tabKey]) => {
    const { cols, rows } = getBajajTabData(res, tabKey);
    XLSX.utils.book_append_sheet(wb, sheetFromCols(cols, rows), sheetName);
  });

  const auditAoa: unknown[][] = [
    ['Severity', 'Check', 'Findings', 'Amount'],
    ...res.auditKeys.map((k) => [
      BAJAJ_AUDIT_CHECKS[k],
      k,
      res.auditGroups[k]?.n || 0,
      res.auditGroups[k]?.a || 0,
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(auditAoa), 'Audit');

  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export function buildBajajCsvBlob(
  cols: BajajColDef[],
  rows: Array<Record<string, unknown>>
): Blob {
  const quoteCell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [
    cols.map((c) => quoteCell(c.label)).join(','),
    ...rows.map((r) =>
      cols
        .map((c) =>
          c.fmt === 'd'
            ? quoteCell(fmtDateShort(r[c.key] as Date | null | undefined))
            : /n/.test(c.fmt || '')
            ? String(r[c.key] ?? '')
            : quoteCell(r[c.key])
        )
        .join(',')
    ),
  ];
  return new Blob([`\ufeff${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
}
