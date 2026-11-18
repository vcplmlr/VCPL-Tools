import ExcelJS from 'exceljs';
import { InvoiceRecord, InvoiceSettings } from '../types/invoice';
import { INDIAN_STATES, parseInvoiceDate, round2 } from './invoiceParser';
import {
  aggregateInvoices,
  aggregateParties,
  invoiceNetTotal,
  invoiceTaxTotal,
  lineTaxTotal,
  validateInvoices,
} from './invoiceValidation';

const SHEET_ALL = 'All Pages Data';
const SHEET_VAL = 'Validation';

const UQC_MAP: Record<string, string> = {
  NOS: 'NOS-NUMBERS',
  NO: 'NOS-NUMBERS',
  NUM: 'NOS-NUMBERS',
  PCS: 'PCS-PIECES',
  PC: 'PCS-PIECES',
  PIECE: 'PCS-PIECES',
  KGS: 'KGS-KILOGRAMS',
  KG: 'KGS-KILOGRAMS',
  SET: 'SET-SETS',
  SETS: 'SET-SETS',
  BOX: 'BOX-BOXES',
  BOXES: 'BOX-BOXES',
  MTR: 'MTR-METRES',
  MTRS: 'MTR-METRES',
  LTR: 'LTR-LITRES',
  LTRS: 'LTR-LITRES',
  UNT: 'UNT-UNITS',
  UNIT: 'UNT-UNITS',
  UNITS: 'UNT-UNITS',
  PAC: 'PAC-PACKS',
  PACK: 'PAC-PACKS',
  BAG: 'BAG-BAGS',
  BAGS: 'BAG-BAGS',
  QTL: 'QTL-QUINTAL',
  TON: 'TON-TONNES',
  SQF: 'SQF-SQUARE FEET',
  SQM: 'SQM-SQUARE METERS',
  ROL: 'ROL-ROLLS',
  ROLL: 'ROL-ROLLS',
};

export function normalizeGstUqc(rawUom: string): string {
  const cleaned = String(rawUom || '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  if (!cleaned) return 'OTH-OTHERS';
  return UQC_MAP[cleaned] || `${cleaned.slice(0, 3)}-${cleaned}`;
}

const FORMATS: Record<string, string> = {
  n0: '#,##0',
  n2: '#,##0.00',
  inr: '₹#,##0.00',
  pc: '0.00%',
};

const colLetter = (n: number): string => {
  let s = '';
  let cur = n;
  while (cur > 0) {
    const m = (cur - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    cur = Math.floor((cur - 1) / 26);
  }
  return s;
};

type ColDef = [
  key: string,
  header: string,
  width: number,
  fmt?: 'n0' | 'n2' | 'inr' | 'pc'
];

export const ALL_DATA_COLUMNS: ColDef[] = [
  ['file', 'Source File', 24],
  ['no', 'Invoice No', 18],
  ['date', 'Invoice Date', 13],
  ['cust', 'Customer', 28],
  ['code', 'Customer Code', 13],
  ['cgst', 'Customer GSTIN', 19],
  ['sup', 'Supplier', 28],
  ['sgst', 'Supplier GSTIN', 19],
  ['pos', 'Place of Supply', 18],
  ['rc', 'Reverse Charge', 11],
  ['pay', 'Payment Terms', 20],
  ['irn', 'IRN', 34],
  ['del', 'Delivery No', 14],
  ['gi', 'GI Date', 12],
  ['ord', 'Order No', 14],
  ['pg', 'Pages', 7, 'n0'],
  ['item', 'Item', 8],
  ['mat', 'Material No', 18],
  ['desc', 'Description', 32],
  ['hsn', 'HSN/SAC', 12],
  ['qty', 'Qty', 9, 'n0'],
  ['uom', 'UoM', 8],
  ['price', 'Unit Price', 13, 'n2'],
  ['gross', 'Gross Value', 14, 'n2'],
  ['disc', 'Discount', 12, 'n2'],
  ['discPct', 'Discount %', 11, 'pc'],
  ['net', 'Taxable Value', 15, 'n2'],
  ['rate', 'Tax Rate', 10, 'pc'],
  ['IGST', 'IGST', 12, 'n2'],
  ['CGST', 'CGST', 12, 'n2'],
  ['SGST', 'SGST', 12, 'n2'],
  ['cessAmt', 'Cess', 12, 'n2'],
  ['tax', 'Total Tax', 13, 'n2'],
  ['effRate', 'Effective GST %', 14, 'pc'],
  ['tot', 'Line Total', 15, 'n2'],
  ['roundOff', 'Invoice Round Off', 13, 'n2'],
  ['amt', 'Printed Invoice Amount', 18, 'n2'],
  ['lineAudit', 'Line Audit', 16],
];

interface ExcelCellFormula {
  f: string;
  r: number | string;
}

type CellVal = string | number | ExcelCellFormula | null;

type RowType =
  | 'hdr'
  | 'hdr2'
  | 'data'
  | 'tot'
  | 'sec'
  | 'title'
  | 'sub'
  | 'kpil'
  | 'kpiv'
  | 'blank'
  | 'txt';

interface RowSpec {
  t: RowType;
  cells: CellVal[];
  z?: boolean;
  fm?: (string | undefined)[];
  merge?: [number, number][];
  kf?: string[];
  badgeCols?: Record<number, 'ok' | 'warn' | 'err'>;
}

interface SheetSpec {
  name: string;
  tab: string;
  widths: number[];
  fmts?: (string | undefined)[];
  views: Partial<ExcelJS.WorksheetView>[];
  rows: RowSpec[];
  filter?: { fromRow: number; toRow: number };
  landscape?: boolean;
}

interface MonthlyAggRow {
  sortKey: number;
  label: string;
  invoices: number;
  lines: number;
  qty: number;
  net: number;
  IGST: number;
  CGST: number;
  SGST: number;
  cessAmt: number;
}

function aggregateMonthsDetailed(invs: InvoiceRecord[]): MonthlyAggRow[] {
  const map = new Map<number, MonthlyAggRow>();
  for (const v of invs) {
    const dt = parseInvoiceDate(v.date);
    const sortKey = dt ? dt.getFullYear() * 100 + dt.getMonth() + 1 : 0;
    let m = map.get(sortKey);
    if (!m) {
      m = {
        sortKey,
        label: dt
          ? dt.toLocaleString('en-IN', { month: 'short', year: 'numeric' })
          : 'Undated',
        invoices: 0,
        lines: 0,
        qty: 0,
        net: 0,
        IGST: 0,
        CGST: 0,
        SGST: 0,
        cessAmt: 0,
      };
      map.set(sortKey, m);
    }
    m.invoices += 1;
    m.lines += v.items.length;
    for (const it of v.items) {
      m.qty += it.qty;
      m.net += it.net;
      m.IGST += it.IGST;
      m.CGST += it.CGST;
      m.SGST += it.SGST;
      m.cessAmt += it.cessAmt || 0;
    }
  }
  return [...map.values()].sort((a, b) => a.sortKey - b.sortKey);
}

export async function buildInvoiceWorkbookBuffer(
  invsInput: InvoiceRecord[],
  settings: InvoiceSettings
): Promise<{ buffer: ArrayBuffer; sheetNames: string[] }> {
  const invs = invsInput.map((v) => ({
    ...v,
    items: v.items.map((i) => ({ ...i, hsn: i.hsn || 'N/A' })),
  }));

  const A = aggregateInvoices(invs);
  const valRes = validateInvoices(invs, settings.tol);
  const parties = aggregateParties(invs);
  const monthlyRows = aggregateMonthsDetailed(invs);

  const colMap: Record<string, string> = {};
  ALL_DATA_COLUMNS.forEach((c, idx) => {
    colMap[c[0]] = colLetter(idx + 1);
  });

  const nl = A.tot.n;
  const rg = (k: string) => `'${SHEET_ALL}'!$${colMap[k]}$2:$${colMap[k]}$${nl + 1}`;
  const filesCount = new Set(invs.map((v) => v.file)).size;
  const T = A.tot;
  const tTax = round2(T.IGST + T.CGST + T.SGST + T.cessAmt);

  // ---- Sheet 1: All Pages Data (Pure Pivot-Ready Register + Dynamic SUBTOTAL Row) ----
  const S1: SheetSpec = {
    name: SHEET_ALL,
    tab: 'FF2F3E4E',
    widths: ALL_DATA_COLUMNS.map((c) => c[2]),
    fmts: ALL_DATA_COLUMNS.map((c) => (c[3] ? FORMATS[c[3]] : undefined)),
    views: [{ state: 'frozen', ySplit: 1 }],
    rows: [],
    filter: { fromRow: 1, toRow: nl + 1 },
    landscape: true,
  };

  S1.rows.push({ t: 'hdr', cells: ALL_DATA_COLUMNS.map((c) => c[1]) });

  let k = 0;
  for (const v of invs) {
    for (const item of v.items) {
      const r = S1.rows.length + 1;
      const t = lineTaxTotal(item);
      const discPct = item.gross > 0 ? item.disc / item.gross : 0;
      const effRate = item.net > 0 ? t / item.net : 0;
      const hasValidHsn = item.hsn !== 'N/A' && [4, 6, 8].includes(item.hsn.length);
      const badge: Record<number, 'ok' | 'warn'> = {
        [ALL_DATA_COLUMNS.length]: hasValidHsn ? 'ok' : 'warn',
      };
      k++;
      S1.rows.push({
        t: 'data',
        z: k % 2 === 0,
        badgeCols: badge,
        cells: ALL_DATA_COLUMNS.map(([key]) => {
          if (key === 'discPct') {
            return {
              f: `IF(${colMap.gross}${r}>0,${colMap.disc}${r}/${colMap.gross}${r},0)`,
              r: discPct,
            };
          }
          if (key === 'tax') {
            return {
              f: `${colMap.IGST}${r}+${colMap.CGST}${r}+${colMap.SGST}${r}+${colMap.cessAmt}${r}`,
              r: round2(t),
            };
          }
          if (key === 'effRate') {
            return {
              f: `IF(${colMap.net}${r}>0,${colMap.tax}${r}/${colMap.net}${r},0)`,
              r: effRate,
            };
          }
          if (key === 'tot') {
            return { f: `${colMap.net}${r}+${colMap.tax}${r}`, r: round2(item.net + t) };
          }
          if (key === 'lineAudit') {
            return {
              f: `IF(OR(${colMap.hsn}${r}="N/A",AND(LEN(${colMap.hsn}${r})<>4,LEN(${colMap.hsn}${r})<>6,LEN(${colMap.hsn}${r})<>8)),"CHECK HSN","OK")`,
              r: hasValidHsn ? 'OK' : 'CHECK HSN',
            };
          }
          if (key === 'pg') return (v.pages || []).length;
          if (key === 'file') return v.file;
          if (key in item) {
            return (item as unknown as Record<string, string | number>)[key] ?? '';
          }
          return (v as unknown as Record<string, string | number>)[key] ?? '';
        }),
      });
    }
  }

  // Dynamic SUBTOTAL footer row in All Pages Data (updates when user filters in Excel)
  if (nl > 0) {
    S1.rows.push({
      t: 'tot',
      cells: ALL_DATA_COLUMNS.map(([key]) => {
        const col = colMap[key];
        if (key === 'file') return 'SUBTOTAL (Filtered)';
        if (key === 'no') return { f: `SUBTOTAL(3,${col}2:${col}${nl + 1})`, r: nl };
        if (['qty', 'gross', 'disc', 'net', 'IGST', 'CGST', 'SGST', 'cessAmt', 'tax', 'tot'].includes(key)) {
          const valMap: Record<string, number> = {
            qty: T.qty,
            gross: round2(invs.reduce((s, v) => s + v.items.reduce((a, i) => a + i.gross, 0), 0)),
            disc: round2(invs.reduce((s, v) => s + v.items.reduce((a, i) => a + i.disc, 0), 0)),
            net: round2(T.net),
            IGST: round2(T.IGST),
            CGST: round2(T.CGST),
            SGST: round2(T.SGST),
            cessAmt: round2(T.cessAmt),
            tax: tTax,
            tot: round2(T.net + tTax),
          };
          return { f: `SUBTOTAL(9,${col}2:${col}${nl + 1})`, r: valMap[key] ?? 0 };
        }
        return '';
      }),
    });
  }

  // ---- Sheet 3 (built early so Validation bounds are known for Executive Summary KPI) ----
  const valDataStartRow = 7;
  const valDataEndRow = Math.max(valDataStartRow, valDataStartRow + valRes.issues.length - 1);

  const errCount = valRes.issues.filter((x) => x.sev === 'err').length;
  const warnCount = valRes.issues.filter((x) => x.sev === 'warn').length;
  const cleanInvoices = invs.filter((v) => (valRes.byInvoice.get(v.fid) || []).length === 0).length;

  const S3: SheetSpec = {
    name: SHEET_VAL,
    tab: 'FFC0362C',
    widths: [14, 22, 30, 26, 86],
    views: [{ state: 'frozen', ySplit: 6 }],
    rows: [],
    filter: { fromRow: 6, toRow: Math.max(7, 6 + Math.max(1, valRes.issues.length)) },
    landscape: true,
  };
  S3.rows.push({ t: 'title', cells: ['INVOICE AUDIT & COMPLIANCE LOG'], merge: [[1, 5]] });
  S3.rows.push({
    t: 'sub',
    cells: [
      `Automated validation across ${invs.length} invoice(s) · Reconciliation tolerance: ₹${settings.tol.toFixed(2)}`,
    ],
    merge: [[1, 5]],
  });
  S3.rows.push({
    t: 'kpil',
    cells: ['TOTAL INVOICES', 'CLEAN INVOICES', 'ERRORS', 'WARNINGS', 'OVERALL AUDIT STATUS'],
  });
  S3.rows.push({
    t: 'kpiv',
    cells: [
      invs.length,
      cleanInvoices,
      { f: `COUNTIF(A${valDataStartRow}:A${valDataEndRow},"Error")`, r: errCount },
      { f: `COUNTIF(A${valDataStartRow}:A${valDataEndRow},"Warning")`, r: warnCount },
      {
        f: `IF(COUNTIF(A${valDataStartRow}:A${valDataEndRow},"Error")>0,"ACTION REQUIRED",IF(COUNTIF(A${valDataStartRow}:A${valDataEndRow},"Warning")>0,"REVIEW WARNINGS","ALL CHECKS PASSED"))`,
        r: errCount > 0 ? 'ACTION REQUIRED' : warnCount > 0 ? 'REVIEW WARNINGS' : 'ALL CHECKS PASSED',
      },
    ],
    kf: ['n0', 'n0', 'n0', 'n0', '@'],
    badgeCols: {
      5: errCount > 0 ? 'err' : warnCount > 0 ? 'warn' : 'ok',
    },
  });
  S3.rows.push({ t: 'blank', cells: [] });
  S3.rows.push({ t: 'hdr', cells: ['Severity', 'Invoice No', 'Source File', 'Check', 'Detail'] });
  if (valRes.issues.length === 0) {
    S3.rows.push({
      t: 'data',
      badgeCols: { 1: 'ok' },
      cells: [
        'OK',
        '',
        '',
        'All checks passed',
        'No missing HSN/SAC codes, GSTIN errors, or total mismatches detected across uploaded invoices.',
      ],
    });
  } else {
    valRes.issues.forEach((x, idx) => {
      S3.rows.push({
        t: 'data',
        z: idx % 2 === 1,
        badgeCols: { 1: x.sev === 'err' ? 'err' : 'warn' },
        cells: [x.sev === 'err' ? 'Error' : 'Warning', x.invoiceNo, x.file, x.chk, x.msg],
      });
    });
  }

  // ---- Sheet 2: Executive Summary ----
  const N = 12;
  const S2: SheetSpec = {
    name: 'Executive Summary',
    tab: 'FFF9C80E',
    widths: [20, 28, 11, 9, 10, 17, 13, 13, 13, 12, 14, 17],
    views: [{ showGridLines: false }],
    rows: [],
    landscape: true,
  };
  const P = S2.rows;

  P.push({ t: 'title', cells: ['INVOICE AUDIT & GST EXECUTIVE SUMMARY'], merge: [[1, N]] });
  P.push({
    t: 'sub',
    cells: [
      `Generated ${new Date().toLocaleDateString('en-GB')} · ${filesCount} file(s) · ${
        A.inv.length
      } invoice(s) · ${nl} line item(s) · Tolerance ₹${settings.tol.toFixed(2)} — live Excel formulas linked to “${SHEET_ALL}”`,
    ],
    merge: [[1, N]],
  });
  P.push({ t: 'blank', cells: [] });
  P.push({ t: 'kpil', cells: [] });
  P.push({ t: 'kpiv', cells: [] });
  P.push({ t: 'blank', cells: [] });

  const hdr = (h: string[]) => P.push({ t: 'hdr', cells: h });
  const sec = (s: string) => P.push({ t: 'sec', cells: [s], merge: [[1, N]] });

  // 1. HSN Summary
  sec('1.  HSN / SAC SUMMARY  (quantity, taxable value, % share, and full tax split)');
  hdr([
    'HSN/SAC',
    'Description',
    'Tax Rate',
    'Lines',
    'Qty',
    'Taxable Value',
    'IGST',
    'CGST',
    'SGST',
    'Cess',
    'Total Tax',
    'Total Amount',
  ]);
  const h0 = P.length + 1;
  A.hsn.forEach((g) => {
    const r = P.length + 1;
    const cr = `${rg('hsn')},$A${r},${rg('rate')},$C${r}`;
    const totalTx = round2(g.IGST + g.CGST + g.SGST + g.cessAmt);
    P.push({
      t: 'data',
      z: (r - h0) % 2 === 1,
      fm: [undefined, undefined, 'pc', 'n0', 'n0', 'inr', 'n2', 'n2', 'n2', 'n2', 'n2', 'inr'],
      badgeCols: g.hsn === 'N/A' ? { 1: 'warn' } : undefined,
      cells: [
        g.hsn,
        g.desc,
        g.rate,
        { f: `COUNTIFS(${cr})`, r: g.n },
        { f: `SUMIFS(${rg('qty')},${cr})`, r: g.qty },
        { f: `SUMIFS(${rg('net')},${cr})`, r: round2(g.net) },
        { f: `SUMIFS(${rg('IGST')},${cr})`, r: round2(g.IGST) },
        { f: `SUMIFS(${rg('CGST')},${cr})`, r: round2(g.CGST) },
        { f: `SUMIFS(${rg('SGST')},${cr})`, r: round2(g.SGST) },
        { f: `SUMIFS(${rg('cessAmt')},${cr})`, r: round2(g.cessAmt) },
        { f: `SUM(G${r}:J${r})`, r: totalTx },
        { f: `F${r}+K${r}`, r: round2(g.net + totalTx) },
      ],
    });
  });
  const h1 = P.length;
  const HT = P.length + 1;
  const tf = [undefined, undefined, undefined, 'n0', 'n0', 'inr', 'n2', 'n2', 'n2', 'n2', 'n2', 'inr'];
  const totRowCells = (a: number, b: number): CellVal[] => [
    { f: `SUM(D${a}:D${b})`, r: T.n },
    { f: `SUM(E${a}:E${b})`, r: T.qty },
    { f: `SUM(F${a}:F${b})`, r: round2(T.net) },
    { f: `SUM(G${a}:G${b})`, r: round2(T.IGST) },
    { f: `SUM(H${a}:H${b})`, r: round2(T.CGST) },
    { f: `SUM(I${a}:I${b})`, r: round2(T.SGST) },
    { f: `SUM(J${a}:J${b})`, r: round2(T.cessAmt) },
    { f: `SUM(K${a}:K${b})`, r: tTax },
    { f: `SUM(L${a}:L${b})`, r: round2(T.net + tTax) },
  ];
  P.push({ t: 'tot', fm: tf, cells: ['TOTAL', '', '', ...totRowCells(h0, h1)] });
  P.push({ t: 'blank', cells: [] });

  // 2. Tax Rate Summary
  sec('2.  TAX RATE-WISE CALCULATION  (GST slabs with IGST / CGST / SGST / Cess)');
  hdr([
    'Tax Slab',
    'HSN Codes',
    'Tax Rate',
    'Lines',
    'Qty',
    'Taxable Value',
    'IGST',
    'CGST',
    'SGST',
    'Cess',
    'Total Tax',
    'Total Amount',
  ]);
  const r0 = P.length + 1;
  A.rate.forEach((g) => {
    const r = P.length + 1;
    const cr = `${rg('rate')},$C${r}`;
    const pc = +(g.rate * 100).toFixed(2);
    const totalTx = round2(g.IGST + g.CGST + g.SGST + g.cessAmt);
    P.push({
      t: 'data',
      z: (r - r0) % 2 === 1,
      fm: [undefined, 'n0', 'pc', 'n0', 'n0', 'inr', 'n2', 'n2', 'n2', 'n2', 'n2', 'inr'],
      cells: [
        `GST ${pc}%`,
        { f: `COUNTIF($C$${h0}:$C$${h1},C${r})`, r: g.hsnCodes.size },
        g.rate,
        { f: `COUNTIFS(${cr})`, r: g.n },
        { f: `SUMIFS(${rg('qty')},${cr})`, r: g.qty },
        { f: `SUMIFS(${rg('net')},${cr})`, r: round2(g.net) },
        { f: `SUMIFS(${rg('IGST')},${cr})`, r: round2(g.IGST) },
        { f: `SUMIFS(${rg('CGST')},${cr})`, r: round2(g.CGST) },
        { f: `SUMIFS(${rg('SGST')},${cr})`, r: round2(g.SGST) },
        { f: `SUMIFS(${rg('cessAmt')},${cr})`, r: round2(g.cessAmt) },
        { f: `SUM(G${r}:J${r})`, r: totalTx },
        { f: `F${r}+K${r}`, r: round2(g.net + totalTx) },
      ],
    });
  });
  const r1 = P.length;
  P.push({ t: 'tot', fm: tf, cells: ['TOTAL', '', '', ...totRowCells(r0, r1)] });
  P.push({ t: 'blank', cells: [] });

  // 3. Month-Wise GST Summary
  sec('3.  MONTH-WISE GST TURNOVER & TAX BREAKDOWN');
  hdr([
    'Period',
    'Invoices',
    'Eff. Tax %',
    'Lines',
    'Qty',
    'Taxable Value',
    'IGST',
    'CGST',
    'SGST',
    'Cess',
    'Total Tax',
    'Total Amount',
  ]);
  const m0 = P.length + 1;
  monthlyRows.forEach((m, idx) => {
    const r = P.length + 1;
    const totalTx = round2(m.IGST + m.CGST + m.SGST + m.cessAmt);
    const eff = m.net > 0 ? totalTx / m.net : 0;
    P.push({
      t: 'data',
      z: idx % 2 === 1,
      fm: [undefined, 'n0', 'pc', 'n0', 'n0', 'inr', 'n2', 'n2', 'n2', 'n2', 'n2', 'inr'],
      cells: [
        m.label,
        m.invoices,
        { f: `IF(F${r}>0,K${r}/F${r},0)`, r: eff },
        m.lines,
        m.qty,
        round2(m.net),
        round2(m.IGST),
        round2(m.CGST),
        round2(m.SGST),
        round2(m.cessAmt),
        { f: `SUM(G${r}:J${r})`, r: totalTx },
        { f: `F${r}+K${r}`, r: round2(m.net + totalTx) },
      ],
    });
  });
  const m1 = P.length;
  P.push({
    t: 'tot',
    fm: [undefined, 'n0', 'pc', 'n0', 'n0', 'inr', 'n2', 'n2', 'n2', 'n2', 'n2', 'inr'],
    cells: [
      'TOTAL',
      { f: `SUM(B${m0}:B${m1})`, r: A.inv.length },
      { f: `IF(F${m1 + 1}>0,K${m1 + 1}/F${m1 + 1},0)`, r: T.net > 0 ? tTax / T.net : 0 },
      ...totRowCells(m0, m1),
    ],
  });
  P.push({ t: 'blank', cells: [] });

  // 4. Invoice Summary
  sec('4.  INVOICE-WISE RECONCILIATION  (computed vs printed invoice total)');
  hdr([
    'Invoice No',
    'Date',
    'Customer',
    'Lines',
    'Qty',
    'Taxable Value',
    'Total Tax',
    'Round Off',
    'Computed Total',
    'Printed Total',
    'Difference',
    'Status',
  ]);
  const i0 = P.length + 1;
  A.inv.forEach((g) => {
    const r = P.length + 1;
    const cr = `${rg('no')},$A${r}`;
    const tt = round2(g.IGST + g.CGST + g.SGST + g.cessAmt);
    const cmp = round2(g.net + tt + g.roundOff);
    const df = round2(cmp - g.amt);
    const isOk = Math.abs(df) <= settings.tol;
    P.push({
      t: 'data',
      z: (r - i0) % 2 === 1,
      fm: [undefined, undefined, undefined, 'n0', 'n0', 'inr', 'n2', 'n2', 'inr', 'inr', 'n2'],
      badgeCols: { 12: isOk ? 'ok' : 'err' },
      cells: [
        g.no,
        g.date,
        g.cust,
        { f: `COUNTIFS(${cr})`, r: g.n },
        { f: `SUMIFS(${rg('qty')},${cr})`, r: g.qty },
        { f: `SUMIFS(${rg('net')},${cr})`, r: round2(g.net) },
        { f: `SUMIFS(${rg('tax')},${cr})`, r: tt },
        g.roundOff,
        { f: `F${r}+G${r}+H${r}`, r: cmp },
        g.amt,
        { f: `ROUND(I${r}-J${r},2)`, r: df },
        {
          f: `IF(ABS(K${r})<=${settings.tol},"OK","CHECK")`,
          r: isOk ? 'OK' : 'CHECK',
        },
      ],
    });
  });
  const i1 = P.length;
  const totalRoundOff = round2(A.inv.reduce((s, g) => s + g.roundOff, 0));
  const cm = round2(T.net + tTax + totalRoundOff);
  const pr = round2(A.inv.reduce((s, g) => s + g.amt, 0));
  const diffTot = round2(cm - pr);
  const totOk = Math.abs(diffTot) <= settings.tol;
  P.push({
    t: 'tot',
    fm: [undefined, undefined, undefined, 'n0', 'n0', 'inr', 'n2', 'n2', 'inr', 'inr', 'n2'],
    badgeCols: { 12: totOk ? 'ok' : 'err' },
    cells: [
      'TOTAL',
      '',
      '',
      { f: `SUM(D${i0}:D${i1})`, r: T.n },
      { f: `SUM(E${i0}:E${i1})`, r: T.qty },
      { f: `SUM(F${i0}:F${i1})`, r: round2(T.net) },
      { f: `SUM(G${i0}:G${i1})`, r: tTax },
      { f: `SUM(H${i0}:H${i1})`, r: totalRoundOff },
      { f: `SUM(I${i0}:I${i1})`, r: cm },
      { f: `SUM(J${i0}:J${i1})`, r: pr },
      { f: `ROUND(I${P.length + 1}-J${P.length + 1},2)`, r: diffTot },
      {
        f: `IF(ABS(K${P.length + 1})<=${settings.tol},"OK","CHECK")`,
        r: totOk ? 'OK' : 'CHECK',
      },
    ],
  });

  // 6 Executive KPI summary tiles across 12 columns (2 cols per tile)
  const tileMerges: [number, number][] = [
    [1, 2],
    [3, 4],
    [5, 6],
    [7, 8],
    [9, 10],
    [11, 12],
  ];
  P[3] = {
    t: 'kpil',
    merge: tileMerges,
    cells: [
      'INVOICES',
      '',
      'TOTAL QTY',
      '',
      'TAXABLE VALUE',
      '',
      'TOTAL TAX (GST)',
      '',
      'GRAND TOTAL (INR)',
      '',
      'AUDIT HEALTH',
      '',
    ],
  };
  P[4] = {
    t: 'kpiv',
    merge: tileMerges,
    cells: [
      { f: `COUNTA(A${i0}:A${i1})`, r: A.inv.length },
      '',
      { f: `E${HT}`, r: T.qty },
      '',
      { f: `F${HT}`, r: round2(T.net) },
      '',
      { f: `K${HT}`, r: tTax },
      '',
      { f: `L${HT}`, r: round2(T.net + tTax) },
      '',
      {
        f: `IF(COUNTIF('${SHEET_VAL}'!A${valDataStartRow}:A${valDataEndRow},"Error")>0,"ERRORS",IF(COUNTIF('${SHEET_VAL}'!A${valDataStartRow}:A${valDataEndRow},"Warning")>0,"WARNINGS","ALL CLEAR"))`,
        r: errCount > 0 ? 'ERRORS' : warnCount > 0 ? 'WARNINGS' : 'ALL CLEAR',
      },
      '',
    ],
    kf: ['n0', 'n0', 'inr', 'inr', 'inr', '@'],
    badgeCols: {
      11: errCount > 0 ? 'err' : warnCount > 0 ? 'warn' : 'ok',
    },
  };

  // ---- Sheet 4: HSN Summary (GSTR-1 Table 12 Ready) ----
  const S_HSN: SheetSpec = {
    name: 'HSN Summary (GSTR-1)',
    tab: 'FF0F766E',
    widths: [14, 34, 10, 12, 16, 10, 16, 14, 14, 14, 12, 12],
    views: [{ state: 'frozen', ySplit: 3 }],
    rows: [],
    filter: { fromRow: 3, toRow: Math.max(4, 3 + A.hsn.length) },
    landscape: true,
  };
  S_HSN.rows.push({
    t: 'title',
    cells: ['GSTR-1 TABLE 12 — HSN-WISE SUMMARY OF OUTWARD / INWARD SUPPLIES'],
    merge: [[1, 12]],
  });
  S_HSN.rows.push({
    t: 'sub',
    cells: [`Formula-linked to “${SHEET_ALL}” · Grouped by HSN/SAC & GST Rate`],
    merge: [[1, 12]],
  });
  S_HSN.rows.push({
    t: 'hdr',
    cells: [
      'HSN/SAC',
      'Description',
      'UQC',
      'Total Qty',
      'Total Value',
      'Rate (%)',
      'Taxable Value',
      'Integrated Tax',
      'Central Tax',
      'State/UT Tax',
      'Cess Amount',
      '% Share',
    ],
  });
  const hsnDataStart = 4;
  const hsnTotalRow = hsnDataStart + A.hsn.length;
  A.hsn.forEach((g, idx) => {
    const r = S_HSN.rows.length + 1;
    const cr = `${rg('hsn')},$A${r},${rg('rate')},$F${r}`;
    const totalTx = round2(g.IGST + g.CGST + g.SGST + g.cessAmt);
    const share = T.net > 0 ? g.net / T.net : 0;
    const firstMatchUom =
      invs.flatMap((v) => v.items).find((it) => it.hsn === g.hsn && it.rate === g.rate)?.uom ||
      'NOS';
    const mappedUqc = normalizeGstUqc(firstMatchUom);
    S_HSN.rows.push({
      t: 'data',
      z: idx % 2 === 1,
      fm: [undefined, undefined, undefined, 'n0', 'inr', 'pc', 'inr', 'n2', 'n2', 'n2', 'n2', 'pc'],
      badgeCols: g.hsn === 'N/A' ? { 1: 'warn' } : undefined,
      cells: [
        g.hsn,
        g.desc,
        mappedUqc,
        { f: `SUMIFS(${rg('qty')},${cr})`, r: g.qty },
        { f: `G${r}+H${r}+I${r}+J${r}+K${r}`, r: round2(g.net + totalTx) },
        g.rate,
        { f: `SUMIFS(${rg('net')},${cr})`, r: round2(g.net) },
        { f: `SUMIFS(${rg('IGST')},${cr})`, r: round2(g.IGST) },
        { f: `SUMIFS(${rg('CGST')},${cr})`, r: round2(g.CGST) },
        { f: `SUMIFS(${rg('SGST')},${cr})`, r: round2(g.SGST) },
        { f: `SUMIFS(${rg('cessAmt')},${cr})`, r: round2(g.cessAmt) },
        { f: `IF($G$${hsnTotalRow}>0,G${r}/$G$${hsnTotalRow},0)`, r: share },
      ],
    });
  });
  const hsnEnd = Math.max(hsnDataStart, hsnTotalRow - 1);
  S_HSN.rows.push({
    t: 'tot',
    fm: [undefined, undefined, undefined, 'n0', 'inr', undefined, 'inr', 'n2', 'n2', 'n2', 'n2', 'pc'],
    cells: [
      'TOTAL',
      `${A.hsn.length} distinct HSN/Rate group(s)`,
      '',
      { f: `SUM(D${hsnDataStart}:D${hsnEnd})`, r: T.qty },
      { f: `SUM(E${hsnDataStart}:E${hsnEnd})`, r: round2(T.net + tTax) },
      '',
      { f: `SUM(G${hsnDataStart}:G${hsnEnd})`, r: round2(T.net) },
      { f: `SUM(H${hsnDataStart}:H${hsnEnd})`, r: round2(T.IGST) },
      { f: `SUM(I${hsnDataStart}:I${hsnEnd})`, r: round2(T.CGST) },
      { f: `SUM(J${hsnDataStart}:J${hsnEnd})`, r: round2(T.SGST) },
      { f: `SUM(K${hsnDataStart}:K${hsnEnd})`, r: round2(T.cessAmt) },
      { f: `SUM(L${hsnDataStart}:L${hsnEnd})`, r: 1 },
    ],
  });

  // ---- Sheet 5: Parties ----
  const S4: SheetSpec = {
    name: 'Parties',
    tab: 'FF12805C',
    widths: [32, 19, 19, 10, 9, 10, 16, 11, 13, 13, 13, 12, 14, 17],
    views: [{ state: 'frozen', ySplit: 1 }],
    rows: [],
    filter: { fromRow: 1, toRow: Math.max(2, 1 + parties.length) },
    landscape: true,
  };
  S4.rows.push({
    t: 'hdr',
    cells: [
      'Customer',
      'GSTIN',
      'State',
      'Invoices',
      'Lines',
      'Qty',
      'Taxable Value',
      '% Share',
      'IGST',
      'CGST',
      'SGST',
      'Cess',
      'Total Tax',
      'Total Amount',
    ],
  });
  const pf = [
    undefined,
    undefined,
    undefined,
    'n0',
    'n0',
    'n0',
    'inr',
    'pc',
    'n2',
    'n2',
    'n2',
    'n2',
    'n2',
    'inr',
  ];
  const ptTotalRow = 2 + parties.length;
  parties.forEach((p, idx) => {
    const r = S4.rows.length + 1;
    const cr = p.gstin ? `${rg('cgst')},$B${r}` : `${rg('cust')},$A${r}`;
    const fx = (key: string, val: number): CellVal =>
      p.name === '(Unknown)' && !p.gstin
        ? round2(val)
        : { f: `SUMIFS(${rg(key)},${cr})`, r: round2(val) };
    const totalTx = round2(p.IGST + p.CGST + p.SGST + p.cessAmt);
    const share = T.net > 0 ? p.net / T.net : 0;
    S4.rows.push({
      t: 'data',
      z: idx % 2 === 1,
      fm: pf,
      cells: [
        p.name,
        p.gstin,
        p.state,
        p.invoiceIds.size,
        p.name === '(Unknown)' ? p.lines : { f: `COUNTIFS(${cr})`, r: p.lines },
        fx('qty', p.qty),
        fx('net', p.net),
        { f: `IF($G$${ptTotalRow}>0,G${r}/$G$${ptTotalRow},0)`, r: share },
        fx('IGST', p.IGST),
        fx('CGST', p.CGST),
        fx('SGST', p.SGST),
        fx('cessAmt', p.cessAmt),
        { f: `SUM(I${r}:L${r})`, r: totalTx },
        { f: `G${r}+M${r}`, r: round2(p.net + totalTx) },
      ],
    });
  });
  const e4 = Math.max(2, S4.rows.length);
  const ptTotals = parties.reduce(
    (acc, p) => ({
      inv: acc.inv + p.invoiceIds.size,
      n: acc.n + p.lines,
      q: acc.q + p.qty,
      net: acc.net + p.net,
      i: acc.i + p.IGST,
      c: acc.c + p.CGST,
      s: acc.s + p.SGST,
      cs: acc.cs + p.cessAmt,
    }),
    { inv: 0, n: 0, q: 0, net: 0, i: 0, c: 0, s: 0, cs: 0 }
  );
  S4.rows.push({
    t: 'tot',
    fm: pf,
    cells: [
      'TOTAL',
      '',
      '',
      { f: `SUM(D2:D${e4})`, r: ptTotals.inv },
      { f: `SUM(E2:E${e4})`, r: ptTotals.n },
      { f: `SUM(F2:F${e4})`, r: ptTotals.q },
      { f: `SUM(G2:G${e4})`, r: round2(ptTotals.net) },
      { f: `SUM(H2:H${e4})`, r: 1 },
      { f: `SUM(I2:I${e4})`, r: round2(ptTotals.i) },
      { f: `SUM(J2:J${e4})`, r: round2(ptTotals.c) },
      { f: `SUM(K2:K${e4})`, r: round2(ptTotals.s) },
      { f: `SUM(L2:L${e4})`, r: round2(ptTotals.cs) },
      { f: `SUM(M2:M${e4})`, r: round2(ptTotals.i + ptTotals.c + ptTotals.s + ptTotals.cs) },
      {
        f: `SUM(N2:N${e4})`,
        r: round2(ptTotals.net + ptTotals.i + ptTotals.c + ptTotals.s + ptTotals.cs),
      },
    ],
  });

  // ---- Sheet 6: GSTR-1 B2B (draft) ----
  const S5: SheetSpec = {
    name: 'GSTR-1 B2B (draft)',
    tab: 'FFF59E0B',
    widths: [19, 30, 18, 13, 16, 26, 11, 12, 14, 9, 16, 12],
    views: [{ state: 'frozen', ySplit: 2 }],
    rows: [],
    landscape: true,
  };
  S5.rows.push({
    t: 'sub',
    cells: [
      'DRAFT for reference only — grouped by Customer GSTIN, Invoice Number, and Tax Rate. Verify against the GST portal before filing.',
    ],
    merge: [[1, 12]],
  });
  S5.rows.push({
    t: 'hdr',
    cells: [
      'GSTIN/UIN of Recipient',
      'Receiver Name',
      'Invoice Number',
      'Invoice date',
      'Invoice Value',
      'Place Of Supply',
      'Reverse Charge',
      'Invoice Type',
      'E-Commerce GSTIN',
      'Rate',
      'Taxable Value',
      'Cess Amount',
    ],
  });

  let k5 = 0;
  let b2bTaxableTotal = 0;
  let b2bCessTotal = 0;
  for (const v of invs) {
    if (!v.cgst) continue;
    const byRate = new Map<number, { net: number; cess: number }>();
    for (const it of v.items) {
      const cur = byRate.get(it.rate) || { net: 0, cess: 0 };
      cur.net += it.net;
      cur.cess += it.cessAmt || 0;
      byRate.set(it.rate, cur);
    }
    const posCode = (String(v.pos).match(/\d{2}/) || [v.cgst.slice(0, 2)])[0];
    const dt = parseInvoiceDate(v.date);
    const ds = dt
      ? `${String(dt.getDate()).padStart(2, '0')}-${dt.toLocaleString('en-GB', {
          month: 'short',
        })}-${dt.getFullYear()}`
      : v.date;
    for (const [rate, agg] of [...byRate].sort((a, b) => a[0] - b[0])) {
      b2bTaxableTotal = round2(b2bTaxableTotal + agg.net);
      b2bCessTotal = round2(b2bCessTotal + agg.cess);
      S5.rows.push({
        t: 'data',
        z: k5++ % 2 === 1,
        fm: [
          undefined,
          undefined,
          undefined,
          undefined,
          'inr',
          undefined,
          undefined,
          undefined,
          undefined,
          'n2',
          'inr',
          'n2',
        ],
        cells: [
          v.cgst,
          v.cust,
          v.no,
          ds,
          round2(v.amt),
          INDIAN_STATES[posCode] ? `${posCode}-${INDIAN_STATES[posCode]}` : v.pos || posCode,
          /yes/i.test(v.rc) ? 'Y' : 'N',
          'Regular',
          '',
          +(rate * 100).toFixed(2),
          round2(agg.net),
          round2(agg.cess),
        ],
      });
    }
  }
  if (k5 > 0) {
    const b2bEnd = 2 + k5;
    S5.filter = { fromRow: 2, toRow: b2bEnd };
    S5.rows.push({
      t: 'tot',
      fm: [
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'inr',
        'n2',
      ],
      cells: [
        'TOTAL',
        `${k5} B2B rate line(s)`,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        { f: `SUM(K3:K${b2bEnd})`, r: b2bTaxableTotal },
        { f: `SUM(L3:L${b2bEnd})`, r: b2bCessTotal },
      ],
    });
  }

  // ---- Sheet 7: Raw PDF Pages (Dedicated Clean Sheet when enabled) ----
  const S_RAW: SheetSpec = {
    name: 'Raw PDF Pages',
    tab: 'FF64748B',
    widths: [24, 18, 8, 8, 36, 24, 24, 24, 24, 24],
    views: [{ state: 'frozen', ySplit: 1 }],
    rows: [],
    landscape: true,
  };
  if (settings.includePagesInExcel) {
    S_RAW.rows.push({
      t: 'hdr',
      cells: [
        'Source File',
        'Invoice No',
        'Page',
        'Line',
        'Segment 1',
        'Segment 2',
        'Segment 3',
        'Segment 4',
        'Segment 5',
        'Segment 6',
      ],
    });
    for (const v of invs) {
      for (const p of v.pages || []) {
        p.rows.forEach((segs, li) => {
          S_RAW.rows.push({
            t: 'txt',
            z: li % 2 === 1,
            cells: [v.file, v.no, p.n, li + 1, ...segs],
          });
        });
      }
    }
  }

  const sheets: SheetSpec[] = [S2, S1, S_HSN, S4, S3];
  if (k5 > 0) sheets.push(S5);
  if (settings.includePagesInExcel && S_RAW.rows.length > 1) sheets.push(S_RAW);

  // ---- Write via ExcelJS ----
  const wb = new ExcelJS.Workbook();
  wb.creator = 'VCPL Tools — InvoiceXL';
  wb.calcProperties.fullCalcOnLoad = true;

  const NAVY = 'FF1E293B';
  const SLATE_BLUE = 'FF334155';
  const LIGHT_GOLD = 'FFFEF3C7';
  const KPI_BG = 'FFF8FAFC';
  const ZEBRA = 'FFF8FAFC';
  const BORDER_GRAY = 'FFCBD5E1';
  const thinBorder: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: BORDER_GRAY } };
  const cellBorder: Partial<ExcelJS.Borders> = {
    top: thinBorder,
    left: thinBorder,
    bottom: thinBorder,
    right: thinBorder,
  };

  const BADGE_STYLES = {
    ok: { fill: 'FFECFDF5', text: 'FF065F46' },
    warn: { fill: 'FFFFFBEB', text: 'FF92400E' },
    err: { fill: 'FFFEF2F2', text: 'FF991B1B' },
  };

  for (const S of sheets) {
    const ws = wb.addWorksheet(S.name, {
      properties: { tabColor: { argb: S.tab } },
      views: S.views,
      pageSetup: {
        orientation: S.landscape ? 'landscape' : 'portrait',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        paperSize: 9, // A4
      },
    });
    ws.columns = S.widths.map((w) => ({ width: w }));
    const NCols = S.widths.length;

    for (const R of S.rows) {
      const rowValues = R.cells.map((c) => {
        if (c && typeof c === 'object' && 'f' in c) {
          return { formula: c.f, result: c.r };
        }
        return c === '' || c === null ? null : c;
      });
      const row = ws.addRow(rowValues);
      (R.merge || []).forEach((m) => ws.mergeCells(row.number, m[0], row.number, m[1]));

      const span = ['sec', 'title', 'sub', 'kpil', 'kpiv'].includes(R.t)
        ? NCols
        : R.cells.length;

      for (let c = 1; c <= span; c++) {
        const cell = row.getCell(c);
        const fBase = (o: Partial<ExcelJS.Font>): Partial<ExcelJS.Font> => ({
          name: 'Calibri',
          size: 10,
          ...o,
        });

        if (R.t === 'hdr' || R.t === 'hdr2') {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: R.t === 'hdr' ? NAVY : SLATE_BLUE },
          };
          cell.font = fBase({ bold: true, color: { argb: 'FFFFFFFF' } });
          cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
          cell.border = cellBorder;
        } else if (R.t === 'data' || R.t === 'tot') {
          const fmtKey = (R.fm && R.fm[c - 1]) || (S.fmts && S.fmts[c - 1]);
          if (fmtKey) cell.numFmt = FORMATS[fmtKey] || fmtKey;
          cell.border = cellBorder;
          cell.font = fBase({ bold: R.t === 'tot' });
          if (R.t === 'tot') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_GOLD } };
            cell.border = {
              ...cellBorder,
              top: { style: 'medium', color: { argb: NAVY } },
              bottom: { style: 'double', color: { argb: NAVY } },
            };
          } else if (R.z) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA } };
          }

          if (R.badgeCols && R.badgeCols[c]) {
            const bStyle = BADGE_STYLES[R.badgeCols[c]];
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bStyle.fill } };
            cell.font = fBase({ bold: true, color: { argb: bStyle.text } });
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          } else {
            const val = cell.value as { formula?: string; result?: unknown } | number | null;
            if (
              typeof val === 'number' ||
              (val && typeof val === 'object' && typeof val.result === 'number')
            ) {
              cell.alignment = { horizontal: 'right', vertical: 'middle' };
            } else {
              cell.alignment = { vertical: 'middle', wrapText: S.name === SHEET_VAL && c === 5 };
            }
          }
        } else if (R.t === 'sec') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SLATE_BLUE } };
          cell.font = fBase({ bold: true, size: 11, color: { argb: 'FFFFFFFF' } });
          cell.alignment = { vertical: 'middle', indent: 1 };
        } else if (R.t === 'title') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
          cell.font = fBase({ bold: true, size: 15, color: { argb: 'FFF9C80E' } });
          cell.alignment = { vertical: 'middle', indent: 1 };
        } else if (R.t === 'sub') {
          cell.font = fBase({ italic: true, size: 9, color: { argb: 'FF475569' } });
          cell.alignment = { vertical: 'middle' };
        } else if (R.t === 'kpil' || R.t === 'kpiv') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: KPI_BG } };
          cell.border = cellBorder;
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.font =
            R.t === 'kpil'
              ? fBase({ bold: true, size: 8, color: { argb: 'FF64748B' } })
              : fBase({ bold: true, size: 14, color: { argb: NAVY } });

          if (R.t === 'kpiv' && R.badgeCols && R.badgeCols[c]) {
            const bStyle = BADGE_STYLES[R.badgeCols[c]];
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bStyle.fill } };
            cell.font = fBase({ bold: true, size: 12, color: { argb: bStyle.text } });
          }
        } else if (R.t === 'txt') {
          cell.font = fBase({ size: 9 });
          if (R.z) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA } };
          }
        }
      }

      if (R.t === 'kpiv' && R.kf) {
        if (R.merge) {
          R.merge.forEach((m, j) => {
            const fmtKey = R.kf![j];
            if (fmtKey && fmtKey !== '@') {
              row.getCell(m[0]).numFmt = FORMATS[fmtKey] || fmtKey;
            }
          });
        } else {
          R.kf.forEach((fmtKey, j) => {
            if (fmtKey && fmtKey !== '@') {
              row.getCell(j + 1).numFmt = FORMATS[fmtKey] || fmtKey;
            }
          });
        }
      }

      const rowHeights: Partial<Record<RowSpec['t'], number>> = {
        hdr: 28,
        hdr2: 22,
        title: 34,
        sub: 20,
        sec: 24,
        kpiv: 30,
        kpil: 18,
      };
      const rowHeight = rowHeights[R.t];
      if (rowHeight !== undefined) row.height = rowHeight;
    }

    if (S.filter) {
      ws.autoFilter = {
        from: { row: S.filter.fromRow, column: 1 },
        to: { row: S.filter.toRow, column: NCols },
      };
    }
  }

  const outBuf = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
  return { buffer: outBuf, sheetNames: sheets.map((s) => s.name) };
}

export function buildFlatMatrix(invs: InvoiceRecord[]): (string | number)[][] {
  const flatCols = ALL_DATA_COLUMNS.filter(
    ([key]) => !['discPct', 'effRate', 'lineAudit'].includes(key)
  );
  const rows: (string | number)[][] = [flatCols.map((c) => c[1])];
  for (const v of invs) {
    for (const item of v.items) {
      const t = lineTaxTotal(item);
      rows.push(
        flatCols.map(([key]) => {
          if (key === 'tax') return round2(t);
          if (key === 'tot') return round2(item.net + t);
          if (key === 'pg') return (v.pages || []).length;
          if (key === 'file') return v.file;
          if (key in item) {
            return (item as unknown as Record<string, string | number>)[key] ?? '';
          }
          return (v as unknown as Record<string, string | number>)[key] ?? '';
        })
      );
    }
  }
  return rows;
}

export function serializeDelimited(
  rows: (string | number)[][],
  sep: ',' | '\t'
): string {
  return rows
    .map((r) =>
      r
        .map((val) => {
          const s = String(val ?? '');
          if (sep === ',' && /[",\n\r]/.test(s)) {
            return `"${s.replace(/"/g, '""')}"`;
          }
          return s.replace(/[\t\r\n]+/g, ' ');
        })
        .join(sep)
    )
    .join('\r\n');
}
