import React, { useState, useMemo } from 'react';
import { ArrowLeft, Calculator, CheckCircle2, TrendingDown, HelpCircle } from 'lucide-react';
import { formatINR } from '../../utils/numberToWords';

interface TaxCalculatorToolProps {
  onBack: () => void;
}

export const TaxCalculatorTool: React.FC<TaxCalculatorToolProps> = ({ onBack }) => {
  const [grossSalary, setGrossSalary] = useState<number>(0);
  const [sec80C, setSec80C] = useState<number>(0);
  const [sec80D, setSec80D] = useState<number>(0);
  const [hraExemption, setHraExemption] = useState<number>(0);
  const [homeLoanInterest, setHomeLoanInterest] = useState<number>(0);

  // New Regime Calculation (Budget updated: Standard Deduction ₹75,000)
  const newRegimeResult = useMemo(() => {
    const stdDeduction = 75000;
    const taxableIncome = Math.max(0, grossSalary - stdDeduction);

    let tax = 0;
    if (taxableIncome <= 300000) {
      tax = 0;
    } else if (taxableIncome <= 700000) {
      tax = (taxableIncome - 300000) * 0.05;
    } else if (taxableIncome <= 1000000) {
      tax = 400000 * 0.05 + (taxableIncome - 700000) * 0.10;
    } else if (taxableIncome <= 1200000) {
      tax = 400000 * 0.05 + 300000 * 0.10 + (taxableIncome - 1000000) * 0.15;
    } else if (taxableIncome <= 1500000) {
      tax = 400000 * 0.05 + 300000 * 0.10 + 200000 * 0.15 + (taxableIncome - 1200000) * 0.20;
    } else {
      tax = 400000 * 0.05 + 300000 * 0.10 + 200000 * 0.15 + 300000 * 0.20 + (taxableIncome - 1500000) * 0.30;
    }

    // Section 87A rebate under New Regime (Rebate up to ₹25,000 if taxable income <= 7,00,000)
    if (taxableIncome <= 700000) {
      tax = 0;
    }

    const cess = tax * 0.04;
    const totalTax = tax + cess;

    return {
      taxableIncome,
      baseTax: tax,
      cess,
      totalTax,
      stdDeduction,
    };
  }, [grossSalary]);

  // Old Regime Calculation
  const oldRegimeResult = useMemo(() => {
    const stdDeduction = 50000;
    const capped80C = Math.min(150000, sec80C);
    const cappedHomeLoan = Math.min(200000, homeLoanInterest);
    const totalDeductions = stdDeduction + capped80C + sec80D + hraExemption + cappedHomeLoan;

    const taxableIncome = Math.max(0, grossSalary - totalDeductions);

    let tax = 0;
    if (taxableIncome <= 250000) {
      tax = 0;
    } else if (taxableIncome <= 500000) {
      tax = (taxableIncome - 250000) * 0.05;
    } else if (taxableIncome <= 1000000) {
      tax = 250000 * 0.05 + (taxableIncome - 500000) * 0.20;
    } else {
      tax = 250000 * 0.05 + 500000 * 0.20 + (taxableIncome - 1000000) * 0.30;
    }

    // Section 87A rebate under Old Regime (Rebate up to ₹12,500 if taxable income <= 5,00,000)
    if (taxableIncome <= 500000) {
      tax = 0;
    }

    const cess = tax * 0.04;
    const totalTax = tax + cess;

    return {
      taxableIncome,
      baseTax: tax,
      cess,
      totalTax,
      totalDeductions,
    };
  }, [grossSalary, sec80C, sec80D, hraExemption, homeLoanInterest]);

  const taxDifference = Math.abs(newRegimeResult.totalTax - oldRegimeResult.totalTax);
  const isNewBetter = newRegimeResult.totalTax <= oldRegimeResult.totalTax;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="pb-6 border-b border-slate-200">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to All Tools
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center font-bold">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              New vs Old Tax Regime Calculator (FY 2024-25 &amp; 2025-26)
            </h1>
            <p className="text-xs text-slate-500">
              Updated with enhanced ₹75,000 standard deduction &amp; revised Section 115BAC tax brackets.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-8">
        {/* Left Inputs */}
        <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Income &amp; Deductions Particulars
          </h3>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Annual Gross Salary / CTC (₹)
            </label>
            <input
              type="number"
              value={grossSalary || ''}
              onChange={(e) => setGrossSalary(Number(e.target.value))}
              placeholder="e.g. 1200000"
              className="w-full px-3 py-2 text-sm font-mono font-bold rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
            />
          </div>

          <div className="pt-2 border-t border-slate-100">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
              Deductions for Old Regime (Section 80C, 80D, HRA)
            </span>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  Section 80C (EPF, PPF, ELSS, Life Ins) [Max ₹1.5L]
                </label>
                <input
                  type="number"
                  value={sec80C || ''}
                  onChange={(e) => setSec80C(Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  Section 80D (Health Insurance Premium)
                </label>
                <input
                  type="number"
                  value={sec80D || ''}
                  onChange={(e) => setSec80D(Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  House Rent Allowance (HRA) Exemption
                </label>
                <input
                  type="number"
                  value={hraExemption || ''}
                  onChange={(e) => setHraExemption(Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  Section 24(b) Home Loan Interest [Max ₹2L]
                </label>
                <input
                  type="number"
                  value={homeLoanInterest || ''}
                  onChange={(e) => setHomeLoanInterest(Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Comparison Cards */}
        <div className="lg:col-span-7 space-y-6">
          {/* Winner Recommendation Banner */}
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <span className="text-xs font-bold text-emerald-900 block">
                  {isNewBetter ? 'New Tax Regime is Better for You' : 'Old Tax Regime Saves You More'}
                </span>
                <span className="text-xs text-emerald-800">
                  You save approximately <strong>{formatINR(taxDifference)}</strong> by opting for the {isNewBetter ? 'New' : 'Old'} Regime.
                </span>
              </div>
            </div>
          </div>

          {/* Side by side comparison cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* New Regime Card */}
            <div className={`p-6 rounded-2xl border transition-all ${
              isNewBetter ? 'bg-white border-emerald-500 shadow-md ring-2 ring-emerald-500/20' : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-extrabold text-slate-900">New Regime (Default)</span>
                {isNewBetter && (
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    Recommended
                  </span>
                )}
              </div>

              <div className="space-y-2 text-xs border-b border-slate-100 pb-4 mb-4">
                <div className="flex justify-between text-slate-600">
                  <span>Gross Salary:</span>
                  <span className="font-mono">{formatINR(grossSalary)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Standard Deduction:</span>
                  <span className="font-mono">- ₹75,000</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-100">
                  <span>Net Taxable Income:</span>
                  <span className="font-mono">{formatINR(newRegimeResult.taxableIncome)}</span>
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Income Tax:</span>
                  <span className="font-mono">{formatINR(newRegimeResult.baseTax)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Health &amp; Edu Cess (4%):</span>
                  <span className="font-mono">{formatINR(newRegimeResult.cess)}</span>
                </div>
                <div className="flex justify-between text-base font-extrabold text-slate-900 pt-2 border-t border-slate-200">
                  <span>Total Tax Payable:</span>
                  <span className="font-mono text-emerald-700">{formatINR(newRegimeResult.totalTax)}</span>
                </div>
              </div>
            </div>

            {/* Old Regime Card */}
            <div className={`p-6 rounded-2xl border transition-all ${
              !isNewBetter ? 'bg-white border-emerald-500 shadow-md ring-2 ring-emerald-500/20' : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-extrabold text-slate-900">Old Tax Regime</span>
                {!isNewBetter && (
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    Recommended
                  </span>
                )}
              </div>

              <div className="space-y-2 text-xs border-b border-slate-100 pb-4 mb-4">
                <div className="flex justify-between text-slate-600">
                  <span>Gross Salary:</span>
                  <span className="font-mono">{formatINR(grossSalary)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Total Deductions:</span>
                  <span className="font-mono text-emerald-700">- {formatINR(oldRegimeResult.totalDeductions)}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-100">
                  <span>Net Taxable Income:</span>
                  <span className="font-mono">{formatINR(oldRegimeResult.taxableIncome)}</span>
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Income Tax:</span>
                  <span className="font-mono">{formatINR(oldRegimeResult.baseTax)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Health &amp; Edu Cess (4%):</span>
                  <span className="font-mono">{formatINR(oldRegimeResult.cess)}</span>
                </div>
                <div className="flex justify-between text-base font-extrabold text-slate-900 pt-2 border-t border-slate-200">
                  <span>Total Tax Payable:</span>
                  <span className="font-mono text-slate-900">{formatINR(oldRegimeResult.totalTax)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
