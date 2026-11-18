import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Calculator,
  ChevronRight,
  FileDown,
  FileSpreadsheet,
  Percent,
  Target,
  Zap,
} from 'lucide-react';
import { AdPlacement } from '../components/AdPlacement';
import { SITE_CONFIG, type AppRoute } from '../data/siteConfig';
import {
  IT_SHEET,
  MONTH_COLS,
  computeAdvancedTaxInsights,
  createBookFromEdits,
  extractTaxSummary,
  formatINR,
  getAnnualEvenBreakdown,
  type EditsMap,
} from '../engine/calculatorAdapter';
import type { CookieConsentState } from '../engine/cookieConsent';
import { downloadPdfReport } from '../engine/exportImport';

interface BreakEvenPlannerPageProps {
  cookieConsent?: CookieConsentState;
  onOpenCookieSettings?: () => void;
  onNavigate: (
    route: AppRoute,
    options?: {
      calculatorFocus?:
        | { mode: 'guided'; sectionId: string }
        | { mode: 'sheet'; sheetName: string };
      prefillEdits?: EditsMap;
    },
  ) => void;
  onActionLoading?: () => void;
}

export const BreakEvenPlannerPage: React.FC<BreakEvenPlannerPageProps> = ({
  cookieConsent,
  onOpenCookieSettings,
  onNavigate,
  onActionLoading,
}) => {
  const [grossSalary, setGrossSalary] = useState<number>(1500000);
  const [metro, setMetro] = useState<'M' | 'N'>('M');
  const [rentPaid, setRentPaid] = useState<number>(300000);
  const [sec80C, setSec80C] = useState<number>(150000);
  const [sec80D, setSec80D] = useState<number>(25000);
  const [npsEmployee, setNpsEmployee] = useState<number>(0);
  const [npsEmployer, setNpsEmployer] = useState<number>(0);

  const prefillEdits = useMemo<EditsMap>(() => {
    const basicAnnual = Math.round(grossSalary * 0.6);
    const hraAnnual = Math.round(grossSalary * 0.3);
    const specialAnnual = Math.max(0, grossSalary - basicAnnual - hraAnnual);

    const basicMo = getAnnualEvenBreakdown(basicAnnual);
    const hraMo = getAnnualEvenBreakdown(hraAnnual);
    const specialMo = getAnnualEvenBreakdown(specialAnnual);
    const rentMo = getAnnualEvenBreakdown(rentPaid);
    const ptMo = getAnnualEvenBreakdown(2400);

    const autoEpf = Math.round(basicAnnual * 0.12);
    const remainingPpf = Math.max(0, sec80C - autoEpf);

    const sheetEdits: Record<string, string | number> = {
      AB52: metro,
      N67: sec80D,
      N81: remainingPpf,
      N80: npsEmployee,
      N87: npsEmployer,
    };

    MONTH_COLS.forEach((col, i) => {
      sheetEdits[`${col}4`] = basicMo[i];
      sheetEdits[`${col}7`] = hraMo[i];
      sheetEdits[`${col}13`] = specialMo[i];
      sheetEdits[`${col}27`] = rentMo[i];
      sheetEdits[`${col}23`] = ptMo[i];
    });

    return { [IT_SHEET]: sheetEdits };
  }, [grossSalary, metro, rentPaid, sec80C, sec80D, npsEmployee, npsEmployer]);

  const summary = useMemo(() => {
    const book = createBookFromEdits(prefillEdits);
    return extractTaxSummary(book);
  }, [prefillEdits]);

  const advanced = useMemo(
    () => computeAdvancedTaxInsights(prefillEdits, summary),
    [prefillEdits, summary],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="no-print flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('/');
          }}
          className="hover:text-orange-700 dark:hover:text-orange-400"
        >
          Home
        </a>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-semibold text-slate-800 dark:text-slate-200">
          Break-Even &amp; Tax Optimizer
        </span>
      </nav>

      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6 dark:border-slate-800">
        <div className="max-w-3xl space-y-2">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-bold uppercase tracking-wider text-orange-700 dark:text-orange-400">
            <span>{SITE_CONFIG.financialYear}</span>
            <span aria-hidden="true">&middot;</span>
            <span>{SITE_CONFIG.assessmentYear}</span>
            <span aria-hidden="true">&middot;</span>
            <span>Live Binary-Search Optimizer</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-800 sm:text-3xl dark:text-white text-balance">
            Break-Even Deduction &amp; Marginal Tax Rate Planner
          </h1>
          <p className="text-sm leading-relaxed text-slate-600 sm:text-base dark:text-slate-300">
            Find your exact Old vs New Tax Regime break-even deduction threshold, inspect how much tax your next ₹1,00,000 raise triggers, and simulate NPS &amp; health insurance savings live.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('/income-tax-calculator', { prefillEdits })}
            className="tactile-btn inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-xs font-extrabold text-white hover:bg-orange-700"
          >
            <Calculator className="h-4 w-4" />
            Open in Full Calculator
          </button>
          <button
            type="button"
            onClick={() => {
              onActionLoading?.();
              downloadPdfReport(summary, advanced);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border-[1.5px] border-slate-700 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 transition hover:bg-orange-50 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
          >
            <FileDown className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            Download PDF
          </button>
        </div>
      </header>

      {/* Interactive Inputs */}
      <section className="tactile-card rounded-2xl bg-white p-6 dark:bg-slate-800">
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-8">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label
                  htmlFor="planner-gross"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300"
                >
                  Annual Gross Salary (₹)
                </label>
                <input
                  id="planner-gross"
                  type="number"
                  min={0}
                  step={50000}
                  value={grossSalary}
                  onChange={(e) => setGrossSalary(Math.max(0, Number(e.target.value) || 0))}
                  className="mt-1 w-full rounded-lg border-[1.5px] border-slate-700 bg-[#FAF9F5] px-3 py-2 text-sm font-bold text-slate-800 tabular-nums focus:border-orange-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                />
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {[1275000, 1500000, 2000000, 2500000, 3500000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setGrossSalary(amt)}
                      className={`rounded border px-2 py-0.5 text-[11px] font-semibold tabular-nums transition ${
                        grossSalary === amt
                          ? 'border-orange-700 bg-orange-600 text-white'
                          : 'border-slate-300 bg-white text-slate-700 hover:border-orange-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      ₹{(amt / 100000).toFixed(amt % 100000 === 0 ? 0 : 2)}L
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="planner-rent"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300"
                >
                  Annual Rent Paid (₹)
                </label>
                <input
                  id="planner-rent"
                  type="number"
                  min={0}
                  step={12000}
                  value={rentPaid}
                  onChange={(e) => setRentPaid(Math.max(0, Number(e.target.value) || 0))}
                  className="mt-1 w-full rounded-lg border-[1.5px] border-slate-700 bg-[#FAF9F5] px-3 py-2 text-sm font-bold text-slate-800 tabular-nums focus:border-orange-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                />
                <div className="mt-1.5 flex items-center gap-1.5">
                  {(['M', 'N'] as const).map((city) => (
                    <button
                      key={city}
                      type="button"
                      onClick={() => setMetro(city)}
                      className={`rounded border px-2.5 py-0.5 text-[11px] font-semibold transition ${
                        metro === city
                          ? 'border-slate-700 bg-slate-700 text-white dark:border-orange-500 dark:bg-orange-600'
                          : 'border-slate-300 bg-white text-slate-700 hover:border-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {city === 'M' ? 'Metro (50%)' : 'Non-Metro (40%)'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="planner-80c"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300"
                >
                  Sec 80C Investments (₹)
                </label>
                <input
                  id="planner-80c"
                  type="number"
                  min={0}
                  max={150000}
                  step={10000}
                  value={sec80C}
                  onChange={(e) => setSec80C(Math.max(0, Number(e.target.value) || 0))}
                  className="mt-1 w-full rounded-lg border-[1.5px] border-slate-700 bg-[#FAF9F5] px-3 py-2 text-sm font-bold text-slate-800 tabular-nums focus:border-orange-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label
                  htmlFor="planner-80d"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300"
                >
                  Sec 80D Health Policy (₹)
                </label>
                <input
                  id="planner-80d"
                  type="number"
                  min={0}
                  step={5000}
                  value={sec80D}
                  onChange={(e) => setSec80D(Math.max(0, Number(e.target.value) || 0))}
                  className="mt-1 w-full rounded-lg border-[1.5px] border-slate-700 bg-[#FAF9F5] px-3 py-2 text-sm font-bold text-slate-800 tabular-nums focus:border-orange-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label
                  htmlFor="planner-nps-emp"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300"
                >
                  Employee NPS 80CCD(1B) (₹)
                </label>
                <input
                  id="planner-nps-emp"
                  type="number"
                  min={0}
                  max={50000}
                  step={5000}
                  value={npsEmployee}
                  onChange={(e) => setNpsEmployee(Math.min(50000, Math.max(0, Number(e.target.value) || 0)))}
                  className="mt-1 w-full rounded-lg border-[1.5px] border-slate-700 bg-[#FAF9F5] px-3 py-2 text-sm font-bold text-slate-800 tabular-nums focus:border-orange-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label
                  htmlFor="planner-nps-empr"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300"
                >
                  Employer NPS 80CCD(2) (₹)
                </label>
                <input
                  id="planner-nps-empr"
                  type="number"
                  min={0}
                  step={10000}
                  value={npsEmployer}
                  onChange={(e) => setNpsEmployer(Math.max(0, Number(e.target.value) || 0))}
                  className="mt-1 w-full rounded-lg border-[1.5px] border-slate-700 bg-[#FAF9F5] px-3 py-2 text-sm font-bold text-slate-800 tabular-nums focus:border-orange-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Live Summary Snapshot */}
          <div className="flex flex-col justify-between rounded-xl border-[1.5px] border-slate-700 bg-[#FAF9F5] p-4 dark:border-slate-600 dark:bg-[#0F172A]/70 lg:col-span-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2 dark:border-slate-700">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Live Tax Comparison
                </span>
                <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400">
                  {summary.recommendedRegime === 'equal'
                    ? 'Equal'
                    : `${summary.recommendedRegime === 'new' ? 'New' : 'Old'} Regime Wins`}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Old Regime Tax
                  </div>
                  <div className="mt-0.5 text-lg font-extrabold tabular-nums text-slate-800 dark:text-white">
                    {formatINR(summary.oldTotalTax)}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    New Regime Tax
                  </div>
                  <div className="mt-0.5 text-lg font-extrabold tabular-nums text-slate-800 dark:text-white">
                    {formatINR(summary.newTotalTax)}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-orange-300 bg-orange-50 px-3 py-2 text-xs font-bold text-orange-900 dark:border-orange-700 dark:bg-orange-950/40 dark:text-orange-200">
                <span>Annual Savings</span>
                <span className="tabular-nums">{formatINR(summary.taxSavings)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                onNavigate('/income-tax-calculator', {
                  calculatorFocus: { mode: 'sheet', sheetName: 'IT 2026-27' },
                  prefillEdits,
                })
              }
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border-[1.5px] border-slate-700 bg-white px-3 py-2 text-xs font-bold text-slate-800 transition hover:bg-orange-50 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
              Inspect in 10-Tab Workbook
            </button>
          </div>
        </div>
      </section>

      {/* Cashflow Split Visualizer */}
      <section className="tactile-card rounded-2xl bg-white p-6 dark:bg-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-700">
          <div>
            <h2 className="text-base font-extrabold text-slate-800 dark:text-white">
              Annual CTC-to-Take-Home Cashflow Split ({formatINR(grossSalary)} Gross)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Visualizes Net Take-Home Pay, EPF Corpus (12% Basic), and Annual Income Tax + PT under each regime.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-[11px] font-bold text-slate-700 dark:text-slate-300">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-emerald-500 border border-slate-700/40" />
              Net Take-Home
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-sky-500 border border-slate-700/40" />
              EPF Corpus
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-orange-500 border border-slate-700/40" />
              Income Tax + PT
            </span>
          </div>
        </div>

        <div className="mt-4 grid gap-5 md:grid-cols-2">
          {[
            {
              label: 'New Tax Regime Cashflow',
              takeHome: advanced.annualNetTakeHomeNew,
              tax: summary.newTotalTax,
              isWinner: summary.recommendedRegime === 'new',
            },
            {
              label: 'Old Tax Regime Cashflow',
              takeHome: advanced.annualNetTakeHomeOld,
              tax: summary.oldTotalTax,
              isWinner: summary.recommendedRegime === 'old',
            },
          ].map((row) => {
            const total = Math.max(1, row.takeHome + advanced.annualEpfVpf + row.tax + 2400);
            const takePct = (row.takeHome / total) * 100;
            const epfPct = (advanced.annualEpfVpf / total) * 100;
            const taxPct = ((row.tax + 2400) / total) * 100;
            return (
              <div
                key={row.label}
                className={`rounded-xl border p-4 ${
                  row.isWinner
                    ? 'border-emerald-600 bg-emerald-50/40 dark:border-emerald-700 dark:bg-emerald-950/20'
                    : 'border-slate-200 bg-[#FAF9F5] dark:border-slate-700 dark:bg-[#0F172A]/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-slate-800 dark:text-white">
                    {row.label}
                  </span>
                  <span className="text-xs font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                    {formatINR(Math.round(row.takeHome / 12))}/mo in hand
                  </span>
                </div>

                <div className="mt-2.5 flex h-4 w-full overflow-hidden rounded-lg border border-slate-700/80 bg-slate-200 dark:border-slate-600 dark:bg-slate-700">
                  <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${takePct}%` }} />
                  <div className="h-full bg-sky-500 transition-all duration-300" style={{ width: `${epfPct}%` }} />
                  <div className="h-full bg-orange-500 transition-all duration-300" style={{ width: `${taxPct}%` }} />
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] tabular-nums">
                  <div>
                    <div className="text-slate-500 dark:text-slate-400">Take-Home</div>
                    <div className="font-extrabold text-slate-800 dark:text-white">{formatINR(row.takeHome)}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 dark:text-slate-400">EPF Savings</div>
                    <div className="font-bold text-sky-700 dark:text-sky-400">{formatINR(advanced.annualEpfVpf)}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 dark:text-slate-400">Annual Tax</div>
                    <div className="font-bold text-orange-700 dark:text-orange-400">{formatINR(row.tax)}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Mid-Page Ad Placement */}
      <AdPlacement
        slotId="planner-mid-banner"
        variant="leaderboard"
        consent={cookieConsent}
        onAdvertiseClick={() => onNavigate('/contact-us')}
        onManageCookiePrefs={onOpenCookieSettings}
      />

      {/* 3 Diagnostic Cards */}
      <section className="grid gap-5 lg:grid-cols-3">
        {/* Card 1 */}
        <div className="tactile-card flex flex-col justify-between rounded-2xl bg-white p-6 dark:bg-slate-800">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border-[1.5px] border-orange-500 bg-orange-100 text-orange-800 dark:bg-orange-600 dark:text-white">
                <Percent className="h-5 w-5" />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Slab + 4% Cess Probe
              </span>
            </div>
            <h2 className="mt-4 text-base font-extrabold text-slate-800 dark:text-white">
              Effective vs Next-₹1L Marginal Rate
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              Measures your overall tax ratio and how much extra tax applies to your next ₹1,00,000 bonus or raise.
            </p>
            <div className="mt-4 space-y-2.5 text-xs">
              <div className="rounded-xl border border-slate-200 bg-[#FAF9F5] p-3 dark:border-slate-700 dark:bg-[#0F172A]/60">
                <div className="flex items-center justify-between font-bold text-slate-800 dark:text-white">
                  <span>New Tax Regime</span>
                  <span className="tabular-nums">
                    {advanced.newEffectiveRatePct.toFixed(1)}% Eff &middot;{' '}
                    <span className="text-orange-700 dark:text-orange-400">
                      {advanced.newMarginalRatePct.toFixed(1)}% Marginal
                    </span>
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-slate-600 tabular-nums dark:text-slate-400">
                  Next ₹1,00,000 raise adds {formatINR(advanced.newNext1LTax)} tax
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-[#FAF9F5] p-3 dark:border-slate-700 dark:bg-[#0F172A]/60">
                <div className="flex items-center justify-between font-bold text-slate-800 dark:text-white">
                  <span>Old Tax Regime</span>
                  <span className="tabular-nums">
                    {advanced.oldEffectiveRatePct.toFixed(1)}% Eff &middot;{' '}
                    <span className="text-slate-700 dark:text-slate-300">
                      {advanced.oldMarginalRatePct.toFixed(1)}% Marginal
                    </span>
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-slate-600 tabular-nums dark:text-slate-400">
                  Next ₹1,00,000 raise adds {formatINR(advanced.oldNext1LTax)} tax
                </div>
              </div>
            </div>
          </div>
          {advanced.newMarginalRatePct > 35 && (
            <div className="mt-4 rounded-lg border border-orange-300 bg-orange-50 p-2.5 text-[11px] font-semibold text-orange-900 dark:border-orange-800/70 dark:bg-orange-950/40 dark:text-orange-200">
              Sec 87A Cliff Alert: Right above ₹12L taxable income, marginal relief creates a sharp tax step on your next raise.
            </div>
          )}
        </div>

        {/* Card 2 */}
        <div className="tactile-card flex flex-col justify-between rounded-2xl bg-white p-6 dark:bg-slate-800">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border-[1.5px] border-sky-500 bg-sky-100 text-sky-800 dark:bg-sky-600 dark:text-white">
                <Target className="h-5 w-5" />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Binary-Search Solver
              </span>
            </div>
            <h2 className="mt-4 text-base font-extrabold text-slate-800 dark:text-white">
              Old vs New Break-Even Threshold
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              Exact additional Old-Regime deductions needed for the Old Regime to beat your New Regime tax bill.
            </p>
            <div className="mt-4 rounded-xl border border-slate-200 bg-[#FAF9F5] p-4 dark:border-slate-700 dark:bg-[#0F172A]/60">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Current Old Exemptions &amp; Deductions
              </div>
              <div className="mt-0.5 text-lg font-extrabold text-slate-800 tabular-nums dark:text-white">
                {formatINR(advanced.totalOldDeductionsAlreadyClaimed)}
              </div>

              <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-700">
                {grossSalary <= 0 ? (
                  <div className="text-xs text-slate-500">Enter salary above to compute break-even.</div>
                ) : advanced.breakEvenExtraDeduction === 0 ? (
                  <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    Old Regime already beats or matches New Regime by{' '}
                    <span className="tabular-nums">{formatINR(summary.taxSavings)}</span>.
                  </div>
                ) : advanced.breakEvenExtraDeduction !== null ? (
                  <>
                    <div className="text-[11px] font-semibold text-orange-700 dark:text-orange-400">
                      Extra Deduction Needed to Beat New Regime
                    </div>
                    <div className="mt-0.5 text-2xl font-extrabold text-slate-800 tabular-nums dark:text-white">
                      +{formatINR(advanced.breakEvenExtraDeduction)}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-600 tabular-nums dark:text-slate-400">
                      Break-even total Old deductions:{' '}
                      <strong>{formatINR(advanced.breakEvenTotalOldDeductions ?? 0)}</strong>
                    </div>
                  </>
                ) : (
                  <div className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                    New Regime tax is already <strong>₹0</strong> under Section 87A (up to ₹12,00,000 taxable income).
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="mt-4 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Evaluated directly via live FY 2026-27 workbook formulas.
          </div>
        </div>

        {/* Card 3 */}
        <div className="tactile-card flex flex-col justify-between rounded-2xl bg-white p-6 dark:bg-slate-800">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border-[1.5px] border-emerald-500 bg-emerald-100 text-emerald-800 dark:bg-emerald-600 dark:text-white">
                <Zap className="h-5 w-5" />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                What-If Savings Levers
              </span>
            </div>
            <h2 className="mt-4 text-base font-extrabold text-slate-800 dark:text-white">
              Instant Tax-Saving Simulations
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              Incremental tax reduction from activating these payroll or Chapter VI-A levers:
            </p>
            <div className="mt-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-[#FAF9F5] p-3 dark:border-slate-700 dark:bg-[#0F172A]/60">
                <div>
                  <div className="font-bold text-slate-800 dark:text-white">Employer NPS 80CCD(2) (+₹50k)</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Works in BOTH regimes</div>
                </div>
                <div className="text-right font-extrabold tabular-nums text-emerald-700 dark:text-emerald-400">
                  -{formatINR(advanced.npsEmployerNewRegimeSaved)}
                  <div className="text-[10px] font-medium text-slate-500">New Regime</div>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-[#FAF9F5] p-3 dark:border-slate-700 dark:bg-[#0F172A]/60">
                <div>
                  <div className="font-bold text-slate-800 dark:text-white">Employee NPS 80CCD(1B) (+₹50k)</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Old-Regime Tier-I NPS</div>
                </div>
                <div className="text-right font-extrabold tabular-nums text-slate-800 dark:text-white">
                  {npsEmployee >= 50000 ? 'Maxed' : `-${formatINR(advanced.npsEmployeeOldRegimeSaved)}`}
                  <div className="text-[10px] font-medium text-slate-500">Old Regime</div>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-[#FAF9F5] p-3 dark:border-slate-700 dark:bg-[#0F172A]/60">
                <div>
                  <div className="font-bold text-slate-800 dark:text-white">Sec 80D Health Policy (₹25k)</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Self &amp; family cover</div>
                </div>
                <div className="text-right font-extrabold tabular-nums text-slate-800 dark:text-white">
                  {sec80D >= 25000 ? 'Active' : `-${formatINR(advanced.health80DOldRegimeSaved)}`}
                  <div className="text-[10px] font-medium text-slate-500">Old Regime</div>
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              onNavigate('/income-tax-calculator', {
                prefillEdits,
                calculatorFocus: { mode: 'guided', sectionId: 'section-deductions' },
              })
            }
            className="tactile-btn mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-orange-700"
          >
            Add Home Loan &amp; Capital Gains
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </section>
    </div>
  );
};
