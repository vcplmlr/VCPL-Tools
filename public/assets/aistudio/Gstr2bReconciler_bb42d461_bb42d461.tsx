import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  ArrowLeft,
  FileCheck2,
  Download,
  RotateCcw,
  Search,
  Eye,
  FileSpreadsheet,
  SlidersHorizontal,
  ShieldAlert,
  Scale,
  Ban,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Clock,
  ArrowUpDown,
  Info,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { formatINR, formatINRPlain } from '../../utils/numberToWords';
import {
  CtlControlRow,
  DEFAULT_RECON_OPTIONS,
  INDIAN_STATE_CODES,
  ParsedRow,
  RcmHandlingMode,
  ReconOptions,
  ReconRow,
  Restricted2bMode,
  ST,
  ST_COLORS,
  buildWorkbookAndDownload,
  computeDashboardStats,
  computeSupplierStats,
  parseBook,
  reconcileBooks,
} from '../../utils/gstr2bEngine';
import {
  AdRectanglePair,
  ResponsiveAdBanner,
  SmartlinkBanner,
} from '../ads/AdSlot';
import { ContextualAdWidget } from '../ads/ContextualAdWidget';
import { Gstr2bReconArticle } from '../articles/Gstr2bReconArticle';

interface Gstr2bReconcilerProps {
  onBack: () => void;
}

type AttributeFilter =
  | 'all'
  | 'eligible'
  | 'rcm'
  | 'rcm_mismatch'
  | 'restricted'
  | 'booked_restricted'
  | 'late'
  | 'pos';

const R_FMT = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

export const Gstr2bReconciler: React.FC<Gstr2bReconcilerProps> = ({ onBack }) => {
  const [file1Name, setFile1Name] = useState<string>('');
  const [file2Name, setFile2Name] = useState<string>('');
  const [options, setOptions] = useState<ReconOptions>(DEFAULT_RECON_OPTIONS);
  const [showOptions, setShowOptions] = useState<boolean>(true);
  const [show3bControl, setShow3bControl] = useState<boolean>(true);

  const [logs, setLogs] = useState<string[]>([]);
  const [detectedStateHint, setDetectedStateHint] = useState<string>('');
  const [parsedBooks, setParsedBooks] = useState<{
    P: ParsedRow[];
    Tl: ParsedRow[];
    psum?: Record<string, number[] | null>;
  } | null>(null);
  const [reconData, setReconData] = useState<{
    res: ReconRow[];
    curPeriod: string;
    ctlData: CtlControlRow[];
  } | null>(null);

  const [uiView, setUiView] = useState<'docs' | 'sup' | 'rep'>('docs');
  const [uiSt, setUiSt] = useState<string>('All');
  const [uiAttr, setUiAttr] = useState<AttributeFilter>('all');
  const [uiReasonFilter, setUiReasonFilter] = useState<string>('');
  const [uiRp, setUiRp] = useState<string>('summary');
  const [uiQ, setUiQ] = useState<string>('');
  const [uiK, setUiK] = useState<string>('diff');
  const [uiD, setUiD] = useState<number>(-1);
  const [uiPg, setUiPg] = useState<number>(0);

  const [selectedDrawerRow, setSelectedDrawerRow] = useState<ReconRow | null>(null);

  const f1Ref = useRef<HTMLInputElement>(null);
  const f2Ref = useRef<HTMLInputElement>(null);
  const resultsAnchorRef = useRef<HTMLDivElement>(null);

  // Instant re-reconciliation when options change after workbooks are loaded
  useEffect(() => {
    if (!parsedBooks) return;
    const next = reconcileBooks(parsedBooks.P, parsedBooks.Tl, options, parsedBooks.psum);
    setReconData(next);
  }, [parsedBooks, options]);

  const handleRunReconFiles = async (f1: File, f2: File) => {
    const logArr: string[] = [];
    setLogs(['Reading uploaded Excel workbooks cleanly in browser RAM...']);
    try {
      const pResult = parseBook(await f1.arrayBuffer(), 'GST portal', true, logArr);
      const tlResult = parseBook(await f2.arrayBuffer(), 'Tally', false, logArr);

      if (!pResult.rows.length || !tlResult.rows.length) {
        throw new Error(
          'No valid invoice rows found in one of the workbooks. Ensure both files contain GSTIN and document/taxable columns.'
        );
      }

      const detectedCode = pResult.detectedStateCode || tlResult.detectedStateCode || '';
      if (detectedCode) {
        setDetectedStateHint(detectedCode);
      }

      const effectiveOpts: ReconOptions =
        detectedCode && !options.recipientStateCode
          ? { ...options, recipientStateCode: detectedCode }
          : options;

      if (effectiveOpts !== options) {
        setOptions(effectiveOpts);
      }

      setParsedBooks({ P: pResult.rows, Tl: tlResult.rows, psum: pResult.psumData });
      const result = reconcileBooks(pResult.rows, tlResult.rows, effectiveOpts, pResult.psumData);
      setReconData(result);
      logArr.push(
        `Reconciled ${pResult.rows.length} GSTR-2B rows with ${tlResult.rows.length} Tally vouchers${
          detectedCode ? ` · Recipient state detected: ${detectedCode}` : ''
        }.`
      );
      setLogs(logArr);
      setUiPg(0);
      confetti({ particleCount: 40, spread: 60 });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unable to parse workbook.';
      setLogs((prev) => [...prev, `Error: ${msg}`]);
    }
  };

  const handleGo = () => {
    const f1 = f1Ref.current?.files?.[0];
    const f2 = f2Ref.current?.files?.[0];
    if (f1 && f2) {
      handleRunReconFiles(f1, f2);
    } else if (parsedBooks) {
      const result = reconcileBooks(parsedBooks.P, parsedBooks.Tl, options, parsedBooks.psum);
      setReconData(result);
      setUiPg(0);
      setLogs((prev) => [
        ...prev.slice(-6),
        `Re-applied options (Tax tol ₹${options.tolTax}, Taxable tol ₹${options.tolTaxable}, RCM=${options.rcmMode}, Restricted=${options.restricted2bMode}).`,
      ]);
    } else {
      setLogs([
        'Upload both GST Portal GSTR-2B (.xlsx) and Tally Prime Purchase Register (.xlsx) files above to begin reconciliation.',
      ]);
    }
  };

  const S = useMemo(() => {
    if (!reconData) return null;
    return computeDashboardStats(reconData.res, options);
  }, [reconData, options]);

  const supplierList = useMemo(() => {
    if (!reconData) return [];
    return computeSupplierStats(reconData.res).sort((x, y) => Math.abs(y.a - y.b) - Math.abs(x.a - x.b));
  }, [reconData]);

  const handleClear = () => {
    setReconData(null);
    setParsedBooks(null);
    setFile1Name('');
    setFile2Name('');
    setDetectedStateHint('');
    setUiSt('All');
    setUiAttr('all');
    setUiReasonFilter('');
    setUiQ('');
    setLogs([]);
    if (f1Ref.current) f1Ref.current.value = '';
    if (f2Ref.current) f2Ref.current.value = '';
  };

  const handleAcceptMatch = (rowIdx: number) => {
    if (!reconData) return;
    const updated = [...reconData.res];
    const r = updated[rowIdx];
    if (r) {
      updated[rowIdx] = {
        ...r,
        status: 'Matched',
        remark: r.remark + ' · manually accepted as match',
      };
      setReconData({ ...reconData, res: updated });
      setSelectedDrawerRow(null);
      confetti({ particleCount: 25, spread: 40 });
    }
  };

  const jumpToDocsFilter = (opts: {
    status?: string;
    attr?: AttributeFilter;
    reason?: string;
    query?: string;
  }) => {
    setUiView('docs');
    setUiSt(opts.status ?? 'All');
    setUiAttr(opts.attr ?? 'all');
    setUiReasonFilter(opts.reason ?? '');
    if (opts.query !== undefined) setUiQ(opts.query);
    setUiPg(0);
    resultsAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const displayedDocRows = useMemo(() => {
    if (!reconData) return [];
    const q = uiQ.toLowerCase().trim();
    const rows = reconData.res.filter((r) => {
      if (uiSt !== 'All' && r.status !== uiSt) return false;
      if (uiAttr === 'eligible' && !/^a_(reg|cn)$/.test(r.bk)) return false;
      if (uiAttr === 'rcm' && !r.rcm) return false;
      if (
        uiAttr === 'rcm_mismatch' &&
        r.rcmStatus !== '2B RCM · Regular in Tally' &&
        r.rcmStatus !== 'Tally RCM · Regular in 2B' &&
        r.rcmStatus !== 'Tally RCM Only'
      ) {
        return false;
      }
      if (uiAttr === 'restricted' && !r.restricted2b) return false;
      if (uiAttr === 'booked_restricted' && !r.bookedDespiteRestricted) return false;
      if (uiAttr === 'late' && !r.late) return false;
      if (uiAttr === 'pos' && r.restrictedSource !== 'POS' && !/pos|place of supply/i.test(r.reason)) return false;
      if (uiReasonFilter && r.restrictedCategory !== uiReasonFilter) return false;
      if (
        q &&
        !(
          r.name +
          ' ' +
          r.gstin +
          ' ' +
          r.doc2b +
          ' ' +
          r.docT +
          ' ' +
          r.remark +
          ' ' +
          r.reason +
          ' ' +
          r.restrictedCategory +
          ' ' +
          r.vt
        )
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }
      return true;
    });

    const keyFns: Record<string, (r: ReconRow) => number | string> = {
      status: (r) => ST.indexOf(r.status),
      name: (r) => r.name,
      doc2b: (r) => r.doc2b || r.docT,
      tx2: (r) => r.tx2 || r.txT,
      tax2: (r) => r.tax2,
      taxT: (r) => r.taxT,
      diff: (r) => Math.abs(r.diff),
    };
    const f = keyFns[uiK] || keyFns.diff;
    rows.sort((x, y) => {
      const fx = f(x);
      const fy = f(y);
      return (fx > fy ? 1 : fx < fy ? -1 : 0) * uiD;
    });
    return rows;
  }, [reconData, uiSt, uiAttr, uiReasonFilter, uiQ, uiK, uiD]);

  const pageSize = 100;
  const totalPages = Math.max(1, Math.ceil(displayedDocRows.length / pageSize));
  const safePg = Math.min(uiPg, totalPages - 1);

  const getRepRows = (k: string) => {
    if (!reconData) return [];
    const res = reconData.res;
    if (k === 'rcm') return res.filter((r) => r.rcm);
    if (k === 'rcm_mismatch')
      return res.filter(
        (r) => r.rcmStatus === '2B RCM · Regular in Tally' || r.rcmStatus === 'Tally RCM · Regular in 2B'
      );
    if (k === 'na') return res.filter((r) => r.restricted2b);
    if (k === 'booked_na') return res.filter((r) => r.bookedDespiteRestricted);
    if (k === 'late') return res.filter((r) => r.late);
    if (k === 'limit')
      return res.filter((r) => r.tl != null && r.tl <= 180).sort((a, b) => (a.tl || 0) - (b.tl || 0));
    if (k === 'notes') return res.filter((r) => r.type === 'Credit/Debit note');
    if (k === 'follow') return res.filter((r) => r.status === 'Only in Tally');
    if (k === 'exc') return res.filter((r) => Boolean(r.flags));
    return [];
  };

  const REPS_LIST: Array<[string, string]> = [
    ['summary', 'Overview & 3B Bridge'],
    ['rcm', 'RCM Supplies'],
    ['rcm_mismatch', 'RCM Classification Mismatch'],
    ['na', 'Input Restricted in 2B'],
    ['booked_na', 'Booked Despite Restriction'],
    ['late', 'Late Reported'],
    ['limit', 'Sec 16(4) Time-Limit'],
    ['follow', 'Supplier Follow-up'],
    ['notes', 'Credit/Debit Notes'],
    ['exc', 'All Exceptions'],
  ];

  const handleExport = () => {
    if (!reconData) return;
    buildWorkbookAndDownload(reconData.res, reconData.ctlData, options);
    confetti({ particleCount: 50, spread: 70, origin: { y: 0.8 } });
  };

  const toggleSort = (colKey: string) => {
    if (uiK === colKey) {
      setUiD((d) => -d);
    } else {
      setUiK(colKey);
      setUiD(-1);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to All Tools
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold border border-emerald-200/70">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                  GSTR-2B vs Tally Reconciliation Studio
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                  BETA · v1.0.0
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Invoice matching · RCM (3.1(d)/4(A)(3)) · Input Restricted in 2B (4(D)(2)) · Sec 16(4) &amp; POS checks · 100% client-side.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          {reconData && (
            <button
              type="button"
              onClick={handleClear}
              className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
              title="Clear all reconciliation data"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Clear Data
            </button>
          )}
          <button
            type="button"
            onClick={handleExport}
            disabled={!reconData}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Download Excel Report
          </button>
        </div>
      </div>

      {/* Beta Advisory & Tax Compliance Notice */}
      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-start sm:items-center gap-2">
          <Info className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5 sm:mt-0" />
          <span>
            <strong>BETA v1.0.0 Guidance:</strong> All matching runs 100% locally in your browser RAM. Reconciled ITC results are analytical guidance. Cross-check RCM liabilities (Table 3.1(d)) and Section 16(4) annual time-limits before filing monthly GSTR-3B.
          </span>
        </div>
        <span className="text-[11px] font-semibold text-emerald-800 whitespace-nowrap shrink-0">
          Zero Server Upload
        </span>
      </div>

      {/* Upload Workbooks Strip */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-6">
        <label
          className={`md:col-span-5 p-4 rounded-xl border-2 border-dashed cursor-pointer transition-all flex flex-col justify-between ${
            file1Name ? 'border-emerald-500 bg-emerald-50/20' : 'border-slate-300 hover:border-emerald-500 bg-white'
          }`}
        >
          <input
            type="file"
            ref={f1Ref}
            accept=".xlsx,.xls"
            onChange={(e) => {
              if (e.target.files?.[0]) setFile1Name(e.target.files[0].name);
            }}
            className="hidden"
          />
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                1
              </span>
              <span className="text-xs font-bold text-slate-900">GST Portal GSTR-2B Workbook</span>
            </div>
            {detectedStateHint && (
              <span className="text-[11px] font-mono text-emerald-700 font-semibold">
                State {detectedStateHint}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-2 truncate">
            {file1Name || 'Drop official GSTR-2B .xlsx here (B2B, B2BA, CDNR, ISD, IMPG, Summary)'}
          </p>
        </label>

        <label
          className={`md:col-span-5 p-4 rounded-xl border-2 border-dashed cursor-pointer transition-all flex flex-col justify-between ${
            file2Name ? 'border-emerald-500 bg-emerald-50/20' : 'border-slate-300 hover:border-emerald-500 bg-white'
          }`}
        >
          <input
            type="file"
            ref={f2Ref}
            accept=".xlsx,.xls"
            onChange={(e) => {
              if (e.target.files?.[0]) setFile2Name(e.target.files[0].name);
            }}
            className="hidden"
          />
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
              2
            </span>
            <span className="text-xs font-bold text-slate-900">Tally Prime Purchase Register</span>
          </div>
          <p className="text-xs text-slate-500 mt-2 truncate">
            {file2Name || 'Drop Tally exported Purchase / Voucher Register .xlsx here'}
          </p>
        </label>

        <div className="md:col-span-2 flex flex-col justify-between gap-2">
          <button
            type="button"
            onClick={handleGo}
            className="flex-1 px-4 py-3 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
          >
            {parsedBooks ? 'Re-Run Match →' : 'Reconcile →'}
          </button>
          <button
            type="button"
            onClick={() => setShowOptions((v) => !v)}
            className="px-3 py-2 text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
            {showOptions ? 'Hide Options' : 'Recon Options'}
            {showOptions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Comprehensive Reconciliation & Compliance Options Panel */}
      {showOptions && (
        <div className="mt-4 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Reconciliation, RCM &amp; Input Restricted (2B) Options
              </h2>
              {parsedBooks && (
                <span className="text-[11px] text-emerald-700 font-medium">
                  · Changes apply live to loaded data
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setOptions(DEFAULT_RECON_OPTIONS)}
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-900 underline-offset-2 hover:underline"
            >
              Reset defaults
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
            {/* Group 1: Matching & Tolerance */}
            <div className="space-y-3 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                1. Matching &amp; Tolerance
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <label className="block">
                  <span className="text-[11px] font-medium text-slate-600 block mb-1">Tax Tolerance (₹)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={options.tolTax}
                    onChange={(e) => setOptions((o) => ({ ...o, tolTax: Math.max(0, Number(e.target.value)) }))}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-mono font-semibold"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-medium text-slate-600 block mb-1">Taxable Tolerance (₹)</span>
                  <input
                    type="number"
                    min="0"
                    value={options.tolTaxable}
                    onChange={(e) => setOptions((o) => ({ ...o, tolTaxable: Math.max(0, Number(e.target.value)) }))}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-mono font-semibold"
                  />
                </label>
              </div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.normalizeDocNo}
                  onChange={(e) => setOptions((o) => ({ ...o, normalizeDocNo: e.target.checked }))}
                  className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-[11px] text-slate-700 leading-snug">
                  <strong>Normalize invoice numbers</strong> (ignore leading zeroes &amp; slashes/hyphens)
                </span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.ignoreDateMismatch}
                  onChange={(e) => setOptions((o) => ({ ...o, ignoreDateMismatch: e.target.checked }))}
                  className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-[11px] text-slate-700 leading-snug">
                  <strong>Ignore date differences</strong> (match cleanly even when Tally voucher date differs)
                </span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.includeImpgIsd}
                  onChange={(e) => setOptions((o) => ({ ...o, includeImpgIsd: e.target.checked }))}
                  className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-[11px] text-slate-700 leading-snug">
                  <strong>Include ISD &amp; Import (IMPG) sheets</strong> if present in 2B
                </span>
              </label>
            </div>

            {/* Group 2: RCM Options */}
            <div className="space-y-3 bg-amber-50/40 p-3.5 rounded-xl border border-amber-200/70">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-900">
                <Scale className="w-3.5 h-3.5 text-amber-700" />
                2. Reverse Charge (RCM) Options
              </div>
              <label className="block">
                <span className="text-[11px] font-medium text-slate-700 block mb-1">RCM Handling Mode</span>
                <select
                  value={options.rcmMode}
                  onChange={(e) => setOptions((o) => ({ ...o, rcmMode: e.target.value as RcmHandlingMode }))}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-medium text-slate-800"
                >
                  <option value="segregate">Segregate 3.1(d) &amp; 4(A)(3) + Flag Tally Regular</option>
                  <option value="exclude_from_regular">Exclude RCM from Regular Purchase Gap</option>
                  <option value="match_with_tally_rcm">Strict Match: Flag 2B vs Tally RCM Mismatches</option>
                </select>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.detectTallyRcmByVch}
                  onChange={(e) => setOptions((o) => ({ ...o, detectTallyRcmByVch: e.target.checked }))}
                  className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-[11px] text-slate-700 leading-snug">
                  <strong>Detect Tally RCM via Voucher / Ledger</strong>
                </span>
              </label>
              {options.detectTallyRcmByVch && (
                <label className="block">
                  <span className="text-[10px] font-medium text-slate-500 block mb-0.5">
                    Tally RCM Keywords (comma-separated)
                  </span>
                  <input
                    type="text"
                    value={options.tallyRcmKeywords}
                    onChange={(e) => setOptions((o) => ({ ...o, tallyRcmKeywords: e.target.value }))}
                    placeholder="rcm,reverse charge,9(3)"
                    className="w-full px-2.5 py-1 text-[11px] bg-white border border-slate-300 rounded-lg font-mono text-slate-800"
                  />
                </label>
              )}
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.autoClaimRcmItcIn3B}
                  onChange={(e) => setOptions((o) => ({ ...o, autoClaimRcmItcIn3B: e.target.checked }))}
                  className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-[11px] text-slate-700 leading-snug">
                  <strong>Include RCM 4(A)(3) ITC</strong> in Net 3B ITC dashboard total
                </span>
              </label>
            </div>

            {/* Group 3: Input Restricted in 2B Options */}
            <div className="space-y-3 bg-rose-50/40 p-3.5 rounded-xl border border-rose-200/70">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-rose-900">
                <Ban className="w-3.5 h-3.5 text-rose-700" />
                3. Input Restricted in GSTR-2B
              </div>
              <label className="block">
                <span className="text-[11px] font-medium text-slate-700 block mb-1">
                  Restricted ITC Treatment (4(D)(2))
                </span>
                <select
                  value={options.restricted2bMode}
                  onChange={(e) =>
                    setOptions((o) => ({ ...o, restricted2bMode: e.target.value as Restricted2bMode }))
                  }
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-medium text-slate-800"
                >
                  <option value="exclude_and_flag">Exclude from Eligible ITC &amp; Flag Reversal Risk</option>
                  <option value="treat_booked_as_mismatch">Mark Booked Restricted Rows as Mismatch</option>
                  <option value="flag_only">Flag &amp; Track Only (Keep Gross Match)</option>
                </select>
              </label>

              <div className="space-y-1.5">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.enforcePosCheck}
                    onChange={(e) => setOptions((o) => ({ ...o, enforcePosCheck: e.target.checked }))}
                    className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-[11px] text-slate-700 leading-snug">
                    <strong>POS State Check</strong> (restrict 2B rows where POS ≠ Recipient State)
                  </span>
                </label>
                {options.enforcePosCheck && (
                  <select
                    value={options.recipientStateCode}
                    onChange={(e) => setOptions((o) => ({ ...o, recipientStateCode: e.target.value }))}
                    className="w-full px-2 py-1 text-[11px] bg-white border border-slate-300 rounded-lg text-slate-800"
                  >
                    <option value="">Select Recipient State Code...</option>
                    {INDIAN_STATE_CODES.map((st) => (
                      <option key={st.code} value={st.code}>
                        {st.code} — {st.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.enforceSec16_4}
                    onChange={(e) => setOptions((o) => ({ ...o, enforceSec16_4: e.target.checked }))}
                    className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-[11px] text-slate-700 leading-snug">
                    <strong>Sec 16(4) Cutoff</strong> (restrict invoices past 30-Nov deadline)
                  </span>
                </label>
                {options.enforceSec16_4 && (
                  <input
                    type="date"
                    value={options.sec16_4ReferenceDate}
                    onChange={(e) => setOptions((o) => ({ ...o, sec16_4ReferenceDate: e.target.value }))}
                    className="w-full px-2 py-1 text-[11px] bg-white border border-slate-300 rounded-lg font-mono text-slate-800"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Parsing Logs */}
      {logs.length > 0 && (
        <div className="mt-3 text-[11px] text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200 font-mono space-y-0.5">
          {logs.map((log, i) => (
            <div key={i}>{log}</div>
          ))}
        </div>
      )}

      {/* Workspace Top Leaderboard (728x90 Desktop / 468x60 Tablet / 320x50 Mobile) */}
      <ResponsiveAdBanner
        desktopSlot="tool_top_leaderboard"
        tabletSlot="tablet_tool_top_468"
        mobileSlot="mobile_tool_top_320"
        className="mt-6"
      />

      {/* DASHBOARD & RECONCILIATION RESULTS */}
      {S && reconData && (
        <>
          {/* Row 1: Financial ITC Position KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-6">
            <button
              type="button"
              onClick={() => jumpToDocsFilter({ status: 'All', attr: 'eligible' })}
              className="text-left bg-white hover:border-emerald-300 transition-colors p-4 rounded-xl border border-slate-200 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500 uppercase font-bold tracking-wider">
                  Net Claimable 3B ITC
                </span>
                <span className="text-[10px] font-mono text-emerald-700 font-semibold">
                  {options.autoClaimRcmItcIn3B ? '4(A)(5) + 4(A)(3)' : '4(A)(5)'}
                </span>
              </div>
              <strong className="text-2xl font-extrabold text-slate-900 block mt-1 tabular-nums">
                {R_FMT(S.net3bItc)}
              </strong>
              <span className="text-[11px] text-slate-500 block mt-1 tabular-nums">
                Regular {R_FMT(S.e2)} ({S.e2Count} docs)
                {options.autoClaimRcmItcIn3B ? ` · RCM ${R_FMT(S.rcmStats.itc4A3.total)}` : ''}
              </span>
            </button>

            <button
              type="button"
              onClick={() => jumpToDocsFilter({ status: 'All', attr: 'all' })}
              className="text-left bg-white hover:border-slate-300 transition-colors p-4 rounded-xl border border-slate-200 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500 uppercase font-bold tracking-wider">
                  Total Tax in Tally Books
                </span>
                <span className="text-[10px] font-mono text-slate-500">
                  2B Gross {R_FMT(S.t2)}
                </span>
              </div>
              <strong className="text-2xl font-extrabold text-slate-900 block mt-1 tabular-nums">
                {R_FMT(S.tT)}
              </strong>
              <span className="text-[11px] text-slate-500 block mt-1 tabular-nums">
                Eligible 2B vs Tally Diff: {R_FMT(S.e2 - S.tT)}
              </span>
            </button>

            <button
              type="button"
              onClick={() => jumpToDocsFilter({ status: 'Only in 2B', attr: 'eligible' })}
              className="text-left bg-blue-50/30 hover:border-blue-400 transition-colors p-4 rounded-xl border border-blue-200 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-blue-900 uppercase font-bold tracking-wider">
                  Eligible ITC to Claim
                </span>
                <span className="text-[10px] font-mono text-blue-700 font-semibold">Only in 2B</span>
              </div>
              <strong className="text-2xl font-extrabold text-blue-700 block mt-1 tabular-nums">
                {R_FMT(S.claim)}
              </strong>
              <span className="text-[11px] text-blue-700 block mt-1 tabular-nums">
                {S.claimCount} eligible docs missing in Tally
              </span>
            </button>

            <button
              type="button"
              onClick={() => jumpToDocsFilter({ status: 'Only in Tally', attr: 'all' })}
              className="text-left bg-rose-50/30 hover:border-rose-400 transition-colors p-4 rounded-xl border border-rose-200 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-rose-900 uppercase font-bold tracking-wider">
                  ITC at Risk (Not in 2B)
                </span>
                <span className="text-[10px] font-mono text-rose-700 font-semibold">Only in Tally</span>
              </div>
              <strong className="text-2xl font-extrabold text-rose-700 block mt-1 tabular-nums">
                {R_FMT(S.risk)}
              </strong>
              <span className="text-[11px] text-rose-700 block mt-1 tabular-nums">
                {S.riskCount} docs booked without 2B credit
              </span>
            </button>
          </div>

          {/* Row 2: RCM, Input Restricted in 2B, Reversal Conflicts & Match Hygiene */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-3.5">
            <button
              type="button"
              onClick={() => jumpToDocsFilter({ status: 'All', attr: 'rcm' })}
              className="text-left bg-amber-50/30 hover:border-amber-400 transition-colors p-4 rounded-xl border border-amber-200 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-amber-900 uppercase font-bold tracking-wider">
                  RCM Liability (3.1(d))
                </span>
                <span className="text-[10px] font-mono text-amber-800 font-semibold">4(A)(3) ITC</span>
              </div>
              <strong className="text-2xl font-extrabold text-amber-800 block mt-1 tabular-nums">
                {R_FMT(S.rcmStats.liability3_1d.total)}
              </strong>
              <span className="text-[11px] text-amber-800 block mt-1 tabular-nums">
                {S.rcmStats.count2b} in 2B · {S.rcmStats.countTally} in Tally · Claimable {R_FMT(S.rcmStats.itc4A3.total)}
              </span>
            </button>

            <button
              type="button"
              onClick={() => jumpToDocsFilter({ status: 'All', attr: 'restricted' })}
              className="text-left bg-slate-50/70 hover:border-rose-300 transition-colors p-4 rounded-xl border border-slate-200 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-700 uppercase font-bold tracking-wider">
                  Input Restricted in 2B
                </span>
                <span className="text-[10px] font-mono text-slate-600 font-semibold">3B 4(D)(2)</span>
              </div>
              <strong className="text-2xl font-extrabold text-slate-900 block mt-1 tabular-nums">
                {R_FMT(S.restrictedStats.taxHeads.total)}
              </strong>
              <span className="text-[11px] text-slate-600 block mt-1 tabular-nums">
                {S.restrictedStats.count} docs blocked · Portal {S.restrictedStats.portalMarkedCount} · POS {S.restrictedStats.posBlockedCount} · 16(4) {S.restrictedStats.sec16_4Count}
              </span>
            </button>

            <button
              type="button"
              onClick={() => jumpToDocsFilter({ status: 'All', attr: 'booked_restricted' })}
              className={`text-left transition-colors p-4 rounded-xl border shadow-xs ${
                S.restrictedStats.bookedDespiteRestrictedCount > 0
                  ? 'bg-rose-50 hover:border-rose-400 border-rose-300'
                  : 'bg-emerald-50/30 hover:border-emerald-300 border-emerald-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[11px] uppercase font-bold tracking-wider ${
                    S.restrictedStats.bookedDespiteRestrictedCount > 0 ? 'text-rose-900' : 'text-emerald-900'
                  }`}
                >
                  Booked Despite 2B Restrict
                </span>
                <span
                  className={`text-[10px] font-mono font-semibold ${
                    S.restrictedStats.bookedDespiteRestrictedCount > 0 ? 'text-rose-700' : 'text-emerald-700'
                  }`}
                >
                  {S.restrictedStats.bookedDespiteRestrictedCount > 0 ? 'Reversal Risk' : 'Clean'}
                </span>
              </div>
              <strong
                className={`text-2xl font-extrabold block mt-1 tabular-nums ${
                  S.restrictedStats.bookedDespiteRestrictedCount > 0 ? 'text-rose-700' : 'text-emerald-700'
                }`}
              >
                {R_FMT(S.restrictedStats.bookedDespiteRestrictedTax)}
              </strong>
              <span
                className={`text-[11px] block mt-1 tabular-nums ${
                  S.restrictedStats.bookedDespiteRestrictedCount > 0 ? 'text-rose-800' : 'text-emerald-700'
                }`}
              >
                {S.restrictedStats.bookedDespiteRestrictedCount > 0
                  ? `${S.restrictedStats.bookedDespiteRestrictedCount} restricted 2B docs claimed in Tally`
                  : 'Zero restricted 2B invoices booked in Tally'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => jumpToDocsFilter({ status: 'All', attr: 'late' })}
              className="text-left bg-emerald-50/30 hover:border-emerald-300 transition-colors p-4 rounded-xl border border-emerald-200 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-emerald-900 uppercase font-bold tracking-wider">
                  Match Rate &amp; Late Filing
                </span>
                <span className="text-[10px] font-mono text-emerald-700 font-semibold">{S.n} total docs</span>
              </div>
              <strong className="text-2xl font-extrabold text-emerald-700 block mt-1 tabular-nums">
                {(S.rate * 100).toFixed(1)}%
              </strong>
              <span className="text-[11px] text-emerald-800 block mt-1 tabular-nums">
                {S.s.Matched.n} matched · {S.nLate} late reported ({R_FMT(S.lateTax)})
              </span>
            </button>
          </div>

          {/* DEDICATED DASHBOARD ROW: RCM Compliance & Input Restricted in GSTR-2B */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-5">
            {/* LEFT PANEL: Reverse Charge (RCM) Dashboard */}
            <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200/80">
                      <Scale className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                        Reverse Charge (RCM) Dashboard
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        GSTR-3B Table 3.1(d) Cash Liability vs 4(A)(3) ITC &amp; Tally RCM Alignment
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => jumpToDocsFilter({ status: 'All', attr: 'rcm' })}
                    className="px-2.5 py-1.5 text-[11px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors shrink-0"
                  >
                    Filter RCM ({S.rcmStats.totalDocs}) →
                  </button>
                </div>

                {/* 3-stat mini strip */}
                <div className="grid grid-cols-3 gap-2.5 mt-3.5">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] font-bold uppercase text-slate-500 block">Cash Tax · 3.1(d)</span>
                    <strong className="text-sm font-extrabold text-slate-900 tabular-nums mt-0.5 block">
                      {R_FMT(S.rcmStats.liability3_1d.total)}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-emerald-50/50 border border-emerald-200/70">
                    <span className="text-[10px] font-bold uppercase text-emerald-800 block">Claimable · 4(A)(3)</span>
                    <strong className="text-sm font-extrabold text-emerald-700 tabular-nums mt-0.5 block">
                      {R_FMT(S.rcmStats.itc4A3.total)}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-rose-50/50 border border-rose-200/70">
                    <span className="text-[10px] font-bold uppercase text-rose-800 block">Restricted RCM</span>
                    <strong className="text-sm font-extrabold text-rose-700 tabular-nums mt-0.5 block">
                      {R_FMT(S.rcmStats.restrictedRcmTax)}
                    </strong>
                  </div>
                </div>

                {/* Tax Head Table */}
                <div className="mt-3.5 overflow-x-auto">
                  <table className="w-full text-[11px] border border-slate-200 rounded-lg overflow-hidden">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-1.5 px-2.5 text-left">RCM Bucket</th>
                        <th className="py-1.5 px-2.5 text-right">IGST</th>
                        <th className="py-1.5 px-2.5 text-right">CGST</th>
                        <th className="py-1.5 px-2.5 text-right">SGST</th>
                        <th className="py-1.5 px-2.5 text-right">Cess</th>
                        <th className="py-1.5 px-2.5 text-right">Total Tax</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono tabular-nums text-slate-800">
                      <tr>
                        <td className="py-1.5 px-2.5 font-sans font-semibold text-slate-700">3.1(d) Liability (2B)</td>
                        <td className="py-1.5 px-2.5 text-right">{formatINRPlain(S.rcmStats.liability3_1d.igst)}</td>
                        <td className="py-1.5 px-2.5 text-right">{formatINRPlain(S.rcmStats.liability3_1d.cgst)}</td>
                        <td className="py-1.5 px-2.5 text-right">{formatINRPlain(S.rcmStats.liability3_1d.sgst)}</td>
                        <td className="py-1.5 px-2.5 text-right">{formatINRPlain(S.rcmStats.liability3_1d.cess)}</td>
                        <td className="py-1.5 px-2.5 text-right font-bold">{formatINRPlain(S.rcmStats.liability3_1d.total)}</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-2.5 font-sans font-semibold text-emerald-700">4(A)(3) Eligible RCM</td>
                        <td className="py-1.5 px-2.5 text-right">{formatINRPlain(S.rcmStats.itc4A3.igst)}</td>
                        <td className="py-1.5 px-2.5 text-right">{formatINRPlain(S.rcmStats.itc4A3.cgst)}</td>
                        <td className="py-1.5 px-2.5 text-right">{formatINRPlain(S.rcmStats.itc4A3.sgst)}</td>
                        <td className="py-1.5 px-2.5 text-right">{formatINRPlain(S.rcmStats.itc4A3.cess)}</td>
                        <td className="py-1.5 px-2.5 text-right font-bold text-emerald-700">
                          {formatINRPlain(S.rcmStats.itc4A3.total)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Alignment Status Chips */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3.5 pt-3 border-t border-slate-100 text-[11px]">
                <button
                  type="button"
                  onClick={() => jumpToDocsFilter({ status: 'Matched', attr: 'rcm' })}
                  className="p-2 rounded-lg border border-slate-200 hover:border-emerald-400 text-left transition-colors"
                >
                  <span className="text-slate-500 block">Matched RCM</span>
                  <strong className="font-mono text-emerald-700 text-xs">{S.rcmStats.matchedRcmCount} docs</strong>
                </button>
                <button
                  type="button"
                  onClick={() => jumpToDocsFilter({ status: 'Only in 2B', attr: 'rcm' })}
                  className="p-2 rounded-lg border border-slate-200 hover:border-blue-400 text-left transition-colors"
                >
                  <span className="text-slate-500 block">2B RCM Unbooked</span>
                  <strong className="font-mono text-blue-700 text-xs">{S.rcmStats.unbookedInTallyCount} docs</strong>
                </button>
                <button
                  type="button"
                  onClick={() => jumpToDocsFilter({ status: 'All', attr: 'rcm_mismatch' })}
                  className={`p-2 rounded-lg border text-left transition-colors ${
                    S.rcmStats.bookedAsRegularCount > 0
                      ? 'border-amber-300 bg-amber-50/60 hover:border-amber-400'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span className="text-slate-600 block">Booked Regular</span>
                  <strong className="font-mono text-amber-800 text-xs">{S.rcmStats.bookedAsRegularCount} docs</strong>
                </button>
                <button
                  type="button"
                  onClick={() => jumpToDocsFilter({ status: 'Only in Tally', attr: 'rcm' })}
                  className="p-2 rounded-lg border border-slate-200 hover:border-rose-400 text-left transition-colors"
                >
                  <span className="text-slate-500 block">Tally RCM Only</span>
                  <strong className="font-mono text-rose-700 text-xs">{S.rcmStats.tallyRcmOnlyCount} docs</strong>
                </button>
              </div>
            </div>

            {/* RIGHT PANEL: Input Restricted in GSTR-2B Dashboard */}
            <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center border border-rose-200/80">
                      <Ban className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                        Input Restricted in GSTR-2B (4(D)(2))
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        ITC marked No in 2B, POS State Blocks, Sec 16(4) Cutoff &amp; Tally Conflict Alerts
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => jumpToDocsFilter({ status: 'All', attr: 'restricted' })}
                    className="px-2.5 py-1.5 text-[11px] font-semibold text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors shrink-0"
                  >
                    Filter Restricted ({S.restrictedStats.count}) →
                  </button>
                </div>

                {/* Critical Alert if Restricted 2B Docs are Booked in Tally */}
                {S.restrictedStats.bookedDespiteRestrictedCount > 0 ? (
                  <div className="mt-3 p-2.5 rounded-xl border border-rose-300 bg-rose-50/70 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 text-rose-900">
                      <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>
                        <strong>{S.restrictedStats.bookedDespiteRestrictedCount}</strong> restricted 2B doc(s) worth{' '}
                        <strong className="font-mono">{formatINR(S.restrictedStats.bookedDespiteRestrictedTax)}</strong>{' '}
                        found in Tally — Reversal / Hold required!
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => jumpToDocsFilter({ status: 'All', attr: 'booked_restricted' })}
                      className="px-2.5 py-1 text-[11px] font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shrink-0"
                    >
                      Review →
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/40 flex items-center gap-2 text-xs text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>No input-restricted GSTR-2B documents were accidentally claimed in Tally.</span>
                  </div>
                )}

                {/* Tax Head Table for Input Restricted in 2B */}
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-[11px] border border-slate-200 rounded-lg overflow-hidden">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-1.5 px-2.5 text-left">Taxable (2B)</th>
                        <th className="py-1.5 px-2.5 text-right">IGST</th>
                        <th className="py-1.5 px-2.5 text-right">CGST</th>
                        <th className="py-1.5 px-2.5 text-right">SGST</th>
                        <th className="py-1.5 px-2.5 text-right">Cess</th>
                        <th className="py-1.5 px-2.5 text-right">Total Restricted</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono tabular-nums text-slate-900">
                      <tr>
                        <td className="py-1.5 px-2.5 text-left">{formatINRPlain(S.restrictedStats.taxable)}</td>
                        <td className="py-1.5 px-2.5 text-right">{formatINRPlain(S.restrictedStats.taxHeads.igst)}</td>
                        <td className="py-1.5 px-2.5 text-right">{formatINRPlain(S.restrictedStats.taxHeads.cgst)}</td>
                        <td className="py-1.5 px-2.5 text-right">{formatINRPlain(S.restrictedStats.taxHeads.sgst)}</td>
                        <td className="py-1.5 px-2.5 text-right">{formatINRPlain(S.restrictedStats.taxHeads.cess)}</td>
                        <td className="py-1.5 px-2.5 text-right font-bold text-rose-700">
                          {formatINRPlain(S.restrictedStats.taxHeads.total)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Reason-wise Breakdown */}
                <div className="mt-3.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Restriction Reason Breakdown (Click row to inspect)
                  </div>
                  {S.restrictedStats.reasonBreakdown.length === 0 ? (
                    <div className="text-xs text-slate-500 py-3 text-center bg-slate-50 rounded-xl border border-slate-200/70">
                      Zero restricted documents under current GSTR-2B &amp; compliance options.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {S.restrictedStats.reasonBreakdown.map((rb) => {
                        const pct =
                          S.restrictedStats.taxHeads.total > 0
                            ? Math.max(4, (Math.abs(rb.tax) / Math.abs(S.restrictedStats.taxHeads.total)) * 100)
                            : 10;
                        return (
                          <button
                            key={rb.category}
                            type="button"
                            onClick={() =>
                              jumpToDocsFilter({ status: 'All', attr: 'restricted', reason: rb.category })
                            }
                            className="w-full text-left p-2 rounded-lg border border-slate-200/90 hover:border-rose-300 hover:bg-rose-50/20 transition-colors"
                          >
                            <div className="flex items-center justify-between text-xs gap-2">
                              <span className="font-semibold text-slate-800 truncate">{rb.category}</span>
                              <span className="font-mono tabular-nums text-slate-900 font-bold shrink-0">
                                {R_FMT(rb.tax)} · {rb.count} docs
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                <div className="h-full bg-rose-500" style={{ width: `${pct}%` }} />
                              </div>
                              {rb.bookedCount > 0 && (
                                <span className="text-[10px] font-mono text-rose-700 font-semibold shrink-0">
                                  {rb.bookedCount} in Tally ({R_FMT(rb.bookedTax)})
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Row 3: Status Donut + Top Suppliers + GSTR-3B Control Summary */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-5">
            {/* Donut Card */}
            <div className="md:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">
                Reconciliation Status Breakdown
              </h3>
              <div className="flex items-center gap-6">
                <svg className="w-28 h-28 transform -rotate-90 shrink-0" viewBox="0 0 42 42">
                  {(() => {
                    let off = 25;
                    const tot = S.n || 1;
                    return ST.map((k, i) => {
                      const p = (S.s[k].n / tot) * 100;
                      const strokeDash = `${p} ${100 - p}`;
                      const el = (
                        <circle
                          key={k}
                          r="15.9155"
                          cx="21"
                          cy="21"
                          fill="none"
                          stroke={ST_COLORS[i]}
                          strokeWidth="6"
                          strokeDasharray={strokeDash}
                          strokeDashoffset={off}
                        />
                      );
                      off -= p;
                      return el;
                    });
                  })()}
                </svg>

                <div className="space-y-1.5 text-xs flex-1">
                  {ST.map((k, i) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => jumpToDocsFilter({ status: k, attr: 'all' })}
                      className="w-full flex items-center justify-between gap-2 hover:bg-slate-50 px-1.5 py-0.5 rounded transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: ST_COLORS[i] }}
                        />
                        <span className="text-slate-700 font-medium">{k}</span>
                      </span>
                      <strong className="text-slate-900 font-mono tabular-nums">{S.s[k].n}</strong>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Top Suppliers by Difference */}
            <div className="md:col-span-7 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Top Suppliers by ITC Difference (Click to drill down)
              </h3>
              <div className="space-y-2">
                {supplierList.slice(0, 5).map((sup) => {
                  const d = sup.a - sup.b;
                  const mx = Math.max(1, ...supplierList.map((s) => Math.abs(s.a - s.b)));
                  const pct = Math.max(4, (Math.abs(d) / mx) * 100);
                  return (
                    <button
                      key={sup.g}
                      type="button"
                      onClick={() => jumpToDocsFilter({ status: 'All', attr: 'all', query: sup.g })}
                      className="w-full grid grid-cols-12 items-center gap-2 text-xs hover:bg-slate-50 p-1.5 rounded-lg transition-colors text-left"
                    >
                      <span className="col-span-5 font-medium text-slate-800 truncate" title={sup.name}>
                        {sup.name || sup.g}
                        {sup.restrictedTax > 0 && (
                          <small className="block text-[10px] text-rose-700 font-mono">
                            Restricted: {R_FMT(sup.restrictedTax)}
                          </small>
                        )}
                      </span>
                      <div className="col-span-4 bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${d < 0 ? 'bg-rose-500' : 'bg-blue-600'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="col-span-3 text-right font-mono font-bold tabular-nums text-slate-900">
                        {R_FMT(d)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* GSTR-3B Bucket Control Table (On-Screen Portal Summary Reconciliation) */}
          <div className="mt-5 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={() => setShow3bControl((v) => !v)}
              className="w-full px-5 py-3.5 bg-slate-50/70 hover:bg-slate-50 flex items-center justify-between text-left border-b border-slate-200"
            >
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  GSTR-3B Bucket Control — Computed 2B Rows vs Portal Summary Sheets
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Verifies row-level 4(A)(5) Regular, 3.1(d)/4(A)(3) RCM &amp; 4(D)(2) Restricted ITC against GSTR-2B portal summary tabs
                </p>
              </div>
              {show3bControl ? (
                <ChevronUp className="w-4 h-4 text-slate-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-500" />
              )}
            </button>
            {show3bControl && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <th className="py-2.5 px-4">GSTR-2B Bucket</th>
                      <th className="py-2.5 px-3">3B Table</th>
                      <th className="py-2.5 px-3 text-right">Docs</th>
                      <th className="py-2.5 px-3 text-right">IGST</th>
                      <th className="py-2.5 px-3 text-right">CGST</th>
                      <th className="py-2.5 px-3 text-right">SGST</th>
                      <th className="py-2.5 px-3 text-right">Cess</th>
                      <th className="py-2.5 px-3 text-right">Computed Total</th>
                      <th className="py-2.5 px-3 text-right">Portal Summary</th>
                      <th className="py-2.5 px-4 text-right">Diff</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reconData.ctlData
                      .filter((x) => x.n > 0 || x.pt != null)
                      .map((x) => (
                        <tr key={x.k} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-4 font-semibold text-slate-800">{x.label}</td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">{x.tb}</td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums">{x.n}</td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums">{formatINRPlain(x.t[0])}</td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums">{formatINRPlain(x.t[1])}</td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums">{formatINRPlain(x.t[2])}</td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums">{formatINRPlain(x.t[3])}</td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                            {formatINRPlain(x.ot)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">
                            {x.pt == null ? '—' : formatINRPlain(x.pt)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold">
                            {x.diff == null ? (
                              <span className="text-slate-400">—</span>
                            ) : Math.abs(x.diff) > 2 ? (
                              <span className="text-rose-700">{formatINRPlain(x.diff)}</span>
                            ) : (
                              <span className="text-emerald-700">0.00</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Anchor for Drilldown Scroll */}
          <div ref={resultsAnchorRef} className="mt-8" />

          {/* Navigation Controls & Search Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* View Switcher */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg text-xs">
                {(
                  [
                    ['docs', 'Documents'],
                    ['sup', 'Suppliers'],
                    ['rep', 'Reports'],
                  ] as const
                ).map(([v, l]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => {
                      setUiView(v);
                      setUiK('diff');
                      setUiD(-1);
                    }}
                    className={`px-3 py-1 font-semibold rounded-md transition-all ${
                      uiView === v ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>

              {/* Search Input */}
              <div className="relative max-w-sm w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={uiQ}
                  onChange={(e) => {
                    setUiQ(e.target.value);
                    setUiPg(0);
                  }}
                  placeholder="Search supplier, GSTIN, invoice, reason, voucher..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:border-indigo-600"
                />
              </div>
            </div>

            {/* Document Status + Compliance Attribute Filters */}
            {uiView === 'docs' && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                    Status:
                  </span>
                  {['All', ...ST].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setUiSt(s);
                        setUiPg(0);
                      }}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                        uiSt === s
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {s} {s !== 'All' && `· ${S.s[s as ReconRow['status']].n}`}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                    ITC / RCM:
                  </span>
                  {(
                    [
                      ['all', `All Types (${reconData.res.length})`],
                      ['eligible', `Eligible Regular (${S.e2Count})`],
                      ['rcm', `RCM Supplies (${S.nRcm})`],
                      [
                        'rcm_mismatch',
                        `RCM Mismatch (${S.rcmStats.bookedAsRegularCount + S.rcmStats.tallyRcmOnlyCount})`,
                      ],
                      ['restricted', `Input Restricted in 2B (${S.restrictedStats.count})`],
                      [
                        'booked_restricted',
                        `Booked Despite Restrict (${S.restrictedStats.bookedDespiteRestrictedCount})`,
                      ],
                      ['late', `Late Reported (${S.nLate})`],
                    ] as const
                  ).map(([k, label]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        setUiAttr(k);
                        setUiReasonFilter('');
                        setUiPg(0);
                      }}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                        uiAttr === k
                          ? k === 'booked_restricted'
                            ? 'bg-rose-600 text-white shadow-xs'
                            : k === 'rcm' || k === 'rcm_mismatch'
                              ? 'bg-amber-600 text-white shadow-xs'
                              : 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                  {uiReasonFilter && (
                    <button
                      type="button"
                      onClick={() => setUiReasonFilter('')}
                      className="px-2 py-1 text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 rounded-md hover:bg-rose-100"
                    >
                      Reason: {uiReasonFilter} ✕
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Report Sub-tabs */}
            {uiView === 'rep' && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs pt-2 border-t border-slate-100">
                {REPS_LIST.map(([k, l]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setUiRp(k)}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                      uiRp === k ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {l} {k !== 'summary' && `· ${getRepRows(k).length}`}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Table / Content View */}
          <div className="mt-4 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            {/* 1. DOCUMENTS VIEW */}
            {uiView === 'docs' && (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                        <th className="py-3 px-3">
                          <button type="button" onClick={() => toggleSort('status')} className="inline-flex items-center gap-1 hover:text-slate-900">
                            Status <ArrowUpDown className="w-3 h-3" />
                          </button>
                        </th>
                        <th className="py-3 px-3">Compliance / 2B ITC</th>
                        <th className="py-3 px-3">
                          <button type="button" onClick={() => toggleSort('name')} className="inline-flex items-center gap-1 hover:text-slate-900">
                            Supplier &amp; GSTIN <ArrowUpDown className="w-3 h-3" />
                          </button>
                        </th>
                        <th className="py-3 px-3">Document No</th>
                        <th className="py-3 px-3">Date</th>
                        <th className="py-3 px-3 text-right">Taxable 2B</th>
                        <th className="py-3 px-3 text-right">Taxable Tally</th>
                        <th className="py-3 px-3 text-right">Tax 2B</th>
                        <th className="py-3 px-3 text-right">Tax Tally</th>
                        <th className="py-3 px-3 text-right">
                          <button type="button" onClick={() => toggleSort('diff')} className="inline-flex items-center gap-1 hover:text-slate-900 ml-auto">
                            Tax Diff <ArrowUpDown className="w-3 h-3" />
                          </button>
                        </th>
                        <th className="py-3 px-3">Remark / Reason</th>
                        <th className="py-3 px-3 text-center">Inspect</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {displayedDocRows.length === 0 ? (
                        <tr>
                          <td colSpan={12} className="py-12 text-center text-slate-500">
                            No document records match this filter combination.
                          </td>
                        </tr>
                      ) : (
                        displayedDocRows.slice(safePg * pageSize, (safePg + 1) * pageSize).map((r) => {
                          const statusColor = ST_COLORS[ST.indexOf(r.status)];
                          return (
                            <tr
                              key={r.i}
                              className={`hover:bg-slate-50/90 transition-colors ${
                                r.bookedDespiteRestricted ? 'bg-rose-50/35' : ''
                              }`}
                            >
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <span className="inline-flex items-center gap-1.5 font-bold text-slate-800 text-[11px]">
                                  <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: statusColor }}
                                  />
                                  {r.status}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="space-y-0.5 text-[11px]">
                                  {r.restricted2b ? (
                                    <span
                                      className={`inline-block px-1.5 py-0.5 rounded font-semibold border ${
                                        r.bookedDespiteRestricted
                                          ? 'bg-rose-50 text-rose-800 border-rose-300'
                                          : 'bg-slate-100 text-slate-800 border-slate-300'
                                      }`}
                                    >
                                      {r.bookedDespiteRestricted ? 'Restricted · Booked!' : 'Restricted in 2B'}
                                    </span>
                                  ) : r.rcm ? (
                                    <span className="inline-block px-1.5 py-0.5 rounded font-semibold bg-amber-50 text-amber-800 border border-amber-300">
                                      RCM · {r.rcmStatus === 'Matched RCM' ? 'Matched' : 'Verify'}
                                    </span>
                                  ) : (
                                    <span className="text-emerald-700 font-medium">Regular ITC</span>
                                  )}
                                  {r.rcm && r.restricted2b && (
                                    <span className="block text-[10px] text-amber-800 font-semibold">
                                      Also RCM 3.1(d)
                                    </span>
                                  )}
                                  {r.late && (
                                    <span className="block text-[10px] text-amber-700">
                                      <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                                      Late ({r.per})
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="font-bold text-slate-900 block truncate max-w-[175px]" title={r.name}>
                                  {r.name}
                                </span>
                                <span className="font-mono text-[11px] text-slate-500">{r.gstin}</span>
                              </td>
                              <td className="py-2.5 px-3 font-mono font-medium text-slate-800">
                                {r.doc2b || r.docT}
                                {r.doc2b && r.docT && r.doc2b !== r.docT && (
                                  <small className="block text-[10px] text-slate-500">Tally: {r.docT}</small>
                                )}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                                {r.date2b || r.dateT}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                                {r.tx2 !== 0 ? formatINRPlain(r.tx2) : '—'}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                                {r.txT !== 0 ? formatINRPlain(r.txT) : '—'}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                                {r.tax2 !== 0 ? formatINRPlain(r.tax2) : '—'}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                                {r.taxT !== 0 ? formatINRPlain(r.taxT) : '—'}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                                {Math.abs(r.diff) > options.tolTax ? (
                                  <span className="text-rose-700 font-bold">{formatINRPlain(r.diff)}</span>
                                ) : (
                                  <span className="text-emerald-700 font-semibold">{formatINRPlain(r.diff)}</span>
                                )}
                              </td>
                              <td
                                className="py-2.5 px-3 text-[11px] text-slate-600 max-w-[210px] truncate"
                                title={[r.restrictedCategory, r.reason, r.remark].filter(Boolean).join(' · ')}
                              >
                                {r.restrictedCategory ? (
                                  <span className="text-rose-800 font-medium">
                                    {r.restrictedCategory}
                                    {r.reason ? ` — ${r.reason}` : ''}
                                  </span>
                                ) : (
                                  r.remark
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => setSelectedDrawerRow(r)}
                                  className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-md hover:bg-slate-100 transition-colors"
                                  title="Inspect Details & Accept Match"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Bar */}
                {displayedDocRows.length > 0 && (
                  <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between text-xs text-slate-600">
                    <span className="font-mono tabular-nums">
                      Showing {safePg * pageSize + 1}–{Math.min((safePg + 1) * pageSize, displayedDocRows.length)} of{' '}
                      {displayedDocRows.length} rows
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={safePg === 0}
                        onClick={() => setUiPg((p) => Math.max(0, p - 1))}
                        className="px-2.5 py-1 border border-slate-300 bg-white rounded-md font-semibold disabled:opacity-40 hover:bg-slate-50 inline-flex items-center gap-1"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" /> Prev
                      </button>
                      <span className="px-2 font-mono text-[11px]">
                        Page {safePg + 1} / {totalPages}
                      </span>
                      <button
                        type="button"
                        disabled={safePg >= totalPages - 1}
                        onClick={() => setUiPg((p) => Math.min(totalPages - 1, p + 1))}
                        className="px-2.5 py-1 border border-slate-300 bg-white rounded-md font-semibold disabled:opacity-40 hover:bg-slate-50 inline-flex items-center gap-1"
                      >
                        Next <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* 2. SUPPLIERS VIEW */}
            {uiView === 'sup' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <th className="py-3 px-4">Supplier &amp; GSTIN</th>
                      <th className="py-3 px-4 text-right">Total Docs</th>
                      <th className="py-3 px-4 text-right">Unmatched</th>
                      <th className="py-3 px-4 text-right">RCM Docs</th>
                      <th className="py-3 px-4 text-right">Restricted 2B Tax</th>
                      <th className="py-3 px-4 text-right">Tax in 2B (₹)</th>
                      <th className="py-3 px-4 text-right">Tax in Tally (₹)</th>
                      <th className="py-3 px-4 text-right">Difference (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {supplierList.map((s) => (
                      <tr
                        key={s.g}
                        onClick={() => jumpToDocsFilter({ status: 'All', attr: 'all', query: s.g })}
                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900 block">{s.name || 'Unnamed Supplier'}</span>
                          <span className="font-mono text-slate-500">{s.g}</span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums">{s.n}</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-amber-700">{s.u}</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">{s.rcmCount}</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-rose-700">
                          {s.restrictedTax > 0 ? formatINRPlain(s.restrictedTax) : '0.00'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums">{formatINRPlain(s.a)}</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums">{formatINRPlain(s.b)}</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-bold">
                          {Math.abs(s.a - s.b) > options.tolTax ? (
                            <span className="text-rose-700">{formatINRPlain(s.a - s.b)}</span>
                          ) : (
                            <span className="text-emerald-700">0.00</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 3. REPORTS VIEW */}
            {uiView === 'rep' && (
              <div className="p-6 space-y-6">
                {uiRp === 'summary' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* ITC Bridge Card */}
                    <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                        ITC Bridge – Eligible 2B vs Tally Books
                      </h4>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span>ITC eligible per 2B (regular + credit notes):</span>
                          <strong className="font-mono tabular-nums">{formatINR(S.e2)}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>ITC booked in Tally:</span>
                          <strong className="font-mono tabular-nums">{formatINR(S.tT)}</strong>
                        </div>
                        <div className="flex justify-between font-bold border-t border-slate-200 pt-1 text-slate-900">
                          <span>Difference:</span>
                          <span className="font-mono tabular-nums">{formatINR(S.e2 - S.tT)}</span>
                        </div>
                        <div className="flex justify-between text-slate-600 pl-3">
                          <span>· In 2B, not booked in Tally (to claim):</span>
                          <span className="font-mono tabular-nums text-blue-700">+{formatINR(S.br.a)}</span>
                        </div>
                        <div className="flex justify-between text-slate-600 pl-3">
                          <span>· Booked in Tally, not in 2B (at risk):</span>
                          <span className="font-mono tabular-nums text-rose-700">{formatINR(S.br.b)}</span>
                        </div>
                        <div className="flex justify-between text-slate-600 pl-3">
                          <span>· Booked in Tally, but 2B says RCM / Restricted:</span>
                          <span className="font-mono tabular-nums text-slate-800">{formatINR(S.br.c)}</span>
                        </div>
                        <div className="flex justify-between text-slate-600 pl-3">
                          <span>· Amount differences on matched invoices:</span>
                          <span className="font-mono tabular-nums text-slate-800">{formatINR(S.br.d)}</span>
                        </div>
                      </div>
                    </div>

                    {/* GSTR-3B Position Card */}
                    <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                        GSTR-3B Compliance Position per 2B
                      </h4>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span>Regular ITC – Table 4(A)(5):</span>
                          <strong className="font-mono tabular-nums">{formatINR(S.e2)}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>RCM ITC (after cash payment) – Table 4(A)(3):</span>
                          <strong className="font-mono tabular-nums text-emerald-700">
                            {formatINR(S.rcmStats.itc4A3.total)}
                          </strong>
                        </div>
                        <div className="flex justify-between">
                          <span>RCM cash tax payable – Table 3.1(d):</span>
                          <strong className="font-mono tabular-nums text-amber-700">
                            {formatINR(S.rcmStats.liability3_1d.total)}
                          </strong>
                        </div>
                        <div className="flex justify-between font-bold border-t border-slate-200 pt-1 text-slate-900">
                          <span>Input Restricted in GSTR-2B – Table 4(D)(2):</span>
                          <span className="font-mono tabular-nums text-rose-700">
                            {formatINR(S.restrictedStats.taxHeads.total)}
                          </span>
                        </div>
                        {S.restrictedStats.bookedDespiteRestrictedCount > 0 && (
                          <div className="flex justify-between text-rose-800 pl-3 font-semibold">
                            <span>· Booked in Tally despite restriction (Reversal Risk):</span>
                            <span className="font-mono tabular-nums">
                              {formatINR(S.restrictedStats.bookedDespiteRestrictedTax)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {uiRp !== 'summary' && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Supplier</th>
                          <th className="py-2.5 px-3">Document</th>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">2B Category / POS</th>
                          <th className="py-2.5 px-3 text-right">Taxable</th>
                          <th className="py-2.5 px-3 text-right">Tax</th>
                          <th className="py-2.5 px-3">Risk Flags &amp; Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {getRepRows(uiRp).length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-10 text-center text-slate-500">
                              No exception rows found under this compliance report.
                            </td>
                          </tr>
                        ) : (
                          getRepRows(uiRp).map((r) => (
                            <tr
                              key={r.i}
                              onClick={() => setSelectedDrawerRow(r)}
                              className="hover:bg-slate-50 cursor-pointer"
                            >
                              <td className="py-2 px-3 font-semibold text-slate-800 whitespace-nowrap">{r.status}</td>
                              <td className="py-2 px-3">
                                <span className="font-bold text-slate-900 block">{r.name}</span>
                                <span className="font-mono text-[10px] text-slate-500">{r.gstin}</span>
                              </td>
                              <td className="py-2 px-3 font-mono">{r.doc2b || r.docT}</td>
                              <td className="py-2 px-3 font-mono whitespace-nowrap">{r.date2b || r.dateT}</td>
                              <td className="py-2 px-3 text-[11px] text-slate-700">
                                {r.restricted2b ? r.restrictedCategory : r.rcm ? r.rcmStatus : 'Regular'}
                                {r.pos && <small className="block text-slate-400">POS: {r.pos}</small>}
                              </td>
                              <td className="py-2 px-3 text-right font-mono tabular-nums">
                                {formatINRPlain(r.tx2 || r.txT)}
                              </td>
                              <td className="py-2 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                                {formatINRPlain(r.tax2 || r.taxT)}
                              </td>
                              <td className="py-2 px-3 text-slate-600">{r.flags || r.remark}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Clean Empty State when no files reconciled yet */}
      {!reconData && (
        <div className="mt-8 bg-white p-8 sm:p-12 rounded-2xl border border-slate-200 text-center max-w-3xl mx-auto shadow-xs space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto font-bold border border-emerald-200/70">
            <FileSpreadsheet className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Ready for GSTR-2B Reconciliation</h2>
            <p className="text-xs text-slate-500 mt-1 max-w-lg mx-auto leading-relaxed">
              Configure matching tolerances, RCM treatment, and Input Restricted in 2B checks above, upload both workbooks, and click{' '}
              <strong>Reconcile →</strong>.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left pt-2">
            <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200/80">
              <span className="w-6 h-6 rounded-md bg-emerald-600 text-white font-bold text-xs flex items-center justify-center mb-2">
                1
              </span>
              <span className="text-xs font-bold text-slate-800 block">GSTR-2B &amp; Input Restrictions</span>
              <span className="text-[11px] text-slate-500 mt-1 block leading-normal">
                Parses B2B, B2BA, CDNR, ISD &amp; IMPG sheets, flagging 4(D)(2) portal restrictions, POS blocks &amp; Sec 16(4).
              </span>
            </div>
            <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200/80">
              <span className="w-6 h-6 rounded-md bg-indigo-600 text-white font-bold text-xs flex items-center justify-center mb-2">
                2
              </span>
              <span className="text-xs font-bold text-slate-800 block">Tally RCM &amp; Reversal Detection</span>
              <span className="text-[11px] text-slate-500 mt-1 block leading-normal">
                Matches Tally voucher/ledger RCM keywords against 2B 3.1(d) &amp; highlights restricted credits booked in Tally.
              </span>
            </div>
            <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200/80">
              <span className="w-6 h-6 rounded-md bg-slate-800 text-white font-bold text-xs flex items-center justify-center mb-2">
                3
              </span>
              <span className="text-xs font-bold text-slate-800 block">100% Private Browser RAM</span>
              <span className="text-[11px] text-slate-500 mt-1 block leading-normal">
                Zero server uploads. All matching and multi-sheet Excel export run strictly inside your browser.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Slide-out Drawer for Inspection & Manual Match */}
      {selectedDrawerRow && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-md bg-white h-full shadow-2xl p-6 overflow-y-auto space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: ST_COLORS[ST.indexOf(selectedDrawerRow.status)] }}
                  />
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    {selectedDrawerRow.status}
                  </span>
                  {selectedDrawerRow.rcm && (
                    <span className="text-[11px] font-semibold text-amber-800">· {selectedDrawerRow.rcmStatus}</span>
                  )}
                </div>
                <h3 className="text-base font-bold text-slate-900">{selectedDrawerRow.name}</h3>
                <span className="font-mono text-xs text-slate-500">
                  {selectedDrawerRow.gstin} · {selectedDrawerRow.type}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDrawerRow(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-md font-bold"
              >
                ✕
              </button>
            </div>

            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-1.5 text-left">Head</th>
                  <th className="py-1.5 text-right">GSTR-2B</th>
                  <th className="py-1.5 text-right">Tally</th>
                  <th className="py-1.5 text-right">Diff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                <tr>
                  <td className="py-1.5 font-sans text-slate-600">Doc No</td>
                  <td className="py-1.5 text-right font-bold">{selectedDrawerRow.doc2b || '—'}</td>
                  <td className="py-1.5 text-right font-bold">{selectedDrawerRow.docT || '—'}</td>
                  <td className="py-1.5 text-right text-slate-400">—</td>
                </tr>
                <tr>
                  <td className="py-1.5 font-sans text-slate-600">Date</td>
                  <td className="py-1.5 text-right">{selectedDrawerRow.date2b || '—'}</td>
                  <td className="py-1.5 text-right">{selectedDrawerRow.dateT || '—'}</td>
                  <td className="py-1.5 text-right text-slate-400">—</td>
                </tr>
                <tr>
                  <td className="py-1.5 font-sans text-slate-600">Taxable</td>
                  <td className="py-1.5 text-right">{formatINRPlain(selectedDrawerRow.tx2)}</td>
                  <td className="py-1.5 text-right">{formatINRPlain(selectedDrawerRow.txT)}</td>
                  <td className="py-1.5 text-right font-bold text-slate-900">
                    {formatINRPlain(Math.abs(selectedDrawerRow.tx2 - selectedDrawerRow.txT))}
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 font-sans text-slate-600">IGST</td>
                  <td className="py-1.5 text-right">{formatINRPlain(selectedDrawerRow.ig2)}</td>
                  <td className="py-1.5 text-right">{formatINRPlain(selectedDrawerRow.igT)}</td>
                  <td className="py-1.5 text-right">
                    {formatINRPlain(Math.abs(selectedDrawerRow.ig2 - selectedDrawerRow.igT))}
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 font-sans text-slate-600">CGST</td>
                  <td className="py-1.5 text-right">{formatINRPlain(selectedDrawerRow.cg2)}</td>
                  <td className="py-1.5 text-right">{formatINRPlain(selectedDrawerRow.cgT)}</td>
                  <td className="py-1.5 text-right">
                    {formatINRPlain(Math.abs(selectedDrawerRow.cg2 - selectedDrawerRow.cgT))}
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 font-sans text-slate-600">SGST</td>
                  <td className="py-1.5 text-right">{formatINRPlain(selectedDrawerRow.sg2)}</td>
                  <td className="py-1.5 text-right">{formatINRPlain(selectedDrawerRow.sgT)}</td>
                  <td className="py-1.5 text-right">
                    {formatINRPlain(Math.abs(selectedDrawerRow.sg2 - selectedDrawerRow.sgT))}
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 font-sans text-slate-600">Cess</td>
                  <td className="py-1.5 text-right">{formatINRPlain(selectedDrawerRow.ce2)}</td>
                  <td className="py-1.5 text-right">{formatINRPlain(selectedDrawerRow.ceT)}</td>
                  <td className="py-1.5 text-right">
                    {formatINRPlain(Math.abs(selectedDrawerRow.ce2 - selectedDrawerRow.ceT))}
                  </td>
                </tr>
                <tr className="font-bold border-t border-slate-200">
                  <td className="py-2 font-sans text-slate-900">Total Tax</td>
                  <td className="py-2 text-right">{formatINRPlain(selectedDrawerRow.tax2)}</td>
                  <td className="py-2 text-right">{formatINRPlain(selectedDrawerRow.taxT)}</td>
                  <td className="py-2 text-right text-rose-700">{formatINRPlain(Math.abs(selectedDrawerRow.diff))}</td>
                </tr>
              </tbody>
            </table>

            {/* 2B & Tally Compliance Metadata */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5">
              <div className="font-bold text-slate-800 uppercase text-[10px] tracking-wider">
                2B &amp; Tally Metadata
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">ITC Availability (2B):</span>
                <span className="font-semibold text-slate-800">
                  {selectedDrawerRow.restricted2b
                    ? `Restricted · ${selectedDrawerRow.restrictedCategory}`
                    : selectedDrawerRow.itc || 'Available'}
                </span>
              </div>
              {selectedDrawerRow.reason && (
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Portal Reason:</span>
                  <span className="font-medium text-rose-700 text-right">{selectedDrawerRow.reason}</span>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">RCM Classification:</span>
                <span className="font-semibold text-amber-800">{selectedDrawerRow.rcmStatus}</span>
              </div>
              {selectedDrawerRow.pos && (
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Place of Supply (2B):</span>
                  <span className="font-mono text-slate-800">{selectedDrawerRow.pos}</span>
                </div>
              )}
              {selectedDrawerRow.per && (
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">GSTR-1 Period / Filing:</span>
                  <span className="font-mono text-slate-800">
                    {selectedDrawerRow.per} {selectedDrawerRow.fdate ? `(${selectedDrawerRow.fdate})` : ''}
                  </span>
                </div>
              )}
              {selectedDrawerRow.vt && (
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Tally Voucher Type:</span>
                  <span className="font-mono text-slate-800">{selectedDrawerRow.vt}</span>
                </div>
              )}
              {selectedDrawerRow.deadline && (
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Sec 16(4) Cutoff:</span>
                  <span className="font-mono text-slate-800">{selectedDrawerRow.deadline}</span>
                </div>
              )}
            </div>

            {selectedDrawerRow.flags && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-1">
                <span className="font-bold block">Compliance &amp; Risk Flags:</span>
                <p className="leading-relaxed">{selectedDrawerRow.flags}</p>
              </div>
            )}

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
              <span className="font-bold block mb-1">Audit Remark:</span>
              <p>{selectedDrawerRow.remark}</p>
            </div>

            {selectedDrawerRow.status === 'Probable match' && (
              <button
                type="button"
                onClick={() => handleAcceptMatch(selectedDrawerRow.i)}
                className="w-full py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors"
              >
                Accept as Match ✓
              </button>
            )}
          </div>
        </div>
      )}

      {/* Dedicated Comprehensive User Guide & Regulatory Article */}
      <Gstr2bReconArticle />

      {/* Contextual GST & Financial Partner Directory */}
      <ContextualAdWidget initialCategory="finance" title="Recommended GST & Audit Resources" className="mt-8" />

      {/* Bottom Smartlink & 300x250 Dual Rectangles */}
      <div className="mt-6 space-y-5 no-print">
        <SmartlinkBanner slotId="tool_smartlink" />
        <AdRectanglePair leftSlot="tool_bottom_rect_1" rightSlot="tool_bottom_rect_2" />
      </div>
    </div>
  );
};
