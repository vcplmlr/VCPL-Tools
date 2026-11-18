import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Building2,
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
  GitMerge,
  Info,
  Landmark,
  Loader2,
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

interface BankDirectoryToolViewProps {
  onLaunchSlipGenerator: (bankId: 'sbi' | 'hdfc') => void;
  initialIfsc?: string;
  onSyncUrlIfsc?: (ifsc: string | null) => void;
}

export interface IfscBranchRecord {
  id: number;
  ifsc: string;
  bank_name: string;
  branch_name: string;
  address: string;
  state: string;
  district: string;
  city: string;
  micr: string;
  bank_code: string;
  branch_code: string;
  bank_category: string;
  bank_status: string;
  successor_bank: string;
  successor_ifsc_prefix: string;
  upi: number;
  rtgs: number;
  neft: number;
  imps: number;
  swift: string;
  contact: string;
  verification_status: string;
  source: string;
  last_verified_at: string;
}

interface MergerInfo {
  oldCode: string;
  oldBankName: string;
  successorCode: string;
  successorBankName: string;
  effectiveDate: string;
  note: string;
}

interface IfscValidationPayload {
  attempted: boolean;
  input: string;
  formatValid: boolean;
  errors: string[];
  bankCode: string;
  fifthChar: string;
  branchCode: string;
  existsInDataset: boolean;
  statusInDataset: string | null;
  mergerInfo: MergerInfo | null;
}

interface IfscSearchResponse {
  items: IfscBranchRecord[];
  totalMatchingBranches: number;
  page: number;
  limit: number;
  totalPages: number;
  ifscValidation: IfscValidationPayload;
  historicalRecord: IfscBranchRecord | null;
  fallbackSource: string | null;
  queryDurationMs: number;
}

interface IfscFacetsResponse {
  banks: Array<{ bankName: string; bankCode: string; bankCategory: string; branchCount: number }>;
  states: Array<{ state: string; branchCount: number }>;
  districts: Array<{ district: string; branchCount: number }>;
  cities: Array<{ city: string; branchCount: number }>;
  categories: Array<{ category: string; count: number }>;
  statuses: Array<{ status: string; count: number }>;
}

interface IfscStatsResponse {
  totalRecords: number;
  activeRecords: number;
  inactiveOrHistoricalRecords: number;
  uniqueBanks: number;
  statesCovered: number;
  verifiedRecords: number;
  unverifiedRecords: number;
  lastUpdatedAt: string | null;
  amalgamatedBanksCount: number;
  topBanks: Array<{ bankName: string; bankCode: string; bankCategory: string; branchCount: number }>;
  stateWise: Array<{ state: string; branchCount: number }>;
  categories: Array<{ category: string; count: number }>;
}

interface IfscSuggestionResponse {
  banks: Array<{ bankName: string; bankCode: string; bankCategory: string; branchCount: number }>;
  branches: Array<{
    ifsc: string;
    bank_name: string;
    branch_name: string;
    city: string;
    state: string;
    bank_status: string;
  }>;
}

const IFSC_SYNTAX_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

const QUICK_IFSC_EXAMPLES = [
  'SBIN0000001',
  'HDFC0000001',
  'ICIC0000002',
  'State Bank of India',
  'Mangaluru',
  '400002002',
  'SYNB0000123',
];

function quickClientIfscPrecheck(raw: string): {
  looksLikeIfsc: boolean;
  valid: boolean;
  messages: string[];
} {
  const cleaned = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (!cleaned) return { looksLikeIfsc: false, valid: false, messages: [] };
  if (/^\d{9}$/.test(cleaned)) return { looksLikeIfsc: false, valid: false, messages: [] };
  const looksLike =
    (cleaned.length === 11 && /^[A-Z]{2,4}[A-Z0-9]{7,9}$/.test(cleaned)) ||
    (/^[A-Z]{4}0[A-Z0-9]{0,6}$/.test(cleaned) && cleaned.length >= 6) ||
    (/^[A-Z]{4}\d[A-Z0-9]{4,8}$/.test(cleaned) && /\d/.test(cleaned));
  if (!looksLike) return { looksLikeIfsc: false, valid: false, messages: [] };

  const messages: string[] = [];
  if (cleaned.length !== 11) {
    messages.push(`Length is ${cleaned.length} (RBI standard IFSC requires 11 characters).`);
  }
  if (cleaned.length >= 4 && !/^[A-Z]{4}$/.test(cleaned.slice(0, 4))) {
    messages.push('First 4 characters must be uppercase letters (bank code).');
  }
  if (cleaned.length >= 5 && cleaned[4] !== '0') {
    messages.push(`5th character must be 0 (zero), found "${cleaned[4]}".`);
  }
  if (cleaned.length === 11 && !/^[A-Z0-9]{6}$/.test(cleaned.slice(5))) {
    messages.push('Last 6 characters must be alphanumeric branch characters.');
  }
  return {
    looksLikeIfsc: true,
    valid: IFSC_SYNTAX_REGEX.test(cleaned),
    messages,
  };
}

export function BankDirectoryToolView({
  onLaunchSlipGenerator,
  initialIfsc,
  onSyncUrlIfsc,
}: BankDirectoryToolViewProps) {
  const { preference, setPreference } = useTheme();

  const [query, setQuery] = useState<string>(() => initialIfsc || 'SBIN0000001');
  const [debouncedQuery, setDebouncedQuery] = useState<string>(() => initialIfsc || 'SBIN0000001');
  const [bankFilter, setBankFilter] = useState<string>('ALL');
  const [stateFilter, setStateFilter] = useState<string>('ALL');
  const [districtFilter, setDistrictFilter] = useState<string>('ALL');
  const [cityFilter, setCityFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('Active');
  const [sortBy, setSortBy] = useState<string>('ifsc_asc');
  const [page, setPage] = useState<number>(1);
  const [showMobileFilters, setShowMobileFilters] = useState<boolean>(false);

  const [searchData, setSearchData] = useState<IfscSearchResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [facets, setFacets] = useState<IfscFacetsResponse | null>(null);
  const [stats, setStats] = useState<IfscStatsResponse | null>(null);

  // Autocomplete dropdown
  const [suggestions, setSuggestions] = useState<IfscSuggestionResponse>({ banks: [], branches: [] });
  const [isSuggestOpen, setIsSuggestOpen] = useState<boolean>(false);
  const [activeSuggestIdx, setActiveSuggestIdx] = useState<number>(-1);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);

  // Card UI state
  const [expandedIds, setExpandedIds] = useState<Record<number, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [showAdminPanel, setShowAdminPanel] = useState<boolean>(false);

  const lastSyncedRef = useRef<string | undefined>(initialIfsc);

  useEffect(() => {
    if (initialIfsc && initialIfsc !== lastSyncedRef.current) {
      lastSyncedRef.current = initialIfsc;
      setQuery(initialIfsc);
      setDebouncedQuery(initialIfsc);
      setPage(1);
    }
  }, [initialIfsc]);

  // Debounced search update
  useEffect(() => {
    if (query === debouncedQuery) return;
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [query, debouncedQuery]);

  // Close autocomplete on outside click
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
      const res = await fetch('/api/ifsc/stats');
      if (res.ok) {
        const json = (await res.json()) as IfscStatsResponse;
        setStats(json);
      }
    } catch {
      // Non-blocking stats load
    }
  }, []);

  const loadFacets = useCallback(
    async (b: string, s: string, d: string, st: string) => {
      try {
        const qs = new URLSearchParams({
          bank: b,
          state: s,
          district: d,
          status: st,
        });
        const res = await fetch(`/api/ifsc/facets?${qs.toString()}`);
        if (res.ok) {
          const json = (await res.json()) as IfscFacetsResponse;
          setFacets(json);
        }
      } catch {
        // Non-blocking facets load
      }
    },
    []
  );

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    void loadFacets(bankFilter, stateFilter, districtFilter, statusFilter);
  }, [bankFilter, stateFilter, districtFilter, statusFilter, loadFacets]);

  // Execute main SQL IFSC search
  const executeSearch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        q: debouncedQuery.trim(),
        bank: bankFilter,
        state: stateFilter,
        district: districtFilter,
        city: cityFilter,
        category: categoryFilter,
        status: statusFilter,
        sort: sortBy,
        page: String(page),
        limit: '18',
      });
      const res = await fetch(`/api/ifsc/search?${qs.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setSearchData(data as IfscSearchResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search India IFSC database.');
    } finally {
      setLoading(false);
    }
  }, [
    debouncedQuery,
    bankFilter,
    stateFilter,
    districtFilter,
    cityFilter,
    categoryFilter,
    statusFilter,
    sortBy,
    page,
  ]);

  useEffect(() => {
    void executeSearch();
  }, [executeSearch]);

  // Fetch autocomplete suggestions
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions({ banks: [], branches: [] });
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/ifsc/suggest?q=${encodeURIComponent(trimmed)}`);
        if (res.ok) {
          const json = (await res.json()) as IfscSuggestionResponse;
          setSuggestions({
            banks: json.banks || [],
            branches: json.branches || [],
          });
        }
      } catch {
        setSuggestions({ banks: [], branches: [] });
      }
    }, 150);
    return () => window.clearTimeout(timer);
  }, [query]);

  const syncIfscToUrl = (val: string) => {
    const clean = val.trim().toUpperCase();
    if (IFSC_SYNTAX_REGEX.test(clean)) {
      lastSyncedRef.current = clean;
      onSyncUrlIfsc?.(clean);
    } else {
      lastSyncedRef.current = undefined;
      onSyncUrlIfsc?.(null);
    }
  };

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    setIsSuggestOpen(false);
    setDebouncedQuery(query);
    setPage(1);
    syncIfscToUrl(query);
  };

  const handleQuickTry = (term: string) => {
    setQuery(term);
    setDebouncedQuery(term);
    setBankFilter('ALL');
    setStateFilter('ALL');
    setDistrictFilter('ALL');
    setCityFilter('ALL');
    setCategoryFilter('ALL');
    setStatusFilter('Active');
    setPage(1);
    setIsSuggestOpen(false);
    syncIfscToUrl(term);
  };

  const handleResetFilters = () => {
    setQuery('');
    setDebouncedQuery('');
    setBankFilter('ALL');
    setStateFilter('ALL');
    setDistrictFilter('ALL');
    setCityFilter('ALL');
    setCategoryFilter('ALL');
    setStatusFilter('Active');
    setSortBy('ifsc_asc');
    setPage(1);
    lastSyncedRef.current = undefined;
    onSyncUrlIfsc?.(null);
  };

  const flatSuggestions = [
    ...suggestions.banks.map((b) => ({ kind: 'bank' as const, bank: b })),
    ...suggestions.branches.map((br) => ({ kind: 'branch' as const, branch: br })),
  ];

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isSuggestOpen || flatSuggestions.length === 0) {
      if (e.key === 'Escape') setIsSuggestOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestIdx((prev) => (prev + 1) % flatSuggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestIdx((prev) => (prev <= 0 ? flatSuggestions.length - 1 : prev - 1));
    } else if (e.key === 'Enter' && activeSuggestIdx >= 0) {
      e.preventDefault();
      const chosen = flatSuggestions[activeSuggestIdx];
      if (chosen?.kind === 'bank') {
        setQuery('');
        setDebouncedQuery('');
        setBankFilter(chosen.bank.bankName);
        setPage(1);
        setIsSuggestOpen(false);
        syncIfscToUrl('');
      } else if (chosen?.kind === 'branch') {
        setQuery(chosen.branch.ifsc);
        setDebouncedQuery(chosen.branch.ifsc);
        setPage(1);
        setIsSuggestOpen(false);
        syncIfscToUrl(chosen.branch.ifsc);
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
      // Ignore clipboard restriction
    }
  };

  const buildCurrentQueryParams = () =>
    new URLSearchParams({
      q: debouncedQuery.trim(),
      bank: bankFilter,
      state: stateFilter,
      district: districtFilter,
      city: cityFilter,
      category: categoryFilter,
      status: statusFilter,
    });

  const handleDownloadCsv = () => {
    if (!searchData || searchData.items.length === 0) return;
    if (searchData.totalMatchingBranches <= 5000) {
      window.location.assign(`/api/ifsc/export?${buildCurrentQueryParams().toString()}`);
      return;
    }
    downloadCsvFile(
      'india-ifsc-page-results.csv',
      [
        'IFSC Code',
        'Bank Name',
        'Branch Name',
        'Branch Address',
        'City',
        'District',
        'State',
        'MICR Code',
        'Bank Code',
        'Branch Code',
        'Bank Category',
        'Bank Status',
        'Successor Bank',
        'UPI',
        'RTGS',
        'NEFT',
        'IMPS',
        'Source',
        'Last Verified',
      ],
      searchData.items.map((r) => [
        r.ifsc,
        r.bank_name,
        r.branch_name,
        r.address || 'Not Available',
        r.city || 'Not Available',
        r.district || 'Not Available',
        r.state || 'Not Available',
        r.micr || 'Not Available',
        r.bank_code,
        r.branch_code,
        r.bank_category || 'Not Available',
        r.bank_status,
        r.successor_bank || '',
        r.upi ? 'Yes' : 'No',
        r.rtgs ? 'Yes' : 'No',
        r.neft ? 'Yes' : 'No',
        r.imps ? 'Yes' : 'No',
        r.source,
        r.last_verified_at,
      ])
    );
  };

  const handleDownloadExcel = () => {
    if (!searchData || searchData.items.length === 0) return;
    downloadExcelFile(
      `india-ifsc-${debouncedQuery.trim() || 'filtered'}.xlsx`,
      'IFSC Branches',
      [
        'IFSC Code',
        'Bank Name',
        'Branch Name',
        'Branch Address',
        'City',
        'District',
        'State',
        'MICR Code',
        'Bank Code',
        'Branch Code',
        'Bank Category',
        'Bank Status',
        'Successor Bank',
        'UPI',
        'RTGS',
        'NEFT',
        'IMPS',
        'Contact',
        'Source',
        'Last Verified',
      ],
      searchData.items.map((r) => [
        r.ifsc,
        r.bank_name,
        r.branch_name,
        r.address || 'Not Available',
        r.city || 'Not Available',
        r.district || 'Not Available',
        r.state || 'Not Available',
        r.micr || 'Not Available',
        r.bank_code,
        r.branch_code,
        r.bank_category || 'Not Available',
        r.bank_status,
        r.successor_bank || '',
        r.upi ? 'Yes' : 'No',
        r.rtgs ? 'Yes' : 'No',
        r.neft ? 'Yes' : 'No',
        r.imps ? 'Yes' : 'No',
        r.contact || 'Not Available',
        r.source,
        r.last_verified_at,
      ])
    );
  };

  const handlePrintResults = () => {
    if (!searchData || searchData.items.length === 0) return;
    printStructuredTable(
      'India Bank IFSC & MICR Search Results',
      `Query: ${debouncedQuery.trim() || 'All'} | Matching Branches: ${searchData.totalMatchingBranches.toLocaleString(
        'en-IN'
      )} | Status Filter: ${statusFilter}`,
      ['IFSC', 'Bank Name', 'Branch', 'City', 'State', 'MICR', 'Address'],
      searchData.items.map((r) => [
        r.ifsc,
        r.bank_name,
        r.branch_name,
        r.city || 'Not Available',
        r.state || 'Not Available',
        r.micr || 'Not Available',
        r.address || 'Not Available',
      ])
    );
  };

  const handleShareResults = async () => {
    const cleanIfsc = debouncedQuery.trim().toUpperCase();
    const targetUrl = IFSC_SYNTAX_REGEX.test(cleanIfsc)
      ? `${window.location.origin}/tools/ifsc-code-finder/${cleanIfsc}`
      : window.location.href;
    const outcome = await shareOrCopyLink(
      'India IFSC Code Finder | VCPL Tools',
      `Verified IFSC & MICR bank branch directory lookup for ${cleanIfsc || 'Indian banks'}`,
      targetUrl
    );
    if (outcome !== 'failed') {
      setShareStatus(outcome === 'shared' ? 'Shared!' : 'Link Copied');
      window.setTimeout(() => setShareStatus(null), 1800);
    }
  };

  const livePrecheck = quickClientIfscPrecheck(query);
  const activeFilterCount =
    (bankFilter !== 'ALL' ? 1 : 0) +
    (stateFilter !== 'ALL' ? 1 : 0) +
    (districtFilter !== 'ALL' ? 1 : 0) +
    (cityFilter !== 'ALL' ? 1 : 0) +
    (categoryFilter !== 'ALL' ? 1 : 0) +
    (statusFilter !== 'Active' ? 1 : 0);

  return (
    <div className="space-y-6">
      {/* Main Hero & IFSC Search Card */}
      <div className="bg-[#FFFDF5] dark:bg-slate-900 border-[1.5px] border-[#2F3E4E] dark:border-slate-600 rounded-2xl p-5 sm:p-7 shadow-[0_5px_0_#2F3E4E] dark:shadow-[0_5px_0_#020617] space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] shadow-[0_2px_0_#2F3E4E] text-[#2F3E4E] flex items-center justify-center shrink-0">
              <Landmark className="w-6 h-6" aria-hidden="true" />
            </div>

            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#475569] dark:text-slate-300">
                <span className="font-mono font-bold text-[#2F3E4E] dark:text-[#F9C80E]">
                  BN-03
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {stats
                    ? `${Number(stats.activeRecords || 0).toLocaleString('en-IN')} Active Branches · ${Number(
                        stats.uniqueBanks || 0
                      ).toLocaleString('en-IN')} Banks Imported`
                    : 'SQLite FTS5 RBI/NPCI Branch Directory'}
                </span>
              </div>

              <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-[#2F3E4E] dark:text-slate-100 tracking-tight">
                India IFSC, MICR &amp; Bank Branch Finder
              </h1>

              <p className="text-xs sm:text-sm text-[#475569] dark:text-slate-300 max-w-2xl leading-relaxed">
                Search verified Indian bank branches by 11-character IFSC code, bank name, branch,
                city, district, state, or 9-digit MICR code—with live RBI IFSC syntax validation
                and amalgamated bank detection.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onLaunchSlipGenerator('sbi')}
              className="px-3 py-1.5 min-h-[34px] rounded-lg bg-[#0C2340] text-white text-xs font-bold hover:opacity-90 transition cursor-pointer whitespace-nowrap border-[1.5px] border-[#2F3E4E]"
            >
              SBI Slip Generator
            </button>
            <button
              type="button"
              onClick={() => onLaunchSlipGenerator('hdfc')}
              className="px-3 py-1.5 min-h-[34px] rounded-lg bg-[#004c8f] text-white text-xs font-bold hover:opacity-90 transition cursor-pointer whitespace-nowrap border-[1.5px] border-[#2F3E4E]"
            >
              HDFC Slip Generator
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

        {/* Live SQL Stats Bar (Strictly computed from imported DB rows) */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1">
            <div className="bg-[#FEF2C8]/70 dark:bg-slate-800 border border-[#2F3E4E]/20 dark:border-slate-700 rounded-xl p-2.5">
              <div className="text-[11px] text-[#64748B] dark:text-slate-400">Active Branches</div>
              <div className="font-mono font-extrabold text-sm text-[#12805C] dark:text-emerald-400 tabular-nums">
                {Number(stats.activeRecords || 0).toLocaleString('en-IN')}
              </div>
            </div>
            <div className="bg-[#FEF2C8]/70 dark:bg-slate-800 border border-[#2F3E4E]/20 dark:border-slate-700 rounded-xl p-2.5">
              <div className="text-[11px] text-[#64748B] dark:text-slate-400">Unique Banks</div>
              <div className="font-mono font-extrabold text-sm text-[#2F3E4E] dark:text-slate-100 tabular-nums">
                {Number(stats.uniqueBanks || 0).toLocaleString('en-IN')}
              </div>
            </div>
            <div className="bg-[#FEF2C8]/70 dark:bg-slate-800 border border-[#2F3E4E]/20 dark:border-slate-700 rounded-xl p-2.5">
              <div className="text-[11px] text-[#64748B] dark:text-slate-400">States &amp; UTs</div>
              <div className="font-mono font-extrabold text-sm text-[#2F3E4E] dark:text-slate-100 tabular-nums">
                {Number(stats.statesCovered || 0).toLocaleString('en-IN')}
              </div>
            </div>
            <div className="bg-[#FEF2C8]/70 dark:bg-slate-800 border border-[#2F3E4E]/20 dark:border-slate-700 rounded-xl p-2.5">
              <div className="text-[11px] text-[#64748B] dark:text-slate-400">Inactive / Merged</div>
              <div className="font-mono font-extrabold text-sm text-[#B45309] dark:text-amber-400 tabular-nums">
                {Number(stats.inactiveOrHistoricalRecords || 0).toLocaleString('en-IN')}
              </div>
            </div>
            <div className="bg-[#FEF2C8]/70 dark:bg-slate-800 border border-[#2F3E4E]/20 dark:border-slate-700 rounded-xl p-2.5">
              <div className="text-[11px] text-[#64748B] dark:text-slate-400">Merger Mappings</div>
              <div className="font-mono font-extrabold text-sm text-[#2F3E4E] dark:text-slate-100 tabular-nums">
                {Number(stats.amalgamatedBanksCount || 0)} RBI Codes
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

        {/* Search Input + Autocomplete */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div ref={searchBoxRef} className="relative">
            <label htmlFor="ifsc-main-search" className="sr-only">
              Search by 11-character IFSC code, bank name, branch, city, district, state, or 9-digit MICR code
            </label>
            <Search
              className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-[#475569] dark:text-slate-400 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="ifsc-main-search"
              type="text"
              value={query}
              onFocus={() => setIsSuggestOpen(true)}
              onChange={(e) => {
                setQuery(e.target.value);
                setIsSuggestOpen(true);
                setActiveSuggestIdx(-1);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Enter 11-char IFSC (SBIN0000001), bank (SBI / HDFC), branch, city, state, or 9-digit MICR..."
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
                    syncIfscToUrl('');
                  }}
                  aria-label="Clear IFSC search"
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

            {isSuggestOpen && flatSuggestions.length > 0 && (
              <div
                role="listbox"
                aria-label="IFSC and bank suggestions"
                className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 bg-[#FFFDF5] dark:bg-slate-900 border-[1.5px] border-[#2F3E4E] dark:border-slate-600 rounded-xl shadow-[0_6px_0_#2F3E4E] overflow-hidden max-h-[360px] overflow-y-auto"
              >
                {suggestions.banks.length > 0 && (
                  <div className="px-3 py-1.5 bg-[#FEF2C8] dark:bg-slate-800 text-[10px] font-display font-extrabold uppercase tracking-wider text-[#475569] dark:text-slate-300 border-b border-[#2F3E4E]/15">
                    Matching Banks
                  </div>
                )}
                {suggestions.banks.map((bank, bIdx) => {
                  const active = bIdx === activeSuggestIdx;
                  return (
                    <button
                      key={`bank-${bank.bankName}`}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        setQuery('');
                        setDebouncedQuery('');
                        setBankFilter(bank.bankName);
                        setPage(1);
                        setIsSuggestOpen(false);
                        syncIfscToUrl('');
                      }}
                      className={`w-full px-4 py-2 text-left flex items-center justify-between gap-3 text-xs border-b border-[#2F3E4E]/10 dark:border-slate-800 cursor-pointer ${
                        active
                          ? 'bg-[#F9C80E] text-[#2F3E4E]'
                          : 'hover:bg-[#FEF2C8] dark:hover:bg-slate-800 text-[#2F3E4E] dark:text-slate-100'
                      }`}
                    >
                      <span className="flex items-center gap-2 font-bold min-w-0">
                        <Building2 className="w-3.5 h-3.5 shrink-0 text-[#B45309]" />
                        <span className="truncate">{bank.bankName}</span>
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#2F3E4E]/10 dark:bg-slate-700">
                          {bank.bankCode}
                        </span>
                      </span>
                      <span className="font-mono text-[11px] opacity-80 shrink-0">
                        {bank.branchCount.toLocaleString('en-IN')} branches
                      </span>
                    </button>
                  );
                })}

                {suggestions.branches.length > 0 && (
                  <div className="px-3 py-1.5 bg-[#CEE5DC]/60 dark:bg-slate-800 text-[10px] font-display font-extrabold uppercase tracking-wider text-[#2F3E4E] dark:text-slate-300 border-b border-[#2F3E4E]/15">
                    Matching IFSC Branches
                  </div>
                )}
                {suggestions.branches.map((br, brIdx) => {
                  const flatIdx = suggestions.banks.length + brIdx;
                  const active = flatIdx === activeSuggestIdx;
                  return (
                    <button
                      key={br.ifsc}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        setQuery(br.ifsc);
                        setDebouncedQuery(br.ifsc);
                        setPage(1);
                        setIsSuggestOpen(false);
                        syncIfscToUrl(br.ifsc);
                      }}
                      className={`w-full px-4 py-2.5 text-left flex items-center justify-between gap-3 text-xs border-b last:border-b-0 border-[#2F3E4E]/10 dark:border-slate-800 cursor-pointer ${
                        active
                          ? 'bg-[#F9C80E] text-[#2F3E4E]'
                          : 'hover:bg-[#FEF2C8] dark:hover:bg-slate-800 text-[#2F3E4E] dark:text-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-mono font-extrabold px-2 py-0.5 rounded bg-[#2F3E4E] text-[#F9C80E] shrink-0">
                          {br.ifsc}
                        </span>
                        <span className="font-semibold truncate">
                          {br.bank_name} · {br.branch_name}
                        </span>
                      </div>
                      <span className="text-[11px] opacity-80 shrink-0">
                        {[br.city, br.state].filter(Boolean).join(', ')}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Live RBI IFSC Syntax Pre-Check Feedback while typing */}
          {livePrecheck.looksLikeIfsc && !livePrecheck.valid && livePrecheck.messages.length > 0 && (
            <div className="px-4 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-700 text-xs text-rose-900 dark:text-rose-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <div className="space-y-0.5">
                <div className="font-bold">Invalid RBI IFSC Syntax</div>
                <ul className="list-disc list-inside space-y-0.5">
                  {livePrecheck.messages.map((msg) => (
                    <li key={msg}>{msg}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="font-semibold text-[#475569] dark:text-slate-400 mr-1">
                Try:
              </span>
              {QUICK_IFSC_EXAMPLES.map((sample) => (
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

        {/* RBI Amalgamated / Merged Bank Advisory OR 11-Char IFSC Format vs Existence Status Banner */}
        {searchData?.ifscValidation.attempted && (
          <div className="space-y-2.5">
            {searchData.ifscValidation.mergerInfo && (
              <div className="px-4 py-3 rounded-xl bg-[#FFE1B3]/80 dark:bg-amber-950/50 border-[1.5px] border-[#B45309] text-xs text-[#2F3E4E] dark:text-amber-100 flex items-start gap-2.5">
                <GitMerge className="w-4 h-4 text-[#B45309] dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-display font-extrabold">
                    Amalgamated / Legacy Bank Prefix Detected ({searchData.ifscValidation.mergerInfo.oldCode})
                  </div>
                  <p>
                    <strong>{searchData.ifscValidation.mergerInfo.oldBankName}</strong> merged into{' '}
                    <strong>{searchData.ifscValidation.mergerInfo.successorBankName}</strong> (New
                    prefix: <span className="font-mono font-bold">{searchData.ifscValidation.mergerInfo.successorCode}</span>{' '}
                    · Effective {searchData.ifscValidation.mergerInfo.effectiveDate}).{' '}
                    {searchData.ifscValidation.mergerInfo.note}
                  </p>
                </div>
              </div>
            )}

            {searchData.ifscValidation.formatValid && !searchData.ifscValidation.existsInDataset && (
              <div className="px-4 py-3 rounded-xl bg-[#FEF2C8] dark:bg-slate-800 border-[1.5px] border-[#2F3E4E]/40 text-xs text-[#2F3E4E] dark:text-slate-200 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" />
                <div>
                  <strong>{searchData.ifscValidation.input}</strong> passes RBI 11-character syntax
                  validation (Bank Code <span className="font-mono">{searchData.ifscValidation.bankCode}</span>,
                  5th char <span className="font-mono">0</span>, Branch Code{' '}
                  <span className="font-mono">{searchData.ifscValidation.branchCode}</span>),{' '}
                  <strong>but no matching branch exists in our verified RBI/NPCI dataset</strong>. Do
                  not treat syntax compliance alone as proof of an active branch.
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Collapsible Admin Import & Data Quality Panel */}
      {showAdminPanel && (
        <DirectoryAdminPanel
          dataset="ifsc"
          onImportCompleted={() => {
            void loadStats();
            void loadFacets(bankFilter, stateFilter, districtFilter, statusFilter);
            void executeSearch();
          }}
        />
      )}

      {/* Multi-Facet Filters & Sorting */}
      <div
        className={`bg-[#FFFDF5] dark:bg-slate-900 border-[1.5px] border-[#2F3E4E] dark:border-slate-600 rounded-2xl p-4 sm:p-5 shadow-[0_4px_0_#2F3E4E] dark:shadow-[0_4px_0_#020617] space-y-4 ${
          showMobileFilters ? 'block' : 'hidden lg:block'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-display font-extrabold text-[#2F3E4E] dark:text-slate-100">
            <Filter className="w-4 h-4 text-[#12805C] dark:text-emerald-400" />
            <span>Filter &amp; Sort Indian Bank Branches</span>
          </div>

          <div className="flex items-center gap-3">
            {searchData && (
              <span className="text-xs font-mono font-bold text-[#475569] dark:text-slate-300 tabular-nums">
                {searchData.totalMatchingBranches.toLocaleString('en-IN')} branches ({statusFilter})
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label
              htmlFor="ifsc-filter-bank"
              className="block text-[11px] font-semibold text-[#475569] dark:text-slate-400 mb-1"
            >
              Bank Name ({facets?.banks.length || 0})
            </label>
            <select
              id="ifsc-filter-bank"
              value={bankFilter}
              onChange={(e) => {
                setBankFilter(e.target.value);
                setDistrictFilter('ALL');
                setCityFilter('ALL');
                setPage(1);
              }}
              className="w-full min-h-[40px] px-2.5 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-medium text-[#2F3E4E] dark:text-slate-100"
            >
              <option value="ALL">All Banks ({facets?.banks.length || 0})</option>
              {facets?.banks.map((b) => (
                <option key={b.bankName} value={b.bankName}>
                  {b.bankName} ({b.branchCount.toLocaleString('en-IN')})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="ifsc-filter-state"
              className="block text-[11px] font-semibold text-[#475569] dark:text-slate-400 mb-1"
            >
              State / Union Territory
            </label>
            <select
              id="ifsc-filter-state"
              value={stateFilter}
              onChange={(e) => {
                setStateFilter(e.target.value);
                setDistrictFilter('ALL');
                setCityFilter('ALL');
                setPage(1);
              }}
              className="w-full min-h-[40px] px-2.5 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-medium text-[#2F3E4E] dark:text-slate-100"
            >
              <option value="ALL">All States &amp; UTs ({facets?.states.length || 0})</option>
              {facets?.states.map((st) => (
                <option key={st.state} value={st.state}>
                  {st.state} ({st.branchCount.toLocaleString('en-IN')})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="ifsc-filter-district"
              className="block text-[11px] font-semibold text-[#475569] dark:text-slate-400 mb-1"
            >
              District
            </label>
            <select
              id="ifsc-filter-district"
              value={districtFilter}
              disabled={stateFilter === 'ALL'}
              onChange={(e) => {
                setDistrictFilter(e.target.value);
                setCityFilter('ALL');
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
                  {dist.district} ({dist.branchCount.toLocaleString('en-IN')})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="ifsc-filter-city"
              className="block text-[11px] font-semibold text-[#475569] dark:text-slate-400 mb-1"
            >
              City / Centre
            </label>
            <select
              id="ifsc-filter-city"
              value={cityFilter}
              disabled={stateFilter === 'ALL' && bankFilter === 'ALL'}
              onChange={(e) => {
                setCityFilter(e.target.value);
                setPage(1);
              }}
              className="w-full min-h-[40px] px-2.5 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-slate-800 disabled:opacity-50 text-xs font-medium text-[#2F3E4E] dark:text-slate-100"
            >
              <option value="ALL">
                {stateFilter === 'ALL' && bankFilter === 'ALL'
                  ? 'Select Bank or State First'
                  : `All Cities (${facets?.cities.length || 0})`}
              </option>
              {facets?.cities.map((ct) => (
                <option key={ct.city} value={ct.city}>
                  {ct.city} ({ct.branchCount.toLocaleString('en-IN')})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="ifsc-filter-category"
              className="block text-[11px] font-semibold text-[#475569] dark:text-slate-400 mb-1"
            >
              Bank Sector / Category
            </label>
            <select
              id="ifsc-filter-category"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="w-full min-h-[40px] px-2.5 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-medium text-[#2F3E4E] dark:text-slate-100"
            >
              <option value="ALL">All Bank Categories</option>
              {facets?.categories.map((cat) => (
                <option key={cat.category} value={cat.category}>
                  {cat.category} ({cat.count.toLocaleString('en-IN')})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="ifsc-filter-status"
              className="block text-[11px] font-semibold text-[#475569] dark:text-slate-400 mb-1"
            >
              Bank Operational Status
            </label>
            <select
              id="ifsc-filter-status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full min-h-[40px] px-2.5 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-medium text-[#2F3E4E] dark:text-slate-100"
            >
              <option value="Active">Active Branches Only (Default)</option>
              <option value="Merged">Merged / Amalgamated Only</option>
              <option value="Inactive">Inactive Only</option>
              <option value="Closed">Closed Only</option>
              <option value="ALL">All Records (Include Historical)</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="ifsc-filter-sort"
              className="block text-[11px] font-semibold text-[#475569] dark:text-slate-400 mb-1"
            >
              Sort Matching Branches
            </label>
            <select
              id="ifsc-filter-sort"
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
              className="w-full min-h-[40px] px-2.5 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-medium text-[#2F3E4E] dark:text-slate-100"
            >
              <option value="ifsc_asc">IFSC Code (A–Z)</option>
              <option value="bank_asc">Bank Name (A–Z)</option>
              <option value="branch_asc">Branch Name (A–Z)</option>
              <option value="city_asc">City Name (A–Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Historical Record Isolation Banner */}
      {searchData?.historicalRecord && (
        <div className="bg-[#FFE1B3] dark:bg-amber-950/60 border-[1.5px] border-[#B45309] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 text-xs text-[#2F3E4E] dark:text-amber-100">
            <div className="font-display font-extrabold text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#B45309]" />
              <span>
                Historical / {searchData.historicalRecord.bank_status} IFSC Code:{' '}
                {searchData.historicalRecord.ifsc}
              </span>
            </div>
            <p>
              <strong>{searchData.historicalRecord.bank_name}</strong> ({searchData.historicalRecord.branch_name}) is marked as{' '}
              <strong>{searchData.historicalRecord.bank_status}</strong> and is separated from default Active search results.
              {searchData.historicalRecord.successor_bank
                ? ` Successor bank: ${searchData.historicalRecord.successor_bank}.`
                : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setStatusFilter(searchData.historicalRecord!.bank_status);
              setPage(1);
            }}
            className="px-3.5 py-2 rounded-xl bg-[#2F3E4E] text-[#F9C80E] text-xs font-bold cursor-pointer shrink-0"
          >
            View Historical Record
          </button>
        </div>
      )}

      {/* Results Toolbar & Branch Cards */}
      <div className="bg-[#FFFDF5] dark:bg-slate-900 border-[1.5px] border-[#2F3E4E] dark:border-slate-600 rounded-2xl overflow-hidden shadow-[0_4px_0_#2F3E4E] dark:shadow-[0_4px_0_#020617]">
        <div className="px-5 py-3.5 bg-[#CEE5DC]/55 dark:bg-slate-800 border-b border-[#2F3E4E]/20 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs font-display font-extrabold text-[#2F3E4E] dark:text-slate-100">
            <ShieldCheck className="w-4 h-4 text-[#12805C] dark:text-emerald-400" />
            <span>
              {searchData
                ? `${searchData.totalMatchingBranches.toLocaleString('en-IN')} Matching Bank Branch${
                    searchData.totalMatchingBranches === 1 ? '' : 'es'
                  }`
                : 'Searching India IFSC Database...'}
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
            <span>Querying SQLite IFSC branch database...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center space-y-2 text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-6 h-6 mx-auto" />
            <p className="font-display font-bold text-sm">{error}</p>
          </div>
        ) : searchData && searchData.ifscValidation.attempted && !searchData.ifscValidation.formatValid ? (
          <div className="p-8 sm:p-10 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 mx-auto text-rose-600" />
            <h2 className="font-display font-extrabold text-lg text-[#2F3E4E] dark:text-slate-100">
              Invalid 11-Character IFSC Format: {searchData.ifscValidation.input}
            </h2>
            <p className="text-xs sm:text-sm text-[#475569] dark:text-slate-300 max-w-lg mx-auto">
              An Indian Financial System Code (IFSC) must follow <strong>AAAA0BBBBBB</strong>: 4
              alphabetic bank letters, <strong>0</strong> in the 5th position, followed by 6
              alphanumeric branch characters.
            </p>
            <ul className="text-xs text-rose-700 dark:text-rose-300 space-y-1">
              {searchData.ifscValidation.errors.map((errLine) => (
                <li key={errLine}>{errLine}</li>
              ))}
            </ul>
          </div>
        ) : !searchData || searchData.items.length === 0 ? (
          <div className="p-8 sm:p-10 text-center space-y-3">
            <AlertCircle className="w-8 h-8 mx-auto text-[#B45309]" />
            <h2 className="font-display font-extrabold text-lg text-[#2F3E4E] dark:text-slate-100">
              {searchData?.ifscValidation.attempted
                ? `IFSC ${searchData.ifscValidation.input} Not Found in Verified Directory`
                : 'No Matching Bank Branches Found'}
            </h2>
            <p className="text-xs sm:text-sm text-[#475569] dark:text-slate-300 max-w-lg mx-auto">
              Try searching an 11-character IFSC code (e.g. SBIN0000001), bank name (e.g. HDFC Bank),
              branch city, 9-digit MICR, or reset active filters.
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
                  Loaded from live supplementary lookup: <strong>{searchData.fallbackSource}</strong>
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {searchData.items.map((item) => {
                const isExpanded = Boolean(expandedIds[item.id]);
                const copyIfscKey = `ifsc-${item.id}`;
                const copyFullKey = `full-${item.id}`;
                const isActive = item.bank_status === 'Active';

                return (
                  <article
                    key={`${item.ifsc}-${item.id}`}
                    className="bg-white dark:bg-slate-800/80 border-[1.5px] border-[#2F3E4E] dark:border-slate-600 rounded-2xl p-4 sm:p-5 shadow-[0_3px_0_#2F3E4E] dark:shadow-[0_3px_0_#020617] flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-1 rounded-lg bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] font-mono font-extrabold text-sm sm:text-base text-[#2F3E4E] tracking-wide">
                            {item.ifsc}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-[#FEF2C8] dark:bg-slate-700 border border-[#2F3E4E]/25 text-[11px] font-bold text-[#2F3E4E] dark:text-slate-200">
                            {item.bank_category || 'RBI Bank'}
                          </span>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                            isActive
                              ? 'bg-[#CEE5DC]/75 border-[#12805C]/35 text-[#12805C] dark:text-emerald-300'
                              : 'bg-[#FFE1B3]/80 border-[#B45309]/40 text-[#B45309] dark:text-amber-300'
                          }`}
                        >
                          {item.bank_status}
                        </span>
                      </div>

                      <div>
                        <div className="text-xs font-bold text-[#12805C] dark:text-emerald-400">
                          <RtoHighlightText text={item.bank_name} query={debouncedQuery} />
                        </div>
                        <h3 className="font-display font-extrabold text-base sm:text-lg text-[#2F3E4E] dark:text-slate-100 leading-snug">
                          <RtoHighlightText text={item.branch_name} query={debouncedQuery} />
                        </h3>
                        <p className="text-xs font-semibold text-[#475569] dark:text-slate-300 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-[#C85A32] shrink-0" />
                          <span>
                            {[item.city, item.district, item.state].filter(Boolean).join(', ') ||
                              'Location Not Available'}
                          </span>
                        </p>
                      </div>

                      <div className="bg-[#FEF2C8]/55 dark:bg-slate-900/70 border border-[#2F3E4E]/15 dark:border-slate-700 rounded-xl p-3 text-xs space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400">
                            BRANCH ADDRESS
                          </span>
                          <span className="font-mono text-[11px] font-bold text-[#2F3E4E] dark:text-slate-200">
                            MICR: {item.micr || 'Not Available'}
                          </span>
                        </div>
                        <div className="text-[#2F3E4E] dark:text-slate-200 font-medium leading-relaxed">
                          {item.address || 'Not Available'}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                        <span
                          className={`px-2 py-0.5 rounded border ${
                            item.neft
                              ? 'bg-[#CEE5DC]/60 border-[#12805C]/30 text-[#12805C]'
                              : 'bg-slate-100 border-slate-300 text-slate-500'
                          }`}
                        >
                          NEFT: {item.neft ? 'Yes' : 'No'}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded border ${
                            item.rtgs
                              ? 'bg-[#CEE5DC]/60 border-[#12805C]/30 text-[#12805C]'
                              : 'bg-slate-100 border-slate-300 text-slate-500'
                          }`}
                        >
                          RTGS: {item.rtgs ? 'Yes' : 'No'}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded border ${
                            item.imps
                              ? 'bg-[#CEE5DC]/60 border-[#12805C]/30 text-[#12805C]'
                              : 'bg-slate-100 border-slate-300 text-slate-500'
                          }`}
                        >
                          IMPS: {item.imps ? 'Yes' : 'No'}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded border ${
                            item.upi
                              ? 'bg-[#CEE5DC]/60 border-[#12805C]/30 text-[#12805C]'
                              : 'bg-slate-100 border-slate-300 text-slate-500'
                          }`}
                        >
                          UPI: {item.upi ? 'Yes' : 'No'}
                        </span>
                      </div>

                      {isExpanded && (
                        <dl className="grid grid-cols-2 gap-2.5 pt-2 border-t border-[#2F3E4E]/15 dark:border-slate-700 text-xs">
                          <div>
                            <dt className="text-[10px] font-semibold text-[#64748B] dark:text-slate-400">
                              BANK CODE / PREFIX
                            </dt>
                            <dd className="font-mono font-bold text-[#2F3E4E] dark:text-slate-200">
                              {item.bank_code || 'Not Available'}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[10px] font-semibold text-[#64748B] dark:text-slate-400">
                              BRANCH CODE (LAST 6)
                            </dt>
                            <dd className="font-mono font-bold text-[#2F3E4E] dark:text-slate-200">
                              {item.branch_code || 'Not Available'}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[10px] font-semibold text-[#64748B] dark:text-slate-400">
                              DISTRICT
                            </dt>
                            <dd className="font-medium text-[#2F3E4E] dark:text-slate-200">
                              {item.district || 'Not Available'}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[10px] font-semibold text-[#64748B] dark:text-slate-400">
                              CONTACT / SWIFT
                            </dt>
                            <dd className="font-mono text-[#2F3E4E] dark:text-slate-200">
                              {[item.contact, item.swift].filter(Boolean).join(' · ') ||
                                'Not Available'}
                            </dd>
                          </div>
                          {item.successor_bank && (
                            <div className="col-span-2">
                              <dt className="text-[10px] font-semibold text-[#B45309]">
                                SUCCESSOR BANK AFTER MERGER
                              </dt>
                              <dd className="font-bold text-[#2F3E4E] dark:text-slate-100">
                                {item.successor_bank}{' '}
                                {item.successor_ifsc_prefix
                                  ? `(${item.successor_ifsc_prefix} prefix)`
                                  : ''}
                              </dd>
                            </div>
                          )}
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
                        onClick={() => void handleCopyText(copyIfscKey, item.ifsc)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2F3E4E] hover:bg-[#1E293B] text-[#F9C80E] text-[11px] font-bold cursor-pointer"
                      >
                        {copiedKey === copyIfscKey ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Copied IFSC</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy IFSC</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void handleCopyText(
                            copyFullKey,
                            `IFSC: ${item.ifsc}\nBank: ${item.bank_name}\nBranch: ${item.branch_name}\nMICR: ${
                              item.micr || 'Not Available'
                            }\nAddress: ${item.address || 'Not Available'}\nCity/District/State: ${[
                              item.city,
                              item.district,
                              item.state,
                            ]
                              .filter(Boolean)
                              .join(', ')}`
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FEF2C8] dark:bg-slate-700 hover:bg-[#F9C80E] border border-[#2F3E4E]/40 text-[11px] font-bold text-[#2F3E4E] dark:text-slate-100 cursor-pointer"
                      >
                        {copiedKey === copyFullKey ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-[#12805C]" />
                            <span>Details Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy Details</span>
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

      {/* Bank-Wise & State-Wise Quick Directory */}
      {stats && stats.topBanks.length > 0 && (
        <section
          aria-labelledby="ifsc-bank-directory-heading"
          className="bg-[#FFFDF5] dark:bg-slate-900 border-[1.5px] border-[#2F3E4E] dark:border-slate-600 rounded-2xl p-5 sm:p-7 shadow-[0_4px_0_#2F3E4E] dark:shadow-[0_4px_0_#020617] space-y-5"
        >
          <div className="space-y-1 pb-3 border-b border-[#2F3E4E]/15 dark:border-slate-700">
            <h2
              id="ifsc-bank-directory-heading"
              className="font-display font-extrabold text-lg sm:text-xl text-[#2F3E4E] dark:text-slate-100"
            >
              Bank-Wise &amp; State-Wise IFSC Directory
            </h2>
            <p className="text-xs text-[#475569] dark:text-slate-300">
              Click any major bank or Indian state below to filter branches instantly.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
            {stats.topBanks.map((bank) => {
              const selected = bankFilter === bank.bankName;
              return (
                <button
                  key={bank.bankName}
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setDebouncedQuery('');
                    setBankFilter(bank.bankName);
                    setDistrictFilter('ALL');
                    setCityFilter('ALL');
                    setPage(1);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`rounded-xl p-3 border-[1.5px] text-left cursor-pointer transition-colors ${
                    selected
                      ? 'bg-[#2F3E4E] text-[#FFFDF5] border-[#2F3E4E]'
                      : 'bg-white dark:bg-slate-800 text-[#2F3E4E] dark:text-slate-100 border-[#2F3E4E]/25 dark:border-slate-700 hover:bg-[#FEF2C8]'
                  }`}
                >
                  <div className="text-xs font-display font-bold truncate" title={bank.bankName}>
                    {bank.bankName}
                  </div>
                  <div
                    className={`mt-1 font-mono text-[11px] tabular-nums ${
                      selected ? 'text-[#F9C80E]' : 'text-[#64748B] dark:text-slate-400'
                    }`}
                  >
                    {bank.bankCode} · {bank.branchCount.toLocaleString('en-IN')}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
