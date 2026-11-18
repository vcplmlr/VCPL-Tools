/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Building,
  CreditCard,
  User,
  Calendar,
  AlertTriangle,
  FileText,
  Truck,
  CheckSquare,
} from 'lucide-react';
import { HdfcDdFormData } from '../types';
import { wordsCurrency } from '../utils/numberToWords';

interface HdfcDdVerticalDataEntryProps {
  data: HdfcDdFormData;
  onChange: (data: HdfcDdFormData) => void;
  onClear: () => void;
}

export const HdfcDdVerticalDataEntry: React.FC<HdfcDdVerticalDataEntryProps> = ({
  data,
  onChange,
  onClear,
}) => {
  const update = <K extends keyof HdfcDdFormData>(key: K, value: HdfcDdFormData[K]) => {
    onChange({ ...data, [key]: value });
  };

  const amtNum = typeof data.amount === 'number' ? data.amount : 0;
  const wordsEng = amtNum > 0 ? wordsCurrency(amtNum) : '';

  return (
    <div className="space-y-4">
      {/* 1. Application Details Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">
              <Building className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 leading-tight">
                Demand Draft Application / डीडी आवेदन
              </h3>
              <p className="text-[11px] text-slate-500">
                HDFC Bank Demand Draft against Cheque
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-1 rounded-md hover:bg-rose-50 transition cursor-pointer"
          >
            Clear Form
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" /> Date / दिनांक <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={data.date}
                onChange={(e) => update('date', e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                Branch / शाखा :- <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. FORT, MUMBAI"
                value={data.branch}
                onChange={(e) => update('branch', e.target.value.toUpperCase())}
                className="w-full px-2.5 py-1.5 text-xs uppercase font-medium rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
              />
            </div>
          </div>

          <div className="pt-1">
            <label
              onClick={() => update('isDdChecked', !data.isDdChecked)}
              className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800 select-none"
            >
              <input
                type="checkbox"
                checked={data.isDdChecked}
                onChange={(e) => update('isDdChecked', e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Please Issue Demand Draft (Tick as Applicable)</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                Demand Draft Payable At / देय स्थान <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. NEW DELHI"
                value={data.payableAt}
                onChange={(e) => update('payableAt', e.target.value.toUpperCase())}
                className="w-full px-2.5 py-1.5 text-xs uppercase font-medium rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                Favoring / किसके नाम से (Payee Name) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. REGISTRAR, DELHI UNIVERSITY"
                value={data.favoring}
                onChange={(e) => update('favoring', e.target.value.toUpperCase())}
                className="w-full px-2.5 py-1.5 text-xs font-bold uppercase rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Amount & Words Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
        <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-100">
          <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
            <CreditCard className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 leading-tight">
              Draft Amount / ड्राफ्ट राशि
            </h3>
            <p className="text-[11px] text-slate-500">
              Amount in figures and automatic Indian words
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1 block">
              For Amount Rs. (in figures) / राशि अंकों में <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-slate-400 font-bold text-sm">₹</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 50000"
                value={data.amount === '' ? '' : data.amount}
                onChange={(e) => {
                  const val = e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value) || 0);
                  update('amount', val);
                }}
                className="w-full pl-8 pr-3 py-2 text-sm font-bold font-mono text-slate-900 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
              />
            </div>
          </div>

          {wordsEng && (
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                Amount in Words (Auto-Generated)
              </span>
              <p className="font-semibold text-amber-950 leading-relaxed">{wordsEng}</p>
            </div>
          )}
        </div>
      </div>

      {/* 3. Payment Mode & Cheque Details Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
        <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-100">
          <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 leading-tight">
              Payment &amp; Account Details / भुगतान एवं खाता
            </h3>
            <p className="text-[11px] text-slate-500">
              Cheque drawn in favour of "HDFC Bank Ltd for DD"
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                Mode of Payment :- Cheque No. <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="6-digit Cheque No."
                value={data.chequeNo}
                onChange={(e) => update('chequeNo', e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" /> Cheque Drawn Date / चेक दिनांक
              </label>
              <input
                type="date"
                value={data.chequeDate}
                onChange={(e) => update('chequeDate', e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                Purchaser Name / क्रेता का नाम <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. RAJESH KUMAR SHARMA"
                value={data.purchaserName}
                onChange={(e) => update('purchaserName', e.target.value.toUpperCase())}
                className="w-full px-2.5 py-1.5 text-xs uppercase font-medium rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                Customer's A/c Number / खाता संख्या <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                maxLength={16}
                placeholder="14-digit HDFC Account No."
                value={data.accountNo}
                onChange={(e) => update('accountNo', e.target.value.replace(/\D/g, ''))}
                className="w-full px-2.5 py-1.5 text-xs font-mono tracking-wider rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4. Delivery Instructions Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
        <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-100">
          <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-xs">
            <Truck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 leading-tight">
              Delivery Authorization / सुपुर्दगी प्राधिकार
            </h3>
            <p className="text-[11px] text-slate-500">
              Person authorized to collect the Demand Draft
            </p>
          </div>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
            Please deliver the Demand Draft to Mr / Ms.
          </label>
          <input
            type="text"
            placeholder="e.g. SURESH MEHTA (Leave blank if collecting self)"
            value={data.deliverTo}
            onChange={(e) => update('deliverTo', e.target.value.toUpperCase())}
            className="w-full px-2.5 py-1.5 text-xs uppercase font-medium rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
          />
          <span className="text-[10px] text-slate-400 mt-1 block">
            Whose signature is appended on the bearer line of the form.
          </span>
        </div>
      </div>

      {/* Cyber Safety Warning */}
      <div className="p-3 bg-neutral-900 text-white rounded-2xl text-xs space-y-1">
        <div className="flex items-center gap-1.5 font-bold text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>CYBER FRAUD WARNING &bull; DEMAND DRAFT SAFETY</span>
        </div>
        <p className="text-[11px] text-neutral-300 leading-relaxed">
          Do not fall victim to online offers from third parties requesting photocopies or images of drafts for business deals or under threat of digital arrest. There is no such thing as digital arrest. Stay calm and speak to branch staff.
        </p>
      </div>
    </div>
  );
};
