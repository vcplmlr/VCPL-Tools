import {
  LineCapStyle,
  PDFDocument,
  StandardFonts,
  concatTransformationMatrix,
  popGraphicsState,
  pushGraphicsState,
  rgb,
} from 'pdf-lib';
import type { PDFPageProxy } from 'pdfjs-dist';
import { CombCell, combLetters } from './formFillerDetect';

export const FORM_FILLER_MAX_PAGES = 60;
export const FORM_FILLER_MASK_SCALE = 2;
export const FORM_FILLER_FONT = 'Arial, Helvetica, sans-serif';

export const FORM_FILLER_INKS = [
  { name: 'Black', c: '#111418' },
  { name: 'Blue', c: '#1D3FB0' },
] as const;

export const MY_DETAILS_FIELDS: {
  key: string;
  label: string;
  wide?: boolean;
  placeholder?: string;
  inputMode?: 'text' | 'tel' | 'email' | 'numeric';
}[] = [
  { key: 'name', label: 'Full Name', wide: true },
  { key: 'father', label: "Father's Name" },
  { key: 'mother', label: "Mother's Name" },
  { key: 'dob', label: 'Date of Birth', placeholder: 'DD/MM/YYYY' },
  { key: 'mobile', label: 'Mobile Number', inputMode: 'tel' },
  { key: 'email', label: 'Email Address', wide: true, inputMode: 'email' },
  { key: 'address', label: 'Residential Address', wide: true },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'pin', label: 'PIN Code', inputMode: 'numeric' },
];

export type FormToolType = 'text' | 'tick' | 'cross' | 'date' | 'sign' | 'photo';

export interface TextFormItem {
  id: string;
  type: 'text';
  page: number;
  x: number;
  y: number;
  size: number;
  base: number;
  maxW?: number;
  text: string;
  ink: string;
}

export interface CombFormItem {
  id: string;
  type: 'comb';
  page: number;
  cells: CombCell[];
  y: number;
  h: number;
  size: number;
  text: string;
  ink: string;
}

export interface MarkFormItem {
  id: string;
  type: 'mark';
  glyph: 'tick' | 'cross';
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  ink: string;
}

export interface ImgFormItem {
  id: string;
  type: 'img';
  kind: 'sign' | 'photo';
  page: number;
  imgId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  ink: string;
}

export type FormItem = TextFormItem | CombFormItem | MarkFormItem | ImgFormItem;

export interface LoadedFormImage {
  src: string;
  img: HTMLImageElement;
}

export interface FormPageMeta {
  i: number;
  w: number;
  h: number;
  page?: PDFPageProxy;
  vpTransform?: number[];
}

export interface StoredFormSession {
  name: string;
  kind: 'pdf' | 'image';
  bytes: Uint8Array | null;
  imgSrc: string | null;
  items: FormItem[];
  images: Record<string, string>;
  at: number;
}

export const clampVal = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export const uid = () => Math.random().toString(36).slice(2, 10);

export const todayDmy = (): string => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(
    2,
    '0'
  )}/${d.getFullYear()}`;
};

export const formatBytesHuman = (b: number): string =>
  b >= 1e6 ? `${(b / 1e6).toFixed(2)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`;

export function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () =>
      rej(new Error("That picture couldn't be decoded. Try a JPG or PNG image."));
    img.src = src;
  });
}

export function fileToHtmlImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  return loadHtmlImage(url).finally(() => {
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}

// Removes uneven camera lighting / shadows and lifts paper background to crisp white
export function cleanPaperCanvas(c: HTMLCanvasElement): void {
  const W = c.width;
  const H = c.height;
  const k = Math.max(8, Math.round(Math.max(W, H) / 24));
  const small = document.createElement('canvas');
  small.width = Math.max(1, Math.round(W / k));
  small.height = Math.max(1, Math.round(H / k));
  const sg = small.getContext('2d');
  if (!sg) return;
  sg.imageSmoothingQuality = 'high';
  sg.drawImage(c, 0, 0, small.width, small.height);

  const sd = sg.getImageData(0, 0, small.width, small.height);
  const src = sd.data.slice();
  const sw = small.width;
  const sh = small.height;

  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      let r = 0;
      let gg = 0;
      let b = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const yy = clampVal(y + dy, 0, sh - 1);
          const xx = clampVal(x + dx, 0, sw - 1);
          const idx = (yy * sw + xx) * 4;
          r = Math.max(r, src[idx]);
          gg = Math.max(gg, src[idx + 1]);
          b = Math.max(b, src[idx + 2]);
        }
      }
      const idx = (y * sw + x) * 4;
      sd.data[idx] = r;
      sd.data[idx + 1] = gg;
      sd.data[idx + 2] = b;
    }
  }
  sg.putImageData(sd, 0, 0);

  const bgc = document.createElement('canvas');
  bgc.width = W;
  bgc.height = H;
  const bg = bgc.getContext('2d');
  const g = c.getContext('2d');
  if (!bg || !g) return;

  bg.imageSmoothingQuality = 'high';
  bg.drawImage(small, 0, 0, W, H);
  const im = g.getImageData(0, 0, W, H);
  const d = im.data;
  const p = bg.getImageData(0, 0, W, H).data;

  for (let i = 0; i < d.length; i += 4) {
    for (let ch = 0; ch < 3; ch++) {
      const ratio = d[i + ch] / Math.max(24, p[i + ch]);
      d[i + ch] =
        ratio >= 0.86 ? 255 : Math.max(0, Math.round(255 * Math.pow(ratio / 0.86, 2.2)));
    }
  }
  g.putImageData(im, 0, 0);
}

// Extracts signature ink from a paper photo, removes shadows/background, recolors to chosen ink, and trims tightly
export function extractSignatureInkCanvas(
  img: HTMLImageElement,
  hexColor: string
): HTMLCanvasElement | null {
  const cap = 1600;
  const s = Math.min(1, cap / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.naturalWidth * s));
  c.height = Math.max(1, Math.round(img.naturalHeight * s));
  const g = c.getContext('2d');
  if (!g) return null;

  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(img, 0, 0, c.width, c.height);
  cleanPaperCanvas(c);

  const im = g.getImageData(0, 0, c.width, c.height);
  const d = im.data;
  const [R, G, B] = [1, 3, 5].map((i) => parseInt(hexColor.slice(i, i + 2), 16));
  let x0 = c.width;
  let y0 = c.height;
  let x1 = -1;
  let y1 = -1;

  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const i = (y * c.width + x) * 4;
      const lum = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
      const a = clampVal((235 - lum) / 150, 0, 1);
      d[i] = R;
      d[i + 1] = G;
      d[i + 2] = B;
      d[i + 3] = Math.round(a * 255);
      if (a > 0.35) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  g.putImageData(im, 0, 0);

  const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.04);
  const o = document.createElement('canvas');
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(c.width - 1, x1 + pad);
  y1 = Math.min(c.height - 1, y1 + pad);
  o.width = x1 - x0 + 1;
  o.height = y1 - y0 + 1;
  o.getContext('2d')?.drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
  return o;
}

let measurerCtx: CanvasRenderingContext2D | null = null;
export function measureFormTextWidth(text: string, size: number): number {
  if (!measurerCtx) {
    measurerCtx = document.createElement('canvas').getContext('2d');
  }
  if (!measurerCtx) return text.length * size * 0.55;
  measurerCtx.font = `${size}px ${FORM_FILLER_FONT}`;
  return measurerCtx.measureText(text).width;
}

export function markLinesForItem(
  it: MarkFormItem
): [[number, number], [number, number]][] {
  const { x, y, w, h } = it;
  if (it.glyph === 'cross') {
    return [
      [
        [x + w * 0.2, y + h * 0.2],
        [x + w * 0.8, y + h * 0.8],
      ],
      [
        [x + w * 0.8, y + h * 0.2],
        [x + w * 0.2, y + h * 0.8],
      ],
    ];
  }
  return [
    [
      [x + w * 0.16, y + h * 0.54],
      [x + w * 0.4, y + h * 0.78],
    ],
    [
      [x + w * 0.4, y + h * 0.78],
      [x + w * 0.86, y + h * 0.2],
    ],
  ];
}

export function drawFormItem(
  g: CanvasRenderingContext2D,
  it: FormItem,
  images: Record<string, LoadedFormImage>
): void {
  g.save();
  g.fillStyle = it.ink || FORM_FILLER_INKS[0].c;
  g.strokeStyle = it.ink || FORM_FILLER_INKS[0].c;

  if (it.type === 'text') {
    if (it.text) {
      g.font = `${it.size}px ${FORM_FILLER_FONT}`;
      g.textBaseline = 'alphabetic';
      g.fillText(it.text, it.x, it.y);
    }
  } else if (it.type === 'comb') {
    const { letters } = combLetters(it.text, it.cells);
    g.font = `${it.size}px ${FORM_FILLER_FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    letters.forEach((ch, idx) => {
      if (ch) {
        const c = it.cells[idx];
        g.fillText(ch, c.x + c.w / 2, it.y + it.h / 2 + it.size * 0.36);
      }
    });
  } else if (it.type === 'mark') {
    g.lineWidth = Math.max(0.9, it.w * 0.13);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    for (const [a, b] of markLinesForItem(it)) {
      g.moveTo(a[0], a[1]);
      g.lineTo(b[0], b[1]);
    }
    g.stroke();
  } else if (it.type === 'img') {
    const im = images[it.imgId]?.img;
    if (im) {
      g.imageSmoothingQuality = 'high';
      g.drawImage(im, it.x, it.y, it.w, it.h);
    }
  }

  g.restore();
}

export function formItemBbox(it: FormItem): { x: number; y: number; w: number; h: number } {
  if (it.type === 'text') {
    const w = Math.max(18, measureFormTextWidth(it.text || 'M', it.size));
    return { x: it.x - 2, y: it.y - it.size * 0.92, w: w + 4, h: it.size * 1.22 };
  }
  if (it.type === 'comb') {
    const a = it.cells[0];
    const b = it.cells[it.cells.length - 1];
    return { x: a.x - 1, y: it.y - 1, w: b.x + b.w - a.x + 2, h: it.h + 2 };
  }
  return { x: it.x, y: it.y, w: it.w, h: it.h };
}

async function textPicture(
  pdf: PDFDocument,
  text: string,
  size: number,
  ink: string
) {
  const k = 8;
  const w = measureFormTextWidth(text, size) + 2;
  const h = size * 1.35;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w * k));
  c.height = Math.max(1, Math.ceil(h * k));
  const g = c.getContext('2d');
  if (g) {
    g.scale(k, k);
    g.fillStyle = ink || FORM_FILLER_INKS[0].c;
    g.font = `${size}px ${FORM_FILLER_FONT}`;
    g.textBaseline = 'alphabetic';
    g.fillText(text, 1, size * 1.05);
  }
  const bytes = await (await fetch(c.toDataURL('image/png'))).arrayBuffer();
  return { img: await pdf.embedPng(bytes), w, h };
}

export async function buildVectorFilledPdf(
  sourceBytes: Uint8Array,
  items: FormItem[],
  pagesMeta: FormPageMeta[],
  images: Record<string, LoadedFormImage>
): Promise<Blob> {
  const pdf = await PDFDocument.load(sourceBytes, { updateMetadata: false });
  try {
    const form = pdf.getForm();
    if (form.getFields().length) form.flatten();
  } catch {
    // Ignore forms pdf-lib cannot flatten directly
  }

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const embedded: Record<string, Awaited<ReturnType<typeof pdf.embedPng>>> = {};
  const hexToRgb = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    return rgb(r, g, b);
  };
  const encodable = (t: string) => {
    try {
      font.encodeText(t);
      return true;
    } catch {
      return false;
    }
  };
  const mul = (m: number[], n: number[]) => [
    m[0] * n[0] + m[1] * n[2],
    m[0] * n[1] + m[1] * n[3],
    m[2] * n[0] + m[3] * n[2],
    m[2] * n[1] + m[3] * n[3],
    m[4] * n[0] + m[5] * n[2] + n[4],
    m[4] * n[1] + m[5] * n[3] + n[5],
  ];
  const inv = (m: number[]) => {
    const d = m[0] * m[3] - m[1] * m[2];
    return [
      m[3] / d,
      -m[1] / d,
      -m[2] / d,
      m[0] / d,
      (m[2] * m[5] - m[3] * m[4]) / d,
      (m[1] * m[4] - m[0] * m[5]) / d,
    ];
  };

  const pages = pdf.getPages();
  for (const it of items) {
    const page = pages[it.page];
    const meta = pagesMeta[it.page];
    if (!page || !meta?.vpTransform) continue;

    const toPdf = inv(meta.vpTransform);
    const at = (x: number, y: number, fn: () => void) => {
      const mat = mul([1, 0, 0, -1, x, y], toPdf);
      page.pushOperators(
        pushGraphicsState(),
        concatTransformationMatrix(mat[0], mat[1], mat[2], mat[3], mat[4], mat[5])
      );
      fn();
      page.pushOperators(popGraphicsState());
    };

    const ink = hexToRgb(it.ink || FORM_FILLER_INKS[0].c);

    if (it.type === 'text' && it.text) {
      if (encodable(it.text)) {
        at(it.x, it.y, () =>
          page.drawText(it.text, { x: 0, y: 0, size: it.size, font, color: ink })
        );
      } else {
        const pic = await textPicture(pdf, it.text, it.size, it.ink);
        at(it.x, it.y + it.size * 0.3, () =>
          page.drawImage(pic.img, { x: 0, y: 0, width: pic.w, height: pic.h })
        );
      }
    } else if (it.type === 'comb') {
      const { letters } = combLetters(it.text, it.cells);
      for (let i = 0; i < letters.length; i++) {
        const ch = letters[i];
        if (!ch) continue;
        const c = it.cells[i];
        const by = it.y + it.h / 2 + it.size * 0.36;
        if (encodable(ch)) {
          const w = font.widthOfTextAtSize(ch, it.size);
          at(c.x + c.w / 2 - w / 2, by, () =>
            page.drawText(ch, { x: 0, y: 0, size: it.size, font, color: ink })
          );
        } else {
          const pic = await textPicture(pdf, ch, it.size, it.ink);
          at(c.x + c.w / 2 - pic.w / 2, by + it.size * 0.3, () =>
            page.drawImage(pic.img, { x: 0, y: 0, width: pic.w, height: pic.h })
          );
        }
      }
    } else if (it.type === 'mark') {
      const t = Math.max(0.9, it.w * 0.13);
      at(0, 0, () => {
        for (const [a, b] of markLinesForItem(it)) {
          page.drawLine({
            start: { x: a[0], y: -a[1] },
            end: { x: b[0], y: -b[1] },
            thickness: t,
            color: ink,
            lineCap: LineCapStyle.Round,
          });
        }
      });
    } else if (it.type === 'img') {
      const src = images[it.imgId]?.src;
      if (!src) continue;
      let img = embedded[it.imgId];
      if (!img) {
        const bytes = await (await fetch(src)).arrayBuffer();
        img = embedded[it.imgId] = src.startsWith('data:image/png')
          ? await pdf.embedPng(bytes)
          : await pdf.embedJpg(bytes);
      }
      at(it.x, it.y + it.h, () =>
        page.drawImage(img, { x: 0, y: 0, width: it.w, height: it.h })
      );
    }
  }

  const outBytes = await pdf.save();
  return new Blob([outBytes as unknown as BlobPart], { type: 'application/pdf' });
}

interface EncodedJpgPage {
  ptW: number;
  ptH: number;
  w: number;
  h: number;
  jpg: Blob;
}

function scaledCanvas(c: HTMLCanvasElement, s: number): HTMLCanvasElement {
  if (s === 1) return c;
  const o = document.createElement('canvas');
  o.width = Math.max(1, Math.round(c.width * s));
  o.height = Math.max(1, Math.round(c.height * s));
  const g = o.getContext('2d');
  if (g) {
    g.imageSmoothingQuality = 'high';
    g.drawImage(c, 0, 0, o.width, o.height);
  }
  return o;
}

const encodeCanvasJpeg = (c: HTMLCanvasElement, q: number): Promise<Blob> =>
  new Promise((res, rej) =>
    c.toBlob((blob) => (blob ? res(blob) : rej(new Error('JPEG encoding failed'))), 'image/jpeg', q)
  );

async function encodeAllPages(
  pics: { canvas: HTMLCanvasElement; ptW: number; ptH: number }[],
  s: number,
  q: number
): Promise<EncodedJpgPage[]> {
  const out: EncodedJpgPage[] = [];
  for (const p of pics) {
    const c = scaledCanvas(p.canvas, s);
    out.push({ ptW: p.ptW, ptH: p.ptH, w: c.width, h: c.height, jpg: await encodeCanvasJpeg(c, q) });
  }
  return out;
}

async function compileJpgPagesToPdf(pages: EncodedJpgPage[]): Promise<Blob> {
  const te = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offs: number[] = [];
  let pos = 0;

  const put = (x: string | Uint8Array) => {
    const u = typeof x === 'string' ? te.encode(x) : x;
    chunks.push(u);
    pos += u.length;
  };
  const obj = (n: number, body: string) => {
    offs[n] = pos;
    put(`${n} 0 obj\n${body}\nendobj\n`);
  };

  put('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const n = pages.length;
  const kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Kids [${kids}] /Count ${n} >>`);

  for (let i = 0; i < n; i++) {
    const p = pages[i];
    const a = 3 + i * 3;
    const img = new Uint8Array(await p.jpg.arrayBuffer());
    const W = p.ptW.toFixed(2);
    const H = p.ptH.toFixed(2);
    obj(
      a,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /I ${
        a + 1
      } 0 R >> >> /Contents ${a + 2} 0 R >>`
    );
    offs[a + 1] = pos;
    put(
      `${a + 1} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${
        p.h
      } /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${
        img.length
      } >>\nstream\n`
    );
    put(img);
    put('\nendstream\nendobj\n');
    const content = `q ${W} 0 0 ${H} 0 0 cm /I Do Q`;
    obj(a + 2, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  }

  const total = 3 + n * 3;
  const xref = pos;
  let x = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let i = 1; i < total; i++) {
    x += `${String(offs[i]).padStart(10, '0')} 00000 n \n`;
  }
  put(`${x}trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(chunks as unknown as BlobPart[], { type: 'application/pdf' });
}

export async function buildPictureFilledPdf(
  pics: { canvas: HTMLCanvasElement; ptW: number; ptH: number }[],
  q = 0.86
): Promise<Blob> {
  return compileJpgPagesToPdf(await encodeAllPages(pics, 1, q));
}

export async function fitFilledPdfToMaxBytes(
  pics: { canvas: HTMLCanvasElement; ptW: number; ptH: number }[],
  maxBytes: number,
  onProgress?: (msg: string) => void
): Promise<Blob | null> {
  const bytesOf = (list: EncodedJpgPage[]) => list.reduce((t, p) => t + p.jpg.size, 0);
  const budget = Math.max(1, maxBytes - (240 + 620 * pics.length));

  for (const s of [1, 0.85, 0.72, 0.6, 0.5, 0.42, 0.35, 0.3, 0.25]) {
    onProgress?.(`Optimizing pages at ${Math.round(s * 100)}% scale...`);
    const mid = await encodeAllPages(pics, s, 0.6);
    if (bytesOf(mid) <= budget) {
      let lo = 0.6;
      let hi = 0.92;
      let best = mid;
      for (let i = 0; i < 5; i++) {
        const q = (lo + hi) / 2;
        const t = await encodeAllPages(pics, s, q);
        if (bytesOf(t) <= budget) {
          lo = q;
          best = t;
        } else {
          hi = q;
        }
      }
      return compileJpgPagesToPdf(best);
    }
  }

  const last = await encodeAllPages(pics, 0.25, 0.3);
  return bytesOf(last) <= budget ? compileJpgPagesToPdf(last) : null;
}

// IndexedDB Session Persistence
export const formFillerIdb = {
  dbPromise: null as Promise<IDBDatabase> | null,
  open(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((res, rej) => {
        const req = indexedDB.open('vcpl-formfiller-db', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('kv');
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      });
    }
    return this.dbPromise;
  },
  async get(k: string): Promise<StoredFormSession | null> {
    try {
      const db = await this.open();
      return await new Promise((res) => {
        const q = db.transaction('kv').objectStore('kv').get(k);
        q.onsuccess = () => res((q.result as StoredFormSession) || null);
        q.onerror = () => res(null);
      });
    } catch {
      return null;
    }
  },
  async put(k: string, v: StoredFormSession): Promise<void> {
    try {
      const db = await this.open();
      db.transaction('kv', 'readwrite').objectStore('kv').put(v, k);
    } catch {
      // Ignore private-browsing IndexedDB restrictions
    }
  },
  async del(k: string): Promise<void> {
    try {
      const db = await this.open();
      db.transaction('kv', 'readwrite').objectStore('kv').delete(k);
    } catch {
      // Ignore cleanup errors
    }
  },
};

// Built-in Sample Application Form PDF (comb boxes, grouped DOB boxes, checkboxes, photo box, signature box)
export async function createSampleApplicationPdfBytes(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4 portrait
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg = await doc.embedFont(StandardFonts.Helvetica);

  const ink = rgb(0.12, 0.17, 0.24);
  const muted = rgb(0.35, 0.4, 0.48);

  const drawCombRow = (
    x: number,
    yTop: number,
    count: number,
    cellW = 22,
    cellH = 22,
    breaksAfter: number[] = []
  ) => {
    const yBottom = yTop - cellH;
    let cx = x;
    for (let i = 0; i < count; i++) {
      page.drawRectangle({
        x: cx,
        y: yBottom,
        width: cellW,
        height: cellH,
        borderColor: ink,
        borderWidth: 1,
      });
      cx += cellW;
      if (breaksAfter.includes(i + 1)) {
        cx += 14;
      }
    }
  };

  // Outer Frame
  page.drawRectangle({
    x: 34,
    y: 34,
    width: 527.28,
    height: 773.89,
    borderColor: ink,
    borderWidth: 1.5,
  });

  // Header Banner
  page.drawRectangle({
    x: 34,
    y: 742,
    width: 527.28,
    height: 65.89,
    color: rgb(0.95, 0.96, 0.98),
    borderColor: ink,
    borderWidth: 1.2,
  });
  page.drawText('GENERAL APPLICATION & REGISTRATION FORM (SAMPLE)', {
    x: 52,
    y: 779,
    size: 13.5,
    font: bold,
    color: ink,
  });
  page.drawText(
    'Tap any letter box row, checkbox, underline, photo box, or signature box to test Smart Form Filler.',
    { x: 52, y: 758, size: 9, font: reg, color: muted }
  );

  // Passport Photo Box (top-right inside body)
  page.drawRectangle({
    x: 442,
    y: 590,
    width: 100,
    height: 128,
    borderColor: ink,
    borderWidth: 1.2,
  });
  page.drawText('AFFIX PHOTO', { x: 462, y: 656, size: 8.5, font: bold, color: muted });
  page.drawText('35 x 45 mm', { x: 468, y: 642, size: 8, font: reg, color: muted });

  // Section 1: Applicant Name Comb Boxes (15 boxes)
  page.drawText('1. APPLICANT FULL NAME (IN BLOCK LETTERS)', {
    x: 50,
    y: 710,
    size: 9.5,
    font: bold,
    color: ink,
  });
  drawCombRow(50, 698, 16, 22, 24);

  // Section 2: Father's / Guardian's Name (underline)
  page.drawText("2. FATHER'S / GUARDIAN'S NAME", {
    x: 50,
    y: 654,
    size: 9.5,
    font: bold,
    color: ink,
  });
  page.drawLine({
    start: { x: 50, y: 626 },
    end: { x: 420, y: 626 },
    thickness: 1,
    color: ink,
  });

  // Section 3: DOB Comb Row (DD / MM / YYYY) + Checkboxes
  page.drawText('3. DATE OF BIRTH (DD / MM / YYYY)', {
    x: 50,
    y: 598,
    size: 9.5,
    font: bold,
    color: ink,
  });
  drawCombRow(50, 586, 8, 22, 22, [2, 4]);

  page.drawText('4. GENDER', { x: 310, y: 598, size: 9.5, font: bold, color: ink });
  page.drawRectangle({ x: 310, y: 566, width: 15, height: 15, borderColor: ink, borderWidth: 1 });
  page.drawText('Male', { x: 331, y: 569.5, size: 10, font: reg, color: ink });
  page.drawRectangle({ x: 380, y: 566, width: 15, height: 15, borderColor: ink, borderWidth: 1 });
  page.drawText('Female', { x: 401, y: 569.5, size: 10, font: reg, color: ink });

  // Section 5: Mobile Number (10 boxes) + Email line
  page.drawText('5. MOBILE NUMBER', { x: 50, y: 534, size: 9.5, font: bold, color: ink });
  drawCombRow(50, 522, 10, 22, 22);

  page.drawText('6. EMAIL ADDRESS', { x: 300, y: 534, size: 9.5, font: bold, color: ink });
  page.drawLine({
    start: { x: 300, y: 502 },
    end: { x: 542, y: 502 },
    thickness: 1,
    color: ink,
  });

  // Section 7: Residential Address (enclosed rectangle box) + PIN
  page.drawText('7. CORRESPONDENCE ADDRESS', {
    x: 50,
    y: 472,
    size: 9.5,
    font: bold,
    color: ink,
  });
  page.drawRectangle({
    x: 50,
    y: 392,
    width: 492,
    height: 70,
    borderColor: ink,
    borderWidth: 1,
  });

  page.drawText('8. PIN CODE', { x: 50, y: 368, size: 9.5, font: bold, color: ink });
  drawCombRow(50, 356, 6, 22, 22);

  page.drawText('9. CITY / DISTRICT', { x: 220, y: 368, size: 9.5, font: bold, color: ink });
  page.drawLine({
    start: { x: 220, y: 336 },
    end: { x: 542, y: 336 },
    thickness: 1,
    color: ink,
  });

  // Declaration
  page.drawText('10. DECLARATION', { x: 50, y: 298, size: 9.5, font: bold, color: ink });
  page.drawRectangle({ x: 50, y: 268, width: 14, height: 14, borderColor: ink, borderWidth: 1 });
  page.drawText(
    'I hereby declare that the particulars furnished above are true and correct to the best of my knowledge.',
    { x: 72, y: 271, size: 9.5, font: reg, color: ink }
  );

  // Date & Signature Box
  page.drawText('Date:', { x: 50, y: 150, size: 10, font: bold, color: ink });
  page.drawLine({
    start: { x: 86, y: 148 },
    end: { x: 205, y: 148 },
    thickness: 1,
    color: ink,
  });

  page.drawRectangle({
    x: 342,
    y: 120,
    width: 200,
    height: 76,
    borderColor: ink,
    borderWidth: 1.2,
  });
  page.drawText('SIGNATURE OF APPLICANT', {
    x: 378,
    y: 104,
    size: 9,
    font: bold,
    color: ink,
  });

  return doc.save();
}
