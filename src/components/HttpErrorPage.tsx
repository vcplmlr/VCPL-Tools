import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Ban,
  Calculator,
  CheckCircle2,
  Clock,
  Compass,
  FileSpreadsheet,
  FileText,
  Gauge,
  Home,
  Landmark,
  LayoutGrid,
  Lock,
  Mail,
  Receipt,
  RefreshCw,
  Search,
  ServerCrash,
  ShieldAlert,
  Trash2,
  WifiOff,
  Wrench,
} from 'lucide-react';
import {
  ALL_HTTP_ERROR_CODES,
  ERROR_PAGES_CONFIG,
  HttpErrorCode,
} from '../data/errorPagesData';
import { LegalPageSlug } from '../data/legalPagesData';
import { TOOLS_CATALOG } from '../data/toolsCatalog';
import { ToolFilterType } from '../types/tools';

export interface HttpErrorPageProps {
  statusCode?: HttpErrorCode;
  requestedPath: string;
  errorDetail?: string;
  onGoHome: () => void;
  onExploreAllTools: (filter?: ToolFilterType) => void;
  onOpenCalculator: () => void;
  onOpenSearch: () => void;
  onOpenLegalPage: (slug: LegalPageSlug) => void;
  onOpenSitemap?: () => void;
  onSelectErrorCode?: (code: HttpErrorCode) => void;
  onRetry?: () => void;
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

function getErrorIcon(code: HttpErrorCode) {
  switch (code) {
    case 400:
      return AlertTriangle;
    case 401:
      return Lock;
    case 403:
      return ShieldAlert;
    case 404:
      return Compass;
    case 408:
      return Clock;
    case 410:
      return Trash2;
    case 429:
      return Gauge;
    case 500:
      return ServerCrash;
    case 502:
      return WifiOff;
    case 503:
      return Wrench;
    case 504:
      return Clock;
    default:
      return Ban;
  }
}

function getBadgePalette(code: HttpErrorCode): string {
  if (code === 401 || code === 403 || code === 500 || code === 502) {
    return 'bg-[#FFE4E6] dark:bg-rose-950/80 text-[#881337] dark:text-rose-200 border-[#2F3E4E] dark:border-rose-500/60';
  }
  if (code === 429 || code === 503 || code === 504 || code === 408) {
    return 'bg-[#FFE1B3] dark:bg-amber-950/80 text-[#7C2D12] dark:text-amber-200 border-[#2F3E4E] dark:border-amber-500/60';
  }
  return 'bg-[#F9C80E] text-[#2F3E4E] border-[#2F3E4E]';
}

export function HttpErrorPage({
  statusCode = 404,
  requestedPath,
  errorDetail,
  onGoHome,
  onExploreAllTools,
  onOpenCalculator,
  onOpenSearch,
  onOpenLegalPage,
  onOpenSitemap,
  onSelectErrorCode,
  onRetry,
}: HttpErrorPageProps) {
  const meta = ERROR_PAGES_CONFIG[statusCode] ?? ERROR_PAGES_CONFIG[404];
  const StatusIcon = getErrorIcon(meta.code);
  const badgePalette = getBadgePalette(meta.code);

  const handleRetryClick = () => {
    if (onRetry) {
      onRetry();
      return;
    }
    window.location.reload();
  };

  return (
    <section
      aria-labelledby={`vcpl-error-${meta.code}-title`}
      className="w-full bg-[#FEF2C8] dark:bg-[#0B1120] min-h-[calc(100dvh-140px)] py-10 sm:py-14 lg:py-16 transition-colors duration-200"
    >
      <div className="max-w-[1280px] mx-auto px-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6 space-y-6">
        <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-6 sm:p-10 lg:p-12 shadow-[0_6px_0_#2F3E4E] dark:shadow-[0_6px_0_#020617]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            {/* Left Primary Message, Troubleshooting & Recovery Actions */}
            <div className="lg:col-span-7 space-y-6">
              <div className="flex flex-wrap items-center gap-2.5">
                <div
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border-[1.5px] shadow-[0_2px_0_#2F3E4E] font-mono text-xs font-extrabold tabular-nums ${badgePalette}`}
                >
                  <StatusIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{meta.badgeLabel}</span>
                </div>
                <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-[#CEE5DC]/75 dark:bg-emerald-950/60 border border-[#2F3E4E]/25 dark:border-emerald-600/40 font-mono text-[11px] font-bold text-[#2F3E4E] dark:text-emerald-200">
                  {meta.category === 'server' ? '5xx Server Status' : '4xx Client Status'}
                </span>
              </div>

              <h1
                id={`vcpl-error-${meta.code}-title`}
                className="font-display font-extrabold tracking-tight text-[#2F3E4E] dark:text-slate-50 leading-[1.08]"
                style={{
                  fontSize: 'clamp(1.9rem, 4vw, 3.2rem)',
                  textWrap: 'balance',
                }}
              >
                {meta.headline}
              </h1>

              <p className="text-sm sm:text-base leading-relaxed text-[#475569] dark:text-slate-300 max-w-2xl">
                {meta.description}{' '}
                <span className="inline-block mt-1">
                  Path:{' '}
                  <code className="font-mono text-xs sm:text-sm font-bold text-[#2F3E4E] dark:text-[#F9C80E] bg-[#FEF2C8] dark:bg-[#0B1120] border border-[#2F3E4E]/30 dark:border-slate-700 px-2 py-0.5 rounded-md break-all">
                    {requestedPath || `/${meta.code}`}
                  </code>
                </span>
              </p>

              {errorDetail && (
                <div className="rounded-xl bg-[#FFE4E6]/60 dark:bg-rose-950/40 border border-rose-400/50 dark:border-rose-700/60 px-4 py-3 text-xs font-mono text-[#881337] dark:text-rose-200 break-words">
                  {errorDetail}
                </div>
              )}

              {/* Troubleshooting Checklist */}
              <div className="rounded-xl bg-[#FEF2C8]/65 dark:bg-[#0B1120]/90 border-[1.5px] border-[#2F3E4E]/25 dark:border-slate-700 p-4 sm:p-5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display font-extrabold text-sm text-[#2F3E4E] dark:text-slate-100">
                    {meta.troubleshootingTitle}
                  </h2>
                  <span className="text-[11px] font-mono font-semibold text-[#64748B] dark:text-slate-400">
                    {meta.statusNote}
                  </span>
                </div>
                <ul className="space-y-2 text-xs sm:text-[13px] text-[#334155] dark:text-slate-300">
                  {meta.reasons.map((reason) => (
                    <li key={reason} className="flex items-start gap-2.5 leading-relaxed">
                      <CheckCircle2
                        className="w-4 h-4 text-[#12805C] dark:text-emerald-400 shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                {meta.supportsRetry && (
                  <button
                    type="button"
                    onClick={handleRetryClick}
                    className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-[#12805C] hover:bg-[#0E684A] text-white border-[1.5px] border-[#2F3E4E] dark:border-emerald-500 shadow-[0_3px_0_#2F3E4E] dark:shadow-[0_3px_0_#020617] text-sm font-display font-extrabold transition-all hover:-translate-y-0.5 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <RefreshCw className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>{meta.retryLabel ?? 'Retry Page'}</span>
                  </button>
                )}

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

                {(meta.code === 401 || meta.code === 403 || meta.code === 500 || meta.code === 503) && (
                  <button
                    type="button"
                    onClick={() => onOpenLegalPage('contact-us')}
                    className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl bg-white dark:bg-[#0B1120] hover:bg-[#FFE1B3] dark:hover:bg-slate-800 text-[#2F3E4E] dark:text-slate-100 border-[1.5px] border-[#2F3E4E]/50 dark:border-slate-600 text-sm font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Mail className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>Contact Support</span>
                  </button>
                )}
              </div>

              {/* All Standard HTTP Error Pages Switcher */}
              {onSelectErrorCode && (
                <div className="pt-4 border-t border-[#2F3E4E]/15 dark:border-slate-800 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-display font-extrabold text-xs uppercase tracking-wider text-[#334155] dark:text-slate-400">
                      HTTP Status &amp; Error Pages Directory
                    </span>
                    <span className="text-[11px] font-mono text-[#64748B] dark:text-slate-400">
                      4xx Client · 5xx Server
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {ALL_HTTP_ERROR_CODES.map((code) => {
                      const entry = ERROR_PAGES_CONFIG[code];
                      const isActive = code === meta.code;
                      return (
                        <button
                          key={code}
                          type="button"
                          onClick={() => onSelectErrorCode(code)}
                          aria-current={isActive ? 'page' : undefined}
                          title={`Preview ${code} – ${entry.shortTitle}`}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[34px] rounded-lg border text-xs font-mono font-bold transition-all cursor-pointer whitespace-nowrap ${
                            isActive
                              ? 'bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#F9C80E] dark:text-[#0F172A] border-[#2F3E4E] dark:border-[#F9C80E] shadow-[0_2px_0_#1A242F] dark:shadow-none'
                              : 'bg-[#FFFDF5] dark:bg-[#0B1120] hover:bg-[#FEF2C8] dark:hover:bg-slate-800 text-[#2F3E4E] dark:text-slate-200 border-[#2F3E4E]/35 dark:border-slate-700'
                          }`}
                        >
                          <span className="tabular-nums">{code}</span>
                          <span className="font-sans font-semibold text-[11px] opacity-85">
                            {entry.shortTitle}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Right Theme-Colored Directory & Required Pages Card */}
            <div className="lg:col-span-5 space-y-5">
              <div className="rounded-2xl bg-[#CEE5DC]/65 dark:bg-[#0F172A] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between gap-3 border-b border-[#2F3E4E]/15 dark:border-slate-800 pb-3">
                  <div>
                    <span className="font-mono text-4xl sm:text-5xl font-extrabold text-[#2F3E4E] dark:text-slate-100 tabular-nums leading-none block">
                      {meta.code}
                    </span>
                    <span className="text-xs font-semibold text-[#334155] dark:text-slate-300 mt-1 block">
                      {meta.shortTitle}
                    </span>
                  </div>
                  <span className="text-xs font-display font-extrabold uppercase tracking-wider text-[#2F3E4E] bg-[#F9C80E] border border-[#2F3E4E] px-2.5 py-1 rounded-md whitespace-nowrap">
                    VCPL Directory
                  </span>
                </div>

                <div className="space-y-2">
                  <h2 className="font-display font-extrabold text-sm text-[#2F3E4E] dark:text-slate-100">
                    Popular Offline-Ready Suites
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
      </div>
    </section>
  );
}
