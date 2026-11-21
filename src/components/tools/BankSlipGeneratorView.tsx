import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import {
  AlertCircle,
  Banknote,
  BookmarkPlus,
  Building2,
  Calculator,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Coins,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  HardDrive,
  Info,
  Landmark,
  Minus,
  Plus,
  Printer,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  BankFormState,
  BankFormType,
  BankId,
  BankSlipFixActionId,
  PreviewMode,
  SBI_DD_DENOMS,
  UnifiedChequeItem,
  auditBankFormState,
  createInitialBankFormState,
  fmtIn,
  getAccountBoxLimit,
  getBeneficiaryBoxLimit,
  renderBankSlip,
} from '../../utils/bankSlipRenderers';
import { numberToWordsIndian } from '../../utils/numberToWords';
import { BulkSlipRecord, bulkRecordToBankFormState } from '../../utils/excelBulkEngine';
import { getBankById } from '../../data/banksList';
import {
  downloadJsonBackup,
  formatShortSavedTime,
  readJsonFile,
  safeReadStorage,
  safeRemoveStorage,
  safeWriteStorage,
} from '../../utils/browserVault';
import { printTargetElement } from '../../utils/printReport';
const BulkSlipModal = lazy(() =>
  import('./BulkSlipModal').then((m) => ({ default: m.BulkSlipModal }))
);

interface BankSlipGeneratorViewProps {
  onBack: () => void;
  initialBank?: BankId;
  initialForm?: BankFormType;
  defaultOpenBulk?: boolean;
}

const MAX_CHEQUES = 6;
const DEPOSIT_LEDGER_DENOMS = [500, 200, 100, 50, 20, 10, 5, 2, 1] as const;

const BANK_SLIP_DRAFT_KEY = 'vcpl_bank_slip_draft_v1';
const BANK_SLIP_PROFILES_KEY = 'vcpl_bank_slip_profiles_v1';

interface SavedBankSlipDraft {
  bank: BankId;
  formType: BankFormType;
  formState: BankFormState;
  savedAt: string;
}

interface SavedBankSlipProfile {
  id: string;
  name: string;
  bank: BankId;
  formType: BankFormType;
  updatedAt: string;
  fields: Partial<BankFormState>;
}

const PROFILE_PERSIST_FIELDS: Array<keyof BankFormState> = [
  'branch',
  'branchCode',
  'name',
  'accountNo',
  'accountType',
  'depositorName',
  'mobile',
  'pan',
  'form60',
  'tel',
  'email',
  'address',
  'creditCardNo',
  'loanNo',
  'loanTicked',
  'special',
  'ddIssueType',
  'ddCodeNo',
  'ddDeliverTo',
  'ddFavouring',
  'ddPayableAt',
  'rtgsType',
  'rtgsMode',
  'rtgsBenName',
  'rtgsBenBank',
  'rtgsBenContact',
  'rtgsBenAddress',
  'rtgsBenIfsc',
  'rtgsBenAccount',
  'rtgsBenAccountConfirm',
  'rtgsPurpose',
  'rtgsBanv',
  'rtgsBenAcType',
  'rtgsLei',
  'rtgsLeiExpiry',
  'rtgsBenLei',
  'rtgsBenLeiExpiry',
  'rtgsNepalPurpose',
  'rtgsNepalPurposeOther',
];

function loadInitialDraft(initialBank?: BankId, initialForm?: BankFormType): {
  bank: BankId;
  formType: BankFormType;
  formState: BankFormState;
  restored: boolean;
} {
  const base = createInitialBankFormState();
  const saved = safeReadStorage<SavedBankSlipDraft | null>(BANK_SLIP_DRAFT_KEY, null);
  if (saved && saved.formState && typeof saved.formState === 'object') {
    return {
      bank: initialBank || saved.bank || 'sbi',
      formType: initialForm || saved.formType || 'deposit',
      formState: {
        ...base,
        ...saved.formState,
        date: base.date,
        notes: { ...base.notes, ...(saved.formState.notes || {}) },
        cheques:
          Array.isArray(saved.formState.cheques) && saved.formState.cheques.length === MAX_CHEQUES
            ? saved.formState.cheques
            : base.cheques,
      },
      restored: true,
    };
  }
  return {
    bank: initialBank || 'sbi',
    formType: initialForm || 'deposit',
    formState: base,
    restored: false,
  };
}

const DENOM_STYLES: Record<number, { badge: string; bar: string; hint?: string }> = {
  500: { badge: 'bg-stone-100 border-stone-300 text-stone-800', bar: 'bg-stone-600' },
  200: { badge: 'bg-amber-50 border-amber-300 text-amber-900', bar: 'bg-amber-500' },
  100: { badge: 'bg-purple-50 border-purple-300 text-purple-900', bar: 'bg-purple-500' },
  50: { badge: 'bg-cyan-50 border-cyan-300 text-cyan-900', bar: 'bg-cyan-500' },
  20: { badge: 'bg-lime-50 border-lime-300 text-lime-900', bar: 'bg-lime-600' },
  10: { badge: 'bg-orange-50 border-orange-300 text-orange-900', bar: 'bg-orange-500' },
  5: { badge: 'bg-emerald-50 border-emerald-300 text-emerald-900', bar: 'bg-emerald-500' },
  2: { badge: 'bg-slate-100 border-slate-300 text-slate-800', bar: 'bg-slate-500' },
  1: { badge: 'bg-slate-100 border-slate-300 text-slate-800', bar: 'bg-slate-400' },
};

export const BankSlipGeneratorView: React.FC<BankSlipGeneratorViewProps> = ({
  onBack,
  initialBank,
  initialForm,
  defaultOpenBulk = false,
}) => {

  const initialLoaded = useMemo(
    () => loadInitialDraft(initialBank, initialForm),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const [selectedBank, setSelectedBank] = useState<BankId>(initialLoaded.bank);
  const [formType, setFormType] = useState<BankFormType>(initialLoaded.formType);
  const [formState, setFormState] = useState<BankFormState>(initialLoaded.formState);
  const [savedProfiles, setSavedProfiles] = useState<SavedBankSlipProfile[]>(() =>
    safeReadStorage<SavedBankSlipProfile[]>(BANK_SLIP_PROFILES_KEY, [])
  );
  const [profileNameInput, setProfileNameInput] = useState<string>('');
  const [showVaultPanel, setShowVaultPanel] = useState<boolean>(false);
  const [lastSavedIso, setLastSavedIso] = useState<string>(() => new Date().toISOString());
  const backupImportRef = useRef<HTMLInputElement | null>(null);
  const [visibleCheques, setVisibleCheques] = useState<number>(1);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('full');
  const [includeReverse, setIncludeReverse] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isExportingBlank, setIsExportingBlank] = useState<boolean>(false);
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const [showOptionalDetails, setShowOptionalDetails] = useState<boolean>(false);
  const [showHdfcRtgsCompliance, setShowHdfcRtgsCompliance] = useState<boolean>(false);
  const [showBulkModal, setShowBulkModal] = useState<boolean>(Boolean(defaultOpenBulk));
  const [targetSplitAmount, setTargetSplitAmount] = useState<string>('');
  const [copiedWords, setCopiedWords] = useState<boolean>(false);

  const noteInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const previewStageRef = useRef<HTMLDivElement | null>(null);
  const printableSlipRef = useRef<HTMLDivElement | null>(null);
  const [stageWidth, setStageWidth] = useState<number>(1000);

  // Browser-only auto-save on every change
  useEffect(() => {
    const ok = safeWriteStorage(BANK_SLIP_DRAFT_KEY, {
      bank: selectedBank,
      formType,
      formState,
      savedAt: new Date().toISOString(),
    } satisfies SavedBankSlipDraft);
    if (ok) setLastSavedIso(new Date().toISOString());
  }, [selectedBank, formType, formState]);

  useEffect(() => {
    safeWriteStorage(BANK_SLIP_PROFILES_KEY, savedProfiles);
  }, [savedProfiles]);

  useEffect(() => {
    if (initialBank) setSelectedBank(initialBank);
  }, [initialBank]);

  useEffect(() => {
    if (initialForm) setFormType(initialForm);
  }, [initialForm]);

  useEffect(() => {
    setShowBulkModal(Boolean(defaultOpenBulk));
  }, [defaultOpenBulk]);

  const output = useMemo(
    () => renderBankSlip(selectedBank, formType, formState),
    [selectedBank, formType, formState]
  );

  const accountBoxLimit = getAccountBoxLimit(selectedBank, formType);
  const benBoxLimit = getBeneficiaryBoxLimit(selectedBank);
  const auditIssues = useMemo(
    () => auditBankFormState(selectedBank, formType, formState, output),
    [selectedBank, formType, formState, output]
  );
  const auditErrCount = auditIssues.filter((i) => i.sev === 'err').length;
  const auditWarnCount = auditIssues.filter((i) => i.sev === 'warn').length;

  // Measure preview stage width responsively so scaled sheet fits cleanly
  useEffect(() => {
    const el = previewStageRef.current;
    if (!el) return;

    const updateWidth = () => {
      const w = el.clientWidth;
      if (w > 0) setStageWidth(w);
    };

    let rafId = 0;
    const scheduleUpdate = () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        updateWidth();
      });
    };
    updateWidth();
    const ro = new ResizeObserver(scheduleUpdate);
    ro.observe(el);
    window.addEventListener('resize', scheduleUpdate);

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      ro.disconnect();
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, []);

  // Inject dynamic @page portrait/landscape and print zoom rules for active form
  useEffect(() => {
    const styleId = 'bank-slip-print-page-style';
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    const rawZoom =
      output.orientation === 'landscape'
        ? Math.min(1056 / output.width, 728 / output.height)
        : Math.min(728 / output.width, 1056 / output.height);
    const zoomFactor = rawZoom.toFixed(4);
    const portraitWrapWidth = `${Math.round(output.width * rawZoom)}px`;

    styleEl.textContent = `
      @page {
        size: A4 ${output.orientation};
        margin: 8mm;
      }
      @media print {
        html, body {
          background: #ffffff !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        .bank-slip-printable .bank-slip-sheet-wrap {
          width: ${output.orientation === 'portrait' ? portraitWrapWidth : 'auto'} !important;
          height: auto !important;
          margin: ${output.orientation === 'portrait' ? '0 auto' : '0'} !important;
          background: #ffffff !important;
          border: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          overflow: visible !important;
        }
        .bank-slip-printable .bank-slip-print-page-break {
          break-before: page !important;
          page-break-before: always !important;
          margin-top: 0 !important;
        }
        .bank-slip-printable .bank-slip {
          transform: none !important;
          zoom: ${zoomFactor} !important;
        }
        @supports not (zoom: 0.5) {
          .bank-slip-printable .bank-slip {
            transform: scale(${zoomFactor}) !important;
            transform-origin: top left !important;
          }
        }
      }
    `;

    return () => {
      const existing = document.getElementById(styleId);
      if (existing) existing.remove();
    };
  }, [output.orientation, output.width, output.height]);

  const previewScale = useMemo(() => {
    const available = Math.max(200, stageWidth - 6);
    return Math.min(1, available / output.width);
  }, [stageWidth, output.width]);

  const updateField = <K extends keyof BankFormState>(key: K, value: BankFormState[K]) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
  };

  const updateNoteCount = (denom: number, value: string) => {
    const clean = value.replace(/[^0-9]/g, '');
    setFormState((prev) => ({
      ...prev,
      notes: {
        ...prev.notes,
        [denom]: clean,
      },
    }));
  };

  const updateChequeField = (
    index: number,
    field: keyof UnifiedChequeItem,
    value: string
  ) => {
    setFormState((prev) => {
      const nextCheques = [...prev.cheques];
      nextCheques[index] = {
        ...nextCheques[index],
        [field]: value,
      };
      return { ...prev, cheques: nextCheques };
    });
  };

  const handleRemoveChequeRow = (idx: number) => {
    setFormState((prev) => {
      const populated = prev.cheques.filter((_, i) => i !== idx);
      while (populated.length < MAX_CHEQUES) {
        populated.push({ bankBranch: '', city: '', chequeNo: '', date: '', amount: '' });
      }
      return { ...prev, cheques: populated };
    });
    setVisibleCheques((c) => Math.max(1, c - 1));
  };

  const handleDepositModeChange = (mode: 'cash' | 'cheque' | 'both') => {
    setFormState((prev) => ({
      ...prev,
      depositMode: mode,
      hdfcDepositType:
        prev.accountType === 'loan'
          ? 'loan'
          : prev.accountType === 'cc'
          ? 'cc'
          : mode === 'cheque'
          ? prev.hdfcDepositType === 'out'
            ? 'out'
            : 'local'
          : 'cash',
    }));
  };

  const handleAccountTypeChange = (nextType: BankFormState['accountType']) => {
    setFormState((prev) => ({
      ...prev,
      accountType: nextType,
      loanTicked: nextType === 'loan',
      hdfcDepositType:
        nextType === 'loan'
          ? 'loan'
          : nextType === 'cc'
          ? 'cc'
          : prev.depositMode === 'cheque'
          ? 'local'
          : 'cash',
    }));
  };

  const stepNoteCount = (denom: number, delta: number) => {
    setFormState((prev) => {
      const current = parseInt(prev.notes[denom] || '0', 10) || 0;
      const next = Math.max(0, current + delta);
      return {
        ...prev,
        notes: {
          ...prev.notes,
          [denom]: next > 0 ? String(next) : '',
        },
      };
    });
  };

  const handleNoteKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, denom: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const idx = DEPOSIT_LEDGER_DENOMS.indexOf(denom as (typeof DEPOSIT_LEDGER_DENOMS)[number]);
      if (idx >= 0 && idx < DEPOSIT_LEDGER_DENOMS.length - 1) {
        const nextKey = String(DEPOSIT_LEDGER_DENOMS[idx + 1]);
        noteInputRefs.current[nextKey]?.focus();
      } else {
        noteInputRefs.current['coins']?.focus();
      }
    }
  };

  const handleClearCashOnly = () => {
    setFormState((prev) => ({
      ...prev,
      notes: {
        500: '',
        200: '',
        100: '',
        50: '',
        20: '',
        10: '',
        5: '',
        2: '',
        1: '',
      },
      coins: '',
    }));
    setTargetSplitAmount('');
    setStatusMessage('Cleared cash denominations and coins.');
  };

  const handleAutoSplitDepositCash = () => {
    const raw = parseFloat(targetSplitAmount);
    if (!Number.isFinite(raw) || raw <= 0) {
      setStatusMessage('Enter a positive rupee target to auto-split into notes.');
      return;
    }
    const wholeRupees = Math.floor(raw);
    const paise = Math.round((raw - wholeRupees) * 100);
    let rem = wholeRupees;
    const nextNotes: Record<number, string> = {
      500: '',
      200: '',
      100: '',
      50: '',
      20: '',
      10: '',
      5: '',
      2: '',
      1: '',
    };
    [500, 200, 100, 50, 20, 10, 5, 2, 1].forEach((d) => {
      const cnt = Math.floor(rem / d);
      nextNotes[d] = cnt > 0 ? String(cnt) : '';
      rem %= d;
    });
    setFormState((prev) => ({
      ...prev,
      notes: nextNotes,
      coins: paise > 0 ? (paise / 100).toFixed(2) : '',
    }));
    setStatusMessage(
      `Auto-split ₹${raw.toLocaleString('en-IN', {
        maximumFractionDigits: 2,
      })} across Indian currency denominations.`
    );
  };

  const amountWordsText =
    output.grandTotal > 0 ? numberToWordsIndian(output.grandTotal) : '';

  const handleCopyWords = async () => {
    if (!amountWordsText) return;
    try {
      await navigator.clipboard.writeText(amountWordsText);
      setCopiedWords(true);
      window.setTimeout(() => setCopiedWords(false), 1800);
    } catch {
      setStatusMessage('Copy failed — browser clipboard permission denied.');
    }
  };

  const handleConfirmClear = () => {
    setFormState(createInitialBankFormState());
    setVisibleCheques(1);
    setTargetSplitAmount('');
    setShowClearConfirm(false);
    safeRemoveStorage(BANK_SLIP_DRAFT_KEY);
    setStatusMessage('All fields and auto-saved draft cleared from browser.');
  };

  const handleSaveProfileInBrowser = () => {
    const autoName =
      [
        selectedBank.toUpperCase(),
        formState.name.trim() || formState.rtgsBenName.trim() || formState.ddFavouring.trim(),
        formState.accountNo.trim() ? `••${formState.accountNo.trim().slice(-4)}` : '',
      ]
        .filter(Boolean)
        .join(' · ') || `Account Profile ${savedProfiles.length + 1}`;
    const label = profileNameInput.trim() || autoName;
    const fields: Partial<BankFormState> = {};
    for (const k of PROFILE_PERSIST_FIELDS) {
      (fields as Record<string, unknown>)[k] = formState[k];
    }
    const nextProfile: SavedBankSlipProfile = {
      id: `bsp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: label,
      bank: selectedBank,
      formType,
      updatedAt: new Date().toISOString(),
      fields,
    };
    setSavedProfiles((prev) => [nextProfile, ...prev]);
    setProfileNameInput('');
    setStatusMessage(`Saved "${label}" in your browser for future bank slips.`);
  };

  const handleLoadBrowserProfile = (profile: SavedBankSlipProfile) => {
    setSelectedBank(profile.bank);
    setFormType(profile.formType);
    setFormState((prev) => ({
      ...prev,
      ...profile.fields,
    }));
    setStatusMessage(`Loaded "${profile.name}" from browser storage.`);
  };

  const handleDeleteBrowserProfile = (id: string) => {
    setSavedProfiles((prev) => prev.filter((p) => p.id !== id));
    setStatusMessage('Removed saved bank profile from browser.');
  };

  const handleExportBankProfilesBackup = () => {
    downloadJsonBackup(`vcpl-bank-slip-browser-backup-${new Date().toISOString().slice(0, 10)}.json`, {
      app: 'vcpl-bank-slip-vault',
      version: 1,
      exportedAt: new Date().toISOString(),
      profiles: savedProfiles,
      draft: { bank: selectedBank, formType, formState },
    });
    setStatusMessage(`Exported ${savedProfiles.length} saved bank profile(s) to .json backup.`);
  };

  const handleImportBankProfilesBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = await readJsonFile<{
        app?: string;
        profiles?: SavedBankSlipProfile[];
        draft?: { bank?: BankId; formType?: BankFormType; formState?: Partial<BankFormState> };
      }>(file);
      if (!parsed || parsed.app !== 'vcpl-bank-slip-vault') {
        setStatusMessage('Invalid backup file. Select a VCPL Bank Slip .json backup.');
        return;
      }
      if (Array.isArray(parsed.profiles)) setSavedProfiles(parsed.profiles);
      if (parsed.draft?.formState) {
        if (parsed.draft.bank) setSelectedBank(parsed.draft.bank);
        if (parsed.draft.formType) setFormType(parsed.draft.formType);
        setFormState((prev) => ({ ...prev, ...parsed.draft?.formState }));
      }
      setStatusMessage('Restored bank slip profiles and draft into this browser.');
    } catch {
      setStatusMessage('Could not import backup JSON file.');
    }
  };

  const handleAutoFillSbiDdNotes = () => {
    const total = output.grandTotal;
    if (total <= 0) return;
    const whole = Math.floor(total);
    const paise = Math.round((total - whole) * 100);
    let rem = whole;
    const nextNotes: Record<number, string> = {
      500: '',
      200: '',
      100: '',
      50: '',
      20: '',
      10: '',
      5: '',
      2: '',
      1: '',
    };
    SBI_DD_DENOMS.forEach((d) => {
      const cnt = Math.floor(rem / d);
      nextNotes[d] = cnt > 0 ? String(cnt) : '';
      rem %= d;
    });
    setFormState((prev) => ({
      ...prev,
      notes: nextNotes,
      coins: paise > 0 ? (paise / 100).toFixed(2) : '',
    }));
    setStatusMessage(`Auto-allocated ₹${fmtIn(total)} into SBI DD note denominations.`);
  };

  const handleApplyAuditFix = (action: BankSlipFixActionId) => {
    if (action === 'switch-to-neft') {
      updateField('rtgsType', 'neft');
      setStatusMessage('Switched transfer system to NEFT for amount under ₹2,00,000.');
    } else if (action === 'switch-rtgs-to-chq') {
      updateField('rtgsMode', 'chq');
      setStatusMessage('Switched SBI RTGS remittance mode to Cheque.');
    } else if (action === 'clear-cash-notes') {
      handleClearCashOnly();
    } else if (action === 'sync-dd-notes') {
      handleAutoFillSbiDdNotes();
    } else if (action === 'mirror-ben-account') {
      updateField('rtgsBenAccountConfirm', formState.rtgsBenAccount);
      setStatusMessage('Copied Beneficiary Account No. into Re-Confirm field.');
    } else if (action === 'normalize-ifsc') {
      updateField('rtgsBenIfsc', formState.rtgsBenIfsc.trim().toUpperCase());
      setStatusMessage('Normalized IFSC code formatting.');
    } else if (action === 'normalize-pan') {
      updateField('pan', formState.pan.trim().toUpperCase());
      setStatusMessage('Normalized PAN casing and spacing.');
    }
  };

  const handleLoadRecordIntoEditor = (
    rec: BulkSlipRecord,
    bId: BankId,
    fType: BankFormType
  ) => {
    const nextState = bulkRecordToBankFormState(rec, bId, fType);
    setSelectedBank(bId);
    setFormType(fType);
    setFormState(nextState);
    const activeChequesCount = nextState.cheques.filter(
      (c) => c.chequeNo || c.bankBranch || c.amount
    ).length;
    setVisibleCheques(Math.max(1, activeChequesCount));
    setStatusMessage(
      `Loaded Bulk Row #${rec.rowNumber} (${rec.name || rec.accountNo || 'Slip'}) into editor.`
    );
  };

  const handlePrint = () => {
    setStatusMessage(`Opening isolated slip print preview (A4 ${output.orientation})...`);
    void printTargetElement({
      element: printableSlipRef.current,
      title: output.title || 'Bank Slip',
      orientation: output.orientation === 'landscape' ? 'landscape' : 'portrait',
      pageMargin: '0mm',
      extraCss: `
        .bank-slip-printable { display: block !important; width: ${output.width}px !important; margin: 0 auto !important; }
        .bank-slip-sheet-wrap { border: 0 !important; box-shadow: none !important; border-radius: 0 !important; width: ${output.width}px !important; height: ${output.height}px !important; margin: 0 auto !important; }
        .bank-slip { transform: none !important; }
        .bank-slip-print-page-break { page-break-before: always; break-before: page; }
      `,
      prepareClone: (clone) => {
        clone.style.width = `${output.width}px`;
        clone.style.margin = '0 auto';
        clone.querySelectorAll('.bank-slip-sheet-wrap').forEach((wrap) => {
          (wrap as HTMLElement).style.width = `${output.width}px`;
          (wrap as HTMLElement).style.height = `${output.height}px`;
          (wrap as HTMLElement).style.border = '0';
          (wrap as HTMLElement).style.boxShadow = 'none';
          (wrap as HTMLElement).style.borderRadius = '0';
        });
        clone.querySelectorAll('.bank-slip').forEach((slip) => {
          (slip as HTMLElement).style.transform = 'none';
        });
      },
    });
  };

  const renderOffscreenToPng = async (
    html: string,
    fontCls: string,
    width: number,
    height: number,
    forceFull = false
  ): Promise<string> => {
    const stage = document.createElement('div');
    stage.style.position = 'fixed';
    stage.style.left = '-100000px';
    stage.style.top = '0';
    stage.style.width = `${width}px`;
    stage.style.height = `${height}px`;
    stage.style.background = '#ffffff';
    stage.style.pointerEvents = 'none';

    const slip = document.createElement('div');
    slip.className = `bank-slip ${fontCls} ${
      !forceFull && previewMode === 'data' ? 'dataonly' : ''
    }`;
    slip.style.width = `${width}px`;
    slip.style.height = `${height}px`;
    slip.style.transform = 'none';
    slip.innerHTML = html;

    stage.appendChild(slip);
    document.body.appendChild(stage);

    try {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
      const canvas = await html2canvas(slip, {
        scale: 3,
        backgroundColor: '#ffffff',
        width,
        height,
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
        useCORS: true,
      });
      return canvas.toDataURL('image/png');
    } finally {
      document.body.removeChild(stage);
    }
  };

  const handleDownloadPdf = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setStatusMessage('Generating exact-scale PDF...');

    try {
      const frontImg = await renderOffscreenToPng(
        output.frontHtml,
        output.fontClass,
        output.width,
        output.height
      );
      const images = [frontImg];

      if (includeReverse && output.backHtml) {
        const backFont = output.backFontClass ?? output.fontClass;
        const backImg = await renderOffscreenToPng(
          output.backHtml,
          backFont,
          output.width,
          output.height
        );
        images.push(backImg);
      }

      const pdf = new jsPDF({
        orientation: output.orientation,
        unit: 'mm',
        format: 'a4',
      });

      images.forEach((img, index) => {
        if (index > 0) pdf.addPage();
        if (output.orientation === 'landscape') {
          const scaleMm = Math.min(281 / output.width, 194 / output.height);
          const wMm = output.width * scaleMm;
          const hMm = output.height * scaleMm;
          pdf.addImage(img, 'PNG', (297 - wMm) / 2, 8, wMm, hMm);
        } else {
          const scaleMm = Math.min(194 / output.width, 281 / output.height);
          const wMm = output.width * scaleMm;
          const hMm = output.height * scaleMm;
          pdf.addImage(img, 'PNG', (210 - wMm) / 2, 8, wMm, hMm);
        }
      });

      pdf.save(output.pdfFilename);
      setStatusMessage(`Downloaded ${output.pdfFilename}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatusMessage(`Could not create PDF: ${message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadBlankPdf = async () => {
    if (isExportingBlank) return;
    setIsExportingBlank(true);
    setStatusMessage('Generating clean blank A4 slip PDF...');

    try {
      const blankState = createInitialBankFormState();
      blankState.date = '';
      blankState.ddTicked = false;
      blankState.ddIssueType = '';
      blankState.rtgsType = '';
      blankState.rtgsMode = '';
      blankState.rtgsBanv = '';
      blankState.rtgsBenAcType = '';
      blankState.rtgsNepalPurpose = '';
      blankState.rtgsNepalPurposeOther = '';
      const blankOutput = renderBankSlip(selectedBank, formType, blankState);
      const frontImg = await renderOffscreenToPng(
        blankOutput.frontHtml,
        blankOutput.fontClass,
        blankOutput.width,
        blankOutput.height,
        true
      );
      const images = [frontImg];
      if (blankOutput.backHtml) {
        const backFont = blankOutput.backFontClass ?? blankOutput.fontClass;
        const backImg = await renderOffscreenToPng(
          blankOutput.backHtml,
          backFont,
          blankOutput.width,
          blankOutput.height,
          true
        );
        images.push(backImg);
      }

      const pdf = new jsPDF({
        orientation: blankOutput.orientation,
        unit: 'mm',
        format: 'a4',
      });

      images.forEach((img, index) => {
        if (index > 0) pdf.addPage();
        if (blankOutput.orientation === 'landscape') {
          const scaleMm = Math.min(281 / blankOutput.width, 194 / blankOutput.height);
          const wMm = blankOutput.width * scaleMm;
          const hMm = blankOutput.height * scaleMm;
          pdf.addImage(img, 'PNG', (297 - wMm) / 2, 8, wMm, hMm);
        } else {
          const scaleMm = Math.min(194 / blankOutput.width, 281 / blankOutput.height);
          const wMm = blankOutput.width * scaleMm;
          const hMm = blankOutput.height * scaleMm;
          pdf.addImage(img, 'PNG', (210 - wMm) / 2, 8, wMm, hMm);
        }
      });

      const blankName = `${selectedBank.toUpperCase()}_Blank_${formType.toUpperCase()}_Form.pdf`;
      pdf.save(blankName);
      setStatusMessage(`Downloaded ${blankName}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatusMessage(`Could not create blank PDF: ${message}`);
    } finally {
      setIsExportingBlank(false);
    }
  };

  const activeBankInfo = getBankById(selectedBank);
  const ddCashMismatch =
    selectedBank === 'sbi' && formType === 'dd' && Boolean(output.warning);
  const showCashCounter =
    formType === 'deposit' &&
    (formState.depositMode === 'cash' || formState.depositMode === 'both');
  const showChequeCounter =
    formType === 'deposit' &&
    (formState.depositMode === 'cheque' || formState.depositMode === 'both');

  const cashStats = useMemo(() => {
    let totalNotes = 0;
    let activeDenoms = 0;
    DEPOSIT_LEDGER_DENOMS.forEach((d) => {
      const cnt = parseInt(formState.notes[d] || '0', 10) || 0;
      if (cnt > 0) {
        totalNotes += cnt;
        activeDenoms += 1;
      }
    });
    const coinsVal = parseFloat(formState.coins) > 0 ? parseFloat(formState.coins) : 0;
    if (coinsVal > 0) activeDenoms += 1;
    return { totalNotes, activeDenoms, coinsVal };
  }, [formState.notes, formState.coins]);

  return (
    <div className="space-y-4 font-sans print:m-0 print:p-0 print:space-y-0">
      {/* Header & Action Bar */}
      <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-4 sm:p-5 shadow-[0_4px_0_#2F3E4E] no-print">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#2F3E4E] text-[#FFFDF5] flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-lg sm:text-xl font-extrabold text-[#2F3E4E] tracking-tight leading-snug">
                Bank Deposit Slip, DD &amp; RTGS / NEFT Generator
              </h1>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#475569] mt-0.5">
                <span>SBI &amp; HDFC Official Layouts</span>
                <span aria-hidden="true">·</span>
                <span>Single &amp; Bulk Excel (Max 25)</span>
                <span aria-hidden="true">·</span>
                <span>Exact A4 Print &amp; PDF</span>
              </div>
            </div>
          </div>

          <div className="inline-flex items-center self-start sm:self-center gap-1.5 px-3 h-8 rounded-lg text-[11px] font-bold uppercase tracking-wider bg-[#F9C80E] text-[#2F3E4E] border-[1.5px] border-[#2F3E4E] shrink-0 whitespace-nowrap">
            <span>{activeBankInfo?.shortCode || selectedBank.toUpperCase()} Template</span>
          </div>
        </div>

        <div className="mt-3.5 pt-3.5 border-t border-[#2F3E4E]/15 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowVaultPanel((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3.5 h-9 text-xs font-bold text-[#2F3E4E] bg-[#CEE5DC] hover:bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>
                Saved Profiles ({savedProfiles.length})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowBulkModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 h-9 text-xs font-bold text-[#2F3E4E] bg-[#F9C80E] hover:bg-[#f0be08] border-[1.5px] border-[#2F3E4E] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Bulk Excel</span>
            </button>

            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="inline-flex items-center gap-1.5 px-3 h-9 text-xs font-semibold text-[#2F3E4E] hover:text-rose-700 bg-white hover:bg-rose-50 border-[1.5px] border-[#2F3E4E] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 h-9 text-xs font-semibold text-[#2F3E4E] bg-white border-[1.5px] border-[#2F3E4E] hover:bg-[#FEF2C8] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print (A4)</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isExporting}
              className="inline-flex items-center justify-center gap-1.5 px-4 h-9 text-xs font-semibold text-[#FFFDF5] bg-[#2F3E4E] hover:bg-[#1E293B] border-[1.5px] border-[#2F3E4E] disabled:opacity-60 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExporting ? 'Preparing PDF...' : 'Download PDF'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Browser-Only Auto-Save & Account/Beneficiary Profiles Panel */}
      {showVaultPanel && (
        <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-4 sm:p-5 shadow-[0_4px_0_#2F3E4E] space-y-4 no-print">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <HardDrive className="w-4 h-4 text-[#2F3E4E]" />
              <strong className="font-display text-sm text-[#2F3E4E]">
                Saved Slip Profiles (Browser Local)
              </strong>
              <span className="text-[#12805C] font-semibold">
                · Local draft auto-saved ({formatShortSavedTime(lastSavedIso)})
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={backupImportRef}
                type="file"
                accept=".json,application/json"
                onChange={handleImportBankProfilesBackup}
                className="hidden"
              />
              <button
                type="button"
                onClick={handleExportBankProfilesBackup}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Backup (.json)</span>
              </button>
              <button
                type="button"
                onClick={() => backupImportRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#CEE5DC] text-xs font-bold text-[#2F3E4E] cursor-pointer whitespace-nowrap"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Restore Backup</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={profileNameInput}
              onChange={(e) => setProfileNameInput(e.target.value)}
              placeholder="Profile name (e.g. Office SBI Current A/c or HDFC Vendor RTGS)"
              aria-label="Bank slip profile name"
              className="flex-1 px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E]/60 bg-white text-xs font-medium text-[#2F3E4E] focus:outline-none focus:border-[#2F3E4E]"
            />
            <button
              type="button"
              onClick={handleSaveProfileInBrowser}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] bg-[#2F3E4E] hover:bg-[#1E293B] text-[#FFFDF5] text-xs font-bold cursor-pointer whitespace-nowrap shrink-0"
            >
              <BookmarkPlus className="w-3.5 h-3.5 text-[#F9C80E]" />
              <span>Save in Browser</span>
            </button>
          </div>

          {savedProfiles.length === 0 ? (
            <p className="text-xs text-[#475569] bg-[#FEF2C8]/55 rounded-xl p-3 border border-[#2F3E4E]/20">
              Your current draft already auto-saves in this browser. Save named profiles above to switch between multiple bank accounts, branches, and RTGS beneficiaries in 1 click.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {savedProfiles.map((prof) => (
                <div
                  key={prof.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-[#2F3E4E]/30 bg-white"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#2F3E4E] truncate">{prof.name}</div>
                    <div className="text-[11px] font-mono text-[#64748B] truncate">
                      {prof.bank.toUpperCase()} · {prof.formType.toUpperCase()}
                      {prof.fields.branch ? ` · ${prof.fields.branch}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleLoadBrowserProfile(prof)}
                      className="px-2.5 py-1 rounded-md border border-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#F9C80E] text-[11px] font-bold text-[#2F3E4E] cursor-pointer"
                    >
                      Load
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteBrowserProfile(prof.id)}
                      aria-label={`Delete profile ${prof.name}`}
                      className="p-1.5 rounded-md text-[#64748B] hover:text-[#B91C1C] hover:bg-rose-50 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* RBI / Tax Compliance Notice */}
      <div className="rounded-xl border-[1.5px] border-[#2F3E4E]/75 bg-[#FFE1B3]/70 px-3.5 py-2.5 text-[11px] text-[#2F3E4E] flex flex-col sm:flex-row sm:items-center justify-between gap-2 no-print">
        <div className="flex items-start sm:items-center gap-2 min-w-0">
          <Info className="w-3.5 h-3.5 text-[#2F3E4E] shrink-0 mt-0.5 sm:mt-0" />
          <span className="leading-snug">
            <strong>Banking Verification Notice:</strong> Verify account numbers &amp; denomination sums prior to printing. Ensure the teller affixes an official branch stamp on your counterfoil. Cash deposits ≥ ₹50,000 require PAN under Rule 114B.
          </span>
        </div>
        <span className="text-[11px] font-bold text-[#2F3E4E] whitespace-nowrap shrink-0">
          100% Client-Side
        </span>
      </div>

      {/* Form Switcher Strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 no-print">
        <div className="inline-flex flex-wrap sm:flex-nowrap items-center gap-1 p-1 bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-xl w-full md:w-auto">
          <button
            type="button"
            onClick={() => setFormType('deposit')}
            className={`flex-1 sm:flex-initial px-3.5 h-9 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
              formType === 'deposit'
                ? 'bg-[#2F3E4E] text-[#FFFDF5]'
                : 'text-[#2F3E4E] hover:bg-[#FEF2C8]'
            }`}
          >
            <Banknote className="w-3.5 h-3.5" />
            <span>Deposit Slip</span>
          </button>
          <button
            type="button"
            onClick={() => setFormType('dd')}
            className={`flex-1 sm:flex-initial px-3.5 h-9 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
              formType === 'dd'
                ? 'bg-[#2F3E4E] text-[#FFFDF5]'
                : 'text-[#2F3E4E] hover:bg-[#FEF2C8]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>DD / Banker&apos;s Cheque</span>
          </button>
          <button
            type="button"
            onClick={() => setFormType('rtgs')}
            className={`flex-1 sm:flex-initial px-3.5 h-9 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
              formType === 'rtgs'
                ? 'bg-[#2F3E4E] text-[#FFFDF5]'
                : 'text-[#2F3E4E] hover:bg-[#FEF2C8]'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>RTGS / NEFT</span>
          </button>
        </div>

        <div className="flex items-center justify-between md:justify-start gap-2 text-xs text-[#475569] bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] px-3.5 h-11 rounded-xl shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="shrink-0">Active Form:</span>
            <strong className="text-[#2F3E4E] truncate">{output.title}</strong>
          </div>
          <span aria-hidden="true" className="text-[#2F3E4E]/30">·</span>
          <span className="font-mono tabular-nums text-[#2F3E4E] font-semibold whitespace-nowrap shrink-0">
            A4 {output.orientation}
          </span>
        </div>
      </div>

      {/* Live Pre-Print Slip Audit Bar */}
      <div
        className={`rounded-xl border-[1.5px] px-3.5 py-2.5 text-xs no-print ${
          auditErrCount > 0
            ? 'bg-rose-50/90 border-rose-700 text-rose-950'
            : auditWarnCount > 0
            ? 'bg-amber-50/90 border-amber-700 text-amber-950'
            : 'bg-[#CEE5DC]/65 border-[#2F3E4E] text-[#2F3E4E]'
        }`}
      >
        {auditIssues.length === 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 font-bold">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              All Slip Format, Digit-Box &amp; RBI / Rule 114B Checks Passed
            </span>
            <span className="font-mono text-[11px] font-semibold text-[#475569]">
              A/c Box Limit: {accountBoxLimit} digits
              {formType === 'rtgs' ? ` · Ben A/c: ${benBoxLimit} digits` : ''}
            </span>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 font-bold">
              <span className="inline-flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Pre-Print Slip Audit: {auditErrCount} Error(s) · {auditWarnCount} Warning(s)
              </span>
              <span className="text-[11px] font-mono font-semibold opacity-80">
                A/c Box Limit: {accountBoxLimit} digits
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {auditIssues.map((iss) => (
                <div
                  key={iss.id}
                  className={`px-3 py-2 rounded-lg border flex items-center justify-between gap-2.5 bg-white/90 ${
                    iss.sev === 'err' ? 'border-rose-300' : 'border-amber-300'
                  }`}
                >
                  <div className="min-w-0">
                    <span
                      className={`inline-block text-[10px] font-bold uppercase tracking-wider mr-1.5 ${
                        iss.sev === 'err' ? 'text-rose-700' : 'text-amber-700'
                      }`}
                    >
                      [{iss.code}]
                    </span>
                    <span className="text-[#2F3E4E]">{iss.message}</span>
                  </div>
                  {iss.fixAction && iss.fixLabel && (
                    <button
                      type="button"
                      onClick={() => handleApplyAuditFix(iss.fixAction!)}
                      className="px-2.5 py-1 rounded-md bg-[#2F3E4E] hover:bg-[#1E293B] text-[#FFFDF5] text-[11px] font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer whitespace-nowrap"
                    >
                      <Sparkles className="w-3 h-3" />
                      {iss.fixLabel}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Inline Clear Confirmation */}
      {showClearConfirm && (
        <div className="px-4 py-3 rounded-xl bg-[#FFE1B3] border-[1.5px] border-[#2F3E4E] text-xs text-[#2F3E4E] flex flex-wrap items-center justify-between gap-3 no-print">
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle className="w-4 h-4 text-[#9E2A2B] shrink-0" />
            <span>Reset all fields on this banking slip? Unsaved entries will be cleared.</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleConfirmClear}
              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold cursor-pointer whitespace-nowrap"
            >
              Yes, Clear All
            </button>
            <button
              type="button"
              onClick={() => setShowClearConfirm(false)}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-[#2F3E4E] border border-[#2F3E4E] font-semibold cursor-pointer whitespace-nowrap"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Inline Status Notice */}
      {statusMessage && (
        <div className="px-4 py-2.5 rounded-xl bg-[#CEE5DC] border-[1.5px] border-[#2F3E4E] text-xs text-[#2F3E4E] flex items-center justify-between gap-3 no-print">
          <span className="flex items-center gap-2 font-medium">
            <Info className="w-4 h-4 shrink-0" />
            {statusMessage}
          </span>
          <button
            type="button"
            onClick={() => setStatusMessage('')}
            className="text-xs font-bold hover:underline cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* TWO-COLUMN UNIVERSAL DATA ENTRY CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch no-print">
        {/* LEFT CARD: BANK & ACCOUNT DETAILS */}
        <div className="lg:col-span-5 bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 sm:p-6 shadow-[0_4px_0_#2F3E4E] flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 pb-1">
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4 text-[#2F3E4E] shrink-0" />
                <h2 className="font-display text-sm font-extrabold text-[#2F3E4E]">
                  Bank &amp; Account Details
                </h2>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg border border-[#2F3E4E]/25 bg-[#FEF2C8] text-[#475569] whitespace-nowrap">
                SBI · HDFC
              </span>
            </div>

            {/* Select Bank (2 Active Bank Toggle Buttons: SBI & HDFC) */}
            <div>
              <label className="block text-xs font-semibold text-[#475569] mb-1.5">
                Select Bank
              </label>
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Select Bank">
                {(
                  [
                    { id: 'sbi', title: 'State Bank of India', code: 'SBI' },
                    { id: 'hdfc', title: 'HDFC Bank', code: 'HDFC' },
                  ] as const
                ).map((bank) => {
                  const active = selectedBank === bank.id;
                  return (
                    <button
                      key={bank.id}
                      type="button"
                      onClick={() => {
                        setSelectedBank(bank.id);
                        setStatusMessage(`Switched slip template to ${bank.title} (${bank.code}).`);
                      }}
                      aria-pressed={active}
                      className={`px-3 py-2.5 rounded-xl border-[1.5px] text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                        active
                          ? 'bg-[#2F3E4E] text-[#F9C80E] border-[#2F3E4E] shadow-[0_2px_0_#1E293B]'
                          : 'bg-white text-[#2F3E4E] border-[#2F3E4E]/35 hover:border-[#2F3E4E] hover:bg-[#FEF2C8]/70'
                      }`}
                    >
                      <div className="min-w-0">
                        <span className="block text-xs sm:text-[13px] font-display font-extrabold leading-tight truncate">
                          {bank.code}
                        </span>
                        <span
                          className={`block text-[10px] truncate mt-0.5 ${
                            active ? 'text-[#FEF2C8]' : 'text-[#64748B]'
                          }`}
                        >
                          {bank.title}
                        </span>
                      </div>
                      {active && <Check className="w-4 h-4 text-[#F9C80E] shrink-0" />}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-[#64748B] mt-1.5">
                Currently active for SBI &amp; HDFC slips — additional banks will be added in future updates.
              </p>
            </div>

            {/* Branch Name & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#475569] mb-1.5">
                  Branch Name
                </label>
                <input
                  type="text"
                  value={formState.branch}
                  onChange={(e) => updateField('branch', e.target.value)}
                  placeholder="Branch name"
                  className="w-full px-3.5 py-2 text-xs sm:text-sm text-[#2F3E4E] rounded-xl border-[1.5px] border-[#2F3E4E]/40 bg-white focus:outline-none focus:border-[#2F3E4E]"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-[#475569]">
                    {formType === 'deposit' ? 'Deposit Date' : 'Date'}
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      updateField('date', new Date().toISOString().split('T')[0])
                    }
                    className="text-[11px] font-bold text-[#2F3E4E] underline hover:opacity-80 cursor-pointer"
                  >
                    Today
                  </button>
                </div>
                <input
                  type="date"
                  value={formState.date}
                  onChange={(e) => updateField('date', e.target.value)}
                  className="w-full px-3.5 py-2 text-xs sm:text-sm font-mono tabular-nums text-[#2F3E4E] rounded-xl border-[1.5px] border-[#2F3E4E]/40 bg-white focus:outline-none focus:border-[#2F3E4E]"
                />
              </div>
            </div>

            {/* Account Holder Name */}
            <div>
              <label className="block text-xs font-semibold text-[#475569] mb-1.5">
                {formType === 'rtgs'
                  ? 'Remitter / Applicant Name *'
                  : formType === 'dd'
                  ? 'Purchaser / Applicant Name *'
                  : 'Account Holder Name *'}
              </label>
              <input
                type="text"
                value={formState.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="Full name as on bank records"
                className="w-full px-3.5 py-2 text-sm font-semibold text-[#2F3E4E] rounded-xl border-[1.5px] border-[#2F3E4E]/40 bg-white focus:outline-none focus:border-[#2F3E4E]"
              />
            </div>

            {/* Account Number & Account Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-[#475569]">
                    {formType === 'rtgs' ? 'Debit Account Number *' : 'Account Number *'}
                  </label>
                  <span
                    className={`text-[10px] font-mono tabular-nums font-semibold ${
                      formState.accountNo.length > accountBoxLimit
                        ? 'text-rose-700'
                        : 'text-[#64748B]'
                    }`}
                  >
                    {formState.accountNo.length}/{accountBoxLimit} boxes
                  </span>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={19}
                  value={formState.accountNo}
                  onChange={(e) =>
                    updateField('accountNo', e.target.value.replace(/\s+/g, ''))
                  }
                  placeholder={
                    accountBoxLimit === 14
                      ? '14-digit A/c No.'
                      : accountBoxLimit === 11
                      ? '11-digit SBI DD A/c'
                      : `Up to ${accountBoxLimit}-digit A/c No.`
                  }
                  className="w-full px-3.5 py-2 text-sm font-mono font-bold tracking-wider text-[#2F3E4E] rounded-xl border-[1.5px] border-[#2F3E4E]/40 bg-white focus:outline-none focus:border-[#2F3E4E]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#475569] mb-1.5">
                  Account Type
                </label>
                <select
                  value={formState.accountType}
                  onChange={(e) =>
                    handleAccountTypeChange(
                      e.target.value as BankFormState['accountType']
                    )
                  }
                  className="w-full px-3.5 py-2 text-xs sm:text-sm font-medium text-[#2F3E4E] rounded-xl border-[1.5px] border-[#2F3E4E]/40 bg-white focus:outline-none focus:border-[#2F3E4E]"
                >
                  <option value="current">Current Account</option>
                  <option value="savings">Savings Account</option>
                  <option value="overdraft">Overdraft (OD)</option>
                  <option value="cc">Cash Credit / Card</option>
                  <option value="loan">Loan Account</option>
                </select>
              </div>
            </div>

            {/* Depositor Name & Mobile Number */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#475569] mb-1.5">
                  Depositor Name
                </label>
                <input
                  type="text"
                  value={formState.depositorName}
                  onChange={(e) => updateField('depositorName', e.target.value)}
                  placeholder="Depositor / bearer name"
                  className="w-full px-3.5 py-2 text-xs sm:text-sm text-[#2F3E4E] rounded-xl border-[1.5px] border-[#2F3E4E]/40 bg-white focus:outline-none focus:border-[#2F3E4E]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#475569] mb-1.5">
                  Mobile Number
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={formState.mobile}
                    onChange={(e) =>
                      updateField('mobile', e.target.value.replace(/[^0-9]/g, ''))
                    }
                    placeholder="10-digit mobile"
                    className="w-full px-3.5 py-2 pr-8 text-xs sm:text-sm font-mono tabular-nums text-[#2F3E4E] rounded-xl border-[1.5px] border-[#2F3E4E]/40 bg-white focus:outline-none focus:border-[#2F3E4E]"
                  />
                  {formState.mobile.length === 10 && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 absolute right-2.5 top-2.5" />
                  )}
                </div>
              </div>
            </div>

            {/* Depositor PAN Number */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-[#475569]">
                  Depositor PAN Number (Mandatory for cash ≥ ₹50,000)
                </label>
                {output.requiresPanAlert && !formState.pan && !formState.form60 && (
                  <span className="text-[11px] font-bold text-[#9E2A2B]">Required</span>
                )}
              </div>
              <input
                type="text"
                maxLength={10}
                value={formState.pan}
                onChange={(e) => updateField('pan', e.target.value.toUpperCase())}
                placeholder="10-character PAN"
                className="w-full px-3.5 py-2 text-xs sm:text-sm font-mono font-bold uppercase text-[#2F3E4E] rounded-xl border-[1.5px] border-[#2F3E4E]/40 bg-white focus:outline-none focus:border-[#2F3E4E]"
              />
              {selectedBank === 'sbi' && formType === 'deposit' && (
                <label className="mt-2 inline-flex items-center gap-2 text-xs font-medium text-[#2F3E4E] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formState.form60}
                    onChange={(e) => updateField('form60', e.target.checked)}
                    className="rounded border-[#2F3E4E]/40 text-[#2F3E4E]"
                  />
                  Tick Form 60 attached box on SBI slip (if PAN not held)
                </label>
              )}
            </div>

            {/* Rule 114B Alert */}
            {output.requiresPanAlert && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-950">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Rule 114B:</strong> Cash deposits of ₹50,000 or more require PAN{' '}
                    {selectedBank === 'sbi' ? 'or signed Form 60.' : 'number.'}
                  </span>
                </div>
              </div>
            )}

            {/* Collapsible Optional Fields */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowOptionalDetails((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2F3E4E] hover:opacity-80 cursor-pointer"
              >
                {showOptionalDetails ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
                <span>
                  {showOptionalDetails ? 'Hide' : 'Show'} Optional Fields (Email, Address, Card/Loan, Branch Code)
                </span>
              </button>

              {showOptionalDetails && (
                <div className="mt-3 pt-3 border-t border-[#2F3E4E]/15 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[#475569] mb-1">
                        Landline / Tel No.
                      </label>
                      <input
                        type="tel"
                        value={formState.tel}
                        onChange={(e) => updateField('tel', e.target.value)}
                        placeholder="Optional landline"
                        className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#2F3E4E]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#475569] mb-1">
                        E-mail ID
                      </label>
                      <input
                        type="email"
                        value={formState.email}
                        onChange={(e) => updateField('email', e.target.value)}
                        placeholder="Email address"
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#2F3E4E]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#475569] mb-1">
                      Address / Customer Ref.
                    </label>
                    <input
                      type="text"
                      value={formState.address}
                      onChange={(e) => updateField('address', e.target.value)}
                      placeholder="Street, city or customer reference"
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#2F3E4E]"
                    />
                  </div>

                  {selectedBank === 'sbi' && formType === 'rtgs' && (
                    <div>
                      <label className="block text-xs font-medium text-[#475569] mb-1">
                        SBI Branch Code (5-digit)
                      </label>
                      <input
                        type="text"
                        value={formState.branchCode}
                        onChange={(e) => updateField('branchCode', e.target.value)}
                        placeholder="5-digit branch code"
                        className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#2F3E4E]"
                      />
                    </div>
                  )}

                  {selectedBank === 'hdfc' && formType === 'deposit' && (
                    <div className="space-y-3 pt-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-[#475569] mb-1">
                            Credit Card No. (16)
                          </label>
                          <input
                            type="text"
                            maxLength={16}
                            value={formState.creditCardNo}
                            onChange={(e) =>
                              updateField(
                                'creditCardNo',
                                e.target.value.replace(/[^0-9]/g, '')
                              )
                            }
                            placeholder="16-digit card no."
                            className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#2F3E4E]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#475569] mb-1">
                            Loan Account No. (10)
                          </label>
                          <input
                            type="text"
                            maxLength={10}
                            value={formState.loanNo}
                            onChange={(e) => updateField('loanNo', e.target.value)}
                            placeholder="Optional loan A/c"
                            className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#2F3E4E]"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                        <div>
                          <label className="block text-xs font-medium text-[#475569] mb-1">
                            HDFC Special Category
                          </label>
                          <select
                            value={formState.special}
                            onChange={(e) => updateField('special', e.target.value)}
                            className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#2F3E4E]"
                          >
                            <option value="">None</option>
                            <option value="NRO Account">NRO Account</option>
                            <option value="Dividend / Interest Warrant">Dividend / Interest Warrant</option>
                            <option value="Rent / Pension / Asset Sale">Rent / Pension / Asset Sale</option>
                          </select>
                        </div>
                        <label className="inline-flex items-center gap-2 text-xs text-[#2F3E4E] cursor-pointer pt-4">
                          <input
                            type="checkbox"
                            checked={formState.loanTicked}
                            onChange={(e) => updateField('loanTicked', e.target.checked)}
                            className="rounded border-slate-300 text-[#2F3E4E]"
                          />
                          Tick Loan Account box
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Deposit Type Toggle Buttons */}
          {formType === 'deposit' && (
            <div className="pt-3 border-t border-[#2F3E4E]/15">
              <label className="block text-xs font-semibold text-[#475569] mb-2">
                Deposit Type
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleDepositModeChange('cash')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold border-[1.5px] transition cursor-pointer whitespace-nowrap ${
                    formState.depositMode === 'cash'
                      ? 'bg-[#2F3E4E] text-[#FFFDF5] border-[#2F3E4E]'
                      : 'bg-white text-[#2F3E4E] border-[#2F3E4E] hover:bg-[#FEF2C8]'
                  }`}
                >
                  Cash Deposit
                </button>
                <button
                  type="button"
                  onClick={() => handleDepositModeChange('cheque')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold border-[1.5px] transition cursor-pointer whitespace-nowrap ${
                    formState.depositMode === 'cheque'
                      ? 'bg-[#2F3E4E] text-[#FFFDF5] border-[#2F3E4E]'
                      : 'bg-white text-[#2F3E4E] border-[#2F3E4E] hover:bg-[#FEF2C8]'
                  }`}
                >
                  Cheque / Draft
                </button>
                <button
                  type="button"
                  onClick={() => handleDepositModeChange('both')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold border-[1.5px] transition cursor-pointer whitespace-nowrap ${
                    formState.depositMode === 'both'
                      ? 'bg-[#2F3E4E] text-[#FFFDF5] border-[#2F3E4E]'
                      : 'bg-white text-[#2F3E4E] border-[#2F3E4E] hover:bg-[#FEF2C8]'
                  }`}
                >
                  Cash + Cheque
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT CARD: DENOMINATION COUNTER / CHEQUES / DD / RTGS */}
        <div className="lg:col-span-7 bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 sm:p-6 shadow-[0_4px_0_#2F3E4E] flex flex-col justify-between space-y-5">
          {/* DEPOSIT SLIP BODY */}
          {formType === 'deposit' && (
            <div className="space-y-6">
              {showCashCounter && (
                <div className="space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#F9C80E] text-[#2F3E4E] flex items-center justify-center shrink-0">
                        <Coins className="w-4 h-4" aria-hidden="true" />
                      </div>
                      <div>
                        <h2 className="font-display text-sm font-extrabold text-[#2F3E4E]">
                          Currency Denomination Counter
                        </h2>
                        <p className="text-[11px] text-[#64748B]">
                          Step, bundle (+10), or auto-split any target cash sum
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 ml-auto">
                      <div className="text-right">
                        <div className="text-[11px] font-mono tabular-nums text-[#64748B]">
                          {cashStats.totalNotes.toLocaleString('en-IN')} notes ·{' '}
                          {cashStats.activeDenoms} active
                        </div>
                        <div
                          className={`text-base sm:text-lg font-bold font-mono tabular-nums ${
                            output.cashTotal > 0 ? 'text-emerald-700' : 'text-[#2F3E4E]'
                          }`}
                        >
                          ₹
                          {output.cashTotal.toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleClearCashOnly}
                        disabled={output.cashTotal <= 0 && cashStats.totalNotes <= 0}
                        title="Clear cash denominations"
                        className="inline-flex items-center gap-1.5 min-h-[34px] px-2.5 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white hover:bg-rose-50 hover:text-rose-700 text-xs font-semibold text-[#2F3E4E] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                        <span className="hidden sm:inline">Clear</span>
                      </button>
                    </div>
                  </div>

                  {/* Quick Auto-Split Target */}
                  <div className="rounded-xl border-[1.5px] border-[#2F3E4E]/30 bg-[#FEF2C8]/60 px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#2F3E4E]">
                      <Calculator className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>Quick Auto-Split Target</span>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <div className="relative flex-1 sm:w-44">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono font-semibold text-[#64748B]">
                          ₹
                        </span>
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={targetSplitAmount}
                          onChange={(e) => setTargetSplitAmount(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAutoSplitDepositCash();
                            }
                          }}
                          placeholder="e.g. 48500"
                          aria-label="Target cash amount in rupees to auto-split"
                          className="w-full h-8 pl-6 pr-2.5 text-xs font-mono font-bold tabular-nums text-[#2F3E4E] rounded-lg border border-slate-300 bg-white focus:border-[#2F3E4E] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleAutoSplitDepositCash}
                        className="h-8 px-3 rounded-lg bg-[#2F3E4E] hover:bg-[#1E293B] text-xs font-semibold text-[#FFFDF5] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        Split Notes
                      </button>
                    </div>
                  </div>

                  {/* Structured Denomination Ledger Table */}
                  <div className="rounded-xl border-[1.5px] border-[#2F3E4E] overflow-hidden bg-white">
                    <div className="grid grid-cols-12 items-center gap-2 bg-[#FEF2C8] border-b border-[#2F3E4E]/20 px-3.5 py-2 text-[11px] font-bold text-[#2F3E4E]">
                      <div className="col-span-4 sm:col-span-3">Denomination</div>
                      <div className="col-span-5 sm:col-span-5">Quantity</div>
                      <div className="hidden sm:block sm:col-span-2">Share</div>
                      <div className="col-span-3 sm:col-span-2 text-right">Subtotal</div>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {DEPOSIT_LEDGER_DENOMS.map((denom) => {
                        const count = parseInt(formState.notes[denom] || '0', 10) || 0;
                        const subtotal = count * denom;
                        const sharePct =
                          output.cashTotal > 0 ? Math.min(100, (subtotal / output.cashTotal) * 100) : 0;
                        const style = DENOM_STYLES[denom];

                        return (
                          <div
                            key={denom}
                            className={`grid grid-cols-12 items-center gap-2 px-3.5 py-1.5 transition-colors ${
                              count > 0 ? 'bg-emerald-50/45' : 'hover:bg-slate-50/70'
                            }`}
                          >
                            <div className="col-span-4 sm:col-span-3 flex items-center gap-2 min-w-0">
                              <span
                                className={`w-14 py-1 text-center font-mono font-bold tabular-nums text-xs rounded-md border shrink-0 ${style.badge}`}
                              >
                                ₹{denom}
                              </span>
                              {style.hint ? (
                                <span className="hidden md:inline text-[10px] font-medium text-slate-400 truncate">
                                  {style.hint}
                                </span>
                              ) : (
                                <span className="text-xs font-mono text-slate-400">×</span>
                              )}
                            </div>

                            <div className="col-span-5 sm:col-span-5 flex items-center gap-1.5 min-w-0">
                              <div className="inline-flex items-center rounded-lg border border-slate-300 bg-white overflow-hidden focus-within:border-[#2F3E4E]">
                                <button
                                  type="button"
                                  onClick={() => stepNoteCount(denom, -1)}
                                  disabled={count <= 0}
                                  aria-label={`Decrease ₹${denom} notes`}
                                  className="w-7 h-7 flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-not-allowed"
                                >
                                  <Minus className="w-3 h-3" aria-hidden="true" />
                                </button>
                                <input
                                  ref={(el) => {
                                    noteInputRefs.current[String(denom)] = el;
                                  }}
                                  type="number"
                                  min={0}
                                  inputMode="numeric"
                                  value={formState.notes[denom] || ''}
                                  onChange={(e) => updateNoteCount(denom, e.target.value)}
                                  onFocus={(e) => e.currentTarget.select()}
                                  onKeyDown={(e) => handleNoteKeyDown(e, denom)}
                                  placeholder="0"
                                  aria-label={`${denom} rupee notes count`}
                                  className="w-12 sm:w-14 h-7 text-center px-1 text-xs font-mono font-bold tabular-nums text-[#2F3E4E] border-x border-slate-200 bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => stepNoteCount(denom, 1)}
                                  aria-label={`Increase ₹${denom} notes`}
                                  className="w-7 h-7 flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" aria-hidden="true" />
                                </button>
                              </div>

                              <button
                                type="button"
                                onClick={() => stepNoteCount(denom, 10)}
                                title={`Add 10 notes of ₹${denom}`}
                                className="hidden sm:inline-flex items-center justify-center h-7 px-1.5 rounded-md border border-slate-200 bg-slate-50 hover:bg-[#FEF2C8] hover:border-[#2F3E4E] text-[10px] font-mono font-semibold text-[#2F3E4E] transition-colors cursor-pointer shrink-0"
                              >
                                +10
                              </button>
                            </div>

                            <div className="hidden sm:flex sm:col-span-2 items-center gap-1.5">
                              <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-150 ${style.bar}`}
                                  style={{ width: `${sharePct}%` }}
                                />
                              </div>
                              <span className="w-7 text-right font-mono tabular-nums text-[10px] text-slate-500">
                                {sharePct >= 1 ? `${Math.round(sharePct)}%` : sharePct > 0 ? '<1%' : '—'}
                              </span>
                            </div>

                            <div
                              className={`col-span-3 sm:col-span-2 text-right font-mono tabular-nums text-xs ${
                                subtotal > 0 ? 'font-bold text-[#2F3E4E]' : 'text-slate-400'
                              }`}
                            >
                              ₹{subtotal.toLocaleString('en-IN')}
                            </div>
                          </div>
                        );
                      })}

                      {/* Coins Row */}
                      <div
                        className={`grid grid-cols-12 items-center gap-2 px-3.5 py-2 transition-colors ${
                          cashStats.coinsVal > 0 ? 'bg-emerald-50/45' : 'bg-slate-50/35'
                        }`}
                      >
                        <div className="col-span-4 sm:col-span-3 flex items-center gap-2 min-w-0">
                          <span className="w-14 py-1 text-center font-mono font-bold text-[11px] rounded-md border border-amber-200 bg-amber-50/80 text-amber-900 shrink-0">
                            Coins
                          </span>
                          <span className="hidden md:inline text-[11px] text-slate-500 truncate">
                            Paise (₹)
                          </span>
                        </div>

                        <div className="col-span-5 sm:col-span-5">
                          <input
                            ref={(el) => {
                              noteInputRefs.current['coins'] = el;
                            }}
                            type="number"
                            min={0}
                            step="any"
                            value={formState.coins}
                            onChange={(e) => updateField('coins', e.target.value)}
                            onFocus={(e) => e.currentTarget.select()}
                            placeholder="0.00"
                            aria-label="Coins amount in rupees"
                            className="w-28 sm:w-32 h-7 px-2.5 text-xs font-mono font-bold tabular-nums text-[#2F3E4E] rounded-lg border border-slate-300 bg-white focus:border-[#2F3E4E] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </div>

                        <div className="hidden sm:flex sm:col-span-2 items-center gap-1.5">
                          <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-amber-500 transition-all duration-150"
                              style={{
                                width: `${
                                  output.cashTotal > 0
                                    ? Math.min(100, (cashStats.coinsVal / output.cashTotal) * 100)
                                    : 0
                                }%`,
                              }}
                            />
                          </div>
                          <span className="w-7 text-right font-mono tabular-nums text-[10px] text-slate-500">
                            {output.cashTotal > 0 && cashStats.coinsVal > 0
                              ? `${Math.max(
                                  1,
                                  Math.round((cashStats.coinsVal / output.cashTotal) * 100)
                                )}%`
                              : '—'}
                          </span>
                        </div>

                        <div
                          className={`col-span-3 sm:col-span-2 text-right font-mono tabular-nums text-xs ${
                            cashStats.coinsVal > 0 ? 'font-bold text-[#2F3E4E]' : 'text-slate-400'
                          }`}
                        >
                          ₹
                          {cashStats.coinsVal.toLocaleString('en-IN', {
                            maximumFractionDigits: 2,
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Ledger Total Summary Footer */}
                    <div className="bg-[#FEF2C8]/70 border-t border-[#2F3E4E]/20 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="text-[#475569] font-medium">
                        <span className="font-mono tabular-nums font-bold text-[#2F3E4E]">
                          {cashStats.totalNotes.toLocaleString('en-IN')}
                        </span>{' '}
                        Notes Counted <span aria-hidden="true">·</span>{' '}
                        <span className="font-mono tabular-nums font-bold text-[#2F3E4E]">
                          {cashStats.activeDenoms}
                        </span>{' '}
                        Active Rows
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[#475569] font-medium">Cash Subtotal:</span>
                        <span className="font-mono tabular-nums text-sm font-bold text-emerald-700">
                          ₹
                          {output.cashTotal.toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Cheque / Demand Draft Details */}
              {showChequeCounter && (
                <div
                  className={
                    showCashCounter ? 'pt-5 border-t border-[#2F3E4E]/15 space-y-4' : 'space-y-4'
                  }
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="font-display text-sm font-extrabold text-[#2F3E4E]">
                        Cheque / Demand Draft Details
                      </h2>
                      <p className="text-xs text-[#64748B] mt-0.5">
                        {selectedBank === 'sbi'
                          ? 'SBI slip fits 3 total entries (Cash + Cheques).'
                          : 'HDFC prints up to 6 cheques on Bank Copy.'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {selectedBank === 'hdfc' && (
                        <select
                          aria-label="HDFC cheque clearing type"
                          value={
                            formState.hdfcDepositType === 'out' ? 'out' : 'local'
                          }
                          onChange={(e) =>
                            updateField(
                              'hdfcDepositType',
                              e.target.value as 'local' | 'out'
                            )
                          }
                          className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-[#2F3E4E] bg-white text-[#2F3E4E] focus:outline-none"
                        >
                          <option value="local">Local Cheque</option>
                          <option value="out">Outstation Cheque</option>
                        </select>
                      )}

                      {visibleCheques < MAX_CHEQUES && (
                        <button
                          type="button"
                          onClick={() =>
                            setVisibleCheques((c) => Math.min(MAX_CHEQUES, c + 1))
                          }
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] transition cursor-pointer whitespace-nowrap"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Cheque</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {formState.cheques.slice(0, visibleCheques).map((chq, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl border border-[#2F3E4E]/25 bg-white space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#2F3E4E]">
                            Cheque #{idx + 1}
                          </span>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5">
                              <label className="text-[11px] text-[#64748B]">
                                Chq Date
                              </label>
                              <input
                                type="date"
                                value={chq.date}
                                onChange={(e) =>
                                  updateChequeField(idx, 'date', e.target.value)
                                }
                                className="px-2 py-0.5 text-[11px] font-mono rounded border border-slate-300 bg-white text-[#2F3E4E] focus:outline-none focus:border-[#2F3E4E]"
                              />
                            </div>
                            <button
                              type="button"
                              aria-label={`Remove or clear cheque ${idx + 1}`}
                              onClick={() => handleRemoveChequeRow(idx)}
                              className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                          <div className="sm:col-span-3">
                            <label className="block text-[11px] text-[#64748B] mb-1">
                              Cheque No
                            </label>
                            <input
                              type="text"
                              value={chq.chequeNo}
                              onChange={(e) =>
                                updateChequeField(idx, 'chequeNo', e.target.value)
                              }
                              placeholder="Cheque number"
                              className="w-full px-2.5 py-1.5 text-xs font-mono text-[#2F3E4E] rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#2F3E4E]"
                            />
                          </div>
                          <div className="sm:col-span-3">
                            <label className="block text-[11px] text-[#64748B] mb-1">
                              Drawee Bank
                            </label>
                            <input
                              type="text"
                              value={chq.bankBranch}
                              onChange={(e) =>
                                updateChequeField(idx, 'bankBranch', e.target.value)
                              }
                              placeholder="Drawee bank name"
                              className="w-full px-2.5 py-1.5 text-xs text-[#2F3E4E] rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#2F3E4E]"
                            />
                          </div>
                          <div className="sm:col-span-3">
                            <label className="block text-[11px] text-[#64748B] mb-1">
                              Branch
                            </label>
                            <input
                              type="text"
                              value={chq.city}
                              onChange={(e) =>
                                updateChequeField(idx, 'city', e.target.value)
                              }
                              placeholder="Branch / city"
                              className="w-full px-2.5 py-1.5 text-xs text-[#2F3E4E] rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#2F3E4E]"
                            />
                          </div>
                          <div className="sm:col-span-3">
                            <label className="block text-[11px] text-[#64748B] mb-1">
                              Amount (₹)
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={chq.amount}
                              onChange={(e) =>
                                updateChequeField(idx, 'amount', e.target.value)
                              }
                              placeholder="0"
                              className="w-full px-2.5 py-1.5 text-xs font-mono font-bold text-right tabular-nums text-[#2F3E4E] rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#2F3E4E]"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {output.warning && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-xs text-rose-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{output.warning}</span>
                </div>
              )}
            </div>
          )}

          {/* DEMAND DRAFT / BANKER'S CHEQUE BODY */}
          {formType === 'dd' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-sm font-extrabold text-[#2F3E4E]">
                  Draft / Banker&apos;s Cheque Specifications
                </h2>
                <span className="text-sm font-bold font-mono tabular-nums text-emerald-700">
                  Total: ₹{output.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {selectedBank === 'sbi' ? (
                  <div>
                    <label className="block text-xs font-semibold text-[#475569] mb-1.5">
                      Please Issue
                    </label>
                    <select
                      value={formState.ddIssueType}
                      onChange={(e) =>
                        updateField('ddIssueType', e.target.value as 'dd' | 'bc')
                      }
                      className="w-full px-3.5 py-2 text-xs sm:text-sm font-medium rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-[#2F3E4E]"
                    >
                      <option value="dd">Demand Draft</option>
                      <option value="bc">Banker&apos;s Cheque</option>
                    </select>
                  </div>
                ) : (
                  <div className="flex items-center pt-5">
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#2F3E4E] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formState.ddTicked}
                        onChange={(e) => updateField('ddTicked', e.target.checked)}
                        className="rounded border-slate-300 text-[#2F3E4E]"
                      />
                      Demand Draft ticked on HDFC form
                    </label>
                  </div>
                )}

                {selectedBank === 'sbi' ? (
                  <div>
                    <label className="block text-xs font-semibold text-[#475569] mb-1.5">
                      Code No. (5 digits)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={5}
                      value={formState.ddCodeNo}
                      onChange={(e) =>
                        updateField('ddCodeNo', e.target.value.replace(/[^0-9]/g, ''))
                      }
                      placeholder="5-digit code"
                      className="w-full px-3.5 py-2 text-xs sm:text-sm font-mono rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-[#2F3E4E]"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-[#475569] mb-1.5">
                      Deliver Draft To Mr / Ms.
                    </label>
                    <input
                      type="text"
                      value={formState.ddDeliverTo}
                      onChange={(e) => updateField('ddDeliverTo', e.target.value)}
                      placeholder="Bearer / Recipient name"
                      className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-[#2F3E4E]"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#475569] mb-1.5">
                    In Favour Of (Payee Name) *
                  </label>
                  <input
                    type="text"
                    value={formState.ddFavouring}
                    onChange={(e) => updateField('ddFavouring', e.target.value)}
                    placeholder="Payee name / institution"
                    className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-[#2F3E4E]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#475569] mb-1.5">
                    Payable At (City / Branch) *
                  </label>
                  <input
                    type="text"
                    value={formState.ddPayableAt}
                    onChange={(e) => updateField('ddPayableAt', e.target.value)}
                    placeholder="City / branch name"
                    className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-[#2F3E4E]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#475569] mb-1.5">
                    DD / B.C. Amount (₹) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formState.ddAmount}
                    onChange={(e) => updateField('ddAmount', e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3.5 py-2 text-sm font-mono font-bold rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-[#2F3E4E]"
                  />
                </div>

                {selectedBank === 'sbi' ? (
                  <div>
                    <label className="block text-xs font-semibold text-[#475569] mb-1.5">
                      Exchange / Commission (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={formState.ddExchange}
                      onChange={(e) => updateField('ddExchange', e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3.5 py-2 text-sm font-mono rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-[#2F3E4E]"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-[#475569] mb-1.5">
                      Payment Cheque No. &amp; Date
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={formState.ddChequeNo}
                        onChange={(e) => updateField('ddChequeNo', e.target.value)}
                        placeholder="Chq no."
                        className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-[#2F3E4E]"
                      />
                      <input
                        type="date"
                        value={formState.ddChequeDate}
                        onChange={(e) => updateField('ddChequeDate', e.target.value)}
                        className="w-full px-2.5 py-2 text-xs font-mono rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-[#2F3E4E]"
                      />
                    </div>
                  </div>
                )}
              </div>

              {selectedBank === 'sbi' && (
                <div className="pt-3.5 border-t border-[#2F3E4E]/15 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#2F3E4E]">
                        Cash Tendered (SBI DD Notes)
                      </span>
                      <span className="text-xs font-mono tabular-nums font-bold text-emerald-700">
                        ₹{fmtIn(output.cashTotal) || '0'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleClearCashOnly}
                        disabled={output.cashTotal <= 0}
                        className="text-xs font-semibold text-[#64748B] hover:text-rose-700 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={handleAutoFillSbiDdNotes}
                        className="px-2.5 py-1 rounded-lg border border-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] transition-colors cursor-pointer"
                      >
                        Auto-Split Total
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {SBI_DD_DENOMS.map((d) => {
                      const cnt = parseInt(formState.notes[d] || '0', 10) || 0;
                      const style = DENOM_STYLES[d] || DENOM_STYLES[1];
                      return (
                        <div
                          key={d}
                          className={`flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-xl border transition-colors ${
                            cnt > 0
                              ? 'border-emerald-400 bg-emerald-50/40'
                              : 'border-slate-200 bg-white'
                          }`}
                        >
                          <span
                            className={`px-1.5 py-0.5 text-[11px] font-mono font-bold rounded border ${style.badge}`}
                          >
                            ₹{d}
                          </span>
                          <input
                            type="number"
                            min={0}
                            inputMode="numeric"
                            value={formState.notes[d] || ''}
                            onChange={(e) => updateNoteCount(d, e.target.value)}
                            onFocus={(e) => e.currentTarget.select()}
                            placeholder="0"
                            aria-label={`${d} rupee notes count for SBI DD`}
                            className="w-11 text-center py-0.5 text-xs font-mono font-bold tabular-nums rounded-md border border-slate-300 bg-white focus:border-[#2F3E4E] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <span className="text-[11px] font-mono tabular-nums font-semibold text-slate-600 text-right min-w-[42px]">
                            ₹{fmtIn(cnt * d) || '0'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2.5 px-3 py-2 rounded-xl border border-slate-200 bg-white">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 text-[11px] font-mono font-bold rounded border border-amber-200 bg-amber-50 text-amber-900">
                        Coins / P.
                      </span>
                      <span className="text-[11px] text-[#64748B]">
                        Optional fractional paise (₹)
                      </span>
                    </div>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={formState.coins}
                      onChange={(e) => updateField('coins', e.target.value)}
                      onFocus={(e) => e.currentTarget.select()}
                      placeholder="0.00"
                      aria-label="Coins or paise amount for SBI DD"
                      className="w-24 text-right px-2.5 py-1 text-xs font-mono font-bold tabular-nums rounded-lg border border-slate-300 bg-white focus:border-[#2F3E4E] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                  {ddCashMismatch && (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-300 text-xs text-rose-800 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span>{output.warning}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* RTGS / NEFT BODY */}
          {formType === 'rtgs' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-sm font-extrabold text-[#2F3E4E]">
                  Beneficiary &amp; Remittance Details
                </h2>
                <span className="text-sm font-bold font-mono tabular-nums text-emerald-700">
                  Total: ₹{output.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#475569] mb-1">
                    Transfer System
                  </label>
                  <select
                    value={formState.rtgsType}
                    onChange={(e) =>
                      updateField('rtgsType', e.target.value as BankFormState['rtgsType'])
                    }
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-[#2F3E4E]"
                  >
                    <option value="rtgs">RTGS (≥ ₹2 Lakh)</option>
                    <option value="neft">NEFT</option>
                    {selectedBank === 'hdfc' && <option value="">Auto / Un-ticked</option>}
                  </select>
                </div>

                {selectedBank === 'sbi' ? (
                  <div>
                    <label className="block text-xs font-semibold text-[#475569] mb-1">
                      By Way Of
                    </label>
                    <select
                      value={formState.rtgsMode}
                      onChange={(e) =>
                        updateField('rtgsMode', e.target.value as 'chq' | 'trf')
                      }
                      className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-[#2F3E4E]"
                    >
                      <option value="chq">Cheque (NEFT/RTGS)</option>
                      <option value="trf">Transfer (only NEFT)</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-[#475569] mb-1">
                      Request Time
                    </label>
                    <input
                      type="text"
                      value={formState.rtgsTime}
                      onChange={(e) => updateField('rtgsTime', e.target.value)}
                      placeholder="HH:MM AM/PM"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-[#2F3E4E]"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-[#475569] mb-1">
                    Cheque No. &amp; Date
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      type="text"
                      value={formState.rtgsChequeNo}
                      onChange={(e) => updateField('rtgsChequeNo', e.target.value)}
                      placeholder="Chq No."
                      className="w-full px-2.5 py-2 text-xs font-mono rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-[#2F3E4E]"
                    />
                    <input
                      type="date"
                      value={formState.rtgsChequeDate}
                      onChange={(e) => updateField('rtgsChequeDate', e.target.value)}
                      className="w-full px-1.5 py-2 text-[11px] font-mono rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-[#2F3E4E]"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#475569] mb-1">
                    Beneficiary Name *
                  </label>
                  <input
                    type="text"
                    value={formState.rtgsBenName}
                    onChange={(e) => updateField('rtgsBenName', e.target.value)}
                    placeholder="Receiver's name as per bank"
                    className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-[#2F3E4E]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#475569] mb-1">
                    Beneficiary Bank &amp; Branch *
                  </label>
                  <input
                    type="text"
                    value={formState.rtgsBenBank}
                    onChange={(e) => updateField('rtgsBenBank', e.target.value)}
                    placeholder="Beneficiary bank & branch"
                    className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-[#2F3E4E]"
                  />
                </div>
              </div>

              {selectedBank === 'hdfc' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#475569] mb-1">
                      Beneficiary Contact No.
                    </label>
                    <input
                      type="tel"
                      value={formState.rtgsBenContact}
                      onChange={(e) => updateField('rtgsBenContact', e.target.value)}
                      placeholder="10-digit mobile or landline"
                      className="w-full px-3.5 py-2 text-xs font-mono rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-[#2F3E4E]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#475569] mb-1">
                      Beneficiary Address
                    </label>
                    <input
                      type="text"
                      value={formState.rtgsBenAddress}
                      onChange={(e) => updateField('rtgsBenAddress', e.target.value)}
                      placeholder="City / office address"
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-[#2F3E4E]"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#475569] mb-1">
                    11-Digit IFSC Code *
                  </label>
                  <input
                    type="text"
                    maxLength={11}
                    value={formState.rtgsBenIfsc}
                    onChange={(e) =>
                      updateField('rtgsBenIfsc', e.target.value.toUpperCase())
                    }
                    placeholder="11-character IFSC"
                    className="w-full px-3 py-2 text-xs sm:text-sm font-mono font-bold uppercase rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-[#2F3E4E]"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-[#475569]">
                      Beneficiary A/c No. *
                    </label>
                    <span
                      className={`text-[10px] font-mono tabular-nums ${
                        formState.rtgsBenAccount.length > benBoxLimit
                          ? 'text-rose-700 font-bold'
                          : 'text-[#64748B]'
                      }`}
                    >
                      {formState.rtgsBenAccount.length}/{benBoxLimit} boxes
                    </span>
                  </div>
                  <input
                    type="text"
                    maxLength={20}
                    value={formState.rtgsBenAccount}
                    onChange={(e) => updateField('rtgsBenAccount', e.target.value.replace(/\s+/g, ''))}
                    placeholder="Destination account"
                    className="w-full px-3 py-2 text-xs sm:text-sm font-mono font-bold rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-[#2F3E4E]"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-[#475569]">
                      Re-Confirm A/c No.
                    </label>
                    {formState.rtgsBenAccount && !formState.rtgsBenAccountConfirm && (
                      <button
                        type="button"
                        onClick={() => updateField('rtgsBenAccountConfirm', formState.rtgsBenAccount)}
                        className="text-[10px] font-bold text-[#2F3E4E] underline cursor-pointer"
                      >
                        Copy A/c
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    maxLength={20}
                    value={formState.rtgsBenAccountConfirm}
                    onChange={(e) =>
                      updateField('rtgsBenAccountConfirm', e.target.value.replace(/\s+/g, ''))
                    }
                    placeholder="Re-enter A/c No."
                    className="w-full px-3 py-2 text-xs sm:text-sm font-mono font-bold rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-[#2F3E4E]"
                  />
                </div>
              </div>

              {output.warning && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-300 text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{output.warning}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#475569] mb-1">
                    Remittance Amount (₹) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formState.rtgsAmount}
                    onChange={(e) => updateField('rtgsAmount', e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3.5 py-2 text-sm font-mono font-bold rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-[#2F3E4E]"
                  />
                </div>
                {selectedBank === 'sbi' ? (
                  <div>
                    <label className="block text-xs font-semibold text-[#475569] mb-1">
                      Bank Charges (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={formState.rtgsCharges}
                      onChange={(e) => updateField('rtgsCharges', e.target.value)}
                      placeholder="0"
                      className="w-full px-3.5 py-2 text-sm font-mono rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-[#2F3E4E]"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-[#475569] mb-1">
                      Purpose of Remittance
                    </label>
                    <input
                      type="text"
                      value={formState.rtgsPurpose}
                      onChange={(e) => updateField('rtgsPurpose', e.target.value)}
                      placeholder="Purpose of remittance"
                      className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-[#2F3E4E]"
                    />
                  </div>
                )}
              </div>

              {selectedBank === 'hdfc' && (
                <div>
                  <label className="block text-xs font-semibold text-[#475569] mb-1">
                    Remarks
                  </label>
                  <input
                    type="text"
                    value={formState.rtgsRemarks}
                    onChange={(e) => updateField('rtgsRemarks', e.target.value)}
                    placeholder="Additional narration printed on HDFC Remarks line"
                    className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-[#2F3E4E]"
                  />
                </div>
              )}

              {selectedBank === 'hdfc' && (
                <div className="p-3.5 rounded-xl border-[1.5px] border-[#2F3E4E]/25 bg-[#FEF2C8]/45 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="block text-xs font-extrabold text-[#2F3E4E]">
                        Beneficiary Bank Account Name Verification (BANV) *
                      </span>
                      <span className="block text-[11px] text-[#64748B]">
                        Select either Option 1 or Option 2 to tick on your HDFC RTGS/NEFT slip (Not applicable for Indo-Nepal Remittance)
                      </span>
                    </div>
                    {formState.rtgsBanv !== '' && (
                      <button
                        type="button"
                        onClick={() => updateField('rtgsBanv', '')}
                        className="text-[11px] font-semibold text-[#64748B] hover:text-[#2F3E4E] underline cursor-pointer shrink-0"
                      >
                        Leave Un-ticked
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateField('rtgsBanv', formState.rtgsBanv === '1' ? '' : '1')
                      }
                      aria-pressed={formState.rtgsBanv === '1'}
                      className={`w-full text-left p-3 rounded-xl border-[1.5px] transition flex items-start gap-2.5 cursor-pointer ${
                        formState.rtgsBanv === '1'
                          ? 'bg-[#FFFDF5] border-[#2F3E4E] shadow-[0_2px_0_#2F3E4E]'
                          : 'bg-white border-slate-300 hover:border-[#2F3E4E]/60'
                      }`}
                    >
                      <span
                        className={`mt-0.5 w-4 h-4 rounded border-[1.5px] flex items-center justify-center shrink-0 ${
                          formState.rtgsBanv === '1'
                            ? 'bg-[#2F3E4E] border-[#2F3E4E] text-white'
                            : 'bg-white border-slate-400'
                        }`}
                      >
                        {formState.rtgsBanv === '1' && <Check className="w-3 h-3" strokeWidth={3} />}
                      </span>
                      <span className="space-y-0.5">
                        <span className="block text-xs font-bold text-[#2F3E4E]">
                          Option 1 – HDFC Bank to verify the beneficiary bank account name
                        </span>
                        <span className="block text-[11px] text-[#475569] leading-snug">
                          HDFC Bank will verify the beneficiary&apos;s bank account name and cancel the transaction if verification fails or mismatches.
                        </span>
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        updateField('rtgsBanv', formState.rtgsBanv === '2' ? '' : '2')
                      }
                      aria-pressed={formState.rtgsBanv === '2'}
                      className={`w-full text-left p-3 rounded-xl border-[1.5px] transition flex items-start gap-2.5 cursor-pointer ${
                        formState.rtgsBanv === '2'
                          ? 'bg-[#FFFDF5] border-[#2F3E4E] shadow-[0_2px_0_#2F3E4E]'
                          : 'bg-white border-slate-300 hover:border-[#2F3E4E]/60'
                      }`}
                    >
                      <span
                        className={`mt-0.5 w-4 h-4 rounded border-[1.5px] flex items-center justify-center shrink-0 ${
                          formState.rtgsBanv === '2'
                            ? 'bg-[#2F3E4E] border-[#2F3E4E] text-white'
                            : 'bg-white border-slate-400'
                        }`}
                      >
                        {formState.rtgsBanv === '2' && <Check className="w-3 h-3" strokeWidth={3} />}
                      </span>
                      <span className="space-y-0.5">
                        <span className="block text-xs font-bold text-[#2F3E4E]">
                          Option 2 – Beneficiary bank account name is verified by the customer/remitter
                        </span>
                        <span className="block text-[11px] text-[#475569] leading-snug">
                          I/We have verified the beneficiary A/c No. &amp; IFSC and authorise transfer at my/our own risk even if Bank name verification fails.
                        </span>
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {selectedBank === 'hdfc' && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowHdfcRtgsCompliance((v) => !v)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2F3E4E] hover:opacity-80 cursor-pointer"
                  >
                    {showHdfcRtgsCompliance ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {showHdfcRtgsCompliance ? 'Hide' : 'Show'} HDFC Beneficiary A/c Type, LEI (₹50 Cr+) &amp; Non-Customer Options
                    </span>
                  </button>

                  {showHdfcRtgsCompliance && (
                    <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="sm:col-span-2">
                        <label className="block font-medium text-[#475569] mb-1">
                          Beneficiary A/c Type
                        </label>
                        <select
                          value={formState.rtgsBenAcType}
                          onChange={(e) =>
                            updateField(
                              'rtgsBenAcType',
                              e.target.value as BankFormState['rtgsBenAcType']
                            )
                          }
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                        >
                          <option value="">(none)</option>
                          <option value="res">Resident</option>
                          <option value="nr">Non Resident</option>
                          <option value="fcra">FCRA</option>
                        </select>
                      </div>
                      <div>
                        <label className="block font-medium text-[#475569] mb-1">
                          Remitter LEI (20 chars)
                        </label>
                        <input
                          type="text"
                          maxLength={20}
                          value={formState.rtgsLei}
                          onChange={(e) =>
                            updateField('rtgsLei', e.target.value.toUpperCase())
                          }
                          placeholder="₹50 Cr+ only"
                          className="w-full px-3 py-1.5 font-mono uppercase rounded-lg border border-slate-300 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-[#475569] mb-1">
                          Remitter LEI Expiry Date
                        </label>
                        <input
                          type="date"
                          value={formState.rtgsLeiExpiry}
                          onChange={(e) =>
                            updateField('rtgsLeiExpiry', e.target.value)
                          }
                          className="w-full px-3 py-1.5 font-mono rounded-lg border border-slate-300 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-[#475569] mb-1">
                          Beneficiary LEI (20 chars)
                        </label>
                        <input
                          type="text"
                          maxLength={20}
                          value={formState.rtgsBenLei}
                          onChange={(e) =>
                            updateField('rtgsBenLei', e.target.value.toUpperCase())
                          }
                          placeholder="₹50 Cr+ only"
                          className="w-full px-3 py-1.5 font-mono uppercase rounded-lg border border-slate-300 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-[#475569] mb-1">
                          Beneficiary LEI Expiry Date
                        </label>
                        <input
                          type="date"
                          value={formState.rtgsBenLeiExpiry}
                          onChange={(e) =>
                            updateField('rtgsBenLeiExpiry', e.target.value)
                          }
                          className="w-full px-3 py-1.5 font-mono rounded-lg border border-slate-300 bg-white"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block font-medium text-[#475569] mb-1">
                          Non-HDFC Customer Cash Deposited (₹)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={formState.rtgsNonHdfcCash}
                          onChange={(e) =>
                            updateField('rtgsNonHdfcCash', e.target.value)
                          }
                          placeholder="Only if remitter does not hold an HDFC account (up to ₹50,000)"
                          className="w-full px-3 py-1.5 font-mono rounded-lg border border-slate-300 bg-white"
                        />
                      </div>
                      <div className={formState.rtgsNepalPurpose === 'others' ? '' : 'sm:col-span-2'}>
                        <label className="block font-medium text-[#475569] mb-1">
                          Purpose of Remittance to Nepal (Indo-NEFT)
                        </label>
                        <select
                          value={formState.rtgsNepalPurpose || ''}
                          onChange={(e) =>
                            updateField(
                              'rtgsNepalPurpose',
                              e.target.value as NonNullable<BankFormState['rtgsNepalPurpose']>
                            )
                          }
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                        >
                          <option value="">(Not applicable / Domestic NEFT-RTGS)</option>
                          <option value="family">Family Maintenance</option>
                          <option value="retirement">Retirement Fund</option>
                          <option value="pension">Pension Fund</option>
                          <option value="others">Others (Specify)</option>
                        </select>
                      </div>
                      {formState.rtgsNepalPurpose === 'others' && (
                        <div>
                          <label className="block font-medium text-[#475569] mb-1">
                            Specify Other Nepal Purpose
                          </label>
                          <input
                            type="text"
                            maxLength={40}
                            value={formState.rtgsNepalPurposeOther || ''}
                            onChange={(e) =>
                              updateField('rtgsNepalPurposeOther', e.target.value)
                            }
                            placeholder="e.g. Medical / Education"
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Shared Live Amount in Words Box */}
          <div className="pt-4 border-t border-[#2F3E4E]/15">
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <span className="text-xs font-bold text-[#2F3E4E]">Amount in Words</span>
              {amountWordsText && (
                <button
                  type="button"
                  onClick={handleCopyWords}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#2F3E4E] hover:underline cursor-pointer"
                >
                  {copiedWords ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" aria-hidden="true" />
                      <span className="text-emerald-700">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" aria-hidden="true" />
                      <span>Copy Words</span>
                    </>
                  )}
                </button>
              )}
            </div>
            <div className="px-4 py-3 rounded-xl border border-[#2F3E4E]/25 bg-[#FEF2C8]/50 text-sm font-medium text-[#2F3E4E] min-h-[46px] flex flex-wrap items-center justify-between gap-3">
              <span
                className={
                  amountWordsText
                    ? 'text-[#2F3E4E] font-semibold leading-snug'
                    : 'text-[#64748B] font-normal text-xs'
                }
              >
                {amountWordsText ||
                  'Rupees in words will appear automatically as you enter numbers...'}
              </span>
              {formType === 'deposit' &&
                formState.depositMode === 'both' &&
                output.grandTotal > 0 && (
                  <span className="text-xs font-mono tabular-nums font-bold text-emerald-700 shrink-0">
                    Grand Total: ₹{fmtIn(output.grandTotal)}
                  </span>
                )}
            </div>
          </div>
        </div>
      </div>

      {/* FULL-WIDTH LIVE OFFICIAL BANK SLIP PREVIEW */}
      <div className="space-y-4 print:mt-0 print:space-y-0">
        {/* Preview Control Header */}
        <div className="bg-[#FFFDF5] p-4 rounded-2xl border-[1.5px] border-[#2F3E4E] shadow-[0_4px_0_#2F3E4E] flex flex-wrap items-center justify-between gap-3 no-print">
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-extrabold uppercase tracking-wider text-[#2F3E4E]">
                Official Bank Slip Preview
              </span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span className="font-mono tabular-nums text-[#475569]">
                A4 {output.orientation} · {Math.round(previewScale * 100)}% zoom
              </span>
            </div>
            <div className="text-sm font-bold text-[#2F3E4E]">{output.title}</div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              aria-label="Preview mode"
              value={previewMode}
              onChange={(e) => setPreviewMode(e.target.value as PreviewMode)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border-[1.5px] border-[#2F3E4E] bg-white text-[#2F3E4E] focus:outline-none"
            >
              <option value="full">Full form (blank A4 paper)</option>
              <option value="data">Entries only (pre-printed slip)</option>
            </select>

            {output.backHtml !== null && (
              <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2F3E4E] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeReverse}
                  onChange={(e) => setIncludeReverse(e.target.checked)}
                  className="rounded border-slate-400 text-[#2F3E4E]"
                />
                <span>Include backside (front + back)</span>
              </label>
            )}

            <button
              type="button"
              onClick={handleDownloadBlankPdf}
              disabled={isExportingBlank}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] rounded-lg transition-colors whitespace-nowrap cursor-pointer disabled:opacity-60"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExportingBlank ? 'Exporting...' : 'Download Blank A4 PDF'}</span>
            </button>
          </div>
        </div>

        {/* Preview Canvas */}
        <div ref={previewStageRef} className="w-full min-w-0">
          <div ref={printableSlipRef} className="printable-area bank-slip-printable space-y-5 print:space-y-0">
            <div>
              {includeReverse && output.backHtml && (
                <div className="text-xs font-bold text-[#475569] mb-1.5 text-center no-print">
                  Front Side · Printed as Page 1
                </div>
              )}
              <div
                className="bank-slip-sheet-wrap box-content bg-white border-[1.5px] border-[#2F3E4E] shadow-md rounded-xl overflow-hidden mx-auto"
                style={{
                  width: `${Math.ceil(output.width * previewScale)}px`,
                  height: `${Math.ceil(output.height * previewScale)}px`,
                }}
              >
                <div
                  className={`bank-slip ${output.fontClass} ${
                    previewMode === 'data' ? 'dataonly' : ''
                  }`}
                  style={{
                    width: `${output.width}px`,
                    height: `${output.height}px`,
                    transform: `scale(${previewScale})`,
                    transformOrigin: 'top left',
                  }}
                  dangerouslySetInnerHTML={{ __html: output.frontHtml }}
                />
              </div>
            </div>

            {includeReverse && output.backHtml && (
              <div className="bank-slip-print-page-break">
                <div className="text-xs font-bold text-[#475569] mb-1.5 text-center no-print">
                  Back Side (Reverse / Overleaf) · Printed as Page 2
                  {previewMode === 'data' && (
                    <span className="ml-2 font-normal text-amber-800">
                      (Pre-printed mode hides reverse form ink)
                    </span>
                  )}
                </div>
                <div
                  className="bank-slip-sheet-wrap box-content bg-white border-[1.5px] border-[#2F3E4E] shadow-md rounded-xl overflow-hidden mx-auto"
                  style={{
                    width: `${Math.ceil(output.width * previewScale)}px`,
                    height: `${Math.ceil(output.height * previewScale)}px`,
                  }}
                >
                  <div
                    className={`bank-slip ${output.backFontClass ?? output.fontClass} ${
                      previewMode === 'data' ? 'dataonly' : ''
                    }`}
                    style={{
                      width: `${output.width}px`,
                      height: `${output.height}px`,
                      transform: `scale(${previewScale})`,
                      transformOrigin: 'top left',
                    }}
                    dangerouslySetInnerHTML={{ __html: output.backHtml }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lazy-Loaded Bulk Excel Modal */}
      {showBulkModal && (
        <Suspense fallback={null}>
          <BulkSlipModal
            isOpen={showBulkModal}
            onClose={() => setShowBulkModal(false)}
            bankId={selectedBank}
            formType={formType}
            previewMode={previewMode}
            initialIncludeReverse={includeReverse}
            onLoadRecordIntoEditor={handleLoadRecordIntoEditor}
          />
        </Suspense>
      )}
    </div>
  );
};
