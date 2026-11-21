import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Calculator,
  CheckCircle2,
  ChevronDown,
  FileSpreadsheet,
  HelpCircle,
  Maximize2,
  Minimize2,
  Percent,
  Printer,
  RotateCcw,
  RotateCw,
  Target,
  TrendingDown,
  Zap,
} from 'lucide-react';
import { ToolCatalogItem } from '../../types/tools';
import { copyTextToClipboard, protectDocument } from '../../hooks/useRightClickProtection';
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

interface IncomeTaxFy2627ViewProps {
  tool?: ToolCatalogItem;
  onBack?: () => void;
}

type WorkspaceTab = 'workbook' | 'planner' | 'slabs-guide' | 'faqs';
type FaqCategory = 'All' | 'Regimes' | 'Salary & HRA' | 'Deductions' | 'Filing & Tool';

interface TaxFaqEntry {
  id: string;
  category: Exclude<FaqCategory, 'All'>;
  question: string;
  answer: string;
}

const TAX_FAQ_CATEGORIES: FaqCategory[] = [
  'All',
  'Regimes',
  'Salary & HRA',
  'Deductions',
  'Filing & Tool',
];

const FY2627_FAQS: TaxFaqEntry[] = [
  {
    id: 'faq-1',
    category: 'Regimes',
    question: 'What is the tax-free salary limit under the New Tax Regime for FY 2026-27?',
    answer:
      'Under the New Tax Regime for FY 2026-27 (AY 2027-28), resident individuals with net taxable normal income up to ₹12,00,000 receive full Section 87A tax rebate (making slab tax ₹0). Combined with the ₹75,000 Standard Deduction, a salaried employee earning up to ₹12,75,000 pays zero income tax on salary (excluding special-rate capital gains).',
  },
  {
    id: 'faq-2',
    category: 'Regimes',
    question: 'Is the New Tax Regime the default option for FY 2026-27?',
    answer:
      'Yes. The New Tax Regime is the default regime across employer payroll and ITR filings. If a salaried employee wants the Old Tax Regime (for HRA, 80C, 80D, and home loan interest claims), they must actively opt for it before filing their return or inform their employer at the start of the financial year.',
  },
  {
    id: 'faq-3',
    category: 'Regimes',
    question: 'How does Marginal Relief work right above ₹12,00,000 taxable income in the New Regime?',
    answer:
      'If your net taxable normal income slightly exceeds ₹12,00,000 (for instance ₹12,20,000), Section 87A marginal relief ensures the tax payable before 4% cess never exceeds the income earned above ₹12,00,000. Once incremental slab tax drops below the excess income over ₹12,00,000, normal slab rates take over smoothly.',
  },
  {
    id: 'faq-4',
    category: 'Salary & HRA',
    question: 'How is HRA exemption calculated under Section 10(13A) in the Old Regime?',
    answer:
      'HRA exemption equals the minimum of three amounts: (1) Actual HRA received, (2) Rent paid minus 10% of (Basic + Dearness Allowance), and (3) 50% of (Basic + DA) for Metro cities (Delhi, Mumbai, Kolkata, Chennai — or cities treated as Metro) or 40% for Non-Metro cities. HRA exemption is unavailable in the New Tax Regime.',
  },
  {
    id: 'faq-5',
    category: 'Salary & HRA',
    question: 'Should I enter monthly rent or annual rent in the 10-Tab Workbook?',
    answer:
      'If your Basic salary, HRA, or monthly rent changed mid-year—or you shifted between a Metro and Non-Metro city—enter monthly figures across Apr–Mar (cells D26:O26). If salary and city remained constant, entering annual rent in Q26:S26 evaluates the exemption cleanly on annual totals.',
  },
  {
    id: 'faq-6',
    category: 'Salary & HRA',
    question: 'What is the Standard Deduction for salaried employees and family pensioners?',
    answer:
      'Salaried individuals and pensioners get ₹75,000 Standard Deduction in the New Tax Regime and ₹50,000 in the Old Tax Regime. For family pensioners, the workbook automatically applies ₹25,000 (New) or ₹15,000 (Old) or one-third of family pension, whichever is lower.',
  },
  {
    id: 'faq-7',
    category: 'Deductions',
    question: 'Which deductions still work inside the New Tax Regime?',
    answer:
      'In addition to the ₹75,000 Standard Deduction on salary, Employer NPS contribution u/s 80CCD(2) up to 14% of Basic + DA is deductible in the New Tax Regime. Employer EPF/superannuation contributions within statutory limits and Section 10(10) statutory retirement exemptions (gratuity, leave encashment up to notified limits) also apply.',
  },
  {
    id: 'faq-8',
    category: 'Deductions',
    question: 'What is the difference between NPS 80CCD(1B) and 80CCD(2)?',
    answer:
      'Section 80CCD(1B) is your voluntary Tier-I employee contribution up to ₹50,000 extra above the ₹1.5L 80C cap, deductible only in the Old Tax Regime. Section 80CCD(2) is your employer’s corporate NPS contribution routed via payroll, deductible in BOTH the Old Regime (10% private / 14% Govt) and the New Regime (up to 14% of Basic + DA).',
  },
  {
    id: 'faq-9',
    category: 'Deductions',
    question: 'Can I claim both HRA exemption and home loan interest u/s 24(b) together?',
    answer:
      'Yes, under the Old Tax Regime, if you genuinely live on rent in one city (for work) while paying EMI/interest on a home in another city—or when conditions for rented residence are satisfied—both HRA u/s 10(13A) and home loan interest u/s 24(b) up to ₹2,00,000 (self-occupied) or let-out property rules can be evaluated.',
  },
  {
    id: 'faq-10',
    category: 'Deductions',
    question: 'How much health insurance premium is deductible u/s 80D?',
    answer:
      'Under the Old Tax Regime, you can deduct up to ₹25,000 for self, spouse, and children (₹50,000 if senior citizen), plus an additional ₹25,000 for parents (₹50,000 if parents are 60+ years), including up to ₹5,000 preventive health check-up within the overall limit.',
  },
  {
    id: 'faq-11',
    category: 'Filing & Tool',
    question: 'What sheets are included inside the 10-Tab Workbook v29.0?',
    answer:
      'The interactive Excel-compatible workbook includes Summary, Tax Calculator (IT 2026-27), Perquisites, NSC Accrued Int, Dividends, Capital Gains - Equity, Cap Gains - Foreign Eq, Cap Gains - Property & Debt MF, Bank Int & Tax Paid, Notes, and Instructions—all running live Excel formulas locally in your browser.',
  },
  {
    id: 'faq-12',
    category: 'Filing & Tool',
    question: 'Does my salary or tax data leave my browser?',
    answer:
      'Never. Every formula calculation, Break-Even binary search simulation, and workbook edit executes 100% client-side in your browser memory and auto-saves only to your own browser localStorage. You can export/import a portable JSON backup anytime via Save / Load.',
  },
];

// Core FY 2026-27 Tax Calculation Engine for Break-Even & Marginal Planner
function computeNewRegimeFY2627(taxableNormalIncome: number): {
  slabTax: number;
  rebate: number;
  cess: number;
  totalTax: number;
} {
  const inc = Math.max(0, Math.round(taxableNormalIncome));
  const slabs: Array<[number, number]> = [
    [400000, 0],
    [400000, 0.05],
    [400000, 0.1],
    [400000, 0.15],
    [400000, 0.2],
    [400000, 0.25],
    [Infinity, 0.3],
  ];

  let rem = inc;
  let slabTax = 0;
  for (const [band, rate] of slabs) {
    if (rem <= 0) break;
    const chunk = Math.min(rem, band);
    slabTax += chunk * rate;
    rem -= chunk;
  }

  let rebate = 0;
  if (inc <= 1200000) {
    rebate = slabTax;
  } else {
    const excess = inc - 1200000;
    if (slabTax > excess) {
      rebate = slabTax - excess;
    }
  }

  const taxAfterRebate = Math.max(0, slabTax - rebate);
  const surcharge = computeNewSurcharge(inc, taxAfterRebate);
  const cess = (taxAfterRebate + surcharge) * 0.04;
  return {
    slabTax: Math.round(slabTax),
    rebate: Math.round(rebate),
    cess: Math.round(cess),
    totalTax: Math.round(taxAfterRebate + surcharge + cess),
  };
}

function computeNewSurcharge(taxableIncome: number, baseTax: number): number {
  if (taxableIncome <= 5000000) return 0;
  let rate = 0;
  let threshold = 5000000;
  if (taxableIncome > 20000000) {
    rate = 0.25;
    threshold = 20000000;
  } else if (taxableIncome > 10000000) {
    rate = 0.15;
    threshold = 10000000;
  } else {
    rate = 0.1;
    threshold = 5000000;
  }
  const rawSurcharge = baseTax * rate;
  const thresholdTax = computeNewRegimeBaseBeforeSurcharge(threshold);
  const thresholdTotal =
    thresholdTax +
    (threshold > 10000000 ? thresholdTax * 0.15 : threshold > 5000000 ? thresholdTax * 0.1 : 0);
  const maxAllowed = thresholdTotal + (taxableIncome - threshold);
  return Math.max(0, Math.min(rawSurcharge, Math.max(0, maxAllowed - baseTax)));
}

function computeNewRegimeBaseBeforeSurcharge(inc: number): number {
  const slabs: Array<[number, number]> = [
    [400000, 0],
    [400000, 0.05],
    [400000, 0.1],
    [400000, 0.15],
    [400000, 0.2],
    [400000, 0.25],
    [Infinity, 0.3],
  ];
  let rem = Math.max(0, inc);
  let tax = 0;
  for (const [b, r] of slabs) {
    if (rem <= 0) break;
    const c = Math.min(rem, b);
    tax += c * r;
    rem -= c;
  }
  return tax;
}

function computeOldRegimeFY2627(taxableIncome: number): {
  slabTax: number;
  rebate: number;
  cess: number;
  totalTax: number;
} {
  const inc = Math.max(0, Math.round(taxableIncome));
  let slabTax = 0;
  if (inc > 250000) {
    const b5 = Math.min(Math.max(0, inc - 250000), 250000);
    const b20 = Math.min(Math.max(0, inc - 500000), 500000);
    const b30 = Math.max(0, inc - 1000000);
    slabTax = b5 * 0.05 + b20 * 0.2 + b30 * 0.3;
  }
  const rebate = inc <= 500000 ? Math.min(12500, slabTax) : 0;
  const taxAfterRebate = Math.max(0, slabTax - rebate);
  const cess = taxAfterRebate * 0.04;
  return {
    slabTax: Math.round(slabTax),
    rebate: Math.round(rebate),
    cess: Math.round(cess),
    totalTax: Math.round(taxAfterRebate + cess),
  };
}

export const IncomeTaxFy2627View: React.FC<IncomeTaxFy2627ViewProps> = ({ tool }) => {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('workbook');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [inlineHeight, setInlineHeight] = useState<number>(840);
  const [plannerCopied, setPlannerCopied] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const heightSyncCleanupRef = useRef<(() => void) | null>(null);
  const iframeProtectCleanupRef = useRef<(() => void) | null>(null);

  const syncWorkbookFrameLayout = useCallback(
    (frameEl: HTMLIFrameElement | null) => {
      heightSyncCleanupRef.current?.();
      heightSyncCleanupRef.current = null;
      if (!frameEl) return;
      try {
        const doc = frameEl.contentDocument;
        if (!doc) return;
        if (!isFullscreen) {
          doc.documentElement.style.overflow = 'hidden';
          doc.documentElement.style.height = 'auto';
          if (doc.body) {
            doc.body.style.overflow = 'hidden';
            doc.body.style.height = 'auto';
            doc.body.classList.add('is-inline-embed');
          }
          let rafId = 0;
          const measure = () => {
            const bodyHeight = doc.body
              ? Math.ceil(Math.max(doc.body.scrollHeight, doc.body.getBoundingClientRect().height))
              : 0;
            const targetH = Math.max(520, bodyHeight);
            if (bodyHeight > 300) {
              setInlineHeight((prev) => (Math.abs(prev - targetH) > 4 ? targetH : prev));
            }
          };
          const scheduleMeasure = () => {
            if (rafId) window.cancelAnimationFrame(rafId);
            rafId = window.requestAnimationFrame(() => {
              rafId = 0;
              measure();
            });
          };
          scheduleMeasure();
          const ro =
            typeof ResizeObserver !== 'undefined'
              ? new ResizeObserver(() => scheduleMeasure())
              : null;
          if (ro && doc.body) ro.observe(doc.body);
          const mo = new MutationObserver(() => scheduleMeasure());
          if (doc.body) {
            mo.observe(doc.body, { childList: true, subtree: true, attributes: true });
          }
          const win = frameEl.contentWindow;
          win?.addEventListener('resize', scheduleMeasure);
          heightSyncCleanupRef.current = () => {
            if (rafId) window.cancelAnimationFrame(rafId);
            ro?.disconnect();
            mo.disconnect();
            win?.removeEventListener('resize', scheduleMeasure);
          };
        } else {
          doc.documentElement.style.overflow = '';
          doc.documentElement.style.height = '';
          if (doc.body) {
            doc.body.style.overflow = '';
            doc.body.style.height = '';
            doc.body.classList.remove('is-inline-embed');
          }
        }
      } catch {
        // Ignore cross-origin restrictions
      }
    },
    [isFullscreen]
  );

  useEffect(() => {
    syncWorkbookFrameLayout(iframeRef.current);
  }, [syncWorkbookFrameLayout]);

  useEffect(() => {
    return () => {
      heightSyncCleanupRef.current?.();
      heightSyncCleanupRef.current = null;
      iframeProtectCleanupRef.current?.();
      iframeProtectCleanupRef.current = null;
    };
  }, []);

  // Break-Even Planner interactive state
  const [grossSalary, setGrossSalary] = useState<number>(1500000);
  const [metro, setMetro] = useState<'M' | 'N'>('M');
  const [rentPaid, setRentPaid] = useState<number>(300000);
  const [sec80C, setSec80C] = useState<number>(150000);
  const [sec80D, setSec80D] = useState<number>(25000);
  const [npsEmployee, setNpsEmployee] = useState<number>(0);
  const [npsEmployer, setNpsEmployer] = useState<number>(0);
  const [homeLoanInterest, setHomeLoanInterest] = useState<number>(0);

  // FAQs state
  const [faqCategory, setFaqCategory] = useState<FaqCategory>('All');
  const [openFaqId, setOpenFaqId] = useState<string | null>('faq-1');

  const handlePrintWorkbook = () => {
    try {
      iframeRef.current?.contentWindow?.focus();
      iframeRef.current?.contentWindow?.print();
    } catch {
      window.print();
    }
  };

  // Real-time Break-Even & Optimization Calculations
  const plannerStats = useMemo(() => {
    const basicAnnual = Math.round(grossSalary * 0.6);
    const hraAnnual = Math.round(grossSalary * 0.3);
    const ptAnnual = grossSalary > 0 ? 2400 : 0;
    const epfAnnual = Math.round(basicAnnual * 0.12);

    // HRA exemption u/s 10(13A)
    const hraRule1 = hraAnnual;
    const hraRule2 = Math.max(0, rentPaid - basicAnnual * 0.1);
    const hraRule3 = basicAnnual * (metro === 'M' ? 0.5 : 0.4);
    const hraExempt = rentPaid > 0 ? Math.max(0, Math.round(Math.min(hraRule1, hraRule2, hraRule3))) : 0;

    // Caps
    const eff80C = Math.min(150000, Math.max(0, sec80C));
    const eff80D = Math.max(0, sec80D);
    const effNpsEmp = Math.min(50000, Math.max(0, npsEmployee));
    const effNpsEmprOld = Math.min(Math.round(basicAnnual * 0.1), Math.max(0, npsEmployer));
    const effNpsEmprNew = Math.min(Math.round(basicAnnual * 0.14), Math.max(0, npsEmployer));
    const effHomeLoanInt = Math.min(200000, Math.max(0, homeLoanInterest));

    // Old Regime
    const stdDedOld = grossSalary > 0 ? 50000 : 0;
    const oldTotalDeductions =
      stdDedOld +
      ptAnnual +
      hraExempt +
      eff80C +
      eff80D +
      effNpsEmp +
      effNpsEmprOld +
      effHomeLoanInt;
    const oldTaxable = Math.max(0, grossSalary - oldTotalDeductions);
    const oldRes = computeOldRegimeFY2627(oldTaxable);

    // New Regime
    const stdDedNew = grossSalary > 0 ? 75000 : 0;
    const newTotalDeductions = stdDedNew + effNpsEmprNew;
    const newTaxable = Math.max(0, grossSalary - newTotalDeductions);
    const newRes = computeNewRegimeFY2627(newTaxable);

    const savings = Math.abs(oldRes.totalTax - newRes.totalTax);
    const winner: 'old' | 'new' | 'equal' =
      oldRes.totalTax === newRes.totalTax
        ? 'equal'
        : newRes.totalTax < oldRes.totalTax
        ? 'new'
        : 'old';

    // Effective & next ₹1,00,000 marginal tax rates
    const oldNext1L =
      computeOldRegimeFY2627(Math.max(0, grossSalary + 100000 - oldTotalDeductions)).totalTax -
      oldRes.totalTax;
    const newNext1L =
      computeNewRegimeFY2627(Math.max(0, grossSalary + 100000 - newTotalDeductions)).totalTax -
      newRes.totalTax;

    const oldEffRate = grossSalary > 0 ? (oldRes.totalTax / grossSalary) * 100 : 0;
    const newEffRate = grossSalary > 0 ? (newRes.totalTax / grossSalary) * 100 : 0;

    // Binary search for break-even extra Old deduction
    const oldExemptionsClaimedExcludingStdPt =
      hraExempt + eff80C + eff80D + effNpsEmp + effNpsEmprOld + effHomeLoanInt;
    let breakEvenExtra: number | null = null;
    if (grossSalary > 0) {
      if (oldRes.totalTax <= newRes.totalTax) {
        breakEvenExtra = 0;
      } else if (newRes.totalTax === 0) {
        // Need Old Taxable <= 5,00,000 for 87A zero tax
        const needed = Math.max(0, oldTaxable - 500000);
        breakEvenExtra = needed <= grossSalary ? needed : null;
      } else {
        let lo = 0;
        let hi = oldTaxable;
        for (let iter = 0; iter < 40; iter++) {
          const mid = Math.floor((lo + hi) / 2);
          const candidateTax = computeOldRegimeFY2627(Math.max(0, oldTaxable - mid)).totalTax;
          if (candidateTax <= newRes.totalTax) {
            hi = mid;
          } else {
            lo = mid + 1;
          }
        }
        breakEvenExtra = hi;
      }
    }

    // What-If Levers
    const npsEmployerPlus50k = Math.min(Math.round(basicAnnual * 0.14), effNpsEmprNew + 50000);
    const npsEmprSaved =
      newRes.totalTax -
      computeNewRegimeFY2627(Math.max(0, grossSalary - stdDedNew - npsEmployerPlus50k)).totalTax;

    const npsEmpPlus50k = Math.min(50000, effNpsEmp + 50000);
    const npsEmpDelta = npsEmpPlus50k - effNpsEmp;
    const npsEmpSaved =
      npsEmpDelta > 0
        ? oldRes.totalTax - computeOldRegimeFY2627(Math.max(0, oldTaxable - npsEmpDelta)).totalTax
        : 0;

    const healthDelta = eff80D >= 25000 ? 0 : 25000 - eff80D;
    const healthSaved =
      healthDelta > 0
        ? oldRes.totalTax - computeOldRegimeFY2627(Math.max(0, oldTaxable - healthDelta)).totalTax
        : 0;

    const takeHomeOld = Math.max(0, grossSalary - epfAnnual - ptAnnual - oldRes.totalTax);
    const takeHomeNew = Math.max(0, grossSalary - epfAnnual - ptAnnual - newRes.totalTax);

    return {
      basicAnnual,
      hraAnnual,
      ptAnnual,
      epfAnnual,
      hraExempt,
      oldTotalDeductions,
      newTotalDeductions,
      oldTaxable,
      newTaxable,
      oldTax: oldRes.totalTax,
      newTax: newRes.totalTax,
      savings,
      winner,
      oldEffRate,
      newEffRate,
      oldMarginalPct: (oldNext1L / 100000) * 100,
      newMarginalPct: (newNext1L / 100000) * 100,
      oldNext1L,
      newNext1L,
      oldDeductionsNonStd: oldExemptionsClaimedExcludingStdPt,
      breakEvenExtra,
      breakEvenTotalOld:
        breakEvenExtra !== null ? oldTotalDeductions + breakEvenExtra : null,
      npsEmprSaved,
      npsEmpSaved,
      healthSaved,
      takeHomeOld,
      takeHomeNew,
      effHomeLoanInt,
    };
  }, [grossSalary, metro, rentPaid, sec80C, sec80D, npsEmployee, npsEmployer, homeLoanInterest]);

  const filteredFaqs = useMemo(
    () =>
      faqCategory === 'All'
        ? FY2627_FAQS
        : FY2627_FAQS.filter((item) => item.category === faqCategory),
    [faqCategory]
  );

  return (
    <div className="space-y-5">
      {/* Tool Header & Tab Navigation */}
      <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-4 sm:p-5 shadow-[0_4px_0_#2F3E4E]">
        <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-[#2F3E4E]/15">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-display font-extrabold uppercase tracking-wider">
              <span className="px-2 py-0.5 rounded bg-[#2F3E4E] text-[#F9C80E]">
                {tool?.code || 'TX-06'}
              </span>
              <span className="px-2 py-0.5 rounded bg-[#F9C80E] text-[#2F3E4E] border border-[#2F3E4E]">
                FY 2026-27 · AY 2027-28
              </span>
              <span className="px-2 py-0.5 rounded bg-[#B45309] text-[#FFFDF5] border border-[#2F3E4E]">
                Beta Testing · v2.0.8
              </span>
              <span className="text-[#12805C] font-bold">v29.0 Workbook Engine · 100% Local</span>
            </div>
            <h1 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] tracking-tight">
              Income Tax Calculator FY 2026-27 (Old vs New Regime)
            </h1>
            <p className="text-xs sm:text-sm text-[#475569] leading-relaxed">
              Full 10-tab Excel formula workbook, live Break-Even &amp; Marginal Rate Planner,
              FY 2026-27 slab tables, and salaried tax FAQs — computed privately in your browser.
            </p>
            <div className="inline-flex items-start sm:items-center gap-2 px-3 py-1.5 rounded-lg bg-[#FEF3C7] border border-[#F59E0B] text-[11px] font-semibold text-[#92400E]">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 sm:mt-0" aria-hidden="true" />
              <span>
                <strong>Beta Testing (v2.0.8):</strong> This module is actively under testing and
                refinement—please verify all tax figures independently before final filing.
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {activeTab === 'workbook' && (
              <>
                <button
                  type="button"
                  onClick={handlePrintWorkbook}
                  className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Workbook</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIframeKey((k) => k + 1)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] transition cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Reload Sheet</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsFullscreen((f) => !f)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#F9C80E] hover:bg-[#F4B400] text-xs font-display font-extrabold text-[#2F3E4E] shadow-[0_2px_0_#2F3E4E] transition cursor-pointer"
                >
                  {isFullscreen ? (
                    <>
                      <Minimize2 className="w-3.5 h-3.5" />
                      <span>Exit Fullscreen</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>Fullscreen View</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div
          role="tablist"
          aria-label="Income Tax Calculator views"
          className="pt-3 flex items-center gap-2 overflow-x-auto no-scrollbar"
        >
          {[
            {
              id: 'workbook' as const,
              label: 'Tax Calculator & 10-Tab Workbook',
              icon: FileSpreadsheet,
            },
            {
              id: 'planner' as const,
              label: 'Break-Even & Savings Planner',
              icon: Target,
            },
            {
              id: 'slabs-guide' as const,
              label: 'FY 2026-27 Slabs & Guide',
              icon: BookOpen,
            },
            {
              id: 'faqs' as const,
              label: `Salaried Tax FAQs (${FY2627_FAQS.length})`,
              icon: HelpCircle,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-display font-extrabold border-[1.5px] transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-[#2F3E4E] text-[#F9C80E] border-[#2F3E4E] shadow-[0_2px_0_#1E293B]'
                    : 'bg-white text-[#2F3E4E] border-[#2F3E4E]/25 hover:bg-[#FEF2C8] hover:border-[#2F3E4E]'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: FULL 10-TAB WORKBOOK ENGINE */}
      {activeTab === 'workbook' && (
        <div
          className={
            isFullscreen
              ? 'fixed inset-0 z-50 bg-[#FFFDF5] flex flex-col p-2 sm:p-4'
              : 'bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl overflow-hidden shadow-[0_4px_0_#2F3E4E]'
          }
        >
          {isFullscreen && (
            <div className="flex items-center justify-between gap-3 px-3 py-2 bg-[#2F3E4E] text-[#FFFDF5] rounded-xl mb-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Calculator className="w-4 h-4 text-[#F9C80E] shrink-0" />
                <span className="font-display font-extrabold text-xs sm:text-sm truncate">
                  Income Tax Calculator FY 2026-27 (v29.0 Workbook)
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handlePrintWorkbook}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-[#2F3E4E] text-xs font-bold cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsFullscreen(false)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F9C80E] text-[#2F3E4E] text-xs font-extrabold cursor-pointer"
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span>Close Fullscreen</span>
                </button>
              </div>
            </div>
          )}

          <iframe
            key={iframeKey}
            ref={iframeRef}
            src="/income-tax-fy-2026-27.html"
            title="Income Tax Calculator FY 2026-27 Workbook Engine"
            scrolling={!isFullscreen ? 'no' : undefined}
            style={!isFullscreen ? { height: `${inlineHeight}px` } : undefined}
            onLoad={(e) => {
              const frameEl = e.currentTarget;
              syncWorkbookFrameLayout(frameEl);
              iframeProtectCleanupRef.current?.();
              iframeProtectCleanupRef.current = null;
              try {
                const doc = frameEl.contentDocument;
                if (doc) {
                  iframeProtectCleanupRef.current = protectDocument(doc, frameEl.contentWindow);
                }
              } catch {
                // Ignore cross-origin restrictions
              }
            }}
            className={`w-full border-0 bg-[#FFFDF5] block ${
              isFullscreen ? 'flex-1 rounded-xl border border-[#2F3E4E]/20' : 'overflow-hidden'
            }`}
          />
        </div>
      )}

      {/* TAB 2: BREAK-EVEN & MARGINAL RATE PLANNER */}
      {activeTab === 'planner' && (
        <div className="space-y-5">
          {/* Interactive Inputs + Instant Comparison Card */}
          <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 sm:p-6 shadow-[0_4px_0_#2F3E4E]">
            <div className="grid gap-6 lg:grid-cols-12 items-start">
              <div className="space-y-4 lg:col-span-8">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#2F3E4E]/15">
                  <div>
                    <h2 className="font-display font-extrabold text-base sm:text-lg text-[#2F3E4E]">
                      Break-Even Deduction &amp; Marginal Tax Rate Planner
                    </h2>
                    <p className="text-xs text-[#475569]">
                      Simulate salary, rent, 80C, 80D, 24(b) Home Loan &amp; NPS to see your exact Old vs New break-even threshold.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 no-print">
                    <button
                      type="button"
                      onClick={() => {
                        setGrossSalary(0);
                        setRentPaid(0);
                        setSec80C(0);
                        setSec80D(0);
                        setNpsEmployee(0);
                        setNpsEmployer(0);
                        setHomeLoanInterest(0);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#2F3E4E] bg-white hover:bg-[#FFE1B3] text-[11px] font-bold text-[#2F3E4E] cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Clear Planner (₹0)
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <label
                      htmlFor="it-planner-gross"
                      className="block text-xs font-bold text-[#2F3E4E]"
                    >
                      Annual Gross Salary (₹)
                    </label>
                    <input
                      id="it-planner-gross"
                      type="number"
                      min={0}
                      step={50000}
                      value={grossSalary}
                      onChange={(e) => setGrossSalary(Math.max(0, Number(e.target.value) || 0))}
                      className="mt-1 w-full rounded-lg border-[1.5px] border-[#2F3E4E] bg-white px-3 py-2 text-sm font-bold text-[#2F3E4E] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
                    />
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {[1275000, 1500000, 2000000, 2500000, 3500000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setGrossSalary(amt)}
                          className={`rounded border px-2 py-0.5 text-[11px] font-bold tabular-nums transition cursor-pointer ${
                            grossSalary === amt
                              ? 'border-[#2F3E4E] bg-[#F9C80E] text-[#2F3E4E]'
                              : 'border-[#2F3E4E]/25 bg-white text-[#475569] hover:border-[#2F3E4E]'
                          }`}
                        >
                          ₹{(amt / 100000).toFixed(amt % 100000 === 0 ? 0 : 2)}L
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="it-planner-rent"
                      className="block text-xs font-bold text-[#2F3E4E]"
                    >
                      Annual Rent Paid (₹)
                    </label>
                    <input
                      id="it-planner-rent"
                      type="number"
                      min={0}
                      step={12000}
                      value={rentPaid}
                      onChange={(e) => setRentPaid(Math.max(0, Number(e.target.value) || 0))}
                      className="mt-1 w-full rounded-lg border-[1.5px] border-[#2F3E4E] bg-white px-3 py-2 text-sm font-bold text-[#2F3E4E] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
                    />
                    <div className="mt-1.5 flex items-center gap-1.5">
                      {(['M', 'N'] as const).map((city) => (
                        <button
                          key={city}
                          type="button"
                          onClick={() => setMetro(city)}
                          className={`rounded border px-2.5 py-0.5 text-[11px] font-bold transition cursor-pointer ${
                            metro === city
                              ? 'border-[#2F3E4E] bg-[#2F3E4E] text-[#F9C80E]'
                              : 'border-[#2F3E4E]/25 bg-white text-[#475569] hover:border-[#2F3E4E]'
                          }`}
                        >
                          {city === 'M' ? 'Metro (50%)' : 'Non-Metro (40%)'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="it-planner-80c"
                      className="block text-xs font-bold text-[#2F3E4E]"
                    >
                      Sec 80C Investments (₹)
                    </label>
                    <input
                      id="it-planner-80c"
                      type="number"
                      min={0}
                      max={150000}
                      step={10000}
                      value={sec80C}
                      onChange={(e) =>
                        setSec80C(Math.min(150000, Math.max(0, Number(e.target.value) || 0)))
                      }
                      className="mt-1 w-full rounded-lg border-[1.5px] border-[#2F3E4E] bg-white px-3 py-2 text-sm font-bold text-[#2F3E4E] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
                    />
                    <p className="mt-1 text-[11px] text-[#64748B]">
                      Auto-est. HRA exempt: {formatINR(plannerStats.hraExempt)}
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="it-planner-80d"
                      className="block text-xs font-bold text-[#2F3E4E]"
                    >
                      Sec 80D Health Insurance (₹)
                    </label>
                    <input
                      id="it-planner-80d"
                      type="number"
                      min={0}
                      max={100000}
                      step={5000}
                      value={sec80D}
                      onChange={(e) =>
                        setSec80D(Math.min(100000, Math.max(0, Number(e.target.value) || 0)))
                      }
                      className="mt-1 w-full rounded-lg border-[1.5px] border-[#2F3E4E] bg-white px-3 py-2 text-sm font-bold text-[#2F3E4E] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="it-planner-nps-emp"
                      className="block text-xs font-bold text-[#2F3E4E]"
                    >
                      Employee NPS 80CCD(1B) (₹)
                    </label>
                    <input
                      id="it-planner-nps-emp"
                      type="number"
                      min={0}
                      max={50000}
                      step={5000}
                      value={npsEmployee}
                      onChange={(e) =>
                        setNpsEmployee(Math.min(50000, Math.max(0, Number(e.target.value) || 0)))
                      }
                      className="mt-1 w-full rounded-lg border-[1.5px] border-[#2F3E4E] bg-white px-3 py-2 text-sm font-bold text-[#2F3E4E] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="it-planner-nps-empr"
                      className="block text-xs font-bold text-[#2F3E4E]"
                    >
                      Employer NPS 80CCD(2) (₹)
                    </label>
                    <input
                      id="it-planner-nps-empr"
                      type="number"
                      min={0}
                      step={10000}
                      value={npsEmployer}
                      onChange={(e) => setNpsEmployer(Math.max(0, Number(e.target.value) || 0))}
                      className="mt-1 w-full rounded-lg border-[1.5px] border-[#2F3E4E] bg-white px-3 py-2 text-sm font-bold text-[#2F3E4E] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="it-planner-home-loan"
                      className="block text-xs font-bold text-[#2F3E4E]"
                    >
                      Home Loan Int. u/s 24(b) (₹)
                    </label>
                    <input
                      id="it-planner-home-loan"
                      type="number"
                      min={0}
                      max={200000}
                      step={10000}
                      value={homeLoanInterest}
                      onChange={(e) =>
                        setHomeLoanInterest(Math.min(200000, Math.max(0, Number(e.target.value) || 0)))
                      }
                      className="mt-1 w-full rounded-lg border-[1.5px] border-[#2F3E4E] bg-white px-3 py-2 text-sm font-bold text-[#2F3E4E] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
                    />
                    <p className="mt-1 text-[11px] text-[#64748B]">
                      Self-occupied max ₹2,00,000 (Old Regime)
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Snapshot Panel */}
              <div className="lg:sticky lg:top-20 flex flex-col justify-between rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] p-4 lg:col-span-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-[#2F3E4E]/15 pb-2">
                    <span className="text-[11px] font-display font-extrabold uppercase tracking-wider text-[#475569]">
                      Live Regime Verdict
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-extrabold text-[#12805C]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {plannerStats.winner === 'equal'
                        ? 'Equal Tax'
                        : `${plannerStats.winner === 'new' ? 'New' : 'Old'} Regime Wins`}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="rounded-lg border border-[#2F3E4E]/20 bg-white p-3">
                      <div className="text-[11px] font-semibold text-[#64748B]">Old Regime Tax</div>
                      <div className="mt-0.5 text-lg font-extrabold tabular-nums text-[#2F3E4E]">
                        {formatINR(plannerStats.oldTax)}
                      </div>
                    </div>
                    <div className="rounded-lg border border-[#2F3E4E]/20 bg-white p-3">
                      <div className="text-[11px] font-semibold text-[#64748B]">New Regime Tax</div>
                      <div className="mt-0.5 text-lg font-extrabold tabular-nums text-[#2F3E4E]">
                        {formatINR(plannerStats.newTax)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border-[1.5px] border-[#2F3E4E] bg-[#F9C80E] px-3 py-2 text-xs font-extrabold text-[#2F3E4E]">
                    <span className="inline-flex items-center gap-1.5">
                      <TrendingDown className="w-3.5 h-3.5" />
                      Annual Tax Savings
                    </span>
                    <span className="tabular-nums">{formatINR(plannerStats.savings)}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('workbook')}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#2F3E4E] hover:bg-[#1E293B] px-3 py-2.5 text-xs font-display font-extrabold text-[#F9C80E] transition cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Open Detailed 10-Tab Workbook
                </button>
              </div>
            </div>
          </div>

          {/* Cashflow Split Bar */}
          <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 sm:p-6 shadow-[0_4px_0_#2F3E4E]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2F3E4E]/15 pb-3">
              <div>
                <h3 className="font-display font-extrabold text-base text-[#2F3E4E]">
                  Annual Salary Cashflow Split ({formatINR(grossSalary)} Gross)
                </h3>
                <p className="text-xs text-[#475569]">
                  Compares Net In-Hand Take-Home, EPF Corpus (12% Basic), and Annual Income Tax + PT.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-[11px] font-bold text-[#2F3E4E]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-xs bg-[#12805C] border border-[#2F3E4E]/40" />
                  Net Take-Home
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-xs bg-[#0EA5E9] border border-[#2F3E4E]/40" />
                  EPF Corpus
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-xs bg-[#F9C80E] border border-[#2F3E4E]/40" />
                  Income Tax + PT
                </span>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {[
                {
                  label: 'New Tax Regime Cashflow',
                  takeHome: plannerStats.takeHomeNew,
                  tax: plannerStats.newTax,
                  isWinner: plannerStats.winner === 'new',
                },
                {
                  label: 'Old Tax Regime Cashflow',
                  takeHome: plannerStats.takeHomeOld,
                  tax: plannerStats.oldTax,
                  isWinner: plannerStats.winner === 'old',
                },
              ].map((row) => {
                const total = Math.max(
                  1,
                  row.takeHome + plannerStats.epfAnnual + row.tax + plannerStats.ptAnnual
                );
                const takePct = (row.takeHome / total) * 100;
                const epfPct = (plannerStats.epfAnnual / total) * 100;
                const taxPct = ((row.tax + plannerStats.ptAnnual) / total) * 100;
                return (
                  <div
                    key={row.label}
                    className={`rounded-xl border-[1.5px] p-4 ${
                      row.isWinner
                        ? 'border-[#12805C] bg-[#CEE5DC]/35'
                        : 'border-[#2F3E4E]/20 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-[#2F3E4E]">{row.label}</span>
                      <span className="text-xs font-bold tabular-nums text-[#12805C]">
                        {formatINR(Math.round(row.takeHome / 12))}/mo in hand
                      </span>
                    </div>

                    <div className="mt-2.5 flex h-4 w-full overflow-hidden rounded-lg border border-[#2F3E4E] bg-[#E2E8F0]">
                      <div
                        className="h-full bg-[#12805C] transition-all duration-300"
                        style={{ width: `${takePct}%` }}
                      />
                      <div
                        className="h-full bg-[#0EA5E9] transition-all duration-300"
                        style={{ width: `${epfPct}%` }}
                      />
                      <div
                        className="h-full bg-[#F9C80E] transition-all duration-300"
                        style={{ width: `${taxPct}%` }}
                      />
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] tabular-nums">
                      <div>
                        <div className="text-[#64748B]">Take-Home</div>
                        <div className="font-extrabold text-[#2F3E4E]">
                          {formatINR(row.takeHome)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[#64748B]">EPF Savings</div>
                        <div className="font-bold text-[#0369A1]">
                          {formatINR(plannerStats.epfAnnual)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[#64748B]">Annual Tax</div>
                        <div className="font-bold text-[#B45309]">{formatINR(row.tax)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3 Diagnostic Cards */}
          <div className="grid gap-5 lg:grid-cols-3">
            {/* Effective vs Marginal */}
            <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 shadow-[0_4px_0_#2F3E4E] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="w-9 h-9 rounded-lg border-[1.5px] border-[#2F3E4E] bg-[#F9C80E] flex items-center justify-center text-[#2F3E4E]">
                    <Percent className="w-4 h-4" />
                  </span>
                  <span className="text-[10px] font-display font-extrabold uppercase tracking-wider text-[#64748B]">
                    Slab + 4% Cess Probe
                  </span>
                </div>
                <h3 className="mt-3 font-display font-extrabold text-base text-[#2F3E4E]">
                  Effective vs Next-₹1L Marginal Rate
                </h3>
                <p className="mt-1 text-xs text-[#475569]">
                  Measures overall tax ratio and incremental tax triggered by your next ₹1,00,000 raise.
                </p>

                <div className="mt-3 space-y-2 text-xs">
                  <div className="rounded-xl border border-[#2F3E4E]/20 bg-white p-3">
                    <div className="flex items-center justify-between font-bold text-[#2F3E4E]">
                      <span>New Tax Regime</span>
                      <span className="tabular-nums">
                        {plannerStats.newEffRate.toFixed(1)}% Eff ·{' '}
                        <span className="text-[#B45309]">
                          {plannerStats.newMarginalPct.toFixed(1)}% Marg
                        </span>
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-[#64748B] tabular-nums">
                      Next ₹1,00,000 raise adds {formatINR(plannerStats.newNext1L)} tax
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#2F3E4E]/20 bg-white p-3">
                    <div className="flex items-center justify-between font-bold text-[#2F3E4E]">
                      <span>Old Tax Regime</span>
                      <span className="tabular-nums">
                        {plannerStats.oldEffRate.toFixed(1)}% Eff ·{' '}
                        <span className="text-[#475569]">
                          {plannerStats.oldMarginalPct.toFixed(1)}% Marg
                        </span>
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-[#64748B] tabular-nums">
                      Next ₹1,00,000 raise adds {formatINR(plannerStats.oldNext1L)} tax
                    </div>
                  </div>
                </div>
              </div>

              {plannerStats.newMarginalPct > 35 && (
                <div className="mt-3 rounded-lg border border-[#F59E0B] bg-[#FEF3C7] p-2.5 text-[11px] font-semibold text-[#92400E] flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Sec 87A Cliff Alert: Just above ₹12L taxable income, marginal relief creates a
                    steep tax step on the next raise.
                  </span>
                </div>
              )}
            </div>

            {/* Binary Search Break-Even Threshold */}
            <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 shadow-[0_4px_0_#2F3E4E] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="w-9 h-9 rounded-lg border-[1.5px] border-[#2F3E4E] bg-[#CEE5DC] flex items-center justify-center text-[#2F3E4E]">
                    <Target className="w-4 h-4" />
                  </span>
                  <span className="text-[10px] font-display font-extrabold uppercase tracking-wider text-[#64748B]">
                    Binary-Search Solver
                  </span>
                </div>
                <h3 className="mt-3 font-display font-extrabold text-base text-[#2F3E4E]">
                  Old vs New Break-Even Point
                </h3>
                <p className="mt-1 text-xs text-[#475569]">
                  Additional Old-Regime exemptions needed for Old Regime tax to equal or beat New Regime.
                </p>

                <div className="mt-3 rounded-xl border border-[#2F3E4E]/20 bg-white p-3.5">
                  <div className="text-[11px] font-semibold text-[#64748B]">
                    Current Old Deductions (excl. Std Ded &amp; PT)
                  </div>
                  <div className="mt-0.5 text-lg font-extrabold text-[#2F3E4E] tabular-nums">
                    {formatINR(plannerStats.oldDeductionsNonStd)}
                  </div>

                  <div className="mt-3 border-t border-[#2F3E4E]/15 pt-3">
                    {grossSalary <= 0 ? (
                      <div className="text-xs text-[#64748B]">
                        Enter gross salary above to solve break-even.
                      </div>
                    ) : plannerStats.breakEvenExtra === 0 ? (
                      <div className="text-xs font-bold text-[#12805C]">
                        Old Regime already matches or beats New Regime by{' '}
                        <span className="tabular-nums">{formatINR(plannerStats.savings)}</span>.
                      </div>
                    ) : plannerStats.breakEvenExtra !== null ? (
                      <>
                        <div className="text-[11px] font-bold text-[#B45309]">
                          Extra Deduction Needed to Beat New Regime
                        </div>
                        <div className="mt-0.5 text-2xl font-extrabold text-[#2F3E4E] tabular-nums">
                          +{formatINR(plannerStats.breakEvenExtra)}
                        </div>
                        <div className="mt-1 text-[11px] text-[#475569] tabular-nums">
                          Total Old deductions needed:{' '}
                          <strong>{formatINR(plannerStats.breakEvenTotalOld ?? 0)}</strong>
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-[#475569]">
                        New Regime tax is already <strong>₹0</strong> under Section 87A (up to ₹12L taxable).
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-3 text-[11px] font-medium text-[#64748B]">
                Live FY 2026-27 Section 87A + slab calculation.
              </div>
            </div>

            {/* What-If Optimization Levers */}
            <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 shadow-[0_4px_0_#2F3E4E] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="w-9 h-9 rounded-lg border-[1.5px] border-[#2F3E4E] bg-[#2F3E4E] flex items-center justify-center text-[#F9C80E]">
                    <Zap className="w-4 h-4" />
                  </span>
                  <span className="text-[10px] font-display font-extrabold uppercase tracking-wider text-[#64748B]">
                    What-If Tax Levers
                  </span>
                </div>
                <h3 className="mt-3 font-display font-extrabold text-base text-[#2F3E4E]">
                  Instant Savings Simulations
                </h3>
                <p className="mt-1 text-xs text-[#475569]">
                  Estimated tax reduction from activating key NPS and Chapter VI-A deductions:
                </p>

                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-[#2F3E4E]/20 bg-white p-3">
                    <div>
                      <div className="font-bold text-[#2F3E4E]">Employer NPS 80CCD(2) (+₹50k)</div>
                      <div className="text-[11px] text-[#64748B]">Saves tax in BOTH regimes</div>
                    </div>
                    <div className="text-right font-extrabold tabular-nums text-[#12805C]">
                      -{formatINR(plannerStats.npsEmprSaved)}
                      <div className="text-[10px] font-medium text-[#64748B]">New Regime</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 rounded-xl border border-[#2F3E4E]/20 bg-white p-3">
                    <div>
                      <div className="font-bold text-[#2F3E4E]">Employee NPS 80CCD(1B) (+₹50k)</div>
                      <div className="text-[11px] text-[#64748B]">Old-Regime Tier-I NPS</div>
                    </div>
                    <div className="text-right font-extrabold tabular-nums text-[#2F3E4E]">
                      {npsEmployee >= 50000 ? 'Maxed' : `-${formatINR(plannerStats.npsEmpSaved)}`}
                      <div className="text-[10px] font-medium text-[#64748B]">Old Regime</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 rounded-xl border border-[#2F3E4E]/20 bg-white p-3">
                    <div>
                      <div className="font-bold text-[#2F3E4E]">Sec 80D Health Cover (₹25k)</div>
                      <div className="text-[11px] text-[#64748B]">Self &amp; family policy</div>
                    </div>
                    <div className="text-right font-extrabold tabular-nums text-[#2F3E4E]">
                      {sec80D >= 25000 ? 'Active' : `-${formatINR(plannerStats.healthSaved)}`}
                      <div className="text-[10px] font-medium text-[#64748B]">Old Regime</div>
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('workbook')}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#F9C80E] hover:bg-[#F4B400] px-3 py-2 text-xs font-display font-extrabold text-[#2F3E4E] cursor-pointer"
              >
                <Calculator className="w-3.5 h-3.5" />
                Model Home Loan &amp; Capital Gains in Workbook
              </button>
            </div>
          </div>

          <ToolExportBar
            title="Export FY 2026-27 Regime Comparison"
            clearLabel="Clear Planner (₹0)"
            onCopy={() => {
              const lines = [
                `FY 2026-27 Income Tax Comparison`,
                `Annual Gross Salary: ${formatINR(grossSalary)}`,
                `Old Regime Deductions: ${formatINR(plannerStats.oldTotalDeductions)} | Taxable: ${formatINR(plannerStats.oldTaxable)} | Tax: ${formatINR(plannerStats.oldTax)}`,
                `New Regime Deductions: ${formatINR(plannerStats.newTotalDeductions)} | Taxable: ${formatINR(plannerStats.newTaxable)} | Tax: ${formatINR(plannerStats.newTax)}`,
                `Verdict: ${plannerStats.winner === 'equal' ? 'Equal Tax' : `${plannerStats.winner === 'new' ? 'New' : 'Old'} Regime Wins`} (Annual Savings: ${formatINR(plannerStats.savings)})`,
              ];
              void copyTextToClipboard(lines.join('\n')).then((ok) => {
                if (ok) {
                  setPlannerCopied(true);
                  window.setTimeout(() => setPlannerCopied(false), 1800);
                }
              });
            }}
            copied={plannerCopied}
            copyLabel="Copy Summary"
            onClear={() => {
              setGrossSalary(0);
              setRentPaid(0);
              setSec80C(0);
              setSec80D(0);
              setNpsEmployee(0);
              setNpsEmployer(0);
              setHomeLoanInterest(0);
            }}
            onExcel={() =>
              downloadExcelWorkbook({
                filename: 'FY2627_Income_Tax_Planner.xlsx',
                sheets: [
                  {
                    name: 'Regime_Comparison',
                    headers: ['Particulars', 'Old Regime', 'New Regime'],
                    rows: [
                      ['Gross Salary', grossSalary, grossSalary],
                      ['HRA Exemption u/s 10(13A)', plannerStats.hraExempt, 0],
                      ['Home Loan Int. u/s 24(b)', plannerStats.effHomeLoanInt, 0],
                      ['Total Deductions', plannerStats.oldTotalDeductions, plannerStats.newTotalDeductions],
                      ['Net Taxable Income', plannerStats.oldTaxable, plannerStats.newTaxable],
                      ['Annual Tax + 4% Cess', plannerStats.oldTax, plannerStats.newTax],
                      ['Annual Take-Home (Net)', plannerStats.takeHomeOld, plannerStats.takeHomeNew],
                      ['Monthly Take-Home', Math.round(plannerStats.takeHomeOld / 12), Math.round(plannerStats.takeHomeNew / 12)],
                    ],
                  },
                ],
              })
            }
            onCsv={() =>
              downloadBomCsv({
                filename: 'FY2627_Income_Tax_Planner.csv',
                headers: ['Particulars', 'Old Regime', 'New Regime'],
                rows: [
                  ['Gross Salary', grossSalary, grossSalary],
                  ['Total Deductions', plannerStats.oldTotalDeductions, plannerStats.newTotalDeductions],
                  ['Net Taxable Income', plannerStats.oldTaxable, plannerStats.newTaxable],
                  ['Annual Tax + Cess', plannerStats.oldTax, plannerStats.newTax],
                  ['Annual Take-Home', plannerStats.takeHomeOld, plannerStats.takeHomeNew],
                ],
              })
            }
            onWord={() =>
              void downloadWordDocument({
                filename: 'FY2627_Income_Tax_Planner.docx',
                title: 'FY 2026-27 Income Tax Comparison Report',
                subtitle: `Gross Salary: ${formatINR(grossSalary)} · Recommended: ${plannerStats.winner === 'equal' ? 'Equal Tax' : `${plannerStats.winner === 'new' ? 'New' : 'Old'} Regime`}`,
                kpis: [
                  { label: 'Old Regime Tax', value: formatINR(plannerStats.oldTax) },
                  { label: 'New Regime Tax', value: formatINR(plannerStats.newTax) },
                  { label: 'Annual Tax Savings', value: formatINR(plannerStats.savings) },
                ],
                table: {
                  title: 'Regime & Cashflow Breakdown',
                  headers: ['Particulars', 'Old Regime', 'New Regime'],
                  rows: [
                    ['Gross Salary', formatINR(grossSalary), formatINR(grossSalary)],
                    ['Total Deductions', formatINR(plannerStats.oldTotalDeductions), formatINR(plannerStats.newTotalDeductions)],
                    ['Taxable Income', formatINR(plannerStats.oldTaxable), formatINR(plannerStats.newTaxable)],
                    ['Annual Tax + Cess', formatINR(plannerStats.oldTax), formatINR(plannerStats.newTax)],
                    ['Monthly In-Hand', formatINR(Math.round(plannerStats.takeHomeOld / 12)), formatINR(Math.round(plannerStats.takeHomeNew / 12))],
                  ],
                },
              })
            }
            onJson={() =>
              downloadJsonFile('FY2627_Income_Tax_Planner.json', {
                inputs: { grossSalary, metro, rentPaid, sec80C, sec80D, npsEmployee, npsEmployer, homeLoanInterest },
                summary: plannerStats,
              })
            }
            onPdf={() =>
              void exportStructuredReportPdf({
                title: 'FY 2026-27 Income Tax Planner (Old vs New)',
                subtitle: `Gross Salary: ${formatINR(grossSalary)} · Verdict: ${plannerStats.winner.toUpperCase()} Regime`,
                filename: 'FY2627_Income_Tax_Planner.pdf',
                kpis: [
                  { label: 'Old Regime Tax', value: formatINR(plannerStats.oldTax) },
                  { label: 'New Regime Tax', value: formatINR(plannerStats.newTax) },
                  { label: 'Annual Savings', value: formatINR(plannerStats.savings) },
                ],
                table: {
                  title: 'Old vs New Regime Comparison',
                  headers: ['Particulars', 'Old Regime', 'New Regime'],
                  rows: [
                    ['Gross Salary', formatINR(grossSalary), formatINR(grossSalary)],
                    ['Total Deductions', formatINR(plannerStats.oldTotalDeductions), formatINR(plannerStats.newTotalDeductions)],
                    ['Net Taxable Income', formatINR(plannerStats.oldTaxable), formatINR(plannerStats.newTaxable)],
                    ['Total Tax + 4% Cess', formatINR(plannerStats.oldTax), formatINR(plannerStats.newTax)],
                    ['Annual In-Hand Take-Home', formatINR(plannerStats.takeHomeOld), formatINR(plannerStats.takeHomeNew)],
                  ],
                },
              })
            }
            onPrint={() =>
              void printHtmlDocument({
                title: 'FY 2026-27 Income Tax Planner',
                bodyHtml: `
                  <h1>FY 2026-27 Income Tax Break-Even &amp; Cashflow Report</h1>
                  <div class="kpi-grid">
                    <div class="kpi-card"><div class="kpi-label">Gross Salary</div><div class="kpi-val">${formatINR(grossSalary)}</div></div>
                    <div class="kpi-card"><div class="kpi-label">Old Regime Tax</div><div class="kpi-val">${formatINR(plannerStats.oldTax)}</div></div>
                    <div class="kpi-card"><div class="kpi-label">New Regime Tax</div><div class="kpi-val">${formatINR(plannerStats.newTax)}</div></div>
                    <div class="kpi-card"><div class="kpi-label">Annual Savings</div><div class="kpi-val">${formatINR(plannerStats.savings)}</div></div>
                  </div>
                  <table>
                    <thead><tr><th>Particulars</th><th class="num">Old Regime</th><th class="num">New Regime</th></tr></thead>
                    <tbody>
                      <tr><td>Total Deductions</td><td class="num">${formatINR(plannerStats.oldTotalDeductions)}</td><td class="num">${formatINR(plannerStats.newTotalDeductions)}</td></tr>
                      <tr><td>Net Taxable Income</td><td class="num">${formatINR(plannerStats.oldTaxable)}</td><td class="num">${formatINR(plannerStats.newTaxable)}</td></tr>
                      <tr><td>Slab Tax + 4% Cess</td><td class="num">${formatINR(plannerStats.oldTax)}</td><td class="num">${formatINR(plannerStats.newTax)}</td></tr>
                      <tr><td>Annual Take-Home</td><td class="num">${formatINR(plannerStats.takeHomeOld)}</td><td class="num">${formatINR(plannerStats.takeHomeNew)}</td></tr>
                    </tbody>
                  </table>
                `,
              })
            }
            disabled={grossSalary <= 0}
          />
        </div>
      )}

      {/* TAB 3: FY 2026-27 SLABS & SALARIED GUIDE */}
      {activeTab === 'slabs-guide' && (
        <article className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 sm:p-8 shadow-[0_4px_0_#2F3E4E] space-y-8">
          <header className="border-b border-[#2F3E4E]/15 pb-5">
            <div className="text-xs font-display font-extrabold uppercase tracking-wider text-[#12805C]">
              Complete Salaried Employee Guide · FY 2026-27 (AY 2027-28)
            </div>
            <h2 className="mt-1.5 font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E]">
              Old vs New Tax Regime Slabs, Exemptions &amp; Worked Computation
            </h2>
            <p className="mt-2 text-sm text-[#475569] leading-relaxed">
              Every slab rate, Section 87A rebate rule, HRA exemption formula, Chapter VI-A limit,
              surcharge rule, and ₹15,00,000 worked calculation for Financial Year 2026-27.
            </p>
          </header>

          {/* Slab Tables Side by Side */}
          <section className="space-y-4">
            <h3 className="font-display font-extrabold text-lg text-[#2F3E4E]">
              Income Tax Slabs for FY 2026-27 (AY 2027-28)
            </h3>
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="overflow-hidden rounded-xl border-[1.5px] border-[#2F3E4E] bg-white">
                <h4 className="bg-[#2F3E4E] px-4 py-2.5 text-sm font-display font-extrabold text-[#F9C80E]">
                  New Tax Regime Slabs (Default · All Ages)
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-[#2F3E4E]/15 bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E]">
                      <tr>
                        <th className="px-4 py-2 text-left">Net Taxable Income</th>
                        <th className="px-4 py-2 text-right">Tax Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2F3E4E]/10 text-[#334155]">
                      <tr><td className="px-4 py-2">Up to ₹4,00,000</td><td className="px-4 py-2 text-right font-bold">Nil (0%)</td></tr>
                      <tr><td className="px-4 py-2">₹4,00,001 to ₹8,00,000</td><td className="px-4 py-2 text-right font-bold">5%</td></tr>
                      <tr><td className="px-4 py-2">₹8,00,001 to ₹12,00,000</td><td className="px-4 py-2 text-right font-bold">10%</td></tr>
                      <tr><td className="px-4 py-2">₹12,00,001 to ₹16,00,000</td><td className="px-4 py-2 text-right font-bold">15%</td></tr>
                      <tr><td className="px-4 py-2">₹16,00,001 to ₹20,00,000</td><td className="px-4 py-2 text-right font-bold">20%</td></tr>
                      <tr><td className="px-4 py-2">₹20,00,001 to ₹24,00,000</td><td className="px-4 py-2 text-right font-bold">25%</td></tr>
                      <tr><td className="px-4 py-2">Above ₹24,00,000</td><td className="px-4 py-2 text-right font-bold">30%</td></tr>
                    </tbody>
                  </table>
                </div>
                <p className="border-t border-[#2F3E4E]/10 bg-[#FFFDF5] px-4 py-2.5 text-xs text-[#475569]">
                  <strong>Section 87A Relief:</strong> Zero slab tax up to ₹12,00,000 taxable normal
                  income (₹12,75,000 salary after ₹75,000 Standard Deduction) + marginal relief.
                </p>
              </div>

              <div className="overflow-hidden rounded-xl border-[1.5px] border-[#2F3E4E] bg-white">
                <h4 className="bg-[#FEF2C8] border-b border-[#2F3E4E] px-4 py-2.5 text-sm font-display font-extrabold text-[#2F3E4E]">
                  Old Tax Regime Slabs (Individual &lt; 60 yrs)
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-[#2F3E4E]/15 bg-[#FFFDF5] text-xs font-bold text-[#2F3E4E]">
                      <tr>
                        <th className="px-4 py-2 text-left">Net Taxable Income</th>
                        <th className="px-4 py-2 text-right">Tax Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2F3E4E]/10 text-[#334155]">
                      <tr><td className="px-4 py-2">Up to ₹2,50,000*</td><td className="px-4 py-2 text-right font-bold">Nil (0%)</td></tr>
                      <tr><td className="px-4 py-2">₹2,50,001 to ₹5,00,000</td><td className="px-4 py-2 text-right font-bold">5%</td></tr>
                      <tr><td className="px-4 py-2">₹5,00,001 to ₹10,00,000</td><td className="px-4 py-2 text-right font-bold">20%</td></tr>
                      <tr><td className="px-4 py-2">Above ₹10,00,000</td><td className="px-4 py-2 text-right font-bold">30%</td></tr>
                    </tbody>
                  </table>
                </div>
                <p className="border-t border-[#2F3E4E]/10 bg-[#FFFDF5] px-4 py-2.5 text-xs text-[#475569]">
                  *Senior Citizens (60–79 yrs) get ₹3,00,000 nil slab and Super Seniors (80+ yrs)
                  get ₹5,00,000 nil slab automatically from Date of Birth inside the workbook.
                </p>
              </div>
            </div>
          </section>

          {/* Old vs New Comparison Table */}
          <section className="space-y-3">
            <h3 className="font-display font-extrabold text-lg text-[#2F3E4E]">
              Feature-by-Feature Comparison (Old vs New Regime)
            </h3>
            <div className="overflow-x-auto rounded-xl border-[1.5px] border-[#2F3E4E] bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#FEF2C8] text-xs font-bold uppercase text-[#2F3E4E] border-b border-[#2F3E4E]/20">
                  <tr>
                    <th className="px-4 py-3">Feature / Deduction</th>
                    <th className="px-4 py-3">Old Tax Regime</th>
                    <th className="px-4 py-3">New Tax Regime (Default)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2F3E4E]/10 text-[#334155]">
                  <tr>
                    <td className="px-4 py-2.5 font-semibold text-[#2F3E4E]">Standard Deduction</td>
                    <td className="px-4 py-2.5">₹50,000</td>
                    <td className="px-4 py-2.5 font-bold text-[#12805C]">₹75,000</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-semibold text-[#2F3E4E]">HRA, LTA &amp; Profession Tax</td>
                    <td className="px-4 py-2.5">Allowed as per rules</td>
                    <td className="px-4 py-2.5">Not allowed</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-semibold text-[#2F3E4E]">Sec 80C, 80CCD(1B), 80D, 80E, 80G</td>
                    <td className="px-4 py-2.5">Allowed</td>
                    <td className="px-4 py-2.5">Not allowed</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-semibold text-[#2F3E4E]">Employer NPS u/s 80CCD(2)</td>
                    <td className="px-4 py-2.5">Up to 10% (14% Govt) Basic + DA</td>
                    <td className="px-4 py-2.5 font-bold text-[#12805C]">Up to 14% Basic + DA</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-semibold text-[#2F3E4E]">Self-Occupied Home Loan Int. (24b)</td>
                    <td className="px-4 py-2.5">Up to ₹2,00,000</td>
                    <td className="px-4 py-2.5">Not allowed</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-semibold text-[#2F3E4E]">Section 87A Rebate Threshold</td>
                    <td className="px-4 py-2.5">Taxable ≤ ₹5,00,000 (max ₹12,500)</td>
                    <td className="px-4 py-2.5 font-bold text-[#12805C]">Taxable ≤ ₹12,00,000 (+ relief)</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-semibold text-[#2F3E4E]">Maximum Surcharge</td>
                    <td className="px-4 py-2.5">37% above ₹5 Crore</td>
                    <td className="px-4 py-2.5">Capped at 25% above ₹2 Crore</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Worked Numerical Example */}
          <section className="space-y-3">
            <h3 className="font-display font-extrabold text-lg text-[#2F3E4E]">
              Worked Example: ₹15,00,000 Metro Salaried Employee
            </h3>
            <p className="text-sm text-[#475569]">
              Basic ₹9,00,000 + HRA ₹4,50,000 + Special ₹1,50,000; Annual Rent ₹3,00,000; PT ₹2,400;
              80C ₹1,50,000 + NPS 80CCD(1B) ₹50,000 + 80D ₹25,000:
            </p>
            <div className="overflow-x-auto rounded-xl border-[1.5px] border-[#2F3E4E] bg-white">
              <table className="w-full text-sm tabular-nums">
                <thead className="bg-[#FEF2C8] text-xs font-bold uppercase text-[#2F3E4E] border-b border-[#2F3E4E]/20">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Computation Step</th>
                    <th className="px-4 py-2.5 text-right">Old Regime</th>
                    <th className="px-4 py-2.5 text-right">New Regime</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2F3E4E]/10 text-[#334155]">
                  <tr><td className="px-4 py-2 font-medium">Gross Salary</td><td className="px-4 py-2 text-right">₹15,00,000</td><td className="px-4 py-2 text-right">₹15,00,000</td></tr>
                  <tr><td className="px-4 py-2">Less: Standard Deduction + PT</td><td className="px-4 py-2 text-right">₹52,400</td><td className="px-4 py-2 text-right">₹75,000</td></tr>
                  <tr><td className="px-4 py-2">Less: HRA Exemption u/s 10(13A)</td><td className="px-4 py-2 text-right">₹2,10,000</td><td className="px-4 py-2 text-right">₹0</td></tr>
                  <tr><td className="px-4 py-2">Less: 80C + 80CCD(1B) + 80D</td><td className="px-4 py-2 text-right">₹2,25,000</td><td className="px-4 py-2 text-right">₹0</td></tr>
                  <tr className="bg-[#FFFDF5] font-bold text-[#2F3E4E]"><td className="px-4 py-2">Net Taxable Income</td><td className="px-4 py-2 text-right">₹10,12,600</td><td className="px-4 py-2 text-right">₹14,25,000</td></tr>
                  <tr><td className="px-4 py-2">Slab Tax + 4% Cess</td><td className="px-4 py-2 text-right">₹1,20,931</td><td className="px-4 py-2 text-right font-bold text-[#12805C]">₹97,500</td></tr>
                </tbody>
              </table>
            </div>
          </section>
        </article>
      )}

      {/* TAB 4: SALARIED TAX FAQs */}
      {activeTab === 'faqs' && (
        <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 sm:p-7 shadow-[0_4px_0_#2F3E4E] space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2F3E4E]/15 pb-4">
            <div>
              <h2 className="font-display font-extrabold text-lg sm:text-xl text-[#2F3E4E]">
                Indian Salaried Income Tax FAQs (FY 2026-27)
              </h2>
              <p className="text-xs text-[#475569]">
                Filter by category and click any question to expand the statutory explanation.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TAX_FAQ_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFaqCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                    faqCategory === cat
                      ? 'bg-[#2F3E4E] text-[#F9C80E] border-[#2F3E4E]'
                      : 'bg-white text-[#2F3E4E] border-[#2F3E4E]/25 hover:bg-[#FEF2C8]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5">
            {filteredFaqs.map((faq) => {
              const isOpen = openFaqId === faq.id;
              return (
                <div
                  key={faq.id}
                  className="rounded-xl border-[1.5px] border-[#2F3E4E] bg-white overflow-hidden"
                >
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaqId(isOpen ? null : faq.id)}
                    className="w-full px-4 py-3.5 text-left flex items-center justify-between gap-3 hover:bg-[#FFFDF5] cursor-pointer"
                  >
                    <div className="space-y-0.5">
                      <span className="inline-block text-[10px] font-display font-extrabold uppercase tracking-wider text-[#12805C]">
                        {faq.category}
                      </span>
                      <div className="text-sm font-bold text-[#2F3E4E]">{faq.question}</div>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-[#2F3E4E] shrink-0 transition-transform ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 text-xs sm:text-sm text-[#475569] leading-relaxed border-t border-[#2F3E4E]/10 bg-[#FFFDF5]">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
