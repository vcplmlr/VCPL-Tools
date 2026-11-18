/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { HdfcDepositFormData, HdfcDenom, HdfcChequeRow } from '../types';
import { wordsCurrency, formatINR } from '../utils/numberToWords';
import {
  Banknote,
  Coins,
  Calculator,
  RotateCcw,
  Plus,
  Trash2,
  Calendar,
  AlertTriangle,
  CreditCard,
  Building,
  User,
  Phone,
  CheckCircle,
} from 'lucide-react';

interface HdfcVerticalDataEntryProps {
  data: HdfcDepositFormData;
  onChange: (d: HdfcDepositFormData) => void;
  onClear: () => void;
}

const DEN_LIST: HdfcDenom[] = [2000, 500, 200, 100, 50, 20, 10];

export const HdfcVerticalDataEntry: React.FC<HdfcVerticalDataEntryProps> = ({
  data,
  onChange,
  onClear,
}) => {
  // Calculations
  let cashTotal = 0;
  DEN_LIST.forEach((d) => {
    const count = typeof data.denominations[d] === 'number' ? Number(data.denominations[d]) : 0;
    cashTotal += count * d;
  });
  const coinsNum = typeof data.coins === 'number' ? data.coins : parseFloat(String(data.coins)) || 0;
  cashTotal += coinsNum;

  const activeCheques = data.cheques.filter(
    (c) =>
      (c.bankBranch && c.bankBranch.trim() !== '') ||
      (c.city && c.city.trim() !== '') ||
      (c.chequeNo && c.chequeNo.trim() !== '') ||
      (typeof c.amount === 'number' && c.amount > 0)
  );

  const chequeTotal = activeCheques.reduce(
    (sum, c) => sum + (typeof c.amount === 'number' ? c.amount : 0),
    0
  );

  const grandTotal = cashTotal + chequeTotal;
  const grandWords = grandTotal > 0 ? wordsCurrency(grandTotal) : '';

  const panRequired = cashTotal > 49999;
  const isPanMissing = panRequired && (!data.pan || data.pan.trim().length < 10);

  // Field update helpers
  const updateField = <K extends keyof HdfcDepositFormData>(key: K, val: HdfcDepositFormData[K]) => {
    onChange({ ...data, [key]: val });
  };

  const updateDenom = (d: HdfcDenom, val: string) => {
    const parsed = val === '' ? '' : Math.max(0, parseInt(val, 10) || 0);
    onChange({
      ...data,
      denominations: {
        ...data.denominations,
        [d]: parsed,
      },
    });
  };

  const updateCheque = (idx: number, field: keyof HdfcChequeRow, val: any) => {
    const nextCheques = [...data.cheques];
    if (!nextCheques[idx]) {
      nextCheques[idx] = { bankBranch: '', city: '', chequeNo: '', amount: '' };
    }
    nextCheques[idx] = {
      ...nextCheques[idx],
      [field]: field === 'amount' ? (val === '' ? '' : Math.max(0, parseFloat(val) || 0)) : val,
    };
    onChange({ ...data, cheques: nextCheques });
  };

  const addChequeRow = () => {
    if (data.cheques.length < 5) {
      onChange({
        ...data,
        cheques: [...data.cheques, { bankBranch: '', city: '', chequeNo: '', amount: '' }],
      });
    }
  };

  const removeChequeRow = (idx: number) => {
    if (data.cheques.length > 1) {
      const nextCheques = data.cheques.filter((_, i) => i !== idx);
      onChange({ ...data, cheques: nextCheques });
    } else {
      onChange({
        ...data,
        cheques: [{ bankBranch: '', city: '', chequeNo: '', amount: '' }],
      });
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-xs space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span>HDFC Bank &bull; Cash &amp; Cheque Pay-in Slip Entry</span>
            <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-blue-100 text-[#004c8f] font-bold">
              Official Bilingual (English / Khasi)
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Synchronized live coordinate replica with automatic denomination sums &amp; words.
          </p>
        </div>

        <button
          type="button"
          onClick={onClear}
          className="self-start sm:self-center px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
          <span>Clear Form</span>
        </button>
      </div>

      {/* 1. Depositor & Account Information */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#004c8f]">
          <Building className="w-4 h-4 text-[#004c8f]" />
          <span>1. Account &amp; Depositor Details</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {/* Date */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Date <span className="text-slate-400 font-normal">/ Tarik</span>
            </label>
            <div className="relative">
              <input
                type="date"
                value={data.date}
                onChange={(e) => updateField('date', e.target.value)}
                className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
              <Calendar className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Deposit Type */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Deposit Type <span className="text-slate-400 font-normal">/ Ka rukom thep</span>
            </label>
            <select
              value={data.depositType}
              onChange={(e) => updateField('depositType', e.target.value as any)}
              className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="cash">Cash / Ka pisa nokot</option>
              <option value="local">Local Cheque / Ka shek na shnong</option>
              <option value="out">Outstation Cheque / Shek shabar shnong</option>
              <option value="loan">Loan Account / Ka loan account</option>
              <option value="cc">Credit Card Payment</option>
              <option value="">(None selected)</option>
            </select>
          </div>

          {/* Account Number (14 digits) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              HDFC Account No. (14 digits)
            </label>
            <input
              type="text"
              maxLength={14}
              value={data.accountNo}
              placeholder="e.g. 50100234567890"
              onChange={(e) => updateField('accountNo', e.target.value.replace(/\D/g, ''))}
              className="w-full text-xs font-mono font-bold px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white tracking-wider"
            />
          </div>

          {/* Credit Card Number (16 digits) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Credit Card No. (16 digits)
            </label>
            <input
              type="text"
              maxLength={16}
              value={data.creditCardNo}
              placeholder="Optional 16 digits"
              onChange={(e) => updateField('creditCardNo', e.target.value.replace(/\D/g, ''))}
              className="w-full text-xs font-mono font-semibold px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white tracking-wider"
            />
          </div>

          {/* Loan Account Number */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Loan Account No. (10 digits)
            </label>
            <input
              type="text"
              maxLength={10}
              value={data.loanAccountNo}
              placeholder="Optional 10 digits"
              onChange={(e) => updateField('loanAccountNo', e.target.value.replace(/\D/g, ''))}
              className="w-full text-xs font-mono font-semibold px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white tracking-wider"
            />
            <label className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-600 font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={data.loanAccountTicked}
                onChange={(e) => updateField('loanAccountTicked', e.target.checked)}
                className="w-3.5 h-3.5 rounded text-blue-600"
              />
              <span>Check Loan Box (✔)</span>
            </label>
          </div>

          {/* Depositor Name */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Name / <span className="text-slate-400 font-normal">Kyrteng (Account Holder / Depositor)</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={data.name}
                placeholder="Full Name as per bank account"
                onChange={(e) => updateField('name', e.target.value.toUpperCase())}
                className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
              <User className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Contact No (10 digits) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Contact Phone (10 digits)
            </label>
            <div className="relative">
              <input
                type="text"
                maxLength={10}
                value={data.phone}
                placeholder="e.g. 9876543210"
                onChange={(e) => updateField('phone', e.target.value.replace(/\D/g, ''))}
                className="w-full text-xs font-mono font-semibold px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
              <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* PAN No */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
              <span>PAN Number (10 chars)</span>
              {panRequired && (
                <span className="text-[10px] text-amber-700 font-bold bg-amber-100 px-1 rounded">
                  Required &gt;₹49,999
                </span>
              )}
            </label>
            <input
              type="text"
              maxLength={10}
              value={data.pan}
              placeholder="e.g. ABCDE1234F"
              onChange={(e) => updateField('pan', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              className={`w-full text-xs font-mono font-bold px-3 py-2 rounded-xl border uppercase tracking-wider ${
                isPanMissing
                  ? 'border-amber-400 bg-amber-50/50 focus:ring-2 focus:ring-amber-500'
                  : 'border-slate-300 focus:ring-2 focus:ring-blue-500 bg-white'
              }`}
            />
          </div>

          {/* Special Option */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Special Option
            </label>
            <select
              value={data.special}
              onChange={(e) => updateField('special', e.target.value as any)}
              className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">None / Standard</option>
              <option value="nro">For NRO Account</option>
              <option value="div">Dividend / Interest Warrant</option>
              <option value="rent">Rent / Pension / Sale Proceeds</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. Cash Denominations Section */}
      <div className="space-y-4 pt-2 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-800">
            <Banknote className="w-4 h-4 text-emerald-600" />
            <span>2. Cash Denominations (Notes &amp; Coins)</span>
          </div>

          <div className="text-xs font-bold text-slate-700">
            Cash Total:{' '}
            <span className="text-emerald-700 font-mono text-sm ml-1 font-black">
              ₹{formatINR(cashTotal) || '0'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2.5">
          {DEN_LIST.map((denom) => {
            const count = data.denominations[denom];
            const numCount = typeof count === 'number' ? count : 0;
            const subtotal = numCount * denom;

            return (
              <div
                key={denom}
                className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1">
                  <span>₹{denom}</span>
                  <span className="text-[10px] text-slate-400 font-normal">notes</span>
                </div>
                <input
                  type="number"
                  min="0"
                  value={count}
                  placeholder="0"
                  onChange={(e) => updateDenom(denom, e.target.value)}
                  className="w-full text-xs font-bold px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <div className="text-[10px] text-right text-emerald-700 font-mono font-semibold mt-1">
                  {subtotal > 0 ? `₹${formatINR(subtotal)}` : '₹0'}
                </div>
              </div>
            );
          })}

          {/* Coins (Kiwei) */}
          <div className="p-2.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-bold text-amber-900 mb-1">
              <span>Coins ₹</span>
              <span className="text-[10px] text-amber-600 font-normal">Kiwei</span>
            </div>
            <input
              type="number"
              min="0"
              step="any"
              value={data.coins}
              placeholder="0"
              onChange={(e) =>
                updateField('coins', e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value) || 0))
              }
              className="w-full text-xs font-bold px-2 py-1.5 rounded-lg border border-amber-300 bg-white text-center focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <div className="text-[10px] text-right text-amber-800 font-mono font-semibold mt-1">
              {coinsNum > 0 ? `₹${formatINR(coinsNum)}` : '₹0'}
            </div>
          </div>
        </div>

        {/* PAN Notification */}
        {isPanMissing && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Statutory Requirement:</strong> Cash deposit exceeds ₹49,999. Please provide the 10-character PAN number as mandated by banking regulations.
            </span>
          </div>
        )}
      </div>

      {/* 3. Cheques Details Section */}
      <div className="space-y-4 pt-2 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-800">
            <CreditCard className="w-4 h-4 text-blue-600" />
            <span>3. Cheque Details (Up to 5 Cheques)</span>
          </div>

          <div className="text-xs font-bold text-slate-700">
            Cheques Total:{' '}
            <span className="text-blue-700 font-mono text-sm ml-1 font-black">
              ₹{formatINR(chequeTotal) || '0'}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          {data.cheques.map((row, idx) => (
            <div
              key={idx}
              className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center"
            >
              <div className="sm:col-span-1 text-xs font-bold text-slate-400">
                #{idx + 1}
              </div>
              <div className="sm:col-span-4">
                <input
                  type="text"
                  placeholder="Drawee Bank &amp; Branch"
                  value={row.bankBranch}
                  onChange={(e) => updateCheque(idx, 'bankBranch', e.target.value)}
                  className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                />
              </div>
              <div className="sm:col-span-2">
                <input
                  type="text"
                  placeholder="City"
                  value={row.city}
                  onChange={(e) => updateCheque(idx, 'city', e.target.value)}
                  className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                />
              </div>
              <div className="sm:col-span-2">
                <input
                  type="text"
                  placeholder="Cheque No."
                  value={row.chequeNo}
                  onChange={(e) => updateCheque(idx, 'chequeNo', e.target.value)}
                  className="w-full text-xs font-mono px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                />
              </div>
              <div className="sm:col-span-2">
                <input
                  type="number"
                  min="0"
                  placeholder="₹ Amount"
                  value={row.amount}
                  onChange={(e) => updateCheque(idx, 'amount', e.target.value)}
                  className="w-full text-xs font-bold font-mono px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-right"
                />
              </div>
              <div className="sm:col-span-1 flex justify-end">
                <button
                  type="button"
                  onClick={() => removeChequeRow(idx)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                  title="Remove cheque"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {data.cheques.length < 5 && (
          <button
            type="button"
            onClick={addChequeRow}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-blue-50 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Another Cheque ({data.cheques.length}/5)</span>
          </button>
        )}
      </div>

      {/* 4. Grand Total & Automatic Words Bar */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-[#004c8f] text-white flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-md">
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-wider text-slate-300 font-bold flex items-center gap-1.5">
            <Calculator className="w-3.5 h-3.5 text-amber-400" />
            <span>Grand Total Deposit</span>
          </div>
          <div className="text-2xl font-black font-mono text-white">
            ₹{formatINR(grandTotal) || '0'}
          </div>
          {grandWords && (
            <div className="text-xs text-amber-300 font-semibold italic">
              {grandWords}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs font-medium text-slate-200">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Real-time calculation synced with official counterfoil</span>
        </div>
      </div>
    </div>
  );
};
