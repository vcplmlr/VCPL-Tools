import { LEGAL_PAGE_LIST, LegalPageSlug, SITE_CONTACT } from '../data/legalPagesData';
import { TOOL_CATEGORIES } from '../data/toolsCatalog';
import { ToolFilterType } from '../types/tools';
import { VcplBrandLogo } from './VcplBrandLogo';

interface FooterProps {
  onSelectCategory: (filter: ToolFilterType) => void;
  onSelectLegalPage: (slug: LegalPageSlug) => void;
  onOpenSitemap: () => void;
  onOpenCookieSettings: () => void;
  onGoHome: () => void;
}

export function Footer({
  onSelectCategory,
  onSelectLegalPage,
  onOpenSitemap,
  onOpenCookieSettings,
  onGoHome,
}: FooterProps) {
  const infoPages = LEGAL_PAGE_LIST.filter((p) => p.group === 'information');
  const legalPages = LEGAL_PAGE_LIST.filter((p) => p.group === 'legal');

  return (
    <footer className="w-full bg-[#2F3E4E] dark:bg-[#060A13] text-[#FFFDF5] border-t-2 border-[#1E293B] dark:border-slate-800 no-print">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-10 md:py-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-8 border-b border-white/15">
          <div className="md:col-span-4 space-y-3">
            <button
              type="button"
              onClick={onGoHome}
              className="inline-flex items-center cursor-pointer"
              aria-label="VCPL Tools Home"
            >
              <VcplBrandLogo variant="footer" className="h-9" />
            </button>
            <p className="text-xs leading-relaxed text-[#CBD5E1] max-w-sm">
              {SITE_CONTACT.tagline}. Browser-based banking slips, GST &amp; tax reconcilers, PDF tools, image utilities, and NPCI UPI QR tools—running 100% locally in your browser.
            </p>
            <p className="text-[11px] text-[#94A3B8]">
              Designed by {SITE_CONTACT.developer} · Requirements &amp; Ideas by {SITE_CONTACT.ideation}
            </p>
          </div>

          <div className="md:col-span-4 space-y-2.5">
            <h2 className="font-display font-extrabold text-xs uppercase tracking-wider text-[#F9C80E]">
              Tool Suites
            </h2>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-[#E2E8F0]">
              {TOOL_CATEGORIES.map((cat) => (
                <li key={cat.id}>
                  <button
                    type="button"
                    onClick={() => onSelectCategory(cat.filterKey)}
                    className="hover:text-[#F9C80E] transition-colors text-left cursor-pointer"
                  >
                    {cat.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-2 space-y-2.5">
            <h2 className="font-display font-extrabold text-xs uppercase tracking-wider text-[#F9C80E]">
              Information
            </h2>
            <ul className="space-y-1.5 text-xs text-[#E2E8F0]">
              {infoPages.map((page) => (
                <li key={page.slug}>
                  <button
                    type="button"
                    onClick={() => onSelectLegalPage(page.slug)}
                    className="hover:text-[#F9C80E] transition-colors cursor-pointer"
                  >
                    {page.navTitle}
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={onOpenSitemap}
                  className="hover:text-[#F9C80E] transition-colors cursor-pointer"
                >
                  HTML &amp; XML Sitemap
                </button>
              </li>
            </ul>
          </div>

          <div className="md:col-span-2 space-y-2.5">
            <h2 className="font-display font-extrabold text-xs uppercase tracking-wider text-[#F9C80E]">
              Legal &amp; Privacy
            </h2>
            <ul className="space-y-1.5 text-xs text-[#E2E8F0]">
              {legalPages.map((page) => (
                <li key={page.slug}>
                  <button
                    type="button"
                    onClick={() => onSelectLegalPage(page.slug)}
                    className="hover:text-[#F9C80E] transition-colors cursor-pointer"
                  >
                    {page.navTitle}
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={onOpenCookieSettings}
                  className="hover:text-[#F9C80E] transition-colors cursor-pointer"
                >
                  Cookie Preferences
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[11px] text-[#94A3B8]">
          <p>
            © {new Date().getFullYear()} {SITE_CONTACT.brand} · {SITE_CONTACT.location}
          </p>
          <p>Zero Server File Uploads · 100% Client-Side Privacy</p>
        </div>
      </div>
    </footer>
  );
}
