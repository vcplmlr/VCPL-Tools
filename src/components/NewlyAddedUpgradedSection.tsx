import { useMemo, useState } from 'react';
import {
  ArrowRight,
  ArrowUpCircle,
  ArrowUpRight,
  Calculator,
  CarFront,
  ChevronLeft,
  ChevronRight,
  Database,
  Eraser,
  FileCheck2,
  FileEdit,
  FileSpreadsheet,
  FileText,
  Landmark,
  Languages,
  MapPin,
  Receipt,
  ScanText,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { PUBLIC_TOOLS_CATALOG, getToolById } from '../data/toolsCatalog';

interface NewlyAddedUpgradedSectionProps {
  onOpenTool: (toolId: string) => void;
  onOpenAllTools: () => void;
}

type ReleaseFilter = 'all' | 'new' | 'upgraded';
type ReleaseKind = 'new' | 'upgraded' | 'upgrading';

interface ReleaseEntry {
  toolId: string;
  titleOverride?: string;
  kind: ReleaseKind;
  tag: string;
  iconKey:
    | 'eraser'
    | 'scan'
    | 'database'
    | 'receipt'
    | 'file-text'
    | 'calculator'
    | 'sparkles'
    | 'landmark'
    | 'map-pin'
    | 'file-edit'
    | 'file-check'
    | 'languages'
    | 'car'
    | 'sheet';
}

const RELEASE_ENTRIES: ReleaseEntry[] = [
  // New (9)
  {
    toolId: 'ai-text-cleaner',
    titleOverride: 'VCPL AI Text Cleaner',
    kind: 'new',
    tag: 'Just Added',
    iconKey: 'eraser',
  },
  {
    toolId: 'textlift-ocr-pro',
    kind: 'new',
    tag: 'Open Access OCR',
    iconKey: 'scan',
  },
  {
    toolId: 'database-file-compressor',
    titleOverride: 'Database & Large-File Ultra Compressor',
    kind: 'new',
    tag: '500MB+ Stream',
    iconKey: 'database',
  },
  {
    toolId: 'invoice-quotation-maker',
    kind: 'new',
    tag: 'UPI QR & Quote PDF',
    iconKey: 'receipt',
  },
  {
    toolId: 'letterhead-invoice-maker',
    kind: 'new',
    tag: 'Letterhead Overlay',
    iconKey: 'file-text',
  },
  {
    toolId: 'tcs-tax-calculator',
    kind: 'new',
    tag: 'Reverse TCS & GST',
    iconKey: 'calculator',
  },
  {
    toolId: 'rent-payment-letter-maker',
    titleOverride: 'Rent Payment Letter Maker – Advanced',
    kind: 'new',
    tag: 'Reverse TDS Check',
    iconKey: 'file-text',
  },
  {
    toolId: 'tds-26as-tally-reco',
    kind: 'new',
    tag: '18-Period Audit',
    iconKey: 'sparkles',
  },
  {
    toolId: 'bajaj-reconciliation-desk',
    kind: 'new',
    tag: '27 Audit Checks',
    iconKey: 'sparkles',
  },

  // Upgraded (9)
  {
    toolId: 'bank-ifsc-finder',
    kind: 'upgraded',
    tag: '182k+ RBI Branches',
    iconKey: 'landmark',
  },
  {
    toolId: 'pin-code-finder',
    kind: 'upgraded',
    tag: '157k+ Post Offices',
    iconKey: 'map-pin',
  },
  {
    toolId: 'income-tax-fy-2026-27',
    kind: 'upgraded',
    tag: 'Upgraded v2.0.8',
    iconKey: 'receipt',
  },
  {
    toolId: 'pdf-editor-advanced',
    kind: 'upgraded',
    tag: 'Upgraded v3.0',
    iconKey: 'file-edit',
  },
  {
    toolId: 'gstr1-return-prep',
    kind: 'upgraded',
    tag: 'V2.2 JSON Export',
    iconKey: 'file-check',
  },
  {
    toolId: 'unified-calculator',
    kind: 'upgraded',
    tag: '6 Modes + Amortization',
    iconKey: 'calculator',
  },
  {
    toolId: 'tulusiri-pro',
    kind: 'upgraded',
    tag: 'Tulu Lipi Studio',
    iconKey: 'languages',
  },
  {
    toolId: 'rto-code-finder',
    kind: 'upgrading',
    tag: 'Directory Upgrade',
    iconKey: 'car',
  },
  {
    toolId: 'vcpl-rtgs-neft-form',
    kind: 'upgraded',
    tag: 'Same Bank SBI Mode',
    iconKey: 'sheet',
  },
];

const PAGE_SIZE = 6;

function renderEntryIcon(iconKey: ReleaseEntry['iconKey']) {
  switch (iconKey) {
    case 'eraser':
      return <Eraser className="w-4 h-4" aria-hidden="true" />;
    case 'scan':
      return <ScanText className="w-4 h-4" aria-hidden="true" />;
    case 'database':
      return <Database className="w-4 h-4" aria-hidden="true" />;
    case 'receipt':
      return <Receipt className="w-4 h-4" aria-hidden="true" />;
    case 'file-text':
      return <FileText className="w-4 h-4" aria-hidden="true" />;
    case 'calculator':
      return <Calculator className="w-4 h-4" aria-hidden="true" />;
    case 'sparkles':
      return <Sparkles className="w-4 h-4" aria-hidden="true" />;
    case 'landmark':
      return <Landmark className="w-4 h-4" aria-hidden="true" />;
    case 'map-pin':
      return <MapPin className="w-4 h-4" aria-hidden="true" />;
    case 'file-edit':
      return <FileEdit className="w-4 h-4" aria-hidden="true" />;
    case 'file-check':
      return <FileCheck2 className="w-4 h-4" aria-hidden="true" />;
    case 'languages':
      return <Languages className="w-4 h-4" aria-hidden="true" />;
    case 'car':
      return <CarFront className="w-4 h-4" aria-hidden="true" />;
    case 'sheet':
      return <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />;
  }
}

export function NewlyAddedUpgradedSection({
  onOpenTool,
  onOpenAllTools,
}: NewlyAddedUpgradedSectionProps) {
  const [filter, setFilter] = useState<ReleaseFilter>('all');
  const [page, setPage] = useState(1);

  const counts = useMemo(() => {
    const newCount = RELEASE_ENTRIES.filter((item) => item.kind === 'new').length;
    const upgradedCount = RELEASE_ENTRIES.filter((item) => item.kind !== 'new').length;
    return {
      all: RELEASE_ENTRIES.length,
      newCount,
      upgradedCount,
    };
  }, []);

  const filteredEntries = useMemo(() => {
    if (filter === 'new') {
      return RELEASE_ENTRIES.filter((item) => item.kind === 'new');
    }
    if (filter === 'upgraded') {
      return RELEASE_ENTRIES.filter((item) => item.kind !== 'new');
    }
    return RELEASE_ENTRIES;
  }, [filter]);

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const visibleEntries = filteredEntries.slice(startIdx, startIdx + PAGE_SIZE);

  const handleChangeFilter = (nextFilter: ReleaseFilter) => {
    setFilter(nextFilter);
    setPage(1);
  };

  return (
    <section
      id="newly-added-upgraded"
      aria-labelledby="newly-added-heading"
      className="w-full bg-[#FFFDF5] dark:bg-[#0B1120] border-b border-[#2F3E4E]/15 dark:border-slate-800 py-10 sm:py-12 transition-colors duration-200"
    >
      <div className="max-w-[1400px] mx-auto pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6 space-y-6">
        {/* Section Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="space-y-1.5">
            <p className="text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-[#12805C] dark:text-emerald-400">
              LATEST RELEASES &amp; ENGINE UPGRADES
            </p>
            <h2
              id="newly-added-heading"
              className="font-display font-extrabold text-[clamp(1.55rem,2.9vw,2.15rem)] leading-tight text-[#2F3E4E] dark:text-slate-50 tracking-tight"
            >
              Newly Added &amp; Upgraded Tools
            </h2>
            <p className="text-xs sm:text-sm text-[#475569] dark:text-slate-300 max-w-2xl">
              Quick-launch our newest browser tools (including VCPL AI Text Cleaner) and recently
              upgraded directories &amp; engines directly in one click.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <div
              role="tablist"
              aria-label="Filter newly added and upgraded tools"
              className="inline-flex items-center p-1 rounded-xl bg-[#FEF2C8] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700"
            >
              <button
                type="button"
                role="tab"
                aria-selected={filter === 'all'}
                onClick={() => handleChangeFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-display font-bold transition cursor-pointer whitespace-nowrap tabular-nums ${
                  filter === 'all'
                    ? 'bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#FFFDF5] dark:text-[#0F172A]'
                    : 'text-[#2F3E4E] dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-800'
                }`}
              >
                All ({counts.all})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={filter === 'new'}
                onClick={() => handleChangeFilter('new')}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-display font-bold transition cursor-pointer whitespace-nowrap tabular-nums ${
                  filter === 'new'
                    ? 'bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#FFFDF5] dark:text-[#0F172A]'
                    : 'text-[#2F3E4E] dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-800'
                }`}
              >
                <Sparkles className="w-3 h-3" aria-hidden="true" />
                <span>New ({counts.newCount})</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={filter === 'upgraded'}
                onClick={() => handleChangeFilter('upgraded')}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-display font-bold transition cursor-pointer whitespace-nowrap tabular-nums ${
                  filter === 'upgraded'
                    ? 'bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#FFFDF5] dark:text-[#0F172A]'
                    : 'text-[#2F3E4E] dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-800'
                }`}
              >
                <ArrowUpCircle className="w-3 h-3" aria-hidden="true" />
                <span>Upgraded ({counts.upgradedCount})</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onOpenAllTools}
              className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[38px] rounded-xl bg-white dark:bg-[#131C2E] hover:bg-[#FEF2C8] dark:hover:bg-slate-800 border-[1.5px] border-[#2F3E4E] dark:border-slate-700 text-xs font-display font-extrabold text-[#2F3E4E] dark:text-slate-100 transition cursor-pointer whitespace-nowrap"
            >
              <span>All {PUBLIC_TOOLS_CATALOG.length} Tools</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* 3x2 Boxes Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {visibleEntries.map((entry) => {
            const catalogItem = getToolById(entry.toolId);
            const displayTitle = entry.titleOverride || catalogItem?.title || entry.toolId;
            const isUpgrading = entry.kind === 'upgrading';
            const isNew = entry.kind === 'new';

            return (
              <button
                key={entry.toolId}
                type="button"
                onClick={() => onOpenTool(entry.toolId)}
                className={`group text-left rounded-2xl px-4 py-3.5 flex items-center justify-between gap-3 transition-all duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F3E4E] dark:focus-visible:outline-[#F9C80E] ${
                  isUpgrading
                    ? 'bg-white/85 dark:bg-[#131C2E]/90 border-[1.5px] border-dashed border-[#64748B] dark:border-slate-600 hover:bg-[#FEF2C8]/50 dark:hover:bg-slate-800/80 hover:-translate-y-0.5'
                    : 'bg-white dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 shadow-[0_2px_0_#2F3E4E] dark:shadow-[0_2px_0_#020617] hover:bg-[#FEF2C8]/50 dark:hover:bg-slate-800/80 hover:-translate-y-0.5'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`w-10 h-10 rounded-xl border-[1.5px] flex items-center justify-center shrink-0 ${
                      isNew
                        ? 'bg-[#F9C80E] border-[#2F3E4E] text-[#2F3E4E]'
                        : isUpgrading
                        ? 'bg-[#FEF3C7] dark:bg-amber-950/60 border-[#D97706]/50 text-[#92400E] dark:text-amber-300'
                        : 'bg-[#CEE5DC] dark:bg-emerald-950/70 border-[#2F3E4E] dark:border-emerald-700 text-[#2F3E4E] dark:text-emerald-200'
                    }`}
                  >
                    {renderEntryIcon(entry.iconKey)}
                  </span>

                  <div className="min-w-0 space-y-1">
                    <h3 className="font-display font-extrabold text-[13px] sm:text-sm text-[#2F3E4E] dark:text-slate-100 truncate">
                      {displayTitle}
                    </h3>
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-display font-extrabold uppercase tracking-wider shrink-0 ${
                          isNew
                            ? 'bg-[#2F3E4E] text-[#F9C80E] dark:bg-emerald-500 dark:text-[#0F172A]'
                            : isUpgrading
                            ? 'bg-[#FEF3C7] dark:bg-amber-950/60 border border-[#D97706]/45 text-[#92400E] dark:text-amber-300'
                            : 'bg-[#12805C] text-white dark:bg-emerald-700 dark:text-emerald-50'
                        }`}
                      >
                        {isNew ? (
                          <Sparkles className="w-2.5 h-2.5" aria-hidden="true" />
                        ) : isUpgrading ? (
                          <Wrench className="w-2.5 h-2.5" aria-hidden="true" />
                        ) : (
                          <ArrowUpCircle className="w-2.5 h-2.5" aria-hidden="true" />
                        )}
                        <span>
                          {isNew ? 'NEW' : isUpgrading ? 'UPGRADING' : 'UPGRADED'}
                        </span>
                      </span>
                      <span className="text-[11px] font-mono text-[#475569] dark:text-slate-400 truncate">
                        {entry.tag}
                      </span>
                    </div>
                  </div>
                </div>

                {isUpgrading ? (
                  <Wrench
                    className="w-4 h-4 text-[#B45309] dark:text-amber-400 shrink-0 transition-transform group-hover:rotate-12"
                    aria-hidden="true"
                  />
                ) : (
                  <ArrowUpRight
                    className="w-4 h-4 text-[#475569] dark:text-slate-400 group-hover:text-[#2F3E4E] dark:group-hover:text-[#F9C80E] shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* 3x2 Page Controls */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <p className="text-xs font-mono text-[#475569] dark:text-slate-400 tabular-nums">
              Showing {startIdx + 1}–{Math.min(startIdx + PAGE_SIZE, filteredEntries.length)} of{' '}
              {filteredEntries.length} tools · Page {currentPage} of {totalPages}
            </p>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page of newly added tools"
                className="inline-flex items-center gap-1 px-2.5 h-8 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-700 bg-white dark:bg-[#131C2E] hover:bg-[#FEF2C8] dark:hover:bg-slate-800 disabled:opacity-40 text-xs font-bold text-[#2F3E4E] dark:text-slate-200 cursor-pointer disabled:cursor-default transition"
              >
                <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Prev</span>
              </button>

              {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pageNum) => {
                const isActive = pageNum === currentPage;
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setPage(pageNum)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`w-8 h-8 rounded-lg border-[1.5px] text-xs font-mono font-bold tabular-nums cursor-pointer transition ${
                      isActive
                        ? 'bg-[#2F3E4E] dark:bg-[#F9C80E] border-[#2F3E4E] dark:border-[#F9C80E] text-[#F9C80E] dark:text-[#0F172A]'
                        : 'bg-white dark:bg-[#131C2E] border-[#2F3E4E]/30 dark:border-slate-700 text-[#2F3E4E] dark:text-slate-300 hover:bg-[#FEF2C8] dark:hover:bg-slate-800'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Next page of newly added tools"
                className="inline-flex items-center gap-1 px-2.5 h-8 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-700 bg-white dark:bg-[#131C2E] hover:bg-[#FEF2C8] dark:hover:bg-slate-800 disabled:opacity-40 text-xs font-bold text-[#2F3E4E] dark:text-slate-200 cursor-pointer disabled:cursor-default transition"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
