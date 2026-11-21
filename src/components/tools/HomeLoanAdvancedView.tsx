import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertTriangle,
  Calendar,
  Check,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  Info,
  Percent,
  Plus,
  Printer,
  RotateCcw,
  Trash2,
  TrendingDown,
} from 'lucide-react';
import {
  ImpactStrategy,
  PrepaymentEvent,
  RateChangeEvent,
  ScheduleGranularity,
  calendarMonthToEmiNumber,
  emiNumberToCalendarMonth,
  formatInrExact,
  formatMonthsAsDuration,
  simulateHomeLoan,
} from '../../utils/homeLoanEngine';
import {
  downloadBomCsv,
  downloadJsonFile,
  downloadWordDocument,
  exportStructuredReportPdf,
  printHtmlDocument,
} from '../../utils/printReport';
import { ToolExportBar } from './ToolExportBar';

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function escapeHtml(v: string | number): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export const HomeLoanAdvancedView: React.FC = () => {
  // Core Loan Setup (Clean Blank Defaults)
  const [principalInput, setPrincipalInput] = useState<string>('');
  const [annualRateInput, setAnnualRateInput] = useState<string>('');
  const [tenureUnit, setTenureUnit] = useState<'years' | 'months'>('years');
  const [tenureValueInput, setTenureValueInput] = useState<string>('');
  const [startMonth, setStartMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [globalStrategy, setGlobalStrategy] = useState<ImpactStrategy>('reduce-tenure');

  const principal = Math.max(0, Number(principalInput) || 0);
  const annualRate = Math.max(0, Number(annualRateInput) || 0);
  const tenureValue = Math.max(1, Number(tenureValueInput) || (tenureUnit === 'years' ? 20 : 240));

  // Real-World Advanced Options
  const [moratoriumMonths, setMoratoriumMonths] = useState<number>(0);
  const [annualEmiStepUpPct, setAnnualEmiStepUpPct] = useState<number>(0);
  const [extraMonthlyPrincipal, setExtraMonthlyPrincipal] = useState<number>(0);
  const [extraAnnualEmiEnabled, setExtraAnnualEmiEnabled] = useState<boolean>(false);
  const [extraAnnualEmiMonth, setExtraAnnualEmiMonth] = useState<number>(4);

  // Mid-tenure Interest Rate Changes
  const [rateChanges, setRateChanges] = useState<RateChangeEvent[]>([]);
  // Advance / Lump-Sum Prepayments
  const [prepayments, setPrepayments] = useState<PrepaymentEvent[]>([]);

  // Schedule & UI State
  const [scheduleView, setScheduleView] = useState<ScheduleGranularity>('fy');
  const [yearlySubMode, setYearlySubMode] = useState<'calendar' | 'loan'>('calendar');
  const [eventsOnlyFilter, setEventsOnlyFilter] = useState<boolean>(false);
  const [copiedSummary, setCopiedSummary] = useState<boolean>(false);

  const tenureMonths =
    tenureUnit === 'years'
      ? Math.max(1, Math.round(tenureValue * 12))
      : Math.max(1, Math.round(tenureValue));

  const sim = useMemo(
    () =>
      simulateHomeLoan({
        principal,
        annualRate,
        tenureMonths,
        startMonth,
        moratoriumMonths,
        annualEmiStepUpPct,
        extraMonthlyPrincipal,
        extraAnnualEmiEnabled,
        extraAnnualEmiMonth,
        globalStrategy,
        rateChanges,
        prepayments,
      }),
    [
      principal,
      annualRate,
      tenureMonths,
      startMonth,
      moratoriumMonths,
      annualEmiStepUpPct,
      extraMonthlyPrincipal,
      extraAnnualEmiEnabled,
      extraAnnualEmiMonth,
      globalStrategy,
      rateChanges,
      prepayments,
    ]
  );

  // Handlers for Rate Changes
  const addRateChange = () => {
    const defaultEmi = Math.min(tenureMonths, 13);
    setRateChanges((prev) => [
      ...prev,
      {
        id: uid('rc'),
        timingMode: 'calendar',
        emiNumber: defaultEmi,
        calendarMonth: emiNumberToCalendarMonth(startMonth, defaultEmi),
        newRate: Math.max(1, Number((annualRate - 0.5).toFixed(2))),
        impactStrategy: 'global',
        note: 'Floating Rate Revision',
      },
    ]);
  };

  const updateRateChange = (id: string, patch: Partial<RateChangeEvent>) => {
    setRateChanges((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, ...patch };
        if (patch.emiNumber !== undefined && patch.timingMode !== 'calendar') {
          next.calendarMonth = emiNumberToCalendarMonth(startMonth, patch.emiNumber);
        }
        if (patch.calendarMonth !== undefined && patch.timingMode !== 'emi') {
          next.emiNumber = calendarMonthToEmiNumber(startMonth, patch.calendarMonth);
        }
        return next;
      })
    );
  };

  // Handlers for Prepayments
  const addPrepayment = () => {
    const defaultEmi = Math.min(tenureMonths, 12);
    setPrepayments((prev) => [
      ...prev,
      {
        id: uid('pp'),
        timingMode: 'calendar',
        emiNumber: defaultEmi,
        calendarMonth: emiNumberToCalendarMonth(startMonth, defaultEmi),
        amount: 200000,
        penaltyPct: 0,
        impactStrategy: 'global',
        note: 'Advance Lump-Sum',
      },
    ]);
  };

  const updatePrepayment = (id: string, patch: Partial<PrepaymentEvent>) => {
    setPrepayments((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, ...patch };
        if (patch.emiNumber !== undefined && patch.timingMode !== 'calendar') {
          next.calendarMonth = emiNumberToCalendarMonth(startMonth, patch.emiNumber);
        }
        if (patch.calendarMonth !== undefined && patch.timingMode !== 'emi') {
          next.emiNumber = calendarMonthToEmiNumber(startMonth, patch.calendarMonth);
        }
        return next;
      })
    );
  };

  const handleResetAll = () => {
    setPrincipalInput('');
    setAnnualRateInput('');
    setTenureUnit('years');
    setTenureValueInput('');
    setStartMonth(new Date().toISOString().slice(0, 7));
    setGlobalStrategy('reduce-tenure');
    setMoratoriumMonths(0);
    setAnnualEmiStepUpPct(0);
    setExtraMonthlyPrincipal(0);
    setExtraAnnualEmiEnabled(false);
    setExtraAnnualEmiMonth(4);
    setRateChanges([]);
    setPrepayments([]);
    setEventsOnlyFilter(false);
  };

  const displayedMonthlyRows = useMemo(() => {
    if (!eventsOnlyFilter) return sim.monthlyRows;
    return sim.monthlyRows.filter((r) => r.events.length > 0 || r.prepaymentPaid > 0);
  }, [sim.monthlyRows, eventsOnlyFilter]);

  const activeYearlyRows =
    yearlySubMode === 'calendar' ? sim.calendarYearRows : sim.loanYearRows;

  // Build active table structure for Export CSV / PDF / Print
  const activeExportTable = useMemo(() => {
    if (scheduleView === 'monthly') {
      return {
        title: `Monthly EMI Amortization Schedule (${displayedMonthlyRows.length} Installments)`,
        headers: [
          'EMI #',
          'Month',
          'Financial Year',
          'Rate %',
          'Opening Bal (INR)',
          'EMI Paid (INR)',
          'Principal (INR)',
          'Interest (INR)',
          'Prepayment (INR)',
          'Closing Bal (INR)',
          'Events / Notes',
        ],
        rows: displayedMonthlyRows.map((r) => [
          r.emiNo,
          r.calendarLabel,
          r.financialYear,
          Number(r.annualRate.toFixed(2)),
          Math.round(r.openingBalance),
          Math.round(r.emiPaid),
          Math.round(r.principalPaid),
          Math.round(r.interestPaid),
          Math.round(r.prepaymentPaid),
          Math.round(r.closingBalance),
          r.events.join(' | '),
        ]),
        displayRows: displayedMonthlyRows.map((r) => [
          `#${r.emiNo}`,
          r.calendarLabel,
          r.financialYear,
          `${r.annualRate.toFixed(2)}%`,
          formatInrExact(r.openingBalance),
          formatInrExact(r.emiPaid),
          formatInrExact(r.principalPaid),
          formatInrExact(r.interestPaid),
          r.prepaymentPaid > 0 ? formatInrExact(r.prepaymentPaid) : '-',
          formatInrExact(r.closingBalance),
          r.events.join('; '),
        ]),
      };
    }

    const sourceRows = scheduleView === 'fy' ? sim.fyRows : activeYearlyRows;
    const periodHeading =
      scheduleView === 'fy'
        ? 'Financial Year (Apr-Mar)'
        : yearlySubMode === 'calendar'
        ? 'Calendar Year'
        : 'Loan Year';

    return {
      title: `${periodHeading} Loan Amortization & Tax Schedule (${sourceRows.length} Periods)`,
      headers: [
        periodHeading,
        'EMIs',
        'Avg Rate %',
        'Opening Bal (INR)',
        'Principal (INR)',
        'Interest (INR)',
        'Prepayments (INR)',
        'Total Outflow (INR)',
        'Closing Bal (INR)',
        'Sec 24(b) Cap (INR)',
        'Sec 80C Cap (INR)',
      ],
      rows: sourceRows.map((r) => [
        r.periodLabel,
        r.monthsCount,
        Number(r.avgRate.toFixed(2)),
        Math.round(r.openingBalance),
        Math.round(r.principalPaid),
        Math.round(r.interestPaid),
        Math.round(r.prepaymentPaid),
        Math.round(r.totalOutflow),
        Math.round(r.closingBalance),
        Math.round(r.sec24bEligibleInterest),
        Math.round(r.sec80cEligiblePrincipal),
      ]),
      displayRows: sourceRows.map((r) => [
        r.periodLabel,
        r.monthsCount,
        `${r.avgRate.toFixed(2)}%`,
        formatInrExact(r.openingBalance),
        formatInrExact(r.principalPaid),
        formatInrExact(r.interestPaid),
        r.prepaymentPaid > 0 ? formatInrExact(r.prepaymentPaid) : '-',
        formatInrExact(r.totalOutflow),
        formatInrExact(r.closingBalance),
        formatInrExact(r.sec24bEligibleInterest),
        formatInrExact(r.sec80cEligiblePrincipal),
      ]),
    };
  }, [scheduleView, yearlySubMode, displayedMonthlyRows, sim.fyRows, activeYearlyRows]);

  const handleExportCsv = () => {
    downloadBomCsv({
      filename: `home-loan-${scheduleView}-schedule.csv`,
      preambleLines: [
        ['Home Loan Amortization Report — VCPL Tools'],
        ['Loan Principal (INR)', Math.round(principal), 'Initial Interest Rate (%)', annualRate],
        ['Loan Start Month', startMonth, 'Original Tenure (Months)', tenureMonths],
        ['Initial EMI (INR)', Math.round(sim.initialEmi), 'Final EMI (INR)', Math.round(sim.finalEmi)],
        ['Actual Total Interest (INR)', Math.round(sim.actualTotalInterest), 'Interest Saved vs Baseline (INR)', Math.round(sim.interestSaved)],
        ['Actual Closure Month', sim.actualEndLabel, 'Months Saved', sim.monthsSaved],
      ],
      headers: activeExportTable.headers,
      rows: activeExportTable.rows,
    });
  };

  const handleExportXlsx = () => {
    const wb = XLSX.utils.book_new();

    const summarySheetData = [
      ['Metric', 'Value'],
      ['Loan Principal (INR)', Math.round(principal)],
      ['Initial Interest Rate (% p.a.)', annualRate],
      ['Original Tenure (Months)', tenureMonths],
      ['Loan Start Month', startMonth],
      ['Impact Strategy', globalStrategy === 'reduce-tenure' ? 'Reduce Tenure (Keep EMI)' : 'Reduce EMI (Keep Tenure)'],
      ['Moratorium Months', moratoriumMonths],
      ['Annual EMI Step-Up (%)', annualEmiStepUpPct],
      ['Extra Monthly Principal (INR)', extraMonthlyPrincipal],
      ['Annual 13th EMI Active', extraAnnualEmiEnabled ? `Yes (Month ${extraAnnualEmiMonth})` : 'No'],
      ['Initial Monthly EMI (INR)', Math.round(sim.initialEmi)],
      ['Final Monthly EMI (INR)', Math.round(sim.finalEmi)],
      ['Baseline Total Interest (INR)', Math.round(sim.baselineTotalInterest)],
      ['Actual Total Interest (INR)', Math.round(sim.actualTotalInterest)],
      ['Net Interest Saved (INR)', Math.round(sim.interestSaved)],
      ['Total Prepayments Applied (INR)', Math.round(sim.actualTotalPrepayments)],
      ['Baseline Months', sim.baselineMonths],
      ['Actual Months', sim.actualMonths],
      ['Tenure Saved (Months)', sim.monthsSaved],
      ['Original Closure Month', sim.baselineEndLabel],
      ['New Early Closure Month', sim.actualEndLabel],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summarySheetData);
    wsSummary['!cols'] = [{ wch: 36 }, { wch: 28 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    const monthlySheetData = [
      [
        'EMI #',
        'Calendar Month',
        'Financial Year',
        'Rate %',
        'Opening Balance',
        'EMI Paid',
        'Principal',
        'Interest',
        'Prepayment',
        'Penalty',
        'Total Outflow',
        'Closing Balance',
        'Events / Notes',
      ],
      ...sim.monthlyRows.map((r) => [
        r.emiNo,
        r.calendarLabel,
        r.financialYear,
        Number(r.annualRate.toFixed(2)),
        Math.round(r.openingBalance),
        Math.round(r.emiPaid),
        Math.round(r.principalPaid),
        Math.round(r.interestPaid),
        Math.round(r.prepaymentPaid),
        Math.round(r.penaltyPaid),
        Math.round(r.totalOutflow),
        Math.round(r.closingBalance),
        r.events.join(' | '),
      ]),
    ];
    const wsMonthly = XLSX.utils.aoa_to_sheet(monthlySheetData);
    wsMonthly['!cols'] = Array(13).fill({ wch: 15 });
    XLSX.utils.book_append_sheet(wb, wsMonthly, 'Monthly Schedule');

    const buildAggSheet = (rows: typeof sim.fyRows, label: string) => {
      const sheetRows = [
        [
          label,
          'Months',
          'Avg Rate %',
          'Opening Bal',
          'Principal Paid',
          'Interest Paid',
          'Prepayments',
          'Total Outflow',
          'Closing Bal',
          'Sec 24(b) Cap',
          'Sec 80C Cap',
        ],
        ...rows.map((r) => [
          r.periodLabel,
          r.monthsCount,
          Number(r.avgRate.toFixed(2)),
          Math.round(r.openingBalance),
          Math.round(r.principalPaid),
          Math.round(r.interestPaid),
          Math.round(r.prepaymentPaid),
          Math.round(r.totalOutflow),
          Math.round(r.closingBalance),
          Math.round(r.sec24bEligibleInterest),
          Math.round(r.sec80cEligiblePrincipal),
        ]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(sheetRows);
      ws['!cols'] = Array(11).fill({ wch: 16 });
      return ws;
    };

    XLSX.utils.book_append_sheet(wb, buildAggSheet(sim.fyRows, 'Financial Year'), 'FY Apr-Mar');
    XLSX.utils.book_append_sheet(wb, buildAggSheet(sim.calendarYearRows, 'Calendar Year'), 'Calendar Year');
    XLSX.utils.book_append_sheet(wb, buildAggSheet(sim.loanYearRows, 'Loan Year'), 'Loan Year');

    XLSX.writeFile(wb, `Home-Loan-Advanced-Report.xlsx`);
  };

  const handleSavePdf = () => {
    exportStructuredReportPdf({
      title: 'Home Loan Advanced Amortization & Savings Report',
      subtitle: `Principal: ${formatInrExact(principal)} | Initial Rate: ${annualRate}% p.a. | Start: ${startMonth} | Strategy: ${
        globalStrategy === 'reduce-tenure' ? 'Reduce Tenure' : 'Reduce EMI'
      }`,
      filename: `home-loan-${scheduleView}-report.pdf`,
      orientation: 'landscape',
      kpis: [
        { label: 'Initial Monthly EMI', value: formatInrExact(sim.initialEmi) },
        { label: 'Actual Total Interest', value: formatInrExact(sim.actualTotalInterest) },
        { label: 'Net Interest Saved', value: formatInrExact(sim.interestSaved) },
        {
          label: 'New Early Closure',
          value: `${sim.actualEndLabel} (${sim.monthsSaved} EMIs saved)`,
        },
      ],
      breakdown: [
        { label: 'Loan Principal Amount', value: formatInrExact(principal) },
        { label: 'Baseline Total Interest (No Prepayments)', value: formatInrExact(sim.baselineTotalInterest) },
        { label: 'Actual Total Interest Payable', value: formatInrExact(sim.actualTotalInterest) },
        { label: 'Total Advance Prepayments Applied', value: formatInrExact(sim.actualTotalPrepayments) },
        { label: 'Total Outflow (Principal + Interest + Penalty)', value: formatInrExact(sim.actualTotalOutflow) },
        { label: 'Original vs Actual Tenure', value: `${sim.baselineMonths} mos -> ${sim.actualMonths} mos` },
      ],
      notes: [
        `Rate Change Events: ${rateChanges.length} | Lump-Sum Prepayment Events: ${prepayments.length} | Step-Up: ${annualEmiStepUpPct}%/yr`,
        'Section 24(b) deduction capped at Rs. 2,00,000/yr (self-occupied Old Regime) and Section 80C at Rs. 1,50,000/yr.',
      ],
      table: {
        title: activeExportTable.title,
        headers: activeExportTable.headers,
        rows: activeExportTable.displayRows,
      },
    });
  };

  const handlePrintReport = () => {
    const headerRow = activeExportTable.headers
      .map((h) => `<th>${escapeHtml(h)}</th>`)
      .join('');
    const bodyRows = activeExportTable.displayRows
      .map(
        (row) =>
          `<tr>${row
            .map((cell, idx) => {
              const isNum = idx >= 3 && idx !== activeExportTable.headers.length - 1;
              return `<td class="${isNum ? 'num' : ''}">${escapeHtml(cell)}</td>`;
            })
            .join('')}</tr>`
      )
      .join('');

    const html = `
      <div style="border-bottom:2px solid #0f172a;padding-bottom:8px;margin-bottom:12px;">
        <h1 style="font-size:17px;">Home Loan Advanced Amortization Report</h1>
        <p style="margin:0;color:#475569;font-size:11px;">
          Principal: <strong>${escapeHtml(formatInrExact(principal))}</strong> · Initial Rate: <strong>${annualRate}% p.a.</strong> ·
          Start: <strong>${escapeHtml(startMonth)}</strong> · Original Tenure: <strong>${tenureMonths} months</strong> ·
          Mode: <strong>${globalStrategy === 'reduce-tenure' ? 'Reduce Tenure (Keep EMI)' : 'Reduce EMI (Keep Tenure)'}</strong>
        </p>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">Initial Monthly EMI</div>
          <div class="kpi-val">${escapeHtml(formatInrExact(sim.initialEmi))}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Actual Total Interest</div>
          <div class="kpi-val">${escapeHtml(formatInrExact(sim.actualTotalInterest))}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Net Interest Saved</div>
          <div class="kpi-val" style="color:#15803d;">${escapeHtml(formatInrExact(sim.interestSaved))}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Closure &amp; Tenure Saved</div>
          <div class="kpi-val">${escapeHtml(sim.actualEndLabel)} (-${sim.monthsSaved} mos)</div>
        </div>
      </div>

      <h2 style="font-size:13px;margin-top:10px;">${escapeHtml(activeExportTable.title)}</h2>
      <table>
        <thead><tr>${headerRow}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    `;

    void printHtmlDocument({
      title: `Home Loan Schedule — ${startMonth}`,
      bodyHtml: html,
      orientation: 'landscape',
      pageMargin: '10mm',
    });
  };

  const handleCopySummary = async () => {
    const lines = [
      'Home Loan Advanced Summary — VCPL Tools',
      `Loan Principal: ${formatInrExact(principal)} | Initial Rate: ${annualRate}% p.a. | Start: ${startMonth}`,
      `Initial EMI: ${formatInrExact(sim.initialEmi)} | Final EMI: ${formatInrExact(sim.finalEmi)}`,
      `Baseline Total Interest: ${formatInrExact(sim.baselineTotalInterest)}`,
      `Actual Total Interest: ${formatInrExact(sim.actualTotalInterest)}`,
      `Net Interest Saved: ${formatInrExact(sim.interestSaved)}`,
      `Tenure: ${sim.baselineMonths} mos -> ${sim.actualMonths} mos (${sim.monthsSaved} EMIs saved)`,
      `Closure Date: ${sim.actualEndLabel} (Original: ${sim.baselineEndLabel})`,
    ];
    await navigator.clipboard.writeText(lines.join('\n'));
    setCopiedSummary(true);
    window.setTimeout(() => setCopiedSummary(false), 1800);
  };

  const handleExportWord = () => {
    void downloadWordDocument({
      filename: `home-loan-${scheduleView}-schedule.docx`,
      title: 'Home Loan Amortization & Prepayment Report',
      subtitle: `Principal ${formatInrExact(principal)} | Initial Rate ${annualRate}% p.a. | Start ${startMonth} | ${activeExportTable.title}`,
      kpis: [
        { label: 'Initial Monthly EMI', value: formatInrExact(sim.initialEmi) },
        { label: 'Actual Interest', value: formatInrExact(sim.actualTotalInterest) },
        { label: 'Interest Saved', value: formatInrExact(sim.interestSaved) },
        { label: 'Loan Closure', value: sim.actualEndLabel },
      ],
      table: {
        title: activeExportTable.title,
        headers: activeExportTable.headers,
        rows: activeExportTable.displayRows.slice(0, 120),
      },
    });
  };

  const handleExportJson = () => {
    downloadJsonFile({
      filename: `home-loan-simulation-${startMonth}.json`,
      data: {
        inputs: {
          principal,
          annualRate,
          tenureUnit,
          tenureMonths,
          startMonth,
          globalStrategy,
          moratoriumMonths,
          annualEmiStepUpPct,
          extraMonthlyPrincipal,
          extraAnnualEmiEnabled,
          extraAnnualEmiMonth,
          rateChanges,
          prepayments,
        },
        summary: {
          initialEmi: sim.initialEmi,
          finalEmi: sim.finalEmi,
          baselineTotalInterest: sim.baselineTotalInterest,
          actualTotalInterest: sim.actualTotalInterest,
          interestSaved: sim.interestSaved,
          monthsSaved: sim.monthsSaved,
          actualEndLabel: sim.actualEndLabel,
        },
        schedule: activeExportTable.rows,
      },
    });
  };

  // Visual balance chart points (sampled by loan year)
  const chartPoints = useMemo(() => {
    if (sim.loanYearRows.length === 0) return [];
    return sim.loanYearRows.map((yr) => ({
      label: yr.periodLabel,
      balance: yr.closingBalance,
      interest: yr.interestPaid,
      principal: yr.principalPaid + yr.prepaymentPaid,
    }));
  }, [sim.loanYearRows]);

  return (
    <div className="space-y-6 font-sans">
      {/* Header Banner */}
      <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-6 shadow-[0_4px_0_#2F3E4E] flex flex-col lg:flex-row lg:items-center justify-between gap-4 no-print">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#475569]">
            <span className="px-2 py-0.5 rounded bg-[#F9C80E] text-[#2F3E4E] border border-[#2F3E4E] font-bold uppercase text-[10px]">
              Advanced Housing Loan Engine
            </span>
            <span aria-hidden="true">·</span>
            <span>Floating Rates, Calendar/EMI Prepayments &amp; FY Tax Schedules</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#2F3E4E] tracking-tight">
            Home Loan EMI &amp; Prepayment Simulator
          </h1>
          <p className="text-xs sm:text-sm text-[#475569] max-w-3xl leading-relaxed">
            Model real-world home loan events: mid-tenure interest rate revisions, lump-sum advance
            payments by exact EMI number or calendar month, annual step-up EMIs, moratoriums, and
            Indian Financial Year (Apr–Mar) Section 24(b)/80C schedules.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleResetAll}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Main Split: Inputs (Left) & Live Simulation Results (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Loan Inputs + Dynamic Events */}
        <div className="lg:col-span-5 space-y-5 no-print">
          {/* Core Parameters Card */}
          <div className="bg-[#FFFDF5] rounded-2xl p-5 sm:p-6 border-[1.5px] border-[#2F3E4E] shadow-[0_4px_0_#2F3E4E] space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#2F3E4E]/15">
              <h2 className="font-display text-sm font-extrabold text-[#2F3E4E] uppercase tracking-wider">
                1. Core Loan Parameters
              </h2>
              <span className="font-mono text-xs font-bold text-[#475569] tabular-nums">
                {tenureMonths} EMIs
              </span>
            </div>

            {/* Principal */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-[#2F3E4E]">
                <label htmlFor="hl-principal">Loan Principal Amount</label>
                <span className="font-mono font-bold tabular-nums">{formatInrExact(principal)}</span>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-xs font-bold text-[#64748B]">
                  ₹
                </span>
                <input
                  id="hl-principal"
                  type="number"
                  min={0}
                  max={100000000}
                  step={50000}
                  value={principalInput}
                  placeholder="e.g. 5000000"
                  onChange={(e) => setPrincipalInput(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm font-mono font-bold rounded-lg border-[1.5px] border-[#2F3E4E]/40 bg-white text-[#2F3E4E] focus:border-[#2F3E4E] focus:outline-none"
                />
              </div>
              <input
                type="range"
                min={0}
                max={30000000}
                step={100000}
                value={Math.min(30000000, principal)}
                onChange={(e) => setPrincipalInput(e.target.value)}
                className="w-full h-2 bg-[#FEF2C8] rounded-lg appearance-none cursor-pointer accent-[#2F3E4E]"
              />
            </div>

            {/* Initial Rate & Start Month */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="hl-rate" className="block text-xs font-semibold text-[#2F3E4E]">
                  Initial Interest Rate (% p.a.)
                </label>
                <div className="relative">
                  <input
                    id="hl-rate"
                    type="number"
                    min={0}
                    max={25}
                    step={0.05}
                    value={annualRateInput}
                    placeholder="e.g. 8.5"
                    onChange={(e) => setAnnualRateInput(e.target.value)}
                    className="w-full pl-3 pr-10 py-2 text-sm font-mono font-bold rounded-lg border-[1.5px] border-[#2F3E4E]/40 bg-white text-[#2F3E4E] focus:border-[#2F3E4E] focus:outline-none"
                  />
                  <span className="absolute inset-y-0 right-3 flex items-center text-xs font-bold text-[#64748B]">
                    %
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="hl-start" className="block text-xs font-semibold text-[#2F3E4E]">
                  First EMI / Start Month
                </label>
                <input
                  id="hl-start"
                  type="month"
                  value={startMonth}
                  onChange={(e) => setStartMonth(e.target.value || new Date().toISOString().slice(0, 7))}
                  className="w-full px-3 py-2 text-sm font-mono font-bold rounded-lg border-[1.5px] border-[#2F3E4E]/40 bg-white text-[#2F3E4E] focus:border-[#2F3E4E] focus:outline-none"
                />
              </div>
            </div>

            {/* Tenure with Years/Months toggle */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="hl-tenure" className="text-xs font-semibold text-[#2F3E4E]">
                  Original Loan Tenure
                </label>
                <div className="inline-flex rounded-lg border border-[#2F3E4E]/40 bg-white p-0.5 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      if (tenureUnit !== 'years') {
                        setTenureUnit('years');
                        if (tenureValueInput.trim()) {
                          setTenureValueInput(String(Math.max(1, Math.round(tenureValue / 12))));
                        }
                      }
                    }}
                    className={`px-2.5 py-1 rounded-md cursor-pointer ${
                      tenureUnit === 'years' ? 'bg-[#2F3E4E] text-white' : 'text-[#475569]'
                    }`}
                  >
                    Years
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (tenureUnit !== 'months') {
                        setTenureUnit('months');
                        if (tenureValueInput.trim()) {
                          setTenureValueInput(String(Math.max(1, Math.round(tenureValue * 12))));
                        }
                      }
                    }}
                    className={`px-2.5 py-1 rounded-md cursor-pointer ${
                      tenureUnit === 'months' ? 'bg-[#2F3E4E] text-white' : 'text-[#475569]'
                    }`}
                  >
                    Months
                  </button>
                </div>
              </div>
              <input
                id="hl-tenure"
                type="number"
                min={1}
                max={tenureUnit === 'years' ? 40 : 480}
                value={tenureValueInput}
                placeholder={tenureUnit === 'years' ? 'e.g. 20' : 'e.g. 240'}
                onChange={(e) => setTenureValueInput(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono font-bold rounded-lg border-[1.5px] border-[#2F3E4E]/40 bg-white text-[#2F3E4E] focus:border-[#2F3E4E] focus:outline-none"
              />
            </div>

            {/* Global Impact Strategy */}
            <div className="space-y-1.5">
              <span className="block text-xs font-semibold text-[#2F3E4E]">
                When Rate Changes or Advance Prepayment Occurs
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setGlobalStrategy('reduce-tenure')}
                  className={`p-2.5 rounded-xl border-[1.5px] text-left cursor-pointer transition-colors ${
                    globalStrategy === 'reduce-tenure'
                      ? 'bg-[#2F3E4E] text-[#FFFDF5] border-[#2F3E4E]'
                      : 'bg-white text-[#2F3E4E] border-[#2F3E4E]/30 hover:bg-[#FEF2C8]'
                  }`}
                >
                  <div>Reduce Tenure</div>
                  <div className="text-[10px] font-normal opacity-80">Keep EMI same (Max savings)</div>
                </button>
                <button
                  type="button"
                  onClick={() => setGlobalStrategy('reduce-emi')}
                  className={`p-2.5 rounded-xl border-[1.5px] text-left cursor-pointer transition-colors ${
                    globalStrategy === 'reduce-emi'
                      ? 'bg-[#2F3E4E] text-[#FFFDF5] border-[#2F3E4E]'
                      : 'bg-white text-[#2F3E4E] border-[#2F3E4E]/30 hover:bg-[#FEF2C8]'
                  }`}
                >
                  <div>Reduce Monthly EMI</div>
                  <div className="text-[10px] font-normal opacity-80">Keep original tenure</div>
                </button>
              </div>
            </div>

            {/* Recurring & Real-World Options */}
            <div className="pt-3 border-t border-[#2F3E4E]/15 space-y-3.5">
              <div className="text-xs font-extrabold uppercase tracking-wider text-[#475569]">
                Recurring &amp; Special Loan Controls
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="hl-stepup" className="block text-[11px] font-bold text-[#2F3E4E] mb-1">
                    Annual EMI Step-Up %
                  </label>
                  <input
                    id="hl-stepup"
                    type="number"
                    min={0}
                    max={25}
                    step={1}
                    value={annualEmiStepUpPct}
                    onChange={(e) => setAnnualEmiStepUpPct(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-[#2F3E4E]/40 bg-white"
                  />
                </div>
                <div>
                  <label htmlFor="hl-extra-mo" className="block text-[11px] font-bold text-[#2F3E4E] mb-1">
                    Extra Monthly ₹
                  </label>
                  <input
                    id="hl-extra-mo"
                    type="number"
                    min={0}
                    step={1000}
                    value={extraMonthlyPrincipal}
                    onChange={(e) => setExtraMonthlyPrincipal(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-[#2F3E4E]/40 bg-white"
                  />
                </div>
                <div>
                  <label htmlFor="hl-mora" className="block text-[11px] font-bold text-[#2F3E4E] mb-1">
                    Moratorium (Mos)
                  </label>
                  <input
                    id="hl-mora"
                    type="number"
                    min={0}
                    max={36}
                    value={moratoriumMonths}
                    onChange={(e) => setMoratoriumMonths(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-[#2F3E4E]/40 bg-white"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-[#FEF2C8]/60 border border-[#2F3E4E]/20">
                <label className="inline-flex items-center gap-2 text-xs font-bold text-[#2F3E4E] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={extraAnnualEmiEnabled}
                    onChange={(e) => setExtraAnnualEmiEnabled(e.target.checked)}
                    className="w-4 h-4 accent-[#2F3E4E]"
                  />
                  <span>Pay 1 Extra EMI Every Year (13th EMI Rule)</span>
                </label>

                {extraAnnualEmiEnabled && (
                  <select
                    aria-label="Extra annual EMI month"
                    value={extraAnnualEmiMonth}
                    onChange={(e) => setExtraAnnualEmiMonth(Number(e.target.value))}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg border border-[#2F3E4E]/40 bg-white text-[#2F3E4E]"
                  >
                    {MONTH_LABELS.map((m, idx) => (
                      <option key={m} value={idx + 1}>
                        Every {m}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* 2. Mid-Tenure Floating Interest Rate Changes */}
          <div className="bg-[#FFFDF5] rounded-2xl p-5 border-[1.5px] border-[#2F3E4E] shadow-[0_4px_0_#2F3E4E] space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-sm font-extrabold text-[#2F3E4E] flex items-center gap-1.5">
                  <Percent className="w-4 h-4" />
                  <span>2. Mid-Tenure Rate Changes</span>
                </h2>
                <p className="text-[11px] text-[#64748B]">
                  Specify when bank/RBI rate changed by EMI # or Calendar Month
                </p>
              </div>
              <button
                type="button"
                onClick={addRateChange}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#2F3E4E] text-[#F9C80E] text-xs font-bold cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Rate Change</span>
              </button>
            </div>

            {rateChanges.length === 0 ? (
              <p className="text-xs text-[#64748B] bg-white rounded-xl border border-dashed border-[#2F3E4E]/30 p-3 text-center">
                No mid-tenure interest revisions added. Click &ldquo;Add Rate Change&rdquo; to simulate repo rate hikes or cuts.
              </p>
            ) : (
              <div className="space-y-3">
                {rateChanges.map((rc, idx) => {
                  const resolvedEmi =
                    rc.timingMode === 'calendar'
                      ? calendarMonthToEmiNumber(startMonth, rc.calendarMonth)
                      : rc.emiNumber;
                  const resolvedCal = emiNumberToCalendarMonth(startMonth, Math.max(1, resolvedEmi));
                  const isBeforeStart = resolvedEmi < 1;

                  return (
                    <div
                      key={rc.id}
                      className="p-3.5 rounded-xl bg-white border border-[#2F3E4E]/30 space-y-2.5 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-[#2F3E4E]">
                          Revision #{idx + 1} ·{' '}
                          <span className="font-mono text-[#12805C]">
                            {isBeforeStart
                              ? 'Before Loan Start!'
                              : `EMI #${resolvedEmi} (${resolvedCal})`}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setRateChanges((prev) => prev.filter((item) => item.id !== rc.id))
                          }
                          aria-label="Remove rate change"
                          className="text-red-700 hover:text-red-900 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-[#64748B] mb-1">
                            Select Timing By
                          </label>
                          <select
                            value={rc.timingMode}
                            onChange={(e) =>
                              updateRateChange(rc.id, {
                                timingMode: e.target.value as 'emi' | 'calendar',
                              })
                            }
                            className="w-full px-2 py-1.5 rounded-lg border border-[#2F3E4E]/35 bg-[#FEF2C8]/40 font-bold"
                          >
                            <option value="calendar">Calendar Month</option>
                            <option value="emi">EMI Month #</option>
                          </select>
                        </div>

                        {rc.timingMode === 'calendar' ? (
                          <div>
                            <label className="block text-[10px] font-bold text-[#64748B] mb-1">
                              Effective Month
                            </label>
                            <input
                              type="month"
                              value={rc.calendarMonth}
                              onChange={(e) =>
                                updateRateChange(rc.id, { calendarMonth: e.target.value })
                              }
                              className="w-full px-2 py-1.5 rounded-lg border border-[#2F3E4E]/35 font-mono font-bold"
                            />
                          </div>
                        ) : (
                          <div>
                            <label className="block text-[10px] font-bold text-[#64748B] mb-1">
                              Effective EMI #
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={480}
                              value={rc.emiNumber}
                              onChange={(e) =>
                                updateRateChange(rc.id, {
                                  emiNumber: Math.max(1, Number(e.target.value) || 1),
                                })
                              }
                              className="w-full px-2 py-1.5 rounded-lg border border-[#2F3E4E]/35 font-mono font-bold"
                            />
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-[#64748B] mb-1">
                            New Rate (% p.a.)
                          </label>
                          <input
                            type="number"
                            min={0.5}
                            max={25}
                            step={0.05}
                            value={rc.newRate}
                            onChange={(e) =>
                              updateRateChange(rc.id, {
                                newRate: Math.max(0, Number(e.target.value) || 0),
                              })
                            }
                            className="w-full px-2 py-1.5 rounded-lg border border-[#2F3E4E]/35 font-mono font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-[#64748B] mb-1">
                            Impact Mode
                          </label>
                          <select
                            value={rc.impactStrategy}
                            onChange={(e) =>
                              updateRateChange(rc.id, {
                                impactStrategy: e.target.value as RateChangeEvent['impactStrategy'],
                              })
                            }
                            className="w-full px-2 py-1.5 rounded-lg border border-[#2F3E4E]/35 bg-white font-semibold"
                          >
                            <option value="global">Follow Global</option>
                            <option value="reduce-tenure">Keep EMI (Adjust Tenure)</option>
                            <option value="reduce-emi">Recalculate EMI</option>
                          </select>
                        </div>
                      </div>

                      <input
                        type="text"
                        value={rc.note}
                        onChange={(e) => updateRateChange(rc.id, { note: e.target.value })}
                        placeholder="Note (e.g. RBI Repo Cut)"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/25 bg-[#FAFAFA] text-xs"
                      />

                      {isBeforeStart && (
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>Selected date is before Loan Start Month ({startMonth}).</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. Advance / Lump-Sum Prepayments */}
          <div className="bg-[#FFFDF5] rounded-2xl p-5 border-[1.5px] border-[#2F3E4E] shadow-[0_4px_0_#2F3E4E] space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-sm font-extrabold text-[#2F3E4E] flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  <span>3. Advance / Lump-Sum Prepayments</span>
                </h2>
                <p className="text-[11px] text-[#64748B]">
                  Enter EMI # directly OR pick calendar month (auto-calculates EMI #)
                </p>
              </div>
              <button
                type="button"
                onClick={addPrepayment}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#2F3E4E] text-[#F9C80E] text-xs font-bold cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Prepayment</span>
              </button>
            </div>

            {prepayments.length === 0 ? (
              <p className="text-xs text-[#64748B] bg-white rounded-xl border border-dashed border-[#2F3E4E]/30 p-3 text-center">
                No advance lump-sum prepayments added yet. Click &ldquo;Add Prepayment&rdquo; to test bonus or part-prepayments.
              </p>
            ) : (
              <div className="space-y-3">
                {prepayments.map((pp, idx) => {
                  const resolvedEmi =
                    pp.timingMode === 'calendar'
                      ? calendarMonthToEmiNumber(startMonth, pp.calendarMonth)
                      : pp.emiNumber;
                  const resolvedCal = emiNumberToCalendarMonth(startMonth, Math.max(1, resolvedEmi));
                  const isBeforeStart = resolvedEmi < 1;

                  return (
                    <div
                      key={pp.id}
                      className="p-3.5 rounded-xl bg-white border border-[#2F3E4E]/30 space-y-2.5 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-[#2F3E4E]">
                          Prepayment #{idx + 1} ·{' '}
                          <span className="font-mono text-[#12805C]">
                            {isBeforeStart
                              ? 'Before Loan Start!'
                              : `Paid on EMI #${resolvedEmi} (${resolvedCal})`}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setPrepayments((prev) => prev.filter((item) => item.id !== pp.id))
                          }
                          aria-label="Remove prepayment"
                          className="text-red-700 hover:text-red-900 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-[#64748B] mb-1">
                            Specify Month By
                          </label>
                          <select
                            value={pp.timingMode}
                            onChange={(e) =>
                              updatePrepayment(pp.id, {
                                timingMode: e.target.value as 'emi' | 'calendar',
                              })
                            }
                            className="w-full px-2 py-1.5 rounded-lg border border-[#2F3E4E]/35 bg-[#CEE5DC]/50 font-bold"
                          >
                            <option value="calendar">Calendar Month (Auto EMI #)</option>
                            <option value="emi">EMI Month Number</option>
                          </select>
                        </div>

                        {pp.timingMode === 'calendar' ? (
                          <div>
                            <label className="block text-[10px] font-bold text-[#64748B] mb-1">
                              Payment Calendar Month
                            </label>
                            <input
                              type="month"
                              value={pp.calendarMonth}
                              onChange={(e) =>
                                updatePrepayment(pp.id, { calendarMonth: e.target.value })
                              }
                              className="w-full px-2 py-1.5 rounded-lg border border-[#2F3E4E]/35 font-mono font-bold"
                            />
                          </div>
                        ) : (
                          <div>
                            <label className="block text-[10px] font-bold text-[#64748B] mb-1">
                              EMI Month #
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={480}
                              value={pp.emiNumber}
                              onChange={(e) =>
                                updatePrepayment(pp.id, {
                                  emiNumber: Math.max(1, Number(e.target.value) || 1),
                                })
                              }
                              className="w-full px-2 py-1.5 rounded-lg border border-[#2F3E4E]/35 font-mono font-bold"
                            />
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2">
                          <label className="block text-[10px] font-bold text-[#64748B] mb-1">
                            Advance Amount (₹)
                          </label>
                          <input
                            type="number"
                            min={1000}
                            step={10000}
                            value={pp.amount}
                            onChange={(e) =>
                              updatePrepayment(pp.id, {
                                amount: Math.max(0, Number(e.target.value) || 0),
                              })
                            }
                            className="w-full px-2 py-1.5 rounded-lg border border-[#2F3E4E]/35 font-mono font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-[#64748B] mb-1">
                            Fee %
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={5}
                            step={0.25}
                            value={pp.penaltyPct}
                            onChange={(e) =>
                              updatePrepayment(pp.id, {
                                penaltyPct: Math.max(0, Number(e.target.value) || 0),
                              })
                            }
                            className="w-full px-2 py-1.5 rounded-lg border border-[#2F3E4E]/35 font-mono font-bold"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={pp.impactStrategy}
                          onChange={(e) =>
                            updatePrepayment(pp.id, {
                              impactStrategy: e.target.value as PrepaymentEvent['impactStrategy'],
                            })
                          }
                          className="px-2 py-1.5 rounded-lg border border-[#2F3E4E]/35 bg-white font-semibold"
                        >
                          <option value="global">Follow Global</option>
                          <option value="reduce-tenure">Reduce Tenure</option>
                          <option value="reduce-emi">Reduce EMI</option>
                        </select>
                        <input
                          type="text"
                          value={pp.note}
                          onChange={(e) => updatePrepayment(pp.id, { note: e.target.value })}
                          placeholder="Note (e.g. Bonus)"
                          className="px-2 py-1.5 rounded-lg border border-[#2F3E4E]/25 bg-[#FAFAFA]"
                        />
                      </div>

                      {isBeforeStart && (
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>Selected month is before Loan Start Month ({startMonth}).</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Report, Savings Summary, Export Toolbar & Advanced Schedule */}
        <div className="lg:col-span-7 space-y-5">
          {/* Executive Report Card */}
          <div className="bg-[#FFFDF5] rounded-2xl p-5 sm:p-6 border-[1.5px] border-[#2F3E4E] shadow-[0_4px_0_#2F3E4E] space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-[#CEE5DC] border-[1.5px] border-[#2F3E4E]">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#2F3E4E]/80 block">
                  Initial Monthly EMI
                </span>
                <span className="font-mono text-2xl sm:text-3xl font-extrabold text-[#2F3E4E] tabular-nums block mt-1">
                  {formatInrExact(sim.initialEmi)}
                </span>
                <span className="text-[11px] font-semibold text-[#2F3E4E]/80">
                  Final EMI: {formatInrExact(sim.finalEmi)} · Starts {startMonth}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-[#FEF2C8] border-[1.5px] border-[#2F3E4E]">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#2F3E4E]/80 block">
                  Net Interest Saved
                </span>
                <span className="font-mono text-2xl sm:text-3xl font-extrabold text-[#12805C] tabular-nums block mt-1">
                  {formatInrExact(sim.interestSaved)}
                </span>
                <span className="text-[11px] font-semibold text-[#2F3E4E]/80">
                  Tenure reduced by {formatMonthsAsDuration(sim.monthsSaved)} ({sim.monthsSaved} EMIs)
                </span>
              </div>
            </div>

            {/* Baseline vs Modified Comparison Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-white border border-[#2F3E4E]/20">
                <div className="text-[10px] font-bold uppercase text-[#64748B]">Actual Interest</div>
                <div className="font-mono font-extrabold text-sm text-[#2F3E4E] tabular-nums mt-0.5">
                  {formatInrExact(sim.actualTotalInterest)}
                </div>
                <div className="text-[10px] text-[#64748B] tabular-nums">
                  Base: {formatInrExact(sim.baselineTotalInterest)}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white border border-[#2F3E4E]/20">
                <div className="text-[10px] font-bold uppercase text-[#64748B]">Prepayments</div>
                <div className="font-mono font-extrabold text-sm text-[#2F3E4E] tabular-nums mt-0.5">
                  {formatInrExact(sim.actualTotalPrepayments)}
                </div>
                <div className="text-[10px] text-[#64748B] tabular-nums">
                  Penalty: {formatInrExact(sim.actualTotalPenalty)}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white border border-[#2F3E4E]/20">
                <div className="text-[10px] font-bold uppercase text-[#64748B]">Total Outflow</div>
                <div className="font-mono font-extrabold text-sm text-[#2F3E4E] tabular-nums mt-0.5">
                  {formatInrExact(sim.actualTotalOutflow)}
                </div>
                <div className="text-[10px] text-[#64748B] tabular-nums">
                  Interest/Principal: {sim.interestToPrincipalRatio.toFixed(1)}%
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white border border-[#2F3E4E]/20">
                <div className="text-[10px] font-bold uppercase text-[#64748B]">Loan Closure</div>
                <div className="font-mono font-extrabold text-sm text-[#12805C] tabular-nums mt-0.5">
                  {sim.actualEndLabel}
                </div>
                <div className="text-[10px] text-[#64748B] tabular-nums">
                  Orig: {sim.baselineEndLabel}
                </div>
              </div>
            </div>

            {/* Yearly Balance & Principal/Interest Visual Bar Chart */}
            {chartPoints.length > 0 && (
              <div className="p-4 rounded-xl bg-white border border-[#2F3E4E]/20 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-[#2F3E4E]">
                    Year-End Balance &amp; Outflow Progression
                  </span>
                  <div className="flex items-center gap-3 text-[11px] text-[#475569]">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-xs bg-[#2F3E4E] inline-block" />
                      Closing Balance
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-xs bg-[#12805C] inline-block" />
                      Annual Principal + Prepay
                    </span>
                  </div>
                </div>
                <div className="flex items-end gap-1 h-28 pt-2 overflow-x-auto">
                  {chartPoints.map((pt) => {
                    const balPct = principal > 0 ? Math.min(100, (pt.balance / principal) * 100) : 0;
                    const payPct = principal > 0 ? Math.min(100, (pt.principal / principal) * 100) : 0;
                    return (
                      <div
                        key={pt.label}
                        title={`${pt.label}: Closing ${formatInrExact(pt.balance)} | Principal+Prepay ${formatInrExact(pt.principal)} | Interest ${formatInrExact(pt.interest)}`}
                        className="flex-1 min-w-[14px] h-full flex flex-col justify-end items-center gap-0.5 group"
                      >
                        <div className="w-full flex items-end justify-center gap-0.5 h-24">
                          <div
                            className="w-1/2 bg-[#2F3E4E] rounded-t-xs transition-all"
                            style={{ height: `${Math.max(2, balPct)}%` }}
                          />
                          <div
                            className="w-1/2 bg-[#12805C] rounded-t-xs transition-all"
                            style={{ height: `${Math.max(2, payPct)}%` }}
                          />
                        </div>
                        <span className="text-[9px] font-mono text-[#64748B] truncate max-w-full">
                          {pt.label.replace('Year ', 'Y')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex items-start gap-2 text-[11px] text-[#475569] bg-[#FEF2C8]/50 p-3 rounded-xl border border-[#2F3E4E]/15">
              <Info className="w-4 h-4 text-[#2F3E4E] shrink-0 mt-0.5" />
              <span>
                <strong>Tax Note:</strong> Under India&rsquo;s Old Tax Regime, self-occupied home
                loan interest up to ₹2,00,000/FY qualifies u/s 24(b) and principal repayment +
                prepayment up to ₹1,50,000/FY qualifies u/s 80C. Switch to the{' '}
                <strong>Financial Year (Apr–Mar)</strong> tab below to view exact FY caps.
              </span>
            </div>
          </div>

          {/* Export Toolbar — Isolated Outputs Only */}
          <ToolExportBar
            title="Export Schedule & Report"
            onClear={handleResetAll}
            clearLabel="Clear All"
            onCopy={handleCopySummary}
            copied={copiedSummary}
            onExcel={handleExportXlsx}
            onCsv={handleExportCsv}
            onWord={handleExportWord}
            onJson={handleExportJson}
            onPdf={handleSavePdf}
            onPrint={handlePrintReport}
          />

          {/* Multi-Mode Amortization Schedule Table */}
          <div className="bg-[#FFFDF5] rounded-2xl border-[1.5px] border-[#2F3E4E] shadow-[0_4px_0_#2F3E4E] overflow-hidden">
            <div className="p-4 border-b border-[#2F3E4E]/15 flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#FEF2C8] border border-[#2F3E4E]/30">
                <button
                  type="button"
                  onClick={() => setScheduleView('fy')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold cursor-pointer ${
                    scheduleView === 'fy'
                      ? 'bg-[#2F3E4E] text-white'
                      : 'text-[#2F3E4E] hover:bg-white/60'
                  }`}
                >
                  Financial Year (Apr–Mar)
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleView('monthly')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold cursor-pointer ${
                    scheduleView === 'monthly'
                      ? 'bg-[#2F3E4E] text-white'
                      : 'text-[#2F3E4E] hover:bg-white/60'
                  }`}
                >
                  Monthly (EMI #)
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleView('calendar')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold cursor-pointer ${
                    scheduleView === 'calendar'
                      ? 'bg-[#2F3E4E] text-white'
                      : 'text-[#2F3E4E] hover:bg-white/60'
                  }`}
                >
                  Yearly Summary
                </button>
              </div>

              {scheduleView === 'monthly' && (
                <label className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2F3E4E] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={eventsOnlyFilter}
                    onChange={(e) => setEventsOnlyFilter(e.target.checked)}
                    className="w-4 h-4 accent-[#2F3E4E]"
                  />
                  <span>Only Rate Change / Prepayment Months</span>
                </label>
              )}

              {scheduleView === 'calendar' && (
                <div className="inline-flex rounded-lg border border-[#2F3E4E]/30 bg-white p-0.5 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setYearlySubMode('calendar')}
                    className={`px-2.5 py-1 rounded-md cursor-pointer ${
                      yearlySubMode === 'calendar' ? 'bg-[#2F3E4E] text-white' : 'text-[#475569]'
                    }`}
                  >
                    Calendar Year
                  </button>
                  <button
                    type="button"
                    onClick={() => setYearlySubMode('loan')}
                    className={`px-2.5 py-1 rounded-md cursor-pointer ${
                      yearlySubMode === 'loan' ? 'bg-[#2F3E4E] text-white' : 'text-[#475569]'
                    }`}
                  >
                    Loan Year (1..N)
                  </button>
                </div>
              )}
            </div>

            <div className="overflow-x-auto max-h-[480px] bg-white">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-[#FEF2C8] z-10 border-b border-[#2F3E4E]/25">
                  <tr>
                    {activeExportTable.headers.map((h) => (
                      <th
                        key={h}
                        className="py-2.5 px-3 font-extrabold text-[#2F3E4E] whitespace-nowrap"
                      >
                        {h.replace(' (INR)', '')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeExportTable.displayRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={activeExportTable.headers.length}
                        className="py-8 text-center text-xs text-[#64748B]"
                      >
                        No matching installments found for the active filter.
                      </td>
                    </tr>
                  ) : (
                    activeExportTable.displayRows.map((row, idx) => {
                      const hasEvent =
                        scheduleView === 'monthly' && Boolean(String(row[row.length - 1] || '').trim());
                      return (
                        <tr
                          key={idx}
                          className={`hover:bg-[#FEF2C8]/40 transition-colors ${
                            hasEvent ? 'bg-[#CEE5DC]/35 font-semibold' : ''
                          }`}
                        >
                          {row.map((cell, cIdx) => (
                            <td
                              key={cIdx}
                              className="py-2 px-3 font-mono tabular-nums whitespace-nowrap text-[#2F3E4E]"
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
