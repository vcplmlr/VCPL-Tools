import * as XLSX from 'xlsx';
import {
  STATUTORY_SECTION_CATALOG,
  StatutorySectionMeta,
  lookupSectionMeta,
} from '../data/form26asSectionCatalog';

export { STATUTORY_SECTION_CATALOG, lookupSectionMeta };
export type { StatutorySectionMeta };

export type Form26ASPartCode =
  | 'PART I (TDS)'
  | 'PART II (TDS 15G/15H)'
  | 'PART III (194IA/IB/M)'
  | 'PART IV (TCS)'
  | 'PART V (Tax Paid)'
  | 'PART VI (TCS / Collector)'
  | 'PART VII (Refunds)'
  | 'TDS'
  | 'TCS';

export interface Form26ASTransaction {
  id: string;
  srNo: number;
  txSrNo: string;
  part: string;
  partyType: 'Deductor' | 'Collector';
  partyName: string;
  tan: string;
  partyPan: string;
  section: string;
  transactionDate: string;
  fiscalQuarter: string;
  bookingStatus: string;
  bookingDate: string;
  remarks: string;
  entryNature: 'Credit' | 'Reversal';
  amountPaid: number;
  taxDeducted: number;
  tdsDeposited: number;
}

export interface Form26ASPartySummary {
  srNo: number;
  part: string;
  partyType: 'Deductor' | 'Collector';
  partyName: string;
  tan: string;
  partyPan: string;
  transactionCount: number;
  reversalCount: number;
  grossAmountPaid: number;
  grossTaxDeducted: number;
  reversalAmountPaid: number;
  reversalTaxDeducted: number;
  reportedAmountPaid: number;
  reportedTaxDeducted: number;
  reportedTdsDeposited: number;
  extractedAmountPaid: number;
  extractedTaxDeducted: number;
  extractedTdsDeposited: number;
  varianceAmountPaid: number;
  varianceTaxDeducted: number;
  varianceTdsDeposited: number;
  verificationStatus: 'Verified' | 'Subtotal Variance' | 'Summary Only';
}

export interface Form26ASChallanRow {
  srNo: number;
  part: string;
  bsrCode: string;
  depositDate: string;
  challanSerial: string;
  majorHead: string;
  minorHead: string;
  totalTax: number;
  remarks: string;
}

export interface Form26ASPartCoverage {
  part: string;
  title: string;
  hasTransactions: boolean;
  partyCount: number;
  txCount: number;
  amountPaid: number;
  taxAmount: number;
  depositedAmount: number;
}

export interface Form26ASOfficialSummary {
  summaryTds?: number;
  summaryTcs?: number;
  summaryDemand?: number;
  summaryRefund?: number;
  partGrossTotals: Record<
    string,
    {
      amountPaid: number;
      taxDeducted: number;
      tdsDeposited: number;
    }
  >;
}

export interface ParsedForm26AS {
  pan: string;
  panStatus: string;
  taxYear: string;
  assessmentYear: string;
  financialYear: string;
  yearScheme: 'tax_year' | 'fy_ay';
  dataUpdatedTill?: string;
  assesseeName: string;
  assesseeAddress: string;
  parties: Form26ASPartySummary[];
  transactions: Form26ASTransaction[];
  challans: Form26ASChallanRow[];
  rawLineCount: number;
  pageCount: number;
  detectedParts: string[];
  partCoverage?: Form26ASPartCoverage[];
  sourceFormat?: 'pdf' | 'traces-txt' | 'excel-csv' | 'pasted-text';
  officialSummary?: Form26ASOfficialSummary;
}

export const SECTION_DESCRIPTION_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(STATUTORY_SECTION_CATALOG).map(([k, v]) => [
    k,
    `${v.statutoryRef} — ${v.description}`,
  ])
);

export function getSectionDescription(sectionCode: string): string {
  const meta = lookupSectionMeta(sectionCode);
  return `${meta.statutoryRef} — ${meta.description}`;
}

export const FISCAL_MONTH_ORDER = [
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
  'Jan',
  'Feb',
  'Mar',
] as const;

const FISCAL_MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

function parseDateMonthIndex(dateStr: string): number | null {
  const trimmed = (dateStr || '').trim();
  if (!trimmed || trimmed === '-') return null;

  let month: number | null = null;
  const alpha = trimmed.match(/^(\d{1,2})[-/\s]([A-Za-z]{3})[-/\s](\d{2,4})$/);
  if (alpha) {
    month = MONTH_MAP[alpha[2].toLowerCase()] ?? null;
  } else {
    const slash = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
    if (slash) {
      month = Number.parseInt(slash[2], 10);
    } else {
      const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (iso) {
        month = Number.parseInt(iso[2], 10);
      }
    }
  }
  if (!month || month < 1 || month > 12) return null;
  return month;
}

export function getFiscalQuarter(
  dateStr: string
): 'Q1 (Apr-Jun)' | 'Q2 (Jul-Sep)' | 'Q3 (Oct-Dec)' | 'Q4 (Jan-Mar)' | 'Other / Unspecified' {
  const month = parseDateMonthIndex(dateStr);
  if (!month) return 'Other / Unspecified';
  if (month >= 4 && month <= 6) return 'Q1 (Apr-Jun)';
  if (month >= 7 && month <= 9) return 'Q2 (Jul-Sep)';
  if (month >= 10 && month <= 12) return 'Q3 (Oct-Dec)';
  return 'Q4 (Jan-Mar)';
}

export function getFiscalMonthLabel(dateStr: string): string {
  const month = parseDateMonthIndex(dateStr);
  if (!month) return 'Unspecified';
  return FISCAL_MONTH_SHORT[month - 1] ?? 'Unspecified';
}

export function classify26ASTaxType(input: {
  partyType?: string;
  part?: string;
  section?: string;
}): 'TDS' | 'TCS' {
  const pType = (input.partyType || '').trim().toLowerCase();
  const part = (input.part || '').trim();
  const section = (input.section || '').trim().toUpperCase();

  if (pType === 'collector') return 'TCS';
  if (/\btcs\b|collector|part\s*(?:iv\s*\(tcs\)|vi|vii)\b/i.test(part)) return 'TCS';
  if (/^(?:206C|394\b|10(?:7[1-9]|8[0-9]|9[0-2])\b)/i.test(section)) return 'TCS';
  return 'TDS';
}

export function sliceParsedForm26ASByScope(
  parsed: ParsedForm26AS,
  scope: 'all' | 'tds' | 'tcs'
): ParsedForm26AS {
  if (scope === 'all') return parsed;
  const targetType = scope === 'tcs' ? 'TCS' : 'TDS';
  const filteredTransactions = parsed.transactions
    .filter((tx) => classify26ASTaxType(tx) === targetType)
    .map((tx, idx) => ({ ...tx, srNo: idx + 1 }));

  const filteredParties = parsed.parties
    .filter((p) => classify26ASTaxType(p) === targetType)
    .map((p, idx) => ({ ...p, srNo: idx + 1 }));

  const filteredParts = parsed.partCoverage?.filter((pc) => {
    const partTax = classify26ASTaxType({ part: pc.part });
    return partTax === targetType;
  });

  const filteredOfficialSummary: Form26ASOfficialSummary | undefined = parsed.officialSummary
    ? {
        summaryTds: scope === 'tds' ? parsed.officialSummary.summaryTds : undefined,
        summaryTcs: scope === 'tcs' ? parsed.officialSummary.summaryTcs : undefined,
        summaryDemand: undefined,
        summaryRefund: undefined,
        partGrossTotals: Object.fromEntries(
          Object.entries(parsed.officialSummary.partGrossTotals).filter(
            ([part]) => classify26ASTaxType({ part }) === targetType
          )
        ),
      }
    : undefined;

  return {
    ...parsed,
    parties: filteredParties,
    transactions: filteredTransactions,
    challans: [],
    detectedParts: Array.from(new Set(filteredTransactions.map((t) => t.part))),
    partCoverage: filteredParts,
    officialSummary: filteredOfficialSummary,
  };
}

export const SAMPLE_FORM_26AS: ParsedForm26AS = {
  pan: 'AAICV0796M',
  panStatus: 'Active',
  taxYear: '2026-27',
  assessmentYear: '2027-28',
  financialYear: '2026-27',
  yearScheme: 'tax_year',
  dataUpdatedTill: '19-Nov-2026',
  assesseeName: 'BHARAT MOBILITY & SERVICES PVT LTD',
  assesseeAddress: 'MG ROAD, MANGALURU, KARNATAKA - 575001',
  rawLineCount: 164,
  pageCount: 6,
  detectedParts: ['PART I (TDS)', 'PART VI (TCS)'],
  sourceFormat: 'pdf',
  partCoverage: [
    {
      part: 'PART I (TDS)',
      title: 'Details of Tax Deducted at Source',
      hasTransactions: true,
      partyCount: 3,
      txCount: 8,
      amountPaid: 1347500,
      taxAmount: 134750,
      depositedAmount: 132750,
    },
    {
      part: 'PART VI (TCS)',
      title: 'Details of Tax Collected at Source',
      hasTransactions: true,
      partyCount: 1,
      txCount: 2,
      amountPaid: 5840000,
      taxAmount: 58400,
      depositedAmount: 58400,
    },
  ],
  officialSummary: {
    summaryTds: 134750,
    summaryTcs: 58400,
    summaryDemand: 0,
    summaryRefund: 0,
    partGrossTotals: {
      'PART I (TDS)': { amountPaid: 1347500, taxDeducted: 134750, tdsDeposited: 132750 },
      'PART VI (TCS)': { amountPaid: 5840000, taxDeducted: 58400, tdsDeposited: 58400 },
    },
  },
  parties: [
    {
      srNo: 1,
      part: 'PART I (TDS)',
      partyType: 'Deductor',
      partyName: 'HDFC BANK LIMITED',
      tan: 'MUMH04821B',
      partyPan: 'AAACH2702H',
      transactionCount: 4,
      reversalCount: 1,
      grossAmountPaid: 692500,
      grossTaxDeducted: 65250,
      reversalAmountPaid: -50000,
      reversalTaxDeducted: -1000,
      reportedAmountPaid: 642500,
      reportedTaxDeducted: 64250,
      reportedTdsDeposited: 64250,
      extractedAmountPaid: 642500,
      extractedTaxDeducted: 64250,
      extractedTdsDeposited: 64250,
      varianceAmountPaid: 0,
      varianceTaxDeducted: 0,
      varianceTdsDeposited: 0,
      verificationStatus: 'Verified',
    },
    {
      srNo: 2,
      part: 'PART I (TDS)',
      partyType: 'Deductor',
      partyName: 'STATE BANK OF INDIA (TREASURY)',
      tan: 'MUMS19204A',
      partyPan: 'AAACS8577K',
      transactionCount: 2,
      reversalCount: 0,
      grossAmountPaid: 285000,
      grossTaxDeducted: 28500,
      reversalAmountPaid: 0,
      reversalTaxDeducted: 0,
      reportedAmountPaid: 285000,
      reportedTaxDeducted: 28500,
      reportedTdsDeposited: 28500,
      extractedAmountPaid: 285000,
      extractedTaxDeducted: 28500,
      extractedTdsDeposited: 28500,
      varianceAmountPaid: 0,
      varianceTaxDeducted: 0,
      varianceTdsDeposited: 0,
      verificationStatus: 'Verified',
    },
    {
      srNo: 3,
      part: 'PART I (TDS)',
      partyType: 'Deductor',
      partyName: 'APEX ADVISORY & CONSULTING LLP',
      tan: 'DELA29011C',
      partyPan: 'AABFA1928L',
      transactionCount: 2,
      reversalCount: 0,
      grossAmountPaid: 420000,
      grossTaxDeducted: 42000,
      reversalAmountPaid: 0,
      reversalTaxDeducted: 0,
      reportedAmountPaid: 420000,
      reportedTaxDeducted: 42000,
      reportedTdsDeposited: 40000,
      extractedAmountPaid: 420000,
      extractedTaxDeducted: 42000,
      extractedTdsDeposited: 40000,
      varianceAmountPaid: 0,
      varianceTaxDeducted: 0,
      varianceTdsDeposited: 0,
      verificationStatus: 'Verified',
    },
    {
      srNo: 4,
      part: 'PART VI (TCS)',
      partyType: 'Collector',
      partyName: 'BAVARIA AUTO INDIA PVT LTD',
      tan: 'PUNE11834E',
      partyPan: 'AABCB7140C',
      transactionCount: 2,
      reversalCount: 0,
      grossAmountPaid: 5840000,
      grossTaxDeducted: 58400,
      reversalAmountPaid: 0,
      reversalTaxDeducted: 0,
      reportedAmountPaid: 5840000,
      reportedTaxDeducted: 58400,
      reportedTdsDeposited: 58400,
      extractedAmountPaid: 5840000,
      extractedTaxDeducted: 58400,
      extractedTdsDeposited: 58400,
      varianceAmountPaid: 0,
      varianceTaxDeducted: 0,
      varianceTdsDeposited: 0,
      verificationStatus: 'Verified',
    },
  ],
  transactions: [
    {
      id: 'tx-1',
      srNo: 1,
      txSrNo: '1.1',
      part: 'PART I (TDS)',
      partyType: 'Deductor',
      partyName: 'HDFC BANK LIMITED',
      tan: 'MUMH04821B',
      partyPan: 'AAACH2702H',
      section: '1006',
      transactionDate: '30-Jun-2026',
      fiscalQuarter: 'Q1 (Apr-Jun)',
      bookingStatus: 'Final',
      bookingDate: '12-Jul-2026',
      remarks: '-',
      entryNature: 'Credit',
      amountPaid: 260000,
      taxDeducted: 22000,
      tdsDeposited: 22000,
    },
    {
      id: 'tx-2',
      srNo: 2,
      txSrNo: '1.2',
      part: 'PART I (TDS)',
      partyType: 'Deductor',
      partyName: 'HDFC BANK LIMITED',
      tan: 'MUMH04821B',
      partyPan: 'AAACH2702H',
      section: '1006',
      transactionDate: '30-Jun-2026',
      fiscalQuarter: 'Q1 (Apr-Jun)',
      bookingStatus: 'Final',
      bookingDate: '12-Jul-2026',
      remarks: 'G',
      entryNature: 'Reversal',
      amountPaid: -50000,
      taxDeducted: -1000,
      tdsDeposited: -1000,
    },
    {
      id: 'tx-3',
      srNo: 3,
      txSrNo: '1.3',
      part: 'PART I (TDS)',
      partyType: 'Deductor',
      partyName: 'HDFC BANK LIMITED',
      tan: 'MUMH04821B',
      partyPan: 'AAACH2702H',
      section: '1021',
      transactionDate: '31-Dec-2026',
      fiscalQuarter: 'Q3 (Oct-Dec)',
      bookingStatus: 'Final',
      bookingDate: '14-Jan-2027',
      remarks: '-',
      entryNature: 'Credit',
      amountPaid: 215000,
      taxDeducted: 21500,
      tdsDeposited: 21500,
    },
    {
      id: 'tx-4',
      srNo: 4,
      txSrNo: '1.4',
      part: 'PART I (TDS)',
      partyType: 'Deductor',
      partyName: 'HDFC BANK LIMITED',
      tan: 'MUMH04821B',
      partyPan: 'AAACH2702H',
      section: '1021',
      transactionDate: '31-Mar-2027',
      fiscalQuarter: 'Q4 (Jan-Mar)',
      bookingStatus: 'Final',
      bookingDate: '22-May-2027',
      remarks: '-',
      entryNature: 'Credit',
      amountPaid: 217500,
      taxDeducted: 21750,
      tdsDeposited: 21750,
    },
    {
      id: 'tx-5',
      srNo: 1,
      txSrNo: '2.1',
      part: 'PART I (TDS)',
      partyType: 'Deductor',
      partyName: 'STATE BANK OF INDIA (TREASURY)',
      tan: 'MUMS19204A',
      partyPan: 'AAACS8577K',
      section: '1021',
      transactionDate: '30-Sep-2026',
      fiscalQuarter: 'Q2 (Jul-Sep)',
      bookingStatus: 'Final',
      bookingDate: '18-Oct-2026',
      remarks: '-',
      entryNature: 'Credit',
      amountPaid: 140000,
      taxDeducted: 14000,
      tdsDeposited: 14000,
    },
    {
      id: 'tx-6',
      srNo: 2,
      txSrNo: '2.2',
      part: 'PART I (TDS)',
      partyType: 'Deductor',
      partyName: 'STATE BANK OF INDIA (TREASURY)',
      tan: 'MUMS19204A',
      partyPan: 'AAACS8577K',
      section: '1021',
      transactionDate: '31-Mar-2027',
      fiscalQuarter: 'Q4 (Jan-Mar)',
      bookingStatus: 'Final',
      bookingDate: '19-May-2027',
      remarks: '-',
      entryNature: 'Credit',
      amountPaid: 145000,
      taxDeducted: 14500,
      tdsDeposited: 14500,
    },
    {
      id: 'tx-7',
      srNo: 1,
      txSrNo: '3.1',
      part: 'PART I (TDS)',
      partyType: 'Deductor',
      partyName: 'APEX ADVISORY & CONSULTING LLP',
      tan: 'DELA29011C',
      partyPan: 'AABFA1928L',
      section: '1027',
      transactionDate: '15-Nov-2026',
      fiscalQuarter: 'Q3 (Oct-Dec)',
      bookingStatus: 'Final',
      bookingDate: '10-Jan-2027',
      remarks: '-',
      entryNature: 'Credit',
      amountPaid: 240000,
      taxDeducted: 24000,
      tdsDeposited: 24000,
    },
    {
      id: 'tx-8',
      srNo: 2,
      txSrNo: '3.2',
      part: 'PART I (TDS)',
      partyType: 'Deductor',
      partyName: 'APEX ADVISORY & CONSULTING LLP',
      tan: 'DELA29011C',
      partyPan: 'AABFA1928L',
      section: '1027',
      transactionDate: '20-Mar-2027',
      fiscalQuarter: 'Q4 (Jan-Mar)',
      bookingStatus: 'Unmatched',
      bookingDate: '15-May-2027',
      remarks: 'P',
      entryNature: 'Credit',
      amountPaid: 180000,
      taxDeducted: 18000,
      tdsDeposited: 16000,
    },
    {
      id: 'tx-9',
      srNo: 1,
      txSrNo: '1.1',
      part: 'PART VI (TCS)',
      partyType: 'Collector',
      partyName: 'BAVARIA AUTO INDIA PVT LTD',
      tan: 'PUNE11834E',
      partyPan: 'AABCB7140C',
      section: '1075',
      transactionDate: '18-Aug-2026',
      fiscalQuarter: 'Q2 (Jul-Sep)',
      bookingStatus: 'Final',
      bookingDate: '09-Oct-2026',
      remarks: '-',
      entryNature: 'Credit',
      amountPaid: 3120000,
      taxDeducted: 31200,
      tdsDeposited: 31200,
    },
    {
      id: 'tx-10',
      srNo: 2,
      txSrNo: '1.2',
      part: 'PART VI (TCS)',
      partyType: 'Collector',
      partyName: 'BAVARIA AUTO INDIA PVT LTD',
      tan: 'PUNE11834E',
      partyPan: 'AABCB7140C',
      section: '1075',
      transactionDate: '12-Feb-2027',
      fiscalQuarter: 'Q4 (Jan-Mar)',
      bookingStatus: 'Final',
      bookingDate: '18-May-2027',
      remarks: '-',
      entryNature: 'Credit',
      amountPaid: 2720000,
      taxDeducted: 27200,
      tdsDeposited: 27200,
    },
  ],
  challans: [
    {
      srNo: 1,
      part: 'PART III (Tax Paid)',
      bsrCode: '0240005',
      depositDate: '15-Mar-2027',
      challanSerial: '04182',
      majorHead: '0020',
      minorHead: '100',
      totalTax: 85000,
      remarks: 'Advance Tax Q4',
    },
  ],
};

const PAN_REGEX = /\b([A-Z]{5}[0-9]{4}[A-Z])\b/;
const TAN_REGEX = /\b([A-Z]{4}[0-9]{5}[A-Z])\b/;
const DATE_TOKEN_REGEX = /\b(\d{2}-[A-Za-z]{3}-\d{4}|\d{2}\/\d{2}\/\d{4})\b/g;
const AMOUNT_REGEX = /\(\s*\d[\d,]*\.\d{2}\s*\)|-?\b\d[\d,]*\.\d{2}\b/g;
const AMOUNT_SPLIT_REGEX = /\(\s*\d[\d,]*\.\d{2}\s*\)|-?\d[\d,]*\.\d{2}/;
const YEAR_RANGE_GLOBAL_REGEX = /\b(20\d{2})\s*[-–/]\s*(\d{2,4})\b/g;
const KNOWN_PAN_STATUS_REGEX =
  /\b(Active|Inoperative|Operative|Deactivated|Inactive|Valid|Invalid|Deleted|Merged|Deceased|Liquidated)\b/i;
const PAN_STATUS_LABEL_NOISE =
  /^(tax|year|financial|assessment|current|status|of|pan|permanent|account|number|name|address|assessee|taxpayer|form|traces|annual|statement)$/i;

const STRICT_SECTION_TOKEN_REGEX =
  /\b(10\d{2}|39[2-7](?:[A-Z0-9()-]{0,14})?|19[2-7][A-Z]?(?:[A-Z0-9()-]{0,12})?|206C[A-Z]?(?:[A-Z0-9()-]{0,12})?|94[A-Z]{1,3}|92[A-Z]?)\b/i;

const MONTH_MAP: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

function round2(n: number): number {
  return Number((n || 0).toFixed(2));
}

function normalizeYearRange(rawStart: string, rawEnd: string): string | null {
  const start = Number.parseInt(rawStart, 10);
  if (!Number.isFinite(start) || start < 2000 || start > 2099) return null;
  const expectedEnd2 = String((start + 1) % 100).padStart(2, '0');
  const expectedEnd4 = String(start + 1);
  if (rawEnd.length === 2 && rawEnd === expectedEnd2) {
    return `${start}-${expectedEnd2}`;
  }
  if (rawEnd.length === 4 && rawEnd === expectedEnd4) {
    return `${start}-${expectedEnd2}`;
  }
  return null;
}

function extractYearRangesFromText(text: string): string[] {
  const results: string[] = [];
  const regex = new RegExp(YEAR_RANGE_GLOBAL_REGEX.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    const normalized = normalizeYearRange(m[1], m[2]);
    if (normalized) results.push(normalized);
  }
  return results;
}

function parseStartYear(range: string): number | null {
  const m = range.match(/^(20\d{2})-\d{2}$/);
  return m ? Number.parseInt(m[1], 10) : null;
}

function shiftYearRange(range: string, delta: number): string {
  const start = parseStartYear(range);
  if (start === null) return range;
  const nextStart = start + delta;
  return `${nextStart}-${String((nextStart + 1) % 100).padStart(2, '0')}`;
}

function inferFinancialYearFromDates(dateStrings: string[]): string | null {
  const counts = new Map<string, number>();

  for (const raw of dateStrings) {
    let month: number | null = null;
    let year: number | null = null;

    const alphaMatch = raw.match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/);
    if (alphaMatch) {
      month = MONTH_MAP[alphaMatch[2].toLowerCase()] ?? null;
      year = Number.parseInt(alphaMatch[3], 10);
    } else {
      const slashMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (slashMatch) {
        month = Number.parseInt(slashMatch[2], 10);
        year = Number.parseInt(slashMatch[3], 10);
      }
    }

    if (month && year && year >= 2000 && year <= 2099) {
      const fyStart = month >= 4 ? year : year - 1;
      const fy = `${fyStart}-${String((fyStart + 1) % 100).padStart(2, '0')}`;
      counts.set(fy, (counts.get(fy) ?? 0) + 1);
    }
  }

  let bestFy: string | null = null;
  let bestCount = 0;
  for (const [fy, count] of counts.entries()) {
    if (count > bestCount) {
      bestCount = count;
      bestFy = fy;
    }
  }
  return bestFy;
}

function formatPanStatus(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return 'Active';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

function normalizeBookingStatus(raw?: string): string {
  if (!raw) return 'Final';
  const upper = raw.trim().toUpperCase();
  if (upper === 'F' || upper === 'FINAL') return 'Final';
  if (upper === 'U' || upper === 'UNMATCHED') return 'Unmatched';
  if (upper === 'O' || upper === 'OVERBOOKED') return 'Overbooked';
  if (upper === 'P' || upper === 'PROVISIONAL') return 'Provisional';
  if (upper === 'M' || upper === 'MATCHED') return 'Matched';
  if (upper === 'B' || upper === 'BOOKED') return 'Booked';
  return raw.trim();
}

function parseAmountsFromLine(line: string): number[] {
  const matches = line.match(AMOUNT_REGEX) || [];
  return matches
    .map((raw) => {
      const trimmed = raw.trim();
      const isNegativeParen = trimmed.startsWith('(') && trimmed.endsWith(')');
      const numericStr = trimmed.replace(/[(),\s]/g, '');
      const val = parseFloat(numericStr);
      if (!Number.isFinite(val)) return Number.NaN;
      return isNegativeParen ? -Math.abs(val) : val;
    })
    .filter((n) => Number.isFinite(n));
}

function cleanCommasAndSpaces(raw: string): string {
  return raw
    .replace(/\.,+/g, '.')
    .replace(/(?:,\s*){2,}/g, ', ')
    .replace(/\s+,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function parseHeaderMetadata(lines: string[]) {
  const headerLines: string[] = [];
  let summaryTds: number | undefined;
  let summaryTcs: number | undefined;
  let summaryDemand: number | undefined;
  let summaryRefund: number | undefined;
  let dataUpdatedTill: string | undefined;

  for (let i = 0; i < Math.min(lines.length, 65); i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (
      /^PART\s*[-:]?\s*(?:I|II|III|IV|V|VI|VII|A|B|C)\b/i.test(line) &&
      /TAX\s+(?:DEDUCTED|COLLECTED|PAID)/i.test(line)
    ) {
      break;
    }
    headerLines.push(line);

    if (!dataUpdatedTill) {
      const updMatch = line.match(/Data\s+updated\s+till\s*[:\-]?\s*(\d{2}-[A-Za-z]{3}-\d{4})/i);
      if (updMatch) dataUpdatedTill = updMatch[1];
    }

    // 4-column Summary table in TRACES Form 26AS (TY 2026-27+):
    // Line 12: "Summary for TY 2026-27"
    // Line 13: "TDS T C S Total TDS/TCS Demand Outstanding TDS/ TCS refund issued"
    // Line 14: "₹ 10,13,395.04 ₹ 4,50,806.44 ₹ 0.00 ₹ 0.00"
    if (/Summary\s+for\s+(?:TY|FY|AY)/i.test(line)) {
      for (let look = 1; look <= 3 && i + look < lines.length; look++) {
        const amts = parseAmountsFromLine(lines[i + look]);
        if (amts.length >= 2) {
          summaryTds = amts[0];
          summaryTcs = amts[1];
          if (amts.length >= 3) summaryDemand = amts[2];
          if (amts.length >= 4) summaryRefund = amts[3];
          break;
        }
      }
    }

    if (summaryTds === undefined && /^TDS$/i.test(line) && i + 1 < lines.length) {
      const amts = parseAmountsFromLine(lines[i + 1]);
      if (amts.length === 1) summaryTds = amts[0];
    }
    if (summaryTcs === undefined && /^T\s*C\s*S$/i.test(line) && i + 1 < lines.length) {
      const amts = parseAmountsFromLine(lines[i + 1]);
      if (amts.length === 1) summaryTcs = amts[0];
    }
  }

  const headerJoined = headerLines.join('\n');
  const panMatch = headerJoined.match(PAN_REGEX) || lines.join('\n').match(PAN_REGEX);

  let panStatus = '';
  for (let i = 0; i < headerLines.length; i++) {
    if (/Current\s+Status\s+of\s+PAN/i.test(headerLines[i])) {
      const windowText = [headerLines[i], headerLines[i + 1] ?? '', headerLines[i + 2] ?? ''].join(' ');
      const knownMatch = windowText.match(KNOWN_PAN_STATUS_REGEX);
      if (knownMatch) {
        panStatus = formatPanStatus(knownMatch[1]);
        break;
      }

      const inlineMatch = headerLines[i].match(/Current\s+Status\s+of\s+PAN\s*[:\-]\s*([A-Za-z]+)/i);
      if (inlineMatch && !PAN_STATUS_LABEL_NOISE.test(inlineMatch[1])) {
        panStatus = formatPanStatus(inlineMatch[1]);
        break;
      }
    }
  }
  if (!panStatus) {
    panStatus = 'Active';
  }

  let detectedTaxYear: string | null = null;
  let detectedFY: string | null = null;
  let detectedAY: string | null = null;

  for (let i = 0; i < headerLines.length; i++) {
    const line = headerLines[i];
    const nextLine = headerLines[i + 1] ?? '';

    const hasTYLabel = /\b(?:Tax\s+Year|T\.?\s*Y\.?)\b/i.test(line);
    const hasFYLabel = /\b(?:Financial\s+Year|F\.?\s*Y\.?)\b/i.test(line);
    const hasAYLabel = /\b(?:Assessment\s+Year|A\.?\s*Y\.?)\b/i.test(line);

    if (hasTYLabel) {
      const inlineTY = line.match(/\b(?:Tax\s+Year|T\.?\s*Y\.?)\s*[:\-]?\s*(20\d{2}\s*[-–/]\s*\d{2,4})/i);
      if (inlineTY) {
        const yrs = extractYearRangesFromText(inlineTY[1]);
        if (yrs[0]) detectedTaxYear = yrs[0];
      } else if (!hasFYLabel && !hasAYLabel) {
        const nextYrs = extractYearRangesFromText(nextLine);
        if (nextYrs.length === 1) {
          detectedTaxYear = nextYrs[0];
        } else if (nextYrs.length === 0 && headerLines[i + 2]) {
          const next2Yrs = extractYearRangesFromText(headerLines[i + 2]);
          if (next2Yrs.length === 1) detectedTaxYear = next2Yrs[0];
        }
      }
    }

    if (hasFYLabel && hasAYLabel) {
      const inlineFY = line.match(/\b(?:Financial\s+Year|F\.?\s*Y\.?)\s*[:\-]?\s*(20\d{2}\s*[-–/]\s*\d{2,4})/i);
      const inlineAY = line.match(/\b(?:Assessment\s+Year|A\.?\s*Y\.?)\s*[:\-]?\s*(20\d{2}\s*[-–/]\s*\d{2,4})/i);
      if (inlineFY) detectedFY = extractYearRangesFromText(inlineFY[1])[0] ?? detectedFY;
      if (inlineAY) detectedAY = extractYearRangesFromText(inlineAY[1])[0] ?? detectedAY;

      if (!detectedFY && !detectedAY) {
        const nextYrs = extractYearRangesFromText(nextLine);
        if (nextYrs.length >= 2) {
          const fyIdx = line.search(/\b(?:Financial\s+Year|F\.?\s*Y\.?)\b/i);
          const ayIdx = line.search(/\b(?:Assessment\s+Year|A\.?\s*Y\.?)\b/i);
          if (fyIdx < ayIdx) {
            detectedFY = nextYrs[0];
            detectedAY = nextYrs[1];
          } else {
            detectedAY = nextYrs[0];
            detectedFY = nextYrs[1];
          }
        }
      }
    } else {
      if (hasFYLabel) {
        const inlineFY = line.match(/\b(?:Financial\s+Year|F\.?\s*Y\.?)\s*[:\-]?\s*(20\d{2}\s*[-–/]\s*\d{2,4})/i);
        if (inlineFY) {
          detectedFY = extractYearRangesFromText(inlineFY[1])[0] ?? detectedFY;
        } else {
          const nextYrs = extractYearRangesFromText(nextLine);
          if (nextYrs.length === 1) detectedFY = nextYrs[0];
        }
      }
      if (hasAYLabel) {
        const inlineAY = line.match(/\b(?:Assessment\s+Year|A\.?\s*Y\.?)\s*[:\-]?\s*(20\d{2}\s*[-–/]\s*\d{2,4})/i);
        if (inlineAY) {
          detectedAY = extractYearRangesFromText(inlineAY[1])[0] ?? detectedAY;
        } else {
          const nextYrs = extractYearRangesFromText(nextLine);
          if (nextYrs.length === 1) detectedAY = nextYrs[0];
        }
      }
    }
  }

  let assesseeName = '';
  let assesseeAddress = '';
  for (let i = 0; i < headerLines.length; i++) {
    const line = headerLines[i];
    if (
      !assesseeName &&
      /FORM\s*26AS\s+(?:CONSOLIDATED\s+STATEMENT|PARTY\s+SUMMARY)\s*[—–-]\s*(.+?)\s*\(?(?:PAN[:\s]|$)/i.test(line)
    ) {
      const m = line.match(
        /FORM\s*26AS\s+(?:CONSOLIDATED\s+STATEMENT|PARTY\s+SUMMARY)\s*[—–-]\s*(.+?)(?:\s*\((?:PAN[:\s]|[A-Z]{5}\d{4}[A-Z])|\s*$)/i
      );
      if (m?.[1]?.trim()) {
        assesseeName = m[1].trim();
      }
    }
    if (!assesseeName && /Name\s+of\s+(?:Assessee|Taxpayer)/i.test(line)) {
      const m = line.match(/Name\s+of\s+(?:Assessee|Taxpayer)\s*[:\-]?\s*(.+)$/i);
      const val = m?.[1]?.trim() ?? '';
      if (val && val.length >= 3 && !/^Address\s+of/i.test(val)) {
        assesseeName = val.split(/Address\s+of\s+(?:Assessee|Taxpayer)/i)[0].trim();
      } else if (
        headerLines[i + 1] &&
        !/^(?:Address\s+of|Permanent\s+Account|PART\b)/i.test(headerLines[i + 1])
      ) {
        assesseeName = headerLines[i + 1].trim();
      }
    }
    if (!assesseeAddress && /Address\s+of\s+(?:Assessee|Taxpayer)/i.test(line)) {
      const m = line.match(/Address\s+of\s+(?:Assessee|Taxpayer)\s*[:\-]?\s*(.+)$/i);
      const val = m?.[1]?.trim() ?? '';
      if (val && val.length >= 5) {
        assesseeAddress = val;
      } else if (
        headerLines[i + 1] &&
        !/^(?:Permanent\s+Account|PART\b|Summary\b)/i.test(headerLines[i + 1])
      ) {
        assesseeAddress = headerLines[i + 1].trim();
      }
    }
  }

  return {
    pan: panMatch ? panMatch[1] : 'NOT DETECTED',
    panStatus,
    dataUpdatedTill,
    detectedTaxYear,
    detectedFY,
    detectedAY,
    assesseeName: assesseeName ? assesseeName.replace(/\s{2,}/g, ' ').trim() : 'TRACES TAXPAYER',
    assesseeAddress: assesseeAddress ? cleanCommasAndSpaces(assesseeAddress) : '',
    summaryTds,
    summaryTcs,
    summaryDemand,
    summaryRefund,
  };
}

function reconcileYears(
  detectedTaxYear: string | null,
  detectedFY: string | null,
  detectedAY: string | null,
  inferredFYFromDates: string | null
): {
  taxYear: string;
  financialYear: string;
  assessmentYear: string;
  yearScheme: 'tax_year' | 'fy_ay';
} {
  if (detectedTaxYear) {
    return {
      taxYear: detectedTaxYear,
      financialYear: detectedTaxYear,
      assessmentYear: shiftYearRange(detectedTaxYear, 1),
      yearScheme: 'tax_year',
    };
  }

  if (detectedFY || detectedAY) {
    const fy = detectedFY ?? shiftYearRange(detectedAY!, -1);
    const ay = detectedAY ?? shiftYearRange(fy, 1);
    const fyStart = parseStartYear(fy) ?? 0;
    return {
      taxYear: fy,
      financialYear: fy,
      assessmentYear: ay,
      yearScheme: fyStart >= 2026 ? 'tax_year' : 'fy_ay',
    };
  }

  if (inferredFYFromDates) {
    const fyStart = parseStartYear(inferredFYFromDates) ?? 0;
    return {
      taxYear: inferredFYFromDates,
      financialYear: inferredFYFromDates,
      assessmentYear: shiftYearRange(inferredFYFromDates, 1),
      yearScheme: fyStart >= 2026 ? 'tax_year' : 'fy_ay',
    };
  }

  return {
    taxYear: '2026-27',
    financialYear: '2026-27',
    assessmentYear: '2027-28',
    yearScheme: 'tax_year',
  };
}

function normalizeSectionCode(raw: string): string {
  const cleaned = raw
    .replace(/\s*\(\s*/g, '(')
    .replace(/\s*\)\s*/g, ')')
    .replace(/\s+/g, '')
    .trim();

  if (!cleaned) return '';

  if (/^94[A-Z0-9]{1,3}$/i.test(cleaned) || /^92[A-Z]?$/i.test(cleaned)) {
    return `1${cleaned.toUpperCase()}`;
  }

  const parenIdx = cleaned.indexOf('(');
  if (parenIdx > 0) {
    return `${cleaned.slice(0, parenIdx).toUpperCase()}${cleaned.slice(parenIdx)}`;
  }
  return cleaned.toUpperCase();
}

function extractSectionFromTransactionLine(
  combinedLine: string,
  firstDateIndex: number,
  partyType: 'Deductor' | 'Collector'
): string {
  const beforeDateRaw = combinedLine
    .slice(0, Math.max(0, firstDateIndex))
    .replace(TAN_REGEX, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (beforeDateRaw) {
    const tokens = beforeDateRaw.split(' ').filter(Boolean);

    if (tokens.length >= 2 && /^\d{1,4}\.?(?:\d+)?$/.test(tokens[0])) {
      const firstNum = tokens[0].replace(/\.$/, '');
      const secondToken = tokens[1];
      const looksLikeSplitSection =
        /^(?:19[2-7]|206|39[2-7])$/.test(firstNum) &&
        (secondToken.startsWith('(') || /^[A-Z]{1,3}$/i.test(secondToken));

      const sectionSlice = looksLikeSplitSection ? tokens : tokens.slice(1);
      const candidate = normalizeSectionCode(sectionSlice.join(' '));
      if (candidate && candidate !== '-' && !/^\d{1,2}$/.test(candidate)) {
        return candidate;
      }
    } else if (tokens.length === 1) {
      const candidate = normalizeSectionCode(tokens[0]);
      const isStatutoryCode =
        STRICT_SECTION_TOKEN_REGEX.test(candidate) ||
        (/[A-Z()]/i.test(candidate) && candidate.length >= 2 && candidate.length <= 18);
      if (isStatutoryCode) {
        return candidate;
      }
    } else if (tokens.length >= 2) {
      const candidate = normalizeSectionCode(tokens.join(' '));
      if (candidate && candidate.length <= 24) {
        return candidate;
      }
    }
  }

  const withoutAmountsOrDates = combinedLine
    .replace(AMOUNT_REGEX, ' ')
    .replace(DATE_TOKEN_REGEX, ' ')
    .replace(TAN_REGEX, ' ');

  const secMatch = withoutAmountsOrDates.match(STRICT_SECTION_TOKEN_REGEX);
  if (secMatch) {
    return normalizeSectionCode(secMatch[1]);
  }

  return partyType === 'Collector' ? 'TCS' : 'TDS';
}

function cleanPartyName(raw: string): string {
  return cleanCommasAndSpaces(
    raw
      .replace(/^\d+\s+/, '')
      .replace(/\b([A-Z])(?:\s+([A-Z])){2,}\b/g, (match) => match.replace(/\s+/g, ''))
  )
    .replace(/[\-|,:\s]+$/g, '')
    .trim();
}

function isNoiseLine(line: string): boolean {
  const lower = line.toLowerCase();
  return (
    lower.startsWith('page ') ||
    lower.startsWith('data updated till') ||
    lower.includes('annual tax statement') ||
    (lower.includes('traces') && lower.includes('copyright')) ||
    lower.includes('sr. no.') ||
    lower.includes('sr.no.') ||
    lower.includes('s.no.') ||
    lower.includes('amount paid / credited') ||
    lower.includes('amount paid/ credited') ||
    lower.includes('amount received/ debited') ||
    lower.includes('total amount paid') ||
    lower.includes('total amount received') ||
    lower.includes('total tax deducted') ||
    lower.includes('total tax collected') ||
    lower.includes('total tds deposited') ||
    lower.includes('total tcs deposited') ||
    lower.includes('date of booking') ||
    lower.includes('status of booking') ||
    (lower.includes('section') && lower.includes('transaction date')) ||
    (lower.includes('code') && lower.includes('booking')) ||
    lower.includes('name of deductor') ||
    lower.includes('name of collector') ||
    lower.includes('tan of deductor') ||
    lower.includes('tan of collector') ||
    lower.includes('(if available)') ||
    lower.includes('permanent account number') ||
    lower.includes('current status of pan') ||
    lower.includes('no transactions present') ||
    lower === 'part - a' ||
    lower.startsWith('legends') ||
    lower.startsWith('glossary of codes')
  );
}

function detectSectionHeader(line: string): {
  part: string;
  title: string;
  partyType: 'Deductor' | 'Collector';
  kind: 'tds_tcs' | 'challan' | 'other';
} | null {
  const norm = line.replace(/\s+/g, ' ').trim();
  const upper = norm.toUpperCase();

  if (/^PART\s*[-:]?\s*I\b/i.test(upper) && /TAX DEDUCTED/i.test(upper) && !/15G|15H|121/i.test(upper)) {
    return {
      part: 'PART I (TDS)',
      title: 'Details of Tax Deducted at Source',
      partyType: 'Deductor',
      kind: 'tds_tcs',
    };
  }
  if (/^PART\s*[-:]?\s*A\b/i.test(upper) && /TAX DEDUCTED/i.test(upper) && !/PART\s*[-:]?\s*A[12]/i.test(upper)) {
    return {
      part: 'PART A (TDS)',
      title: 'Details of Tax Deducted at Source',
      partyType: 'Deductor',
      kind: 'tds_tcs',
    };
  }
  if (/^PART\s*[-:]?\s*(II|A1)\b/i.test(upper) && /15G|15H|121|DEDUCTED/i.test(upper)) {
    return {
      part: 'PART II (TDS 15G/15H/121)',
      title: 'Tax Deducted at Source for Form No. 121 / 15G / 15H',
      partyType: 'Deductor',
      kind: 'tds_tcs',
    };
  }
  if (/^PART\s*[-:]?\s*A2\b/i.test(upper)) {
    return {
      part: 'PART A2 (194IA/IB/M)',
      title: 'TDS u/s 194IA / 194IB / 194M / 194S',
      partyType: 'Deductor',
      kind: 'tds_tcs',
    };
  }
  if (/^PART\s*[-:]?\s*III\b/i.test(upper) && /393|141|KIND|PROVISO/i.test(upper) && !/TAX PAID/i.test(upper)) {
    return {
      part: 'PART III (TDS in Kind)',
      title: 'Transactions in Kind / Partly in Kind u/s 393',
      partyType: 'Deductor',
      kind: 'tds_tcs',
    };
  }
  if (/^PART\s*[-:]?\s*IV\b/i.test(upper) && /393|194|DEDUCTED/i.test(upper) && !/COLLECTED/i.test(upper)) {
    return {
      part: 'PART IV (TDS - Property/VDA)',
      title: 'TDS u/s 393(1)/(2) — Seller / Landlord / VDA',
      partyType: 'Deductor',
      kind: 'tds_tcs',
    };
  }
  if (/^PART\s*[-:]?\s*V\b/i.test(upper) && /393|141|KIND|BUYER/i.test(upper) && !/TAX PAID/i.test(upper)) {
    return {
      part: 'PART V (Form 141 - Kind)',
      title: 'Transactions in Kind u/s 393(1) as per Form No. 141',
      partyType: 'Deductor',
      kind: 'other',
    };
  }
  if (/^PART\s*[-:]?\s*(VI|B)\b/i.test(upper) && /COLLECTED/i.test(upper)) {
    return {
      part: /^PART\s*[-:]?\s*VI\b/i.test(upper) ? 'PART VI (TCS)' : 'PART B (TCS)',
      title: 'Details of Tax Collected at Source',
      partyType: 'Collector',
      kind: 'tds_tcs',
    };
  }
  if (/^PART\s*[-:]?\s*IV\b/i.test(upper) && /COLLECTED/i.test(upper)) {
    return {
      part: 'PART IV (TCS)',
      title: 'Details of Tax Collected at Source',
      partyType: 'Collector',
      kind: 'tds_tcs',
    };
  }
  if (/^PART\s*[-:]?\s*(III|C|V)\b/i.test(upper) && /TAX PAID|OTHER THAN TDS/i.test(upper)) {
    return {
      part: 'PART C / III (Tax Paid)',
      title: 'Details of Tax Paid (Other than TDS or TCS)',
      partyType: 'Deductor',
      kind: 'challan',
    };
  }
  if (/^PART\s*[-:]?\s*VII\b/i.test(upper) && /COLLECTED/i.test(upper)) {
    return {
      part: 'PART VII (TCS)',
      title: 'Details of Tax Collected at Source',
      partyType: 'Collector',
      kind: 'tds_tcs',
    };
  }
  if (/^PART\s*[-:]?\s*VII\b/i.test(upper) && /REFUND/i.test(upper)) {
    return {
      part: 'PART VII (Paid Refund)',
      title: 'Details of Paid Refund (CPC TDS)',
      partyType: 'Deductor',
      kind: 'other',
    };
  }
  if (/^PART\s*[-:]?\s*VIII\b/i.test(upper)) {
    return {
      part: 'PART VIII (TDS - Deductee)',
      title: 'TDS u/s 393(1)/(2) — Buyer / Tenant / Contractor',
      partyType: 'Deductor',
      kind: 'other',
    };
  }
  if (/^PART\s*[-:]?\s*IX\b/i.test(upper)) {
    return {
      part: 'PART IX (Form 141 Demand)',
      title: 'Transactions / Demand Payments u/s 393(1) Form No. 141',
      partyType: 'Deductor',
      kind: 'other',
    };
  }
  if (/^PART\s*[-:]?\s*X\s*\(a\)/i.test(upper)) {
    return {
      part: 'PART X(a) (TDS/TCS Defaults)',
      title: 'TDS/TCS Defaults (Processing of Statements)',
      partyType: 'Deductor',
      kind: 'other',
    };
  }
  if (/^PART\s*[-:]?\s*X\s*\(b\)/i.test(upper)) {
    return {
      part: 'PART X(b) (AO Demand)',
      title: 'Other Demand(s) Raised by TDS AO',
      partyType: 'Deductor',
      kind: 'other',
    };
  }
  if (/^PART\s*[-:]?\s*XI\b/i.test(upper)) {
    return {
      part: 'PART XI (Credit u/s 398)',
      title: 'TDS/TCS Credit by AO under Order u/s 398',
      partyType: 'Deductor',
      kind: 'other',
    };
  }
  if (
    /^PART\s*[-:]?\s*(D|E|F|G|H)\b/i.test(upper) &&
    /REFUND|DEFAULT|AIR|SFT|DEMAND|TURNOVER|393|398|141|CREDIT BY AO|PAID|TAX DEDUCTED|TRANSACTIONS/i.test(upper)
  ) {
    return {
      part: norm.slice(0, 32),
      title: norm.slice(0, 80),
      partyType: 'Deductor',
      kind: 'other',
    };
  }

  return null;
}

export function parseForm26ASLines(
  lines: string[],
  pageCount = 1,
  sourceFormat: ParsedForm26AS['sourceFormat'] = 'pdf'
): ParsedForm26AS {
  const headerMeta = parseHeaderMetadata(lines);

  let currentPart = 'PART I (TDS)';
  let currentPartyType: 'Deductor' | 'Collector' = 'Deductor';
  let currentMode: 'tds_tcs' | 'challan' | 'other' = 'tds_tcs';
  const activePartsSet = new Set<string>();
  const seenPartsOrder: Array<{ part: string; title: string }> = [];
  const seenPartsNames = new Set<string>();

  const registerSeenPart = (part: string, title: string) => {
    if (!seenPartsNames.has(part)) {
      seenPartsNames.add(part);
      seenPartsOrder.push({ part, title });
    }
  };

  const partiesMap = new Map<string, Form26ASPartySummary>();
  const partyOrder: string[] = [];
  const partyByPartAndSr = new Map<string, string>();
  const transactions: Form26ASTransaction[] = [];
  const challans: Form26ASChallanRow[] = [];
  const partGrossTotals: Record<string, { amountPaid: number; taxDeducted: number; tdsDeposited: number }> = {};

  let activePartyKey: string | null = null;
  let lastValidNameLine = '';
  let lastNumericSrLine = '';

  const getOrCreateParty = (
    tan: string,
    partyPan: string,
    partyName: string,
    part: string,
    partyType: 'Deductor' | 'Collector',
    reportedTotals?: [number, number, number],
    reportedSrNo?: string
  ): Form26ASPartySummary => {
    const key = `${part}::${tan}`;
    if (reportedSrNo) {
      partyByPartAndSr.set(`${part}::${reportedSrNo}`, key);
    }

    const existing = partiesMap.get(key);
    if (existing) {
      if (reportedTotals) {
        existing.reportedAmountPaid = round2(existing.reportedAmountPaid + reportedTotals[0]);
        existing.reportedTaxDeducted = round2(existing.reportedTaxDeducted + reportedTotals[1]);
        existing.reportedTdsDeposited = round2(existing.reportedTdsDeposited + reportedTotals[2]);
      }
      if (partyPan !== '-' && existing.partyPan === '-') {
        existing.partyPan = partyPan;
      }
      if (partyName && partyName.length > existing.partyName.length && !partyName.startsWith('PARTY ')) {
        existing.partyName = partyName;
      }
      return existing;
    }

    const created: Form26ASPartySummary = {
      srNo: partyOrder.length + 1,
      part,
      partyType,
      partyName: partyName || `PARTY ${tan}`,
      tan,
      partyPan: partyPan || '-',
      transactionCount: 0,
      reversalCount: 0,
      grossAmountPaid: 0,
      grossTaxDeducted: 0,
      reversalAmountPaid: 0,
      reversalTaxDeducted: 0,
      reportedAmountPaid: reportedTotals ? reportedTotals[0] : 0,
      reportedTaxDeducted: reportedTotals ? reportedTotals[1] : 0,
      reportedTdsDeposited: reportedTotals ? reportedTotals[2] : 0,
      extractedAmountPaid: 0,
      extractedTaxDeducted: 0,
      extractedTdsDeposited: 0,
      varianceAmountPaid: 0,
      varianceTaxDeducted: 0,
      varianceTdsDeposited: 0,
      verificationStatus: 'Summary Only',
    };
    partiesMap.set(key, created);
    partyOrder.push(key);
    if (reportedSrNo) {
      partyByPartAndSr.set(`${part}::${reportedSrNo}`, key);
    }
    return created;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (/^(?:Notes for Annual Tax Statement|Glossary of Codes|Legends used in Annual Tax Statement)$/i.test(line)) {
      break;
    }

    const secHeader = detectSectionHeader(line);
    if (secHeader) {
      if (secHeader.part !== currentPart) {
        activePartyKey = null;
        lastValidNameLine = '';
        lastNumericSrLine = '';
      }
      currentPart = secHeader.part;
      currentPartyType = secHeader.partyType;
      currentMode = secHeader.kind;
      registerSeenPart(secHeader.part, secHeader.title);
      continue;
    }

    if (/^Gross\s+Total/i.test(line)) {
      const amts = parseAmountsFromLine(line);
      if (amts.length >= 3) {
        partGrossTotals[currentPart] = {
          amountPaid: amts[amts.length - 3],
          taxDeducted: amts[amts.length - 2],
          tdsDeposited: amts[amts.length - 1],
        };
        activePartsSet.add(currentPart);
      }
      activePartyKey = null;
      continue;
    }

    if (isNoiseLine(line)) continue;

    if (currentMode === 'challan') {
      const bsrMatch = line.match(/\b(\d{7})\b/);
      const dates = line.match(DATE_TOKEN_REGEX) || [];
      const amounts = parseAmountsFromLine(line);
      if (bsrMatch && dates.length >= 1 && amounts.length >= 1) {
        const challanSerialMatch = line.match(new RegExp(`${bsrMatch[1]}.*?\\b(\\d{4,6})\\b`));
        activePartsSet.add(currentPart);
        registerSeenPart(currentPart, 'Details of Tax Paid (Other than TDS or TCS)');
        challans.push({
          srNo: challans.length + 1,
          part: currentPart,
          bsrCode: bsrMatch[1],
          depositDate: dates[0] ?? '-',
          challanSerial: challanSerialMatch?.[1] || '-',
          majorHead: line.match(/\b(0020|0021)\b/)?.[1] || '-',
          minorHead: line.match(/\b(100|300|400)\b/)?.[1] || '-',
          totalTax: amounts[amounts.length - 1] ?? 0,
          remarks: '-',
        });
      }
      continue;
    }

    if (currentMode === 'other') {
      continue;
    }

    if (/^\d{1,3}$/.test(line)) {
      lastNumericSrLine = line;
      continue;
    }

    const tanMatch = line.match(TAN_REGEX);
    if (tanMatch) {
      const tan = tanMatch[1];
      const beforeTanRaw = (line.split(tan)[0] || '').trim();
      const srMatch =
        beforeTanRaw.match(/^(\d{1,3})\s+/) ||
        lastValidNameLine.match(/^(\d{1,3})\s+/) ||
        (lastNumericSrLine ? [lastNumericSrLine, lastNumericSrLine] : null);
      const reportedSrNo = srMatch?.[1];

      const beforeTan = cleanPartyName(beforeTanRaw);
      let inferredName =
        beforeTan.length >= 3
          ? beforeTan
          : cleanPartyName(lastValidNameLine) || `PARTY (${tan})`;

      if (!beforeTan && i + 1 < lines.length) {
        const nextCandidate = lines[i + 1].trim();
        if (
          nextCandidate &&
          !TAN_REGEX.test(nextCandidate) &&
          !DATE_TOKEN_REGEX.test(nextCandidate) &&
          parseAmountsFromLine(nextCandidate).length === 0 &&
          !detectSectionHeader(nextCandidate) &&
          !isNoiseLine(nextCandidate) &&
          !/^S\.?\s*No\.?/i.test(nextCandidate) &&
          nextCandidate.length <= 50
        ) {
          const suffix = cleanPartyName(nextCandidate);
          if (suffix && !inferredName.includes(suffix)) {
            inferredName = cleanPartyName(`${inferredName} ${suffix}`);
          }
          i += 1;
        }
      }

      const afterTan = line.split(tan)[1] || '';
      const afterTanMeta = afterTan.split(AMOUNT_SPLIT_REGEX)[0] || '';
      const panMatchAfterTan = afterTanMeta.match(PAN_REGEX);
      const partyPan = panMatchAfterTan ? panMatchAfterTan[1] : '-';

      let amounts = parseAmountsFromLine(afterTan);
      if (amounts.length < 3 && i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        if (!TAN_REGEX.test(nextLine) && !DATE_TOKEN_REGEX.test(nextLine)) {
          const nextAmts = parseAmountsFromLine(nextLine);
          if (nextAmts.length >= 3) {
            amounts = nextAmts;
          }
        }
      }

      const reportedTotals: [number, number, number] | undefined =
        amounts.length >= 3
          ? [amounts[amounts.length - 3], amounts[amounts.length - 2], amounts[amounts.length - 1]]
          : undefined;

      activePartsSet.add(currentPart);
      registerSeenPart(currentPart, currentPart);
      getOrCreateParty(tan, partyPan, inferredName, currentPart, currentPartyType, reportedTotals, reportedSrNo);
      activePartyKey = `${currentPart}::${tan}`;
      lastValidNameLine = '';
      lastNumericSrLine = '';
      continue;
    }

    let targetPartyKey = activePartyKey;
    const txSrPrefixMatch = line.match(/^(\d{1,3})\.(\d{1,4})\b/);
    if (txSrPrefixMatch) {
      const recoveredKey = partyByPartAndSr.get(`${currentPart}::${txSrPrefixMatch[1]}`);
      if (recoveredKey) {
        targetPartyKey = recoveredKey;
        activePartyKey = recoveredKey;
      }
    }

    if (targetPartyKey) {
      const party = partiesMap.get(targetPartyKey);
      if (!party) continue;

      let combinedLine = line;
      let dates = combinedLine.match(DATE_TOKEN_REGEX) || [];
      let amounts = parseAmountsFromLine(combinedLine);

      if (
        dates.length === 0 &&
        amounts.length === 0 &&
        /^\d{1,4}(?:\.\d+)?\s+[A-Z0-9()/-]{2,20}$/i.test(line) &&
        i + 1 < lines.length
      ) {
        const nextLine = lines[i + 1].trim();
        const nextDates = nextLine.match(DATE_TOKEN_REGEX) || [];
        if (nextDates.length >= 1 && !TAN_REGEX.test(nextLine) && !detectSectionHeader(nextLine)) {
          combinedLine = `${line} ${nextLine}`;
          dates = combinedLine.match(DATE_TOKEN_REGEX) || [];
          amounts = parseAmountsFromLine(combinedLine);
          i += 1;
        }
      }

      if (dates.length >= 1 && amounts.length < 3 && i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (!TAN_REGEX.test(nextLine) && !detectSectionHeader(nextLine)) {
          const nextAmts = parseAmountsFromLine(nextLine);
          if (nextAmts.length > 0) {
            combinedLine = `${combinedLine} ${nextLine}`;
            dates = combinedLine.match(DATE_TOKEN_REGEX) || [];
            amounts = parseAmountsFromLine(combinedLine);
            i += 1;
          }
        }
      }

      if (dates.length >= 1 && amounts.length >= 3) {
        const firstDateExec = new RegExp(DATE_TOKEN_REGEX.source).exec(combinedLine);
        const firstDateIdx = firstDateExec?.index ?? 0;

        const section = extractSectionFromTransactionLine(
          combinedLine,
          firstDateIdx,
          party.partyType
        );

        const txDate = dates[0] ?? '-';
        const bookDate = dates.length >= 2 ? dates[1] : '-';
        const amountPaid = amounts[amounts.length - 3];
        const taxDeducted = amounts[amounts.length - 2];
        const tdsDeposited = amounts[amounts.length - 1];

        const afterTxDate = combinedLine.slice(firstDateIdx + txDate.length);
        const beforeBookOrAmt =
          bookDate !== '-'
            ? afterTxDate.split(bookDate)[0] ?? afterTxDate
            : afterTxDate.split(AMOUNT_SPLIT_REGEX)[0] ?? afterTxDate;
        const statusMatch = beforeBookOrAmt.match(
          /\b(Final|Unmatched|Overbooked|Provisional|Matched|Booked|[FUOMB])\b/i
        );

        let remarks = '-';
        if (bookDate !== '-') {
          const afterBook = afterTxDate.split(bookDate).slice(1).join(bookDate);
          const beforeAmt = afterBook.split(AMOUNT_SPLIT_REGEX)[0]?.trim();
          if (beforeAmt && beforeAmt.length <= 32) {
            remarks = beforeAmt;
          }
        } else {
          const beforeAmt = beforeBookOrAmt
            .replace(/\b(?:Final|Unmatched|Overbooked|Provisional|Matched|Booked|[FUOMB])\b/i, '')
            .replace(/^\s*-\s*/, '')
            .trim();
          if (beforeAmt && beforeAmt.length <= 32) {
            remarks = beforeAmt;
          }
        }

        const cleanRemark = remarks || '-';
        const isReversal =
          amountPaid < 0 ||
          taxDeducted < 0 ||
          tdsDeposited < 0 ||
          /^(?:G|B)$/i.test(cleanRemark.trim());

        party.transactionCount += 1;
        party.extractedAmountPaid = round2(party.extractedAmountPaid + amountPaid);
        party.extractedTaxDeducted = round2(party.extractedTaxDeducted + taxDeducted);
        party.extractedTdsDeposited = round2(party.extractedTdsDeposited + tdsDeposited);
        if (isReversal) {
          party.reversalCount += 1;
          party.reversalAmountPaid = round2(party.reversalAmountPaid + amountPaid);
          party.reversalTaxDeducted = round2(party.reversalTaxDeducted + taxDeducted);
        } else {
          party.grossAmountPaid = round2(party.grossAmountPaid + amountPaid);
          party.grossTaxDeducted = round2(party.grossTaxDeducted + taxDeducted);
        }

        const srMatchOnLine = combinedLine.match(/^(\d{1,3}\.\d{1,4})\b/);
        const txSrNo = srMatchOnLine?.[1] ?? `${party.srNo}.${party.transactionCount}`;

        transactions.push({
          id: `tx-${transactions.length + 1}`,
          srNo: party.transactionCount,
          txSrNo,
          part: party.part,
          partyType: party.partyType,
          partyName: party.partyName,
          tan: party.tan,
          partyPan: party.partyPan,
          section,
          transactionDate: txDate,
          fiscalQuarter: getFiscalQuarter(txDate),
          bookingStatus: normalizeBookingStatus(statusMatch?.[1]),
          bookingDate: bookDate,
          remarks: cleanRemark,
          entryNature: isReversal ? 'Reversal' : 'Credit',
          amountPaid,
          taxDeducted,
          tdsDeposited,
        });
        continue;
      }
    }

    if (
      line.length >= 4 &&
      line.length <= 90 &&
      !/^\d[\d,.\s]+$/.test(line) &&
      !DATE_TOKEN_REGEX.test(line) &&
      !/^(?:Name|Address)\s+of\s+/i.test(line)
    ) {
      lastValidNameLine = line;
    }
  }

  const parties: Form26ASPartySummary[] = partyOrder.map((key, index) => {
    const p = partiesMap.get(key)!;
    p.srNo = index + 1;

    if (p.transactionCount === 0 && (p.reportedAmountPaid !== 0 || p.reportedTaxDeducted !== 0)) {
      p.verificationStatus = 'Summary Only';
      p.extractedAmountPaid = p.reportedAmountPaid;
      p.extractedTaxDeducted = p.reportedTaxDeducted;
      p.extractedTdsDeposited = p.reportedTdsDeposited;
      p.grossAmountPaid = p.reportedAmountPaid;
      p.grossTaxDeducted = p.reportedTaxDeducted;
      transactions.push({
        id: `tx-sum-${transactions.length + 1}`,
        srNo: 1,
        txSrNo: `${p.srNo}.1`,
        part: p.part,
        partyType: p.partyType,
        partyName: p.partyName,
        tan: p.tan,
        partyPan: p.partyPan,
        section: p.partyType === 'Collector' ? 'TCS' : 'TDS',
        transactionDate: '-',
        fiscalQuarter: 'Other / Unspecified',
        bookingStatus: 'Final',
        bookingDate: '-',
        remarks: 'Summary Row',
        entryNature: p.reportedAmountPaid < 0 || p.reportedTaxDeducted < 0 ? 'Reversal' : 'Credit',
        amountPaid: p.reportedAmountPaid,
        taxDeducted: p.reportedTaxDeducted,
        tdsDeposited: p.reportedTdsDeposited,
      });
    } else if (p.reportedAmountPaid === 0 && p.reportedTaxDeducted === 0 && p.transactionCount > 0) {
      p.reportedAmountPaid = p.extractedAmountPaid;
      p.reportedTaxDeducted = p.extractedTaxDeducted;
      p.reportedTdsDeposited = p.extractedTdsDeposited;
      p.verificationStatus = 'Verified';
    } else {
      p.varianceAmountPaid = round2(p.reportedAmountPaid - p.extractedAmountPaid);
      p.varianceTaxDeducted = round2(p.reportedTaxDeducted - p.extractedTaxDeducted);
      p.varianceTdsDeposited = round2(p.reportedTdsDeposited - p.extractedTdsDeposited);

      const maxDiff = Math.max(
        Math.abs(p.varianceAmountPaid),
        Math.abs(p.varianceTaxDeducted),
        Math.abs(p.varianceTdsDeposited)
      );
      p.verificationStatus = maxDiff <= 1 ? 'Verified' : 'Subtotal Variance';
    }

    return p;
  });

  const partCoverage: Form26ASPartCoverage[] = seenPartsOrder.map((sp) => {
    const pParties = parties.filter((p) => p.part === sp.part);
    const pTxs = transactions.filter((t) => t.part === sp.part);
    const pChallans = challans.filter((c) => c.part === sp.part);
    const paid = round2(
      pTxs.length > 0
        ? pTxs.reduce((s, t) => s + t.amountPaid, 0)
        : (partGrossTotals[sp.part]?.amountPaid ?? 0)
    );
    const tax = round2(
      pTxs.length > 0
        ? pTxs.reduce((s, t) => s + t.taxDeducted, 0)
        : pChallans.length > 0
          ? pChallans.reduce((s, c) => s + c.totalTax, 0)
          : (partGrossTotals[sp.part]?.taxDeducted ?? 0)
    );
    const dep = round2(
      pTxs.length > 0
        ? pTxs.reduce((s, t) => s + t.tdsDeposited, 0)
        : pChallans.length > 0
          ? pChallans.reduce((s, c) => s + c.totalTax, 0)
          : (partGrossTotals[sp.part]?.tdsDeposited ?? 0)
    );
    return {
      part: sp.part,
      title: sp.title,
      hasTransactions: pParties.length > 0 || pTxs.length > 0 || pChallans.length > 0,
      partyCount: pParties.length,
      txCount: pTxs.length + pChallans.length,
      amountPaid: paid,
      taxAmount: tax,
      depositedAmount: dep,
    };
  });

  const txDatesForYear = transactions
    .map((t) => t.transactionDate)
    .filter((d) => d && d !== '-');
  const challanDatesForYear = challans
    .map((c) => c.depositDate)
    .filter((d) => d && d !== '-');
  const inferredFY = inferFinancialYearFromDates(
    txDatesForYear.length > 0 ? txDatesForYear : challanDatesForYear
  );

  const reconciledYears = reconcileYears(
    headerMeta.detectedTaxYear,
    headerMeta.detectedFY,
    headerMeta.detectedAY,
    inferredFY
  );

  return {
    pan: headerMeta.pan,
    panStatus: headerMeta.panStatus,
    taxYear: reconciledYears.taxYear,
    assessmentYear: reconciledYears.assessmentYear,
    financialYear: reconciledYears.financialYear,
    yearScheme: reconciledYears.yearScheme,
    dataUpdatedTill: headerMeta.dataUpdatedTill,
    assesseeName: headerMeta.assesseeName,
    assesseeAddress: headerMeta.assesseeAddress,
    parties,
    transactions,
    challans,
    rawLineCount: lines.length,
    pageCount,
    detectedParts: Array.from(activePartsSet),
    partCoverage,
    sourceFormat,
    officialSummary: {
      summaryTds: headerMeta.summaryTds,
      summaryTcs: headerMeta.summaryTcs,
      summaryDemand: headerMeta.summaryDemand,
      summaryRefund: headerMeta.summaryRefund,
      partGrossTotals,
    },
  };
}

// ---------------------------------------------------------------------------
// TRACES .TXT & PASTED TEXT PARSER (supports ^ caret, | pipe, \t tab, plain)
// ---------------------------------------------------------------------------

function formatDelimitedLine(rawLine: string, delimiter: string): string {
  const cols = rawLine.split(delimiter).map((c) => c.trim()).filter((c) => c.length > 0);
  if (cols.length === 0) return '';

  const hasDate = cols.some((c) => DATE_TOKEN_REGEX.test(c));
  const hasTan = cols.some((c) => TAN_REGEX.test(c));
  if ((hasDate || hasTan) && cols.length >= 4) {
    const startIdx = Math.max(0, cols.length - 3);
    for (let idx = startIdx; idx < cols.length; idx++) {
      const cleaned = cols[idx].replace(/,/g, '');
      if (/^\(\s*\d+(?:\.\d+)?\s*\)$/.test(cleaned)) {
        const inner = cleaned.replace(/[()\s]/g, '');
        const num = Number.parseFloat(inner);
        if (Number.isFinite(num)) cols[idx] = `(${num.toFixed(2)})`;
      } else if (/^-?\d+(?:\.\d+)?$/.test(cleaned)) {
        const num = Number.parseFloat(cleaned);
        if (Number.isFinite(num)) cols[idx] = num.toFixed(2);
      }
    }
  }
  return cols.join(' ').replace(/\s+/g, ' ').trim();
}

export function parseForm26ASTextFile(
  rawText: string,
  sourceFormat: 'traces-txt' | 'pasted-text' = 'traces-txt'
): ParsedForm26AS {
  const rawLines = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const caretCount = rawLines.filter((l) => l.includes('^')).length;
  const pipeCount = rawLines.filter((l) => l.includes('|')).length;
  const tabCount = rawLines.filter((l) => l.includes('\t')).length;

  const delimiter =
    caretCount >= Math.max(3, rawLines.length * 0.15)
      ? '^'
      : pipeCount >= Math.max(3, rawLines.length * 0.15)
        ? '|'
        : tabCount >= Math.max(3, rawLines.length * 0.15)
          ? '\t'
          : null;

  const normalizedLines = delimiter
    ? rawLines.map((l) => formatDelimitedLine(l, delimiter)).filter(Boolean)
    : rawLines;

  return parseForm26ASLines(normalizedLines, 1, sourceFormat);
}

// ---------------------------------------------------------------------------
// EXCEL (.XLSX / .XLS) & CSV PORTAL DOWNLOAD PARSER
// ---------------------------------------------------------------------------

function formatExcelDateCell(val: unknown): string {
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dd = String(val.getDate()).padStart(2, '0');
    const mmm = months[val.getMonth()] || 'Jan';
    const yyyy = val.getFullYear();
    return `${dd}-${mmm}-${yyyy}`;
  }
  if (typeof val === 'number' && val > 25000 && val < 70000) {
    const utcDays = Math.floor(val - 25569);
    const d = new Date(utcDays * 86400 * 1000);
    if (!Number.isNaN(d.getTime())) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${String(d.getUTCDate()).padStart(2, '0')}-${months[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
    }
  }
  return String(val ?? '').trim();
}

function parseExcelNumber(val: unknown): number {
  if (typeof val === 'number' && Number.isFinite(val)) return round2(val);
  const raw = String(val ?? '').trim();
  if (!raw || raw === '-') return 0;
  const isParenNeg = raw.startsWith('(') && raw.endsWith(')');
  const cleaned = raw.replace(/[₹$,()\s]/g, '');
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n)) return 0;
  return round2(isParenNeg ? -Math.abs(n) : n);
}

function tryParseFlatWorkbookSheet(
  rows: unknown[][],
  metaRowsText: string[]
): ParsedForm26AS | null {
  let headerRowIdx = -1;
  let colMap: Record<string, number> = {};

  for (let r = 0; r < Math.min(rows.length, 30); r++) {
    const row = rows[r];
    if (!Array.isArray(row) || row.length < 4) continue;
    const lowered = row.map((c) => String(c ?? '').trim().toLowerCase());

    const tanIdx = lowered.findIndex((h) => /\btan\b/.test(h));
    const partyIdx = lowered.findIndex((h) =>
      /(deductor|collector|party)\s*name|\bname of (?:deductor|collector)|party$/.test(h)
    );
    const paidIdx = lowered.findIndex((h) =>
      /(amount\s*paid|credited|received|debited|gross\s*amount)/.test(h)
    );
    const dedIdx = lowered.findIndex((h) =>
      /(tax\s*deducted|tax\s*collected|tds\s*deducted|tcs\s*collected|\bdeducted\b)/.test(h)
    );
    const depIdx = lowered.findIndex((h) => /(deposited|\btds\s*deposited|\btcs\s*deposited)/.test(h));

    if (tanIdx >= 0 && (paidIdx >= 0 || dedIdx >= 0 || depIdx >= 0)) {
      headerRowIdx = r;
      colMap = {
        txSrNo: lowered.findIndex((h) => /26as\s*ref|s\.?\s*no/.test(h)),
        part: lowered.findIndex((h) => /^part\b/.test(h)),
        partyType: lowered.findIndex((h) => /^type\b|party\s*type/.test(h)),
        partyName: partyIdx >= 0 ? partyIdx : lowered.findIndex((h) => h.includes('name')),
        tan: tanIdx,
        partyPan: lowered.findIndex((h) => /pan\s*of\s*party|deductor\s*pan|collector\s*pan|party\s*pan|\bpan\b/.test(h)),
        section: lowered.findIndex((h) => /section|\bsec\b/.test(h)),
        txDate: lowered.findIndex((h) => /txn\s*date|transaction\s*date|\bdate\b/.test(h)),
        status: lowered.findIndex((h) => /booking\s*status|\bsts\b|\bstatus\b/.test(h)),
        bookDate: lowered.findIndex((h) => /booking\s*date|date\s*of\s*booking/.test(h)),
        remarks: lowered.findIndex((h) => /remarks/.test(h)),
        paid: paidIdx,
        deducted: dedIdx,
        deposited: depIdx >= 0 ? depIdx : dedIdx,
      };
      break;
    }
  }

  if (headerRowIdx < 0) return null;

  const headerMeta = parseHeaderMetadata(metaRowsText);
  const partiesMap = new Map<string, Form26ASPartySummary>();
  const partyOrder: string[] = [];
  const transactions: Form26ASTransaction[] = [];
  const detectedPartsSet = new Set<string>();

  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!Array.isArray(row) || row.every((c) => c === null || c === undefined || String(c).trim() === '')) {
      continue;
    }
    const firstCells = row.slice(0, 4).map((c) => String(c ?? '').trim().toUpperCase()).join(' ');
    if (
      /TOTAL|GRAND\s*TOTAL|SUBTOTAL|DEDUCTOR\s*\/\s*COLLECTOR\s*LIVE\s*SUMIFS/i.test(firstCells) ||
      /^SR\s*NO\b/i.test(firstCells)
    ) {
      if (/DEDUCTOR\s*\/\s*COLLECTOR\s*LIVE\s*SUMIFS/i.test(firstCells)) break;
      continue;
    }

    const rawTan = String(row[colMap.tan] ?? '').trim().toUpperCase();
    if (!TAN_REGEX.test(rawTan)) continue;

    const rawPanCell = colMap.partyPan >= 0 ? String(row[colMap.partyPan] ?? '').trim().toUpperCase() : '';
    const partyPan = PAN_REGEX.test(rawPanCell) ? rawPanCell.match(PAN_REGEX)![1] : '-';

    const rawParty = colMap.partyName >= 0 ? cleanPartyName(String(row[colMap.partyName] ?? '')) : `PARTY (${rawTan})`;
    const rawPart = colMap.part >= 0 ? String(row[colMap.part] ?? '').trim() : 'PART I (TDS)';
    const part = rawPart || 'PART I (TDS)';
    const rawType = colMap.partyType >= 0 ? String(row[colMap.partyType] ?? '').trim() : '';
    const partyType: 'Deductor' | 'Collector' =
      /collector|tcs|part\s*(?:vi|vii|b)/i.test(`${rawType} ${part}`) ? 'Collector' : 'Deductor';

    const section =
      colMap.section >= 0
        ? normalizeSectionCode(String(row[colMap.section] ?? '')) || (partyType === 'Collector' ? 'TCS' : 'TDS')
        : partyType === 'Collector'
          ? 'TCS'
          : 'TDS';

    const txDate = colMap.txDate >= 0 ? formatExcelDateCell(row[colMap.txDate]) || '-' : '-';
    const bookDate = colMap.bookDate >= 0 ? formatExcelDateCell(row[colMap.bookDate]) || '-' : '-';
    const bookingStatus =
      colMap.status >= 0 ? normalizeBookingStatus(String(row[colMap.status] ?? 'Final')) : 'Final';
    const remarks = colMap.remarks >= 0 ? String(row[colMap.remarks] ?? '-').trim() || '-' : '-';

    const amountPaid = colMap.paid >= 0 ? parseExcelNumber(row[colMap.paid]) : 0;
    const taxDeducted = colMap.deducted >= 0 ? parseExcelNumber(row[colMap.deducted]) : 0;
    const tdsDeposited = colMap.deposited >= 0 ? parseExcelNumber(row[colMap.deposited]) : taxDeducted;
    const isReversal =
      amountPaid < 0 || taxDeducted < 0 || tdsDeposited < 0 || /^(?:G|B)$/i.test(remarks.trim());

    detectedPartsSet.add(part);
    const key = `${part}::${rawTan}`;
    let party = partiesMap.get(key);
    if (!party) {
      party = {
        srNo: partyOrder.length + 1,
        part,
        partyType,
        partyName: rawParty || `PARTY (${rawTan})`,
        tan: rawTan,
        partyPan,
        transactionCount: 0,
        reversalCount: 0,
        grossAmountPaid: 0,
        grossTaxDeducted: 0,
        reversalAmountPaid: 0,
        reversalTaxDeducted: 0,
        reportedAmountPaid: 0,
        reportedTaxDeducted: 0,
        reportedTdsDeposited: 0,
        extractedAmountPaid: 0,
        extractedTaxDeducted: 0,
        extractedTdsDeposited: 0,
        varianceAmountPaid: 0,
        varianceTaxDeducted: 0,
        varianceTdsDeposited: 0,
        verificationStatus: 'Verified',
      };
      partiesMap.set(key, party);
      partyOrder.push(key);
    }

    if (partyPan !== '-' && party.partyPan === '-') {
      party.partyPan = partyPan;
    }

    party.transactionCount += 1;
    party.extractedAmountPaid = round2(party.extractedAmountPaid + amountPaid);
    party.extractedTaxDeducted = round2(party.extractedTaxDeducted + taxDeducted);
    party.extractedTdsDeposited = round2(party.extractedTdsDeposited + tdsDeposited);
    if (isReversal) {
      party.reversalCount += 1;
      party.reversalAmountPaid = round2(party.reversalAmountPaid + amountPaid);
      party.reversalTaxDeducted = round2(party.reversalTaxDeducted + taxDeducted);
    } else {
      party.grossAmountPaid = round2(party.grossAmountPaid + amountPaid);
      party.grossTaxDeducted = round2(party.grossTaxDeducted + taxDeducted);
    }
    party.reportedAmountPaid = party.extractedAmountPaid;
    party.reportedTaxDeducted = party.extractedTaxDeducted;
    party.reportedTdsDeposited = party.extractedTdsDeposited;

    const txSrNo =
      colMap.txSrNo >= 0 && String(row[colMap.txSrNo] ?? '').trim()
        ? String(row[colMap.txSrNo]).trim()
        : `${party.srNo}.${party.transactionCount}`;

    transactions.push({
      id: `tx-${transactions.length + 1}`,
      srNo: party.transactionCount,
      txSrNo,
      part,
      partyType,
      partyName: party.partyName,
      tan: rawTan,
      partyPan: party.partyPan,
      section,
      transactionDate: txDate,
      fiscalQuarter: getFiscalQuarter(txDate),
      bookingStatus,
      bookingDate: bookDate,
      remarks,
      entryNature: isReversal ? 'Reversal' : 'Credit',
      amountPaid,
      taxDeducted,
      tdsDeposited,
    });
  }

  if (transactions.length === 0) return null;

  const parties = partyOrder.map((k, idx) => {
    const p = partiesMap.get(k)!;
    p.srNo = idx + 1;
    return p;
  });

  const inferredFY = inferFinancialYearFromDates(
    transactions.map((t) => t.transactionDate).filter((d) => d && d !== '-')
  );
  const reconciled = reconcileYears(
    headerMeta.detectedTaxYear,
    headerMeta.detectedFY,
    headerMeta.detectedAY,
    inferredFY
  );

  return {
    pan: headerMeta.pan,
    panStatus: headerMeta.panStatus,
    taxYear: reconciled.taxYear,
    assessmentYear: reconciled.assessmentYear,
    financialYear: reconciled.financialYear,
    yearScheme: reconciled.yearScheme,
    dataUpdatedTill: headerMeta.dataUpdatedTill,
    assesseeName: headerMeta.assesseeName,
    assesseeAddress: headerMeta.assesseeAddress,
    parties,
    transactions,
    challans: [],
    rawLineCount: rows.length,
    pageCount: 1,
    detectedParts: Array.from(detectedPartsSet),
    partCoverage: Array.from(detectedPartsSet).map((part) => {
      const pParties = parties.filter((p) => p.part === part);
      const pTxs = transactions.filter((t) => t.part === part);
      return {
        part,
        title: part,
        hasTransactions: pTxs.length > 0,
        partyCount: pParties.length,
        txCount: pTxs.length,
        amountPaid: round2(pTxs.reduce((s, t) => s + t.amountPaid, 0)),
        taxAmount: round2(pTxs.reduce((s, t) => s + t.taxDeducted, 0)),
        depositedAmount: round2(pTxs.reduce((s, t) => s + t.tdsDeposited, 0)),
      };
    }),
    sourceFormat: 'excel-csv',
  };
}

export async function parseForm26ASWorkbookFile(
  buffer: ArrayBuffer,
  fileName: string
): Promise<ParsedForm26AS> {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const allRowsText: string[] = [];

  const orderedSheetNames = [...wb.SheetNames].sort((a, b) => {
    const aIs26AS = a.trim().toUpperCase() === '26AS' ? 0 : 1;
    const bIs26AS = b.trim().toUpperCase() === '26AS' ? 0 : 1;
    return aIs26AS - bIs26AS;
  });

  for (const sheetName of orderedSheetNames) {
    if (
      /^(?:executive summary|tds - deductors|tds - transactions|tcs - collectors|tcs - transactions|month & quarter matrix|party summary|section & quarter audit|audit & exceptions|tax paid \(challans\))$/i.test(
        sheetName.trim()
      )
    ) {
      continue;
    }
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: '' });
    const topMetaLines = rows
      .slice(0, 15)
      .map((r) => (Array.isArray(r) ? r.map((c) => formatExcelDateCell(c)).filter(Boolean).join(' ') : ''))
      .filter(Boolean);

    const flatParsed = tryParseFlatWorkbookSheet(rows, topMetaLines);
    if (flatParsed) {
      return flatParsed;
    }

    for (const r of rows) {
      if (!Array.isArray(r)) continue;
      const cells = r
        .map((c) => {
          if (typeof c === 'number') {
            return Number.isInteger(c) && Math.abs(c) < 10000 ? String(c) : c.toFixed(2);
          }
          return formatExcelDateCell(c);
        })
        .filter(Boolean);
      if (cells.length > 0) {
        allRowsText.push(cells.join(' ').replace(/\s+/g, ' ').trim());
      }
    }
  }

  const parsed = parseForm26ASLines(allRowsText, wb.SheetNames.length, 'excel-csv');
  if (parsed.assesseeName === 'TRACES TAXPAYER' && fileName) {
    const panInFile = fileName.toUpperCase().match(PAN_REGEX);
    if (panInFile && parsed.pan === 'NOT DETECTED') {
      parsed.pan = panInFile[1];
    }
  }
  return parsed;
}
