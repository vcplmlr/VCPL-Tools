import { useEffect, useState } from 'react';
import { ArrowRight, Calendar, ExternalLink, Sparkles } from 'lucide-react';
import { getToolById } from '../data/toolsCatalog';

export type PublicAnnouncementBadge = 'NEW' | 'UPGRADE' | 'BETA' | 'INFO';

export interface PublicAnnouncement {
  id: string;
  title: string;
  badge: PublicAnnouncementBadge;
  summary: string;
  launchDate: string;
  toolId: string;
  actionLabel: string;
  actionUrl: string;
  isPinned: boolean;
}

interface WhatsNewSectionProps {
  onOpenTool: (toolId: string) => void;
}

const DEFAULT_FALLBACK_ANNOUNCEMENTS: PublicAnnouncement[] = [
  {
    id: 'ann_vcpl_ai_text_cleaner',
    title: 'VCPL AI Text Cleaner',
    badge: 'NEW',
    summary:
      'Clean ChatGPT, Claude, Gemini & Copilot text 100% locally in your browser—strip Markdown, citations, invisible characters, stray symbols & uneven spacing while preserving original meaning.',
    launchDate: '2026-11-24',
    toolId: 'ai-text-cleaner',
    actionLabel: 'Open Tool',
    actionUrl: '',
    isPinned: true,
  },
];

function formatLaunchDate(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const date = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function getBadgeStyle(badge: PublicAnnouncementBadge): string {
  switch (badge) {
    case 'NEW':
      return 'bg-[#12805C] text-white border-[#0A4F38] dark:bg-emerald-500 dark:text-[#0F172A] dark:border-emerald-400';
    case 'UPGRADE':
      return 'bg-[#F9C80E] text-[#2F3E4E] border-[#2F3E4E]';
    case 'BETA':
      return 'bg-[#FEF3C7] text-[#92400E] border-[#B45309]/40 dark:bg-amber-500/20 dark:text-amber-300';
    case 'INFO':
      return 'bg-[#2F3E4E] text-[#FFFDF5] border-[#1E293B] dark:bg-slate-700 dark:border-slate-500';
  }
}

export function WhatsNewSection({ onOpenTool }: WhatsNewSectionProps) {
  const [announcements, setAnnouncements] = useState<PublicAnnouncement[]>(
    DEFAULT_FALLBACK_ANNOUNCEMENTS
  );

  useEffect(() => {
    let active = true;
    fetch('/api/announcements')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { announcements?: PublicAnnouncement[] } | null) => {
        if (!active || !data || !Array.isArray(data.announcements)) return;
        setAnnouncements(data.announcements);
      })
      .catch(() => {
        // Keep static default fallback when offline or static build
      });
    return () => {
      active = false;
    };
  }, []);

  if (announcements.length === 0) {
    return null;
  }

  return (
    <section
      id="whats-new"
      aria-labelledby="whats-new-heading"
      className="w-full bg-[#FFFDF5] dark:bg-[#0B1120] border-b border-[#2F3E4E]/15 dark:border-slate-800 py-10 sm:py-12 transition-colors duration-200"
    >
      <div className="max-w-[1400px] mx-auto pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6 space-y-6">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-4 border-b border-[#2F3E4E]/15 dark:border-slate-800">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#12805C] text-white font-display font-extrabold text-[11px] uppercase tracking-wider">
                <Sparkles className="w-3 h-3" aria-hidden="true" />
                <span>NEW</span>
              </span>
              <span className="text-xs font-semibold text-[#475569] dark:text-slate-400">
                Latest Tool Releases &amp; Feature Upgrades
              </span>
            </div>
            <h2
              id="whats-new-heading"
              className="font-display font-extrabold text-[clamp(1.6rem,3vw,2.2rem)] leading-tight text-[#2F3E4E] dark:text-slate-50 tracking-tight"
            >
              What&apos;s New at VCPL
            </h2>
          </div>

          <p className="text-xs sm:text-sm text-[#475569] dark:text-slate-300 max-w-md">
            Freshly launched utilities and browser-native upgrades ready for instant use with zero
            cloud uploads.
          </p>
        </div>

        {/* Announcement Cards Grid */}
        <div
          className={
            announcements.length === 1
              ? 'grid grid-cols-1 gap-5'
              : announcements.length === 2
              ? 'grid grid-cols-1 lg:grid-cols-2 gap-5'
              : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5'
          }
        >
          {announcements.map((item) => {
            const linkedTool = item.toolId ? getToolById(item.toolId) : undefined;
            const isSingleSpotlight = announcements.length === 1;

            return (
              <article
                key={item.id}
                className={`rounded-2xl bg-[#FEF2C8]/65 dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 shadow-[0_4px_0_#2F3E4E] dark:shadow-[0_4px_0_#020617] transition-all duration-150 hover:-translate-y-0.5 ${
                  isSingleSpotlight
                    ? 'p-6 sm:p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-6'
                    : 'p-5 sm:p-6 flex flex-col justify-between gap-5'
                }`}
              >
                <div className="space-y-3 min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border font-display font-extrabold text-[10px] uppercase tracking-wider shrink-0 ${getBadgeStyle(
                        item.badge
                      )}`}
                    >
                      <Sparkles className="w-3 h-3" aria-hidden="true" />
                      <span>{item.badge}</span>
                    </span>

                    <span className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-[#475569] dark:text-slate-300 tabular-nums">
                      <Calendar className="w-3.5 h-3.5 text-[#12805C] dark:text-emerald-400" aria-hidden="true" />
                      <span>Launched {formatLaunchDate(item.launchDate)}</span>
                    </span>

                    {linkedTool && (
                      <span className="text-xs font-mono font-bold text-[#4338CA] dark:text-indigo-300">
                        · {linkedTool.suite} ({linkedTool.code})
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="font-display font-extrabold text-lg sm:text-xl text-[#2F3E4E] dark:text-slate-50 tracking-tight">
                      {item.title}
                    </h3>
                    <p className="text-xs sm:text-sm leading-relaxed text-[#334155] dark:text-slate-300 max-w-3xl">
                      {item.summary}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {linkedTool ? (
                    <button
                      type="button"
                      onClick={() => onOpenTool(linkedTool.id)}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-[#2F3E4E] dark:bg-[#F9C80E] hover:bg-[#1E293B] dark:hover:bg-[#FDE047] text-[#FFFDF5] dark:text-[#0F172A] border-[1.5px] border-[#2F3E4E] dark:border-[#F9C80E] shadow-[0_3px_0_#1E293B] dark:shadow-[0_3px_0_#020617] text-xs sm:text-sm font-display font-extrabold whitespace-nowrap cursor-pointer transition"
                    >
                      <span>{item.actionLabel || 'Open Tool'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : item.actionUrl ? (
                    <a
                      href={item.actionUrl}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-[#2F3E4E] dark:bg-[#F9C80E] hover:bg-[#1E293B] dark:hover:bg-[#FDE047] text-[#FFFDF5] dark:text-[#0F172A] border-[1.5px] border-[#2F3E4E] dark:border-[#F9C80E] shadow-[0_3px_0_#1E293B] text-xs sm:text-sm font-display font-extrabold whitespace-nowrap transition"
                    >
                      <span>{item.actionLabel || 'Learn More'}</span>
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
