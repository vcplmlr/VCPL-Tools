import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileCode2,
  FolderTree,
  Globe,
  Layers,
  Scale,
  Wrench,
} from 'lucide-react';
import { LEGAL_PAGES, LegalPageSlug } from '../data/legalPagesData';
import {
  PUBLIC_TOOLS_CATALOG,
  TOOL_SECTION_HEADS,
  getToolsForCategory,
} from '../data/toolsCatalog';
import { ToolCatalogItem, ToolFilterType } from '../types/tools';
import {
  DEFAULT_SITE_ORIGIN,
  buildSitemapXmlString,
  getAllCanonicalSitemapUrls,
} from '../utils/seoConfig';
import {
  getAllToolsPath,
  getLegalPath,
  getToolPath,
} from '../utils/seoRouting';
import { AdSlot } from './AdSlot';

interface SitemapPageProps {
  onBackHome: () => void;
  onOpenAllTools: (filter?: ToolFilterType) => void;
  onOpenTool: (tool: ToolCatalogItem) => void;
  onOpenLegalPage: (slug: LegalPageSlug) => void;
}

export function SitemapPage({
  onBackHome,
  onOpenAllTools,
  onOpenTool,
  onOpenLegalPage,
}: SitemapPageProps) {
  const [copiedXml, setCopiedXml] = useState(false);

  const origin =
    typeof window !== 'undefined' ? window.location.origin : DEFAULT_SITE_ORIGIN;

  const legalEntries = useMemo(
    () =>
      (Object.keys(LEGAL_PAGES) as LegalPageSlug[]).map((slug) => ({
        slug,
        title: LEGAL_PAGES[slug].navTitle,
        subtitle: LEGAL_PAGES[slug].subtitle,
        path: getLegalPath(slug),
      })),
    []
  );

  const totalUrls = useMemo(() => getAllCanonicalSitemapUrls(origin).length, [origin]);

  const handleDownloadXml = () => {
    const xml = buildSitemapXmlString(origin);
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sitemap.xml';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleCopyXml = async () => {
    try {
      const xml = buildSitemapXmlString(origin);
      await navigator.clipboard.writeText(xml);
      setCopiedXml(true);
      window.setTimeout(() => setCopiedXml(false), 2500);
    } catch {
      handleDownloadXml();
    }
  };

  return (
    <section className="w-full bg-[#CEE5DC] dark:bg-[#0B1120] min-h-[calc(100dvh-140px)] py-8 md:py-12 transition-colors duration-200">
      <div className="max-w-[1400px] mx-auto pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6 space-y-8">
        {/* Breadcrumb */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs font-semibold text-[#334155] dark:text-slate-300">
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
            <span className="hidden sm:inline font-bold text-[#2F3E4E] dark:text-slate-100">
              HTML &amp; XML Sitemap
            </span>
          </div>

          <span className="text-xs font-mono font-bold text-[#2F3E4E] dark:text-slate-200 tabular-nums">
            {totalUrls} Canonical Indexable URLs
          </span>
        </div>

        {/* Hero Card */}
        <header className="bg-[#FEF2C8] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-5 sm:p-8 shadow-[0_5px_0_#2F3E4E] dark:shadow-[0_5px_0_#020617] space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2.5 max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#F9C80E] dark:text-[#0F172A] font-display font-extrabold text-[11px] uppercase tracking-wider">
                <FolderTree className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Complete Site Directory &amp; SEO Map</span>
              </div>

              <h1 className="font-display font-extrabold text-[clamp(1.75rem,3.3vw,2.5rem)] leading-tight text-[#2F3E4E] dark:text-slate-50 tracking-tight">
                VCPL Tools Sitemap — All {PUBLIC_TOOLS_CATALOG.length} Utilities &amp; Pages
              </h1>

              <p className="text-sm sm:text-[15px] leading-relaxed text-[#475569] dark:text-slate-300">
                Explore every canonical page across VCPL Tools—including all {TOOL_SECTION_HEADS.length} tool suites,
                all {PUBLIC_TOOLS_CATALOG.length} browser-local utilities, legal &amp; security policies,
                and search-engine XML sitemap feeds.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <a
                href="/sitemap.xml"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-xl bg-[#FFFDF5] dark:bg-[#0B1120] hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] dark:border-slate-600 shadow-[0_3px_0_#2F3E4E] dark:shadow-[0_3px_0_#020617] text-xs font-display font-extrabold text-[#2F3E4E] dark:text-slate-100 dark:hover:text-[#0F172A] transition cursor-pointer whitespace-nowrap"
              >
                <FileCode2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Open /sitemap.xml</span>
                <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              </a>

              <button
                type="button"
                onClick={handleCopyXml}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-xl bg-[#CEE5DC] dark:bg-emerald-950/70 hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] dark:border-emerald-700 shadow-[0_3px_0_#2F3E4E] dark:shadow-[0_3px_0_#020617] text-xs font-display font-extrabold text-[#2F3E4E] dark:text-emerald-200 dark:hover:text-[#0F172A] transition cursor-pointer whitespace-nowrap"
              >
                {copiedXml ? (
                  <>
                    <Check className="w-4 h-4 text-[#12805C] dark:text-emerald-400 shrink-0" aria-hidden="true" />
                    <span>XML Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>Copy Live XML</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleDownloadXml}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-xl bg-[#2F3E4E] dark:bg-[#F9C80E] hover:bg-[#1E293B] dark:hover:bg-[#FDE047] border-[1.5px] border-[#2F3E4E] dark:border-[#F9C80E] shadow-[0_3px_0_#1E293B] dark:shadow-[0_3px_0_#020617] text-xs font-display font-extrabold text-[#F9C80E] dark:text-[#0F172A] transition cursor-pointer whitespace-nowrap"
              >
                <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Download sitemap.xml</span>
              </button>
            </div>
          </div>

          {/* Quick Jump Pills */}
          <div className="pt-4 border-t border-[#2F3E4E]/15 dark:border-slate-700/80 flex flex-wrap items-center gap-2 text-xs">
            <a
              href="#sitemap-core"
              className="px-3 py-1.5 rounded-lg bg-[#FFFDF5] dark:bg-[#0B1120] hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] border border-[#2F3E4E]/35 dark:border-slate-700 font-bold text-[#2F3E4E] dark:text-slate-200 dark:hover:text-[#0F172A]"
            >
              Core &amp; Suites ({TOOL_SECTION_HEADS.length + 3})
            </a>
            <a
              href="#sitemap-tools"
              className="px-3 py-1.5 rounded-lg bg-[#FFFDF5] dark:bg-[#0B1120] hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] border border-[#2F3E4E]/35 dark:border-slate-700 font-bold text-[#2F3E4E] dark:text-slate-200 dark:hover:text-[#0F172A]"
            >
              All Tools ({PUBLIC_TOOLS_CATALOG.length})
            </a>
            <a
              href="#sitemap-legal"
              className="px-3 py-1.5 rounded-lg bg-[#FFFDF5] dark:bg-[#0B1120] hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] border border-[#2F3E4E]/35 dark:border-slate-700 font-bold text-[#2F3E4E] dark:text-slate-200 dark:hover:text-[#0F172A]"
            >
              Legal &amp; Support ({legalEntries.length})
            </a>
            <a
              href="/robots.txt"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#2F3E4E] dark:bg-slate-800 text-[#CEE5DC] hover:text-[#F9C80E] border border-[#2F3E4E] dark:border-slate-600 font-mono font-semibold"
            >
              <Code2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>/robots.txt</span>
            </a>
            <a
              href="/ads.txt"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#2F3E4E] dark:bg-slate-800 text-[#F9C80E] hover:bg-[#1E293B] border border-[#2F3E4E] dark:border-slate-600 font-mono font-semibold"
            >
              <Code2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>/ads.txt</span>
            </a>
          </div>
        </header>

        {/* Core Pages & Suites */}
        <section
          id="sitemap-core"
          className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-6 sm:p-7 shadow-[0_4px_0_#2F3E4E] dark:shadow-[0_4px_0_#020617] space-y-5"
        >
          <div className="flex items-center gap-2.5 pb-3 border-b border-[#2F3E4E]/15 dark:border-slate-800">
            <Globe className="w-5 h-5 text-[#2F3E4E] dark:text-[#F9C80E] shrink-0" aria-hidden="true" />
            <h2 className="font-display font-extrabold text-xl text-[#2F3E4E] dark:text-slate-100">
              Core Pages &amp; {TOOL_SECTION_HEADS.length} Tool Suites
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                onBackHome();
              }}
              className="p-4 rounded-xl border-[1.5px] border-[#2F3E4E]/25 dark:border-slate-700 bg-[#FEF2C8]/55 dark:bg-[#0B1120] hover:bg-[#F9C80E]/35 dark:hover:bg-[#1A253B] hover:border-[#2F3E4E] dark:hover:border-[#F9C80E] transition flex flex-col justify-between gap-1"
            >
              <div className="font-display font-extrabold text-sm text-[#2F3E4E] dark:text-slate-100">
                VCPL Tools Home Page
              </div>
              <div className="text-xs font-mono text-[#475569] dark:text-slate-400">/</div>
            </a>

            <a
              href="/tools"
              onClick={(e) => {
                e.preventDefault();
                onOpenAllTools('All');
              }}
              className="p-4 rounded-xl border-[1.5px] border-[#2F3E4E]/25 dark:border-slate-700 bg-[#FEF2C8]/55 dark:bg-[#0B1120] hover:bg-[#F9C80E]/35 dark:hover:bg-[#1A253B] hover:border-[#2F3E4E] dark:hover:border-[#F9C80E] transition flex flex-col justify-between gap-1"
            >
              <div className="font-display font-extrabold text-sm text-[#2F3E4E] dark:text-slate-100">
                All Tools Directory ({PUBLIC_TOOLS_CATALOG.length} Tools)
              </div>
              <div className="text-xs font-mono text-[#475569] dark:text-slate-400">/tools</div>
            </a>

            {TOOL_SECTION_HEADS.map((head) => {
              const path = getAllToolsPath(head.key);
              const count = getToolsForCategory(head.key).length;
              return (
                <a
                  key={head.key}
                  href={path}
                  onClick={(e) => {
                    e.preventDefault();
                    onOpenAllTools(head.key);
                  }}
                  className="p-4 rounded-xl border-[1.5px] border-[#2F3E4E]/25 dark:border-slate-700 bg-white dark:bg-[#0B1120] hover:bg-[#CEE5DC]/55 dark:hover:bg-[#1A253B] hover:border-[#2F3E4E] dark:hover:border-[#F9C80E] transition flex flex-col justify-between gap-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display font-extrabold text-sm text-[#2F3E4E] dark:text-slate-100">
                      {head.index}. {head.title}
                    </span>
                    <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-[#FEF2C8] dark:bg-slate-800 border border-[#2F3E4E]/25 dark:border-slate-600 text-[#2F3E4E] dark:text-[#F9C80E]">
                      {count}
                    </span>
                  </div>
                  <div className="text-xs font-mono text-[#475569] dark:text-slate-400">{path}</div>
                </a>
              );
            })}
          </div>
        </section>

        <AdSlot
          slotId="vcpl-sitemap-leaderboard"
          variant="leaderboard"
          label="Sitemap Directory Leaderboard · 728 × 90"
          contentContext={`Complete VCPL Tools Directory · ${PUBLIC_TOOLS_CATALOG.length} Client-Side Utilities`}
        />

        {/* All Tools by Suite */}
        <section id="sitemap-tools" className="space-y-6">
          <div className="flex items-center gap-2.5">
            <Wrench className="w-5 h-5 text-[#2F3E4E] dark:text-[#F9C80E]" aria-hidden="true" />
            <h2 className="font-display font-extrabold text-2xl text-[#2F3E4E] dark:text-slate-50">
              All Utility URLs by Suite
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {TOOL_SECTION_HEADS.map((head) => {
              const suiteTools = getToolsForCategory(head.key);
              return (
                <div
                  key={head.key}
                  className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-5 sm:p-6 shadow-[0_4px_0_#2F3E4E] dark:shadow-[0_4px_0_#020617] space-y-4"
                >
                  <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#2F3E4E]/15 dark:border-slate-800">
                    <div className="flex items-center gap-2 min-w-0">
                      <Layers className="w-4 h-4 text-[#2F3E4E] dark:text-[#F9C80E] shrink-0" aria-hidden="true" />
                      <h3 className="font-display font-extrabold text-base text-[#2F3E4E] dark:text-slate-100 truncate">
                        {head.index}. {head.title}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenAllTools(head.key)}
                      className="text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-[#F9C80E] border border-[#2F3E4E] text-[#2F3E4E] hover:bg-[#FFE1B3] cursor-pointer shrink-0"
                    >
                      {suiteTools.length} Tools
                    </button>
                  </div>

                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {suiteTools.map((tool) => {
                      const path = getToolPath(tool);
                      return (
                        <li key={`${head.key}-${tool.id}`}>
                          <a
                            href={path}
                            onClick={(e) => {
                              e.preventDefault();
                              onOpenTool(tool);
                            }}
                            className="block p-2.5 rounded-lg border border-[#2F3E4E]/15 dark:border-slate-700/80 bg-white dark:bg-[#0B1120] hover:bg-[#FEF2C8] dark:hover:bg-[#1A253B] hover:border-[#2F3E4E] dark:hover:border-[#F9C80E] transition"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-[#2F3E4E] dark:text-slate-100 truncate">
                                {tool.title}
                              </span>
                              <span className="font-mono text-[10px] font-bold text-[#64748B] dark:text-[#F9C80E] shrink-0">
                                {tool.code}
                              </span>
                            </div>
                            <div className="mt-0.5 text-[10px] font-mono text-[#64748B] dark:text-slate-400 truncate">
                              {path}
                            </div>
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        {/* Legal, Trust & Support Pages */}
        <section
          id="sitemap-legal"
          className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-6 sm:p-7 shadow-[0_4px_0_#2F3E4E] dark:shadow-[0_4px_0_#020617] space-y-5"
        >
          <div className="flex items-center gap-2.5 pb-3 border-b border-[#2F3E4E]/15 dark:border-slate-800">
            <Scale className="w-5 h-5 text-[#2F3E4E] dark:text-[#F9C80E] shrink-0" aria-hidden="true" />
            <h2 className="font-display font-extrabold text-xl text-[#2F3E4E] dark:text-slate-100">
              Legal, Trust &amp; Information Pages
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {legalEntries.map((item) => (
              <a
                key={item.slug}
                href={item.path}
                onClick={(e) => {
                  e.preventDefault();
                  onOpenLegalPage(item.slug);
                }}
                className="p-3.5 rounded-xl border-[1.5px] border-[#2F3E4E]/20 dark:border-slate-700 bg-[#FEF2C8]/45 dark:bg-[#0B1120] hover:bg-[#F9C80E]/35 dark:hover:bg-[#1A253B] hover:border-[#2F3E4E] dark:hover:border-[#F9C80E] transition flex flex-col justify-between gap-1"
              >
                <span className="font-display font-bold text-xs text-[#2F3E4E] dark:text-slate-100">
                  {item.title}
                </span>
                <span className="text-[11px] font-mono text-[#475569] dark:text-slate-400 truncate">
                  {item.path}
                </span>
              </a>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
