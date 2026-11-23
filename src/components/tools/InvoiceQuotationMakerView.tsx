import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import QRCode from 'qrcode';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import {
  Check,
  Download,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import { ToolCatalogItem } from '../../types/tools';
import {
  buildNpciUpiIntentUrl,
  validateNpciUpiIntentUrl,
} from '../../utils/npciUpiValidator';
import { printTargetElement } from '../../utils/printReport';
import { FileDropZone } from './FileDropZone';

interface InvoiceQuotationMakerViewProps {
  tool?: ToolCatalogItem;
  onBack?: () => void;
}

type DocType = 'tax' | 'proforma' | 'quote';
type TaxMode = 'auto' | 'intra' | 'inter';

interface PartyInfo {
  name: string;
  addr: string;
  gstin: string;
  state: string;
  code: string;
  phone: string;
  email: string;
  pan: string;
}

interface BankInfo {
  holder: string;
  name: string;
  acc: string;
  ifsc: string;
  branch: string;
  upi: string;
}

interface InvoiceProfile {
  co: PartyInfo;
  bank: BankInfo;
  sig: string;
  decl: string;
  terms: string;
  prefix: string;
  prefixP: string;
  prefixQ: string;
}

interface InvoiceMeta {
  no: string;
  valid: string;
  date: string;
  dn: string;
  mode: string;
  ref: string;
  oref: string;
  bo: string;
  bod: string;
  dd: string;
  dnd: string;
  dt: string;
  dest: string;
  tod: string;
}

interface InvoiceLineItem {
  desc: string;
  hsn: string;
  qty: string | number;
  unit: string;
  rate: string | number;
  disc: string | number;
  gst: string | number;
}

interface InvoiceDocumentState {
  type: DocType;
  inv: InvoiceMeta;
  buyer: PartyInfo;
  cons: PartyInfo;
  same: boolean;
  taxMode: TaxMode;
  round: boolean;
  qrAmt: boolean;
  items: InvoiceLineItem[];
}

interface SavedInvoiceRecord {
  id: string;
  label: string;
  sub: string;
  data: InvoiceDocumentState;
}

const PROFILE_KEY = 'vcpl_inv_profile_v1';
const SAVED_LIST_KEY = 'vcpl_inv_saved_v1';

const DOC_TITLES: Record<DocType, string> = {
  tax: 'Tax Invoice',
  proforma: 'Proforma Invoice',
  quote: 'Quotation',
};

const INDIAN_STATES: Record<string, string> = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli and Daman & Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
  '97': 'Other Territory',
  '99': 'Centre Jurisdiction',
};

const STATE_CODES = Object.keys(INDIAN_STATES).sort();

const BLANK_PARTY: PartyInfo = {
  name: '',
  addr: '',
  gstin: '',
  state: '',
  code: '',
  phone: '',
  email: '',
  pan: '',
};

const DEFAULT_PROFILE: InvoiceProfile = {
  co: { ...BLANK_PARTY },
  bank: { holder: '', name: '', acc: '', ifsc: '', branch: '', upi: '' },
  sig: '',
  decl: 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.',
  terms: '',
  prefix: 'INV/',
  prefixP: 'PI/',
  prefixQ: 'QT/',
};

function getTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore browser quota restrictions
  }
}

function getCounterKey(type: DocType): string {
  return type === 'tax' ? 'vcpl_inv_counter' : `vcpl_inv_counter_${type}`;
}

function getDocPrefix(prof: InvoiceProfile, type: DocType): string {
  if (type === 'proforma') return prof.prefixP || 'PI/';
  if (type === 'quote') return prof.prefixQ || 'QT/';
  return prof.prefix ?? 'INV/';
}

function getNextDocNo(prof: InvoiceProfile, type: DocType): string {
  const prev = loadJson<number>(getCounterKey(type), 0);
  return `${getDocPrefix(prof, type)}${prev + 1}`;
}

function createBlankInvoice(prof: InvoiceProfile, type: DocType = 'tax'): InvoiceDocumentState {
  return {
    type,
    inv: {
      no: getNextDocNo(prof, type),
      valid: '',
      date: getTodayIso(),
      dn: '',
      mode: '',
      ref: '',
      oref: '',
      bo: '',
      bod: '',
      dd: '',
      dnd: '',
      dt: '',
      dest: '',
      tod: '',
    },
    buyer: { ...BLANK_PARTY },
    cons: { ...BLANK_PARTY },
    same: true,
    taxMode: 'auto',
    round: true,
    qrAmt: true,
    items: [{ desc: '', hsn: '', qty: 1, unit: 'Nos', rate: 0, disc: 0, gst: 18 }],
  };
}

function toNum(v: unknown): number {
  const parsed = Number.parseFloat(String(v ?? '0'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function fmtInr(v: number): string {
  return v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

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

function words99(x: number): string {
  return x < 20 ? ONES[x] : TENS[Math.floor(x / 10)] + (x % 10 ? ` ${ONES[x % 10]}` : '');
}

function words999(x: number): string {
  const h = x >= 100 ? `${ONES[Math.floor(x / 100)]} Hundred${x % 100 ? ' ' : ''}` : '';
  return h + (x % 100 ? words99(x % 100) : '');
}

function wordsInt(x: number): string {
  if (x === 0) return 'Zero';
  const parts: string[] = [];
  let rem = Math.floor(x);
  const crore = Math.floor(rem / 1e7);
  rem %= 1e7;
  const lakh = Math.floor(rem / 1e5);
  rem %= 1e5;
  const thousand = Math.floor(rem / 1e3);
  rem %= 1e3;
  if (crore) parts.push(`${words999(crore)} Crore`);
  if (lakh) parts.push(`${words99(lakh)} Lakh`);
  if (thousand) parts.push(`${words99(thousand)} Thousand`);
  if (rem) parts.push(words999(rem));
  return parts.join(' ');
}

function amountToWords(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  const rupees = Math.floor(rounded);
  const paise = Math.round((rounded - rupees) * 100);
  return `Indian Rupee ${wordsInt(rupees)}${paise ? ` and ${wordsInt(paise)} Paise` : ''} Only`;
}

function formatDisplayDate(d: string): string {
  if (!d) return '';
  const dt = new Date(`${d}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return d;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${String(dt.getDate()).padStart(2, '0')}-${months[dt.getMonth()]}-${String(
    dt.getFullYear()
  ).slice(-2)}`;
}

function parseExcelDate(v: unknown): string {
  if (v instanceof Date) {
    const d = new Date(v.getTime() + 43200000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
  }
  const s = String(v ?? '').trim();
  if (!s) return '';
  const match = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (match) {
    const year = match[3].length === 2 ? `20${match[3]}` : match[3];
    return `${year}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  }
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : '';
}

function resolveStateCodeFromInput(val: unknown): string {
  const s = String(val ?? '').trim();
  if (!s) return '';
  if (/^\d+$/.test(s)) {
    const padded = s.padStart(2, '0').slice(-2);
    return INDIAN_STATES[padded] ? padded : '';
  }
  const lower = s.toLowerCase().replace(/&/g, 'and');
  for (const code of STATE_CODES) {
    const stateNorm = INDIAN_STATES[code].toLowerCase().replace(/&/g, 'and');
    if (stateNorm === lower || stateNorm.startsWith(lower) || lower.startsWith(stateNorm)) {
      return code;
    }
  }
  return '';
}

function getPartyStateCode(party: PartyInfo): string {
  let c = String(party.code || '').trim();
  if (!c && /^\d{2}/.test(party.gstin || '')) {
    c = party.gstin.slice(0, 2);
  }
  return INDIAN_STATES[c] ? c : '';
}

export const InvoiceQuotationMakerView: React.FC<InvoiceQuotationMakerViewProps> = ({ tool }) => {
  const [profile, setProfile] = useState<InvoiceProfile>(() => {
    const loaded = loadJson<Partial<InvoiceProfile>>(PROFILE_KEY, {});
    return {
      ...DEFAULT_PROFILE,
      ...loaded,
      co: { ...BLANK_PARTY, ...(loaded.co ?? {}) },
      bank: { ...DEFAULT_PROFILE.bank, ...(loaded.bank ?? {}) },
    };
  });

  const [doc, setDoc] = useState<InvoiceDocumentState>(() => createBlankInvoice(profile, 'tax'));
  const [currentSavedId, setCurrentSavedId] = useState<string | null>(null);
  const [savedList, setSavedList] = useState<SavedInvoiceRecord[]>(() =>
    loadJson<SavedInvoiceRecord[]>(SAVED_LIST_KEY, [])
  );

  const [excelMessage, setExcelMessage] = useState('');
  const [saveFeedback, setSaveFeedback] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [upiQrDataUrl, setUpiQrDataUrl] = useState('');

  // Auto-scale A4 preview container
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const paperRef = useRef<HTMLDivElement | null>(null);
  const excelUploadRef = useRef<HTMLInputElement | null>(null);
  const sigUploadRef = useRef<HTMLInputElement | null>(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [paperHeightPx, setPaperHeightPx] = useState(1123);

  useEffect(() => {
    saveJson(PROFILE_KEY, profile);
  }, [profile]);

  const updatePreviewScale = useCallback(() => {
    const container = previewContainerRef.current;
    if (!container) return;
    const availWidth = container.clientWidth;
    if (availWidth > 0) {
      const widthScale = availWidth / 794;
      const isDesktopSplit = typeof window !== 'undefined' && window.innerWidth >= 1280;
      const heightScale = isDesktopSplit
        ? Math.max(460, window.innerHeight - 165) / 1123
        : 1;
      setPreviewScale(Math.min(1, Math.max(0.32, Math.min(widthScale, heightScale))));
    }
  }, []);

  useEffect(() => {
    updatePreviewScale();
    const container = previewContainerRef.current;
    const paper = paperRef.current;
    const measurePaper = () => {
      if (paper) {
        setPaperHeightPx(Math.max(1123, paper.offsetHeight));
      }
    };
    measurePaper();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updatePreviewScale);
      return () => window.removeEventListener('resize', updatePreviewScale);
    }
    let rafId = 0;
    const scheduleUpdate = () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        updatePreviewScale();
        measurePaper();
      });
    };
    const ro = new ResizeObserver(scheduleUpdate);
    if (container) ro.observe(container);
    if (paper) ro.observe(paper);
    window.addEventListener('resize', scheduleUpdate);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      ro.disconnect();
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, [updatePreviewScale]);

  const calc = useMemo(() => {
    const supplyParty = doc.same ? doc.buyer : doc.cons;
    const buyerCode = getPartyStateCode(supplyParty);
    const companyCode = getPartyStateCode(profile.co);
    const intra =
      doc.taxMode === 'intra' ||
      (doc.taxMode === 'auto' && (!buyerCode || !companyCode || buyerCode === companyCode));

    let taxableTotal = 0;
    let taxTotal = 0;
    let qtyTotal = 0;
    const hsnMap: Record<string, { hsn: string; rate: number; tv: number; tax: number }> = {};

    const rows = doc.items.map((item) => {
      const qty = toNum(item.qty);
      const rate = toNum(item.rate);
      const disc = toNum(item.disc);
      const gst = toNum(item.gst);
      const taxable = qty * rate * (1 - disc / 100);
      const taxAmt = (taxable * gst) / 100;

      taxableTotal += taxable;
      taxTotal += taxAmt;
      qtyTotal += qty;

      const key = `${item.hsn || ''}|${gst}`;
      if (!hsnMap[key]) {
        hsnMap[key] = { hsn: item.hsn || '', rate: gst, tv: 0, tax: 0 };
      }
      hsnMap[key].tv += taxable;
      hsnMap[key].tax += taxAmt;

      return { item, taxable };
    });

    let grandTotal = taxableTotal + taxTotal;
    let roundOff = 0;
    if (doc.round) {
      const rounded = Math.round(grandTotal);
      roundOff = rounded - grandTotal;
      grandTotal = rounded;
    }

    return {
      rows,
      taxableTotal,
      taxTotal,
      qtyTotal,
      hsnRows: Object.values(hsnMap),
      intra,
      roundOff,
      grandTotal,
      supplyParty,
      buyerCode,
    };
  }, [doc, profile.co]);

  // Dynamically generate embedded UPI QR code on invoice when UPI ID or valid Bank A/C + IFSC is present
  useEffect(() => {
    const rawUpi = String(profile.bank.upi || '').replace(/\s+/g, '').trim();
    const rawAcc = String(profile.bank.acc || '').replace(/\s+/g, '').trim();
    const rawIfsc = String(profile.bank.ifsc || '').replace(/\s+/g, '').toUpperCase().trim();

    let vpaTarget = '';
    if (rawUpi && /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z0-9.-]{2,64}$/.test(rawUpi)) {
      vpaTarget = rawUpi.toLowerCase();
    } else if (/^\d{9,18}$/.test(rawAcc) && /^[A-Z]{4}0[A-Z0-9]{6}$/.test(rawIfsc)) {
      vpaTarget = `${rawAcc}@${rawIfsc.toLowerCase()}.ifsc.npci`;
    }

    if (!vpaTarget) {
      setUpiQrDataUrl('');
      return;
    }

    const rawName = (profile.co.name || profile.bank.holder || 'Payee')
      .replace(/[&=?#%\\]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 50);
    const cleanRef = String(doc.inv.no || '')
      .replace(/[^A-Za-z0-9\-_/]/g, '')
      .slice(0, 35);
    const cleanNote = `${DOC_TITLES[doc.type]} ${doc.inv.no || ''}`
      .replace(/[&=?#%\\]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 50);

    const uri = buildNpciUpiIntentUrl({
      pa: vpaTarget,
      pn: rawName || 'Payee',
      tr: cleanRef,
      tn: cleanNote,
      am: doc.qrAmt && calc.grandTotal > 0 ? calc.grandTotal : undefined,
      cu: 'INR',
    });

    const intentCheck = validateNpciUpiIntentUrl(uri);
    if (!intentCheck.isValid) {
      setUpiQrDataUrl('');
      return;
    }

    let cancelled = false;
    QRCode.toDataURL(uri, {
      width: 280,
      margin: 3,
      errorCorrectionLevel: 'Q',
      color: { dark: '#0B1320', light: '#FFFFFF' },
    })
      .then((url) => {
        if (!cancelled) setUpiQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setUpiQrDataUrl('');
      });

    return () => {
      cancelled = true;
    };
  }, [
    calc.grandTotal,
    doc.inv.no,
    doc.qrAmt,
    doc.type,
    profile.bank.acc,
    profile.bank.holder,
    profile.bank.ifsc,
    profile.bank.upi,
    profile.co.name,
  ]);

  const updatePartyField = (
    target: 'co' | 'buyer' | 'cons',
    field: keyof PartyInfo,
    value: string
  ) => {
    const applyGstinState = (party: PartyInfo): PartyInfo => {
      const updated = { ...party, [field]: value };
      if (field === 'gstin') {
        const prefixCode = value.slice(0, 2);
        if (INDIAN_STATES[prefixCode]) {
          updated.code = prefixCode;
          updated.state = INDIAN_STATES[prefixCode];
        }
      }
      return updated;
    };

    if (target === 'co') {
      setProfile((prev) => ({ ...prev, co: applyGstinState(prev.co) }));
    } else if (target === 'buyer') {
      setDoc((prev) => ({ ...prev, buyer: applyGstinState(prev.buyer) }));
    } else {
      setDoc((prev) => ({ ...prev, cons: applyGstinState(prev.cons) }));
    }
  };

  const updatePartyStateCode = (target: 'co' | 'buyer' | 'cons', code: string) => {
    const stateName = INDIAN_STATES[code] || '';
    if (target === 'co') {
      setProfile((prev) => ({ ...prev, co: { ...prev.co, code, state: stateName } }));
    } else if (target === 'buyer') {
      setDoc((prev) => ({ ...prev, buyer: { ...prev.buyer, code, state: stateName } }));
    } else {
      setDoc((prev) => ({ ...prev, cons: { ...prev.cons, code, state: stateName } }));
    }
  };

  const handleDocTypeChange = (nextType: DocType) => {
    setDoc((prev) => ({
      ...prev,
      type: nextType,
      inv: {
        ...prev.inv,
        no: currentSavedId ? prev.inv.no : getNextDocNo(profile, nextType),
      },
    }));
  };

  const handleSaveDocument = () => {
    const id = currentSavedId || String(Date.now());
    const rec: SavedInvoiceRecord = {
      id,
      label: `${DOC_TITLES[doc.type]} ${doc.inv.no} — ${doc.buyer.name || 'No buyer'}`,
      sub: `${formatDisplayDate(doc.inv.date)} · ₹ ${fmtInr(calc.grandTotal)}`,
      data: JSON.parse(JSON.stringify(doc)) as InvoiceDocumentState,
    };

    const nextList = [rec, ...savedList.filter((item) => item.id !== id)];
    setSavedList(nextList);
    setCurrentSavedId(id);
    saveJson(SAVED_LIST_KEY, nextList);

    const trailingNum = doc.inv.no.match(/(\d+)\s*$/);
    if (trailingNum) {
      const ck = getCounterKey(doc.type);
      const prevMax = loadJson<number>(ck, 0);
      saveJson(ck, Math.max(prevMax, Number.parseInt(trailingNum[1], 10)));
    }

    setSaveFeedback(true);
    setTimeout(() => setSaveFeedback(false), 1600);
  };

  const handleNewDocument = () => {
    setCurrentSavedId(null);
    setDoc(createBlankInvoice(profile, doc.type));
    setExcelMessage('');
    setPdfError('');
  };

  const handleLoadSaved = (record: SavedInvoiceRecord) => {
    setDoc(record.data);
    setCurrentSavedId(record.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteSaved = (id: string) => {
    const nextList = savedList.filter((item) => item.id !== id);
    setSavedList(nextList);
    saveJson(SAVED_LIST_KEY, nextList);
    if (currentSavedId === id) setCurrentSavedId(null);
  };

  const [isBuildingExcel, setIsBuildingExcel] = useState(false);

  const handleDownloadExcelTemplate = async () => {
    if (isBuildingExcel) return;
    setIsBuildingExcel(true);
    setExcelMessage('');

    try {
      const excelJsMod = await import('exceljs');
      const ExcelJS = excelJsMod.default ?? excelJsMod;
      const wb = new ExcelJS.Workbook();
      wb.creator = 'VCPL Tools — GST Invoice & Quotation Maker';
      wb.created = new Date();

      const headerFill = {
        type: 'pattern' as const,
        pattern: 'solid' as const,
        fgColor: { argb: 'FF2F3E4E' },
      };
      const sectionFill = {
        type: 'pattern' as const,
        pattern: 'solid' as const,
        fgColor: { argb: 'FFFEF2C8' },
      };
      const lockedNoteFill = {
        type: 'pattern' as const,
        pattern: 'solid' as const,
        fgColor: { argb: 'FFF8FAFC' },
      };
      const editableInputFill = {
        type: 'pattern' as const,
        pattern: 'solid' as const,
        fgColor: { argb: 'FFFFFBEB' },
      };
      const formulaLockedFill = {
        type: 'pattern' as const,
        pattern: 'solid' as const,
        fgColor: { argb: 'FFCEE5DC' },
      };

      const thinBorder = {
        top: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } },
      };
      const inputBorder = {
        top: { style: 'thin' as const, color: { argb: 'FF2F3E4E' } },
        bottom: { style: 'thin' as const, color: { argb: 'FF2F3E4E' } },
        left: { style: 'thin' as const, color: { argb: 'FF2F3E4E' } },
        right: { style: 'thin' as const, color: { argb: 'FF2F3E4E' } },
      };

      // ================================================================
      // SHEET 1: DETAILS (Only Column B Input Cells are Unlocked)
      // ================================================================
      const wsDetails = wb.addWorksheet('Details', {
        views: [{ state: 'frozen', ySplit: 1 }],
      });
      wsDetails.columns = [
        { width: 32 },
        { width: 40 },
        { width: 54 },
      ];

      const detailHeader = wsDetails.addRow([
        'Field (Locked)',
        'Enter Value Here (Editable)',
        'Notes / Format Guide (Locked)',
      ]);
      detailHeader.height = 24;
      detailHeader.eachCell((cell) => {
        cell.fill = headerFill;
        cell.font = { bold: true, color: { argb: 'FFF9C80E' }, size: 11 };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
        cell.protection = { locked: true };
      });

      type DetailSpec =
        | { kind: 'section'; title: string }
        | {
            kind: 'field';
            label: string;
            value: string;
            note: string;
            validationList?: string;
          };

      const detailRows: DetailSpec[] = [
        { kind: 'section', title: '1. DOCUMENT SETTINGS' },
        {
          kind: 'field',
          label: 'Document Type',
          value: DOC_TITLES[doc.type],
          note: 'Choose: Tax Invoice, Proforma Invoice, or Quotation',
          validationList: '"Tax Invoice,Proforma Invoice,Quotation"',
        },
        {
          kind: 'field',
          label: 'Document No',
          value: '',
          note: 'Leave blank for automatic next sequence number',
        },
        {
          kind: 'field',
          label: 'Date',
          value: '',
          note: 'dd-mm-yyyy (leave blank for today)',
        },
        {
          kind: 'field',
          label: 'Valid Until',
          value: '',
          note: 'dd-mm-yyyy (only used for Quotation)',
        },
        {
          kind: 'field',
          label: 'GST Mode',
          value: 'Auto (By State)',
          note: 'Auto (By State), CGST + SGST, or IGST',
          validationList: '"Auto (By State),CGST + SGST,IGST"',
        },
        { kind: 'section', title: '2. YOUR COMPANY / SELLER DETAILS (Optional if already saved)' },
        {
          kind: 'field',
          label: 'Company Name',
          value: profile.co.name || '',
          note: 'Your business / firm legal name printed on invoice',
        },
        {
          kind: 'field',
          label: 'Company Address',
          value: profile.co.addr || '',
          note: 'Registered street address, city & PIN',
        },
        {
          kind: 'field',
          label: 'Company GSTIN',
          value: profile.co.gstin || '',
          note: '15-char GSTIN (first 2 digits auto-detect seller state)',
        },
        {
          kind: 'field',
          label: 'Company PAN',
          value: profile.co.pan || '',
          note: 'Optional 10-char PAN',
        },
        {
          kind: 'field',
          label: 'Company State',
          value: profile.co.code || profile.co.state || '',
          note: 'State name or 2-digit GST code (e.g. Karnataka or 29)',
        },
        {
          kind: 'field',
          label: 'Company Phone',
          value: profile.co.phone || '',
          note: 'Seller contact number',
        },
        {
          kind: 'field',
          label: 'Company Email',
          value: profile.co.email || '',
          note: 'Seller business email',
        },
        { kind: 'section', title: '3. CUSTOMER / BUYER (BILL TO)' },
        {
          kind: 'field',
          label: 'Customer Name',
          value: '',
          note: 'Buyer legal / trade name',
        },
        {
          kind: 'field',
          label: 'Customer Address',
          value: '',
          note: 'Buyer billing address',
        },
        {
          kind: 'field',
          label: 'Customer GSTIN',
          value: '',
          note: 'State is auto-picked from first 2 digits if State is blank',
        },
        {
          kind: 'field',
          label: 'Customer Phone',
          value: '',
          note: 'Buyer phone number',
        },
        {
          kind: 'field',
          label: 'Customer State',
          value: '',
          note: 'State name or GST code, e.g. Maharashtra or 27',
        },
        { kind: 'section', title: '4. SHIP TO (CONSIGNEE — ONLY IF DIFFERENT)' },
        {
          kind: 'field',
          label: 'Ship To Different? (Yes/No)',
          value: 'No',
          note: 'Choose Yes only if delivery address differs from Buyer',
          validationList: '"No,Yes"',
        },
        { kind: 'field', label: 'Ship Name', value: '', note: 'Consignee name (if Ship To = Yes)' },
        {
          kind: 'field',
          label: 'Ship Address',
          value: '',
          note: 'Consignee delivery address (if Ship To = Yes)',
        },
        { kind: 'field', label: 'Ship GSTIN', value: '', note: 'Consignee GSTIN (optional)' },
        { kind: 'field', label: 'Ship State', value: '', note: 'Consignee state name or GST code' },
        { kind: 'section', title: '5. DISPATCH & TERMS' },
        { kind: 'field', label: 'Payment Terms', value: '', note: 'e.g. Immediate / 30 Days Credit' },
        { kind: 'field', label: 'Buyer Order No', value: '', note: 'Purchase Order / PO reference' },
        { kind: 'field', label: 'Destination', value: '', note: 'Delivery city / destination' },
        { kind: 'section', title: '6. YOUR BANK & UPI QR DETAILS (Optional if already saved)' },
        { kind: 'field', label: 'Account Holder Name', value: profile.bank.holder || '', note: 'Bank beneficiary name' },
        { kind: 'field', label: 'Bank Name', value: profile.bank.name || '', note: 'e.g. State Bank of India' },
        { kind: 'field', label: 'Bank Account No', value: profile.bank.acc || '', note: 'Bank current/savings A/C number' },
        { kind: 'field', label: 'Bank IFSC', value: profile.bank.ifsc || '', note: '11-character IFSC code' },
        { kind: 'field', label: 'Bank Branch', value: profile.bank.branch || '', note: 'Branch location' },
        { kind: 'field', label: 'UPI ID', value: profile.bank.upi || '', note: 'e.g. company@okhdfcbank (renders UPI QR on PDF)' },
      ];

      detailRows.forEach((spec) => {
        if (spec.kind === 'section') {
          const row = wsDetails.addRow([spec.title, '— Locked Section Header —', '']);
          row.height = 20;
          wsDetails.mergeCells(row.number, 1, row.number, 3);
          const mergedCell = row.getCell(1);
          mergedCell.fill = sectionFill;
          mergedCell.font = { bold: true, color: { argb: 'FF2F3E4E' }, size: 10 };
          mergedCell.alignment = { vertical: 'middle', horizontal: 'left' };
          mergedCell.border = thinBorder;
          mergedCell.protection = { locked: true };
          return;
        }

        const row = wsDetails.addRow([spec.label, spec.value, spec.note]);
        row.height = 20;

        const cA = row.getCell(1);
        cA.font = { bold: true, color: { argb: 'FF1E293B' }, size: 10 };
        cA.fill = lockedNoteFill;
        cA.border = thinBorder;
        cA.alignment = { vertical: 'middle', horizontal: 'left' };
        cA.protection = { locked: true };

        const cB = row.getCell(2);
        cB.fill = editableInputFill;
        cB.border = inputBorder;
        cB.font = { color: { argb: 'FF0F172A' }, size: 10 };
        cB.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        cB.protection = { locked: false };
        if (spec.validationList) {
          cB.dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: [spec.validationList],
            showErrorMessage: true,
            errorTitle: 'Select a valid option',
            error: 'Please pick a value from the dropdown list.',
          };
        }

        const cC = row.getCell(3);
        cC.font = { italic: true, color: { argb: 'FF64748B' }, size: 9 };
        cC.fill = lockedNoteFill;
        cC.border = thinBorder;
        cC.alignment = { vertical: 'middle', horizontal: 'left' };
        cC.protection = { locked: true };
      });

      await wsDetails.protect('', {
        selectLockedCells: false,
        selectUnlockedCells: true,
        formatCells: false,
        formatColumns: false,
        formatRows: false,
        insertRows: false,
        deleteRows: false,
        insertColumns: false,
        deleteColumns: false,
      });

      // ================================================================
      // SHEET 2: ITEMS (Columns A-G Unlocked, Header/Column H Formula Locked)
      // ================================================================
      const wsItems = wb.addWorksheet('Items', {
        views: [{ state: 'frozen', ySplit: 1 }],
      });
      wsItems.columns = [
        { width: 40 },
        { width: 14 },
        { width: 10 },
        { width: 10 },
        { width: 14 },
        { width: 12 },
        { width: 10 },
        { width: 20 },
      ];

      const itemHeader = wsItems.addRow([
        'Description of Goods / Services',
        'HSN / SAC',
        'Qty',
        'Unit',
        'Rate (INR)',
        'Discount %',
        'GST %',
        'Taxable Amt (Auto)',
      ]);
      itemHeader.height = 24;
      itemHeader.eachCell((cell) => {
        cell.fill = headerFill;
        cell.font = { bold: true, color: { argb: 'FFF9C80E' }, size: 10.5 };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.protection = { locked: true };
      });

      const MAX_ITEM_ROWS = 100;
      for (let i = 0; i < MAX_ITEM_ROWS; i++) {
        const rowNum = i + 2;
        const isSample = i === 0;
        const row = wsItems.addRow([
          isSample ? 'Sample Item (Edit or Replace)' : '',
          isSample ? '1005' : '',
          isSample ? 1 : null,
          isSample ? 'Nos' : '',
          isSample ? 500 : null,
          isSample ? 0 : null,
          isSample ? 18 : null,
          { formula: `IF(A${rowNum}="","",ROUND(N(C${rowNum})*N(E${rowNum})*(1-N(F${rowNum})/100),2))` },
        ]);
        row.height = 20;

        for (let col = 1; col <= 7; col++) {
          const cell = row.getCell(col);
          cell.fill = editableInputFill;
          cell.border = inputBorder;
          cell.font = { color: { argb: 'FF0F172A' }, size: 10 };
          cell.protection = { locked: false };
          if (col === 3 || col === 5 || col === 6 || col === 7) {
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
          } else {
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
          }
          if (col === 4) {
            cell.dataValidation = {
              type: 'list',
              allowBlank: true,
              formulae: ['"Nos,Pcs,Kg,Gm,Box,Set,Mtr,Hrs,Days"'],
            };
          }
          if (col === 7) {
            cell.dataValidation = {
              type: 'list',
              allowBlank: true,
              formulae: ['"0,5,12,18,28"'],
            };
          }
        }

        const totalCell = row.getCell(8);
        totalCell.fill = formulaLockedFill;
        totalCell.border = thinBorder;
        totalCell.font = { bold: true, color: { argb: 'FF1E293B' }, size: 10 };
        totalCell.numFmt = '#,##0.00';
        totalCell.alignment = { vertical: 'middle', horizontal: 'right' };
        totalCell.protection = { locked: true };
      }

      const footerRow = wsItems.addRow([
        'TOTAL TAXABLE VALUE (Auto-Calculated — Locked)',
        '',
        { formula: `SUM(C2:C${MAX_ITEM_ROWS + 1})` },
        '',
        '',
        '',
        '',
        { formula: `SUM(H2:H${MAX_ITEM_ROWS + 1})` },
      ]);
      footerRow.height = 22;
      footerRow.eachCell((cell, colNumber) => {
        cell.fill = sectionFill;
        cell.border = inputBorder;
        cell.font = { bold: true, color: { argb: 'FF2F3E4E' }, size: 10.5 };
        if (colNumber === 3 || colNumber === 8) {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          if (colNumber === 8) cell.numFmt = '₹#,##0.00';
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }
        cell.protection = { locked: true };
      });

      await wsItems.protect('', {
        selectLockedCells: false,
        selectUnlockedCells: true,
        formatCells: false,
        formatColumns: false,
        formatRows: false,
        insertRows: false,
        deleteRows: false,
        insertColumns: false,
        deleteColumns: false,
      });

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'Invoice_Data_Template.xlsx';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      setExcelMessage(
        'Downloaded locked Invoice_Data_Template.xlsx (only yellow data-entry cells are editable; headers, Company labels & formula totals are locked).'
      );
    } catch {
      setExcelMessage('Could not build Excel template. Please try again.');
    } finally {
      setIsBuildingExcel(false);
    }
  };

  const handleImportExcel = (file?: File) => {
    if (!file) return;
    setExcelMessage('');
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const wb = XLSX.read(new Uint8Array(reader.result as ArrayBuffer), {
          type: 'array',
          cellDates: true,
        });
        const firstSheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<(string | number | Date)[]>(firstSheet, {
          header: 1,
          raw: true,
          defval: '',
        });

        const dict: Record<string, unknown> = {};
        rows.forEach((r) => {
          const k = String(r[0] ?? '').toLowerCase().trim();
          if (k && !k.startsWith('field') && !/^\d+\.\s/.test(k)) {
            dict[k] = r[1];
          }
        });

        const getVal = (k: string) => dict[k] ?? '';
        const strVal = (k: string) => String(getVal(k) ?? '').trim();

        const typeStr = strVal('document type').toLowerCase();
        const nextType: DocType = typeStr.includes('pro')
          ? 'proforma'
          : typeStr.includes('quot')
          ? 'quote'
          : 'tax';

        const fillParty = (
          name: unknown,
          addr: unknown,
          gstin: unknown,
          phone: unknown,
          state: unknown,
          extra?: { pan?: unknown; email?: unknown }
        ): PartyInfo => {
          const cleanGstin = String(gstin ?? '').toUpperCase().trim();
          const code =
            resolveStateCodeFromInput(state) ||
            (INDIAN_STATES[cleanGstin.slice(0, 2)] ? cleanGstin.slice(0, 2) : '');
          return {
            name: String(name ?? '').trim(),
            addr: String(addr ?? '').trim(),
            gstin: cleanGstin,
            phone: String(phone ?? '').trim(),
            email: String(extra?.email ?? '').trim(),
            pan: String(extra?.pan ?? '').toUpperCase().trim(),
            code,
            state: INDIAN_STATES[code] || '',
          };
        };

        // Update Seller Company & Bank Profile if non-empty cells were provided in Excel
        let updatedProfile = profile;
        const hasCompanyInExcel = [
          'company name',
          'company address',
          'company gstin',
          'company pan',
          'company state',
          'company phone',
          'company email',
        ].some((k) => strVal(k) !== '');

        const hasBankInExcel = [
          'account holder name',
          'bank name',
          'bank account no',
          'bank ifsc',
          'bank branch',
          'upi id',
        ].some((k) => strVal(k) !== '');

        if (hasCompanyInExcel || hasBankInExcel) {
          const excelCo = fillParty(
            getVal('company name'),
            getVal('company address'),
            getVal('company gstin'),
            getVal('company phone'),
            getVal('company state'),
            { pan: getVal('company pan'), email: getVal('company email') }
          );

          updatedProfile = {
            ...profile,
            co: hasCompanyInExcel
              ? {
                  name: excelCo.name || profile.co.name,
                  addr: excelCo.addr || profile.co.addr,
                  gstin: excelCo.gstin || profile.co.gstin,
                  pan: excelCo.pan || profile.co.pan,
                  phone: excelCo.phone || profile.co.phone,
                  email: excelCo.email || profile.co.email,
                  code: excelCo.code || profile.co.code,
                  state: excelCo.state || profile.co.state,
                }
              : profile.co,
            bank: hasBankInExcel
              ? {
                  holder: strVal('account holder name') || profile.bank.holder,
                  name: strVal('bank name') || profile.bank.name,
                  acc: strVal('bank account no') || profile.bank.acc,
                  ifsc: strVal('bank ifsc').toUpperCase() || profile.bank.ifsc,
                  branch: strVal('bank branch') || profile.bank.branch,
                  upi: strVal('upi id') || profile.bank.upi,
                }
              : profile.bank,
          };
          setProfile(updatedProfile);
        }

        const nextDoc = createBlankInvoice(updatedProfile, nextType);
        const manualNo = strVal('document no');
        if (manualNo) nextDoc.inv.no = manualNo;

        const gstModeStr = strVal('gst mode').toLowerCase();
        if (gstModeStr.includes('cgst') || gstModeStr.includes('intra')) {
          nextDoc.taxMode = 'intra';
        } else if (gstModeStr.includes('igst') || gstModeStr.includes('inter')) {
          nextDoc.taxMode = 'inter';
        } else {
          nextDoc.taxMode = 'auto';
        }

        nextDoc.inv.date = parseExcelDate(getVal('date')) || getTodayIso();
        nextDoc.inv.valid = parseExcelDate(getVal('valid until'));
        nextDoc.inv.mode = String(getVal('payment terms') ?? '');
        nextDoc.inv.bo = String(getVal('buyer order no') ?? '');
        nextDoc.inv.dest = String(getVal('destination') ?? '');

        nextDoc.buyer = fillParty(
          getVal('customer name'),
          getVal('customer address'),
          getVal('customer gstin'),
          getVal('customer phone'),
          getVal('customer state')
        );

        nextDoc.same = !/^y/i.test(strVal('ship to different? (yes/no)'));
        if (!nextDoc.same) {
          nextDoc.cons = fillParty(
            getVal('ship name'),
            getVal('ship address'),
            getVal('ship gstin'),
            '',
            getVal('ship state')
          );
        }

        const itemSheet = wb.SheetNames[1] ? wb.Sheets[wb.SheetNames[1]] : null;
        const rawItems = itemSheet
          ? XLSX.utils.sheet_to_json<(string | number)[]>(itemSheet, {
              header: 1,
              raw: true,
              defval: '',
            })
          : [];
        const parsedItems: InvoiceLineItem[] = [];
        rawItems.slice(1).forEach((row) => {
          const descText = String(row[0] ?? '').trim();
          if (descText && !descText.toUpperCase().startsWith('TOTAL TAXABLE VALUE')) {
            parsedItems.push({
              desc: descText,
              hsn: String(row[1] ?? ''),
              qty: row[2] === '' ? 1 : row[2],
              unit: String(row[3] || 'Nos'),
              rate: row[4] || 0,
              disc: row[5] || 0,
              gst: row[6] === '' ? 18 : row[6],
            });
          }
        });

        if (parsedItems.length > 0) nextDoc.items = parsedItems;
        setDoc(nextDoc);
        setCurrentSavedId(null);
        setExcelMessage(
          `Imported ${parsedItems.length} item(s) as ${DOC_TITLES[nextType]}${
            hasCompanyInExcel ? ' + Company Profile updated' : ''
          }. Review preview and download PDF.`
        );
      } catch {
        setExcelMessage('Could not read this file. Please upload a valid Excel template.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSignatureUpload = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 500 / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setProfile((prev) => ({ ...prev, sig: canvas.toDataURL('image/png') }));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleDownloadPdf = async () => {
    if (!paperRef.current || isExportingPdf) return;
    setPdfError('');
    setIsExportingPdf(true);

    try {
      const canvas = await html2canvas(paperRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#FFFFFF',
        windowWidth: 794,
        onclone: (clonedDoc) => {
          const wrap = clonedDoc.getElementById('vcpl-invoice-scale-wrap');
          if (wrap) {
            wrap.style.transform = 'none';
            wrap.style.width = '794px';
          }
          const outer = clonedDoc.getElementById('vcpl-invoice-scale-outer');
          if (outer) {
            outer.style.width = '794px';
            outer.style.minHeight = '1123px';
          }
        },
      });

      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const pageWidthMm = 210;
      const pageHeightMm = 297;
      const imgData = canvas.toDataURL('image/jpeg', 0.96);
      const renderedHeightMm = (canvas.height * pageWidthMm) / canvas.width;

      let heightLeft = renderedHeightMm;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, pageWidthMm, renderedHeightMm);
      heightLeft -= pageHeightMm;

      while (heightLeft > 2) {
        position -= pageHeightMm;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, pageWidthMm, renderedHeightMm);
        heightLeft -= pageHeightMm;
      }

      const fileName = `${DOC_TITLES[doc.type].replace(/\s/g, '_')}_${(
        doc.inv.no || 'draft'
      ).replace(/[^\w-]+/g, '_')}.pdf`;
      pdf.save(fileName);
    } catch {
      setPdfError('PDF generation hit a browser issue. Use the Print A4 button and Save as PDF.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handlePrintA4 = () => {
    void printTargetElement({
      element: paperRef.current,
      title: `${DOC_TITLES[doc.type]}_${(doc.inv.no || 'draft').replace(/[^\w-]+/g, '_')}`,
      orientation: 'portrait',
      pageMargin: '8mm',
      extraCss: '#vcpl-invoice-paper { width: 100% !important; min-height: 0 !important; padding: 10px 14px !important; box-shadow: none !important; border: 0 !important; }',
      prepareClone: (clone) => {
        clone.style.width = '100%';
        clone.style.minHeight = '0';
        clone.style.boxShadow = 'none';
        clone.style.border = '0';
        clone.style.margin = '0 auto';
      },
    });
  };

  const docTitle = DOC_TITLES[doc.type];
  const shipParty = doc.same ? doc.buyer : doc.cons;
  const fillerHeightPx = Math.max(10, 210 - calc.rows.length * 32);

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 8mm; }
          html, body {
            background: #ffffff !important;
          }
          #vcpl-invoice-scale-outer {
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
          }
          #vcpl-invoice-scale-wrap {
            transform: none !important;
            width: 100% !important;
          }
          #vcpl-invoice-paper {
            width: 100% !important;
            min-height: 0 !important;
            padding: 14px 18px !important;
            box-shadow: none !important;
            border: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
      {/* Workspace Header & Action Toolbar */}
      <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 sm:p-6 shadow-[0_4px_0_#2F3E4E] flex flex-col lg:flex-row lg:items-center justify-between gap-4 no-print">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-[#0F766E]" aria-hidden="true" />
            <span>
              {tool?.categoryName || 'Tax & GST'} · {tool?.code || 'TX-04'}
            </span>
          </span>
          <h1 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] mt-1">
            {tool?.title || 'GST Invoice & Quotation Maker'}
          </h1>
          <p className="text-xs sm:text-sm text-[#475569] mt-0.5">
            Fill form or import Excel · Live A4 GST preview with HSN summary &amp; UPI QR · Print or Download PDF
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleNewDocument}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>New</span>
          </button>

          <button
            type="button"
            onClick={handleSaveDocument}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] text-xs font-bold cursor-pointer whitespace-nowrap transition-colors ${
              saveFeedback
                ? 'bg-[#CEE5DC] text-[#12805C]'
                : 'bg-white hover:bg-[#FEF2C8] text-[#2F3E4E]'
            }`}
          >
            {saveFeedback ? (
              <Check className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <Save className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>{saveFeedback ? 'Saved' : 'Save Locally'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrintA4}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Print A4</span>
          </button>

          <button
            type="button"
            disabled={isExportingPdf}
            onClick={handleDownloadPdf}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#F9C80E] hover:bg-[#FFE1B3] text-xs font-display font-extrabold text-[#2F3E4E] shadow-[0_2px_0_#2F3E4E] cursor-pointer whitespace-nowrap disabled:opacity-60"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{isExportingPdf ? 'Building PDF...' : 'Download PDF'}</span>
          </button>
        </div>
      </div>

      {pdfError && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-700 text-xs font-semibold text-red-800 no-print">
          {pdfError}
        </div>
      )}

      {/* Main Split Builder + Live A4 Preview */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start print:block">
        {/* Left Form Controls (Flows naturally alongside Sticky Preview, hidden on print) */}
        <div className="xl:col-span-5 space-y-4 no-print">
          {/* Document Type & Quick Excel Fill */}
          <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-4 space-y-4">
            <div>
              <label className="block text-[11px] font-display font-extrabold uppercase tracking-wider text-[#475569] mb-1.5">
                Document Type
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['tax', 'proforma', 'quote'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleDocTypeChange(t)}
                    className={`py-2 px-2 rounded-lg text-xs font-bold border-[1.5px] transition-colors cursor-pointer ${
                      doc.type === t
                        ? 'bg-[#2F3E4E] text-[#F9C80E] border-[#2F3E4E]'
                        : 'bg-white text-[#2F3E4E] border-[#2F3E4E]/35 hover:bg-[#FEF2C8]'
                    }`}
                  >
                    {DOC_TITLES[t]}
                  </button>
                ))}
              </div>
            </div>

            <FileDropZone
              accept=".xlsx,.xls,.csv"
              multiple={false}
              onFiles={(files) => {
                if (files[0]) handleImportExcel(files[0]);
              }}
              className="mt-3 p-3 rounded-xl border-[1.5px] border-dashed border-[#2F3E4E]/45 bg-[#FEF2C8]/40 space-y-2 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-display font-extrabold uppercase tracking-wider text-[#475569] flex items-center gap-1.5">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-[#0F766E]" aria-hidden="true" />
                  Quick Fill From Excel (Drag &amp; Drop Supported)
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isBuildingExcel}
                  onClick={handleDownloadExcelTemplate}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] cursor-pointer disabled:opacity-60"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isBuildingExcel ? 'Building XLSX...' : 'Download Locked Excel Template'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => excelUploadRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] bg-[#CEE5DC] hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Drop or Upload Filled Excel</span>
                </button>
                <input
                  ref={excelUploadRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => {
                    handleImportExcel(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                  className="hidden"
                />
              </div>
              {excelMessage && (
                <p className="text-[11px] font-semibold text-[#12805C]">{excelMessage}</p>
              )}
            </FileDropZone>
          </div>

          {/* Your Company Profile (Always Open & Visible) */}
          <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-display font-extrabold uppercase tracking-wider text-[#2F3E4E]">
                Your Company / Seller Details (Saved Locally)
              </h2>
              <span className="px-2 py-0.5 rounded bg-[#CEE5DC] text-[10px] font-bold text-[#2F3E4E] shrink-0">
                Auto-Saved
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-[#2F3E4E] mb-0.5">
                  Your Company / Business Name
                </label>
                <input
                  type="text"
                  value={profile.co.name}
                  onChange={(e) => updatePartyField('co', 'name', e.target.value)}
                  placeholder="e.g. Acme Trading Pvt. Ltd."
                  className="w-full px-2.5 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E]/60 bg-white text-xs font-semibold text-[#2F3E4E] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2F3E4E]"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-[#475569] mb-0.5">
                  Company Address
                </label>
                <textarea
                  rows={2}
                  value={profile.co.addr}
                  onChange={(e) => updatePartyField('co', 'addr', e.target.value)}
                  placeholder="Street, Building, City, PIN Code"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/45 bg-white text-xs text-[#2F3E4E] placeholder:text-[#94A3B8]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#475569] mb-0.5">
                  Company GSTIN / UIN
                </label>
                <input
                  type="text"
                  value={profile.co.gstin}
                  onChange={(e) => updatePartyField('co', 'gstin', e.target.value.toUpperCase())}
                  placeholder="Enter 15-character GSTIN"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/45 bg-white text-xs font-mono uppercase text-[#2F3E4E] placeholder:text-[#94A3B8]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#475569] mb-0.5">Company PAN</label>
                <input
                  type="text"
                  value={profile.co.pan}
                  onChange={(e) => updatePartyField('co', 'pan', e.target.value.toUpperCase())}
                  placeholder="Enter 10-character PAN"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/45 bg-white text-xs font-mono uppercase text-[#2F3E4E] placeholder:text-[#94A3B8]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#475569] mb-0.5">
                  Seller State (Code)
                </label>
                <select
                  value={profile.co.code}
                  onChange={(e) => updatePartyStateCode('co', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/45 bg-white text-xs text-[#2F3E4E]"
                >
                  <option value="">— Select state —</option>
                  {STATE_CODES.map((c) => (
                    <option key={c} value={c}>
                      {INDIAN_STATES[c]} ({c})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#475569] mb-0.5">
                  Company Phone
                </label>
                <input
                  type="text"
                  value={profile.co.phone}
                  onChange={(e) => updatePartyField('co', 'phone', e.target.value)}
                  placeholder="+91 98XXXXXXXX"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/45 bg-white text-xs text-[#2F3E4E] placeholder:text-[#94A3B8]"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-[#475569] mb-0.5">
                  Company Email
                </label>
                <input
                  type="email"
                  value={profile.co.email}
                  onChange={(e) => updatePartyField('co', 'email', e.target.value)}
                  placeholder="billing@yourcompany.com"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/45 bg-white text-xs text-[#2F3E4E] placeholder:text-[#94A3B8]"
                />
              </div>
            </div>
          </div>

          {/* Bank & UPI Details (Open & Saved Locally) */}
          <details className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-4" open>
            <summary className="text-xs font-display font-extrabold uppercase tracking-wider text-[#2F3E4E] cursor-pointer select-none">
              Bank &amp; UPI QR Details (Saved Locally)
            </summary>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-[#475569] mb-0.5">
                  Account Holder Name
                </label>
                <input
                  type="text"
                  value={profile.bank.holder}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, bank: { ...p.bank, holder: e.target.value } }))
                  }
                  placeholder="Beneficiary / Company A/c Name"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/45 bg-white text-xs text-[#2F3E4E] placeholder:text-[#94A3B8]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#475569] mb-0.5">
                  Bank Name
                </label>
                <input
                  type="text"
                  value={profile.bank.name}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, bank: { ...p.bank, name: e.target.value } }))
                  }
                  placeholder="e.g. State Bank of India"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/45 bg-white text-xs text-[#2F3E4E] placeholder:text-[#94A3B8]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#475569] mb-0.5">
                  Branch
                </label>
                <input
                  type="text"
                  value={profile.bank.branch}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, bank: { ...p.bank, branch: e.target.value } }))
                  }
                  placeholder="Branch Name"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/45 bg-white text-xs text-[#2F3E4E] placeholder:text-[#94A3B8]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#475569] mb-0.5">
                  Account No.
                </label>
                <input
                  type="text"
                  value={profile.bank.acc}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, bank: { ...p.bank, acc: e.target.value } }))
                  }
                  placeholder="Bank Account Number"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/45 bg-white text-xs font-mono text-[#2F3E4E] placeholder:text-[#94A3B8]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#475569] mb-0.5">
                  IFSC Code
                </label>
                <input
                  type="text"
                  value={profile.bank.ifsc}
                  onChange={(e) =>
                    setProfile((p) => ({
                      ...p,
                      bank: { ...p.bank, ifsc: e.target.value.toUpperCase() },
                    }))
                  }
                  placeholder="e.g. SBIN0001234"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/45 bg-white text-xs font-mono uppercase text-[#2F3E4E] placeholder:text-[#94A3B8]"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-[#475569] mb-0.5">
                  UPI ID (embeds Scan-to-Pay QR on Invoice)
                </label>
                <input
                  type="text"
                  value={profile.bank.upi}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, bank: { ...p.bank, upi: e.target.value } }))
                  }
                  placeholder="yourname@okhdfcbank"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/45 bg-white text-xs font-mono text-[#2F3E4E]"
                />
              </div>
            </div>
          </details>

          {/* Invoice Metadata Details */}
          <details className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-4" open>
            <summary className="text-xs font-display font-extrabold uppercase tracking-wider text-[#2F3E4E] cursor-pointer select-none">
              Document &amp; Dispatch Details
            </summary>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(
                [
                  ['no', 'Document No.', 'text'],
                  ['date', 'Date', 'date'],
                  ...(doc.type === 'quote' ? [['valid', 'Valid Until', 'date'] as const] : []),
                  ['dn', 'Delivery Note', 'text'],
                  ['mode', 'Mode / Payment Terms', 'text'],
                  ['ref', 'Reference No. & Date', 'text'],
                  ['oref', 'Other References', 'text'],
                  ['bo', 'Buyer’s Order No.', 'text'],
                  ['bod', 'Order Dated', 'date'],
                  ['dd', 'Dispatch Doc No.', 'text'],
                  ['dnd', 'Delivery Note Date', 'date'],
                  ['dt', 'Dispatched Through', 'text'],
                  ['dest', 'Destination', 'text'],
                ] as const
              ).map(([key, label, inputType]) => (
                <div key={key}>
                  <label className="block text-[11px] font-semibold text-[#475569] mb-0.5">
                    {label}
                  </label>
                  <input
                    type={inputType}
                    value={doc.inv[key]}
                    onChange={(e) =>
                      setDoc((prev) => ({
                        ...prev,
                        inv: { ...prev.inv, [key]: e.target.value },
                      }))
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/45 bg-white text-xs text-[#2F3E4E]"
                  />
                </div>
              ))}
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-[#475569] mb-0.5">
                  Terms of Delivery
                </label>
                <input
                  type="text"
                  value={doc.inv.tod}
                  onChange={(e) =>
                    setDoc((prev) => ({ ...prev, inv: { ...prev.inv, tod: e.target.value } }))
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/45 bg-white text-xs text-[#2F3E4E]"
                />
              </div>
            </div>
          </details>

          {/* Buyer & Consignee */}
          <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-4 space-y-3">
            <h2 className="text-xs font-display font-extrabold uppercase tracking-wider text-[#2F3E4E]">
              Buyer (Bill To) &amp; Ship To
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-[#475569] mb-0.5">
                  Buyer Name
                </label>
                <input
                  type="text"
                  value={doc.buyer.name}
                  onChange={(e) => updatePartyField('buyer', 'name', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/45 bg-white text-xs text-[#2F3E4E]"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-[#475569] mb-0.5">
                  Buyer Address
                </label>
                <textarea
                  rows={2}
                  value={doc.buyer.addr}
                  onChange={(e) => updatePartyField('buyer', 'addr', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/45 bg-white text-xs text-[#2F3E4E]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#475569] mb-0.5">
                  Buyer GSTIN / UIN
                </label>
                <input
                  type="text"
                  value={doc.buyer.gstin}
                  onChange={(e) =>
                    updatePartyField('buyer', 'gstin', e.target.value.toUpperCase())
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/45 bg-white text-xs font-mono uppercase text-[#2F3E4E]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#475569] mb-0.5">
                  Phone
                </label>
                <input
                  type="text"
                  value={doc.buyer.phone}
                  onChange={(e) => updatePartyField('buyer', 'phone', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/45 bg-white text-xs text-[#2F3E4E]"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-[#475569] mb-0.5">
                  State (Code)
                </label>
                <select
                  value={doc.buyer.code}
                  onChange={(e) => updatePartyStateCode('buyer', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/45 bg-white text-xs text-[#2F3E4E]"
                >
                  <option value="">— Select state —</option>
                  {STATE_CODES.map((c) => (
                    <option key={c} value={c}>
                      {INDIAN_STATES[c]} ({c})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="inline-flex items-center gap-2 pt-2 text-xs font-bold text-[#2F3E4E] cursor-pointer">
              <input
                type="checkbox"
                checked={doc.same}
                onChange={(e) => setDoc((p) => ({ ...p, same: e.target.checked }))}
                className="w-4 h-4 accent-[#2F3E4E]"
              />
              <span>Consignee (Ship to) same as Buyer</span>
            </label>

            {!doc.same && (
              <div className="pt-2 border-t border-[#2F3E4E]/15 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-[#475569] mb-0.5">
                    Consignee Name
                  </label>
                  <input
                    type="text"
                    value={doc.cons.name}
                    onChange={(e) => updatePartyField('cons', 'name', e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/45 bg-white text-xs text-[#2F3E4E]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-[#475569] mb-0.5">
                    Consignee Address
                  </label>
                  <textarea
                    rows={2}
                    value={doc.cons.addr}
                    onChange={(e) => updatePartyField('cons', 'addr', e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/45 bg-white text-xs text-[#2F3E4E]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#475569] mb-0.5">
                    Consignee GSTIN
                  </label>
                  <input
                    type="text"
                    value={doc.cons.gstin}
                    onChange={(e) =>
                      updatePartyField('cons', 'gstin', e.target.value.toUpperCase())
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/45 bg-white text-xs font-mono uppercase text-[#2F3E4E]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#475569] mb-0.5">
                    Consignee State
                  </label>
                  <select
                    value={doc.cons.code}
                    onChange={(e) => updatePartyStateCode('cons', e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/45 bg-white text-xs text-[#2F3E4E]"
                  >
                    <option value="">— Select state —</option>
                    {STATE_CODES.map((c) => (
                      <option key={c} value={c}>
                        {INDIAN_STATES[c]} ({c})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Line Items + GST Mode */}
          <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-display font-extrabold uppercase tracking-wider text-[#2F3E4E]">
                Items ({doc.items.length})
              </h2>
              <button
                type="button"
                onClick={() =>
                  setDoc((prev) => ({
                    ...prev,
                    items: [
                      ...prev.items,
                      { desc: '', hsn: '', qty: 1, unit: 'Nos', rate: 0, disc: 0, gst: 18 },
                    ],
                  }))
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#2F3E4E] text-[#F9C80E] text-xs font-bold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {doc.items.map((it, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-dashed border-[#2F3E4E]/45 bg-white space-y-2"
                >
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[#64748B]">
                      Description of Goods / Services
                    </label>
                    <input
                      type="text"
                      value={it.desc}
                      onChange={(e) =>
                        setDoc((prev) => ({
                          ...prev,
                          items: prev.items.map((row, i) =>
                            i === idx ? { ...row, desc: e.target.value } : row
                          ),
                        }))
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/35 text-xs text-[#2F3E4E]"
                    />
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {(
                      [
                        ['hsn', 'HSN/SAC', 'text'],
                        ['qty', 'Qty', 'number'],
                        ['unit', 'Unit', 'text'],
                        ['rate', 'Rate ₹', 'number'],
                        ['disc', 'Disc %', 'number'],
                        ['gst', 'GST %', 'number'],
                      ] as const
                    ).map(([field, label, type]) => (
                      <div key={field}>
                        <label className="block text-[10px] font-bold uppercase text-[#64748B]">
                          {label}
                        </label>
                        <input
                          type={type}
                          step="any"
                          value={it[field]}
                          onChange={(e) =>
                            setDoc((prev) => ({
                              ...prev,
                              items: prev.items.map((row, i) =>
                                i === idx ? { ...row, [field]: e.target.value } : row
                              ),
                            }))
                          }
                          className="w-full px-2 py-1 rounded-lg border border-[#2F3E4E]/35 text-xs text-[#2F3E4E]"
                        />
                      </div>
                    ))}
                    <div className="flex items-end col-span-2 sm:col-span-2">
                      <button
                        type="button"
                        disabled={doc.items.length <= 1}
                        onClick={() =>
                          setDoc((prev) => ({
                            ...prev,
                            items:
                              prev.items.length > 1
                                ? prev.items.filter((_, i) => i !== idx)
                                : prev.items,
                          }))
                        }
                        className="w-full py-1.5 px-2 rounded-lg border border-red-300 bg-red-50 hover:bg-red-100 text-[11px] font-bold text-red-700 cursor-pointer disabled:opacity-40"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Tax & Display Settings */}
            <div className="pt-2 border-t border-[#2F3E4E]/15 grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <div>
                <label className="block text-[11px] font-semibold text-[#475569] mb-0.5">
                  GST Type
                </label>
                <select
                  value={doc.taxMode}
                  onChange={(e) =>
                    setDoc((prev) => ({ ...prev, taxMode: e.target.value as TaxMode }))
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/45 bg-white text-xs text-[#2F3E4E]"
                >
                  <option value="auto">Auto (by state code)</option>
                  <option value="intra">CGST + SGST</option>
                  <option value="inter">IGST</option>
                </select>
              </div>

              <div className="space-y-1.5 pt-2 sm:pt-4">
                <label className="flex items-center gap-2 text-xs font-semibold text-[#2F3E4E] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={doc.round}
                    onChange={(e) => setDoc((p) => ({ ...p, round: e.target.checked }))}
                    className="w-4 h-4 accent-[#2F3E4E]"
                  />
                  <span>Round off total</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-[#2F3E4E] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={doc.qrAmt}
                    onChange={(e) => setDoc((p) => ({ ...p, qrAmt: e.target.checked }))}
                    className="w-4 h-4 accent-[#2F3E4E]"
                  />
                  <span>Include amount in UPI QR</span>
                </label>
              </div>
            </div>

            <p className="text-[11px] font-mono text-[#12805C] bg-[#CEE5DC]/45 px-3 py-1.5 rounded-lg">
              Place of supply:{' '}
              {calc.supplyParty.state
                ? `${calc.supplyParty.state} (${calc.buyerCode})`
                : 'Not selected'}{' '}
              → {calc.intra ? 'CGST + SGST' : 'IGST'} applied
            </p>
          </div>

          {/* Signature & Footer Settings */}
          <details className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-4">
            <summary className="text-xs font-display font-extrabold uppercase tracking-wider text-[#2F3E4E] cursor-pointer select-none">
              Signature, Declaration &amp; Prefixes (Saved)
            </summary>
            <div className="mt-3 space-y-3">
              <FileDropZone
                accept="image/*"
                multiple={false}
                onFiles={(files) => {
                  if (files[0]) handleSignatureUpload(files[0]);
                }}
                className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl border border-dashed border-[#2F3E4E]/45 bg-[#FEF2C8]/30 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => sigUploadRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] text-xs font-bold cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Drop or Upload Signature / Stamp PNG</span>
                </button>
                {profile.sig && (
                  <button
                    type="button"
                    onClick={() => setProfile((p) => ({ ...p, sig: '' }))}
                    className="px-2.5 py-1.5 rounded-lg border border-red-300 bg-red-50 text-xs font-bold text-red-700 cursor-pointer"
                  >
                    Remove Signature
                  </button>
                )}
                <input
                  ref={sigUploadRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    handleSignatureUpload(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                  className="hidden"
                />
              </FileDropZone>

              <div>
                <label className="block text-[11px] font-semibold text-[#475569] mb-0.5">
                  Declaration
                </label>
                <textarea
                  rows={2}
                  value={profile.decl}
                  onChange={(e) => setProfile((p) => ({ ...p, decl: e.target.value }))}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/45 bg-white text-xs text-[#2F3E4E]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#475569] mb-0.5">
                  Terms &amp; Conditions (Optional)
                </label>
                <textarea
                  rows={2}
                  value={profile.terms}
                  onChange={(e) => setProfile((p) => ({ ...p, terms: e.target.value }))}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/45 bg-white text-xs text-[#2F3E4E]"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-[#475569]">Tax Prefix</label>
                  <input
                    type="text"
                    value={profile.prefix}
                    onChange={(e) => setProfile((p) => ({ ...p, prefix: e.target.value }))}
                    className="w-full px-2 py-1 rounded-lg border border-[#2F3E4E]/45 bg-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#475569]">
                    Proforma Prefix
                  </label>
                  <input
                    type="text"
                    value={profile.prefixP}
                    onChange={(e) => setProfile((p) => ({ ...p, prefixP: e.target.value }))}
                    className="w-full px-2 py-1 rounded-lg border border-[#2F3E4E]/45 bg-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#475569]">
                    Quotation Prefix
                  </label>
                  <input
                    type="text"
                    value={profile.prefixQ}
                    onChange={(e) => setProfile((p) => ({ ...p, prefixQ: e.target.value }))}
                    className="w-full px-2 py-1 rounded-lg border border-[#2F3E4E]/45 bg-white text-xs"
                  />
                </div>
              </div>
            </div>
          </details>

          {/* Saved Invoices */}
          <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-4 space-y-2.5">
            <h2 className="text-xs font-display font-extrabold uppercase tracking-wider text-[#2F3E4E]">
              Saved Documents ({savedList.length})
            </h2>
            {savedList.length === 0 ? (
              <p className="text-xs text-[#64748B]">
                No saved documents yet. Click &ldquo;Save Locally&rdquo; above to keep drafts in your browser.
              </p>
            ) : (
              <div className="divide-y divide-[#2F3E4E]/15 max-h-60 overflow-y-auto">
                {savedList.map((item) => (
                  <div key={item.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <p className="font-bold text-[#2F3E4E] truncate">{item.label}</p>
                      <p className="text-[11px] text-[#64748B]">{item.sub}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleLoadSaved(item)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] text-[11px] font-bold cursor-pointer"
                      >
                        <FolderOpen className="w-3 h-3" />
                        <span>Open</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSaved(item.id)}
                        aria-label={`Delete ${item.label}`}
                        className="p-1.5 rounded-lg border border-red-300 bg-red-50 hover:bg-red-100 text-red-700 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Scaled A4 GST Document Paper (Always Visible Beside Editor) */}
        <div
          ref={previewContainerRef}
          className="xl:col-span-7 xl:sticky xl:top-20 overflow-hidden print:static print:overflow-visible print:w-full"
        >
          <div
            id="vcpl-invoice-scale-outer"
            style={{
              width: Math.ceil(794 * previewScale),
              height: Math.ceil(paperHeightPx * previewScale),
            }}
            className="mx-auto overflow-hidden print:!w-full print:!h-auto print:!overflow-visible"
          >
            <div
              id="vcpl-invoice-scale-wrap"
              style={{
                width: 794,
                transform: `scale(${previewScale})`,
                transformOrigin: 'top left',
              }}
              className="print:!transform-none print:!w-full"
            >
              {/* Actual A4 Printable GST Paper */}
              <div
                ref={paperRef}
                id="vcpl-invoice-paper"
                className="bg-white text-black w-[794px] min-h-[1123px] p-[30px_34px] shadow-[0_3px_18px_rgba(0,0,0,0.18)] print:shadow-none print:mx-auto print:!w-full font-sans text-[11.5px] leading-[1.35]"
              >
                <div className="text-center text-[18px] font-bold mb-2">{docTitle}</div>

                {/* Top Party + Document Metadata Box */}
                <table className="w-full border-collapse border border-black">
                  <tbody>
                    <tr>
                      <td className="w-1/2 p-0 border-r border-black align-top">
                        {/* Seller */}
                        <div className="p-[5px_6px]">
                          <b className="text-[13px]">{profile.co.name || 'Your Company Name'}</b>
                          {profile.co.addr && (
                            <div className="whitespace-pre-line">{profile.co.addr}</div>
                          )}
                          {profile.co.gstin && <div>GSTIN/UIN: {profile.co.gstin}</div>}
                          {(profile.co.state || profile.co.code) && (
                            <div>
                              State Name : {profile.co.state}
                              {profile.co.code ? `, Code : ${profile.co.code}` : ''}
                            </div>
                          )}
                          {profile.co.pan && <div>PAN: {profile.co.pan}</div>}
                          {(profile.co.phone || profile.co.email) && (
                            <div>
                              {profile.co.phone ? `Ph: ${profile.co.phone}` : ''}
                              {profile.co.email ? `  E-mail: ${profile.co.email}` : ''}
                            </div>
                          )}
                        </div>

                        {/* Consignee */}
                        <div className="border-t border-black p-[5px_6px]">
                          <div className="text-[10.5px]">Consignee (Ship to)</div>
                          <b className="text-[12.5px]">{shipParty.name || '—'}</b>
                          {shipParty.addr && (
                            <div className="whitespace-pre-line">{shipParty.addr}</div>
                          )}
                          {shipParty.gstin && <div>GSTIN/UIN : {shipParty.gstin}</div>}
                          {(shipParty.state || shipParty.code) && (
                            <div>
                              State Name : {shipParty.state}
                              {shipParty.code ? `, Code : ${shipParty.code}` : ''}
                            </div>
                          )}
                          {shipParty.phone && <div>Contact : {shipParty.phone}</div>}
                        </div>

                        {/* Buyer */}
                        <div className="border-t border-black p-[5px_6px]">
                          <div className="text-[10.5px]">Buyer (Bill to)</div>
                          <b className="text-[12.5px]">{doc.buyer.name || '—'}</b>
                          {doc.buyer.addr && (
                            <div className="whitespace-pre-line">{doc.buyer.addr}</div>
                          )}
                          {doc.buyer.gstin && <div>GSTIN/UIN : {doc.buyer.gstin}</div>}
                          {(doc.buyer.state || doc.buyer.code) && (
                            <div>
                              State Name : {doc.buyer.state}
                              {doc.buyer.code ? `, Code : ${doc.buyer.code}` : ''}
                            </div>
                          )}
                          {doc.buyer.phone && <div>Contact : {doc.buyer.phone}</div>}
                        </div>
                      </td>

                      {/* Right Document Metadata Grid */}
                      <td className="w-1/2 p-0 align-top">
                        <table className="w-full border-collapse h-full">
                          <tbody>
                            <tr>
                              <td className="w-1/2 border-b border-black p-[3px_5px] align-top h-[38px]">
                                <span className="block text-[10px]">{docTitle} No.</span>
                                <b>{doc.inv.no || '\u00A0'}</b>
                              </td>
                              <td className="w-1/2 border-l border-b border-black p-[3px_5px] align-top h-[38px]">
                                <span className="block text-[10px]">Dated</span>
                                <b>{formatDisplayDate(doc.inv.date) || '\u00A0'}</b>
                              </td>
                            </tr>
                            <tr>
                              <td className="border-b border-black p-[3px_5px] align-top h-[38px]">
                                <span className="block text-[10px]">
                                  {doc.type === 'quote' ? 'Valid Until' : 'Delivery Note'}
                                </span>
                                <b>
                                  {(doc.type === 'quote'
                                    ? formatDisplayDate(doc.inv.valid)
                                    : doc.inv.dn) || '\u00A0'}
                                </b>
                              </td>
                              <td className="border-l border-b border-black p-[3px_5px] align-top h-[38px]">
                                <span className="block text-[10px]">Mode/Terms of Payment</span>
                                <b>{doc.inv.mode || '\u00A0'}</b>
                              </td>
                            </tr>
                            <tr>
                              <td className="border-b border-black p-[3px_5px] align-top h-[38px]">
                                <span className="block text-[10px]">Reference No. &amp; Date.</span>
                                <b>{doc.inv.ref || '\u00A0'}</b>
                              </td>
                              <td className="border-l border-b border-black p-[3px_5px] align-top h-[38px]">
                                <span className="block text-[10px]">Other References</span>
                                <b>{doc.inv.oref || '\u00A0'}</b>
                              </td>
                            </tr>
                            <tr>
                              <td className="border-b border-black p-[3px_5px] align-top h-[38px]">
                                <span className="block text-[10px]">Buyer’s Order No.</span>
                                <b>{doc.inv.bo || '\u00A0'}</b>
                              </td>
                              <td className="border-l border-b border-black p-[3px_5px] align-top h-[38px]">
                                <span className="block text-[10px]">Dated</span>
                                <b>{formatDisplayDate(doc.inv.bod) || '\u00A0'}</b>
                              </td>
                            </tr>
                            <tr>
                              <td className="border-b border-black p-[3px_5px] align-top h-[38px]">
                                <span className="block text-[10px]">Dispatch Doc No.</span>
                                <b>{doc.inv.dd || '\u00A0'}</b>
                              </td>
                              <td className="border-l border-b border-black p-[3px_5px] align-top h-[38px]">
                                <span className="block text-[10px]">Delivery Note Date</span>
                                <b>{formatDisplayDate(doc.inv.dnd) || '\u00A0'}</b>
                              </td>
                            </tr>
                            <tr>
                              <td className="border-b border-black p-[3px_5px] align-top h-[38px]">
                                <span className="block text-[10px]">Dispatched through</span>
                                <b>{doc.inv.dt || '\u00A0'}</b>
                              </td>
                              <td className="border-l border-b border-black p-[3px_5px] align-top h-[38px]">
                                <span className="block text-[10px]">Destination</span>
                                <b>{doc.inv.dest || '\u00A0'}</b>
                              </td>
                            </tr>
                            <tr>
                              <td colSpan={2} className="p-[3px_5px] align-top h-[66px]">
                                <span className="block text-[10px]">Terms of Delivery</span>
                                <div className="whitespace-pre-line">{doc.inv.tod}</div>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Line Items Table */}
                <table className="w-full border-collapse border-x border-b border-black -mt-px">
                  <thead>
                    <tr className="border-b border-black font-normal">
                      <th className="border-r border-black p-1 w-[30px] font-normal">Sl No.</th>
                      <th className="border-r border-black p-1 text-left font-normal">
                        Description of Goods
                      </th>
                      <th className="border-r border-black p-1 w-[70px] font-normal">HSN/SAC</th>
                      <th className="border-r border-black p-1 w-[72px] font-normal">Quantity</th>
                      <th className="border-r border-black p-1 w-[72px] font-normal">Rate</th>
                      <th className="border-r border-black p-1 w-[38px] font-normal">per</th>
                      <th className="border-r border-black p-1 w-[48px] font-normal">Disc. %</th>
                      <th className="p-1 w-[92px] font-normal">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calc.rows.map(({ item, taxable }, idx) => (
                      <tr key={idx}>
                        <td className="border-r border-black px-1 py-0.5 text-center align-top">
                          {idx + 1}
                        </td>
                        <td className="border-r border-black px-1.5 py-0.5 align-top">
                          <b>{item.desc || '\u00A0'}</b>
                          {toNum(item.gst) > 0 && (
                            <div className="text-[10px] text-[#444]">
                              GST @ {toNum(item.gst)}%
                            </div>
                          )}
                        </td>
                        <td className="border-r border-black px-1.5 py-0.5 align-top">
                          {item.hsn}
                        </td>
                        <td className="border-r border-black px-1.5 py-0.5 text-right align-top">
                          <b>
                            {toNum(item.qty)} {item.unit}
                          </b>
                        </td>
                        <td className="border-r border-black px-1.5 py-0.5 text-right align-top">
                          {fmtInr(toNum(item.rate))}
                        </td>
                        <td className="border-r border-black px-1 py-0.5 align-top">{item.unit}</td>
                        <td className="border-r border-black px-1.5 py-0.5 text-right align-top">
                          {toNum(item.disc) > 0 ? `${toNum(item.disc)}%` : ''}
                        </td>
                        <td className="px-1.5 py-0.5 text-right align-top">
                          <b>{fmtInr(taxable)}</b>
                        </td>
                      </tr>
                    ))}

                    {calc.intra ? (
                      <>
                        <tr>
                          <td className="border-r border-black" />
                          <td className="border-r border-black px-1.5 py-0.5 text-right">
                            <b>
                              <i>CGST</i>
                            </b>
                          </td>
                          <td className="border-r border-black" />
                          <td className="border-r border-black" />
                          <td className="border-r border-black" />
                          <td className="border-r border-black" />
                          <td className="border-r border-black" />
                          <td className="px-1.5 py-0.5 text-right">
                            <b>{fmtInr(calc.taxTotal / 2)}</b>
                          </td>
                        </tr>
                        <tr>
                          <td className="border-r border-black" />
                          <td className="border-r border-black px-1.5 py-0.5 text-right">
                            <b>
                              <i>SGST</i>
                            </b>
                          </td>
                          <td className="border-r border-black" />
                          <td className="border-r border-black" />
                          <td className="border-r border-black" />
                          <td className="border-r border-black" />
                          <td className="border-r border-black" />
                          <td className="px-1.5 py-0.5 text-right">
                            <b>{fmtInr(calc.taxTotal / 2)}</b>
                          </td>
                        </tr>
                      </>
                    ) : (
                      <tr>
                        <td className="border-r border-black" />
                        <td className="border-r border-black px-1.5 py-0.5 text-right">
                          <b>
                            <i>IGST</i>
                          </b>
                        </td>
                        <td className="border-r border-black" />
                        <td className="border-r border-black" />
                        <td className="border-r border-black" />
                        <td className="border-r border-black" />
                        <td className="border-r border-black" />
                        <td className="px-1.5 py-0.5 text-right">
                          <b>{fmtInr(calc.taxTotal)}</b>
                        </td>
                      </tr>
                    )}

                    {calc.roundOff !== 0 && (
                      <tr>
                        <td className="border-r border-black" />
                        <td className="border-r border-black px-1.5 py-0.5 text-right">
                          <b>
                            <i>Round Off</i>
                          </b>
                        </td>
                        <td className="border-r border-black" />
                        <td className="border-r border-black" />
                        <td className="border-r border-black" />
                        <td className="border-r border-black" />
                        <td className="border-r border-black" />
                        <td className="px-1.5 py-0.5 text-right">
                          <b>{fmtInr(calc.roundOff)}</b>
                        </td>
                      </tr>
                    )}

                    {/* Dynamic whitespace filler */}
                    <tr style={{ height: `${fillerHeightPx}px` }}>
                      <td className="border-r border-black" />
                      <td className="border-r border-black" />
                      <td className="border-r border-black" />
                      <td className="border-r border-black" />
                      <td className="border-r border-black" />
                      <td className="border-r border-black" />
                      <td className="border-r border-black" />
                      <td />
                    </tr>

                    {/* Total Row */}
                    <tr className="border-t border-black">
                      <td className="border-r border-black px-1 py-1" />
                      <td className="border-r border-black px-1.5 py-1 text-right">Total</td>
                      <td className="border-r border-black px-1 py-1" />
                      <td className="border-r border-black px-1.5 py-1 text-right">
                        <b>{calc.qtyTotal}</b>
                      </td>
                      <td className="border-r border-black px-1 py-1" />
                      <td className="border-r border-black px-1 py-1" />
                      <td className="border-r border-black px-1 py-1" />
                      <td className="px-1.5 py-1 text-right text-[14px]">
                        <b>₹ {fmtInr(calc.grandTotal)}</b>
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Amount Chargeable in Words */}
                <table className="w-full border-collapse border-x border-b border-black">
                  <tbody>
                    <tr>
                      <td className="px-1.5 pt-1 text-[11px]">Amount Chargeable (in words)</td>
                      <td className="px-1.5 pt-1 text-right text-[11px]">E. &amp; O.E</td>
                    </tr>
                    <tr>
                      <td colSpan={2} className="px-1.5 pb-1.5 text-[12.5px]">
                        <b>{amountToWords(calc.grandTotal)}</b>
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* HSN/SAC Tax Summary Table */}
                <table className="w-full border-collapse border-x border-b border-black text-[11px]">
                  <thead>
                    <tr>
                      <th rowSpan={2} className="border-r border-b border-black p-1 font-normal">
                        HSN/SAC
                      </th>
                      <th rowSpan={2} className="border-r border-b border-black p-1 font-normal">
                        Taxable Value
                      </th>
                      {calc.intra ? (
                        <>
                          <th colSpan={2} className="border-r border-b border-black p-1 font-normal">
                            Central Tax
                          </th>
                          <th colSpan={2} className="border-r border-b border-black p-1 font-normal">
                            State Tax
                          </th>
                        </>
                      ) : (
                        <th colSpan={2} className="border-r border-b border-black p-1 font-normal">
                          Integrated Tax
                        </th>
                      )}
                      <th rowSpan={2} className="border-b border-black p-1 font-normal">
                        Total Tax Amount
                      </th>
                    </tr>
                    <tr>
                      {calc.intra ? (
                        <>
                          <th className="border-r border-b border-black p-1 font-normal">Rate</th>
                          <th className="border-r border-b border-black p-1 font-normal">Amount</th>
                          <th className="border-r border-b border-black p-1 font-normal">Rate</th>
                          <th className="border-r border-b border-black p-1 font-normal">Amount</th>
                        </>
                      ) : (
                        <>
                          <th className="border-r border-b border-black p-1 font-normal">Rate</th>
                          <th className="border-r border-b border-black p-1 font-normal">Amount</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {calc.hsnRows.map((x, idx) => (
                      <tr key={idx}>
                        <td className="border-r border-b border-black px-1.5 py-0.5">{x.hsn}</td>
                        <td className="border-r border-b border-black px-1.5 py-0.5 text-right">
                          {fmtInr(x.tv)}
                        </td>
                        {calc.intra ? (
                          <>
                            <td className="border-r border-b border-black px-1.5 py-0.5 text-right">
                              {x.rate / 2}%
                            </td>
                            <td className="border-r border-b border-black px-1.5 py-0.5 text-right">
                              {fmtInr(x.tax / 2)}
                            </td>
                            <td className="border-r border-b border-black px-1.5 py-0.5 text-right">
                              {x.rate / 2}%
                            </td>
                            <td className="border-r border-b border-black px-1.5 py-0.5 text-right">
                              {fmtInr(x.tax / 2)}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="border-r border-b border-black px-1.5 py-0.5 text-right">
                              {x.rate}%
                            </td>
                            <td className="border-r border-b border-black px-1.5 py-0.5 text-right">
                              {fmtInr(x.tax)}
                            </td>
                          </>
                        )}
                        <td className="border-b border-black px-1.5 py-0.5 text-right">
                          {fmtInr(x.tax)}
                        </td>
                      </tr>
                    ))}

                    <tr>
                      <td className="border-r border-black px-1.5 py-0.5 text-right">
                        <b>Total</b>
                      </td>
                      <td className="border-r border-black px-1.5 py-0.5 text-right">
                        <b>{fmtInr(calc.taxableTotal)}</b>
                      </td>
                      {calc.intra ? (
                        <>
                          <td className="border-r border-black px-1.5 py-0.5" />
                          <td className="border-r border-black px-1.5 py-0.5 text-right">
                            <b>{fmtInr(calc.taxTotal / 2)}</b>
                          </td>
                          <td className="border-r border-black px-1.5 py-0.5" />
                          <td className="border-r border-black px-1.5 py-0.5 text-right">
                            <b>{fmtInr(calc.taxTotal / 2)}</b>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="border-r border-black px-1.5 py-0.5" />
                          <td className="border-r border-black px-1.5 py-0.5 text-right">
                            <b>{fmtInr(calc.taxTotal)}</b>
                          </td>
                        </>
                      )}
                      <td className="px-1.5 py-0.5 text-right">
                        <b>{fmtInr(calc.taxTotal)}</b>
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Tax Amount in Words */}
                <table className="w-full border-collapse border-x border-b border-black">
                  <tbody>
                    <tr>
                      <td className="px-1.5 py-1">
                        Tax Amount (in words) :{' '}
                        <b className="text-[12px]">{amountToWords(calc.taxTotal)}</b>
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Footer: Bank Details + Embedded UPI QR + Declaration + Signatory */}
                <table className="w-full border-collapse border-x border-b border-black">
                  <tbody>
                    <tr>
                      <td className="w-[54%] border-r border-black p-2.5 text-[11px] align-top">
                        {(profile.bank.name || profile.bank.acc || upiQrDataUrl) && (
                          <div className="mb-2 pb-2 flex gap-3.5 items-center border-b border-neutral-400">
                            {upiQrDataUrl && (
                              <div className="text-center text-[10px] shrink-0">
                                <img
                                  src={upiQrDataUrl}
                                  alt="Invoice UPI QR"
                                  className="w-[84px] h-[84px] block mx-auto mb-0.5"
                                />
                                <span>Scan to pay (UPI)</span>
                              </div>
                            )}
                            {(profile.bank.name || profile.bank.acc || profile.bank.upi) && (
                              <div className="leading-[1.55]">
                                <b>Company’s Bank Details</b>
                                <br />
                                {profile.bank.holder && (
                                  <>
                                    A/c Holder’s Name : <b>{profile.bank.holder}</b>
                                    <br />
                                  </>
                                )}
                                {profile.bank.name && (
                                  <>
                                    Bank Name : <b>{profile.bank.name}</b>
                                    <br />
                                  </>
                                )}
                                {profile.bank.acc && (
                                  <>
                                    A/c No. : <b>{profile.bank.acc}</b>
                                    <br />
                                  </>
                                )}
                                {profile.bank.ifsc && (
                                  <>
                                    IFS Code : <b>{profile.bank.ifsc}</b>
                                  </>
                                )}
                                {profile.bank.branch && (
                                  <>
                                    {' '}
                                    Branch : <b>{profile.bank.branch}</b>
                                  </>
                                )}
                                {profile.bank.upi && (
                                  <>
                                    <br />
                                    UPI : <b>{profile.bank.upi}</b>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        <div>
                          <u>Declaration</u>
                          <br />
                          {doc.type === 'tax'
                            ? profile.decl
                            : doc.type === 'proforma'
                            ? 'This is a proforma invoice issued for advance payment / order confirmation. It is not a tax invoice and is not valid for claiming input tax credit.'
                            : 'This quotation is an estimate based on the details provided and is valid until the date mentioned above. Prices and taxes are subject to change thereafter.'}
                        </div>

                        {profile.terms && (
                          <div className="mt-1.5 whitespace-pre-line">
                            <u>Terms &amp; Conditions</u>
                            <br />
                            {profile.terms}
                          </div>
                        )}
                      </td>

                      <td className="text-right align-bottom p-2.5 h-[130px]">
                        <div>
                          <b>for {profile.co.name || 'Company'}</b>
                        </div>
                        <div className="h-[62px] my-1 flex items-center justify-end">
                          {profile.sig && (
                            <img
                              src={profile.sig}
                              alt="Authorised Signatory"
                              className="max-h-[60px] max-w-[200px] object-contain"
                            />
                          )}
                        </div>
                        <div>Authorised Signatory</div>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="text-center mt-2 text-[11px]">
                  This is a Computer Generated {doc.type === 'quote' ? 'Quotation' : 'Invoice'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
