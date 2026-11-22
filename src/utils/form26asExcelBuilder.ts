import ExcelJS from 'exceljs';
import {
  FISCAL_MONTH_ORDER,
  Form26ASPartySummary,
  Form26ASTransaction,
  ParsedForm26AS,
  classify26ASTaxType,
  getFiscalMonthLabel,
  getFiscalQuarter,
  getSectionDescription,
  lookupSectionMeta,
  sliceParsedForm26ASByScope,
} from './form26asParser';

export interface Form26ASExcelOptions {
  includeCombinedSheet: boolean;
  includePartySheets: boolean;
  includeSectionQuarterSummary?: boolean;
  includeAuditSheet?: boolean;
  includeExecutiveSummary?: boolean;
  includeSeparateTdsTcsSheets?: boolean;
  taxScope?: 'all' | 'tds' | 'tcs';
  onProgress?: (pct: number, stage: string) => void;
}

const INR_FMT = '₹#,##0.00';
const PCT_FMT = '0.00%';

const STYLE_COLORS = {
  headerFill: 'FF1E3A5F',
  headerText: 'FFFFFFFF',
  subHeaderFill: 'FFE8F0FE',
  zebraFill: 'FFF8FAFC',
  totalFill: 'FFFEF2C8',
  accentBorder: 'FFCBD5E1',
  linkBlue: 'FF0369A1',
  okFill: 'FFDCFCE7',
  okText: 'FF166534',
  warnFill: 'FFFEF3C7',
  warnText: 'FF92400E',
  alertFill: 'FFFEE2E2',
  alertText: 'FF991B1B',
};

function sanitizeWorksheetName(rawName: string, usedNames: Set<string>): string {
  const base =
    rawName
      .replace(/[\\/?*[\]:]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 28) || 'Party';

  let candidate = base.slice(0, 31);
  let counter = 2;
  while (usedNames.has(candidate.toLowerCase())) {
    const suffix = ` (${counter})`;
    candidate = `${base.slice(0, 31 - suffix.length)}${suffix}`;
    counter += 1;
  }
  usedNames.add(candidate.toLowerCase());
  return candidate;
}

function applyThinBorders(row: ExcelJS.Row, colCount: number) {
  for (let c = 1; c <= colCount; c++) {
    row.getCell(c).border = {
      top: { style: 'thin', color: { argb: STYLE_COLORS.accentBorder } },
      bottom: { style: 'thin', color: { argb: STYLE_COLORS.accentBorder } },
      left: { style: 'thin', color: { argb: STYLE_COLORS.accentBorder } },
      right: { style: 'thin', color: { argb: STYLE_COLORS.accentBorder } },
    };
  }
}

function styleTableHeader(row: ExcelJS.Row, colCount: number) {
  row.height = 25;
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.font = {
      name: 'Calibri',
      size: 10,
      bold: true,
      color: { argb: STYLE_COLORS.headerText },
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: STYLE_COLORS.headerFill },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  }
  applyThinBorders(row, colCount);
}

function styleTotalRow(
  row: ExcelJS.Row,
  colCount: number,
  inrCols: number[],
  pctCols: number[] = []
) {
  row.height = 23;
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: STYLE_COLORS.totalFill },
    };
    if (inrCols.includes(c)) {
      cell.numFmt = INR_FMT;
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    } else if (pctCols.includes(c)) {
      cell.numFmt = PCT_FMT;
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    }
  }
  applyThinBorders(row, colCount);
}

function round2(n: number): number {
  return Number((n || 0).toFixed(2));
}

function calcRateDecimal(tax: number, paid: number): number {
  if (!paid || Math.abs(paid) < 0.005) return 0;
  return Number((tax / paid).toFixed(4));
}

function normalizeRateDecimal(pct: number | null): number | string {
  if (pct === null || !Number.isFinite(pct)) return '-';
  return Number((pct / 100).toFixed(4));
}

const isFinalBookingStatus = (status: string): boolean =>
  /^(?:F|M|Final|Matched)$/i.test((status || '').trim());

const classifyBookingStatusLabel = (status: string): string => {
  const s = (status || '').trim().toUpperCase();
  if (s === 'F' || s === 'FINAL' || s === 'M' || s === 'MATCHED') return 'Final (F)';
  if (s === 'U' || s === 'UNMATCHED') return 'Unmatched (U)';
  if (s === 'O' || s === 'OVERBOOKED') return 'Overbooked (O)';
  if (s === 'P' || s === 'PROVISIONAL') return 'Provisional (P)';
  return s || 'Other';
};

function buildTaxRoleSheets(
  wb: ExcelJS.Workbook,
  parsed: ParsedForm26AS,
  role: 'TDS' | 'TCS',
  summarySheetName: string,
  txSheetName: string,
  yearBannerTag: string,
  yearMetaTag: string
) {
  const roleParties: Form26ASPartySummary[] = parsed.parties.filter(
    (p) => classify26ASTaxType(p) === role
  );
  const roleTxs: Form26ASTransaction[] = parsed.transactions.filter(
    (tx) => classify26ASTaxType(tx) === role
  );
  if (roleParties.length === 0 && roleTxs.length === 0) return;

  const isTcs = role === 'TCS';
  const accentHeaderFill = isTcs ? 'FF0F4C5C' : 'FF1E3A5F';
  const roleEntityPlural = isTcs ? 'COLLECTORS' : 'DEDUCTORS';
  const roleEntitySingle = isTcs ? 'Collector' : 'Deductor';
  const basisLabel = isTcs ? 'Amount Received / Collected Basis' : 'Amount Paid / Credited';
  const taxLabel = isTcs ? 'TCS Collected' : 'TDS Deducted';
  const depLabel = isTcs ? 'TCS Deposited' : 'TDS Deposited';

  // 1. Role Transactions Sheet (21 Cols A..U)
  const txWs = wb.addWorksheet(txSheetName, {
    views: [{ state: 'frozen', ySplit: 6 }],
  });
  txWs.columns = [
    { key: 'sr', width: 7 }, // A
    { key: 'txRef', width: 10 }, // B
    { key: 'part', width: 17 }, // C
    { key: 'partyName', width: 34 }, // D
    { key: 'tan', width: 14 }, // E
    { key: 'partyPan', width: 14 }, // F
    { key: 'section', width: 11 }, // G
    { key: 'oldSec', width: 11 }, // H
    { key: 'secDesc', width: 32 }, // I
    { key: 'txDate', width: 14 }, // J
    { key: 'month', width: 10 }, // K
    { key: 'quarter', width: 14 }, // L
    { key: 'status', width: 13 }, // M
    { key: 'bookDate', width: 14 }, // N
    { key: 'remarks', width: 10 }, // O
    { key: 'nature', width: 11 }, // P
    { key: 'basisAmt', width: 19 }, // Q
    { key: 'taxAmt', width: 19 }, // R
    { key: 'depAmt', width: 19 }, // S
    { key: 'shortDiff', width: 16 }, // T
    { key: 'effRate', width: 12 }, // U
  ];

  txWs.mergeCells('A1:U1');
  const titleCell = txWs.getCell('A1');
  titleCell.value = `FORM 26AS ${role} (${roleEntityPlural}) TRANSACTION SCHEDULE — ${parsed.assesseeName} (${parsed.pan} · ${yearBannerTag})`;
  titleCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: STYLE_COLORS.headerText } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: accentHeaderFill } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  txWs.getRow(1).height = 28;

  txWs.mergeCells('A2:U2');
  const subCell = txWs.getCell('A2');
  subCell.value = `${yearMetaTag} | Role: ${role} (${roleEntityPlural}) | Parties: ${roleParties.length} | Txns: ${roleTxs.length}`;
  subCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E293B' } };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STYLE_COLORS.subHeaderFill } };
  subCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  txWs.getRow(2).height = 20;

  const rStart = 7;
  const rEnd = roleTxs.length > 0 ? rStart + roleTxs.length - 1 : rStart;
  const netBasis = round2(roleTxs.reduce((s, t) => s + t.amountPaid, 0));
  const netTax = round2(roleTxs.reduce((s, t) => s + t.taxDeducted, 0));
  const netDep = round2(roleTxs.reduce((s, t) => s + t.tdsDeposited, 0));
  const netShort = round2(netTax - netDep);
  const grossBasis = round2(
    roleTxs.filter((t) => t.entryNature !== 'Reversal').reduce((s, t) => s + t.amountPaid, 0)
  );
  const revBasis = round2(
    roleTxs.filter((t) => t.entryNature === 'Reversal').reduce((s, t) => s + t.amountPaid, 0)
  );
  const revCount = roleTxs.filter((t) => t.entryNature === 'Reversal').length;

  txWs.mergeCells('A4:U4');
  const noteCell = txWs.getCell('A4');
  noteCell.value = `AutoFilter Totals (Row 5 uses SUBTOTAL(9,...) — updates dynamically when filtering ${role} sections, months, quarters, or ${roleEntitySingle.toLowerCase()}s).`;
  noteCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF475569' } };
  txWs.getRow(4).height = 17;

  const subRow = txWs.getRow(5);
  subRow.values = [
    'TOTAL',
    roleTxs.length > 0 ? { formula: `SUBTOTAL(3,A${rStart}:A${rEnd})`, result: roleTxs.length } : 0,
    `${roleParties.length} ${roleEntitySingle}(s)`,
    `${role} Filtered Subtotals`,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    roleTxs.length > 0 ? { formula: `SUBTOTAL(9,Q${rStart}:Q${rEnd})`, result: netBasis } : 0,
    roleTxs.length > 0 ? { formula: `SUBTOTAL(9,R${rStart}:R${rEnd})`, result: netTax } : 0,
    roleTxs.length > 0 ? { formula: `SUBTOTAL(9,S${rStart}:S${rEnd})`, result: netDep } : 0,
    roleTxs.length > 0 ? { formula: `SUBTOTAL(9,T${rStart}:T${rEnd})`, result: netShort } : 0,
    { formula: 'IF(Q5=0,0,ROUND(R5/Q5,4))', result: calcRateDecimal(netTax, netBasis) },
  ];
  styleTotalRow(subRow, 21, [17, 18, 19, 20], [21]);
  subRow.getCell(2).numFmt = '#,##0';
  subRow.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' };

  const hdrRow = txWs.getRow(6);
  hdrRow.values = [
    'Sr No',
    '26AS Ref',
    'Part',
    `${roleEntitySingle} Name`,
    'TAN',
    `${roleEntitySingle} PAN`,
    'Section',
    '1961 Eq.',
    'Section Description',
    'Txn Date',
    'Month',
    'Quarter',
    'Booking Status',
    'Booking Date',
    'Remarks',
    'Nature',
    basisLabel,
    taxLabel,
    depLabel,
    'Short Deposit',
    'Eff Rate %',
  ];
  styleTableHeader(hdrRow, 21);
  for (let c = 1; c <= 21; c++) {
    hdrRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: accentHeaderFill } };
  }

  roleTxs.forEach((tx, idx) => {
    const rNum = rStart + idx;
    const r = txWs.getRow(rNum);
    const meta = lookupSectionMeta(tx.section);
    const shortDiff = round2(tx.taxDeducted - tx.tdsDeposited);
    const effRate = calcRateDecimal(tx.taxDeducted, tx.amountPaid);

    r.values = [
      idx + 1,
      tx.txSrNo || `${tx.srNo}`,
      tx.part,
      tx.partyName,
      tx.tan,
      tx.partyPan || '-',
      tx.section,
      meta.oldActEq,
      meta.description,
      tx.transactionDate,
      getFiscalMonthLabel(tx.transactionDate),
      tx.fiscalQuarter || getFiscalQuarter(tx.transactionDate),
      tx.bookingStatus,
      tx.bookingDate,
      tx.remarks,
      tx.entryNature || (tx.amountPaid < 0 ? 'Reversal' : 'Credit'),
      tx.amountPaid,
      tx.taxDeducted,
      tx.tdsDeposited,
      { formula: `ROUND(R${rNum}-S${rNum},2)`, result: shortDiff },
      { formula: `IF(Q${rNum}=0,0,ROUND(R${rNum}/Q${rNum},4))`, result: effRate },
    ];
    r.height = 20;
    r.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    r.getCell(2).numFmt = '@';
    r.getCell(5).numFmt = '@';
    r.getCell(6).numFmt = '@';
    r.getCell(7).numFmt = '@';
    r.getCell(8).numFmt = '@';
    for (let c = 17; c <= 20; c++) {
      r.getCell(c).numFmt = INR_FMT;
      r.getCell(c).alignment = { horizontal: 'right', vertical: 'middle' };
    }
    r.getCell(21).numFmt = PCT_FMT;
    r.getCell(21).alignment = { horizontal: 'right', vertical: 'middle' };
    if (tx.entryNature === 'Reversal' || tx.amountPaid < 0) {
      for (let c = 1; c <= 21; c++) {
        r.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF1F2' } };
      }
    } else if (idx % 2 === 1) {
      for (let c = 1; c <= 21; c++) {
        r.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STYLE_COLORS.zebraFill } };
      }
    }
    applyThinBorders(r, 21);
  });

  if (roleTxs.length > 0) {
    txWs.autoFilter = {
      from: { row: 6, column: 1 },
      to: { row: rEnd, column: 21 },
    };
  }

  // 2. Role Party Summary Sheet (17 Cols A..Q, live SUMIFS against txSheetName)
  const pWs = wb.addWorksheet(summarySheetName, {
    views: [{ state: 'frozen', ySplit: 4 }],
  });
  pWs.columns = [
    { key: 'sr', width: 7 }, // A
    { key: 'txns', width: 8 }, // B
    { key: 'part', width: 17 }, // C
    { key: 'name', width: 34 }, // D
    { key: 'tan', width: 14 }, // E
    { key: 'pan', width: 14 }, // F
    { key: 'rev', width: 9 }, // G
    { key: 'gross', width: 18 }, // H
    { key: 'revAmt', width: 17 }, // I
    { key: 'pdfPaid', width: 18 }, // J
    { key: 'netPaid', width: 18 }, // K
    { key: 'pdfTax', width: 18 }, // L
    { key: 'netTax', width: 18 }, // M
    { key: 'netDep', width: 18 }, // N
    { key: 'shortDiff', width: 16 }, // O
    { key: 'effRate', width: 12 }, // P
    { key: 'check', width: 16 }, // Q
  ];

  pWs.mergeCells('A1:Q1');
  const pTitle = pWs.getCell('A1');
  pTitle.value = `FORM 26AS ${role} — ${roleEntitySingle.toUpperCase()} WISE SUMMARY (${parsed.assesseeName} · ${parsed.pan} · ${yearBannerTag})`;
  pTitle.font = { name: 'Calibri', size: 13, bold: true, color: { argb: STYLE_COLORS.headerText } };
  pTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: accentHeaderFill } };
  pTitle.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  pWs.getRow(1).height = 28;

  pWs.mergeCells('A2:Q2');
  const pSub = pWs.getCell('A2');
  pSub.value = `Live SUMIFS / COUNTIFS formulas linked to '${txSheetName}'. Gross Basis: ₹${grossBasis.toLocaleString('en-IN')} | Reversals: ${revCount} (₹${revBasis.toLocaleString('en-IN')}) | Net ${taxLabel}: ₹${netTax.toLocaleString('en-IN')}.`;
  pSub.font = { name: 'Calibri', size: 10, color: { argb: 'FF334155' } };
  pSub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STYLE_COLORS.subHeaderFill } };
  pWs.getRow(2).height = 20;

  const pHdr = pWs.getRow(4);
  pHdr.values = [
    'Sr No',
    'Txns',
    'Part',
    `${roleEntitySingle} Name`,
    'TAN',
    `${roleEntitySingle} PAN`,
    'Reversals',
    'Gross Credit',
    'Reversal Amt',
    'PDF Subtotal (Basis)',
    `Live SUMIFS (${role} Basis)`,
    'PDF Subtotal (Tax)',
    `Live SUMIFS (${taxLabel})`,
    `Live SUMIFS (${depLabel})`,
    'Short Deposit',
    'Eff Rate %',
    'Check',
  ];
  styleTableHeader(pHdr, 17);
  for (let c = 1; c <= 17; c++) {
    pHdr.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: accentHeaderFill } };
  }

  const pStartRow = 5;
  const hasRoleTxs = roleTxs.length > 0;
  roleParties.forEach((party, idx) => {
    const rNum = pStartRow + idx;
    const r = pWs.getRow(rNum);
    const shortDiff = round2(party.extractedTaxDeducted - party.extractedTdsDeposited);
    r.values = [
      idx + 1,
      hasRoleTxs
        ? {
            formula: `COUNTIFS('${txSheetName}'!$E$${rStart}:$E$${rEnd},E${rNum},'${txSheetName}'!$C$${rStart}:$C$${rEnd},C${rNum})`,
            result: party.transactionCount,
          }
        : party.transactionCount,
      party.part,
      party.partyName,
      party.tan,
      party.partyPan || '-',
      hasRoleTxs
        ? {
            formula: `COUNTIFS('${txSheetName}'!$E$${rStart}:$E$${rEnd},E${rNum},'${txSheetName}'!$C$${rStart}:$C$${rEnd},C${rNum},'${txSheetName}'!$P$${rStart}:$P$${rEnd},"Reversal")`,
            result: party.reversalCount,
          }
        : party.reversalCount,
      hasRoleTxs
        ? {
            formula: `SUMIFS('${txSheetName}'!$Q$${rStart}:$Q$${rEnd},'${txSheetName}'!$E$${rStart}:$E$${rEnd},E${rNum},'${txSheetName}'!$C$${rStart}:$C$${rEnd},C${rNum},'${txSheetName}'!$P$${rStart}:$P$${rEnd},"Credit")`,
            result: party.grossAmountPaid,
          }
        : party.grossAmountPaid,
      hasRoleTxs
        ? {
            formula: `SUMIFS('${txSheetName}'!$Q$${rStart}:$Q$${rEnd},'${txSheetName}'!$E$${rStart}:$E$${rEnd},E${rNum},'${txSheetName}'!$C$${rStart}:$C$${rEnd},C${rNum},'${txSheetName}'!$P$${rStart}:$P$${rEnd},"Reversal")`,
            result: party.reversalAmountPaid,
          }
        : party.reversalAmountPaid,
      party.reportedAmountPaid,
      hasRoleTxs
        ? {
            formula: `SUMIFS('${txSheetName}'!$Q$${rStart}:$Q$${rEnd},'${txSheetName}'!$E$${rStart}:$E$${rEnd},E${rNum},'${txSheetName}'!$C$${rStart}:$C$${rEnd},C${rNum})`,
            result: party.extractedAmountPaid,
          }
        : party.extractedAmountPaid,
      party.reportedTaxDeducted,
      hasRoleTxs
        ? {
            formula: `SUMIFS('${txSheetName}'!$R$${rStart}:$R$${rEnd},'${txSheetName}'!$E$${rStart}:$E$${rEnd},E${rNum},'${txSheetName}'!$C$${rStart}:$C$${rEnd},C${rNum})`,
            result: party.extractedTaxDeducted,
          }
        : party.extractedTaxDeducted,
      hasRoleTxs
        ? {
            formula: `SUMIFS('${txSheetName}'!$S$${rStart}:$S$${rEnd},'${txSheetName}'!$E$${rStart}:$E$${rEnd},E${rNum},'${txSheetName}'!$C$${rStart}:$C$${rEnd},C${rNum})`,
            result: party.extractedTdsDeposited,
          }
        : party.extractedTdsDeposited,
      { formula: `ROUND(M${rNum}-N${rNum},2)`, result: shortDiff },
      { formula: `IF(K${rNum}=0,0,ROUND(M${rNum}/K${rNum},4))`, result: calcRateDecimal(party.extractedTaxDeducted, party.extractedAmountPaid) },
      party.verificationStatus,
    ];
    r.height = 20;
    r.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    r.getCell(2).numFmt = '#,##0';
    r.getCell(5).numFmt = '@';
    r.getCell(6).numFmt = '@';
    r.getCell(7).numFmt = '#,##0';
    for (let c = 8; c <= 15; c++) {
      r.getCell(c).numFmt = INR_FMT;
      r.getCell(c).alignment = { horizontal: 'right', vertical: 'middle' };
    }
    r.getCell(16).numFmt = PCT_FMT;
    r.getCell(16).alignment = { horizontal: 'right', vertical: 'middle' };
    r.getCell(17).alignment = { horizontal: 'center', vertical: 'middle' };
    applyThinBorders(r, 17);
  });

  if (roleParties.length > 0) {
    const pEndRow = pStartRow + roleParties.length - 1;
    const totRow = pWs.getRow(pEndRow + 1);
    totRow.values = [
      'TOTAL',
      { formula: `SUM(B${pStartRow}:B${pEndRow})`, result: roleTxs.length },
      '',
      `${roleParties.length} ${roleEntitySingle}(s)`,
      '',
      '',
      { formula: `SUM(G${pStartRow}:G${pEndRow})`, result: revCount },
      { formula: `SUM(H${pStartRow}:H${pEndRow})`, result: grossBasis },
      { formula: `SUM(I${pStartRow}:I${pEndRow})`, result: revBasis },
      { formula: `SUM(J${pStartRow}:J${pEndRow})`, result: round2(roleParties.reduce((s, p) => s + p.reportedAmountPaid, 0)) },
      { formula: `SUM(K${pStartRow}:K${pEndRow})`, result: netBasis },
      { formula: `SUM(L${pStartRow}:L${pEndRow})`, result: round2(roleParties.reduce((s, p) => s + p.reportedTaxDeducted, 0)) },
      { formula: `SUM(M${pStartRow}:M${pEndRow})`, result: netTax },
      { formula: `SUM(N${pStartRow}:N${pEndRow})`, result: netDep },
      { formula: `SUM(O${pStartRow}:O${pEndRow})`, result: netShort },
      { formula: `IF(K${pEndRow + 1}=0,0,ROUND(M${pEndRow + 1}/K${pEndRow + 1},4))`, result: calcRateDecimal(netTax, netBasis) },
      roleParties.every((p) => p.verificationStatus === 'Verified') ? 'All Verified' : 'Check Variance',
    ];
    styleTotalRow(totRow, 17, [8, 9, 10, 11, 12, 13, 14, 15], [16]);
    totRow.getCell(2).numFmt = '#,##0';
    totRow.getCell(7).numFmt = '#,##0';
  }
}

function buildExecutiveDashboardSheet(
  wb: ExcelJS.Workbook,
  parsed: ParsedForm26AS,
  yearBannerTag: string,
  yearMetaTag: string
) {
  const ws = wb.addWorksheet('Executive Summary', {
    views: [{ state: 'frozen', ySplit: 3 }],
  });
  ws.columns = [
    { key: 'c1', width: 30 }, // A
    { key: 'c2', width: 20 }, // B
    { key: 'c3', width: 20 }, // C
    { key: 'c4', width: 20 }, // D
    { key: 'c5', width: 20 }, // E
    { key: 'c6', width: 20 }, // F
    { key: 'c7', width: 20 }, // G
    { key: 'c8', width: 20 }, // H
    { key: 'c9', width: 20 }, // I
    { key: 'c10', width: 22 }, // J
  ];

  ws.mergeCells('A1:J1');
  const title = ws.getCell('A1');
  title.value = `FORM 26AS EXECUTIVE AUDIT DASHBOARD (TDS & TCS BIFURCATION) — ${parsed.assesseeName} (PAN: ${parsed.pan})`;
  title.font = { name: 'Calibri', size: 13, bold: true, color: { argb: STYLE_COLORS.headerText } };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STYLE_COLORS.headerFill } };
  title.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(1).height = 30;

  ws.mergeCells('A2:J2');
  const meta = ws.getCell('A2');
  meta.value = `${yearMetaTag} | PAN Status: ${parsed.panStatus} | Data Updated: ${parsed.dataUpdatedTill || '-'} | Parts: ${parsed.detectedParts.join(', ') || '-'}`;
  meta.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E293B' } };
  meta.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STYLE_COLORS.subHeaderFill } };
  meta.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(2).height = 20;

  const tdsTxs = parsed.transactions.filter((t) => classify26ASTaxType(t) === 'TDS');
  const tcsTxs = parsed.transactions.filter((t) => classify26ASTaxType(t) === 'TCS');
  const tdsParties = parsed.parties.filter((p) => classify26ASTaxType(p) === 'TDS');
  const tcsParties = parsed.parties.filter((p) => classify26ASTaxType(p) === 'TCS');

  const calcBucket = (txs: Form26ASTransaction[], parties: Form26ASPartySummary[]) => {
    const revTxs = txs.filter((t) => t.entryNature === 'Reversal' || t.amountPaid < 0 || t.taxDeducted < 0);
    const credTxs = txs.filter((t) => !revTxs.includes(t));
    const grossPaid = round2(credTxs.reduce((s, t) => s + t.amountPaid, 0));
    const revPaid = round2(revTxs.reduce((s, t) => s + t.amountPaid, 0));
    const netPaid = round2(txs.reduce((s, t) => s + t.amountPaid, 0));
    const grossTax = round2(credTxs.reduce((s, t) => s + t.taxDeducted, 0));
    const revTax = round2(revTxs.reduce((s, t) => s + t.taxDeducted, 0));
    const netTax = round2(txs.reduce((s, t) => s + t.taxDeducted, 0));
    const dep = round2(txs.reduce((s, t) => s + t.tdsDeposited, 0));
    const short = round2(netTax - dep);
    const effRate = calcRateDecimal(netTax, netPaid);
    return {
      parties: parties.length,
      txns: txs.length,
      revs: revTxs.length,
      grossPaid,
      revPaid,
      netPaid,
      grossTax,
      revTax,
      netTax,
      dep,
      short,
      effRate,
    };
  };

  const tdsM = calcBucket(tdsTxs, tdsParties);
  const tcsM = calcBucket(tcsTxs, tcsParties);
  const allM = calcBucket(parsed.transactions, parsed.parties);

  // Block 1: Side-by-Side TDS vs TCS Comparison Matrix
  ws.mergeCells('A4:J4');
  const b1 = ws.getCell('A4');
  b1.value = `1. TDS vs TCS EXECUTIVE BIFURCATION (${yearBannerTag})`;
  b1.font = { name: 'Calibri', size: 11, bold: true, color: { argb: STYLE_COLORS.headerText } };
  b1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STYLE_COLORS.headerFill } };
  b1.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(4).height = 24;

  const h1 = ws.getRow(5);
  h1.values = [
    'Metric / KPI',
    'TDS (Deductors)',
    'TCS (Collectors)',
    'Consolidated Total',
    'TDS Share %',
    'TCS Share %',
    'Official Header Summary',
    'Recon Variance',
    'Audit Status',
    'Statutory Notes',
  ];
  styleTableHeader(h1, 10);

  const offTds = parsed.officialSummary?.summaryTds ?? tdsM.netTax;
  const offTcs = parsed.officialSummary?.summaryTcs ?? tcsM.netTax;
  const offTotal = round2(offTds + offTcs);
  const varTds = round2(offTds - tdsM.netTax);
  const varTcs = round2(offTcs - tcsM.netTax);
  const varAll = round2(offTotal - allM.netTax);

  const compRows: Array<{
    label: string;
    tdsVal: number | { formula: string; result: number };
    tcsVal: number | { formula: string; result: number };
    allVal: number | { formula: string; result: number };
    fmt: 'int' | 'inr' | 'pct';
    offVal: number | string;
    varVal: number | string;
    status: string;
    note: string;
  }> = [
    {
      label: 'Party Accounts (TANs)',
      tdsVal: tdsM.parties,
      tcsVal: tcsM.parties,
      allVal: { formula: 'B6+C6', result: allM.parties },
      fmt: 'int',
      offVal: '-',
      varVal: '-',
      status: `${parsed.parties.filter((p) => p.verificationStatus === 'Verified').length}/${parsed.parties.length} Verified`,
      note: 'Unique TAN + Part combinations',
    },
    {
      label: 'Total Line Transactions',
      tdsVal: tdsM.txns,
      tcsVal: tcsM.txns,
      allVal: { formula: 'B7+C7', result: allM.txns },
      fmt: 'int',
      offVal: '-',
      varVal: '-',
      status: allM.revs > 0 ? `${allM.revs} Reversals` : 'No Reversals',
      note: 'Includes Credits & G/B Reversals',
    },
    {
      label: 'Gross Positive Credits / Basis',
      tdsVal: tdsM.grossPaid,
      tcsVal: tcsM.grossPaid,
      allVal: { formula: 'B8+C8', result: allM.grossPaid },
      fmt: 'inr',
      offVal: '-',
      varVal: '-',
      status: 'Positive',
      note: 'Excluding G/B negative reversals',
    },
    {
      label: 'Reversals / Negative Basis (G/B)',
      tdsVal: tdsM.revPaid,
      tcsVal: tcsM.revPaid,
      allVal: { formula: 'B9+C9', result: allM.revPaid },
      fmt: 'inr',
      offVal: '-',
      varVal: '-',
      status: allM.revs > 0 ? 'Adjusted' : 'Clean',
      note: 'TRACES Reprocessing / Rectification',
    },
    {
      label: 'Net Amount Paid / Received Basis',
      tdsVal: tdsM.netPaid,
      tcsVal: tcsM.netPaid,
      allVal: { formula: 'B10+C10', result: allM.netPaid },
      fmt: 'inr',
      offVal: '-',
      varVal: '-',
      status: 'Net Basis',
      note: 'Taxable / Principal base across year',
    },
    {
      label: 'Gross Tax (Before Reversals)',
      tdsVal: tdsM.grossTax,
      tcsVal: tcsM.grossTax,
      allVal: { formula: 'B11+C11', result: allM.grossTax },
      fmt: 'inr',
      offVal: '-',
      varVal: '-',
      status: 'Gross Tax',
      note: 'Total tax before G/B adjustments',
    },
    {
      label: 'Reversal Tax Adjustment',
      tdsVal: tdsM.revTax,
      tcsVal: tcsM.revTax,
      allVal: { formula: 'B12+C12', result: allM.revTax },
      fmt: 'inr',
      offVal: '-',
      varVal: '-',
      status: allM.revTax !== 0 ? 'Adjusted' : 'Zero',
      note: 'Tax reversed in reprocessing',
    },
    {
      label: 'Net Tax Deducted / Collected',
      tdsVal: tdsM.netTax,
      tcsVal: tcsM.netTax,
      allVal: { formula: 'B13+C13', result: allM.netTax },
      fmt: 'inr',
      offVal: offTotal,
      varVal: varAll,
      status: Math.abs(varAll) <= 1 ? 'Exact Match' : 'Check Diff',
      note: `TDS Var: ₹${varTds.toFixed(2)} | TCS Var: ₹${varTcs.toFixed(2)}`,
    },
    {
      label: 'Net Tax Deposited to Govt',
      tdsVal: tdsM.dep,
      tcsVal: tcsM.dep,
      allVal: { formula: 'B14+C14', result: allM.dep },
      fmt: 'inr',
      offVal: '-',
      varVal: allM.short,
      status: Math.abs(allM.short) <= 1 ? 'Fully Deposited' : 'Short Deposit',
      note: 'Eligible for ITR 26AS claim check',
    },
    {
      label: 'Short / Excess Deposit Diff',
      tdsVal: { formula: 'ROUND(B13-B14,2)', result: tdsM.short },
      tcsVal: { formula: 'ROUND(C13-C14,2)', result: tcsM.short },
      allVal: { formula: 'ROUND(D13-D14,2)', result: allM.short },
      fmt: 'inr',
      offVal: '-',
      varVal: '-',
      status: Math.abs(allM.short) <= 1 ? 'Balanced' : 'Follow Up Deductor',
      note: 'Tax Deducted minus Tax Deposited',
    },
    {
      label: 'Effective Blended Rate %',
      tdsVal: { formula: 'IF(B10=0,0,ROUND(B13/B10,4))', result: tdsM.effRate },
      tcsVal: { formula: 'IF(C10=0,0,ROUND(C13/C10,4))', result: tcsM.effRate },
      allVal: { formula: 'IF(D10=0,0,ROUND(D13/D10,4))', result: allM.effRate },
      fmt: 'pct',
      offVal: '-',
      varVal: '-',
      status: 'Analytical',
      note: 'Weighted average effective rate',
    },
  ];

  compRows.forEach((cr, idx) => {
    const rNum = 6 + idx;
    const r = ws.getRow(rNum);
    const tdsNumVal = typeof cr.tdsVal === 'number' ? cr.tdsVal : cr.tdsVal.result;
    const tcsNumVal = typeof cr.tcsVal === 'number' ? cr.tcsVal : cr.tcsVal.result;
    const allNumVal = typeof cr.allVal === 'number' ? cr.allVal : cr.allVal.result;

    const tdsShare = cr.fmt === 'pct' ? '-' : { formula: `IF(D${rNum}=0,0,ROUND(B${rNum}/D${rNum},4))`, result: allNumVal ? Number((tdsNumVal / allNumVal).toFixed(4)) : 0 };
    const tcsShare = cr.fmt === 'pct' ? '-' : { formula: `IF(D${rNum}=0,0,ROUND(C${rNum}/D${rNum},4))`, result: allNumVal ? Number((tcsNumVal / allNumVal).toFixed(4)) : 0 };

    r.values = [
      cr.label,
      cr.tdsVal,
      cr.tcsVal,
      cr.allVal,
      tdsShare,
      tcsShare,
      cr.offVal,
      cr.varVal,
      cr.status,
      cr.note,
    ];
    r.height = 20;
    r.getCell(1).font = { bold: true };
    const numFmt = cr.fmt === 'int' ? '#,##0' : cr.fmt === 'pct' ? PCT_FMT : INR_FMT;
    for (let c = 2; c <= 4; c++) {
      r.getCell(c).numFmt = numFmt;
      r.getCell(c).alignment = { horizontal: 'right', vertical: 'middle' };
    }
    if (cr.fmt !== 'pct') {
      r.getCell(5).numFmt = PCT_FMT;
      r.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
      r.getCell(6).numFmt = PCT_FMT;
      r.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
    } else {
      r.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
      r.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
    }
    if (typeof cr.offVal === 'number') {
      r.getCell(7).numFmt = INR_FMT;
      r.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
    } else {
      r.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };
    }
    if (typeof cr.varVal === 'number') {
      r.getCell(8).numFmt = INR_FMT;
      r.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
    } else {
      r.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };
    }
    r.getCell(9).alignment = { horizontal: 'center', vertical: 'middle' };
    if (rNum === 13 || rNum === 14) {
      for (let c = 1; c <= 10; c++) {
        r.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STYLE_COLORS.totalFill } };
        r.getCell(c).font = { bold: true };
      }
    } else if (idx % 2 === 1) {
      for (let c = 1; c <= 10; c++) {
        r.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STYLE_COLORS.zebraFill } };
      }
    }
    applyThinBorders(r, 10);
  });

  // Block 2: Booking Status Split (F / U / O / P) across TDS vs TCS
  const bkTitleRow = 19;
  ws.mergeCells(`A${bkTitleRow}:J${bkTitleRow}`);
  const b2 = ws.getCell(`A${bkTitleRow}`);
  b2.value = '2. TRACES BOOKING STATUS AUDIT (FINAL [F] vs UNMATCHED [U] vs OVERBOOKED [O] vs PROVISIONAL [P])';
  b2.font = { name: 'Calibri', size: 11, bold: true, color: { argb: STYLE_COLORS.headerText } };
  b2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STYLE_COLORS.headerFill } };
  b2.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(bkTitleRow).height = 24;

  const h2 = ws.getRow(bkTitleRow + 1);
  h2.values = [
    'Booking Status',
    'TDS Txns',
    'TDS Amount Paid',
    'TDS Deducted',
    'TCS Txns',
    'TCS Basis Amt',
    'TCS Collected',
    'Combined Tax',
    'Combined Deposited',
    'Audit Action',
  ];
  styleTableHeader(h2, 10);

  const bkOrder = ['Final (F)', 'Unmatched (U)', 'Overbooked (O)', 'Provisional (P)', 'Other'];
  const bkMap = new Map<string, { tdsTx: number; tdsPaid: number; tdsTax: number; tcsTx: number; tcsPaid: number; tcsTax: number; dep: number }>();
  bkOrder.forEach((k) => bkMap.set(k, { tdsTx: 0, tdsPaid: 0, tdsTax: 0, tcsTx: 0, tcsPaid: 0, tcsTax: 0, dep: 0 }));

  parsed.transactions.forEach((tx) => {
    const label = classifyBookingStatusLabel(tx.bookingStatus);
    const key = bkMap.has(label) ? label : 'Other';
    const b = bkMap.get(key)!;
    if (classify26ASTaxType(tx) === 'TCS') {
      b.tcsTx += 1;
      b.tcsPaid = round2(b.tcsPaid + tx.amountPaid);
      b.tcsTax = round2(b.tcsTax + tx.taxDeducted);
    } else {
      b.tdsTx += 1;
      b.tdsPaid = round2(b.tdsPaid + tx.amountPaid);
      b.tdsTax = round2(b.tdsTax + tx.taxDeducted);
    }
    b.dep = round2(b.dep + tx.tdsDeposited);
  });

  const activeBk = bkOrder.filter((k) => {
    const b = bkMap.get(k)!;
    return k === 'Final (F)' || b.tdsTx + b.tcsTx > 0;
  });

  let execCursor = bkTitleRow + 2;
  activeBk.forEach((label) => {
    const b = bkMap.get(label)!;
    const r = ws.getRow(execCursor);
    const isFinal = label === 'Final (F)';
    r.values = [
      label,
      b.tdsTx,
      b.tdsPaid,
      b.tdsTax,
      b.tcsTx,
      b.tcsPaid,
      b.tcsTax,
      { formula: `D${execCursor}+G${execCursor}`, result: round2(b.tdsTax + b.tcsTax) },
      b.dep,
      isFinal ? 'Matched / Claimable in ITR' : 'Unmatched / Check with Deductor',
    ];
    r.height = 20;
    r.getCell(1).font = { bold: true };
    r.getCell(2).numFmt = '#,##0';
    r.getCell(5).numFmt = '#,##0';
    for (const c of [3, 4, 6, 7, 8, 9]) {
      r.getCell(c).numFmt = INR_FMT;
      r.getCell(c).alignment = { horizontal: 'right', vertical: 'middle' };
    }
    if (!isFinal && b.tdsTx + b.tcsTx > 0) {
      r.getCell(10).font = { bold: true, color: { argb: STYLE_COLORS.alertText } };
      r.getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STYLE_COLORS.alertFill } };
    }
    applyThinBorders(r, 10);
    execCursor += 1;
  });

  // Block 3: Monthly Apr-Mar TDS vs TCS Bifurcation Matrix
  execCursor += 1;
  ws.mergeCells(`A${execCursor}:J${execCursor}`);
  const b3 = ws.getCell(`A${execCursor}`);
  b3.value = '3. MONTH-BY-MONTH (APRIL TO MARCH) TDS vs TCS CASHFLOW & TAX MATRIX';
  b3.font = { name: 'Calibri', size: 11, bold: true, color: { argb: STYLE_COLORS.headerText } };
  b3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STYLE_COLORS.headerFill } };
  b3.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(execCursor).height = 24;
  execCursor += 1;

  const h3 = ws.getRow(execCursor);
  h3.values = [
    'Fiscal Month',
    'TDS Txns',
    'TDS Amount Paid',
    'TDS Deducted',
    'TCS Txns',
    'TCS Basis Amt',
    'TCS Collected',
    'Combined Tax',
    'Combined Deposited',
    'Quarter Split',
  ];
  styleTableHeader(h3, 10);
  execCursor += 1;

  const monthMap = new Map<string, { tdsTx: number; tdsPaid: number; tdsTax: number; tcsTx: number; tcsPaid: number; tcsTax: number; dep: number }>();
  [...FISCAL_MONTH_ORDER, 'Unspecified'].forEach((m) =>
    monthMap.set(m, { tdsTx: 0, tdsPaid: 0, tdsTax: 0, tcsTx: 0, tcsPaid: 0, tcsTax: 0, dep: 0 })
  );
  parsed.transactions.forEach((tx) => {
    const m = getFiscalMonthLabel(tx.transactionDate);
    const b = monthMap.get(m) ?? monthMap.get('Unspecified')!;
    if (classify26ASTaxType(tx) === 'TCS') {
      b.tcsTx += 1;
      b.tcsPaid = round2(b.tcsPaid + tx.amountPaid);
      b.tcsTax = round2(b.tcsTax + tx.taxDeducted);
    } else {
      b.tdsTx += 1;
      b.tdsPaid = round2(b.tdsPaid + tx.amountPaid);
      b.tdsTax = round2(b.tdsTax + tx.taxDeducted);
    }
    b.dep = round2(b.dep + tx.tdsDeposited);
  });

  const mStart = execCursor;
  const activeMonths = [
    ...FISCAL_MONTH_ORDER,
    ...((monthMap.get('Unspecified')?.tdsTx ?? 0) + (monthMap.get('Unspecified')?.tcsTx ?? 0) > 0 ? ['Unspecified'] : []),
  ];
  const monthQuarterTag = (m: string) => {
    if (['Apr', 'May', 'Jun'].includes(m)) return 'Q1 (Apr-Jun)';
    if (['Jul', 'Aug', 'Sep'].includes(m)) return 'Q2 (Jul-Sep)';
    if (['Oct', 'Nov', 'Dec'].includes(m)) return 'Q3 (Oct-Dec)';
    if (['Jan', 'Feb', 'Mar'].includes(m)) return 'Q4 (Jan-Mar)';
    return 'Unspecified';
  };

  activeMonths.forEach((m) => {
    const b = monthMap.get(m)!;
    const r = ws.getRow(execCursor);
    r.values = [
      m,
      b.tdsTx,
      b.tdsPaid,
      b.tdsTax,
      b.tcsTx,
      b.tcsPaid,
      b.tcsTax,
      { formula: `D${execCursor}+G${execCursor}`, result: round2(b.tdsTax + b.tcsTax) },
      b.dep,
      monthQuarterTag(m),
    ];
    r.height = 19;
    r.getCell(1).font = { bold: true };
    r.getCell(2).numFmt = '#,##0';
    r.getCell(5).numFmt = '#,##0';
    for (const c of [3, 4, 6, 7, 8, 9]) {
      r.getCell(c).numFmt = INR_FMT;
      r.getCell(c).alignment = { horizontal: 'right', vertical: 'middle' };
    }
    r.getCell(10).alignment = { horizontal: 'center', vertical: 'middle' };
    applyThinBorders(r, 10);
    execCursor += 1;
  });
  const mEnd = execCursor - 1;
  const mTot = ws.getRow(execCursor);
  mTot.values = [
    'TOTAL (FY Apr-Mar)',
    { formula: `SUM(B${mStart}:B${mEnd})`, result: tdsM.txns },
    { formula: `SUM(C${mStart}:C${mEnd})`, result: tdsM.netPaid },
    { formula: `SUM(D${mStart}:D${mEnd})`, result: tdsM.netTax },
    { formula: `SUM(E${mStart}:E${mEnd})`, result: tcsM.txns },
    { formula: `SUM(F${mStart}:F${mEnd})`, result: tcsM.netPaid },
    { formula: `SUM(G${mStart}:G${mEnd})`, result: tcsM.netTax },
    { formula: `SUM(H${mStart}:H${mEnd})`, result: allM.netTax },
    { formula: `SUM(I${mStart}:I${mEnd})`, result: allM.dep },
    yearBannerTag,
  ];
  styleTotalRow(mTot, 10, [3, 4, 6, 7, 8, 9]);
  mTot.getCell(2).numFmt = '#,##0';
  mTot.getCell(5).numFmt = '#,##0';
}

export async function buildForm26ASWorkbook(
  rawParsed: ParsedForm26AS,
  options: Form26ASExcelOptions
): Promise<ArrayBuffer> {
  const taxScope = options.taxScope ?? 'all';
  const parsed = sliceParsedForm26ASByScope(rawParsed, taxScope);
  const includeSectionQuarter = options.includeSectionQuarterSummary ?? true;
  const includeAudit = options.includeAuditSheet ?? true;
  const includeExecutiveSummary = options.includeExecutiveSummary ?? true;
  const includeSeparateTdsTcsSheets = options.includeSeparateTdsTcsSheets ?? true;
  const emitProgress = (pct: number, stage: string) => options.onProgress?.(pct, stage);

  emitProgress(8, 'Initializing bifurcated Form 26AS workbook...');

  const wb = new ExcelJS.Workbook();
  wb.creator = 'VCPL Tools — PDF to Excel Convertor Form 26AS';
  wb.created = new Date();
  wb.calcProperties.fullCalcOnLoad = true;

  const hasTdsData =
    taxScope !== 'tcs' &&
    (parsed.parties.some((p) => classify26ASTaxType(p) === 'TDS') ||
      parsed.transactions.some((t) => classify26ASTaxType(t) === 'TDS'));
  const hasTcsData =
    taxScope !== 'tds' &&
    (parsed.parties.some((p) => classify26ASTaxType(p) === 'TCS') ||
      parsed.transactions.some((t) => classify26ASTaxType(t) === 'TCS'));

  const usedSheetNames = new Set<string>();
  const partySheetMap = new Map<string, string>();

  if (includeExecutiveSummary) usedSheetNames.add('executive summary');
  if (includeSeparateTdsTcsSheets && hasTdsData) {
    usedSheetNames.add('tds - deductors');
    usedSheetNames.add('tds - transactions');
  }
  if (includeSeparateTdsTcsSheets && hasTcsData) {
    usedSheetNames.add('tcs - collectors');
    usedSheetNames.add('tcs - transactions');
  }
  if (options.includeCombinedSheet) usedSheetNames.add('26as');
  if (options.includePartySheets) usedSheetNames.add('party summary');
  if (includeSectionQuarter) usedSheetNames.add('section & quarter audit');
  if (includeAudit) usedSheetNames.add('audit & exceptions');
  if (parsed.challans.length > 0) usedSheetNames.add('tax paid (challans)');

  if (options.includePartySheets) {
    parsed.parties.forEach((party) => {
      const label = `${party.tan} ${party.partyName}`;
      const sheetName = sanitizeWorksheetName(label, usedSheetNames);
      partySheetMap.set(`${party.part}::${party.tan}`, sheetName);
    });
  }

  const totalAmount = round2(parsed.transactions.reduce((acc, t) => acc + t.amountPaid, 0));
  const totalDeducted = round2(parsed.transactions.reduce((acc, t) => acc + t.taxDeducted, 0));
  const totalDeposited = round2(parsed.transactions.reduce((acc, t) => acc + t.tdsDeposited, 0));
  const totalShortDiff = round2(totalDeducted - totalDeposited);
  const totalGrossAmount = round2(
    parsed.transactions
      .filter((t) => t.entryNature !== 'Reversal')
      .reduce((acc, t) => acc + t.amountPaid, 0)
  );
  const totalReversalAmount = round2(
    parsed.transactions
      .filter((t) => t.entryNature === 'Reversal')
      .reduce((acc, t) => acc + t.amountPaid, 0)
  );
  const totalGrossTax = round2(
    parsed.transactions
      .filter((t) => t.entryNature !== 'Reversal')
      .reduce((acc, t) => acc + t.taxDeducted, 0)
  );
  const totalReversalTax = round2(
    parsed.transactions
      .filter((t) => t.entryNature === 'Reversal')
      .reduce((acc, t) => acc + t.taxDeducted, 0)
  );

  const yearBannerTag =
    parsed.yearScheme === 'tax_year'
      ? `Tax Year ${parsed.taxYear}`
      : `AY ${parsed.assessmentYear}`;
  const yearMetaTag =
    parsed.yearScheme === 'tax_year'
      ? `Tax Year (TY): ${parsed.taxYear} | Financial Year: ${parsed.financialYear}`
      : `Financial Year: ${parsed.financialYear} | Assessment Year: ${parsed.assessmentYear}`;

  const txStartRow = 7;
  const hasTransactions = parsed.transactions.length > 0;
  const txEndRow = hasTransactions ? txStartRow + parsed.transactions.length - 1 : txStartRow;

  // =========================================================================
  // 0. EXECUTIVE DASHBOARD & SEPARATE TDS / TCS BIFURCATED SCHEDULES
  // =========================================================================
  if (includeExecutiveSummary) {
    emitProgress(12, 'Building Executive TDS vs TCS Dashboard & Apr–Mar Matrix...');
    buildExecutiveDashboardSheet(wb, parsed, yearBannerTag, yearMetaTag);
  }

  if (includeSeparateTdsTcsSheets) {
    if (hasTdsData) {
      emitProgress(16, 'Building dedicated TDS Deductors & TDS Transactions sheets...');
      buildTaxRoleSheets(
        wb,
        parsed,
        'TDS',
        'TDS - Deductors',
        'TDS - Transactions',
        yearBannerTag,
        yearMetaTag
      );
    }
    if (hasTcsData) {
      emitProgress(19, 'Building dedicated TCS Collectors & TCS Transactions sheets...');
      buildTaxRoleSheets(
        wb,
        parsed,
        'TCS',
        'TCS - Collectors',
        'TCS - Transactions',
        yearBannerTag,
        yearMetaTag
      );
    }
  }

  // =========================================================================
  // 1. COMBINED SINGLE SHEET ("26AS") — 19 COLUMNS (A..S) WITH LIVE FORMULAS
  // =========================================================================
  if (options.includeCombinedSheet) {
    emitProgress(20, 'Building consolidated 26AS ledger with SUMIFS & SUBTOTAL...');
    const ws = wb.addWorksheet('26AS', {
      views: [{ state: 'frozen', ySplit: 6 }],
    });

    ws.columns = [
      { key: 'sr', width: 7 }, // A
      { key: 'txRef', width: 10 }, // B
      { key: 'part', width: 17 }, // C
      { key: 'partyType', width: 11 }, // D
      { key: 'partyName', width: 34 }, // E
      { key: 'tan', width: 14 }, // F
      { key: 'partyPan', width: 14 }, // G
      { key: 'section', width: 11 }, // H
      { key: 'txDate', width: 14 }, // I
      { key: 'quarter', width: 15 }, // J
      { key: 'status', width: 13 }, // K
      { key: 'bookDate', width: 14 }, // L
      { key: 'remarks', width: 11 }, // M
      { key: 'nature', width: 11 }, // N
      { key: 'amountPaid', width: 19 }, // O
      { key: 'taxDeducted', width: 19 }, // P
      { key: 'tdsDeposited', width: 19 }, // Q
      { key: 'shortDiff', width: 16 }, // R
      { key: 'effRate', width: 13 }, // S
    ];

    ws.mergeCells('A1:S1');
    const titleCell = ws.getCell('A1');
    titleCell.value = `FORM 26AS CONSOLIDATED STATEMENT — ${parsed.assesseeName} (PAN: ${parsed.pan} · ${yearBannerTag})`;
    titleCell.font = {
      name: 'Calibri',
      size: 13,
      bold: true,
      color: { argb: STYLE_COLORS.headerText },
    };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: STYLE_COLORS.headerFill },
    };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ws.getRow(1).height = 28;

    ws.mergeCells('A2:S2');
    const metaCell = ws.getCell('A2');
    const updatedTag = parsed.dataUpdatedTill ? ` | Updated Till: ${parsed.dataUpdatedTill}` : '';
    metaCell.value = `${yearMetaTag}${updatedTag} | PAN Status: ${parsed.panStatus} | Parties: ${parsed.parties.length} | Txns: ${parsed.transactions.length} | Gross Credits: ${parsed.transactions.length - parsed.parties.reduce((s, p) => s + p.reversalCount, 0)} | Reversals: ${parsed.parties.reduce((s, p) => s + p.reversalCount, 0)}`;
    metaCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF334155' } };
    metaCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: STYLE_COLORS.subHeaderFill },
    };
    metaCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ws.getRow(2).height = 20;

    ws.getCell('E4').value = 'FILTERED VIEW SUBTOTALS (Updates live with Excel Filter):';
    ws.getCell('E4').font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E3A5F' } };
    ws.getCell('O4').value = hasTransactions
      ? { formula: `SUBTOTAL(9,O${txStartRow}:O${txEndRow})`, result: totalAmount }
      : 0;
    ws.getCell('P4').value = hasTransactions
      ? { formula: `SUBTOTAL(9,P${txStartRow}:P${txEndRow})`, result: totalDeducted }
      : 0;
    ws.getCell('Q4').value = hasTransactions
      ? { formula: `SUBTOTAL(9,Q${txStartRow}:Q${txEndRow})`, result: totalDeposited }
      : 0;
    ws.getCell('R4').value = hasTransactions
      ? { formula: `SUBTOTAL(9,R${txStartRow}:R${txEndRow})`, result: totalShortDiff }
      : 0;
    ws.getCell('S4').value = hasTransactions
      ? { formula: 'IF(O4=0,0,ROUND(P4/O4,4))', result: calcRateDecimal(totalDeducted, totalAmount) }
      : 0;

    ['O4', 'P4', 'Q4', 'R4', 'S4'].forEach((addr) => {
      const c = ws.getCell(addr);
      c.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0F172A' } };
      c.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: STYLE_COLORS.totalFill },
      };
      c.numFmt = addr === 'S4' ? PCT_FMT : INR_FMT;
      c.alignment = { horizontal: 'right', vertical: 'middle' };
      c.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'medium', color: { argb: 'FF1E3A5F' } },
        left: { style: 'thin', color: { argb: 'FF94A3B8' } },
        right: { style: 'thin', color: { argb: 'FF94A3B8' } },
      };
    });
    ws.getRow(4).height = 22;

    const headerRow = ws.getRow(6);
    headerRow.values = [
      'Sr No',
      '26AS Ref',
      'Part',
      'Type',
      'Deductor / Collector Name',
      'TAN',
      'PAN of Party',
      'Section',
      'Txn Date',
      'Fiscal Quarter',
      'Booking Status',
      'Booking Date',
      'Remarks',
      'Entry Nature',
      'Amount Paid / Credited',
      'Tax Deducted / Collected',
      'TDS / TCS Deposited',
      'Short Deposit Diff',
      'Effective Rate %',
    ];
    styleTableHeader(headerRow, 19);
    ws.autoFilter = {
      from: 'A6',
      to: `S${txEndRow}`,
    };

    parsed.transactions.forEach((tx, idx) => {
      const rowNum = txStartRow + idx;
      const row = ws.getRow(rowNum);
      const diffVal = round2(tx.taxDeducted - tx.tdsDeposited);
      const effRate = calcRateDecimal(tx.taxDeducted, tx.amountPaid);

      row.values = [
        idx + 1,
        tx.txSrNo || `${tx.srNo}`,
        tx.part,
        tx.partyType,
        tx.partyName,
        tx.tan,
        tx.partyPan || '-',
        tx.section,
        tx.transactionDate,
        tx.fiscalQuarter || getFiscalQuarter(tx.transactionDate),
        tx.bookingStatus,
        tx.bookingDate,
        tx.remarks,
        tx.entryNature || (tx.amountPaid < 0 ? 'Reversal' : 'Credit'),
        tx.amountPaid,
        tx.taxDeducted,
        tx.tdsDeposited,
        {
          formula: `ROUND(P${rowNum}-Q${rowNum},2)`,
          result: diffVal,
        },
        {
          formula: `IF(O${rowNum}=0,0,ROUND(P${rowNum}/O${rowNum},4))`,
          result: effRate,
        },
      ];
      row.height = 20;
      row.getCell(2).numFmt = '@';
      row.getCell(6).numFmt = '@';
      row.getCell(7).numFmt = '@';
      row.getCell(8).numFmt = '@';
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(11).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(13).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(14).alignment = { horizontal: 'center', vertical: 'middle' };

      for (let c = 15; c <= 18; c++) {
        row.getCell(c).numFmt = INR_FMT;
        row.getCell(c).alignment = { horizontal: 'right', vertical: 'middle' };
      }
      row.getCell(19).numFmt = PCT_FMT;
      row.getCell(19).alignment = { horizontal: 'right', vertical: 'middle' };

      const isReversal = tx.entryNature === 'Reversal' || tx.amountPaid < 0 || tx.taxDeducted < 0;
      if (isReversal) {
        for (let c = 1; c <= 19; c++) {
          row.getCell(c).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFF1F2' },
          };
        }
        row.getCell(14).font = { bold: true, color: { argb: STYLE_COLORS.alertText } };
      } else if (idx % 2 === 1) {
        for (let c = 1; c <= 19; c++) {
          row.getCell(c).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: STYLE_COLORS.zebraFill },
          };
        }
      }
      applyThinBorders(row, 19);
    });

    // Live SUMIFS Party Summary block below transactions on Combined sheet
    const sumStartHeader = (hasTransactions ? txEndRow : 7) + 3;
    ws.mergeCells(`A${sumStartHeader}:S${sumStartHeader}`);
    const sumTitle = ws.getCell(`A${sumStartHeader}`);
    sumTitle.value =
      'DEDUCTOR / COLLECTOR LIVE SUMIFS SUMMARY (CROSS-CHECKED AGAINST FORM 26AS PDF SUBTOTALS)';
    sumTitle.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: STYLE_COLORS.headerText },
    };
    sumTitle.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: STYLE_COLORS.headerFill },
    };
    sumTitle.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ws.getRow(sumStartHeader).height = 24;

    const sumColRow = ws.getRow(sumStartHeader + 1);
    sumColRow.values = [
      'Sr No',
      'Txns',
      'Part',
      'Type',
      'Deductor / Collector Name',
      'TAN',
      'PAN of Party',
      'Reversals',
      'Gross Credit Paid',
      'Reversal Amt',
      'PDF Subtotal (Paid)',
      'Live SUMIFS (Net Paid)',
      'PDF Subtotal (Tax)',
      'Live SUMIFS (Net Tax)',
      'Live SUMIFS (Deposited)',
      'Short Deposit Diff',
      'PDF Subtotal Diff',
      'Effective Rate %',
      'Verification',
    ];
    styleTableHeader(sumColRow, 19);

    const partySumStartRow = sumStartHeader + 2;
    parsed.parties.forEach((party, pIdx) => {
      const rNum = partySumStartRow + pIdx;
      const r = ws.getRow(rNum);
      const pdfDiff = round2(party.reportedTaxDeducted - party.extractedTaxDeducted);
      const shortDiff = round2(party.extractedTaxDeducted - party.extractedTdsDeposited);
      const effRate = calcRateDecimal(party.extractedTaxDeducted, party.extractedAmountPaid);

      r.values = [
        pIdx + 1,
        hasTransactions
          ? {
              formula: `COUNTIFS($F$${txStartRow}:$F$${txEndRow},F${rNum},$C$${txStartRow}:$C$${txEndRow},C${rNum})`,
              result: party.transactionCount,
            }
          : 0,
        party.part,
        party.partyType,
        party.partyName,
        party.tan,
        party.partyPan || '-',
        hasTransactions
          ? {
              formula: `COUNTIFS($F$${txStartRow}:$F$${txEndRow},F${rNum},$C$${txStartRow}:$C$${txEndRow},C${rNum},$N$${txStartRow}:$N$${txEndRow},"Reversal")`,
              result: party.reversalCount,
            }
          : 0,
        hasTransactions
          ? {
              formula: `SUMIFS($O$${txStartRow}:$O$${txEndRow},$F$${txStartRow}:$F$${txEndRow},F${rNum},$C$${txStartRow}:$C$${txEndRow},C${rNum},$N$${txStartRow}:$N$${txEndRow},"Credit")`,
              result: party.grossAmountPaid,
            }
          : 0,
        hasTransactions
          ? {
              formula: `SUMIFS($O$${txStartRow}:$O$${txEndRow},$F$${txStartRow}:$F$${txEndRow},F${rNum},$C$${txStartRow}:$C$${txEndRow},C${rNum},$N$${txStartRow}:$N$${txEndRow},"Reversal")`,
              result: party.reversalAmountPaid,
            }
          : 0,
        party.reportedAmountPaid,
        hasTransactions
          ? {
              formula: `SUMIFS($O$${txStartRow}:$O$${txEndRow},$F$${txStartRow}:$F$${txEndRow},F${rNum},$C$${txStartRow}:$C$${txEndRow},C${rNum})`,
              result: party.extractedAmountPaid,
            }
          : 0,
        party.reportedTaxDeducted,
        hasTransactions
          ? {
              formula: `SUMIFS($P$${txStartRow}:$P$${txEndRow},$F$${txStartRow}:$F$${txEndRow},F${rNum},$C$${txStartRow}:$C$${txEndRow},C${rNum})`,
              result: party.extractedTaxDeducted,
            }
          : 0,
        hasTransactions
          ? {
              formula: `SUMIFS($Q$${txStartRow}:$Q$${txEndRow},$F$${txStartRow}:$F$${txEndRow},F${rNum},$C$${txStartRow}:$C$${txEndRow},C${rNum})`,
              result: party.extractedTdsDeposited,
            }
          : 0,
        {
          formula: `ROUND(N${rNum}-O${rNum},2)`,
          result: shortDiff,
        },
        {
          formula: `ROUND(M${rNum}-N${rNum},2)`,
          result: pdfDiff,
        },
        {
          formula: `IF(L${rNum}=0,0,ROUND(N${rNum}/L${rNum},4))`,
          result: effRate,
        },
        party.verificationStatus,
      ];
      r.height = 20;
      r.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      r.getCell(2).numFmt = '#,##0';
      r.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' };
      r.getCell(6).numFmt = '@';
      r.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
      r.getCell(7).numFmt = '@';
      r.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };
      r.getCell(8).numFmt = '#,##0';
      r.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
      for (let c = 9; c <= 17; c++) {
        r.getCell(c).numFmt = INR_FMT;
        r.getCell(c).alignment = { horizontal: 'right', vertical: 'middle' };
      }
      r.getCell(18).numFmt = PCT_FMT;
      r.getCell(18).alignment = { horizontal: 'right', vertical: 'middle' };

      const statusCell = r.getCell(19);
      statusCell.alignment = { horizontal: 'center', vertical: 'middle' };
      statusCell.font = {
        bold: true,
        color: {
          argb:
            party.verificationStatus === 'Verified'
              ? STYLE_COLORS.okText
              : STYLE_COLORS.warnText,
        },
      };
      statusCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: {
          argb:
            party.verificationStatus === 'Verified'
              ? STYLE_COLORS.okFill
              : STYLE_COLORS.warnFill,
        },
      };
      applyThinBorders(r, 19);
    });

    if (parsed.parties.length > 0) {
      const partySumEndRow = partySumStartRow + parsed.parties.length - 1;
      const totRowNum = partySumEndRow + 1;
      const totRow = ws.getRow(totRowNum);
      const totalReportedPaid = round2(
        parsed.parties.reduce((acc, p) => acc + p.reportedAmountPaid, 0)
      );
      const totalReportedTax = round2(
        parsed.parties.reduce((acc, p) => acc + p.reportedTaxDeducted, 0)
      );
      const totalReversalCount = parsed.parties.reduce((acc, p) => acc + p.reversalCount, 0);
      const allVerified = parsed.parties.every((p) => p.verificationStatus === 'Verified');

      totRow.values = [
        'TOTAL',
        { formula: `SUM(B${partySumStartRow}:B${partySumEndRow})`, result: parsed.transactions.length },
        '',
        '',
        `${parsed.parties.length} deductor/collector account(s)`,
        '',
        '',
        { formula: `SUM(H${partySumStartRow}:H${partySumEndRow})`, result: totalReversalCount },
        { formula: `SUM(I${partySumStartRow}:I${partySumEndRow})`, result: totalGrossAmount },
        { formula: `SUM(J${partySumStartRow}:J${partySumEndRow})`, result: totalReversalAmount },
        { formula: `SUM(K${partySumStartRow}:K${partySumEndRow})`, result: totalReportedPaid },
        { formula: `SUM(L${partySumStartRow}:L${partySumEndRow})`, result: totalAmount },
        { formula: `SUM(M${partySumStartRow}:M${partySumEndRow})`, result: totalReportedTax },
        { formula: `SUM(N${partySumStartRow}:N${partySumEndRow})`, result: totalDeducted },
        { formula: `SUM(O${partySumStartRow}:O${partySumEndRow})`, result: totalDeposited },
        { formula: `ROUND(N${totRowNum}-O${totRowNum},2)`, result: totalShortDiff },
        { formula: `ROUND(M${totRowNum}-N${totRowNum},2)`, result: round2(totalReportedTax - totalDeducted) },
        {
          formula: `IF(L${totRowNum}=0,0,ROUND(N${totRowNum}/L${totRowNum},4))`,
          result: calcRateDecimal(totalDeducted, totalAmount),
        },
        allVerified ? 'All Verified' : 'Review Variance',
      ];
      styleTotalRow(totRow, 19, [9, 10, 11, 12, 13, 14, 15, 16, 17], [18]);
      totRow.getCell(2).numFmt = '#,##0';
      totRow.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' };
      totRow.getCell(8).numFmt = '#,##0';
      totRow.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
      totRow.getCell(19).alignment = { horizontal: 'center', vertical: 'middle' };
      totRow.getCell(19).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: allVerified ? STYLE_COLORS.okFill : STYLE_COLORS.warnFill },
      };
      totRow.getCell(19).font = {
        bold: true,
        color: { argb: allVerified ? STYLE_COLORS.okText : STYLE_COLORS.warnText },
      };

      // Part-wise & Official Statement Reconciliation cross-check block
      const reconStart = totRowNum + 2;
      ws.mergeCells(`A${reconStart}:S${reconStart}`);
      const reconTitle = ws.getCell(`A${reconStart}`);
      reconTitle.value = 'PART-WISE & OFFICIAL STATEMENT RECONCILIATION CHECK';
      reconTitle.font = {
        name: 'Calibri',
        size: 10,
        bold: true,
        color: { argb: STYLE_COLORS.headerText },
      };
      reconTitle.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: STYLE_COLORS.headerFill },
      };
      reconTitle.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      ws.getRow(reconStart).height = 22;

      const reconHdr = ws.getRow(reconStart + 1);
      reconHdr.values = [
        'Sr',
        'Parties',
        'Statement Part',
        'Role',
        'Description',
        'Txns',
        'Reversals',
        'Header Summary (₹)',
        'Gross Credit Paid',
        'Reversal Amt',
        'PDF Gross Paid',
        'Extracted Net Paid',
        'PDF Official Tax',
        'Extracted Net Tax',
        'Extracted Deposited',
        'Short Deposit Diff',
        'PDF vs Excel Diff',
        'Eff Rate %',
        'Status',
      ];
      styleTableHeader(reconHdr, 19);

      const distinctParts = Array.from(new Set(parsed.parties.map((p) => p.part)));
      distinctParts.forEach((partName, idx) => {
        const rr = reconStart + 2 + idx;
        const row = ws.getRow(rr);
        const partParties = parsed.parties.filter((p) => p.part === partName);
        const partTxs = parsed.transactions.filter((t) => t.part === partName);
        const partReversals = partTxs.filter((t) => t.entryNature === 'Reversal');
        const partGrossPaid = round2(
          partTxs.filter((t) => t.entryNature !== 'Reversal').reduce((s, t) => s + t.amountPaid, 0)
        );
        const partRevPaid = round2(partReversals.reduce((s, t) => s + t.amountPaid, 0));
        const partyPaidSum = round2(partTxs.reduce((s, t) => s + t.amountPaid, 0));
        const partyTaxSum = round2(partTxs.reduce((s, t) => s + t.taxDeducted, 0));
        const partyDepSum = round2(partTxs.reduce((s, t) => s + t.tdsDeposited, 0));
        const officialGross = parsed.officialSummary?.partGrossTotals[partName];
        const fallbackOfficialTax = /tcs/i.test(partName)
          ? parsed.officialSummary?.summaryTcs
          : /part\s*(?:i|a)\b.*tds/i.test(partName)
            ? parsed.officialSummary?.summaryTds
            : undefined;
        const headerSummaryVal = /tcs/i.test(partName)
          ? (parsed.officialSummary?.summaryTcs ?? 0)
          : /part\s*(?:i|a)\b.*tds/i.test(partName)
            ? (parsed.officialSummary?.summaryTds ?? 0)
            : 0;
        const officialPaidVal =
          officialGross?.amountPaid ??
          round2(partParties.reduce((s, p) => s + p.reportedAmountPaid, 0));
        const officialTaxVal =
          officialGross?.taxDeducted ??
          fallbackOfficialTax ??
          round2(partParties.reduce((s, p) => s + p.reportedTaxDeducted, 0));
        const reconDiff = round2(officialTaxVal - partyTaxSum);
        const isReconOk = Math.abs(reconDiff) <= 1;

        row.values = [
          idx + 1,
          partParties.length,
          partName,
          partParties[0]?.partyType ?? 'Deductor',
          /tcs/i.test(partName) ? 'Tax Collected at Source' : 'Tax Deducted at Source',
          hasTransactions
            ? {
                formula: `COUNTIF($C$${txStartRow}:$C$${txEndRow},C${rr})`,
                result: partTxs.length,
              }
            : 0,
          hasTransactions
            ? {
                formula: `COUNTIFS($C$${txStartRow}:$C$${txEndRow},C${rr},$N$${txStartRow}:$N$${txEndRow},"Reversal")`,
                result: partReversals.length,
              }
            : 0,
          headerSummaryVal,
          hasTransactions
            ? {
                formula: `SUMIFS($O$${txStartRow}:$O$${txEndRow},$C$${txStartRow}:$C$${txEndRow},C${rr},$N$${txStartRow}:$N$${txEndRow},"Credit")`,
                result: partGrossPaid,
              }
            : 0,
          hasTransactions
            ? {
                formula: `SUMIFS($O$${txStartRow}:$O$${txEndRow},$C$${txStartRow}:$C$${txEndRow},C${rr},$N$${txStartRow}:$N$${txEndRow},"Reversal")`,
                result: partRevPaid,
              }
            : 0,
          officialPaidVal,
          hasTransactions
            ? {
                formula: `SUMIF($C$${txStartRow}:$C$${txEndRow},C${rr},$O$${txStartRow}:$O$${txEndRow})`,
                result: partyPaidSum,
              }
            : 0,
          officialTaxVal,
          hasTransactions
            ? {
                formula: `SUMIF($C$${txStartRow}:$C$${txEndRow},C${rr},$P$${txStartRow}:$P$${txEndRow})`,
                result: partyTaxSum,
              }
            : 0,
          hasTransactions
            ? {
                formula: `SUMIF($C$${txStartRow}:$C$${txEndRow},C${rr},$Q$${txStartRow}:$Q$${txEndRow})`,
                result: partyDepSum,
              }
            : 0,
          { formula: `ROUND(N${rr}-O${rr},2)`, result: round2(partyTaxSum - partyDepSum) },
          { formula: `ROUND(M${rr}-N${rr},2)`, result: reconDiff },
          {
            formula: `IF(L${rr}=0,0,ROUND(N${rr}/L${rr},4))`,
            result: calcRateDecimal(partyTaxSum, partyPaidSum),
          },
          isReconOk ? 'Matched' : 'Variance',
        ];
        row.height = 20;
        row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(2).numFmt = '#,##0';
        row.getCell(6).numFmt = '#,##0';
        row.getCell(7).numFmt = '#,##0';
        for (let c = 8; c <= 17; c++) {
          row.getCell(c).numFmt = INR_FMT;
          row.getCell(c).alignment = { horizontal: 'right', vertical: 'middle' };
        }
        row.getCell(18).numFmt = PCT_FMT;
        row.getCell(18).alignment = { horizontal: 'right', vertical: 'middle' };

        const stCell = row.getCell(19);
        stCell.alignment = { horizontal: 'center', vertical: 'middle' };
        stCell.font = {
          bold: true,
          color: { argb: isReconOk ? STYLE_COLORS.okText : STYLE_COLORS.warnText },
        };
        stCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: isReconOk ? STYLE_COLORS.okFill : STYLE_COLORS.warnFill },
        };
        applyThinBorders(row, 19);
      });
    }
  }

  // =========================================================================
  // 2. HYPERLINKED PARTY SUMMARY + INDIVIDUAL PARTY SHEETS
  // =========================================================================
  if (options.includePartySheets) {
    emitProgress(42, 'Generating hyperlinked Party Summary & individual worksheets...');
    const summaryWs = wb.addWorksheet('Party Summary', {
      views: [{ state: 'frozen', ySplit: 4 }],
    });

    summaryWs.columns = [
      { key: 'sr', width: 7 }, // A
      { key: 'part', width: 17 }, // B
      { key: 'type', width: 11 }, // C
      { key: 'name', width: 36 }, // D
      { key: 'tan', width: 14 }, // E
      { key: 'partyPan', width: 14 }, // F
      { key: 'txCount', width: 9 }, // G
      { key: 'reversals', width: 10 }, // H
      { key: 'amountPaid', width: 19 }, // I
      { key: 'taxDeducted', width: 19 }, // J
      { key: 'tdsDeposited', width: 19 }, // K
      { key: 'shortDiff', width: 16 }, // L
      { key: 'effRate', width: 13 }, // M
      { key: 'status', width: 16 }, // N
      { key: 'sheetLink', width: 18 }, // O
    ];

    summaryWs.mergeCells('A1:O1');
    const titleCell = summaryWs.getCell('A1');
    titleCell.value = `FORM 26AS PARTY SUMMARY — ${parsed.assesseeName} (${parsed.pan} · ${yearBannerTag})`;
    titleCell.font = {
      name: 'Calibri',
      size: 13,
      bold: true,
      color: { argb: STYLE_COLORS.headerText },
    };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: STYLE_COLORS.headerFill },
    };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    summaryWs.getRow(1).height = 28;

    summaryWs.mergeCells('A2:O2');
    const subTitle = summaryWs.getCell('A2');
    subTitle.value =
      'Includes Deductor/Collector TAN & PAN, Reversal counts, Effective Tax Rate %, and "Open Sheet →" navigation links in Column O.';
    subTitle.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF334155' } };
    subTitle.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: STYLE_COLORS.subHeaderFill },
    };
    summaryWs.getRow(2).height = 20;

    const headerRow = summaryWs.getRow(4);
    headerRow.values = [
      'Sr No',
      'Part',
      'Type',
      'Deductor / Collector Name',
      'TAN',
      'PAN of Party',
      'Txns',
      'Reversals',
      'Amount Paid / Credited',
      'Tax Deducted / Collected',
      'TDS / TCS Deposited',
      'Short Deposit Diff',
      'Effective Rate %',
      'Subtotal Check',
      'Party Worksheet',
    ];
    styleTableHeader(headerRow, 15);

    const startPartyRow = 5;
    parsed.parties.forEach((party, idx) => {
      const rNum = startPartyRow + idx;
      const partyTab = partySheetMap.get(`${party.part}::${party.tan}`)!;
      const escapedTab = partyTab.replace(/'/g, "''");
      const row = summaryWs.getRow(rNum);

      const partyTxs = parsed.transactions.filter(
        (t) => t.tan === party.tan && t.part === party.part
      );
      const partyTotalRow = 6 + partyTxs.length;

      row.values = [
        idx + 1,
        party.part,
        party.partyType,
        party.partyName,
        party.tan,
        party.partyPan || '-',
        party.transactionCount,
        party.reversalCount,
        {
          formula: `'${escapedTab}'!J${partyTotalRow}`,
          result: party.extractedAmountPaid,
        },
        {
          formula: `'${escapedTab}'!K${partyTotalRow}`,
          result: party.extractedTaxDeducted,
        },
        {
          formula: `'${escapedTab}'!L${partyTotalRow}`,
          result: party.extractedTdsDeposited,
        },
        {
          formula: `ROUND(J${rNum}-K${rNum},2)`,
          result: round2(party.extractedTaxDeducted - party.extractedTdsDeposited),
        },
        {
          formula: `IF(I${rNum}=0,0,ROUND(J${rNum}/I${rNum},4))`,
          result: calcRateDecimal(party.extractedTaxDeducted, party.extractedAmountPaid),
        },
        party.verificationStatus,
        {
          text: 'Open Sheet →',
          hyperlink: `#'${escapedTab}'!A1`,
          tooltip: `Jump to ${party.partyName} (${party.tan})`,
        },
      ];
      row.height = 21;
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(5).numFmt = '@';
      row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(6).numFmt = '@';
      row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(7).numFmt = '#,##0';
      row.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(8).numFmt = '#,##0';
      row.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
      for (let c = 9; c <= 12; c++) {
        row.getCell(c).numFmt = INR_FMT;
        row.getCell(c).alignment = { horizontal: 'right', vertical: 'middle' };
      }
      row.getCell(13).numFmt = PCT_FMT;
      row.getCell(13).alignment = { horizontal: 'right', vertical: 'middle' };

      const statusCell = row.getCell(14);
      statusCell.alignment = { horizontal: 'center', vertical: 'middle' };
      statusCell.font = {
        bold: true,
        color: {
          argb:
            party.verificationStatus === 'Verified'
              ? STYLE_COLORS.okText
              : STYLE_COLORS.warnText,
        },
      };
      statusCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: {
          argb:
            party.verificationStatus === 'Verified'
              ? STYLE_COLORS.okFill
              : STYLE_COLORS.warnFill,
        },
      };

      const linkCell = row.getCell(15);
      linkCell.font = {
        name: 'Calibri',
        size: 10,
        bold: true,
        underline: true,
        color: { argb: STYLE_COLORS.linkBlue },
      };
      linkCell.alignment = { horizontal: 'center', vertical: 'middle' };
      applyThinBorders(row, 15);
    });

    if (parsed.parties.length > 0) {
      const endPartyRow = startPartyRow + parsed.parties.length - 1;
      const totRowNum = endPartyRow + 1;
      const totRow = summaryWs.getRow(totRowNum);
      const totalReversalCount = parsed.parties.reduce((acc, p) => acc + p.reversalCount, 0);
      totRow.values = [
        'TOTAL',
        '',
        '',
        `${parsed.parties.length} party account(s)`,
        '',
        '',
        { formula: `SUM(G${startPartyRow}:G${endPartyRow})`, result: parsed.transactions.length },
        { formula: `SUM(H${startPartyRow}:H${endPartyRow})`, result: totalReversalCount },
        { formula: `SUM(I${startPartyRow}:I${endPartyRow})`, result: totalAmount },
        { formula: `SUM(J${startPartyRow}:J${endPartyRow})`, result: totalDeducted },
        { formula: `SUM(K${startPartyRow}:K${endPartyRow})`, result: totalDeposited },
        { formula: `SUM(L${startPartyRow}:L${endPartyRow})`, result: totalShortDiff },
        {
          formula: `IF(I${totRowNum}=0,0,ROUND(J${totRowNum}/I${totRowNum},4))`,
          result: calcRateDecimal(totalDeducted, totalAmount),
        },
        '',
        '',
      ];
      styleTotalRow(totRow, 15, [9, 10, 11, 12], [13]);
      totRow.getCell(7).numFmt = '#,##0';
      totRow.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
      totRow.getCell(8).numFmt = '#,##0';
      totRow.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
    }

    const totalParties = Math.max(1, parsed.parties.length);
    parsed.parties.forEach((party, idx) => {
      if (idx % 6 === 0) {
        emitProgress(
          Math.round(45 + (idx / totalParties) * 28),
          `Building party sheet ${idx + 1} of ${totalParties} (${party.tan})...`
        );
      }
      const tabName = partySheetMap.get(`${party.part}::${party.tan}`)!;
      const pWs = wb.addWorksheet(tabName, {
        views: [{ state: 'frozen', ySplit: 5 }],
      });

      pWs.columns = [
        { key: 'sr', width: 7 }, // A
        { key: 'txRef', width: 10 }, // B
        { key: 'section', width: 11 }, // C
        { key: 'txDate', width: 14 }, // D
        { key: 'quarter', width: 15 }, // E
        { key: 'status', width: 13 }, // F
        { key: 'bookDate', width: 14 }, // G
        { key: 'remarks', width: 11 }, // H
        { key: 'nature', width: 11 }, // I
        { key: 'amountPaid', width: 19 }, // J
        { key: 'taxDeducted', width: 19 }, // K
        { key: 'tdsDeposited', width: 19 }, // L
        { key: 'shortDiff', width: 16 }, // M
        { key: 'effRate', width: 16 }, // N
      ];

      pWs.mergeCells('A1:M1');
      const pTitle = pWs.getCell('A1');
      pTitle.value = `${party.partyName} — TAN: ${party.tan} | PAN: ${party.partyPan || '-'} (${party.part})`;
      pTitle.font = {
        name: 'Calibri',
        size: 12,
        bold: true,
        color: { argb: STYLE_COLORS.headerText },
      };
      pTitle.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: STYLE_COLORS.headerFill },
      };
      pTitle.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

      const backCell = pWs.getCell('N1');
      backCell.value = {
        text: '← Party Summary',
        hyperlink: "#'Party Summary'!A1",
      };
      backCell.font = {
        name: 'Calibri',
        size: 10,
        bold: true,
        underline: true,
        color: { argb: 'FFF9C80E' },
      };
      backCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: STYLE_COLORS.headerFill },
      };
      backCell.alignment = { vertical: 'middle', horizontal: 'center' };
      pWs.getRow(1).height = 26;

      const partyYearTag =
        parsed.yearScheme === 'tax_year'
          ? `Tax Year ${parsed.taxYear}`
          : `FY ${parsed.financialYear} · AY ${parsed.assessmentYear}`;

      pWs.mergeCells('A2:N2');
      const pMeta = pWs.getCell('A2');
      pMeta.value = `Assessee: ${parsed.assesseeName} (${parsed.pan}) · ${partyYearTag} · Txns: ${party.transactionCount} (Reversals: ${party.reversalCount}) · Subtotal Check: ${party.verificationStatus}`;
      pMeta.font = { name: 'Calibri', size: 10, color: { argb: 'FF334155' } };
      pMeta.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: STYLE_COLORS.subHeaderFill },
      };
      pWs.getRow(2).height = 20;

      const hdr = pWs.getRow(5);
      hdr.values = [
        'Sr No',
        '26AS Ref',
        'Section',
        'Transaction Date',
        'Fiscal Quarter',
        'Booking Status',
        'Date of Booking',
        'Remarks',
        'Entry Nature',
        'Amount Paid / Credited',
        'Tax Deducted / Collected',
        'TDS / TCS Deposited',
        'Short Deposit Diff',
        'Effective Rate %',
      ];
      styleTableHeader(hdr, 14);

      const partyTxs = parsed.transactions.filter(
        (t) => t.tan === party.tan && t.part === party.part
      );
      const startRow = 6;
      const endRow = Math.max(startRow, startRow + partyTxs.length - 1);

      pWs.autoFilter = {
        from: 'A5',
        to: `N${endRow}`,
      };

      partyTxs.forEach((tx, tIdx) => {
        const rNum = startRow + tIdx;
        const r = pWs.getRow(rNum);
        const effRate = calcRateDecimal(tx.taxDeducted, tx.amountPaid);

        r.values = [
          tIdx + 1,
          tx.txSrNo || `${tx.srNo}`,
          tx.section,
          tx.transactionDate,
          tx.fiscalQuarter || getFiscalQuarter(tx.transactionDate),
          tx.bookingStatus,
          tx.bookingDate,
          tx.remarks,
          tx.entryNature || (tx.amountPaid < 0 ? 'Reversal' : 'Credit'),
          tx.amountPaid,
          tx.taxDeducted,
          tx.tdsDeposited,
          {
            formula: `ROUND(K${rNum}-L${rNum},2)`,
            result: round2(tx.taxDeducted - tx.tdsDeposited),
          },
          {
            formula: `IF(J${rNum}=0,0,ROUND(K${rNum}/J${rNum},4))`,
            result: effRate,
          },
        ];
        r.height = 20;
        r.getCell(2).numFmt = '@';
        r.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
        r.getCell(3).numFmt = '@';
        r.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
        r.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
        r.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };
        r.getCell(9).alignment = { horizontal: 'center', vertical: 'middle' };
        for (let c = 10; c <= 13; c++) {
          r.getCell(c).numFmt = INR_FMT;
          r.getCell(c).alignment = { horizontal: 'right', vertical: 'middle' };
        }
        r.getCell(14).numFmt = PCT_FMT;
        r.getCell(14).alignment = { horizontal: 'right', vertical: 'middle' };
        if (tx.entryNature === 'Reversal' || tx.amountPaid < 0) {
          for (let c = 1; c <= 14; c++) {
            r.getCell(c).fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFFF1F2' },
            };
          }
        }
        applyThinBorders(r, 14);
      });

      const sumRowNum = startRow + partyTxs.length;
      const sumRow = pWs.getRow(sumRowNum);
      sumRow.values = [
        'TOTAL',
        `${partyTxs.length} txns`,
        '',
        '',
        '',
        '',
        '',
        '',
        `${party.reversalCount} rev`,
        { formula: `SUM(J${startRow}:J${endRow})`, result: party.extractedAmountPaid },
        { formula: `SUM(K${startRow}:K${endRow})`, result: party.extractedTaxDeducted },
        { formula: `SUM(L${startRow}:L${endRow})`, result: party.extractedTdsDeposited },
        {
          formula: `SUM(M${startRow}:M${endRow})`,
          result: round2(party.extractedTaxDeducted - party.extractedTdsDeposited),
        },
        {
          formula: `IF(J${sumRowNum}=0,0,ROUND(K${sumRowNum}/J${sumRowNum},4))`,
          result: calcRateDecimal(party.extractedTaxDeducted, party.extractedAmountPaid),
        },
      ];
      styleTotalRow(sumRow, 14, [10, 11, 12, 13], [14]);
    });
  }

  // =========================================================================
  // 3. SECTION-WISE & QUARTER-WISE AUDIT SHEET (16 COLUMNS A..P, 100% LIVE)
  // =========================================================================
  if (includeSectionQuarter) {
    emitProgress(76, 'Building Section, Quarter & Status formula schedules...');
    const sqWs = wb.addWorksheet('Section & Quarter Audit', {
      views: [{ state: 'frozen', ySplit: 4 }],
    });

    sqWs.columns = [
      { key: 'sr', width: 7 }, // A
      { key: 'part', width: 17 }, // B
      { key: 'section', width: 12 }, // C
      { key: 'act2025', width: 20 }, // D
      { key: 'old1961', width: 11 }, // E
      { key: 'desc', width: 38 }, // F
      { key: 'txns', width: 9 }, // G
      { key: 'revs', width: 10 }, // H
      { key: 'grossPaid', width: 18 }, // I
      { key: 'revPaid', width: 18 }, // J
      { key: 'netPaid', width: 19 }, // K
      { key: 'netTax', width: 19 }, // L
      { key: 'netDep', width: 19 }, // M
      { key: 'shortDiff', width: 16 }, // N
      { key: 'effRate', width: 13 }, // O
      { key: 'stdRate', width: 13 }, // P
    ];

    sqWs.mergeCells('A1:P1');
    const titleCell = sqWs.getCell('A1');
    titleCell.value = `FORM 26AS SECTION, QUARTER & STATUS AUDIT — ${parsed.assesseeName} (${parsed.pan} · ${yearBannerTag})`;
    titleCell.font = {
      name: 'Calibri',
      size: 13,
      bold: true,
      color: { argb: STYLE_COLORS.headerText },
    };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: STYLE_COLORS.headerFill },
    };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    sqWs.getRow(1).height = 28;

    sqWs.mergeCells('A2:P2');
    const subCell = sqWs.getCell('A2');
    subCell.value =
      'Dynamic live formulas referencing "26AS": Gross Credits vs Reversals (G/B), 2025 Act & 1961 Act Equivalents, Effective Rate vs Standard Statutory Rate, Fiscal Quarters Q1–Q4, and Booking Status / Remark Schedules.';
    subCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF334155' } };
    subCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: STYLE_COLORS.subHeaderFill },
    };
    sqWs.getRow(2).height = 20;

    // Aggregate by Part + Section
    const sectionMap = new Map<
      string,
      {
        part: string;
        section: string;
        txns: number;
        revs: number;
        grossPaid: number;
        revPaid: number;
        paid: number;
        tax: number;
        dep: number;
      }
    >();
    parsed.transactions.forEach((tx) => {
      const k = `${tx.part}::${tx.section}`;
      const isRev = tx.entryNature === 'Reversal' || tx.amountPaid < 0 || tx.taxDeducted < 0;
      const existing = sectionMap.get(k);
      if (existing) {
        existing.txns += 1;
        if (isRev) {
          existing.revs += 1;
          existing.revPaid = round2(existing.revPaid + tx.amountPaid);
        } else {
          existing.grossPaid = round2(existing.grossPaid + tx.amountPaid);
        }
        existing.paid = round2(existing.paid + tx.amountPaid);
        existing.tax = round2(existing.tax + tx.taxDeducted);
        existing.dep = round2(existing.dep + tx.tdsDeposited);
      } else {
        sectionMap.set(k, {
          part: tx.part,
          section: tx.section,
          txns: 1,
          revs: isRev ? 1 : 0,
          grossPaid: isRev ? 0 : round2(tx.amountPaid),
          revPaid: isRev ? round2(tx.amountPaid) : 0,
          paid: round2(tx.amountPaid),
          tax: round2(tx.taxDeducted),
          dep: round2(tx.tdsDeposited),
        });
      }
    });
    const sectionRows = Array.from(sectionMap.values()).sort(
      (a, b) => a.part.localeCompare(b.part) || b.tax - a.tax
    );

    const secHeader = sqWs.getRow(4);
    secHeader.values = [
      'Sr No',
      'Part',
      'Section Code',
      '2025 Act Reference',
      '1961 Act Eq.',
      'Statutory Section Description',
      'Total Txns',
      'Reversals',
      'Gross Credit Paid',
      'Reversal Amt',
      'Net Amount Paid',
      'Net Tax Ded/Col',
      'Net Deposited',
      'Short Deposit Diff',
      'Effective Rate %',
      'Statutory Rate %',
    ];
    styleTableHeader(secHeader, 16);

    const useLive26AS = options.includeCombinedSheet && hasTransactions;
    const secStartRow = 5;
    sectionRows.forEach((item, idx) => {
      const rNum = secStartRow + idx;
      const r = sqWs.getRow(rNum);
      const diff = round2(item.tax - item.dep);
      const meta = lookupSectionMeta(item.section);
      const effRate = calcRateDecimal(item.tax, item.paid);
      const stdRate = normalizeRateDecimal(meta.standardRatePct);

      r.values = [
        idx + 1,
        item.part,
        item.section,
        meta.statutoryRef,
        meta.oldActEq,
        meta.description || getSectionDescription(item.section),
        useLive26AS
          ? {
              formula: `COUNTIFS('26AS'!$C$${txStartRow}:$C$${txEndRow},B${rNum},'26AS'!$H$${txStartRow}:$H$${txEndRow},C${rNum})`,
              result: item.txns,
            }
          : item.txns,
        useLive26AS
          ? {
              formula: `COUNTIFS('26AS'!$C$${txStartRow}:$C$${txEndRow},B${rNum},'26AS'!$H$${txStartRow}:$H$${txEndRow},C${rNum},'26AS'!$N$${txStartRow}:$N$${txEndRow},"Reversal")`,
              result: item.revs,
            }
          : item.revs,
        useLive26AS
          ? {
              formula: `SUMIFS('26AS'!$O$${txStartRow}:$O$${txEndRow},'26AS'!$C$${txStartRow}:$C$${txEndRow},B${rNum},'26AS'!$H$${txStartRow}:$H$${txEndRow},C${rNum},'26AS'!$N$${txStartRow}:$N$${txEndRow},"Credit")`,
              result: item.grossPaid,
            }
          : item.grossPaid,
        useLive26AS
          ? {
              formula: `SUMIFS('26AS'!$O$${txStartRow}:$O$${txEndRow},'26AS'!$C$${txStartRow}:$C$${txEndRow},B${rNum},'26AS'!$H$${txStartRow}:$H$${txEndRow},C${rNum},'26AS'!$N$${txStartRow}:$N$${txEndRow},"Reversal")`,
              result: item.revPaid,
            }
          : item.revPaid,
        useLive26AS
          ? {
              formula: `SUMIFS('26AS'!$O$${txStartRow}:$O$${txEndRow},'26AS'!$C$${txStartRow}:$C$${txEndRow},B${rNum},'26AS'!$H$${txStartRow}:$H$${txEndRow},C${rNum})`,
              result: item.paid,
            }
          : item.paid,
        useLive26AS
          ? {
              formula: `SUMIFS('26AS'!$P$${txStartRow}:$P$${txEndRow},'26AS'!$C$${txStartRow}:$C$${txEndRow},B${rNum},'26AS'!$H$${txStartRow}:$H$${txEndRow},C${rNum})`,
              result: item.tax,
            }
          : item.tax,
        useLive26AS
          ? {
              formula: `SUMIFS('26AS'!$Q$${txStartRow}:$Q$${txEndRow},'26AS'!$C$${txStartRow}:$C$${txEndRow},B${rNum},'26AS'!$H$${txStartRow}:$H$${txEndRow},C${rNum})`,
              result: item.dep,
            }
          : item.dep,
        {
          formula: `ROUND(L${rNum}-M${rNum},2)`,
          result: diff,
        },
        {
          formula: `IF(K${rNum}=0,0,ROUND(L${rNum}/K${rNum},4))`,
          result: effRate,
        },
        stdRate,
      ];
      r.height = 20;
      r.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      r.getCell(3).numFmt = '@';
      r.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
      r.getCell(5).numFmt = '@';
      r.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
      r.getCell(7).numFmt = '#,##0';
      r.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
      r.getCell(8).numFmt = '#,##0';
      r.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
      for (let c = 9; c <= 14; c++) {
        r.getCell(c).numFmt = INR_FMT;
        r.getCell(c).alignment = { horizontal: 'right', vertical: 'middle' };
      }
      r.getCell(15).numFmt = PCT_FMT;
      r.getCell(15).alignment = { horizontal: 'right', vertical: 'middle' };
      if (typeof stdRate === 'number') {
        r.getCell(16).numFmt = PCT_FMT;
        r.getCell(16).alignment = { horizontal: 'right', vertical: 'middle' };
      } else {
        r.getCell(16).alignment = { horizontal: 'center', vertical: 'middle' };
      }
      if (idx % 2 === 1) {
        for (let c = 1; c <= 16; c++) {
          r.getCell(c).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: STYLE_COLORS.zebraFill },
          };
        }
      }
      applyThinBorders(r, 16);
    });

    const secEndRow = Math.max(secStartRow, secStartRow + sectionRows.length - 1);
    const secTotRowNum = sectionRows.length > 0 ? secEndRow + 1 : secStartRow;
    const secTotRow = sqWs.getRow(secTotRowNum);
    const totalRevsCount = sectionRows.reduce((s, x) => s + x.revs, 0);
    secTotRow.values = [
      'TOTAL',
      '',
      `${sectionRows.length} sec(s)`,
      'Income-tax Act, 2025 / 1961',
      '',
      'Total across all TDS / TCS sections',
      sectionRows.length > 0
        ? { formula: `SUM(G${secStartRow}:G${secEndRow})`, result: parsed.transactions.length }
        : 0,
      sectionRows.length > 0
        ? { formula: `SUM(H${secStartRow}:H${secEndRow})`, result: totalRevsCount }
        : 0,
      sectionRows.length > 0
        ? { formula: `SUM(I${secStartRow}:I${secEndRow})`, result: totalGrossAmount }
        : 0,
      sectionRows.length > 0
        ? { formula: `SUM(J${secStartRow}:J${secEndRow})`, result: totalReversalAmount }
        : 0,
      sectionRows.length > 0
        ? { formula: `SUM(K${secStartRow}:K${secEndRow})`, result: totalAmount }
        : 0,
      sectionRows.length > 0
        ? { formula: `SUM(L${secStartRow}:L${secEndRow})`, result: totalDeducted }
        : 0,
      sectionRows.length > 0
        ? { formula: `SUM(M${secStartRow}:M${secEndRow})`, result: totalDeposited }
        : 0,
      { formula: `ROUND(L${secTotRowNum}-M${secTotRowNum},2)`, result: totalShortDiff },
      {
        formula: `IF(K${secTotRowNum}=0,0,ROUND(L${secTotRowNum}/K${secTotRowNum},4))`,
        result: calcRateDecimal(totalDeducted, totalAmount),
      },
      '',
    ];
    styleTotalRow(secTotRow, 16, [9, 10, 11, 12, 13, 14], [15]);
    secTotRow.getCell(7).numFmt = '#,##0';
    secTotRow.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
    secTotRow.getCell(8).numFmt = '#,##0';
    secTotRow.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };

    // Table 2: Quarter-wise Tax Credit Schedule (100% Live SUMIFS/COUNTIFS formulas referencing '26AS')
    const qTitleRowNum = secTotRowNum + 3;
    sqWs.mergeCells(`A${qTitleRowNum}:P${qTitleRowNum}`);
    const qTitle = sqWs.getCell(`A${qTitleRowNum}`);
    qTitle.value = 'QUARTER-WISE TAX CREDIT SCHEDULE (LIVE SUMIFS / COUNTIFS FORMULAS ACROSS Q1 – Q4)';
    qTitle.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: STYLE_COLORS.headerText },
    };
    qTitle.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: STYLE_COLORS.headerFill },
    };
    qTitle.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    sqWs.getRow(qTitleRowNum).height = 24;

    const qHdr = sqWs.getRow(qTitleRowNum + 1);
    qHdr.values = [
      'Sr No',
      'Fiscal Quarter',
      'Tax Role Split',
      'Quarter Coverage',
      'Due Statement',
      'Schedule Basis',
      'Total Txns',
      'Reversals',
      'Gross Credit Paid',
      'Reversal Paid',
      'Net Paid / Received',
      'TDS (Deductors)',
      'TCS (Collectors)',
      'Total Deposited',
      'Short Deposit Diff',
      'Effective Rate %',
    ];
    styleTableHeader(qHdr, 16);

    const quarterOrder: Array<{
      key: ReturnType<typeof getFiscalQuarter>;
      coverage: string;
      dueNote: string;
    }> = [
      { key: 'Q1 (Apr-Jun)', coverage: '01-Apr to 30-Jun', dueNote: 'Q1 Statement' },
      { key: 'Q2 (Jul-Sep)', coverage: '01-Jul to 30-Sep', dueNote: 'Q2 Statement' },
      { key: 'Q3 (Oct-Dec)', coverage: '01-Oct to 31-Dec', dueNote: 'Q3 Statement' },
      { key: 'Q4 (Jan-Mar)', coverage: '01-Jan to 31-Mar', dueNote: 'Q4 Statement' },
      { key: 'Other / Unspecified', coverage: 'Summary / Undated entries', dueNote: 'Other' },
    ];

    const qStats = new Map<
      string,
      {
        txns: number;
        revs: number;
        grossPaid: number;
        revPaid: number;
        paid: number;
        tds: number;
        tcs: number;
        dep: number;
      }
    >();
    quarterOrder.forEach((q) => {
      qStats.set(q.key, { txns: 0, revs: 0, grossPaid: 0, revPaid: 0, paid: 0, tds: 0, tcs: 0, dep: 0 });
    });

    parsed.transactions.forEach((tx) => {
      const q = getFiscalQuarter(tx.transactionDate);
      const bucket = qStats.get(q)!;
      const isRev = tx.entryNature === 'Reversal' || tx.amountPaid < 0 || tx.taxDeducted < 0;
      bucket.txns += 1;
      if (isRev) {
        bucket.revs += 1;
        bucket.revPaid = round2(bucket.revPaid + tx.amountPaid);
      } else {
        bucket.grossPaid = round2(bucket.grossPaid + tx.amountPaid);
      }
      bucket.paid = round2(bucket.paid + tx.amountPaid);
      if (tx.partyType === 'Collector') {
        bucket.tcs = round2(bucket.tcs + tx.taxDeducted);
      } else {
        bucket.tds = round2(bucket.tds + tx.taxDeducted);
      }
      bucket.dep = round2(bucket.dep + tx.tdsDeposited);
    });

    const activeQuarters = quarterOrder.filter(
      (q) => q.key !== 'Other / Unspecified' || (qStats.get(q.key)?.txns ?? 0) > 0
    );
    const qStartRow = qTitleRowNum + 2;
    activeQuarters.forEach((q, idx) => {
      const rNum = qStartRow + idx;
      const st = qStats.get(q.key)!;
      const r = sqWs.getRow(rNum);
      const qShortDiff = round2(st.tds + st.tcs - st.dep);
      const qEffRate = calcRateDecimal(st.tds + st.tcs, st.paid);

      r.values = [
        idx + 1,
        q.key,
        st.tds !== 0 && st.tcs !== 0
          ? 'TDS + TCS'
          : st.tcs !== 0
            ? 'TCS Only'
            : st.tds !== 0
              ? 'TDS Only'
              : '-',
        q.coverage,
        q.dueNote,
        useLive26AS ? "Live from '26AS'" : 'Static Aggregated',
        useLive26AS
          ? {
              formula: `COUNTIF('26AS'!$J$${txStartRow}:$J$${txEndRow},B${rNum})`,
              result: st.txns,
            }
          : st.txns,
        useLive26AS
          ? {
              formula: `COUNTIFS('26AS'!$J$${txStartRow}:$J$${txEndRow},B${rNum},'26AS'!$N$${txStartRow}:$N$${txEndRow},"Reversal")`,
              result: st.revs,
            }
          : st.revs,
        useLive26AS
          ? {
              formula: `SUMIFS('26AS'!$O$${txStartRow}:$O$${txEndRow},'26AS'!$J$${txStartRow}:$J$${txEndRow},B${rNum},'26AS'!$N$${txStartRow}:$N$${txEndRow},"Credit")`,
              result: st.grossPaid,
            }
          : st.grossPaid,
        useLive26AS
          ? {
              formula: `SUMIFS('26AS'!$O$${txStartRow}:$O$${txEndRow},'26AS'!$J$${txStartRow}:$J$${txEndRow},B${rNum},'26AS'!$N$${txStartRow}:$N$${txEndRow},"Reversal")`,
              result: st.revPaid,
            }
          : st.revPaid,
        useLive26AS
          ? {
              formula: `SUMIF('26AS'!$J$${txStartRow}:$J$${txEndRow},B${rNum},'26AS'!$O$${txStartRow}:$O$${txEndRow})`,
              result: st.paid,
            }
          : st.paid,
        useLive26AS
          ? {
              formula: `SUMIFS('26AS'!$P$${txStartRow}:$P$${txEndRow},'26AS'!$J$${txStartRow}:$J$${txEndRow},B${rNum},'26AS'!$D$${txStartRow}:$D$${txEndRow},"Deductor")`,
              result: st.tds,
            }
          : st.tds,
        useLive26AS
          ? {
              formula: `SUMIFS('26AS'!$P$${txStartRow}:$P$${txEndRow},'26AS'!$J$${txStartRow}:$J$${txEndRow},B${rNum},'26AS'!$D$${txStartRow}:$D$${txEndRow},"Collector")`,
              result: st.tcs,
            }
          : st.tcs,
        useLive26AS
          ? {
              formula: `SUMIF('26AS'!$J$${txStartRow}:$J$${txEndRow},B${rNum},'26AS'!$Q$${txStartRow}:$Q$${txEndRow})`,
              result: st.dep,
            }
          : st.dep,
        {
          formula: `ROUND((L${rNum}+M${rNum})-N${rNum},2)`,
          result: qShortDiff,
        },
        {
          formula: `IF(K${rNum}=0,0,ROUND((L${rNum}+M${rNum})/K${rNum},4))`,
          result: qEffRate,
        },
      ];
      r.height = 20;
      r.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      r.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
      r.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
      r.getCell(7).numFmt = '#,##0';
      r.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
      r.getCell(8).numFmt = '#,##0';
      r.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
      for (let c = 9; c <= 15; c++) {
        r.getCell(c).numFmt = INR_FMT;
        r.getCell(c).alignment = { horizontal: 'right', vertical: 'middle' };
      }
      r.getCell(16).numFmt = PCT_FMT;
      r.getCell(16).alignment = { horizontal: 'right', vertical: 'middle' };
      applyThinBorders(r, 16);
    });

    const qEndRow = qStartRow + activeQuarters.length - 1;
    const qTotRowNum = qEndRow + 1;
    const qTotRow = sqWs.getRow(qTotRowNum);
    const totalTdsOnly = round2(
      parsed.transactions
        .filter((t) => t.partyType !== 'Collector')
        .reduce((s, t) => s + t.taxDeducted, 0)
    );
    const totalTcsOnly = round2(
      parsed.transactions
        .filter((t) => t.partyType === 'Collector')
        .reduce((s, t) => s + t.taxDeducted, 0)
    );
    qTotRow.values = [
      'TOTAL',
      'Full Fiscal Year',
      '',
      '',
      '',
      '',
      { formula: `SUM(G${qStartRow}:G${qEndRow})`, result: parsed.transactions.length },
      { formula: `SUM(H${qStartRow}:H${qEndRow})`, result: totalRevsCount },
      { formula: `SUM(I${qStartRow}:I${qEndRow})`, result: totalGrossAmount },
      { formula: `SUM(J${qStartRow}:J${qEndRow})`, result: totalReversalAmount },
      { formula: `SUM(K${qStartRow}:K${qEndRow})`, result: totalAmount },
      { formula: `SUM(L${qStartRow}:L${qEndRow})`, result: totalTdsOnly },
      { formula: `SUM(M${qStartRow}:M${qEndRow})`, result: totalTcsOnly },
      { formula: `SUM(N${qStartRow}:N${qEndRow})`, result: totalDeposited },
      { formula: `SUM(O${qStartRow}:O${qEndRow})`, result: totalShortDiff },
      {
        formula: `IF(K${qTotRowNum}=0,0,ROUND((L${qTotRowNum}+M${qTotRowNum})/K${qTotRowNum},4))`,
        result: calcRateDecimal(totalDeducted, totalAmount),
      },
    ];
    styleTotalRow(qTotRow, 16, [9, 10, 11, 12, 13, 14, 15], [16]);
    qTotRow.getCell(7).numFmt = '#,##0';
    qTotRow.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
    qTotRow.getCell(8).numFmt = '#,##0';
    qTotRow.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };

    // Table 3: Remark Legend & Entry Nature Audit (Live COUNTIF / SUMIF referencing '26AS')
    const rTitleRowNum = qTotRowNum + 3;
    sqWs.mergeCells(`A${rTitleRowNum}:P${rTitleRowNum}`);
    const rTitle = sqWs.getCell(`A${rTitleRowNum}`);
    rTitle.value = 'REMARK CODE & BOOKING STATUS RECONCILIATION (CREDITS VS REPROCESSING / REVERSALS)';
    rTitle.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: STYLE_COLORS.headerText },
    };
    rTitle.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: STYLE_COLORS.headerFill },
    };
    rTitle.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    sqWs.getRow(rTitleRowNum).height = 24;

    const rHdr = sqWs.getRow(rTitleRowNum + 1);
    rHdr.values = [
      'Sr',
      'Remark Code',
      'Code Meaning',
      'Category',
      'Impact on Credit',
      'Audit Note',
      'Txns',
      'Share %',
      'Gross / Regular',
      'Reversal Amt',
      'Net Paid / Received',
      'Net Tax Ded/Col',
      'Net Deposited',
      'Short Deposit Diff',
      'Eff Rate %',
      'Status',
    ];
    styleTableHeader(rHdr, 16);

    const REMARK_DESCRIPTIONS: Record<string, { meaning: string; category: string; impact: string }> = {
      '-': {
        meaning: 'Standard Deducted / Collected Entry',
        category: 'Normal Booking',
        impact: 'Positive tax credit',
      },
      G: {
        meaning: 'Reprocessing of Statement (Negative Adjustment)',
        category: 'Reprocessing Reversal',
        impact: 'Offsets earlier entry',
      },
      B: {
        meaning: 'Rectification of Error in Statement by Deductor',
        category: 'Revised Correction',
        impact: 'Corrects wrong entry',
      },
      F: {
        meaning: 'Lower / No Deduction Certificate u/s 395 / 197',
        category: 'Lower Rate Certificate',
        impact: 'Reduced TDS rate',
      },
      A: {
        meaning: 'Rectification of Error in Challan by Bank',
        category: 'Bank Challan Edit',
        impact: 'Adjustment',
      },
      T: {
        meaning: 'Transporter Exemption u/s 393(6) / 194C(6)',
        category: 'Transporter',
        impact: 'Nil/Special',
      },
    };

    const remarkMap = new Map<
      string,
      { code: string; txns: number; regPaid: number; revPaid: number; paid: number; tax: number; dep: number }
    >();
    parsed.transactions.forEach((tx) => {
      const code = (tx.remarks || '-').trim() || '-';
      const isRev = tx.entryNature === 'Reversal' || tx.amountPaid < 0;
      const prev = remarkMap.get(code);
      if (prev) {
        prev.txns += 1;
        if (isRev) prev.revPaid = round2(prev.revPaid + tx.amountPaid);
        else prev.regPaid = round2(prev.regPaid + tx.amountPaid);
        prev.paid = round2(prev.paid + tx.amountPaid);
        prev.tax = round2(prev.tax + tx.taxDeducted);
        prev.dep = round2(prev.dep + tx.tdsDeposited);
      } else {
        remarkMap.set(code, {
          code,
          txns: 1,
          regPaid: isRev ? 0 : round2(tx.amountPaid),
          revPaid: isRev ? round2(tx.amountPaid) : 0,
          paid: round2(tx.amountPaid),
          tax: round2(tx.taxDeducted),
          dep: round2(tx.tdsDeposited),
        });
      }
    });

    const remarkRows = Array.from(remarkMap.values()).sort((a, b) => b.txns - a.txns);
    const remStart = rTitleRowNum + 2;
    remarkRows.forEach((rm, idx) => {
      const rNum = remStart + idx;
      const r = sqWs.getRow(rNum);
      const info = REMARK_DESCRIPTIONS[rm.code.toUpperCase()] ?? {
        meaning: `TRACES Remark "${rm.code}"`,
        category: 'Statement Remark',
        impact: 'Review entry',
      };
      const share = parsed.transactions.length > 0 ? Number((rm.txns / parsed.transactions.length).toFixed(4)) : 0;

      r.values = [
        idx + 1,
        rm.code,
        info.meaning,
        info.category,
        info.impact,
        useLive26AS ? "Live from '26AS'" : 'Static Aggregated',
        useLive26AS
          ? { formula: `COUNTIF('26AS'!$M$${txStartRow}:$M$${txEndRow},B${rNum})`, result: rm.txns }
          : rm.txns,
        parsed.transactions.length > 0
          ? { formula: `G${rNum}/${parsed.transactions.length}`, result: share }
          : 0,
        useLive26AS
          ? {
              formula: `SUMIFS('26AS'!$O$${txStartRow}:$O$${txEndRow},'26AS'!$M$${txStartRow}:$M$${txEndRow},B${rNum},'26AS'!$N$${txStartRow}:$N$${txEndRow},"Credit")`,
              result: rm.regPaid,
            }
          : rm.regPaid,
        useLive26AS
          ? {
              formula: `SUMIFS('26AS'!$O$${txStartRow}:$O$${txEndRow},'26AS'!$M$${txStartRow}:$M$${txEndRow},B${rNum},'26AS'!$N$${txStartRow}:$N$${txEndRow},"Reversal")`,
              result: rm.revPaid,
            }
          : rm.revPaid,
        useLive26AS
          ? { formula: `SUMIF('26AS'!$M$${txStartRow}:$M$${txEndRow},B${rNum},'26AS'!$O$${txStartRow}:$O$${txEndRow})`, result: rm.paid }
          : rm.paid,
        useLive26AS
          ? { formula: `SUMIF('26AS'!$M$${txStartRow}:$M$${txEndRow},B${rNum},'26AS'!$P$${txStartRow}:$P$${txEndRow})`, result: rm.tax }
          : rm.tax,
        useLive26AS
          ? { formula: `SUMIF('26AS'!$M$${txStartRow}:$M$${txEndRow},B${rNum},'26AS'!$Q$${txStartRow}:$Q$${txEndRow})`, result: rm.dep }
          : rm.dep,
        { formula: `ROUND(L${rNum}-M${rNum},2)`, result: round2(rm.tax - rm.dep) },
        { formula: `IF(K${rNum}=0,0,ROUND(L${rNum}/K${rNum},4))`, result: calcRateDecimal(rm.tax, rm.paid) },
        rm.code === 'G' || rm.code === 'B' ? 'Adjusted' : 'Active',
      ];
      r.height = 20;
      r.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      r.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
      r.getCell(2).font = { bold: true };
      r.getCell(7).numFmt = '#,##0';
      r.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
      r.getCell(8).numFmt = PCT_FMT;
      r.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
      for (let c = 9; c <= 14; c++) {
        r.getCell(c).numFmt = INR_FMT;
        r.getCell(c).alignment = { horizontal: 'right', vertical: 'middle' };
      }
      r.getCell(15).numFmt = PCT_FMT;
      r.getCell(15).alignment = { horizontal: 'right', vertical: 'middle' };
      r.getCell(16).alignment = { horizontal: 'center', vertical: 'middle' };
      applyThinBorders(r, 16);
    });

    // Table 4: Month-by-Month (Apr–Mar) Bifurcated TDS vs TCS Matrix
    const lastSqRow = sqWs.lastRow ? sqWs.lastRow.number : rTitleRowNum + 3;
    const mTitleRowNum = lastSqRow + 3;
    sqWs.mergeCells(`A${mTitleRowNum}:P${mTitleRowNum}`);
    const mTitle = sqWs.getCell(`A${mTitleRowNum}`);
    mTitle.value = 'MONTH-WISE TDS vs TCS BIFURCATION MATRIX (APRIL TO MARCH)';
    mTitle.font = { name: 'Calibri', size: 11, bold: true, color: { argb: STYLE_COLORS.headerText } };
    mTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STYLE_COLORS.headerFill } };
    mTitle.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    sqWs.getRow(mTitleRowNum).height = 24;

    const mHdr = sqWs.getRow(mTitleRowNum + 1);
    mHdr.values = [
      'Sr',
      'Fiscal Month',
      'Quarter',
      'Scope Mix',
      'TDS Parties',
      'TCS Parties',
      'TDS Txns',
      'TCS Txns',
      'TDS Basis Paid',
      'TCS Basis Amt',
      'Total Basis Paid',
      'TDS Deducted',
      'TCS Collected',
      'Total Deposited',
      'Eff Rate %',
      'Status',
    ];
    styleTableHeader(mHdr, 16);

    const monthAgg = new Map<
      string,
      {
        tdsParties: Set<string>;
        tcsParties: Set<string>;
        tdsTxns: number;
        tcsTxns: number;
        tdsPaid: number;
        tcsPaid: number;
        tdsTax: number;
        tcsTax: number;
        dep: number;
      }
    >();
    [...FISCAL_MONTH_ORDER, 'Unspecified'].forEach((m) =>
      monthAgg.set(m, {
        tdsParties: new Set(),
        tcsParties: new Set(),
        tdsTxns: 0,
        tcsTxns: 0,
        tdsPaid: 0,
        tcsPaid: 0,
        tdsTax: 0,
        tcsTax: 0,
        dep: 0,
      })
    );

    parsed.transactions.forEach((tx) => {
      const m = getFiscalMonthLabel(tx.transactionDate);
      const st = monthAgg.get(m) ?? monthAgg.get('Unspecified')!;
      if (classify26ASTaxType(tx) === 'TCS') {
        st.tcsParties.add(tx.tan);
        st.tcsTxns += 1;
        st.tcsPaid = round2(st.tcsPaid + tx.amountPaid);
        st.tcsTax = round2(st.tcsTax + tx.taxDeducted);
      } else {
        st.tdsParties.add(tx.tan);
        st.tdsTxns += 1;
        st.tdsPaid = round2(st.tdsPaid + tx.amountPaid);
        st.tdsTax = round2(st.tdsTax + tx.taxDeducted);
      }
      st.dep = round2(st.dep + tx.tdsDeposited);
    });

    const mStartRow = mTitleRowNum + 2;
    const monthsToRender = [
      ...FISCAL_MONTH_ORDER,
      ...((monthAgg.get('Unspecified')?.tdsTxns ?? 0) + (monthAgg.get('Unspecified')?.tcsTxns ?? 0) > 0
        ? ['Unspecified']
        : []),
    ];
    const qLookup = (m: string) =>
      ['Apr', 'May', 'Jun'].includes(m)
        ? 'Q1'
        : ['Jul', 'Aug', 'Sep'].includes(m)
          ? 'Q2'
          : ['Oct', 'Nov', 'Dec'].includes(m)
            ? 'Q3'
            : ['Jan', 'Feb', 'Mar'].includes(m)
              ? 'Q4'
              : '-';

    monthsToRender.forEach((m, idx) => {
      const st = monthAgg.get(m)!;
      const rNum = mStartRow + idx;
      const r = sqWs.getRow(rNum);
      const combPaid = round2(st.tdsPaid + st.tcsPaid);
      const combTax = round2(st.tdsTax + st.tcsTax);
      const mix =
        st.tdsTxns > 0 && st.tcsTxns > 0
          ? 'TDS + TCS'
          : st.tcsTxns > 0
            ? 'TCS Only'
            : st.tdsTxns > 0
              ? 'TDS Only'
              : 'Nil';

      r.values = [
        idx + 1,
        m,
        qLookup(m),
        mix,
        st.tdsParties.size,
        st.tcsParties.size,
        st.tdsTxns,
        st.tcsTxns,
        st.tdsPaid,
        st.tcsPaid,
        { formula: `I${rNum}+J${rNum}`, result: combPaid },
        st.tdsTax,
        st.tcsTax,
        st.dep,
        { formula: `IF(K${rNum}=0,0,ROUND((L${rNum}+M${rNum})/K${rNum},4))`, result: calcRateDecimal(combTax, combPaid) },
        st.tdsTxns + st.tcsTxns > 0 ? 'Active' : 'No Entries',
      ];
      r.height = 19;
      r.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      r.getCell(2).font = { bold: true };
      r.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
      r.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
      for (const c of [5, 6, 7, 8]) {
        r.getCell(c).numFmt = '#,##0';
        r.getCell(c).alignment = { horizontal: 'right', vertical: 'middle' };
      }
      for (let c = 9; c <= 14; c++) {
        r.getCell(c).numFmt = INR_FMT;
        r.getCell(c).alignment = { horizontal: 'right', vertical: 'middle' };
      }
      r.getCell(15).numFmt = PCT_FMT;
      r.getCell(15).alignment = { horizontal: 'right', vertical: 'middle' };
      r.getCell(16).alignment = { horizontal: 'center', vertical: 'middle' };
      applyThinBorders(r, 16);
    });

    const mEndRow = mStartRow + monthsToRender.length - 1;
    const mTotRowNum = mEndRow + 1;
    const mTotRow = sqWs.getRow(mTotRowNum);
    mTotRow.values = [
      'TOTAL',
      'Full FY (Apr-Mar)',
      'Q1–Q4',
      '',
      '',
      '',
      { formula: `SUM(G${mStartRow}:G${mEndRow})`, result: parsed.transactions.filter((t) => classify26ASTaxType(t) === 'TDS').length },
      { formula: `SUM(H${mStartRow}:H${mEndRow})`, result: parsed.transactions.filter((t) => classify26ASTaxType(t) === 'TCS').length },
      { formula: `SUM(I${mStartRow}:I${mEndRow})`, result: round2(parsed.transactions.filter((t) => classify26ASTaxType(t) === 'TDS').reduce((s, t) => s + t.amountPaid, 0)) },
      { formula: `SUM(J${mStartRow}:J${mEndRow})`, result: round2(parsed.transactions.filter((t) => classify26ASTaxType(t) === 'TCS').reduce((s, t) => s + t.amountPaid, 0)) },
      { formula: `SUM(K${mStartRow}:K${mEndRow})`, result: totalAmount },
      { formula: `SUM(L${mStartRow}:L${mEndRow})`, result: totalTdsOnly },
      { formula: `SUM(M${mStartRow}:M${mEndRow})`, result: totalTcsOnly },
      { formula: `SUM(N${mStartRow}:N${mEndRow})`, result: totalDeposited },
      { formula: `IF(K${mTotRowNum}=0,0,ROUND((L${mTotRowNum}+M${mTotRowNum})/K${mTotRowNum},4))`, result: calcRateDecimal(totalDeducted, totalAmount) },
      '',
    ];
    styleTotalRow(mTotRow, 16, [9, 10, 11, 12, 13, 14], [15]);
    mTotRow.getCell(7).numFmt = '#,##0';
    mTotRow.getCell(8).numFmt = '#,##0';
  }

  // =========================================================================
  // 4. AUDIT & EXCEPTIONS SHEET (REVERSALS, MISSING PANs & EXCEPTIONS)
  // =========================================================================
  if (includeAudit) {
    emitProgress(88, 'Generating Audit, Missing PAN & Reversal Exceptions sheet...');
    const auWs = wb.addWorksheet('Audit & Exceptions', {
      views: [{ state: 'frozen', ySplit: 4 }],
    });

    auWs.columns = [
      { key: 'sr', width: 7 }, // A
      { key: 'category', width: 25 }, // B
      { key: 'txRef', width: 10 }, // C
      { key: 'part', width: 17 }, // D
      { key: 'partyName', width: 34 }, // E
      { key: 'tan', width: 14 }, // F
      { key: 'partyPan', width: 14 }, // G
      { key: 'section', width: 15 }, // H
      { key: 'txDate', width: 13 }, // I
      { key: 'remarks', width: 14 }, // J
      { key: 'amountPaid', width: 19 }, // K
      { key: 'taxDeducted', width: 19 }, // L
      { key: 'tdsDeposited', width: 19 }, // M
      { key: 'shortDiff', width: 16 }, // N
    ];

    auWs.mergeCells('A1:N1');
    const titleCell = auWs.getCell('A1');
    titleCell.value = `FORM 26AS AUDIT, MISSING PAN & EXCEPTIONS REPORT — ${parsed.assesseeName} (${parsed.pan} · ${yearBannerTag})`;
    titleCell.font = {
      name: 'Calibri',
      size: 13,
      bold: true,
      color: { argb: STYLE_COLORS.headerText },
    };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: STYLE_COLORS.headerFill },
    };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    auWs.getRow(1).height = 28;

    const varianceParties = parsed.parties.filter((p) => p.verificationStatus !== 'Verified');
    const missingPanParties = parsed.parties.filter((p) => !p.partyPan || p.partyPan === '-');
    const reversalTxs = parsed.transactions.filter(
      (t) =>
        t.entryNature === 'Reversal' ||
        t.amountPaid < 0 ||
        t.taxDeducted < 0 ||
        t.tdsDeposited < 0 ||
        /^(?:G|B)$/i.test(t.remarks.trim())
    );
    const exceptionTxs = parsed.transactions.filter(
      (t) => !isFinalBookingStatus(t.bookingStatus) || Math.abs(t.taxDeducted - t.tdsDeposited) > 0.01
    );

    auWs.mergeCells('A2:N2');
    const statusCell = auWs.getCell('A2');
    const allClean = varianceParties.length === 0 && exceptionTxs.length === 0;
    statusCell.value = allClean
      ? `VERIFIED CLEAN: All ${parsed.parties.length} party subtotals match PDF totals (₹0.00 variance). Reversals (G/B): ${reversalTxs.length} | Parties missing PAN: ${missingPanParties.length}.`
      : `AUDIT ALERT: ${varianceParties.length} subtotal variance(s), ${exceptionTxs.length} unmatched/short-deposit row(s), ${reversalTxs.length} reversal entry/entries, ${missingPanParties.length} missing PAN(s).`;
    statusCell.font = {
      name: 'Calibri',
      size: 10,
      bold: true,
      color: { argb: allClean ? STYLE_COLORS.okText : STYLE_COLORS.warnText },
    };
    statusCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: allClean ? STYLE_COLORS.okFill : STYLE_COLORS.warnFill },
    };
    statusCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    auWs.getRow(2).height = 22;

    const hdr = auWs.getRow(4);
    hdr.values = [
      'Sr No',
      'Audit Flag',
      '26AS Ref',
      'Part',
      'Deductor / Collector Name',
      'TAN',
      'PAN of Party',
      'Section / Status',
      'Txn Date',
      'Remarks',
      'Amount Paid / Reported',
      'Tax Deducted / Extracted',
      'Deposited',
      'Diff / Variance',
    ];
    styleTableHeader(hdr, 14);

    let cursorRow = 5;
    let srCounter = 1;

    const appendAuditRow = (
      vals: (string | number | { formula: string; result: number })[],
      flagType: 'ok' | 'warn' | 'alert' | 'info'
    ) => {
      const r = auWs.getRow(cursorRow);
      r.values = vals;
      r.height = 20;
      r.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      r.getCell(3).numFmt = '@';
      r.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
      r.getCell(6).numFmt = '@';
      r.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
      r.getCell(7).numFmt = '@';
      r.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };
      r.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };
      const flagCell = r.getCell(2);
      flagCell.font = {
        bold: true,
        color: {
          argb:
            flagType === 'ok'
              ? STYLE_COLORS.okText
              : flagType === 'alert'
                ? STYLE_COLORS.alertText
                : flagType === 'info'
                  ? STYLE_COLORS.linkBlue
                  : STYLE_COLORS.warnText,
        },
      };
      flagCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: {
          argb:
            flagType === 'ok'
              ? STYLE_COLORS.okFill
              : flagType === 'alert'
                ? STYLE_COLORS.alertFill
                : flagType === 'info'
                  ? STYLE_COLORS.subHeaderFill
                  : STYLE_COLORS.warnFill,
        },
      };
      for (let c = 11; c <= 14; c++) {
        r.getCell(c).numFmt = INR_FMT;
        r.getCell(c).alignment = { horizontal: 'right', vertical: 'middle' };
      }
      applyThinBorders(r, 14);
      cursorRow += 1;
      srCounter += 1;
    };

    varianceParties.forEach((p) => {
      appendAuditRow(
        [
          srCounter,
          p.verificationStatus,
          String(p.srNo),
          p.part,
          p.partyName,
          p.tan,
          p.partyPan || '-',
          `${p.transactionCount} txns`,
          '-',
          'PDF vs Extracted',
          p.reportedTaxDeducted,
          p.extractedTaxDeducted,
          p.extractedTdsDeposited,
          round2(p.reportedTaxDeducted - p.extractedTaxDeducted),
        ],
        'alert'
      );
    });

    exceptionTxs.forEach((tx) => {
      const diff = round2(tx.taxDeducted - tx.tdsDeposited);
      appendAuditRow(
        [
          srCounter,
          diff !== 0 ? 'Short / Excess Deposit' : `Unmatched Status (${tx.bookingStatus})`,
          tx.txSrNo || `${tx.srNo}`,
          tx.part,
          tx.partyName,
          tx.tan,
          tx.partyPan || '-',
          `${tx.section} (${tx.bookingStatus})`,
          tx.transactionDate,
          tx.remarks,
          tx.amountPaid,
          tx.taxDeducted,
          tx.tdsDeposited,
          diff,
        ],
        'alert'
      );
    });

    missingPanParties.forEach((p) => {
      appendAuditRow(
        [
          srCounter,
          'Missing Party PAN (Only TAN)',
          String(p.srNo),
          p.part,
          p.partyName,
          p.tan,
          '-',
          `${p.transactionCount} txns`,
          '-',
          'Not in 26AS',
          p.extractedAmountPaid,
          p.extractedTaxDeducted,
          p.extractedTdsDeposited,
          round2(p.extractedTaxDeducted - p.extractedTdsDeposited),
        ],
        'info'
      );
    });

    reversalTxs.forEach((tx) => {
      const txRole = classify26ASTaxType(tx);
      appendAuditRow(
        [
          srCounter,
          `[${txRole}] Reversal Entry (Remark ${tx.remarks})`,
          tx.txSrNo || `${tx.srNo}`,
          tx.part,
          tx.partyName,
          tx.tan,
          tx.partyPan || '-',
          `${tx.section} (${tx.bookingStatus})`,
          tx.transactionDate,
          tx.remarks,
          tx.amountPaid,
          tx.taxDeducted,
          tx.tdsDeposited,
          round2(tx.taxDeducted - tx.tdsDeposited),
        ],
        'warn'
      );
    });

    // Statutory Rate Deviation check (>2.5% diff vs fixed statutory rate on positive rows)
    const rateDeviationTxs = parsed.transactions.filter((tx) => {
      if (tx.entryNature === 'Reversal' || tx.amountPaid <= 0) return false;
      const meta = lookupSectionMeta(tx.section);
      if (meta.standardRatePct === null) return false;
      const effPct = (tx.taxDeducted / tx.amountPaid) * 100;
      return Math.abs(effPct - meta.standardRatePct) > 2.5;
    });
    rateDeviationTxs.slice(0, 150).forEach((tx) => {
      const meta = lookupSectionMeta(tx.section);
      const txRole = classify26ASTaxType(tx);
      const effPct = ((tx.taxDeducted / tx.amountPaid) * 100).toFixed(2);
      appendAuditRow(
        [
          srCounter,
          `[${txRole}] Rate Variance (${effPct}% vs Std ${meta.standardRatePct}%)`,
          tx.txSrNo || `${tx.srNo}`,
          tx.part,
          tx.partyName,
          tx.tan,
          tx.partyPan || '-',
          `${tx.section} (${meta.oldActEq})`,
          tx.transactionDate,
          tx.remarks,
          tx.amountPaid,
          tx.taxDeducted,
          tx.tdsDeposited,
          round2(tx.taxDeducted - (tx.amountPaid * (meta.standardRatePct ?? 0)) / 100),
        ],
        'info'
      );
    });

    if (srCounter === 1) {
      appendAuditRow(
        [
          1,
          'All Subtotals Verified',
          '-',
          'ALL PARTS',
          `${parsed.parties.length} party account(s) checked`,
          '-',
          '-',
          '-',
          '-',
          'Zero exceptions',
          totalAmount,
          totalDeducted,
          totalDeposited,
          totalShortDiff,
        ],
        'ok'
      );
    }
  }

  // =========================================================================
  // 5. TAX PAID / ADVANCE TAX CHALLANS SHEET (IF DETECTED)
  // =========================================================================
  if (parsed.challans.length > 0) {
    const chWs = wb.addWorksheet('Tax Paid (Challans)', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    chWs.columns = [
      { header: 'Sr No', key: 'sr', width: 8 },
      { header: 'Part', key: 'part', width: 22 },
      { header: 'BSR Code', key: 'bsr', width: 14 },
      { header: 'Date of Deposit', key: 'date', width: 16 },
      { header: 'Challan Serial No', key: 'serial', width: 18 },
      { header: 'Major Head', key: 'major', width: 14 },
      { header: 'Minor Head', key: 'minor', width: 14 },
      { header: 'Total Tax Paid (Rs)', key: 'tax', width: 20 },
      { header: 'Remarks', key: 'remarks', width: 24 },
    ];
    styleTableHeader(chWs.getRow(1), 9);

    parsed.challans.forEach((ch) => {
      const r = chWs.addRow([
        ch.srNo,
        ch.part,
        ch.bsrCode,
        ch.depositDate,
        ch.challanSerial,
        ch.majorHead,
        ch.minorHead,
        ch.totalTax,
        ch.remarks,
      ]);
      r.height = 20;
      r.getCell(8).numFmt = INR_FMT;
      r.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
      applyThinBorders(r, 9);
    });

    const totalChallan = round2(parsed.challans.reduce((s, c) => s + c.totalTax, 0));
    const endChRow = 1 + parsed.challans.length;
    const chTotRow = chWs.addRow([
      'TOTAL',
      `${parsed.challans.length} challan(s)`,
      '',
      '',
      '',
      '',
      '',
      { formula: `SUM(H2:H${endChRow})`, result: totalChallan },
      '',
    ]);
    styleTotalRow(chTotRow, 9, [8]);
  }

  emitProgress(96, 'Finalizing Excel .xlsx XML stream...');
  const buf = await wb.xlsx.writeBuffer();
  emitProgress(100, 'Workbook ready');
  return buf as ArrayBuffer;
}
