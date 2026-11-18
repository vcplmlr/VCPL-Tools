import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertCircle,
  CheckCircle,
  Download,
  FileSpreadsheet,
  Landmark,
  MapPin,
  Plus,
  Receipt,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { ToolCatalogItem } from '../../types/tools';
import {
  downloadBomCsv,
  downloadExcelWorkbook,
  downloadJsonFile,
  downloadWordDocument,
  exportStructuredReportPdf,
  printHtmlDocument,
} from '../../utils/printReport';
import { ToolExportBar } from './ToolExportBar';

interface TaxBankingExtraViewProps {
  tool: ToolCatalogItem;
}

const INDIAN_STATES = [
  { code: '29', name: 'Karnataka' },
  { code: '27', name: 'Maharashtra' },
  { code: '07', name: 'Delhi' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '32', name: 'Kerala' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '08', name: 'Rajasthan' },
  { code: '19', name: 'West Bengal' },
  { code: '06', name: 'Haryana' },
  { code: '03', name: 'Punjab' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '21', name: 'Odisha' },
  { code: '10', name: 'Bihar' },
  { code: '18', name: 'Assam' },
  { code: '30', name: 'Goa' },
  { code: '04', name: 'Chandigarh' },
  { code: '96', name: 'Outside India (Export / Import)' },
];

interface ParsedBankTxn {
  id: number;
  date: string;
  narration: string;
  debit: number;
  credit: number;
  balance: number | null;
  category: string;
}

function parseAmount(val: unknown): number {
  if (typeof val === 'number' && Number.isFinite(val)) return Math.abs(val);
  if (typeof val !== 'string') return 0;
  const cleaned = val.replace(/[₹,\s]/g, '').replace(/\(([^)]+)\)/, '$1').trim();
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? Math.abs(num) : 0;
}

function classifyNarration(text: string, debit: number, credit: number): string {
  const s = text.toLowerCase();
  if (/upi|gpay|phonepe|paytm|vpa|@ok|@ybl/.test(s)) return 'UPI / QR';
  if (/neft|rtgs|imps|ft-/.test(s)) return 'NEFT / RTGS / IMPS';
  if (/atm|cash|cwdr|cdep|self/.test(s)) return 'ATM / Cash';
  if (/charge|fee|sms|gst|chrg|penalty|min bal/.test(s)) return 'Bank Charges & GST';
  if (/emi|loan|nach|ecs|mandate|ach/.test(s)) return 'EMI / NACH Mandate';
  if (/sal|payroll|tds|gstn|tax|income tax|challan/.test(s)) return 'Tax / Payroll';
  if (/int\.pd|interest/.test(s)) return 'Interest';
  if (credit > 0 && debit === 0) return 'Deposits & Receipts';
  return 'General Payments';
}

interface ExpenseEntry {
  id: string;
  date: string;
  vendor: string;
  gstin: string;
  invoiceNo: string;
  category: string;
  taxable: number;
  gstRate: number;
  supplyType: 'intra' | 'inter';
  itcEligible: boolean;
}

const EXPENSE_STORAGE_KEY = 'vcpl_business_expense_ledger_v1';

export const TaxBankingExtraView: React.FC<TaxBankingExtraViewProps> = ({ tool }) => {
  // -------------------------------------------------------------------------
  // 1. BANK STATEMENT ANALYZER STATE
  // -------------------------------------------------------------------------
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [stmtFileName, setStmtFileName] = useState<string>('');
  const [stmtError, setStmtError] = useState<string>('');
  const [colDate, setColDate] = useState<string>('');
  const [colDesc, setColDesc] = useState<string>('');
  const [colDebit, setColDebit] = useState<string>('');
  const [colCredit, setColCredit] = useState<string>('');
  const [colBalance, setColBalance] = useState<string>('');
  const [txnSearch, setTxnSearch] = useState<string>('');
  const [txnCatFilter, setTxnCatFilter] = useState<string>('ALL');

  const handleBankFileUpload = async (file: File) => {
    setStmtError('');
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: false });
      const sheetName = wb.SheetNames[0];
      if (!sheetName) throw new Error('No worksheet found in uploaded file.');
      const ws = wb.Sheets[sheetName];
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });

      // Find best header row (contains date/particulars/narration/debit/credit/withdrawal/deposit)
      let headerIdx = 0;
      for (let i = 0; i < Math.min(20, matrix.length); i++) {
        const line = matrix[i].map((c) => String(c || '').toLowerCase()).join(' ');
        if (
          (line.includes('date') || line.includes('txn')) &&
          (line.includes('debit') ||
            line.includes('credit') ||
            line.includes('withdrawal') ||
            line.includes('deposit') ||
            line.includes('narration') ||
            line.includes('particulars') ||
            line.includes('description'))
        ) {
          headerIdx = i;
          break;
        }
      }

      const headers = (matrix[headerIdx] || []).map((h, idx) =>
        String(h || '').trim() || `Column_${idx + 1}`
      );
      const dataRows: Record<string, unknown>[] = [];
      for (let r = headerIdx + 1; r < matrix.length; r++) {
        const rowArr = matrix[r];
        if (!rowArr || rowArr.every((v) => String(v ?? '').trim() === '')) continue;
        const obj: Record<string, unknown> = {};
        headers.forEach((h, cIdx) => {
          obj[h] = rowArr[cIdx] ?? '';
        });
        dataRows.push(obj);
      }

      if (dataRows.length === 0) throw new Error('No transaction rows found.');

      const findHeader = (patterns: RegExp[]) =>
        headers.find((h) => patterns.some((p) => p.test(h.toLowerCase()))) || '';

      setRawHeaders(headers);
      setRawRows(dataRows);
      setStmtFileName(file.name);
      setColDate(findHeader([/txn.*date|value.*date|date/]));
      setColDesc(findHeader([/narration|particular|description|remark|detail/]));
      setColDebit(findHeader([/debit|withdrawal|dr\b|paid out/]));
      setColCredit(findHeader([/credit|deposit|cr\b|paid in/]));
      setColBalance(findHeader([/balance|closing/]));
    } catch (err) {
      setStmtError(err instanceof Error ? err.message : 'Unable to read bank statement file.');
    }
  };

  const loadSampleStatement = () => {
    const headers = ['Txn Date', 'Narration', 'Withdrawal (Dr)', 'Deposit (Cr)', 'Balance'];
    const sample: Record<string, unknown>[] = [
      { 'Txn Date': '2026-10-01', Narration: 'OPENING BALANCE CREDIT / NEFT RECEIPT INV-401', 'Withdrawal (Dr)': '', 'Deposit (Cr)': 185000, Balance: 185000 },
      { 'Txn Date': '2026-10-03', Narration: 'UPI/428910/vendor@okicici/Office Supplies', 'Withdrawal (Dr)': 4850, 'Deposit (Cr)': '', Balance: 180150 },
      { 'Txn Date': '2026-10-05', Narration: 'RTGS-HDFCR520261005-ACME MOTORS PVT LTD', 'Withdrawal (Dr)': '', 'Deposit (Cr)': 340000, Balance: 520150 },
      { 'Txn Date': '2026-10-08', Narration: 'NEFT-OUT-RENT PAYMENT KANKANADY PROPERTY', 'Withdrawal (Dr)': 65000, 'Deposit (Cr)': '', Balance: 455150 },
      { 'Txn Date': '2026-10-12', Narration: 'GSTN CHALLAN PMT / TAX PORTAL', 'Withdrawal (Dr)': 48200, 'Deposit (Cr)': '', Balance: 406950 },
      { 'Txn Date': '2026-10-15', Narration: 'ATM CASH WITHDRAWAL MANGALORE BRANCH', 'Withdrawal (Dr)': 15000, 'Deposit (Cr)': '', Balance: 391950 },
      { 'Txn Date': '2026-10-18', Narration: 'SMS ALERT & NEFT CHARGES + GST', 'Withdrawal (Dr)': 295, 'Deposit (Cr)': '', Balance: 391655 },
      { 'Txn Date': '2026-10-24', Narration: 'UPI/QR SETTLEMENT CUSTOMER RECEIPTS', 'Withdrawal (Dr)': '', 'Deposit (Cr)': 92400, Balance: 484055 },
    ];
    setRawHeaders(headers);
    setRawRows(sample);
    setStmtFileName('sample_sbi_statement.csv');
    setColDate('Txn Date');
    setColDesc('Narration');
    setColDebit('Withdrawal (Dr)');
    setColCredit('Deposit (Cr)');
    setColBalance('Balance');
    setStmtError('');
  };

  const analyzedTxns = useMemo<ParsedBankTxn[]>(() => {
    return rawRows
      .map((row, idx) => {
        const narration = String(colDesc ? row[colDesc] ?? '' : '').trim();
        const debit = parseAmount(colDebit ? row[colDebit] : 0);
        const credit = parseAmount(colCredit ? row[colCredit] : 0);
        const balRaw = colBalance ? row[colBalance] : '';
        const balance = String(balRaw ?? '').trim() ? parseAmount(balRaw) : null;
        return {
          id: idx + 1,
          date: String(colDate ? row[colDate] ?? '' : '').trim(),
          narration,
          debit,
          credit,
          balance,
          category: classifyNarration(narration, debit, credit),
        };
      })
      .filter((t) => t.debit > 0 || t.credit > 0 || t.narration.length > 0);
  }, [rawRows, colDate, colDesc, colDebit, colCredit, colBalance]);

  const stmtSummary = useMemo(() => {
    let totalCredit = 0;
    let totalDebit = 0;
    const catTotals = new Map<string, { count: number; debit: number; credit: number }>();
    for (const t of analyzedTxns) {
      totalCredit += t.credit;
      totalDebit += t.debit;
      const cur = catTotals.get(t.category) || { count: 0, debit: 0, credit: 0 };
      cur.count += 1;
      cur.debit += t.debit;
      cur.credit += t.credit;
      catTotals.set(t.category, cur);
    }
    return {
      totalCredit,
      totalDebit,
      netCashflow: totalCredit - totalDebit,
      categories: Array.from(catTotals.entries()).sort((a, b) => b[1].debit + b[1].credit - (a[1].debit + a[1].credit)),
    };
  }, [analyzedTxns]);

  const filteredTxns = useMemo(() => {
    const q = txnSearch.trim().toLowerCase();
    return analyzedTxns.filter((t) => {
      if (txnCatFilter !== 'ALL' && t.category !== txnCatFilter) return false;
      if (!q) return true;
      return (
        t.narration.toLowerCase().includes(q) ||
        t.date.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    });
  }, [analyzedTxns, txnSearch, txnCatFilter]);

  const exportAnalyzedStatement = () => {
    if (analyzedTxns.length === 0) return;
    const wb = XLSX.utils.book_new();
    const txRows = analyzedTxns.map((t) => ({
      'S.No': t.id,
      Date: t.date,
      Narration: t.narration,
      Category: t.category,
      'Debit (Rs.)': t.debit,
      'Credit (Rs.)': t.credit,
      'Balance (Rs.)': t.balance ?? '',
    }));
    const catRows = stmtSummary.categories.map(([cat, stats]) => ({
      Category: cat,
      Transactions: stats.count,
      'Total Debit (Rs.)': stats.debit,
      'Total Credit (Rs.)': stats.credit,
      'Net Impact (Rs.)': stats.credit - stats.debit,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(txRows), 'Transactions');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(catRows), 'Category_Summary');
    XLSX.writeFile(wb, `Bank_Statement_Analysis.xlsx`);
  };

  // -------------------------------------------------------------------------
  // 2. GST PLACE OF SUPPLY STATE
  // -------------------------------------------------------------------------
  const [supplierState, setSupplierState] = useState('29');
  const [recipientState, setRecipientState] = useState('27');
  const [shipToState, setShipToState] = useState('29');
  const [supplyMode, setSupplyMode] = useState<
    | 'goods-movement'
    | 'goods-bill-to-ship-to'
    | 'goods-otc'
    | 'goods-install'
    | 'services-registered'
    | 'services-unregistered'
    | 'services-immovable'
    | 'export'
  >('goods-movement');
  const [gstTaxRate, setGstTaxRate] = useState<number>(18);
  const [posTaxableValue, setPosTaxableValue] = useState<string>('');

  const posResult = useMemo(() => {
    const supName = INDIAN_STATES.find((s) => s.code === supplierState)?.name || supplierState;
    let posCode = recipientState;
    let section = 'IGST Act Sec 10(1)(a)';
    let rule = 'Where supply involves movement of goods, Place of Supply is the location where movement terminates for delivery.';

    switch (supplyMode) {
      case 'goods-movement':
        posCode = shipToState;
        section = 'IGST Act Sec 10(1)(a)';
        rule = 'Goods delivered to recipient/consignee destination: Place of Supply is where movement terminates for delivery.';
        break;
      case 'goods-bill-to-ship-to':
        posCode = recipientState;
        section = 'IGST Act Sec 10(1)(b) — Bill-to Ship-to';
        rule = 'Goods delivered on third-party instructions: Place of Supply is deemed to be the principal place of business of the third person (Bill-To party).';
        break;
      case 'goods-otc':
        posCode = supplierState;
        section = 'IGST Act Sec 10(1)(c)';
        rule = 'Over-the-counter / no movement of goods: Place of Supply is the location of goods at the time of delivery to the recipient.';
        break;
      case 'goods-install':
        posCode = shipToState;
        section = 'IGST Act Sec 10(1)(d)';
        rule = 'Goods assembled or installed at site: Place of Supply is the physical site of installation or assembly.';
        break;
      case 'services-registered':
        posCode = recipientState;
        section = 'IGST Act Sec 12(2)(a)';
        rule = 'General B2B service to a registered person: Place of Supply is the location of such registered recipient.';
        break;
      case 'services-unregistered':
        posCode = recipientState === '96' ? supplierState : recipientState;
        section = 'IGST Act Sec 12(2)(b)';
        rule = 'General B2C service to unregistered person: Place of Supply is the recipient address on record (or supplier location if unavailable).';
        break;
      case 'services-immovable':
        posCode = shipToState;
        section = 'IGST Act Sec 12(3)';
        rule = 'Architect, hotel stay, construction or real-estate services: Place of Supply is always the location of the immovable property.';
        break;
      case 'export':
        posCode = '96';
        section = 'IGST Act Sec 16(1) — Zero-Rated Export';
        rule = 'Goods or services exported outside India qualify as Zero-Rated Supply (with LUT or on payment of IGST).';
        break;
    }

    const posName = INDIAN_STATES.find((s) => s.code === posCode)?.name || posCode;
    const isExport = posCode === '96' || supplyMode === 'export';
    const isIntra = !isExport && supplierState === posCode;
    const posTaxableNum = Math.max(0, Number(posTaxableValue) || 0);
    const totalTax = (posTaxableNum * gstTaxRate) / 100;

    return {
      supName,
      posCode,
      posName,
      section,
      rule,
      isExport,
      isIntra,
      taxableValue: posTaxableNum,
      taxLabel: isExport
        ? 'IGST (Zero-Rated Export / LUT)'
        : isIntra
        ? `CGST (${gstTaxRate / 2}%) + SGST (${gstTaxRate / 2}%) — Intra-State`
        : `IGST (${gstTaxRate}%) — Inter-State`,
      cgst: isIntra && !isExport ? totalTax / 2 : 0,
      sgst: isIntra && !isExport ? totalTax / 2 : 0,
      igst: !isIntra || isExport ? totalTax : 0,
    };
  }, [supplierState, recipientState, shipToState, supplyMode, gstTaxRate, posTaxableValue]);

  // -------------------------------------------------------------------------
  // 3. BUSINESS EXPENSE & GST ITC MANAGER STATE
  // -------------------------------------------------------------------------
  const [expenses, setExpenses] = useState<ExpenseEntry[]>(() => {
    try {
      const raw = window.localStorage.getItem(EXPENSE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return [];
  });
  const [expDate, setExpDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expVendor, setExpVendor] = useState('');
  const [expGstin, setExpGstin] = useState('');
  const [expInvoiceNo, setExpInvoiceNo] = useState('');
  const [expCategory, setExpCategory] = useState('Office & Stationery');
  const [expTaxable, setExpTaxable] = useState<string>('');
  const [expRate, setExpRate] = useState<number>(18);
  const [expSupplyType, setExpSupplyType] = useState<'intra' | 'inter'>('intra');
  const [expItcEligible, setExpItcEligible] = useState<boolean>(true);
  const [expFilterCat, setExpFilterCat] = useState<string>('ALL');

  useEffect(() => {
    try {
      window.localStorage.setItem(EXPENSE_STORAGE_KEY, JSON.stringify(expenses));
    } catch {
      // ignore quota error
    }
  }, [expenses]);

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const taxableNum = Number.parseFloat(expTaxable);
    if (!expVendor.trim() || !Number.isFinite(taxableNum) || taxableNum <= 0) return;
    const entry: ExpenseEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: expDate,
      vendor: expVendor.trim(),
      gstin: expGstin.trim().toUpperCase(),
      invoiceNo: expInvoiceNo.trim(),
      category: expCategory,
      taxable: taxableNum,
      gstRate: expRate,
      supplyType: expSupplyType,
      itcEligible: expItcEligible,
    };
    setExpenses((prev) => [entry, ...prev]);
    setExpVendor('');
    setExpGstin('');
    setExpInvoiceNo('');
    setExpTaxable('');
  };

  const expenseTotals = useMemo(() => {
    let totalTaxable = 0;
    let totalGst = 0;
    let claimableItc = 0;
    for (const item of expenses) {
      const gstAmt = (item.taxable * item.gstRate) / 100;
      totalTaxable += item.taxable;
      totalGst += gstAmt;
      if (item.itcEligible) claimableItc += gstAmt;
    }
    return {
      totalTaxable,
      totalGst,
      grandTotal: totalTaxable + totalGst,
      claimableItc,
      blockedItc: totalGst - claimableItc,
    };
  }, [expenses]);

  const exportExpensesExcel = () => {
    if (expenses.length === 0) return;
    const rows = expenses.map((item) => {
      const gstAmt = (item.taxable * item.gstRate) / 100;
      return {
        Date: item.date,
        Vendor: item.vendor,
        GSTIN: item.gstin || 'Unregistered',
        'Invoice No': item.invoiceNo || '-',
        Category: item.category,
        'Taxable Value': item.taxable,
        'GST Rate %': item.gstRate,
        CGST: item.supplyType === 'intra' ? Number((gstAmt / 2).toFixed(2)) : 0,
        SGST: item.supplyType === 'intra' ? Number((gstAmt / 2).toFixed(2)) : 0,
        IGST: item.supplyType === 'inter' ? Number(gstAmt.toFixed(2)) : 0,
        'Invoice Total': Number((item.taxable + gstAmt).toFixed(2)),
        'ITC Claimable': item.itcEligible ? 'Yes' : 'Blocked/No',
      };
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Business_Expenses_ITC');
    XLSX.writeFile(wb, `VCPL_Expense_GST_Register.xlsx`);
  };

  // =========================================================================
  // RENDER BY TOOL ID
  // =========================================================================
  if (tool.id === 'bank-statement-analyzer') {
    return (
      <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#2F3E4E]/15">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] flex items-center gap-1.5">
              <Landmark className="w-3.5 h-3.5 text-[#2F3E4E]" />
              {tool.categoryName} · {tool.code}
            </span>
            <h1 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] mt-1">
              {tool.title}
            </h1>
            <p className="text-xs sm:text-sm text-[#475569] mt-0.5">{tool.description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={loadSampleStatement}
              className="px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] cursor-pointer"
            >
              Load Sample Statement
            </button>
            {analyzedTxns.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={exportAnalyzedStatement}
                  className="px-4 py-2 rounded-xl bg-[#2F3E4E] hover:bg-[#1E293B] text-[#FFFDF5] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Export Excel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRawHeaders([]);
                    setRawRows([]);
                    setStmtFileName('');
                    setStmtError('');
                    setTxnSearch('');
                    setTxnCatFilter('ALL');
                  }}
                  className="px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white hover:bg-rose-50 text-xs font-bold text-rose-700 cursor-pointer"
                >
                  Clear
                </button>
              </>
            )}
          </div>
        </div>

        <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-[#2F3E4E]/45 rounded-2xl bg-[#FEF2C8]/40 hover:bg-[#FEF2C8]/75 transition cursor-pointer text-center">
          <UploadCloud className="w-7 h-7 text-[#2F3E4E] mb-2" />
          <span className="text-sm font-bold text-[#2F3E4E]">
            {stmtFileName ? `Loaded: ${stmtFileName}` : 'Drop Bank Statement (.CSV, .XLSX, .XLS) or Click to Browse'}
          </span>
          <span className="text-xs text-[#64748B] mt-1">
            Processed 100% offline in your browser — supports SBI, HDFC, ICICI, Axis &amp; Tally Bank exports
          </span>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleBankFileUpload(f);
            }}
          />
        </label>

        {stmtError && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{stmtError}</span>
          </div>
        )}

        {rawHeaders.length > 0 && (
          <div className="space-y-6">
            {/* Column Mapping Controls */}
            <div className="p-4 rounded-xl bg-white border-[1.5px] border-[#2F3E4E] grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              {[
                { label: 'Date Column', val: colDate, setter: setColDate },
                { label: 'Narration / Desc', val: colDesc, setter: setColDesc },
                { label: 'Debit / Withdrawal', val: colDebit, setter: setColDebit },
                { label: 'Credit / Deposit', val: colCredit, setter: setColCredit },
                { label: 'Balance Column', val: colBalance, setter: setColBalance },
              ].map((m) => (
                <div key={m.label}>
                  <label className="block font-bold text-[#475569] mb-1">{m.label}</label>
                  <select
                    value={m.val}
                    onChange={(e) => m.setter(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/40 bg-[#FFFDF5] text-[#2F3E4E] font-semibold"
                  >
                    <option value="">-- Not Mapped --</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {/* Cashflow KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="p-4 rounded-xl bg-[#CEE5DC]/60 border-[1.5px] border-[#2F3E4E]">
                <span className="text-[11px] font-bold uppercase text-[#12805C]">Total Credits (In)</span>
                <p className="font-mono font-extrabold text-xl text-[#2F3E4E] mt-1 tabular-nums">
                  ₹{stmtSummary.totalCredit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[#FFE1B3]/70 border-[1.5px] border-[#2F3E4E]">
                <span className="text-[11px] font-bold uppercase text-[#9E2A2B]">Total Debits (Out)</span>
                <p className="font-mono font-extrabold text-xl text-[#2F3E4E] mt-1 tabular-nums">
                  ₹{stmtSummary.totalDebit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[#FEF2C8] border-[1.5px] border-[#2F3E4E]">
                <span className="text-[11px] font-bold uppercase text-[#475569]">Net Cashflow</span>
                <p className="font-mono font-extrabold text-xl text-[#2F3E4E] mt-1 tabular-nums">
                  {stmtSummary.netCashflow >= 0 ? '+' : '-'}₹
                  {Math.abs(stmtSummary.netCashflow).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-white border-[1.5px] border-[#2F3E4E]">
                <span className="text-[11px] font-bold uppercase text-[#475569]">Parsed Entries</span>
                <p className="font-mono font-extrabold text-xl text-[#2F3E4E] mt-1 tabular-nums">
                  {analyzedTxns.length}
                </p>
              </div>
            </div>

            {/* Category Pills */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setTxnCatFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                  txnCatFilter === 'ALL'
                    ? 'bg-[#2F3E4E] text-[#FFFDF5] border-[#2F3E4E]'
                    : 'bg-white text-[#2F3E4E] border-[#2F3E4E]/30'
                }`}
              >
                All ({analyzedTxns.length})
              </button>
              {stmtSummary.categories.map(([cat, stats]) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setTxnCatFilter(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                    txnCatFilter === cat
                      ? 'bg-[#F9C80E] text-[#2F3E4E] border-[#2F3E4E]'
                      : 'bg-white text-[#475569] border-[#2F3E4E]/30 hover:bg-[#FEF2C8]'
                  }`}
                >
                  {cat} ({stats.count})
                </button>
              ))}
            </div>

            {/* Search & Table */}
            <div className="space-y-3">
              <input
                type="text"
                value={txnSearch}
                onChange={(e) => setTxnSearch(e.target.value)}
                placeholder="Search narration, UTR, vendor, or category..."
                className="w-full sm:w-96 px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white text-xs font-medium"
              />
              <div className="rounded-xl border-[1.5px] border-[#2F3E4E] overflow-hidden bg-white">
                <div className="overflow-x-auto max-h-[380px]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#2F3E4E] text-[#FFFDF5] sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Narration</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3 text-right">Debit (₹)</th>
                        <th className="py-2.5 px-3 text-right">Credit (₹)</th>
                        <th className="py-2.5 px-3 text-right">Balance (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2F3E4E]/10">
                      {filteredTxns.slice(0, 200).map((t) => (
                        <tr key={t.id} className="hover:bg-[#FEF2C8]/40">
                          <td className="py-2 px-3 font-mono whitespace-nowrap">{t.date || '-'}</td>
                          <td className="py-2 px-3 max-w-md">{t.narration}</td>
                          <td className="py-2 px-3">
                            <span className="px-2 py-0.5 rounded bg-[#CEE5DC]/70 text-[#2F3E4E] font-bold text-[10px]">
                              {t.category}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-rose-700 font-semibold tabular-nums">
                            {t.debit > 0 ? t.debit.toLocaleString('en-IN') : '—'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-emerald-700 font-semibold tabular-nums">
                            {t.credit > 0 ? t.credit.toLocaleString('en-IN') : '—'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-[#475569] tabular-nums">
                            {t.balance !== null ? t.balance.toLocaleString('en-IN') : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <ToolExportBar
              onClear={() => {
                setRawHeaders([]);
                setRawRows([]);
                setStmtFileName('');
                setStmtError('');
                setTxnSearch('');
                setTxnCatFilter('ALL');
              }}
              onExcel={exportAnalyzedStatement}
              onCsv={() => {
                downloadBomCsv({
                  filename: 'Bank_Statement_Analysis.csv',
                  headers: ['S.No', 'Date', 'Narration', 'Category', 'Debit (Rs.)', 'Credit (Rs.)', 'Balance (Rs.)'],
                  rows: analyzedTxns.map((t) => [t.id, t.date, t.narration, t.category, t.debit, t.credit, t.balance ?? '']),
                });
              }}
              onWord={() => {
                void downloadWordDocument({
                  filename: 'Bank_Statement_Analysis.docx',
                  title: 'Bank Statement Cashflow & Category Audit',
                  subtitle: stmtFileName ? `Source: ${stmtFileName}` : 'Analyzed Transactions',
                  kpis: [
                    { label: 'Total Credits', value: `₹${stmtSummary.totalCredit.toLocaleString('en-IN')}` },
                    { label: 'Total Debits', value: `₹${stmtSummary.totalDebit.toLocaleString('en-IN')}` },
                    { label: 'Net Cashflow', value: `₹${stmtSummary.netCashflow.toLocaleString('en-IN')}` },
                    { label: 'Transactions', value: String(analyzedTxns.length) },
                  ],
                  table: {
                    title: 'Category Summary',
                    headers: ['Category', 'Count', 'Debit (₹)', 'Credit (₹)'],
                    rows: stmtSummary.categories.map(([cat, st]) => [
                      cat,
                      String(st.count),
                      st.debit.toLocaleString('en-IN'),
                      st.credit.toLocaleString('en-IN'),
                    ]),
                  },
                });
              }}
              onJson={() => {
                downloadJsonFile('Bank_Statement_Analysis.json', {
                  fileName: stmtFileName,
                  summary: stmtSummary,
                  transactions: analyzedTxns,
                });
              }}
              onPdf={() => {
                exportStructuredReportPdf({
                  title: 'Bank Statement Analysis Report',
                  subtitle: `Entries: ${analyzedTxns.length} | Net Cashflow: Rs. ${stmtSummary.netCashflow.toLocaleString('en-IN')}`,
                  filename: 'Bank_Statement_Analysis.pdf',
                  kpis: [
                    { label: 'Total Credits', value: `Rs. ${stmtSummary.totalCredit.toLocaleString('en-IN')}` },
                    { label: 'Total Debits', value: `Rs. ${stmtSummary.totalDebit.toLocaleString('en-IN')}` },
                    { label: 'Net Cashflow', value: `Rs. ${stmtSummary.netCashflow.toLocaleString('en-IN')}` },
                  ],
                  table: {
                    title: 'Category Breakdown',
                    headers: ['Category', 'Txns', 'Debit (Rs.)', 'Credit (Rs.)'],
                    rows: stmtSummary.categories.map(([cat, st]) => [
                      cat,
                      String(st.count),
                      st.debit.toLocaleString('en-IN'),
                      st.credit.toLocaleString('en-IN'),
                    ]),
                  },
                });
              }}
              onPrint={() => {
                void printHtmlDocument({
                  title: 'Bank Statement Analysis Report',
                  bodyHtml: `
                    <h1>Bank Statement Analysis</h1>
                    <div class="kpi-grid">
                      <div class="kpi-card"><div class="kpi-label">Credits</div><div class="kpi-val">₹${stmtSummary.totalCredit.toLocaleString('en-IN')}</div></div>
                      <div class="kpi-card"><div class="kpi-label">Debits</div><div class="kpi-val">₹${stmtSummary.totalDebit.toLocaleString('en-IN')}</div></div>
                      <div class="kpi-card"><div class="kpi-label">Net Cashflow</div><div class="kpi-val">₹${stmtSummary.netCashflow.toLocaleString('en-IN')}</div></div>
                    </div>
                    <table>
                      <thead><tr><th>Category</th><th class="num">Txns</th><th class="num">Debit</th><th class="num">Credit</th></tr></thead>
                      <tbody>${stmtSummary.categories.map(([c, s]) => `<tr><td>${c}</td><td class="num">${s.count}</td><td class="num">₹${s.debit.toLocaleString('en-IN')}</td><td class="num">₹${s.credit.toLocaleString('en-IN')}</td></tr>`).join('')}</tbody>
                    </table>
                  `,
                });
              }}
            />
          </div>
        )}
      </div>
    );
  }

  if (tool.id === 'gst-place-of-supply') {
    return (
      <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="pb-5 border-b border-[#2F3E4E]/15">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-[#2F3E4E]" />
            {tool.categoryName} · {tool.code}
          </span>
          <h1 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] mt-1">
            {tool.title}
          </h1>
          <p className="text-xs sm:text-sm text-[#475569] mt-0.5">{tool.description}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 space-y-4 lg:max-h-[calc(100dvh-5.5rem)] lg:overflow-y-auto lg:pr-1.5">
            <div>
              <label className="block text-xs font-bold text-[#2F3E4E] mb-1">Transaction Scenario (IGST Act Rule)</label>
              <select
                value={supplyMode}
                onChange={(e) => setSupplyMode(e.target.value as typeof supplyMode)}
                className="w-full px-3.5 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white text-xs font-bold text-[#2F3E4E]"
              >
                <option value="goods-movement">Sec 10(1)(a) — Supply of Goods Involving Movement (Delivery State)</option>
                <option value="goods-bill-to-ship-to">Sec 10(1)(b) — Bill-to Ship-to Third-Party Model</option>
                <option value="goods-otc">Sec 10(1)(c) — Over-the-Counter Goods Sale (No Movement)</option>
                <option value="goods-install">Sec 10(1)(d) — Goods Installed / Assembled at Site</option>
                <option value="services-registered">Sec 12(2)(a) — B2B Services to Registered GST Person</option>
                <option value="services-unregistered">Sec 12(2)(b) — B2C Services to Unregistered Person</option>
                <option value="services-immovable">Sec 12(3) — Immovable Property / Hotel / Construction Services</option>
                <option value="export">Sec 16(1) — Export of Goods / Services (Zero-Rated Supply)</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#2F3E4E] mb-1">Supplier State</label>
                <select
                  value={supplierState}
                  onChange={(e) => setSupplierState(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white text-xs font-semibold"
                >
                  {INDIAN_STATES.filter((s) => s.code !== '96').map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.code} - {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#2F3E4E] mb-1">Bill-To / Recipient State</label>
                <select
                  value={recipientState}
                  onChange={(e) => setRecipientState(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white text-xs font-semibold"
                >
                  {INDIAN_STATES.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.code} - {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#2F3E4E] mb-1">Ship-To / Property Site</label>
                <select
                  value={shipToState}
                  onChange={(e) => setShipToState(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white text-xs font-semibold"
                >
                  {INDIAN_STATES.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.code} - {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#2F3E4E] mb-1">Taxable Value (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={posTaxableValue}
                  onChange={(e) => setPosTaxableValue(e.target.value)}
                  placeholder="0"
                  className="w-full px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white text-xs font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#2F3E4E] mb-1">GST Rate Slab (%)</label>
                <select
                  value={gstTaxRate}
                  onChange={(e) => setGstTaxRate(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white text-xs font-bold"
                >
                  {[0, 3, 5, 12, 18, 28].map((r) => (
                    <option key={r} value={r}>
                      {r}% GST
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 lg:sticky lg:top-20 bg-[#FEF2C8] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 space-y-4">
            <div>
              <span className="px-2.5 py-1 rounded-md bg-[#2F3E4E] text-[#F9C80E] text-[10px] font-mono font-bold">
                {posResult.section}
              </span>
              <h3 className="font-display font-extrabold text-xl text-[#2F3E4E] mt-3">
                Place of Supply: {posResult.posName} ({posResult.posCode})
              </h3>
              <p className="text-xs font-bold text-[#12805C] mt-1">{posResult.taxLabel}</p>
            </div>

            <p className="text-xs text-[#475569] leading-relaxed bg-white/80 p-3 rounded-xl border border-[#2F3E4E]/15">
              {posResult.rule}
            </p>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-xl bg-white border border-[#2F3E4E]/25">
                <span className="text-[10px] text-[#64748B] font-bold block">CGST</span>
                <span className="font-mono font-bold text-[#2F3E4E]">₹{posResult.cgst.toLocaleString('en-IN')}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-[#2F3E4E]/25">
                <span className="text-[10px] text-[#64748B] font-bold block">SGST</span>
                <span className="font-mono font-bold text-[#2F3E4E]">₹{posResult.sgst.toLocaleString('en-IN')}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-[#2F3E4E]/25">
                <span className="text-[10px] text-[#64748B] font-bold block">IGST</span>
                <span className="font-mono font-bold text-[#2F3E4E]">₹{posResult.igst.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <ToolExportBar
              onClear={() => {
                setPosTaxableValue('');
                setGstTaxRate(18);
                setSupplyMode('goods-movement');
              }}
              onExcel={() => {
                downloadExcelWorkbook({
                  filename: 'GST_Place_Of_Supply.xlsx',
                  sheets: [
                    {
                      name: 'Place_Of_Supply',
                      headers: ['Field', 'Detail'],
                      rows: [
                        ['IGST Section', posResult.section],
                        ['Supplier State', posResult.supName],
                        ['Place of Supply', `${posResult.posName} (${posResult.posCode})`],
                        ['Supply Nature', posResult.taxLabel],
                        ['Taxable Value', posResult.taxableValue],
                        ['CGST', posResult.cgst],
                        ['SGST', posResult.sgst],
                        ['IGST', posResult.igst],
                      ],
                    },
                  ],
                });
              }}
              onWord={() => {
                void downloadWordDocument({
                  filename: 'GST_Place_Of_Supply.docx',
                  title: 'GST Place of Supply Determination Memo',
                  subtitle: `${posResult.section} | ${posResult.taxLabel}`,
                  kpis: [
                    { label: 'Place of Supply', value: `${posResult.posName} (${posResult.posCode})` },
                    { label: 'Taxable Value', value: `₹${posResult.taxableValue.toLocaleString('en-IN')}` },
                    { label: 'CGST', value: `₹${posResult.cgst.toLocaleString('en-IN')}` },
                    { label: 'IGST', value: `₹${posResult.igst.toLocaleString('en-IN')}` },
                  ],
                  sections: [{ heading: 'Statutory Provision', body: posResult.rule }],
                });
              }}
              onJson={() => {
                downloadJsonFile('GST_Place_Of_Supply.json', posResult);
              }}
              onPdf={() => {
                exportStructuredReportPdf({
                  title: 'GST Place of Supply Determination',
                  subtitle: posResult.section,
                  filename: 'GST_Place_Of_Supply.pdf',
                  kpis: [
                    { label: 'Place of Supply', value: `${posResult.posName} (${posResult.posCode})` },
                    { label: 'Tax Applicability', value: posResult.taxLabel },
                  ],
                  table: {
                    title: 'Tax Split',
                    headers: ['Component', 'Amount (INR)'],
                    rows: [
                      ['Taxable Value', `Rs. ${posResult.taxableValue.toLocaleString('en-IN')}`],
                      ['CGST', `Rs. ${posResult.cgst.toLocaleString('en-IN')}`],
                      ['SGST', `Rs. ${posResult.sgst.toLocaleString('en-IN')}`],
                      ['IGST', `Rs. ${posResult.igst.toLocaleString('en-IN')}`],
                    ],
                  },
                });
              }}
              onPrint={() => {
                void printHtmlDocument({
                  title: 'GST Place of Supply Determination',
                  bodyHtml: `
                    <h1>GST Place of Supply Determination</h1>
                    <p><strong>${posResult.section}</strong> · Place of Supply: <strong>${posResult.posName} (${posResult.posCode})</strong></p>
                    <p>${posResult.rule}</p>
                    <table>
                      <thead><tr><th>Component</th><th class="num">Amount (INR)</th></tr></thead>
                      <tbody>
                        <tr><td>Taxable Value</td><td class="num">₹${posResult.taxableValue.toLocaleString('en-IN')}</td></tr>
                        <tr><td>CGST</td><td class="num">₹${posResult.cgst.toLocaleString('en-IN')}</td></tr>
                        <tr><td>SGST</td><td class="num">₹${posResult.sgst.toLocaleString('en-IN')}</td></tr>
                        <tr><td>IGST</td><td class="num">₹${posResult.igst.toLocaleString('en-IN')}</td></tr>
                      </tbody>
                    </table>
                  `,
                });
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // 3. BUSINESS EXPENSE & GST ITC MANAGER
  const visibleExpenses = expenses.filter((e) => expFilterCat === 'ALL' || e.category === expFilterCat);
  return (
    <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#2F3E4E]/15">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] flex items-center gap-1.5">
            <Receipt className="w-3.5 h-3.5 text-[#2F3E4E]" />
            {tool.categoryName} · {tool.code}
          </span>
          <h1 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] mt-1">
            {tool.title}
          </h1>
          <p className="text-xs sm:text-sm text-[#475569] mt-0.5">{tool.description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {expenses.length > 0 && (
            <>
              <button
                type="button"
                onClick={exportExpensesExcel}
                className="px-4 py-2 rounded-xl bg-[#2F3E4E] hover:bg-[#1E293B] text-[#FFFDF5] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" /> Export Excel
              </button>
              <button
                type="button"
                onClick={() => setExpenses([])}
                className="px-3 py-2 rounded-xl border border-[#2F3E4E]/35 bg-white text-rose-700 text-xs font-bold cursor-pointer"
              >
                Clear All
              </button>
            </>
          )}
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl bg-[#FEF2C8] border-[1.5px] border-[#2F3E4E]">
          <span className="text-[11px] font-bold uppercase text-[#475569]">Total Spend (incl. GST)</span>
          <p className="font-mono font-extrabold text-xl text-[#2F3E4E] mt-1 tabular-nums">
            ₹{expenseTotals.grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-[#CEE5DC]/65 border-[1.5px] border-[#2F3E4E]">
          <span className="text-[11px] font-bold uppercase text-[#12805C]">Claimable GST ITC</span>
          <p className="font-mono font-extrabold text-xl text-[#2F3E4E] mt-1 tabular-nums">
            ₹{expenseTotals.claimableItc.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-[#FFE1B3]/70 border-[1.5px] border-[#2F3E4E]">
          <span className="text-[11px] font-bold uppercase text-[#9E2A2B]">Blocked / Non-ITC GST</span>
          <p className="font-mono font-extrabold text-xl text-[#2F3E4E] mt-1 tabular-nums">
            ₹{expenseTotals.blockedItc.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-white border-[1.5px] border-[#2F3E4E]">
          <span className="text-[11px] font-bold uppercase text-[#475569]">Bills Saved Locally</span>
          <p className="font-mono font-extrabold text-xl text-[#2F3E4E] mt-1 tabular-nums">
            {expenses.length}
          </p>
        </div>
      </div>

      {/* Add Expense Form */}
      <form
        onSubmit={handleAddExpense}
        className="p-5 rounded-2xl bg-[#FEF2C8]/55 border-[1.5px] border-[#2F3E4E] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs"
      >
        <div>
          <label className="block font-bold text-[#2F3E4E] mb-1">Bill Date</label>
          <input
            type="date"
            value={expDate}
            onChange={(e) => setExpDate(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-lg border border-[#2F3E4E]/45 bg-white font-semibold"
          />
        </div>
        <div>
          <label className="block font-bold text-[#2F3E4E] mb-1">Vendor / Party Name *</label>
          <input
            type="text"
            value={expVendor}
            onChange={(e) => setExpVendor(e.target.value)}
            placeholder="e.g. Reliance Jio Infocomm"
            required
            className="w-full px-3 py-2 rounded-lg border border-[#2F3E4E]/45 bg-white font-semibold"
          />
        </div>
        <div>
          <label className="block font-bold text-[#2F3E4E] mb-1">Vendor GSTIN (Optional)</label>
          <input
            type="text"
            value={expGstin}
            onChange={(e) => setExpGstin(e.target.value.toUpperCase())}
            placeholder="29ABCDE1234F1Z5"
            maxLength={15}
            className="w-full px-3 py-2 rounded-lg border border-[#2F3E4E]/45 bg-white font-mono uppercase"
          />
        </div>
        <div>
          <label className="block font-bold text-[#2F3E4E] mb-1">Invoice / Bill No</label>
          <input
            type="text"
            value={expInvoiceNo}
            onChange={(e) => setExpInvoiceNo(e.target.value)}
            placeholder="INV-2026-089"
            className="w-full px-3 py-2 rounded-lg border border-[#2F3E4E]/45 bg-white font-mono"
          />
        </div>
        <div>
          <label className="block font-bold text-[#2F3E4E] mb-1">Expense Category</label>
          <select
            value={expCategory}
            onChange={(e) => setExpCategory(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[#2F3E4E]/45 bg-white font-semibold"
          >
            <option>Office &amp; Stationery</option>
            <option>Rent &amp; Utilities</option>
            <option>IT, Software &amp; Telecom</option>
            <option>Travel &amp; Fuel</option>
            <option>Professional &amp; Audit Fees</option>
            <option>Repairs &amp; Maintenance</option>
            <option>Purchases &amp; Inventory</option>
          </select>
        </div>
        <div>
          <label className="block font-bold text-[#2F3E4E] mb-1">Taxable Amount (₹) *</label>
          <input
            type="number"
            step="0.01"
            min="1"
            value={expTaxable}
            onChange={(e) => setExpTaxable(e.target.value)}
            placeholder="10000"
            required
            className="w-full px-3 py-2 rounded-lg border border-[#2F3E4E]/45 bg-white font-mono font-bold"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block font-bold text-[#2F3E4E] mb-1">GST %</label>
            <select
              value={expRate}
              onChange={(e) => setExpRate(Number(e.target.value))}
              className="w-full px-2.5 py-2 rounded-lg border border-[#2F3E4E]/45 bg-white font-bold"
            >
              {[0, 5, 12, 18, 28].map((r) => (
                <option key={r} value={r}>
                  {r}%
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-bold text-[#2F3E4E] mb-1">Tax Type</label>
            <select
              value={expSupplyType}
              onChange={(e) => setExpSupplyType(e.target.value as 'intra' | 'inter')}
              className="w-full px-2.5 py-2 rounded-lg border border-[#2F3E4E]/45 bg-white font-bold"
            >
              <option value="intra">CGST+SGST</option>
              <option value="inter">IGST</option>
            </select>
          </div>
        </div>
        <div className="flex items-end justify-between gap-2">
          <label className="inline-flex items-center gap-1.5 font-bold text-[#2F3E4E] pb-2 cursor-pointer">
            <input
              type="checkbox"
              checked={expItcEligible}
              onChange={(e) => setExpItcEligible(e.target.checked)}
              className="rounded border-[#2F3E4E]"
            />
            <span>ITC Eligible</span>
          </label>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-[#2F3E4E] hover:bg-[#1E293B] text-[#FFFDF5] font-bold inline-flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Add Bill
          </button>
        </div>
      </form>

      {/* Filter + Table */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <select
            value={expFilterCat}
            onChange={(e) => setExpFilterCat(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-[#2F3E4E]/45 bg-white text-xs font-bold text-[#2F3E4E]"
          >
            <option value="ALL">All Expense Categories ({expenses.length})</option>
            {Array.from(new Set(expenses.map((x) => x.category))).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-[#12805C] font-semibold flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" /> Stored privately in your browser localStorage
          </span>
        </div>

        <div className="rounded-xl border-[1.5px] border-[#2F3E4E] overflow-hidden bg-white">
          {visibleExpenses.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#64748B]">
              No expenses added yet. Record your first vendor bill above to calculate CGST/SGST/IGST &amp; claimable ITC.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[420px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#2F3E4E] text-[#FFFDF5] sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Vendor &amp; GSTIN</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3 text-right">Taxable</th>
                    <th className="py-2.5 px-3 text-right">GST Amt</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                    <th className="py-2.5 px-3">ITC</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2F3E4E]/10">
                  {visibleExpenses.map((item) => {
                    const gst = (item.taxable * item.gstRate) / 100;
                    return (
                      <tr key={item.id} className="hover:bg-[#FEF2C8]/40">
                        <td className="py-2 px-3 font-mono whitespace-nowrap">{item.date}</td>
                        <td className="py-2 px-3">
                          <div className="font-bold text-[#2F3E4E]">{item.vendor}</div>
                          <div className="text-[10px] font-mono text-[#64748B]">
                            {item.gstin || 'Unregistered'} {item.invoiceNo ? `· #${item.invoiceNo}` : ''}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-[#475569]">{item.category}</td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">
                          ₹{item.taxable.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">
                          ₹{gst.toLocaleString('en-IN')} ({item.gstRate}%)
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold tabular-nums">
                          ₹{(item.taxable + gst).toLocaleString('en-IN')}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.itcEligible
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {item.itcEligible ? 'Claimable' : 'Blocked'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => setExpenses((prev) => prev.filter((x) => x.id !== item.id))}
                            aria-label="Delete bill"
                            className="p-1 text-rose-700 hover:bg-rose-50 rounded cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      {expenses.length > 0 && (
        <ToolExportBar
          onClear={() => setExpenses([])}
          onExcel={exportExpensesExcel}
          onCsv={() => {
            downloadBomCsv({
              filename: 'VCPL_Expense_GST_Register.csv',
              headers: ['Date', 'Vendor', 'GSTIN', 'Invoice No', 'Category', 'Taxable Value', 'GST %', 'ITC Claimable'],
              rows: expenses.map((item) => [
                item.date,
                item.vendor,
                item.gstin || 'Unregistered',
                item.invoiceNo || '-',
                item.category,
                item.taxable,
                item.gstRate,
                item.itcEligible ? 'Yes' : 'Blocked',
              ]),
            });
          }}
          onWord={() => {
            void downloadWordDocument({
              filename: 'VCPL_Expense_GST_Register.docx',
              title: 'Business Expense & GST Input Tax Credit Register',
              kpis: [
                { label: 'Total Spend', value: `₹${expenseTotals.grandTotal.toLocaleString('en-IN')}` },
                { label: 'Claimable ITC', value: `₹${expenseTotals.claimableItc.toLocaleString('en-IN')}` },
                { label: 'Blocked ITC', value: `₹${expenseTotals.blockedItc.toLocaleString('en-IN')}` },
              ],
              table: {
                title: 'Expense Ledger',
                headers: ['Date', 'Vendor', 'Category', 'Taxable', 'Total', 'ITC'],
                rows: expenses.map((item) => {
                  const gst = (item.taxable * item.gstRate) / 100;
                  return [
                    item.date,
                    item.vendor,
                    item.category,
                    `₹${item.taxable.toLocaleString('en-IN')}`,
                    `₹${(item.taxable + gst).toLocaleString('en-IN')}`,
                    item.itcEligible ? 'Claimable' : 'Blocked',
                  ];
                }),
              },
            });
          }}
          onJson={() => {
            downloadJsonFile('VCPL_Expense_GST_Register.json', { summary: expenseTotals, expenses });
          }}
          onPdf={() => {
            exportStructuredReportPdf({
              title: 'Business Expense & GST ITC Register',
              filename: 'VCPL_Expense_GST_Register.pdf',
              kpis: [
                { label: 'Total Spend', value: `Rs. ${expenseTotals.grandTotal.toLocaleString('en-IN')}` },
                { label: 'Claimable ITC', value: `Rs. ${expenseTotals.claimableItc.toLocaleString('en-IN')}` },
              ],
              table: {
                title: 'Expense Entries',
                headers: ['Date', 'Vendor', 'Taxable', 'GST', 'ITC'],
                rows: expenses.map((item) => [
                  item.date,
                  item.vendor,
                  item.taxable.toLocaleString('en-IN'),
                  `${item.gstRate}%`,
                  item.itcEligible ? 'Claimable' : 'Blocked',
                ]),
              },
            });
          }}
          onPrint={() => {
            void printHtmlDocument({
              title: 'Business Expense & GST ITC Register',
              bodyHtml: `
                <h1>Business Expense &amp; GST ITC Register</h1>
                <table>
                  <thead><tr><th>Date</th><th>Vendor</th><th>Category</th><th class="num">Taxable</th><th class="num">Total</th><th>ITC</th></tr></thead>
                  <tbody>${expenses
                    .map((item) => {
                      const gst = (item.taxable * item.gstRate) / 100;
                      return `<tr><td>${item.date}</td><td>${item.vendor}</td><td>${item.category}</td><td class="num">₹${item.taxable.toLocaleString('en-IN')}</td><td class="num">₹${(item.taxable + gst).toLocaleString('en-IN')}</td><td>${item.itcEligible ? 'Claimable' : 'Blocked'}</td></tr>`;
                    })
                    .join('')}</tbody>
                </table>
              `,
            });
          }}
        />
      )}
      </div>
    </div>
  );
};
