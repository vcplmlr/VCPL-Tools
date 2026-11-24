import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CarFront,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Copy,
  Database,
  Filter,
  HelpCircle,
  History,
  Info,
  Loader2,
  Lock,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import {
  INDIA_RTO_RECORDS,
  RtoRecord,
  getTerritoryTypeForRecord,
} from '../../data/rtoDatabase';
import { INDIA_STATES_AND_UTS, TerritoryType } from '../../data/statesAndUts';
import { useTheme } from '../../hooks/useTheme';
import { evaluateRtoSearch, normalizeRtoCodeInput } from '../../utils/rtoSearch';
import { ThemeSelector } from '../ThemeSelector';
import { DirectoryAdminPanel } from './DirectoryAdminPanel';
import { RtoHighlightText } from './RtoHighlightText';
import { RtoResultCard } from './RtoResultCard';
import { RtoStateDirectorySection } from './RtoStateDirectorySection';
import { ToolPasscodeGate } from './ToolPasscodeGate';

interface RtoCodeFinderViewProps {
  initialCode?: string;
  isVaultUnlocked?: boolean;
  onSyncUrlCode?: (code: string | null) => void;
  onBack?: () => void;
}

type SortOption = 'code-asc' | 'state-asc' | 'city-asc';
type StatusFilter = 'all' | 'active' | 'historical';
type TerritoryFilter = 'All' | TerritoryType;

const FAVORITES_KEY = 'vcpl_rto_favorites_v1';
const RECENTS_KEY = 'vcpl_rto_recents_v1';
const HISTORY_KEY = 'vcpl_rto_search_history_v1';
const PAGE_SIZE = 12;

const QUICK_SEARCH_EXAMPLES = [
  'KA-19',
  'MH-12',
  'DL-01',
  'TN-09',
  'KL-07',
  'KA19AB1234',
];

const EDUCATIONAL_FAQS = [
  {
    q: 'What is an RTO in India?',
    a: 'A Regional Transport Office (RTO) or District Transport Office (DTO / RLA / RTA) is the state-level government authority responsible for registering motor vehicles, issuing driving licences, collecting road tax, and enforcing provisions of the Motor Vehicles Act, 1988.',
  },
  {
    q: 'What is an RTO registration code?',
    a: 'An RTO registration code is the first four characters of a standard Indian vehicle number plate—combining a 2-letter State/Union Territory code (such as KA for Karnataka or MH for Maharashtra) and a 2-digit RTO office code (such as 19 for Mangaluru or 12 for Pune).',
  },
  {
    q: 'What is the difference between an RTO code and a vehicle registration number?',
    a: 'The RTO code (for example, KA-19) identifies the registering transport office and district jurisdiction. The full vehicle registration number (for example, KA-19-AB-1234) adds the alphabetical series and the 4-digit registration serial assigned to an individual vehicle.',
  },
  {
    q: 'Can this tool retrieve vehicle owner names or RC status?',
    a: 'No. This utility operates 100% locally in your browser using a structured RTO office dataset. When you enter a complete plate like KA19AB1234, it extracts the KA-19 prefix to identify the registering authority—it does not connect to Vahan or access confidential RC or owner records.',
  },
  {
    q: 'Why do some codes start with OR, UA, or TS while newer plates use OD, UK, or TG?',
    a: 'Several states updated their official two-letter transport prefixes: Odisha changed OR to OD (2012), Uttarakhand changed UA to UK (2007), and Telangana transitioned from TS to TG (2024). Older plates remain legally valid, and this finder recognizes both prefixes.',
  },
  {
    q: 'What is a BH (Bharat Series) number plate?',
    a: 'Introduced by MoRTH for eligible central/state employees and transferable private-sector staff, BH-series plates follow the format YY BH #### XX (e.g., 22BH1234AA). Because BH plates are nationally valid across states, they do not carry a state RTO code.',
  },
];

function readJsonArray(key: string): string[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeJsonArray(key: string, items: string[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // Ignore storage write restriction
  }
}

export function RtoCodeFinderView({
  initialCode,
  isVaultUnlocked = false,
  onSyncUrlCode,
  onBack,
}: RtoCodeFinderViewProps) {
  return (
    <ToolPasscodeGate
      toolCode="UT-43"
      toolTitle="India RTO Code Finder"
      sessionKey="vcpl_rto_admin_unlocked"
      verifyWithServerAdminAuth
      bypassGate={isVaultUnlocked}
      description="This directory tool is restricted for authorized administrative access only. Enter the 6-digit admin passcode to open India RTO Code Finder."
      onBack={onBack}
    >
      {({ lockTool }) => (
        <RtoCodeFinderUnlocked
          initialCode={initialCode}
          onSyncUrlCode={onSyncUrlCode}
          lockTool={lockTool}
        />
      )}
    </ToolPasscodeGate>
  );
}

function RtoCodeFinderUnlocked({
  initialCode,
  onSyncUrlCode,
  lockTool,
}: {
  initialCode?: string;
  onSyncUrlCode?: (code: string | null) => void;
  lockTool: () => void;
}) {
  const { preference, setPreference } = useTheme();

  const [query, setQuery] = useState<string>(() => initialCode || '');
  const [debouncedQuery, setDebouncedQuery] = useState<string>(() => initialCode || '');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Filter states
  const [territoryFilter, setTerritoryFilter] = useState<TerritoryFilter>('All');
  const [selectedState, setSelectedState] = useState<string>('ALL');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('ALL');
  const [selectedRtoCode, setSelectedRtoCode] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('code-asc');
  const [showMobileFilters, setShowMobileFilters] = useState<boolean>(false);
  const [showOnlyFavorites, setShowOnlyFavorites] = useState<boolean>(false);

  const [rtoRecords, setRtoRecords] = useState<RtoRecord[]>(INDIA_RTO_RECORDS);
  const [showAdminPanel, setShowAdminPanel] = useState<boolean>(false);

  const rtoByCodeMap = useMemo(
    () => new Map(rtoRecords.map((rec) => [rec.code.toUpperCase(), rec])),
    [rtoRecords]
  );

  const rtoMetadata = useMemo(() => {
    const activeRecords = rtoRecords.filter((r) => r.status === 'active').length;
    const historicalRecords = rtoRecords.filter((r) => r.status === 'historical').length;
    const statesSet = new Set(rtoRecords.map((r) => r.state).filter(Boolean));
    return {
      totalRecords: rtoRecords.length,
      activeRecords,
      historicalRecords,
      statesAndUtsCovered: statesSet.size || INDIA_STATES_AND_UTS.length,
      totalStatesAndUts: INDIA_STATES_AND_UTS.length,
    };
  }, [rtoRecords]);

  const loadRtoRecords = useCallback(async () => {
    try {
      const res = await fetch('/api/rto/records');
      if (res.ok) {
        const json = (await res.json()) as { records?: RtoRecord[] };
        if (Array.isArray(json.records) && json.records.length > 0) {
          setRtoRecords(json.records);
        }
      }
    } catch {
      // Safe fallback to local static baseline records if API unavailable
    }
  }, []);

  useEffect(() => {
    void loadRtoRecords();
  }, [loadRtoRecords]);

  // Pagination & inspected detail
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [inspectedRecord, setInspectedRecord] = useState<RtoRecord | null>(() => {
    if (!initialCode) return null;
    const norm = normalizeRtoCodeInput(initialCode);
    return norm ? rtoByCodeMap.get(norm) ?? null : null;
  });

  // Autocomplete UI state
  const [isSuggestOpen, setIsSuggestOpen] = useState<boolean>(false);
  const [activeSuggestIndex, setActiveSuggestIndex] = useState<number>(-1);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const lastSyncedCodeRef = useRef<string | undefined>(
    initialCode ? normalizeRtoCodeInput(initialCode) ?? initialCode : undefined
  );

  // Local persistence states
  const [favorites, setFavorites] = useState<string[]>(() =>
    typeof window === 'undefined' ? [] : readJsonArray(FAVORITES_KEY)
  );
  const [recentCodes, setRecentCodes] = useState<string[]>(() =>
    typeof window === 'undefined' ? [] : readJsonArray(RECENTS_KEY)
  );
  const [searchHistory, setSearchHistory] = useState<string[]>(() =>
    typeof window === 'undefined' ? [] : readJsonArray(HISTORY_KEY)
  );

  // Directory & FAQ UI state
  const [directoryState, setDirectoryState] = useState<string>('Karnataka');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [copiedRowCode, setCopiedRowCode] = useState<string | null>(null);

  // Sync external initialCode changes (e.g. browser back/forward) without overwriting full-plate query
  useEffect(() => {
    const normalizedProp = initialCode
      ? normalizeRtoCodeInput(initialCode) ?? initialCode
      : undefined;
    if (normalizedProp === lastSyncedCodeRef.current) {
      return;
    }
    lastSyncedCodeRef.current = normalizedProp;

    if (initialCode) {
      setQuery(initialCode);
      setDebouncedQuery(initialCode);
      const norm = normalizeRtoCodeInput(initialCode);
      if (norm && rtoByCodeMap.has(norm)) {
        setInspectedRecord(rtoByCodeMap.get(norm) ?? null);
      } else {
        setInspectedRecord(null);
      }
    } else {
      setQuery('');
      setDebouncedQuery('');
      setInspectedRecord(null);
    }
  }, [initialCode, rtoByCodeMap]);

  // Smooth fast debounce for live typing with brief loading state indicator
  useEffect(() => {
    if (query === debouncedQuery) return;
    setIsProcessing(true);
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query);
      setCurrentPage(1);
      setIsProcessing(false);
    }, 90);
    return () => window.clearTimeout(timer);
  }, [query, debouncedQuery]);

  // Outside click closes autocomplete suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(event.target as Node)) {
        setIsSuggestOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const recordRecentRto = (code: string) => {
    setRecentCodes((prev) => {
      const next = [code, ...prev.filter((c) => c !== code)].slice(0, 8);
      writeJsonArray(RECENTS_KEY, next);
      return next;
    });
  };

  const recordSearchHistory = (term: string) => {
    const clean = term.trim();
    if (!clean || clean.length < 2) return;
    setSearchHistory((prev) => {
      const next = [clean, ...prev.filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(
        0,
        10
      );
      writeJsonArray(HISTORY_KEY, next);
      return next;
    });
  };

  const toggleFavorite = (code: string) => {
    setFavorites((prev) => {
      const next = prev.includes(code) ? prev.filter((c) => c !== code) : [code, ...prev];
      writeJsonArray(FAVORITES_KEY, next);
      return next;
    });
  };

  // Cascading filter dropdown options
  const availableStates = useMemo(() => {
    return INDIA_STATES_AND_UTS.filter(
      (s) => territoryFilter === 'All' || s.territoryType === territoryFilter
    ).sort((a, b) => a.state.localeCompare(b.state));
  }, [territoryFilter]);

  const availableDistricts = useMemo(() => {
    const set = new Set<string>();
    rtoRecords.forEach((rec) => {
      if (territoryFilter !== 'All' && getTerritoryTypeForRecord(rec) !== territoryFilter) return;
      if (selectedState !== 'ALL' && rec.state !== selectedState) return;
      if (rec.district) set.add(rec.district);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rtoRecords, territoryFilter, selectedState]);

  const availableRtoCodes = useMemo(() => {
    return rtoRecords.filter((rec) => {
      if (territoryFilter !== 'All' && getTerritoryTypeForRecord(rec) !== territoryFilter)
        return false;
      if (selectedState !== 'ALL' && rec.state !== selectedState) return false;
      if (selectedDistrict !== 'ALL' && rec.district !== selectedDistrict) return false;
      return true;
    }).map((rec) => rec.code);
  }, [rtoRecords, territoryFilter, selectedState, selectedDistrict]);

  // Pre-filter pool using all active dropdown & toggle filters together
  const filteredPool = useMemo(() => {
    return rtoRecords.filter((rec) => {
      if (showOnlyFavorites && !favorites.includes(rec.code)) return false;
      if (territoryFilter !== 'All' && getTerritoryTypeForRecord(rec) !== territoryFilter)
        return false;
      if (selectedState !== 'ALL' && rec.state !== selectedState) return false;
      if (selectedDistrict !== 'ALL' && rec.district !== selectedDistrict) return false;
      if (selectedRtoCode !== 'ALL' && rec.code !== selectedRtoCode) return false;
      if (statusFilter !== 'all' && rec.status !== statusFilter) return false;
      return true;
    });
  }, [
    rtoRecords,
    showOnlyFavorites,
    favorites,
    territoryFilter,
    selectedState,
    selectedDistrict,
    selectedRtoCode,
    statusFilter,
  ]);

  // Evaluate search query against filteredPool
  const searchEval = useMemo(() => {
    return evaluateRtoSearch(debouncedQuery, filteredPool, rtoByCodeMap);
  }, [debouncedQuery, filteredPool, rtoByCodeMap]);

  // Sort results cleanly
  const sortedMatches = useMemo(() => {
    const arr = [...searchEval.matches];
    if (sortBy === 'state-asc') {
      arr.sort((a, b) => a.state.localeCompare(b.state) || a.code.localeCompare(b.code));
    } else if (sortBy === 'city-asc') {
      arr.sort((a, b) => a.city.localeCompare(b.city) || a.code.localeCompare(b.code));
    } else if (!debouncedQuery.trim()) {
      arr.sort((a, b) => a.code.localeCompare(b.code));
    }
    return arr;
  }, [searchEval.matches, sortBy, debouncedQuery]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(sortedMatches.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedMatches = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return sortedMatches.slice(start, start + PAGE_SIZE);
  }, [sortedMatches, safePage]);

  // Primary card to showcase: exact search match OR explicitly inspected row
  const primaryDisplayRecord = inspectedRecord ?? searchEval.exactMatch;

  // Smart autocomplete suggestions while typing
  const autocompleteItems = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    const evalNow = evaluateRtoSearch(q, rtoRecords, rtoByCodeMap);
    if (evalNow.exactMatch) return [evalNow.exactMatch];
    return evalNow.matches.slice(0, 6);
  }, [query, rtoRecords, rtoByCodeMap]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (territoryFilter !== 'All') count += 1;
    if (selectedState !== 'ALL') count += 1;
    if (selectedDistrict !== 'ALL') count += 1;
    if (selectedRtoCode !== 'ALL') count += 1;
    if (statusFilter !== 'all') count += 1;
    if (showOnlyFavorites) count += 1;
    return count;
  }, [
    territoryFilter,
    selectedState,
    selectedDistrict,
    selectedRtoCode,
    statusFilter,
    showOnlyFavorites,
  ]);

  const syncUrl = (code: string | null) => {
    lastSyncedCodeRef.current = code ?? undefined;
    onSyncUrlCode?.(code);
  };

  const handleSelectRecord = (record: RtoRecord, customQuery?: string) => {
    setInspectedRecord(record);
    recordRecentRto(record.code);
    const nextQ = customQuery ?? record.code;
    setQuery(nextQ);
    setDebouncedQuery(nextQ);
    setIsSuggestOpen(false);
    setActiveSuggestIndex(-1);
    syncUrl(record.code);
  };

  const handleSearchSubmit = (event?: FormEvent) => {
    event?.preventDefault();
    setIsSuggestOpen(false);
    const trimmed = query.trim();
    setDebouncedQuery(trimmed);
    setCurrentPage(1);

    if (!trimmed) {
      setInspectedRecord(null);
      syncUrl(null);
      return;
    }

    recordSearchHistory(trimmed);
    const evaluated = evaluateRtoSearch(trimmed, filteredPool, rtoByCodeMap);
    if (evaluated.exactMatch) {
      setInspectedRecord(evaluated.exactMatch);
      recordRecentRto(evaluated.exactMatch.code);
      syncUrl(evaluated.exactMatch.code);
    } else {
      setInspectedRecord(null);
      syncUrl(null);
    }
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!isSuggestOpen || autocompleteItems.length === 0) {
      if (event.key === 'Escape') {
        setIsSuggestOpen(false);
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveSuggestIndex((prev) => (prev + 1) % autocompleteItems.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveSuggestIndex((prev) =>
        prev <= 0 ? autocompleteItems.length - 1 : prev - 1
      );
    } else if (event.key === 'Enter' && activeSuggestIndex >= 0) {
      event.preventDefault();
      const chosen = autocompleteItems[activeSuggestIndex];
      if (chosen) {
        recordSearchHistory(chosen.code);
        handleSelectRecord(chosen);
      }
    } else if (event.key === 'Escape') {
      setIsSuggestOpen(false);
      setActiveSuggestIndex(-1);
    }
  };

  const handleClearSearch = () => {
    setQuery('');
    setDebouncedQuery('');
    setInspectedRecord(null);
    setIsSuggestOpen(false);
    setCurrentPage(1);
    syncUrl(null);
    searchInputRef.current?.focus();
  };

  const handleClearFilters = () => {
    setTerritoryFilter('All');
    setSelectedState('ALL');
    setSelectedDistrict('ALL');
    setSelectedRtoCode('ALL');
    setStatusFilter('all');
    setSortBy('code-asc');
    setShowOnlyFavorites(false);
    setCurrentPage(1);
  };

  const handleQuickTry = (term: string) => {
    setQuery(term);
    setDebouncedQuery(term);
    setCurrentPage(1);
    setIsSuggestOpen(false);
    recordSearchHistory(term);
    const evaluated = evaluateRtoSearch(term, rtoRecords, rtoByCodeMap);
    if (evaluated.exactMatch) {
      setInspectedRecord(evaluated.exactMatch);
      recordRecentRto(evaluated.exactMatch.code);
      syncUrl(evaluated.exactMatch.code);
    } else {
      setInspectedRecord(null);
      syncUrl(null);
    }
  };

  const handleJumpToStateDirectory = (stateName: string) => {
    setDirectoryState(stateName);
    const el = document.getElementById('state-rto-directory');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleCopyRowCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedRowCode(code);
      window.setTimeout(() => setCopiedRowCode(null), 1500);
    } catch {
      // Ignore clipboard restriction
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Tool Hero Header Card (VCPL Tools native style) */}
      <div className="bg-[#FFFDF5] dark:bg-slate-900 border-[1.5px] border-[#2F3E4E] dark:border-slate-600 rounded-2xl p-5 sm:p-7 shadow-[0_5px_0_#2F3E4E] dark:shadow-[0_5px_0_#020617] space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] shadow-[0_2px_0_#2F3E4E] text-[#2F3E4E] flex items-center justify-center shrink-0">
              <CarFront className="w-6 h-6" aria-hidden="true" />
            </div>

            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#475569] dark:text-slate-300">
                <span className="font-mono font-bold text-[#2F3E4E] dark:text-[#F9C80E]">
                  UT-43
                </span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#2F3E4E] text-[11px] font-bold text-[#F9C80E]">
                  <Lock className="w-3 h-3" aria-hidden="true" />
                  <span>Admin Passcode Unlocked</span>
                </span>
                <span aria-hidden="true">·</span>
                <span>All {rtoMetadata.totalStatesAndUts} States &amp; UTs</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {rtoMetadata.totalRecords.toLocaleString('en-IN')} Verified RTO Records
                </span>
              </div>

              <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-[#2F3E4E] dark:text-slate-100 tracking-tight [text-wrap:balance]">
                India RTO Code Finder
              </h1>

              <p className="text-xs sm:text-sm text-[#475569] dark:text-slate-300 max-w-2xl leading-relaxed">
                Search verified Indian Regional Transport Office (RTO) codes, cities, districts,
                states, or parse full vehicle registration numbers (such as{' '}
                <span className="font-mono font-semibold text-[#2F3E4E] dark:text-slate-100">
                  KA19AB1234
                </span>
                ) directly from the registry.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={lockTool}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-500 bg-[#FEF2C8] dark:bg-slate-800 hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] dark:text-slate-100 dark:hover:text-[#2F3E4E] cursor-pointer transition"
            >
              <Lock className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Lock Tool</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAdminPanel((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-500 text-xs font-bold cursor-pointer ${
                showAdminPanel
                  ? 'bg-[#2F3E4E] text-[#F9C80E]'
                  : 'bg-[#FEF2C8] dark:bg-slate-800 text-[#2F3E4E] dark:text-slate-100 hover:bg-[#F9C80E]'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Admin Import &amp; Stats</span>
            </button>
            <ThemeSelector preference={preference} onChange={setPreference} size="sm" />
          </div>
        </div>

        {/* Search Input Form + Autocomplete */}
        <form onSubmit={handleSearchSubmit} className="space-y-3">
          <div ref={searchBoxRef} className="relative">
            <label htmlFor="rto-main-search" className="sr-only">
              Search by RTO code, city, district, state, or full registration number
            </label>
            <Search
              className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-[#475569] dark:text-slate-400 pointer-events-none"
              aria-hidden="true"
            />
            <input
              ref={searchInputRef}
              id="rto-main-search"
              type="text"
              value={query}
              onFocus={() => setIsSuggestOpen(true)}
              onChange={(e) => {
                const nextVal = e.target.value;
                setQuery(nextVal);
                setInspectedRecord(null);
                setIsSuggestOpen(true);
                setActiveSuggestIndex(-1);
                if (!nextVal.trim()) {
                  syncUrl(null);
                }
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder="Enter RTO code (KA-19, KA19, KA 19), City (Mangaluru), State, or Plate (KA19AB1234)..."
              autoComplete="off"
              className="w-full pl-12 pr-28 py-3.5 min-h-[52px] rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-500 bg-white dark:bg-slate-800 text-sm sm:text-base text-[#2F3E4E] dark:text-slate-100 placeholder:text-[#64748B] dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2F3E4E] dark:focus:ring-[#F9C80E]"
            />

            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {query && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  aria-label="Clear search"
                  className="p-2 rounded-lg text-[#64748B] hover:text-[#2F3E4E] dark:hover:text-white hover:bg-[#FEF2C8] dark:hover:bg-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                type="submit"
                className="px-4 py-2 min-h-[38px] rounded-lg bg-[#2F3E4E] hover:bg-[#1E293B] text-[#F9C80E] text-xs font-bold border border-[#2F3E4E] transition-colors cursor-pointer whitespace-nowrap"
              >
                Search
              </button>
            </div>

            {/* Smart Autocomplete Dropdown */}
            {isSuggestOpen && autocompleteItems.length > 0 && (
              <div
                role="listbox"
                aria-label="RTO search suggestions"
                className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 bg-[#FFFDF5] dark:bg-slate-900 border-[1.5px] border-[#2F3E4E] dark:border-slate-600 rounded-xl shadow-[0_6px_0_#2F3E4E] dark:shadow-[0_6px_0_#020617] overflow-hidden"
              >
                {autocompleteItems.map((item, idx) => {
                  const isHighlighted = idx === activeSuggestIndex;
                  return (
                    <button
                      key={item.code}
                      type="button"
                      role="option"
                      aria-selected={isHighlighted}
                      onClick={() => {
                        recordSearchHistory(item.code);
                        handleSelectRecord(item);
                      }}
                      className={`w-full px-4 py-2.5 text-left flex items-center justify-between gap-3 text-xs border-b last:border-b-0 border-[#2F3E4E]/10 dark:border-slate-800 cursor-pointer ${
                        isHighlighted
                          ? 'bg-[#F9C80E] text-[#2F3E4E]'
                          : 'hover:bg-[#FEF2C8] dark:hover:bg-slate-800 text-[#2F3E4E] dark:text-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-mono font-extrabold px-2 py-0.5 rounded bg-[#2F3E4E] text-[#F9C80E] shrink-0">
                          {item.code}
                        </span>
                        <span className="font-semibold truncate">{item.officeName}</span>
                      </div>
                      <span className="text-[11px] opacity-80 shrink-0">
                        {item.city}, {item.stateCode}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick-Try Examples & Mobile Filter Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="font-semibold text-[#475569] dark:text-slate-400 mr-1">
                Try:
              </span>
              {QUICK_SEARCH_EXAMPLES.map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => handleQuickTry(sample)}
                  className="px-2.5 py-1 min-h-[32px] rounded-lg bg-[#FEF2C8] dark:bg-slate-800 hover:bg-[#F9C80E] dark:hover:bg-slate-700 border border-[#2F3E4E]/30 dark:border-slate-600 font-mono text-[11px] font-bold text-[#2F3E4E] dark:text-slate-100 transition-colors cursor-pointer"
                >
                  {sample}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowOnlyFavorites((prev) => !prev)}
                aria-pressed={showOnlyFavorites}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-500 text-xs font-bold transition-colors cursor-pointer ${
                  showOnlyFavorites
                    ? 'bg-[#F9C80E] text-[#2F3E4E]'
                    : 'bg-white dark:bg-slate-800 text-[#2F3E4E] dark:text-slate-200 hover:bg-[#FEF2C8] dark:hover:bg-slate-700'
                }`}
              >
                <Star
                  className={`w-3.5 h-3.5 ${showOnlyFavorites ? 'fill-[#2F3E4E]' : ''}`}
                  aria-hidden="true"
                />
                <span>Favourites ({favorites.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setShowMobileFilters((prev) => !prev)}
                aria-expanded={showMobileFilters}
                className="lg:hidden inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-500 bg-white dark:bg-slate-800 text-xs font-bold text-[#2F3E4E] dark:text-slate-100 cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
                <span>
                  Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                </span>
              </button>
            </div>
          </div>
        </form>

        {/* Recent RTOs & Search History Bar */}
        {(recentCodes.length > 0 || searchHistory.length > 0) && (
          <div className="pt-4 border-t border-[#2F3E4E]/15 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              {recentCodes.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 font-semibold text-[#475569] dark:text-slate-400">
                    <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Recent:</span>
                  </span>
                  {recentCodes.slice(0, 5).map((code) => {
                    const rec = rtoByCodeMap.get(code);
                    if (!rec) return null;
                    return (
                      <button
                        key={code}
                        type="button"
                        onClick={() => handleSelectRecord(rec)}
                        className="px-2 py-0.5 rounded-md bg-[#CEE5DC]/70 dark:bg-slate-800 border border-[#2F3E4E]/25 dark:border-slate-600 font-mono font-bold text-[11px] text-[#2F3E4E] dark:text-slate-100 hover:bg-[#F9C80E] dark:hover:bg-slate-700 cursor-pointer"
                      >
                        {code}
                      </button>
                    );
                  })}
                </div>
              )}

              {searchHistory.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 font-semibold text-[#475569] dark:text-slate-400 sm:ml-2">
                    <History className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>History:</span>
                  </span>
                  {searchHistory.slice(0, 4).map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => handleQuickTry(term)}
                      className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-[#2F3E4E]/20 dark:border-slate-600 text-[11px] text-[#475569] dark:text-slate-300 hover:text-[#2F3E4E] dark:hover:text-white hover:bg-[#FEF2C8] dark:hover:bg-slate-700 cursor-pointer"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setRecentCodes([]);
                setSearchHistory([]);
                writeJsonArray(RECENTS_KEY, []);
                writeJsonArray(HISTORY_KEY, []);
              }}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#64748B] hover:text-[#2F3E4E] dark:hover:text-slate-200 cursor-pointer self-start sm:self-auto shrink-0"
            >
              <Trash2 className="w-3 h-3" aria-hidden="true" />
              <span>Clear History</span>
            </button>
          </div>
        )}
      </div>

      {/* Collapsible Admin Import & Quality Panel */}
      {showAdminPanel && (
        <DirectoryAdminPanel
          dataset="rto"
          onImportCompleted={() => {
            void loadRtoRecords();
          }}
        />
      )}

      {/* Advanced Filters Bar */}
      <div
        className={`bg-[#FFFDF5] dark:bg-slate-900 border-[1.5px] border-[#2F3E4E] dark:border-slate-600 rounded-2xl p-4 sm:p-5 shadow-[0_4px_0_#2F3E4E] dark:shadow-[0_4px_0_#020617] space-y-4 ${
          showMobileFilters ? 'block' : 'hidden lg:block'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-display font-extrabold text-[#2F3E4E] dark:text-slate-100">
            <Filter className="w-4 h-4 text-[#12805C] dark:text-emerald-400" aria-hidden="true" />
            <span>Filter &amp; Sort RTO Registry</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-bold text-[#475569] dark:text-slate-300 tabular-nums">
              {sortedMatches.length} {sortedMatches.length === 1 ? 'record' : 'records'}
            </span>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="px-3 py-1 rounded-lg bg-[#FFE1B3] dark:bg-slate-800 hover:bg-[#F9C80E] border border-[#2F3E4E] dark:border-slate-600 text-[11px] font-bold text-[#2F3E4E] dark:text-slate-100 cursor-pointer"
              >
                Clear Filters ({activeFilterCount})
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* Territory Type */}
          <div>
            <label
              htmlFor="filter-territory"
              className="block text-[11px] font-semibold text-[#475569] dark:text-slate-400 mb-1"
            >
              Region Type
            </label>
            <select
              id="filter-territory"
              value={territoryFilter}
              onChange={(e) => {
                setTerritoryFilter(e.target.value as TerritoryFilter);
                setSelectedState('ALL');
                setSelectedDistrict('ALL');
                setSelectedRtoCode('ALL');
                setCurrentPage(1);
              }}
              className="w-full min-h-[40px] px-2.5 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-medium text-[#2F3E4E] dark:text-slate-100"
            >
              <option value="All">All States &amp; UTs (36)</option>
              <option value="State">States Only (28)</option>
              <option value="Union Territory">Union Territories (8)</option>
            </select>
          </div>

          {/* State / UT */}
          <div>
            <label
              htmlFor="filter-state"
              className="block text-[11px] font-semibold text-[#475569] dark:text-slate-400 mb-1"
            >
              State / Union Territory
            </label>
            <select
              id="filter-state"
              value={selectedState}
              onChange={(e) => {
                setSelectedState(e.target.value);
                setSelectedDistrict('ALL');
                setSelectedRtoCode('ALL');
                setCurrentPage(1);
              }}
              className="w-full min-h-[40px] px-2.5 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-medium text-[#2F3E4E] dark:text-slate-100"
            >
              <option value="ALL">All ({availableStates.length})</option>
              {availableStates.map((st) => (
                <option key={st.stateCode} value={st.state}>
                  {st.state} ({st.stateCode})
                </option>
              ))}
            </select>
          </div>

          {/* District */}
          <div>
            <label
              htmlFor="filter-district"
              className="block text-[11px] font-semibold text-[#475569] dark:text-slate-400 mb-1"
            >
              District
            </label>
            <select
              id="filter-district"
              value={selectedDistrict}
              onChange={(e) => {
                setSelectedDistrict(e.target.value);
                setSelectedRtoCode('ALL');
                setCurrentPage(1);
              }}
              className="w-full min-h-[40px] px-2.5 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-medium text-[#2F3E4E] dark:text-slate-100"
            >
              <option value="ALL">All Districts ({availableDistricts.length})</option>
              {availableDistricts.map((dist) => (
                <option key={dist} value={dist}>
                  {dist}
                </option>
              ))}
            </select>
          </div>

          {/* RTO Code */}
          <div>
            <label
              htmlFor="filter-rto-code"
              className="block text-[11px] font-semibold text-[#475569] dark:text-slate-400 mb-1"
            >
              RTO Code
            </label>
            <select
              id="filter-rto-code"
              value={selectedRtoCode}
              onChange={(e) => {
                const code = e.target.value;
                setSelectedRtoCode(code);
                setCurrentPage(1);
                if (code !== 'ALL' && rtoByCodeMap.has(code)) {
                  setInspectedRecord(rtoByCodeMap.get(code) ?? null);
                }
              }}
              className="w-full min-h-[40px] px-2.5 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-mono font-semibold text-[#2F3E4E] dark:text-slate-100"
            >
              <option value="ALL">All Codes ({availableRtoCodes.length})</option>
              {availableRtoCodes.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label
              htmlFor="filter-status"
              className="block text-[11px] font-semibold text-[#475569] dark:text-slate-400 mb-1"
            >
              Series Status
            </label>
            <select
              id="filter-status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as StatusFilter);
                setCurrentPage(1);
              }}
              className="w-full min-h-[40px] px-2.5 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-medium text-[#2F3E4E] dark:text-slate-100"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active RTOs</option>
              <option value="historical">Historical Prefixes</option>
            </select>
          </div>

          {/* Sort */}
          <div>
            <label
              htmlFor="filter-sort"
              className="block text-[11px] font-semibold text-[#475569] dark:text-slate-400 mb-1"
            >
              Sort By
            </label>
            <select
              id="filter-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="w-full min-h-[40px] px-2.5 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-medium text-[#2F3E4E] dark:text-slate-100"
            >
              <option value="code-asc">RTO Code (A–Z)</option>
              <option value="state-asc">State Name (A–Z)</option>
              <option value="city-asc">City Name (A–Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loading Indicator */}
      {isProcessing && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FFFDF5] dark:bg-slate-900 border border-[#2F3E4E]/25 dark:border-slate-700 text-xs font-semibold text-[#475569] dark:text-slate-300"
        >
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
          <span>Filtering RTO registry...</span>
        </div>
      )}

      {/* Special Notice: Bharat (BH) Series Plate */}
      {searchEval.parsed.isBhSeries && (
        <div className="bg-[#FFFDF5] dark:bg-slate-900 border-[1.5px] border-[#2F3E4E] dark:border-slate-600 rounded-2xl p-6 shadow-[0_4px_0_#2F3E4E] space-y-3">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-[#12805C] dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <h2 className="font-display font-extrabold text-lg text-[#2F3E4E] dark:text-slate-100">
                Bharat Series (BH) National Registration Detected
              </h2>
              <p className="text-xs sm:text-sm text-[#475569] dark:text-slate-300 leading-relaxed">
                This vehicle plate follows the central{' '}
                <strong className="font-mono text-[#2F3E4E] dark:text-slate-100">
                  YY BH #### XX
                </strong>{' '}
                format (Registration Year:{' '}
                <span className="font-mono font-bold">{searchEval.parsed.bhYear}</span>, Unique
                Number:{' '}
                <span className="font-mono font-bold">{searchEval.parsed.vehicleNumber}</span>). BH
                series vehicles do not map to a single state or district RTO code.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Unverified / Unconfirmed Sequential RTO Code Notice */}
      {searchEval.unverifiedCodeInfo && !primaryDisplayRecord && (
        <div className="bg-[#FFFDF5] dark:bg-slate-900 border-[1.5px] border-[#2F3E4E] dark:border-slate-600 rounded-2xl p-6 shadow-[0_4px_0_#2F3E4E] space-y-4">
          <div className="flex items-start gap-3">
            <AlertCircle
              className="w-5 h-5 text-[#B45309] dark:text-amber-400 shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div className="space-y-1.5">
              <div className="text-xs font-mono font-bold text-[#B45309] dark:text-amber-400">
                UNVERIFIED / NOT IN CONFIRMED REGISTRY · {searchEval.unverifiedCodeInfo.code}
              </div>
              <h2 className="font-display font-extrabold text-lg text-[#2F3E4E] dark:text-slate-100">
                {searchEval.unverifiedCodeInfo.code} is not confirmed in our local dataset
              </h2>
              <p className="text-xs sm:text-sm text-[#475569] dark:text-slate-300 leading-relaxed">
                {searchEval.unverifiedCodeInfo.reason}
              </p>
            </div>
          </div>

          {searchEval.suggestions.length > 0 && (
            <div className="pt-3 border-t border-[#2F3E4E]/15 dark:border-slate-700 space-y-2">
              <p className="text-xs font-bold text-[#2F3E4E] dark:text-slate-200">
                Verified RTOs in {searchEval.unverifiedCodeInfo.stateName}:
              </p>
              <div className="flex flex-wrap gap-2">
                {searchEval.suggestions.map((sug) => (
                  <button
                    key={sug.code}
                    type="button"
                    onClick={() => handleSelectRecord(sug)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FEF2C8] dark:bg-slate-800 hover:bg-[#F9C80E] border border-[#2F3E4E]/30 dark:border-slate-600 text-xs font-bold text-[#2F3E4E] dark:text-slate-100 cursor-pointer"
                  >
                    <span className="font-mono">{sug.code}</span>
                    <span>· {sug.city}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Primary Verified Result Card */}
      {primaryDisplayRecord && (
        <RtoResultCard
          record={primaryDisplayRecord}
          parsedPlate={searchEval.parsed}
          isFavorite={favorites.includes(primaryDisplayRecord.code)}
          onToggleFavorite={toggleFavorite}
          onSearchAnother={handleClearSearch}
          onSelectStateDirectory={handleJumpToStateDirectory}
        />
      )}

      {/* Directory Search Results Table / Empty / Error States */}
      {!searchEval.parsed.isBhSeries && (
        <div className="bg-[#FFFDF5] dark:bg-slate-900 border-[1.5px] border-[#2F3E4E] dark:border-slate-600 rounded-2xl overflow-hidden shadow-[0_4px_0_#2F3E4E] dark:shadow-[0_4px_0_#020617]">
          <div className="px-5 py-3.5 bg-[#CEE5DC]/50 dark:bg-slate-800 border-b border-[#2F3E4E]/20 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-display font-extrabold text-[#2F3E4E] dark:text-slate-100">
              <ShieldCheck className="w-4 h-4 text-[#12805C] dark:text-emerald-400" />
              <span>
                {debouncedQuery.trim()
                  ? `Search Results for "${debouncedQuery.trim()}"`
                  : 'Verified Indian RTO Registry'}
              </span>
            </div>
            <span className="font-mono text-xs font-bold text-[#475569] dark:text-slate-300 tabular-nums">
              Showing {paginatedMatches.length} of {sortedMatches.length}
            </span>
          </div>

          {sortedMatches.length === 0 && !searchEval.unverifiedCodeInfo ? (
            <div className="p-8 sm:p-10 text-center space-y-4">
              <div className="w-11 h-11 mx-auto rounded-xl bg-[#FFE1B3] dark:bg-slate-800 border border-[#2F3E4E]/40 dark:border-slate-600 flex items-center justify-center text-[#2F3E4E] dark:text-[#F9C80E]">
                <AlertCircle className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="space-y-1.5 max-w-lg mx-auto">
                <h3 className="font-display font-extrabold text-base sm:text-lg text-[#2F3E4E] dark:text-slate-100">
                  {searchEval.isInvalidCodePattern
                    ? `No valid Indian RTO prefix found for "${debouncedQuery.trim()}"`
                    : `No matching RTO offices found`}
                </h3>
                <p className="text-xs sm:text-sm text-[#475569] dark:text-slate-300">
                  {searchEval.isInvalidCodePattern
                    ? 'Indian RTO codes start with a valid 2-letter State or UT prefix followed by a 2-digit district code (for example KA-19, MH-12, DL-01, TN-09, KL-07).'
                    : 'Try clearing active filters or searching by city, district, state name, or normalized RTO code.'}
                </p>
              </div>

              {searchEval.suggestions.length > 0 && (
                <div className="pt-2 space-y-2">
                  <p className="text-xs font-bold text-[#475569] dark:text-slate-400">
                    Suggested Verified RTOs:
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {searchEval.suggestions.map((sug) => (
                      <button
                        key={sug.code}
                        type="button"
                        onClick={() => handleSelectRecord(sug)}
                        className="px-3 py-1.5 rounded-lg bg-[#FEF2C8] dark:bg-slate-800 hover:bg-[#F9C80E] border border-[#2F3E4E]/30 dark:border-slate-600 text-xs font-bold text-[#2F3E4E] dark:text-slate-100 cursor-pointer"
                      >
                        <span className="font-mono">{sug.code}</span> · {sug.city}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-1 flex justify-center gap-2">
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="px-4 py-2 rounded-xl bg-[#2F3E4E] text-[#F9C80E] text-xs font-bold cursor-pointer"
                  >
                    Reset All Filters
                  </button>
                )}
                {debouncedQuery && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="px-4 py-2 rounded-xl border border-[#2F3E4E] dark:border-slate-500 bg-white dark:bg-slate-800 text-xs font-bold text-[#2F3E4E] dark:text-slate-100 cursor-pointer"
                  >
                    Clear Search
                  </button>
                )}
              </div>
            </div>
          ) : sortedMatches.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#2F3E4E] text-[#FFFDF5]">
                    <tr>
                      <th className="py-3 px-4 font-semibold whitespace-nowrap">RTO Code</th>
                      <th className="py-3 px-4 font-semibold">RTO Office</th>
                      <th className="py-3 px-4 font-semibold">District</th>
                      <th className="py-3 px-4 font-semibold">City</th>
                      <th className="py-3 px-4 font-semibold">State / UT</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2F3E4E]/10 dark:divide-slate-800 bg-white dark:bg-slate-900">
                    {paginatedMatches.map((rec) => {
                      const isFav = favorites.includes(rec.code);
                      const isSelected = primaryDisplayRecord?.code === rec.code;
                      return (
                        <tr
                          key={rec.code}
                          className={`transition-colors ${
                            isSelected
                              ? 'bg-[#FEF2C8]/80 dark:bg-slate-800'
                              : 'hover:bg-[#FEF2C8]/45 dark:hover:bg-slate-800/60'
                          }`}
                        >
                          <td className="py-2.5 px-4 font-mono font-bold text-[#2F3E4E] dark:text-slate-100 whitespace-nowrap tabular-nums">
                            <button
                              type="button"
                              onClick={() => handleSelectRecord(rec)}
                              className="hover:underline underline-offset-2 cursor-pointer"
                            >
                              <RtoHighlightText text={rec.code} query={debouncedQuery} />
                            </button>
                          </td>
                          <td className="py-2.5 px-4 font-semibold text-[#2F3E4E] dark:text-slate-100">
                            <RtoHighlightText text={rec.officeName} query={debouncedQuery} />
                          </td>
                          <td className="py-2.5 px-4 text-[#475569] dark:text-slate-300">
                            <RtoHighlightText text={rec.district} query={debouncedQuery} />
                          </td>
                          <td className="py-2.5 px-4 text-[#475569] dark:text-slate-300 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-[#64748B]" aria-hidden="true" />
                              <RtoHighlightText text={rec.city} query={debouncedQuery} />
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-[#2F3E4E] dark:text-slate-200 whitespace-nowrap">
                            <RtoHighlightText text={rec.state} query={debouncedQuery} />{' '}
                            <span className="font-mono text-[11px] text-[#64748B] dark:text-slate-400">
                              ({rec.stateCode})
                            </span>
                          </td>
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            <span
                              className={`text-[11px] font-semibold ${
                                rec.status === 'active'
                                  ? 'text-[#12805C] dark:text-emerald-400'
                                  : 'text-[#B45309] dark:text-amber-400'
                              }`}
                            >
                              {rec.status === 'active' ? 'Active' : 'Historical'}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleCopyRowCode(rec.code)}
                                aria-label={`Copy ${rec.code}`}
                                className="p-1.5 rounded-lg border border-[#2F3E4E]/25 dark:border-slate-600 hover:bg-[#FEF2C8] dark:hover:bg-slate-700 text-[#2F3E4E] dark:text-slate-200 cursor-pointer"
                              >
                                {copiedRowCode === rec.code ? (
                                  <Check className="w-3.5 h-3.5 text-[#12805C]" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleFavorite(rec.code)}
                                aria-label={
                                  isFav
                                    ? `Remove ${rec.code} from favourites`
                                    : `Add ${rec.code} to favourites`
                                }
                                className="p-1.5 rounded-lg border border-[#2F3E4E]/25 dark:border-slate-600 hover:bg-[#F9C80E]/50 text-[#2F3E4E] dark:text-slate-200 cursor-pointer"
                              >
                                <Star
                                  className={`w-3.5 h-3.5 ${
                                    isFav ? 'fill-[#F9C80E] text-[#2F3E4E] dark:text-[#F9C80E]' : ''
                                  }`}
                                />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSelectRecord(rec)}
                                className="px-2.5 py-1 rounded-lg bg-[#2F3E4E] hover:bg-[#1E293B] text-[#F9C80E] text-[11px] font-bold cursor-pointer"
                              >
                                Inspect
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer */}
              {totalPages > 1 && (
                <div className="px-5 py-3.5 bg-[#FEF2C8]/50 dark:bg-slate-800/70 border-t border-[#2F3E4E]/15 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <span className="font-mono font-semibold text-[#475569] dark:text-slate-300 tabular-nums">
                    Page {safePage} of {totalPages}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={safePage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-slate-900 disabled:opacity-40 text-xs font-bold text-[#2F3E4E] dark:text-slate-100 cursor-pointer disabled:cursor-default"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Prev</span>
                    </button>
                    <button
                      type="button"
                      disabled={safePage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-slate-900 disabled:opacity-40 text-xs font-bold text-[#2F3E4E] dark:text-slate-100 cursor-pointer disabled:cursor-default"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      )}

      {/* State-Wise Directory (All 36 States & Union Territories) */}
      <RtoStateDirectorySection
        records={rtoRecords}
        selectedStateName={directoryState}
        onSelectStateName={setDirectoryState}
        onInspectRecord={(rec) => {
          handleSelectRecord(rec);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        favorites={favorites}
        onToggleFavorite={toggleFavorite}
      />

      {/* Dataset Coverage & Verification Transparency Disclosure */}
      <div className="bg-[#FFE1B3]/65 dark:bg-slate-900 border-[1.5px] border-[#2F3E4E] dark:border-slate-600 rounded-2xl p-5 flex items-start gap-3 text-xs text-[#2F3E4E] dark:text-slate-200">
        <Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-1 leading-relaxed">
          <div className="font-display font-extrabold">
            Dataset Scope &amp; Verification Disclosure
          </div>
          <p className="text-[#334155] dark:text-slate-300">
            This SQLite-backed registry currently includes{' '}
            <strong className="font-mono tabular-nums">
              {rtoMetadata.totalRecords.toLocaleString('en-IN')}
            </strong>{' '}
            verified primary and district RTO records spanning all{' '}
            <strong className="font-mono tabular-nums">{rtoMetadata.statesAndUtsCovered}</strong>{' '}
            Indian States and Union Territories (
            <span className="font-mono tabular-nums">{rtoMetadata.activeRecords}</span> active
            and{' '}
            <span className="font-mono tabular-nums">{rtoMetadata.historicalRecords}</span>{' '}
            historical series). Sequential code numbers that have not been individually confirmed
            are intentionally excluded rather than guessed, and office street addresses are marked{' '}
            <em>Not available</em> unless verified. Administrators can upload verified CSV, XLSX,
            or JSON updates directly using the Admin Import &amp; Stats console above.
          </p>
        </div>
      </div>

      {/* Educational & Reference Information Section */}
      <section
        aria-labelledby="rto-education-heading"
        className="bg-[#FFFDF5] dark:bg-slate-900 border-[1.5px] border-[#2F3E4E] dark:border-slate-600 rounded-2xl p-5 sm:p-8 shadow-[0_4px_0_#2F3E4E] dark:shadow-[0_4px_0_#020617] space-y-7"
      >
        <div className="space-y-2 pb-5 border-b border-[#2F3E4E]/15 dark:border-slate-700">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#12805C] dark:text-emerald-400">
            <BookOpen className="w-4 h-4" aria-hidden="true" />
            <span>Indian Motor Vehicle Registration Reference</span>
          </div>
          <h2
            id="rto-education-heading"
            className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] dark:text-slate-100 tracking-tight"
          >
            Understanding Indian RTO Codes &amp; Registration Numbers
          </h2>
        </div>

        {/* Visual Breakdown of Indian Registration Number */}
        <div className="bg-[#FEF2C8]/60 dark:bg-slate-800/70 border-[1.5px] border-[#2F3E4E] dark:border-slate-600 rounded-2xl p-5 space-y-4">
          <h3 className="font-display font-extrabold text-base text-[#2F3E4E] dark:text-slate-100">
            How Are Indian Vehicle Registration Numbers Structured?
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-slate-900 border-[1.5px] border-[#2F3E4E] dark:border-slate-600 rounded-xl p-3.5 space-y-1">
              <div className="font-mono text-xl font-extrabold text-[#2F3E4E] dark:text-[#F9C80E]">
                KA
              </div>
              <div className="text-xs font-bold text-[#2F3E4E] dark:text-slate-100">
                1. State / UT Code
              </div>
              <p className="text-[11px] text-[#475569] dark:text-slate-300 leading-relaxed">
                Two uppercase letters identifying the State or Union Territory (e.g., KA = Karnataka).
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 border-[1.5px] border-[#2F3E4E] dark:border-slate-600 rounded-xl p-3.5 space-y-1">
              <div className="font-mono text-xl font-extrabold text-[#2F3E4E] dark:text-[#F9C80E]">
                19
              </div>
              <div className="text-xs font-bold text-[#2F3E4E] dark:text-slate-100">
                2. RTO District Code
              </div>
              <p className="text-[11px] text-[#475569] dark:text-slate-300 leading-relaxed">
                Two digits denoting the specific Regional or District Transport Office (e.g., 19 = Mangaluru).
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 border-[1.5px] border-[#2F3E4E] dark:border-slate-600 rounded-xl p-3.5 space-y-1">
              <div className="font-mono text-xl font-extrabold text-[#2F3E4E] dark:text-[#F9C80E]">
                AB
              </div>
              <div className="text-xs font-bold text-[#2F3E4E] dark:text-slate-100">
                3. Series Letters
              </div>
              <p className="text-[11px] text-[#475569] dark:text-slate-300 leading-relaxed">
                One to three letters cycling alphabetically as each block of 9,999 numbers fills.
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 border-[1.5px] border-[#2F3E4E] dark:border-slate-600 rounded-xl p-3.5 space-y-1">
              <div className="font-mono text-xl font-extrabold text-[#2F3E4E] dark:text-[#F9C80E]">
                1234
              </div>
              <div className="text-xs font-bold text-[#2F3E4E] dark:text-slate-100">
                4. Vehicle Serial
              </div>
              <p className="text-[11px] text-[#475569] dark:text-slate-300 leading-relaxed">
                Unique 1- to 4-digit serial number assigned to the vehicle within that series.
              </p>
            </div>
          </div>
        </div>

        {/* Core Informational Guides */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-white dark:bg-slate-800/60 border border-[#2F3E4E]/20 dark:border-slate-700 rounded-xl p-5 space-y-2">
            <h3 className="font-display font-bold text-base text-[#2F3E4E] dark:text-slate-100">
              What is an RTO &amp; Registration Code?
            </h3>
            <p className="text-xs sm:text-sm text-[#475569] dark:text-slate-300 leading-relaxed">
              A Regional Transport Office (RTO)—known as DTO in states like Bihar and Assam or RLA
              in Haryana and Chandigarh—is the district-level transport office maintaining vehicle
              records under the Motor Vehicles Act. Its 4-character registration code (such as{' '}
              <span className="font-mono font-semibold">MH-12</span> or{' '}
              <span className="font-mono font-semibold">KL-07</span>) indicates which office
              issued the registration certificate.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-800/60 border border-[#2F3E4E]/20 dark:border-slate-700 rounded-xl p-5 space-y-2">
            <h3 className="font-display font-bold text-base text-[#2F3E4E] dark:text-slate-100">
              How to Identify Your Registering Authority
            </h3>
            <p className="text-xs sm:text-sm text-[#475569] dark:text-slate-300 leading-relaxed">
              Check the first four characters printed on your Registration Certificate (RC) smart
              card or High Security Registration Plate (HSRP). Enter either the short prefix (like{' '}
              <span className="font-mono font-semibold">TN09</span>) or the complete number plate
              above to identify the registering office, district, and state.
            </p>
          </div>
        </div>

        {/* Interactive FAQs */}
        <div className="space-y-3 pt-4 border-t border-[#2F3E4E]/15 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-[#2F3E4E] dark:text-[#F9C80E]" />
            <h3 className="font-display font-extrabold text-lg text-[#2F3E4E] dark:text-slate-100">
              Frequently Asked Questions
            </h3>
          </div>

          <div className="space-y-2.5">
            {EDUCATIONAL_FAQS.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={faq.q}
                  className="bg-white dark:bg-slate-800/60 border border-[#2F3E4E]/25 dark:border-slate-700 rounded-xl overflow-hidden"
                >
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full px-4 py-3.5 text-left flex items-center justify-between gap-4 font-display font-bold text-xs sm:text-sm text-[#2F3E4E] dark:text-slate-100 hover:bg-[#FEF2C8]/50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 text-xs sm:text-[13px] leading-relaxed text-[#475569] dark:text-slate-300 border-t border-[#2F3E4E]/10 dark:border-slate-700 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
