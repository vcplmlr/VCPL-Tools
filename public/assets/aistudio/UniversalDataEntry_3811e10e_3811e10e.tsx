/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Banknote,
  Send,
  Building,
  RotateCcw,
  Sparkles,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Sliders,
  ChevronDown,
  User,
  CreditCard,
  Phone,
  Hash,
  ShieldAlert,
  FileSpreadsheet,
} from 'lucide-react';
import { BankConfig } from '../constants/banks';
import { SbiSlipType } from '../types';
import { numberToWordsIndian, wordsCurrency } from '../utils/numberToWords';

export interface UniversalFormData {
  // Section A: Basic Details
  date: string;
  branch: string;
  bcode?: string;
  depositMode: 'cash' | 'cheque' | 'both';
  accountType: 'savings' | 'current' | 'loan' | 'cc';

  // Section B: Account Details
  accountNo: string;
  accountNoConfirm?: string;
  name: string;
  mobile: string;
  email?: string;
  pan?: string;

  // Section C: Transaction & Amount
  totalAmount: number | '';
  amountWordsEn?: string;
  amountWordsHi?: string;
  depositorName?: string;
  depositorMobile?: string;

  // Section D: Cash Denominations
  denominations: {
    2000: number | '';
    500: number | '';
    200: number | '';
    100: number | '';
    50: number | '';
    20: number | '';
    10: number | '';
    5: number | '';
    coins: number | '';
  };

  // Cheque Details
  chequeNo?: string;
  chequeDate?: string;
  draweeBank?: string;
  cheques?: Array<{
    chequeNo: string;
    draweeBank: string;
    amount: number | '';
  }>;

  // Section E: NEFT / RTGS Transfer Details
  transferType?: 'neft' | 'rtgs';
  benName?: string;
  benBank?: string;
  benBranch?: string;
  benIfsc?: string;
  benAccountNo?: string;
  benAccountNoConfirm?: string;
  charges?: number | '';
  purpose?: string;

  // Section E: Demand Draft Details
  inFavourOf?: string;
  payableAt?: string;
  exchangeFee?: number | '';
  deliverTo?: string;
}

interface UniversalDataEntryProps {
  bank: BankConfig;
  slipType: SbiSlipType;
  data: UniversalFormData;
  onChange: (updated: UniversalFormData) => void;
  onClear: () => void;
  onOpenBankSelector: () => void;
  onSelectSlipType: (type: SbiSlipType) => void;
  onOpenBulkModal?: () => void;
}

export const UniversalDataEntry: React.FC<UniversalDataEntryProps> = ({
  bank,
  slipType,
  data,
  onChange,
  onClear,
  onOpenBankSelector,
  onSelectSlipType,
  onOpenBulkModal,
}) => {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<'form' | 'denominations'>('form');

  const isNeft = slipType === 'neft_rtgs' || slipType === 'hdfc_neft';
  const isDd = slipType === 'demand_draft' || slipType === 'hdfc_dd';
  const isDeposit = !isNeft && !isDd;

  // Calculate denomination total
  const denomSum =
    (Number(data.denominations[2000] || 0) * 2000) +
    (Number(data.denominations[500] || 0) * 500) +
    (Number(data.denominations[200] || 0) * 200) +
    (Number(data.denominations[100] || 0) * 100) +
    (Number(data.denominations[50] || 0) * 50) +
    (Number(data.denominations[20] || 0) * 20) +
    (Number(data.denominations[10] || 0) * 10) +
    (Number(data.denominations[5] || 0) * 5) +
    Number(data.denominations.coins || 0);

  const declaredAmount = Number(data.totalAmount || 0);
  const hasMismatch =
    isDeposit &&
    (data.depositMode === 'cash' || data.depositMode === 'both') &&
    denomSum > 0 &&
    declaredAmount > 0 &&
    denomSum !== declaredAmount;

  // Sample data filler
  const handleFillSample = () => {
    const today = new Date().toLocaleDateString('en-GB');
    if (isNeft) {
      onChange({
        ...data,
        date: today,
        branch: 'Nariman Point, Mumbai',
        bcode: '00284',
        name: 'Rajesh Kumar Sharma',
        accountNo: bank.id === 'hdfc' ? '50100482910394' : '38495029384',
        mobile: '9876543210',
        transferType: 'neft',
        totalAmount: 45000,
        amountWordsEn: numberToWordsIndian(45000) + ' Only',
        benName: 'Apex Infotech Solutions Pvt Ltd',
        benBank: 'State Bank of India',
        benBranch: 'Connaught Place, New Delhi',
        benIfsc: 'SBIN0000691',
        benAccountNo: '20394857291',
        benAccountNoConfirm: '20394857291',
        charges: 5,
        purpose: 'Vendor Software License Fee',
      });
    } else if (isDd) {
      onChange({
        ...data,
        date: today,
        branch: 'Fort Branch, Mumbai',
        name: 'Suresh Patil',
        accountNo: bank.id === 'hdfc' ? '50100293847561' : '39281746501',
        mobile: '9811223344',
        inFavourOf: 'Registrar, University of Mumbai',
        payableAt: 'Mumbai',
        totalAmount: 25000,
        amountWordsEn: numberToWordsIndian(25000) + ' Only',
        exchangeFee: 50,
        chequeNo: '482910',
        chequeDate: today,
        deliverTo: 'Self',
      });
    } else {
      onChange({
        ...data,
        date: today,
        branch: 'Andheri East, Mumbai',
        name: 'Amitabh Joshi',
        accountNo: bank.id === 'hdfc' ? '50100987654321' : '31092847561',
        mobile: '9820012345',
        depositMode: 'cash',
        totalAmount: 18500,
        amountWordsEn: numberToWordsIndian(18500) + ' Only',
        amountWordsHi: 'अठारह हज़ार पाँच सौ रुपये मात्र',
        denominations: {
          2000: '',
          500: 30, // 15,000
          200: 15, // 3,000
          100: 5,  // 500
          50: '',
          20: '',
          10: '',
          5: '',
          coins: '',
        },
      });
    }
  };

  const handleAmountChange = (valStr: string) => {
    const val = valStr === '' ? '' : parseFloat(valStr) || 0;
    const words = typeof val === 'number' && val > 0 ? numberToWordsIndian(val) + ' Only' : '';
    onChange({
      ...data,
      totalAmount: val,
      amountWordsEn: words,
    });
  };

  const setDenom = (key: keyof UniversalFormData['denominations'], valStr: string) => {
    const val = valStr === '' ? '' : parseInt(valStr, 10) || 0;
    const nextDenom = { ...data.denominations, [key]: val };
    onChange({
      ...data,
      denominations: nextDenom,
    });
  };

  return (
    <div className="no-print bg-white border border-neutral-900/15 rounded-3xl shadow-xs overflow-hidden font-sans">
      {/* Top Universal Header Bar */}
      <div className="p-4 sm:p-5 border-b border-stone-200/80 bg-[#FAF8F5]/60 flex flex-wrap items-center justify-between gap-3">
        {/* Bank & Form Pill Selector */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenBankSelector}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-stone-300 hover:border-black bg-white shadow-2xs transition cursor-pointer text-xs"
            title="Switch Bank"
          >
            <div
              className="w-5 h-5 rounded-md flex items-center justify-center text-white text-[10px] font-black"
              style={{ backgroundColor: bank.primaryColor }}
            >
              {bank.shortCode.charAt(0)}
            </div>
            <span className="font-extrabold text-[#18181B]">{bank.name}</span>
            <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
          </button>

          {/* Slip Type Switcher Pill */}
          <div className="flex items-center bg-stone-100 p-0.5 rounded-full text-xs font-semibold">
            <button
              type="button"
              onClick={() => onSelectSlipType(bank.id === 'hdfc' ? 'hdfc_deposit' : 'deposit')}
              className={`px-3 py-1.5 rounded-full transition cursor-pointer flex items-center gap-1.5 ${
                isDeposit
                  ? 'bg-[#18181B] text-white font-bold shadow-xs'
                  : 'text-stone-600 hover:text-black'
              }`}
            >
              <Banknote className="w-3.5 h-3.5" />
              <span>Deposit Slip</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectSlipType(bank.id === 'hdfc' ? 'hdfc_neft' : 'neft_rtgs')}
              className={`px-3 py-1.5 rounded-full transition cursor-pointer flex items-center gap-1.5 ${
                isNeft
                  ? 'bg-[#18181B] text-white font-bold shadow-xs'
                  : 'text-stone-600 hover:text-black'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>NEFT / RTGS</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectSlipType(bank.id === 'hdfc' ? 'hdfc_dd' : 'demand_draft')}
              className={`px-3 py-1.5 rounded-full transition cursor-pointer flex items-center gap-1.5 ${
                isDd
                  ? 'bg-[#18181B] text-white font-bold shadow-xs'
                  : 'text-stone-600 hover:text-black'
              }`}
            >
              <Building className="w-3.5 h-3.5" />
              <span>Demand Draft</span>
            </button>
          </div>
        </div>

        {/* Action Shortcuts: Sample Data, Clear Form, Excel Bulk */}
        <div className="flex items-center gap-2">
          {onOpenBulkModal && (
            <button
              type="button"
              onClick={onOpenBulkModal}
              className="px-3.5 py-1.5 rounded-full bg-[#FFE870] hover:bg-[#FDD835] text-neutral-950 border border-neutral-900/20 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Bulk Generate Slips via Excel upload"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-neutral-950" />
              <span className="hidden sm:inline">Bulk Excel</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleFillSample}
            className="px-3.5 py-1.5 rounded-full bg-white hover:bg-stone-50 text-stone-800 border border-stone-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            title="Fill realistic sample data for instant testing"
          >
            <Sparkles className="w-3.5 h-3.5 text-stone-600" />
            <span>Sample Data</span>
          </button>

          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            className="px-3 py-1.5 rounded-full bg-stone-100 hover:bg-red-50 hover:text-red-700 text-stone-600 border border-stone-200 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
            title="Reset all form inputs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <div className="p-4 bg-amber-50 border-b border-amber-200 flex items-center justify-between text-xs text-amber-900 animate-in fade-in">
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Clear all fields and reset this banking slip? Unsaved changes will be lost.</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                onClear();
                setShowClearConfirm(false);
              }}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg cursor-pointer"
            >
              Yes, Clear All
            </button>
            <button
              type="button"
              onClick={() => setShowClearConfirm(false)}
              className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold rounded-lg cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Main Standardized Form Body */}
      <div className="p-5 sm:p-7 space-y-6">
        {/* ========================================================= */}
        {/* SECTION A: BASIC DETAILS                                  */}
        {/* ========================================================= */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500">
            <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-800 flex items-center justify-center text-[10px] font-black">
              A
            </span>
            <span>Basic Slip &amp; Branch Details</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* Date */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Date (DD/MM/YYYY)*</span>
                </label>
                <button
                  type="button"
                  onClick={() => onChange({ ...data, date: new Date().toLocaleDateString('en-GB') })}
                  className="text-[10px] text-blue-600 hover:underline font-bold cursor-pointer"
                >
                  Today
                </button>
              </div>
              <input
                type="text"
                value={data.date}
                onChange={(e) => onChange({ ...data, date: e.target.value })}
                placeholder="DD/MM/YYYY"
                className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            {/* Branch Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Branch Name*
              </label>
              <input
                type="text"
                value={data.branch}
                onChange={(e) => onChange({ ...data, branch: e.target.value })}
                placeholder="e.g. Nariman Point, Mumbai"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            {/* Account Type / Deposit Mode */}
            {isDeposit ? (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Deposit Mode*
                </label>
                <select
                  value={data.depositMode}
                  onChange={(e) =>
                    onChange({ ...data, depositMode: e.target.value as 'cash' | 'cheque' | 'both' })
                  }
                  className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="cash">Cash Deposit</option>
                  <option value="cheque">Cheque Deposit</option>
                  <option value="both">Both Cash + Cheque</option>
                </select>
              </div>
            ) : isNeft ? (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Transfer System*
                </label>
                <select
                  value={data.transferType || 'neft'}
                  onChange={(e) =>
                    onChange({ ...data, transferType: e.target.value as 'neft' | 'rtgs' })
                  }
                  className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="neft">NEFT (National Electronic Funds Transfer)</option>
                  <option value="rtgs">RTGS (Real Time Gross Settlement ≥ ₹2 Lakh)</option>
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Draft Type*
                </label>
                <select
                  defaultValue="dd"
                  className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="dd">Demand Draft (DD)</option>
                  <option value="bc">Banker’s Cheque / Pay Order</option>
                </select>
              </div>
            )}

            {/* Account Type */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Account Category
              </label>
              <select
                value={data.accountType}
                onChange={(e) =>
                  onChange({ ...data, accountType: e.target.value as 'savings' | 'current' | 'loan' | 'cc' })
                }
                className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="savings">Savings Account (SB)</option>
                <option value="current">Current Account (CA)</option>
                <option value="loan">Loan Account (TL/DL)</option>
                <option value="cc">Credit Card / Overdraft</option>
              </select>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* SECTION B: ACCOUNT & CUSTOMER DETAILS                     */}
        {/* ========================================================= */}
        <div className="space-y-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500">
            <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-800 flex items-center justify-center text-[10px] font-black">
              B
            </span>
            <span>Account &amp; Customer Information</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {/* Account Number */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isNeft ? 'Debit Account Number*' : 'Account Number*'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={data.accountNo}
                  onChange={(e) =>
                    onChange({ ...data, accountNo: e.target.value.replace(/[^0-9]/g, '') })
                  }
                  placeholder={bank.id === 'hdfc' ? '14-digit Account No.' : '11-digit Account No.'}
                  maxLength={16}
                  className="w-full px-3 py-2 text-xs font-mono font-bold tracking-wider rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
                <span className="absolute right-3 top-2.5 text-[10px] text-slate-400 font-mono">
                  {data.accountNo.length} digits
                </span>
              </div>
            </div>

            {/* Account Holder Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isNeft ? 'Remitter / Applicant Name*' : isDd ? 'Applicant Name*' : 'Account Holder Name*'}
              </label>
              <input
                type="text"
                value={data.name}
                onChange={(e) => onChange({ ...data, name: e.target.value })}
                placeholder="Full Name as per bank records"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            {/* Mobile Number */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Registered Mobile Number*
              </label>
              <div className="relative">
                <input
                  type="tel"
                  value={data.mobile}
                  onChange={(e) =>
                    onChange({ ...data, mobile: e.target.value.replace(/[^0-9]/g, '').slice(0, 10) })
                  }
                  placeholder="10-digit mobile number"
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
                {data.mobile.length === 10 && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 absolute right-3 top-2.5" />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* SECTION C: TRANSACTION DETAILS & AMOUNT                   */}
        {/* ========================================================= */}
        <div className="space-y-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500">
            <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-800 flex items-center justify-center text-[10px] font-black">
              C
            </span>
            <span>Transaction Details &amp; Amount</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {/* Amount in Figures */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isDd ? 'Demand Draft Amount (₹)*' : isNeft ? 'Transfer Amount (₹)*' : 'Total Deposit Amount (₹)*'}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">
                  ₹
                </span>
                <input
                  type="number"
                  value={data.totalAmount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="1"
                  className="w-full pl-7 pr-3 py-2 text-xs font-mono font-black text-slate-900 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
            </div>

            {/* Amount in Words (Auto Generated) */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Amount in Words (Automatic Indian Rupees)*
              </label>
              <input
                type="text"
                value={data.amountWordsEn || ''}
                onChange={(e) => onChange({ ...data, amountWordsEn: e.target.value })}
                placeholder="Rupees in words will appear automatically..."
                className="w-full px-3 py-2 text-xs font-medium text-blue-900 rounded-xl border border-blue-200 bg-blue-50/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Cash Denomination Mismatch Alert */}
          {hasMismatch && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Denomination Mismatch:</strong> Declared total is ₹{declaredAmount.toLocaleString('en-IN')}, but your cash denomination count equals ₹{denomSum.toLocaleString('en-IN')} (Difference: ₹{Math.abs(declaredAmount - denomSum).toLocaleString('en-IN')}). Please reconcile.
              </div>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* SECTION D: CASH DENOMINATIONS (Deposit Slips)              */}
        {/* ========================================================= */}
        {isDeposit && (data.depositMode === 'cash' || data.depositMode === 'both') && (
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500">
                <span className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-800 flex items-center justify-center text-[10px] font-black">
                  D
                </span>
                <span>Cash Denomination Breakdown</span>
              </div>
              <span className="text-xs font-mono font-bold text-slate-700">
                Tally: ₹{denomSum.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2">
              {[
                { denom: 500, key: 500 },
                { denom: 200, key: 200 },
                { denom: 100, key: 100 },
                { denom: 50, key: 50 },
                { denom: 20, key: 20 },
                { denom: 10, key: 10 },
                { denom: 5, key: 5 },
              ].map(({ denom, key }) => (
                <div key={denom} className="p-2 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                    <span>₹{denom}</span>
                    <span className="text-[10px] text-slate-400">×</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={data.denominations[key as keyof UniversalFormData['denominations']] || ''}
                    onChange={(e) => setDenom(key as keyof UniversalFormData['denominations'], e.target.value)}
                    className="w-full px-2 py-1 text-xs text-center font-mono font-bold rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  />
                  <div className="text-[10px] text-right font-mono text-slate-500">
                    = ₹{(Number(data.denominations[key as keyof UniversalFormData['denominations']] || 0) * denom).toLocaleString('en-IN')}
                  </div>
                </div>
              ))}

              {/* Coins */}
              <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <div className="text-[11px] font-bold text-slate-600">
                  Coins ₹
                </div>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={data.denominations.coins || ''}
                  onChange={(e) => setDenom('coins', e.target.value)}
                  className="w-full px-2 py-1 text-xs text-center font-mono font-bold rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                />
                <div className="text-[10px] text-right font-mono text-slate-500">
                  = ₹{Number(data.denominations.coins || 0).toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Cheque Specific Rows (if cheque is chosen) */}
        {isDeposit && (data.depositMode === 'cheque' || data.depositMode === 'both') && (
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500">
              <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-800 flex items-center justify-center text-[10px] font-black">
                C2
              </span>
              <span>Cheque Clearing Particulars</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Cheque Number*
                </label>
                <input
                  type="text"
                  value={data.chequeNo || ''}
                  onChange={(e) => onChange({ ...data, chequeNo: e.target.value })}
                  placeholder="e.g. 048291"
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Drawee Bank &amp; Branch*
                </label>
                <input
                  type="text"
                  value={data.draweeBank || ''}
                  onChange={(e) => onChange({ ...data, draweeBank: e.target.value })}
                  placeholder="e.g. ICICI Bank, Bandra West"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Cheque Date
                </label>
                <input
                  type="text"
                  value={data.chequeDate || data.date}
                  onChange={(e) => onChange({ ...data, chequeDate: e.target.value })}
                  placeholder="DD/MM/YYYY"
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SECTION E: NEFT/RTGS BENEFICIARY DETAILS                  */}
        {/* ========================================================= */}
        {isNeft && (
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500">
              <span className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-800 flex items-center justify-center text-[10px] font-black">
                E
              </span>
              <span>Beneficiary (Receiver) Electronic Details</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Beneficiary Name*
                </label>
                <input
                  type="text"
                  value={data.benName || ''}
                  onChange={(e) => onChange({ ...data, benName: e.target.value })}
                  placeholder="Receiver's Name as per their bank"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Beneficiary Account Number*
                </label>
                <input
                  type="text"
                  value={data.benAccountNo || ''}
                  onChange={(e) =>
                    onChange({ ...data, benAccountNo: e.target.value.replace(/[^0-9]/g, '') })
                  }
                  placeholder="Destination Account No"
                  className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Re-Confirm Account Number*
                </label>
                <input
                  type="text"
                  value={data.benAccountNoConfirm || ''}
                  onChange={(e) =>
                    onChange({ ...data, benAccountNoConfirm: e.target.value.replace(/[^0-9]/g, '') })
                  }
                  placeholder="Re-enter to confirm match"
                  className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  11-Digit IFSC Code*
                </label>
                <input
                  type="text"
                  value={data.benIfsc || ''}
                  onChange={(e) =>
                    onChange({ ...data, benIfsc: e.target.value.toUpperCase().slice(0, 11) })
                  }
                  placeholder="e.g. SBIN0000691"
                  maxLength={11}
                  className="w-full px-3 py-2 text-xs font-mono font-bold uppercase rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Beneficiary Bank &amp; Branch*
                </label>
                <input
                  type="text"
                  value={data.benBank || ''}
                  onChange={(e) => onChange({ ...data, benBank: e.target.value })}
                  placeholder="e.g. State Bank of India, Main Branch"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Purpose / Remittance Remarks
                </label>
                <input
                  type="text"
                  value={data.purpose || ''}
                  onChange={(e) => onChange({ ...data, purpose: e.target.value })}
                  placeholder="e.g. Tuition fee, invoice payment"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SECTION E: DEMAND DRAFT DETAILS                           */}
        {/* ========================================================= */}
        {isDd && (
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500">
              <span className="w-5 h-5 rounded-md bg-amber-100 text-amber-800 flex items-center justify-center text-[10px] font-black">
                E
              </span>
              <span>Demand Draft / Payee Specifications</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  In Favour Of (Beneficiary Name)*
                </label>
                <input
                  type="text"
                  value={data.inFavourOf || ''}
                  onChange={(e) => onChange({ ...data, inFavourOf: e.target.value })}
                  placeholder="Name of person / institution receiving DD"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  DD Payable At (City / Branch)*
                </label>
                <input
                  type="text"
                  value={data.payableAt || ''}
                  onChange={(e) => onChange({ ...data, payableAt: e.target.value })}
                  placeholder="e.g. New Delhi / Service Branch"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Exchange / Commission Fee (₹)
                </label>
                <input
                  type="number"
                  value={data.exchangeFee || ''}
                  onChange={(e) =>
                    onChange({ ...data, exchangeFee: parseFloat(e.target.value) || '' })
                  }
                  placeholder="e.g. 50"
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Debit Cheque Number
                </label>
                <input
                  type="text"
                  value={data.chequeNo || ''}
                  onChange={(e) => onChange({ ...data, chequeNo: e.target.value })}
                  placeholder="Cheque used to fund DD"
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Deliver Draft To (Bearer)
                </label>
                <input
                  type="text"
                  value={data.deliverTo || ''}
                  onChange={(e) => onChange({ ...data, deliverTo: e.target.value })}
                  placeholder="e.g. Self / Mr. Rajesh Sharma"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
