import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, RotateCcw, X } from 'lucide-react';
import { LEGAL_PAGES, LegalPageSlug, SITE_CONTACT } from '../data/legalPagesData';
import { TOOLS_CATALOG } from '../data/toolsCatalog';
import { ToolCatalogItem, ToolFilterType } from '../types/tools';
import { WhatsAppIcon } from './WhatsAppIcon';

export type WhatsAppPageView =
  | 'home'
  | 'all-tools'
  | 'tool'
  | 'legal'
  | 'sitemap'
  | 'not-found';

interface WhatsAppChatWidgetProps {
  view: WhatsAppPageView;
  activeFilter: ToolFilterType;
  activeTool?: ToolCatalogItem;
  activeLegalSlug?: LegalPageSlug;
}

export function WhatsAppChatWidget({
  view,
  activeFilter,
  activeTool,
  activeLegalSlug,
}: WhatsAppChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messageDraft, setMessageDraft] = useState('');

  const categoryCount = useMemo(() => {
    if (activeFilter === 'All') return TOOLS_CATALOG.length;
    return TOOLS_CATALOG.filter((t) => t.category === activeFilter).length;
  }, [activeFilter]);

  const contextLabel = useMemo(() => {
    if (view === 'tool' && activeTool) {
      return `[${activeTool.code}] ${activeTool.title}`;
    }
    if (view === 'all-tools') {
      return activeFilter === 'All'
        ? `All Tools Directory (${TOOLS_CATALOG.length} Tools)`
        : `${activeFilter} Category Page (${categoryCount} Tools)`;
    }
    if (view === 'legal' && activeLegalSlug) {
      return `${LEGAL_PAGES[activeLegalSlug]?.navTitle ?? 'Information'} Page`;
    }
    if (view === 'sitemap') {
      return 'HTML & XML Sitemap Page';
    }
    if (view === 'not-found') {
      return '404 Page Not Found';
    }
    return 'Home Page';
  }, [activeFilter, activeLegalSlug, activeTool, categoryCount, view]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  const trimmedMessage = messageDraft.trim();

  const whatsappHref = useMemo(() => {
    const phone = SITE_CONTACT.whatsappUrl.replace('https://wa.me/', '').replace(/[^0-9]/g, '');
    if (!trimmedMessage) {
      return `https://wa.me/${phone}`;
    }
    return `https://wa.me/${phone}?text=${encodeURIComponent(trimmedMessage)}`;
  }, [trimmedMessage]);

  return (
    <div className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-[max(0.75rem,env(safe-area-inset-left))] sm:bottom-[max(1.25rem,env(safe-area-inset-bottom))] sm:left-[max(1.25rem,env(safe-area-inset-left))] z-50 flex flex-col items-start gap-3 no-print">
      {isOpen && (
        <section
          role="dialog"
          aria-label="WhatsApp Support Chat"
          className="w-[calc(100vw-1.5rem)] max-w-[390px] max-h-[min(78dvh,520px)] overflow-y-auto bg-[#FFFDF5] dark:bg-[#131C2E] border-2 border-[#2F3E4E] dark:border-slate-700 rounded-2xl shadow-[0_6px_0_#2F3E4E] dark:shadow-[0_6px_0_#020617]"
        >
          {/* Header */}
          <div className="bg-[#2F3E4E] dark:bg-[#060A13] text-[#FFFDF5] px-4 py-3 flex items-center justify-between gap-3 border-b border-[#1E293B] dark:border-slate-800">
            <div className="flex items-center gap-2.5 min-w-0">
              <WhatsAppIcon variant="branded" className="w-8 h-8 shrink-0" />
              <div className="min-w-0">
                <h2 className="font-display font-extrabold text-sm text-[#FFFDF5] leading-tight truncate">
                  WhatsApp Support Chat
                </h2>
                <p className="text-[11px] font-mono text-[#CEE5DC] truncate">
                  {SITE_CONTACT.whatsappDisplay} · Kaushik
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close WhatsApp chat box"
              className="w-8 h-8 rounded-lg bg-[#FFFDF5]/10 hover:bg-[#F9C80E] text-[#FFFDF5] hover:text-[#2F3E4E] flex items-center justify-center transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Active Page Indicator */}
          <div className="bg-[#FEF2C8] dark:bg-[#0F172A] px-4 py-2 border-b border-[#2F3E4E]/15 dark:border-slate-800 flex items-center justify-between gap-2 text-[11px]">
            <span className="font-semibold text-[#475569] dark:text-slate-400 shrink-0">Current Page:</span>
            <span className="font-mono font-bold text-[#2F3E4E] dark:text-slate-100 truncate">{contextLabel}</span>
          </div>

          {/* Body */}
          <div className="p-4 space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="vcpl-wa-chat-input"
                  className="text-[11px] font-bold text-[#2F3E4E] dark:text-slate-200"
                >
                  Write your message (optional):
                </label>

                {messageDraft.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setMessageDraft('')}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-[#475569] dark:text-slate-400 hover:text-[#2F3E4E] dark:hover:text-white cursor-pointer whitespace-nowrap"
                  >
                    <RotateCcw className="w-3 h-3" aria-hidden="true" />
                    <span>Clear</span>
                  </button>
                )}
              </div>

              <textarea
                id="vcpl-wa-chat-input"
                rows={4}
                value={messageDraft}
                onChange={(e) => setMessageDraft(e.target.value)}
                placeholder="Type your message if you want to send one, or open WhatsApp directly..."
                className="w-full px-3 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs leading-relaxed text-[#2F3E4E] dark:text-slate-100 placeholder:text-[#64748B] dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#2F3E4E] dark:focus:ring-[#F9C80E] resize-y"
              />
            </div>

            {/* Action Footer */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[10px] font-mono text-[#64748B] dark:text-slate-400 tabular-nums">
                {trimmedMessage ? `${messageDraft.length} chars` : 'No prefilled text'}
              </span>

              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] shadow-[0_2px_0_#2F3E4E] text-xs font-display font-extrabold text-[#111827] transition-colors whitespace-nowrap shrink-0"
              >
                <WhatsAppIcon variant="glyph" className="w-4 h-4 text-[#111827] shrink-0" />
                <span>{trimmedMessage ? 'Send on WhatsApp' : 'Open WhatsApp'}</span>
                <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>
      )}

      {/* Pure Icon-Only WhatsApp Floating Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Close WhatsApp support chat' : 'Open WhatsApp support chat'}
        title={isOpen ? 'Close WhatsApp' : 'WhatsApp Support'}
        className="p-0 bg-transparent border-0 shadow-none rounded-full inline-flex items-center justify-center transition-transform hover:scale-110 active:scale-95 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F3E4E] focus-visible:ring-offset-2"
      >
        <WhatsAppIcon
          variant="branded"
          className="w-10 h-10 sm:w-11 sm:h-11 drop-shadow-[0_2px_6px_rgba(15,23,42,0.22)]"
        />
      </button>
    </div>
  );
}
