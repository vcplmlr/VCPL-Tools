import React, { useEffect, useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import {
  AlertTriangle,
  BookmarkPlus,
  CheckCircle2,
  Clock,
  CopyPlus,
  Download,
  FileText,
  FolderOpen,
  HardDrive,
  Printer,
  RotateCcw,
  Save,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { ToolCatalogItem } from '../../types/tools';
import {
  downloadJsonBackup,
  formatShortSavedTime,
  readJsonFile,
  safeReadStorage,
  safeRemoveStorage,
  safeWriteStorage,
} from '../../utils/browserVault';
import { FileDropZone } from './FileDropZone';

interface RentPaymentLetterMakerViewProps {
  tool?: ToolCatalogItem;
  onBack?: () => void;
}

type AmountMode = 'taxable' | 'total' | 'net';
type TdsBasis = 'base' | 'gross';
type GstType = 'cs' | 'i' | 'n';
type RoundingMode = 'ceil' | 'round' | 'none';

interface RentLetterFormState {
  lhtop: string;
  lhbot: string;
  ldate: string;
  month: string;
  mode: AmountMode;
  rent: string;
  pdate: string;
  ref: string;
  tdsr: string;
  gstr: string;
  tbasis: TdsBasis;
  gtype: GstType;
  rnd: RoundingMode;
  lname: string;
  laddr: string;
  lpan: string;
  lgst: string;
  bname: string;
  lbank: string;
  co: string;
  ctan: string;
  cgst: string;
  pbank: string;
  sig: string;
}

interface RentLetterProfile {
  id: string;
  name: string;
  updatedAt: string;
  defaults: Partial<RentLetterFormState>;
}

interface RentLetterHistoryItem {
  id: string;
  savedAt: string;
  monthLabel: string;
  landlordName: string;
  companyName: string;
  netAmount: number;
  refNo: string;
  snapshot: RentLetterFormState;
}

interface RentVaultBackupPayload {
  app: 'vcpl-rent-letter-vault';
  version: 2;
  exportedAt: string;
  draft?: RentLetterFormState;
  profiles?: RentLetterProfile[];
  history?: RentLetterHistoryItem[];
}

const LEGACY_STORAGE_KEY = 'rentLetterSaved2';
const DRAFT_STORAGE_KEY = 'vcpl_rent_letter_draft_v2';
const PROFILES_STORAGE_KEY = 'vcpl_rent_letter_profiles_v1';
const HISTORY_STORAGE_KEY = 'vcpl_rent_letter_history_v1';

const LEGACY_PREFILL_VALUES = new Set([
  'Mr.N Raviraj Shetty',
  'D.No:-15-4-199/2(49),\nFlat No.1201, Westwind Apartment,\nCollectors Gate, Balmatta,\nKankanady, Mangalore.',
  'Raviraj N Shetty',
  'Varsha Cars Private Limited',
  'State bank of India, Nagole Branch, Hyderabad',
]);

const PROFILE_KEYS: Array<keyof RentLetterFormState> = [
  'lhtop',
  'lhbot',
  'mode',
  'tdsr',
  'gstr',
  'tbasis',
  'gtype',
  'rnd',
  'lname',
  'laddr',
  'lpan',
  'lgst',
  'bname',
  'lbank',
  'co',
  'ctan',
  'cgst',
  'pbank',
  'sig',
];

function getTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function getDefaultState(): RentLetterFormState {
  return {
    lhtop: '45',
    lhbot: '18',
    ldate: getTodayIso(),
    month: '',
    mode: 'taxable',
    rent: '',
    pdate: '',
    ref: '',
    tdsr: '10',
    gstr: '18',
    tbasis: 'base',
    gtype: 'cs',
    rnd: 'ceil',
    lname: '',
    laddr: '',
    lpan: '',
    lgst: '',
    bname: '',
    lbank: '',
    co: '',
    ctan: '',
    cgst: '',
    pbank: '',
    sig: '',
  };
}

function loadInitialFormState(): RentLetterFormState {
  const base = getDefaultState();
  const savedDraft = safeReadStorage<Partial<RentLetterFormState> | null>(DRAFT_STORAGE_KEY, null);
  if (savedDraft && typeof savedDraft === 'object') {
    for (const k of Object.keys(base) as Array<keyof RentLetterFormState>) {
      const val = savedDraft[k];
      if (typeof val === 'string' && !LEGACY_PREFILL_VALUES.has(val)) {
        (base[k] as string) = val;
      }
    }
    if (!base.ldate) base.ldate = getTodayIso();
    return base;
  }

  // Migrate non-prefill user fields from legacy localStorage key if present
  const legacy = safeReadStorage<Partial<Record<keyof RentLetterFormState, string>> | null>(
    LEGACY_STORAGE_KEY,
    null
  );
  if (legacy && typeof legacy === 'object') {
    for (const k of PROFILE_KEYS) {
      const val = legacy[k];
      if (typeof val === 'string' && !LEGACY_PREFILL_VALUES.has(val)) {
        (base[k] as string) = val;
      }
    }
  }
  return base;
}

function dmy(v: string): string {
  if (!v) return '__-__-____';
  const parts = v.split('-');
  if (parts.length !== 3) return v;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function r2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function inr(n: number): string {
  const rounded = r2(n);
  return rounded.toLocaleString('en-IN', {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function applyRounding(n: number, mode: RoundingMode): number {
  if (mode === 'ceil') return Math.ceil(n - 1e-9);
  if (mode === 'round') return Math.round(n);
  return r2(n);
}

function amountInWords(n: number): string {
  const a = [
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
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (x: number) => (x < 20 ? a[x] : b[Math.floor(x / 10)] + (x % 10 ? ` ${a[x % 10]}` : ''));
  const hundred = (x: number) =>
    (x > 99 ? `${a[Math.floor(x / 100)]} Hundred${x % 100 ? ' ' : ''}` : '') +
    (x % 100 ? two(x % 100) : '');

  let r = Math.max(0, Math.floor(n));
  const p = Math.max(0, Math.round((n - Math.floor(n)) * 100));
  const out: string[] = [];
  const units: Array<[number, string]> = [
    [1e7, 'Crore'],
    [1e5, 'Lakh'],
    [1e3, 'Thousand'],
  ];
  for (const [div, label] of units) {
    const q = Math.floor(r / div);
    if (q) {
      out.push(`${hundred(q)} ${label}`);
      r %= div;
    }
  }
  if (r) out.push(hundred(r));
  return `Rupees ${out.join(' ') || 'Zero'}${p ? ` and ${two(p)} Paise` : ''} Only`;
}

interface CheckItem {
  kind: 'ok' | 'w' | 'e' | 'f';
  text: string;
}

export const RentPaymentLetterMakerView: React.FC<RentPaymentLetterMakerViewProps> = ({ tool }) => {
  const [form, setForm] = useState<RentLetterFormState>(() => loadInitialFormState());
  const [profiles, setProfiles] = useState<RentLetterProfile[]>(() =>
    safeReadStorage<RentLetterProfile[]>(PROFILES_STORAGE_KEY, [])
  );
  const [history, setHistory] = useState<RentLetterHistoryItem[]>(() =>
    safeReadStorage<RentLetterHistoryItem[]>(HISTORY_STORAGE_KEY, [])
  );
  const [activeProfileId, setActiveProfileId] = useState<string>('');
  const [newProfileName, setNewProfileName] = useState<string>('');
  const [vaultOpen, setVaultOpen] = useState<boolean>(true);
  const [confirmWipeVault, setConfirmWipeVault] = useState<boolean>(false);
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<string>(() => new Date().toISOString());
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const sigFileInputRef = useRef<HTMLInputElement | null>(null);
  const backupFileInputRef = useRef<HTMLInputElement | null>(null);
  const previewStageRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [previewScale, setPreviewScale] = useState(0.8);
  const [sheetHeightPx, setSheetHeightPx] = useState(1123);

  // Instant browser-only auto-save for every change
  useEffect(() => {
    const ok = safeWriteStorage(DRAFT_STORAGE_KEY, form);
    if (ok) {
      setLastAutoSavedAt(new Date().toISOString());
    }
  }, [form]);

  // Persist profiles strictly in user's browser
  useEffect(() => {
    safeWriteStorage(PROFILES_STORAGE_KEY, profiles);
  }, [profiles]);

  // Persist monthly history strictly in user's browser
  useEffect(() => {
    safeWriteStorage(HISTORY_STORAGE_KEY, history);
  }, [history]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    const A4_WIDTH_PX = 794;
    const stageEl = previewStageRef.current;
    const sheetEl = sheetRef.current;

    const updateMetrics = () => {
      if (stageEl) {
        const available = stageEl.clientWidth - 24;
        if (available > 0) {
          const widthScale = available / A4_WIDTH_PX;
          const isDesktopSplit = typeof window !== 'undefined' && window.innerWidth >= 1024;
          const heightScale = isDesktopSplit
            ? Math.max(460, window.innerHeight - 195) / 1123
            : 1;
          setPreviewScale(Math.min(1, Math.max(0.28, Math.min(widthScale, heightScale))));
        }
      }
      if (sheetEl) {
        const h = sheetEl.offsetHeight;
        if (h > 0) setSheetHeightPx(h);
      }
    };

    updateMetrics();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateMetrics);
      return () => window.removeEventListener('resize', updateMetrics);
    }

    let rafId = 0;
    const scheduleUpdate = () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        updateMetrics();
      });
    };
    const ro = new ResizeObserver(scheduleUpdate);
    if (stageEl) ro.observe(stageEl);
    if (sheetEl) ro.observe(sheetEl);
    window.addEventListener('resize', scheduleUpdate);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      ro.disconnect();
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, []);

  const updateField = <K extends keyof RentLetterFormState>(
    key: K,
    value: RentLetterFormState[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const calc = useMemo(() => {
    const amt = parseFloat(form.rent) || 0;
    const t = (parseFloat(form.tdsr) || 0) / 100;
    const g = form.gtype === 'n' ? 0 : (parseFloat(form.gstr) || 0) / 100;
    const gb = form.tbasis === 'gross';
    let base = amt;
    if (form.mode === 'total') {
      base = amt / (1 + g);
    } else if (form.mode === 'net') {
      const denom = gb ? (1 + g) * (1 - t) : 1 - t + g;
      base = denom !== 0 ? amt / denom : 0;
    }
    base = r2(base);
    const gst = applyRounding(base * g, form.rnd);
    const gross = r2(base + gst);
    const tds = applyRounding((gb ? gross : base) * t, form.rnd);
    const net = r2(gross - tds);
    return { amt, t, g, base, gst, gross, tds, net, gb, mode: form.mode };
  }, [form.rent, form.tdsr, form.gstr, form.gtype, form.tbasis, form.mode, form.rnd]);

  const checks = useMemo<CheckItem[]>(() => {
    const items: CheckItem[] = [];
    if (!calc.amt) {
      items.push({ kind: 'w', text: 'Enter the rent amount.' });
    } else {
      const modeLabel: Record<AmountMode, string> = {
        taxable: 'Taxable rent',
        total: 'Total incl. GST',
        net: 'Net payable',
      };
      items.push({
        kind: 'ok',
        text: `Entered as ${modeLabel[calc.mode]} ₹${inr(calc.amt)} → taxable rent ₹${inr(calc.base)}`,
      });
      if (calc.mode !== 'taxable') {
        items.push({
          kind: 'w',
          text: 'Taxable rent was back-calculated; confirm it matches the agreement.',
        });
      }
      items.push({
        kind: 'ok',
        text: `GST ${inr(calc.g * 100)}% on ₹${inr(calc.base)} = ₹${inr(calc.gst)}`,
      });
      items.push({
        kind: 'ok',
        text: `TDS ${inr(calc.t * 100)}% on ${calc.gb ? 'rent+GST' : 'taxable rent'} ₹${inr(
          calc.gb ? calc.gross : calc.base
        )} = ₹${inr(calc.tds)}`,
      });
      items.push({
        kind: 'f',
        text: `Net = ${inr(calc.base)} + ${inr(calc.gst)} − ${inr(calc.tds)} = ${inr(calc.net)}`,
      });
      if (Math.abs(calc.net - (calc.base + calc.gst - calc.tds)) > 0.005) {
        items.push({ kind: 'e', text: 'Net does not reconcile.' });
      }
      if (calc.gb) {
        items.push({
          kind: 'w',
          text: 'TDS on GST-inclusive amount: normally TDS u/s 194-I is on rent excl. GST when GST is shown separately.',
        });
      }
      if (calc.t > 0 && calc.t !== 0.1 && calc.t !== 0.02) {
        items.push({
          kind: 'w',
          text: 'TDS rate is not 10% (land/building) or 2% (plant/machinery).',
        });
      }
      if (form.gtype === 'i' && calc.g && (parseFloat(form.gstr) || 0) % 2 === 1) {
        items.push({ kind: 'w', text: 'Check IGST rate.' });
      }
    }

    if (!form.lname.trim()) items.push({ kind: 'w', text: 'Landlord name is empty.' });
    if (!form.co.trim()) items.push({ kind: 'w', text: 'Company / Tenant name is empty.' });
    if (!form.ref.trim()) items.push({ kind: 'w', text: 'Bank Ref No is empty.' });
    if (!form.pdate) items.push({ kind: 'w', text: 'Payment date is empty.' });
    if (!form.month.trim()) items.push({ kind: 'w', text: 'Rent month is empty.' });
    if (form.lpan.trim() && !/^[A-Z]{5}\d{4}[A-Z]$/i.test(form.lpan.trim())) {
      items.push({ kind: 'e', text: 'PAN format looks wrong.' });
    }
    if (
      form.lgst.trim() &&
      !/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/i.test(form.lgst.trim())
    ) {
      items.push({ kind: 'e', text: 'Landlord GSTIN format looks wrong.' });
    }
    if (
      form.cgst.trim() &&
      !/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/i.test(form.cgst.trim())
    ) {
      items.push({ kind: 'e', text: 'Company GSTIN format looks wrong.' });
    }
    if (form.ctan.trim() && !/^[A-Z]{4}\d{5}[A-Z]$/i.test(form.ctan.trim())) {
      items.push({ kind: 'e', text: 'TAN format looks wrong.' });
    }
    if (form.pdate && form.ldate && form.pdate > form.ldate) {
      items.push({ kind: 'w', text: 'Payment date is after the letter date.' });
    }
    return items;
  }, [calc, form]);

  const loadSignatureFile = (file?: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        updateField('sig', reader.result);
        setNotice({ kind: 'ok', text: 'Signature added and auto-saved in your browser.' });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    loadSignatureFile(file);
  };

  const extractProfileDefaults = (
    src: RentLetterFormState
  ): Partial<RentLetterFormState> => {
    const defaults: Partial<RentLetterFormState> = {};
    for (const k of PROFILE_KEYS) {
      Object.assign(defaults, { [k]: src[k] });
    }
    return defaults;
  };

  const handleSaveAsProfile = () => {
    const fallbackName =
      [form.lname.trim(), form.co.trim()].filter(Boolean).join(' — ') ||
      `Profile ${profiles.length + 1}`;
    const label = newProfileName.trim() || fallbackName;
    const profileId = `rp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const nextProfile: RentLetterProfile = {
      id: profileId,
      name: label,
      updatedAt: new Date().toISOString(),
      defaults: extractProfileDefaults(form),
    };
    setProfiles((prev) => [nextProfile, ...prev]);
    setActiveProfileId(profileId);
    setNewProfileName('');
    setNotice({
      kind: 'ok',
      text: `Saved "${label}" in your browser for instant reuse across future months.`,
    });
  };

  const handleUpdateActiveProfile = () => {
    if (!activeProfileId) return;
    const target = profiles.find((p) => p.id === activeProfileId);
    if (!target) return;
    setProfiles((prev) =>
      prev.map((p) =>
        p.id === activeProfileId
          ? {
              ...p,
              updatedAt: new Date().toISOString(),
              defaults: extractProfileDefaults(form),
            }
          : p
      )
    );
    setNotice({
      kind: 'ok',
      text: `Updated saved browser profile "${target.name}".`,
    });
  };

  const handleLoadProfile = (profile: RentLetterProfile) => {
    setForm((prev) => ({
      ...prev,
      ...profile.defaults,
    }));
    setActiveProfileId(profile.id);
    setNotice({
      kind: 'ok',
      text: `Loaded "${profile.name}" from browser storage.`,
    });
  };

  const handleDeleteProfile = (profileId: string) => {
    const target = profiles.find((p) => p.id === profileId);
    setProfiles((prev) => prev.filter((p) => p.id !== profileId));
    if (activeProfileId === profileId) setActiveProfileId('');
    setNotice({
      kind: 'ok',
      text: target ? `Removed profile "${target.name}" from browser.` : 'Profile removed.',
    });
  };

  const handleSaveToHistory = () => {
    if (!form.lname.trim() && !form.rent.trim()) {
      setNotice({
        kind: 'err',
        text: 'Enter landlord details and rent amount before saving to monthly history.',
      });
      return;
    }
    const entry: RentLetterHistoryItem = {
      id: `rh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      savedAt: new Date().toISOString(),
      monthLabel: form.month.trim() || dmy(form.ldate),
      landlordName: form.lname.trim() || 'Unspecified Landlord',
      companyName: form.co.trim() || 'Unspecified Company',
      netAmount: calc.net,
      refNo: form.ref.trim(),
      snapshot: { ...form },
    };
    setHistory((prev) => [entry, ...prev].slice(0, 50));
    setNotice({
      kind: 'ok',
      text: `Saved ${entry.monthLabel} rent letter snapshot to your browser history.`,
    });
  };

  const handleLoadHistorySnapshot = (item: RentLetterHistoryItem, cloneForNextMonth: boolean) => {
    if (cloneForNextMonth) {
      setForm({
        ...item.snapshot,
        ldate: getTodayIso(),
        month: '',
        pdate: '',
        ref: '',
      });
      setNotice({
        kind: 'ok',
        text: `Loaded landlord, company & tax terms from ${item.monthLabel} ready for the new month.`,
      });
    } else {
      setForm({ ...item.snapshot });
      setNotice({
        kind: 'ok',
        text: `Restored ${item.monthLabel} letter from browser history.`,
      });
    }
  };

  const handleDeleteHistoryItem = (id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
  };

  const handleExportVaultBackup = () => {
    const payload: RentVaultBackupPayload = {
      app: 'vcpl-rent-letter-vault',
      version: 2,
      exportedAt: new Date().toISOString(),
      draft: form,
      profiles,
      history,
    };
    const stamp = new Date().toISOString().slice(0, 10);
    downloadJsonBackup(`vcpl-rent-letter-browser-backup-${stamp}.json`, payload);
    setNotice({
      kind: 'ok',
      text: `Exported ${profiles.length} profile(s) & ${history.length} saved letter(s) as .json backup.`,
    });
  };

  const importVaultBackupFile = async (file?: File | null) => {
    if (!file) return;
    try {
      const parsed = await readJsonFile<RentVaultBackupPayload>(file);
      if (!parsed || parsed.app !== 'vcpl-rent-letter-vault') {
        setNotice({
          kind: 'err',
          text: 'Invalid backup file. Choose a VCPL Rent Letter .json backup.',
        });
        return;
      }
      if (Array.isArray(parsed.profiles)) {
        setProfiles(parsed.profiles);
      }
      if (Array.isArray(parsed.history)) {
        setHistory(parsed.history);
      }
      if (parsed.draft && typeof parsed.draft === 'object') {
        setForm({ ...getDefaultState(), ...parsed.draft });
      }
      setNotice({
        kind: 'ok',
        text: 'Restored saved profiles, history, and draft directly into this browser.',
      });
    } catch {
      setNotice({
        kind: 'err',
        text: 'Could not read backup JSON file.',
      });
    }
  };

  const handleImportVaultBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    await importVaultBackupFile(file);
  };

  const handleWipeBrowserVault = () => {
    safeRemoveStorage(DRAFT_STORAGE_KEY);
    safeRemoveStorage(PROFILES_STORAGE_KEY);
    safeRemoveStorage(HISTORY_STORAGE_KEY);
    safeRemoveStorage(LEGACY_STORAGE_KEY);
    setProfiles([]);
    setHistory([]);
    setActiveProfileId('');
    setForm(getDefaultState());
    setConfirmWipeVault(false);
    setNotice({
      kind: 'ok',
      text: 'Cleared all saved Rent Letter data from this browser.',
    });
  };

  const handleResetEntries = () => {
    setForm((prev) => ({
      ...prev,
      ldate: getTodayIso(),
      month: '',
      rent: '',
      pdate: '',
      ref: '',
    }));
    setNotice({
      kind: 'ok',
      text: 'Cleared monthly entries while keeping your landlord & company details.',
    });
  };

  const addressLines = useMemo(
    () =>
      form.laddr
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    [form.laddr]
  );

  const landlordIds = useMemo(() => {
    const list: string[] = [];
    if (form.lpan.trim()) list.push(`PAN: ${form.lpan.trim().toUpperCase()}`);
    if (form.lgst.trim()) list.push(`GSTIN: ${form.lgst.trim().toUpperCase()}`);
    return list.join('   |   ');
  }, [form.lpan, form.lgst]);

  const companyIds = useMemo(() => {
    const list: string[] = [];
    if (form.ctan.trim()) list.push(`TAN: ${form.ctan.trim().toUpperCase()}`);
    if (form.cgst.trim()) list.push(`GSTIN: ${form.cgst.trim().toUpperCase()}`);
    return list.join('   |   ');
  }, [form.ctan, form.cgst]);

  const topSpaceMm = Math.max(0, Math.min(120, parseFloat(form.lhtop) || 0));
  const botSpaceMm = Math.max(0, Math.min(80, parseFloat(form.lhbot) || 0));
  const tdsPctLabel = inr(calc.t * 100);
  const gstPctLabel = inr(calc.g * 100);
  const halfGstPctLabel = inr(calc.g * 50);
  const rentMonthDisplay = form.month.trim() || '____';

  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const handleSavePdf = async () => {
    if (!sheetRef.current || isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
      const imgs = Array.from(sheetRef.current.querySelectorAll('img'));
      await Promise.all(
        imgs.map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                img.onload = () => resolve();
                img.onerror = () => resolve();
              })
        )
      );

      const canvas = await html2canvas(sheetRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        width: 794,
        windowWidth: 794,
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
        onclone: (clonedDoc) => {
          const box = clonedDoc.getElementById('rent-a4-scale-box');
          if (box) {
            box.style.width = '794px';
            box.style.height = 'auto';
            box.style.overflow = 'visible';
          }
          const sheet = clonedDoc.getElementById('rent-a4-sheet');
          if (sheet) {
            sheet.style.transform = 'none';
            sheet.style.border = '0';
            sheet.style.boxShadow = 'none';
            sheet.style.margin = '0';
          }
        },
      });

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidthMm = 210;
      const pageHeightMm = 297;
      const imgData = canvas.toDataURL('image/jpeg', 0.96);
      const renderedHeightMm = (canvas.height * pageWidthMm) / canvas.width;

      if (renderedHeightMm <= pageHeightMm + 3) {
        pdf.addImage(imgData, 'JPEG', 0, 0, pageWidthMm, Math.min(pageHeightMm, renderedHeightMm));
      } else {
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
      }

      const monthSlug = (form.month.trim() || 'Letter').replace(/[^\w-]+/g, '_');
      const fileName = `Rent_Payment_Letter_${monthSlug}.pdf`;
      pdf.save(fileName);
      setNotice({ kind: 'ok', text: `Saved ${fileName} (A4 PDF)` });
    } catch (err) {
      setNotice({
        kind: 'err',
        text: `PDF export failed (${err instanceof Error ? err.message : 'unknown error'}). Use Print (A4) instead.`,
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handlePrint = async () => {
    if (!sheetRef.current) {
      window.print();
      return;
    }
    try {
      const existing = document.getElementById('vcpl-rent-print-frame');
      if (existing?.parentNode) existing.parentNode.removeChild(existing);

      const iframe = document.createElement('iframe');
      iframe.id = 'vcpl-rent-print-frame';
      iframe.setAttribute('aria-hidden', 'true');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);

      const iframeWin = iframe.contentWindow;
      const iframeDoc = iframeWin?.document;
      if (!iframeWin || !iframeDoc) {
        window.print();
        return;
      }

      const monthSlug = (form.month.trim() || 'Letter').replace(/[^\w-]+/g, '_');
      iframeDoc.open();
      iframeDoc.write(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Rent_Payment_Letter_${monthSlug}</title>
    <style>
      @page { size: A4 portrait; margin: 0; }
      * {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      html, body {
        margin: 0;
        padding: 0;
        width: 210mm;
        background: #ffffff;
        color: #000000;
      }
      .vcpl-rent-print-sheet {
        width: 210mm;
        min-height: 296.5mm;
        padding: ${topSpaceMm}mm 20mm ${botSpaceMm}mm;
        font-family: "Times New Roman", Times, serif;
        font-size: 12pt;
        line-height: 1.45;
        color: #000000;
        background: #ffffff;
      }
      table { border-collapse: collapse; }
      p, td, th { overflow-wrap: break-word; }
    </style>
  </head>
  <body>
    <div class="vcpl-rent-print-sheet">${sheetRef.current.innerHTML}</div>
  </body>
</html>`);
      iframeDoc.close();

      if (iframeDoc.fonts?.ready) {
        await Promise.race([
          iframeDoc.fonts.ready,
          new Promise((resolve) => window.setTimeout(resolve, 500)),
        ]);
      }

      const imgs = Array.from(iframeDoc.images);
      if (imgs.length > 0) {
        await Promise.race([
          Promise.all(
            imgs.map((img) =>
              img.complete
                ? Promise.resolve()
                : new Promise<void>((resolve) => {
                    img.onload = () => resolve();
                    img.onerror = () => resolve();
                  })
            )
          ),
          new Promise<void>((resolve) => window.setTimeout(resolve, 1500)),
        ]);
      }

      const cleanup = () => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      };
      iframeWin.addEventListener('afterprint', cleanup, { once: true });
      window.setTimeout(cleanup, 60000);

      iframeWin.focus();
      iframeWin.print();
    } catch {
      window.print();
    }
  };

  return (
    <div className="space-y-6 print:space-y-0">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          html, body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 210mm !important;
            height: 296.5mm !important;
            overflow: hidden !important;
          }
          #rent-a4-stage {
            display: block !important;
            width: 210mm !important;
            padding: 0 !important;
            border: 0 !important;
            background: transparent !important;
            overflow: hidden !important;
            margin: 0 !important;
          }
          #rent-a4-scale-box {
            width: 210mm !important;
            height: 296.5mm !important;
            overflow: hidden !important;
            margin: 0 !important;
          }
          #rent-a4-sheet {
            transform: none !important;
            width: 210mm !important;
            height: 296.5mm !important;
            min-height: 0 !important;
            max-height: 296.5mm !important;
            box-shadow: none !important;
            border: 0 !important;
            margin: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/* VCPL Tool Header Banner */}
      <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 sm:p-6 shadow-[0_4px_0_#2F3E4E] flex flex-wrap items-center justify-between gap-4 no-print">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] shadow-[0_2px_0_#2F3E4E] flex items-center justify-center text-[#2F3E4E] shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#475569]">
              <span className="font-mono font-bold text-[#2F3E4E]">{tool?.code || 'VC-04'}</span>
              <span aria-hidden="true">·</span>
              <span>A4 Letterhead</span>
              <span aria-hidden="true">·</span>
              <span>Reverse TDS &amp; GST Audit</span>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-[#12805C] inline-flex items-center gap-1">
                <HardDrive className="w-3.5 h-3.5" aria-hidden="true" />
                Browser-Only Storage
              </span>
            </div>
            <h1 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] mt-1">
              {tool?.title || 'Rent Payment Letter Maker – Advanced'}
            </h1>
            <p className="text-xs sm:text-sm text-[#475569] mt-0.5">
              Zero server storage. All entries, landlord profiles, signatures &amp; monthly history are saved exclusively inside your browser.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleResetEntries}
            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#FFE1B3] text-xs font-bold text-[#2F3E4E] cursor-pointer transition whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear Month</span>
          </button>
          <button
            type="button"
            onClick={handleSaveToHistory}
            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] cursor-pointer transition whitespace-nowrap shrink-0"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Month</span>
          </button>
          <button
            type="button"
            disabled={isExportingPdf}
            onClick={() => void handleSavePdf()}
            className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#2F3E4E] hover:bg-[#1E293B] text-xs font-display font-extrabold text-[#F9C80E] shadow-[0_2px_0_#1E293B] cursor-pointer transition whitespace-nowrap shrink-0 disabled:opacity-60"
          >
            <Download className="w-4 h-4" />
            <span>{isExportingPdf ? 'Saving PDF...' : 'Save PDF'}</span>
          </button>
          <button
            type="button"
            onClick={() => void handlePrint()}
            className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#F9C80E] hover:bg-[#FFE1B3] shadow-[0_2px_0_#2F3E4E] text-xs font-display font-extrabold text-[#2F3E4E] cursor-pointer transition whitespace-nowrap shrink-0"
          >
            <Printer className="w-4 h-4" />
            <span>Print A4</span>
          </button>
        </div>
      </div>

      {/* Browser-Only Vault: Auto-Save, Profiles, Monthly History & Portable Backup */}
      <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-4 sm:p-5 shadow-[0_4px_0_#2F3E4E] space-y-4 no-print">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <HardDrive className="w-4 h-4 text-[#2F3E4E]" aria-hidden="true" />
            <h2 className="font-display font-extrabold text-sm text-[#2F3E4E]">
              Browser Storage Vault
            </h2>
            <span className="text-xs text-[#12805C] font-semibold inline-flex items-center gap-1 tabular-nums">
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              Auto-saved in this browser ({formatShortSavedTime(lastAutoSavedAt)})
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={backupFileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImportVaultBackup}
              className="hidden"
            />
            <button
              type="button"
              onClick={handleExportVaultBackup}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Backup (.json)</span>
            </button>
            <FileDropZone
              accept=".json,application/json"
              multiple={false}
              onFiles={(files) => {
                if (files[0]) void importVaultBackupFile(files[0]);
              }}
              className="inline-flex rounded-lg transition"
            >
              <button
                type="button"
                onClick={() => backupFileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-[1.5px] border-dashed border-[#2F3E4E] bg-white hover:bg-[#CEE5DC] text-xs font-bold text-[#2F3E4E] cursor-pointer whitespace-nowrap"
                title="Click or drag & drop a .json backup file"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Drop or Restore Backup</span>
              </button>
            </FileDropZone>
            <button
              type="button"
              onClick={() => setVaultOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] cursor-pointer whitespace-nowrap"
            >
              <span>{vaultOpen ? 'Hide Vault' : `Show Vault (${profiles.length} Profiles · ${history.length} Months)`}</span>
            </button>
          </div>
        </div>

        {vaultOpen && (
          <div className="pt-3 border-t border-[#2F3E4E]/15 grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Saved Landlord & Company Profiles */}
            <div className="lg:col-span-6 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#2F3E4E]">
                  Saved Landlord &amp; Company Profiles ({profiles.length})
                </h3>
                {activeProfileId && (
                  <button
                    type="button"
                    onClick={handleUpdateActiveProfile}
                    className="text-xs font-bold text-[#2F3E4E] underline hover:text-[#12805C] cursor-pointer"
                  >
                    Update Selected Profile
                  </button>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  placeholder="Profile name (e.g. Branch Office - Landlord Name)"
                  aria-label="Profile name to save in browser"
                  className="flex-1 px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E]/60 bg-white text-xs font-medium text-[#2F3E4E] focus:outline-none focus:border-[#2F3E4E]"
                />
                <button
                  type="button"
                  onClick={handleSaveAsProfile}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] bg-[#2F3E4E] hover:bg-[#1E293B] text-[#FFFDF5] text-xs font-bold cursor-pointer whitespace-nowrap shrink-0"
                >
                  <BookmarkPlus className="w-3.5 h-3.5 text-[#F9C80E]" />
                  <span>Save Profile</span>
                </button>
              </div>

              {profiles.length === 0 ? (
                <p className="text-xs text-[#475569] bg-[#FEF2C8]/55 rounded-xl p-3 border border-[#2F3E4E]/20">
                  No saved profiles yet. Enter your Landlord &amp; Company details below, then click <strong>Save Profile</strong> to reuse them every month with 1 click.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  {profiles.map((p) => {
                    const isSelected = activeProfileId === p.id;
                    return (
                      <div
                        key={p.id}
                        className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border ${
                          isSelected
                            ? 'bg-[#CEE5DC]/70 border-[#2F3E4E]'
                            : 'bg-white border-[#2F3E4E]/25'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[#2F3E4E] truncate">{p.name}</div>
                          <div className="text-[11px] text-[#475569] truncate">
                            {p.defaults.lbank || 'Bank not set'} · TDS {p.defaults.tdsr || '10'}% · GST{' '}
                            {p.defaults.gtype === 'n' ? 'None' : `${p.defaults.gstr || '18'}%`}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleLoadProfile(p)}
                            className="px-2.5 py-1 rounded-md border border-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#F9C80E] text-[11px] font-bold text-[#2F3E4E] cursor-pointer"
                          >
                            Load
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProfile(p.id)}
                            aria-label={`Delete profile ${p.name}`}
                            className="p-1.5 rounded-md text-[#64748B] hover:text-[#B91C1C] hover:bg-rose-50 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Saved Monthly Letter History */}
            <div className="lg:col-span-6 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#2F3E4E]">
                  Saved Monthly Letters ({history.length})
                </h3>
                {!confirmWipeVault ? (
                  <button
                    type="button"
                    onClick={() => setConfirmWipeVault(true)}
                    className="text-xs font-semibold text-[#64748B] hover:text-[#B91C1C] cursor-pointer"
                  >
                    Clear Browser Data
                  </button>
                ) : (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-[#B91C1C]">Wipe all?</span>
                    <button
                      type="button"
                      onClick={handleWipeBrowserVault}
                      className="px-2 py-0.5 rounded bg-[#B91C1C] text-white font-bold cursor-pointer"
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmWipeVault(false)}
                      className="px-2 py-0.5 rounded border border-[#2F3E4E] bg-white font-bold cursor-pointer"
                    >
                      No
                    </button>
                  </div>
                )}
              </div>

              {history.length === 0 ? (
                <p className="text-xs text-[#475569] bg-[#FEF2C8]/55 rounded-xl p-3 border border-[#2F3E4E]/20">
                  No monthly letters saved yet. After generating a month&apos;s letter, click <strong>Save Month</strong> to archive it locally and clone it for future months.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 px-3 py-2 rounded-xl border border-[#2F3E4E]/25 bg-white"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[#2F3E4E] truncate">
                          {item.monthLabel} · {item.landlordName}
                        </div>
                        <div className="text-[11px] font-mono text-[#475569] tabular-nums truncate">
                          Net ₹{inr(item.netAmount)} {item.refNo ? `· Ref ${item.refNo}` : ''}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleLoadHistorySnapshot(item, false)}
                          className="px-2.5 py-1 rounded-md border border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] text-[11px] font-bold text-[#2F3E4E] cursor-pointer"
                        >
                          Open
                        </button>
                        <button
                          type="button"
                          onClick={() => handleLoadHistorySnapshot(item, true)}
                          title="Reuse landlord, company & rent for next month (clears Ref & Payment Date)"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-[#2F3E4E] bg-[#CEE5DC] hover:bg-[#F9C80E] text-[11px] font-bold text-[#2F3E4E] cursor-pointer"
                        >
                          <CopyPlus className="w-3 h-3" />
                          <span>Next Month</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteHistoryItem(item.id)}
                          aria-label={`Delete saved month ${item.monthLabel}`}
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
          </div>
        )}
      </div>

      {/* Inline Feedback Notice */}
      {notice && (
        <div
          role="status"
          className={`px-4 py-3 rounded-xl border-[1.5px] border-[#2F3E4E] text-xs sm:text-sm font-bold flex items-center gap-2 no-print ${
            notice.kind === 'ok' ? 'bg-[#CEE5DC] text-[#2F3E4E]' : 'bg-[#FEE2E2] text-[#991B1B]'
          }`}
        >
          {notice.kind === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 text-[#12805C] shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 text-[#B91C1C] shrink-0" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {/* Main Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start print:block">
        {/* Left Controls Panel */}
        {/* Left Editable Form (Scrollable Working Area on Desktop) */}
        <div className="lg:col-span-5 lg:max-h-[calc(100dvh-5.5rem)] lg:overflow-y-auto lg:pr-1.5 bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-4 sm:p-5 shadow-[0_4px_0_#2F3E4E] space-y-5 no-print">
          {/* This month's entries */}
          <section className="space-y-3">
            <h2 className="font-display font-extrabold text-xs uppercase tracking-wider text-[#2F3E4E] pb-1.5 border-b border-[#2F3E4E]/15">
              1. This Month&apos;s Entries
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="rl-ldate" className="block text-xs font-bold text-[#475569] mb-1">
                  Letter date
                </label>
                <input
                  id="rl-ldate"
                  type="date"
                  value={form.ldate}
                  onChange={(e) => updateField('ldate', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E]/60 bg-white text-xs sm:text-sm font-semibold text-[#2F3E4E] focus:outline-none focus:border-[#2F3E4E]"
                />
              </div>
              <div>
                <label htmlFor="rl-month" className="block text-xs font-bold text-[#475569] mb-1">
                  Rent month
                </label>
                <input
                  id="rl-month"
                  type="text"
                  value={form.month}
                  onChange={(e) => updateField('month', e.target.value)}
                  placeholder="e.g. May 2026"
                  className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E]/60 bg-white text-xs sm:text-sm font-semibold text-[#2F3E4E] focus:outline-none focus:border-[#2F3E4E]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="rl-mode" className="block text-xs font-bold text-[#475569] mb-1">
                Amount type — what are you entering?
              </label>
              <select
                id="rl-mode"
                value={form.mode}
                onChange={(e) => updateField('mode', e.target.value as AmountMode)}
                className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E]/60 bg-white text-xs sm:text-sm font-semibold text-[#2F3E4E] focus:outline-none focus:border-[#2F3E4E]"
              >
                <option value="taxable">Taxable rent (before GST)</option>
                <option value="total">Total incl. GST (invoice value)</option>
                <option value="net">Net payable (after TDS &amp; GST)</option>
              </select>
            </div>

            <div>
              <label htmlFor="rl-rent" className="block text-xs font-bold text-[#475569] mb-1">
                Amount (₹)
              </label>
              <input
                id="rl-rent"
                type="number"
                step="0.01"
                value={form.rent}
                onChange={(e) => updateField('rent', e.target.value)}
                placeholder="Enter amount in rupees"
                className="w-full px-3 py-2.5 rounded-lg border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8]/60 font-mono text-base font-extrabold text-[#2F3E4E] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="rl-pdate" className="block text-xs font-bold text-[#475569] mb-1">
                  Payment date
                </label>
                <input
                  id="rl-pdate"
                  type="date"
                  value={form.pdate}
                  onChange={(e) => updateField('pdate', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E]/60 bg-white text-xs sm:text-sm font-semibold text-[#2F3E4E] focus:outline-none focus:border-[#2F3E4E]"
                />
              </div>
              <div>
                <label htmlFor="rl-ref" className="block text-xs font-bold text-[#475569] mb-1">
                  Bank Ref No
                </label>
                <input
                  id="rl-ref"
                  type="text"
                  value={form.ref}
                  onChange={(e) => updateField('ref', e.target.value)}
                  placeholder="UTR / NEFT / RTGS Ref"
                  className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E]/60 bg-white text-xs sm:text-sm font-semibold text-[#2F3E4E] focus:outline-none focus:border-[#2F3E4E]"
                />
              </div>
            </div>
          </section>

          {/* Tax settings */}
          <section className="space-y-3">
            <h2 className="font-display font-extrabold text-xs uppercase tracking-wider text-[#2F3E4E] pb-1.5 border-b border-[#2F3E4E]/15">
              2. Tax Settings
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="rl-tdsr" className="block text-xs font-bold text-[#475569] mb-1">
                  TDS %
                </label>
                <input
                  id="rl-tdsr"
                  type="number"
                  step="0.01"
                  value={form.tdsr}
                  onChange={(e) => updateField('tdsr', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E]/60 bg-white font-mono text-xs sm:text-sm font-bold text-[#2F3E4E]"
                />
              </div>
              <div>
                <label htmlFor="rl-gstr" className="block text-xs font-bold text-[#475569] mb-1">
                  GST %
                </label>
                <input
                  id="rl-gstr"
                  type="number"
                  step="0.01"
                  value={form.gstr}
                  onChange={(e) => updateField('gstr', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E]/60 bg-white font-mono text-xs sm:text-sm font-bold text-[#2F3E4E]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="rl-tbasis" className="block text-xs font-bold text-[#475569] mb-1">
                  TDS calculated on
                </label>
                <select
                  id="rl-tbasis"
                  value={form.tbasis}
                  onChange={(e) => updateField('tbasis', e.target.value as TdsBasis)}
                  className="w-full px-2.5 py-2 rounded-lg border-[1.5px] border-[#2F3E4E]/60 bg-white text-xs font-semibold text-[#2F3E4E]"
                >
                  <option value="base">Taxable rent (excl. GST)</option>
                  <option value="gross">Rent + GST</option>
                </select>
              </div>
              <div>
                <label htmlFor="rl-gtype" className="block text-xs font-bold text-[#475569] mb-1">
                  GST type
                </label>
                <select
                  id="rl-gtype"
                  value={form.gtype}
                  onChange={(e) => updateField('gtype', e.target.value as GstType)}
                  className="w-full px-2.5 py-2 rounded-lg border-[1.5px] border-[#2F3E4E]/60 bg-white text-xs font-semibold text-[#2F3E4E]"
                >
                  <option value="cs">CGST + SGST</option>
                  <option value="i">IGST</option>
                  <option value="n">No GST</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="rl-rnd" className="block text-xs font-bold text-[#475569] mb-1">
                Rounding of TDS / GST
              </label>
              <select
                id="rl-rnd"
                value={form.rnd}
                onChange={(e) => updateField('rnd', e.target.value as RoundingMode)}
                className="w-full px-2.5 py-2 rounded-lg border-[1.5px] border-[#2F3E4E]/60 bg-white text-xs font-semibold text-[#2F3E4E]"
              >
                <option value="ceil">Round up to next rupee</option>
                <option value="round">Nearest rupee</option>
                <option value="none">No rounding (paise)</option>
              </select>
            </div>
          </section>

          {/* Letterhead space */}
          <section className="space-y-2.5">
            <h2 className="font-display font-extrabold text-xs uppercase tracking-wider text-[#2F3E4E] pb-1.5 border-b border-[#2F3E4E]/15">
              3. Letterhead Space
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="rl-lhtop" className="block text-xs font-bold text-[#475569] mb-1">
                  Top blank space (mm)
                </label>
                <input
                  id="rl-lhtop"
                  type="number"
                  min={0}
                  max={120}
                  step={1}
                  value={form.lhtop}
                  onChange={(e) => updateField('lhtop', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E]/60 bg-white font-mono text-xs sm:text-sm font-bold text-[#2F3E4E]"
                />
              </div>
              <div>
                <label htmlFor="rl-lhbot" className="block text-xs font-bold text-[#475569] mb-1">
                  Bottom blank space (mm)
                </label>
                <input
                  id="rl-lhbot"
                  type="number"
                  min={0}
                  max={80}
                  step={1}
                  value={form.lhbot}
                  onChange={(e) => updateField('lhbot', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E]/60 bg-white font-mono text-xs sm:text-sm font-bold text-[#2F3E4E]"
                />
              </div>
            </div>
            <p className="text-[11px] text-[#64748B]">
              Leaves room for your pre-printed letterhead. Typical: 40–55 mm top. Auto-saved in your browser.
            </p>
          </section>

          {/* Calculation check */}
          <section className="space-y-2">
            <h2 className="font-display font-extrabold text-xs uppercase tracking-wider text-[#2F3E4E] pb-1.5 border-b border-[#2F3E4E]/15">
              4. Calculation Check
            </h2>
            <div className="rounded-xl border-[1.5px] border-[#2F3E4E]/45 bg-[#FEF2C8]/55 p-3 space-y-1.5 text-xs">
              {checks.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2 leading-snug">
                  {item.kind === 'ok' && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D] shrink-0 mt-0.5" />
                  )}
                  {item.kind === 'w' && (
                    <AlertTriangle className="w-3.5 h-3.5 text-[#B45309] shrink-0 mt-0.5" />
                  )}
                  {item.kind === 'e' && (
                    <XCircle className="w-3.5 h-3.5 text-[#B91C1C] shrink-0 mt-0.5" />
                  )}
                  <span
                    className={
                      item.kind === 'f'
                        ? 'font-mono text-[11px] font-bold text-[#2F3E4E] bg-white px-2 py-0.5 rounded border border-[#2F3E4E]/20'
                        : item.kind === 'e'
                        ? 'font-bold text-[#B91C1C]'
                        : item.kind === 'w'
                        ? 'font-semibold text-[#92400E]'
                        : 'font-medium text-[#2F3E4E]'
                    }
                  >
                    {item.text}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Landlord (auto-saved in browser) */}
          <section className="space-y-2.5">
            <h2 className="font-display font-extrabold text-xs uppercase tracking-wider text-[#2F3E4E] pb-1.5 border-b border-[#2F3E4E]/15">
              5. Landlord Details (Auto-Saved in Browser)
            </h2>
            <div>
              <label htmlFor="rl-lname" className="block text-xs font-bold text-[#475569] mb-1">
                Name (as in address)
              </label>
              <input
                id="rl-lname"
                type="text"
                value={form.lname}
                onChange={(e) => updateField('lname', e.target.value)}
                placeholder="Landlord or Property Owner Name"
                className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E]/60 bg-white text-xs sm:text-sm font-semibold text-[#2F3E4E]"
              />
            </div>
            <div>
              <label htmlFor="rl-laddr" className="block text-xs font-bold text-[#475569] mb-1">
                Address
              </label>
              <textarea
                id="rl-laddr"
                rows={4}
                value={form.laddr}
                onChange={(e) => updateField('laddr', e.target.value)}
                placeholder={'Door / Building No.,\nStreet / Locality,\nCity & PIN Code'}
                className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E]/60 bg-white text-xs sm:text-sm font-medium text-[#2F3E4E]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="rl-lpan" className="block text-xs font-bold text-[#475569] mb-1">
                  Landlord PAN (optional)
                </label>
                <input
                  id="rl-lpan"
                  type="text"
                  value={form.lpan}
                  onChange={(e) => updateField('lpan', e.target.value)}
                  placeholder="Enter 10-character PAN"
                  className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E]/60 bg-white font-mono text-xs uppercase text-[#2F3E4E]"
                />
              </div>
              <div>
                <label htmlFor="rl-lgst" className="block text-xs font-bold text-[#475569] mb-1">
                  Landlord GSTIN (optional)
                </label>
                <input
                  id="rl-lgst"
                  type="text"
                  value={form.lgst}
                  onChange={(e) => updateField('lgst', e.target.value)}
                  placeholder="Enter 15-character GSTIN"
                  className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E]/60 bg-white font-mono text-xs uppercase text-[#2F3E4E]"
                />
              </div>
            </div>
            <div>
              <label htmlFor="rl-bname" className="block text-xs font-bold text-[#475569] mb-1">
                Beneficiary name in bank
              </label>
              <input
                id="rl-bname"
                type="text"
                value={form.bname}
                onChange={(e) => updateField('bname', e.target.value)}
                placeholder="Account Holder Name in Bank"
                className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E]/60 bg-white text-xs sm:text-sm font-semibold text-[#2F3E4E]"
              />
            </div>
            <div>
              <label htmlFor="rl-lbank" className="block text-xs font-bold text-[#475569] mb-1">
                Landlord&apos;s bank
              </label>
              <input
                id="rl-lbank"
                type="text"
                value={form.lbank}
                onChange={(e) => updateField('lbank', e.target.value)}
                placeholder="e.g. State Bank of India"
                className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E]/60 bg-white text-xs sm:text-sm font-semibold text-[#2F3E4E]"
              />
            </div>
          </section>

          {/* Company (auto-saved in browser) */}
          <section className="space-y-2.5">
            <h2 className="font-display font-extrabold text-xs uppercase tracking-wider text-[#2F3E4E] pb-1.5 border-b border-[#2F3E4E]/15">
              6. Company / Tenant Details (Auto-Saved in Browser)
            </h2>
            <div>
              <label htmlFor="rl-co" className="block text-xs font-bold text-[#475569] mb-1">
                Company / Tenant name
              </label>
              <input
                id="rl-co"
                type="text"
                value={form.co}
                onChange={(e) => updateField('co', e.target.value)}
                placeholder="Your Company / Organization Name"
                className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E]/60 bg-white text-xs sm:text-sm font-semibold text-[#2F3E4E]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="rl-ctan" className="block text-xs font-bold text-[#475569] mb-1">
                  Company TAN (optional)
                </label>
                <input
                  id="rl-ctan"
                  type="text"
                  value={form.ctan}
                  onChange={(e) => updateField('ctan', e.target.value)}
                  placeholder="ABCD01234E"
                  className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E]/60 bg-white font-mono text-xs uppercase text-[#2F3E4E]"
                />
              </div>
              <div>
                <label htmlFor="rl-cgst" className="block text-xs font-bold text-[#475569] mb-1">
                  Company GSTIN (optional)
                </label>
                <input
                  id="rl-cgst"
                  type="text"
                  value={form.cgst}
                  onChange={(e) => updateField('cgst', e.target.value)}
                  placeholder="36ABCDE1234F1Z2"
                  className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E]/60 bg-white font-mono text-xs uppercase text-[#2F3E4E]"
                />
              </div>
            </div>
            <div>
              <label htmlFor="rl-pbank" className="block text-xs font-bold text-[#475569] mb-1">
                Paying bank &amp; branch
              </label>
              <input
                id="rl-pbank"
                type="text"
                value={form.pbank}
                onChange={(e) => updateField('pbank', e.target.value)}
                placeholder="e.g. State Bank of India, Main Branch"
                className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E]/60 bg-white text-xs sm:text-sm font-semibold text-[#2F3E4E]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#475569] mb-1">
                Signature image (optional · saved in browser)
              </label>
              <input
                ref={sigFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleSignatureUpload}
                className="hidden"
              />
              <FileDropZone
                accept="image/*"
                multiple={false}
                onFiles={(files) => {
                  if (files[0]) loadSignatureFile(files[0]);
                }}
                className="flex flex-wrap items-center gap-2 p-2 rounded-xl border-[1.5px] border-dashed border-[#2F3E4E]/45 bg-[#FFFDF5] transition"
              >
                <button
                  type="button"
                  onClick={() => sigFileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] cursor-pointer transition"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{form.sig ? 'Drop or Replace Signature' : 'Drop or Upload Signature'}</span>
                </button>
                {form.sig && (
                  <button
                    type="button"
                    onClick={() => updateField('sig', '')}
                    className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg border border-[#B91C1C]/40 bg-[#FEE2E2] text-xs font-bold text-[#991B1B] cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                )}
              </FileDropZone>
            </div>
          </section>

          {/* Primary Buttons */}
          <div className="pt-2 space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={isExportingPdf}
                onClick={() => void handleSavePdf()}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#2F3E4E] hover:bg-[#1E293B] shadow-[0_3px_0_#1E293B] font-display font-extrabold text-sm text-[#F9C80E] flex items-center justify-center gap-2 cursor-pointer transition disabled:opacity-60"
              >
                <Download className="w-4 h-4" />
                <span>{isExportingPdf ? 'Saving PDF...' : 'Save PDF'}</span>
              </button>
              <button
                type="button"
                onClick={() => void handlePrint()}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#F9C80E] hover:bg-[#FFE1B3] shadow-[0_3px_0_#2F3E4E] font-display font-extrabold text-sm text-[#2F3E4E] flex items-center justify-center gap-2 cursor-pointer transition"
              >
                <Printer className="w-4 h-4" />
                <span>Print A4</span>
              </button>
            </div>
            <button
              type="button"
              onClick={handleSaveToHistory}
              className="w-full min-h-[42px] px-4 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] font-bold text-xs sm:text-sm text-[#2F3E4E] flex items-center justify-center gap-2 cursor-pointer transition"
            >
              <Save className="w-4 h-4 text-[#12805C]" />
              <span>Archive Month to Browser History</span>
            </button>
            <p className="text-[11px] text-[#64748B] text-center">
              Every field auto-saves in your browser immediately. Save PDF exports a direct A4 file.
            </p>
          </div>
        </div>

        {/* Right Live A4 Letterhead Sheet Preview (Full Responsive Fit — No Preview Scrollbar) */}
        <div className="lg:col-span-7 lg:sticky lg:top-20 space-y-3 print:space-y-0 print:static print:w-full print:overflow-visible print:pr-0">
          <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-[#475569] no-print">
            <span>
              <strong className="text-[#2F3E4E]">Live A4 Preview</strong> · Top{' '}
              <span className="font-mono font-bold text-[#2F3E4E]">{topSpaceMm}mm</span> · Bottom{' '}
              <span className="font-mono font-bold text-[#2F3E4E]">{botSpaceMm}mm</span>
            </span>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-[11px] font-bold text-[#2F3E4E]">
                Fit {Math.round(previewScale * 100)}% · A4
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono font-bold text-[#12805C] tabular-nums">
                Net: ₹{inr(calc.net)}/-
              </span>
            </div>
          </div>

          <div
            id="rent-a4-stage"
            ref={previewStageRef}
            className="w-full rounded-2xl bg-[#E9DFBE]/75 border-[1.5px] border-[#2F3E4E] p-3 flex justify-center overflow-hidden shadow-[0_4px_0_#2F3E4E] print:border-0 print:bg-transparent print:p-0 print:shadow-none print:overflow-visible"
          >
            <div
              id="rent-a4-scale-box"
              style={{
                width: `${Math.ceil(794 * previewScale)}px`,
                height: `${Math.ceil(sheetHeightPx * previewScale)}px`,
              }}
              className="relative shrink-0 overflow-hidden print:static print:overflow-visible"
            >
              <div
                id="rent-a4-sheet"
                ref={sheetRef}
                style={{
                  width: '794px',
                  minHeight: '1123px',
                  padding: `${topSpaceMm}mm 20mm ${botSpaceMm}mm`,
                  fontFamily: '"Times New Roman", Times, serif',
                  fontSize: '12pt',
                  lineHeight: 1.45,
                  color: '#000000',
                  backgroundColor: '#ffffff',
                  transform: `scale(${previewScale})`,
                  transformOrigin: 'top left',
                }}
                className="border border-[#2F3E4E]/35 shadow-[0_8px_24px_rgba(47,62,78,0.18)] print:border-0 print:shadow-none print:m-0"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div>To,</div>
                  <div>Date:- {dmy(form.ldate)}</div>
                </div>

                <p style={{ margin: '0 0 10px' }}>
                  {form.lname.trim() || '____'}
                  {addressLines.length > 0 && ','}
                  {addressLines.map((line, idx) => (
                    <React.Fragment key={idx}>
                      <br />
                      {line}
                    </React.Fragment>
                  ))}
                  {landlordIds && (
                    <>
                      <br />
                      <span style={{ fontSize: '10.5pt' }}>{landlordIds}</span>
                    </>
                  )}
                </p>

                <p style={{ margin: '0 0 10px', marginLeft: '36px' }}>Dear Sir,</p>
                <p style={{ margin: '0 0 10px', marginLeft: '36px' }}>
                  <b>Ref: Payment of Rent for the month of {rentMonthDisplay}.</b>
                </p>

                <p style={{ margin: '0 0 10px', textAlign: 'justify' }}>
                  This is to inform you that we have transferred an amount of Rs.{inr(calc.net)}/- (
                  {amountInWords(calc.net)}) from {form.pbank.trim() || '____'} vide Ref No &ldquo;
                  {form.ref.trim() || '____'}&rdquo;, in favor of &ldquo;
                  {form.bname.trim() || '____'}&rdquo; towards Rent for the month of {rentMonthDisplay}{' '}
                  through online transfer on {dmy(form.pdate)}, to your Bank Account at{' '}
                  {form.lbank.trim() || '____'}. Please be noted that we are deducting Rs.{' '}
                  {inr(calc.tds)}/- as TDS @ {tdsPctLabel}% from the{' '}
                  {calc.gb ? 'Rent plus GST' : 'Rent'} payable to you
                  {form.gtype === 'n'
                    ? ''
                    : ` and adding Rs. ${inr(calc.gst)}/- towards ${gstPctLabel}% GST`}
                  . Details are below:
                </p>

                <table
                  style={{
                    borderCollapse: 'collapse',
                    margin: '12px 0 14px',
                    width: '100%',
                  }}
                >
                  <tbody>
                    <tr>
                      <td style={{ border: '1px solid #000', padding: '5px 9px' }}>
                        Total Rent Payable for {rentMonthDisplay} (taxable value)
                      </td>
                      <td
                        style={{
                          border: '1px solid #000',
                          padding: '5px 9px',
                          textAlign: 'right',
                          width: '34%',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Rs.{inr(calc.base)}/-
                      </td>
                    </tr>

                    {form.gtype === 'cs' && (
                      <>
                        <tr>
                          <td style={{ border: '1px solid #000', padding: '5px 9px' }}>
                            Add: GST {gstPctLabel}% (CGST {halfGstPctLabel}% + SGST {halfGstPctLabel}%)
                          </td>
                          <td
                            style={{
                              border: '1px solid #000',
                              padding: '5px 9px',
                              textAlign: 'right',
                              width: '34%',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Rs.{inr(calc.gst)}/-
                          </td>
                        </tr>
                        <tr>
                          <td
                            style={{
                              border: '1px solid #000',
                              padding: '5px 9px',
                              fontSize: '10.5pt',
                              paddingLeft: '22px',
                            }}
                          >
                            CGST {halfGstPctLabel}%: Rs.{inr(calc.gst / 2)}/- &nbsp; SGST {halfGstPctLabel}
                            %: Rs.{inr(calc.gst / 2)}/-
                          </td>
                          <td
                            style={{
                              border: '1px solid #000',
                              padding: '5px 9px',
                              textAlign: 'right',
                              width: '34%',
                              whiteSpace: 'nowrap',
                            }}
                          />
                        </tr>
                      </>
                    )}

                    {form.gtype === 'i' && (
                      <tr>
                        <td style={{ border: '1px solid #000', padding: '5px 9px' }}>
                          Add: IGST {gstPctLabel}%
                        </td>
                        <td
                          style={{
                            border: '1px solid #000',
                            padding: '5px 9px',
                            textAlign: 'right',
                            width: '34%',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Rs.{inr(calc.gst)}/-
                        </td>
                      </tr>
                    )}

                    {form.gtype !== 'n' && (
                      <tr>
                        <td style={{ border: '1px solid #000', padding: '5px 9px' }}>
                          Gross Rent incl. GST
                        </td>
                        <td
                          style={{
                            border: '1px solid #000',
                            padding: '5px 9px',
                            textAlign: 'right',
                            width: '34%',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Rs.{inr(calc.gross)}/-
                        </td>
                      </tr>
                    )}

                    <tr>
                      <td style={{ border: '1px solid #000', padding: '5px 9px' }}>
                        Less: TDS @ {tdsPctLabel}% on {inr(calc.gb ? calc.gross : calc.base)}
                      </td>
                      <td
                        style={{
                          border: '1px solid #000',
                          padding: '5px 9px',
                          textAlign: 'right',
                          width: '34%',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Rs.{inr(calc.tds)}/-
                      </td>
                    </tr>

                    <tr>
                      <td
                        style={{
                          border: '1px solid #000',
                          padding: '5px 9px',
                          fontWeight: 'bold',
                        }}
                      >
                        Net payable Rent
                      </td>
                      <td
                        style={{
                          border: '1px solid #000',
                          padding: '5px 9px',
                          textAlign: 'right',
                          width: '34%',
                          whiteSpace: 'nowrap',
                          fontWeight: 'bold',
                        }}
                      >
                        Rs.{inr(calc.net)}/-
                      </td>
                    </tr>
                  </tbody>
                </table>

                <p style={{ margin: '0 0 10px' }}>Kindly accept and acknowledge as a receipt of payment.</p>
                <p style={{ margin: '0 0 10px' }}>Thanking You,</p>
                <p style={{ margin: '0 0 10px' }}>
                  For {form.co.trim() || '____'}.
                  {companyIds && (
                    <>
                      <br />
                      <span style={{ fontSize: '10.5pt' }}>{companyIds}</span>
                    </>
                  )}
                </p>

                {form.sig ? (
                  <img
                    src={form.sig}
                    alt="Authorized signature"
                    style={{ maxHeight: '70px', maxWidth: '200px', display: 'block', marginBottom: '6px' }}
                  />
                ) : (
                  <div style={{ height: '46px' }} />
                )}

                <p style={{ margin: 0 }}>Authorized Signature</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
