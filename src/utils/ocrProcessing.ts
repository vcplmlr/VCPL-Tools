import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface ImageProcessOptions {
  upscale: boolean;
  grayscaleContrast: boolean;
  binarize: boolean;
  invert: boolean;
  sharpen: boolean;
  brightness: number; // -50 to 50
  contrast: number; // 0.6 to 2.2
  rotation: 0 | 90 | 180 | 270;
  deskewDeg: number; // -15 to 15
  crop?: { x: number; y: number; w: number; h: number } | null; // normalized 0..1
}

export interface ExtractedEntities {
  gstins: string[];
  pans: string[];
  ifscs: string[];
  vins: string[];
  hsns: string[];
  invoiceNos: string[];
  amounts: string[];
  dates: string[];
  emails: string[];
  phones: string[];
  urls: string[];
  tableRows: string[][];
}

export interface OcrWordBox {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

export interface PdfDocProxy {
  numPages: number;
  getPage: (n: number) => Promise<PdfPageProxy>;
}

export interface PdfPageProxy {
  getViewport: (opts: { scale: number }) => { width: number; height: number };
  getTextContent: () => Promise<{
    items: Array<{ str?: string; hasEOL?: boolean; transform?: number[] }>;
  }>;
  render: (opts: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
  }) => { promise: Promise<void> };
}

export async function loadPdfDocument(bytes: Uint8Array): Promise<PdfDocProxy> {
  const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
  return doc as unknown as PdfDocProxy;
}

export function parsePageRange(input: string, totalPages: number): number[] {
  const trimmed = input.trim();
  if (!trimmed) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages = new Set<number>();
  const parts = trimmed.split(',');
  for (const part of parts) {
    const p = part.trim();
    if (!p) continue;
    const rangeMatch = /^(\d+)\s*-\s*(\d+)$/.exec(p);
    if (rangeMatch) {
      const a = Math.max(1, parseInt(rangeMatch[1], 10));
      const b = Math.min(totalPages, parseInt(rangeMatch[2], 10));
      for (let i = Math.min(a, b); i <= Math.max(a, b); i++) {
        if (i >= 1 && i <= totalPages) pages.add(i);
      }
    } else if (/^\d+$/.test(p)) {
      const n = parseInt(p, 10);
      if (n >= 1 && n <= totalPages) pages.add(n);
    }
  }
  if (pages.size === 0) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  return Array.from(pages).sort((a, b) => a - b);
}

export function loadImageFileToCanvas(file: File): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Canvas 2D context unavailable.'));
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Browser could not decode this image. Try PNG or JPG.'));
    };
    img.src = url;
  });
}

function otsuThreshold(gray: Uint8Array): number {
  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  const total = gray.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];

  let sB = 0;
  let wB = 0;
  let best = 0;
  let threshold = 128;

  for (let i = 0; i < 256; i++) {
    wB += hist[i];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sB += i * hist[i];
    const mB = sB / wB;
    const mF = (sum - sB) / wF;
    const variance = wB * wF * (mB - mF) * (mB - mF);
    if (variance > best) {
      best = variance;
      threshold = i;
    }
  }
  return threshold;
}

function applySharpenKernel(
  data: Uint8ClampedArray,
  width: number,
  height: number
): void {
  const copy = new Uint8ClampedArray(data);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        const val =
          5 * copy[idx + c] -
          copy[((y - 1) * width + x) * 4 + c] -
          copy[((y + 1) * width + x) * 4 + c] -
          copy[(y * width + (x - 1)) * 4 + c] -
          copy[(y * width + (x + 1)) * 4 + c];
        data[idx + c] = val < 0 ? 0 : val > 255 ? 255 : val;
      }
    }
  }
}

export function processCanvasForOcr(
  sourceCanvas: HTMLCanvasElement,
  opts: ImageProcessOptions
): HTMLCanvasElement {
  // 1. Apply normalized ROI crop if specified
  let work = sourceCanvas;
  if (opts.crop && opts.crop.w > 0.02 && opts.crop.h > 0.02) {
    const sx = Math.max(0, Math.round(opts.crop.x * work.width));
    const sy = Math.max(0, Math.round(opts.crop.y * work.height));
    const sw = Math.max(8, Math.round(opts.crop.w * work.width));
    const sh = Math.max(8, Math.round(opts.crop.h * work.height));
    const cropped = document.createElement('canvas');
    cropped.width = sw;
    cropped.height = sh;
    const cctx = cropped.getContext('2d');
    if (cctx) {
      cctx.fillStyle = '#ffffff';
      cctx.fillRect(0, 0, sw, sh);
      cctx.drawImage(work, sx, sy, sw, sh, 0, 0, sw, sh);
      work = cropped;
    }
  }

  // 2. Apply rotation + fine deskew angle
  if (opts.rotation !== 0 || Math.abs(opts.deskewDeg) > 0.05) {
    const rad = ((opts.rotation + opts.deskewDeg) * Math.PI) / 180;
    const sin = Math.abs(Math.sin(rad));
    const cos = Math.abs(Math.cos(rad));
    const nw = Math.max(1, Math.round(work.width * cos + work.height * sin));
    const nh = Math.max(1, Math.round(work.width * sin + work.height * cos));
    const rotCanvas = document.createElement('canvas');
    rotCanvas.width = nw;
    rotCanvas.height = nh;
    const rctx = rotCanvas.getContext('2d');
    if (rctx) {
      rctx.fillStyle = '#ffffff';
      rctx.fillRect(0, 0, nw, nh);
      rctx.translate(nw / 2, nh / 2);
      rctx.rotate(rad);
      rctx.drawImage(work, -work.width / 2, -work.height / 2);
      work = rotCanvas;
    }
  }

  // 3. Smart upscale for small images
  let w = work.width;
  let h = work.height;
  if (opts.upscale) {
    const longest = Math.max(w, h);
    let scale = 1;
    if (longest < 1400) scale = Math.min(3, 2200 / Math.max(1, longest));
    if (longest * scale > 4200) scale = 4200 / Math.max(1, longest);
    if (Math.abs(scale - 1) > 0.02) {
      const up = document.createElement('canvas');
      up.width = Math.round(w * scale);
      up.height = Math.round(h * scale);
      const uctx = up.getContext('2d');
      if (uctx) {
        uctx.imageSmoothingEnabled = true;
        uctx.imageSmoothingQuality = 'high';
        uctx.drawImage(work, 0, 0, up.width, up.height);
        work = up;
        w = up.width;
        h = up.height;
      }
    }
  } else if (work === sourceCanvas) {
    const clone = document.createElement('canvas');
    clone.width = w;
    clone.height = h;
    clone.getContext('2d')?.drawImage(work, 0, 0);
    work = clone;
  }

  const ctx = work.getContext('2d', { willReadFrequently: true });
  if (!ctx) return work;

  const needPixelPass =
    opts.grayscaleContrast ||
    opts.binarize ||
    opts.invert ||
    opts.sharpen ||
    opts.brightness !== 0 ||
    Math.abs(opts.contrast - 1) > 0.02;

  if (!needPixelPass) return work;

  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const n = w * h;

  if (opts.invert) {
    for (let i = 0; i < n; i++) {
      d[i * 4] = 255 - d[i * 4];
      d[i * 4 + 1] = 255 - d[i * 4 + 1];
      d[i * 4 + 2] = 255 - d[i * 4 + 2];
    }
  }

  if (opts.brightness !== 0 || Math.abs(opts.contrast - 1) > 0.02) {
    const bShift = opts.brightness * 2.55;
    const cFactor = opts.contrast;
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < 3; c++) {
        let v = (d[i * 4 + c] - 128) * cFactor + 128 + bShift;
        if (v < 0) v = 0;
        else if (v > 255) v = 255;
        d[i * 4 + c] = v;
      }
    }
  }

  if (opts.sharpen && n <= 16_000_000) {
    applySharpenKernel(d, w, h);
  }

  if (opts.grayscaleContrast || opts.binarize) {
    const gray = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      gray[i] = (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) | 0;
    }
    const hist = new Array<number>(256).fill(0);
    for (let i = 0; i < n; i++) hist[gray[i]]++;
    const cut = n * 0.005;
    let lo = 0;
    let hi = 255;
    let acc = 0;
    for (let i = 0; i < 256; i++) {
      acc += hist[i];
      if (acc > cut) {
        lo = i;
        break;
      }
    }
    acc = 0;
    for (let i = 255; i >= 0; i--) {
      acc += hist[i];
      if (acc > cut) {
        hi = i;
        break;
      }
    }
    if (hi - lo < 20) {
      lo = 0;
      hi = 255;
    }
    const range = hi - lo;
    for (let i = 0; i < n; i++) {
      const v = ((gray[i] - lo) * 255) / range;
      gray[i] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
    if (opts.binarize) {
      const t = otsuThreshold(gray);
      for (let i = 0; i < n; i++) gray[i] = gray[i] > t ? 255 : 0;
    }
    for (let i = 0; i < n; i++) {
      d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = gray[i];
      d[i * 4 + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  return work;
}

export function extractStructuredEntities(text: string): ExtractedEntities {
  const uniq = (arr: string[]) => Array.from(new Set(arr.map((s) => s.trim()).filter(Boolean)));

  const gstins = uniq(
    text.match(/\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b/g) || []
  );
  const pans = uniq(text.match(/\b[A-Z]{5}\d{4}[A-Z]{1}\b/g) || []);
  const ifscs = uniq(text.match(/\b[A-Z]{4}0[A-Z0-9]{6}\b/g) || []);
  const vins = uniq(
    text.match(/\b[A-HJ-NPR-Z0-9]{17}\b/g) || []
  );
  const hsns = uniq(
    Array.from(
      text.matchAll(/\b(?:HSN|SAC)[\s:/#-]*(\d{4,8})\b/gi),
      (m) => m[1]
    )
  );
  const invoiceNos = uniq(
    Array.from(
      text.matchAll(/\b(?:Inv(?:oice)?|Bill|Voucher|Challan|Ref)\s*(?:No\.?|#|:)\s*([A-Z0-9][A-Z0-9/-]{2,24})/gi),
      (m) => m[1]
    )
  );
  const amounts = uniq(
    text.match(/(?:₹|Rs\.?|INR)\s*[\d,]+(?:\.\d{1,2})?/gi) || []
  );
  const dates = uniq(
    text.match(
      /\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})\b/gi
    ) || []
  );
  const emails = uniq(
    text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []
  );
  const phones = uniq(
    text.match(/(?:\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b/g) || []
  );
  const urls = uniq(text.match(/https?:\/\/[^\s)]+/gi) || []);

  // Heuristic table parser: split lines that have pipes, tabs, or 2+ spaces
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const tableRows: string[][] = [];
  for (const line of lines) {
    if (line.includes('|')) {
      const cells = line.split('|').map((c) => c.trim()).filter(Boolean);
      if (cells.length >= 2) tableRows.push(cells);
    } else if (line.includes('\t')) {
      const cells = line.split('\t').map((c) => c.trim()).filter(Boolean);
      if (cells.length >= 2) tableRows.push(cells);
    } else if (/\s{2,}/.test(line)) {
      const cells = line.split(/\s{2,}/).map((c) => c.trim()).filter(Boolean);
      if (cells.length >= 2) tableRows.push(cells);
    }
  }

  return {
    gstins,
    pans,
    ifscs,
    vins,
    hsns,
    invoiceNos,
    amounts,
    dates,
    emails,
    phones,
    urls,
    tableRows: tableRows.slice(0, 160),
  };
}

export function extractPdfPageText(tc: {
  items: Array<{ str?: string; hasEOL?: boolean; transform?: number[] }>;
}): string {
  let out = '';
  let lastY: number | null = null;
  for (const it of tc.items) {
    if (!it.str && !it.hasEOL) continue;
    const y = it.transform ? it.transform[5] : null;
    if (
      lastY !== null &&
      y !== null &&
      Math.abs(y - lastY) > 2 &&
      out &&
      !/\n$/.test(out)
    ) {
      out += '\n';
    }
    out += it.str || '';
    if (it.hasEOL) out += '\n';
    if (y !== null) lastY = y;
  }
  return out
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function createSampleInvoiceImageFile(): Promise<File> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1140;
    canvas.height = 780;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.strokeRect(36, 36, 1068, 708);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText('VCPL MOTORS PRIVATE LIMITED', 64, 92);

    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText('TAX INVOICE · Invoice No: VCPL/2026-27/0842   Date: 17-11-2026', 64, 130);
    ctx.fillText('GSTIN: 27AAACV1234F1Z5   PAN: AAACV1234F   IFSC: HDFC0000240', 64, 160);
    ctx.fillText('VIN: WBA31DY000N123456   Email: accounts@vcplmotors.in   Phone: +91 98201 44510', 64, 190);

    ctx.strokeStyle = '#94a3b8';
    ctx.beginPath();
    ctx.moveTo(64, 215);
    ctx.lineTo(1076, 215);
    ctx.stroke();

    const rows = [
      ['Item Description', 'HSN', 'Qty', 'Taxable Value', 'GST 18%', 'Total'],
      ['Periodic Service & Oil Filter', '998714', '2', 'Rs. 12,400.00', 'Rs. 2,232.00', 'Rs. 14,632.00'],
      ['Brake Pad Assembly Front', '870830', '1', 'Rs. 8,500.00', 'Rs. 1,530.00', 'Rs. 10,030.00'],
      ['Wheel Alignment & Balancing', '998714', '1', 'Rs. 2,100.00', 'Rs. 378.00', 'Rs. 2,478.00'],
    ];

    let y = 265;
    rows.forEach((r, idx) => {
      ctx.font = idx === 0 ? 'bold 18px monospace' : '17px monospace';
      ctx.fillStyle = idx === 0 ? '#0f172a' : '#1e293b';
      const xs = [64, 450, 560, 640, 810, 955];
      r.forEach((cell, cIdx) => {
        ctx.fillText(cell, xs[cIdx], y);
      });
      y += 46;
    });

    ctx.strokeStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(64, 470);
    ctx.lineTo(1076, 470);
    ctx.stroke();

    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText('Grand Total Payable: Rs. 27,140.00', 64, 520);
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#475569';
    ctx.fillText('Amount in Words: Twenty-Seven Thousand One Hundred Forty Rupees Only', 64, 558);

    canvas.toBlob((blob) => {
      resolve(
        new File([blob!], 'vcpl-sample-tax-invoice.png', {
          type: 'image/png',
        })
      );
    }, 'image/png');
  });
}
