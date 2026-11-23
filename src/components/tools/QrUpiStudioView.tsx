import React, { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  AlertTriangle,
  BookmarkPlus,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  HardDrive,
  Landmark,
  Printer,
  QrCode,
  RotateCcw,
  Share2,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import {
  buildNpciUpiIntentUrl,
  sanitizeNpciNote,
  sanitizeNpciPayeeName,
  sanitizeNpciRef,
  validateNpciUpiIntentUrl,
} from '../../utils/npciUpiValidator';
import {
  safeReadStorage,
  safeRemoveStorage,
  safeWriteStorage,
} from '../../utils/browserVault';
import { exportElementToPdf, printTargetElement } from '../../utils/printReport';

type StudioTab = 'upi' | 'bank';
type AccountCategory = 'Current' | 'Savings' | 'OD / CC';
type CollectionMode = 'standard' | 'merchant';

interface QrUpiDraftState {
  activeTab: StudioTab;
  collectionMode: CollectionMode;
  upiId: string;
  businessName: string;
  amountInput: string;
  remarks: string;
  invoiceRef: string;
  mcc: string;
  accountNumber: string;
  confirmAccountNumber: string;
  ifscCode: string;
  accountType: AccountCategory;
}

interface QrUpiSavedProfile {
  id: string;
  label: string;
  updatedAt: string;
  mode: StudioTab;
  collectionMode?: CollectionMode;
  upiId: string;
  businessName: string;
  accountNumber: string;
  ifscCode: string;
  accountType?: AccountCategory;
  remarks: string;
  invoiceRef?: string;
  mcc?: string;
}

const QR_DRAFT_KEY = 'vcpl_qr_upi_draft_v2';
const QR_PROFILES_KEY = 'vcpl_qr_upi_profiles_v1';

const DEFAULT_QR_DRAFT: QrUpiDraftState = {
  activeTab: 'upi',
  collectionMode: 'standard',
  upiId: '',
  businessName: '',
  amountInput: '',
  remarks: '',
  invoiceRef: '',
  mcc: '5999',
  accountNumber: '',
  confirmAccountNumber: '',
  ifscCode: '',
  accountType: 'Current',
};

const QUICK_UPI_HANDLES = [
  '@okaxis',
  '@okicici',
  '@ybl',
  '@paytm',
  '@oksbi',
  '@okhdfcbank',
  '@hdfcbank',
  '@icici',
  '@sbi',
] as const;

const VPA_PROVIDER_MAP: Record<string, string> = {
  '@okhdfcbank': 'HDFC Bank (Google Pay)',
  '@okaxis': 'Axis Bank (Google Pay)',
  '@okicici': 'ICICI Bank (Google Pay)',
  '@oksbi': 'State Bank of India (Google Pay)',
  '@ybl': 'Yes Bank (PhonePe)',
  '@ibl': 'ICICI Bank (PhonePe)',
  '@axl': 'Axis Bank (PhonePe)',
  '@paytm': 'Paytm UPI Handle',
  '@pthdfc': 'HDFC Bank (Paytm)',
  '@ptaxis': 'Axis Bank (Paytm)',
  '@ptsbi': 'State Bank of India (Paytm)',
  '@ptyes': 'Yes Bank (Paytm)',
  '@hdfcbank': 'HDFC Bank Official UPI',
  '@icici': 'ICICI Bank Official UPI',
  '@sbi': 'State Bank of India (BHIM SBI Pay)',
  '@axisbank': 'Axis Bank Official UPI',
  '@kotak': 'Kotak Mahindra Bank UPI',
  '@upi': 'BHIM NPCI Common Handle',
  '@apl': 'Amazon Pay (Axis Bank)',
  '@rapl': 'Amazon Pay (RBL Bank)',
  '@waaxis': 'WhatsApp Pay (Axis Bank)',
  '@wahdfcbank': 'WhatsApp Pay (HDFC Bank)',
  '@waicici': 'WhatsApp Pay (ICICI Bank)',
  '@wasbi': 'WhatsApp Pay (SBI)',
  '@ikwik': 'MobiKwik (HDFC/Yes)',
};

const IFSC_BANK_MAP: Record<string, string> = {
  HDFC: 'HDFC Bank Ltd.',
  SBIN: 'State Bank of India',
  ICIC: 'ICICI Bank Ltd.',
  UTIB: 'Axis Bank Ltd.',
  AXIS: 'Axis Bank Ltd.',
  KKBK: 'Kotak Mahindra Bank',
  BARB: 'Bank of Baroda',
  CNRB: 'Canara Bank',
  PUNB: 'Punjab National Bank',
  UBIN: 'Union Bank of India',
  BKID: 'Bank of India',
  IDIB: 'Indian Bank',
  CBIN: 'Central Bank of India',
  IOBA: 'Indian Overseas Bank',
  UCBA: 'UCO Bank',
  MAHB: 'Bank of Maharashtra',
  PSIB: 'Punjab & Sind Bank',
  YESB: 'Yes Bank Ltd.',
  INDB: 'IndusInd Bank Ltd.',
  IDFB: 'IDFC FIRST Bank',
  FDRL: 'Federal Bank Ltd.',
  KARB: 'Karnataka Bank Ltd.',
  KVBL: 'Karur Vysya Bank',
  SIBL: 'South Indian Bank',
  TMBL: 'Tamilnad Mercantile Bank',
  CIUB: 'City Union Bank',
  RATN: 'RBL Bank Ltd.',
  CSBK: 'CSB Bank Ltd.',
  DCBL: 'DCB Bank Ltd.',
  DLXB: 'Dhanlaxmi Bank',
  JAKA: 'Jammu & Kashmir Bank',
  BDBL: 'Bandhan Bank Ltd.',
  AUBL: 'AU Small Finance Bank',
  ESFB: 'Equitas Small Finance Bank',
  UJVN: 'Ujjivan Small Finance Bank',
  DBSS: 'DBS Bank India Ltd.',
  SCBL: 'Standard Chartered Bank',
  CITI: 'Citibank N.A.',
  HSBC: 'HSBC Bank India',
  DEUT: 'Deutsche Bank AG',
  AIRP: 'Airtel Payments Bank',
  PYTM: 'Paytm Payments Bank',
  JIOP: 'Jio Payments Bank',
  IPOS: 'India Post Payments Bank',
};

const MERCHANT_CATEGORY_CODES = [
  { code: '5511', label: '5511 · Automobile Dealers (New & Used)' },
  { code: '5533', label: '5533 · Automotive Parts & Accessories' },
  { code: '7538', label: '7538 · Automotive Service & Repair' },
  { code: '5411', label: '5411 · Grocery & Supermarkets' },
  { code: '5999', label: '5999 · Miscellaneous Retail Store' },
  { code: '8999', label: '8999 · Professional / Accounting Services' },
  { code: '8099', label: '8099 · Medical & Healthcare' },
  { code: '8299', label: '8299 · Education & Training' },
  { code: '7399', label: '7399 · Business Services' },
] as const;

const QUICK_AMOUNT_PRESETS = [500, 1000, 2500, 5000, 10000] as const;

const SUPPORTED_UPI_APPS = [
  'BHIM',
  'Google Pay',
  'PhonePe',
  'Paytm',
  'CRED',
  'Amazon Pay',
  'WhatsApp Pay',
  'Bank Apps (YONO / iMobile / PayZapp)',
] as const;

const UPI_P2P_SINGLE_LIMIT = 100000;

interface VerifiedIfscRecord {
  ifsc: string;
  bankName: string;
  branchName: string;
  city: string;
  state: string;
  micr: string;
  upi: boolean;
  imps: boolean;
  neft: boolean;
  rtgs: boolean;
  source: 'local-db' | 'live-rbi' | 'prefix-fallback';
}

const BANK_VPA_SUFFIX_HINTS: Record<string, string[]> = {
  SBIN: ['@oksbi', '@sbi', '@ybl', '@ptsbi', '@wasbi'],
  HDFC: ['@okhdfcbank', '@hdfcbank', '@pthdfc', '@ybl'],
  ICIC: ['@okicici', '@icici', '@ibl', '@ybl'],
  UTIB: ['@okaxis', '@axisbank', '@axl', '@ptaxis'],
  AXIS: ['@okaxis', '@axisbank', '@axl', '@ptaxis'],
  KKBK: ['@kotak', '@okaxis', '@ybl'],
  BARB: ['@barodampay', '@okicici', '@ybl'],
  CNRB: ['@cnrb', '@oksbi', '@ybl'],
  PUNB: ['@pnb', '@oksbi', '@ybl'],
  UBIN: ['@unionbank', '@okhdfcbank', '@ybl'],
  BKID: ['@boi', '@oksbi', '@ybl'],
  IDIB: ['@indianbank', '@okicici', '@ybl'],
  YESB: ['@ybl', '@ptyes'],
  INDB: ['@indus', '@okaxis', '@ybl'],
  IDFB: ['@idfcbank', '@okhdfcbank', '@ybl'],
  FDRL: ['@federal', '@okaxis', '@ybl'],
  AUBL: ['@aubank', '@ybl'],
};

const sanitizePayeeName = sanitizeNpciPayeeName;
const sanitizeNote = sanitizeNpciNote;
const sanitizeRef = sanitizeNpciRef;

export const QrUpiStudioView: React.FC = () => {
  const initialDraft = useMemo(
    () => safeReadStorage<QrUpiDraftState>(QR_DRAFT_KEY, DEFAULT_QR_DRAFT),
    []
  );

  const [activeTab, setActiveTab] = useState<StudioTab>(initialDraft.activeTab || 'upi');
  const [collectionMode, setCollectionMode] = useState<CollectionMode>(
    initialDraft.collectionMode || 'standard'
  );

  // UPI ID & Payee fields
  const [upiId, setUpiId] = useState(initialDraft.upiId || '');
  const [businessName, setBusinessName] = useState(initialDraft.businessName || '');
  const [amountInput, setAmountInput] = useState(initialDraft.amountInput || '');
  const [remarks, setRemarks] = useState(initialDraft.remarks || '');
  const [invoiceRef, setInvoiceRef] = useState(initialDraft.invoiceRef || '');
  const [mcc, setMcc] = useState(initialDraft.mcc || '5999');

  // Bank A/C + IFSC fields
  const [accountNumber, setAccountNumber] = useState(initialDraft.accountNumber || '');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState(
    initialDraft.confirmAccountNumber || initialDraft.accountNumber || ''
  );
  const [ifscCode, setIfscCode] = useState(initialDraft.ifscCode || '');
  const [accountType, setAccountType] = useState<AccountCategory>(
    initialDraft.accountType || 'Current'
  );

  // Saved browser payee profiles
  const [savedProfiles, setSavedProfiles] = useState<QrUpiSavedProfile[]>(() =>
    safeReadStorage<QrUpiSavedProfile[]>(QR_PROFILES_KEY, [])
  );
  const [profileNotice, setProfileNotice] = useState('');

  // Live RBI IFSC Verification State
  const [ifscLookupStatus, setIfscLookupStatus] = useState<
    'idle' | 'loading' | 'verified' | 'not-found' | 'fallback'
  >('idle');
  const [verifiedIfsc, setVerifiedIfsc] = useState<VerifiedIfscRecord | null>(null);
  const [ifscLookupError, setIfscLookupError] = useState('');

  // Output & Feedback state
  const standeeCardRef = useRef<HTMLDivElement | null>(null);
  const [qrUrl, setQrUrl] = useState('');
  const [copiedTarget, setCopiedTarget] = useState<'uri' | 'bank' | null>(null);
  const [shareFeedback, setShareFeedback] = useState('');
  const [vpaPrefixDraft, setVpaPrefixDraft] = useState('');
  const [vpaHandleDraft, setVpaHandleDraft] = useState('');

  useEffect(() => {
    safeWriteStorage(QR_DRAFT_KEY, {
      activeTab,
      collectionMode,
      upiId,
      businessName,
      amountInput,
      remarks,
      invoiceRef,
      mcc,
      accountNumber,
      confirmAccountNumber,
      ifscCode,
      accountType,
    });
  }, [
    activeTab,
    collectionMode,
    upiId,
    businessName,
    amountInput,
    remarks,
    invoiceRef,
    mcc,
    accountNumber,
    confirmAccountNumber,
    ifscCode,
    accountType,
  ]);

  useEffect(() => {
    safeWriteStorage(QR_PROFILES_KEY, savedProfiles);
  }, [savedProfiles]);

  useEffect(() => {
    if (!profileNotice) return;
    const t = window.setTimeout(() => setProfileNotice(''), 3000);
    return () => window.clearTimeout(t);
  }, [profileNotice]);

  // Normalized values
  const cleanUpiId = upiId.replace(/\s+/g, '').trim();
  const cleanAccount = accountNumber.replace(/\s+/g, '').trim();
  const cleanConfirmAccount = confirmAccountNumber.replace(/\s+/g, '').trim();
  const cleanIfsc = ifscCode.replace(/\s+/g, '').toUpperCase().trim();
  const sanitizedBusinessName = sanitizePayeeName(businessName);

  const detectedBankFromIfsc = useMemo(() => {
    if (verifiedIfsc && verifiedIfsc.ifsc === cleanIfsc) {
      return verifiedIfsc.bankName;
    }
    if (cleanIfsc.length < 4) return '';
    return IFSC_BANK_MAP[cleanIfsc.slice(0, 4)] || '';
  }, [cleanIfsc, verifiedIfsc]);

  // Live RBI IFSC Directory Lookup (Local SQLite API + Razorpay RBI IFSC Directory fallback)
  useEffect(() => {
    if (activeTab !== 'bank' || cleanIfsc.length !== 11) {
      setIfscLookupStatus('idle');
      setVerifiedIfsc(null);
      setIfscLookupError('');
      return;
    }

    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleanIfsc)) {
      setIfscLookupStatus('not-found');
      setVerifiedIfsc(null);
      setIfscLookupError(
        'Invalid RBI IFSC syntax: expected 4 bank letters, "0" as 5th char, and 6 branch chars.'
      );
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 4500);

    setIfscLookupStatus('loading');
    setIfscLookupError('');

    const runVerification = async () => {
      try {
        // 1. Check backend SQLite + fallback directory
        const apiRes = await fetch(
          `/api/ifsc/search?ifsc=${encodeURIComponent(cleanIfsc)}&status=ALL&limit=1`,
          { signal: controller.signal }
        );
        if (apiRes.ok) {
          const payload = (await apiRes.json()) as {
            items?: Array<Record<string, unknown>>;
            fallbackSource?: string | null;
          };
          const row = payload.items?.[0];
          if (row && String(row.ifsc || '').toUpperCase() === cleanIfsc) {
            if (cancelled) return;
            const statusStr = String(row.bank_status || 'Active');
            if (statusStr !== 'Active') {
              setIfscLookupStatus('not-found');
              setVerifiedIfsc(null);
              setIfscLookupError(
                `IFSC ${cleanIfsc} is marked "${statusStr}" (${String(
                  row.successor_bank || 'amalgamated bank'
                )}). Use the active successor IFSC so your bank accepts UPI transfers.`
              );
              return;
            }
            setVerifiedIfsc({
              ifsc: cleanIfsc,
              bankName: String(row.bank_name || IFSC_BANK_MAP[cleanIfsc.slice(0, 4)] || ''),
              branchName: String(row.branch_name || 'Main Branch'),
              city: String(row.city || ''),
              state: String(row.state || ''),
              micr: String(row.micr || ''),
              upi: row.upi !== 0 && row.upi !== false,
              imps: row.imps !== 0 && row.imps !== false,
              neft: row.neft !== 0 && row.neft !== false,
              rtgs: row.rtgs !== 0 && row.rtgs !== false,
              source: payload.fallbackSource ? 'live-rbi' : 'local-db',
            });
            setIfscLookupStatus('verified');
            return;
          }
        }
      } catch {
        // Fall through to direct RBI directory check
      }

      try {
        // 2. Direct Razorpay RBI IFSC lookup
        const liveRes = await fetch(`https://ifsc.razorpay.com/${cleanIfsc}`, {
          signal: controller.signal,
        });
        if (liveRes.status === 404) {
          if (cancelled) return;
          setIfscLookupStatus('not-found');
          setVerifiedIfsc(null);
          setIfscLookupError(
            `IFSC ${cleanIfsc} was not found in the RBI directory. Verify the 5th character (zero) and branch digits.`
          );
          return;
        }
        if (liveRes.ok) {
          const data = (await liveRes.json()) as Record<string, unknown>;
          if (cancelled) return;
          setVerifiedIfsc({
            ifsc: String(data.IFSC || cleanIfsc),
            bankName: String(data.BANK || IFSC_BANK_MAP[cleanIfsc.slice(0, 4)] || ''),
            branchName: String(data.BRANCH || 'Main Branch'),
            city: String(data.CITY || ''),
            state: String(data.STATE || ''),
            micr: String(data.MICR || ''),
            upi: data.UPI !== false,
            imps: data.IMPS !== false,
            neft: data.NEFT !== false,
            rtgs: data.RTGS !== false,
            source: 'live-rbi',
          });
          setIfscLookupStatus('verified');
          return;
        }
      } catch {
        // Fall through to offline prefix fallback
      }

      if (cancelled) return;
      const fallbackBank = IFSC_BANK_MAP[cleanIfsc.slice(0, 4)];
      if (fallbackBank) {
        setVerifiedIfsc({
          ifsc: cleanIfsc,
          bankName: fallbackBank,
          branchName: 'Format Validated (Offline Mode)',
          city: '',
          state: '',
          micr: '',
          upi: true,
          imps: true,
          neft: true,
          rtgs: true,
          source: 'prefix-fallback',
        });
        setIfscLookupStatus('fallback');
      } else {
        setIfscLookupStatus('idle');
        setVerifiedIfsc(null);
      }
    };

    void runVerification().finally(() => window.clearTimeout(timeoutId));

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [activeTab, cleanIfsc]);

  const detectedUpiProvider = useMemo(() => {
    const atIdx = cleanUpiId.indexOf('@');
    if (atIdx < 0) return '';
    const suffix = cleanUpiId.slice(atIdx).toLowerCase();
    return VPA_PROVIDER_MAP[suffix] || '';
  }, [cleanUpiId]);

  const parsedAmount = useMemo(() => {
    if (!amountInput.trim()) return 0;
    const n = Number.parseFloat(amountInput);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : -1;
  }, [amountInput]);

  // Strict NPCI & Indian Banking Validation
  const validation = useMemo(() => {
    const issues: string[] = [];

    if (parsedAmount < 0) {
      issues.push('Enter a valid positive INR amount or leave blank for open amount.');
    }

    if (activeTab === 'upi') {
      if (!cleanUpiId) {
        issues.push('Enter your registered UPI ID (e.g. store@okhdfcbank).');
      } else if (!/^[a-zA-Z0-9._-]{2,256}@[a-zA-Z0-9.-]{2,64}$/.test(cleanUpiId)) {
        issues.push('UPI ID must follow NPCI format: username@bankhandle (no spaces).');
      }
      if (!sanitizedBusinessName) {
        issues.push('Enter Account Holder / Business Name so payers see the verified recipient.');
      }
    } else {
      if (!cleanAccount) {
        issues.push('Enter Bank Account Number (9 to 18 digits).');
      } else if (!/^\d{9,18}$/.test(cleanAccount)) {
        issues.push('Bank Account Number must contain 9 to 18 digits only.');
      }

      if (!cleanConfirmAccount) {
        issues.push('Re-enter Bank Account Number to verify against typos.');
      } else if (cleanAccount !== cleanConfirmAccount) {
        issues.push('Bank Account Number and Confirm Account Number do not match.');
      }

      if (!cleanIfsc) {
        issues.push('Enter 11-character RBI IFSC code (e.g. SBIN0003823).');
      } else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleanIfsc)) {
        issues.push(
          'IFSC must be 11 characters: 4-letter bank code + digit "0" + 6-character branch code.'
        );
      } else if (ifscLookupStatus === 'not-found') {
        issues.push(ifscLookupError || `IFSC ${cleanIfsc} could not be verified in the RBI directory.`);
      } else if (verifiedIfsc && !verifiedIfsc.upi) {
        issues.push(`Branch ${cleanIfsc} (${verifiedIfsc.bankName}) reports UPI disabled in RBI records.`);
      }

      if (!sanitizedBusinessName || sanitizedBusinessName.length < 2) {
        issues.push(
          'Enter exact Bank Account Holder Name (mandatory for Bank A/C + IFSC deposits).'
        );
      }
    }

    const isReady = issues.length === 0;
    const exceedsStandardUpiCap = parsedAmount > UPI_P2P_SINGLE_LIMIT;

    return { issues, isReady, exceedsStandardUpiCap };
  }, [
    activeTab,
    cleanAccount,
    cleanConfirmAccount,
    cleanIfsc,
    cleanUpiId,
    ifscLookupError,
    ifscLookupStatus,
    parsedAmount,
    sanitizedBusinessName,
    verifiedIfsc,
  ]);

  const effectiveUpiId = useMemo(() => {
    if (!validation.isReady) return '';
    if (activeTab === 'bank') {
      // NPCI UPI specification requires lowercase IFSC domain suffix (<acct>@<ifsc_lower>.ifsc.npci)
      return `${cleanAccount}@${cleanIfsc.toLowerCase()}.ifsc.npci`;
    }
    return cleanUpiId.toLowerCase();
  }, [activeTab, cleanAccount, cleanIfsc, cleanUpiId, validation.isReady]);

  const effectivePayload = useMemo(() => {
    if (!effectiveUpiId || !sanitizedBusinessName) return '';

    const isMerchant = activeTab === 'upi' && collectionMode === 'merchant' && /^\d{4}$/.test(mcc);
    return buildNpciUpiIntentUrl({
      pa: effectiveUpiId,
      pn: sanitizedBusinessName,
      am: parsedAmount > 0 ? parsedAmount : undefined,
      cu: 'INR',
      tr: invoiceRef,
      tn: remarks,
      mc: isMerchant ? mcc : undefined,
      mode: isMerchant ? (parsedAmount > 0 ? '01' : '02') : undefined,
      purpose: isMerchant ? '00' : undefined,
    });
  }, [
    activeTab,
    collectionMode,
    effectiveUpiId,
    invoiceRef,
    mcc,
    parsedAmount,
    remarks,
    sanitizedBusinessName,
  ]);

  // Pre-render NPCI UPI Intent URL Specification Verification Gate
  const intentValidation = useMemo(
    () => validateNpciUpiIntentUrl(effectivePayload),
    [effectivePayload]
  );

  const canRenderQr = validation.isReady && intentValidation.isValid && Boolean(effectivePayload);

  // ISO/IEC 18004 & NPCI BHIM QR Compliant Generation:
  // Strictly gated behind NPCI Intent URL verification before rendering matrix
  useEffect(() => {
    if (!canRenderQr) {
      setQrUrl('');
      return;
    }

    let cancelled = false;
    QRCode.toDataURL(effectivePayload, {
      margin: 4,
      width: 640,
      errorCorrectionLevel: 'Q',
      color: {
        dark: '#0B1320',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (!cancelled) setQrUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrUrl('');
      });

    return () => {
      cancelled = true;
    };
  }, [canRenderQr, effectivePayload]);

  const handleSavePayeeProfile = () => {
    if (!validation.isReady) {
      setProfileNotice(validation.issues[0] || 'Complete required bank/UPI fields first.');
      return;
    }
    const label =
      sanitizedBusinessName ||
      (activeTab === 'bank' ? `A/C ••••${cleanAccount.slice(-4)}` : cleanUpiId);
    const newProfile: QrUpiSavedProfile = {
      id: `qrp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      label,
      updatedAt: new Date().toISOString(),
      mode: activeTab,
      collectionMode,
      upiId: cleanUpiId,
      businessName: sanitizedBusinessName,
      accountNumber: cleanAccount,
      ifscCode: cleanIfsc,
      accountType,
      remarks: remarks.trim(),
      invoiceRef: invoiceRef.trim(),
      mcc,
    };
    setSavedProfiles((prev) => [newProfile, ...prev.slice(0, 14)]);
    setProfileNotice(`Saved "${label}" in your browser for instant reuse.`);
  };

  const handleLoadPayeeProfile = (p: QrUpiSavedProfile) => {
    setActiveTab(p.mode);
    setCollectionMode(p.collectionMode || 'standard');
    setUpiId(p.upiId);
    setBusinessName(p.businessName);
    setAccountNumber(p.accountNumber);
    setConfirmAccountNumber(p.accountNumber);
    setIfscCode(p.ifscCode);
    setAccountType(p.accountType || 'Current');
    setRemarks(p.remarks);
    setInvoiceRef(p.invoiceRef || '');
    setMcc(p.mcc || '5999');
    setProfileNotice(`Loaded "${p.label}" from browser storage.`);
  };

  const handleClearDraft = () => {
    setUpiId('');
    setBusinessName('');
    setAmountInput('');
    setRemarks('');
    setInvoiceRef('');
    setAccountNumber('');
    setConfirmAccountNumber('');
    setIfscCode('');
    setCollectionMode('standard');
    safeRemoveStorage(QR_DRAFT_KEY);
    setProfileNotice('Cleared all input fields.');
  };

  const applyUpiHandle = (handle: string) => {
    const current = cleanUpiId;
    if (!current) {
      setUpiId(`businessname${handle}`);
      return;
    }
    const atIndex = current.indexOf('@');
    const localPart = atIndex >= 0 ? current.slice(0, atIndex) : current;
    setUpiId(`${localPart || 'businessname'}${handle}`);
  };

  const copyValue = async (value: string, target: 'uri' | 'bank') => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedTarget(target);
      window.setTimeout(() => setCopiedTarget(null), 1800);
    } catch {
      // Ignore clipboard failures
    }
  };

  const bankTransferText = useMemo(() => {
    if (!cleanAccount || !cleanIfsc) return '';
    return [
      `Beneficiary: ${sanitizedBusinessName || 'Account Holder'}`,
      detectedBankFromIfsc ? `Bank: ${detectedBankFromIfsc}` : '',
      `Account No: ${cleanAccount} (${accountType})`,
      `IFSC Code: ${cleanIfsc}`,
      parsedAmount > 0 ? `Amount: INR ${parsedAmount.toFixed(2)}` : '',
      sanitizeRef(invoiceRef) ? `Reference: ${sanitizeRef(invoiceRef)}` : '',
      sanitizeNote(remarks) ? `Remarks: ${sanitizeNote(remarks)}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }, [
    accountType,
    cleanAccount,
    cleanIfsc,
    detectedBankFromIfsc,
    invoiceRef,
    parsedAmount,
    remarks,
    sanitizedBusinessName,
  ]);

  const handleShare = async () => {
    if (!effectivePayload) return;
    setShareFeedback('');
    const shareTitle = `${sanitizedBusinessName} — UPI Payment`;
    const shareText = `Pay ${sanitizedBusinessName}${
      parsedAmount > 0 ? ` ₹${parsedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : ''
    }\nUPI: ${effectiveUpiId}${
      cleanAccount && cleanIfsc ? `\nBank A/C: ${cleanAccount} | IFSC: ${cleanIfsc}` : ''
    }\nLink: ${effectivePayload}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: shareTitle,
          text: shareText,
        });
        return;
      }
      await navigator.clipboard.writeText(shareText);
      setShareFeedback('Payment details copied to clipboard.');
      window.setTimeout(() => setShareFeedback(''), 2400);
    } catch {
      // Ignore user cancel
    }
  };

  const downloadStandeeJpg = () => {
    if (!qrUrl || !canRenderQr) return;

    const canvas = document.createElement('canvas');
    canvas.width = 760;
    canvas.height = 1040;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // VCPL Deep Slate Background
    const grad = ctx.createLinearGradient(0, 0, 0, 1040);
    grad.addColorStop(0, '#1E293B');
    grad.addColorStop(0.55, '#2F3E4E');
    grad.addColorStop(1, '#111827');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 760, 1040);

    // Top Marigold Stripe
    ctx.fillStyle = '#F9C80E';
    ctx.fillRect(0, 0, 760, 18);

    // Top Standee Header
    ctx.fillStyle = '#FFFDF5';
    ctx.font = 'bold 31px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      activeTab === 'bank' ? 'BHIM / BANK APP UPI QR (.IFSC.NPCI)' : 'SCAN & PAY VIA ANY UPI APP',
      380,
      78
    );

    ctx.fillStyle = '#CEE5DC';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(
      activeTab === 'bank'
        ? 'DIRECT A/C + IFSC · USE BANK VPA FOR GPAY / PHONEPE / PAYTM'
        : 'NPCI DIRECT BANK SETTLEMENT · ZERO TRANSACTION FEE',
      380,
      110
    );

    // White Card Surface
    const rx = 74;
    const ry = 142;
    const rw = 612;
    const rh = 746;
    const radius = 26;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(rx + radius, ry);
    ctx.lineTo(rx + rw - radius, ry);
    ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + radius);
    ctx.lineTo(rx + rw, ry + rh - radius);
    ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - radius, ry + rh);
    ctx.lineTo(rx + radius, ry + rh);
    ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - radius);
    ctx.lineTo(rx, ry + radius);
    ctx.quadraticCurveTo(rx, ry, rx + radius, ry);
    ctx.closePath();
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 10;
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Accent bar inside card
    ctx.fillStyle = '#F9C80E';
    ctx.fillRect(250, 170, 260, 5);

    // Payee Name
    ctx.fillStyle = '#2F3E4E';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(sanitizedBusinessName.toUpperCase(), 380, 218);

    // Sub-destination (Bank name + Branch / UPI provider)
    const bankOrProvider =
      activeTab === 'bank'
        ? `${detectedBankFromIfsc || 'Bank Account'}${
            verifiedIfsc?.branchName && verifiedIfsc.source !== 'prefix-fallback'
              ? ` · ${verifiedIfsc.branchName}`
              : ''
          } (${accountType})`
        : detectedUpiProvider || 'Direct Bank Linked UPI';
    ctx.fillStyle = '#475569';
    ctx.font = '600 14px sans-serif';
    ctx.fillText(bankOrProvider.slice(0, 58), 380, 246);

    const qrImg = new Image();
    qrImg.onload = () => {
      // Crisp 400x400 QR with 4-module white quiet zone already baked into PNG
      ctx.drawImage(qrImg, 180, 268, 400, 400);

      // Amount Banner
      if (parsedAmount > 0) {
        ctx.fillStyle = '#FEF2C8';
        ctx.strokeStyle = '#2F3E4E';
        ctx.lineWidth = 2;
        ctx.fillRect(190, 686, 380, 62);
        ctx.strokeRect(190, 686, 380, 62);

        ctx.fillStyle = '#92400E';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText('FIXED PAYMENT AMOUNT', 380, 706);

        ctx.fillStyle = '#111827';
        ctx.font = 'bold 24px monospace';
        ctx.fillText(
          `₹ ${parsedAmount.toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`,
          380,
          735
        );
      } else {
        ctx.fillStyle = '#F8FAFC';
        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = 1.5;
        ctx.fillRect(190, 686, 380, 50);
        ctx.strokeRect(190, 686, 380, 50);

        ctx.fillStyle = '#2F3E4E';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText('SCAN WITH ANY UPI APP & ENTER AMOUNT', 380, 716);
      }

      // Destination Details
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 15px monospace';
      if (activeTab === 'bank') {
        ctx.fillText(`A/C: ${cleanAccount}  |  IFSC: ${cleanIfsc}`, 380, 782);
      } else {
        ctx.fillText(`UPI ID: ${effectiveUpiId}`, 380, 782);
      }

      const cleanTr = sanitizeRef(invoiceRef);
      const cleanTn = sanitizeNote(remarks);
      const metaLine = [cleanTr ? `Ref: ${cleanTr}` : '', cleanTn ? `Note: ${cleanTn}` : '']
        .filter(Boolean)
        .join(' · ');

      if (metaLine) {
        ctx.fillStyle = '#475569';
        ctx.font = '600 13px sans-serif';
        ctx.fillText(metaLine.slice(0, 62), 380, 812);
      }

      ctx.fillStyle = '#12805C';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('Deposits directly into beneficiary bank account via NPCI UPI', 380, 856);

      // Footer Apps Strip
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(0, 916, 760, 124);

      ctx.fillStyle = '#FFFDF5';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(
        activeTab === 'bank'
          ? 'BHIM & Select Bank Apps Only · For GPay / PhonePe use Bank Transfer (A/C + IFSC)'
          : 'BHIM · Google Pay · PhonePe · Paytm · CRED · Amazon Pay · WhatsApp Pay',
        380,
        962
      );

      ctx.fillStyle = '#F9C80E';
      ctx.font = '600 12px sans-serif';
      ctx.fillText('Standard ISO 18004 Quiet Zone · Generated Locally in Browser', 380, 994);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.96);
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `UPI_Standee_${sanitizedBusinessName.replace(/\s+/g, '_')}.jpg`;
      link.click();
    };
    qrImg.src = qrUrl;
  };

  const handlePrint = () => {
    void printTargetElement({
      element: standeeCardRef.current,
      title: `UPI_Standee_${sanitizedBusinessName.replace(/\s+/g, '_') || 'Payment'}`,
      prepareClone: (clone) => {
        clone.style.position = 'static';
        clone.style.boxShadow = 'none';
        clone.style.margin = '12mm auto';
        clone.style.maxWidth = '400px';
      },
    });
  };

  const handleSaveStandeePdf = () => {
    void exportElementToPdf({
      element: standeeCardRef.current,
      filename: `UPI_Standee_${sanitizedBusinessName.replace(/\s+/g, '_') || 'Payment'}.pdf`,
      prepareClone: (clonedDoc) => {
        clonedDoc.querySelectorAll('.lg\\:sticky').forEach((n) => {
          (n as HTMLElement).style.position = 'static';
        });
      },
    });
  };

  const destinationSummary = useMemo(() => {
    if (!validation.isReady) return '';
    if (activeTab === 'bank') {
      const bankLabel = detectedBankFromIfsc || 'Indian Bank Account';
      return `${bankLabel} · A/C ••••${cleanAccount.slice(-4)} (${cleanIfsc})`;
    }
    return detectedUpiProvider ? `${cleanUpiId} · ${detectedUpiProvider}` : cleanUpiId;
  }, [
    activeTab,
    cleanAccount,
    cleanIfsc,
    cleanUpiId,
    detectedBankFromIfsc,
    detectedUpiProvider,
    validation.isReady,
  ]);

  const preFlightChecks = useMemo(() => {
    const intentChecks = intentValidation.checks.map((chk) => ({
      id: chk.id,
      label: chk.label,
      passed: chk.passed,
      statusText: chk.statusText,
      detail: chk.detail,
    }));

    if (activeTab === 'bank') {
      return [
        {
          id: 'ifsc-rbi',
          label: 'RBI Bank & UPI Branch Check',
          passed:
            (ifscLookupStatus === 'verified' || ifscLookupStatus === 'fallback') &&
            (!verifiedIfsc || verifiedIfsc.upi),
          statusText:
            (ifscLookupStatus === 'verified' || ifscLookupStatus === 'fallback') &&
            (!verifiedIfsc || verifiedIfsc.upi)
              ? 'Verified'
              : 'Pending',
          detail: verifiedIfsc
            ? `${verifiedIfsc.bankName}${
                verifiedIfsc.source !== 'prefix-fallback' ? ` · ${verifiedIfsc.branchName}` : ''
              }`
            : 'Enter 11-char IFSC',
        },
        ...intentChecks,
      ];
    }

    return intentChecks;
  }, [activeTab, ifscLookupStatus, intentValidation.checks, verifiedIfsc]);

  const accountsMatch =
    Boolean(cleanAccount) &&
    Boolean(cleanConfirmAccount) &&
    cleanAccount === cleanConfirmAccount;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start print:block">
      {/* Left Column: Bank-Standard Input & Validation Controls */}
      <div className="lg:col-span-7 space-y-5 no-print">
        <div className="bg-white border-2 border-[#2F3E4E] rounded-2xl p-5 sm:p-6 shadow-[0_4px_0_#2F3E4E] space-y-5">
          {/* Browser Save & Reset Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#2F3E4E]/15">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#12805C]">
              <HardDrive className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Browser-Only Storage Active · Zero Server Uploads</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSavePayeeProfile}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#CEE5DC] hover:bg-[#b8dcd0] border border-[#2F3E4E] text-[11px] font-display font-extrabold text-[#2F3E4E] cursor-pointer whitespace-nowrap"
              >
                <BookmarkPlus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Save Beneficiary</span>
              </button>
              <button
                type="button"
                onClick={handleClearDraft}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white hover:bg-[#FEF2C8] border border-[#2F3E4E]/60 text-[11px] font-bold text-[#2F3E4E] cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Clear</span>
              </button>
            </div>
          </div>

          {profileNotice && (
            <div className="px-3.5 py-2 rounded-xl bg-[#FEF2C8] border border-[#2F3E4E]/40 text-xs font-bold text-[#2F3E4E]">
              {profileNotice}
            </div>
          )}

          {savedProfiles.length > 0 && (
            <div className="space-y-1.5">
              <span className="block text-[11px] font-display font-extrabold text-[#475569]">
                Saved Beneficiaries in Browser ({savedProfiles.length})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {savedProfiles.map((prof) => (
                  <div
                    key={prof.id}
                    className="inline-flex items-center gap-1.5 bg-[#FFFDF5] border border-[#2F3E4E]/45 rounded-lg pl-2.5 pr-1.5 py-1 text-[11px]"
                  >
                    <button
                      type="button"
                      onClick={() => handleLoadPayeeProfile(prof)}
                      className="font-bold text-[#2F3E4E] hover:underline cursor-pointer truncate max-w-[180px]"
                    >
                      {prof.label}
                    </button>
                    <span className="font-mono text-[10px] text-[#64748B]">
                      {prof.mode === 'bank' ? 'A/C' : 'VPA'}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove saved beneficiary ${prof.label}`}
                      onClick={() =>
                        setSavedProfiles((prev) => prev.filter((item) => item.id !== prof.id))
                      }
                      className="p-0.5 rounded hover:bg-[#FEE2E2] text-[#B42318] cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Primary Method Switcher: Registered UPI VPA vs Direct Bank A/C + IFSC */}
          <div
            role="tablist"
            aria-label="UPI Collection Method"
            className="grid grid-cols-2 gap-1.5 p-1.5 rounded-xl bg-[#FEF2C8]/80 border-[1.5px] border-[#2F3E4E]"
          >
            {(
              [
                { id: 'upi', label: 'UPI ID (VPA) · All Apps', Icon: QrCode },
                { id: 'bank', label: 'Bank A/C + IFSC Direct', Icon: Landmark },
              ] as const
            ).map(({ id, label, Icon }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(id)}
                  className={`inline-flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[40px] rounded-lg text-xs font-display font-extrabold transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-[#F9C80E] text-[#2F3E4E] border border-[#2F3E4E] shadow-[0_2px_0_#2F3E4E]'
                      : 'text-[#2F3E4E] hover:bg-white/80 border border-transparent'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </div>

          {/* Mode 1: Verified UPI ID (VPA) */}
          {activeTab === 'upi' && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label
                    htmlFor="vcpl-upi-vpa"
                    className="text-xs font-display font-extrabold text-[#2F3E4E]"
                  >
                    UPI ID (VPA) <span className="text-red-700">*</span>
                  </label>
                  <span className="text-[11px] font-mono text-[#64748B]">
                    {detectedUpiProvider || 'Format: name@bankhandle'}
                  </span>
                </div>
                <input
                  id="vcpl-upi-vpa"
                  type="text"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value.replace(/\s+/g, ''))}
                  placeholder="businessname@okhdfcbank"
                  className="w-full px-3.5 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FFFDF5] text-sm font-mono font-bold text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
                />

                {/* Quick Handle Selector Buttons */}
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold text-[#475569] mr-1">Bank handles:</span>
                  {QUICK_UPI_HANDLES.map((handle) => {
                    const isSelected = cleanUpiId.toLowerCase().endsWith(handle);
                    return (
                      <button
                        key={handle}
                        type="button"
                        onClick={() => applyUpiHandle(handle)}
                        className={`px-2 py-1 rounded-md text-[11px] font-mono font-bold border transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#2F3E4E] text-[#F9C80E] border-[#2F3E4E]'
                            : 'bg-[#FFFDF5] text-[#2F3E4E] border-[#2F3E4E]/45 hover:bg-[#FEF2C8]'
                        }`}
                      >
                        {handle}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label
                    htmlFor="vcpl-upi-payee"
                    className="text-xs font-display font-extrabold text-[#2F3E4E]"
                  >
                    Payee / Registered Business Name <span className="text-red-700">*</span>
                  </label>
                  <span className="text-[11px] text-[#64748B]">Shown in payer UPI app</span>
                </div>
                <input
                  id="vcpl-upi-payee"
                  type="text"
                  maxLength={50}
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Varsha Cars Pvt Ltd"
                  className="w-full px-3.5 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FFFDF5] text-sm font-semibold text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
                />
              </div>
            </div>
          )}

          {/* Mode 2: Bank Account + IFSC (Direct Bank Settlement) */}
          {activeTab === 'bank' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-[#FEE2E2]/55 border-[1.5px] border-[#B42318]/45 text-xs text-[#2F3E4E] space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#B42318] shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="space-y-1">
                    <p className="font-display font-extrabold text-[#991B1B]">
                      Why Google Pay / PhonePe / Paytm Show &ldquo;Could Not Load Banking Name&rdquo; on A/C + IFSC QRs
                    </p>
                    <p className="text-[11px] text-[#2F3E4E] leading-relaxed">
                      Under NPCI&apos;s strict <strong>Validate Address (ReqValAdd)</strong> rules, consumer UPI apps (Google Pay, PhonePe, Paytm, CRED, Amazon Pay) <strong>block raw <code className="font-mono">@ifsc.npci</code> QR scans</strong> from fetching banking names or paying fixed/open amounts. Only <strong>BHIM</strong> (and select bank apps when enabled by your bank) resolves <code className="font-mono">.ifsc.npci</code> QRs.
                    </p>
                  </div>
                </div>

                {/* Quick Bank-Matched UPI ID Bridge */}
                <div className="pt-2 border-t border-[#2F3E4E]/15 space-y-2">
                  <p className="text-[11px] font-display font-extrabold text-[#2F3E4E]">
                    Make a QR That Works on Google Pay, PhonePe, Paytm &amp; All Apps:
                  </p>
                  <p className="text-[11px] text-[#475569] leading-relaxed">
                    Enter your bank-linked UPI ID prefix (or 10-digit mobile / handle from GPay/PhonePe Profile) below — we&apos;ll pair it with{' '}
                    <strong>{detectedBankFromIfsc || 'your bank'}</strong> so Google Pay loads your verified banking name and allows amount transfers:
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex flex-1 min-w-0">
                      <input
                        type="text"
                        aria-label="Bank UPI ID prefix or mobile"
                        value={vpaPrefixDraft}
                        onChange={(e) => setVpaPrefixDraft(e.target.value.replace(/\s+/g, ''))}
                        placeholder={
                          sanitizedBusinessName
                            ? `e.g. ${sanitizedBusinessName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12)} or mobile`
                            : 'mobile or upi username'
                        }
                        className="flex-1 min-w-0 px-3 py-2 rounded-l-lg border-[1.5px] border-[#2F3E4E] bg-white text-xs font-mono font-bold text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
                      />
                      <select
                        aria-label="Bank UPI handle suffix"
                        value={
                          vpaHandleDraft ||
                          (BANK_VPA_SUFFIX_HINTS[cleanIfsc.slice(0, 4)]?.[0] ?? '@oksbi')
                        }
                        onChange={(e) => setVpaHandleDraft(e.target.value)}
                        className="px-2.5 py-2 rounded-r-lg border-y-[1.5px] border-r-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] text-xs font-mono font-bold text-[#2F3E4E] focus:outline-none"
                      >
                        {Array.from(
                          new Set([
                            ...(BANK_VPA_SUFFIX_HINTS[cleanIfsc.slice(0, 4)] || []),
                            ...QUICK_UPI_HANDLES,
                          ])
                        ).map((sfx) => (
                          <option key={sfx} value={sfx}>
                            {sfx}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const raw = vpaPrefixDraft.trim();
                        if (raw.includes('@')) {
                          setUpiId(raw);
                        } else {
                          const handle =
                            vpaHandleDraft ||
                            (BANK_VPA_SUFFIX_HINTS[cleanIfsc.slice(0, 4)]?.[0] ?? '@oksbi');
                          const fallbackSlug =
                            sanitizedBusinessName
                              .toLowerCase()
                              .replace(/[^a-z0-9]/g, '')
                              .slice(0, 14) || 'merchant';
                          setUpiId(`${raw || fallbackSlug}${handle}`);
                        }
                        setActiveTab('upi');
                      }}
                      className="px-3.5 py-2 rounded-lg bg-[#2F3E4E] hover:bg-[#1E293B] text-[#F9C80E] text-xs font-display font-extrabold whitespace-nowrap cursor-pointer"
                    >
                      Use Universal UPI QR →
                    </button>
                  </div>
                  <p className="text-[10px] text-[#475569]">
                    Tip: Find your exact UPI ID inside <strong>Google Pay → Profile photo → UPI ID</strong> (e.g. <code className="font-mono">name@oksbi</code>) or <strong>PhonePe → Profile → UPI Settings</strong> (e.g. <code className="font-mono">mobile@ybl</code>).
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label
                    htmlFor="vcpl-bank-ac"
                    className="block text-xs font-display font-extrabold text-[#2F3E4E] mb-1.5"
                  >
                    Bank Account Number <span className="text-red-700">*</span>
                  </label>
                  <input
                    id="vcpl-bank-ac"
                    type="text"
                    inputMode="numeric"
                    maxLength={18}
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 54061819000"
                    className="w-full px-3.5 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FFFDF5] text-sm font-mono font-bold tabular-nums text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label
                      htmlFor="vcpl-bank-ac-confirm"
                      className="text-xs font-display font-extrabold text-[#2F3E4E]"
                    >
                      Confirm Account Number <span className="text-red-700">*</span>
                    </label>
                    {cleanConfirmAccount && (
                      <span
                        className={`text-[10px] font-bold ${
                          accountsMatch ? 'text-[#12805C]' : 'text-red-700'
                        }`}
                      >
                        {accountsMatch ? 'Matched' : 'Mismatch'}
                      </span>
                    )}
                  </div>
                  <input
                    id="vcpl-bank-ac-confirm"
                    type="text"
                    inputMode="numeric"
                    maxLength={18}
                    value={confirmAccountNumber}
                    onChange={(e) => setConfirmAccountNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder="Re-enter account digits"
                    className={`w-full px-3.5 py-2.5 rounded-xl border-[1.5px] bg-[#FFFDF5] text-sm font-mono font-bold tabular-nums text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#F9C80E] ${
                      cleanConfirmAccount && !accountsMatch
                        ? 'border-red-700'
                        : 'border-[#2F3E4E]'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label
                      htmlFor="vcpl-bank-ifsc"
                      className="text-xs font-display font-extrabold text-[#2F3E4E]"
                    >
                      RBI IFSC Code (11 Chars) <span className="text-red-700">*</span>
                    </label>
                    {cleanIfsc && (
                      <span className="font-mono text-[10px] font-bold text-[#475569] tabular-nums">
                        {cleanIfsc.length}/11
                      </span>
                    )}
                  </div>
                  <input
                    id="vcpl-bank-ifsc"
                    type="text"
                    maxLength={11}
                    value={ifscCode}
                    onChange={(e) =>
                      setIfscCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
                    }
                    placeholder="e.g. SBIN0003823"
                    className="w-full px-3.5 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FFFDF5] text-sm font-mono font-bold uppercase text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="vcpl-bank-type"
                    className="block text-xs font-display font-extrabold text-[#2F3E4E] mb-1.5"
                  >
                    Account Type
                  </label>
                  <select
                    id="vcpl-bank-type"
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value as AccountCategory)}
                    className="w-full px-3.5 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FFFDF5] text-sm font-bold text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
                  >
                    <option value="Current">Current Account (Business)</option>
                    <option value="Savings">Savings Account</option>
                    <option value="OD / CC">Overdraft / Cash Credit (OD / CC)</option>
                  </select>
                </div>
              </div>

              {/* Live RBI Bank & Branch Verification Card */}
              {(ifscLookupStatus !== 'idle' || detectedBankFromIfsc) && (
                <div
                  className={`p-3 rounded-xl border text-xs ${
                    ifscLookupStatus === 'not-found'
                      ? 'bg-red-50 border-red-300 text-red-900'
                      : ifscLookupStatus === 'loading'
                        ? 'bg-slate-50 border-slate-300 text-slate-700'
                        : 'bg-[#CEE5DC]/50 border-[#12805C]/40 text-[#2F3E4E]'
                  }`}
                >
                  {ifscLookupStatus === 'loading' && (
                    <p className="font-semibold">
                      Verifying {cleanIfsc} with RBI branch directory...
                    </p>
                  )}

                  {ifscLookupStatus === 'not-found' && (
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" aria-hidden="true" />
                      <div>
                        <p className="font-bold">IFSC Verification Failed</p>
                        <p className="text-[11px] mt-0.5">{ifscLookupError}</p>
                      </div>
                    </div>
                  )}

                  {ifscLookupStatus !== 'loading' && ifscLookupStatus !== 'not-found' && verifiedIfsc && (
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 font-bold text-[#12805C]">
                          <Building2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span>
                            {verifiedIfsc.bankName}
                            {verifiedIfsc.source !== 'prefix-fallback'
                              ? ` · ${verifiedIfsc.branchName}`
                              : ''}
                          </span>
                        </span>
                        <span className="font-mono text-[10px] font-bold text-[#12805C]">
                          {verifiedIfsc.source === 'prefix-fallback'
                            ? 'Format Valid'
                            : 'RBI Verified'}
                        </span>
                      </div>
                      {(verifiedIfsc.city || verifiedIfsc.state || verifiedIfsc.micr) && (
                        <p className="text-[11px] text-[#475569]">
                          {[verifiedIfsc.city, verifiedIfsc.state].filter(Boolean).join(', ')}
                          {verifiedIfsc.micr ? ` · MICR ${verifiedIfsc.micr}` : ''}
                        </p>
                      )}
                      <p className="text-[11px] font-semibold text-[#2F3E4E]">
                        UPI: {verifiedIfsc.upi ? 'Supported' : 'Not Supported'} · IMPS:{' '}
                        {verifiedIfsc.imps ? 'Yes' : 'No'} · NEFT:{' '}
                        {verifiedIfsc.neft ? 'Yes' : 'No'} · RTGS:{' '}
                        {verifiedIfsc.rtgs ? 'Yes' : 'No'}
                      </p>
                    </div>
                  )}

                  {ifscLookupStatus === 'idle' && !verifiedIfsc && detectedBankFromIfsc && (
                    <p className="inline-flex items-center gap-1.5 font-bold text-[#12805C]">
                      <Building2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>Bank Detected: {detectedBankFromIfsc} (enter full 11-char IFSC to verify branch)</span>
                    </p>
                  )}
                </div>
              )}

              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label
                    htmlFor="vcpl-bank-payee"
                    className="text-xs font-display font-extrabold text-[#2F3E4E]"
                  >
                    Account Holder Name (As Per Bank Records) <span className="text-red-700">*</span>
                  </label>
                  <span className="text-[11px] text-[#64748B]">Mandatory for Bank QR</span>
                </div>
                <input
                  id="vcpl-bank-payee"
                  type="text"
                  maxLength={50}
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Exact Beneficiary / Firm Name"
                  className="w-full px-3.5 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FFFDF5] text-sm font-semibold text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
                />
              </div>
            </div>
          )}

          {/* Amount, Quick Presets & Invoice Reconciliation Fields (Shared) */}
          <div className="pt-2 border-t border-[#2F3E4E]/15 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label
                    htmlFor="vcpl-upi-amount"
                    className="text-xs font-display font-extrabold text-[#2F3E4E]"
                  >
                    Collection Amount (₹) (Optional)
                  </label>
                  {amountInput && (
                    <button
                      type="button"
                      onClick={() => setAmountInput('')}
                      className="text-[11px] font-bold text-[#475569] hover:text-[#2F3E4E] cursor-pointer"
                    >
                      Set Open Pay
                    </button>
                  )}
                </div>
                <input
                  id="vcpl-upi-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  placeholder="Leave blank for open amount"
                  className="w-full px-3.5 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FFFDF5] text-sm font-mono font-bold tabular-nums text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
                />
              </div>

              <div>
                <label
                  htmlFor="vcpl-upi-ref"
                  className="block text-xs font-display font-extrabold text-[#2F3E4E] mb-1.5"
                >
                  Invoice / Bill Ref No. (Optional)
                </label>
                <input
                  id="vcpl-upi-ref"
                  type="text"
                  maxLength={35}
                  value={invoiceRef}
                  onChange={(e) => setInvoiceRef(e.target.value.replace(/[^A-Za-z0-9\-_/]/g, ''))}
                  placeholder="e.g. INV-2026-042"
                  className="w-full px-3.5 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FFFDF5] text-sm font-mono font-semibold text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
                />
              </div>
            </div>

            {/* Quick INR Preset Buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-[#475569] mr-1">Quick amount:</span>
              <button
                type="button"
                onClick={() => setAmountInput('')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-colors cursor-pointer whitespace-nowrap ${
                  !amountInput
                    ? 'bg-[#2F3E4E] text-[#F9C80E] border-[#2F3E4E]'
                    : 'bg-[#FFFDF5] text-[#2F3E4E] border-[#2F3E4E]/45 hover:bg-[#FEF2C8]'
                }`}
              >
                Open Amount
              </button>
              {QUICK_AMOUNT_PRESETS.map((amt) => {
                const isActive = parsedAmount === amt;
                return (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setAmountInput(String(amt))}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-bold tabular-nums border transition-colors cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-[#2F3E4E] text-[#F9C80E] border-[#2F3E4E]'
                        : 'bg-[#FFFDF5] text-[#2F3E4E] border-[#2F3E4E]/45 hover:bg-[#FEF2C8]'
                    }`}
                  >
                    ₹{amt.toLocaleString('en-IN')}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label
                  htmlFor="vcpl-upi-remarks"
                  className="block text-xs font-display font-extrabold text-[#2F3E4E] mb-1.5"
                >
                  Bank Statement Remarks / Note (Optional)
                </label>
                <input
                  id="vcpl-upi-remarks"
                  type="text"
                  maxLength={50}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g. Booking Advance / Bill Payment"
                  className="w-full px-3.5 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FFFDF5] text-sm font-semibold text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
                />
              </div>

              <div>
                <label
                  htmlFor="vcpl-collection-type"
                  className="block text-xs font-display font-extrabold text-[#2F3E4E] mb-1.5"
                >
                  NPCI URI Compliance Profile
                </label>
                {activeTab === 'bank' ? (
                  <div
                    id="vcpl-collection-type"
                    className="w-full px-3.5 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E]/60 bg-[#F8FAFC] text-xs font-bold text-[#2F3E4E]"
                  >
                    Direct Bank IFSC Standard (No Unverified MCC)
                  </div>
                ) : (
                  <select
                    id="vcpl-collection-type"
                    value={collectionMode}
                    onChange={(e) => setCollectionMode(e.target.value as CollectionMode)}
                    className="w-full px-3.5 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FFFDF5] text-sm font-bold text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
                  >
                    <option value="standard">Standard Bank / VPA (Recommended · 100% Apps)</option>
                    <option value="merchant">Verified Merchant VPA (Includes MCC Code)</option>
                  </select>
                )}
              </div>
            </div>

            {activeTab === 'upi' && collectionMode === 'merchant' && (
              <div>
                <label
                  htmlFor="vcpl-upi-mcc"
                  className="block text-xs font-display font-extrabold text-[#2F3E4E] mb-1.5"
                >
                  Merchant Category Code (MCC — Only for Registered Merchant VPAs)
                </label>
                <select
                  id="vcpl-upi-mcc"
                  value={mcc}
                  onChange={(e) => setMcc(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FFFDF5] text-sm font-semibold text-[#2F3E4E] focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
                >
                  {MERCHANT_CATEGORY_CODES.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {activeTab === 'upi' && parsedAmount > 2000 && collectionMode === 'standard' && (
              <div className="p-3 rounded-xl bg-[#FEF2C8] border border-[#2F3E4E]/35 flex flex-wrap items-center justify-between gap-2 text-xs text-[#2F3E4E]">
                <p className="leading-relaxed flex-1 min-w-[220px]">
                  <strong>Gallery QR Limit Notice:</strong> NPCI caps saved/gallery-uploaded P2P QRs with pre-filled amounts above <strong>₹2,000</strong>. Scan this QR live with your camera, or switch to Open Amount so payers enter ₹{parsedAmount.toLocaleString('en-IN')} inside GPay/PhonePe.
                </p>
                <button
                  type="button"
                  onClick={() => setAmountInput('')}
                  className="px-3 py-1.5 rounded-lg bg-[#2F3E4E] text-[#F9C80E] text-[11px] font-display font-extrabold cursor-pointer whitespace-nowrap"
                >
                  Use Open Amount
                </button>
              </div>
            )}

            {validation.exceedsStandardUpiCap && (
              <div className="p-3 rounded-xl bg-[#FEF2C8] border border-[#B45309]/50 flex items-start gap-2.5 text-xs text-[#2F3E4E]">
                <AlertTriangle className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" aria-hidden="true" />
                <p className="leading-relaxed">
                  <strong>RBI / NPCI UPI Limit Notice:</strong> Standard UPI single-transaction cap across most banks is <strong>₹1,00,000</strong> (higher ₹2L–₹5L caps apply only to verified Tax, Hospital, Capital Market, or Auto Dealership merchant categories). For amounts above bank UPI limits, share your Bank Account + IFSC for NEFT/RTGS.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Bottom 3 Bank-Standard Guidance Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div className="bg-white border-[1.5px] border-[#2F3E4E] rounded-2xl p-4 shadow-[0_3px_0_#2F3E4E] space-y-1.5">
            <h3 className="font-display font-extrabold text-xs text-[#2F3E4E]">
              ISO 18004 Quiet Zone
            </h3>
            <p className="text-[11px] leading-relaxed text-[#475569]">
              Every QR is rendered with a strict 4-module pure white border and Q-level error correction so phone cameras focus instantly.
            </p>
          </div>

          <div className="bg-white border-[1.5px] border-[#2F3E4E] rounded-2xl p-4 shadow-[0_3px_0_#2F3E4E] space-y-1.5">
            <h3 className="font-display font-extrabold text-xs text-[#2F3E4E]">
              Direct Bank Deposit
            </h3>
            <p className="text-[11px] leading-relaxed text-[#475569]">
              Funds settle directly into your linked Current or Savings bank account with zero gateway middleman hold or MDR fee.
            </p>
          </div>

          <div className="bg-white border-[1.5px] border-[#2F3E4E] rounded-2xl p-4 shadow-[0_3px_0_#2F3E4E] space-y-1.5">
            <h3 className="font-display font-extrabold text-xs text-[#2F3E4E]">
              IFSC Double-Check
            </h3>
            <p className="text-[11px] leading-relaxed text-[#475569]">
              Validates account digits twice, enforces 11-char RBI IFSC format, and identifies the bank before rendering the matrix.
            </p>
          </div>
        </div>
      </div>

      {/* Right Column: Live Bank-Compliant QR Card + Standee Export + Print View */}
      <div
        ref={standeeCardRef}
        className="lg:col-span-5 lg:sticky lg:top-20 print:static print:w-full print:max-w-md print:mx-auto print:shadow-none flex flex-col items-center bg-white border-2 border-[#2F3E4E] rounded-2xl p-5 sm:p-6 shadow-[0_4px_0_#2F3E4E] space-y-4"
      >
        {/* Status Indicator */}
        <div className="w-full flex items-center justify-between gap-2 pb-2 border-b border-[#2F3E4E]/15">
          <span className="font-display font-extrabold text-xs text-[#2F3E4E]">
            {activeTab === 'bank' ? 'BHIM / Bank App QR (.ifsc.npci)' : 'Scan to Pay & Deposit to Bank'}
          </span>
          {canRenderQr ? (
            activeTab === 'bank' ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#B45309]">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>BHIM / Bank Apps Only</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#12805C]">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>NPCI Verified · All Apps Ready</span>
              </span>
            )
          ) : validation.isReady && !intentValidation.isValid ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#B42318]">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>NPCI Validation Blocked</span>
            </span>
          ) : (
            <span className="text-[11px] font-bold text-[#B45309]">Setup Required</span>
          )}
        </div>

        {/* High-Contrast QR Matrix Frame with Strict White Quiet Zone */}
        <div className="vcpl-qr-box bg-white p-4 rounded-2xl w-60 h-60 flex flex-col justify-center items-center border-2 border-[#2F3E4E]">
          {qrUrl && canRenderQr ? (
            <img
              src={qrUrl}
              alt={`UPI Payment QR for ${sanitizedBusinessName}`}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="text-center px-3 space-y-2">
              <QrCode className="w-8 h-8 text-[#64748B] mx-auto" aria-hidden="true" />
              <p className="text-xs font-semibold text-[#475569] leading-relaxed">
                {(!validation.isReady && validation.issues[0]) ||
                  (effectivePayload && !intentValidation.isValid && intentValidation.errors[0]) ||
                  'Enter valid UPI or Bank A/C details to generate QR'}
              </p>
            </div>
          )}
        </div>

        {/* Beneficiary & Deposit Destination Verification */}
        <div className="text-center space-y-1.5 w-full">
          {canRenderQr ? (
            <>
              <p className="font-display font-extrabold text-base text-[#2F3E4E] truncate px-2">
                {sanitizedBusinessName}
              </p>
              <p className="font-mono text-xs font-bold text-[#12805C] truncate px-2">
                {destinationSummary}
              </p>
              {activeTab === 'bank' && verifiedIfsc && verifiedIfsc.source !== 'prefix-fallback' && (
                <p className="text-[11px] text-[#475569] truncate px-2">
                  Branch: {verifiedIfsc.branchName}
                  {verifiedIfsc.city ? `, ${verifiedIfsc.city}` : ''}
                </p>
              )}
            </>
          ) : (
            <p className="font-mono text-xs font-semibold text-[#64748B]">
              Pending valid bank / UPI details
            </p>
          )}

          <div className="inline-block bg-[#FEF2C8] border border-[#2F3E4E] px-4 py-1.5 rounded-xl mt-1">
            {parsedAmount > 0 ? (
              <>
                <span className="text-[10px] font-mono text-[#475569] block">
                  Fixed Collection Amount
                </span>
                <span className="font-mono font-extrabold text-base tabular-nums text-[#2F3E4E]">
                  ₹{parsedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </>
            ) : (
              <>
                <span className="text-[10px] font-mono text-[#475569] block">
                  Variable Pay Mode
                </span>
                <span className="font-display font-extrabold text-xs text-[#2F3E4E]">
                  Payer Enters Any Amount
                </span>
              </>
            )}
          </div>
        </div>

        {/* Live NPCI URI & Bank Verification Diagnostics */}
        <div className="w-full rounded-xl border border-[#2F3E4E]/25 bg-[#FFFDF5] p-3 space-y-2 no-print">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-display font-extrabold text-[#2F3E4E]">
              Pre-Render NPCI Intent URL Verification
            </p>
            <span
              className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded-md ${
                canRenderQr
                  ? 'bg-[#CEE5DC] text-[#12805C]'
                  : effectivePayload && !intentValidation.isValid
                  ? 'bg-[#FEE2E2] text-[#B42318]'
                  : 'bg-[#FEF2C8] text-[#B45309]'
              }`}
            >
              {canRenderQr
                ? 'NPCI Gate Passed'
                : effectivePayload && !intentValidation.isValid
                ? 'Gate Blocked'
                : 'Awaiting Input'}
            </span>
          </div>
          <ul className="space-y-1">
            {preFlightChecks.map((chk) => (
              <li
                key={chk.id}
                title={chk.detail}
                className="flex items-center justify-between gap-2 text-[11px]"
              >
                <span className="inline-flex items-center gap-1.5 text-[#334155] min-w-0">
                  {chk.passed ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#12805C] shrink-0" aria-hidden="true" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-[#B45309] shrink-0" aria-hidden="true" />
                  )}
                  <span className="truncate">{chk.label}</span>
                </span>
                <span
                  className={`font-mono text-[10px] font-bold shrink-0 ${
                    chk.passed ? 'text-[#12805C]' : 'text-[#B45309]'
                  }`}
                >
                  {chk.statusText}
                </span>
              </li>
            ))}
          </ul>
          {effectivePayload && intentValidation.errors.length > 0 && (
            <div className="p-2 rounded-lg bg-[#FEE2E2]/80 border border-[#B42318]/40 text-[11px] text-[#991B1B] space-y-0.5">
              {intentValidation.errors.map((err, idx) => (
                <p key={idx} className="font-semibold">
                  • {err}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* NPCI URI Preview */}
        <div className="w-full space-y-1 no-print">
          <span className="block text-[11px] font-bold text-[#475569] text-center">
            NPCI UPI Payment URI
          </span>
          <div className="px-3 py-2 rounded-xl border-[1.5px] border-[#2F3E4E]/60 bg-[#FFFDF5] font-mono text-[11px] text-[#2F3E4E] break-all text-center">
            {effectivePayload || 'upi://pay?pa=...&pn=...&cu=INR'}
          </div>
        </div>

        {/* Primary Export Actions */}
        <div className="grid grid-cols-3 gap-2 w-full no-print">
          <button
            type="button"
            disabled={!canRenderQr}
            onClick={() => copyValue(effectivePayload, 'uri')}
            className="inline-flex items-center justify-center gap-1.5 py-2.5 px-2 min-h-[42px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {copiedTarget === 'uri' ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#12805C] shrink-0" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 shrink-0" />
                <span>Copy URI</span>
              </>
            )}
          </button>

          <a
            href={qrUrl && canRenderQr ? qrUrl : undefined}
            download={`UPI_QR_${(sanitizedBusinessName || 'Payment').replace(/\s+/g, '_')}.png`}
            aria-disabled={!qrUrl || !canRenderQr}
            className={`inline-flex items-center justify-center gap-1.5 py-2.5 px-2 min-h-[42px] rounded-xl border-[1.5px] text-xs font-display font-extrabold transition-colors whitespace-nowrap ${
              qrUrl && canRenderQr
                ? 'border-[#2F3E4E] bg-[#F9C80E] hover:bg-[#FFE1B3] text-[#2F3E4E] shadow-[0_2px_0_#2F3E4E]'
                : 'border-[#2F3E4E]/30 bg-[#FEF2C8]/60 text-[#64748B] pointer-events-none'
            }`}
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span>QR PNG</span>
          </a>

          <button
            type="button"
            disabled={!canRenderQr}
            onClick={handleShare}
            className="inline-flex items-center justify-center gap-1.5 py-2.5 px-2 min-h-[42px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#CEE5DC] text-xs font-bold text-[#2F3E4E] transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <Share2 className="w-3.5 h-3.5 shrink-0" />
            <span>Share</span>
          </button>
        </div>

        {/* High-Res Standee JPG + Print / Test Link Row */}
        <div className="w-full space-y-2 no-print">
          <button
            type="button"
            disabled={!qrUrl || !canRenderQr}
            onClick={downloadStandeeJpg}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 min-h-[44px] rounded-xl bg-[#2F3E4E] hover:bg-[#1E293B] text-[#FFFDF5] border-[1.5px] border-[#2F3E4E] shadow-[0_3px_0_#1E293B] text-xs font-display font-extrabold transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <Download className="w-4 h-4 text-[#F9C80E] shrink-0" aria-hidden="true" />
            <span>Download Counter Standee (JPG)</span>
          </button>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={!qrUrl || !canRenderQr}
              onClick={handlePrint}
              className="inline-flex items-center justify-center gap-1.5 py-2 px-2 min-h-[40px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Print Sheet</span>
            </button>

            <button
              type="button"
              disabled={!qrUrl || !canRenderQr}
              onClick={handleSaveStandeePdf}
              className="inline-flex items-center justify-center gap-1.5 py-2 px-2 min-h-[40px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <FileText className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Save PDF</span>
            </button>

            <a
              href={canRenderQr ? effectivePayload : undefined}
              aria-disabled={!canRenderQr}
              className={`inline-flex items-center justify-center gap-1.5 py-2 px-3 min-h-[40px] rounded-xl border-[1.5px] border-[#2F3E4E] text-xs font-bold transition-colors whitespace-nowrap ${
                canRenderQr
                  ? 'bg-[#CEE5DC] hover:bg-[#b8dcd0] text-[#2F3E4E]'
                  : 'bg-white text-[#64748B] border-[#2F3E4E]/30 pointer-events-none'
              }`}
            >
              <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Pay via UPI App</span>
            </a>
          </div>

          {activeTab === 'bank' && bankTransferText && (
            <button
              type="button"
              onClick={() => copyValue(bankTransferText, 'bank')}
              className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 min-h-[38px] rounded-xl border border-[#2F3E4E]/45 bg-[#FFFDF5] hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] cursor-pointer whitespace-nowrap"
            >
              {copiedTarget === 'bank' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#12805C] shrink-0" />
                  <span>Copied NEFT / IMPS / RTGS Bank Details</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 shrink-0" />
                  <span>Copy Bank A/C + IFSC for GPay / PhonePe &lsquo;Bank Transfer&rsquo;</span>
                </>
              )}
            </button>
          )}
        </div>

        {shareFeedback && (
          <p className="text-[11px] font-bold text-[#12805C] no-print">{shareFeedback}</p>
        )}

        {/* Clean Unboxed Supported UPI Networks Footer */}
        <div className="w-full pt-3 border-t border-[#2F3E4E]/15 space-y-1.5 text-center">
          {activeTab === 'bank' ? (
            <>
              <p className="text-[11px] font-bold text-[#B45309]">
                Limited App Support (.ifsc.npci QR)
              </p>
              <p className="text-[11px] text-[#475569] leading-relaxed">
                GPay, PhonePe &amp; Paytm block raw @ifsc.npci QR scans (&ldquo;Could not load banking name&rdquo;). Use the <strong>UPI ID (VPA)</strong> tab for all UPI apps, or use <strong>Bank Transfer</strong> inside GPay/PhonePe with your copied A/C + IFSC.
              </p>
            </>
          ) : (
            <>
              <p className="text-[11px] font-bold text-[#2F3E4E]">Works With All UPI Apps</p>
              <p className="text-[11px] text-[#475569] leading-relaxed">
                {SUPPORTED_UPI_APPS.join(' · ')}
              </p>
            </>
          )}
          <p className="inline-flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#12805C] pt-0.5">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>NPCI UPI Specification · Generated 100% offline in your browser</span>
          </p>
        </div>
      </div>
    </div>
  );
};
