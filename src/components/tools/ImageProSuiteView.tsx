import React, { useEffect, useRef, useState } from 'react';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas-pro';
import Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  CheckCircle,
  Download,
  Eraser,
  FileCheck,
  Image as ImageIcon,
  Loader2,
  Plus,
  RefreshCw,
  ScanText,
  Sliders,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { ToolCatalogItem } from '../../types/tools';
import { canvasToBlob, loadImageElement } from '../../utils/imageProcessing';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface ImageProSuiteViewProps {
  tool: ToolCatalogItem;
}

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

function patchPngDpi(bytes: Uint8Array, dpi: number): Uint8Array {
  const ppm = Math.round(dpi / 0.0254);
  const physData = new Uint8Array(9);
  const dv = new DataView(physData.buffer);
  dv.setUint32(0, ppm, false);
  dv.setUint32(4, ppm, false);
  physData[8] = 1; // meters

  const chunk = new Uint8Array(4 + 4 + 9 + 4);
  const cdv = new DataView(chunk.buffer);
  cdv.setUint32(0, 9, false);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4); // pHYs
  chunk.set(physData, 8);
  cdv.setUint32(17, crc32(chunk.slice(4, 17)), false);

  // Strip existing pHYs chunks if any and insert after IHDR (byte 33 in standard PNG)
  const outParts: Uint8Array[] = [bytes.slice(0, 8)];
  let pos = 8;
  let inserted = false;
  while (pos + 8 <= bytes.length) {
    const len = new DataView(bytes.buffer, bytes.byteOffset + pos, 4).getUint32(0, false);
    const type = String.fromCharCode(bytes[pos + 4], bytes[pos + 5], bytes[pos + 6], bytes[pos + 7]);
    const totalLen = 12 + len;
    if (type !== 'pHYs') {
      outParts.push(bytes.slice(pos, pos + totalLen));
      if (type === 'IHDR' && !inserted) {
        outParts.push(chunk);
        inserted = true;
      }
    }
    pos += totalLen;
    if (type === 'IEND') break;
  }
  const totalBytes = outParts.reduce((s, p) => s + p.length, 0);
  const merged = new Uint8Array(totalBytes);
  let off = 0;
  for (const p of outParts) {
    merged.set(p, off);
    off += p.length;
  }
  return merged;
}

function patchJpegDpi(bytes: Uint8Array, dpi: number): Uint8Array {
  // Verify SOI + APP0 JFIF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff && bytes[3] === 0xe0) {
    const copy = new Uint8Array(bytes);
    copy[13] = 1; // DPI units = dots per inch
    copy[14] = (dpi >> 8) & 0xff;
    copy[15] = dpi & 0xff;
    copy[16] = (dpi >> 8) & 0xff;
    copy[17] = dpi & 0xff;
    return copy;
  }
  // Prepend fresh APP0 JFIF after SOI
  const app0 = new Uint8Array([
    0xff, 0xe0, 0x00, 0x10,
    0x4a, 0x46, 0x49, 0x46, 0x00,
    0x01, 0x01, 0x01,
    (dpi >> 8) & 0xff, dpi & 0xff,
    (dpi >> 8) & 0xff, dpi & 0xff,
    0x00, 0x00,
  ]);
  const out = new Uint8Array(2 + app0.length + (bytes.length - 2));
  out.set(bytes.slice(0, 2), 0);
  out.set(app0, 2);
  out.set(bytes.slice(2), 2 + app0.length);
  return out;
}

function buildIcoFromPngBlob(pngBytes: Uint8Array, size: number): Blob {
  const header = new Uint8Array(6 + 16);
  const dv = new DataView(header.buffer);
  dv.setUint16(0, 0, true);
  dv.setUint16(2, 1, true); // ICO type
  dv.setUint16(4, 1, true); // 1 image
  header[6] = size >= 256 ? 0 : size;
  header[7] = size >= 256 ? 0 : size;
  header[8] = 0;
  header[9] = 0;
  dv.setUint16(10, 1, true);
  dv.setUint16(12, 32, true);
  dv.setUint32(14, pngBytes.length, true);
  dv.setUint32(18, 22, true);
  return new Blob([header as unknown as BlobPart, pngBytes as unknown as BlobPart], {
    type: 'image/x-icon',
  });
}

async function compressCanvasUnderKb(canvas: HTMLCanvasElement, maxKb: number): Promise<Blob> {
  let lo = 0.1;
  let hi = 0.96;
  let best = await canvasToBlob(canvas, 'jpeg', 0.5);
  for (let i = 0; i < 8; i++) {
    const mid = (lo + hi) / 2;
    const trial = await canvasToBlob(canvas, 'jpeg', mid);
    if (trial.size <= maxKb * 1024) {
      best = trial;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return best;
}

const EXAM_PRESETS = [
  { id: 'upsc-photo', label: 'UPSC CSE Photo (350×350, <300 KB)', w: 350, h: 350, maxKb: 250 },
  { id: 'ssc-photo', label: 'SSC CGL / CHSL Photo (200×230, 20–50 KB)', w: 200, h: 230, maxKb: 45 },
  { id: 'ibps-photo', label: 'IBPS / SBI Photo (200×230, 20–50 KB)', w: 200, h: 230, maxKb: 45 },
  { id: 'ssc-sign', label: 'SSC / IBPS Signature (140×60, 10–20 KB)', w: 140, h: 60, maxKb: 18 },
  { id: 'pan-photo', label: 'PAN NSDL Photo (213×213 @ 300DPI, <30 KB)', w: 213, h: 213, maxKb: 28 },
  { id: 'kpsc-thumb', label: 'KPSC / RRB Left Thumb (240×240, <50 KB)', w: 240, h: 240, maxKb: 45 },
];

export const ImageProSuiteView: React.FC<ImageProSuiteViewProps> = ({ tool }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [srcUrl, setSrcUrl] = useState<string>('');
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [outUrl, setOutUrl] = useState<string>('');
  const [outBlob, setOutBlob] = useState<Blob | null>(null);
  const [outName, setOutName] = useState<string>('vcpl-output.png');

  // Chroma BG Remover
  const [chromaColor, setChromaColor] = useState('#FFFFFF');
  const [chromaTol, setChromaTol] = useState(42);
  const [studioBg, setStudioBg] = useState('transparent');

  // Filters Studio
  const [fltBright, setFltBright] = useState(100);
  const [fltContrast, setFltContrast] = useState(100);
  const [fltSat, setFltSat] = useState(100);
  const [fltGray, setFltGray] = useState(0);
  const [fltSepia, setFltSepia] = useState(0);
  const [fltBlur, setFltBlur] = useState(0);

  // Upscaler
  const [upscaleFactor, setUpscaleFactor] = useState<2 | 3>(2);
  const [sharpenStrength, setSharpenStrength] = useState(0.5);

  // EXIF & DPI
  const [exifInfo, setExifInfo] = useState<string>('');
  const [targetDpi, setTargetDpi] = useState<number>(300);

  // Converter
  const [convFormat, setConvFormat] = useState<'png' | 'jpeg' | 'webp' | 'ico'>('png');

  // Passport Sheet
  const [passportBg, setPassportBg] = useState('#FFFFFF');
  const [passportCopies, setPassportCopies] = useState<number>(8);

  // Signature Pad
  const sigCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const [sigPenColor, setSigPenColor] = useState('#0F172A');
  const [sigThreshold, setSigThreshold] = useState(190);

  // Collage
  const [collageUrls, setCollageUrls] = useState<string[]>([]);
  const [collageLayout, setCollageLayout] = useState<'2x1' | '2x2' | '3x2' | '3x3'>('2x2');
  const [collageGap, setCollageGap] = useState(16);

  // Meme
  const [memeTop, setMemeTop] = useState('WHEN FORM 26AS RECONCILES');
  const [memeBottom, setMemeBottom] = useState('100% ON THE FIRST CLICK');

  // HTML to Image
  const [htmlSnippet, setHtmlSnippet] = useState(
    '<div style="width:520px;padding:28px;background:#FEF2C8;border:2px solid #2F3E4E;border-radius:16px;font-family:sans-serif;color:#2F3E4E;">\n  <div style="font-size:11px;font-weight:bold;color:#12805C;">VERIFIED RECORD · VCPL TOOLS</div>\n  <h2 style="margin:6px 0 4px;">GST &amp; Banking Automation Ready</h2>\n  <p style="margin:0;font-size:13px;color:#475569;">Generated completely offline inside your browser.</p>\n</div>'
  );
  const htmlRenderRef = useRef<HTMLDivElement | null>(null);

  // Privacy Blur Boxes
  const blurCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [blurMode, setBlurMode] = useState<'blur' | 'pixelate' | 'blackout'>('blur');
  const [blurBoxes, setBlurBoxes] = useState<{ x: number; y: number; w: number; h: number }[]>([]);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  // Grid Splitter
  const [gridRows, setGridRows] = useState(3);
  const [gridCols, setGridCols] = useState(3);

  // Govt Exam / Declaration / ID Merger / OCR / Checker
  const [selectedExamPreset, setSelectedExamPreset] = useState(EXAM_PRESETS[0].id);
  const [declExam, setDeclExam] = useState<'ibps' | 'sbi' | 'rrb'>('ibps');
  const [declCandidate, setDeclCandidate] = useState('');
  const [idBackUrl, setIdBackUrl] = useState('');
  const [idBackImg, setIdBackImg] = useState<HTMLImageElement | null>(null);
  const [ocrLang, setOcrLang] = useState<'eng' | 'hin' | 'kan' | 'eng+hin'>('eng');
  const [ocrOutput, setOcrOutput] = useState('');
  const [invoiceRows, setInvoiceRows] = useState<Record<string, string>[]>([]);
  const [checkerInfo, setCheckerInfo] = useState<{ kb: number; w: number; h: number; type: string } | null>(null);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setFiles([]);
    setSrcUrl('');
    setImgEl(null);
    setOutUrl('');
    setOutBlob(null);
    setStatus('');
    setBlurBoxes([]);
    setExifInfo('');
    setOcrOutput('');
    setInvoiceRows([]);
    setCheckerInfo(null);
    setIdBackUrl('');
    setIdBackImg(null);
    setCollageUrls([]);
  }, [tool.id]);

  const setResultBlob = (blob: Blob, name: string, msg?: string) => {
    if (outUrl) URL.revokeObjectURL(outUrl);
    setOutBlob(blob);
    setOutUrl(URL.createObjectURL(blob));
    setOutName(name);
    if (msg) setStatus(msg);
  };

  const handleSingleFile = async (file: File) => {
    setFiles([file]);
    const url = URL.createObjectURL(file);
    setSrcUrl(url);
    setStatus('');

    if (tool.id === 'exam-portal-checker') {
      if (file.type === 'application/pdf') {
        setCheckerInfo({ kb: Math.round(file.size / 1024), w: 0, h: 0, type: 'PDF Document' });
        return;
      }
      const im = await loadImageElement(url);
      setImgEl(im);
      setCheckerInfo({
        kb: Math.max(1, Math.round(file.size / 1024)),
        w: im.naturalWidth,
        h: im.naturalHeight,
        type: file.type || 'Image',
      });
      return;
    }

    if (tool.id === 'image-exif-cleaner') {
      const buf = new Uint8Array(await file.arrayBuffer());
      const hasExif = buf.some((_, i) => buf[i] === 0xff && buf[i + 1] === 0xe1);
      setExifInfo(
        hasExif
          ? `Detected EXIF / APP1 metadata segment (${Math.round(file.size / 1024)} KB ${file.type}). Ready to strip.`
          : `No JPEG EXIF APP1 block found (${Math.round(file.size / 1024)} KB ${file.type}). Clean export available.`
      );
    }

    if (file.type.startsWith('image/')) {
      const im = await loadImageElement(url);
      setImgEl(im);
    }
  };

  // Live render Effects for Canvas-driven previews
  useEffect(() => {
    if (!imgEl || !previewCanvasRef.current) return;
    const c = previewCanvasRef.current;
    const w = imgEl.naturalWidth;
    const h = imgEl.naturalHeight;
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d')!;

    if (tool.id === 'image-filters-studio') {
      ctx.filter = `brightness(${fltBright}%) contrast(${fltContrast}%) saturate(${fltSat}%) grayscale(${fltGray}%) sepia(${fltSepia}%) blur(${fltBlur}px)`;
      ctx.drawImage(imgEl, 0, 0);
      ctx.filter = 'none';
    } else if (tool.id === 'image-meme-generator') {
      ctx.drawImage(imgEl, 0, 0);
      const fs = Math.max(24, Math.round(w / 14));
      ctx.font = `900 ${fs}px Impact, "Plus Jakarta Sans", sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = Math.max(3, Math.round(fs / 8));
      if (memeTop.trim()) {
        ctx.strokeText(memeTop.toUpperCase(), w / 2, fs + 16, w - 32);
        ctx.fillText(memeTop.toUpperCase(), w / 2, fs + 16, w - 32);
      }
      if (memeBottom.trim()) {
        ctx.strokeText(memeBottom.toUpperCase(), w / 2, h - 24, w - 32);
        ctx.fillText(memeBottom.toUpperCase(), w / 2, h - 24, w - 32);
      }
    } else if (tool.id === 'exam-doc-scanner') {
      ctx.drawImage(imgEl, 0, 0);
      const id = ctx.getImageData(0, 0, w, h);
      const d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        const v = lum > 155 ? 255 : Math.max(0, Math.round((lum - 30) * 1.35));
        d[i] = v;
        d[i + 1] = v;
        d[i + 2] = v;
      }
      ctx.putImageData(id, 0, 0);
    }
  }, [tool.id, imgEl, fltBright, fltContrast, fltSat, fltGray, fltSepia, fltBlur, memeTop, memeBottom]);

  // Privacy blur canvas draw
  useEffect(() => {
    if (tool.id !== 'image-blur-privacy' || !imgEl || !blurCanvasRef.current) return;
    const c = blurCanvasRef.current;
    c.width = imgEl.naturalWidth;
    c.height = imgEl.naturalHeight;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(imgEl, 0, 0);

    for (const b of blurBoxes) {
      if (b.w <= 2 || b.h <= 2) continue;
      if (blurMode === 'blackout') {
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(b.x, b.y, b.w, b.h);
      } else if (blurMode === 'pixelate') {
        const step = Math.max(8, Math.round(Math.min(b.w, b.h) / 8));
        for (let py = b.y; py < b.y + b.h; py += step) {
          for (let px = b.x; px < b.x + b.w; px += step) {
            const p = ctx.getImageData(Math.min(c.width - 1, Math.round(px)), Math.min(c.height - 1, Math.round(py)), 1, 1).data;
            ctx.fillStyle = `rgb(${p[0]},${p[1]},${p[2]})`;
            ctx.fillRect(px, py, step, step);
          }
        }
      } else {
        ctx.save();
        ctx.beginPath();
        ctx.rect(b.x, b.y, b.w, b.h);
        ctx.clip();
        ctx.filter = 'blur(14px)';
        ctx.drawImage(imgEl, 0, 0);
        ctx.restore();
      }
    }
  }, [tool.id, imgEl, blurBoxes, blurMode]);

  const headerBanner = (
    <div className="pb-5 border-b border-[#2F3E4E]/15">
      <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] flex items-center gap-1.5">
        <ImageIcon className="w-3.5 h-3.5 text-[#2F3E4E]" />
        {tool.categoryName} · {tool.code}
      </span>
      <h1 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] mt-1">{tool.title}</h1>
      <p className="text-xs sm:text-sm text-[#475569] mt-0.5">{tool.description}</p>
    </div>
  );

  const downloadBar = outUrl && (
    <div className="p-4 rounded-xl bg-[#CEE5DC]/65 border-[1.5px] border-[#2F3E4E] flex flex-wrap items-center justify-between gap-3">
      <span className="text-xs font-bold text-[#2F3E4E] flex items-center gap-1.5">
        <CheckCircle className="w-4 h-4 text-emerald-700" />
        {status || `Ready: ${outName} (${outBlob ? Math.max(1, Math.round(outBlob.size / 1024)) : 0} KB)`}
      </span>
      <a
        href={outUrl}
        download={outName}
        className="px-4 py-2 rounded-xl bg-[#2F3E4E] text-[#FFFDF5] text-xs font-bold inline-flex items-center gap-1.5"
      >
        <Download className="w-3.5 h-3.5" /> Download Output
      </a>
    </div>
  );

  // -------------------------------------------------------------------------
  // SIGNATURE PAD & PAPER SCAN RESIZER
  // -------------------------------------------------------------------------
  if (tool.id === 'image-signature-resizer') {
    const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const c = sigCanvasRef.current;
      if (!c) return;
      isDrawingRef.current = true;
      const rect = c.getBoundingClientRect();
      const ctx = c.getContext('2d')!;
      ctx.strokeStyle = sigPenColor;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(((e.clientX - rect.left) / rect.width) * c.width, ((e.clientY - rect.top) / rect.height) * c.height);
    };
    const moveDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current || !sigCanvasRef.current) return;
      const c = sigCanvasRef.current;
      const rect = c.getBoundingClientRect();
      const ctx = c.getContext('2d')!;
      ctx.lineTo(((e.clientX - rect.left) / rect.width) * c.width, ((e.clientY - rect.top) / rect.height) * c.height);
      ctx.stroke();
    };
    const clearSig = () => {
      const c = sigCanvasRef.current;
      if (!c) return;
      const ctx = c.getContext('2d')!;
      ctx.clearRect(0, 0, c.width, c.height);
    };
    const exportSignature = async (transparent: boolean, maxKb?: number) => {
      const srcCanvas = document.createElement('canvas');
      srcCanvas.width = 420;
      srcCanvas.height = 180;
      const sctx = srcCanvas.getContext('2d')!;
      if (!transparent) {
        sctx.fillStyle = '#FFFFFF';
        sctx.fillRect(0, 0, 420, 180);
      }
      if (imgEl) {
        sctx.drawImage(imgEl, 0, 0, 420, 180);
        const id = sctx.getImageData(0, 0, 420, 180);
        for (let i = 0; i < id.data.length; i += 4) {
          const lum = 0.299 * id.data[i] + 0.587 * id.data[i + 1] + 0.114 * id.data[i + 2];
          if (lum > sigThreshold) {
            if (transparent) id.data[i + 3] = 0;
            else id.data[i] = id.data[i + 1] = id.data[i + 2] = 255;
          }
        }
        sctx.putImageData(id, 0, 0);
      } else if (sigCanvasRef.current) {
        sctx.drawImage(sigCanvasRef.current, 0, 0);
      }
      const blob = maxKb ? await compressCanvasUnderKb(srcCanvas, maxKb) : await canvasToBlob(srcCanvas, transparent ? 'png' : 'jpeg', 0.92);
      setResultBlob(blob, transparent ? 'signature_transparent.png' : 'signature_exam_ready.jpg');
    };

    return (
      <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-6 sm:p-8 space-y-6">
        {headerBanner}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-bold">
              <span>Draw Digital Signature Pad</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setSigPenColor('#0F172A')} className="px-2 py-1 rounded border bg-white cursor-pointer">Black Ink</button>
                <button type="button" onClick={() => setSigPenColor('#1E40AF')} className="px-2 py-1 rounded border bg-white text-blue-800 cursor-pointer">Blue Ink</button>
                <button type="button" onClick={clearSig} className="px-2 py-1 rounded border bg-white text-rose-700 cursor-pointer">Clear</button>
              </div>
            </div>
            <canvas
              ref={sigCanvasRef}
              width={420}
              height={180}
              onPointerDown={startDraw}
              onPointerMove={moveDraw}
              onPointerUp={() => { isDrawingRef.current = false; }}
              onPointerLeave={() => { isDrawingRef.current = false; }}
              className="w-full h-44 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white touch-none cursor-crosshair"
            />
          </div>

          <div className="space-y-3 text-xs">
            <label className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-[#2F3E4E]/45 rounded-xl bg-[#FEF2C8]/45 cursor-pointer text-center">
              <UploadCloud className="w-6 h-6 text-[#2F3E4E] mb-1.5" />
              <span className="font-bold text-[#2F3E4E]">Or Upload Paper-Scanned Signature Photo</span>
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleSingleFile(f); }} />
            </label>
            <div>
              <label className="block font-bold text-[#2F3E4E] mb-1">Paper Whitening Threshold ({sigThreshold})</label>
              <input type="range" min={110} max={245} value={sigThreshold} onChange={(e) => setSigThreshold(Number(e.target.value))} className="w-full" />
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <button type="button" onClick={() => void exportSignature(true)} className="px-4 py-2 rounded-xl bg-[#2F3E4E] text-white font-bold cursor-pointer">
                Export Transparent PNG
              </button>
              <button type="button" onClick={() => void exportSignature(false, 20)} className="px-4 py-2 rounded-xl bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] text-[#2F3E4E] font-bold cursor-pointer">
                Export &lt;20 KB Exam JPG
              </button>
            </div>
          </div>
        </div>
        {downloadBar}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // HTML TO IMAGE
  // -------------------------------------------------------------------------
  if (tool.id === 'html-to-image') {
    const captureHtml = async () => {
      if (!htmlRenderRef.current) return;
      setBusy(true);
      try {
        const canvas = await html2canvas(htmlRenderRef.current, { scale: 2, backgroundColor: null });
        const blob = await canvasToBlob(canvas, 'png', 1);
        setResultBlob(blob, 'vcpl-rendered-card.png', `Rendered ${canvas.width}×${canvas.height}px at 2× DPI.`);
      } finally {
        setBusy(false);
      }
    };
    return (
      <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-6 sm:p-8 space-y-6">
        {headerBanner}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          <textarea rows={10} value={htmlSnippet} onChange={(e) => setHtmlSnippet(e.target.value)} className="w-full p-4 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white font-mono text-xs" />
          <div className="lg:sticky lg:top-20 p-5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white flex items-center justify-center overflow-hidden">
            <div ref={htmlRenderRef} className="max-w-full" dangerouslySetInnerHTML={{ __html: htmlSnippet }} />
          </div>
        </div>
        <button type="button" disabled={busy} onClick={() => void captureHtml()} className="px-5 py-2.5 rounded-xl bg-[#2F3E4E] text-white text-xs font-bold cursor-pointer">
          {busy ? 'Rendering...' : 'Render 2× DPI PNG'}
        </button>
        {downloadBar}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // HANDWRITTEN DECLARATION MAKER (IBPS / SBI / RRB)
  // -------------------------------------------------------------------------
  if (tool.id === 'handwritten-declaration-maker') {
    const nameToken = declCandidate.trim() || 'CANDIDATE NAME';
    const wording =
      declExam === 'sbi'
        ? `“I, ${nameToken} (Name of the candidate), Date of Birth __________, hereby declare that all the information submitted by me in the application form is correct, true and valid. I will present the supporting documents as and when required. The signature, photograph and left thumb impression is of mine.”`
        : `“I, ${nameToken}, hereby declare that all the information submitted by me in the application form is correct, true and valid. I will present the supporting documents as and when required.”`;

    const exportDeclImage = async () => {
      const c = document.createElement('canvas');
      c.width = 800;
      c.height = 400;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, 800, 400);
      ctx.fillStyle = '#1E293B';
      ctx.font = 'italic 24px Georgia, serif';
      const words = wording.replace(/[“”]/g, '').split(' ');
      let line = '';
      let y = 85;
      for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        if (ctx.measureText(test).width > 710) {
          ctx.fillText(line, 45, y);
          line = w;
          y += 42;
        } else {
          line = test;
        }
      }
      if (line) ctx.fillText(line, 45, y);
      const blob = await compressCanvasUnderKb(c, 90);
      setResultBlob(blob, `${declExam}_declaration_800x400.jpg`, 'Generated 800×400 px under 100 KB JPG.');
    };

    return (
      <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-6 sm:p-8 space-y-6">
        {headerBanner}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-bold text-[#2F3E4E] mb-1">Exam Notification Format</label>
            <select value={declExam} onChange={(e) => setDeclExam(e.target.value as typeof declExam)} className="w-full px-3.5 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white font-bold">
              <option value="ibps">IBPS PO / Clerk / SO Official Declaration</option>
              <option value="sbi">SBI PO / Clerk Official Declaration (incl. DOB)</option>
              <option value="rrb">IBPS RRB Officer / Office Assistant</option>
            </select>
          </div>
          <div>
            <label className="block font-bold text-[#2F3E4E] mb-1">Candidate Full Name (Per Aadhaar/10th)</label>
            <input value={declCandidate} onChange={(e) => setDeclCandidate(e.target.value)} placeholder="Enter Full Name" className="w-full px-3.5 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white font-bold" />
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-white border-[1.5px] border-[#2F3E4E] space-y-2">
          <span className="text-[11px] font-bold uppercase text-[#12805C]">Official Copy-to-Paper Wording (Write in Black Ink on White Paper)</span>
          <p className="font-serif text-base leading-relaxed text-[#2F3E4E]">{wording}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => void exportDeclImage()} className="px-5 py-2.5 rounded-xl bg-[#2F3E4E] text-white text-xs font-bold cursor-pointer">
            Generate 800×400 Reference Sheet (&lt;100 KB)
          </button>
        </div>
        {downloadBar}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // PHOTO COLLAGE MAKER
  // -------------------------------------------------------------------------
  if (tool.id === 'image-collage-maker') {
    const buildCollage = async () => {
      if (collageUrls.length === 0) return;
      setBusy(true);
      try {
        const imgs = await Promise.all(collageUrls.map(loadImageElement));
        const cols = collageLayout === '2x1' || collageLayout === '2x2' ? 2 : 3;
        const rows = collageLayout === '2x1' ? 1 : collageLayout === '3x3' ? 3 : 2;
        const cellW = 540;
        const cellH = 420;
        const W = cols * cellW + (cols + 1) * collageGap;
        const H = rows * cellH + (rows + 1) * collageGap;
        const c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = '#FEF2C8';
        ctx.fillRect(0, 0, W, H);

        for (let r = 0; r < rows; r++) {
          for (let col = 0; col < cols; col++) {
            const idx = r * cols + col;
            const img = imgs[idx % imgs.length];
            const x = collageGap + col * (cellW + collageGap);
            const y = collageGap + r * (cellH + collageGap);
            const scale = Math.max(cellW / img.naturalWidth, cellH / img.naturalHeight);
            const dw = img.naturalWidth * scale;
            const dh = img.naturalHeight * scale;
            ctx.save();
            ctx.beginPath();
            ctx.rect(x, y, cellW, cellH);
            ctx.clip();
            ctx.drawImage(img, x + (cellW - dw) / 2, y + (cellH - dh) / 2, dw, dh);
            ctx.restore();
          }
        }
        const blob = await canvasToBlob(c, 'png', 0.95);
        setResultBlob(blob, 'vcpl-collage.png', `Built ${W}×${H}px grid collage.`);
      } finally {
        setBusy(false);
      }
    };

    return (
      <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-6 sm:p-8 space-y-6">
        {headerBanner}
        <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-[#2F3E4E]/45 rounded-2xl bg-[#FEF2C8]/45 cursor-pointer text-center">
          <UploadCloud className="w-7 h-7 text-[#2F3E4E] mb-2" />
          <span className="text-sm font-bold text-[#2F3E4E]">Upload 2 to 9 Photos for Grid Collage ({collageUrls.length} loaded)</span>
          <input
            type="file"
            multiple
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const list = Array.from(e.target.files || []).slice(0, 9);
              setCollageUrls(list.map((f) => URL.createObjectURL(f)));
            }}
          />
        </label>
        <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
          {(['2x1', '2x2', '3x2', '3x3'] as const).map((lay) => (
            <button key={lay} type="button" onClick={() => setCollageLayout(lay)} className={`px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] cursor-pointer ${collageLayout === lay ? 'bg-[#2F3E4E] text-white' : 'bg-white'}`}>
              {lay} Grid
            </button>
          ))}
          <label className="flex items-center gap-2 ml-2">
            <span>Gap ({collageGap}px):</span>
            <input type="range" min={0} max={40} value={collageGap} onChange={(e) => setCollageGap(Number(e.target.value))} />
          </label>
          <button type="button" disabled={busy || collageUrls.length === 0} onClick={() => void buildCollage()} className="ml-auto px-5 py-2.5 rounded-xl bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] text-[#2F3E4E] cursor-pointer disabled:opacity-40">
            Generate Collage
          </button>
        </div>
        {downloadBar}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // IMAGE & INVOICE OCR TOOLS (tesseract.js)
  // -------------------------------------------------------------------------
  if (tool.id === 'image-to-text-ocr' || tool.id === 'invoice-ocr-extractor') {
    const runOcr = async (fileList: FileList) => {
      setBusy(true);
      setOcrOutput('');
      setInvoiceRows([]);
      try {
        const collectedText: string[] = [];
        const parsedInvoices: Record<string, string>[] = [];
        for (const f of Array.from(fileList)) {
          let txt = '';
          if (f.type === 'application/pdf') {
            const pdf = await pdfjsLib.getDocument({ data: await f.arrayBuffer() }).promise;
            const chunks: string[] = [];
            for (let p = 1; p <= Math.min(pdf.numPages, 5); p++) {
              const page = await pdf.getPage(p);
              const tc = await page.getTextContent();
              chunks.push((tc.items as any[]).map((i) => i.str || '').join(' '));
            }
            txt = chunks.join('\n');
          } else {
            const res = await Tesseract.recognize(f, ocrLang);
            txt = res.data.text;
          }
          collectedText.push(`=== ${f.name} ===\n${txt}`);

          if (tool.id === 'invoice-ocr-extractor') {
            const gstins = txt.match(/\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/g) || [];
            const invNo = txt.match(/(?:Invoice\s*(?:No|#|Number)[:\s.-]*)([A-Z0-9\/-]{3,25})/i)?.[1] || 'N/A';
            const date = txt.match(/\b(\d{2}[\/-]\d{2}[\/-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/)?.[1] || 'N/A';
            const total = txt.match(/(?:Grand\s*Total|Total\s*Amount|Net\s*Payable)[:\s₹Rs.]*([0-9,]+\.\d{2}|[0-9,]+)/i)?.[1] || 'Review';
            parsedInvoices.push({
              File: f.name,
              Invoice_No: invNo,
              Date: date,
              Supplier_GSTIN: gstins[0] || 'Not Found',
              Buyer_GSTIN: gstins[1] || '—',
              Total_Amount: total,
            });
          }
        }
        setOcrOutput(collectedText.join('\n\n'));
        setInvoiceRows(parsedInvoices);
        setStatus(`OCR completed on ${fileList.length} file(s).`);
      } finally {
        setBusy(false);
      }
    };

    return (
      <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-6 sm:p-8 space-y-6">
        {headerBanner}
        <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
          <span>Language:</span>
          {[
            { k: 'eng' as const, label: 'English' },
            { k: 'hin' as const, label: 'Hindi हिन्दी' },
            { k: 'kan' as const, label: 'Kannada ಕನ್ನಡ' },
            { k: 'eng+hin' as const, label: 'English + Hindi' },
          ].map((l) => (
            <button key={l.k} type="button" onClick={() => setOcrLang(l.k)} className={`px-3 py-1.5 rounded-lg border border-[#2F3E4E] cursor-pointer ${ocrLang === l.k ? 'bg-[#2F3E4E] text-white' : 'bg-white'}`}>
              {l.label}
            </button>
          ))}
        </div>

        <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-[#2F3E4E]/45 rounded-2xl bg-[#FEF2C8]/45 cursor-pointer text-center">
          {busy ? <Loader2 className="w-7 h-7 animate-spin text-[#2F3E4E] mb-2" /> : <ScanText className="w-7 h-7 text-[#2F3E4E] mb-2" />}
          <span className="text-sm font-bold text-[#2F3E4E]">
            {busy ? 'Running Tesseract OCR Engine...' : tool.id === 'invoice-ocr-extractor' ? 'Upload GST Invoice Images / PDFs (Batch Supported)' : 'Upload Single or Batch Images to Extract Text'}
          </span>
          <input type="file" multiple accept={tool.id === 'invoice-ocr-extractor' ? 'image/*,.pdf' : 'image/*'} className="sr-only" onChange={(e) => { if (e.target.files?.length) void runOcr(e.target.files); }} />
        </label>

        {invoiceRows.length > 0 && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(invoiceRows), 'OCR_Invoices');
                  XLSX.writeFile(wb, 'OCR_Invoices_Extract.xlsx');
                }}
                className="px-4 py-2 rounded-xl bg-[#2F3E4E] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Export Extracted Excel (.XLSX)
              </button>
            </div>
            <div className="rounded-xl border-[1.5px] border-[#2F3E4E] overflow-x-auto bg-white">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#2F3E4E] text-white">
                  <tr>
                    <th className="py-2 px-3">File</th>
                    <th className="py-2 px-3">Invoice No</th>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Supplier GSTIN</th>
                    <th className="py-2 px-3">Total Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2F3E4E]/10">
                  {invoiceRows.map((r, i) => (
                    <tr key={i}>
                      <td className="py-2 px-3 font-bold">{r.File}</td>
                      <td className="py-2 px-3 font-mono">{r.Invoice_No}</td>
                      <td className="py-2 px-3 font-mono">{r.Date}</td>
                      <td className="py-2 px-3 font-mono text-[#12805C] font-bold">{r.Supplier_GSTIN}</td>
                      <td className="py-2 px-3 font-mono font-bold">₹{r.Total_Amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {ocrOutput && (
          <textarea
            rows={10}
            value={ocrOutput}
            onChange={(e) => setOcrOutput(e.target.value)}
            className="w-full p-4 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white font-mono text-xs"
          />
        )}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // SINGLE IMAGE UPLOAD TOOLS (Color BG Remover, Filters, Upscaler, EXIF, Converter, Passport Sheet, DPI, Privacy Blur, Grid Split, Exam Photo, ID Merger, Exam Doc Scanner, Portal Checker)
  // -------------------------------------------------------------------------
  const runSingleImageAction = async () => {
    if (!imgEl && !files[0]) return;
    setBusy(true);
    try {
      const f = files[0];
      const base = (f?.name || 'image').replace(/\.[^.]+$/, '');

      if (tool.id === 'image-color-bg-remover' && imgEl) {
        const c = document.createElement('canvas');
        c.width = imgEl.naturalWidth;
        c.height = imgEl.naturalHeight;
        const ctx = c.getContext('2d')!;
        ctx.drawImage(imgEl, 0, 0);
        const id = ctx.getImageData(0, 0, c.width, c.height);
        const rT = parseInt(chromaColor.slice(1, 3), 16);
        const gT = parseInt(chromaColor.slice(3, 5), 16);
        const bT = parseInt(chromaColor.slice(5, 7), 16);
        for (let i = 0; i < id.data.length; i += 4) {
          const d = Math.hypot(id.data[i] - rT, id.data[i + 1] - gT, id.data[i + 2] - bT);
          if (d <= chromaTol * 2.2) id.data[i + 3] = 0;
        }
        ctx.putImageData(id, 0, 0);
        if (studioBg !== 'transparent') {
          const outC = document.createElement('canvas');
          outC.width = c.width;
          outC.height = c.height;
          const octx = outC.getContext('2d')!;
          octx.fillStyle = studioBg;
          octx.fillRect(0, 0, outC.width, outC.height);
          octx.drawImage(c, 0, 0);
          setResultBlob(await canvasToBlob(outC, 'png', 1), `${base}_studio.png`);
        } else {
          setResultBlob(await canvasToBlob(c, 'png', 1), `${base}_transparent.png`);
        }
      } else if ((tool.id === 'image-filters-studio' || tool.id === 'image-meme-generator' || tool.id === 'exam-doc-scanner') && previewCanvasRef.current) {
        const blob = await canvasToBlob(previewCanvasRef.current, 'png', 0.95);
        setResultBlob(blob, `${base}_edited.png`);
      } else if (tool.id === 'image-upscaler' && imgEl) {
        const nw = imgEl.naturalWidth * upscaleFactor;
        const nh = imgEl.naturalHeight * upscaleFactor;
        const c = document.createElement('canvas');
        c.width = nw;
        c.height = nh;
        const ctx = c.getContext('2d')!;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(imgEl, 0, 0, nw, nh);
        if (sharpenStrength > 0) {
          const src = ctx.getImageData(0, 0, nw, nh);
          const out = ctx.createImageData(nw, nh);
          const s = src.data;
          const o = out.data;
          const k = sharpenStrength;
          for (let y = 1; y < nh - 1; y++) {
            for (let x = 1; x < nw - 1; x++) {
              const idx = (y * nw + x) * 4;
              for (let ch = 0; ch < 3; ch++) {
                const blur = (s[idx - 4 + ch] + s[idx + 4 + ch] + s[idx - nw * 4 + ch] + s[idx + nw * 4 + ch]) * 0.25;
                o[idx + ch] = Math.max(0, Math.min(255, Math.round(s[idx + ch] + k * (s[idx + ch] - blur))));
              }
              o[idx + 3] = s[idx + 3];
            }
          }
          ctx.putImageData(out, 0, 0);
        }
        setResultBlob(await canvasToBlob(c, 'png', 1), `${base}_${upscaleFactor}x.png`, `Upscaled cleanly to ${nw}×${nh} px.`);
      } else if (tool.id === 'image-exif-cleaner' && imgEl) {
        const c = document.createElement('canvas');
        c.width = imgEl.naturalWidth;
        c.height = imgEl.naturalHeight;
        c.getContext('2d')!.drawImage(imgEl, 0, 0);
        const blob = await canvasToBlob(c, f?.type.includes('png') ? 'png' : 'jpeg', 0.94);
        setResultBlob(blob, `${base}_clean_no_exif.${f?.type.includes('png') ? 'png' : 'jpg'}`, 'Stripped EXIF GPS, camera model, serials & XMP.');
      } else if (tool.id === 'image-heic-converter' && imgEl) {
        const c = document.createElement('canvas');
        c.width = convFormat === 'ico' ? 64 : imgEl.naturalWidth;
        c.height = convFormat === 'ico' ? 64 : imgEl.naturalHeight;
        const ctx = c.getContext('2d')!;
        if (convFormat === 'jpeg') {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, c.width, c.height);
        }
        ctx.drawImage(imgEl, 0, 0, c.width, c.height);
        if (convFormat === 'ico') {
          const pngBlob = await canvasToBlob(c, 'png', 1);
          const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());
          setResultBlob(buildIcoFromPngBlob(pngBytes, 64), `${base}.ico`);
        } else {
          setResultBlob(await canvasToBlob(c, convFormat, 0.92), `${base}.${convFormat === 'jpeg' ? 'jpg' : convFormat}`);
        }
      } else if (tool.id === 'image-passport-sheet' && imgEl) {
        // A4 at 150 DPI = 1240 x 1754; each 3.5x4.5cm = 207 x 266 px
        const sheet = document.createElement('canvas');
        sheet.width = 1240;
        sheet.height = 1754;
        const ctx = sheet.getContext('2d')!;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, 1240, 1754);
        const pw = 225;
        const ph = 290;
        const cols = 4;
        const gap = 36;
        const startX = (1240 - (cols * pw + (cols - 1) * gap)) / 2;
        for (let i = 0; i < passportCopies; i++) {
          const r = Math.floor(i / cols);
          const cIdx = i % cols;
          const x = startX + cIdx * (pw + gap);
          const y = 70 + r * (ph + gap);
          ctx.fillStyle = passportBg;
          ctx.fillRect(x, y, pw, ph);
          const scale = Math.max(pw / imgEl.naturalWidth, ph / imgEl.naturalHeight);
          const dw = imgEl.naturalWidth * scale;
          const dh = imgEl.naturalHeight * scale;
          ctx.save();
          ctx.beginPath();
          ctx.rect(x, y, pw, ph);
          ctx.clip();
          ctx.drawImage(imgEl, x + (pw - dw) / 2, y + (ph - dh) / 2, dw, dh);
          ctx.restore();
          ctx.strokeStyle = '#94A3B8';
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, pw, ph);
        }
        setResultBlob(await canvasToBlob(sheet, 'png', 1), `${base}_passport_A4_sheet.png`, `Generated A4 print sheet with ${passportCopies} biometric 3.5×4.5cm copies.`);
      } else if (tool.id === 'image-dpi-changer' && imgEl) {
        const c = document.createElement('canvas');
        c.width = imgEl.naturalWidth;
        c.height = imgEl.naturalHeight;
        c.getContext('2d')!.drawImage(imgEl, 0, 0);
        const isPngFile = f?.type.includes('png');
        const rawBlob = await canvasToBlob(c, isPngFile ? 'png' : 'jpeg', 0.94);
        const rawBytes = new Uint8Array(await rawBlob.arrayBuffer());
        const patched = isPngFile ? patchPngDpi(rawBytes, targetDpi) : patchJpegDpi(rawBytes, targetDpi);
        const out = new Blob([patched as unknown as BlobPart], { type: isPngFile ? 'image/png' : 'image/jpeg' });
        setResultBlob(out, `${base}_${targetDpi}dpi.${isPngFile ? 'png' : 'jpg'}`, `Embedded ${targetDpi} DPI metadata header.`);
      } else if (tool.id === 'image-blur-privacy' && blurCanvasRef.current) {
        setResultBlob(await canvasToBlob(blurCanvasRef.current, 'png', 0.95), `${base}_redacted.png`);
      } else if (tool.id === 'image-grid-splitter' && imgEl) {
        const zip = new JSZip();
        const tileW = Math.floor(imgEl.naturalWidth / gridCols);
        const tileH = Math.floor(imgEl.naturalHeight / gridRows);
        for (let r = 0; r < gridRows; r++) {
          for (let col = 0; col < gridCols; col++) {
            const c = document.createElement('canvas');
            c.width = tileW;
            c.height = tileH;
            c.getContext('2d')!.drawImage(imgEl, col * tileW, r * tileH, tileW, tileH, 0, 0, tileW, tileH);
            const tileBlob = await canvasToBlob(c, 'png', 1);
            zip.file(`tile_r${r + 1}_c${col + 1}.png`, await tileBlob.arrayBuffer());
          }
        }
        setResultBlob(await zip.generateAsync({ type: 'blob' }), `${base}_grid_${gridRows}x${gridCols}.zip`, `Split into ${gridRows * gridCols} carousel tiles.`);
      } else if (tool.id === 'govt-exam-photo-studio' && imgEl) {
        const preset = EXAM_PRESETS.find((p) => p.id === selectedExamPreset) || EXAM_PRESETS[0];
        const c = document.createElement('canvas');
        c.width = preset.w;
        c.height = preset.h;
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, preset.w, preset.h);
        const scale = Math.max(preset.w / imgEl.naturalWidth, preset.h / imgEl.naturalHeight);
        const dw = imgEl.naturalWidth * scale;
        const dh = imgEl.naturalHeight * scale;
        ctx.drawImage(imgEl, (preset.w - dw) / 2, (preset.h - dh) / 2, dw, dh);
        const blob = await compressCanvasUnderKb(c, preset.maxKb);
        setResultBlob(blob, `${preset.id}_${preset.w}x${preset.h}.jpg`, `Formatted to ${preset.w}×${preset.h}px (${Math.round(blob.size / 1024)} KB ≤ ${preset.maxKb} KB limit).`);
      } else if (tool.id === 'id-card-merger' && imgEl) {
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([595.28, 841.89]);
        const drawCardOnCanvas = (im: HTMLImageElement) => {
          const c = document.createElement('canvas');
          c.width = im.naturalWidth;
          c.height = im.naturalHeight;
          c.getContext('2d')!.drawImage(im, 0, 0);
          return c.toDataURL('image/png');
        };
        const frontBytes = await fetch(drawCardOnCanvas(imgEl)).then((r) => r.arrayBuffer());
        const frontEmbedded = await pdfDoc.embedPng(frontBytes);
        page.drawImage(frontEmbedded, { x: 112, y: 470, width: 370, height: 235 });
        if (idBackImg) {
          const backBytes = await fetch(drawCardOnCanvas(idBackImg)).then((r) => r.arrayBuffer());
          const backEmbedded = await pdfDoc.embedPng(backBytes);
          page.drawImage(backEmbedded, { x: 112, y: 170, width: 370, height: 235 });
        }
        const pdfBytes = await pdfDoc.save();
        setResultBlob(new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' }), 'ID_Card_Front_Back_A4.pdf', 'Merged ID sides cleanly onto A4 PDF.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-6 sm:p-8 space-y-6">
      {headerBanner}

      <div className={`grid grid-cols-1 ${tool.id === 'id-card-merger' ? 'md:grid-cols-2' : ''} gap-4`}>
        <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-[#2F3E4E]/45 rounded-2xl bg-[#FEF2C8]/45 hover:bg-[#FEF2C8]/75 cursor-pointer text-center">
          <UploadCloud className="w-7 h-7 text-[#2F3E4E] mb-2" />
          <span className="text-sm font-bold text-[#2F3E4E]">
            {files[0] ? `Loaded: ${files[0].name}` : tool.id === 'id-card-merger' ? 'Upload ID Card FRONT Side Photo' : 'Upload Image File (JPG, PNG, WEBP, SVG)'}
          </span>
          <input
            type="file"
            accept={tool.id === 'exam-portal-checker' ? 'image/*,.pdf' : 'image/*'}
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleSingleFile(f);
            }}
          />
        </label>

        {tool.id === 'id-card-merger' && (
          <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-[#2F3E4E]/45 rounded-2xl bg-[#CEE5DC]/45 hover:bg-[#CEE5DC]/75 cursor-pointer text-center">
            <UploadCloud className="w-7 h-7 text-[#2F3E4E] mb-2" />
            <span className="text-sm font-bold text-[#2F3E4E]">
              {idBackImg ? 'Back Side Loaded' : 'Upload ID Card BACK Side Photo'}
            </span>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) {
                  const u = URL.createObjectURL(f);
                  setIdBackUrl(u);
                  setIdBackImg(await loadImageElement(u));
                }
              }}
            />
          </label>
        )}
      </div>

      {/* Exam Portal Size & Format Checker */}
      {tool.id === 'exam-portal-checker' && checkerInfo && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-white border border-[#2F3E4E]/30">
              <span className="text-[#64748B] font-bold block">File Size</span>
              <span className="font-mono font-extrabold text-lg text-[#2F3E4E]">{checkerInfo.kb} KB</span>
            </div>
            <div className="p-3.5 rounded-xl bg-white border border-[#2F3E4E]/30">
              <span className="text-[#64748B] font-bold block">Dimensions</span>
              <span className="font-mono font-extrabold text-lg text-[#2F3E4E]">{checkerInfo.w ? `${checkerInfo.w}×${checkerInfo.h}` : 'PDF'}</span>
            </div>
            <div className="p-3.5 rounded-xl bg-white border border-[#2F3E4E]/30">
              <span className="text-[#64748B] font-bold block">Format</span>
              <span className="font-mono font-extrabold text-sm text-[#2F3E4E]">{checkerInfo.type}</span>
            </div>
            <div className="p-3.5 rounded-xl bg-white border border-[#2F3E4E]/30">
              <span className="text-[#64748B] font-bold block">Est. Print Size (300 DPI)</span>
              <span className="font-mono font-extrabold text-sm text-[#2F3E4E]">
                {checkerInfo.w ? `${((checkerInfo.w / 300) * 2.54).toFixed(1)}×${((checkerInfo.h / 300) * 2.54).toFixed(1)} cm` : 'A4'}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border-[1.5px] border-[#2F3E4E] space-y-2 text-xs">
            <p className="font-bold text-[#2F3E4E] flex items-center gap-1.5">
              <FileCheck className="w-4 h-4 text-[#12805C]" /> Live Indian Govt Portal Compatibility:
            </p>
            {[
              { portal: 'SSC / IBPS / SBI Photo (20–50 KB JPG)', ok: checkerInfo.kb >= 20 && checkerInfo.kb <= 50 && checkerInfo.type.includes('jpeg') },
              { portal: 'SSC / IBPS Signature (10–20 KB JPG)', ok: checkerInfo.kb >= 10 && checkerInfo.kb <= 20 && checkerInfo.type.includes('jpeg') },
              { portal: 'UPSC CSE Photo (20–300 KB JPG)', ok: checkerInfo.kb >= 20 && checkerInfo.kb <= 300 && checkerInfo.type.includes('jpeg') },
              { portal: 'NSDL PAN Photo (<=30 KB, 213×213 px)', ok: checkerInfo.kb <= 30 && checkerInfo.w === 213 && checkerInfo.h === 213 },
            ].map((chk) => (
              <div key={chk.portal} className="flex items-center justify-between py-1.5 border-b border-[#2F3E4E]/10 last:border-0">
                <span>{chk.portal}</span>
                <span className={`px-2 py-0.5 rounded font-bold ${chk.ok ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  {chk.ok ? 'PASS' : 'NEEDS ADJUSTMENT'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Specific Parameter Controls */}
      {imgEl && tool.id !== 'exam-portal-checker' && (
        <div className="space-y-5">
          {tool.id === 'image-color-bg-remover' && (
            <div className="p-4 rounded-xl bg-[#FEF2C8]/65 border border-[#2F3E4E]/30 flex flex-wrap items-center gap-4 text-xs font-bold">
              <label className="flex items-center gap-2">
                <span>Target BG Color:</span>
                <input type="color" value={chromaColor} onChange={(e) => setChromaColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
              </label>
              <label className="flex items-center gap-2">
                <span>Tolerance ({chromaTol}):</span>
                <input type="range" min={10} max={100} value={chromaTol} onChange={(e) => setChromaTol(Number(e.target.value))} />
              </label>
              <label className="flex items-center gap-2">
                <span>Replace With:</span>
                <select value={studioBg} onChange={(e) => setStudioBg(e.target.value)} className="px-2.5 py-1.5 rounded-lg border bg-white">
                  <option value="transparent">Transparent PNG</option>
                  <option value="#FFFFFF">Pure White</option>
                  <option value="#DBEAFE">Passport Sky Blue</option>
                  <option value="#FEF2C8">Cream Studio</option>
                </select>
              </label>
            </div>
          )}

          {tool.id === 'image-filters-studio' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-bold p-4 rounded-xl bg-[#FEF2C8]/65 border border-[#2F3E4E]/30">
                <label>Brightness ({fltBright}%)<input type="range" min={40} max={180} value={fltBright} onChange={(e) => setFltBright(Number(e.target.value))} className="w-full" /></label>
                <label>Contrast ({fltContrast}%)<input type="range" min={40} max={180} value={fltContrast} onChange={(e) => setFltContrast(Number(e.target.value))} className="w-full" /></label>
                <label>Saturation ({fltSat}%)<input type="range" min={0} max={200} value={fltSat} onChange={(e) => setFltSat(Number(e.target.value))} className="w-full" /></label>
                <label>Grayscale ({fltGray}%)<input type="range" min={0} max={100} value={fltGray} onChange={(e) => setFltGray(Number(e.target.value))} className="w-full" /></label>
                <label>Sepia ({fltSepia}%)<input type="range" min={0} max={100} value={fltSepia} onChange={(e) => setFltSepia(Number(e.target.value))} className="w-full" /></label>
                <label>Blur ({fltBlur}px)<input type="range" min={0} max={12} value={fltBlur} onChange={(e) => setFltBlur(Number(e.target.value))} className="w-full" /></label>
              </div>
              <canvas ref={previewCanvasRef} className="max-w-full w-auto h-auto max-h-72 mx-auto rounded-xl border border-[#2F3E4E]" />
            </div>
          )}

          {tool.id === 'image-upscaler' && (
            <div className="p-4 rounded-xl bg-[#FEF2C8]/65 border border-[#2F3E4E]/30 flex flex-wrap items-center gap-4 text-xs font-bold">
              <button type="button" onClick={() => setUpscaleFactor(2)} className={`px-3.5 py-1.5 rounded-lg border cursor-pointer ${upscaleFactor === 2 ? 'bg-[#2F3E4E] text-white' : 'bg-white'}`}>2× Upscale</button>
              <button type="button" onClick={() => setUpscaleFactor(3)} className={`px-3.5 py-1.5 rounded-lg border cursor-pointer ${upscaleFactor === 3 ? 'bg-[#2F3E4E] text-white' : 'bg-white'}`}>3× Upscale</button>
              <label className="flex items-center gap-2">
                <span>Edge Sharpen ({sharpenStrength}):</span>
                <input type="range" min={0} max={1} step={0.1} value={sharpenStrength} onChange={(e) => setSharpenStrength(Number(e.target.value))} />
              </label>
            </div>
          )}

          {tool.id === 'image-exif-cleaner' && exifInfo && (
            <div className="p-4 rounded-xl bg-[#CEE5DC]/55 border border-[#2F3E4E] text-xs font-bold text-[#2F3E4E]">{exifInfo}</div>
          )}

          {tool.id === 'image-heic-converter' && (
            <div className="p-4 rounded-xl bg-[#FEF2C8]/65 border border-[#2F3E4E]/30 flex flex-wrap items-center gap-3 text-xs font-bold">
              <span>Target Format:</span>
              {(['png', 'jpeg', 'webp', 'ico'] as const).map((fmt) => (
                <button key={fmt} type="button" onClick={() => setConvFormat(fmt)} className={`px-3.5 py-1.5 rounded-lg border uppercase cursor-pointer ${convFormat === fmt ? 'bg-[#2F3E4E] text-white' : 'bg-white'}`}>
                  {fmt === 'ico' ? '.ICO Favicon' : fmt}
                </button>
              ))}
            </div>
          )}

          {tool.id === 'image-passport-sheet' && (
            <div className="p-4 rounded-xl bg-[#FEF2C8]/65 border border-[#2F3E4E]/30 flex flex-wrap items-center gap-4 text-xs font-bold">
              <label className="flex items-center gap-2">
                <span>Copies on A4:</span>
                <select value={passportCopies} onChange={(e) => setPassportCopies(Number(e.target.value))} className="px-3 py-1.5 rounded-lg border bg-white">
                  {[2, 4, 8, 12, 16].map((n) => <option key={n} value={n}>{n} Photos</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2">
                <span>Backdrop:</span>
                <input type="color" value={passportBg} onChange={(e) => setPassportBg(e.target.value)} className="w-8 h-8 rounded" />
              </label>
            </div>
          )}

          {tool.id === 'image-dpi-changer' && (
            <div className="p-4 rounded-xl bg-[#FEF2C8]/65 border border-[#2F3E4E]/30 flex flex-wrap items-center gap-3 text-xs font-bold">
              <span>Embed Print DPI:</span>
              {[150, 200, 300, 600].map((d) => (
                <button key={d} type="button" onClick={() => setTargetDpi(d)} className={`px-3.5 py-1.5 rounded-lg border cursor-pointer ${targetDpi === d ? 'bg-[#2F3E4E] text-white' : 'bg-white'}`}>
                  {d} DPI
                </button>
              ))}
            </div>
          )}

          {tool.id === 'image-meme-generator' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <input value={memeTop} onChange={(e) => setMemeTop(e.target.value)} placeholder="Top Caption" className="px-3.5 py-2 rounded-xl border border-[#2F3E4E] bg-white font-bold" />
                <input value={memeBottom} onChange={(e) => setMemeBottom(e.target.value)} placeholder="Bottom Caption" className="px-3.5 py-2 rounded-xl border border-[#2F3E4E] bg-white font-bold" />
              </div>
              <canvas ref={previewCanvasRef} className="max-w-full w-auto h-auto max-h-72 mx-auto rounded-xl border border-[#2F3E4E]" />
            </div>
          )}

          {tool.id === 'exam-doc-scanner' && (
            <canvas ref={previewCanvasRef} className="max-w-full w-auto h-auto max-h-72 mx-auto rounded-xl border border-[#2F3E4E]" />
          )}

          {tool.id === 'image-blur-privacy' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                {(['blur', 'pixelate', 'blackout'] as const).map((m) => (
                  <button key={m} type="button" onClick={() => setBlurMode(m)} className={`px-3 py-1.5 rounded-lg border capitalize cursor-pointer ${blurMode === m ? 'bg-[#2F3E4E] text-white' : 'bg-white'}`}>
                    {m}
                  </button>
                ))}
                <button type="button" onClick={() => setBlurBoxes((prev) => prev.slice(0, -1))} className="ml-auto px-3 py-1.5 rounded-lg border bg-white cursor-pointer">
                  Undo Last Box ({blurBoxes.length})
                </button>
              </div>
              <p className="text-[11px] text-[#475569]">Click and drag across faces, Aadhaar numbers, or signatures to redact:</p>
              <canvas
                ref={blurCanvasRef}
                onPointerDown={(e) => {
                  const c = blurCanvasRef.current;
                  if (!c) return;
                  const r = c.getBoundingClientRect();
                  dragStartRef.current = { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
                }}
                onPointerUp={(e) => {
                  const c = blurCanvasRef.current;
                  if (!c || !dragStartRef.current) return;
                  const r = c.getBoundingClientRect();
                  const ex = ((e.clientX - r.left) / r.width) * c.width;
                  const ey = ((e.clientY - r.top) / r.height) * c.height;
                  const sx = dragStartRef.current.x;
                  const sy = dragStartRef.current.y;
                  setBlurBoxes((prev) => [...prev, { x: Math.min(sx, ex), y: Math.min(sy, ey), w: Math.abs(ex - sx), h: Math.abs(ey - sy) }]);
                  dragStartRef.current = null;
                }}
                className="max-w-full max-h-80 mx-auto rounded-xl border-[1.5px] border-[#2F3E4E] cursor-crosshair"
              />
            </div>
          )}

          {tool.id === 'image-grid-splitter' && (
            <div className="p-4 rounded-xl bg-[#FEF2C8]/65 border border-[#2F3E4E]/30 flex flex-wrap items-center gap-4 text-xs font-bold">
              <label className="flex items-center gap-2">Rows:<input type="number" min={1} max={6} value={gridRows} onChange={(e) => setGridRows(Math.max(1, Number(e.target.value) || 1))} className="w-16 px-2 py-1 rounded border bg-white" /></label>
              <label className="flex items-center gap-2">Cols:<input type="number" min={1} max={6} value={gridCols} onChange={(e) => setGridCols(Math.max(1, Number(e.target.value) || 1))} className="w-16 px-2 py-1 rounded border bg-white" /></label>
            </div>
          )}

          {tool.id === 'govt-exam-photo-studio' && (
            <div className="p-4 rounded-xl bg-[#FEF2C8]/65 border border-[#2F3E4E]/30 text-xs font-bold">
              <label className="block mb-1.5">Select Official Recruitment Portal Target:</label>
              <select value={selectedExamPreset} onChange={(e) => setSelectedExamPreset(e.target.value)} className="w-full sm:w-96 px-3.5 py-2.5 rounded-xl border border-[#2F3E4E] bg-white">
                {EXAM_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={() => void runSingleImageAction()}
            className="px-5 py-2.5 rounded-xl bg-[#2F3E4E] hover:bg-[#1E293B] text-[#FFFDF5] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sliders className="w-3.5 h-3.5" />}
            Process &amp; Prepare Output
          </button>
        </div>
      )}

      {downloadBar}
    </div>
  );
};
