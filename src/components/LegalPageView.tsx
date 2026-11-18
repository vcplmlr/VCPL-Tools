import {
  ArrowLeft,
  Cookie,
  FileText,
  Mail,
  MapPin,
  ShieldCheck,
} from 'lucide-react';
import {
  LEGAL_PAGES,
  LEGAL_PAGE_LIST,
  LegalPageSlug,
  SITE_CONTACT,
} from '../data/legalPagesData';
import { AdSlot } from './AdSlot';
import { WhatsAppIcon } from './WhatsAppIcon';

interface LegalPageViewProps {
  slug: LegalPageSlug;
  onSelectPage: (slug: LegalPageSlug) => void;
  onBackHome: () => void;
  onOpenPrivacyBanner: () => void;
}

export function LegalPageView({
  slug,
  onSelectPage,
  onBackHome,
  onOpenPrivacyBanner,
}: LegalPageViewProps) {
  const page = LEGAL_PAGES[slug];
  const infoPages = LEGAL_PAGE_LIST.filter((p) => p.group === 'information');
  const legalPages = LEGAL_PAGE_LIST.filter((p) => p.group === 'legal');

  return (
    <section className="w-full bg-[#FEF2C8] dark:bg-[#0B1120] py-8 md:py-12 min-h-[calc(100dvh-140px)] transition-colors duration-200">
      <div className="max-w-[1320px] mx-auto pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6 space-y-6">
        {/* Top Breadcrumb Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs font-semibold text-[#334155] dark:text-slate-300">
            <button
              type="button"
              onClick={onBackHome}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-[#FFFDF5] dark:bg-[#131C2E] hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] dark:text-slate-100 dark:hover:text-[#0F172A] transition cursor-pointer whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Back to Home</span>
            </button>
            <span className="text-[#64748B] dark:text-slate-500" aria-hidden="true">
              /
            </span>
            <span className="font-mono text-[#475569] dark:text-slate-300">/{page.slug}</span>
          </div>

          <span className="text-xs font-semibold text-[#475569] dark:text-slate-400">
            {page.effectiveLabel}
          </span>
        </div>

        {/* Mobile/Tablet Quick Page Switcher */}
        <div className="lg:hidden flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {LEGAL_PAGE_LIST.map((item) => {
            const active = item.slug === slug;
            return (
              <a
                key={item.slug}
                href={`/${item.slug}`}
                onClick={(e) => {
                  e.preventDefault();
                  onSelectPage(item.slug);
                }}
                className={`px-3 py-2 min-h-[38px] inline-flex items-center rounded-lg text-xs font-bold border whitespace-nowrap shrink-0 transition-colors ${
                  active
                    ? 'bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#F9C80E] dark:text-[#0F172A] border-[#2F3E4E] dark:border-[#F9C80E]'
                    : 'bg-[#FFFDF5] dark:bg-[#131C2E] text-[#2F3E4E] dark:text-slate-200 border-[#2F3E4E]/25 dark:border-slate-700 hover:bg-[#F9C80E]/40 dark:hover:bg-slate-800'
                }`}
              >
                {item.navTitle}
              </a>
            );
          })}
        </div>

        {/* Two-Column Layout: Article First on Mobile/Tablet, Sticky Sidebar Left on Desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Sidebar Navigation Across Information & Legal Pages */}
          <aside className="order-2 lg:order-1 lg:col-span-3 space-y-4 lg:sticky lg:top-24">
            <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-4 shadow-[0_3px_0_#2F3E4E] dark:shadow-[0_3px_0_#020617] space-y-4">
              <div>
                <p className="text-[10px] font-display font-extrabold uppercase tracking-wider text-[#64748B] dark:text-slate-400 px-2 mb-2">
                  Information
                </p>
                <nav aria-label="Information Pages" className="space-y-1">
                  {infoPages.map((item) => {
                    const active = item.slug === slug;
                    return (
                      <a
                        key={item.slug}
                        href={`/${item.slug}`}
                        onClick={(e) => {
                          e.preventDefault();
                          onSelectPage(item.slug);
                        }}
                        className={`block px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                          active
                            ? 'bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#F9C80E] dark:text-[#0F172A]'
                            : 'text-[#2F3E4E] dark:text-slate-200 hover:bg-[#FEF2C8] dark:hover:bg-slate-800'
                        }`}
                      >
                        {item.navTitle}
                      </a>
                    );
                  })}
                </nav>
              </div>

              <div className="pt-3 border-t border-[#2F3E4E]/15 dark:border-slate-800">
                <p className="text-[10px] font-display font-extrabold uppercase tracking-wider text-[#64748B] dark:text-slate-400 px-2 mb-2">
                  Legal &amp; Compliance
                </p>
                <nav aria-label="Legal Pages" className="space-y-1">
                  {legalPages.map((item) => {
                    const active = item.slug === slug;
                    return (
                      <a
                        key={item.slug}
                        href={`/${item.slug}`}
                        onClick={(e) => {
                          e.preventDefault();
                          onSelectPage(item.slug);
                        }}
                        className={`block px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                          active
                            ? 'bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#F9C80E] dark:text-[#0F172A]'
                            : 'text-[#2F3E4E] dark:text-slate-200 hover:bg-[#FEF2C8] dark:hover:bg-slate-800'
                        }`}
                      >
                        {item.navTitle}
                      </a>
                    );
                  })}
                </nav>
              </div>
            </div>

            {/* Direct Developer Contact Card */}
            <div className="bg-[#CEE5DC] dark:bg-[#102B25] border-[1.5px] border-[#2F3E4E] dark:border-emerald-700/60 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-display font-extrabold text-[#2F3E4E] dark:text-emerald-200">
                <ShieldCheck className="w-4 h-4 text-[#12805C] dark:text-emerald-400" aria-hidden="true" />
                <span>Direct Support</span>
              </div>
              <p className="text-xs text-[#334155] dark:text-slate-200 leading-relaxed">
                Designed &amp; Developed by{' '}
                <a
                  href={`mailto:${SITE_CONTACT.developerEmail}`}
                  className="font-extrabold text-[#2F3E4E] dark:text-[#F9C80E] underline decoration-[#2F3E4E]/40 dark:decoration-[#F9C80E]/40 underline-offset-2 hover:text-[#1D4ED8] dark:hover:text-[#FDE047]"
                >
                  {SITE_CONTACT.developer}
                </a>{' '}
                · Ideas &amp; Tool Requirements Suggested by{' '}
                <a
                  href={`mailto:${SITE_CONTACT.ideationEmail}`}
                  className="font-extrabold text-[#2F3E4E] dark:text-[#F9C80E] underline decoration-[#2F3E4E]/40 dark:decoration-[#F9C80E]/40 underline-offset-2 hover:text-[#1D4ED8] dark:hover:text-[#FDE047]"
                >
                  {SITE_CONTACT.ideation}
                </a>{' '}
                ({SITE_CONTACT.location}).
              </p>
              <div className="space-y-2">
                <a
                  href={`mailto:${SITE_CONTACT.developerEmail}`}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 min-h-[40px] rounded-lg bg-[#FFFDF5] dark:bg-[#0B1120] hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] dark:border-slate-600 text-xs font-bold text-[#2F3E4E] dark:text-slate-100 dark:hover:text-[#0F172A] transition-colors break-all"
                >
                  <Mail className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{SITE_CONTACT.developerEmail}</span>
                </a>
                <a
                  href={`mailto:${SITE_CONTACT.ideationEmail}`}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 min-h-[40px] rounded-lg bg-[#FFFDF5] dark:bg-[#0B1120] hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] dark:border-slate-600 text-xs font-bold text-[#2F3E4E] dark:text-slate-100 dark:hover:text-[#0F172A] transition-colors break-all"
                >
                  <Mail className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{SITE_CONTACT.ideationEmail}</span>
                </a>
                <a
                  href={SITE_CONTACT.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 min-h-[40px] rounded-lg bg-[#2F3E4E] dark:bg-[#F9C80E] hover:bg-[#1E293B] dark:hover:bg-[#FDE047] border-[1.5px] border-[#2F3E4E] dark:border-[#F9C80E] text-xs font-bold text-[#F9C80E] dark:text-[#0F172A] transition-colors"
                >
                  <WhatsAppIcon variant="branded" className="w-4 h-4 shrink-0" />
                  <span>WhatsApp: {SITE_CONTACT.whatsappDisplay}</span>
                </a>
              </div>
            </div>

            {/* Vertical Sidebar Ad Unit */}
            <div className="hidden lg:block">
              <AdSlot
                slotId={`vcpl-legal-sidebar-${page.slug}`}
                variant="sidebar"
                label="300 × 250 / 300 × 600 Sidebar Option"
                contentContext={`${page.navTitle} · VCPL Privacy & Utility Suite`}
              />
            </div>
          </aside>

          {/* Main Policy / Information Document */}
          <article className="order-1 lg:order-2 lg:col-span-9 space-y-6">
            <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-6 sm:p-8 md:p-10 shadow-[0_5px_0_#2F3E4E] dark:shadow-[0_5px_0_#020617] space-y-7">
              {/* Document Header */}
              <header className="pb-6 border-b border-[#2F3E4E]/15 dark:border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#475569] dark:text-slate-400">
                  <FileText className="w-4 h-4 text-[#2F3E4E] dark:text-[#F9C80E]" aria-hidden="true" />
                  <span>{SITE_CONTACT.brand}</span>
                  <span aria-hidden="true">·</span>
                  <span>{page.effectiveLabel}</span>
                </div>

                <h1 className="font-display font-extrabold text-[clamp(1.75rem,3vw,2.4rem)] leading-tight text-[#2F3E4E] dark:text-slate-50 tracking-tight">
                  {page.title}
                </h1>
                <p className="text-sm sm:text-base text-[#475569] dark:text-slate-300 leading-relaxed max-w-3xl">
                  {page.subtitle}
                </p>

                {slug === 'cookie-policy' && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={onOpenPrivacyBanner}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#F9C80E] hover:bg-[#FFE1B3] border-[1.5px] border-[#2F3E4E] text-xs font-extrabold text-[#2F3E4E] transition-colors cursor-pointer"
                    >
                      <Cookie className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Open Cookie &amp; Storage Preferences</span>
                    </button>
                  </div>
                )}
              </header>

              {/* Document Sections */}
              <div className="space-y-6">
                {page.sections.map((section) => (
                  <section key={section.heading} className="space-y-2.5">
                    <h2 className="font-display font-extrabold text-lg sm:text-xl text-[#2F3E4E] dark:text-slate-100 tracking-tight">
                      {section.heading}
                    </h2>

                    {section.subheading && (
                      <h3 className="font-display font-bold text-sm text-[#334155] dark:text-slate-200">
                        {section.subheading}
                      </h3>
                    )}

                    {section.paragraphs?.map((para, pIdx) => (
                      <p
                        key={pIdx}
                        className="text-sm sm:text-[15px] leading-relaxed text-[#334155] dark:text-slate-300"
                      >
                        {para}
                      </p>
                    ))}

                    {section.bullets && (
                      <ul className="space-y-1.5 pl-5 list-disc text-sm sm:text-[15px] leading-relaxed text-[#334155] dark:text-slate-300 marker:text-[#2F3E4E] dark:marker:text-[#F9C80E]">
                        {section.bullets.map((bullet, bIdx) => (
                          <li key={bIdx}>{bullet}</li>
                        ))}
                      </ul>
                    )}

                    {section.numbered && (
                      <ol className="space-y-1.5 pl-5 list-decimal text-sm sm:text-[15px] leading-relaxed text-[#334155] dark:text-slate-300 marker:font-bold marker:text-[#2F3E4E] dark:marker:text-[#F9C80E]">
                        {section.numbered.map((item, nIdx) => (
                          <li key={nIdx}>{item}</li>
                        ))}
                      </ol>
                    )}
                  </section>
                ))}
              </div>

              {/* Document Footer Bar */}
              <footer className="pt-6 border-t border-[#2F3E4E]/15 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-[#475569] dark:text-slate-400">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#2F3E4E] dark:text-[#F9C80E] shrink-0" aria-hidden="true" />
                  <span>
                    {SITE_CONTACT.brand} · {SITE_CONTACT.location}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href={`mailto:${SITE_CONTACT.developerEmail}`}
                    className="font-bold text-[#2F3E4E] dark:text-slate-200 hover:underline break-all"
                  >
                    {SITE_CONTACT.developerEmail}
                  </a>
                  <span aria-hidden="true">·</span>
                  <a
                    href={`mailto:${SITE_CONTACT.ideationEmail}`}
                    className="font-bold text-[#2F3E4E] dark:text-slate-200 hover:underline break-all"
                  >
                    {SITE_CONTACT.ideationEmail}
                  </a>
                  <span aria-hidden="true">·</span>
                  <a
                    href={SITE_CONTACT.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-[#12805C] dark:text-emerald-400 hover:underline font-mono"
                  >
                    WhatsApp {SITE_CONTACT.whatsappDisplay}
                  </a>
                </div>
              </footer>
            </div>

            <AdSlot
              slotId={`vcpl-legal-${page.slug}`}
              variant="inline"
              label="Informational Page Contextual Ad"
              contentContext={`${page.navTitle} · Browser Privacy & Business Utilities`}
            />
          </article>
        </div>
      </div>
    </section>
  );
}
