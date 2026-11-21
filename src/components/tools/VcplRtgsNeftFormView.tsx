import React, { useEffect, useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import {
  BorderStyle,
  Document as DocxDocument,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  AlignmentType,
  WidthType,
} from 'docx';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Download,
  FileCode2,
  FileSpreadsheet,
  FileText,
  Landmark,
  Lock,
  Plus,
  Printer,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { ToolCatalogItem } from '../../types/tools';
import { downloadBomCsv } from '../../utils/printReport';
import { emitGlobalProgress } from '../TopLoadingBar';
import { FileDropZone } from './FileDropZone';
import { ToolPasscodeGate } from './ToolPasscodeGate';

interface VcplRtgsNeftFormViewProps {
  tool?: ToolCatalogItem;
  onBack?: () => void;
}

type TransferMode = 'Same Bank Transfer' | 'NEFT / RTGS' | 'NEFT' | 'RTGS';
type LetterheadMode = 'vcpl' | 'blank' | 'upload';

interface BankPresetAccount {
  bank: string;
  br: string;
  no: string;
  ifsc: string;
  addr: string;
}

interface PayeeRow {
  n: string;
  b: string;
  a: string;
  br: string;
  i: string;
  m: string;
}

const SAVED_ACCOUNTS: BankPresetAccount[] = [
  {
    bank: 'State Bank of India',
    br: 'Mallikatta (Mangaluru)',
    no: '40364536255',
    ifsc: 'SBIN0003823',
    addr: 'Branch Manager, State Bank of India, Mallikatta Branch, Mangalore.',
  },
  {
    bank: 'State Bank of India',
    br: 'Mallikatta (Mangaluru)',
    no: '40611996463',
    ifsc: 'SBIN0003823',
    addr: 'Branch Manager, State Bank of India, Mallikatta Branch, Mangalore.',
  },
  {
    bank: 'State Bank of India',
    br: 'Nagole',
    no: '40223707235',
    ifsc: 'SBIN0011079',
    addr: 'Branch Manager, State Bank of India, Nagole Branch, Hyderabad.',
  },
  {
    bank: 'HDFC Bank',
    br: 'Mangalore Kadri',
    no: '50200066162342',
    ifsc: 'HDFC0000094',
    addr: 'Branch Manager, HDFC Bank, Kadri Branch, Mangalore.',
  },
];

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

const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n: number): string {
  return n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ` ${ONES[n % 10]}` : '');
}

function numberToIndianWords(n: number): string {
  if (!n) return 'Zero';
  let rem = Math.floor(Math.abs(n));
  const out: string[] = [];
  const crore = Math.floor(rem / 1e7);
  rem %= 1e7;
  const lakh = Math.floor(rem / 1e5);
  rem %= 1e5;
  const thousand = Math.floor(rem / 1e3);
  rem %= 1e3;
  const hundred = Math.floor(rem / 100);
  rem %= 100;
  if (crore) out.push(`${twoDigits(crore)} Crore`);
  if (lakh) out.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) out.push(`${twoDigits(thousand)} Thousand`);
  if (hundred) out.push(`${ONES[hundred]} Hundred`);
  if (rem) out.push(twoDigits(rem));
  return out.join(' ');
}

function amountInWordsUpper(total: number): string {
  const safe = Math.max(0, Number.isFinite(total) ? total : 0);
  const rupees = Math.floor(safe);
  const paise = Math.round((safe - rupees) * 100);
  return `RUPEES ${numberToIndianWords(rupees).toUpperCase()}${
    paise ? ` AND ${numberToIndianWords(paise).toUpperCase()} PAISE` : ''
  } ONLY -`;
}

function formatDateDMY(iso: string): string {
  if (!iso || !iso.includes('-')) return '';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function formatINRDisplay(val: number): string {
  return Number(val || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function escHtml(s: string): string {
  return String(s ?? '').replace(/[&<>"]/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

const VCPL_LETTERHEAD_SVG_HTML = `
<div style="border-bottom:1.5px solid #1e293b;padding-bottom:6px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
  <div style="display:flex;align-items:center;gap:10px;">
    <svg width="58" height="36" viewBox="0 0 110 68" xmlns="http://www.w3.org/2000/svg" aria-label="VC Logo">
      <path d="M4 12 L22 12 L38 48 L54 12 L68 12 L44 60 L30 60 Z" fill="#0F294A"/>
      <path d="M98 18 C90 10 72 10 62 20 C52 30 52 46 62 55 C72 64 90 62 98 52 L88 44 C82 50 73 51 68 46 C62 40 62 31 68 25 C73 20 82 21 88 27 Z" fill="#1D6B68"/>
    </svg>
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.28;color:#0F172A;">
      <div style="font-size:21px;font-weight:900;letter-spacing:0.4px;color:#0A2540;">VARSHA CARS PVT. LTD</div>
      <div style="font-size:10.5px;font-weight:600;color:#1E293B;">D.No. 3-25/9, 3.25/10, &amp; 3-25/1, Near Old Kannur Check Post</div>
      <div style="font-size:10.5px;font-weight:600;color:#1E293B;">Mangalore-Bangalore Highway, Mangalore - 575 007, Karnataka</div>
      <div style="font-size:10.5px;font-weight:600;color:#1E293B;">Phone : 0824 - 2275777, 2275999</div>
      <div style="font-size:10.5px;font-weight:700;color:#0F172A;">CIN-U50103AP2021PTC118350 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; GST: 29AAICV0796M1ZH</div>
    </div>
  </div>
  <svg width="46" height="46" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-label="BMW Emblem">
    <circle cx="50" cy="50" r="46" fill="#FFFFFF" stroke="#0F172A" stroke-width="5"/>
    <circle cx="50" cy="50" r="32" fill="#FFFFFF" stroke="#0F172A" stroke-width="2.5"/>
    <path d="M50 18 A32 32 0 0 0 18 50 L50 50 Z" fill="#1C69D4"/>
    <path d="M50 82 A32 32 0 0 0 82 50 L50 50 Z" fill="#1C69D4"/>
    <path d="M50 18 L50 82 M18 50 L82 50" stroke="#0F172A" stroke-width="2"/>
    <text x="27" y="25" font-family="Arial,sans-serif" font-size="11" font-weight="900" fill="#0F172A" transform="rotate(-38 27 25)">B</text>
    <text x="45" y="15" font-family="Arial,sans-serif" font-size="11" font-weight="900" fill="#0F172A">M</text>
    <text x="68" y="20" font-family="Arial,sans-serif" font-size="11" font-weight="900" fill="#0F172A" transform="rotate(38 68 20)">W</text>
  </svg>
</div>`;

function VcplBuiltInLetterhead({ className = '' }: { className?: string }) {
  return (
    <div
      className={className}
      style={{
        borderBottom: '1.5px solid #1e293b',
        paddingBottom: '6px',
        marginBottom: '10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <svg width="58" height="36" viewBox="0 0 110 68" aria-label="VC Logo">
          <path d="M4 12 L22 12 L38 48 L54 12 L68 12 L44 60 L30 60 Z" fill="#0F294A" />
          <path
            d="M98 18 C90 10 72 10 62 20 C52 30 52 46 62 55 C72 64 90 62 98 52 L88 44 C82 50 73 51 68 46 C62 40 62 31 68 25 C73 20 82 21 88 27 Z"
            fill="#1D6B68"
          />
        </svg>
        <div
          style={{
            fontFamily: 'Arial, Helvetica, sans-serif',
            lineHeight: 1.28,
            color: '#0F172A',
          }}
        >
          <div
            style={{
              fontSize: '21px',
              fontWeight: 900,
              letterSpacing: '0.4px',
              color: '#0A2540',
            }}
          >
            VARSHA CARS PVT. LTD
          </div>
          <div style={{ fontSize: '10.5px', fontWeight: 600, color: '#1E293B' }}>
            D.No. 3-25/9, 3.25/10, &amp; 3-25/1, Near Old Kannur Check Post
          </div>
          <div style={{ fontSize: '10.5px', fontWeight: 600, color: '#1E293B' }}>
            Mangalore-Bangalore Highway, Mangalore - 575 007, Karnataka
          </div>
          <div style={{ fontSize: '10.5px', fontWeight: 600, color: '#1E293B' }}>
            Phone : 0824 - 2275777, 2275999
          </div>
          <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#0F172A' }}>
            CIN-U50103AP2021PTC118350 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; GST: 29AAICV0796M1ZH
          </div>
        </div>
      </div>

      <svg width="46" height="46" viewBox="0 0 100 100" aria-label="BMW Roundel">
        <circle cx="50" cy="50" r="46" fill="#FFFFFF" stroke="#0F172A" strokeWidth="5" />
        <circle cx="50" cy="50" r="32" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2.5" />
        <path d="M50 18 A32 32 0 0 0 18 50 L50 50 Z" fill="#1C69D4" />
        <path d="M50 82 A32 32 0 0 0 82 50 L50 50 Z" fill="#1C69D4" />
        <path d="M50 18 L50 82 M18 50 L82 50" stroke="#0F172A" strokeWidth="2" />
        <text
          x="27"
          y="25"
          fontFamily="Arial, sans-serif"
          fontSize="11"
          fontWeight="900"
          fill="#0F172A"
          transform="rotate(-38 27 25)"
        >
          B
        </text>
        <text x="45" y="15" fontFamily="Arial, sans-serif" fontSize="11" fontWeight="900" fill="#0F172A">
          M
        </text>
        <text
          x="68"
          y="20"
          fontFamily="Arial, sans-serif"
          fontSize="11"
          fontWeight="900"
          fill="#0F172A"
          transform="rotate(38 68 20)"
        >
          W
        </text>
      </svg>
    </div>
  );
}

export const VcplRtgsNeftFormView: React.FC<VcplRtgsNeftFormViewProps> = ({ tool, onBack }) => {
  return (
    <ToolPasscodeGate
      toolCode={tool?.code ?? 'VC-13'}
      toolTitle={tool?.title ?? 'VCPL Bulk Bank Transfer Form'}
      sessionKey="vcpl_rtgs_neft_form_unlocked_v1"
      passcode="202627"
      description="This VCPL Bulk Bank Transfer Form generator is locked for authorized dealership banking access. Enter the 6-digit passcode to unlock."
      onBack={onBack}
    >
      {({ lockTool }) => (
        <VcplBulkBankTransferWorkspace tool={tool} lockTool={lockTool} onBack={onBack} />
      )}
    </ToolPasscodeGate>
  );
};

const VcplBulkBankTransferWorkspace: React.FC<{
  tool?: ToolCatalogItem;
  lockTool: () => void;
  onBack?: () => void;
}> = ({ tool, lockTool, onBack }) => {
  // 1. Letterhead
  const [letterheadMode, setLetterheadMode] = useState<LetterheadMode>('vcpl');
  const [letterheadImg, setLetterheadImg] = useState<string>('');
  const [letterheadHeightMm, setLetterheadHeightMm] = useState<string>('35');

  // 2. Our bank account
  const [selectedAccIdx, setSelectedAccIdx] = useState<string>('0');
  const [last4Input, setLast4Input] = useState<string>('');
  const [last4Status, setLast4Status] = useState<{ text: string; tone: 'neutral' | 'ok' | 'bad' }>({
    text: '',
    tone: 'neutral',
  });
  const [accountNo, setAccountNo] = useState<string>(SAVED_ACCOUNTS[0].no);
  const [accountIfsc, setAccountIfsc] = useState<string>(SAVED_ACCOUNTS[0].ifsc);
  const [bankName, setBankName] = useState<string>(SAVED_ACCOUNTS[0].bank);
  const [branchName, setBranchName] = useState<string>(SAVED_ACCOUNTS[0].br);
  const [addressedTo, setAddressedTo] = useState<string>(SAVED_ACCOUNTS[0].addr);

  // 3. Letter & cheque details
  const [transferMode, setTransferMode] = useState<TransferMode>('Same Bank Transfer');
  const [letterDate, setLetterDate] = useState<string>(() => todayIso());
  const [chequeNo, setChequeNo] = useState<string>('');
  const [chequeDate, setChequeDate] = useState<string>(() => todayIso());
  const [remitterName, setRemitterName] = useState<string>('Varsha Cars Private Limited');
  const [signatoryName, setSignatoryName] = useState<string>('');

  // 4. Beneficiaries
  const [payees, setPayees] = useState<PayeeRow[]>([]);
  const [excelStatus, setExcelStatus] = useState<{ text: string; tone: 'neutral' | 'ok' | 'bad' }>({
    text: 'Same Bank: Account Name, Account Number, Amount. RTGS/NEFT: + Bank Name, Branch, IFSC Code.',
    tone: 'neutral',
  });

  // 5. Cheque copy
  const [showChequeArea, setShowChequeArea] = useState<boolean>(false);
  const [chequeImg, setChequeImg] = useState<string>('');
  const [chequeHeightMm, setChequeHeightMm] = useState<string>('70');

  // Export & Preview scaling
  const [exportMsg, setExportMsg] = useState<string>('');
  const [exportError, setExportError] = useState<string>('');
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [isExportingWord, setIsExportingWord] = useState<boolean>(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState<number>(1);
  const [sheetHeightPx, setSheetHeightPx] = useState<number>(1123);

  const letterheadInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const chequeInputRef = useRef<HTMLInputElement>(null);

  const isSameBank = transferMode === 'Same Bank Transfer';

  useEffect(() => {
    const updateSizes = () => {
      if (stageRef.current) {
        const availableWidth = Math.max(260, stageRef.current.clientWidth - 24);
        setPreviewScale(Math.min(1, availableWidth / 794));
      }
      if (sheetRef.current) {
        setSheetHeightPx(Math.max(1123, sheetRef.current.scrollHeight));
      }
    };
    updateSizes();
    const ro = new ResizeObserver(updateSizes);
    if (stageRef.current) ro.observe(stageRef.current);
    if (sheetRef.current) ro.observe(sheetRef.current);
    window.addEventListener('resize', updateSizes);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateSizes);
    };
  }, [
    payees,
    letterheadMode,
    letterheadImg,
    letterheadHeightMm,
    chequeImg,
    chequeHeightMm,
    showChequeArea,
    addressedTo,
    remitterName,
    signatoryName,
    transferMode,
  ]);

  const totalAmount = useMemo(() => {
    const paiseSum = payees.reduce((sum, row) => {
      const val = Number.parseFloat(String(row.m).replace(/,/g, ''));
      return sum + (Number.isFinite(val) ? Math.round(val * 100) : 0);
    }, 0);
    return Math.round(paiseSum) / 100;
  }, [payees]);

  const warnings = useMemo(() => {
    const list: string[] = [];
    if (transferMode === 'RTGS' && totalAmount < 200000) {
      list.push('RTGS usually needs a minimum of Rs. 2,00,000 per transaction.');
    }
    if (chequeNo.trim() && chequeNo.trim().length !== 6) {
      list.push('Cheque number is normally 6 digits.');
    }
    if (!isSameBank) {
      const missingIfsc = payees.filter((r) => r.n.trim() && !r.i.trim()).length;
      if (missingIfsc > 0) {
        list.push(`${missingIfsc} payee row(s) are missing IFSC code required for NEFT/RTGS.`);
      }
    }
    return list;
  }, [transferMode, isSameBank, totalAmount, chequeNo, payees]);

  const applyPresetAccount = (index: number) => {
    const acc = SAVED_ACCOUNTS[index];
    if (!acc) return;
    setAccountNo(acc.no);
    setAccountIfsc(acc.ifsc);
    setBankName(acc.bank);
    setBranchName(acc.br);
    setAddressedTo(acc.addr);
  };

  const handleSelectAccountChange = (val: string) => {
    setSelectedAccIdx(val);
    setLast4Input('');
    setLast4Status({ text: '', tone: 'neutral' });
    if (val === 'x') {
      setAccountNo('');
      setAccountIfsc('');
      setBankName('');
      setBranchName('');
      setAddressedTo('');
    } else {
      const idx = Number.parseInt(val, 10);
      if (Number.isFinite(idx)) applyPresetAccount(idx);
    }
  };

  const handleLast4Change = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 4);
    setLast4Input(digits);
    if (digits.length < 4) {
      setLast4Status({ text: '', tone: 'neutral' });
      return;
    }
    const foundIdx = SAVED_ACCOUNTS.findIndex((a) => a.no.slice(-4) === digits);
    if (foundIdx >= 0) {
      setSelectedAccIdx(String(foundIdx));
      applyPresetAccount(foundIdx);
      setLast4Status({
        text: `Matched: ${SAVED_ACCOUNTS[foundIdx].bank} - ${SAVED_ACCOUNTS[foundIdx].br}`,
        tone: 'ok',
      });
    } else {
      setLast4Status({
        text: `No saved account ends with ${digits}. Choose Other / custom and type details.`,
        tone: 'bad',
      });
    }
  };

  const handleTransferModeSwitch = (nextMode: TransferMode) => {
    setTransferMode(nextMode);
    setExportMsg('');
    setExportError('');
  };

  const readImageDataUrl = (file: File, onLoaded: (url: string) => void) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onLoaded(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const updatePayeeField = (idx: number, field: keyof PayeeRow, value: string) => {
    setPayees((prev) => prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row)));
  };

  const handleDownloadExcelFormat = () => {
    setExportError('');
    try {
      const head = isSameBank
        ? ['Account Name', 'Account Number', 'Amount']
        : ['Account Name', 'Bank Name', 'Account Number', 'Branch', 'IFSC Code', 'Amount'];
      const ws = XLSX.utils.aoa_to_sheet([head]);
      ws['!cols'] = isSameBank
        ? [{ wch: 36 }, { wch: 22 }, { wch: 16 }]
        : [{ wch: 40 }, { wch: 24 }, { wch: 22 }, { wch: 22 }, { wch: 14 }, { wch: 14 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Beneficiaries');
      const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
      const fname = isSameBank
        ? 'SameBank_Beneficiary_Format.xlsx'
        : 'NEFT_RTGS_Beneficiary_Format.xlsx';
      triggerBlobDownload(
        new Blob([buf], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
        fname
      );
      setExcelStatus({
        text: `Downloaded ${fname} template.`,
        tone: 'ok',
      });
    } catch (err) {
      setExcelStatus({
        text: err instanceof Error ? err.message : 'Unable to generate Excel template.',
        tone: 'bad',
      });
    }
  };

  const handleUploadExcelFile = async (file: File) => {
    setExportError('');
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const firstSheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: '' });

      const getCol = (obj: Record<string, unknown>, prefix: string): unknown => {
        for (const key of Object.keys(obj)) {
          const norm = key.toLowerCase().replace(/[^a-z]/g, '');
          if (norm.startsWith(prefix)) return obj[key];
        }
        return '';
      };

      const parsedRows: PayeeRow[] = rows
        .map((obj) => ({
          n: String(
            getCol(obj, 'accountname') || getCol(obj, 'payee') || getCol(obj, 'name') || ''
          ).trim(),
          b: String(getCol(obj, 'bank') || '').trim(),
          a: String(
            getCol(obj, 'accountnumber') || getCol(obj, 'accountno') || getCol(obj, 'acno') || ''
          ).trim(),
          br: String(getCol(obj, 'branch') || '').trim(),
          i: String(getCol(obj, 'ifsc') || '').trim().toUpperCase(),
          m: String(getCol(obj, 'amount') || '')
            .replace(/,/g, '')
            .trim(),
        }))
        .filter((r) => r.n || r.a || r.m);

      if (!parsedRows.length) {
        throw new Error('No beneficiary rows found');
      }

      setPayees(parsedRows);
      setExcelStatus({
        text: `Imported ${parsedRows.length} payees from ${file.name}`,
        tone: 'ok',
      });
    } catch {
      setExcelStatus({
        text: 'Could not read file. Use the downloaded Excel format.',
        tone: 'bad',
      });
    }
  };

  const handleExportSummaryExcel = () => {
    setExportMsg('');
    setExportError('');
    try {
      const header = isSameBank
        ? ['S.N', 'ACCOUNT NAME', 'ACCOUNT NUMBER', 'AMOUNT']
        : ['S.N', 'ACCOUNT NAME', 'BANK NAME', 'ACCOUNT NUMBER', 'BRANCH', 'IFSC CODE', 'AMOUNT'];
      const dataRows = payees.map((r, i) => {
        const amtNum = Number.parseFloat(String(r.m).replace(/,/g, '')) || 0;
        return isSameBank
          ? [i + 1, r.n, String(r.a), amtNum]
          : [i + 1, r.n, r.b, String(r.a), r.br, r.i, amtNum];
      });
      const totalRow = isSameBank
        ? ['', '', 'TOTAL', totalAmount]
        : ['', '', '', '', '', 'TOTAL', totalAmount];

      const metaRows = [
        ['VARSHA CARS PRIVATE LIMITED — BULK BANK TRANSFER SUMMARY'],
        ['Transfer Mode', transferMode, 'Letter Date', formatDateDMY(letterDate)],
        ['Remitter Name', remitterName, 'Remitter Account No', accountNo],
        ['Bank & Branch', `${bankName} — ${branchName}`, 'Cheque No & Date', `${chequeNo} (${formatDateDMY(chequeDate)})`],
        ['Amount in Words', amountInWordsUpper(totalAmount)],
        [],
        header,
        ...dataRows,
        totalRow,
      ];
      const ws = XLSX.utils.aoa_to_sheet(metaRows);
      ws['!cols'] = isSameBank
        ? [{ wch: 8 }, { wch: 36 }, { wch: 24 }, { wch: 16 }]
        : [{ wch: 8 }, { wch: 34 }, { wch: 22 }, { wch: 22 }, { wch: 20 }, { wch: 14 }, { wch: 16 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Bank_Transfer');
      const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
      const safeType = transferMode.replace(/[^A-Za-z]+/g, '_');
      const fname = `VCPL_${safeType}_Batch_${letterDate || todayIso()}.xlsx`;
      triggerBlobDownload(
        new Blob([buf], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
        fname
      );
      setExportMsg(`Exported Excel batch sheet (${fname}).`);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Unable to export Excel batch.');
    }
  };

  const handleExportCsv = () => {
    setExportMsg('');
    setExportError('');
    const headers = isSameBank
      ? ['S.N', 'ACCOUNT NAME', 'ACCOUNT NUMBER', 'AMOUNT']
      : ['S.N', 'ACCOUNT NAME', 'BANK NAME', 'ACCOUNT NUMBER', 'BRANCH', 'IFSC CODE', 'AMOUNT'];
    const rows = payees.map((r, i) => {
      const amtNum = Number.parseFloat(String(r.m).replace(/,/g, '')) || 0;
      return isSameBank ? [i + 1, r.n, r.a, amtNum] : [i + 1, r.n, r.b, r.a, r.br, r.i, amtNum];
    });
    const safeType = transferMode.replace(/[^A-Za-z]+/g, '_');
    downloadBomCsv(headers, rows, `VCPL_${safeType}_Payees_${letterDate || todayIso()}.csv`);
    setExportMsg('Exported UTF-8 CSV payee schedule.');
  };

  const handleExportWord = async () => {
    setIsExportingWord(true);
    setExportMsg('');
    setExportError('');
    emitGlobalProgress(true, 35);
    try {
      const cellBorders = {
        top: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
        bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
        left: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
        right: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
      };

      const children: (Paragraph | Table)[] = [];

      if (letterheadMode === 'vcpl') {
        children.push(
          new Paragraph({
            spacing: { after: 20 },
            children: [
              new TextRun({ text: 'VARSHA CARS PVT. LTD', bold: true, size: 30, color: '0A2540' }),
            ],
          }),
          new Paragraph({
            spacing: { after: 10 },
            children: [
              new TextRun({
                text: 'D.No. 3-25/9, 3.25/10, & 3-25/1, Near Old Kannur Check Post, Mangalore-Bangalore Highway, Mangalore - 575 007, Karnataka',
                size: 17,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 140 },
            border: {
              bottom: { style: BorderStyle.SINGLE, size: 12, color: '0F172A' },
            },
            children: [
              new TextRun({
                text: 'Phone : 0824 - 2275777, 2275999   |   CIN-U50103AP2021PTC118350   |   GST: 29AAICV0796M1ZH',
                size: 17,
                bold: true,
              }),
            ],
          })
        );
      } else {
        children.push(new Paragraph({ text: '', spacing: { after: 560 } }));
      }

      const letterHeading = isSameBank
        ? 'Payment Transfer Request Letter'
        : `${transferMode} Request Letter`;

      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 80, after: 160 },
          children: [
            new TextRun({
              text: letterHeading,
              bold: true,
              size: 26,
              underline: isSameBank ? undefined : {},
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { after: 60 },
          children: [new TextRun({ text: `Date: ${formatDateDMY(letterDate)}`, size: 22 })],
        }),
        new Paragraph({
          spacing: { after: 20 },
          children: [new TextRun({ text: 'To,', size: 22 })],
        }),
        ...addressParts.map(
          (line) =>
            new Paragraph({
              spacing: { after: 20 },
              children: [new TextRun({ text: line, size: 22 })],
            })
        ),
        new Paragraph({
          spacing: { before: 140, after: 40 },
          children: [new TextRun({ text: 'Dear Sir,', size: 22 })],
        }),
        new Paragraph({
          spacing: { after: 160 },
          children: [
            new TextRun({ text: 'Subject:   ', size: 22 }),
            new TextRun({
              text: isSameBank
                ? 'Amount Transfer Request to below mentioned account numbers:'
                : `${transferMode} Request to below mentioned account numbers:`,
              bold: !isSameBank,
              size: 22,
            }),
          ],
        }),
        new Paragraph({
          spacing: { after: 60 },
          children: [
            new TextRun({ text: 'A) Details of Applicant (Remitter):', bold: true, size: 22 }),
          ],
        })
      );

      const remitterItems: Array<[string, string]> = [
        ['1) Account Name:', remitterName],
        ['2) Account Number:', accountNo],
        ['3) Cheque Number:', chequeNo],
        ['4) Cheque Date:', formatDateDMY(chequeDate)],
        ['5) Cheque Amount:', `Rs. ${formatINRDisplay(totalAmount)}/-`],
      ];

      children.push(
        new Table({
          width: { size: 90, type: WidthType.PERCENTAGE },
          rows: remitterItems.map(
            ([k, v]) =>
              new TableRow({
                children: [
                  new TableCell({
                    borders: {
                      top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                      bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                      left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                      right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                    },
                    margins: { top: 30, bottom: 30, left: 260, right: 120 },
                    children: [new Paragraph({ children: [new TextRun({ text: k, size: 21 })] })],
                  }),
                  new TableCell({
                    borders: {
                      top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                      bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                      left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                      right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                    },
                    margins: { top: 30, bottom: 30, left: 60, right: 60 },
                    children: [new Paragraph({ children: [new TextRun({ text: v, size: 21 })] })],
                  }),
                ],
              })
          ),
        })
      );

      children.push(
        new Paragraph({
          spacing: { before: 160, after: 80 },
          children: [new TextRun({ text: 'B) Details of Beneficiaries:', bold: true, size: 22 })],
        })
      );

      const cols = isSameBank
        ? ['S.N', 'ACCOUNT NAME', 'ACCOUNT NUMBER', 'AMOUNT']
        : ['S.N', 'ACCOUNT NAME', 'BANK NAME', 'ACCOUNT NUMBER', 'BRANCH', 'IFSC CODE', 'AMOUNT'];

      const headerRow = new TableRow({
        children: cols.map(
          (col) =>
            new TableCell({
              borders: cellBorders,
              margins: { top: 70, bottom: 70, left: 90, right: 90 },
              children: [
                new Paragraph({
                  alignment: col === 'AMOUNT' ? AlignmentType.RIGHT : AlignmentType.LEFT,
                  children: [new TextRun({ text: col, bold: true, size: 20 })],
                }),
              ],
            })
        ),
      });

      const bodyRows = payees.map((row, idx) => {
        const amtNum = Number.parseFloat(String(row.m).replace(/,/g, ''));
        const amtStr =
          String(row.m).trim() !== '' && Number.isFinite(amtNum)
            ? formatINRDisplay(amtNum)
            : '';
        const vals = isSameBank
          ? [String(idx + 1), row.n, row.a, amtStr]
          : [String(idx + 1), row.n, row.b, row.a, row.br, row.i, amtStr];
        return new TableRow({
          children: vals.map(
            (val, cIdx) =>
              new TableCell({
                borders: cellBorders,
                margins: { top: 60, bottom: 60, left: 90, right: 90 },
                children: [
                  new Paragraph({
                    alignment: cIdx === vals.length - 1 ? AlignmentType.RIGHT : AlignmentType.LEFT,
                    children: [
                      new TextRun({
                        text: val,
                        bold: cIdx === vals.length - 1,
                        size: 20,
                      }),
                    ],
                  }),
                ],
              })
          ),
        });
      });

      const totalCells = isSameBank
        ? ['', '', 'TOTAL', formatINRDisplay(totalAmount)]
        : ['', '', '', '', '', 'TOTAL', formatINRDisplay(totalAmount)];

      const footerRow = new TableRow({
        children: totalCells.map(
          (val, cIdx) =>
            new TableCell({
              borders: cellBorders,
              margins: { top: 70, bottom: 70, left: 90, right: 90 },
              children: [
                new Paragraph({
                  alignment:
                    cIdx >= totalCells.length - 2 ? AlignmentType.RIGHT : AlignmentType.LEFT,
                  children: [new TextRun({ text: val, bold: true, size: 20 })],
                }),
              ],
            })
        ),
      });

      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [headerRow, ...bodyRows, footerRow],
        })
      );

      children.push(
        new Paragraph({
          spacing: { before: 160, after: 120 },
          children: [
            new TextRun({ text: 'Amount in Words: ', bold: true, size: 21 }),
            new TextRun({ text: amountInWordsUpper(totalAmount), size: 21 }),
          ],
        }),
        new Paragraph({
          spacing: { after: 160 },
          children: [
            new TextRun({
              text: 'Kindly requesting you to Transfer the above amount to mentioned Account Numbers.',
              size: 22,
            }),
          ],
        }),
        new Paragraph({
          spacing: { after: 40 },
          children: [new TextRun({ text: 'Thanking you,', size: 22 })],
        }),
        new Paragraph({
          spacing: { after: 480 },
          children: [new TextRun({ text: `For ${remitterName}`, size: 22 })],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: `Authorised Signatory.${signatoryName ? ` (${signatoryName})` : ''}`,
              size: 22,
            }),
          ],
        })
      );

      emitGlobalProgress(true, 80);
      const doc = new DocxDocument({ sections: [{ children }] });
      const blob = await Packer.toBlob(doc);
      const safeType = transferMode.replace(/[^A-Za-z]+/g, '_');
      const fname = `VCPL_${safeType}_Letter_${letterDate || todayIso()}.docx`;
      triggerBlobDownload(blob, fname);
      setExportMsg(`Exported Word (.docx) letter (${fname}).`);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Word export failed.');
    } finally {
      emitGlobalProgress(false);
      setIsExportingWord(false);
    }
  };

  const handlePrint = () => {
    setExportMsg('');
    setExportError('');
    try {
      window.print();
    } catch {
      setExportError('Print is blocked in this view. Use Download A4 PDF or Save Letter as HTML.');
    }
  };

  const handleSaveDirectPdf = async () => {
    if (!sheetRef.current) return;
    setIsExportingPdf(true);
    setExportMsg('');
    setExportError('');
    emitGlobalProgress(true, 35);
    try {
      const target = sheetRef.current;
      const prevTransform = target.style.transform;
      target.style.transform = 'none';
      const canvas = await html2canvas(target, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });
      target.style.transform = prevTransform;
      emitGlobalProgress(true, 75);

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pdfHeight;

      while (heightLeft > 2) {
        position -= pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pdfHeight;
      }

      const safeType = transferMode.replace(/[^A-Za-z]+/g, '_');
      pdf.save(`VCPL_${safeType}_Letter_${letterDate || todayIso()}.pdf`);
      setExportMsg('Saved crisp A4 PDF directly to your Downloads.');
    } catch (err) {
      setExportError(
        err instanceof Error ? `PDF export failed: ${err.message}` : 'Unable to export direct PDF.'
      );
    } finally {
      emitGlobalProgress(false);
      setIsExportingPdf(false);
    }
  };

  const handleSaveHtml = () => {
    setExportMsg('');
    setExportError('');
    const lhMm = Math.max(0, Number.parseFloat(letterheadHeightMm) || 0);
    const cqMm = Math.max(20, Number.parseFloat(chequeHeightMm) || 70);
    const headerHtml =
      letterheadMode === 'vcpl'
        ? VCPL_LETTERHEAD_SVG_HTML
        : letterheadMode === 'upload' && letterheadImg
          ? `<img src="${letterheadImg}" alt="Letterhead" style="display:block;max-width:100%" />`
          : `<div style="height:${lhMm}mm"></div>`;

    const bodyRowsHtml = payees
      .map((r, i) => {
        const amtNum = Number.parseFloat(String(r.m).replace(/,/g, ''));
        const amtText =
          String(r.m).trim() !== '' && Number.isFinite(amtNum) ? formatINRDisplay(amtNum) : '';
        if (isSameBank) {
          return `<tr><td>${i + 1}</td><td>${escHtml(r.n)}</td><td>${escHtml(
            r.a
          )}</td><td class="r"><b>${amtText}</b></td></tr>`;
        }
        return `<tr><td>${i + 1}</td><td>${escHtml(r.n)}</td><td>${escHtml(r.b)}</td><td>${escHtml(
          r.a
        )}</td><td>${escHtml(r.br)}</td><td>${escHtml(r.i)}</td><td class="r">${amtText}</td></tr>`;
      })
      .join('');

    const chequeHtml = showChequeArea
      ? chequeImg
        ? `<div style="margin-top:5mm;text-align:center"><img src="${chequeImg}" alt="Cheque copy" style="margin:0 auto;max-height:${cqMm}mm;object-fit:contain;display:block;max-width:100%" /></div>`
        : `<div style="height:${cqMm}mm;margin-top:5mm"></div>`
      : '';
    const addrLinesHtml = (addressedTo || '')
      .split(',')
      .map((s) => escHtml(s.trim()))
      .filter(Boolean)
      .join('<br>');

    const topDateRowHtml = isSameBank
      ? `<div class="hd" style="align-items:flex-start"><div>To,<br>${addrLinesHtml}</div><div style="white-space:nowrap">Date: ${escHtml(
          formatDateDMY(letterDate)
        )}</div></div>`
      : `<div class="hd"><div></div><div>Date: ${escHtml(
          formatDateDMY(letterDate)
        )}</div></div>`;

    const titleText = isSameBank
      ? 'Payment Transfer Request Letter'
      : `${escHtml(transferMode)} Request Letter`;
    const titleStyle = isSameBank ? 'text-decoration:none' : 'text-decoration:underline';
    const subjectText = isSameBank
      ? 'Amount Transfer Request to below mentioned account numbers:'
      : `<b>${escHtml(transferMode)} Request to below mentioned account numbers:</b>`;

    const tableHeadHtml = isSameBank
      ? '<tr><th style="width:42px">S.N</th><th>ACCOUNT NAME</th><th style="width:140px">ACCOUNT NUMBER</th><th class="r" style="width:115px">AMOUNT</th></tr>'
      : '<tr><th>S.N</th><th>ACCOUNT NAME</th><th>BANK NAME</th><th>ACCOUNT NUMBER</th><th>BRANCH</th><th>IFSC CODE</th><th class="r">AMOUNT</th></tr>';

    const totalColSpan = isSameBank ? 2 : 6;
    const totalRowHtml = isSameBank
      ? `<tr><td></td><td colspan="${totalColSpan}" class="r"><b>TOTAL</b></td><td class="r"><b>${formatINRDisplay(
          totalAmount
        )}</b></td></tr>`
      : `<tr><td colspan="${totalColSpan}" class="r"><b>TOTAL</b></td><td class="r"><b>${formatINRDisplay(
          totalAmount
        )}</b></td></tr>`;

    const docHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escHtml(titleText)}</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;background:#eef1f5;padding:16px}
  .paper{background:#fff;color:#000;width:210mm;min-height:297mm;margin:0 auto;padding:10mm 14mm;box-shadow:0 2px 14px rgba(0,0,0,.25);font:13px/1.45 "Times New Roman",Georgia,serif}
  .paper h2{text-align:center;font-size:15px;margin:2mm 0 4mm}
  .paper .hd{display:flex;justify-content:space-between;gap:10px}
  .paper table.t{width:100%;border-collapse:collapse;margin:2mm 0}
  .paper table.t th,.paper table.t td{border:1px solid #000;padding:3px 6px;font-size:12px;text-align:left;vertical-align:top}
  .paper table.t td.r,.paper table.t th.r{text-align:right}
  .paper table.a td{padding:1px 16px 1px 0}
  .sig{margin-top:3mm;display:flex;justify-content:space-between;align-items:flex-end}
  @media print{@page{size:A4;margin:0}body{background:#fff;padding:0}.paper{box-shadow:none;margin:0;min-height:296mm}}
</style>
</head>
<body>
<div class="paper">
  ${headerHtml}
  ${
    isSameBank
      ? `<h2 style="${titleStyle}">${titleText}</h2>${topDateRowHtml}`
      : `${topDateRowHtml}<h2 style="${titleStyle}">${titleText}</h2><div>To,<br>${addrLinesHtml}</div>`
  }
  <p style="margin:4mm 0 0">Dear Sir,<br>Subject:&nbsp;&nbsp;&nbsp;&nbsp;${subjectText}</p>
  <p style="margin:4mm 0 0"><b>A) Details of Applicant (Remitter):</b></p>
  <table class="a" style="margin-left:6mm">
    <tr><td>1) Account Name:</td><td>${escHtml(remitterName)}</td></tr>
    <tr><td>2) Account Number:</td><td>${escHtml(accountNo)}</td></tr>
    <tr><td>3) Cheque Number:</td><td>${escHtml(chequeNo)}</td></tr>
    <tr><td>4) Cheque Date:</td><td>${escHtml(formatDateDMY(chequeDate))}</td></tr>
    <tr><td>5) Cheque Amount:</td><td>Rs. ${formatINRDisplay(totalAmount)}/-</td></tr>
  </table>
  <p style="margin:4mm 0 0"><b>B) Details of Beneficiaries:</b></p>
  <table class="t">
    ${tableHeadHtml}
    ${bodyRowsHtml}
    ${totalRowHtml}
  </table>
  <p style="margin:3mm 0"><b>Amount in Words:</b> ${escHtml(amountInWordsUpper(totalAmount))}</p>
  <p style="margin:3mm 0">Kindly requesting you to Transfer the above amount to mentioned Account Numbers.</p>
  <div class="sig"><div>Thanking you,<br>For ${isSameBank ? '' : '<b>'}${escHtml(
    remitterName
  )}${isSameBank ? '' : '</b>'}<div style="height:16mm"></div>Authorised Signatory.${
      signatoryName ? ` - ${escHtml(signatoryName)}` : ''
    }</div><div style="height:22mm;width:40mm"></div></div>
  ${chequeHtml}
</div>
</body>
</html>`;

    const safeType = transferMode.replace(/[^A-Za-z]+/g, '_');
    const fname = `VCPL_${safeType}_Request_Letter.html`;
    triggerBlobDownload(new Blob([docHtml], { type: 'text/html;charset=utf-8' }), fname);
    setExportMsg(`Saved standalone ${fname}.`);
  };

  const handleResetAll = () => {
    setLetterheadMode('vcpl');
    setLetterheadImg('');
    setLetterheadHeightMm('35');
    setSelectedAccIdx('0');
    setLast4Input('');
    setLast4Status({ text: '', tone: 'neutral' });
    applyPresetAccount(0);
    setTransferMode('Same Bank Transfer');
    const iso = todayIso();
    setLetterDate(iso);
    setChequeDate(iso);
    setChequeNo('');
    setRemitterName('Varsha Cars Private Limited');
    setSignatoryName('');
    setPayees([]);
    setShowChequeArea(false);
    setChequeImg('');
    setChequeHeightMm('70');
    setExcelStatus({
      text: 'Reset form to clean VCPL defaults.',
      tone: 'neutral',
    });
    setExportMsg('');
    setExportError('');
  };

  const handleClearForm = () => {
    setChequeNo('');
    setSignatoryName('');
    setPayees([]);
    setChequeImg('');
    setExportMsg('Cleared beneficiary rows and cheque fields.');
    setExportError('');
  };

  const lhMmNum = Math.max(0, Number.parseFloat(letterheadHeightMm) || 0);
  const cqMmNum = Math.max(20, Number.parseFloat(chequeHeightMm) || 70);
  const addressParts = (addressedTo || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div className="space-y-5 print:space-y-0">
      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          #vcpl-rtgs-scale-box {
            width: 210mm !important;
            height: auto !important;
          }
          #vcpl-rtgs-sheet {
            transform: none !important;
            width: 210mm !important;
            min-height: 296mm !important;
            box-shadow: none !important;
            border: 0 !important;
            margin: 0 !important;
          }
        }
      `}</style>

      {/* Top VCPL Header Card */}
      <div className="no-print bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-5 sm:p-6 shadow-[0_4px_0_#2F3E4E] dark:shadow-[0_4px_0_#020617] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <span className="w-11 h-11 rounded-xl bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] text-[#2F3E4E] flex items-center justify-center shrink-0">
            <Landmark className="w-5 h-5" aria-hidden="true" />
          </span>
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B] dark:text-slate-400">
              <span className="font-mono font-bold text-[#2F3E4E] dark:text-[#F9C80E]">
                {tool?.suite || 'VCPL Tools'} · {tool?.code || 'VC-13'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 font-semibold text-[#12805C] dark:text-emerald-300">
                <Lock className="w-3 h-3" aria-hidden="true" />
                <span>Unlocked</span>
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-[#B45309] dark:text-amber-300">
                Same-Bank SBI &amp; NEFT/RTGS
              </span>
            </div>
            <h1 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] dark:text-slate-100 leading-tight">
              {tool?.title || 'VCPL Bulk Bank Transfer Form'}
            </h1>
            <p className="text-xs sm:text-sm text-[#475569] dark:text-slate-300">
              Varsha Cars Private Limited · Generate Same-Bank (SBI Intra-Bank) &amp; NEFT/RTGS
              bulk transfer letters with built-in VCPL letterhead, Excel batching, Word/PDF/CSV &amp; A4 print.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleClearForm}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl border-[1.5px] border-rose-600/40 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-xs font-bold text-rose-700 dark:text-rose-300 transition cursor-pointer whitespace-nowrap"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Clear</span>
          </button>
          <button
            type="button"
            onClick={handleResetAll}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] hover:bg-[#FEF2C8] dark:hover:bg-slate-800 text-xs font-bold text-[#2F3E4E] dark:text-slate-100 transition cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Reset Default</span>
          </button>
          <button
            type="button"
            onClick={lockTool}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-[#FEF2C8] dark:bg-slate-800 hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] dark:text-slate-100 dark:hover:text-[#0F172A] transition cursor-pointer whitespace-nowrap"
          >
            <Lock className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Lock Tool</span>
          </button>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center min-h-[40px] px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-[#2F3E4E] text-[#FFFDF5] hover:bg-[#1E293B] text-xs font-bold transition cursor-pointer whitespace-nowrap"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Main Split Workspace: Controls (Left) + Live A4 Letter Preview (Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start print:block">
        {/* Left Control Column */}
        <div className="xl:col-span-5 space-y-4 no-print">
          {/* 1. Letterhead */}
          <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-4 sm:p-5 shadow-[0_3px_0_#2F3E4E] dark:shadow-[0_3px_0_#020617] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display font-extrabold text-xs uppercase tracking-wider text-[#2F3E4E] dark:text-[#F9C80E]">
                1. Letterhead
              </h2>
              {letterheadMode === 'upload' && letterheadImg && (
                <button
                  type="button"
                  onClick={() => {
                    setLetterheadImg('');
                    if (letterheadInputRef.current) letterheadInputRef.current.value = '';
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-500/40 bg-rose-50 dark:bg-rose-950/50 text-[11px] font-bold text-rose-700 dark:text-rose-300 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" aria-hidden="true" />
                  <span>Remove image</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#FEF2C8]/70 dark:bg-[#0B1120] border border-[#2F3E4E]/20 dark:border-slate-700">
              {(
                [
                  ['vcpl', 'VCPL Header'],
                  ['blank', 'Pre-Printed'],
                  ['upload', 'Custom Img'],
                ] as const
              ).map(([modeKey, label]) => (
                <button
                  key={modeKey}
                  type="button"
                  onClick={() => setLetterheadMode(modeKey)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                    letterheadMode === modeKey
                      ? 'bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#FFFDF5] dark:text-[#0F172A]'
                      : 'text-[#475569] dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {letterheadMode === 'vcpl' && (
              <p className="text-[11px] text-[#12805C] dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>
                  Built-in VARSHA CARS PVT. LTD + BMW Roundel letterhead (CIN &amp; GST 29AAICV0796M1ZH).
                </span>
              </p>
            )}

            {letterheadMode === 'blank' && (
              <div>
                <label
                  htmlFor="rtgs-lh-height"
                  className="block text-xs font-semibold text-[#475569] dark:text-slate-300 mb-1"
                >
                  Blank top margin for pre-printed paper (mm)
                </label>
                <input
                  id="rtgs-lh-height"
                  type="number"
                  min={0}
                  value={letterheadHeightMm}
                  onChange={(e) => setLetterheadHeightMm(e.target.value)}
                  className="w-full min-h-[38px] px-3 rounded-xl border border-[#2F3E4E]/30 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs sm:text-sm font-mono text-[#2F3E4E] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
                />
              </div>
            )}

            {letterheadMode === 'upload' && (
              <div>
                <label
                  htmlFor="rtgs-lh-file"
                  className="block text-xs font-semibold text-[#475569] dark:text-slate-300 mb-1"
                >
                  Upload custom letterhead image
                </label>
                <input
                  ref={letterheadInputRef}
                  id="rtgs-lh-file"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) readImageDataUrl(f, setLetterheadImg);
                  }}
                  className="w-full text-xs text-[#2F3E4E] dark:text-slate-200 file:mr-2.5 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-[#2F3E4E]/30 file:bg-[#FEF2C8] file:text-[#2F3E4E] file:font-bold file:text-xs cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* 2. Our bank account */}
          <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-4 sm:p-5 shadow-[0_3px_0_#2F3E4E] dark:shadow-[0_3px_0_#020617] space-y-3">
            <h2 className="font-display font-extrabold text-xs uppercase tracking-wider text-[#2F3E4E] dark:text-[#F9C80E]">
              2. Our bank account
            </h2>

            <div>
              <label
                htmlFor="rtgs-acc-select"
                className="block text-xs font-semibold text-[#475569] dark:text-slate-300 mb-1"
              >
                Select account
              </label>
              <select
                id="rtgs-acc-select"
                value={selectedAccIdx}
                onChange={(e) => handleSelectAccountChange(e.target.value)}
                className="w-full min-h-[38px] px-3 rounded-xl border border-[#2F3E4E]/30 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs sm:text-sm font-semibold text-[#2F3E4E] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
              >
                {SAVED_ACCOUNTS.map((acc, i) => (
                  <option key={acc.no} value={String(i)}>
                    {acc.bank} - {acc.br} - XXXX{acc.no.slice(-4)}
                  </option>
                ))}
                <option value="x">Other / custom account</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="rtgs-last4"
                className="block text-xs font-semibold text-[#475569] dark:text-slate-300 mb-1"
              >
                Or type last 4 digits of account number
              </label>
              <input
                id="rtgs-last4"
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={last4Input}
                onChange={(e) => handleLast4Change(e.target.value)}
                placeholder="e.g. 6255"
                className="w-full min-h-[38px] px-3 rounded-xl border border-[#2F3E4E]/30 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs sm:text-sm font-mono text-[#2F3E4E] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
              />
              {last4Status.text && (
                <p
                  className={`mt-1 text-[11px] font-semibold ${
                    last4Status.tone === 'ok'
                      ? 'text-[#12805C] dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {last4Status.text}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label
                  htmlFor="rtgs-ano"
                  className="block text-xs font-semibold text-[#475569] dark:text-slate-300 mb-1"
                >
                  Account number
                </label>
                <input
                  id="rtgs-ano"
                  type="text"
                  value={accountNo}
                  onChange={(e) => setAccountNo(e.target.value)}
                  className="w-full min-h-[36px] px-3 rounded-xl border border-[#2F3E4E]/30 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-mono text-[#2F3E4E] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
                />
              </div>
              <div>
                <label
                  htmlFor="rtgs-ifsc"
                  className="block text-xs font-semibold text-[#475569] dark:text-slate-300 mb-1"
                >
                  IFSC
                </label>
                <input
                  id="rtgs-ifsc"
                  type="text"
                  value={accountIfsc}
                  onChange={(e) => setAccountIfsc(e.target.value.toUpperCase())}
                  className="w-full min-h-[36px] px-3 rounded-xl border border-[#2F3E4E]/30 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-mono text-[#2F3E4E] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
                />
              </div>
              <div>
                <label
                  htmlFor="rtgs-bank"
                  className="block text-xs font-semibold text-[#475569] dark:text-slate-300 mb-1"
                >
                  Bank
                </label>
                <input
                  id="rtgs-bank"
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full min-h-[36px] px-3 rounded-xl border border-[#2F3E4E]/30 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs text-[#2F3E4E] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
                />
              </div>
              <div>
                <label
                  htmlFor="rtgs-branch"
                  className="block text-xs font-semibold text-[#475569] dark:text-slate-300 mb-1"
                >
                  Branch
                </label>
                <input
                  id="rtgs-branch"
                  type="text"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  className="w-full min-h-[36px] px-3 rounded-xl border border-[#2F3E4E]/30 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs text-[#2F3E4E] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="rtgs-addr"
                className="block text-xs font-semibold text-[#475569] dark:text-slate-300 mb-1"
              >
                Letter addressed to (Branch Manager address)
              </label>
              <input
                id="rtgs-addr"
                type="text"
                value={addressedTo}
                onChange={(e) => setAddressedTo(e.target.value)}
                className="w-full min-h-[38px] px-3 rounded-xl border border-[#2F3E4E]/30 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs sm:text-sm text-[#2F3E4E] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
              />
            </div>
          </div>

          {/* 3. Letter & cheque details */}
          <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-4 sm:p-5 shadow-[0_3px_0_#2F3E4E] dark:shadow-[0_3px_0_#020617] space-y-3">
            <h2 className="font-display font-extrabold text-xs uppercase tracking-wider text-[#2F3E4E] dark:text-[#F9C80E]">
              3. Transfer mode &amp; cheque details
            </h2>

            {/* Quick Mode Segmented Selector */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 rounded-xl bg-[#FEF2C8]/70 dark:bg-[#0B1120] border border-[#2F3E4E]/20 dark:border-slate-700">
              {(['Same Bank Transfer', 'NEFT / RTGS', 'NEFT', 'RTGS'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleTransferModeSwitch(m)}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition cursor-pointer whitespace-nowrap ${
                    transferMode === m
                      ? 'bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#FFFDF5] dark:text-[#0F172A]'
                      : 'text-[#475569] dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
                  }`}
                >
                  {m === 'Same Bank Transfer' ? 'Same Bank (SBI)' : m}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label
                  htmlFor="rtgs-ldate"
                  className="block text-xs font-semibold text-[#475569] dark:text-slate-300 mb-1"
                >
                  Letter date
                </label>
                <input
                  id="rtgs-ldate"
                  type="date"
                  value={letterDate}
                  onChange={(e) => setLetterDate(e.target.value)}
                  className="w-full min-h-[38px] px-2.5 rounded-xl border border-[#2F3E4E]/30 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-mono text-[#2F3E4E] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
                />
              </div>
              <div>
                <label
                  htmlFor="rtgs-chq"
                  className="block text-xs font-semibold text-[#475569] dark:text-slate-300 mb-1"
                >
                  Cheque number
                </label>
                <input
                  id="rtgs-chq"
                  type="text"
                  value={chequeNo}
                  onChange={(e) => setChequeNo(e.target.value)}
                  placeholder="6 digits"
                  className="w-full min-h-[38px] px-2.5 rounded-xl border border-[#2F3E4E]/30 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-mono text-[#2F3E4E] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
                />
              </div>
              <div>
                <label
                  htmlFor="rtgs-cdate"
                  className="block text-xs font-semibold text-[#475569] dark:text-slate-300 mb-1"
                >
                  Cheque date
                </label>
                <input
                  id="rtgs-cdate"
                  type="date"
                  value={chequeDate}
                  onChange={(e) => setChequeDate(e.target.value)}
                  className="w-full min-h-[38px] px-2.5 rounded-xl border border-[#2F3E4E]/30 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-mono text-[#2F3E4E] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="rtgs-aname"
                className="block text-xs font-semibold text-[#475569] dark:text-slate-300 mb-1"
              >
                Account name (remitter)
              </label>
              <input
                id="rtgs-aname"
                type="text"
                value={remitterName}
                onChange={(e) => setRemitterName(e.target.value)}
                className="w-full min-h-[38px] px-3 rounded-xl border border-[#2F3E4E]/30 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs sm:text-sm font-semibold text-[#2F3E4E] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
              />
            </div>

            <div>
              <label
                htmlFor="rtgs-sname"
                className="block text-xs font-semibold text-[#475569] dark:text-slate-300 mb-1"
              >
                Authorised signatory name (optional, printed below sign)
              </label>
              <input
                id="rtgs-sname"
                type="text"
                value={signatoryName}
                onChange={(e) => setSignatoryName(e.target.value)}
                placeholder="Leave blank if unsigned"
                className="w-full min-h-[38px] px-3 rounded-xl border border-[#2F3E4E]/30 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs sm:text-sm text-[#2F3E4E] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
              />
            </div>

            <div className="rounded-xl bg-[#FEF2C8]/80 dark:bg-[#0B1120] border border-[#2F3E4E]/20 dark:border-slate-700 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-[#475569] dark:text-slate-300">
                Total payees:{' '}
                <strong className="font-mono tabular-nums text-[#2F3E4E] dark:text-slate-100">
                  {payees.length}
                </strong>
              </span>
              <span className="text-[#475569] dark:text-slate-300">
                Total amount:{' '}
                <strong className="font-mono tabular-nums text-[#12805C] dark:text-emerald-400">
                  Rs. {formatINRDisplay(totalAmount)}/-
                </strong>
              </span>
            </div>
          </div>

          {/* 4. Beneficiaries (payees) */}
          <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-4 sm:p-5 shadow-[0_3px_0_#2F3E4E] dark:shadow-[0_3px_0_#020617] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display font-extrabold text-xs uppercase tracking-wider text-[#2F3E4E] dark:text-[#F9C80E]">
                4. Beneficiaries ({isSameBank ? '3 Columns · Same Bank' : '6 Columns · NEFT/RTGS'})
              </h2>
            </div>

            <FileDropZone
              accept=".xlsx,.xls,.csv"
              multiple={false}
              onFiles={(files) => {
                if (files[0]) void handleUploadExcelFile(files[0]);
              }}
              className="rounded-xl border border-dashed border-[#2F3E4E]/35 dark:border-slate-600 bg-white/70 dark:bg-[#0B1120]/70 p-2.5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadExcelFormat}
                  className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-lg bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#FFFDF5] dark:text-[#0F172A] text-xs font-bold cursor-pointer whitespace-nowrap"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Download Excel Format</span>
                </button>

                <button
                  type="button"
                  onClick={() => excelInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-lg border border-[#2F3E4E]/35 dark:border-slate-600 bg-[#FEF2C8] dark:bg-slate-800 hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] text-[#2F3E4E] dark:text-slate-100 dark:hover:text-[#0F172A] text-xs font-bold cursor-pointer whitespace-nowrap"
                >
                  <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Upload Filled Excel</span>
                </button>
                <input
                  ref={excelInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleUploadExcelFile(f);
                    e.target.value = '';
                  }}
                />
              </div>
              <p
                className={`mt-2 text-[11px] font-medium flex items-center gap-1.5 ${
                  excelStatus.tone === 'ok'
                    ? 'text-[#12805C] dark:text-emerald-400'
                    : excelStatus.tone === 'bad'
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-[#64748B] dark:text-slate-400'
                }`}
              >
                {excelStatus.tone === 'ok' && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                <span>{excelStatus.text}</span>
              </p>
            </FileDropZone>

            {/* Editable Payee Grid */}
            <div className="overflow-x-auto max-h-[320px] overflow-y-auto rounded-xl border border-[#2F3E4E]/25 dark:border-slate-700 bg-white dark:bg-[#0B1120]">
              <table
                className={`w-full ${isSameBank ? 'min-w-[440px]' : 'min-w-[740px]'} border-collapse text-xs`}
              >
                <thead className="sticky top-0 z-10 bg-[#FEF2C8] dark:bg-slate-800 text-[#2F3E4E] dark:text-slate-200 border-b border-[#2F3E4E]/25 dark:border-slate-700">
                  <tr>
                    <th className="px-2 py-2 text-left font-bold">#</th>
                    <th className="px-2 py-2 text-left font-bold">Account name</th>
                    {!isSameBank && <th className="px-2 py-2 text-left font-bold">Bank</th>}
                    <th className="px-2 py-2 text-left font-bold">Account no.</th>
                    {!isSameBank && <th className="px-2 py-2 text-left font-bold">Branch</th>}
                    {!isSameBank && <th className="px-2 py-2 text-left font-bold">IFSC</th>}
                    <th className="px-2 py-2 text-right font-bold">Amount</th>
                    <th className="px-2 py-2 text-center font-bold"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2F3E4E]/10 dark:divide-slate-800">
                  {payees.map((row, idx) => (
                    <tr key={idx}>
                      <td className="px-2 py-1.5 font-mono font-bold text-[#64748B] dark:text-slate-400 tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="p-1">
                        <input
                          type="text"
                          value={row.n}
                          onChange={(e) => updatePayeeField(idx, 'n', e.target.value)}
                          placeholder="Beneficiary name"
                          className="w-[175px] px-2 py-1 rounded border border-[#2F3E4E]/20 dark:border-slate-700 bg-white dark:bg-[#131C2E] text-xs text-[#2F3E4E] dark:text-slate-100"
                        />
                      </td>
                      {!isSameBank && (
                        <td className="p-1">
                          <input
                            type="text"
                            value={row.b}
                            onChange={(e) => updatePayeeField(idx, 'b', e.target.value)}
                            className="w-[115px] px-2 py-1 rounded border border-[#2F3E4E]/20 dark:border-slate-700 bg-white dark:bg-[#131C2E] text-xs text-[#2F3E4E] dark:text-slate-100"
                          />
                        </td>
                      )}
                      <td className="p-1">
                        <input
                          type="text"
                          value={row.a}
                          onChange={(e) => updatePayeeField(idx, 'a', e.target.value)}
                          placeholder="Account number"
                          className="w-[130px] px-2 py-1 rounded border border-[#2F3E4E]/20 dark:border-slate-700 bg-white dark:bg-[#131C2E] text-xs font-mono text-[#2F3E4E] dark:text-slate-100"
                        />
                      </td>
                      {!isSameBank && (
                        <td className="p-1">
                          <input
                            type="text"
                            value={row.br}
                            onChange={(e) => updatePayeeField(idx, 'br', e.target.value)}
                            className="w-[105px] px-2 py-1 rounded border border-[#2F3E4E]/20 dark:border-slate-700 bg-white dark:bg-[#131C2E] text-xs text-[#2F3E4E] dark:text-slate-100"
                          />
                        </td>
                      )}
                      {!isSameBank && (
                        <td className="p-1">
                          <input
                            type="text"
                            value={row.i}
                            onChange={(e) => updatePayeeField(idx, 'i', e.target.value.toUpperCase())}
                            className="w-[100px] px-2 py-1 rounded border border-[#2F3E4E]/20 dark:border-slate-700 bg-white dark:bg-[#131C2E] text-xs font-mono text-[#2F3E4E] dark:text-slate-100"
                          />
                        </td>
                      )}
                      <td className="p-1">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={row.m}
                          onChange={(e) => updatePayeeField(idx, 'm', e.target.value)}
                          placeholder="0"
                          className="w-[90px] px-2 py-1 rounded border border-[#2F3E4E]/20 dark:border-slate-700 bg-white dark:bg-[#131C2E] text-xs font-mono tabular-nums text-right text-[#2F3E4E] dark:text-slate-100"
                        />
                      </td>
                      <td className="p-1 text-center">
                        <button
                          type="button"
                          onClick={() => setPayees((prev) => prev.filter((_, i) => i !== idx))}
                          aria-label={`Remove payee ${idx + 1}`}
                          className="p-1 text-rose-600 hover:text-rose-800 dark:text-rose-400 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {payees.length === 0 && (
                    <tr>
                      <td
                        colSpan={isSameBank ? 5 : 8}
                        className="px-4 py-6 text-center text-xs text-[#64748B] dark:text-slate-400"
                      >
                        No beneficiaries added yet. Click &ldquo;+ Add row&rdquo; or
                        upload your Excel sheet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setPayees((prev) => [
                    ...prev,
                    { n: '', b: isSameBank ? bankName : '', a: '', br: '', i: '', m: '' },
                  ])
                }
                className="inline-flex items-center gap-1 min-h-[34px] px-3 py-1 rounded-lg border border-[#2F3E4E]/35 dark:border-slate-600 bg-white dark:bg-[#0B1120] hover:bg-[#FEF2C8] dark:hover:bg-slate-800 text-xs font-bold text-[#2F3E4E] dark:text-slate-100 cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Add row</span>
              </button>
              <button
                type="button"
                onClick={() => setPayees([])}
                className="inline-flex items-center gap-1 min-h-[34px] px-3 py-1 rounded-lg border border-rose-500/35 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-xs font-bold text-rose-700 dark:text-rose-300 cursor-pointer whitespace-nowrap"
              >
                <span>Clear rows</span>
              </button>
            </div>
          </div>

          {/* 5. Cheque copy (bottom) */}
          <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-4 sm:p-5 shadow-[0_3px_0_#2F3E4E] dark:shadow-[0_3px_0_#020617] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display font-extrabold text-xs uppercase tracking-wider text-[#2F3E4E] dark:text-[#F9C80E]">
                5. Cheque copy (bottom)
              </h2>
              {chequeImg && (
                <button
                  type="button"
                  onClick={() => {
                    setChequeImg('');
                    if (chequeInputRef.current) chequeInputRef.current.value = '';
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-500/40 bg-rose-50 dark:bg-rose-950/50 text-[11px] font-bold text-rose-700 dark:text-rose-300 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" aria-hidden="true" />
                  <span>Remove image</span>
                </button>
              )}
            </div>

            <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#2F3E4E] dark:text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={showChequeArea}
                onChange={(e) => setShowChequeArea(e.target.checked)}
                className="w-4 h-4 rounded border-[#2F3E4E] text-[#1E3A5F] focus:ring-[#F9C80E] cursor-pointer"
              />
              <span>Show cheque copy area at bottom</span>
            </label>

            {showChequeArea && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="rtgs-cf-file"
                    className="block text-xs font-semibold text-[#475569] dark:text-slate-300 mb-1"
                  >
                    Upload cheque copy image
                  </label>
                  <input
                    ref={chequeInputRef}
                    id="rtgs-cf-file"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) readImageDataUrl(f, setChequeImg);
                    }}
                    className="w-full text-xs text-[#2F3E4E] dark:text-slate-200 file:mr-2.5 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-[#2F3E4E]/30 file:bg-[#FEF2C8] file:text-[#2F3E4E] file:font-bold file:text-xs cursor-pointer"
                  />
                </div>

                <div>
                  <label
                    htmlFor="rtgs-ch-height"
                    className="block text-xs font-semibold text-[#475569] dark:text-slate-300 mb-1"
                  >
                    Area height (mm)
                  </label>
                  <input
                    id="rtgs-ch-height"
                    type="number"
                    min={20}
                    value={chequeHeightMm}
                    onChange={(e) => setChequeHeightMm(e.target.value)}
                    className="w-full min-h-[38px] px-3 rounded-xl border border-[#2F3E4E]/30 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs sm:text-sm font-mono text-[#2F3E4E] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 6. Full Export & Print Suite */}
          <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-4 sm:p-5 shadow-[0_3px_0_#2F3E4E] dark:shadow-[0_3px_0_#020617] space-y-3">
            <h2 className="font-display font-extrabold text-xs uppercase tracking-wider text-[#2F3E4E] dark:text-[#F9C80E]">
              6. Export &amp; Print Letter
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 rounded-xl bg-[#2F3E4E] dark:bg-[#F9C80E] hover:bg-[#1E293B] dark:hover:bg-[#FDE047] text-[#FFFDF5] dark:text-[#0F172A] text-xs font-display font-extrabold shadow-[0_2px_0_#0F172A] dark:shadow-[0_2px_0_#92400E] cursor-pointer whitespace-nowrap"
              >
                <Printer className="w-4 h-4" aria-hidden="true" />
                <span>Print Letter</span>
              </button>

              <button
                type="button"
                onClick={() => void handleSaveDirectPdf()}
                disabled={isExportingPdf}
                className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-[#F9C80E] dark:bg-slate-800 hover:bg-[#FDE047] dark:hover:bg-slate-700 text-[#2F3E4E] dark:text-slate-100 text-xs font-bold cursor-pointer disabled:opacity-60 whitespace-nowrap"
              >
                <Download className="w-4 h-4" aria-hidden="true" />
                <span>{isExportingPdf ? 'Rendering...' : 'A4 PDF'}</span>
              </button>

              <button
                type="button"
                onClick={() => void handleExportWord()}
                disabled={isExportingWord}
                className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] hover:bg-[#FEF2C8] dark:hover:bg-slate-800 text-xs font-bold text-[#2F3E4E] dark:text-slate-100 cursor-pointer disabled:opacity-60 whitespace-nowrap"
              >
                <FileText className="w-4 h-4" aria-hidden="true" />
                <span>{isExportingWord ? 'Building...' : 'Word (.docx)'}</span>
              </button>

              <button
                type="button"
                onClick={handleExportSummaryExcel}
                className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] hover:bg-[#FEF2C8] dark:hover:bg-slate-800 text-xs font-bold text-[#2F3E4E] dark:text-slate-100 cursor-pointer whitespace-nowrap"
              >
                <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
                <span>Excel (.xlsx)</span>
              </button>

              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] hover:bg-[#FEF2C8] dark:hover:bg-slate-800 text-xs font-bold text-[#2F3E4E] dark:text-slate-100 cursor-pointer whitespace-nowrap"
              >
                <Download className="w-4 h-4" aria-hidden="true" />
                <span>CSV</span>
              </button>

              <button
                type="button"
                onClick={handleSaveHtml}
                className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] hover:bg-[#FEF2C8] dark:hover:bg-slate-800 text-xs font-bold text-[#2F3E4E] dark:text-slate-100 cursor-pointer whitespace-nowrap"
              >
                <FileCode2 className="w-4 h-4" aria-hidden="true" />
                <span>HTML</span>
              </button>
            </div>

            {warnings.length > 0 && (
              <div className="p-2.5 rounded-xl bg-[#FFE1B3]/75 dark:bg-amber-950/50 border border-[#C85A32]/50 text-xs font-semibold text-[#92400E] dark:text-amber-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{warnings.join(' ')}</span>
              </div>
            )}

            {exportError && (
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-500/40 text-xs font-semibold text-rose-700 dark:text-rose-300">
                {exportError}
              </div>
            )}

            {exportMsg && (
              <p className="text-xs font-semibold text-[#12805C] dark:text-emerald-400">
                {exportMsg}
              </p>
            )}
          </div>
        </div>

        {/* Right Column: Scaled Live A4 Paper Sheet */}
        <div className="xl:col-span-7 xl:sticky xl:top-20 space-y-3 print:static print:space-y-0 print:w-full">
          <div className="no-print bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-[#475569] dark:text-slate-300">
            <span>
              <strong className="text-[#2F3E4E] dark:text-slate-100">Live A4 Letter Preview</strong>{' '}
              · {transferMode} · {payees.length} payee(s)
            </span>
            <span className="font-mono font-bold text-[#12805C] dark:text-emerald-400 tabular-nums">
              Fit {Math.round(previewScale * 100)}% · Rs. {formatINRDisplay(totalAmount)}/-
            </span>
          </div>

          <div
            ref={stageRef}
            className="w-full rounded-2xl bg-[#E9DFBE]/75 dark:bg-slate-900/70 border-[1.5px] border-[#2F3E4E] dark:border-slate-700 p-3 flex justify-center overflow-hidden shadow-[0_4px_0_#2F3E4E] dark:shadow-[0_4px_0_#020617] print:border-0 print:bg-transparent print:p-0 print:shadow-none print:overflow-visible"
          >
            <div
              id="vcpl-rtgs-scale-box"
              style={{
                width: `${Math.ceil(794 * previewScale)}px`,
                height: `${Math.ceil(sheetHeightPx * previewScale)}px`,
              }}
              className="relative shrink-0 overflow-hidden print:static print:overflow-visible"
            >
              <div
                id="vcpl-rtgs-sheet"
                ref={sheetRef}
                style={{
                  width: '794px',
                  minHeight: '1123px',
                  padding: '10mm 14mm',
                  fontFamily: '"Times New Roman", Georgia, serif',
                  fontSize: '13.5px',
                  lineHeight: 1.48,
                  color: '#000000',
                  backgroundColor: '#ffffff',
                  transform: `scale(${previewScale})`,
                  transformOrigin: 'top left',
                }}
                className="border border-[#2F3E4E]/35 shadow-[0_8px_24px_rgba(47,62,78,0.18)] print:border-0 print:shadow-none"
              >
                {/* Letterhead: Built-in VCPL+BMW / Upload / Blank Space */}
                {letterheadMode === 'vcpl' ? (
                  <VcplBuiltInLetterhead />
                ) : letterheadMode === 'upload' && letterheadImg ? (
                  <img
                    src={letterheadImg}
                    alt="Company letterhead"
                    style={{ display: 'block', maxWidth: '100%' }}
                  />
                ) : (
                  <div style={{ height: `${lhMmNum}mm` }} />
                )}

                {isSameBank ? (
                  <>
                    {/* Centered Bold Title */}
                    <h2
                      style={{
                        textAlign: 'center',
                        fontSize: '15.5px',
                        fontWeight: 'bold',
                        margin: '2.5mm 0 4mm',
                        fontFamily: '"Times New Roman", Georgia, serif',
                      }}
                    >
                      Payment Transfer Request Letter
                    </h2>

                    {/* To Address Left + Date Right */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '12px',
                      }}
                    >
                      <div>
                        To,
                        {addressParts.map((line, i) => (
                          <React.Fragment key={i}>
                            <br />
                            {line}
                          </React.Fragment>
                        ))}
                      </div>
                      <div style={{ whiteSpace: 'nowrap', paddingTop: '2mm' }}>
                        Date: {formatDateDMY(letterDate)}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                      <div />
                      <div>Date: {formatDateDMY(letterDate)}</div>
                    </div>

                    <h2
                      style={{
                        textAlign: 'center',
                        fontSize: '15px',
                        fontWeight: 'bold',
                        margin: '2mm 0 4mm',
                        textDecoration: 'underline',
                        fontFamily: '"Times New Roman", Georgia, serif',
                      }}
                    >
                      {transferMode} Request Letter
                    </h2>

                    <div>
                      To,
                      {addressParts.map((line, i) => (
                        <React.Fragment key={i}>
                          <br />
                          {line}
                        </React.Fragment>
                      ))}
                    </div>
                  </>
                )}

                <p style={{ margin: '4mm 0 0' }}>
                  Dear Sir,
                  <br />
                  Subject:{' '}
                  {isSameBank ? (
                    <span>&nbsp;&nbsp;&nbsp;Amount Transfer Request to below mentioned account numbers:</span>
                  ) : (
                    <b>{transferMode} Request to below mentioned account numbers:</b>
                  )}
                </p>

                {/* A) Applicant / Remitter Details */}
                <p style={{ margin: '4mm 0 0' }}>
                  <b>A) Details of Applicant (Remitter):</b>
                </p>
                <table style={{ marginLeft: '6mm', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: '1.5px 28px 1.5px 0' }}>1) Account Name:</td>
                      <td style={{ padding: '1.5px 6px 1.5px 0' }}>{remitterName}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '1.5px 28px 1.5px 0' }}>2) Account Number:</td>
                      <td style={{ padding: '1.5px 6px 1.5px 0' }}>{accountNo}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '1.5px 28px 1.5px 0' }}>3) Cheque Number:</td>
                      <td style={{ padding: '1.5px 6px 1.5px 0' }}>{chequeNo}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '1.5px 28px 1.5px 0' }}>4) Cheque Date:</td>
                      <td style={{ padding: '1.5px 6px 1.5px 0' }}>{formatDateDMY(chequeDate)}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '1.5px 28px 1.5px 0' }}>5) Cheque Amount:</td>
                      <td style={{ padding: '1.5px 6px 1.5px 0' }}>
                        Rs. {formatINRDisplay(totalAmount)}/-
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* B) Beneficiaries Table */}
                <p style={{ margin: '4mm 0 0' }}>
                  <b>B) Details of Beneficiaries:</b>
                </p>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    margin: '2mm 0',
                  }}
                >
                  <thead>
                    <tr>
                      {(isSameBank
                        ? ['S.N', 'ACCOUNT NAME', 'ACCOUNT NUMBER']
                        : ['S.N', 'ACCOUNT NAME', 'BANK NAME', 'ACCOUNT NUMBER', 'BRANCH', 'IFSC CODE']
                      ).map((h) => (
                        <th
                          key={h}
                          style={{
                            border: '1px solid #000',
                            padding: '4px 6px',
                            fontSize: '12px',
                            textAlign: 'left',
                            verticalAlign: 'top',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                      <th
                        style={{
                          border: '1px solid #000',
                          padding: '4px 6px',
                          fontSize: '12px',
                          textAlign: 'left',
                          verticalAlign: 'top',
                          width: isSameBank ? '120px' : undefined,
                        }}
                      >
                        AMOUNT
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {payees.map((row, i) => {
                      const amtNum = Number.parseFloat(String(row.m).replace(/,/g, ''));
                      const amtStr =
                        String(row.m).trim() !== '' && Number.isFinite(amtNum)
                          ? formatINRDisplay(amtNum)
                          : '';
                      return (
                        <tr key={i}>
                          <td
                            style={{
                              border: '1px solid #000',
                              padding: '3.5px 6px',
                              fontSize: '12.5px',
                              verticalAlign: 'top',
                              textAlign: isSameBank ? 'center' : 'left',
                            }}
                          >
                            {i + 1}
                          </td>
                          <td
                            style={{
                              border: '1px solid #000',
                              padding: '3.5px 6px',
                              fontSize: '12.5px',
                              verticalAlign: 'top',
                            }}
                          >
                            {row.n}
                          </td>
                          {!isSameBank && (
                            <td
                              style={{
                                border: '1px solid #000',
                                padding: '3.5px 6px',
                                fontSize: '12px',
                                verticalAlign: 'top',
                              }}
                            >
                              {row.b}
                            </td>
                          )}
                          <td
                            style={{
                              border: '1px solid #000',
                              padding: '3.5px 6px',
                              fontSize: '12.5px',
                              verticalAlign: 'top',
                            }}
                          >
                            {row.a}
                          </td>
                          {!isSameBank && (
                            <td
                              style={{
                                border: '1px solid #000',
                                padding: '3.5px 6px',
                                fontSize: '12px',
                                verticalAlign: 'top',
                              }}
                            >
                              {row.br}
                            </td>
                          )}
                          {!isSameBank && (
                            <td
                              style={{
                                border: '1px solid #000',
                                padding: '3.5px 6px',
                                fontSize: '12px',
                                verticalAlign: 'top',
                              }}
                            >
                              {row.i}
                            </td>
                          )}
                          <td
                            style={{
                              border: '1px solid #000',
                              padding: '3.5px 6px',
                              fontSize: '12.5px',
                              fontWeight: isSameBank ? 'bold' : 'normal',
                              textAlign: 'right',
                              verticalAlign: 'top',
                            }}
                          >
                            {amtStr}
                          </td>
                        </tr>
                      );
                    })}
                    {isSameBank ? (
                      <tr>
                        <td style={{ border: '1px solid #000', padding: '4px 6px' }} />
                        <td style={{ border: '1px solid #000', padding: '4px 6px' }} />
                        <td
                          style={{
                            border: '1px solid #000',
                            padding: '4px 6px',
                            fontSize: '12.5px',
                            textAlign: 'center',
                            fontWeight: 'bold',
                          }}
                        >
                          TOTAL
                        </td>
                        <td
                          style={{
                            border: '1px solid #000',
                            padding: '4px 6px',
                            fontSize: '12.5px',
                            textAlign: 'right',
                            fontWeight: 'bold',
                          }}
                        >
                          {formatINRDisplay(totalAmount)}
                        </td>
                      </tr>
                    ) : (
                      <tr>
                        <td
                          colSpan={6}
                          style={{
                            border: '1px solid #000',
                            padding: '4px 6px',
                            fontSize: '12px',
                            textAlign: 'right',
                            fontWeight: 'bold',
                          }}
                        >
                          TOTAL
                        </td>
                        <td
                          style={{
                            border: '1px solid #000',
                            padding: '4px 6px',
                            fontSize: '12px',
                            textAlign: 'right',
                            fontWeight: 'bold',
                          }}
                        >
                          {formatINRDisplay(totalAmount)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                <p style={{ margin: '3mm 0' }}>
                  <b>Amount in Words:</b> {amountInWordsUpper(totalAmount)}
                </p>

                <p style={{ margin: '3mm 0' }}>
                  Kindly requesting you to Transfer the above amount to mentioned Account Numbers.
                </p>

                {/* Signature Area */}
                <div
                  style={{
                    marginTop: '4mm',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-end',
                  }}
                >
                  <div>
                    Thanking you,
                    <br />
                    For {isSameBank ? remitterName : <b>{remitterName}</b>}
                    <div style={{ height: '16mm' }} />
                    Authorised Signatory.{signatoryName ? ` - ${signatoryName}` : ''}
                  </div>
                  <div style={{ height: '22mm', width: '40mm' }} />
                </div>

                {/* Cheque Copy Area at Bottom */}
                {showChequeArea &&
                  (chequeImg ? (
                    <div style={{ marginTop: '5mm', textAlign: 'center' }}>
                      <img
                        src={chequeImg}
                        alt="Cheque copy"
                        style={{
                          margin: '0 auto',
                          maxHeight: `${cqMmNum}mm`,
                          objectFit: 'contain',
                          display: 'block',
                          maxWidth: '100%',
                        }}
                      />
                    </div>
                  ) : (
                    <div style={{ height: `${cqMmNum}mm`, marginTop: '5mm' }} />
                  ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
