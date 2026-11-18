/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Search, Check, Landmark, ShieldCheck } from 'lucide-react';
import { BankConfig, BANKS_LIST } from '../constants/banks';

interface BankSelectorModalProps {
  isOpen: boolean;
  activeBankId: string;
  onSelectBank: (bank: BankConfig) => void;
  onClose: () => void;
}

export const BankSelectorModal: React.FC<BankSelectorModalProps> = ({
  isOpen,
  activeBankId,
  onSelectBank,
  onClose,
}) => {
  const [search, setSearch] = useState('');
  const [sectorTab, setSectorTab] = useState<'all' | 'public' | 'private'>('all');
  const [reviewNotice, setReviewNotice] = useState<BankConfig | null>(null);

  if (!isOpen) return null;

  const filteredBanks = BANKS_LIST.filter((b) => {
    const matchesSector = sectorTab === 'all' || b.sector === sectorTab;
    const matchesSearch =
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.hindiName.includes(search) ||
      b.shortCode.toLowerCase().includes(search.toLowerCase()) ||
      b.ifscPrefix.toLowerCase().includes(search.toLowerCase());
    return matchesSector && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/20">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                Select Bank / बैंक चुनें
              </h2>
              <p className="text-xs text-slate-500">
                Choose from 32 Indian Public and Private sector banks.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Sector Filters */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-3 items-center justify-between bg-white">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by bank name (e.g. HDFC, Baroda, Canara, ICICI)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <button
              onClick={() => setSectorTab('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                sectorTab === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All (32)
            </button>
            <button
              onClick={() => setSectorTab('public')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                sectorTab === 'public'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Public Sector (12)
            </button>
            <button
              onClick={() => setSectorTab('private')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                sectorTab === 'private'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Private Sector (20)
            </button>
          </div>
        </div>

        {/* Active Bank Verification Notice */}
        {reviewNotice && (
          <div className="mx-4 mt-3 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start justify-between gap-3 animate-in fade-in">
            <div className="flex items-start gap-2.5">
              <div
                style={{ backgroundColor: reviewNotice.primaryColor }}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-[10px] shrink-0 mt-0.5"
              >
                {reviewNotice.shortCode.slice(0, 3)}
              </div>
              <div>
                <p className="font-bold text-slate-900">
                  {reviewNotice.name} &bull; Format Under Verification
                </p>
                <p className="text-slate-600 mt-0.5 leading-relaxed">
                  Challan and slip formats for {reviewNotice.name} will be released once verified with official branch standards. Currently, <strong>State Bank of India (SBI)</strong> and <strong>HDFC Bank</strong> are active with full voucher generator support.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setReviewNotice(null)}
              className="text-amber-700 hover:text-amber-900 font-bold px-2 py-1 rounded-lg hover:bg-amber-100 transition shrink-0 cursor-pointer text-xs"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Bank Cards Grid */}
        <div className="p-4 overflow-y-auto max-h-[60vh] space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {filteredBanks.map((b) => {
              const isSelected = b.id === activeBankId;
              const isOper = b.status === 'active';
              return (
                <div
                  key={b.id}
                  onClick={() => {
                    if (isOper) {
                      onSelectBank(b);
                      onClose();
                    } else {
                      setReviewNotice(b);
                    }
                  }}
                  className={`group relative p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/50 shadow-md'
                      : isOper
                      ? 'border-slate-200 bg-white hover:border-blue-400 hover:shadow-md'
                      : 'border-slate-200 bg-slate-50/60 hover:border-amber-300 hover:bg-amber-50/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        style={{ backgroundColor: b.primaryColor }}
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-xs shadow-xs shrink-0"
                      >
                        {b.shortCode.slice(0, 3)}
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-slate-900 leading-tight group-hover:text-blue-600 transition">
                          {b.name}
                        </h4>
                        <div className="text-[11px] text-slate-500 font-medium">
                          {b.hindiName}
                        </div>
                      </div>
                    </div>
                    {isSelected ? (
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    ) : isOper ? (
                      <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                        Active &bull; Live
                      </span>
                    ) : (
                      <span className="text-[9px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                        Coming Soon
                      </span>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                    <span className="font-mono font-semibold uppercase px-1.5 py-0.5 rounded bg-slate-100">
                      {b.ifscPrefix} &bull; {b.sector === 'public' ? 'Public' : 'Private'}
                    </span>
                    {isOper ? (
                      <span className="text-blue-600 font-bold group-hover:underline">
                        Use Bank &rarr;
                      </span>
                    ) : (
                      <span className="text-amber-700 font-medium">
                        Coming Soon
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Select any bank to inspect details and tailored official slips.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 text-slate-800 font-semibold hover:bg-slate-300 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
