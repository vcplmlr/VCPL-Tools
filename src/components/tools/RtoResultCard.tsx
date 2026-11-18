import { useState } from 'react';
import {
  Check,
  Copy,
  Info,
  MapPin,
  RotateCcw,
  Share2,
  ShieldCheck,
  Star,
} from 'lucide-react';
import { RtoRecord, getTerritoryTypeForRecord } from '../../data/rtoDatabase';
import { ParsedRegistrationResult } from '../../utils/rtoSearch';

interface RtoResultCardProps {
  record: RtoRecord;
  parsedPlate?: ParsedRegistrationResult | null;
  isFavorite: boolean;
  onToggleFavorite: (code: string) => void;
  onSearchAnother: () => void;
  onSelectStateDirectory?: (stateName: string) => void;
}

export function RtoResultCard({
  record,
  parsedPlate,
  isFavorite,
  onToggleFavorite,
  onSearchAnother,
  onSelectStateDirectory,
}: RtoResultCardProps) {
  const [copiedField, setCopiedField] = useState<'code' | 'details' | 'share' | null>(null);
  const territoryType = getTerritoryTypeForRecord(record);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(record.code);
      setCopiedField('code');
      window.setTimeout(() => setCopiedField(null), 1800);
    } catch {
      // Ignore clipboard restriction
    }
  };

  const handleCopyDetails = async () => {
    const detailsText = [
      `RTO CODE: ${record.code}`,
      `RTO OFFICE: ${record.officeName}`,
      `STATE / UT: ${record.state} (${record.stateCode})`,
      `DISTRICT: ${record.district}`,
      `CITY: ${record.city}`,
      `STATUS: ${record.status === 'active' ? 'Active' : 'Historical'}`,
      `ADDRESS: ${record.address || 'Not available'}`,
      `SOURCE: ${record.source}`,
      `LAST VERIFIED: ${record.lastVerified}`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(detailsText);
      setCopiedField('details');
      window.setTimeout(() => setCopiedField(null), 1800);
    } catch {
      // Ignore clipboard restriction
    }
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/tools/rto-code-finder/${encodeURIComponent(
      record.code
    )}`;
    const shareTitle = `${record.code} – ${record.officeName} | VCPL Tools`;
    const shareText = `${record.code}: ${record.officeName}, ${record.district}, ${record.state} (${record.stateCode})`;

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch {
        // User cancelled or share unsupported in embedded frame -> fallback to copy link
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedField('share');
      window.setTimeout(() => setCopiedField(null), 1800);
    } catch {
      // Ignore clipboard restriction
    }
  };

  return (
    <div className="bg-[#FFFDF5] dark:bg-slate-900 border-[1.5px] border-[#2F3E4E] dark:border-slate-600 rounded-2xl p-5 sm:p-7 shadow-[0_5px_0_#2F3E4E] dark:shadow-[0_5px_0_#020617] space-y-5">
      {/* Header Strip */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-[#2F3E4E]/15 dark:border-slate-700">
        <div className="space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#475569] dark:text-slate-300">
            <span className="inline-flex items-center gap-1 text-[#12805C] dark:text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Verified {territoryType} Record</span>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {record.status === 'active' ? 'Active Registration Office' : 'Historical Series'}
            </span>
          </div>

          <div className="flex flex-wrap items-baseline gap-3">
            <span className="inline-flex items-center px-3 py-1 rounded-lg bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] text-[#2F3E4E] font-mono font-extrabold text-xl sm:text-2xl tracking-tight tabular-nums">
              {record.code}
            </span>
            <h3 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] dark:text-slate-100 tracking-tight">
              {record.officeName}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onToggleFavorite(record.code)}
            aria-pressed={isFavorite}
            aria-label={isFavorite ? `Remove ${record.code} from favourites` : `Add ${record.code} to favourites`}
            className={`inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-500 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
              isFavorite
                ? 'bg-[#F9C80E] text-[#2F3E4E]'
                : 'bg-[#FEF2C8] dark:bg-slate-800 text-[#2F3E4E] dark:text-slate-200 hover:bg-[#FFE1B3] dark:hover:bg-slate-700'
            }`}
          >
            <Star
              className={`w-3.5 h-3.5 ${isFavorite ? 'fill-[#2F3E4E]' : ''}`}
              aria-hidden="true"
            />
            <span>{isFavorite ? 'Saved' : 'Favourite'}</span>
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-500 bg-white dark:bg-slate-800 hover:bg-[#CEE5DC] dark:hover:bg-slate-700 text-xs font-bold text-[#2F3E4E] dark:text-slate-100 transition-colors whitespace-nowrap cursor-pointer"
          >
            {copiedField === 'share' ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#12805C]" aria-hidden="true" />
                <span>Link Copied</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Share</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Full Vehicle Registration Number Breakdown (when user entered e.g. KA19AB1234) */}
      {parsedPlate?.isFullPlate && !parsedPlate.isBhSeries && (
        <div className="bg-[#CEE5DC]/55 dark:bg-emerald-950/40 border-[1.5px] border-[#2F3E4E]/35 dark:border-emerald-700/60 rounded-xl p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="text-xs font-display font-bold text-[#2F3E4E] dark:text-emerald-200">
              Parsed Vehicle Registration Breakdown
            </div>
            <span className="text-[11px] font-medium text-[#334155] dark:text-slate-300">
              Prefix identification only · No RC / owner data queried
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-white dark:bg-slate-900 border border-[#2F3E4E]/25 dark:border-slate-700 rounded-lg p-2.5">
              <div className="text-[11px] text-[#64748B] dark:text-slate-400">State / UT</div>
              <div className="mt-0.5 font-mono font-bold text-sm text-[#2F3E4E] dark:text-slate-100">
                {parsedPlate.stateCode}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-[#2F3E4E]/25 dark:border-slate-700 rounded-lg p-2.5">
              <div className="text-[11px] text-[#64748B] dark:text-slate-400">RTO District</div>
              <div className="mt-0.5 font-mono font-bold text-sm text-[#2F3E4E] dark:text-slate-100 tabular-nums">
                {parsedPlate.rtoNumber}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-[#2F3E4E]/25 dark:border-slate-700 rounded-lg p-2.5">
              <div className="text-[11px] text-[#64748B] dark:text-slate-400">Series Letters</div>
              <div className="mt-0.5 font-mono font-bold text-sm text-[#2F3E4E] dark:text-slate-100">
                {parsedPlate.seriesLetters || '—'}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-[#2F3E4E]/25 dark:border-slate-700 rounded-lg p-2.5">
              <div className="text-[11px] text-[#64748B] dark:text-slate-400">Unique Number</div>
              <div className="mt-0.5 font-mono font-bold text-sm text-[#2F3E4E] dark:text-slate-100 tabular-nums">
                {parsedPlate.vehicleNumber || '—'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Optional Historical / Remapped Note */}
      {(record.note || parsedPlate?.remappedNote) && (
        <div className="bg-[#FFE1B3]/75 dark:bg-amber-950/40 border border-[#2F3E4E]/30 dark:border-amber-700/60 rounded-xl px-4 py-3 flex items-start gap-2.5 text-xs text-[#2F3E4E] dark:text-amber-100">
          <Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="leading-relaxed">
            {record.note || parsedPlate?.remappedNote}
          </p>
        </div>
      )}

      {/* Structured Key-Value Grid */}
      <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-[#FEF2C8]/65 dark:bg-slate-800/70 border border-[#2F3E4E]/20 dark:border-slate-700 rounded-xl p-3.5">
          <dt className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400">
            RTO CODE
          </dt>
          <dd className="mt-1 font-mono font-bold text-base text-[#2F3E4E] dark:text-slate-100 tabular-nums">
            {record.code}
          </dd>
        </div>

        <div className="bg-[#FEF2C8]/65 dark:bg-slate-800/70 border border-[#2F3E4E]/20 dark:border-slate-700 rounded-xl p-3.5">
          <dt className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400">
            RTO OFFICE
          </dt>
          <dd className="mt-1 font-display font-bold text-base text-[#2F3E4E] dark:text-slate-100">
            {record.officeName}
          </dd>
        </div>

        <div className="bg-[#FEF2C8]/65 dark:bg-slate-800/70 border border-[#2F3E4E]/20 dark:border-slate-700 rounded-xl p-3.5">
          <dt className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400">
            STATE / UT
          </dt>
          <dd className="mt-1 font-display font-bold text-base text-[#2F3E4E] dark:text-slate-100 flex items-center justify-between gap-2">
            <span>{record.state}</span>
            {onSelectStateDirectory && (
              <button
                type="button"
                onClick={() => onSelectStateDirectory(record.state)}
                className="text-[11px] font-semibold underline underline-offset-2 text-[#12805C] dark:text-emerald-400 hover:opacity-80 cursor-pointer shrink-0"
              >
                View All
              </button>
            )}
          </dd>
        </div>

        <div className="bg-[#FEF2C8]/65 dark:bg-slate-800/70 border border-[#2F3E4E]/20 dark:border-slate-700 rounded-xl p-3.5">
          <dt className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400">
            STATE CODE
          </dt>
          <dd className="mt-1 font-mono font-bold text-base text-[#2F3E4E] dark:text-slate-100">
            {record.stateCode}
          </dd>
        </div>

        <div className="bg-[#FEF2C8]/65 dark:bg-slate-800/70 border border-[#2F3E4E]/20 dark:border-slate-700 rounded-xl p-3.5">
          <dt className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400">
            DISTRICT
          </dt>
          <dd className="mt-1 font-semibold text-base text-[#2F3E4E] dark:text-slate-100">
            {record.district}
          </dd>
        </div>

        <div className="bg-[#FEF2C8]/65 dark:bg-slate-800/70 border border-[#2F3E4E]/20 dark:border-slate-700 rounded-xl p-3.5">
          <dt className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400">
            CITY
          </dt>
          <dd className="mt-1 font-semibold text-base text-[#2F3E4E] dark:text-slate-100 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-[#64748B] shrink-0" aria-hidden="true" />
            <span>{record.city}</span>
          </dd>
        </div>
      </dl>

      {/* Secondary Verified Metadata Row */}
      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-[#2F3E4E]/15 dark:border-slate-700 text-xs">
        <div>
          <dt className="text-[#64748B] dark:text-slate-400 font-semibold">OFFICE ADDRESS</dt>
          <dd className="mt-0.5 text-[#2F3E4E] dark:text-slate-200 font-medium">
            {record.address || 'Not available'}
          </dd>
        </div>
        <div>
          <dt className="text-[#64748B] dark:text-slate-400 font-semibold">REFERENCE SOURCE</dt>
          <dd className="mt-0.5 text-[#2F3E4E] dark:text-slate-200 font-medium">
            {record.source}
          </dd>
        </div>
        <div>
          <dt className="text-[#64748B] dark:text-slate-400 font-semibold">LAST VERIFIED</dt>
          <dd className="mt-0.5 font-mono text-[#2F3E4E] dark:text-slate-200 font-medium tabular-nums">
            {record.lastVerified}
          </dd>
        </div>
      </dl>

      {/* Action Buttons */}
      <div className="pt-4 border-t border-[#2F3E4E]/15 dark:border-slate-700 flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={handleCopyCode}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[40px] rounded-xl bg-[#2F3E4E] hover:bg-[#1E293B] text-[#F9C80E] border-[1.5px] border-[#2F3E4E] shadow-[0_2px_0_#1E293B] text-xs font-bold transition-colors whitespace-nowrap cursor-pointer"
        >
          {copiedField === 'code' ? (
            <>
              <Check className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Copied {record.code}</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Copy RTO Code</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleCopyDetails}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[40px] rounded-xl bg-[#F9C80E] hover:bg-[#FFE1B3] text-[#2F3E4E] border-[1.5px] border-[#2F3E4E] shadow-[0_2px_0_#2F3E4E] text-xs font-bold transition-colors whitespace-nowrap cursor-pointer"
        >
          {copiedField === 'details' ? (
            <>
              <Check className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Copied Full Details</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Copy RTO Details</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onSearchAnother}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[40px] rounded-xl bg-white dark:bg-slate-800 hover:bg-[#FEF2C8] dark:hover:bg-slate-700 text-[#2F3E4E] dark:text-slate-100 border-[1.5px] border-[#2F3E4E] dark:border-slate-500 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer sm:ml-auto"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Search Another Code</span>
        </button>
      </div>
    </div>
  );
}
