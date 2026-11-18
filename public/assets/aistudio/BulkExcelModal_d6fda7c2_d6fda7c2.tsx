/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { flushSync } from 'react-dom';
import {
  X,
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Printer,
  Archive,
  Loader2,
  Info,
  ExternalLink,
  Eye,
  RefreshCw,
} from 'lucide-react';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas-pro';

import { BankConfig, getBankById } from '../constants/banks';
import {
  SbiSlipType,
  DepositFormData,
  HdfcDepositFormData,
  NeftRtgsFormData,
  HdfcNeftFormData,
  DemandDraftFormData,
  HdfcDdFormData,
  HdfcChequeRow,
} from '../types';
import {
  generateBulkExcelTemplate,
  parseBulkExcelFile,
  BulkSlipRecord,
  BulkValidationResult,
} from '../utils/excelBulkEngine';
import { numberToWordsIndian } from '../utils/numberToWords';
import { flattenCanvasToWhiteJpeg } from '../utils/pdfExport';

// Authentic Bank Replica Components
import { SbiDepositSlipReplica } from './SbiDepositSlipReplica';
import { HdfcDepositSlipReplica } from './HdfcDepositSlipReplica';
import { SbiNeftSlipReplica } from './SbiNeftSlipReplica';
import { HdfcNeftSlipReplica } from './HdfcNeftSlipReplica';
import { SbiNewDraftSlipReplica } from './SbiNewDraftSlipReplica';
import { HdfcDdSlipReplica } from './HdfcDdSlipReplica';

interface BulkExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  bank: BankConfig;
  slipType: SbiSlipType;
  initialOrientation?: 'landscape' | 'portrait';
  onLoadRecordIntoEditor?: (record: BulkSlipRecord, bankId: string, slipType: SbiSlipType) => void;
}

/**
 * Normalizes input date strings (DD/MM/YYYY, DD-MM-YYYY, ISO) into YYYY-MM-DD
 * so replica components (which split on '-') unpack days, months, and years with 100% precision.
 */
function toIsoDate(dateStr: string): string {
  if (!dateStr) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const clean = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }
  const dmyMatch = clean.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const mon = dmyMatch[2].padStart(2, '0');
    const yr = dmyMatch[3];
    return `${yr}-${mon}-${day}`;
  }
  return clean;
}

/**
 * Resolves denomination breakdown. If user entered note counts in excel, uses those.
 * Otherwise, auto-allocates cash amount into realistic currency notes.
 */
function resolveDenominations(rec: BulkSlipRecord): Record<number, number> {
  const counts: Record<number, number> = {
    500: rec.d500 || 0,
    200: rec.d200 || 0,
    100: rec.d100 || 0,
    50: rec.d50 || 0,
    20: rec.d20 || 0,
    10: rec.d10 || 0,
  };
  const totalUser =
    counts[500] * 500 +
    counts[200] * 200 +
    counts[100] * 100 +
    counts[50] * 50 +
    counts[20] * 20 +
    counts[10] * 10 +
    (rec.coins || 0);

  if (totalUser > 0) {
    return counts;
  }

  // Auto-allocate cash amount if user left note count cells blank
  if (rec.depositType !== 'cheque' && rec.amount > 0) {
    let rem = rec.amount;
    const denoms = [500, 200, 100, 50, 20, 10];
    for (const d of denoms) {
      if (rem >= d) {
        counts[d] = Math.floor(rem / d);
        rem %= d;
      }
    }
  }
  return counts;
}

/**
 * Mappers from BulkSlipRecord to the official Bank Replica component props
 */
function buildDepositData(rec: BulkSlipRecord): DepositFormData {
  const denoms = resolveDenominations(rec);
  const chqDetails = rec.chequeNo
    ? `${rec.chequeNo} ${rec.draweeBank ? '/ ' + rec.draweeBank : ''}`.trim()
    : rec.depositType === 'cheque'
    ? 'Cheque Clearing'
    : '';
  const chqAmount: number | '' =
    (rec.depositType === 'cheque' || Boolean(rec.chequeNo)) && rec.amount > 0 ? rec.amount : '';

  const extraCheques = rec.cheques || [];
  const chq1: { details: string; amount: number | '' } = {
    details: extraCheques[0]?.chequeNo
      ? `${extraCheques[0].chequeNo} / ${extraCheques[0].draweeBank || ''}`.trim()
      : chqDetails,
    amount:
      typeof extraCheques[0]?.amount === 'number' && extraCheques[0].amount > 0
        ? extraCheques[0].amount
        : chqAmount,
  };
  const chq2: { details: string; amount: number | '' } = {
    details: extraCheques[1]?.chequeNo
      ? `${extraCheques[1].chequeNo} / ${extraCheques[1].draweeBank || ''}`.trim()
      : '',
    amount:
      typeof extraCheques[1]?.amount === 'number' && extraCheques[1].amount > 0
        ? extraCheques[1].amount
        : '',
  };
  const chq3: { details: string; amount: number | '' } = {
    details: extraCheques[2]?.chequeNo
      ? `${extraCheques[2].chequeNo} / ${extraCheques[2].draweeBank || ''}`.trim()
      : '',
    amount:
      typeof extraCheques[2]?.amount === 'number' && extraCheques[2].amount > 0
        ? extraCheques[2].amount
        : '',
  };

  return {
    branch: rec.branch || 'Main Branch',
    date: toIsoDate(rec.date),
    tel: rec.phone || '',
    accountNo: rec.accountNo || '',
    name: rec.name || '',
    email: '',
    pan: '',
    form60: false,
    denominations: {
      2000: '',
      500: denoms[500] || '',
      200: denoms[200] || '',
      100: denoms[100] || '',
      50: denoms[50] || '',
      20: denoms[20] || '',
      10: denoms[10] || '',
      5: '',
    },
    coins: rec.coins || '',
    cheques: [chq1, chq2, chq3],
  };
}

function buildHdfcDepositData(rec: BulkSlipRecord): HdfcDepositFormData {
  const denoms = resolveDenominations(rec);
  const extraCheques = rec.cheques || [];
  const cheques: HdfcChequeRow[] = [];

  if (extraCheques.length > 0) {
    extraCheques.forEach((c) => {
      cheques.push({
        bankBranch: c.draweeBank || 'HDFC Bank',
        city: 'Mumbai',
        chequeNo: c.chequeNo || '',
        amount: c.amount || '',
      });
    });
  } else if (rec.chequeNo || rec.depositType === 'cheque') {
    cheques.push({
      bankBranch: rec.draweeBank || 'HDFC Bank',
      city: rec.branch || 'Mumbai',
      chequeNo: rec.chequeNo || '',
      amount: rec.amount || '',
    });
  }

  return {
    date: toIsoDate(rec.date),
    depositType: rec.depositType === 'cheque' ? 'local' : 'cash',
    accountNo: rec.accountNo || '',
    creditCardNo: '',
    loanAccountNo: '',
    loanAccountTicked: false,
    name: rec.name || '',
    phone: rec.phone || '',
    pan: '',
    special: '',
    denominations: {
      2000: '',
      500: denoms[500] || '',
      200: denoms[200] || '',
      100: denoms[100] || '',
      50: denoms[50] || '',
      20: denoms[20] || '',
      10: denoms[10] || '',
    },
    coins: rec.coins || '',
    cheques:
      cheques.length > 0 ? cheques : [{ bankBranch: '', city: '', chequeNo: '', amount: '' }],
  };
}

function buildNeftData(rec: BulkSlipRecord): NeftRtgsFormData {
  return {
    branch: rec.branch || 'Main Branch',
    bcode: '',
    date: toIsoDate(rec.date),
    transferType: rec.transferType || (rec.amount >= 200000 ? 'rtgs' : 'neft'),
    debitAcc: rec.accountNo || '',
    mode2: 'chq',
    chqNo: rec.chequeNo || '',
    chqDate: toIsoDate(rec.chequeDate || rec.date),
    benName: rec.benName || '',
    benBank: rec.benBank || '',
    ifsc: rec.benIfsc || '',
    benAcc: rec.benAccountNo || '',
    amount: rec.amount || '',
    charges: '',
    applicantName: rec.name || '',
    applicantAddr: '',
    mobile: rec.phone || '',
    tel: '',
  };
}

function buildHdfcNeftData(rec: BulkSlipRecord): HdfcNeftFormData {
  const isRtgs = rec.transferType === 'rtgs' || rec.amount >= 200000;
  return {
    type: isRtgs ? 'rtgs' : 'neft',
    date: toIsoDate(rec.date),
    time: '11:00 AM',
    chequeNo: rec.chequeNo || '',
    name: rec.name || '',
    accountNo: rec.accountNo || '',
    mobile: rec.phone || '',
    tel: '',
    remitterLei: '',
    remitterLeiExpiry: '',
    remitterAddress: '',
    remitterEmail: '',
    cashDeposited: '',
    beneficiaryName: rec.benName || '',
    beneficiaryContact: '',
    beneficiaryAddress: '',
    beneficiaryAccountNo: rec.benAccountNo || '',
    beneficiaryAccountNoConfirm: rec.benAccountNo || '',
    beneficiaryBankBranch: rec.benBank || '',
    beneficiaryIfsc: rec.benIfsc || '',
    beneficiaryAccountType: 'res',
    purpose: 'Commercial / Personal Transfer',
    beneficiaryLei: '',
    beneficiaryLeiExpiry: '',
    amount: rec.amount || '',
    remarks: 'Bulk Upload Transfer',
    banvOption: '1',
  };
}

function buildDdData(rec: BulkSlipRecord): DemandDraftFormData {
  const denoms = resolveDenominations(rec);
  return {
    version: 'new_trilingual',
    branch: rec.branch || 'Main Branch',
    date: toIsoDate(rec.date),
    issueType: 'dd',
    applicantName: rec.name || '',
    applicantAddr: '',
    inFavourOf: rec.inFavourOf || '',
    payableAt: rec.payableAt || 'Main Branch',
    codeNo: '',
    draftAmt: rec.amount || '',
    exchangeAmt: '',
    denominations: {
      1000: '',
      500: denoms[500] || '',
      100: denoms[100] || '',
      50: denoms[50] || '',
      20: denoms[20] || '',
      10: denoms[10] || '',
      5: '',
      2: '',
      1: '',
    },
    pan: '',
    mobile: rec.phone || '',
  };
}

function buildHdfcDdData(rec: BulkSlipRecord): HdfcDdFormData {
  return {
    date: toIsoDate(rec.date),
    branch: rec.branch || 'Main Branch',
    isDdChecked: true,
    payableAt: rec.payableAt || 'Main Branch',
    favoring: rec.inFavourOf || '',
    amount: rec.amount || '',
    chequeNo: rec.chequeNo || '',
    chequeDate: toIsoDate(rec.chequeDate || rec.date),
    purchaserName: rec.name || '',
    accountNo: rec.accountNo || '',
    deliverTo: 'Self / Bearer',
  };
}

/**
 * Returns exact component dimensions for html2canvas capture and jsPDF placement
 */
function getReplicaDimensions(slipType: SbiSlipType): { width: number; height: number } {
  switch (slipType) {
    case 'hdfc_neft':
      return { width: 856, height: 1400 };
    case 'hdfc_dd':
      return { width: 850, height: 1400 };
    case 'demand_draft':
      return { width: 1568, height: 680 };
    case 'neft_rtgs':
      return { width: 1568, height: 540 };
    case 'hdfc_deposit':
      return { width: 1568, height: 610 };
    case 'deposit':
    default:
      return { width: 1568, height: 600 };
  }
}

/**
 * Renders the authentic bank replica component for a given parsed bulk record
 */
function renderReplicaForRecord(rec: BulkSlipRecord, bankId: string, slipType: SbiSlipType) {
  if (slipType === 'deposit') {
    return <SbiDepositSlipReplica data={buildDepositData(rec)} mode="full" />;
  }
  if (slipType === 'hdfc_deposit') {
    return <HdfcDepositSlipReplica data={buildHdfcDepositData(rec)} mode="full" />;
  }
  if (slipType === 'neft_rtgs') {
    return <SbiNeftSlipReplica data={buildNeftData(rec)} mode="full" />;
  }
  if (slipType === 'hdfc_neft') {
    return <HdfcNeftSlipReplica data={buildHdfcNeftData(rec)} mode="full" />;
  }
  if (slipType === 'demand_draft') {
    return <SbiNewDraftSlipReplica data={buildDdData(rec)} mode="full" />;
  }
  if (slipType === 'hdfc_dd') {
    return <HdfcDdSlipReplica data={buildHdfcDdData(rec)} mode="full" />;
  }
  return null;
}

/**
 * Polling helper that waits for a DOM element to mount
 */
async function waitForElement(id: string, maxWaitMs = 3500): Promise<HTMLElement> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const el = document.getElementById(id);
    if (el) return el;
    await new Promise((r) => requestAnimationFrame(r));
  }
  const el = document.getElementById(id);
  if (!el) throw new Error(`Bank replica staging node (#${id}) could not be initialized`);
  return el;
}

/**
 * Captures the authentic bank replica from the clean, unobstructed #bulk-active-capture-node.
 * Direct html2canvas capture with 100% white background, zero scroll offsets, and explicit dimensions.
 */
async function captureBulkReplicaJpeg(dims: { width: number; height: number }): Promise<string> {
  const el = await waitForElement('bulk-active-capture-node', 3500);

  // Allow layout and webfonts to settle
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  const canvas = await html2canvas(el, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
    removeContainer: true,
    scrollX: 0,
    scrollY: 0,
    windowWidth: dims.width,
    windowHeight: dims.height,
  });

  return flattenCanvasToWhiteJpeg(canvas);
}

export const BulkExcelModal: React.FC<BulkExcelModalProps> = ({
  isOpen,
  onClose,
  bank: initialBank,
  slipType: initialSlipType,
  onLoadRecordIntoEditor,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dynamic Bank & Slip Type selector state inside modal
  const [activeBankId, setActiveBankId] = useState<string>(initialBank.id || 'sbi');
  const [activeSlipType, setActiveSlipType] = useState<SbiSlipType>(initialSlipType || 'deposit');
  const activeBank = getBankById(activeBankId);

  // Orientation state
  const isPortraitFixed = activeSlipType === 'hdfc_dd' || activeSlipType === 'hdfc_neft';
  const defaultOrientation: 'landscape' | 'portrait' = isPortraitFixed ? 'portrait' : 'landscape';
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>(defaultOrientation);

  // Sync when props change or modal reopens
  useEffect(() => {
    if (isOpen) {
      setActiveBankId(initialBank.id || 'sbi');
      setActiveSlipType(initialSlipType || 'deposit');
      const fixed = initialSlipType === 'hdfc_dd' || initialSlipType === 'hdfc_neft';
      setOrientation(fixed ? 'portrait' : 'landscape');
      setActionError(null);
    }
  }, [isOpen, initialBank.id, initialSlipType]);

  const [isParsing, setIsParsing] = useState(false);
  const [validationResult, setValidationResult] = useState<BulkValidationResult | null>(null);
  const [selectedRecordIndex, setSelectedRecordIndex] = useState<number | null>(null);

  // Generation status & errors
  const [isGenerating, setIsGenerating] = useState(false);
  const [renderingRecord, setRenderingRecord] = useState<BulkSlipRecord | null>(null);
  const [progressMsg, setProgressMsg] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!isOpen) return null;

  const getSlipTitle = (): string => {
    switch (activeSlipType) {
      case 'deposit':
        return 'SBI Pay-in Slip (100999131-V3)';
      case 'hdfc_deposit':
        return 'HDFC Pay-in Slip (RMTL 9328)';
      case 'neft_rtgs':
        return 'SBI RTGS / NEFT Remittance Slip (V2)';
      case 'hdfc_neft':
        return 'HDFC RTGS / NEFT Request Form (Code 92929)';
      case 'demand_draft':
        return "SBI Demand Draft / Banker's Cheque (CC-5003234)";
      case 'hdfc_dd':
        return 'HDFC Demand Draft Application Form';
      default:
        return 'Bank Deposit Slip';
    }
  };

  /**
   * Switch active bank and form type inside the modal
   */
  const handleSwitchForm = (bankId: string, type: SbiSlipType) => {
    setActiveBankId(bankId);
    setActiveSlipType(type);
    const fixed = type === 'hdfc_dd' || type === 'hdfc_neft';
    setOrientation(fixed ? 'portrait' : 'landscape');
    setValidationResult(null);
    setSelectedRecordIndex(null);
    setActionError(null);
  };

  // 1. Download official pre-formatted template for this exact bank & slip type
  const handleDownloadTemplate = () => {
    setActionError(null);
    generateBulkExcelTemplate(activeBankId, activeSlipType);
  };

  // 2. Client-side File Upload & Parsing
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    setValidationResult(null);
    setActionError(null);

    try {
      const res = await parseBulkExcelFile(file, activeBankId, activeSlipType);
      setValidationResult(res);
      if (res.records.length > 0) {
        setSelectedRecordIndex(0);
      }
    } catch (err: any) {
      setValidationResult({
        success: false,
        error: 'Failed to process file: ' + (err?.message || err),
        totalRecords: 0,
        validRecords: 0,
        invalidRecords: 0,
        records: [],
      });
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  /**
   * Action 1: Combined Multi-Page PDF Download using Authentic Bank Replicas
   */
  /**
   * Action 1: Combined Multi-Page PDF Download using Authentic Bank Replicas
   */
  const handleGenerateCombinedPdf = async () => {
    if (!validationResult || validationResult.records.length === 0) return;
    const validRecords = validationResult.records.filter((r) => r.isValid);
    if (validRecords.length === 0) return;

    setActionError(null);
    setIsGenerating(true);
    setProgressPercent(5);
    setProgressMsg('Initializing authentic bank replica vector engine...');

    const isPortrait = isPortraitFixed || orientation === 'portrait';
    const dims = getReplicaDimensions(activeSlipType);

    try {
      const pdf = new jsPDF({
        orientation: isPortrait ? 'portrait' : 'landscape',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      for (let i = 0; i < validRecords.length; i++) {
        const rec = validRecords[i];
        setProgressPercent(Math.round(10 + (i / validRecords.length) * 80));
        setProgressMsg(
          `Rendering official voucher ${i + 1} of ${validRecords.length} (${rec.name || rec.accountNo})...`
        );

        // Force synchronous React state flush to DOM
        flushSync(() => {
          setRenderingRecord(rec);
        });

        // Ensure browser paint & fonts settle
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        await new Promise((r) => setTimeout(r, 60));

        const jpeg = await captureBulkReplicaJpeg(dims);

        if (i > 0) {
          pdf.addPage('a4', isPortrait ? 'portrait' : 'landscape');
        }

        if (isPortrait) {
          // A4 Portrait: 210mm x 297mm
          if (dims.height > dims.width) {
            // Standard vertical form (HDFC DD & HDFC NEFT)
            const pdfHeightMm = 281;
            const pdfWidthMm = (281 * dims.width) / dims.height;
            const startX = Math.max(0, (210 - pdfWidthMm) / 2);
            const startY = 8;
            pdf.addImage(jpeg, 'JPEG', startX, startY, pdfWidthMm, pdfHeightMm, undefined, 'FAST');
          } else {
            // Horizontal slip positioned on A4 portrait
            const pdfWidthMm = 194;
            const pdfHeightMm = (194 * dims.height) / dims.width;
            const startX = 8;
            const startY = Math.max(0, (297 - pdfHeightMm) / 2);
            pdf.addImage(jpeg, 'JPEG', startX, startY, pdfWidthMm, pdfHeightMm, undefined, 'FAST');
          }
        } else {
          // A4 Landscape: 297mm x 210mm
          const pdfWidthMm = 281;
          const pdfHeightMm = (281 * dims.height) / dims.width;
          const startX = Math.max(0, (297 - pdfWidthMm) / 2);
          const startY = Math.max(0, (210 - pdfHeightMm) / 2);
          pdf.addImage(jpeg, 'JPEG', startX, startY, pdfWidthMm, pdfHeightMm, undefined, 'FAST');
        }
      }

      setProgressPercent(95);
      setProgressMsg('Compiling and saving PDF file...');

      const orientationLabel = isPortrait ? 'Portrait' : 'Landscape';
      const filename = `${activeBank.shortCode}_${activeSlipType.toUpperCase()}_Official_${validRecords.length}_Slips_${orientationLabel}.pdf`;

      // Reliable cross-browser and iframe download mechanism
      try {
        pdf.save(filename);
      } catch (saveErr) {
        console.warn('pdf.save failed, falling back to blob anchor download', saveErr);
        const blob = pdf.output('blob');
        const blobUrl = URL.createObjectURL(blob);
        const downloadAnchor = document.createElement('a');
        downloadAnchor.style.display = 'none';
        downloadAnchor.href = blobUrl;
        downloadAnchor.download = filename;
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        setTimeout(() => {
          if (downloadAnchor.parentNode) {
            document.body.removeChild(downloadAnchor);
          }
          URL.revokeObjectURL(blobUrl);
        }, 3000);
      }

      setProgressPercent(100);
      setProgressMsg('PDF downloaded successfully!');
      setTimeout(() => {
        setRenderingRecord(null);
        setIsGenerating(false);
      }, 500);
    } catch (err: any) {
      console.error('PDF Generation Error:', err);
      setActionError(err?.message || 'PDF compilation failed. Please try again.');
      setRenderingRecord(null);
      setIsGenerating(false);
    }
  };

  /**
   * Action 2: Download ZIP of Individual PDFs using Authentic Bank Replicas
   */
  const handleGenerateZip = async () => {
    if (!validationResult || validationResult.records.length === 0) return;
    const validRecords = validationResult.records.filter((r) => r.isValid);
    if (validRecords.length === 0) return;

    setActionError(null);
    setIsGenerating(true);
    setProgressPercent(5);
    setProgressMsg('Packaging individual bank slips into ZIP archive...');

    const isPortrait = isPortraitFixed || orientation === 'portrait';
    const dims = getReplicaDimensions(activeSlipType);

    try {
      const zip = new JSZip();

      for (let i = 0; i < validRecords.length; i++) {
        const rec = validRecords[i];
        setProgressPercent(Math.round(10 + (i / validRecords.length) * 75));
        setProgressMsg(`Rasterizing individual voucher ${i + 1} of ${validRecords.length}...`);

        flushSync(() => {
          setRenderingRecord(rec);
        });
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        await new Promise((r) => setTimeout(r, 60));

        const jpeg = await captureBulkReplicaJpeg(dims);

        const singlePdf = new jsPDF({
          orientation: isPortrait ? 'portrait' : 'landscape',
          unit: 'mm',
          format: 'a4',
          compress: true,
        });

        if (isPortrait) {
          if (dims.height > dims.width) {
            const pdfHeightMm = 281;
            const pdfWidthMm = (281 * dims.width) / dims.height;
            const startX = Math.max(0, (210 - pdfWidthMm) / 2);
            const startY = 8;
            singlePdf.addImage(
              jpeg,
              'JPEG',
              startX,
              startY,
              pdfWidthMm,
              pdfHeightMm,
              undefined,
              'FAST'
            );
          } else {
            const pdfWidthMm = 194;
            const pdfHeightMm = (194 * dims.height) / dims.width;
            const startX = 8;
            const startY = Math.max(0, (297 - pdfHeightMm) / 2);
            singlePdf.addImage(
              jpeg,
              'JPEG',
              startX,
              startY,
              pdfWidthMm,
              pdfHeightMm,
              undefined,
              'FAST'
            );
          }
        } else {
          const pdfWidthMm = 281;
          const pdfHeightMm = (281 * dims.height) / dims.width;
          const startX = Math.max(0, (297 - pdfWidthMm) / 2);
          const startY = Math.max(0, (210 - pdfHeightMm) / 2);
          singlePdf.addImage(
            jpeg,
            'JPEG',
            startX,
            startY,
            pdfWidthMm,
            pdfHeightMm,
            undefined,
            'FAST'
          );
        }

        const pdfArrayBuffer = singlePdf.output('arraybuffer');
        const safeName = (rec.name || 'Account').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20);
        const fileName = `${activeBank.shortCode}_Slip_${String(rec.rowNumber).padStart(2, '0')}_${safeName}_${rec.accountNo}.pdf`;
        zip.file(fileName, pdfArrayBuffer);
      }

      setProgressPercent(88);
      setProgressMsg('Compressing ZIP archive...');

      const content = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 1 },
      });

      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `${activeBank.shortCode}_${activeSlipType.toUpperCase()}_Official_${validRecords.length}_Slips.zip`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (a.parentNode) {
          document.body.removeChild(a);
        }
        URL.revokeObjectURL(url);
      }, 3000);

      setProgressPercent(100);
      setProgressMsg('ZIP downloaded successfully!');
      setTimeout(() => {
        setRenderingRecord(null);
        setIsGenerating(false);
      }, 500);
    } catch (err: any) {
      console.error('ZIP Generation Error:', err);
      setActionError(err?.message || 'ZIP packaging failed. Please try again.');
      setRenderingRecord(null);
      setIsGenerating(false);
    }
  };

  /**
   * Action 3: Direct Batch Print with Authentic Bank Replicas
   */
  const handlePrintAll = async () => {
    if (!validationResult || validationResult.records.length === 0) return;
    const validRecords = validationResult.records.filter((r) => r.isValid);
    if (validRecords.length === 0) return;

    setActionError(null);
    setIsGenerating(true);
    const isPortrait = isPortraitFixed || orientation === 'portrait';
    const dims = getReplicaDimensions(activeSlipType);

    setProgressMsg(
      'Preparing batch print stream in ' + (isPortrait ? 'Portrait' : 'Landscape') + ' mode...'
    );
    setProgressPercent(10);

    try {
      const images: string[] = [];
      for (let i = 0; i < validRecords.length; i++) {
        const rec = validRecords[i];
        setProgressPercent(Math.round(10 + (i / validRecords.length) * 80));
        setProgressMsg(`Processing voucher ${i + 1} of ${validRecords.length} for printing...`);

        flushSync(() => {
          setRenderingRecord(rec);
        });
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        await new Promise((r) => setTimeout(r, 60));

        const jpeg = await captureBulkReplicaJpeg(dims);
        images.push(jpeg);
      }

      setProgressPercent(95);
      setProgressMsg('Opening print dialogue...');

      let printIframe = document.getElementById('bulk-slip-print-frame') as HTMLIFrameElement;
      if (printIframe && printIframe.parentNode) {
        printIframe.parentNode.removeChild(printIframe);
      }

      printIframe = document.createElement('iframe');
      printIframe.id = 'bulk-slip-print-frame';
      printIframe.style.position = 'fixed';
      printIframe.style.right = '0';
      printIframe.style.bottom = '0';
      printIframe.style.width = '100%';
      printIframe.style.height = '100%';
      printIframe.style.border = 'none';
      printIframe.style.zIndex = '-1';
      printIframe.style.visibility = 'visible';
      printIframe.style.opacity = '1';
      document.body.appendChild(printIframe);

      const iframeDoc = printIframe.contentWindow?.document;
      if (!iframeDoc) {
        window.print();
        setRenderingRecord(null);
        setIsGenerating(false);
        return;
      }

      const printOrientation = isPortrait ? 'portrait' : 'landscape';
      const pagesHtml = images
        .map(
          (src, idx) => `
          <div class="bulk-slip-sheet">
            <img src="${src}" class="bulk-slip-img" alt="Official Bank Slip ${idx + 1}" />
          </div>
        `
        )
        .join('\n');

      iframeDoc.open();
      iframeDoc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Print Bulk Official Bank Slips - ${activeBank.name}</title>
            <style>
              @page {
                size: A4 ${printOrientation};
                margin: ${printOrientation === 'landscape' ? '6mm 8mm' : '8mm'};
              }
              * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              html, body {
                background: #ffffff !important;
                background-color: #ffffff !important;
                color: #000000 !important;
                width: 100% !important;
                height: auto !important;
                margin: 0 !important;
                padding: 0 !important;
              }
              .bulk-slip-sheet {
                width: 100%;
                height: 100%;
                max-height: ${printOrientation === 'landscape' ? '196mm' : '284mm'};
                display: flex;
                align-items: center;
                justify-content: center;
                page-break-after: always;
                break-after: page;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                background: #ffffff !important;
                background-color: #ffffff !important;
              }
              .bulk-slip-sheet:last-child {
                page-break-after: avoid;
                break-after: avoid;
              }
              img.bulk-slip-img {
                max-width: ${printOrientation === 'landscape' ? '281mm' : '194mm'};
                max-height: ${printOrientation === 'landscape' ? '194mm' : '280mm'};
                width: auto;
                height: auto;
                display: block;
                margin: 0 auto;
                object-fit: contain;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                background: #ffffff !important;
                background-color: #ffffff !important;
              }
            </style>
          </head>
          <body style="background: #ffffff !important; background-color: #ffffff !important;">
            ${pagesHtml}
          </body>
        </html>
      `);
      iframeDoc.close();

      const triggerPrint = () => {
        try {
          printIframe.contentWindow?.focus();
          printIframe.contentWindow?.print();
        } catch (e) {
          console.warn('Iframe print failed, falling back to window print', e);
          window.print();
        } finally {
          setRenderingRecord(null);
          setIsGenerating(false);
        }
      };

      const imgs = Array.from(iframeDoc.images);
      if (imgs.length === 0 || imgs.every((img) => img.complete)) {
        setTimeout(triggerPrint, 350);
      } else {
        let loaded = 0;
        imgs.forEach((img) => {
          img.onload = img.onerror = () => {
            loaded++;
            if (loaded >= imgs.length) {
              setTimeout(triggerPrint, 350);
            }
          };
        });
        setTimeout(triggerPrint, 1200);
      }
    } catch (err: any) {
      console.error('Print Error:', err);
      setActionError(err?.message || 'Print job failed. Please try again.');
      setRenderingRecord(null);
      setIsGenerating(false);
    }
  };

  /**
   * Load chosen record into main editor
   */
  const handleOpenRecordInEditor = (rec: BulkSlipRecord) => {
    if (onLoadRecordIntoEditor) {
      onLoadRecordIntoEditor(rec, activeBankId, activeSlipType);
    }
    onClose();
  };

  const selectedRecord =
    selectedRecordIndex !== null && validationResult?.records
      ? validationResult.records[selectedRecordIndex]
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 font-sans">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[94vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl text-white flex items-center justify-center shadow-md font-black text-xs shrink-0"
              style={{ backgroundColor: activeBank.primaryColor || '#0C2340' }}
            >
              {activeBank.shortCode}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 leading-tight">
                  {activeBank.name} — Bulk Slip Generator
                </h2>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase tracking-wider">
                  Max 25 Rows
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Official Form:{' '}
                <span className="font-semibold text-slate-700">{getSlipTitle()}</span> &bull; 100%
                Client-Side Privacy
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          {/* STEP 0: SELECT BANK & SLIP TYPE */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2.5 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center text-[10px] font-black">
                  ✓
                </span>
                <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Select Bank &amp; Form to Generate:
                </span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-blue-700">
                Selected: {getSlipTitle()}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-0.5">
              {/* SBI Option Cards */}
              <div className="bg-white border border-slate-200 rounded-xl p-2.5 space-y-1.5 shadow-2xs">
                <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
                  <span className="w-5 h-5 rounded-md bg-[#0C2340] text-white flex items-center justify-center text-[10px] font-black">
                    SBI
                  </span>
                  <span className="text-xs font-bold text-slate-900">State Bank of India</span>
                </div>
                <div className="grid grid-cols-1 gap-1">
                  <button
                    type="button"
                    onClick={() => handleSwitchForm('sbi', 'deposit')}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                      activeBankId === 'sbi' && activeSlipType === 'deposit'
                        ? 'bg-[#0C2340] text-white shadow-2xs'
                        : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <span>Cash &amp; Cheque Pay-in Slip</span>
                    <span className="text-[9px] uppercase font-mono opacity-80">100999131-V3</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchForm('sbi', 'neft_rtgs')}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                      activeBankId === 'sbi' && activeSlipType === 'neft_rtgs'
                        ? 'bg-[#0C2340] text-white shadow-2xs'
                        : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <span>RTGS / NEFT Remittance Slip</span>
                    <span className="text-[9px] uppercase font-mono opacity-80">V2</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchForm('sbi', 'demand_draft')}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                      activeBankId === 'sbi' && activeSlipType === 'demand_draft'
                        ? 'bg-[#0C2340] text-white shadow-2xs'
                        : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <span>Demand Draft (DD) Application</span>
                    <span className="text-[9px] uppercase font-mono opacity-80">CC-5003234</span>
                  </button>
                </div>
              </div>

              {/* HDFC Option Cards */}
              <div className="bg-white border border-slate-200 rounded-xl p-2.5 space-y-1.5 shadow-2xs">
                <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
                  <span className="w-5 h-5 rounded-md bg-[#004c8f] text-white flex items-center justify-center text-[10px] font-black">
                    HDFC
                  </span>
                  <span className="text-xs font-bold text-slate-900">HDFC Bank</span>
                </div>
                <div className="grid grid-cols-1 gap-1">
                  <button
                    type="button"
                    onClick={() => handleSwitchForm('hdfc', 'hdfc_deposit')}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                      activeBankId === 'hdfc' && activeSlipType === 'hdfc_deposit'
                        ? 'bg-[#004c8f] text-white shadow-2xs'
                        : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <span>Cash &amp; Cheque Pay-in Slip</span>
                    <span className="text-[9px] uppercase font-mono opacity-80">RMTL 9328</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchForm('hdfc', 'hdfc_neft')}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                      activeBankId === 'hdfc' && activeSlipType === 'hdfc_neft'
                        ? 'bg-[#004c8f] text-white shadow-2xs'
                        : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <span>RTGS / NEFT Remittance Form</span>
                    <span className="text-[9px] uppercase font-mono opacity-80">Code 92929</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchForm('hdfc', 'hdfc_dd')}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                      activeBankId === 'hdfc' && activeSlipType === 'hdfc_dd'
                        ? 'bg-[#004c8f] text-white shadow-2xs'
                        : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <span>Demand Draft (DD) Application</span>
                    <span className="text-[9px] uppercase font-mono opacity-80">Against Chq</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Action Error Banner */}
          {actionError && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-900 flex items-start gap-2.5 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <span className="font-bold">Generation Error:</span>
                <p>{actionError}</p>
              </div>
              <button
                type="button"
                onClick={() => setActionError(null)}
                className="text-red-700 hover:text-red-900 font-bold underline cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Progress Overlay if Generating */}
          {isGenerating && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between text-xs font-bold text-blue-900">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  {progressMsg}
                </span>
                <span>{progressPercent}%</span>
              </div>
              <div className="w-full h-2 bg-blue-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-150"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Step 1 (Download Template) & Step 2 (Upload Completed File) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Step 1: Download Template */}
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between space-y-2">
              <div>
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500 mb-1">
                  <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-800 flex items-center justify-center text-[10px] font-black">
                    1
                  </span>
                  <span>Download Excel Template</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Download the official <strong>{activeBank.shortCode}</strong> spreadsheet template
                  formatted specifically for <strong>{getSlipTitle()}</strong> with column
                  guidelines and up to 25 rows.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="w-full mt-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs border border-slate-300 transition flex items-center justify-center gap-2 shadow-2xs cursor-pointer"
              >
                <Download className="w-4 h-4 text-emerald-600" />
                <span>Download .XLSX Template</span>
              </button>
            </div>

            {/* Step 2: Upload Excel / CSV */}
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between space-y-2">
              <div>
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500 mb-1">
                  <span className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-800 flex items-center justify-center text-[10px] font-black">
                    2
                  </span>
                  <span>Upload Completed Sheet</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Upload your completed Excel (.xlsx, .xls) or CSV sheet. Maximum 25 records per
                  upload. Processed 100% privately in your browser.
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                className="hidden"
                id="bulk-excel-input"
              />
              <button
                type="button"
                disabled={isParsing}
                onClick={() => fileInputRef.current?.click()}
                className="w-full mt-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isParsing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Parsing Spreadsheet...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Select &amp; Validate File</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Validation Error Banner */}
          {validationResult && !validationResult.success && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-900 flex items-start gap-3 animate-in fade-in">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <strong className="font-bold">File Rejected:</strong>
                <p>{validationResult.error}</p>
              </div>
            </div>
          )}

          {/* Validation Success & Record Summary Table */}
          {validationResult && validationResult.success && (
            <div className="space-y-4 animate-in fade-in">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Total Records</div>
                  <div className="text-lg font-black text-slate-800">
                    {validationResult.totalRecords} / 25
                  </div>
                </div>
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                  <div className="text-[10px] font-bold text-emerald-600 uppercase">Valid Records</div>
                  <div className="text-lg font-black text-emerald-700">
                    {validationResult.validRecords}
                  </div>
                </div>
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-center">
                  <div className="text-[10px] font-bold text-red-600 uppercase">Invalid Records</div>
                  <div className="text-lg font-black text-red-700">
                    {validationResult.invalidRecords}
                  </div>
                </div>
                <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-center">
                  <div className="text-[10px] font-bold text-blue-600 uppercase">Bank Standard</div>
                  <div className="text-xs font-bold text-blue-800 mt-1 flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Exact Replica</span>
                  </div>
                </div>
              </div>

              {/* Records Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <div className="p-3 bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Parsed Bank Slips ({validationResult.totalRecords} records)</span>
                  <span className="text-[11px] font-normal text-slate-500">
                    Click any record to inspect authentic bank slip preview
                  </span>
                </div>
                <div className="max-h-52 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">#</th>
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3">Account No</th>
                        <th className="py-2 px-3">Name</th>
                        <th className="py-2 px-3">Amount (₹)</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {validationResult.records.map((rec, i) => (
                        <tr
                          key={rec.rowNumber}
                          onClick={() => setSelectedRecordIndex(i)}
                          className={`hover:bg-slate-50 transition cursor-pointer ${
                            selectedRecordIndex === i ? 'bg-blue-50/70 font-semibold' : ''
                          }`}
                        >
                          <td className="py-2 px-3 font-mono font-bold text-slate-500">
                            {rec.rowNumber}
                          </td>
                          <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                            {rec.date}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-800">
                            {rec.accountNo || '—'}
                          </td>
                          <td className="py-2 px-3 text-slate-800 truncate max-w-[150px]">
                            {rec.name || '—'}
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                            ₹{rec.amount.toLocaleString('en-IN')}
                          </td>
                          <td className="py-2 px-3">
                            {rec.isValid ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Valid
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                                <AlertTriangle className="w-3 h-3 text-red-600" />
                                Error
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenRecordInEditor(rec);
                              }}
                              className="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] border border-blue-200 transition cursor-pointer inline-flex items-center gap-1"
                              title="Load this record into the interactive canvas replica"
                            >
                              <span>Edit</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Selected Record Live Bank Slip Preview Callout */}
              {selectedRecord && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-2">
                  <div className="flex items-center justify-between font-bold text-slate-800">
                    <span className="flex items-center gap-1.5">
                      <Eye className="w-4 h-4 text-blue-600" />
                      Official Bank Replica Preview &bull; Record #{selectedRecord.rowNumber} (
                      {selectedRecord.name || selectedRecord.accountNo})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenRecordInEditor(selectedRecord)}
                      className="text-blue-600 hover:text-blue-800 font-bold text-xs inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>Open in Full Editor</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Scaled-down visual confirmation container */}
                  <div className="w-full bg-slate-100/80 rounded-xl border border-slate-200 p-2 overflow-x-auto flex justify-center shadow-inner">
                    <div
                      style={{
                        transform: isPortraitFixed ? 'scale(0.38)' : 'scale(0.48)',
                        transformOrigin: 'top center',
                        marginBottom: isPortraitFixed ? '-840px' : '-310px',
                        pointerEvents: 'none',
                        userSelect: 'none',
                      }}
                    >
                      {renderReplicaForRecord(selectedRecord, activeBankId, activeSlipType)}
                    </div>
                  </div>
                </div>
              )}

              {/* Orientation Option & Bulk Generation Actions */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200">
                {/* Print & PDF Orientation Selector */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-slate-600">Orientation:</span>
                  {isPortraitFixed ? (
                    <span className="px-3 py-1 rounded-lg font-bold bg-blue-50 text-[#004c8f] border border-blue-200">
                      A4 Portrait (Official Bank Standard)
                    </span>
                  ) : (
                    <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setOrientation('landscape')}
                        className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                          orientation === 'landscape'
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="Landscape mode matches the official Indian bank deposit slip horizontal voucher format"
                      >
                        <span>Landscape (Bank Standard)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setOrientation('portrait')}
                        className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                          orientation === 'portrait'
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="Portrait vertical page mode"
                      >
                        <span>Portrait</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Inline Action Error Notification if any */}
                {actionError && (
                  <div className="w-full p-3 rounded-xl bg-red-50 border border-red-300 text-xs text-red-900 flex items-center justify-between gap-2 animate-in fade-in">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                      <span>{actionError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActionError(null)}
                      className="text-red-700 underline font-bold cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {/* Bulk Action Buttons */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    disabled={validationResult.validRecords === 0 || isGenerating}
                    onClick={handleGenerateCombinedPdf}
                    className="px-5 py-2 rounded-full bg-[#18181B] hover:bg-black text-white font-bold text-xs transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                    title="Generate 1 combined PDF with all valid vouchers in bank standard format"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Download Combined PDF ({validationResult.validRecords})</span>
                  </button>

                  <button
                    type="button"
                    disabled={validationResult.validRecords === 0 || isGenerating}
                    onClick={handleGenerateZip}
                    className="px-5 py-2 rounded-full bg-[#FFE870] hover:bg-[#FDD835] text-neutral-950 border border-neutral-900/20 font-bold text-xs transition flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
                    title="Download a ZIP archive containing individual PDFs for each record"
                  >
                    <Archive className="w-4 h-4 text-neutral-950" />
                    <span>Download ZIP of PDFs</span>
                  </button>

                  <button
                    type="button"
                    disabled={validationResult.validRecords === 0 || isGenerating}
                    onClick={handlePrintAll}
                    className="px-5 py-2 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-900 border border-stone-300 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    title="Batch print all vouchers directly in selected orientation"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print All Slips</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-stone-200 bg-[#FAF8F5] flex items-center justify-between text-xs text-stone-600">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-stone-400 shrink-0" />
            <span>
              Zero server data transmission: All parsing &amp; authentic vector compilation runs
              100% locally in your browser.
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-1.5 rounded-full bg-white hover:bg-stone-100 text-stone-700 font-bold border border-stone-300 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {/* ISOLATED SINGLE RECORD RASTERIZER
          Renders exactly ONE record at a time when renderingRecord is set.
          Zero duplicate IDs, zero z-index conflicts, and zero DOM layout clipping! */}
      {renderingRecord && (
        <div
          id="bulk-active-capture-node"
          aria-hidden="true"
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            width: `${getReplicaDimensions(activeSlipType).width}px`,
            height: `${getReplicaDimensions(activeSlipType).height}px`,
            backgroundColor: '#ffffff',
            zIndex: 10005,
            overflow: 'hidden',
            pointerEvents: 'none',
          }}
        >
          {renderReplicaForRecord(renderingRecord, activeBankId, activeSlipType)}
        </div>
      )}

      {/* Dedicated Full-Screen Generation Overlay during batch PDF/print export */}
      {isGenerating && (
        <div className="fixed inset-0 z-[10000] bg-slate-950/90 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 text-center space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center mx-auto text-blue-600 shadow-inner">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Generating Official Bank Slips
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                {progressMsg}
              </p>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden p-0.5 border border-slate-200">
              <div
                className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full rounded-full transition-all duration-200"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
              <span>{activeBank.name}</span>
              <span className="text-blue-700 font-mono">{progressPercent}% Completed</span>
            </div>
            <p className="text-[10px] text-slate-400">
              Zero Server Transmission &bull; Exact Bank Standard Replicas
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
