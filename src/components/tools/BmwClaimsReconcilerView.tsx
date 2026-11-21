import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  GitCompareArrows,
  HardDrive,
  Lock,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { ToolCatalogItem } from '../../types/tools';
import { safeReadStorage, safeWriteStorage } from '../../utils/browserVault';
import {
  AC_COLS,
  AU_COLS,
  CLAIMS_FIELDS,
  CLAIMS_SLOT_META,
  CL_COLS,
  CM_COLS,
  CN_COLS,
  ClaimSlotKey,
  ClaimsColDef,
  ClaimsReconcileResult,
  EX_COLS,
  MC_COLS,
  MO_COLS,
  PeriodFilter,
  PillTone,
  REG_COLS,
  UploadedSlotData,
  buildAccountSummaryRows,
  buildAllClaimSheets,
  buildClaimsCsv,
  buildClaimsWorkbookBuffer,
  buildMonthlySummaryRows,
  buildMultiClaimRows,
  computeClaimsReconciliation,
  extractSlotRows,
  fmtD,
  getPillTone,
  inr,
  isDateInPeriod,
  num,
  parseSlotFiles,
} from '../../utils/bmwClaimsEngine';
import {
  createDefaultRecoPeriodFilter,
  extractPeriodChoicesFromKeys,
  localDateToKey,
  resolveRecoPeriodBounds,
} from '../../utils/recoPeriodFilter';
import { filesToFileList } from '../../utils/fileDropUtils';
import { FileDropZone } from './FileDropZone';
import { RecoPeriodFilterBar } from './RecoPeriodFilterBar';
import { ToolPasscodeGate } from './ToolPasscodeGate';

interface BmwClaimsReconcilerViewProps {
  tool?: ToolCatalogItem;
  onBack?: () => void;
}

const OPTS_STORAGE_KEY = 'vcpl_bmw_claims_opts_v1';
const MAN_STORAGE_KEY = 'vcpl_bmw_claims_man_v1';

interface SavedClaimsOptions {
  tol: string;
  pend: string;
  bf: string;
  ew: boolean;
  pos: boolean;
  reb: boolean;
  ro: boolean;
  dd: boolean;
}

const DEFAULT_OPTS: SavedClaimsOptions = {
  tol: '5',
  pend: '45',
  bf: 'BMW India',
  ew: false,
  pos: true,
  reb: true,
  ro: true,
  dd: true,
};

type ClaimsTabName =
  | 'Dashboard'
  | 'Register'
  | 'WTY Claims vs DMS'
  | 'Multi-Claim'
  | 'DMS vs Credit/Debit Notes'
  | 'Exceptions'
  | 'BMW CN Recon'
  | 'By Account'
  | 'Monthly'
  | 'Audit';

const CLAIMS_TABS: ClaimsTabName[] = [
  'Dashboard',
  'Register',
  'WTY Claims vs DMS',
  'Multi-Claim',
  'DMS vs Credit/Debit Notes',
  'Exceptions',
  'BMW CN Recon',
  'By Account',
  'Monthly',
  'Audit',
];

const FILTER_KEYS = ['bs', 'rs', 'res', 'type', 'acc', 'sev', 'bk', 'band'] as const;
const FILTER_LABELS: Record<string, string> = {
  bs: 'billing status',
  rs: 'recon status',
  res: 'result',
  sev: 'severity',
  band: 'claim count',
  acc: 'accounts',
  bk: 'age bucket',
  type: 'type',
};

function pillStyle(tone: PillTone): string {
  switch (tone) {
    case 'g':
      return 'bg-[#CEE5DC]/80 dark:bg-emerald-950/60 text-[#12805C] dark:text-emerald-300 border-[#12805C]/30 dark:border-emerald-700/50';
    case 'w':
      return 'bg-[#FEF2C8] dark:bg-amber-950/50 text-[#8A5A00] dark:text-amber-300 border-[#8A5A00]/30 dark:border-amber-700/50';
    case 'b':
      return 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border-rose-600/30 dark:border-rose-700/50';
    case 'p':
      return 'bg-purple-50 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 border-purple-500/30 dark:border-purple-700/50';
    case 'n':
      return 'bg-slate-100 dark:bg-slate-800 text-[#475569] dark:text-slate-300 border-slate-300 dark:border-slate-700';
    default:
      return 'bg-sky-50 dark:bg-sky-950/50 text-sky-800 dark:text-sky-300 border-sky-500/30 dark:border-sky-700/50';
  }
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function todayISO(): string {
  const l = new Date();
  return `${l.getFullYear()}-${String(l.getMonth() + 1).padStart(2, '0')}-${String(l.getDate()).padStart(2, '0')}`;
}

export const BmwClaimsReconcilerView: React.FC<BmwClaimsReconcilerViewProps> = ({
  tool,
  onBack,
}) => {
  return (
    <ToolPasscodeGate
      toolCode={tool?.code ?? 'VC-12'}
      toolTitle={tool?.title ?? 'BMW Claims Reconciler'}
      sessionKey="vcpl_bmw_claims_unlocked_v1"
      passcode="202627"
      description="This BMW Claims Reconciler workspace is locked for authorized dealership access. Enter the 6-digit passcode to unlock."
      onBack={onBack}
    >
      {({ lockTool }) => (
        <BmwClaimsReconcilerWorkspace tool={tool} lockTool={lockTool} onBack={onBack} />
      )}
    </ToolPasscodeGate>
  );
};

const BmwClaimsReconcilerWorkspace: React.FC<{
  tool?: ToolCatalogItem;
  lockTool: () => void;
  onBack?: () => void;
}> = ({ tool, lockTool, onBack }) => {
  const initialOpts = useMemo(
    () => safeReadStorage<SavedClaimsOptions>(OPTS_STORAGE_KEY, DEFAULT_OPTS),
    []
  );
  const initialMan = useMemo(
    () => safeReadStorage<Record<string, string>>(MAN_STORAGE_KEY, {}),
    []
  );

  const [reportDate, setReportDate] = useState<string>(todayISO);
  const [slots, setSlots] = useState<Record<ClaimSlotKey, UploadedSlotData | null>>({
    inv: null,
    cm: null,
    dn: null,
    trk: null,
  });
  const [colMaps, setColMaps] = useState<Record<ClaimSlotKey, Record<string, string>>>({
    inv: {},
    cm: {},
    dn: {},
    trk: {},
  });

  const [tol, setTol] = useState<string>(initialOpts.tol ?? '5');
  const [pend, setPend] = useState<string>(initialOpts.pend ?? '45');
  const [bf, setBf] = useState<string>(initialOpts.bf ?? 'BMW India');
  const [ew, setEw] = useState<boolean>(Boolean(initialOpts.ew));
  const [pos, setPos] = useState<boolean>(initialOpts.pos ?? true);
  const [reb, setReb] = useState<boolean>(initialOpts.reb ?? true);
  const [ro, setRo] = useState<boolean>(initialOpts.ro ?? true);
  const [dd, setDd] = useState<boolean>(initialOpts.dd ?? true);

  const [manualRemarks, setManualRemarks] = useState<Record<string, string>>(initialMan);
  const [statusMsg, setStatusMsg] = useState<string>('Upload at least the Service Invoices file.');
  const [statusTone, setStatusTone] = useState<'neutral' | 'ok' | 'err'>('neutral');

  const [result, setResult] = useState<ClaimsReconcileResult | null>(null);
  const [tab, setTab] = useState<ClaimsTabName>('Dashboard');
  const [period, setPeriod] = useState<PeriodFilter>(() => createDefaultRecoPeriodFilter());
  const [fullCols, setFullCols] = useState<boolean>(false);
  const [filters, setFilters] = useState<Record<string, string | number>>({});
  const [sortState, setSortState] = useState<{ key: string; dir: 1 | -1 }>({ key: '', dir: 1 });
  const [rowLimit, setRowLimit] = useState<number>(400);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const fileInputRefs = useRef<Record<ClaimSlotKey, HTMLInputElement | null>>({
    inv: null,
    cm: null,
    dn: null,
    trk: null,
  });

  useEffect(() => {
    safeWriteStorage(OPTS_STORAGE_KEY, {
      tol,
      pend,
      bf,
      ew,
      pos,
      reb,
      ro,
      dd,
    } satisfies SavedClaimsOptions);
  }, [tol, pend, bf, ew, pos, reb, ro, dd]);

  const isReady = Boolean(
    slots.inv && colMaps.inv.no && colMaps.inv.bill && colMaps.inv.amt && colMaps.inv.date
  );

  const handleSlotUpload = async (slot: ClaimSlotKey, fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    setStatusMsg(`Reading ${files.length} file(s)…`);
    setStatusTone('neutral');
    try {
      const { data, autoMap } = await parseSlotFiles(slot, files);
      setSlots((prev) => ({ ...prev, [slot]: data }));
      setColMaps((prev) => ({ ...prev, [slot]: autoMap }));
      setStatusMsg(`Loaded ${data.file}`);
      setStatusTone('ok');
    } catch (err) {
      setStatusMsg(`Could not read file: ${err instanceof Error ? err.message : 'Invalid format'}`);
      setStatusTone('err');
    }
  };

  const handleRemoveSlot = (slot: ClaimSlotKey) => {
    setSlots((prev) => ({ ...prev, [slot]: null }));
    setColMaps((prev) => ({ ...prev, [slot]: {} }));
  };

  const handleGenerate = () => {
    if (!isReady || !slots.inv) return;
    try {
      const rd = reportDate ? new Date(`${reportDate}T00:00`) : new Date();
      const D = {
        inv: extractSlotRows('inv', slots.inv, colMaps.inv),
        cm: extractSlotRows('cm', slots.cm, colMaps.cm),
        dn: extractSlotRows('dn', slots.dn, colMaps.dn),
        trk: extractSlotRows('trk', slots.trk, colMaps.trk),
        hasCm: Boolean(slots.cm),
        hasDn: Boolean(slots.dn),
        hasTrk: Boolean(slots.trk),
        unmapped: [] as string[],
      };
      (
        [
          ['cm', 'no'],
          ['cm', 'from'],
          ['cm', 'amt'],
          ['dn', 'no'],
          ['dn', 'from'],
          ['dn', 'amt'],
          ['trk', 'claim'],
          ['trk', 'inv'],
          ['trk', 'cn'],
          ['trk', 'cred'],
          ['trk', 'camt'],
          ['inv', 'date'],
        ] as Array<[ClaimSlotKey, string]>
      ).forEach(([t, k]) => {
        if (slots[t] && !colMaps[t][k]) D.unmapped.push(`${CLAIMS_SLOT_META[t].title} → ${k}`);
      });

      const res = computeClaimsReconciliation(D, {
        tol: num(tol),
        pend: num(pend),
        rd,
        ew,
        pos,
        reb,
        ro,
        dedupe: dd,
        bill: bf,
        invFile: slots.inv.file,
      });
      res.reg.forEach((r) => {
        r.man = manualRemarks[r.no] || '';
      });
      setResult(res);
      setFilters({});
      setSortState({ key: '', dir: 1 });
      setRowLimit(400);
      setPeriod((p) => ({ ...p, mode: 'all' }));
      setTab('Dashboard');
      setStatusMsg(`Generated report for ${res.reg.length} BMW invoice(s).`);
      setStatusTone('ok');
    } catch (err) {
      setStatusMsg(`Error: ${err instanceof Error ? err.message : 'Unable to generate report'}`);
      setStatusTone('err');
    }
  };

  const navigateTabWithFilter = (targetTab: ClaimsTabName, nextFilters: Record<string, string | number> = {}) => {
    setRowLimit(400);
    setSortState({ key: '', dir: 1 });
    setFilters(nextFilters);
    setTab(targetTab);
  };

  // Period-filtered datasets
  const FR = useMemo(
    () => (result ? result.reg.filter((r) => isDateInPeriod(r.date, period)) : []),
    [result, period]
  );
  const FE = useMemo(
    () => (result ? result.ex.filter((r) => isDateInPeriod(r.date, period)) : []),
    [result, period]
  );
  const FC = useMemo(
    () => (result ? result.cld.filter((r) => isDateInPeriod(r.fd, period)) : []),
    [result, period]
  );
  const FM = useMemo(
    () => (result ? result.cms.filter((r) => isDateInPeriod(r.date, period)) : []),
    [result, period]
  );
  const FN = useMemo(
    () => (result ? result.cnl.filter((r) => isDateInPeriod(r.date, period)) : []),
    [result, period]
  );
  const FMC = useMemo(
    () => (result ? buildMultiClaimRows(result, FR) : []),
    [result, FR]
  );
  const accRows = useMemo(() => buildAccountSummaryRows(FR), [FR]);
  const moRows = useMemo(() => buildMonthlySummaryRows(FR), [FR]);

  const availablePeriods = useMemo(() => {
    if (!result) return undefined;
    const keys = [
      ...result.reg.map((r) => localDateToKey(r.date)),
      ...result.cms.map((c) => localDateToKey(c.date)),
      ...result.cnl.map((n) => localDateToKey(n.date)),
    ];
    return extractPeriodChoicesFromKeys(keys);
  }, [result]);

  const activeTableConfig = useMemo<{
    data: Array<Record<string, unknown>>;
    cols: ClaimsColDef<any>[];
    filterable: boolean;
  }>(() => {
    if (!result) return { data: [], cols: [], filterable: false };
    const vis = <T,>(c: ClaimsColDef<T>[]) => (fullCols ? c : c.filter((x) => x.compact));
    switch (tab) {
      case 'Register':
        return { data: FR, cols: vis(REG_COLS), filterable: true };
      case 'WTY Claims vs DMS':
        return { data: FC, cols: vis(CL_COLS), filterable: true };
      case 'Multi-Claim':
        return { data: FMC, cols: MC_COLS, filterable: true };
      case 'DMS vs Credit/Debit Notes':
        return { data: FM, cols: CM_COLS, filterable: true };
      case 'Exceptions':
        return { data: FE, cols: EX_COLS, filterable: true };
      case 'BMW CN Recon':
        return { data: FN, cols: CN_COLS, filterable: false };
      case 'By Account':
        return { data: accRows, cols: AC_COLS, filterable: false };
      case 'Monthly':
        return { data: moRows, cols: MO_COLS, filterable: false };
      case 'Audit':
        return { data: result.aud, cols: AU_COLS, filterable: true };
      default:
        return { data: [], cols: [], filterable: false };
    }
  }, [result, tab, fullCols, FR, FC, FMC, FM, FE, FN, accRows, moRows]);

  const processedTableRows = useMemo(() => {
    const { data, cols } = activeTableConfig;
    const q = String(filters.q || '').toLowerCase();
    let d = data.filter((r) => {
      if (q) {
        const hay = Object.values(r)
          .map((x) => (x instanceof Date ? fmtD(x) : x && typeof x === 'object' ? '' : String(x)))
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return Object.entries(filters).every(([k, x]) => {
        if (k === 'q' || !x) return true;
        if (k === 'bal') return Number(r.net) > 1;
        return r[k] === x;
      });
    });

    if (sortState.key) {
      const sc = cols.find((c) => c.key === sortState.key);
      const getVal = (r: Record<string, unknown>) => {
        const v = sc && sc.val ? sc.val(r) : r[sortState.key];
        return v instanceof Date ? v.getTime() : v;
      };
      const isEmpty = (v: unknown) => v === '' || v == null;
      d = [...d].sort((a, b) => {
        const p = getVal(a);
        const q2 = getVal(b);
        if (isEmpty(p) && isEmpty(q2)) return 0;
        if (isEmpty(p)) return 1;
        if (isEmpty(q2)) return -1;
        return (Number(p > q2) || (p < q2 ? -1 : 0)) * sortState.dir;
      });
    }
    return d;
  }, [activeTableConfig, filters, sortState]);

  const handleExportWorkbook = async (mode: 'period' | 'all' | 'multi' | 'exc') => {
    if (!result) return;
    setIsExporting(true);
    try {
      const targetPeriod: PeriodFilter =
        mode === 'period' ? period : createDefaultRecoPeriodFilter();
      let specs = buildAllClaimSheets(result, targetPeriod);
      if (mode === 'exc') specs = specs.filter((s) => /^(Exceptions|Audit)$/.test(s.n));
      if (mode === 'multi') specs = specs.filter((s) => /^(Multi-Claim|Invoices - )/.test(s.n));
      const pBounds = resolveRecoPeriodBounds(period);
      const nm = {
        period: pBounds.isFiltered ? `_${pBounds.shortLabel}` : '',
        all: '_AllDates',
        exc: '_Exceptions_Audit',
        multi: '_MultiClaim',
      }[mode];
      const buf = await buildClaimsWorkbookBuffer(specs);
      triggerDownload(
        new Blob([buf], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
        `BMW_Warranty_Reconciliation${nm}_${fmtD(result.rd)}.xlsx`
      );
    } catch (err) {
      setStatusMsg(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setStatusTone('err');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportFilteredXlsx = async () => {
    if (!result) return;
    setIsExporting(true);
    try {
      const buf = await buildClaimsWorkbookBuffer([
        {
          n: tab.slice(0, 31).replace(/[\\/?*[\]:]/g, '-'),
          d: processedTableRows,
          c: activeTableConfig.cols,
        },
      ]);
      triggerDownload(
        new Blob([buf], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
        `BMW_${tab.replace(/\W+/g, '_')}_filtered_${fmtD(result.rd)}.xlsx`
      );
    } catch (err) {
      setStatusMsg(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setStatusTone('err');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportFilteredCsv = () => {
    const csv = buildClaimsCsv(processedTableRows, activeTableConfig.cols);
    triggerDownload(
      new Blob([csv], { type: 'text/csv;charset=utf-8' }),
      `bmw_${tab.replace(/\W+/g, '_')}.csv`
    );
  };

  const handleManualRemarkChange = (rowIndex: number, invoiceNo: string, value: string) => {
    if (!result) return;
    result.reg[rowIndex].man = value;
    setManualRemarks((prev) => {
      const next = { ...prev };
      if (value) next[invoiceNo] = value;
      else delete next[invoiceNo];
      safeWriteStorage(MAN_STORAGE_KEY, next);
      return next;
    });
  };

  // Dashboard metrics helpers
  const sm = (arr: Array<Record<string, unknown>>, k: string) =>
    arr.reduce((s, x) => s + (Number(x[k]) || 0), 0);
  const cnt = (arr: Array<Record<string, unknown>>, k: string) =>
    arr.reduce<Record<string, number>>((m, x) => {
      const val = String(x[k] ?? '');
      m[val] = (m[val] || 0) + 1;
      return m;
    }, {});

  const rangeFmt = (dates: Array<Date | null | undefined>) => {
    const sorted = dates
      .filter((d): d is Date => Boolean(d))
      .sort((a, b) => a.getTime() - b.getTime());
    return sorted.length ? `${fmtD(sorted[0])} to ${fmtD(sorted[sorted.length - 1])}` : '–';
  };

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="no-print bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-5 sm:p-6 shadow-[0_4px_0_#2F3E4E] dark:shadow-[0_4px_0_#020617] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#CEE5DC] dark:bg-emerald-950/60 border border-[#2F3E4E] dark:border-emerald-700 text-[11px] font-mono font-bold text-[#2F3E4E] dark:text-emerald-200">
              <GitCompareArrows className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{tool?.code ?? 'VC-12'} · Warranty Claims Reco</span>
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#2F3E4E] dark:bg-slate-800 text-[11px] font-bold text-[#F9C80E]">
              <Lock className="w-3 h-3" aria-hidden="true" />
              <span>Passcode Unlocked</span>
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white dark:bg-[#0B1120] border border-[#12805C]/35 dark:border-emerald-700/50 text-[11px] font-bold text-[#12805C] dark:text-emerald-300">
              <HardDrive className="w-3 h-3" aria-hidden="true" />
              <span>100% Browser-Local</span>
            </span>
          </div>

          <h1 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] dark:text-slate-100 tracking-tight">
            {tool?.title ?? 'BMW Claims Reconciler'}
          </h1>
          <p className="text-xs sm:text-sm text-[#475569] dark:text-slate-300 max-w-3xl leading-relaxed">
            DMS invoices ↔ credit / debit notes ↔ warranty claims. Automatic column detection,
            multi-claim line splitting, repeated credit-note deduplication, and full ExcelJS
            workbooks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <label className="flex items-center gap-2 px-3 py-1.5 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-bold text-[#2F3E4E] dark:text-slate-200">
            <span className="text-[#64748B] dark:text-slate-400">Report date</span>
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="bg-transparent font-mono font-bold text-xs text-[#2F3E4E] dark:text-slate-100 focus:outline-none"
            />
          </label>

          <button
            type="button"
            onClick={lockTool}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-[#FEF2C8] dark:bg-[#0B1120] hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] dark:text-slate-100 dark:hover:text-[#0F172A] cursor-pointer transition"
          >
            <Lock className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Lock Tool</span>
          </button>

          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="px-3.5 py-2 min-h-[40px] rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] hover:bg-[#FEF2C8] dark:hover:bg-slate-800 text-xs font-bold text-[#2F3E4E] dark:text-slate-100 cursor-pointer transition"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Step 1: 4 Upload Slots + Column Mapping */}
      <div className="no-print bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-5 sm:p-6 shadow-[0_4px_0_#2F3E4E] dark:shadow-[0_4px_0_#020617] space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display font-extrabold text-sm sm:text-base text-[#2F3E4E] dark:text-slate-100">
            1 · Drop your Excel files
          </h2>
          <span className="text-xs text-[#64748B] dark:text-slate-400">
            Headers are detected automatically; change any mapping under each file
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
          {(['inv', 'cm', 'dn', 'trk'] as ClaimSlotKey[]).map((slot) => {
            const s = slots[slot];
            const meta = CLAIMS_SLOT_META[slot];
            const totalRows = s ? s.sh.reduce((a, x) => a + x.rows.length, 0) : 0;

            return (
              <div
                key={slot}
                className="rounded-xl border border-[#2F3E4E]/25 dark:border-slate-700 bg-white dark:bg-[#0B1120] p-3 space-y-2.5 flex flex-col"
              >
                <FileDropZone
                  accept=".xlsx,.xls,.csv"
                  multiple
                  onFiles={(fs) => void handleSlotUpload(slot, filesToFileList(fs))}
                  className={`rounded-xl border-[1.5px] p-3 text-center space-y-1.5 transition-colors cursor-pointer ${
                    s
                      ? 'border-solid border-[#12805C] bg-[#CEE5DC]/25 dark:bg-emerald-950/25'
                      : 'border-dashed border-[#2F3E4E]/45 dark:border-slate-600 bg-[#FEF2C8]/30 dark:bg-[#131C2E]/70'
                  }`}
                  activeClassName="border-[#2F3E4E] bg-[#F9C80E]/30 ring-2 ring-[#F9C80E]"
                >
                  <div className="text-xs font-display font-extrabold text-[#2F3E4E] dark:text-slate-100">
                    {meta.title}
                  </div>
                  <div className="text-[11px] text-[#475569] dark:text-slate-400">
                    {s ? (
                      <span className="font-semibold text-[#12805C] dark:text-emerald-400">
                        ✔ {s.file} · {s.sh.length} sheet(s) · {totalRows} rows
                      </span>
                    ) : (
                      <>
                        {meta.subtitle}
                        <br />
                        Drop file here or click
                      </>
                    )}
                  </div>
                  <input
                    ref={(el) => {
                      fileInputRefs.current[slot] = el;
                    }}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    multiple
                    onChange={(e) => {
                      void handleSlotUpload(slot, e.target.files);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRefs.current[slot]?.click()}
                    className="mt-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/40 dark:border-slate-600 bg-white dark:bg-[#0B1120] hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] text-[11px] font-bold text-[#2F3E4E] dark:text-slate-100 dark:hover:text-[#0F172A] cursor-pointer transition"
                  >
                    <Upload className="w-3 h-3" aria-hidden="true" />
                    <span>{s ? 'Replace File(s)' : 'Select File(s)'}</span>
                  </button>
                </FileDropZone>

                {s && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleRemoveSlot(slot)}
                      className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg border border-rose-500/30 bg-rose-50/70 dark:bg-rose-950/30 text-[11px] font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950/60 cursor-pointer transition self-start"
                    >
                      <Trash2 className="w-3 h-3" aria-hidden="true" />
                      <span>Remove file</span>
                    </button>

                    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1.5 items-center max-h-60 overflow-y-auto pr-1 text-[11px]">
                      {CLAIMS_FIELDS[slot].map((f) => (
                        <React.Fragment key={f.key}>
                          <span className="font-semibold text-[#475569] dark:text-slate-300 truncate">
                            {f.label}
                            {f.required ? ' *' : ''}
                          </span>
                          <select
                            aria-label={`${meta.title} ${f.label}`}
                            value={colMaps[slot][f.key] || ''}
                            onChange={(e) =>
                              setColMaps((prev) => ({
                                ...prev,
                                [slot]: { ...prev[slot], [f.key]: e.target.value },
                              }))
                            }
                            className="w-full px-1.5 py-1 rounded border border-[#2F3E4E]/30 dark:border-slate-700 bg-[#FFFDF5] dark:bg-[#131C2E] text-[11px] text-[#2F3E4E] dark:text-slate-200 truncate"
                          >
                            <option value="">– none –</option>
                            {Object.entries(s.lab).map(([k, label]) => (
                              <option key={k} value={k}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </React.Fragment>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step 2: Reconciliation Options */}
      <div className="no-print bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-5 sm:p-6 shadow-[0_4px_0_#2F3E4E] dark:shadow-[0_4px_0_#020617] space-y-4">
        <h2 className="font-display font-extrabold text-sm sm:text-base text-[#2F3E4E] dark:text-slate-100">
          2 · Options
        </h2>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-xs text-[#2F3E4E] dark:text-slate-200">
          <label className="inline-flex items-center gap-2 font-semibold">
            <span>Match tolerance ₹</span>
            <input
              type="number"
              value={tol}
              onChange={(e) => setTol(e.target.value)}
              className="w-20 px-2 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] font-mono font-bold text-xs"
            />
          </label>

          <label className="inline-flex items-center gap-2 font-semibold">
            <span>Pending alert after (days)</span>
            <input
              type="number"
              value={pend}
              onChange={(e) => setPend(e.target.value)}
              className="w-20 px-2 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] font-mono font-bold text-xs"
            />
          </label>

          <label
            className="inline-flex items-center gap-2 font-semibold"
            title="Comma separated. Rows whose Bill To Customer contains none of these (and are not Bajaj EW) are skipped."
          >
            <span>Bill-To contains</span>
            <input
              type="text"
              value={bf}
              onChange={(e) => setBf(e.target.value)}
              className="w-40 px-2.5 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-semibold"
            />
          </label>

          <label className="inline-flex items-center gap-1.5 font-semibold cursor-pointer">
            <input type="checkbox" checked={ew} onChange={(e) => setEw(e.target.checked)} />
            <span>Include Bajaj “BMW EW” invoices</span>
          </label>

          <label className="inline-flex items-center gap-1.5 font-semibold cursor-pointer">
            <input type="checkbox" checked={pos} onChange={(e) => setPos(e.target.checked)} />
            <span>Treat positive credit-memo amounts as debit notes</span>
          </label>

          <label className="inline-flex items-center gap-1.5 font-semibold cursor-pointer">
            <input type="checkbox" checked={reb} onChange={(e) => setReb(e.target.checked)} />
            <span>Detect possible re-bills / duplicates</span>
          </label>

          <label className="inline-flex items-center gap-1.5 font-semibold cursor-pointer">
            <input type="checkbox" checked={ro} onChange={(e) => setRo(e.target.checked)} />
            <span>Fallback match claim ↔ invoice by RO / Order No.</span>
          </label>

          <label
            className="inline-flex items-center gap-1.5 font-semibold cursor-pointer"
            title="When the tracker repeats the same BMW credit note and amount on several claim lines of one invoice, count that credit once."
          >
            <input type="checkbox" checked={dd} onChange={(e) => setDd(e.target.checked)} />
            <span>Count repeated credit (same CN + amount) once</span>
          </label>

          <button
            type="button"
            disabled={!isReady}
            onClick={handleGenerate}
            className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[38px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#F9C80E] hover:bg-[#eab308] text-xs font-display font-extrabold text-[#2F3E4E] shadow-[0_2px_0_#2F3E4E] transition cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <GitCompareArrows className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Generate report</span>
          </button>

          <span
            className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
              statusTone === 'err'
                ? 'text-rose-700 dark:text-rose-400'
                : statusTone === 'ok'
                  ? 'text-[#12805C] dark:text-emerald-400'
                  : 'text-[#64748B] dark:text-slate-400'
            }`}
          >
            {statusTone === 'err' ? (
              <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            )}
            <span>
              {isReady && statusTone === 'neutral'
                ? 'Ready – click Generate report.'
                : !isReady && !slots.inv
                  ? 'Upload at least the Service Invoices file.'
                  : statusMsg}
            </span>
          </span>
        </div>
      </div>

      {/* Results Output */}
      {result && (
        <div className="space-y-4">
          {/* Advanced Period Filter Bar */}
          <RecoPeriodFilterBar
            value={period}
            onChange={setPeriod}
            available={availablePeriods}
            matchedCount={FR.length}
            totalCount={result.reg.length}
            scopeHint="Applies to every tab, dashboard KPI, Monthly/Account breakdown & Excel (this period) export"
            compact
          />

          {/* Navigation Tabs & Excel Buttons */}
          <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-3 sm:p-4 shadow-[0_3px_0_#2F3E4E] dark:shadow-[0_3px_0_#020617] space-y-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {CLAIMS_TABS.map((t) => {
                const on = t === tab;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => navigateTabWithFilter(t, {})}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                      on
                        ? 'bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#FFFDF5] dark:text-[#0F172A] border-[#2F3E4E] dark:border-[#F9C80E]'
                        : 'bg-white dark:bg-[#0B1120] text-[#2F3E4E] dark:text-slate-300 border-[#2F3E4E]/25 dark:border-slate-700 hover:bg-[#FEF2C8] dark:hover:bg-slate-800'
                    }`}
                  >
                    {t}
                  </button>
                );
              })}

              <span className="flex-1" />

              <button
                type="button"
                disabled={isExporting}
                onClick={() => void handleExportWorkbook('period')}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/45 dark:border-slate-600 bg-[#CEE5DC]/50 dark:bg-emerald-950/40 hover:bg-[#CEE5DC] text-[11px] font-bold text-[#2F3E4E] dark:text-emerald-200 cursor-pointer transition disabled:opacity-45"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Excel (this period)</span>
              </button>

              <button
                type="button"
                disabled={isExporting}
                onClick={() => void handleExportWorkbook('all')}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/45 dark:border-slate-600 bg-white dark:bg-[#0B1120] hover:bg-[#FEF2C8] text-[11px] font-bold text-[#2F3E4E] dark:text-slate-200 cursor-pointer transition disabled:opacity-45"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Excel (all dates)</span>
              </button>

              <button
                type="button"
                disabled={isExporting}
                onClick={() => void handleExportWorkbook('multi')}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/45 dark:border-slate-600 bg-white dark:bg-[#0B1120] hover:bg-[#FEF2C8] text-[11px] font-bold text-[#2F3E4E] dark:text-slate-200 cursor-pointer transition disabled:opacity-45"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Multi-claim sheets</span>
              </button>

              <button
                type="button"
                disabled={isExporting}
                onClick={() => void handleExportWorkbook('exc')}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/45 dark:border-slate-600 bg-white dark:bg-[#0B1120] hover:bg-[#FEF2C8] text-[11px] font-bold text-[#2F3E4E] dark:text-slate-200 cursor-pointer transition disabled:opacity-45"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Exceptions + Audit</span>
              </button>
            </div>

            {/* Active Tab Content */}
            {tab === 'Dashboard' ? (
              <div className="space-y-4 pt-1">
                {/* Coverage Warning / Success Banner */}
                {result.cld.length > 0 && (() => {
                  const um = result.cld.filter((x) => x.res.startsWith('Invoice not in')).length;
                  return (
                    <div
                      className={`rounded-xl border-[1.5px] px-4 py-3 text-xs leading-relaxed ${
                        um
                          ? 'border-[#9A5B00]/50 bg-[#FEF2C8]/65 dark:bg-amber-950/35 text-[#2F3E4E] dark:text-amber-100'
                          : 'border-[#12805C]/45 bg-[#CEE5DC]/45 dark:bg-emerald-950/35 text-[#2F3E4E] dark:text-emerald-100'
                      }`}
                    >
                      <strong>Data coverage</strong> · DMS invoices:{' '}
                      {rangeFmt(result.reg.map((x) => x.date))} · Claim tracker (claim dates):{' '}
                      {rangeFmt(result.cld.map((x) => x.t_cdate as Date | null | undefined))} ·{' '}
                      <strong>
                        {result.cld.length - um} of {result.cld.length}
                      </strong>{' '}
                      claims matched to a DMS BMW invoice
                      {um > 0 && (
                        <div className="mt-1 text-[#8A5A00] dark:text-amber-300 font-semibold">
                          ⚠ {um} claims have no matching invoice. If the claim period is outside the
                          DMS invoice period, export DMS invoices for the claim months too and
                          re-upload.
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* 13 KPI Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7 gap-2.5">
                  {(
                    [
                      { label: 'BMW invoices', val: FR.length },
                      { label: 'Invoice value (with tax)', val: `₹${inr(sm(FR, 'amt'))}` },
                      { label: 'DMS credit memos', val: `₹${inr(sm(FR, 'cma'))}` },
                      { label: 'Debit notes', val: `₹${inr(sm(FR, 'dna'))}` },
                      { label: 'Claim amount', val: `₹${inr(sm(FR, 't_camt'))}` },
                      { label: 'Approved amount', val: `₹${inr(sm(FR, 't_aamt'))}` },
                      { label: 'BMW credits received', val: `₹${inr(sm(FR, 'cr'))}` },
                      { label: 'Net receivable', val: `₹${inr(sm(FR, 'net'))}` },
                      {
                        label: 'Exceptions',
                        val: FE.length,
                        go: 'Exceptions' as ClaimsTabName,
                      },
                      {
                        label: 'Invoices with 2 claims',
                        val: FR.filter((x) => x.ncl === 2).length,
                        go: 'Multi-Claim' as ClaimsTabName,
                        f: { band: '2 claims' },
                      },
                      {
                        label: 'Invoices with 3 claims',
                        val: FR.filter((x) => x.ncl === 3).length,
                        go: 'Multi-Claim' as ClaimsTabName,
                        f: { band: '3 claims' },
                      },
                      {
                        label: 'Invoices with 4+ claims',
                        val: FR.filter((x) => x.ncl > 3).length,
                        go: 'Multi-Claim' as ClaimsTabName,
                        f: { band: '4+ claims' },
                      },
                      {
                        label: 'Audit warnings',
                        val: result.aud.filter((a) => a.sev === 'Warning' || a.sev === 'Error').length,
                        go: 'Audit' as ClaimsTabName,
                      },
                    ] as Array<{
                      label: string;
                      val: string | number;
                      go?: ClaimsTabName;
                      f?: Record<string, string | number>;
                    }>
                  ).map((k) => (
                    <div
                      key={k.label}
                      onClick={k.go ? () => navigateTabWithFilter(k.go!, k.f || {}) : undefined}
                      onKeyDown={
                        k.go
                          ? (e) => {
                              if (e.key === 'Enter') navigateTabWithFilter(k.go!, k.f || {});
                            }
                          : undefined
                      }
                      tabIndex={k.go ? 0 : undefined}
                      role={k.go ? 'button' : undefined}
                      className={`bg-white dark:bg-[#0B1120] border border-[#2F3E4E]/25 dark:border-slate-700 rounded-xl p-3 min-w-0 ${
                        k.go
                          ? 'cursor-pointer hover:border-[#2F3E4E] dark:hover:border-[#F9C80E] hover:bg-[#FEF2C8]/35 transition'
                          : ''
                      }`}
                    >
                      <div className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400">
                        {k.label}
                      </div>
                      <div className="font-mono font-extrabold text-base sm:text-lg text-[#2F3E4E] dark:text-slate-100 tabular-nums break-words mt-0.5">
                        {k.val}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Distribution Bar Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                  {(
                    [
                      { title: 'Billing status', data: cnt(FR, 'bs'), go: 'Register', key: 'bs' },
                      {
                        title: 'Reconciliation status',
                        data: cnt(FR, 'rs'),
                        go: 'Register',
                        key: 'rs',
                      },
                      {
                        title: 'Warranty claims vs DMS',
                        data: cnt(FC, 'res'),
                        go: 'WTY Claims vs DMS',
                        key: 'res',
                      },
                      {
                        title: 'Receivable ageing (invoices with balance)',
                        data: cnt(FR.filter((x) => x.net > 1), 'bk'),
                        go: 'Register',
                        key: 'bk',
                        extra: { bal: 1 },
                      },
                      { title: 'BMW account', data: cnt(FR, 'acc'), go: 'Register', key: 'acc' },
                    ] as Array<{
                      title: string;
                      data: Record<string, number>;
                      go: ClaimsTabName;
                      key: string;
                      extra?: Record<string, number>;
                    }>
                  ).map((box) => {
                    const entries = Object.entries(box.data).sort((a, b) => b[1] - a[1]);
                    if (!entries.length) return null;
                    const max = Math.max(...entries.map((e) => e[1]));
                    return (
                      <div
                        key={box.title}
                        className="bg-white dark:bg-[#0B1120] border border-[#2F3E4E]/25 dark:border-slate-700 rounded-xl p-4 space-y-2.5"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <h3 className="font-display font-extrabold text-xs sm:text-sm text-[#2F3E4E] dark:text-slate-100">
                            {box.title}
                          </h3>
                          <span className="text-[11px] text-[#64748B] dark:text-slate-400">
                            click a row to open it
                          </span>
                        </div>

                        <div className="space-y-1">
                          {entries.map(([k, count]) => (
                            <button
                              key={k}
                              type="button"
                              onClick={() =>
                                navigateTabWithFilter(box.go, {
                                  [box.key]: k,
                                  ...(box.extra || {}),
                                })
                              }
                              className="w-full grid grid-cols-[minmax(0,220px)_minmax(36px,1fr)_40px] gap-2 items-center px-1.5 py-1 rounded-lg hover:bg-[#FEF2C8]/50 dark:hover:bg-slate-800/60 transition text-left cursor-pointer"
                            >
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold border truncate ${pillStyle(
                                  getPillTone(k)
                                )}`}
                                title={k}
                              >
                                {k}
                              </span>
                              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                                <div
                                  className="h-2 rounded-full bg-[#2F3E4E] dark:bg-[#F9C80E]"
                                  style={{ width: `${Math.max(4, (count / max) * 100)}%` }}
                                />
                              </div>
                              <span className="text-right font-mono font-bold text-xs text-[#2F3E4E] dark:text-slate-200 tabular-nums">
                                {count}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                {/* Multi-Claim Band Chips */}
                {tab === 'Multi-Claim' && (
                  <div className="flex flex-wrap gap-1.5">
                    {(['', '2 claims', '3 claims', '4+ claims'] as const).map((band) => {
                      const uniqueCount = new Set(
                        FMC.filter((r) => !band || r.band === band).map((r) => r.grp)
                      ).size;
                      const isOn = (filters.band || '') === band;
                      return (
                        <button
                          key={band || 'all'}
                          type="button"
                          onClick={() => {
                            setFilters(band ? { band } : {});
                            setRowLimit(400);
                          }}
                          className={`px-3 py-1 rounded-lg text-xs font-bold border cursor-pointer transition ${
                            isOn
                              ? 'bg-[#F9C80E] text-[#2F3E4E] border-[#2F3E4E]'
                              : 'bg-white dark:bg-[#0B1120] text-[#2F3E4E] dark:text-slate-300 border-[#2F3E4E]/25 dark:border-slate-700 hover:bg-[#FEF2C8]'
                          }`}
                        >
                          {band || 'All'} ({uniqueCount})
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Table Filter Toolbar */}
                <div className="flex flex-wrap items-center gap-2">
                  {activeTableConfig.filterable && (
                    <>
                      <div className="relative w-64">
                        <Search
                          className="w-3.5 h-3.5 text-[#64748B] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                          aria-hidden="true"
                        />
                        <input
                          type="text"
                          value={String(filters.q || '')}
                          onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
                          placeholder="Search invoice, VIN, customer, claim…"
                          className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/35 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs text-[#2F3E4E] dark:text-slate-100"
                        />
                      </div>

                      {FILTER_KEYS.map((k) => {
                        const rawData = activeTableConfig.data;
                        if (
                          !rawData[0] ||
                          !(k in rawData[0]) ||
                          (k === 'band' && tab === 'Multi-Claim')
                        ) {
                          return null;
                        }
                        const options = [...new Set(rawData.map((x) => String(x[k] ?? '')))]
                          .filter(Boolean)
                          .sort();
                        if (!options.length) return null;
                        return (
                          <select
                            key={k}
                            aria-label={FILTER_LABELS[k] || k}
                            value={String(filters[k] || '')}
                            onChange={(e) => {
                              const val = e.target.value;
                              setRowLimit(400);
                              setFilters((prev) => ({ ...prev, [k]: val }));
                            }}
                            className="px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/35 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-semibold text-[#2F3E4E] dark:text-slate-100"
                          >
                            <option value="">All {FILTER_LABELS[k] || k}</option>
                            {options.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        );
                      })}
                    </>
                  )}

                  {Boolean(filters.bal) && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold border bg-[#FEF2C8] text-[#8A5A00] border-[#8A5A00]/30">
                      only invoices with balance
                    </span>
                  )}

                  {(tab === 'Register' || tab === 'WTY Claims vs DMS') && (
                    <button
                      type="button"
                      onClick={() => setFullCols((f) => !f)}
                      className="px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/35 dark:border-slate-600 bg-white dark:bg-[#0B1120] hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] dark:text-slate-200 cursor-pointer transition"
                    >
                      {fullCols ? 'Compact columns' : 'All columns'}
                    </button>
                  )}

                  <span className="text-xs font-mono text-[#64748B] dark:text-slate-400">
                    {processedTableRows.length} rows
                    {processedTableRows.length > rowLimit ? ` (showing ${rowLimit})` : ''}
                  </span>

                  <button
                    type="button"
                    onClick={handleExportFilteredCsv}
                    className="px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/35 dark:border-slate-600 bg-white dark:bg-[#0B1120] hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] dark:text-slate-200 cursor-pointer transition"
                  >
                    CSV of filtered
                  </button>

                  <button
                    type="button"
                    disabled={isExporting}
                    onClick={() => void handleExportFilteredXlsx()}
                    className="px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/35 dark:border-slate-600 bg-white dark:bg-[#0B1120] hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] dark:text-slate-200 cursor-pointer transition disabled:opacity-45"
                  >
                    Excel of filtered
                  </button>

                  {Object.values(filters).some(Boolean) && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilters({});
                        setRowLimit(400);
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-rose-500/35 bg-rose-50 dark:bg-rose-950/30 text-xs font-bold text-rose-700 dark:text-rose-300 cursor-pointer transition"
                    >
                      Clear filters
                    </button>
                  )}
                </div>

                {/* Data Table with Sticky Header and Totals Footer */}
                <div className="overflow-auto max-h-[70vh] rounded-xl border border-[#2F3E4E]/25 dark:border-slate-700 bg-white dark:bg-[#0B1120]">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="sticky top-0 z-10 bg-[#2F3E4E] dark:bg-slate-800 text-white">
                        {activeTableConfig.cols.map((c) => (
                          <th
                            key={c.key}
                            onClick={() =>
                              setSortState((prev) => ({
                                key: c.key,
                                dir: prev.key === c.key ? (prev.dir === 1 ? -1 : 1) : 1,
                              }))
                            }
                            className="text-left px-2.5 py-2 font-bold whitespace-nowrap cursor-pointer select-none hover:bg-[#1E293B] dark:hover:bg-slate-700"
                          >
                            {c.label}
                            {sortState.key === c.key ? (sortState.dir > 0 ? ' ▲' : ' ▼') : ''}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {processedTableRows.slice(0, rowLimit).map((row, idx) => (
                        <tr
                          key={idx}
                          className="border-t border-[#2F3E4E]/15 dark:border-slate-800 hover:bg-[#FEF2C8]/35 dark:hover:bg-slate-800/50"
                        >
                          {activeTableConfig.cols.map((c) => {
                            const val = c.val ? c.val(row) : row[c.key];
                            if (c.type === 'e') {
                              const invNum = String(row.no ?? '');
                              const rowIx = Number(row.ix);
                              return (
                                <td key={c.key} className="px-2 py-1.5 whitespace-nowrap">
                                  <input
                                    type="text"
                                    aria-label="Manual remark"
                                    value={manualRemarks[invNum] ?? String(row.man ?? '')}
                                    onChange={(e) =>
                                      handleManualRemarkChange(rowIx, invNum, e.target.value)
                                    }
                                    placeholder="remark…"
                                    className="w-44 px-2 py-1 rounded border border-[#2F3E4E]/25 dark:border-slate-700 bg-[#FFFDF5] dark:bg-[#131C2E] text-xs text-[#2F3E4E] dark:text-slate-100"
                                  />
                                </td>
                              );
                            }

                            if (c.type === 'pill') {
                              const sVal = String(val ?? '');
                              return (
                                <td key={c.key} className="px-2.5 py-1.5 whitespace-nowrap">
                                  {sVal ? (
                                    <span
                                      className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold border ${pillStyle(
                                        getPillTone(sVal)
                                      )}`}
                                    >
                                      {sVal}
                                    </span>
                                  ) : null}
                                </td>
                              );
                            }

                            if (c.type === 'n') {
                              return (
                                <td
                                  key={c.key}
                                  className="px-2.5 py-1.5 whitespace-nowrap text-right font-mono tabular-nums text-[#2F3E4E] dark:text-slate-200"
                                >
                                  {inr(val)}
                                </td>
                              );
                            }

                            if (c.type === 'r') {
                              return (
                                <td
                                  key={c.key}
                                  className="px-2.5 py-1.5 whitespace-normal min-w-[260px] max-w-[440px] text-[#475569] dark:text-slate-300"
                                >
                                  {String(val ?? '')}
                                </td>
                              );
                            }

                            return (
                              <td
                                key={c.key}
                                className="px-2.5 py-1.5 whitespace-nowrap text-[#2F3E4E] dark:text-slate-200"
                              >
                                {val instanceof Date ? fmtD(val) : String(val ?? '')}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      {processedTableRows.length === 0 && (
                        <tr>
                          <td
                            colSpan={activeTableConfig.cols.length}
                            className="px-4 py-8 text-center text-xs text-[#64748B] dark:text-slate-400"
                          >
                            No rows match your current filters.
                          </td>
                        </tr>
                      )}
                    </tbody>

                    {processedTableRows.length > 0 && (
                      <tfoot>
                        <tr className="sticky bottom-0 z-10 bg-[#FEF2C8] dark:bg-slate-900 font-bold border-t-2 border-[#2F3E4E]/35 dark:border-slate-700 text-[#2F3E4E] dark:text-slate-100">
                          {activeTableConfig.cols.map((c, i) =>
                            c.type === 'n' ? (
                              <td
                                key={c.key}
                                className="px-2.5 py-2 text-right font-mono tabular-nums whitespace-nowrap"
                              >
                                {inr(
                                  processedTableRows.reduce(
                                    (s, r) => s + (Number(c.val ? c.val(r) : r[c.key]) || 0),
                                    0
                                  )
                                )}
                              </td>
                            ) : (
                              <td key={c.key} className="px-2.5 py-2 whitespace-nowrap">
                                {i === 0 ? `Total (${processedTableRows.length})` : ''}
                              </td>
                            )
                          )}
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>

                {processedTableRows.length > rowLimit && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setRowLimit((n) => n + 600)}
                      className="px-4 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-[#FEF2C8] dark:bg-slate-800 hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] dark:text-slate-100 cursor-pointer transition"
                    >
                      Show more (+600)
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
