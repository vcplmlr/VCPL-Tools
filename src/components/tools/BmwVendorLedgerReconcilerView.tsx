import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  GitCompareArrows,
  HardDrive,
  RotateCcw,
  Search,
  Upload,
} from 'lucide-react';
import { ToolCatalogItem } from '../../types/tools';
import {
  BmwVendorParsed,
  LC_COLS,
  R2,
  TallyLedgerParsed,
  VENDOR_TABS,
  VendorLedgerRecoResult,
  VendorTabKey,
  WarrantyClaimRow,
  buildVendorLedgerWorkbookBuffer,
  buildVendorTabCsv,
  filterVendorLedgerResult,
  fmtINR,
  parseBmwVendor,
  parseClaimsVendor,
  parseTallyVendor,
  readWorkbookRawSheets,
  reconcileVendorLedger,
} from '../../utils/bmwVendorLedgerEngine';
import { filesToFileList } from '../../utils/fileDropUtils';
import {
  RecoPeriodFilter,
  createDefaultRecoPeriodFilter,
  extractPeriodChoicesFromKeys,
  resolveRecoPeriodBounds,
} from '../../utils/recoPeriodFilter';
import { FileDropZone } from './FileDropZone';
import { RecoPeriodFilterBar } from './RecoPeriodFilterBar';

interface BmwVendorLedgerReconcilerViewProps {
  tool?: ToolCatalogItem;
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

function statusPillClasses(s: string): string {
  if (/^(Matched|Payment matched|Receipt matched|Claim OK|Reversed)/.test(s)) {
    return 'bg-[#CEE5DC]/75 dark:bg-emerald-950/60 text-[#12805C] dark:text-emerald-300 border-[#12805C]/40 dark:border-emerald-700/50';
  }
  if (/^(Amount|Payment amount|Receipt amount|Credit differs|Probable|Prior|TDS only|Possible)/.test(s)) {
    return 'bg-[#FEF2C8] dark:bg-amber-950/50 text-[#9A5B00] dark:text-amber-300 border-[#9A5B00]/35 dark:border-amber-700/50';
  }
  if (/^(Not in|In Tally|Payment not|Receipt not|Claim not|In claims)/.test(s)) {
    return 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-600/35 dark:border-rose-700/50';
  }
  return 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-500/35 dark:border-indigo-700/50';
}

export const BmwVendorLedgerReconcilerView: React.FC<BmwVendorLedgerReconcilerViewProps> = ({
  tool,
  onBack,
}) => {
  const [bmwFiles, setBmwFiles] = useState<File[]>([]);
  const [tallyFiles, setTallyFiles] = useState<File[]>([]);
  const [claimFiles, setClaimFiles] = useState<File[]>([]);

  const [tol, setTol] = useState<string>('5');
  const [win, setWin] = useState<string>('20');
  const [pw, setPw] = useState<string>('45');

  const [status, setStatus] = useState<{ text: string; tone: 'neutral' | 'ok' | 'bad' }>({
    text: '',
    tone: 'neutral',
  });
  const [isRunning, setIsRunning] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [result, setResult] = useState<VendorLedgerRecoResult | null>(null);
  const [periodFilter, setPeriodFilter] = useState<RecoPeriodFilter>(() =>
    createDefaultRecoPeriodFilter()
  );
  const [activeTab, setActiveTab] = useState<VendorTabKey>('b');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const input1Ref = useRef<HTMLInputElement>(null);
  const input2Ref = useRef<HTMLInputElement>(null);
  const input3Ref = useRef<HTMLInputElement>(null);

  const addFiles = (slot: 1 | 2 | 3, incoming: FileList | null) => {
    if (!incoming || incoming.length === 0) return;
    const arr = Array.from(incoming);
    if (slot === 1) {
      setBmwFiles([arr[0]]);
    } else if (slot === 2) {
      setTallyFiles((prev) => [...prev, ...arr]);
    } else {
      setClaimFiles((prev) => [...prev, ...arr]);
    }
    setStatus({ text: '', tone: 'neutral' });
  };

  const handleClear = () => {
    setBmwFiles([]);
    setTallyFiles([]);
    setClaimFiles([]);
    setResult(null);
    setPeriodFilter(createDefaultRecoPeriodFilter());
    setActiveTab('b');
    setStatusFilter('');
    setSearchQuery('');
    setStatus({ text: '', tone: 'neutral' });
  };

  const handleRun = async () => {
    if (!bmwFiles.length || !tallyFiles.length) return;
    setIsRunning(true);
    setStatus({ text: 'Reading files and reconciling ledgers…', tone: 'neutral' });
    try {
      let B: BmwVendorParsed | null = null;
      const bwSheets = await readWorkbookRawSheets(bmwFiles[0]);
      for (const sh of bwSheets) {
        const parsed = parseBmwVendor(sh.rows);
        if (parsed) {
          B = parsed;
          break;
        }
      }
      if (!B) {
        setStatus({
          text: 'Could not find the BMW ledger table (needs “Reference” and “Amount” columns).',
          tone: 'bad',
        });
        setIsRunning(false);
        return;
      }

      const TL: TallyLedgerParsed[] = [];
      for (const f of tallyFiles) {
        const sheets = await readWorkbookRawSheets(f);
        for (const sh of sheets) {
          const L = parseTallyVendor(sh.rows, `${f.name} / ${sh.name}`);
          if (L) TL.push(L);
        }
      }
      if (!TL.length) {
        setStatus({
          text: 'No Tally ledger found (needs “Vch No.”, “Debit”, “Credit” columns).',
          tone: 'bad',
        });
        setIsRunning(false);
        return;
      }

      let CL: WarrantyClaimRow[] = [];
      for (const f of claimFiles) {
        const sheets = await readWorkbookRawSheets(f);
        for (const sh of sheets) {
          CL = CL.concat(parseClaimsVendor(sh.rows));
        }
      }

      const res = reconcileVendorLedger(B, TL, CL, {
        tol: Math.max(0, parseFloat(tol) || 0),
        win: Math.max(0, parseFloat(win) || 0),
        pw: Math.max(0, parseFloat(pw) || 0),
      });

      setResult(res);
      setActiveTab('b');
      setStatusFilter('');
      setSearchQuery('');
      setStatus({
        text: `Reconciliation complete: ${res.cnt.mat} of ${res.cnt.bd + res.cnt.bp} BMW items matched across ${TL.length} Tally ledger(s).`,
        tone: 'ok',
      });
    } catch (err) {
      setStatus({
        text: `Error: ${err instanceof Error ? err.message : 'Unable to parse uploaded files.'}`,
        tone: 'bad',
      });
    } finally {
      setIsRunning(false);
    }
  };

  const availablePeriods = useMemo(() => {
    if (!result) return undefined;
    return extractPeriodChoicesFromKeys([...result.dateKeys.rowsB, ...result.dateKeys.rowsT]);
  }, [result]);

  const periodBounds = useMemo(() => resolveRecoPeriodBounds(periodFilter), [periodFilter]);

  const scopedResult = useMemo(() => {
    if (!result) return null;
    return filterVendorLedgerResult(result, periodFilter);
  }, [result, periodFilter]);

  const activeTabMeta = VENDOR_TABS[activeTab];
  const currentTabRows = useMemo(() => {
    if (!scopedResult) return [];
    return scopedResult[activeTabMeta.dataKey];
  }, [scopedResult, activeTabMeta]);

  const statusOptions = useMemo(() => {
    if (!scopedResult || activeTabMeta.statusCol < 0) return [];
    return [...new Set(currentTabRows.map((x) => String(x[activeTabMeta.statusCol] ?? '')))].sort();
  }, [scopedResult, currentTabRows, activeTabMeta]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return currentTabRows.filter((row) => {
      if (
        statusFilter &&
        activeTabMeta.statusCol >= 0 &&
        String(row[activeTabMeta.statusCol] ?? '') !== statusFilter
      ) {
        return false;
      }
      if (q && !row.join('|').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [currentTabRows, statusFilter, searchQuery, activeTabMeta]);

  const handleDownloadXlsx = async (mode: 'full' | 'sum' | 'exc', filename: string) => {
    if (!scopedResult) return;
    setIsExporting(true);
    try {
      const periodLabel = periodBounds.isFiltered
        ? `${periodBounds.label} (${periodBounds.rangeText})`
        : undefined;
      const buf = await buildVendorLedgerWorkbookBuffer(scopedResult, mode, periodLabel);
      const outName = periodBounds.isFiltered
        ? filename.replace(/\.xlsx$/i, `_${periodBounds.shortLabel}.xlsx`)
        : filename;
      triggerDownload(
        new Blob([buf], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
        outName
      );
    } catch (err) {
      setStatus({
        text: `Excel export failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        tone: 'bad',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadCsv = () => {
    if (!scopedResult) return;
    const csv = buildVendorTabCsv(activeTabMeta.cols, filteredRows);
    const base = activeTabMeta.label.replace(/\W+/g, '_');
    const filename = periodBounds.isFiltered
      ? `${base}_${periodBounds.shortLabel}.csv`
      : `${base}.csv`;
    triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8' }), filename);
  };

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="no-print bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-5 sm:p-6 shadow-[0_4px_0_#2F3E4E] dark:shadow-[0_4px_0_#020617] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#CEE5DC] dark:bg-emerald-950/60 border border-[#2F3E4E] dark:border-emerald-700 text-[11px] font-mono font-bold text-[#2F3E4E] dark:text-emerald-200">
              <GitCompareArrows className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{tool?.code ?? 'VC-11'} · Bidirectional Vendor Reco</span>
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white dark:bg-[#0B1120] border border-[#12805C]/35 dark:border-emerald-700/50 text-[11px] font-bold text-[#12805C] dark:text-emerald-300">
              <HardDrive className="w-3 h-3" aria-hidden="true" />
              <span>100% Browser-Local</span>
            </span>
          </div>

          <h1 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] dark:text-slate-100 tracking-tight">
            {tool?.title ?? 'BMW Vendor Ledger Reconciliation'}
          </h1>
          <p className="text-xs sm:text-sm text-[#475569] dark:text-slate-300 max-w-3xl leading-relaxed">
            BMW ledger ⇄ Tally ledgers, both directions, with opening and closing bridge and
            claim-code check. Runs fully in your browser; nothing is uploaded.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
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

      {/* Upload & Controls Card */}
      <div className="no-print bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-5 sm:p-6 shadow-[0_4px_0_#2F3E4E] dark:shadow-[0_4px_0_#020617] space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Slot 1: BMW Vendor Ledger */}
          <FileDropZone
            accept=".xlsx,.xls,.csv"
            multiple={false}
            onFiles={(fs) => addFiles(1, filesToFileList(fs))}
            className="rounded-xl border-[1.5px] border-dashed border-[#2F3E4E]/50 dark:border-slate-600 bg-[#FEF2C8]/45 dark:bg-[#0B1120]/70 p-4 space-y-2 transition-colors flex flex-col justify-between"
            activeClassName="border-[#2F3E4E] bg-[#F9C80E]/30 ring-2 ring-[#F9C80E]"
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-display font-extrabold text-[#2F3E4E] dark:text-slate-100">
                  1 · BMW vendor ledger
                </span>
                <span className="px-2 py-0.5 rounded bg-white dark:bg-[#131C2E] border border-[#2F3E4E]/30 dark:border-slate-700 font-mono text-[11px] font-bold text-[#2F3E4E] dark:text-slate-200">
                  {bmwFiles.length ? 'Ready' : 'Required'}
                </span>
              </div>
              <p className="text-[11px] text-[#475569] dark:text-slate-400">
                SAP export (.xlsx / .csv) — drop or click
              </p>
              {bmwFiles.length > 0 && (
                <div className="pt-1 space-y-0.5">
                  {bmwFiles.map((f, i) => (
                    <div key={`${f.name}-${i}`} className="text-xs font-semibold text-[#12805C] dark:text-emerald-400 break-words">
                      ✓ {f.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <input
              ref={input1Ref}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                addFiles(1, e.target.files);
                e.target.value = '';
              }}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => input1Ref.current?.click()}
              className="mt-2 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#131C2E] hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] dark:text-slate-100 dark:hover:text-[#0F172A] cursor-pointer transition w-full"
            >
              <Upload className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Select BMW Vendor Ledger</span>
            </button>
          </FileDropZone>

          {/* Slot 2: Tally Ledgers */}
          <FileDropZone
            accept=".xlsx,.xls,.csv"
            multiple
            onFiles={(fs) => addFiles(2, filesToFileList(fs))}
            className="rounded-xl border-[1.5px] border-dashed border-[#2F3E4E]/50 dark:border-slate-600 bg-[#CEE5DC]/35 dark:bg-[#0B1120]/70 p-4 space-y-2 transition-colors flex flex-col justify-between"
            activeClassName="border-[#2F3E4E] bg-[#F9C80E]/30 ring-2 ring-[#F9C80E]"
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-display font-extrabold text-[#2F3E4E] dark:text-slate-100">
                  2 · Tally ledgers
                </span>
                <span className="px-2 py-0.5 rounded bg-white dark:bg-[#131C2E] border border-[#2F3E4E]/30 dark:border-slate-700 font-mono text-[11px] font-bold text-[#2F3E4E] dark:text-slate-200">
                  {tallyFiles.length} file(s)
                </span>
              </div>
              <p className="text-[11px] text-[#475569] dark:text-slate-400">
                Any number of files or sheets — each sheet is read as one ledger
              </p>
              {tallyFiles.length > 0 && (
                <div className="pt-1 space-y-0.5 max-h-24 overflow-y-auto">
                  {tallyFiles.map((f, i) => (
                    <div key={`${f.name}-${i}`} className="text-xs font-semibold text-[#12805C] dark:text-emerald-400 break-words">
                      ✓ {f.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <input
              ref={input2Ref}
              type="file"
              accept=".xlsx,.xls,.csv"
              multiple
              onChange={(e) => {
                addFiles(2, e.target.files);
                e.target.value = '';
              }}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => input2Ref.current?.click()}
              className="mt-2 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#131C2E] hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] dark:text-slate-100 dark:hover:text-[#0F172A] cursor-pointer transition w-full"
            >
              <Upload className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Select Tally Ledger(s)</span>
            </button>
          </FileDropZone>

          {/* Slot 3: BMW Warranty Claim Details */}
          <FileDropZone
            accept=".xlsx,.xls,.csv"
            multiple
            onFiles={(fs) => addFiles(3, filesToFileList(fs))}
            className="rounded-xl border-[1.5px] border-dashed border-[#2F3E4E]/50 dark:border-slate-600 bg-white/80 dark:bg-[#0B1120]/70 p-4 space-y-2 transition-colors flex flex-col justify-between"
            activeClassName="border-[#2F3E4E] bg-[#F9C80E]/30 ring-2 ring-[#F9C80E]"
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-display font-extrabold text-[#2F3E4E] dark:text-slate-100">
                  3 · BMW warranty claim details
                </span>
                <span className="px-2 py-0.5 rounded bg-[#FEF2C8] dark:bg-slate-800 border border-[#2F3E4E]/25 dark:border-slate-700 font-mono text-[11px] font-bold text-[#475569] dark:text-slate-300">
                  {claimFiles.length ? `${claimFiles.length} file(s)` : 'Optional'}
                </span>
              </div>
              <p className="text-[11px] text-[#475569] dark:text-slate-400">
                Claim code ⇄ invoice ⇄ credit note (any sheets)
              </p>
              {claimFiles.length > 0 && (
                <div className="pt-1 space-y-0.5 max-h-24 overflow-y-auto">
                  {claimFiles.map((f, i) => (
                    <div key={`${f.name}-${i}`} className="text-xs font-semibold text-[#12805C] dark:text-emerald-400 break-words">
                      ✓ {f.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <input
              ref={input3Ref}
              type="file"
              accept=".xlsx,.xls,.csv"
              multiple
              onChange={(e) => {
                addFiles(3, e.target.files);
                e.target.value = '';
              }}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => input3Ref.current?.click()}
              className="mt-2 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#131C2E] hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] dark:text-slate-100 dark:hover:text-[#0F172A] cursor-pointer transition w-full"
            >
              <Upload className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Select Claim Details (Optional)</span>
            </button>
          </FileDropZone>
        </div>

        {/* Parameters & Action Buttons */}
        <div className="flex flex-wrap items-end gap-3 pt-1">
          <div>
            <label htmlFor="vl-tol" className="block text-[11px] font-bold text-[#475569] dark:text-slate-300 mb-1">
              Amount tolerance (₹)
            </label>
            <input
              id="vl-tol"
              type="number"
              min={0}
              step={0.5}
              value={tol}
              onChange={(e) => setTol(e.target.value)}
              className="w-28 px-2.5 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-mono font-bold text-[#2F3E4E] dark:text-slate-100"
            />
          </div>

          <div>
            <label htmlFor="vl-win" className="block text-[11px] font-bold text-[#475569] dark:text-slate-300 mb-1">
              Invoice date window (days)
            </label>
            <input
              id="vl-win"
              type="number"
              min={0}
              value={win}
              onChange={(e) => setWin(e.target.value)}
              className="w-28 px-2.5 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-mono font-bold text-[#2F3E4E] dark:text-slate-100"
            />
          </div>

          <div>
            <label htmlFor="vl-pw" className="block text-[11px] font-bold text-[#475569] dark:text-slate-300 mb-1">
              Payment date window (days)
            </label>
            <input
              id="vl-pw"
              type="number"
              min={0}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              className="w-28 px-2.5 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-mono font-bold text-[#2F3E4E] dark:text-slate-100"
            />
          </div>

          <button
            type="button"
            disabled={!bmwFiles.length || !tallyFiles.length || isRunning}
            onClick={() => void handleRun()}
            className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[38px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#F9C80E] hover:bg-[#eab308] text-xs font-display font-extrabold text-[#2F3E4E] shadow-[0_2px_0_#2F3E4E] transition cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <GitCompareArrows className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{isRunning ? 'Reconciling…' : 'Run reconciliation'}</span>
          </button>

          <button
            type="button"
            disabled={!result || isExporting}
            onClick={() => void handleDownloadXlsx('full', 'BMW_Ledger_Reconciliation_Full.xlsx')}
            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] hover:bg-[#CEE5DC]/55 dark:hover:bg-slate-800 text-xs font-bold text-[#2F3E4E] dark:text-slate-100 transition cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#12805C] dark:text-emerald-400" aria-hidden="true" />
            <span>Full Excel (all sheets)</span>
          </button>

          <button
            type="button"
            disabled={!result || isExporting}
            onClick={() => void handleDownloadXlsx('sum', 'BMW_Reconciliation_Summary.xlsx')}
            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] hover:bg-[#CEE5DC]/55 dark:hover:bg-slate-800 text-xs font-bold text-[#2F3E4E] dark:text-slate-100 transition cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Reco summary Excel</span>
          </button>

          <button
            type="button"
            disabled={!result || isExporting}
            onClick={() => void handleDownloadXlsx('exc', 'BMW_Reconciliation_Exceptions.xlsx')}
            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] hover:bg-[#CEE5DC]/55 dark:hover:bg-slate-800 text-xs font-bold text-[#2F3E4E] dark:text-slate-100 transition cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Exceptions Excel</span>
          </button>

          <button
            type="button"
            disabled={!result}
            onClick={handleDownloadCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] hover:bg-[#FEF2C8] dark:hover:bg-slate-800 text-xs font-bold text-[#2F3E4E] dark:text-slate-100 transition cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Current tab CSV</span>
          </button>

          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-xl border-[1.5px] border-[#2F3E4E]/60 dark:border-slate-600 bg-white dark:bg-[#0B1120] hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold text-[#475569] dark:text-slate-300 transition cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Clear</span>
          </button>
        </div>

        {status.text && (
          <div
            className={`rounded-xl border px-3.5 py-2.5 flex items-center gap-2 text-xs font-semibold ${
              status.tone === 'bad'
                ? 'border-rose-600/40 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200'
                : status.tone === 'ok'
                  ? 'border-[#12805C]/35 bg-[#CEE5DC]/50 dark:bg-emerald-950/40 text-[#12805C] dark:text-emerald-300'
                  : 'border-[#2F3E4E]/25 dark:border-slate-700 bg-white dark:bg-[#0B1120] text-[#2F3E4E] dark:text-slate-200'
            }`}
          >
            {status.tone === 'bad' ? (
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            )}
            <span>{status.text}</span>
          </div>
        )}
      </div>

      {/* Results Output */}
      {result && scopedResult && (
        <div className="space-y-5">
          {/* Advanced Period & Date Filter */}
          <RecoPeriodFilterBar
            value={periodFilter}
            onChange={(next) => {
              setPeriodFilter(next);
              setStatusFilter('');
            }}
            available={availablePeriods}
            matchedCount={scopedResult.rowsB.length + scopedResult.rowsT.length}
            totalCount={result.rowsB.length + result.rowsT.length}
            scopeHint="Filters BMW/Tally ledgers, payments, receipts, claims, TDS, Monthly tabs & Excel/CSV exports while keeping full ledger bridge intact"
            compact
          />

          {periodBounds.isFiltered && (
            <div className="no-print rounded-xl border-[1.5px] border-[#2F3E4E]/35 dark:border-slate-700 bg-[#FEF2C8]/55 dark:bg-amber-950/25 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-[#2F3E4E] dark:text-amber-100">
              <div className="font-semibold">
                Showing period <span className="font-extrabold">{periodBounds.label}</span>{' '}
                <span className="font-mono text-[11px] opacity-80">({periodBounds.rangeText})</span>
                {' — '}
                {scopedResult.cnt.bd} BMW docs, {scopedResult.cnt.bp} payments,{' '}
                {scopedResult.cnt.td} Tally vouchers, {scopedResult.cnt.mat} matched.
              </div>
              <span className="text-[11px] font-medium text-[#475569] dark:text-slate-300">
                Opening → Closing bridge below covers full ledger span.
              </span>
            </div>
          )}

          {/* 5 KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-xl p-3.5 shadow-[0_3px_0_#2F3E4E] dark:shadow-[0_3px_0_#020617]">
              <div className="text-[11px] font-bold text-[#64748B] dark:text-slate-400">
                BMW opening (₹ receivable)
              </div>
              <div className="font-mono font-extrabold text-lg text-[#2F3E4E] dark:text-slate-100 tabular-nums mt-0.5">
                {fmtINR(result.bOpen)}
              </div>
              <div className="text-[11px] text-[#64748B] dark:text-slate-400 font-mono tabular-nums mt-0.5">
                Tally opening: {fmtINR(result.tOpen)}
              </div>
            </div>

            <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-xl p-3.5 shadow-[0_3px_0_#2F3E4E] dark:shadow-[0_3px_0_#020617]">
              <div className="text-[11px] font-bold text-[#64748B] dark:text-slate-400">BMW closing</div>
              <div className="font-mono font-extrabold text-lg text-[#2F3E4E] dark:text-slate-100 tabular-nums mt-0.5">
                {fmtINR(result.bClose)}
              </div>
              <div className="text-[11px] text-[#64748B] dark:text-slate-400 font-mono tabular-nums mt-0.5">
                Tally closing: {fmtINR(result.tClose)}
              </div>
            </div>

            <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-xl p-3.5 shadow-[0_3px_0_#2F3E4E] dark:shadow-[0_3px_0_#020617]">
              <div className="text-[11px] font-bold text-[#64748B] dark:text-slate-400">
                Closing difference
              </div>
              <div className="font-mono font-extrabold text-lg text-[#2F3E4E] dark:text-slate-100 tabular-nums mt-0.5">
                {fmtINR(result.tgt)}
              </div>
              <div
                className={`text-[11px] font-mono font-bold tabular-nums mt-0.5 ${
                  Math.abs(result.unexp) < 0.01
                    ? 'text-[#12805C] dark:text-emerald-400'
                    : 'text-rose-700 dark:text-rose-400'
                }`}
              >
                Unexplained after bridge: {fmtINR(result.unexp)}
              </div>
            </div>

            <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-xl p-3.5 shadow-[0_3px_0_#2F3E4E] dark:shadow-[0_3px_0_#020617]">
              <div className="text-[11px] font-bold text-[#64748B] dark:text-slate-400">
                {periodBounds.isFiltered ? 'Period docs matched' : 'Documents matched'}
              </div>
              <div className="font-mono font-extrabold text-lg text-[#2F3E4E] dark:text-slate-100 tabular-nums mt-0.5">
                {scopedResult.cnt.mat} / {scopedResult.cnt.bd + scopedResult.cnt.bp}
              </div>
              <div className="text-[11px] text-[#64748B] dark:text-slate-400 mt-0.5">
                {scopedResult.meta.TL} Tally ledger(s) · {scopedResult.cnt.td} Tally vouchers
              </div>
            </div>

            <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-xl p-3.5 shadow-[0_3px_0_#2F3E4E] dark:shadow-[0_3px_0_#020617]">
              <div className="text-[11px] font-bold text-[#64748B] dark:text-slate-400">
                {periodBounds.isFiltered ? 'Period claim codes OK' : 'Claim codes OK'}
              </div>
              <div className="font-mono font-extrabold text-lg text-[#2F3E4E] dark:text-slate-100 tabular-nums mt-0.5">
                {scopedResult.cnt.claimOk} / {scopedResult.cnt.claimOk + scopedResult.cnt.claimBad}
              </div>
              <div className="text-[11px] text-[#64748B] dark:text-slate-400 mt-0.5">
                {scopedResult.meta.CL
                  ? `${scopedResult.meta.CL} claim rows read`
                  : 'No claims file loaded'}
              </div>
            </div>
          </div>

          {/* Consolidated Reconciliation */}
          <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-4 sm:p-5 shadow-[0_3px_0_#2F3E4E] dark:shadow-[0_3px_0_#020617] space-y-2.5">
            <h2 className="font-display font-extrabold text-sm sm:text-base text-[#2F3E4E] dark:text-slate-100">
              Consolidated reconciliation — all Tally ledgers combined vs BMW ledger
            </h2>
            <div className="overflow-x-auto rounded-xl border border-[#2F3E4E]/20 dark:border-slate-700 bg-white dark:bg-[#0B1120]">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-[#2F3E4E] dark:bg-slate-800 text-white">
                    <th className="text-left px-3 py-2 font-bold">Particulars</th>
                    <th className="text-right px-3 py-2 font-bold">BMW ledger</th>
                    <th className="text-right px-3 py-2 font-bold">Tally (all ledgers)</th>
                    <th className="text-right px-3 py-2 font-bold">Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {result.cons.map((row, idx) => (
                    <tr
                      key={idx}
                      className={`border-t border-[#2F3E4E]/15 dark:border-slate-800 ${
                        idx % 3 === 0 ? 'font-bold bg-[#FEF2C8]/35 dark:bg-slate-900/60' : ''
                      }`}
                    >
                      <td className="px-3 py-2 text-[#2F3E4E] dark:text-slate-200">{row[0]}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-[#2F3E4E] dark:text-slate-200">
                        {fmtINR(row[1])}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-[#2F3E4E] dark:text-slate-200">
                        {fmtINR(row[2])}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-[#2F3E4E] dark:text-slate-200">
                        {fmtINR(row[3])}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-[#2F3E4E]/20 dark:border-slate-800 bg-white/80 dark:bg-[#0B1120] text-[11px] text-[#64748B] dark:text-slate-400">
                    <td colSpan={4} className="px-3 py-2 font-mono">
                      Opening diff + increases diff + decreases diff = closing diff:{' '}
                      {Math.abs(result.tie) < 0.01 ? '✓ ties' : `✗ off by ${fmtINR(result.tie)}`}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Opening -> Closing Bridge */}
          <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-4 sm:p-5 shadow-[0_3px_0_#2F3E4E] dark:shadow-[0_3px_0_#020617] space-y-2.5">
            <h2 className="font-display font-extrabold text-sm sm:text-base text-[#2F3E4E] dark:text-slate-100">
              Opening → closing bridge (BMW − Tally, receivable view)
            </h2>
            <div className="overflow-x-auto rounded-xl border border-[#2F3E4E]/20 dark:border-slate-700 bg-white dark:bg-[#0B1120]">
              <table className="w-full border-collapse text-xs">
                <tbody>
                  {result.br.map(([label, val], idx) => (
                    <tr
                      key={idx}
                      className="border-b border-[#2F3E4E]/15 dark:border-slate-800 hover:bg-[#FEF2C8]/30 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-3 py-2 text-[#2F3E4E] dark:text-slate-200">{label}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-[#2F3E4E] dark:text-slate-200">
                        {fmtINR(val)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-b border-[#2F3E4E]/20 dark:border-slate-700 bg-[#FEF2C8]/45 dark:bg-slate-900 font-bold">
                    <td className="px-3 py-2 text-[#2F3E4E] dark:text-slate-100">Total explained</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-[#2F3E4E] dark:text-slate-100">
                      {fmtINR(result.expl)}
                    </td>
                  </tr>
                  <tr className="border-b border-[#2F3E4E]/20 dark:border-slate-700 bg-[#FEF2C8]/45 dark:bg-slate-900 font-bold">
                    <td className="px-3 py-2 text-[#2F3E4E] dark:text-slate-100">
                      BMW closing − Tally closing
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-[#2F3E4E] dark:text-slate-100">
                      {fmtINR(result.tgt)}
                    </td>
                  </tr>
                  <tr className="border-b border-[#2F3E4E]/20 dark:border-slate-700 bg-[#CEE5DC]/45 dark:bg-emerald-950/35 font-bold">
                    <td className="px-3 py-2 text-[#2F3E4E] dark:text-slate-100">
                      Unexplained (should be 0.00)
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-[#2F3E4E] dark:text-slate-100">
                      {fmtINR(result.unexp)}
                    </td>
                  </tr>
                  <tr className="text-[11px] text-[#64748B] dark:text-slate-400">
                    <td className="px-3 py-2">
                      BMW file check: opening + movement − stated closing
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {fmtINR(R2(result.bint))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Tally Ledger-wise */}
          <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-4 sm:p-5 shadow-[0_3px_0_#2F3E4E] dark:shadow-[0_3px_0_#020617] space-y-2.5">
            <h2 className="font-display font-extrabold text-sm sm:text-base text-[#2F3E4E] dark:text-slate-100">
              Tally ledger-wise
            </h2>
            <div className="overflow-x-auto rounded-xl border border-[#2F3E4E]/20 dark:border-slate-700 bg-white dark:bg-[#0B1120]">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-[#2F3E4E] dark:bg-slate-800 text-white">
                    {LC_COLS.map((h, i) => (
                      <th key={h} className={`px-3 py-2 font-bold whitespace-nowrap ${i > 0 ? 'text-right' : 'text-left'}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.ledg.map((row, idx) => {
                    const isTotal = idx === result.ledg.length - 1;
                    return (
                      <tr
                        key={idx}
                        className={`border-t border-[#2F3E4E]/15 dark:border-slate-800 ${
                          isTotal ? 'bg-[#FEF2C8]/50 dark:bg-slate-900 font-bold' : ''
                        }`}
                      >
                        {row.map((val, cIdx) => (
                          <td
                            key={cIdx}
                            className={`px-3 py-2 whitespace-nowrap ${
                              cIdx > 0
                                ? 'text-right font-mono tabular-nums text-[#2F3E4E] dark:text-slate-200'
                                : 'text-[#2F3E4E] dark:text-slate-100'
                            }`}
                          >
                            {typeof val === 'number' && cIdx !== 7 && cIdx !== 8 ? fmtINR(val) : val}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Interactive 10-Tab Data Explorer */}
          <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-4 sm:p-5 shadow-[0_4px_0_#2F3E4E] dark:shadow-[0_4px_0_#020617] space-y-4">
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(VENDOR_TABS) as VendorTabKey[]).map((key) => {
                const isActive = key === activeTab;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setActiveTab(key);
                      setStatusFilter('');
                      setSearchQuery('');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                      isActive
                        ? 'bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#FFFDF5] dark:text-[#0F172A] border-[#2F3E4E] dark:border-[#F9C80E]'
                        : 'bg-white dark:bg-[#0B1120] text-[#2F3E4E] dark:text-slate-300 border-[#2F3E4E]/25 dark:border-slate-700 hover:bg-[#FEF2C8] dark:hover:bg-slate-800'
                    }`}
                  >
                    {VENDOR_TABS[key].label}
                  </button>
                );
              })}
            </div>

            {/* Filter & Search Row */}
            <div className="flex flex-wrap items-end gap-3">
              {activeTabMeta.statusCol >= 0 && (
                <div>
                  <label htmlFor="vl-sf" className="block text-[11px] font-bold text-[#64748B] dark:text-slate-400 mb-1">
                    Status
                  </label>
                  <select
                    id="vl-sf"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-2.5 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-semibold text-[#2F3E4E] dark:text-slate-100"
                  >
                    <option value="">All ({currentTabRows.length})</option>
                    {statusOptions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex-1 min-w-[220px] max-w-sm">
                <label htmlFor="vl-q" className="block text-[11px] font-bold text-[#64748B] dark:text-slate-400 mb-1">
                  Search
                </label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                  <input
                    id="vl-q"
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="voucher, claim code, VIN…"
                    className="w-full pl-8 pr-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs text-[#2F3E4E] dark:text-slate-100"
                  />
                </div>
              </div>

              <span className="text-xs font-mono text-[#64748B] dark:text-slate-400 pb-1.5">
                {filteredRows.length} rows
                {filteredRows.length > 400 ? ' (first 400 shown — Excel has all)' : ''}
              </span>
            </div>

            {/* Table Container */}
            <div className="overflow-auto max-h-[560px] rounded-xl border border-[#2F3E4E]/25 dark:border-slate-700 bg-white dark:bg-[#0B1120]">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="sticky top-0 z-10 bg-[#2F3E4E] dark:bg-slate-800 text-white">
                    {activeTabMeta.cols.map((h) => (
                      <th key={h} className="text-left px-3 py-2 font-bold whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.slice(0, 400).map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className="border-t border-[#2F3E4E]/15 dark:border-slate-800 hover:bg-[#FEF2C8]/30 dark:hover:bg-slate-800/50"
                    >
                      {row.map((val, cIdx) => {
                        if (cIdx === activeTabMeta.statusCol) {
                          const sVal = String(val ?? '');
                          return (
                            <td key={cIdx} className="px-3 py-2 whitespace-nowrap">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold border ${statusPillClasses(sVal)}`}
                              >
                                {sVal}
                              </span>
                            </td>
                          );
                        }
                        return (
                          <td
                            key={cIdx}
                            className={`px-3 py-2 whitespace-nowrap text-[#2F3E4E] dark:text-slate-200 ${
                              typeof val === 'number' ? 'text-right font-mono tabular-nums' : ''
                            }`}
                          >
                            {typeof val === 'number' ? fmtINR(val) : String(val ?? '')}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {filteredRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={activeTabMeta.cols.length}
                        className="px-4 py-8 text-center text-xs text-[#64748B] dark:text-slate-400"
                      >
                        No matching rows for current filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
