import React from 'react';
import { TAX_FAQS } from '../data/siteConfig';
import { FaqAccordion } from './FaqAccordion';

interface TaxGuideArticleProps {
  onJumpToCalculator?: () => void;
}

export const TaxGuideArticle: React.FC<TaxGuideArticleProps> = ({ onJumpToCalculator }) => {
  return (
    <article
      id="tax-guide"
      className="tactile-card scroll-mt-24 space-y-10 rounded-2xl bg-white p-6 sm:p-8 lg:p-10 dark:bg-slate-800"
    >
      {/* Article Header */}
      <header className="border-b border-slate-200 pb-6 dark:border-slate-800">
        <div className="text-xs font-semibold uppercase tracking-wider text-orange-700 dark:text-orange-400">
          Complete Salaried Employee Guide &middot; FY 2026-27 (AY 2027-28)
        </div>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-800 sm:text-3xl dark:text-white text-balance">
          Income Tax Calculator for Salaried Employees in India – Complete Guide to Old and New Tax Regimes
        </h2>
        <p className="mt-3 text-base leading-relaxed text-slate-600 dark:text-slate-300">
          Understanding how your salary is taxed under Indian Income Tax rules helps you choose the lower-tax regime, plan deductions before March 31, and avoid unexpected TDS deductions at the end of the financial year. This comprehensive guide explains every slab, exemption, deduction, surcharge rule, and worked calculation for Financial Year 2026-27 (Assessment Year 2027-28).
        </p>
      </header>

      <div className="space-y-8 text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">
        {/* Introduction */}
        <section className="space-y-3">
          <h3 className="text-xl font-bold text-slate-800 dark:text-white">
            Why Salaried Employees Need Accurate Tax Planning
          </h3>
          <p>
            For salaried individuals in India, Cost-to-Company (CTC) is rarely the same as taxable salary or monthly take-home pay. Employer payroll departments compute monthly Tax Deducted at Source (TDS) based on projected annual salary, declared allowances such as House Rent Allowance (HRA) and Leave Travel Allowance (LTA), and Chapter VI-A investments. However, non-salary earnings—such as savings bank interest, fixed deposit interest, stock or mutual fund dividends, capital gains from equity or property, and digital asset gains—often sit outside employer payroll records.
          </p>
          <p>
            Using a dedicated Income Tax Calculator for FY 2026-27 lets you consolidate salary, perquisites, deductions, house property interest, and capital gains in one place so you can compare the Old Tax Regime and New Tax Regime accurately before submitting investment proofs or filing your Income Tax Return (ITR).
          </p>
        </section>

        {/* What Is Income Tax in India */}
        <section className="space-y-3">
          <h3 className="text-xl font-bold text-slate-800 dark:text-white">
            What Is Income Tax in India &amp; Who Needs to Pay It?
          </h3>
          <p>
            Income tax is a direct tax levied by the Central Government on the annual income earned by individuals, Hindu Undivided Families (HUFs), and other taxpayers during a Financial Year (1 April to 31 March). For income earned between <strong>1 April 2026 and 31 March 2027 (FY 2026-27)</strong>, the corresponding <strong>Assessment Year is AY 2027-28</strong>.
          </p>
          <p>
            Any resident individual whose Gross Total Income exceeds the basic exemption threshold—or who has taxable capital gains, foreign assets, or tax liability—must compute tax under the applicable slab rates and file an ITR by the statutory due date.
          </p>
        </section>

        {/* How Income Tax Is Calculated for Salaried Employees */}
        <section className="space-y-4">
          <h3 className="text-xl font-bold text-slate-800 dark:text-white">
            How Income Tax Is Calculated for Salaried Employees
          </h3>
          <p>
            Whether you calculate tax manually or use the workbook engine above, Indian salaried tax computation follows a clear sequence:
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-[#FAF9F5] p-4 dark:border-slate-800 dark:bg-[#0F172A]/60">
              <h4 className="text-sm font-extrabold text-slate-800 dark:text-white">
                Compute Gross Salary
              </h4>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Add Basic Salary, Dearness Allowance (DA), HRA, Conveyance, Special Allowance, Bonus, Employer NPS contribution, and taxable Perquisites (such as company accommodation or car perks).
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-[#FAF9F5] p-4 dark:border-slate-800 dark:bg-[#0F172A]/60">
              <h4 className="text-sm font-extrabold text-slate-800 dark:text-white">
                Subtract Salary Exemptions &amp; Section 16 Deductions
              </h4>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Deduct eligible Section 10 allowances (HRA exemption u/s 10(13A), LTA u/s 10(5), Children Education Allowance, Gratuity/other u/s 10(10)), Standard Deduction (₹50,000 in Old; ₹75,000 in New), and Profession Tax (Old Regime only).
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-[#FAF9F5] p-4 dark:border-slate-800 dark:bg-[#0F172A]/60">
              <h4 className="text-sm font-extrabold text-slate-800 dark:text-white">
                Add Income Under Other Heads
              </h4>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Include Income from House Property (let-out rent minus municipal taxes, 30% standard deduction, and home loan interest u/s 24(b), or self-occupied home loan interest loss up to ₹2,00,000 in Old Regime), Capital Gains, Bank Interest, and Dividends to arrive at <strong>Gross Total Income</strong>.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-[#FAF9F5] p-4 dark:border-slate-800 dark:bg-[#0F172A]/60">
              <h4 className="text-sm font-extrabold text-slate-800 dark:text-white">
                Subtract Eligible Chapter VI-A &amp; 80C Deductions
              </h4>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Reduce Gross Total Income by Section 80C/80CCD(1B), 80D, 80E, 80G, 80TTA/80TTB (in Old Regime), and Employer NPS u/s 80CCD(2) (in both regimes) to reach <strong>Net Taxable Income</strong>.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-[#FAF9F5] p-4 dark:border-slate-800 dark:bg-[#0F172A]/60">
              <h4 className="text-sm font-extrabold text-slate-800 dark:text-white">
                Apply Slab Rates, Special Rates &amp; Section 87A Rebate
              </h4>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Calculate slab tax on normal income, add special-rate taxes (e.g., 20% STCG equity, 12.5% LTCG, 30% virtual digital assets), and subtract eligible Section 87A relief.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-[#FAF9F5] p-4 dark:border-slate-800 dark:bg-[#0F172A]/60">
              <h4 className="text-sm font-extrabold text-slate-800 dark:text-white">
                Add Surcharge &amp; 4% Health and Education Cess
              </h4>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Apply surcharge (if taxable income exceeds ₹50 lakh) and 4% Health &amp; Education Cess to get Total Tax Liability, then subtract TDS and Advance Tax already paid.
              </p>
            </div>
          </div>
        </section>

        {/* Old Tax Regime vs New Tax Regime */}
        <section className="space-y-4">
          <h3 className="text-xl font-bold text-slate-800 dark:text-white">
            Old Tax Regime vs New Tax Regime (FY 2026-27 Comparison)
          </h3>
          <p>
            The New Tax Regime is the default tax regime in India, designed around lower tax slab rates and minimal paperwork without requiring tax-saving lock-in investments. The Old Tax Regime retains higher slab rates but rewards taxpayers who incur substantial house rent, home loan interest, life/health insurance premiums, and retirement contributions.
          </p>

          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">Feature / Deduction</th>
                  <th className="px-4 py-3">Old Tax Regime</th>
                  <th className="px-4 py-3">New Tax Regime (Default)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                <tr>
                  <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-white">Standard Deduction (Salaried)</td>
                  <td className="px-4 py-2.5">₹50,000</td>
                  <td className="px-4 py-2.5 font-semibold text-sky-700 dark:text-sky-400">₹75,000</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-white">Basic Exemption Limit</td>
                  <td className="px-4 py-2.5">₹2.5L (&lt;60) / ₹3L (60–79) / ₹5L (80+)</td>
                  <td className="px-4 py-2.5">₹4,00,000 (uniform for all ages)</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-white">HRA, LTA &amp; Profession Tax</td>
                  <td className="px-4 py-2.5">Allowed as per rules</td>
                  <td className="px-4 py-2.5">Not allowed</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-white">Sec 80C, 80CCD(1B), 80D, 80E, 80G</td>
                  <td className="px-4 py-2.5">Allowed</td>
                  <td className="px-4 py-2.5">Not allowed</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-white">Employer NPS u/s 80CCD(2)</td>
                  <td className="px-4 py-2.5">Up to 10% (14% Govt) of Basic + DA</td>
                  <td className="px-4 py-2.5">Up to 14% of Basic + DA</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-white">Self-Occupied Home Loan Int. (24b)</td>
                  <td className="px-4 py-2.5">Up to ₹2,00,000</td>
                  <td className="px-4 py-2.5">Not allowed</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-white">Section 87A Rebate Threshold</td>
                  <td className="px-4 py-2.5">Taxable income up to ₹5,00,000 (max ₹12,500)</td>
                  <td className="px-4 py-2.5 font-semibold text-sky-700 dark:text-sky-400">Taxable normal income up to ₹12,00,000 (+ marginal relief)</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-white">Maximum Surcharge Rate</td>
                  <td className="px-4 py-2.5">37% above ₹5 Crore</td>
                  <td className="px-4 py-2.5">Capped at 25% above ₹2 Crore</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Tax Slabs */}
        <section className="space-y-4">
          <h3 className="text-xl font-bold text-slate-800 dark:text-white">
            Income Tax Slabs for FY 2026-27 (AY 2027-28)
          </h3>
          <div className="grid gap-6 lg:grid-cols-2">
            {/* New Regime Slabs */}
            <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
              <h4 className="bg-sky-50 px-4 py-2.5 text-sm font-bold text-sky-900 dark:bg-sky-950/60 dark:text-sky-200">
                New Tax Regime Slabs (All Ages)
              </h4>
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-2 text-left">Net Taxable Income</th>
                    <th className="px-4 py-2 text-right">Tax Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  <tr><td className="px-4 py-2">Up to ₹4,00,000</td><td className="px-4 py-2 text-right font-semibold">Nil (0%)</td></tr>
                  <tr><td className="px-4 py-2">₹4,00,001 to ₹8,00,000</td><td className="px-4 py-2 text-right font-semibold">5%</td></tr>
                  <tr><td className="px-4 py-2">₹8,00,001 to ₹12,00,000</td><td className="px-4 py-2 text-right font-semibold">10%</td></tr>
                  <tr><td className="px-4 py-2">₹12,00,001 to ₹16,00,000</td><td className="px-4 py-2 text-right font-semibold">15%</td></tr>
                  <tr><td className="px-4 py-2">₹16,00,001 to ₹20,00,000</td><td className="px-4 py-2 text-right font-semibold">20%</td></tr>
                  <tr><td className="px-4 py-2">₹20,00,001 to ₹24,00,000</td><td className="px-4 py-2 text-right font-semibold">25%</td></tr>
                  <tr><td className="px-4 py-2">Above ₹24,00,000</td><td className="px-4 py-2 text-right font-semibold">30%</td></tr>
                </tbody>
              </table>
            </div>

            {/* Old Regime Slabs */}
            <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
              <h4 className="bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-800 dark:bg-slate-800 dark:text-white">
                Old Tax Regime Slabs (Individual &lt; 60 yrs)
              </h4>
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-2 text-left">Net Taxable Income</th>
                    <th className="px-4 py-2 text-right">Tax Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  <tr><td className="px-4 py-2">Up to ₹2,50,000*</td><td className="px-4 py-2 text-right font-semibold">Nil (0%)</td></tr>
                  <tr><td className="px-4 py-2">₹2,50,001 to ₹5,00,000</td><td className="px-4 py-2 text-right font-semibold">5%</td></tr>
                  <tr><td className="px-4 py-2">₹5,00,001 to ₹10,00,000</td><td className="px-4 py-2 text-right font-semibold">20%</td></tr>
                  <tr><td className="px-4 py-2">Above ₹10,00,000</td><td className="px-4 py-2 text-right font-semibold">30%</td></tr>
                </tbody>
              </table>
              <p className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                *Under Old Regime, Senior Citizens (60–79 yrs) enjoy ₹3,00,000 nil slab, and Very Senior Citizens (80+ yrs) enjoy ₹5,00,000 nil slab (automatically applied from your Date of Birth).
              </p>
            </div>
          </div>
        </section>

        {/* Standard Deduction */}
        <section className="space-y-3">
          <h3 className="text-xl font-bold text-slate-800 dark:text-white">
            Standard Deduction Explained
          </h3>
          <p>
            Every salaried employee and pensioner receives a flat Standard Deduction under Section 16(ia) without needing to submit bills or receipts. Under the New Tax Regime, this deduction is <strong>₹75,000</strong> (meaning a salaried employee earning ₹12,75,000 pays zero tax after Section 87A relief on ₹12,00,000 taxable income). Under the Old Tax Regime, Standard Deduction remains <strong>₹50,000</strong>. For family pensioners, the workbook automatically applies the statutory limits of ₹25,000 (New) or ₹15,000 (Old), or one-third of pension, whichever is lower.
          </p>
        </section>

        {/* Salary Structure and Taxable Components */}
        <section className="space-y-3">
          <h3 className="text-xl font-bold text-slate-800 dark:text-white">
            Salary Structure &amp; Taxable Components
          </h3>
          <p>
            Your CTC generally splits into fixed monthly pay (Basic, DA, HRA, Conveyance, Special Allowance), annual variable pay or bonuses, employer retirement contributions (EPF, NPS, Superannuation), and employer-provided perquisites (company-leased housing, motor car, or concessional loans). Basic salary, DA, Special Allowance, and Bonuses are fully taxable. Allowances like HRA, LTA, Children&apos;s Education Allowance, and Uniform Allowance offer partial or full exemptions strictly in the Old Tax Regime when backed by actual expenses.
          </p>
        </section>

        {/* HRA Exemption */}
        <section className="space-y-3">
          <h3 className="text-xl font-bold text-slate-800 dark:text-white">
            HRA Exemption Rules (Section 10(13A))
          </h3>
          <p>
            If you receive House Rent Allowance and pay rent for residential accommodation under the Old Tax Regime, the exempt portion is the <strong>minimum</strong> of three values:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Actual HRA received from your employer;</li>
            <li>Rent paid minus 10% of (Basic Salary + Dearness Allowance);</li>
            <li>50% of (Basic + DA) if residing in a Metro city (Mumbai, Delhi, Kolkata, Chennai), or 40% in Non-Metro cities.</li>
          </ul>
          <p>
            Our calculator supports both month-by-month rent tracking (useful if your salary or rent changed mid-year) and annual rent entry. Note that if you do not receive HRA, you can instead evaluate Section 80GG in the Old Regime (up to ₹5,000/month or ₹60,000/year subject to 25% of adjusted income).
          </p>
        </section>

        {/* Section 80C Deductions */}
        <section className="space-y-3">
          <h3 className="text-xl font-bold text-slate-800 dark:text-white">
            Section 80C Deductions (₹1,50,000 Combined Limit)
          </h3>
          <p>
            Under the Old Tax Regime, Section 80C allows a combined deduction of up to <strong>₹1,50,000</strong> across Employees&apos; Provident Fund (EPF), Voluntary PF (VPF), Public Provident Fund (PPF), Equity-Linked Savings Schemes (ELSS), National Savings Certificate (NSC + accrued interest), Sukanya Samriddhi Yojana (SSY), 5-year tax-saver FDs, life insurance premiums, children&apos;s school tuition fees, and home loan principal repayment.
          </p>
        </section>

        {/* Section 80D & Other Deductions */}
        <section className="space-y-3">
          <h3 className="text-xl font-bold text-slate-800 dark:text-white">
            Section 80D, NPS (80CCD), 80E, 80G &amp; Other Deductions
          </h3>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong>Section 80D (Health Insurance):</strong> Up to ₹25,000 for self, spouse, and children (₹50,000 if senior citizen), plus an additional ₹25,000 for parents (₹50,000 if parents are 60+ years).
            </li>
            <li>
              <strong>Section 80CCD(1B) &amp; 80CCD(2) (NPS):</strong> Employee contributions offer an extra ₹50,000 deduction u/s 80CCD(1B) in the Old Regime above the ₹1.5L 80C cap. Employer contributions u/s 80CCD(2) are deductible in <strong>both regimes</strong> (up to 14% of Basic + DA in New Regime; 10% for private and 14% for Govt employees in Old Regime).
            </li>
            <li>
              <strong>Section 80E (Education Loan):</strong> Full interest paid on higher education loans for up to 8 years (Old Regime).
            </li>
            <li>
              <strong>Section 80G (Donations) &amp; 80TTA / 80TTB (Bank Interest):</strong> Approved charitable donations (50% or 100%, with or without 10% qualifying limit) and bank interest deduction up to ₹10,000 u/s 80TTA for savings interest (or ₹50,000 u/s 80TTB on savings + FD interest for senior citizens) in the Old Regime.
            </li>
          </ul>
        </section>

        {/* Surcharge & Cess */}
        <section className="space-y-3">
          <h3 className="text-xl font-bold text-slate-800 dark:text-white">
            Health &amp; Education Cess and Surcharge Rules
          </h3>
          <p>
            A mandatory <strong>4% Health &amp; Education Cess</strong> applies to income tax (after Section 87A rebate) plus surcharge across both regimes. For high earners, surcharge applies on taxable income exceeding ₹50 lakh (10%), ₹1 crore (15%), ₹2 crore (25%), and ₹5 crore (37% in Old Regime; capped at 25% in New Regime), with statutory marginal relief and a 15% cap on surcharge relating to specified equity capital gains.
          </p>
        </section>

        {/* Worked Numerical Example */}
        <section className="space-y-4">
          <h3 className="text-xl font-bold text-slate-800 dark:text-white">
            Worked Tax Calculation Example (₹15,00,000 Gross Salary)
          </h3>
          <p>
            Consider a non-senior salaried employee living in a metro city earning a <strong>Gross Salary of ₹15,00,000</strong> (Basic ₹9,00,000 + HRA ₹4,50,000 + Special Allowance ₹1,50,000), paying ₹3,00,000 annual rent, ₹2,400 Profession Tax, ₹1,08,000 EPF + ₹50,000 PPF (capped at ₹1,50,000 u/s 80C), ₹50,000 NPS u/s 80CCD(1B), and ₹25,000 health insurance u/s 80D:
          </p>

          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-2.5 text-left">Computation Step</th>
                  <th className="px-4 py-2.5 text-right">Old Regime</th>
                  <th className="px-4 py-2.5 text-right">New Regime</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums dark:divide-slate-800">
                <tr>
                  <td className="px-4 py-2 font-medium">Gross Salary</td>
                  <td className="px-4 py-2 text-right">₹15,00,000</td>
                  <td className="px-4 py-2 text-right">₹15,00,000</td>
                </tr>
                <tr>
                  <td className="px-4 py-2">Less: Standard Deduction</td>
                  <td className="px-4 py-2 text-right">₹50,000</td>
                  <td className="px-4 py-2 text-right">₹75,000</td>
                </tr>
                <tr>
                  <td className="px-4 py-2">Less: Profession Tax</td>
                  <td className="px-4 py-2 text-right">₹2,400</td>
                  <td className="px-4 py-2 text-right">₹0</td>
                </tr>
                <tr>
                  <td className="px-4 py-2">Less: HRA Exemption u/s 10(13A)</td>
                  <td className="px-4 py-2 text-right">₹2,10,000</td>
                  <td className="px-4 py-2 text-right">₹0</td>
                </tr>
                <tr>
                  <td className="px-4 py-2">Less: Section 80D (Health Insurance)</td>
                  <td className="px-4 py-2 text-right">₹25,000</td>
                  <td className="px-4 py-2 text-right">₹0</td>
                </tr>
                <tr>
                  <td className="px-4 py-2">Less: Section 80C + 80CCD(1B)</td>
                  <td className="px-4 py-2 text-right">₹2,00,000</td>
                  <td className="px-4 py-2 text-right">₹0</td>
                </tr>
                <tr className="bg-slate-50 font-semibold dark:bg-slate-800/50">
                  <td className="px-4 py-2">Net Taxable Income</td>
                  <td className="px-4 py-2 text-right">₹10,12,600</td>
                  <td className="px-4 py-2 text-right">₹14,25,000</td>
                </tr>
                <tr>
                  <td className="px-4 py-2">Income Tax on Slabs</td>
                  <td className="px-4 py-2 text-right">₹1,16,280</td>
                  <td className="px-4 py-2 text-right">₹93,750</td>
                </tr>
                <tr>
                  <td className="px-4 py-2">Health &amp; Education Cess (4%)</td>
                  <td className="px-4 py-2 text-right">₹4,651</td>
                  <td className="px-4 py-2 text-right">₹3,750</td>
                </tr>
                <tr className="bg-sky-50/70 font-bold text-slate-800 dark:bg-sky-950/40 dark:text-white">
                  <td className="px-4 py-2.5">Total Tax Liability</td>
                  <td className="px-4 py-2.5 text-right">₹1,20,931</td>
                  <td className="px-4 py-2.5 text-right text-emerald-700 dark:text-emerald-400">₹97,500</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Even with ₹4,37,400 in Old Regime exemptions and deductions, the <strong>New Tax Regime saves ₹23,431</strong> in this scenario. You can load this exact ₹15L sample profile in the calculator above with one click to test modifications.
          </p>
        </section>

        {/* Which Regime Should You Choose? */}
        <section className="space-y-3">
          <h3 className="text-xl font-bold text-slate-800 dark:text-white">
            Which Tax Regime Should You Choose?
          </h3>
          <p>
            Choose the <strong>New Tax Regime</strong> if your taxable income is up to ₹12,00,000 (effectively ₹12,75,000 gross salary), or if your total Old Regime deductions (HRA + 80C + 80D + home loan interest) fall below your break-even point. Choose the <strong>Old Tax Regime</strong> only when your verified rent, home loan interest, and Chapter VI-A claims push Old Regime total tax below the New Regime figure shown in the dashboard.
          </p>
        </section>

        {/* How to Use This Calculator */}
        <section className="space-y-3">
          <h3 className="text-xl font-bold text-slate-800 dark:text-white">
            How to Use This Income Tax Calculator Effectively
          </h3>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Set your Date of Birth, City type (Metro/Non-Metro), and remaining months in the financial year.</li>
            <li>Enter your salary components using Annual Quick Entry or the April–March month-by-month grid.</li>
            <li>Add HRA rent paid, Employer NPS (80CCD(2)), 80C, 80D, and any home loan interest or capital gains sheets.</li>
            <li>Review the side-by-side results, export a PDF or CSV summary, or save a JSON backup locally.</li>
          </ul>
          {onJumpToCalculator && (
            <button
              type="button"
              onClick={onJumpToCalculator}
              className="tactile-btn mt-2 inline-flex items-center rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-orange-700"
            >
              Back to Income Tax Calculator
            </button>
          )}
        </section>

        {/* Common Mistakes */}
        <section className="space-y-3">
          <h3 className="text-xl font-bold text-slate-800 dark:text-white">
            Common Mistakes Salaried Taxpayers Should Avoid
          </h3>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Forgetting to report savings bank interest, FD interest, or stock dividends outside Form 16.</li>
            <li>Assuming Old Regime is always better without comparing the FY 2026-27 New Regime 87A ₹12 lakh threshold.</li>
            <li>Claiming both HRA exemption and Section 80GG rent deduction simultaneously.</li>
            <li>Overlooking Employer NPS u/s 80CCD(2), which remains deductible even in the New Tax Regime.</li>
            <li>Ignoring short-term or long-term capital gains when estimating advance tax or remaining monthly TDS.</li>
          </ul>
        </section>

        {/* FAQs */}
        <section className="pt-4">
          <FaqAccordion
            id="calculator-faq"
            items={TAX_FAQS}
            heading="Frequently Asked Questions (FAQs)"
            subheading="Detailed answers on FY 2026-27 tax slabs, deductions, TDS, and workbook features."
          />
        </section>

        {/* Disclaimer */}
        <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-[#0F172A]/60 dark:text-slate-400">
          <h3 className="mb-1 text-sm font-bold text-slate-800 dark:text-white">
            Disclaimer
          </h3>
          <p>
            This Income Tax Calculator and educational guide are provided strictly for personal tax estimation and financial planning for FY 2026-27 (AY 2027-28). While the calculation engine preserves the complete workbook formulas (v29.0, noting section references remain aligned prior to Income Tax Act 2025 renumbering), this tool does not constitute formal tax, accounting, or legal advice. Please verify your final figures against Form 16, AIS/TIS, and consult a qualified Chartered Accountant before filing your Income Tax Return.
          </p>
        </section>
      </div>
    </article>
  );
};
