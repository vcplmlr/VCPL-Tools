import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Tesseract from 'tesseract.js';
import * as XLSX from 'xlsx';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ClipboardPaste,
  Copy,
  Crop,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Image as ImageIcon,
  Languages,
  Layers,
  Loader2,
  Play,
  RefreshCw,
  RotateCcw,
  RotateCw,
  ScanText,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Square,
  Table2,
  Trash2,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import { ToolCatalogItem } from '../../types/tools';
import {
  ExtractedEntities,
  ImageProcessOptions,
  OcrWordBox,
  createSampleInvoiceImageFile,
  extractPdfPageText,
  extractStructuredEntities,
  loadImageFileToCanvas,
  loadPdfDocument,
  parsePageRange,
  processCanvasForOcr,
} from '../../utils/ocrProcessing';

interface TextliftOcrProViewProps {
  tool: ToolCatalogItem;
}

interface ExtractedPage {
  n: number;
  text: string;
  conf: number | null;
  method: 'OCR' | 'Text layer';
  words: OcrWordBox[];
  durationMs?: number;
}

interface OcrFileItem {
  id: number;
  name: string;
  kind: 'pdf' | 'img';
  size: number;
  file: File;
  status: 'queued' | 'working' | 'done' | 'error';
  pct: number;
  msg: string;
  pages: ExtractedPage[];
  thumbUrl: string | null;
  edited: string | null;
  editedFor: 'all' | number | null;
  totalPages?: number;
}

type ResultTab = 'editor' | 'heatmap' | 'entities' | 'table';
type WhitelistMode = 'all' | 'numbers' | 'alnum-id' | 'custom';

interface OcrPreset {
  id: string;
  label: string;
  hint: string;
  lang?: string;
  psm: string;
  whitelistMode?: WhitelistMode;
  pdfMode?: 'auto' | 'ocr';
  scale?: number;
  imgOpts: Partial<ImageProcessOptions>;
}

const LANGUAGES: { value: string; label: string }[] = [
  { value: 'eng', label: 'English (eng)' },
  { value: 'hin', label: 'Hindi · हिन्दी (hin)' },
  { value: 'kan', label: 'Kannada · ಕನ್ನಡ (kan)' },
  { value: 'eng+hin', label: 'English + Hindi' },
  { value: 'eng+kan', label: 'English + Kannada' },
  { value: 'eng+hin+kan', label: 'English + Hindi + Kannada' },
  { value: 'tam', label: 'Tamil · தமிழ் (tam)' },
  { value: 'tel', label: 'Telugu · తెలుగు (tel)' },
  { value: 'mal', label: 'Malayalam · മലയാളം (mal)' },
  { value: 'mar', label: 'Marathi · मराठी (mar)' },
  { value: 'ben', label: 'Bengali · বাংলা (ben)' },
  { value: 'guj', label: 'Gujarati · ગુજરાતી (guj)' },
  { value: 'pan', label: 'Punjabi · ਪੰਜਾਬੀ (pan)' },
  { value: 'urd', label: 'Urdu (urd)' },
  { value: 'san', label: 'Sanskrit (san)' },
  { value: 'ara', label: 'Arabic (ara)' },
  { value: 'spa', label: 'Spanish (spa)' },
  { value: 'fra', label: 'French (fra)' },
  { value: 'deu', label: 'German (deu)' },
  { value: 'por', label: 'Portuguese (por)' },
  { value: 'ita', label: 'Italian (ita)' },
  { value: 'rus', label: 'Russian (rus)' },
  { value: 'chi_sim', label: 'Chinese Simplified (chi_sim)' },
  { value: 'jpn', label: 'Japanese (jpn)' },
  { value: 'kor', label: 'Korean (kor)' },
];

const PSM_MODES: { value: string; label: string }[] = [
  { value: '3', label: 'PSM 3 · Automatic multi-column layout' },
  { value: '6', label: 'PSM 6 · Uniform block (invoices & forms)' },
  { value: '4', label: 'PSM 4 · Single column, varied font sizes' },
  { value: '11', label: 'PSM 11 · Sparse text (receipts, stamps, labels)' },
  { value: '12', label: 'PSM 12 · Sparse text + OSD orientation' },
  { value: '7', label: 'PSM 7 · Single text line (VIN, cheque line)' },
];

const PRESETS: OcrPreset[] = [
  {
    id: 'general',
    label: 'General Docs',
    hint: 'Balanced upscale + contrast stretch',
    psm: '3',
    whitelistMode: 'all',
    scale: 2.0,
    imgOpts: {
      upscale: true,
      grayscaleContrast: true,
      binarize: false,
      invert: false,
      sharpen: false,
      brightness: 0,
      contrast: 1.05,
    },
  },
  {
    id: 'gst-invoice',
    label: 'GST Invoice & Tally',
    hint: 'Uniform block + edge sharpen for columns',
    psm: '6',
    whitelistMode: 'all',
    scale: 2.5,
    imgOpts: {
      upscale: true,
      grayscaleContrast: true,
      binarize: false,
      invert: false,
      sharpen: true,
      brightness: 4,
      contrast: 1.25,
    },
  },
  {
    id: 'bank-slip',
    label: 'Bank Slip & Stamp',
    hint: 'Otsu B&W binarization for faded ink & shadows',
    psm: '4',
    whitelistMode: 'all',
    scale: 2.5,
    imgOpts: {
      upscale: true,
      grayscaleContrast: true,
      binarize: true,
      invert: false,
      sharpen: true,
      brightness: 6,
      contrast: 1.35,
    },
  },
  {
    id: 'ledger-table',
    label: 'Ledger / Table Grid',
    hint: 'High-contrast + high-DPI for dense rows',
    psm: '6',
    whitelistMode: 'all',
    scale: 3.0,
    imgOpts: {
      upscale: true,
      grayscaleContrast: true,
      binarize: false,
      invert: false,
      sharpen: true,
      brightness: 2,
      contrast: 1.2,
    },
  },
  {
    id: 'dark-ui',
    label: 'Dark UI / White Text',
    hint: 'Auto-invert dark screens for dark-mode captures',
    psm: '6',
    whitelistMode: 'all',
    scale: 2.0,
    imgOpts: {
      upscale: true,
      grayscaleContrast: true,
      binarize: false,
      invert: true,
      sharpen: false,
      brightness: 0,
      contrast: 1.15,
    },
  },
  {
    id: 'indian-multi',
    label: 'EN + HI + KN',
    hint: 'Multi-script English, Hindi & Kannada documents',
    lang: 'eng+hin+kan',
    psm: '3',
    whitelistMode: 'all',
    scale: 2.5,
    imgOpts: {
      upscale: true,
      grayscaleContrast: true,
      binarize: false,
      invert: false,
      sharpen: false,
      brightness: 0,
      contrast: 1.15,
    },
  },
];

const DEFAULT_IMG_OPTS: ImageProcessOptions = {
  upscale: true,
  grayscaleContrast: true,
  binarize: false,
  invert: false,
  sharpen: false,
  brightness: 0,
  contrast: 1.05,
  rotation: 0,
  deskewDeg: 0,
  crop: null,
};

function fmtSize(n: number): string {
  return n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

function countWords(t: string): number {
  const m = t.match(/\S+/g);
  return m ? m.length : 0;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2500);
}

function getWhitelistString(mode: WhitelistMode, custom: string): string {
  if (mode === 'numbers') return '0123456789.,/-+₹RsINR %:';
  if (mode === 'alnum-id') return 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789/-.: ';
  if (mode === 'custom') return custom.trim();
  return '';
}

function extractWordsFromResultData(data: unknown): OcrWordBox[] {
  const wordsOut: OcrWordBox[] = [];
  const d = data as {
    blocks?: Array<{
      paragraphs?: Array<{
        lines?: Array<{
          words?: Array<{
            text?: string;
            confidence?: number;
            bbox?: { x0: number; y0: number; x1: number; y1: number };
          }>;
        }>;
      }>;
    }>;
  } | null;

  if (!d?.blocks) return wordsOut;
  for (const blk of d.blocks) {
    for (const para of blk.paragraphs || []) {
      for (const line of para.lines || []) {
        for (const w of line.words || []) {
          const t = (w.text || '').trim();
          if (!t) continue;
          wordsOut.push({
            text: t,
            confidence: Math.round(w.confidence ?? 0),
            bbox: w.bbox ?? { x0: 0, y0: 0, x1: 0, y1: 0 },
          });
        }
      }
    }
  }
  return wordsOut;
}

export const TextliftOcrProView: React.FC<TextliftOcrProViewProps> = ({ tool }) => {
  // Files queue
  const [files, setFiles] = useState<OcrFileItem[]>([]);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [selectedPage, setSelectedPage] = useState<'all' | number>('all');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const nextIdRef = useRef(1);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // OCR Engine Settings
  const [activePreset, setActivePreset] = useState<string>('general');
  const [lang, setLang] = useState<string>('eng');
  const [psm, setPsm] = useState<string>('3');
  const [whitelistMode, setWhitelistMode] = useState<WhitelistMode>('all');
  const [customWhitelist, setCustomWhitelist] = useState<string>('');
  const [pdfMode, setPdfMode] = useState<'auto' | 'ocr'>('auto');
  const [scale, setScale] = useState<number>(2.0);
  const [pageRangeStr, setPageRangeStr] = useState<string>('');

  // DSP Image Preprocessing
  const [imgOpts, setImgOpts] = useState<ImageProcessOptions>(DEFAULT_IMG_OPTS);

  // Post-processing text cleanup options
  const [joinParagraphs, setJoinParagraphs] = useState(false);
  const [fixHyphens, setFixHyphens] = useState(false);
  const [showPageMarkers, setShowPageMarkers] = useState(true);
  const [trimExtraSpaces, setTrimExtraSpaces] = useState(false);

  // Live Image Studio / ROI Crop preview
  const [rawCanvas, setRawCanvas] = useState<HTMLCanvasElement | null>(null);
  const [previewTab, setPreviewTab] = useState<'processed' | 'original'>('processed');
  const [showPreviewStudio, setShowPreviewStudio] = useState<boolean>(true);
  const [roiDrawing, setRoiDrawing] = useState(false);
  const [roiStart, setRoiStart] = useState<{ x: number; y: number } | null>(null);
  const [roiDraft, setRoiDraft] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Output Tabs & Find/Replace
  const [resultTab, setResultTab] = useState<ResultTab>('editor');
  const [findQuery, setFindQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [useRegexFind, setUseRegexFind] = useState(false);
  const [confidenceFilter, setConfidenceFilter] = useState<'all' | 'low' | 'mid' | 'high'>('all');
  const [editableTable, setEditableTable] = useState<string[][]>([]);

  // Running & Toast State
  const [running, setRunning] = useState(false);
  const [engineStatus, setEngineStatus] = useState(
    'Ready · Tesseract v7 & PDF.js run 100% locally in your browser (zero passcode).'
  );
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const cancelledRef = useRef(false);
  const workerRef = useRef<Tesseract.Worker | null>(null);
  const workerKeyRef = useRef<string>('');
  const onProgressRef = useRef<((m: { status?: string; progress?: number }) => void) | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const currentFile = useMemo(
    () => files.find((f) => f.id === currentId) ?? null,
    [files, currentId]
  );

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMsg(null), 2800);
  }, []);

  // Terminate worker cleanly on unmount
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate().catch(() => {});
        workerRef.current = null;
      }
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  const addFiles = useCallback(
    (incomingList: FileList | File[]) => {
      const added: OcrFileItem[] = [];
      let skipped = 0;

      Array.from(incomingList).forEach((f) => {
        const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
        const isImg = /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(f.name);
        if (!isPdf && !isImg) {
          skipped++;
          return;
        }
        const id = nextIdRef.current++;
        const cleanName =
          f.name && f.name !== 'image.png' ? f.name : `pasted-capture-${id}.png`;
        added.push({
          id,
          name: cleanName,
          kind: isPdf ? 'pdf' : 'img',
          size: f.size,
          file: f,
          status: 'queued',
          pct: 0,
          msg: 'Queued · Ready',
          pages: [],
          thumbUrl: isImg ? URL.createObjectURL(f) : null,
          edited: null,
          editedFor: null,
        });
      });

      if (skipped > 0) {
        showToast(
          `${skipped} unsupported file${skipped > 1 ? 's' : ''} skipped. Use JPG, PNG, WebP, BMP, AVIF or PDF.`
        );
      }

      if (added.length > 0) {
        setFiles((prev) => [...prev, ...added]);
        setCurrentId((prev) => (prev === null ? added[0].id : prev));
        setSelectedPage('all');
        showToast(`Added ${added.length} file${added.length > 1 ? 's' : ''} to OCR queue`);
      }
    },
    [showToast]
  );

  // Global clipboard image paste listener
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.files;
      if (items && items.length > 0) {
        addFiles(items);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [addFiles]);

  // Load preview canvas when selected file changes
  useEffect(() => {
    let active = true;
    setRoiDraft(null);

    if (!currentFile) {
      setRawCanvas(null);
      return;
    }

    if (currentFile.kind === 'img') {
      loadImageFileToCanvas(currentFile.file)
        .then((canvas) => {
          if (active) setRawCanvas(canvas);
        })
        .catch(() => {
          if (active) setRawCanvas(null);
        });
    } else {
      currentFile.file
        .arrayBuffer()
        .then((buf) => loadPdfDocument(new Uint8Array(buf)))
        .then(async (pdf) => {
          if (!active) return;
          setFiles((prev) =>
            prev.map((f) => (f.id === currentFile.id ? { ...f, totalPages: pdf.numPages } : f))
          );
          const previewPageNum =
            typeof selectedPage === 'number' && selectedPage <= pdf.numPages ? selectedPage : 1;
          const page = await pdf.getPage(previewPageNum);
          const vp = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.floor(vp.width));
          canvas.height = Math.max(1, Math.floor(vp.height));
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            await page.render({ canvasContext: ctx, viewport: vp }).promise;
          }
          if (active) setRawCanvas(canvas);
        })
        .catch(() => {
          if (active) setRawCanvas(null);
        });
    }

    return () => {
      active = false;
    };
  }, [currentFile?.id, currentFile?.kind, selectedPage]);

  // Render live DSP or original canvas into visible preview
  useEffect(() => {
    const dest = previewCanvasRef.current;
    if (!dest || !rawCanvas) return;

    const previewOpts: ImageProcessOptions =
      previewTab === 'original'
        ? {
            upscale: false,
            grayscaleContrast: false,
            binarize: false,
            invert: false,
            sharpen: false,
            brightness: 0,
            contrast: 1,
            rotation: imgOpts.rotation,
            deskewDeg: imgOpts.deskewDeg,
            crop: null,
          }
        : {
            ...imgOpts,
            upscale: false,
            crop: null,
          };

    const processed = processCanvasForOcr(rawCanvas, previewOpts);
    dest.width = processed.width;
    dest.height = processed.height;
    const dctx = dest.getContext('2d');
    if (dctx) {
      dctx.clearRect(0, 0, dest.width, dest.height);
      dctx.drawImage(processed, 0, 0);
    }
  }, [rawCanvas, imgOpts, previewTab]);

  // Apply Preset
  const handleSelectPreset = (preset: OcrPreset) => {
    setActivePreset(preset.id);
    if (preset.lang) setLang(preset.lang);
    setPsm(preset.psm);
    if (preset.whitelistMode) setWhitelistMode(preset.whitelistMode);
    if (preset.pdfMode) setPdfMode(preset.pdfMode);
    if (preset.scale) setScale(preset.scale);
    setImgOpts((prev) => ({
      ...prev,
      ...preset.imgOpts,
    }));
    showToast(`Applied "${preset.label}" OCR profile`);
  };

  // Tesseract v7 worker initialization
  const getWorker = useCallback(async (): Promise<Tesseract.Worker> => {
    const wl = getWhitelistString(whitelistMode, customWhitelist);
    const key = `${lang}|${psm}|${wl}`;
    if (workerRef.current && workerKeyRef.current === key) {
      return workerRef.current;
    }

    if (workerRef.current) {
      await workerRef.current.terminate().catch(() => {});
      workerRef.current = null;
      workerKeyRef.current = '';
    }

    setEngineStatus(`Loading OCR language pack (${lang})…`);
    const worker = await Tesseract.createWorker(lang, 1, {
      langPath: 'https://cdn.jsdelivr.net/gh/naptha/tessdata@gh-pages/4.0.0',
      logger: (m) => {
        if (onProgressRef.current) onProgressRef.current(m);
      },
    });

    await worker.setParameters({
      tessedit_pageseg_mode: psm as unknown as Tesseract.PSM,
      preserve_interword_spaces: '1',
      tessedit_char_whitelist: wl,
    });

    workerRef.current = worker;
    workerKeyRef.current = key;
    setEngineStatus(`Engine ready (${lang} · PSM ${psm})`);
    return worker;
  }, [lang, psm, whitelistMode, customWhitelist]);

  const updateFileState = useCallback(
    (id: number, patch: Partial<OcrFileItem>) => {
      setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
    },
    []
  );

  const ocrCanvasWithProgress = useCallback(
    async (
      canvas: HTMLCanvasElement,
      label: string,
      fileId: number,
      basePct: number,
      spanPct: number
    ): Promise<{ text: string; conf: number; words: OcrWordBox[]; durationMs: number }> => {
      const started = performance.now();
      const worker = await getWorker();
      onProgressRef.current = (m) => {
        if (m.status === 'recognizing text' && typeof m.progress === 'number') {
          updateFileState(fileId, {
            status: 'working',
            msg: `${label} · Reading ${Math.round(m.progress * 100)}%`,
            pct: Math.min(0.99, basePct + spanPct * m.progress),
          });
        } else if (m.status) {
          updateFileState(fileId, {
            status: 'working',
            msg: `${label} · ${m.status}`,
          });
        }
      };

      const res = await worker.recognize(canvas, undefined, {
        text: true,
        blocks: true,
      });
      onProgressRef.current = null;

      return {
        text: (res.data.text || '').replace(/\s+$/g, ''),
        conf: Math.round(res.data.confidence ?? 0),
        words: extractWordsFromResultData(res.data),
        durationMs: Math.round(performance.now() - started),
      };
    },
    [getWorker, updateFileState]
  );

  // Run batch extraction
  const runOcrQueue = async (onlyTargetId?: number) => {
    if (running) return;
    const candidates = onlyTargetId
      ? files.filter((f) => f.id === onlyTargetId)
      : files.filter((f) => f.status !== 'done');

    if (candidates.length === 0) {
      showToast('All files in queue are already extracted. Click Re-scan File to run again.');
      return;
    }

    setRunning(true);
    cancelledRef.current = false;

    for (const item of candidates) {
      if (cancelledRef.current) break;

      updateFileState(item.id, {
        status: 'working',
        pct: 0.03,
        msg: 'Initializing engine…',
        pages: [],
        edited: null,
        editedFor: null,
      });

      try {
        const collectedPages: ExtractedPage[] = [];

        if (item.kind === 'img') {
          const raw = await loadImageFileToCanvas(item.file);
          if (cancelledRef.current) throw new Error('Stopped');
          const prepped = processCanvasForOcr(raw, imgOpts);
          const ocrRes = await ocrCanvasWithProgress(prepped, 'Image', item.id, 0.08, 0.9);
          collectedPages.push({
            n: 1,
            text: ocrRes.text,
            conf: ocrRes.conf,
            method: 'OCR',
            words: ocrRes.words,
            durationMs: ocrRes.durationMs,
          });
        } else {
          const buf = await item.file.arrayBuffer();
          const pdf = await loadPdfDocument(new Uint8Array(buf));
          const pageIndices = parsePageRange(pageRangeStr, pdf.numPages);
          updateFileState(item.id, { totalPages: pdf.numPages });

          for (let idx = 0; idx < pageIndices.length; idx++) {
            if (cancelledRef.current) throw new Error('Stopped');
            const pageNum = pageIndices[idx];
            const basePct = idx / pageIndices.length;
            const spanPct = 1 / pageIndices.length;
            const label = `Page ${pageNum}/${pdf.numPages}`;
            updateFileState(item.id, {
              status: 'working',
              msg: `Inspecting ${label}`,
              pct: basePct,
            });

            const page = await pdf.getPage(pageNum);
            const tc = pdfMode === 'auto' ? await page.getTextContent() : null;
            const embeddedText = tc ? extractPdfPageText(tc) : '';

            if (pdfMode === 'auto' && embeddedText.replace(/\s/g, '').length >= 25) {
              collectedPages.push({
                n: pageNum,
                text: embeddedText,
                conf: null,
                method: 'Text layer',
                words: [],
              });
            } else {
              const vp = page.getViewport({ scale: scale * 1.5 });
              const canvas = document.createElement('canvas');
              canvas.width = Math.max(1, Math.floor(vp.width));
              canvas.height = Math.max(1, Math.floor(vp.height));
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                await page.render({ canvasContext: ctx, viewport: vp }).promise;
              }
              const prepped = processCanvasForOcr(canvas, imgOpts);
              const ocrRes = await ocrCanvasWithProgress(
                prepped,
                label,
                item.id,
                basePct,
                spanPct * 0.95
              );
              collectedPages.push({
                n: pageNum,
                text: ocrRes.text,
                conf: ocrRes.conf,
                method: 'OCR',
                words: ocrRes.words,
                durationMs: ocrRes.durationMs,
              });
            }

            updateFileState(item.id, {
              pages: [...collectedPages],
            });
          }
        }

        const totalChars = collectedPages.reduce((acc, p) => acc + p.text.length, 0);
        updateFileState(item.id, {
          status: 'done',
          pct: 1,
          pages: collectedPages,
          msg: totalChars
            ? `${collectedPages.length} ${collectedPages.length === 1 ? 'page' : 'pages'} extracted`
            : 'Done · No readable text detected',
        });
      } catch (err) {
        if (cancelledRef.current) {
          updateFileState(item.id, { status: 'queued', pct: 0, msg: 'Stopped by user' });
        } else {
          const message = err instanceof Error ? err.message : String(err);
          updateFileState(item.id, {
            status: 'error',
            pct: 0,
            msg: `Error: ${message}`,
          });
          setEngineStatus('Error encountered during OCR. Adjust settings or retry.');
          if (workerRef.current) {
            await workerRef.current.terminate().catch(() => {});
            workerRef.current = null;
            workerKeyRef.current = '';
          }
        }
      }
    }

    onProgressRef.current = null;
    setRunning(false);
    if (!cancelledRef.current) {
      setEngineStatus('Extraction complete · Ready for export or next batch.');
    }
  };

  const handleStop = async () => {
    cancelledRef.current = true;
    if (workerRef.current) {
      await workerRef.current.terminate().catch(() => {});
      workerRef.current = null;
      workerKeyRef.current = '';
    }
    setRunning(false);
    setEngineStatus('Stopped. Files remain queued for retry.');
  };

  const handleRemoveFile = (id: number) => {
    if (running) return;
    setFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target?.thumbUrl) URL.revokeObjectURL(target.thumbUrl);
      const next = prev.filter((f) => f.id !== id);
      if (currentId === id) {
        setCurrentId(next.length ? next[0].id : null);
        setSelectedPage('all');
      }
      return next;
    });
  };

  const handleClearAll = () => {
    if (running) return;
    files.forEach((f) => {
      if (f.thumbUrl) URL.revokeObjectURL(f.thumbUrl);
    });
    setFiles([]);
    setCurrentId(null);
    setSelectedPage('all');
    setRawCanvas(null);
    setImgOpts((prev) => ({ ...prev, crop: null }));
    setEngineStatus('Queue cleared.');
  };

  const handleLoadSample = async () => {
    const sample = await createSampleInvoiceImageFile();
    addFiles([sample]);
  };

  // Text formatting helper
  const cleanText = useCallback(
    (raw: string): string => {
      let t = raw;
      if (fixHyphens) {
        t = t.replace(/(\p{L})-\n(\p{Ll})/gu, '$1$2');
      }
      if (trimExtraSpaces) {
        t = t.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n');
      }
      if (joinParagraphs) {
        t = t
          .split(/\n{2,}/)
          .map((p) => p.replace(/\s*\n\s*/g, ' '))
          .join('\n\n');
      }
      return t.trim();
    },
    [fixHyphens, joinParagraphs, trimExtraSpaces]
  );

  const assembleText = useCallback(
    (item: OcrFileItem, which: 'all' | number): string => {
      const subset =
        which === 'all' ? item.pages : item.pages.filter((p) => p.n === which);
      const useMarkers = showPageMarkers && which === 'all' && item.kind === 'pdf' && item.pages.length > 1;
      return subset
        .map((p) => (useMarkers ? `——— Page ${p.n} (${p.method}) ———\n\n` : '') + cleanText(p.text))
        .join('\n\n');
    },
    [cleanText, showPageMarkers]
  );

  const activeText = useMemo(() => {
    if (!currentFile || !currentFile.pages.length) return '';
    if (currentFile.edited !== null && currentFile.editedFor === selectedPage) {
      return currentFile.edited;
    }
    return assembleText(currentFile, selectedPage);
  }, [currentFile, selectedPage, assembleText]);

  const activeSelectedPages = useMemo(() => {
    if (!currentFile) return [];
    return selectedPage === 'all'
      ? currentFile.pages
      : currentFile.pages.filter((p) => p.n === selectedPage);
  }, [currentFile, selectedPage]);

  const avgConfidence = useMemo(() => {
    const confs = activeSelectedPages.filter((p) => p.conf !== null);
    if (!confs.length) return null;
    return Math.round(confs.reduce((sum, p) => sum + (p.conf ?? 0), 0) / confs.length);
  }, [activeSelectedPages]);

  const allWords = useMemo(
    () => activeSelectedPages.flatMap((p) => p.words),
    [activeSelectedPages]
  );

  const lowConfidenceWords = useMemo(
    () => allWords.filter((w) => w.confidence < 75),
    [allWords]
  );

  const filteredHeatmapWords = useMemo(() => {
    if (confidenceFilter === 'all') return allWords;
    if (confidenceFilter === 'low') return allWords.filter((w) => w.confidence < 70);
    if (confidenceFilter === 'mid') return allWords.filter((w) => w.confidence >= 70 && w.confidence < 88);
    return allWords.filter((w) => w.confidence >= 88);
  }, [allWords, confidenceFilter]);

  const entities: ExtractedEntities = useMemo(
    () => extractStructuredEntities(activeText),
    [activeText]
  );

  // Sync heuristic table rows into editable grid whenever activeText changes
  useEffect(() => {
    setEditableTable(entities.tableRows.map((row) => [...row]));
  }, [entities.tableRows]);

  const totalEntitiesCount =
    entities.gstins.length +
    entities.pans.length +
    entities.ifscs.length +
    entities.vins.length +
    entities.hsns.length +
    entities.invoiceNos.length +
    entities.amounts.length +
    entities.dates.length +
    entities.emails.length +
    entities.phones.length +
    entities.urls.length;

  // Apply Find & Replace
  const handleReplaceAll = () => {
    if (!currentFile || !findQuery) return;
    try {
      let nextText = activeText;
      let count = 0;
      if (useRegexFind) {
        const re = new RegExp(findQuery, 'g');
        nextText = activeText.replace(re, () => {
          count++;
          return replaceQuery;
        });
      } else {
        const parts = activeText.split(findQuery);
        count = parts.length - 1;
        nextText = parts.join(replaceQuery);
      }
      updateFileState(currentFile.id, { edited: nextText, editedFor: selectedPage });
      showToast(`Replaced ${count} match${count === 1 ? '' : 'es'}`);
    } catch (err) {
      showToast(`Invalid Regex: ${err instanceof Error ? err.message : 'Syntax error'}`);
    }
  };

  // Correct a low-confidence word inside editor text
  const handleCorrectWord = (wrongWord: string, corrected: string) => {
    if (!currentFile || !corrected || wrongWord === corrected) return;
    const parts = activeText.split(wrongWord);
    if (parts.length <= 1) return;
    const nextText = parts.join(corrected);
    updateFileState(currentFile.id, { edited: nextText, editedFor: selectedPage });
    showToast(`Updated "${wrongWord}" → "${corrected}"`);
  };

  // Copy text cleanly
  const handleCopyText = async (txt: string, label = 'Copied text to clipboard') => {
    try {
      await navigator.clipboard.writeText(txt);
      showToast(label);
    } catch {
      showToast('Clipboard write blocked—select text and press Ctrl/Cmd + C');
    }
  };

  // Exports
  const baseFileName = (currentFile?.name || 'textlift-ocr').replace(/\.[^.]+$/, '');

  const handleExportTxt = () => {
    downloadBlob(new Blob([activeText], { type: 'text/plain;charset=utf-8' }), `${baseFileName}.txt`);
    showToast(`Saved ${baseFileName}.txt`);
  };

  const handleExportMd = () => {
    const md = `# ${currentFile?.name || 'OCR Extract'}\n\n${activeText}\n`;
    downloadBlob(new Blob([md], { type: 'text/markdown;charset=utf-8' }), `${baseFileName}.md`);
    showToast(`Saved ${baseFileName}.md`);
  };

  const handleExportJson = () => {
    if (!currentFile) return;
    const payload = {
      file: currentFile.name,
      language: lang,
      psm,
      avgConfidence,
      entities,
      tableRows: editableTable,
      pages: currentFile.pages.map((p) => ({
        page: p.n,
        method: p.method,
        confidence: p.conf,
        text: p.text,
      })),
    };
    downloadBlob(
      new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' }),
      `${baseFileName}.json`
    );
    showToast(`Saved ${baseFileName}.json`);
  };

  const handleExportCsv = () => {
    const rowsToUse =
      editableTable.length > 0
        ? editableTable
        : activeText
            .split(/\r?\n/)
            .filter(Boolean)
            .map((line, idx) => [String(idx + 1), line]);
    const csv = '\uFEFF' + rowsToUse
      .map((row) =>
        row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')
      )
      .join('\r\n');
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${baseFileName}.csv`);
    showToast(`Saved ${baseFileName}.csv`);
  };

  const handleExportXlsx = () => {
    if (!currentFile) return;
    const wb = XLSX.utils.book_new();

    // Sheet 1: Extracted_Text
    const lines = activeText.split(/\r?\n/).map((line, idx) => ({
      Line_No: idx + 1,
      Content: line,
    }));
    const wsText = XLSX.utils.json_to_sheet(lines.length ? lines : [{ Line_No: 1, Content: '' }]);
    wsText['!cols'] = [{ wch: 10 }, { wch: 95 }];
    XLSX.utils.book_append_sheet(wb, wsText, 'Extracted_Text');

    // Sheet 2: Page_Breakdown
    const pageRows = currentFile.pages.map((p) => ({
      Page_No: p.n,
      Extraction_Method: p.method,
      Confidence_Pct: p.conf ?? 'Text Layer (100%)',
      Words: countWords(p.text),
      Characters: p.text.length,
      Text_Preview: p.text.slice(0, 32000),
    }));
    const wsPages = XLSX.utils.json_to_sheet(pageRows);
    wsPages['!cols'] = [{ wch: 10 }, { wch: 18 }, { wch: 16 }, { wch: 10 }, { wch: 12 }, { wch: 80 }];
    XLSX.utils.book_append_sheet(wb, wsPages, 'Page_Summary');

    // Sheet 3: Business_Entities
    const entityRows: Array<{ Category: string; Value: string }> = [];
    entities.gstins.forEach((v) => entityRows.push({ Category: 'GSTIN', Value: v }));
    entities.pans.forEach((v) => entityRows.push({ Category: 'PAN', Value: v }));
    entities.ifscs.forEach((v) => entityRows.push({ Category: 'IFSC', Value: v }));
    entities.invoiceNos.forEach((v) => entityRows.push({ Category: 'Invoice / Ref No', Value: v }));
    entities.vins.forEach((v) => entityRows.push({ Category: 'VIN / Chassis', Value: v }));
    entities.hsns.forEach((v) => entityRows.push({ Category: 'HSN / SAC', Value: v }));
    entities.amounts.forEach((v) => entityRows.push({ Category: 'INR Amount', Value: v }));
    entities.dates.forEach((v) => entityRows.push({ Category: 'Date', Value: v }));
    entities.emails.forEach((v) => entityRows.push({ Category: 'Email', Value: v }));
    entities.phones.forEach((v) => entityRows.push({ Category: 'Phone', Value: v }));
    entities.urls.forEach((v) => entityRows.push({ Category: 'URL', Value: v }));

    const wsEntities = XLSX.utils.json_to_sheet(
      entityRows.length ? entityRows : [{ Category: 'Notice', Value: 'No structured entities matched' }]
    );
    wsEntities['!cols'] = [{ wch: 22 }, { wch: 48 }];
    XLSX.utils.book_append_sheet(wb, wsEntities, 'Business_Entities');

    // Sheet 4: Detected_Table
    if (editableTable.length > 0) {
      const wsTable = XLSX.utils.aoa_to_sheet(editableTable);
      XLSX.utils.book_append_sheet(wb, wsTable, 'Detected_Table');
    }

    const bytes = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    downloadBlob(
      new Blob([bytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      `${baseFileName}-ocr-workbook.xlsx`
    );
    showToast(`Exported ${baseFileName}-ocr-workbook.xlsx`);
  };

  const handleExportBatchExcel = () => {
    const doneFiles = files.filter((f) => f.pages.length > 0);
    if (!doneFiles.length) return;
    const wb = XLSX.utils.book_new();

    const summary = doneFiles.map((f, idx) => {
      const fullTxt = assembleText(f, 'all');
      const ent = extractStructuredEntities(fullTxt);
      const confList = f.pages.filter((p) => p.conf !== null).map((p) => p.conf ?? 0);
      const avg = confList.length
        ? Math.round(confList.reduce((a, b) => a + b, 0) / confList.length)
        : 100;
      return {
        Sl_No: idx + 1,
        File_Name: f.name,
        Type: f.kind.toUpperCase(),
        Pages: f.pages.length,
        Avg_Confidence_Pct: avg,
        Words: countWords(fullTxt),
        GSTINs: ent.gstins.join(', '),
        PANs: ent.pans.join(', '),
        Invoice_Nos: ent.invoiceNos.join(', '),
        VINs: ent.vins.join(', '),
        Amounts: ent.amounts.join(', '),
        Dates: ent.dates.join(', '),
        Extracted_Text: fullTxt.slice(0, 32000),
      };
    });
    const wsBatch = XLSX.utils.json_to_sheet(summary);
    wsBatch['!cols'] = [
      { wch: 7 },
      { wch: 28 },
      { wch: 8 },
      { wch: 8 },
      { wch: 16 },
      { wch: 10 },
      { wch: 22 },
      { wch: 16 },
      { wch: 20 },
      { wch: 22 },
      { wch: 26 },
      { wch: 18 },
      { wch: 80 },
    ];
    XLSX.utils.book_append_sheet(wb, wsBatch, 'Batch_OCR_Summary');

    const bytes = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    downloadBlob(
      new Blob([bytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      `vcpl-textlift-batch-${doneFiles.length}-files.xlsx`
    );
    showToast(`Exported Batch Workbook (${doneFiles.length} files)`);
  };

  // Interactive ROI Crop Mouse Handlers
  const getNormalizedCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    return { x, y };
  };

  const handleRoiMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!rawCanvas || previewTab !== 'processed') return;
    const pt = getNormalizedCanvasPoint(e);
    if (!pt) return;
    setRoiDrawing(true);
    setRoiStart(pt);
    setRoiDraft({ x: pt.x, y: pt.y, w: 0, h: 0 });
  };

  const handleRoiMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!roiDrawing || !roiStart) return;
    const pt = getNormalizedCanvasPoint(e);
    if (!pt) return;
    setRoiDraft({
      x: Math.min(roiStart.x, pt.x),
      y: Math.min(roiStart.y, pt.y),
      w: Math.abs(pt.x - roiStart.x),
      h: Math.abs(pt.y - roiStart.y),
    });
  };

  const handleRoiMouseUp = () => {
    if (!roiDrawing) return;
    setRoiDrawing(false);
    setRoiStart(null);
    if (roiDraft && roiDraft.w > 0.03 && roiDraft.h > 0.03) {
      setImgOpts((prev) => ({ ...prev, crop: roiDraft }));
      showToast('ROI Crop Region locked for OCR scan');
    } else {
      setRoiDraft(null);
    }
  };

  const completedFilesCount = files.filter((f) => f.pages.length > 0).length;
  const pendingCount = files.filter((f) => f.status !== 'done').length;

  return (
    <div className="space-y-4">
      {/* Top VCPL Workbench Header Card */}
      <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-4 sm:p-6 shadow-[0_4px_0_#2F3E4E]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] text-[#2F3E4E] flex items-center justify-center shrink-0 shadow-[0_2px_0_#2F3E4E]">
              <ScanText className="w-6 h-6" aria-hidden="true" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-[#2F3E4E] text-[#F9C80E] font-mono text-[10px] font-extrabold uppercase tracking-wider">
                  {tool.code} · Box 19
                </span>
                <span className="px-2 py-0.5 rounded bg-[#CEE5DC] border border-[#2F3E4E]/35 text-[#2F3E4E] font-display text-[10px] font-extrabold uppercase tracking-wider inline-flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-[#12805C]" aria-hidden="true" />
                  <span>Open Access · No Passcode</span>
                </span>
                <span className="px-2 py-0.5 rounded bg-[#FEF2C8] border border-[#2F3E4E]/30 text-[#2F3E4E] font-mono text-[10px] font-bold">
                  25+ Languages · Tesseract v7 + PDF.js
                </span>
              </div>
              <h1 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] tracking-tight">
                {tool.title}
              </h1>
              <p className="text-xs sm:text-sm text-[#475569] leading-relaxed">
                Extract clean text, tables &amp; GST/Banking entities (GSTIN, PAN, IFSC, VIN, HSN, INR) from photos, screenshots, and scanned multi-page PDFs directly in your browser.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleLoadSample}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl bg-[#FEF2C8] hover:bg-[#FFE1B3] border-[1.5px] border-[#2F3E4E] text-xs font-bold text-[#2F3E4E] transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Try Sample Invoice</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-xl bg-[#F9C80E] hover:bg-[#FFE1B3] border-[1.5px] border-[#2F3E4E] shadow-[0_2px_0_#2F3E4E] text-xs font-display font-extrabold text-[#2F3E4E] transition cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Add Images / PDFs</span>
            </button>
          </div>
        </div>

        {/* One-Click OCR Domain Presets Strip */}
        <div className="mt-4 pt-4 border-t border-[#2F3E4E]/15">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-display font-extrabold uppercase tracking-wider text-[#475569] mr-1 inline-flex items-center gap-1">
              <Wand2 className="w-3.5 h-3.5 text-[#2F3E4E]" aria-hidden="true" />
              <span>Smart Presets:</span>
            </span>
            {PRESETS.map((preset) => {
              const isSelected = activePreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  title={preset.hint}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                    isSelected
                      ? 'bg-[#2F3E4E] text-[#F9C80E] border-[#2F3E4E] shadow-[0_2px_0_#1E293B]'
                      : 'bg-white hover:bg-[#FEF2C8] text-[#2F3E4E] border-[#2F3E4E]/30'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main 2-Column VCPL Workbench */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* LEFT COLUMN (4 cols): Dropzone, Batch Queue, OCR Controls & Live DSP */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-4 lg:max-h-[calc(100dvh-5.5rem)] lg:overflow-y-auto lg:pr-1.5">
          {/* Dropzone Card */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              setIsDraggingOver(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDraggingOver(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingOver(false);
              if (e.dataTransfer?.files?.length) {
                addFiles(e.dataTransfer.files);
              }
            }}
            className={`rounded-2xl border-2 border-dashed p-5 text-center cursor-pointer transition-all ${
              isDraggingOver
                ? 'border-[#2F3E4E] bg-[#CEE5DC] scale-[1.01]'
                : 'border-[#2F3E4E]/55 bg-[#FFFDF5] hover:bg-[#FEF2C8]/65 hover:border-[#2F3E4E]'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,application/pdf"
              onChange={(e) => {
                if (e.target.files?.length) addFiles(e.target.files);
                e.target.value = '';
              }}
              className="hidden"
            />
            <div className="w-11 h-11 mx-auto rounded-xl bg-[#CEE5DC] border-[1.5px] border-[#2F3E4E] text-[#2F3E4E] flex items-center justify-center mb-2.5">
              <ClipboardPaste className="w-5 h-5" aria-hidden="true" />
            </div>
            <p className="font-display font-extrabold text-sm text-[#2F3E4E]">
              Drop Photos / PDFs or Click to Browse
            </p>
            <p className="text-xs text-[#475569] mt-1">
              Or press <kbd className="px-1.5 py-0.5 rounded bg-[#FEF2C8] border border-[#2F3E4E]/35 font-mono text-[10px] font-bold">Ctrl/Cmd + V</kbd> anywhere to paste a screenshot
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {['.JPG', '.PNG', '.WEBP', '.BMP', '.AVIF', '.PDF'].map((ext) => (
                <span
                  key={ext}
                  className="px-2 py-0.5 rounded bg-[#FEF2C8] border border-[#2F3E4E]/25 font-mono text-[10px] font-bold text-[#2F3E4E]"
                >
                  {ext}
                </span>
              ))}
            </div>
          </div>

          {/* Batch Queue Panel */}
          <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display font-extrabold text-xs uppercase tracking-wider text-[#2F3E4E] flex items-center gap-1.5">
                <Layers className="w-4 h-4" aria-hidden="true" />
                <span>Batch Queue ({files.length})</span>
              </h2>
              {completedFilesCount > 1 && (
                <button
                  type="button"
                  onClick={handleExportBatchExcel}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#CEE5DC] hover:bg-[#F9C80E] border border-[#2F3E4E] text-[11px] font-bold text-[#2F3E4E] transition cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Batch .XLSX</span>
                </button>
              )}
            </div>

            {files.length === 0 ? (
              <p className="text-xs text-[#64748B] py-3 text-center border border-dashed border-[#2F3E4E]/25 rounded-xl bg-white/60">
                No files queued yet. Drop documents or click &ldquo;Try Sample Invoice&rdquo;.
              </p>
            ) : (
              <ul className="space-y-2 max-h-[260px] overflow-y-auto pr-0.5">
                {files.map((item) => {
                  const isActive = item.id === currentId;
                  return (
                    <li
                      key={item.id}
                      onClick={() => {
                        setCurrentId(item.id);
                        setSelectedPage('all');
                      }}
                      className={`p-2.5 rounded-xl border-[1.5px] cursor-pointer transition flex items-center gap-2.5 ${
                        isActive
                          ? 'bg-[#CEE5DC]/80 border-[#2F3E4E] shadow-[0_2px_0_#2F3E4E]'
                          : 'bg-white border-[#2F3E4E]/25 hover:border-[#2F3E4E]/60'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-lg bg-[#FEF2C8] border border-[#2F3E4E]/35 flex items-center justify-center shrink-0 overflow-hidden font-mono text-[10px] font-bold text-[#2F3E4E]">
                        {item.thumbUrl ? (
                          <img src={item.thumbUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span>PDF</span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-[#2F3E4E] truncate">{item.name}</p>
                        <p
                          className={`text-[11px] truncate ${
                            item.status === 'done'
                              ? 'text-[#12805C] font-semibold'
                              : item.status === 'error'
                              ? 'text-[#B42318] font-semibold'
                              : 'text-[#64748B]'
                          }`}
                        >
                          {fmtSize(item.size)} · {item.msg}
                        </p>
                        <div className="h-1.5 bg-[#2F3E4E]/15 rounded-full overflow-hidden mt-1">
                          <div
                            className="h-full bg-[#2F3E4E] transition-all duration-200"
                            style={{ width: `${Math.round(item.pct * 100)}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {item.status === 'done' && !running && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              runOcrQueue(item.id);
                            }}
                            title="Re-scan this file with current settings"
                            className="p-1.5 rounded-lg bg-white hover:bg-[#F9C80E] border border-[#2F3E4E]/30 text-[#2F3E4E] cursor-pointer"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={running}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFile(item.id);
                          }}
                          title="Remove file"
                          aria-label={`Remove ${item.name}`}
                          className="p-1.5 rounded-lg text-[#64748B] hover:text-[#B42318] hover:bg-[#FEE2E2] disabled:opacity-40 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                disabled={running || (pendingCount === 0 && !currentFile)}
                onClick={() => runOcrQueue(pendingCount === 0 && currentFile ? currentFile.id : undefined)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[42px] rounded-xl bg-[#F9C80E] hover:bg-[#FFE1B3] disabled:opacity-45 border-[1.5px] border-[#2F3E4E] shadow-[0_3px_0_#2F3E4E] font-display font-extrabold text-xs text-[#2F3E4E] transition cursor-pointer disabled:cursor-not-allowed"
              >
                {running ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    <span>Reading Text…</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{pendingCount === 0 && currentFile ? 'Re-scan Current' : `Extract Text (${pendingCount})`}</span>
                  </>
                )}
              </button>

              {running && (
                <button
                  type="button"
                  onClick={handleStop}
                  className="inline-flex items-center gap-1 px-3 py-2.5 min-h-[42px] rounded-xl bg-[#FEE2E2] hover:bg-[#FECACA] border-[1.5px] border-[#B42318] text-xs font-bold text-[#991B1B] cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Stop</span>
                </button>
              )}

              <button
                type="button"
                disabled={running || files.length === 0}
                onClick={handleClearAll}
                className="inline-flex items-center gap-1 px-3 py-2.5 min-h-[42px] rounded-xl bg-white hover:bg-[#FEF2C8] disabled:opacity-40 border-[1.5px] border-[#2F3E4E] text-xs font-bold text-[#2F3E4E] cursor-pointer disabled:cursor-not-allowed"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Clear</span>
              </button>
            </div>

            <p className="text-[11px] text-[#475569] bg-[#FEF2C8]/75 border border-[#2F3E4E]/20 rounded-lg px-2.5 py-2 leading-snug">
              {engineStatus}
            </p>
          </div>

          {/* Recognition & DSP Controls Card */}
          <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-4 space-y-3.5">
            <h2 className="font-display font-extrabold text-xs uppercase tracking-wider text-[#2F3E4E] flex items-center gap-1.5">
              <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
              <span>OCR Engine &amp; Image DSP Controls</span>
            </h2>

            <div className="space-y-2.5">
              <div>
                <label
                  htmlFor="textlift-lang"
                  className="text-xs font-bold text-[#2F3E4E] flex items-center gap-1 mb-1"
                >
                  <Languages className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Language Script (25+)</span>
                </label>
                <select
                  id="textlift-lang"
                  value={lang}
                  onChange={(e) => {
                    setLang(e.target.value);
                    setFiles((prev) =>
                      prev.map((f) =>
                        f.status === 'done'
                          ? { ...f, status: 'queued', pct: 0, msg: 'Settings updated · Ready to re-scan' }
                          : f
                      )
                    );
                  }}
                  className="w-full h-9 px-2.5 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white text-xs font-semibold text-[#2F3E4E]"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="textlift-psm" className="block text-xs font-bold text-[#2F3E4E] mb-1">
                    Page Layout (PSM)
                  </label>
                  <select
                    id="textlift-psm"
                    value={psm}
                    onChange={(e) => setPsm(e.target.value)}
                    className="w-full h-9 px-2 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white text-xs font-semibold text-[#2F3E4E]"
                  >
                    {PSM_MODES.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="textlift-whitelist" className="block text-xs font-bold text-[#2F3E4E] mb-1">
                    Character Whitelist
                  </label>
                  <select
                    id="textlift-whitelist"
                    value={whitelistMode}
                    onChange={(e) => setWhitelistMode(e.target.value as WhitelistMode)}
                    className="w-full h-9 px-2 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white text-xs font-semibold text-[#2F3E4E]"
                  >
                    <option value="all">All Characters (Default)</option>
                    <option value="numbers">INR &amp; Numbers Only</option>
                    <option value="alnum-id">Alphanumeric IDs (GSTIN/PAN/VIN)</option>
                    <option value="custom">Custom Whitelist…</option>
                  </select>
                </div>
              </div>

              {whitelistMode === 'custom' && (
                <div>
                  <input
                    type="text"
                    value={customWhitelist}
                    onChange={(e) => setCustomWhitelist(e.target.value)}
                    placeholder="Allowed chars e.g. 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-/"
                    className="w-full h-8 px-2.5 rounded-lg border border-[#2F3E4E] bg-white font-mono text-xs text-[#2F3E4E]"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="textlift-pdfmode" className="block text-xs font-bold text-[#2F3E4E] mb-1">
                    PDF Strategy
                  </label>
                  <select
                    id="textlift-pdfmode"
                    value={pdfMode}
                    onChange={(e) => setPdfMode(e.target.value as 'auto' | 'ocr')}
                    className="w-full h-9 px-2 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white text-xs font-semibold text-[#2F3E4E]"
                  >
                    <option value="auto">Auto (Text layer, OCR fallback)</option>
                    <option value="ocr">Force OCR every page as image</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="textlift-range" className="block text-xs font-bold text-[#2F3E4E] mb-1">
                    PDF Page Range
                  </label>
                  <input
                    id="textlift-range"
                    type="text"
                    value={pageRangeStr}
                    onChange={(e) => setPageRangeStr(e.target.value)}
                    placeholder="All pages (e.g. 1-3, 5)"
                    className="w-full h-9 px-2.5 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white text-xs font-medium text-[#2F3E4E]"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs font-bold text-[#2F3E4E] mb-1">
                  <span>PDF Render Quality Scale</span>
                  <span className="font-mono">{scale.toFixed(1)}× ({Math.round(scale * 108)} DPI)</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.5}
                  value={scale}
                  onChange={(e) => setScale(parseFloat(e.target.value))}
                  className="w-full accent-[#2F3E4E]"
                />
              </div>
            </div>

            {/* Canvas DSP Controls */}
            <div className="pt-2.5 border-t border-[#2F3E4E]/15 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-display font-extrabold uppercase tracking-wider text-[#475569]">
                  Canvas DSP Pre-Processing
                </span>
                <button
                  type="button"
                  onClick={() => setImgOpts(DEFAULT_IMG_OPTS)}
                  className="text-[11px] font-bold text-[#2F3E4E] hover:text-[#12805C] underline cursor-pointer"
                >
                  Reset DSP
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="flex justify-between text-[11px] font-semibold text-[#2F3E4E]">
                    <span>Contrast</span>
                    <span className="font-mono">{imgOpts.contrast.toFixed(2)}×</span>
                  </div>
                  <input
                    type="range"
                    min={0.6}
                    max={2.2}
                    step={0.05}
                    value={imgOpts.contrast}
                    onChange={(e) =>
                      setImgOpts((p) => ({ ...p, contrast: parseFloat(e.target.value) }))
                    }
                    className="w-full accent-[#2F3E4E]"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[11px] font-semibold text-[#2F3E4E]">
                    <span>Brightness</span>
                    <span className="font-mono">{imgOpts.brightness > 0 ? `+${imgOpts.brightness}` : imgOpts.brightness}</span>
                  </div>
                  <input
                    type="range"
                    min={-40}
                    max={40}
                    step={2}
                    value={imgOpts.brightness}
                    onChange={(e) =>
                      setImgOpts((p) => ({ ...p, brightness: parseInt(e.target.value, 10) }))
                    }
                    className="w-full accent-[#2F3E4E]"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-semibold text-[#2F3E4E]">
                  <span>Fine Deskew Tilt</span>
                  <span className="font-mono">{imgOpts.deskewDeg.toFixed(1)}°</span>
                </div>
                <input
                  type="range"
                  min={-15}
                  max={15}
                  step={0.5}
                  value={imgOpts.deskewDeg}
                  onChange={(e) =>
                    setImgOpts((p) => ({ ...p, deskewDeg: parseFloat(e.target.value) }))
                  }
                  className="w-full accent-[#2F3E4E]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setImgOpts((p) => ({
                      ...p,
                      rotation: ((p.rotation + 90) % 360) as 0 | 90 | 180 | 270,
                    }))
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-[#FEF2C8] border border-[#2F3E4E] text-[11px] font-bold text-[#2F3E4E] cursor-pointer"
                >
                  <RotateCw className="w-3 h-3" aria-hidden="true" />
                  <span>Rotate 90° ({imgOpts.rotation}°)</span>
                </button>

                {imgOpts.crop && (
                  <button
                    type="button"
                    onClick={() => {
                      setImgOpts((p) => ({ ...p, crop: null }));
                      setRoiDraft(null);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#FFE1B3] hover:bg-[#F9C80E] border border-[#2F3E4E] text-[11px] font-bold text-[#2F3E4E] cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" aria-hidden="true" />
                    <span>Clear ROI Crop</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-[#2F3E4E]">
                {[
                  { key: 'upscale', label: 'Smart 2.2K Upscale' },
                  { key: 'grayscaleContrast', label: 'Auto Contrast Stretch' },
                  { key: 'binarize', label: 'Otsu B&W Threshold' },
                  { key: 'sharpen', label: '3×3 Edge Sharpen' },
                  { key: 'invert', label: 'Invert Dark Mode' },
                ].map((opt) => (
                  <label key={opt.key} className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={Boolean(imgOpts[opt.key as keyof ImageProcessOptions])}
                      onChange={(e) =>
                        setImgOpts((p) => ({ ...p, [opt.key]: e.target.checked }))
                      }
                      className="accent-[#2F3E4E] w-3.5 h-3.5"
                    />
                    <span className="text-[11px] font-semibold">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Post-OCR Cleanup Checkboxes */}
            <div className="pt-2.5 border-t border-[#2F3E4E]/15 space-y-1.5">
              <span className="text-[11px] font-display font-extrabold uppercase tracking-wider text-[#475569] block">
                Text Assembly &amp; Cleanup
              </span>
              {[
                {
                  checked: joinParagraphs,
                  setter: setJoinParagraphs,
                  label: 'Join wrapped lines into paragraphs',
                },
                {
                  checked: fixHyphens,
                  setter: setFixHyphens,
                  label: 'Repair words split by trailing hyphens',
                },
                {
                  checked: trimExtraSpaces,
                  setter: setTrimExtraSpaces,
                  label: 'Collapse extra spaces & blank lines',
                },
                {
                  checked: showPageMarkers,
                  setter: setShowPageMarkers,
                  label: 'Include PDF page separator banners',
                },
              ].map((item) => (
                <label
                  key={item.label}
                  className="flex items-center gap-2 cursor-pointer text-[11px] font-semibold text-[#2F3E4E]"
                >
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={(e) => {
                      item.setter(e.target.checked);
                      if (currentFile) {
                        updateFileState(currentFile.id, { edited: null, editedFor: null });
                      }
                    }}
                    className="accent-[#2F3E4E] w-3.5 h-3.5"
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (8 cols): Live DSP Studio + Multi-Tab Output Workbench */}
        <div className="lg:col-span-7 xl:col-span-8 lg:sticky lg:top-20 space-y-4">
          {/* Interactive Before / After DSP + ROI Crop Preview Card */}
          {rawCanvas && (
            <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl overflow-hidden">
              <div className="px-4 py-2.5 bg-[#FEF2C8]/75 border-b border-[#2F3E4E]/15 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-[#2F3E4E]" aria-hidden="true" />
                  <span className="font-display font-extrabold text-xs text-[#2F3E4E]">
                    Live DSP Preview &amp; Drag-to-Crop ROI
                  </span>
                  {imgOpts.crop && (
                    <span className="px-2 py-0.5 rounded bg-[#CEE5DC] border border-[#2F3E4E]/35 font-mono text-[10px] font-bold text-[#2F3E4E]">
                      ROI: {Math.round(imgOpts.crop.w * 100)}% × {Math.round(imgOpts.crop.h * 100)}%
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPreviewTab('processed')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                      previewTab === 'processed'
                        ? 'bg-[#2F3E4E] text-[#F9C80E] border-[#2F3E4E]'
                        : 'bg-white text-[#2F3E4E] border-[#2F3E4E]/25'
                    }`}
                  >
                    Enhanced Feed
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTab('original')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                      previewTab === 'original'
                        ? 'bg-[#2F3E4E] text-[#F9C80E] border-[#2F3E4E]'
                        : 'bg-white text-[#2F3E4E] border-[#2F3E4E]/25'
                    }`}
                  >
                    Original
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPreviewStudio((p) => !p)}
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-[#F9C80E]/50 border border-[#2F3E4E]/30 text-[11px] font-bold text-[#2F3E4E] cursor-pointer"
                  >
                    {showPreviewStudio ? 'Hide Preview' : 'Show Preview'}
                  </button>
                </div>
              </div>

              {showPreviewStudio && (
                <div className="p-3 bg-[#1E293B]/5 flex flex-col items-center">
                  <div className="relative inline-block max-w-full overflow-hidden rounded-xl border border-[#2F3E4E]/30 bg-white">
                    <canvas
                      ref={previewCanvasRef}
                      onMouseDown={handleRoiMouseDown}
                      onMouseMove={handleRoiMouseMove}
                      onMouseUp={handleRoiMouseUp}
                      onMouseLeave={handleRoiMouseUp}
                      className="max-w-full max-h-[250px] w-auto h-auto block cursor-crosshair select-none"
                    />
                    {(roiDraft || imgOpts.crop) && previewTab === 'processed' && (
                      <div
                        className="pointer-events-none absolute border-2 border-[#F9C80E] bg-[#F9C80E]/20 shadow-xs"
                        style={{
                          left: `${((roiDraft || imgOpts.crop)!.x) * 100}%`,
                          top: `${((roiDraft || imgOpts.crop)!.y) * 100}%`,
                          width: `${((roiDraft || imgOpts.crop)!.w) * 100}%`,
                          height: `${((roiDraft || imgOpts.crop)!.h) * 100}%`,
                        }}
                      />
                    )}
                  </div>
                  <p className="mt-2 text-[11px] text-[#475569] inline-flex items-center gap-1">
                    <Crop className="w-3 h-3" aria-hidden="true" />
                    <span>Drag directly over any invoice total, address block, or table above to OCR only that Region of Interest, then click Re-scan.</span>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Output Panel */}
          <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-4 sm:p-5 space-y-4 shadow-[0_4px_0_#2F3E4E]">
            {/* Page Selector Tabs + Confidence Metrics */}
            {currentFile && currentFile.pages.length > 0 && (
              <div className="space-y-3">
                {currentFile.pages.length > 1 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedPage('all')}
                      className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold border transition cursor-pointer ${
                        selectedPage === 'all'
                          ? 'bg-[#2F3E4E] text-[#F9C80E] border-[#2F3E4E]'
                          : 'bg-white text-[#2F3E4E] border-[#2F3E4E]/30 hover:bg-[#FEF2C8]'
                      }`}
                    >
                      All Pages ({currentFile.pages.length})
                    </button>
                    {currentFile.pages.map((pg) => (
                      <button
                        key={pg.n}
                        type="button"
                        onClick={() => setSelectedPage(pg.n)}
                        className={`px-2.5 py-1.5 rounded-lg font-mono text-xs font-bold border transition cursor-pointer ${
                          selectedPage === pg.n
                            ? 'bg-[#2F3E4E] text-[#F9C80E] border-[#2F3E4E]'
                            : 'bg-white text-[#2F3E4E] border-[#2F3E4E]/30 hover:bg-[#FEF2C8]'
                        }`}
                      >
                        P{pg.n}
                        {pg.conf !== null ? ` · ${pg.conf}%` : ' · TXT'}
                      </button>
                    ))}
                  </div>
                )}

                {/* Telemetry & Workbench Sub-Tabs */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#2F3E4E]/15">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                    <span className="px-2.5 py-1 rounded-lg bg-[#FEF2C8] border border-[#2F3E4E]/25 font-bold text-[#2F3E4E]">
                      Words: {countWords(activeText).toLocaleString()}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-[#FEF2C8] border border-[#2F3E4E]/25 font-bold text-[#2F3E4E]">
                      Chars: {activeText.length.toLocaleString()}
                    </span>
                    {avgConfidence !== null ? (
                      <span
                        className={`px-2.5 py-1 rounded-lg border font-bold ${
                          avgConfidence >= 85
                            ? 'bg-[#CEE5DC] border-[#12805C] text-[#12805C]'
                            : avgConfidence >= 65
                            ? 'bg-[#FFE1B3] border-[#B45309] text-[#B45309]'
                            : 'bg-[#FEE2E2] border-[#B42318] text-[#991B1B]'
                        }`}
                      >
                        Confidence: {avgConfidence}%
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-lg bg-[#CEE5DC] border border-[#2F3E4E]/30 font-bold text-[#2F3E4E]">
                        Digital PDF Text Layer (100%)
                      </span>
                    )}
                  </div>

                  {/* 4 Power Workbench Mode Tabs */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[
                      { id: 'editor', label: 'Text Editor', icon: FileText },
                      {
                        id: 'heatmap',
                        label: `Heatmap${lowConfidenceWords.length ? ` (${lowConfidenceWords.length}?)` : ''}`,
                        icon: Sparkles,
                      },
                      {
                        id: 'entities',
                        label: `GST & Entities (${totalEntitiesCount})`,
                        icon: Search,
                      },
                      {
                        id: 'table',
                        label: `Table Grid (${editableTable.length})`,
                        icon: Table2,
                      },
                    ].map((tab) => {
                      const TIcon = tab.icon;
                      const active = resultTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setResultTab(tab.id as ResultTab)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                            active
                              ? 'bg-[#2F3E4E] text-[#F9C80E] border-[#2F3E4E]'
                              : 'bg-white text-[#2F3E4E] border-[#2F3E4E]/30 hover:bg-[#FEF2C8]'
                          }`}
                        >
                          <TIcon className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Empty / Working Placeholder */}
            {!currentFile || !currentFile.pages.length ? (
              <div className="rounded-xl border-2 border-dashed border-[#2F3E4E]/30 bg-white/75 p-10 text-center space-y-2.5">
                <div className="w-12 h-12 mx-auto rounded-xl bg-[#FEF2C8] border-[1.5px] border-[#2F3E4E] text-[#2F3E4E] flex items-center justify-center">
                  {currentFile?.status === 'working' ? (
                    <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
                  ) : currentFile?.status === 'error' ? (
                    <AlertTriangle className="w-6 h-6 text-[#B42318]" aria-hidden="true" />
                  ) : (
                    <ImageIcon className="w-6 h-6" aria-hidden="true" />
                  )}
                </div>
                <h3 className="font-display font-extrabold text-base text-[#2F3E4E]">
                  {!currentFile
                    ? 'Nothing extracted yet'
                    : currentFile.status === 'working'
                    ? `Reading ${currentFile.name}…`
                    : currentFile.status === 'error'
                    ? 'Extraction Error'
                    : `Ready to scan ${currentFile.name}`}
                </h3>
                <p className="text-xs sm:text-sm text-[#475569] max-w-md mx-auto">
                  {!currentFile
                    ? 'Drop an image, screenshot, or PDF on the left—or click "Try Sample Invoice" above to inspect GSTIN, PAN, HSN & Excel table extraction right away.'
                    : currentFile.status === 'error'
                    ? currentFile.msg
                    : currentFile.status === 'working'
                    ? currentFile.msg
                    : 'Optionally pick a preset, adjust contrast or draw a crop ROI above, then click Extract Text.'}
                </p>
              </div>
            ) : (
              <>
                {avgConfidence !== null && avgConfidence < 68 && (
                  <div className="rounded-xl bg-[#FFE1B3] border-[1.5px] border-[#B45309] px-3.5 py-2.5 flex items-start gap-2 text-xs text-[#2F3E4E]">
                    <AlertTriangle className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" aria-hidden="true" />
                    <span>
                      <strong>Low Confidence ({avgConfidence}%):</strong> Try enabling{' '}
                      <strong>Otsu B&amp;W Threshold</strong>, increasing PDF scale to <strong>2.5×/3.0×</strong>, or drawing an ROI box around the text before clicking Re-scan.
                    </span>
                  </div>
                )}

                {/* TAB 1: Editable Text Area + Find & Replace */}
                {resultTab === 'editor' && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={findQuery}
                        onChange={(e) => setFindQuery(e.target.value)}
                        placeholder={useRegexFind ? 'Regex pattern (e.g. Rs\\.\\s*)' : 'Find text…'}
                        aria-label="Find text"
                        className="flex-1 min-w-[140px] h-9 px-3 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white text-xs font-medium text-[#2F3E4E]"
                      />
                      <input
                        type="text"
                        value={replaceQuery}
                        onChange={(e) => setReplaceQuery(e.target.value)}
                        placeholder="Replace with…"
                        aria-label="Replace with"
                        className="flex-1 min-w-[140px] h-9 px-3 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white text-xs font-medium text-[#2F3E4E]"
                      />
                      <label className="inline-flex items-center gap-1.5 px-2.5 h-9 rounded-lg border border-[#2F3E4E]/35 bg-[#FEF2C8]/65 text-xs font-bold text-[#2F3E4E] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useRegexFind}
                          onChange={(e) => setUseRegexFind(e.target.checked)}
                          className="accent-[#2F3E4E]"
                        />
                        <span>Regex</span>
                      </label>
                      <button
                        type="button"
                        onClick={handleReplaceAll}
                        className="h-9 px-3.5 rounded-lg bg-[#2F3E4E] hover:bg-[#1E293B] text-[#FFFDF5] text-xs font-bold cursor-pointer"
                      >
                        Replace All
                      </button>
                    </div>

                    <textarea
                      value={activeText}
                      onChange={(e) =>
                        updateFileState(currentFile.id, {
                          edited: e.target.value,
                          editedFor: selectedPage,
                        })
                      }
                      spellCheck={false}
                      rows={16}
                      aria-label="Editable extracted text"
                      className="w-full min-h-[340px] p-3.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white font-mono text-xs sm:text-[13px] leading-relaxed text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
                    />
                  </div>
                )}

                {/* TAB 2: Word Confidence Heatmap + Quick Fixer */}
                {resultTab === 'heatmap' && (
                  <div className="space-y-3">
                    {allWords.length === 0 ? (
                      <div className="p-6 text-center rounded-xl border border-[#2F3E4E]/25 bg-white text-xs text-[#475569]">
                        Confidence heatmap is generated for image/OCR scans. For digital PDF pages with an embedded text layer, accuracy is already 100%. Switch PDF Strategy to <strong>Force OCR</strong> if you want optical word tokens.
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                            <Filter className="w-3.5 h-3.5 text-[#2F3E4E]" aria-hidden="true" />
                            {[
                              { id: 'all', label: `All (${allWords.length})` },
                              { id: 'low', label: `Low <70% (${allWords.filter((w) => w.confidence < 70).length})` },
                              { id: 'mid', label: `Medium 70–87% (${allWords.filter((w) => w.confidence >= 70 && w.confidence < 88).length})` },
                              { id: 'high', label: `High ≥88% (${allWords.filter((w) => w.confidence >= 88).length})` },
                            ].map((flt) => (
                              <button
                                key={flt.id}
                                type="button"
                                onClick={() =>
                                  setConfidenceFilter(flt.id as 'all' | 'low' | 'mid' | 'high')
                                }
                                className={`px-2.5 py-1 rounded-md border cursor-pointer ${
                                  confidenceFilter === flt.id
                                    ? 'bg-[#2F3E4E] text-[#F9C80E] border-[#2F3E4E]'
                                    : 'bg-white text-[#2F3E4E] border-[#2F3E4E]/25'
                                }`}
                              >
                                {flt.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="p-3.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white max-h-[340px] overflow-y-auto flex flex-wrap gap-1.5 leading-normal">
                          {filteredHeatmapWords.map((w, idx) => {
                            const tone =
                              w.confidence >= 88
                                ? 'bg-[#CEE5DC]/75 border-[#12805C]/35 text-[#0F5132]'
                                : w.confidence >= 70
                                ? 'bg-[#FFE1B3]/80 border-[#B45309]/40 text-[#7C2D12]'
                                : 'bg-[#FEE2E2] border-[#B42318]/60 text-[#991B1B] font-bold underline decoration-wavy';
                            return (
                              <span
                                key={`${w.text}-${idx}`}
                                title={`Confidence: ${w.confidence}%${
                                  w.confidence < 75 ? ' · Click to edit in prompt' : ''
                                }`}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-mono text-xs ${tone}`}
                              >
                                <span>{w.text}</span>
                                <span className="text-[10px] opacity-70">{w.confidence}%</span>
                              </span>
                            );
                          })}
                        </div>

                        {lowConfidenceWords.length > 0 && (
                          <div className="rounded-xl bg-[#FEF2C8]/80 border border-[#2F3E4E]/25 p-3 space-y-2">
                            <p className="text-xs font-bold text-[#2F3E4E]">
                              Quick Correct Uncertain Words (edit inline &amp; press Apply):
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                              {Array.from(new Set(lowConfidenceWords.map((w) => w.text)))
                                .slice(0, 12)
                                .map((badWord) => (
                                  <WordFixRow
                                    key={badWord}
                                    original={badWord}
                                    onApply={handleCorrectWord}
                                  />
                                ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* TAB 3: Indian Business, GST, Banking & Vehicle Entities */}
                {resultTab === 'entities' && (
                  <div className="space-y-3">
                    {totalEntitiesCount === 0 ? (
                      <div className="p-8 text-center rounded-xl border border-[#2F3E4E]/25 bg-white text-xs text-[#475569]">
                        No structured GSTIN, PAN, IFSC, VIN, HSN, INR amounts, dates, or contact identifiers were detected in this extract.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          { label: 'GSTINs', items: entities.gstins, accent: 'bg-[#CEE5DC]' },
                          { label: 'PAN Numbers', items: entities.pans, accent: 'bg-[#FEF2C8]' },
                          { label: 'IFSC Bank Codes', items: entities.ifscs, accent: 'bg-[#FFE1B3]' },
                          { label: 'Invoice / Ref Nos', items: entities.invoiceNos, accent: 'bg-[#CEE5DC]' },
                          { label: 'VIN / Chassis (17-char)', items: entities.vins, accent: 'bg-[#F9C80E]/55' },
                          { label: 'HSN / SAC Codes', items: entities.hsns, accent: 'bg-[#FEF2C8]' },
                          { label: 'INR Monetary Amounts', items: entities.amounts, accent: 'bg-[#CEE5DC]' },
                          { label: 'Dates Detected', items: entities.dates, accent: 'bg-[#FFE1B3]' },
                          { label: 'Email Addresses', items: entities.emails, accent: 'bg-[#FEF2C8]' },
                          { label: 'Phone / Mobile (+91)', items: entities.phones, accent: 'bg-[#CEE5DC]' },
                          { label: 'URLs', items: entities.urls, accent: 'bg-[#FEF2C8]' },
                        ]
                          .filter((group) => group.items.length > 0)
                          .map((group) => (
                            <div
                              key={group.label}
                              className="rounded-xl border-[1.5px] border-[#2F3E4E] bg-white p-3 space-y-2"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-display font-extrabold text-xs text-[#2F3E4E]">
                                  {group.label} ({group.items.length})
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleCopyText(
                                      group.items.join('\n'),
                                      `Copied ${group.items.length} ${group.label}`
                                    )
                                  }
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#FEF2C8] hover:bg-[#F9C80E] border border-[#2F3E4E]/35 text-[10px] font-bold text-[#2F3E4E] cursor-pointer"
                                >
                                  <Copy className="w-3 h-3" />
                                  <span>Copy All</span>
                                </button>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {group.items.map((val) => (
                                  <button
                                    key={val}
                                    type="button"
                                    onClick={() => handleCopyText(val, `Copied ${val}`)}
                                    title="Click to copy"
                                    className={`px-2 py-1 rounded-md border border-[#2F3E4E]/30 ${group.accent} font-mono text-xs font-bold text-[#2F3E4E] hover:brightness-95 cursor-pointer`}
                                  >
                                    {val}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 4: Editable Spreadsheet Table Grid */}
                {resultTab === 'table' && (
                  <div className="space-y-3">
                    {editableTable.length === 0 ? (
                      <div className="p-8 text-center rounded-xl border border-[#2F3E4E]/25 bg-white text-xs text-[#475569]">
                        No multi-column rows were detected. Tip: For dense tabular invoices or ledgers, switch Page Layout to <strong>PSM 6 · Uniform block</strong> and extract again.
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="font-semibold text-[#475569]">
                            Click any cell below to edit before exporting to CSV or Excel (.XLSX).
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleExportCsv}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white hover:bg-[#FEF2C8] border border-[#2F3E4E] text-xs font-bold text-[#2F3E4E] cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Export Table .CSV</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleExportXlsx}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#CEE5DC] hover:bg-[#F9C80E] border border-[#2F3E4E] text-xs font-bold text-[#2F3E4E] cursor-pointer"
                            >
                              <FileSpreadsheet className="w-3.5 h-3.5" />
                              <span>Export Workbook .XLSX</span>
                            </button>
                          </div>
                        </div>

                        <div className="overflow-x-auto rounded-xl border-[1.5px] border-[#2F3E4E] bg-white max-h-[340px]">
                          <table className="w-full text-left border-collapse text-xs">
                            <tbody>
                              {editableTable.map((row, rIdx) => (
                                <tr
                                  key={rIdx}
                                  className={rIdx === 0 ? 'bg-[#FEF2C8] font-bold' : 'border-t border-[#2F3E4E]/15'}
                                >
                                  <td className="px-2 py-1.5 font-mono text-[10px] text-[#64748B] border-r border-[#2F3E4E]/15 w-8 text-center">
                                    {rIdx + 1}
                                  </td>
                                  {row.map((cell, cIdx) => (
                                    <td
                                      key={cIdx}
                                      className="p-1 border-r border-[#2F3E4E]/15 min-w-[105px]"
                                    >
                                      <input
                                        type="text"
                                        value={cell}
                                        onChange={(e) => {
                                          const nextVal = e.target.value;
                                          setEditableTable((prev) =>
                                            prev.map((r, ri) =>
                                              ri === rIdx
                                                ? r.map((c, ci) => (ci === cIdx ? nextVal : c))
                                                : r
                                            )
                                          );
                                        }}
                                        className="w-full px-1.5 py-1 bg-transparent text-xs text-[#2F3E4E] focus:bg-[#FFFDF5] focus:outline-none focus:ring-1 focus:ring-[#2F3E4E] rounded"
                                      />
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Bottom Action & Multi-Format Export Strip */}
                <div className="pt-3 border-t border-[#2F3E4E]/15 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyText(activeText)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-xl bg-[#2F3E4E] hover:bg-[#1E293B] text-[#FFFDF5] border-[1.5px] border-[#2F3E4E] text-xs font-bold cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Copy Text</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportXlsx}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl bg-[#F9C80E] hover:bg-[#FFE1B3] text-[#2F3E4E] border-[1.5px] border-[#2F3E4E] shadow-[0_2px_0_#2F3E4E] text-xs font-display font-extrabold cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Excel .XLSX</span>
                  </button>

                  {[
                    { label: '.CSV', fn: handleExportCsv },
                    { label: '.TXT', fn: handleExportTxt },
                    { label: '.MD', fn: handleExportMd },
                    { label: '.JSON', fn: handleExportJson },
                  ].map((ex) => (
                    <button
                      key={ex.label}
                      type="button"
                      onClick={ex.fn}
                      className="inline-flex items-center gap-1 px-3 py-2 min-h-[40px] rounded-xl bg-white hover:bg-[#FEF2C8] text-[#2F3E4E] border-[1.5px] border-[#2F3E4E] text-xs font-bold cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{ex.label}</span>
                    </button>
                  ))}

                  {completedFilesCount > 1 && (
                    <button
                      type="button"
                      onClick={handleExportBatchExcel}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl bg-[#CEE5DC] hover:bg-[#FFE1B3] text-[#2F3E4E] border-[1.5px] border-[#2F3E4E] text-xs font-bold cursor-pointer ml-auto"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Export All {completedFilesCount} Files (.XLSX)</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Floating Feedback Toast */}
      {toastMsg && (
        <div
          role="status"
          className="fixed left-1/2 -translate-x-1/2 bottom-6 z-50 px-4 py-2.5 rounded-xl bg-[#2F3E4E] text-[#F9C80E] border-[1.5px] border-[#F9C80E] shadow-[0_4px_0_#1E293B] font-display font-bold text-xs flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
};

function WordFixRow({
  original,
  onApply,
}: {
  original: string;
  onApply: (wrong: string, corrected: string) => void;
}) {
  const [val, setVal] = useState(original);
  return (
    <div className="flex items-center gap-1 bg-white border border-[#2F3E4E]/30 rounded-lg p-1">
      <input
        type="text"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="flex-1 min-w-0 px-1.5 py-0.5 font-mono text-xs text-[#2F3E4E] focus:outline-none"
      />
      <button
        type="button"
        onClick={() => onApply(original, val)}
        title="Apply replacement across text"
        className="p-1 rounded bg-[#CEE5DC] hover:bg-[#F9C80E] text-[#2F3E4E] border border-[#2F3E4E]/30 cursor-pointer shrink-0"
      >
        <Check className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
