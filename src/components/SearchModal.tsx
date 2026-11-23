import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Clock, Heart, Search, Sparkles, X } from 'lucide-react';
import {
  PUBLIC_TOOLS_CATALOG,
  getToolById,
  sortToolsForSuite,
  toolMatchesCategory,
} from '../data/toolsCatalog';
import { ToolCatalogItem, ToolFilterType } from '../types/tools';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTool: (tool: ToolCatalogItem) => void;
  activeToolId?: string | null;
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (id: string) => void;
  recents: string[];
}

const MODAL_CATEGORIES: { key: ToolFilterType; label: string }[] = [
  { key: 'All', label: `All Tools (${PUBLIC_TOOLS_CATALOG.length})` },
  { key: 'Banking', label: 'Banking' },
  { key: 'Tax & GST', label: 'Tax & GST' },
  { key: 'Calculator', label: 'Calculator' },
  { key: 'PDF Suite', label: 'PDF Suite' },
  { key: 'Image Studio', label: 'Image Studio' },
  { key: 'Typing & Text', label: 'Typing & Text' },
  { key: 'Utilities', label: 'Utilities' },
  { key: 'VCPL', label: 'VCPL Tools' },
  { key: 'Special Tools', label: 'Special' },
  { key: 'Learn Tools', label: 'Learn Tools' },
];

const POPULAR_QUERIES = [
  'GSTR-1',
  'Tulu Lipi',
  'Keyboard Shortcuts',
  'Tally Shortcuts',
  'PDF to Word',
  'Background Remover',
  'DMS vs Tally',
  'JPG Crop',
  'All-in-One Calculator',
  'Form 26AS',
];

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  onSelectTool,
  activeToolId,
  isFavorite,
  onToggleFavorite,
  recents,
}) => {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ToolFilterType>('All');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
      return () => window.clearTimeout(timer);
    }
    setQuery('');
    setSelectedCategory('All');
  }, [isOpen]);

  if (!isOpen) return null;

  const normalizedQuery = query.toLowerCase().trim();

  const matchedTools = PUBLIC_TOOLS_CATALOG.filter((tool) => {
    const matchesCategory = toolMatchesCategory(tool, selectedCategory);
    if (!matchesCategory) return false;
    if (!normalizedQuery) return true;

    return (
      tool.title.toLowerCase().includes(normalizedQuery) ||
      tool.description.toLowerCase().includes(normalizedQuery) ||
      tool.suite.toLowerCase().includes(normalizedQuery) ||
      tool.code.toLowerCase().includes(normalizedQuery) ||
      tool.categoryName.toLowerCase().includes(normalizedQuery) ||
      (tool.keywords?.some((k) => k.toLowerCase().includes(normalizedQuery)) ?? false)
    );
  });
  const filteredTools = sortToolsForSuite(matchedTools, selectedCategory);

  const recentTools = recents
    .map((id) => getToolById(id))
    .filter((t): t is ToolCatalogItem => Boolean(t && !t.vaultOnly));

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[max(0.75rem,env(safe-area-inset-top))] sm:pt-16 pb-[max(0.75rem,env(safe-area-inset-bottom))] px-3 sm:px-4 bg-[#2F3E4E]/55 dark:bg-[#020617]/80 backdrop-blur-xs no-print"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search VCPL Tools"
        className="w-full max-w-2xl bg-[#FFFDF5] dark:bg-[#0F172A] rounded-2xl border-[1.5px] border-[#2F3E4E] dark:border-slate-700 shadow-[0_6px_0_#2F3E4E] dark:shadow-[0_6px_0_#020617] overflow-hidden flex flex-col max-h-[85dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Bar */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#2F3E4E]/15 dark:border-slate-800 bg-[#FEF2C8]/65 dark:bg-[#131C2E]">
          <Search className="w-5 h-5 text-[#2F3E4E] dark:text-[#F9C80E] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search across ${PUBLIC_TOOLS_CATALOG.length} tools (e.g. Form 26AS, PDF, QR, EMI)...`}
            className="flex-1 bg-transparent dark:bg-transparent border-none text-[#2F3E4E] dark:text-slate-100 placeholder:text-[#64748B] dark:placeholder:text-slate-400 text-sm sm:text-base font-medium focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search query"
              className="p-1 text-[#475569] dark:text-slate-400 hover:text-[#2F3E4E] dark:hover:text-white rounded cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] font-bold text-[#2F3E4E] dark:text-slate-200 px-2.5 py-1 rounded-md bg-white dark:bg-[#0B1120] border border-[#2F3E4E] dark:border-slate-600 hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] dark:hover:text-[#0F172A] cursor-pointer"
          >
            ESC
          </button>
        </div>

        {/* Category Filter Tabs */}
        <div className="px-5 py-2.5 border-b border-[#2F3E4E]/10 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto text-xs bg-[#FFFDF5] dark:bg-[#0F172A]">
          {MODAL_CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => setSelectedCategory(cat.key)}
              className={`px-3 py-1.5 rounded-lg shrink-0 font-bold border transition-colors cursor-pointer ${
                selectedCategory === cat.key
                  ? 'bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#FFFDF5] dark:text-[#0F172A] border-[#2F3E4E] dark:border-[#F9C80E]'
                  : 'bg-[#FEF2C8]/50 dark:bg-[#131C2E] text-[#2F3E4E] dark:text-slate-200 border-[#2F3E4E]/25 dark:border-slate-700 hover:bg-[#FEF2C8] dark:hover:bg-slate-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Recents & Popular Queries when empty */}
        {!query && selectedCategory === 'All' && (
          <div className="p-4 border-b border-[#2F3E4E]/10 dark:border-slate-800 bg-[#FEF2C8]/35 dark:bg-[#131C2E]/60 space-y-3">
            {recentTools.length > 0 && (
              <div>
                <span className="text-[10px] font-bold text-[#64748B] dark:text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1.5">
                  <Clock className="w-3 h-3" /> Recently Opened
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {recentTools.slice(0, 5).map((item) => {
                    const isCurrent = item.id === activeToolId;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          onSelectTool(item);
                          onClose();
                        }}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-lg cursor-pointer border ${
                          isCurrent
                            ? 'bg-[#F9C80E] text-[#2F3E4E] border-[#2F3E4E] font-bold shadow-[0_2px_0_#2F3E4E]'
                            : 'text-[#2F3E4E] dark:text-slate-200 bg-[#CEE5DC]/65 dark:bg-emerald-950/60 border-[#2F3E4E]/40 dark:border-emerald-700/60 hover:bg-[#CEE5DC] dark:hover:bg-emerald-900/70'
                        }`}
                      >
                        [{item.code}] {item.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <span className="text-[10px] font-bold text-[#64748B] dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                Popular Searches
              </span>
              <div className="flex flex-wrap gap-1.5">
                {POPULAR_QUERIES.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => setQuery(term)}
                    className="px-3 py-1 text-xs font-semibold text-[#2F3E4E] dark:text-slate-200 bg-white dark:bg-[#0B1120] border border-[#2F3E4E]/35 dark:border-slate-700 rounded-lg hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] dark:hover:text-[#0F172A] transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 text-current" />
                    {term}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tool Results */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {filteredTools.length === 0 ? (
            <div className="p-8 text-center text-[#475569] dark:text-slate-300">
              <p className="text-sm font-bold text-[#2F3E4E] dark:text-slate-100">
                No tools found matching &ldquo;{query}&rdquo;
              </p>
              <p className="text-xs mt-1 text-[#64748B] dark:text-slate-400">
                Try keywords like &ldquo;26AS&rdquo;, &ldquo;GSTR-2B&rdquo;, &ldquo;PDF&rdquo;, &ldquo;QR&rdquo;, &ldquo;Typing&rdquo;, or &ldquo;EMI&rdquo;.
              </p>
            </div>
          ) : (
            filteredTools.map((tool) => {
              const fav = isFavorite(tool.id);
              const isCurrent = tool.id === activeToolId;
              return (
                <div
                  key={tool.id}
                  onClick={() => {
                    onSelectTool(tool);
                    onClose();
                  }}
                  className={`group flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                    isCurrent
                      ? 'border-[#2F3E4E] dark:border-[#F9C80E] bg-[#F9C80E]/30 dark:bg-[#F9C80E]/15 shadow-[0_2px_0_#2F3E4E] dark:shadow-[0_2px_0_#020617]'
                      : 'border-transparent hover:border-[#2F3E4E] dark:hover:border-slate-600 hover:bg-[#FEF2C8]/65 dark:hover:bg-[#131C2E]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold shrink-0 ${
                        isCurrent
                          ? 'bg-[#F9C80E] text-[#2F3E4E] border border-[#2F3E4E]'
                          : 'bg-[#2F3E4E] dark:bg-slate-800 text-[#FFFDF5] dark:text-[#F9C80E] border border-transparent dark:border-slate-700'
                      }`}
                    >
                      {tool.code}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-[#2F3E4E] dark:text-slate-100 truncate">
                          {tool.title}
                        </h4>
                        {isCurrent && (
                          <span className="px-1.5 py-0.5 rounded bg-[#12805C] text-white text-[9px] font-display font-extrabold uppercase tracking-wider shrink-0">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#475569] dark:text-slate-300 truncate">{tool.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 hidden sm:inline">
                      {tool.suite}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(tool.id);
                      }}
                      className="p-1.5 text-[#64748B] dark:text-slate-400 hover:text-[#2F3E4E] dark:hover:text-[#F9C80E] rounded-md transition-colors cursor-pointer"
                      title={fav ? 'Remove from Favourites' : 'Save to Favourites'}
                      aria-label={fav ? 'Remove from Favourites' : 'Save to Favourites'}
                    >
                      <Heart className={`w-4 h-4 ${fav ? 'fill-[#F9C80E] text-[#2F3E4E] dark:text-[#F9C80E]' : ''}`} />
                    </button>
                    <ArrowRight className="w-4 h-4 text-[#64748B] dark:text-slate-400 group-hover:text-[#2F3E4E] dark:group-hover:text-[#F9C80E] group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-5 py-3 bg-[#FEF2C8]/55 dark:bg-[#131C2E] border-t border-[#2F3E4E]/15 dark:border-slate-800 text-xs font-medium text-[#475569] dark:text-slate-300 flex flex-wrap items-center justify-between gap-2">
          <span>
            Showing <strong className="text-[#2F3E4E] dark:text-slate-100">{filteredTools.length}</strong> of{' '}
            <strong className="text-[#2F3E4E] dark:text-slate-100">{PUBLIC_TOOLS_CATALOG.length}</strong> tools
          </span>
          <span className="hidden sm:inline">Ctrl+K / ⌘K to open · ESC to close</span>
        </div>
      </div>
    </div>
  );
};
