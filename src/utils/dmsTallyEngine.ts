import * as XLSX from 'xlsx';

export const CATS = ['Sales', 'Purchase', 'Debit Note', 'Credit Note', 'Other'] as const;
export type VoucherCategory = (typeof CATS)[number];
export type CategoryOverride = 'Auto' | VoucherCategory;
export type SideKey = 'dms' | 'tally';
export type FieldKey = 'vno' | 'date' | 'party' | 'amt' | 'amt2' | 'type';

export const FIELDS: ReadonlyArray<[FieldKey, string]> = [
  ['vno', 'Voucher / Invoice No'],
  ['date', 'Date'],
  ['party', 'Party'],
  ['amt', 'Total Amount (with Tax)'],
  ['amt2', 'Amount 2 (e.g. Credit)'],
  ['type', 'Type / Vch Type'],
];

export type ReconStatus =
  | 'Matched'
  | 'Amount diff'
  | 'Date diff'
  | 'Type diff'
  | 'Fuzzy match'
  | 'Only in DMS'
  | 'Only in Tally';

export const STATUS_ORDER: ReconStatus[] = [
  'Matched',
  'Amount diff',
  'Date diff',
  'Type diff',
  'Fuzzy match',
  'Only in DMS',
  'Only in Tally',
];

export interface UploadedSheetFile {
  id: string;
  name: string;
  headers: string[];
  rows: unknown[][];
  ov: CategoryOverride;
}

export interface SideState {
  files: UploadedSheetFile[];
  map: Partial<Record<FieldKey, string>>;
  inc: Set<VoucherCategory>;
}

export interface NormalizedEntry {
  side: SideKey;
  file: string;
  vno: string;
  key: string;
  date: number | null;
  party: string;
  amt: number;
  cat: VoucherCategory;
  used?: boolean;
}

export interface ReconRow {
  status: ReconStatus;
  cat: VoucherCategory;
  vd: string;
  vt: string;
  dd: number | null;
  dt: number | null;
  party: string;
  a: number | null;
  b: number | null;
  diff: number;
  notes: string;
}

export type AmountColumnRole = 'total' | 'debit' | 'credit' | 'taxable' | 'tax' | 'component' | 'generic' | 'non_amount';

export interface AmountColumnAssessment {
  header: string;
  role: AmountColumnRole;
  warning: string | null;
  suggestedTotalHeader: string | null;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export function formatMoney(n: number | null | undefined): string {
  if (n == null) return '';
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatExcelDate(n: number | null | undefined): string {
  if (n == null) return '';
  const d = new Date(Date.UTC(1899, 11, 30) + n * 864e5);
  return (
    String(d.getUTCDate()).padStart(2, '0') +
    '-' +
    String(d.getUTCMonth() + 1).padStart(2, '0') +
    '-' +
    d.getUTCFullYear()
  );
}

export function parseExcelDate(v: unknown): number | null {
  if (typeof v === 'number') {
    return v > 20000 && v < 80000 ? Math.floor(v) : null;
  }
  if (!v) return null;
  const m = String(v)
    .trim()
    .match(/(\d{1,2})[-/. ]([A-Za-z]{3}|\d{1,2})[-/. ](\d{2,4})/);
  if (!m) return null;
  const mo = Number.isNaN(Number(m[2]))
    ? MONTHS.indexOf(m[2].toLowerCase())
    : Number(m[2]) - 1;
  let y = Number(m[3]);
  if (y < 100) y += 2000;
  if (mo < 0 || mo > 11) return null;
  return Math.floor(Date.UTC(y, mo, Number(m[1])) / 864e5) + 25569;
}

export function parseNumber(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const s = String(v ?? '').trim();
  if (!s) return 0;
  const cleaned = s.replace(/[,₹\s]/g, '').replace(/\(([^)]+)\)/, '-$1');
  const x = parseFloat(cleaned);
  return Number.isNaN(x) ? 0 : x;
}

export function parseStrictNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v ?? '').trim();
  if (!s) return null;
  const cleaned = s.replace(/[,₹$\s]/g, '').replace(/^(rs\.?|inr)\s*/i, '').replace(/\(([^)]+)\)/, '-$1');
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const x = parseFloat(cleaned);
  return Number.isFinite(x) ? x : null;
}

export function normalizeHeader(h: string): string {
  return String(h || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/#/g, ' no ')
    .replace(/[₹]/g, ' ')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[_\-/.()[\]:,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const TAXABLE_RX =
  /\b(taxable|assessable|tax\s*base|basic|base\s*(amt|amount|val|value|price)|before\s*tax|without\s*tax|excl\w*\s*(of\s*)?(tax|gst)|ex\s*(tax|gst)|pre\s*(tax|gst)|sub\s*total|subtotal|non\s*taxable)\b/;

const TAX_ONLY_RX =
  /\b(cgst|sgst|igst|ugst|utgst|cess|vat|tds|tcs|gst\s*(amt|amount|val|value)|tax\s*(amt|amount|val|value)|total\s*tax|total\s*gst|output\s*tax|input\s*tax)\b/;

const OTHER_COMPONENT_RX =
  /\b(discount|disc|rebate|round\s*off|roundoff|rounding|freight|packing|forwarding|insurance|handling|labour|commission|margin|brokerage)\b/;

const NON_AMOUNT_FIELD_RX =
  /\b(vch\s*no|voucher\s*no|invoice\s*no|inv\s*no|bill\s*no|doc\s*no|document\s*no|ref\s*no|reference\s*no|date|particulars|party\s*name|customer\s*name|billing\s*customer|account\s*name|ledger\s*name|gstin|gst\s*no|pan|tan|tin|hsn|sac|qty|quantity|rate|unit\s*price|mrp|phone|mobile|contact|pin\s*code|pincode|zip|sr\s*no|sl\s*no|s\s*no|serial|narration|remarks|state\s*code|vch\s*type|voucher\s*type|credit\s*note|debit\s*note|credit\s*memo|debit\s*memo|credit\s*days|credit\s*limit|credit\s*period|percent|percentage)\b/;

const WITH_TAX_INDICATOR_RX =
  /\b(with\s*tax|with\s*gst|incl\w*\s*(of\s*)?(tax|gst)|including\s*(tax|gst)|after\s*tax)\b/;

export function classifyAmountHeader(header: string): AmountColumnRole {
  const norm = normalizeHeader(header);
  if (!norm) return 'non_amount';

  if (/%/.test(header) || NON_AMOUNT_FIELD_RX.test(norm)) {
    return 'non_amount';
  }
  if (TAXABLE_RX.test(norm)) {
    return 'taxable';
  }
  if (TAX_ONLY_RX.test(norm) && !WITH_TAX_INDICATOR_RX.test(norm)) {
    return 'tax';
  }
  if (OTHER_COMPONENT_RX.test(norm)) {
    return 'component';
  }
  if (/^credit(\s*(amount|amt|val|value))?$/.test(norm) || /^cr(\s*(amount|amt|val|value))?$/.test(norm)) {
    return 'credit';
  }
  if (/^debit(\s*(amount|amt|val|value))?$/.test(norm) || /^dr(\s*(amount|amt|val|value))?$/.test(norm)) {
    return 'debit';
  }
  if (
    WITH_TAX_INDICATOR_RX.test(norm) ||
    /\b(grand|gross|final)\s*(total|amount|amt|val|value|invoice|bill)?\b/.test(norm) ||
    /\b(total|invoice|inv|bill|doc|document|voucher|vch|net)\s*(total|amount|amt|val|value|payable)\b/.test(norm) ||
    /\b(net\s*payable|total\s*payable|amount\s*payable|payable\s*(amount|amt)|amt\s*payable|customer\s*payable)\b/.test(norm) ||
    /^(total|tot\s*amt|tot\s*val|inv\s*tot|bill\s*tot)$/.test(norm)
  ) {
    return 'total';
  }
  if (/\b(amount|amt|value|val|payable)\b/.test(norm)) {
    return 'generic';
  }
  return 'non_amount';
}

interface ColumnStats {
  numericCount: number;
  nonZeroCount: number;
  nonEmptyCount: number;
  avgAbs: number;
}

function computeColumnStats(rows: unknown[][], colCount: number): ColumnStats[] {
  const stats: ColumnStats[] = Array.from({ length: colCount }, () => ({
    numericCount: 0,
    nonZeroCount: 0,
    nonEmptyCount: 0,
    avgAbs: 0,
  }));
  const sums = new Array<number>(colCount).fill(0);

  const sampleLimit = Math.min(rows.length, 80);
  for (let rIdx = 0; rIdx < sampleLimit; rIdx++) {
    const row = rows[rIdx] || [];
    for (let c = 0; c < colCount; c++) {
      const cell = row[c];
      if (cell !== '' && cell !== null && cell !== undefined) {
        stats[c].nonEmptyCount++;
        const num = parseStrictNumber(cell);
        if (num !== null) {
          stats[c].numericCount++;
          if (Math.abs(num) > 0) {
            stats[c].nonZeroCount++;
            sums[c] += Math.abs(num);
          }
        }
      }
    }
  }

  for (let c = 0; c < colCount; c++) {
    stats[c].avgAbs = stats[c].nonZeroCount > 0 ? sums[c] / stats[c].nonZeroCount : 0;
  }

  return stats;
}

function scoreAmountHeaderBase(header: string): number {
  const norm = normalizeHeader(header);
  if (!norm) return -1000;

  if (/%/.test(header) || NON_AMOUNT_FIELD_RX.test(norm)) {
    return -1000;
  }
  if (TAXABLE_RX.test(norm)) {
    return -350;
  }
  if (TAX_ONLY_RX.test(norm) && !WITH_TAX_INDICATOR_RX.test(norm)) {
    return -350;
  }
  if (OTHER_COMPONENT_RX.test(norm)) {
    return -250;
  }

  // Highest confidence: explicit final/grand/with-tax invoice total
  if (/\b(final|grand|gross|total|invoice|inv|bill|net|amount|amt|val|value|payable)\b.*\b(with\s*tax|with\s*gst|incl\w*\s*(of\s*)?(tax|gst)|including\s*(tax|gst)|after\s*tax)\b/.test(norm)) {
    return 170;
  }
  if (/\bgrand\s*(total|amount|amt|val|value|invoice|bill)\b/.test(norm)) {
    return 160;
  }
  if (/\bfinal\s*(amount|amt|total|val|value|invoice|bill)\b/.test(norm)) {
    return 155;
  }
  if (/\bgross\s*(total|amount|amt|val|value|invoice|bill)\b/.test(norm)) {
    return 150;
  }
  if (/\b(net\s*payable|total\s*payable|amount\s*payable|payable\s*(amount|amt)|amt\s*payable)\b/.test(norm)) {
    return 145;
  }
  if (/\b((total|tot)\s*(invoice|inv|bill|doc|document|voucher|vch)\s*(amount|amt|val|value|total|tot)?|(invoice|inv|bill|doc|document|voucher|vch)\s*(total|tot))\b/.test(norm)) {
    return 140;
  }
  if (/\b(total\s*(amount|amt|val|value)|tot\s*(amount|amt|val|value))\b/.test(norm)) {
    return 130;
  }
  if (/\b(invoice|inv|bill|doc|document)\s*(amount|amt|val|value)\b/.test(norm)) {
    return 125;
  }
  if (/^(net\s*(total|amount|amt|val|value)|net\s*(invoice|bill)\s*(amount|amt|val|value))$/.test(norm)) {
    return 100;
  }
  if (/^debit(\s*(amount|amt|val|value))?$/.test(norm) || /^dr(\s*(amount|amt|val|value))?$/.test(norm)) {
    return 95;
  }
  if (/^(total|tot)$/.test(norm)) {
    return 90;
  }
  if (/^(amount|amt|value|val)$/.test(norm)) {
    return 65;
  }
  if (/\b(amount|amt|total|tot|value|val|payable|debit)\b/.test(norm)) {
    return 45;
  }
  return -1000;
}

function scoreFieldHeader(
  header: string,
  field: FieldKey,
  idx: number,
  headers: string[],
  stats: ColumnStats[]
): number {
  const norm = normalizeHeader(header);
  if (!norm) return -1000;

  if (field === 'amt') {
    let score = scoreAmountHeaderBase(header);
    if (score <= -900) return score;

    const colStat = stats[idx];
    if (colStat && colStat.nonEmptyCount > 0 && colStat.numericCount === 0) {
      return -800; // purely non-numeric column cannot be an amount column
    }

    // If sheet has tax columns (CGST/SGST/IGST/Tax), an eligible amount column positioned
    // to the right of the last tax column is typically the final invoice total (e.g., "Total" after "Net Amount" + taxes).
    let lastTaxIdx = -1;
    headers.forEach((h, i) => {
      const hn = normalizeHeader(h);
      if (TAX_ONLY_RX.test(hn) && !WITH_TAX_INDICATOR_RX.test(hn)) {
        lastTaxIdx = Math.max(lastTaxIdx, i);
      }
    });

    if (lastTaxIdx >= 0 && score > 0) {
      if (idx > lastTaxIdx) {
        score += 35;
      } else if (/^net\s*(total|amount|amt|val|value)$/.test(norm) || /^(amount|amt)$/.test(norm)) {
        // Generic/Net column sitting to the LEFT of CGST/SGST is often pre-tax subtotal
        score -= 20;
      }
    }

    // Magnitude tie-breaker among valid non-taxable positive amount columns:
    // Invoice Total (incl. tax) is >= Taxable / Subtotal.
    if (score > 0 && colStat && colStat.avgAbs > 0) {
      const maxPositiveAvg = headers.reduce((mx, h, i) => {
        if (scoreAmountHeaderBase(h) > 0 && stats[i]?.avgAbs) {
          return Math.max(mx, stats[i].avgAbs);
        }
        return mx;
      }, 0);
      if (maxPositiveAvg > 0) {
        score += Math.round((colStat.avgAbs / maxPositiveAvg) * 15);
      }
    }

    return score;
  }

  if (field === 'amt2') {
    if (/%/.test(header) || TAXABLE_RX.test(norm) || TAX_ONLY_RX.test(norm) || OTHER_COMPONENT_RX.test(norm)) {
      return -500;
    }
    if (/\bcredit\s*(note|memo|days|limit|period|no|number|%)\b/.test(norm)) {
      return -1000;
    }
    const colStat = stats[idx];
    if (colStat && colStat.nonEmptyCount > 0 && colStat.numericCount === 0) {
      return -800;
    }
    if (/^credit(\s*(amount|amt|val|value))?$/.test(norm)) return 150;
    if (/^cr(\s*(amount|amt|val|value))?$/.test(norm)) return 140;
    if (/\bcredit\s*(amount|amt)\b/.test(norm)) return 120;
    return -1000;
  }

  if (field === 'vno') {
    if (/\b(vch\s*type|voucher\s*type|gstin|pan|hsn|sac|part\s*no|sr\s*no|sl\s*no|s\s*no)\b/.test(norm)) {
      return -500;
    }
    if (/^(vch\s*no|voucher\s*no|invoice\s*no|inv\s*no|bill\s*no|doc\s*no|document\s*no)$/.test(norm)) {
      return 150;
    }
    if (/\b(vch\s*no|voucher\s*no|invoice\s*no|inv\w*\s*no|bill\s*no|doc\w*\s*no|voucher\s*number|invoice\s*number)\b/.test(norm)) {
      return 130;
    }
    if (/\b(ref\s*no|reference\s*no|inv\s*ref)\b/.test(norm)) return 80;
    return -1000;
  }

  if (field === 'date') {
    if (/\b(due|delivery|created|updated|entry|booking|cancel)\b/.test(norm)) return 20;
    if (/^(date|invoice\s*date|inv\s*date|vch\s*date|voucher\s*date|bill\s*date|doc\s*date|document\s*date)$/.test(norm)) {
      return 150;
    }
    if (/\b(invoice|inv|vch|voucher|bill|doc)\s*date\b/.test(norm)) return 130;
    if (/\bdate\b/.test(norm)) return 90;
    return -1000;
  }

  if (field === 'party') {
    if (/\b(gstin|gst\s*no|pan|code|id|state|address|city|pin|phone|mobile|email)\b/.test(norm)) {
      return -500;
    }
    if (/^(particulars|billing\s*customer|customer\s*name|party\s*name|ledger\s*name|account\s*name)$/.test(norm)) {
      return 150;
    }
    if (/\b(particulars|billing\s*customer)\b/.test(norm)) return 140;
    if (/^(party|customer|ledger|vendor|supplier|buyer|dealer)$/.test(norm)) return 120;
    if (/\b(party|customer|ledger|vendor|supplier|buyer)\b/.test(norm)) return 100;
    return -1000;
  }

  if (field === 'type') {
    if (/\b(fuel|vehicle|body|customer|party|tax|gst|supply|order)\s*type\b/.test(norm)) {
      return -500;
    }
    if (/^(vch\s*type|voucher\s*type)$/.test(norm)) return 150;
    if (/^(type|doc\s*type|document\s*type|invoice\s*type|transaction\s*type|trans\s*type)$/.test(norm)) {
      return 135;
    }
    if (/\b(vch\s*type|voucher\s*type)\b/.test(norm)) return 120;
    return -1000;
  }

  return -1000;
}

export function autoIdx(headers: string[], field: FieldKey, rows: unknown[][] = []): number {
  const stats = rows.length > 0 ? computeColumnStats(rows, headers.length) : [];
  let bestIdx = -1;
  let bestScore = 0;

  headers.forEach((h, idx) => {
    const score = scoreFieldHeader(h, field, idx, headers, stats);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = idx;
    }
  });

  // For amt only: if zero non-negative Total/Amount candidates exist, do not silently
  // fail if a single taxable column exists — instead return -1 or let caller check, OR
  // pick best negative > -400 only when NO non-negative candidate exists AND mark warning.
  // Actually returning the taxable column ONLY when no positive total exists ensures
  // rows still parse (and triggers a loud amber warning in the UI), while ANY real Total
  // column (even generic "Total" or "Amount") ALWAYS beats Taxable/Tax/Component (-350)!
  if (bestIdx < 0 && field === 'amt') {
    let fallbackIdx = -1;
    let fallbackScore = -400;
    headers.forEach((h, idx) => {
      const score = scoreFieldHeader(h, 'amt', idx, headers, stats);
      if (score > fallbackScore) {
        fallbackScore = score;
        fallbackIdx = idx;
      }
    });
    return fallbackIdx;
  }

  return bestIdx;
}

export function assessAmountColumn(
  mappedHeader: string | undefined,
  files: UploadedSheetFile[]
): AmountColumnAssessment | null {
  if (!mappedHeader) return null;

  const allHeaders = Array.from(new Set(files.flatMap((f) => f.headers).filter(Boolean)));
  const allRows = files[0]?.rows ?? [];
  const bestTotalIdx = autoIdx(allHeaders, 'amt', allRows);
  const bestTotalHeader = bestTotalIdx >= 0 ? allHeaders[bestTotalIdx] : null;
  const bestRole = bestTotalHeader ? classifyAmountHeader(bestTotalHeader) : null;
  const suggestedTotalHeader =
    bestTotalHeader &&
    bestTotalHeader !== mappedHeader &&
    bestRole &&
    ['total', 'debit', 'generic'].includes(bestRole)
      ? bestTotalHeader
      : null;

  const role = classifyAmountHeader(mappedHeader);

  if (role === 'taxable') {
    return {
      header: mappedHeader,
      role,
      warning: suggestedTotalHeader
        ? `"${mappedHeader}" is a Taxable/Subtotal column. Switch to "${suggestedTotalHeader}" so Total-to-Total reconciliation matches invoice grand totals.`
        : `"${mappedHeader}" looks like a Taxable/Subtotal column instead of Grand Total (incl. tax). Check if your export has a Total/Gross Amount column.`,
      suggestedTotalHeader,
    };
  }

  if (role === 'tax' || role === 'component') {
    return {
      header: mappedHeader,
      role,
      warning: suggestedTotalHeader
        ? `"${mappedHeader}" is a tax/component column. Switch to "${suggestedTotalHeader}" for Total-to-Total matching.`
        : `"${mappedHeader}" looks like a tax/component column rather than Invoice Total.`,
      suggestedTotalHeader,
    };
  }

  return {
    header: mappedHeader,
    role,
    warning: null,
    suggestedTotalHeader: null,
  };
}

export function detectHeaderRow(rows: unknown[][]): number {
  let bestIdx = 0;
  let bestScore = -1;
  const headerKeywordRx =
    /date|vch|voucher|invoice|inv\s*no|amount|amt|debit|credit|particulars|party|customer|bill|taxable|total|grand|gross|net|payable|cgst|sgst|igst|type|gstin|hsn/i;

  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    let score = 0;
    let nonEmpty = 0;
    const row = rows[i] || [];
    row.forEach((cell) => {
      if (cell !== '' && cell !== null && cell !== undefined) {
        nonEmpty++;
      }
      if (typeof cell === 'string' && headerKeywordRx.test(cell)) {
        score += 2;
      }
    });
    // Penalize single-cell title banners (e.g. "Sales Register from 01-04-2025 to 31-03-2026")
    if (nonEmpty <= 1) score = Math.min(score, 0);
    else if (nonEmpty >= 4) score += 1;

    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
}

const GENERIC_CHILD_HEADER_RX =
  /^(amount|amt|value|val|total|tot|rate|%|tax|gst)$/i;

export function extractSheetHeadersAndRows(sheet: XLSX.WorkSheet): {
  headers: string[];
  rows: unknown[][];
} {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: '',
  });
  if (rows.length === 0) {
    return { headers: [], rows: [] };
  }

  const headerIdx = detectHeaderRow(rows);
  const childRow = (rows[headerIdx] || []).map((c) => String(c ?? '').replace(/\s+/g, ' ').trim());
  const merges = (sheet['!merges'] || []) as XLSX.Range[];

  // Build parent-row labels if headerIdx > 0 looks like a 2-row grouped header
  const parentLabels = new Array<string>(childRow.length).fill('');
  if (headerIdx > 0) {
    const parentRow = rows[headerIdx - 1] || [];
    // First apply horizontal merges from parentRow only when span width is <= 5 columns (avoid wide sheet title banners)
    const coveredByWideBanner = new Set<number>();
    merges.forEach((m) => {
      if (m.s.r === headerIdx - 1 && m.e.r === headerIdx - 1) {
        const span = m.e.c - m.s.c + 1;
        const val = String(parentRow[m.s.c] ?? '').replace(/\s+/g, ' ').trim();
        if (span > 5) {
          for (let c = m.s.c; c <= m.e.c && c < childRow.length; c++) {
            coveredByWideBanner.add(c);
          }
        } else if (val) {
          for (let c = m.s.c; c <= m.e.c && c < childRow.length; c++) {
            parentLabels[c] = val;
          }
        }
      }
      // Vertical merge starting at headerIdx - 1 spanning down into headerIdx: carry value into blank child cell
      if (m.s.r === headerIdx - 1 && m.e.r >= headerIdx && m.s.c < childRow.length) {
        const val = String(parentRow[m.s.c] ?? '').replace(/\s+/g, ' ').trim();
        if (val && !childRow[m.s.c]) {
          childRow[m.s.c] = val;
        }
      }
    });

    // Also inspect unmerged parentRow cells if parentRow has multiple distinct group labels
    let parentNonEmpty = 0;
    parentRow.forEach((c) => {
      if (String(c ?? '').trim()) parentNonEmpty++;
    });
    if (parentNonEmpty >= 2) {
      for (let c = 0; c < childRow.length; c++) {
        if (!parentLabels[c] && !coveredByWideBanner.has(c)) {
          const val = String(parentRow[c] ?? '').replace(/\s+/g, ' ').trim();
          if (val && !/report|register|statement|company|period|from\s+\d/i.test(val)) {
            parentLabels[c] = val;
          }
        }
      }
    }
  }

  // Count duplicate child names so generic/duplicated child columns inherit parent label
  const childCounts: Record<string, number> = {};
  childRow.forEach((h) => {
    const k = h.toLowerCase();
    if (k) childCounts[k] = (childCounts[k] || 0) + 1;
  });

  const combined = childRow.map((child, idx) => {
    const parent = parentLabels[idx];
    if (!child && parent) return parent;
    if (!child) return '';
    if (
      parent &&
      parent.toLowerCase() !== child.toLowerCase() &&
      !child.toLowerCase().includes(parent.toLowerCase()) &&
      ((childCounts[child.toLowerCase()] || 0) > 1 || GENERIC_CHILD_HEADER_RX.test(child))
    ) {
      return `${parent} ${child}`;
    }
    return child;
  });

  // Trim trailing empty columns
  let lastNonEmpty = combined.length - 1;
  while (lastNonEmpty >= 0 && !combined[lastNonEmpty]) {
    lastNonEmpty--;
  }
  const trimmed = combined.slice(0, lastNonEmpty + 1);

  // Deduplicate identical headers so indexOf always targets the exact column
  const seenCounts: Record<string, number> = {};
  const headers = trimmed.map((h) => {
    if (!h) return '';
    const count = (seenCounts[h] = (seenCounts[h] || 0) + 1);
    return count > 1 ? `${h} (${count})` : h;
  });

  return {
    headers,
    rows: rows.slice(headerIdx + 1),
  };
}

export function parsePrefixRules(raw: string): Array<[string, VoucherCategory]> {
  return (raw || '')
    .split(',')
    .map((x) => x.split('=').map((y) => y.trim()))
    .filter(
      (parts): parts is [string, VoucherCategory] =>
        Boolean(parts[0]) && (CATS as readonly string[]).includes(parts[1])
    );
}

export function catOf(
  typeVal: unknown,
  vno: string,
  ov: CategoryOverride,
  prefixRules: Array<[string, VoucherCategory]>
): VoucherCategory {
  if (ov && ov !== 'Auto') return ov;
  const v = String(vno).toUpperCase();
  for (const [prefix, cat] of prefixRules) {
    if (v.startsWith(prefix.toUpperCase())) return cat;
  }
  const t = String(typeVal || '');
  if (/credit\s*(note|memo)|^cn$/i.test(t)) return 'Credit Note';
  if (/debit\s*(note|memo)|^dn$/i.test(t)) return 'Debit Note';
  if (/purchase/i.test(t)) return 'Purchase';
  if (/sale|service|invoice|parts/i.test(t)) return 'Sales';
  return t ? 'Other' : 'Sales';
}

export function normalizeVoucherKey(v: string, ignorePrefix: boolean): string {
  let k = String(v).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (ignorePrefix) {
    const m = k.match(/(\d+)$/);
    if (m) k = String(Number(m[1]));
  }
  return k;
}

const SUMMARY_LABEL_RX =
  /^(grand\s*total|sub[\s-]*total|net\s*total|page\s*total|report\s*total|day\s*total|total|totals)\b/i;

export function resolveFileFieldIndices(
  file: UploadedSheetFile,
  map: Partial<Record<FieldKey, string>>
): Record<FieldKey, number> {
  const ix: Record<FieldKey, number> = {
    vno: -1,
    date: -1,
    party: -1,
    amt: -1,
    amt2: -1,
    type: -1,
  };

  FIELDS.forEach(([k]) => {
    const mapped = map[k];
    if (mapped === '__NONE__') {
      ix[k] = -1;
      return;
    }
    let idx = mapped ? file.headers.indexOf(mapped) : -1;
    // If mapped header doesn't exist in this specific file (multi-file with differing column names),
    // or was left blank when another file had a match, auto-detect on this file's headers & rows.
    if (idx < 0 && mapped !== '') {
      idx = autoIdx(file.headers, k, file.rows);
    } else if (idx < 0 && mapped === '' && k === 'amt2') {
      idx = autoIdx(file.headers, k, file.rows);
    }
    ix[k] = idx;
  });

  if (ix.amt2 >= 0 && ix.amt2 === ix.amt) {
    ix.amt2 = -1;
  }

  return ix;
}

export function buildSideEntries(
  side: SideKey,
  sideState: SideState,
  includeAllCategories: boolean,
  ignorePrefix: boolean,
  prefixRules: Array<[string, VoucherCategory]>
): NormalizedEntry[] {
  const out: NormalizedEntry[] = [];

  sideState.files.forEach((f) => {
    const ix = resolveFileFieldIndices(f, sideState.map);
    if (ix.vno < 0) return;

    f.rows.forEach((r) => {
      const vno = String(r[ix.vno] ?? '').trim();
      const dateRaw = ix.date >= 0 ? String(r[ix.date] ?? '').trim() : '';
      const partyRaw = ix.party >= 0 ? String(r[ix.party] ?? '').trim() : '';

      if (!vno || SUMMARY_LABEL_RX.test(vno) || SUMMARY_LABEL_RX.test(dateRaw)) {
        return;
      }
      if (SUMMARY_LABEL_RX.test(partyRaw) && !dateRaw) {
        return;
      }

      let a = ix.amt >= 0 ? parseNumber(r[ix.amt]) : 0;
      if (!a && ix.amt2 >= 0) {
        a = parseNumber(r[ix.amt2]);
      }

      const cat = catOf(ix.type >= 0 ? r[ix.type] : '', vno, f.ov, prefixRules);
      if (!includeAllCategories && !sideState.inc.has(cat)) return;

      out.push({
        side,
        file: f.name,
        vno,
        key: normalizeVoucherKey(vno, ignorePrefix),
        date: ix.date >= 0 ? parseExcelDate(r[ix.date]) : null,
        party: partyRaw,
        amt: Math.abs(a),
        cat,
      });
    });
  });

  return out;
}

export function pairEntries(
  a: NormalizedEntry,
  b: NormalizedEntry,
  tol: number,
  dd: number,
  dupNote: string
): ReconRow {
  const diff = Math.round((a.amt - b.amt) * 100) / 100;
  const notes: string[] = [];
  let st: ReconStatus = 'Matched';
  const absAmtDiff = Math.abs(diff) > tol;
  const gap = a.date != null && b.date != null ? Math.abs(a.date - b.date) : 0;

  if (absAmtDiff) {
    st = 'Amount diff';
    notes.push('Amount differs by ' + formatMoney(diff));
  } else if (diff) {
    notes.push('Rounding ' + formatMoney(diff));
  }

  if (gap > dd) {
    if (st === 'Matched') st = 'Date diff';
    notes.push('Date gap ' + gap + 'd');
  }

  if (a.cat !== b.cat) {
    if (st === 'Matched') st = 'Type diff';
    notes.push('Type: DMS ' + a.cat + ' / Tally ' + b.cat);
  }

  if (dupNote) notes.push(dupNote);

  return {
    status: st,
    cat: a.cat,
    vd: a.vno,
    vt: b.vno,
    dd: a.date,
    dt: b.date,
    party: a.party || b.party,
    a: a.amt,
    b: b.amt,
    diff,
    notes: notes.join('; '),
  };
}

export function reconcileEntries(
  dmsEntries: NormalizedEntry[],
  tallyEntries: NormalizedEntry[],
  options: {
    amtTol: number;
    dateTol: number;
    fuzzyEnabled: boolean;
    fuzzyDays: number;
    fuzzySameType: boolean;
  }
): ReconRow[] {
  const { amtTol: tol, dateTol: dd, fuzzyEnabled, fuzzyDays: fdays, fuzzySameType } = options;

  const A = dmsEntries.map((e) => ({ ...e, used: false }));
  const B = tallyEntries.map((e) => ({ ...e, used: false }));

  const res: ReconRow[] = [];
  const mb = new Map<string, NormalizedEntry[]>();
  const ca: Record<string, number> = {};
  const cb: Record<string, number> = {};

  B.forEach((b) => {
    const list = mb.get(b.key);
    if (list) list.push(b);
    else mb.set(b.key, [b]);
    cb[b.key] = (cb[b.key] || 0) + 1;
  });
  A.forEach((a) => {
    ca[a.key] = (ca[a.key] || 0) + 1;
  });

  const left: NormalizedEntry[] = [];
  A.forEach((a) => {
    const arr = mb.get(a.key);
    if (arr && arr.length > 0) {
      const b = arr.shift()!;
      b.used = true;
      const dupNote =
        ca[a.key] > 1 || cb[a.key] > 1 ? 'Duplicate voucher no. in file(s)' : '';
      res.push(pairEntries(a, b, tol, dd, dupNote));
    } else {
      left.push(a);
    }
  });

  const lb = B.filter((b) => !b.used);

  if (fuzzyEnabled) {
    left.slice().forEach((a) => {
      let best: NormalizedEntry | null = null;
      let bestGap = 1e9;

      lb.forEach((b) => {
        if (b.used || Math.abs(a.amt - b.amt) > tol) return;
        if (fuzzySameType && a.cat !== b.cat) return;
        const gap = a.date != null && b.date != null ? Math.abs(a.date - b.date) : 0;
        if (gap > fdays) return;
        if (gap < bestGap) {
          bestGap = gap;
          best = b;
        }
      });

      if (best !== null) {
        const matchedB: NormalizedEntry = best;
        matchedB.used = true;
        const idx = left.indexOf(a);
        if (idx >= 0) left.splice(idx, 1);
        const paired = pairEntries(a, matchedB, tol, 1e9, '');
        paired.status = 'Fuzzy match';
        paired.notes = ['Voucher no. differs']
          .concat(bestGap ? ['date gap ' + bestGap + 'd'] : [])
          .join(', ');
        res.push(paired);
      }
    });
  }

  left.forEach((a) =>
    res.push({
      status: 'Only in DMS',
      cat: a.cat,
      vd: a.vno,
      vt: '',
      dd: a.date,
      dt: null,
      party: a.party,
      a: a.amt,
      b: null,
      diff: a.amt,
      notes: 'Missing in Tally',
    })
  );

  B.filter((b) => !b.used).forEach((b) =>
    res.push({
      status: 'Only in Tally',
      cat: b.cat,
      vd: '',
      vt: b.vno,
      dd: null,
      dt: b.date,
      party: b.party,
      a: null,
      b: b.amt,
      diff: -b.amt,
      notes: 'Missing in DMS',
    })
  );

  return res;
}
