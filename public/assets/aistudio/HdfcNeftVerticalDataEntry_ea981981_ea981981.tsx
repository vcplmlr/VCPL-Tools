/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Send,
  User,
  Building,
  CreditCard,
  Phone,
  Mail,
  ShieldCheck,
  AlertTriangle,
  Info,
  CheckCircle2,
  Calendar,
  Clock,
  FileText,
} from 'lucide-react';
import { HdfcNeftFormData, HdfcNeftType, HdfcAccountType, HdfcBanvOption } from '../types';
import { numberToWordsIndian } from '../utils/numberToWords';

interface HdfcNeftVerticalDataEntryProps {
  data: HdfcNeftFormData;
  onChange: (data: HdfcNeftFormData) => void;
  onClear: () => void;
}

export const HdfcNeftVerticalDataEntry: React.FC<HdfcNeftVerticalDataEntryProps> = ({
  data,
  onChange,
  onClear,
}) => {
  const update = <K extends keyof HdfcNeftFormData>(key: K, value: HdfcNeftFormData[K]) => {
    onChange({ ...data, [key]: value });
  };

  const amtNum = typeof data.amount === 'number' ? data.amount : 0;
  const wordsEng = amtNum > 0 ? `Rupees ${numberToWordsIndian(amtNum)} Only` : '';

  const isRtgs = data.type === 'rtgs';
  const isNeft = data.type === 'neft';
  const isAmtBelowRtgsMin = isRtgs && amtNum > 0 && amtNum < 200000;

  const isAccMismatch =
    data.beneficiaryAccountNo &&
    data.beneficiaryAccountNoConfirm &&
    data.beneficiaryAccountNo !== data.beneficiaryAccountNoConfirm;
  const isAccMatched =
    data.beneficiaryAccountNo &&
    data.beneficiaryAccountNoConfirm &&
    data.beneficiaryAccountNo === data.beneficiaryAccountNoConfirm;

  return (
    <div className="space-y-4">
      {/* 1. Request Details Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 leading-tight">
                Transfer Details / अंतरण विवरण
              </h3>
              <p className="text-[11px] text-slate-500">
                Form Code 92929/13.03.2026_M019 &bull; HDFC Bank RTGS / NEFT
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

        {/* Transfer Type Selectors */}
        <div className="space-y-2 mb-3">
          <label className="text-xs font-semibold text-slate-700 block">
            Transfer Mode / अंतरण प्रकार <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => update('type', 'rtgs')}
              className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                isRtgs
                  ? 'border-blue-600 bg-blue-50 text-blue-900 ring-2 ring-blue-500/20'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${isRtgs ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-400'}`}>
                  {isRtgs && <span className="text-[10px]">✓</span>}
                </span>
                <span>RTGS (Real Time)</span>
              </div>
              <span className="text-[10px] text-slate-500 font-normal">Min ₹2,00,000</span>
            </button>

            <button
              type="button"
              onClick={() => update('type', 'neft')}
              className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                isNeft
                  ? 'border-blue-600 bg-blue-50 text-blue-900 ring-2 ring-blue-500/20'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${isNeft ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-400'}`}>
                  {isNeft && <span className="text-[10px]">✓</span>}
                </span>
                <span>NEFT (Batch)</span>
              </div>
              <span className="text-[10px] text-slate-500 font-normal">No Limit</span>
            </button>
          </div>
          {isAmtBelowRtgsMin && (
            <div className="flex items-center gap-1.5 p-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px]">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
              <span>
                <strong>Note:</strong> RTGS is typically for amounts of ₹2,00,000 and above. For lower amounts, NEFT is recommended.
              </span>
            </div>
          )}
        </div>

        {/* Date, Time, Cheque No */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div>
            <label className="text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" /> Date / दिनांक
            </label>
            <input
              type="date"
              value={data.date}
              onChange={(e) => update('date', e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-400" /> Time / समय
            </label>
            <input
              type="text"
              placeholder="e.g. 11:30 AM"
              value={data.time}
              onChange={(e) => update('time', e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
              <FileText className="w-3 h-3 text-slate-400" /> Cheque No. / चेक सं.
            </label>
            <input
              type="text"
              placeholder="6-digit Cheque No."
              value={data.chequeNo}
              onChange={(e) => update('chequeNo', e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
            />
          </div>
        </div>
      </div>

      {/* 2. Remitter Details Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
        <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-100">
          <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
            <User className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 leading-tight">
              Remitter Details / प्रेषक का विवरण
            </h3>
            <p className="text-[11px] text-slate-500">
              Account holder sending the funds from HDFC Bank
            </p>
          </div>
        </div>

        <div className="space-y-2.5">
          <div>
            <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
              Customer's Full Name / ग्राहक का पूरा नाम <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. VIKRAMADITYA PRASAD"
              value={data.name}
              onChange={(e) => update('name', e.target.value.toUpperCase())}
              className="w-full px-2.5 py-1.5 text-xs uppercase font-medium rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                Account No. / खाता संख्या <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                maxLength={16}
                placeholder="14-digit HDFC A/c"
                value={data.accountNo}
                onChange={(e) => update('accountNo', e.target.value.replace(/\D/g, ''))}
                className="w-full px-2.5 py-1.5 text-xs font-mono tracking-wider rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
                <Phone className="w-3 h-3 text-slate-400" /> Mobile No. / मोबाइल
              </label>
              <input
                type="tel"
                maxLength={10}
                placeholder="10-digit Mobile"
                value={data.mobile}
                onChange={(e) => update('mobile', e.target.value.replace(/\D/g, ''))}
                className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                Tel No. / टेलीफ़ोन नं.
              </label>
              <input
                type="text"
                placeholder="Landline / Alt Phone"
                value={data.tel}
                onChange={(e) => update('tel', e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                Address of Remitter (Mandatory for Non-HDFC Customer)
              </label>
              <input
                type="text"
                placeholder="Flat / Street / Area / City / PIN"
                value={data.remitterAddress}
                onChange={(e) => update('remitterAddress', e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
                <Mail className="w-3 h-3 text-slate-400" /> Email ID / ईमेल
              </label>
              <input
                type="email"
                placeholder="name@example.com"
                value={data.remitterEmail}
                onChange={(e) => update('remitterEmail', e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
              />
            </div>
          </div>

          {/* LEI & Cash Deposited Collapsible/Sub-grid */}
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700">
                Special Regulatory Fields (LEI &amp; Non-Customer Cash)
              </span>
              <span className="text-[10px] text-slate-500">Optional / If Applicable</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2">
                <label className="text-[10px] font-semibold text-slate-600 mb-0.5 block">
                  Remitter LEI Code (20 Digits) &bull; Only for Non-Individuals ≥ ₹50 Cr
                </label>
                <input
                  type="text"
                  maxLength={20}
                  placeholder="20-character LEI Code"
                  value={data.remitterLei}
                  onChange={(e) => update('remitterLei', e.target.value.toUpperCase())}
                  className="w-full px-2 py-1 text-xs font-mono uppercase rounded-lg border border-slate-300 bg-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-600 mb-0.5 block">
                  LEI Expiry Date
                </label>
                <input
                  type="date"
                  value={data.remitterLeiExpiry}
                  onChange={(e) => update('remitterLeiExpiry', e.target.value)}
                  className="w-full px-2 py-1 text-xs rounded-lg border border-slate-300 bg-white"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-semibold text-slate-600 mb-0.5 block">
                Cash Deposited ₹ (Non-HDFC Bank Customers, max ₹50,000)
              </label>
              <input
                type="number"
                min="0"
                max="50000"
                placeholder="e.g. 25000"
                value={data.cashDeposited === '' ? '' : data.cashDeposited}
                onChange={(e) => {
                  const val = e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value) || 0);
                  update('cashDeposited', val);
                }}
                className="w-full px-2 py-1 text-xs font-mono rounded-lg border border-slate-300 bg-white"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Beneficiary Details Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
        <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-100">
          <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold text-xs">
            <Building className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 leading-tight">
              Beneficiary Details / लाभार्थी का विवरण
            </h3>
            <p className="text-[11px] text-slate-500">
              Receiving bank account information
            </p>
          </div>
        </div>

        <div className="space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                Beneficiary Name / लाभार्थी का नाम <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. SHARMA TRADERS PVT LTD"
                value={data.beneficiaryName}
                onChange={(e) => update('beneficiaryName', e.target.value.toUpperCase())}
                className="w-full px-2.5 py-1.5 text-xs font-semibold uppercase rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
                <Phone className="w-3 h-3 text-slate-400" /> Contact No. / संपर्क नंबर
              </label>
              <input
                type="tel"
                placeholder="Mobile / Landline of beneficiary"
                value={data.beneficiaryContact}
                onChange={(e) => update('beneficiaryContact', e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
              />
            </div>
          </div>

          {/* Account Number & Re-Confirmation with Match Alert */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                Account No. (Max 16 Digits) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                maxLength={16}
                placeholder="Enter 16-digit Account No."
                value={data.beneficiaryAccountNo}
                onChange={(e) => update('beneficiaryAccountNo', e.target.value.replace(/\D/g, ''))}
                className="w-full px-2.5 py-1.5 text-xs font-mono tracking-widest rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-slate-600 block">
                  Re-Confirm Account No. <span className="text-rose-500">*</span>
                </label>
                {isAccMatched && (
                  <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
                    <CheckCircle2 className="w-3 h-3" /> Matched
                  </span>
                )}
                {isAccMismatch && (
                  <span className="text-[10px] font-bold text-rose-600 flex items-center gap-0.5">
                    <AlertTriangle className="w-3 h-3" /> Mismatch
                  </span>
                )}
              </div>
              <input
                type="text"
                maxLength={16}
                placeholder="Re-enter to confirm"
                value={data.beneficiaryAccountNoConfirm}
                onChange={(e) => update('beneficiaryAccountNoConfirm', e.target.value.replace(/\D/g, ''))}
                className={`w-full px-2.5 py-1.5 text-xs font-mono tracking-widest rounded-lg border focus:outline-none focus:ring-2 ${
                  isAccMismatch
                    ? 'border-rose-400 bg-rose-50/50 focus:ring-rose-500'
                    : isAccMatched
                    ? 'border-emerald-400 bg-emerald-50/40 focus:ring-emerald-500'
                    : 'border-slate-300 bg-slate-50 focus:bg-white focus:ring-blue-500'
                }`}
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
              Beneficiary Address / लाभार्थी का पता
            </label>
            <input
              type="text"
              placeholder="e.g. B-12, Cyber Park, Sector 62, Noida"
              value={data.beneficiaryAddress}
              onChange={(e) => update('beneficiaryAddress', e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                Bank Name &amp; Branch / बैंक का नाम व शाखा <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. ICICI Bank, MG Road Branch"
                value={data.beneficiaryBankBranch}
                onChange={(e) => update('beneficiaryBankBranch', e.target.value.toUpperCase())}
                className="w-full px-2.5 py-1.5 text-xs uppercase font-medium rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                IFSC Code (11 Chars) / आईएफएससी <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                maxLength={11}
                placeholder="e.g. ICIC0001024"
                value={data.beneficiaryIfsc}
                onChange={(e) => update('beneficiaryIfsc', e.target.value.toUpperCase())}
                className="w-full px-2.5 py-1.5 text-xs font-mono uppercase tracking-widest rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                Account Type / खाता प्रकार
              </label>
              <div className="flex items-center gap-1.5">
                {(
                  [
                    ['res', 'Resident'],
                    ['nr', 'Non Resident'],
                    ['fcra', 'FCRA'],
                  ] as [HdfcAccountType, string][]
                ).map(([code, label]) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => update('beneficiaryAccountType', code)}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition cursor-pointer text-center ${
                      data.beneficiaryAccountType === code
                        ? 'border-blue-600 bg-blue-600 text-white shadow-xs'
                        : 'border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                Purpose / अंतरण का उद्देश्य
              </label>
              <input
                type="text"
                placeholder="e.g. Vendor Payment / Education / Loan"
                value={data.purpose}
                onChange={(e) => update('purpose', e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
              />
            </div>
          </div>

          {/* Beneficiary LEI Code & Expiry */}
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2">
                <label className="text-[10px] font-semibold text-slate-600 mb-0.5 block">
                  Beneficiary LEI Code (20 Digits) &bull; Only for Non-Individuals ≥ ₹50 Cr
                </label>
                <input
                  type="text"
                  maxLength={20}
                  placeholder="20-character LEI Code"
                  value={data.beneficiaryLei}
                  onChange={(e) => update('beneficiaryLei', e.target.value.toUpperCase())}
                  className="w-full px-2 py-1 text-xs font-mono uppercase rounded-lg border border-slate-300 bg-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-600 mb-0.5 block">
                  Beneficiary LEI Expiry
                </label>
                <input
                  type="date"
                  value={data.beneficiaryLeiExpiry}
                  onChange={(e) => update('beneficiaryLeiExpiry', e.target.value)}
                  className="w-full px-2 py-1 text-xs rounded-lg border border-slate-300 bg-white"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Transfer Amount & Words Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
        <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-100">
          <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">
            <CreditCard className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 leading-tight">
              Transfer Amount &amp; Verification / राशि व सत्यापन
            </h3>
            <p className="text-[11px] text-slate-500">
              Amount in figures and words are calculated automatically
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1 block">
              Amount to be Credited (in ₹ figures) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-sm">₹</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 250000"
                value={data.amount === '' ? '' : data.amount}
                onChange={(e) => {
                  const val = e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value) || 0);
                  update('amount', val);
                }}
                className="w-full pl-8 pr-3 py-2 text-sm font-bold font-mono text-slate-900 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
              />
            </div>
          </div>

          {/* Amount in words live box */}
          {wordsEng && (
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
                Amount in Words (Auto-Generated)
              </span>
              <p className="font-semibold text-blue-950 leading-relaxed">{wordsEng}</p>
            </div>
          )}

          <div>
            <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
              Remarks / टिप्पणी
            </label>
            <input
              type="text"
              placeholder="e.g. Advance payment against Invoice #402"
              value={data.remarks}
              onChange={(e) => update('remarks', e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
            />
          </div>

          {/* BANV (Beneficiary Bank Account Name Verification) Options */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-1 text-xs font-bold text-slate-900">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>Beneficiary Name Verification (BANV) Options</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-tight">
              Select one option for verifying the beneficiary's name with destination bank:
            </p>

            <div className="space-y-2">
              <label
                onClick={() => update('banvOption', '1')}
                className={`p-3 rounded-xl border block cursor-pointer transition text-xs ${
                  data.banvOption === '1'
                    ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20'
                    : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-start gap-2">
                  <input
                    type="radio"
                    name="banv"
                    checked={data.banvOption === '1'}
                    onChange={() => update('banvOption', '1')}
                    className="mt-0.5"
                  />
                  <div>
                    <span className="font-bold text-slate-900 block">
                      Option 1 – HDFC Bank to verify beneficiary bank account name
                    </span>
                    <span className="text-[10px] text-slate-600 leading-normal block mt-0.5">
                      I/We request HDFC Bank to verify. If verification fails due to mismatch, authorise HDFC Bank to cancel the transaction.
                    </span>
                  </div>
                </div>
              </label>

              <label
                onClick={() => update('banvOption', '2')}
                className={`p-3 rounded-xl border block cursor-pointer transition text-xs ${
                  data.banvOption === '2'
                    ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20'
                    : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-start gap-2">
                  <input
                    type="radio"
                    name="banv"
                    checked={data.banvOption === '2'}
                    onChange={() => update('banvOption', '2')}
                    className="mt-0.5"
                  />
                  <div>
                    <span className="font-bold text-slate-900 block">
                      Option 2 – Beneficiary bank account name verified by customer
                    </span>
                    <span className="text-[10px] text-slate-600 leading-normal block mt-0.5">
                      I/We have verified account number and IFSC belongs to beneficiary. Authorise HDFC Bank to transfer at customer's risk even if name verification is unsuccessful.
                    </span>
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Cyber Safety Reminder */}
      <div className="p-3 bg-slate-900 text-white rounded-2xl text-xs space-y-1">
        <div className="flex items-center gap-1.5 font-bold text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>CYBER FRAUD WARNING &bull; DIGITAL ARREST IS FAKE</span>
        </div>
        <p className="text-[11px] text-slate-300 leading-relaxed">
          There is no such thing as Digital Arrest. Real authorities never demand money on video calls or over telephone calls. Stay calm and speak to branch staff.
        </p>
      </div>
    </div>
  );
};
