/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Printer,
  Download,
  RotateCcw,
  Sparkles,
  Calculator,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileCheck,
  Send,
  Building,
  CheckCircle,
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';

import { BankConfig, BANKS_LIST } from '../data/banks';

interface NeftRtgsSlipProps {
  onBack?: () => void;
  bank?: BankConfig;
  onChangeBank?: () => void;
}

// Indian currency words helpers
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
}

function words(n: number): string {
  if (!n) return '';
  const o: string[] = [];
  const cr = Math.floor(n / 1e7);
  const lk = Math.floor(n / 1e5) % 100;
  const th = Math.floor(n / 1e3) % 100;
  const hu = Math.floor(n / 100) % 10;
  const rm = n % 100;

  if (cr) o.push(words(cr) + ' Crore');
  if (lk) o.push(twoDigits(lk) + ' Lakh');
  if (th) o.push(twoDigits(th) + ' Thousand');
  if (hu) o.push(ONES[hu] + ' Hundred');
  if (rm) o.push(twoDigits(rm));

  return o.join(' ');
}

function wordsCurrency(n: number): string {
  if (!n || n <= 0) return '';
  const w = Math.floor(n);
  const p = Math.round((n - w) * 100);
  return `Rupees ${words(w) || 'Zero'}${p ? ' and ' + twoDigits(p) + ' Paise' : ''} Only`;
}

const formatINR = (n: number | ''): string => {
  if (n === '' || isNaN(Number(n))) return '';
  return Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
};

export const NeftRtgsSlip: React.FC<NeftRtgsSlipProps> = ({ onBack, bank, onChangeBank }) => {
  const currentBank = bank || BANKS_LIST[0];

  // Application details
  const [branch, setBranch] = useState(currentBank.sampleBranch || 'New Delhi Main Branch');
  const [bcode, setBcode] = useState(currentBank.sampleBranchCode || '00691');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [transferType, setTransferType] = useState<'neft' | 'rtgs'>('neft');
  const [debitAcc, setDebitAcc] = useState(currentBank.sampleAccount || '38192038192');
  const [mode2, setMode2] = useState<'chq' | 'trf'>('chq');
  const [chqNo, setChqNo] = useState('048291');
  const [chqDate, setChqDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (bank) {
      setBranch(bank.sampleBranch);
      setBcode(bank.sampleBranchCode);
      setDebitAcc(bank.sampleAccount);
    }
  }, [bank?.id]);

  // Beneficiary details
  const [benName, setBenName] = useState('Apex Technologies Private Limited');
  const [benBank, setBenBank] = useState('HDFC Bank Ltd, Connaught Place Branch, New Delhi');
  const [ifsc, setIfsc] = useState('HDFC0000003');
  const [benAcc, setBenAcc] = useState('50200012345678');

  // Amounts
  const [amount, setAmount] = useState<number | ''>(85000);
  const [charges, setCharges] = useState<number | ''>(5);

  // Applicant details
  const [applicantName, setApplicantName] = useState('Ramesh Kumar Verma');
  const [applicantAddr, setApplicantAddr] = useState('Flat 402, Rohini Sector 14, New Delhi - 110085');
  const [mobile, setMobile] = useState('9876543210');
  const [tel, setTel] = useState('011-27891234');

  // Preview & export options
  const [renderMode, setRenderMode] = useState<'full' | 'data'>('full');
  const [includeReverse, setIncludeReverse] = useState(false);
  const [zoomScale, setZoomScale] = useState(0.65);
  const [isExporting, setIsExporting] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const wrapRef = useRef<HTMLDivElement>(null);
  const slipRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);

  // Auto-fit slip width to screen container on resize
  useEffect(() => {
    const handleFit = () => {
      if (wrapRef.current) {
        const containerW = wrapRef.current.clientWidth - 24;
        if (containerW > 0) {
          const calculated = Math.min(1, Math.max(0.35, containerW / 1568));
          setZoomScale(calculated);
        }
      }
    };
    handleFit();
    window.addEventListener('resize', handleFit);
    return () => window.removeEventListener('resize', handleFit);
  }, []);

  // Amounts and calculations
  const numAmt = typeof amount === 'number' ? amount : parseFloat(String(amount)) || 0;
  const numChg = typeof charges === 'number' ? charges : parseFloat(String(charges)) || 0;
  const grandTotal = numAmt + numChg;

  // Words
  const wordsAmount = wordsCurrency(numAmt);
  const wordsTotal = wordsCurrency(grandTotal);

  // Date formatting
  const [yStr, mStr, dStr] = date ? date.split('-') : ['', '', ''];
  const formattedDate = dStr ? `${dStr}/${mStr}/${yStr}` : '';

  const [cyStr, cmStr, cdStr] = chqDate ? chqDate.split('-') : ['', '', ''];
  const formattedChqDate = cdStr ? `${cdStr}/${cmStr}/${cyStr}` : '';

  // Auto-switch to RTGS if amount >= 2 Lakhs
  const handleAmountChange = (val: number | '') => {
    setAmount(val);
    const n = typeof val === 'number' ? val : parseFloat(String(val)) || 0;
    if (n >= 200000 && transferType === 'neft') {
      setTransferType('rtgs');
    }
  };

  // Estimate NEFT / RTGS Bank charges
  const calculateCharges = () => {
    if (numAmt <= 0) return;
    let chg = 0;
    if (transferType === 'neft') {
      if (numAmt <= 10000) chg = 2.5;
      else if (numAmt <= 100000) chg = 5;
      else if (numAmt <= 200000) chg = 15;
      else chg = 25;
    } else {
      if (numAmt <= 500000) chg = 25;
      else chg = 50;
    }
    setCharges(chg);
  };

  const handleClear = () => {
    setBranch('');
    setBcode('');
    setDebitAcc('');
    setChqNo('');
    setBenName('');
    setBenBank('');
    setIfsc('');
    setBenAcc('');
    setAmount('');
    setCharges('');
    setApplicantName('');
    setApplicantAddr('');
    setMobile('');
    setTel('');
  };

  // PDF Export
  const handleDownloadPdf = async () => {
    setIsExporting(true);
    setStatusMsg(`Generating ${currentBank.name} A4 landscape PDF...`);
    try {
      const elFront = slipRef.current;
      const elBack = backRef.current;
      if (!elFront) return;

      const origFrontTransform = elFront.style.transform;
      elFront.style.transform = 'scale(1)';

      const frontCanvas = await html2canvas(elFront, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      elFront.style.transform = origFrontTransform;

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = 281;
      const pdfHeight = (281 * 540) / 1568;

      pdf.addImage(frontCanvas.toDataURL('image/png'), 'PNG', 8, 12, pdfWidth, pdfHeight);

      if (includeReverse && elBack) {
        const origBackTransform = elBack.style.transform;
        elBack.style.transform = 'scale(1)';
        const backCanvas = await html2canvas(elBack, {
          scale: 2.5,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
        });
        elBack.style.transform = origBackTransform;

        pdf.addPage();
        pdf.addImage(backCanvas.toDataURL('image/png'), 'PNG', 8, 12, pdfWidth, pdfHeight);
      }

      pdf.save(`${currentBank.shortCode}_${transferType.toUpperCase()}_Remittance_Application.pdf`);
      setStatusMsg('PDF downloaded successfully!');
      setTimeout(() => setStatusMsg(''), 4000);
    } catch (err) {
      console.error(err);
      setStatusMsg('Unable to generate PDF. You can use direct Print.');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Print CSS */}
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 8mm;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
          }
          .no-print, header, nav, aside, footer {
            display: none !important;
          }
          .sbi-neft-slip {
            zoom: 0.6773 !important;
            transform: none !important;
            margin: 0 auto !important;
          }
          .page-break {
            page-break-before: always !important;
            break-before: always !important;
          }
        }
      `}</style>

      {/* Top Action Bar */}
      <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          )}

          <div className="flex items-center gap-2">
            <div
              style={{ backgroundColor: currentBank.primaryColor }}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-xs shadow-sm shrink-0"
            >
              {currentBank.shortCode.slice(0, 3)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                  {currentBank.name} • RTGS / NEFT Application
                </h1>
                {onChangeBank && (
                  <button
                    type="button"
                    onClick={onChangeBank}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold hover:underline cursor-pointer"
                  >
                    Change Bank (32)
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {currentBank.hindiName} • Application for RTGS/NEFT Remittance • {currentBank.neftFormCode}
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Mode Selector */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
            <button
              onClick={() => setRenderMode('full')}
              className={`px-3 py-1 rounded-lg font-semibold transition ${
                renderMode === 'full'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Full Form (Blank Paper)
            </button>
            <button
              onClick={() => setRenderMode('data')}
              className={`px-3 py-1 rounded-lg font-semibold transition ${
                renderMode === 'data'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
              title="Prints only entries without borders so you can print directly into bank counterfoil booklets"
            >
              Entries Only (Pre-Printed)
            </button>
          </div>

          {/* Reverse Side Toggle */}
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
            <input
              type="checkbox"
              checked={includeReverse}
              onChange={(e) => setIncludeReverse(e.target.checked)}
              className="rounded text-blue-600 focus:ring-0"
            />
            <span>Include Reverse (Conditions)</span>
          </label>

          <button
            onClick={handleClear}
            className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>

          <button
            onClick={handleDownloadPdf}
            disabled={isExporting}
            className="px-3.5 py-1.5 rounded-xl border border-blue-500/30 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-xs font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1.5 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>{isExporting ? 'Exporting...' : 'Download PDF'}</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/20 flex items-center gap-1.5 transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Form</span>
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="no-print p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-medium flex items-center gap-2">
          <Sparkles className="w-4 h-4 animate-spin text-blue-400" />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* 1. TOP SECTION: Vertical Data Entry Form */}
      <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-6">
        {/* Form Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>{currentBank.name} • NEFT / RTGS Remittance Entry</span>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-mono font-bold">
                Live Sync Below
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Enter remittance details below. The official banking slip replica below updates in real-time as you type.
            </p>
          </div>

          {/* Transfer Type Selector Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setTransferType('neft')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                transferType === 'neft'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              NEFT Remittance
            </button>
            <button
              type="button"
              onClick={() => setTransferType('rtgs')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                transferType === 'rtgs'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              RTGS (₹2 Lakh+)
            </button>
          </div>
        </div>

        {/* 3 Form Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-xs">

          {/* Column 1: Application & Remitter Particulars */}
          <div className="space-y-3.5 bg-slate-50/60 dark:bg-slate-800/30 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <h3 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <span>1. Remitter &amp; Debit Details</span>
              <span className="text-[10px] text-slate-400 font-normal">Source</span>
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                  Branch
                </label>
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="Branch Name"
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                  Branch Code
                </label>
                <input
                  type="text"
                  value={bcode}
                  onChange={(e) => setBcode(e.target.value)}
                  placeholder="00691"
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                Date (दिनांक)
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                Remitter Account No. ({currentBank.accLength} Digits)
              </label>
              <input
                type="text"
                value={debitAcc}
                onChange={(e) => setDebitAcc(e.target.value.replace(/\D/g, ''))}
                placeholder={`${currentBank.shortCode} Account Number`}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono font-bold tracking-widest text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                  By Way Of
                </label>
                <select
                  value={mode2}
                  onChange={(e) => setMode2(e.target.value as 'chq' | 'trf')}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="chq">Cheque (NEFT/RTGS)</option>
                  <option value="trf">Transfer (only NEFT)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                  Cheque No.
                </label>
                <input
                  type="text"
                  value={chqNo}
                  onChange={(e) => setChqNo(e.target.value)}
                  placeholder="048291"
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                Cheque Date
              </label>
              <input
                type="date"
                value={chqDate}
                onChange={(e) => setChqDate(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Column 2: Beneficiary Details */}
          <div className="space-y-3.5 bg-slate-50/60 dark:bg-slate-800/30 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <h3 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <span>2. Beneficiary Particulars</span>
              <span className="text-[10px] text-slate-400 font-normal">Destination</span>
            </h3>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                Name of the Beneficiary
              </label>
              <input
                type="text"
                value={benName}
                onChange={(e) => setBenName(e.target.value)}
                placeholder="Full Name / Company Name"
                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                Beneficiary Bank &amp; Branch
              </label>
              <input
                type="text"
                value={benBank}
                onChange={(e) => setBenBank(e.target.value)}
                placeholder="e.g. HDFC Bank, Connaught Place Branch"
                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                  IFSC Code (11)
                </label>
                <input
                  type="text"
                  maxLength={11}
                  value={ifsc}
                  onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                  placeholder="HDFC0000003"
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono font-bold uppercase tracking-wider focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                  Account No. (up to 18)
                </label>
                <input
                  type="text"
                  maxLength={18}
                  value={benAcc}
                  onChange={(e) => setBenAcc(e.target.value)}
                  placeholder="Beneficiary A/c"
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                Confirm Beneficiary Account No.
              </label>
              <input
                type="text"
                maxLength={18}
                value={benAcc}
                onChange={(e) => setBenAcc(e.target.value)}
                placeholder="Re-enter Account No."
                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Column 3: Amount, Charges & Remitter Contact */}
          <div className="space-y-3.5 bg-slate-50/60 dark:bg-slate-800/30 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
            <div className="space-y-3.5">
              <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-700">
                <h3 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px]">
                  3. Amount &amp; Applicant Contact
                </h3>
                <button
                  type="button"
                  onClick={calculateCharges}
                  className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <Calculator className="w-3 h-3" />
                  <span>Estimate Charges</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                    Remittance Amount (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={amount}
                    onChange={(e) =>
                      handleAmountChange(e.target.value === '' ? '' : parseFloat(e.target.value))
                    }
                    placeholder="0"
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono font-bold text-base focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                    Bank Charges (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={charges}
                    onChange={(e) =>
                      setCharges(e.target.value === '' ? '' : parseFloat(e.target.value))
                    }
                    placeholder="0"
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono font-bold text-base focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl flex items-center justify-between font-bold text-slate-900 dark:text-white">
                <span className="text-xs">Total Debit Amount</span>
                <span className="font-mono text-lg text-emerald-600 dark:text-emerald-400 font-black">
                  ₹{formatINR(grandTotal) || '0.00'}
                </span>
              </div>

              {wordsTotal && (
                <div className="p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700 space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Amount in Indian Rupee Words:
                  </span>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-snug">
                    {wordsTotal}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-700">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                    Applicant Name
                  </label>
                  <input
                    type="text"
                    value={applicantName}
                    onChange={(e) => setApplicantName(e.target.value)}
                    placeholder="Full Name"
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                    Mobile No. (10)
                  </label>
                  <input
                    type="text"
                    maxLength={10}
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                    placeholder="9876543210"
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={applicantAddr}
                  onChange={(e) => setApplicantAddr(e.target.value)}
                  placeholder="Full Residential or Business Address"
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. BOTTOM SECTION: Interactive Live Replica Below Data Entry */}
      <div className="w-full flex flex-col items-center min-w-0">
          {/* Zoom & View Controls */}
          <div className="no-print w-full flex items-center justify-between mb-3 px-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
              <span>Interactive Live Coordinate Replica</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
                1568 × 540 px
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <button
                  onClick={() => setZoomScale((prev) => Math.max(0.3, prev - 0.05))}
                  className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="font-mono text-xs w-10 text-center">
                  {Math.round(zoomScale * 100)}%
                </span>
                <button
                  onClick={() => setZoomScale((prev) => Math.min(1.2, prev + 0.05))}
                  className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    if (wrapRef.current) {
                      const containerW = wrapRef.current.clientWidth - 24;
                      setZoomScale(Math.min(1, containerW / 1568));
                    }
                  }}
                  className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800"
                  title="Fit Width"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Slip Canvas Wrapper */}
          <div
            ref={wrapRef}
            className="w-full overflow-x-auto bg-slate-200 dark:bg-slate-950 p-4 rounded-2xl border border-slate-300 dark:border-slate-800 flex flex-col items-center gap-6 shadow-inner"
          >
            {/* Front Slip */}
            <div
              style={{
                width: `${1568 * zoomScale}px`,
                height: `${540 * zoomScale}px`,
                position: 'relative',
              }}
              className="transition-all duration-150 shrink-0"
            >
              <div
                ref={slipRef}
                id="sbi-neft-slip"
                className={`sbi-neft-slip ${renderMode === 'data' ? 'data-only' : ''}`}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '1568px',
                  height: '540px',
                  backgroundColor: '#ffffff',
                  color: '#000000',
                  fontFamily: '"Times New Roman", Times, serif',
                  fontSize: '17px',
                  transform: `scale(${zoomScale})`,
                  transformOrigin: 'top left',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                  border: renderMode === 'full' ? '1px solid #d1d5db' : 'none',
                }}
              >
                {/* Embedded Coordinate CSS */}
                <style>{`
                  #sbi-neft-slip {
                    --ln: #000000;
                  }
                  #sbi-neft-slip.data-only {
                    --ln: transparent !important;
                  }
                  #sbi-neft-slip.data-only .st {
                    color: transparent !important;
                    border-color: transparent !important;
                    fill: transparent !important;
                  }
                  #sbi-neft-slip .a {
                    position: absolute;
                    white-space: nowrap;
                    transform: translateY(-50%);
                  }
                  #sbi-neft-slip .bx {
                    position: absolute;
                    border: 1px solid var(--ln);
                    box-sizing: border-box;
                  }
                  #sbi-neft-slip .d {
                    font: 700 15px "Times New Roman", Times, serif;
                    color: #000000;
                  }
                  #sbi-neft-slip .cn {
                    transform: translate(-50%, -50%);
                    text-align: center;
                  }
                `}</style>

                {/* ============================================================== */}
                {/* LEFT STUB (Customer Counterfoil: x: 79 to 455)                 */}
                {/* ============================================================== */}
                {/* Logo & Header */}
                <div className="bx" style={{ left: 79, top: 40, width: 377, height: 37 }} />
                {currentBank.id === 'sbi' ? (
                  <svg
                    className="a st"
                    style={{ left: '86px', top: '58px', width: '96px', height: '34px', color: '#1f2f93' }}
                    viewBox="0 0 112 40"
                  >
                    <circle cx="19" cy="21" r="17" fill="#17a3dc" />
                    <circle cx="19" cy="16" r="5.5" fill="#fff" />
                    <rect x="17" y="18" width="4" height="14" fill="#fff" />
                    <text x="38" y="35" fontFamily="Arial Black, Arial, sans-serif" fontWeight="900" fontSize="38" fill="currentColor">
                      SBI
                    </text>
                  </svg>
                ) : (
                  <div
                    className="a st flex items-center justify-center font-black text-white rounded-lg shadow-xs"
                    style={{
                      left: '86px',
                      top: '58px',
                      width: '44px',
                      height: '26px',
                      backgroundColor: currentBank.primaryColor,
                      fontSize: '12px',
                    }}
                  >
                    {currentBank.shortCode.slice(0, 4)}
                  </div>
                )}
                <div
                  className="a st"
                  style={{
                    left: currentBank.id === 'sbi' ? 234 : 140,
                    top: 58,
                    fontSize: '20px',
                    fontWeight: 700,
                  }}
                >
                  {currentBank.name}
                </div>

                {/* Branch & Date */}
                <div className="bx" style={{ left: 79, top: 76, width: 147, height: 26 }} />
                <div className="bx" style={{ left: 225, top: 76, width: 61, height: 26 }} />
                <div className="bx" style={{ left: 285, top: 76, width: 51, height: 26 }} />
                <div className="bx" style={{ left: 335, top: 76, width: 121, height: 26 }} />
                <div className="a d" style={{ left: 79, top: 88, width: 146, textAlign: 'center', fontSize: '13px' }}>
                  {branch}
                </div>
                <div className="a cn st" style={{ left: 255, top: 89, fontSize: '13px', fontWeight: 700 }}>
                  Branch
                </div>
                <div className="a cn st" style={{ left: 310, top: 89, fontSize: '13px', fontWeight: 700 }}>
                  Date
                </div>
                <div className="a d" style={{ left: 335, top: 88, width: 120, textAlign: 'left', paddingLeft: '7px' }}>
                  {formattedDate}
                </div>

                {/* Received ₹ Total */}
                <div className="bx" style={{ left: 79, top: 101, width: 120, height: 32 }} />
                <div className="bx" style={{ left: 198, top: 101, width: 31, height: 32 }} />
                <div className="bx" style={{ left: 228, top: 101, width: 228, height: 32 }} />
                <div className="a st" style={{ left: 90, top: 116, fontSize: '16px' }}>
                  Received
                </div>
                <div className="a st" style={{ left: 201, top: 117, fontSize: '26px' }}>
                  ₹
                </div>
                <div
                  className="a d"
                  style={{ left: 228, top: 116, width: 227, textAlign: 'right', paddingRight: '8px' }}
                >
                  {formatINR(grandTotal)}
                </div>

                {/* From Name */}
                <div className="bx" style={{ left: 79, top: 132, width: 120, height: 29 }} />
                <div className="bx" style={{ left: 198, top: 132, width: 258, height: 29 }} />
                <div className="a st" style={{ left: 90, top: 146, fontSize: '16px' }}>
                  From
                </div>
                <div className="a d" style={{ left: 198, top: 146, width: 257, textAlign: 'left', paddingLeft: '7px' }}>
                  {applicantName}
                </div>

                {/* Notice text */}
                <div className="bx" style={{ left: 79, top: 160, width: 377, height: 38 }} />
                <div className="a st" style={{ left: 81, top: 172, fontSize: '14px' }}>
                  For Remittance of NEFT/RTGS by way of (i) Transfer
                </div>
                <div className="a st" style={{ left: 81, top: 188, fontSize: '14px' }}>
                  (only NEFT), (ii)Cheque (NEFT/RTGS) USING
                </div>

                {/* Cheque No */}
                <div className="bx" style={{ left: 79, top: 197, width: 148, height: 24 }} />
                <div className="bx" style={{ left: 226, top: 197, width: 230, height: 24 }} />
                <div className="a st" style={{ left: 90, top: 208, fontSize: '15px' }}>
                  Cheque No.
                </div>
                <div className="a d" style={{ left: 226, top: 208, width: 229, textAlign: 'left', paddingLeft: '7px' }}>
                  {chqNo}
                </div>

                {/* Favouring */}
                <div className="bx" style={{ left: 79, top: 220, width: 148, height: 28 }} />
                <div className="bx" style={{ left: 226, top: 220, width: 230, height: 28 }} />
                <div className="a st" style={{ left: 90, top: 233, fontSize: '15px' }}>
                  Favouring
                </div>
                <div className="a d" style={{ left: 226, top: 233, width: 229, textAlign: 'left', paddingLeft: '7px', fontSize: '13px' }}>
                  {benName}
                </div>

                {/* A/C NO */}
                <div className="bx" style={{ left: 79, top: 247, width: 148, height: 29 }} />
                <div className="bx" style={{ left: 226, top: 247, width: 230, height: 29 }} />
                <div className="a st" style={{ left: 90, top: 261, fontSize: '15px' }}>
                  A/C NO.
                </div>
                <div className="a d" style={{ left: 226, top: 261, width: 229, textAlign: 'left', paddingLeft: '7px', letterSpacing: '1px' }}>
                  {benAcc}
                </div>

                {/* IFSC CODE */}
                <div className="bx" style={{ left: 79, top: 275, width: 148, height: 28 }} />
                <div className="bx" style={{ left: 226, top: 275, width: 230, height: 28 }} />
                <div className="a st" style={{ left: 90, top: 288, fontSize: '15px' }}>
                  IFSC CODE
                </div>
                <div className="a d" style={{ left: 226, top: 288, width: 229, textAlign: 'left', paddingLeft: '7px', letterSpacing: '1px' }}>
                  {ifsc}
                </div>

                {/* Beneficiary Bank & Branch */}
                <div className="bx" style={{ left: 79, top: 302, width: 148, height: 41 }} />
                <div className="bx" style={{ left: 226, top: 302, width: 230, height: 41 }} />
                <div className="a st" style={{ left: 90, top: 316, fontSize: '15px' }}>
                  Beneficiary Bank
                </div>
                <div className="a st" style={{ left: 90, top: 332, fontSize: '15px' }}>
                  &amp; Branch
                </div>
                <div className="a d" style={{ left: 226, top: 322, width: 229, textAlign: 'left', paddingLeft: '7px', fontSize: '12px' }}>
                  {benBank}
                </div>

                {/* Amount */}
                <div className="bx" style={{ left: 79, top: 342, width: 120, height: 27 }} />
                <div className="bx" style={{ left: 198, top: 342, width: 29, height: 27 }} />
                <div className="bx" style={{ left: 226, top: 342, width: 230, height: 27 }} />
                <div className="a st" style={{ left: 90, top: 355, fontSize: '15px' }}>
                  Amount
                </div>
                <div className="a st" style={{ left: 207, top: 355, fontSize: '24px' }}>
                  ₹
                </div>
                <div className="a d" style={{ left: 226, top: 355, width: 229, textAlign: 'right', paddingRight: '8px' }}>
                  {formatINR(numAmt)}
                </div>

                {/* Bank Charges */}
                <div className="bx" style={{ left: 79, top: 368, width: 120, height: 27 }} />
                <div className="bx" style={{ left: 198, top: 368, width: 29, height: 27 }} />
                <div className="bx" style={{ left: 226, top: 368, width: 230, height: 27 }} />
                <div className="a st" style={{ left: 90, top: 381, fontSize: '15px' }}>
                  Bank Charges
                </div>
                <div className="a st" style={{ left: 207, top: 381, fontSize: '24px' }}>
                  ₹
                </div>
                <div className="a d" style={{ left: 226, top: 381, width: 229, textAlign: 'right', paddingRight: '8px' }}>
                  {formatINR(numChg)}
                </div>

                {/* Total */}
                <div className="bx" style={{ left: 79, top: 394, width: 120, height: 29 }} />
                <div className="bx" style={{ left: 198, top: 394, width: 29, height: 29 }} />
                <div className="bx" style={{ left: 226, top: 394, width: 230, height: 29 }} />
                <div className="a st" style={{ left: 90, top: 408, fontSize: '15px' }}>
                  Total
                </div>
                <div className="a st" style={{ left: 207, top: 408, fontSize: '24px' }}>
                  ₹
                </div>
                <div className="a d" style={{ left: 226, top: 408, width: 229, textAlign: 'right', paddingRight: '8px' }}>
                  {formatINR(grandTotal) || '0'}
                </div>

                {/* (Rupees in words) */}
                <div className="bx" style={{ left: 79, top: 422, width: 80, height: 31 }} />
                <div className="bx" style={{ left: 158, top: 422, width: 298, height: 31 }} />
                <div className="a st" style={{ left: 90, top: 437, fontSize: '15px' }}>
                  (Rupees
                </div>
                <div
                  className="a d"
                  style={{
                    left: 158,
                    top: 437,
                    width: 297,
                    textAlign: 'left',
                    whiteSpace: 'normal',
                    lineHeight: '13px',
                    fontSize: '11.5px',
                    padding: '0 5px',
                  }}
                >
                  {wordsTotal}
                </div>

                {/* For office use */}
                <div className="bx" style={{ left: 79, top: 452, width: 377, height: 19 }} />
                <div className="a st" style={{ left: 82, top: 461, fontSize: '15px' }}>
                  For office Use
                </div>

                <div className="bx" style={{ left: 79, top: 470, width: 189, height: 36 }} />
                <div className="bx" style={{ left: 267, top: 470, width: 189, height: 36 }} />
                <div className="a st" style={{ left: 90, top: 482, fontSize: '15px' }}>
                  UTR No.
                </div>
                <div className="a st" style={{ left: 345, top: 495, fontSize: '15px' }}>
                  Branch Manager
                </div>

                {/* ============================================================== */}
                {/* RIGHT MAIN FORM (x: 488 to 1502)                               */}
                {/* ============================================================== */}
                {/* Header row 1: y=41 to 80 */}
                <div className="bx" style={{ left: 488, top: 41, width: 303, height: 40 }} />
                <div className="bx" style={{ left: 790, top: 41, width: 476, height: 40 }} />
                <div className="bx" style={{ left: 1265, top: 41, width: 73, height: 40 }} />
                <div className="bx" style={{ left: 1337, top: 41, width: 166, height: 40 }} />

                {currentBank.id === 'sbi' ? (
                  <svg
                    className="a st"
                    style={{ left: '494px', top: '60px', width: '96px', height: '34px', color: '#1f2f93' }}
                    viewBox="0 0 112 40"
                  >
                    <circle cx="19" cy="21" r="17" fill="#17a3dc" />
                    <circle cx="19" cy="16" r="5.5" fill="#fff" />
                    <rect x="17" y="18" width="4" height="14" fill="#fff" />
                    <text x="38" y="35" fontFamily="Arial Black, Arial, sans-serif" fontWeight="900" fontSize="38" fill="currentColor">
                      SBI
                    </text>
                  </svg>
                ) : (
                  <div
                    className="a st flex items-center justify-center font-black text-white rounded-lg shadow-xs"
                    style={{
                      left: '494px',
                      top: '60px',
                      width: '44px',
                      height: '26px',
                      backgroundColor: currentBank.primaryColor,
                      fontSize: '12px',
                    }}
                  >
                    {currentBank.shortCode.slice(0, 4)}
                  </div>
                )}
                <div
                  className="a st"
                  style={{
                    left: currentBank.id === 'sbi' ? 603 : 548,
                    top: 60,
                    fontSize: '21px',
                    fontWeight: 700,
                  }}
                >
                  {currentBank.name}
                </div>
                <div
                  className="a cn st"
                  style={{ left: 1027, top: 56, fontSize: '22px', fontWeight: 700 }}
                >
                  <b>
                    <i>
                      <u>Application for RTGS/NEFT Remittance</u>
                    </i>
                  </b>
                </div>
                <div className="a cn st" style={{ left: 1300, top: 55, fontSize: '22px' }}>
                  Date
                </div>
                <div className="a d" style={{ left: 1337, top: 60, width: 165, textAlign: 'left', paddingLeft: '7px' }}>
                  {formattedDate}
                </div>

                {/* Row 2: y=80 to 108 */}
                <div className="bx" style={{ left: 488, top: 80, width: 93, height: 29 }} />
                <div className="bx" style={{ left: 580, top: 80, width: 236, height: 29 }} />
                <div className="bx" style={{ left: 815, top: 80, width: 148, height: 29 }} />
                <div className="bx" style={{ left: 962, top: 80, width: 34, height: 29 }} />
                <div className="bx" style={{ left: 995, top: 80, width: 121, height: 29 }} />
                <div className="bx" style={{ left: 1115, top: 80, width: 151, height: 29 }} />
                <div className="bx" style={{ left: 1265, top: 80, width: 238, height: 29 }} />

                <div className="a st" style={{ left: 497, top: 94, fontSize: '20px', fontWeight: 700 }}>
                  Branch
                </div>
                <div className="a d" style={{ left: 580, top: 94, width: 235, textAlign: 'center' }}>
                  {branch}
                </div>

                {/* NEFT tick box */}
                <div className="bx" style={{ left: 822, top: 83, width: 24, height: 23 }} />
                {transferType === 'neft' && (
                  <div
                    className="a d"
                    style={{ left: 822, top: 94, width: 23, textAlign: 'center', fontSize: '20px', padding: 0 }}
                  >
                    ✓
                  </div>
                )}
                <div className="a st" style={{ left: 897, top: 94, fontSize: '20px', fontWeight: 700 }}>
                  NEFT
                </div>

                {/* RTGS tick box */}
                <div className="bx" style={{ left: 970, top: 84, width: 23, height: 21 }} />
                {transferType === 'rtgs' && (
                  <div
                    className="a d"
                    style={{ left: 970, top: 94, width: 22, textAlign: 'center', fontSize: '20px', padding: 0 }}
                  >
                    ✓
                  </div>
                )}
                <div className="a st" style={{ left: 1044, top: 94, fontSize: '20px', fontWeight: 700 }}>
                  RTGS
                </div>

                <div className="a st" style={{ left: 1120, top: 94, fontSize: '20px', fontWeight: 700 }}>
                  Branch Code
                </div>
                <div className="a d" style={{ left: 1265, top: 94, width: 237, textAlign: 'left', paddingLeft: '7px' }}>
                  {bcode}
                </div>

                {/* Row 3: y=108 to 137 */}
                <div className="bx" style={{ left: 488, top: 108, width: 193, height: 30 }} />
                <div className="bx" style={{ left: 680, top: 108, width: 34, height: 30 }} />
                <div className="bx" style={{ left: 713, top: 108, width: 263, height: 30 }} />
                <div className="bx" style={{ left: 975, top: 108, width: 34, height: 30 }} />
                <div className="bx" style={{ left: 1008, top: 108, width: 495, height: 30 }} />

                <div className="a st" style={{ left: 497, top: 122, fontSize: '16.5px' }}>
                  Please remit the sum of
                </div>
                <div className="a st" style={{ left: 684, top: 122, fontSize: '26px' }}>
                  ₹
                </div>
                <div className="a d" style={{ left: 713, top: 122, width: 262, textAlign: 'left', paddingLeft: '7px' }}>
                  {formatINR(numAmt)}
                </div>
                <div className="a st" style={{ left: 982, top: 122, fontSize: '26px' }}>
                  ₹
                </div>
                <div className="a d" style={{ left: 1008, top: 122, width: 494, textAlign: 'left', paddingLeft: '7px', fontSize: '14px' }}>
                  {wordsAmount}
                </div>

                {/* Row 4: y=137 to 168 */}
                <div className="bx" style={{ left: 488, top: 137, width: 1015, height: 32 }} />
                <div className="a st" style={{ left: 497, top: 153, fontSize: '19px' }}>
                  By Debiting my our Account No.
                </div>
                {debitAcc && (
                  <div
                    className="a d"
                    style={{ left: 768, top: 153, letterSpacing: '11px', fontSize: '15px' }}
                  >
                    {debitAcc}
                  </div>
                )}
                <div className="a st" style={{ left: 1018, top: 153, fontSize: '19px' }}>
                  by way of
                </div>

                {/* Transfer tick box */}
                <div className="bx" style={{ left: 1125, top: 141, width: 24, height: 23 }} />
                {mode2 === 'trf' && (
                  <div
                    className="a d"
                    style={{ left: 1125, top: 152, width: 23, textAlign: 'center', fontSize: '20px', padding: 0 }}
                  >
                    ✓
                  </div>
                )}
                <div className="a st" style={{ left: 1158, top: 150, fontSize: '16px' }}>
                  Transfer (only NEFT)
                </div>

                {/* Cheque tick box */}
                <div className="bx" style={{ left: 1322, top: 141, width: 24, height: 23 }} />
                {mode2 === 'chq' && (
                  <div
                    className="a d"
                    style={{ left: 1322, top: 152, width: 23, textAlign: 'center', fontSize: '20px', padding: 0 }}
                  >
                    ✓
                  </div>
                )}
                <div className="a st" style={{ left: 1348, top: 150, fontSize: '16px' }}>
                  Cheque <span style={{ fontSize: '14px' }}>(NEFT/RTGS)</span>
                </div>

                {/* Row 5: y=168 to 202 */}
                <div className="bx" style={{ left: 488, top: 168, width: 163, height: 35 }} />
                <div className="bx" style={{ left: 650, top: 168, width: 166, height: 35 }} />
                <div className="bx" style={{ left: 815, top: 168, width: 104, height: 35 }} />
                <div className="bx" style={{ left: 918, top: 168, width: 128, height: 35 }} />
                <div className="bx" style={{ left: 1045, top: 168, width: 458, height: 35 }} />

                <div className="a st" style={{ left: 497, top: 185, fontSize: '18px' }}>
                  Using Cheque No.
                </div>
                <div className="a d" style={{ left: 650, top: 185, width: 165, textAlign: 'left', paddingLeft: '7px' }}>
                  {chqNo}
                </div>
                <div className="a cn st" style={{ left: 866, top: 181, fontSize: '18px' }}>
                  Dated
                </div>
                <div className="a d" style={{ left: 918, top: 185, width: 127, textAlign: 'left', paddingLeft: '7px' }}>
                  {formattedChqDate}
                </div>
                <div className="a st" style={{ left: 1053, top: 179, fontSize: '12.5px' }}>
                  For the total amount including your charges, as per the details given
                </div>
                <div className="a st" style={{ left: 1053, top: 194, fontSize: '12.5px' }}>
                  below:
                </div>

                {/* Row 6: Beneficiary Name */}
                <div className="bx" style={{ left: 488, top: 202, width: 226, height: 34 }} />
                <div className="bx" style={{ left: 713, top: 202, width: 790, height: 34 }} />
                <div className="a st" style={{ left: 497, top: 218, fontSize: '18px' }}>
                  Name of the Beneficiary
                </div>
                <div className="a d" style={{ left: 713, top: 218, width: 789, textAlign: 'left', paddingLeft: '7px' }}>
                  {benName}
                </div>

                {/* Row 7: Beneficiary Bank & Branch */}
                <div className="bx" style={{ left: 488, top: 235, width: 226, height: 46 }} />
                <div className="bx" style={{ left: 713, top: 235, width: 790, height: 46 }} />
                <div className="a st" style={{ left: 497, top: 247, fontSize: '18px' }}>
                  Beneficiary Bank &amp;
                </div>
                <div className="a st" style={{ left: 497, top: 268, fontSize: '18px' }}>
                  Branch
                </div>
                <div className="a d" style={{ left: 713, top: 257, width: 789, textAlign: 'left', paddingLeft: '7px' }}>
                  {benBank}
                </div>

                {/* Row 8: IFSC Code (11 cells) */}
                <div className="bx" style={{ left: 488, top: 280, width: 226, height: 31 }} />
                <div className="a st" style={{ left: 497, top: 295, fontSize: '18px' }}>
                  IFSC CODE:
                </div>
                {/* 11 cells from 713 to 1195 (width: 482) */}
                {(() => {
                  const cellW = 482 / 11;
                  return Array.from({ length: 11 }).map((_, i) => (
                    <React.Fragment key={`ifsc-cell-${i}`}>
                      <div
                        className="bx"
                        style={{
                          left: 713 + i * cellW,
                          top: 280,
                          width: cellW + 1,
                          height: 31,
                        }}
                      />
                      <div
                        className="a d"
                        style={{
                          left: 713 + i * cellW,
                          top: 295,
                          width: cellW,
                          textAlign: 'center',
                          fontSize: '15px',
                        }}
                      >
                        {ifsc[i] || ''}
                      </div>
                    </React.Fragment>
                  ));
                })()}
                <div className="bx" style={{ left: 1195, top: 280, width: 308, height: 31 }} />

                {/* Row 9: Beneficiary Account No (18 cells) */}
                <div className="bx" style={{ left: 488, top: 310, width: 226, height: 31 }} />
                <div className="a st" style={{ left: 497, top: 325, fontSize: '18px' }}>
                  Beneficiary Account No.
                </div>
                {/* 18 cells from 713 to 1502 (width: 789) */}
                {(() => {
                  const cellW = 789 / 18;
                  return Array.from({ length: 18 }).map((_, i) => (
                    <React.Fragment key={`bacc-cell-${i}`}>
                      <div
                        className="bx"
                        style={{
                          left: 713 + i * cellW,
                          top: 310,
                          width: cellW + 1,
                          height: 31,
                        }}
                      />
                      <div
                        className="a d"
                        style={{
                          left: 713 + i * cellW,
                          top: 325,
                          width: cellW,
                          textAlign: 'center',
                          fontSize: '15px',
                        }}
                      >
                        {benAcc[i] || ''}
                      </div>
                    </React.Fragment>
                  ));
                })()}

                {/* Row 10: Amount in words */}
                <div className="bx" style={{ left: 488, top: 340, width: 226, height: 29 }} />
                <div className="bx" style={{ left: 713, top: 340, width: 48, height: 29 }} />
                <div className="bx" style={{ left: 760, top: 340, width: 743, height: 29 }} />
                <div className="a st" style={{ left: 497, top: 354, fontSize: '18px' }}>
                  Amount (in Words)
                </div>
                <div className="a st" style={{ left: 722, top: 352, fontSize: '26px' }}>
                  ₹
                </div>
                <div className="a d" style={{ left: 760, top: 354, width: 742, textAlign: 'left', paddingLeft: '7px', fontSize: '14px' }}>
                  {wordsAmount}
                </div>

                {/* Row 11: Amount in Figures, Charges, Total */}
                <div className="bx" style={{ left: 488, top: 368, width: 226, height: 30 }} />
                <div className="bx" style={{ left: 713, top: 368, width: 48, height: 30 }} />
                <div className="bx" style={{ left: 760, top: 368, width: 159, height: 30 }} />
                <div className="bx" style={{ left: 918, top: 368, width: 111, height: 30 }} />
                <div className="bx" style={{ left: 1028, top: 368, width: 176, height: 30 }} />
                <div className="bx" style={{ left: 1203, top: 368, width: 113, height: 30 }} />
                <div className="bx" style={{ left: 1315, top: 368, width: 188, height: 30 }} />

                <div className="a st" style={{ left: 497, top: 382, fontSize: '18px' }}>
                  Amount (in Figures)
                </div>
                <div className="a st" style={{ left: 722, top: 381, fontSize: '26px' }}>
                  ₹
                </div>
                <div className="a d" style={{ left: 760, top: 382, width: 158, textAlign: 'left', paddingLeft: '7px' }}>
                  {formatINR(numAmt)}
                </div>
                <div className="a st" style={{ left: 930, top: 382, fontSize: '18px' }}>
                  Charges ₹
                </div>
                <div className="a d" style={{ left: 1028, top: 382, width: 175, textAlign: 'left', paddingLeft: '7px' }}>
                  {formatINR(numChg)}
                </div>
                <div className="a st" style={{ left: 1213, top: 382, fontSize: '18px' }}>
                  Total ₹
                </div>
                <div className="a d" style={{ left: 1315, top: 382, width: 187, textAlign: 'left', paddingLeft: '7px' }}>
                  {formatINR(grandTotal) || '0'}
                </div>

                {/* Row 12: Name of Applicant & Address */}
                <div className="bx" style={{ left: 488, top: 397, width: 226, height: 30 }} />
                <div className="bx" style={{ left: 713, top: 397, width: 313, height: 30 }} />
                <div className="bx" style={{ left: 1025, top: 397, width: 84, height: 30 }} />
                <div className="bx" style={{ left: 1108, top: 397, width: 395, height: 30 }} />

                <div className="a st" style={{ left: 497, top: 411, fontSize: '18px' }}>
                  Name of the Applicant
                </div>
                <div className="a d" style={{ left: 713, top: 411, width: 312, textAlign: 'left', paddingLeft: '7px' }}>
                  {applicantName}
                </div>
                <div className="a cn st" style={{ left: 1066, top: 411, fontSize: '18px' }}>
                  Address
                </div>
                <div className="a d" style={{ left: 1108, top: 411, width: 394, textAlign: 'left', paddingLeft: '7px', fontSize: '13px' }}>
                  {applicantAddr}
                </div>

                {/* Row 13: Mobile No (10 cells), Tel No, UTR */}
                <div className="bx" style={{ left: 488, top: 426, width: 120, height: 30 }} />
                <div className="a st" style={{ left: 497, top: 441, fontSize: '18px' }}>
                  Mobile No.
                </div>
                {/* 10 cells from 607 to 827 (width: 220) */}
                {(() => {
                  const cellW = 220 / 10;
                  return Array.from({ length: 10 }).map((_, i) => (
                    <React.Fragment key={`mob-cell-${i}`}>
                      <div
                        className="bx"
                        style={{
                          left: 607 + i * cellW,
                          top: 426,
                          width: cellW + 1,
                          height: 30,
                        }}
                      />
                      <div
                        className="a d"
                        style={{
                          left: 607 + i * cellW,
                          top: 440,
                          width: cellW,
                          textAlign: 'center',
                          fontSize: '15px',
                        }}
                      >
                        {mobile[i] || ''}
                      </div>
                    </React.Fragment>
                  ));
                })()}

                <div className="bx" style={{ left: 827, top: 426, width: 79, height: 30 }} />
                <div className="bx" style={{ left: 905, top: 426, width: 146, height: 30 }} />
                <div className="bx" style={{ left: 1050, top: 426, width: 154, height: 30 }} />
                <div className="bx" style={{ left: 1203, top: 426, width: 300, height: 30 }} />

                <div className="a cn st" style={{ left: 866, top: 441, fontSize: '18px' }}>
                  Tel No.
                </div>
                <div className="a d" style={{ left: 905, top: 441, width: 145, textAlign: 'left', paddingLeft: '7px' }}>
                  {tel}
                </div>
                <div className="a st" style={{ left: 1058, top: 440, fontSize: '18px' }}>
                  UTR No. &amp; Date
                </div>

                {/* Row 14: Signatures & Office Use */}
                <div className="bx" style={{ left: 488, top: 455, width: 163, height: 53 }} />
                <div className="bx" style={{ left: 650, top: 455, width: 318, height: 53 }} />
                <div className="bx" style={{ left: 967, top: 455, width: 237, height: 53 }} />
                <div className="bx" style={{ left: 1203, top: 455, width: 300, height: 53 }} />

                <div className="a cn st" style={{ left: 569, top: 481, fontSize: '18px' }}>
                  (for Office Use)
                </div>
                <div className="a cn st" style={{ left: 808, top: 481, fontSize: '18px' }}>
                  (Please see conditions on the reverse)
                </div>
                <div className="a cn st" style={{ left: 1085, top: 481, fontSize: '18px' }}>
                  Signature of Applicant(s)
                </div>
              </div>
            </div>

            {/* Reverse Conditions Side */}
            {includeReverse && (
              <div
                style={{
                  width: `${1568 * zoomScale}px`,
                  height: `${540 * zoomScale}px`,
                  position: 'relative',
                }}
                className="transition-all duration-150 shrink-0 page-break"
              >
                <div
                  ref={backRef}
                  id="sbi-neft-back"
                  className="sbi-neft-slip"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '1568px',
                    height: '540px',
                    backgroundColor: '#ffffff',
                    color: '#000000',
                    fontFamily: 'Arial, Helvetica, sans-serif',
                    fontSize: '14px',
                    transform: `scale(${zoomScale})`,
                    transformOrigin: 'top left',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                    border: '1px solid #d1d5db',
                  }}
                >
                  <div
                    className="st"
                    style={{
                      position: 'absolute',
                      left: '531px',
                      top: '66px',
                      width: '990px',
                      height: '390px',
                      border: '1px solid #000000',
                    }}
                  />
                  <div
                    className="st"
                    style={{
                      position: 'absolute',
                      left: '531px',
                      top: '84px',
                      width: '990px',
                      textAlign: 'center',
                      font: '700 24px Arial, sans-serif',
                    }}
                  >
                    Application for RTGS/NEFT Remittance
                  </div>
                  <div
                    className="st"
                    style={{
                      position: 'absolute',
                      left: '531px',
                      top: '116px',
                      width: '990px',
                      borderTop: '1px solid #000000',
                    }}
                  />
                  <div
                    className="st"
                    style={{
                      position: 'absolute',
                      left: '545px',
                      top: '128px',
                      width: '960px',
                      whiteSpace: 'normal',
                      font: '14.4px/19px Arial, sans-serif',
                      textAlign: 'justify',
                    }}
                  >
                    <strong>Conditions for Transfer</strong>
                    <br />
                    1. All payment instructions be carefully checked by the remitter. As crediting the
                    proceeds of the remittance is based on the beneficiary’s account number, the name
                    of the bank and its branch SBI shall not be responsible if these particulars are
                    not provided correctly by the remitter.
                    <br />
                    2. Applications/Message received after the business hours will be sent only the
                    immediate next working day.
                    <br />
                    3. SBI shall not be responsible for any delay in processing of the payment due to
                    RBI/RTGS/NEFT system not being available/failure of internal communication system
                    at the recipient bank/branch/incorrect information provided by the remitter/Any
                    incorrect credit accorded by the recipient bank/branch due to incorrect information
                    provided by the remitter.
                    <br />
                    4. (i) Remitting branch shall not be liable for any or damage resulting from delay
                    in transmission delivery or non-delivery of electronics message or any mistake,
                    omission or error in transmission or delivery thereof or in encrypting/decrypting the
                    message for any cause whatsoever or from misinterpretation when received or for
                    the action of the destination bank or for any act beyond the control of State Bank of
                    India.
                    <br />
                    &nbsp;&nbsp;&nbsp;(ii) If the recipient branch is closed for any reason, the
                    account shall be credited on the immediate next working day.
                    <br />
                    &nbsp;&nbsp;&nbsp;(iii) Bank is free recover charges in respect of remittance
                    returned on account of family/inadequate information.
                    <br />
                    5. I/We have fully read the terms and conditions of the RTGS/NEFT remittance and
                    shall abide by the same.
                  </div>
                  <div
                    className="st"
                    style={{
                      position: 'absolute',
                      left: '1335px',
                      top: '430px',
                      font: '14.4px Arial, sans-serif',
                      fontWeight: 600,
                    }}
                  >
                    (Signature of applicant(s))
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Guide Footer */}
          <div className="no-print mt-4 p-4 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>
                <strong>A4 Landscape Printing:</strong> Select <strong>A4</strong> paper, <strong>Landscape</strong> orientation, Margins <strong>Minimum/None</strong>, and Scale <strong>100%</strong>. Use the checkbox above to optionally include the reverse side conditions page.
              </span>
            </div>
            <div className="text-[11px] font-mono text-slate-400">
              Form RTGS/NEFT V2
            </div>
          </div>
        </div>
      </div>
  );
};
