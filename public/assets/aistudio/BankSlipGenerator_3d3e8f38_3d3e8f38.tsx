import React, { useEffect, useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  Building2,
  Calculator,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Coins,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  Info,
  Landmark,
  Minus,
  Plus,
  Printer,
  RotateCcw,
  Send,
  Trash2,
} from 'lucide-react';
import {
  BankFormState,
  BankFormType,
  BankId,
  PreviewMode,
  SBI_DD_DENOMS,
  UnifiedChequeItem,
  createInitialBankFormState,
  fmtIn,
  renderBankSlip,
} from '../../utils/bankSlipRenderers';
import { numberToWordsIndian } from '../../utils/numberToWords';
import { BulkSlipRecord, bulkRecordToBankFormState } from '../../utils/excelBulkEngine';
import { BulkSlipModal } from './BulkSlipModal';
import {
  AdRectanglePair,
  ResponsiveAdBanner,
  SmartlinkBanner,
} from '../ads/AdSlot';
import { ContextualAdWidget } from '../ads/ContextualAdWidget';
import { BankDepositSlipArticle } from '../articles/BankDepositSlipArticle';

interface BankSlipGeneratorProps {
  onBack: () => void;
  initialBank?: BankId;
  initialForm?: BankFormType;
  openBulkOnNavigate?: boolean;
  navigationNonce?: number;
}

const MAX_CHEQUES = 5;
const DEPOSIT_LEDGER_DENOMS = [500, 200, 100, 50, 20, 10, 5, 2, 1, 2000] as const;

const DENOM_STYLES: Record<number, { badge: string; bar: string; hint?: string }> = {
  500: {
    badge: 'bg-stone-100 border-stone-300 text-stone-800',
    bar: 'bg-stone-600',
  },
  200: {
    badge: 'bg-amber-50 border-amber-300 text-amber-900',
    bar: 'bg-amber-500',
  },
  100: {
    badge: 'bg-purple-50 border-purple-300 text-purple-900',
    bar: 'bg-purple-500',
  },
  50: {
    badge: 'bg-cyan-50 border-cyan-300 text-cyan-900',
    bar: 'bg-cyan-500',
  },
  20: {
    badge: 'bg-lime-50 border-lime-300 text-lime-900',
    bar: 'bg-lime-600',
  },
  10: {
    badge: 'bg-orange-50 border-orange-300 text-orange-900',
    bar: 'bg-orange-500',
  },
  5: {
    badge: 'bg-emerald-50 border-emerald-300 text-emerald-900',
    bar: 'bg-emerald-500',
  },
  2: {
    badge: 'bg-slate-100 border-slate-300 text-slate-800',
    bar: 'bg-slate-500',
  },
  1: {
    badge: 'bg-slate-100 border-slate-300 text-slate-800',
    bar: 'bg-slate-400',
  },
  2000: {
    badge: 'bg-fuchsia-50 border-fuchsia-300 text-fuchsia-900',
    bar: 'bg-fuchsia-500',
    hint: 'Optional',
  },
};

const OFFICIAL_BANK_FORM_ASSETS: Record<
  BankId,
  Record<BankFormType, { url: string; downloadName: string; label: string }>
> = {
  sbi: {
    deposit: {
      url: '/assets/aistudio/SBI_Deposit_Slip_d229134c.pdf',
      downloadName: 'SBI_Official_Blank_Deposit_Slip.pdf',
      label: 'Original Blank PDF',
    },
    dd: {
      url: '/assets/aistudio/sbi-dd-application-form-slip_a8473198.webp',
      downloadName: 'SBI_Official_Blank_DD_Form.webp',
      label: 'Original Blank Scan',
    },
    rtgs: {
      url: '/assets/aistudio/SBI_NEFT-RTGS-CHALLAN-FILLABLE_8fc1e067.pdf',
      downloadName: 'SBI_Official_Blank_RTGS_NEFT_Form.pdf',
      label: 'Original Blank PDF',
    },
  },
  hdfc: {
    deposit: {
      url: '/assets/aistudio/HDFC_Deposit_Slip_3875c28c.pdf',
      downloadName: 'HDFC_Official_Blank_Deposit_Slip.pdf',
      label: 'Original Blank PDF',
    },
    dd: {
      url: '/assets/aistudio/HDFC_DD_d4e29523.pdf',
      downloadName: 'HDFC_Official_Blank_DD_Form.pdf',
      label: 'Original Blank PDF',
    },
    rtgs: {
      url: '/assets/aistudio/HDFC_RTGS_NEFT_5e695fde.pdf',
      downloadName: 'HDFC_Official_Blank_RTGS_NEFT_Form.pdf',
      label: 'Original Blank PDF',
    },
  },
};

export const BankSlipGenerator: React.FC<BankSlipGeneratorProps> = ({
  onBack,
  initialBank,
  initialForm,
  openBulkOnNavigate,
  navigationNonce,
}) => {
  const [selectedBank, setSelectedBank] = useState<BankId>(initialBank || 'sbi');
  const [formType, setFormType] = useState<BankFormType>(initialForm || 'deposit');
  const [formState, setFormState] = useState<BankFormState>(() => createInitialBankFormState());
  const [visibleCheques, setVisibleCheques] = useState<number>(1);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('full');
  const [includeReverse, setIncludeReverse] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const [showOptionalDetails, setShowOptionalDetails] = useState<boolean>(false);
  const [showHdfcRtgsCompliance, setShowHdfcRtgsCompliance] = useState<boolean>(false);
  const [showBulkModal, setShowBulkModal] = useState<boolean>(Boolean(openBulkOnNavigate));
  const [targetSplitAmount, setTargetSplitAmount] = useState<string>('');
  const [copiedWords, setCopiedWords] = useState<boolean>(false);

  const noteInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const previewStageRef = useRef<HTMLDivElement | null>(null);
  const [stageWidth, setStageWidth] = useState<number>(1000);

  useEffect(() => {
    if (!navigationNonce) return;
    if (initialBank) setSelectedBank(initialBank);
    if (initialForm) setFormType(initialForm);
    if (openBulkOnNavigate) {
      setShowBulkModal(true);
    }
  }, [navigationNonce, initialBank, initialForm, openBulkOnNavigate]);

  const output = useMemo(
    () => renderBankSlip(selectedBank, formType, formState),
    [selectedBank, formType, formState]
  );

  // Measure preview stage width responsively so scaled sheet fits cleanly
  useEffect(() => {
    const el = previewStageRef.current;
    if (!el) return;

    const updateWidth = () => {
      const w = el.clientWidth;
      if (w > 0) setStageWidth(w);
    };

    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);
    window.addEventListener('resize', updateWidth);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, []);

  // Inject dynamic @page portrait/landscape and print zoom rules for active form
  useEffect(() => {
    const styleId = 'bank-slip-print-page-style';
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    const portraitWrapWidth = output.width === 850 ? '645px' : '649px';
    const zoomFactor = output.orientation === 'landscape' ? '0.6773' : '0.7585';

    styleEl.textContent = `
      @page {
        size: A4 ${output.orientation};
        margin: 8mm;
      }
      @media print {
        body {
          background: #ffffff !important;
        }
        .bank-slip-printable .bank-slip-sheet-wrap {
          width: ${output.orientation === 'portrait' ? portraitWrapWidth : 'auto'} !important;
          height: auto !important;
          margin: ${output.orientation === 'portrait' ? '0 auto' : '0'} !important;
          background: #ffffff !important;
        }
        .bank-slip-printable .bank-slip {
          transform: none !important;
          zoom: ${zoomFactor} !important;
        }
      }
    `;

    return () => {
      const existing = document.getElementById(styleId);
      if (existing) existing.remove();
    };
  }, [output.orientation, output.width]);

  const previewScale = useMemo(() => {
    const available = Math.max(280, stageWidth - 16);
    return Math.min(1, available / output.width);
  }, [stageWidth, output.width]);

  const updateField = <K extends keyof BankFormState>(key: K, value: BankFormState[K]) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
  };

  const updateNoteCount = (denom: number, value: string) => {
    const clean = value.replace(/[^0-9]/g, '');
    setFormState((prev) => ({
      ...prev,
      notes: {
        ...prev.notes,
        [denom]: clean,
      },
    }));
  };

  const updateChequeField = (
    index: number,
    field: keyof UnifiedChequeItem,
    value: string
  ) => {
    setFormState((prev) => {
      const nextCheques = [...prev.cheques];
      nextCheques[index] = {
        ...nextCheques[index],
        [field]: value,
      };
      return { ...prev, cheques: nextCheques };
    });
  };

  const handleRemoveChequeRow = (idx: number) => {
    setFormState((prev) => {
      const populated = prev.cheques.filter((_, i) => i !== idx);
      while (populated.length < MAX_CHEQUES) {
        populated.push({ bankBranch: '', city: '', chequeNo: '', date: '', amount: '' });
      }
      return { ...prev, cheques: populated };
    });
    setVisibleCheques((c) => Math.max(1, c - 1));
  };

  const handleDepositModeChange = (mode: 'cash' | 'cheque' | 'both') => {
    setFormState((prev) => ({
      ...prev,
      depositMode: mode,
      hdfcDepositType:
        prev.accountType === 'loan'
          ? 'loan'
          : prev.accountType === 'cc'
          ? 'cc'
          : mode === 'cheque'
          ? prev.hdfcDepositType === 'out'
            ? 'out'
            : 'local'
          : 'cash',
    }));
  };

  const handleAccountTypeChange = (
    nextType: BankFormState['accountType']
  ) => {
    setFormState((prev) => ({
      ...prev,
      accountType: nextType,
      loanTicked: nextType === 'loan',
      hdfcDepositType:
        nextType === 'loan'
          ? 'loan'
          : nextType === 'cc'
          ? 'cc'
          : prev.depositMode === 'cheque'
          ? 'local'
          : 'cash',
    }));
  };

  const stepNoteCount = (denom: number, delta: number) => {
    setFormState((prev) => {
      const current = parseInt(prev.notes[denom] || '0', 10) || 0;
      const next = Math.max(0, current + delta);
      return {
        ...prev,
        notes: {
          ...prev.notes,
          [denom]: next > 0 ? String(next) : '',
        },
      };
    });
  };

  const handleNoteKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, denom: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const idx = DEPOSIT_LEDGER_DENOMS.indexOf(denom as (typeof DEPOSIT_LEDGER_DENOMS)[number]);
      if (idx >= 0 && idx < DEPOSIT_LEDGER_DENOMS.length - 1) {
        const nextKey = String(DEPOSIT_LEDGER_DENOMS[idx + 1]);
        noteInputRefs.current[nextKey]?.focus();
      } else {
        noteInputRefs.current['coins']?.focus();
      }
    }
  };

  const handleClearCashOnly = () => {
    setFormState((prev) => ({
      ...prev,
      notes: {
        2000: '',
        1000: '',
        500: '',
        200: '',
        100: '',
        50: '',
        20: '',
        10: '',
        5: '',
        2: '',
        1: '',
      },
      coins: '',
    }));
    setTargetSplitAmount('');
    setStatusMessage('Cleared cash denominations and coins.');
  };

  const handleAutoSplitDepositCash = () => {
    const raw = parseFloat(targetSplitAmount);
    if (!Number.isFinite(raw) || raw <= 0) {
      setStatusMessage('Enter a positive rupee target to auto-split into notes.');
      return;
    }
    const wholeRupees = Math.floor(raw);
    const paise = Math.round((raw - wholeRupees) * 100);
    let rem = wholeRupees;
    const nextNotes: Record<number, string> = {
      2000: '',
      1000: '',
      500: '',
      200: '',
      100: '',
      50: '',
      20: '',
      10: '',
      5: '',
      2: '',
      1: '',
    };
    [500, 200, 100, 50, 20, 10, 5, 2, 1].forEach((d) => {
      const cnt = Math.floor(rem / d);
      nextNotes[d] = cnt > 0 ? String(cnt) : '';
      rem %= d;
    });
    setFormState((prev) => ({
      ...prev,
      notes: nextNotes,
      coins: paise > 0 ? (paise / 100).toFixed(2) : '',
    }));
    setStatusMessage(
      `Auto-split ₹${raw.toLocaleString('en-IN', {
        maximumFractionDigits: 2,
      })} across Indian currency denominations.`
    );
  };

  const handleCopyWords = async () => {
    if (!amountWordsText) return;
    try {
      await navigator.clipboard.writeText(amountWordsText);
      setCopiedWords(true);
      window.setTimeout(() => setCopiedWords(false), 1800);
    } catch {
      setStatusMessage('Copy failed — browser clipboard permission denied.');
    }
  };

  const handleConfirmClear = () => {
    setFormState(createInitialBankFormState());
    setVisibleCheques(1);
    setTargetSplitAmount('');
    setShowClearConfirm(false);
    setStatusMessage('All fields cleared.');
  };

  const handleAutoFillSbiDdNotes = () => {
    const total = output.grandTotal;
    if (total <= 0) return;
    const whole = Math.floor(total);
    const paise = Math.round((total - whole) * 100);
    let rem = whole;
    const nextNotes: Record<number, string> = {
      2000: '',
      1000: '',
      500: '',
      200: '',
      100: '',
      50: '',
      20: '',
      10: '',
      5: '',
      2: '',
      1: '',
    };
    SBI_DD_DENOMS.forEach((d) => {
      const cnt = Math.floor(rem / d);
      nextNotes[d] = cnt > 0 ? String(cnt) : '';
      rem %= d;
    });
    setFormState((prev) => ({
      ...prev,
      notes: nextNotes,
      coins: paise > 0 ? (paise / 100).toFixed(2) : '',
    }));
    setStatusMessage(`Auto-allocated ₹${fmtIn(total)} into SBI DD note denominations.`);
  };

  const handleLoadRecordIntoEditor = (
    rec: BulkSlipRecord,
    bId: BankId,
    fType: BankFormType
  ) => {
    const nextState = bulkRecordToBankFormState(rec, bId, fType);
    setSelectedBank(bId);
    setFormType(fType);
    setFormState(nextState);
    const activeChequesCount = nextState.cheques.filter(
      (c) => c.chequeNo || c.bankBranch || c.amount
    ).length;
    setVisibleCheques(Math.max(1, activeChequesCount));
    setStatusMessage(
      `Loaded Bulk Row #${rec.rowNumber} (${rec.name || rec.accountNo || 'Slip'}) into editor.`
    );
  };

  const handlePrint = () => {
    setStatusMessage(`Opening print preview (A4 ${output.orientation})...`);
    window.print();
  };

  const renderOffscreenToPng = async (html: string, fontCls: string): Promise<string> => {
    const stage = document.createElement('div');
    stage.style.position = 'fixed';
    stage.style.left = '-100000px';
    stage.style.top = '0';
    stage.style.width = `${output.width}px`;
    stage.style.height = `${output.height}px`;
    stage.style.background = '#ffffff';
    stage.style.pointerEvents = 'none';

    const slip = document.createElement('div');
    slip.className = `bank-slip ${fontCls} ${previewMode === 'data' ? 'dataonly' : ''}`;
    slip.style.width = `${output.width}px`;
    slip.style.height = `${output.height}px`;
    slip.style.transform = 'none';
    slip.innerHTML = html;

    stage.appendChild(slip);
    document.body.appendChild(stage);

    try {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
      const canvas = await html2canvas(slip, {
        scale: 3,
        backgroundColor: '#ffffff',
        width: output.width,
        height: output.height,
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
        useCORS: true,
      });
      return canvas.toDataURL('image/png');
    } finally {
      document.body.removeChild(stage);
    }
  };

  const handleDownloadPdf = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setStatusMessage('Generating exact-scale PDF...');

    try {
      const frontImg = await renderOffscreenToPng(output.frontHtml, output.fontClass);
      const images = [frontImg];

      if (includeReverse && output.backHtml) {
        const backFont = output.backFontClass ?? output.fontClass;
        const backImg = await renderOffscreenToPng(output.backHtml, backFont);
        images.push(backImg);
      }

      const pdf = new jsPDF({
        orientation: output.orientation,
        unit: 'mm',
        format: 'a4',
      });

      images.forEach((img, index) => {
        if (index > 0) pdf.addPage();
        if (output.orientation === 'landscape') {
          const wMm = 281;
          const hMm = (wMm * output.height) / output.width;
          pdf.addImage(img, 'PNG', 8, 8, wMm, hMm);
        } else {
          const hMm = 281;
          const wMm = (hMm * output.width) / output.height;
          pdf.addImage(img, 'PNG', (210 - wMm) / 2, 8, wMm, hMm);
        }
      });

      pdf.save(output.pdfFilename);
      setStatusMessage(`Downloaded ${output.pdfFilename}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatusMessage(`Could not create PDF: ${message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const officialFormAsset = OFFICIAL_BANK_FORM_ASSETS[selectedBank][formType];
  const amountWordsText =
    output.grandTotal > 0 ? numberToWordsIndian(output.grandTotal) : '';
  const ddCashMismatch =
    selectedBank === 'sbi' && formType === 'dd' && Boolean(output.warning);
  const showCashCounter =
    formType === 'deposit' &&
    (formState.depositMode === 'cash' || formState.depositMode === 'both');
  const showChequeCounter =
    formType === 'deposit' &&
    (formState.depositMode === 'cheque' || formState.depositMode === 'both');

  const cashStats = useMemo(() => {
    let totalNotes = 0;
    let activeDenoms = 0;
    DEPOSIT_LEDGER_DENOMS.forEach((d) => {
      const cnt = parseInt(formState.notes[d] || '0', 10) || 0;
      if (cnt > 0) {
        totalNotes += cnt;
        activeDenoms += 1;
      }
    });
    const coinsVal = parseFloat(formState.coins) > 0 ? parseFloat(formState.coins) : 0;
    if (coinsVal > 0) activeDenoms += 1;
    return { totalNotes, activeDenoms, coinsVal };
  }, [formState.notes, formState.coins]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 font-sans print:max-w-none print:p-0 print:m-0">
      {/* Top Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-200 no-print">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to All Tools</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Bank Deposit Slip, DD &amp; RTGS / NEFT Forms
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
                  BETA · v1.0.0
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">
                <span>SBI &amp; HDFC Bank Suite</span>
                <span aria-hidden="true">·</span>
                <span>Single &amp; Bulk Excel (Max 25)</span>
                <span aria-hidden="true">·</span>
                <span>A4 Print &amp; PDF</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowBulkModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-950 bg-amber-300 hover:bg-amber-400 border border-amber-400/80 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Bulk Excel</span>
          </button>

          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-rose-700 bg-white hover:bg-rose-50 border border-slate-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span>Print (A4)</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isExporting}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-950 hover:bg-slate-800 disabled:opacity-60 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Preparing PDF...' : 'Download PDF'}</span>
          </button>
        </div>
      </div>

      {/* Safety Notice & Beta Advisory Strip */}
      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 no-print">
        <div className="flex items-start sm:items-center gap-2">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
          <span>
            <strong>BETA v1.0.0 Notice &amp; Safety Protocol:</strong> Verify account numbers &amp; denomination sums prior to printing. Ensure the bank teller affixes an official branch stamp and signature on your counterfoil. Cash deposits exceeding ₹50,000 require quoting a valid PAN under Rule 114B. Sec 269ST restricts single-day cash receipt to ₹2,00,000.
          </span>
        </div>
        <span className="text-[11px] font-semibold text-amber-800/80 whitespace-nowrap shrink-0">
          100% Client-Side Sandbox
        </span>
      </div>

      {/* Form Switcher Strip */}
      <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
        <div className="inline-flex flex-wrap sm:flex-nowrap items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-xl w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setFormType('deposit')}
            className={`flex-1 sm:flex-initial px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
              formType === 'deposit'
                ? 'bg-slate-950 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Banknote className="w-3.5 h-3.5" />
            <span>Deposit Slip</span>
          </button>
          <button
            type="button"
            onClick={() => setFormType('dd')}
            className={`flex-1 sm:flex-initial px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
              formType === 'dd'
                ? 'bg-slate-950 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>DD / Banker&apos;s Cheque</span>
          </button>
          <button
            type="button"
            onClick={() => setFormType('rtgs')}
            className={`flex-1 sm:flex-initial px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
              formType === 'rtgs'
                ? 'bg-slate-950 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>RTGS / NEFT</span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span>Active Form:</span>
          <strong className="text-slate-900">{output.title}</strong>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums text-slate-500">
            A4 {output.orientation}
          </span>
        </div>
      </div>

      {/* Inline Clear Confirmation */}
      {showClearConfirm && (
        <div className="mt-4 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-3 no-print">
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Reset all fields on this banking slip? Unsaved entries will be cleared.</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleConfirmClear}
              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold cursor-pointer whitespace-nowrap"
            >
              Yes, Clear All
            </button>
            <button
              type="button"
              onClick={() => setShowClearConfirm(false)}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold cursor-pointer whitespace-nowrap"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Inline Status Notice */}
      {statusMessage && (
        <div className="mt-4 px-4 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-800 flex items-center justify-between gap-3 no-print">
          <span className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
            {statusMessage}
          </span>
          <button
            type="button"
            onClick={() => setStatusMessage('')}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* TWO-COLUMN UNIVERSAL DATA ENTRY CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-5 items-stretch no-print">
        {/* LEFT CARD: BANK & ACCOUNT DETAILS */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-1">
              <Landmark className="w-4 h-4 text-blue-700 shrink-0" />
              <h2 className="text-sm font-bold text-slate-900">
                Bank &amp; Account Details
              </h2>
            </div>

            {/* Select Bank */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Select Bank
              </label>
              <select
                value={selectedBank}
                onChange={(e) => setSelectedBank(e.target.value as BankId)}
                className="w-full px-3.5 py-2.5 text-sm font-medium text-slate-900 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
              >
                <option value="sbi">State Bank of India</option>
                <option value="hdfc">HDFC Bank Ltd</option>
              </select>
            </div>

            {/* Branch Name & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Branch Name
                </label>
                <input
                  type="text"
                  value={formState.branch}
                  onChange={(e) => updateField('branch', e.target.value)}
                  placeholder="Branch name"
                  className="w-full px-3.5 py-2 text-xs sm:text-sm text-slate-900 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-slate-600">
                    {formType === 'deposit' ? 'Deposit Date' : 'Date'}
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      updateField('date', new Date().toISOString().split('T')[0])
                    }
                    className="text-[11px] font-semibold text-blue-700 hover:underline cursor-pointer"
                  >
                    Today
                  </button>
                </div>
                <input
                  type="date"
                  value={formState.date}
                  onChange={(e) => updateField('date', e.target.value)}
                  className="w-full px-3.5 py-2 text-xs sm:text-sm font-mono tabular-nums text-slate-900 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
                />
              </div>
            </div>

            {/* Account Holder Name */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                {formType === 'rtgs'
                  ? 'Remitter / Applicant Name *'
                  : formType === 'dd'
                  ? 'Purchaser / Applicant Name *'
                  : 'Account Holder Name *'}
              </label>
              <input
                type="text"
                value={formState.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="Full name as on bank records"
                className="w-full px-3.5 py-2 text-sm font-semibold text-slate-900 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
              />
            </div>

            {/* Account Number & Account Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-slate-600">
                    {formType === 'rtgs' ? 'Debit Account Number *' : 'Account Number *'}
                  </label>
                  {formState.accountNo.length > 0 && (
                    <span className="text-[10px] font-mono tabular-nums text-slate-400">
                      {formState.accountNo.length} digits
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={19}
                  value={formState.accountNo}
                  onChange={(e) =>
                    updateField('accountNo', e.target.value.replace(/\s+/g, ''))
                  }
                  placeholder={selectedBank === 'hdfc' ? '14-digit A/c No.' : '11–19 digit A/c No.'}
                  className="w-full px-3.5 py-2 text-sm font-mono font-bold tracking-wider text-slate-900 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Account Type
                </label>
                <select
                  value={formState.accountType}
                  onChange={(e) =>
                    handleAccountTypeChange(
                      e.target.value as BankFormState['accountType']
                    )
                  }
                  className="w-full px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-900 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
                >
                  <option value="current">Current Account</option>
                  <option value="savings">Savings Account</option>
                  <option value="overdraft">Overdraft (OD)</option>
                  <option value="cc">Cash Credit / Card</option>
                  <option value="loan">Loan Account</option>
                </select>
              </div>
            </div>

            {/* Depositor Name & Mobile Number */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Depositor Name
                </label>
                <input
                  type="text"
                  value={formState.depositorName}
                  onChange={(e) => updateField('depositorName', e.target.value)}
                  placeholder="Depositor / bearer name"
                  className="w-full px-3.5 py-2 text-xs sm:text-sm text-slate-900 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Mobile Number
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={formState.mobile}
                    onChange={(e) =>
                      updateField('mobile', e.target.value.replace(/[^0-9]/g, ''))
                    }
                    placeholder="10-digit mobile"
                    className="w-full px-3.5 py-2 pr-8 text-xs sm:text-sm font-mono tabular-nums text-slate-900 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
                  />
                  {formState.mobile.length === 10 && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 absolute right-2.5 top-2.5" />
                  )}
                </div>
              </div>
            </div>

            {/* Depositor PAN Number */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-600">
                  Depositor PAN Number (Mandatory for cash deposits ≥ ₹50,000)
                </label>
                {output.requiresPanAlert && !formState.pan && !formState.form60 && (
                  <span className="text-[11px] font-bold text-amber-700">
                    Required
                  </span>
                )}
              </div>
              <input
                type="text"
                maxLength={10}
                value={formState.pan}
                onChange={(e) => updateField('pan', e.target.value.toUpperCase())}
                placeholder="10-character PAN"
                className="w-full px-3.5 py-2 text-xs sm:text-sm font-mono font-bold uppercase text-slate-900 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
              />
            </div>

            {/* Rule 114B Alert + SBI Form 60 toggle */}
            {output.requiresPanAlert && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Rule 114B:</strong> Cash deposits of ₹50,000 or more require PAN{' '}
                    {selectedBank === 'sbi' ? 'or signed Form 60.' : 'number.'}
                  </span>
                </div>
                {selectedBank === 'sbi' && formType === 'deposit' && (
                  <label className="inline-flex items-center gap-2 font-medium text-amber-950 cursor-pointer pl-6">
                    <input
                      type="checkbox"
                      checked={formState.form60}
                      onChange={(e) => updateField('form60', e.target.checked)}
                      className="rounded border-amber-400 text-slate-900"
                    />
                    Tick Form 60 attached box on SBI slip
                  </label>
                )}
              </div>
            )}

            {/* Collapsible Optional Account / Bank Fields */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowOptionalDetails((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                {showOptionalDetails ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
                <span>
                  {showOptionalDetails ? 'Hide' : 'Show'} Optional Fields (Email, Address, Card/Loan, Branch Code)
                </span>
              </button>

              {showOptionalDetails && (
                <div className="mt-3 pt-3 border-t border-slate-200 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Landline / Tel No.
                      </label>
                      <input
                        type="tel"
                        value={formState.tel}
                        onChange={(e) => updateField('tel', e.target.value)}
                        placeholder="Optional landline"
                        className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        E-mail ID
                      </label>
                      <input
                        type="email"
                        value={formState.email}
                        onChange={(e) => updateField('email', e.target.value)}
                        placeholder="Email address"
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-slate-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Address / Customer Ref.
                    </label>
                    <input
                      type="text"
                      value={formState.address}
                      onChange={(e) => updateField('address', e.target.value)}
                      placeholder="Street, city or customer reference"
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-slate-900"
                    />
                  </div>

                  {selectedBank === 'sbi' && formType === 'rtgs' && (
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        SBI Branch Code (5-digit)
                      </label>
                      <input
                        type="text"
                        value={formState.branchCode}
                        onChange={(e) => updateField('branchCode', e.target.value)}
                        placeholder="5-digit branch code"
                        className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-slate-900"
                      />
                    </div>
                  )}

                  {selectedBank === 'hdfc' && formType === 'deposit' && (
                    <div className="space-y-3 pt-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            Credit Card No. (16)
                          </label>
                          <input
                            type="text"
                            maxLength={16}
                            value={formState.creditCardNo}
                            onChange={(e) =>
                              updateField(
                                'creditCardNo',
                                e.target.value.replace(/[^0-9]/g, '')
                              )
                            }
                            placeholder="16-digit card no."
                            className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            Loan Account No. (10)
                          </label>
                          <input
                            type="text"
                            maxLength={10}
                            value={formState.loanNo}
                            onChange={(e) => updateField('loanNo', e.target.value)}
                            placeholder="Optional loan A/c"
                            className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-slate-900"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            HDFC Special Category
                          </label>
                          <select
                            value={formState.hdfcSpecialType}
                            onChange={(e) =>
                              updateField(
                                'hdfcSpecialType',
                                e.target.value as BankFormState['hdfcSpecialType']
                              )
                            }
                            className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-slate-900"
                          >
                            <option value="">None</option>
                            <option value="nro">NRO Account</option>
                            <option value="div">Dividend / Interest Warrant</option>
                            <option value="rent">Rent / Pension / Asset Sale</option>
                          </select>
                        </div>
                        <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer pt-4">
                          <input
                            type="checkbox"
                            checked={formState.loanTicked}
                            onChange={(e) => updateField('loanTicked', e.target.checked)}
                            className="rounded border-slate-300 text-slate-900"
                          />
                          Tick Loan Account box
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Deposit Type Toggle Buttons (Shown on Deposit Slip) */}
          {formType === 'deposit' && (
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-xs font-medium text-slate-600 mb-2">
                Deposit Type
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleDepositModeChange('cash')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition cursor-pointer whitespace-nowrap ${
                    formState.depositMode === 'cash'
                      ? 'bg-slate-950 text-white border-slate-950'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  Cash Deposit
                </button>
                <button
                  type="button"
                  onClick={() => handleDepositModeChange('cheque')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition cursor-pointer whitespace-nowrap ${
                    formState.depositMode === 'cheque'
                      ? 'bg-slate-950 text-white border-slate-950'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  Cheque / Draft
                </button>
                <button
                  type="button"
                  onClick={() => handleDepositModeChange('both')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition cursor-pointer whitespace-nowrap ${
                    formState.depositMode === 'both'
                      ? 'bg-slate-950 text-white border-slate-950'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  Cash + Cheque
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT CARD: DENOMINATION COUNTER / CHEQUES / DD / RTGS */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-5">
          {/* DEPOSIT SLIP BODY */}
          {formType === 'deposit' && (
            <div className="space-y-6">
              {/* Cash Denomination Counter */}
              {showCashCounter && (
                <div className="space-y-3.5">
                  {/* Executive Counter Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                        <Coins className="w-4 h-4" aria-hidden="true" />
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-slate-900">
                          Currency Denomination Counter
                        </h2>
                        <p className="text-[11px] text-slate-500">
                          Step, bundle (+10), or auto-split any target cash sum
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 ml-auto">
                      <div className="text-right">
                        <div className="text-[11px] font-mono tabular-nums text-slate-500">
                          {cashStats.totalNotes.toLocaleString('en-IN')} notes ·{' '}
                          {cashStats.activeDenoms} active
                        </div>
                        <div
                          className={`text-base sm:text-lg font-bold font-mono tabular-nums ${
                            output.cashTotal > 0 ? 'text-emerald-700' : 'text-slate-700'
                          }`}
                        >
                          ₹
                          {output.cashTotal.toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleClearCashOnly}
                        disabled={output.cashTotal <= 0 && cashStats.totalNotes <= 0}
                        title="Clear cash denominations"
                        className="inline-flex items-center gap-1.5 min-h-[34px] px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 text-xs font-semibold text-slate-600 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                        <span className="hidden sm:inline">Clear</span>
                      </button>
                    </div>
                  </div>

                  {/* Smart Target Cash Auto-Splitter Bar */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                      <Calculator className="w-3.5 h-3.5 text-blue-600 shrink-0" aria-hidden="true" />
                      <span>Quick Auto-Split Target</span>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <div className="relative flex-1 sm:w-44">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono font-semibold text-slate-400">
                          ₹
                        </span>
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={targetSplitAmount}
                          onChange={(e) => setTargetSplitAmount(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAutoSplitDepositCash();
                            }
                          }}
                          placeholder="e.g. 48500"
                          aria-label="Target cash amount in rupees to auto-split"
                          className="w-full h-8 pl-6 pr-2.5 text-xs font-mono font-bold tabular-nums text-slate-900 rounded-lg border border-slate-300 bg-white focus:border-blue-600 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleAutoSplitDepositCash}
                        className="h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        Split Notes
                      </button>
                    </div>
                  </div>

                  {/* Structured Denomination Ledger Table */}
                  <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                    {/* Table Column Headers */}
                    <div className="grid grid-cols-12 items-center gap-2 bg-slate-50 border-b border-slate-200 px-3.5 py-2 text-[11px] font-semibold text-slate-500">
                      <div className="col-span-4 sm:col-span-3">Denomination</div>
                      <div className="col-span-5 sm:col-span-5">Quantity</div>
                      <div className="hidden sm:block sm:col-span-2">Share</div>
                      <div className="col-span-3 sm:col-span-2 text-right">Subtotal</div>
                    </div>

                    {/* Banknote Rows */}
                    <div className="divide-y divide-slate-100">
                      {DEPOSIT_LEDGER_DENOMS.map((denom) => {
                        const count = parseInt(formState.notes[denom] || '0', 10) || 0;
                        const subtotal = count * denom;
                        const sharePct =
                          output.cashTotal > 0 ? Math.min(100, (subtotal / output.cashTotal) * 100) : 0;
                        const style = DENOM_STYLES[denom];

                        return (
                          <div
                            key={denom}
                            className={`grid grid-cols-12 items-center gap-2 px-3.5 py-1.5 transition-colors ${
                              count > 0 ? 'bg-emerald-50/35' : 'hover:bg-slate-50/70'
                            }`}
                          >
                            {/* Currency Swatch */}
                            <div className="col-span-4 sm:col-span-3 flex items-center gap-2 min-w-0">
                              <span
                                className={`w-14 py-1 text-center font-mono font-bold tabular-nums text-xs rounded-md border shrink-0 ${style.badge}`}
                              >
                                ₹{denom}
                              </span>
                              {style.hint ? (
                                <span className="hidden md:inline text-[10px] font-medium text-slate-400 truncate">
                                  {style.hint}
                                </span>
                              ) : (
                                <span className="text-xs font-mono text-slate-400">×</span>
                              )}
                            </div>

                            {/* Segmented Stepper + Bundle Quick Add */}
                            <div className="col-span-5 sm:col-span-5 flex items-center gap-1.5 min-w-0">
                              <div className="inline-flex items-center rounded-lg border border-slate-300 bg-white overflow-hidden focus-within:border-blue-600 focus-within:ring-1 focus-within:ring-blue-600/20">
                                <button
                                  type="button"
                                  onClick={() => stepNoteCount(denom, -1)}
                                  disabled={count <= 0}
                                  aria-label={`Decrease ₹${denom} notes`}
                                  className="w-7 h-7 flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-not-allowed"
                                >
                                  <Minus className="w-3 h-3" aria-hidden="true" />
                                </button>
                                <input
                                  ref={(el) => {
                                    noteInputRefs.current[String(denom)] = el;
                                  }}
                                  type="number"
                                  min={0}
                                  inputMode="numeric"
                                  value={formState.notes[denom] || ''}
                                  onChange={(e) => updateNoteCount(denom, e.target.value)}
                                  onFocus={(e) => e.currentTarget.select()}
                                  onKeyDown={(e) => handleNoteKeyDown(e, denom)}
                                  placeholder="0"
                                  aria-label={`${denom} rupee notes count`}
                                  className="w-12 sm:w-14 h-7 text-center px-1 text-xs font-mono font-bold tabular-nums text-slate-900 border-x border-slate-200 bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => stepNoteCount(denom, 1)}
                                  aria-label={`Increase ₹${denom} notes`}
                                  className="w-7 h-7 flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" aria-hidden="true" />
                                </button>
                              </div>

                              <button
                                type="button"
                                onClick={() => stepNoteCount(denom, 10)}
                                title={`Add 10 notes of ₹${denom}`}
                                className="hidden sm:inline-flex items-center justify-center h-7 px-1.5 rounded-md border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 text-[10px] font-mono font-semibold text-slate-600 transition-colors cursor-pointer shrink-0"
                              >
                                +10
                              </button>
                            </div>

                            {/* Visual Distribution Bar */}
                            <div className="hidden sm:flex sm:col-span-2 items-center gap-1.5">
                              <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-150 ${style.bar}`}
                                  style={{ width: `${sharePct}%` }}
                                />
                              </div>
                              <span className="w-7 text-right font-mono tabular-nums text-[10px] text-slate-500">
                                {sharePct >= 1 ? `${Math.round(sharePct)}%` : sharePct > 0 ? '<1%' : '—'}
                              </span>
                            </div>

                            {/* Line Subtotal */}
                            <div
                              className={`col-span-3 sm:col-span-2 text-right font-mono tabular-nums text-xs ${
                                subtotal > 0 ? 'font-bold text-slate-900' : 'text-slate-400'
                              }`}
                            >
                              ₹{subtotal.toLocaleString('en-IN')}
                            </div>
                          </div>
                        );
                      })}

                      {/* Coins / Paise Row */}
                      <div
                        className={`grid grid-cols-12 items-center gap-2 px-3.5 py-2 transition-colors ${
                          cashStats.coinsVal > 0 ? 'bg-emerald-50/35' : 'bg-slate-50/35'
                        }`}
                      >
                        <div className="col-span-4 sm:col-span-3 flex items-center gap-2 min-w-0">
                          <span className="w-14 py-1 text-center font-mono font-bold text-[11px] rounded-md border border-amber-200 bg-amber-50/80 text-amber-900 shrink-0">
                            Coins
                          </span>
                          <span className="hidden md:inline text-[11px] text-slate-500 truncate">
                            Paise (₹)
                          </span>
                        </div>

                        <div className="col-span-5 sm:col-span-5">
                          <input
                            ref={(el) => {
                              noteInputRefs.current['coins'] = el;
                            }}
                            type="number"
                            min={0}
                            step="any"
                            value={formState.coins}
                            onChange={(e) => updateField('coins', e.target.value)}
                            onFocus={(e) => e.currentTarget.select()}
                            placeholder="0.00"
                            aria-label="Coins amount in rupees"
                            className="w-28 sm:w-32 h-7 px-2.5 text-xs font-mono font-bold tabular-nums text-slate-900 rounded-lg border border-slate-300 bg-white focus:border-blue-600 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </div>

                        <div className="hidden sm:flex sm:col-span-2 items-center gap-1.5">
                          <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-amber-500 transition-all duration-150"
                              style={{
                                width: `${
                                  output.cashTotal > 0
                                    ? Math.min(100, (cashStats.coinsVal / output.cashTotal) * 100)
                                    : 0
                                }%`,
                              }}
                            />
                          </div>
                          <span className="w-7 text-right font-mono tabular-nums text-[10px] text-slate-500">
                            {output.cashTotal > 0 && cashStats.coinsVal > 0
                              ? `${Math.max(
                                  1,
                                  Math.round((cashStats.coinsVal / output.cashTotal) * 100)
                                )}%`
                              : '—'}
                          </span>
                        </div>

                        <div
                          className={`col-span-3 sm:col-span-2 text-right font-mono tabular-nums text-xs ${
                            cashStats.coinsVal > 0 ? 'font-bold text-slate-900' : 'text-slate-400'
                          }`}
                        >
                          ₹
                          {cashStats.coinsVal.toLocaleString('en-IN', {
                            maximumFractionDigits: 2,
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Ledger Total Summary Footer */}
                    <div className="bg-slate-50 border-t border-slate-200 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="text-slate-600 font-medium">
                        <span className="font-mono tabular-nums font-semibold text-slate-900">
                          {cashStats.totalNotes.toLocaleString('en-IN')}
                        </span>{' '}
                        Notes Counted <span aria-hidden="true">·</span>{' '}
                        <span className="font-mono tabular-nums font-semibold text-slate-900">
                          {cashStats.activeDenoms}
                        </span>{' '}
                        Active Rows
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 font-medium">Cash Subtotal:</span>
                        <span className="font-mono tabular-nums text-sm font-bold text-emerald-700">
                          ₹
                          {output.cashTotal.toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Cheque / Demand Draft Details */}
              {showChequeCounter && (
                <div
                  className={
                    showCashCounter ? 'pt-5 border-t border-slate-200 space-y-4' : 'space-y-4'
                  }
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">
                        Cheque / Demand Draft Details
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {selectedBank === 'sbi'
                          ? 'SBI slip fits 3 total entries (Cash + Cheques).'
                          : 'HDFC prints up to 5 cheques on Bank Copy.'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {selectedBank === 'hdfc' && (
                        <select
                          aria-label="HDFC cheque clearing type"
                          value={
                            formState.hdfcDepositType === 'out' ? 'out' : 'local'
                          }
                          onChange={(e) =>
                            updateField(
                              'hdfcDepositType',
                              e.target.value as 'local' | 'out'
                            )
                          }
                          className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:border-slate-900"
                        >
                          <option value="local">Local Cheque</option>
                          <option value="out">Outstation Cheque</option>
                        </select>
                      )}

                      {visibleCheques < MAX_CHEQUES && (
                        <button
                          type="button"
                          onClick={() =>
                            setVisibleCheques((c) => Math.min(MAX_CHEQUES, c + 1))
                          }
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 transition cursor-pointer whitespace-nowrap"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Cheque</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {formState.cheques.slice(0, visibleCheques).map((chq, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/40 space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-700">
                            Cheque #{idx + 1}
                          </span>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5">
                              <label className="text-[11px] text-slate-500">
                                Chq Date
                              </label>
                              <input
                                type="date"
                                value={chq.date}
                                onChange={(e) =>
                                  updateChequeField(idx, 'date', e.target.value)
                                }
                                className="px-2 py-0.5 text-[11px] font-mono rounded border border-slate-300 bg-white text-slate-700 focus:outline-none focus:border-slate-900"
                              />
                            </div>
                            <button
                              type="button"
                              aria-label={`Remove or clear cheque ${idx + 1}`}
                              onClick={() => handleRemoveChequeRow(idx)}
                              className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                          <div className="sm:col-span-3">
                            <label className="block text-[11px] text-slate-500 mb-1">
                              Cheque No
                            </label>
                            <input
                              type="text"
                              value={chq.chequeNo}
                              onChange={(e) =>
                                updateChequeField(idx, 'chequeNo', e.target.value)
                              }
                              placeholder="Cheque number"
                              className="w-full px-2.5 py-1.5 text-xs font-mono text-slate-900 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-slate-900"
                            />
                          </div>
                          <div className="sm:col-span-3">
                            <label className="block text-[11px] text-slate-500 mb-1">
                              Drawee Bank
                            </label>
                            <input
                              type="text"
                              value={chq.bankBranch}
                              onChange={(e) =>
                                updateChequeField(idx, 'bankBranch', e.target.value)
                              }
                              placeholder="Drawee bank name"
                              className="w-full px-2.5 py-1.5 text-xs text-slate-900 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-slate-900"
                            />
                          </div>
                          <div className="sm:col-span-3">
                            <label className="block text-[11px] text-slate-500 mb-1">
                              Branch
                            </label>
                            <input
                              type="text"
                              value={chq.city}
                              onChange={(e) =>
                                updateChequeField(idx, 'city', e.target.value)
                              }
                              placeholder="Branch / city"
                              className="w-full px-2.5 py-1.5 text-xs text-slate-900 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-slate-900"
                            />
                          </div>
                          <div className="sm:col-span-3">
                            <label className="block text-[11px] text-slate-500 mb-1">
                              Amount (₹)
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={chq.amount}
                              onChange={(e) =>
                                updateChequeField(idx, 'amount', e.target.value)
                              }
                              placeholder="0"
                              className="w-full px-2.5 py-1.5 text-xs font-mono font-bold text-right tabular-nums text-slate-900 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-slate-900"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {output.warning && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{output.warning}</span>
                </div>
              )}
            </div>
          )}

          {/* DEMAND DRAFT / BANKER'S CHEQUE BODY */}
          {formType === 'dd' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-bold text-slate-900">
                  Draft / Banker&apos;s Cheque Specifications
                </h2>
                <span className="text-sm font-bold font-mono tabular-nums text-emerald-700">
                  Total: ₹{output.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {selectedBank === 'sbi' ? (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">
                      Please Issue
                    </label>
                    <select
                      value={formState.ddIssueType}
                      onChange={(e) =>
                        updateField('ddIssueType', e.target.value as 'dd' | 'bc')
                      }
                      className="w-full px-3.5 py-2 text-xs sm:text-sm font-medium rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-slate-900"
                    >
                      <option value="dd">Demand Draft</option>
                      <option value="bc">Banker&apos;s Cheque</option>
                    </select>
                  </div>
                ) : (
                  <div className="flex items-center pt-5">
                    <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formState.ddTicked}
                        onChange={(e) => updateField('ddTicked', e.target.checked)}
                        className="rounded border-slate-300 text-slate-900"
                      />
                      Demand Draft ticked on HDFC form
                    </label>
                  </div>
                )}

                {selectedBank === 'sbi' ? (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">
                      Code No. (5 digits)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={5}
                      value={formState.ddCodeNo}
                      onChange={(e) =>
                        updateField('ddCodeNo', e.target.value.replace(/[^0-9]/g, ''))
                      }
                      placeholder="5-digit code"
                      className="w-full px-3.5 py-2 text-xs sm:text-sm font-mono rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-slate-900"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">
                      Deliver Draft To Mr / Ms.
                    </label>
                    <input
                      type="text"
                      value={formState.ddDeliverTo}
                      onChange={(e) => updateField('ddDeliverTo', e.target.value)}
                      placeholder="Bearer / Recipient name"
                      className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-slate-900"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    In Favour Of (Payee Name) *
                  </label>
                  <input
                    type="text"
                    value={formState.ddFavouring}
                    onChange={(e) => updateField('ddFavouring', e.target.value)}
                    placeholder="Payee name / institution"
                    className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    Payable At (City / Branch) *
                  </label>
                  <input
                    type="text"
                    value={formState.ddPayableAt}
                    onChange={(e) => updateField('ddPayableAt', e.target.value)}
                    placeholder="City / branch name"
                    className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    DD / B.C. Amount (₹) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formState.ddAmount}
                    onChange={(e) => updateField('ddAmount', e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3.5 py-2 text-sm font-mono font-bold rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-slate-900"
                  />
                </div>

                {selectedBank === 'sbi' ? (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">
                      Exchange / Commission (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={formState.ddExchange}
                      onChange={(e) => updateField('ddExchange', e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3.5 py-2 text-sm font-mono rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-slate-900"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">
                      Payment Cheque No. &amp; Date
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={formState.ddChequeNo}
                        onChange={(e) => updateField('ddChequeNo', e.target.value)}
                        placeholder="Chq no."
                        className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-slate-900"
                      />
                      <input
                        type="date"
                        value={formState.ddChequeDate}
                        onChange={(e) => updateField('ddChequeDate', e.target.value)}
                        className="w-full px-2.5 py-2 text-xs font-mono rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-slate-900"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* SBI DD Cash Notes */}
              {selectedBank === 'sbi' && (
                <div className="pt-3.5 border-t border-slate-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-800">
                        Cash Tendered (SBI DD Notes)
                      </span>
                      <span className="text-xs font-mono tabular-nums font-bold text-emerald-700">
                        ₹{fmtIn(output.cashTotal) || '0'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleClearCashOnly}
                        disabled={output.cashTotal <= 0}
                        className="text-xs font-semibold text-slate-500 hover:text-rose-700 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={handleAutoFillSbiDdNotes}
                        className="px-2.5 py-1 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-xs font-semibold text-blue-700 transition-colors cursor-pointer"
                      >
                        Auto-Split Total
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {SBI_DD_DENOMS.map((d) => {
                      const cnt = parseInt(formState.notes[d] || '0', 10) || 0;
                      const style = DENOM_STYLES[d] || DENOM_STYLES[1];
                      return (
                        <div
                          key={d}
                          className={`flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-xl border transition-colors ${
                            cnt > 0
                              ? 'border-emerald-300 bg-emerald-50/40'
                              : 'border-slate-200 bg-slate-50/50'
                          }`}
                        >
                          <span
                            className={`px-1.5 py-0.5 text-[11px] font-mono font-bold rounded border ${style.badge}`}
                          >
                            ₹{d}
                          </span>
                          <input
                            type="number"
                            min={0}
                            inputMode="numeric"
                            value={formState.notes[d] || ''}
                            onChange={(e) => updateNoteCount(d, e.target.value)}
                            onFocus={(e) => e.currentTarget.select()}
                            placeholder="0"
                            aria-label={`${d} rupee notes count for SBI DD`}
                            className="w-11 text-center py-0.5 text-xs font-mono font-bold tabular-nums rounded-md border border-slate-300 bg-white focus:border-blue-600 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <span className="text-[11px] font-mono tabular-nums font-semibold text-slate-600 text-right min-w-[42px]">
                            ₹{fmtIn(cnt * d) || '0'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2.5 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 text-[11px] font-mono font-bold rounded border border-amber-200 bg-amber-50 text-amber-900">
                        Coins / P.
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Optional fractional paise (₹)
                      </span>
                    </div>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={formState.coins}
                      onChange={(e) => updateField('coins', e.target.value)}
                      onFocus={(e) => e.currentTarget.select()}
                      placeholder="0.00"
                      aria-label="Coins or paise amount for SBI DD"
                      className="w-24 text-right px-2.5 py-1 text-xs font-mono font-bold tabular-nums rounded-lg border border-slate-300 bg-white focus:border-blue-600 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                  {ddCashMismatch && (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span>{output.warning}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* RTGS / NEFT BODY */}
          {formType === 'rtgs' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-bold text-slate-900">
                  Beneficiary &amp; Remittance Details
                </h2>
                <span className="text-sm font-bold font-mono tabular-nums text-emerald-700">
                  Total: ₹{output.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Mode Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Transfer System
                  </label>
                  <select
                    value={formState.rtgsType}
                    onChange={(e) =>
                      updateField('rtgsType', e.target.value as BankFormState['rtgsType'])
                    }
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-slate-900"
                  >
                    <option value="rtgs">RTGS (≥ ₹2 Lakh)</option>
                    <option value="neft">NEFT</option>
                    {selectedBank === 'hdfc' && <option value="">Auto / Un-ticked</option>}
                  </select>
                </div>

                {selectedBank === 'sbi' ? (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      By Way Of
                    </label>
                    <select
                      value={formState.rtgsMode}
                      onChange={(e) =>
                        updateField('rtgsMode', e.target.value as 'chq' | 'trf')
                      }
                      className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-slate-900"
                    >
                      <option value="chq">Cheque (NEFT/RTGS)</option>
                      <option value="trf">Transfer (only NEFT)</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Request Time
                    </label>
                    <input
                      type="text"
                      value={formState.rtgsTime}
                      onChange={(e) => updateField('rtgsTime', e.target.value)}
                      placeholder="HH:MM AM/PM"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-slate-900"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Cheque No. &amp; Date
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      type="text"
                      value={formState.rtgsChequeNo}
                      onChange={(e) => updateField('rtgsChequeNo', e.target.value)}
                      placeholder="Chq No."
                      className="w-full px-2.5 py-2 text-xs font-mono rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-slate-900"
                    />
                    <input
                      type="date"
                      value={formState.rtgsChequeDate}
                      onChange={(e) => updateField('rtgsChequeDate', e.target.value)}
                      className="w-full px-1.5 py-2 text-[11px] font-mono rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Beneficiary Account Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Beneficiary Name *
                  </label>
                  <input
                    type="text"
                    value={formState.rtgsBenName}
                    onChange={(e) => updateField('rtgsBenName', e.target.value)}
                    placeholder="Receiver's name as per bank"
                    className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Beneficiary Bank &amp; Branch *
                  </label>
                  <input
                    type="text"
                    value={formState.rtgsBenBank}
                    onChange={(e) => updateField('rtgsBenBank', e.target.value)}
                    placeholder="Beneficiary bank & branch"
                    className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-slate-900"
                  />
                </div>
              </div>

              {selectedBank === 'hdfc' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Beneficiary Contact No.
                    </label>
                    <input
                      type="tel"
                      value={formState.rtgsBenContact}
                      onChange={(e) => updateField('rtgsBenContact', e.target.value)}
                      placeholder="10-digit mobile or landline"
                      className="w-full px-3.5 py-2 text-xs font-mono rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Beneficiary Address
                    </label>
                    <input
                      type="text"
                      value={formState.rtgsBenAddress}
                      onChange={(e) => updateField('rtgsBenAddress', e.target.value)}
                      placeholder="City / office address"
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-slate-900"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    11-Digit IFSC Code *
                  </label>
                  <input
                    type="text"
                    maxLength={11}
                    value={formState.rtgsBenIfsc}
                    onChange={(e) =>
                      updateField('rtgsBenIfsc', e.target.value.toUpperCase())
                    }
                    placeholder="11-character IFSC"
                    className="w-full px-3 py-2 text-xs sm:text-sm font-mono font-bold uppercase rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Beneficiary A/c No. *
                  </label>
                  <input
                    type="text"
                    maxLength={selectedBank === 'sbi' ? 18 : 16}
                    value={formState.rtgsBenAccount}
                    onChange={(e) => updateField('rtgsBenAccount', e.target.value)}
                    placeholder="Destination account"
                    className="w-full px-3 py-2 text-xs sm:text-sm font-mono font-bold rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Re-Confirm A/c No.
                  </label>
                  <input
                    type="text"
                    maxLength={selectedBank === 'sbi' ? 18 : 16}
                    value={formState.rtgsBenAccountConfirm}
                    onChange={(e) =>
                      updateField('rtgsBenAccountConfirm', e.target.value)
                    }
                    placeholder="Re-enter A/c No."
                    className="w-full px-3 py-2 text-xs sm:text-sm font-mono font-bold rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-slate-900"
                  />
                </div>
              </div>

              {output.warning && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{output.warning}</span>
                </div>
              )}

              {/* Amount & Charges / Purpose */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Remittance Amount (₹) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formState.rtgsAmount}
                    onChange={(e) => updateField('rtgsAmount', e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3.5 py-2 text-sm font-mono font-bold rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-slate-900"
                  />
                </div>
                {selectedBank === 'sbi' ? (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Bank Charges (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={formState.rtgsCharges}
                      onChange={(e) => updateField('rtgsCharges', e.target.value)}
                      placeholder="0"
                      className="w-full px-3.5 py-2 text-sm font-mono rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-slate-900"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Purpose of Remittance
                    </label>
                    <input
                      type="text"
                      value={formState.rtgsPurpose}
                      onChange={(e) => updateField('rtgsPurpose', e.target.value)}
                      placeholder="Purpose of remittance"
                      className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-slate-900"
                    />
                  </div>
                )}
              </div>

              {selectedBank === 'hdfc' && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Remarks
                  </label>
                  <input
                    type="text"
                    value={formState.rtgsRemarks}
                    onChange={(e) => updateField('rtgsRemarks', e.target.value)}
                    placeholder="Additional narration printed on HDFC Remarks line"
                    className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-slate-900"
                  />
                </div>
              )}

              {/* HDFC LEI, BANV & Non-Customer compliance panel */}
              {selectedBank === 'hdfc' && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowHdfcRtgsCompliance((v) => !v)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    {showHdfcRtgsCompliance ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {showHdfcRtgsCompliance ? 'Hide' : 'Show'} HDFC BANV, LEI (₹50 Cr+) &amp; Non-Customer Options
                    </span>
                  </button>

                  {showHdfcRtgsCompliance && (
                    <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block font-medium text-slate-600 mb-1">
                          BANV Verification Option
                        </label>
                        <select
                          value={formState.rtgsBanv}
                          onChange={(e) =>
                            updateField(
                              'rtgsBanv',
                              e.target.value as BankFormState['rtgsBanv']
                            )
                          }
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                        >
                          <option value="">(none)</option>
                          <option value="1">Option 1 – HDFC Bank to verify</option>
                          <option value="2">Option 2 – Verified by customer</option>
                        </select>
                      </div>
                      <div>
                        <label className="block font-medium text-slate-600 mb-1">
                          Beneficiary A/c Type
                        </label>
                        <select
                          value={formState.rtgsBenAcType}
                          onChange={(e) =>
                            updateField(
                              'rtgsBenAcType',
                              e.target.value as BankFormState['rtgsBenAcType']
                            )
                          }
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                        >
                          <option value="">(none)</option>
                          <option value="res">Resident</option>
                          <option value="nr">Non Resident</option>
                          <option value="fcra">FCRA</option>
                        </select>
                      </div>
                      <div>
                        <label className="block font-medium text-slate-600 mb-1">
                          Remitter LEI (20 chars)
                        </label>
                        <input
                          type="text"
                          maxLength={20}
                          value={formState.rtgsLei}
                          onChange={(e) =>
                            updateField('rtgsLei', e.target.value.toUpperCase())
                          }
                          placeholder="₹50 Cr+ only"
                          className="w-full px-3 py-1.5 font-mono uppercase rounded-lg border border-slate-300 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-600 mb-1">
                          Remitter LEI Expiry Date
                        </label>
                        <input
                          type="date"
                          value={formState.rtgsLeiExpiry}
                          onChange={(e) =>
                            updateField('rtgsLeiExpiry', e.target.value)
                          }
                          className="w-full px-3 py-1.5 font-mono rounded-lg border border-slate-300 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-600 mb-1">
                          Beneficiary LEI (20 chars)
                        </label>
                        <input
                          type="text"
                          maxLength={20}
                          value={formState.rtgsBenLei}
                          onChange={(e) =>
                            updateField('rtgsBenLei', e.target.value.toUpperCase())
                          }
                          placeholder="₹50 Cr+ only"
                          className="w-full px-3 py-1.5 font-mono uppercase rounded-lg border border-slate-300 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-600 mb-1">
                          Beneficiary LEI Expiry Date
                        </label>
                        <input
                          type="date"
                          value={formState.rtgsBenLeiExpiry}
                          onChange={(e) =>
                            updateField('rtgsBenLeiExpiry', e.target.value)
                          }
                          className="w-full px-3 py-1.5 font-mono rounded-lg border border-slate-300 bg-white"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block font-medium text-slate-600 mb-1">
                          Non-HDFC Customer Cash Deposited (₹)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={formState.rtgsNonHdfcCash}
                          onChange={(e) =>
                            updateField('rtgsNonHdfcCash', e.target.value)
                          }
                          placeholder="Only if remitter does not hold an HDFC account (up to ₹50,000)"
                          className="w-full px-3 py-1.5 font-mono rounded-lg border border-slate-300 bg-white"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Shared Live Amount in Words Box */}
          <div className="pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <span className="text-xs font-semibold text-slate-600">Amount in Words</span>
              {amountWordsText && (
                <button
                  type="button"
                  onClick={handleCopyWords}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:text-blue-800 cursor-pointer"
                >
                  {copiedWords ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" aria-hidden="true" />
                      <span className="text-emerald-700">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" aria-hidden="true" />
                      <span>Copy Words</span>
                    </>
                  )}
                </button>
              )}
            </div>
            <div className="px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/70 text-sm font-medium text-slate-900 min-h-[46px] flex flex-wrap items-center justify-between gap-3">
              <span
                className={
                  amountWordsText
                    ? 'text-slate-900 font-semibold leading-snug'
                    : 'text-slate-400 font-normal text-xs'
                }
              >
                {amountWordsText ||
                  'Rupees in words will appear automatically as you enter numbers...'}
              </span>
              {formType === 'deposit' &&
                formState.depositMode === 'both' &&
                output.grandTotal > 0 && (
                  <span className="text-xs font-mono tabular-nums font-bold text-emerald-700 shrink-0">
                    Grand Total: ₹{fmtIn(output.grandTotal)}
                  </span>
                )}
            </div>
          </div>
        </div>
      </div>

      {/* 468x60 Compact Desktop / 320x50 Mobile Ad Banner (Strictly outside A4 Slip canvas) */}
      <ResponsiveAdBanner
        desktopSlot="tool_mid_banner_468"
        tabletSlot="tool_mid_banner_468"
        mobileSlot="tool_mid_mobile_320"
        className="mt-6"
      />

      {/* FULL-WIDTH LIVE OFFICIAL BANK SLIP PREVIEW */}
      <div className="mt-7 space-y-4 print:mt-0 print:space-y-0">
        {/* Preview Control Header */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 no-print">
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-bold uppercase tracking-wider text-slate-500">
                Official Bank Slip Preview
              </span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span className="font-mono tabular-nums text-slate-600">
                A4 {output.orientation} · {Math.round(previewScale * 100)}% zoom
              </span>
            </div>
            <div className="text-sm font-bold text-slate-900">{output.title}</div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              aria-label="Preview mode"
              value={previewMode}
              onChange={(e) => setPreviewMode(e.target.value as PreviewMode)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:border-slate-900"
            >
              <option value="full">Full form (blank A4 paper)</option>
              <option value="data">Entries only (pre-printed slip)</option>
            </select>

            {output.backHtml !== null && (
              <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeReverse}
                  onChange={(e) => setIncludeReverse(e.target.checked)}
                  className="rounded border-slate-300 text-slate-900"
                />
                <span>Include backside (front + back)</span>
              </label>
            )}

            <a
              href={officialFormAsset.url}
              download={officialFormAsset.downloadName}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-950 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors whitespace-nowrap"
              title={`Download official bank ${officialFormAsset.label}`}
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>{officialFormAsset.label}</span>
            </a>
          </div>
        </div>

        {/* Preview Canvas */}
        <div ref={previewStageRef} className="w-full min-w-0">
          <div className="printable-area bank-slip-printable space-y-5 print:space-y-0">
            <div>
              {includeReverse && output.backHtml && (
                <div className="text-xs font-semibold text-slate-500 mb-1.5 text-center no-print">
                  Front Side · Printed as Page 1
                </div>
              )}
              <div
                className="bank-slip-sheet-wrap bg-white border border-slate-300 shadow-md rounded-xl overflow-hidden mx-auto"
                style={{
                  width: `${output.width * previewScale}px`,
                  height: `${output.height * previewScale}px`,
                }}
              >
                <div
                  className={`bank-slip ${output.fontClass} ${
                    previewMode === 'data' ? 'dataonly' : ''
                  }`}
                  style={{
                    width: `${output.width}px`,
                    height: `${output.height}px`,
                    transform: `scale(${previewScale})`,
                  }}
                  dangerouslySetInnerHTML={{ __html: output.frontHtml }}
                />
              </div>
            </div>

            {includeReverse && output.backHtml && (
              <div className="bank-slip-print-page-break">
                <div className="text-xs font-semibold text-slate-500 mb-1.5 text-center no-print">
                  Back Side (Reverse / Overleaf) · Printed as Page 2
                  {previewMode === 'data' && (
                    <span className="ml-2 font-normal text-amber-700">
                      (Pre-printed mode hides reverse form ink)
                    </span>
                  )}
                </div>
                <div
                  className="bank-slip-sheet-wrap bg-white border border-slate-300 shadow-md rounded-xl overflow-hidden mx-auto"
                  style={{
                    width: `${output.width * previewScale}px`,
                    height: `${output.height * previewScale}px`,
                  }}
                >
                  <div
                    className={`bank-slip ${output.backFontClass ?? output.fontClass} ${
                      previewMode === 'data' ? 'dataonly' : ''
                    }`}
                    style={{
                      width: `${output.width}px`,
                      height: `${output.height}px`,
                      transform: `scale(${previewScale})`,
                    }}
                    dangerouslySetInnerHTML={{ __html: output.backHtml }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dedicated Comprehensive User Guide & Compliance Article */}
      <BankDepositSlipArticle />

      {/* Contextual Financial Partner Directory */}
      <ContextualAdWidget initialCategory="finance" title="Recommended Banking & Financial Partner Tools" className="mt-8" />

      {/* Post-Preview Smartlink & 300x250 Dual Rectangle Ad Slots */}
      <div className="mt-6 space-y-5 no-print">
        <SmartlinkBanner slotId="tool_smartlink" />
        <AdRectanglePair leftSlot="tool_bottom_rect_1" rightSlot="tool_bottom_rect_2" />
      </div>

      {/* Bulk Excel Modal */}
      <BulkSlipModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        bankId={selectedBank}
        formType={formType}
        previewMode={previewMode}
        initialIncludeReverse={includeReverse}
        onLoadRecordIntoEditor={handleLoadRecordIntoEditor}
      />
    </div>
  );
};
