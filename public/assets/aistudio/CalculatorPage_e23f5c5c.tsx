import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  FileDown,
  FileSpreadsheet,
  LayoutList,
  SlidersHorizontal,
  Upload,
  X,
} from 'lucide-react';
import { AdPlacement } from '../components/AdPlacement';
import { ExportStudioModal } from '../components/ExportStudioModal';
import { GuidedCalculatorForm } from '../components/GuidedCalculatorForm';
import { ResultsDashboard } from '../components/ResultsDashboard';
import { TaxGuideArticle } from '../components/TaxGuideArticle';
import { WorkbookGrid } from '../components/WorkbookGrid';
import { SITE_CONFIG, type AppRoute } from '../data/siteConfig';
import {
  buildCsvSummary,
  computeAdvancedTaxInsights,
  type EditsMap,
  type TaxSummarySnapshot,
} from '../engine/calculatorAdapter';
import type { CookieConsentState } from '../engine/cookieConsent';
import {
  downloadExcelTemplate,
  downloadExcelWorkbook,
  downloadPdfReport,
  importExcelFile,
} from '../engine/exportImport';
import {
  DEFAULT_EXPORT_PREFS,
  DEFAULT_PROFILE,
  formatPanDisplay,
  loadExportPrefs,
  loadSavedProfile,
  loadSavedWorkings,
  saveExportPrefs,
  saveProfile,
  saveWorkingsList,
  type ExportPreferences,
  type SavedWorkingRecord,
  type TaxpayerEmployerProfile,
} from '../engine/profileMeta';
import type { Book, XlScalar } from '../engine/xlEngine';

interface CalculatorPageProps {
  book: Book;
  revision: number;
  edits: EditsMap;
  summary: TaxSummarySnapshot;
  cookieConsent?: CookieConsentState;
  storageResetNonce?: number;
  onOpenCookieSettings?: () => void;
  focusRequest:
    | { mode: 'guided'; sectionId: string }
    | { mode: 'sheet'; sheetName: string }
    | null;
  onClearFocusRequest: () => void;
  onCommitCell: (sheetName: string, addr: string, value: XlScalar) => void;
  onCommitBatch: (updates: Array<{ sheetName: string; addr: string; value: XlScalar }>) => void;
  onRestoreBackup: (parsed: EditsMap) => void;
  onResetAll: () => void;
  onLoadSampleProfile: () => void;
  onActionLoading?: () => void;
  onNavigate: (route: AppRoute, options?: { hash?: string }) => void;
}

export const CalculatorPage: React.FC<CalculatorPageProps> = ({
  book,
  revision,
  edits,
  summary,
  cookieConsent,
  storageResetNonce = 0,
  onOpenCookieSettings,
  focusRequest,
  onClearFocusRequest,
  onCommitCell,
  onCommitBatch,
  onRestoreBackup,
  onResetAll,
  onLoadSampleProfile,
  onActionLoading,
  onNavigate,
}) => {
  const [viewMode, setViewMode] = useState<'guided' | 'sheet'>('guided');
  const [activeSheet, setActiveSheet] = useState<string>('IT 2026-27');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [excelNotice, setExcelNotice] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const advancedInsights = useMemo(
    () =>
      summary.oldGrossTotalIncome > 0 || summary.newGrossTotalIncome > 0
        ? computeAdvancedTaxInsights(edits, summary)
        : null,
    [edits, summary],
  );

  // Backup modal state
  const [backupOpen, setBackupOpen] = useState(false);
  const [backupText, setBackupText] = useState('');
  const [backupError, setBackupError] = useState('');
  const [copied, setCopied] = useState(false);

  // Taxpayer / Employer profile, export preferences, saved multi-client workings & Export Studio modal
  const [profile, setProfile] = useState<TaxpayerEmployerProfile>(() => loadSavedProfile());
  const [exportPrefs, setExportPrefs] = useState<ExportPreferences>(() => loadExportPrefs());
  const [savedWorkings, setSavedWorkings] = useState<SavedWorkingRecord[]>(() => loadSavedWorkings());
  const [exportStudioOpen, setExportStudioOpen] = useState(false);

  useEffect(() => {
    if (storageResetNonce === 0) return;
    setProfile({ ...DEFAULT_PROFILE });
    setExportPrefs({ ...DEFAULT_EXPORT_PREFS });
    setSavedWorkings([]);
  }, [storageResetNonce]);

  const handleChangeProfile = (patch: Partial<TaxpayerEmployerProfile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...patch };
      saveProfile(next);
      return next;
    });
  };

  const handleChangeExportPrefs = (patch: Partial<ExportPreferences>) => {
    setExportPrefs((prev) => {
      const next = { ...prev, ...patch };
      saveExportPrefs(next);
      return next;
    });
  };

  const handleSaveWorking = (label: string) => {
    const cleanLabel =
      label.trim() || summary.employeeName || profile.pan || profile.companyName || 'Saved Working';
    const record: SavedWorkingRecord = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      label: cleanLabel,
      updatedAt: new Date().toISOString(),
      employeeName: summary.employeeName,
      pan: profile.pan,
      companyName: profile.companyName,
      edits: JSON.parse(JSON.stringify(edits)) as EditsMap,
      profile: { ...profile },
    };
    setSavedWorkings((prev) => {
      const next = [record, ...prev].slice(0, 30);
      saveWorkingsList(next);
      return next;
    });
    setExcelNotice({
      type: 'success',
      message: `Saved working "${cleanLabel}" locally in this browser.`,
    });
  };

  const handleLoadWorking = (id: string) => {
    const record = savedWorkings.find((w) => w.id === id);
    if (!record) return;
    onActionLoading?.();
    onRestoreBackup(record.edits);
    const nextProfile = { ...DEFAULT_PROFILE, ...record.profile };
    setProfile(nextProfile);
    saveProfile(nextProfile);
    setExcelNotice({
      type: 'success',
      message: `Loaded working "${record.label}".`,
    });
  };

  const handleDeleteWorking = (id: string) => {
    setSavedWorkings((prev) => {
      const next = prev.filter((w) => w.id !== id);
      saveWorkingsList(next);
      return next;
    });
  };

  const handleResetAllWithProfile = () => {
    const cleared = { ...DEFAULT_PROFILE };
    setProfile(cleared);
    saveProfile(cleared);
    onResetAll();
  };

  const handleDownloadCsv = () => {
    const maskedPan = profile.pan
      ? formatPanDisplay(profile.pan, exportPrefs.maskPanInExports)
      : '';
    const csv = buildCsvSummary(summary, {
      ...profile,
      pan: maskedPan,
    });
    const slug = [summary.employeeName, maskedPan]
      .map((p) => (p || '').trim().replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, ''))
      .filter(Boolean)
      .join('_');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Income_Tax_Summary_FY_2026-27${slug ? `_${slug}` : ''}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExcelFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const result = await importExcelFile(file);
      onRestoreBackup(result.edits);
      if (result.profile && Object.keys(result.profile).length > 0) {
        const merged = { ...DEFAULT_PROFILE, ...result.profile };
        setProfile(merged);
        saveProfile(merged);
      }
      setExcelNotice({ type: 'success', message: result.summaryText });
    } catch (err) {
      setExcelNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unable to parse the selected Excel file.',
      });
    }
  };

  useEffect(() => {
    if (!focusRequest) return;
    if (focusRequest.mode === 'sheet') {
      setViewMode('sheet');
      setActiveSheet(focusRequest.sheetName);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setViewMode('guided');
      setTimeout(() => {
        const el = document.getElementById(focusRequest.sectionId);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
    }
    onClearFocusRequest();
  }, [focusRequest, onClearFocusRequest]);

  const openBackupModal = () => {
    setBackupText(JSON.stringify(edits));
    setBackupError('');
    setCopied(false);
    setBackupOpen(true);
  };

  const handleCopyBackup = async () => {
    try {
      await navigator.clipboard.writeText(backupText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleLoadBackup = () => {
    try {
      const parsed = JSON.parse(backupText);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setBackupError('The pasted text is not a valid calculator JSON backup.');
        return;
      }
      onRestoreBackup(parsed as EditsMap);
      setBackupOpen(false);
    } catch {
      setBackupError('Invalid JSON format. Please paste an unmodified backup string.');
    }
  };

  const scrollToResults = () => {
    document.getElementById('results-dashboard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="no-print flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <button
          type="button"
          onClick={() => onNavigate('/')}
          className="hover:text-sky-700 dark:hover:text-sky-400"
        >
          Home
        </button>
        <ChevronRight className="h-3.5 w-3.5" />
        <a
          href="/break-even-tax-planner"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('/break-even-tax-planner');
          }}
          className="hover:text-orange-700 dark:hover:text-orange-400"
        >
          Tax Planner
        </a>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-semibold text-slate-800 dark:text-slate-200">
          Income Tax Calculator
        </span>
      </nav>

      {/* Tool Heading */}
      <header className="space-y-3 border-b border-slate-200 pb-6 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400">
          <span>Free Tool</span>
          <span aria-hidden="true">&middot;</span>
          <span>{summary.fyLabel || SITE_CONFIG.financialYear}</span>
          <span aria-hidden="true">&middot;</span>
          <span>{SITE_CONFIG.assessmentYear}</span>
          <span aria-hidden="true">&middot;</span>
          <span className="text-slate-500 dark:text-slate-400">
            Workbook Engine {SITE_CONFIG.engineVersion}
          </span>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-3xl space-y-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-800 sm:text-3xl dark:text-white text-balance">
              Income Tax Calculator for Salaried Employees
            </h1>
            <p className="text-sm leading-relaxed text-slate-600 sm:text-base dark:text-slate-300">
              Calculate your estimated income tax under India&apos;s Old and New Tax Regimes. Enter your salary, deductions, exemptions, and other income to compare your tax liability.
            </p>
          </div>

          {/* Mode Toggle */}
          <div className="no-print flex shrink-0 items-center gap-1 rounded-xl border-[1.5px] border-slate-700 bg-white p-1 shadow-[3px_3px_0px_#334155] dark:border-slate-600 dark:bg-slate-800 dark:shadow-[3px_3px_0px_#1e293b]">
            <button
              type="button"
              onClick={() => {
                onActionLoading?.();
                setViewMode('guided');
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition ${
                viewMode === 'guided'
                  ? 'bg-orange-500 text-white border border-slate-700'
                  : 'text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              <LayoutList className="h-3.5 w-3.5" />
              Guided Form
            </button>
            <button
              type="button"
              onClick={() => {
                onActionLoading?.();
                setViewMode('sheet');
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition ${
                viewMode === 'sheet'
                  ? 'bg-orange-500 text-white border border-slate-700'
                  : 'text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Full Workbook (10 Tabs)
            </button>
          </div>
        </div>
      </header>

      {/* Excel Upload / Download & PDF Export Bar */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleExcelFileSelected}
        className="hidden"
        aria-label="Upload Excel file"
      />
      <div className="no-print tactile-card flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3.5 sm:px-5 dark:bg-slate-800">
        <div className="space-y-0.5">
          <div className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-white">
            Excel &amp; PDF Export Center
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {summary.employeeName || profile.pan || profile.companyName ? (
              <>
                Working header:{' '}
                <strong className="text-slate-700 dark:text-slate-200">
                  {[
                    summary.employeeName || null,
                    profile.pan ? `PAN ${formatPanDisplay(profile.pan, exportPrefs.maskPanInExports)}` : null,
                    profile.companyName || null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </strong>
              </>
            ) : (
              'Upload your FY 2026-27 Excel workbook, download a starter template, or export executive PDF & formula-backed Excel (.xlsx) reports.'
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="tactile-btn inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-orange-500 px-3.5 py-2 text-xs font-extrabold text-white hover:bg-orange-600"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload Excel (.xlsx)
          </button>

          <button
            type="button"
            onClick={() => {
              onActionLoading?.();
              downloadExcelTemplate(summary.employeeName, profile);
            }}
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border-[1.5px] border-slate-700 bg-[#FAF9F5] px-3 py-2 text-xs font-bold text-slate-800 transition hover:bg-orange-100 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
            Download Template
          </button>

          <button
            type="button"
            onClick={() => {
              onActionLoading?.();
              downloadExcelWorkbook(book, summary, edits, profile, exportPrefs);
            }}
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border-[1.5px] border-slate-700 bg-white px-3 py-2 text-xs font-bold text-slate-800 transition hover:bg-emerald-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            Download Excel (.xlsx)
          </button>

          <button
            type="button"
            onClick={() => {
              onActionLoading?.();
              downloadPdfReport(summary, advancedInsights, profile, exportPrefs, book);
            }}
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border-[1.5px] border-slate-700 bg-slate-700 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-slate-800 dark:border-orange-400/60 dark:bg-slate-900 dark:text-orange-300 dark:hover:bg-slate-700"
          >
            <FileDown className="h-3.5 w-3.5" />
            Download PDF Report
          </button>

          <button
            type="button"
            onClick={() => setExportStudioOpen(true)}
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
            Export Options
          </button>
        </div>
      </div>

      {excelNotice && (
        <div
          role="status"
          className={`no-print flex items-center justify-between gap-3 rounded-xl border-[1.5px] px-4 py-3 text-xs font-semibold ${
            excelNotice.type === 'success'
              ? 'border-emerald-600 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200'
              : 'border-rose-600 bg-rose-50 text-rose-900 dark:border-rose-700 dark:bg-rose-950/50 dark:text-rose-200'
          }`}
        >
          <span className="inline-flex items-center gap-2">
            {excelNotice.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{excelNotice.message}</span>
          </span>
          <button
            type="button"
            onClick={() => setExcelNotice(null)}
            aria-label="Dismiss notification"
            className="rounded p-1 hover:bg-slate-700/10 dark:hover:bg-white/10"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Calculator Workspace */}
      <div className="no-print">
        {viewMode === 'guided' ? (
          <GuidedCalculatorForm
            book={book}
            revision={revision}
            summary={summary}
            profile={profile}
            savedWorkings={savedWorkings}
            onChangeProfile={handleChangeProfile}
            onSaveWorking={handleSaveWorking}
            onLoadWorking={handleLoadWorking}
            onDeleteWorking={handleDeleteWorking}
            onCommitCell={onCommitCell}
            onCommitBatch={onCommitBatch}
            onOpenSheet={(sheetName) => {
              setActiveSheet(sheetName);
              setViewMode('sheet');
              window.scrollTo({ top: 180, behavior: 'smooth' });
            }}
            onOpenBackupModal={openBackupModal}
            onResetAll={handleResetAllWithProfile}
            onScrollToResults={scrollToResults}
            onLoadSampleProfile={onLoadSampleProfile}
          />
        ) : (
          <div className="tactile-card rounded-2xl bg-white p-4 sm:p-5 dark:bg-slate-800">
            <WorkbookGrid
              book={book}
              revision={revision}
              initialSheet={activeSheet}
              onCommitCell={onCommitCell}
              onCommitBatch={onCommitBatch}
            />
          </div>
        )}
      </div>

      {/* Ad Placement 1: Clean Break Between Inputs & Results */}
      <AdPlacement
        slotId="calc-post-form"
        variant="leaderboard"
        consent={cookieConsent}
        onAdvertiseClick={() => onNavigate('/contact-us')}
        onManageCookiePrefs={onOpenCookieSettings}
      />

      {/* Results Dashboard (Strictly Above Educational Article) */}
      <ResultsDashboard
        summary={summary}
        book={book}
        edits={edits}
        profile={profile}
        exportPrefs={exportPrefs}
        onOpenExportStudio={() => setExportStudioOpen(true)}
        onCommitCell={onCommitCell}
        onTriggerExcelUpload={() => fileInputRef.current?.click()}
        onOpenBackupModal={openBackupModal}
        onResetAll={handleResetAllWithProfile}
        onActionLoading={onActionLoading}
      />

      {/* Ad Placement 2: Between Results & Tax Guide Article */}
      <AdPlacement
        slotId="calc-post-results"
        variant="infeed"
        consent={cookieConsent}
        onAdvertiseClick={() => onNavigate('/contact-us')}
        onManageCookiePrefs={onOpenCookieSettings}
      />

      {/* Educational Article Below Calculator */}
      <TaxGuideArticle
        onJumpToCalculator={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      />

      {/* Export Studio Modal */}
      <ExportStudioModal
        open={exportStudioOpen}
        onClose={() => setExportStudioOpen(false)}
        summary={summary}
        profile={profile}
        exportPrefs={exportPrefs}
        onChangeProfile={handleChangeProfile}
        onChangeExportPrefs={handleChangeExportPrefs}
        onCommitCell={onCommitCell}
        onDownloadPdf={() => {
          onActionLoading?.();
          downloadPdfReport(summary, advancedInsights, profile, exportPrefs, book);
        }}
        onDownloadExcel={() => {
          onActionLoading?.();
          downloadExcelWorkbook(book, summary, edits, profile, exportPrefs);
        }}
        onDownloadCsv={() => {
          onActionLoading?.();
          handleDownloadCsv();
        }}
      />

      {/* Backup JSON Modal */}
      {backupOpen && (
        <div
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-800/60 p-4 backdrop-blur-xs"
          onClick={() => setBackupOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Save or restore calculator entries"
        >
          <div
            className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-700">
              <h3 className="text-base font-bold text-slate-800 dark:text-white">
                Save or Restore Entries (JSON Backup)
              </h3>
              <button
                type="button"
                onClick={() => setBackupOpen(false)}
                aria-label="Close modal"
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              Your entries automatically save in this browser. Copy the text below to keep a portable backup, or paste a previously saved backup and click <strong>Restore Entries</strong>.
            </p>
            <textarea
              value={backupText}
              onChange={(e) => {
                setBackupText(e.target.value);
                setBackupError('');
              }}
              rows={7}
              spellCheck={false}
              className="mt-3 w-full rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-800 focus:border-orange-600 focus:outline-none dark:border-slate-600 dark:bg-[#0F172A] dark:text-slate-200"
            />
            {backupError && (
              <p className="mt-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
                {backupError}
              </p>
            )}
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setBackupOpen(false)}
                className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleCopyBackup}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy Backup'}
              </button>
              <button
                type="button"
                onClick={handleLoadBackup}
                className="rounded-lg bg-sky-700 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-800 dark:bg-sky-600 dark:hover:bg-sky-500"
              >
                Restore Entries
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
