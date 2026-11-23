import React, { useEffect, useMemo, useState } from 'react';
import html2canvas from 'html2canvas-pro';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Info,
  RotateCcw,
  Sparkles,
  Table as TableIcon,
} from 'lucide-react';
import { FINANCIAL_CALCULATORS } from '../../data/financialCalculators';
import {
  CalculationResult,
  ChartData,
  FinancialCalculatorDefinition,
} from '../../types/tools';
import {
  downloadBomCsv,
  downloadExcelWorkbook,
  downloadJsonFile,
  downloadWordDocument,
  exportStructuredReportPdf,
  printHtmlDocument,
} from '../../utils/printReport';
import { HomeLoanAdvancedView } from './HomeLoanAdvancedView';
import { ToolExportBar } from './ToolExportBar';

interface FinancialCalculatorViewProps {
  calculator: FinancialCalculatorDefinition;
  onSelectTool: (toolId: string) => void;
}

function DonutChartView({ chart }: { chart: ChartData }) {
  const total = chart.segments.reduce((acc, s) => acc + Math.max(0, s.value), 0);
  if (total <= 0) return null;

  const size = 148;
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;

  return (
    <div className="p-4 rounded-xl border border-[#2F3E4E]/20 bg-[#FEF2C8]/40 flex flex-col sm:flex-row items-center gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#E2E8F0"
            strokeWidth={strokeWidth}
          />
          {chart.segments.map((seg, i) => {
            const frac = Math.max(0, seg.value) / total;
            const dash = frac * circumference;
            const dashOffset = -offset;
            offset += dash;
            return (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={dashOffset}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
            Split
          </span>
          <span className="text-xs font-extrabold font-mono text-[#2F3E4E]">100%</span>
        </div>
      </div>

      <div className="flex-1 w-full space-y-2.5">
        {chart.title && (
          <div className="text-xs font-bold text-[#2F3E4E] uppercase tracking-wider">
            {chart.title}
          </div>
        )}
        <div className="space-y-2">
          {chart.segments.map((seg, idx) => {
            const pct = total > 0 ? ((Math.max(0, seg.value) / total) * 100).toFixed(1) : '0.0';
            return (
              <div key={idx} className="flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-3 h-3 rounded-xs shrink-0 border border-[#2F3E4E]/30"
                    style={{ backgroundColor: seg.color }}
                  />
                  <span className="font-medium text-[#2F3E4E] truncate">{seg.label}</span>
                </div>
                <span className="font-mono font-bold tabular-nums text-[#2F3E4E] shrink-0">
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export const FinancialCalculatorView: React.FC<FinancialCalculatorViewProps> = ({
  calculator,
  onSelectTool,
}) => {
  const blankValues = useMemo(() => {
    const vals: Record<string, number | string> = {};
    calculator.inputs.forEach((f) => {
      vals[f.id] = f.type === 'number' ? '' : f.defaultValue;
    });
    return vals;
  }, [calculator]);

  const exampleValues = useMemo(() => {
    const vals: Record<string, number | string> = {};
    calculator.inputs.forEach((f) => {
      vals[f.id] = f.defaultValue;
    });
    return vals;
  }, [calculator]);

  const [inputs, setInputs] = useState<Record<string, number | string>>(blankValues);
  const [showSchedule, setShowSchedule] = useState<boolean>(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [copiedSummary, setCopiedSummary] = useState<boolean>(false);
  const [isExportingImage, setIsExportingImage] = useState<boolean>(false);

  useEffect(() => {
    setInputs(blankValues);
    setShowSchedule(false);
    setOpenFaqIndex(0);
  }, [calculator.id, blankValues]);

  const handleInputChange = (id: string, val: number | string) => {
    setInputs((prev) => ({ ...prev, [id]: val }));
  };

  const handleReset = () => {
    setInputs(blankValues);
  };

  const handleLoadExample = () => {
    setInputs(exampleValues);
  };

  const result: CalculationResult = useMemo(() => {
    try {
      return calculator.calculate(inputs);
    } catch {
      return {
        primaryLabel: 'Calculation Status',
        primaryValue: 'Check Inputs',
        breakdown: [],
      };
    }
  }, [calculator, inputs]);

  const relatedCalculators = useMemo(() => {
    const sameCategory = FINANCIAL_CALCULATORS.filter(
      (c) => c.categoryId === calculator.categoryId && c.id !== calculator.id
    );
    if (sameCategory.length >= 4) return sameCategory.slice(0, 4);
    const others = FINANCIAL_CALCULATORS.filter(
      (c) => c.id !== calculator.id && !sameCategory.some((s) => s.id === c.id)
    );
    return [...sameCategory, ...others].slice(0, 4);
  }, [calculator]);

  const handleCopySummary = async () => {
    const lines = [
      `${calculator.name} — VCPL Tools`,
      `${result.primaryLabel}: ${result.primaryValue}`,
      ...(result.secondaryLabel && result.secondaryValue
        ? [`${result.secondaryLabel}: ${result.secondaryValue}`]
        : []),
      '--- Breakdown ---',
      ...result.breakdown.map((b) => `${b.label}: ${b.value}`),
    ];
    await navigator.clipboard.writeText(lines.join('\n'));
    setCopiedSummary(true);
    window.setTimeout(() => setCopiedSummary(false), 1800);
  };

  const handleExportCsv = () => {
    const rows = result.schedule
      ? result.schedule.rows
      : result.breakdown.map((b) => [b.label, b.value]);
    const headers = result.schedule ? result.schedule.headers : ['Component', 'Value'];
    downloadBomCsv({
      filename: `${calculator.slug}-schedule.csv`,
      preambleLines: [
        [`${calculator.name} — VCPL Tools`],
        [result.primaryLabel, result.primaryValue],
        ...(result.secondaryLabel && result.secondaryValue
          ? [[result.secondaryLabel, result.secondaryValue]]
          : []),
      ],
      headers,
      rows,
    });
  };

  const handleExportExcel = () => {
    const sheets = [
      {
        name: 'Summary',
        preambleLines: [
          [calculator.name],
          [result.summary || calculator.shortDesc],
          [result.primaryLabel, result.primaryValue],
          ...(result.secondaryLabel && result.secondaryValue
            ? [[result.secondaryLabel, result.secondaryValue]]
            : []),
        ],
        headers: ['Particulars', 'Value'],
        rows: result.breakdown.map((b) => [b.label, b.value]),
      },
      ...(result.schedule
        ? [
            {
              name: 'Schedule',
              headers: result.schedule.headers,
              rows: result.schedule.rows,
            },
          ]
        : []),
    ];
    downloadExcelWorkbook({
      filename: `${calculator.slug}-report.xlsx`,
      sheets,
    });
  };

  const handleExportWord = () => {
    void downloadWordDocument({
      filename: `${calculator.slug}-report.docx`,
      title: calculator.name,
      subtitle: result.summary || calculator.shortDesc,
      kpis: [
        { label: result.primaryLabel, value: result.primaryValue },
        ...(result.secondaryLabel && result.secondaryValue
          ? [{ label: result.secondaryLabel, value: result.secondaryValue }]
          : []),
      ],
      breakdown: result.breakdown.map((b) => ({ label: b.label, value: b.value })),
      notes: result.assumptions,
      table: result.schedule
        ? {
            title: result.schedule.title,
            headers: result.schedule.headers,
            rows: result.schedule.rows,
          }
        : undefined,
    });
  };

  const handleExportJson = () => {
    downloadJsonFile({
      filename: `${calculator.slug}-report.json`,
      data: {
        calculatorId: calculator.id,
        calculatorName: calculator.name,
        inputs,
        result,
      },
    });
  };

  const handleSavePdf = () => {
    exportStructuredReportPdf({
      title: calculator.name,
      subtitle: result.summary || calculator.shortDesc,
      filename: `${calculator.slug}-report.pdf`,
      orientation: 'portrait',
      kpis: [
        { label: result.primaryLabel, value: result.primaryValue },
        ...(result.secondaryLabel && result.secondaryValue
          ? [{ label: result.secondaryLabel, value: result.secondaryValue }]
          : []),
      ],
      breakdown: result.breakdown.map((b) => ({ label: b.label, value: b.value })),
      notes: result.assumptions,
      table: result.schedule
        ? {
            title: result.schedule.title,
            headers: result.schedule.headers,
            rows: result.schedule.rows,
          }
        : undefined,
    });
  };

  const handlePrintReport = () => {
    const esc = (v: string | number) =>
      String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const kpiHtml = `
      <div class="kpi-grid" style="grid-template-columns:repeat(${result.secondaryValue ? 2 : 1},minmax(0,1fr));">
        <div class="kpi-card">
          <div class="kpi-label">${esc(result.primaryLabel)}</div>
          <div class="kpi-val">${esc(result.primaryValue)}</div>
        </div>
        ${
          result.secondaryLabel && result.secondaryValue
            ? `<div class="kpi-card">
                 <div class="kpi-label">${esc(result.secondaryLabel)}</div>
                 <div class="kpi-val">${esc(result.secondaryValue)}</div>
               </div>`
            : ''
        }
      </div>
    `;

    const breakdownHtml = result.breakdown.length
      ? `<h2 style="font-size:13px;margin-top:10px;">Calculation Breakdown</h2>
         <table>
           <tbody>
             ${result.breakdown
               .map(
                 (row) => `
               <tr style="${row.isTotal ? 'font-weight:700;background:#f1f5f9;' : ''}">
                 <td>${esc(row.label)}</td>
                 <td class="num">${esc(row.value)}</td>
               </tr>`
               )
               .join('')}
           </tbody>
         </table>`
      : '';

    const scheduleHtml = result.schedule
      ? `<h2 style="font-size:13px;margin-top:14px;">${esc(result.schedule.title)}</h2>
         <table>
           <thead>
             <tr>${result.schedule.headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>
           </thead>
           <tbody>
             ${result.schedule.rows
               .map(
                 (r) =>
                   `<tr>${r
                     .map((c, idx) => `<td class="${idx > 0 ? 'num' : ''}">${esc(c)}</td>`)
                     .join('')}</tr>`
               )
               .join('')}
           </tbody>
         </table>`
      : '';

    const notesHtml =
      result.assumptions && result.assumptions.length
        ? `<div style="margin-top:12px;font-size:10px;color:#475569;">
             <strong>Assumptions:</strong> ${result.assumptions.map(esc).join(' · ')}
           </div>`
        : '';

    void printHtmlDocument({
      title: `${calculator.name} — Report`,
      bodyHtml: `
        <div style="border-bottom:2px solid #0f172a;padding-bottom:8px;margin-bottom:10px;">
          <h1 style="font-size:17px;">${esc(calculator.name)}</h1>
          <p style="margin:0;color:#475569;font-size:11px;">${esc(result.summary || calculator.shortDesc)}</p>
        </div>
        ${kpiHtml}
        ${breakdownHtml}
        ${scheduleHtml}
        ${notesHtml}
      `,
      orientation: 'portrait',
      pageMargin: '12mm',
    });
  };

  const handleExportPng = async () => {
    const el = document.getElementById('financial-report-card');
    if (!el || isExportingImage) return;
    setIsExportingImage(true);
    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        backgroundColor: '#FFFDF5',
        useCORS: true,
      });
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `${calculator.slug}-report.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      setIsExportingImage(false);
    }
  };

  return (
    <div className="space-y-8 font-sans">
      {calculator.id === 'home-loan-emi-calculator' ? (
        <HomeLoanAdvancedView />
      ) : (
        <>
          {/* Header Banner */}
          <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-6 shadow-[0_4px_0_#2F3E4E] space-y-2 no-print">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#475569]">
          <span className="px-2 py-0.5 rounded bg-[#F9C80E] text-[#2F3E4E] border border-[#2F3E4E] font-bold uppercase text-[10px]">
            WealthCalc Suite
          </span>
          <span aria-hidden="true">·</span>
          <span>100% Client-Side Simulation</span>
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#2F3E4E] tracking-tight">
          {calculator.name}
        </h1>
        <p className="text-sm sm:text-base text-[#475569] max-w-3xl leading-relaxed">
          {calculator.shortDesc}
        </p>
      </div>

      {/* Main Interactive Calculator Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start print:block">
        {/* Left Column: Parameter Inputs */}
        <div className="lg:col-span-5 bg-[#FFFDF5] rounded-2xl p-6 border-[1.5px] border-[#2F3E4E] shadow-[0_4px_0_#2F3E4E] space-y-6 no-print">
          <div className="flex items-center justify-between pb-3.5 border-b border-[#2F3E4E]/15">
            <h2 className="font-display text-sm font-extrabold text-[#2F3E4E] uppercase tracking-wider">
              Input Parameters
            </h2>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleLoadExample}
                className="inline-flex items-center gap-1 text-xs text-[#12805C] hover:underline font-bold cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Example</span>
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1 text-xs text-[#2F3E4E] hover:underline font-bold cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            </div>
          </div>

          <div className="space-y-5">
            {calculator.inputs.map((field) => {
              const currentVal = inputs[field.id] ?? '';

              return (
                <div key={field.id} className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-[#2F3E4E]">
                    <label htmlFor={field.id} className="flex items-center gap-1">
                      {field.label}
                      {field.tooltip && (
                        <span title={field.tooltip} className="cursor-help text-[#64748B]">
                          <Info className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </label>
                    {field.type === 'number' && (
                      <span className="font-mono text-[#475569] tabular-nums font-bold">
                        {field.prefix}
                        {Number(currentVal || 0).toLocaleString('en-IN')}
                        {field.suffix}
                      </span>
                    )}
                  </div>

                  {field.type === 'number' && (
                    <div className="space-y-2">
                      <div className="relative rounded-lg">
                        {field.prefix && (
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#64748B] text-xs font-bold">
                            {field.prefix}
                          </div>
                        )}
                        <input
                          id={field.id}
                          type="number"
                          value={currentVal}
                          min={field.min}
                          max={field.max}
                          step={field.step || 1}
                          placeholder={`e.g. ${field.defaultValue}`}
                          onChange={(e) =>
                            handleInputChange(
                              field.id,
                              e.target.value === '' ? '' : parseFloat(e.target.value)
                            )
                          }
                          className={`w-full py-2 text-sm font-mono font-bold rounded-lg border-[1.5px] border-[#2F3E4E]/40 bg-white text-[#2F3E4E] focus:border-[#2F3E4E] focus:outline-none ${
                            field.prefix ? 'pl-8' : 'pl-3'
                          } ${field.suffix ? 'pr-14' : 'pr-3'}`}
                        />
                        {field.suffix && (
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-[#64748B] text-xs font-semibold">
                            {field.suffix}
                          </div>
                        )}
                      </div>

                      {field.min !== undefined && field.max !== undefined && (
                        <input
                          type="range"
                          min={field.min}
                          max={field.max}
                          step={field.step || 1}
                          value={Number(currentVal) || 0}
                          onChange={(e) =>
                            handleInputChange(field.id, parseFloat(e.target.value))
                          }
                          className="w-full h-2 bg-[#FEF2C8] border border-[#2F3E4E]/20 rounded-lg appearance-none cursor-pointer accent-[#2F3E4E]"
                        />
                      )}
                    </div>
                  )}

                  {field.type === 'select' && (
                    <select
                      id={field.id}
                      value={currentVal}
                      onChange={(e) => handleInputChange(field.id, e.target.value)}
                      className="w-full py-2 px-3 text-sm font-medium rounded-lg border-[1.5px] border-[#2F3E4E]/40 bg-white text-[#2F3E4E] focus:border-[#2F3E4E] focus:outline-none"
                    >
                      {field.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Live Report Card, Chart, Breakdown & Schedule */}
        <div className="lg:col-span-7 lg:sticky lg:top-20 print:static space-y-5 print:w-full">
          <div
            id="financial-report-card"
            className="bg-[#FFFDF5] rounded-2xl p-6 sm:p-7 border-[1.5px] border-[#2F3E4E] shadow-[0_4px_0_#2F3E4E] print:shadow-none space-y-6"
          >
            {/* Primary KPI Banner */}
            <div className="p-5 rounded-xl bg-[#CEE5DC] border-[1.5px] border-[#2F3E4E] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-extrabold uppercase tracking-wider text-[#2F3E4E]/80 block mb-1">
                  {result.primaryLabel}
                </span>
                <span className="text-3xl sm:text-4xl font-extrabold text-[#2F3E4E] tracking-tight font-mono tabular-nums">
                  {result.primaryValue}
                </span>
              </div>

              {result.secondaryLabel && result.secondaryValue && (
                <div className="sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0 border-[#2F3E4E]/20">
                  <span className="text-xs font-semibold text-[#2F3E4E]/80 block mb-0.5">
                    {result.secondaryLabel}
                  </span>
                  <span className="text-xl sm:text-2xl font-bold text-[#2F3E4E] font-mono tabular-nums">
                    {result.secondaryValue}
                  </span>
                </div>
              )}
            </div>

            {result.summary && (
              <p className="text-xs sm:text-sm text-[#2F3E4E] font-medium leading-relaxed bg-[#FEF2C8]/70 p-3.5 rounded-xl border border-[#2F3E4E]/20">
                {result.summary}
              </p>
            )}

            {/* Interactive SVG Donut Breakdown */}
            {result.chart && <DonutChartView chart={result.chart} />}

            {/* Detailed Numerical Breakdown Table */}
            <div className="space-y-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#475569]">
                Calculation Breakdown
              </h3>
              <div className="divide-y divide-[#2F3E4E]/10 border-t border-b border-[#2F3E4E]/15 text-xs sm:text-sm">
                {result.breakdown.map((row, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between py-2.5 ${
                      row.isTotal ? 'font-extrabold text-[#2F3E4E]' : 'text-[#475569]'
                    }`}
                  >
                    <span>{row.label}</span>
                    <span
                      className="font-mono tabular-nums font-bold"
                      style={row.color ? { color: row.color } : undefined}
                    >
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Assumptions */}
            {result.assumptions && result.assumptions.length > 0 && (
              <div className="text-xs text-[#475569] space-y-1 bg-white p-3.5 rounded-xl border border-[#2F3E4E]/15">
                <span className="font-bold text-[#2F3E4E] block mb-1">
                  Calculation Assumptions:
                </span>
                <ul className="list-disc list-inside space-y-0.5">
                  {result.assumptions.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {calculator.disclaimer && (
              <div className="text-[11px] text-[#475569] italic bg-[#FFE1B3]/50 p-3 rounded-lg border border-[#2F3E4E]/20">
                {calculator.disclaimer}
              </div>
            )}
          </div>

          {/* Export Toolbar */}
          <ToolExportBar
            title="Export Report"
            onClear={handleReset}
            onCopy={handleCopySummary}
            copied={copiedSummary}
            onExcel={handleExportExcel}
            onCsv={handleExportCsv}
            onWord={handleExportWord}
            onJson={handleExportJson}
            onPdf={handleSavePdf}
            onPrint={handlePrintReport}
            extraActions={
              <button
                type="button"
                onClick={handleExportPng}
                disabled={isExportingImage}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-500 bg-white dark:bg-[#1E293B] hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] dark:text-slate-100 cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isExportingImage ? 'Saving PNG...' : 'PNG'}</span>
              </button>
            }
          />

          {/* Expandable Amortization / Yearly Schedule */}
          {result.schedule && (
            <div className="bg-[#FFFDF5] rounded-2xl border-[1.5px] border-[#2F3E4E] overflow-hidden shadow-[0_4px_0_#2F3E4E]">
              <button
                type="button"
                onClick={() => setShowSchedule(!showSchedule)}
                className="w-full flex items-center justify-between p-4 text-left font-display font-bold text-sm text-[#2F3E4E] hover:bg-[#FEF2C8]/60 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <TableIcon className="w-4 h-4 text-[#2F3E4E]" />
                  <span>
                    {result.schedule.title} ({result.schedule.rows.length} Periods)
                  </span>
                </div>
                {showSchedule ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showSchedule && (
                <div className="p-4 border-t border-[#2F3E4E]/15 overflow-x-auto max-h-[380px] bg-white">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-white z-10">
                      <tr className="border-b border-[#2F3E4E]/20 text-[#475569]">
                        {result.schedule.headers.map((h, i) => (
                          <th key={i} className="py-2.5 px-3 font-bold whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {result.schedule.rows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-[#FEF2C8]/30 transition-colors">
                          {row.map((cell, cIdx) => (
                            <td
                              key={cIdx}
                              className="py-2 px-3 font-mono tabular-nums whitespace-nowrap text-[#2F3E4E]"
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
        </>
      )}

      {/* Formula, Practical Example, FAQs & Related Switcher */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-4 no-print">
        <div className="lg:col-span-8 bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-6 shadow-[0_4px_0_#2F3E4E] space-y-7">
          <section className="space-y-3">
            <h3 className="font-display text-lg font-extrabold text-[#2F3E4E] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#2F3E4E]" />
              Mathematical Formula
            </h3>
            {calculator.formulaLatex && (
              <div className="p-3.5 bg-[#FEF2C8] border border-[#2F3E4E]/25 rounded-xl font-mono text-xs sm:text-sm text-center text-[#2F3E4E] font-bold overflow-x-auto">
                {calculator.formulaLatex}
              </div>
            )}
            <p className="text-sm text-[#475569] leading-relaxed">
              {calculator.formulaExplanation}
            </p>
          </section>

          <section className="space-y-2.5">
            <h3 className="font-display text-lg font-extrabold text-[#2F3E4E] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
              Practical Example
            </h3>
            <div className="p-4 rounded-xl bg-[#CEE5DC]/50 border border-[#2F3E4E]/20 text-sm text-[#2F3E4E] leading-relaxed">
              {calculator.practicalExample}
            </div>
          </section>

          {calculator.faqs && calculator.faqs.length > 0 && (
            <section className="space-y-3">
              <h3 className="font-display text-lg font-extrabold text-[#2F3E4E]">
                Frequently Asked Questions
              </h3>
              <div className="space-y-2">
                {calculator.faqs.map((faq, idx) => {
                  const isOpen = openFaqIndex === idx;
                  return (
                    <div
                      key={idx}
                      className="rounded-xl border border-[#2F3E4E]/25 overflow-hidden bg-white"
                    >
                      <button
                        type="button"
                        onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                        className="w-full flex items-center justify-between p-4 text-left font-bold text-sm text-[#2F3E4E] hover:bg-[#FEF2C8]/40 transition-colors cursor-pointer"
                      >
                        <span>{faq.question}</span>
                        {isOpen ? (
                          <ChevronUp className="w-4 h-4 shrink-0 text-[#475569]" />
                        ) : (
                          <ChevronDown className="w-4 h-4 shrink-0 text-[#475569]" />
                        )}
                      </button>
                      {isOpen && (
                        <div className="p-4 pt-2 text-xs sm:text-sm text-[#475569] leading-relaxed border-t border-slate-100">
                          {faq.answer}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* Related Financial Calculators */}
        <div className="lg:col-span-4 space-y-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#475569]">
            Related Financial Tools
          </h3>
          <div className="space-y-3">
            {relatedCalculators.map((rel) => (
              <button
                key={rel.id}
                type="button"
                onClick={() => onSelectTool(rel.id)}
                className="w-full text-left p-4 rounded-xl bg-[#FFFDF5] hover:bg-[#FEF2C8] border-[1.5px] border-[#2F3E4E] shadow-[0_3px_0_#2F3E4E] transition-all group cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-display text-sm font-bold text-[#2F3E4E] truncate">
                    {rel.name}
                  </h4>
                  <ArrowRight className="w-4 h-4 text-[#2F3E4E] group-hover:translate-x-1 transition-transform shrink-0" />
                </div>
                <p className="text-xs text-[#475569] line-clamp-2 mt-1">
                  {rel.shortDesc}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
