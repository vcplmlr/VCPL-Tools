import { useState } from 'react';
import {
  ArrowUpRight,
  BookOpen,
  Compass,
  ExternalLink,
  Layers,
  Sparkles,
  X,
} from 'lucide-react';
import { AdSlotVariant, openCookiePreferences } from '../config/adsense';
import { TulunaduFlagIcon } from './TulunaduFlagIcon';

export type { AdSlotVariant };

export const TULU_SIRI_URL = 'https://tulusiri.vercel.app/';
export const BHARATH_TOOLS_URL = 'https://bharathtools.vercel.app/';

interface AdSlotProps {
  slotId: string;
  variant?: AdSlotVariant;
  label?: string;
  contentContext?: string;
  sizeTag?: string;
  showSponsorOption?: boolean;
  className?: string;
}

type PartnerBrand = 'tulusiri' | 'bharathtools';

interface PartnerCreative {
  brand: PartnerBrand;
  brandName: string;
  url: string;
  domain: string;
  badge: string;
  headline: string;
  subcopy: string;
  cta: string;
  highlight: string;
}

const TULU_SIRI_CREATIVES: Omit<PartnerCreative, 'brand' | 'brandName' | 'url' | 'domain'>[] = [
  {
    badge: 'Tulu Siri · Learn Tulu',
    headline: 'Tulu Siri — Now Tulu Learning Made Easy',
    subcopy:
      'Practice everyday spoken Tulu, greetings, numbers, and Mangalore phrases step by step right in your browser.',
    cta: 'Start Learning Tulu',
    highlight: 'Free · Interactive Lessons',
  },
  {
    badge: 'Spoken Tulu · Kudla & Udupi',
    headline: 'Speak Tulu with Confidence — Learn Free on Tulu Siri',
    subcopy:
      'Guided conversational phrases for markets, travel, family gatherings, and coastal Karnataka daily life.',
    cta: 'Explore Phrases',
    highlight: 'Beginner Friendly',
  },
  {
    badge: 'Tulu Script & Vocabulary',
    headline: 'Master Tulu Words & Phrases in Minutes a Day',
    subcopy:
      'Bite-sized vocabulary cards, pronunciation hints, and cultural notes built for fast, enjoyable learning.',
    cta: 'Open Tulu Siri',
    highlight: 'No Sign-Up Required',
  },
  {
    badge: 'Tulunadu Language Hub',
    headline: 'Tulu Learning Simplified — From First Greeting to Fluency',
    subcopy:
      'Discover how easy it is to read, understand, and speak Tulunadu’s living heritage language online.',
    cta: 'Visit Tulu Siri',
    highlight: 'Mobile & Desktop Ready',
  },
  {
    badge: 'Daily Practice · Tulu Siri',
    headline: 'Reconnect with Tulunadu Roots — Learn Tulu Effortlessly',
    subcopy:
      'Structured lessons covering verbs, polite expressions, proverbs, and authentic coastal dialogues.',
    cta: 'Try Free Lessons',
    highlight: 'Curated in Mangalore',
  },
  {
    badge: 'Tulu Siri · Interactive Guide',
    headline: 'New to Mangalore? Now Tulu Learning Is Simple & Fast',
    subcopy:
      'Pick up practical local Tulu phrases for everyday conversations, directions, and community events.',
    cta: 'Learn Tulu Now',
    highlight: 'tulusiri.vercel.app',
  },
];

const BHARATH_TOOLS_CREATIVES: Omit<PartnerCreative, 'brand' | 'brandName' | 'url' | 'domain'>[] = [
  {
    badge: 'Bharath Tools · Master Hub',
    headline: 'Bharath Tools — All-in-One Smart Web Utilities Hub',
    subcopy:
      'Access dozens of free browser utilities, daily converters, calculators, and office productivity apps in one master portal.',
    cta: 'Open Bharath Tools',
    highlight: 'Free · Master Hub',
  },
  {
    badge: 'Bharath Tools · Productivity',
    headline: 'Explore More Free Everyday Tools on Bharath Tools',
    subcopy:
      'Built for Indian students, creators, and office teams—instant online utilities with zero sign-up or heavy installs.',
    cta: 'Browse Bharath Tools',
    highlight: 'No Sign-Up Required',
  },
  {
    badge: 'Bharath Tools · India Suite',
    headline: 'Faster Daily Workflows with Bharath Tools Utilities',
    subcopy:
      'Switch seamlessly across text helpers, finance calculators, quick generators, and smart digital workflows online.',
    cta: 'Explore Master Hub',
    highlight: 'Mobile & Desktop Ready',
  },
  {
    badge: 'Bharath Tools · Cloudless Apps',
    headline: 'Need Extra Calculators & Converters? Visit Bharath Tools',
    subcopy:
      'Clean, fast-loading tools crafted for clarity, everyday speed, and effortless browser productivity.',
    cta: 'Launch Bharath Tools',
    highlight: '100% Browser Ready',
  },
  {
    badge: 'Bharath Tools · Directory',
    headline: 'Bharath Tools — Your Unified Portal for Useful Web Apps',
    subcopy:
      'Discover practical utilities across office, study, regional, and developer workflows—free and always accessible.',
    cta: 'Visit Bharath Tools',
    highlight: 'bharathtools.vercel.app',
  },
];

function hashSlotId(slotId: string): number {
  let hash = 0;
  for (let i = 0; i < slotId.length; i += 1) {
    hash = (hash * 31 + slotId.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function getSlotDefaultBrand(slotId: string): PartnerBrand {
  const id = slotId.toLowerCase();
  if (
    id.includes('billboard') ||
    id.includes('infeed-01') ||
    id.includes('directory-top') ||
    id.includes('directory-mid-suite') ||
    id.includes('workspace-mid') ||
    id.includes('inarticle') ||
    id.includes('legal-sidebar') ||
    id.includes('sitemap')
  ) {
    return 'bharathtools';
  }
  if (
    id.includes('infeed-strip') ||
    id.includes('directory-mid-group') ||
    id.includes('workspace-sidebar')
  ) {
    return 'tulusiri';
  }
  return hashSlotId(slotId) % 2 === 0 ? 'tulusiri' : 'bharathtools';
}

function getBrandCreative(brand: PartnerBrand, slotId: string, offset = 0): PartnerCreative {
  const seed = hashSlotId(slotId) + offset;
  if (brand === 'bharathtools') {
    const picked = BHARATH_TOOLS_CREATIVES[seed % BHARATH_TOOLS_CREATIVES.length];
    return {
      ...picked,
      brand: 'bharathtools',
      brandName: 'Bharath Tools',
      url: BHARATH_TOOLS_URL,
      domain: 'bharathtools.vercel.app',
    };
  }
  const picked = TULU_SIRI_CREATIVES[seed % TULU_SIRI_CREATIVES.length];
  return {
    ...picked,
    brand: 'tulusiri',
    brandName: 'Tulu Siri',
    url: TULU_SIRI_URL,
    domain: 'tulusiri.vercel.app',
  };
}

function BrandBadgeIcon({ brand, size = 'sm' }: { brand: PartnerBrand; size?: 'sm' | 'md' }) {
  if (brand === 'bharathtools') {
    return (
      <Layers
        className={`${size === 'md' ? 'w-5 h-5' : 'w-4 h-4'} text-[#12805C] dark:text-[#F9C80E] shrink-0`}
        aria-hidden="true"
      />
    );
  }
  return <TulunaduFlagIcon size={size} />;
}

export function AdSlot({
  slotId,
  variant = 'leaderboard',
  contentContext,
  className = '',
}: AdSlotProps) {
  const [anchorDismissed, setAnchorDismissed] = useState(false);
  const primaryBrand = getSlotDefaultBrand(slotId);
  const creative = getBrandCreative(primaryBrand, slotId);

  if (variant === 'anchor' && anchorDismissed) {
    return null;
  }

  /* 1. Dismissible Sticky Bottom Anchor Banner */
  if (variant === 'anchor') {
    const isBharath = creative.brand === 'bharathtools';
    return (
      <aside
        aria-label={`Sponsored ${creative.brandName} Placement`}
        data-ad-slot={slotId}
        data-ad-format="horizontal"
        data-ad-context={contentContext || creative.badge}
        className={`w-full no-print ${className}`}
      >
        <div
          className={`rounded-xl border-[1.5px] px-4 py-2.5 flex items-center justify-between gap-3 shadow-sm ${
            isBharath
              ? 'border-[#12805C]/35 dark:border-emerald-500/35 bg-gradient-to-r from-[#FFFDF7] via-[#ECF7F2] to-[#FFFDF7] dark:from-[#131C2E] dark:via-[#0E221D] dark:to-[#131C2E]'
              : 'border-[#7D0B0B]/30 dark:border-rose-500/35 bg-gradient-to-r from-[#FFFDF7] via-[#FEF5E4] to-[#FFFDF7] dark:from-[#131C2E] dark:via-[#1C1420] dark:to-[#131C2E]'
          }`}
        >
          <a
            href={creative.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-2.5 min-w-0 flex-1"
          >
            <BrandBadgeIcon brand={creative.brand} size="sm" />
            <span
              className={`text-[10px] font-mono font-bold uppercase tracking-wider shrink-0 ${
                isBharath
                  ? 'text-[#12805C] dark:text-emerald-300'
                  : 'text-[#7D0B0B] dark:text-[#F9C80E]'
              }`}
            >
              Ad · {creative.brandName}
            </span>
            <span
              className={`text-xs font-display font-bold text-[#2F3E4E] dark:text-slate-100 transition-colors truncate ${
                isBharath
                  ? 'group-hover:text-[#12805C] dark:group-hover:text-emerald-300'
                  : 'group-hover:text-[#7D0B0B] dark:group-hover:text-[#F9C80E]'
              }`}
            >
              {creative.headline}
            </span>
          </a>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={creative.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap transition-colors ${
                isBharath
                  ? 'bg-[#12805C] hover:bg-[#0D6648] dark:bg-[#F9C80E] dark:hover:bg-[#FDE047] text-white dark:text-[#0F172A]'
                  : 'bg-[#7D0B0B] hover:bg-[#5E0808] dark:bg-[#F9C80E] dark:hover:bg-[#FDE047] text-white dark:text-[#0F172A]'
              }`}
            >
              <span>{creative.cta}</span>
              <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
            </a>
            <button
              type="button"
              onClick={openCookiePreferences}
              className="hidden sm:inline text-[11px] font-semibold text-[#64748B] dark:text-slate-400 hover:text-[#2F3E4E] dark:hover:text-[#F9C80E] underline underline-offset-2 cursor-pointer"
            >
              Ad Choices
            </button>
            <button
              type="button"
              onClick={() => setAnchorDismissed(true)}
              aria-label="Dismiss advertisement"
              className="p-1 rounded hover:bg-[#FEF2C8] dark:hover:bg-slate-800 text-[#64748B] dark:text-slate-400 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>
    );
  }

  /* 2. Dual Side-by-Side Mixed Partner Ad Cards (Tulu Siri + Bharath Tools) */
  if (variant === 'dual') {
    const flipOrder = hashSlotId(slotId) % 2 === 1;
    const dualCards = flipOrder
      ? [
          { ...getBrandCreative('bharathtools', slotId, 0), id: `${slotId}-left`, Icon: Layers },
          { ...getBrandCreative('tulusiri', slotId, 1), id: `${slotId}-right`, Icon: BookOpen },
        ]
      : [
          { ...getBrandCreative('tulusiri', slotId, 0), id: `${slotId}-left`, Icon: BookOpen },
          { ...getBrandCreative('bharathtools', slotId, 1), id: `${slotId}-right`, Icon: Layers },
        ];

    return (
      <aside
        className={`w-full no-print ${className}`}
        aria-label="Sponsored Tulu Siri & Bharath Tools Placements"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {dualCards.map((card) => {
            const CardIcon = card.Icon;
            const isBharath = card.brand === 'bharathtools';
            return (
              <div
                key={card.id}
                data-ad-slot={card.id}
                data-ad-format="rectangle"
                data-ad-context={card.badge}
                className={`min-h-[190px] rounded-2xl border-[1.5px] px-5 py-5 flex flex-col justify-between gap-4 shadow-xs ${
                  isBharath
                    ? 'border-[#12805C]/30 dark:border-emerald-500/30 bg-gradient-to-br from-[#FFFDF7] via-[#EDF8F3] to-[#E3F3EC] dark:from-[#131C2E] dark:via-[#0E211C] dark:to-[#111827]'
                    : 'border-[#7D0B0B]/25 dark:border-rose-500/30 bg-gradient-to-br from-[#FFFDF7] via-[#FAF3E1] to-[#F7ECDA] dark:from-[#131C2E] dark:via-[#1B1522] dark:to-[#111827]'
                }`}
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl border border-[#2F3E4E]/30 text-[#FFFDF5] flex items-center justify-center shrink-0 shadow-[0_2px_0_#2F3E4E] ${
                      isBharath ? 'bg-[#12805C]' : 'bg-[#7D0B0B]'
                    }`}
                  >
                    <CardIcon className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div
                      className={`flex flex-wrap items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-wider ${
                        isBharath
                          ? 'text-[#12805C] dark:text-emerald-300'
                          : 'text-[#7D0B0B] dark:text-[#F9C80E]'
                      }`}
                    >
                      <BrandBadgeIcon brand={card.brand} size="sm" />
                      <span>Sponsored · {card.badge}</span>
                    </div>
                    <a
                      href={card.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`block font-display font-extrabold text-sm sm:text-base text-[#2F3E4E] dark:text-slate-100 leading-snug transition-colors ${
                        isBharath
                          ? 'hover:text-[#12805C] dark:hover:text-emerald-300'
                          : 'hover:text-[#7D0B0B] dark:hover:text-[#F9C80E]'
                      }`}
                    >
                      {card.headline}
                    </a>
                    <p className="text-xs text-[#475569] dark:text-slate-300 leading-relaxed">
                      {card.subcopy}
                    </p>
                  </div>
                </div>

                <div
                  className={`pt-3 border-t dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 ${
                    isBharath ? 'border-[#12805C]/15' : 'border-[#7D0B0B]/12'
                  }`}
                >
                  <span className="font-mono text-[11px] font-semibold text-[#5C4A3A] dark:text-slate-400">
                    {card.highlight} · {card.domain}
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={openCookiePreferences}
                      className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 hover:text-[#2F3E4E] dark:hover:text-[#F9C80E] underline underline-offset-2 cursor-pointer"
                    >
                      Ad Choices
                    </button>
                    <a
                      href={card.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-bold transition-colors whitespace-nowrap ${
                        isBharath
                          ? 'bg-[#12805C] hover:bg-[#0D6648] dark:bg-[#F9C80E] dark:hover:bg-[#FDE047] text-white dark:text-[#0F172A]'
                          : 'bg-[#7D0B0B] hover:bg-[#5E0808] dark:bg-[#F9C80E] dark:hover:bg-[#FDE047] text-white dark:text-[#0F172A]'
                      }`}
                    >
                      <span>{card.cta}</span>
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </aside>
    );
  }

  /* 3. Triple & Multiplex 3-Column Mixed Recommendation Grid */
  if (variant === 'triple' || variant === 'multiplex') {
    const startWithBharath = hashSlotId(slotId) % 2 === 1;
    const cards = startWithBharath
      ? [
          { ...getBrandCreative('bharathtools', slotId, 0), id: `${slotId}-1` },
          { ...getBrandCreative('tulusiri', slotId, 1), id: `${slotId}-2` },
          { ...getBrandCreative('bharathtools', slotId, 2), id: `${slotId}-3` },
        ]
      : [
          { ...getBrandCreative('tulusiri', slotId, 0), id: `${slotId}-1` },
          { ...getBrandCreative('bharathtools', slotId, 1), id: `${slotId}-2` },
          { ...getBrandCreative('tulusiri', slotId, 2), id: `${slotId}-3` },
        ];

    return (
      <aside
        className={`w-full no-print ${className}`}
        aria-label="Sponsored Tulu Siri & Bharath Tools Modules"
      >
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <span className="inline-flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-wider text-[#2F3E4E] dark:text-[#F9C80E]">
              <Sparkles className="w-3.5 h-3.5 text-[#7D0B0B] dark:text-[#F9C80E]" aria-hidden="true" />
              <span>Sponsored · Tulu Siri &amp; Bharath Tools Network</span>
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={openCookiePreferences}
                className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 hover:text-[#2F3E4E] dark:hover:text-[#F9C80E] underline underline-offset-2 cursor-pointer"
              >
                Ad Preferences
              </button>
              <a
                href={TULU_SIRI_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-bold text-[#7D0B0B] dark:text-[#F9C80E] hover:underline underline-offset-2"
              >
                tulusiri.vercel.app
              </a>
              <span className="text-[#94A3B8]" aria-hidden="true">
                ·
              </span>
              <a
                href={BHARATH_TOOLS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-bold text-[#12805C] dark:text-emerald-300 hover:underline underline-offset-2"
              >
                bharathtools.vercel.app
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cards.map((card) => {
              const isBharath = card.brand === 'bharathtools';
              return (
                <a
                  key={card.id}
                  href={card.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-ad-slot={card.id}
                  data-ad-format={variant === 'multiplex' ? 'autorelaxed' : 'rectangle'}
                  data-ad-context={card.badge}
                  className={`group min-h-[185px] rounded-2xl border-[1.5px] p-5 flex flex-col justify-between gap-3 transition-all duration-150 hover:-translate-y-0.5 ${
                    isBharath
                      ? 'border-[#12805C]/30 dark:border-emerald-500/30 bg-[#FFFDF8] dark:bg-[#131C2E] hover:bg-[#ECF7F2] dark:hover:bg-[#0E211C] hover:shadow-[0_4px_0_#12805C] dark:hover:shadow-[0_4px_0_#F9C80E]'
                      : 'border-[#7D0B0B]/25 dark:border-rose-500/30 bg-[#FFFDF8] dark:bg-[#131C2E] hover:bg-[#FAF2E1] dark:hover:bg-[#1A2033] hover:shadow-[0_4px_0_#7D0B0B] dark:hover:shadow-[0_4px_0_#F9C80E]'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider ${
                          isBharath
                            ? 'text-[#12805C] dark:text-emerald-300'
                            : 'text-[#7D0B0B] dark:text-[#F9C80E]'
                        }`}
                      >
                        <BrandBadgeIcon brand={card.brand} size="sm" />
                        <span>{card.badge}</span>
                      </span>
                    </div>
                    <p
                      className={`font-display font-extrabold text-sm sm:text-[15px] text-[#2F3E4E] dark:text-slate-100 leading-snug transition-colors ${
                        isBharath
                          ? 'group-hover:text-[#12805C] dark:group-hover:text-emerald-300'
                          : 'group-hover:text-[#7D0B0B] dark:group-hover:text-[#F9C80E]'
                      }`}
                    >
                      {card.headline}
                    </p>
                    <p className="text-xs text-[#475569] dark:text-slate-300 leading-relaxed">
                      {card.subcopy}
                    </p>
                  </div>

                  <div
                    className={`pt-2.5 border-t dark:border-slate-800 flex items-center justify-between gap-2 text-xs font-display font-bold ${
                      isBharath
                        ? 'border-[#12805C]/12 text-[#12805C] dark:text-emerald-300'
                        : 'border-[#7D0B0B]/10 text-[#7D0B0B] dark:text-[#F9C80E]'
                    }`}
                  >
                    <span>{card.cta}</span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#64748B] dark:text-slate-400">
                      {card.domain}
                      <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
                    </span>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      </aside>
    );
  }

  /* 4. Sidebar Vertical Spotlight Unit */
  if (variant === 'sidebar') {
    const isBharath = creative.brand === 'bharathtools';
    return (
      <aside
        aria-label={`Sidebar ${creative.brandName} Advertisement`}
        data-ad-slot={slotId}
        data-ad-format="vertical"
        data-ad-context={creative.badge}
        className={`w-full no-print ${className}`}
      >
        <div
          className={`min-h-[250px] rounded-2xl border-[1.5px] p-5 flex flex-col justify-between space-y-4 ${
            isBharath
              ? 'border-[#12805C]/30 dark:border-emerald-500/35 bg-gradient-to-b from-[#FFFDF7] to-[#E6F4EE] dark:from-[#131C2E] dark:to-[#0E221D]'
              : 'border-[#7D0B0B]/30 dark:border-rose-500/35 bg-gradient-to-b from-[#FFFDF7] to-[#F8EFE0] dark:from-[#131C2E] dark:to-[#1B1420]'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span
              className={`inline-flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider ${
                isBharath
                  ? 'text-[#12805C] dark:text-emerald-300'
                  : 'text-[#7D0B0B] dark:text-[#F9C80E]'
              }`}
            >
              <BrandBadgeIcon brand={creative.brand} size="sm" />
              <span>Sponsored · {creative.brandName}</span>
            </span>
            <span className="font-mono text-[10px] font-semibold text-[#64748B] dark:text-slate-400">
              {creative.highlight}
            </span>
          </div>

          <div
            className={`rounded-xl bg-[#FFFDF8]/90 dark:bg-[#0B1120]/80 border p-4 space-y-2.5 my-auto ${
              isBharath
                ? 'border-[#12805C]/20 dark:border-slate-700/80'
                : 'border-[#7D0B0B]/15 dark:border-slate-700/80'
            }`}
          >
            <div
              className={`w-9 h-9 rounded-lg text-[#FFFDF5] flex items-center justify-center ${
                isBharath ? 'bg-[#12805C]' : 'bg-[#7D0B0B]'
              }`}
            >
              {isBharath ? (
                <Layers className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Compass className="w-4 h-4" aria-hidden="true" />
              )}
            </div>
            <p className="font-display font-extrabold text-sm sm:text-base text-[#2F3E4E] dark:text-slate-100 leading-snug">
              {creative.headline}
            </p>
            <p className="text-xs text-[#475569] dark:text-slate-300 leading-relaxed">
              {creative.subcopy}
            </p>
            <a
              href={creative.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`mt-1 w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-display font-bold transition-colors ${
                isBharath
                  ? 'bg-[#12805C] hover:bg-[#0D6648] dark:bg-[#F9C80E] dark:hover:bg-[#FDE047] text-white dark:text-[#0F172A]'
                  : 'bg-[#7D0B0B] hover:bg-[#5E0808] dark:bg-[#F9C80E] dark:hover:bg-[#FDE047] text-white dark:text-[#0F172A]'
              }`}
            >
              <span>{creative.cta}</span>
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <button
              type="button"
              onClick={openCookiePreferences}
              className="font-semibold text-[#64748B] dark:text-slate-400 hover:text-[#2F3E4E] dark:hover:text-[#F9C80E] underline underline-offset-2 cursor-pointer"
            >
              Ad Choices
            </button>
            <span className="font-mono text-[10px] text-[#64748B] dark:text-slate-400">
              {creative.domain}
            </span>
          </div>
        </div>
      </aside>
    );
  }

  /* 5. High-Impact Billboard Banner */
  if (variant === 'billboard') {
    const isBharath = creative.brand === 'bharathtools';
    return (
      <aside
        aria-label={`${creative.brandName} Featured Billboard Advertisement`}
        data-ad-slot={slotId}
        data-ad-format="billboard"
        data-ad-context={creative.badge}
        className={`w-full no-print ${className}`}
      >
        <div
          className={`w-full rounded-2xl border-[1.5px] p-5 sm:p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-5 shadow-xs ${
            isBharath
              ? 'border-[#12805C]/30 dark:border-emerald-500/35 bg-gradient-to-r from-[#FFFDF7] via-[#E9F6F0] to-[#DCF0E7] dark:from-[#131C2E] dark:via-[#0F241E] dark:to-[#161E31]'
              : 'border-[#7D0B0B]/30 dark:border-rose-500/35 bg-gradient-to-r from-[#FFFDF7] via-[#FAF0DC] to-[#F7E8D0] dark:from-[#131C2E] dark:via-[#1E1420] dark:to-[#161E31]'
          }`}
        >
          <div className="flex items-start gap-4 min-w-0">
            <div
              className={`w-12 h-12 rounded-xl border-[1.5px] border-[#2F3E4E] text-[#FFFDF5] flex items-center justify-center shrink-0 shadow-[0_2px_0_#2F3E4E] ${
                isBharath ? 'bg-[#12805C]' : 'bg-[#7D0B0B]'
              }`}
            >
              {isBharath ? (
                <Layers className="w-6 h-6 text-[#F9C80E]" aria-hidden="true" />
              ) : (
                <TulunaduFlagIcon size="md" />
              )}
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span
                  className={`font-mono font-bold uppercase tracking-wider ${
                    isBharath
                      ? 'text-[#12805C] dark:text-emerald-300'
                      : 'text-[#7D0B0B] dark:text-[#F9C80E]'
                  }`}
                >
                  Sponsored · {creative.badge}
                </span>
                <span aria-hidden="true" className="text-[#94A3B8]">
                  ·
                </span>
                <span className="font-semibold text-[#5C4A3A] dark:text-slate-300">
                  {creative.highlight} · {creative.domain}
                </span>
              </div>
              <a
                href={creative.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`block font-display font-extrabold text-base sm:text-xl text-[#2F3E4E] dark:text-slate-50 leading-snug transition-colors ${
                  isBharath
                    ? 'hover:text-[#12805C] dark:hover:text-emerald-300'
                    : 'hover:text-[#7D0B0B] dark:hover:text-[#F9C80E]'
                }`}
              >
                {creative.headline}
              </a>
              <p className="text-xs sm:text-sm text-[#475569] dark:text-slate-300 max-w-2xl leading-relaxed">
                {creative.subcopy}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={openCookiePreferences}
              className="font-sans text-[11px] font-semibold text-[#64748B] dark:text-slate-400 hover:text-[#2F3E4E] dark:hover:text-[#F9C80E] underline underline-offset-2 px-1 cursor-pointer"
            >
              Ad Preferences
            </button>
            <a
              href={creative.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-2 px-5 py-2.5 min-h-[42px] rounded-xl text-xs sm:text-sm font-display font-extrabold shadow-[0_2px_0_#2F3E4E] dark:shadow-none transition-all hover:-translate-y-0.5 whitespace-nowrap ${
                isBharath
                  ? 'bg-[#12805C] hover:bg-[#0D6648] dark:bg-[#F9C80E] dark:hover:bg-[#FDE047] text-white dark:text-[#0F172A]'
                  : 'bg-[#7D0B0B] hover:bg-[#5E0808] dark:bg-[#F9C80E] dark:hover:bg-[#FDE047] text-white dark:text-[#0F172A]'
              }`}
            >
              <span>{creative.cta}</span>
              <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
            </a>
          </div>
        </div>
      </aside>
    );
  }

  /* 6. Compact Strip, Leaderboard, Inline, In-Article & Workspace Text Banners */
  const isBharath = creative.brand === 'bharathtools';
  const isCompact = variant === 'compact-strip';
  const containerPadding = isCompact
    ? 'px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl min-h-[60px]'
    : variant === 'workspace' || variant === 'in-article'
    ? 'px-4 py-3.5 sm:px-5 sm:py-4 rounded-xl min-h-[84px]'
    : 'px-5 py-4 sm:py-5 rounded-2xl min-h-[88px]';

  return (
    <aside
      aria-label={`Sponsored ${creative.brandName} Placement`}
      data-ad-slot={slotId}
      data-ad-format={variant === 'in-article' ? 'fluid' : 'auto'}
      data-ad-context={creative.badge}
      className={`w-full no-print ${className}`}
    >
      <div
        className={`w-full border-[1.5px] ${containerPadding} flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs ${
          isBharath
            ? 'border-[#12805C]/30 dark:border-emerald-500/30 bg-gradient-to-r from-[#FFFDF7] via-[#ECF7F2] to-[#FFFDF7] dark:from-[#131C2E] dark:via-[#0E221D] dark:to-[#131C2E]'
            : 'border-[#7D0B0B]/25 dark:border-rose-500/30 bg-gradient-to-r from-[#FFFDF7] via-[#FAF2DF] to-[#FFFDF7] dark:from-[#131C2E] dark:via-[#1B1420] dark:to-[#131C2E]'
        }`}
      >
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div
            className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 ${
              isBharath
                ? 'bg-[#12805C]/10 dark:bg-emerald-950/70 border-[#12805C]/30 dark:border-emerald-500/40'
                : 'bg-[#7D0B0B]/10 dark:bg-rose-950/70 border-[#7D0B0B]/25 dark:border-rose-500/40'
            }`}
          >
            <BrandBadgeIcon brand={creative.brand} size="sm" />
          </div>
          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
              <span
                className={`font-bold uppercase tracking-wider ${
                  isBharath
                    ? 'text-[#12805C] dark:text-emerald-300'
                    : 'text-[#7D0B0B] dark:text-[#F9C80E]'
                }`}
              >
                Sponsored · {creative.badge}
              </span>
              <span aria-hidden="true" className="text-[#94A3B8]">
                ·
              </span>
              <span className="font-semibold text-[#5C4A3A] dark:text-slate-300">
                {creative.highlight} · {creative.domain}
              </span>
            </div>
            <a
              href={creative.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`block text-xs sm:text-sm font-display font-extrabold text-[#2F3E4E] dark:text-slate-100 leading-snug transition-colors ${
                isBharath
                  ? 'hover:text-[#12805C] dark:hover:text-emerald-300'
                  : 'hover:text-[#7D0B0B] dark:hover:text-[#F9C80E]'
              }`}
            >
              {creative.headline}
            </a>
            {!isCompact && (
              <p className="text-xs text-[#475569] dark:text-slate-300 leading-snug line-clamp-2">
                {creative.subcopy}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start sm:self-center">
          <button
            type="button"
            onClick={openCookiePreferences}
            className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 hover:text-[#2F3E4E] dark:hover:text-[#F9C80E] underline underline-offset-2 cursor-pointer"
          >
            Ad Choices
          </button>
          <a
            href={creative.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-display font-bold transition-colors whitespace-nowrap ${
              isBharath
                ? 'bg-[#12805C] hover:bg-[#0D6648] dark:bg-[#F9C80E] dark:hover:bg-[#FDE047] text-white dark:text-[#0F172A]'
                : 'bg-[#7D0B0B] hover:bg-[#5E0808] dark:bg-[#F9C80E] dark:hover:bg-[#FDE047] text-white dark:text-[#0F172A]'
            }`}
          >
            <span>{creative.cta}</span>
            <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
          </a>
        </div>
      </div>
    </aside>
  );
}
