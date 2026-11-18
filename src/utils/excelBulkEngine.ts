import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import {
  BankFormState,
  BankFormType,
  BankId,
  createInitialBankFormState,
} from './bankSlipRenderers';

export const MAX_BULK_ROWS = 25;

export interface BulkChequeEntry {
  chequeNo?: string;
  draweeBank?: string;
  amount?: number;
}

export interface BulkSlipRecord {
  rowNumber: number;
  date: string;
  branch: string;
  accountNo: string;
  name: string;
  phone: string;
  pan: string;
  depositType: 'cash' | 'cheque' | 'both';
  amount: number;
  d500: number;
  d200: number;
  d100: number;
  d50: number;
  d20: number;
  d10: number;
  d5: number;
  d2: number;
  d1: number;
  coins: number;
  chequeNo: string;
  chequeDate: string;
  draweeBank: string;
  cheques?: BulkChequeEntry[];
  transferType: 'rtgs' | 'neft';
  benName: string;
  benBank: string;
  benIfsc: string;
  benAccountNo: string;
  inFavourOf: string;
  payableAt: string;
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface BulkValidationResult {
  success: boolean;
  error?: string;
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  totalWarnings?: number;
  records: BulkSlipRecord[];
}

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

function isValidIsoCalendarDate(iso: string): boolean {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === mo - 1 &&
    dt.getUTCDate() === d
  );
}

function normalizeDateCell(
  raw: unknown,
  fallbackToday = false
): { date: string; valid: boolean; wasEmpty: boolean } {
  const today = new Date().toISOString().split('T')[0];
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return { date: fallbackToday ? today : '', valid: true, wasEmpty: true };
  }
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 1 && raw < 2958465) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const dt = new Date(epoch.getTime() + Math.round(raw) * 86400000);
    if (!isNaN(dt.getTime())) {
      const iso = dt.toISOString().split('T')[0];
      return { date: iso, valid: isValidIsoCalendarDate(iso), wasEmpty: false };
    }
  }
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return { date: s, valid: isValidIsoCalendarDate(s), wasEmpty: false };
  }
  const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (dmy) {
    const yearStr = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    const iso = `${yearStr}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    return { date: iso, valid: isValidIsoCalendarDate(iso), wasEmpty: false };
  }
  return { date: s, valid: false, wasEmpty: false };
}

function numVal(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function strVal(v: unknown): string {
  return String(v ?? '').trim();
}

export function flattenCanvasToWhiteJpeg(canvas: HTMLCanvasElement, quality = 0.94): string {
  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(canvas, 0, 0);
  }
  return out.toDataURL('image/jpeg', quality);
}

const TEXT_COLUMN_KEYS = new Set([
  'Date',
  'AccountNo',
  'Phone',
  'PAN',
  'ChequeNo',
  'ChequeDate',
  'BeneficiaryIFSC',
  'BeneficiaryAccountNo',
]);

export async function generateBulkExcelTemplate(
  bankId: BankId,
  formType: BankFormType
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  let columns: { header: string; key: string; width: number }[] = [];
  let rows: Record<string, string | number>[] = [];

  if (formType === 'deposit') {
    columns = [
      { header: 'Date', key: 'Date', width: 14 },
      { header: 'Branch', key: 'Branch', width: 20 },
      { header: 'AccountNo', key: 'AccountNo', width: 22 },
      { header: 'Name', key: 'Name', width: 24 },
      { header: 'Phone', key: 'Phone', width: 15 },
      { header: 'PAN', key: 'PAN', width: 14 },
      { header: 'DepositType', key: 'DepositType', width: 14 },
      { header: 'Amount', key: 'Amount', width: 15 },
      { header: 'Note500', key: 'Note500', width: 10 },
      { header: 'Note200', key: 'Note200', width: 10 },
      { header: 'Note100', key: 'Note100', width: 10 },
      { header: 'Note50', key: 'Note50', width: 10 },
      { header: 'Note20', key: 'Note20', width: 10 },
      { header: 'Note10', key: 'Note10', width: 10 },
      { header: 'Note5', key: 'Note5', width: 9 },
      { header: 'Note2', key: 'Note2', width: 9 },
      { header: 'Note1', key: 'Note1', width: 9 },
      { header: 'Coins', key: 'Coins', width: 10 },
      { header: 'ChequeNo', key: 'ChequeNo', width: 14 },
      { header: 'ChequeDate', key: 'ChequeDate', width: 14 },
      { header: 'DraweeBank', key: 'DraweeBank', width: 20 },
    ];
    rows = [
      {
        Date: today,
        Branch: 'Mumbai Main',
        AccountNo: bankId === 'hdfc' ? '50100012345678' : '30123456789',
        Name: 'Aarav Sharma',
        Phone: '9876543210',
        PAN: 'ABCDE1234F',
        DepositType: 'cash',
        Amount: 45000,
        Note500: 80,
        Note200: 20,
        Note100: 10,
        Note50: 0,
        Note20: 0,
        Note10: 0,
        Note5: 0,
        Note2: 0,
        Note1: 0,
        Coins: 0,
        ChequeNo: '',
        ChequeDate: '',
        DraweeBank: '',
      },
      {
        Date: today,
        Branch: 'Mumbai Main',
        AccountNo: bankId === 'hdfc' ? '50200098765432' : '30987654321',
        Name: 'Priya Nair',
        Phone: '9820012345',
        PAN: '',
        DepositType: 'cheque',
        Amount: 25000,
        Note500: 0,
        Note200: 0,
        Note100: 0,
        Note50: 0,
        Note20: 0,
        Note10: 0,
        Note5: 0,
        Note2: 0,
        Note1: 0,
        Coins: 0,
        ChequeNo: '058912',
        ChequeDate: today,
        DraweeBank: 'ICICI Bank',
      },
    ];
  } else if (formType === 'rtgs') {
    columns = [
      { header: 'Date', key: 'Date', width: 14 },
      { header: 'Branch', key: 'Branch', width: 22 },
      { header: 'AccountNo', key: 'AccountNo', width: 22 },
      { header: 'Name', key: 'Name', width: 24 },
      { header: 'Phone', key: 'Phone', width: 15 },
      { header: 'TransferType', key: 'TransferType', width: 14 },
      { header: 'Amount', key: 'Amount', width: 16 },
      { header: 'ChequeNo', key: 'ChequeNo', width: 14 },
      { header: 'ChequeDate', key: 'ChequeDate', width: 14 },
      { header: 'BeneficiaryName', key: 'BeneficiaryName', width: 26 },
      { header: 'BeneficiaryBank', key: 'BeneficiaryBank', width: 26 },
      { header: 'BeneficiaryIFSC', key: 'BeneficiaryIFSC', width: 16 },
      { header: 'BeneficiaryAccountNo', key: 'BeneficiaryAccountNo', width: 22 },
    ];
    rows = [
      {
        Date: today,
        Branch: 'Delhi Connaught Place',
        AccountNo: bankId === 'hdfc' ? '50100012345678' : '30123456789',
        Name: 'Vikram Mehta',
        Phone: '9811122334',
        TransferType: 'rtgs',
        Amount: 250000,
        ChequeNo: '102938',
        ChequeDate: today,
        BeneficiaryName: 'Apex Logistics Pvt Ltd',
        BeneficiaryBank: 'ICICI Bank Nariman Point',
        BeneficiaryIFSC: 'ICIC0000004',
        BeneficiaryAccountNo: '000405009911',
      },
    ];
  } else {
    columns = [
      { header: 'Date', key: 'Date', width: 14 },
      { header: 'Branch', key: 'Branch', width: 22 },
      { header: 'AccountNo', key: 'AccountNo', width: 22 },
      { header: 'Name', key: 'Name', width: 24 },
      { header: 'Phone', key: 'Phone', width: 15 },
      { header: 'PAN', key: 'PAN', width: 14 },
      { header: 'Amount', key: 'Amount', width: 15 },
      { header: 'InFavourOf', key: 'InFavourOf', width: 28 },
      { header: 'PayableAt', key: 'PayableAt', width: 18 },
      { header: 'ChequeNo', key: 'ChequeNo', width: 14 },
      { header: 'ChequeDate', key: 'ChequeDate', width: 14 },
      { header: 'Note500', key: 'Note500', width: 10 },
      { header: 'Note200', key: 'Note200', width: 10 },
      { header: 'Note100', key: 'Note100', width: 10 },
      { header: 'Note50', key: 'Note50', width: 10 },
      { header: 'Note20', key: 'Note20', width: 10 },
      { header: 'Note10', key: 'Note10', width: 10 },
      { header: 'Note5', key: 'Note5', width: 9 },
      { header: 'Note2', key: 'Note2', width: 9 },
      { header: 'Note1', key: 'Note1', width: 9 },
      { header: 'Coins', key: 'Coins', width: 10 },
    ];
    rows = [
      {
        Date: today,
        Branch: 'Bengaluru MG Road',
        AccountNo: bankId === 'hdfc' ? '50100012345678' : '30123456789',
        Name: 'Sneha Kulkarni',
        Phone: '9900112233',
        PAN: '',
        Amount: 15000,
        InFavourOf: 'Registrar VTU Belagavi',
        PayableAt: 'Belagavi',
        ChequeNo: bankId === 'hdfc' ? '332211' : '',
        ChequeDate: bankId === 'hdfc' ? today : '',
        Note500: bankId === 'hdfc' ? 0 : 30,
        Note200: 0,
        Note100: 0,
        Note50: 0,
        Note20: 0,
        Note10: 0,
        Note5: 0,
        Note2: 0,
        Note1: 0,
        Coins: 0,
      },
    ];
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'VCPL Tools — Bank Slip Template';
  wb.created = new Date();

  const ws = wb.addWorksheet('BulkSlips', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  ws.columns = columns;

  // Apply explicit @ text format on ID/account/cheque columns so Excel preserves leading zeros & full digits
  columns.forEach((col, i) => {
    const excelCol = ws.getColumn(i + 1);
    if (TEXT_COLUMN_KEYS.has(col.key)) {
      excelCol.numFmt = '@';
    } else if (col.key === 'Amount' || col.key === 'Coins') {
      excelCol.numFmt = '₹#,##0.00';
    } else if (col.key.startsWith('Note')) {
      excelCol.numFmt = '#,##0';
    }
  });

  const headerRow = ws.getRow(1);
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F3E4E' } };
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  rows.forEach((r) => {
    const added = ws.addRow(r);
    added.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 10 };
    });
  });

  // Instructions sheet
  const guide = wb.addWorksheet('Format & Audit Rules');
  guide.columns = [
    { header: 'Rule / Field', key: 'rule', width: 32 },
    { header: 'Bank & RBI Format Requirement', key: 'detail', width: 78 },
  ];
  const gHdr = guide.getRow(1);
  gHdr.height = 24;
  gHdr.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F3E4E' } };
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  });
  guide.addRows([
    {
      rule: 'Text Columns (@ format)',
      detail: 'AccountNo, ChequeNo, Phone, PAN & BeneficiaryAccountNo are pre-formatted as Text to prevent scientific notation or zero truncation.',
    },
    {
      rule: 'Account Box Capacity',
      detail: `${bankId === 'hdfc' ? 'HDFC Deposit allows 14 digits (16 for RTGS Beneficiary).' : 'SBI Deposit & RTGS Beneficiary allow 17 digits (11 on SBI DD Form).'}`,
    },
    {
      rule: 'Income Tax Rule 114B (PAN)',
      detail: 'Cash Deposits or Cash-funded Demand Drafts >= ₹50,000 require a valid 10-character PAN (ABCDE1234F).',
    },
    {
      rule: 'Cash Tally Check',
      detail: 'When Note500..Note1/Coins are filled alongside Amount, both totals must reconcile within ₹0.50.',
    },
    {
      rule: 'HDFC DD Restriction',
      detail: 'HDFC Bank DD Application Form accepts Payment via Cheque only (mention ChequeNo). Use a separate cash slip at branch.',
    },
    {
      rule: 'RTGS Minimum Threshold',
      detail: 'RBI RTGS requires Amount >= ₹2,00,000. Remittances below ₹2,00,000 must use NEFT.',
    },
    {
      rule: 'Maximum Batch Size',
      detail: `Up to ${MAX_BULK_ROWS} rows per upload for instant browser PDF / ZIP generation.`,
    },
  ]);

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${bankId.toUpperCase()}_${formType.toUpperCase()}_Bulk_Template.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function parseBulkExcelFile(
  file: File,
  bankId: BankId,
  formType: BankFormType
): Promise<BulkValidationResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const firstSheet = wb.SheetNames[0];
  if (!firstSheet) {
    return {
      success: false,
      error: 'Spreadsheet contains no worksheets.',
      totalRecords: 0,
      validRecords: 0,
      invalidRecords: 0,
      totalWarnings: 0,
      records: [],
    };
  }

  const sheet = wb.Sheets[firstSheet];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  if (rawRows.length === 0) {
    return {
      success: false,
      error: 'No data rows found in the uploaded file.',
      totalRecords: 0,
      validRecords: 0,
      invalidRecords: 0,
      totalWarnings: 0,
      records: [],
    };
  }

  const sliced = rawRows.slice(0, MAX_BULK_ROWS);
  const records: BulkSlipRecord[] = sliced.map((r, idx) => {
    const get = (...keys: string[]) => {
      for (const k of keys) {
        const match = Object.keys(r).find(
          (col) => col.toLowerCase().replace(/[^a-z0-9]/g, '') === k.toLowerCase().replace(/[^a-z0-9]/g, '')
        );
        if (match !== undefined && r[match] !== '') return r[match];
      }
      return '';
    };

    const dateRes = normalizeDateCell(get('Date'), true);
    const date = dateRes.date;
    const branch = strVal(get('Branch')) || 'Main Branch';
    const accountNo = strVal(get('AccountNo', 'AccountNumber', 'DebitAccountNo')).replace(/\s+/g, '');
    const name = strVal(get('Name', 'AccountHolderName', 'ApplicantName'));
    const phone = strVal(get('Phone', 'Mobile', 'Contact')).replace(/[^0-9]/g, '');
    const pan = strVal(get('PAN')).toUpperCase().replace(/\s+/g, '');

    const depTypeRaw = strVal(get('DepositType', 'Mode')).toLowerCase();
    const depositType: 'cash' | 'cheque' | 'both' =
      depTypeRaw === 'cheque' ? 'cheque' : depTypeRaw === 'both' ? 'both' : 'cash';

    const d500 = Math.floor(numVal(get('Note500', '500')));
    const d200 = Math.floor(numVal(get('Note200', '200')));
    const d100 = Math.floor(numVal(get('Note100', '100')));
    const d50 = Math.floor(numVal(get('Note50', '50')));
    const d20 = Math.floor(numVal(get('Note20', '20')));
    const d10 = Math.floor(numVal(get('Note10', '10')));
    const d5 = Math.floor(numVal(get('Note5', '5')));
    const d2 = Math.floor(numVal(get('Note2', '2')));
    const d1 = Math.floor(numVal(get('Note1', '1')));
    const coins = numVal(get('Coins'));
    const noteSum =
      Math.round(
        (d500 * 500 +
          d200 * 200 +
          d100 * 100 +
          d50 * 50 +
          d20 * 20 +
          d10 * 10 +
          d5 * 5 +
          d2 * 2 +
          d1 * 1 +
          coins) *
          100
      ) / 100;

    const declaredAmount = numVal(get('Amount', 'DraftAmount', 'RemittanceAmount'));
    let amount = declaredAmount;
    if (amount <= 0 && noteSum > 0) amount = noteSum;

    const chequeNo = strVal(get('ChequeNo', 'ChqNo'));
    const chqDateRaw = get('ChequeDate');
    const chqDateRes = chqDateRaw ? normalizeDateCell(chqDateRaw, false) : { date, valid: dateRes.valid, wasEmpty: true };
    const chequeDate = chqDateRes.date;
    const draweeBank = strVal(get('DraweeBank', 'BankName'));

    const transferRaw = strVal(get('TransferType')).toLowerCase();
    const transferType: 'rtgs' | 'neft' =
      transferRaw === 'rtgs' || (transferRaw !== 'neft' && transferRaw !== 'rtgs' && amount >= 200000)
        ? 'rtgs'
        : 'neft';
    const benName = strVal(get('BeneficiaryName', 'BenName'));
    const benBank = strVal(get('BeneficiaryBank', 'BenBank'));
    const benIfsc = strVal(get('BeneficiaryIFSC', 'IFSC')).toUpperCase().replace(/\s+/g, '');
    const benAccountNo = strVal(get('BeneficiaryAccountNo', 'BenAccountNo', 'BeneficiaryAcNo')).replace(/\s+/g, '');
    const inFavourOf = strVal(get('InFavourOf', 'Favouring', 'PayeeName'));
    const payableAt = strVal(get('PayableAt', 'PayableBranch')) || branch;

    const errors: string[] = [];
    const warnings: string[] = [];

    if (!dateRes.valid) errors.push(`Invalid Date "${String(get('Date'))}"`);
    if (chqDateRaw && !chqDateRes.valid) errors.push(`Invalid ChequeDate "${String(chqDateRaw)}"`);
    if (!name) errors.push('Missing Name');
    if (!accountNo && !(formType === 'dd' && bankId === 'sbi')) errors.push('Missing Account No');
    if (amount <= 0) errors.push('Amount must be > 0');

    // Box capacity checks
    const maxAcctBoxes = formType === 'dd' && bankId === 'sbi' ? 11 : bankId === 'hdfc' ? 14 : 17;
    if (accountNo && accountNo.length > maxAcctBoxes) {
      warnings.push(`Account No (${accountNo.length} chars) exceeds ${maxAcctBoxes} printed boxes`);
    }

    if (phone && phone.length !== 10) {
      warnings.push('Phone should be 10 digits');
    }

    if (pan && !PAN_REGEX.test(pan)) {
      errors.push(`Invalid PAN format "${pan}"`);
    }

    if (formType === 'deposit') {
      if (depositType === 'cash' && noteSum > 0 && declaredAmount > 0 && Math.abs(declaredAmount - noteSum) > 0.5) {
        errors.push(`Amount (₹${declaredAmount}) mismatches denominations total (₹${noteSum})`);
      }
      if ((depositType === 'cheque' || depositType === 'both') && !chequeNo) {
        errors.push(`Missing ChequeNo for ${depositType} deposit`);
      }
      if ((depositType === 'cash' || depositType === 'both') && (depositType === 'cash' ? amount : noteSum) >= 50000 && !pan) {
        errors.push('Rule 114B: PAN required for cash >= ₹50,000');
      }
      if (depositType === 'both' && noteSum <= 0) {
        warnings.push('Cash + Cheque mode has zero cash notes specified');
      }
    } else if (formType === 'rtgs') {
      if (!benName) errors.push('Missing Beneficiary Name');
      if (!benAccountNo) errors.push('Missing Beneficiary A/c');
      if (!IFSC_REGEX.test(benIfsc)) errors.push('Invalid 11-char IFSC');
      if (transferRaw === 'rtgs' && amount > 0 && amount < 200000) {
        errors.push('RTGS requires minimum ₹2,00,000 (use NEFT)');
      }
      const benLimit = bankId === 'hdfc' ? 16 : 17;
      if (benAccountNo && benAccountNo.length > benLimit) {
        warnings.push(`Beneficiary A/c exceeds ${benLimit} boxes on ${bankId.toUpperCase()} slip`);
      }
    } else if (formType === 'dd') {
      if (!inFavourOf) errors.push('Missing Payee (In Favour Of)');
      if (bankId === 'hdfc') {
        if (!chequeNo) errors.push('HDFC DD form requires ChequeNo (Cheque Only)');
        if (noteSum > 0) warnings.push('Cash notes ignored on HDFC Cheque-Only DD form');
      } else {
        if (noteSum > 0 && declaredAmount > 0 && Math.abs(declaredAmount - noteSum) > 0.5) {
          warnings.push(`SBI DD cash notes (₹${noteSum}) differ from Draft Amount (₹${declaredAmount})`);
        }
        if (amount >= 50000 && !pan) {
          errors.push('Rule 114B: PAN required for cash DD >= ₹50,000');
        }
      }
    }

    // Stale cheque check (> 90 days)
    if (chequeNo && chqDateRes.valid && isValidIsoCalendarDate(chequeDate)) {
      const chqDt = new Date(`${chequeDate}T00:00:00Z`);
      const refDt = dateRes.valid && isValidIsoCalendarDate(date) ? new Date(`${date}T00:00:00Z`) : new Date();
      const diffDays = Math.floor((refDt.getTime() - chqDt.getTime()) / 86400000);
      if (diffDays > 90) {
        warnings.push(`Cheque dated ${chequeDate} is > 90 days old (CTS stale risk)`);
      }
    }

    return {
      rowNumber: idx + 1,
      date,
      branch,
      accountNo,
      name,
      phone,
      pan,
      depositType,
      amount,
      d500,
      d200,
      d100,
      d50,
      d20,
      d10,
      d5,
      d2,
      d1,
      coins,
      chequeNo,
      chequeDate,
      draweeBank,
      transferType,
      benName,
      benBank,
      benIfsc,
      benAccountNo,
      inFavourOf,
      payableAt,
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  });

  const validRecords = records.filter((r) => r.isValid).length;
  const totalWarnings = records.reduce((acc, r) => acc + r.warnings.length, 0);
  return {
    success: true,
    totalRecords: records.length,
    validRecords,
    invalidRecords: records.length - validRecords,
    totalWarnings,
    records,
  };
}

export function bulkRecordToBankFormState(
  rec: BulkSlipRecord,
  _bankId: BankId,
  formType: BankFormType
): BankFormState {
  const base = createInitialBankFormState();
  base.date = rec.date;
  base.branch = rec.branch;
  base.accountNo = rec.accountNo;
  base.name = rec.name;
  base.depositorName = rec.name;
  base.mobile = rec.phone;
  base.pan = rec.pan;

  // Populate notes or auto-split if notes omitted for cash forms
  const hasExplicitNotes =
    rec.d500 +
      rec.d200 +
      rec.d100 +
      rec.d50 +
      rec.d20 +
      rec.d10 +
      rec.d5 +
      rec.d2 +
      rec.d1 +
      rec.coins >
    0;
  if (hasExplicitNotes) {
    base.notes[500] = rec.d500 ? String(rec.d500) : '';
    base.notes[200] = rec.d200 ? String(rec.d200) : '';
    base.notes[100] = rec.d100 ? String(rec.d100) : '';
    base.notes[50] = rec.d50 ? String(rec.d50) : '';
    base.notes[20] = rec.d20 ? String(rec.d20) : '';
    base.notes[10] = rec.d10 ? String(rec.d10) : '';
    base.notes[5] = rec.d5 ? String(rec.d5) : '';
    base.notes[2] = rec.d2 ? String(rec.d2) : '';
    base.notes[1] = rec.d1 ? String(rec.d1) : '';
    base.coins = rec.coins ? String(rec.coins) : '';
  } else if (
    rec.depositType !== 'cheque' &&
    rec.amount > 0 &&
    (formType === 'deposit' || (formType === 'dd' && _bankId === 'sbi'))
  ) {
    let rem = Math.floor(rec.amount);
    [500, 200, 100, 50, 20, 10, 5, 2, 1].forEach((d) => {
      const cnt = Math.floor(rem / d);
      if (cnt > 0) base.notes[d] = String(cnt);
      rem %= d;
    });
    const paise = Math.round((rec.amount - Math.floor(rec.amount)) * 100);
    if (paise > 0) base.coins = (paise / 100).toFixed(2);
  }

  if (formType === 'deposit') {
    base.depositMode = rec.depositType;
    base.hdfcDepositType = rec.depositType === 'cheque' ? 'local' : 'cash';
    if (rec.depositType === 'cheque' || rec.depositType === 'both' || rec.chequeNo) {
      const cashPart = hasExplicitNotes
        ? rec.d500 * 500 +
          rec.d200 * 200 +
          rec.d100 * 100 +
          rec.d50 * 50 +
          rec.d20 * 20 +
          rec.d10 * 10 +
          rec.d5 * 5 +
          rec.d2 * 2 +
          rec.d1 +
          rec.coins
        : 0;
      const chqAmt =
        rec.depositType === 'both' && cashPart > 0 && rec.amount > cashPart
          ? Math.round((rec.amount - cashPart) * 100) / 100
          : rec.amount;
      base.cheques[0] = {
        chequeNo: rec.chequeNo,
        bankBranch: rec.draweeBank || 'Local Clearing',
        city: rec.branch,
        date: rec.chequeDate || rec.date,
        amount: chqAmt > 0 ? String(chqAmt) : '',
      };
    }
  } else if (formType === 'dd') {
    base.ddFavouring = rec.inFavourOf;
    base.ddPayableAt = rec.payableAt;
    base.ddAmount = rec.amount > 0 ? String(rec.amount) : '';
    base.ddChequeNo = rec.chequeNo;
    base.ddChequeDate = rec.chequeDate || rec.date;
  } else if (formType === 'rtgs') {
    base.rtgsType = rec.transferType;
    base.rtgsChequeNo = rec.chequeNo;
    base.rtgsChequeDate = rec.chequeDate || rec.date;
    base.rtgsBenName = rec.benName;
    base.rtgsBenBank = rec.benBank;
    base.rtgsBenIfsc = rec.benIfsc;
    base.rtgsBenAccount = rec.benAccountNo;
    base.rtgsBenAccountConfirm = rec.benAccountNo;
    base.rtgsAmount = rec.amount > 0 ? String(rec.amount) : '';
  }

  return base;
}
