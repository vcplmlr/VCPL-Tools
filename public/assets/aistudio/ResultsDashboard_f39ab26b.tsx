import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileDown,
  FileSpreadsheet,
  FolderOpen,
  Info,
  Percent,
  Printer,
  RotateCcw,
  SlidersHorizontal,
  Target,
  TrendingDown,
  Upload,
  Zap,
} from 'lucide-react';
import {
  IT_SHEET,
  buildCsvSummary,
  computeAdvancedTaxInsights,
  formatINR,
  type EditsMap,
  type TaxSummarySnapshot,
} from '../engine/calculatorAdapter';
import { downloadExcelWorkbook, downloadPdfReport } from '../engine/exportImport';
import {
  formatPanDisplay,
  type ExportPreferences,
  type TaxpayerEmployerProfile,
} from '../engine/profileMeta';
import type { Book, XlScalar } from '../engine/xlEngine';

interface ResultsDashboardProps {
  summary: TaxSummarySnapshot;
  book?: Book;
  edits?: EditsMap;
  profile?: TaxpayerEmployerProfile;
  exportPrefs?: ExportPreferences;
  onOpenExportStudio?: () => void;
  onCommitCell?: (sheetName: string, addr: string, value: XlScalar) => void;
  onTriggerExcelUpload?: () => void;
  onOpenBackupModal: () => void;
  onResetAll: () => void;
  onActionLoading?: () => void;
}

export const ResultsDashboard: React.FC<ResultsDashboardProps> = ({
  summary,
  book,
  edits,
  profile,
  exportPrefs,
  onOpenExportStudio,
  onCommitCell,
  onTriggerExcelUpload,
  onOpenBackupModal,
  onResetAll,
  onActionLoading,
}) => {
  const [showSlabs, setShowSlabs] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const hasIncome = summary.oldGrossTotalIncome > 0 || summary.newGrossTotalIncome > 0;
  const maxTax = Math.max(summary.oldTotalTax, summary.newTotalTax, 1);

  const advanced = useMemo(
    () => (hasIncome && edits ? computeAdvancedTaxInsights(edits, summary) : null),
    [hasIncome, edits, summary],
  );

  const maskedPan = profile?.pan
    ? formatPanDisplay(profile.pan, Boolean(exportPrefs?.maskPanInExports))
    : '';

  const handleDownloadCsv = () => {
    const csv = buildCsvSummary(
      summary,
      profile
        ? {
            ...profile,
            pan: maskedPan,
          }
        : undefined,
    );
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

  const oldTotalDeductions =
    summary.oldStandardDeduction +
    summary.oldSec10Exemptions +
    summary.oldChapter6A +
    summary.oldSec80C;
  const newTotalDeductions =
    summary.newStandardDeduction + summary.newSec10Exemptions + summary.newSec80CCD2;

  return (
    <section
      id="results-dashboard"
      className="tactile-card scroll-mt-24 space-y-6 rounded-2xl bg-white p-5 sm:p-6 dark:bg-slate-800"
    >
      {/* Header & Working Export Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-700">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-white">
            Tax Computation &amp; Regime Comparison ({summary.fyLabel || 'FY 2026-27'})
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {summary.employeeName ? `Prepared for ${summary.employeeName} · ` : ''}
            {maskedPan ? `PAN ${maskedPan} · ` : ''}
            {profile?.companyName ? `${profile.companyName} · ` : ''}
            Assessment Year 2027-28 &middot; Live output from workbook engine
          </p>
        </div>

        <div className="no-print flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              onActionLoading?.();
              downloadPdfReport(summary, advanced, profile, exportPrefs, book);
            }}
            className="tactile-btn inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-orange-600"
          >
            <FileDown className="h-3.5 w-3.5" />
            Download PDF
          </button>

          {book && (
            <button
              type="button"
              onClick={() => {
                onActionLoading?.();
                downloadExcelWorkbook(book, summary, edits || {}, profile, exportPrefs);
              }}
              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border-[1.5px] border-slate-700 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 transition hover:bg-emerald-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              Download Excel (.xlsx)
            </button>
          )}

          {onOpenExportStudio && (
            <button
              type="button"
              onClick={onOpenExportStudio}
              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-[#FAF9F5] px-3 py-1.5 text-xs font-bold text-slate-800 transition hover:bg-orange-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
              Export Options
            </button>
          )}

          {onTriggerExcelUpload && (
            <button
              type="button"
              onClick={onTriggerExcelUpload}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <Upload className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
              Upload Excel
            </button>
          )}

          <button
            type="button"
            onClick={handleDownloadCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Download className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
            CSV
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Printer className="h-3.5 w-3.5" />
            Print
          </button>

          <button
            type="button"
            onClick={onOpenBackupModal}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            Backup JSON
          </button>

          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 dark:border-slate-700 dark:bg-slate-800 dark:text-rose-400 dark:hover:bg-rose-950/40"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setConfirmReset(false);
                onResetAll();
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-800"
            >
              Confirm Reset
            </button>
          )}
        </div>
      </div>

      {/* Winner Banner */}
      <div
        className={`print-break-avoid flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4 ${
          !hasIncome
            ? 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-[#0F172A]/60'
            : summary.recommendedRegime === 'equal'
              ? 'border-sky-200 bg-sky-50/70 dark:border-sky-800 dark:bg-sky-950/40'
              : 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-800/70 dark:bg-emerald-950/30'
        }`}
      >
        <div className="flex items-start gap-3">
          {hasIncome ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400" />
          ) : (
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-700 dark:text-sky-400" />
          )}
          <div>
            {!hasIncome ? (
              <>
                <div className="text-sm font-bold text-slate-800 dark:text-white">
                  Enter your salary or load the ₹15L sample profile above to compare regimes
                </div>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                  Both Old and New Tax Regimes are calculated live as you update any salary, deduction, or capital gains field.
                </p>
              </>
            ) : summary.recommendedRegime === 'equal' ? (
              <>
                <div className="text-sm font-bold text-slate-800 dark:text-white">
                  Both regimes result in identical total tax ({formatINR(summary.newTotalTax)})
                </div>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                  With your current income and deductions, tax liability is equal under both options.
                </p>
              </>
            ) : (
              <>
                <div className="text-sm font-bold text-slate-800 dark:text-white">
                  {summary.recommendedRegime === 'new' ? 'New Tax Regime' : 'Old Tax Regime'} saves
                  you{' '}
                  <span className="text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {formatINR(summary.taxSavings)}
                  </span>{' '}
                  in total tax
                </div>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                  Estimated total tax is{' '}
                  <strong className="tabular-nums">
                    {formatINR(
                      summary.recommendedRegime === 'new' ? summary.newTotalTax : summary.oldTotalTax,
                    )}
                  </strong>{' '}
                  under the {summary.recommendedRegime === 'new' ? 'New' : 'Old'} Regime versus{' '}
                  <strong className="tabular-nums">
                    {formatINR(
                      summary.recommendedRegime === 'new' ? summary.oldTotalTax : summary.newTotalTax,
                    )}
                  </strong>{' '}
                  under the {summary.recommendedRegime === 'new' ? 'Old' : 'New'} Regime.
                </p>
              </>
            )}
          </div>
        </div>

        {hasIncome && summary.recommendedRegime !== 'equal' && (
          <div className="flex items-center gap-2 text-right">
            <TrendingDown className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Annual Tax Savings
              </div>
              <div className="text-lg font-extrabold text-emerald-700 tabular-nums dark:text-emerald-400">
                {formatINR(summary.taxSavings)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Side-by-Side Regime Cards */}
      <div className="print-break-avoid grid gap-4 md:grid-cols-2">
        {/* Old Regime Card */}
        <div
          className={`rounded-xl border p-4 transition ${
            hasIncome && summary.recommendedRegime === 'old'
              ? 'border-emerald-400 bg-emerald-50/30 ring-1 ring-emerald-400/40 dark:border-emerald-700 dark:bg-emerald-950/20'
              : 'border-slate-200 bg-slate-50/50 dark:border-slate-700 dark:bg-[#0F172A]/40'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold text-slate-800 dark:text-white">
              Old Tax Regime
            </span>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {hasIncome && summary.recommendedRegime === 'old'
                ? 'Lower Tax Option'
                : 'With Full Exemptions & 80C/80D'}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Total Tax Liability</div>
              <div className="mt-0.5 text-2xl font-extrabold text-slate-800 tabular-nums dark:text-white">
                {formatINR(summary.oldTotalTax)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Net Taxable Income</div>
              <div className="mt-0.5 text-lg font-bold text-slate-800 tabular-nums dark:text-slate-200">
                {formatINR(summary.oldTaxableIncome)}
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-200/80 pt-3 text-xs dark:border-slate-700">
            <div>
              <div className="text-slate-500 dark:text-slate-400">
                {summary.oldTaxDue < 0 ? 'Estimated Tax Refund' : `Tax / Rem. Month (${summary.remainingMonths}m)`}
              </div>
              <div className="mt-0.5 font-bold text-slate-800 tabular-nums dark:text-white">
                {formatINR(summary.oldMonthlyTax)}
              </div>
            </div>
            <div>
              <div className="text-slate-500 dark:text-slate-400">Est. Monthly Take-Home</div>
              <div className="mt-0.5 font-bold text-sky-700 tabular-nums dark:text-sky-400">
                {formatINR(summary.estimatedMonthlyTakeHomeOld)}
              </div>
            </div>
          </div>
        </div>

        {/* New Regime Card */}
        <div
          className={`rounded-xl border p-4 transition ${
            hasIncome && summary.recommendedRegime === 'new'
              ? 'border-emerald-400 bg-emerald-50/30 ring-1 ring-emerald-400/40 dark:border-emerald-700 dark:bg-emerald-950/20'
              : 'border-slate-200 bg-slate-50/50 dark:border-slate-700 dark:bg-[#0F172A]/40'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold text-slate-800 dark:text-white">
              New Tax Regime (Default)
            </span>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {hasIncome && summary.recommendedRegime === 'new'
                ? 'Lower Tax Option'
                : '₹75k Std Ded + Lower Slabs'}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Total Tax Liability</div>
              <div className="mt-0.5 text-2xl font-extrabold text-slate-800 tabular-nums dark:text-white">
                {formatINR(summary.newTotalTax)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Net Taxable Income</div>
              <div className="mt-0.5 text-lg font-bold text-slate-800 tabular-nums dark:text-slate-200">
                {formatINR(summary.newTaxableIncome)}
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-200/80 pt-3 text-xs dark:border-slate-700">
            <div>
              <div className="text-slate-500 dark:text-slate-400">
                {summary.newTaxDue < 0 ? 'Estimated Tax Refund' : `Tax / Rem. Month (${summary.remainingMonths}m)`}
              </div>
              <div className="mt-0.5 font-bold text-slate-800 tabular-nums dark:text-white">
                {formatINR(summary.newMonthlyTax)}
              </div>
            </div>
            <div>
              <div className="text-slate-500 dark:text-slate-400">Est. Monthly Take-Home</div>
              <div className="mt-0.5 font-bold text-sky-700 tabular-nums dark:text-sky-400">
                {formatINR(summary.estimatedMonthlyTakeHomeNew)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Comparison Bars */}
      {hasIncome && (
        <div className="print-break-avoid rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-[#0F172A]/40">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Visual Tax Liability Comparison
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              Deductions Claimed: Old {formatINR(oldTotalDeductions)} vs New{' '}
              {formatINR(newTotalDeductions)}
            </span>
          </div>
          <div className="space-y-3">
            <div>
              <div className="mb-1 flex justify-between text-xs font-medium text-slate-700 dark:text-slate-300">
                <span>Old Tax Regime</span>
                <span className="tabular-nums font-bold">{formatINR(summary.oldTotalTax)}</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className="h-full rounded-full bg-slate-600 transition-all duration-300 dark:bg-slate-400"
                  style={{ width: `${Math.min(100, (summary.oldTotalTax / maxTax) * 100)}%` }}
                />
              </div>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs font-medium text-slate-700 dark:text-slate-300">
                <span>New Tax Regime</span>
                <span className="tabular-nums font-bold">{formatINR(summary.newTotalTax)}</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className="h-full rounded-full bg-orange-500 transition-all duration-300 dark:bg-orange-500"
                  style={{ width: `${Math.min(100, (summary.newTotalTax / maxTax) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Advanced Tax Optimization, Break-Even & Marginal Rate Panel */}
      {hasIncome && advanced && (
        <div className="print-break-avoid space-y-4 rounded-xl border-[1.5px] border-slate-700 bg-[#FAF9F5] p-4 sm:p-5 dark:border-slate-600 dark:bg-slate-900/60">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-700">
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-white">
                Advanced Tax Diagnostics &amp; Optimization Levers
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Computed dynamically from your current workbook inputs across all slabs and rebates.
              </p>
            </div>
            <span className="rounded-md border border-orange-300 bg-orange-100 px-2.5 py-0.5 text-[11px] font-bold text-orange-900 dark:border-orange-700 dark:bg-orange-500 dark:text-white">
              Live Sensitivity Engine
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {/* Effective & Next-1L Marginal Rate */}
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-800">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800 dark:text-white">
                <Percent className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
                Effective vs Next-₹1L Marginal Rate
              </div>
              <div className="mt-2.5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">New Regime</span>
                  <span className="font-bold tabular-nums text-slate-800 dark:text-white">
                    {advanced.newEffectiveRatePct.toFixed(1)}% Eff &middot;{' '}
                    <span className="text-orange-700 dark:text-orange-400">
                      {advanced.newMarginalRatePct.toFixed(1)}% Marg
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Old Regime</span>
                  <span className="font-bold tabular-nums text-slate-800 dark:text-white">
                    {advanced.oldEffectiveRatePct.toFixed(1)}% Eff &middot;{' '}
                    <span className="text-slate-700 dark:text-slate-300">
                      {advanced.oldMarginalRatePct.toFixed(1)}% Marg
                    </span>
                  </span>
                </div>
                <div className="border-t border-slate-100 pt-1.5 text-[11px] text-slate-500 tabular-nums dark:border-slate-700">
                  Tax on next ₹1L income: New {formatINR(advanced.newNext1LTax)} &middot; Old{' '}
                  {formatINR(advanced.oldNext1LTax)}
                </div>
              </div>
            </div>

            {/* Regime Break-Even Threshold */}
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-800">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800 dark:text-white">
                <Target className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
                Old vs New Break-Even Point
              </div>
              <div className="mt-2.5 text-xs">
                {advanced.breakEvenExtraDeduction === 0 ? (
                  <p className="font-bold text-emerald-700 dark:text-emerald-400">
                    Old Regime already matches or beats New Regime by{' '}
                    <span className="tabular-nums">{formatINR(summary.taxSavings)}</span>.
                  </p>
                ) : advanced.breakEvenExtraDeduction !== null ? (
                  <>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Extra Old deductions needed to match New Regime:
                    </div>
                    <div className="mt-0.5 text-lg font-extrabold text-slate-800 tabular-nums dark:text-white">
                      +{formatINR(advanced.breakEvenExtraDeduction)}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                      Total Old deductions needed:{' '}
                      <strong>{formatINR(advanced.breakEvenTotalOldDeductions ?? 0)}</strong>
                    </div>
                  </>
                ) : (
                  <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                    New Regime tax is already <strong>₹0</strong> (Sec 87A). Old Regime requires bringing taxable income ≤ ₹5,00,000 to equal ₹0.
                  </p>
                )}
              </div>
            </div>

            {/* Annual Take-Home & Retirement Cashflow */}
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-800">
              <div className="text-xs font-extrabold text-slate-800 dark:text-white">
                Annual Net Cashflow &amp; EPF Corpus
              </div>
              <div className="mt-2.5 space-y-1.5 text-xs tabular-nums">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">New Net Take-Home / Yr</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">
                    {formatINR(advanced.annualNetTakeHomeNew)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Old Net Take-Home / Yr</span>
                  <span className="font-bold text-slate-800 dark:text-white">
                    {formatINR(advanced.annualNetTakeHomeOld)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 pt-1.5 dark:border-slate-700">
                  <span className="text-slate-500 dark:text-slate-400">Employee EPF + VPF</span>
                  <span className="font-bold text-sky-700 dark:text-sky-400">
                    {formatINR(advanced.annualEpfVpf)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Tax-Saving Opportunities */}
          {(advanced.npsEmployerNewRegimeSaved > 0 ||
            advanced.npsEmployeeOldRegimeSaved > 0 ||
            advanced.health80DOldRegimeSaved > 0) && (
            <div className="no-print rounded-xl border border-orange-300/80 bg-white p-3.5 dark:border-orange-800/60 dark:bg-slate-800">
              <div className="mb-2.5 flex items-center gap-1.5 text-xs font-extrabold text-slate-800 dark:text-white">
                <Zap className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
                Unclaimed Tax-Saving Opportunities Detected
              </div>
              <div className="grid gap-2.5 sm:grid-cols-3">
                {advanced.npsEmployerNewRegimeSaved > 0 && (
                  <div className="flex flex-col justify-between rounded-lg border border-slate-200 bg-[#FAF9F5] p-3 text-xs dark:border-slate-700 dark:bg-slate-900/60">
                    <div>
                      <div className="font-bold text-slate-800 dark:text-white">
                        Employer NPS u/s 80CCD(2)
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-300">
                        Restructuring ₹50k to Employer NPS saves{' '}
                        <strong className="text-emerald-700 tabular-nums dark:text-emerald-400">
                          {formatINR(advanced.npsEmployerNewRegimeSaved)}
                        </strong>{' '}
                        even under New Regime (14% Basic+DA cap).
                      </p>
                    </div>
                  </div>
                )}

                {advanced.npsEmployeeOldRegimeSaved > 0 && (
                  <div className="flex flex-col justify-between gap-2 rounded-lg border border-slate-200 bg-[#FAF9F5] p-3 text-xs dark:border-slate-700 dark:bg-slate-900/60">
                    <div>
                      <div className="font-bold text-slate-800 dark:text-white">
                        Employee NPS u/s 80CCD(1B)
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-300">
                        Claiming ₹50,000 saves{' '}
                        <strong className="tabular-nums">
                          {formatINR(advanced.npsEmployeeOldRegimeSaved)}
                        </strong>{' '}
                        in Old Regime.
                      </p>
                    </div>
                    {onCommitCell && (
                      <button
                        type="button"
                        onClick={() => {
                          onActionLoading?.();
                          onCommitCell(IT_SHEET, 'N80', 50000);
                        }}
                        className="rounded-md border border-slate-700 bg-orange-500 px-2.5 py-1 text-[11px] font-extrabold text-white hover:bg-orange-600"
                      >
                        Apply ₹50,000 u/s 80CCD(1B)
                      </button>
                    )}
                  </div>
                )}

                {advanced.health80DOldRegimeSaved > 0 && (
                  <div className="flex flex-col justify-between gap-2 rounded-lg border border-slate-200 bg-[#FAF9F5] p-3 text-xs dark:border-slate-700 dark:bg-slate-900/60">
                    <div>
                      <div className="font-bold text-slate-800 dark:text-white">
                        Health Insurance u/s 80D
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-300">
                        Claiming ₹25,000 medical cover saves{' '}
                        <strong className="tabular-nums">
                          {formatINR(advanced.health80DOldRegimeSaved)}
                        </strong>{' '}
                        in Old Regime.
                      </p>
                    </div>
                    {onCommitCell && (
                      <button
                        type="button"
                        onClick={() => {
                          onActionLoading?.();
                          onCommitCell(IT_SHEET, 'N67', 25000);
                        }}
                        className="rounded-md border border-slate-700 bg-orange-500 px-2.5 py-1 text-[11px] font-extrabold text-white hover:bg-orange-600"
                      >
                        Apply ₹25,000 u/s 80D
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results Explanation */}
      <div className="print-break-avoid rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs leading-relaxed text-slate-700 dark:border-slate-700 dark:bg-[#0F172A]/60 dark:text-slate-300">
        <h3 className="mb-1.5 text-sm font-bold text-slate-800 dark:text-white">
          Understanding Your Results
        </h3>
        <ul className="list-disc space-y-1 pl-4">
          <li>
            <strong>Regime Impact:</strong> In the Old Regime, your gross salary &amp; income are reduced by{' '}
            <span className="tabular-nums font-semibold">{formatINR(oldTotalDeductions)}</span> in exemptions and deductions (Standard Deduction{' '}
            {formatINR(summary.oldStandardDeduction)}, HRA/Sec 10{' '}
            {formatINR(summary.oldSec10Exemptions)}, Chapter VI-A{' '}
            {formatINR(summary.oldChapter6A)}, and Sec 80C/NPS{' '}
            {formatINR(summary.oldSec80C)}). In the New Regime, eligible deductions total{' '}
            <span className="tabular-nums font-semibold">{formatINR(newTotalDeductions)}</span> (Standard Deduction{' '}
            {formatINR(summary.newStandardDeduction)} + Employer NPS 80CCD(2){' '}
            {formatINR(summary.newSec80CCD2)}).
          </li>
          <li>
            <strong>Estimated Monthly Tax vs. Employer TDS:</strong> &ldquo;Tax per Remaining Month&rdquo; divides your unpaid balance tax due (Total Tax minus TDS paid of{' '}
            <span className="tabular-nums font-semibold">
              {formatINR(summary.tdsSalary + summary.tdsOutsideSalary)}
            </span>
            ) across your remaining {summary.remainingMonths} months. Employer payroll TDS may differ if non-salary incomes (bank interest, dividends, capital gains) or unsubmitted proofs are included here.
          </li>
          <li>
            <strong>Monthly Take-Home Estimate:</strong> Calculated from annual salary cash earnings minus PF/VPF, Profession Tax, other salary deductions, and annual tax liability divided by 12.
          </li>
        </ul>
      </div>

      {/* Slab-wise Breakdown Toggle */}
      <div className="print-break-avoid">
        <button
          type="button"
          onClick={() => setShowSlabs((p) => !p)}
          className="no-print text-xs font-semibold text-orange-700 hover:text-orange-800 dark:text-orange-400 dark:hover:text-orange-300"
        >
          {showSlabs ? 'Hide' : 'View'} Slab-by-Slab Tax Breakdown (Old vs New)
        </button>

        {showSlabs && (
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 dark:bg-slate-700 dark:text-slate-200">
                Old Regime Slab Breakdown
              </div>
              <table className="w-full text-xs">
                <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-700">
                  <tr>
                    <th className="px-3 py-1.5 text-left">Income Slab</th>
                    <th className="px-2 py-1.5 text-right">Rate</th>
                    <th className="px-2 py-1.5 text-right">Taxable</th>
                    <th className="px-3 py-1.5 text-right">Tax</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {summary.oldSlabs.map((row) => (
                    <tr key={row.slabLabel}>
                      <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300">{row.slabLabel}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">
                        {Math.round(row.rate * 100)}%
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-700 dark:text-slate-300">
                        {formatINR(row.applicableAmount)}
                      </td>
                      <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-slate-800 dark:text-white">
                        {formatINR(row.tax)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 dark:bg-slate-700 dark:text-slate-200">
                New Regime Slab Breakdown (FY 2026-27)
              </div>
              <table className="w-full text-xs">
                <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-700">
                  <tr>
                    <th className="px-3 py-1.5 text-left">Income Slab</th>
                    <th className="px-2 py-1.5 text-right">Rate</th>
                    <th className="px-2 py-1.5 text-right">Taxable</th>
                    <th className="px-3 py-1.5 text-right">Tax</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {summary.newSlabs.map((row) => (
                    <tr key={row.slabLabel}>
                      <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300">{row.slabLabel}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">
                        {Math.round(row.rate * 100)}%
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-700 dark:text-slate-300">
                        {formatINR(row.applicableAmount)}
                      </td>
                      <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-slate-800 dark:text-white">
                        {formatINR(row.tax)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Full Line-by-Line Tax Computation Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-slate-700 dark:bg-slate-700/70">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
            Full Line-by-Line Tax Computation
          </h3>
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="no-print inline-flex items-center gap-1 text-xs font-semibold text-orange-700 hover:underline dark:text-orange-400"
          >
            <Download className="h-3.5 w-3.5" />
            Export Table
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-white text-xs font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                <th className="px-4 py-2.5 text-left">Tax Computation Component</th>
                <th className="px-4 py-2.5 text-right">Old Regime</th>
                <th className="px-4 py-2.5 text-right">New Regime</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/80">
              {summary.lines.map((line) => (
                <tr
                  key={line.row}
                  className={
                    line.isTotal
                      ? 'bg-orange-50/70 font-bold text-slate-800 dark:bg-orange-950/30 dark:text-white'
                      : 'text-slate-700 hover:bg-slate-50/70 dark:text-slate-300 dark:hover:bg-slate-700/30'
                  }
                >
                  <td className="px-4 py-2">{line.label}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {line.oldFormatted ? `₹${line.oldFormatted}` : '—'}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {line.newFormatted ? `₹${line.newFormatted}` : '—'}
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-semibold text-slate-800 dark:bg-slate-700/50 dark:text-white">
                <td className="px-4 py-2.5">
                  Tax per Remaining Month ({summary.remainingMonths} months)
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatINR(summary.oldMonthlyTax)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatINR(summary.newMonthlyTax)}
                </td>
              </tr>
              <tr className="bg-slate-50 font-semibold text-emerald-700 dark:bg-slate-700/50 dark:text-emerald-300">
                <td className="px-4 py-2.5">
                  Estimated Monthly Take-Home Salary (After Tax &amp; Payroll Deductions)
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatINR(summary.estimatedMonthlyTakeHomeOld)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatINR(summary.estimatedMonthlyTakeHomeNew)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
