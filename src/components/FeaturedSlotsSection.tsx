import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Building2,
  Calculator,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Keyboard,
  Landmark,
  Receipt,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import {
  TOOL_SECTION_HEADS,
  TOOLS_CATALOG,
  getToolsForCategory,
  sortToolsForSuite,
  toolMatchesCategory,
} from '../data/toolsCatalog';
import { ToolCatalogItem, ToolFilterType } from '../types/tools';
import { AdSlot } from './AdSlot';
import { ToolCard } from './ToolCard';

interface FeaturedSlotsSectionProps {
  activeFilter: ToolFilterType;
  onFilterChange: (filter: ToolFilterType) => void;
  onOpenTool: (tool: ToolCatalogItem) => void;
  onOpenAllTools: (filter?: ToolFilterType) => void;
}

const HOMEPAGE_MAX_PER_SECTION = 5;
const HOMEPAGE_VCPL_MAX = 10;

const SUITE_KEYS: { key: Exclude<ToolFilterType, 'All'>; label: string }[] = [
  { key: 'Banking', label: 'Banking' },
  { key: 'Tax & GST', label: 'Tax & GST' },
  { key: 'GST Utilities', label: 'GST Utilities' },
  { key: 'Calculator', label: 'Calculator' },
  { key: 'PDF Suite', label: 'PDF Suite' },
  { key: 'Image Studio', label: 'Image Studio' },
  { key: 'Typing & Text', label: 'Typing & Text' },
  { key: 'Utilities', label: 'Utilities' },
  { key: 'VCPL', label: 'VCPL Tools' },
];

const FILTER_TABS: { key: ToolFilterType; label: string; count: number }[] = [
  { key: 'All', label: 'All Suites', count: TOOLS_CATALOG.filter((t) => t.id !== 'gstr1-return-prep').length },
  ...SUITE_KEYS.map(({ key, label }) => ({
    key,
    label,
    count: getToolsForCategory(key).filter((t) => t.id !== 'gstr1-return-prep').length,
  })),
];

const CALCULATOR_CAPABILITIES = [
  { label: 'Standard Math', detail: 'Scientific & history tape' },
  { label: 'Loan & Home EMI', detail: 'Amortization & prepayment' },
  { label: 'SIP & Wealth', detail: 'Step-up & Lumpsum CAGR' },
  { label: 'Income Tax FY 25-26', detail: 'New vs Old regime compare' },
  { label: 'Exam & CGPA', detail: 'Marks, rank & cutoff calc' },
  { label: 'Dates & Age', detail: 'Working days & tenure' },
];

function getSuiteIcon(key: Exclude<ToolFilterType, 'All'>) {
  switch (key) {
    case 'Banking':
      return Landmark;
    case 'Tax & GST':
      return Receipt;
    case 'GST Utilities':
      return FileSpreadsheet;
    case 'Calculator':
      return Calculator;
    case 'PDF Suite':
      return FileText;
    case 'Image Studio':
      return ImageIcon;
    case 'Typing & Text':
      return Keyboard;
    case 'Utilities':
      return SlidersHorizontal;
    case 'VCPL':
      return Building2;
  }
}

export function FeaturedSlotsSection({
  activeFilter,
  onFilterChange,
  onOpenTool,
  onOpenAllTools,
}: FeaturedSlotsSectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const trimmedQuery = searchQuery.trim();

  const sectionsToRender = useMemo(() => {
    const q = trimmedQuery.toLowerCase();
    const isSingleSuiteView = activeFilter !== 'All';

    return TOOL_SECTION_HEADS.filter(
      (head) => activeFilter === 'All' || head.key === activeFilter
    )
      .map((head) => {
        const filteredSectionTools = TOOLS_CATALOG.filter((tool) => {
          if (tool.id === 'gstr1-return-prep') return false;
          const matchesSuite =
            activeFilter === 'All' && q
              ? tool.category === head.key
              : toolMatchesCategory(tool, head.key);
          if (!matchesSuite) return false;
          if (!q) return true;
          return (
            tool.title.toLowerCase().includes(q) ||
            tool.description.toLowerCase().includes(q) ||
            tool.suite.toLowerCase().includes(q) ||
            tool.code.toLowerCase().includes(q) ||
            tool.categoryName.toLowerCase().includes(q) ||
            (tool.keywords?.some((k) => k.toLowerCase().includes(q)) ?? false)
          );
        });

        const allSectionTools = sortToolsForSuite(filteredSectionTools, head.key);
        const sectionMax = head.key === 'VCPL' ? HOMEPAGE_VCPL_MAX : HOMEPAGE_MAX_PER_SECTION;
        const showAll = Boolean(q) || isSingleSuiteView;
        const visibleTools = showAll
          ? allSectionTools
          : allSectionTools.slice(0, sectionMax);

        return {
          head,
          visibleTools,
          totalCount: allSectionTools.length,
          hasMore: !showAll && allSectionTools.length > sectionMax,
        };
      })
      .filter((section) => section.visibleTools.length > 0);
  }, [activeFilter, trimmedQuery]);

  const totalMatches = useMemo(
    () => sectionsToRender.reduce((sum, sec) => sum + sec.visibleTools.length, 0),
    [sectionsToRender]
  );

  const activeFilterTotalCount = useMemo(
    () => getToolsForCategory(activeFilter).filter((t) => t.id !== 'gstr1-return-prep').length,
    [activeFilter]
  );

  return (
    <section id="featured-slots" className="w-full bg-[#CEE5DC] dark:bg-[#0D1526] py-14 sm:py-16 md:py-20 transition-colors duration-200">
      <div className="max-w-[1400px] mx-auto pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6">
        {/* Modern Editorial Header + Search & Directory CTA */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-8 border-b border-[#2F3E4E]/15 dark:border-slate-800">
          <div className="space-y-2 max-w-2xl">
            <p className="text-xs font-semibold text-[#334155] dark:text-slate-400">
              Browser Workspace Directory · {TOOLS_CATALOG.length} Live Modules
            </p>
            <h2 className="font-display font-extrabold text-[clamp(1.85rem,3.4vw,2.6rem)] leading-[1.1] text-[#2F3E4E] dark:text-slate-50 tracking-tight [text-wrap:balance]">
              Tools &amp; Workspaces by Suite
            </h2>
            <p className="text-sm sm:text-[15px] leading-relaxed text-[#334155] dark:text-slate-300">
              Launch any banking slip, GST audit converter, PDF utility, or financial calculator
              directly in your browser with zero file uploads.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <div className="relative w-full sm:w-72">
              <Search
                className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#475569] dark:text-slate-400 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by tool, GST, IFSC, PDF..."
                aria-label="Filter VCPL tools"
                className="w-full pl-10 pr-9 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-[#FFFDF5] dark:bg-[#131C2E] text-sm text-[#2F3E4E] dark:text-slate-100 placeholder:text-[#64748B] dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2F3E4E] dark:focus:ring-[#F9C80E]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear tool filter"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-[#64748B] dark:text-slate-400 hover:text-[#2F3E4E] dark:hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => onOpenAllTools(activeFilter)}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-[#2F3E4E] dark:bg-[#F9C80E] hover:bg-[#1E293B] dark:hover:bg-[#FDE047] text-[#FFFDF5] dark:text-[#0F172A] border-[1.5px] border-[#2F3E4E] dark:border-[#F9C80E] shadow-[0_3px_0_#1E293B] dark:shadow-[0_3px_0_#020617] text-sm font-semibold transition-all duration-150 hover:-translate-y-0.5 whitespace-nowrap shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#2F3E4E] dark:focus-visible:ring-[#F9C80E]"
            >
              <span>
                {activeFilter === 'All'
                  ? `All Tools (${TOOLS_CATALOG.length})`
                  : `Open ${activeFilter} Page (${activeFilterTotalCount})`}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Segmented Suite Filter Bar */}
        <div className="mt-6 mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Filter tools by suite"
            className="inline-flex flex-wrap items-center gap-1.5 p-1.5 rounded-xl bg-[#FFFDF5]/75 dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700"
          >
            {FILTER_TABS.map((tab) => {
              const isActive = activeFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => onFilterChange(tab.key)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-lg text-xs font-semibold transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F3E4E] dark:focus-visible:ring-[#F9C80E] ${
                    isActive
                      ? 'bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#FFFDF5] dark:text-[#0F172A]'
                      : 'text-[#2F3E4E] dark:text-slate-200 hover:bg-[#FEF2C8] dark:hover:bg-slate-800'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`font-mono text-[11px] tabular-nums ${
                      isActive ? 'text-[#F9C80E] dark:text-[#0F172A]/80' : 'text-[#64748B] dark:text-slate-400'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {trimmedQuery && (
            <p className="text-xs font-medium text-[#2F3E4E] dark:text-slate-200 tabular-nums">
              Showing {totalMatches} matching {totalMatches === 1 ? 'tool' : 'tools'}
            </p>
          )}
        </div>

        {/* Empty Search State */}
        {sectionsToRender.length === 0 ? (
          <div className="max-w-lg mx-auto text-center bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-10 shadow-[0_4px_0_#2F3E4E] dark:shadow-[0_4px_0_#020617]">
            <p className="font-display font-bold text-lg text-[#2F3E4E] dark:text-slate-100">
              No matching tools found
            </p>
            <p className="mt-2 text-sm text-[#475569] dark:text-slate-300">
              No tools matched &ldquo;{trimmedQuery}&rdquo;. Try clearing your filter or switching
              back to All Suites.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                onFilterChange('All');
              }}
              className="mt-6 px-5 py-2.5 rounded-xl bg-[#2F3E4E] dark:bg-[#F9C80E] hover:bg-[#1E293B] dark:hover:bg-[#FDE047] text-[#FFFDF5] dark:text-[#0F172A] text-sm font-semibold cursor-pointer"
            >
              Show All Suites
            </button>
          </div>
        ) : (
          <div className="space-y-12">
            {sectionsToRender.map(({ head, visibleTools, totalCount, hasMore }, sectionIdx) => {
              const SuiteIcon = getSuiteIcon(head.key);
              const isSingleCalculatorSpotlight =
                head.key === 'Calculator' &&
                visibleTools.length === 1 &&
                visibleTools[0].kind === 'unified-calculator';

              return (
                <div key={head.key} className="space-y-12">
                  <div className="space-y-5">
                  {/* Suite Header */}
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-3 border-b border-[#2F3E4E]/15 dark:border-slate-800">
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-600 text-[#2F3E4E] dark:text-[#F9C80E] flex items-center justify-center shrink-0 mt-0.5">
                        <SuiteIcon className="w-5 h-5" aria-hidden="true" />
                      </div>
                      <div>
                        <h3 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] dark:text-slate-50 tracking-tight">
                          <span className="font-mono text-sm font-bold text-[#475569] dark:text-slate-400 mr-2 tabular-nums">
                            {head.index}.
                          </span>
                          {head.title}
                        </h3>
                        <p className="text-xs sm:text-sm text-[#334155] dark:text-slate-300 mt-0.5">
                          {head.subtitle}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-start sm:self-end">
                      <span className="text-xs font-mono font-semibold text-[#475569] dark:text-slate-400 tabular-nums">
                        {hasMore
                          ? `${visibleTools.length} of ${totalCount} shown`
                          : `${totalCount} ${totalCount === 1 ? 'Module' : 'Modules'}`}
                      </span>

                      {(hasMore || activeFilter !== 'All') && (
                        <button
                          type="button"
                          onClick={() => onOpenAllTools(head.key)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-[#FFFDF5] dark:bg-[#131C2E] hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] text-xs font-semibold text-[#2F3E4E] dark:text-slate-100 dark:hover:text-[#0F172A] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <span>{hasMore ? `View all ${totalCount}` : `Open Full Page`}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Suite Cards — Adaptive Balanced Grid Layout */}
                  {isSingleCalculatorSpotlight ? (
                    <div className="bg-[#FEF2C8] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-6 sm:p-8 shadow-[0_4px_0_#2F3E4E] dark:shadow-[0_4px_0_#020617] grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                      <div className="lg:col-span-5 space-y-4">
                        <div className="flex items-center gap-2 text-xs text-[#475569] dark:text-slate-400">
                          <span className="font-display font-bold text-[#1D4ED8] dark:text-sky-400">
                            {visibleTools[0].suite}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono font-semibold tabular-nums">
                            {visibleTools[0].code}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>6 Modes in One Workspace</span>
                        </div>
                        <h4 className="font-display font-extrabold text-2xl text-[#2F3E4E] dark:text-slate-50 tracking-tight">
                          {visibleTools[0].title}
                        </h4>
                        <p className="text-sm leading-relaxed text-[#475569] dark:text-slate-300">
                          {visibleTools[0].description}
                        </p>
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => onOpenTool(visibleTools[0])}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-[#2F3E4E] dark:bg-[#F9C80E] hover:bg-[#1E293B] dark:hover:bg-[#FDE047] text-[#FFFDF5] dark:text-[#0F172A] border-[1.5px] border-[#2F3E4E] dark:border-[#F9C80E] text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <span>Launch All-in-One Calculator</span>
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {CALCULATOR_CAPABILITIES.map((cap) => (
                          <button
                            key={cap.label}
                            type="button"
                            onClick={() => onOpenTool(visibleTools[0])}
                            className="text-left bg-[#FFFDF5] dark:bg-[#0F172A] hover:bg-white dark:hover:bg-slate-800 border-[1.5px] border-[#2F3E4E] dark:border-slate-700 dark:hover:border-[#F9C80E]/60 rounded-xl p-3.5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_3px_0_#2F3E4E] dark:hover:shadow-[0_3px_0_#020617] cursor-pointer"
                          >
                            <div className="font-display font-bold text-xs text-[#2F3E4E] dark:text-slate-100">
                              {cap.label}
                            </div>
                            <div className="mt-1 text-[11px] text-[#475569] dark:text-slate-400">
                              {cap.detail}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : !trimmedQuery && visibleTools.length === 5 ? (
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-5">
                      {visibleTools.map((tool, idx) => (
                        <div
                          key={tool.id}
                          className={
                            idx < 2
                              ? 'md:col-span-3 flex *:w-full'
                              : 'md:col-span-2 flex *:w-full'
                          }
                        >
                          <ToolCard
                            tool={tool}
                            onOpenTool={onOpenTool}
                            variant={idx < 2 ? 'wide' : 'default'}
                          />
                        </div>
                      ))}
                    </div>
                  ) : !trimmedQuery && visibleTools.length === 4 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                      {visibleTools.map((tool) => (
                        <ToolCard key={tool.id} tool={tool} onOpenTool={onOpenTool} />
                      ))}
                    </div>
                  ) : (
                    <div
                      className={
                        visibleTools.length >= 8
                          ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5'
                          : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5'
                      }
                    >
                      {visibleTools.map((tool) => (
                        <ToolCard key={tool.id} tool={tool} onOpenTool={onOpenTool} />
                      ))}
                    </div>
                  )}
                  </div>

                  {sectionIdx === 1 && (
                    <AdSlot
                      slotId="vcpl-suites-infeed-01"
                      variant="inline"
                      label="In-Feed Contextual Unit · Responsive 970 × 90"
                      contentContext="Indian Banking, GST Compliance & Tax Automation"
                    />
                  )}
                  {sectionIdx === 3 && (
                    <AdSlot
                      slotId="vcpl-suites-infeed-dual"
                      variant="dual"
                      contentContext="PDF Conversion, Document Signing & Office Suites"
                    />
                  )}
                  {sectionIdx === 5 && (
                    <AdSlot
                      slotId="vcpl-suites-infeed-strip"
                      variant="compact-strip"
                      label="In-Feed Compact Partner Strip · 728 × 90"
                      contentContext="Image Studio, QR Utilities & Daily Productivity"
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
