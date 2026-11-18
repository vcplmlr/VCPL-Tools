/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { SUPPORTED_BANKS, BankConfig } from '../constants/banks';
import { CheckCircle2, Clock, Info, X } from 'lucide-react';

interface BankSelectorProps {
  selectedBankId: string;
  onSelectBank: (bankId: string) => void;
}

export const BankSelector: React.FC<BankSelectorProps> = ({
  selectedBankId,
  onSelectBank,
}) => {
  const [noticeBank, setNoticeBank] = useState<BankConfig | null>(null);

  const handleBankClick = (bank: BankConfig) => {
    if (bank.status === 'active') {
      onSelectBank(bank.id);
    } else {
      setNoticeBank(bank);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          Select Bank / बैंक का चयन करें
        </div>
        <div className="text-xs text-slate-500">
          SBI Live · Other banks awaiting verified standard formats
        </div>
      </div>

      {/* Bank Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {SUPPORTED_BANKS.map((bank) => {
          const isActive = bank.id === selectedBankId;
          const isOperational = bank.status === 'active';

          return (
            <button
              key={bank.id}
              type="button"
              onClick={() => handleBankClick(bank)}
              className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between h-24 ${
                isActive
                  ? 'border-indigo-600 bg-indigo-50/60 shadow-sm ring-2 ring-indigo-600 text-slate-900'
                  : isOperational
                  ? 'border-slate-300 bg-white hover:border-slate-400 text-slate-900'
                  : 'border-slate-200 bg-slate-50/80 hover:bg-slate-100/90 text-slate-500 opacity-80 cursor-pointer'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span
                  className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-extrabold text-white"
                  style={{ backgroundColor: bank.primaryColor }}
                >
                  {bank.shortCode.substring(0, 2)}
                </span>

                {isOperational ? (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                    Active
                  </span>
                ) : (
                  <span className="text-[9px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1 py-0.2 rounded">
                    Soon
                  </span>
                )}
              </div>

              <div>
                <div className="font-bold text-xs truncate text-slate-900">
                  {bank.name}
                </div>
                <div className="text-[10px] text-slate-500 truncate">
                  {bank.hindiName}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Info notice when an inactive bank is selected */}
      {noticeBank && (
        <div className="p-4 bg-amber-50/90 border border-amber-200 rounded-xl flex items-start justify-between gap-3 text-amber-900 animate-in fade-in duration-150">
          <div className="flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
            <div>
              <div className="text-xs font-bold text-amber-950">
                {noticeBank.name} ({noticeBank.hindiName}) Form is Coming Soon
              </div>
              <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                As per your instructions, only <strong>State Bank of India (SBI)</strong> is currently active to ensure strictly standardized bank formats. Forms for {noticeBank.name} and other banks will be unlocked one by one once their exact official formats are provided.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setNoticeBank(null)}
            className="text-amber-700 hover:text-amber-900 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
