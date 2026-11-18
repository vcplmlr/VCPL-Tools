import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Cookie,
  ExternalLink,
  Laptop,
  Layers,
  Mail,
  MapPin,
  ShieldCheck,
} from 'lucide-react';
import { vcplBuildMeta } from 'virtual:vcpl-build-meta';
import { LegalPageSlug, SITE_CONTACT } from '../data/legalPagesData';
import { ToolCatalogItem, ToolFilterType } from '../types/tools';
import { MangaloreSkylineSvg } from './MangaloreSkylineSvg';
import { VcplBrandLogo } from './VcplBrandLogo';
import { WhatsAppIcon } from './WhatsAppIcon';

interface FooterProps {
  activeTool?: ToolCatalogItem | null;
  onHomeClick: () => void;
  onOpenAllTools: (filter?: ToolFilterType) => void;
  onOpenLegalPage: (slug: LegalPageSlug) => void;
  onOpenPrivacyBanner: () => void;
  onOpenNotFound?: () => void;
  onOpenSitemap?: () => void;
}

const NEWSLETTER_STORAGE_KEY = 'vcpl_release_updates_email';

const TOOL_DIRECTORY_LINKS: { label: string; filter: ToolFilterType }[] = [
  { label: 'All Tools', filter: 'All' },
  { label: 'Banking & Deposit Slips', filter: 'Banking' },
  { label: 'Tax & GST Utilities', filter: 'Tax & GST' },
  { label: 'GST Utilities & GSTR-1', filter: 'GST Utilities' },
  { label: 'PDF & Document Tools', filter: 'PDF Suite' },
  { label: 'Image Editing Studio', filter: 'Image Studio' },
  { label: 'Calculator Hub', filter: 'Calculator' },
  { label: 'Typing & Text', filter: 'Typing & Text' },
  { label: 'QR & Daily Utilities', filter: 'Utilities' },
  { label: 'VCPL Enterprise Tools', filter: 'VCPL' },
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
  onOpenLegalPage,
  onOpenPrivacyBanner,
  onOpenNotFound,
  onOpenSitemap,
}: FooterProps) {
  const activeToolStamp = activeTool
    ? vcplBuildMeta.toolMetaByKind?.[activeTool.kind] ?? null
    : null;
  const [savedEmail, setSavedEmail] = useState<string>(readSavedSubscriber);
  const [emailInput, setEmailInput] = useState<string>('');
  const [emailError, setEmailError] = useState<string>('');
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

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = emailInput.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleaned)) {
      setEmailError('Please enter a valid email address.');
      return;
    }
    try {
      window.localStorage.setItem(NEWSLETTER_STORAGE_KEY, cleaned);
    } catch {
      // Ignore storage quota errors
    }
    setSavedEmail(cleaned);
    setEmailInput('');
    setEmailError('');
  };

  const handleUnsubscribe = () => {
    try {
      window.localStorage.removeItem(NEWSLETTER_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
    setSavedEmail('');
    setEmailError('');
  };

  return (
    <footer
      className="w-full bg-[#2F3E4E] dark:bg-[#060A13] text-[#E2E8F0] border-t-2 border-[#1E293B] dark:border-slate-800 no-print"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Signature VCPL Marigold Top Strip */}
      <div className="w-full h-1.5 bg-[#F9C80E] border-b border-[#1E293B]" aria-hidden="true" />

      {/* Outer Framed Container */}
      <div className="max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-8 pt-6 sm:pt-8 lg:pt-10 pb-24 sm:pb-20 lg:pb-10">
        {/* Framed Editorial Paper Sheet */}
        <div className="bg-[#FFFDF5] dark:bg-[#111827] text-[#2F3E4E] dark:text-[#E2E8F0] rounded-2xl border-[1.5px] border-[#1A242F] dark:border-slate-700 shadow-[0_6px_0_#1A242F] dark:shadow-[0_6px_0_#020617] overflow-hidden">
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

              <div className="flex flex-wrap sm:flex-nowrap items-center gap-x-3.5 gap-y-2 pt-0.5 text-xs">
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
            <div className="w-full lg:w-[390px] shrink-0 space-y-2">
              <h2 className="font-display font-bold text-sm text-[#2F3E4E] dark:text-slate-100">
                Tool Updates &amp; Release Notes
              </h2>

              {savedEmail ? (
                <div className="flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-lg bg-[#CEE5DC]/65 dark:bg-emerald-950/60 border-[1.5px] border-[#2F3E4E] dark:border-emerald-500/40 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 className="w-4 h-4 text-[#12805C] dark:text-emerald-400 shrink-0" aria-hidden="true" />
                    <span className="truncate font-semibold text-[#2F3E4E] dark:text-slate-100">
                      Saved locally: {savedEmail}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleUnsubscribe}
                    className="text-[11px] font-bold text-[#2F3E4E] dark:text-slate-200 underline hover:text-rose-700 dark:hover:text-rose-400 cursor-pointer shrink-0"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubscribe} className="flex items-stretch">
                  <label htmlFor="vcpl-footer-updates-email" className="sr-only">
                    Email address for tool updates
                  </label>
                  <input
                    id="vcpl-footer-updates-email"
                    type="email"
                    value={emailInput}
                    onChange={(e) => {
                      setEmailInput(e.target.value);
                      if (emailError) setEmailError('');
                    }}
                    placeholder="Enter your email address"
                    className="flex-1 min-w-0 h-10 px-3.5 rounded-l-lg border-[1.5px] border-r-0 border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs sm:text-sm text-[#2F3E4E] dark:text-slate-100 placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#F9C80E]"
                  />
                  <button
                    type="submit"
                    className="px-4 sm:px-5 h-10 rounded-r-lg border-[1.5px] border-[#2F3E4E] dark:border-[#F9C80E] bg-[#2F3E4E] dark:bg-[#F9C80E] hover:bg-[#1E293B] dark:hover:bg-[#FDE047] text-[#FFFDF5] dark:text-[#0F172A] font-display font-bold text-xs sm:text-sm transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                  >
                    Subscribe
                  </button>
                </form>
              )}

              {emailError && (
                <p className="text-[11px] font-semibold text-rose-700 dark:text-rose-400">{emailError}</p>
              )}

              <p className="text-[11px] leading-relaxed text-[#64748B] dark:text-slate-400">
                Stay updated on new SBI/HDFC slip templates, GST reconciler rules, and FY tax
                releases—stored privately in your browser.
              </p>
            </div>
          </div>

          {/* SECTION 2: Structured 4-Column Navigation & Connect Grid */}
          <div className="px-5 sm:px-9 lg:px-12 py-8 border-b border-[#2F3E4E]/15 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-x-6 gap-y-8">
            {/* Column 1: Tool Suites */}
            <div className="lg:col-span-4 space-y-3">
              <h2 className="font-display font-bold text-sm text-[#2F3E4E] dark:text-slate-100">Tool Suites</h2>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
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
                {onOpenNotFound && (
                  <li className="min-w-0">
                    <a
                      href="/404"
                      onClick={(e) => {
                        e.preventDefault();
                        onOpenNotFound();
                      }}
                      className="text-[#475569] dark:text-slate-300 hover:text-[#2F3E4E] dark:hover:text-[#F9C80E] hover:underline underline-offset-4 transition-colors inline-flex items-center py-0.5 min-h-[36px] sm:min-h-0 leading-snug"
                    >
                      404 Page Preview
                    </a>
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
          <div className="px-5 sm:px-9 lg:px-12 pt-6 pb-2 text-center space-y-3">
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
              <span className="inline-flex items-center gap-1 font-medium text-[#2F3E4E] dark:text-slate-200">
                Made with
                <svg
                  className="w-3.5 h-3.5 text-[#FF2D55] animate-heartbeat inline-block shrink-0"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  role="img"
                  aria-label="love"
                >
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
                in Mangalore, India
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

            <p className="max-w-4xl mx-auto px-4 py-2.5 rounded-xl bg-[#FEF2C8]/65 dark:bg-slate-800/75 border border-[#2F3E4E]/15 dark:border-slate-700 text-[11px] leading-relaxed text-[#475569] dark:text-slate-300">
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

          {/* SECTION 4: Architectural Mangalore Skyline Illustration Flush at Footer Base */}
          <div className="w-full pt-2 leading-none">
            <MangaloreSkylineSvg />
          </div>
        </div>
      </div>
    </footer>
  );
}
