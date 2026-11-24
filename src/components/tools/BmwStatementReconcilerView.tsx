import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  GitCompareArrows,
  HardDrive,
  Printer,
  RotateCcw,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ToolCatalogItem } from '../../types/tools';
import { safeReadStorage, safeRemoveStorage, safeWriteStorage } from '../../utils/browserVault';
import { filesToFileList } from '../../utils/fileDropUtils';
import { exportElementToPdf, printTargetElement } from '../../utils/printReport';
import {
  RecoPeriodFilter,
  createDefaultRecoPeriodFilter,
  extractPeriodChoicesFromKeys,
  isDateKeyInRecoPeriod,
  resolveRecoPeriodBounds,
  utcMsToKey,
} from '../../utils/recoPeriodFilter';
import { FileDropZone } from './FileDropZone';
import { RecoPeriodFilterBar } from './RecoPeriodFilterBar';

interface BmwStatementReconcilerViewProps {
  tool?: ToolCatalogItem;
  onBack?: () => void;
}

const PREFS_STORAGE_KEY = 'vcpl_bmw_stmt_prefs_v1';

type TallyRoleKey = 'date' | 'part' | 'vtype' | 'vno' | 'ref' | 'narr' | 'debit' | 'credit';

interface SavedPrefs {
  tol: string;
  win: string;
  top: string;
  flip: boolean;
  colMap?: Partial<Record<TallyRoleKey, string>>;
}

const DEFAULT_COL_MAP: Record<TallyRoleKey, string> = {
  date: '',
  part: '',
  vtype: '',
  vno: '',
  ref: '',
  narr: '',
  debit: '',
  credit: '',
};

const DEFAULT_PREFS: SavedPrefs = {
  tol: '1',
  win: '7',
  top: '',
  flip: false,
  colMap: DEFAULT_COL_MAP,
};

const ROLES: ReadonlyArray<[TallyRoleKey, string, RegExp]> = [
  ['date', 'Date', /^date/i],
  ['part', 'Particulars', /particular|ledger|account/i],
  ['vtype', 'Voucher type', /vch.*type|voucher.*type/i],
  ['vno', 'Voucher no.', /vch.*no|voucher.*n/i],
  ['ref', 'Reference no.', /^ref|supplier inv|bill/i],
  ['narr', 'Narration', /narr/i],
  ['debit', 'Debit', /debit|^dr/i],
  ['credit', 'Credit', /credit|^cr/i],
];

const CAUSE: Record<string, string> = {
  F4: 'Payment/suspense receipt not booked in Tally',
  E4: 'TDS 194Q (vehicle) not booked in Tally',
  E5: 'TDS 194Q (parts) not booked in Tally',
  DL: 'Vehicle invoice not booked in Tally',
  DI: 'Parts invoice not booked in Tally',
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

const MN = Object.keys(MON).map((m) => m[0].toUpperCase() + m.slice(1));

const fmt = (n: number): string =>
  (n < 0 ? '-' : '') +
  Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const r2 = (n: number): number => Math.round(n * 100) / 100;

const d2s = (ms: number | null | undefined): string => {
  if (ms == null) return '';
  const d = new Date(ms);
  return `${String(d.getUTCDate()).padStart(2, '0')}-${MN[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
};

function pd(v: unknown): number | null {
  if (v === '' || v == null) return null;
  if (v instanceof Date) return Date.UTC(v.getFullYear(), v.getMonth(), v.getDate());
  if (typeof v === 'number') {
    return v > 20000 && v < 80000 ? Math.floor(v - 25569) * 864e5 : null;
  }
  const s = String(v).trim();
  let m = s.match(/(\d{1,2})[-/ ]([A-Za-z]{3})[a-z]*[-/ ,]*(\d{2,4})/);
  if (m && MON[m[2].toLowerCase()] != null) {
    let y = +m[3];
    if (y < 100) y += 2000;
    return Date.UTC(y, MON[m[2].toLowerCase()], +m[1]);
  }
  m = s.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) {
    let y = +m[3];
    if (y < 100) y += 2000;
    return Date.UTC(y, +m[2] - 1, +m[1]);
  }
  return null;
}

const num = (v: unknown): number =>
  typeof v === 'number' ? v : parseFloat(String(v).replace(/[,\s]|dr|cr/gi, '')) || 0;

const toks = (s: string): Set<string> =>
  new Set(
    (String(s).toUpperCase().match(/[A-Z0-9]{6,}/g) || []).filter(
      (x) => /\d/.test(x) && !/^20\d{6}$/.test(x)
    )
  );

const mk = (d: number | null): string => (d == null ? 'n/a' : new Date(d).toISOString().slice(0, 7));

async function readWorkbookSheets(f: File): Promise<Array<[string, unknown[][]]>> {
  const wb = XLSX.read(await f.arrayBuffer());
  return wb.SheetNames.map((n) => [
    n,
    XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' }) as unknown[][],
  ]);
}

interface BmwLine {
  doc: string;
  ref: string;
  asg: string;
  hdr: string;
  typ: string;
  date: number | null;
  amt: number;
  clr: string;
  file: string;
  code: string;
  seg: string;
  k: Set<string>;
  m?: TallyLine | GroupMatch | null;
}

interface BmwFileParsed {
  name: string;
  code: string;
  seg: string;
  pf: number | null;
  pt: number | null;
  open: number;
  from: number;
  rows: BmwLine[];
}

interface TallySheetParsed {
  id: string;
  name: string;
  h: string[];
  rows: unknown[][];
  on: boolean;
}

interface TallyLine {
  sheet: string;
  date: number;
  part: string;
  vtype: string;
  vno: string;
  ref: string;
  narr: string;
  amt: number;
  dr: number;
  cr: number;
  k: Set<string>;
  m?: BmwLine | GroupMatch | null;
}

interface GroupMatch {
  k: string;
  bs: BmwLine[];
  ts: TallyLine[];
  nb: number;
  nt: number;
}

interface MatchPair {
  kind: string;
  b: BmwLine;
  t: TallyLine;
}

type CellVal = string | number;

interface ResultTableSet {
  h: string[];
  r: CellVal[][];
}

interface DupItem {
  s: string;
  d: string;
  r: string;
  a: number;
  n: number;
  dateMs: number | null;
}

interface ReconcileRawSnapshot {
  B: BmwLine[];
  T: TallyLine[];
  ok: MatchPair[];
  df: MatchPair[];
  oB: BmwLine[];
  oT: TallyLine[];
  G: GroupMatch[];
  endMs: number;
  dups: DupItem[];
  tolVal: number;
  RS: CellVal[][];
  BS: CellVal[][];
  TR: CellVal[][];
  idx: Map<string, TallyLine[]>;
}

interface ReconcileOutput {
  sum: CellVal[][];
  diff: number;
  un: number;
  sets: Record<string, ResultTableSet>;
  raw: ReconcileRawSnapshot;
}

const sm = (a: Array<{ amt: number }>): number => r2(a.reduce((s, x) => s + x.amt, 0));

function parseBmwSheet(rows: unknown[][], name: string): BmwFileParsed | null {
  const hi = rows.findIndex((r) =>
    r.some((c) => String(c).trim().toLowerCase() === 'documentno')
  );
  if (hi < 0) return null;
  const H = rows[hi].map((c) => String(c).trim().toLowerCase());
  const col = (n: string) => H.indexOf(n);
  const x = {
    doc: col('documentno'),
    ref: col('reference'),
    asg: col('assignment'),
    hdr: col('document header text'),
    typ: col('typ'),
    pdt: col('pstng date'),
    amt: col('amount (inr)'),
    clr: col('clrng doc.'),
  };
  let code = '';
  let seg = '';
  let pf: number | null = null;
  let pt: number | null = null;
  rows.slice(0, hi).forEach((r) => {
    const k = String(r[1] ?? '').trim();
    const m = String(r[6] ?? '')
      .trim()
      .toUpperCase();
    if (k === 'Code') code = String(r[2] ?? '');
    if (String(r[3] ?? '').trim() === 'Segment') seg = String(r[4] ?? '').trim();
    if (m === 'FROM') pf = pd(r[7]);
    if (m === 'TO') pt = pd(r[7]);
  });

  let open = 0;
  let from: number | null = null;
  const out: BmwLine[] = [];
  rows.slice(hi + 1).forEach((r) => {
    if (/opening/i.test(String(r[x.asg] ?? ''))) {
      open = num(r[x.amt]);
      from = pd(r[x.pdt]);
      return;
    }
    if (typeof r[x.amt] === 'number' && String(r[x.doc] ?? '') !== '') {
      const o: BmwLine = {
        doc: String(r[x.doc] ?? ''),
        ref: String(r[x.ref] ?? ''),
        asg: String(r[x.asg] ?? ''),
        hdr: String(r[x.hdr] ?? ''),
        typ: String(r[x.typ] ?? ''),
        date: pd(r[x.pdt]),
        amt: r[x.amt] as number,
        clr: String(r[x.clr] ?? ''),
        file: name,
        code,
        seg,
        k: new Set(),
      };
      o.k = toks([o.doc, o.ref, o.asg, o.hdr].join(' '));
      out.push(o);
    }
  });
  return {
    name,
    code,
    seg,
    pf,
    pt,
    open,
    from: from ?? pf ?? (out[0]?.date ?? 0),
    rows: out,
  };
}

export const BmwStatementReconcilerView: React.FC<BmwStatementReconcilerViewProps> = ({
  tool,
  onBack,
}) => {
  const initialPrefs = useMemo(
    () => safeReadStorage<SavedPrefs>(PREFS_STORAGE_KEY, DEFAULT_PREFS),
    []
  );

  const [bmwFiles, setBmwFiles] = useState<BmwFileParsed[]>([]);
  const [tallySheets, setTallySheets] = useState<TallySheetParsed[]>([]);
  const [colMap, setColMap] = useState<Record<TallyRoleKey, string>>({
    ...DEFAULT_COL_MAP,
    ...(initialPrefs.colMap ?? {}),
  });

  const [tol, setTol] = useState<string>(initialPrefs.tol ?? '1');
  const [win, setWin] = useState<string>(initialPrefs.win ?? '7');
  const [top, setTop] = useState<string>(initialPrefs.top ?? '');
  const [flip, setFlip] = useState<boolean>(Boolean(initialPrefs.flip));

  const [status, setStatus] = useState<{ text: string; tone: 'neutral' | 'ok' | 'warn' }>({
    text: 'Upload your BMW Statement(s) of Account and Tally ledger Excel exports to begin.',
    tone: 'neutral',
  });

  const [result, setResult] = useState<ReconcileOutput | null>(null);
  const [periodFilter, setPeriodFilter] = useState<RecoPeriodFilter>(() =>
    createDefaultRecoPeriodFilter()
  );
  const [activeTab, setActiveTab] = useState<string>('Summary');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortState, setSortState] = useState<{ t: string; c: number | null; d: 1 | -1 }>({
    t: '',
    c: null,
    d: 1,
  });

  const bmwInputRef = useRef<HTMLInputElement>(null);
  const tallyInputRef = useRef<HTMLInputElement>(null);
  const resultsPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    safeWriteStorage(PREFS_STORAGE_KEY, { tol, win, top, flip, colMap } satisfies SavedPrefs);
  }, [tol, win, top, flip, colMap]);

  const handleBmwUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const next = [...bmwFiles];
    const bad: string[] = [];

    for (const f of Array.from(files)) {
      if (next.some((x) => x.name === f.name)) continue;
      try {
        const sheets = await readWorkbookSheets(f);
        const p = sheets.length ? parseBmwSheet(sheets[0][1], f.name) : null;
        if (p) next.push(p);
        else bad.push(f.name);
      } catch {
        bad.push(f.name);
      }
    }

    next.sort((a, b) => (a.code + a.seg).localeCompare(b.code + b.seg) || a.from - b.from);
    setBmwFiles(next);
    setStatus({
      text:
        `${next.length} BMW statement(s) loaded.` +
        (bad.length ? ` Not a BMW statement (missing "DocumentNo" header): ${bad.join(', ')}` : ''),
      tone: bad.length ? 'warn' : 'ok',
    });
  };

  const handleTallyUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const nextSheets = [...tallySheets];
    const bad: string[] = [];

    for (const f of Array.from(files)) {
      try {
        const sheets = await readWorkbookSheets(f);
        let foundInFile = 0;
        for (const [sheetName, rows] of sheets) {
          const hi = rows.slice(0, 60).findIndex(
            (r) =>
              r.some((c) => /^date/i.test(String(c).trim())) &&
              r.some((c) => /debit|credit/i.test(String(c)))
          );
          if (hi >= 0) {
            nextSheets.push({
              id: `${f.name}::${sheetName}::${nextSheets.length}`,
              name: `${f.name.replace(/\.xlsx?$/i, '')} › ${sheetName}`,
              h: rows[hi].map((c) => String(c).trim()),
              rows: rows.slice(hi + 1),
              on: true,
            });
            foundInFile++;
          }
        }
        if (!foundInFile) bad.push(f.name);
      } catch {
        bad.push(f.name);
      }
    }

    setTallySheets(nextSheets);

    if (nextSheets.length === 0) {
      setStatus({
        text: 'No sheet with a Date column and Debit/Credit columns was found in the Tally file. Re-export the ledger from Tally with vouchers included.',
        tone: 'warn',
      });
      return;
    }

    if (nextSheets[0]) {
      const availableHeaders = new Set(nextSheets.flatMap((s) => s.h).filter(Boolean));
      const h0 = nextSheets[0].h;
      const used = new Set<number>();
      const nextMap: Record<TallyRoleKey, string> = { ...DEFAULT_COL_MAP };
      ROLES.forEach(([k, , re]) => {
        const savedHdr = colMap[k];
        if (savedHdr && availableHeaders.has(savedHdr)) {
          nextMap[k] = savedHdr;
          const idx = h0.indexOf(savedHdr);
          if (idx >= 0) used.add(idx);
          return;
        }
        const idx = h0.findIndex((x, j) => Boolean(x) && !used.has(j) && re.test(x));
        nextMap[k] = idx >= 0 ? h0[idx] : '';
        if (idx >= 0) used.add(idx);
      });
      setColMap(nextMap);
    }

    setStatus({
      text:
        `Tally: ${nextSheets.length} ledger sheet(s) loaded. Check the column mapping, then click Reconcile.` +
        (bad.length ? ` No ledger data found in: ${bad.join(', ')}` : ''),
      tone: bad.length ? 'warn' : 'ok',
    });
  };

  const handleClearAll = () => {
    setBmwFiles([]);
    setTallySheets([]);
    setResult(null);
    setPeriodFilter(createDefaultRecoPeriodFilter());
    setSearchQuery('');
    setActiveTab('Summary');
    setStatus({ text: 'All uploaded files cleared. Saved settings & column preferences remain in your browser.', tone: 'neutral' });
  };

  const handleResetPrefs = () => {
    safeRemoveStorage(PREFS_STORAGE_KEY);
    setTol('1');
    setWin('7');
    setTop('');
    setFlip(false);
    setColMap({ ...DEFAULT_COL_MAP });
    setStatus({ text: 'Tolerance, date window, column mapping & saved browser settings reset to defaults.', tone: 'neutral' });
  };

  const allTallyHeaders = useMemo(
    () => Array.from(new Set(tallySheets.flatMap((s) => s.h).filter(Boolean))),
    [tallySheets]
  );

  const runReconcile = () => {
    if (!bmwFiles.length || !tallySheets.length) {
      setStatus({
        text: 'Add the BMW statement(s) and at least one valid Tally ledger export first.',
        tone: 'warn',
      });
      return;
    }

    const tolVal = parseFloat(tol) || 0;
    const winMs = (parseFloat(win) || 0) * 864e5;
    const fl = flip ? -1 : 1;

    const B: BmwLine[] = bmwFiles.flatMap((f) => f.rows.map((r) => ({ ...r, m: null })));

    const T: TallyLine[] = [];
    let detectedOpen = 0;
    for (const sh of tallySheets) {
      if (!sh.on) continue;
      const ix: Record<TallyRoleKey, number> = {
        date: -1,
        part: -1,
        vtype: -1,
        vno: -1,
        ref: -1,
        narr: -1,
        debit: -1,
        credit: -1,
      };
      ROLES.forEach(([k]) => {
        ix[k] = colMap[k] ? sh.h.indexOf(colMap[k]) : -1;
      });

      for (const row of sh.rows) {
        const g = (k: TallyRoleKey) => (ix[k] >= 0 ? row[ix[k]] : '');
        const part = String(g('part') ?? '');
        const dr = num(g('debit'));
        const cr = num(g('credit'));
        if (/opening balance/i.test(part)) {
          detectedOpen += (cr - dr) * fl;
          continue;
        }
        const dt = pd(g('date'));
        if (dt == null || /^(closing balance|grand total)/i.test(part)) continue;
        const t: TallyLine = {
          sheet: sh.name,
          date: dt,
          part,
          vtype: String(g('vtype') ?? ''),
          vno: String(g('vno') ?? ''),
          ref: String(g('ref') ?? ''),
          narr: String(g('narr') ?? ''),
          amt: (cr - dr) * fl,
          dr,
          cr,
          k: new Set(),
          m: null,
        };
        t.k = toks([t.vno, t.ref, t.narr, t.part].join(' '));
        T.push(t);
      }
    }

    if (!T.length) {
      setStatus({
        text: 'No dated Tally entries were read. Check the Tally Column mapping and active sheets.',
        tone: 'warn',
      });
      return;
    }

    const gp: Record<string, BmwFileParsed[]> = {};
    bmwFiles.forEach((f) => {
      const k = `${f.code}|${f.seg}`;
      (gp[k] = gp[k] || []).push(f);
    });

    const ob = r2(Object.values(gp).reduce((s, a) => s + a[0].open, 0));
    const ot = top.trim() !== '' ? parseFloat(top) || 0 : r2(detectedOpen);

    const idx = new Map<string, TallyLine[]>();
    T.forEach((t) => {
      t.k.forEach((k) => {
        const list = idx.get(k);
        if (list) list.push(t);
        else idx.set(k, [t]);
      });
    });

    const M: MatchPair[] = [];
    const pair = (b: BmwLine, t: TallyLine, kind: string) => {
      b.m = t;
      t.m = b;
      M.push({ kind, b, t });
    };
    const best = (cands: TallyLine[], scoreFn: (t: TallyLine) => number) =>
      cands.reduce<TallyLine | null>((a, x) => (!a || scoreFn(x) < scoreFn(a) ? x : a), null);
    const cand = (b: BmwLine) => [...b.k].flatMap((k) => idx.get(k) || []).filter((t) => !t.m);
    const dd = (b: BmwLine, t: TallyLine) =>
      b.date == null ? 9e15 : Math.abs(b.date - t.date);

    // Pass 1: Reference + amount
    B.forEach((b) => {
      const t = best(
        cand(b).filter((t) => Math.abs(b.amt - t.amt) <= tolVal),
        (t) => dd(b, t)
      );
      if (t) pair(b, t, 'Reference + amount');
    });

    // Pass 2: Amount + date window
    B.forEach((b) => {
      if (b.m || Math.abs(b.amt) <= tolVal * 10) return;
      const t = best(
        T.filter((t) => !t.m && Math.abs(b.amt - t.amt) <= tolVal && dd(b, t) <= winMs),
        (t) => dd(b, t)
      );
      if (t) pair(b, t, 'Amount + date');
    });

    // Pass 3: Reference only (amount differs)
    B.forEach((b) => {
      if (b.m) return;
      const t = best(
        cand(b).filter((t) => Math.sign(t.amt) === Math.sign(b.amt)),
        (t) => Math.abs(b.amt - t.amt)
      );
      if (t) pair(b, t, 'Reference only (amount differs)');
    });

    // Pass 4: Group matches (several lines summing within tolerance)
    const G: GroupMatch[] = [];
    for (const k of new Set(B.filter((b) => !b.m).flatMap((b) => [...b.k]))) {
      const bs = B.filter((b) => !b.m && b.k.has(k));
      const ts = (idx.get(k) || []).filter((t) => !t.m);
      if (!bs.length || !ts.length) continue;
      const nb = sm(bs);
      const nt = sm(ts);
      if (Math.abs(nb - nt) <= tolVal) {
        const g: GroupMatch = { k, bs, ts, nb, nt };
        bs.forEach((b) => {
          b.m = g;
        });
        ts.forEach((t) => {
          t.m = g;
        });
        G.push(g);
      }
    }

    const oB = B.filter((b) => !b.m);
    const oT = T.filter((t) => !t.m);
    const ok = M.filter((x) => x.kind[0] !== 'R' || x.kind[10] === '+');
    const df = M.filter((x) => !ok.includes(x));

    const mh = [
      'Match basis',
      'BMW doc no.',
      'BMW reference',
      'Type',
      'BMW date',
      'BMW amount',
      'Tally date',
      'Tally voucher',
      'Tally amount',
      'Difference',
      'Date gap (days)',
    ];
    const mr = (x: MatchPair): CellVal[] => [
      x.kind,
      x.b.doc,
      x.b.ref,
      x.b.typ,
      d2s(x.b.date),
      x.b.amt,
      d2s(x.t.date),
      x.t.vno || x.t.ref || x.t.part,
      x.t.amt,
      r2(x.b.amt - x.t.amt),
      x.b.date == null ? '' : String(Math.round((x.t.date - x.b.date) / 864e5)),
    ];

    const rg: Record<string, BmwLine[]> = {};
    B.forEach((b) => {
      const k = [...toks(b.ref)][0] || b.doc;
      (rg[k] = rg[k] || []).push(b);
    });
    const RF: CellVal[][] = Object.keys(rg)
      .map((k): CellVal[] => {
        const bs = rg[k];
        const ts = [...new Set(idx.get(k) || [])];
        const nb = sm(bs);
        const nt = sm(ts);
        const d = r2(nb - nt);
        return [
          k,
          String(bs.length),
          nb,
          String(ts.length),
          nt,
          d,
          !ts.length ? 'Not in Tally' : Math.abs(d) <= tolVal ? 'OK' : 'Differs',
        ];
      })
      .sort((a, b) => Math.abs(Number(b[5])) - Math.abs(Number(a[5])));

    const end = Math.max(...B.map((b) => b.date || 0));
    const bk = (a: number) => (a <= 30 ? '0-30' : a <= 60 ? '31-60' : a <= 90 ? '61-90' : '90+');
    const OP: CellVal[][] = B.filter((b) => b.clr === '' || b.clr === '0').map((b) => {
      const a = b.date != null ? Math.round((end - b.date) / 864e5) : 0;
      return [b.doc, b.ref, b.typ, d2s(b.date), String(a), b.amt, bk(a)];
    });

    const dc: Record<string, DupItem> = {};
    const dk = (s: string, d: string, r: string, a: number, dateMs: number | null) => {
      const k = [s, d, r, a].join('|');
      (dc[k] = dc[k] || { s, d, r, a, n: 0, dateMs }).n++;
    };
    B.forEach((b) => dk('BMW', d2s(b.date), `${b.ref} (${b.typ})`, b.amt, b.date));
    T.forEach((t) => dk('Tally', d2s(t.date), `${t.vno || t.ref} ${t.part}`, t.amt, t.date));
    const dupList = Object.values(dc).filter((o) => o.n > 1);
    const DU: CellVal[][] = dupList.map((o) => [o.s, o.d, o.r, o.a, String(o.n)]);

    const sB = sm(oB);
    const sT = sm(oT);
    const mD = r2(
      M.reduce((s, x) => s + x.b.amt - x.t.amt, 0) + G.reduce((s, g) => s + g.nb - g.nt, 0)
    );
    const cb = r2(ob + sm(B));
    const ct = r2(ot + sm(T));
    const diff = r2(cb - ct);
    const un = r2(diff - (ob - ot + sB - sT + mD));

    const cat = (t: string) =>
      (
        {
          DL: 'Vehicle invoices (DL)',
          DI: 'Parts invoices (DI)',
          E4: 'TDS 194Q on vehicles (E4)',
          E5: 'TDS 194Q on parts (E5)',
          F4: 'Payments and suspense receipts (F4)',
        } as Record<string, string>
      )[t] || `Other BMW entries (${t})`;

    const ck: Record<string, BmwLine[]> = {};
    oB.forEach((b) => {
      const k = cat(b.typ);
      (ck[k] = ck[k] || []).push(b);
    });

    const RS: CellVal[][] = [
      ['Closing balance as per BMW statement(s)', '', cb],
      ...Object.keys(ck)
        .sort()
        .map((k): CellVal[] => [`Less: in BMW, not in Tally: ${k}`, String(ck[k].length), -sm(ck[k])]),
      ['Add: in Tally, not in BMW', String(oT.length), sT],
      [
        'Less: amount differences on paired and grouped entries',
        String(df.length + G.length),
        -mD,
      ],
      ['Less: opening balance difference', '', -r2(ob - ot)],
      ['Closing balance as per Tally', '', ct],
      ['Check: should be 0.00', '', r2(cb - sm(oB) + sT - mD - (ob - ot) - ct)],
    ];

    const BS: CellVal[][] = bmwFiles.map((f) => {
      const rs = B.filter((b) => b.file === f.name);
      const u = rs.filter((b) => !b.m);
      return [
        f.name,
        `${f.code} ${f.seg}`,
        `${d2s(f.from)} to ${d2s(f.pt)}`,
        f.open,
        r2(sm(rs.filter((b) => b.amt > 0))),
        r2(sm(rs.filter((b) => b.amt < 0))),
        r2(f.open + sm(rs)),
        String(rs.length),
        String(rs.length - u.length),
        String(u.length),
        r2(sm(u)),
      ];
    });

    const TL: Record<string, { n: number; dr: number; cr: number; u: number; ut: number }> = {};
    T.forEach((t) => {
      const o = (TL[t.sheet] = TL[t.sheet] || { n: 0, dr: 0, cr: 0, u: 0, ut: 0 });
      o.n++;
      o.dr += t.dr;
      o.cr += t.cr;
      if (!t.m) {
        o.u++;
        o.ut += t.amt;
      }
    });
    const TR: CellVal[][] = Object.keys(TL).map((k) => {
      const o = TL[k];
      return [
        k,
        String(o.n),
        r2(o.dr),
        r2(o.cr),
        r2(o.cr - o.dr),
        String(o.n - o.u),
        String(o.u),
        r2(o.ut),
      ];
    });

    const sum: CellVal[][] = [
      ['BMW statement', ''],
      ['Opening balance', ob],
      ['Invoices and debits (+)', r2(sm(B.filter((b) => b.amt > 0)))],
      ['Payments, TDS and credits (−)', r2(sm(B.filter((b) => b.amt < 0)))],
      ['Closing balance (BMW)', cb],
      ['Tally ledgers', ''],
      [
        `Opening balance${top.trim() === '' && !detectedOpen ? ' (none found, taken as 0)' : ''}`,
        ot,
      ],
      ['Net movement', sm(T)],
      ['Closing balance (Tally)', ct],
      ['Difference (BMW − Tally)', diff],
      ['What explains the difference', ''],
      ['Opening balance difference', r2(ob - ot)],
      ['Entries only in BMW (+)', sB],
      ['Entries only in Tally (−)', -sT],
      ['Amount differences on paired entries', mD],
      ['Unexplained (should be 0.00)', un],
      ['Match counts', ''],
      ['BMW lines / Tally lines', `${B.length} / ${T.length}`],
      [
        'Matched by reference + amount',
        String(M.filter((x) => x.kind[0] === 'R' && x.kind[10] === '+').length),
      ],
      ['Matched by amount + date', String(M.filter((x) => x.kind[0] === 'A').length)],
      ['Matched as a group (several lines, net equal)', String(G.length)],
      ['Reference found, amount differs', String(df.length)],
      ['Only in BMW', String(oB.length)],
      ['Only in Tally', String(oT.length)],
      ['Open items on BMW statement (no clearing document), by age', ''],
      ...['0-30', '31-60', '61-90', '90+'].map(
        (k): CellVal[] => [
          `Open items aged ${k} days`,
          r2(OP.filter((x) => x[6] === k).reduce((s, x) => s + Number(x[5]), 0)),
        ]
      ),
      ['Statement continuity', ''],
      ...Object.values(gp).flatMap((a) =>
        a.slice(0, -1).flatMap((f, i): CellVal[][] => {
          const n = a[i + 1];
          const g =
            f.pt != null && n.from != null ? Math.round((n.from - f.pt) / 864e5) - 1 : 0;
          return [
            [
              `${f.name} closing vs ${n.name} opening (should be 0.00)`,
              r2(f.open + sm(f.rows) - n.open),
            ],
            [`Gap or overlap between ${f.name} and ${n.name} (days, should be 0)`, String(g)],
          ];
        })
      ),
    ];

    const ty: Record<string, { n: number; t: number; u: number; ut: number }> = {};
    B.forEach((b) => {
      const o = (ty[b.typ] = ty[b.typ] || { n: 0, t: 0, u: 0, ut: 0 });
      o.n++;
      o.t += b.amt;
      if (!b.m) {
        o.u++;
        o.ut += b.amt;
      }
    });

    const mo: Record<string, { b: number; t: number; u: number }> = {};
    B.forEach((b) => {
      const o = (mo[mk(b.date)] = mo[mk(b.date)] || { b: 0, t: 0, u: 0 });
      o.b += b.amt;
      if (!b.m) o.u++;
    });
    T.forEach((t) => {
      const o = (mo[mk(t.date)] = mo[mk(t.date)] || { b: 0, t: 0, u: 0 });
      o.t += t.amt;
    });

    const sets: Record<string, ResultTableSet> = {
      'Reconciliation statement': { h: ['Particulars', 'Lines', 'Amount'], r: RS },
      'By statement': {
        h: [
          'Statement',
          'Code / segment',
          'Period',
          'Opening',
          'Invoices (+)',
          'Payments and credits (−)',
          'Closing',
          'Lines',
          'Matched',
          'Unmatched',
          'Unmatched amount',
        ],
        r: BS,
      },
      'By Tally ledger': {
        h: [
          'Tally ledger sheet',
          'Entries',
          'Debit total',
          'Credit total',
          'Net (credit − debit)',
          'Matched',
          'Unmatched',
          'Unmatched amount',
        ],
        r: TR,
      },
      Matched: { h: mh, r: ok.map(mr) },
      'Amount differences': { h: mh, r: df.map(mr) },
      'Only in BMW': {
        h: [
          'BMW doc no.',
          'Reference',
          'Assignment',
          'Type',
          'Posting date',
          'Header text',
          'Amount',
          'Clearing doc',
          'Likely cause',
          'Statement',
        ],
        r: oB.map((b) => [
          b.doc,
          b.ref,
          b.asg,
          b.typ,
          d2s(b.date),
          b.hdr,
          b.amt,
          b.clr,
          CAUSE[b.typ] || 'Check manually',
          b.file,
        ]),
      },
      'Only in Tally': {
        h: [
          'Ledger sheet',
          'Date',
          'Particulars',
          'Voucher type',
          'Voucher no.',
          'Narration',
          'Amount',
          'Note',
        ],
        r: oT.map((t) => [
          t.sheet,
          d2s(t.date),
          t.part,
          t.vtype,
          t.vno,
          t.narr,
          t.amt,
          'Not on BMW statement: check period, ledger or posting',
        ]),
      },
      'Group matches': {
        h: ['Key', 'BMW lines', 'BMW net', 'Tally lines', 'Tally net', 'Difference', 'Types'],
        r: G.map((g) => [
          g.k,
          String(g.bs.length),
          g.nb,
          String(g.ts.length),
          g.nt,
          r2(g.nb - g.nt),
          [...new Set(g.bs.map((b) => b.typ))].join(', '),
        ]),
      },
      'By reference': {
        h: [
          'Reference',
          'BMW lines',
          'BMW net',
          'Tally lines',
          'Tally net',
          'Difference',
          'Status',
        ],
        r: RF,
      },
      'Open items': {
        h: ['Doc no.', 'Reference', 'Type', 'Posting date', 'Age (days)', 'Amount', 'Age bucket'],
        r: OP,
      },
      Duplicates: {
        h: ['Source', 'Date', 'Reference / voucher', 'Amount', 'Count'],
        r: DU,
      },
      'By type': {
        h: ['Type', 'Lines', 'Total amount', 'Unmatched lines', 'Unmatched amount'],
        r: Object.keys(ty)
          .sort()
          .map((k) => [k, String(ty[k].n), r2(ty[k].t), String(ty[k].u), r2(ty[k].ut)]),
      },
      'By month': {
        h: ['Month', 'BMW net', 'Tally net', 'Difference', 'BMW lines unmatched'],
        r: Object.keys(mo)
          .sort()
          .map((k) => [k, r2(mo[k].b), r2(mo[k].t), r2(mo[k].b - mo[k].t), String(mo[k].u)]),
      },
    };

    setResult({
      sum,
      diff,
      un,
      sets,
      raw: {
        B,
        T,
        ok,
        df,
        oB,
        oT,
        G,
        endMs: end,
        dups: dupList,
        tolVal,
        RS,
        BS,
        TR,
        idx,
      },
    });
    setActiveTab('Summary');
    setSortState({ t: '', c: null, d: 1 });
    setStatus({
      text: `Done: ${M.length} pair(s) matched, ${oB.length} only in BMW, ${oT.length} only in Tally.`,
      tone: 'ok',
    });
  };

  const availablePeriods = useMemo(() => {
    if (!result) return undefined;
    const keys = [
      ...result.raw.B.map((b) => utcMsToKey(b.date)),
      ...result.raw.T.map((t) => utcMsToKey(t.date)),
    ];
    return extractPeriodChoicesFromKeys(keys);
  }, [result]);

  const periodBounds = useMemo(() => resolveRecoPeriodBounds(periodFilter), [periodFilter]);

  const scopedResult = useMemo(() => {
    if (!result) return null;
    if (!periodBounds.isFiltered) return result;

    const { B, T, ok, df, oB, oT, G, endMs, dups, tolVal, RS, BS, TR, idx } = result.raw;
    const inPeriodMs = (ms: number | null | undefined) =>
      isDateKeyInRecoPeriod(utcMsToKey(ms), periodFilter);

    const pB = B.filter((b) => inPeriodMs(b.date));
    const pT = T.filter((t) => inPeriodMs(t.date));
    const pOk = ok.filter((x) => inPeriodMs(x.b.date ?? x.t.date));
    const pDf = df.filter((x) => inPeriodMs(x.b.date ?? x.t.date));
    const pOB = oB.filter((b) => inPeriodMs(b.date));
    const pOT = oT.filter((t) => inPeriodMs(t.date));
    const pG = G.filter((g) => g.bs.some((b) => inPeriodMs(b.date)) || g.ts.some((t) => inPeriodMs(t.date)));
    const pDups = dups.filter((d) => inPeriodMs(d.dateMs));

    const mr = (x: MatchPair): CellVal[] => [
      x.kind,
      x.b.doc,
      x.b.ref,
      x.b.typ,
      d2s(x.b.date),
      x.b.amt,
      d2s(x.t.date),
      x.t.vno || x.t.ref || x.t.part,
      x.t.amt,
      r2(x.b.amt - x.t.amt),
      x.b.date == null ? '' : String(Math.round((x.t.date - x.b.date) / 864e5)),
    ];

    const rg: Record<string, BmwLine[]> = {};
    pB.forEach((b) => {
      const k = [...toks(b.ref)][0] || b.doc;
      (rg[k] = rg[k] || []).push(b);
    });
    const pRF: CellVal[][] = Object.keys(rg)
      .map((k): CellVal[] => {
        const bs = rg[k];
        const ts = [...new Set(idx.get(k) || [])].filter((t) => inPeriodMs(t.date));
        const nb = sm(bs);
        const nt = sm(ts);
        const d = r2(nb - nt);
        return [
          k,
          String(bs.length),
          nb,
          String(ts.length),
          nt,
          d,
          !ts.length ? 'Not in Tally' : Math.abs(d) <= tolVal ? 'OK' : 'Differs',
        ];
      })
      .sort((a, b) => Math.abs(Number(b[5])) - Math.abs(Number(a[5])));

    const bk = (a: number) => (a <= 30 ? '0-30' : a <= 60 ? '31-60' : a <= 90 ? '61-90' : '90+');
    const pOP: CellVal[][] = pB
      .filter((b) => b.clr === '' || b.clr === '0')
      .map((b) => {
        const a = b.date != null ? Math.round((endMs - b.date) / 864e5) : 0;
        return [b.doc, b.ref, b.typ, d2s(b.date), String(a), b.amt, bk(a)];
      });

    const pTy: Record<string, { n: number; t: number; u: number; ut: number }> = {};
    pB.forEach((b) => {
      const o = (pTy[b.typ] = pTy[b.typ] || { n: 0, t: 0, u: 0, ut: 0 });
      o.n++;
      o.t += b.amt;
      if (!b.m) {
        o.u++;
        o.ut += b.amt;
      }
    });

    const pMo: Record<string, { b: number; t: number; u: number }> = {};
    pB.forEach((b) => {
      const o = (pMo[mk(b.date)] = pMo[mk(b.date)] || { b: 0, t: 0, u: 0 });
      o.b += b.amt;
      if (!b.m) o.u++;
    });
    pT.forEach((t) => {
      const o = (pMo[mk(t.date)] = pMo[mk(t.date)] || { b: 0, t: 0, u: 0 });
      o.t += t.amt;
    });

    const periodSumRows: CellVal[][] = [
      [`Selected period (${periodBounds.label})`, periodBounds.rangeText],
      ['Period BMW lines / Net movement', r2(sm(pB))],
      ['Period BMW invoices & debits (+)', r2(sm(pB.filter((b) => b.amt > 0)))],
      ['Period BMW payments, TDS & credits (−)', r2(sm(pB.filter((b) => b.amt < 0)))],
      ['Period Tally entries / Net movement', r2(sm(pT))],
      ['Period Matched pairs', `${pOk.length} matched · ${pDf.length} amount diff`],
      ['Period Only in BMW', `${pOB.length} items · ₹ ${fmt(sm(pOB))}`],
      ['Period Only in Tally', `${pOT.length} items · ₹ ${fmt(sm(pOT))}`],
      ['Full statement summary (opening-closing bridge)', ''],
      ...result.sum,
    ];

    const mh = result.sets['Matched'].h;
    const scopedSets: Record<string, ResultTableSet> = {
      'Reconciliation statement': { h: result.sets['Reconciliation statement'].h, r: RS },
      'By statement': { h: result.sets['By statement'].h, r: BS },
      'By Tally ledger': { h: result.sets['By Tally ledger'].h, r: TR },
      Matched: { h: mh, r: pOk.map(mr) },
      'Amount differences': { h: mh, r: pDf.map(mr) },
      'Only in BMW': {
        h: result.sets['Only in BMW'].h,
        r: pOB.map((b) => [
          b.doc,
          b.ref,
          b.asg,
          b.typ,
          d2s(b.date),
          b.hdr,
          b.amt,
          b.clr,
          CAUSE[b.typ] || 'Check manually',
          b.file,
        ]),
      },
      'Only in Tally': {
        h: result.sets['Only in Tally'].h,
        r: pOT.map((t) => [
          t.sheet,
          d2s(t.date),
          t.part,
          t.vtype,
          t.vno,
          t.narr,
          t.amt,
          'Not on BMW statement: check period, ledger or posting',
        ]),
      },
      'Group matches': {
        h: result.sets['Group matches'].h,
        r: pG.map((g) => [
          g.k,
          String(g.bs.length),
          g.nb,
          String(g.ts.length),
          g.nt,
          r2(g.nb - g.nt),
          [...new Set(g.bs.map((b) => b.typ))].join(', '),
        ]),
      },
      'By reference': { h: result.sets['By reference'].h, r: pRF },
      'Open items': { h: result.sets['Open items'].h, r: pOP },
      Duplicates: {
        h: result.sets['Duplicates'].h,
        r: pDups.map((o) => [o.s, o.d, o.r, o.a, String(o.n)]),
      },
      'By type': {
        h: result.sets['By type'].h,
        r: Object.keys(pTy)
          .sort()
          .map((k) => [k, String(pTy[k].n), r2(pTy[k].t), String(pTy[k].u), r2(pTy[k].ut)]),
      },
      'By month': {
        h: result.sets['By month'].h,
        r: Object.keys(pMo)
          .sort()
          .map((k) => [k, r2(pMo[k].b), r2(pMo[k].t), r2(pMo[k].b - pMo[k].t), String(pMo[k].u)]),
      },
    };

    return {
      ...result,
      sum: periodSumRows,
      sets: scopedSets,
    };
  }, [result, periodFilter, periodBounds]);

  const tabNames = useMemo(
    () => (scopedResult ? ['Summary', ...Object.keys(scopedResult.sets)] : []),
    [scopedResult]
  );

  const activeTable = useMemo<{ h: string[]; r: CellVal[][] } | null>(() => {
    if (!scopedResult) return null;
    if (activeTab === 'Summary') return { h: ['Item', 'Amount / count'], r: scopedResult.sum };
    return scopedResult.sets[activeTab] || null;
  }, [scopedResult, activeTab]);

  const filteredSortedRows = useMemo(() => {
    if (!activeTable) return [];
    const q = searchQuery.trim().toLowerCase();
    let rows = q
      ? activeTable.r.filter((x) => x.join(' ').toLowerCase().includes(q))
      : activeTable.r;

    if (sortState.t === activeTab && sortState.c != null) {
      const colIdx = sortState.c;
      const nv = (v: CellVal) =>
        typeof v === 'number' ? v : /^-?\d+(\.\d+)?$/.test(String(v)) ? +v : null;
      rows = [...rows].sort((a, b) => {
        const x = nv(a[colIdx]);
        const y = nv(b[colIdx]);
        return (
          sortState.d *
          (x != null && y != null ? x - y : String(a[colIdx]).localeCompare(String(b[colIdx])))
        );
      });
    }
    return rows;
  }, [activeTable, searchQuery, sortState, activeTab]);

  const handleExportExcel = () => {
    if (!scopedResult) return;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([['Item', 'Amount / count'], ...scopedResult.sum]),
      'Summary'
    );
    Object.entries(scopedResult.sets).forEach(([sheetTitle, tbl]) => {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([tbl.h, ...tbl.r]), sheetTitle);
    });
    XLSX.writeFile(
      wb,
      `BMW_vs_Tally_Reconciliation${periodBounds.isFiltered ? `_${periodBounds.shortLabel}` : ''}.xlsx`
    );
  };

  const handleExportCsv = () => {
    if (!activeTable) return;
    const csvCell = (v: CellVal) => `"${String(v).replace(/"/g, '""')}"`;
    const csvText = `\ufeff${[activeTable.h, ...activeTable.r]
      .map((row) => row.map(csvCell).join(','))
      .join('\n')}`;
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeTab.replace(/\W+/g, '_')}${periodBounds.isFiltered ? `_${periodBounds.shortLabel}` : ''}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1200);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="no-print bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 sm:p-6 shadow-[0_4px_0_#2F3E4E] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#CEE5DC] border border-[#2F3E4E] text-[11px] font-mono font-bold text-[#2F3E4E]">
              <GitCompareArrows className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{tool?.code ?? 'VC-06'} · Account Statement Audit</span>
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white border border-[#12805C]/35 text-[11px] font-bold text-[#12805C]">
              <HardDrive className="w-3 h-3" aria-hidden="true" />
              <span>100% Browser-Local</span>
            </span>
          </div>

          <h1 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] tracking-tight">
            {tool?.title ?? 'Customer Ledger (Purchase Only)'}
          </h1>
          <p className="text-xs sm:text-sm text-[#475569] max-w-3xl leading-relaxed">
            Upload multiple BMW Statements of Account (any quarter, any dealer code) and Tally
            ledger exports. Reconciles across reference tokens, date windows &amp; group nets
            directly inside your browser. Click any column heading to sort.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">

          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="px-3.5 py-2 min-h-[40px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] cursor-pointer transition"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Upload & Reconciliation Settings Card */}
      <div className="no-print bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 sm:p-6 shadow-[0_4px_0_#2F3E4E] space-y-5">
        {/* Upload Boxes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FileDropZone
            accept=".xlsx,.xls"
            multiple
            onFiles={(files) => {
              void handleBmwUpload(filesToFileList(files));
            }}
            className="rounded-xl border-[1.5px] border-dashed border-[#2F3E4E]/50 bg-[#FEF2C8]/40 p-4 space-y-2 transition-colors"
            activeClassName="border-[#2F3E4E] bg-[#F9C80E]/30 ring-2 ring-[#F9C80E]"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-display font-extrabold text-[#2F3E4E]">
                1. BMW Statements of Account (.xlsx, .xls)
              </span>
              <span className="px-2 py-0.5 rounded bg-white border border-[#2F3E4E]/30 font-mono text-[11px] font-bold text-[#2F3E4E]">
                {bmwFiles.length} file(s)
              </span>
            </div>
            <p className="text-[11px] text-[#475569]">
              Drag &amp; drop or select as many quarter statements or dealer codes as needed.
            </p>
            <input
              ref={bmwInputRef}
              type="file"
              accept=".xlsx,.xls"
              multiple
              onChange={(e) => {
                void handleBmwUpload(e.target.files);
                e.target.value = '';
              }}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => bmwInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] cursor-pointer transition"
            >
              <Upload className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Select or Drop BMW Statement Excel(s)</span>
            </button>
          </FileDropZone>

          <FileDropZone
            accept=".xlsx,.xls"
            multiple
            onFiles={(files) => {
              void handleTallyUpload(filesToFileList(files));
            }}
            className="rounded-xl border-[1.5px] border-dashed border-[#2F3E4E]/50 bg-[#CEE5DC]/35 p-4 space-y-2 transition-colors"
            activeClassName="border-[#2F3E4E] bg-[#F9C80E]/30 ring-2 ring-[#F9C80E]"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-display font-extrabold text-[#2F3E4E]">
                2. Tally Ledger Exports (.xlsx, .xls)
              </span>
              <span className="px-2 py-0.5 rounded bg-white border border-[#2F3E4E]/30 font-mono text-[11px] font-bold text-[#2F3E4E]">
                {tallySheets.length} sheet(s)
              </span>
            </div>
            <p className="text-[11px] text-[#475569]">
              Drag &amp; drop or select Tally ledger Excel exports; every sheet with Date +
              Debit/Credit is read.
            </p>
            <input
              ref={tallyInputRef}
              type="file"
              accept=".xlsx,.xls"
              multiple
              onChange={(e) => {
                void handleTallyUpload(e.target.files);
                e.target.value = '';
              }}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => tallyInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] cursor-pointer transition"
            >
              <Upload className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Select or Drop Tally Ledger Excel(s)</span>
            </button>
          </FileDropZone>
        </div>

        {/* Uploaded BMW Statement Chips */}
        {bmwFiles.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#475569]">
              Loaded BMW Statements
            </p>
            <div className="flex flex-wrap gap-2">
              {bmwFiles.map((f, idx) => (
                <div
                  key={f.name}
                  className="rounded-xl border border-[#2F3E4E]/35 bg-white px-3 py-2 text-xs space-y-1 shadow-xs"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-bold text-[#2F3E4E]">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => setBmwFiles((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-red-700 hover:text-red-900 font-bold text-[11px] inline-flex items-center gap-0.5 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" aria-hidden="true" />
                      <span>Remove</span>
                    </button>
                  </div>
                  <p className="font-mono text-[11px] text-[#64748B]">
                    Code {f.code || '?'} {f.seg} · {d2s(f.from)} to {d2s(f.pt)} · {f.rows.length}{' '}
                    lines · opening {fmt(f.open)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tally Column Mapping & Active Sheet Toggles */}
        {tallySheets.length > 0 && (
          <div className="rounded-xl border border-[#2F3E4E]/30 bg-white p-4 space-y-3">
            <h2 className="font-display font-extrabold text-xs uppercase tracking-wider text-[#2F3E4E]">
              Tally Column Mapping &amp; Sheets
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {ROLES.map(([key, label]) => (
                <label key={key} className="flex flex-col gap-1 text-[11px] font-bold text-[#475569]">
                  <span>{label}</span>
                  <select
                    value={colMap[key]}
                    onChange={(e) =>
                      setColMap((prev) => ({
                        ...prev,
                        [key]: e.target.value,
                      }))
                    }
                    className="px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/45 bg-[#FFFDF5] text-xs font-semibold text-[#2F3E4E]"
                  >
                    <option value="">(none)</option>
                    {allTallyHeaders.map((hdr) => (
                      <option key={hdr} value={hdr}>
                        {hdr}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>

            <div className="flex flex-wrap gap-3 pt-2 border-t border-[#2F3E4E]/15">
              {tallySheets.map((sh, idx) => (
                <label
                  key={sh.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#2F3E4E]/25 bg-[#FEF2C8]/45 text-xs font-semibold text-[#2F3E4E] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={sh.on}
                    onChange={(e) =>
                      setTallySheets((prev) =>
                        prev.map((item, i) => (i === idx ? { ...item, on: e.target.checked } : item))
                      )
                    }
                    className="accent-[#2F3E4E] cursor-pointer"
                  />
                  <span>
                    {sh.name} ({sh.rows.length} rows)
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Matching Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 items-end pt-1">
          <label className="flex flex-col gap-1 text-xs font-bold text-[#2F3E4E]">
            <span>Amount tolerance (₹)</span>
            <input
              type="number"
              step="0.01"
              value={tol}
              onChange={(e) => setTol(e.target.value)}
              className="px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E]/60 bg-white font-mono text-xs text-[#2F3E4E]"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-bold text-[#2F3E4E]">
            <span>Date window for amount-only match (days)</span>
            <input
              type="number"
              value={win}
              onChange={(e) => setWin(e.target.value)}
              className="px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E]/60 bg-white font-mono text-xs text-[#2F3E4E]"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-bold text-[#2F3E4E]">
            <span>Tally opening balance (blank = detect)</span>
            <input
              type="number"
              step="0.01"
              value={top}
              onChange={(e) => setTop(e.target.value)}
              placeholder="Auto-detect from Tally"
              className="px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E]/60 bg-white font-mono text-xs text-[#2F3E4E]"
            />
          </label>

          <label className="inline-flex items-center gap-2 min-h-[38px] px-3 py-2 rounded-lg border border-[#2F3E4E]/30 bg-white text-xs font-bold text-[#2F3E4E] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={flip}
              onChange={(e) => setFlip(e.target.checked)}
              className="w-4 h-4 accent-[#2F3E4E] cursor-pointer"
            />
            <span>Flip sign (Tally debit = BMW payable)</span>
          </label>
        </div>

        {/* Status Message */}
        <div className="flex items-center gap-2 text-xs font-semibold">
          {status.tone === 'ok' && (
            <CheckCircle2 className="w-4 h-4 text-[#12805C] shrink-0" aria-hidden="true" />
          )}
          {status.tone === 'warn' && (
            <AlertCircle className="w-4 h-4 text-red-700 shrink-0" aria-hidden="true" />
          )}
          <span
            className={
              status.tone === 'warn'
                ? 'text-red-800'
                : status.tone === 'ok'
                ? 'text-[#12805C]'
                : 'text-[#475569]'
            }
          >
            {status.text}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={runReconcile}
            className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[42px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#2F3E4E] hover:bg-[#1E293B] text-[#F9C80E] shadow-[0_3px_0_#1A242F] text-xs sm:text-sm font-display font-extrabold cursor-pointer transition"
          >
            <GitCompareArrows className="w-4 h-4" aria-hidden="true" />
            <span>Reconcile</span>
          </button>

          <button
            type="button"
            onClick={handleClearAll}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[42px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] cursor-pointer transition"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Clear All Files</span>
          </button>

          <button
            type="button"
            onClick={handleResetPrefs}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[42px] rounded-xl border-[1.5px] border-[#2F3E4E]/50 bg-white hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] cursor-pointer transition"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Reset Settings</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={!result}
            className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[42px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#F9C80E] hover:bg-[#FFE1B3] disabled:opacity-45 text-xs font-display font-extrabold text-[#2F3E4E] cursor-pointer disabled:cursor-not-allowed transition"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Download Excel Report</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={!result}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[42px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#CEE5DC] hover:bg-[#F9C80E] disabled:opacity-45 text-xs font-bold text-[#2F3E4E] cursor-pointer disabled:cursor-not-allowed transition"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Download This Tab (CSV)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              void exportElementToPdf({
                element: resultsPanelRef.current,
                filename: `BMW_Reconciliation_${activeTab.replace(/\s+/g, '_')}.pdf`,
                orientation: 'landscape',
                prepareClone: (clonedDoc) => {
                  clonedDoc.querySelectorAll('.overflow-auto').forEach((n) => {
                    (n as HTMLElement).style.maxHeight = 'none';
                    (n as HTMLElement).style.overflow = 'visible';
                  });
                },
              });
            }}
            disabled={!result}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[42px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FFE1B3] hover:bg-[#F9C80E] disabled:opacity-45 text-xs font-bold text-[#2F3E4E] cursor-pointer disabled:cursor-not-allowed transition whitespace-nowrap"
          >
            <FileText className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Save PDF</span>
          </button>

          <button
            type="button"
            onClick={() => {
              void printTargetElement({
                element: resultsPanelRef.current,
                title: `BMW_Reconciliation_${activeTab}`,
                orientation: 'landscape',
                prepareClone: (clone) => {
                  clone.style.boxShadow = 'none';
                  clone.style.border = '0';
                  clone.querySelectorAll('.overflow-auto').forEach((n) => {
                    (n as HTMLElement).style.maxHeight = 'none';
                    (n as HTMLElement).style.overflow = 'visible';
                  });
                },
              });
            }}
            disabled={!result}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[42px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] disabled:opacity-45 text-xs font-bold text-[#2F3E4E] cursor-pointer disabled:cursor-not-allowed transition whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Print Tab</span>
          </button>
        </div>
      </div>

      {/* Results View */}
      {result && scopedResult && activeTable && (
        <div
          ref={resultsPanelRef}
          className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 sm:p-6 shadow-[0_4px_0_#2F3E4E] space-y-4 print:border-0 print:p-0 print:shadow-none print:bg-white"
        >
          {/* Advanced Period & Date Filter */}
          <RecoPeriodFilterBar
            value={periodFilter}
            onChange={setPeriodFilter}
            available={availablePeriods}
            matchedCount={
              scopedResult.sets['Matched'].r.length +
              scopedResult.sets['Amount differences'].r.length +
              scopedResult.sets['Only in BMW'].r.length +
              scopedResult.sets['Only in Tally'].r.length
            }
            totalCount={
              result.raw.ok.length +
              result.raw.df.length +
              result.raw.oB.length +
              result.raw.oT.length
            }
            scopeHint="Filters matched/unmatched/monthly/type tabs & exports while preserving full statement closing bridge"
            compact
          />

          {/* Result Sheet Tabs */}
          <div className="no-print flex flex-wrap items-center gap-1.5 pb-3 border-b border-[#2F3E4E]/15">
            {tabNames.map((name) => {
              const isOn = activeTab === name;
              const count = name === 'Summary' ? null : scopedResult.sets[name]?.r.length ?? 0;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    setActiveTab(name);
                    setSortState({ t: '', c: null, d: 1 });
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer ${
                    isOn
                      ? 'bg-[#2F3E4E] text-[#F9C80E] border-[#2F3E4E] shadow-[0_2px_0_#1E293B]'
                      : 'bg-white text-[#2F3E4E] border-[#2F3E4E]/25 hover:bg-[#FEF2C8]'
                  }`}
                >
                  <span>{name}</span>
                  {count !== null && (
                    <span
                      className={`font-mono text-[11px] tabular-nums ${
                        isOn ? 'text-[#FFFDF5]' : 'text-[#64748B]'
                      }`}
                    >
                      ({count})
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="no-print relative max-w-md">
            <Search
              className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search this tab: invoice no., amount, VIN, narration..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E]/45 bg-white text-xs text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
            />
          </div>

          {/* Summary Banner */}
          {activeTab === 'Summary' && (
            <div className="rounded-xl border-l-4 border-[#2F3E4E] bg-[#FEF2C8]/75 px-4 py-3 text-sm font-semibold text-[#2F3E4E] flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>
                Closing difference: <strong className="font-mono">{fmt(result.diff)}</strong>
              </span>
              <span>
                Unexplained:{' '}
                <strong
                  className={`font-mono ${
                    Math.abs(result.un) < 0.01 ? 'text-[#12805C]' : 'text-red-700'
                  }`}
                >
                  {fmt(result.un)}
                </strong>
              </span>
            </div>
          )}

          {/* Table */}
          <div className="overflow-auto max-h-[70vh] print:max-h-none print:overflow-visible border border-[#2F3E4E]/30 rounded-xl bg-white">
            <table className="w-full border-collapse text-xs font-mono tabular-nums">
              <thead className="sticky top-0 z-10 bg-[#2F3E4E] text-[#FFFDF5] print:static">
                <tr>
                  {activeTable.h.map((hdr, colIdx) => {
                    const isSorted = sortState.t === activeTab && sortState.c === colIdx;
                    return (
                      <th
                        key={hdr}
                        onClick={() =>
                          setSortState((prev) => ({
                            t: activeTab,
                            c: colIdx,
                            d: prev.t === activeTab && prev.c === colIdx ? (prev.d === 1 ? -1 : 1) : 1,
                          }))
                        }
                        className="px-3 py-2.5 text-left font-sans font-bold text-[11px] whitespace-nowrap border-r border-white/15 last:border-r-0 cursor-pointer select-none hover:bg-[#1E293B]"
                      >
                        {hdr}
                        {isSorted ? (sortState.d > 0 ? ' ▲' : ' ▼') : ''}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filteredSortedRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={activeTable.h.length}
                      className="px-4 py-8 text-center font-sans text-xs text-[#64748B]"
                    >
                      No rows match this view.
                    </td>
                  </tr>
                ) : (
                  filteredSortedRows.map((row, rowIdx) => {
                    const isSectionHeader =
                      row[1] === '' && activeTable.h[1] === 'Amount / count';
                    return (
                      <tr
                        key={rowIdx}
                        className={`border-b border-[#2F3E4E]/15 ${
                          isSectionHeader
                            ? 'bg-[#FEF2C8] font-sans font-extrabold text-[#2F3E4E]'
                            : rowIdx % 2 === 0
                            ? 'bg-white'
                            : 'bg-[#FFFDF5]'
                        }`}
                      >
                        {row.map((cell, cellIdx) => {
                          if (typeof cell === 'number') {
                            const isCheckZeroRow =
                              typeof row[0] === 'string' &&
                              /(unexplained|check: should be 0\.00|should be 0\.00)/i.test(row[0]);
                            const numTone = isCheckZeroRow
                              ? Math.abs(cell) < 0.01
                                ? 'text-[#12805C] font-bold'
                                : 'text-red-700 font-bold'
                              : '';
                            return (
                              <td
                                key={cellIdx}
                                className={`px-3 py-1.5 text-right whitespace-nowrap ${numTone}`}
                              >
                                {fmt(cell)}
                              </td>
                            );
                          }
                          const strVal = String(cell);
                          const statusTone =
                            strVal === 'OK'
                              ? 'text-[#12805C] font-bold'
                              : strVal === 'Not in Tally' || strVal === 'Differs'
                              ? 'text-red-700 font-bold'
                              : '';
                          return (
                            <td
                              key={cellIdx}
                              className={`px-3 py-1.5 whitespace-nowrap ${
                                isSectionHeader ? 'font-sans font-extrabold' : ''
                              } ${statusTone}`}
                            >
                              {cell}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <p className="text-[11px] font-semibold text-[#64748B]">
            Showing {filteredSortedRows.length} of {activeTable.r.length} row(s)
          </p>
        </div>
      )}
    </div>
  );
};
