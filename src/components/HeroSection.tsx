import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  ArrowUpRight,
  Calculator,
  Car,
  ClipboardCheck,
  Clock,
  Command,
  FileBadge,
  FileSpreadsheet,
  FileText,
  Fuel,
  GitCompareArrows,
  IndianRupee,
  Landmark,
  Lock,
  MapPin,
  PenTool,
  Receipt,
  ScanText,
  Search,
  Sparkles,
  Wrench,
  X,
} from 'lucide-react';
import { TOOLS_CATALOG, getToolById } from '../data/toolsCatalog';
import { ReleaseStatusTicker } from './ReleaseStatusTicker';
import { TulunaduFlagIcon } from './TulunaduFlagIcon';

interface HeroSectionProps {
  onExploreClick: () => void;
  onQuickLaunchTool: (toolId: string) => void;
  onOpenSearch: () => void;
}

const ROTATING_DOMAINS = [
  { label: 'Bank Slips', toolId: 'bank-slip-generator' },
  { label: 'Tax & GST', toolId: 'form-26as-to-excel' },
  { label: 'GST Utilities', toolId: 'gstr2b-tally-reconciler' },
  { label: 'PDF Tools', toolId: 'pdf-to-word' },
  { label: 'Image Studio', toolId: 'image-bg-remover' },
  { label: 'Calculators', toolId: 'unified-calculator' },
] as const;

interface SpotlightBoxItem {
  step: string;
  id: string;
  title: string;
  subtitle: string;
  icon: typeof Landmark;
  comingSoon?: boolean;
  isNew?: boolean;
  betaLabel?: string;
  locked?: boolean;
}

const HERO_SPOTLIGHT_BOXES: SpotlightBoxItem[] = [
  {
    step: '01',
    id: 'bank-slip-generator',
    title: 'Bank Deposit Slip Generator',
    subtitle: 'SBI & HDFC A4 cash, cheque & DD slips',
    icon: Landmark,
  },
  {
    step: '02',
    id: 'form-26as-to-excel',
    title: 'Form 26AS',
    subtitle: 'TRACES 26AS PDF to Excel workbook',
    icon: FileText,
  },
  {
    step: '03',
    id: 'gstr2b-tally-reconciler',
    title: 'GSTR-2B',
    subtitle: 'GSTR-2B vs Tally ITC audit & match',
    icon: Receipt,
  },
  {
    step: '04',
    id: 'invoice-to-excel',
    title: 'PDF Invoice to Excel (HSN Summary Maker)',
    subtitle: 'PDF invoices to GSTR-1 HSN & GST Excel register',
    icon: FileSpreadsheet,
  },
  {
    step: '05',
    id: 'unified-calculator',
    title: 'All-in-One Calculator',
    subtitle: 'EMI, SIP, Income Tax, Exam & Dates',
    icon: Calculator,
  },
  {
    step: '06',
    id: 'invoice-quotation-maker',
    title: 'GST Invoice & Quotation Maker',
    subtitle: 'Tax invoice, proforma, quote PDF & UPI QR',
    icon: FileBadge,
    isNew: true,
  },
  {
    step: '07',
    id: 'dms-tally-reconciler',
    title: 'DMS vs Tally Reconciliation',
    subtitle: 'DMS vs Tally Sales, Purchase & CN/DN match',
    icon: GitCompareArrows,
    isNew: true,
  },
  {
    step: '08',
    id: 'parts-billing-reconciler',
    title: 'Parts Billing vs Tally',
    subtitle: 'BMW Parts DI/E5 vs Tally register audit',
    icon: ClipboardCheck,
    isNew: true,
  },
  {
    step: '09',
    id: 'income-tax-fy-2026-27',
    title: 'Income Tax Calculator FY 2026-27',
    subtitle: 'Old vs New regime, 10-tab XL engine & break-even planner',
    icon: IndianRupee,
    betaLabel: 'Beta v2.0.8',
  },
  {
    step: '10',
    id: 'pdf-editor-advanced',
    title: 'PDF Editor Advanced',
    subtitle: 'Edit PDF text in original font, OCR, redact & organize',
    icon: PenTool,
    betaLabel: 'Beta v3.0',
  },
  {
    step: '11',
    id: 'tcs-tax-calculator',
    title: 'TCS & Tax Calculator',
    subtitle: 'Bidirectional TCS, GST CGST/SGST & IGST calculator',
    icon: Receipt,
    isNew: true,
  },
  {
    step: '12',
    id: 'rent-payment-letter-maker',
    title: 'Rent Payment Letter Maker – Advanced',
    subtitle: 'A4 rent letter with reverse TDS/GST check & letterhead space',
    icon: FileText,
    isNew: true,
  },
  {
    step: '13',
    id: 'incentive-report-tool',
    title: 'Incentive Report Tool',
    subtitle: 'Passcode locked · Tally ledger PDFs, deal sheets & OCR audit',
    icon: FileSpreadsheet,
    isNew: true,
    locked: true,
  },
  {
    step: '14',
    id: 'dbs-pnl-reports',
    title: 'DBS P&L & Reports Tool',
    subtitle: 'Passcode locked · DBS ZIP/CSV to 7-tab P&L & Excel report',
    icon: FileSpreadsheet,
    isNew: true,
    locked: true,
  },
  {
    step: '15',
    id: 'bmw-statement-reconciler',
    title: 'Customer Ledger (Purchase Only)',
    subtitle: 'Passcode locked · Multi-quarter BMW SOA vs Tally 14-tab audit',
    icon: GitCompareArrows,
    isNew: true,
    locked: true,
  },
  {
    step: '16',
    id: 'fuel-report-generator',
    title: 'Monthly Fuel Report Generator',
    subtitle: 'Passcode locked · Upload PDF or Excel IOCL report · Formula XLSX',
    icon: Fuel,
    isNew: true,
    locked: true,
  },
  {
    step: '17',
    id: 'covering-letter-generator',
    title: 'Covering Letter Generator',
    subtitle: 'Passcode locked · Tally ledger PDF & OCR to Word & PDF',
    icon: FileText,
    isNew: true,
    locked: true,
  },
  {
    step: '18',
    id: 'letterhead-invoice-maker',
    title: 'Letterhead Invoice Maker',
    subtitle: 'Tally invoice on company letterhead & seal above Authorised Signatory',
    icon: FileBadge,
    isNew: true,
  },
  {
    step: '19',
    id: 'textlift-ocr-pro',
    title: 'Textlift OCR Pro',
    subtitle: 'Open access · Photos, scans & PDFs to Text, GST Entities & Excel',
    icon: ScanText,
    isNew: true,
  },
  {
    step: '20',
    id: 'bmw-vendor-ledger-reconciler',
    title: 'BMW Vendor Ledger Reconciliation',
    subtitle: 'Passcode locked · SAP vendor ledger vs Tally bridge & claim check',
    icon: GitCompareArrows,
    isNew: true,
    locked: true,
  },
  {
    step: '21',
    id: 'bmw-claims-reconciler',
    title: 'BMW Claims Reconciler',
    subtitle: 'Passcode locked · DMS invoices vs credit/debit notes & claims',
    icon: ClipboardCheck,
    isNew: true,
    locked: true,
  },
  {
    step: '22',
    id: 'vcpl-rtgs-neft-form',
    title: 'VCPL Bulk Bank Transfer Form',
    subtitle: 'Passcode locked · Same Bank (SBI) & NEFT/RTGS bulk transfer letters',
    icon: Landmark,
    isNew: true,
    locked: true,
  },
  {
    step: '23',
    id: 'tds-26as-tally-reco',
    title: '26AS ⇄ Tally Ledger Reco',
    subtitle: 'Open access · Form 26AS/ATS vs Tally TDS/TCS ledgers & Pro ExcelJS',
    icon: GitCompareArrows,
    isNew: true,
  },
  {
    step: '24',
    id: 'upcoming-tool-24',
    title: 'New Utility Coming Soon',
    subtitle: 'Upcoming GST & ledger reconciliation tool coming soon',
    icon: Receipt,
    comingSoon: true,
  },
  {
    step: '25',
    id: 'upcoming-tool-25',
    title: 'New Utility Coming Soon',
    subtitle: 'Upcoming dealership productivity module coming soon',
    icon: Sparkles,
    comingSoon: true,
  },
];

export function HeroSection({
  onExploreClick,
  onQuickLaunchTool,
  onOpenSearch,
}: HeroSectionProps) {
  const [toggleOn, setToggleOn] = useState(true);
  const [domainIndex, setDomainIndex] = useState(0);
  const [heroQuery, setHeroQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showRtoUpgradeNotice, setShowRtoUpgradeNotice] = useState(false);
  const searchWrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const timer = window.setInterval(() => {
      setDomainIndex((prev) => (prev + 1) % ROTATING_DOMAINS.length);
    }, 2400);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const searchResults = useMemo(() => {
    const q = heroQuery.trim().toLowerCase();
    if (!q) return [];
    const matches = TOOLS_CATALOG.filter(
      (tool) =>
        tool.title.toLowerCase().includes(q) ||
        tool.code.toLowerCase().includes(q) ||
        tool.suite.toLowerCase().includes(q) ||
        tool.categoryName.toLowerCase().includes(q) ||
        tool.description.toLowerCase().includes(q) ||
        (tool.keywords?.some((k) => k.toLowerCase().includes(q)) ?? false)
    );
    return matches.sort((a, b) => {
      const aTitle = a.title.toLowerCase().includes(q) || a.code.toLowerCase() === q ? 0 : 1;
      const bTitle = b.title.toLowerCase().includes(q) || b.code.toLowerCase() === q ? 0 : 1;
      return aTitle - bTitle;
    });
  }, [heroQuery]);

  const currentDomain = ROTATING_DOMAINS[domainIndex];

  return (
    <section
      id="top"
      className="relative w-full bg-[#FEF2C8] dark:bg-[#0B1120] pt-5 pb-14 sm:pt-7 sm:pb-16 md:pt-8 md:pb-20 overflow-hidden transition-colors duration-200"
    >
      <div className="max-w-[1280px] mx-auto pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6 relative">
        {/* Upper-right dashed connector accent kept clear of headline and spotlight cards */}
        <svg
          viewBox="0 0 180 110"
          fill="none"
          aria-hidden="true"
          className="hidden xl:block absolute right-4 -top-2 w-32 h-20 pointer-events-none z-0 opacity-85"
        >
          <path
            d="M4 70 C 66 70, 74 14, 148 14"
            stroke="currentColor"
            strokeOpacity="0.35"
            strokeWidth="2"
            strokeDasharray="6 6"
            strokeLinecap="round"
            className="animate-dash-flow text-[#2F3E4E] dark:text-slate-400"
          />
          <circle
            cx="150"
            cy="14"
            r="6.5"
            fill="none"
            stroke="#F9C80E"
            strokeWidth="1.8"
            className="animate-dot-pulse"
          />
          <circle cx="150" cy="14" r="4" fill="#F9C80E" stroke="#2F3E4E" strokeWidth="1.5" />
        </svg>

        {/* Live Global Search Bar Directly After Main Menu Bar (Above Hero Headline) */}
        <div
          ref={searchWrapperRef}
          className="mb-7 sm:mb-9 md:mb-11 w-full max-w-[660px] mx-auto relative z-30"
        >
          <div className="relative flex items-center bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-600 rounded-2xl shadow-[0_3px_0_#2F3E4E] dark:shadow-[0_4px_0_#020617] focus-within:ring-2 focus-within:ring-[#F9C80E]">
            <Search
              className="w-5 h-5 text-[#2F3E4E] dark:text-slate-300 ml-4 shrink-0 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              value={heroQuery}
              onFocus={() => setIsSearchFocused(true)}
              onChange={(e) => {
                setHeroQuery(e.target.value);
                setIsSearchFocused(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (searchResults.length > 0) {
                    onQuickLaunchTool(searchResults[0].id);
                    setIsSearchFocused(false);
                  } else {
                    onOpenSearch();
                  }
                } else if (e.key === 'Escape') {
                  setIsSearchFocused(false);
                }
              }}
              placeholder={`Search ${TOOLS_CATALOG.length} live tools — IFSC, PIN Code, PDF to Word, 26AS, EMI...`}
              aria-label="Search VCPL tools"
              className="w-full px-3.5 py-3.5 bg-transparent dark:bg-transparent text-sm sm:text-[15px] text-[#2F3E4E] dark:text-slate-100 placeholder:text-[#64748B] dark:placeholder:text-slate-400 font-medium focus:outline-none"
            />
            {heroQuery ? (
              <button
                type="button"
                onClick={() => setHeroQuery('')}
                aria-label="Clear search query"
                className="p-2 mr-1 text-[#64748B] dark:text-slate-400 hover:text-[#2F3E4E] dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenSearch}
                title="Open Advanced Search (Ctrl+K)"
                className="hidden sm:inline-flex items-center gap-1 mr-3 px-2.5 py-1 rounded-lg bg-[#FEF2C8] dark:bg-slate-800 border border-[#2F3E4E]/35 dark:border-slate-600 text-[11px] font-mono font-bold text-[#2F3E4E] dark:text-slate-200 hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] dark:hover:text-[#0F172A] cursor-pointer shrink-0 transition-colors"
              >
                <span>Ctrl+K</span>
              </button>
            )}
          </div>

          {isSearchFocused && heroQuery.trim().length > 0 && (
            <div className="absolute left-0 right-0 mt-2 bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-600 rounded-2xl shadow-[0_6px_0_#2F3E4E] dark:shadow-[0_8px_0_#020617] overflow-hidden text-left max-h-[340px] flex flex-col">
              {searchResults.length === 0 ? (
                <div className="p-5 text-center text-xs text-[#475569] dark:text-slate-300">
                  <p className="font-bold text-[#2F3E4E] dark:text-slate-100 text-sm">
                    No tool matched &ldquo;{heroQuery.trim()}&rdquo;
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSearchFocused(false);
                      onOpenSearch();
                    }}
                    className="mt-2.5 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#FFFDF5] dark:text-[#0F172A] font-bold cursor-pointer"
                  >
                    Open Full Directory Search
                  </button>
                </div>
              ) : (
                <>
                  <div className="overflow-y-auto divide-y divide-[#2F3E4E]/10 dark:divide-slate-700/80">
                    {searchResults.slice(0, 8).map((tool) => (
                      <button
                        key={tool.id}
                        type="button"
                        onClick={() => {
                          onQuickLaunchTool(tool.id);
                          setIsSearchFocused(false);
                        }}
                        className="w-full px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-[#FEF2C8] dark:hover:bg-slate-800 transition-colors text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="px-2 py-0.5 rounded bg-[#2F3E4E] dark:bg-slate-700 text-[#FFFDF5] text-[10px] font-mono font-bold shrink-0">
                            {tool.code}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-bold text-[#2F3E4E] dark:text-slate-100 truncate">
                              {tool.title}
                            </p>
                            <p className="text-[11px] text-[#64748B] dark:text-slate-400 truncate">
                              {tool.suite} · {tool.categoryName} · {tool.statusLabel}
                            </p>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-[#2F3E4E] dark:text-slate-300 shrink-0" />
                      </button>
                    ))}
                  </div>
                  {searchResults.length > 8 && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsSearchFocused(false);
                        onOpenSearch();
                      }}
                      className="w-full py-2 px-4 bg-[#CEE5DC]/65 dark:bg-emerald-950/60 hover:bg-[#CEE5DC] dark:hover:bg-emerald-900/60 border-t border-[#2F3E4E]/15 dark:border-slate-700 text-xs font-bold text-[#2F3E4E] dark:text-emerald-200 text-center cursor-pointer"
                    >
                      View all {searchResults.length} matching tools →
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Centered Modern 2-Line Typographic + Tactile Widget Composition */}
        <div className="relative z-10 mx-auto max-w-[1040px] flex flex-col items-center text-center">
          <h1
            aria-label="Smart browser tools built for Bank Slips, Tax & GST, PDF Tools, Calculators, and Daily Utilities"
            className="flex flex-col items-center gap-3 sm:gap-4"
          >
            {/* LINE 1: "Smart" + Arrow Badge + Theme Toggle Switch + "browser tools" */}
            <span className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-4">
              <span className="font-display font-extrabold text-[clamp(2.35rem,5.4vw,4.35rem)] leading-[1.06] tracking-[-0.03em] text-[#2F3E4E] dark:text-slate-50">
                Smart
              </span>

              {/* Mint & Slate Circular Arrow Button */}
              <button
                type="button"
                onClick={onExploreClick}
                aria-label={`Explore all ${TOOLS_CATALOG.length} VCPL tools`}
                className="w-11 h-11 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full bg-[#CEE5DC] dark:bg-emerald-900/55 hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] dark:border-emerald-400/50 text-[#2F3E4E] dark:text-emerald-200 dark:hover:text-[#0F172A] flex items-center justify-center shadow-[0_3px_0_#2F3E4E] dark:shadow-[0_3px_0_#020617] transition-all duration-150 hover:-translate-y-0.5 cursor-pointer shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#2F3E4E] dark:focus-visible:ring-[#F9C80E]"
              >
                <ArrowUpRight className="w-5 h-5 sm:w-7 sm:h-7 stroke-[2.4]" />
              </button>

              {/* Theme-Matched Interactive Switch Pill */}
              <button
                type="button"
                role="switch"
                aria-checked={toggleOn}
                aria-label="Toggle quick calculator highlight"
                onClick={() => setToggleOn((prev) => !prev)}
                className={`relative w-24 sm:w-32 md:w-36 h-11 sm:h-14 md:h-16 rounded-full border-[1.5px] border-[#2F3E4E] dark:border-slate-500 p-1 flex items-center cursor-pointer transition-colors duration-200 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#2F3E4E] dark:focus-visible:ring-[#F9C80E] ${
                  toggleOn ? 'bg-[#2F3E4E] dark:bg-slate-800' : 'bg-[#FFE1B3] dark:bg-amber-900/40'
                }`}
              >
                <span
                  className={`w-8 h-8 sm:w-11 sm:h-11 md:w-[52px] md:h-[52px] rounded-full border-[1.5px] border-[#2F3E4E] flex items-center justify-center transition-transform duration-200 ${
                    toggleOn
                      ? 'translate-x-[50px] sm:translate-x-[68px] md:translate-x-[76px] bg-[#F9C80E]'
                      : 'translate-x-0 bg-[#FFFDF5]'
                  }`}
                >
                  <span className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 rounded-full border-[2px] border-[#2F3E4E] border-t-transparent animate-arc-spin" />
                </span>
              </button>

              <span className="font-display font-extrabold text-[clamp(2.35rem,5.4vw,4.35rem)] leading-[1.06] tracking-[-0.03em] text-[#2F3E4E] dark:text-slate-50">
                browser tools
              </span>
            </span>

            {/* LINE 2: Venn Command Shortcut + "built for" + Running/Rotating Last Phrase */}
            <span className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-4">
              {/* Overlapping Marigold & Mint Venn Circles with Command Key */}
              <button
                type="button"
                onClick={onOpenSearch}
                aria-label="Open tool search (Command K)"
                className="group relative flex items-center justify-center w-20 sm:w-24 md:w-28 h-11 sm:h-14 md:h-16 cursor-pointer shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#2F3E4E] dark:focus-visible:ring-[#F9C80E] rounded-full"
              >
                <span className="absolute left-0.5 w-11 h-11 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full bg-[#FFE1B3] dark:bg-amber-500/25 border-[1.5px] border-[#2F3E4E] dark:border-amber-400/50 transition-transform duration-150 group-hover:-translate-x-0.5" />
                <span className="absolute right-0.5 w-11 h-11 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full bg-[#CEE5DC]/90 dark:bg-emerald-500/25 border-[1.5px] border-[#2F3E4E] dark:border-emerald-400/50 transition-transform duration-150 group-hover:translate-x-0.5" />
                <span className="relative z-10 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#FFFDF5] dark:bg-slate-800 border-[1.5px] border-[#2F3E4E] dark:border-slate-400 flex items-center justify-center text-[#2F3E4E] dark:text-slate-100 shadow-xs">
                  <Command className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </span>
              </button>

              <span className="font-display font-extrabold text-[clamp(2.35rem,5.4vw,4.35rem)] leading-[1.06] tracking-[-0.03em] text-[#2F3E4E] dark:text-slate-50">
                built for
              </span>

              {/* Running / Rotating Last Word (Interactive Click to Open Active Domain Tool) */}
              <button
                type="button"
                onClick={() => onQuickLaunchTool(currentDomain.toolId)}
                aria-live="polite"
                title={`Open ${currentDomain.label}`}
                className="relative inline-flex items-center justify-center min-w-[180px] sm:min-w-[290px] md:min-w-[350px] px-3.5 sm:px-4 py-1 rounded-xl bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] dark:border-[#F9C80E] shadow-[0_3px_0_#2F3E4E] dark:shadow-[0_3px_0_#020617] overflow-hidden cursor-pointer transition-transform duration-150 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#2F3E4E] dark:focus-visible:ring-[#F9C80E]"
              >
                <AnimatePresence mode="wait">
                  <motion.span
                    key={currentDomain.label}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -14 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    className="font-display font-extrabold text-[clamp(1.75rem,4.8vw,3.9rem)] leading-[1.08] tracking-[-0.03em] text-[#2F3E4E] dark:text-[#0F172A] whitespace-nowrap"
                  >
                    {currentDomain.label}
                  </motion.span>
                </AnimatePresence>
              </button>
            </span>
          </h1>

          {/* Modern 2-Line SEO-Optimized Subtitle */}
          <p className="mt-6 sm:mt-7 max-w-[780px] text-sm sm:text-[17px] leading-[1.6] text-[#475569] dark:text-slate-300 font-normal px-1">
            Generate SBI &amp; HDFC deposit slips, convert Form 26AS &amp; invoices to Excel, reconcile GSTR-2B, edit PDFs, and run calculations—100% private in your browser.
          </p>

          {/* Centered Dual CTA Row */}
          <div className="mt-7 w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-3.5">
            <button
              type="button"
              onClick={onExploreClick}
              className="w-full sm:w-auto min-h-[44px] px-7 py-3 rounded-lg bg-[#2F3E4E] dark:bg-[#F9C80E] hover:bg-[#1E293B] dark:hover:bg-[#FDE047] text-[#FFFDF5] dark:text-[#0F172A] border-[1.5px] border-[#2F3E4E] dark:border-[#F9C80E] text-sm sm:text-[15px] font-semibold transition-all duration-150 active:translate-y-0.5 cursor-pointer whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#2F3E4E] dark:focus-visible:ring-[#F9C80E]"
            >
              Explore All {TOOLS_CATALOG.length} Tools
            </button>

            <button
              type="button"
              onClick={() => onQuickLaunchTool('unified-calculator')}
              className="w-full sm:w-auto min-h-[44px] px-6 py-3 rounded-lg bg-[#FFFDF5] dark:bg-[#131C2E] hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] text-[#2F3E4E] dark:text-slate-100 dark:hover:text-[#0F172A] border-[1.5px] border-[#2F3E4E] dark:border-slate-500 text-sm sm:text-[15px] font-semibold transition-all duration-150 active:translate-y-0.5 cursor-pointer whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#2F3E4E] dark:focus-visible:ring-[#F9C80E]"
            >
              Open All-in-One Calculator
            </button>
          </div>

        </div>

        {/* Modern Running Release Status Line Above the 25 Spotlight Boxes */}
        <div className="mt-9 pt-6 border-t border-[#2F3E4E]/15 dark:border-slate-800">
          <ReleaseStatusTicker />
        </div>

        {/* 25 Spotlight Boxes (5x5 Structure): 22 Live Flagship Tools + 3 Coming Soon Slots */}
        <div className="relative z-10 mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 max-w-[1400px] mx-auto">
          {HERO_SPOTLIGHT_BOXES.map((box) => {
            const Icon = box.icon;
            const catalogTool = box.comingSoon ? undefined : getToolById(box.id);
            if (box.comingSoon) {
              return (
                <button
                  key={box.id}
                  type="button"
                  onClick={() => {
                    const faqEl = document.getElementById('faq');
                    if (faqEl) faqEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  title="Surprise tool coming soon — view FAQ"
                  className="group text-left bg-[#FFFDF5]/75 dark:bg-[#131C2E]/80 hover:bg-[#FFFDF5] dark:hover:bg-[#1A253B] border-[1.5px] border-dashed border-[#2F3E4E]/55 dark:border-slate-600 rounded-xl p-4 flex flex-col justify-between gap-3 transition-all duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F3E4E] dark:focus-visible:ring-[#F9C80E]"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="w-8 h-8 rounded-lg bg-[#FFE1B3]/80 dark:bg-amber-500/20 border border-[#2F3E4E]/50 dark:border-amber-400/40 text-[#2F3E4E] dark:text-amber-200 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4" aria-hidden="true" />
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#2F3E4E]/10 dark:bg-slate-800 text-[10px] font-mono font-bold text-[#2F3E4E] dark:text-slate-300 tabular-nums">
                        {box.step}
                      </span>
                    </div>
                    <h2 className="font-display font-bold text-sm leading-snug text-[#2F3E4E] dark:text-slate-100">
                      {box.title}
                    </h2>
                    <p className="text-xs leading-snug text-[#475569] dark:text-slate-400">{box.subtitle}</p>
                  </div>

                  <div className="pt-2 border-t border-[#2F3E4E]/10 dark:border-slate-700/80 flex items-center justify-between text-[11px] font-bold text-[#64748B] dark:text-slate-400">
                    <span className="inline-flex items-center gap-1 text-[#9E2A2B] dark:text-rose-400">
                      <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />
                      <span>Coming Soon</span>
                    </span>
                    <span className="text-[10px] font-mono text-[#64748B] dark:text-slate-400 group-hover:text-[#2F3E4E] dark:group-hover:text-slate-100">
                      FAQ
                    </span>
                  </div>
                </button>
              );
            }

            return (
              <button
                key={box.id}
                type="button"
                onClick={() => onQuickLaunchTool(box.id)}
                className={`group text-left bg-[#FFFDF5] dark:bg-[#131C2E] hover:bg-white dark:hover:bg-[#1A253B] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 dark:hover:border-[#F9C80E]/75 rounded-xl p-4 flex flex-col justify-between gap-3 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_4px_0_#2F3E4E] dark:hover:shadow-[0_4px_0_#020617] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F3E4E] dark:focus-visible:ring-[#F9C80E] ${
                  box.isNew || box.betaLabel ? 'ring-1 ring-[#F9C80E]/80 dark:ring-[#F9C80E]/50' : ''
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`w-8 h-8 rounded-lg border border-[#2F3E4E] dark:border-slate-600 text-[#2F3E4E] flex items-center justify-center shrink-0 ${
                        box.betaLabel
                          ? 'bg-[#FFE1B3] dark:bg-amber-500/25 dark:text-amber-200 dark:border-amber-400/40'
                          : box.isNew
                          ? 'bg-[#F9C80E] dark:text-[#0F172A] dark:border-[#F9C80E]'
                          : 'bg-[#CEE5DC] dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-400/40'
                      }`}
                    >
                      <Icon className="w-4 h-4" aria-hidden="true" />
                    </span>
                    <div className="flex items-center gap-1.5">
                      {box.betaLabel && (
                        <span className="px-1.5 py-0.5 rounded bg-[#B45309] dark:bg-amber-600 text-[#FFFDF5] text-[9px] font-display font-extrabold uppercase tracking-wider whitespace-nowrap">
                          {box.betaLabel}
                        </span>
                      )}
                      {box.locked && (
                        <span
                          title="Passcode required"
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#CEE5DC] dark:bg-emerald-950/70 border border-[#2F3E4E]/35 dark:border-emerald-500/40 text-[#2F3E4E] dark:text-emerald-300 text-[9px] font-display font-extrabold uppercase tracking-wider"
                        >
                          <Lock className="w-2.5 h-2.5" aria-hidden="true" />
                          <span>Lock</span>
                        </span>
                      )}
                      {box.isNew && (
                        <span className="px-1.5 py-0.5 rounded bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#F9C80E] dark:text-[#0F172A] text-[9px] font-display font-extrabold uppercase tracking-wider">
                          New
                        </span>
                      )}
                      <span className="text-[11px] font-mono font-bold text-[#64748B] dark:text-slate-400 tabular-nums">
                        {box.step}
                      </span>
                    </div>
                  </div>
                  {catalogTool && (
                    <div
                      className="text-[11px] font-display font-bold tracking-tight dark:brightness-125"
                      style={{ color: catalogTool.suiteAccent }}
                    >
                      {catalogTool.suite} · {catalogTool.code}
                    </div>
                  )}
                  <h2 className="font-display font-bold text-sm leading-snug text-[#2F3E4E] dark:text-slate-100">
                    {box.title}
                  </h2>
                  <p className="text-xs leading-snug text-[#475569] dark:text-slate-400">{box.subtitle}</p>
                </div>

                <div className="pt-2 border-t border-[#2F3E4E]/10 dark:border-slate-700/80 flex items-center justify-between text-xs font-bold text-[#2F3E4E] dark:text-slate-200 group-hover:text-[#2F3E4E] dark:group-hover:text-[#F9C80E]">
                  <span>{box.locked ? 'Unlock Tool' : 'Open Tool'}</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Compact Quick-Launch Bar for Directory Utilities (IFSC, PIN Code & RTO) */}
        <div className="relative z-10 mt-6 max-w-[1400px] mx-auto">
          <div className="flex flex-wrap items-center justify-center gap-3">
            {/* 1. Tulusiri Pro – Tulu Lipi Studio (Special Tools · Beta Testing) */}
            <button
              type="button"
              onClick={() => {
                setShowRtoUpgradeNotice(false);
                onQuickLaunchTool('tulusiri-pro');
              }}
              className="group inline-flex items-center gap-3 px-4 py-2.5 min-h-[48px] rounded-xl bg-[#FFFDF5] dark:bg-[#131C2E] hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] dark:border-slate-600 shadow-[0_3px_0_#2F3E4E] dark:shadow-[0_3px_0_#020617] text-left transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F3E4E] dark:focus-visible:ring-[#F9C80E]"
            >
              <span className="w-8 h-8 rounded-lg bg-[#FEE2E2] dark:bg-rose-950/80 group-hover:bg-[#FFFDF5] dark:group-hover:bg-[#0F172A] border border-[#2F3E4E] dark:border-rose-500/40 flex items-center justify-center shrink-0 transition-colors">
                <TulunaduFlagIcon size="sm" />
              </span>
              <span className="leading-tight">
                <span className="block font-display font-extrabold text-xs sm:text-sm text-[#2F3E4E] dark:text-slate-100 dark:group-hover:text-[#0F172A] whitespace-nowrap">
                  Learn Tulu · Tulusiri Pro
                </span>
                <span className="block font-mono text-[10px] font-semibold text-[#B45309] dark:text-amber-400 group-hover:text-[#2F3E4E] dark:group-hover:text-[#0F172A]">
                  Special Tools · Beta Testing
                </span>
              </span>
              <ArrowUpRight
                className="w-4 h-4 text-[#2F3E4E] dark:text-slate-300 dark:group-hover:text-[#0F172A] ml-1 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                aria-hidden="true"
              />
            </button>

            {/* 2. IFSC Code Finder */}
            <button
              type="button"
              onClick={() => {
                setShowRtoUpgradeNotice(false);
                onQuickLaunchTool('bank-ifsc-finder');
              }}
              className="group inline-flex items-center gap-3 px-4 py-2.5 min-h-[48px] rounded-xl bg-[#FFFDF5] dark:bg-[#131C2E] hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] dark:border-slate-600 shadow-[0_3px_0_#2F3E4E] dark:shadow-[0_3px_0_#020617] text-left transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F3E4E] dark:focus-visible:ring-[#F9C80E]"
            >
              <span className="w-8 h-8 rounded-lg bg-[#CEE5DC] dark:bg-emerald-950/80 group-hover:bg-[#FFFDF5] dark:group-hover:bg-[#0F172A] border border-[#2F3E4E] dark:border-emerald-500/40 text-[#2F3E4E] dark:text-emerald-300 dark:group-hover:text-[#F9C80E] flex items-center justify-center shrink-0 transition-colors">
                <Landmark className="w-4 h-4" aria-hidden="true" />
              </span>
              <span className="leading-tight">
                <span className="block font-display font-extrabold text-xs sm:text-sm text-[#2F3E4E] dark:text-slate-100 dark:group-hover:text-[#0F172A] whitespace-nowrap">
                  IFSC Code Finder
                </span>
                <span className="block font-mono text-[10px] font-semibold text-[#12805C] dark:text-emerald-400 group-hover:text-[#2F3E4E] dark:group-hover:text-[#0F172A]">
                  RBI / NPCI Directory · Open
                </span>
              </span>
              <ArrowUpRight
                className="w-4 h-4 text-[#2F3E4E] dark:text-slate-300 dark:group-hover:text-[#0F172A] ml-1 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                aria-hidden="true"
              />
            </button>

            {/* 3. PIN Code Finder */}
            <button
              type="button"
              onClick={() => {
                setShowRtoUpgradeNotice(false);
                onQuickLaunchTool('pin-code-finder');
              }}
              className="group inline-flex items-center gap-3 px-4 py-2.5 min-h-[48px] rounded-xl bg-[#FFFDF5] dark:bg-[#131C2E] hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] dark:border-slate-600 shadow-[0_3px_0_#2F3E4E] dark:shadow-[0_3px_0_#020617] text-left transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F3E4E] dark:focus-visible:ring-[#F9C80E]"
            >
              <span className="w-8 h-8 rounded-lg bg-[#F9C80E] group-hover:bg-[#FFFDF5] dark:group-hover:bg-[#0F172A] border border-[#2F3E4E] text-[#2F3E4E] dark:group-hover:text-[#F9C80E] flex items-center justify-center shrink-0 transition-colors">
                <MapPin className="w-4 h-4" aria-hidden="true" />
              </span>
              <span className="leading-tight">
                <span className="block font-display font-extrabold text-xs sm:text-sm text-[#2F3E4E] dark:text-slate-100 dark:group-hover:text-[#0F172A] whitespace-nowrap">
                  PIN Code Finder
                </span>
                <span className="block font-mono text-[10px] font-semibold text-[#12805C] dark:text-emerald-400 group-hover:text-[#2F3E4E] dark:group-hover:text-[#0F172A]">
                  India Post Directory · Open
                </span>
              </span>
              <ArrowUpRight
                className="w-4 h-4 text-[#2F3E4E] dark:text-slate-300 dark:group-hover:text-[#0F172A] ml-1 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                aria-hidden="true"
              />
            </button>

            {/* 4. RTO Code Finder (Coming Soon / Under Upgrade) */}
            <button
              type="button"
              aria-expanded={showRtoUpgradeNotice}
              onClick={() => setShowRtoUpgradeNotice((prev) => !prev)}
              className="group inline-flex items-center gap-3 px-4 py-2.5 min-h-[48px] rounded-xl bg-[#FFFDF5]/90 dark:bg-[#131C2E] hover:bg-[#FFFDF5] dark:hover:bg-[#1A253B] border-[1.5px] border-dashed border-[#2F3E4E]/75 dark:border-slate-600 shadow-[0_3px_0_rgba(47,62,78,0.35)] dark:shadow-[0_3px_0_#020617] text-left transition-all duration-150 hover:-translate-y-0.5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F3E4E] dark:focus-visible:ring-[#F9C80E]"
            >
              <span className="w-8 h-8 rounded-lg bg-[#FFE1B3] dark:bg-amber-500/20 border border-[#2F3E4E]/60 dark:border-amber-400/40 text-[#2F3E4E] dark:text-amber-300 flex items-center justify-center shrink-0">
                <Car className="w-4 h-4" aria-hidden="true" />
              </span>
              <span className="leading-tight">
                <span className="flex items-center gap-1.5 font-display font-extrabold text-xs sm:text-sm text-[#2F3E4E] dark:text-slate-100 whitespace-nowrap">
                  <span>RTO Code Finder</span>
                </span>
                <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-[#9E2A2B] dark:text-amber-400">
                  <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />
                  <span>Under Upgrade · Coming Soon</span>
                </span>
              </span>
              <Wrench className="w-4 h-4 text-[#B45309] dark:text-amber-400 ml-1 shrink-0" aria-hidden="true" />
            </button>
          </div>

          {showRtoUpgradeNotice && (
            <div
              role="status"
              className="mt-3.5 max-w-2xl mx-auto bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-600 rounded-xl px-4 py-3.5 shadow-[0_4px_0_#2F3E4E] dark:shadow-[0_4px_0_#020617] flex items-start justify-between gap-3 text-left"
            >
              <div className="flex items-start gap-3">
                <span className="w-9 h-9 rounded-lg bg-[#FFE1B3] dark:bg-amber-500/20 border border-[#2F3E4E] dark:border-amber-400/40 text-[#B45309] dark:text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
                  <Wrench className="w-4 h-4" aria-hidden="true" />
                </span>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display font-extrabold text-xs sm:text-sm text-[#2F3E4E] dark:text-slate-100">
                      India RTO Code Finder — Scheduled Upgrade in Progress
                    </h3>
                    <span className="px-2 py-0.5 rounded bg-[#FFE1B3] dark:bg-amber-500/20 border border-[#B45309]/40 dark:border-amber-400/40 font-mono text-[10px] font-bold text-[#9E2A2B] dark:text-amber-300">
                      COMING SOON
                    </span>
                  </div>
                  <p className="text-xs text-[#475569] dark:text-slate-300 leading-relaxed">
                    We are currently upgrading the India Regional Transport Office (RTO) directory
                    database with enhanced state coverage, verified office addresses, and faster
                    lookup performance. This module will return shortly.
                  </p>
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowRtoUpgradeNotice(false);
                        onQuickLaunchTool('rto-code-finder');
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2F3E4E] dark:bg-[#F9C80E] hover:bg-[#1E293B] dark:hover:bg-[#FDE047] text-[#F9C80E] dark:text-[#0F172A] text-[11px] font-bold cursor-pointer"
                    >
                      <span>Open RTO Registry &amp; Admin Import</span>
                      <ArrowRight className="w-3 h-3" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRtoUpgradeNotice(false)}
                aria-label="Dismiss RTO upgrade notice"
                className="p-1.5 rounded-lg text-[#64748B] dark:text-slate-400 hover:text-[#2F3E4E] dark:hover:text-white hover:bg-[#FEF2C8] dark:hover:bg-slate-800 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
