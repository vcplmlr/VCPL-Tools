import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Cookie,
  ExternalLink,
  Laptop,
  Layers,
  Loader2,
  Mail,
  MapPin,
  ShieldCheck,
} from 'lucide-react';
import { vcplBuildMeta } from 'virtual:vcpl-build-meta';
import { HttpErrorCode } from '../data/errorPagesData';
import { LegalPageSlug, SITE_CONTACT } from '../data/legalPagesData';
import { ToolCatalogItem, ToolFilterType } from '../types/tools';
import { emitGlobalProgress } from './TopLoadingBar';
import { TulunaduFlagIcon } from './TulunaduFlagIcon';
import { VcplBrandLogo } from './VcplBrandLogo';
import { WhatsAppIcon } from './WhatsAppIcon';

interface FooterProps {
  activeTool?: ToolCatalogItem | null;
  onHomeClick: () => void;
  onOpenAllTools: (filter?: ToolFilterType) => void;
  onOpenLockedVault?: () => void;
  onOpenLegalPage: (slug: LegalPageSlug) => void;
  onOpenBlog?: () => void;
  onOpenPrivacyBanner: () => void;
  onOpenNotFound?: () => void;
  onOpenErrorPage?: (code: HttpErrorCode) => void;
  onOpenSitemap?: () => void;
}

const NEWSLETTER_STORAGE_KEY = 'vcpl_release_updates_email';
const NEWSLETTER_COOLDOWN_KEY = 'vcpl_newsletter_last_submit_ms';
const NEWSLETTER_COOLDOWN_MS = 30_000;
const NEWSLETTER_APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbyrU797dMOwvTd1Iduim7q2bGnWUKwFYrpUVFideTJXQv_YuKeQJxiBL3qLZjViPSE/exec';

function isValidSubscriberEmail(value: string): boolean {
  if (!value || value.length > 254 || value.includes('..')) return false;
  return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(
    value
  ) && /\.[a-z]{2,}$/i.test(value);
}

const TOOL_DIRECTORY_LINKS: { label: string; filter: ToolFilterType }[] = [
  { label: 'All Tools', filter: 'All' },
  { label: 'Banking & Deposit Slips', filter: 'Banking' },
  { label: 'Tax, GST & GSTR-1 Utilities', filter: 'Tax & GST' },
  { label: 'PDF & Document Tools', filter: 'PDF Suite' },
  { label: 'Image Editing Studio', filter: 'Image Studio' },
  { label: 'Calculator Hub', filter: 'Calculator' },
  { label: 'Typing & Text', filter: 'Typing & Text' },
  { label: 'QR & Daily Utilities', filter: 'Utilities' },
  { label: 'VCPL Enterprise Tools', filter: 'VCPL' },
  { label: 'Special (Beta)', filter: 'Special Tools' },
  { label: 'Learn Tools & Shortcuts', filter: 'Learn Tools' },
];

const INFORMATION_LINKS: { label: string; slug: LegalPageSlug }[] = [
  { label: 'About Us', slug: 'about-us' },
  { label: 'FAQ', slug: 'faq' },
  { label: 'Contact Us', slug: 'contact-us' },
  { label: 'Security & Privacy', slug: 'security' },
];

const LEGAL_LINKS: { label: string; slug: LegalPageSlug }[] = [
  { label: 'Privacy Policy', slug: 'privacy-policy' },
  { label: 'Terms & Conditions', slug: 'terms-and-conditions' },
  { label: 'Disclaimer', slug: 'disclaimer' },
  { label: 'Cookie Policy', slug: 'cookie-policy' },
  { label: 'Advertising Policy', slug: 'advertising-policy' },
  { label: 'Intellectual Property', slug: 'intellectual-property' },
];

function readSavedSubscriber(): string {
  try {
    return window.localStorage.getItem(NEWSLETTER_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function getDaysSinceLaunchIst(): number {
  const launchUtcMs = Date.UTC(2026, 10, 19); // 19.11.2026 (month 0-indexed: 10 = November)
  try {
    const istDateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const [y, m, d] = istDateStr.split('-').map(Number);
    if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
      const currentUtcMs = Date.UTC(y, m - 1, d);
      return Math.floor((currentUtcMs - launchUtcMs) / 86_400_000);
    }
  } catch {
    // Fallback to local calendar date if Intl timeZone is unavailable
  }
  const now = new Date();
  const localUtcMs = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((localUtcMs - launchUtcMs) / 86_400_000);
}

export function Footer({
  activeTool = null,
  onHomeClick,
  onOpenAllTools,
  onOpenLockedVault,
  onOpenLegalPage,
  onOpenBlog,
  onOpenPrivacyBanner,
  onOpenNotFound,
  onOpenErrorPage,
  onOpenSitemap,
}: FooterProps) {
  const activeToolStamp = activeTool
    ? vcplBuildMeta.toolMetaByKind?.[activeTool.kind] ?? null
    : null;
  const [savedEmail, setSavedEmail] = useState<string>(readSavedSubscriber);
  const [emailInput, setEmailInput] = useState<string>('');
  const [honeypotInput, setHoneypotInput] = useState<string>('');
  const [emailError, setEmailError] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const submittingRef = useRef<boolean>(false);
  const [daysSinceLaunch, setDaysSinceLaunch] = useState<number>(getDaysSinceLaunchIst);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setDaysSinceLaunch(getDaysSinceLaunchIst());
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const launchCounterLabel =
    daysSinceLaunch > 0
      ? `${daysSinceLaunch} ${daysSinceLaunch === 1 ? 'Day' : 'Days'} After Launch`
      : daysSinceLaunch === 0
      ? 'Launch Day · Day 0'
      : `0 Days After Launch (Launches in ${Math.abs(daysSinceLaunch)}d)`;

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || isSubmitting) return;

    const cleaned = emailInput.trim().toLowerCase();
    if (!isValidSubscriberEmail(cleaned)) {
      setEmailError('Please enter a valid email address.');
      setStatusMessage('');
      return;
    }

    // Silent honeypot spam guard
    if (honeypotInput.trim()) {
      setEmailInput('');
      setHoneypotInput('');
      setEmailError('');
      setStatusMessage('Submission received.');
      return;
    }

    // Rate-limit repeated submissions from the same browser
    try {
      const lastSubmit = Number(window.localStorage.getItem(NEWSLETTER_COOLDOWN_KEY) || '0');
      const remainingMs = NEWSLETTER_COOLDOWN_MS - (Date.now() - lastSubmit);
      if (Number.isFinite(lastSubmit) && remainingMs > 0) {
        const waitSec = Math.ceil(remainingMs / 1000);
        setEmailError(`Please wait ${waitSec}s before sending another subscription request.`);
        setStatusMessage('');
        return;
      }
    } catch {
      // Ignore storage access errors
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    emitGlobalProgress(true, 40, 'newsletter');
    setEmailError('');
    setStatusMessage('');

    const now = new Date();
    let dateStr = '';
    let timeStr = '';
    try {
      dateStr = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(now);
      timeStr = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }).format(now);
    } catch {
      dateStr = now.toISOString().slice(0, 10);
      timeStr = now.toTimeString().slice(0, 8);
    }

    const params = new URLSearchParams();
    params.set('email', cleaned);
    params.set('date', dateStr);
    params.set('time', timeStr);
    params.set('status', 'Submitted');

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 12_000);

    try {
      await fetch(NEWSLETTER_APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: params,
        signal: controller.signal,
      });

      try {
        window.localStorage.setItem(NEWSLETTER_STORAGE_KEY, cleaned);
        window.localStorage.setItem(NEWSLETTER_COOLDOWN_KEY, String(Date.now()));
      } catch {
        // Ignore storage quota errors
      }

      setSavedEmail(cleaned);
      setEmailInput('');
      setStatusMessage('Release alerts activated for this address.');
    } catch (err) {
      const isTimeout = err instanceof DOMException && err.name === 'AbortError';
      setEmailError(
        isTimeout
          ? 'The request timed out. Please try again in a moment.'
          : 'Could not complete your subscription right now. Please check your connection and try again.'
      );
    } finally {
      window.clearTimeout(timeoutId);
      emitGlobalProgress(false, 100, 'newsletter');
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleEditSubscription = () => {
    const previousEmail = savedEmail;
    try {
      window.localStorage.removeItem(NEWSLETTER_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
    setSavedEmail('');
    setEmailInput(previousEmail);
    setEmailError('');
    setStatusMessage('');
  };

  const handleUnsubscribe = () => {
    try {
      window.localStorage.removeItem(NEWSLETTER_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
    setSavedEmail('');
    setEmailInput('');
    setEmailError('');
    setStatusMessage('Subscription preference cleared from this browser.');
  };

  return (
    <footer
      className="w-full bg-[#F5EFE0] dark:bg-[#070B14] text-[#2F3E4E] dark:text-[#E2E8F0] border-t border-[#2F3E4E]/15 dark:border-slate-800 no-print"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Refined Top Accent Strip */}
      <div
        className="w-full h-1 bg-gradient-to-r from-[#7D0B0B] via-[#F9C80E] to-[#12805C]"
        aria-hidden="true"
      />

      {/* Outer Framed Container */}
      <div className="max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-8 pt-6 sm:pt-8 lg:pt-10 pb-24 sm:pb-20 lg:pb-10">
        {/* Light Editorial Paper Sheet */}
        <div className="bg-[#FFFDF8] dark:bg-[#0F172A] text-[#2F3E4E] dark:text-[#E2E8F0] rounded-2xl border border-[#2F3E4E]/15 dark:border-slate-700/80 shadow-[0_10px_32px_rgba(47,62,78,0.07)] dark:shadow-[0_10px_32px_rgba(0,0,0,0.45)] overflow-hidden">
          {/* SECTION 1: Top Brand Showcase & Updates Subscription */}
          <div className="px-5 sm:px-9 lg:px-12 pt-8 sm:pt-10 pb-7 border-b border-[#2F3E4E]/15 flex flex-col lg:flex-row lg:items-start justify-between gap-7">
            <div className="max-w-2xl space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={onHomeClick}
                  aria-label="VCPL Tools Home"
                  className="inline-flex items-center whitespace-nowrap shrink-0 cursor-pointer rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F3E4E] transition-transform hover:scale-[1.01]"
                >
                  <VcplBrandLogo variant="header" />
                </button>
              </div>

              <p className="max-w-lg text-[13px] sm:text-sm leading-relaxed text-[#475569] dark:text-slate-300">
                Practical 100% browser-based utilities for banking slips, GST reconciliation, Form
                26AS parsing, PDF editing, and daily financial workflows—engineered in Mangalore
                with zero server file uploads.
              </p>

              <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2 pt-0.5 text-xs">
                <a
                  href="https://bharathtools.vercel.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-display font-extrabold text-[#2F3E4E] bg-[#F9C80E] hover:bg-[#FFE1B3] border-[1.5px] border-[#2F3E4E] px-3 py-1.5 rounded-lg shadow-[0_2px_0_#2F3E4E] transition-transform hover:-translate-y-0.5 whitespace-nowrap shrink-0"
                >
                  <Layers className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>BharathTools · Master Hub</span>
                  <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
                </a>

                <span className="inline-flex items-center gap-1.5 text-[#12805C] dark:text-emerald-400 font-semibold whitespace-nowrap shrink-0">
                  <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Zero Server File Storage</span>
                </span>

                <span className="inline-flex items-center gap-1.5 text-[#2F3E4E] dark:text-slate-200 font-semibold whitespace-nowrap shrink-0">
                  <Laptop className="w-4 h-4 text-[#12805C] dark:text-[#F9C80E] shrink-0" aria-hidden="true" />
                  <span>100% Browser-Based</span>
                </span>
              </div>
            </div>

            {/* Right: Updates & Release Alerts Form */}
            <div className="w-full lg:w-[410px] shrink-0 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display font-bold text-sm text-[#2F3E4E] dark:text-slate-100">
                  Tool Updates &amp; Release Notes
                </h2>
                {savedEmail && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#12805C] dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>Subscribed</span>
                  </span>
                )}
              </div>

              {savedEmail ? (
                <div
                  role="status"
                  className="rounded-xl bg-[#CEE5DC]/45 dark:bg-emerald-950/45 border-[1.5px] border-[#2F3E4E] dark:border-emerald-500/45 px-3.5 py-3 shadow-[0_2px_0_rgba(47,62,78,0.12)] space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span className="w-7 h-7 rounded-lg bg-[#12805C] text-[#FFFDF5] flex items-center justify-center shrink-0 mt-0.5">
                        <Mail className="w-3.5 h-3.5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-display font-bold text-xs text-[#2F3E4E] dark:text-slate-100">
                          Release notifications active
                        </p>
                        <p className="font-mono text-xs font-medium text-[#12805C] dark:text-emerald-300 truncate mt-0.5">
                          {savedEmail}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 pt-0.5">
                      <button
                        type="button"
                        onClick={handleEditSubscription}
                        className="px-2.5 py-1 rounded-md border border-[#2F3E4E]/30 dark:border-slate-600 bg-[#FFFDF8] dark:bg-slate-800 hover:bg-[#FEF2C8] dark:hover:bg-slate-700 text-[11px] font-semibold text-[#2F3E4E] dark:text-slate-100 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Update
                      </button>
                      <button
                        type="button"
                        onClick={handleUnsubscribe}
                        className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 hover:text-rose-700 dark:hover:text-rose-400 underline underline-offset-2 cursor-pointer whitespace-nowrap"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={(e) => void handleSubscribe(e)} noValidate className="flex items-stretch">
                  <label htmlFor="vcpl-footer-updates-email" className="sr-only">
                    Email address for tool updates
                  </label>
                  <input
                    type="text"
                    name="company_website"
                    value={honeypotInput}
                    onChange={(e) => setHoneypotInput(e.target.value)}
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                    className="sr-only"
                  />
                  <input
                    id="vcpl-footer-updates-email"
                    type="email"
                    name="email"
                    required
                    disabled={isSubmitting}
                    value={emailInput}
                    onChange={(e) => {
                      setEmailInput(e.target.value);
                      if (emailError) setEmailError('');
                      if (statusMessage) setStatusMessage('');
                    }}
                    placeholder="you@company.com"
                    className="flex-1 min-w-0 h-10 px-3.5 rounded-l-lg border-[1.5px] border-r-0 border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs sm:text-sm text-[#2F3E4E] dark:text-slate-100 placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#F9C80E] disabled:opacity-60"
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    aria-busy={isSubmitting}
                    className="px-4 sm:px-5 h-10 rounded-r-lg border-[1.5px] border-[#2F3E4E] dark:border-[#F9C80E] bg-[#2F3E4E] dark:bg-[#F9C80E] hover:bg-[#1E293B] dark:hover:bg-[#FDE047] text-[#FFFDF5] dark:text-[#0F172A] font-display font-bold text-xs sm:text-sm transition-colors cursor-pointer shrink-0 whitespace-nowrap disabled:opacity-65 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5"
                  >
                    {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden="true" />}
                    <span>{isSubmitting ? 'Subscribing...' : 'Subscribe'}</span>
                  </button>
                </form>
              )}

              {emailError && (
                <p className="text-[11px] font-semibold text-rose-700 dark:text-rose-400" role="alert">
                  {emailError}
                </p>
              )}

              {statusMessage && !emailError && !savedEmail && (
                <p className="text-[11px] font-medium text-[#12805C] dark:text-emerald-400" role="status">
                  {statusMessage}
                </p>
              )}

              <p className="text-[11px] leading-relaxed text-[#64748B] dark:text-slate-400">
                Receive occasional release notes on new bank slip formats, GST reconciler rules, and
                annual tax updates. No spam.
              </p>
            </div>
          </div>

          {/* SECTION 2: Structured 4-Column Navigation & Connect Grid */}
          <div className="px-5 sm:px-9 lg:px-12 py-8 border-b border-[#2F3E4E]/15 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-x-6 gap-y-8">
            {/* Column 1: Tool Suites */}
            <div className="lg:col-span-4 space-y-3">
              <h2 className="font-display font-bold text-sm text-[#2F3E4E] dark:text-slate-100">Tool Suites</h2>
              <ul className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
                {TOOL_DIRECTORY_LINKS.map((item) => (
                  <li key={item.label} className="min-w-0">
                    <button
                      type="button"
                      onClick={() => onOpenAllTools(item.filter)}
                      className="text-left text-[#475569] dark:text-slate-300 hover:text-[#2F3E4E] dark:hover:text-[#F9C80E] hover:underline underline-offset-4 transition-colors py-1 min-h-[36px] sm:min-h-0 cursor-pointer leading-snug"
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 2: Information */}
            <div className="lg:col-span-2 space-y-3">
              <h2 className="font-display font-bold text-sm text-[#2F3E4E] dark:text-slate-100">Information</h2>
              <ul className="space-y-1.5 text-[13px]">
                {INFORMATION_LINKS.map((item) => (
                  <li key={item.slug} className="min-w-0">
                    <a
                      href={`/${item.slug}`}
                      onClick={(e) => {
                        e.preventDefault();
                        onOpenLegalPage(item.slug);
                      }}
                      className="text-[#475569] dark:text-slate-300 hover:text-[#2F3E4E] dark:hover:text-[#F9C80E] hover:underline underline-offset-4 transition-colors inline-flex items-center py-0.5 min-h-[36px] sm:min-h-0 leading-snug"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
                {onOpenBlog && (
                  <li className="min-w-0">
                    <a
                      href="/blog"
                      onClick={(e) => {
                        e.preventDefault();
                        onOpenBlog();
                      }}
                      className="text-[#475569] dark:text-slate-300 hover:text-[#2F3E4E] dark:hover:text-[#F9C80E] hover:underline underline-offset-4 transition-colors inline-flex items-center py-0.5 min-h-[36px] sm:min-h-0 leading-snug"
                    >
                      Blog &amp; Guides
                    </a>
                  </li>
                )}
                {onOpenSitemap && (
                  <li className="min-w-0">
                    <a
                      href="/sitemap"
                      onClick={(e) => {
                        e.preventDefault();
                        onOpenSitemap();
                      }}
                      className="text-[#475569] dark:text-slate-300 hover:text-[#2F3E4E] dark:hover:text-[#F9C80E] hover:underline underline-offset-4 transition-colors inline-flex items-center py-0.5 min-h-[36px] sm:min-h-0 leading-snug"
                    >
                      HTML Sitemap
                    </a>
                  </li>
                )}
                <li className="min-w-0">
                  <a
                    href="/sitemap.xml"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#475569] dark:text-slate-300 hover:text-[#2F3E4E] dark:hover:text-[#F9C80E] hover:underline underline-offset-4 transition-colors inline-flex items-center py-0.5 min-h-[36px] sm:min-h-0 leading-snug"
                  >
                    XML Sitemap
                  </a>
                </li>
                {(onOpenErrorPage || onOpenNotFound) && (
                  <li className="min-w-0 pt-0.5 space-y-1.5">
                    <a
                      href="/404"
                      onClick={(e) => {
                        e.preventDefault();
                        if (onOpenErrorPage) {
                          onOpenErrorPage(404);
                        } else {
                          onOpenNotFound?.();
                        }
                      }}
                      className="text-[#475569] dark:text-slate-300 hover:text-[#2F3E4E] dark:hover:text-[#F9C80E] hover:underline underline-offset-4 transition-colors inline-flex items-center py-0.5 min-h-[36px] sm:min-h-0 leading-snug"
                    >
                      Error Pages Preview
                    </a>
                    {onOpenErrorPage && (
                      <div className="flex flex-wrap gap-1" aria-label="Error status previews">
                        {([403, 404, 500, 503] as HttpErrorCode[]).map((code) => (
                          <a
                            key={code}
                            href={`/${code}`}
                            onClick={(e) => {
                              e.preventDefault();
                              onOpenErrorPage(code);
                            }}
                            title={`Preview HTTP ${code} Error Page`}
                            className="px-1.5 py-0.5 rounded bg-[#FEF2C8]/80 dark:bg-slate-800 hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] text-[#2F3E4E] dark:text-slate-200 dark:hover:text-[#0F172A] border border-[#2F3E4E]/25 dark:border-slate-600 font-mono text-[10px] font-bold transition-colors"
                          >
                            {code}
                          </a>
                        ))}
                      </div>
                    )}
                  </li>
                )}
              </ul>
            </div>

            {/* Column 3: Legal & Policies */}
            <div className="lg:col-span-3 space-y-3">
              <h2 className="font-display font-bold text-sm text-[#2F3E4E] dark:text-slate-100">Legal &amp; Trust</h2>
              <ul className="space-y-1.5 text-[13px]">
                {LEGAL_LINKS.map((item) => (
                  <li key={item.slug} className="min-w-0">
                    <a
                      href={`/${item.slug}`}
                      onClick={(e) => {
                        e.preventDefault();
                        onOpenLegalPage(item.slug);
                      }}
                      className="text-[#475569] dark:text-slate-300 hover:text-[#2F3E4E] dark:hover:text-[#F9C80E] hover:underline underline-offset-4 transition-colors inline-flex items-center py-0.5 min-h-[36px] sm:min-h-0 leading-snug"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
                <li className="pt-1">
                  <button
                    type="button"
                    onClick={onOpenPrivacyBanner}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2F3E4E] dark:text-slate-200 hover:text-[#12805C] dark:hover:text-emerald-400 underline underline-offset-4 cursor-pointer py-1"
                  >
                    <Cookie className="w-3.5 h-3.5 text-[#C85A32] dark:text-amber-400" aria-hidden="true" />
                    <span>Cookie Preferences</span>
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 4: Connect With Us */}
            <div className="lg:col-span-3 space-y-3">
              <h2 className="font-display font-bold text-sm text-[#2F3E4E] dark:text-slate-100">Connect With Us</h2>
              <div className="space-y-1.5 text-[13px] text-[#475569] dark:text-slate-300">
                <a
                  href={`mailto:${SITE_CONTACT.developerEmail}`}
                  className="block hover:text-[#2F3E4E] dark:hover:text-[#F9C80E] hover:underline underline-offset-4 transition-colors break-all"
                >
                  <strong className="font-semibold text-[#2F3E4E] dark:text-slate-100">Arjun:</strong>{' '}
                  {SITE_CONTACT.developerEmail}
                </a>
                <a
                  href={`mailto:${SITE_CONTACT.ideationEmail}`}
                  className="block hover:text-[#2F3E4E] dark:hover:text-[#F9C80E] hover:underline underline-offset-4 transition-colors break-all"
                >
                  <strong className="font-semibold text-[#2F3E4E] dark:text-slate-100">Kaushik:</strong>{' '}
                  {SITE_CONTACT.ideationEmail}
                </a>
                <a
                  href={SITE_CONTACT.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block font-mono text-xs font-semibold text-[#2F3E4E] dark:text-slate-100 hover:underline underline-offset-4 pt-0.5"
                >
                  WhatsApp: {SITE_CONTACT.whatsappDisplay}
                </a>
                <p className="flex items-center gap-1.5 text-xs text-[#64748B] dark:text-slate-400 pt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-[#C85A32] dark:text-amber-400 shrink-0" aria-hidden="true" />
                  <span>{SITE_CONTACT.location}</span>
                </p>
              </div>

              {/* Circular Action Icons Row */}
              <div className="flex flex-wrap items-center gap-2.5 pt-2">
                <a
                  href={SITE_CONTACT.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Chat on WhatsApp"
                  aria-label="Chat on WhatsApp"
                  className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border-[1.5px] border-[#2F3E4E]/25 dark:border-slate-600 hover:border-[#2F3E4E] hover:bg-[#CEE5DC] dark:hover:bg-emerald-900 flex items-center justify-center shadow-[0_2px_0_rgba(47,62,78,0.12)] transition-all hover:-translate-y-0.5"
                >
                  <WhatsAppIcon variant="branded" className="w-4 h-4" />
                </a>

                <a
                  href={`mailto:${SITE_CONTACT.developerEmail}`}
                  title={`Email Arjun Bangera (${SITE_CONTACT.developerEmail})`}
                  aria-label="Email Arjun Bangera"
                  className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border-[1.5px] border-[#2F3E4E]/25 dark:border-slate-600 hover:border-[#2F3E4E] hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] text-[#2F3E4E] dark:text-slate-200 dark:hover:text-[#0F172A] flex items-center justify-center shadow-[0_2px_0_rgba(47,62,78,0.12)] transition-all hover:-translate-y-0.5"
                >
                  <Mail className="w-4 h-4" />
                </a>

                <a
                  href="https://bharathtools.vercel.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open BharathTools Master Hub"
                  aria-label="Open BharathTools Master Hub"
                  className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border-[1.5px] border-[#2F3E4E]/25 dark:border-slate-600 hover:border-[#2F3E4E] hover:bg-[#FFE1B3] dark:hover:bg-amber-900 text-[#2F3E4E] dark:text-slate-200 flex items-center justify-center shadow-[0_2px_0_rgba(47,62,78,0.12)] transition-all hover:-translate-y-0.5"
                >
                  <Layers className="w-4 h-4" />
                </a>

                <button
                  type="button"
                  onClick={onOpenPrivacyBanner}
                  title="Manage Browser Storage & Cookie Settings"
                  aria-label="Manage Cookie Settings"
                  className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border-[1.5px] border-[#2F3E4E]/25 dark:border-slate-600 hover:border-[#2F3E4E] hover:bg-[#FEF2C8] dark:hover:bg-slate-700 text-[#2F3E4E] dark:text-slate-200 flex items-center justify-center shadow-[0_2px_0_rgba(47,62,78,0.12)] transition-all hover:-translate-y-0.5 cursor-pointer"
                >
                  <Cookie className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* SECTION 3: Centered Copyright, Credits, Version Metadata & Independent Notice */}
          <div className="px-5 sm:px-9 lg:px-12 pt-6 pb-7 sm:pb-8 text-center space-y-3">
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-[#64748B] dark:text-slate-400">
              <span className="font-semibold text-[#2F3E4E] dark:text-slate-100">
                © {new Date().getFullYear()} VCPL Tools. All rights reserved.
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Engineered by{' '}
                <a
                  href={`mailto:${SITE_CONTACT.developerEmail}`}
                  className="group relative inline-block font-extrabold pb-1.5 transition-transform duration-300 hover:-translate-y-0.5"
                >
                  <span className="author-name-arjun">Arjun Bangera</span>
                  <svg
                    viewBox="0 0 100 16"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                    className="pointer-events-none absolute left-0 -bottom-0.5 w-full h-[10px] overflow-visible"
                  >
                    <path
                      d="M 2 9.5 Q 50 1.5 98 7.5"
                      fill="none"
                      stroke="#F59E0B"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      pathLength="100"
                      className="author-underline-stroke author-stroke-1"
                    />
                    <path
                      d="M 19 11 Q 48 5 77 9.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.9"
                      strokeLinecap="round"
                      pathLength="100"
                      className="author-underline-stroke author-stroke-2 text-[#2F3E4E] dark:text-slate-300"
                    />
                    <path
                      d="M 28 13.8 Q 43 10.6 58 12.6"
                      fill="none"
                      stroke="#F9C80E"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      pathLength="100"
                      className="author-underline-stroke author-stroke-3"
                    />
                  </svg>
                </a>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Architecture by{' '}
                <a
                  href={`mailto:${SITE_CONTACT.ideationEmail}`}
                  className="group relative inline-block font-extrabold pb-1.5 transition-transform duration-300 hover:-translate-y-0.5"
                >
                  <span className="author-name-kaushik">Kaushik Bangera</span>
                  <svg
                    viewBox="0 0 100 16"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                    className="pointer-events-none absolute left-0 -bottom-0.5 w-full h-[10px] overflow-visible"
                  >
                    <path
                      d="M 2 9.5 Q 50 1.5 98 7.5"
                      fill="none"
                      stroke="#12805C"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      pathLength="100"
                      className="author-underline-stroke author-stroke-1 author-stroke-delayed"
                    />
                    <path
                      d="M 19 11 Q 48 5 77 9.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.9"
                      strokeLinecap="round"
                      pathLength="100"
                      className="author-underline-stroke author-stroke-2 author-stroke-delayed text-[#2F3E4E] dark:text-slate-300"
                    />
                    <path
                      d="M 28 13.8 Q 43 10.6 58 12.6"
                      fill="none"
                      stroke="#5D8AA8"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      pathLength="100"
                      className="author-underline-stroke author-stroke-3 author-stroke-delayed"
                    />
                  </svg>
                </a>
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1.5 font-medium text-[#2F3E4E] dark:text-slate-200">
                <span>Made with</span>
                <svg
                  className="w-3.5 h-3.5 text-[#FF2D55] animate-heartbeat inline-block shrink-0"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  role="img"
                  aria-label="love"
                >
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
                <span>in Mangalore, India</span>
                <TulunaduFlagIcon showMast size="md" className="ml-0.5 -translate-y-[1px]" />
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-2 text-[11px] font-mono tabular-nums text-[#64748B] dark:text-slate-400">
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#181B1F] border border-[#363D45] shadow-[0_1px_2px_rgba(0,0,0,0.2)] font-display font-black text-[11px] tracking-wider uppercase text-white whitespace-nowrap">
                <span className="inline-flex items-center gap-1.5" aria-hidden="true">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FF9933] bharat-dot bharat-dot-saffron" />
                  <span className="w-2.5 h-2.5 rounded-full bg-white bharat-dot bharat-dot-white" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#138808] bharat-dot bharat-dot-green" />
                </span>
                <span>BHARAT MADE</span>
              </span>
              <span
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#181B1F] border border-[#5A1818] shadow-[0_1px_2px_rgba(0,0,0,0.2)] font-display font-black text-[11px] tracking-wider uppercase text-white whitespace-nowrap"
                title="Rooted in Tulunadu — Mangalore, India"
              >
                <TulunaduFlagIcon size="sm" />
                <span>TULUNADU</span>
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-[#2F3E4E] dark:text-[#F9C80E]">
                Launched on 19.11.2026
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#CEE5DC]/75 dark:bg-emerald-950/60 border border-[#12805C]/30 dark:border-emerald-500/35 text-[#12805C] dark:text-emerald-300 font-semibold whitespace-nowrap">
                {launchCounterLabel}
              </span>
              {activeTool && activeToolStamp ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#F9C80E]/30 dark:bg-amber-950/50 border border-[#2F3E4E]/30 dark:border-amber-500/40 text-[#2F3E4E] dark:text-[#F9C80E] font-semibold whitespace-nowrap"
                    title={`${activeTool.title} (${activeTool.code}) last updated at ${activeToolStamp.lastUpdatedIso}`}
                  >
                    <Clock className="w-3 h-3 shrink-0 text-[#B45309] dark:text-[#F9C80E]" aria-hidden="true" />
                    <span>{activeTool.code} Updated:</span>
                    <time dateTime={activeToolStamp.lastUpdatedIso}>
                      {activeToolStamp.lastUpdatedDateIst} · {activeToolStamp.lastUpdatedTimeIst}
                    </time>
                    <span className="text-[10px] opacity-80">
                      ({activeToolStamp.version} · #{activeToolStamp.hash})
                    </span>
                  </span>
                </>
              ) : null}
              <span aria-hidden="true">·</span>
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#FEF2C8]/90 dark:bg-slate-800 border border-[#2F3E4E]/20 dark:border-slate-600 text-[#2F3E4E] dark:text-[#F9C80E] font-semibold whitespace-nowrap"
                title={`Suite last updated: ${vcplBuildMeta.lastUpdatedIso} (${vcplBuildMeta.toolCount} tools)`}
              >
                <Clock className="w-3 h-3 shrink-0 text-[#B45309] dark:text-[#F9C80E]" aria-hidden="true" />
                <span>Suite Updated:</span>
                <time dateTime={vcplBuildMeta.lastUpdatedIso}>
                  {vcplBuildMeta.lastUpdatedDateIst} · {vcplBuildMeta.lastUpdatedTimeIst}
                </time>
              </span>
              <span aria-hidden="true">·</span>
              <span
                className="inline-flex items-center gap-1 font-semibold text-[#2F3E4E] dark:text-slate-200 whitespace-nowrap"
                title={`Auto-versioned from tool count (${vcplBuildMeta.toolCount} tools) & latest build ${vcplBuildMeta.buildHash}`}
              >
                <span>Stable {vcplBuildMeta.stableVersion}</span>
                <span className="text-[10px] font-mono text-[#64748B] dark:text-slate-400">
                  (#{vcplBuildMeta.buildHash})
                </span>
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-[#2F3E4E] dark:text-slate-200">
                Next-Gen {vcplBuildMeta.nextGenVersion} (Enterprise Compliance &amp; Office Suite)
              </span>
            </div>

            <p className="max-w-4xl mx-auto px-4 py-2.5 rounded-xl bg-[#FAF5E4]/80 dark:bg-slate-800/60 border border-[#2F3E4E]/10 dark:border-slate-700/80 text-[11px] leading-relaxed text-[#475569] dark:text-slate-300">
              <strong className="text-[#2F3E4E] dark:text-slate-100">Independent Financial &amp; Compliance Utility Notice:</strong>{' '}
              VCPL Tools is an independent, 100% browser-based productivity workspace built for Indian
              banking documentation, GST reconciliation, and direct tax computation. It is not
              affiliated with, endorsed by, or connected to the State Bank of India (SBI), HDFC Bank,
              the Income Tax Department of India, the Goods and Services Tax Network (GSTN), or any
              government transport authority. All generated bank deposit slips, Form 26AS &amp; GSTR-2B
              reconciliations, TDS/TCS computations, and income tax estimates are standardized preparation
              templates—users must independently verify all statutory figures, challans, and beneficiary
              details prior to official filing or banking submission.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
