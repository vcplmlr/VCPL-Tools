import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import {
  RecoPeriodFilter,
  isDateKeyInRecoPeriod,
  isoToDateKey,
  localDateToKey,
  resolveRecoPeriodBounds,
} from './recoPeriodFilter';

export interface BmwVendorLine {
  doc: string;
  ref: string;
  as: string;
  typ: string;
  pd: Date | null;
  dd: Date | null;
  amt: number;
  tx: string;
}

export interface BmwVendorParsed {
  open: number;
  close: number | null;
  openDate: Date | null;
  closeDate: Date | null;
  lines: BmwVendorLine[];
}

export interface TallyVoucherItem {
  d: Date;
  acc: string;
  type: string;
  no: string;
  dr: number;
  cr: number;
  amt: number;
}

export interface TallyLedgerParsed {
  name: string;
  open: number;
  closeStated: number | null;
  items: TallyVoucherItem[];
}

export interface WarrantyClaimRow {
  claim: string;
  inv: string;
  cred: number;
  camt: number;
  appr: number;
  cn: string;
  cd: Date | null;
  vin: string;
  ia: number;
  st: string;
}

export interface VendorLedgerRecoOptions {
  tol: number;
  win: number;
  pw: number;
}

export type CellVal = string | number;

export interface VendorLedgerRecoResult {
  cons: CellVal[][];
  tie: number;
  opn: CellVal[][];
  mon: CellVal[][];
  typ: CellVal[][];
  tds: CellVal[][];
  age: CellVal[][];
  dup: CellVal[][];
  pay: CellVal[][];
  rec: CellVal[][];
  bOpen: number;
  tOpen: number;
  bClose: number;
  tClose: number;
  br: [string, number][];
  expl: number;
  tgt: number;
  unexp: number;
  ledg: CellVal[][];
  bint: number;
  rowsB: CellVal[][];
  rowsT: CellVal[][];
  cc: CellVal[][];
  cnt: {
    bd: number;
    bp: number;
    td: number;
    mat: number;
    claimOk: number;
    claimBad: number;
  };
  meta: {
    B: BmwVendorParsed;
    TL: number;
    CL: number;
  };
  dateKeys: {
    rowsB: Array<number | null>;
    rowsT: Array<number | null>;
    cc: Array<number | null>;
    tds: Array<number | null>;
    pay: Array<number | null>;
    rec: Array<number | null>;
  };
}

export const S = (v: unknown): string => (v == null ? '' : String(v).trim());
export const K = (s: unknown): string => S(s).toUpperCase().replace(/[^A-Z0-9]/g, '');
export const R2 = (x: number): number => Math.round(x * 100) / 100;
export const num = (v: unknown): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = parseFloat(S(v).replace(/[,₹\s]/g, ''));
  return Number.isNaN(n) ? 0 : n;
};

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

export function toD(v: unknown): Date | null {
  if (v == null || v === '') return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    const u = new Date(Math.round((v - 25569) * 864e5));
    return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate());
  }
  const s = S(v);
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{1,2})[-\/. ]([A-Za-z]{3})[a-z]*[-\/. ](\d{2,4})$/);
  if (m && MON[m[2].toLowerCase()] !== undefined) {
    return new Date(m[3].length === 2 ? 2000 + +m[3] : +m[3], MON[m[2].toLowerCase()], +m[1]);
  }
  m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  return null;
}

const dd = (a: Date | null, b: Date | null): number =>
  a && b ? Math.round((a.getTime() - b.getTime()) / 864e5) : 9999;

const ci = (h: string[], re: RegExp): number => h.findIndex((x) => re.test(x));

export const fmtINR = (n: unknown): string => {
  if (n == null || n === '') return '';
  if (typeof n !== 'number') return String(n);
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const fd = (d: Date | null): string =>
  d ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '';

export async function readWorkbookRawSheets(file: File): Promise<Array<{ name: string; rows: unknown[][] }>> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  return wb.SheetNames.map((name) => ({
    name,
    rows: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: '' }) as unknown[][],
  }));
}

export function parseBmwVendor(rows: unknown[][]): BmwVendorParsed | null {
  const hi = rows.findIndex(
    (r) => r.some((c) => /^reference$/i.test(S(c))) && r.some((c) => /amount/i.test(S(c)))
  );
  if (hi < 0) return null;
  const h = rows[hi].map(S);
  const c = {
    ref: ci(h, /^reference$/i),
    as: ci(h, /^assignment/i),
    typ: ci(h, /^typ/i),
    pd: ci(h, /^(pstng|posting) date/i),
    dd: ci(h, /^(doc\. ?date|document date)/i),
    amt: ci(h, /amount/i),
    doc: ci(h, /^document ?no/i),
    tx: ci(h, /^text$/i),
  };
  const o: BmwVendorParsed = { open: 0, close: null, openDate: null, closeDate: null, lines: [] };
  for (const r of rows.slice(hi + 1)) {
    const ref = c.ref >= 0 ? S(r[c.ref]) : '';
    const amtRaw = c.amt >= 0 ? r[c.amt] : '';
    const pdDate = c.pd >= 0 ? toD(r[c.pd]) : null;
    const ddDate = c.dd >= 0 ? toD(r[c.dd]) : null;
    if (/opening balance/i.test(ref)) {
      o.open = num(amtRaw);
      o.openDate = ddDate || pdDate;
      continue;
    }
    if (/closing balance/i.test(ref)) {
      o.close = num(amtRaw);
      o.closeDate = ddDate || pdDate;
      continue;
    }
    if (S(amtRaw) === '') continue;
    const typ = c.typ >= 0 ? S(r[c.typ]).toUpperCase() : '';
    o.lines.push({
      doc: c.doc >= 0 ? S(r[c.doc]) : '',
      ref: ref || (typ === 'KZ' ? 'Payment' : '(no reference)'),
      as: c.as >= 0 ? S(r[c.as]) : '',
      typ,
      pd: pdDate,
      dd: ddDate,
      amt: num(amtRaw),
      tx: c.tx >= 0 ? S(r[c.tx]) : '',
    });
  }
  return o;
}

export function parseTallyVendor(rows: unknown[][], fallbackName: string): TallyLedgerParsed | null {
  const hi = rows.findIndex(
    (r) => r.some((c) => /^vch no/i.test(S(c))) && r.some((c) => /^debit/i.test(S(c)))
  );
  if (hi < 0) return null;
  const h = rows[hi].map(S);
  const c = {
    d: ci(h, /^date/i),
    p: ci(h, /^particulars/i),
    t: ci(h, /vch type/i),
    n: ci(h, /^vch no/i),
    dr: ci(h, /^debit/i),
    cr: ci(h, /^credit/i),
  };
  let name = fallbackName;
  for (const r of rows.slice(0, hi)) {
    if (/BMW/i.test(S(r[0]))) {
      name = S(r[0]);
      break;
    }
  }
  const L: TallyLedgerParsed = { name, open: 0, closeStated: null, items: [] };
  for (const r of rows.slice(hi + 1)) {
    const side = c.p >= 0 ? S(r[c.p]) : '';
    const acc = c.p >= 0 ? S(r[c.p + 1]) : '';
    const dr = c.dr >= 0 ? num(r[c.dr]) : 0;
    const cr = c.cr >= 0 ? num(r[c.cr]) : 0;
    if (/^opening balance/i.test(acc)) {
      L.open = dr - cr;
      continue;
    }
    if (/^closing balance/i.test(acc)) {
      L.closeStated = (/^cr/i.test(side) ? -1 : 1) * (dr + cr);
      continue;
    }
    const d = c.d >= 0 ? toD(r[c.d]) : null;
    const no = c.n >= 0 ? S(r[c.n]) : '';
    if (d && no) {
      L.items.push({
        d,
        acc,
        type: c.t >= 0 ? S(r[c.t]) : '',
        no,
        dr,
        cr,
        amt: dr - cr,
      });
    }
  }
  return L;
}

export function parseClaimsVendor(rows: unknown[][]): WarrantyClaimRow[] {
  const hi = rows.findIndex((r) => r.some((c) => /^claim (no|number|code)/i.test(S(c))));
  if (hi < 0) return [];
  const h = rows[hi].map(S);
  const ic = ci(h, /^claim (no|number|code)/i);
  const iv = h.map((x, i) => (/invoice no|inv no/i.test(x) ? i : -1)).filter((i) => i >= 0);
  const c = {
    cr: ci(h, /^(total )?credited$/i),
    ca: ci(h, /^(total )?claim (amount|amt)/i),
    ap: ci(h, /^(total )?approved/i),
    cn: ci(h, /^bmw (credit note|cn)/i),
    cd: ci(h, /^(bmw )?(credit|cn) date/i),
    vin: ci(h, /^vin/i),
    ia: ci(h, /^(dms )?inv(oice)? amt/i),
    st: ci(h, /claim status|^status/i),
  };
  return rows
    .slice(hi + 1)
    .filter((r) => ic >= 0 && S(r[ic]))
    .map((r) => ({
      claim: S(r[ic]),
      inv: iv.map((i) => S(r[i])).find((x) => x) || '',
      cred: c.cr >= 0 ? num(r[c.cr]) : 0,
      camt: c.ca >= 0 ? num(r[c.ca]) : 0,
      appr: c.ap >= 0 ? num(r[c.ap]) : 0,
      cn: c.cn >= 0 ? S(r[c.cn]) : '',
      cd: c.cd >= 0 ? toD(r[c.cd]) : null,
      vin: c.vin >= 0 ? S(r[c.vin]) : '',
      ia: c.ia >= 0 ? num(r[c.ia]) : 0,
      st: c.st >= 0 ? S(r[c.st]) : '',
    }));
}

interface BmwGroup {
  key: string;
  ref: string;
  as: string;
  pd: Date | null;
  dd: Date | null;
  gross: number;
  tds: number;
  typSet: Set<string>;
  typ: string;
  kind: 'prior' | 'tdsonly' | 'doc';
  tx: string;
  n: number;
  grp?: MatchGroup;
}

interface BmwPayment {
  ref: string;
  as: string;
  pd: Date | null;
  r: number;
  typ: 'Payment';
  tx: string;
  pay: 1;
  m?: TallyGroup[];
  tt?: number;
  diff?: number;
}

interface TallyGroup {
  key: string;
  no: string;
  type: string;
  d: Date;
  amt: number;
  leds: Set<string>;
  kind: 'pay' | 'cn' | 'doc';
  acc: string;
  grp?: MatchGroup;
  rev?: 1;
  pg?: BmwPayment;
}

interface MatchGroup {
  tier: string;
  b: BmwGroup[];
  t: TallyGroup[];
  bg: number;
  tt: number;
  diff: number;
  st: string;
}

function subset(c: Array<{ t: TallyGroup; v: number }>, t: number, tol: number, mk: number): number[] | null {
  let res: number[] | null = null;
  function go(i: number, k: number, s: number, p: number[]) {
    if (res) return;
    if (k > 1 && Math.abs(s - t) <= tol) {
      res = p.slice();
      return;
    }
    if (k >= mk) return;
    for (let j = i; j < c.length && !res; j++) {
      p.push(j);
      go(j + 1, k + 1, s + c[j].v, p);
      p.pop();
    }
  }
  go(0, 0, 0, []);
  return res;
}

export function reconcileVendorLedger(
  B: BmwVendorParsed,
  TL: TallyLedgerParsed[],
  CL: WarrantyClaimRow[],
  o: VendorLedgerRecoOptions
): VendorLedgerRecoResult {
  const tol = o.tol;
  const cm = new Map<string, WarrantyClaimRow[]>();
  for (const x of CL) {
    const k = K(x.claim);
    const a = cm.get(k) || [];
    if (!a.some((y) => K(y.inv) === K(x.inv) && K(y.cn) === K(x.cn))) a.push(x);
    cm.set(k, a);
  }

  const od = B.openDate;
  const bOpen = -B.open;

  /* BMW groups */
  const G = new Map<string, BmwGroup>();
  const BP: BmwPayment[] = [];
  for (const l of B.lines) {
    const r = -l.amt;
    if (l.typ === 'KZ' || /^payment$/i.test(l.ref)) {
      BP.push({ ref: l.ref, as: l.as, pd: l.pd, r, typ: 'Payment', tx: l.tx, pay: 1 });
      continue;
    }
    const key = K(l.ref) + (/accrual/i.test(l.ref) ? '|' + K(l.as) : '');
    let g = G.get(key);
    if (!g) {
      g = {
        key,
        ref: l.ref,
        as: l.as,
        pd: l.pd,
        dd: l.dd,
        gross: 0,
        tds: 0,
        typSet: new Set<string>(),
        typ: '',
        kind: 'doc',
        tx: l.tx,
        n: 0,
      };
      G.set(key, g);
    }
    if (l.typ === 'TDS') g.tds += r;
    else {
      g.gross += r;
      if (l.typ) g.typSet.add(l.typ);
    }
    g.n++;
  }
  const BD = [...G.values()];
  BD.forEach((g) => {
    g.typ = [...g.typSet].join('/') || 'TDS';
    g.kind = g.dd && od && g.dd.getTime() < od.getTime() ? 'prior' : g.gross === 0 ? 'tdsonly' : 'doc';
  });

  /* Tally groups */
  const TG = new Map<string, TallyGroup>();
  for (const L of TL) {
    for (const it of L.items) {
      const pay = /receipt|payment/i.test(it.type);
      const key = K(it.no);
      let t = TG.get(key);
      if (!t) {
        t = {
          key,
          no: it.no,
          type: it.type,
          d: it.d,
          amt: 0,
          leds: new Set<string>(),
          kind: pay ? 'pay' : /credit note/i.test(it.type) ? 'cn' : 'doc',
          acc: it.acc,
        };
        TG.set(key, t);
      }
      t.amt += it.amt;
      t.leds.add(L.name);
    }
  }
  const TD = [...TG.values()];

  /* doc matching: voucher no → claim code → amount/date */
  const grps: MatchGroup[] = [];
  const mkGrp = (tier: string): MatchGroup => {
    const g: MatchGroup = { tier, b: [], t: [], bg: 0, tt: 0, diff: 0, st: '' };
    grps.push(g);
    return g;
  };
  for (const g of BD) {
    const t = TG.get(g.key);
    if (t && t.kind !== 'pay') {
      t.grp = t.grp || mkGrp('Voucher no = BMW reference');
      if (!t.grp.t.includes(t)) t.grp.t.push(t);
      t.grp.b.push(g);
      g.grp = t.grp;
    }
  }
  for (const g of BD) {
    if (g.grp) continue;
    const cl = cm.get(K(g.ref));
    if (!cl) continue;
    for (const x of cl) {
      const t = x.inv ? TG.get(K(x.inv)) : undefined;
      if (t && t.kind !== 'pay') {
        t.grp = t.grp || mkGrp('Claim code → invoice');
        if (!t.grp.t.includes(t)) t.grp.t.push(t);
        t.grp.b.push(g);
        g.grp = t.grp;
        break;
      }
    }
  }
  for (const g of BD.filter((x) => !x.grp && x.kind === 'doc' && x.gross > 0).sort(
    (a, b) => (a.pd?.getTime() ?? 0) - (b.pd?.getTime() ?? 0)
  )) {
    let best: TallyGroup | null = null;
    let bdDist = 1e9;
    for (const t of TD) {
      if (t.grp || t.kind !== 'doc' || Math.abs(t.amt - g.gross) > tol) continue;
      const d = Math.abs(dd(g.pd, t.d));
      if (d <= o.win && d < bdDist) {
        best = t;
        bdDist = d;
      }
    }
    if (best) {
      const q = mkGrp('Probable: amount + date');
      q.t.push(best);
      q.b.push(g);
      best.grp = g.grp = q;
    }
  }
  for (const q of grps) {
    q.bg = R2(q.b.reduce((s, x) => s + x.gross, 0));
    q.tt = R2(q.t.reduce((s, x) => s + x.amt, 0));
    q.diff = R2(q.bg - q.tt);
    q.st =
      Math.abs(q.diff) <= 0.005
        ? 'Matched'
        : Math.abs(q.diff) <= tol
          ? 'Matched – rounding diff'
          : 'Amount difference';
    if (q.tier.startsWith('Prob')) q.st = 'Probable match';
  }

  /* reversals inside Tally */
  const un = TD.filter((t) => !t.grp && t.kind === 'doc');
  for (const c of TD.filter((t) => !t.grp && t.kind === 'cn')) {
    const m = un.find(
      (t) => !t.rev && Math.abs(t.amt + c.amt) <= 0.5 && t.d.getTime() <= c.d.getTime()
    );
    if (m) {
      m.rev = 1;
      c.rev = 1;
    }
  }

  /* payments */
  const TP = TD.filter((t) => t.kind === 'pay');
  for (const p of BP) {
    const a = -p.r;
    const cand = TP.filter((t) => !t.pg && Math.abs(dd(p.pd, t.d)) <= o.pw).sort(
      (x, y) => Math.abs(dd(p.pd, x.d)) - Math.abs(dd(p.pd, y.d))
    );
    let m = cand.filter((t) => Math.abs(-t.amt - a) <= tol).slice(0, 1);
    if (!m.length && cand.length > 1) {
      const c2 = cand.slice(0, 16).map((t) => ({ t, v: -t.amt }));
      const ix = subset(c2, a, tol, 4);
      if (ix) m = ix.map((i) => c2[i].t);
    }
    if (m.length) {
      m.forEach((t) => {
        t.pg = p;
      });
      p.m = m;
      p.tt = R2(m.reduce((s, t) => s - t.amt, 0));
      p.diff = R2(a - p.tt);
    }
  }

  /* claim check */
  const cc: CellVal[][] = [];
  const ccKeys: Array<number | null> = [];
  const seen = new Set<string>();
  for (const g of BD) {
    const cl = cm.get(K(g.ref));
    if (!cl && !g.typ.includes('KW')) continue;
    seen.add(K(g.ref));
    const cr = R2((cl || []).reduce((s, x) => s + x.cred, 0));
    const inv = [...new Set((cl || []).map((x) => x.inv).filter(Boolean))].join(', ');
    const d = R2(g.gross - cr);
    const intal = g.grp ? 'Yes' : 'No';
    ccKeys.push(localDateToKey(g.pd));
    cc.push([
      g.ref,
      g.as,
      fd(g.pd),
      g.gross,
      cl ? cr : '',
      cl ? d : '',
      inv,
      cl ? cl.reduce((s, x) => s + x.ia, 0) || '' : '',
      cl ? R2(cl.reduce((s, x) => s + x.appr, 0)) : '',
      [...new Set((cl || []).map((x) => x.cn).filter(Boolean))].join(', '),
      intal,
      !cl
        ? 'Claim not in claims file'
        : Math.abs(d) <= tol
          ? 'Claim OK'
          : 'Credit differs from claims file',
    ]);
  }

  const pdsMs = B.lines.map((l) => l.pd?.getTime()).filter((ms): ms is number => ms != null);
  const mn = pdsMs.length ? Math.min(...pdsMs) : Infinity;
  const mx = pdsMs.length ? Math.max(...pdsMs) : -Infinity;
  for (const [k, a] of cm) {
    if (seen.has(k)) continue;
    const cr = R2(a.reduce((s, x) => s + x.cred, 0));
    if (cr > 0 && a.some((x) => x.cd && x.cd.getTime() >= mn && x.cd.getTime() <= mx)) {
      const firstCd = a.find((x) => x.cd != null)?.cd ?? null;
      ccKeys.push(localDateToKey(firstCd));
      cc.push([
        a[0].claim,
        a[0].vin,
        '',
        '',
        cr,
        '',
        [...new Set(a.map((x) => x.inv).filter(Boolean))].join(', '),
        '',
        '',
        [...new Set(a.map((x) => x.cn).filter(Boolean))].join(', '),
        '',
        'In claims file – not in BMW ledger',
      ]);
    }
  }

  /* result rows */
  const stOf = (g: BmwGroup) =>
    g.grp
      ? g.grp.st
      : g.kind === 'prior'
        ? 'Prior-period / accrual item'
        : g.kind === 'tdsonly'
          ? 'TDS only – no parent doc'
          : 'Not in Tally ledgers';
  const rowsB: CellVal[][] = [];
  const rowsBKeys: Array<number | null> = [];
  const rowsT: CellVal[][] = [];
  const rowsTKeys: Array<number | null> = [];
  const clinv = (g: BmwGroup) => {
    const cl = cm.get(K(g.ref));
    return cl ? [...new Set(cl.map((x) => x.inv).filter(Boolean))].join(', ') : '';
  };
  for (const g of BD) {
    rowsBKeys.push(localDateToKey(g.pd));
    rowsB.push([
      stOf(g),
      fd(g.pd),
      g.ref,
      g.as,
      g.typ,
      g.gross,
      g.tds,
      R2(g.gross + g.tds),
      g.grp ? g.grp.tier : '',
      g.grp ? g.grp.t.map((t) => t.no).join(', ') : '',
      g.grp ? [...new Set(g.grp.t.flatMap((t) => [...t.leds]))].join(', ') : '',
      g.grp ? g.grp.tt : '',
      g.grp ? g.grp.diff : '',
      clinv(g),
      g.tx,
    ]);
  }
  for (const p of BP) {
    const pDiff = p.diff ?? 0;
    const pTt = p.tt ?? 0;
    rowsBKeys.push(localDateToKey(p.pd));
    rowsB.push([
      p.m
        ? Math.abs(pDiff) <= tol
          ? 'Payment matched'
          : 'Payment amount difference'
        : 'Payment not in Tally',
      fd(p.pd),
      p.ref,
      p.as,
      'Payment',
      p.r,
      '',
      p.r,
      p.m ? (p.m.length > 1 ? `${p.m.length} receipts combined` : 'Receipt amount + date') : '',
      p.m ? p.m.map((t) => t.no).join(', ') : '',
      p.m ? [...new Set(p.m.flatMap((t) => [...t.leds]))].join(', ') : '',
      p.m ? -pTt : '',
      p.m ? R2(p.r + pTt) : '',
      '',
      p.tx,
    ]);
  }
  for (const t of TD) {
    let s: string;
    let bmRef = '';
    let ba: CellVal = '';
    let df: CellVal = '';
    if (t.kind === 'pay') {
      s = t.pg
        ? Math.abs(t.pg.diff ?? 0) <= tol
          ? 'Receipt matched'
          : 'Receipt amount difference'
        : 'Receipt not in BMW ledger';
      if (t.pg) {
        bmRef = `${t.pg.ref} ${fd(t.pg.pd)}`;
        ba = t.pg.r;
      }
    } else if (t.grp) {
      s = t.grp.st;
      bmRef = t.grp.b.map((x) => x.ref).join(', ');
      ba = t.grp.bg;
      df = R2(t.grp.bg - t.grp.tt);
    } else {
      s = t.rev ? 'Reversed in Tally (invoice + credit note)' : 'In Tally – not in BMW ledger';
    }
    rowsTKeys.push(localDateToKey(t.d));
    rowsT.push([
      s,
      fd(t.d),
      t.no,
      t.type,
      [...t.leds].join(', '),
      t.amt,
      t.grp ? t.grp.tier : t.pg ? 'Payment link' : '',
      bmRef,
      ba,
      df,
    ]);
  }

  /* bridge */
  const sum = (a: number[]) => R2(a.reduce((s, x) => s + x, 0));
  const tClose = sum(TL.map((L) => L.open + L.items.reduce((s, i) => s + i.amt, 0)));
  const tOpen = sum(TL.map((L) => L.open));
  const bClose = B.close == null ? bOpen + sum(B.lines.map((l) => -l.amt)) : -B.close;
  const br: [string, number][] = [
    ['Opening balance difference (BMW − Tally)', R2(bOpen - tOpen)],
    ['Matched invoices: amount differences', sum(grps.map((q) => q.diff))],
    ['TDS deducted by BMW (Tally to book separately)', sum(BD.map((g) => g.tds))],
    ['BMW documents not in Tally', sum(BD.filter((g) => !g.grp && g.kind === 'doc').map((g) => g.gross))],
    [
      'BMW prior-period / accrual items (not in Tally period)',
      sum(BD.filter((g) => !g.grp && g.kind === 'prior').map((g) => g.gross)),
    ],
    ['BMW payments not in Tally', sum(BP.filter((p) => !p.m).map((p) => p.r))],
    ['Matched payments: amount differences', sum(BP.filter((p) => p.m).map((p) => p.diff ?? 0))],
    ['Tally documents not in BMW', -sum(TD.filter((t) => !t.grp && t.kind !== 'pay').map((t) => t.amt))],
    ['Tally receipts not in BMW', -sum(TD.filter((t) => t.kind === 'pay' && !t.pg).map((t) => t.amt))],
  ];
  const expl = sum(br.map((x) => x[1]));
  const tgt = R2(bClose - tClose);

  const ledg: CellVal[][] = TL.map((L) => {
    const dr = sum(L.items.map((i) => i.dr));
    const cr = sum(L.items.map((i) => i.cr));
    const cl = R2(L.open + dr - cr);
    const its = L.items.map((i) => TG.get(K(i.no))).filter((x): x is TallyGroup => Boolean(x));
    return [
      L.name,
      L.open,
      dr,
      cr,
      cl,
      L.closeStated == null ? '' : L.closeStated,
      L.closeStated == null ? '' : R2(cl - L.closeStated),
      L.items.length,
      its.filter((t) => t.grp || t.pg || t.rev).length,
      R2(
        L.items
          .filter((i) => {
            const t = TG.get(K(i.no));
            return t ? !(t.grp || t.pg || t.rev) : true;
          })
          .reduce((s, i) => s + i.amt, 0)
      ),
    ];
  });
  const bint = R2(bOpen + sum(B.lines.map((l) => -l.amt)) - bClose);
  const inc = (a: number[]) => R2(a.filter((x) => x > 0).reduce((s, x) => s + x, 0));
  const dec = (a: number[]) => R2(a.filter((x) => x < 0).reduce((s, x) => s + x, 0));
  const bm = B.lines.map((l) => -l.amt);
  const tm = TL.flatMap((L) => L.items.map((i) => i.amt));
  const cons: CellVal[][] = [
    ['Opening balance', bOpen, tOpen],
    ['Add: billed / credited / accrued (increases)', inc(bm), inc(tm)],
    ['Less: receipts, TDS, reversals (decreases)', dec(bm), dec(tm)],
    ['Closing balance', bClose, tClose],
  ].map((x) => [...x, R2(Number(x[1]) - Number(x[2]))]);
  const tie = R2(
    Number(cons[3][3]) - Number(cons[0][3]) - Number(cons[1][3]) - Number(cons[2][3])
  );

  const pri = BD.filter((g) => g.kind === 'prior');
  const opn: CellVal[][] = [
    ['BMW opening balance', bOpen],
    ...TL.map((L): CellVal[] => [`Tally opening – ${L.name}`, L.open]),
    ['Tally opening – all ledgers combined', tOpen],
    ['Opening difference (BMW − Tally)', R2(bOpen - tOpen)],
    ['BMW prior-period / accrual documents posted in this period (gross)', sum(pri.map((g) => g.gross))],
    ['…TDS on those documents', sum(pri.map((g) => g.tds))],
  ];

  const num2 = (i: number) => sum(ledg.map((x) => num(x[i])));
  ledg.push([
    'TOTAL – all ledgers',
    num2(1),
    num2(2),
    num2(3),
    num2(4),
    ledg.every((x) => x[5] !== '') ? num2(5) : '',
    ledg.every((x) => x[6] !== '') ? num2(6) : '',
    num2(7),
    num2(8),
    num2(9),
  ]);

  const mo = new Map<string, { a: number; b: number; c: number; d: number }>();
  const mkm = (d: Date | null) =>
    d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : 'n/a';
  const gm = (k: string) => {
    let v = mo.get(k);
    if (!v) {
      v = { a: 0, b: 0, c: 0, d: 0 };
      mo.set(k, v);
    }
    return v;
  };
  B.lines.forEach((l) => {
    const r = -l.amt;
    const m = gm(mkm(l.pd));
    if (r > 0) m.a += r;
    else m.b += r;
  });
  TL.forEach((L) =>
    L.items.forEach((i) => {
      const m = gm(mkm(i.d));
      if (i.amt > 0) m.c += i.amt;
      else m.d += i.amt;
    })
  );
  let cum = R2(bOpen - tOpen);
  const mon: CellVal[][] = [['Opening difference', '', '', '', '', '', '', '', cum]];
  [...mo.keys()].sort().forEach((k) => {
    const m = mo.get(k)!;
    const df = R2(m.a + m.b - m.c - m.d);
    cum = R2(cum + df);
    mon.push([k, R2(m.a), R2(m.b), R2(m.a + m.b), R2(m.c), R2(m.d), R2(m.c + m.d), df, cum]);
  });

  const ty = new Map<string, [string, string, number, number]>();
  B.lines.forEach((l) => {
    const k = `BMW|${l.typ}`;
    const e = ty.get(k) || ['BMW ledger', l.typ, 0, 0];
    e[2]++;
    e[3] = R2(e[3] - l.amt);
    ty.set(k, e);
  });
  TL.forEach((L) =>
    L.items.forEach((i) => {
      const k = `T|${i.type}`;
      const e = ty.get(k) || ['Tally', i.type, 0, 0];
      e[2]++;
      e[3] = R2(e[3] + i.amt);
      ty.set(k, e);
    })
  );
  const typ: CellVal[][] = [...ty.values()].sort((a, b) => (a[0] > b[0] ? 1 : -1));

  const tdsSource = BD.filter((g) => g.tds);
  const tdsKeys: Array<number | null> = tdsSource.map((g) => localDateToKey(g.pd));
  const tds: CellVal[][] = tdsSource.map((g) => [
    stOf(g),
    g.ref,
    fd(g.pd),
    g.gross,
    g.tds,
    R2(g.gross + g.tds),
    g.as,
  ]);

  const asOf = B.closeDate || (pdsMs.length ? new Date(mx) : new Date());
  const BKN = ['0–30 days', '31–60 days', '61–90 days', '91–180 days', 'Over 180 days'];
  const bk = (d: Date | null) => {
    const n = dd(asOf, d);
    return n <= 30 ? 0 : n <= 60 ? 1 : n <= 90 ? 2 : n <= 180 ? 3 : 4;
  };
  const age: [string, number, number, number, number, number][] = BKN.map((n) => [n, 0, 0, 0, 0, 0]);
  BD.filter((g) => !g.grp && g.kind === 'doc').forEach((g) => {
    const a = age[bk(g.pd)];
    a[1]++;
    a[2] = R2(a[2] + g.gross);
  });
  TD.filter((t) => !t.grp && !t.pg && !t.rev).forEach((t) => {
    const a = age[bk(t.d)];
    a[3]++;
    a[4] = R2(a[4] + t.amt);
  });
  age.forEach((a) => {
    a[5] = R2(a[2] - a[4]);
  });

  const dm = new Map<string, BmwGroup[]>();
  BD.filter((g) => g.kind === 'doc' && g.gross > 0 && g.typ.includes('KW') && g.as).forEach((g) => {
    const k = `${g.as}|${g.gross}`;
    const a = dm.get(k) || [];
    a.push(g);
    dm.set(k, a);
  });
  const dup: CellVal[][] = [...dm.values()]
    .filter((a) => a.length > 1)
    .map((a) => [
      'Possible duplicate credit',
      a[0].as,
      a[0].gross,
      a.length,
      a.map((g) => g.ref).join(', '),
      a.map((g) => fd(g.pd)).join(', '),
    ]);

  const pay: CellVal[][] = [];
  const payKeys: Array<number | null> = [];
  rowsB.forEach((x, idx) => {
    if (x[4] === 'Payment') {
      pay.push(x);
      payKeys.push(rowsBKeys[idx]);
    }
  });

  const rec: CellVal[][] = [];
  const recKeys: Array<number | null> = [];
  rowsT.forEach((x, idx) => {
    if (/^Receipt/.test(String(x[0]))) {
      rec.push(x);
      recKeys.push(rowsTKeys[idx]);
    }
  });

  return {
    cons,
    tie,
    opn,
    mon,
    typ,
    tds,
    age,
    dup,
    pay,
    rec,
    bOpen,
    tOpen,
    bClose,
    tClose,
    br,
    expl,
    tgt,
    unexp: R2(tgt - expl),
    ledg,
    bint,
    rowsB,
    rowsT,
    cc,
    cnt: {
      bd: BD.length,
      bp: BP.length,
      td: TD.length,
      mat: rowsB.filter((r) => /^(Matched|Probable|Payment matched)/.test(String(r[0]))).length,
      claimOk: cc.filter((r) => r[11] === 'Claim OK').length,
      claimBad: cc.filter((r) => r[11] !== 'Claim OK').length,
    },
    meta: {
      B,
      TL: TL.length,
      CL: CL.length,
    },
    dateKeys: {
      rowsB: rowsBKeys,
      rowsT: rowsTKeys,
      cc: ccKeys,
      tds: tdsKeys,
      pay: payKeys,
      rec: recKeys,
    },
  };
}

export function filterVendorLedgerResult(
  result: VendorLedgerRecoResult,
  filter: RecoPeriodFilter
): VendorLedgerRecoResult {
  const bounds = resolveRecoPeriodBounds(filter);
  if (!bounds.isFiltered) return result;

  const pickRows = (rows: CellVal[][], keys: Array<number | null>) => {
    const outRows: CellVal[][] = [];
    const outKeys: Array<number | null> = [];
    rows.forEach((r, i) => {
      if (isDateKeyInRecoPeriod(keys[i], filter)) {
        outRows.push(r);
        outKeys.push(keys[i]);
      }
    });
    return { outRows, outKeys };
  };

  const bRes = pickRows(result.rowsB, result.dateKeys.rowsB);
  const tRes = pickRows(result.rowsT, result.dateKeys.rowsT);
  const ccRes = pickRows(result.cc, result.dateKeys.cc);
  const tdsRes = pickRows(result.tds, result.dateKeys.tds);
  const payRes = pickRows(result.pay, result.dateKeys.pay);
  const recRes = pickRows(result.rec, result.dateKeys.rec);

  const monFiltered = result.mon.filter((row) => {
    const mStr = String(row[0] ?? '');
    if (mStr === 'Opening difference') return true;
    const mk = isoToDateKey(`${mStr}-01`);
    if (mk == null) return filter.includeUndated;
    return isDateKeyInRecoPeriod(mk, { ...filter, includeUndated: true });
  });

  return {
    ...result,
    rowsB: bRes.outRows,
    rowsT: tRes.outRows,
    cc: ccRes.outRows,
    tds: tdsRes.outRows,
    pay: payRes.outRows,
    rec: recRes.outRows,
    mon: monFiltered,
    cnt: {
      bd: bRes.outRows.filter((r) => r[4] !== 'Payment').length,
      bp: payRes.outRows.length,
      td: tRes.outRows.length,
      mat: bRes.outRows.filter((r) => /^(Matched|Probable|Payment matched)/.test(String(r[0]))).length,
      claimOk: ccRes.outRows.filter((r) => r[11] === 'Claim OK').length,
      claimBad: ccRes.outRows.filter((r) => r[11] !== 'Claim OK').length,
    },
    dateKeys: {
      rowsB: bRes.outKeys,
      rowsT: tRes.outKeys,
      cc: ccRes.outKeys,
      tds: tdsRes.outKeys,
      pay: payRes.outKeys,
      rec: recRes.outKeys,
    },
  };
}

export const BC_COLS = [
  'Status',
  'Posting date',
  'BMW reference / claim code',
  'Assignment / VIN',
  'Type',
  'BMW gross',
  'BMW TDS',
  'BMW net',
  'Match method',
  'Tally voucher(s)',
  'Tally ledger(s)',
  'Tally amount',
  'Diff (BMW − Tally)',
  'Claim-file invoice',
  'BMW text',
];

export const TC_COLS = [
  'Status',
  'Date',
  'Voucher no',
  'Vch type',
  'Tally ledger(s)',
  'Tally amount (Dr+/Cr−)',
  'Match method',
  'BMW reference',
  'BMW gross',
  'Diff (BMW − Tally)',
];

export const CC_COLS = [
  'Claim code',
  'VIN',
  'Posting date',
  'BMW credit',
  'Claims-file credited',
  'Diff',
  'Invoice no (claims file)',
  'Invoice amount',
  'Approved',
  'BMW credit note',
  'In Tally ledgers?',
  'Claim check',
];

export const MC_COLS = [
  'Month',
  'BMW increases',
  'BMW decreases',
  'BMW net',
  'Tally increases',
  'Tally decreases',
  'Tally net',
  'Month diff',
  'Cumulative diff',
];

export const YC_COLS = ['Source', 'Voucher type', 'Count', 'Net (receivable view)'];

export const AC_COLS = [
  'Age bucket',
  'BMW-only docs',
  'BMW-only amount',
  'Tally-only items',
  'Tally-only amount',
  'Net difference',
];

export const DC_COLS = ['Status', 'Reference', 'Date', 'BMW gross', 'TDS deducted', 'Net', 'Assignment'];

export const UC_COLS = ['Status', 'VIN', 'Amount', 'Count', 'BMW references', 'Dates'];

export const LC_COLS = [
  'Tally ledger',
  'Opening',
  'Debits',
  'Credits',
  'Closing (calc)',
  'Closing (stated)',
  'Calc − stated',
  'Vouchers',
  'Matched',
  'Unmatched amount',
];

export type VendorTabKey = 'b' | 't' | 'c' | 'p' | 'r' | 'm' | 'y' | 'a' | 'd' | 'u';

export const VENDOR_TABS: Record<
  VendorTabKey,
  {
    label: string;
    cols: string[];
    dataKey: keyof Pick<
      VendorLedgerRecoResult,
      'rowsB' | 'rowsT' | 'cc' | 'pay' | 'rec' | 'mon' | 'typ' | 'age' | 'tds' | 'dup'
    >;
    statusCol: number;
  }
> = {
  b: { label: 'BMW ledger → Tally', cols: BC_COLS, dataKey: 'rowsB', statusCol: 0 },
  t: { label: 'Tally → BMW ledger', cols: TC_COLS, dataKey: 'rowsT', statusCol: 0 },
  c: { label: 'Claim-code check', cols: CC_COLS, dataKey: 'cc', statusCol: 11 },
  p: { label: 'BMW payments', cols: BC_COLS, dataKey: 'pay', statusCol: 0 },
  r: { label: 'Tally receipts', cols: TC_COLS, dataKey: 'rec', statusCol: 0 },
  m: { label: 'Monthly reco', cols: MC_COLS, dataKey: 'mon', statusCol: -1 },
  y: { label: 'Type-wise movement', cols: YC_COLS, dataKey: 'typ', statusCol: -1 },
  a: { label: 'Ageing of unmatched', cols: AC_COLS, dataKey: 'age', statusCol: -1 },
  d: { label: 'TDS analysis', cols: DC_COLS, dataKey: 'tds', statusCol: 0 },
  u: { label: 'Possible duplicates', cols: UC_COLS, dataKey: 'dup', statusCol: 0 },
};

const NF = '#,##0.00;[Red]-#,##0.00';
const excelFillForStatus = (v: string) =>
  /^(Matched|Payment matched|Receipt matched|Claim OK|Reversed)/.test(v)
    ? 'FFD9F2E3'
    : /^(Amount|Payment amount|Receipt amount|Credit differs|Probable|Prior|TDS only|Possible)/.test(v)
      ? 'FFFFF0CC'
      : 'FFFAD7D9';

function addWorksheetStyled(
  wb: ExcelJS.Workbook,
  name: string,
  cols: string[],
  rows: CellVal[][],
  statusCol: number | null
) {
  const ws = wb.addWorksheet(name.slice(0, 31), { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.addRow(cols).eachCell((c) => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1C3F94' } };
  });
  rows.forEach((x) => ws.addRow(x.map((v) => (v === '' ? null : v))));
  ws.columns.forEach((c, i) => {
    c.width = Math.min(48, Math.max(12, S(cols[i]).length + 3, i === 0 ? 34 : 0));
  });
  ws.eachRow((row, n) => {
    if (n > 1) {
      row.eachCell((c) => {
        if (typeof c.value === 'number') c.numFmt = NF;
      });
      if (statusCol != null && statusCol >= 0) {
        const c = row.getCell(statusCol + 1);
        c.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: excelFillForStatus(S(c.value)) },
        };
      }
    }
  });
  if (cols.length > 1 && rows.length) {
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  }
}

export async function buildVendorLedgerWorkbookBuffer(
  r: VendorLedgerRecoResult,
  mode: 'full' | 'sum' | 'exc',
  periodLabel?: string
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const consRows: CellVal[][] = periodLabel
    ? [['Active Period / Date Filter', periodLabel, '', ''], ...r.cons]
    : r.cons;
  const sheets: Array<[string, string[], CellVal[][], number | null, number?]> = [
    ['Consolidated Reco', ['Particulars', 'BMW ledger', 'Tally (all ledgers)', 'Difference (BMW − Tally)'], consRows, null, 1],
    ['Opening Reco', ['Particulars', 'Amount (₹)'], r.opn, null, 1],
    [
      'Bridge',
      ['Particulars', 'Amount (₹)'],
      [
        ...r.br,
        ['Total explained', r.expl],
        ['BMW closing − Tally closing', r.tgt],
        ['Unexplained (should be 0.00)', r.unexp],
      ],
      null,
      1,
    ],
    ['Ledger-wise', LC_COLS, r.ledg, null, 1],
    ['Monthly Reco', MC_COLS, r.mon, null, 1],
    ['Type-wise movement', YC_COLS, r.typ, null, 1],
    ['Ageing of unmatched', AC_COLS, r.age, null, 1],
    ['BMW to Tally', BC_COLS, r.rowsB, 0],
    ['Tally to BMW', TC_COLS, r.rowsT, 0],
    ['BMW payments', BC_COLS, r.pay, 0],
    ['Tally receipts', TC_COLS, r.rec, 0],
    ['Claim-code check', CC_COLS, r.cc, 11],
    ['TDS analysis', DC_COLS, r.tds, 0],
    ['Possible duplicates', UC_COLS, r.dup, 0],
    ['Claim exceptions', CC_COLS, r.cc.filter((x) => x[11] !== 'Claim OK'), 11],
    [
      'Exceptions',
      ['Source', ...BC_COLS],
      [
        ...r.rowsB
          .filter((x) => !/^(Matched|Payment matched)/.test(String(x[0])))
          .map((x): CellVal[] => ['BMW ledger', ...x]),
        ...r.rowsT
          .filter((x) => !/^(Matched|Receipt matched|Reversed)/.test(String(x[0])))
          .map((x): CellVal[] => ['Tally', ...x]),
      ],
      1,
    ],
  ];

  const keep = (s: [string, string[], CellVal[][], number | null, number?]) =>
    mode === 'full' ||
    (mode === 'sum' && s[4] === 1) ||
    (mode === 'exc' && /^(Consolidated|Bridge|Exceptions|Claim exc)/.test(s[0]));

  sheets.filter(keep).forEach((s) => addWorksheetStyled(wb, s[0], s[1], s[2], s[3]));
  const buf = await wb.xlsx.writeBuffer();
  return buf as ArrayBuffer;
}

export function buildVendorTabCsv(cols: string[], rows: CellVal[][]): string {
  const all = [cols, ...rows];
  const csv = all.map((r) => r.map((v) => `"${S(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  return `\ufeff${csv}`;
}
