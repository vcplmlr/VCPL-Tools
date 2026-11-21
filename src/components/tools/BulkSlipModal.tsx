import React, { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Info,
  Loader2,
  Printer,
  Upload,
  X,
} from 'lucide-react';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas-pro';
import {
  BankFormType,
  BankId,
  PreviewMode,
  RenderedSlipOutput,
  renderBankSlip,
} from '../../utils/bankSlipRenderers';
import {
  BulkSlipRecord,
  BulkValidationResult,
  MAX_BULK_ROWS,
  bulkRecordToBankFormState,
  flattenCanvasToWhiteJpeg,
  generateBulkExcelTemplate,
  parseBulkExcelFile,
} from '../../utils/excelBulkEngine';
import { FileDropZone } from './FileDropZone';

interface BulkSlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  bankId: BankId;
  formType: BankFormType;
  previewMode?: PreviewMode;
  initialIncludeReverse?: boolean;
  onLoadRecordIntoEditor: (
    record: BulkSlipRecord,
    bankId: BankId,
    formType: BankFormType
  ) => void;
}

interface CaptureStagePayload {
  width: number;
  height: number;
  fontClass: string;
  html: string;
}

const SLIP_TITLES: Record<`${BankId}_${BankFormType}`, { title: string; code: string }> = {
  sbi_deposit: { title: 'Cash & Cheque Pay-in Slip', code: '100999131-V3' },
  sbi_rtgs: { title: 'RTGS / NEFT Remittance Slip', code: 'Challan' },
  sbi_dd: { title: "Demand Draft / Banker's Cheque", code: 'CC-5003234' },
  hdfc_deposit: { title: 'Cash & Cheque Pay-in Slip', code: 'RMTL 9328' },
  hdfc_rtgs: { title: 'RTGS / NEFT Request Form', code: 'Code 92929' },
  hdfc_dd: { title: 'Demand Draft Application Form', code: 'Against Chq' },
};

async function waitForElement(id: string, maxWaitMs = 3500): Promise<HTMLElement> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const el = document.getElementById(id);
    if (el) return el;
    await new Promise((r) => requestAnimationFrame(r));
  }
  const el = document.getElementById(id);
  if (!el) throw new Error(`Bank slip staging node (#${id}) could not be mounted`);
  return el;
}

async function captureSlipJpeg(width: number, height: number): Promise<string> {
  const el = await waitForElement('bulk-active-capture-node', 3500);
  const target = (el.firstElementChild as HTMLElement) || el;
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  const canvas = await html2canvas(target, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
    removeContainer: true,
    width,
    height,
    x: 0,
    y: 0,
    scrollX: 0,
    scrollY: 0,
  });

  return flattenCanvasToWhiteJpeg(canvas, 0.95);
}

function addSlipImageToPdf(
  pdf: jsPDF,
  jpeg: string,
  dims: { width: number; height: number },
  isPortrait: boolean
) {
  if (isPortrait) {
    if (dims.height > dims.width) {
      const scaleMm = Math.min(194 / dims.width, 281 / dims.height);
      const pdfWidthMm = dims.width * scaleMm;
      const pdfHeightMm = dims.height * scaleMm;
      const startX = Math.max(0, (210 - pdfWidthMm) / 2);
      pdf.addImage(jpeg, 'JPEG', startX, 8, pdfWidthMm, pdfHeightMm, undefined, 'FAST');
    } else {
      const scaleMm = Math.min(194 / dims.width, 281 / dims.height);
      const pdfWidthMm = dims.width * scaleMm;
      const pdfHeightMm = dims.height * scaleMm;
      const startY = Math.max(0, (297 - pdfHeightMm) / 2);
      pdf.addImage(jpeg, 'JPEG', 8, startY, pdfWidthMm, pdfHeightMm, undefined, 'FAST');
    }
  } else {
    const scaleMm = Math.min(281 / dims.width, 194 / dims.height);
    const pdfWidthMm = dims.width * scaleMm;
    const pdfHeightMm = dims.height * scaleMm;
    const startX = Math.max(0, (297 - pdfWidthMm) / 2);
    const startY = Math.max(0, (210 - pdfHeightMm) / 2);
    pdf.addImage(jpeg, 'JPEG', startX, startY, pdfWidthMm, pdfHeightMm, undefined, 'FAST');
  }
}

export const BulkSlipModal: React.FC<BulkSlipModalProps> = ({
  isOpen,
  onClose,
  bankId: initialBankId,
  formType: initialFormType,
  previewMode: initialPreviewMode = 'full',
  initialIncludeReverse = true,
  onLoadRecordIntoEditor,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeBankId, setActiveBankId] = useState<BankId>(initialBankId);
  const [activeFormType, setActiveFormType] = useState<BankFormType>(initialFormType);
  const [slipPrintMode, setSlipPrintMode] = useState<PreviewMode>(initialPreviewMode);
  const [includeReverse, setIncludeReverse] = useState<boolean>(initialIncludeReverse);

  const isPortraitFixed =
    activeBankId === 'hdfc' && (activeFormType === 'dd' || activeFormType === 'rtgs');
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>(
    isPortraitFixed ? 'portrait' : 'landscape'
  );

  const [isParsing, setIsParsing] = useState(false);
  const [validationResult, setValidationResult] = useState<BulkValidationResult | null>(null);
  const [selectedRecordIndex, setSelectedRecordIndex] = useState<number | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [renderingPayload, setRenderingPayload] = useState<CaptureStagePayload | null>(null);
  const [progressMsg, setProgressMsg] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveBankId(initialBankId);
      setActiveFormType(initialFormType);
      setSlipPrintMode(initialPreviewMode);
      setIncludeReverse(initialIncludeReverse);
      const fixed =
        initialBankId === 'hdfc' && (initialFormType === 'dd' || initialFormType === 'rtgs');
      setOrientation(fixed ? 'portrait' : 'landscape');
      setActionError(null);
    }
  }, [isOpen, initialBankId, initialFormType, initialPreviewMode, initialIncludeReverse]);

  const activeMeta = SLIP_TITLES[`${activeBankId}_${activeFormType}`];
  const bankDisplayName = activeBankId === 'hdfc' ? 'HDFC Bank Ltd' : 'State Bank of India';
  const bankShort = activeBankId === 'hdfc' ? 'HDFC' : 'SBI';

  const selectedRecord =
    selectedRecordIndex !== null && validationResult?.records
      ? validationResult.records[selectedRecordIndex]
      : null;

  const selectedPreviewOutput = useMemo(() => {
    if (!selectedRecord) return null;
    const state = bulkRecordToBankFormState(selectedRecord, activeBankId, activeFormType);
    return renderBankSlip(activeBankId, activeFormType, state);
  }, [selectedRecord, activeBankId, activeFormType]);

  const bulkPreviewStageRef = useRef<HTMLDivElement>(null);
  const [bulkStageWidth, setBulkStageWidth] = useState<number>(820);

  useEffect(() => {
    if (!isOpen) return;
    const el = bulkPreviewStageRef.current;
    if (!el) return;
    const updateWidth = () => {
      const w = el.clientWidth;
      if (w > 0) setBulkStageWidth(w);
    };
    updateWidth();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateWidth);
      return () => window.removeEventListener('resize', updateWidth);
    }
    let rafId = 0;
    const scheduleUpdate = () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        updateWidth();
      });
    };
    const ro = new ResizeObserver(scheduleUpdate);
    ro.observe(el);
    window.addEventListener('resize', scheduleUpdate);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      ro.disconnect();
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, [isOpen, selectedRecordIndex]);

  const bulkPreviewScale = useMemo(() => {
    if (!selectedPreviewOutput) return isPortraitFixed ? 0.36 : 0.48;
    const cap = isPortraitFixed ? 0.55 : 0.62;
    const available = Math.max(200, bulkStageWidth - 28);
    return Math.min(cap, available / selectedPreviewOutput.width);
  }, [bulkStageWidth, isPortraitFixed, selectedPreviewOutput]);

  if (!isOpen) return null;

  const handleSwitchForm = (bank: BankId, type: BankFormType) => {
    setActiveBankId(bank);
    setActiveFormType(type);
    const fixed = bank === 'hdfc' && (type === 'dd' || type === 'rtgs');
    setOrientation(fixed ? 'portrait' : 'landscape');
    setValidationResult(null);
    setSelectedRecordIndex(null);
    setActionError(null);
  };

  const handleDownloadTemplate = async () => {
    setActionError(null);
    try {
      await generateBulkExcelTemplate(activeBankId, activeFormType);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Unable to generate Excel template.'
      );
    }
  };

  const processSpreadsheetFile = async (file: File) => {
    setIsParsing(true);
    setValidationResult(null);
    setActionError(null);

    try {
      const res = await parseBulkExcelFile(file, activeBankId, activeFormType);
      setValidationResult(res);
      if (res.records.length > 0) {
        setSelectedRecordIndex(0);
      }
    } catch (err) {
      setValidationResult({
        success: false,
        error:
          'Failed to read spreadsheet: ' +
          (err instanceof Error ? err.message : String(err)),
        totalRecords: 0,
        validRecords: 0,
        invalidRecords: 0,
        records: [],
      });
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processSpreadsheetFile(file);
  };

  const captureHtmlToJpeg = async (payload: CaptureStagePayload): Promise<string> => {
    flushSync(() => {
      setRenderingPayload(payload);
    });

    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await new Promise((r) => setTimeout(r, 45));

    return captureSlipJpeg(payload.width, payload.height);
  };

  const renderRecordToJpeg = async (
    rec: BulkSlipRecord,
    idx: number,
    total: number,
    verb: string
  ): Promise<{ jpeg: string; output: RenderedSlipOutput }> => {
    setProgressPercent(Math.round(10 + (idx / total) * 78));
    setProgressMsg(
      `${verb} ${idx + 1} of ${total} (${rec.name || rec.accountNo || 'Slip'})...`
    );

    const state = bulkRecordToBankFormState(rec, activeBankId, activeFormType);
    const out = renderBankSlip(activeBankId, activeFormType, state);

    const jpeg = await captureHtmlToJpeg({
      width: out.width,
      height: out.height,
      fontClass: out.fontClass,
      html: out.frontHtml,
    });
    return { jpeg, output: out };
  };

  const captureBackSheetIfEnabled = async (
    sampleOutput: RenderedSlipOutput
  ): Promise<string | null> => {
    if (!includeReverse || !sampleOutput.backHtml) return null;
    return captureHtmlToJpeg({
      width: sampleOutput.width,
      height: sampleOutput.height,
      fontClass: sampleOutput.backFontClass ?? sampleOutput.fontClass,
      html: sampleOutput.backHtml,
    });
  };

  const handleGenerateCombinedPdf = async () => {
    if (!validationResult) return;
    const validRecords = validationResult.records.filter((r) => r.isValid);
    if (validRecords.length === 0) return;

    setActionError(null);
    setIsGenerating(true);
    setProgressPercent(5);
    setProgressMsg('Initializing multi-page official PDF compiler...');

    const isPortrait = isPortraitFixed || orientation === 'portrait';

    try {
      const pdf = new jsPDF({
        orientation: isPortrait ? 'portrait' : 'landscape',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      let cachedBackJpeg: string | null | undefined = undefined;

      for (let i = 0; i < validRecords.length; i++) {
        const { jpeg, output } = await renderRecordToJpeg(
          validRecords[i],
          i,
          validRecords.length,
          'Rendering slip'
        );

        if (cachedBackJpeg === undefined) {
          cachedBackJpeg = await captureBackSheetIfEnabled(output);
        }

        if (i > 0) {
          pdf.addPage('a4', isPortrait ? 'portrait' : 'landscape');
        }
        addSlipImageToPdf(
          pdf,
          jpeg,
          { width: output.width, height: output.height },
          isPortrait
        );

        if (cachedBackJpeg) {
          pdf.addPage('a4', isPortrait ? 'portrait' : 'landscape');
          addSlipImageToPdf(
            pdf,
            cachedBackJpeg,
            { width: output.width, height: output.height },
            isPortrait
          );
        }
      }

      setProgressPercent(95);
      setProgressMsg('Saving combined PDF file...');

      const orientationLabel = isPortrait ? 'Portrait' : 'Landscape';
      const suffix = cachedBackJpeg ? '_FrontBack' : '';
      const filename = `${bankShort}_${activeFormType.toUpperCase()}_${validRecords.length}_Slips${suffix}_${orientationLabel}.pdf`;
      pdf.save(filename);

      setProgressPercent(100);
      setProgressMsg('Combined PDF ready.');
      setTimeout(() => {
        setRenderingPayload(null);
        setIsGenerating(false);
      }, 400);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'PDF compilation failed.');
      setRenderingPayload(null);
      setIsGenerating(false);
    }
  };

  const handleGenerateZip = async () => {
    if (!validationResult) return;
    const validRecords = validationResult.records.filter((r) => r.isValid);
    if (validRecords.length === 0) return;

    setActionError(null);
    setIsGenerating(true);
    setProgressPercent(5);
    setProgressMsg('Creating ZIP archive of individual A4 PDFs...');

    const isPortrait = isPortraitFixed || orientation === 'portrait';

    try {
      const zip = new JSZip();
      let cachedBackJpeg: string | null | undefined = undefined;

      for (let i = 0; i < validRecords.length; i++) {
        const rec = validRecords[i];
        const { jpeg, output } = await renderRecordToJpeg(
          rec,
          i,
          validRecords.length,
          'Packaging slip'
        );

        if (cachedBackJpeg === undefined) {
          cachedBackJpeg = await captureBackSheetIfEnabled(output);
        }

        const singlePdf = new jsPDF({
          orientation: isPortrait ? 'portrait' : 'landscape',
          unit: 'mm',
          format: 'a4',
          compress: true,
        });
        addSlipImageToPdf(
          singlePdf,
          jpeg,
          { width: output.width, height: output.height },
          isPortrait
        );

        if (cachedBackJpeg) {
          singlePdf.addPage('a4', isPortrait ? 'portrait' : 'landscape');
          addSlipImageToPdf(
            singlePdf,
            cachedBackJpeg,
            { width: output.width, height: output.height },
            isPortrait
          );
        }

        const safeName = (rec.name || 'Account')
          .replace(/[^a-zA-Z0-9]/g, '_')
          .slice(0, 20);
        const fileName = `${bankShort}_Slip_${String(rec.rowNumber).padStart(
          2,
          '0'
        )}_${safeName}_${rec.accountNo || 'NA'}.pdf`;
        zip.file(fileName, singlePdf.output('arraybuffer'));
      }

      setProgressPercent(90);
      setProgressMsg('Compressing ZIP archive...');

      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 1 },
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `${bankShort}_${activeFormType.toUpperCase()}_${validRecords.length}_Slips.zip`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (a.parentNode) document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 2500);

      setProgressPercent(100);
      setTimeout(() => {
        setRenderingPayload(null);
        setIsGenerating(false);
      }, 400);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'ZIP creation failed.');
      setRenderingPayload(null);
      setIsGenerating(false);
    }
  };

  const handlePrintAll = async () => {
    if (!validationResult) return;
    const validRecords = validationResult.records.filter((r) => r.isValid);
    if (validRecords.length === 0) return;

    setActionError(null);
    setIsGenerating(true);
    const isPortrait = isPortraitFixed || orientation === 'portrait';
    setProgressPercent(5);
    setProgressMsg(`Preparing ${validRecords.length} slips for A4 print...`);

    try {
      const images: string[] = [];
      let cachedBackJpeg: string | null | undefined = undefined;

      for (let i = 0; i < validRecords.length; i++) {
        const { jpeg, output } = await renderRecordToJpeg(
          validRecords[i],
          i,
          validRecords.length,
          'Preparing print sheet'
        );

        if (cachedBackJpeg === undefined) {
          cachedBackJpeg = await captureBackSheetIfEnabled(output);
        }

        images.push(jpeg);
        if (cachedBackJpeg) {
          images.push(cachedBackJpeg);
        }
      }

      setProgressPercent(95);
      setProgressMsg('Opening print preview...');

      let printIframe = document.getElementById('bulk-slip-print-frame') as HTMLIFrameElement | null;
      if (printIframe?.parentNode) printIframe.parentNode.removeChild(printIframe);

      printIframe = document.createElement('iframe');
      printIframe.id = 'bulk-slip-print-frame';
      printIframe.style.position = 'fixed';
      printIframe.style.right = '0';
      printIframe.style.bottom = '0';
      printIframe.style.width = '100%';
      printIframe.style.height = '100%';
      printIframe.style.border = 'none';
      printIframe.style.zIndex = '-1';
      document.body.appendChild(printIframe);

      const iframeDoc = printIframe.contentWindow?.document;
      if (!iframeDoc) {
        setActionError('Print frame unavailable in this browser context.');
        setRenderingPayload(null);
        setIsGenerating(false);
        return;
      }

      const printOrientation = isPortrait ? 'portrait' : 'landscape';
      const pagesHtml = images
        .map(
          (src, idx) =>
            `<div class="bulk-slip-sheet"><img src="${src}" class="bulk-slip-img" alt="Bank Slip ${idx + 1}" /></div>`
        )
        .join('\n');

      iframeDoc.open();
      iframeDoc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Print Bulk Bank Slips - ${bankDisplayName}</title>
            <style>
              @page { size: A4 ${printOrientation}; margin: ${printOrientation === 'landscape' ? '6mm 8mm' : '8mm'}; }
              * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              html, body { background: #ffffff !important; width: 100%; }
              .bulk-slip-sheet {
                width: 100%;
                max-height: ${printOrientation === 'landscape' ? '196mm' : '280mm'};
                display: flex; align-items: center; justify-content: center;
                page-break-after: always; break-after: page; background: #ffffff !important;
              }
              .bulk-slip-sheet:last-child { page-break-after: avoid; break-after: avoid; }
              img.bulk-slip-img {
                max-width: ${printOrientation === 'landscape' ? '281mm' : '194mm'};
                max-height: ${printOrientation === 'landscape' ? '194mm' : '278mm'};
                width: auto; height: auto; display: block; margin: 0 auto; object-fit: contain;
              }
            </style>
          </head>
          <body>${pagesHtml}</body>
        </html>
      `);
      iframeDoc.close();

      let triggered = false;
      let fallbackTimer = 0;
      const cleanupFrame = () => {
        if (printIframe?.parentNode) {
          printIframe.parentNode.removeChild(printIframe);
        }
      };

      const triggerPrint = () => {
        if (triggered) return;
        triggered = true;
        if (fallbackTimer) window.clearTimeout(fallbackTimer);
        try {
          printIframe?.contentWindow?.addEventListener('afterprint', cleanupFrame, { once: true });
          window.setTimeout(cleanupFrame, 60000);
          printIframe?.contentWindow?.focus();
          printIframe?.contentWindow?.print();
        } finally {
          setRenderingPayload(null);
          setIsGenerating(false);
        }
      };

      const imgs = Array.from(iframeDoc.images);
      if (imgs.length === 0 || imgs.every((img) => img.complete)) {
        fallbackTimer = window.setTimeout(triggerPrint, 250);
      } else {
        let loaded = 0;
        imgs.forEach((img) => {
          img.onload = img.onerror = () => {
            loaded += 1;
            if (loaded >= imgs.length) {
              window.setTimeout(triggerPrint, 250);
            }
          };
        });
        fallbackTimer = window.setTimeout(triggerPrint, 1500);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Batch print failed.');
      setRenderingPayload(null);
      setIsGenerating(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#1E293B]/70 backdrop-blur-[2px] font-sans no-print"
      onClick={onClose}
    >
      <div
        className="bg-[#FFFDF5] border-2 border-[#2F3E4E] rounded-2xl shadow-[0_8px_0_#2F3E4E] max-w-5xl w-full max-h-[94vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#2F3E4E]/15 flex items-center justify-between bg-[#FEF2C8] gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-xl text-white flex items-center justify-center font-bold text-xs shrink-0 border border-[#2F3E4E]"
              style={{
                backgroundColor: activeBankId === 'hdfc' ? '#004c8f' : '#0C2340',
              }}
            >
              {bankShort}
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-base font-extrabold text-[#2F3E4E] truncate">
                {bankDisplayName} — Bulk Excel Slip Generator
              </h2>
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#475569] mt-0.5">
                <span className="font-semibold text-[#2F3E4E]">{activeMeta.title}</span>
                <span aria-hidden="true">·</span>
                <span>Up to {MAX_BULK_ROWS} rows</span>
                <span aria-hidden="true">·</span>
                <span>100% browser processing</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-lg border-[1.5px] border-[#2F3E4E] bg-[#FFFDF5] text-[#2F3E4E] hover:bg-[#2F3E4E] hover:text-[#FFFDF5] transition cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Step 0: Select Bank & Slip Form */}
          <div className="bg-[#FFE1B3]/50 border-[1.5px] border-[#2F3E4E] rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#2F3E4E]">
                Select Bank &amp; Slip Format
              </span>
              <span className="text-xs text-[#475569]">
                Active: <strong className="text-[#2F3E4E]">{bankShort} · {activeMeta.title}</strong> ({activeMeta.code})
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* SBI */}
              <div className="bg-white border-[1.5px] border-[#2F3E4E] rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2 pb-1.5 border-b border-slate-200">
                  <span className="px-1.5 py-0.5 rounded bg-[#0C2340] text-white text-[10px] font-bold">
                    SBI
                  </span>
                  <span className="text-xs font-bold text-[#2F3E4E]">State Bank of India</span>
                </div>
                <div className="grid grid-cols-1 gap-1">
                  {(['deposit', 'rtgs', 'dd'] as BankFormType[]).map((t) => {
                    const m = SLIP_TITLES[`sbi_${t}`];
                    const active = activeBankId === 'sbi' && activeFormType === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => handleSwitchForm('sbi', t)}
                        className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center justify-between gap-2 cursor-pointer ${
                          active
                            ? 'bg-[#2F3E4E] text-white'
                            : 'hover:bg-slate-100 text-[#2F3E4E]'
                        }`}
                      >
                        <span className="truncate">{m.title}</span>
                        <span className="text-[10px] font-mono opacity-75 shrink-0">{m.code}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* HDFC */}
              <div className="bg-white border-[1.5px] border-[#2F3E4E] rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2 pb-1.5 border-b border-slate-200">
                  <span className="px-1.5 py-0.5 rounded bg-[#004c8f] text-white text-[10px] font-bold">
                    HDFC
                  </span>
                  <span className="text-xs font-bold text-[#2F3E4E]">HDFC Bank Ltd</span>
                </div>
                <div className="grid grid-cols-1 gap-1">
                  {(['deposit', 'rtgs', 'dd'] as BankFormType[]).map((t) => {
                    const m = SLIP_TITLES[`hdfc_${t}`];
                    const active = activeBankId === 'hdfc' && activeFormType === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => handleSwitchForm('hdfc', t)}
                        className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center justify-between gap-2 cursor-pointer ${
                          active
                            ? 'bg-[#004c8f] text-white'
                            : 'hover:bg-slate-100 text-[#2F3E4E]'
                        }`}
                      >
                        <span className="truncate">{m.title}</span>
                        <span className="text-[10px] font-mono opacity-75 shrink-0">{m.code}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {actionError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-xs text-rose-900 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{actionError}</span>
              </div>
              <button
                type="button"
                onClick={() => setActionError(null)}
                className="text-rose-700 font-semibold hover:underline cursor-pointer shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          {isGenerating && (
            <div className="p-4 bg-[#CEE5DC] border-[1.5px] border-[#2F3E4E] rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-[#2F3E4E]">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {progressMsg}
                </span>
                <span className="font-mono tabular-nums">{progressPercent}%</span>
              </div>
              <div className="w-full h-2 bg-white rounded-full overflow-hidden border border-[#2F3E4E]/30">
                <div
                  className="h-full bg-[#2F3E4E] transition-all duration-150"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Step 1 & Step 2 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white flex flex-col justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-[#2F3E4E] mb-1">
                  01. Download Excel Template
                </div>
                <p className="text-xs text-[#475569] leading-relaxed">
                  Download the pre-formatted <strong>{bankShort}</strong> Excel sheet tailored for <strong>{activeMeta.title}</strong> with ready-to-fill header columns.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="w-full px-4 py-2.5 rounded-lg bg-[#FFFDF5] hover:bg-[#FEF2C8] text-[#2F3E4E] font-semibold text-xs border-[1.5px] border-[#2F3E4E] transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <Download className="w-4 h-4 text-emerald-700" />
                <span>Download .XLSX Template</span>
              </button>
            </div>

            <FileDropZone
              accept=".xlsx,.xls,.csv"
              multiple={false}
              disabled={isParsing}
              onFiles={(files) => {
                if (files[0]) void processSpreadsheetFile(files[0]);
              }}
              className="p-4 rounded-xl border-[1.5px] border-dashed border-[#2F3E4E] bg-white flex flex-col justify-between gap-3 transition-colors"
            >
              <div>
                <div className="text-xs font-bold text-[#2F3E4E] mb-1">
                  02. Drag &amp; Drop or Upload Completed Spreadsheet
                </div>
                <p className="text-xs text-[#475569] leading-relaxed">
                  Drop or select an Excel (.xlsx, .xls) or CSV file with up to {MAX_BULK_ROWS} rows. Validations run locally in your browser.
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
                id="bulk-excel-input"
              />
              <button
                type="button"
                disabled={isParsing}
                onClick={() => fileInputRef.current?.click()}
                className="w-full px-4 py-2.5 rounded-lg bg-[#2F3E4E] hover:bg-[#1E293B] text-[#FFFDF5] font-semibold text-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                {isParsing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Parsing File...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Select or Drop Excel File</span>
                  </>
                )}
              </button>
            </FileDropZone>
          </div>

          {validationResult && !validationResult.success && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-300 text-xs text-rose-900 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold">File Rejected:</strong> {validationResult.error}
              </div>
            </div>
          )}

          {validationResult && validationResult.success && (
            <div className="space-y-4">
              {/* Summary Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-white border-[1.5px] border-[#2F3E4E] rounded-xl">
                  <div className="text-[11px] font-medium text-[#64748B]">Total Records</div>
                  <div className="text-lg font-bold font-mono tabular-nums text-[#2F3E4E] mt-0.5">
                    {validationResult.totalRecords} / {MAX_BULK_ROWS}
                  </div>
                </div>
                <div className="p-3 bg-emerald-50 border-[1.5px] border-emerald-700 rounded-xl">
                  <div className="text-[11px] font-medium text-emerald-800">Valid Slips</div>
                  <div className="text-lg font-bold font-mono tabular-nums text-emerald-900 mt-0.5">
                    {validationResult.validRecords}
                  </div>
                  {(validationResult.totalWarnings || 0) > 0 && (
                    <div className="text-[10px] font-semibold text-amber-800 mt-0.5">
                      {validationResult.totalWarnings} format warning(s)
                    </div>
                  )}
                </div>
                <div className="p-3 bg-rose-50 border-[1.5px] border-rose-700 rounded-xl">
                  <div className="text-[11px] font-medium text-rose-800">Needs Fix</div>
                  <div className="text-lg font-bold font-mono tabular-nums text-rose-900 mt-0.5">
                    {validationResult.invalidRecords}
                  </div>
                </div>
                <div className="p-3 bg-white border-[1.5px] border-[#2F3E4E] rounded-xl">
                  <label className="block text-[11px] font-medium text-[#64748B] mb-1">
                    Batch Slip Style
                  </label>
                  <select
                    value={slipPrintMode}
                    onChange={(e) => setSlipPrintMode(e.target.value as PreviewMode)}
                    className="w-full px-2 py-1 text-xs font-semibold rounded border border-slate-300 bg-white text-[#2F3E4E] focus:outline-none"
                  >
                    <option value="full">Full Form (Blank A4)</option>
                    <option value="data">Data Only (Pre-printed)</option>
                  </select>
                </div>
              </div>

              {/* Parsed Rows Table */}
              <div className="border-[1.5px] border-[#2F3E4E] rounded-xl overflow-hidden bg-white">
                <div className="px-4 py-2.5 bg-[#FEF2C8] border-b border-[#2F3E4E]/15 text-xs font-bold text-[#2F3E4E] flex flex-wrap items-center justify-between gap-2">
                  <span>Parsed Rows ({validationResult.totalRecords})</span>
                  <span className="text-[11px] font-normal text-[#475569]">
                    Click any row to preview slip or open in editor
                  </span>
                </div>
                <div className="max-h-52 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[#475569] text-[11px] font-semibold sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">#</th>
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3">Account No</th>
                        <th className="py-2 px-3">Name</th>
                        <th className="py-2 px-3 text-right">Amount (₹)</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {validationResult.records.map((rec, i) => (
                        <tr
                          key={rec.rowNumber}
                          onClick={() => setSelectedRecordIndex(i)}
                          className={`hover:bg-[#FEF2C8]/40 transition cursor-pointer ${
                            selectedRecordIndex === i ? 'bg-[#CEE5DC]/50' : ''
                          }`}
                        >
                          <td className="py-2 px-3 font-mono tabular-nums text-[#64748B] align-top">
                            {rec.rowNumber}
                          </td>
                          <td className="py-2 px-3 text-[#2F3E4E] whitespace-nowrap font-mono tabular-nums align-top">
                            {rec.date || '—'}
                          </td>
                          <td className="py-2 px-3 font-mono tabular-nums text-[#2F3E4E] align-top">
                            {rec.accountNo || '—'}
                          </td>
                          <td className="py-2 px-3 text-[#2F3E4E] align-top max-w-[240px]">
                            <div className="font-medium truncate">{rec.name || '—'}</div>
                            {rec.errors.length > 0 && (
                              <div className="text-[10px] text-rose-700 leading-snug mt-0.5">
                                {rec.errors[0]}
                                {rec.errors.length > 1 ? ` (+${rec.errors.length - 1})` : ''}
                              </div>
                            )}
                            {rec.warnings && rec.warnings.length > 0 && (
                              <div className="text-[10px] text-amber-700 leading-snug mt-0.5">
                                {rec.warnings[0]}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-3 font-mono tabular-nums font-bold text-[#2F3E4E] text-right whitespace-nowrap align-top">
                            ₹{rec.amount.toLocaleString('en-IN')}
                          </td>
                          <td className="py-2 px-3 align-top">
                            {rec.isValid ? (
                              rec.warnings && rec.warnings.length > 0 ? (
                                <span
                                  className="inline-flex items-center gap-1 text-amber-700 font-semibold text-[11px]"
                                  title={rec.warnings.join(' · ')}
                                >
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  Warn
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Valid
                                </span>
                              )
                            ) : (
                              <span
                                className="inline-flex items-center gap-1 text-rose-700 font-semibold text-[11px]"
                                title={rec.errors.join(' · ')}
                              >
                                <AlertTriangle className="w-3.5 h-3.5" />
                                Error
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right align-top">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onLoadRecordIntoEditor(rec, activeBankId, activeFormType);
                                onClose();
                              }}
                              className="px-2.5 py-1 rounded-md bg-white hover:bg-[#2F3E4E] hover:text-white text-[#2F3E4E] font-semibold text-[11px] border border-[#2F3E4E] transition cursor-pointer inline-flex items-center gap-1 whitespace-nowrap"
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

              {/* Selected Row Scaled Preview */}
              {selectedRecord && selectedPreviewOutput && (
                <div className="p-3.5 bg-white border-[1.5px] border-[#2F3E4E] rounded-xl space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-1.5 font-bold text-[#2F3E4E]">
                      <Eye className="w-4 h-4 text-[#2F3E4E]" />
                      Slip Preview · Row #{selectedRecord.rowNumber} ({selectedRecord.name || 'Untitled'})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onLoadRecordIntoEditor(selectedRecord, activeBankId, activeFormType);
                        onClose();
                      }}
                      className="text-[#2F3E4E] hover:underline font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>Open in Single-Slip Editor</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {!selectedRecord.isValid && selectedRecord.errors.length > 0 && (
                    <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                      <strong>Validation Issues:</strong> {selectedRecord.errors.join(' · ')}
                    </div>
                  )}
                  {selectedRecord.warnings && selectedRecord.warnings.length > 0 && (
                    <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
                      <strong>Format Warnings:</strong> {selectedRecord.warnings.join(' · ')}
                    </div>
                  )}

                  <div
                    ref={bulkPreviewStageRef}
                    className="w-full bg-slate-50 rounded-lg border border-slate-200 p-3 flex flex-col items-center overflow-hidden"
                  >
                    <div
                      className="box-content bg-white border border-slate-300 shadow-xs overflow-hidden"
                      style={{
                        width: `${Math.ceil(selectedPreviewOutput.width * bulkPreviewScale)}px`,
                        height: `${Math.ceil(selectedPreviewOutput.height * bulkPreviewScale)}px`,
                      }}
                    >
                      <div
                        className={`bank-slip ${selectedPreviewOutput.fontClass} ${
                          slipPrintMode === 'data' ? 'dataonly' : ''
                        }`}
                        style={{
                          width: `${selectedPreviewOutput.width}px`,
                          height: `${selectedPreviewOutput.height}px`,
                          transform: `scale(${bulkPreviewScale})`,
                          transformOrigin: 'top left',
                        }}
                        dangerouslySetInnerHTML={{ __html: selectedPreviewOutput.frontHtml }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom Batch Actions */}
              <div className="pt-3 border-t border-[#2F3E4E]/15 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#475569]">Orientation:</span>
                    {isPortraitFixed ? (
                      <span className="text-xs font-semibold text-[#2F3E4E]">
                        A4 Portrait (Bank Standard)
                      </span>
                    ) : (
                      <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-300">
                        <button
                          type="button"
                          onClick={() => setOrientation('landscape')}
                          className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                            orientation === 'landscape'
                              ? 'bg-[#2F3E4E] text-white'
                              : 'text-[#475569] hover:text-[#2F3E4E]'
                          }`}
                        >
                          Landscape
                        </button>
                        <button
                          type="button"
                          onClick={() => setOrientation('portrait')}
                          className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                            orientation === 'portrait'
                              ? 'bg-[#2F3E4E] text-white'
                              : 'text-[#475569] hover:text-[#2F3E4E]'
                          }`}
                        >
                          Portrait
                        </button>
                      </div>
                    )}
                  </div>

                  <label className="inline-flex items-center gap-1.5 text-xs font-medium text-[#2F3E4E] cursor-pointer select-none pl-2 border-l border-slate-300">
                    <input
                      type="checkbox"
                      checked={includeReverse}
                      onChange={(e) => setIncludeReverse(e.target.checked)}
                      className="rounded border-slate-300 text-[#2F3E4E]"
                    />
                    <span>Include backside</span>
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={isGenerating || validationResult.validRecords === 0}
                    onClick={handlePrintAll}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] text-[#2F3E4E] transition cursor-pointer disabled:opacity-40 whitespace-nowrap"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Batch Print ({validationResult.validRecords})</span>
                  </button>

                  <button
                    type="button"
                    disabled={isGenerating || validationResult.validRecords === 0}
                    onClick={handleGenerateZip}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border-[1.5px] border-[#2F3E4E] bg-[#CEE5DC] hover:bg-[#bddbd0] text-[#2F3E4E] transition cursor-pointer disabled:opacity-40 whitespace-nowrap"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>Download ZIP</span>
                  </button>

                  <button
                    type="button"
                    disabled={isGenerating || validationResult.validRecords === 0}
                    onClick={handleGenerateCombinedPdf}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#2F3E4E] hover:bg-[#1E293B] text-white transition cursor-pointer disabled:opacity-40 whitespace-nowrap"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Combined PDF ({validationResult.validRecords})</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="text-[11px] text-[#475569] flex items-center gap-1.5 pt-1">
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span>Spreadsheet rows are parsed and rendered into A4 PDFs offline—zero data is uploaded to any server.</span>
          </div>
        </div>
      </div>

      {/* Hidden Offscreen Render Node for html2canvas batch capture */}
      {renderingPayload && (
        <div
          style={{
            position: 'fixed',
            left: '-100000px',
            top: 0,
            pointerEvents: 'none',
            background: '#ffffff',
          }}
        >
          <div
            id="bulk-active-capture-node"
            className={`bank-slip ${renderingPayload.fontClass} ${
              slipPrintMode === 'data' ? 'dataonly' : ''
            }`}
            style={{
              width: `${renderingPayload.width}px`,
              height: `${renderingPayload.height}px`,
              transform: 'none',
            }}
            dangerouslySetInnerHTML={{ __html: renderingPayload.html }}
          />
        </div>
      )}
    </div>
  );
};
