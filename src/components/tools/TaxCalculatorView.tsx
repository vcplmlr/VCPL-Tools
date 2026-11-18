import React, { useMemo, useState } from 'react';
import { Calculator, CheckCircle2, Info, RotateCcw, Scale } from 'lucide-react';
import { ToolCatalogItem } from '../../types/tools';
import { formatINR } from '../../utils/numberToWords';
import {
  downloadBomCsv,
  downloadExcelWorkbook,
  downloadJsonFile,
  downloadWordDocument,
  exportStructuredReportPdf,
  printHtmlDocument,
} from '../../utils/printReport';
import { ToolExportBar } from './ToolExportBar';

interface TaxCalculatorViewProps {
  tool?: ToolCatalogItem;
  onBack?: () => void;
}

type AgeBracket = 'below60' | 'senior60' | 'super80';

function computeNewRegimeTax(taxableIncome: number): { slabTax: number; rebate: number; cess: number; total: number } {
  // FY 2025-26 / AY 2026-27 Budget New Regime Slabs
  const slabs: [number, number][] = [
    [400000, 0],
    [400000, 0.05],
    [400000, 0.1],
    [400000, 0.15],
    [400000, 0.2],
    [400000, 0.25],
    [Infinity, 0.3],
  ];

  let remaining = Math.max(0, taxableIncome);
  let slabTax = 0;
  for (const [band, rate] of slabs) {
    if (remaining <= 0) break;
    const chunk = Math.min(remaining, band);
    slabTax += chunk * rate;
    remaining -= chunk;
  }

  // Section 87A Rebate under New Regime up to Rs 12,00,000 taxable income (marginal relief above 12L)
  let rebate = 0;
  if (taxableIncome <= 1200000) {
    rebate = slabTax;
  } else {
    const excessIncome = taxableIncome - 1200000;
    if (slabTax > excessIncome) {
      rebate = slabTax - excessIncome;
    }
  }

  const taxAfterRebate = Math.max(0, slabTax - rebate);
  const cess = taxAfterRebate * 0.04;
  return {
    slabTax: Math.round(slabTax),
    rebate: Math.round(rebate),
    cess: Math.round(cess),
    total: Math.round(taxAfterRebate + cess),
  };
}

function computeOldRegimeTax(
  taxableIncome: number,
  age: AgeBracket
): { slabTax: number; rebate: number; cess: number; total: number } {
  const exemptLimit = age === 'super80' ? 500000 : age === 'senior60' ? 300000 : 250000;
  let slabTax = 0;

  if (taxableIncome > exemptLimit) {
    if (age === 'super80') {
      const band20 = Math.min(Math.max(0, taxableIncome - 500000), 500000);
      const band30 = Math.max(0, taxableIncome - 1000000);
      slabTax = band20 * 0.2 + band30 * 0.3;
    } else {
      const band5 = Math.min(Math.max(0, taxableIncome - exemptLimit), 500000 - exemptLimit);
      const band20 = Math.min(Math.max(0, taxableIncome - 500000), 500000);
      const band30 = Math.max(0, taxableIncome - 1000000);
      slabTax = band5 * 0.05 + band20 * 0.2 + band30 * 0.3;
    }
  }

  const rebate = taxableIncome <= 500000 ? Math.min(12500, slabTax) : 0;
  const taxAfterRebate = Math.max(0, slabTax - rebate);
  const cess = taxAfterRebate * 0.04;
  return {
    slabTax: Math.round(slabTax),
    rebate: Math.round(rebate),
    cess: Math.round(cess),
    total: Math.round(taxAfterRebate + cess),
  };
}

export const TaxCalculatorView: React.FC<TaxCalculatorViewProps> = ({ tool, onBack }) => {
  const [grossSalary, setGrossSalary] = useState<string>('');
  const [otherIncome, setOtherIncome] = useState<string>('');
  const [isSalaried, setIsSalaried] = useState<boolean>(true);
  const [ageBracket, setAgeBracket] = useState<AgeBracket>('below60');
  const [sec80C, setSec80C] = useState<string>('');
  const [sec80D, setSec80D] = useState<string>('');
  const [hraExempt, setHraExempt] = useState<string>('');
  const [homeLoanInterest, setHomeLoanInterest] = useState<string>('');
  const [nps80CCD, setNps80CCD] = useState<string>('');

  const comparison = useMemo(() => {
    const grossNum = Math.max(0, Number(grossSalary) || 0);
    const otherNum = Math.max(0, Number(otherIncome) || 0);
    const totalGross = grossNum + otherNum;

    // New Regime: Standard deduction 75,000 for salaried (capped at gross salary/income)
    const stdDedNew = isSalaried && totalGross > 0 ? Math.min(totalGross, 75000) : 0;
    const taxableNew = Math.max(0, totalGross - stdDedNew);
    const newTax = computeNewRegimeTax(taxableNew);

    // Old Regime: Standard deduction 50,000 + Chapter VI-A & HRA/Sec 24
    const stdDedOld = isSalaried && totalGross > 0 ? Math.min(totalGross, 50000) : 0;
    const capped80C = Math.min(150000, Math.max(0, Number(sec80C) || 0));
    const capped80D = Math.min(100000, Math.max(0, Number(sec80D) || 0));
    const cappedHome = Math.min(200000, Math.max(0, Number(homeLoanInterest) || 0));
    const cappedNps = Math.min(50000, Math.max(0, Number(nps80CCD) || 0));
    const totalOldDeductions =
      stdDedOld + capped80C + capped80D + Math.max(0, Number(hraExempt) || 0) + cappedHome + cappedNps;
    const taxableOld = Math.max(0, totalGross - totalOldDeductions);
    const oldTax = computeOldRegimeTax(taxableOld, ageBracket);

    const savings = Math.abs(newTax.total - oldTax.total);
    const winner = newTax.total <= oldTax.total ? 'New Regime' : 'Old Regime';

    return {
      totalGross,
      stdDedNew,
      taxableNew,
      newTax,
      totalOldDeductions,
      taxableOld,
      oldTax,
      savings,
      winner,
    };
  }, [grossSalary, otherIncome, isSalaried, ageBracket, sec80C, sec80D, hraExempt, homeLoanInterest, nps80CCD]);

  const handleClear = () => {
    setGrossSalary('');
    setOtherIncome('');
    setIsSalaried(true);
    setAgeBracket('below60');
    setSec80C('');
    setSec80D('');
    setHraExempt('');
    setHomeLoanInterest('');
    setNps80CCD('');
  };

  return (
    <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#2F3E4E]/15">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5 text-[#2F3E4E]" />
            {tool?.categoryName || 'Tax & GST'} · {tool?.code || 'TX-03'}
          </span>
          <h1 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] mt-1">
            {tool?.title || 'Income Tax Calculator (New vs Old Regime)'}
          </h1>
          <p className="text-xs sm:text-sm text-[#475569] mt-0.5">
            {tool?.description ||
              'Compare FY 2025-26 / AY 2026-27 New Tax Regime (Rs 75k Std Ded + 87A up to Rs 12L) against Old Regime Chapter VI-A deductions.'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Clear All
          </button>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] cursor-pointer whitespace-nowrap"
            >
              Close
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Inputs */}
        <div className="lg:col-span-6 space-y-4 bg-[#FEF2C8]/50 border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 lg:max-h-[calc(100dvh-5.5rem)] lg:overflow-y-auto lg:pr-1.5">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-sm text-[#2F3E4E] flex items-center gap-1.5">
              <Calculator className="w-4 h-4" /> Income &amp; Deductions (INR)
            </h2>
            <label className="inline-flex items-center gap-2 text-xs font-bold text-[#2F3E4E] cursor-pointer">
              <input
                type="checkbox"
                checked={isSalaried}
                onChange={(e) => setIsSalaried(e.target.checked)}
                className="w-4 h-4 accent-[#2F3E4E]"
              />
              Salaried (Std Deduction)
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-[#2F3E4E] mb-1">
                Annual Gross Salary / Income (₹)
              </label>
              <input
                type="number"
                min={0}
                step={25000}
                value={grossSalary}
                onChange={(e) => setGrossSalary(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white font-mono text-sm font-bold text-[#2F3E4E]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#2F3E4E] mb-1">
                Interest / Other Income (₹)
              </label>
              <input
                type="number"
                min={0}
                step={5000}
                value={otherIncome}
                onChange={(e) => setOtherIncome(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white font-mono text-sm font-bold text-[#2F3E4E]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#2F3E4E] mb-1">Age Category</label>
              <select
                value={ageBracket}
                onChange={(e) => setAgeBracket(e.target.value as AgeBracket)}
                className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white text-xs font-bold text-[#2F3E4E]"
              >
                <option value="below60">Below 60 Years</option>
                <option value="senior60">Senior Citizen (60–79)</option>
                <option value="super80">Super Senior (80+)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#2F3E4E] mb-1">
                80C (PPF, ELSS, EPF — Max 1.5L)
              </label>
              <input
                type="number"
                min={0}
                max={150000}
                step={10000}
                value={sec80C}
                onChange={(e) => setSec80C(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white font-mono text-sm font-bold text-[#2F3E4E]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#2F3E4E] mb-1">
                80D Health Insurance (₹)
              </label>
              <input
                type="number"
                min={0}
                max={100000}
                step={5000}
                value={sec80D}
                onChange={(e) => setSec80D(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white font-mono text-sm font-bold text-[#2F3E4E]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#2F3E4E] mb-1">
                HRA / LTA Exemption (Old Regime)
              </label>
              <input
                type="number"
                min={0}
                step={10000}
                value={hraExempt}
                onChange={(e) => setHraExempt(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white font-mono text-sm font-bold text-[#2F3E4E]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#2F3E4E] mb-1">
                Home Loan Interest 24(b) (Max 2L)
              </label>
              <input
                type="number"
                min={0}
                max={200000}
                step={10000}
                value={homeLoanInterest}
                onChange={(e) => setHomeLoanInterest(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white font-mono text-sm font-bold text-[#2F3E4E]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#2F3E4E] mb-1">
                NPS 80CCD(1B) (Max 50k)
              </label>
              <input
                type="number"
                min={0}
                max={50000}
                step={5000}
                value={nps80CCD}
                onChange={(e) => setNps80CCD(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white font-mono text-sm font-bold text-[#2F3E4E]"
              />
            </div>
          </div>
        </div>

        {/* Comparison Results */}
        <div className="lg:col-span-6 lg:sticky lg:top-20 space-y-4">
          <div className="p-4 rounded-2xl bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#2F3E4E]/80">
                Recommended Option
              </p>
              <p className="font-display font-extrabold text-xl text-[#2F3E4E] flex items-center gap-2 mt-0.5">
                <CheckCircle2 className="w-5 h-5" />
                {comparison.winner}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-bold uppercase text-[#2F3E4E]/80">Annual Tax Saved</p>
              <p className="font-mono tabular-nums font-extrabold text-xl text-[#2F3E4E]">
                {formatINR(comparison.savings)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* New Regime Card */}
            <div
              className={`p-5 rounded-2xl border-[1.5px] border-[#2F3E4E] ${
                comparison.winner === 'New Regime' ? 'bg-[#CEE5DC]/55' : 'bg-white'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#2F3E4E] text-[#FFFDF5]">
                New Regime (FY 25-26)
              </span>
              <div className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#475569]">Gross Income</span>
                  <span className="font-mono tabular-nums font-bold">{formatINR(comparison.totalGross)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#475569]">Std Deduction</span>
                  <span className="font-mono tabular-nums font-bold">-{formatINR(comparison.stdDedNew)}</span>
                </div>
                <div className="flex justify-between border-t border-[#2F3E4E]/15 pt-1.5">
                  <span className="font-bold text-[#2F3E4E]">Taxable Income</span>
                  <span className="font-mono tabular-nums font-bold">{formatINR(comparison.taxableNew)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#475569]">Slab Tax</span>
                  <span className="font-mono tabular-nums">{formatINR(comparison.newTax.slabTax)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#475569]">87A Rebate / Relief</span>
                  <span className="font-mono tabular-nums text-emerald-800">
                    -{formatINR(comparison.newTax.rebate)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#475569]">4% Health &amp; Edu Cess</span>
                  <span className="font-mono tabular-nums">{formatINR(comparison.newTax.cess)}</span>
                </div>
                <div className="flex justify-between border-t-[1.5px] border-[#2F3E4E] pt-2 text-sm font-extrabold text-[#2F3E4E]">
                  <span>Total Tax Payable</span>
                  <span className="font-mono tabular-nums">{formatINR(comparison.newTax.total)}</span>
                </div>
              </div>
            </div>

            {/* Old Regime Card */}
            <div
              className={`p-5 rounded-2xl border-[1.5px] border-[#2F3E4E] ${
                comparison.winner === 'Old Regime' ? 'bg-[#CEE5DC]/55' : 'bg-white'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#FFFDF5] border border-[#2F3E4E] text-[#2F3E4E]">
                Old Regime
              </span>
              <div className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#475569]">Gross Income</span>
                  <span className="font-mono tabular-nums font-bold">{formatINR(comparison.totalGross)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#475569]">Total Deductions</span>
                  <span className="font-mono tabular-nums font-bold">
                    -{formatINR(comparison.totalOldDeductions)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-[#2F3E4E]/15 pt-1.5">
                  <span className="font-bold text-[#2F3E4E]">Taxable Income</span>
                  <span className="font-mono tabular-nums font-bold">{formatINR(comparison.taxableOld)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#475569]">Slab Tax</span>
                  <span className="font-mono tabular-nums">{formatINR(comparison.oldTax.slabTax)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#475569]">87A Rebate</span>
                  <span className="font-mono tabular-nums text-emerald-800">
                    -{formatINR(comparison.oldTax.rebate)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#475569]">4% Health &amp; Edu Cess</span>
                  <span className="font-mono tabular-nums">{formatINR(comparison.oldTax.cess)}</span>
                </div>
                <div className="flex justify-between border-t-[1.5px] border-[#2F3E4E] pt-2 text-sm font-extrabold text-[#2F3E4E]">
                  <span>Total Tax Payable</span>
                  <span className="font-mono tabular-nums">{formatINR(comparison.oldTax.total)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#FEF2C8]/65 border border-[#2F3E4E]/25 text-xs text-[#475569] flex items-start gap-2">
            <Info className="w-4 h-4 text-[#2F3E4E] shrink-0 mt-0.5" />
            <span>
              Computes FY 2025-26 / AY 2026-27 resident individual income tax slabs (excluding surcharge above ₹50L).
            </span>
          </div>

          <ToolExportBar
            onClear={handleClear}
            onExcel={() => {
              downloadExcelWorkbook({
                filename: 'Income_Tax_FY25-26_Comparison.xlsx',
                sheets: [
                  {
                    name: 'Tax_Comparison',
                    headers: ['Particulars', 'New Regime (Rs.)', 'Old Regime (Rs.)'],
                    rows: [
                      ['Gross Total Income', comparison.totalGross, comparison.totalGross],
                      ['Deductions & Exemptions', comparison.stdDedNew, comparison.totalOldDeductions],
                      ['Net Taxable Income', comparison.taxableNew, comparison.taxableOld],
                      ['Slab Tax', comparison.newTax.slabTax, comparison.oldTax.slabTax],
                      ['Sec 87A Rebate / Relief', -comparison.newTax.rebate, -comparison.oldTax.rebate],
                      ['Health & Education Cess (4%)', comparison.newTax.cess, comparison.oldTax.cess],
                      ['Total Tax Payable', comparison.newTax.total, comparison.oldTax.total],
                      ['Recommended Regime', comparison.winner, `Saves Rs. ${comparison.savings}`],
                    ],
                  },
                ],
              });
            }}
            onCsv={() => {
              downloadBomCsv({
                filename: 'Income_Tax_FY25-26_Comparison.csv',
                preambleLines: [
                  ['Income Tax Regime Comparison (FY 2025-26 / AY 2026-27)'],
                  ['Recommended Option', comparison.winner],
                  ['Annual Tax Saved (Rs.)', comparison.savings],
                ],
                headers: ['Particulars', 'New Regime (Rs.)', 'Old Regime (Rs.)'],
                rows: [
                  ['Gross Total Income', comparison.totalGross, comparison.totalGross],
                  ['Deductions & Exemptions', comparison.stdDedNew, comparison.totalOldDeductions],
                  ['Net Taxable Income', comparison.taxableNew, comparison.taxableOld],
                  ['Slab Tax', comparison.newTax.slabTax, comparison.oldTax.slabTax],
                  ['Sec 87A Rebate / Relief', -comparison.newTax.rebate, -comparison.oldTax.rebate],
                  ['Health & Education Cess (4%)', comparison.newTax.cess, comparison.oldTax.cess],
                  ['Total Tax Payable', comparison.newTax.total, comparison.oldTax.total],
                ],
              });
            }}
            onWord={() => {
              void downloadWordDocument({
                filename: 'Income_Tax_FY25-26_Comparison.docx',
                title: 'Income Tax Regime Comparison (FY 2025-26 / AY 2026-27)',
                subtitle: `Recommended: ${comparison.winner} | Annual Savings: ${formatINR(comparison.savings)}`,
                kpis: [
                  { label: 'Gross Total Income', value: formatINR(comparison.totalGross) },
                  { label: 'New Regime Tax', value: formatINR(comparison.newTax.total) },
                  { label: 'Old Regime Tax', value: formatINR(comparison.oldTax.total) },
                  { label: 'Annual Savings', value: formatINR(comparison.savings) },
                ],
                table: {
                  title: 'Side-by-Side Tax Computation',
                  headers: ['Particulars', 'New Regime', 'Old Regime'],
                  rows: [
                    ['Gross Total Income', formatINR(comparison.totalGross), formatINR(comparison.totalGross)],
                    ['Deductions & Exemptions', formatINR(comparison.stdDedNew), formatINR(comparison.totalOldDeductions)],
                    ['Net Taxable Income', formatINR(comparison.taxableNew), formatINR(comparison.taxableOld)],
                    ['Slab Tax', formatINR(comparison.newTax.slabTax), formatINR(comparison.oldTax.slabTax)],
                    ['Sec 87A Rebate / Relief', `-${formatINR(comparison.newTax.rebate)}`, `-${formatINR(comparison.oldTax.rebate)}`],
                    ['4% Health & Edu Cess', formatINR(comparison.newTax.cess), formatINR(comparison.oldTax.cess)],
                    ['Total Tax Payable', formatINR(comparison.newTax.total), formatINR(comparison.oldTax.total)],
                  ],
                },
              });
            }}
            onJson={() => {
              downloadJsonFile('Income_Tax_FY25-26_Comparison.json', {
                inputs: { grossSalary, otherIncome, isSalaried, ageBracket, sec80C, sec80D, hraExempt, homeLoanInterest, nps80CCD },
                comparison,
              });
            }}
            onPdf={() => {
              exportStructuredReportPdf({
                title: 'Income Tax Comparison Report (FY 2025-26)',
                subtitle: `Recommended: ${comparison.winner} | Annual Savings: ${formatINR(comparison.savings)}`,
                filename: 'Income_Tax_FY25-26_Comparison.pdf',
                kpis: [
                  { label: 'Gross Total Income', value: formatINR(comparison.totalGross) },
                  { label: 'New Regime Tax', value: formatINR(comparison.newTax.total) },
                  { label: 'Old Regime Tax', value: formatINR(comparison.oldTax.total) },
                  { label: 'Winner & Savings', value: `${comparison.winner} (${formatINR(comparison.savings)})` },
                ],
                table: {
                  title: 'Side-by-Side Tax Computation',
                  headers: ['Particulars', 'New Regime', 'Old Regime'],
                  rows: [
                    ['Gross Total Income', formatINR(comparison.totalGross), formatINR(comparison.totalGross)],
                    ['Deductions & Exemptions', formatINR(comparison.stdDedNew), formatINR(comparison.totalOldDeductions)],
                    ['Net Taxable Income', formatINR(comparison.taxableNew), formatINR(comparison.taxableOld)],
                    ['Slab Tax', formatINR(comparison.newTax.slabTax), formatINR(comparison.oldTax.slabTax)],
                    ['Sec 87A Rebate / Relief', `-${formatINR(comparison.newTax.rebate)}`, `-${formatINR(comparison.oldTax.rebate)}`],
                    ['4% Health & Edu Cess', formatINR(comparison.newTax.cess), formatINR(comparison.oldTax.cess)],
                    ['Total Tax Payable', formatINR(comparison.newTax.total), formatINR(comparison.oldTax.total)],
                  ],
                },
              });
            }}
            onPrint={() => {
              void printHtmlDocument({
                title: 'Income Tax Comparison (FY 2025-26)',
                bodyHtml: `
                  <h1>Income Tax Comparison Report (FY 2025-26 / AY 2026-27)</h1>
                  <p style="color:#475569;margin-bottom:10px;">Recommended: <strong>${comparison.winner}</strong> · Annual Tax Savings: <strong>${formatINR(comparison.savings)}</strong></p>
                  <div class="kpi-grid">
                    <div class="kpi-card"><div class="kpi-label">Gross Total Income</div><div class="kpi-val">${formatINR(comparison.totalGross)}</div></div>
                    <div class="kpi-card"><div class="kpi-label">New Regime Tax</div><div class="kpi-val">${formatINR(comparison.newTax.total)}</div></div>
                    <div class="kpi-card"><div class="kpi-label">Old Regime Tax</div><div class="kpi-val">${formatINR(comparison.oldTax.total)}</div></div>
                    <div class="kpi-card"><div class="kpi-label">Annual Tax Saved</div><div class="kpi-val">${formatINR(comparison.savings)}</div></div>
                  </div>
                  <table>
                    <thead><tr><th>Particulars</th><th class="num">New Regime</th><th class="num">Old Regime</th></tr></thead>
                    <tbody>
                      <tr><td>Gross Total Income</td><td class="num">${formatINR(comparison.totalGross)}</td><td class="num">${formatINR(comparison.totalGross)}</td></tr>
                      <tr><td>Deductions &amp; Exemptions</td><td class="num">-${formatINR(comparison.stdDedNew)}</td><td class="num">-${formatINR(comparison.totalOldDeductions)}</td></tr>
                      <tr><td>Net Taxable Income</td><td class="num">${formatINR(comparison.taxableNew)}</td><td class="num">${formatINR(comparison.taxableOld)}</td></tr>
                      <tr><td>Slab Tax</td><td class="num">${formatINR(comparison.newTax.slabTax)}</td><td class="num">${formatINR(comparison.oldTax.slabTax)}</td></tr>
                      <tr><td>87A Rebate / Marginal Relief</td><td class="num">-${formatINR(comparison.newTax.rebate)}</td><td class="num">-${formatINR(comparison.oldTax.rebate)}</td></tr>
                      <tr><td>Health &amp; Education Cess (4%)</td><td class="num">${formatINR(comparison.newTax.cess)}</td><td class="num">${formatINR(comparison.oldTax.cess)}</td></tr>
                      <tr><th>Total Tax Payable</th><th class="num">${formatINR(comparison.newTax.total)}</th><th class="num">${formatINR(comparison.oldTax.total)}</th></tr>
                    </tbody>
                  </table>
                `,
              });
            }}
          />
        </div>
      </div>
    </div>
  );
};
