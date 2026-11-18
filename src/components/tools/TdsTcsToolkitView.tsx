import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Calculator,
  Copy,
  FileText,
  HardDrive,
  HelpCircle,
  Plus,
  Printer,
  RotateCcw,
  Search,
  ShieldCheck,
  Table2,
  Trash2,
} from 'lucide-react';
import { ToolCatalogItem } from '../../types/tools';
import { safeReadStorage, safeRemoveStorage, safeWriteStorage } from '../../utils/browserVault';
import { exportElementToPdf, printTargetElement } from '../../utils/printReport';

interface TdsTcsToolkitViewProps {
  tool?: ToolCatalogItem;
}

type TdsRuleType = 'agg' | 'c' | 'ex' | 'single' | 'none' | 'slab';
type TdsCategory = 'Resident payments' | 'Winnings, cash and others';

type TdsRow = readonly [
  code: string,
  oldSec: string,
  name: string,
  newRef: string,
  rate: number | string,
  thresholdText: string,
  ruleType: TdsRuleType,
  thresholdValue: number,
  category: TdsCategory,
];

const TDS_RATES: readonly TdsRow[] = [
  ['1001–03', '192', 'Salary', '392', 'Slab rate', 'Basic exemption', 'slab', 0, 'Resident payments'],
  ['1004', '192A', 'EPF accumulated balance withdrawal', '392(7)', 10, '₹50,000 per payment', 'single', 50000, 'Resident payments'],
  ['1005', '194D', 'Insurance commission', '393(1) 1(i)', 2, '₹20,000', 'agg', 20000, 'Resident payments'],
  ['1006', '194H', 'Commission or brokerage', '393(1) 1(ii)', 2, '₹20,000', 'agg', 20000, 'Resident payments'],
  ['1008', '194I(a)', 'Rent: plant, machinery, equipment', '393(1) 2(ii)D(a)', 2, '₹50,000 per month', 'single', 50000, 'Resident payments'],
  ['1009', '194I(b)', 'Rent: land, building, furniture', '393(1) 2(ii)D(b)', 10, '₹50,000 per month', 'single', 50000, 'Resident payments'],
  ['1011', '194IC', 'Joint development agreement', '393(1) 3(ii)', 10, 'None', 'none', 0, 'Resident payments'],
  ['1012', '194LA', 'Compensation on acquisition of immovable property', '393(1) 3(iii)', 10, '₹5,00,000', 'agg', 500000, 'Resident payments'],
  ['1013', '194K', 'Mutual fund unit income', '393(1) 4(i)', 10, '₹10,000', 'agg', 10000, 'Resident payments'],
  ['1019', '193', 'Interest on securities', '393(1) 5(i)', 10, '₹10,000', 'agg', 10000, 'Resident payments'],
  ['1020', '194A', 'Interest (other than securities): senior citizen', '393(1) 5(ii)D(a)', 10, '₹1,00,000', 'agg', 100000, 'Resident payments'],
  ['1021', '194A', 'Interest (other than securities): others', '393(1) 5(ii)D(b)', 10, '₹50,000', 'agg', 50000, 'Resident payments'],
  ['1022', '194A', 'Other interest cases', '393(1) 5(iii)', 10, '₹10,000', 'agg', 10000, 'Resident payments'],
  ['1023', '194C', 'Contractor: Individual / HUF', '393(1) 6(i)D(a)', 1, '₹30,000 single / ₹1,00,000 aggregate', 'c', 0, 'Resident payments'],
  ['1024', '194C', 'Contractor (rate auto: 1% Individual/HUF, 2% others)', '393(1) 6(i)D(b)', 2, '₹30,000 single / ₹1,00,000 aggregate', 'c', 0, 'Resident payments'],
  ['1026', '194J(a)', 'Technical services, call centre, film royalty', '393(1) 6(iii)D(a)', 2, '₹50,000', 'agg', 50000, 'Resident payments'],
  ['1027', '194J(b)', 'Professional services and other sums', '393(1) 6(iii)D(b)', 10, '₹50,000', 'agg', 50000, 'Resident payments'],
  ['1028', '194J', 'Director fees / commission', '393(1) 6(iii)D(b)', 10, 'None', 'none', 0, 'Resident payments'],
  ['1029', '194', 'Dividend', '393(1) 7', 10, '₹10,000', 'agg', 10000, 'Resident payments'],
  ['1030', '194DA', 'Life insurance payout (taxable)', '393(1) 8(i)', 2, '₹1,00,000', 'agg', 100000, 'Resident payments'],
  ['1031', '194Q', 'Purchase of goods (tax on excess)', '393(1) 8(ii)', 0.1, 'Above ₹50 lakh', 'ex', 5000000, 'Resident payments'],
  ['1033/1034', '194R', 'Benefit or perquisite', '393(1) 8(iv)', 10, '₹20,000', 'agg', 20000, 'Resident payments'],
  ['1035', '194O', 'E-commerce operator to participant', '393(1) 8(v)', 0.1, '₹5 lakh (Individual/HUF)', 'agg', 500000, 'Resident payments'],
  ['1037/1038', '194S', 'Virtual digital asset transfer', '393(1) 8(vi)', 1, '₹10,000 (₹50,000 specified person)', 'agg', 10000, 'Resident payments'],
  ['—', '194M', 'Individual/HUF paying contract, commission, professional fees', '393(1)', 2, '₹50 lakh', 'agg', 5000000, 'Resident payments'],
  ['—', '194-IA', 'Transfer of immovable property (non-agricultural)', '393(1)', 1, '₹50 lakh per transaction', 'single', 5000000, 'Resident payments'],
  ['—', '194-IB', 'Rent by Individual/HUF not under audit', '393(1)', 2, '₹50,000 per month', 'single', 50000, 'Resident payments'],
  ['1058/1059', '194B', 'Lottery, crossword, card game, gambling winnings', '393(3) 1', 30, '₹10,000 per transaction', 'single', 10000, 'Winnings, cash and others'],
  ['1060/1061', '194BA', 'Online gaming winnings', '393(3) 2', 30, 'None', 'none', 0, 'Winnings, cash and others'],
  ['1062', '194BB', 'Horse race winnings', '393(3) 3', 30, '₹10,000 per transaction', 'single', 10000, 'Winnings, cash and others'],
  ['1063', '194G', 'Lottery ticket commission', '393(3) 4', 2, '₹20,000', 'agg', 20000, 'Winnings, cash and others'],
  ['1064', '194N', 'Cash withdrawal: co-operative society (tax on excess)', '393(3) 5.D(a)', 2, 'Above ₹3 crore', 'ex', 30000000, 'Winnings, cash and others'],
  ['1065', '194N', 'Cash withdrawal: others (tax on excess)', '393(3) 5.D(b)', 2, 'Above ₹1 crore', 'ex', 10000000, 'Winnings, cash and others'],
  ['1066', '194EE', 'National Savings Scheme withdrawal', '393(3) 6', 10, '₹2,500', 'agg', 2500, 'Winnings, cash and others'],
  ['1067', '194T', 'Partner salary, remuneration, commission, bonus, interest', '393(3) 7', 10, '₹20,000', 'agg', 20000, 'Winnings, cash and others'],
];

const TCS_RATES: ReadonlyArray<[string, string, string, string, string, string]> = [
  ['1068', '206C-A', 'Alcoholic liquor for human consumption', '394(1) 1', '2%', 'Not specified'],
  ['1069', '206C-I', 'Tendu leaves', '394(1) 2', '2%', 'Not specified'],
  ['1070/1071', '206C-B/C', 'Timber (forest lease / other mode)', '394(1) 3', '2%', 'Not specified'],
  ['1072', '206C-D', 'Other forest produce', '394(1) 3', '2%', 'Not specified'],
  ['1073', '206C-E', 'Scrap', '394(1) 4', '2%', 'Not specified'],
  ['1074', '206C-J', 'Coal, lignite, iron ore', '394(1) 5', '2%', 'Not specified'],
  ['1075', '206C-L', 'Motor vehicle', '394(1) 6.D(a)', '1%', 'Generally above ₹10 lakh'],
  ['1076–1085', '206C-MA to MJ', 'Specified luxury goods (watch, art, yacht, bag, etc.)', '394(1) 6.D(b)', '1%', 'Above applicable threshold'],
  ['1086', '206C-T', 'LRS: education or medical', '394(1) 7.D(a)', '2%', 'Above ₹10 lakh'],
  ['1087', '206C-Q', 'LRS: other purposes', '394(1) 7.D(b)', '20%', 'Above ₹10 lakh'],
  ['1088', '206C-O', 'Overseas tour package: up to ₹10 lakh', '394(1) 8.D(a)', '2%', 'Up to ₹10 lakh'],
  ['1089', '206C-O', 'Overseas tour package: above ₹10 lakh', '394(1) 8.D(b)', '2%', 'Above ₹10 lakh'],
  ['1090', '206C-F', 'Parking lot', '394(1) 9', '2%', 'Not specified'],
  ['1091', '206C-G', 'Toll plaza', '394(1) 9', '2%', 'Not specified'],
  ['1092', '206C-H', 'Mine or quarry', '394(1) 9', '2%', 'Not specified'],
];

const PAN_TYPES: Record<string, string> = {
  P: 'Individual / Proprietor',
  H: 'HUF',
  C: 'Company',
  F: 'Firm / LLP',
  A: 'AOP',
  B: 'BOI',
  G: 'Government',
  J: 'Artificial juridical person',
  L: 'Local authority',
  T: 'Trust',
};

const formatInr = (n: number): string => '₹' + Math.round(n).toLocaleString('en-IN');
const formatRate = (r: TdsRow): string => (typeof r[4] === 'number' ? `${r[4]}%` : r[4]);

interface LedgerEntry {
  base: number;
  tds: number;
  net: number;
  inv: number;
  date: string;
}

type ToolkitTab = 'calc' | 'tds' | 'tcs' | 'map' | 'guide';

const DEFAULT_NAT_INDEX = TDS_RATES.findIndex((r) => r[1] === '194C' && r[0] === '1024');
const TDS_DRAFT_KEY = 'vcpl_tds_tcs_draft_v1';

interface TdsDraftPayload {
  pan: string;
  panStatus: 'ok' | 'none' | 'inop';
  natIdx: number;
  mode: 'law' | 'vol' | 'crossed';
  catchUp: boolean;
  amt: string;
  prevPaid: string;
  prevTds: string;
  lowerRate: string;
  payDate: string;
  hasGst: boolean;
  gstMode: 'ex' | 'in';
  gstRate: string;
  gstSupply: 'intra' | 'inter';
  gstTds2: boolean;
  retentionPct: string;
  advanceAdj: string;
  otherDed: string;
  ledger: LedgerEntry[];
}

export const TdsTcsToolkitView: React.FC<TdsTcsToolkitViewProps> = ({ tool }) => {
  const initialDraft = useMemo(
    () => safeReadStorage<Partial<TdsDraftPayload> | null>(TDS_DRAFT_KEY, null),
    []
  );
  const [activeTab, setActiveTab] = useState<ToolkitTab>('calc');

  // Calculator inputs (restored cleanly from browser localStorage)
  const [pan, setPan] = useState<string>(typeof initialDraft?.pan === 'string' ? initialDraft.pan : '');
  const [panStatus, setPanStatus] = useState<'ok' | 'none' | 'inop'>(
    initialDraft?.panStatus === 'none' || initialDraft?.panStatus === 'inop'
      ? initialDraft.panStatus
      : 'ok'
  );
  const [natIdx, setNatIdx] = useState<number>(
    typeof initialDraft?.natIdx === 'number' && initialDraft.natIdx >= 0 && initialDraft.natIdx < TDS_RATES.length
      ? initialDraft.natIdx
      : DEFAULT_NAT_INDEX >= 0
      ? DEFAULT_NAT_INDEX
      : 14
  );
  const [mode, setMode] = useState<'law' | 'vol' | 'crossed'>(
    initialDraft?.mode === 'vol' || initialDraft?.mode === 'crossed' ? initialDraft.mode : 'law'
  );
  const [catchUp, setCatchUp] = useState<boolean>(
    typeof initialDraft?.catchUp === 'boolean' ? initialDraft.catchUp : true
  );
  const [amt, setAmt] = useState<string>(typeof initialDraft?.amt === 'string' ? initialDraft.amt : '');
  const [prevPaid, setPrevPaid] = useState<string>(
    typeof initialDraft?.prevPaid === 'string' ? initialDraft.prevPaid : ''
  );
  const [prevTds, setPrevTds] = useState<string>(
    typeof initialDraft?.prevTds === 'string' ? initialDraft.prevTds : ''
  );
  const [lowerRate, setLowerRate] = useState<string>(
    typeof initialDraft?.lowerRate === 'string' ? initialDraft.lowerRate : ''
  );
  const [payDate, setPayDate] = useState<string>(
    typeof initialDraft?.payDate === 'string' ? initialDraft.payDate : ''
  );
  const [hasGst, setHasGst] = useState<boolean>(Boolean(initialDraft?.hasGst));
  const [gstMode, setGstMode] = useState<'ex' | 'in'>(initialDraft?.gstMode === 'in' ? 'in' : 'ex');
  const [gstRate, setGstRate] = useState<string>(
    typeof initialDraft?.gstRate === 'string' ? initialDraft.gstRate : '18'
  );
  const [gstSupply, setGstSupply] = useState<'intra' | 'inter'>(
    initialDraft?.gstSupply === 'inter' ? 'inter' : 'intra'
  );
  const [gstTds2, setGstTds2] = useState<boolean>(Boolean(initialDraft?.gstTds2));
  const [retentionPct, setRetentionPct] = useState<string>(
    typeof initialDraft?.retentionPct === 'string' ? initialDraft.retentionPct : ''
  );
  const [advanceAdj, setAdvanceAdj] = useState<string>(
    typeof initialDraft?.advanceAdj === 'string' ? initialDraft.advanceAdj : ''
  );
  const [otherDed, setOtherDed] = useState<string>(
    typeof initialDraft?.otherDed === 'string' ? initialDraft.otherDed : ''
  );

  const [ledger, setLedger] = useState<LedgerEntry[]>(
    Array.isArray(initialDraft?.ledger) ? initialDraft.ledger : []
  );
  const [ledgerMsg, setLedgerMsg] = useState<{ text: string; bad?: boolean }>({ text: '' });

  // Rate chart filters
  const [rateQuery, setRateQuery] = useState<string>('');
  const [rateCat, setRateCat] = useState<string>('');

  useEffect(() => {
    safeWriteStorage(TDS_DRAFT_KEY, {
      pan,
      panStatus,
      natIdx,
      mode,
      catchUp,
      amt,
      prevPaid,
      prevTds,
      lowerRate,
      payDate,
      hasGst,
      gstMode,
      gstRate,
      gstSupply,
      gstTds2,
      retentionPct,
      advanceAdj,
      otherDed,
      ledger,
    } satisfies TdsDraftPayload);
  }, [
    pan,
    panStatus,
    natIdx,
    mode,
    catchUp,
    amt,
    prevPaid,
    prevTds,
    lowerRate,
    payDate,
    hasGst,
    gstMode,
    gstRate,
    gstSupply,
    gstTds2,
    retentionPct,
    advanceAdj,
    otherDed,
    ledger,
  ]);

  const payeeKey = `${natIdx}|${pan.trim().toUpperCase()}`;
  const [prevKey, setPrevKey] = useState<string>(payeeKey);
  const resultPanelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (payeeKey !== prevKey) {
      if (ledger.length > 0) {
        setLedger([]);
        setLedgerMsg({
          text: 'Bill ledger cleared because the payee or nature of payment changed.',
          bad: true,
        });
      }
      setPrevKey(payeeKey);
    }
  }, [payeeKey, prevKey, ledger.length]);

  const panCheck = useMemo(() => {
    const v = pan.toUpperCase().trim();
    if (!v) {
      return {
        letter: null as string | null,
        msg: 'Enter the PAN to set the rate by payee type.',
        state: 'neutral' as const,
      };
    }
    if (!/^[A-Z]{3}[ABCFGHJLPT][A-Z][0-9]{4}[A-Z]$/.test(v)) {
      return {
        letter: null as string | null,
        msg:
          v.length < 10
            ? 'PAN needs 10 characters: 5 letters, 4 digits, 1 letter.'
            : 'Invalid PAN format. The 4th letter must be one of P, H, C, F, A, B, G, J, L, T.',
        state: 'bad' as const,
      };
    }
    const c = v[3];
    return {
      letter: c,
      msg: `Valid format. 4th letter ${c} = ${PAN_TYPES[c]}.`,
      state: 'good' as const,
    };
  }, [pan]);

  const selectedRule = TDS_RATES[natIdx] ?? TDS_RATES[0];
  const gstAllowed = !/^(192A|193|194|194A|194B|194BA|194BB|194DA|194EE|194K|194LA|194N|194T)$/.test(
    selectedRule[1]
  );

  useEffect(() => {
    if (!gstAllowed && hasGst) {
      setHasGst(false);
    }
  }, [gstAllowed, hasGst]);

  const calculation = useMemo(() => {
    const c = panCheck.letter;
    const pv = pan.trim();
    const ind = c === 'P' || c === 'H';
    const effectivePanStatus: 'ok' | 'none' | 'inop' | 'bad' =
      pv && !c && panStatus === 'ok' ? 'bad' : panStatus;
    const goodPan = effectivePanStatus === 'ok';

    const a = parseFloat(amt) || 0;
    const gp = hasGst && gstAllowed ? parseFloat(gstRate) || 0 : 0;

    let ledgerBase = 0;
    let ledgerTds = 0;
    ledger.forEach((x) => {
      ledgerBase += x.base;
      ledgerTds += x.tds;
    });

    const pp = (parseFloat(prevPaid) || 0) + ledgerBase;
    const pt = (parseFloat(prevTds) || 0) + ledgerTds;

    let base = a;
    if (hasGst && gstAllowed && gstMode === 'in') {
      base = a / (1 + gp / 100);
    }
    const gstAmt = hasGst && gstAllowed ? (base * gp) / 100 : 0;

    let rate = typeof selectedRule[4] === 'number' ? selectedRule[4] : 0;
    let code = selectedRule[0];
    let th = selectedRule[7];
    let note = '';
    let nr = selectedRule[3];

    if (selectedRule[1] === '194C') {
      const explicitInd = selectedRule[0] === '1023';
      const isInd = c ? ind : explicitInd;
      rate = isInd ? 1 : 2;
      code = isInd ? '1023' : '1024';
      nr = isInd ? '393(1) 6(i)D(a)' : '393(1) 6(i)D(b)';
      if (!c) {
        note = explicitInd
          ? 'PAN not entered: 1% (Individual / HUF) selected.'
          : 'PAN not entered: 2% (others) assumed.';
      }
    }
    if (selectedRule[1] === '194D') {
      rate = c === 'C' ? 10 : 2;
      note = 'Company payees: 10%. Others: 2% (official ITD chart still lists 5%; confirm).';
    }
    if (selectedRule[1] === '194') {
      th = ind ? 10000 : 0;
      note = ind
        ? 'Dividend: ₹10,000 limit applies to individual shareholders.'
        : 'Dividend to non-individual shareholders: no ₹10,000 limit.';
    }
    if (selectedRule[1] === '194S') {
      note = '₹10,000 limit applies; it is ₹50,000 for a specified person (small Individual/HUF buyer).';
    }
    if (selectedRule[1] === '194Q') {
      note = 'Applies to a buyer with turnover above ₹10 crore; tax is on the purchase value above ₹50 lakh.';
    }
    if (selectedRule[1] === '194O') {
      th = ind ? 500000 : 0;
      note = ind
        ? '₹5 lakh exemption applies to Individual/HUF sellers.'
        : 'No ₹5 lakh exemption for non-individual sellers; TDS from ₹1.';
    }

    if (!goodPan) {
      let h = Math.max(rate * 2, 20);
      if (selectedRule[1] === '194Q' || selectedRule[1] === '194O') h = 5;
      rate = h;
    }

    let ldNote = '';
    const ldNum = parseFloat(lowerRate);
    if (lowerRate.trim() !== '' && goodPan && Number.isFinite(ldNum) && ldNum >= 0 && ldNum < rate) {
      rate = ldNum;
      ldNote = `Lower deduction rate of ${lowerRate}% applied under Section 197. Keep the certificate on record.`;
    }

    let panWarning = '';
    if ((selectedRule[1] === '192A' || selectedRule[0] === '1020') && c && c !== 'P') {
      panWarning = `This section applies to an Individual payee, but the PAN shows ${PAN_TYPES[c]}. Check the nature of payment.`;
    }

    const kd: TdsRuleType = selectedRule[6] === 'agg' && !th ? 'none' : selectedRule[6];
    const tot = base + pp;
    let req = 0;
    let why = '';
    let rem = '';

    if (mode === 'vol') {
      req = (base * rate) / 100;
      why = 'Voluntary deduction: the threshold is ignored for this bill.';
    } else if (mode === 'crossed') {
      req = (base * rate) / 100;
      why = 'Limit treated as already crossed: TDS on this bill only.';
    } else if (kd === 'agg') {
      if (tot > th) {
        req = ((catchUp ? tot : base) * rate) / 100;
        why =
          pp > th
            ? 'Limit already crossed earlier this year.'
            : `Yearly total ${formatInr(tot)} crosses the ${formatInr(th)} limit.`;
      } else {
        why = `Yearly total ${formatInr(tot)} is within the ${formatInr(th)} limit.`;
        rem = `${formatInr(th - tot)} more can be paid before TDS applies.`;
      }
    } else if (kd === 'c') {
      if (tot > 100000) {
        req = ((catchUp ? tot : base) * rate) / 100;
        why =
          pp > 100000
            ? 'The ₹1,00,000 yearly limit was crossed earlier.'
            : `Yearly total ${formatInr(tot)} crosses ₹1,00,000.`;
      } else if (base > 30000) {
        req = (base * rate) / 100;
        why = 'Single payment exceeds ₹30,000.';
      } else {
        why = 'Within ₹30,000 single and ₹1,00,000 yearly limits.';
        rem = `${formatInr(100000 - tot)} more yearly before TDS applies (single bills above ₹30,000 are taxed at once).`;
      }
    } else if (kd === 'single') {
      if (base > th) {
        req = (base * rate) / 100;
        why = `Payment of ${formatInr(base)} exceeds the ${formatInr(th)} limit.`;
      } else {
        why = `Payment of ${formatInr(base)} is within the ${formatInr(th)} limit (checked per payment or month).`;
      }
    } else if (kd === 'ex') {
      req = (Math.min(base, Math.max(0, tot - th)) * rate) / 100;
      why = req ? 'Tax applies only on the amount above the limit.' : 'Total is within the limit.';
    } else {
      req = (base * rate) / 100;
      why = 'No threshold applies.';
    }

    const fullReq = Math.round(req);
    const isCumul =
      mode === 'law' &&
      catchUp &&
      ((kd === 'agg' && tot > th) || (kd === 'c' && tot > 100000));
    const tds = isCumul ? Math.max(0, fullReq - Math.round(pt)) : fullReq;
    const catchUpAmt = isCumul ? Math.max(0, tds - Math.round((base * rate) / 100)) : 0;
    const taxableBase = isCumul ? tot : rate ? Math.round((req * 100) / rate) : 0;

    const inv = base + gstAmt;
    const gtds = gstTds2 && hasGst && gstAllowed ? Math.round(base * 0.02) : 0;
    const ret = (inv * (parseFloat(retentionPct) || 0)) / 100;
    const adv = parseFloat(advanceAdj) || 0;
    const oth = parseFloat(otherDed) || 0;
    const totalDed = tds + gtds + ret + adv + oth;
    const netPayable = inv - totalDed;

    let dueDateStr = '';
    if (tds && payDate) {
      const d = new Date(`${payDate}T00:00:00`);
      const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      if (/194-I[AB]|194M/.test(selectedRule[1])) {
        const end = new Date(d.getFullYear(), d.getMonth() + 2, 0);
        dueDateStr = `${end.getDate()} ${M[end.getMonth()]} ${end.getFullYear()} (30 days from end of month)`;
      } else if (d.getMonth() === 2) {
        dueDateStr = `30 Apr ${d.getFullYear()}`;
      } else {
        const next = new Date(d.getFullYear(), d.getMonth() + 1, 7);
        dueDateStr = `7 ${M[next.getMonth()]} ${next.getFullYear()}`;
      }
    }

    const copyText =
      `${selectedRule[1]} (${code}) | Payee: ${c ? PAN_TYPES[c] : 'n/a'} | Rate ${rate}% | Before GST ${formatInr(
        base
      )}` +
      (hasGst && gstAllowed ? ` | GST ${formatInr(gstAmt)}` : '') +
      ` | Taxable ${formatInr(taxableBase)} | TDS ${formatInr(tds)}` +
      (totalDed > tds ? ` | Total deductions ${formatInr(totalDed)}` : '') +
      ` | Net payable ${formatInr(netPayable)}` +
      (dueDateStr ? ` | Deposit by ${dueDateStr}` : '');

    return {
      a,
      base,
      gstAmt,
      gp,
      inv,
      pp,
      pt,
      rate,
      code,
      nr,
      goodPan,
      effectivePanStatus,
      c,
      why,
      rem,
      tds,
      catchUpAmt,
      taxableBase,
      gtds,
      ret,
      adv,
      oth,
      totalDed,
      netPayable,
      dueDateStr,
      note,
      ldNote,
      panWarning,
      copyText,
    };
  }, [
    panCheck,
    pan,
    panStatus,
    amt,
    hasGst,
    gstAllowed,
    gstRate,
    gstMode,
    ledger,
    prevPaid,
    prevTds,
    selectedRule,
    lowerRate,
    mode,
    catchUp,
    gstTds2,
    retentionPct,
    advanceAdj,
    otherDed,
    payDate,
  ]);

  const filteredTds = useMemo(() => {
    const q = rateQuery.trim().toLowerCase();
    return TDS_RATES.filter((r) => {
      const hay = `${r[0]} ${r[1]} ${r[2]} ${r[3]}`.toLowerCase();
      return (!q || hay.includes(q)) && (!rateCat || r[8] === rateCat);
    });
  }, [rateQuery, rateCat]);

  const handleAddBill = () => {
    if (!calculation.a) {
      setLedgerMsg({ text: 'Enter an invoice amount before adding to the ledger.', bad: true });
      return;
    }
    setLedger((prev) => [
      ...prev,
      {
        base: calculation.base,
        tds: calculation.tds,
        net: calculation.netPayable,
        inv: calculation.inv,
        date: payDate,
      },
    ]);
    setAmt('');
    setLedgerMsg({ text: 'Bill added to ledger. Enter the next invoice.' });
  };

  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(calculation.copyText);
      setLedgerMsg({ text: 'Summary copied to clipboard.' });
    } catch {
      setLedgerMsg({ text: 'Clipboard permission blocked by browser.', bad: true });
    }
  };

  const handleReset = () => {
    setPan('');
    setPanStatus('ok');
    setMode('law');
    setCatchUp(true);
    setAmt('');
    setPrevPaid('');
    setPrevTds('');
    setLowerRate('');
    setPayDate('');
    setHasGst(false);
    setGstTds2(false);
    setRetentionPct('');
    setAdvanceAdj('');
    setOtherDed('');
    setLedger([]);
    setLedgerMsg({ text: '' });
    safeRemoveStorage(TDS_DRAFT_KEY);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 sm:p-6 shadow-[0_4px_0_#2F3E4E] flex flex-col lg:flex-row lg:items-center justify-between gap-4 no-print">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#2F3E4E] text-[#F9C80E] text-[10px] font-display font-extrabold uppercase tracking-wider">
              <Calculator className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{tool?.code || 'TX-05'} · Tax Year 2026-27 (AY 2027-28)</span>
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#CEE5DC] border border-[#2F3E4E]/35 text-[10px] font-bold text-[#12805C]">
              <ShieldCheck className="w-3 h-3" aria-hidden="true" />
              <span>Income-tax Act, 2025 Ready</span>
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white border border-[#2F3E4E]/25 text-[10px] font-bold text-[#2F3E4E]">
              <HardDrive className="w-3 h-3 text-[#12805C]" aria-hidden="true" />
              <span>Auto-Saved in Browser Only</span>
            </span>
          </div>
          <h1 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] tracking-tight">
            {tool?.title || 'TDS & TCS Toolkit (Tax Year 2026-27)'}
          </h1>
          <p className="text-xs sm:text-sm text-[#475569] leading-relaxed max-w-3xl">
            Check PAN 4th-letter rates, yearly &amp; per-bill thresholds, GST exclusions, bill
            ledger catch-ups, Section 392/393/394 return codes, and deposit due dates before
            paying invoices.
          </p>
        </div>

        <button
          type="button"
          onClick={handleReset}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] transition cursor-pointer shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Form</span>
        </button>
      </div>

      {/* Sub-navigation Tabs */}
      <div
        role="tablist"
        aria-label="TDS & TCS Toolkit sections"
        className="flex flex-wrap items-center gap-2 no-print"
      >
        {(
          [
            ['calc', 'TDS Calculator', Calculator],
            ['tds', 'TDS Rate Chart (2026-27)', Table2],
            ['tcs', 'TCS Rate Chart (Sec 394)', Table2],
            ['map', 'Old → New Act Mapping', BookOpen],
            ['guide', 'Guide & FAQs', HelpCircle],
          ] as const
        ).map(([key, label, Icon]) => {
          const isOn = activeTab === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={isOn}
              onClick={() => setActiveTab(key)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border-[1.5px] text-xs font-bold transition cursor-pointer ${
                isOn
                  ? 'bg-[#2F3E4E] text-[#F9C80E] border-[#2F3E4E] shadow-[0_3px_0_#1E293B]'
                  : 'bg-[#FFFDF5] text-[#2F3E4E] border-[#2F3E4E]/50 hover:bg-[#F9C80E]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: CALCULATOR */}
      {activeTab === 'calc' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start print:block">
          {/* Inputs Panel */}
          <div className="lg:col-span-6 bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 shadow-[0_4px_0_#2F3E4E] space-y-3.5 lg:max-h-[calc(100dvh-5.5rem)] lg:overflow-y-auto lg:pr-1.5 no-print print:max-h-none print:overflow-visible">
            <h2 className="font-display font-extrabold text-base text-[#2F3E4E]">
              Invoice &amp; Payee Details
            </h2>

            <div>
              <label htmlFor="tds-pan" className="block text-xs font-bold text-[#2F3E4E] mb-1">
                Payee PAN
              </label>
              <input
                id="tds-pan"
                type="text"
                maxLength={10}
                value={pan}
                onChange={(e) => setPan(e.target.value.toUpperCase())}
                placeholder="Enter 10-character PAN (optional)"
                className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white font-mono text-xs uppercase text-[#2F3E4E]"
              />
              <p
                className={`mt-1 text-[11px] font-semibold ${
                  panCheck.state === 'good'
                    ? 'text-[#12805C]'
                    : panCheck.state === 'bad'
                    ? 'text-rose-700'
                    : 'text-[#64748B]'
                }`}
              >
                {panCheck.msg}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="tds-pst" className="block text-xs font-bold text-[#2F3E4E] mb-1">
                  PAN status
                </label>
                <select
                  id="tds-pst"
                  value={panStatus}
                  onChange={(e) => setPanStatus(e.target.value as 'ok' | 'none' | 'inop')}
                  className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white text-xs font-semibold text-[#2F3E4E]"
                >
                  <option value="ok">Valid and operative</option>
                  <option value="none">Not furnished</option>
                  <option value="inop">Inoperative (not linked with Aadhaar)</option>
                </select>
              </div>

              <div>
                <label htmlFor="tds-mode" className="block text-xs font-bold text-[#2F3E4E] mb-1">
                  Deduction mode
                </label>
                <select
                  id="tds-mode"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as 'law' | 'vol' | 'crossed')}
                  className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white text-xs font-semibold text-[#2F3E4E]"
                >
                  <option value="law">As per law (check threshold)</option>
                  <option value="vol">Deduct voluntarily (ignore threshold)</option>
                  <option value="crossed">Limit already crossed (this bill only)</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="tds-nat" className="block text-xs font-bold text-[#2F3E4E]">
                Nature of payment (Old Sec &amp; New Sec 2025)
              </label>
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-2.5 items-stretch">
                <select
                  id="tds-nat"
                  value={natIdx}
                  onChange={(e) => setNatIdx(Number(e.target.value))}
                  className="xl:col-span-7 w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white text-xs font-semibold text-[#2F3E4E]"
                >
                  {TDS_RATES.map((r, i) => {
                    if (r[6] === 'slab') return null;
                    return (
                      <option key={`${r[0]}-${r[1]}-${i}`} value={i}>
                        {r[1]} · New Sec {r[3]} – {r[2]} ({formatRate(r)})
                      </option>
                    );
                  })}
                </select>

                <div className="xl:col-span-5 flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E]/45 bg-[#FEF2C8]/70 text-[11px]">
                  <div className="min-w-0">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                      Old Sec (1961)
                    </span>
                    <span className="font-mono font-extrabold text-[#2F3E4E]">
                      {selectedRule[1]}
                    </span>
                  </div>
                  <span className="text-[#64748B] font-bold shrink-0" aria-hidden="true">
                    →
                  </span>
                  <div className="min-w-0 text-right">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-[#12805C]">
                      New Sec (2025) · {calculation.code}
                    </span>
                    <span className="font-mono font-extrabold text-[#12805C] break-all">
                      {calculation.nr}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs font-semibold text-[#2F3E4E] cursor-pointer">
              <input
                type="checkbox"
                checked={catchUp}
                onChange={(e) => setCatchUp(e.target.checked)}
                className="rounded border-[#2F3E4E]"
              />
              <span>Catch up earlier payments when the yearly limit is crossed</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="tds-amt" className="block text-xs font-bold text-[#2F3E4E] mb-1">
                  Invoice amount (₹)
                </label>
                <input
                  id="tds-amt"
                  type="number"
                  min={0}
                  value={amt}
                  onChange={(e) => setAmt(e.target.value)}
                  placeholder="e.g. 150000"
                  className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white text-xs font-semibold text-[#2F3E4E]"
                />
              </div>

              <div>
                <label htmlFor="tds-pd" className="block text-xs font-bold text-[#2F3E4E] mb-1">
                  Payment / credit date (optional)
                </label>
                <input
                  id="tds-pd"
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white text-xs font-semibold text-[#2F3E4E]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="tds-prev" className="block text-xs font-bold text-[#2F3E4E] mb-1">
                  Earlier paid this year (excl. GST ₹)
                </label>
                <input
                  id="tds-prev"
                  type="number"
                  min={0}
                  value={prevPaid}
                  onChange={(e) => setPrevPaid(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white text-xs font-semibold text-[#2F3E4E]"
                />
              </div>

              <div>
                <label htmlFor="tds-ptds" className="block text-xs font-bold text-[#2F3E4E] mb-1">
                  Earlier TDS already deducted (₹)
                </label>
                <input
                  id="tds-ptds"
                  type="number"
                  min={0}
                  value={prevTds}
                  onChange={(e) => setPrevTds(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white text-xs font-semibold text-[#2F3E4E]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="tds-ld" className="block text-xs font-bold text-[#2F3E4E] mb-1">
                Lower deduction certificate rate, Section 197 (%, optional)
              </label>
              <input
                id="tds-ld"
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={lowerRate}
                onChange={(e) => setLowerRate(e.target.value)}
                placeholder="Leave blank if none"
                className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white text-xs font-semibold text-[#2F3E4E]"
              />
            </div>

            {/* GST Section */}
            <div className="rounded-xl border border-[#2F3E4E]/25 bg-[#FEF2C8]/50 p-3.5 space-y-3">
              <label className="flex items-center gap-2 text-xs font-bold text-[#2F3E4E] cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!gstAllowed}
                  checked={hasGst && gstAllowed}
                  onChange={(e) => setHasGst(e.target.checked)}
                />
                <span>Invoice has GST</span>
              </label>
              {!gstAllowed && (
                <p className="text-[11px] font-medium text-[#64748B]">
                  GST does not apply to this payment section.
                </p>
              )}

              {hasGst && gstAllowed && (
                <div className="space-y-2.5 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-[#475569] mb-1">
                        Amount entered is
                      </label>
                      <select
                        value={gstMode}
                        onChange={(e) => setGstMode(e.target.value as 'ex' | 'in')}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-[#2F3E4E] bg-white text-xs text-[#2F3E4E]"
                      >
                        <option value="ex">Excluding GST</option>
                        <option value="in">Including GST</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#475569] mb-1">
                        GST rate
                      </label>
                      <select
                        value={gstRate}
                        onChange={(e) => setGstRate(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-[#2F3E4E] bg-white text-xs text-[#2F3E4E]"
                      >
                        <option value="5">5%</option>
                        <option value="12">12%</option>
                        <option value="18">18%</option>
                        <option value="28">28%</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#475569] mb-1">
                        Supply type
                      </label>
                      <select
                        value={gstSupply}
                        onChange={(e) => setGstSupply(e.target.value as 'intra' | 'inter')}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-[#2F3E4E] bg-white text-xs text-[#2F3E4E]"
                      >
                        <option value="intra">Intra-state (CGST+SGST)</option>
                        <option value="inter">Inter-state (IGST)</option>
                      </select>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-semibold text-[#2F3E4E] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={gstTds2}
                      onChange={(e) => setGstTds2(e.target.checked)}
                    />
                    <span>Deduct GST-TDS 2% (government deductor)</span>
                  </label>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-[#475569] mb-1">
                  Retention (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={retentionPct}
                  onChange={(e) => setRetentionPct(e.target.value)}
                  placeholder="0"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#2F3E4E] bg-white text-xs text-[#2F3E4E]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#475569] mb-1">
                  Advance adjusted (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  value={advanceAdj}
                  onChange={(e) => setAdvanceAdj(e.target.value)}
                  placeholder="0"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#2F3E4E] bg-white text-xs text-[#2F3E4E]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#475569] mb-1">
                  Other recovery (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  value={otherDed}
                  onChange={(e) => setOtherDed(e.target.value)}
                  placeholder="0"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#2F3E4E] bg-white text-xs text-[#2F3E4E]"
                />
              </div>
            </div>
          </div>

          {/* Results & Ledger Panel */}
          <div
            ref={resultPanelRef}
            className="lg:col-span-6 lg:sticky lg:top-20 print:static bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 shadow-[0_4px_0_#2F3E4E] print:w-full print:shadow-none print:bg-white space-y-4"
          >
            <div
              className={`px-3.5 py-2 rounded-xl border text-xs font-extrabold ${
                calculation.tds
                  ? 'bg-[#FEF2C8] border-[#F9C80E] text-[#2F3E4E]'
                  : 'bg-[#CEE5DC] border-[#12805C]/40 text-[#12805C]'
              }`}
            >
              {calculation.tds ? 'TDS Applies' : 'No TDS to Deduct'}
            </div>

            <div>
              <div className="font-display font-extrabold text-3xl sm:text-4xl text-[#12805C] tabular-nums">
                {formatInr(calculation.tds)}
              </div>
              <p className="mt-1 text-xs text-[#475569]">
                {calculation.why}
                {calculation.rem && !calculation.tds ? ` ${calculation.rem}` : ''}
              </p>
            </div>

            <div className="divide-y divide-[#2F3E4E]/15 text-xs">
              <div className="py-2 flex justify-between gap-2">
                <span className="text-[#64748B]">Section / code</span>
                <span className="font-bold text-[#2F3E4E] text-right">
                  {selectedRule[1]} → {calculation.nr} · {calculation.code}
                </span>
              </div>
              <div className="py-2 flex justify-between gap-2">
                <span className="text-[#64748B]">Payee type</span>
                <span className="font-semibold text-[#2F3E4E]">
                  {calculation.c ? PAN_TYPES[calculation.c] : 'Not entered'}
                </span>
              </div>
              <div className="py-2 flex justify-between gap-2">
                <span className="text-[#64748B]">Rate applied</span>
                <span className="font-bold text-[#2F3E4E]">
                  {calculation.rate}%{calculation.goodPan ? '' : ' (higher rate)'}
                </span>
              </div>
              <div className="py-2 flex justify-between gap-2">
                <span className="text-[#64748B]">Value before GST</span>
                <span className="font-mono font-bold text-[#2F3E4E]">
                  {formatInr(calculation.base)}
                </span>
              </div>
              {hasGst && gstAllowed && (
                <>
                  {gstSupply === 'intra' ? (
                    <>
                      <div className="py-2 flex justify-between gap-2">
                        <span className="text-[#64748B]">CGST {calculation.gp / 2}%</span>
                        <span className="font-mono text-[#2F3E4E]">
                          {formatInr(calculation.gstAmt / 2)}
                        </span>
                      </div>
                      <div className="py-2 flex justify-between gap-2">
                        <span className="text-[#64748B]">SGST {calculation.gp / 2}%</span>
                        <span className="font-mono text-[#2F3E4E]">
                          {formatInr(calculation.gstAmt / 2)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="py-2 flex justify-between gap-2">
                      <span className="text-[#64748B]">IGST {calculation.gp}%</span>
                      <span className="font-mono text-[#2F3E4E]">
                        {formatInr(calculation.gstAmt)}
                      </span>
                    </div>
                  )}
                  <div className="py-2 flex justify-between gap-2">
                    <span className="text-[#64748B]">Invoice total with GST</span>
                    <span className="font-mono font-bold text-[#2F3E4E]">
                      {formatInr(calculation.inv)}
                    </span>
                  </div>
                </>
              )}
              {(calculation.pp > 0 || calculation.pt > 0) && (
                <>
                  <div className="py-2 flex justify-between gap-2">
                    <span className="text-[#64748B]">Earlier payments, this year</span>
                    <span className="font-mono text-[#2F3E4E]">{formatInr(calculation.pp)}</span>
                  </div>
                  <div className="py-2 flex justify-between gap-2">
                    <span className="text-[#64748B]">Earlier TDS deducted</span>
                    <span className="font-mono text-[#2F3E4E]">{formatInr(calculation.pt)}</span>
                  </div>
                </>
              )}
              <div className="py-2 flex justify-between gap-2">
                <span className="text-[#64748B]">Taxable amount for TDS</span>
                <span className="font-mono text-[#2F3E4E]">
                  {formatInr(calculation.taxableBase)}
                </span>
              </div>
              {calculation.catchUpAmt > 0 && (
                <div className="py-2 flex justify-between gap-2">
                  <span className="text-[#64748B]">Includes catch-up TDS on earlier bills</span>
                  <span className="font-mono text-[#2F3E4E]">
                    {formatInr(calculation.catchUpAmt)}
                  </span>
                </div>
              )}
              <div className="py-2 flex justify-between gap-2">
                <span className="text-[#64748B]">TDS deducted</span>
                <span className="font-mono font-bold text-[#2F3E4E]">
                  {formatInr(calculation.tds)}
                </span>
              </div>
              {calculation.gtds > 0 && (
                <div className="py-2 flex justify-between gap-2">
                  <span className="text-[#64748B]">GST-TDS 2%</span>
                  <span className="font-mono text-[#2F3E4E]">{formatInr(calculation.gtds)}</span>
                </div>
              )}
              {calculation.ret > 0 && (
                <div className="py-2 flex justify-between gap-2">
                  <span className="text-[#64748B]">Retention</span>
                  <span className="font-mono text-[#2F3E4E]">{formatInr(calculation.ret)}</span>
                </div>
              )}
              {calculation.adv > 0 && (
                <div className="py-2 flex justify-between gap-2">
                  <span className="text-[#64748B]">Advance adjusted</span>
                  <span className="font-mono text-[#2F3E4E]">{formatInr(calculation.adv)}</span>
                </div>
              )}
              {calculation.oth > 0 && (
                <div className="py-2 flex justify-between gap-2">
                  <span className="text-[#64748B]">Other deductions</span>
                  <span className="font-mono text-[#2F3E4E]">{formatInr(calculation.oth)}</span>
                </div>
              )}
              <div className="py-2.5 flex justify-between gap-2 text-sm font-extrabold text-[#12805C]">
                <span>Net payable to payee</span>
                <span className="font-mono">{formatInr(calculation.netPayable)}</span>
              </div>
            </div>

            {/* Contextual Notes */}
            <div className="space-y-2 text-[11px] text-[#475569]">
              {calculation.panWarning && (
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-400 text-amber-900">
                  {calculation.panWarning}
                </div>
              )}
              {calculation.note && (
                <div className="p-2.5 rounded-lg bg-[#FEF2C8] border border-[#2F3E4E]/20 text-[#2F3E4E]">
                  {calculation.note}
                </div>
              )}
              {calculation.ldNote && (
                <div className="p-2.5 rounded-lg bg-[#FEF2C8] border border-[#2F3E4E]/20 text-[#2F3E4E]">
                  {calculation.ldNote}
                </div>
              )}
              {calculation.dueDateStr && (
                <div className="p-2.5 rounded-lg bg-[#CEE5DC]/60 border border-[#12805C]/30 text-[#2F3E4E]">
                  Deposit TDS by <strong>{calculation.dueDateStr}</strong>.
                </div>
              )}
              {!calculation.goodPan && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-300 text-rose-900">
                  Higher rate applies (twice the normal rate or 20%; 5% for 194Q/194O). Form 15G/15H
                  cannot be accepted.
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 pt-1 no-print">
              <button
                type="button"
                onClick={handleAddBill}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#2F3E4E] text-[#F9C80E] text-xs font-bold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Bill to Ledger</span>
              </button>
              <button
                type="button"
                onClick={handleCopySummary}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] text-[#2F3E4E] text-xs font-bold cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Summary</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  void exportElementToPdf({
                    element: resultPanelRef.current,
                    filename: `TDS_Computation_${selectedRule[0] || 'Report'}.pdf`,
                    backgroundColor: '#FFFDF5',
                    prepareClone: (clonedDoc) => {
                      clonedDoc.querySelectorAll('.lg\\:sticky').forEach((n) => {
                        (n as HTMLElement).style.position = 'static';
                      });
                    },
                  });
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] bg-[#F9C80E] text-[#2F3E4E] text-xs font-bold cursor-pointer whitespace-nowrap"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Save PDF</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  void printTargetElement({
                    element: resultPanelRef.current,
                    title: `TDS_Computation_${selectedRule[0] || 'Report'}`,
                    prepareClone: (clone) => {
                      clone.style.position = 'static';
                      clone.style.boxShadow = 'none';
                      clone.style.border = '0';
                    },
                  });
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white text-[#2F3E4E] text-xs font-bold cursor-pointer whitespace-nowrap"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
            </div>

            {ledgerMsg.text && (
              <p
                className={`text-xs font-semibold ${
                  ledgerMsg.bad ? 'text-rose-700' : 'text-[#12805C]'
                }`}
              >
                {ledgerMsg.text}
              </p>
            )}

            {/* Bill Ledger Table */}
            {ledger.length > 0 && (
              <div className="pt-2 border-t border-[#2F3E4E]/15 space-y-2">
                <h3 className="font-display font-bold text-xs text-[#2F3E4E]">
                  Bill Ledger (this payee &amp; nature)
                </h3>
                <div className="overflow-x-auto rounded-lg border border-[#2F3E4E]/25 bg-white">
                  <table className="w-full text-xs">
                    <thead className="bg-[#FEF2C8] text-[#2F3E4E]">
                      <tr>
                        <th className="px-2.5 py-1.5 text-left">#</th>
                        <th className="px-2.5 py-1.5 text-left">Date</th>
                        <th className="px-2.5 py-1.5 text-right">Before GST</th>
                        <th className="px-2.5 py-1.5 text-right">TDS</th>
                        <th className="px-2.5 py-1.5 text-right">Net Paid</th>
                        <th className="px-2 py-1.5" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2F3E4E]/10">
                      {ledger.map((row, idx) => (
                        <tr key={idx}>
                          <td className="px-2.5 py-1.5">{idx + 1}</td>
                          <td className="px-2.5 py-1.5">{row.date || '-'}</td>
                          <td className="px-2.5 py-1.5 text-right font-mono">
                            {formatInr(row.base)}
                          </td>
                          <td className="px-2.5 py-1.5 text-right font-mono">
                            {formatInr(row.tds)}
                          </td>
                          <td className="px-2.5 py-1.5 text-right font-mono">
                            {formatInr(row.net)}
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <button
                              type="button"
                              aria-label={`Remove bill ${idx + 1}`}
                              onClick={() =>
                                setLedger((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="p-1 text-rose-700 hover:bg-rose-50 rounded cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-[#CEE5DC]/40 font-bold">
                        <td colSpan={2} className="px-2.5 py-1.5">
                          Total
                        </td>
                        <td className="px-2.5 py-1.5 text-right font-mono">
                          {formatInr(ledger.reduce((s, x) => s + x.base, 0))}
                        </td>
                        <td className="px-2.5 py-1.5 text-right font-mono">
                          {formatInr(ledger.reduce((s, x) => s + x.tds, 0))}
                        </td>
                        <td className="px-2.5 py-1.5 text-right font-mono">
                          {formatInr(ledger.reduce((s, x) => s + x.net, 0))}
                        </td>
                        <td />
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: TDS RATE CHART */}
      {activeTab === 'tds' && (
        <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 shadow-[0_4px_0_#2F3E4E] space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#64748B]" />
              <input
                type="search"
                value={rateQuery}
                onChange={(e) => setRateQuery(e.target.value)}
                placeholder="Search section, code or nature, e.g. 194J or rent"
                className="w-full pl-9 pr-3 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white text-xs text-[#2F3E4E]"
              />
            </div>
            <select
              value={rateCat}
              onChange={(e) => setRateCat(e.target.value)}
              aria-label="Filter TDS category"
              className="px-3 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white text-xs font-semibold text-[#2F3E4E]"
            >
              <option value="">All categories</option>
              <option value="Resident payments">Resident payments</option>
              <option value="Winnings, cash and others">Winnings, cash and others</option>
            </select>
          </div>

          <p className="text-xs font-mono font-bold text-[#475569]">
            Showing {filteredTds.length} of {TDS_RATES.length} entries
          </p>

          <div className="overflow-x-auto rounded-xl border-[1.5px] border-[#2F3E4E]/35 bg-white">
            <table className="w-full text-xs border-collapse min-w-[740px]">
              <thead className="bg-[#FEF2C8] border-b border-[#2F3E4E]">
                <tr>
                  <th className="px-3 py-2.5 text-left font-extrabold text-[#2F3E4E]">Code</th>
                  <th className="px-3 py-2.5 text-left font-extrabold text-[#2F3E4E]">Old Sec.</th>
                  <th className="px-3 py-2.5 text-left font-extrabold text-[#2F3E4E]">
                    Nature of Payment
                  </th>
                  <th className="px-3 py-2.5 text-left font-extrabold text-[#2F3E4E]">
                    New Act Ref.
                  </th>
                  <th className="px-3 py-2.5 text-left font-extrabold text-[#2F3E4E]">Rate</th>
                  <th className="px-3 py-2.5 text-left font-extrabold text-[#2F3E4E]">Threshold</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2F3E4E]/10">
                {filteredTds.map((r, i) => (
                  <tr key={`${r[0]}-${i}`} className="hover:bg-[#FEF2C8]/35">
                    <td className="px-3 py-2 font-mono font-bold">{r[0]}</td>
                    <td className="px-3 py-2 font-semibold">{r[1]}</td>
                    <td className="px-3 py-2">{r[2]}</td>
                    <td className="px-3 py-2 font-mono">{r[3]}</td>
                    <td className="px-3 py-2 font-extrabold text-[#12805C]">{formatRate(r)}</td>
                    <td className="px-3 py-2">{r[5]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: TCS RATE CHART */}
      {activeTab === 'tcs' && (
        <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 shadow-[0_4px_0_#2F3E4E] space-y-4">
          <p className="text-xs text-[#475569]">
            TCS is consolidated under Section 394 for amounts debited or received on or after 1
            April 2026.
          </p>
          <div className="overflow-x-auto rounded-xl border-[1.5px] border-[#2F3E4E]/35 bg-white">
            <table className="w-full text-xs border-collapse min-w-[700px]">
              <thead className="bg-[#FEF2C8] border-b border-[#2F3E4E]">
                <tr>
                  <th className="px-3 py-2.5 text-left font-extrabold text-[#2F3E4E]">Code</th>
                  <th className="px-3 py-2.5 text-left font-extrabold text-[#2F3E4E]">Old Sec.</th>
                  <th className="px-3 py-2.5 text-left font-extrabold text-[#2F3E4E]">
                    Nature of Collection
                  </th>
                  <th className="px-3 py-2.5 text-left font-extrabold text-[#2F3E4E]">
                    New Act Ref.
                  </th>
                  <th className="px-3 py-2.5 text-left font-extrabold text-[#2F3E4E]">Rate</th>
                  <th className="px-3 py-2.5 text-left font-extrabold text-[#2F3E4E]">Threshold</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2F3E4E]/10">
                {TCS_RATES.map((row) => (
                  <tr key={row[0]} className="hover:bg-[#FEF2C8]/35">
                    <td className="px-3 py-2 font-mono font-bold">{row[0]}</td>
                    <td className="px-3 py-2 font-semibold">{row[1]}</td>
                    <td className="px-3 py-2">{row[2]}</td>
                    <td className="px-3 py-2 font-mono">{row[3]}</td>
                    <td className="px-3 py-2 font-extrabold text-[#12805C]">{row[4]}</td>
                    <td className="px-3 py-2">{row[5]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: OLD -> NEW ACT MAPPING */}
      {activeTab === 'map' && (
        <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 shadow-[0_4px_0_#2F3E4E] space-y-5">
          <div className="overflow-x-auto rounded-xl border border-[#2F3E4E]/30 bg-white">
            <table className="w-full text-xs">
              <thead className="bg-[#FEF2C8] border-b border-[#2F3E4E]">
                <tr>
                  <th className="px-3 py-2.5 text-left font-extrabold">Area</th>
                  <th className="px-3 py-2.5 text-left font-extrabold">Old Act</th>
                  <th className="px-3 py-2.5 text-left font-extrabold">New Act (2025)</th>
                  <th className="px-3 py-2.5 text-left font-extrabold">Codes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2F3E4E]/10">
                <tr>
                  <td className="px-3 py-2 font-semibold">Salary TDS</td>
                  <td className="px-3 py-2">192</td>
                  <td className="px-3 py-2 font-mono font-bold">392</td>
                  <td className="px-3 py-2 font-mono">1001–1003</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-semibold">Resident non-salary TDS</td>
                  <td className="px-3 py-2">193, 194, 194A, 194C, 194H, 194I, 194J, 194Q…</td>
                  <td className="px-3 py-2 font-mono font-bold">393(1)</td>
                  <td className="px-3 py-2 font-mono">1004–1038</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-semibold">Non-resident TDS</td>
                  <td className="px-3 py-2">194E, 194LC, 195…</td>
                  <td className="px-3 py-2 font-mono font-bold">393(2)</td>
                  <td className="px-3 py-2 font-mono">Foreign codes</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-semibold">Winnings, cash &amp; partner payments</td>
                  <td className="px-3 py-2">194B, 194BA, 194N, 194T</td>
                  <td className="px-3 py-2 font-mono font-bold">393(3)</td>
                  <td className="px-3 py-2 font-mono">1058–1067</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-semibold">TCS</td>
                  <td className="px-3 py-2">206C</td>
                  <td className="px-3 py-2 font-mono font-bold">394</td>
                  <td className="px-3 py-2 font-mono">1068–1092</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 text-xs">
            {[
              ['24Q → Form 138', 'Salary'],
              ['26Q → Form 140', 'Resident'],
              ['27Q → Form 144', 'Non-resident'],
              ['27EQ → Form 143', 'TCS'],
              ['Form 16 → 130', 'Salary Cert'],
              ['Form 16A → 131', 'Non-sal Cert'],
            ].map(([title, sub]) => (
              <div
                key={title}
                className="rounded-xl border border-[#2F3E4E]/35 bg-white px-3 py-2.5 text-center"
              >
                <div className="font-mono font-extrabold text-[#2F3E4E]">{title}</div>
                <div className="text-[11px] text-[#64748B] mt-0.5">{sub}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: TAX YEAR 2026-27 GUIDE */}
      {activeTab === 'guide' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 shadow-[0_3px_0_#2F3E4E] space-y-2.5 text-xs text-[#334155]">
            <h3 className="font-display font-extrabold text-sm text-[#2F3E4E]">
              What Changed in Tax Year 2026-27
            </h3>
            <p className="leading-relaxed">
              The Income-tax Act, 2025 applies from 1 April 2026. Salary TDS moves to Section 392,
              resident/non-resident payments to 393, and TCS to 394 with updated return form numbers
              and payment codes.
            </p>
            <ul className="list-disc pl-4 space-y-1">
              <li>194H Commission/Brokerage: 2% above ₹20,000</li>
              <li>194J Professional &amp; Technical fees: 2% / 10% above ₹50,000</li>
              <li>194I Rent threshold: ₹50,000 per month</li>
              <li>194T Partner payments: 10% above ₹20,000</li>
            </ul>
          </div>

          <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 shadow-[0_3px_0_#2F3E4E] space-y-2.5 text-xs text-[#334155]">
            <h3 className="font-display font-extrabold text-sm text-[#2F3E4E]">
              Deposit Due Dates &amp; Compliance Checks
            </h3>
            <ul className="list-disc pl-4 space-y-1.5">
              <li>
                <strong>April to February deductions:</strong> Deposit by 7th of the following month.
              </li>
              <li>
                <strong>March deductions:</strong> Deposit by 30 April.
              </li>
              <li>
                <strong>194-IA, 194-IB &amp; 194M:</strong> Within 30 days from end of the month.
              </li>
              <li>
                <strong>Missing / Inoperative PAN:</strong> Higher of twice the rate or 20% applies
                (5% for 194Q &amp; 194O).
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
