import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import {
  RecoPeriodFilter,
  isDateKeyInRecoPeriod,
  localDateToKey,
  resolveRecoPeriodBounds,
} from './recoPeriodFilter';

export type ClaimSlotKey = 'inv' | 'cm' | 'dn' | 'trk';

export interface FieldSpec {
  key: string;
  label: string;
  aliases: string[];
  required?: boolean;
}

export const CLAIMS_FIELDS: Record<ClaimSlotKey, FieldSpec[]> = {
  inv: [
    { key: 'date', label: 'Invoice Date', aliases: ['invoicedate', 'date'], required: true },
    {
      key: 'no',
      label: 'Invoice No.',
      aliases: ['invoiceno', 'invoicenumber', 'documentnumber', 'documentno', 'invno'],
      required: true,
    },
    { key: 'odate', label: 'Order Date', aliases: ['orderdate'] },
    { key: 'order', label: 'Order / RO No.', aliases: ['orderno', 'rono'] },
    { key: 'cust', label: 'Customer Name', aliases: ['customername', 'customer'] },
    { key: 'bill', label: 'Bill To Customer', aliases: ['billtocustomer', 'billto'], required: true },
    { key: 'vin', label: 'VIN', aliases: ['vin', 'vinno17'] },
    { key: 'mat', label: 'Material Description', aliases: ['materialdescription', 'model'] },
    { key: 'plate', label: 'Plate No.', aliases: ['plateno', 'regnno'] },
    { key: 'tax', label: 'Taxable Amount', aliases: ['sumofamount', 'taxableamount'] },
    {
      key: 'amt',
      label: 'Amount with Tax',
      aliases: ['averageofamountwithtax', 'amountwithtax', 'invoiceamount', 'totalamount'],
      required: true,
    },
    { key: 'status', label: 'DMS Pay Status', aliases: ['status'] },
    { key: 'adv', label: 'ME Adviser', aliases: ['meadviser', 'adviser'] },
  ],
  cm: [
    { key: 'date', label: 'Date', aliases: ['date', 'creditmemodate'] },
    {
      key: 'no',
      label: 'Document No.',
      aliases: ['documentnumber', 'documentno', 'creditmemono', 'creditmemonumber'],
    },
    { key: 'name', label: 'Name', aliases: ['name'] },
    { key: 'amt', label: 'Amount', aliases: ['amount'], required: true },
    { key: 'status', label: 'Status', aliases: ['status'] },
    { key: 'from', label: 'Created From', aliases: ['createdfrom'], required: true },
  ],
  dn: [
    { key: 'date', label: 'Date', aliases: ['date', 'debitnotedate'] },
    {
      key: 'no',
      label: 'Document No.',
      aliases: ['documentnumber', 'documentno', 'debitnoteno', 'debitnotenumber'],
    },
    { key: 'name', label: 'Name', aliases: ['name'] },
    { key: 'amt', label: 'Amount', aliases: ['amount'], required: true },
    { key: 'status', label: 'Status', aliases: ['status'] },
    { key: 'from', label: 'Created From', aliases: ['createdfrom'], required: true },
  ],
  trk: [
    { key: 'ro', label: 'RO No', aliases: ['rono', 'ronumber'] },
    { key: 'rdate', label: 'RO Date', aliases: ['rodate'] },
    { key: 'claim', label: 'Claim No', aliases: ['claimno', 'claimcode'] },
    { key: 'repair', label: 'Repair Date', aliases: ['repairdate'] },
    { key: 'cdate', label: 'Claim Date', aliases: ['claimdate'] },
    { key: 'days', label: 'No of Days', aliases: ['noofdays'] },
    { key: 'cstat', label: 'Claim Status', aliases: ['claimstatus'] },
    { key: 'inv', label: 'Invoice No', aliases: ['invno', 'invoiceno'], required: true },
    { key: 'invamt', label: 'Total Inv Amount', aliases: ['totalinvamount'] },
    { key: 'tpl', label: 'Total Parts & Labour Inv Amt', aliases: ['totalpartslabourinvamt'] },
    { key: 'camt', label: 'Total Claim Amount', aliases: ['totalclaimamount'] },
    { key: 'aamt', label: 'Total Approved Amount', aliases: ['totalapprovedamount'] },
    { key: 'dclaim', label: 'Diff in Claim Amount', aliases: ['diffinclaimamount'] },
    { key: 'pclaimed', label: 'Parts Claimed', aliases: ['partsclaimed'] },
    { key: 'fru', label: 'Labour (FRU)', aliases: ['labourfru'] },
    { key: 'lclaimed', label: 'Labour Claimed', aliases: ['labourclaimed'] },
    { key: 'dlab', label: 'Diff in Labour', aliases: ['diffinlabour'] },
    {
      key: 'cn',
      label: 'BMW Credit Note No',
      aliases: ['creditnoteno', 'bmwcreditnoteno', 'creditnote', 'cnno'],
    },
    { key: 'cndate', label: 'Credit Date', aliases: ['creditdate'] },
    { key: 'cred', label: 'Total Credited', aliases: ['totalcredited'] },
    { key: 'pcred', label: 'Parts Credited (a)', aliases: ['partscredited'] },
    { key: 'pcred2', label: 'Parts Credited (b)', aliases: ['partscredited#2'] },
    { key: 'igst', label: 'Total IGST', aliases: ['totaligst'] },
    { key: 'igstp', label: 'IGST Parts', aliases: ['igstparts'] },
    { key: 'tpcred', label: 'Total Parts Credited', aliases: ['totalpartscredited'] },
    { key: 'sublet', label: 'Sublet Amount', aliases: ['subletamount'] },
    { key: 'lcred', label: 'Labour Credited', aliases: ['labourcredited'] },
    { key: 'igstl', label: 'IGST Labour', aliases: ['igstlabour'] },
    { key: 'tlcred', label: 'Total Labour Credited', aliases: ['totallabourcredited'] },
    { key: 'dparts', label: 'Diff in Parts', aliases: ['diffinparts'] },
    { key: 'dlab2', label: 'Diff in Labour (2)', aliases: ['diffinlabour#2'] },
    { key: 'work', label: 'Type of Work', aliases: ['typeofwork'] },
    { key: 'pcost', label: 'Parts Cost Price', aliases: ['partscostprice'] },
    { key: 'lwot', label: 'Labour without Tax', aliases: ['labourwithouttax'] },
    { key: 'fru1', label: '1 FRU Amount', aliases: ['1fruamount'] },
    { key: 'lwot2', label: 'Labour without Tax (2)', aliases: ['labourwithouttax#2'] },
    { key: 'hand', label: 'Handling Charges', aliases: ['handlingcharges'] },
    { key: 'diff', label: 'Diff Amount', aliases: ['diffamount'] },
    { key: 'cust', label: 'Customer (tracker)', aliases: ['customername'] },
    { key: 'vin', label: 'VIN (tracker)', aliases: ['vinno17', 'vin'] },
    { key: 'plate', label: 'Regn No (tracker)', aliases: ['regnno'] },
  ],
};

export const CLAIMS_SLOT_META: Record<ClaimSlotKey, { title: string; subtitle: string }> = {
  inv: { title: 'Service Invoices (DMS)', subtitle: 'Required · Invoice No., Bill To, Amount' },
  cm: { title: 'Service Credit Memos (DMS)', subtitle: 'Optional · Created From “Invoice #…”' },
  dn: { title: 'Debit Notes (DMS)', subtitle: 'Optional · same layout as credit memos' },
  trk: {
    title: 'Warranty Claim / Credit tracker',
    subtitle: 'Optional · all month sheets are read',
  },
};

export const DT_KEYS = new Set(['rdate', 'repair', 'cdate', 'cndate']);
export const TX_KEYS = new Set(['ro', 'claim', 'inv', 'cstat', 'cn', 'work', 'cust', 'vin', 'plate']);
export const CRED_KEYS = new Set([
  'cred',
  'pcred',
  'pcred2',
  'igst',
  'igstp',
  'tpcred',
  'sublet',
  'lcred',
  'igstl',
  'tlcred',
]);
export const MAX_KEYS = new Set(['invamt', 'tpl', 'days']);

export const normKey = (s: unknown): string =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

export const fmtD = (d: Date | null | undefined): string =>
  d
    ? `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`
    : '';

export const toD = (v: unknown): Date | null => {
  if (v == null || v === '') return null;
  let d: Date;
  if (v instanceof Date) d = v;
  else if (typeof v === 'number') {
    if (v < 20000 || v > 80000) return null;
    const u = new Date(Math.round((v - 25569) * 864e5));
    return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate());
  } else {
    const s = String(v).trim();
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    m = s.match(/^(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{2,4})/);
    if (m) {
      if (+m[2] > 12) return null;
      return new Date(+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[2] - 1, +m[1]);
    }
    d = new Date(s);
  }
  if (!d || Number.isNaN(d.getTime())) return null;
  const e = new Date(d.getTime() + 432e5);
  return new Date(e.getFullYear(), e.getMonth(), e.getDate());
};

export const num = (v: unknown): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  let s = String(v ?? '').replace(/[,₹\s]/g, '');
  const neg = /^\(.*\)$/.test(s);
  s = s.replace(/[^0-9.\-]/g, '');
  const x = parseFloat(s);
  return Number.isNaN(x) ? 0 : neg ? -Math.abs(x) : x;
};

export const inr = (v: unknown): string =>
  v || v === 0 ? (+v).toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '';

export const invNo = (s: unknown): string => {
  const t = String(s || '').toUpperCase().trim();
  const m = t.match(/[A-Z]{2,6}[-\/]?\d{5,}(?:[-\/]\d+)*/);
  return m ? m[0] : t.replace(/^.*?(invoice|inv)\s*#?\s*/i, '').trim();
};

const uqHeaders = (a: unknown[]): string[] => {
  const c: Record<string, number> = {};
  return a.map((x) => {
    const k = normKey(x);
    if (!k) return '';
    c[k] = (c[k] || 0) + 1;
    return c[k] > 1 ? `${k}#${c[k]}` : k;
  });
};

export const monOf = (d: Date | null | undefined): string =>
  d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : '';

export const dayDiff = (a: Date | null | undefined, b: Date | null | undefined): number | '' =>
  a && b ? Math.round((a.getTime() - b.getTime()) / 864e5) : '';

export const bandOf = (n: number): string => (n > 3 ? '4+ claims' : `${n} claims`);

export interface UploadedSheet {
  n: string;
  h: string[];
  hl: string[];
  rows: unknown[][];
}

export interface UploadedSlotData {
  file: string;
  sh: UploadedSheet[];
  lab: Record<string, string>;
}

export async function parseSlotFiles(
  slot: ClaimSlotKey,
  files: File[]
): Promise<{ data: UploadedSlotData; autoMap: Record<string, string> }> {
  const sh: UploadedSheet[] = [];
  for (const file of files) {
    const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
    wb.SheetNames.forEach((n) => {
      const a = XLSX.utils.sheet_to_json(wb.Sheets[n], {
        header: 1,
        raw: true,
        defval: null,
      }) as unknown[][];
      let best = -1;
      let bs = 0;
      for (let i = 0; i < Math.min(a.length, 10); i++) {
        const set = new Set((a[i] || []).map(normKey));
        const sc = CLAIMS_FIELDS[slot].filter((f) => f.aliases.some((s) => set.has(s))).length;
        if (sc > bs) {
          bs = sc;
          best = i;
        }
      }
      if (best >= 0 && bs >= 2) {
        sh.push({
          n: (files.length > 1 ? `${file.name.replace(/\.\w+$/, '')} › ` : '') + n,
          h: uqHeaders(a[best]),
          hl: a[best].map((x) => String(x ?? '').replace(/\s+/g, ' ').trim()),
          rows: a.slice(best + 1).filter((r) => r && r.some((x) => x !== null && x !== '')),
        });
      }
    });
  }
  if (!sh.length) {
    throw new Error(`No sheet with recognisable ${CLAIMS_SLOT_META[slot].title} headers`);
  }
  const lab: Record<string, string> = {};
  sh.forEach((s) =>
    s.h.forEach((k, i) => {
      if (k && !lab[k]) lab[k] = s.hl[i] + (k.includes('#') ? ` [${k.split('#')[1]}]` : '');
    })
  );
  const autoMap: Record<string, string> = {};
  CLAIMS_FIELDS[slot].forEach((f) => {
    const c = f.aliases.find((s) => lab[s]);
    if (c) autoMap[f.key] = c;
  });
  return {
    data: {
      file: files.length > 1 ? `${files.length} files` : files[0].name,
      sh,
      lab,
    },
    autoMap,
  };
}

export function extractSlotRows(
  slot: ClaimSlotKey,
  slotData: UploadedSlotData | null,
  colMap: Record<string, string>
): Array<Record<string, unknown>> {
  if (!slotData) return [];
  const o: Array<Record<string, unknown>> = [];
  slotData.sh.forEach((s) => {
    const ix: Record<string, number> = {};
    s.h.forEach((k, i) => {
      if (k && !(k in ix)) ix[k] = i;
    });
    s.rows.forEach((r) => {
      const x: Record<string, unknown> = { _s: s.n };
      CLAIMS_FIELDS[slot].forEach((f) => {
        const c = colMap[f.key];
        x[f.key] = c && c in ix ? r[ix[c]] : null;
      });
      o.push(x);
    });
  });
  return o;
}

export interface ClaimNoteItem {
  no: string;
  date: Date | null;
  name: unknown;
  amt: number;
  status: unknown;
  from: string;
  dn: boolean;
}

export interface TrackerClaimItem {
  sheet: string;
  ro: string;
  rdate: Date | null;
  claim: string;
  repair: Date | null;
  cdate: Date | null;
  days: number;
  cstat: string;
  inv: string;
  invamt: number;
  tpl: number;
  camt: number;
  aamt: number;
  dclaim: number;
  pclaimed: number;
  fru: number;
  lclaimed: number;
  dlab: number;
  cn: string;
  cndate: Date | null;
  cred: number;
  pcred: number;
  pcred2: number;
  igst: number;
  igstp: number;
  tpcred: number;
  sublet: number;
  lcred: number;
  igstl: number;
  tlcred: number;
  dparts: number;
  dlab2: number;
  work: string;
  pcost: number;
  lwot: number;
  fru1: number;
  lwot2: number;
  hand: number;
  diff: number;
  cust: string;
  vin: string;
  plate: string;
  viaRO?: number;
  skip: boolean;
  dupCred: boolean;
  cu: number;
  t?: InternalInvoice | null;
  [k: string]: unknown;
}

export interface InternalInvoice {
  no: string;
  date: Date | null;
  order: string;
  cust: string;
  bill: string;
  acc: string;
  vin: string;
  mat: string;
  plate: string;
  tax: number;
  amt: number;
  pay: string;
  adv: string;
  cm: ClaimNoteItem[];
  dn: ClaimNoteItem[];
  cl: TrackerClaimItem[];
  crT: number;
}

export interface RegisterRow extends Record<string, unknown> {
  ix: number;
  bs: string;
  rs: string;
  ncl: number;
  band: string;
  nnt: number;
  date: Date | null;
  no: string;
  order: string;
  cust: string;
  acc: string;
  vin: string;
  plate: string;
  mat: string;
  adv: string;
  pay: string;
  tax: number;
  amt: number;
  cmno: string;
  cmd: Date | null | undefined;
  cma: number;
  dnno: string;
  dnd: Date | null | undefined;
  dna: number;
  code: string;
  cst: string;
  ca: number;
  ap: number;
  cnno: string;
  cnd: Date | undefined;
  cr: number;
  diff: number;
  net: number;
  age: number;
  bk: string;
  dcl: number | '';
  dcr: number | '';
  mon: string;
  rem: string;
  flags: string;
  man: string;
}

export interface ClaimVsDmsRow extends Record<string, unknown> {
  fd: Date | null;
  dmsno: string;
  dmsdate: Date | null;
  dmsamt: number | '';
  acc: string;
  cust: string;
  vin: string;
  plate: string;
  d1: number | '';
  d2: number;
  split: string;
  res: string;
  rem: string;
}

export interface ExceptionRow extends Record<string, unknown> {
  sev: string;
  t: string;
  no: string;
  date: Date | null;
  cust: string;
  acc: string;
  amt: number | '';
  net: number | '';
  code: string;
  d: string;
  a: string;
}

export interface CnReconRow extends Record<string, unknown> {
  no: string;
  date: Date | undefined;
  n: number;
  bill: number;
  cr: number;
  ca: number;
  ap: number;
  diff: number;
  res: string;
}

export interface CmsRow extends ClaimNoteItem, Record<string, unknown> {
  type: string;
  inReg: 'Yes' | 'No';
  iamt: number | undefined;
  idate: Date | null | undefined;
  idiff: number | '';
  days: number | '';
  res: string;
}

export interface MonthlySummaryRow extends Record<string, unknown> {
  mon: string;
  n: number;
  amt: number;
  cm: number;
  cr: number;
  net: number;
  m2: number;
}

export interface AccountSummaryRow extends Record<string, unknown> {
  acc: string;
  n: number;
  amt: number;
  cm: number;
  dn: number;
  cr: number;
  net: number;
  ok: number;
  pend: number;
  rej: number;
  short: number;
}

export interface AuditRow extends Record<string, unknown> {
  chk: string;
  sev: string;
  n: number;
  d: string;
}

export interface ClaimsReconcileResult {
  by: Record<string, InternalInvoice>;
  aud: AuditRow[];
  reg: RegisterRow[];
  ex: ExceptionRow[];
  cnl: CnReconRow[];
  cms: CmsRow[];
  cld: ClaimVsDmsRow[];
  mo: MonthlySummaryRow[];
  ac: AccountSummaryRow[];
  rd: Date;
}

export interface ComputeClaimsInput {
  inv: Array<Record<string, unknown>>;
  cm: Array<Record<string, unknown>>;
  dn: Array<Record<string, unknown>>;
  trk: Array<Record<string, unknown>>;
  hasCm: boolean;
  hasDn: boolean;
  hasTrk: boolean;
  unmapped: string[];
}

export interface ComputeClaimsOptions {
  tol: number;
  pend: number;
  rd: Date;
  ew: boolean;
  pos: boolean;
  reb: boolean;
  ro: boolean;
  dedupe: boolean;
  bill: string;
  invFile?: string;
}

function aggClaims(cl: TrackerClaimItem[], dedupe: boolean): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  CLAIMS_FIELDS.trk.forEach((f) => {
    const k = f.key;
    if (k === 'inv') return;
    const src = CRED_KEYS.has(k) && dedupe ? cl.filter((c) => !c.skip) : cl;
    const v = src.map((c) => c[k]);
    if (DT_KEYS.has(k)) {
      o[`t_${k}`] =
        (v.filter((x): x is Date => x instanceof Date).sort((a, b) => a.getTime() - b.getTime())[0] ??
          null);
    } else if (TX_KEYS.has(k)) {
      o[`t_${k}`] = [...new Set(v.filter(Boolean).map(String))].join(', ');
    } else {
      const nums = v.map((x) => Number(x) || 0);
      o[`t_${k}`] = cl.length
        ? MAX_KEYS.has(k)
          ? Math.max(...nums)
          : nums.reduce((a, b) => a + b, 0)
        : '';
    }
  });
  return o;
}

export function computeClaimsReconciliation(
  D: ComputeClaimsInput,
  o: ComputeClaimsOptions
): ClaimsReconcileResult {
  const tol = o.tol;
  const pend = o.pend;
  const rd = o.rd;
  const AUD: AuditRow[] = [];
  const A = (chk: string, sev: string, n: number, d?: string) =>
    AUD.push({ chk, sev, n, d: d || '' });
  const W = (c: string, n: number, d?: string) => A(c, n ? 'Warning' : 'Passed', n, d);

  const filters = String(o.bill == null ? 'bmw india' : o.bill)
    .toLowerCase()
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const inv: InternalInvoice[] = [];
  const seen: Record<string, InternalInvoice> = {};
  const dupI: Array<{ no: string; txt: string; date: Date | null }> = [];
  let nb = 0;
  let ne = 0;

  D.inv.forEach((r) => {
    const no = String(r.no ?? '').trim();
    if (!no) return;
    const bill = String(r.bill ?? '');
    if (!/bmw/i.test(bill)) {
      nb++;
      return;
    }
    const isEW = /bajaj|_ew|bmw.?ew/i.test(bill);
    if (isEW && !o.ew) {
      ne++;
      return;
    }
    if (!isEW && filters.length && !filters.some((f) => bill.toLowerCase().includes(f))) {
      nb++;
      return;
    }
    if (seen[no]) {
      dupI.push({
        no,
        txt: no + (Math.abs(num(r.amt) - seen[no].amt) > tol ? ' (amount differs)' : ''),
        date: seen[no].date,
      });
      return;
    }
    const acc = isEW ? 'BMW EW' : bill.split(' ')[0].replace(/^BMW_/, '').replace(/_TN$/, '');
    const x: InternalInvoice = {
      no,
      date: toD(r.date),
      order: String(r.order ?? '').replace(/^- None -$/, '').trim(),
      cust: String(r.cust ?? '').replace(/^- None -$/, ''),
      bill,
      acc,
      vin: String(r.vin || '').trim().toUpperCase(),
      mat: String(r.mat ?? '').replace(/^- None -$/, ''),
      plate: String(r.plate || ''),
      tax: num(r.tax),
      amt: num(r.amt),
      pay: String(r.status || ''),
      adv: String(r.adv || ''),
      cm: [],
      dn: [],
      cl: [],
      crT: 0,
    };
    inv.push(x);
    seen[no] = x;
  });

  const by: Record<string, InternalInvoice> = {};
  const byN: Record<string, InternalInvoice> = {};
  const byRO: Record<string, InternalInvoice[]> = {};
  inv.forEach((i) => {
    by[i.no] = i;
    byN[normKey(i.no)] = i;
    if (i.order) {
      (byRO[normKey(i.order)] = byRO[normKey(i.order)] || []).push(i);
    }
  });

  const orphan: ClaimNoteItem[] = [];
  const cms: ClaimNoteItem[] = [];
  const cmSeen: Record<string, number> = {};
  const noRef: string[] = [];
  let cmDup = 0;

  const addDoc = (r: Record<string, unknown>, dn: boolean) => {
    const x: ClaimNoteItem = {
      no: String(r.no).trim(),
      date: toD(r.date),
      name: r.name,
      amt: Math.abs(num(r.amt)),
      status: r.status,
      from: invNo(r.from),
      dn,
    };
    const k = `${x.no}|${dn}`;
    if (cmSeen[k]) {
      cmDup++;
      return;
    }
    cmSeen[k] = 1;
    cms.push(x);
    if (!x.from) noRef.push(x.no);
    const i = x.from ? byN[normKey(x.from)] : null;
    if (i) {
      x.from = i.no;
      i[dn ? 'dn' : 'cm'].push(x);
    } else {
      orphan.push(x);
    }
  };

  D.cm.forEach((r) => {
    if (r.no) addDoc(r, num(r.amt) > 0 && !!o.pos);
  });
  D.dn.forEach((r) => {
    if (r.no) addDoc(r, true);
  });

  const tr = D.trk.filter((r) => r.claim || r.inv);
  const cseen: Record<string, number> = {};
  const ucl: TrackerClaimItem[] = [];
  let cDup = 0;
  let roHit = 0;

  tr.forEach((r) => {
    const key = [r.claim, r.inv, r.cn, r.camt, r.cred, r.aamt]
      .map((x) => String(x ?? '').trim())
      .join('|');
    if (cseen[key]) {
      cDup++;
      return;
    }
    cseen[key] = 1;
    const c: TrackerClaimItem = {
      sheet: String(r._s ?? ''),
      ro: '',
      rdate: null,
      claim: '',
      repair: null,
      cdate: null,
      days: 0,
      cstat: '',
      inv: '',
      invamt: 0,
      tpl: 0,
      camt: 0,
      aamt: 0,
      dclaim: 0,
      pclaimed: 0,
      fru: 0,
      lclaimed: 0,
      dlab: 0,
      cn: '',
      cndate: null,
      cred: 0,
      pcred: 0,
      pcred2: 0,
      igst: 0,
      igstp: 0,
      tpcred: 0,
      sublet: 0,
      lcred: 0,
      igstl: 0,
      tlcred: 0,
      dparts: 0,
      dlab2: 0,
      work: '',
      pcost: 0,
      lwot: 0,
      fru1: 0,
      lwot2: 0,
      hand: 0,
      diff: 0,
      cust: '',
      vin: '',
      plate: '',
      skip: false,
      dupCred: false,
      cu: 0,
    };
    CLAIMS_FIELDS.trk.forEach((f) => {
      const k = f.key;
      const v = r[k];
      c[k] = DT_KEYS.has(k)
        ? toD(v)
        : TX_KEYS.has(k)
          ? v == null
            ? ''
            : String(v).replace(/\.0$/, '').trim()
          : num(v);
    });
    c.cstat = String(c.cstat).toUpperCase();
    let t: InternalInvoice | undefined = byN[normKey(c.inv)] || byN[normKey(invNo(c.inv))];
    if (!t && o.ro && c.ro && byRO[normKey(c.ro)] && byRO[normKey(c.ro)].length === 1) {
      t = byRO[normKey(c.ro)][0];
      roHit++;
      c.viaRO = 1;
    }
    c.t = t || null;
    ucl.push(c);
    if (t) t.cl.push(c);
  });

  inv.forEach((i) => {
    const s = new Set<string>();
    i.cl.forEach((c) => {
      c.skip = false;
      const k = c.cn && c.cred ? `${c.cn}|${c.cred}` : '';
      c.dupCred = false;
      if (k) {
        if (s.has(k)) {
          c.dupCred = true;
          if (o.dedupe) c.skip = true;
        } else {
          s.add(k);
        }
      }
      c.cu = c.skip ? 0 : c.cred;
    });
    i.crT = i.cl.reduce((a, c) => a + c.cu, 0);
  });

  const vinMap: Record<string, InternalInvoice[]> = {};
  if (o.reb) {
    inv.forEach((i) => {
      if (i.vin) (vinMap[i.vin] = vinMap[i.vin] || []).push(i);
    });
  }

  const reg: RegisterRow[] = inv.map((i, ix) => {
    const cm = i.cm.reduce((a, x) => a + x.amt, 0);
    const dn = i.dn.reduce((a, x) => a + x.amt, 0);
    const cr = i.crT;
    const ca = i.cl.reduce((a, x) => a + x.camt, 0);
    const ap = i.cl.reduce((a, x) => a + x.aamt, 0);
    const cns = [...new Set(i.cl.filter((c) => c.cn).map((c) => c.cn))];
    const cnd = i.cl
      .filter((c): c is TrackerClaimItem & { cndate: Date } => Boolean(c.cndate))
      .map((c) => c.cndate)
      .sort((a, b) => a.getTime() - b.getTime())[0];
    const cdt = i.cl
      .filter((c): c is TrackerClaimItem & { cdate: Date } => Boolean(c.cdate))
      .map((c) => c.cdate)
      .sort((a, b) => a.getTime() - b.getTime())[0];
    const age = i.date ? Math.floor((rd.getTime() - i.date.getTime()) / 864e5) : 0;
    const fl: string[] = [];
    const bs = i.dn.length
      ? 'Debit Note Passed'
      : i.cm.length || cns.length
        ? 'Credit Note Passed'
        : 'Invoiced';
    const diff = cns.length ? cr - i.amt : 0;
    let rs: string;
    const stats = i.cl.map((c) => c.cstat).join(',');
    if (cns.length) {
      rs =
        Math.abs(diff) <= tol
          ? 'Matched – BMW credit received'
          : diff < 0
            ? 'Short credit from BMW'
            : 'Excess credit from BMW';
    } else if (i.cl.length) {
      rs = /APPROV/.test(stats)
        ? 'Claim approved – credit pending'
        : /REJECT|DECLIN/.test(stats)
          ? 'Claim rejected'
          : 'Claim raised – awaiting decision';
    } else if (i.cm.length) {
      rs = Math.abs(cm - i.amt) <= tol ? 'Reversed by DMS credit memo' : 'Partial DMS credit memo';
    } else {
      rs = /warranty|bri|goodwill|rm_support|bsi/i.test(i.acc)
        ? 'Invoiced – no claim / credit found'
        : 'Invoiced – open';
    }

    if (i.cm.length && cns.length) fl.push('Both DMS credit memo and BMW credit exist – verify double credit');
    if (!cns.length && i.cl.length && age > pend) fl.push(`Credit pending ${age} days`);
    if (!cns.length && !i.cl.length && !i.cm.length && age > pend && /warranty|bri|goodwill|bsi/i.test(i.acc)) {
      fl.push(`No claim filed for ${age} days`);
    }
    if (i.cl.some((c) => c.aamt && c.camt - c.aamt > tol)) {
      fl.push(`Claim short-approved by ₹${inr(ca - ap)}`);
    }
    if (diff && Math.abs(diff) > tol) fl.push(`Credit vs invoice diff ₹${inr(diff)}`);
    if (vinMap[i.vin]) {
      const q = vinMap[i.vin].filter(
        (z) =>
          z !== i &&
          z.date &&
          i.date &&
          Math.abs(z.date.getTime() - i.date.getTime()) <= 15 * 864e5 &&
          Math.abs(z.amt - i.amt) <= Math.max(tol, i.amt * 0.03)
      );
      if (q.length && i.cm.length) fl.push(`Possible re-bill: ${q.map((z) => z.no).join(', ')}`);
      else if (q.length && !i.cm.length && !q.some((z) => z.cm.length)) {
        fl.push(`Possible duplicate of ${q.map((z) => z.no).join(', ')}`);
      }
    }
    if (i.cl.length > 1) fl.push(`${i.cl.length} claims on this invoice`);
    const rep = i.cl.filter((c) => c.dupCred).length;
    if (rep) {
      fl.push(
        `Same BMW CN & credit repeated on ${rep + 1} claim lines${
          o.dedupe ? ' – counted once' : ' – check double count'
        }`
      );
    }
    if (i.cl.some((c) => c.viaRO)) fl.push('Claim matched by RO no. only');
    const dcr = dayDiff(cnd, i.date);
    if (dcr !== '' && dcr < 0) fl.push('BMW credit dated before invoice');

    const rem: string[] = [];
    i.cm.forEach((x) => rem.push(`DMS CM ${x.no} dt ${fmtD(x.date)} ₹${inr(x.amt)}`));
    i.dn.forEach((x) => rem.push(`Debit note ${x.no} dt ${fmtD(x.date)} ₹${inr(x.amt)}`));
    i.cl.forEach((c) =>
      rem.push(
        `Claim ${c.claim} ${c.cstat}${
          c.cn
            ? ` → BMW CN ${c.cn} dt ${fmtD(c.cndate)} ₹${inr(c.cred)}${
                c.skip ? ' (repeat, not counted)' : ''
              }`
            : ' (no credit yet)'
        }`
      )
    );

    return {
      ...aggClaims(i.cl, o.dedupe),
      ix,
      bs,
      rs,
      ncl: i.cl.length,
      band: i.cl.length > 1 ? bandOf(i.cl.length) : '',
      nnt: i.cm.length + i.dn.length,
      date: i.date,
      no: i.no,
      order: i.order,
      cust: i.cust,
      acc: i.acc,
      vin: i.vin,
      plate: i.plate,
      mat: i.mat,
      adv: i.adv,
      pay: i.pay,
      tax: i.tax,
      amt: i.amt,
      cmno: i.cm.map((x) => x.no).join(', '),
      cmd: i.cm[0]?.date,
      cma: cm,
      dnno: i.dn.map((x) => x.no).join(', '),
      dnd: i.dn[0]?.date,
      dna: dn,
      code: i.cl.map((c) => c.claim).filter(Boolean).join(', '),
      cst: [...new Set(i.cl.map((c) => c.cstat))].join(', '),
      ca,
      ap,
      cnno: cns.join(', '),
      cnd,
      cr,
      diff,
      net: i.amt - cm - cr + dn,
      age,
      bk: age <= 30 ? '0–30' : age <= 60 ? '31–60' : age <= 90 ? '61–90' : '90+',
      dcl: dayDiff(cdt, i.date),
      dcr,
      mon: monOf(i.date),
      rem: rem.join(' | '),
      flags: fl.join('; '),
      man: '',
    };
  });

  const cld: ClaimVsDmsRow[] = ucl.map((c) => {
    const t = c.t;
    const o2: ClaimVsDmsRow = {
      fd: t ? t.date : c.cdate || c.repair,
      dmsno: t ? t.no : '',
      dmsdate: t ? t.date : null,
      dmsamt: t ? t.amt : '',
      acc: t ? t.acc : '',
      cust: t ? t.cust : c.cust,
      vin: t ? t.vin : c.vin,
      plate: t ? t.plate : c.plate,
      d1: '',
      d2: 0,
      split: '',
      res: '',
      rem: '',
    };
    CLAIMS_FIELDS.trk.forEach((f) => {
      o2[`t_${f.key}`] = c[f.key];
    });
    const split = Boolean(t && t.cl.length > 1);
    o2.d1 = t && c.invamt ? c.invamt - t.amt : '';
    o2.d2 = t ? (split ? t.crT : c.cu) - t.amt : 0;
    o2.split = split && t ? bandOf(t.cl.length) : '';
    const tail = split ? ' (split: invoice total)' : '';
    o2.res = !t
      ? 'Invoice not in DMS BMW billing'
      : o2.d1 !== '' && Math.abs(Number(o2.d1)) > tol
        ? 'Invoice amount mismatch'
        : !c.cn
          ? /APPROV/.test(c.cstat)
            ? 'Claim approved – credit pending'
            : `Claim ${(c.cstat || 'open').toLowerCase()} – no credit`
          : split && t.crT === 0
            ? `Excess credit from BMW${tail}`
            : Math.abs(o2.d2) <= tol
              ? `Matched – BMW credit received${tail}`
              : o2.d2 < 0
                ? `Short credit from BMW${tail}`
                : `Excess credit from BMW${tail}`;
    o2.rem =
      (c.cn
        ? `BMW CN ${c.cn} dt ${fmtD(c.cndate)} ₹${inr(c.cred)}${
            c.skip ? ' (repeat, not counted)' : ''
          }${c.camt !== c.aamt ? ` | claimed ₹${inr(c.camt)} vs approved ₹${inr(c.aamt)}` : ''}`
        : `No BMW credit note yet${c.camt ? ` | claimed ₹${inr(c.camt)}` : ''}`) +
      (c.viaRO ? ' | matched by RO no.' : '');
    return o2;
  });

  const ex: ExceptionRow[] = [];
  reg.forEach((r) => {
    const add = (sev: string, t: string, d: string, a: string) =>
      ex.push({
        sev,
        t,
        no: r.no,
        date: r.date,
        cust: r.cust,
        acc: r.acc,
        amt: r.amt,
        net: r.net,
        code: r.code,
        d,
        a,
      });
    if (r.rs === 'Short credit from BMW') {
      add('High', 'Short BMW credit', `Credit ₹${inr(r.cr)} vs invoice ₹${inr(r.amt)}`, 'Raise short-payment query with BMW');
    }
    if (r.rs === 'Excess credit from BMW') {
      add('Medium', 'Excess BMW credit', `Credit exceeds invoice by ₹${inr(r.diff)}`, 'Verify and adjust');
    }
    if (r.rs === 'Claim approved – credit pending' && r.age > pend) {
      add('High', 'Approved – credit pending', `${r.age} days since invoice`, 'Follow up with BMW for credit note');
    }
    if (r.rs === 'Claim raised – awaiting decision' && r.age > pend) {
      add('Medium', 'Claim awaiting decision', `${r.age} days`, 'Chase claim approval');
    }
    if (r.rs === 'Claim rejected') {
      add('High', 'Claim rejected', `Net receivable ₹${inr(r.net)}`, 'Review rejection / re-submit or write-off');
    }
    if (r.rs === 'Invoiced – no claim / credit found' && r.age > pend) {
      add('Medium', 'No claim filed', `${r.age} days old`, 'File claim / confirm billing');
    }
    if (/Possible/.test(r.flags)) {
      add('Medium', 'Re-bill / duplicate', r.flags.match(/Possible[^;]*/)?.[0] || '', 'Check duplicate billing');
    }
    if (/Both DMS/.test(r.flags)) {
      add('High', 'Double credit risk', 'DMS CM and BMW credit both present', 'Verify and reverse one');
    }
    if (/short-approved/.test(r.flags)) {
      add('Low', 'Claim vs approved diff', r.flags.match(/Claim short[^;]*/)?.[0] || '', 'Check deduction reason');
    }
    if (r.ncl > 1) {
      add('Low', 'Multiple claims on one invoice', `${r.ncl} claim lines: ${r.code}`, 'Verify split claims add up to the invoice');
    }
    if (/repeated on/.test(r.flags)) {
      add('Medium', 'Repeated BMW credit on claim lines', r.flags.match(/Same BMW[^;]*/)?.[0] || '', 'Verify credited amounts');
    }
    if (/matched by RO/.test(r.flags)) {
      add('Low', 'Claim matched by RO only', 'Tracker invoice no. did not match', 'Confirm invoice number in tracker');
    }
    if (/dated before/.test(r.flags)) {
      add('Medium', 'BMW credit before invoice date', `CN ${fmtD(r.cnd)} vs invoice ${fmtD(r.date)}`, 'Check dates / invoice number');
    }
    if (r.nnt > 1) {
      add('Low', 'Multiple credit/debit notes', `${r.cmno} ${r.dnno}`.trim(), 'Verify notes net to the invoice');
    }
  });

  cld
    .filter((x) => x.res.startsWith('Invoice not in'))
    .forEach((x) =>
      ex.push({
        sev: 'Medium',
        t: 'Claim not in DMS BMW billing',
        no: String(x.t_inv || ''),
        date: x.fd,
        cust: x.cust,
        acc: '',
        amt: Number(x.t_invamt) || 0,
        net: '',
        code: String(x.t_claim || ''),
        d: `Tracker invoice ${x.t_inv} not found in BMW invoices`,
        a: 'Check invoice number / Bill-To',
      })
    );

  cld
    .filter((x) => x.res.startsWith('Invoice amount mismatch'))
    .forEach((x) =>
      ex.push({
        sev: 'Medium',
        t: 'Tracker vs DMS invoice amount',
        no: x.dmsno,
        date: x.fd,
        cust: x.cust,
        acc: x.acc,
        amt: x.dmsamt,
        net: '',
        code: String(x.t_claim || ''),
        d: `Tracker ₹${inr(x.t_invamt)} vs DMS ₹${inr(x.dmsamt)}`,
        a: 'Confirm which amount is right',
      })
    );

  dupI.forEach((n) =>
    ex.push({
      sev: 'Low',
      t: 'Duplicate invoice row ignored',
      no: n.no,
      date: n.date,
      cust: '',
      acc: '',
      amt: '',
      net: '',
      code: '',
      d: n.txt,
      a: 'Check source export',
    })
  );

  const sc: Record<string, Set<string>> = {};
  ucl.forEach((c) => {
    if (c.claim && c.t) {
      (sc[c.claim] = sc[c.claim] || new Set()).add(c.t.no);
    }
  });
  Object.entries(sc)
    .filter(([, s]) => s.size > 1)
    .forEach(([k, s]) => {
      const f = by[[...s][0]];
      ex.push({
        sev: 'Medium',
        t: 'One claim spans several invoices',
        no: [...s].join(', '),
        date: f ? f.date : null,
        cust: f ? f.cust : '',
        acc: '',
        amt: '',
        net: '',
        code: k,
        d: `Claim ${k} linked to ${s.size} invoices`,
        a: 'Confirm claim split / wrong invoice no.',
      });
    });

  orphan.forEach((x) =>
    ex.push({
      sev: 'Low',
      t: 'Credit memo – invoice not in register',
      no: x.from,
      date: x.date,
      cust: String(x.name || ''),
      acc: '',
      amt: x.amt,
      net: '',
      code: '',
      d: `${x.no} ₹${inr(x.amt)}`,
      a: 'Check invoice belongs to BMW',
    })
  );

  const cn: Record<string, { no: string; date: Date | undefined; n: number; bill: number; cr: number; ca: number; ap: number }> = {};
  reg.forEach((r) =>
    r.cnno
      .split(', ')
      .filter(Boolean)
      .forEach((n) => {
        const c = (cn[n] = cn[n] || { no: n, date: r.cnd, n: 0, bill: 0, cr: 0, ca: 0, ap: 0 });
        c.n++;
        c.bill += r.amt;
        const q = by[r.no].cl.filter((x) => x.cn === n);
        c.cr += q.reduce((a, x) => a + x.cu, 0);
        c.ca += q.reduce((a, x) => a + x.camt, 0);
        c.ap += q.reduce((a, x) => a + x.aamt, 0);
      })
  );
  const cnl: CnReconRow[] = Object.values(cn).map((c) => ({
    ...c,
    diff: c.cr - c.bill,
    res: Math.abs(c.cr - c.bill) <= tol * c.n ? 'Matched' : c.cr < c.bill ? 'Short' : 'Excess',
  }));

  A('Invoice rows read', D.inv.length ? 'Passed' : 'Error', D.inv.length, o.invFile || '');
  A(
    'BMW invoices kept',
    inv.length ? 'Passed' : 'Error',
    inv.length,
    `${nb} non-BMW rows skipped${ne ? `; ${ne} Bajaj EW rows skipped (tick the option to include)` : ''}`
  );
  W(
    'Duplicate invoice rows ignored',
    dupI.length,
    dupI.slice(0, 10).map((x) => x.txt).join(', ')
  );
  W(
    'Invoices with missing/unreadable date',
    inv.filter((i) => !i.date).length,
    'Age shows 0 and they drop out of period filters'
  );
  W('Invoices without VIN', inv.filter((i) => !i.vin).length, 'Re-bill detection needs VIN');
  W(
    'Zero or negative invoice amount',
    inv.filter((i) => i.amt <= 0).length,
    inv.filter((i) => i.amt <= 0).slice(0, 10).map((i) => i.no).join(', ')
  );
  const ld = inv
    .map((i) => i.date)
    .filter((x): x is Date => Boolean(x))
    .sort((a, b) => b.getTime() - a.getTime())[0];
  W('Report date earlier than latest invoice', ld && ld > rd ? 1 : 0, 'Ages would be negative – fix the report date');

  if (D.hasCm || D.hasDn) {
    W('Credit/debit note duplicates ignored', cmDup, `${cms.length} notes loaded`);
    W(
      'Notes whose invoice is not in the BMW register',
      orphan.length,
      orphan.slice(0, 10).map((x) => x.no).join(', ')
    );
    W(
      'Notes with no invoice reference in Created From',
      noRef.length,
      noRef.slice(0, 10).join(', ')
    );
  }
  if (D.hasTrk) {
    A(
      'Tracker claim rows read',
      tr.length ? 'Passed' : 'Error',
      tr.length,
      `${D.trk.length - tr.length} blank rows skipped`
    );
    W('Duplicate claim rows ignored', cDup);
    W(
      'Claims not matched to a BMW invoice',
      ucl.filter((c) => !c.t).length,
      'Check invoice no. / date range of the DMS export'
    );
    W('Claims matched only via RO / Order no.', roHit, 'Verify these manually');
    W('Claims with no invoice no.', ucl.filter((c) => !c.inv).length);
    W('BMW CN present but credited amount is 0', ucl.filter((c) => c.cn && !c.cred).length);
    W('Credited amount but no BMW CN no.', ucl.filter((c) => !c.cn && c.cred).length);
    W('Approved amount higher than claimed', ucl.filter((c) => c.aamt > c.camt + tol).length);
    W('Claims spanning several invoices', Object.values(sc).filter((s) => s.size > 1).length);
    W(
      `Repeated credit lines ${o.dedupe ? '(counted once)' : '(counted every time)'}`,
      ucl.filter((c) => c.dupCred).length,
      'Same BMW CN and amount on several claim lines of one invoice'
    );
    A(
      'Invoices with 2+ claims',
      'Info',
      reg.filter((r) => r.ncl > 1).length,
      `2 claims: ${reg.filter((r) => r.ncl === 2).length} · 3 claims: ${
        reg.filter((r) => r.ncl === 3).length
      } · 4+ claims: ${reg.filter((r) => r.ncl > 3).length} – each has its own Excel sheet`
    );
  }
  (D.unmapped || []).forEach((u) =>
    A(`Column not mapped: ${u}`, 'Error', 1, 'Pick it in the mapping dropdowns and regenerate')
  );

  const mo: Record<string, MonthlySummaryRow> = {};
  const ac: Record<string, AccountSummaryRow> = {};
  reg.forEach((r) => {
    const m = (mo[r.mon] = mo[r.mon] || { mon: r.mon, n: 0, amt: 0, cm: 0, cr: 0, net: 0, m2: 0 });
    m.n++;
    m.amt += r.amt;
    m.cm += r.cma;
    m.cr += r.cr;
    m.net += r.net;
    if (r.ncl > 1) m.m2++;

    const a = (ac[r.acc] = ac[r.acc] || {
      acc: r.acc,
      n: 0,
      amt: 0,
      cm: 0,
      dn: 0,
      cr: 0,
      net: 0,
      ok: 0,
      pend: 0,
      rej: 0,
      short: 0,
    });
    a.n++;
    a.amt += r.amt;
    a.cm += r.cma;
    a.dn += r.dna;
    a.cr += r.cr;
    a.net += r.net;
    if (/^Matched|^Reversed/.test(r.rs)) a.ok++;
    else if (/pending|awaiting/.test(r.rs)) a.pend++;
    else if (/rejected/.test(r.rs)) a.rej++;
    else if (/Short/.test(r.rs)) a.short++;
  });

  const cmsX: CmsRow[] = cms.map((c) => {
    const i = by[c.from];
    const d = i ? i.amt - c.amt : '';
    return {
      ...c,
      type: c.dn ? 'Debit Note' : 'Credit Note',
      inReg: i ? 'Yes' : 'No',
      iamt: i?.amt,
      idate: i?.date,
      idiff: d,
      days: i ? dayDiff(c.date, i.date) : '',
      res: !i
        ? 'Invoice not in BMW register'
        : c.dn
          ? 'Debit note raised on invoice'
          : Math.abs(Number(d)) <= tol
            ? 'Full reversal'
            : Number(d) > 0
              ? 'Partial credit'
              : 'Credit exceeds invoice',
    };
  });

  return {
    by,
    aud: AUD,
    reg,
    ex,
    cnl,
    cms: cmsX,
    cld,
    mo: Object.values(mo).sort((a, b) => a.mon.localeCompare(b.mon)),
    ac: Object.values(ac).sort((a, b) => b.net - a.net),
    rd,
  };
}

export type ColumnType = 'n' | 'r' | 'e' | 'd' | 'pill' | undefined;

export interface ClaimsColDef<T = Record<string, unknown>> {
  key: string;
  label: string;
  type?: ColumnType;
  val?: (r: T) => unknown;
  compact?: boolean;
}

const trkCols: ClaimsColDef[] = CLAIMS_FIELDS.trk
  .filter((f) => !['inv', 'cust', 'vin', 'plate', 'ro'].includes(f.key))
  .map((f) => ({
    key: `t_${f.key}`,
    label: f.label,
    type: DT_KEYS.has(f.key) ? 'd' : TX_KEYS.has(f.key) ? undefined : 'n',
    compact: ['claim', 'cstat', 'cdate', 'camt', 'aamt', 'cn', 'cndate', 'cred'].includes(f.key),
  }));

export const CL_COLS: ClaimsColDef[] = [
  { key: 'res', label: 'Result', type: 'pill', compact: true },
  { key: 'split', label: 'Split', compact: true },
  { key: 'dmsno', label: 'DMS Invoice No.', compact: true },
  { key: 'dmsdate', label: 'DMS Inv Date', type: 'd', compact: true },
  { key: 'acc', label: 'BMW Acct', compact: true },
  { key: 'cust', label: 'Customer', compact: true },
  { key: 'vin', label: 'VIN' },
  { key: 'plate', label: 'Plate' },
  { key: 'dmsamt', label: 'DMS Inv Amt', type: 'n', compact: true },
  { key: 't_ro', label: 'RO No' },
  { key: 't_inv', label: 'Tracker Inv No' },
  ...trkCols,
  { key: 'd1', label: 'Tracker Inv − DMS Inv', type: 'n', compact: true },
  { key: 'd2', label: 'Credited − DMS Inv', type: 'n', compact: true },
  { key: 'rem', label: 'Remarks', type: 'r', compact: true },
];

export const REG_COLS: ClaimsColDef<RegisterRow>[] = [
  { key: 'bs', label: 'Billing Status', type: 'pill', compact: true },
  { key: 'rs', label: 'Reconciliation', type: 'pill', compact: true },
  { key: 'ncl', label: '# Claims', type: 'n', compact: true },
  { key: 'date', label: 'Inv Date', type: 'd', compact: true },
  { key: 'no', label: 'Invoice No.', compact: true },
  { key: 'order', label: 'Order / RO' },
  { key: 'cust', label: 'Customer', compact: true },
  { key: 'acc', label: 'BMW Acct', compact: true },
  { key: 'vin', label: 'VIN', compact: true },
  { key: 'plate', label: 'Plate' },
  { key: 'amt', label: 'Invoice Amt', type: 'n', compact: true },
  { key: 'cmno', label: 'DMS CM No.' },
  { key: 'cmd', label: 'CM Date', type: 'd' },
  { key: 'cmamt', label: 'CM Amt', type: 'n', val: (r) => r.cma || '', compact: true },
  { key: 'dnno', label: 'Debit Note' },
  { key: 'dnd', label: 'DN Date', type: 'd' },
  { key: 'dnamt', label: 'DN Amt', type: 'n', val: (r) => r.dna || '', compact: true },
  { key: 'code', label: 'Claim No(s)', compact: true },
  { key: 'cnno', label: 'BMW CN No(s)', compact: true },
  ...(trkCols as ClaimsColDef<RegisterRow>[]),
  { key: 'diff', label: 'Credit−Inv', type: 'n', compact: true },
  { key: 'net', label: 'Net Receivable', type: 'n', compact: true },
  { key: 'dcl', label: 'Days Inv→Claim' },
  { key: 'dcr', label: 'Days Inv→Credit' },
  { key: 'age', label: 'Age', compact: true },
  { key: 'bk', label: 'Bucket', compact: true },
  { key: 'rem', label: 'Auto Remarks', type: 'r' },
  { key: 'flags', label: 'Flags', type: 'r', compact: true },
  { key: 'man', label: 'Manual Remarks', type: 'e', compact: true },
];

export const EX_COLS: ClaimsColDef[] = [
  { key: 'sev', label: 'Severity', type: 'pill' },
  { key: 't', label: 'Exception' },
  { key: 'no', label: 'Invoice No.' },
  { key: 'date', label: 'Inv Date', type: 'd' },
  { key: 'cust', label: 'Customer' },
  { key: 'acc', label: 'Acct' },
  { key: 'amt', label: 'Invoice Amt', type: 'n' },
  { key: 'net', label: 'Net Recv.', type: 'n' },
  { key: 'code', label: 'Claim' },
  { key: 'd', label: 'Detail', type: 'r' },
  { key: 'a', label: 'Suggested Action', type: 'r' },
];

export const CN_COLS: ClaimsColDef[] = [
  { key: 'no', label: 'BMW CN No.' },
  { key: 'date', label: 'CN Date', type: 'd' },
  { key: 'n', label: 'Invoices', type: 'n' },
  { key: 'bill', label: 'Billed', type: 'n' },
  { key: 'cr', label: 'Credited', type: 'n' },
  { key: 'diff', label: 'Difference', type: 'n' },
  { key: 'res', label: 'Result', type: 'pill' },
  { key: 'ca', label: 'Claim Amt', type: 'n' },
  { key: 'ap', label: 'Approved', type: 'n' },
];

export const CM_COLS: ClaimsColDef[] = [
  { key: 'type', label: 'Type', type: 'pill' },
  { key: 'date', label: 'Note Date', type: 'd' },
  { key: 'no', label: 'Note No.' },
  { key: 'name', label: 'Name' },
  { key: 'amt', label: 'Note Amount', type: 'n' },
  { key: 'status', label: 'Status' },
  { key: 'from', label: 'Created From Invoice' },
  { key: 'inReg', label: 'In BMW Register?' },
  { key: 'idate', label: 'Invoice Date', type: 'd' },
  { key: 'iamt', label: 'Invoice Amount', type: 'n' },
  { key: 'idiff', label: 'Invoice − Note', type: 'n' },
  { key: 'days', label: 'Days Inv→Note' },
  { key: 'res', label: 'Result', type: 'pill' },
];

export const MO_COLS: ClaimsColDef[] = [
  { key: 'mon', label: 'Month' },
  { key: 'n', label: 'Invoices', type: 'n' },
  { key: 'amt', label: 'Invoice Value', type: 'n' },
  { key: 'cm', label: 'DMS CM', type: 'n' },
  { key: 'cr', label: 'BMW Credits', type: 'n' },
  { key: 'net', label: 'Net Receivable', type: 'n' },
  { key: 'm2', label: 'With 2+ claims', type: 'n' },
];

export const AC_COLS: ClaimsColDef[] = [
  { key: 'acc', label: 'BMW Account' },
  { key: 'n', label: 'Invoices', type: 'n' },
  { key: 'amt', label: 'Invoice Value', type: 'n' },
  { key: 'cm', label: 'DMS CM', type: 'n' },
  { key: 'dn', label: 'Debit Notes', type: 'n' },
  { key: 'cr', label: 'BMW Credits', type: 'n' },
  { key: 'net', label: 'Net Receivable', type: 'n' },
  { key: 'ok', label: 'Matched / reversed', type: 'n' },
  { key: 'pend', label: 'Pending', type: 'n' },
  { key: 'rej', label: 'Rejected', type: 'n' },
  { key: 'short', label: 'Short credit', type: 'n' },
];

export const MC_COLS: ClaimsColDef[] = [
  { key: 'band', label: 'Claims on Invoice' },
  { key: 'grp', label: 'Invoice No.' },
  { key: 'date', label: 'Inv Date', type: 'd' },
  { key: 'cust', label: 'Customer' },
  { key: 'acc', label: 'BMW Acct' },
  { key: 'vin', label: 'VIN' },
  { key: 'amt', label: 'Invoice Amt', type: 'n' },
  { key: 'claim', label: 'Claim No' },
  { key: 'cstat', label: 'Claim Status' },
  { key: 'camt', label: 'Claim Amt', type: 'n' },
  { key: 'aamt', label: 'Approved Amt', type: 'n' },
  { key: 'cn', label: 'BMW CN No' },
  { key: 'cndate', label: 'CN Date', type: 'd' },
  { key: 'cred', label: 'Credited', type: 'n' },
  { key: 'cu', label: 'Credit Counted', type: 'n' },
  { key: 'net', label: 'Net Receivable (per invoice)', type: 'n' },
  { key: 'rec', label: 'Invoice Recon', type: 'pill' },
];

export const MI_COLS: ClaimsColDef[] = [
  { key: 'band', label: 'Claims' },
  { key: 'no', label: 'Invoice No.' },
  { key: 'date', label: 'Inv Date', type: 'd' },
  { key: 'cust', label: 'Customer' },
  { key: 'acc', label: 'BMW Acct' },
  { key: 'vin', label: 'VIN' },
  { key: 'amt', label: 'Invoice Amt', type: 'n' },
  { key: 'ncl', label: '# Claims', type: 'n' },
  { key: 'code', label: 'Claim Nos', type: 'r' },
  { key: 'cst', label: 'Statuses' },
  { key: 'ca', label: 'Claim Amt', type: 'n' },
  { key: 'ap', label: 'Approved Amt', type: 'n' },
  { key: 'cnno', label: 'BMW CN Nos' },
  { key: 'cr', label: 'Credits Counted', type: 'n' },
  { key: 'diff', label: 'Credit−Inv', type: 'n' },
  { key: 'net', label: 'Net Receivable', type: 'n' },
  { key: 'rs', label: 'Reconciliation', type: 'pill' },
  { key: 'flags', label: 'Flags', type: 'r' },
];

export const AU_COLS: ClaimsColDef[] = [
  { key: 'chk', label: 'Audit Check' },
  { key: 'sev', label: 'Result', type: 'pill' },
  { key: 'n', label: 'Count', type: 'n' },
  { key: 'd', label: 'Detail', type: 'r' },
];

export interface MultiClaimLineRow extends Record<string, unknown> {
  gi: number;
  band: string;
  grp: string;
  date: Date | null;
  cust: string;
  acc: string;
  vin: string;
  amt: number | '';
  claim: string;
  cstat: string;
  camt: number;
  aamt: number;
  cn: string;
  cndate: Date | null;
  cred: number;
  cu: number;
  net: number | '';
  rec: string;
}

export function buildMultiClaimRows(
  R: ClaimsReconcileResult,
  regRows: RegisterRow[]
): MultiClaimLineRow[] {
  const list = regRows
    .filter((r) => r.ncl > 1)
    .sort(
      (a, b) =>
        a.ncl - b.ncl ||
        (a.date?.getTime() || 0) - (b.date?.getTime() || 0) ||
        String(a.no).localeCompare(String(b.no))
    );
  const o: MultiClaimLineRow[] = [];
  list.forEach((r, gi) =>
    R.by[r.no].cl.forEach((c, j) =>
      o.push({
        gi,
        band: bandOf(r.ncl),
        grp: r.no,
        date: r.date,
        cust: r.cust,
        acc: r.acc,
        vin: r.vin,
        amt: j ? '' : r.amt,
        claim: c.claim,
        cstat: c.cstat,
        camt: c.camt,
        aamt: c.aamt,
        cn: c.cn,
        cndate: c.cndate,
        cred: c.cred,
        cu: c.cu,
        net: j ? '' : r.net,
        rec: j ? '' : r.rs,
      })
    )
  );
  return o;
}

export function buildAccountSummaryRows(regRows: RegisterRow[]): AccountSummaryRow[] {
  const m: Record<string, AccountSummaryRow> = {};
  regRows.forEach((r) => {
    const a = (m[r.acc] = m[r.acc] || {
      acc: r.acc,
      n: 0,
      amt: 0,
      cm: 0,
      dn: 0,
      cr: 0,
      net: 0,
      ok: 0,
      pend: 0,
      rej: 0,
      short: 0,
    });
    a.n++;
    a.amt += r.amt;
    a.cm += r.cma;
    a.dn += r.dna;
    a.cr += r.cr;
    a.net += r.net;
    if (/^Matched|^Reversed/.test(r.rs)) a.ok++;
    else if (/pending|awaiting/.test(r.rs)) a.pend++;
    else if (/rejected/.test(r.rs)) a.rej++;
    else if (/Short/.test(r.rs)) a.short++;
  });
  return Object.values(m).sort((a, b) => b.net - a.net);
}

export function buildMonthlySummaryRows(regRows: RegisterRow[]): MonthlySummaryRow[] {
  const mo: Record<string, MonthlySummaryRow> = {};
  regRows.forEach((r) => {
    const m = (mo[r.mon] = mo[r.mon] || {
      mon: r.mon,
      n: 0,
      amt: 0,
      cm: 0,
      cr: 0,
      net: 0,
      m2: 0,
    });
    m.n++;
    m.amt += r.amt;
    m.cm += r.cma;
    m.cr += r.cr;
    m.net += r.net;
    if (r.ncl > 1) m.m2++;
  });
  return Object.values(mo).sort((a, b) => a.mon.localeCompare(b.mon));
}

export type PillTone = 'g' | 'w' | 'b' | 'i' | 'n' | 'p';

export function getPillTone(s: string): PillTone {
  return /Matched|Reversed|Credit Note Passed|Full reversal|^Passed/.test(s)
    ? 'g'
    : /Short|rejected|High|Debit|Double|no claim|not in|mismatch|exceeds|^Error/i.test(s)
      ? 'b'
      : /pending|awaiting|Excess|Partial|Medium|no credit|^Warning/.test(s)
        ? 'w'
        : /Invoiced/.test(s)
          ? 'n'
          : 'i';
}

const ARGB: Record<PillTone, string> = {
  g: 'FFDFF3E6',
  w: 'FFFDF0CC',
  b: 'FFFBDFE2',
  i: 'FFDDE9F6',
  n: 'FFE8ECF0',
  p: 'FFECE4F5',
};

const ud = (v: unknown) =>
  v instanceof Date ? new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate())) : v;

export interface SheetExportSpec {
  n: string;
  d: Array<Record<string, unknown>>;
  c: ClaimsColDef<any>[];
  freeze?: number;
  tab?: string;
  grp?: (r: any) => number;
}

export type PeriodFilter = RecoPeriodFilter;

export function isDateInPeriod(d: Date | null | undefined, P: PeriodFilter): boolean {
  return isDateKeyInRecoPeriod(localDateToKey(d), P);
}

export function buildAllClaimSheets(
  R: ClaimsReconcileResult,
  P: PeriodFilter
): SheetExportSpec[] {
  const r = R.reg.filter((x) => isDateInPeriod(x.date, P));
  const ex = R.ex.filter((x) => isDateInPeriod(x.date, P));
  const cld = R.cld.filter((x) => isDateInPeriod(x.fd, P));
  const nt = R.cms.filter((x) => isDateInPeriod(x.date, P));
  const cnl = R.cnl.filter((x) => isDateInPeriod(x.date, P));
  const mc = buildMultiClaimRows(R, r);
  const cf: Record<string, number> = {};
  nt.forEach((x) => {
    if (x.inReg === 'Yes') cf[x.from] = (cf[x.from] || 0) + 1;
  });

  const bands = ['2 claims', '3 claims', '4+ claims'];
  const mi = r
    .filter((x) => x.ncl > 1)
    .sort((a, b) => a.ncl - b.ncl || (a.date?.getTime() || 0) - (b.date?.getTime() || 0));

  const sm = (arr: Array<Record<string, unknown>>, k: string) =>
    arr.reduce((s, x) => s + (Number(x[k]) || 0), 0);
  const cnt = (arr: Array<Record<string, unknown>>, k: string) =>
    arr.reduce<Record<string, number>>((m, x) => {
      const val = String(x[k] ?? '');
      m[val] = (m[val] || 0) + 1;
      return m;
    }, {});

  const periodBounds = resolveRecoPeriodBounds(P);
  const sumRows: Array<[string, string | number]> = [
    ['Report date', fmtD(R.rd)],
    [
      'Period filter',
      periodBounds.isFiltered ? `${periodBounds.label} (${periodBounds.rangeText})` : 'All dates',
    ],
    ['BMW invoices', r.length],
    ['Invoice value', sm(r, 'amt')],
    ['DMS credit memos', sm(r, 'cma')],
    ['Debit notes', sm(r, 'dna')],
    ['BMW credits received', sm(r, 'cr')],
    ['Net receivable', sm(r, 'net')],
    ['Exceptions', ex.length],
    ['Invoices with 2 claims', r.filter((x) => x.ncl === 2).length],
    ['Invoices with 3 claims', r.filter((x) => x.ncl === 3).length],
    ['Invoices with 4+ claims', r.filter((x) => x.ncl > 3).length],
    ...Object.entries(cnt(r, 'bs')).map(([k, v]): [string, number] => [`Billing: ${k}`, v]),
    ...Object.entries(cnt(r, 'rs')).map(([k, v]): [string, number] => [`Recon: ${k}`, v]),
  ];
  const sum: Array<{ k: string; v: string | number }> = sumRows.map(([k, v]) => ({ k, v }));

  const multi: SheetExportSpec[] = [
    { n: 'Multi-Claim Invoices', d: mi, c: MI_COLS, tab: 'FFE8A33D' },
    { n: 'Multi-Claim (all lines)', d: mc, c: MC_COLS, grp: (x: MultiClaimLineRow) => x.gi, tab: 'FFE8A33D' },
    ...bands.map((b) => ({
      n: `Invoices - ${b.replace('claims', 'Claims')}`,
      d: mc.filter((x) => x.band === b),
      c: MC_COLS,
      grp: (x: MultiClaimLineRow) => x.gi,
      tab: 'FFE8A33D',
    })),
  ];

  return [
    {
      n: 'Summary',
      d: sum,
      c: [
        { key: 'k', label: 'Metric' },
        { key: 'v', label: 'Value' },
      ],
    },
    { n: 'BMW Register', d: r, c: REG_COLS, freeze: 5 },
    { n: 'WTY Claims vs DMS', d: cld, c: CL_COLS, freeze: 4 },
    ...multi,
    {
      n: 'Multi Credit-Debit Notes',
      d: nt.filter((x) => cf[x.from] > 1).sort((a, b) => String(a.from).localeCompare(String(b.from))),
      c: CM_COLS,
    },
    { n: 'DMS vs Credit-Debit Notes', d: nt, c: CM_COLS },
    { n: 'Exceptions', d: ex, c: EX_COLS },
    { n: 'BMW CN Recon', d: cnl, c: CN_COLS },
    { n: 'By Account', d: buildAccountSummaryRows(r), c: AC_COLS },
    { n: 'Monthly', d: buildMonthlySummaryRows(r), c: MO_COLS },
    { n: 'Audit', d: R.aud, c: AU_COLS },
  ];
}

export async function buildClaimsWorkbookBuffer(specs: SheetExportSpec[]): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'BMW Claims Reconciler';
  specs.forEach((s) => {
    const ws = wb.addWorksheet(s.n.slice(0, 31), {
      views: [{ state: 'frozen', ySplit: 1, xSplit: s.freeze || 0 }],
    });
    if (s.tab) ws.properties.tabColor = { argb: s.tab };
    ws.columns = s.c.map((c) => ({
      header: c.label,
      key: c.key,
      width:
        c.type === 'r'
          ? 60
          : c.type === 'n'
            ? 15
            : c.type === 'd'
              ? 13
              : Math.max(13, Math.min(32, c.label.length + 4)),
    }));
    s.d.forEach((r) => {
      const o: Record<string, unknown> = {};
      s.c.forEach((c) => {
        const v = c.val ? c.val(r) : r[c.key];
        o[c.key] = ud(v) ?? '';
      });
      const row = ws.addRow(o);
      if (s.grp && s.grp(r) % 2) {
        row.eachCell({ includeEmpty: true }, (x) => {
          x.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F4F8' } };
        });
      }
    });
    s.c.forEach((c, i) => {
      const col = ws.getColumn(i + 1);
      if (c.type === 'n') col.numFmt = '#,##0.00';
      else if (c.type === 'd') col.numFmt = 'dd-mm-yyyy';
      else if (c.type === 'r') col.alignment = { wrapText: true, vertical: 'top' };
      if (c.type === 'pill') {
        s.d.forEach((_r, j) => {
          const x = ws.getRow(j + 2).getCell(i + 1);
          if (x.value) {
            x.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: ARGB[getPillTone(String(x.value))] },
            };
          }
        });
      }
    });
    const h = ws.getRow(1);
    h.height = 22;
    h.eachCell((x) => {
      x.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      x.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF14293F' } };
      x.alignment = { vertical: 'middle', wrapText: true };
    });
    if (s.d.length) {
      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: s.c.length } };
      if (s.c.some((c) => c.type === 'n')) {
        const n = s.d.length;
        const tr = ws.getRow(n + 2);
        tr.getCell(1).value = `Total (${n})`;
        s.c.forEach((c, i) => {
          if (c.type !== 'n') return;
          const L = ws.getColumn(i + 1).letter;
          const res = s.d.reduce((a, r) => a + (Number(c.val ? c.val(r) : r[c.key]) || 0), 0);
          tr.getCell(i + 1).value = {
            formula: `SUBTOTAL(109,${L}2:${L}${n + 1})`,
            result: res,
          };
        });
        tr.eachCell({ includeEmpty: true }, (x) => {
          x.font = { bold: true };
          x.border = { top: { style: 'medium' } };
        });
      }
    } else {
      ws.getRow(2).getCell(1).value = 'No rows in this selection';
    }
  });
  const buf = await wb.xlsx.writeBuffer();
  return buf as ArrayBuffer;
}

export function buildClaimsCsv(
  data: Array<Record<string, unknown>>,
  cols: ClaimsColDef<any>[]
): string {
  const rows = data.map((r) => {
    const o: Record<string, unknown> = {};
    cols.forEach((c) => {
      const v = c.val ? c.val(r) : r[c.key];
      o[c.label] = v instanceof Date ? fmtD(v) : v;
    });
    return o;
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  return `\ufeff${XLSX.utils.sheet_to_csv(ws)}`;
}
