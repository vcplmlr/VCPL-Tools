import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Database,
  Download,
  FileSpreadsheet,
  Filter,
  Info,
  Loader2,
  Mail,
  MapPin,
  Printer,
  RotateCcw,
  Search,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import {
  downloadCsvFile,
  downloadExcelFile,
  printStructuredTable,
  shareOrCopyLink,
} from '../../utils/directoryExport';
import { ThemeSelector } from '../ThemeSelector';
import { DirectoryAdminPanel } from './DirectoryAdminPanel';
import { RtoHighlightText } from './RtoHighlightText';

interface PinCodeFinderViewProps {
  initialPincode?: string;
  onSyncUrlPincode?: (pincode: string | null) => void;
}

export interface PincodeRecord {
  id: number;
  pincode: string;
  office_name: string;
  office_type: string;
  delivery_status: string;
  district: string;
  state: string;
  division: string;
  region: string;
  circle: string;
  taluk: string;
  postal_address: string;
  contact: string;
  latitude: number | null;
  longitude: number | null;
  verification_status: string;
  source: string;
  last_verified_at: string;
}

interface PincodeSearchResponse {
  items: PincodeRecord[];
  totalMatchingOffices: number;
  totalUniquePincodes: number;
  page: number;
  limit: number;
  totalPages: number;
  exactPincodeLookup: string | null;
  invalidPincodeAttempt: string | null;
  fallbackSource: string | null;
  queryDurationMs: number;
}

interface PincodeFacetsResponse {
  states: Array<{ state: string; officeCount: number; uniquePincodeCount: number }>;
  districts: Array<{ district: string; officeCount: number; uniquePincodeCount: number }>;
  officeTypes: Array<{ officeType: string; count: number }>;
  deliveryStatuses: Array<{ deliveryStatus: string; count: number }>;
}

interface PincodeStatsResponse {
  totalPostOffices: number;
  totalUniquePincodes: number;
  totalStatesAndUts: number;
  totalDistricts: number;
  deliveryOffices: number;
  nonDeliveryOffices: number;
  verifiedOffices: number;
  unverifiedOffices: number;
  lastUpdatedAt: string | null;
  stateWise: Array<{ state: string; officeCount: number; uniquePincodeCount: number }>;
  officeTypes: Array<{ officeType: string; count: number }>;
}

interface PincodeSuggestion {
  pincode: string;
  office_name: string;
  office_type: string;
  district: string;
  state: string;
}

const QUICK_PIN_EXAMPLES = ['575001', '110001', '400001', '560001', '600001', 'Mangaluru'];

export function PinCodeFinderView({
  initialPincode,
  onSyncUrlPincode,
}: PinCodeFinderViewProps) {
  const { preference, setPreference } = useTheme();

  const [query, setQuery] = useState<string>(() => initialPincode || '575001');
  const [debouncedQuery, setDebouncedQuery] = useState<string>(() => initialPincode || '575001');
  const [stateFilter, setStateFilter] = useState<string>('ALL');
  const [districtFilter, setDistrictFilter] = useState<string>('ALL');
  const [officeTypeFilter, setOfficeTypeFilter] = useState<string>('ALL');
  const [deliveryFilter, setDeliveryFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('pincode_asc');
  const [page, setPage] = useState<number>(1);
  const [showMobileFilters, setShowMobileFilters] = useState<boolean>(false);

  const [searchData, setSearchData] = useState<PincodeSearchResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [facets, setFacets] = useState<PincodeFacetsResponse | null>(null);
  const [stats, setStats] = useState<PincodeStatsResponse | null>(null);

  // Autocomplete UI
  const [suggestions, setSuggestions] = useState<PincodeSuggestion[]>([]);
  const [isSuggestOpen, setIsSuggestOpen] = useState<boolean>(false);
  const [activeSuggestIdx, setActiveSuggestIdx] = useState<number>(-1);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);

  // Expandable card metadata + copy feedback
  const [expandedIds, setExpandedIds] = useState<Record<number, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  // State/District Directory browser state
  const [directoryState, setDirectoryState] = useState<string>('Karnataka');
  const [directoryDistricts, setDirectoryDistricts] = useState<
    Array<{ district: string; officeCount: number; uniquePincodeCount: number }>
  >([]);
  const [showAdminPanel, setShowAdminPanel] = useState<boolean>(false);

  const lastSyncedRef = useRef<string | undefined>(initialPincode);

  useEffect(() => {
    if (initialPincode && initialPincode !== lastSyncedRef.current) {
      lastSyncedRef.current = initialPincode;
      setQuery(initialPincode);
      setDebouncedQuery(initialPincode);
      setPage(1);
    }
  }, [initialPincode]);

  // Debounce live search typing
  useEffect(() => {
    if (query === debouncedQuery) return;
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [query, debouncedQuery]);

  // Outside click closes suggestions
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setIsSuggestOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch('/api/pincodes/stats');
      if (res.ok) {
        const json = (await res.json()) as PincodeStatsResponse;
        setStats(json);
      }
    } catch {
      // Non-blocking stats load
    }
  }, []);

  const loadFacets = useCallback(async (selectedState: string) => {
    try {
      const qs = new URLSearchParams({ state: selectedState });
      const res = await fetch(`/api/pincodes/facets?${qs.toString()}`);
      if (res.ok) {
        const json = (await res.json()) as PincodeFacetsResponse;
        setFacets(json);
      }
    } catch {
      // Non-blocking facets load
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    void loadFacets(stateFilter);
  }, [stateFilter, loadFacets]);

  // Fetch districts for bottom directory selected state
  useEffect(() => {
    let active = true;
    const qs = new URLSearchParams({ state: directoryState });
    fetch(`/api/pincodes/facets?${qs.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json: PincodeFacetsResponse | null) => {
        if (active && json) {
          setDirectoryDistricts(json.districts || []);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [directoryState]);

  // Execute main server-side SQL search
  const executeSearch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        q: debouncedQuery.trim(),
        state: stateFilter,
        district: districtFilter,
        officeType: officeTypeFilter,
        deliveryStatus: deliveryFilter,
        sort: sortBy,
        page: String(page),
        limit: '18',
      });
      const res = await fetch(`/api/pincodes/search?${qs.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setSearchData(data as PincodeSearchResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to query India PIN Code database.');
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, stateFilter, districtFilter, officeTypeFilter, deliveryFilter, sortBy, page]);

  useEffect(() => {
    void executeSearch();
  }, [executeSearch]);

  // Fetch autocomplete suggestions while typing
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/pincodes/suggest?q=${encodeURIComponent(trimmed)}`
        );
        if (res.ok) {
          const data = (await res.json()) as { suggestions?: PincodeSuggestion[] };
          setSuggestions(data.suggestions || []);
        }
      } catch {
        setSuggestions([]);
      }
    }, 150);
    return () => window.clearTimeout(timer);
  }, [query]);

  const syncPinToUrl = (val: string) => {
    const clean = val.trim();
    if (/^[1-9]\d{5}$/.test(clean)) {
      lastSyncedRef.current = clean;
      onSyncUrlPincode?.(clean);
    } else {
      lastSyncedRef.current = undefined;
      onSyncUrlPincode?.(null);
    }
  };

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    setIsSuggestOpen(false);
    setDebouncedQuery(query);
    setPage(1);
    syncPinToUrl(query);
  };

  const handleQuickTry = (term: string) => {
    setQuery(term);
    setDebouncedQuery(term);
    setPage(1);
    setIsSuggestOpen(false);
    syncPinToUrl(term);
  };

  const handleResetFilters = () => {
    setQuery('');
    setDebouncedQuery('');
    setStateFilter('ALL');
    setDistrictFilter('ALL');
    setOfficeTypeFilter('ALL');
    setDeliveryFilter('ALL');
    setSortBy('pincode_asc');
    setPage(1);
    lastSyncedRef.current = undefined;
    onSyncUrlPincode?.(null);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isSuggestOpen || suggestions.length === 0) {
      if (e.key === 'Escape') setIsSuggestOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestIdx((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestIdx((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
    } else if (e.key === 'Enter' && activeSuggestIdx >= 0) {
      e.preventDefault();
      const chosen = suggestions[activeSuggestIdx];
      if (chosen) {
        setQuery(chosen.pincode);
        setDebouncedQuery(chosen.pincode);
        setPage(1);
        setIsSuggestOpen(false);
        syncPinToUrl(chosen.pincode);
      }
    } else if (e.key === 'Escape') {
      setIsSuggestOpen(false);
    }
  };

  const handleCopyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 1600);
    } catch {
      // Ignore clipboard error
    }
  };

  const buildCurrentQueryParams = () =>
    new URLSearchParams({
      q: debouncedQuery.trim(),
      state: stateFilter,
      district: districtFilter,
      officeType: officeTypeFilter,
      deliveryStatus: deliveryFilter,
    });

  const handleDownloadCsv = () => {
    if (!searchData || searchData.items.length === 0) return;
    if (searchData.totalMatchingOffices <= 5000) {
      window.location.assign(`/api/pincodes/export?${buildCurrentQueryParams().toString()}`);
      return;
    }
    downloadCsvFile(
      'india-pincode-page-results.csv',
      [
        'PIN Code',
        'Post Office Name',
        'Office Type',
        'Delivery Status',
        'District',
        'State',
        'Taluk',
        'Division',
        'Region',
        'Circle',
        'Postal Address',
        'Contact',
        'Source',
        'Last Verified',
      ],
      searchData.items.map((r) => [
        r.pincode,
        r.office_name,
        r.office_type,
        r.delivery_status,
        r.district,
        r.state,
        r.taluk || 'Not Available',
        r.division || 'Not Available',
        r.region || 'Not Available',
        r.circle || 'Not Available',
        r.postal_address,
        r.contact || 'Not Available',
        r.source,
        r.last_verified_at,
      ])
    );
  };

  const handleDownloadExcel = () => {
    if (!searchData || searchData.items.length === 0) return;
    downloadExcelFile(
      `india-pincodes-${debouncedQuery.trim() || 'filtered'}.xlsx`,
      'PIN Codes',
      [
        'PIN Code',
        'Post Office Name',
        'Office Type',
        'Delivery Status',
        'District',
        'State',
        'Taluk / Sub-District',
        'Division',
        'Region',
        'Circle',
        'Postal Address',
        'Contact',
        'Latitude',
        'Longitude',
        'Source',
        'Last Verified',
      ],
      searchData.items.map((r) => [
        r.pincode,
        r.office_name,
        r.office_type,
        r.delivery_status,
        r.district,
        r.state,
        r.taluk || 'Not Available',
        r.division || 'Not Available',
        r.region || 'Not Available',
        r.circle || 'Not Available',
        r.postal_address,
        r.contact || 'Not Available',
        r.latitude ?? '',
        r.longitude ?? '',
        r.source,
        r.last_verified_at,
      ])
    );
  };

  const handlePrintResults = () => {
    if (!searchData || searchData.items.length === 0) return;
    printStructuredTable(
      'India PIN Code Search Results',
      `Query: ${debouncedQuery.trim() || 'All'} | Matching Offices: ${searchData.totalMatchingOffices.toLocaleString(
        'en-IN'
      )} | Unique PINs: ${searchData.totalUniquePincodes.toLocaleString('en-IN')}`,
      ['PIN Code', 'Post Office', 'Type', 'Delivery', 'District', 'State', 'Postal Address'],
      searchData.items.map((r) => [
        r.pincode,
        r.office_name,
        r.office_type,
        r.delivery_status,
        r.district,
        r.state,
        r.postal_address,
      ])
    );
  };

  const handleShareResults = async () => {
    const cleanPin = debouncedQuery.trim();
    const targetUrl = /^[1-9]\d{5}$/.test(cleanPin)
      ? `${window.location.origin}/tools/pin-code-finder/${cleanPin}`
      : window.location.href;
    const outcome = await shareOrCopyLink(
      'India PIN Code Finder | VCPL Tools',
      `India PIN Code directory search results for ${cleanPin || 'India Post offices'}`,
      targetUrl
    );
    if (outcome !== 'failed') {
      setShareStatus(outcome === 'shared' ? 'Shared!' : 'Link Copied');
      window.setTimeout(() => setShareStatus(null), 1800);
    }
  };

  const activeFilterCount =
    (stateFilter !== 'ALL' ? 1 : 0) +
    (districtFilter !== 'ALL' ? 1 : 0) +
    (officeTypeFilter !== 'ALL' ? 1 : 0) +
    (deliveryFilter !== 'ALL' ? 1 : 0);

  return (
    <div className="space-y-6">
      {/* Main Hero & Search Card (VCPL Tools native paper style) */}
      <div className="bg-[#FFFDF5] dark:bg-slate-900 border-[1.5px] border-[#2F3E4E] dark:border-slate-600 rounded-2xl p-5 sm:p-7 shadow-[0_5px_0_#2F3E4E] dark:shadow-[0_5px_0_#020617] space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] shadow-[0_2px_0_#2F3E4E] text-[#2F3E4E] flex items-center justify-center shrink-0">
              <Mail className="w-6 h-6" aria-hidden="true" />
            </div>

            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#475569] dark:text-slate-300">
                <span className="font-mono font-bold text-[#2F3E4E] dark:text-[#F9C80E]">
                  UT-44
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {stats
                    ? `${stats.totalUniquePincodes.toLocaleString('en-IN')} Unique PINs · ${stats.totalPostOffices.toLocaleString('en-IN')} Post Offices Imported`
                    : 'SQLite FTS5 Postal Database'}
                </span>
              </div>

              <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-[#2F3E4E] dark:text-slate-100 tracking-tight">
                India PIN Code Finder
              </h1>

              <p className="text-xs sm:text-sm text-[#475569] dark:text-slate-300 max-w-2xl leading-relaxed">
                Search verified Indian Post Offices by 6-digit PIN code, post office name, village,
                town, taluk, district, or state. Shows every post office sharing a PIN code.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
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

        {/* Live SQL Coverage Stats Row (Calculated directly from imported database records) */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1">
            <div className="bg-[#FEF2C8]/70 dark:bg-slate-800 border border-[#2F3E4E]/20 dark:border-slate-700 rounded-xl p-2.5">
              <div className="text-[11px] text-[#64748B] dark:text-slate-400">Unique PINs</div>
              <div className="font-mono font-extrabold text-sm text-[#2F3E4E] dark:text-slate-100 tabular-nums">
                {stats.totalUniquePincodes.toLocaleString('en-IN')}
              </div>
            </div>
            <div className="bg-[#FEF2C8]/70 dark:bg-slate-800 border border-[#2F3E4E]/20 dark:border-slate-700 rounded-xl p-2.5">
              <div className="text-[11px] text-[#64748B] dark:text-slate-400">Post Offices</div>
              <div className="font-mono font-extrabold text-sm text-[#2F3E4E] dark:text-slate-100 tabular-nums">
                {stats.totalPostOffices.toLocaleString('en-IN')}
              </div>
            </div>
            <div className="bg-[#FEF2C8]/70 dark:bg-slate-800 border border-[#2F3E4E]/20 dark:border-slate-700 rounded-xl p-2.5">
              <div className="text-[11px] text-[#64748B] dark:text-slate-400">States &amp; UTs</div>
              <div className="font-mono font-extrabold text-sm text-[#2F3E4E] dark:text-slate-100 tabular-nums">
                {stats.totalStatesAndUts.toLocaleString('en-IN')}
              </div>
            </div>
            <div className="bg-[#FEF2C8]/70 dark:bg-slate-800 border border-[#2F3E4E]/20 dark:border-slate-700 rounded-xl p-2.5">
              <div className="text-[11px] text-[#64748B] dark:text-slate-400">Delivery Offices</div>
              <div className="font-mono font-extrabold text-sm text-[#12805C] dark:text-emerald-400 tabular-nums">
                {Number(stats.deliveryOffices || 0).toLocaleString('en-IN')}
              </div>
            </div>
            <div className="bg-[#FEF2C8]/70 dark:bg-slate-800 border border-[#2F3E4E]/20 dark:border-slate-700 rounded-xl p-2.5">
              <div className="text-[11px] text-[#64748B] dark:text-slate-400">Non-Delivery</div>
              <div className="font-mono font-extrabold text-sm text-[#B45309] dark:text-amber-400 tabular-nums">
                {Number(stats.nonDeliveryOffices || 0).toLocaleString('en-IN')}
              </div>
            </div>
            <div className="bg-[#FEF2C8]/70 dark:bg-slate-800 border border-[#2F3E4E]/20 dark:border-slate-700 rounded-xl p-2.5">
              <div className="text-[11px] text-[#64748B] dark:text-slate-400">Dataset Updated</div>
              <div className="font-mono font-bold text-xs text-[#2F3E4E] dark:text-slate-100 mt-0.5">
                {stats.lastUpdatedAt ? stats.lastUpdatedAt.slice(0, 10) : 'Not Imported'}
              </div>
            </div>
          </div>
        )}

        {/* Search Form + Autocomplete */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div ref={searchBoxRef} className="relative">
            <label htmlFor="pincode-main-search" className="sr-only">
              Search by 6-digit PIN code, post office, village, city, taluk, district, or state
            </label>
            <Search
              className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-[#475569] dark:text-slate-400 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="pincode-main-search"
              type="text"
              value={query}
              onFocus={() => setIsSuggestOpen(true)}
              onChange={(e) => {
                setQuery(e.target.value);
                setIsSuggestOpen(true);
                setActiveSuggestIdx(-1);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search PIN code (575001), post office (Hampankatta), village, city, taluk, or district..."
              autoComplete="off"
              className="w-full pl-12 pr-28 py-3.5 min-h-[52px] rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-500 bg-white dark:bg-slate-800 text-sm sm:text-base text-[#2F3E4E] dark:text-slate-100 placeholder:text-[#64748B] dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2F3E4E] dark:focus:ring-[#F9C80E]"
            />

            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setDebouncedQuery('');
                    setPage(1);
                    syncPinToUrl('');
                  }}
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

            {isSuggestOpen && suggestions.length > 0 && (
              <div
                role="listbox"
                aria-label="PIN code suggestions"
                className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 bg-[#FFFDF5] dark:bg-slate-900 border-[1.5px] border-[#2F3E4E] dark:border-slate-600 rounded-xl shadow-[0_6px_0_#2F3E4E] overflow-hidden"
              >
                {suggestions.map((item, idx) => {
                  const active = idx === activeSuggestIdx;
                  return (
                    <button
                      key={`${item.pincode}-${item.office_name}-${idx}`}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        setQuery(item.pincode);
                        setDebouncedQuery(item.pincode);
                        setPage(1);
                        setIsSuggestOpen(false);
                        syncPinToUrl(item.pincode);
                      }}
                      className={`w-full px-4 py-2.5 text-left flex items-center justify-between gap-3 text-xs border-b last:border-b-0 border-[#2F3E4E]/10 dark:border-slate-800 cursor-pointer ${
                        active
                          ? 'bg-[#F9C80E] text-[#2F3E4E]'
                          : 'hover:bg-[#FEF2C8] dark:hover:bg-slate-800 text-[#2F3E4E] dark:text-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-mono font-extrabold px-2 py-0.5 rounded bg-[#2F3E4E] text-[#F9C80E] shrink-0">
                          {item.pincode}
                        </span>
                        <span className="font-semibold truncate">{item.office_name}</span>
                      </div>
                      <span className="text-[11px] opacity-80 shrink-0">
                        {item.district}, {item.state}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="font-semibold text-[#475569] dark:text-slate-400 mr-1">
                Try:
              </span>
              {QUICK_PIN_EXAMPLES.map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => handleQuickTry(sample)}
                  className="px-2.5 py-1 min-h-[32px] rounded-lg bg-[#FEF2C8] dark:bg-slate-800 hover:bg-[#F9C80E] border border-[#2F3E4E]/30 dark:border-slate-600 font-mono text-[11px] font-bold text-[#2F3E4E] dark:text-slate-100 cursor-pointer"
                >
                  {sample}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowMobileFilters((p) => !p)}
              className="lg:hidden inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-lg border-[1.5px] border-[#2F3E4E] bg-white dark:bg-slate-800 text-xs font-bold text-[#2F3E4E] dark:text-slate-100 cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Collapsible Admin Import & Quality Panel */}
      {showAdminPanel && (
        <DirectoryAdminPanel
          dataset="pincodes"
          onImportCompleted={() => {
            void loadStats();
            void loadFacets(stateFilter);
            void executeSearch();
          }}
        />
      )}

      {/* Filters & Sorting Bar */}
      <div
        className={`bg-[#FFFDF5] dark:bg-slate-900 border-[1.5px] border-[#2F3E4E] dark:border-slate-600 rounded-2xl p-4 sm:p-5 shadow-[0_4px_0_#2F3E4E] dark:shadow-[0_4px_0_#020617] space-y-4 ${
          showMobileFilters ? 'block' : 'hidden lg:block'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-display font-extrabold text-[#2F3E4E] dark:text-slate-100">
            <Filter className="w-4 h-4 text-[#12805C] dark:text-emerald-400" />
            <span>Filter &amp; Sort India Post Offices</span>
          </div>

          <div className="flex items-center gap-3">
            {searchData && (
              <span className="text-xs font-mono font-bold text-[#475569] dark:text-slate-300 tabular-nums">
                {searchData.totalMatchingOffices.toLocaleString('en-IN')} offices ·{' '}
                {searchData.totalUniquePincodes.toLocaleString('en-IN')} PINs
              </span>
            )}
            {(activeFilterCount > 0 || query) && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-[#FFE1B3] dark:bg-slate-800 hover:bg-[#F9C80E] border border-[#2F3E4E] dark:border-slate-600 text-[11px] font-bold text-[#2F3E4E] dark:text-slate-100 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset All</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label
              htmlFor="pin-filter-state"
              className="block text-[11px] font-semibold text-[#475569] dark:text-slate-400 mb-1"
            >
              State / Union Territory
            </label>
            <select
              id="pin-filter-state"
              value={stateFilter}
              onChange={(e) => {
                setStateFilter(e.target.value);
                setDistrictFilter('ALL');
                setPage(1);
              }}
              className="w-full min-h-[40px] px-2.5 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-medium text-[#2F3E4E] dark:text-slate-100"
            >
              <option value="ALL">All States &amp; UTs ({facets?.states.length || 0})</option>
              {facets?.states.map((st) => (
                <option key={st.state} value={st.state}>
                  {st.state} ({st.uniquePincodeCount.toLocaleString('en-IN')} PINs)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="pin-filter-district"
              className="block text-[11px] font-semibold text-[#475569] dark:text-slate-400 mb-1"
            >
              District
            </label>
            <select
              id="pin-filter-district"
              value={districtFilter}
              disabled={stateFilter === 'ALL'}
              onChange={(e) => {
                setDistrictFilter(e.target.value);
                setPage(1);
              }}
              className="w-full min-h-[40px] px-2.5 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-slate-800 disabled:opacity-50 text-xs font-medium text-[#2F3E4E] dark:text-slate-100"
            >
              <option value="ALL">
                {stateFilter === 'ALL'
                  ? 'Select a State First'
                  : `All Districts (${facets?.districts.length || 0})`}
              </option>
              {facets?.districts.map((dist) => (
                <option key={dist.district} value={dist.district}>
                  {dist.district} ({dist.uniquePincodeCount} PINs)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="pin-filter-type"
              className="block text-[11px] font-semibold text-[#475569] dark:text-slate-400 mb-1"
            >
              Post Office Type
            </label>
            <select
              id="pin-filter-type"
              value={officeTypeFilter}
              onChange={(e) => {
                setOfficeTypeFilter(e.target.value);
                setPage(1);
              }}
              className="w-full min-h-[40px] px-2.5 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-medium text-[#2F3E4E] dark:text-slate-100"
            >
              <option value="ALL">All Office Types</option>
              {facets?.officeTypes.map((ot) => (
                <option key={ot.officeType} value={ot.officeType}>
                  {ot.officeType} ({ot.count.toLocaleString('en-IN')})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="pin-filter-delivery"
              className="block text-[11px] font-semibold text-[#475569] dark:text-slate-400 mb-1"
            >
              Delivery Status
            </label>
            <select
              id="pin-filter-delivery"
              value={deliveryFilter}
              onChange={(e) => {
                setDeliveryFilter(e.target.value);
                setPage(1);
              }}
              className="w-full min-h-[40px] px-2.5 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-medium text-[#2F3E4E] dark:text-slate-100"
            >
              <option value="ALL">All Delivery Statuses</option>
              {facets?.deliveryStatuses.map((ds) => (
                <option key={ds.deliveryStatus} value={ds.deliveryStatus}>
                  {ds.deliveryStatus} ({ds.count.toLocaleString('en-IN')})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="pin-filter-sort"
              className="block text-[11px] font-semibold text-[#475569] dark:text-slate-400 mb-1"
            >
              Sort Results
            </label>
            <select
              id="pin-filter-sort"
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
              className="w-full min-h-[40px] px-2.5 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-medium text-[#2F3E4E] dark:text-slate-100"
            >
              <option value="pincode_asc">PIN Code (Ascending)</option>
              <option value="pincode_desc">PIN Code (Descending)</option>
              <option value="office_asc">Post Office Name (A–Z)</option>
              <option value="office_desc">Post Office Name (Z–A)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Toolbar + Cards */}
      <div className="bg-[#FFFDF5] dark:bg-slate-900 border-[1.5px] border-[#2F3E4E] dark:border-slate-600 rounded-2xl overflow-hidden shadow-[0_4px_0_#2F3E4E] dark:shadow-[0_4px_0_#020617]">
        <div className="px-5 py-3.5 bg-[#CEE5DC]/55 dark:bg-slate-800 border-b border-[#2F3E4E]/20 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs font-display font-extrabold text-[#2F3E4E] dark:text-slate-100">
            <ShieldCheck className="w-4 h-4 text-[#12805C] dark:text-emerald-400" />
            <span>
              {searchData
                ? `${searchData.totalMatchingOffices.toLocaleString('en-IN')} Matching Post Office${
                    searchData.totalMatchingOffices === 1 ? '' : 's'
                  } across ${searchData.totalUniquePincodes.toLocaleString('en-IN')} Unique PIN Code${
                    searchData.totalUniquePincodes === 1 ? '' : 's'
                  }`
                : 'Searching India Post Directory...'}
            </span>
            {searchData?.queryDurationMs !== undefined && !loading && (
              <span className="font-mono text-[11px] font-semibold text-[#475569] dark:text-slate-400">
                ({searchData.queryDurationMs} ms)
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!searchData || searchData.items.length === 0}
              onClick={handleDownloadCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 hover:bg-[#FEF2C8] disabled:opacity-40 border border-[#2F3E4E] dark:border-slate-600 text-[11px] font-bold text-[#2F3E4E] dark:text-slate-100 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
            <button
              type="button"
              disabled={!searchData || searchData.items.length === 0}
              onClick={handleDownloadExcel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F9C80E] hover:bg-[#FFE1B3] disabled:opacity-40 border border-[#2F3E4E] text-[11px] font-bold text-[#2F3E4E] cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Excel (.XLSX)</span>
            </button>
            <button
              type="button"
              disabled={!searchData || searchData.items.length === 0}
              onClick={handlePrintResults}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 hover:bg-[#FEF2C8] disabled:opacity-40 border border-[#2F3E4E] dark:border-slate-600 text-[11px] font-bold text-[#2F3E4E] dark:text-slate-100 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
            <button
              type="button"
              onClick={() => void handleShareResults()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2F3E4E] hover:bg-[#1E293B] text-[#F9C80E] border border-[#2F3E4E] text-[11px] font-bold cursor-pointer"
            >
              {shareStatus ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{shareStatus || 'Share'}</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 flex items-center justify-center gap-2.5 text-sm font-semibold text-[#475569] dark:text-slate-300">
            <Loader2 className="w-5 h-5 animate-spin text-[#2F3E4E] dark:text-[#F9C80E]" />
            <span>Querying SQLite India Post database...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center space-y-2 text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-6 h-6 mx-auto" />
            <p className="font-display font-bold text-sm">{error}</p>
          </div>
        ) : searchData && searchData.invalidPincodeAttempt ? (
          <div className="p-8 sm:p-10 text-center space-y-3">
            <AlertCircle className="w-8 h-8 mx-auto text-[#B45309]" />
            <h2 className="font-display font-extrabold text-lg text-[#2F3E4E] dark:text-slate-100">
              Invalid Indian PIN Code Format: {searchData.invalidPincodeAttempt}
            </h2>
            <p className="text-xs sm:text-sm text-[#475569] dark:text-slate-300 max-w-lg mx-auto">
              Indian Postal Index Numbers (PIN) contain 6 digits starting with 1 through 8 (or 9 for
              Army Postal Service). Codes starting with 0 are invalid.
            </p>
          </div>
        ) : !searchData || searchData.items.length === 0 ? (
          <div className="p-8 sm:p-10 text-center space-y-3">
            <AlertCircle className="w-8 h-8 mx-auto text-[#B45309]" />
            <h2 className="font-display font-extrabold text-lg text-[#2F3E4E] dark:text-slate-100">
              {searchData?.exactPincodeLookup
                ? `PIN Code ${searchData.exactPincodeLookup} Not Found in Verified Directory`
                : 'No Matching Post Offices Found'}
            </h2>
            <p className="text-xs sm:text-sm text-[#475569] dark:text-slate-300 max-w-lg mx-auto">
              {searchData?.exactPincodeLookup
                ? `No verified post office record matches ${searchData.exactPincodeLookup} in our database or live India Post lookup.`
                : 'Try searching a 6-digit PIN code (e.g. 575001), a city or village name, or reset active filters.'}
            </p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-4 py-2 rounded-xl bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] text-xs font-bold text-[#2F3E4E] cursor-pointer"
            >
              Reset Search &amp; Filters
            </button>
          </div>
        ) : (
          <div className="p-4 sm:p-6 space-y-4">
            {searchData.fallbackSource && (
              <div className="px-4 py-2.5 rounded-xl bg-[#FFE1B3]/70 border border-[#2F3E4E]/30 text-xs text-[#2F3E4E] flex items-center gap-2">
                <Info className="w-4 h-4 shrink-0" />
                <span>
                  Loaded from supplementary source: <strong>{searchData.fallbackSource}</strong>
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {searchData.items.map((item) => {
                const isExpanded = Boolean(expandedIds[item.id]);
                const copyPinKey = `pin-${item.id}`;
                const copyAddrKey = `addr-${item.id}`;
                return (
                  <article
                    key={`${item.pincode}-${item.office_name}-${item.id}`}
                    className="bg-white dark:bg-slate-800/80 border-[1.5px] border-[#2F3E4E] dark:border-slate-600 rounded-2xl p-4 sm:p-5 shadow-[0_3px_0_#2F3E4E] dark:shadow-[0_3px_0_#020617] flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-1 rounded-lg bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] font-mono font-extrabold text-base text-[#2F3E4E] tabular-nums">
                            {item.pincode}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-[#FEF2C8] dark:bg-slate-700 border border-[#2F3E4E]/25 text-[11px] font-bold text-[#2F3E4E] dark:text-slate-200">
                            {item.office_type || 'Post Office'}
                          </span>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                            item.delivery_status === 'Delivery'
                              ? 'bg-[#CEE5DC]/75 border-[#12805C]/35 text-[#12805C] dark:text-emerald-300'
                              : 'bg-[#FFE1B3]/75 border-[#B45309]/35 text-[#B45309] dark:text-amber-300'
                          }`}
                        >
                          {item.delivery_status}
                        </span>
                      </div>

                      <div>
                        <h3 className="font-display font-extrabold text-base sm:text-lg text-[#2F3E4E] dark:text-slate-100 leading-snug">
                          <RtoHighlightText text={item.office_name} query={debouncedQuery} />
                        </h3>
                        <p className="text-xs font-semibold text-[#475569] dark:text-slate-300 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-[#C85A32] shrink-0" />
                          <span>
                            <RtoHighlightText text={item.district} query={debouncedQuery} />,{' '}
                            <RtoHighlightText text={item.state} query={debouncedQuery} />
                          </span>
                        </p>
                      </div>

                      <div className="bg-[#FEF2C8]/55 dark:bg-slate-900/70 border border-[#2F3E4E]/15 dark:border-slate-700 rounded-xl p-3 text-xs space-y-1">
                        <div className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400">
                          POSTAL ADDRESS
                        </div>
                        <div className="text-[#2F3E4E] dark:text-slate-200 font-medium leading-relaxed">
                          {item.postal_address || 'Not Available'}
                        </div>
                      </div>

                      {isExpanded && (
                        <dl className="grid grid-cols-2 gap-2.5 pt-2 border-t border-[#2F3E4E]/15 dark:border-slate-700 text-xs">
                          <div>
                            <dt className="text-[10px] font-semibold text-[#64748B] dark:text-slate-400">
                              TALUK / SUB-DISTRICT
                            </dt>
                            <dd className="font-medium text-[#2F3E4E] dark:text-slate-200">
                              {item.taluk || 'Not Available'}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[10px] font-semibold text-[#64748B] dark:text-slate-400">
                              DIVISION
                            </dt>
                            <dd className="font-medium text-[#2F3E4E] dark:text-slate-200">
                              {item.division || 'Not Available'}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[10px] font-semibold text-[#64748B] dark:text-slate-400">
                              POSTAL REGION
                            </dt>
                            <dd className="font-medium text-[#2F3E4E] dark:text-slate-200">
                              {item.region || 'Not Available'}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[10px] font-semibold text-[#64748B] dark:text-slate-400">
                              POSTAL CIRCLE
                            </dt>
                            <dd className="font-medium text-[#2F3E4E] dark:text-slate-200">
                              {item.circle || 'Not Available'}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[10px] font-semibold text-[#64748B] dark:text-slate-400">
                              CONTACT TELEPHONE
                            </dt>
                            <dd className="font-mono font-medium text-[#2F3E4E] dark:text-slate-200">
                              {item.contact || 'Not Available'}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[10px] font-semibold text-[#64748B] dark:text-slate-400">
                              COORDINATES
                            </dt>
                            <dd className="font-mono text-[#2F3E4E] dark:text-slate-200">
                              {item.latitude !== null && item.longitude !== null
                                ? `${item.latitude.toFixed(4)}, ${item.longitude.toFixed(4)}`
                                : 'Not Available'}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[10px] font-semibold text-[#64748B] dark:text-slate-400">
                              SOURCE
                            </dt>
                            <dd className="text-[#2F3E4E] dark:text-slate-200">
                              {item.source || 'Not Available'}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[10px] font-semibold text-[#64748B] dark:text-slate-400">
                              LAST VERIFIED
                            </dt>
                            <dd className="font-mono text-[#2F3E4E] dark:text-slate-200">
                              {item.last_verified_at || 'Not Available'}
                            </dd>
                          </div>
                        </dl>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#2F3E4E]/15 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => void handleCopyText(copyPinKey, item.pincode)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2F3E4E] hover:bg-[#1E293B] text-[#F9C80E] text-[11px] font-bold cursor-pointer"
                      >
                        {copiedKey === copyPinKey ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Copied {item.pincode}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy PIN</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void handleCopyText(
                            copyAddrKey,
                            `${item.office_name} (${item.office_type}, ${item.delivery_status})\n${item.postal_address}`
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FEF2C8] dark:bg-slate-700 hover:bg-[#F9C80E] border border-[#2F3E4E]/40 text-[11px] font-bold text-[#2F3E4E] dark:text-slate-100 cursor-pointer"
                      >
                        {copiedKey === copyAddrKey ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-[#12805C]" />
                            <span>Address Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy Address</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        onClick={() =>
                          setExpandedIds((prev) => ({ ...prev, [item.id]: !isExpanded }))
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/25 dark:border-slate-600 text-[11px] font-bold text-[#2F3E4E] dark:text-slate-200 hover:bg-[#FEF2C8]/60 dark:hover:bg-slate-700 cursor-pointer ml-auto"
                      >
                        <span>{isExpanded ? 'Less Info' : 'More Info'}</span>
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            {searchData.totalPages > 1 && (
              <div className="pt-4 border-t border-[#2F3E4E]/15 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="font-mono font-semibold text-[#475569] dark:text-slate-300 tabular-nums">
                  Page {searchData.page} of {searchData.totalPages.toLocaleString('en-IN')}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#2F3E4E] bg-white dark:bg-slate-800 disabled:opacity-40 font-bold text-[#2F3E4E] dark:text-slate-100 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Prev</span>
                  </button>
                  <button
                    type="button"
                    disabled={page >= searchData.totalPages}
                    onClick={() => setPage((p) => Math.min(searchData.totalPages, p + 1))}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#2F3E4E] bg-white dark:bg-slate-800 disabled:opacity-40 font-bold text-[#2F3E4E] dark:text-slate-100 cursor-pointer"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* State-Wise & District-Wise PIN Code Directory */}
      {facets && facets.states.length > 0 && (
        <section
          aria-labelledby="pin-state-directory-heading"
          className="bg-[#FFFDF5] dark:bg-slate-900 border-[1.5px] border-[#2F3E4E] dark:border-slate-600 rounded-2xl p-5 sm:p-7 shadow-[0_4px_0_#2F3E4E] dark:shadow-[0_4px_0_#020617] space-y-5"
        >
          <div className="space-y-1 pb-3 border-b border-[#2F3E4E]/15 dark:border-slate-700">
            <h2
              id="pin-state-directory-heading"
              className="font-display font-extrabold text-lg sm:text-xl text-[#2F3E4E] dark:text-slate-100"
            >
              State-Wise &amp; District-Wise PIN Code Directory
            </h2>
            <p className="text-xs text-[#475569] dark:text-slate-300">
              Select a State or Union Territory to inspect its districts, unique PIN code counts, and
              filter post offices immediately.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {facets.states.map((st) => {
              const selected = directoryState === st.state;
              return (
                <button
                  key={st.state}
                  type="button"
                  onClick={() => setDirectoryState(st.state)}
                  className={`rounded-xl p-3 border-[1.5px] text-left cursor-pointer transition-colors ${
                    selected
                      ? 'bg-[#2F3E4E] text-[#FFFDF5] border-[#2F3E4E]'
                      : 'bg-white dark:bg-slate-800 text-[#2F3E4E] dark:text-slate-100 border-[#2F3E4E]/25 dark:border-slate-700 hover:bg-[#FEF2C8]'
                  }`}
                >
                  <div className="text-xs font-display font-bold truncate">{st.state}</div>
                  <div
                    className={`mt-1 font-mono text-[11px] tabular-nums ${
                      selected ? 'text-[#F9C80E]' : 'text-[#64748B] dark:text-slate-400'
                    }`}
                  >
                    {st.uniquePincodeCount.toLocaleString('en-IN')} PINs ·{' '}
                    {st.officeCount.toLocaleString('en-IN')} POs
                  </div>
                </button>
              );
            })}
          </div>

          {directoryDistricts.length > 0 && (
            <div className="bg-[#FEF2C8]/50 dark:bg-slate-800/60 border border-[#2F3E4E]/25 dark:border-slate-700 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display font-extrabold text-sm text-[#2F3E4E] dark:text-slate-100">
                  Districts in {directoryState} ({directoryDistricts.length})
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setDebouncedQuery('');
                    setStateFilter(directoryState);
                    setDistrictFilter('ALL');
                    setPage(1);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="text-xs font-bold underline text-[#12805C] dark:text-emerald-400 cursor-pointer"
                >
                  Browse All {directoryState} PINs
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {directoryDistricts.map((dist) => (
                  <button
                    key={dist.district}
                    type="button"
                    onClick={() => {
                      setQuery('');
                      setDebouncedQuery('');
                      setStateFilter(directoryState);
                      setDistrictFilter(dist.district);
                      setPage(1);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 hover:bg-[#F9C80E] border border-[#2F3E4E]/25 dark:border-slate-600 text-xs font-semibold text-[#2F3E4E] dark:text-slate-100 cursor-pointer"
                  >
                    {dist.district}{' '}
                    <span className="font-mono text-[10px] opacity-75">
                      ({dist.uniquePincodeCount} PINs)
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
