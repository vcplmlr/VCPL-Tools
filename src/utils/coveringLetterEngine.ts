import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { createWorker, type Worker as TesseractWorker } from 'tesseract.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface LoanDetails {
  acc: string;
  gross: number;
  fees: number;
  dated: string;
  net: number;
}

export interface CoveringPaymentRow {
  id: string;
  date: string;
  mode: string;
  rno: string;
  amt: number;
  nar: string;
  who: string;
  payer: string;
  loan: boolean;
  bank: string;
  li: LoanDetails | null;
}

export interface ParsedLedgerResult {
  res: CoveringPaymentRow[];
  name: string;
  addr: string;
  rel: string;
  addrFlat: string;
  car: string;
  hp: string;
  vin: string;
  engine: string;
  sale: number;
  charged: number;
  debited: number;
  openingNum: number;
  openingSide: string;
  closingNum: number;
  closingSide: string;
  closing: string;
}

export interface ExtractedDocInfo {
  email?: string;
  reg?: string;
  temp?: boolean;
  onroad?: string;
  gst?: string;
  pan?: string;
  name?: string;
  addr?: string;
  pay?: CoveringPaymentRow;
}

export type RegType = 'perm' | 'temp' | 'none';

export interface CoveringLetterFormState {
  fdate: string;
  phone: string;
  cname: string;
  caddr: string;
  car: string;
  cpan: string;
  cgst: string;
  showIds: boolean;
  regType: RegType;
  regNo: string;
  taxChk: boolean;
  email: string;
  extra: string;
  showWho: boolean;
  onroad: string;
  ack: boolean;
  headerTopMm: number;
  footerBottomMm: number;
  letterheadDataUrl: string;
  letterheadName: string;
  signatureDataUrl: string;
  signatureName: string;
  sigHeightPx: number;
}

export type LetterDensityLevel = 0 | 1 | 2;

export function getLetterDensityStyle(level: LetterDensityLevel): {
  fontPt: number;
  lineHeight: number;
} {
  if (level === 2) return { fontPt: 9.5, lineHeight: 1.18 };
  if (level === 1) return { fontPt: 10.5, lineHeight: 1.24 };
  return { fontPt: 11.5, lineHeight: 1.3 };
}

const MON: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];

const TENS = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety',
];

function twoDigits(n: number): string {
  return n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
}

function integerWords(n: number): string {
  let rem = Math.floor(Math.abs(n));
  if (!rem) return 'Zero';
  const parts: string[] = [];
  const crore = Math.floor(rem / 1e7);
  rem %= 1e7;
  const lakh = Math.floor(rem / 1e5);
  rem %= 1e5;
  const thousand = Math.floor(rem / 1e3);
  rem %= 1e3;
  const hundred = Math.floor(rem / 100);
  rem %= 100;
  if (crore) parts.push(integerWords(crore) + ' Crore');
  if (lakh) parts.push(twoDigits(lakh) + ' Lakh');
  if (thousand) parts.push(twoDigits(thousand) + ' Thousand');
  if (hundred) parts.push(ONES[hundred] + ' Hundred');
  if (rem) parts.push(twoDigits(rem));
  return parts.join(' ');
}

export function amountInWords(amount: number): string {
  const abs = Math.abs(Number.isFinite(amount) ? amount : 0);
  let rupees = Math.floor(abs);
  let paise = Math.round((abs - rupees) * 100);
  if (paise >= 100) {
    rupees += 1;
    paise = 0;
  }
  const rupeeText = integerWords(rupees);
  if (paise > 0) {
    return `${rupeeText} Rupees and ${integerWords(paise)} Paise Only`;
  }
  return `${rupeeText} Rupees Only`;
}

export function inr(n: number): string {
  const safe = Number.isFinite(n) ? n : 0;
  const sign = safe < 0 ? '-' : '';
  const rounded = Math.round(Math.abs(safe) * 100) / 100;
  const [intPart, decPart] = rounded.toFixed(2).split('.');
  let last3 = intPart.slice(-3);
  const rest = intPart.slice(0, -3);
  if (rest) {
    last3 = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
  }
  return sign + (decPart === '00' ? last3 : `${last3}.${decPart}`);
}

export function num(s: unknown): number {
  const raw = String(s ?? '').trim();
  if (!raw) return 0;
  // Extract first valid numeric token (ignoring leading prefixes like "Rs." or "₹")
  const match = raw.match(/\d[\d,]*(?:\.\d+)?/);
  if (!match) return 0;
  const cleaned = match[0].replace(/,/g, '');
  const val = parseFloat(cleaned);
  return Number.isFinite(val) ? val : 0;
}

export function escHtml(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return c;
    }
  });
}

export function fmtDate(s: string): string {
  const raw = (s || '').trim();
  if (!raw) return '';
  const mAlpha = raw.match(/(\d{1,2})[-\/\s]([A-Za-z]{3,4})[-\/\s](\d{2,4})/);
  if (mAlpha) {
    const monNum = MON[mAlpha[2].toLowerCase()];
    if (monNum) {
      const y = mAlpha[3].length === 2 ? '20' + mAlpha[3] : mAlpha[3];
      return `${String(mAlpha[1]).padStart(2, '0')}.${String(monNum).padStart(2, '0')}.${y}`;
    }
  }
  const mNum = raw.match(/^(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{2,4})$/);
  if (mNum) {
    const y = mNum[3].length === 2 ? '20' + mNum[3] : mNum[3];
    return `${String(mNum[1]).padStart(2, '0')}.${String(mNum[2]).padStart(2, '0')}.${y}`;
  }
  return raw;
}

export function dateSortKey(d: string): string {
  const m = (d || '').match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/);
  if (!m) return '99999999';
  const y = m[3].length === 2 ? '20' + m[3] : m[3];
  return `${y}${m[2].padStart(2, '0')}${m[1].padStart(2, '0')}`;
}

export function todayDotDate(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

export function isImageFile(file: File): boolean {
  if (file.type && file.type.startsWith('image/')) return true;
  return /\.(png|jpe?g|webp|bmp|gif|tiff?)$/i.test(file.name);
}

export function createPaymentId(): string {
  return `pay_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function renderPdfLetterheadToDataUrl(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const page = await pdf.getPage(1);
  const baseViewport = page.getViewport({ scale: 1 });
  const targetWidth = 1588; // 2x A4 794px width for crisp preview & PDF export
  const scale = targetWidth / Math.max(1, baseViewport.width);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not initialize canvas for PDF letterhead.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return canvas.toDataURL('image/png');
}

export function processImageToDataUrl(
  file: File,
  options: { trimWhitespace?: boolean; removeWhiteBg?: boolean; maxDim?: number } = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read uploaded image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Unsupported or corrupted image file.'));
      img.onload = () => {
        const maxDim = options.maxDim ?? 1600;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height, 1));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);

        if (options.removeWhiteBg || options.trimWhitespace) {
          const imgData = ctx.getImageData(0, 0, w, h);
          const data = imgData.data;
          let minX = w;
          let minY = h;
          let maxX = -1;
          let maxY = -1;

          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const i = (y * w + x) * 4;
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              const a = data[i + 3];
              const isNearWhite = r >= 235 && g >= 235 && b >= 235;
              if (options.removeWhiteBg && isNearWhite && a > 0) {
                data[i + 3] = 0;
              }
              const effectiveAlpha = data[i + 3];
              if (effectiveAlpha > 18 && !isNearWhite) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
              }
            }
          }

          ctx.putImageData(imgData, 0, 0);

          if (options.trimWhitespace && maxX >= minX && maxY >= minY) {
            const pad = 6;
            const sx = Math.max(0, minX - pad);
            const sy = Math.max(0, minY - pad);
            const sw = Math.min(w - sx, maxX - minX + 1 + pad * 2);
            const sh = Math.min(h - sy, maxY - minY + 1 + pad * 2);
            const trimmed = document.createElement('canvas');
            trimmed.width = sw;
            trimmed.height = sh;
            const tctx = trimmed.getContext('2d');
            if (tctx) {
              tctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
              resolve(trimmed.toDataURL('image/png'));
              return;
            }
          }
        }

        resolve(canvas.toDataURL('image/png'));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/* ---------- PDF & OCR reading ---------- */

let sharedOcrWorker: Promise<TesseractWorker> | null = null;
let ocrQueue: Promise<unknown> = Promise.resolve();

async function getOcrWorker(): Promise<TesseractWorker> {
  if (!sharedOcrWorker) {
    sharedOcrWorker = createWorker('eng').catch((err) => {
      sharedOcrWorker = null;
      throw err;
    });
  }
  return sharedOcrWorker;
}

export async function terminateCoveringOcrWorker(): Promise<void> {
  if (sharedOcrWorker) {
    try {
      const worker = await sharedOcrWorker;
      await worker.terminate();
    } catch {
      // Ignore cleanup errors
    } finally {
      sharedOcrWorker = null;
    }
  }
}

export function runOcrLines(
  src: HTMLCanvasElement | File | Blob | string,
  label: string,
  onProgress?: (msg: string) => void
): Promise<string[]> {
  const run = async (): Promise<string[]> => {
    onProgress?.(`${label}: reading with OCR...`);
    const worker = await getOcrWorker();
    const { data } = await worker.recognize(src);
    return (data.text || '')
      .split('\n')
      .map((x) => x.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
  };
  const next = ocrQueue.then(run, run);
  ocrQueue = next.catch(() => undefined);
  return next;
}

export async function extractPdfLines(
  file: File,
  onProgress?: (msg: string) => void
): Promise<{ lines: string[]; ocrPages: number; pageCount: number }> {
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdf = await loadingTask.promise;
  const lines: string[] = [];
  let ocrPages = 0;

  try {
    for (let p = 1; p <= pdf.numPages; p++) {
      const pg = await pdf.getPage(p);
      const tc = await pg.getTextContent();
      const rows: Array<{ y: number; items: Array<{ x: number; s: string }> }> = [];

      for (const item of tc.items) {
        if (!('str' in item) || !item.str.trim()) continue;
        const y = item.transform[5];
        const x = item.transform[4];
        let row = rows.find((r) => Math.abs(r.y - y) < 3);
        if (!row) {
          row = { y, items: [] };
          rows.push(row);
        }
        row.items.push({ x, s: item.str });
      }

      rows.sort((a, b) => b.y - a.y);
      const pageLines: string[] = [];
      for (const row of rows) {
        row.items.sort((a, b) => a.x - b.x);
        const text = row.items
          .map((i) => i.s)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (text) pageLines.push(text);
      }

      if (pageLines.join('').length >= 25) {
        lines.push(...pageLines);
      } else {
        const vp = pg.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(vp.width);
        canvas.height = Math.ceil(vp.height);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          await pg.render({ canvasContext: ctx, viewport: vp, canvas }).promise;
          const ocrTextLines = await runOcrLines(
            canvas,
            `${file.name} page ${p}/${pdf.numPages}`,
            onProgress
          );
          lines.push(...ocrTextLines);
          ocrPages++;
        }
        canvas.width = 0;
        canvas.height = 0;
      }
      pg.cleanup();
    }
  } finally {
    await loadingTask.destroy();
  }

  return { lines, ocrPages, pageCount: pdf.numPages };
}

/* ---------- Tally ledger parsing ---------- */

const ACRONYMS = /\b(Bmw|Hdfc|Icici|Sbi|Idfc|Pnb|Bob|Uco|Tvs|Kia|Mg|Fs|Hsbc|Vcj|Vcpl)\b/g;

export function tcase(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/(^|[\s(\/.-])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase())
    .replace(ACRONYMS, (w) => w.toUpperCase())
    .replace(/\b([SXE])drive/g, (_, a: string) => a.toLowerCase() + 'Drive');
}

export function modeOf(narration: string, type: string): string {
  let m = (narration.match(/RTGS|NEFT|IMPS|\bUPI\b/i) || [])[0];
  m = m ? m.toUpperCase() : '';
  const ch = narration.match(/(?:CHQ|CHEQUE)\.?\s*(?:NO)?[.:\s]*(\d{4,8})/i);
  if (ch) m = 'CHQ NO: ' + ch[1];
  if (!m) {
    m = /cash/i.test(type) ? 'CASH' : /online/i.test(type) ? 'ONLINE' : '';
  }
  if (/LOAN/i.test(narration)) {
    m = 'LOAN' + (m ? ' - ' + m : '');
  }
  return m.trim();
}

function whoOf(narration: string): string {
  return ((narration.match(/TRANSFER FROM[^\/]*\/\s*(.+?)\s*$/i) || [])[1] || '').trim();
}

function payerOf(narration: string): string {
  const matches = [
    ...narration.matchAll(/-\s*([A-Z][A-Z .]*?)(?=\s+TRANSFER FROM|\s*\/|\s*$)/g),
  ]
    .map((x) => x[1].trim())
    .filter((x) => !/^(IMPS|TRANSFER|RTGS|NEFT|UPI)$/.test(x));
  return matches.length ? matches[matches.length - 1] : '';
}

interface RawVoucher {
  date: string;
  vno: string;
  side: string;
  type: string;
  amt: number;
  txt: string[];
  bank: string;
}

export function parseLedger(lines: string[]): ParsedLedgerResult {
  // Matches voucher formats like BR/2026/04/12, Car/2026/04/5, BR/25-26/12
  const VR = /\b([A-Za-z]{1,8}\/\d{2,4}(?:-\d{2,4})?\/\d{2}(?:\/\d+)?)\b/;
  const AM = /(\d[\d,]*\.\d{2})\s*$/;
  const vouchers: RawVoucher[] = [];
  let lastDate = '';
  let cur: RawVoucher | null = null;

  for (const ln of lines) {
    if (/Closing Balance/i.test(ln)) {
      cur = null;
      continue;
    }
    if (/Opening Balance/i.test(ln)) {
      cur = null;
      continue;
    }
    const dm = ln.match(/^(\d{1,2}[-\/][A-Za-z]{3}[-\/]\d{2,4})\b/);
    if (dm) lastDate = dm[1];

    const vm = ln.match(VR);
    if (vm && AM.test(ln) && !/^(Agst|New) Ref/i.test(ln)) {
      const sideMatch = ln.match(/^(?:\d{1,2}[-\/][A-Za-z]{3}[-\/]\d{2,4}\s+)?(Dr|Cr)\s/);
      const amtMatch = ln.match(AM);
      cur = {
        date: lastDate,
        vno: vm[1],
        side: sideMatch ? sideMatch[1] : '',
        type: ln.slice(0, vm.index),
        amt: amtMatch ? num(amtMatch[1]) : 0,
        txt: [],
        bank: '',
      };
      vouchers.push(cur);
      continue;
    }

    if (!cur) continue;
    const bm = ln.match(/^Others\s+(\d{1,2}[-\/][A-Za-z0-9]{2,3}[-\/]\d{2,4})/i);
    if (bm) {
      cur.bank = bm[1];
      continue;
    }
    if (
      /^(Agst Ref|New Ref|Carried|Brought|continued|Page|Date )/i.test(ln) ||
      /^Varsha Cars/i.test(ln) ||
      /Ledger Account\s*:/i.test(ln) ||
      /^[\d,]+\.\d\d(\s+[\d,]+\.\d\d)?$/.test(ln)
    ) {
      continue;
    }
    cur.txt.push(ln);
  }

  const getNarration = (r: RawVoucher) => {
    const t = r.txt.join(' ');
    const idx = t.search(/BEING/i);
    return (idx >= 0 ? t.slice(idx) : t).replace(/(\d,)\s+(\d)/g, '$1$2');
  };

  const full = lines.join(' ').replace(/(\d,)\s+(\d)/g, '$1$2');

  let name = '';
  let addr = '';
  let rel = '';
  const li = lines.findIndex((l) => /^Ledger Account(?:\s*:|$)/i.test(l));
  if (li >= 0) {
    const inlineName = lines[li].replace(/^Ledger Account\s*:?\s*/i, '').trim();
    if (inlineName) {
      name = inlineName;
    } else if (li > 0 && !/Varsha Cars/i.test(lines[li - 1])) {
      name = lines[li - 1];
    }
    const addrLines: string[] = [];
    for (
      let k = li + 1;
      k < lines.length &&
      !/\d{1,2}[-\/][A-Za-z]{3}[-\/]\d{2,4}\s+to\b/i.test(lines[k]) &&
      !/^Date\s+Particulars/i.test(lines[k]);
      k++
    ) {
      addrLines.push(lines[k]);
    }
    if (addrLines.length && /^(D\/O|S\/O|W\/O|C\/O|H\/O)\s/i.test(addrLines[0])) {
      rel = tcase(addrLines[0]);
    }
    addr = addrLines
      .map((l) => tcase(l.replace(/\s*-\s*(\d{6})\s*$/, ', $1')))
      .join('\n');
  }

  const addrFlat = addr
    .split('\n')
    .filter((l) => l && l !== rel)
    .join(', ');

  const saleVoucher = vouchers.find((r) => /^Car\//i.test(r.vno) || /car sales/i.test(r.type));
  let hp = ((saleVoucher ? getNarration(saleVoucher) : '').match(/\bHP\s*:\s*(.+?)\s*$/i) || [])[1] || '';
  if (!hp) {
    hp =
      (full.match(
        /\bHP\s*:\s*([A-Z][A-Z0-9 .&]+?(?:LTD|LIMITED|BANK|FINANCE|SERVICES)\.?)/i
      ) || [])[1] || '';
  }
  hp = hp.replace(/[.,\s]+$/, '');

  const res: CoveringPaymentRow[] = [];
  for (const r of vouchers) {
    const nar = getNarration(r);
    const loan =
      r.side === 'Dr' &&
      (/loan|disburs|financ|\bfs\b/i.test(r.type) || /LOAN AMOUNT|LOAN A\/C/i.test(nar));
    const isRec = /receipt/i.test(r.type) || /^(BR|OR|CR|RV|REC)\//i.test(r.vno);
    if (!loan && !(isRec && r.side !== 'Cr')) continue;

    let mode = loan ? 'LOAN' : modeOf(nar, r.type);
    let who = whoOf(nar);
    let payer = '';
    let loanInfo: LoanDetails | null = null;

    if (loan) {
      const g = (re: RegExp) => (nar.match(re) || [])[1] || '';
      loanInfo = {
        acc: g(/LOAN A\/C NO\s*:?\s*([A-Z0-9]+)/i),
        gross: num(g(/LOAN AMOUNT\s*([\d,]+)/i)),
        fees: num(g(/FEES\s*-?\s*([\d,]+)/i)),
        dated: g(/DATED ON\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/i),
        net: r.amt,
      };
      who =
        tcase(hp) ||
        tcase(r.type.replace(/^(Dr|Cr)\s+/i, '').replace(/\s*-.*$/, ''));
    } else {
      payer = payerOf(nar);
      if (/LOAN/.test(mode) && !who) who = tcase(hp);
    }

    res.push({
      id: createPaymentId(),
      date: fmtDate(r.date),
      mode,
      rno: r.vno,
      amt: r.amt,
      nar,
      who,
      payer,
      loan,
      bank: r.bank,
      li: loanInfo,
    });
  }

  const sumSide = (s: 'Dr' | 'Cr') =>
    vouchers.filter((r) => r.side === s).reduce((acc, r) => acc + r.amt, 0);

  let car = '';
  const cm = full.match(/SALE OF NEW CAR\s+(.+?)\s*,\s*COLOU?R\s*:\s*(.+?)\s*,\s*VIN/i);
  if (cm) {
    const escapedModel = cm[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const trimMatch = full.match(
      new RegExp(escapedModel + '\\s+(M\\s*SPORT(?:\\s*PRO)?|SPORT\\s*LINE|LUXURY\\s*LINE|X\\s*LINE)', 'i')
    );
    car = tcase(cm[1] + (trimMatch ? ' ' + trimMatch[1] : '')) + ' - (' + tcase(cm[2]) + ')';
  }

  const obMatch = full.match(/(Dr|Cr)\s+Opening Balance\s+([\d,]+\.\d{2})/i);
  const clMatch = full.match(/(Dr|Cr)\s+Closing Balance\s+([\d,]+\.\d{2})/i);
  const f = (re: RegExp) => (full.match(re) || [])[1] || '';

  return {
    res,
    name: tcase(name),
    addr,
    rel,
    addrFlat,
    car,
    hp: tcase(hp),
    vin: f(/\bVIN\s*[-:]*\s*([A-HJ-NPR-Z0-9]{17})\b/i),
    engine: f(/ENGINE NO\s*[-:.]*\s*([A-Z0-9]+)/i),
    sale: saleVoucher ? saleVoucher.amt : 0,
    charged: sumSide('Cr'),
    debited: sumSide('Dr'),
    openingNum: obMatch ? num(obMatch[2]) : 0,
    openingSide: obMatch ? obMatch[1] : '',
    closingNum: clMatch ? num(clMatch[2]) : 0,
    closingSide: clMatch ? clMatch[1] : '',
    closing: clMatch ? `${inr(num(clMatch[2]))} ${clMatch[1]}` : '',
  };
}

/* ---------- Other documents (contracts, receipts, RC/TR, OCR screenshots) ---------- */

const DEALER_CODES = /0796M|AAICV|AAACV/;

export function extractInfo(lines: string[]): ExtractedDocInfo {
  const full = lines.join(' ');
  const o: ExtractedDocInfo = {};

  o.email = (full.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) || []).find(
    (e) => !/varshacars/i.test(e)
  );

  const rg = full.match(/\bKA[\s-]?\d{2}[\s-]?[A-Z]{1,3}[\s-]?\d{4}\b/);
  if (rg) o.reg = rg[0].replace(/[\s-]/g, '');
  if (/temporary\s+regist/i.test(full)) o.temp = true;

  const op = full.match(/ON[- ]?ROAD PRICE\s*(?:Rs\.?|\u20b9)?\s*([\d,]{6,})/i);
  if (op) o.onroad = op[1];

  o.gst = (full.match(/\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]\b/g) || []).find(
    (g) => !DEALER_CODES.test(g)
  );
  o.pan = (full.match(/\b[A-Z]{5}\d{4}[A-Z]\b/g) || []).find(
    (p) => !DEALER_CODES.test(p) && !(o.gst && o.gst.includes(p))
  );

  const cut = (l: string) =>
    l
      .split(/\s+(?:Contact person|Mobile|Landline|Email|Pan #|GST #|Customer Details)/i)[0]
      .trim();

  const custIdx = lines.findIndex((l) => /Customer Name\s*&?\s*Address/i.test(l));
  if (custIdx >= 0) {
    const addrLines: string[] = [];
    for (
      let k = custIdx + 1;
      k < lines.length &&
      addrLines.length < 4 &&
      !/^(Contact person|Mobile|Customer Details)/i.test(lines[k]);
      k++
    ) {
      const t = cut(lines[k]);
      if (t) addrLines.push(t);
    }
    if (addrLines.length) {
      o.name = addrLines[0];
      o.addr = addrLines.slice(1).join('\n');
    }
  }

  if (/Receipt Voucher/i.test(full)) {
    const vm = full.match(/\b([A-Za-z]{1,4}\/\d{2,4}(?:-\d{2,4})?\/\d{2}(?:\/\d+)?)\b/);
    const dt =
      full.match(/Dated\s*(\d{1,2}[-\/][A-Za-z]{3}[-\/]\d{2,4})/i) ||
      full.match(/(\d{1,2}[-\/][A-Za-z]{3}[-\/]\d{2,4})/);
    const am = full.match(/([\d,]{5,}\.\d{2})\s*\/-/);
    const ri = full.search(/Remarks/i);
    if (vm && am) {
      const nar = ri >= 0 ? full.slice(ri) : full;
      const receiptType = (full.match(/(Bank|Online|Cash)\s+Receipt/i) || [''])[0];
      o.pay = {
        id: createPaymentId(),
        date: fmtDate(dt ? dt[1] : ''),
        mode: modeOf(nar, receiptType),
        rno: vm[1],
        amt: num(am[1]),
        nar,
        who: whoOf(nar),
        payer: '',
        loan: false,
        bank: '',
        li: null,
      };
    }
  }

  return o;
}

/* ---------- Audit checks ---------- */

export function computeLedgerAuditFlags(
  ledger: ParsedLedgerResult,
  pays: CoveringPaymentRow[]
): string[] {
  const cn = (ledger.name || '')
    .toUpperCase()
    .split(/\s+/)
    .filter((t) => t.length > 1);
  const rt = (ledger.rel || '')
    .toUpperCase()
    .replace(/^\S+\s/, '')
    .split(/\s+/)
    .filter((t) => t.length > 1);

  const flags: string[] = [];

  for (const p of pays) {
    if (p.payer && !/LOAN/i.test(p.mode) && !cn.some((t) => p.payer.toUpperCase().includes(t))) {
      const sharesFamily = rt.some((t) => p.payer.toUpperCase().includes(t));
      flags.push(
        `${p.rno}: paid by a third party, ${tcase(p.payer)}${
          sharesFamily ? ' (shares family name)' : ''
        }`
      );
    }

    if (p.bank) {
      const normalizedBank = fmtDate(p.bank);
      if (normalizedBank.length >= 5 && p.date.length >= 5) {
        if (p.date.slice(0, 5) !== normalizedBank.slice(0, 5)) {
          flags.push(
            `${p.rno}: receipt date ${p.date} differs from bank clearance date ${normalizedBank}. Please verify.`
          );
        }
      }
    }

    if (/^CASH/i.test(p.mode) && p.amt >= 200000) {
      flags.push(
        `${p.rno}: cash of Rs. ${inr(p.amt)} is at or above the Rs. 2,00,000 cash limit (Sec 269ST).`
      );
    } else if (/^CASH/i.test(p.mode) && p.amt >= 190000) {
      flags.push(
        `${p.rno}: cash of Rs. ${inr(p.amt)} is just below the Rs. 2,00,000 cash limit.`
      );
    }

    if (
      p.li &&
      p.li.gross &&
      p.li.fees &&
      Math.abs(p.li.gross - p.li.fees - p.li.net) > 1
    ) {
      flags.push(
        `${p.rno}: loan Rs. ${inr(p.li.gross)} less fees Rs. ${inr(
          p.li.fees
        )} does not equal net Rs. ${inr(p.li.net)}.`
      );
    }
  }

  if (ledger.closingNum > 0) {
    // Incorporate opening balance if present
    // Note: in Tally Particulars polarity above, charged = Cr vouchers (sales), debited = Dr vouchers (receipts)
    // Standard ledger closing check: compare debited - charged (adjusted by opening balance if any)
    const openingSigned =
      ledger.openingNum > 0
        ? ledger.openingSide === 'Dr'
          ? ledger.openingNum
          : -ledger.openingNum
        : 0;
    const netDiff = ledger.debited - ledger.charged + openingSigned;
    const rawDiff = ledger.debited - ledger.charged;
    const matchesWithOpening = Math.abs(Math.abs(netDiff) - ledger.closingNum) <= 1;
    const matchesRaw = Math.abs(Math.abs(rawDiff) - ledger.closingNum) <= 1;

    if (!matchesWithOpening && !matchesRaw) {
      flags.push(
        `Received Rs. ${inr(ledger.debited)} less charged Rs. ${inr(
          ledger.charged
        )} does not match closing balance ${ledger.closing}. An entry may be missed.`
      );
    } else {
      const effectiveBalance = matchesWithOpening ? netDiff : rawDiff;
      if (effectiveBalance > 1) {
        flags.push(
          `Customer has paid Rs. ${inr(
            effectiveBalance
          )} more than billed (refund due or item not yet billed).`
        );
      } else if (effectiveBalance < -1) {
        flags.push(`Customer still owes Rs. ${inr(-effectiveBalance)}.`);
      }
    }
  }

  return flags;
}

/* ---------- Letter HTML & Word Export ---------- */

export function formatModeText(p: CoveringPaymentRow, showWho: boolean): string {
  const showBank = showWho && /LOAN/i.test(p.mode) && Boolean(p.who.trim());
  const modeStr = escHtml(p.mode);
  if (!showBank) return modeStr;
  return p.mode.trim().toUpperCase() === 'LOAN'
    ? `${modeStr} - ${escHtml(p.who)}`
    : `${modeStr} (${escHtml(p.who)})`;
}

export function buildCoveringLetterHtml(
  form: CoveringLetterFormState,
  pays: CoveringPaymentRow[],
  density: LetterDensityLevel = 0
): string {
  const total = pays.reduce((sum, p) => sum + (Number.isFinite(p.amt) ? p.amt : 0), 0);
  const car = form.car.trim();
  const addr = form.caddr
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)
    .map(escHtml)
    .join('<br>');

  const taxText = form.taxChk ? ' (Lifetax Paid Receipt)' : '';
  const rn = escHtml(form.regNo.trim());
  const items: string[] = ['Invoice copies'];

  if (form.regType === 'perm') {
    items.push(
      `Registration Certificate${taxText}${
        rn ? ` &ndash;<br>Registration Number : <b>${rn}</b>` : ''
      }`
    );
  } else if (form.regType === 'temp') {
    items.push(
      `Temporary Registration Certificate${taxText}${
        rn ? ` &ndash;<br>Registration / TR Number : <b>${rn}</b>` : ''
      }`
    );
  }

  items.push('Insurance policy Copy', 'Form 20 and Form 21', 'Statement of Accounts Copy');

  form.extra
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)
    .forEach((line) => items.push(escHtml(line)));

  const em = form.email.trim();
  if (em) {
    items.push(
      `The TCS certificate will be emailed to : <b>${escHtml(
        em
      )}</b> after the submission of quarterly returns as per IT Act.`
    );
  }

  const idsLine =
    form.showIds && (form.cgst.trim() || form.cpan.trim())
      ? `<br>${form.cgst.trim() ? `GSTIN: ${escHtml(form.cgst.trim())}` : ''}${
          form.cgst.trim() && form.cpan.trim() ? ' / ' : ''
        }${form.cpan.trim() ? `PAN: ${escHtml(form.cpan.trim())}` : ''}`
      : '';

  const sp =
    density === 2
      ? { pGap: '4.5pt', smGap: '2.5pt', tblGap: '6pt', tdPad: '2px 5px', liGap: '1.5pt', noSigGap: '16pt' }
      : density === 1
      ? { pGap: '6pt', smGap: '3pt', tblGap: '8pt', tdPad: '2.5px 6px', liGap: '2pt', noSigGap: '20pt' }
      : { pGap: '8pt', smGap: '3.5pt', tblGap: '9pt', tdPad: '3.5px 7px', liGap: '2pt', noSigGap: '24pt' };

  const td = `style="border:1px solid #000;padding:${sp.tdPad};word-break:break-word;overflow-wrap:anywhere"`;
  const rows = pays
    .map(
      (p) =>
        `<tr><td ${td}>${escHtml(p.date)}</td><td ${td}>${formatModeText(
          p,
          form.showWho
        )}</td><td ${td}>${escHtml(p.rno)}</td><td ${td} align="right">${
          p.amt ? inr(p.amt) : ''
        }</td></tr>`
    )
    .join('');

  const baseSigHeight = Math.min(96, Math.max(28, Number(form.sigHeightPx) || 52));
  const sigHeight =
    density === 2
      ? Math.round(baseSigHeight * 0.8)
      : density === 1
      ? Math.round(baseSigHeight * 0.9)
      : baseSigHeight;

  const sigBlock = form.signatureDataUrl
    ? `<p style="margin:4pt 0 4pt"><img src="${form.signatureDataUrl}" alt="Authorized Signature" height="${sigHeight}" style="height:${sigHeight}px;max-height:${sigHeight}px;max-width:200px;width:auto;display:block;object-fit:contain;object-position:left center;mix-blend-mode:multiply" /></p>`
    : `<p style="margin:0 0 ${sp.noSigGap}"></p>`;

  return (
    `<p style="margin:0 0 ${sp.pGap}">Date: ${escHtml(form.fdate)}</p>` +
    `<p style="margin:0 0 ${sp.smGap}">To</p>` +
    `<p style="margin:0 0 ${sp.pGap} 24px"><b>${escHtml(form.cname)}</b>${
      addr ? `<br>${addr}` : ''
    }${idsLine}</p>` +
    `<p style="margin:0 0 ${sp.pGap}">Dear Sir,</p>` +
    `<p style="margin:0 0 ${sp.pGap}">Thank you for purchasing a new <b>${escHtml(
      car
    )}</b> Car from us. We have received <b>Rs. ${inr(total)}/- (${amountInWords(
      total
    )})</b> from you against the above sale.</p>` +
    `<p style="margin:0 0 ${sp.smGap}">Below are the payments we received from you.</p>` +
    `<table style="border-collapse:collapse;width:100%;max-width:100%;box-sizing:border-box;margin-bottom:${sp.tblGap}" border="1" cellpadding="3">` +
    `<tr><td ${td}><b>Date</b></td><td ${td}><b><i>Chq. No. / Cash</i></b></td><td ${td}><b>Receipt No</b></td><td ${td} align="right"><b>Amount</b></td></tr>` +
    rows +
    `<tr><td ${td}></td><td ${td} align="right"><b>TOTAL</b></td><td ${td}></td><td ${td} align="right"><b>${inr(
      total
    )}</b></td></tr>` +
    `</table>` +
    `<p style="margin:0 0 ${sp.smGap}">We enclose the following documents for your records.</p>` +
    `<ol style="list-style-type:decimal;list-style-position:outside;margin:0 0 ${sp.tblGap} 16px;padding-left:24px">${items
      .map(
        (x) =>
          `<li style="display:list-item;list-style-type:decimal;margin-bottom:${sp.liGap};padding-left:6px">${x}</li>`
      )
      .join('')}</ol>` +
    `<p style="margin:0 0 ${sp.pGap}">We request you to kindly acknowledge the above transactions as this is the full &amp; final settlement of our sale contract.</p>` +
    `<p style="margin:0 0 ${sp.pGap}">For any queries In Payments made by you Please write to acc.varshacars@gmail.com<br>or call ${escHtml(
      form.phone
    )}</p>` +
    `<p style="margin:0 0 ${sp.pGap}">Thanking you and wishing a very Happy &amp; Safe Motoring.</p>` +
    `<p style="margin:0 0 ${sp.smGap}">Regards,</p>` +
    `<p style="margin:0 0 3pt">For Varsha Cars Pvt Ltd</p>` +
    sigBlock +
    `<p style="margin:0">Authorized Signature.</p>`
  );
}

export function downloadCoveringLetterDoc(
  form: CoveringLetterFormState,
  pays: CoveringPaymentRow[],
  density: LetterDensityLevel = 0
): void {
  const bodyHtml = buildCoveringLetterHtml(form, pays, density);
  const topMm = Math.min(80, Math.max(10, Number(form.headerTopMm) || 36));
  const bottomMm = Math.min(60, Math.max(12, Number(form.footerBottomMm) || 26));
  const ds = getLetterDensityStyle(density);
  const wordDoc =
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">' +
    `<head><meta charset="utf-8"><style>@page{size:A4;margin:${topMm}mm 18mm ${bottomMm}mm 18mm}body,p,td,li{font-family:Cambria,Georgia,serif;font-size:${ds.fontPt}pt;line-height:${ds.lineHeight}}ol{list-style-type:decimal;margin:0 0 9pt 16px;padding-left:24px}li{margin-bottom:2pt;padding-left:6px}</style></head>` +
    '<body>' +
    bodyHtml +
    '</body></html>';
  const blob = new Blob(['\ufeff', wordDoc], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Covering_${(form.cname.trim() || 'Customer').replace(/[^\w]+/g, '_')}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
