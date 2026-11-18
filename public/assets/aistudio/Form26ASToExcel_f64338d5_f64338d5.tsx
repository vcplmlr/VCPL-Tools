import React, { useState, useRef } from 'react';
import {
  ArrowLeft,
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  FileText,
  Sparkles,
  ExternalLink,
  Info,
} from 'lucide-react';
import ExcelJS from 'exceljs';
import confetti from 'canvas-confetti';
import { extractTextFromPdf } from '../../utils/pdfExtractor';
import {
  AdRectanglePair,
  AdSlot,
  ResponsiveAdBanner,
  SmartlinkBanner,
} from '../ads/AdSlot';
import { ContextualAdWidget } from '../ads/ContextualAdWidget';
import { useViewportBand } from '../ads/useViewportBand';
import { Form26ASToExcelArticle } from '../articles/Form26ASToExcelArticle';

interface Form26ASToExcelProps {
  onBack: () => void;
}

// --------------------------------------------------------------------------
// Section descriptions (from the legend printed in the statement)
// --------------------------------------------------------------------------
const SECTION_DESC: Record<string, string> = {
  '192': 'Salary',
  '192A': 'TDS on PF withdrawal',
  '193': 'Interest on Securities',
  '194': 'Dividends',
  '194A': "Interest other than 'Interest on securities'",
  '194B': 'Winning from lottery or crossword puzzle, etc',
  '194BA': 'Winnings from online games',
  '194BB': 'Winning from horse race',
  '194C': 'Payments to contractors and sub-contractors',
  '194D': 'Insurance commission',
  '194DA': 'Payment in respect of life insurance policy',
  '194E': 'Payments to non-resident sportsmen or sports associations',
  '194EE': 'Payments in respect of deposits under National Savings Scheme',
  '194G': 'Commission, price, etc. on sale of lottery tickets',
  '194H': 'Commission or brokerage',
  '194I(A)': 'Rent on hiring of plant and machinery',
  '194I(B)': 'Rent on other than plant and machinery',
  '194IA': 'TDS on Sale of immovable property',
  '194IB': 'Payment of rent by certain individuals or HUF',
  '194IC': 'Payment under specified agreement',
  '194J(A)': 'Fees for technical services',
  '194J(B)': 'Fees for professional services or royalty etc',
  '194JB': 'Fees for professional services or royalty etc (194J(b))',
  '194K': 'Income payable in respect of units of a specified mutual fund / UTI',
  '194LA': 'Payment of compensation on acquisition of certain immovable property',
  '194LB': 'Income by way of interest from Infrastructure Debt fund',
  '194LBA': 'Certain income from units of a business trust',
  '194LBB': 'Income in respect of units of investment fund',
  '194LBC': 'Income in respect of investment in securitization trust',
  '194LD': 'TDS on interest on bonds / government securities',
  '194M': 'Payment of certain sums by certain individuals or HUF',
  '194N': 'Payment of certain amounts in cash',
  '194O': 'Payment of certain sums by e-commerce operator to e-commerce participant',
  '194P': 'Deduction of tax in case of specified senior citizen',
  '194Q': 'TDS on payment of certain sum for purchase of goods',
  '194R': 'Benefits or perquisites of business or profession',
  '194S': 'Payment for transfer of virtual digital asset',
  '194T': 'Payment of salary, remuneration, commission, bonus or interest to a partner of firm',
  '195': 'Other sums payable to a non-resident',
  '206CA': 'TCS - alcoholic liquor for human consumption',
  '206CB': 'TCS - Timber / forest produce under forest lease',
  '206CC': 'TCS - Timber obtained by mode other than forest lease',
  '206CE': 'TCS - Scrap',
  '206CF': 'TCS - Parking lots',
  '206CG': 'TCS - Toll plaza',
  '206CH': 'TCS - Mine or quarry',
  '206CI': 'TCS - Tendu leaves',
  '206CJ': 'TCS - Sale of certain minerals',
  '206CK': 'TCS - Cash sale of bullion and jewellery',
  '206CL': 'TCS - Sale of motor vehicle',
  '206CM': 'TCS - Sale in cash of any goods (other than bullion/jewellery)',
  '206CN': 'TCS - Providing of any services (other than Chapter XVII-B)',
};

const STATUS_DESC: Record<string, string> = {
  F: 'Final',
  U: 'Unmatched',
  M: 'Matched',
  P: 'Provisional',
  O: 'Overbooked',
  Z: 'Mismatch',
};

const REMARK_DESC: Record<string, string> = {
  A: 'Rectification of error in challan uploaded by bank',
  B: 'Rectification of error in statement uploaded by deductor',
  D: 'Rectification of error in Form 24G filed by Accounts Officer',
  E: 'Rectification of error in Challan by Assessing Officer',
  F: 'Lower/No deduction certificate u/s 197',
  G: 'Reprocessing of Statement',
  T: 'Transporter',
  W: 'For Part III, details as submitted by Deductor',
};

// --------------------------------------------------------------------------
// Data Interfaces
// --------------------------------------------------------------------------
interface Deductor {
  part: 'TDS' | 'TCS';
  sr: number;
  name: string;
  tan: string;
  tot_amt: number;
  tot_tax: number;
  tot_dep: number;
}

interface TxnRow {
  part: 'TDS' | 'TCS';
  d_sr: number;
  d_name: string;
  d_tan: string;
  d_tot_amt: number;
  d_tot_tax: number;
  d_tot_dep: number;
  t_sr: number;
  section: string;
  txn_date: string;
  status: string;
  book_date: string;
  remarks: string;
  amt: number;
  tax: number;
  dep: number;
}

interface StatementHeader {
  PAN: string;
  'PAN Status': string;
  'Financial Year': string;
  'Assessment Year': string;
  'Name of Assessee': string;
  Address: string;
  'Data updated till': string;
}

interface ConversionResult {
  assessee: string;
  pan: string;
  assessment_year: string;
  total_rows: number;
  totals: {
    TDS: { parties: number; rows: number; amount: string; tax: string };
    TCS: { parties: number; rows: number; amount: string; tax: string };
  };
  sheets: number;
  verified: boolean;
  problems: string[];
  warnings: string[];
  blob: Blob;
  downloadFilename: string;
}

// --------------------------------------------------------------------------
// Parsing Functions (identical logic to form26as_to_excel.py)
// --------------------------------------------------------------------------
function parseHeader(text: string): StatementHeader {
  const head = text.slice(0, 4500);
  const mPan = head.match(/Permanent Account Number \(PAN\)\s+([A-Z]{5}\d{4}[A-Z])/i);
  const mStatus = head.match(/Current Status of PAN\s+(\w+)/i);
  const mFy = head.match(/Financial Year\s+(\d{4}-\d{2})/i);
  const mAy = head.match(/Assessment Year\s+(\d{4}-\d{2})/i);
  const mName = head.match(/Name of Assessee\s+([^\n\r]+)/i);
  const mAddr = head.match(/Address of Assessee\s+([^\n\r]+)(?:\r?\n\s*([^\n\r]+))?/i);
  const mDate = head.match(/Data updated till\s+(\S+)/i);

  let address = '';
  if (mAddr) {
    address = mAddr[1].trim();
    if (mAddr[2] && !mAddr[2].includes('Financial Year') && !mAddr[2].includes('Assessment Year')) {
      address += ' ' + mAddr[2].trim();
    }
  }

  return {
    PAN: mPan ? mPan[1].trim() : '',
    'PAN Status': mStatus ? mStatus[1].trim() : '',
    'Financial Year': mFy ? mFy[1].trim() : '',
    'Assessment Year': mAy ? mAy[1].trim() : '',
    'Name of Assessee': mName ? mName[1].trim() : '',
    Address: address,
    'Data updated till': mDate ? mDate[1].trim() : '',
  };
}

function parseStatement(text: string): {
  deductors: Deductor[];
  rows: TxnRow[];
  otherPartData: Record<string, boolean>;
  otherPartSeen: Set<string>;
} {
  const lines = text.split(/\r?\n/);

  let part: 'I' | 'VI' | string | null = null;
  let cur: Deductor | null = null;
  let lastWasDeductor = false;
  const deductors: Deductor[] = [];
  const rows: TxnRow[] = [];
  const otherPartData: Record<string, boolean> = {};
  const otherPartSeen = new Set<string>();

  const AMT = /-?\d[\d,]*\.\d{2}/;
  const DATE = /\d{2}-[A-Za-z]{3}-\d{4}/;
  const RE_DEDUCTOR = /^\s*(\d{1,4})\s+(.+?)\s+([A-Z]{4}\d{5}[A-Z])\s+(-?\d[\d,]*\.\d{2})\s+(-?\d[\d,]*\.\d{2})\s+(-?\d[\d,]*\.\d{2})\s*$/;
  const RE_TXN = /^\s*(\d{1,4})\s+(\S+)\s+(\d{2}-[A-Za-z]{3}-\d{4})\s+([A-Z])\s+(\d{2}-[A-Za-z]{3}-\d{4})\s+(\S+)\s+(-?\d[\d,]*\.\d{2})\s+(-?\d[\d,]*\.\d{2})\s+(-?\d[\d,]*\.\d{2})\s*$/;

  for (const raw of lines) {
    const line = raw.trimEnd();
    const s = line.trim();
    if (!s) continue;

    // Part switching
    const mp = s.match(/^PART[\s-]*([IVX]+)\b/i);
    if (mp && (s.includes('Details') || /^PART X/i.test(s))) {
      const pid = mp[1].toUpperCase();
      part = pid;
      cur = null;
      lastWasDeductor = false;
      if (pid !== 'I' && pid !== 'VI') {
        otherPartSeen.add(pid);
      }
      continue;
    }

    // Other parts check (II, III, IV, V, VII, VIII, IX, X)
    if (part !== null && part !== 'I' && part !== 'VI') {
      if (s.includes('No Transactions Present')) {
        if (otherPartData[part] === undefined) {
          otherPartData[part] = false;
        }
      } else if (['VII', 'II', 'III', 'IV', 'V', 'VIII', 'IX', 'X'].includes(part)) {
        if (DATE.test(s) && AMT.test(s)) {
          otherPartData[part] = true;
        }
      }
      if (s.startsWith('Contact Information') || s.startsWith('*Notes') || s.startsWith('Legends used')) {
        part = null;
      }
      continue;
    }

    if (part !== 'I' && part !== 'VI') continue;

    // Skip repeating table / page headers
    if (
      s.startsWith('Assessee PAN') ||
      s.startsWith('Sr. No') ||
      s.startsWith('Credited') ||
      s.startsWith('Debited') ||
      s.startsWith('Deposited') ||
      s.startsWith('Asset)') ||
      s.startsWith('Name of')
    ) {
      if (s.startsWith('Sr. No')) lastWasDeductor = false;
      continue;
    }

    // Deductor / collector line
    const mDed = line.match(RE_DEDUCTOR);
    if (mDed && !line.match(RE_TXN)) {
      cur = {
        part: part === 'I' ? 'TDS' : 'TCS',
        sr: parseInt(mDed[1], 10),
        name: mDed[2].replace(/\s+/g, ' ').trim(),
        tan: mDed[3].trim(),
        tot_amt: parseFloat(mDed[4].replace(/,/g, '')) || 0,
        tot_tax: parseFloat(mDed[5].replace(/,/g, '')) || 0,
        tot_dep: parseFloat(mDed[6].replace(/,/g, '')) || 0,
      };
      deductors.push(cur);
      lastWasDeductor = true;
      continue;
    }

    // Transaction line
    const mTx = line.match(RE_TXN);
    if (mTx && cur !== null) {
      rows.push({
        part: cur.part,
        d_sr: cur.sr,
        d_name: cur.name,
        d_tan: cur.tan,
        d_tot_amt: cur.tot_amt,
        d_tot_tax: cur.tot_tax,
        d_tot_dep: cur.tot_dep,
        t_sr: parseInt(mTx[1], 10),
        section: mTx[2].trim(),
        txn_date: mTx[3].trim(),
        status: mTx[4].trim(),
        book_date: mTx[5].trim(),
        remarks: mTx[6].trim(),
        amt: parseFloat(mTx[7].replace(/,/g, '')) || 0,
        tax: parseFloat(mTx[8].replace(/,/g, '')) || 0,
        dep: parseFloat(mTx[9].replace(/,/g, '')) || 0,
      });
      lastWasDeductor = false;
      continue;
    }

    // Name continuation (e.g. address or name wrapped to second line)
    if (cur !== null && lastWasDeductor && !/^\d+/.test(s)) {
      cur.name = (cur.name + ' ' + s.replace(/\s+/g, ' ')).trim();
      continue;
    }
  }

  return { deductors, rows, otherPartData, otherPartSeen };
}

// --------------------------------------------------------------------------
// Verification
// --------------------------------------------------------------------------
function verify(
  deductors: Deductor[],
  rows: TxnRow[]
): { deductor: Deductor; rowsCount: number; sa: number; st: number; sd: number }[] {
  const problems: { deductor: Deductor; rowsCount: number; sa: number; st: number; sd: number }[] = [];
  for (const d of deductors) {
    const rs = rows.filter((r) => r.part === d.part && r.d_sr === d.sr);
    const sa = rs.reduce((acc, r) => acc + r.amt, 0);
    const st = rs.reduce((acc, r) => acc + r.tax, 0);
    const sd = rs.reduce((acc, r) => acc + r.dep, 0);
    if (
      Math.abs(sa - d.tot_amt) > 1.0 ||
      Math.abs(st - d.tot_tax) > 1.0 ||
      Math.abs(sd - d.tot_dep) > 1.0
    ) {
      problems.push({ deductor: d, rowsCount: rs.length, sa, st, sd });
    }
  }
  return problems;
}

// --------------------------------------------------------------------------
// Excel Generation (matching openpyxl styles, formulas & column widths)
// --------------------------------------------------------------------------
const COLUMNS_DEF: [string, number][] = [
  ['Type (TDS/TCS)', 12],
  ['Deductor / Collector Sr.No', 12],
  ['Name of Deductor / Collector', 44],
  ['TAN', 14],
  ['Txn Sr.No', 8],
  ['Section', 10],
  ['Section Description', 42],
  ['Transaction Date', 14],
  ['Status of Booking', 10],
  ['Status Meaning', 12],
  ['Date of Booking', 14],
  ['Remarks Code', 9],
  ['Remarks Meaning', 36],
  ['Amount Paid / Credited', 18],
  ['Tax Deducted / Collected', 18],
  ['TDS / TCS Deposited', 18],
  ['Deductor Total Amount (as per PDF)', 20],
  ['Deductor Total Tax (as per PDF)', 20],
  ['Deductor Total Deposited (as per PDF)', 20],
];

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFBFBFBF' } },
  left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
  bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
  right: { style: 'thin', color: { argb: 'FFBFBFBF' } },
};

const REV_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFDE9E7' },
};

function safeSheetName(label: string, used: Set<string>): string {
  const base = label.replace(/[\\/*?:\[\]]/g, '').trim().slice(0, 31) || 'Party';
  let name = base;
  let i = 2;
  while (used.has(name.toLowerCase())) {
    const suffix = ` (${i})`;
    name = base.slice(0, 31 - suffix.length) + suffix;
    i++;
  }
  used.add(name.toLowerCase());
  return name;
}

const COL_LETTERS_MAP: Record<number, string> = { 14: 'N', 15: 'O', 16: 'P' };

async function buildWorkbook(
  header: StatementHeader,
  rows: TxnRow[],
  deductors: Deductor[],
  combined: boolean,
  partywise: boolean
): Promise<Blob> {
  const wb = new ExcelJS.Workbook();
  const used = new Set<string>(['26as', 'party summary']);

  // Write Combined Sheet
  if (combined) {
    const ws = wb.addWorksheet('26AS');

    // Title & Assessee Info
    ws.getCell('A1').value = 'ANNUAL TAX STATEMENT (FORM 26AS) - CONSOLIDATED';
    ws.getCell('A1').font = { bold: true, size: 14 };

    const infoRows: [string, string][] = [
      ['PAN', header.PAN],
      ['Name of Assessee', header['Name of Assessee']],
      ['Address', header.Address],
      ['Financial Year', header['Financial Year']],
      ['Assessment Year', header['Assessment Year']],
      ['PAN Status', header['PAN Status']],
      ['Data updated till', header['Data updated till']],
    ];

    let r = 2;
    for (const [k, v] of infoRows) {
      ws.getCell(`A${r}`).value = k;
      ws.getCell(`A${r}`).font = { bold: true };
      ws.getCell(`C${r}`).value = v;
      r++;
    }

    // Summary block (live Excel formulas)
    const hdrRow = r + 6;
    const first = hdrRow + 1;
    const last = hdrRow + rows.length;

    ws.getCell(`A${r}`).value = 'Summary (formulas, include reversals)';
    ws.getCell(`A${r}`).font = { bold: true };

    ws.getCell(`A${r + 1}`).value = 'TDS - Amount Paid/Credited';
    ws.getCell(`C${r + 1}`).value = { formula: `SUMIFS(N${first}:N${last},A${first}:A${last},"TDS")` };

    ws.getCell(`A${r + 2}`).value = 'TDS - Tax Deducted';
    ws.getCell(`C${r + 2}`).value = { formula: `SUMIFS(O${first}:O${last},A${first}:A${last},"TDS")` };

    ws.getCell(`A${r + 3}`).value = 'TCS - Amount Paid/Debited';
    ws.getCell(`C${r + 3}`).value = { formula: `SUMIFS(N${first}:N${last},A${first}:A${last},"TCS")` };

    ws.getCell(`A${r + 4}`).value = 'TCS - Tax Collected';
    ws.getCell(`C${r + 4}`).value = { formula: `SUMIFS(O${first}:O${last},A${first}:A${last},"TCS")` };

    for (let rr = r + 1; rr <= r + 4; rr++) {
      const cell = ws.getCell(`C${rr}`);
      cell.numFmt = '#,##0.00';
      cell.alignment = { horizontal: 'left' };
    }

    // Table Header
    const rHdr = ws.getRow(hdrRow);
    rHdr.height = 45;
    COLUMNS_DEF.forEach(([name, width], idx) => {
      const c = rHdr.getCell(idx + 1);
      c.value = name;
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
      c.border = THIN_BORDER;
      c.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
      ws.getColumn(idx + 1).width = width;
    });

    // Rows Data
    let rr = hdrRow + 1;
    for (const x of rows) {
      const secKey = x.section.toUpperCase();
      const secDesc = SECTION_DESC[secKey] || SECTION_DESC[secKey.replace(/\(.*\)/, '')] || '';
      const remark = x.remarks === '-' ? '' : x.remarks;

      const vals: any[] = [
        x.part,
        x.d_sr,
        x.d_name,
        x.d_tan,
        x.t_sr,
        x.section,
        secDesc,
        x.txn_date,
        x.status,
        STATUS_DESC[x.status] || '',
        x.book_date,
        remark,
        REMARK_DESC[remark] || '',
        x.amt,
        x.tax,
        x.dep,
        x.d_tot_amt,
        x.d_tot_tax,
        x.d_tot_dep,
      ];

      const rData = ws.getRow(rr);
      vals.forEach((v, ci) => {
        const colNum = ci + 1;
        const c = rData.getCell(colNum);
        c.value = v;
        c.border = THIN_BORDER;

        if (colNum === 8 || colNum === 11) {
          c.alignment = { horizontal: 'center' };
        } else if (colNum >= 14) {
          c.numFmt = '#,##0.00;[Red]-#,##0.00';
        } else if ([2, 5, 9, 12].includes(colNum)) {
          c.alignment = { horizontal: 'center' };
        }

        if (x.amt < 0) {
          c.fill = REV_FILL;
        }
      });
      rr++;
    }

    // Grand total row
    const rTot = ws.getRow(rr);
    const cTotTitle = rTot.getCell(1);
    cTotTitle.value = 'TOTAL (all rows incl. reversals)';
    cTotTitle.font = { bold: true };

    for (const col of [14, 15, 16]) {
      const L = COL_LETTERS_MAP[col];
      const c = rTot.getCell(col);
      c.value = { formula: `SUBTOTAL(109,${L}${first}:${L}${last})` };
      c.font = { bold: true };
      c.numFmt = '#,##0.00;[Red]-#,##0.00';
      c.border = THIN_BORDER;
    }

    // Freeze panes and autoFilter
    ws.views = [{ state: 'frozen', xSplit: 3, ySplit: hdrRow }];
    ws.autoFilter = {
      from: { row: hdrRow, column: 1 },
      to: { row: last, column: COLUMNS_DEF.length },
    };
  }

  // Write Party-wise Sheets
  if (partywise) {
    const byParty: Record<string, TxnRow[]> = {};
    for (const x of rows) {
      const k = `${x.part}_${x.d_sr}`;
      if (!byParty[k]) byParty[k] = [];
      byParty[k].push(x);
    }

    const sheetNames: Record<string, string> = {};
    for (const d of deductors) {
      const k = `${d.part}_${d.sr}`;
      const safe = safeSheetName(`${d.part}-${String(d.sr).padStart(2, '0')} ${d.name}`, used);
      sheetNames[k] = safe;
    }

    // Summary Sheet
    const sumWs = wb.addWorksheet('Party Summary');
    sumWs.getCell('A1').value = 'PARTY SUMMARY';
    sumWs.getCell('A1').font = { bold: true, size: 14 };
    sumWs.getCell('A2').value = 'Assessee';
    sumWs.getCell('A2').font = { bold: true };
    sumWs.getCell('C2').value = `${header['Name of Assessee']} (${header.PAN})  FY ${header['Financial Year']}  AY ${header['Assessment Year']}`;
    sumWs.getCell('A3').value = 'Click a party name to jump to its sheet.';

    const sumCols: [string, number][] = [
      ['Type', 8],
      ['Sr.No', 7],
      ['Name of Deductor / Collector (click to open)', 50],
      ['TAN', 14],
      ['No. of Txns', 10],
      ['Amount Paid / Credited', 20],
      ['Tax Deducted / Collected', 20],
      ['TDS / TCS Deposited', 20],
      ['Amount as per PDF', 20],
      ['Tax as per PDF', 20],
      ['Check', 12],
    ];

    const sumHdr = 5;
    const rSumHdr = sumWs.getRow(sumHdr);
    rSumHdr.height = 32;
    sumCols.forEach(([n, w], idx) => {
      const c = rSumHdr.getCell(idx + 1);
      c.value = n;
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
      c.border = THIN_BORDER;
      c.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
      sumWs.getColumn(idx + 1).width = w;
    });

    let sRow = sumHdr + 1;
    for (const d of deductors) {
      const k = `${d.part}_${d.sr}`;
      const rs = byParty[k] || [];
      const sa = rs.reduce((acc, x) => acc + x.amt, 0);
      const st = rs.reduce((acc, x) => acc + x.tax, 0);
      const sd = rs.reduce((acc, x) => acc + x.dep, 0);
      const ok = Math.abs(sa - d.tot_amt) <= 1 && Math.abs(st - d.tot_tax) <= 1 && Math.abs(sd - d.tot_dep) <= 1;

      const rCurrent = sumWs.getRow(sRow);
      const vals: any[] = [
        d.part,
        d.sr,
        d.name,
        d.tan,
        rs.length,
        sa,
        st,
        sd,
        d.tot_amt,
        d.tot_tax,
        ok ? 'OK' : 'MISMATCH',
      ];

      vals.forEach((v, ci) => {
        const colNum = ci + 1;
        const c = rCurrent.getCell(colNum);
        c.value = v;
        c.border = THIN_BORDER;

        if ([6, 7, 8, 9, 10].includes(colNum)) {
          c.numFmt = '#,##0.00;[Red]-#,##0.00';
        }
        if ([1, 2, 5, 11].includes(colNum)) {
          c.alignment = { horizontal: 'center' };
        }
      });

      // Hyperlink to party sheet
      const linkCell = rCurrent.getCell(3);
      linkCell.value = { text: d.name, hyperlink: `#'${sheetNames[k]}'!A1` };
      linkCell.font = { color: { argb: 'FF0563C1' }, underline: true };

      if (!ok) {
        const chk = rCurrent.getCell(11);
        chk.font = { bold: true, color: { argb: 'FFC00000' } };
      }
      sRow++;
    }

    const lastSum = sRow - 1;
    const colLettersSum = { 5: 'E', 6: 'F', 7: 'G', 8: 'H', 9: 'I', 10: 'J' };

    for (const label of ['TDS', 'TCS']) {
      const rTotLabel = sumWs.getRow(sRow);
      const c1 = rTotLabel.getCell(1);
      c1.value = `TOTAL ${label}`;
      c1.font = { bold: true };

      for (const col of [5, 6, 7, 8, 9, 10]) {
        const L = colLettersSum[col as keyof typeof colLettersSum];
        const c = rTotLabel.getCell(col);
        c.value =
          lastSum >= sumHdr + 1
            ? { formula: `SUMIFS(${L}${sumHdr + 1}:${L}${lastSum},$A${sumHdr + 1}:$A${lastSum},"${label}")` }
            : 0;
        c.font = { bold: true };
        c.border = THIN_BORDER;
        if (col >= 6) {
          c.numFmt = '#,##0.00;[Red]-#,##0.00';
        }
      }
      sRow++;
    }

    sumWs.autoFilter = {
      from: { row: sumHdr, column: 1 },
      to: { row: Math.max(sumHdr, lastSum), column: sumCols.length },
    };
    sumWs.views = [{ state: 'frozen', xSplit: 3, ySplit: sumHdr }];

    // Deductor Individual Sheets
    for (const d of deductors) {
      const k = `${d.part}_${d.sr}`;
      const targetSheetName = sheetNames[k];
      const pWs = wb.addWorksheet(targetSheetName);

      pWs.getCell('A1').value = d.name;
      pWs.getCell('A1').font = { bold: true, size: 13 };

      pWs.getCell('F1').value = { text: '<< Back to Party Summary', hyperlink: "#'Party Summary'!A1" };
      pWs.getCell('F1').font = { color: { argb: 'FF0563C1' }, underline: true };

      const kind = d.part === 'TDS' ? 'TDS (Tax Deducted at Source)' : 'TCS (Tax Collected at Source)';
      const infoList: [string, any][] = [
        ['Type', kind],
        ['TAN', d.tan],
        ['Assessee', `${header['Name of Assessee']} (${header.PAN})  AY ${header['Assessment Year']}`],
        ['Total Amount (as per PDF)', d.tot_amt],
        ['Total Tax (as per PDF)', d.tot_tax],
        ['Total Deposited (as per PDF)', d.tot_dep],
      ];

      let pr = 2;
      for (const [keyLabel, val] of infoList) {
        pWs.getCell(`A${pr}`).value = keyLabel;
        pWs.getCell(`A${pr}`).font = { bold: true };
        const cVal = pWs.getCell(`C${pr}`);
        cVal.value = val;
        if (typeof val === 'number') {
          cVal.numFmt = '#,##0.00;[Red]-#,##0.00';
          cVal.alignment = { horizontal: 'left' };
        }
        pr++;
      }

      const pHdrRow = pr + 1;
      const rPartyHdr = pWs.getRow(pHdrRow);
      rPartyHdr.height = 45;
      COLUMNS_DEF.forEach(([name, width], idx) => {
        const c = rPartyHdr.getCell(idx + 1);
        c.value = name;
        c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
        c.border = THIN_BORDER;
        c.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
        pWs.getColumn(idx + 1).width = width;
      });

      const partyRows = byParty[k] || [];
      let prr = pHdrRow + 1;
      const pFirst = prr;

      for (const x of partyRows) {
        const secKey = x.section.toUpperCase();
        const secDesc = SECTION_DESC[secKey] || SECTION_DESC[secKey.replace(/\(.*\)/, '')] || '';
        const remark = x.remarks === '-' ? '' : x.remarks;

        const vals: any[] = [
          x.part,
          x.d_sr,
          x.d_name,
          x.d_tan,
          x.t_sr,
          x.section,
          secDesc,
          x.txn_date,
          x.status,
          STATUS_DESC[x.status] || '',
          x.book_date,
          remark,
          REMARK_DESC[remark] || '',
          x.amt,
          x.tax,
          x.dep,
          x.d_tot_amt,
          x.d_tot_tax,
          x.d_tot_dep,
        ];

        const rLine = pWs.getRow(prr);
        vals.forEach((v, ci) => {
          const colNum = ci + 1;
          const c = rLine.getCell(colNum);
          c.value = v;
          c.border = THIN_BORDER;

          if (colNum === 8 || colNum === 11) {
            c.alignment = { horizontal: 'center' };
          } else if (colNum >= 14) {
            c.numFmt = '#,##0.00;[Red]-#,##0.00';
          } else if ([2, 5, 9, 12].includes(colNum)) {
            c.alignment = { horizontal: 'center' };
          }

          if (x.amt < 0) {
            c.fill = REV_FILL;
          }
        });
        prr++;
      }

      const pLast = prr - 1;
      const rSubtot = pWs.getRow(prr);
      const cSubTitle = rSubtot.getCell(1);
      cSubTitle.value = 'TOTAL (incl. reversals)';
      cSubTitle.font = { bold: true };

      for (const col of [14, 15, 16]) {
        const L = COL_LETTERS_MAP[col];
        const c = rSubtot.getCell(col);
        c.value =
          partyRows.length > 0
            ? { formula: `SUBTOTAL(109,${L}${pFirst}:${L}${pLast})` }
            : 0;
        c.font = { bold: true };
        c.numFmt = '#,##0.00;[Red]-#,##0.00';
        c.border = THIN_BORDER;
      }

      pWs.views = [{ state: 'frozen', xSplit: 3, ySplit: pHdrRow }];
      pWs.autoFilter = {
        from: { row: pHdrRow, column: 1 },
        to: { row: partyRows.length > 0 ? pLast : pHdrRow, column: COLUMNS_DEF.length },
      };
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

// --------------------------------------------------------------------------
// React Component
// --------------------------------------------------------------------------
export const Form26ASToExcel: React.FC<Form26ASToExcelProps> = ({ onBack }) => {
  const band = useViewportBand();
  const [chosenFile, setChosenFile] = useState<File | null>(null);
  const [combinedOption, setCombinedOption] = useState<boolean>(true);
  const [partywiseOption, setPartywiseOption] = useState<boolean>(false);
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean } | null>(null);
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSelectFile = (file: File | null) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setStatusMessage({ text: 'Please choose a PDF file.', isError: true });
      return;
    }
    setChosenFile(file);
    setStatusMessage(null);
    setResult(null);
  };

  const handleClear = () => {
    setChosenFile(null);
    setStatusMessage(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleConvert = async () => {
    if (!chosenFile) return;

    if (!combinedOption && !partywiseOption) {
      setStatusMessage({ text: 'Tick at least one option (Combined sheet or Party-wise sheets).', isError: true });
      return;
    }

    setIsConverting(true);
    setStatusMessage({ text: 'Converting... large files can take a few seconds.' });
    setResult(null);

    try {
      const buffer = await chosenFile.arrayBuffer();
      const text = await extractTextFromPdf(buffer);

      const header = parseHeader(text);
      const { deductors, rows, otherPartData } = parseStatement(text);

      if (!rows.length) {
        throw new Error(
          "No TDS/TCS transactions were found. Is this a TRACES 'Annual Tax Statement' (Form 26AS) PDF with selectable text (not a scanned image)?"
        );
      }

      // Sync deductor names onto transaction rows
      const keyMap = new Map<string, Deductor>();
      for (const d of deductors) {
        keyMap.set(`${d.part}_${d.sr}`, d);
      }
      for (const r of rows) {
        const d = keyMap.get(`${r.part}_${r.d_sr}`);
        if (d) r.d_name = d.name;
      }

      // Verification
      const problems = verify(deductors, rows);

      // Generate Excel Blob
      const blob = await buildWorkbook(header, rows, deductors, combinedOption, partywiseOption);

      // Totals calculation
      const calcTotals = (t: 'TDS' | 'TCS') => {
        const pDeds = deductors.filter((d) => d.part === t);
        const pRows = rows.filter((r) => r.part === t);
        const amount = pRows.reduce((acc, r) => acc + r.amt, 0);
        const tax = pRows.reduce((acc, r) => acc + r.tax, 0);
        return {
          parties: pDeds.length,
          rows: pRows.length,
          amount: amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          tax: tax.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        };
      };

      const warnings: string[] = [];
      const flagged = Object.keys(otherPartData).filter((p) => otherPartData[p]);
      if (flagged.length > 0) {
        warnings.push(`Parts [${flagged.sort().join(', ')}] appear to contain data that this tool does not export - please check the PDF.`);
      }

      const totalSheets = (combinedOption ? 1 : 0) + (partywiseOption ? 1 + deductors.length : 0);

      const baseName = chosenFile.name.replace(/\.pdf$/i, '') || 'statement';
      const suffix = '_26AS' + (partywiseOption && !combinedOption ? '_partywise' : '');
      const downloadFilename = `${baseName}${suffix}.xlsx`;

      setResult({
        assessee: header['Name of Assessee'] || 'Assessee',
        pan: header.PAN || 'PAN',
        assessment_year: header['Assessment Year'] || '',
        total_rows: rows.length,
        totals: {
          TDS: calcTotals('TDS'),
          TCS: calcTotals('TCS'),
        },
        sheets: totalSheets,
        verified: problems.length === 0,
        problems: problems.map(
          (p) =>
            `[${p.deductor.part} #${p.deductor.sr}] ${p.deductor.name} (${p.deductor.tan}): ${p.rowsCount} rows, amount ₹${p.sa.toFixed(2)} vs PDF ₹${p.deductor.tot_amt.toFixed(2)}, tax ₹${p.st.toFixed(2)} vs PDF ₹${p.deductor.tot_tax.toFixed(2)}`
        ),
        warnings,
        blob,
        downloadFilename,
      });

      setStatusMessage(null);
      confetti({ particleCount: 50, spread: 70, origin: { y: 0.7 } });
    } catch (err: any) {
      console.error('26AS Conversion error:', err);
      setStatusMessage({ text: err.message || 'Conversion failed. Please check the PDF.', isError: true });
    } finally {
      setIsConverting(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = result.downloadFilename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (a.parentNode) document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 4000);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 font-sans">
      <div className="flex flex-col lg:flex-row items-start gap-7">
        <div className="flex-1 min-w-0 w-full max-w-3xl mx-auto lg:mx-0">
          {/* Navigation header */}
      <div className="mb-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-3 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to All Tools
        </button>
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            <span>Form 26AS &rarr; Excel</span>
          </h1>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-sky-100 text-sky-800 border border-sky-300">
            BETA · v1.0.0
          </span>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          Upload your Annual Tax Statement (TRACES PDF). The file stays on this computer.
        </p>
      </div>

      {/* Beta Advisory & TDS Safety Notice */}
      <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50/60 p-3 text-xs text-sky-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-start sm:items-center gap-2">
          <Info className="w-4 h-4 text-sky-700 shrink-0 mt-0.5 sm:mt-0" />
          <span>
            <strong>BETA v1.0.0 Notice:</strong> Extracts Parts I &amp; II (TDS) and Part VII (TCS) from official TRACES PDFs with 100% local processing. Verify extracted credits against Form 16 / 16A and AIS/TIS before filing your ITR.
          </span>
        </div>
        <span className="text-[11px] font-semibold text-sky-800 whitespace-nowrap shrink-0">
          RAM Sandbox
        </span>
      </div>

      {/* 1. File Upload Dropzone */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs mb-4">
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files?.[0]) handleSelectFile(e.dataTransfer.files[0]);
          }}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
          }}
          className={`border-2 border-dashed rounded-xl py-8 px-4 text-center cursor-pointer transition-all outline-none focus:ring-2 focus:ring-sky-500 ${
            isDragging
              ? 'border-sky-600 bg-sky-50/50'
              : 'border-slate-300 hover:border-sky-700 hover:bg-sky-50/20 bg-slate-50/40'
          }`}
        >
          <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-800 flex items-center justify-center mx-auto mb-3">
            <Upload className="w-6 h-6" />
          </div>
          <strong className="block text-base font-semibold text-slate-900">
            Click to choose the 26AS PDF
          </strong>
          <span className="text-xs text-slate-500 block mt-0.5">or drag and drop it here</span>
          {chosenFile && (
            <div className="mt-3 inline-flex items-center gap-2 bg-sky-50 text-sky-900 px-3 py-1.5 rounded-lg border border-sky-200 text-xs font-semibold font-mono">
              <FileText className="w-4 h-4 text-sky-700 shrink-0" />
              <span>
                {chosenFile.name} ({(chosenFile.size / 1024).toFixed(0)} KB)
              </span>
            </div>
          )}
        </div>
        <input
          id="file"
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={(e) => handleSelectFile(e.target.files?.[0] || null)}
          className="hidden"
        />
        {chosenFile && (
          <div className="flex justify-end mt-2">
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-slate-500 hover:text-rose-600 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" /> Clear file
            </button>
          </div>
        )}
      </div>

      {/* 2. Options Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs mb-4">
        <strong className="block text-sm font-bold text-slate-900 mb-2">
          What do you want in the Excel?
        </strong>

        <div className="space-y-1">
          <label className="flex gap-3 items-start py-2.5 cursor-pointer border-b border-slate-100 last:border-b-0">
            <input
              type="checkbox"
              id="combined"
              checked={combinedOption}
              onChange={(e) => setCombinedOption(e.target.checked)}
              className="w-4 h-4 mt-0.5 accent-sky-800 rounded"
            />
            <span className="text-sm font-semibold text-slate-900 leading-snug">
              Combined single sheet
              <small className="block text-slate-500 text-xs font-normal mt-0.5">
                All parties and all transactions together in one sheet (filterable).
              </small>
            </span>
          </label>

          <label className="flex gap-3 items-start py-2.5 cursor-pointer">
            <input
              type="checkbox"
              id="partywise"
              checked={partywiseOption}
              onChange={(e) => setPartywiseOption(e.target.checked)}
              className="w-4 h-4 mt-0.5 accent-sky-800 rounded"
            />
            <span className="text-sm font-semibold text-slate-900 leading-snug">
              Party-wise sheets
              <small className="block text-slate-500 text-xs font-normal mt-0.5">
                A separate sheet for every deductor / collector, plus a clickable Party Summary sheet. You can tick both options.
              </small>
            </span>
          </label>
        </div>

        <div className="mt-4 pt-2">
          <button
            id="go"
            type="button"
            onClick={handleConvert}
            disabled={!chosenFile || isConverting}
            className="w-full sm:w-auto px-6 py-3 bg-[#1F4E78] hover:bg-[#163a5a] text-white font-semibold text-sm rounded-xl transition-all shadow-xs disabled:opacity-45 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
          >
            {isConverting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Converting...</span>
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-4 h-4" />
                <span>Convert to Excel</span>
              </>
            )}
          </button>
        </div>

        {statusMessage && (
          <div
            id="status"
            className={`mt-3 text-xs font-medium ${
              statusMessage.isError ? 'text-rose-700 font-semibold' : 'text-slate-500'
            }`}
          >
            {statusMessage.text}
          </div>
        )}
      </div>

      {/* 468x60 Compact / 320x50 Mobile Mid Banner */}
      <ResponsiveAdBanner
        desktopSlot="tool_mid_banner_468"
        tabletSlot="tool_mid_banner_468"
        mobileSlot="tool_mid_mobile_320"
        className="my-5"
      />

      {/* 3. Conversion Results Card */}
      {result && (
        <div id="result" className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          {/* Assessee Title */}
          <div>
            <strong className="text-base text-slate-900">{result.assessee}</strong>
            &nbsp;
            <span className="text-xs text-slate-500 font-mono">
              {result.pan} &middot; AY {result.assessment_year}
            </span>
          </div>

          {/* Totals Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500 font-semibold">
                  <th className="text-left py-2 px-2"></th>
                  <th className="text-right py-2 px-2">Parties</th>
                  <th className="text-right py-2 px-2">Rows</th>
                  <th className="text-right py-2 px-2">Amount</th>
                  <th className="text-right py-2 px-2">Tax</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-xs">
                {(['TDS', 'TCS'] as const).map((t) => {
                  const s = result.totals[t];
                  return (
                    <tr key={t} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-2 font-sans font-bold text-slate-900">{t}</td>
                      <td className="text-right py-2.5 px-2 tabular-nums text-slate-700">{s.parties}</td>
                      <td className="text-right py-2.5 px-2 tabular-nums text-slate-700">{s.rows}</td>
                      <td className="text-right py-2.5 px-2 tabular-nums text-slate-900 font-semibold">₹{s.amount}</td>
                      <td className="text-right py-2.5 px-2 tabular-nums font-bold text-emerald-700">₹{s.tax}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Verification Status */}
          <div>
            {result.verified ? (
              <p className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-2.5 rounded-lg border border-emerald-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>✓ Verified: every party's rows add up to the totals printed in the PDF.</span>
              </p>
            ) : (
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs text-rose-900 space-y-1.5">
                <p className="font-bold text-rose-800 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>Verification found differences:</span>
                </p>
                <ul className="list-disc list-inside space-y-1 font-mono text-[11px] text-rose-800 pl-1">
                  {result.problems.map((p, idx) => (
                    <li key={idx}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Warnings (if other parts contain data) */}
          {result.warnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
              <strong className="block font-bold text-amber-900 mb-1">Notice:</strong>
              <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                {result.warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Sheet Count */}
          <p className="text-xs text-slate-500">
            Workbook contains {result.sheets} sheet{result.sheets === 1 ? '' : 's'}.
          </p>

          {/* Download Action */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center justify-center gap-2 bg-[#1B7F3B] hover:bg-[#15632e] text-white font-semibold text-sm px-6 py-3 rounded-xl transition-colors shadow-xs cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Download Excel
            </button>
          </div>
        </div>
      )}

      {/* Security note */}
      <div className="mt-8 text-center text-xs text-slate-400 font-medium">
        🔒 100% Client-Side Conversion • No PDF files or tax records are uploaded to any server
      </div>

      {/* Dedicated Comprehensive User Guide & TDS Reconciliation Article */}
      <Form26ASToExcelArticle />

      {/* Contextual Educational & Tax Partner Directory */}
      <ContextualAdWidget initialCategory="education" title="Educational Tax Guides & Accounting Utilities" className="mt-8" />

      {/* Bottom Smartlink & 300x250 Rectangles */}
      <div className="mt-6 space-y-5 no-print">
        <SmartlinkBanner slotId="tool_smartlink" />
        <AdRectanglePair leftSlot="tool_bottom_rect_1" rightSlot="tool_bottom_rect_2" />
      </div>
        </div>

        {(band === 'desktop' || band === 'wide') && (
          <aside
            className="w-[160px] shrink-0 sticky top-24 self-start space-y-4 no-print"
            aria-label="Form 26AS sidebar skyscrapers"
          >
            <AdSlot slotId="tool_rail_160x300" />
            <AdSlot slotId="tool_rail_160x300_2" />
          </aside>
        )}
      </div>
    </div>
  );
};
