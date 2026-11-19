import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Layers, Search, ShieldCheck, X } from 'lucide-react';
import {
  TOOL_SECTION_HEADS,
  TOOLS_CATALOG,
  getToolsForCategory,
  sortToolsForSuite,
  toolMatchesCategory,
} from '../data/toolsCatalog';
import { ToolCatalogItem, ToolFilterType } from '../types/tools';
import { AdSlot } from './AdSlot';
import { FaqSection } from './FaqSection';
import { ReleaseStatusTicker } from './ReleaseStatusTicker';
import { ToolCard } from './ToolCard';

interface AllToolsPageProps {
  activeFilter: ToolFilterType;
  initialSearchQuery?: string;
  onFilterChange: (filter: ToolFilterType) => void;
  onBackHome: () => void;
  onOpenTool: (tool: ToolCatalogItem) => void;
}

interface SubGroupDefinition {
  id: string;
  label: string;
  description: string;
  toolIds: string[];
}

const PDF_SUBGROUPS: SubGroupDefinition[] = [
  {
    id: 'pdf-office-web',
    label: 'Office, PPT & Web Converters',
    description: 'Convert PDFs to and from Word, Excel, PowerPoint, HTML, CSV, Text & RTF.',
    toolIds: [
      'pdf-to-word',
      'word-to-pdf',
      'pdf-to-excel',
      'excel-to-pdf',
      'pdf-to-ppt',
      'ppt-to-pdf',
      'create-presentation',
      'images-to-ppt',
      'pdf-to-text',
      'pdf-to-html',
      'html-to-pdf',
      'pdf-to-csv',
      'pdf-to-rtf',
    ],
  },
  {
    id: 'pdf-images',
    label: 'Images, Scans ↔ PDF',
    description: 'Convert JPG, PNG, WEBP & camera scans into PDFs or extract high-DPI PNG images.',
    toolIds: [
      'image-to-pdf',
      'jpg-to-pdf',
      'png-to-pdf',
      'webp-to-pdf',
      'scan-to-pdf',
      'pdf-to-jpg',
      'pdf-to-png',
      'pdf-to-webp',
      'pdf-extract-images',
    ],
  },
  {
    id: 'pdf-organize-forms',
    label: 'Organize, Merge, Split, Impose & Forms',
    description: 'Visual organizer, merge, split by size/bookmarks/keyword, N-up, booklet, crop, rotate & AcroForms.',
    toolIds: [
      'pdf-editor-advanced',
      'pdf-organize',
      'pdf-merger',
      'pdf-splitter',
      'pdf-extract-pages',
      'pdf-reverse-pages',
      'pdf-alternate-mix',
      'pdf-split-half',
      'pdf-split-size',
      'pdf-split-bookmarks',
      'pdf-split-text',
      'pdf-nup',
      'pdf-booklet',
      'pdf-flip-mirror',
      'pdf-insert-blank',
      'pdf-form-filler',
      'pdf-fillable-builder',
      'pdf-page-rotator',
      'pdf-page-deleter',
      'pdf-page-reorder',
      'pdf-page-size-changer',
      'pdf-cropper',
      'pdf-page-numbering',
      'pdf-header-footer',
      'pdf-bates-numbering',
      'pdf-bookmarks',
      'pdf-rename-content',
    ],
  },
  {
    id: 'pdf-optimize-ocr',
    label: 'Optimize, Clean Scans & OCR',
    description: 'Compress KB/MB, deskew, grayscale, clean scan shadows, invert dark slides, OCR & summarize.',
    toolIds: [
      'pdf-compressor',
      'pdf-to-grayscale',
      'pdf-scan-cleanup',
      'pdf-deskew',
      'pdf-invert-colors',
      'pdf-to-pdfa',
      'ocr-scanned-pdf',
      'pdf-executive-summarizer',
      'pdf-compare',
    ],
  },
  {
    id: 'pdf-security',
    label: 'Sign, Redact, Watermark & Security',
    description: 'E-signatures, permanent redaction, watermarks, unlock/AES encrypt, metadata & repair.',
    toolIds: [
      'pdf-signer',
      'pdf-redact',
      'pdf-watermark-maker',
      'pdf-unlocker',
      'pdf-password-protector',
      'pdf-metadata-editor',
      'pdf-strip-metadata',
      'pdf-remove-annotations',
      'pdf-flatten-repair',
      'pdf-repair',
    ],
  },
];

const IMAGE_SUBGROUPS: SubGroupDefinition[] = [
  {
    id: 'image-crop',
    label: 'Crop, Resize & KB Compress',
    description: 'Precision JPG/PNG/WEBP cropping, batch dimensions, KB compression & DPI header changer.',
    toolIds: [
      'jpg-crop',
      'png-crop',
      'webp-crop',
      'image-resize',
      'image-compress',
      'image-dpi-changer',
      'image-upscaler',
    ],
  },
  {
    id: 'image-bg-privacy',
    label: 'Background Removal, Blur & EXIF',
    description: 'Remove solid or white backgrounds, redact Aadhaar/faces, strip GPS EXIF & add watermarks.',
    toolIds: [
      'image-bg-remover',
      'image-color-bg-remover',
      'image-blur-privacy',
      'image-exif-cleaner',
      'image-watermark',
    ],
  },
  {
    id: 'image-exam-studio',
    label: 'Govt Exam, Passport & KYC Studio',
    description: 'UPSC/SSC/IBPS photo presets, signature resizer <20KB, A4 passport sheets, ID card merger & compliance checks.',
    toolIds: [
      'govt-exam-photo-studio',
      'image-passport-sheet',
      'image-signature-resizer',
      'handwritten-declaration-maker',
      'id-card-merger',
      'exam-doc-scanner',
      'exam-portal-checker',
      'image-to-text-ocr',
      'invoice-ocr-extractor',
    ],
  },
  {
    id: 'image-convert-creative',
    label: 'Convert, Filters, Collage & Colour',
    description: 'Format/ICO converter, filters, collage grid, tile splitter, meme maker, HTML snapshot & Swatchbook.',
    toolIds: [
      'image-converter',
      'image-heic-converter',
      'image-rotate-flip',
      'image-filters-studio',
      'image-collage-maker',
      'image-grid-splitter',
      'image-meme-generator',
      'html-to-image',
      'image-resolution-checker',
      'swatchbook-color-picker',
    ],
  },
];

const TYPING_SUBGROUPS: SubGroupDefinition[] = [
  {
    id: 'typing-practice',
    label: 'Typing Tests & Unicode Legacy Fonts',
    description: 'Timed English/Hindi/Kannada WPM typing practice & Kruti Dev/Nudi Unicode converters.',
    toolIds: ['multilingual-typing-test', 'kruti-nudi-unicode'],
  },
  {
    id: 'typing-writing',
    label: 'Word Counter, Case, Sorter & Documents',
    description: 'UPSC word counter, Rich Text & DOCX viewer, line sorter/deduper, TXT to PDF & ATS Resume Builder.',
    toolIds: [
      'word-counter',
      'case-converter',
      'text-sorter-deduper',
      'rich-text-studio',
      'docx-viewer',
      'txt-to-pdf',
      'resume-ats-builder',
    ],
  },
  {
    id: 'typing-shortcuts-learn',
    label: 'Keyboard Shortcuts & Reference',
    description: 'Windows, desktop, laptop & MacBook keyboard shortcuts with clear explanations.',
    toolIds: ['keyboard-shortcuts-guide'],
  },
];

const UTILITIES_SUBGROUPS: SubGroupDefinition[] = [
  {
    id: 'util-spreadsheets',
    label: 'Spreadsheet, Excel & CSV Studio',
    description: 'View, clean duplicates, merge, split, compare, compress & convert Excel/CSV/JSON/SQL offline.',
    toolIds: [
      'excel-csv-viewer',
      'excel-to-csv',
      'csv-to-excel',
      'excel-to-json',
      'json-to-excel',
      'clean-spreadsheet',
      'merge-spreadsheets',
      'split-excel-sheets',
      'compare-spreadsheets',
      'compress-excel',
      'csv-delimiter-utf8',
      'column-extractor',
      'excel-to-markdown-sql',
    ],
  },
  {
    id: 'util-qr-retail',
    label: 'QR, Merchant Standees & Barcodes',
    description: 'NPCI UPI payment standees, vCard digital visiting cards, 5-star review posters & EAN-13/CODE128.',
    toolIds: [
      'qr-code-generator',
      'upi-merchant-validator',
      'vcard-visiting-card-qr',
      'review-qr-poster',
      'shop-payment-poster',
      'barcode-generator',
    ],
  },
  {
    id: 'util-dev-crypto',
    label: 'Developer, Security & Text Diff',
    description: 'JSON/XML formatters, CSS/JS minifier, Markdown, SHA-256 checksum, UUID, Base64 & Passwords.',
    toolIds: [
      'json-formatter',
      'xml-formatter',
      'css-js-minifier',
      'markdown-studio',
      'hash-checksum-generator',
      'uuid-generator',
      'base64-encoder-decoder',
      'url-encoder-decoder',
      'slug-filename-cleaner',
      'text-compare-tool',
      'password-generator',
      'password-strength-checker',
    ],
  },
  {
    id: 'util-office-time',
    label: 'Converters, Timezones, Atlas & Office',
    description: 'INR words, units, storage KB/GB, world clock, ISD country atlas, stopwatch, timers & email signatures.',
    toolIds: [
      'number-to-words',
      'unit-converter',
      'storage-converter',
      'unix-timestamp-converter',
      'world-clock-converter',
      'world-country-atlas',
      'stopwatch',
      'countdown-timer',
      'email-signature-generator',
      'lorem-ipsum-generator',
    ],
  },
];

function getSubGroupsForCategory(category: ToolFilterType): SubGroupDefinition[] | null {
  if (category === 'PDF Suite') return PDF_SUBGROUPS;
  if (category === 'Image Studio') return IMAGE_SUBGROUPS;
  if (category === 'Typing & Text') return TYPING_SUBGROUPS;
  if (category === 'Utilities') return UTILITIES_SUBGROUPS;
  return null;
}

export function AllToolsPage({
  activeFilter,
  initialSearchQuery = '',
  onFilterChange,
  onBackHome,
  onOpenTool,
}: AllToolsPageProps) {
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [activeSubGroup, setActiveSubGroup] = useState<string>('all');

  useEffect(() => {
    setSearchQuery(initialSearchQuery);
  }, [initialSearchQuery]);

  // Reset sub-group filter whenever top category changes
  useEffect(() => {
    setActiveSubGroup('all');
  }, [activeFilter]);

  const activeCategoryHead = useMemo(
    () =>
      activeFilter === 'All'
        ? undefined
        : TOOL_SECTION_HEADS.find((head) => head.key === activeFilter),
    [activeFilter]
  );

  const subGroupDefs = useMemo(() => getSubGroupsForCategory(activeFilter), [activeFilter]);

  const sectionsToRender = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return TOOL_SECTION_HEADS.filter(
      (head) => activeFilter === 'All' || head.key === activeFilter
    )
      .map((head) => {
        const filteredTools = TOOLS_CATALOG.filter((tool) => {
          if (tool.id === 'gstr1-return-prep' && activeFilter !== 'GST Utilities') {
            return false;
          }
          const matchesSuite =
            activeFilter === 'All'
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
        const sectionTools = sortToolsForSuite(filteredTools, head.key);
        return { head, tools: sectionTools };
      })
      .filter((section) => section.tools.length > 0);
  }, [activeFilter, searchQuery]);

  // Partition a large dedicated category (like PDF Suite's 32 tools) into workflow groups while preserving ALL tools
  const groupedDedicatedSections = useMemo(() => {
    if (!activeCategoryHead || !subGroupDefs || sectionsToRender.length !== 1) return null;
    const categoryTools = sectionsToRender[0].tools;
    const assignedIds = new Set<string>();

    const groups = subGroupDefs
      .map((group) => {
        const matching = categoryTools.filter((t) => group.toolIds.includes(t.id));
        matching.forEach((t) => assignedIds.add(t.id));
        return { ...group, tools: matching };
      })
      .filter((group) => group.tools.length > 0);

    // Ensure any newly added or uncategorized tools in this category always appear
    const unassigned = categoryTools.filter((t) => !assignedIds.has(t.id));
    if (unassigned.length > 0) {
      groups.push({
        id: 'other-tools',
        label: `Additional ${activeCategoryHead.key} Tools`,
        description: `More browser-based utilities included in ${activeCategoryHead.title}.`,
        toolIds: unassigned.map((t) => t.id),
        tools: unassigned,
      });
    }

    return groups;
  }, [activeCategoryHead, sectionsToRender, subGroupDefs]);

  const visibleGroupedSections = useMemo(() => {
    if (!groupedDedicatedSections) return null;
    if (activeSubGroup === 'all') return groupedDedicatedSections;
    return groupedDedicatedSections.filter((g) => g.id === activeSubGroup);
  }, [activeSubGroup, groupedDedicatedSections]);

  const totalShown = visibleGroupedSections
    ? visibleGroupedSections.reduce((acc, g) => acc + g.tools.length, 0)
    : sectionsToRender.reduce((acc, s) => acc + s.tools.length, 0);

  const categoryTotalCount = activeCategoryHead
    ? getToolsForCategory(activeCategoryHead.key).length
    : TOOLS_CATALOG.length;

  const getGridColsClass = (count: number) => {
    if (count === 1) return 'grid grid-cols-1 max-w-xl';
    if (count === 2) return 'grid grid-cols-1 sm:grid-cols-2 gap-5';
    if (count === 3) return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5';
    return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5';
  };

  return (
    <section className="w-full bg-[#CEE5DC] dark:bg-[#0B1120] min-h-[calc(100dvh-140px)] py-8 md:py-12 transition-colors duration-200">
      <div className="max-w-[1400px] mx-auto pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6 space-y-8">
        {/* Top Breadcrumb & Back Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 text-xs font-semibold text-[#334155] dark:text-slate-300">
            <button
              type="button"
              onClick={onBackHome}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-[#FFFDF5] dark:bg-[#131C2E] hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] dark:text-slate-100 dark:hover:text-[#0F172A] transition cursor-pointer whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Home</span>
            </button>

            <span className="hidden sm:inline text-[#64748B] dark:text-slate-500" aria-hidden="true">
              /
            </span>

            {activeCategoryHead ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    onFilterChange('All');
                  }}
                  className="hidden sm:inline text-[#334155] dark:text-slate-300 hover:text-[#2F3E4E] dark:hover:text-[#F9C80E] underline underline-offset-4 cursor-pointer"
                >
                  All Tools ({TOOLS_CATALOG.length})
                </button>
                <span className="hidden sm:inline text-[#64748B] dark:text-slate-500" aria-hidden="true">
                  /
                </span>
                <span className="hidden sm:inline text-[#2F3E4E] dark:text-slate-100 font-bold">
                  {activeCategoryHead.title}
                </span>
              </>
            ) : (
              <span className="hidden sm:inline text-[#2F3E4E] dark:text-slate-100 font-bold">
                All Tools Directory
              </span>
            )}
          </div>

          <span className="text-xs font-mono font-bold text-[#2F3E4E] dark:text-slate-200 tabular-nums">
            Showing {totalShown} of {categoryTotalCount}{' '}
            {categoryTotalCount === 1 ? 'tool' : 'tools'}
          </span>
        </div>

        {/* Dedicated Category or All-Tools Header + Search + Workflow Sub-Filters */}
        <div className="bg-[#FEF2C8] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-6 sm:p-8 shadow-[0_4px_0_#2F3E4E] dark:shadow-[0_4px_0_#020617] space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex-1 min-w-0 space-y-2">
              {activeCategoryHead ? (
                <>
                  <div className="flex flex-wrap items-center gap-3 text-xs font-mono font-bold text-[#475569] dark:text-slate-400 tabular-nums">
                    <span className="inline-flex items-center gap-1.5 text-[#2F3E4E] dark:text-[#F9C80E]">
                      <Layers className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Suite {activeCategoryHead.index}</span>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {categoryTotalCount} {categoryTotalCount === 1 ? 'Live Tool' : 'Live Tools'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 text-[#12805C] dark:text-emerald-400">
                      <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>100% Client-Side</span>
                    </span>
                  </div>
                  <h1 className="font-display font-extrabold text-[clamp(1.75rem,3.2vw,2.45rem)] text-[#2F3E4E] dark:text-slate-50 tracking-tight leading-tight">
                    {activeCategoryHead.title}
                  </h1>
                  <p className="text-sm text-[#475569] dark:text-slate-300 leading-relaxed">
                    {activeCategoryHead.subtitle} Every utility in this suite runs directly inside
                    your browser with zero file uploads.
                  </p>
                </>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-3 text-xs font-mono font-bold text-[#475569] dark:text-slate-400 tabular-nums">
                    <span>{TOOLS_CATALOG.length} Live Modules</span>
                    <span aria-hidden="true">·</span>
                    <span>{TOOL_SECTION_HEADS.length} Specialized Suites</span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 text-[#12805C] dark:text-emerald-400">
                      <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Zero Server Upload</span>
                    </span>
                  </div>
                  <h1 className="font-display font-extrabold text-[clamp(1.75rem,3.2vw,2.45rem)] text-[#2F3E4E] dark:text-slate-50 tracking-tight leading-tight">
                    All VCPL Tools — Section-Wise Directory
                  </h1>
                  <p className="text-sm text-[#475569] dark:text-slate-300 leading-relaxed">
                    Browse all {TOOLS_CATALOG.length} client-side utilities organized across Banking,
                    Tax &amp; GST, GST, Calculator Hub, PDF Suite, Image Studio, Typing &amp; Text, QR
                    Utilities, VCPL Tools, Special Tools, and Learn Tools.
                  </p>
                </>
              )}
            </div>

            <div className="relative w-full lg:w-[360px] xl:w-[400px] shrink-0">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B] dark:text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  activeCategoryHead
                    ? `Filter ${categoryTotalCount} ${activeCategoryHead.key} tools...`
                    : `Filter ${TOOLS_CATALOG.length} tools by name, code, keyword...`
                }
                aria-label="Filter category tools"
                className="w-full pl-10 pr-9 py-3 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-[#FFFDF5] dark:bg-[#0B1120] shadow-[0_2px_0_#2F3E4E] dark:shadow-[0_2px_0_#020617] text-xs sm:text-sm font-medium text-[#2F3E4E] dark:text-slate-100 placeholder:text-[#64748B] dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2F3E4E] dark:focus:ring-[#F9C80E]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear filter"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded text-[#64748B] dark:text-slate-400 hover:text-[#2F3E4E] dark:hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Workflow Sub-Filters inside Large Suites (Default: ALL tools shown immediately) */}
          {groupedDedicatedSections && groupedDedicatedSections.length > 1 && (
            <div className="pt-3 border-t border-[#2F3E4E]/15 dark:border-slate-700/80 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-display font-extrabold uppercase tracking-wider text-[#475569] dark:text-slate-400 mr-1">
                Workflow View:
              </span>
              <button
                type="button"
                onClick={() => setActiveSubGroup('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border-[1.5px] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeSubGroup === 'all'
                    ? 'bg-[#F9C80E] text-[#2F3E4E] border-[#2F3E4E] shadow-[0_2px_0_#2F3E4E]'
                    : 'bg-[#FFFDF5] dark:bg-[#0B1120] text-[#2F3E4E] dark:text-slate-200 border-[#2F3E4E]/40 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800'
                }`}
              >
                All {activeCategoryHead?.key} ({sectionsToRender[0]?.tools.length ?? 0})
              </button>
              {groupedDedicatedSections.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => setActiveSubGroup(group.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border-[1.5px] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeSubGroup === group.id
                      ? 'bg-[#F9C80E] text-[#2F3E4E] border-[#2F3E4E] shadow-[0_2px_0_#2F3E4E]'
                      : 'bg-[#FFFDF5] dark:bg-[#0B1120] text-[#2F3E4E] dark:text-slate-200 border-[#2F3E4E]/40 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800'
                  }`}
                >
                  {group.label} ({group.tools.length})
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Running Release Status Notice (Core Stable Tools vs Beta Testing Suites) */}
        <ReleaseStatusTicker />

        {/* Directory Top Leaderboard Ad Slot */}
        <AdSlot
          slotId="vcpl-directory-top-728x90"
          variant="leaderboard"
          label="Category Header Leaderboard · 728 × 90"
          contentContext={
            activeFilter === 'All'
              ? 'Banking, GST, PDF & Financial Calculation Software'
              : `${activeFilter} Utilities & Business Workflows`
          }
        />

        {/* Render Full Category Tool Grids (Shows EVERY tool in the selected category) */}
        {sectionsToRender.length === 0 ? (
          <div className="max-w-md mx-auto text-center bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-xl p-8">
            <p className="font-display font-bold text-lg text-[#2F3E4E] dark:text-slate-100">
              No matching tools found
            </p>
            <p className="mt-2 text-sm text-[#475569] dark:text-slate-300">
              Try clearing your search or switching back to All Tools.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setActiveSubGroup('all');
                onFilterChange('All');
              }}
              className="mt-5 px-5 py-2.5 rounded-lg bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#FFFDF5] dark:text-[#0F172A] text-sm font-semibold cursor-pointer"
            >
              Show All {TOOLS_CATALOG.length} Tools
            </button>
          </div>
        ) : visibleGroupedSections ? (
          <div className="space-y-10">
            {visibleGroupedSections.map((group, groupIdx) => (
              <div key={group.id} className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pb-3 border-b border-[#2F3E4E]/20 dark:border-slate-700">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-extrabold text-[#2F3E4E] bg-[#F9C80E] border border-[#2F3E4E] px-2 py-0.5 rounded-md tabular-nums">
                        {String(groupIdx + 1).padStart(2, '0')}
                      </span>
                      <h2 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] dark:text-slate-50 tracking-tight">
                        {group.label}
                      </h2>
                    </div>
                    <p className="text-xs sm:text-sm text-[#334155] dark:text-slate-300 mt-1">{group.description}</p>
                  </div>

                  <span className="text-xs font-mono font-bold text-[#2F3E4E] dark:text-slate-300 tabular-nums shrink-0">
                    {group.tools.length} {group.tools.length === 1 ? 'Tool' : 'Tools'}
                  </span>
                </div>

                <div className={getGridColsClass(group.tools.length)}>
                  {group.tools.map((tool) => (
                    <ToolCard key={tool.id} tool={tool} onOpenTool={onOpenTool} />
                  ))}
                </div>

                {groupIdx === 1 && (
                  <AdSlot
                    slotId="vcpl-directory-mid-group"
                    variant="inline"
                    label="Mid-Directory Contextual Unit · Responsive Fluid"
                    contentContext={`${activeFilter} Tools & Document Workflows`}
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-10">
            {sectionsToRender.map(({ head, tools }, sectionIdx) => (
              <div
                key={head.key}
                id={`all-tools-head-${head.key.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                className="space-y-5"
              >
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pb-3 border-b border-[#2F3E4E]/20 dark:border-slate-700">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-extrabold text-[#2F3E4E] bg-[#F9C80E] border border-[#2F3E4E] px-2 py-0.5 rounded-md tabular-nums">
                        {head.index}
                      </span>
                      <h2 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] dark:text-slate-50 tracking-tight">
                        {head.title}
                      </h2>
                    </div>
                    <p className="text-xs sm:text-sm text-[#334155] dark:text-slate-300 mt-1">{head.subtitle}</p>
                  </div>

                  <span className="text-xs font-mono font-bold text-[#2F3E4E] dark:text-slate-300 tabular-nums shrink-0">
                    {tools.length} {tools.length === 1 ? 'Tool' : 'Tools'}
                  </span>
                </div>

                <div className={getGridColsClass(tools.length)}>
                  {tools.map((tool) => (
                    <ToolCard key={tool.id} tool={tool} onOpenTool={onOpenTool} />
                  ))}
                </div>

                {sectionIdx === 2 && (
                  <AdSlot
                    slotId="vcpl-directory-mid-suite"
                    variant="inline"
                    label="Mid-Directory Contextual Unit · 970 × 90"
                    contentContext="Accounting, Tax Filing & PDF Conversion Software"
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* General Frequently Asked Questions */}
        <FaqSection variant="directory" />

        {/* Directory Bottom Dual & Triple Partner Ad Slots */}
        <AdSlot
          slotId="vcpl-directory-bottom-dual"
          variant="dual"
          contentContext={
            activeFilter === 'All'
              ? 'Accounting, GST & Document Productivity'
              : `${activeFilter} Solutions`
          }
        />
        <AdSlot
          slotId="vcpl-directory-bottom-triple"
          variant="triple"
          contentContext={
            activeFilter === 'All'
              ? 'Indian Business, Banking & Utility Software'
              : `${activeFilter} Partner Ecosystem`
          }
        />
      </div>
    </section>
  );
}
