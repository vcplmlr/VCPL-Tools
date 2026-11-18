import { useState } from 'react';
import { Check, Landmark, Search, ShieldCheck, X } from 'lucide-react';
import { BANKS_LIST, BankConfig } from '../../data/banksList';

interface BankSelectorModalProps {
  isOpen: boolean;
  activeBankId: string;
  onSelectBank: (bank: BankConfig) => void;
  onClose: () => void;
}

export function BankSelectorModal({
  isOpen,
  activeBankId,
  onSelectBank,
  onClose,
}: BankSelectorModalProps) {
  const [search, setSearch] = useState('');
  const [sectorTab, setSectorTab] = useState<'all' | 'public' | 'private'>('all');
  const [reviewNotice, setReviewNotice] = useState<BankConfig | null>(null);

  if (!isOpen) return null;

  const filteredBanks = BANKS_LIST.filter((b) => {
    const matchesSector = sectorTab === 'all' || b.sector === sectorTab;
    const q = search.toLowerCase();
    const matchesSearch =
      b.name.toLowerCase().includes(q) ||
      b.hindiName.includes(search) ||
      b.shortCode.toLowerCase().includes(q) ||
      b.ifscPrefix.toLowerCase().includes(q);
    return matchesSector && matchesSearch;
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1E293B]/65 backdrop-blur-[2px] font-sans no-print"
      onClick={onClose}
    >
      <div
        className="bg-[#FFFDF5] border-2 border-[#2F3E4E] rounded-2xl shadow-[0_8px_0_#2F3E4E] max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-[#2F3E4E]/15 flex items-center justify-between bg-[#FEF2C8]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#2F3E4E] text-[#FFFDF5] flex items-center justify-center shrink-0">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-extrabold text-[#2F3E4E] leading-tight">
                Select Bank / बैंक चुनें
              </h2>
              <p className="text-xs text-[#475569]">
                32 Indian Public &amp; Private sector banks (SBI &amp; HDFC Slip Generators Live).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close bank selector"
            className="p-2 rounded-lg border-[1.5px] border-[#2F3E4E] bg-[#FFFDF5] text-[#2F3E4E] hover:bg-[#2F3E4E] hover:text-[#FFFDF5] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Sector Filters */}
        <div className="p-4 border-b border-[#2F3E4E]/15 flex flex-col sm:flex-row gap-3 items-center justify-between bg-[#FFFDF5]">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#64748B]" />
            <input
              type="text"
              placeholder="Search bank (e.g. SBI, HDFC, Baroda, Canara, ICICI)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border-[1.5px] border-[#2F3E4E] bg-white text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#2F3E4E] font-medium"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
            {(
              [
                { key: 'all', label: `All (${BANKS_LIST.length})` },
                { key: 'public', label: 'Public Sector' },
                { key: 'private', label: 'Private Sector' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setSectorTab(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-[1.5px] border-[#2F3E4E] transition cursor-pointer whitespace-nowrap ${
                  sectorTab === tab.key
                    ? 'bg-[#2F3E4E] text-[#FFFDF5]'
                    : 'bg-[#FFFDF5] text-[#2F3E4E] hover:bg-[#FEF2C8]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Verification Notice for Upcoming Banks */}
        {reviewNotice && (
          <div className="mx-4 mt-3 p-3.5 rounded-xl bg-[#FFE1B3] border-[1.5px] border-[#2F3E4E] text-xs text-[#2F3E4E] flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div
                style={{ backgroundColor: reviewNotice.primaryColor }}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-[10px] shrink-0 mt-0.5"
              >
                {reviewNotice.shortCode.slice(0, 3)}
              </div>
              <div>
                <p className="font-bold">
                  {reviewNotice.name} · Stationary Format Verification Pending
                </p>
                <p className="text-[#334155] mt-0.5 leading-relaxed">
                  Official branch slip coordinates for {reviewNotice.name} ({reviewNotice.ifscPrefix}) are queued for calibration.{' '}
                  <strong>State Bank of India (SBI)</strong> and <strong>HDFC Bank</strong> are currently active with full Deposit, DD, and RTGS/NEFT support.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setReviewNotice(null)}
              className="font-bold px-2.5 py-1 rounded-lg bg-[#FFFDF5] border border-[#2F3E4E] hover:bg-[#2F3E4E] hover:text-[#FFFDF5] transition shrink-0 cursor-pointer text-xs"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Bank Cards Grid */}
        <div className="p-4 overflow-y-auto max-h-[58vh]">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {filteredBanks.map((b) => {
              const isSelected = b.id === activeBankId;
              const isOper = b.status === 'active';
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    if (isOper) {
                      onSelectBank(b);
                      onClose();
                    } else {
                      setReviewNotice(b);
                    }
                  }}
                  className={`text-left p-3.5 rounded-xl border-[1.5px] transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'border-[#2F3E4E] bg-[#CEE5DC] shadow-[0_3px_0_#2F3E4E]'
                      : isOper
                      ? 'border-[#2F3E4E] bg-white hover:-translate-y-0.5 hover:shadow-[0_3px_0_#2F3E4E]'
                      : 'border-[#2F3E4E]/25 bg-white/60 hover:border-[#2F3E4E]/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        style={{ backgroundColor: b.primaryColor }}
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0"
                      >
                        {b.shortCode.slice(0, 3)}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-xs text-[#2F3E4E] leading-tight truncate">
                          {b.name}
                        </h4>
                        <div className="text-[11px] text-[#64748B] truncate">{b.hindiName}</div>
                      </div>
                    </div>
                    {isSelected ? (
                      <span className="w-5 h-5 rounded-full bg-[#2F3E4E] text-white flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    ) : isOper ? (
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 rounded shrink-0">
                        Live
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-[#64748B] bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded shrink-0">
                        Queued
                      </span>
                    )}
                  </div>

                  <div className="pt-2 border-t border-[#2F3E4E]/10 flex items-center justify-between text-[10px] text-[#475569]">
                    <span className="font-mono font-semibold uppercase px-1.5 py-0.5 rounded bg-[#FEF2C8]">
                      {b.ifscPrefix} · {b.sector === 'public' ? 'Public' : 'Private'}
                    </span>
                    <span className={isOper ? 'font-bold text-[#2F3E4E]' : 'text-[#64748B]'}>
                      {isOper ? 'Select Bank →' : 'Format Queued'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#2F3E4E]/15 bg-[#FEF2C8] flex items-center justify-between text-xs text-[#475569]">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            <span>Need IFSC/MICR details for all 1,100+ banks? Use our IFSC Directory tool.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#2F3E4E] text-[#FFFDF5] font-semibold hover:bg-[#1E293B] transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
