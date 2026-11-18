import { useMemo, useState } from 'react';
import { Check, Copy, MapPin, Search, Star, X } from 'lucide-react';
import { INDIA_RTO_RECORDS, RtoRecord, StateDirectorySummary } from '../../data/rtoDatabase';
import { INDIA_STATES_AND_UTS } from '../../data/statesAndUts';
import { RtoHighlightText } from './RtoHighlightText';

interface RtoStateDirectorySectionProps {
  records?: RtoRecord[];
  selectedStateName: string;
  onSelectStateName: (stateName: string) => void;
  onInspectRecord: (record: RtoRecord) => void;
  favorites: string[];
  onToggleFavorite: (code: string) => void;
}

export function RtoStateDirectorySection({
  records = INDIA_RTO_RECORDS,
  selectedStateName,
  onSelectStateName,
  onInspectRecord,
  favorites,
  onToggleFavorite,
}: RtoStateDirectorySectionProps) {
  const [territoryFilter, setTerritoryFilter] = useState<'All' | 'State' | 'Union Territory'>('All');
  const [stateSearch, setStateSearch] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const stateSummaries = useMemo<StateDirectorySummary[]>(() => {
    return INDIA_STATES_AND_UTS.map((info) => {
      const codesForState = new Set<string>([
        info.stateCode,
        ...(info.alternateCodes ?? []),
      ]);
      const stateRecs = records.filter(
        (rec) => codesForState.has(rec.stateCode) || rec.state === info.state
      );
      const activeCount = stateRecs.filter((r) => r.status === 'active').length;
      const historicalCount = stateRecs.filter((r) => r.status === 'historical').length;
      return {
        ...info,
        totalVerifiedCount: stateRecs.length,
        activeCount,
        historicalCount,
        records: stateRecs,
      };
    });
  }, [records]);

  const visibleStates = useMemo(() => {
    return stateSummaries.filter((item) => {
      if (territoryFilter !== 'All' && item.territoryType !== territoryFilter) return false;
      return true;
    });
  }, [stateSummaries, territoryFilter]);

  const activeStateSummary = useMemo(() => {
    return (
      stateSummaries.find((s) => s.state === selectedStateName) ??
      stateSummaries.find((s) => s.state === 'Karnataka') ??
      stateSummaries[0]
    );
  }, [stateSummaries, selectedStateName]);

  const filteredStateRecords = useMemo(() => {
    if (!activeStateSummary) return [];
    const q = stateSearch.trim().toLowerCase();
    if (!q) return activeStateSummary.records;
    const qCompact = q.replace(/[-\s]/g, '');
    return activeStateSummary.records.filter(
      (rec) =>
        rec.code.toLowerCase().includes(q) ||
        rec.code.replace('-', '').toLowerCase().includes(qCompact) ||
        rec.officeName.toLowerCase().includes(q) ||
        rec.district.toLowerCase().includes(q) ||
        rec.city.toLowerCase().includes(q)
    );
  }, [activeStateSummary, stateSearch]);

  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      window.setTimeout(() => setCopiedCode(null), 1500);
    } catch {
      // Ignore clipboard error
    }
  };

  return (
    <section
      id="state-rto-directory"
      aria-labelledby="state-directory-heading"
      className="bg-[#FFFDF5] dark:bg-slate-900 border-[1.5px] border-[#2F3E4E] dark:border-slate-600 rounded-2xl p-5 sm:p-7 shadow-[0_4px_0_#2F3E4E] dark:shadow-[0_4px_0_#020617] space-y-6"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-[#2F3E4E]/15 dark:border-slate-700">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-[#12805C] dark:text-emerald-400">
            All {stateSummaries.length} States &amp; Union Territories Represented
          </p>
          <h2
            id="state-directory-heading"
            className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] dark:text-slate-100 tracking-tight"
          >
            State-Wise Indian RTO Directory
          </h2>
          <p className="text-xs sm:text-sm text-[#475569] dark:text-slate-300">
            Select any State or Union Territory below to inspect verified RTO codes, office names, and districts.
          </p>
        </div>

        <div
          role="group"
          aria-label="Filter states by territory type"
          className="inline-flex items-center gap-1 p-1 bg-[#FEF2C8] dark:bg-slate-800 border-[1.5px] border-[#2F3E4E] dark:border-slate-600 rounded-xl self-start md:self-auto"
        >
          {(['All', 'State', 'Union Territory'] as const).map((type) => {
            const active = territoryFilter === type;
            const label =
              type === 'All'
                ? `All (36)`
                : type === 'State'
                ? 'States (28)'
                : 'Union Territories (8)';
            return (
              <button
                key={type}
                type="button"
                aria-pressed={active}
                onClick={() => setTerritoryFilter(type)}
                className={`px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-[#2F3E4E] text-[#F9C80E]'
                    : 'text-[#2F3E4E] dark:text-slate-300 hover:bg-[#FFE1B3]/70 dark:hover:bg-slate-700'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* State & UT Selector Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
        {visibleStates.map((item) => {
          const isSelected = activeStateSummary?.state === item.state;
          return (
            <button
              key={item.stateCode}
              type="button"
              onClick={() => {
                onSelectStateName(item.state);
                setStateSearch('');
              }}
              aria-pressed={isSelected}
              className={`rounded-xl p-3 border-[1.5px] text-left transition-all cursor-pointer flex flex-col justify-between gap-2 min-h-[84px] ${
                isSelected
                  ? 'bg-[#2F3E4E] text-[#FFFDF5] border-[#2F3E4E] shadow-[0_3px_0_#1E293B]'
                  : 'bg-white dark:bg-slate-800/80 text-[#2F3E4E] dark:text-slate-100 border-[#2F3E4E]/30 dark:border-slate-700 hover:border-[#2F3E4E] hover:bg-[#FEF2C8]/65 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center justify-between gap-1 w-full">
                <span
                  className={`font-mono text-xs font-extrabold px-1.5 py-0.5 rounded-md border ${
                    isSelected
                      ? 'bg-[#F9C80E] text-[#2F3E4E] border-[#F9C80E]'
                      : 'bg-[#FEF2C8] dark:bg-slate-700 text-[#2F3E4E] dark:text-slate-100 border-[#2F3E4E]/25 dark:border-slate-600'
                  }`}
                >
                  {item.stateCode}
                </span>
                <span
                  className={`font-mono text-[11px] font-bold tabular-nums ${
                    isSelected ? 'text-[#CEE5DC]' : 'text-[#64748B] dark:text-slate-400'
                  }`}
                >
                  {item.totalVerifiedCount} RTO{item.totalVerifiedCount === 1 ? '' : 's'}
                </span>
              </div>
              <span className="text-xs font-display font-bold leading-snug line-clamp-2">
                {item.state}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected State RTO Table */}
      {activeStateSummary && (
        <div className="bg-[#FEF2C8]/45 dark:bg-slate-800/50 border-[1.5px] border-[#2F3E4E] dark:border-slate-600 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-[#F9C80E] border border-[#2F3E4E] font-mono text-xs font-extrabold text-[#2F3E4E]">
                  {activeStateSummary.stateCode}
                </span>
                <h3 className="font-display font-extrabold text-lg sm:text-xl text-[#2F3E4E] dark:text-slate-100">
                  {activeStateSummary.state}
                </h3>
                <span className="text-xs text-[#475569] dark:text-slate-300 font-medium">
                  · {activeStateSummary.territoryType} ·{' '}
                  <strong className="font-mono tabular-nums text-[#2F3E4E] dark:text-slate-100">
                    {activeStateSummary.totalVerifiedCount}
                  </strong>{' '}
                  verified RTO records in local dataset
                </span>
              </div>
              {activeStateSummary.prefixNote && (
                <p className="text-xs text-[#475569] dark:text-slate-300">
                  {activeStateSummary.prefixNote}
                </p>
              )}
            </div>

            <div className="relative w-full sm:w-64">
              <Search
                className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]"
                aria-hidden="true"
              />
              <input
                type="text"
                value={stateSearch}
                onChange={(e) => setStateSearch(e.target.value)}
                placeholder={`Filter inside ${activeStateSummary.stateCode}...`}
                aria-label={`Search RTO offices inside ${activeStateSummary.state}`}
                className="w-full pl-8 pr-8 py-2 min-h-[40px] rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-slate-900 text-xs text-[#2F3E4E] dark:text-slate-100 placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#2F3E4E]"
              />
              {stateSearch && (
                <button
                  type="button"
                  onClick={() => setStateSearch('')}
                  aria-label="Clear state filter"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#2F3E4E] dark:hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {filteredStateRecords.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-[#2F3E4E]/20 dark:border-slate-700 rounded-xl p-6 text-center text-xs text-[#475569] dark:text-slate-300">
              No RTO offices matched &ldquo;{stateSearch}&rdquo; inside {activeStateSummary.state}.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[#2F3E4E]/25 dark:border-slate-700 bg-white dark:bg-slate-900">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#2F3E4E] text-[#FFFDF5]">
                  <tr>
                    <th className="py-2.5 px-3.5 font-semibold whitespace-nowrap">RTO Code</th>
                    <th className="py-2.5 px-3.5 font-semibold">RTO Office Name</th>
                    <th className="py-2.5 px-3.5 font-semibold">District</th>
                    <th className="py-2.5 px-3.5 font-semibold">City</th>
                    <th className="py-2.5 px-3.5 font-semibold">Status</th>
                    <th className="py-2.5 px-3.5 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2F3E4E]/10 dark:divide-slate-800">
                  {filteredStateRecords.map((rec) => {
                    const isFav = favorites.includes(rec.code);
                    return (
                      <tr
                        key={rec.code}
                        className="hover:bg-[#FEF2C8]/50 dark:hover:bg-slate-800/70 transition-colors"
                      >
                        <td className="py-2.5 px-3.5 font-mono font-bold text-[#2F3E4E] dark:text-slate-100 whitespace-nowrap tabular-nums">
                          <RtoHighlightText text={rec.code} query={stateSearch} />
                        </td>
                        <td className="py-2.5 px-3.5 font-semibold text-[#2F3E4E] dark:text-slate-100">
                          <RtoHighlightText text={rec.officeName} query={stateSearch} />
                        </td>
                        <td className="py-2.5 px-3.5 text-[#475569] dark:text-slate-300">
                          <RtoHighlightText text={rec.district} query={stateSearch} />
                        </td>
                        <td className="py-2.5 px-3.5 text-[#475569] dark:text-slate-300 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-[#64748B]" aria-hidden="true" />
                            <RtoHighlightText text={rec.city} query={stateSearch} />
                          </span>
                        </td>
                        <td className="py-2.5 px-3.5 whitespace-nowrap">
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
                        <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleCopy(rec.code)}
                              title={`Copy ${rec.code}`}
                              aria-label={`Copy ${rec.code}`}
                              className="p-1.5 rounded-lg border border-[#2F3E4E]/25 dark:border-slate-600 hover:bg-[#FEF2C8] dark:hover:bg-slate-700 text-[#2F3E4E] dark:text-slate-200 cursor-pointer"
                            >
                              {copiedCode === rec.code ? (
                                <Check className="w-3.5 h-3.5 text-[#12805C]" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => onToggleFavorite(rec.code)}
                              title={isFav ? 'Remove favourite' : 'Add to favourites'}
                              aria-label={isFav ? `Remove ${rec.code} from favourites` : `Add ${rec.code} to favourites`}
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
                              onClick={() => onInspectRecord(rec)}
                              className="px-2.5 py-1 rounded-lg bg-[#2F3E4E] hover:bg-[#1E293B] text-[#F9C80E] text-[11px] font-bold cursor-pointer"
                            >
                              Details
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
