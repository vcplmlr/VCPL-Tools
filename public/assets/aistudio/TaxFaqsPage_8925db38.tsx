import React, { useMemo, useState } from 'react';
import { ArrowRight, Calculator, ChevronRight } from 'lucide-react';
import { AdPlacement } from '../components/AdPlacement';
import { FaqAccordion } from '../components/FaqAccordion';
import { SITE_CONFIG, TAX_FAQS, type AppRoute, type FaqItem } from '../data/siteConfig';
import type { CookieConsentState } from '../engine/cookieConsent';

interface TaxFaqsPageProps {
  cookieConsent?: CookieConsentState;
  onOpenCookieSettings?: () => void;
  onNavigate: (route: AppRoute) => void;
}

type CategoryFilter = 'All' | FaqItem['category'];

const CATEGORIES: CategoryFilter[] = ['All', 'Regimes', 'Salary & HRA', 'Deductions', 'Filing & Tool'];

export const TaxFaqsPage: React.FC<TaxFaqsPageProps> = ({
  cookieConsent,
  onOpenCookieSettings,
  onNavigate,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('All');

  const filteredFaqs = useMemo(
    () =>
      selectedCategory === 'All'
        ? TAX_FAQS
        : TAX_FAQS.filter((item) => item.category === selectedCategory),
    [selectedCategory],
  );

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
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
          Salaried Tax FAQs
        </span>
      </nav>

      {/* Header */}
      <header className="space-y-3 border-b border-slate-200 pb-6 text-center dark:border-slate-800">
        <div className="text-xs font-bold uppercase tracking-wider text-orange-700 dark:text-orange-400">
          {SITE_CONFIG.financialYear} ({SITE_CONFIG.assessmentYear}) Knowledge Base
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-800 sm:text-4xl dark:text-white text-balance">
          Indian Salaried Income Tax FAQs
        </h1>
        <p className="mx-auto max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base dark:text-slate-300">
          Detailed answers on FY 2026-27 tax slabs, Section 87A ₹12L relief, HRA exemptions, NPS u/s 80CCD(2), EPF taxation, capital gains, and TDS adjustments.
        </p>

        {/* Category Filter Tabs */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-3">
          {CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setSelectedCategory(category)}
              className={`rounded-lg border-[1.5px] px-3.5 py-1.5 text-xs font-bold transition ${
                selectedCategory === category
                  ? 'border-slate-700 bg-orange-600 text-white shadow-[2px_2px_0px_#334155]'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-orange-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </header>

      {/* Accordion */}
      <FaqAccordion
        id="faqs-list"
        items={filteredFaqs}
        heading={`${selectedCategory === 'All' ? 'All 15' : filteredFaqs.length} Tax Questions Answered`}
        subheading="Click any question below to expand the complete statutory explanation."
      />

      {/* Mid/Bottom Ad Placement */}
      <AdPlacement
        slotId="faqs-bottom-banner"
        variant="leaderboard"
        consent={cookieConsent}
        onAdvertiseClick={() => onNavigate('/contact-us')}
        onManageCookiePrefs={onOpenCookieSettings}
      />

      {/* CTA Footer Strip */}
      <div className="tactile-card flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-6 dark:bg-slate-800">
        <div>
          <h2 className="text-base font-extrabold text-slate-800 dark:text-white">
            Ready to calculate your exact FY 2026-27 tax?
          </h2>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
            Test both regimes side by side or run a break-even deduction analysis privately in your browser.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('/income-tax-calculator')}
            className="tactile-btn inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-2.5 text-xs font-extrabold text-white hover:bg-orange-700"
          >
            <Calculator className="h-4 w-4" />
            Calculate Income Tax
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/break-even-tax-planner')}
            className="inline-flex items-center gap-1.5 rounded-xl border-[1.5px] border-slate-700 bg-[#FAF9F5] px-4 py-2.5 text-xs font-bold text-slate-800 hover:bg-orange-50 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
          >
            Break-Even Planner
            <ArrowRight className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
          </button>
        </div>
      </div>
    </div>
  );
};
