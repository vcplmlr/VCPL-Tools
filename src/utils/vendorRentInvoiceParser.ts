import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument } from 'pdf-lib';
import { createWorker, type Worker as TesseractWorker } from 'tesseract.js';
import { isValidGstin, parseNumber } from './invoiceParser';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface ParsedVendorRentInvoice {
  fileName: string;
  fileSizeBytes: number;
  pageCount: number;
  isPdf: boolean;
  isImage: boolean;
  extractionMethod: 'pdf-text' | 'pdf-ocr' | 'image-ocr';
  invoiceNo: string;
  invoiceDate: string; // YYYY-MM-DD
  rentMonth: string; // e.g. "May 2026"
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  gstAmount: number;
  totalAmount: number;
  gstType: 'cs' | 'i' | 'n';
  gstRate: number;
  recommendedMode: 'taxable' | 'total';
  vendorName: string;
  vendorAddress: string;
  vendorPan: string;
  vendorGstin: string;
  beneficiaryName: string;
  vendorBank: string;
  companyName: string;
  companyGstin: string;
  rawTextPreview: string;
  warnings: string[];
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const MONTH_SHORT_TO_FULL: Record<string, string> = {
  jan: 'January',
  january: 'January',
  feb: 'February',
  february: 'February',
  mar: 'March',
  march: 'March',
  apr: 'April',
  april: 'April',
  may: 'May',
  jun: 'June',
  june: 'June',
  jul: 'July',
  july: 'July',
  aug: 'August',
  august: 'August',
  sep: 'September',
  sept: 'September',
  september: 'September',
  oct: 'October',
  october: 'October',
  nov: 'November',
  november: 'November',
  dec: 'December',
  december: 'December',
};

const MONTH_KEY_TO_NUM: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function cleanLineText(s: string): string {
  return s.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeDateToIso(raw: string): string {
  const s = cleanLineText(raw);
  if (!s) return '';

  const ymd = s.match(/\b(\d{4})[./-](\d{1,2})[./-](\d{1,2})\b/);
  if (ymd) {
    const y = parseInt(ymd[1], 10);
    const m = parseInt(ymd[2], 10);
    const d = parseInt(ymd[3], 10);
    if (y >= 2000 && y <= 2099 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  const dmyNum = s.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/);
  if (dmyNum) {
    const d = parseInt(dmyNum[1], 10);
    const m = parseInt(dmyNum[2], 10);
    let y = parseInt(dmyNum[3], 10);
    if (y < 100) y += 2000;
    if (y >= 2000 && y <= 2099 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  const dmyAlpha = s.match(
    /\b(\d{1,2})[\s,./-]*(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[\s,./-]*(\d{2,4})\b/i
  );
  if (dmyAlpha) {
    const d = parseInt(dmyAlpha[1], 10);
    const m = MONTH_KEY_TO_NUM[dmyAlpha[2].toLowerCase()];
    let y = parseInt(dmyAlpha[3], 10);
    if (y < 100) y += 2000;
    if (m && y >= 2000 && y <= 2099 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  return '';
}

function formatMonthFromIso(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-\d{2}$/);
  if (!m) return '';
  const idx = parseInt(m[2], 10) - 1;
  return MONTH_NAMES[idx] ? `${MONTH_NAMES[idx]} ${m[1]}` : '';
}

function extractRentMonth(lines: string[], invoiceDateIso: string): string {
  const joined = lines.join('\n');

  // 1. Explicit phrase like "Rent for the month of May 2026" or "Billing Period: Apr 2026"
  const monthRegex =
    /(?:month\s*(?:of|:)?|period\s*(?:of|:)?|for\s+the\s+month\s*(?:of)?|rent\s*(?:for|month)?\s*[:\-]?|billing\s*month\s*[:\-]?)\s*(?:the\s+month\s+of\s+)?(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*['’,.\-\s]*(\d{2,4})/i;
  const m1 = joined.match(monthRegex);
  if (m1) {
    const full = MONTH_SHORT_TO_FULL[m1[1].toLowerCase()];
    let y = parseInt(m1[2], 10);
    if (y < 100) y += 2000;
    if (full && y >= 2000 && y <= 2099) return `${full} ${y}`;
  }

  // 2. Period range like "01-05-2026 to 31-05-2026" or "01/05/2026 - 31/05/2026"
  const rangeMatch = joined.match(
    /(?:period|from|rent)?\s*[:\-]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\s*(?:to|\-|–)\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i
  );
  if (rangeMatch) {
    const iso = normalizeDateToIso(rangeMatch[1]) || normalizeDateToIso(rangeMatch[2]);
    const formatted = formatMonthFromIso(iso);
    if (formatted) return formatted;
  }

  // 3. Standalone "May 2026" / "May-2026" / "May'26" in rent description lines
  for (const line of lines) {
    if (/rent|lease|premises|building|godown|showroom|office|period|month/i.test(line)) {
      const m2 = line.match(
        /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[\s,'\-\/]+(\d{2,4})\b/i
      );
      if (m2) {
        const full = MONTH_SHORT_TO_FULL[m2[1].toLowerCase()];
        let y = parseInt(m2[2], 10);
        if (y < 100) y += 2000;
        if (full && y >= 2000 && y <= 2099) return `${full} ${y}`;
      }
    }
  }

  // 4. Fallback to Invoice Date's Month & Year
  if (invoiceDateIso) {
    return formatMonthFromIso(invoiceDateIso);
  }

  return '';
}

function extractAmountTokensFromLine(line: string): number[] {
  const tokens: number[] = [];
  // Match currency amounts like 1,25,000.00 or 45000 or 45,000.50 (exclude 6-digit pincodes / 10-digit phones / years)
  const matches = line.matchAll(
    /(?:₹|rs\.?|inr)?\s*(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d{3,8}\.\d{1,2}|\d{4,7})(?:\s*\/-)?/gi
  );
  for (const m of matches) {
    const raw = m[1];
    // Ignore 4-digit years like 2025/2026 or percentages
    const afterIdx = (m.index ?? 0) + m[0].length;
    const nextChar = line.slice(afterIdx, afterIdx + 2).trim();
    if (nextChar.startsWith('%')) continue;
    const val = parseNumber(raw);
    if (val <= 0) continue;
    if (!raw.includes(',') && !raw.includes('.') && val >= 1990 && val <= 2099) continue;
    // Ignore obvious 6-digit Indian PIN codes when line mentions pin/address/road/street/sector
    if (
      !raw.includes(',') &&
      !raw.includes('.') &&
      raw.length === 6 &&
      /pin|address|road|street|nagar|layout|dist|karnataka|maharashtra|delhi|mangalore|bengaluru|bangalore|hyderabad|telangana|kerala/i.test(
        line
      )
    ) {
      continue;
    }
    tokens.push(val);
  }
  return tokens;
}

function snapGstSlab(rate: number): number {
  const slabs = [0, 5, 12, 18, 28];
  for (const s of slabs) {
    if (Math.abs(rate - s) <= 0.6) return s;
  }
  return Math.round(rate * 100) / 100;
}

function extractFinancials(lines: string[]): {
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  gstAmount: number;
  totalAmount: number;
  gstType: 'cs' | 'i' | 'n';
  gstRate: number;
  recommendedMode: 'taxable' | 'total';
} {
  let taxableAmount = 0;
  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;
  let totalAmount = 0;
  let explicitCgstPct = 0;
  let explicitSgstPct = 0;
  let explicitIgstPct = 0;
  let explicitGstPct = 0;

  for (const line of lines) {
    const lower = line.toLowerCase();
    const nums = extractAmountTokensFromLine(line);
    const lastNum = nums.length > 0 ? nums[nums.length - 1] : 0;

    // Detect explicit tax percentages on line
    const pctMatches = [...line.matchAll(/(\d{1,2}(?:\.\d{1,2})?)\s*%/g)].map((m) =>
      parseFloat(m[1])
    );

    if (/\bcgst\b/i.test(line)) {
      const validPct = pctMatches.find((p) => p > 0 && p <= 14);
      if (validPct) explicitCgstPct = validPct;
      if (lastNum > 0 && !/total/i.test(lower)) {
        cgstAmount = Math.max(cgstAmount, lastNum);
      } else if (nums.length > 0) {
        cgstAmount = Math.max(cgstAmount, nums[nums.length - 1]);
      }
      continue;
    }

    if (/\b(?:sgst|utgst)\b/i.test(line)) {
      const validPct = pctMatches.find((p) => p > 0 && p <= 14);
      if (validPct) explicitSgstPct = validPct;
      if (lastNum > 0) sgstAmount = Math.max(sgstAmount, lastNum);
      continue;
    }

    if (/\bigst\b/i.test(line)) {
      const validPct = pctMatches.find((p) => p > 0 && p <= 28);
      if (validPct) explicitIgstPct = validPct;
      if (lastNum > 0) igstAmount = Math.max(igstAmount, lastNum);
      continue;
    }

    if (
      /\b(?:taxable\s*(?:value|amount|amt|rent)|basic\s*(?:rent|value)|sub\s*total|subtotal|assessable\s*value|amount\s*before\s*tax)\b/i.test(
        lower
      ) &&
      !/grand\s*total|incl/i.test(lower)
    ) {
      if (lastNum > 0) taxableAmount = Math.max(taxableAmount, lastNum);
      continue;
    }

    if (
      /\b(?:grand\s*total|invoice\s*(?:total|value|amount)|total\s*(?:invoice\s*)?(?:amount|value|payable)|net\s*(?:amount\s*)?payable|total\s*incl\.?\s*gst)\b/i.test(
        lower
      ) &&
      !/in\s*words/i.test(lower)
    ) {
      if (lastNum > 0) totalAmount = Math.max(totalAmount, lastNum);
      continue;
    }

    // Fallback generic "Total" line (avoid "Total Taxable" which was caught above)
    if (/^\s*total\b/i.test(lower) && !/words/i.test(lower) && lastNum > 0) {
      totalAmount = Math.max(totalAmount, lastNum);
    }

    // Fallback Rent line item (e.g., "Monthly Rent for Office ... 997212 1 1,00,000.00 1,00,000.00")
    if (
      /\b(?:rent|lease|hire|license\s*fee)\b/i.test(lower) &&
      !/invoice|gst|pan|tan|account|agreement|letter|taxable/i.test(lower) &&
      nums.length > 0
    ) {
      const candidate = nums[nums.length - 1];
      if (candidate > 500 && taxableAmount === 0) {
        taxableAmount = candidate;
      }
      const gstHit = pctMatches.find((p) => [5, 12, 18, 28].includes(p));
      if (gstHit) explicitGstPct = gstHit;
    }
  }

  // Handle combined CGST+SGST line if both words appear on one line
  for (const line of lines) {
    if (/\bcgst\b/i.test(line) && /\bsgst\b/i.test(line)) {
      const nums = extractAmountTokensFromLine(line);
      if (nums.length >= 2) {
        cgstAmount = nums[0];
        sgstAmount = nums[1];
      }
    }
  }

  const csSum = Math.round((cgstAmount + sgstAmount) * 100) / 100;
  let gstType: 'cs' | 'i' | 'n' = 'n';
  let gstAmount = 0;
  let gstRate = 18;

  if (csSum > 0 || explicitCgstPct > 0 || explicitSgstPct > 0) {
    gstType = 'cs';
    gstAmount = csSum;
    if (explicitCgstPct > 0 || explicitSgstPct > 0) {
      gstRate = snapGstSlab((explicitCgstPct || explicitSgstPct) * 2);
    }
  } else if (igstAmount > 0 || explicitIgstPct > 0) {
    gstType = 'i';
    gstAmount = igstAmount;
    if (explicitIgstPct > 0) {
      gstRate = snapGstSlab(explicitIgstPct);
    }
  } else if (taxableAmount > 0 && totalAmount > taxableAmount + 5) {
    gstAmount = Math.round((totalAmount - taxableAmount) * 100) / 100;
    gstType = 'cs';
  } else if (explicitGstPct > 0) {
    gstType = 'cs';
    gstRate = explicitGstPct;
  }

  // Reconcile taxable / total if one is missing
  if (taxableAmount > 0 && totalAmount === 0) {
    totalAmount = Math.round((taxableAmount + gstAmount) * 100) / 100;
  }
  if (totalAmount > 0 && taxableAmount === 0 && gstAmount > 0 && totalAmount > gstAmount) {
    taxableAmount = Math.round((totalAmount - gstAmount) * 100) / 100;
  }

  if (taxableAmount > 0 && gstAmount > 0 && explicitCgstPct === 0 && explicitIgstPct === 0) {
    gstRate = snapGstSlab((gstAmount / taxableAmount) * 100);
  }

  const recommendedMode: 'taxable' | 'total' =
    taxableAmount > 0 ? 'taxable' : totalAmount > 0 ? 'total' : 'taxable';

  return {
    taxableAmount: Math.round(taxableAmount * 100) / 100,
    cgstAmount: Math.round(cgstAmount * 100) / 100,
    sgstAmount: Math.round(sgstAmount * 100) / 100,
    igstAmount: Math.round(igstAmount * 100) / 100,
    gstAmount: Math.round(gstAmount * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
    gstType,
    gstRate: gstType === 'n' ? 0 : gstRate || 18,
    recommendedMode,
  };
}

function extractPartiesAndBank(lines: string[]): {
  vendorName: string;
  vendorAddress: string;
  vendorPan: string;
  vendorGstin: string;
  beneficiaryName: string;
  vendorBank: string;
  companyName: string;
  companyGstin: string;
  invoiceNo: string;
  invoiceDate: string;
} {
  let invoiceNo = '';
  let invoiceDate = '';

  const gstinRegex = /\b(\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9])\b/gi;
  const panRegex = /\b([A-Z]{5}\d{4}[A-Z])\b/gi;

  const gstinCandidates: Array<{ gstin: string; lineIdx: number; line: string }> = [];
  const panCandidates: Array<{ pan: string; lineIdx: number; line: string }> = [];

  let billToIdx = -1;
  let bankSectionIdx = -1;

  lines.forEach((line, idx) => {
    if (
      billToIdx === -1 &&
      /\b(?:bill\s*to|billed\s*to|buyer|recipient|consignee|customer\s*details|details\s*of\s*receiver|tenant)\b/i.test(
        line
      )
    ) {
      billToIdx = idx;
    }

    if (
      bankSectionIdx === -1 &&
      /\b(?:bank\s*details|remittance\s*details|account\s*details|pay\s*to|neft\s*\/\s*rtgs|ifsc)\b/i.test(
        line
      )
    ) {
      bankSectionIdx = idx;
    }

    // Invoice No
    if (!invoiceNo) {
      const invMatch = line.match(
        /\b(?:invoice\s*(?:no|number|#)|inv\.?\s*(?:no|#)|bill\s*(?:no|number|#)|document\s*no)\s*[:.\-#]?\s*([A-Z0-9][A-Z0-9\/\-_]{1,28})/i
      );
      if (invMatch && !/date|gstin|amount|value|tax/i.test(invMatch[1])) {
        invoiceNo = invMatch[1].trim();
      }
    }

    // Invoice Date
    if (!invoiceDate) {
      const dateLabelMatch = line.match(
        /\b(?:invoice\s*date|inv\.?\s*date|bill\s*date|dated?)\s*[:.\-]?\s*([^\n|]{6,24})/i
      );
      if (dateLabelMatch) {
        const parsed = normalizeDateToIso(dateLabelMatch[1]);
        if (parsed) invoiceDate = parsed;
      }
    }

    for (const m of line.matchAll(gstinRegex)) {
      const g = m[1].toUpperCase();
      if (isValidGstin(g) && !gstinCandidates.some((x) => x.gstin === g)) {
        gstinCandidates.push({ gstin: g, lineIdx: idx, line });
      }
    }

    for (const m of line.matchAll(panRegex)) {
      const p = m[1].toUpperCase();
      // Exclude matches that sit inside an already-captured 15-char GSTIN
      const isInsideGstin = gstinCandidates.some((g) => g.gstin.includes(p) && g.lineIdx === idx);
      if (!isInsideGstin && !panCandidates.some((x) => x.pan === p)) {
        panCandidates.push({ pan: p, lineIdx: idx, line });
      }
    }
  });

  // Fallback invoice date: first valid date in top 25 lines
  if (!invoiceDate) {
    for (let i = 0; i < Math.min(lines.length, 25); i++) {
      const parsed = normalizeDateToIso(lines[i]);
      if (parsed) {
        invoiceDate = parsed;
        break;
      }
    }
  }

  // Classify Vendor GSTIN vs Company (Tenant/Buyer) GSTIN
  let vendorGstin = '';
  let companyGstin = '';

  if (gstinCandidates.length === 1) {
    const only = gstinCandidates[0];
    if (billToIdx !== -1 && only.lineIdx > billToIdx && !/supplier|vendor|landlord|from/i.test(only.line)) {
      companyGstin = only.gstin;
    } else {
      vendorGstin = only.gstin;
    }
  } else if (gstinCandidates.length >= 2) {
    const buyerHit = gstinCandidates.find(
      (c) =>
        /buyer|bill\s*to|recipient|customer|tenant/i.test(c.line) ||
        (billToIdx !== -1 && c.lineIdx >= billToIdx && c.lineIdx <= billToIdx + 8)
    );
    const vendorHit = gstinCandidates.find((c) => c !== buyerHit);
    vendorGstin = vendorHit?.gstin || gstinCandidates[0].gstin;
    companyGstin = buyerHit?.gstin || gstinCandidates[1].gstin;
  }

  // Vendor PAN: explicit non-buyer PAN first, otherwise characters [2..12] of Vendor GSTIN
  let vendorPan = '';
  const explicitVendorPan = panCandidates.find(
    (p) =>
      !/buyer|recipient|tenant|company\s*pan|deductor/i.test(p.line) &&
      (!companyGstin || !companyGstin.includes(p.pan)) &&
      (billToIdx === -1 || p.lineIdx < billToIdx || /landlord|vendor|supplier|pan\s*[:\-]/i.test(p.line))
  );
  if (explicitVendorPan) {
    vendorPan = explicitVendorPan.pan;
  } else if (vendorGstin.length === 15) {
    vendorPan = vendorGstin.slice(2, 12);
  }

  // Vendor Name heuristics:
  // 1) Explicit "For <Vendor Name>" at signature footer
  // 2) Explicit "Landlord / Vendor / Supplier / Owner Name:"
  // 3) First meaningful top-header entity line before Tax Invoice / Address / Bill To
  let vendorName = '';
  const skipHeaderRegex =
    /^(?:tax\s*invoice|commercial\s*invoice|invoice|bill\s*of\s*supply|rent\s*(?:bill|invoice|receipt)|original\s*for|duplicate\s*for|triplicate|page\s*\d|gstin|pan|cin|state|email|ph(?:one)?|mob|tel|date|invoice\s*no)/i;

  for (const line of lines) {
    const labeled = line.match(
      /^(?:supplier|vendor|landlord|lessor|owner|from|billed\s*by)\s*(?:name)?\s*[:\-]\s*(.+)$/i
    );
    if (labeled && labeled[1].trim().length >= 3) {
      vendorName = labeled[1].split(/\s{2,}|\bgstin\b|\bpan\b/i)[0].trim();
      break;
    }
  }

  if (!vendorName) {
    for (let i = lines.length - 1; i >= Math.max(0, lines.length - 15); i--) {
      const m = lines[i].match(/^for\s+([A-Za-z0-9.&,'()\-\s]{3,65})$/i);
      if (m && !/recipient|tenant|buyer|reference/i.test(m[1])) {
        vendorName = m[1].replace(/[.,]+$/, '').trim();
        break;
      }
    }
  }

  if (!vendorName) {
    const searchLimit = billToIdx > 0 ? Math.min(billToIdx, 12) : 12;
    for (let i = 0; i < Math.min(lines.length, searchLimit); i++) {
      const ln = lines[i];
      if (
        ln.length >= 3 &&
        ln.length <= 72 &&
        !skipHeaderRegex.test(ln) &&
        !/^\d+[\/\-.\d\s]*$/.test(ln) &&
        /[A-Za-z]{3,}/.test(ln)
      ) {
        vendorName = ln.replace(/\s*\(?\s*GSTIN.*$/i, '').trim();
        break;
      }
    }
  }

  // Vendor Address lines (lines between Vendor Name and Bill To / Invoice metadata)
  let vendorAddress = '';
  if (vendorName) {
    const startIdx = lines.findIndex((l) => l.toLowerCase().includes(vendorName.toLowerCase()));
    if (startIdx !== -1) {
      const addrLines: string[] = [];
      const stopAt = billToIdx > startIdx ? Math.min(billToIdx, startIdx + 7) : Math.min(lines.length, startIdx + 7);
      for (let i = startIdx + 1; i < stopAt; i++) {
        const l = lines[i];
        if (
          /^(?:gstin|pan|cin|invoice|bill\s*no|dated?|state\s*code|ph(?:one)?|mob|email|tax\s*invoice|sl\.?\s*no|particulars|description)/i.test(
            l
          )
        ) {
          break;
        }
        if (vendorGstin && l.includes(vendorGstin)) {
          const stripped = l.replace(gstinRegex, '').replace(/gstin\s*[:\-]?/gi, '').trim();
          if (stripped.length > 4) addrLines.push(stripped);
          continue;
        }
        addrLines.push(l);
        if (/\b\d{6}\b/.test(l) || addrLines.length >= 4) break;
      }
      vendorAddress = addrLines.join('\n');
    }
  }

  // Company / Buyer / Tenant Name
  let companyName = '';
  if (billToIdx !== -1) {
    for (let i = billToIdx; i < Math.min(lines.length, billToIdx + 5); i++) {
      const ln = lines[i]
        .replace(
          /^(?:bill\s*to|billed\s*to|buyer|recipient|consignee|customer\s*details|details\s*of\s*receiver|tenant)\s*[:\-]?\s*/i,
          ''
        )
        .trim();
      if (
        ln.length >= 3 &&
        !/^(?:name|address|gstin|pan|state|m\/s\.?)$/i.test(ln) &&
        /[A-Za-z]{3,}/.test(ln)
      ) {
        companyName = ln.replace(/^m\/s\.?\s*/i, '').replace(/\s*gstin.*$/i, '').trim();
        break;
      }
    }
  }

  // Bank Details
  let vendorBank = '';
  let beneficiaryName = '';
  const bankSearchStart = bankSectionIdx !== -1 ? bankSectionIdx : Math.max(0, lines.length - 18);
  const bankWindow = lines.slice(bankSearchStart, Math.min(lines.length, bankSearchStart + 14));

  let bankNameOnly = '';
  let branchOnly = '';
  for (const bLine of bankWindow) {
    if (!beneficiaryName) {
      const ben = bLine.match(
        /\b(?:a\/?c\s*(?:holder|name)|account\s*(?:holder|name)|beneficiary(?:\s*name)?|favour\s*of)\s*[:\-]\s*(.+)$/i
      );
      if (ben) beneficiaryName = ben[1].trim();
    }
    if (!bankNameOnly) {
      const bnm = bLine.match(/\b(?:bank\s*name|name\s*of\s*bank)\s*[:\-]\s*(.+)$/i);
      if (bnm) {
        bankNameOnly = bnm[1].split(/\s*(?:,|branch|a\/?c|ifsc)/i)[0].trim();
      } else {
        const knownBank = bLine.match(
          /\b((?:State Bank of India|SBI|HDFC Bank|ICICI Bank|Axis Bank|Kotak Mahindra Bank|Canara Bank|Bank of Baroda|Union Bank of India|Punjab National Bank|IDFC First Bank|IndusInd Bank|Yes Bank|Federal Bank|Karnataka Bank|South Indian Bank|Indian Bank)[^,|;]*)/i
        );
        if (knownBank) bankNameOnly = knownBank[1].trim();
      }
    }
    if (!branchOnly) {
      const br = bLine.match(/\bbranch\s*[:\-]\s*([^,|;]+)/i);
      if (br) branchOnly = br[1].trim();
    }
  }

  if (bankNameOnly) {
    vendorBank =
      branchOnly && !bankNameOnly.toLowerCase().includes(branchOnly.toLowerCase())
        ? `${bankNameOnly}, ${branchOnly}`
        : bankNameOnly;
  }

  return {
    vendorName,
    vendorAddress,
    vendorPan,
    vendorGstin,
    beneficiaryName: beneficiaryName || vendorName,
    vendorBank,
    companyName,
    companyGstin,
    invoiceNo,
    invoiceDate,
  };
}

async function extractTextLinesFromPdf(
  bytes: Uint8Array
): Promise<{ lines: string[]; pageCount: number; doc: pdfjsLib.PDFDocumentProxy }> {
  const doc = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
  const allLines: string[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();

    interface WordPiece {
      str: string;
      x: number;
      y: number;
    }

    const pieces: WordPiece[] = [];
    for (const item of content.items) {
      if (!('str' in item)) continue;
      const text = cleanLineText(item.str || '');
      if (!text) continue;
      const t = item.transform || [1, 0, 0, 1, 0, 0];
      pieces.push({ str: text, x: t[4], y: t[5] });
    }

    pieces.sort((a, b) => b.y - a.y || a.x - b.x);

    const rows: Array<{ y: number; items: WordPiece[] }> = [];
    for (const piece of pieces) {
      const last = rows[rows.length - 1];
      if (last && Math.abs(last.y - piece.y) <= 3.5) {
        last.items.push(piece);
      } else {
        rows.push({ y: piece.y, items: [piece] });
      }
    }

    for (const row of rows) {
      row.items.sort((a, b) => a.x - b.x);
      const joined = cleanLineText(row.items.map((i) => i.str).join(' '));
      if (joined) allLines.push(joined);
    }
  }

  return { lines: allLines, pageCount: doc.numPages, doc };
}

async function runOcrOnCanvas(canvas: HTMLCanvasElement): Promise<string[]> {
  let worker: TesseractWorker | null = null;
  try {
    worker = await createWorker('eng');
    const result = await worker.recognize(canvas);
    return (result.data.text || '')
      .split(/\r?\n/)
      .map(cleanLineText)
      .filter(Boolean);
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch {
        // ignore termination cleanup error
      }
    }
  }
}

async function renderPdfPageToCanvas(
  doc: pdfjsLib.PDFDocumentProxy,
  pageNumber: number
): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable for OCR.');
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  return canvas;
}

function loadImageToCanvas(file: File): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 1;
      canvas.height = img.naturalHeight || 1;
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
      reject(new Error('Could not decode image invoice.'));
    };
    img.src = url;
  });
}

export async function parseVendorRentInvoiceFile(
  file: File,
  onProgress?: (pct: number) => void
): Promise<{ parsed: ParsedVendorRentInvoice; bytes: Uint8Array }> {
  const isPdf =
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const isImage =
    file.type.startsWith('image/') ||
    /\.(png|jpe?g|webp|bmp)$/i.test(file.name);

  if (!isPdf && !isImage) {
    throw new Error('Please upload a PDF (.pdf) or scanned image invoice (.png, .jpg).');
  }

  onProgress?.(20);
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  let lines: string[] = [];
  let pageCount = 1;
  let extractionMethod: ParsedVendorRentInvoice['extractionMethod'] = 'pdf-text';
  const warnings: string[] = [];

  if (isPdf) {
    const { lines: pdfLines, pageCount: totalPages, doc } = await extractTextLinesFromPdf(bytes);
    pageCount = totalPages;
    lines = pdfLines;
    onProgress?.(55);

    const charCount = lines.join('').length;
    if (charCount < 45) {
      extractionMethod = 'pdf-ocr';
      const ocrLines: string[] = [];
      const pagesToScan = Math.min(2, totalPages);
      for (let p = 1; p <= pagesToScan; p++) {
        const canvas = await renderPdfPageToCanvas(doc, p);
        const pageLines = await runOcrOnCanvas(canvas);
        ocrLines.push(...pageLines);
        onProgress?.(55 + Math.round((p / pagesToScan) * 35));
      }
      lines = ocrLines;
      if (lines.join('').length < 25) {
        warnings.push('Scanned PDF text was sparse; review extracted values manually.');
      }
    }
    try {
      await doc.cleanup();
    } catch {
      // ignore cleanup error
    }
  } else {
    extractionMethod = 'image-ocr';
    const canvas = await loadImageToCanvas(file);
    onProgress?.(45);
    lines = await runOcrOnCanvas(canvas);
    onProgress?.(90);
  }

  const parties = extractPartiesAndBank(lines);
  const financials = extractFinancials(lines);
  const rentMonth = extractRentMonth(lines, parties.invoiceDate);

  if (financials.taxableAmount === 0 && financials.totalAmount === 0) {
    warnings.push('Could not auto-detect rent amount from invoice; enter Rent Amount manually.');
  }

  onProgress?.(100);

  return {
    bytes,
    parsed: {
      fileName: file.name,
      fileSizeBytes: file.size,
      pageCount,
      isPdf,
      isImage,
      extractionMethod,
      invoiceNo: parties.invoiceNo,
      invoiceDate: parties.invoiceDate,
      rentMonth,
      taxableAmount: financials.taxableAmount,
      cgstAmount: financials.cgstAmount,
      sgstAmount: financials.sgstAmount,
      igstAmount: financials.igstAmount,
      gstAmount: financials.gstAmount,
      totalAmount: financials.totalAmount,
      gstType: financials.gstType,
      gstRate: financials.gstRate,
      recommendedMode: financials.recommendedMode,
      vendorName: parties.vendorName,
      vendorAddress: parties.vendorAddress,
      vendorPan: parties.vendorPan,
      vendorGstin: parties.vendorGstin,
      beneficiaryName: parties.beneficiaryName,
      vendorBank: parties.vendorBank,
      companyName: parties.companyName,
      companyGstin: parties.companyGstin,
      rawTextPreview: lines.slice(0, 18).join('\n'),
      warnings,
    },
  };
}

export async function mergeRentLetterWithVendorInvoice(
  letterPdfBytes: ArrayBuffer | Uint8Array,
  vendorFile: { bytes: Uint8Array; isPdf: boolean; isImage: boolean; fileName: string }
): Promise<Uint8Array> {
  const merged = await PDFDocument.create();
  const letterDoc = await PDFDocument.load(letterPdfBytes);
  const letterPages = await merged.copyPages(letterDoc, letterDoc.getPageIndices());
  for (const p of letterPages) {
    merged.addPage(p);
  }

  if (vendorFile.isPdf) {
    const vendorDoc = await PDFDocument.load(vendorFile.bytes, { ignoreEncryption: true });
    const vendorPages = await merged.copyPages(vendorDoc, vendorDoc.getPageIndices());
    for (const p of vendorPages) {
      merged.addPage(p);
    }
  } else if (vendorFile.isImage) {
    // Embed image invoice cleanly onto a portrait A4 page (595.28 x 841.89 pt)
    const isPng = vendorFile.bytes[0] === 0x89 && vendorFile.bytes[1] === 0x50;
    const isJpg = vendorFile.bytes[0] === 0xff && vendorFile.bytes[1] === 0xd8;

    let embedded;
    if (isPng) {
      embedded = await merged.embedPng(vendorFile.bytes);
    } else if (isJpg) {
      embedded = await merged.embedJpg(vendorFile.bytes);
    } else {
      const blob = new Blob([new Uint8Array(vendorFile.bytes)]);
      const url = URL.createObjectURL(blob);
      const pngBytes = await new Promise<ArrayBuffer>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || 1;
          canvas.height = img.naturalHeight || 1;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            URL.revokeObjectURL(url);
            reject(new Error('Canvas unavailable'));
            return;
          }
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((outBlob) => {
            URL.revokeObjectURL(url);
            if (!outBlob) {
              reject(new Error('Image conversion failed'));
              return;
            }
            resolve(outBlob.arrayBuffer());
          }, 'image/png');
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('Unsupported invoice image format'));
        };
        img.src = url;
      });
      embedded = await merged.embedPng(pngBytes);
    }

    const a4W = 595.28;
    const a4H = 841.89;
    const margin = 24;
    const maxW = a4W - margin * 2;
    const maxH = a4H - margin * 2;
    const scale = Math.min(maxW / embedded.width, maxH / embedded.height, 1);
    const drawW = embedded.width * scale;
    const drawH = embedded.height * scale;
    const page = merged.addPage([a4W, a4H]);
    page.drawImage(embedded, {
      x: (a4W - drawW) / 2,
      y: a4H - margin - drawH,
      width: drawW,
      height: drawH,
    });
  }

  return merged.save();
}
