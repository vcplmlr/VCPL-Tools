import { ExternalLink, Layers, Megaphone, MonitorSmartphone, Sparkles } from 'lucide-react';
import { SITE_CONTACT } from '../data/legalPagesData';

export type AdSlotVariant =
  | 'leaderboard'
  | 'billboard'
  | 'inline'
  | 'in-article'
  | 'workspace'
  | 'compact-strip'
  | 'dual'
  | 'triple'
  | 'sidebar';

interface AdSlotProps {
  slotId: string;
  variant?: AdSlotVariant;
  label?: string;
  contentContext?: string;
  sizeTag?: string;
  showSponsorOption?: boolean;
  className?: string;
}

function getSponsorInquiryHref(slotId: string, variant: AdSlotVariant, context?: string) {
  const subject = `[VCPL Tools] Ad / Sponsorship Inquiry — Slot ${slotId} (${variant})`;
  const body = [
    `Hi Arjun & Kaushik,`,
    ``,
    `I would like to advertise / sponsor on VCPL Tools.`,
    `Slot ID: ${slotId}`,
    `Ad Format: ${variant}`,
    `Page Context: ${context || 'VCPL Productivity Suite'}`,
    ``,
    `Please share availability and pricing.`,
  ].join('\n');

  return `mailto:${SITE_CONTACT.ideationEmail}?cc=${encodeURIComponent(
    SITE_CONTACT.developerEmail
  )}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function getVariantMeta(variant: AdSlotVariant) {
  switch (variant) {
    case 'billboard':
      return {
        defaultSize: '970 × 250 / 320 × 100',
        descriptor: 'High-Impact Billboard Unit · Responsive Desktop & Mobile',
      };
    case 'leaderboard':
      return {
        defaultSize: '728 × 90 / 320 × 50',
        descriptor: 'Leaderboard Display Unit · Adaptive Desktop & Mobile',
      };
    case 'in-article':
      return {
        defaultSize: 'Fluid Native',
        descriptor: 'In-Article Native Unit · Content-Matched',
      };
    case 'workspace':
      return {
        defaultSize: '970 × 90 / Fluid',
        descriptor: 'Tool Workspace Contextual Banner · Non-Intrusive',
      };
    case 'compact-strip':
      return {
        defaultSize: '320 × 50 / 728 × 90',
        descriptor: 'Compact Partner Strip · Fast Load',
      };
    case 'sidebar':
      return {
        defaultSize: '300 × 250 / 300 × 600',
        descriptor: 'Sidebar Rectangle & Skyscraper Option',
      };
    case 'dual':
      return {
        defaultSize: '336 × 280 × 2',
        descriptor: 'Dual Medium Rectangle Showcase',
      };
    case 'triple':
      return {
        defaultSize: '300 × 250 × 3',
        descriptor: '3-Column Partner Card Network',
      };
    case 'inline':
    default:
      return {
        defaultSize: 'Responsive Fluid',
        descriptor: 'In-Feed Contextual Unit · Auto-Fit',
      };
  }
}

export function AdSlot({
  slotId,
  variant = 'leaderboard',
  label,
  contentContext,
  sizeTag,
  showSponsorOption = true,
  className = '',
}: AdSlotProps) {
  const meta = getVariantMeta(variant);
  const resolvedSize = sizeTag || meta.defaultSize;
  const inquiryHref = getSponsorInquiryHref(slotId, variant, contentContext);

  /* Dual 336x280 Side-by-Side Ad Option */
  if (variant === 'dual') {
    const cards = [
      {
        id: `${slotId}-left`,
        title: contentContext
          ? `${contentContext} · Partner Slot A`
          : 'Banking, Tax & Accounting Software · Slot A',
        sub: '336 × 280 Large Rectangle · Zero file access',
        accent: 'bg-[#FEF2C8]',
      },
      {
        id: `${slotId}-right`,
        title: contentContext
          ? `${contentContext} · Partner Slot B`
          : 'Office PDF & GST Automation · Slot B',
        sub: '336 × 280 Large Rectangle · Direct or AdSense',
        accent: 'bg-[#CEE5DC]/75',
      },
    ];

    return (
      <aside
        className={`w-full no-print ${className}`}
        aria-label="Dual Content-Matched Sponsored Placements"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cards.map((unit) => (
            <div
              key={unit.id}
              data-ad-slot={unit.id}
              data-ad-format="rectangle"
              data-ad-context={contentContext || 'VCPL Productivity & Business Tools'}
              className="rounded-2xl border-[1.5px] border-dashed border-[#2F3E4E]/40 dark:border-slate-700 bg-[#FFFDF5]/95 dark:bg-[#131C2E] px-5 py-5 flex flex-col justify-between gap-4"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className={`w-10 h-10 rounded-xl ${unit.accent} dark:bg-slate-800 border border-[#2F3E4E]/35 dark:border-slate-600 text-[#2F3E4E] dark:text-[#F9C80E] flex items-center justify-center shrink-0`}
                >
                  <Megaphone className="w-4 h-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                    Advertisement · 336 × 280 Option
                  </span>
                  <p className="font-display font-bold text-sm text-[#2F3E4E] dark:text-slate-100 mt-0.5 leading-snug break-words">
                    {unit.title}
                  </p>
                  <p className="text-xs text-[#475569] dark:text-slate-300 mt-1 leading-relaxed">{unit.sub}</p>
                </div>
              </div>

              <div className="pt-2.5 border-t border-[#2F3E4E]/10 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-[11px] font-bold text-[#2F3E4E] dark:text-slate-200 bg-[#FEF2C8] dark:bg-[#0B1120] border border-[#2F3E4E]/30 dark:border-slate-700 px-2.5 py-1 rounded-md">
                  #{unit.id}
                </span>
                {showSponsorOption && (
                  <a
                    href={inquiryHref}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#2F3E4E] dark:text-slate-200 hover:text-[#12805C] dark:hover:text-[#F9C80E] underline underline-offset-2"
                  >
                    <span>Advertise Here</span>
                    <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </aside>
    );
  }

  /* Triple 300x250 Partner Card Network Option */
  if (variant === 'triple') {
    const cards = [
      {
        id: `${slotId}-1`,
        tag: 'Sponsor Option 01',
        title: contentContext ? `${contentContext} Suite` : 'Business Accounting & GST Tools',
        desc: 'High-visibility 300 × 250 native slot for CA, tax, and fintech solutions.',
      },
      {
        id: `${slotId}-2`,
        tag: 'Sponsor Option 02',
        title: 'Cloud Document & PDF Workflows',
        desc: 'Contextual 300 × 250 card matched with office productivity visitors.',
      },
      {
        id: `${slotId}-3`,
        tag: 'Sponsor Option 03',
        title: 'Banking & MSME Financial Services',
        desc: 'Responsive 300 × 250 ad unit visible cleanly on desktop, tablet & mobile.',
      },
    ];

    return (
      <aside
        className={`w-full no-print ${className}`}
        aria-label="Three-Column Partner Ad Grid"
      >
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-[#475569] dark:text-slate-400">
              <Layers className="w-3.5 h-3.5 text-[#2F3E4E] dark:text-[#F9C80E]" aria-hidden="true" />
              <span>Sponsored Showcase Grid · {resolvedSize}</span>
            </span>
            {showSponsorOption && (
              <a
                href={inquiryHref}
                className="text-[11px] font-bold text-[#2F3E4E] dark:text-slate-200 hover:text-[#12805C] dark:hover:text-[#F9C80E] underline underline-offset-2"
              >
                Book Ad Slot →
              </a>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cards.map((card) => (
              <div
                key={card.id}
                data-ad-slot={card.id}
                data-ad-format="rectangle"
                data-ad-context={contentContext || 'VCPL Productivity & Finance'}
                className="rounded-2xl border-[1.5px] border-dashed border-[#2F3E4E]/40 dark:border-slate-700 bg-[#FFFDF5]/95 dark:bg-[#131C2E] p-4 sm:p-5 flex flex-col justify-between gap-3"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                      Ad · {card.tag}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-[#F9C80E]/50 dark:bg-[#F9C80E]/20 border border-[#2F3E4E]/25 dark:border-[#F9C80E]/40 font-mono text-[10px] font-bold text-[#2F3E4E] dark:text-[#FDE047]">
                      300×250
                    </span>
                  </div>
                  <p className="font-display font-bold text-sm text-[#2F3E4E] dark:text-slate-100 leading-snug break-words">
                    {card.title}
                  </p>
                  <p className="text-xs text-[#475569] dark:text-slate-300 leading-relaxed">{card.desc}</p>
                </div>

                <div className="pt-2 border-t border-[#2F3E4E]/10 dark:border-slate-800 flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-mono font-semibold text-[#64748B] dark:text-slate-400">#{card.id}</span>
                  <a
                    href={inquiryHref}
                    className="font-bold text-[#2F3E4E] dark:text-slate-200 hover:text-[#12805C] dark:hover:text-[#F9C80E] underline underline-offset-2"
                  >
                    Reserve Spot
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    );
  }

  /* Sidebar 300x250 / 300x600 Vertical Ad Unit */
  if (variant === 'sidebar') {
    return (
      <aside
        aria-label="Sidebar Advertisement Slot"
        data-ad-slot={slotId}
        data-ad-format="vertical"
        data-ad-context={contentContext || 'Banking, GST & Office Utilities'}
        className={`w-full no-print ${className}`}
      >
        <div className="rounded-2xl border-[1.5px] border-dashed border-[#2F3E4E]/45 dark:border-slate-700 bg-[#FFFDF5]/95 dark:bg-[#131C2E] p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
              Sponsored · Sidebar
            </span>
            <span className="px-2 py-0.5 rounded bg-[#FEF2C8] dark:bg-[#0B1120] border border-[#2F3E4E]/30 dark:border-slate-700 font-mono text-[10px] font-bold text-[#2F3E4E] dark:text-slate-200">
              {resolvedSize}
            </span>
          </div>

          <div className="rounded-xl bg-[#FEF2C8]/65 dark:bg-[#0B1120]/80 border border-[#2F3E4E]/15 dark:border-slate-700/80 p-4 text-center space-y-2">
            <div className="w-10 h-10 mx-auto rounded-xl bg-[#F9C80E]/55 dark:bg-[#F9C80E]/20 border border-[#2F3E4E]/35 dark:border-[#F9C80E]/40 flex items-center justify-center text-[#2F3E4E] dark:text-[#F9C80E]">
              <Megaphone className="w-4 h-4" aria-hidden="true" />
            </div>
            <p className="font-display font-bold text-sm text-[#2F3E4E] dark:text-slate-100 leading-snug break-words">
              {contentContext || 'VCPL Tools Vertical Ad Option'}
            </p>
            <p className="text-xs text-[#475569] dark:text-slate-300 leading-relaxed">
              {label || meta.descriptor}
            </p>
          </div>

          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="font-mono font-bold text-[#475569] dark:text-slate-400 truncate">#{slotId}</span>
            {showSponsorOption && (
              <a
                href={inquiryHref}
                className="inline-flex items-center gap-1 font-bold text-[#2F3E4E] dark:text-slate-200 hover:text-[#12805C] dark:hover:text-[#F9C80E] underline underline-offset-2 shrink-0"
              >
                <span>Sponsor</span>
                <ExternalLink className="w-3 h-3" aria-hidden="true" />
              </a>
            )}
          </div>
        </div>
      </aside>
    );
  }

  /* High-Impact Billboard (970x250) Option */
  if (variant === 'billboard') {
    const headline = contentContext
      ? `Featured Sponsor Solutions for ${contentContext}`
      : 'Featured Sponsor Billboard · Indian Banking, Tax & Office Tools';

    return (
      <aside
        aria-label="Billboard Advertisement Slot"
        data-ad-slot={slotId}
        data-ad-format="billboard"
        data-ad-context={contentContext || 'Banking, GST & Office Utilities'}
        className={`w-full no-print ${className}`}
      >
        <div className="w-full rounded-2xl border-[1.5px] border-dashed border-[#2F3E4E]/45 dark:border-slate-700 bg-gradient-to-r from-[#FFFDF5] via-[#FEF2C8]/65 to-[#CEE5DC]/45 dark:from-[#131C2E] dark:via-[#162136] dark:to-[#0F2421] p-5 sm:p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start gap-4 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] text-[#2F3E4E] flex items-center justify-center shrink-0 shadow-[0_2px_0_#2F3E4E]">
              <MonitorSmartphone className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                  Advertisement · Billboard
                </span>
                <span aria-hidden="true" className="text-[#94A3B8]">
                  ·
                </span>
                <span className="text-[11px] font-semibold text-[#475569] dark:text-slate-300">
                  {label || meta.descriptor}
                </span>
              </div>
              <p className="font-display font-extrabold text-base sm:text-lg text-[#2F3E4E] dark:text-slate-50 leading-snug break-words">
                {headline}
              </p>
              <p className="text-xs text-[#475569] dark:text-slate-300">
                Responsive multi-device ad slot ({resolvedSize}) — supports Google AdSense &amp;
                direct partner banners without collecting user files.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <span className="font-mono text-[11px] font-bold text-[#2F3E4E] dark:text-slate-200 bg-[#FFFDF5] dark:bg-[#0B1120] border border-[#2F3E4E]/35 dark:border-slate-600 px-3 py-1.5 rounded-lg">
              {resolvedSize}
            </span>
            <span className="font-mono text-[11px] font-bold text-[#2F3E4E] dark:text-emerald-300 bg-[#CEE5DC] dark:bg-emerald-950/70 border border-[#2F3E4E]/35 dark:border-emerald-500/40 px-3 py-1.5 rounded-lg">
              #{slotId}
            </span>
            {showSponsorOption && (
              <a
                href={inquiryHref}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-xl bg-[#2F3E4E] dark:bg-[#F9C80E] hover:bg-[#1E293B] dark:hover:bg-[#FDE047] text-[#F9C80E] dark:text-[#0F172A] text-xs font-display font-extrabold transition-colors whitespace-nowrap"
              >
                <span>Advertise Here</span>
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              </a>
            )}
          </div>
        </div>
      </aside>
    );
  }

  /* Compact Strip, Leaderboard, Inline, In-Article & Workspace Banners */
  const containerPadding =
    variant === 'compact-strip'
      ? 'px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl'
      : variant === 'workspace' || variant === 'in-article'
      ? 'px-4 py-3.5 sm:px-5 sm:py-4 rounded-xl'
      : 'px-5 py-4 sm:py-5 rounded-2xl';

  const headline = contentContext
    ? `Sponsored Solutions for ${contentContext}`
    : 'VCPL Tools Content-Matched Sponsor Placement';

  return (
    <aside
      aria-label="Advertisement Slot"
      data-ad-slot={slotId}
      data-ad-format={variant === 'in-article' ? 'fluid' : 'auto'}
      data-ad-context={contentContext || 'Banking, GST & Office Utilities'}
      className={`w-full no-print ${className}`}
    >
      <div
        className={`w-full border-[1.5px] border-dashed border-[#2F3E4E]/40 dark:border-slate-700 ${
          variant === 'in-article'
            ? 'bg-[#FEF2C8]/70 dark:bg-[#0F172A]'
            : variant === 'compact-strip'
            ? 'bg-[#FFFDF5]/80 dark:bg-[#131C2E]/90'
            : 'bg-[#FFFDF5]/95 dark:bg-[#131C2E]'
        } ${containerPadding} flex flex-col sm:flex-row sm:items-center justify-between gap-3`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-[#F9C80E]/40 dark:bg-[#F9C80E]/20 border border-[#2F3E4E]/35 dark:border-[#F9C80E]/40 text-[#2F3E4E] dark:text-[#F9C80E] flex items-center justify-center shrink-0">
            {variant === 'in-article' ? (
              <Sparkles className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Megaphone className="w-4 h-4" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                Advertisement
              </span>
              <span aria-hidden="true" className="text-[#94A3B8]">
                ·
              </span>
              <span className="text-[11px] font-semibold text-[#475569] dark:text-slate-300">
                {label || meta.descriptor}
              </span>
            </div>
            <p className="text-xs sm:text-sm font-display font-bold text-[#2F3E4E] dark:text-slate-100 leading-snug break-words mt-0.5">
              {headline}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-center">
          <span className="font-mono text-[10px] font-bold text-[#475569] dark:text-slate-200 bg-white dark:bg-[#0B1120] border border-[#2F3E4E]/25 dark:border-slate-700 px-2 py-1 rounded-md whitespace-nowrap">
            {resolvedSize}
          </span>
          <span className="font-mono text-[11px] font-bold text-[#2F3E4E] dark:text-slate-200 bg-[#FEF2C8] dark:bg-slate-800 border border-[#2F3E4E]/30 dark:border-slate-600 px-2.5 py-1 rounded-md whitespace-nowrap">
            {slotId}
          </span>
          {showSponsorOption && (
            <a
              href={inquiryHref}
              title="Advertise or sponsor this VCPL Tools slot"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#2F3E4E] dark:bg-[#F9C80E] hover:bg-[#1E293B] dark:hover:bg-[#FDE047] text-[#F9C80E] dark:text-[#0F172A] text-[11px] font-bold transition-colors whitespace-nowrap"
            >
              <span>Sponsor</span>
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
    </aside>
  );
}
