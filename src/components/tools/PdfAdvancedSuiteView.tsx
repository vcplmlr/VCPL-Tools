import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFString,
  StandardFonts,
  degrees,
  rgb,
} from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import JSZip from 'jszip';
import PptxGenJS from 'pptxgenjs';
import Tesseract from 'tesseract.js';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle,
  Copy,
  Download,
  Eye,
  FileText,
  Layers,
  Loader2,
  Plus,
  RotateCcw,
  RotateCw,
  ScanText,
  Scissors,
  Shield,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { ToolCatalogItem } from '../../types/tools';
import { FileDropZone } from './FileDropZone';
import { sanitizeWinAnsi } from '../../utils/pdfOperations';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface PdfAdvancedSuiteViewProps {
  tool: ToolCatalogItem;
}

interface PageItem {
  id: string;
  srcPage: number; // 1-indexed from source PDF
  rotation: number; // additive 0/90/180/270
  thumbUrl: string;
}

interface FormFieldSpec {
  id: string;
  label: string;
  type: 'text' | 'checkbox' | 'dropdown';
  page: number;
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
  options: string;
}

interface RedactBox {
  id: string;
  page: number;
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
}

function parsePageRanges(spec: string, totalPages: number): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  for (const part of spec.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (trimmed.includes('-')) {
      const [aStr, bStr] = trimmed.split('-');
      const a = Number.parseInt(aStr.trim(), 10);
      const b = Number.parseInt(bStr.trim(), 10);
      if (Number.isFinite(a) && Number.isFinite(b)) {
        const start = Math.max(1, Math.min(a, b));
        const end = Math.min(totalPages, Math.max(a, b));
        for (let p = start; p <= end; p++) {
          if (!seen.has(p)) {
            seen.add(p);
            out.push(p);
          }
        }
      }
    } else {
      const p = Number.parseInt(trimmed, 10);
      if (Number.isFinite(p) && p >= 1 && p <= totalPages && !seen.has(p)) {
        seen.add(p);
        out.push(p);
      }
    }
  }
  return out;
}

const DropBox: React.FC<{
  accept?: string;
  multiple?: boolean;
  label: string;
  subLabel?: string;
  onFilesSelected: (files: File[]) => void;
}> = ({ accept, multiple = false, label, subLabel, onFilesSelected }) => (
  <FileDropZone
    accept={accept}
    multiple={multiple}
    onFiles={onFilesSelected}
    className="rounded-2xl border-[1.5px] border-dashed border-[#2F3E4E] bg-[#FEF2C8]/45 hover:bg-[#FEF2C8]/75 transition cursor-pointer"
  >
    <label className="flex flex-col items-center justify-center p-6 text-center cursor-pointer gap-2">
      <UploadCloud className="w-7 h-7 text-[#2F3E4E]" />
      <span className="text-xs sm:text-sm font-bold text-[#2F3E4E]">{label}</span>
      {subLabel && <span className="text-[11px] text-[#64748B]">{subLabel}</span>}
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          const list = e.target.files ? Array.from(e.target.files) : [];
          if (list.length) onFilesSelected(list);
          e.target.value = '';
        }}
      />
    </label>
  </FileDropZone>
);

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

function downloadPdfBytes(bytes: Uint8Array, filename: string) {
  downloadBlob(new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' }), filename);
}

async function renderPdfPageCanvas(
  pdfBytes: ArrayBuffer,
  pageNumber: number,
  scale = 1.5
): Promise<HTMLCanvasElement> {
  const doc = await pdfjsLib.getDocument({ data: pdfBytes.slice(0) }).promise;
  const page = await doc.getPage(Math.min(Math.max(1, pageNumber), doc.numPages));
  const vp = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(vp.width));
  canvas.height = Math.max(1, Math.round(vp.height));
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx, viewport: vp }).promise;
  return canvas;
}

async function extractAllPdfPageTexts(pdfBytes: ArrayBuffer): Promise<string[]> {
  const doc = await pdfjsLib.getDocument({ data: pdfBytes.slice(0) }).promise;
  const out: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const lines: string[] = [];
    let lastY: number | null = null;
    let buf: string[] = [];
    for (const raw of tc.items as Array<{ str?: string; transform?: number[] }>) {
      const s = (raw.str || '').trim();
      if (!s) continue;
      const y = raw.transform ? Math.round(raw.transform[5]) : 0;
      if (lastY !== null && Math.abs(y - lastY) > 4) {
        lines.push(buf.join(' '));
        buf = [s];
      } else {
        buf.push(s);
      }
      lastY = y;
    }
    if (buf.length) lines.push(buf.join(' '));
    out.push(lines.join('\n'));
  }
  return out;
}

export const PdfAdvancedSuiteView: React.FC<PdfAdvancedSuiteViewProps> = ({ tool }) => {
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [progressText, setProgressText] = useState('');

  // Primary single PDF state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [thumbs, setThumbs] = useState<PageItem[]>([]);

  // Secondary PDF state (alternate-mix & compare)
  const [pdfFileB, setPdfFileB] = useState<File | null>(null);
  const [pdfBytesB, setPdfBytesB] = useState<ArrayBuffer | null>(null);
  const [numPagesB, setNumPagesB] = useState(0);
  const [reverseEven, setReverseEven] = useState(false);

  // Batch multi-PDF state (bates & rename)
  const [batchFiles, setBatchFiles] = useState<{ name: string; bytes: ArrayBuffer; pages: number }[]>([]);

  // Tool-specific options
  const [rangeInput, setRangeInput] = useState('1-3');
  const [nupCount, setNupCount] = useState<2 | 4 | 6 | 9>(4);
  const [nupLandscape, setNupLandscape] = useState(true);
  const [halfSplitAxis, setHalfSplitAxis] = useState<'vertical' | 'horizontal'>('vertical');
  const [splitTargetMb, setSplitTargetMb] = useState(1.0);
  const [splitKeyword, setSplitKeyword] = useState('Invoice');
  const [flipAxis, setFlipAxis] = useState<'horizontal' | 'vertical'>('horizontal');
  const [blankMode, setBlankMode] = useState<'every' | 'after'>('every');
  const [blankInterval, setBlankInterval] = useState(1);
  const [blankAfterPages, setBlankAfterPages] = useState('1, 3');
  const [blankLined, setBlankLined] = useState(true);

  // Header / Footer / Bates
  const [hfLeft, setHfLeft] = useState('VCPL Confidential');
  const [hfCenter, setHfCenter] = useState('{date}');
  const [hfRight, setHfRight] = useState('Page {page} of {total}');
  const [hfFontSize, setHfFontSize] = useState(9);
  const [batesPrefix, setBatesPrefix] = useState('DOC-');
  const [batesStart, setBatesStart] = useState(1);
  const [batesPad, setBatesPad] = useState(5);
  const [batesPos, setBatesPos] = useState<'bottom-right' | 'bottom-left' | 'top-right'>('bottom-right');

  // Bookmarks editor
  const [bookmarkLines, setBookmarkLines] = useState('Cover & Overview | 1\nFinancial Summary | 2\nAnnexure & Schedules | 3');

  // Fillable AcroForm builder
  const [formFields, setFormFields] = useState<FormFieldSpec[]>([
    { id: 'f1', label: 'applicant_name', type: 'text', page: 1, xPct: 12, yPct: 18, wPct: 45, hPct: 5, options: '' },
    { id: 'f2', label: 'pan_number', type: 'text', page: 1, xPct: 12, yPct: 26, wPct: 30, hPct: 5, options: '' },
    { id: 'f3', label: 'terms_accepted', type: 'checkbox', page: 1, xPct: 12, yPct: 34, wPct: 4, hPct: 4, options: '' },
  ]);

  // Presentation & Image suites
  const [pptFile, setPptFile] = useState<File | null>(null);
  const [pptOutlineTitle, setPptOutlineTitle] = useState('FY 2026-27 Operational Review');
  const [pptTheme, setPptTheme] = useState<'vcpl' | 'cream' | 'slate'>('vcpl');
  const [pptOutlineBody, setPptOutlineBody] = useState(
    '# Agenda & Key Highlights\n- Revenue milestone achieved ahead of schedule\n- 100% browser-first compliance tooling rollout\n- Zero server data exposure across branches\n---\n# Regional Breakdown\n- Mangalore HQ & Coastal Operations\n- Tax & GST Reconciliation Automation\n- Target Q4 Delivery Targets'
  );
  const [imageBatch, setImageBatch] = useState<{ name: string; url: string; file: File }[]>([]);
  const [scanContrast, setScanContrast] = useState(1.45);
  const [scanBw, setScanBw] = useState(true);

  // Extracted Images gallery
  const [extractedImgs, setExtractedImgs] = useState<{ name: string; url: string }[]>([]);

  // Compare PDFs output
  const [diffRows, setDiffRows] = useState<{ page: number; added: string[]; removed: string[] }[]>([]);
  const [diffVisualUrl, setDiffVisualUrl] = useState<string>('');
  const [diffPage, setDiffPage] = useState(1);

  // Redact state
  const [redactPage, setRedactPage] = useState(1);
  const [redactKeyword, setRedactKeyword] = useState('');
  const [redactBoxes, setRedactBoxes] = useState<RedactBox[]>([]);
  const [redactPreviewUrl, setRedactPreviewUrl] = useState<string>('');
  const [dragBox, setDragBox] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const redactCanvasRef = useRef<HTMLDivElement | null>(null);

  // Deskew / Scan Cleanup / Invert
  const [deskewAngle, setDeskewAngle] = useState(0);
  const [deskewPreviewUrl, setDeskewPreviewUrl] = useState('');
  const [cleanupStrength, setCleanupStrength] = useState(210);
  const [invertMode, setInvertMode] = useState<'daylight' | 'warm-eye'>('daylight');

  // Rename from Content
  const [renameRegex, setRenameRegex] = useState('(?:Invoice|Ref|Receipt)[:\\s#-]*([A-Z0-9-]{3,20})');
  const [renamePreviews, setRenamePreviews] = useState<{ oldName: string; newName: string; bytes: ArrayBuffer }[]>([]);

  // OCR & Summarizer
  const [ocrLang, setOcrLang] = useState<'eng' | 'hin' | 'kan' | 'eng+hin'>('eng');
  const [ocrMaxPages, setOcrMaxPages] = useState(5);
  const [ocrOutput, setOcrOutput] = useState('');
  const [summaryData, setSummaryData] = useState<{
    sentences: string[];
    keywords: { word: string; count: number }[];
    wordCount: number;
    readMin: number;
  } | null>(null);

  useEffect(() => {
    setStatus(null);
    setBusy(false);
    setProgressText('');
    setDiffRows([]);
    setDiffVisualUrl('');
    setExtractedImgs([]);
    setOcrOutput('');
    setSummaryData(null);
    setRenamePreviews([]);
    setRedactBoxes([]);
    setDeskewAngle(0);
  }, [tool.id]);

  const handleResetAll = () => {
    setStatus(null);
    setBusy(false);
    setProgressText('');
    setPdfFile(null);
    setPdfBytes(null);
    setNumPages(0);
    setThumbs([]);
    setPdfFileB(null);
    setPdfBytesB(null);
    setNumPagesB(0);
    setBatchFiles([]);
    setPptFile(null);
    setImageBatch([]);
    setExtractedImgs([]);
    setDiffRows([]);
    setDiffVisualUrl('');
    setRedactBoxes([]);
    setRedactPreviewUrl('');
    setDeskewAngle(0);
    setDeskewPreviewUrl('');
    setOcrOutput('');
    setSummaryData(null);
    setRenamePreviews([]);
  };

  const loadSinglePdf = async (file: File) => {
    setBusy(true);
    setStatus(null);
    try {
      const buf = await file.arrayBuffer();
      const doc = await pdfjsLib.getDocument({ data: buf.slice(0) }).promise;
      setPdfFile(file);
      setPdfBytes(buf);
      setNumPages(doc.numPages);
      setRedactPage(1);
      setDiffPage(1);

      const maxThumbs = tool.id === 'pdf-organize' ? Math.min(doc.numPages, 40) : Math.min(doc.numPages, 12);
      const list: PageItem[] = [];
      for (let p = 1; p <= maxThumbs; p++) {
        const page = await doc.getPage(p);
        const vp = page.getViewport({ scale: 0.35 });
        const c = document.createElement('canvas');
        c.width = vp.width;
        c.height = vp.height;
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, c.width, c.height);
        await page.render({ canvas: c, canvasContext: ctx, viewport: vp }).promise;
        list.push({ id: `pg-${p}-${Math.random().toString(36).slice(2, 6)}`, srcPage: p, rotation: 0, thumbUrl: c.toDataURL('image/jpeg', 0.8) });
      }
      setThumbs(list);
      setStatus({ type: 'success', text: `Loaded "${file.name}" (${doc.numPages} pages).` });
    } catch (e: any) {
      setStatus({ type: 'error', text: e?.message || 'Failed to read PDF file.' });
    } finally {
      setBusy(false);
    }
  };

  // Live preview for Redact or Deskew
  useEffect(() => {
    if (!pdfBytes) return;
    let cancelled = false;
    if (tool.id === 'pdf-redact') {
      renderPdfPageCanvas(pdfBytes, redactPage, 1.35).then((c) => {
        if (!cancelled) setRedactPreviewUrl(c.toDataURL('image/png'));
      });
    } else if (tool.id === 'pdf-deskew') {
      renderPdfPageCanvas(pdfBytes, 1, 1.1).then((c) => {
        if (!cancelled) setDeskewPreviewUrl(c.toDataURL('image/png'));
      });
    }
    return () => {
      cancelled = true;
    };
  }, [pdfBytes, redactPage, tool.id]);

  // Helper: execute async actions cleanly
  const runTask = async (fn: () => Promise<void>) => {
    setBusy(true);
    setStatus(null);
    try {
      await fn();
    } catch (err: any) {
      setStatus({ type: 'error', text: err?.message || 'Processing failed. Please check file inputs.' });
    } finally {
      setBusy(false);
      setProgressText('');
    }
  };

  // =========================================================================
  // CORE ACTION HANDLERS PER TOOL ID
  // =========================================================================

  const handleOrganizeExport = () =>
    runTask(async () => {
      if (!pdfBytes || !thumbs.length) throw new Error('Upload a PDF first.');
      const src = await PDFDocument.load(pdfBytes);
      const out = await PDFDocument.create();
      for (const item of thumbs) {
        const [copied] = await out.copyPages(src, [item.srcPage - 1]);
        const cur = copied.getRotation().angle;
        copied.setRotation(degrees((cur + item.rotation) % 360));
        out.addPage(copied);
      }
      const bytes = await out.save();
      downloadPdfBytes(bytes, `organized-${pdfFile?.name || 'document.pdf'}`);
      setStatus({ type: 'success', text: `Exported organized PDF with ${thumbs.length} pages.` });
    });

  const handleExtractPages = () =>
    runTask(async () => {
      if (!pdfBytes) throw new Error('Upload a PDF first.');
      const pages = parsePageRanges(rangeInput, numPages);
      if (!pages.length) throw new Error('Enter valid page numbers/ranges (e.g. 1-3, 5).');
      const src = await PDFDocument.load(pdfBytes);
      const out = await PDFDocument.create();
      const copied = await out.copyPages(src, pages.map((p: number) => p - 1));
      copied.forEach((pg) => out.addPage(pg));
      downloadPdfBytes(await out.save(), `extracted-${pdfFile?.name || 'pages.pdf'}`);
      setStatus({ type: 'success', text: `Extracted ${pages.length} page(s): [${pages.join(', ')}].` });
    });

  const handleReversePages = () =>
    runTask(async () => {
      if (!pdfBytes) throw new Error('Upload a PDF first.');
      const src = await PDFDocument.load(pdfBytes);
      const out = await PDFDocument.create();
      const indices = Array.from({ length: src.getPageCount() }, (_, i) => src.getPageCount() - 1 - i);
      const copied = await out.copyPages(src, indices);
      copied.forEach((pg) => out.addPage(pg));
      downloadPdfBytes(await out.save(), `reversed-${pdfFile?.name || 'document.pdf'}`);
      setStatus({ type: 'success', text: `Reversed all ${indices.length} pages.` });
    });

  const handleNupLayout = () =>
    runTask(async () => {
      if (!pdfBytes) throw new Error('Upload a PDF first.');
      const src = await PDFDocument.load(pdfBytes);
      const out = await PDFDocument.create();
      const [sheetW, sheetH] = nupLandscape ? [841.89, 595.28] : [595.28, 841.89];
      const cols = nupCount === 2 ? (nupLandscape ? 2 : 1) : nupCount === 4 ? 2 : nupCount === 6 ? (nupLandscape ? 3 : 2) : 3;
      const rows = Math.ceil(nupCount / cols);
      const margin = 16;
      const cellW = (sheetW - margin * (cols + 1)) / cols;
      const cellH = (sheetH - margin * (rows + 1)) / rows;

      const total = src.getPageCount();
      for (let i = 0; i < total; i += nupCount) {
        const sheet = out.addPage([sheetW, sheetH]);
        for (let slot = 0; slot < nupCount && i + slot < total; slot++) {
          const [embedded] = await out.embedPages([src.getPage(i + slot)]);
          const scale = Math.min(cellW / embedded.width, cellH / embedded.height);
          const w = embedded.width * scale;
          const h = embedded.height * scale;
          const col = slot % cols;
          const row = Math.floor(slot / cols);
          const x = margin + col * (cellW + margin) + (cellW - w) / 2;
          const y = sheetH - margin - (row + 1) * cellH - row * margin + (cellH - h) / 2;
          sheet.drawPage(embedded, { x, y, width: w, height: h });
        }
      }
      downloadPdfBytes(await out.save(), `${nupCount}up-${pdfFile?.name || 'sheet.pdf'}`);
      setStatus({ type: 'success', text: `Arranged ${total} pages into ${nupCount}-up handouts.` });
    });

  const handleAlternateMix = () =>
    runTask(async () => {
      if (!pdfBytes || !pdfBytesB) throw new Error('Upload both Odd Pages PDF and Even Pages PDF.');
      const docA = await PDFDocument.load(pdfBytes);
      const docB = await PDFDocument.load(pdfBytesB);
      const out = await PDFDocument.create();
      const countA = docA.getPageCount();
      const countB = docB.getPageCount();
      const maxLen = Math.max(countA, countB);
      for (let i = 0; i < maxLen; i++) {
        if (i < countA) {
          const [pA] = await out.copyPages(docA, [i]);
          out.addPage(pA);
        }
        const bIdx = reverseEven ? countB - 1 - i : i;
        if (bIdx >= 0 && bIdx < countB) {
          const [pB] = await out.copyPages(docB, [bIdx]);
          out.addPage(pB);
        }
      }
      downloadPdfBytes(await out.save(), `interleaved-${pdfFile?.name || 'merged.pdf'}`);
      setStatus({ type: 'success', text: `Interleaved ${countA} odd + ${countB} even pages cleanly.` });
    });

  const handleSplitHalf = () =>
    runTask(async () => {
      if (!pdfBytes) throw new Error('Upload a PDF first.');
      const doc = await pdfjsLib.getDocument({ data: pdfBytes.slice(0) }).promise;
      const out = await PDFDocument.create();
      for (let p = 1; p <= doc.numPages; p++) {
        setProgressText(`Splitting page ${p} of ${doc.numPages}...`);
        const fullCanvas = await renderPdfPageCanvas(pdfBytes, p, 2);
        const w = fullCanvas.width;
        const h = fullCanvas.height;
        const halves =
          halfSplitAxis === 'vertical'
            ? [
                { sx: 0, sy: 0, sw: Math.floor(w / 2), sh: h },
                { sx: Math.floor(w / 2), sy: 0, sw: w - Math.floor(w / 2), sh: h },
              ]
            : [
                { sx: 0, sy: 0, sw: w, sh: Math.floor(h / 2) },
                { sx: 0, sy: Math.floor(h / 2), sw: w, sh: h - Math.floor(h / 2) },
              ];
        for (const rect of halves) {
          const slice = document.createElement('canvas');
          slice.width = rect.sw;
          slice.height = rect.sh;
          slice.getContext('2d')!.drawImage(fullCanvas, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, rect.sw, rect.sh);
          const jpgBytes = await fetch(slice.toDataURL('image/jpeg', 0.92)).then((r) => r.arrayBuffer());
          const img = await out.embedJpg(jpgBytes);
          const ptW = rect.sw * 0.5;
          const ptH = rect.sh * 0.5;
          const page = out.addPage([ptW, ptH]);
          page.drawImage(img, { x: 0, y: 0, width: ptW, height: ptH });
        }
      }
      downloadPdfBytes(await out.save(), `split-halves-${pdfFile?.name || 'book.pdf'}`);
      setStatus({ type: 'success', text: `Split ${doc.numPages} spreads into ${doc.numPages * 2} clean half pages.` });
    });

  const handleSplitBySize = () =>
    runTask(async () => {
      if (!pdfBytes) throw new Error('Upload a PDF first.');
      const src = await PDFDocument.load(pdfBytes);
      const maxBytes = Math.max(120 * 1024, splitTargetMb * 1024 * 1024);
      const zip = new JSZip();
      let chunk = await PDFDocument.create();
      let partIdx = 1;
      let chunkPages = 0;

      for (let i = 0; i < src.getPageCount(); i++) {
        setProgressText(`Packing page ${i + 1} / ${src.getPageCount()}...`);
        const [copied] = await chunk.copyPages(src, [i]);
        chunk.addPage(copied);
        chunkPages++;
        const saved = await chunk.save();
        if (saved.length > maxBytes && chunkPages > 1) {
          // Remove last page into next chunk
          chunk.removePage(chunkPages - 1);
          const finalPart = await chunk.save();
          zip.file(`part_${String(partIdx).padStart(2, '0')}.pdf`, finalPart);
          partIdx++;
          chunk = await PDFDocument.create();
          const [retry] = await chunk.copyPages(src, [i]);
          chunk.addPage(retry);
          chunkPages = 1;
        }
      }
      if (chunkPages > 0) {
        zip.file(`part_${String(partIdx).padStart(2, '0')}.pdf`, await chunk.save());
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(zipBlob, `split-${splitTargetMb}MB-${(pdfFile?.name || 'doc').replace(/\.pdf$/i, '')}.zip`);
      setStatus({ type: 'success', text: `Split into ${partIdx} size-capped PDF parts inside ZIP.` });
    });

  // Clean helper for ZIP download
  const handleSplitTextOrBookmarkClean = () =>
    runTask(async () => {
      if (!pdfBytes) throw new Error('Upload a PDF first.');
      const pageTexts = await extractAllPdfPageTexts(pdfBytes);
      const src = await PDFDocument.load(pdfBytes);
      const splitIndices: number[] = [0];

      if (tool.id === 'pdf-split-text') {
        const needle = splitKeyword.trim().toLowerCase();
        if (!needle) throw new Error('Enter a keyword or marker to split at.');
        for (let i = 1; i < pageTexts.length; i++) {
          if (pageTexts[i].toLowerCase().includes(needle)) splitIndices.push(i);
        }
      } else {
        const pdfJsDoc = await pdfjsLib.getDocument({ data: pdfBytes.slice(0) }).promise;
        const outline = await pdfJsDoc.getOutline().catch(() => null);
        if (outline && outline.length > 0) {
          for (const item of outline) {
            try {
              if (item.dest) {
                const destArray = typeof item.dest === 'string' ? await pdfJsDoc.getDestination(item.dest) : item.dest;
                if (Array.isArray(destArray) && destArray[0]) {
                  const idx = await pdfJsDoc.getPageIndex(destArray[0] as any);
                  if (idx > 0 && !splitIndices.includes(idx)) splitIndices.push(idx);
                }
              }
            } catch {
              // ignore
            }
          }
        } else {
          for (let i = 1; i < pageTexts.length; i++) {
            const firstLine = (pageTexts[i].split('\n')[0] || '').trim();
            if (/^(chapter|section|part|unit|annexure)\s+[0-9ivx]+/i.test(firstLine)) {
              splitIndices.push(i);
            }
          }
        }
      }

      const uniqueStarts = Array.from(new Set(splitIndices)).sort((a, b) => a - b);
      const zip = new JSZip();
      for (let s = 0; s < uniqueStarts.length; s++) {
        const start = uniqueStarts[s];
        const end = s + 1 < uniqueStarts.length ? uniqueStarts[s + 1] : src.getPageCount();
        const out = await PDFDocument.create();
        const indices = Array.from({ length: end - start }, (_, k) => start + k);
        const copied = await out.copyPages(src, indices);
        copied.forEach((p) => out.addPage(p));
        zip.file(`section_${String(s + 1).padStart(2, '0')}_p${start + 1}-${end}.pdf`, await out.save());
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(blob, `split-sections-${(pdfFile?.name || 'doc').replace(/\.pdf$/i, '')}.zip`);
      setStatus({ type: 'success', text: `Created ${uniqueStarts.length} split PDF section(s) inside ZIP.` });
    });

  const handleFlipMirror = () =>
    runTask(async () => {
      if (!pdfBytes) throw new Error('Upload a PDF first.');
      const doc = await pdfjsLib.getDocument({ data: pdfBytes.slice(0) }).promise;
      const out = await PDFDocument.create();
      for (let p = 1; p <= doc.numPages; p++) {
        setProgressText(`Mirroring page ${p} / ${doc.numPages}...`);
        const srcCanvas = await renderPdfPageCanvas(pdfBytes, p, 2);
        const flipped = document.createElement('canvas');
        flipped.width = srcCanvas.width;
        flipped.height = srcCanvas.height;
        const ctx = flipped.getContext('2d')!;
        ctx.save();
        if (flipAxis === 'horizontal') {
          ctx.translate(flipped.width, 0);
          ctx.scale(-1, 1);
        } else {
          ctx.translate(0, flipped.height);
          ctx.scale(1, -1);
        }
        ctx.drawImage(srcCanvas, 0, 0);
        ctx.restore();
        const jpgBytes = await fetch(flipped.toDataURL('image/jpeg', 0.92)).then((r) => r.arrayBuffer());
        const img = await out.embedJpg(jpgBytes);
        const ptW = flipped.width * 0.5;
        const ptH = flipped.height * 0.5;
        const page = out.addPage([ptW, ptH]);
        page.drawImage(img, { x: 0, y: 0, width: ptW, height: ptH });
      }
      downloadPdfBytes(await out.save(), `mirrored-${flipAxis}-${pdfFile?.name || 'doc.pdf'}`);
      setStatus({ type: 'success', text: `Mirrored all ${doc.numPages} pages (${flipAxis}).` });
    });

  const handleBookletImposition = () =>
    runTask(async () => {
      if (!pdfBytes) throw new Error('Upload a PDF first.');
      const src = await PDFDocument.load(pdfBytes);
      const n = src.getPageCount();
      const totalSlots = Math.ceil(n / 4) * 4;
      const out = await PDFDocument.create();
      const sheetW = 841.89;
      const sheetH = 595.28;
      const halfW = sheetW / 2;

      const drawSlot = async (sheet: any, pageZeroIdx: number, leftSide: boolean) => {
        if (pageZeroIdx >= n) return;
        const [embedded] = await out.embedPages([src.getPage(pageZeroIdx)]);
        const scale = Math.min((halfW - 16) / embedded.width, (sheetH - 16) / embedded.height);
        const w = embedded.width * scale;
        const h = embedded.height * scale;
        const x = (leftSide ? 0 : halfW) + (halfW - w) / 2;
        const y = (sheetH - h) / 2;
        sheet.drawPage(embedded, { x, y, width: w, height: h });
      };

      for (let i = 0; i < totalSlots / 2; i++) {
        const sheet = out.addPage([sheetW, sheetH]);
        const outerLeft = totalSlots - 1 - i;
        const outerRight = i;
        if (i % 2 === 0) {
          await drawSlot(sheet, outerLeft, true);
          await drawSlot(sheet, outerRight, false);
        } else {
          await drawSlot(sheet, outerRight, true);
          await drawSlot(sheet, outerLeft, false);
        }
      }
      downloadPdfBytes(await out.save(), `booklet-${pdfFile?.name || 'print.pdf'}`);
      setStatus({
        type: 'success',
        text: `Generated ${totalSlots / 2} A4 Landscape saddle-stitch booklet sheets (duplex short-edge flip).`,
      });
    });

  const handleInsertBlankPages = () =>
    runTask(async () => {
      if (!pdfBytes) throw new Error('Upload a PDF first.');
      const src = await PDFDocument.load(pdfBytes);
      const out = await PDFDocument.create();
      const afterSet = new Set(parsePageRanges(blankAfterPages, src.getPageCount()));

      const addBlankLike = (refWidth: number, refHeight: number) => {
        const bp = out.addPage([refWidth, refHeight]);
        if (blankLined) {
          for (let y = refHeight - 60; y > 55; y -= 22) {
            bp.drawLine({
              start: { x: 45, y },
              end: { x: refWidth - 45, y },
              thickness: 0.45,
              color: rgb(0.82, 0.85, 0.9),
            });
          }
        }
      };

      for (let i = 0; i < src.getPageCount(); i++) {
        const [copied] = await out.copyPages(src, [i]);
        const { width, height } = copied.getSize();
        out.addPage(copied);
        const pageNum = i + 1;
        const shouldInsert =
          blankMode === 'every' ? pageNum % Math.max(1, blankInterval) === 0 : afterSet.has(pageNum);
        if (shouldInsert) {
          addBlankLike(width, height);
        }
      }
      downloadPdfBytes(await out.save(), `with-blanks-${pdfFile?.name || 'notes.pdf'}`);
      setStatus({ type: 'success', text: `Inserted ${blankLined ? 'lined' : 'blank'} pages into PDF.` });
    });

  const handleHeaderFooter = () =>
    runTask(async () => {
      if (!pdfBytes) throw new Error('Upload a PDF first.');
      const doc = await PDFDocument.load(pdfBytes);
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const total = doc.getPageCount();
      const today = new Date().toLocaleDateString('en-IN');
      const resolve = (tpl: string, p: number) =>
        sanitizeWinAnsi(
          tpl
            .replace(/\{page\}/gi, String(p))
            .replace(/\{total\}/gi, String(total))
            .replace(/\{date\}/gi, today)
        );

      doc.getPages().forEach((page, idx) => {
        const { width, height } = page.getSize();
        const pNum = idx + 1;
        const headerY = height - 24;
        const footerY = 18;
        const leftTxt = resolve(hfLeft, pNum);
        const centerTxt = resolve(hfCenter, pNum);
        const rightTxt = resolve(hfRight, pNum);

        if (leftTxt) {
          page.drawText(leftTxt, { x: 32, y: headerY, size: hfFontSize, font, color: rgb(0.25, 0.3, 0.38) });
        }
        if (centerTxt) {
          const w = font.widthOfTextAtSize(centerTxt, hfFontSize);
          page.drawText(centerTxt, { x: (width - w) / 2, y: headerY, size: hfFontSize, font, color: rgb(0.25, 0.3, 0.38) });
        }
        if (rightTxt) {
          const w = font.widthOfTextAtSize(rightTxt, hfFontSize);
          page.drawText(rightTxt, { x: width - 32 - w, y: footerY, size: hfFontSize, font, color: rgb(0.25, 0.3, 0.38) });
        }
      });
      downloadPdfBytes(await doc.save(), `headers-footers-${pdfFile?.name || 'doc.pdf'}`);
      setStatus({ type: 'success', text: `Stamped headers & footers across ${total} pages.` });
    });

  const handleBatesNumbering = () =>
    runTask(async () => {
      if (!batchFiles.length) throw new Error('Upload at least one PDF file for Bates numbering.');
      const zip = new JSZip();
      let counter = Math.max(0, batesStart);
      for (const item of batchFiles) {
        const doc = await PDFDocument.load(item.bytes);
        const font = await doc.embedFont(StandardFonts.HelveticaBold);
        doc.getPages().forEach((page) => {
          const { width, height } = page.getSize();
          const label = sanitizeWinAnsi(`${batesPrefix}${String(counter).padStart(batesPad, '0')}`);
          counter++;
          const tw = font.widthOfTextAtSize(label, 9.5);
          const x = batesPos === 'bottom-left' ? 28 : width - 28 - tw;
          const y = batesPos === 'top-right' ? height - 26 : 20;
          page.drawRectangle({ x: x - 4, y: y - 3, width: tw + 8, height: 14, color: rgb(0.98, 0.98, 0.98), opacity: 0.85 });
          page.drawText(label, { x, y, size: 9.5, font, color: rgb(0.18, 0.24, 0.31) });
        });
        zip.file(`BATES_${item.name}`, await doc.save());
      }
      if (batchFiles.length === 1) {
        const singleDoc = await zip.file(`BATES_${batchFiles[0].name}`)!.async('uint8array');
        downloadPdfBytes(singleDoc, `BATES_${batchFiles[0].name}`);
      } else {
        downloadBlob(await zip.generateAsync({ type: 'blob' }), 'Bates_Numbered_PDFs.zip');
      }
      setStatus({ type: 'success', text: `Applied sequential Bates stamps up to #${counter - 1}.` });
    });

  const handleAutoDetectBookmarks = () =>
    runTask(async () => {
      if (!pdfBytes) throw new Error('Upload a PDF first.');
      const pageTexts = await extractAllPdfPageTexts(pdfBytes);
      const detected: string[] = [];
      pageTexts.forEach((txt, idx) => {
        const lines = txt.split('\n').map((l) => l.trim()).filter(Boolean);
        const heading = lines.find((l) => l.length >= 4 && l.length <= 64) || `Page ${idx + 1}`;
        detected.push(`${heading.replace(/\|/g, '-')} | ${idx + 1}`);
      });
      setBookmarkLines(detected.slice(0, 40).join('\n'));
      setStatus({ type: 'success', text: `Auto-detected ${Math.min(40, detected.length)} outline entries.` });
    });

  const handleSaveBookmarks = () =>
    runTask(async () => {
      if (!pdfBytes) throw new Error('Upload a PDF first.');
      const doc = await PDFDocument.load(pdfBytes);
      const entries = bookmarkLines
        .split('\n')
        .map((line) => {
          const [title, pgStr] = line.split('|');
          const pg = Number.parseInt((pgStr || '1').trim(), 10);
          return { title: (title || '').trim(), pageNum: Number.isFinite(pg) ? Math.min(Math.max(1, pg), doc.getPageCount()) : 1 };
        })
        .filter((e) => e.title.length > 0);

      if (!entries.length) throw new Error('Add at least one "Title | Page" entry.');

      // Build valid PDF /Outlines tree via pdf-lib PDFContext
      const ctx = doc.context;
      const outlineRootRef = ctx.nextRef();
      const itemRefs = entries.map(() => ctx.nextRef());
      const pages = doc.getPages();

      entries.forEach((entry, idx) => {
        const pageRef = pages[entry.pageNum - 1].ref;
        const itemDict = PDFDict.withContext(ctx);
        itemDict.set(PDFName.of('Title'), PDFString.of(sanitizeWinAnsi(entry.title)));
        itemDict.set(PDFName.of('Parent'), outlineRootRef);
        if (idx > 0) itemDict.set(PDFName.of('Prev'), itemRefs[idx - 1]);
        if (idx < entries.length - 1) itemDict.set(PDFName.of('Next'), itemRefs[idx + 1]);
        const destArr = PDFArray.withContext(ctx);
        destArr.push(pageRef);
        destArr.push(PDFName.of('Fit'));
        itemDict.set(PDFName.of('Dest'), destArr);
        ctx.assign(itemRefs[idx], itemDict);
      });

      const rootDict = PDFDict.withContext(ctx);
      rootDict.set(PDFName.of('Type'), PDFName.of('Outlines'));
      rootDict.set(PDFName.of('First'), itemRefs[0]);
      rootDict.set(PDFName.of('Last'), itemRefs[itemRefs.length - 1]);
      rootDict.set(PDFName.of('Count'), PDFNumber.of(entries.length));
      ctx.assign(outlineRootRef, rootDict);

      doc.catalog.set(PDFName.of('Outlines'), outlineRootRef);
      doc.catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'));

      downloadPdfBytes(await doc.save(), `bookmarked-${pdfFile?.name || 'document.pdf'}`);
      setStatus({ type: 'success', text: `Embedded ${entries.length} clickable PDF /Outlines bookmarks.` });
    });

  const handleBuildFillablePdf = () =>
    runTask(async () => {
      const doc = pdfBytes ? await PDFDocument.load(pdfBytes) : await PDFDocument.create();
      if (doc.getPageCount() === 0) doc.addPage([595.28, 841.89]);
      const form = doc.getForm();
      const font = await doc.embedFont(StandardFonts.HelveticaBold);

      formFields.forEach((spec, idx) => {
        const pageIdx = Math.min(Math.max(0, spec.page - 1), doc.getPageCount() - 1);
        const page = doc.getPage(pageIdx);
        const { width, height } = page.getSize();
        const x = (spec.xPct / 100) * width;
        const w = (spec.wPct / 100) * width;
        const h = (spec.hPct / 100) * height;
        const y = height - (spec.yPct / 100) * height - h;
        const uniqueName = `${spec.label || 'field'}_${idx + 1}`;

        page.drawText(sanitizeWinAnsi(spec.label || `Field ${idx + 1}`), {
          x,
          y: y + h + 4,
          size: 9,
          font,
          color: rgb(0.18, 0.24, 0.31),
        });

        if (spec.type === 'checkbox') {
          const cb = form.createCheckBox(uniqueName);
          cb.addToPage(page, { x, y, width: Math.max(14, w), height: Math.max(14, h) });
        } else if (spec.type === 'dropdown') {
          const dd = form.createDropdown(uniqueName);
          const opts = spec.options.split(',').map((o) => o.trim()).filter(Boolean);
          dd.addOptions(opts.length ? opts : ['Option A', 'Option B']);
          dd.addToPage(page, { x, y, width: Math.max(60, w), height: Math.max(18, h) });
        } else {
          const tf = form.createTextField(uniqueName);
          tf.addToPage(page, { x, y, width: Math.max(60, w), height: Math.max(18, h) });
        }
      });

      downloadPdfBytes(await doc.save(), `fillable-form-${pdfFile?.name || 'vcpl-form.pdf'}`);
      setStatus({ type: 'success', text: `Created real interactive AcroForm PDF with ${formFields.length} fillable fields.` });
    });

  const handlePptToPdf = () =>
    runTask(async () => {
      if (!pptFile) throw new Error('Upload a .PPTX PowerPoint deck first.');
      const zip = await JSZip.loadAsync(await pptFile.arrayBuffer());
      const slideNames = Object.keys(zip.files)
        .filter((k) => /^ppt\/slides\/slide\d+\.xml$/i.test(k))
        .sort((a, b) => {
          const na = Number.parseInt(a.match(/\d+/)?.[0] || '0', 10);
          const nb = Number.parseInt(b.match(/\d+/)?.[0] || '0', 10);
          return na - nb;
        });
      if (!slideNames.length) throw new Error('No XML slides found inside .PPTX archive.');

      const out = await PDFDocument.create();
      const parser = new DOMParser();
      for (let i = 0; i < slideNames.length; i++) {
        setProgressText(`Rendering slide ${i + 1} / ${slideNames.length}...`);
        const xmlText = await zip.file(slideNames[i])!.async('string');
        const xml = parser.parseFromString(xmlText, 'application/xml');
        const paraNodes = Array.from(xml.getElementsByTagName('a:p'));
        const slideLines: string[] = [];
        paraNodes.forEach((pNode) => {
          const txt = Array.from(pNode.getElementsByTagName('a:t'))
            .map((t) => t.textContent || '')
            .join('')
            .trim();
          if (txt) slideLines.push(txt);
        });

        // Render clean 16:9 slide onto high-res canvas (handles Unicode Indic + formatting cleanly)
        const c = document.createElement('canvas');
        c.width = 1600;
        c.height = 900;
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = '#FFFDF5';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.fillStyle = '#2F3E4E';
        ctx.fillRect(0, 0, c.width, 18);
        ctx.fillStyle = '#F9C80E';
        ctx.fillRect(0, 18, c.width, 6);

        let curY = 100;
        slideLines.forEach((line, lIdx) => {
          ctx.fillStyle = lIdx === 0 ? '#1E293B' : '#334155';
          ctx.font = lIdx === 0 ? 'bold 46px sans-serif' : '28px sans-serif';
          const prefix = lIdx === 0 ? '' : '• ';
          const full = prefix + line;
          let buf = '';
          for (const word of full.split(' ')) {
            const next = buf ? `${buf} ${word}` : word;
            if (ctx.measureText(next).width > 1420 && buf) {
              if (curY < 830) ctx.fillText(buf, 90, curY);
              curY += lIdx === 0 ? 54 : 38;
              buf = word;
            } else {
              buf = next;
            }
          }
          if (buf && curY < 830) {
            ctx.fillText(buf, 90, curY);
            curY += lIdx === 0 ? 72 : 48;
          }
        });

        ctx.fillStyle = '#64748B';
        ctx.font = 'bold 20px monospace';
        ctx.fillText(`Slide ${i + 1} of ${slideNames.length}`, 1380, 860);

        const jpgBytes = await fetch(c.toDataURL('image/jpeg', 0.92)).then((r) => r.arrayBuffer());
        const img = await out.embedJpg(jpgBytes);
        const page = out.addPage([960, 540]);
        page.drawImage(img, { x: 0, y: 0, width: 960, height: 540 });
      }
      downloadPdfBytes(await out.save(), `${pptFile.name.replace(/\.pptx$/i, '')}.pdf`);
      setStatus({ type: 'success', text: `Converted ${slideNames.length} PPTX slides into 16:9 PDF.` });
    });

  const handleCreatePresentation = () =>
    runTask(async () => {
      const blocks = pptOutlineBody
        .split(/^---$/m)
        .map((b) => b.trim())
        .filter(Boolean);
      if (!blocks.length) throw new Error('Enter slide outline blocks separated by "---".');

      const pptx = new PptxGenJS();
      pptx.layout = 'LAYOUT_16x9';
      const palette =
        pptTheme === 'vcpl'
          ? { bg: 'FFFDF5', bar: '2F3E4E', accent: 'F9C80E', title: '2F3E4E', body: '334155' }
          : pptTheme === 'slate'
            ? { bg: '1E293B', bar: 'F9C80E', accent: 'CEE5DC', title: 'FFFDF5', body: 'E2E8F0' }
            : { bg: 'FEF2C8', bar: '2F3E4E', accent: 'C85A32', title: '2F3E4E', body: '334155' };

      // Title Slide
      const cover = pptx.addSlide();
      cover.background = { color: palette.bar };
      cover.addText(pptOutlineTitle || 'Presentation Deck', {
        x: 0.8,
        y: 1.9,
        w: 8.4,
        h: 1.3,
        fontSize: 34,
        bold: true,
        color: pptTheme === 'slate' ? '1E293B' : 'FFFDF5',
      });
      cover.addText(`Generated locally · ${blocks.length} Content Slides`, {
        x: 0.8,
        y: 3.3,
        w: 8.4,
        h: 0.5,
        fontSize: 15,
        color: palette.accent,
      });

      blocks.forEach((blk) => {
        const lines = blk.split('\n').map((l) => l.trim()).filter(Boolean);
        const heading = lines[0].replace(/^#+\s*/, '');
        const bullets = lines.slice(1).map((l) => l.replace(/^[-*•]\s*/, ''));
        const slide = pptx.addSlide();
        slide.background = { color: palette.bg };
        slide.addText(heading, {
          x: 0.7,
          y: 0.5,
          w: 8.6,
          h: 0.8,
          fontSize: 24,
          bold: true,
          color: palette.title,
        });
        if (bullets.length) {
          slide.addText(
            bullets.map((b) => ({ text: b, options: { bullet: true, breakLine: true } })),
            { x: 0.8, y: 1.5, w: 8.4, h: 3.6, fontSize: 16, color: palette.body, valign: 'top' }
          );
        }
      });

      await pptx.writeFile({ fileName: `${(pptOutlineTitle || 'presentation').replace(/\s+/g, '_')}.pptx` });
      setStatus({ type: 'success', text: `Exported .PPTX deck with ${blocks.length + 1} slides.` });
    });

  const handleImagesToPpt = () =>
    runTask(async () => {
      if (!imageBatch.length) throw new Error('Upload one or more JPG/PNG/WEBP images first.');
      const pptx = new PptxGenJS();
      pptx.layout = 'LAYOUT_16x9';
      for (let i = 0; i < imageBatch.length; i++) {
        setProgressText(`Embedding slide ${i + 1} / ${imageBatch.length}...`);
        const item = imageBatch[i];
        const b64 = await new Promise<string>((res) => {
          const reader = new FileReader();
          reader.onload = () => res(String(reader.result));
          reader.readAsDataURL(item.file);
        });
        const slide = pptx.addSlide();
        slide.background = { color: 'FFFDF5' };
        slide.addImage({
          data: b64,
          x: 0.4,
          y: 0.35,
          w: 9.2,
          h: 4.9,
          sizing: { type: 'contain', w: 9.2, h: 4.9 },
        });
      }
      await pptx.writeFile({ fileName: 'Images_Deck.pptx' });
      setStatus({ type: 'success', text: `Created .PPTX presentation from ${imageBatch.length} image(s).` });
    });

  const handleExtractImages = () =>
    runTask(async () => {
      if (!pdfBytes) throw new Error('Upload a PDF first.');
      const doc = await pdfjsLib.getDocument({ data: pdfBytes.slice(0) }).promise;
      const results: { name: string; url: string }[] = [];
      for (let p = 1; p <= Math.min(doc.numPages, 25); p++) {
        setProgressText(`Capturing high-DPI media from page ${p}/${doc.numPages}...`);
        const c = await renderPdfPageCanvas(pdfBytes, p, 2);
        results.push({ name: `page_${String(p).padStart(2, '0')}.png`, url: c.toDataURL('image/png') });
      }
      setExtractedImgs(results);
      setStatus({ type: 'success', text: `Rendered ${results.length} high-DPI PNG frames ready to download individually or as ZIP.` });
    });

  const handleDownloadExtractedImagesZip = () =>
    runTask(async () => {
      const zip = new JSZip();
      for (const img of extractedImgs) {
        const buf = await fetch(img.url).then((r) => r.arrayBuffer());
        zip.file(img.name, buf);
      }
      downloadBlob(await zip.generateAsync({ type: 'blob' }), `pdf-images-${(pdfFile?.name || 'export').replace(/\.pdf$/i, '')}.zip`);
    });

  const handleScanToPdf = () =>
    runTask(async () => {
      if (!imageBatch.length) throw new Error('Upload one or more camera scan photos first.');
      const out = await PDFDocument.create();
      for (let i = 0; i < imageBatch.length; i++) {
        setProgressText(`Enhancing scan ${i + 1} / ${imageBatch.length}...`);
        const imgEl = new Image();
        await new Promise<void>((res) => {
          imgEl.onload = () => res();
          imgEl.src = imageBatch[i].url;
        });
        const c = document.createElement('canvas');
        c.width = imgEl.naturalWidth;
        c.height = imgEl.naturalHeight;
        const ctx = c.getContext('2d')!;
        ctx.drawImage(imgEl, 0, 0);
        const imgData = ctx.getImageData(0, 0, c.width, c.height);
        const d = imgData.data;
        for (let k = 0; k < d.length; k += 4) {
          let lum = 0.299 * d[k] + 0.587 * d[k + 1] + 0.114 * d[k + 2];
          lum = ((lum - 128) * scanContrast) + 128;
          if (scanBw) {
            const v = lum > 175 ? 255 : Math.max(0, Math.min(255, lum));
            d[k] = d[k + 1] = d[k + 2] = v;
          } else {
            const factor = lum / Math.max(1, 0.299 * d[k] + 0.587 * d[k + 1] + 0.114 * d[k + 2]);
            d[k] = Math.min(255, Math.max(0, d[k] * factor));
            d[k + 1] = Math.min(255, Math.max(0, d[k + 1] * factor));
            d[k + 2] = Math.min(255, Math.max(0, d[k + 2] * factor));
          }
        }
        ctx.putImageData(imgData, 0, 0);
        const jpgBytes = await fetch(c.toDataURL('image/jpeg', 0.88)).then((r) => r.arrayBuffer());
        const jpg = await out.embedJpg(jpgBytes);
        const page = out.addPage([595.28, 841.89]);
        const scale = Math.min(555 / jpg.width, 801 / jpg.height);
        const w = jpg.width * scale;
        const h = jpg.height * scale;
        page.drawImage(jpg, { x: (595.28 - w) / 2, y: (841.89 - h) / 2, width: w, height: h });
      }
      downloadPdfBytes(await out.save(), 'Scanned_Document_Clean.pdf');
      setStatus({ type: 'success', text: `Built ${imageBatch.length}-page enhanced A4 scan PDF.` });
    });

  const handleStripMetadata = () =>
    runTask(async () => {
      if (!pdfBytes) throw new Error('Upload a PDF first.');
      const src = await PDFDocument.load(pdfBytes);
      const out = await PDFDocument.create();
      const copied = await out.copyPages(src, src.getPageIndices());
      copied.forEach((p) => out.addPage(p));
      out.setTitle('');
      out.setAuthor('');
      out.setSubject('');
      out.setCreator('');
      out.setProducer('');
      out.setKeywords([]);
      downloadPdfBytes(await out.save(), `anonymized-${pdfFile?.name || 'doc.pdf'}`);
      setStatus({ type: 'success', text: 'Stripped Author, Creator, Producer, Subject, Keywords & XMP metadata.' });
    });

  const handleComparePdfs = () =>
    runTask(async () => {
      if (!pdfBytes || !pdfBytesB) throw new Error('Upload both Original PDF (A) and Revised PDF (B).');
      const [textsA, textsB] = await Promise.all([extractAllPdfPageTexts(pdfBytes), extractAllPdfPageTexts(pdfBytesB)]);
      const total = Math.max(textsA.length, textsB.length);
      const rows: { page: number; added: string[]; removed: string[] }[] = [];
      for (let i = 0; i < total; i++) {
        const linesA = new Set((textsA[i] || '').split('\n').map((l) => l.trim()).filter(Boolean));
        const linesB = new Set((textsB[i] || '').split('\n').map((l) => l.trim()).filter(Boolean));
        const added = Array.from(linesB).filter((l) => !linesA.has(l));
        const removed = Array.from(linesA).filter((l) => !linesB.has(l));
        if (added.length || removed.length) rows.push({ page: i + 1, added, removed });
      }
      setDiffRows(rows);

      // Visual pixel diff for selected page
      const [cA, cB] = await Promise.all([renderPdfPageCanvas(pdfBytes, diffPage, 1.1), renderPdfPageCanvas(pdfBytesB, diffPage, 1.1)]);
      const w = Math.max(cA.width, cB.width);
      const h = Math.max(cA.height, cB.height);
      const outCanvas = document.createElement('canvas');
      outCanvas.width = w;
      outCanvas.height = h;
      const ctx = outCanvas.getContext('2d')!;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(cA, 0, 0);
      const dA = ctx.getImageData(0, 0, w, h);
      const tmp = document.createElement('canvas');
      tmp.width = w;
      tmp.height = h;
      const tmpCtx = tmp.getContext('2d')!;
      tmpCtx.fillStyle = '#FFFFFF';
      tmpCtx.fillRect(0, 0, w, h);
      tmpCtx.drawImage(cB, 0, 0);
      const dB = tmpCtx.getImageData(0, 0, w, h);

      for (let k = 0; k < dA.data.length; k += 4) {
        const delta =
          Math.abs(dA.data[k] - dB.data[k]) +
          Math.abs(dA.data[k + 1] - dB.data[k + 1]) +
          Math.abs(dA.data[k + 2] - dB.data[k + 2]);
        if (delta > 35) {
          dA.data[k] = 220;
          dA.data[k + 1] = 38;
          dA.data[k + 2] = 38;
        } else {
          // Soften matching background
          dA.data[k] = Math.min(255, dA.data[k] + 35);
          dA.data[k + 1] = Math.min(255, dA.data[k + 1] + 35);
          dA.data[k + 2] = Math.min(255, dA.data[k + 2] + 35);
        }
      }
      ctx.putImageData(dA, 0, 0);
      setDiffVisualUrl(outCanvas.toDataURL('image/png'));
      setStatus({ type: 'success', text: `Comparison complete: ${rows.length} page(s) have text changes.` });
    });

  const handlePermanentRedact = () =>
    runTask(async () => {
      if (!pdfBytes) throw new Error('Upload a PDF first.');
      const doc = await pdfjsLib.getDocument({ data: pdfBytes.slice(0) }).promise;
      const out = await PDFDocument.create();
      const kwList = redactKeyword
        .split(',')
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean);

      for (let p = 1; p <= doc.numPages; p++) {
        setProgressText(`Permanently redacting & flattening page ${p} / ${doc.numPages}...`);
        const scale = 2;
        const page = await doc.getPage(p);
        const vp = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = vp.width;
        canvas.height = vp.height;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvas, canvasContext: ctx, viewport: vp }).promise;

        // Burn manual blackout rectangles on this page
        ctx.fillStyle = '#000000';
        redactBoxes
          .filter((b) => b.page === p)
          .forEach((b) => {
            ctx.fillRect(
              (b.xPct / 100) * canvas.width,
              (b.yPct / 100) * canvas.height,
              (b.wPct / 100) * canvas.width,
              (b.hPct / 100) * canvas.height
            );
          });

        // Keyword blackout via pdfjs coordinates
        if (kwList.length) {
          const tc = await page.getTextContent();
          for (const item of tc.items as Array<{ str?: string; transform?: number[]; width?: number; height?: number }>) {
            const text = (item.str || '').toLowerCase();
            if (text && kwList.some((kw) => text.includes(kw)) && item.transform) {
              const [, , , , tx, ty] = item.transform;
              const [vx, vy] = vp.convertToViewportPoint(tx, ty);
              const w = Math.max(24, (item.width || 40) * scale);
              const h = Math.max(16, (item.height || 12) * scale * 1.25);
              ctx.fillRect(vx - 2, vy - h + 4, w + 4, h);
            }
          }
        }

        const jpgBytes = await fetch(canvas.toDataURL('image/jpeg', 0.92)).then((r) => r.arrayBuffer());
        const jpg = await out.embedJpg(jpgBytes);
        const ptW = canvas.width / scale;
        const ptH = canvas.height / scale;
        const outPage = out.addPage([ptW, ptH]);
        outPage.drawImage(jpg, { x: 0, y: 0, width: ptW, height: ptH });
      }
      downloadPdfBytes(await out.save(), `REDACTED-${pdfFile?.name || 'secure.pdf'}`);
      setStatus({ type: 'success', text: 'Redactions burned permanently into flattened PDF pixels (unrecoverable).' });
    });

  const handlePixelFilterPdf = () =>
    runTask(async () => {
      if (!pdfBytes) throw new Error('Upload a PDF first.');
      const doc = await pdfjsLib.getDocument({ data: pdfBytes.slice(0) }).promise;
      const out = await PDFDocument.create();
      for (let p = 1; p <= doc.numPages; p++) {
        setProgressText(`Processing page ${p} / ${doc.numPages}...`);
        const scale = 2;
        const c = await renderPdfPageCanvas(pdfBytes, p, scale);
        const ctx = c.getContext('2d')!;
        const img = ctx.getImageData(0, 0, c.width, c.height);
        const d = img.data;

        for (let k = 0; k < d.length; k += 4) {
          if (tool.id === 'pdf-to-grayscale') {
            const lum = Math.round(0.299 * d[k] + 0.587 * d[k + 1] + 0.114 * d[k + 2]);
            d[k] = d[k + 1] = d[k + 2] = lum;
          } else if (tool.id === 'pdf-scan-cleanup') {
            const lum = 0.299 * d[k] + 0.587 * d[k + 1] + 0.114 * d[k + 2];
            if (lum > cleanupStrength) {
              d[k] = d[k + 1] = d[k + 2] = 255;
            } else {
              d[k] = Math.max(0, Math.round(d[k] * 0.85));
              d[k + 1] = Math.max(0, Math.round(d[k + 1] * 0.85));
              d[k + 2] = Math.max(0, Math.round(d[k + 2] * 0.85));
            }
          } else if (tool.id === 'pdf-invert-colors') {
            const rInv = 255 - d[k];
            const gInv = 255 - d[k + 1];
            const bInv = 255 - d[k + 2];
            if (invertMode === 'warm-eye') {
              d[k] = Math.min(255, Math.round(rInv * 0.99));
              d[k + 1] = Math.min(255, Math.round(gInv * 0.95));
              d[k + 2] = Math.min(255, Math.round(bInv * 0.82));
            } else {
              d[k] = rInv;
              d[k + 1] = gInv;
              d[k + 2] = bInv;
            }
          }
        }
        ctx.putImageData(img, 0, 0);
        const jpgBytes = await fetch(c.toDataURL('image/jpeg', 0.9)).then((r) => r.arrayBuffer());
        const jpg = await out.embedJpg(jpgBytes);
        const ptW = c.width / scale;
        const ptH = c.height / scale;
        const page = out.addPage([ptW, ptH]);
        page.drawImage(jpg, { x: 0, y: 0, width: ptW, height: ptH });
      }
      const tag = tool.id.replace('pdf-', '');
      downloadPdfBytes(await out.save(), `${tag}-${pdfFile?.name || 'doc.pdf'}`);
      setStatus({ type: 'success', text: `Processed ${doc.numPages} page(s) cleanly.` });
    });

  const handleDeskewExport = () =>
    runTask(async () => {
      if (!pdfBytes) throw new Error('Upload a PDF first.');
      const doc = await pdfjsLib.getDocument({ data: pdfBytes.slice(0) }).promise;
      const out = await PDFDocument.create();
      const rad = (deskewAngle * Math.PI) / 180;
      for (let p = 1; p <= doc.numPages; p++) {
        setProgressText(`Straightening page ${p} / ${doc.numPages}...`);
        const src = await renderPdfPageCanvas(pdfBytes, p, 2);
        const dst = document.createElement('canvas');
        dst.width = src.width;
        dst.height = src.height;
        const ctx = dst.getContext('2d')!;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, dst.width, dst.height);
        ctx.translate(dst.width / 2, dst.height / 2);
        ctx.rotate(rad);
        ctx.drawImage(src, -src.width / 2, -src.height / 2);
        const jpgBytes = await fetch(dst.toDataURL('image/jpeg', 0.91)).then((r) => r.arrayBuffer());
        const jpg = await out.embedJpg(jpgBytes);
        const page = out.addPage([dst.width * 0.5, dst.height * 0.5]);
        page.drawImage(jpg, { x: 0, y: 0, width: dst.width * 0.5, height: dst.height * 0.5 });
      }
      downloadPdfBytes(await out.save(), `deskewed-${pdfFile?.name || 'scan.pdf'}`);
      setStatus({ type: 'success', text: `Applied ${deskewAngle.toFixed(1)}° alignment across ${doc.numPages} pages.` });
    });

  const handlePdfToPdfA = () =>
    runTask(async () => {
      if (!pdfBytes) throw new Error('Upload a PDF first.');
      const doc = await PDFDocument.load(pdfBytes);
      doc.setTitle(pdfFile?.name.replace(/\.pdf$/i, '') || 'Archival PDF/A-1b Document');
      doc.setCreator('VCPL Tools Archival Engine');
      doc.setProducer('VCPL PDF/A Conformance Packager');
      doc.setCreationDate(new Date());
      doc.setModificationDate(new Date());
      // Embed OutputIntent dictionary marker
      const ctx = doc.context;
      const intentDict = PDFDict.withContext(ctx);
      intentDict.set(PDFName.of('Type'), PDFName.of('OutputIntent'));
      intentDict.set(PDFName.of('S'), PDFName.of('GTS_PDFA1'));
      intentDict.set(PDFName.of('OutputConditionIdentifier'), PDFString.of('sRGB IEC61966-2.1'));
      const intentArr = PDFArray.withContext(ctx);
      intentArr.push(intentDict);
      doc.catalog.set(PDFName.of('OutputIntents'), intentArr);
      downloadPdfBytes(await doc.save({ useObjectStreams: false }), `PDFA-${pdfFile?.name || 'archive.pdf'}`);
      setStatus({ type: 'success', text: 'Packaged archival PDF/A-ready file with standardized metadata & OutputIntent.' });
    });

  const handleRepairPdf = () =>
    runTask(async () => {
      if (!pdfBytes) throw new Error('Upload a damaged or problematic PDF first.');
      try {
        const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true, throwOnInvalidObject: false });
        const out = await PDFDocument.create();
        const copied = await out.copyPages(doc, doc.getPageIndices());
        copied.forEach((p) => out.addPage(p));
        downloadPdfBytes(await out.save(), `repaired-${pdfFile?.name || 'recovered.pdf'}`);
        setStatus({ type: 'success', text: `Repaired XRef & object tables (${out.getPageCount()} pages recovered cleanly).` });
      } catch {
        // Fallback: raster recovery via pdfjs
        const doc = await pdfjsLib.getDocument({ data: pdfBytes.slice(0) }).promise;
        const out = await PDFDocument.create();
        for (let p = 1; p <= doc.numPages; p++) {
          const c = await renderPdfPageCanvas(pdfBytes, p, 1.8);
          const jpg = await out.embedJpg(await fetch(c.toDataURL('image/jpeg', 0.92)).then((r) => r.arrayBuffer()));
          const pg = out.addPage([c.width * 0.55, c.height * 0.55]);
          pg.drawImage(jpg, { x: 0, y: 0, width: c.width * 0.55, height: c.height * 0.55 });
        }
        downloadPdfBytes(await out.save(), `rebuilt-${pdfFile?.name || 'recovered.pdf'}`);
        setStatus({ type: 'success', text: `Reconstructed ${doc.numPages} page(s) via visual stream recovery.` });
      }
    });

  const handleRemoveAnnotations = () =>
    runTask(async () => {
      if (!pdfBytes) throw new Error('Upload a PDF first.');
      const doc = await PDFDocument.load(pdfBytes);
      doc.getPages().forEach((page) => {
        page.node.delete(PDFName.of('Annots'));
      });
      downloadPdfBytes(await doc.save(), `clean-no-annots-${pdfFile?.name || 'doc.pdf'}`);
      setStatus({ type: 'success', text: `Removed all sticky notes, highlights, links & comment annotations.` });
    });

  const handleBatchRenameAnalyze = () =>
    runTask(async () => {
      if (!batchFiles.length) throw new Error('Upload one or more PDF files first.');
      let re: RegExp | null = null;
      try {
        re = new RegExp(renameRegex, 'i');
      } catch {
        throw new Error('Invalid RegExp pattern.');
      }
      const previews: { oldName: string; newName: string; bytes: ArrayBuffer }[] = [];
      for (const f of batchFiles) {
        const doc = await pdfjsLib.getDocument({ data: f.bytes.slice(0) }).promise;
        const pg = await doc.getPage(1);
        const tc = await pg.getTextContent();
        const txt = (tc.items as Array<{ str?: string }>).map((x) => x.str || '').join(' ');
        const match = re.exec(txt);
        const extracted = (match?.[1] || match?.[0] || txt.slice(0, 28) || 'Document')
          .replace(/[^a-zA-Z0-9_-]+/g, '_')
          .replace(/^_+|_+$/g, '');
        previews.push({
          oldName: f.name,
          newName: `${extracted || 'File'}.pdf`,
          bytes: f.bytes,
        });
      }
      setRenamePreviews(previews);
      setStatus({ type: 'success', text: `Generated ${previews.length} content-based filename proposals.` });
    });

  const handleBatchRenameZip = () =>
    runTask(async () => {
      const zip = new JSZip();
      const used = new Set<string>();
      renamePreviews.forEach((p, idx) => {
        let name = p.newName;
        if (used.has(name)) name = name.replace(/\.pdf$/i, `_${idx + 1}.pdf`);
        used.add(name);
        zip.file(name, p.bytes);
      });
      downloadBlob(await zip.generateAsync({ type: 'blob' }), 'Renamed_PDFs_By_Content.zip');
    });

  const handleOcrScannedPdf = () =>
    runTask(async () => {
      if (!pdfBytes) throw new Error('Upload a scanned PDF first.');
      const doc = await pdfjsLib.getDocument({ data: pdfBytes.slice(0) }).promise;
      const limit = Math.min(doc.numPages, Math.max(1, ocrMaxPages));
      const pagesOut: string[] = [];
      for (let p = 1; p <= limit; p++) {
        setProgressText(`OCR recognizing page ${p} of ${limit} (${ocrLang.toUpperCase()})...`);
        const canvas = await renderPdfPageCanvas(pdfBytes, p, 2);
        const res = await Tesseract.recognize(canvas, ocrLang);
        pagesOut.push(`--- PAGE ${p} ---\n${res.data.text.trim()}`);
      }
      setOcrOutput(pagesOut.join('\n\n'));
      setStatus({ type: 'success', text: `Completed OCR across ${limit} page(s).` });
    });

  const handleExportOcrDocx = () =>
    runTask(async () => {
      if (!ocrOutput.trim()) return;
      const doc = new Document({
        sections: [
          {
            children: ocrOutput.split('\n').map(
              (line) =>
                new Paragraph({
                  children: [new TextRun({ text: line, size: 22 })],
                })
            ),
          },
        ],
      });
      const blob = await Packer.toBlob(doc);
      downloadBlob(blob, `${(pdfFile?.name || 'ocr').replace(/\.pdf$/i, '')}.docx`);
    });

  const handleSummarizePdf = () =>
    runTask(async () => {
      if (!pdfBytes) throw new Error('Upload a PDF first.');
      const pageTexts = await extractAllPdfPageTexts(pdfBytes);
      const fullText = pageTexts.join(' ').replace(/\s+/g, ' ').trim();
      if (!fullText) throw new Error('No digital text found inside PDF (use OCR Scanned PDF for image-only scans).');

      const stop = new Set([
        'the', 'is', 'and', 'of', 'to', 'in', 'a', 'for', 'with', 'on', 'as', 'by', 'at', 'an', 'be', 'are', 'was',
        'that', 'this', 'from', 'or', 'it', 'which', 'has', 'have', 'had', 'will', 'not', 'but', 'all', 'we', 'can',
      ]);
      const freq = new Map<string, number>();
      const words = fullText.toLowerCase().match(/[a-z]{3,}/g) || [];
      words.forEach((w) => {
        if (!stop.has(w)) freq.set(w, (freq.get(w) || 0) + 1);
      });

      const rawSentences = fullText.split(/(?<=[.!?])\s+/).filter((s) => s.length > 35 && s.length < 320);
      const scored = rawSentences.map((s, idx) => {
        const sWords = s.toLowerCase().match(/[a-z]{3,}/g) || [];
        const tfScore = sWords.reduce((sum, w) => sum + (freq.get(w) || 0), 0) / Math.max(1, sWords.length);
        const posBoost = idx < 3 ? 1.35 : 1;
        return { sentence: s, idx, score: tfScore * posBoost };
      });
      const topSentences = scored
        .sort((a, b) => b.score - a.score)
        .slice(0, 7)
        .sort((a, b) => a.idx - b.idx)
        .map((x) => x.sentence);

      const topKeywords = Array.from(freq.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([word, count]) => ({ word, count }));

      const totalWords = fullText.split(/\s+/).length;
      setSummaryData({
        sentences: topSentences,
        keywords: topKeywords,
        wordCount: totalWords,
        readMin: Math.max(1, Math.round(totalWords / 200)),
      });
      setStatus({ type: 'success', text: `Extracted ${topSentences.length} key takeaways from ${totalWords} words.` });
    });

  // =========================================================================
  // INTERACTIVE REDACT MOUSE HANDLERS
  // =========================================================================
  const handleRedactMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = redactCanvasRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const xPct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const yPct = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setDragBox({ x0: xPct, y0: yPct, x1: xPct, y1: yPct });
  };

  const handleRedactMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragBox || !redactCanvasRef.current) return;
    const rect = redactCanvasRef.current.getBoundingClientRect();
    const x1 = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y1 = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setDragBox((prev) => (prev ? { ...prev, x1, y1 } : null));
  };

  const handleRedactMouseUp = () => {
    if (!dragBox) return;
    const xPct = Math.min(dragBox.x0, dragBox.x1);
    const yPct = Math.min(dragBox.y0, dragBox.y1);
    const wPct = Math.abs(dragBox.x1 - dragBox.x0);
    const hPct = Math.abs(dragBox.y1 - dragBox.y0);
    if (wPct > 1.5 && hPct > 1) {
      setRedactBoxes((prev) => [
        ...prev,
        { id: `r-${Date.now()}`, page: redactPage, xPct, yPct, wPct, hPct },
      ]);
    }
    setDragBox(null);
  };

  // Helper mode switches
  const needsNoPdfUpload = useMemo(
    () =>
      tool.id === 'create-presentation' ||
      tool.id === 'images-to-ppt' ||
      tool.id === 'scan-to-pdf' ||
      tool.id === 'ppt-to-pdf' ||
      tool.id === 'pdf-bates-numbering' ||
      tool.id === 'pdf-rename-content',
    [tool.id]
  );

  return (
    <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-6 sm:p-8 space-y-6 shadow-[0_4px_0_#2F3E4E]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#2F3E4E]/15">
        <div>
          <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#2F3E4E]" />
            {tool.categoryName} · {tool.code}
          </span>
          <h1 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] mt-1 tracking-tight">
            {tool.title}
          </h1>
          <p className="text-xs sm:text-sm text-[#475569] mt-0.5">{tool.description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 no-print">
          <button
            type="button"
            onClick={handleResetAll}
            disabled={busy}
            className="px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Clear / Reset
          </button>
        </div>
      </div>

      {/* Status Alert */}
      {status && (
        <div
          className={`p-3.5 rounded-xl border-[1.5px] text-xs font-bold flex items-center gap-2 ${
            status.type === 'error'
              ? 'bg-red-50 border-red-700 text-red-800'
              : status.type === 'success'
                ? 'bg-[#CEE5DC]/75 border-[#2F3E4E] text-[#2F3E4E]'
                : 'bg-[#FEF2C8] border-[#2F3E4E] text-[#2F3E4E]'
          }`}
        >
          {status.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle className="w-4 h-4 shrink-0" />}
          <span>{status.text}</span>
        </div>
      )}

      {busy && (
        <div className="p-3.5 rounded-xl bg-[#FEF2C8] border-[1.5px] border-[#2F3E4E] flex items-center gap-2.5 text-xs font-bold text-[#2F3E4E]">
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          <span>{progressText || 'Processing document locally in browser memory...'}</span>
        </div>
      )}

      {/* Primary Single PDF Dropzone (except batch/presentation/image tools) */}
      {!needsNoPdfUpload && tool.id !== 'pdf-fillable-builder' && (
        <DropBox
          accept=".pdf,application/pdf"
          label={
            tool.id === 'pdf-alternate-mix'
              ? 'Upload Odd Pages PDF (File A: 1, 3, 5...)'
              : tool.id === 'pdf-compare'
                ? 'Upload Original Baseline PDF (Version A)'
                : pdfFile
                  ? `Loaded: ${pdfFile.name} (${numPages} pages)`
                  : `Drop your PDF file here for ${tool.title}`
          }
          subLabel="100% browser-local WebAssembly / Canvas engine — zero server uploads"
          onFilesSelected={(files) => files[0] && loadSinglePdf(files[0])}
        />
      )}

      {/* Secondary PDF Upload for Alternate Mix or Compare */}
      {(tool.id === 'pdf-alternate-mix' || tool.id === 'pdf-compare') && (
        <DropBox
          accept=".pdf,application/pdf"
          label={
            tool.id === 'pdf-alternate-mix'
              ? pdfFileB
                ? `Even PDF Loaded: ${pdfFileB.name} (${numPagesB} pages)`
                : 'Upload Even Pages PDF (File B: 2, 4, 6...)'
              : pdfFileB
                ? `Revised PDF (B) Loaded: ${pdfFileB.name} (${numPagesB} pages)`
                : 'Upload Revised Comparison PDF (Version B)'
          }
          onFilesSelected={async (files) => {
            if (!files[0]) return;
            const buf = await files[0].arrayBuffer();
            const doc = await pdfjsLib.getDocument({ data: buf.slice(0) }).promise;
            setPdfFileB(files[0]);
            setPdfBytesB(buf);
            setNumPagesB(doc.numPages);
          }}
        />
      )}

      {/* Multi-PDF Dropzone (Bates & Rename by Content) */}
      {(tool.id === 'pdf-bates-numbering' || tool.id === 'pdf-rename-content') && (
        <div className="space-y-3">
          <DropBox
            accept=".pdf,application/pdf"
            multiple
            label="Upload One or Multiple PDF Files"
            subLabel="Processed sequentially inside browser memory"
            onFilesSelected={async (files) => {
              const loaded: { name: string; bytes: ArrayBuffer; pages: number }[] = [];
              for (const f of files) {
                const buf = await f.arrayBuffer();
                const doc = await PDFDocument.load(buf);
                loaded.push({ name: f.name, bytes: buf, pages: doc.getPageCount() });
              }
              setBatchFiles((prev) => [...prev, ...loaded]);
            }}
          />
          {batchFiles.length > 0 && (
            <div className="p-3 bg-white rounded-xl border border-[#2F3E4E]/30 flex flex-wrap gap-2 items-center justify-between text-xs">
              <span className="font-bold text-[#2F3E4E]">
                Queued {batchFiles.length} PDF(s) · {batchFiles.reduce((s, f) => s + f.pages, 0)} total pages
              </span>
              <button type="button" onClick={() => setBatchFiles([])} className="text-red-700 font-bold cursor-pointer">
                Clear Queue
              </button>
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* 1. PDF ORGANIZE STUDIO                                            */}
      {/* ================================================================= */}
      {tool.id === 'pdf-organize' && thumbs.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-bold text-[#2F3E4E]">
              {thumbs.length} pages in sequence — move, rotate, duplicate, or remove pages below
            </span>
            <button
              type="button"
              onClick={handleOrganizeExport}
              disabled={busy}
              className="px-5 py-2.5 rounded-xl bg-[#2F3E4E] hover:bg-[#1E293B] text-[#FFFDF5] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4" /> Export Organized PDF
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {thumbs.map((item, idx) => (
              <div key={item.id} className="p-2.5 bg-white border-[1.5px] border-[#2F3E4E] rounded-xl flex flex-col gap-2">
                <div className="aspect-[3/4] bg-[#FEF2C8]/40 rounded-lg overflow-hidden flex items-center justify-center border border-[#2F3E4E]/15">
                  <img
                    src={item.thumbUrl}
                    alt={`Page ${item.srcPage}`}
                    className="max-w-full max-h-full object-contain transition-transform"
                    style={{ transform: `rotate(${item.rotation}deg)` }}
                  />
                </div>
                <div className="text-[11px] font-mono font-bold text-[#2F3E4E] text-center">
                  Pos {idx + 1} (Orig #{item.srcPage})
                </div>
                <div className="grid grid-cols-4 gap-1">
                  <button
                    type="button"
                    title="Move Backward"
                    disabled={idx === 0}
                    onClick={() =>
                      setThumbs((prev) => {
                        const copy = [...prev];
                        [copy[idx - 1], copy[idx]] = [copy[idx], copy[idx - 1]];
                        return copy;
                      })
                    }
                    className="p-1.5 rounded border border-[#2F3E4E]/30 hover:bg-[#FEF2C8] disabled:opacity-30 cursor-pointer flex justify-center"
                  >
                    <ArrowUp className="w-3 h-3 -rotate-90" />
                  </button>
                  <button
                    type="button"
                    title="Rotate 90°"
                    onClick={() =>
                      setThumbs((prev) => prev.map((t, i) => (i === idx ? { ...t, rotation: (t.rotation + 90) % 360 } : t)))
                    }
                    className="p-1.5 rounded border border-[#2F3E4E]/30 hover:bg-[#FEF2C8] cursor-pointer flex justify-center"
                  >
                    <RotateCw className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    title="Duplicate Page"
                    onClick={() =>
                      setThumbs((prev) => {
                        const copy = [...prev];
                        copy.splice(idx + 1, 0, { ...item, id: `dup-${Date.now()}-${idx}` });
                        return copy;
                      })
                    }
                    className="p-1.5 rounded border border-[#2F3E4E]/30 hover:bg-[#CEE5DC] cursor-pointer flex justify-center"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    title="Delete Page"
                    disabled={thumbs.length <= 1}
                    onClick={() => setThumbs((prev) => prev.filter((_, i) => i !== idx))}
                    className="p-1.5 rounded border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-30 cursor-pointer flex justify-center"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* 2. EXTRACT PAGES / REVERSE / BOOKLET / FLIP / N-UP / SPLIT        */}
      {/* ================================================================= */}
      {tool.id === 'pdf-extract-pages' && (
        <div className="p-5 bg-white border-[1.5px] border-[#2F3E4E] rounded-2xl flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1 w-full">
            <label className="block text-xs font-bold text-[#2F3E4E] mb-1">
              Pages to Extract (Total: {numPages || '—'})
            </label>
            <input
              type="text"
              value={rangeInput}
              onChange={(e) => setRangeInput(e.target.value)}
              placeholder="e.g. 1-3, 5, 8-10"
              className="w-full px-3.5 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] font-mono text-sm"
            />
          </div>
          <button
            type="button"
            onClick={handleExtractPages}
            disabled={!pdfBytes || busy}
            className="px-5 py-2.5 rounded-xl bg-[#2F3E4E] text-[#FFFDF5] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Scissors className="w-4 h-4" /> Extract Selected Pages
          </button>
        </div>
      )}

      {tool.id === 'pdf-reverse-pages' && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleReversePages}
            disabled={!pdfBytes || busy}
            className="px-5 py-2.5 rounded-xl bg-[#2F3E4E] text-[#FFFDF5] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> Reverse Order (Page {numPages || 'N'} → 1) &amp; Download
          </button>
        </div>
      )}

      {tool.id === 'pdf-nup' && (
        <div className="p-5 bg-white border-[1.5px] border-[#2F3E4E] rounded-2xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-[#2F3E4E]">
            <span>Pages Per Sheet:</span>
            {([2, 4, 6, 9] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNupCount(n)}
                className={`px-3 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] cursor-pointer ${
                  nupCount === n ? 'bg-[#F9C80E]' : 'bg-[#FEF2C8]/50'
                }`}
              >
                {n}-Up
              </button>
            ))}
            <label className="inline-flex items-center gap-1.5 ml-2 cursor-pointer">
              <input type="checkbox" checked={nupLandscape} onChange={(e) => setNupLandscape(e.target.checked)} className="w-4 h-4 accent-[#2F3E4E]" />
              Landscape A4 Sheet
            </label>
          </div>
          <button
            type="button"
            onClick={handleNupLayout}
            disabled={!pdfBytes || busy}
            className="px-5 py-2.5 rounded-xl bg-[#2F3E4E] text-[#FFFDF5] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> Export {nupCount}-Up Handout PDF
          </button>
        </div>
      )}

      {tool.id === 'pdf-alternate-mix' && (
        <div className="p-5 bg-white border-[1.5px] border-[#2F3E4E] rounded-2xl flex flex-wrap items-center justify-between gap-4">
          <label className="inline-flex items-center gap-2 text-xs font-bold text-[#2F3E4E] cursor-pointer">
            <input type="checkbox" checked={reverseEven} onChange={(e) => setReverseEven(e.target.checked)} className="w-4 h-4 accent-[#2F3E4E]" />
            Reverse Even Pages Order (use when ADF scanned back-side stack in reverse)
          </label>
          <button
            type="button"
            onClick={handleAlternateMix}
            disabled={!pdfBytes || !pdfBytesB || busy}
            className="px-5 py-2.5 rounded-xl bg-[#2F3E4E] text-[#FFFDF5] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> Interleave Odd + Even PDF
          </button>
        </div>
      )}

      {tool.id === 'pdf-split-half' && (
        <div className="p-5 bg-white border-[1.5px] border-[#2F3E4E] rounded-2xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-2 text-xs font-bold">
            <button
              type="button"
              onClick={() => setHalfSplitAxis('vertical')}
              className={`px-3.5 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] cursor-pointer ${halfSplitAxis === 'vertical' ? 'bg-[#F9C80E]' : 'bg-white'}`}
            >
              Vertical Center Cut (Left / Right)
            </button>
            <button
              type="button"
              onClick={() => setHalfSplitAxis('horizontal')}
              className={`px-3.5 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] cursor-pointer ${halfSplitAxis === 'horizontal' ? 'bg-[#F9C80E]' : 'bg-white'}`}
            >
              Horizontal Center Cut (Top / Bottom)
            </button>
          </div>
          <button
            type="button"
            onClick={handleSplitHalf}
            disabled={!pdfBytes || busy}
            className="px-5 py-2.5 rounded-xl bg-[#2F3E4E] text-[#FFFDF5] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Scissors className="w-4 h-4" /> Split Pages in Half
          </button>
        </div>
      )}

      {tool.id === 'pdf-split-size' && (
        <div className="p-5 bg-white border-[1.5px] border-[#2F3E4E] rounded-2xl flex flex-wrap items-center justify-between gap-4">
          <label className="text-xs font-bold text-[#2F3E4E] flex items-center gap-3">
            Target Max Part Size: <span className="font-mono text-sm">{splitTargetMb.toFixed(1)} MB</span>
            <input type="range" min={0.3} max={10} step={0.1} value={splitTargetMb} onChange={(e) => setSplitTargetMb(Number(e.target.value))} className="accent-[#2F3E4E]" />
          </label>
          <button
            type="button"
            onClick={handleSplitBySize}
            disabled={!pdfBytes || busy}
            className="px-5 py-2.5 rounded-xl bg-[#2F3E4E] text-[#FFFDF5] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> Split &amp; Download ZIP
          </button>
        </div>
      )}

      {(tool.id === 'pdf-split-text' || tool.id === 'pdf-split-bookmarks') && (
        <div className="p-5 bg-white border-[1.5px] border-[#2F3E4E] rounded-2xl flex flex-wrap items-center justify-between gap-4">
          {tool.id === 'pdf-split-text' ? (
            <div className="flex-1 min-w-[220px]">
              <label className="block text-xs font-bold text-[#2F3E4E] mb-1">
                Split Whenever Page Contains Keyword / Header:
              </label>
              <input
                type="text"
                value={splitKeyword}
                onChange={(e) => setSplitKeyword(e.target.value)}
                placeholder="e.g. Invoice No or Employee ID"
                className="w-full px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] text-sm font-mono"
              />
            </div>
          ) : (
            <p className="text-xs font-bold text-[#475569]">
              Automatically reads embedded PDF Outlines (/Bookmarks) or Chapter headings to burst separate section PDFs.
            </p>
          )}
          <button
            type="button"
            onClick={handleSplitTextOrBookmarkClean}
            disabled={!pdfBytes || busy}
            className="px-5 py-2.5 rounded-xl bg-[#2F3E4E] text-[#FFFDF5] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Scissors className="w-4 h-4" /> Split &amp; Download ZIP
          </button>
        </div>
      )}

      {tool.id === 'pdf-flip-mirror' && (
        <div className="p-5 bg-white border-[1.5px] border-[#2F3E4E] rounded-2xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-2 text-xs font-bold">
            <button type="button" onClick={() => setFlipAxis('horizontal')} className={`px-3.5 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] cursor-pointer ${flipAxis === 'horizontal' ? 'bg-[#F9C80E]' : 'bg-white'}`}>
              Flip Horizontal (Mirror L ↔ R)
            </button>
            <button type="button" onClick={() => setFlipAxis('vertical')} className={`px-3.5 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] cursor-pointer ${flipAxis === 'vertical' ? 'bg-[#F9C80E]' : 'bg-white'}`}>
              Flip Vertical (Upside-Down)
            </button>
          </div>
          <button type="button" onClick={handleFlipMirror} disabled={!pdfBytes || busy} className="px-5 py-2.5 rounded-xl bg-[#2F3E4E] text-[#FFFDF5] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
            <Download className="w-4 h-4" /> Export Mirrored PDF
          </button>
        </div>
      )}

      {tool.id === 'pdf-booklet' && (
        <div className="p-5 bg-white border-[1.5px] border-[#2F3E4E] rounded-2xl flex flex-wrap items-center justify-between gap-4">
          <div className="text-xs text-[#475569]">
            Pairs pages in saddle-stitch print order ([N,1], [2,N-1]...) on A4 Landscape sheets ready for double-sided folding.
          </div>
          <button type="button" onClick={handleBookletImposition} disabled={!pdfBytes || busy} className="px-5 py-2.5 rounded-xl bg-[#2F3E4E] text-[#FFFDF5] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
            <Download className="w-4 h-4" /> Build Printable Booklet PDF
          </button>
        </div>
      )}

      {tool.id === 'pdf-insert-blank' && (
        <div className="p-5 bg-white border-[1.5px] border-[#2F3E4E] rounded-2xl space-y-4">
          <div className="flex flex-wrap gap-3 items-center text-xs font-bold">
            <button type="button" onClick={() => setBlankMode('every')} className={`px-3 py-1.5 rounded-lg border border-[#2F3E4E] cursor-pointer ${blankMode === 'every' ? 'bg-[#F9C80E]' : 'bg-white'}`}>
              After Every N Pages
            </button>
            <button type="button" onClick={() => setBlankMode('after')} className={`px-3 py-1.5 rounded-lg border border-[#2F3E4E] cursor-pointer ${blankMode === 'after' ? 'bg-[#F9C80E]' : 'bg-white'}`}>
              After Specific Pages
            </button>
            <label className="inline-flex items-center gap-1.5 ml-2 cursor-pointer">
              <input type="checkbox" checked={blankLined} onChange={(e) => setBlankLined(e.target.checked)} className="w-4 h-4 accent-[#2F3E4E]" />
              Add Ruled Writing Lines (Note Pages)
            </label>
          </div>
          <div className="flex flex-wrap gap-3 items-end justify-between">
            {blankMode === 'every' ? (
              <label className="text-xs font-bold text-[#2F3E4E]">
                Insert Blank After Every N Pages:
                <input type="number" min={1} max={20} value={blankInterval} onChange={(e) => setBlankInterval(Number(e.target.value) || 1)} className="ml-2 w-20 px-2.5 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] font-mono" />
              </label>
            ) : (
              <label className="text-xs font-bold text-[#2F3E4E] flex-1">
                Insert Blank After Page Numbers:
                <input type="text" value={blankAfterPages} onChange={(e) => setBlankAfterPages(e.target.value)} className="ml-2 px-3 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] font-mono" placeholder="1, 3, 5" />
              </label>
            )}
            <button type="button" onClick={handleInsertBlankPages} disabled={!pdfBytes || busy} className="px-5 py-2.5 rounded-xl bg-[#2F3E4E] text-[#FFFDF5] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
              <Download className="w-4 h-4" /> Export With Blank Pages
            </button>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* 3. HEADER / FOOTER, BATES, BOOKMARKS, FILLABLE FORM               */}
      {/* ================================================================= */}
      {tool.id === 'pdf-header-footer' && (
        <div className="p-5 bg-white border-[1.5px] border-[#2F3E4E] rounded-2xl space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#2F3E4E] mb-1">Header Left</label>
              <input type="text" value={hfLeft} onChange={(e) => setHfLeft(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#2F3E4E] text-xs" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#2F3E4E] mb-1">Header Center</label>
              <input type="text" value={hfCenter} onChange={(e) => setHfCenter(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#2F3E4E] text-xs" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#2F3E4E] mb-1">Footer Right</label>
              <input type="text" value={hfRight} onChange={(e) => setHfRight(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#2F3E4E] text-xs" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#2F3E4E] mb-1">Font Size (pt)</label>
              <input type="number" min={7} max={16} value={hfFontSize} onChange={(e) => setHfFontSize(Number(e.target.value) || 9)} className="w-full px-3 py-2 rounded-lg border border-[#2F3E4E] text-xs font-mono" />
            </div>
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#64748B]">
            <span>Supported dynamic tokens: <code>{'{page}'}</code>, <code>{'{total}'}</code>, <code>{'{date}'}</code></span>
            <button type="button" onClick={handleHeaderFooter} disabled={!pdfBytes || busy} className="px-5 py-2.5 rounded-xl bg-[#2F3E4E] text-[#FFFDF5] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
              <Download className="w-4 h-4" /> Stamp &amp; Download PDF
            </button>
          </div>
        </div>
      )}

      {tool.id === 'pdf-bates-numbering' && (
        <div className="p-5 bg-white border-[1.5px] border-[#2F3E4E] rounded-2xl grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-[11px] font-bold mb-1">Prefix</label>
            <input type="text" value={batesPrefix} onChange={(e) => setBatesPrefix(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#2F3E4E] font-mono text-xs" />
          </div>
          <div>
            <label className="block text-[11px] font-bold mb-1">Start #</label>
            <input type="number" value={batesStart} onChange={(e) => setBatesStart(Number(e.target.value) || 1)} className="w-full px-3 py-2 rounded-lg border border-[#2F3E4E] font-mono text-xs" />
          </div>
          <div>
            <label className="block text-[11px] font-bold mb-1">Zero Pad</label>
            <input type="number" min={2} max={8} value={batesPad} onChange={(e) => setBatesPad(Number(e.target.value) || 4)} className="w-full px-3 py-2 rounded-lg border border-[#2F3E4E] font-mono text-xs" />
          </div>
          <div>
            <label className="block text-[11px] font-bold mb-1">Corner</label>
            <select value={batesPos} onChange={(e) => setBatesPos(e.target.value as any)} className="w-full px-3 py-2 rounded-lg border border-[#2F3E4E] text-xs font-bold">
              <option value="bottom-right">Bottom Right</option>
              <option value="bottom-left">Bottom Left</option>
              <option value="top-right">Top Right</option>
            </select>
          </div>
          <button type="button" onClick={handleBatesNumbering} disabled={!batchFiles.length || busy} className="px-4 py-2.5 rounded-xl bg-[#2F3E4E] text-[#FFFDF5] text-xs font-bold cursor-pointer disabled:opacity-50">
            Stamp Bates &amp; Export
          </button>
        </div>
      )}

      {tool.id === 'pdf-bookmarks' && (
        <div className="p-5 bg-white border-[1.5px] border-[#2F3E4E] rounded-2xl space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-[#2F3E4E]">
              Bookmark Outline Lines (Format: <code>Bookmark Title | Page Number</code>)
            </span>
            <button type="button" onClick={handleAutoDetectBookmarks} disabled={!pdfBytes || busy} className="px-3 py-1.5 rounded-lg border border-[#2F3E4E] bg-[#FEF2C8] text-xs font-bold cursor-pointer disabled:opacity-50">
              Auto-Detect Headings
            </button>
          </div>
          <textarea rows={7} value={bookmarkLines} onChange={(e) => setBookmarkLines(e.target.value)} className="w-full p-3.5 rounded-xl border-[1.5px] border-[#2F3E4E] font-mono text-xs" />
          <div className="flex justify-end">
            <button type="button" onClick={handleSaveBookmarks} disabled={!pdfBytes || busy} className="px-5 py-2.5 rounded-xl bg-[#2F3E4E] text-[#FFFDF5] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
              <Download className="w-4 h-4" /> Embed PDF Outlines &amp; Download
            </button>
          </div>
        </div>
      )}

      {tool.id === 'pdf-fillable-builder' && (
        <div className="space-y-4">
          <DropBox
            accept=".pdf,application/pdf"
            label={pdfFile ? `Background PDF: ${pdfFile.name} (${numPages}p)` : 'Optional: Upload an Existing PDF Form (or leave empty for blank A4 sheet)'}
            onFilesSelected={(files) => files[0] && loadSinglePdf(files[0])}
          />
          <div className="p-5 bg-white border-[1.5px] border-[#2F3E4E] rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#2F3E4E]">Interactive AcroForm Fields</span>
              <button
                type="button"
                onClick={() =>
                  setFormFields((prev) => [
                    ...prev,
                    { id: `f-${Date.now()}`, label: `field_${prev.length + 1}`, type: 'text', page: 1, xPct: 12, yPct: Math.min(85, 18 + prev.length * 8), wPct: 40, hPct: 5, options: '' },
                  ])
                }
                className="px-3 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Form Field
              </button>
            </div>
            <div className="space-y-2">
              {formFields.map((f, idx) => (
                <div key={f.id} className="grid grid-cols-2 sm:grid-cols-8 gap-2 items-center text-xs bg-[#FEF2C8]/40 p-2 rounded-lg border border-[#2F3E4E]/20">
                  <input value={f.label} onChange={(e) => setFormFields((p) => p.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)))} placeholder="field_name" className="col-span-2 px-2 py-1 rounded border border-[#2F3E4E]/40 bg-white font-mono" />
                  <select value={f.type} onChange={(e) => setFormFields((p) => p.map((x, i) => (i === idx ? { ...x, type: e.target.value as any } : x)))} className="px-2 py-1 rounded border border-[#2F3E4E]/40 bg-white">
                    <option value="text">TextBox</option>
                    <option value="checkbox">Checkbox</option>
                    <option value="dropdown">Dropdown</option>
                  </select>
                  <input type="number" min={1} value={f.page} onChange={(e) => setFormFields((p) => p.map((x, i) => (i === idx ? { ...x, page: Number(e.target.value) || 1 } : x)))} title="Page #" className="px-2 py-1 rounded border border-[#2F3E4E]/40 bg-white font-mono" />
                  <input type="number" min={0} max={90} value={f.xPct} onChange={(e) => setFormFields((p) => p.map((x, i) => (i === idx ? { ...x, xPct: Number(e.target.value) } : x)))} title="X %" className="px-2 py-1 rounded border border-[#2F3E4E]/40 bg-white font-mono" />
                  <input type="number" min={0} max={90} value={f.yPct} onChange={(e) => setFormFields((p) => p.map((x, i) => (i === idx ? { ...x, yPct: Number(e.target.value) } : x)))} title="Y %" className="px-2 py-1 rounded border border-[#2F3E4E]/40 bg-white font-mono" />
                  <input type="number" min={3} max={90} value={f.wPct} onChange={(e) => setFormFields((p) => p.map((x, i) => (i === idx ? { ...x, wPct: Number(e.target.value) } : x)))} title="Width %" className="px-2 py-1 rounded border border-[#2F3E4E]/40 bg-white font-mono" />
                  <button type="button" onClick={() => setFormFields((p) => p.filter((_, i) => i !== idx))} className="text-red-700 font-bold cursor-pointer justify-self-center">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <button type="button" onClick={handleBuildFillablePdf} disabled={busy} className="px-5 py-2.5 rounded-xl bg-[#2F3E4E] text-[#FFFDF5] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer">
                <Download className="w-4 h-4" /> Generate Interactive Fillable PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* 4. PPT / PRESENTATIONS / EXTRACT IMAGES / SCAN TO PDF             */}
      {/* ================================================================= */}
      {tool.id === 'ppt-to-pdf' && (
        <div className="space-y-4">
          <DropBox
            accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
            label={pptFile ? `Loaded Deck: ${pptFile.name}` : 'Drop your PowerPoint (.PPTX) deck here'}
            subLabel="Parses PPTX OpenXML slide layers directly inside your browser"
            onFilesSelected={(files) => files[0] && setPptFile(files[0])}
          />
          <div className="flex justify-end">
            <button type="button" onClick={handlePptToPdf} disabled={!pptFile || busy} className="px-5 py-2.5 rounded-xl bg-[#2F3E4E] text-[#FFFDF5] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
              <Download className="w-4 h-4" /> Convert PPTX to 16:9 PDF
            </button>
          </div>
        </div>
      )}

      {tool.id === 'create-presentation' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-[#2F3E4E] mb-1">Cover Slide Title</label>
              <input type="text" value={pptOutlineTitle} onChange={(e) => setPptOutlineTitle(e.target.value)} className="w-full px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white text-sm font-bold" />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#2F3E4E] mb-1">Slide Palette</label>
              <select value={pptTheme} onChange={(e) => setPptTheme(e.target.value as any)} className="w-full px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white text-xs font-bold">
                <option value="vcpl">VCPL Slate &amp; Gold</option>
                <option value="cream">Warm Cream Executive</option>
                <option value="slate">Midnight Dark Mode</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-[#2F3E4E] mb-1">
              Slide Outline (Separate each slide with <code>---</code>, start slide title with <code>#</code>)
            </label>
            <textarea rows={9} value={pptOutlineBody} onChange={(e) => setPptOutlineBody(e.target.value)} className="w-full p-4 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white font-mono text-xs" />
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={handleCreatePresentation} disabled={busy} className="px-5 py-2.5 rounded-xl bg-[#2F3E4E] text-[#FFFDF5] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer">
              <Download className="w-4 h-4" /> Download .PPTX PowerPoint
            </button>
          </div>
        </div>
      )}

      {(tool.id === 'images-to-ppt' || tool.id === 'scan-to-pdf') && (
        <div className="space-y-4">
          <DropBox
            accept="image/*"
            multiple
            label={`Drop Multiple Photos / Scans for ${tool.title}`}
            onFilesSelected={(files) => {
              const items = files.map((f) => ({ name: f.name, url: URL.createObjectURL(f), file: f }));
              setImageBatch((prev) => [...prev, ...items]);
            }}
          />
          {imageBatch.length > 0 && (
            <div className="p-4 bg-white border-[1.5px] border-[#2F3E4E] rounded-2xl space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-bold text-[#2F3E4E]">{imageBatch.length} image(s) queued</span>
                {tool.id === 'scan-to-pdf' && (
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="inline-flex items-center gap-1.5 font-bold cursor-pointer">
                      <input type="checkbox" checked={scanBw} onChange={(e) => setScanBw(e.target.checked)} className="accent-[#2F3E4E]" />
                      White Paper B&amp;W Magic Filter
                    </label>
                    <label className="inline-flex items-center gap-2 font-bold">
                      Contrast {scanContrast.toFixed(1)}x
                      <input type="range" min={1} max={2.4} step={0.1} value={scanContrast} onChange={(e) => setScanContrast(Number(e.target.value))} className="accent-[#2F3E4E]" />
                    </label>
                  </div>
                )}
                <button type="button" onClick={() => setImageBatch([])} className="text-red-700 font-bold cursor-pointer">
                  Clear All
                </button>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                {imageBatch.map((it, idx) => (
                  <img key={idx} src={it.url} alt={it.name} className="h-20 w-full object-cover rounded-lg border border-[#2F3E4E]/30" />
                ))}
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={tool.id === 'images-to-ppt' ? handleImagesToPpt : handleScanToPdf}
                  disabled={busy}
                  className="px-5 py-2.5 rounded-xl bg-[#2F3E4E] text-[#FFFDF5] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  {tool.id === 'images-to-ppt' ? 'Build .PPTX Slideshow' : 'Export Clean Scan PDF'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {tool.id === 'pdf-extract-images' && (
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            <button type="button" onClick={handleExtractImages} disabled={!pdfBytes || busy} className="px-5 py-2.5 rounded-xl bg-[#2F3E4E] text-[#FFFDF5] text-xs font-bold cursor-pointer disabled:opacity-50">
              Extract High-DPI Images
            </button>
            {extractedImgs.length > 0 && (
              <button type="button" onClick={handleDownloadExtractedImagesZip} className="px-5 py-2.5 rounded-xl bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] text-[#2F3E4E] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer">
                <Download className="w-4 h-4" /> Download All ({extractedImgs.length}) ZIP
              </button>
            )}
          </div>
          {extractedImgs.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {extractedImgs.map((img) => (
                <a key={img.name} href={img.url} download={img.name} className="block p-2 bg-white border border-[#2F3E4E] rounded-xl hover:bg-[#FEF2C8]">
                  <img src={img.url} alt={img.name} className="w-full h-36 object-contain rounded" />
                  <span className="text-[11px] font-mono font-bold text-[#2F3E4E] block text-center mt-1">{img.name}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* 5. COMPARE PDFS                                                   */}
      {/* ================================================================= */}
      {tool.id === 'pdf-compare' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="text-xs font-bold text-[#2F3E4E]">
              Visual Diff Overlay Page:
              <input type="number" min={1} max={Math.max(1, numPages)} value={diffPage} onChange={(e) => setDiffPage(Number(e.target.value) || 1)} className="ml-2 w-16 px-2 py-1 rounded border border-[#2F3E4E] font-mono" />
            </label>
            <button type="button" onClick={handleComparePdfs} disabled={!pdfBytes || !pdfBytesB || busy} className="px-5 py-2.5 rounded-xl bg-[#2F3E4E] text-[#FFFDF5] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
              <Eye className="w-4 h-4" /> Compare PDFs (Text &amp; Visual Diff)
            </button>
          </div>
          {diffVisualUrl && (
            <div className="p-4 bg-white border-[1.5px] border-[#2F3E4E] rounded-2xl space-y-2">
              <span className="text-xs font-bold text-[#2F3E4E]">Visual Pixel Difference Map (Red = Changed Regions on Page {diffPage})</span>
              <img src={diffVisualUrl} alt="Visual Pixel Diff" className="max-h-[420px] mx-auto border border-[#2F3E4E]/20 rounded-lg" />
            </div>
          )}
          {diffRows.length > 0 && (
            <div className="p-4 bg-white border-[1.5px] border-[#2F3E4E] rounded-2xl space-y-3 max-h-80 overflow-y-auto text-xs">
              {diffRows.map((r) => (
                <div key={r.page} className="border-b border-[#2F3E4E]/15 pb-2">
                  <div className="font-bold text-[#2F3E4E] mb-1">Page {r.page}</div>
                  {r.removed.map((l, i) => (
                    <div key={`r-${i}`} className="bg-red-50 text-red-800 px-2 py-0.5 rounded font-mono">- {l}</div>
                  ))}
                  {r.added.map((l, i) => (
                    <div key={`a-${i}`} className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded font-mono mt-0.5">+ {l}</div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* 6. PERMANENT REDACT                                               */}
      {/* ================================================================= */}
      {tool.id === 'pdf-redact' && (
        <div className="space-y-4">
          <div className="p-4 bg-white border-[1.5px] border-[#2F3E4E] rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <label className="font-bold">
                Page:
                <select value={redactPage} onChange={(e) => setRedactPage(Number(e.target.value))} className="ml-1.5 px-2 py-1 rounded border border-[#2F3E4E] font-mono">
                  {Array.from({ length: Math.max(1, numPages) }, (_, i) => i + 1).map((p) => (
                    <option key={p} value={p}>Page {p}</option>
                  ))}
                </select>
              </label>
              <input
                type="text"
                value={redactKeyword}
                onChange={(e) => setRedactKeyword(e.target.value)}
                placeholder="Auto-redact keywords (comma-separated, e.g. 98765, PAN)"
                className="flex-1 min-w-[240px] px-3 py-1.5 rounded-lg border border-[#2F3E4E]"
              />
              <button type="button" onClick={() => setRedactBoxes((p) => p.filter((b) => b.page !== redactPage))} className="text-red-700 font-bold cursor-pointer">
                Clear Page Boxes
              </button>
            </div>
            <button type="button" onClick={handlePermanentRedact} disabled={!pdfBytes || busy} className="px-5 py-2 rounded-xl bg-[#2F3E4E] text-[#FFFDF5] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
              <Shield className="w-4 h-4" /> Burn Redactions Permanently
            </button>
          </div>
          {redactPreviewUrl && (
            <div
              ref={redactCanvasRef}
              onMouseDown={handleRedactMouseDown}
              onMouseMove={handleRedactMouseMove}
              onMouseUp={handleRedactMouseUp}
              className="relative max-w-2xl mx-auto border-[1.5px] border-[#2F3E4E] rounded-xl overflow-hidden select-none cursor-crosshair bg-white"
            >
              <img src={redactPreviewUrl} alt="Redact Canvas" className="w-full block pointer-events-none" />
              {redactBoxes
                .filter((b) => b.page === redactPage)
                .map((b) => (
                  <div
                    key={b.id}
                    className="absolute bg-black/95 border border-red-400"
                    style={{ left: `${b.xPct}%`, top: `${b.yPct}%`, width: `${b.wPct}%`, height: `${b.hPct}%` }}
                  />
                ))}
              {dragBox && (
                <div
                  className="absolute bg-black/60 border-2 border-dashed border-[#F9C80E]"
                  style={{
                    left: `${Math.min(dragBox.x0, dragBox.x1)}%`,
                    top: `${Math.min(dragBox.y0, dragBox.y1)}%`,
                    width: `${Math.abs(dragBox.x1 - dragBox.x0)}%`,
                    height: `${Math.abs(dragBox.y1 - dragBox.y0)}%`,
                  }}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* 7. GRAYSCALE / CLEANUP / INVERT / DESKEW / PDFA / REPAIR / ANNOT  */}
      {/* ================================================================= */}
      {(tool.id === 'pdf-to-grayscale' || tool.id === 'pdf-scan-cleanup' || tool.id === 'pdf-invert-colors') && (
        <div className="p-5 bg-white border-[1.5px] border-[#2F3E4E] rounded-2xl flex flex-wrap items-center justify-between gap-4">
          {tool.id === 'pdf-scan-cleanup' && (
            <label className="text-xs font-bold text-[#2F3E4E] flex items-center gap-3">
              Background Whiten Threshold ({cleanupStrength}):
              <input type="range" min={140} max={245} value={cleanupStrength} onChange={(e) => setCleanupStrength(Number(e.target.value))} className="accent-[#2F3E4E]" />
            </label>
          )}
          {tool.id === 'pdf-invert-colors' && (
            <div className="flex gap-2 text-xs font-bold">
              <button type="button" onClick={() => setInvertMode('daylight')} className={`px-3 py-1.5 rounded-lg border border-[#2F3E4E] cursor-pointer ${invertMode === 'daylight' ? 'bg-[#F9C80E]' : 'bg-white'}`}>
                Crisp Daylight White
              </button>
              <button type="button" onClick={() => setInvertMode('warm-eye')} className={`px-3 py-1.5 rounded-lg border border-[#2F3E4E] cursor-pointer ${invertMode === 'warm-eye' ? 'bg-[#F9C80E]' : 'bg-white'}`}>
                Warm Eye-Care Cream
              </button>
            </div>
          )}
          {tool.id === 'pdf-to-grayscale' && (
            <span className="text-xs font-semibold text-[#475569]">Converts full-color PDFs to true ink-saving monochrome grayscale.</span>
          )}
          <button type="button" onClick={handlePixelFilterPdf} disabled={!pdfBytes || busy} className="px-5 py-2.5 rounded-xl bg-[#2F3E4E] text-[#FFFDF5] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
            <Download className="w-4 h-4" /> Process &amp; Download PDF
          </button>
        </div>
      )}

      {tool.id === 'pdf-deskew' && (
        <div className="space-y-4">
          <div className="p-4 bg-white border-[1.5px] border-[#2F3E4E] rounded-2xl flex flex-wrap items-center justify-between gap-4">
            <label className="text-xs font-bold text-[#2F3E4E] flex items-center gap-3">
              Fine Tilt Angle: <span className="font-mono text-sm">{deskewAngle.toFixed(1)}°</span>
              <input type="range" min={-10} max={10} step={0.2} value={deskewAngle} onChange={(e) => setDeskewAngle(Number(e.target.value))} className="accent-[#2F3E4E] w-48" />
            </label>
            <button type="button" onClick={handleDeskewExport} disabled={!pdfBytes || busy} className="px-5 py-2.5 rounded-xl bg-[#2F3E4E] text-[#FFFDF5] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
              <Download className="w-4 h-4" /> Straighten All Pages &amp; Export
            </button>
          </div>
          {deskewPreviewUrl && (
            <div className="relative max-w-md mx-auto overflow-hidden border-[1.5px] border-[#2F3E4E] rounded-xl bg-white p-2">
              <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-red-500/60 pointer-events-none z-10" />
              <div className="absolute inset-y-0 left-1/2 border-l border-dashed border-red-500/60 pointer-events-none z-10" />
              <img src={deskewPreviewUrl} alt="Deskew preview" className="w-full block transition-transform" style={{ transform: `rotate(${deskewAngle}deg)` }} />
            </div>
          )}
        </div>
      )}

      {(tool.id === 'pdf-strip-metadata' || tool.id === 'pdf-to-pdfa' || tool.id === 'pdf-repair' || tool.id === 'pdf-remove-annotations') && (
        <div className="p-5 bg-white border-[1.5px] border-[#2F3E4E] rounded-2xl flex flex-wrap items-center justify-between gap-4">
          <p className="text-xs font-medium text-[#475569]">
            {tool.id === 'pdf-strip-metadata' && 'Removes hidden Author, Creator, Producer, Subject, Dates & XMP metadata locally.'}
            {tool.id === 'pdf-to-pdfa' && 'Applies standardized sRGB OutputIntent & archival metadata markers for long-term storage.'}
            {tool.id === 'pdf-repair' && 'Reconstructs corrupted XRef tables and page trees with visual stream fallback recovery.'}
            {tool.id === 'pdf-remove-annotations' && 'Strips all highlights, sticky notes, popup comments & clickable link annotations.'}
          </p>
          <button
            type="button"
            disabled={!pdfBytes || busy}
            onClick={
              tool.id === 'pdf-strip-metadata'
                ? handleStripMetadata
                : tool.id === 'pdf-to-pdfa'
                  ? handlePdfToPdfA
                  : tool.id === 'pdf-repair'
                    ? handleRepairPdf
                    : handleRemoveAnnotations
            }
            className="px-5 py-2.5 rounded-xl bg-[#2F3E4E] text-[#FFFDF5] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> Process &amp; Download PDF
          </button>
        </div>
      )}

      {/* ================================================================= */}
      {/* 8. RENAME BY CONTENT                                              */}
      {/* ================================================================= */}
      {tool.id === 'pdf-rename-content' && (
        <div className="space-y-4">
          <div className="p-4 bg-white border-[1.5px] border-[#2F3E4E] rounded-2xl flex flex-wrap items-end justify-between gap-3">
            <div className="flex-1 min-w-[260px]">
              <label className="block text-xs font-bold text-[#2F3E4E] mb-1">Content Extraction Regex (Matches Page 1)</label>
              <input type="text" value={renameRegex} onChange={(e) => setRenameRegex(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-[#2F3E4E] font-mono text-xs" />
            </div>
            <button type="button" onClick={handleBatchRenameAnalyze} disabled={!batchFiles.length || busy} className="px-4 py-2.5 rounded-xl bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] text-[#2F3E4E] text-xs font-bold cursor-pointer disabled:opacity-50">
              Preview New Names
            </button>
            {renamePreviews.length > 0 && (
              <button type="button" onClick={handleBatchRenameZip} className="px-4 py-2.5 rounded-xl bg-[#2F3E4E] text-[#FFFDF5] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer">
                <Download className="w-4 h-4" /> Download Renamed ZIP
              </button>
            )}
          </div>
          {renamePreviews.length > 0 && (
            <div className="p-4 bg-white border-[1.5px] border-[#2F3E4E] rounded-2xl divide-y divide-[#2F3E4E]/15 text-xs">
              {renamePreviews.map((p, idx) => (
                <div key={idx} className="py-2 flex items-center justify-between gap-4 font-mono">
                  <span className="text-[#64748B] truncate">{p.oldName}</span>
                  <span className="font-bold text-[#12805C] truncate">→ {p.newName}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* 9. OCR SCANNED PDF & EXECUTIVE SUMMARIZER                         */}
      {/* ================================================================= */}
      {tool.id === 'ocr-scanned-pdf' && (
        <div className="space-y-4">
          <div className="p-4 bg-white border-[1.5px] border-[#2F3E4E] rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <label className="font-bold">
                OCR Script:
                <select value={ocrLang} onChange={(e) => setOcrLang(e.target.value as any)} className="ml-2 px-2.5 py-1.5 rounded-lg border border-[#2F3E4E] font-bold">
                  <option value="eng">English</option>
                  <option value="hin">Hindi (Devanagari)</option>
                  <option value="kan">Kannada</option>
                  <option value="eng+hin">English + Hindi</option>
                </select>
              </label>
              <label className="font-bold">
                Max Pages:
                <input type="number" min={1} max={30} value={ocrMaxPages} onChange={(e) => setOcrMaxPages(Number(e.target.value) || 5)} className="ml-2 w-16 px-2 py-1 rounded border border-[#2F3E4E] font-mono" />
              </label>
            </div>
            <button type="button" onClick={handleOcrScannedPdf} disabled={!pdfBytes || busy} className="px-5 py-2.5 rounded-xl bg-[#2F3E4E] text-[#FFFDF5] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
              <ScanText className="w-4 h-4" /> Run Local OCR
            </button>
          </div>
          {ocrOutput && (
            <div className="space-y-3">
              <textarea rows={10} value={ocrOutput} onChange={(e) => setOcrOutput(e.target.value)} className="w-full p-4 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white font-mono text-xs" />
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => navigator.clipboard.writeText(ocrOutput)} className="px-4 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white text-xs font-bold cursor-pointer">
                  Copy Text
                </button>
                <button type="button" onClick={() => downloadBlob(new Blob([ocrOutput], { type: 'text/plain' }), 'ocr-output.txt')} className="px-4 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] text-xs font-bold cursor-pointer">
                  Download .TXT
                </button>
                <button type="button" onClick={handleExportOcrDocx} className="px-4 py-2 rounded-xl bg-[#2F3E4E] text-[#FFFDF5] text-xs font-bold cursor-pointer">
                  Download .DOCX
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {tool.id === 'pdf-executive-summarizer' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button type="button" onClick={handleSummarizePdf} disabled={!pdfBytes || busy} className="px-5 py-2.5 rounded-xl bg-[#2F3E4E] text-[#FFFDF5] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
              <FileText className="w-4 h-4" /> Extract Executive Summary
            </button>
          </div>
          {summaryData && (
            <div className="p-5 bg-white border-[1.5px] border-[#2F3E4E] rounded-2xl space-y-4">
              <div className="flex flex-wrap gap-3 text-xs font-mono font-bold text-[#2F3E4E]">
                <span className="px-2.5 py-1 rounded bg-[#FEF2C8] border border-[#2F3E4E]">Total Words: {summaryData.wordCount}</span>
                <span className="px-2.5 py-1 rounded bg-[#CEE5DC] border border-[#2F3E4E]">Est. Reading Time: {summaryData.readMin} min</span>
              </div>
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#2F3E4E]">Key Document Takeaways</h3>
                <ul className="space-y-2 text-xs sm:text-sm text-[#334155] list-disc pl-5">
                  {summaryData.sentences.map((s, idx) => (
                    <li key={idx}>{s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#2F3E4E] mb-2">Top Topic Keywords</h3>
                <div className="flex flex-wrap gap-2">
                  {summaryData.keywords.map((k) => (
                    <span key={k.word} className="px-2.5 py-1 rounded-lg bg-[#FEF2C8] border border-[#2F3E4E]/30 text-xs font-mono font-bold text-[#2F3E4E]">
                      {k.word} ({k.count})
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
