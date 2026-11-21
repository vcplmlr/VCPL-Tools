import React, { useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowRightToLine,
  Calculator,
  Check,
  Copy,
  FileSpreadsheet,
  IndianRupee,
  Receipt,
  RotateCcw,
  Table2,
} from 'lucide-react';
import { ToolCatalogItem } from '../../types/tools';
import { copyTextToClipboard } from '../../hooks/useRightClickProtection';
import {
  downloadBomCsv,
  downloadExcelWorkbook,
  downloadJsonFile,
  downloadWordDocument,
  exportStructuredReportPdf,
  printHtmlDocument,
} from '../../utils/printReport';
import { ToolExportBar } from './ToolExportBar';

interface TcsTaxCalculatorViewProps {
  tool?: ToolCatalogItem;
  onBack?: () => void;
}

type CalcTab = 'tcs' | 'gst';
type GstRatePreset = '0.25' | '3' | '5' | '12' | '18' | '28' | 'custom';
type ExcelLayout = 'horizontal' | 'vertical' | 'values-col';

interface CalcRowItem {
  key: string;
  label: string;
  shortLabel: string;
  value: number;
  highlight?: boolean;
}

function parseNum(raw: string): number | null {
  const cleaned = String(raw).replace(/,/g, '').trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function r2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function formatInr(n: number): string {
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function copyTextSafe(text: string): Promise<boolean> {
  return copyTextToClipboard(text);
}

async function copyCellsForExcel(rows: string[][]): Promise<boolean> {
  const tsv = rows.map((r) => r.join('\t')).join('\n');
  const htmlTable =
    '<table><tbody>' +
    rows
      .map(
        (r) =>
          '<tr>' +
          r.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('') +
          '</tr>'
      )
      .join('') +
    '</tbody></table>';

  try {
    if (
      navigator.clipboard &&
      typeof navigator.clipboard.write === 'function' &&
      typeof ClipboardItem !== 'undefined'
    ) {
      const item = new ClipboardItem({
        'text/plain': new Blob([tsv], { type: 'text/plain' }),
        'text/html': new Blob([htmlTable], { type: 'text/html' }),
      });
      await navigator.clipboard.write([item]);
      return true;
    }
  } catch {
    // Fall back to plain TSV copy below
  }

  return copyTextSafe(tsv);
}

interface ResultRowProps {
  rowKey: string;
  label: string;
  value: number;
  highlight?: boolean;
  copiedKey: string | null;
  onCopy: (key: string, value: number) => void;
}

function ResultRow({
  rowKey,
  label,
  value,
  highlight = false,
  copiedKey,
  onCopy,
}: ResultRowProps) {
  const isCopied = copiedKey === rowKey;
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 transition-colors ${
        highlight
          ? 'bg-[#CEE5DC] border-y-[1.5px] border-[#2F3E4E]'
          : 'bg-[#FFFDF5] border-b border-[#2F3E4E]/15 last:border-b-0'
      }`}
    >
      <span
        className={`text-sm ${
          highlight ? 'font-display font-extrabold text-[#2F3E4E]' : 'font-semibold text-[#475569]'
        }`}
      >
        {label}
      </span>
      <div className="flex items-center gap-2.5 ml-auto">
        <span
          className={`font-mono font-extrabold tabular-nums text-right ${
            highlight ? 'text-xl sm:text-2xl text-[#0F5C4D]' : 'text-base sm:text-lg text-[#2F3E4E]'
          }`}
        >
          ₹ {formatInr(value)}
        </span>
        <button
          type="button"
          onClick={() => onCopy(rowKey, value)}
          aria-label={`Copy ${label} cell value`}
          title={`Copy ${value.toFixed(2)} for Excel cell`}
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer shrink-0 ${
            isCopied
              ? 'bg-[#12805C] text-[#FFFDF5] border-[#2F3E4E]'
              : 'bg-white hover:bg-[#F9C80E] text-[#2F3E4E] border-[#2F3E4E]/45'
          }`}
        >
          {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{isCopied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
    </div>
  );
}

const TCS_QUICK_RATES = ['0.1', '1', '2', '5', '10'];
const GST_RATE_OPTIONS: GstRatePreset[] = ['0.25', '3', '5', '12', '18', '28', 'custom'];

export const TcsTaxCalculatorView: React.FC<TcsTaxCalculatorViewProps> = ({ tool }) => {
  const [tab, setTab] = useState<CalcTab>('tcs');

  // TCS State
  const [tcsReverse, setTcsReverse] = useState(false);
  const [tcsAmount, setTcsAmount] = useState('');
  const [tcsRate, setTcsRate] = useState('1');

  // Tax / GST State
  const [taxForward, setTaxForward] = useState(false); // default false: Amount incl. tax -> Base
  const [gstAmount, setGstAmount] = useState('');
  const [gstPreset, setGstPreset] = useState<GstRatePreset>('18');
  const [gstCustomRate, setGstCustomRate] = useState('18');
  const [interstate, setInterstate] = useState(false);

  // Excel Copy Options & Feedback
  const [includeExcelHeaders, setIncludeExcelHeaders] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [summaryCopied, setSummaryCopied] = useState<boolean>(false);

  const flashCopied = (key: string) => {
    setCopiedKey(key);
    window.setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 1600);
  };

  const handleCopyValue = async (key: string, value: number) => {
    const ok = await copyTextSafe(value.toFixed(2));
    if (ok) flashCopied(key);
  };

  const tcsResult = useMemo(() => {
    const a = parseNum(tcsAmount);
    const r = parseNum(tcsRate);
    if (a === null || r === null || a < 0 || r < 0) return null;
    if (!tcsReverse) {
      const sale = a;
      const tcs = r2((sale * r) / 100);
      const total = r2(sale + tcs);
      return { sale, tcs, total, rate: r };
    }
    const total = a;
    const sale = r2(total / (1 + r / 100));
    const tcs = r2(total - sale);
    return { sale, tcs, total, rate: r };
  }, [tcsAmount, tcsRate, tcsReverse]);

  const effectiveGstRate = useMemo(() => {
    return gstPreset === 'custom' ? parseNum(gstCustomRate) : parseFloat(gstPreset);
  }, [gstPreset, gstCustomRate]);

  const gstResult = useMemo(() => {
    const a = parseNum(gstAmount);
    const r = effectiveGstRate;
    if (a === null || r === null || a < 0 || r < 0) return null;
    let base: number;
    let tax: number;
    let total: number;
    if (!taxForward) {
      total = a;
      base = r2(total / (1 + r / 100));
      tax = r2(total - base);
    } else {
      base = a;
      tax = r2((base * r) / 100);
      total = r2(base + tax);
    }
    const cgst = r2(tax / 2);
    const sgst = r2(tax - cgst);
    return { base, tax, total, cgst, sgst, rate: r };
  }, [gstAmount, effectiveGstRate, taxForward]);

  const activeRows = useMemo<CalcRowItem[]>(() => {
    if (tab === 'tcs') {
      if (!tcsResult) return [];
      return [
        {
          key: 'tcs-sale',
          label: 'Final sale value (A)',
          shortLabel: 'Sale Value',
          value: tcsResult.sale,
          highlight: tcsReverse,
        },
        {
          key: 'tcs-tax',
          label: `TCS @${tcsResult.rate}%`,
          shortLabel: `TCS @${tcsResult.rate}%`,
          value: tcsResult.tcs,
        },
        {
          key: 'tcs-total',
          label: 'Total sales price incl. TCS',
          shortLabel: 'Total Incl. TCS',
          value: tcsResult.total,
          highlight: !tcsReverse,
        },
      ];
    }

    if (!gstResult) return [];
    const taxRows: CalcRowItem[] = interstate
      ? [
          {
            key: 'gst-igst',
            label: `IGST @${gstResult.rate}%`,
            shortLabel: `IGST @${gstResult.rate}%`,
            value: gstResult.tax,
          },
        ]
      : [
          {
            key: 'gst-cgst',
            label: `CGST @${gstResult.rate / 2}%`,
            shortLabel: `CGST @${gstResult.rate / 2}%`,
            value: gstResult.cgst,
          },
          {
            key: 'gst-sgst',
            label: `SGST @${gstResult.rate / 2}%`,
            shortLabel: `SGST @${gstResult.rate / 2}%`,
            value: gstResult.sgst,
          },
        ];

    return [
      {
        key: 'gst-base',
        label: 'Taxable amount (base)',
        shortLabel: 'Taxable Base',
        value: gstResult.base,
        highlight: !taxForward,
      },
      ...taxRows,
      {
        key: 'gst-total',
        label: 'Amount including tax',
        shortLabel: 'Total Incl. Tax',
        value: gstResult.total,
        highlight: taxForward,
      },
    ];
  }, [tab, tcsResult, tcsReverse, gstResult, interstate, taxForward]);

  const handleCopyExcel = async (layout: ExcelLayout) => {
    if (activeRows.length === 0) return;

    let matrix: string[][] = [];
    if (layout === 'horizontal') {
      const vals = activeRows.map((r) => r.value.toFixed(2));
      if (includeExcelHeaders) {
        matrix = [activeRows.map((r) => r.shortLabel), vals];
      } else {
        matrix = [vals];
      }
    } else if (layout === 'vertical') {
      const body = activeRows.map((r) => [r.label, r.value.toFixed(2)]);
      matrix = includeExcelHeaders ? [['Particulars', 'Amount (INR)'], ...body] : body;
    } else {
      const body = activeRows.map((r) => [r.value.toFixed(2)]);
      matrix = includeExcelHeaders ? [['Amount (INR)'], ...body] : body;
    }

    const ok = await copyCellsForExcel(matrix);
    if (ok) flashCopied(`excel-${layout}`);
  };

  const handleCopySummary = async () => {
    if (activeRows.length === 0) return;
    const matrix = activeRows.map((r) => [r.label, r.value.toFixed(2)]);
    const ok = await copyCellsForExcel(matrix);
    if (ok) flashCopied('summary');
  };

  const handleReset = () => {
    if (tab === 'tcs') {
      setTcsReverse(false);
      setTcsAmount('');
      setTcsRate('1');
    } else {
      setTaxForward(false);
      setGstAmount('');
      setGstPreset('18');
      setGstCustomRate('18');
      setInterstate(false);
    }
    setCopiedKey(null);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 sm:p-6 shadow-[0_4px_0_#2F3E4E] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] shadow-[0_2px_0_#2F3E4E] flex items-center justify-center text-[#2F3E4E] shrink-0">
            <Receipt className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-[#2F3E4E] text-[#F9C80E] font-mono text-[11px] font-extrabold">
                {tool?.code || 'TX-07'}
              </span>
              <span className="px-2 py-0.5 rounded bg-[#CEE5DC] border border-[#2F3E4E]/35 text-[#2F3E4E] text-[11px] font-bold">
                Bidirectional · Excel Cell-by-Cell Copy
              </span>
            </div>
            <h1 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] mt-1">
              {tool?.title || 'TCS & Tax Calculator'}
            </h1>
            <p className="text-xs sm:text-sm text-[#475569] mt-0.5">
              Works both ways. Type an amount and copy individual cells, 1-row, or 2-column tables straight into Excel.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#FFE1B3] text-xs font-bold text-[#2F3E4E] cursor-pointer transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
          <button
            type="button"
            onClick={handleCopySummary}
            disabled={activeRows.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#2F3E4E] hover:bg-[#1E293B] disabled:opacity-45 text-xs font-bold text-[#FFFDF5] cursor-pointer transition"
          >
            {copiedKey === 'summary' ? (
              <Check className="w-3.5 h-3.5 text-[#34D399]" />
            ) : (
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#F9C80E]" />
            )}
            <span>{copiedKey === 'summary' ? 'Copied to Excel!' : 'Copy Excel Table'}</span>
          </button>
        </div>
      </div>

      {/* Main Centered Calculator Workspace */}
      <div className="max-w-[780px] mx-auto space-y-4">
        {/* Top Primary Mode Switcher */}
        <div
          role="tablist"
          aria-label="Calculator type"
          className="grid grid-cols-2 gap-2 p-1.5 bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl shadow-[0_3px_0_#2F3E4E]"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'tcs'}
            onClick={() => setTab('tcs')}
            className={`min-h-[44px] px-4 py-2 rounded-xl font-display font-extrabold text-sm flex items-center justify-center gap-2 transition cursor-pointer ${
              tab === 'tcs'
                ? 'bg-[#F9C80E] text-[#2F3E4E] border-[1.5px] border-[#2F3E4E] shadow-[0_2px_0_#2F3E4E]'
                : 'text-[#475569] hover:text-[#2F3E4E] hover:bg-[#FEF2C8]/60 border-[1.5px] border-transparent'
            }`}
          >
            <IndianRupee className="w-4 h-4" />
            <span>TCS Calculator</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'gst'}
            onClick={() => setTab('gst')}
            className={`min-h-[44px] px-4 py-2 rounded-xl font-display font-extrabold text-sm flex items-center justify-center gap-2 transition cursor-pointer ${
              tab === 'gst'
                ? 'bg-[#F9C80E] text-[#2F3E4E] border-[1.5px] border-[#2F3E4E] shadow-[0_2px_0_#2F3E4E]'
                : 'text-[#475569] hover:text-[#2F3E4E] hover:bg-[#FEF2C8]/60 border-[1.5px] border-transparent'
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>Tax / GST Calculator</span>
          </button>
        </div>

        {/* TCS Panel */}
        {tab === 'tcs' && (
          <section className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 sm:p-6 shadow-[0_4px_0_#2F3E4E] space-y-5">
            {/* Direction Modes */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-display font-extrabold uppercase tracking-wider text-[#64748B]">
                <ArrowLeftRight className="w-3.5 h-3.5 text-[#2F3E4E]" />
                <span>Calculation Direction</span>
              </div>
              <div
                role="tablist"
                className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1.5 bg-[#FEF2C8] border-[1.5px] border-[#2F3E4E]/35 rounded-xl"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={!tcsReverse}
                  onClick={() => setTcsReverse(false)}
                  className={`min-h-[40px] px-3 py-2 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer ${
                    !tcsReverse
                      ? 'bg-[#2F3E4E] text-[#F9C80E] shadow-xs'
                      : 'text-[#2F3E4E] hover:bg-[#FFFDF5]'
                  }`}
                >
                  Sale value → Total
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tcsReverse}
                  onClick={() => setTcsReverse(true)}
                  className={`min-h-[40px] px-3 py-2 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer ${
                    tcsReverse
                      ? 'bg-[#2F3E4E] text-[#F9C80E] shadow-xs'
                      : 'text-[#2F3E4E] hover:bg-[#FFFDF5]'
                  }`}
                >
                  Total → Sale value
                </button>
              </div>
            </div>

            {/* Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
              <div className="sm:col-span-7 space-y-1.5">
                <label htmlFor="tcs-amount-input" className="block text-xs font-bold text-[#2F3E4E]">
                  {tcsReverse ? 'Total sales price incl. TCS' : 'Final sale value (A)'}
                </label>
                <div className="flex items-center bg-[#FEF2C8]/65 border-[1.5px] border-[#2F3E4E] rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#F9C80E]">
                  <span className="px-3.5 text-base font-bold text-[#475569] select-none">₹</span>
                  <input
                    id="tcs-amount-input"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={tcsAmount}
                    onChange={(e) => setTcsAmount(e.target.value)}
                    placeholder="e.g. 1650000"
                    className="w-full py-3 pr-3.5 bg-transparent font-mono text-xl font-extrabold text-[#2F3E4E] tabular-nums focus:outline-none"
                  />
                </div>
              </div>

              <div className="sm:col-span-5 space-y-1.5">
                <label htmlFor="tcs-rate-input" className="block text-xs font-bold text-[#2F3E4E]">
                  TCS rate
                </label>
                <div className="flex items-center bg-[#FEF2C8]/65 border-[1.5px] border-[#2F3E4E] rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#F9C80E]">
                  <input
                    id="tcs-rate-input"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={tcsRate}
                    onChange={(e) => setTcsRate(e.target.value)}
                    className="w-full py-3 pl-3.5 bg-transparent font-mono text-xl font-extrabold text-[#2F3E4E] tabular-nums focus:outline-none"
                  />
                  <span className="px-3.5 text-base font-bold text-[#475569] select-none">%</span>
                </div>
              </div>
            </div>

            {/* Quick TCS Rate Chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-[#64748B] mr-1">Quick rates:</span>
              {TCS_QUICK_RATES.map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => setTcsRate(rate)}
                  className={`px-2.5 py-1 rounded-lg border text-xs font-mono font-bold transition cursor-pointer ${
                    tcsRate === rate
                      ? 'bg-[#F9C80E] border-[#2F3E4E] text-[#2F3E4E]'
                      : 'bg-white border-[#2F3E4E]/30 text-[#475569] hover:border-[#2F3E4E] hover:text-[#2F3E4E]'
                  }`}
                >
                  {rate}%
                </button>
              ))}
            </div>

            {/* Results */}
            <div className="rounded-xl border-[1.5px] border-[#2F3E4E] overflow-hidden">
              {activeRows.length === 0 ? (
                <div className="px-4 py-5 text-center text-sm font-medium text-[#64748B] bg-[#FFFDF5]">
                  Enter a valid amount and TCS rate to see the instant breakdown.
                </div>
              ) : (
                activeRows.map((row) => (
                  <ResultRow
                    key={row.key}
                    rowKey={row.key}
                    label={row.label}
                    value={row.value}
                    highlight={row.highlight}
                    copiedKey={copiedKey}
                    onCopy={handleCopyValue}
                  />
                ))
              )}
            </div>
          </section>
        )}

        {/* Tax / GST Panel */}
        {tab === 'gst' && (
          <section className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 sm:p-6 shadow-[0_4px_0_#2F3E4E] space-y-5">
            {/* Direction Modes */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-display font-extrabold uppercase tracking-wider text-[#64748B]">
                <ArrowLeftRight className="w-3.5 h-3.5 text-[#2F3E4E]" />
                <span>Calculation Direction</span>
              </div>
              <div
                role="tablist"
                className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1.5 bg-[#FEF2C8] border-[1.5px] border-[#2F3E4E]/35 rounded-xl"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={!taxForward}
                  onClick={() => setTaxForward(false)}
                  className={`min-h-[40px] px-3 py-2 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer ${
                    !taxForward
                      ? 'bg-[#2F3E4E] text-[#F9C80E] shadow-xs'
                      : 'text-[#2F3E4E] hover:bg-[#FFFDF5]'
                  }`}
                >
                  Amount incl. tax → Base
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={taxForward}
                  onClick={() => setTaxForward(true)}
                  className={`min-h-[40px] px-3 py-2 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer ${
                    taxForward
                      ? 'bg-[#2F3E4E] text-[#F9C80E] shadow-xs'
                      : 'text-[#2F3E4E] hover:bg-[#FFFDF5]'
                  }`}
                >
                  Base → Amount incl. tax
                </button>
              </div>
            </div>

            {/* Amount & Tax Rate */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
              <div className="sm:col-span-7 space-y-1.5">
                <label htmlFor="gst-amount-input" className="block text-xs font-bold text-[#2F3E4E]">
                  {taxForward ? 'Base amount (excluding tax)' : 'Amount including tax'}
                </label>
                <div className="flex items-center bg-[#FEF2C8]/65 border-[1.5px] border-[#2F3E4E] rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#F9C80E]">
                  <span className="px-3.5 text-base font-bold text-[#475569] select-none">₹</span>
                  <input
                    id="gst-amount-input"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={gstAmount}
                    onChange={(e) => setGstAmount(e.target.value)}
                    placeholder="e.g. 10000"
                    className="w-full py-3 pr-3.5 bg-transparent font-mono text-xl font-extrabold text-[#2F3E4E] tabular-nums focus:outline-none"
                  />
                </div>
              </div>

              <div className="sm:col-span-5 space-y-1.5">
                <label htmlFor="gst-rate-select" className="block text-xs font-bold text-[#2F3E4E]">
                  Tax rate
                </label>
                <select
                  id="gst-rate-select"
                  value={gstPreset}
                  onChange={(e) => setGstPreset(e.target.value as GstRatePreset)}
                  className="w-full h-[52px] px-3 bg-[#FEF2C8]/65 border-[1.5px] border-[#2F3E4E] rounded-xl font-mono text-base font-extrabold text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
                >
                  {GST_RATE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt === 'custom' ? 'Custom…' : `${opt}% GST`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Custom Rate Input */}
            {gstPreset === 'custom' && (
              <div className="space-y-1.5">
                <label htmlFor="gst-custom-rate" className="block text-xs font-bold text-[#2F3E4E]">
                  Custom rate (%)
                </label>
                <div className="flex items-center bg-[#FEF2C8]/65 border-[1.5px] border-[#2F3E4E] rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#F9C80E] max-w-[240px]">
                  <input
                    id="gst-custom-rate"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={gstCustomRate}
                    onChange={(e) => setGstCustomRate(e.target.value)}
                    className="w-full py-2.5 pl-3.5 bg-transparent font-mono text-lg font-extrabold text-[#2F3E4E] tabular-nums focus:outline-none"
                  />
                  <span className="px-3.5 text-sm font-bold text-[#475569] select-none">%</span>
                </div>
              </div>
            )}

            {/* Type of Supply */}
            <div className="space-y-1.5">
              <span className="block text-xs font-bold text-[#2F3E4E]">Type of supply</span>
              <div
                role="tablist"
                className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1.5 bg-[#FEF2C8] border-[1.5px] border-[#2F3E4E]/35 rounded-xl"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={!interstate}
                  onClick={() => setInterstate(false)}
                  className={`min-h-[40px] px-3 py-2 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer ${
                    !interstate
                      ? 'bg-[#2F3E4E] text-[#F9C80E] shadow-xs'
                      : 'text-[#2F3E4E] hover:bg-[#FFFDF5]'
                  }`}
                >
                  Same state (CGST + SGST)
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={interstate}
                  onClick={() => setInterstate(true)}
                  className={`min-h-[40px] px-3 py-2 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer ${
                    interstate
                      ? 'bg-[#2F3E4E] text-[#F9C80E] shadow-xs'
                      : 'text-[#2F3E4E] hover:bg-[#FFFDF5]'
                  }`}
                >
                  Interstate (IGST)
                </button>
              </div>
            </div>

            {/* Results */}
            <div className="rounded-xl border-[1.5px] border-[#2F3E4E] overflow-hidden">
              {activeRows.length === 0 ? (
                <div className="px-4 py-5 text-center text-sm font-medium text-[#64748B] bg-[#FFFDF5]">
                  Enter a valid amount and tax rate to see the instant GST split.
                </div>
              ) : (
                activeRows.map((row) => (
                  <ResultRow
                    key={row.key}
                    rowKey={row.key}
                    label={row.label}
                    value={row.value}
                    highlight={row.highlight}
                    copiedKey={copiedKey}
                    onCopy={handleCopyValue}
                  />
                ))
              )}
            </div>
          </section>
        )}

        {/* Excel Cell-by-Cell Copy Bar */}
        {activeRows.length > 0 && (
          <section className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-4 sm:p-5 shadow-[0_4px_0_#2F3E4E] space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-[#CEE5DC] border border-[#2F3E4E] flex items-center justify-center text-[#2F3E4E] shrink-0">
                  <Table2 className="w-4 h-4" />
                </span>
                <div>
                  <h2 className="font-display font-extrabold text-sm text-[#2F3E4E]">
                    Copy for Excel (Paste Cell by Cell)
                  </h2>
                  <p className="text-[11px] text-[#475569]">
                    Plain numeric values with tab separators so Excel &amp; Google Sheets split each figure into its own cell.
                  </p>
                </div>
              </div>

              <label className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#FEF2C8] border border-[#2F3E4E]/35 text-xs font-bold text-[#2F3E4E] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeExcelHeaders}
                  onChange={(e) => setIncludeExcelHeaders(e.target.checked)}
                  className="w-3.5 h-3.5 accent-[#2F3E4E]"
                />
                <span>Include Headers</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => handleCopyExcel('horizontal')}
                className={`min-h-[42px] px-3 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] text-xs font-display font-extrabold flex items-center justify-center gap-2 transition cursor-pointer ${
                  copiedKey === 'excel-horizontal'
                    ? 'bg-[#12805C] text-[#FFFDF5]'
                    : 'bg-[#F9C80E] hover:bg-[#FFE1B3] text-[#2F3E4E] shadow-[0_2px_0_#2F3E4E]'
                }`}
              >
                {copiedKey === 'excel-horizontal' ? (
                  <Check className="w-4 h-4 shrink-0" />
                ) : (
                  <ArrowRightToLine className="w-4 h-4 shrink-0" />
                )}
                <span>
                  {copiedKey === 'excel-horizontal' ? 'Row Copied!' : 'Copy Row (Left → Right)'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleCopyExcel('vertical')}
                className={`min-h-[42px] px-3 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] text-xs font-display font-extrabold flex items-center justify-center gap-2 transition cursor-pointer ${
                  copiedKey === 'excel-vertical'
                    ? 'bg-[#12805C] text-[#FFFDF5]'
                    : 'bg-[#CEE5DC] hover:bg-[#F9C80E] text-[#2F3E4E]'
                }`}
              >
                {copiedKey === 'excel-vertical' ? (
                  <Check className="w-4 h-4 shrink-0" />
                ) : (
                  <FileSpreadsheet className="w-4 h-4 shrink-0" />
                )}
                <span>
                  {copiedKey === 'excel-vertical' ? '2-Col Copied!' : 'Copy Table (2 Columns)'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleCopyExcel('values-col')}
                className={`min-h-[42px] px-3 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] text-xs font-display font-extrabold flex items-center justify-center gap-2 transition cursor-pointer ${
                  copiedKey === 'excel-values-col'
                    ? 'bg-[#12805C] text-[#FFFDF5]'
                    : 'bg-white hover:bg-[#FEF2C8] text-[#2F3E4E]'
                }`}
              >
                {copiedKey === 'excel-values-col' ? (
                  <Check className="w-4 h-4 shrink-0" />
                ) : (
                  <ArrowDownToLine className="w-4 h-4 shrink-0" />
                )}
                <span>
                  {copiedKey === 'excel-values-col' ? 'Column Copied!' : 'Copy Numbers Only (↓)'}
                </span>
              </button>
            </div>

            {/* Live Excel Cell Preview */}
            <div className="overflow-x-auto rounded-lg border border-[#2F3E4E]/30 bg-white">
              <table className="w-full text-left border-collapse font-mono text-[11px] tabular-nums">
                <thead>
                  <tr className="bg-[#FEF2C8] border-b border-[#2F3E4E]/25 text-[#2F3E4E]">
                    {activeRows.map((row, idx) => (
                      <th
                        key={row.key}
                        className="px-3 py-1.5 font-bold border-r border-[#2F3E4E]/15 last:border-r-0 whitespace-nowrap"
                      >
                        <span className="text-[#64748B] mr-1">
                          {String.fromCharCode(65 + idx)}:
                        </span>
                        {row.shortLabel}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="text-[#2F3E4E]">
                    {activeRows.map((row) => (
                      <td
                        key={row.key}
                        className={`px-3 py-2 font-extrabold border-r border-[#2F3E4E]/15 last:border-r-0 whitespace-nowrap ${
                          row.highlight ? 'bg-[#CEE5DC]/55 text-[#0F5C4D]' : ''
                        }`}
                      >
                        {row.value.toFixed(2)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Full Report Exports */}
        {activeRows.length > 0 && (
          <ToolExportBar
            onClear={handleReset}
            onCopy={() => {
              const txt = activeRows
                .map((r) => `${r.label}: ₹ ${formatInr(r.value)}`)
                .join('\n');
              void copyTextToClipboard(txt).then((ok) => {
                if (ok) {
                  setSummaryCopied(true);
                  window.setTimeout(() => setSummaryCopied(false), 1800);
                }
              });
            }}
            copied={summaryCopied}
            copyLabel="Copy Summary"
            onExcel={() => {
              downloadExcelWorkbook({
                filename: `${tab === 'tcs' ? 'TCS' : 'GST'}_Calculation_Breakdown.xlsx`,
                sheets: [
                  {
                    name: 'Calculation',
                    headers: ['Particulars', 'Short Label', 'Amount (INR)'],
                    rows: activeRows.map((r) => [r.label, r.shortLabel, r.value]),
                  },
                ],
              });
            }}
            onCsv={() => {
              downloadBomCsv({
                filename: `${tab === 'tcs' ? 'TCS' : 'GST'}_Calculation_Breakdown.csv`,
                headers: ['Particulars', 'Amount (INR)'],
                rows: activeRows.map((r) => [r.label, r.value.toFixed(2)]),
              });
            }}
            onWord={() => {
              void downloadWordDocument({
                filename: `${tab === 'tcs' ? 'TCS' : 'GST'}_Calculation_Breakdown.docx`,
                title: tab === 'tcs' ? 'TCS Computation Statement' : 'GST Tax Breakdown Statement',
                subtitle:
                  tab === 'tcs'
                    ? `Direction: ${tcsReverse ? 'Reverse (Total → Sale Value)' : 'Forward (Sale Value → Total)'} | Rate: ${tcsRate}%`
                    : `Direction: ${taxForward ? 'Forward (Base → Total)' : 'Reverse (Total → Base)'} | Supply: ${interstate ? 'Interstate (IGST)' : 'Intra-State (CGST+SGST)'}`,
                kpis: activeRows.map((r) => ({ label: r.shortLabel, value: `₹ ${formatInr(r.value)}` })),
                table: {
                  title: 'Detailed Tax Schedule',
                  headers: ['Particulars', 'Amount (INR)'],
                  rows: activeRows.map((r) => [r.label, `₹ ${formatInr(r.value)}`]),
                },
              });
            }}
            onJson={() => {
              downloadJsonFile(`${tab === 'tcs' ? 'TCS' : 'GST'}_Calculation.json`, {
                mode: tab,
                rate: tab === 'tcs' ? tcsRate : effectiveGstRate,
                rows: activeRows,
              });
            }}
            onPdf={() => {
              exportStructuredReportPdf({
                title: tab === 'tcs' ? 'TCS Computation Statement' : 'GST Tax Breakdown Statement',
                subtitle: tab === 'tcs' ? `TCS @ ${tcsRate}%` : `GST @ ${effectiveGstRate ?? 0}%`,
                filename: `${tab === 'tcs' ? 'TCS' : 'GST'}_Calculation_Breakdown.pdf`,
                kpis: activeRows.map((r) => ({ label: r.shortLabel, value: `Rs. ${formatInr(r.value)}` })),
                table: {
                  title: 'Tax Breakdown',
                  headers: ['Particulars', 'Amount (INR)'],
                  rows: activeRows.map((r) => [r.label, `Rs. ${formatInr(r.value)}`]),
                },
              });
            }}
            onPrint={() => {
              void printHtmlDocument({
                title: tab === 'tcs' ? 'TCS Computation Statement' : 'GST Tax Breakdown Statement',
                bodyHtml: `
                  <h1>${tab === 'tcs' ? 'TCS Computation Statement' : 'GST Tax Breakdown Statement'}</h1>
                  <table>
                    <thead><tr><th>Particulars</th><th class="num">Amount (INR)</th></tr></thead>
                    <tbody>
                      ${activeRows
                        .map(
                          (r) =>
                            `<tr><td>${escapeHtml(r.label)}</td><td class="num">₹ ${formatInr(r.value)}</td></tr>`
                        )
                        .join('')}
                    </tbody>
                  </table>
                `,
              });
            }}
          />
        )}

        {/* Guidance Note */}
        <p className="text-xs text-[#475569] text-center leading-relaxed px-2">
          Amounts are shown to 2 decimals in Indian format (lakh / crore). Click any Copy button and press Ctrl+V directly inside Excel cells.
        </p>
      </div>
    </div>
  );
};
