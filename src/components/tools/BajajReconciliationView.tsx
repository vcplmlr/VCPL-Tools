import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  FileSpreadsheet,
  GitCompareArrows,
  HardDrive,
  Printer,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { ToolCatalogItem } from '../../types/tools';
import {
  BAJAJ_AUDIT_CHECKS,
  BAJAJ_FILE_LABELS,
  BAJAJ_TABS,
  BajajColDef,
  BajajOptions,
  BajajReconResult,
  BajajSegment,
  BajajTabKey,
  BajajZone,
  DEFAULT_BAJAJ_OPTIONS,
  IngestedBajajFile,
  SegmentSummaryMetrics,
  buildBajajCsvBlob,
  buildBajajWorkbookBlob,
  fmtCellValue,
  fmtDateShort,
  fmtInr,
  getBajajStatusTone,
  getBajajTabData,
  ingestBajajFiles,
  runBajajReconciliation,
} from '../../utils/bajajReconEngine';
import { emitGlobalProgress } from '../TopLoadingBar';
import { FileDropZone } from './FileDropZone';
import { ToolPasscodeGate } from './ToolPasscodeGate';

interface BajajReconciliationViewProps {
  tool?: ToolCatalogItem;
  isVaultUnlocked?: boolean;
  onBack?: () => void;
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

function toneTextClass(s: unknown): string {
  const t = getBajajStatusTone(s);
  if (t === 'wn') return 'text-rose-700 dark:text-rose-300 font-semibold';
  if (t === 'am') return 'text-[#9A5B00] dark:text-amber-300 font-semibold';
  if (t === 'ok') return 'text-[#12805C] dark:text-emerald-300 font-semibold';
  return '';
}

const ZONE_META: Array<{
  zone: BajajZone;
  step: string;
  title: string;
  subtitle: string;
  acceptLabel: string;
}> = [
  {
    zone: 'claim',
    step: '1',
    title: 'Bajaj Claim Sheets',
    subtitle: 'Claim payment reports and cheque / NEFT settlement reports',
    acceptLabel: '.xlsx .xls .csv .pdf · multiple files',
  },
  {
    zone: 'dms',
    step: '2',
    title: 'Tally / DMS Invoices & Credit Notes',
    subtitle: 'DMS service invoices, credit memos, Tally sales / day-book / credit-note registers',
    acceptLabel: '.xlsx .xls .csv .pdf · multiple files',
  },
  {
    zone: 'bank',
    step: '3',
    title: 'Bank Statement (Optional)',
    subtitle: 'Needs a date, a UTR / reference, and a credit / deposit amount column',
    acceptLabel: '.xlsx .xls .csv .pdf · optional',
  },
];

export const BajajReconciliationView: React.FC<BajajReconciliationViewProps> = ({
  tool,
  isVaultUnlocked = false,
  onBack,
}) => {
  return (
    <ToolPasscodeGate
      toolCode={`${tool?.code ?? 'VC-15'} · ${tool?.suite ?? 'VCPL Tools'}`}
      toolTitle={tool?.title ?? 'Bajaj Reconciliation Desk'}
      sessionKey="vcpl_bajaj_recon_unlocked_v1"
      bypassGate={isVaultUnlocked}
      description="Authorized dealership access required for Bajaj Reconciliation Desk. Enter the 6-digit passcode to unlock."
      onBack={onBack}
    >
      {() => <BajajReconciliationWorkspace tool={tool} />}
    </ToolPasscodeGate>
  );
};

const BajajReconciliationWorkspace: React.FC<{
  tool?: ToolCatalogItem;
}> = ({ tool }) => {
  const [files, setFiles] = useState<IngestedBajajFile[]>([]);
  const [options, setOptions] = useState<BajajOptions>(() => ({ ...DEFAULT_BAJAJ_OPTIONS }));
  const [optionsOpen, setOptionsOpen] = useState(true);
  const [isIngesting, setIsIngesting] = useState(false);
  const [status, setStatus] = useState<{ text: string; tone: 'neutral' | 'ok' | 'bad' }>({
    text: '',
    tone: 'neutral',
  });

  const [result, setResult] = useState<BajajReconResult | null>(null);
  const [activeTab, setActiveTab] = useState<BajajTabKey>('sum');
  const [sortState, setSortState] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [segmentFilter, setSegmentFilter] = useState<'' | BajajSegment>('');
  const [statusFilter, setStatusFilter] = useState('');

  const claimInputRef = useRef<HTMLInputElement>(null);
  const dmsInputRef = useRef<HTMLInputElement>(null);
  const bankInputRef = useRef<HTMLInputElement>(null);

  const inputRefByZone: Record<BajajZone, React.RefObject<HTMLInputElement | null>> = {
    claim: claimInputRef,
    dms: dmsInputRef,
    bank: bankInputRef,
  };

  const executeReconcile = (fileList: IngestedBajajFile[], opts: BajajOptions) => {
    const out = runBajajReconciliation(fileList, opts);
    setResult(out);
    if (!out && fileList.length > 0) {
      setStatus({
        text: 'Upload at least one recognised Bajaj Claim sheet, DMS Invoice export, or Tally register to reconcile.',
        tone: 'bad',
      });
    }
    return out;
  };

  const handleAddFiles = async (incoming: File[], askedZone: BajajZone) => {
    if (!incoming.length) return;
    setIsIngesting(true);
    emitGlobalProgress(true, 30, 'bajaj-ingest');
    setStatus({ text: `Reading ${incoming.length} file${incoming.length > 1 ? 's' : ''} locally…`, tone: 'neutral' });
    try {
      const parsed = await ingestBajajFiles(incoming, askedZone);
      emitGlobalProgress(true, 75, 'bajaj-ingest');
      const nextFiles = [...files, ...parsed];
      setFiles(nextFiles);

      const movedCount = parsed.filter((f) => f.type !== '?' && f.zone !== f.asked).length;
      const unrecognizedCount = parsed.filter((f) => f.type === '?').length;
      const out = executeReconcile(nextFiles, options);

      if (unrecognizedCount === parsed.length) {
        setStatus({
          text: `Loaded ${parsed.length} file(s), but headers were not recognised as Bajaj, DMS, Tally, or Bank tables.`,
          tone: 'bad',
        });
      } else if (out) {
        const parts = [`Reconciled ${out.M.length} pay-apps and ${out.bills.length} bills.`];
        if (movedCount > 0) parts.push(`${movedCount} auto-routed to matching slot.`);
        if (unrecognizedCount > 0) parts.push(`${unrecognizedCount} sheet(s) unrecognised.`);
        setStatus({ text: parts.join(' '), tone: 'ok' });
      } else {
        setStatus({
          text: `Added ${parsed.length} file(s). Add Bajaj claim sheets or DMS/Tally registers to run full reconciliation.`,
          tone: 'neutral',
        });
      }
    } catch {
      setStatus({ text: 'Failed to parse one or more uploaded files.', tone: 'bad' });
    } finally {
      emitGlobalProgress(false, 100, 'bajaj-ingest');
      setIsIngesting(false);
    }
  };

  const handleRemoveFile = (id: string) => {
    const nextFiles = files.filter((f) => f.id !== id);
    setFiles(nextFiles);
    if (nextFiles.length === 0) {
      setResult(null);
      setStatus({ text: '', tone: 'neutral' });
    } else {
      executeReconcile(nextFiles, options);
    }
  };

  const handleClearZone = (zone: BajajZone) => {
    const nextFiles = files.filter((f) => f.zone !== zone);
    setFiles(nextFiles);
    if (nextFiles.length === 0) {
      setResult(null);
      setStatus({ text: '', tone: 'neutral' });
    } else {
      executeReconcile(nextFiles, options);
    }
  };

  const handleClearAll = () => {
    setFiles([]);
    setResult(null);
    setActiveTab('sum');
    setSortState(null);
    setSearchQuery('');
    setSegmentFilter('');
    setStatusFilter('');
    setStatus({ text: 'Workspace cleared. Ready for fresh files.', tone: 'neutral' });
  };

  const updateOptions = (patch: Partial<BajajOptions>) => {
    const next = { ...options, ...patch };
    setOptions(next);
    if (files.length > 0 && result) {
      executeReconcile(files, next);
    }
  };

  const handleResetOptions = () => {
    const fresh = { ...DEFAULT_BAJAJ_OPTIONS, asOnDate: new Date().toISOString().slice(0, 10) };
    setOptions(fresh);
    if (files.length > 0) {
      executeReconcile(files, fresh);
      setStatus({ text: 'Matching options restored to defaults and re-reconciled.', tone: 'ok' });
    } else {
      setStatus({ text: 'Matching options restored to defaults.', tone: 'neutral' });
    }
  };

  const handleRunManual = () => {
    if (!files.length) {
      setStatus({ text: 'Please add at least one file before reconciling.', tone: 'bad' });
      return;
    }
    const out = executeReconcile(files, options);
    if (out) {
      setStatus({
        text: `Reconciliation updated: ${out.M.length} pay-apps, ${out.ex.length} audit findings.`,
        tone: 'ok',
      });
    }
  };

  const handleSelectTab = (tab: BajajTabKey) => {
    setActiveTab(tab);
    setSortState(null);
    if (tab !== 'exc') {
      setStatusFilter('');
    }
  };

  const handleAuditDrilldown = (checkName: string) => {
    setActiveTab('exc');
    setStatusFilter(checkName);
    setSegmentFilter('');
    setSearchQuery('');
    setSortState(null);
  };

  const handleClearTableFilters = () => {
    setSearchQuery('');
    setSegmentFilter('');
    setStatusFilter('');
    setSortState(null);
  };

  // Current table view rows + filters
  const tableView = useMemo(() => {
    if (!result || activeTab === 'sum' || activeTab === 'aud') return null;
    const { cols, rows: rawRows } = getBajajTabData(result, activeTab);
    const statusOptions = [
      ...new Set(
        rawRows
          .map((r) => String(r.status || r.cm || ''))
          .filter(Boolean)
      ),
    ].sort();

    const q = searchQuery.trim().toLowerCase();
    let filteredRows = rawRows.filter((r) => {
      if (segmentFilter && r.seg !== segmentFilter) return false;
      if (
        statusFilter &&
        r.status !== statusFilter &&
        r.cm !== statusFilter &&
        r.type !== statusFilter
      ) {
        return false;
      }
      if (q) {
        const hit = cols.some((c) => {
          const val = c.fmt === 'd' ? fmtDateShort(r[c.key] as Date | null | undefined) : r[c.key];
          return String(val ?? '').toLowerCase().includes(q);
        });
        if (!hit) return false;
      }
      return true;
    });

    if (sortState) {
      const { key, dir } = sortState;
      filteredRows = [...filteredRows].sort((a, b) => {
        const x = a[key];
        const y = b[key];
        const xv = x instanceof Date ? x.getTime() : x ?? '';
        const yv = y instanceof Date ? y.getTime() : y ?? '';
        if (xv > yv) return dir;
        if (xv < yv) return -dir;
        return 0;
      });
    }

    return {
      cols,
      totalCount: rawRows.length,
      rows: filteredRows,
      statusOptions,
    };
  }, [result, activeTab, searchQuery, segmentFilter, statusFilter, sortState]);

  const handleExportExcel = () => {
    if (!result) return;
    const blob = buildBajajWorkbookBlob(result);
    triggerDownload(blob, 'Bajaj_Reconciliation.xlsx');
    setStatus({ text: 'Downloaded Bajaj_Reconciliation.xlsx (all 9 worksheets).', tone: 'ok' });
  };

  const handleExportCsv = () => {
    if (!tableView || activeTab === 'sum' || activeTab === 'aud') return;
    const blob = buildBajajCsvBlob(tableView.cols, tableView.rows);
    triggerDownload(blob, `Bajaj_${activeTab}.csv`);
    setStatus({ text: `Downloaded Bajaj_${activeTab}.csv (${tableView.rows.length} rows).`, tone: 'ok' });
  };

  // Summary computations
  const monthlyRows = useMemo(() => {
    if (!result) return [];
    const mo: Record<string, { c: number; r: number; t: number; g: number }> = {};
    result.M.forEach((r) => {
      if (!r.utrd) return;
      const k = `${r.utrd.getUTCFullYear()}-${String(r.utrd.getUTCMonth() + 1).padStart(2, '0')}`;
      const m = mo[k] || (mo[k] = { c: 0, r: 0, t: 0, g: 0 });
      if (r.type === 'Claim Payment') {
        m.c += r.net;
        m.t += r.tds;
        m.g += r.gst;
      } else {
        m.r += r.net;
      }
    });
    const maxVal = Math.max(1, ...Object.values(mo).map((m) => m.c + m.r));
    return Object.keys(mo)
      .sort()
      .map((month) => ({
        month,
        ...mo[month],
        pct: ((mo[month].c + mo[month].r) / maxVal) * 100,
      }));
  }, [result]);

  const ageingRows = useMemo(() => {
    if (!result) return [];
    const ag: Record<string, { n: number; i: number; w: number; o: number }> = {};
    result.gst
      .filter((g) => g.pend > result.opt.tol)
      .forEach((g) => {
        const key = g.age || 'n/a';
        const entry = ag[key] || (ag[key] = { n: 0, i: 0, w: 0, o: g.ao });
        entry.n++;
        if (g.seg === 'Warranty') entry.w += g.pend;
        else entry.i += g.pend;
      });
    return Object.keys(ag)
      .sort((a, b) => ag[a].o - ag[b].o)
      .map((bucket) => ({ bucket, ...ag[bucket] }));
  }, [result]);

  const recStatusSummary = useMemo(() => {
    if (!result) return [];
    const rs: Record<string, { n: number; a: number }> = {};
    result.rec.forEach((r) => {
      const entry = rs[r.status] || (rs[r.status] = { n: 0, a: 0 });
      entry.n++;
      entry.a += r.damt != null ? r.damt : r.tamt || 0;
    });
    return Object.keys(rs)
      .sort()
      .map((statusName) => ({ statusName, ...rs[statusName] }));
  }, [result]);

  const countByType = (t: string) => files.filter((f) => f.type === t).length;
  const hasFiltersActive = Boolean(
    searchQuery.trim() || segmentFilter || statusFilter || sortState
  );

  return (
    <div className="space-y-5">
      {/* Header Card */}
      <div className="bg-[#FFFDF5] dark:bg-[#0F172A] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-4 sm:p-5 shadow-[0_4px_0_#2F3E4E] dark:shadow-[0_4px_0_#020617] flex flex-col lg:flex-row lg:items-center justify-between gap-4 no-print">
        <div className="space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B] dark:text-slate-400">
            <span className="font-mono font-bold text-[#2F3E4E] dark:text-[#F9C80E]">
              {tool?.code ?? 'VC-15'}
            </span>
            <span aria-hidden="true">·</span>
            <span>VCPL Dealership Audit</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 text-[#12805C] dark:text-emerald-400 font-semibold">
              <HardDrive className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>100% Browser-Local</span>
            </span>
          </div>
          <h1 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] dark:text-slate-100 tracking-tight flex items-center gap-2">
            <GitCompareArrows className="w-5 h-5 text-[#12805C] dark:text-[#F9C80E] shrink-0" aria-hidden="true" />
            <span>{tool?.title ?? 'Bajaj Reconciliation Desk'}</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#475569] dark:text-slate-300 max-w-3xl">
            Reconcile Bajaj Allianz claim payments, cheque/NEFT reports, DMS service invoices,
            credit notes, Tally registers &amp; bank statements with 27 automated audit checks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleRunManual}
            disabled={isIngesting || !files.length}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#F9C80E] hover:bg-[#FFE1B3] text-[#2F3E4E] border-[1.5px] border-[#2F3E4E] font-display font-extrabold text-xs sm:text-sm shadow-[0_2px_0_#2F3E4E] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
          >
            <GitCompareArrows className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Reconcile</span>
          </button>

          {result && (
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#12805C] hover:bg-[#0F684A] text-[#FFFDF5] border-[1.5px] border-[#2F3E4E] dark:border-emerald-700 font-display font-bold text-xs sm:text-sm transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Export Excel</span>
            </button>
          )}

          {result && (
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#FFFDF5] dark:bg-slate-800 hover:bg-[#FEF2C8] dark:hover:bg-slate-700 text-[#2F3E4E] dark:text-slate-100 border-[1.5px] border-[#2F3E4E] dark:border-slate-600 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Printer className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Print</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleClearAll}
            disabled={!files.length && !result}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#FFFDF5] dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-[1.5px] border-[#2F3E4E] dark:border-slate-600 text-xs font-bold transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Clear All</span>
          </button>
        </div>
      </div>

      {/* Status Notice */}
      {status.text && (
        <div
          role="status"
          className={`flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border-[1.5px] text-xs font-medium no-print ${
            status.tone === 'bad'
              ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-600/40 text-rose-800 dark:text-rose-200'
              : status.tone === 'ok'
              ? 'bg-[#CEE5DC]/65 dark:bg-emerald-950/50 border-[#12805C]/45 text-[#12805C] dark:text-emerald-200'
              : 'bg-[#FEF2C8]/75 dark:bg-slate-800/80 border-[#2F3E4E]/30 dark:border-slate-700 text-[#2F3E4E] dark:text-slate-200'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {status.tone === 'bad' ? (
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            )}
            <span>{status.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatus({ text: '', tone: 'neutral' })}
            aria-label="Dismiss notice"
            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* 3 Upload Zones */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 no-print">
        {ZONE_META.map((zm) => {
          const zoneFiles = files.filter((f) => f.zone === zm.zone);
          const inputRef = inputRefByZone[zm.zone];
          return (
            <div
              key={zm.zone}
              className="bg-[#FFFDF5] dark:bg-[#0F172A] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-xl p-4 flex flex-col justify-between gap-3"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="font-display font-bold text-sm text-[#2F3E4E] dark:text-slate-100">
                      {zm.step}. {zm.title}
                    </h2>
                    <p className="text-[11px] leading-snug text-[#64748B] dark:text-slate-400 mt-0.5">
                      {zm.subtitle}
                    </p>
                  </div>
                  {zoneFiles.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleClearZone(zm.zone)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[#2F3E4E]/25 dark:border-slate-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-[11px] font-semibold text-rose-700 dark:text-rose-300 cursor-pointer shrink-0 whitespace-nowrap"
                    >
                      <X className="w-3 h-3" aria-hidden="true" />
                      <span>Clear ({zoneFiles.length})</span>
                    </button>
                  )}
                </div>

                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  accept=".xlsx,.xls,.csv,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const list = e.target.files ? Array.from(e.target.files) : [];
                    void handleAddFiles(list, zm.zone);
                    e.target.value = '';
                  }}
                />

                <FileDropZone
                  accept=".xlsx,.xls,.csv,.pdf"
                  multiple
                  onFiles={(dropped) => void handleAddFiles(dropped, zm.zone)}
                  className="border-2 border-dashed border-[#2F3E4E]/35 dark:border-slate-600 rounded-xl p-4 text-center cursor-pointer transition-colors hover:border-[#2F3E4E] hover:bg-[#FEF2C8]/45 dark:hover:bg-slate-800/60"
                >
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="w-full flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer"
                  >
                    <Upload className="w-5 h-5 text-[#12805C] dark:text-[#F9C80E]" aria-hidden="true" />
                    <span className="text-xs font-bold text-[#2F3E4E] dark:text-slate-100">
                      Drop or click to add files
                    </span>
                    <span className="text-[11px] text-[#64748B] dark:text-slate-400">
                      {zm.acceptLabel}
                    </span>
                  </button>
                </FileDropZone>
              </div>

              {zoneFiles.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {zoneFiles.map((f) => (
                    <span
                      key={f.id}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium max-w-full ${
                        f.type === '?'
                          ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-500/40 text-rose-800 dark:text-rose-200'
                          : 'bg-[#CEE5DC]/55 dark:bg-emerald-950/55 border-[#12805C]/35 text-[#2F3E4E] dark:text-emerald-100'
                      }`}
                    >
                      <FileSpreadsheet className="w-3 h-3 shrink-0" aria-hidden="true" />
                      <span className="truncate max-w-[190px]" title={f.name}>
                        {f.name}
                      </span>
                      <span className="opacity-75 whitespace-nowrap">
                        · {BAJAJ_FILE_LABELS[f.type]}
                        {f.type === '?' ? ` (${f.why})` : ` · ${f.rows.length} rows`}
                        {f.zone !== f.asked ? ' · auto-moved' : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(f.id)}
                        aria-label={`Remove ${f.name}`}
                        className="ml-0.5 p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer shrink-0"
                      >
                        <X className="w-3 h-3" aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-[#64748B] dark:text-slate-400 no-print">
        Files are auto-detected by column headers. Any sheet dropped into the wrong slot is
        automatically routed to the correct category.
      </p>

      {/* Options Panel */}
      <div className="bg-[#FFFDF5] dark:bg-[#0F172A] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-xl overflow-hidden no-print">
        <button
          type="button"
          onClick={() => setOptionsOpen((v) => !v)}
          className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left bg-[#FEF2C8]/55 dark:bg-slate-800/70 hover:bg-[#FEF2C8]/85 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <span className="inline-flex items-center gap-2 font-display font-bold text-sm text-[#2F3E4E] dark:text-slate-100">
            <SlidersHorizontal className="w-4 h-4 text-[#12805C] dark:text-[#F9C80E]" aria-hidden="true" />
            <span>Reconciliation Rules, TDS &amp; Ageing Options</span>
          </span>
          {optionsOpen ? (
            <ChevronUp className="w-4 h-4 text-[#2F3E4E] dark:text-slate-300" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[#2F3E4E] dark:text-slate-300" aria-hidden="true" />
          )}
        </button>

        {optionsOpen && (
          <div className="p-4 space-y-4 border-t border-[#2F3E4E]/15 dark:border-slate-800">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#475569] dark:text-slate-300 mb-1">
                  As-on date (ageing)
                </label>
                <input
                  type="date"
                  value={options.asOnDate}
                  onChange={(e) => updateOptions({ asOnDate: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/35 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-mono text-[#2F3E4E] dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#475569] dark:text-slate-300 mb-1">
                  Standard TDS rate %
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={options.tdsRate}
                  onChange={(e) => updateOptions({ tdsRate: parseFloat(e.target.value) || 0 })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/35 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-mono text-[#2F3E4E] dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#475569] dark:text-slate-300 mb-1">
                  Rounding tolerance (₹)
                </label>
                <input
                  type="number"
                  value={options.tol}
                  onChange={(e) => updateOptions({ tol: parseFloat(e.target.value) || 0 })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/35 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-mono text-[#2F3E4E] dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#475569] dark:text-slate-300 mb-1">
                  TDS rate tolerance (± %)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={options.tdsTol}
                  onChange={(e) => updateOptions({ tdsTol: parseFloat(e.target.value) || 0 })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/35 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-mono text-[#2F3E4E] dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#475569] dark:text-slate-300 mb-1">
                  Warranty keyword in Bill-To ledger
                </label>
                <input
                  type="text"
                  value={options.warrantyKeyword}
                  onChange={(e) => updateOptions({ warrantyKeyword: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/35 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-mono text-[#2F3E4E] dark:text-slate-100"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-[#475569] dark:text-slate-300 mb-1">
                  Product code → segment mapping
                </label>
                <input
                  type="text"
                  value={options.productMap}
                  onChange={(e) => updateOptions({ productMap: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/35 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-mono text-[#2F3E4E] dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#475569] dark:text-slate-300 mb-1">
                  Default segment (unknown product)
                </label>
                <select
                  value={options.defaultSegment}
                  onChange={(e) =>
                    updateOptions({ defaultSegment: e.target.value as BajajSegment })
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/35 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs text-[#2F3E4E] dark:text-slate-100"
                >
                  <option value="Insurance">Insurance</option>
                  <option value="Warranty">Warranty</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#475569] dark:text-slate-300 mb-1">
                  Ageing buckets (days, comma)
                </label>
                <input
                  type="text"
                  value={options.buckets}
                  onChange={(e) => updateOptions({ buckets: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/35 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-mono text-[#2F3E4E] dark:text-slate-100"
                />
              </div>

              <div className="sm:col-span-3 flex flex-wrap items-center gap-x-5 gap-y-2 pt-2">
                <label className="inline-flex items-center gap-2 text-xs text-[#2F3E4E] dark:text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.dedupPayApp}
                    onChange={(e) => updateOptions({ dedupPayApp: e.target.checked })}
                    className="rounded accent-[#2F3E4E]"
                  />
                  <span>Remove duplicate Pay App Nos</span>
                </label>

                <label className="inline-flex items-center gap-2 text-xs text-[#2F3E4E] dark:text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.includeChqOnly}
                    onChange={(e) => updateOptions({ includeChqOnly: e.target.checked })}
                    className="rounded accent-[#2F3E4E]"
                  />
                  <span>Add cheque-report-only rows</span>
                </label>

                <label className="inline-flex items-center gap-2 text-xs text-[#2F3E4E] dark:text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.bajajInvoicesOnly}
                    onChange={(e) => updateOptions({ bajajInvoicesOnly: e.target.checked })}
                    className="rounded accent-[#2F3E4E]"
                  />
                  <span>Bajaj invoices only</span>
                </label>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#2F3E4E]/10 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleRunManual}
                  disabled={isIngesting || !files.length}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#2F3E4E] dark:bg-[#F9C80E] hover:bg-[#1E293B] dark:hover:bg-[#FDE047] text-[#FFFDF5] dark:text-[#0F172A] font-display font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  <GitCompareArrows className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Run Reconciliation</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetOptions}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#2F3E4E]/35 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-[#FEF2C8] dark:hover:bg-slate-700 text-xs font-semibold text-[#2F3E4E] dark:text-slate-100 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Reset Options</span>
                </button>
              </div>

              <span className="text-[11px] font-mono text-[#64748B] dark:text-slate-400">
                {files.length} sheet{files.length === 1 ? '' : 's'} loaded
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Results Area */}
      {!result ? (
        <div className="bg-[#FFFDF5] dark:bg-[#0F172A] border-[1.5px] border-dashed border-[#2F3E4E]/45 dark:border-slate-700 rounded-xl p-8 text-center space-y-2">
          <FileSpreadsheet className="w-8 h-8 text-[#12805C] dark:text-[#F9C80E] mx-auto" aria-hidden="true" />
          <p className="font-display font-bold text-sm text-[#2F3E4E] dark:text-slate-100">
            Ready to Reconcile Bajaj Allianz Statements
          </p>
          <p className="text-xs text-[#64748B] dark:text-slate-400 max-w-xl mx-auto">
            Add Bajaj claim sheets in slot 1 and Tally / DMS invoices and credit notes in slot 2 to
            begin. Adding a bank statement in slot 3 is optional for UTR bank-credit verification.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Navigation Tabs */}
          <div className="flex flex-wrap gap-1.5 p-1.5 bg-[#FEF2C8]/65 dark:bg-slate-900 border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-xl no-print">
            {BAJAJ_TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => handleSelectTab(tab.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-display font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#FFFDF5] dark:text-[#0F172A] shadow-sm'
                      : 'text-[#2F3E4E] dark:text-slate-300 hover:bg-[#FFFDF5] dark:hover:bg-slate-800'
                  }`}
                >
                  {tab.label}
                  {tab.key === 'exc' && result.ex.length > 0 && (
                    <span className="ml-1.5 font-mono text-[10px] opacity-85">
                      ({result.ex.length})
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab 1: Summary */}
          {activeTab === 'sum' && (
            <div className="space-y-4">
              {/* 4 KPI Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {(
                  [
                    'GST still pending',
                    'Net credited',
                    'GST released',
                    'TDS deducted',
                  ] as Array<keyof SegmentSummaryMetrics>
                ).map((k) => (
                  <div
                    key={k}
                    className="bg-[#FFFDF5] dark:bg-[#0F172A] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-xl p-4"
                  >
                    <p className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400">
                      {k} (total)
                    </p>
                    <p className="font-mono tabular-nums font-bold text-lg text-[#2F3E4E] dark:text-slate-100 mt-1">
                      ₹{fmtInr(result.segSummary.Total[k])}
                    </p>
                  </div>
                ))}
              </div>

              {/* Segment Comparison */}
              <div className="bg-[#FFFDF5] dark:bg-[#0F172A] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 border-b border-[#2F3E4E]/15 dark:border-slate-800 bg-[#FEF2C8]/50 dark:bg-slate-800/70">
                  <h3 className="font-display font-bold text-sm text-[#2F3E4E] dark:text-slate-100">
                    Segment Breakdown (Insurance vs Warranty)
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#CEE5DC]/55 dark:bg-slate-800 text-[#2F3E4E] dark:text-slate-200 border-b border-[#2F3E4E]/20 dark:border-slate-700">
                        <th className="text-left px-3 py-2 font-display font-bold">Metric</th>
                        <th className="text-right px-3 py-2 font-display font-bold">
                          Bajaj Insurance
                        </th>
                        <th className="text-right px-3 py-2 font-display font-bold">
                          Bajaj Warranty
                        </th>
                        <th className="text-right px-3 py-2 font-display font-bold">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2F3E4E]/10 dark:divide-slate-800">
                      {(Object.keys(result.segSummary.Total) as Array<keyof SegmentSummaryMetrics>).map(
                        (metric) => (
                          <tr
                            key={metric}
                            className="hover:bg-[#FEF2C8]/30 dark:hover:bg-slate-800/40"
                          >
                            <td className="px-3 py-2 font-medium text-[#2F3E4E] dark:text-slate-200">
                              {metric}
                            </td>
                            {(['Insurance', 'Warranty', 'Total'] as const).map((segKey) => (
                              <td
                                key={segKey}
                                className="px-3 py-2 text-right font-mono tabular-nums text-[#2F3E4E] dark:text-slate-100"
                              >
                                {fmtInr(result.segSummary[segKey][metric])}
                              </td>
                            ))}
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Month-wise Bank Credits */}
              <div className="bg-[#FFFDF5] dark:bg-[#0F172A] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 border-b border-[#2F3E4E]/15 dark:border-slate-800 bg-[#FEF2C8]/50 dark:bg-slate-800/70">
                  <h3 className="font-display font-bold text-sm text-[#2F3E4E] dark:text-slate-100">
                    Month-Wise Bank Credits
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#CEE5DC]/55 dark:bg-slate-800 text-[#2F3E4E] dark:text-slate-200 border-b border-[#2F3E4E]/20 dark:border-slate-700">
                        <th className="text-left px-3 py-2 font-display font-bold">Month</th>
                        <th className="text-right px-3 py-2 font-display font-bold">
                          Net credited
                        </th>
                        <th className="text-right px-3 py-2 font-display font-bold">
                          GST released
                        </th>
                        <th className="text-right px-3 py-2 font-display font-bold">TDS</th>
                        <th className="text-right px-3 py-2 font-display font-bold">GST held</th>
                        <th className="px-3 py-2 w-[28%]">Volume Share</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2F3E4E]/10 dark:divide-slate-800">
                      {monthlyRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-3 py-4 text-center text-[#64748B] dark:text-slate-400"
                          >
                            No dated UTR credits found.
                          </td>
                        </tr>
                      ) : (
                        monthlyRows.map((m) => (
                          <tr
                            key={m.month}
                            className="hover:bg-[#FEF2C8]/30 dark:hover:bg-slate-800/40"
                          >
                            <td className="px-3 py-2 font-mono">{m.month}</td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums">
                              {fmtInr(m.c)}
                            </td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums">
                              {fmtInr(m.r)}
                            </td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums">
                              {fmtInr(m.t)}
                            </td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums">
                              {fmtInr(m.g)}
                            </td>
                            <td className="px-3 py-2">
                              <div className="w-full bg-[#2F3E4E]/10 dark:bg-slate-800 rounded h-2 overflow-hidden">
                                <div
                                  className="h-2 bg-[#12805C] dark:bg-[#F9C80E] rounded"
                                  style={{ width: `${Math.max(2, m.pct)}%` }}
                                />
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* GST Pending Ageing + Integrity Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-[#FFFDF5] dark:bg-[#0F172A] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-[#2F3E4E]/15 dark:border-slate-800 bg-[#FEF2C8]/50 dark:bg-slate-800/70">
                    <h3 className="font-display font-bold text-sm text-[#2F3E4E] dark:text-slate-100">
                      GST Pending – Ageing as on {fmtDateShort(result.opt.asOn)}
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#CEE5DC]/55 dark:bg-slate-800 text-[#2F3E4E] dark:text-slate-200 border-b border-[#2F3E4E]/20 dark:border-slate-700">
                          <th className="text-left px-3 py-2 font-display font-bold">Bucket</th>
                          <th className="text-right px-3 py-2 font-display font-bold">Pay-apps</th>
                          <th className="text-right px-3 py-2 font-display font-bold">
                            Insurance
                          </th>
                          <th className="text-right px-3 py-2 font-display font-bold">Warranty</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2F3E4E]/10 dark:divide-slate-800">
                        {ageingRows.length === 0 ? (
                          <tr>
                            <td
                              colSpan={4}
                              className="px-3 py-4 text-center text-[#12805C] dark:text-emerald-300 font-medium"
                            >
                              No GST pending
                            </td>
                          </tr>
                        ) : (
                          ageingRows.map((a) => (
                            <tr key={a.bucket}>
                              <td className="px-3 py-2">{a.bucket}</td>
                              <td className="px-3 py-2 text-right font-mono tabular-nums">{a.n}</td>
                              <td className="px-3 py-2 text-right font-mono tabular-nums">
                                {fmtInr(a.i)}
                              </td>
                              <td className="px-3 py-2 text-right font-mono tabular-nums">
                                {fmtInr(a.w)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-[#FFFDF5] dark:bg-[#0F172A] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-[#2F3E4E]/15 dark:border-slate-800 bg-[#FEF2C8]/50 dark:bg-slate-800/70">
                    <h3 className="font-display font-bold text-sm text-[#2F3E4E] dark:text-slate-100">
                      Integrity Checks
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <tbody className="divide-y divide-[#2F3E4E]/10 dark:divide-slate-800">
                        {(
                          [
                            [
                              'Rows where approved − GST − TDS ≠ net',
                              result.M.filter((r) => r.mchk === 'DIFF').length,
                            ],
                            [
                              'Cheque report amount differs',
                              result.M.filter((r) => r.cm === 'AMT DIFF').length,
                            ],
                            [
                              'Pay-apps with GST pending / partial',
                              result.gst.filter((g) => g.pend > result.opt.tol).length,
                            ],
                            [
                              'GST releases without hold row',
                              result.gst.filter((g) => g.status.startsWith('Release –')).length,
                            ],
                            [
                              'UTRs not tallied with bank',
                              result.utr.filter((u) => u.status === 'NOT TALLIED').length,
                            ],
                            [
                              'UTRs awaiting bank statement',
                              result.utr.filter((u) => /wait/.test(u.status)).length,
                            ],
                            [
                              'Invoices awaiting claim payment',
                              result.bills.filter((b) => b.status.startsWith('Invoice raised'))
                                .length,
                            ],
                            [
                              'Bills with no invoice in uploaded register',
                              result.bills.filter((b) => b.ist === 'Not in register').length,
                            ],
                          ] as Array<[string, number]>
                        ).map(([label, count]) => (
                          <tr key={label}>
                            <td className="px-3 py-2 text-[#2F3E4E] dark:text-slate-200">{label}</td>
                            <td
                              className={`px-3 py-2 text-right font-mono tabular-nums font-bold ${
                                count > 0
                                  ? 'text-[#9A5B00] dark:text-amber-300'
                                  : 'text-[#12805C] dark:text-emerald-300'
                              }`}
                            >
                              {count}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Tally / DMS Summary */}
              {recStatusSummary.length > 0 && (
                <div className="bg-[#FFFDF5] dark:bg-[#0F172A] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-[#2F3E4E]/15 dark:border-slate-800 bg-[#FEF2C8]/50 dark:bg-slate-800/70">
                    <h3 className="font-display font-bold text-sm text-[#2F3E4E] dark:text-slate-100">
                      Tally / DMS Reconciliation Status
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#CEE5DC]/55 dark:bg-slate-800 text-[#2F3E4E] dark:text-slate-200 border-b border-[#2F3E4E]/20 dark:border-slate-700">
                          <th className="text-left px-3 py-2 font-display font-bold">Status</th>
                          <th className="text-right px-3 py-2 font-display font-bold">Documents</th>
                          <th className="text-right px-3 py-2 font-display font-bold">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2F3E4E]/10 dark:divide-slate-800">
                        {recStatusSummary.map((r) => (
                          <tr key={r.statusName}>
                            <td className={`px-3 py-2 ${toneTextClass(r.statusName)}`}>
                              {r.statusName}
                            </td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums">{r.n}</td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums">
                              {fmtInr(r.a, 2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Audit */}
          {activeTab === 'aud' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {(['High', 'Medium', 'Info'] as const).map((sev) => {
                  const totalSev = result.auditKeys
                    .filter((k) => BAJAJ_AUDIT_CHECKS[k] === sev)
                    .reduce((t, k) => t + (result.auditGroups[k]?.n || 0), 0);
                  return (
                    <div
                      key={sev}
                      className="bg-[#FFFDF5] dark:bg-[#0F172A] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-xl p-4"
                    >
                      <p className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400">
                        {sev} severity findings
                      </p>
                      <p
                        className={`font-mono tabular-nums font-bold text-lg mt-1 ${
                          sev === 'High'
                            ? 'text-rose-700 dark:text-rose-300'
                            : sev === 'Medium'
                            ? 'text-[#9A5B00] dark:text-amber-300'
                            : 'text-[#2F3E4E] dark:text-slate-100'
                        }`}
                      >
                        {totalSev}
                      </p>
                    </div>
                  );
                })}
                <div className="bg-[#FFFDF5] dark:bg-[#0F172A] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-xl p-4">
                  <p className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400">
                    Checks run
                  </p>
                  <p className="font-mono tabular-nums font-bold text-lg text-[#2F3E4E] dark:text-slate-100 mt-1">
                    {
                      result.auditKeys.filter(
                        (k) =>
                          !(
                            (!result.hasT && /Tally/.test(k)) ||
                            (!result.hasD && /DMS/.test(k) && /Tally|DMS/.test(k))
                          )
                      ).length
                    }{' '}
                    / {result.auditKeys.length}
                  </p>
                </div>
              </div>

              {/* 27 Checks Matrix */}
              <div className="bg-[#FFFDF5] dark:bg-[#0F172A] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#CEE5DC]/55 dark:bg-slate-800 text-[#2F3E4E] dark:text-slate-200 border-b border-[#2F3E4E]/20 dark:border-slate-700">
                        <th className="text-left px-3 py-2 font-display font-bold">Severity</th>
                        <th className="text-left px-3 py-2 font-display font-bold">Check</th>
                        <th className="text-right px-3 py-2 font-display font-bold">Findings</th>
                        <th className="text-right px-3 py-2 font-display font-bold">Amount</th>
                        <th className="text-right px-3 py-2 font-display font-bold">Inspect</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2F3E4E]/10 dark:divide-slate-800">
                      {result.auditKeys.map((k) => {
                        const x = result.auditGroups[k];
                        const skip =
                          (!result.hasT && /Tally/.test(k)) ||
                          (!result.hasD && /DMS/.test(k) && /Tally|DMS/.test(k));
                        return (
                          <tr
                            key={k}
                            className="hover:bg-[#FEF2C8]/30 dark:hover:bg-slate-800/40"
                          >
                            <td className={`px-3 py-2 ${toneTextClass(BAJAJ_AUDIT_CHECKS[k])}`}>
                              {BAJAJ_AUDIT_CHECKS[k]}
                            </td>
                            <td className="px-3 py-2 text-[#2F3E4E] dark:text-slate-200">{k}</td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums">
                              {x ? x.n : 0}
                            </td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums">
                              {x ? fmtInr(x.a) : ''}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {x ? (
                                <button
                                  type="button"
                                  onClick={() => handleAuditDrilldown(k)}
                                  className="px-2.5 py-1 rounded border border-[#2F3E4E]/30 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-[#F9C80E] hover:text-[#2F3E4E] text-[11px] font-bold cursor-pointer"
                                >
                                  View
                                </button>
                              ) : skip ? (
                                <span className="text-[11px] text-[#64748B] dark:text-slate-400">
                                  not run – file missing
                                </span>
                              ) : (
                                <span className="text-[11px] font-semibold text-[#12805C] dark:text-emerald-300">
                                  ✓ clean
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Data Coverage */}
              <div className="bg-[#FFFDF5] dark:bg-[#0F172A] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-xl p-4 space-y-3">
                <h3 className="font-display font-bold text-sm text-[#2F3E4E] dark:text-slate-100">
                  Data Coverage &amp; Upload Summary
                </h3>
                <table className="w-full text-xs border-collapse">
                  <tbody className="divide-y divide-[#2F3E4E]/10 dark:divide-slate-800">
                    <tr>
                      <td className="py-1.5 text-[#475569] dark:text-slate-400">Bajaj UTR dates</td>
                      <td className="py-1.5 text-right font-mono">
                        {result.rng.u
                          ? `${fmtDateShort(result.rng.u[0])} → ${fmtDateShort(result.rng.u[1])}`
                          : 'not uploaded'}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5 text-[#475569] dark:text-slate-400">
                        DMS invoice dates
                      </td>
                      <td className="py-1.5 text-right font-mono">
                        {result.rng.d
                          ? `${fmtDateShort(result.rng.d[0])} → ${fmtDateShort(result.rng.d[1])}`
                          : 'not uploaded'}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5 text-[#475569] dark:text-slate-400">
                        Tally voucher dates
                      </td>
                      <td className="py-1.5 text-right font-mono">
                        {result.rng.t
                          ? `${fmtDateShort(result.rng.t[0])} → ${fmtDateShort(result.rng.t[1])}`
                          : 'not uploaded'}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5 text-[#475569] dark:text-slate-400">Files read</td>
                      <td className="py-1.5 text-right font-mono">
                        {countByType('claim')} claim · {countByType('chq')} cheque ·{' '}
                        {countByType('inv')} DMS inv · {countByType('cn')} DMS CN ·{' '}
                        {countByType('tally')} Tally · {countByType('bank')} bank
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5 text-[#475569] dark:text-slate-400">
                        Unique pay-apps in master
                      </td>
                      <td className="py-1.5 text-right font-mono font-bold">{result.M.length}</td>
                    </tr>
                  </tbody>
                </table>
                <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                  Bills outside the uploaded DMS / Tally date range show as “Outside … period”, not
                  as errors. Tally registers are matched by column headings (voucher no., date,
                  particulars, debit / credit / amount, voucher type).
                </p>
              </div>
            </div>
          )}

          {/* Tabs 3..9: Interactive Data Tables */}
          {tableView && activeTab !== 'sum' && activeTab !== 'aud' && (
            <div className="space-y-3">
              {/* Filter + Export Bar */}
              <div className="bg-[#FFFDF5] dark:bg-[#0F172A] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-xl p-3 flex flex-wrap items-end justify-between gap-3 no-print">
                <div className="flex flex-wrap items-end gap-2.5 flex-1 min-w-0">
                  <div className="min-w-[220px] flex-1 max-w-xs">
                    <label className="block text-[11px] font-semibold text-[#475569] dark:text-slate-300 mb-1">
                      Search
                    </label>
                    <div className="relative">
                      <Search
                        className="w-3.5 h-3.5 text-[#64748B] absolute left-2.5 top-1/2 -translate-y-1/2"
                        aria-hidden="true"
                      />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Claim, UTR, bill, vehicle…"
                        className="w-full pl-8 pr-7 py-1.5 rounded-lg border border-[#2F3E4E]/35 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs text-[#2F3E4E] dark:text-slate-100"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          aria-label="Clear search"
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#2F3E4E] dark:hover:text-white cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>

                  {(activeTab === 'master' ||
                    activeTab === 'gst' ||
                    activeTab === 'utr' ||
                    activeTab === 'rec') && (
                    <div>
                      <label className="block text-[11px] font-semibold text-[#475569] dark:text-slate-300 mb-1">
                        Segment
                      </label>
                      <select
                        value={segmentFilter}
                        onChange={(e) => setSegmentFilter(e.target.value as '' | BajajSegment)}
                        className="px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/35 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs text-[#2F3E4E] dark:text-slate-100"
                      >
                        <option value="">All</option>
                        <option value="Insurance">Insurance</option>
                        <option value="Warranty">Warranty</option>
                      </select>
                    </div>
                  )}

                  {tableView.statusOptions.length > 0 && (
                    <div className="max-w-[260px]">
                      <label className="block text-[11px] font-semibold text-[#475569] dark:text-slate-300 mb-1">
                        Status
                      </label>
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/35 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs text-[#2F3E4E] dark:text-slate-100"
                      >
                        <option value="">All</option>
                        {tableView.statusOptions.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {hasFiltersActive && (
                    <button
                      type="button"
                      onClick={handleClearTableFilters}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/30 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-[#FEF2C8] dark:hover:bg-slate-700 text-xs font-semibold text-[#2F3E4E] dark:text-slate-200 cursor-pointer whitespace-nowrap"
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Clear Filters</span>
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2F3E4E] dark:bg-[#F9C80E] hover:bg-[#1E293B] dark:hover:bg-[#FDE047] text-[#FFFDF5] dark:text-[#0F172A] font-display font-bold text-xs cursor-pointer whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Download Excel (all sheets)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#2F3E4E]/35 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-[#CEE5DC]/50 dark:hover:bg-slate-700 text-xs font-bold text-[#2F3E4E] dark:text-slate-100 cursor-pointer whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Download CSV</span>
                  </button>
                </div>
              </div>

              {/* Scrollable High-Density Table */}
              <div className="bg-[#FFFDF5] dark:bg-[#0F172A] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-xl overflow-hidden">
                <div className="overflow-auto max-h-[68vh]">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#CEE5DC] dark:bg-slate-800 text-[#2F3E4E] dark:text-slate-100 border-b border-[#2F3E4E]/25 dark:border-slate-700">
                        {tableView.cols.map((col: BajajColDef) => {
                          const isNum = Boolean(col.fmt && /n|p|i/.test(col.fmt));
                          const sorted = sortState?.key === col.key;
                          return (
                            <th
                              key={col.key}
                              onClick={() =>
                                setSortState((prev) =>
                                  prev && prev.key === col.key
                                    ? { key: col.key, dir: prev.dir === 1 ? -1 : 1 }
                                    : { key: col.key, dir: 1 }
                                )
                              }
                              className={`sticky top-0 z-10 bg-[#CEE5DC] dark:bg-slate-800 px-3 py-2 font-display font-bold whitespace-nowrap cursor-pointer select-none hover:bg-[#BBDAD0] dark:hover:bg-slate-700 ${
                                isNum ? 'text-right' : 'text-left'
                              }`}
                            >
                              {col.label}
                              {sorted ? (sortState.dir > 0 ? ' ▲' : ' ▼') : ''}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-[#2F3E4E]/10 dark:divide-slate-800">
                      {tableView.rows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={tableView.cols.length}
                            className="px-4 py-8 text-center text-[#64748B] dark:text-slate-400"
                          >
                            No matching rows for current filters.
                          </td>
                        </tr>
                      ) : (
                        tableView.rows.slice(0, 700).map((row, idx) => (
                          <tr
                            key={idx}
                            className="hover:bg-[#FEF2C8]/35 dark:hover:bg-slate-800/45"
                          >
                            {tableView.cols.map((col) => {
                              const isNum = Boolean(col.fmt && /n|p|i/.test(col.fmt));
                              const isTone = /status|^cm$|mchk|^tl$|^sev$/.test(col.key);
                              return (
                                <td
                                  key={col.key}
                                  className={`px-3 py-1.5 whitespace-nowrap ${
                                    isNum ? 'text-right font-mono tabular-nums' : ''
                                  } ${isTone ? toneTextClass(row[col.key]) : ''}`}
                                >
                                  {fmtCellValue(row[col.key], col.fmt)}
                                </td>
                              );
                            })}
                          </tr>
                        ))
                      )}
                    </tbody>

                    <tfoot>
                      <tr className="sticky bottom-0 bg-[#CEE5DC] dark:bg-slate-800 text-[#2F3E4E] dark:text-slate-100 font-bold border-t border-[#2F3E4E]/25 dark:border-slate-700">
                        {tableView.cols.map((col, idx) => {
                          const isMoney = Boolean(col.fmt && /^n/.test(col.fmt));
                          const sumVal = isMoney
                            ? tableView.rows.reduce(
                                (acc, r) => acc + (Number(r[col.key]) || 0),
                                0
                              )
                            : 0;
                          return (
                            <td
                              key={col.key}
                              className={`px-3 py-2 whitespace-nowrap ${
                                isMoney ? 'text-right font-mono tabular-nums' : ''
                              }`}
                            >
                              {isMoney
                                ? fmtInr(sumVal, col.fmt === 'n2' ? 2 : 0)
                                : idx === 0
                                ? `${tableView.rows.length} rows`
                                : ''}
                            </td>
                          );
                        })}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                {tableView.rows.length > 700
                  ? `Showing first 700 of ${tableView.rows.length} rows in preview; Excel and CSV exports include all rows.`
                  : `Showing ${tableView.rows.length} of ${tableView.totalCount} total rows.`}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
