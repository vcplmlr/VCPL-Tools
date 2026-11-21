import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

export interface GstInvoiceRecord {
  id: string;
  source: '2B' | 'Tally';
  gstin: string;
  partyName: string;
  invoiceNo: string;
  normInvNo: string;
  invoiceDate: string;
  taxableValue: number;
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
  totalTax: number;
  invoiceValue: number;
}

export type ReconcileStatus =
  | 'EXACT_MATCH'
  | 'VALUE_MISMATCH'
  | 'ONLY_IN_2B'
  | 'ONLY_IN_TALLY';

export interface ReconcileRow {
  id: string;
  status: ReconcileStatus;
  gstin: string;
  partyName: string;
  invoiceNo2B: string;
  invoiceNoTally: string;
  date2B: string;
  dateTally: string;
  taxable2B: number;
  taxableTally: number;
  igst2B: number;
  igstTally: number;
  cgst2B: number;
  cgstTally: number;
  sgst2B: number;
  sgstTally: number;
  totalTax2B: number;
  totalTaxTally: number;
  taxDiff: number; // 2B - Tally
  taxHeadMismatch?: boolean;
}

export interface Gstr2bReconcileResult {
  rows: ReconcileRow[];
  summary: {
    exactCount: number;
    mismatchCount: number;
    only2BCount: number;
    onlyTallyCount: number;
    totalTax2B: number;
    totalTaxTally: number;
    eligibleItc: number;
    excessClaimRisk: number;
    missedItc: number;
  };
}

export function normalizeInvoiceNo(raw: string): string {
  return String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/^0+/, '');
}

function parseNumber(val: unknown): number {
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  const cleaned = String(val ?? '')
    .replace(/,/g, '')
    .replace(/[^\d.-]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function formatGstDateCell(raw: unknown): string {
  if (raw === null || raw === undefined || raw === '') return '';
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 20000 && raw < 100000) {
    const utcMs = Math.round((raw - 25569) * 86400 * 1000);
    const dt = new Date(utcMs);
    const dd = String(dt.getUTCDate()).padStart(2, '0');
    const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = dt.getUTCFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    const dd = String(raw.getDate()).padStart(2, '0');
    const mm = String(raw.getMonth() + 1).padStart(2, '0');
    const yyyy = raw.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }
  return String(raw).trim();
}

function pickColumnValue(row: Record<string, unknown>, candidates: string[]): unknown {
  const keys = Object.keys(row);
  for (const cand of candidates) {
    const found = keys.find((k) => k.toLowerCase().trim() === cand.toLowerCase());
    if (found && row[found] !== undefined && row[found] !== '') return row[found];
  }
  for (const cand of candidates) {
    const found = keys.find((k) => k.toLowerCase().includes(cand.toLowerCase()));
    if (found && row[found] !== undefined && row[found] !== '') return row[found];
  }
  return '';
}

function aggregateMultiRateInvoices(records: GstInvoiceRecord[]): GstInvoiceRecord[] {
  const map = new Map<string, GstInvoiceRecord>();
  const passthrough: GstInvoiceRecord[] = [];

  for (const rec of records) {
    if (!rec.gstin || !rec.normInvNo) {
      passthrough.push(rec);
      continue;
    }
    const key = `${rec.gstin}__${rec.normInvNo}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...rec });
    } else {
      existing.taxableValue = Number((existing.taxableValue + rec.taxableValue).toFixed(2));
      existing.igst = Number((existing.igst + rec.igst).toFixed(2));
      existing.cgst = Number((existing.cgst + rec.cgst).toFixed(2));
      existing.sgst = Number((existing.sgst + rec.sgst).toFixed(2));
      existing.cess = Number((existing.cess + rec.cess).toFixed(2));
      existing.totalTax = Number(
        (existing.igst + existing.cgst + existing.sgst + existing.cess).toFixed(2)
      );
      existing.invoiceValue = Number(
        Math.max(existing.invoiceValue, rec.invoiceValue, existing.taxableValue + existing.totalTax).toFixed(2)
      );
      if (!existing.invoiceDate && rec.invoiceDate) existing.invoiceDate = rec.invoiceDate;
      if ((!existing.partyName || existing.partyName === existing.gstin) && rec.partyName) {
        existing.partyName = rec.partyName;
      }
    }
  }

  return [...map.values(), ...passthrough];
}

export async function parseGstWorkbookFile(
  file: File,
  source: '2B' | 'Tally'
): Promise<GstInvoiceRecord[]> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'json') {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const b2bList =
      parsed?.data?.docdata?.b2b || parsed?.docdata?.b2b || parsed?.b2b || [];
    const records: GstInvoiceRecord[] = [];

    if (Array.isArray(b2bList)) {
      b2bList.forEach((supplier: any, sIdx: number) => {
        const gstin = String(supplier.ctin || supplier.gstin || '').toUpperCase().trim();
        const partyName = String(supplier.trdnm || supplier.name || gstin || 'Supplier').trim();
        const invList = supplier.inv || [];
        invList.forEach((inv: any, iIdx: number) => {
          const invoiceNo = String(inv.inum || inv.invoiceNo || '').trim();
          const invoiceDate = String(inv.dt || inv.date || '').trim();
          const items = Array.isArray(inv.items) ? inv.items : null;

          let taxableValue = parseNumber(inv.txval ?? 0);
          let igst = parseNumber(inv.igst ?? 0);
          let cgst = parseNumber(inv.cgst ?? 0);
          let sgst = parseNumber(inv.sgst ?? 0);
          let cess = parseNumber(inv.cess ?? 0);

          if (items && items.length > 0 && taxableValue === 0 && igst === 0 && cgst === 0 && sgst === 0) {
            for (const it of items) {
              const det = it?.itm_det || it;
              taxableValue += parseNumber(det?.txval ?? 0);
              igst += parseNumber(det?.iamt ?? det?.igst ?? 0);
              cgst += parseNumber(det?.camt ?? det?.cgst ?? 0);
              sgst += parseNumber(det?.samt ?? det?.sgst ?? 0);
              cess += parseNumber(det?.csamt ?? det?.cess ?? 0);
            }
          }

          if (taxableValue === 0 && inv.val !== undefined) {
            taxableValue = parseNumber(inv.val);
          }

          const totalTax = Number((igst + cgst + sgst + cess).toFixed(2));
          records.push({
            id: `${source}-json-${sIdx}-${iIdx}`,
            source,
            gstin,
            partyName,
            invoiceNo,
            normInvNo: normalizeInvoiceNo(invoiceNo),
            invoiceDate,
            taxableValue: Number(taxableValue.toFixed(2)),
            igst: Number(igst.toFixed(2)),
            cgst: Number(cgst.toFixed(2)),
            sgst: Number(sgst.toFixed(2)),
            cess: Number(cess.toFixed(2)),
            totalTax,
            invoiceValue: parseNumber(inv.val ?? taxableValue + totalTax),
          });
        });
      });
    }
    return aggregateMultiRateInvoices(records);
  }

  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheetName =
    wb.SheetNames.find((n) => n.toLowerCase().includes('b2b')) || wb.SheetNames[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return [];

  const rawMatrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
  if (!rawMatrix || rawMatrix.length === 0) return [];

  // Detect header row within first 12 rows
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(12, rawMatrix.length); i++) {
    const rowStr = (rawMatrix[i] || []).map((c) => String(c).toLowerCase()).join(' ');
    if (
      (rowStr.includes('gstin') || rowStr.includes('party') || rowStr.includes('supplier')) &&
      (rowStr.includes('invoice') || rowStr.includes('vch') || rowStr.includes('tax'))
    ) {
      headerRowIdx = i;
      break;
    }
  }

  const headerRow = rawMatrix[headerRowIdx];
  if (!headerRow || headerRow.length === 0) return [];
  const headers = headerRow.map((h) => String(h).trim());
  const records: GstInvoiceRecord[] = [];

  for (let r = headerRowIdx + 1; r < rawMatrix.length; r++) {
    const cells = rawMatrix[r];
    if (!cells || cells.every((c) => String(c).trim() === '')) continue;

    const rowObj: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      if (h) rowObj[h] = cells[idx];
    });

    const gstin = String(
      pickColumnValue(rowObj, ['GSTIN of supplier', 'Supplier GSTIN', 'GSTIN/UIN', 'GSTIN'])
    )
      .toUpperCase()
      .trim();
    const partyName = String(
      pickColumnValue(rowObj, ['Trade/Legal name', 'Party Name', 'Particulars', 'Supplier Name', 'Name'])
    ).trim();
    const invoiceNo = String(
      pickColumnValue(rowObj, ['Invoice number', 'Invoice No', 'Supplier Invoice No', 'Vch No', 'Bill No'])
    ).trim();
    if (!gstin && !invoiceNo) continue;
    if (partyName.toLowerCase() === 'total' || partyName.toLowerCase().startsWith('grand total')) continue;

    const invoiceDate = formatGstDateCell(
      pickColumnValue(rowObj, ['Invoice Date', 'Date', 'Voucher Date'])
    );
    const taxableValue = parseNumber(
      pickColumnValue(rowObj, ['Taxable Value', 'Taxable Amount', 'Assessable Value'])
    );
    const igst = parseNumber(pickColumnValue(rowObj, ['Integrated Tax', 'IGST']));
    const cgst = parseNumber(pickColumnValue(rowObj, ['Central Tax', 'CGST']));
    const sgst = parseNumber(pickColumnValue(rowObj, ['State/UT Tax', 'SGST', 'UTGST']));
    const cess = parseNumber(pickColumnValue(rowObj, ['Cess']));
    const totalTax = Number((igst + cgst + sgst + cess).toFixed(2));
    const invoiceValue =
      parseNumber(pickColumnValue(rowObj, ['Invoice Value', 'Gross Total', 'Total'])) ||
      Number((taxableValue + totalTax).toFixed(2));

    records.push({
      id: `${source}-row-${r}`,
      source,
      gstin,
      partyName: partyName || gstin || 'Unknown Party',
      invoiceNo,
      normInvNo: normalizeInvoiceNo(invoiceNo),
      invoiceDate,
      taxableValue: Number(taxableValue.toFixed(2)),
      igst: Number(igst.toFixed(2)),
      cgst: Number(cgst.toFixed(2)),
      sgst: Number(sgst.toFixed(2)),
      cess: Number(cess.toFixed(2)),
      totalTax,
      invoiceValue: Number(invoiceValue.toFixed(2)),
    });
  }

  return aggregateMultiRateInvoices(records);
}

export function reconcileGstr2bVsTally(
  records2B: GstInvoiceRecord[],
  recordsTally: GstInvoiceRecord[],
  toleranceRupees = 2
): Gstr2bReconcileResult {
  const tallyUsed = new Set<string>();
  const rows: ReconcileRow[] = [];

  for (const r2 of records2B) {
    let match = recordsTally.find(
      (rt) =>
        !tallyUsed.has(rt.id) &&
        rt.gstin === r2.gstin &&
        rt.normInvNo === r2.normInvNo &&
        r2.normInvNo !== ''
    );

    if (!match && r2.gstin) {
      // Fallback: same GSTIN + closely matching totalTax AND close taxableValue so recurring bills don't collide
      match = recordsTally.find(
        (rt) =>
          !tallyUsed.has(rt.id) &&
          rt.gstin === r2.gstin &&
          Math.abs(rt.totalTax - r2.totalTax) <= toleranceRupees &&
          Math.abs(rt.taxableValue - r2.taxableValue) <=
            Math.max(toleranceRupees * 5, r2.taxableValue * 0.005)
      );
    }

    if (match) {
      tallyUsed.add(match.id);
      const diff = Number((r2.totalTax - match.totalTax).toFixed(2));
      const taxableDiff = Math.abs(r2.taxableValue - match.taxableValue);
      const headMismatch =
        Math.abs(r2.igst - match.igst) > toleranceRupees ||
        Math.abs(r2.cgst - match.cgst) > toleranceRupees ||
        Math.abs(r2.sgst - match.sgst) > toleranceRupees;
      const isExact =
        Math.abs(diff) <= toleranceRupees &&
        taxableDiff <= toleranceRupees &&
        !headMismatch;

      rows.push({
        id: `rec-${r2.id}-${match.id}`,
        status: isExact ? 'EXACT_MATCH' : 'VALUE_MISMATCH',
        gstin: r2.gstin || match.gstin,
        partyName: r2.partyName || match.partyName,
        invoiceNo2B: r2.invoiceNo,
        invoiceNoTally: match.invoiceNo,
        date2B: r2.invoiceDate,
        dateTally: match.invoiceDate,
        taxable2B: r2.taxableValue,
        taxableTally: match.taxableValue,
        igst2B: r2.igst,
        igstTally: match.igst,
        cgst2B: r2.cgst,
        cgstTally: match.cgst,
        sgst2B: r2.sgst,
        sgstTally: match.sgst,
        totalTax2B: r2.totalTax,
        totalTaxTally: match.totalTax,
        taxDiff: diff,
        taxHeadMismatch: headMismatch,
      });
    } else {
      rows.push({
        id: `rec-${r2.id}`,
        status: 'ONLY_IN_2B',
        gstin: r2.gstin,
        partyName: r2.partyName,
        invoiceNo2B: r2.invoiceNo,
        invoiceNoTally: '—',
        date2B: r2.invoiceDate,
        dateTally: '—',
        taxable2B: r2.taxableValue,
        taxableTally: 0,
        igst2B: r2.igst,
        igstTally: 0,
        cgst2B: r2.cgst,
        cgstTally: 0,
        sgst2B: r2.sgst,
        sgstTally: 0,
        totalTax2B: r2.totalTax,
        totalTaxTally: 0,
        taxDiff: r2.totalTax,
        taxHeadMismatch: false,
      });
    }
  }

  for (const rt of recordsTally) {
    if (tallyUsed.has(rt.id)) continue;
    rows.push({
      id: `rec-${rt.id}`,
      status: 'ONLY_IN_TALLY',
      gstin: rt.gstin,
      partyName: rt.partyName,
      invoiceNo2B: '—',
      invoiceNoTally: rt.invoiceNo,
      date2B: '—',
      dateTally: rt.invoiceDate,
      taxable2B: 0,
      taxableTally: rt.taxableValue,
      igst2B: 0,
      igstTally: rt.igst,
      cgst2B: 0,
      cgstTally: rt.cgst,
      sgst2B: 0,
      sgstTally: rt.sgst,
      totalTax2B: 0,
      totalTaxTally: rt.totalTax,
      taxDiff: -rt.totalTax,
      taxHeadMismatch: false,
    });
  }

  const exactCount = rows.filter((r) => r.status === 'EXACT_MATCH').length;
  const mismatchCount = rows.filter((r) => r.status === 'VALUE_MISMATCH').length;
  const only2BCount = rows.filter((r) => r.status === 'ONLY_IN_2B').length;
  const onlyTallyCount = rows.filter((r) => r.status === 'ONLY_IN_TALLY').length;

  const totalTax2B = rows.reduce((acc, r) => acc + r.totalTax2B, 0);
  const totalTaxTally = rows.reduce((acc, r) => acc + r.totalTaxTally, 0);
  const eligibleItc = rows
    .filter((r) => r.status === 'EXACT_MATCH')
    .reduce((acc, r) => acc + r.totalTax2B, 0);
  const excessClaimRisk = rows
    .filter((r) => r.status === 'ONLY_IN_TALLY' || (r.status === 'VALUE_MISMATCH' && r.taxDiff < 0))
    .reduce((acc, r) => acc + Math.abs(r.taxDiff), 0);
  const missedItc = rows
    .filter((r) => r.status === 'ONLY_IN_2B')
    .reduce((acc, r) => acc + r.totalTax2B, 0);

  return {
    rows,
    summary: {
      exactCount,
      mismatchCount,
      only2BCount,
      onlyTallyCount,
      totalTax2B,
      totalTaxTally,
      eligibleItc,
      excessClaimRisk,
      missedItc,
    },
  };
}

const INR_FMT = '₹#,##0.00';
const HDR_NAVY = 'FF2F3E4E';
const SUB_GOLD = 'FFFEF2C8';
const BORDER_GRAY = 'FFCBD5E1';

function styleHeaderRow(row: ExcelJS.Row, colCount: number) {
  row.height = 26;
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HDR_NAVY } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: BORDER_GRAY } },
      left: { style: 'thin', color: { argb: BORDER_GRAY } },
      bottom: { style: 'thin', color: { argb: BORDER_GRAY } },
      right: { style: 'thin', color: { argb: BORDER_GRAY } },
    };
  }
}

export async function exportReconciliationExcel(
  result: Gstr2bReconcileResult,
  periodLabel?: string,
  periodSlug?: string
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'VCPL Tools — GSTR-2B Audit';
  wb.created = new Date();
  wb.calcProperties.fullCalcOnLoad = true;

  const allSheetName = '2_Reconciled_All';
  const totalRowsCount = result.rows.length;
  const dataEndRow = Math.max(2, totalRowsCount + 1);

  // Sheet 1: Executive Summary (Formula-linked to 2_Reconciled_All)
  const summarySheet = wb.addWorksheet('1_Executive_Summary', {
    properties: { tabColor: { argb: 'FFF9C80E' } },
    views: [{ state: 'frozen', ySplit: 2 }],
  });
  summarySheet.columns = [
    { header: 'GSTR-2B vs Tally Reconciliation Audit Metric', key: 'metric', width: 44 },
    { header: 'Count / Amount (INR)', key: 'value', width: 24 },
    { header: 'Audit Guidance', key: 'note', width: 48 },
  ];
  summarySheet.insertRow(1, ['VCPL TOOLS — GSTR-2B vs TALLY PRIME ITC AUDIT SUMMARY', '', '']);
  summarySheet.mergeCells('A1:C1');
  const tRow = summarySheet.getRow(1);
  tRow.height = 28;
  tRow.getCell(1).font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFF9C80E' } };
  tRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HDR_NAVY } };
  tRow.getCell(1).alignment = { vertical: 'middle', indent: 1 };
  styleHeaderRow(summarySheet.getRow(2), 3);

  const summaryRows: Array<{ metric: string; value: unknown; fmt?: string; note: string }> = [
    ...(periodLabel
      ? [
          {
            metric: 'Active Period / Date Filter',
            value: periodLabel,
            note: 'Filtered invoice date scope applied to all sheets below',
          },
        ]
      : []),
    {
      metric: 'Exact Matched Invoices',
      value: { formula: `COUNTIF('${allSheetName}'!$A$2:$A$${dataEndRow},"EXACT_MATCH")`, result: result.summary.exactCount },
      fmt: '#,##0',
      note: '100% matched across GSTIN, Invoice No, Taxable Value & Tax Heads',
    },
    {
      metric: 'Value / Tax-Head Mismatch Invoices',
      value: { formula: `COUNTIF('${allSheetName}'!$A$2:$A$${dataEndRow},"VALUE_MISMATCH")`, result: result.summary.mismatchCount },
      fmt: '#,##0',
      note: 'Check IGST vs CGST+SGST swaps or taxable rounding diffs before GSTR-3B',
    },
    {
      metric: 'Only in GSTR-2B (Unbooked in Tally)',
      value: { formula: `COUNTIF('${allSheetName}'!$A$2:$A$${dataEndRow},"ONLY_IN_2B")`, result: result.summary.only2BCount },
      fmt: '#,##0',
      note: 'Missing purchase entries or deferred bills in Tally books',
    },
    {
      metric: 'Only in Tally (Missing in GSTR-2B)',
      value: { formula: `COUNTIF('${allSheetName}'!$A$2:$A$${dataEndRow},"ONLY_IN_TALLY")`, result: result.summary.onlyTallyCount },
      fmt: '#,##0',
      note: 'Supplier non-filing / wrong GSTIN or invoice number typo (Rule 36(4) risk)',
    },
    {
      metric: 'Total ITC as per GSTR-2B',
      value: { formula: `SUM('${allSheetName}'!$P$2:$P$${dataEndRow})`, result: Number(result.summary.totalTax2B.toFixed(2)) },
      fmt: INR_FMT,
      note: 'Total tax available in GSTR-2B',
    },
    {
      metric: 'Total ITC as per Tally Books',
      value: { formula: `SUM('${allSheetName}'!$Q$2:$Q$${dataEndRow})`, result: Number(result.summary.totalTaxTally.toFixed(2)) },
      fmt: INR_FMT,
      note: 'Total ITC claimed / recorded in Tally Purchase Register',
    },
    {
      metric: '100% Matched Eligible ITC',
      value: { formula: `SUMIF('${allSheetName}'!$A$2:$A$${dataEndRow},"EXACT_MATCH",'${allSheetName}'!$P$2:$P$${dataEndRow})`, result: Number(result.summary.eligibleItc.toFixed(2)) },
      fmt: INR_FMT,
      note: 'Safe ITC claimable in GSTR-3B',
    },
    {
      metric: 'Excess Claim Risk in Tally',
      value: Number(result.summary.excessClaimRisk.toFixed(2)),
      fmt: INR_FMT,
      note: 'Hold / reverse until reflected in GSTR-2B',
    },
    {
      metric: 'Missed ITC Only in 2B',
      value: { formula: `SUMIF('${allSheetName}'!$A$2:$A$${dataEndRow},"ONLY_IN_2B",'${allSheetName}'!$P$2:$P$${dataEndRow})`, result: Number(result.summary.missedItc.toFixed(2)) },
      fmt: INR_FMT,
      note: 'Verify vendor bills & book in Tally',
    },
  ];

  summaryRows.forEach((sr, i) => {
    const r = summarySheet.addRow([sr.metric, sr.value, sr.note]);
    if (sr.fmt) r.getCell(2).numFmt = sr.fmt;
    r.getCell(2).alignment = { horizontal: 'right' };
    r.getCell(1).font = { bold: true };
    if (i % 2 === 1) {
      r.eachCell((c) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });
    }
  });

  // Sheets 2 to 5
  const rowSheets: { name: string; tab: string; rows: ReconcileRow[] }[] = [
    { name: allSheetName, tab: 'FF2F3E4E', rows: result.rows },
    {
      name: '3_Mismatch_Action',
      tab: 'FFD97706',
      rows: result.rows.filter((r) => r.status === 'VALUE_MISMATCH'),
    },
    {
      name: '4_Only_In_2B_Missed_ITC',
      tab: 'FFF59E0B',
      rows: result.rows.filter((r) => r.status === 'ONLY_IN_2B'),
    },
    {
      name: '5_Only_In_Tally_Risk',
      tab: 'FFDC2626',
      rows: result.rows.filter((r) => r.status === 'ONLY_IN_TALLY'),
    },
  ];

  for (const cfg of rowSheets) {
    const ws = wb.addWorksheet(cfg.name, {
      properties: { tabColor: { argb: cfg.tab } },
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    ws.columns = [
      { header: 'Status', key: 'status', width: 17 },
      { header: 'GSTIN', key: 'gstin', width: 18 },
      { header: 'Supplier Name', key: 'partyName', width: 28 },
      { header: '2B Inv No', key: 'invoiceNo2B', width: 18 },
      { header: '2B Date', key: 'date2B', width: 13 },
      { header: 'Tally Inv No', key: 'invoiceNoTally', width: 18 },
      { header: 'Tally Date', key: 'dateTally', width: 13 },
      { header: 'Taxable (2B)', key: 'taxable2B', width: 15 },
      { header: 'Taxable (Tally)', key: 'taxableTally', width: 15 },
      { header: 'IGST (2B)', key: 'igst2B', width: 13 },
      { header: 'CGST (2B)', key: 'cgst2B', width: 13 },
      { header: 'SGST (2B)', key: 'sgst2B', width: 13 },
      { header: 'IGST (Tally)', key: 'igstTally', width: 13 },
      { header: 'CGST (Tally)', key: 'cgstTally', width: 13 },
      { header: 'SGST (Tally)', key: 'sgstTally', width: 13 },
      { header: 'Total Tax (2B)', key: 'totalTax2B', width: 15 },
      { header: 'Total Tax (Tally)', key: 'totalTaxTally', width: 15 },
      { header: 'Tax Diff (2B - Tally)', key: 'taxDiff', width: 18 },
      { header: 'Audit Remark', key: 'remark', width: 24 },
    ];
    styleHeaderRow(ws.getRow(1), 19);
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: Math.max(2, cfg.rows.length + 1), column: 19 },
    };

    cfg.rows.forEach((row) => {
      const rNum = ws.rowCount + 1;
      const remark = row.taxHeadMismatch
        ? 'IGST/CGST-SGST Head Swap'
        : row.status === 'EXACT_MATCH'
        ? 'Eligible ITC'
        : row.status === 'VALUE_MISMATCH'
        ? 'Amount Difference'
        : row.status === 'ONLY_IN_2B'
        ? 'Unbooked in Tally'
        : 'Missing in GSTR-2B';

      const added = ws.addRow([
        row.status,
        row.gstin,
        row.partyName,
        row.invoiceNo2B,
        row.date2B,
        row.invoiceNoTally,
        row.dateTally,
        row.taxable2B,
        row.taxableTally,
        row.igst2B,
        row.cgst2B,
        row.sgst2B,
        row.igstTally,
        row.cgstTally,
        row.sgstTally,
        row.totalTax2B,
        row.totalTaxTally,
        { formula: `ROUND(P${rNum}-Q${rNum},2)`, result: Number(row.taxDiff.toFixed(2)) },
        remark,
      ]);

      for (let c = 8; c <= 18; c++) {
        added.getCell(c).numFmt = INR_FMT;
        added.getCell(c).alignment = { horizontal: 'right' };
      }

      const statusCell = added.getCell(1);
      if (row.status === 'EXACT_MATCH') {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
        statusCell.font = { bold: true, color: { argb: 'FF065F46' } };
      } else if (row.status === 'VALUE_MISMATCH' || row.status === 'ONLY_IN_2B') {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } };
        statusCell.font = { bold: true, color: { argb: 'FF92400E' } };
      } else {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } };
        statusCell.font = { bold: true, color: { argb: 'FF991B1B' } };
      }
    });

    if (cfg.rows.length > 0) {
      const lastR = cfg.rows.length + 1;
      const tot = ws.addRow([
        'TOTAL',
        '',
        `${cfg.rows.length} invoice(s)`,
        '',
        '',
        '',
        '',
        { formula: `SUM(H2:H${lastR})`, result: cfg.rows.reduce((s, x) => s + x.taxable2B, 0) },
        { formula: `SUM(I2:I${lastR})`, result: cfg.rows.reduce((s, x) => s + x.taxableTally, 0) },
        { formula: `SUM(J2:J${lastR})`, result: cfg.rows.reduce((s, x) => s + x.igst2B, 0) },
        { formula: `SUM(K2:K${lastR})`, result: cfg.rows.reduce((s, x) => s + x.cgst2B, 0) },
        { formula: `SUM(L2:L${lastR})`, result: cfg.rows.reduce((s, x) => s + x.sgst2B, 0) },
        { formula: `SUM(M2:M${lastR})`, result: cfg.rows.reduce((s, x) => s + x.igstTally, 0) },
        { formula: `SUM(N2:N${lastR})`, result: cfg.rows.reduce((s, x) => s + x.cgstTally, 0) },
        { formula: `SUM(O2:O${lastR})`, result: cfg.rows.reduce((s, x) => s + x.sgstTally, 0) },
        { formula: `SUM(P2:P${lastR})`, result: cfg.rows.reduce((s, x) => s + x.totalTax2B, 0) },
        { formula: `SUM(Q2:Q${lastR})`, result: cfg.rows.reduce((s, x) => s + x.totalTaxTally, 0) },
        { formula: `SUM(R2:R${lastR})`, result: cfg.rows.reduce((s, x) => s + x.taxDiff, 0) },
        '',
      ]);
      for (let c = 1; c <= 19; c++) {
        const cell = tot.getCell(c);
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUB_GOLD } };
        if (c >= 8 && c <= 18) cell.numFmt = INR_FMT;
      }
    }
  }

  // Sheet 6: Supplier Summary (Formula-linked via COUNTIF / SUMIFS on 2_Reconciled_All)
  const supSheet = wb.addWorksheet('6_Supplier_Summary', {
    properties: { tabColor: { argb: 'FF12805C' } },
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  supSheet.columns = [
    { header: 'Supplier GSTIN', key: 'gstin', width: 19 },
    { header: 'Supplier Name', key: 'partyName', width: 32 },
    { header: 'Total Docs', key: 'docs', width: 12 },
    { header: 'Taxable (2B)', key: 'taxable2B', width: 16 },
    { header: 'Total Tax (2B)', key: 'totalTax2B', width: 16 },
    { header: 'Total Tax (Tally)', key: 'totalTaxTally', width: 16 },
    { header: 'Net Diff (2B - Tally)', key: 'diff', width: 18 },
  ];
  styleHeaderRow(supSheet.getRow(1), 7);

  const supMap = new Map<string, { gstin: string; partyName: string; docs: number; t2b: number; x2b: number; xtal: number }>();
  for (const r of result.rows) {
    const key = r.gstin || r.partyName;
    const cur = supMap.get(key) || { gstin: r.gstin, partyName: r.partyName, docs: 0, t2b: 0, x2b: 0, xtal: 0 };
    cur.docs += 1;
    cur.t2b += r.taxable2B;
    cur.x2b += r.totalTax2B;
    cur.xtal += r.totalTaxTally;
    supMap.set(key, cur);
  }
  const supList = [...supMap.values()].sort((a, b) => Math.abs(b.x2b - b.xtal) - Math.abs(a.x2b - a.xtal));

  supList.forEach((s) => {
    const r = supSheet.rowCount + 1;
    const critRange = `'${allSheetName}'!$B$2:$B$${dataEndRow},$A${r}`;
    const added = supSheet.addRow([
      s.gstin || s.partyName,
      s.partyName,
      s.gstin ? { formula: `COUNTIF(${critRange})`, result: s.docs } : s.docs,
      s.gstin ? { formula: `SUMIF(${critRange},'${allSheetName}'!$H$2:$H$${dataEndRow})`, result: s.t2b } : s.t2b,
      s.gstin ? { formula: `SUMIF(${critRange},'${allSheetName}'!$P$2:$P$${dataEndRow})`, result: s.x2b } : s.x2b,
      s.gstin ? { formula: `SUMIF(${critRange},'${allSheetName}'!$Q$2:$Q$${dataEndRow})`, result: s.xtal } : s.xtal,
      { formula: `ROUND(E${r}-F${r},2)`, result: Number((s.x2b - s.xtal).toFixed(2)) },
    ]);
    added.getCell(3).numFmt = '#,##0';
    for (let c = 4; c <= 7; c++) {
      added.getCell(c).numFmt = INR_FMT;
      added.getCell(c).alignment = { horizontal: 'right' };
    }
  });

  const outBuf = await wb.xlsx.writeBuffer();
  const blob = new Blob([outBuf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `VCPL-GSTR2B-Tally-Reconciliation${periodSlug ? `-${periodSlug}` : ''}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadGstr2bSampleTemplates(): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'VCPL Tools';
  wb.created = new Date();

  const { sample2B, sampleTally } = getSampleGstr2bAndTallyData();

  const buildSheet = (name: string, rows: GstInvoiceRecord[]) => {
    const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = [
      { header: 'GSTIN of supplier', key: 'gstin', width: 20, style: { numFmt: '@' } },
      { header: 'Trade/Legal name', key: 'partyName', width: 32 },
      { header: 'Invoice number', key: 'invoiceNo', width: 20, style: { numFmt: '@' } },
      { header: 'Invoice Date', key: 'invoiceDate', width: 15, style: { numFmt: '@' } },
      { header: 'Invoice Value', key: 'invoiceValue', width: 16, style: { numFmt: INR_FMT } },
      { header: 'Taxable Value', key: 'taxableValue', width: 16, style: { numFmt: INR_FMT } },
      { header: 'Integrated Tax', key: 'igst', width: 15, style: { numFmt: INR_FMT } },
      { header: 'Central Tax', key: 'cgst', width: 15, style: { numFmt: INR_FMT } },
      { header: 'State/UT Tax', key: 'sgst', width: 15, style: { numFmt: INR_FMT } },
      { header: 'Cess', key: 'cess', width: 12, style: { numFmt: INR_FMT } },
    ];
    styleHeaderRow(ws.getRow(1), 10);
    rows.forEach((r) => ws.addRow(r));
  };

  buildSheet('GSTR2B_B2B', sample2B);
  buildSheet('Tally_Purchase', sampleTally);

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'VCPL_GSTR2B_Tally_Clean_Template.xlsx';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function getSampleGstr2bAndTallyData(): {
  sample2B: GstInvoiceRecord[];
  sampleTally: GstInvoiceRecord[];
} {
  const sample2B: GstInvoiceRecord[] = [
    {
      id: 's2b-1',
      source: '2B',
      gstin: '27AAACB1234F1Z5',
      partyName: 'Bharat Industrial Supplies Pvt Ltd',
      invoiceNo: 'BIS/25-26/0142',
      normInvNo: 'BIS25260142',
      invoiceDate: '12-02-2026',
      taxableValue: 125000,
      igst: 0,
      cgst: 11250,
      sgst: 11250,
      cess: 0,
      totalTax: 22500,
      invoiceValue: 147500,
    },
    {
      id: 's2b-2',
      source: '2B',
      gstin: '29AABCM8891K1Z2',
      partyName: 'Malnad Tech & Cloud Services',
      invoiceNo: 'MTC-884',
      normInvNo: 'MTC884',
      invoiceDate: '15-02-2026',
      taxableValue: 80000,
      igst: 14400,
      cgst: 0,
      sgst: 0,
      cess: 0,
      totalTax: 14400,
      invoiceValue: 94400,
    },
    {
      id: 's2b-3',
      source: '2B',
      gstin: '07AAACD5502L1Z9',
      partyName: 'Delhi Precision Logistics LLP',
      invoiceNo: 'DPL/2026/91',
      normInvNo: 'DPL202691',
      invoiceDate: '19-02-2026',
      taxableValue: 54000,
      igst: 9720,
      cgst: 0,
      sgst: 0,
      cess: 0,
      totalTax: 9720,
      invoiceValue: 63720,
    },
    {
      id: 's2b-4',
      source: '2B',
      gstin: '33AAECS4109Q1Z1',
      partyName: 'Southern Packaging Works',
      invoiceNo: 'SPW-310',
      normInvNo: 'SPW310',
      invoiceDate: '22-02-2026',
      taxableValue: 32000,
      igst: 5760,
      cgst: 0,
      sgst: 0,
      cess: 0,
      totalTax: 5760,
      invoiceValue: 37760,
    },
  ];

  const sampleTally: GstInvoiceRecord[] = [
    {
      id: 'st-1',
      source: 'Tally',
      gstin: '27AAACB1234F1Z5',
      partyName: 'Bharat Industrial Supplies Pvt Ltd',
      invoiceNo: 'BIS/25-26/0142',
      normInvNo: 'BIS25260142',
      invoiceDate: '12-02-2026',
      taxableValue: 125000,
      igst: 0,
      cgst: 11250,
      sgst: 11250,
      cess: 0,
      totalTax: 22500,
      invoiceValue: 147500,
    },
    {
      id: 'st-2',
      source: 'Tally',
      gstin: '29AABCM8891K1Z2',
      partyName: 'Malnad Tech & Cloud Services',
      invoiceNo: 'MTC-884',
      normInvNo: 'MTC884',
      invoiceDate: '15-02-2026',
      taxableValue: 82000,
      igst: 14760,
      cgst: 0,
      sgst: 0,
      cess: 0,
      totalTax: 14760,
      invoiceValue: 96760,
    },
    {
      id: 'st-3',
      source: 'Tally',
      gstin: '24AAAFK9012E1Z8',
      partyName: 'Kutch Polymer Traders',
      invoiceNo: 'KPT/709',
      normInvNo: 'KPT709',
      invoiceDate: '25-02-2026',
      taxableValue: 45000,
      igst: 8100,
      cgst: 0,
      sgst: 0,
      cess: 0,
      totalTax: 8100,
      invoiceValue: 53100,
    },
  ];

  return { sample2B, sampleTally };
}
