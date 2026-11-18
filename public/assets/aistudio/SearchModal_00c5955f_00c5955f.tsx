import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Heart, ArrowRight, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { TOOLS } from '../data/tools';
import { CATEGORIES } from '../data/categories';
import { DynamicIcon } from './DynamicIcon';

export const SearchModal: React.FC = () => {
  const { isSearchOpen, setIsSearchOpen, isFavorite, toggleFavorite, addRecent } = useApp();
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      if (e.key === 'Escape' && isSearchOpen) {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, setIsSearchOpen]);

  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setSelectedCategory('all');
    }
  }, [isSearchOpen]);

  if (!isSearchOpen) return null;

  const normalizedQuery = query.toLowerCase().trim();

  const filteredTools = TOOLS.filter(tool => {
    const matchesCategory = selectedCategory === 'all' || tool.categoryId === selectedCategory;
    if (!matchesCategory) return false;

    if (!normalizedQuery) return true;

    const matchesName = tool.name.toLowerCase().includes(normalizedQuery);
    const matchesDesc = tool.shortDescription.toLowerCase().includes(normalizedQuery);
    const matchesKeywords = tool.keywords.some(k => k.toLowerCase().includes(normalizedQuery));
    const matchesCatName = tool.categoryName.toLowerCase().includes(normalizedQuery);

    return matchesName || matchesDesc || matchesKeywords || matchesCatName;
  });

  const popularQueries = [
    'Photo Resizer',
    'Signature Resizer',
    'PDF Compressor',
    'Home Loan EMI',
    'SIP Calculator',
    'Age Calculator',
    'Resume Builder'
  ];

  const handleSelectTool = (slug: string) => {
    addRecent(slug);
    setIsSearchOpen(false);
    navigate(`/tools/${slug}`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-12 sm:pt-20 px-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={() => setIsSearchOpen(false)}
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={`Search across ${TOOLS.length} tools (e.g. Photo Resizer, PDF, EMI)...`}
            className="flex-1 bg-transparent border-none text-slate-900 dark:text-white placeholder:text-slate-400 text-base focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setIsSearchOpen(false)}
            className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium px-2 py-1 rounded-md bg-slate-200/60 dark:bg-slate-800"
          >
            ESC
          </button>
        </div>

        {/* Category Filters */}
        <div className="px-5 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto text-xs scrollbar-none">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-full shrink-0 font-medium transition-colors ${
              selectedCategory === 'all'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            All Tools ({TOOLS.length})
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-full shrink-0 font-medium transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Quick Search Suggestions when empty */}
        {!query && selectedCategory === 'all' && (
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/30">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
              Popular Searches
            </span>
            <div className="flex flex-wrap gap-1.5">
              {popularQueries.map(term => (
                <button
                  key={term}
                  onClick={() => setQuery(term)}
                  className="px-3 py-1 text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full hover:border-blue-500 hover:text-blue-600 transition-colors flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3 text-blue-500" />
                  {term}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {filteredTools.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">
              <p className="text-sm font-medium">No tools found matching &ldquo;{query}&rdquo;</p>
              <p className="text-xs mt-1 text-slate-400">
                Try searching with synonyms like &ldquo;resize&rdquo;, &ldquo;compress&rdquo;, &ldquo;photo&rdquo;, &ldquo;pdf&rdquo;, or &ldquo;age&rdquo;.
              </p>
            </div>
          ) : (
            filteredTools.map(tool => (
              <div
                key={tool.id}
                onClick={() => handleSelectTool(tool.slug)}
                className="group flex items-center justify-between p-3 rounded-2xl hover:bg-blue-50/70 dark:hover:bg-slate-800/70 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 group-hover:bg-blue-100 group-hover:text-blue-600 flex items-center justify-center shrink-0 transition-colors">
                    <DynamicIcon name={tool.icon} className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate group-hover:text-blue-600 transition-colors">
                        {tool.name}
                      </h4>
                      {tool.isGovt && (
                        <span className="text-[10px] text-blue-700 dark:text-blue-300 font-semibold bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.2 rounded">
                          Govt
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {tool.shortDescription}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <span className="text-[11px] text-slate-400 hidden sm:inline">
                    {tool.categoryName}
                  </span>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      toggleFavorite(tool.slug);
                    }}
                    className="p-1.5 text-slate-400 hover:text-blue-500 rounded-md transition-colors"
                    title="Toggle Favourite"
                  >
                    <Heart className={`w-4 h-4 ${isFavorite(tool.slug) ? 'fill-blue-500 text-blue-500' : ''}`} />
                  </button>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 flex items-center justify-between">
          <span>Showing {filteredTools.length} of {TOOLS.length} total tools</span>
          <span>Press ESC to close</span>
        </div>
      </div>
    </div>
  );
};
