import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  GitCompareArrows,
  RotateCcw,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { ToolCatalogItem } from '../../types/tools';

interface DmsTallyReconcilerViewProps {
  tool?: ToolCatalogItem;
  onBack?: () => void;
}

const CATS = ['Sales', 'Purchase', 'Debit Note', 'Credit Note', 'Other'] as const;
type VoucherCategory = (typeof CATS)[number];
type CategoryOverride = 'Auto' | VoucherCategory;
type SideKey = 'dms' | 'tally';
type FieldKey = 'vno' | 'date' | 'party' | 'amt' | 'amt2' | 'type';

const FIELDS: ReadonlyArray<[FieldKey, string]> = [
  ['vno', 'Voucher / Invoice No'],
  ['date', 'Date'],
  ['party', 'Party'],
  ['amt', 'Amount'],
  ['amt2', 'Amount 2 (e.g. Credit)'],
  ['type', 'Type / Vch Type'],
];

const AUTO_PATTERNS: Record<FieldKey, RegExp[]> = {
  vno: [/vch\s*no|voucher\s*no|invoice\s*#|invoice\s*no|inv\w*\s*no|bill\s*no|doc\s*no/i],
  date: [/^(invoice\s*|vch\s*|bill\s*)?date$/i],
  party: [/particulars/i, /billing customer/i, /party|customer|ledger/i],
  amt: [/final amount with tax/i, /gross|invoice amount|total amount/i, /^debit/i, /amount/i],
  amt2: [/^credit/i],
  type: [/vch\s*type|voucher\s*type/i, /^type$/i],
};

type ReconStatus =
  | 'Matched'
  | 'Amount diff'
  | 'Date diff'
  | 'Type diff'
  | 'Fuzzy match'
  | 'Only in DMS'
  | 'Only in Tally';

const STATUS_ORDER: ReconStatus[] = [
  'Matched',
  'Amount diff',
  'Date diff',
  'Type diff',
  'Fuzzy match',
  'Only in DMS',
  'Only in Tally',
];

const STATUS_BADGE_STYLES: Record<ReconStatus, { badge: string; border: string }> = {
  Matched: {
    badge: 'bg-emerald-100 text-emerald-900 border-emerald-700/40',
    border: '#047857',
  },
  'Amount diff': {
    badge: 'bg-red-100 text-red-900 border-red-700/40',
    border: '#b91c1c',
  },
  'Date diff': {
    badge: 'bg-amber-100 text-amber-900 border-amber-700/40',
    border: '#b45309',
  },
  'Type diff': {
    badge: 'bg-purple-100 text-purple-900 border-purple-700/40',
    border: '#6d28d9',
  },
  'Fuzzy match': {
    badge: 'bg-blue-100 text-blue-900 border-blue-700/40',
    border: '#1d4ed8',
  },
  'Only in DMS': {
    badge: 'bg-rose-100 text-rose-900 border-rose-700/40',
    border: '#b91c1c',
  },
  'Only in Tally': {
    badge: 'bg-orange-100 text-orange-900 border-orange-700/40',
    border: '#b91c1c',
  },
};

interface UploadedSheetFile {
  id: string;
  name: string;
  headers: string[];
  rows: unknown[][];
  ov: CategoryOverride;
}

interface SideState {
  files: UploadedSheetFile[];
  map: Partial<Record<FieldKey, string>>;
  inc: Set<VoucherCategory>;
}

interface NormalizedEntry {
  side: SideKey;
  file: string;
  vno: string;
  key: string;
  date: number | null;
  party: string;
  amt: number;
  cat: VoucherCategory;
  used?: boolean;
}

interface ReconRow {
  status: ReconStatus;
  cat: VoucherCategory;
  vd: string;
  vt: string;
  dd: number | null;
  dt: number | null;
  party: string;
  a: number | null;
  b: number | null;
  diff: number;
  notes: string;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function formatMoney(n: number | null | undefined): string {
  if (n == null) return '';
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatExcelDate(n: number | null | undefined): string {
  if (n == null) return '';
  const d = new Date(Date.UTC(1899, 11, 30) + n * 864e5);
  return (
    String(d.getUTCDate()).padStart(2, '0') +
    '-' +
    String(d.getUTCMonth() + 1).padStart(2, '0') +
    '-' +
    d.getUTCFullYear()
  );
}

function parseExcelDate(v: unknown): number | null {
  if (typeof v === 'number') {
    return v > 20000 && v < 80000 ? Math.floor(v) : null;
  }
  if (!v) return null;
  const m = String(v)
    .trim()
    .match(/(\d{1,2})[-/. ]([A-Za-z]{3}|\d{1,2})[-/. ](\d{2,4})/);
  if (!m) return null;
  const mo = Number.isNaN(Number(m[2]))
    ? MONTHS.indexOf(m[2].toLowerCase())
    : Number(m[2]) - 1;
  let y = Number(m[3]);
  if (y < 100) y += 2000;
  if (mo < 0 || mo > 11) return null;
  return Math.floor(Date.UTC(y, mo, Number(m[1])) / 864e5) + 25569;
}

function parseNumber(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const x = parseFloat(String(v ?? '').replace(/[,₹\s]/g, ''));
  return Number.isNaN(x) ? 0 : x;
}

function autoIdx(headers: string[], field: FieldKey): number {
  for (const rx of AUTO_PATTERNS[field]) {
    const idx = headers.findIndex((h) => rx.test(h));
    if (idx >= 0) return idx;
  }
  return -1;
}

function detectHeaderRow(rows: unknown[][]): number {
  let bestIdx = 0;
  let bestScore = -1;
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    let score = 0;
    const row = rows[i] || [];
    row.forEach((cell) => {
      if (
        typeof cell === 'string' &&
        /date|vch|voucher|invoice|amount|debit|credit|particulars|party|customer|bill/i.test(cell)
      ) {
        score++;
      }
    });
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function parsePrefixRules(raw: string): Array<[string, VoucherCategory]> {
  return (raw || '')
    .split(',')
    .map((x) => x.split('=').map((y) => y.trim()))
    .filter(
      (parts): parts is [string, VoucherCategory] =>
        Boolean(parts[0]) && (CATS as readonly string[]).includes(parts[1])
    );
}

function catOf(
  typeVal: unknown,
  vno: string,
  ov: CategoryOverride,
  prefixRules: Array<[string, VoucherCategory]>
): VoucherCategory {
  if (ov && ov !== 'Auto') return ov;
  const v = String(vno).toUpperCase();
  for (const [prefix, cat] of prefixRules) {
    if (v.startsWith(prefix.toUpperCase())) return cat;
  }
  const t = String(typeVal || '');
  if (/credit\s*(note|memo)|^cn$/i.test(t)) return 'Credit Note';
  if (/debit\s*(note|memo)|^dn$/i.test(t)) return 'Debit Note';
  if (/purchase/i.test(t)) return 'Purchase';
  if (/sale|service|invoice|parts/i.test(t)) return 'Sales';
  return t ? 'Other' : 'Sales';
}

function normalizeVoucherKey(v: string, ignorePrefix: boolean): string {
  let k = String(v).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (ignorePrefix) {
    const m = k.match(/(\d+)$/);
    if (m) k = String(Number(m[1]));
  }
  return k;
}

function buildSideEntries(
  side: SideKey,
  sideState: SideState,
  includeAllCategories: boolean,
  ignorePrefix: boolean,
  prefixRules: Array<[string, VoucherCategory]>
): NormalizedEntry[] {
  const out: NormalizedEntry[] = [];
  sideState.files.forEach((f) => {
    const ix: Record<FieldKey, number> = {
      vno: -1,
      date: -1,
      party: -1,
      amt: -1,
      amt2: -1,
      type: -1,
    };

    FIELDS.forEach(([k]) => {
      const mapped = sideState.map[k] ?? '';
      let idx = mapped ? f.headers.indexOf(mapped) : -1;
      if (idx < 0 && mapped !== '') {
        idx = autoIdx(f.headers, k);
      }
      ix[k] = idx;
    });

    if (ix.vno < 0) return;

    f.rows.forEach((r) => {
      const vno = String(r[ix.vno] ?? '').trim();
      const dateRaw = ix.date >= 0 ? String(r[ix.date] ?? '') : '';
      if (!vno || /^total/i.test(vno) || /^total/i.test(dateRaw)) return;

      let a = ix.amt >= 0 ? parseNumber(r[ix.amt]) : 0;
      if (!a && ix.amt2 >= 0) a = parseNumber(r[ix.amt2]);

      const cat = catOf(ix.type >= 0 ? r[ix.type] : '', vno, f.ov, prefixRules);
      if (!includeAllCategories && !sideState.inc.has(cat)) return;

      out.push({
        side,
        file: f.name,
        vno,
        key: normalizeVoucherKey(vno, ignorePrefix),
        date: ix.date >= 0 ? parseExcelDate(r[ix.date]) : null,
        party: ix.party >= 0 ? String(r[ix.party] ?? '') : '',
        amt: Math.abs(a),
        cat,
      });
    });
  });

  return out;
}

function pairEntries(
  a: NormalizedEntry,
  b: NormalizedEntry,
  tol: number,
  dd: number,
  dupNote: string
): ReconRow {
  const diff = Math.round((a.amt - b.amt) * 100) / 100;
  const notes: string[] = [];
  let st: ReconStatus = 'Matched';
  const absAmtDiff = Math.abs(diff) > tol;
  const gap = a.date != null && b.date != null ? Math.abs(a.date - b.date) : 0;

  if (absAmtDiff) {
    st = 'Amount diff';
    notes.push('Amount differs by ' + formatMoney(diff));
  } else if (diff) {
    notes.push('Rounding ' + formatMoney(diff));
  }

  if (gap > dd) {
    if (st === 'Matched') st = 'Date diff';
    notes.push('Date gap ' + gap + 'd');
  }

  if (a.cat !== b.cat) {
    if (st === 'Matched') st = 'Type diff';
    notes.push('Type: DMS ' + a.cat + ' / Tally ' + b.cat);
  }

  if (dupNote) notes.push(dupNote);

  return {
    status: st,
    cat: a.cat,
    vd: a.vno,
    vt: b.vno,
    dd: a.date,
    dt: b.date,
    party: a.party || b.party,
    a: a.amt,
    b: b.amt,
    diff,
    notes: notes.join('; '),
  };
}

function createInitialSideState(): SideState {
  return {
    files: [],
    map: {},
    inc: new Set<VoucherCategory>(CATS),
  };
}

export const DmsTallyReconcilerView: React.FC<DmsTallyReconcilerViewProps> = ({ tool }) => {
  const [dmsState, setDmsState] = useState<SideState>(createInitialSideState);
  const [tallyState, setTallyState] = useState<SideState>(createInitialSideState);
  const [dragOverSide, setDragOverSide] = useState<SideKey | null>(null);

  // Matching Rules state (exact defaults from DMS vs Tally HTML)
  const [amtTol, setAmtTol] = useState<number>(1);
  const [dateTol, setDateTol] = useState<number>(0);
  const [fuzzyEnabled, setFuzzyEnabled] = useState<boolean>(true);
  const [fuzzyDays, setFuzzyDays] = useState<number>(3);
  const [fuzzySameType, setFuzzySameType] = useState<boolean>(true);
  const [ignorePrefix, setIgnorePrefix] = useState<boolean>(false);
  const [prefixRulesText, setPrefixRulesText] = useState<string>('');

  // Results & UI state
  const [results, setResults] = useState<ReconRow[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<'All' | ReconStatus>('All');
  const [typeFilter, setTypeFilter] = useState<string>('All types');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const parsedPrefixRules = useMemo(() => parsePrefixRules(prefixRulesText), [prefixRulesText]);

  const sideCounts = useMemo(() => {
    const compute = (side: SideKey, s: SideState) => {
      const counts: Record<VoucherCategory, number> = {
        Sales: 0,
        Purchase: 0,
        'Debit Note': 0,
        'Credit Note': 0,
        Other: 0,
      };
      if (s.files.length > 0) {
        try {
          buildSideEntries(side, s, true, ignorePrefix, parsedPrefixRules).forEach((entry) => {
            counts[entry.cat]++;
          });
        } catch {
          // Ignore invalid partial mappings during editing
        }
      }
      return counts;
    };

    return {
      dms: compute('dms', dmsState),
      tally: compute('tally', tallyState),
    };
  }, [dmsState, tallyState, ignorePrefix, parsedPrefixRules]);

  const handleLoadFiles = async (side: SideKey, fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setErrorMsg('');

    const loadedFiles: UploadedSheetFile[] = [];
    const failedNames: string[] = [];

    for (const f of Array.from(fileList)) {
      try {
        const buffer = await f.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = wb.SheetNames[0];
        const firstSheet = firstSheetName ? wb.Sheets[firstSheetName] : undefined;
        if (!firstSheet) {
          failedNames.push(`${f.name} (no sheets found)`);
          continue;
        }
        const rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
          header: 1,
          raw: true,
          defval: '',
        });
        if (rows.length === 0) {
          failedNames.push(`${f.name} (sheet is empty)`);
          continue;
        }
        const headerIdx = detectHeaderRow(rows);
        const headers = (rows[headerIdx] || []).map((c) => String(c ?? '').trim());
        loadedFiles.push({
          id: `${f.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: f.name,
          headers,
          rows: rows.slice(headerIdx + 1),
          ov: 'Auto',
        });
      } catch {
        failedNames.push(f.name);
      }
    }

    if (failedNames.length > 0) {
      setErrorMsg(`Could not read: ${failedNames.join(', ')}. Please verify it is a valid .xlsx, .xls, or .csv workbook.`);
    }

    if (loadedFiles.length === 0) return;

    const updater = (prev: SideState): SideState => {
      const nextFiles = [...prev.files, ...loadedFiles];
      const nextMap = { ...prev.map };
      const firstHeaders = nextFiles[0]?.headers || [];
      FIELDS.forEach(([k]) => {
        if (nextMap[k] === undefined) {
          const idx = autoIdx(firstHeaders, k);
          nextMap[k] = idx >= 0 ? firstHeaders[idx] : '';
        }
      });
      return {
        ...prev,
        files: nextFiles,
        map: nextMap,
      };
    };

    if (side === 'dms') {
      setDmsState(updater);
    } else {
      setTallyState(updater);
    }
  };

  const handleRemoveFile = (side: SideKey, fileId: string) => {
    const updater = (prev: SideState): SideState => ({
      ...prev,
      files: prev.files.filter((f) => f.id !== fileId),
    });
    if (side === 'dms') setDmsState(updater);
    else setTallyState(updater);
  };

  const handleOverrideChange = (side: SideKey, fileId: string, ov: CategoryOverride) => {
    const updater = (prev: SideState): SideState => ({
      ...prev,
      files: prev.files.map((f) => (f.id === fileId ? { ...f, ov } : f)),
    });
    if (side === 'dms') setDmsState(updater);
    else setTallyState(updater);
  };

  const handleToggleCategory = (side: SideKey, cat: VoucherCategory) => {
    const updater = (prev: SideState): SideState => {
      const nextInc = new Set(prev.inc);
      if (nextInc.has(cat)) nextInc.delete(cat);
      else nextInc.add(cat);
      return { ...prev, inc: nextInc };
    };
    if (side === 'dms') setDmsState(updater);
    else setTallyState(updater);
  };

  const handleMapChange = (side: SideKey, field: FieldKey, value: string) => {
    const updater = (prev: SideState): SideState => ({
      ...prev,
      map: { ...prev.map, [field]: value },
    });
    if (side === 'dms') setDmsState(updater);
    else setTallyState(updater);
  };

  const handleLoadSampleData = () => {
    setErrorMsg('');
    const dmsHeaders = ['Invoice No', 'Date', 'Billing Customer', 'Final Amount with Tax', 'Type'];
    const dmsRows: unknown[][] = [
      ['INV/25-26/001', '01-04-2025', 'Rohan Automobiles Pvt Ltd', 118000, 'Sales'],
      ['INV/25-26/002', '02-04-2025', 'Apex Spare Parts', 54200, 'Sales'],
      ['INV/25-26/003', '03-04-2025', 'Metro Fleet Service', 29500, 'Sales'],
      ['VMSC-014', '04-04-2025', 'Rohan Automobiles Pvt Ltd', 4500, 'Sales'],
      ['PUR/089', '05-04-2025', 'Bharat OEM Components', 86400, 'Purchase'],
      ['INV/25-26/004', '06-04-2025', 'Sunrise Logistics', 33000, 'Sales'],
      ['INV/25-26/005', '07-04-2025', 'Deccan Motors', 19800, 'Sales'],
    ];

    const tallyHeaders = ['Vch No', 'Date', 'Particulars', 'Debit', 'Credit', 'Vch Type'];
    const tallyRows: unknown[][] = [
      ['INV/25-26/001', '01-04-2025', 'Rohan Automobiles Pvt Ltd', 118000, 0, 'Sales'],
      ['INV/25-26/002', '02-04-2025', 'Apex Spare Parts', 53950, 0, 'Sales'],
      ['INV/25-26/003', '05-04-2025', 'Metro Fleet Service', 29500, 0, 'Sales'],
      ['CN/25-26/014', '04-04-2025', 'Rohan Automobiles Pvt Ltd', 0, 4500, 'Credit Note'],
      ['PUR/089', '05-04-2025', 'Bharat OEM Components', 0, 86400, 'Purchase'],
      ['INV-2526-999', '07-04-2025', 'Sunrise Logistics', 33000, 0, 'Sales'],
      ['SAL/25-26/888', '08-04-2025', 'Unrecorded Cash Customer', 12400, 0, 'Sales'],
    ];

    const dmsMap: Partial<Record<FieldKey, string>> = {};
    FIELDS.forEach(([k]) => {
      const idx = autoIdx(dmsHeaders, k);
      dmsMap[k] = idx >= 0 ? dmsHeaders[idx] : '';
    });

    const tallyMap: Partial<Record<FieldKey, string>> = {};
    FIELDS.forEach(([k]) => {
      const idx = autoIdx(tallyHeaders, k);
      tallyMap[k] = idx >= 0 ? tallyHeaders[idx] : '';
    });

    setPrefixRulesText('VMSC=Credit Note');
    setDmsState({
      files: [
        {
          id: 'sample-dms',
          name: 'Sample_DMS_Register.xlsx',
          headers: dmsHeaders,
          rows: dmsRows,
          ov: 'Auto',
        },
      ],
      map: dmsMap,
      inc: new Set(CATS),
    });

    setTallyState({
      files: [
        {
          id: 'sample-tally',
          name: 'Sample_Tally_Register.xlsx',
          headers: tallyHeaders,
          rows: tallyRows,
          ov: 'Auto',
        },
      ],
      map: tallyMap,
      inc: new Set(CATS),
    });
    setResults(null);
  };

  const handleResetAll = () => {
    setDmsState(createInitialSideState());
    setTallyState(createInitialSideState());
    setResults(null);
    setStatusFilter('All');
    setTypeFilter('All types');
    setSearchQuery('');
    setErrorMsg('');
  };

  const runReconciliation = () => {
    if (dmsState.files.length === 0 || tallyState.files.length === 0) {
      setErrorMsg('Upload at least one DMS file and one Tally file before reconciling.');
      return;
    }
    setErrorMsg('');

    const tol = Number(amtTol) || 0;
    const dd = Number(dateTol) || 0;
    const fdays = Number(fuzzyDays) || 0;

    const A = buildSideEntries('dms', dmsState, false, ignorePrefix, parsedPrefixRules);
    const B = buildSideEntries('tally', tallyState, false, ignorePrefix, parsedPrefixRules);

    const res: ReconRow[] = [];
    const mb = new Map<string, NormalizedEntry[]>();
    const ca: Record<string, number> = {};
    const cb: Record<string, number> = {};

    B.forEach((b) => {
      const list = mb.get(b.key);
      if (list) list.push(b);
      else mb.set(b.key, [b]);
      cb[b.key] = (cb[b.key] || 0) + 1;
    });
    A.forEach((a) => {
      ca[a.key] = (ca[a.key] || 0) + 1;
    });

    const left: NormalizedEntry[] = [];
    A.forEach((a) => {
      const arr = mb.get(a.key);
      if (arr && arr.length > 0) {
        const b = arr.shift()!;
        b.used = true;
        const dupNote =
          ca[a.key] > 1 || cb[a.key] > 1 ? 'Duplicate voucher no. in file(s)' : '';
        res.push(pairEntries(a, b, tol, dd, dupNote));
      } else {
        left.push(a);
      }
    });

    const lb = B.filter((b) => !b.used);

    if (fuzzyEnabled) {
      left.slice().forEach((a) => {
        let best: NormalizedEntry | null = null;
        let bestGap = 1e9;

        lb.forEach((b) => {
          if (b.used || Math.abs(a.amt - b.amt) > tol) return;
          if (fuzzySameType && a.cat !== b.cat) return;
          const gap = a.date != null && b.date != null ? Math.abs(a.date - b.date) : 0;
          if (gap > fdays) return;
          if (gap < bestGap) {
            bestGap = gap;
            best = b;
          }
        });

        if (best !== null) {
          const matchedB: NormalizedEntry = best;
          matchedB.used = true;
          const idx = left.indexOf(a);
          if (idx >= 0) left.splice(idx, 1);
          const paired = pairEntries(a, matchedB, tol, 1e9, '');
          paired.status = 'Fuzzy match';
          paired.notes = ['Voucher no. differs']
            .concat(bestGap ? ['date gap ' + bestGap + 'd'] : [])
            .join(', ');
          res.push(paired);
        }
      });
    }

    left.forEach((a) =>
      res.push({
        status: 'Only in DMS',
        cat: a.cat,
        vd: a.vno,
        vt: '',
        dd: a.date,
        dt: null,
        party: a.party,
        a: a.amt,
        b: null,
        diff: a.amt,
        notes: 'Missing in Tally',
      })
    );

    B.filter((b) => !b.used).forEach((b) =>
      res.push({
        status: 'Only in Tally',
        cat: b.cat,
        vd: '',
        vt: b.vno,
        dd: null,
        dt: b.date,
        party: b.party,
        a: null,
        b: b.amt,
        diff: -b.amt,
        notes: 'Missing in DMS',
      })
    );

    setResults(res);
    setStatusFilter('All');
    setTypeFilter('All types');
  };

  const summaryStats = useMemo(() => {
    if (!results) return null;
    const cnt: Record<ReconStatus, number> = {
      Matched: 0,
      'Amount diff': 0,
      'Date diff': 0,
      'Type diff': 0,
      'Fuzzy match': 0,
      'Only in DMS': 0,
      'Only in Tally': 0,
    };
    const sum: Record<ReconStatus, number> = {
      Matched: 0,
      'Amount diff': 0,
      'Date diff': 0,
      'Type diff': 0,
      'Fuzzy match': 0,
      'Only in DMS': 0,
      'Only in Tally': 0,
    };

    let totalA = 0;
    let totalB = 0;

    results.forEach((r) => {
      cnt[r.status]++;
      sum[r.status] += Math.abs(r.diff || 0);
      totalA += r.a || 0;
      totalB += r.b || 0;
    });

    const activeCats = CATS.filter((c) => results.some((r) => r.cat === c));
    const catBreakdown = activeCats.map((c) => {
      const items = results.filter((r) => r.cat === c);
      const a = items.reduce((s, r) => s + (r.a || 0), 0);
      const b = items.reduce((s, r) => s + (r.b || 0), 0);
      return {
        cat: c,
        dmsCount: items.filter((r) => r.a != null).length,
        dmsAmt: a,
        tallyCount: items.filter((r) => r.b != null).length,
        tallyAmt: b,
        diff: a - b,
      };
    });

    return { cnt, sum, totalA, totalB, activeCats, catBreakdown };
  }, [results]);

  const filteredResults = useMemo(() => {
    if (!results) return [];
    const q = searchQuery.toLowerCase().trim();
    return results.filter((r) => {
      if (statusFilter !== 'All' && r.status !== statusFilter) return false;
      if (typeFilter !== 'All types' && r.cat !== typeFilter) return false;
      if (q) {
        const hay = [r.vd, r.vt, r.party, r.notes].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [results, statusFilter, typeFilter, searchQuery]);

  const handleExportExcel = () => {
    if (!results) return;
    const headers = [
      'Status',
      'Type',
      'DMS voucher',
      'Tally voucher',
      'DMS date',
      'Tally date',
      'Party',
      'DMS amount',
      'Tally amount',
      'Difference',
      'Notes',
    ];
    const rowValues = (r: ReconRow) => [
      r.status,
      r.cat,
      r.vd,
      r.vt,
      formatExcelDate(r.dd),
      formatExcelDate(r.dt),
      r.party,
      r.a,
      r.b,
      r.diff,
      r.notes,
    ];

    const wb = XLSX.utils.book_new();
    const summaryRows: unknown[][] = [['Status', 'Count', 'Abs difference']];
    STATUS_ORDER.forEach((s) => {
      const matching = results.filter((r) => r.status === s);
      summaryRows.push([
        s,
        matching.length,
        matching.reduce((x, r) => x + Math.abs(r.diff || 0), 0),
      ]);
    });

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), 'Summary');
    const appendSheet = (name: string, list: ReconRow[]) => {
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([headers, ...list.map(rowValues)]),
        name
      );
    };

    appendSheet('All', results);
    appendSheet(
      'Matched',
      results.filter((r) => r.status === 'Matched')
    );
    appendSheet(
      'Differences',
      results.filter((r) => ['Amount diff', 'Date diff', 'Type diff'].includes(r.status))
    );
    appendSheet(
      'Fuzzy',
      results.filter((r) => r.status === 'Fuzzy match')
    );
    appendSheet(
      'Only in DMS',
      results.filter((r) => r.status === 'Only in DMS')
    );
    appendSheet(
      'Only in Tally',
      results.filter((r) => r.status === 'Only in Tally')
    );

    XLSX.writeFile(wb, 'DMS_vs_Tally_Reconciliation.xlsx');
  };

  const renderSidePanel = (side: SideKey) => {
    const state = side === 'dms' ? dmsState : tallyState;
    const counts = sideCounts[side];
    const uniqueHeaders = Array.from(
      new Set(state.files.flatMap((f) => f.headers).filter(Boolean))
    );
    const isDragOver = dragOverSide === side;

    return (
      <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 shadow-[0_4px_0_#2F3E4E] space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display font-extrabold text-base text-[#2F3E4E] flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[#2F3E4E] text-[#F9C80E] text-xs font-mono font-bold inline-flex items-center justify-center shrink-0">
              {side === 'dms' ? '1' : '2'}
            </span>
            <span>{side === 'dms' ? 'DMS Report' : 'Tally Report'}</span>
          </h2>
          <span className="text-[11px] font-medium text-[#64748B]">Multiple files allowed</span>
        </div>

        {/* Dropzone */}
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverSide(side);
          }}
          onDragLeave={() => setDragOverSide(null)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOverSide(null);
            void handleLoadFiles(side, e.dataTransfer.files);
          }}
          className={`flex flex-col items-center justify-center gap-1.5 border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
            isDragOver
              ? 'border-[#12805C] bg-[#CEE5DC]/50 text-[#2F3E4E]'
              : 'border-[#2F3E4E]/35 bg-[#FEF2C8]/45 hover:bg-[#FEF2C8] text-[#475569]'
          }`}
        >
          <Upload className="w-5 h-5 text-[#2F3E4E]" />
          <span className="text-xs sm:text-sm font-bold text-[#2F3E4E]">
            Drop files here or click to browse
          </span>
          <span className="text-[11px] text-[#64748B]">Supports .xlsx, .xls, .csv</span>
          <input
            type="file"
            multiple
            accept=".xlsx,.xls,.csv"
            hidden
            onChange={(e) => {
              void handleLoadFiles(side, e.target.files);
              e.target.value = '';
            }}
          />
        </label>

        {/* Uploaded Files List */}
        {state.files.length > 0 && (
          <div className="divide-y divide-[#2F3E4E]/15 border border-[#2F3E4E]/20 rounded-xl bg-white overflow-hidden">
            {state.files.map((f) => (
              <div
                key={f.id}
                className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs"
              >
                <span className="font-bold text-[#2F3E4E] flex-1 min-w-[130px] break-all">
                  {f.name}
                </span>
                <span className="text-[#64748B] font-mono tabular-nums shrink-0">
                  {f.rows.length} rows
                </span>
                <select
                  aria-label={`Voucher category override for ${f.name}`}
                  value={f.ov}
                  onChange={(e) =>
                    handleOverrideChange(side, f.id, e.target.value as CategoryOverride)
                  }
                  className="px-2 py-1 rounded-md border border-[#2F3E4E]/35 bg-[#FFFDF5] text-xs font-semibold text-[#2F3E4E]"
                >
                  <option value="Auto">Auto</option>
                  {CATS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => handleRemoveFile(side, f.id)}
                  title="Remove file"
                  aria-label={`Remove ${f.name}`}
                  className="p-1 rounded-md border border-[#2F3E4E]/25 bg-[#FEF2C8]/60 hover:bg-red-100 text-[#2F3E4E] hover:text-red-800 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Include Voucher Types */}
        <div className="space-y-2">
          <div className="text-xs font-bold text-[#2F3E4E]">Include voucher types</div>
          <div className="flex flex-wrap gap-x-3.5 gap-y-2">
            {CATS.map((cat) => (
              <label
                key={cat}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#2F3E4E] cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={state.inc.has(cat)}
                  onChange={() => handleToggleCategory(side, cat)}
                  className="accent-[#2F3E4E] rounded cursor-pointer"
                />
                <span>{cat}</span>
                <span className="text-[#64748B] font-mono text-[11px] tabular-nums">
                  ({counts[cat]})
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Column Mapping Collapsible */}
        <details className="border-t border-[#2F3E4E]/15 pt-2.5">
          <summary className="text-xs font-semibold text-[#475569] hover:text-[#2F3E4E] cursor-pointer select-none">
            Column mapping (auto-detected)
          </summary>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-3">
            {FIELDS.map(([key, label]) => (
              <label key={key} className="flex flex-col gap-1 text-[11px] font-semibold text-[#475569]">
                <span>{label}</span>
                <select
                  value={state.map[key] ?? ''}
                  onChange={(e) => handleMapChange(side, key, e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/35 bg-white text-xs text-[#2F3E4E] font-medium"
                >
                  <option value="">— none —</option>
                  {uniqueHeaders.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </details>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Tool Header Card */}
      <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-6 shadow-[0_4px_0_#2F3E4E] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#0F766E]">
            <GitCompareArrows className="w-4 h-4" />
            <span>
              {tool?.categoryName || 'VCPL Tools'} · {tool?.code || 'VC-01'}
            </span>
          </div>
          <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-[#2F3E4E] tracking-tight">
            {tool?.title || 'DMS vs Tally Reconciliation'}
          </h1>
          <p className="text-sm text-[#475569] max-w-2xl leading-relaxed">
            Upload one or many Excel/CSV files on each side, pick which voucher types to include,
            and reconcile Sales, Purchase, Debit Note &amp; Credit Note registers offline. Files
            never leave your browser.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleLoadSampleData}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#F9C80E] hover:bg-[#FFE1B3] text-xs font-bold text-[#2F3E4E] cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Load Sample Test Data</span>
          </button>
          {(dmsState.files.length > 0 || tallyState.files.length > 0 || results) && (
            <button
              type="button"
              onClick={handleResetAll}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset All</span>
            </button>
          )}
        </div>
      </div>

      {/* Dismissible Inline Validation / Read Error Alert */}
      {errorMsg && (
        <div
          role="alert"
          className="bg-red-50 border-[1.5px] border-red-800 rounded-xl p-4 flex items-center justify-between gap-3 text-xs sm:text-sm text-red-900 font-semibold"
        >
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-700" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg('')}
            aria-label="Dismiss error"
            className="p-1 rounded hover:bg-red-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Upload Sides Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {renderSidePanel('dms')}
        {renderSidePanel('tally')}
      </div>

      {/* Matching Rules Card */}
      <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 sm:p-6 shadow-[0_4px_0_#2F3E4E] space-y-4">
        <h2 className="font-display font-extrabold text-base text-[#2F3E4E]">Matching rules</h2>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-xs sm:text-sm text-[#2F3E4E] font-medium">
          <label className="inline-flex items-center gap-2">
            <span>Amount tolerance ₹</span>
            <input
              type="number"
              value={amtTol}
              min={0}
              step={0.5}
              onChange={(e) => setAmtTol(parseFloat(e.target.value) || 0)}
              className="w-20 px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/40 bg-white font-mono text-xs font-bold text-[#2F3E4E]"
            />
          </label>

          <label className="inline-flex items-center gap-2">
            <span>Date tolerance (days)</span>
            <input
              type="number"
              value={dateTol}
              min={0}
              onChange={(e) => setDateTol(parseInt(e.target.value, 10) || 0)}
              className="w-16 px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/40 bg-white font-mono text-xs font-bold text-[#2F3E4E]"
            />
          </label>

          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={fuzzyEnabled}
              onChange={(e) => setFuzzyEnabled(e.target.checked)}
              className="accent-[#2F3E4E] cursor-pointer"
            />
            <span>Fuzzy match leftovers (amount + date, ignore voucher no.)</span>
          </label>

          <label className="inline-flex items-center gap-2">
            <span>Fuzzy ± days</span>
            <input
              type="number"
              value={fuzzyDays}
              min={0}
              onChange={(e) => setFuzzyDays(parseInt(e.target.value, 10) || 0)}
              className="w-16 px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/40 bg-white font-mono text-xs font-bold text-[#2F3E4E]"
            />
          </label>

          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={fuzzySameType}
              onChange={(e) => setFuzzySameType(e.target.checked)}
              className="accent-[#2F3E4E] cursor-pointer"
            />
            <span>Fuzzy must be same type</span>
          </label>

          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={ignorePrefix}
              onChange={(e) => setIgnorePrefix(e.target.checked)}
              className="accent-[#2F3E4E] cursor-pointer"
            />
            <span>Ignore voucher prefix/leading zeros (match on trailing digits)</span>
          </label>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[#2F3E4E]/15">
          <label className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs sm:text-sm font-medium text-[#2F3E4E] flex-1">
            <span className="shrink-0">Voucher prefix → type rules (optional)</span>
            <input
              type="text"
              value={prefixRulesText}
              onChange={(e) => setPrefixRulesText(e.target.value)}
              placeholder="VMSC=Credit Note, VMPC=Credit Note"
              className="w-full sm:max-w-xs px-3 py-1.5 rounded-lg border border-[#2F3E4E]/40 bg-white text-xs text-[#2F3E4E] placeholder:text-[#94A3B8]"
            />
          </label>

          <button
            type="button"
            onClick={runReconciliation}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#2F3E4E] hover:bg-[#1E293B] text-[#FFFDF5] border-[1.5px] border-[#2F3E4E] shadow-[0_3px_0_#1E293B] text-sm font-bold cursor-pointer transition-all hover:-translate-y-0.5 shrink-0"
          >
            <CheckCircle2 className="w-4 h-4 text-[#F9C80E]" />
            <span>Reconcile Now</span>
          </button>
        </div>
      </div>

      {/* Results Section */}
      {results && summaryStats && (
        <div className="space-y-6">
          {/* Interactive Status Filter Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
            <button
              type="button"
              onClick={() => setStatusFilter('All')}
              className={`text-left bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] border-l-4 border-l-[#1D4ED8] rounded-xl p-3 transition-all cursor-pointer ${
                statusFilter === 'All'
                  ? 'ring-2 ring-[#2F3E4E] shadow-[0_3px_0_#2F3E4E] -translate-y-0.5'
                  : 'hover:bg-white'
              }`}
            >
              <span className="block text-[11px] font-medium text-[#64748B]">All entries</span>
              <strong className="block font-display font-extrabold text-xl text-[#2F3E4E] tabular-nums mt-0.5">
                {results.length}
              </strong>
            </button>

            {STATUS_ORDER.map((status) => {
              const isSelected = statusFilter === status;
              const style = STATUS_BADGE_STYLES[status];
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  style={{ borderLeftColor: style.border }}
                  className={`text-left bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] border-l-4 rounded-xl p-3 transition-all cursor-pointer ${
                    isSelected
                      ? 'ring-2 ring-[#2F3E4E] shadow-[0_3px_0_#2F3E4E] -translate-y-0.5'
                      : 'hover:bg-white'
                  }`}
                >
                  <span className="block text-[11px] font-medium text-[#64748B] truncate">
                    {status}
                  </span>
                  <strong className="block font-display font-extrabold text-xl text-[#2F3E4E] tabular-nums mt-0.5">
                    {summaryStats.cnt[status]}
                  </strong>
                  {status !== 'Matched' && (
                    <span className="block text-[11px] font-mono text-[#64748B] tabular-nums truncate mt-0.5">
                      ₹ {formatMoney(summaryStats.sum[status])}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Summary by Voucher Type */}
          <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 shadow-[0_4px_0_#2F3E4E] space-y-3">
            <h2 className="font-display font-extrabold text-base text-[#2F3E4E]">
              Summary by voucher type
            </h2>
            <div className="overflow-x-auto border border-[#2F3E4E]/20 rounded-xl bg-white">
              <table className="w-full text-xs border-collapse">
                <thead className="bg-[#FEF2C8]/75 text-[#475569] border-b border-[#2F3E4E]/20">
                  <tr>
                    <th className="py-2.5 px-3 text-left font-bold">Type</th>
                    <th className="py-2.5 px-3 text-right font-bold">DMS count</th>
                    <th className="py-2.5 px-3 text-right font-bold">DMS amount</th>
                    <th className="py-2.5 px-3 text-right font-bold">Tally count</th>
                    <th className="py-2.5 px-3 text-right font-bold">Tally amount</th>
                    <th className="py-2.5 px-3 text-right font-bold">Difference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2F3E4E]/10">
                  {summaryStats.catBreakdown.map((row) => (
                    <tr key={row.cat} className="hover:bg-[#FEF2C8]/30">
                      <td className="py-2 px-3 font-semibold text-[#2F3E4E]">{row.cat}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums">
                        {row.dmsCount}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums">
                        {formatMoney(row.dmsAmt)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums">
                        {row.tallyCount}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums">
                        {formatMoney(row.tallyAmt)}
                      </td>
                      <td
                        className={`py-2 px-3 text-right font-mono font-bold tabular-nums ${
                          Math.abs(row.diff) > 1 ? 'text-red-700' : 'text-emerald-700'
                        }`}
                      >
                        {formatMoney(row.diff)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-[#FEF2C8]/50 font-bold text-[#2F3E4E] border-t-2 border-[#2F3E4E]/25">
                    <td className="py-2.5 px-3">Total</td>
                    <td />
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {formatMoney(summaryStats.totalA)}
                    </td>
                    <td />
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {formatMoney(summaryStats.totalB)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {formatMoney(summaryStats.totalA - summaryStats.totalB)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Search, Filter & Export Toolbar + Detailed Table */}
          <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 shadow-[0_4px_0_#2F3E4E] space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search voucher no., party, notes…"
                aria-label="Search reconciliation results"
                className="flex-1 min-w-[180px] px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white text-xs sm:text-sm text-[#2F3E4E] placeholder:text-[#64748B]"
              />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                aria-label="Filter results by voucher type"
                className="px-3 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white text-xs sm:text-sm font-semibold text-[#2F3E4E]"
              >
                <option value="All types">All types</option>
                {summaryStats.activeCats.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleExportExcel}
                className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-[#12805C] hover:bg-[#0E6A4C] text-white border-[1.5px] border-[#2F3E4E] text-xs sm:text-sm font-bold cursor-pointer shrink-0"
              >
                <Download className="w-4 h-4" />
                <span>Export to Excel</span>
              </button>
            </div>

            <div className="overflow-auto max-h-[65vh] border border-[#2F3E4E]/20 rounded-xl bg-white">
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 z-10 bg-[#FEF2C8] text-[#2F3E4E] border-b border-[#2F3E4E]/20">
                  <tr>
                    <th className="py-2.5 px-3 text-left font-bold whitespace-nowrap">Status</th>
                    <th className="py-2.5 px-3 text-left font-bold whitespace-nowrap">Type</th>
                    <th className="py-2.5 px-3 text-left font-bold whitespace-nowrap">
                      DMS voucher
                    </th>
                    <th className="py-2.5 px-3 text-left font-bold whitespace-nowrap">
                      Tally voucher
                    </th>
                    <th className="py-2.5 px-3 text-left font-bold whitespace-nowrap">DMS date</th>
                    <th className="py-2.5 px-3 text-left font-bold whitespace-nowrap">
                      Tally date
                    </th>
                    <th className="py-2.5 px-3 text-left font-bold whitespace-nowrap">Party</th>
                    <th className="py-2.5 px-3 text-right font-bold whitespace-nowrap">DMS ₹</th>
                    <th className="py-2.5 px-3 text-right font-bold whitespace-nowrap">Tally ₹</th>
                    <th className="py-2.5 px-3 text-right font-bold whitespace-nowrap">Diff</th>
                    <th className="py-2.5 px-3 text-left font-bold whitespace-nowrap">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2F3E4E]/10">
                  {filteredResults.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-[#64748B]">
                        No rows match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredResults.slice(0, 1500).map((r, idx) => (
                      <tr key={`${r.vd}-${r.vt}-${idx}`} className="hover:bg-[#FEF2C8]/30">
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold border ${STATUS_BADGE_STYLES[r.status].badge}`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap font-medium text-[#2F3E4E]">
                          {r.cat}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap font-mono">{r.vd}</td>
                        <td className="py-2 px-3 whitespace-nowrap font-mono">{r.vt}</td>
                        <td className="py-2 px-3 whitespace-nowrap font-mono text-[#475569]">
                          {formatExcelDate(r.dd)}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap font-mono text-[#475569]">
                          {formatExcelDate(r.dt)}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap text-[#2F3E4E]">{r.party}</td>
                        <td className="py-2 px-3 whitespace-nowrap text-right font-mono tabular-nums">
                          {formatMoney(r.a)}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap text-right font-mono tabular-nums">
                          {formatMoney(r.b)}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap text-right font-mono font-semibold tabular-nums">
                          {formatMoney(r.diff)}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap text-[#475569]">{r.notes}</td>
                      </tr>
                    ))
                  )}
                  {filteredResults.length > 1500 && (
                    <tr>
                      <td colSpan={11} className="py-3 px-3 text-center text-xs text-[#64748B]">
                        Showing first 1500 of {filteredResults.length}. Export to Excel for all rows.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!results && (
        <div className="bg-[#FFFDF5] border-[1.5px] border-dashed border-[#2F3E4E]/45 rounded-2xl p-8 text-center space-y-2">
          <FileSpreadsheet className="w-8 h-8 mx-auto text-[#0F766E]" />
          <p className="font-display font-bold text-sm text-[#2F3E4E]">
            Upload both DMS &amp; Tally spreadsheets above or click Load Sample Test Data
          </p>
          <p className="text-xs text-[#64748B]">
            Supports multiple files per side, custom prefix-to-voucher rules, and 7-sheet Excel export.
          </p>
        </div>
      )}
    </div>
  );
};
