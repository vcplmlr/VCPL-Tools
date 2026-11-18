import {
  ArrowLeft,
  ArrowRight,
  Calculator,
  Compass,
  FileSpreadsheet,
  FileText,
  Home,
  Landmark,
  LayoutGrid,
  Receipt,
  Search,
} from 'lucide-react';
import { LegalPageSlug } from '../data/legalPagesData';
import { TOOLS_CATALOG } from '../data/toolsCatalog';
import { ToolFilterType } from '../types/tools';
import { AdSlot } from './AdSlot';

interface NotFoundPageProps {
  requestedPath: string;
  onGoHome: () => void;
  onExploreAllTools: (filter?: ToolFilterType) => void;
  onOpenCalculator: () => void;
  onOpenSearch: () => void;
  onOpenLegalPage: (slug: LegalPageSlug) => void;
  onOpenSitemap?: () => void;
}

const POPULAR_SUITES: { label: string; filter: ToolFilterType; Icon: typeof Landmark }[] = [
  { label: 'Banking & Deposit Slips', filter: 'Banking', Icon: Landmark },
  { label: 'Tax & GST Utilities', filter: 'Tax & GST', Icon: Receipt },
  { label: 'GST Utilities & GSTR-1', filter: 'GST Utilities', Icon: FileSpreadsheet },
  { label: 'PDF Suite (33 Tools)', filter: 'PDF Suite', Icon: FileText },
  { label: `All ${TOOLS_CATALOG.length} Tools Directory`, filter: 'All', Icon: LayoutGrid },
];

const REQUIRED_PAGES: { label: string; slug: LegalPageSlug }[] = [
  { label: 'About Us', slug: 'about-us' },
  { label: 'FAQ', slug: 'faq' },
  { label: 'Contact Us', slug: 'contact-us' },
  { label: 'Privacy Policy', slug: 'privacy-policy' },
  { label: 'Terms & Conditions', slug: 'terms-and-conditions' },
  { label: 'Security & Processing', slug: 'security' },
];

export function NotFoundPage({
  requestedPath,
  onGoHome,
  onExploreAllTools,
  onOpenCalculator,
  onOpenSearch,
  onOpenLegalPage,
  onOpenSitemap,
}: NotFoundPageProps) {
  return (
    <section
      aria-labelledby="vcpl-404-title"
      className="w-full bg-[#FEF2C8] dark:bg-[#0B1120] min-h-[calc(100dvh-140px)] py-10 sm:py-16 lg:py-20 transition-colors duration-200"
    >
      <div className="max-w-[1280px] mx-auto px-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6">
        <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-6 sm:p-10 lg:p-12 shadow-[0_6px_0_#2F3E4E] dark:shadow-[0_6px_0_#020617]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            {/* Left Primary Message & Recovery Actions */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] shadow-[0_2px_0_#2F3E4E] font-mono text-xs font-extrabold text-[#2F3E4E] tabular-nums">
                <Compass className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>ERROR 404 · PAGE NOT FOUND</span>
              </div>

              <h1
                id="vcpl-404-title"
                className="font-display font-extrabold tracking-tight text-[#2F3E4E] dark:text-slate-50 leading-[1.08]"
                style={{
                  fontSize: 'clamp(2rem, 4.2vw, 3.35rem)',
                  textWrap: 'balance',
                }}
              >
                We couldn&apos;t find the tool or page you were looking for.
              </h1>

              <p className="text-sm sm:text-base leading-relaxed text-[#475569] dark:text-slate-300 max-w-xl">
                The requested address{' '}
                <code className="font-mono text-xs sm:text-sm font-bold text-[#2F3E4E] dark:text-[#F9C80E] bg-[#FEF2C8] dark:bg-[#0B1120] border border-[#2F3E4E]/30 dark:border-slate-700 px-2 py-0.5 rounded-md break-all">
                  {requestedPath || '/404'}
                </code>{' '}
                does not match an active VCPL utility or information page. Jump back to the main
                workspace or browse our {TOOLS_CATALOG.length} browser-local tools below.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={onGoHome}
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-[#2F3E4E] dark:bg-slate-800 hover:bg-[#1E293B] dark:hover:bg-slate-700 text-[#F9C80E] border-[1.5px] border-[#2F3E4E] dark:border-slate-600 shadow-[0_3px_0_#1A242F] dark:shadow-[0_3px_0_#020617] text-sm font-display font-extrabold transition-all hover:-translate-y-0.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Back to Home</span>
                </button>

                <button
                  type="button"
                  onClick={() => onExploreAllTools('All')}
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-[#F9C80E] hover:bg-[#FFE1B3] text-[#2F3E4E] border-[1.5px] border-[#2F3E4E] shadow-[0_3px_0_#2F3E4E] dark:shadow-[0_3px_0_#020617] text-sm font-display font-extrabold transition-all hover:-translate-y-0.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Home className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Browse All {TOOLS_CATALOG.length} Tools</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenCalculator}
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl bg-[#CEE5DC] dark:bg-emerald-950/70 hover:bg-[#FEF2C8] dark:hover:bg-emerald-900/70 text-[#2F3E4E] dark:text-emerald-200 border-[1.5px] border-[#2F3E4E] dark:border-emerald-700 text-sm font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Calculator className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Calculator Hub</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenSearch}
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl bg-white dark:bg-[#0B1120] hover:bg-[#FEF2C8] dark:hover:bg-slate-800 text-[#2F3E4E] dark:text-slate-100 border-[1.5px] border-[#2F3E4E] dark:border-slate-600 text-sm font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Search className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Search Tools</span>
                </button>
              </div>
            </div>

            {/* Right Theme-Colored Directory & Required Pages Card */}
            <div className="lg:col-span-5 space-y-5">
              <div className="rounded-2xl bg-[#CEE5DC]/65 dark:bg-[#0F172A] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between gap-3 border-b border-[#2F3E4E]/15 dark:border-slate-800 pb-3">
                  <span className="font-mono text-4xl sm:text-5xl font-extrabold text-[#2F3E4E] dark:text-slate-100 tabular-nums leading-none">
                    404
                  </span>
                  <span className="text-xs font-display font-extrabold uppercase tracking-wider text-[#2F3E4E] bg-[#F9C80E] border border-[#2F3E4E] px-2.5 py-1 rounded-md">
                    VCPL Directory
                  </span>
                </div>

                <div className="space-y-2">
                  <h2 className="font-display font-extrabold text-sm text-[#2F3E4E] dark:text-slate-100">
                    Popular Tool Suites
                  </h2>
                  <div className="grid grid-cols-1 gap-2">
                    {POPULAR_SUITES.map(({ label, filter, Icon }) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => onExploreAllTools(filter)}
                        className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#FFFDF5] dark:bg-[#131C2E] hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 flex items-center justify-between gap-2 text-xs font-bold text-[#2F3E4E] dark:text-slate-100 dark:hover:text-[#0F172A] transition-colors cursor-pointer text-left"
                      >
                        <span className="inline-flex items-center gap-2 min-w-0">
                          <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                          <span className="truncate">{label}</span>
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-[#2F3E4E]/15 dark:border-slate-800 space-y-2">
                  <h2 className="font-display font-extrabold text-xs uppercase tracking-wider text-[#334155] dark:text-slate-400">
                    Information &amp; Policy Pages
                  </h2>
                  <div className="flex flex-wrap gap-1.5">
                    {REQUIRED_PAGES.map((page) => (
                      <button
                        key={page.slug}
                        type="button"
                        onClick={() => onOpenLegalPage(page.slug)}
                        className="px-3 py-1.5 min-h-[36px] rounded-lg bg-[#FFFDF5] dark:bg-[#131C2E] hover:bg-[#2F3E4E] dark:hover:bg-[#F9C80E] hover:text-[#F9C80E] dark:hover:text-[#0F172A] border border-[#2F3E4E]/40 dark:border-slate-700 text-xs font-semibold text-[#2F3E4E] dark:text-slate-200 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        {page.label}
                      </button>
                    ))}
                    {onOpenSitemap && (
                      <button
                        type="button"
                        onClick={onOpenSitemap}
                        className="px-3 py-1.5 min-h-[36px] rounded-lg bg-[#F9C80E] hover:bg-[#2F3E4E] dark:hover:bg-[#FDE047] hover:text-[#F9C80E] dark:hover:text-[#0F172A] border border-[#2F3E4E] text-xs font-bold text-[#2F3E4E] transition-colors cursor-pointer whitespace-nowrap"
                      >
                        HTML Sitemap
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <AdSlot
            slotId="vcpl-404-recovery-strip"
            variant="compact-strip"
            label="Recovery Directory Banner · 728 × 90"
            contentContext="Banking, GST Tax Audit, PDF & Calculation Utilities"
          />
        </div>
      </div>
    </section>
  );
}
