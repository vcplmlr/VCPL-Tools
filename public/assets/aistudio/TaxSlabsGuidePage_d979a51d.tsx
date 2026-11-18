import React from 'react';
import { ArrowRight, Calculator, ChevronRight } from 'lucide-react';
import { AdPlacement } from '../components/AdPlacement';
import { TaxGuideArticle } from '../components/TaxGuideArticle';
import { SITE_CONFIG, type AppRoute } from '../data/siteConfig';
import type { CookieConsentState } from '../engine/cookieConsent';

interface TaxSlabsGuidePageProps {
  cookieConsent?: CookieConsentState;
  onOpenCookieSettings?: () => void;
  onNavigate: (route: AppRoute) => void;
}

export const TaxSlabsGuidePage: React.FC<TaxSlabsGuidePageProps> = ({
  cookieConsent,
  onOpenCookieSettings,
  onNavigate,
}) => {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="no-print flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('/');
          }}
          className="hover:text-orange-700 dark:hover:text-orange-400"
        >
          Home
        </a>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-semibold text-slate-800 dark:text-slate-200">
          Tax Slabs &amp; Regime Guide
        </span>
      </nav>

      {/* Top Quick CTA Banner */}
      <div className="tactile-card flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-5 dark:bg-slate-800">
        <div className="max-w-2xl space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-orange-700 dark:text-orange-400">
            {SITE_CONFIG.financialYear} &middot; {SITE_CONFIG.assessmentYear} Statutory Guide
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-800 sm:text-2xl dark:text-white">
            Income Tax Slabs FY 2026-27 &amp; Complete Salaried Tax Guide
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('/income-tax-calculator')}
            className="tactile-btn inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-orange-700"
          >
            <Calculator className="h-3.5 w-3.5" />
            Open Tax Calculator
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/break-even-tax-planner')}
            className="inline-flex items-center gap-1.5 rounded-xl border-[1.5px] border-slate-700 bg-[#FAF9F5] px-4 py-2 text-xs font-bold text-slate-800 hover:bg-orange-50 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
          >
            Break-Even Planner
            <ArrowRight className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
          </button>
        </div>
      </div>

      {/* Top Leaderboard Ad Slot */}
      <AdPlacement
        slotId="guide-top-banner"
        variant="leaderboard"
        consent={cookieConsent}
        onAdvertiseClick={() => onNavigate('/contact-us')}
        onManageCookiePrefs={onOpenCookieSettings}
      />

      {/* Editorial Grid + Sticky Sidebar Ad */}
      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        <div className="lg:col-span-8">
          <TaxGuideArticle onJumpToCalculator={() => onNavigate('/income-tax-calculator')} />
        </div>

        <aside className="no-print space-y-5 lg:sticky lg:top-24 lg:col-span-4">
          <AdPlacement
            slotId="guide-sidebar-rect"
            variant="sidebar"
            consent={cookieConsent}
            onAdvertiseClick={() => onNavigate('/contact-us')}
            onManageCookiePrefs={onOpenCookieSettings}
          />

          <div className="tactile-card rounded-2xl bg-white p-5 dark:bg-slate-800">
            <div className="text-[11px] font-bold uppercase tracking-wider text-orange-700 dark:text-orange-400">
              Quick Action
            </div>
            <h2 className="mt-1 text-base font-extrabold text-slate-800 dark:text-white">
              Compare Your Exact Tax Now
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              Test your FY 2026-27 salary, HRA rent, 80C, NPS, and home loan interest side by side and export PDF or Excel working papers.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('/income-tax-calculator')}
              className="tactile-btn mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-xs font-extrabold text-white hover:bg-orange-700"
            >
              <Calculator className="h-4 w-4" />
              Launch Calculator
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
};
