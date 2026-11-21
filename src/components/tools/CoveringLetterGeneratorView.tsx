import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  ClipboardCopy,
  Download,
  FileText,
  HardDrive,
  Loader2,
  Lock,
  PenTool,
  Plus,
  Printer,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { ToolCatalogItem } from '../../types/tools';
import {
  amountInWords,
  buildCoveringLetterHtml,
  computeLedgerAuditFlags,
  CoveringLetterFormat,
  CoveringLetterFormState,
  CoveringPaymentRow,
  createPaymentId,
  dateSortKey,
  downloadCoveringLetterDoc,
  extractInfo,
  extractPdfLines,
  getLetterDensityStyle,
  inr,
  isImageFile,
  LetterDensityLevel,
  num,
  ParsedLedgerResult,
  parseLedger,
  processImageToDataUrl,
  RegType,
  renderPdfLetterheadToDataUrl,
  runOcrLines,
  terminateCoveringOcrWorker,
  todayDotDate,
} from '../../utils/coveringLetterEngine';
import { FileDropZone } from './FileDropZone';
import { ToolPasscodeGate } from './ToolPasscodeGate';

interface CoveringLetterGeneratorViewProps {
  tool?: ToolCatalogItem;
  onBack?: () => void;
}

interface RefPreviewItem {
  id: string;
  name: string;
  url: string;
}

interface LogEntry {
  id: string;
  fileName: string;
  method: string;
  summary: string;
  matched: boolean;
}

const BRANDING_STORAGE_KEY = 'vcpl_covering_letter_branding_v1';

interface SavedBranding {
  letterFormat?: CoveringLetterFormat;
  headerTopMm?: number;
  footerBottomMm?: number;
  letterheadDataUrl?: string;
  letterheadName?: string;
  signatureDataUrl?: string;
  signatureName?: string;
  sigHeightPx?: number;
}

function readSavedBranding(): SavedBranding {
  try {
    const raw = window.localStorage.getItem(BRANDING_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as SavedBranding;
  } catch {
    return {};
  }
}

function getInitialFormState(): CoveringLetterFormState {
  const saved = readSavedBranding();
  return {
    letterFormat: saved.letterFormat === 'modern_box' ? 'modern_box' : 'classic',
    fdate: todayDotDate(),
    phone: '6366227903',
    cphone: '',
    cname: '',
    caddr: '',
    car: '',
    colour: '',
    vin: '',
    engineNo: '',
    cpan: '',
    cgst: '',
    showIds: false,
    regType: 'perm',
    regNo: '',
    taxChk: true,
    email: '',
    extra: '',
    showWho: true,
    onroad: '',
    ack: false,
    headerTopMm:
      typeof saved.headerTopMm === 'number' && saved.headerTopMm >= 10 && saved.headerTopMm <= 80
        ? saved.headerTopMm
        : 36,
    footerBottomMm:
      typeof saved.footerBottomMm === 'number' &&
      saved.footerBottomMm >= 12 &&
      saved.footerBottomMm <= 60
        ? saved.footerBottomMm
        : 26,
    letterheadDataUrl: saved.letterheadDataUrl || '',
    letterheadName: saved.letterheadName || '',
    signatureDataUrl: saved.signatureDataUrl || '',
    signatureName: saved.signatureName || '',
    sigHeightPx:
      typeof saved.sigHeightPx === 'number' && saved.sigHeightPx >= 28 && saved.sigHeightPx <= 96
        ? saved.sigHeightPx
        : 52,
  };
}

export const CoveringLetterGeneratorView: React.FC<CoveringLetterGeneratorViewProps> = ({
  tool,
  onBack,
}) => {
  return (
    <ToolPasscodeGate
      toolCode={`${tool?.code ?? 'VC-08'} · ${tool?.suite ?? 'VCPL Tools'}`}
      toolTitle={tool?.title ?? 'Covering Letter Generator'}
      sessionKey="vcpl_covering_letter_unlocked_v1"
      passcode="202627"
      description="Authorized dealership access required for Covering Letter Generator. Enter the 6-digit passcode to unlock."
      onBack={onBack}
    >
      {({ lockTool }) => (
        <CoveringLetterGeneratorInner tool={tool} onBack={onBack} lockTool={lockTool} />
      )}
    </ToolPasscodeGate>
  );
};

interface CoveringLetterGeneratorInnerProps {
  tool?: ToolCatalogItem;
  onBack?: () => void;
  lockTool: () => void;
}

const CoveringLetterGeneratorInner: React.FC<CoveringLetterGeneratorInnerProps> = ({
  tool,
  onBack,
  lockTool,
}) => {
  const [form, setForm] = useState<CoveringLetterFormState>(getInitialFormState);
  const [pays, setPays] = useState<CoveringPaymentRow[]>([]);
  const [ledger, setLedger] = useState<ParsedLedgerResult | null>(null);
  const [onroadAuto, setOnroadAuto] = useState(false);

  const [refs, setRefs] = useState<RefPreviewItem[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [progressMsg, setProgressMsg] = useState<string>('');
  const [isBusy, setIsBusy] = useState(false);
  const [copiedDetails, setCopiedDetails] = useState(false);
  const [zoomedRef, setZoomedRef] = useState<RefPreviewItem | null>(null);
  const [amtDrafts, setAmtDrafts] = useState<Record<string, string>>({});

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const letterheadInputRef = useRef<HTMLInputElement | null>(null);
  const signatureInputRef = useRef<HTMLInputElement | null>(null);
  const refsUrlPool = useRef<string[]>([]);
  const previewStageRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [previewScale, setPreviewScale] = useState(0.78);
  const [fitState, setFitState] = useState<{ density: LetterDensityLevel; contentScale: number }>({
    density: 0,
    contentScale: 1,
  });
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [exportNotice, setExportNotice] = useState('');
  const [brandingBusy, setBrandingBusy] = useState(false);
  const [brandingError, setBrandingError] = useState('');
  const [removeSigWhiteBg, setRemoveSigWhiteBg] = useState(true);

  useEffect(() => {
    try {
      const payload: SavedBranding = {
        letterFormat: form.letterFormat,
        headerTopMm: form.headerTopMm,
        footerBottomMm: form.footerBottomMm,
        letterheadDataUrl: form.letterheadDataUrl,
        letterheadName: form.letterheadName,
        signatureDataUrl: form.signatureDataUrl,
        signatureName: form.signatureName,
        sigHeightPx: form.sigHeightPx,
      };
      window.localStorage.setItem(BRANDING_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors for large letterhead images
    }
  }, [
    form.letterFormat,
    form.headerTopMm,
    form.footerBottomMm,
    form.letterheadDataUrl,
    form.letterheadName,
    form.signatureDataUrl,
    form.signatureName,
    form.sigHeightPx,
  ]);

  // Revoke object URLs and OCR worker cleanly on unmount
  useEffect(() => {
    return () => {
      for (const u of refsUrlPool.current) {
        URL.revokeObjectURL(u);
      }
      refsUrlPool.current = [];
      void terminateCoveringOcrWorker();
    };
  }, []);

  // Measure preview stage width so A4 fits cleanly with zero horizontal scrollbar
  useEffect(() => {
    const A4_WIDTH_PX = 794;
    const A4_HEIGHT_PX = 1123;
    const stageEl = previewStageRef.current;

    const updateMetrics = () => {
      if (stageEl) {
        const available = stageEl.clientWidth - 24;
        if (available > 0) {
          const widthScale = available / A4_WIDTH_PX;
          const isDesktopSplit = typeof window !== 'undefined' && window.innerWidth >= 1280;
          const heightScale = isDesktopSplit
            ? Math.max(460, window.innerHeight - 195) / A4_HEIGHT_PX
            : 1;
          setPreviewScale(Math.min(1, Math.max(0.28, Math.min(widthScale, heightScale))));
        }
      }
    };

    updateMetrics();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateMetrics);
      return () => window.removeEventListener('resize', updateMetrics);
    }

    let rafId = 0;
    const scheduleUpdate = () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        updateMetrics();
      });
    };
    const ro = new ResizeObserver(scheduleUpdate);
    if (stageEl) ro.observe(stageEl);
    window.addEventListener('resize', scheduleUpdate);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      ro.disconnect();
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, []);

  const updateField = <K extends keyof CoveringLetterFormState>(
    key: K,
    value: CoveringLetterFormState[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetAll = () => {
    for (const u of refsUrlPool.current) {
      URL.revokeObjectURL(u);
    }
    refsUrlPool.current = [];
    setForm((prev) => ({
      ...getInitialFormState(),
      letterFormat: prev.letterFormat,
      headerTopMm: prev.headerTopMm,
      footerBottomMm: prev.footerBottomMm,
      letterheadDataUrl: prev.letterheadDataUrl,
      letterheadName: prev.letterheadName,
      signatureDataUrl: prev.signatureDataUrl,
      signatureName: prev.signatureName,
      sigHeightPx: prev.sigHeightPx,
    }));
    setPays([]);
    setLedger(null);
    setOnroadAuto(false);
    setRefs([]);
    setLogs([]);
    setAmtDrafts({});
    setProgressMsg('');
    setCopiedDetails(false);
    setZoomedRef(null);
  };

  const handleUploadLetterhead = async (file: File | undefined | null) => {
    if (!file) return;
    setBrandingBusy(true);
    setBrandingError('');
    try {
      const isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
      const dataUrl = isPdf
        ? await renderPdfLetterheadToDataUrl(file)
        : await processImageToDataUrl(file, { maxDim: 1800 });
      setForm((prev) => ({
        ...prev,
        letterheadDataUrl: dataUrl,
        letterheadName: file.name,
      }));
    } catch (err) {
      setBrandingError(
        err instanceof Error ? err.message : 'Could not load letterhead PDF/image.'
      );
    } finally {
      setBrandingBusy(false);
    }
  };

  const handleUploadSignature = async (file: File | undefined | null) => {
    if (!file) return;
    setBrandingBusy(true);
    setBrandingError('');
    try {
      const dataUrl = await processImageToDataUrl(file, {
        trimWhitespace: true,
        removeWhiteBg: removeSigWhiteBg,
        maxDim: 900,
      });
      setForm((prev) => ({
        ...prev,
        signatureDataUrl: dataUrl,
        signatureName: file.name,
      }));
    } catch (err) {
      setBrandingError(
        err instanceof Error ? err.message : 'Could not load signature image.'
      );
    } finally {
      setBrandingBusy(false);
    }
  };

  const processFiles = async (fileList: File[]) => {
    if (!fileList.length) return;
    setIsBusy(true);

    // Work against live snapshots so sequential files in the same batch accumulate properly
    let nextForm = { ...form };
    let nextPays = [...pays];
    let nextOnroadAuto = onroadAuto;
    let latestLedger = ledger;
    const newLogs: LogEntry[] = [];
    const newRefs: RefPreviewItem[] = [];

    try {
      for (const f of fileList) {
        try {
          let lines: string[] = [];
          let method = 'text';

          if (isImageFile(f)) {
            const url = URL.createObjectURL(f);
            refsUrlPool.current.push(url);
            newRefs.push({ id: createPaymentId(), name: f.name, url });
            method = 'OCR';
            lines = await runOcrLines(f, f.name, setProgressMsg);
          } else if (/\.pdf$/i.test(f.name) || f.type === 'application/pdf') {
            setProgressMsg(`Reading ${f.name}...`);
            const res = await extractPdfLines(f, setProgressMsg);
            lines = res.lines;
            method = res.ocrPages ? `${res.ocrPages} page(s) OCR` : 'text';
          } else {
            newLogs.push({
              id: createPaymentId(),
              fileName: f.name,
              method: 'skipped',
              summary: 'unsupported file type (upload PDF or image)',
              matched: false,
            });
            continue;
          }

          const found: string[] = [];
          const L = parseLedger(lines);
          const E = extractInfo(lines);

          const addPay = (r: CoveringPaymentRow) => {
            if (!nextPays.some((p) => p.rno && r.rno && p.rno === r.rno)) {
              nextPays.push(r);
            }
          };

          if (L.res.length || L.name) {
            if (L.res.length) {
              L.res.forEach(addPay);
              found.push(
                `${L.res.length} receipts (${L.res.filter((r) => r.loan).length} loan)`
              );
            }
            latestLedger = L;

            if (L.name) {
              nextForm.cname = L.name;
              found.push('customer');
            }
            if (L.addr) {
              nextForm.caddr = L.addr;
            }
            if (L.car) {
              nextForm.car = L.carModel || L.car;
              if (L.colour) nextForm.colour = L.colour;
              found.push('car');
            }
            if (L.vin && !nextForm.vin) {
              nextForm.vin = L.vin;
            }
            if (L.engine && !nextForm.engineNo) {
              nextForm.engineNo = L.engine;
            }
            if (L.charged && !nextForm.onroad) {
              nextForm.onroad = inr(L.charged);
              nextOnroadAuto = true;
              found.push('total charged from ledger');
            }
          }

          if (E.pay) {
            addPay(E.pay);
            found.push(`receipt ${E.pay.rno} - verify`);
          }
          if (E.name && !latestLedger?.name && !nextForm.cname) {
            nextForm.cname = E.name;
            nextForm.caddr = E.addr || nextForm.caddr;
            found.push('customer');
          }
          if (E.email && !nextForm.email) {
            nextForm.email = E.email;
            found.push('email');
          }
          if (E.cphone && !nextForm.cphone) {
            nextForm.cphone = E.cphone;
            found.push('contact no');
          }
          if (E.vin && !nextForm.vin) {
            nextForm.vin = E.vin;
          }
          if (E.engine && !nextForm.engineNo) {
            nextForm.engineNo = E.engine;
          }
          if (E.reg && !nextForm.regNo) {
            nextForm.regNo = E.reg;
            found.push('reg no');
          }
          if (E.temp && !E.reg) {
            nextForm.regType = 'temp';
            found.push('temporary registration');
          }
          if (E.pan && !nextForm.cpan) {
            nextForm.cpan = E.pan;
            found.push('PAN');
          }
          if (E.gst && !nextForm.cgst) {
            nextForm.cgst = E.gst;
            found.push('GSTIN');
          }
          if (E.onroad && (!nextForm.onroad || nextOnroadAuto)) {
            nextForm.onroad = E.onroad;
            nextOnroadAuto = false;
            found.push('on-road price');
          }

          newLogs.push({
            id: createPaymentId(),
            fileName: f.name,
            method,
            summary: found.length ? found.join(', ') : 'nothing matched, enter manually',
            matched: found.length > 0,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          newLogs.push({
            id: createPaymentId(),
            fileName: f.name,
            method: 'error',
            summary: `could not read (${msg})`,
            matched: false,
          });
        }
      }

      nextPays.sort((a, b) => dateSortKey(a.date).localeCompare(dateSortKey(b.date)));

      setForm(nextForm);
      setPays(nextPays);
      setOnroadAuto(nextOnroadAuto);
      setLedger(latestLedger);
      if (newRefs.length) setRefs((prev) => [...prev, ...newRefs]);
      if (newLogs.length) setLogs((prev) => [...prev, ...newLogs]);
    } finally {
      setIsBusy(false);
      setProgressMsg('');
    }
  };

  const handleRemoveRef = (refItem: RefPreviewItem) => {
    URL.revokeObjectURL(refItem.url);
    refsUrlPool.current = refsUrlPool.current.filter((u) => u !== refItem.url);
    setRefs((prev) => prev.filter((r) => r.id !== refItem.id));
    if (zoomedRef?.id === refItem.id) setZoomedRef(null);
  };

  const handlePaymentFieldChange = (
    id: string,
    field: 'date' | 'mode' | 'rno',
    value: string
  ) => {
    setPays((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const handlePaymentAmtChange = (id: string, rawText: string) => {
    setAmtDrafts((prev) => ({ ...prev, [id]: rawText }));
    const parsed = num(rawText);
    setPays((prev) => prev.map((p) => (p.id === id ? { ...p, amt: parsed } : p)));
  };

  const handlePaymentAmtBlur = (id: string) => {
    setAmtDrafts((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  const handleMovePayment = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= pays.length) return;
    setPays((prev) => {
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const handleDeletePayment = (id: string) => {
    setPays((prev) => prev.filter((p) => p.id !== id));
    setAmtDrafts((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  const handleAddPayment = () => {
    setPays((prev) => [
      ...prev,
      {
        id: createPaymentId(),
        date: '',
        mode: 'RTGS',
        rno: '',
        amt: 0,
        nar: '',
        who: '',
        payer: '',
        loan: false,
        bank: '',
        li: null,
      },
    ]);
  };

  const totalReceived = useMemo(
    () => pays.reduce((sum, p) => sum + (Number.isFinite(p.amt) ? p.amt : 0), 0),
    [pays]
  );

  const totalWords = useMemo(() => amountInWords(totalReceived), [totalReceived]);

  const onroadTarget = useMemo(() => num(form.onroad), [form.onroad]);
  const onroadDiff = useMemo(
    () => (onroadTarget > 0 ? onroadTarget - totalReceived : 0),
    [onroadTarget, totalReceived]
  );

  const extractedSummary = useMemo(() => {
    if (!ledger) return null;
    const flags = computeLedgerAuditFlags(ledger, pays);
    const loanInfo = pays.find((p) => p.loan && p.li)?.li ?? null;

    const rows: Array<[string, string]> = [
      ['Name', form.cname.trim() || ledger.name],
      [
        `Address${ledger.rel ? ` (${ledger.rel})` : ''}`,
        ledger.addrFlat || form.caddr.replace(/\n+/g, ', '),
      ],
      ['Car', form.car.trim() || ledger.car],
      ['VIN', ledger.vin],
      ['Engine no', ledger.engine],
      ['Registration no', form.regNo.trim()],
      ['HP (hypothecation)', ledger.hp],
    ];

    if (loanInfo) {
      rows.push(
        ['Loan A/c no', loanInfo.acc],
        ['Loan sanctioned', loanInfo.gross ? `Rs. ${inr(loanInfo.gross)}` : ''],
        ['Fees', loanInfo.fees ? `Rs. ${inr(loanInfo.fees)}` : ''],
        ['Net loan received', loanInfo.net ? `Rs. ${inr(loanInfo.net)}` : ''],
        ['Loan date', loanInfo.dated]
      );
    }

    rows.push(
      ['Total received', ledger.debited ? `Rs. ${inr(ledger.debited)}` : ''],
      ['Total charged', ledger.charged ? `Rs. ${inr(ledger.charged)}` : '']
    );

    const visibleRows = rows.filter((r) => r[1] && r[1] !== 'Rs. 0');
    const copyText = visibleRows.map((r) => `${r[0]}: ${r[1]}`).join('\n');

    return { visibleRows, flags, copyText };
  }, [form.caddr, form.car, form.cname, form.regNo, ledger, pays]);

  const MM_TO_PX = 96 / 25.4;
  const A4_WIDTH_PX = 794;
  const A4_HEIGHT_PX = 1123;
  const topSpaceMm = Math.min(80, Math.max(10, Number(form.headerTopMm) || 36));
  const bottomSpaceMm = Math.min(60, Math.max(12, Number(form.footerBottomMm) || 26));
  const printableWidthPx = Math.floor(A4_WIDTH_PX - 36 * MM_TO_PX);
  const availableContentHeightPx = Math.max(
    320,
    Math.floor(A4_HEIGHT_PX - (topSpaceMm + bottomSpaceMm) * MM_TO_PX)
  );

  useLayoutEffect(() => {
    const measurer = document.createElement('div');
    measurer.style.position = 'fixed';
    measurer.style.left = '-10000px';
    measurer.style.top = '0';
    measurer.style.width = `${printableWidthPx}px`;
    measurer.style.boxSizing = 'border-box';
    measurer.style.visibility = 'hidden';
    measurer.style.pointerEvents = 'none';
    measurer.style.fontFamily = "Cambria, Georgia, 'Times New Roman', serif";

    const styleEl = document.createElement('style');
    styleEl.textContent =
      'ol { list-style-type: decimal !important; list-style-position: outside !important; padding-left: 24px !important; } ' +
      'ol li { display: list-item !important; list-style-type: decimal !important; padding-left: 6px !important; }';
    const inner = document.createElement('div');
    measurer.appendChild(styleEl);
    measurer.appendChild(inner);
    document.body.appendChild(measurer);

    let chosenDensity: LetterDensityLevel = 0;
    let chosenScale = 1;

    try {
      const levels: LetterDensityLevel[] = [0, 1, 2];
      for (const level of levels) {
        const ds = getLetterDensityStyle(level);
        inner.style.fontSize = `${ds.fontPt}pt`;
        inner.style.lineHeight = String(ds.lineHeight);
        inner.innerHTML = buildCoveringLetterHtml(form, pays, level);
        const h = Math.max(inner.scrollHeight, Math.ceil(inner.getBoundingClientRect().height));
        chosenDensity = level;
        if (h <= availableContentHeightPx) {
          chosenScale = 1;
          break;
        }
        if (level === 2) {
          chosenScale = Math.max(0.55, Math.min(1, (availableContentHeightPx - 2) / h));
        }
      }
    } finally {
      document.body.removeChild(measurer);
    }

    setFitState((prev) =>
      prev.density === chosenDensity && Math.abs(prev.contentScale - chosenScale) < 0.002
        ? prev
        : { density: chosenDensity, contentScale: chosenScale }
    );
  }, [form, pays, printableWidthPx, availableContentHeightPx]);

  const densitySpec = useMemo(() => getLetterDensityStyle(fitState.density), [fitState.density]);

  const letterBodyHtml = useMemo(
    () => buildCoveringLetterHtml(form, pays, fitState.density),
    [form, pays, fitState.density]
  );

  const handleCopyExtracted = async () => {
    if (!extractedSummary?.copyText) return;
    try {
      await navigator.clipboard.writeText(extractedSummary.copyText);
      setCopiedDetails(true);
      window.setTimeout(() => setCopiedDetails(false), 1800);
    } catch {
      // Fallback textarea copy
      const ta = document.createElement('textarea');
      ta.value = extractedSummary.copyText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedDetails(true);
      window.setTimeout(() => setCopiedDetails(false), 1800);
    }
  };

  const handleSavePdf = async () => {
    if (isExportingPdf) return;
    setIsExportingPdf(true);
    setExportNotice('');

    const stage = document.createElement('div');
    stage.style.position = 'fixed';
    stage.style.left = '-10000px';
    stage.style.top = '0';
    stage.style.width = `${A4_WIDTH_PX}px`;
    stage.style.height = `${A4_HEIGHT_PX}px`;
    stage.style.overflow = 'hidden';
    stage.style.background = '#ffffff';
    stage.style.zIndex = '-1';
    stage.setAttribute('aria-hidden', 'true');

    const sheet = document.createElement('div');
    sheet.style.position = 'relative';
    sheet.style.width = `${A4_WIDTH_PX}px`;
    sheet.style.height = `${A4_HEIGHT_PX}px`;
    sheet.style.overflow = 'hidden';
    sheet.style.padding = `${topSpaceMm}mm 18mm ${bottomSpaceMm}mm 18mm`;
    sheet.style.boxSizing = 'border-box';
    sheet.style.background = '#ffffff';
    sheet.style.color = '#111827';
    sheet.style.fontFamily = "Cambria, Georgia, 'Times New Roman', serif";
    sheet.style.fontSize = `${densitySpec.fontPt}pt`;
    sheet.style.lineHeight = String(densitySpec.lineHeight);

    const letterheadBgHtml = form.letterheadDataUrl
      ? `<img src="${form.letterheadDataUrl}" alt="" style="position:absolute;top:0;left:0;width:${A4_WIDTH_PX}px;height:${A4_HEIGHT_PX}px;object-fit:fill;z-index:0;pointer-events:none;" />`
      : '';

    const scaledBodyStyle =
      fitState.contentScale < 1
        ? `width:${(100 / fitState.contentScale).toFixed(3)}%;transform:scale(${fitState.contentScale});transform-origin:top left;`
        : 'width:100%;';

    sheet.innerHTML =
      `<style>
        ol { list-style-type: decimal !important; list-style-position: outside !important; padding-left: 24px !important; }
        ol li { display: list-item !important; list-style-type: decimal !important; padding-left: 6px !important; }
      </style>` +
      letterheadBgHtml +
      `<div style="position:relative;z-index:1;width:100%;height:${availableContentHeightPx}px;overflow:hidden;"><div style="${scaledBodyStyle}">${letterBodyHtml}</div></div>`;

    stage.appendChild(sheet);
    document.body.appendChild(stage);

    try {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }

      const imgs = Array.from(sheet.querySelectorAll('img'));
      await Promise.all(
        imgs.map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                img.onload = () => resolve();
                img.onerror = () => resolve();
              })
        )
      );

      const canvas = await html2canvas(sheet, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        width: A4_WIDTH_PX,
        height: A4_HEIGHT_PX,
        windowWidth: A4_WIDTH_PX,
        windowHeight: A4_HEIGHT_PX,
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.96);
      pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);

      const formatTag = form.letterFormat === 'modern_box' ? 'NewFormat' : 'OldFormat';
      const fileName = `Covering_${(form.cname.trim() || 'Customer').replace(/[^\w]+/g, '_')}_${formatTag}.pdf`;
      pdf.save(fileName);
      setExportNotice(`Saved ${fileName} (Single-page A4)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setExportNotice(`Could not generate PDF: ${msg}`);
    } finally {
      document.body.removeChild(stage);
      setIsExportingPdf(false);
    }
  };

  const handlePrint = async () => {
    setExportNotice('');
    try {
      const existingFrame = document.getElementById('vcpl-covering-print-frame');
      if (existingFrame && existingFrame.parentNode) {
        existingFrame.parentNode.removeChild(existingFrame);
      }

      const iframe = document.createElement('iframe');
      iframe.id = 'vcpl-covering-print-frame';
      iframe.setAttribute('aria-hidden', 'true');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);

      const iframeWin = iframe.contentWindow;
      const iframeDoc = iframeWin?.document;
      if (!iframeWin || !iframeDoc) {
        window.print();
        return;
      }

      const letterheadBgHtml = form.letterheadDataUrl
        ? `<img class="vcpl-print-letterhead" src="${form.letterheadDataUrl}" alt="" />`
        : '';

      const scaledBodyStyle =
        fitState.contentScale < 1
          ? `width:${(100 / fitState.contentScale).toFixed(3)}%;transform:scale(${fitState.contentScale});transform-origin:top left;`
          : 'width:100%;';

      const docTitle = `Covering_${(form.cname.trim() || 'Customer').replace(/[^\w]+/g, '_')}`;

      iframeDoc.open();
      iframeDoc.write(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${docTitle}</title>
    <style>
      @page {
        size: A4 portrait;
        margin: 0;
      }
      * {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      html, body {
        margin: 0;
        padding: 0;
        width: 210mm;
        height: 296.5mm;
        background: #ffffff;
        color: #111827;
        overflow: hidden;
      }
      .vcpl-print-sheet {
        position: relative;
        width: 210mm;
        height: 296.5mm;
        padding: ${topSpaceMm}mm 18mm ${bottomSpaceMm}mm 18mm;
        overflow: hidden;
        background: #ffffff;
        color: #111827;
        font-family: Cambria, Georgia, 'Times New Roman', serif;
        font-size: ${densitySpec.fontPt}pt;
        line-height: ${densitySpec.lineHeight};
      }
      .vcpl-print-letterhead {
        position: absolute;
        top: 0;
        left: 0;
        width: 210mm;
        height: 296.5mm;
        object-fit: fill;
        z-index: 0;
        pointer-events: none;
      }
      .vcpl-print-body-clip {
        position: relative;
        z-index: 1;
        width: 100%;
        height: calc(296.5mm - ${topSpaceMm + bottomSpaceMm}mm);
        overflow: hidden;
      }
      ol {
        list-style-type: decimal !important;
        list-style-position: outside !important;
        padding-left: 24px !important;
      }
      ol li {
        display: list-item !important;
        list-style-type: decimal !important;
        padding-left: 6px !important;
      }
      table {
        border-collapse: collapse;
        width: 100%;
        max-width: 100%;
      }
      p, td, th, li {
        overflow-wrap: break-word;
        word-break: break-word;
      }
    </style>
  </head>
  <body>
    <div class="vcpl-print-sheet">
      ${letterheadBgHtml}
      <div class="vcpl-print-body-clip">
        <div style="${scaledBodyStyle}">${letterBodyHtml}</div>
      </div>
    </div>
  </body>
</html>`);
      iframeDoc.close();

      if (iframeDoc.fonts?.ready) {
        await Promise.race([
          iframeDoc.fonts.ready,
          new Promise((resolve) => window.setTimeout(resolve, 600)),
        ]);
      }

      const imgs = Array.from(iframeDoc.images);
      if (imgs.length > 0) {
        await Promise.race([
          Promise.all(
            imgs.map((img) =>
              img.complete
                ? Promise.resolve()
                : new Promise<void>((resolve) => {
                    img.onload = () => resolve();
                    img.onerror = () => resolve();
                  })
            )
          ),
          new Promise<void>((resolve) => window.setTimeout(resolve, 1500)),
        ]);
      }

      const cleanup = () => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      };
      iframeWin.addEventListener('afterprint', cleanup, { once: true });

      iframeWin.focus();
      iframeWin.print();
    } catch {
      try {
        window.print();
      } catch {
        setExportNotice('Browser print dialog was blocked here — use Save PDF instead.');
      }
    }
  };

  return (
    <div className="space-y-6">
      <style>{`
        #covering-a4-sheet {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        #covering-a4-sheet ol {
          list-style-type: decimal !important;
          list-style-position: outside !important;
          padding-left: 24px !important;
        }
        #covering-a4-sheet ol li {
          display: list-item !important;
          list-style-type: decimal !important;
          padding-left: 6px !important;
        }
        @media print {
          @page { size: A4 portrait; margin: 0; }
          html, body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 210mm !important;
            height: 296.5mm !important;
            overflow: hidden !important;
          }
          #covering-a4-stage {
            display: block !important;
            width: 210mm !important;
            padding: 0 !important;
            border: 0 !important;
            background: transparent !important;
            box-shadow: none !important;
            overflow: hidden !important;
            margin: 0 !important;
          }
          #covering-a4-scale-box {
            width: 210mm !important;
            height: 296.5mm !important;
            overflow: hidden !important;
            margin: 0 !important;
          }
          #covering-a4-sheet {
            transform: none !important;
            width: 210mm !important;
            height: 296.5mm !important;
            min-height: 0 !important;
            max-height: 296.5mm !important;
            padding: ${topSpaceMm}mm 18mm ${bottomSpaceMm}mm 18mm !important;
            overflow: hidden !important;
            border: 0 !important;
            box-shadow: none !important;
            margin: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #covering-a4-sheet > img {
            width: 210mm !important;
            height: 296.5mm !important;
          }
        }
      `}</style>

      {/* VCPL Header Banner */}
      <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 sm:p-6 shadow-[0_4px_0_#2F3E4E] flex flex-wrap items-center justify-between gap-4 no-print">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] shadow-[0_2px_0_#2F3E4E] flex items-center justify-center text-[#2F3E4E] shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#475569]">
              <span className="font-mono font-bold text-[#2F3E4E]">
                {tool?.code || 'VC-08'} · {tool?.suite || 'VCPL Tools'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#2F3E4E] text-[11px] font-bold text-[#F9C80E]">
                <Lock className="w-3 h-3" aria-hidden="true" />
                <span>Passcode Unlocked</span>
              </span>
              <span aria-hidden="true">·</span>
              <span>Varsha Cars Pvt Ltd</span>
              <span aria-hidden="true">·</span>
              <span>Tally Ledger PDF &amp; OCR</span>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-[#12805C] inline-flex items-center gap-1">
                <HardDrive className="w-3.5 h-3.5" aria-hidden="true" />
                100% Browser Private
              </span>
            </div>
            <h1 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] mt-1">
              {tool?.title || 'Covering Letter Generator'}
            </h1>
            <p className="text-xs sm:text-sm text-[#475569] mt-0.5">
              Drop Tally customer ledger PDFs, receipt vouchers, registration certificates, or screenshots to auto-fill and export Varsha Cars A4 Print/PDF &amp; Word covering letters.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleResetAll}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#FFE1B3] text-xs font-bold text-[#2F3E4E] cursor-pointer transition whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset All</span>
          </button>
          <button
            type="button"
            onClick={lockTool}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] cursor-pointer transition whitespace-nowrap"
          >
            <Lock className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Lock Tool</span>
          </button>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] cursor-pointer transition whitespace-nowrap"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Main Split Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start print:block">
        {/* Left Control Column (Scrollable Working Area on Desktop) */}
        <div className="xl:col-span-5 xl:max-h-[calc(100dvh-5.5rem)] xl:overflow-y-auto xl:pr-1.5 space-y-4 no-print">
          {/* 0. Format Selector */}
          <section className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-4 sm:p-5 shadow-[0_4px_0_#2F3E4E] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display font-extrabold text-base text-[#2F3E4E]">
                Covering Letter Format
              </h2>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-[#FEF2C8] border border-[#2F3E4E]/30 text-[#2F3E4E]">
                {form.letterFormat === 'modern_box' ? 'New Format Active' : 'Old Format Active'}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => updateField('letterFormat', 'classic')}
                className={`p-3 rounded-xl border-[1.5px] text-left cursor-pointer transition ${
                  form.letterFormat === 'classic'
                    ? 'border-[#2F3E4E] bg-[#F9C80E] shadow-[0_2px_0_#2F3E4E] text-[#2F3E4E]'
                    : 'border-[#2F3E4E]/35 bg-white hover:bg-[#FEF2C8]/70 text-[#2F3E4E]'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="font-display font-extrabold text-xs sm:text-sm">
                    Old Format (Classic)
                  </span>
                  {form.letterFormat === 'classic' && (
                    <CheckCircle2 className="w-4 h-4 text-[#2F3E4E] shrink-0" />
                  )}
                </div>
                <p className="text-[11px] text-[#334155] mt-1 leading-snug">
                  Standard single-column table, paragraph summary &amp; numbered enclosures
                </p>
              </button>

              <button
                type="button"
                onClick={() => updateField('letterFormat', 'modern_box')}
                className={`p-3 rounded-xl border-[1.5px] text-left cursor-pointer transition ${
                  form.letterFormat === 'modern_box'
                    ? 'border-[#2F3E4E] bg-[#F9C80E] shadow-[0_2px_0_#2F3E4E] text-[#2F3E4E]'
                    : 'border-[#2F3E4E]/35 bg-white hover:bg-[#FEF2C8]/70 text-[#2F3E4E]'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="font-display font-extrabold text-xs sm:text-sm">
                    New Format (Boxed Layout)
                  </span>
                  {form.letterFormat === 'modern_box' && (
                    <CheckCircle2 className="w-4 h-4 text-[#2F3E4E] shrink-0" />
                  )}
                </div>
                <p className="text-[11px] text-[#334155] mt-1 leading-snug">
                  2-column car specs, bold ₹ sum banner, side-by-side payment &amp; enclosure box
                </p>
              </button>
            </div>
            <p className="text-[11px] text-[#64748B]">
              Applies directly to Live A4 Preview, Save PDF, Print &amp; Word (.doc) export.
            </p>
          </section>

          {/* 1. Upload / Drop Zone */}
          <section className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-4 sm:p-5 shadow-[0_4px_0_#2F3E4E] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display font-extrabold text-base text-[#2F3E4E]">
                1. Upload Ledger PDFs &amp; Screenshots
              </h2>
              {isBusy && (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#B45309]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing...</span>
                </span>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,application/pdf,image/*"
              className="hidden"
              onChange={(e) => {
                const files = e.target.files ? Array.from(e.target.files) : [];
                e.target.value = '';
                if (files.length) void processFiles(files);
              }}
            />

            <FileDropZone
              accept=".pdf,application/pdf,image/*"
              multiple
              disabled={isBusy}
              onFiles={(files) => {
                void processFiles(files);
              }}
              className="border-2 border-dashed border-[#2F3E4E]/55 hover:border-[#2F3E4E] bg-[#FEF2C8]/55 hover:bg-[#FEF2C8] rounded-xl transition"
            >
              <div
                onClick={() => {
                  if (!isBusy) fileInputRef.current?.click();
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
                  if ((e.key === 'Enter' || e.key === ' ') && !isBusy) {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                className="p-4 text-center cursor-pointer space-y-1.5"
              >
                <div className="w-9 h-9 mx-auto rounded-lg bg-[#CEE5DC] border border-[#2F3E4E] flex items-center justify-center text-[#2F3E4E]">
                  <Upload className="w-4 h-4" />
                </div>
                <p className="text-xs sm:text-sm font-bold text-[#2F3E4E]">
                  Drag &amp; drop or click to upload PDFs &amp; images
                </p>
                <p className="text-[11px] text-[#475569]">
                  Tally ledger PDF, receipt vouchers, RC/TR certificates, sale contracts &amp; screenshots
                </p>
              </div>
            </FileDropZone>

            <p className="text-[11px] text-[#64748B] leading-relaxed">
              PDFs with embedded text are parsed instantly. Scanned PDFs and screenshots run through local Tesseract OCR (first load downloads English OCR data; always verify handwritten entries).
            </p>

            {progressMsg && (
              <div className="px-3 py-2 rounded-lg bg-[#FFE1B3] border border-[#2F3E4E]/40 text-xs font-semibold text-[#2F3E4E] flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                <span className="truncate">{progressMsg}</span>
              </div>
            )}

            {logs.length > 0 && (
              <div className="max-h-32 overflow-y-auto rounded-xl border border-[#2F3E4E]/20 bg-white p-2.5 space-y-1 text-[11px]">
                {logs.map((entry) => (
                  <div key={entry.id} className="leading-snug text-[#334155]">
                    <span className="font-bold text-[#2F3E4E]">{entry.fileName}</span>{' '}
                    <span className="font-mono text-[10px] px-1 py-0.5 rounded bg-[#FEF2C8] text-[#2F3E4E]">
                      {entry.method}
                    </span>
                    {': '}
                    <span className={entry.matched ? 'text-[#12805C] font-semibold' : 'text-[#64748B]'}>
                      {entry.summary}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {refs.length > 0 && (
              <div className="space-y-2 pt-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#475569]">
                  Reference Screenshots ({refs.length})
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {refs.map((r) => (
                    <div
                      key={r.id}
                      className="relative group rounded-lg border border-[#2F3E4E]/35 bg-white overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => setZoomedRef(r)}
                        className="block w-full cursor-zoom-in"
                        title={`Inspect ${r.name}`}
                      >
                        <img
                          src={r.url}
                          alt={r.name}
                          className="w-full h-24 object-cover"
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveRef(r)}
                        aria-label={`Remove ${r.name}`}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[#2F3E4E] text-white flex items-center justify-center opacity-90 hover:bg-[#9E2A2B] cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* 2. Extracted From Ledger (Shown when Tally ledger parsed) */}
          {extractedSummary && (
            <section className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-4 sm:p-5 shadow-[0_4px_0_#2F3E4E] space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display font-extrabold text-base text-[#2F3E4E]">
                  Extracted From Ledger &amp; Audit
                </h2>
                <button
                  type="button"
                  onClick={handleCopyExtracted}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] cursor-pointer transition"
                >
                  {copiedDetails ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#12805C]" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <ClipboardCopy className="w-3.5 h-3.5" />
                      <span>Copy Details</span>
                    </>
                  )}
                </button>
              </div>

              <div className="space-y-1 text-xs leading-relaxed bg-white border border-[#2F3E4E]/20 rounded-xl p-3">
                {extractedSummary.visibleRows.map(([k, v]) => (
                  <div key={k} className="flex flex-wrap gap-x-1.5">
                    <span className="text-[#64748B]">{k}:</span>
                    <strong className="text-[#2F3E4E] break-all">{v}</strong>
                  </div>
                ))}
              </div>

              {extractedSummary.flags.length > 0 && (
                <div className="space-y-1.5">
                  {extractedSummary.flags.map((flag, i) => (
                    <div
                      key={i}
                      className="px-3 py-2 rounded-lg bg-[#FEE2E2] border border-[#B91C1C]/40 text-xs font-semibold text-[#991B1B] flex items-start gap-2"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>{flag}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* 3. Letter Details */}
          <section className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-4 sm:p-5 shadow-[0_4px_0_#2F3E4E] space-y-3">
            <h2 className="font-display font-extrabold text-base text-[#2F3E4E]">
              2. Letter Details
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="cl-date" className="block text-xs font-bold text-[#475569] mb-1">
                  Date
                </label>
                <input
                  id="cl-date"
                  name="vcpl_letter_date"
                  type="text"
                  autoComplete="off"
                  data-lpignore="true"
                  data-form-type="other"
                  value={form.fdate}
                  onChange={(e) => updateField('fdate', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E]/60 bg-white text-xs sm:text-sm font-semibold text-[#2F3E4E] tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="cl-phone" className="block text-xs font-bold text-[#475569] mb-1">
                  Contact phone
                </label>
                <input
                  id="cl-phone"
                  name="vcpl_dealer_contact"
                  type="text"
                  autoComplete="new-password"
                  data-lpignore="true"
                  data-form-type="other"
                  value={form.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E]/60 bg-white text-xs sm:text-sm font-semibold text-[#2F3E4E] tabular-nums"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <label htmlFor="cl-cname" className="block text-xs font-bold text-[#475569]">
                  Customer name
                </label>
                {ledger?.name && form.cname.trim() !== ledger.name.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      setForm((prev) => ({
                        ...prev,
                        cname: ledger.name,
                        caddr: ledger.addr || prev.caddr,
                      }));
                    }}
                    className="text-[11px] font-bold text-[#1D4ED8] hover:underline cursor-pointer"
                  >
                    Restore from Tally PDF ({ledger.name})
                  </button>
                )}
              </div>
              <input
                id="cl-cname"
                name="vcpl_tally_party_label"
                type="text"
                autoComplete="new-password"
                data-lpignore="true"
                data-1p-ignore="true"
                data-form-type="other"
                value={form.cname}
                onChange={(e) => updateField('cname', e.target.value)}
                placeholder="Customer Full Name / Company"
                className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E]/60 bg-white text-xs sm:text-sm font-semibold text-[#2F3E4E]"
              />
            </div>

            <div>
              <label htmlFor="cl-caddr" className="block text-xs font-bold text-[#475569] mb-1">
                Customer address (one line per row)
              </label>
              <textarea
                id="cl-caddr"
                name="vcpl_tally_party_addr"
                rows={3}
                autoComplete="new-password"
                data-lpignore="true"
                data-form-type="other"
                value={form.caddr}
                onChange={(e) => updateField('caddr', e.target.value)}
                placeholder="Door / Building&#10;Street / Locality&#10;City, PIN"
                className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E]/60 bg-white text-xs sm:text-sm font-medium text-[#2F3E4E]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="cl-cphone" className="block text-xs font-bold text-[#475569] mb-1">
                  Customer contact number
                </label>
                <input
                  id="cl-cphone"
                  type="text"
                  inputMode="tel"
                  value={form.cphone}
                  onChange={(e) => updateField('cphone', e.target.value)}
                  placeholder="9886082430"
                  className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E]/60 bg-white text-xs sm:text-sm font-mono font-semibold text-[#2F3E4E] tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="cl-colour" className="block text-xs font-bold text-[#475569] mb-1">
                  Exterior colour
                </label>
                <input
                  id="cl-colour"
                  type="text"
                  value={form.colour}
                  onChange={(e) => updateField('colour', e.target.value)}
                  placeholder="SKYSCRAPER GREY"
                  className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E]/60 bg-white text-xs sm:text-sm font-semibold text-[#2F3E4E]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="cl-car" className="block text-xs font-bold text-[#475569] mb-1">
                Car Model / Variant
              </label>
              <input
                id="cl-car"
                type="text"
                value={form.car}
                onChange={(e) => updateField('car', e.target.value)}
                placeholder="BMW X1 LWB sDrive18Li M Sport"
                className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E]/60 bg-white text-xs sm:text-sm font-semibold text-[#2F3E4E]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="cl-vin" className="block text-xs font-bold text-[#475569] mb-1">
                  VIN / Chassis No.
                </label>
                <input
                  id="cl-vin"
                  type="text"
                  value={form.vin}
                  onChange={(e) => updateField('vin', e.target.value.toUpperCase())}
                  placeholder="WBA37HN01TY473053"
                  className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E]/60 bg-white text-xs sm:text-sm font-mono font-semibold text-[#2F3E4E] uppercase"
                />
              </div>
              <div>
                <label htmlFor="cl-eng" className="block text-xs font-bold text-[#475569] mb-1">
                  Engine Number
                </label>
                <input
                  id="cl-eng"
                  type="text"
                  value={form.engineNo}
                  onChange={(e) => updateField('engineNo', e.target.value.toUpperCase())}
                  placeholder="0036Y603"
                  className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E]/60 bg-white text-xs sm:text-sm font-mono font-semibold text-[#2F3E4E] uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="cl-pan" className="block text-xs font-bold text-[#475569] mb-1">
                  Customer PAN
                </label>
                <input
                  id="cl-pan"
                  type="text"
                  value={form.cpan}
                  onChange={(e) => updateField('cpan', e.target.value.toUpperCase())}
                  placeholder="ABCDE1234F"
                  className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E]/60 bg-white text-xs sm:text-sm font-mono font-semibold text-[#2F3E4E] uppercase"
                />
              </div>
              <div>
                <label htmlFor="cl-gst" className="block text-xs font-bold text-[#475569] mb-1">
                  Customer GSTIN
                </label>
                <input
                  id="cl-gst"
                  type="text"
                  value={form.cgst}
                  onChange={(e) => updateField('cgst', e.target.value.toUpperCase())}
                  placeholder="29ABCDE1234F1Z5"
                  className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E]/60 bg-white text-xs sm:text-sm font-mono font-semibold text-[#2F3E4E] uppercase"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs font-semibold text-[#2F3E4E] cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={form.showIds}
                onChange={(e) => updateField('showIds', e.target.checked)}
                className="w-4 h-4 accent-[#2F3E4E] cursor-pointer"
              />
              <span>Show GSTIN / PAN under the address in the letter</span>
            </label>
          </section>

          {/* 3B. Header Space, PDF Letterhead & Signature */}
          <section className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-4 sm:p-5 shadow-[0_4px_0_#2F3E4E] space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display font-extrabold text-base text-[#2F3E4E]">
                Letterhead, Header Space &amp; Signature
              </h2>
              {brandingBusy && (
                <Loader2 className="w-4 h-4 animate-spin text-[#2F3E4E]" />
              )}
            </div>

            {brandingError && (
              <p className="text-xs font-semibold text-[#B91C1C]" role="alert">
                {brandingError}
              </p>
            )}

            {/* Header & Footer Margins (Single-Page A4 Safe Zone) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between gap-1.5 mb-1">
                  <label htmlFor="cl-header-mm" className="text-xs font-bold text-[#475569]">
                    Header top space (mm)
                  </label>
                  <div className="flex items-center gap-1">
                    {[28, 36, 48].map((mm) => (
                      <button
                        key={mm}
                        type="button"
                        onClick={() => updateField('headerTopMm', mm)}
                        className={`px-1.5 py-0.5 rounded border text-[10px] font-mono font-bold cursor-pointer transition ${
                          topSpaceMm === mm
                            ? 'border-[#2F3E4E] bg-[#F9C80E] text-[#2F3E4E]'
                            : 'border-[#2F3E4E]/35 bg-white text-[#475569] hover:bg-[#FEF2C8]'
                        }`}
                      >
                        {mm}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  id="cl-header-mm"
                  type="number"
                  min={10}
                  max={80}
                  step={1}
                  value={form.headerTopMm}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    updateField('headerTopMm', Number.isFinite(val) ? val : 36);
                  }}
                  className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E]/60 bg-white font-mono text-xs sm:text-sm font-bold text-[#2F3E4E] tabular-nums"
                />
              </div>

              <div>
                <div className="flex items-center justify-between gap-1.5 mb-1">
                  <label htmlFor="cl-footer-mm" className="text-xs font-bold text-[#475569]">
                    Footer bottom space (mm)
                  </label>
                  <div className="flex items-center gap-1">
                    {[20, 26, 32].map((mm) => (
                      <button
                        key={mm}
                        type="button"
                        onClick={() => updateField('footerBottomMm', mm)}
                        className={`px-1.5 py-0.5 rounded border text-[10px] font-mono font-bold cursor-pointer transition ${
                          bottomSpaceMm === mm
                            ? 'border-[#2F3E4E] bg-[#F9C80E] text-[#2F3E4E]'
                            : 'border-[#2F3E4E]/35 bg-white text-[#475569] hover:bg-[#FEF2C8]'
                        }`}
                      >
                        {mm}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  id="cl-footer-mm"
                  type="number"
                  min={12}
                  max={60}
                  step={1}
                  value={form.footerBottomMm}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    updateField('footerBottomMm', Number.isFinite(val) ? val : 26);
                  }}
                  className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E]/60 bg-white font-mono text-xs sm:text-sm font-bold text-[#2F3E4E] tabular-nums"
                />
              </div>
            </div>
            <p className="-mt-2 text-[11px] text-[#64748B]">
              Keeps letter text strictly within 1 A4 page between your letterhead&rsquo;s top header and bottom footer.
            </p>

            {/* PDF / Image Letterhead Upload */}
            <div className="pt-3 border-t border-[#2F3E4E]/15 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[#475569]">
                  Letterhead background (PDF or Image)
                </span>
                {form.letterheadDataUrl && (
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        letterheadDataUrl: '',
                        letterheadName: '',
                      }))
                    }
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#B91C1C] hover:underline cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Remove</span>
                  </button>
                )}
              </div>

              <input
                ref={letterheadInputRef}
                type="file"
                accept=".pdf,application/pdf,image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  void handleUploadLetterhead(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />

              {form.letterheadDataUrl ? (
                <div className="flex items-center gap-3 p-2.5 rounded-xl border border-[#2F3E4E]/35 bg-white">
                  <img
                    src={form.letterheadDataUrl}
                    alt="Letterhead preview"
                    className="w-10 h-14 object-cover rounded border border-[#2F3E4E]/25 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-[#2F3E4E] truncate">
                      {form.letterheadName || 'Letterhead loaded'}
                    </p>
                    <p className="text-[11px] text-[#12805C] font-semibold">
                      Applied behind A4 preview, Print &amp; PDF
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => letterheadInputRef.current?.click()}
                    className="px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/45 bg-[#FEF2C8] hover:bg-[#F9C80E] text-[11px] font-bold text-[#2F3E4E] cursor-pointer shrink-0"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => letterheadInputRef.current?.click()}
                  className="w-full py-2.5 px-3 rounded-xl border-[1.5px] border-dashed border-[#2F3E4E]/50 bg-white hover:bg-[#FEF2C8]/60 text-xs font-bold text-[#2F3E4E] flex items-center justify-center gap-2 cursor-pointer transition"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload PDF or Image Letterhead</span>
                </button>
              )}
            </div>

            {/* Signature Image Upload */}
            <div className="pt-3 border-t border-[#2F3E4E]/15 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[#475569]">
                  Authorized Signature Image (between &ldquo;For Varsha Cars Pvt Ltd&rdquo; &amp; &ldquo;Authorized Signature.&rdquo;)
                </span>
                {form.signatureDataUrl && (
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        signatureDataUrl: '',
                        signatureName: '',
                      }))
                    }
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#B91C1C] hover:underline cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Remove</span>
                  </button>
                )}
              </div>

              <input
                ref={signatureInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  void handleUploadSignature(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />

              <label className="flex items-center gap-2 text-[11px] font-semibold text-[#475569] cursor-pointer">
                <input
                  type="checkbox"
                  checked={removeSigWhiteBg}
                  onChange={(e) => setRemoveSigWhiteBg(e.target.checked)}
                  className="w-3.5 h-3.5 accent-[#2F3E4E] cursor-pointer"
                />
                <span>Auto-clean white paper background &amp; trim margins on upload</span>
              </label>

              {form.signatureDataUrl ? (
                <div className="space-y-2.5 p-3 rounded-xl border border-[#2F3E4E]/35 bg-white">
                  <div className="flex items-center justify-between gap-3">
                    <div className="h-12 flex items-center bg-[#F8FAFC] px-2.5 rounded border border-[#2F3E4E]/15">
                      <img
                        src={form.signatureDataUrl}
                        alt="Signature preview"
                        className="max-h-10 max-w-[150px] object-contain"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => signatureInputRef.current?.click()}
                      className="px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/45 bg-[#FEF2C8] hover:bg-[#F9C80E] text-[11px] font-bold text-[#2F3E4E] cursor-pointer shrink-0"
                    >
                      Change Signature
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <label
                      htmlFor="cl-sig-height"
                      className="text-[11px] font-bold text-[#475569] whitespace-nowrap"
                    >
                      Signature size ({form.sigHeightPx}px)
                    </label>
                    <input
                      id="cl-sig-height"
                      type="range"
                      min={28}
                      max={92}
                      step={2}
                      value={form.sigHeightPx}
                      onChange={(e) => updateField('sigHeightPx', Number(e.target.value))}
                      className="flex-1 accent-[#2F3E4E] cursor-pointer"
                    />
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => signatureInputRef.current?.click()}
                  className="w-full py-2.5 px-3 rounded-xl border-[1.5px] border-dashed border-[#2F3E4E]/50 bg-white hover:bg-[#FEF2C8]/60 text-xs font-bold text-[#2F3E4E] flex items-center justify-center gap-2 cursor-pointer transition"
                >
                  <PenTool className="w-3.5 h-3.5" />
                  <span>Upload Signature Image (PNG / JPG)</span>
                </button>
              )}
            </div>
          </section>

          {/* 4. Registration & Tax */}
          <section className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-4 sm:p-5 shadow-[0_4px_0_#2F3E4E] space-y-3">
            <h2 className="font-display font-extrabold text-base text-[#2F3E4E]">
              3. Registration &amp; Enclosures
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="cl-regtype" className="block text-xs font-bold text-[#475569] mb-1">
                  Registration
                </label>
                <select
                  id="cl-regtype"
                  value={form.regType}
                  onChange={(e) => updateField('regType', e.target.value as RegType)}
                  className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E]/60 bg-white text-xs sm:text-sm font-semibold text-[#2F3E4E]"
                >
                  <option value="perm">Permanent registration</option>
                  <option value="temp">Temporary registration</option>
                  <option value="none">Not enclosed / pending</option>
                </select>
              </div>
              <div>
                <label htmlFor="cl-regno" className="block text-xs font-bold text-[#475569] mb-1">
                  Reg. / TR number
                </label>
                <input
                  id="cl-regno"
                  type="text"
                  value={form.regNo}
                  onChange={(e) => updateField('regNo', e.target.value.toUpperCase())}
                  placeholder="KA00XX0000"
                  className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E]/60 bg-white text-xs sm:text-sm font-mono font-semibold text-[#2F3E4E] uppercase"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs font-semibold text-[#2F3E4E] cursor-pointer">
              <input
                type="checkbox"
                checked={form.taxChk}
                onChange={(e) => updateField('taxChk', e.target.checked)}
                className="w-4 h-4 accent-[#2F3E4E] cursor-pointer"
              />
              <span>Show &ldquo;Lifetax Paid Receipt&rdquo; with registration</span>
            </label>

            <div>
              <label htmlFor="cl-email" className="block text-xs font-bold text-[#475569] mb-1">
                Email for TCS certificate
              </label>
              <input
                id="cl-email"
                name="vcpl_tcs_mailbox_ref"
                type="text"
                inputMode="email"
                autoComplete="new-password"
                data-lpignore="true"
                data-1p-ignore="true"
                data-form-type="other"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="customer@domain.com"
                className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E]/60 bg-white text-xs sm:text-sm font-semibold text-[#2F3E4E]"
              />
            </div>

            <div>
              <label htmlFor="cl-extra" className="block text-xs font-bold text-[#475569] mb-1">
                Extra enclosures (one per line)
              </label>
              <textarea
                id="cl-extra"
                rows={2}
                value={form.extra}
                onChange={(e) => updateField('extra', e.target.value)}
                placeholder="Extended Warranty Certificate&#10;Service Inclusive Pack Copy"
                className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E]/60 bg-white text-xs sm:text-sm font-medium text-[#2F3E4E]"
              />
            </div>
          </section>

          {/* 5. Payments Received */}
          <section className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-4 sm:p-5 shadow-[0_4px_0_#2F3E4E] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display font-extrabold text-base text-[#2F3E4E]">
                4. Payments Received ({pays.length})
              </h2>
              <button
                type="button"
                onClick={handleAddPayment}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] cursor-pointer transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Payment</span>
              </button>
            </div>

            {pays.length === 0 ? (
              <p className="text-xs text-[#64748B] py-2">
                No payment rows yet. Upload a Tally ledger PDF or click &ldquo;Add Payment&rdquo;.
              </p>
            ) : (
              <div className="space-y-2">
                {pays.map((p, idx) => (
                  <div
                    key={p.id}
                    title={p.nar || undefined}
                    className="p-2.5 rounded-xl border border-[#2F3E4E]/25 bg-white space-y-2"
                  >
                    <div className="grid grid-cols-12 gap-1.5 items-center">
                      <input
                        type="text"
                        value={p.date}
                        onChange={(e) => handlePaymentFieldChange(p.id, 'date', e.target.value)}
                        placeholder="DD.MM.YYYY"
                        aria-label="Payment date"
                        className="col-span-4 px-2 py-1.5 rounded-md border border-[#2F3E4E]/35 text-xs font-mono font-semibold text-[#2F3E4E] tabular-nums"
                      />
                      <input
                        type="text"
                        value={p.mode}
                        onChange={(e) => handlePaymentFieldChange(p.id, 'mode', e.target.value)}
                        placeholder="RTGS / LOAN / CHQ"
                        aria-label="Payment mode"
                        className="col-span-4 px-2 py-1.5 rounded-md border border-[#2F3E4E]/35 text-xs font-semibold text-[#2F3E4E]"
                      />
                      <input
                        type="text"
                        value={p.rno}
                        onChange={(e) => handlePaymentFieldChange(p.id, 'rno', e.target.value)}
                        placeholder="Receipt No"
                        aria-label="Receipt number"
                        className="col-span-4 px-2 py-1.5 rounded-md border border-[#2F3E4E]/35 text-xs font-mono font-semibold text-[#2F3E4E]"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={
                          amtDrafts[p.id] !== undefined
                            ? amtDrafts[p.id]
                            : p.amt
                              ? inr(p.amt)
                              : ''
                        }
                        onChange={(e) => handlePaymentAmtChange(p.id, e.target.value)}
                        onBlur={() => handlePaymentAmtBlur(p.id)}
                        placeholder="Amount (Rs.)"
                        aria-label="Payment amount"
                        className="flex-1 px-2.5 py-1.5 rounded-md border border-[#2F3E4E]/35 text-xs font-mono font-bold text-[#2F3E4E] tabular-nums text-right"
                      />
                      <div className="inline-flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleMovePayment(idx, -1)}
                          disabled={idx === 0}
                          title="Move up"
                          aria-label="Move payment up"
                          className="p-1.5 rounded-md border border-[#2F3E4E]/25 hover:bg-[#FEF2C8] disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowUp className="w-3 h-3 text-[#2F3E4E]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMovePayment(idx, 1)}
                          disabled={idx === pays.length - 1}
                          title="Move down"
                          aria-label="Move payment down"
                          className="p-1.5 rounded-md border border-[#2F3E4E]/25 hover:bg-[#FEF2C8] disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowDown className="w-3 h-3 text-[#2F3E4E]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePayment(p.id)}
                          title="Delete row"
                          aria-label="Delete payment row"
                          className="p-1.5 rounded-md border border-[#B91C1C]/35 bg-[#FEE2E2]/70 hover:bg-[#FEE2E2] text-[#991B1B] cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <label className="flex items-center gap-2 text-xs font-semibold text-[#2F3E4E] cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={form.showWho}
                onChange={(e) => updateField('showWho', e.target.checked)}
                className="w-4 h-4 accent-[#2F3E4E] cursor-pointer"
              />
              <span>Show financier (HP) name on loan rows</span>
            </label>
          </section>

          {/* 6. Amount Confirmation & Export */}
          <section className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-4 sm:p-5 shadow-[0_4px_0_#2F3E4E] space-y-3">
            <h2 className="font-display font-extrabold text-base text-[#2F3E4E]">
              5. Amount Confirmation &amp; Export
            </h2>

            <div className="p-3 rounded-xl bg-[#CEE5DC]/55 border border-[#2F3E4E]/30 space-y-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-bold text-[#475569]">Total received</span>
                <span className="font-display font-extrabold text-base text-[#2F3E4E] tabular-nums">
                  Rs. {inr(totalReceived)}
                </span>
              </div>
              <p className="text-[11px] font-medium text-[#334155]">{totalWords}</p>
            </div>

            <div>
              <label htmlFor="cl-onroad" className="block text-xs font-bold text-[#475569] mb-1">
                On-road price to compare (optional)
              </label>
              <input
                id="cl-onroad"
                type="text"
                inputMode="numeric"
                value={form.onroad}
                onChange={(e) => {
                  setOnroadAuto(false);
                  updateField('onroad', e.target.value);
                }}
                placeholder="e.g. 62,00,000"
                className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E]/60 bg-white text-xs sm:text-sm font-mono font-semibold text-[#2F3E4E] tabular-nums"
              />
              {onroadTarget > 0 && (
                <div className="mt-1.5 text-xs font-bold">
                  {Math.abs(onroadDiff) < 0.5 ? (
                    <span className="inline-flex items-center gap-1 text-[#12805C]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Matches on-road price.</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[#B91C1C]">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Difference from on-road price: Rs. {inr(onroadDiff)}</span>
                    </span>
                  )}
                </div>
              )}
              {ledger && (
                <p className="mt-1.5 text-[11px] font-mono text-[#475569]">
                  Ledger: car sale voucher Rs. {ledger.sale ? inr(ledger.sale) : 'n/a'} | total charged Rs.{' '}
                  {inr(ledger.charged)} | closing balance {ledger.closing || 'n/a'}
                </p>
              )}
            </div>

            <label className="flex items-start gap-2.5 p-3 rounded-xl border border-[#2F3E4E]/35 bg-[#FEF2C8]/65 text-xs font-bold text-[#2F3E4E] cursor-pointer">
              <input
                type="checkbox"
                checked={form.ack}
                onChange={(e) => updateField('ack', e.target.checked)}
                className="w-4 h-4 mt-0.5 accent-[#2F3E4E] cursor-pointer shrink-0"
              />
              <span>I have checked the amounts, dates and receipt numbers</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              <button
                type="button"
                disabled={!form.ack || isExportingPdf}
                onClick={() => void handleSavePdf()}
                className="min-h-[44px] px-4 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#F9C80E] hover:bg-[#FFE1B3] disabled:opacity-45 disabled:cursor-not-allowed shadow-[0_3px_0_#2F3E4E] font-display font-extrabold text-xs sm:text-sm text-[#2F3E4E] flex items-center justify-center gap-2 cursor-pointer transition whitespace-nowrap"
              >
                {isExportingPdf ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>{isExportingPdf ? 'Saving PDF...' : 'Save PDF'}</span>
              </button>
              <button
                type="button"
                disabled={!form.ack}
                onClick={() => void handlePrint()}
                className="min-h-[44px] px-4 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#FFE1B3] disabled:opacity-45 disabled:cursor-not-allowed shadow-[0_3px_0_#2F3E4E] font-display font-extrabold text-xs sm:text-sm text-[#2F3E4E] flex items-center justify-center gap-2 cursor-pointer transition whitespace-nowrap"
              >
                <Printer className="w-4 h-4" />
                <span>Print</span>
              </button>
              <button
                type="button"
                disabled={!form.ack}
                onClick={() => downloadCoveringLetterDoc(form, pays, fitState.density)}
                className="min-h-[44px] px-4 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#2F3E4E] hover:bg-[#1E293B] disabled:opacity-45 disabled:cursor-not-allowed font-display font-extrabold text-xs sm:text-sm text-[#FFFDF5] flex items-center justify-center gap-2 cursor-pointer transition whitespace-nowrap"
              >
                <FileText className="w-4 h-4" />
                <span>Word (.doc)</span>
              </button>
            </div>
            {exportNotice && (
              <p className="text-xs font-semibold text-[#12805C] pt-0.5" role="status">
                {exportNotice}
              </p>
            )}
          </section>
        </div>

        {/* Right Live A4 Preview Column (Full Responsive Fit — No Preview Scrollbar) */}
        <div className="xl:col-span-7 xl:sticky xl:top-20 space-y-3 print:static print:w-full print:overflow-visible print:pr-0">
          <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-[#475569] no-print">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-[#2F3E4E]">
                Live A4 Covering Letter Preview
              </span>
              <div className="inline-flex rounded-lg border border-[#2F3E4E]/45 bg-[#FEF2C8]/60 p-0.5">
                <button
                  type="button"
                  onClick={() => updateField('letterFormat', 'classic')}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-bold cursor-pointer transition ${
                    form.letterFormat === 'classic'
                      ? 'bg-[#2F3E4E] text-[#F9C80E]'
                      : 'text-[#2F3E4E] hover:bg-white/70'
                  }`}
                >
                  Old Format
                </button>
                <button
                  type="button"
                  onClick={() => updateField('letterFormat', 'modern_box')}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-bold cursor-pointer transition ${
                    form.letterFormat === 'modern_box'
                      ? 'bg-[#2F3E4E] text-[#F9C80E]'
                      : 'text-[#2F3E4E] hover:bg-white/70'
                  }`}
                >
                  New Format
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-[11px] font-bold text-[#12805C]">
                Single Page A4
                {fitState.density > 0 || fitState.contentScale < 1
                  ? ` · Auto-fit ${densitySpec.fontPt}pt${
                      fitState.contentScale < 1
                        ? ` (${Math.round(fitState.contentScale * 100)}%)`
                        : ''
                    }`
                  : ''}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-[11px] font-bold text-[#2F3E4E]">
                Zoom {Math.round(previewScale * 100)}%
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-[11px]">
                {form.ack ? 'Verified · Ready for Export' : 'Tick confirmation box to enable Print & Word'}
              </span>
            </div>
          </div>

          <div
            id="covering-a4-stage"
            ref={previewStageRef}
            className="w-full bg-[#CEE5DC]/55 border-[1.5px] border-[#2F3E4E] rounded-2xl p-3 shadow-[0_4px_0_#2F3E4E] flex justify-center overflow-hidden print:border-0 print:bg-transparent print:p-0 print:shadow-none print:overflow-visible"
          >
            <div
              id="covering-a4-scale-box"
              style={{
                width: `${Math.ceil(A4_WIDTH_PX * previewScale)}px`,
                height: `${Math.ceil(A4_HEIGHT_PX * previewScale)}px`,
              }}
              className="relative shrink-0 overflow-hidden print:static print:overflow-visible"
            >
              <div
                id="covering-a4-sheet"
                ref={sheetRef}
                className="relative bg-white border border-[#CBD5E1] shadow-[0_8px_24px_rgba(47,62,78,0.18)] text-[#111827] print:border-0 print:shadow-none print:m-0 overflow-hidden"
                style={{
                  width: `${A4_WIDTH_PX}px`,
                  height: `${A4_HEIGHT_PX}px`,
                  padding: `${topSpaceMm}mm 18mm ${bottomSpaceMm}mm 18mm`,
                  boxSizing: 'border-box',
                  fontFamily: "Cambria, Georgia, 'Times New Roman', serif",
                  fontSize: `${densitySpec.fontPt}pt`,
                  lineHeight: densitySpec.lineHeight,
                  transform: `scale(${previewScale})`,
                  transformOrigin: 'top left',
                }}
              >
                {form.letterheadDataUrl && (
                  <img
                    src={form.letterheadDataUrl}
                    alt=""
                    aria-hidden="true"
                    className="pointer-events-none select-none"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: `${A4_WIDTH_PX}px`,
                      height: `${A4_HEIGHT_PX}px`,
                      objectFit: 'fill',
                      zIndex: 0,
                    }}
                  />
                )}
                <div
                  style={{
                    position: 'relative',
                    zIndex: 1,
                    width: '100%',
                    height: `${availableContentHeightPx}px`,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={
                      fitState.contentScale < 1
                        ? {
                            width: `${(100 / fitState.contentScale).toFixed(3)}%`,
                            transform: `scale(${fitState.contentScale})`,
                            transformOrigin: 'top left',
                          }
                        : { width: '100%' }
                    }
                    dangerouslySetInnerHTML={{ __html: letterBodyHtml }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reference Image Lightbox */}
      {zoomedRef && (
        <div
          className="fixed inset-0 z-50 bg-[#1E293B]/80 backdrop-blur-[2px] flex items-center justify-center p-4 no-print"
          onClick={() => setZoomedRef(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-3 shadow-[0_6px_0_#2F3E4E] flex flex-col gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-1">
              <span className="text-xs font-bold text-[#2F3E4E] truncate">{zoomedRef.name}</span>
              <button
                type="button"
                onClick={() => setZoomedRef(null)}
                className="p-1.5 rounded-lg border border-[#2F3E4E]/30 hover:bg-[#FEF2C8] text-[#2F3E4E] cursor-pointer"
                aria-label="Close image preview"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <img
              src={zoomedRef.url}
              alt={zoomedRef.name}
              className="max-h-[80vh] w-auto object-contain rounded-lg border border-[#2F3E4E]/20"
            />
          </div>
        </div>
      )}
    </div>
  );
};
