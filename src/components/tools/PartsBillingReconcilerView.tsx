import React, { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  GitCompareArrows,
  RotateCcw,
  Search,
  Sparkles,
  Unlink,
  Upload,
} from 'lucide-react';
import { ToolCatalogItem } from '../../types/tools';
import {
  RecoPeriodFilter,
  createDefaultRecoPeriodFilter,
  extractPeriodChoicesFromKeys,
  isDateKeyInRecoPeriod,
  resolveRecoPeriodBounds,
  utcDateToKey,
} from '../../utils/recoPeriodFilter';
import { FileDropZone } from './FileDropZone';
import { RecoPeriodFilterBar } from './RecoPeriodFilterBar';

interface PartsBillingReconcilerViewProps {
  tool?: ToolCatalogItem;
  onBack?: () => void;
}

interface BmwInvoice {
  ref: string;
  date: Date | null;
  docs: string[];
  gross: number;
  adj: number;
  adjTypes: string[];
  net: number;
  di: string;
}

interface TallyRow {
  i: number;
  date: Date;
  cells: unknown[];
  part: string;
  src?: string;
}

interface ParsedTally {
  hdr: string[];
  rows: TallyRow[];
}

interface TallyAmtRow extends TallyRow {
  amt: number;
  dup?: boolean;
}

type ReconStatus =
  | 'Matched'
  | 'Matched (manual)'
  | 'Matched (by amount)'
  | 'Amount Difference'
  | 'Missing in Tally';

interface ReconciledBmwRow extends BmwInvoice {
  tally: TallyAmtRow | null;
  how: '' | 'Manual' | 'Reference' | 'Amount';
  tAmt?: number;
  dGross?: number;
  dNet?: number;
  status: ReconStatus;
  adjChk: string;
}

interface ReconSummary {
  n: number;
  gross: number;
  adj: number;
  net: number;
  an: number;
  tn: number;
  tt: number;
  m: ReconciledBmwRow[];
  d: ReconciledBmwRow[];
  x: ReconciledBmwRow[];
  mAmt: number;
  dAmt: number;
  xAmt: number;
  eAmt: number;
}

interface ReconcileOutput {
  rows: ReconciledBmwRow[];
  extra: TallyAmtRow[];
  trs: TallyAmtRow[];
  zeroRows: number;
  tallyCount: number;
  tallyTotal: number;
  summary: ReconSummary;
  warnings: string[];
}

type TabKey = 'all' | 'ok' | 'diff' | 'miss' | 'extra' | 'date';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const r2 = (n: number): number => Math.round((+n || 0) * 100) / 100;
const low = (v: unknown): string => String(v == null ? '' : v).trim().toLowerCase();

function toDate(v: unknown): Date | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const d = new Date(v.getTime() + 43200000);
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  }
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    return new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 864e5);
  }
  if (typeof v === 'string' && v.trim()) {
    const m = v
      .trim()
      .match(/^(\d{1,2})[-/. ]([A-Za-z]{3}|\d{1,2})[-/. ](\d{2,4})$/);
    if (m) {
      const mo = Number.isNaN(Number(m[2]))
        ? MONTHS.indexOf(m[2].toLowerCase())
        : Number(m[2]) - 1;
      let y = Number(m[3]);
      if (y < 100) y += 2000;
      if (mo >= 0 && mo <= 11) return new Date(Date.UTC(y, mo, Number(m[1])));
    }
  }
  return null;
}

const dnum = (d: Date | null | undefined): number | null =>
  d ? Math.floor(d.getTime() / 864e5) : null;

const dstr = (d: Date | null | undefined): string =>
  d
    ? String(d.getUTCDate()).padStart(2, '0') +
      '-' +
      String(d.getUTCMonth() + 1).padStart(2, '0') +
      '-' +
      d.getUTCFullYear()
    : '';

function parseNum(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const x = parseFloat(
    String(v == null ? '' : v)
      .replace(/[,₹\s]/g, '')
      .replace(/\((.*)\)/, '-$1')
  );
  return Number.isNaN(x) ? 0 : x;
}

function formatInr(n: number | '' | null | undefined): string {
  if (n == null || n === '') return '';
  return Number(n).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseBmw(aoa: unknown[][]): BmwInvoice[] {
  const h = aoa.findIndex(
    (r) =>
      r.some((c) => low(c) === 'reference') &&
      r.some((c) => low(c).startsWith('amount'))
  );
  if (h < 0) {
    throw new Error('BMW file: header row with "Reference" and "Amount" not found.');
  }
  const H = aoa[h].map(low);
  const ix = (n: string) => H.findIndex((x) => x.startsWith(n));
  const c = {
    ref: ix('reference'),
    doc: ix('doc number'),
    date: ix('post date'),
    type: ix('type'),
    amt: ix('amount'),
  };

  const g = new Map<
    string,
    {
      ref: string;
      date: Date | null;
      docs: string[];
      gross: number;
      adj: number;
      adjTypes: string[];
    }
  >();

  for (const r of aoa.slice(h + 1)) {
    const ref = String(r[c.ref] ?? '').trim();
    if (!ref) continue;
    const amt = c.amt >= 0 ? parseNum(r[c.amt]) : 0;
    const type = c.type >= 0 ? String(r[c.type] ?? '').trim() : '';
    const doc = c.doc >= 0 ? String(r[c.doc] ?? '').trim() : '';
    const dt = c.date >= 0 ? toDate(r[c.date]) : null;

    if (!g.has(ref)) {
      g.set(ref, { ref, date: dt, docs: [], gross: 0, adj: 0, adjTypes: [] });
    }
    const o = g.get(ref)!;
    if (type.toUpperCase() === 'DI') {
      o.gross = r2(o.gross + amt);
      if (doc) o.docs.push(doc);
      if (dt) o.date = dt;
    } else {
      o.adj = r2(o.adj + amt);
      if (type && !o.adjTypes.includes(type)) o.adjTypes.push(type);
      if (doc) o.docs.push(doc);
    }
  }

  return [...g.values()].map((o) => ({
    ...o,
    net: r2(o.gross + o.adj),
    di: o.docs[0] || '',
  }));
}

function parseTally(aoa: unknown[][]): ParsedTally {
  const h = aoa.findIndex(
    (r) =>
      r.some((c) => low(c) === 'date') &&
      r.some((c) => low(c) === 'particulars' || low(c).startsWith('vch'))
  );
  if (h < 0) {
    throw new Error('Tally file: header row with "Date" and "Particulars" not found.');
  }
  const hdr = aoa[h].map((c) => String(c ?? '').trim());
  const partIdx = hdr.findIndex((x) => low(x) === 'particulars');
  const rows: TallyRow[] = [];

  aoa.slice(h + 1).forEach((r, k) => {
    const d = toDate(r[0]);
    if (!d) return;
    rows.push({
      i: k,
      date: d,
      cells: hdr.map((_, j) => r[j] ?? ''),
      part: partIdx >= 0 ? String(r[partIdx] ?? '') : '',
    });
  });

  return { hdr, rows };
}

function getAmtOptions(hdr: string[]): Array<{ v: string; t: string }> {
  const opts: Array<{ v: string; t: string }> = [];
  const di = hdr.findIndex((x) => low(x) === 'debit');
  const ci = hdr.findIndex((x) => low(x) === 'credit');
  if (di >= 0 && ci >= 0) {
    opts.push({ v: 'dc', t: 'Debit + Credit (whichever has value)' });
  }
  hdr.forEach((x, j) => {
    if (/debit|credit|amount|gross|value|total|taxable/i.test(x)) {
      opts.push({ v: String(j), t: x });
    }
  });
  return opts;
}

function getTallyAmt(row: TallyRow, sel: string, hdr: string[]): number {
  if (sel === 'dc') {
    const di = hdr.findIndex((x) => low(x) === 'debit');
    const ci = hdr.findIndex((x) => low(x) === 'credit');
    const dv = di >= 0 ? Math.abs(parseNum(row.cells[di])) : 0;
    const cv = ci >= 0 ? Math.abs(parseNum(row.cells[ci])) : 0;
    return r2(dv + cv);
  }
  return r2(Math.abs(parseNum(row.cells[+sel])));
}

function runReconcile(
  bmw: BmwInvoice[],
  tally: ParsedTally,
  opt: {
    manual: Map<string, number>;
    sel: string;
    flt: string;
    tol: number;
    win: number;
  }
): ReconcileOutput {
  const { hdr } = tally;
  const { tol, win } = opt;
  const flt = low(opt.flt);

  const filtered = tally.rows
    .filter((r) => !flt || low(r.part).includes(flt))
    .map((r) => ({ ...r, amt: getTallyAmt(r, opt.sel, hdr) }));

  const zeroRows = filtered.filter((r) => !r.amt).length;
  const trs: TallyAmtRow[] = filtered.filter((r) => Boolean(r.amt));

  const idx = new Map<string, TallyAmtRow[]>();
  trs.forEach((t) => {
    const toks = new Set(t.cells.join(' ').match(/\d{8,}/g) || []);
    toks.forEach((k) => {
      if (!idx.has(k)) idx.set(k, []);
      idx.get(k)!.push(t);
    });
  });

  const used = new Set<number>();
  opt.manual.forEach((v) => used.add(v));

  const best = (t: TallyAmtRow, g: BmwInvoice) =>
    Math.min(Math.abs(t.amt - g.gross), Math.abs(t.amt - g.net));

  const out: ReconciledBmwRow[] = [];

  for (const g of bmw) {
    let t: TallyAmtRow | null = null;
    let how: '' | 'Manual' | 'Reference' | 'Amount' = '';

    const mi = opt.manual.get(g.ref);
    if (mi != null) {
      const f = trs.find((x) => x.i === mi);
      if (f) {
        t = f;
        how = 'Manual';
      }
    }

    if (!t) {
      for (const k of [g.ref, ...g.docs]) {
        const f = (idx.get(k) || []).find((x) => !used.has(x.i));
        if (f) {
          t = f;
          how = 'Reference';
          break;
        }
      }
    }

    if (!t) {
      let b: TallyAmtRow | null = null;
      let bd = 1e18;
      for (const x of trs) {
        if (used.has(x.i)) continue;
        const e = best(x, g);
        if (e > tol) continue;
        const dd =
          g.date && x.date ? Math.abs((dnum(x.date) ?? 0) - (dnum(g.date) ?? 0)) : 0;
        if (win >= 0 && dd > win) continue;
        if (e + dd / 1000 < bd) {
          bd = e + dd / 1000;
          b = x;
        }
      }
      if (b) {
        t = b;
        how = 'Amount';
      }
    }

    if (t) {
      used.add(t.i);
      const tAmt = t.amt;
      const dGross = r2(t.amt - g.gross);
      const dNet = r2(t.amt - g.net);
      const status: ReconStatus =
        best(t, g) <= tol
          ? how === 'Reference'
            ? 'Matched'
            : how === 'Manual'
            ? 'Matched (manual)'
            : 'Matched (by amount)'
          : 'Amount Difference';
      out.push({
        ...g,
        tally: t,
        how,
        tAmt,
        dGross,
        dNet,
        status,
        adjChk: '',
      });
    } else {
      out.push({
        ...g,
        tally: null,
        how: '',
        status: 'Missing in Tally',
        adjChk: '',
      });
    }
  }

  const rt = out
    .filter((r) => r.adj && r.gross)
    .map((r) => (-r.adj / r.gross) * 100)
    .sort((a, b) => a - b);
  const med = rt.length ? rt[rt.length >> 1] : 0;

  out.forEach((r) => {
    const x = r.gross ? (-r.adj / r.gross) * 100 : 0;
    r.adjChk = !r.adj
      ? '⚠ no adj'
      : (Math.abs(x - med) > 0.005 ? '⚠ ' : '') + x.toFixed(3) + '%';
  });

  const extra = trs.filter((t) => !used.has(t.i));
  const rset = new Set<string>();
  bmw.forEach((g) => {
    rset.add(g.ref);
    g.docs.forEach((d) => rset.add(d));
  });
  extra.forEach((t) => {
    t.dup = (t.cells.join(' ').match(/\d{8,}/g) || []).some((k) => rset.has(k));
  });

  const sum = <T,>(arr: T[], f: (item: T) => number) =>
    r2(arr.reduce((acc, item) => acc + f(item), 0));

  const m = out.filter((r) => r.status.startsWith('Matched'));
  const d = out.filter((r) => r.status === 'Amount Difference');
  const x = out.filter((r) => r.status === 'Missing in Tally');

  const summary: ReconSummary = {
    n: out.length,
    gross: sum(out, (r) => r.gross),
    adj: sum(out, (r) => r.adj),
    net: sum(out, (r) => r.net),
    an: out.filter((r) => r.adjChk.startsWith('⚠')).length,
    tn: trs.length,
    tt: sum(trs, (t) => t.amt),
    m,
    d,
    x,
    mAmt: sum(m, (r) => r.gross),
    dAmt: sum(d, (r) => r.dGross ?? 0),
    xAmt: sum(x, (r) => r.gross),
    eAmt: sum(extra, (t) => t.amt),
  };

  const warnings: string[] = [];
  const bd = bmw.map((r) => dnum(r.date)).filter((n): n is number => n != null);
  const td = tally.rows.map((r) => dnum(r.date)).filter((n): n is number => n != null);
  if (
    bd.length &&
    td.length &&
    (Math.min(...td) > Math.max(...bd) + 31 || Math.max(...td) < Math.min(...bd) - 31)
  ) {
    warnings.push(
      `Tally dates (${dstr(new Date(Math.min(...td) * 864e5))} to ${dstr(
        new Date(Math.max(...td) * 864e5)
      )}) do not overlap the BMW billing period (${dstr(
        new Date(Math.min(...bd) * 864e5)
      )} to ${dstr(new Date(Math.max(...bd) * 864e5))}). Check you exported the right month.`
    );
  }
  if (summary.m.length === 0 && summary.n > 0) {
    warnings.push(
      'Nothing matched. The Tally export must carry the BMW invoice number (Reference like 6130xxxxxx or DI no.) in Particulars / Vch No. / Narration, or the amounts must agree — a sales register will not reconcile with BMW purchase billing. Use the Tally Purchase Register / BMW party ledger with Narration.'
    );
  }
  if (zeroRows) {
    warnings.push(`${zeroRows} Tally rows with zero/blank amount were ignored.`);
  }

  return {
    rows: out,
    extra,
    trs,
    zeroRows,
    tallyCount: trs.length,
    tallyTotal: summary.tt,
    summary,
    warnings,
  };
}

function readAoa(file: File): Promise<unknown[][]> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    fr.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          reject(new Error(`Empty file: ${file.name}`));
          return;
        }
        const wb = XLSX.read(data, { type: 'array', cellDates: true });
        if (!wb.SheetNames.length) {
          reject(new Error(`No sheets found in ${file.name}`));
          return;
        }
        let best: unknown[][] = [];
        wb.SheetNames.forEach((name) => {
          const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], {
            header: 1,
            raw: true,
            defval: '',
            blankrows: false,
          });
          if (aoa.length > best.length) best = aoa;
        });
        resolve(best);
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    };
    fr.readAsArrayBuffer(file);
  });
}

const BMW_HEADERS = [
  'Post Date',
  'BMW Reference',
  'DI Doc No.',
  'Gross (DI)',
  'Adj',
  'Net',
  'Tally Date',
  'Tally Vch No.',
  'Tally Particulars',
  'Tally Amount',
  'Diff vs Gross',
  'Diff vs Net',
  'Match By',
  'Status',
  'Adj % (E5)',
];

const STATUS_PILL: Record<ReconStatus, string> = {
  Matched: 'bg-emerald-100 text-emerald-900 border-emerald-700/40',
  'Matched (manual)': 'bg-emerald-100 text-emerald-900 border-emerald-700/40',
  'Matched (by amount)': 'bg-emerald-100 text-emerald-900 border-emerald-700/40',
  'Amount Difference': 'bg-amber-100 text-amber-900 border-amber-700/40',
  'Missing in Tally': 'bg-rose-100 text-rose-900 border-rose-700/40',
};

export const PartsBillingReconcilerView: React.FC<PartsBillingReconcilerViewProps> = ({
  tool,
}) => {
  const f1Ref = useRef<HTMLInputElement | null>(null);
  const f2Ref = useRef<HTMLInputElement | null>(null);

  const [bmw, setBmw] = useState<BmwInvoice[] | null>(null);
  const [bmwInfo, setBmwInfo] = useState<string>(
    'Columns: Reference, Doc Number, Post Date, Type, Amount INR'
  );
  const [tally, setTally] = useState<ParsedTally | null>(null);
  const [tallyInfo, setTallyInfo] = useState<string>(
    'Select one or more files (purchase register + ledger): Date, Particulars, Vch Type, Vch No., Debit, Credit'
  );
  const [amtOptions, setAmtOptions] = useState<Array<{ v: string; t: string }>>([]);
  const [selAmt, setSelAmt] = useState<string>('');
  const [flt, setFlt] = useState<string>('');
  const [tol, setTol] = useState<string>('1');
  const [win, setWin] = useState<string>('10');
  const [manualLinks, setManualLinks] = useState<Map<string, number>>(() => new Map());
  const [tab, setTab] = useState<TabKey>('all');
  const [search, setSearch] = useState<string>('');
  const [sort, setSort] = useState<{ c: number; d: 1 | -1 }>({ c: -1, d: 1 });
  const [periodFilter, setPeriodFilter] = useState<RecoPeriodFilter>(() =>
    createDefaultRecoPeriodFilter()
  );
  const [errorMsg, setErrorMsg] = useState<string>('');

  const loadBmwFile = async (f: File) => {
    try {
      const parsed = parseBmw(await readAoa(f));
      setBmw(parsed);
      setBmwInfo(`${f.name} — ${parsed.length} invoices`);
      setErrorMsg('');
    } catch (err) {
      setBmw(null);
      setBmwInfo('Columns: Reference, Doc Number, Post Date, Type, Amount INR');
      setErrorMsg(err instanceof Error ? err.message : 'Failed to parse BMW Parts Billing file.');
    }
  };

  const handleLoadBmw = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) await loadBmwFile(f);
  };

  const loadTallyFiles = async (fs: File[]) => {
    if (!fs.length) return;
    try {
      let combined: ParsedTally | null = null;
      for (const f of fs) {
        const parsed = parseTally(await readAoa(f));
        parsed.rows.forEach((r) => {
          r.src = f.name;
        });
        if (!combined) combined = parsed;
        else combined.rows.push(...parsed.rows);
      }
      if (!combined) return;
      combined.rows.forEach((r, idx) => {
        r.i = idx;
      });
      const opts = getAmtOptions(combined.hdr);
      setTally(combined);
      setAmtOptions(opts);
      setSelAmt(opts[0]?.v ?? '');
      setManualLinks(new Map());
      const label = fs.length > 1 ? `${fs.length} files` : fs[0].name;
      setTallyInfo(`${label} — ${combined.rows.length} vouchers`);
      setErrorMsg('');
    } catch (err) {
      setTally(null);
      setAmtOptions([]);
      setSelAmt('');
      setTallyInfo(
        'Select or drop files (purchase register + ledger): Date, Particulars, Vch Type, Vch No., Debit, Credit'
      );
      setErrorMsg(err instanceof Error ? err.message : 'Failed to parse Tally register file.');
    }
  };

  const handleLoadTally = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await loadTallyFiles(Array.from(e.target.files ?? []));
  };

  const availablePeriods = useMemo(() => {
    if (!bmw && !tally) return undefined;
    const keys = [
      ...(bmw ? bmw.map((g) => utcDateToKey(g.date)) : []),
      ...(tally ? tally.rows.map((r) => utcDateToKey(r.date)) : []),
    ];
    return extractPeriodChoicesFromKeys(keys);
  }, [bmw, tally]);

  const filteredInputs = useMemo(() => {
    const fBmw = bmw
      ? bmw.filter((g) => isDateKeyInRecoPeriod(utcDateToKey(g.date), periodFilter))
      : null;
    const fTally = tally
      ? {
          ...tally,
          rows: tally.rows.filter((r) =>
            isDateKeyInRecoPeriod(utcDateToKey(r.date), periodFilter)
          ),
        }
      : null;
    return { fBmw, fTally };
  }, [bmw, tally, periodFilter]);

  const periodBounds = useMemo(() => resolveRecoPeriodBounds(periodFilter), [periodFilter]);

  const res = useMemo<ReconcileOutput | null>(() => {
    if (!filteredInputs.fBmw || !filteredInputs.fTally || !selAmt) return null;
    const tolNum = parseFloat(tol);
    const winNum = win.trim() === '' ? -1 : parseFloat(win);
    return runReconcile(filteredInputs.fBmw, filteredInputs.fTally, {
      manual: manualLinks,
      sel: selAmt,
      flt,
      tol: Number.isFinite(tolNum) ? tolNum : 0,
      win: Number.isFinite(winNum) ? winNum : -1,
    });
  }, [filteredInputs, selAmt, manualLinks, flt, tol, win]);

  const findCol = (prefix: string): number =>
    tally ? tally.hdr.findIndex((x) => low(x).startsWith(prefix)) : -1;

  const bmwLine = (r: ReconciledBmwRow): Array<string | number> => {
    const t = r.tally;
    const vnoIdx = findCol('vch no');
    const vn = t && vnoIdx >= 0 ? String(t.cells[vnoIdx] ?? '') : '';
    return [
      dstr(r.date),
      r.ref,
      r.di,
      r.gross,
      r.adj,
      r.net,
      t ? dstr(t.date) : '',
      vn,
      t ? t.part : '',
      t ? (r.tAmt ?? '') : '',
      t ? (r.dGross ?? '') : '',
      t ? (r.dNet ?? '') : '',
      r.how,
      r.status,
      r.adjChk,
    ];
  };

  const tallyLine = (t: TallyAmtRow): Array<string | number> => {
    const vnoIdx = findCol('vch no');
    const vtypeIdx = findCol('vch type');
    return [
      dstr(t.date),
      vnoIdx >= 0 ? String(t.cells[vnoIdx] ?? '') : '',
      t.part,
      vtypeIdx >= 0 ? String(t.cells[vtypeIdx] ?? '') : '',
      t.amt,
      t.dup ? 'Dup of BMW ref' : '',
      t.src || '',
    ];
  };

  const dateRows = useMemo(() => {
    if (!res) return [];
    const m = new Map<number, { d: Date; bn: number; b: number; tn: number; t: number }>();
    const getBucket = (d: Date) => {
      const k = dnum(d)!;
      if (!m.has(k)) m.set(k, { d, bn: 0, b: 0, tn: 0, t: 0 });
      return m.get(k)!;
    };
    res.rows.forEach((r) => {
      if (!r.date) return;
      const o = getBucket(r.date);
      o.bn++;
      o.b = r2(o.b + r.gross);
    });
    res.trs.forEach((t) => {
      const o = getBucket(t.date);
      o.tn++;
      o.t = r2(o.t + t.amt);
    });
    return [...m.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, o]) => [dstr(o.d), o.bn, o.b, o.tn, o.t, r2(o.t - o.b)]);
  }, [res]);

  const activeTable = useMemo(() => {
    if (!res) return { headers: [] as string[], rows: [] as Array<Array<string | number>>, nc: [] as number[] };
    if (tab === 'date') {
      return {
        headers: ['Date', 'BMW invoices', 'BMW gross', 'Tally vouchers', 'Tally amount', 'Difference'],
        rows: dateRows,
        nc: [2, 4, 5],
      };
    }
    if (tab === 'extra') {
      return {
        headers: ['Date', 'Vch No.', 'Particulars', 'Vch Type', 'Amount', 'Flag', 'Source'],
        rows: res.extra.map(tallyLine),
        nc: [4],
      };
    }
    const filterFn: Record<Exclude<TabKey, 'extra' | 'date'>, (r: ReconciledBmwRow) => boolean> = {
      all: () => true,
      ok: (r) => r.status.startsWith('Matched'),
      diff: (r) => r.status === 'Amount Difference',
      miss: (r) => r.status === 'Missing in Tally',
    };
    const headers = [...BMW_HEADERS];
    const rows = res.rows.filter(filterFn[tab]).map(bmwLine);
    if (tab === 'miss') {
      headers.push('Link manually');
      rows.forEach((r) => r.push('@@' + String(r[1])));
    }
    return { headers, rows, nc: [3, 4, 5, 9, 10, 11] };
  }, [res, tab, dateRows, tally]);

  const filteredAndSortedRows = useMemo(() => {
    const q = low(search);
    let rows = q
      ? activeTable.rows.filter((r) => r.join(' ').toLowerCase().includes(q))
      : activeTable.rows;

    if (sort.c >= 0) {
      const normKey = (x: string | number) =>
        typeof x === 'string' && /^\d\d-\d\d-\d{4}$/.test(x)
          ? x.split('-').reverse().join('-')
          : x;
      rows = [...rows].sort((x, y) => {
        const p = normKey(x[sort.c]);
        const z = normKey(y[sort.c]);
        if (typeof p === 'number' && typeof z === 'number') {
          return (p - z) * sort.d;
        }
        return (
          String(p).localeCompare(String(z), undefined, { numeric: true }) * sort.d
        );
      });
    }
    return rows;
  }, [activeTable, search, sort]);

  const getManualLinkChoices = (ref: string) => {
    if (!res) return [];
    const target = res.rows.find((r) => r.ref === ref);
    if (!target) return [];
    const vnoIdx = findCol('vch no');
    return [...res.extra]
      .sort((a, b) => Math.abs(a.amt - target.gross) - Math.abs(b.amt - target.gross))
      .slice(0, 15)
      .map((t) => ({
        idx: t.i,
        label: `${dstr(t.date)} · ${vnoIdx >= 0 ? String(t.cells[vnoIdx] ?? '') : ''} · ${formatInr(
          t.amt
        )} · ${t.part.slice(0, 22)}`,
      }));
  };

  const handleManualLink = (ref: string, tallyIdxStr: string) => {
    if (!tallyIdxStr) return;
    const next = new Map(manualLinks);
    next.set(ref, Number(tallyIdxStr));
    setManualLinks(next);
  };

  const handleClearManual = () => {
    setManualLinks(new Map());
  };

  const handleResetAll = () => {
    setBmw(null);
    setBmwInfo('Columns: Reference, Doc Number, Post Date, Type, Amount INR');
    setTally(null);
    setTallyInfo(
      'Select one or more files (purchase register + ledger): Date, Particulars, Vch Type, Vch No., Debit, Credit'
    );
    setAmtOptions([]);
    setSelAmt('');
    setFlt('');
    setTol('1');
    setWin('10');
    setManualLinks(new Map());
    setTab('all');
    setSearch('');
    setSort({ c: -1, d: 1 });
    setPeriodFilter(createDefaultRecoPeriodFilter());
    setErrorMsg('');
    if (f1Ref.current) f1Ref.current.value = '';
    if (f2Ref.current) f2Ref.current.value = '';
  };

  const handleDownloadReport = () => {
    if (!res) return;
    const S = res.summary;
    const wb = XLSX.utils.book_new();
    const appendSheet = (name: string, aoa: Array<Array<string | number>>, widths: number[]) => {
      const sheet = XLSX.utils.aoa_to_sheet(aoa);
      sheet['!cols'] = widths.map((wch) => ({ wch }));
      XLSX.utils.book_append_sheet(wb, sheet, name);
    };

    appendSheet(
      'Summary',
      [
        ['Parts Billing vs Tally Reconciliation'],
        [
          'Period Filter',
          periodBounds.isFiltered
            ? `${periodBounds.label} (${periodBounds.rangeText})`
            : 'All dates',
          '',
        ],
        [],
        ['Item', 'Count', 'Amount (₹)'],
        ['BMW invoices (DI)', S.n, S.gross],
        ['BMW adjustments (E5 etc.)', '', S.adj],
        ['BMW net payable', '', S.net],
        ['Tally vouchers', S.tn, S.tt],
        [],
        ['Matched', S.m.length, S.mAmt],
        ['Amount differences (Tally − BMW gross)', S.d.length, S.dAmt],
        ['Missing in Tally (BMW gross)', S.x.length, S.xAmt],
        ['Only in Tally', res.extra.length, S.eAmt],
        ['E5 adjustment anomalies', S.an, ''],
        ['Manual links', manualLinks.size, ''],
      ],
      [42, 18, 22]
    );

    const W = [11, 14, 13, 14, 11, 14, 11, 18, 40, 14, 13, 13, 10, 18, 14];
    appendSheet('All BMW', [BMW_HEADERS, ...res.rows.map(bmwLine)], W);
    appendSheet(
      'Matched',
      [BMW_HEADERS, ...res.rows.filter((r) => r.status.startsWith('Matched')).map(bmwLine)],
      W
    );
    appendSheet(
      'Amount Differences',
      [BMW_HEADERS, ...res.rows.filter((r) => r.status === 'Amount Difference').map(bmwLine)],
      W
    );
    appendSheet(
      'Missing in Tally',
      [BMW_HEADERS, ...res.rows.filter((r) => r.status === 'Missing in Tally').map(bmwLine)],
      W
    );
    appendSheet(
      'Only in Tally',
      [
        ['Date', 'Vch No.', 'Particulars', 'Vch Type', 'Amount', 'Flag', 'Source'],
        ...res.extra.map(tallyLine),
      ],
      [11, 18, 45, 14, 14, 16, 28]
    );
    appendSheet(
      'Date-wise',
      [
        ['Date', 'BMW invoices', 'BMW gross', 'Tally vouchers', 'Tally amount', 'Difference'],
        ...dateRows,
      ],
      [12, 12, 16, 14, 16, 16]
    );

    XLSX.writeFile(
      wb,
      `Parts_Billing_vs_Tally_Reconciliation${periodBounds.isFiltered ? `_${periodBounds.shortLabel}` : ''}.xlsx`
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 sm:p-6 shadow-[0_4px_0_#2F3E4E] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#2F3E4E] text-[#F9C80E] text-[10px] font-display font-extrabold uppercase tracking-wider">
              <GitCompareArrows className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{tool?.code || 'VC-02'} · VCPL Tools</span>
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#CEE5DC] border border-[#2F3E4E]/35 text-[10px] font-bold text-[#12805C]">
              <Sparkles className="w-3 h-3" aria-hidden="true" />
              <span>100% Client-Side Processing</span>
            </span>
          </div>
          <h1 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] tracking-tight">
            {tool?.title || 'Parts Billing vs Tally Reconciliation'}
          </h1>
          <p className="text-xs sm:text-sm text-[#475569] leading-relaxed max-w-3xl">
            Reconcile BMW Parts Billing statements (Reference / DI / E5 adjustments) against single
            or multi-file Tally Purchase Register &amp; Ledger exports directly in your browser.
          </p>
        </div>

        <button
          type="button"
          onClick={handleResetAll}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] transition cursor-pointer shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Workspace</span>
        </button>
      </div>

      {/* Upload + Matching Rules Card */}
      <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 sm:p-6 shadow-[0_4px_0_#2F3E4E] space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* File 1: BMW Parts Billing */}
          <FileDropZone
            accept=".xlsx,.xls,.csv"
            multiple={false}
            onFiles={(files) => {
              if (files[0]) void loadBmwFile(files[0]);
            }}
            className={`rounded-xl border-2 border-dashed p-4 sm:p-5 transition-colors ${
              bmw ? 'border-[#12805C] bg-[#CEE5DC]/30' : 'border-[#2F3E4E]/45 bg-white'
            }`}
          >
            <div className="flex items-start justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-[#F9C80E] border border-[#2F3E4E] flex items-center justify-center text-xs font-extrabold text-[#2F3E4E] shrink-0">
                  1
                </span>
                <span className="font-display font-extrabold text-sm text-[#2F3E4E]">
                  BMW Parts Billing (.xlsx / .xls / .csv)
                </span>
              </div>
              {bmw && <CheckCircle2 className="w-4 h-4 text-[#12805C] shrink-0" />}
            </div>

            <label className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] cursor-pointer transition">
              <Upload className="w-3.5 h-3.5" />
              <span>{bmw ? 'Drop or Replace Parts Billing File' : 'Drop or Upload BMW Parts Billing'}</span>
              <input
                ref={f1Ref}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleLoadBmw}
                className="sr-only"
              />
            </label>

            <p className="mt-2.5 text-[11px] font-medium text-[#475569] break-words">{bmwInfo}</p>
          </FileDropZone>

          {/* File 2: Tally Register Export */}
          <FileDropZone
            accept=".xlsx,.xls,.csv"
            multiple
            onFiles={(files) => {
              void loadTallyFiles(files);
            }}
            className={`rounded-xl border-2 border-dashed p-4 sm:p-5 transition-colors ${
              tally ? 'border-[#12805C] bg-[#CEE5DC]/30' : 'border-[#2F3E4E]/45 bg-white'
            }`}
          >
            <div className="flex items-start justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-[#CEE5DC] border border-[#2F3E4E] flex items-center justify-center text-xs font-extrabold text-[#2F3E4E] shrink-0">
                  2
                </span>
                <span className="font-display font-extrabold text-sm text-[#2F3E4E]">
                  Tally Register Export (.xlsx / .xls / .csv)
                </span>
              </div>
              {tally && <CheckCircle2 className="w-4 h-4 text-[#12805C] shrink-0" />}
            </div>

            <label className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] cursor-pointer transition">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>{tally ? 'Drop or Replace Tally File(s)' : 'Drop or Upload Tally Register(s)'}</span>
              <input
                ref={f2Ref}
                type="file"
                accept=".xlsx,.xls,.csv"
                multiple
                onChange={handleLoadTally}
                className="sr-only"
              />
            </label>

            <p className="mt-2.5 text-[11px] font-medium text-[#475569] break-words">
              {tallyInfo}
            </p>
          </FileDropZone>
        </div>

        {/* Reconciliation Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-2 border-t border-[#2F3E4E]/15">
          <div>
            <label
              htmlFor="pb-amt-col"
              className="block text-[11px] font-bold text-[#475569] mb-1"
            >
              Tally amount column
            </label>
            <select
              id="pb-amt-col"
              value={selAmt}
              onChange={(e) => setSelAmt(e.target.value)}
              disabled={!amtOptions.length}
              className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white text-xs font-semibold text-[#2F3E4E] disabled:opacity-60"
            >
              {!amtOptions.length ? (
                <option value="">— load Tally file —</option>
              ) : (
                amtOptions.map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.t}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label htmlFor="pb-flt" className="block text-[11px] font-bold text-[#475569] mb-1">
              Particulars filter (optional)
            </label>
            <input
              id="pb-flt"
              type="text"
              value={flt}
              onChange={(e) => setFlt(e.target.value)}
              placeholder="e.g. BMW"
              className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white text-xs font-semibold text-[#2F3E4E]"
            />
          </div>

          <div>
            <label htmlFor="pb-tol" className="block text-[11px] font-bold text-[#475569] mb-1">
              Amount tolerance (₹)
            </label>
            <input
              id="pb-tol"
              type="number"
              step="0.01"
              value={tol}
              onChange={(e) => setTol(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white text-xs font-semibold text-[#2F3E4E]"
            />
          </div>

          <div>
            <label htmlFor="pb-win" className="block text-[11px] font-bold text-[#475569] mb-1">
              Date window for amount-match (days)
            </label>
            <input
              id="pb-win"
              type="number"
              value={win}
              onChange={(e) => setWin(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white text-xs font-semibold text-[#2F3E4E]"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={!res}
            onClick={handleDownloadReport}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#2F3E4E] hover:bg-[#1E293B] text-xs font-bold text-[#F9C80E] disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer transition"
          >
            <Download className="w-4 h-4" />
            <span>Download 7-Sheet Excel Report</span>
          </button>

          <button
            type="button"
            disabled={manualLinks.size === 0}
            onClick={handleClearManual}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer transition"
          >
            <Unlink className="w-3.5 h-3.5" />
            <span>Clear Manual Links ({manualLinks.size})</span>
          </button>
        </div>

        {/* Error / Sanity Warnings */}
        {errorMsg && (
          <div className="rounded-xl border border-rose-700/40 bg-rose-50 px-4 py-3 flex items-start gap-2.5 text-xs text-rose-900">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-700" />
            <p className="font-medium">{errorMsg}</p>
          </div>
        )}

        {res && res.warnings.length > 0 && (
          <div className="rounded-xl border border-amber-700/40 bg-amber-50 px-4 py-3 flex items-start gap-2.5 text-xs text-amber-900 space-y-1">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
            <div className="space-y-1">
              {res.warnings.map((w, i) => (
                <p key={i} className="font-medium leading-relaxed">
                  {w}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Advanced Period & Date Filter */}
      {(bmw || tally) && (
        <RecoPeriodFilterBar
          value={periodFilter}
          onChange={setPeriodFilter}
          available={availablePeriods}
          matchedCount={
            (filteredInputs.fBmw?.length ?? 0) + (filteredInputs.fTally?.rows.length ?? 0)
          }
          totalCount={(bmw?.length ?? 0) + (tally?.rows.length ?? 0)}
          scopeHint="Filters BMW Post Date & Tally Date before matching, KPIs & Excel report"
        />
      )}

      {/* Results Dashboard */}
      {res && (
        <>
          {/* 11 Summary KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {[
              ['BMW invoices', String(res.summary.n)],
              ['BMW gross (DI)', `₹ ${formatInr(res.summary.gross)}`],
              ['BMW adjustments (E5)', `₹ ${formatInr(res.summary.adj)}`],
              ['BMW net payable', `₹ ${formatInr(res.summary.net)}`],
              ['Tally vouchers / total', `${res.summary.tn} / ₹ ${formatInr(res.summary.tt)}`],
              ['Matched', `${res.summary.m.length} · ₹ ${formatInr(res.summary.mAmt)}`],
              ['Amount differences', `${res.summary.d.length} · Δ ₹ ${formatInr(res.summary.dAmt)}`],
              ['Missing in Tally', `${res.summary.x.length} · ₹ ${formatInr(res.summary.xAmt)}`],
              ['Only in Tally', `${res.extra.length} · ₹ ${formatInr(res.summary.eAmt)}`],
              ['E5 adj anomalies', String(res.summary.an)],
              ['Manual links', String(manualLinks.size)],
            ].map(([label, val]) => (
              <div
                key={label}
                className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-xl px-3.5 py-3 shadow-[0_2px_0_#2F3E4E]"
              >
                <span className="block text-[11px] font-semibold text-[#64748B] truncate">
                  {label}
                </span>
                <strong className="block mt-1 font-display font-extrabold text-sm text-[#2F3E4E] tabular-nums truncate">
                  {val}
                </strong>
              </div>
            ))}
          </div>

          {/* Interactive Tabs & Data Table */}
          <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 shadow-[0_4px_0_#2F3E4E] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5" role="tablist">
                {(
                  [
                    ['all', 'All BMW invoices', res.summary.n],
                    ['ok', 'Matched', res.summary.m.length],
                    ['diff', 'Amount differences', res.summary.d.length],
                    ['miss', 'Missing in Tally', res.summary.x.length],
                    ['extra', 'Only in Tally', res.extra.length],
                    ['date', 'Date-wise', dateRows.length],
                  ] as Array<[TabKey, string, number]>
                ).map(([k, label, count]) => {
                  const isOn = tab === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      role="tab"
                      aria-selected={isOn}
                      onClick={() => {
                        setTab(k);
                        setSort({ c: -1, d: 1 });
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border-[1.5px] transition cursor-pointer ${
                        isOn
                          ? 'bg-[#2F3E4E] text-[#F9C80E] border-[#2F3E4E]'
                          : 'bg-white text-[#2F3E4E] border-[#2F3E4E]/35 hover:bg-[#FEF2C8]'
                      }`}
                    >
                      {label} ({count})
                    </button>
                  );
                })}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#64748B] pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search in table..."
                  aria-label="Search reconciliation rows"
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white text-xs text-[#2F3E4E] placeholder:text-[#64748B]"
                />
              </div>
            </div>

            <div className="overflow-x-auto max-h-[540px] border-[1.5px] border-[#2F3E4E]/30 rounded-xl bg-white">
              <table className="w-full text-xs border-collapse min-w-[900px]">
                <thead className="sticky top-0 z-10 bg-[#FEF2C8] border-b-[1.5px] border-[#2F3E4E]">
                  <tr>
                    {activeTable.headers.map((h, i) => {
                      const isNumeric = activeTable.nc.includes(i);
                      return (
                        <th
                          key={h}
                          onClick={() =>
                            setSort((prev) =>
                              prev.c === i
                                ? { c: i, d: prev.d === 1 ? -1 : 1 }
                                : { c: i, d: 1 }
                            )
                          }
                          className={`px-3 py-2.5 font-display font-extrabold text-[#2F3E4E] whitespace-nowrap cursor-pointer select-none hover:bg-[#F9C80E]/50 ${
                            isNumeric ? 'text-right' : 'text-left'
                          }`}
                        >
                          {h}
                          {sort.c === i ? (sort.d > 0 ? ' ▲' : ' ▼') : ''}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2F3E4E]/10">
                  {filteredAndSortedRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={activeTable.headers.length}
                        className="px-4 py-8 text-center text-[#64748B] font-medium"
                      >
                        No rows match this view/search.
                      </td>
                    </tr>
                  ) : (
                    filteredAndSortedRows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-[#FEF2C8]/40">
                        {row.map((cell, cIdx) => {
                          const header = activeTable.headers[cIdx];
                          if (header === 'Status') {
                            const st = String(cell) as ReconStatus;
                            return (
                              <td key={cIdx} className="px-3 py-2 whitespace-nowrap">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-full border text-[11px] font-bold ${
                                    STATUS_PILL[st] || 'bg-slate-100 text-slate-800'
                                  }`}
                                >
                                  {st}
                                </span>
                              </td>
                            );
                          }
                          if (header === 'Link manually') {
                            const ref = String(cell).slice(2);
                            const choices = getManualLinkChoices(ref);
                            return (
                              <td key={cIdx} className="px-3 py-2 whitespace-nowrap">
                                <select
                                  value=""
                                  onChange={(e) => handleManualLink(ref, e.target.value)}
                                  aria-label={`Link invoice ${ref} manually`}
                                  className="px-2 py-1 rounded-md border border-[#2F3E4E]/45 bg-[#FFFDF5] text-[11px] text-[#2F3E4E] max-w-[240px]"
                                >
                                  <option value="">Link to Tally…</option>
                                  {choices.map((ch) => (
                                    <option key={ch.idx} value={ch.idx}>
                                      {ch.label}
                                    </option>
                                  ))}
                                </select>
                              </td>
                            );
                          }
                          const isNumeric = activeTable.nc.includes(cIdx);
                          return (
                            <td
                              key={cIdx}
                              className={`px-3 py-2 whitespace-nowrap text-[#2F3E4E] ${
                                isNumeric ? 'text-right font-mono tabular-nums' : 'text-left'
                              }`}
                            >
                              {isNumeric ? formatInr(cell as number | '') : String(cell ?? '')}
                            </td>
                          );
                        })}
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
