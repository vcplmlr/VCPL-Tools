import { numberToWordsIndian } from './numberToWords';

export type BankId = 'sbi' | 'hdfc';
export type BankFormType = 'deposit' | 'dd' | 'rtgs';
export type PreviewMode = 'full' | 'data';

export const SBI_DD_DENOMS = [500, 200, 100, 50, 20, 10, 5, 2, 1] as const;

export interface UnifiedChequeItem {
  bankBranch: string;
  city: string;
  chequeNo: string;
  date: string;
  amount: string;
}

export interface BankFormState {
  branch: string;
  branchCode: string;
  date: string;
  name: string;
  accountNo: string;
  accountType: 'current' | 'savings' | 'overdraft' | 'cc' | 'loan';
  depositorName: string;
  mobile: string;
  pan: string;
  form60: boolean;
  tel: string;
  email: string;
  address: string;
  creditCardNo: string;
  loanNo: string;
  loanTicked: boolean;
  special: string;

  // Deposit specific
  depositMode: 'cash' | 'cheque' | 'both';
  hdfcDepositType: 'cash' | 'local' | 'out' | 'cc' | 'loan';
  notes: Record<number, string>;
  coins: string;
  cheques: UnifiedChequeItem[];

  // DD specific
  ddIssueType: 'dd' | 'bc' | '';
  ddTicked: boolean;
  ddCodeNo: string;
  ddDeliverTo: string;
  ddFavouring: string;
  ddPayableAt: string;
  ddAmount: string;
  ddExchange: string;
  ddChequeNo: string;
  ddChequeDate: string;

  // RTGS / NEFT specific
  rtgsType: 'rtgs' | 'neft' | '';
  rtgsMode: 'chq' | 'trf' | '';
  rtgsTime: string;
  rtgsChequeNo: string;
  rtgsChequeDate: string;
  rtgsBenName: string;
  rtgsBenBank: string;
  rtgsBenContact: string;
  rtgsBenAddress: string;
  rtgsBenIfsc: string;
  rtgsBenAccount: string;
  rtgsBenAccountConfirm: string;
  rtgsAmount: string;
  rtgsCharges: string;
  rtgsPurpose: string;
  rtgsRemarks: string;
  rtgsBanv: '' | '1' | '2';
  rtgsBenAcType: '' | 'res' | 'nr' | 'fcra';
  rtgsLei: string;
  rtgsLeiExpiry: string;
  rtgsBenLei: string;
  rtgsBenLeiExpiry: string;
  rtgsNonHdfcCash: string;
  rtgsNepalPurpose?: '' | 'family' | 'retirement' | 'pension' | 'others';
  rtgsNepalPurposeOther?: string;
}

export interface RenderedSlipOutput {
  title: string;
  orientation: 'landscape' | 'portrait';
  width: number;
  height: number;
  fontClass: string;
  backFontClass?: string;
  frontHtml: string;
  backHtml: string | null;
  cashTotal: number;
  chequeTotal: number;
  grandTotal: number;
  requiresPanAlert: boolean;
  warning: string | null;
  pdfFilename: string;
}

export const BANK_PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const BANK_IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export function getAccountBoxLimit(bankId: BankId, formType: BankFormType): number {
  if (formType === 'dd' && bankId === 'sbi') return 11;
  if (formType === 'rtgs' && bankId === 'hdfc') return 18;
  return bankId === 'hdfc' ? 14 : 17;
}

export function getBeneficiaryBoxLimit(bankId: BankId): number {
  return bankId === 'hdfc' ? 16 : 18;
}

export type BankSlipFixActionId =
  | 'switch-to-neft'
  | 'switch-rtgs-to-chq'
  | 'clear-cash-notes'
  | 'sync-dd-notes'
  | 'mirror-ben-account'
  | 'normalize-ifsc'
  | 'normalize-pan';

export interface BankSlipAuditIssue {
  id: string;
  sev: 'err' | 'warn';
  code: string;
  message: string;
  fixLabel?: string;
  fixAction?: BankSlipFixActionId;
}

export function auditBankFormState(
  bankId: BankId,
  formType: BankFormType,
  state: BankFormState,
  output: RenderedSlipOutput
): BankSlipAuditIssue[] {
  const issues: BankSlipAuditIssue[] = [];
  const acct = state.accountNo.trim();
  const acctLimit = getAccountBoxLimit(bankId, formType);
  const pan = state.pan.trim().toUpperCase();
  const ifsc = state.rtgsBenIfsc.trim().toUpperCase();

  if (acct && acct.length > acctLimit) {
    issues.push({
      id: 'acct-box-overflow',
      sev: 'warn',
      code: 'A/c Box Overflow',
      message: `${acct.length} characters entered; ${bankId.toUpperCase()} ${formType.toUpperCase()} slip prints ${acctLimit} digit boxes (extra digits will clip).`,
    });
  }

  if (state.mobile && !/^\d{10}$/.test(state.mobile.trim())) {
    issues.push({
      id: 'mobile-digits',
      sev: 'warn',
      code: 'Mobile Format',
      message: 'Mobile number should be 10 numeric digits.',
    });
  }

  if (pan && !BANK_PAN_REGEX.test(pan)) {
    issues.push({
      id: 'pan-format',
      sev: 'err',
      code: 'Invalid PAN',
      message: `"${pan}" does not match 10-character PAN format (e.g. ABCDE1234F).`,
      ...(pan !== state.pan ? { fixLabel: 'Normalize Case', fixAction: 'normalize-pan' as const } : {}),
    });
  }

  if (output.requiresPanAlert && !pan && !(bankId === 'sbi' && formType === 'deposit' && state.form60)) {
    issues.push({
      id: 'rule-114b-pan',
      sev: 'err',
      code: 'Rule 114B PAN',
      message:
        bankId === 'sbi' && formType === 'deposit'
          ? 'Amount >= ₹50,000 requires a valid 10-character PAN or Form 60 ticked.'
          : 'Amount >= ₹50,000 requires a valid 10-character PAN under Income Tax Rule 114B.',
    });
  }

  const activeCheques = state.cheques.filter(
    (c) => (parseFloat(c.amount) || 0) > 0 || c.chequeNo.trim() || c.bankBranch.trim()
  );

  if (formType === 'deposit') {
    const useChq = state.depositMode === 'cheque' || state.depositMode === 'both';
    const useCash = state.depositMode === 'cash' || state.depositMode === 'both';
    const maxRows = bankId === 'sbi' ? 3 : 6;
    const totalLeftRows = (useCash && output.cashTotal > 0 ? 1 : 0) + (useChq ? activeCheques.length : 0);

    if (totalLeftRows > maxRows || (useChq && activeCheques.length > maxRows)) {
      issues.push({
        id: 'deposit-row-overflow',
        sev: 'warn',
        code: 'Slip Row Limit',
        message: `${bankId.toUpperCase()} counterfoil displays ${maxRows} ledger row(s); extra entries require a second pay-in slip.`,
      });
    }

    if (useChq) {
      activeCheques.forEach((c, i) => {
        const cAmt = parseFloat(c.amount) || 0;
        if (cAmt > 0 && !c.chequeNo.trim()) {
          issues.push({
            id: `chq-missing-${i}`,
            sev: 'err',
            code: `Cheque #${i + 1}`,
            message: `Cheque #${i + 1} has an amount (₹${fmtIn(cAmt)}) without a Cheque Number.`,
          });
        } else if (c.chequeNo.trim() && !/^\d{6}$/.test(c.chequeNo.trim())) {
          issues.push({
            id: `chq-len-${i}`,
            sev: 'warn',
            code: `Cheque #${i + 1}`,
            message: 'CTS cheques in India typically use a 6-digit cheque number.',
          });
        }
        if (c.date && state.date) {
          const chqDt = new Date(`${c.date}T00:00:00Z`);
          const depDt = new Date(`${state.date}T00:00:00Z`);
          const diffDays = Math.floor((depDt.getTime() - chqDt.getTime()) / 86400000);
          if (diffDays > 90) {
            issues.push({
              id: `chq-stale-${i}`,
              sev: 'warn',
              code: `Stale Cheque #${i + 1}`,
              message: `Cheque date (${c.date}) is over 90 days older than deposit date (CTS validity limit is 3 months).`,
            });
          }
        }
      });
    }
  }

  if (formType === 'dd') {
    if (bankId === 'hdfc') {
      if (output.cashTotal > 0) {
        issues.push({
          id: 'hdfc-dd-cash',
          sev: 'warn',
          code: 'Cheque-Only Form',
          message: 'HDFC DD Application Form accepts payment by Cheque only — cash notes are ignored.',
          fixLabel: 'Clear Cash Notes',
          fixAction: 'clear-cash-notes',
        });
      }
      if ((parseFloat(state.ddAmount) || 0) > 0 && !state.ddChequeNo.trim()) {
        issues.push({
          id: 'hdfc-dd-chq',
          sev: 'err',
          code: 'Missing DD Cheque No',
          message: 'Enter Payment Cheque No. required by HDFC Cheque-Only DD form.',
        });
      }
    } else if (bankId === 'sbi') {
      if (output.cashTotal > 0 && output.grandTotal > 0 && Math.abs(output.cashTotal - output.grandTotal) > 0.5) {
        issues.push({
          id: 'sbi-dd-tally',
          sev: 'err',
          code: 'DD Note Tally Mismatch',
          message: `Cash notes (₹${fmtIn(output.cashTotal)}) disagree with Draft + Exchange (₹${fmtIn(output.grandTotal)}).`,
          fixLabel: 'Auto-Split Total',
          fixAction: 'sync-dd-notes',
        });
      }
    }
  }

  if (formType === 'rtgs') {
    const amt = parseFloat(state.rtgsAmount) || 0;
    if (state.rtgsType === 'rtgs' && amt > 0 && amt < 200000) {
      issues.push({
        id: 'rtgs-min-2l',
        sev: 'err',
        code: 'RTGS ₹2L Minimum',
        message: 'RBI RTGS requires at least ₹2,00,000. Use NEFT for smaller transfers.',
        fixLabel: 'Switch to NEFT',
        fixAction: 'switch-to-neft',
      });
    }
    if (bankId === 'sbi' && state.rtgsType === 'rtgs' && state.rtgsMode === 'trf') {
      issues.push({
        id: 'sbi-rtgs-trf',
        sev: 'err',
        code: 'SBI Mode Violation',
        message: 'SBI slip specifies "Transfer (only NEFT)" — RTGS remittances require Cheque mode.',
        fixLabel: 'Switch to Cheque',
        fixAction: 'switch-rtgs-to-chq',
      });
    }
    if (ifsc && !BANK_IFSC_REGEX.test(ifsc)) {
      issues.push({
        id: 'ifsc-format',
        sev: 'err',
        code: 'Invalid IFSC',
        message: `"${ifsc}" must be 11 characters with "0" as the 5th character (e.g. HDFC0001234).`,
        ...(ifsc !== state.rtgsBenIfsc ? { fixLabel: 'Normalize Case', fixAction: 'normalize-ifsc' as const } : {}),
      });
    }
    const benLimit = getBeneficiaryBoxLimit(bankId);
    if (state.rtgsBenAccount.trim().length > benLimit) {
      issues.push({
        id: 'ben-acct-limit',
        sev: 'warn',
        code: 'Beneficiary A/c Clip',
        message: `Beneficiary Account (${state.rtgsBenAccount.trim().length} chars) exceeds ${benLimit} boxes on ${bankId.toUpperCase()} slip.`,
      });
    }
    if (state.rtgsBenAccount && !state.rtgsBenAccountConfirm) {
      issues.push({
        id: 'ben-confirm-empty',
        sev: 'warn',
        code: 'Re-Confirm Blank',
        message: 'Re-Confirm Beneficiary Account No. is empty.',
        fixLabel: 'Copy A/c No.',
        fixAction: 'mirror-ben-account',
      });
    } else if (
      state.rtgsBenAccount &&
      state.rtgsBenAccountConfirm &&
      state.rtgsBenAccount !== state.rtgsBenAccountConfirm
    ) {
      issues.push({
        id: 'ben-confirm-mismatch',
        sev: 'err',
        code: 'A/c Re-Confirm Mismatch',
        message: 'Beneficiary Account No. and Re-Confirm Account No. do not match.',
      });
    }
  }

  return issues;
}

export function createInitialBankFormState(): BankFormState {
  const today = new Date().toISOString().split('T')[0];
  return {
    branch: '',
    branchCode: '',
    date: today,
    name: '',
    accountNo: '',
    accountType: 'savings',
    depositorName: '',
    mobile: '',
    pan: '',
    form60: false,
    tel: '',
    email: '',
    address: '',
    creditCardNo: '',
    loanNo: '',
    loanTicked: false,
    special: '',
    depositMode: 'cash',
    hdfcDepositType: 'cash',
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
    cheques: [
      { bankBranch: '', city: '', chequeNo: '', date: '', amount: '' },
      { bankBranch: '', city: '', chequeNo: '', date: '', amount: '' },
      { bankBranch: '', city: '', chequeNo: '', date: '', amount: '' },
      { bankBranch: '', city: '', chequeNo: '', date: '', amount: '' },
      { bankBranch: '', city: '', chequeNo: '', date: '', amount: '' },
      { bankBranch: '', city: '', chequeNo: '', date: '', amount: '' },
    ],
    ddIssueType: 'dd',
    ddTicked: true,
    ddCodeNo: '',
    ddDeliverTo: '',
    ddFavouring: '',
    ddPayableAt: '',
    ddAmount: '',
    ddExchange: '',
    ddChequeNo: '',
    ddChequeDate: '',
    rtgsType: 'neft',
    rtgsMode: 'chq',
    rtgsTime: '',
    rtgsChequeNo: '',
    rtgsChequeDate: '',
    rtgsBenName: '',
    rtgsBenBank: '',
    rtgsBenContact: '',
    rtgsBenAddress: '',
    rtgsBenIfsc: '',
    rtgsBenAccount: '',
    rtgsBenAccountConfirm: '',
    rtgsAmount: '',
    rtgsCharges: '',
    rtgsPurpose: '',
    rtgsRemarks: '',
    rtgsBanv: '1',
    rtgsBenAcType: 'res',
    rtgsLei: '',
    rtgsLeiExpiry: '',
    rtgsBenLei: '',
    rtgsBenLeiExpiry: '',
    rtgsNonHdfcCash: '',
    rtgsNepalPurpose: '',
    rtgsNepalPurposeOther: '',
  };
}

export function fmtIn(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '';
  const hasDecimal = Math.round((value - Math.floor(value)) * 100) > 0;
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: hasDecimal ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

function esc(val: unknown): string {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDmy(iso: string): { d: string; m: string; y: string; full: string } {
  const m = String(iso || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return { d: '', m: '', y: '', full: esc(iso) };
  return { d: m[3], m: m[2], y: m[1], full: `${m[3]}/${m[2]}/${m[1]}` };
}

function renderDigitBoxes(
  value: string,
  boxCount: number,
  boxWidth = 19,
  boxHeight = 22,
  fontSize = 12,
  borderColor = '#1e293b',
  placeholders?: string[]
): string {
  const chars = String(value || '').slice(0, boxCount).split('');
  return `<span style="display:inline-flex;align-items:center;vertical-align:middle;">${Array.from({ length: boxCount })
    .map((_, i) => {
      const ch = chars[i];
      const ph = placeholders?.[i];
      const inner = ch
        ? `<span class="slip-val" style="color:#000;">${esc(ch)}</span>`
        : ph
        ? `<span class="slip-lbl" style="color:#94a3b8;font-weight:600;font-size:${Math.max(8.5, fontSize - 1)}px;">${esc(ph)}</span>`
        : `<span class="slip-val" style="color:#000;">&nbsp;</span>`;
      return `<span class="slip-grid" style="display:inline-flex;align-items:center;justify-content:center;width:${boxWidth}px;height:${boxHeight}px;border:1px solid ${borderColor};margin-right:-1px;font-family:'JetBrains Mono',monospace;font-size:${fontSize}px;font-weight:700;background:#fff;box-sizing:border-box;">${inner}</span>`;
    })
    .join('')}</span>`;
}

function renderGroupedBoxes(
  value: string,
  groups: number[],
  boxWidth = 18,
  boxHeight = 21,
  gap = 5
): string {
  const clean = String(value || '');
  let offset = 0;
  return `<span style="display:inline-flex;align-items:center;gap:${gap}px;vertical-align:middle;">${groups
    .map((count) => {
      const slice = clean.slice(offset, offset + count);
      offset += count;
      return renderDigitBoxes(slice, count, boxWidth, boxHeight, 11.5, '#1e293b');
    })
    .join('')}</span>`;
}

function renderCheckbox(checked: boolean, size = 13): string {
  return `<span class="slip-grid" style="display:inline-flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border:1.25px solid #0f172a;background:#fff;vertical-align:middle;box-sizing:border-box;flex-shrink:0;"><span class="slip-val" style="font-size:${Math.max(9, size - 2)}px;font-weight:900;line-height:1;color:#000;">${checked ? '✓' : ''}</span></span>`;
}

function renderSbiKeyholeSvg(size = 24, bgColor = '#111827'): string {
  return `<svg class="slip-lbl" width="${size}" height="${size}" viewBox="0 0 32 32" style="flex-shrink:0;vertical-align:middle;">
    <circle cx="16" cy="16" r="15" fill="${bgColor}" />
    <circle cx="16" cy="12" r="4.2" fill="#ffffff" />
    <rect x="14.2" y="15.5" width="3.6" height="15.5" fill="#ffffff" />
  </svg>`;
}

function renderHdfcLogoSvg(squareSize = 22, mono = false): string {
  const red = mono ? '#111827' : '#ed232a';
  const blue = mono ? '#111827' : '#004c8f';
  return `<span class="slip-lbl" style="display:inline-flex;align-items:center;gap:6px;vertical-align:middle;">
    <svg width="${squareSize}" height="${squareSize}" viewBox="0 0 28 28" style="flex-shrink:0;">
      <rect x="0" y="0" width="28" height="28" fill="${red}" />
      <rect x="4.5" y="4.5" width="19" height="19" fill="#ffffff" />
      <rect x="0" y="11.5" width="28" height="5" fill="#ffffff" />
      <rect x="11.5" y="0" width="5" height="28" fill="#ffffff" />
      <rect x="9.5" y="9.5" width="9" height="9" fill="${blue}" />
    </svg>
    <span style="display:inline-flex;flex-direction:column;line-height:1.05;">
      <span style="font-size:${Math.round(squareSize * 0.72)}px;font-weight:900;color:${blue};letter-spacing:0.4px;">HDFC BANK</span>
      <span style="font-size:${Math.max(8, Math.round(squareSize * 0.36))}px;font-weight:600;color:#334155;">We understand your world</span>
    </span>
  </span>`;
}

function splitRupeesPaise(val: number): { rs: string; ps: string } {
  if (!Number.isFinite(val) || val <= 0) return { rs: '', ps: '' };
  const whole = Math.floor(val);
  const paise = Math.round((val - whole) * 100);
  return {
    rs: whole.toLocaleString('en-IN'),
    ps: paise > 0 ? String(paise).padStart(2, '0') : '00',
  };
}

function computeCashTotal(notes: Record<number, string>, coinsStr: string, denoms: readonly number[]): number {
  let sum = 0;
  denoms.forEach((d) => {
    const cnt = parseInt(notes[d] || '0', 10) || 0;
    if (cnt > 0) sum += cnt * d;
  });
  const c = parseFloat(coinsStr);
  if (Number.isFinite(c) && c > 0) sum += c;
  return Math.round(sum * 100) / 100;
}

const DEPOSIT_DENOMS_LIST = [500, 200, 100, 50, 20, 10, 5, 2, 1] as const;

export function renderBankSlip(
  bankId: BankId,
  formType: BankFormType,
  state: BankFormState
): RenderedSlipOutput {
  const cashTotal = computeCashTotal(
    state.notes,
    state.coins,
    formType === 'dd' && bankId === 'sbi' ? SBI_DD_DENOMS : DEPOSIT_DENOMS_LIST
  );

  const activeCheques = state.cheques.filter(
    (c) => (parseFloat(c.amount) || 0) > 0 || c.chequeNo.trim() || c.bankBranch.trim()
  );
  const chequeTotal = activeCheques.reduce((acc, c) => acc + (parseFloat(c.amount) || 0), 0);

  const dateObj = formatDmy(state.date);
  const chqDateObj = formatDmy(state.rtgsChequeDate || state.ddChequeDate || state.date);
  const leiExpObj = formatDmy(state.rtgsLeiExpiry);
  const benLeiExpObj = formatDmy(state.rtgsBenLeiExpiry);

  // ===========================================================================
  // 1. SBI DEPOSIT / PAY IN SLIP (1568 x 610 Landscape — Official Form 100999131-V3)
  // ===========================================================================
  if (bankId === 'sbi' && formType === 'deposit') {
    const useCash = state.depositMode === 'cash' || state.depositMode === 'both';
    const useChq = state.depositMode === 'cheque' || state.depositMode === 'both';
    const grandTotal = Math.round(((useCash ? cashTotal : 0) + (useChq ? chequeTotal : 0)) * 100) / 100;
    const requiresPanAlert = useCash && cashTotal >= 50000;
    const words = grandTotal > 0 ? numberToWordsIndian(grandTotal) : '';
    const { rs: gRs, ps: gPs } = splitRupeesPaise(grandTotal);

    const counterfoilRows: { label: string; rs: string; ps: string }[] = [];
    if (useCash && cashTotal > 0) {
      const sp = splitRupeesPaise(cashTotal);
      counterfoilRows.push({ label: 'CASH DEPOSIT', rs: sp.rs, ps: sp.ps });
    }
    if (useChq) {
      activeCheques.forEach((c) => {
        const sp = splitRupeesPaise(parseFloat(c.amount) || 0);
        const dt = c.date ? formatDmy(c.date).full : '';
        counterfoilRows.push({
          label: `${c.chequeNo || 'CHQ'} ${dt ? dt : ''} ${c.bankBranch || ''} ${c.city || ''}`.trim(),
          rs: sp.rs,
          ps: sp.ps,
        });
      });
    }

    const bankCopyChequeRows: { label: string; rs: string; ps: string }[] = [];
    if (useChq) {
      activeCheques.forEach((c) => {
        const sp = splitRupeesPaise(parseFloat(c.amount) || 0);
        const dt = c.date ? formatDmy(c.date).full : '';
        bankCopyChequeRows.push({
          label: `${c.chequeNo || ''} ${dt ? '/ ' + dt : ''} ${c.bankBranch ? '/ ' + c.bankBranch : ''} ${c.city || ''}`.trim(),
          rs: sp.rs,
          ps: sp.ps,
        });
      });
    }

    const acctTooLong = state.accountNo.trim().length > 17;
    const warning =
      counterfoilRows.length > 3 || activeCheques.length > 3
        ? `Official SBI slip has 3 ledger rows (${Math.max(counterfoilRows.length, activeCheques.length)} entered). Extra cheques may need a second slip.`
        : acctTooLong
        ? `Account number (${state.accountNo.trim().length} chars) exceeds 17 printed boxes on SBI slip.`
        : null;

    // Current Indian currency denominations: 500, 200, 100, 50, 20, 10, 5, 2, 1 + Coins
    const extraMiscCash = useCash ? parseFloat(state.coins) || 0 : 0;

    const sbiOfficialDenoms = [500, 200, 100, 50, 20, 10, 5, 2, 1];
    const centerDenomRows = sbiOfficialDenoms
      .map((d) => {
        const cnt = useCash ? parseInt(state.notes[d] || '0', 10) || 0 : 0;
        const amt = cnt * d;
        const sp = splitRupeesPaise(amt);
        return `
          <tr>
            <td class="slip-lbl" style="padding:2px 6px;border:1px solid #334155;text-align:center;font-weight:600;font-size:11px;">${d} x</td>
            <td style="padding:2px 6px;border:1px solid #334155;text-align:center;font-family:'JetBrains Mono',monospace;font-size:11px;"><span class="slip-val">${cnt > 0 ? cnt : ''}</span></td>
            <td style="padding:2px 8px;border:1px solid #334155;text-align:right;font-family:'JetBrains Mono',monospace;font-weight:700;font-size:11px;"><span class="slip-val">${sp.rs}</span></td>
            <td style="padding:2px 4px;border:1px solid #334155;text-align:center;font-family:'JetBrains Mono',monospace;font-size:11px;"><span class="slip-val">${amt > 0 ? sp.ps : ''}</span></td>
          </tr>`;
      })
      .join('');

    const coinsSp = splitRupeesPaise(extraMiscCash);
    const totalCashSp = splitRupeesPaise(useCash ? cashTotal : 0);
    const bankChequeTotalSp = splitRupeesPaise(useChq ? chequeTotal : 0);

    const frontHtml = `
      <div class="slip-frame" style="width:1568px;height:610px;background:#ffffff;border:1.5px solid #0f172a;font-family:'DM Sans',Arial,sans-serif;color:#0f172a;display:flex;box-sizing:border-box;">
        <!-- LEFT PANEL: CUSTOMER COUNTERFOIL -->
        <div style="width:518px;padding:18px 20px;border-right:2px dashed #334155;display:flex;flex-direction:column;justify-content:space-between;box-sizing:border-box;">
          <div>
            <div class="slip-lbl" style="text-align:center;font-size:15px;font-weight:800;letter-spacing:0.4px;margin-bottom:6px;">DEPOSIT / PAY IN SLIP</div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
              ${renderSbiKeyholeSvg(24)}
              <span class="slip-lbl" style="font-size:14px;font-weight:800;color:#0f172a;">State Bank of India</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:10px;font-size:12px;">
              <div style="flex:1;display:flex;align-items:flex-end;gap:4px;margin-right:10px;">
                <span class="slip-lbl" style="font-weight:700;white-space:nowrap;">Branch :</span>
                <span class="slip-grid" style="flex:1;border-bottom:1px solid #1e293b;min-height:17px;padding:0 4px;"><span class="slip-val" style="font-weight:700;">${esc(state.branch)}</span></span>
              </div>
              <div style="white-space:nowrap;">
                <span class="slip-lbl">Date : </span>
                <span class="slip-val" style="font-family:'JetBrains Mono',monospace;font-weight:700;">${dateObj.d || '__'}</span>
                <span class="slip-lbl"> / </span>
                <span class="slip-val" style="font-family:'JetBrains Mono',monospace;font-weight:700;">${dateObj.m || '__'}</span>
                <span class="slip-lbl"> /20</span>
                <span class="slip-val" style="font-family:'JetBrains Mono',monospace;font-weight:700;">${dateObj.y ? dateObj.y.slice(2) : '__'}</span>
              </div>
            </div>

            <div style="margin-bottom:10px;">
              <div class="slip-lbl" style="font-size:9.5px;color:#1e293b;margin-bottom:2px;">SB/CA/RD/OD/CC/TL/DL A/c No./Credit Card No.</div>
              <div>${renderDigitBoxes(state.accountNo || state.creditCardNo, 17, 25, 22, 12)}</div>
            </div>

            <div style="display:flex;align-items:flex-end;gap:6px;margin-bottom:8px;font-size:12px;">
              <span class="slip-lbl" style="white-space:nowrap;">Name</span>
              <span class="slip-grid" style="flex:1;border-bottom:1px solid #1e293b;min-height:18px;padding:0 4px;"><span class="slip-val" style="font-weight:700;">${esc(state.name)}</span></span>
            </div>

            <div style="display:flex;align-items:flex-end;gap:6px;margin-bottom:10px;font-size:12px;">
              <span class="slip-lbl" style="white-space:nowrap;">Tel. No.</span>
              <span class="slip-grid" style="flex:1;border-bottom:1px solid #1e293b;min-height:18px;padding:0 4px;"><span class="slip-val" style="font-family:'JetBrains Mono',monospace;font-weight:600;">${esc(state.mobile || state.tel)}</span></span>
            </div>

            <div style="display:flex;align-items:flex-end;gap:8px;margin-bottom:10px;font-size:12px;">
              <span class="slip-lbl" style="white-space:nowrap;">Amount</span>
              <div style="flex:1;">
                <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:700;padding:0 12px 2px 90px;">
                  <span class="slip-lbl">₹</span>
                  <span class="slip-lbl">P.</span>
                </div>
                <div class="slip-grid" style="display:flex;border:1px solid #1e293b;height:24px;">
                  <div class="slip-grid" style="flex:1;border-right:1px solid #1e293b;display:flex;align-items:center;justify-content:flex-end;padding:0 8px;font-family:'JetBrains Mono',monospace;font-weight:800;font-size:13px;"><span class="slip-val">${gRs}</span></div>
                  <div style="width:36px;display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono',monospace;font-weight:700;"><span class="slip-val">${grandTotal > 0 ? gPs : ''}</span></div>
                </div>
              </div>
            </div>

            <div style="margin-bottom:10px;font-size:11.5px;">
              <div style="display:flex;align-items:flex-end;gap:6px;">
                <span class="slip-lbl" style="white-space:nowrap;">Rupees in words</span>
                <span class="slip-grid" style="flex:1;border-bottom:1px solid #1e293b;min-height:17px;padding:0 4px;line-height:1.25;"><span class="slip-val" style="font-weight:700;font-size:10.5px;">${esc(words)}</span></span>
              </div>
              <div class="slip-grid" style="border-bottom:1px solid #1e293b;height:15px;"></div>
            </div>

            <!-- Counterfoil 3-Row Ledger -->
            <table style="width:100%;border-collapse:collapse;font-size:11px;">
              <thead>
                <tr style="background:#262626;color:#ffffff;">
                  <th class="slip-lbl" style="padding:4px 6px;border:1px solid #262626;text-align:left;font-weight:600;">Cash/Cheque No./Date &amp; Name of Bank &amp; Branch</th>
                  <th class="slip-lbl" style="padding:4px 6px;border:1px solid #262626;text-align:center;width:110px;">₹</th>
                  <th class="slip-lbl" style="padding:4px 4px;border:1px solid #262626;text-align:center;width:30px;">P.</th>
                </tr>
              </thead>
              <tbody>
                ${[0, 1, 2]
                  .map((i) => {
                    const row = counterfoilRows[i];
                    return `
                      <tr>
                        <td style="padding:4px 6px;border:1px solid #334155;height:24px;font-size:10.5px;"><span class="slip-val" style="font-weight:600;">${row ? esc(row.label) : '&nbsp;'}</span></td>
                        <td style="padding:4px 8px;border:1px solid #334155;text-align:right;font-family:'JetBrains Mono',monospace;font-weight:700;"><span class="slip-val">${row ? row.rs : ''}</span></td>
                        <td style="padding:4px 4px;border:1px solid #334155;text-align:center;font-family:'JetBrains Mono',monospace;"><span class="slip-val">${row ? row.ps : ''}</span></td>
                      </tr>`;
                  })
                  .join('')}
                <tr>
                  <td class="slip-lbl" style="padding:4px 10px;border:none;text-align:right;font-weight:700;">Total</td>
                  <td style="padding:4px 8px;border:1px solid #334155;text-align:right;font-family:'JetBrains Mono',monospace;font-weight:800;font-size:12px;"><span class="slip-val">${gRs}</span></td>
                  <td style="padding:4px 4px;border:1px solid #334155;text-align:center;font-family:'JetBrains Mono',monospace;font-weight:700;"><span class="slip-val">${grandTotal > 0 ? gPs : ''}</span></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:flex-end;font-size:11px;padding-top:6px;">
            <div class="slip-lbl" style="font-weight:600;padding-bottom:6px;">SWO / Passing Officer</div>
            <div class="slip-grid slip-lbl" style="border:1px solid #1e293b;padding:7px 12px;text-align:center;font-size:10.5px;line-height:1.35;">
              <div>SBI toll free, 24 Hours Call Centre</div>
              <div style="font-weight:700;">No. 18004253800, 1800112211</div>
            </div>
          </div>
        </div>

        <!-- RIGHT SIDE (CENTER CASH PANEL + BANK COPY) -->
        <div style="flex:1;padding:18px 22px 16px 20px;display:flex;gap:18px;box-sizing:border-box;position:relative;">
          <!-- CENTER PANEL: PAN + CASH DEPOSIT + 3 RULES -->
          <div style="width:430px;display:flex;flex-direction:column;justify-content:flex-end;gap:10px;padding-top:26px;box-sizing:border-box;">
            <div class="slip-grid" style="border:1px solid #334155;">
              <div style="padding:8px 10px 6px 10px;">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
                  <div class="slip-lbl" style="font-size:10.5px;font-weight:700;line-height:1.15;width:58px;">PAN NO.<br/>OR<br/>Form 60</div>
                  <div style="display:flex;flex-direction:column;gap:5px;">
                    <div>${renderDigitBoxes(state.pan, 10, 22, 20, 11)}</div>
                    <div style="display:flex;align-items:center;gap:14px;">
                      ${renderCheckbox(state.form60, 15)}
                      <span class="slip-lbl" style="font-size:10px;font-weight:600;">For Cash Deposit of ₹ 50,000/- &amp; Above</span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="slip-lbl" style="background:#262626;color:#ffffff;text-align:center;font-weight:800;font-size:12px;padding:3px 0;letter-spacing:0.6px;">CASH DEPOSIT</div>

              <table style="width:100%;border-collapse:collapse;font-size:11.5px;">
                <thead>
                  <tr>
                    <th class="slip-lbl" style="padding:4px 8px;border:1px solid #334155;text-align:center;width:72px;">Notes</th>
                    <th class="slip-lbl" style="padding:4px 6px;border:1px solid #334155;text-align:center;width:62px;">No.</th>
                    <th class="slip-lbl" style="padding:4px 8px;border:1px solid #334155;text-align:center;">₹</th>
                    <th class="slip-lbl" style="padding:4px 4px;border:1px solid #334155;text-align:center;width:34px;">P.</th>
                  </tr>
                </thead>
                <tbody>
                  ${centerDenomRows}
                  <tr>
                    <td class="slip-lbl" style="padding:2px 6px;border:1px solid #334155;text-align:center;font-weight:600;font-size:11px;">Coins</td>
                    <td style="padding:2px 6px;border:1px solid #334155;"></td>
                    <td style="padding:2px 8px;border:1px solid #334155;text-align:right;font-family:'JetBrains Mono',monospace;font-weight:700;font-size:11px;"><span class="slip-val">${coinsSp.rs}</span></td>
                    <td style="padding:2px 4px;border:1px solid #334155;text-align:center;font-family:'JetBrains Mono',monospace;font-size:11px;"><span class="slip-val">${extraMiscCash > 0 ? coinsSp.ps : ''}</span></td>
                  </tr>
                  <tr>
                    <td class="slip-lbl" colspan="2" style="padding:3px 10px;border-top:1px solid #334155;text-align:right;font-weight:700;">Total</td>
                    <td style="padding:3px 8px;border:1px solid #334155;text-align:right;font-family:'JetBrains Mono',monospace;font-weight:800;"><span class="slip-val">${totalCashSp.rs}</span></td>
                    <td style="padding:3px 4px;border:1px solid #334155;text-align:center;font-family:'JetBrains Mono',monospace;font-weight:700;"><span class="slip-val">${useCash && cashTotal > 0 ? totalCashSp.ps : ''}</span></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="slip-grid slip-lbl" style="border:1px solid #334155;padding:7px 10px;font-size:10px;line-height:1.45;">
              <div>1. All Cheques must be crossed.</div>
              <div>2. Please mention your A/c No. and Name on back of the Cheque.</div>
              <div>3. Please use separate slips for Cash Deposit, Outstation Cheques and Local Cheques.</div>
            </div>
          </div>

          <!-- RIGHT BANK COPY -->
          <div style="flex:1;display:flex;flex-direction:column;justify-content:space-between;box-sizing:border-box;padding-right:12px;">
            <div>
              <div class="slip-lbl" style="text-align:center;font-size:15px;font-weight:800;letter-spacing:0.4px;margin-bottom:6px;">DEPOSIT / PAY IN SLIP</div>
              <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:6px;">
                <div style="flex:1;margin-right:10px;">
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;">
                    ${renderSbiKeyholeSvg(24)}
                    <span class="slip-lbl" style="font-size:14px;font-weight:800;color:#0f172a;">State Bank of India</span>
                  </div>
                  <div style="display:flex;align-items:flex-end;gap:4px;font-size:12px;">
                    <span class="slip-lbl" style="font-weight:700;white-space:nowrap;">Branch :</span>
                    <span class="slip-grid" style="flex:1;border-bottom:1px solid #1e293b;min-height:17px;padding:0 4px;"><span class="slip-val" style="font-weight:700;">${esc(state.branch)}</span></span>
                  </div>
                </div>
                <div style="display:flex;align-items:center;gap:6px;">
                  <span class="slip-lbl" style="font-size:12px;">Date</span>
                  ${renderDigitBoxes(`${dateObj.d}${dateObj.m}${dateObj.y}`, 8, 22, 24, 11.5)}
                </div>
              </div>

              <div style="margin-bottom:10px;">
                <div class="slip-lbl" style="font-size:9.5px;color:#1e293b;margin-bottom:2px;">SB/CA/RD/OD/CC/TL/DL A/c No./Credit Card No.</div>
                <div>${renderDigitBoxes(state.accountNo || state.creditCardNo, 17, 29, 24, 12.5)}</div>
              </div>

              <div style="display:flex;align-items:flex-end;gap:6px;margin-bottom:9px;font-size:12px;">
                <span class="slip-lbl" style="white-space:nowrap;">Name</span>
                <span class="slip-grid" style="flex:1;border-bottom:1px solid #1e293b;min-height:18px;padding:0 4px;"><span class="slip-val" style="font-weight:700;">${esc(state.name)}</span></span>
              </div>

              <div style="display:flex;align-items:flex-end;gap:6px;margin-bottom:9px;font-size:12px;">
                <span class="slip-lbl" style="white-space:nowrap;">Tel. No./Mobile No.</span>
                <span class="slip-grid" style="flex:1;border-bottom:1px solid #1e293b;min-height:18px;padding:0 4px;"><span class="slip-val" style="font-family:'JetBrains Mono',monospace;font-weight:600;">${esc(state.mobile || state.tel)}</span></span>
              </div>

              <div style="display:flex;align-items:flex-end;gap:6px;margin-bottom:9px;font-size:12px;">
                <span class="slip-lbl" style="white-space:nowrap;">E-mail ID</span>
                <span class="slip-grid" style="flex:1;border-bottom:1px solid #1e293b;min-height:18px;padding:0 4px;"><span class="slip-val">${esc(state.email)}</span></span>
              </div>

              <div style="margin-bottom:12px;font-size:12px;">
                <div style="display:flex;align-items:flex-end;gap:6px;">
                  <span class="slip-lbl" style="white-space:nowrap;">Rupees in words</span>
                  <span class="slip-grid" style="flex:1;border-bottom:1px solid #1e293b;min-height:18px;padding:0 4px;"><span class="slip-val" style="font-weight:700;font-size:11.5px;">${esc(words)}</span></span>
                </div>
                <div class="slip-grid" style="border-bottom:1px solid #1e293b;height:20px;"></div>
              </div>

              <!-- Bank Copy Cheque Table -->
              <table style="width:100%;border-collapse:collapse;font-size:11px;">
                <thead>
                  <tr style="background:#262626;color:#ffffff;">
                    <th class="slip-lbl" style="padding:4px 8px;border:1px solid #262626;text-align:center;font-weight:600;">Cheque No./Date/Name of Bank &amp; Branch</th>
                    <th class="slip-lbl" style="padding:4px 8px;border:1px solid #262626;text-align:center;width:120px;">₹</th>
                    <th class="slip-lbl" style="padding:4px 4px;border:1px solid #262626;text-align:center;width:32px;">P.</th>
                  </tr>
                </thead>
                <tbody>
                  ${[0, 1, 2]
                    .map((i) => {
                      const row = bankCopyChequeRows[i];
                      return `
                        <tr>
                          <td style="padding:4px 6px;border:1px solid #334155;height:25px;"><span class="slip-val" style="font-weight:600;">${row ? esc(row.label) : '&nbsp;'}</span></td>
                          <td style="padding:4px 8px;border:1px solid #334155;text-align:right;font-family:'JetBrains Mono',monospace;font-weight:700;"><span class="slip-val">${row ? row.rs : ''}</span></td>
                          <td style="padding:4px 4px;border:1px solid #334155;text-align:center;font-family:'JetBrains Mono',monospace;"><span class="slip-val">${row ? row.ps : ''}</span></td>
                        </tr>`;
                    })
                    .join('')}
                  <tr>
                    <td class="slip-lbl" style="padding:4px 10px;border:none;text-align:right;font-weight:700;">Total</td>
                    <td style="padding:4px 8px;border:1px solid #334155;text-align:right;font-family:'JetBrains Mono',monospace;font-weight:800;font-size:12px;"><span class="slip-val">${useChq && chequeTotal > 0 ? bankChequeTotalSp.rs : ''}</span></td>
                    <td style="padding:4px 4px;border:1px solid #334155;text-align:center;font-family:'JetBrains Mono',monospace;font-weight:700;"><span class="slip-val">${useChq && chequeTotal > 0 ? bankChequeTotalSp.ps : ''}</span></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style="display:flex;justify-content:space-between;align-items:flex-end;font-size:11px;padding-top:6px;">
              <div class="slip-grid slip-lbl" style="border:1px solid #334155;width:210px;height:66px;padding:6px 12px;display:flex;flex-direction:column;justify-content:space-between;box-sizing:border-box;">
                <div style="text-align:center;font-weight:600;">Transaction ID</div>
                <div style="display:flex;justify-content:space-between;">
                  <span>SWO</span>
                  <span>Passing Officer</span>
                </div>
              </div>
              <div style="text-align:right;padding-bottom:4px;min-width:170px;">
                <div style="min-height:16px;margin-bottom:2px;font-size:11px;"><span class="slip-val" style="font-weight:700;">${esc(state.depositorName)}</span></div>
                <div class="slip-grid slip-lbl" style="border-top:1px solid #1e293b;padding-top:3px;font-size:12px;font-weight:600;">Signature of Depositor</div>
              </div>
            </div>
          </div>

          <div class="slip-lbl" style="position:absolute;right:6px;bottom:22px;writing-mode:vertical-rl;transform:rotate(180deg);font-size:9.5px;color:#334155;letter-spacing:0.4px;">100999131-V3</div>
        </div>
      </div>`;

    const backHtml = `
      <div class="slip-frame" style="width:1568px;height:610px;background:#ffffff;border:1.5px solid #0f172a;font-family:'DM Sans','Noto Sans Devanagari',Arial,sans-serif;color:#0f172a;display:flex;box-sizing:border-box;">
        <!-- LEFT HALF (Blank behind counterfoil — extra continuation only if > 3 cheques) -->
        <div style="width:1048px;border-right:2px dashed #334155;padding:30px 36px;box-sizing:border-box;">
          ${
            activeCheques.length > 3
              ? `<div class="slip-lbl" style="font-size:13px;font-weight:800;margin-bottom:8px;">Additional Cheques Continuation</div>
                 <table style="width:70%;border-collapse:collapse;font-size:12px;">
                   <thead><tr style="background:#f1f5f9;"><th class="slip-lbl" style="padding:6px;border:1px solid #334155;text-align:left;">Cheque No &amp; Date</th><th class="slip-lbl" style="padding:6px;border:1px solid #334155;text-align:left;">Drawee Bank &amp; Branch</th><th class="slip-lbl" style="padding:6px;border:1px solid #334155;text-align:right;">Amount (₹)</th></tr></thead>
                   <tbody>
                     ${activeCheques
                       .slice(3)
                       .map(
                         (c) => `<tr><td style="padding:6px;border:1px solid #334155;"><span class="slip-val">${esc(c.chequeNo)} ${c.date ? '(' + formatDmy(c.date).full + ')' : ''}</span></td><td style="padding:6px;border:1px solid #334155;"><span class="slip-val">${esc(`${c.bankBranch} ${c.city}`.trim())}</span></td><td style="padding:6px;border:1px solid #334155;text-align:right;"><span class="slip-val">${fmtIn(parseFloat(c.amount) || 0)}</span></td></tr>`
                       )
                       .join('')}
                   </tbody>
                 </table>`
              : ''
          }
        </div>

        <!-- RIGHT HALF: OFFICIAL MISCELLANEOUS INSTRUCTIONS BOX -->
        <div style="flex:1;padding:24px 28px;display:flex;align-items:center;justify-content:center;box-sizing:border-box;">
          <div class="slip-grid slip-lbl" style="border:1px solid #1e293b;padding:18px 22px;width:100%;font-size:11px;line-height:1.45;box-sizing:border-box;">
            <div style="text-align:center;font-size:16px;font-weight:800;margin-bottom:12px;">विविध निर्देश / Miscellaneous Instructions</div>
            <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px;">
              <li>* कृपया अपनी पास बुक महीने में एक बार अवश्य अद्यतन करवाएं। Please get your Pass Book updated once in a month</li>
              <li>* कृपया अपने खाते के विवरण / इंटरनेट बैंकिंग यूजर आईडी और पासवर्ड / एटीएम डेबिट कार्ड / क्रेडिट कार्ड / मोबाइल बैंकिंग / व्यक्तिगत जानकारी किसी भी व्यक्ति को प्रकट न करें। Please do not disclose your Account details/Internet Banking User ID and Passwords/ATM Debit Card/Credit Card/Mobile Banking/Personal Information to any person.</li>
              <li>* सभी शुल्क / शर्तें समय समय पर परिवर्तनीय हैं। कृपया अधिक जानकारी के लिए बैंक की वेबसाईट www.sbi.co.in को देखें। All charges/stipulations are subject to change from time to time. Please visit Bank's website www.sbi.co.in for further information.</li>
              <li>* नकद जमा ₹ 50000/- से अधिक के लिए, कृपया अपना पैन संख्या का उल्लेख करें अथवा फॉर्म 60 की हस्ताक्षरित कॉपी प्रस्तुत करें। For Cash Deposit exceeding ₹ 50000/- please mention your PAN No. or submit signed copy of Form 60.</li>
              <li>* ग्राहक यह सुनिश्चित करें की जमापर्ची का ब्यौरा सही है एवं चैक / लिखित / नकदी के विवरण के साथ मेल खाता है। The customer is obliged to ensure that the details on the deposit slip are accurate and match with the details of the cheque/instrument/cash.</li>
              <li>* झूठे वादों के शिकार न हों, संदिग्ध योजनाओं से सावधान रहें। Do not fall prey to false promises, beware of dubious schemes.</li>
            </ul>
          </div>
        </div>
      </div>`;

    return {
      title: 'SBI Cash & Cheque Pay-in Slip (100999131-V3)',
      orientation: 'landscape',
      width: 1568,
      height: 610,
      fontClass: 'slip-font-sans',
      frontHtml,
      backHtml,
      cashTotal: useCash ? cashTotal : 0,
      chequeTotal: useChq ? chequeTotal : 0,
      grandTotal,
      requiresPanAlert,
      warning,
      pdfFilename: `SBI_Deposit_Slip_${state.accountNo || 'Draft'}.pdf`,
    };
  }

  // ===========================================================================
  // 2. HDFC DEPOSIT / PAY-IN SLIP (1568 x 610 Landscape — Official RMTL 9328/11.12.2019)
  // ===========================================================================
  if (bankId === 'hdfc' && formType === 'deposit') {
    const useCash = state.depositMode === 'cash' || state.depositMode === 'both';
    const useChq = state.depositMode === 'cheque' || state.depositMode === 'both';
    const grandTotal = Math.round(((useCash ? cashTotal : 0) + (useChq ? chequeTotal : 0)) * 100) / 100;
    const requiresPanAlert = useCash && cashTotal >= 50000;
    const words = grandTotal > 0 ? numberToWordsIndian(grandTotal) : '';
    const isLoan = state.accountType === 'loan' || state.loanTicked || state.hdfcDepositType === 'loan';
    const isCc = Boolean(state.creditCardNo) || state.accountType === 'cc' || state.hdfcDepositType === 'cc';

    const leftRows: { desc: string; chqNo: string; amt: string }[] = [];
    if (useCash && cashTotal > 0) {
      leftRows.push({ desc: 'Cash Deposited', chqNo: '', amt: fmtIn(cashTotal) });
    }
    if (useChq) {
      activeCheques.forEach((c) => {
        leftRows.push({
          desc: `${c.bankBranch || 'Cheque'} ${c.city || ''}`.trim(),
          chqNo: c.chequeNo,
          amt: fmtIn(parseFloat(c.amount) || 0),
        });
      });
    }

    // Current Indian currency denominations: 500x, 200x, 100x, 50X, 20x, 10x, 5x, 2x, 1x + Coins
    const miscCash = useCash ? parseFloat(state.coins) || 0 : 0;

    const hdfcDenoms = [
      { d: 500, label: '500x' },
      { d: 200, label: '200x' },
      { d: 100, label: '100x' },
      { d: 50, label: '50X' },
      { d: 20, label: '20x' },
      { d: 10, label: '10x' },
      { d: 5, label: '5x' },
      { d: 2, label: '2x' },
      { d: 1, label: '1x' },
    ];

    const hdfcDenomRows = hdfcDenoms
      .map(({ d, label }) => {
        const cnt = useCash ? parseInt(state.notes[d] || '0', 10) || 0 : 0;
        const amt = cnt * d;
        return `
          <tr>
            <td class="slip-lbl" style="padding:1.5px 8px;border:1px solid #1e293b;text-align:center;font-weight:700;height:19px;font-size:10.5px;">${label}${cnt > 0 ? ` <span class="slip-val" style="font-weight:600;color:#475569;font-size:9.5px;">(${cnt})</span>` : ''}</td>
            <td style="padding:1.5px 10px;border:1px solid #1e293b;text-align:right;font-family:'JetBrains Mono',monospace;font-weight:700;font-size:11px;"><span class="slip-val">${amt > 0 ? fmtIn(amt) : ''}</span></td>
          </tr>`;
      })
      .join('');

    const frontHtml = `
      <div class="slip-frame" style="width:1568px;height:610px;background:#ffffff;border:1.5px solid #0f172a;font-family:'DM Sans',Arial,sans-serif;color:#0f172a;display:flex;box-sizing:border-box;">
        <!-- LEFT PANEL: CUSTOMER COPY -->
        <div style="width:580px;padding:16px 20px 12px 20px;border-right:2px dashed #334155;display:flex;flex-direction:column;justify-content:space-between;box-sizing:border-box;">
          <div>
            <!-- Header Row -->
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:7px;">
              <div>${renderHdfcLogoSvg(24)}</div>
              <div style="display:flex;flex-direction:column;align-items:center;">
                <div class="slip-lbl" style="font-size:11px;font-weight:600;align-self:flex-start;margin-bottom:2px;">Date</div>
                ${renderGroupedBoxes(`${dateObj.d}${dateObj.m}${dateObj.y}`, [2, 2, 4], 18, 22, 4)}
              </div>
              <div class="slip-lbl" style="text-align:right;font-size:11px;font-weight:700;line-height:1.2;">Deposit Slip<br/><span style="font-weight:600;">(Customer Copy)</span></div>
            </div>

            <!-- Account Number (14) -->
            <div style="margin-bottom:5px;">
              <div class="slip-lbl" style="font-size:10.5px;font-weight:700;margin-bottom:2px;">Account Number</div>
              <div>${renderDigitBoxes(state.accountNo, 14, 29, 21, 12)}</div>
            </div>

            <!-- Credit Card Number (16 grouped 4-4-4-4) -->
            <div style="margin-bottom:5px;">
              <div class="slip-lbl" style="font-size:10.5px;font-weight:700;margin-bottom:2px;">Credit Card Number</div>
              <div>${renderGroupedBoxes(state.creditCardNo, [4, 4, 4, 4], 27, 21, 6)}</div>
            </div>

            <!-- Loan Account No (10) -->
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:7px;">
              <div style="display:flex;flex-direction:column;gap:1px;">
                <span class="slip-lbl" style="font-size:10.5px;font-weight:700;line-height:1.1;">Loan Account No.:</span>
                <span style="display:inline-flex;align-items:center;gap:4px;">${renderCheckbox(isLoan, 13)}<span class="slip-lbl" style="font-size:8px;color:#475569;">(✓ Tick as applicable)</span></span>
              </div>
              ${renderDigitBoxes(state.loanNo, 10, 29, 21, 12)}
            </div>

            <!-- Name -->
            <div style="display:flex;align-items:flex-end;gap:6px;margin-bottom:8px;font-size:12px;">
              <span class="slip-lbl" style="font-weight:700;white-space:nowrap;">Name :</span>
              <span class="slip-grid" style="flex:1;border-bottom:1.25px solid #0f172a;min-height:18px;padding:0 6px;"><span class="slip-val" style="font-weight:700;">${esc(state.name)}</span></span>
            </div>

            <!-- Customer Copy 6-Row Table + Rupees in Words Box -->
            <table style="width:100%;border-collapse:collapse;font-size:11px;">
              <thead>
                <tr>
                  <th class="slip-lbl" style="padding:4px 8px;border:1px solid #0f172a;text-align:left;">Cash/Cheque Details</th>
                  <th class="slip-lbl" style="padding:4px 8px;border:1px solid #0f172a;text-align:center;width:110px;">Cheque No.</th>
                  <th class="slip-lbl" style="padding:4px 8px;border:1px solid #0f172a;text-align:center;width:125px;">Rupees</th>
                </tr>
              </thead>
              <tbody>
                ${[0, 1, 2, 3, 4, 5]
                  .map((i) => {
                    const row = leftRows[i];
                    return `
                      <tr>
                        <td style="padding:4px 8px;border:1px solid #0f172a;height:24px;"><span class="slip-val" style="font-weight:600;">${row ? esc(row.desc) : '&nbsp;'}</span></td>
                        <td style="padding:4px 8px;border:1px solid #0f172a;text-align:center;font-family:'JetBrains Mono',monospace;"><span class="slip-val">${row ? esc(row.chqNo) : ''}</span></td>
                        <td style="padding:4px 8px;border:1px solid #0f172a;text-align:right;font-family:'JetBrains Mono',monospace;font-weight:700;"><span class="slip-val">${row ? esc(row.amt) : ''}</span></td>
                      </tr>`;
                  })
                  .join('')}
                <tr>
                  <td colspan="2" class="slip-lbl" style="padding:4px 10px;border:1px solid #0f172a;text-align:right;font-weight:700;">Total Rs.</td>
                  <td style="padding:4px 8px;border:1px solid #0f172a;text-align:right;font-family:'JetBrains Mono',monospace;font-weight:800;font-size:12.5px;"><span class="slip-val">${grandTotal > 0 ? fmtIn(grandTotal) : ''}</span></td>
                </tr>
                <tr>
                  <td colspan="3" style="padding:6px 8px;border:1px solid #0f172a;height:38px;vertical-align:top;">
                    <span class="slip-lbl" style="font-size:10.5px;font-weight:600;display:block;">Rupees (In words):</span>
                    <span class="slip-val" style="font-weight:700;font-size:11px;">${esc(words)}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:flex-end;font-size:11px;padding-top:10px;">
            <div style="width:155px;text-align:center;">
              <div style="min-height:15px;font-weight:700;"><span class="slip-val">${esc(state.depositorName || state.name)}</span></div>
              <div class="slip-grid slip-lbl" style="border-top:1px solid #0f172a;padding-top:2px;font-weight:700;">Depositor's Name</div>
            </div>
            <div style="width:165px;text-align:center;">
              <div style="min-height:15px;"></div>
              <div class="slip-grid slip-lbl" style="border-top:1px solid #0f172a;padding-top:2px;font-weight:700;">Depositor's Signature</div>
            </div>
            <div style="width:140px;text-align:center;">
              <div style="min-height:15px;"></div>
              <div class="slip-grid slip-lbl" style="border-top:1px solid #0f172a;padding-top:2px;font-weight:700;">Teller's Signature</div>
            </div>
          </div>
        </div>

        <!-- RIGHT PANEL: BANK COPY -->
        <div style="flex:1;padding:14px 20px 12px 20px;display:flex;flex-direction:column;justify-content:space-between;box-sizing:border-box;">
          <div>
            <!-- Top Row: Logo + Two Checkbox Columns + Bank Copy/Date -->
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:5px;">
              <div style="padding-top:2px;">${renderHdfcLogoSvg(24)}</div>

              <div style="display:flex;flex-direction:column;gap:2.5px;font-size:10px;font-weight:700;">
                <div style="display:flex;align-items:center;gap:5px;">${renderCheckbox(isLoan, 12)}<span class="slip-lbl">Loan Account No</span></div>
                <div style="display:flex;align-items:center;gap:5px;">${renderCheckbox(useCash && !isCc && !isLoan, 12)}<span class="slip-lbl">Cash</span></div>
                <div style="display:flex;align-items:center;gap:5px;">${renderCheckbox(useChq && state.hdfcDepositType === 'local', 12)}<span class="slip-lbl">Local cheque</span></div>
                <div style="display:flex;align-items:center;gap:5px;">${renderCheckbox(useChq && state.hdfcDepositType === 'out', 12)}<span class="slip-lbl">Outstation Cheque</span></div>
                <div style="display:flex;align-items:center;gap:5px;">${renderCheckbox(isCc, 12)}<span class="slip-lbl">Credit Card Payment</span></div>
              </div>

              <div style="display:flex;flex-direction:column;gap:3.5px;font-size:10px;font-weight:700;padding-top:2px;">
                <div style="display:flex;align-items:center;gap:5px;"><span class="slip-lbl">• For NRO Account${state.special === 'NRO Account' ? ' ✓' : ''}</span></div>
                <div style="display:flex;align-items:center;gap:5px;">${renderCheckbox(state.special === 'Dividend / Interest Warrant', 12)}<span class="slip-lbl">Dividend / Interest warrant</span></div>
                <div style="display:flex;align-items:center;gap:5px;">${renderCheckbox(state.special === 'Rent / Pension / Asset Sale', 12)}<span class="slip-lbl">Rent / Pension / Sale proceeds of Assets</span></div>
              </div>

              <div style="text-align:right;">
                <div class="slip-lbl" style="font-size:11px;font-weight:700;line-height:1.15;margin-bottom:4px;">Deposit Slip<br/><span style="font-weight:600;">(Bank Copy)</span></div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;">
                  <div class="slip-lbl" style="font-size:10px;font-weight:600;align-self:flex-start;">Date</div>
                  ${renderGroupedBoxes(`${dateObj.d}${dateObj.m}${dateObj.y}`, [2, 2, 4], 18, 21, 4)}
                </div>
              </div>
            </div>

            <!-- Middle Identity Grid: Left (Contact & PAN) | Right (Account, Card, Loan) -->
            <div style="display:grid;grid-template-columns:1fr 1.55fr;gap:18px;margin-bottom:5px;align-items:start;">
              <div>
                <div style="display:flex;align-items:flex-end;gap:6px;margin-bottom:7px;font-size:11.5px;padding-top:2px;">
                  <span class="slip-lbl" style="font-weight:700;white-space:nowrap;">Contact No.:</span>
                  <span class="slip-grid" style="flex:1;border-bottom:1.25px solid #0f172a;min-height:18px;padding:0 4px;"><span class="slip-val" style="font-family:'JetBrains Mono',monospace;font-weight:600;">${esc(state.mobile || state.tel)}</span></span>
                </div>
                <div class="slip-lbl" style="font-size:10.5px;font-weight:700;margin-bottom:2px;">PAN No.*</div>
                <div>${renderDigitBoxes(state.pan, 10, 27, 21, 11.5)}</div>
              </div>

              <div style="display:flex;flex-direction:column;gap:4px;">
                <div>
                  <div class="slip-lbl" style="font-size:10.5px;font-weight:700;margin-bottom:1px;">Account Number</div>
                  <div>${renderDigitBoxes(state.accountNo, 14, 30, 20, 12)}</div>
                </div>
                <div>
                  <div class="slip-lbl" style="font-size:10.5px;font-weight:700;margin-bottom:1px;">Credit Card Number</div>
                  <div>${renderGroupedBoxes(state.creditCardNo, [4, 4, 4, 4], 27, 20, 6)}</div>
                </div>
                <div style="display:flex;align-items:center;justify-content:flex-end;gap:8px;">
                  <span class="slip-lbl" style="font-size:10.5px;font-weight:700;">Loan Account No.:</span>
                  ${renderCheckbox(isLoan, 14)}
                  ${renderDigitBoxes(state.loanNo, 10, 27, 20, 11.5)}
                </div>
              </div>
            </div>

            <!-- Full Width Name Line -->
            <div style="display:flex;align-items:flex-end;gap:6px;margin-bottom:6px;font-size:12px;">
              <span class="slip-lbl" style="font-weight:700;white-space:nowrap;">Name :</span>
              <span class="slip-grid" style="flex:1;border-bottom:1.25px solid #0f172a;min-height:17px;padding:0 6px;"><span class="slip-val" style="font-weight:700;">${esc(state.name)}</span></span>
            </div>

            <!-- Main Boxed Area: Cheque Details Table (Left) + Cash Denomination Table (Right) -->
            <div style="display:flex;align-items:stretch;">
              <div class="slip-lbl" style="writing-mode:vertical-rl;transform:rotate(180deg);font-size:11px;font-weight:700;text-align:center;padding-right:4px;">Cheque Details</div>

              <!-- Left Cheque Grid + Rupees in words -->
              <div style="flex:1.45;display:flex;flex-direction:column;">
                <table style="width:100%;border-collapse:collapse;font-size:11px;">
                  <thead>
                    <tr>
                      <th class="slip-lbl" style="padding:3.5px 8px;border:1px solid #0f172a;text-align:left;">Bank &amp; Branch</th>
                      <th class="slip-lbl" style="padding:3.5px 8px;border:1px solid #0f172a;text-align:center;width:110px;">City</th>
                      <th class="slip-lbl" style="padding:3.5px 8px;border:1px solid #0f172a;text-align:center;width:140px;">Cheque No.</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${[0, 1, 2, 3, 4, 5]
                      .map((i) => {
                        const chq = useChq ? activeCheques[i] : undefined;
                        const chqAmt = chq ? parseFloat(chq.amount) || 0 : 0;
                        return `
                          <tr>
                            <td style="padding:3px 8px;border:1px solid #0f172a;height:22px;"><span class="slip-val" style="font-weight:600;">${chq ? esc(chq.bankBranch) : '&nbsp;'}</span></td>
                            <td style="padding:3px 8px;border:1px solid #0f172a;"><span class="slip-val">${chq ? esc(chq.city) : ''}</span></td>
                            <td style="padding:3px 8px;border:1px solid #0f172a;font-family:'JetBrains Mono',monospace;">
                              <div style="display:flex;justify-content:space-between;">
                                <span class="slip-val">${chq ? esc(chq.chequeNo) : ''}</span>
                                ${chqAmt > 0 ? `<span class="slip-val" style="font-weight:700;">₹${fmtIn(chqAmt)}</span>` : ''}
                              </div>
                            </td>
                          </tr>`;
                      })
                      .join('')}
                  </tbody>
                </table>
                <div class="slip-grid" style="border:1px solid #0f172a;border-top:none;padding:5px 10px;flex:1;min-height:42px;">
                  <span class="slip-lbl" style="font-size:10.5px;font-weight:600;display:block;">Rupees (In words) :</span>
                  <span class="slip-val" style="font-weight:700;font-size:11px;line-height:1.25;">${esc(words)}</span>
                </div>
              </div>

              <!-- Right Cash Denomination Grid -->
              <div style="flex:1;display:flex;flex-direction:column;">
                <table style="width:100%;border-collapse:collapse;font-size:11px;margin-left:-1px;">
                  <thead>
                    <tr>
                      <th class="slip-lbl" style="padding:3.5px 8px;border:1px solid #0f172a;text-align:center;width:110px;">Denomination</th>
                      <th class="slip-lbl" style="padding:3.5px 8px;border:1px solid #0f172a;text-align:center;">Rupees</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${hdfcDenomRows}
                    <tr>
                      <td class="slip-lbl" style="padding:1.5px 8px;border:1px solid #0f172a;text-align:center;font-weight:600;height:19px;font-size:10.5px;">Coins</td>
                      <td style="padding:1.5px 10px;border:1px solid #0f172a;text-align:right;font-family:'JetBrains Mono',monospace;font-weight:700;font-size:11px;"><span class="slip-val">${miscCash > 0 ? fmtIn(miscCash) : ''}</span></td>
                    </tr>
                    <tr>
                      <td class="slip-lbl" style="padding:2.5px 8px;border:1px solid #0f172a;text-align:center;font-weight:800;font-size:11px;">Total Rupees</td>
                      <td style="padding:2.5px 10px;border:1px solid #0f172a;text-align:right;font-family:'JetBrains Mono',monospace;font-weight:800;font-size:12px;"><span class="slip-val">${useCash && cashTotal > 0 ? fmtIn(cashTotal) : ''}</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div class="slip-lbl" style="writing-mode:vertical-rl;font-size:11px;font-weight:700;text-align:center;padding-left:4px;">Cash Details</div>
            </div>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:flex-end;font-size:11px;padding-top:6px;">
            <div style="display:flex;gap:36px;flex:1;">
              <div style="width:165px;text-align:center;">
                <div style="min-height:15px;font-weight:700;"><span class="slip-val">${esc(state.depositorName || state.name)}</span></div>
                <div class="slip-grid slip-lbl" style="border-top:1px solid #0f172a;padding-top:2px;font-weight:700;">Depositor's Name</div>
              </div>
              <div style="width:175px;text-align:center;">
                <div style="min-height:15px;"></div>
                <div class="slip-grid slip-lbl" style="border-top:1px solid #0f172a;padding-top:2px;font-weight:700;">Depositor's Signature</div>
              </div>
              <div style="width:155px;text-align:center;">
                <div style="min-height:15px;"></div>
                <div class="slip-grid slip-lbl" style="border-top:1px solid #0f172a;padding-top:2px;font-weight:700;">Teller's Signature</div>
              </div>
            </div>
            <div class="slip-lbl" style="font-size:9.5px;font-style:italic;font-weight:700;text-align:right;">*For cash deposits greater than Rs. 49,999/- mention PAN No.</div>
          </div>
        </div>
      </div>`;

    const backHtml = `
      <div class="slip-frame" style="width:1568px;height:610px;background:#ffffff;border:1.5px solid #0f172a;font-family:'DM Sans',Arial,sans-serif;color:#0f172a;display:flex;box-sizing:border-box;position:relative;">
        <div style="width:940px;padding:24px 36px 20px 36px;border-right:2px dashed #334155;display:flex;flex-direction:column;justify-content:space-between;box-sizing:border-box;">
          <div class="slip-lbl">
            <div style="text-align:center;font-size:15px;font-weight:700;margin-bottom:12px;">CONDITIONS</div>
            <div style="font-size:11px;line-height:1.55;text-align:justify;">
              1. Items deposited are subject to subsequent verification and scrutiny for any discrepancies which will be notified to the account holder. 2. This pay-in-slip is only a record of deposits over the counter and does not purport to be a credit advice. Credits will be reflected in the statement of account. 3. Items drawn on other bank / branches in the city will be sent for clearing as per clearing house rules / directives. 4. Items payable outside city of deposit will be sent for collection and proceeds credited on realisation. Items which are purchased/ discounted at the deposit holders request will be sent for collection for realisation. If the payment of the item is not received, the Bank reserves the right to debit the depositor's account, the amount of the item including any charges. Interest or out of pocket expenses on receipt of notice of dishonour and/or after a pre-determined period to be decided by the bank, 5. The bank acts only as the account holders collecting agent and assumes no responsibility for the realisation of the items or the genuineness, validity and correctness of any signature and endorsement appearing thereon. Payment of items returned unpaid for any reason whatsoever will be charged back to the account irrespective of whether such items are returned to the account holder, 6. PAN Number must be mentioned in the space provided for all Cash deposits greater than Rs. 49,999/-. 7. For NRO Accounts: Please provide proof of eligibility of funds for cash/cheque being deposited in the NRO Account. 8. <strong>Collection of Foreign Currency Cheques/DD/Postal Order:</strong> These instruments are governed by clearing rules / of respective Payee country and they reserve the right to return the instruments anytime. On account of such returns, Bank reserves right to debit Depositors account even after crediting of proceeds (after realization) of such instrument, at prevailing exchange rate, charges and interest.
            </div>
            <div style="margin-top:14px;font-size:11.5px;line-height:1.5;">
              <div style="font-weight:700;margin-bottom:4px;">Instruction :</div>
              <div>• Please Quote your Account Number/Credit Card Number on reverse of the cheque • Please use separate slips for cash/transfer cheques / local cheques &amp; outstation cheques • Please ensure that name mentioned on the cheques matches with the account title maintained with us</div>
            </div>
          </div>

          <div class="slip-grid slip-lbl" style="border:1px solid #0f172a;padding:12px 16px;font-size:11px;display:flex;flex-direction:column;gap:14px;">
            <div>Purpose / Third Party Cash Deposit Declaration: __________________________________________________________________________</div>
            <div style="display:flex;justify-content:space-between;gap:16px;">
              <span>Depositor's Signature: _____________________</span>
              <span>Depositor's Name: _____________________</span>
              <span>Relationship with A/c holder: ___________________</span>
            </div>
            <div>Contact Phone Number: ____________________________________</div>
          </div>
        </div>

        <div class="slip-lbl" style="position:absolute;left:915px;top:36%;writing-mode:vertical-rl;transform:rotate(180deg);font-size:11px;font-weight:700;letter-spacing:1px;">RMTL</div>
        <div class="slip-lbl" style="position:absolute;left:915px;bottom:42px;writing-mode:vertical-rl;transform:rotate(180deg);font-size:11px;font-weight:600;">9328/11.12.2019</div>

        <div style="flex:1;padding:28px 36px;display:flex;flex-direction:column;justify-content:center;">
          <div class="slip-lbl" style="font-size:13px;font-weight:700;margin-bottom:10px;">CUSTOMER IMPORTANT REMINDERS</div>
          <div class="slip-lbl" style="font-size:11.5px;line-height:1.7;">
            <div>1. Please quote your 14-digit Account Number / 16-digit Credit Card Number clearly on the reverse of every cheque.</div>
            <div>2. Use separate deposit slips for Cash Deposits, Transfer Cheques, Local CTS Clearing Cheques, and Outstation Cheques.</div>
            <div>3. Ensure the payee name on every cheque matches the exact account title maintained with HDFC Bank Ltd.</div>
          </div>
        </div>
      </div>`;

    const hdfcDepositWarning =
      leftRows.length > 6 || activeCheques.length > 6
        ? `Official HDFC Customer Copy fits 6 ledger rows (${Math.max(leftRows.length, activeCheques.length)} entered). Extra rows will not print on Customer Copy.`
        : state.accountNo.trim().length > 14
        ? `Account number (${state.accountNo.trim().length} chars) exceeds 14 printed boxes on HDFC Pay-in Slip.`
        : null;

    return {
      title: 'HDFC Pay-in Slip (RMTL 9328/11.12.2019)',
      orientation: 'landscape',
      width: 1568,
      height: 610,
      fontClass: 'slip-font-sans',
      frontHtml,
      backHtml,
      cashTotal: useCash ? cashTotal : 0,
      chequeTotal: useChq ? chequeTotal : 0,
      grandTotal,
      requiresPanAlert,
      warning: hdfcDepositWarning,
      pdfFilename: `HDFC_Deposit_Slip_${state.accountNo || 'Draft'}.pdf`,
    };
  }

  // ===========================================================================
  // 3. SBI DEMAND DRAFT / BANKER'S CHEQUE (1568 x 640 Landscape — Official Form CC-5003234)
  // ===========================================================================
  if (bankId === 'sbi' && formType === 'dd') {
    const ddAmt = parseFloat(state.ddAmount) || 0;
    const exchAmt = parseFloat(state.ddExchange) || 0;
    const grandTotal = Math.round((ddAmt + exchAmt) * 100) / 100;
    const requiresPanAlert = grandTotal >= 50000;
    const words = grandTotal > 0 ? numberToWordsIndian(grandTotal) : '';
    const ddSp = splitRupeesPaise(ddAmt);
    const exSp = splitRupeesPaise(exchAmt);
    const totSp = splitRupeesPaise(grandTotal);

    const diff = Math.abs(cashTotal - grandTotal);
    const warning =
      cashTotal > 0 && grandTotal > 0 && diff > 0.5
        ? `Cash note tally (₹${fmtIn(cashTotal)}) differs from Draft + Exchange total (₹${fmtIn(grandTotal)}).`
        : null;

    // Current Indian currency denominations: X 500, X 200, X 100, X 50, X 20, X 10, X 5, X 2, X 1
    const officialDdDenoms = [500, 200, 100, 50, 20, 10, 5, 2, 1];
    const ddDenomRows = officialDdDenoms
      .map((d) => {
        const cnt = parseInt(state.notes[d] || '0', 10) || 0;
        const extraCoins = d === 1 ? parseFloat(state.coins) || 0 : 0;
        const rowAmt = cnt * d + extraCoins;
        const sp = splitRupeesPaise(rowAmt);
        return `
          <tr>
            <td class="slip-lbl" style="padding:2px 8px;border:1px solid #1e293b;text-align:center;font-weight:700;height:21px;">X ${d}${cnt > 0 ? ` <span class="slip-val" style="font-weight:600;font-size:10px;">(${cnt})</span>` : ''}</td>
            <td style="padding:2px 8px;border:1px solid #1e293b;text-align:right;font-family:'JetBrains Mono',monospace;font-weight:700;"><span class="slip-val">${sp.rs}</span></td>
            <td style="padding:2px 4px;border:1px solid #1e293b;text-align:center;font-family:'JetBrains Mono',monospace;"><span class="slip-val">${rowAmt > 0 ? sp.ps : ''}</span></td>
          </tr>`;
      })
      .join('');

    const frontHtml = `
      <div class="slip-frame" style="width:1568px;height:640px;background:#ffffff;border:1.5px solid #0f172a;font-family:'DM Sans','Noto Sans Devanagari',Arial,sans-serif;color:#0f172a;display:flex;padding:18px 20px 24px 12px;box-sizing:border-box;position:relative;">
        <!-- FAR LEFT VERTICAL MARGIN -->
        <div class="slip-lbl" style="writing-mode:vertical-rl;transform:rotate(180deg);text-align:center;font-size:14px;font-weight:800;letter-spacing:1.4px;padding:0 10px 0 4px;">DONATE BLOOD – SAVE LIFE</div>

        <!-- LEFT COUNTERFOIL -->
        <div class="slip-grid" style="width:345px;border:1.5px solid #0f172a;display:flex;flex-direction:column;justify-content:space-between;box-sizing:border-box;">
          <div>
            <div style="padding:10px 12px 8px 12px;border-bottom:1.5px solid #0f172a;">
              <div class="slip-lbl" style="text-align:center;font-size:13px;font-weight:800;line-height:1.25;margin-bottom:8px;">
                भारतीय स्टेट बैंक<br/>STATE BANK OF INDIA
              </div>
              <div style="display:flex;align-items:flex-end;gap:4px;font-size:11px;margin-bottom:6px;">
                <span class="slip-grid" style="flex:1;border-bottom:1px solid #0f172a;min-height:16px;"><span class="slip-val" style="font-weight:700;">${esc(state.branch)}</span></span>
                <span class="slip-lbl" style="font-weight:700;white-space:nowrap;">शाखा/BRANCH</span>
              </div>
              <div style="display:flex;align-items:flex-end;gap:4px;font-size:11px;">
                <span class="slip-lbl" style="font-weight:700;white-space:nowrap;">दिनांक/DATE</span>
                <span class="slip-grid" style="flex:1;border-bottom:1px solid #0f172a;min-height:16px;"><span class="slip-val" style="font-family:'JetBrains Mono',monospace;font-weight:700;">${dateObj.full}</span></span>
              </div>
            </div>

            <div style="padding:8px 10px;border-bottom:1px solid #0f172a;min-height:66px;font-size:11px;">
              <div class="slip-lbl" style="font-weight:700;line-height:1.2;">आवेदक का नाम<br/>Name of Applicant</div>
              <div style="margin-top:6px;"><span class="slip-val" style="font-weight:700;font-size:12px;">${esc(state.name)}</span></div>
            </div>

            <div style="padding:8px 10px;border-bottom:1px solid #0f172a;min-height:70px;font-size:11px;">
              <div class="slip-lbl" style="font-weight:700;line-height:1.2;">राशि (शब्दों में)<br/>AMOUNT (in words)</div>
              <div style="margin-top:6px;"><span class="slip-val" style="font-weight:700;font-size:11px;">${esc(words)}</span></div>
            </div>

            <table style="width:100%;border-collapse:collapse;font-size:11px;">
              <thead>
                <tr>
                  <th class="slip-lbl" style="padding:4px 6px;border-bottom:1px solid #0f172a;border-right:1px solid #0f172a;text-align:left;">ड्राफ्ट/<br/>बैंक/चैक/राशि</th>
                  <th class="slip-lbl" style="padding:4px 4px;border-bottom:1px solid #0f172a;border-right:1px solid #0f172a;text-align:center;width:78px;">रु०/Rs.</th>
                  <th class="slip-lbl" style="padding:4px 4px;border-bottom:1px solid #0f172a;text-align:center;width:34px;">पै०/P.</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="slip-lbl" style="padding:5px 6px;border-bottom:1px solid #0f172a;border-right:1px solid #0f172a;font-weight:700;">Dft.<br/>B.C. Amt.</td>
                  <td style="padding:5px 6px;border-bottom:1px solid #0f172a;border-right:1px solid #0f172a;text-align:right;font-family:'JetBrains Mono',monospace;font-weight:700;"><span class="slip-val">${ddSp.rs}</span></td>
                  <td style="padding:5px 4px;border-bottom:1px solid #0f172a;text-align:center;font-family:'JetBrains Mono',monospace;"><span class="slip-val">${ddAmt > 0 ? ddSp.ps : ''}</span></td>
                </tr>
                <tr>
                  <td class="slip-lbl" style="padding:5px 6px;border-bottom:1px solid #0f172a;border-right:1px solid #0f172a;font-weight:700;">विनिमय/Exchange</td>
                  <td style="padding:5px 6px;border-bottom:1px solid #0f172a;border-right:1px solid #0f172a;text-align:right;font-family:'JetBrains Mono',monospace;font-weight:700;"><span class="slip-val">${exSp.rs}</span></td>
                  <td style="padding:5px 4px;border-bottom:1px solid #0f172a;text-align:center;font-family:'JetBrains Mono',monospace;"><span class="slip-val">${exchAmt > 0 ? exSp.ps : ''}</span></td>
                </tr>
                <tr>
                  <td class="slip-lbl" style="padding:6px 6px;border-bottom:1.5px solid #0f172a;border-right:1px solid #0f172a;font-weight:800;">योग/TOTAL</td>
                  <td style="padding:6px 6px;border-bottom:1.5px solid #0f172a;border-right:1px solid #0f172a;text-align:right;font-family:'JetBrains Mono',monospace;font-weight:800;"><span class="slip-val">${totSp.rs}</span></td>
                  <td style="padding:6px 4px;border-bottom:1.5px solid #0f172a;text-align:center;font-family:'JetBrains Mono',monospace;font-weight:700;"><span class="slip-val">${grandTotal > 0 ? totSp.ps : ''}</span></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1.35fr;height:80px;font-size:11px;">
            <div class="slip-grid slip-lbl" style="border-right:1px solid #0f172a;padding:6px 8px;display:flex;flex-direction:column;justify-content:flex-end;">
              <div>रोकड़िया</div>
              <div>Cashier</div>
            </div>
            <div class="slip-lbl" style="padding:6px 8px;text-align:center;display:flex;flex-direction:column;justify-content:flex-end;">
              <div>रोकड़ अधिकारी</div>
              <div>पासकर्ता अधिकारी</div>
              <div>Cash/Passing Officer</div>
            </div>
          </div>
        </div>

        <!-- PERFORATED DIVIDER -->
        <div style="width:42px;border-right:2px dashed #334155;margin-right:18px;box-sizing:border-box;"></div>

        <!-- RIGHT MAIN APPLICATION FORM -->
        <div style="flex:1;display:flex;flex-direction:column;justify-content:space-between;box-sizing:border-box;">
          <div class="slip-grid" style="border:1.5px solid #0f172a;display:flex;flex-direction:column;flex:1;">
            <!-- Header Row -->
            <div style="display:grid;grid-template-columns:280px 1fr;border-bottom:1.5px solid #0f172a;">
              <div class="slip-grid" style="padding:8px 12px;border-right:1px solid #0f172a;display:flex;flex-direction:column;justify-content:space-between;">
                <div style="display:flex;align-items:center;gap:10px;">
                  ${renderSbiKeyholeSvg(26)}
                  <div class="slip-lbl" style="font-size:13px;font-weight:800;line-height:1.2;">भारतीय स्टेट बैंक<br/>STATE BANK OF INDIA</div>
                </div>
                <div style="display:flex;align-items:flex-end;gap:4px;font-size:11px;margin-top:8px;">
                  <span class="slip-grid" style="flex:1;border-bottom:1px solid #0f172a;min-height:16px;"><span class="slip-val" style="font-weight:700;">${esc(state.branch)}</span></span>
                  <span class="slip-lbl" style="font-weight:700;white-space:nowrap;">शाखा/BRANCH</span>
                </div>
              </div>

              <div style="display:flex;flex-direction:column;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:6px 12px 4px 12px;">
                  <div class="slip-lbl" style="font-size:12.5px;font-weight:700;line-height:1.25;">ड्राफ्ट / चैक आवेदन पत्र<br/>Draft/Banker's Cheque Application Form</div>
                  <div style="text-align:right;">
                    <div style="font-size:10px;margin-bottom:2px;"><span class="slip-lbl">दिनांक/Date: </span><span class="slip-val" style="font-family:'JetBrains Mono',monospace;font-weight:700;">${dateObj.full}</span></div>
                    ${renderDigitBoxes(state.accountNo, 11, 22, 20, 11)}
                  </div>
                </div>
                <div style="display:flex;align-items:center;gap:28px;padding:4px 12px 6px 12px;font-size:11.5px;">
                  <div class="slip-lbl" style="font-weight:700;line-height:1.2;">कृपया जारी करें<br/>Please issue</div>
                  <div style="display:flex;align-items:center;gap:8px;">
                    ${renderCheckbox(state.ddIssueType === 'dd', 20)}
                    <span class="slip-lbl" style="line-height:1.15;">ड्राफ्ट<br/>Draft</span>
                  </div>
                  <div style="display:flex;align-items:center;gap:8px;">
                    ${renderCheckbox(state.ddIssueType === 'bc', 20)}
                    <span class="slip-lbl" style="line-height:1.15;">बैंकर चैक<br/>Banker's Cheque</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Middle 3-Column Body -->
            <div style="display:flex;flex:1;border-bottom:1.5px solid #0f172a;">
              <!-- Left Denomination Table -->
              <div class="slip-grid" style="width:270px;border-right:1px solid #0f172a;">
                <table style="width:100%;height:100%;border-collapse:collapse;font-size:11.5px;">
                  <thead>
                    <tr>
                      <th class="slip-lbl" style="padding:5px 6px;border-bottom:1px solid #0f172a;border-right:1px solid #0f172a;text-align:center;">विवरण<br/>PARTICULARS</th>
                      <th class="slip-lbl" style="padding:5px 6px;border-bottom:1px solid #0f172a;border-right:1px solid #0f172a;text-align:center;width:85px;">रु०/Rs.</th>
                      <th class="slip-lbl" style="padding:5px 4px;border-bottom:1px solid #0f172a;text-align:center;width:44px;">पै०/P.</th>
                    </tr>
                  </thead>
                  <tbody>${ddDenomRows}</tbody>
                </table>
              </div>

              <!-- Center Particulars + Right Summary Amounts -->
              <div style="flex:1;display:flex;flex-direction:column;">
                <!-- Top half: In Favour of / For Rupees / Payable at + Draft/Exch/Total -->
                <div style="display:flex;border-bottom:1px solid #0f172a;">
                  <div class="slip-grid" style="flex:1;border-right:1px solid #0f172a;display:flex;flex-direction:column;">
                    <div class="slip-grid" style="padding:6px 10px;border-bottom:1px solid #0f172a;min-height:66px;font-size:11.5px;">
                      <div class="slip-lbl" style="font-weight:700;">नाम में / In Favour of</div>
                      <div style="margin-top:8px;"><span class="slip-val" style="font-weight:800;font-size:14px;">${esc(state.ddFavouring)}</span></div>
                    </div>
                    <div class="slip-grid" style="padding:6px 10px;border-bottom:1px solid #0f172a;min-height:54px;font-size:11.5px;">
                      <div class="slip-lbl" style="font-weight:700;">रुपये / For Rupees</div>
                      <div style="margin-top:5px;"><span class="slip-val" style="font-weight:700;font-size:12px;">${esc(words)}</span></div>
                    </div>
                    <div style="padding:6px 10px;min-height:52px;font-size:11.5px;display:flex;flex-direction:column;justify-content:space-between;">
                      <div>
                        <span class="slip-lbl" style="font-weight:700;">शाखा पर देय / Payable at (Branch) </span>
                        <span class="slip-val" style="font-weight:800;font-size:13px;">${esc(state.ddPayableAt)}</span>
                      </div>
                      <div style="display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-top:4px;">
                        <span class="slip-lbl" style="font-weight:700;">कूट सं०/Code No.</span>
                        ${renderDigitBoxes(state.ddCodeNo, 5, 22, 24, 12)}
                      </div>
                    </div>
                  </div>

                  <!-- Far Right Amount Summary Table -->
                  <div style="width:275px;">
                    <table style="width:100%;height:100%;border-collapse:collapse;font-size:11px;">
                      <thead>
                        <tr>
                          <th class="slip-lbl" style="padding:4px 6px;border-bottom:1px solid #0f172a;border-right:1px solid #0f172a;text-align:center;">&nbsp;</th>
                          <th class="slip-lbl" style="padding:4px 6px;border-bottom:1px solid #0f172a;border-right:1px solid #0f172a;text-align:center;width:95px;">रु०/Rs.</th>
                          <th class="slip-lbl" style="padding:4px 4px;border-bottom:1px solid #0f172a;text-align:center;width:44px;">पै०/P.</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td class="slip-lbl" style="padding:6px;border-bottom:1px solid #0f172a;border-right:1px solid #0f172a;text-align:center;font-weight:700;">ड्राफ्ट/<br/>बैंक चैक/राशि<br/>DFT./<br/>B.C. Amt.</td>
                          <td style="padding:6px 8px;border-bottom:1px solid #0f172a;border-right:1px solid #0f172a;text-align:right;font-family:'JetBrains Mono',monospace;font-weight:800;font-size:13px;"><span class="slip-val">${ddSp.rs}</span></td>
                          <td style="padding:6px 4px;border-bottom:1px solid #0f172a;text-align:center;font-family:'JetBrains Mono',monospace;"><span class="slip-val">${ddAmt > 0 ? ddSp.ps : ''}</span></td>
                        </tr>
                        <tr>
                          <td class="slip-lbl" style="padding:6px;border-bottom:1px solid #0f172a;border-right:1px solid #0f172a;text-align:center;font-weight:700;">विनिमय/<br/>Exchange</td>
                          <td style="padding:6px 8px;border-bottom:1px solid #0f172a;border-right:1px solid #0f172a;text-align:right;font-family:'JetBrains Mono',monospace;font-weight:700;"><span class="slip-val">${exSp.rs}</span></td>
                          <td style="padding:6px 4px;border-bottom:1px solid #0f172a;text-align:center;font-family:'JetBrains Mono',monospace;"><span class="slip-val">${exchAmt > 0 ? exSp.ps : ''}</span></td>
                        </tr>
                        <tr>
                          <td class="slip-lbl" style="padding:6px;border-right:1px solid #0f172a;text-align:center;font-weight:800;">योग/<br/>TOTAL</td>
                          <td style="padding:6px 8px;border-right:1px solid #0f172a;text-align:right;font-family:'JetBrains Mono',monospace;font-weight:800;font-size:13.5px;"><span class="slip-val">${totSp.rs}</span></td>
                          <td style="padding:6px 4px;text-align:center;font-family:'JetBrains Mono',monospace;font-weight:700;"><span class="slip-val">${grandTotal > 0 ? totSp.ps : ''}</span></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <!-- Bottom half: Applicant Signature / Partition No / Applicant Name & Address -->
                <div style="display:grid;grid-template-columns:280px 1fr;flex:1;font-size:11.5px;">
                  <div class="slip-grid" style="border-right:1px solid #0f172a;display:flex;flex-direction:column;">
                    <div class="slip-lbl" style="padding:6px 10px;border-bottom:1px solid #0f172a;flex:1;font-weight:700;">आवेदक के हस्ताक्षर<br/>Signature of Applicant</div>
                    <div class="slip-lbl" style="padding:4px 10px;font-weight:700;height:28px;">PARTITION NO.</div>
                  </div>
                  <div style="padding:6px 12px;display:flex;flex-direction:column;justify-content:space-between;">
                    <div class="slip-lbl" style="font-weight:700;line-height:1.25;">आवेदक का नाम व पता /<br/>NAME AND ADDRESS OF APPLICANT/CUSTOMER NO.</div>
                    <div style="font-size:12px;">
                      <div class="slip-val" style="font-weight:800;">${esc(state.name)}</div>
                      <div class="slip-val" style="font-size:11px;">${esc(state.address)}</div>
                      <div style="font-size:11px;">
                        ${state.mobile || state.tel ? `<span class="slip-val">Ph: ${esc(state.mobile || state.tel)}</span> ` : ''}
                        ${state.pan ? `<span class="slip-val" style="font-family:'JetBrains Mono',monospace;font-weight:700;">PAN: ${esc(state.pan)}</span>` : ''}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Bottom 8-Cell Official Strip -->
            <div style="display:grid;grid-template-columns:1.2fr 0.75fr 1.15fr 0.75fr 1.05fr 0.65fr 0.65fr 1.8fr;height:78px;font-size:10px;text-align:center;">
              <div class="slip-grid slip-lbl" style="border-right:1px solid #0f172a;padding:4px;font-weight:700;">रोकड़िया/अंतरण<br/>सारणी क्र०<br/>Cashier's/Transfer<br/>Scroll No.</div>
              <div class="slip-grid slip-lbl" style="border-right:1px solid #0f172a;padding:4px;font-weight:700;">रोकड़िया<br/>Cashier</div>
              <div class="slip-grid slip-lbl" style="border-right:1px solid #0f172a;padding:4px;font-weight:700;">रोकड़ अधिकारी/<br/>पासकर्ता अधिकारी<br/>Cash/Passing Officer</div>
              <div class="slip-grid slip-lbl" style="border-right:1px solid #0f172a;padding:4px;font-weight:700;">सूची बही<br/>Jotting Book</div>
              <div class="slip-grid slip-lbl" style="border-right:1px solid #0f172a;padding:4px;font-weight:700;">डा०/बैंक चैक सं.<br/>Dft./B.C. No</div>
              <div class="slip-grid slip-lbl" style="border-right:1px solid #0f172a;padding:4px;font-weight:700;">जांचकर्ता<br/>Checked</div>
              <div class="slip-grid slip-lbl" style="border-right:1px solid #0f172a;padding:4px;font-weight:700;">हस्ताक्षर<br/>Signed</div>
              <div class="slip-lbl" style="padding:4px 8px;display:flex;flex-direction:column;justify-content:space-between;text-align:left;">
                <div>डा०/बैंक चैक प्राप्त किया/Received the Dft./B.C.</div>
                <div style="text-align:right;font-weight:700;">आवेदक / Applicant</div>
              </div>
            </div>
          </div>

          <div class="slip-lbl" style="font-size:10px;font-weight:700;padding-top:4px;">C.S.D. FBD. 3545/3-6-03/30,000 Pads/NDP &nbsp;&nbsp; CC No.-5003234</div>
        </div>
      </div>`;

    return {
      title: "SBI Draft / Banker's Cheque Application Form (CC-5003234)",
      orientation: 'landscape',
      width: 1568,
      height: 640,
      fontClass: 'slip-font-sans',
      frontHtml,
      backHtml: null,
      cashTotal,
      chequeTotal: 0,
      grandTotal,
      requiresPanAlert,
      warning,
      pdfFilename: `SBI_DD_Form_${state.accountNo || 'Draft'}.pdf`,
    };
  }

  // ===========================================================================
  // 4. HDFC DEMAND DRAFT APPLICATION FORM (850 x 1230 Portrait — Official A4 Form)
  // ===========================================================================
  if (bankId === 'hdfc' && formType === 'dd') {
    const ddAmt = parseFloat(state.ddAmount) || 0;
    const words = ddAmt > 0 ? numberToWordsIndian(ddAmt) : '';

    const frontHtml = `
      <div class="slip-frame" style="width:850px;height:1230px;background:#ffffff;border:1.5px solid #0f172a;font-family:'DM Sans',Arial,sans-serif;color:#0f172a;padding:24px 40px 22px 40px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;">
        <div>
          <!-- Top Centered Title -->
          <div class="slip-lbl" style="text-align:center;margin-bottom:18px;">
            <div style="font-size:21px;font-weight:800;margin-bottom:3px;">DD Application Form</div>
            <div style="font-size:12.5px;">(Application form to accompany cheque only.</div>
            <div style="font-size:12.5px;font-weight:800;">For DD in cash, separate form to be used)</div>
          </div>

          <!-- Date & Branch -->
          <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:16px;font-size:13.5px;">
            <div style="display:flex;align-items:flex-end;gap:6px;width:270px;">
              <span class="slip-lbl" style="white-space:nowrap;">Date :</span>
              <span class="slip-grid" style="flex:1;border-bottom:1px solid #0f172a;min-height:19px;padding:0 6px;"><span class="slip-val" style="font-family:'JetBrains Mono',monospace;font-weight:700;">${dateObj.full}</span></span>
            </div>
            <div style="display:flex;align-items:flex-end;gap:6px;width:270px;">
              <span class="slip-lbl" style="white-space:nowrap;">Branch :-</span>
              <span class="slip-grid" style="flex:1;border-bottom:1px solid #0f172a;min-height:19px;padding:0 6px;"><span class="slip-val" style="font-weight:700;">${esc(state.branch)}</span></span>
            </div>
          </div>

          <!-- Please Issue -->
          <div class="slip-lbl" style="font-size:13.5px;font-weight:800;margin-bottom:10px;">Please Issue (Tick as Applicable)</div>

          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;font-size:13.5px;">
            ${renderCheckbox(state.ddTicked, 16)}
            <span class="slip-lbl" style="white-space:nowrap;">Demand Draft payable at</span>
            <span class="slip-grid" style="flex:1;border-bottom:1px solid #0f172a;min-height:20px;padding:0 8px;"><span class="slip-val" style="font-weight:700;">${esc(state.ddPayableAt)}</span></span>
          </div>

          <div style="display:flex;align-items:flex-end;gap:6px;margin-bottom:12px;font-size:13.5px;">
            <span class="slip-lbl" style="white-space:nowrap;">Favoring</span>
            <span class="slip-grid" style="flex:1;border-bottom:1px solid #0f172a;min-height:20px;padding:0 8px;"><span class="slip-val" style="font-weight:800;font-size:14.5px;">${esc(state.ddFavouring)}</span></span>
          </div>

          <div style="margin-bottom:12px;font-size:13.5px;line-height:1.9;">
            <div style="display:flex;align-items:flex-end;gap:6px;">
              <span class="slip-lbl" style="white-space:nowrap;">For amount Rs.</span>
              <span class="slip-grid" style="width:200px;border-bottom:1px solid #0f172a;min-height:20px;padding:0 8px;display:inline-flex;align-items:flex-end;"><span class="slip-val" style="font-family:'JetBrains Mono',monospace;font-weight:800;font-size:14.5px;">${ddAmt > 0 ? fmtIn(ddAmt) : ''}</span></span>
              <span class="slip-lbl" style="white-space:nowrap;">(in figures)</span>
              <span class="slip-grid" style="flex:1;border-bottom:1px solid #0f172a;min-height:20px;padding:0 6px;line-height:1.25;"><span class="slip-val" style="font-weight:700;font-size:12px;">${esc(words)}</span></span>
            </div>
            <div style="display:flex;align-items:flex-end;gap:6px;">
              <span class="slip-grid" style="flex:1;border-bottom:1px solid #0f172a;height:18px;"></span>
              <span class="slip-lbl" style="white-space:nowrap;">(In words)</span>
            </div>
          </div>

          <div style="display:flex;align-items:flex-end;gap:6px;margin-bottom:12px;font-size:13.5px;">
            <span class="slip-lbl" style="white-space:nowrap;">Mode of Payment :- Cheque No.</span>
            <span class="slip-grid" style="width:190px;border-bottom:1px solid #0f172a;min-height:20px;padding:0 8px;"><span class="slip-val" style="font-family:'JetBrains Mono',monospace;font-weight:700;">${esc(state.ddChequeNo)}</span></span>
            <span class="slip-lbl" style="margin-left:10px;font-size:12px;">${state.ddChequeDate ? 'Dated:' : ''}</span>
            <span class="slip-val" style="font-family:'JetBrains Mono',monospace;font-weight:600;font-size:12px;">${state.ddChequeDate ? chqDateObj.full : ''}</span>
          </div>

          <div style="display:flex;align-items:flex-end;gap:6px;margin-bottom:12px;font-size:13.5px;">
            <span class="slip-lbl" style="white-space:nowrap;">Purchaser Name:</span>
            <span class="slip-grid" style="flex:1;border-bottom:1px solid #0f172a;min-height:20px;padding:0 8px;"><span class="slip-val" style="font-weight:700;">${esc(state.name)}</span></span>
          </div>

          <div style="margin-bottom:24px;font-size:13.5px;line-height:1.6;">
            <div style="display:flex;align-items:flex-end;gap:6px;">
              <span class="slip-lbl" style="white-space:nowrap;">Please deliver the Demand Draft to Mr / Ms.</span>
              <span class="slip-grid" style="flex:1;border-bottom:1px solid #0f172a;min-height:20px;padding:0 8px;"><span class="slip-val" style="font-weight:700;">${esc(state.ddDeliverTo || state.name)}</span></span>
              <span class="slip-lbl" style="white-space:nowrap;">Whose signature</span>
            </div>
            <div class="slip-lbl">is appended below</div>
          </div>

          <!-- Signatures Row 1 -->
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;font-size:13px;">
            <div style="width:190px;text-align:center;">
              <div class="slip-grid" style="border-top:1px solid #0f172a;padding-top:4px;"><span class="slip-lbl">Bearer's Signature</span></div>
            </div>
            <div style="width:210px;text-align:center;">
              <div class="slip-grid" style="border-top:1px solid #0f172a;padding-top:4px;"><span class="slip-lbl">Customer's signature<br/>(Purchaser)</span></div>
            </div>
          </div>

          <!-- Acknowledgement + Signatures Row 2 -->
          <div class="slip-lbl" style="font-size:13.5px;margin-bottom:28px;">I acknowledge Receipt of the DD as requested</div>

          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;font-size:13px;">
            <div style="width:190px;text-align:center;">
              <div class="slip-grid" style="border-top:1px solid #0f172a;padding-top:4px;"><span class="slip-lbl">Signature of Recipient</span></div>
            </div>
            <div style="width:210px;text-align:center;">
              <div style="min-height:18px;font-weight:700;"><span class="slip-val">${esc(state.name)}</span></div>
              <div class="slip-grid" style="border-top:1px solid #0f172a;padding-top:4px;"><span class="slip-lbl">Customer's Name<br/>(Purchaser)</span></div>
            </div>
          </div>

          <!-- Exact 4 I/We Declarations -->
          <div style="font-size:11.8px;line-height:1.5;margin-bottom:16px;">
            <div>
              <span class="slip-lbl">I / We enclose Cheque no. </span>
              <span class="slip-grid" style="display:inline-block;min-width:130px;border-bottom:1px solid #0f172a;text-align:center;"><span class="slip-val" style="font-family:'JetBrains Mono',monospace;font-weight:700;">${esc(state.ddChequeNo) || '&nbsp;'}</span></span>
              <span class="slip-lbl"> drawn on my /our above account in favour of " HDFC Bank Ltd for DD.</span>
            </div>
            <div class="slip-lbl">I / We Authorize you to Debit my / our above account towards issuance of the above DD through Cheque .</div>
            <div class="slip-lbl">I / We further authorize you to debit the aforesaid account for the service charges / tax, as applicable.</div>
            <div class="slip-lbl">I / We acknowledge that in case I / we have issued single cheque / instruction for debit to my / our account for issuing more than one Demand Draft, then the same will effect as multiple debit entries in my / our account.</div>
          </div>

          <!-- Digital Arrest Warning Banner -->
          <div class="slip-lbl" style="background:#333333;color:#ffffff;padding:10px 16px;text-align:center;font-size:11px;font-weight:800;line-height:1.4;margin-bottom:14px;letter-spacing:0.2px;">
            DO NOT FALL VICTIM TO ONLINE OFFERS FROM THIRD PARTIES REQUESTING PHOTOCOPIES OR IMAGES OF<br/>
            DRAFTS FOR BUSINESS DEALS OR UNDER THREAT OF DIGITAL ARREST<br/>
            THERE IS NO THING AS DIGITAL ARREST .PAUSE AND STAY CALM.<br/>
            TALK TO OUR STAFF FOR ANY ASSISTANCE
          </div>

          <!-- For bank Use only Table -->
          <div class="slip-lbl" style="font-size:12.5px;font-weight:800;margin-bottom:4px;">For bank Use only</div>
          <table class="slip-lbl" style="width:100%;border-collapse:collapse;font-size:11.5px;">
            <tbody>
              <tr>
                <td style="padding:5px 8px;border:1px solid #0f172a;width:58%;height:64px;vertical-align:top;">Processed by (Emp code and sign)</td>
                <td style="padding:5px 8px;border:1px solid #0f172a;vertical-align:top;">
                  <div style="display:flex;align-items:center;gap:6px;font-size:10px;margin-bottom:6px;">${renderCheckbox(false, 12)}<span>Mandatory UCIC and Banned Dedupe</span></div>
                  <div>Authorized by (Emp code and sign)</div>
                </td>
              </tr>
              <tr>
                <td style="padding:4.5px 8px;border:1px solid #0f172a;">DD / UTR No</td>
                <td style="padding:4.5px 8px;border:1px solid #0f172a;">Ref No</td>
              </tr>
              <tr>
                <td style="padding:4.5px 8px;border:1px solid #0f172a;">Charges Recovered Rs (applicable only for Non Customer):</td>
                <td style="padding:4.5px 8px;border:1px solid #0f172a;">Day end Checked by</td>
              </tr>
              <tr>
                <td style="padding:4.5px 8px;border:1px solid #0f172a;">Transaction Authorized by (2<sup>nd</sup> Level) (for amount &gt; 5 lacs).</td>
                <td style="padding:4.5px 8px;border:1px solid #0f172a;"></td>
              </tr>
              <tr>
                <td style="padding:4.5px 8px;border:1px solid #0f172a;">KYC documentation done by (only for Non-HDFC Bank)</td>
                <td style="padding:4.5px 8px;border:1px solid #0f172a;"></td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Bottom Perforated Customers Copy -->
        <div class="slip-grid" style="border-top:1.5px dashed #334155;padding-top:12px;display:flex;justify-content:space-between;align-items:flex-start;">
          <div style="font-size:11.5px;line-height:1.55;flex:1;">
            <div class="slip-lbl" style="font-weight:800;">Customers Copy</div>
            <div class="slip-lbl" style="font-size:10.5px;margin-bottom:2px;">(To be produced by customer while collecting DD from bank)</div>
            <div>
              <span class="slip-lbl">DD for Rs.</span>
              <span class="slip-grid" style="display:inline-block;min-width:110px;border-bottom:1px solid #0f172a;padding:0 4px;"><span class="slip-val" style="font-family:'JetBrains Mono',monospace;font-weight:700;">${ddAmt > 0 ? fmtIn(ddAmt) : ''}</span></span>
              <span class="slip-lbl"> Drawn on </span>
              <span class="slip-grid" style="display:inline-block;min-width:190px;border-bottom:1px solid #0f172a;padding:0 4px;"><span class="slip-val" style="font-weight:700;">${esc(state.ddPayableAt)}</span></span>
            </div>
            <div>
              <span class="slip-lbl">Chq No:</span>
              <span class="slip-grid" style="display:inline-block;min-width:180px;border-bottom:1px solid #0f172a;padding:0 4px;"><span class="slip-val" style="font-family:'JetBrains Mono',monospace;font-weight:700;">${esc(state.ddChequeNo)}</span></span>
            </div>
            <div>
              <span class="slip-lbl">Customer Name:</span>
              <span class="slip-grid" style="display:inline-block;min-width:250px;border-bottom:1px solid #0f172a;padding:0 4px;"><span class="slip-val" style="font-weight:700;">${esc(state.name)}</span></span>
            </div>
            <div>
              <span class="slip-lbl">Customers A/c number</span>
              <span class="slip-grid" style="display:inline-block;min-width:230px;border-bottom:1px solid #0f172a;padding:0 4px;"><span class="slip-val" style="font-family:'JetBrains Mono',monospace;font-weight:700;">${esc(state.accountNo)}</span></span>
            </div>
            <div class="slip-lbl" style="font-weight:800;font-size:11px;margin-top:3px;">Request for DD / RTGS and NEFT can also be placed using NetBanking</div>
          </div>

          <div class="slip-lbl" style="width:130px;display:flex;flex-direction:column;align-items:center;padding-top:6px;">
            <div style="width:64px;height:64px;border:1.25px solid #0f172a;border-radius:9999px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:13.5px;font-weight:700;line-height:1.15;margin-bottom:6px;">
              <span>Bank</span>
              <span>Seal</span>
            </div>
            <div style="font-size:12px;font-weight:800;">For HDFC Bank</div>
          </div>
        </div>
      </div>`;

    const hdfcDdWarning =
      cashTotal > 0
        ? 'HDFC DD Application Form is Cheque Only — cash denomination notes are ignored.'
        : ddAmt > 0 && !state.ddChequeNo.trim()
        ? 'Enter Payment Cheque No. required by HDFC Cheque-Only DD Application Form.'
        : null;

    return {
      title: 'HDFC Demand Draft Application Form (Cheque Only)',
      orientation: 'portrait',
      width: 850,
      height: 1230,
      fontClass: 'slip-font-sans',
      frontHtml,
      backHtml: null,
      cashTotal: 0,
      chequeTotal: 0,
      grandTotal: ddAmt,
      requiresPanAlert: ddAmt >= 50000,
      warning: hdfcDdWarning,
      pdfFilename: `HDFC_DD_Form_${state.accountNo || 'Draft'}.pdf`,
    };
  }

  // ===========================================================================
  // 5. SBI RTGS / NEFT REMITTANCE CHALLAN (1568 x 540 Landscape — Official Exact Layout)
  // ===========================================================================
  if (bankId === 'sbi' && formType === 'rtgs') {
    const amt = parseFloat(state.rtgsAmount) || 0;
    const chg = parseFloat(state.rtgsCharges) || 0;
    const grandTotal = Math.round((amt + chg) * 100) / 100;
    const words = grandTotal > 0 ? numberToWordsIndian(grandTotal) : '';
    const amtWordsOnly = amt > 0 ? numberToWordsIndian(amt) : '';
    const acctMismatch =
      Boolean(state.rtgsBenAccount && state.rtgsBenAccountConfirm) &&
      state.rtgsBenAccount !== state.rtgsBenAccountConfirm;
    const rtgsMinWarning =
      state.rtgsType === 'rtgs' && amt > 0 && amt < 200000
        ? 'RTGS requires a minimum remittance of ₹2,00,000. Use NEFT for smaller transfers.'
        : null;
    const rtgsModeWarning =
      state.rtgsType === 'rtgs' && state.rtgsMode === 'trf'
        ? 'SBI form permits "Transfer" mode for NEFT only. Use Cheque mode for RTGS.'
        : null;
    const sbiIfscWarn =
      state.rtgsBenIfsc.trim() && !BANK_IFSC_REGEX.test(state.rtgsBenIfsc.trim().toUpperCase())
        ? 'Beneficiary IFSC must be 11 characters with "0" in the 5th position.'
        : null;
    const warning = acctMismatch
      ? 'Beneficiary Account Number and Re-Confirm Account Number do not match.'
      : rtgsModeWarning || rtgsMinWarning || sbiIfscWarn;

    const renderSbiBlueBannerBadge = (compact = false) => `
      <div class="slip-lbl" style="display:inline-flex;align-items:center;gap:${compact ? 5 : 6}px;background:#26378b;padding:${compact ? '3px 8px' : '4px 10px'};height:${compact ? 26 : 30}px;box-sizing:border-box;">
        <svg width="${compact ? 20 : 23}" height="${compact ? 20 : 23}" viewBox="0 0 32 32" style="flex-shrink:0;">
          <circle cx="16" cy="16" r="15" fill="#18a8e0" />
          <circle cx="16" cy="12.5" r="4.5" fill="#ffffff" />
          <rect x="14" y="16" width="4" height="15" fill="#ffffff" />
        </svg>
        <span style="font-family:Arial,Helvetica,sans-serif;font-weight:900;font-size:${compact ? 18 : 22}px;line-height:1;letter-spacing:0.6px;color:#ffffff;">SBI</span>
      </div>`;

    const renderFlushGridCells = (
      val: string,
      count: number,
      fontSize = 14,
      upper = false
    ) => {
      const clean = upper ? String(val || '').toUpperCase() : String(val || '');
      const chars = clean.slice(0, count).split('');
      return `<div style="display:flex;width:100%;height:100%;align-items:stretch;">${Array.from({
        length: count,
      })
        .map((_, idx) => {
          const ch = chars[idx] || '';
          const borderRight = idx < count - 1 ? 'border-right:1px solid #000000;' : '';
          return `<div class="slip-grid" style="flex:1;min-width:0;height:100%;box-sizing:border-box;${borderRight}display:flex;align-items:center;justify-content:center;font-family:'Times New Roman',Georgia,serif;font-size:${fontSize}px;font-weight:700;color:#000000;"><span class="slip-val">${ch ? esc(ch) : '&nbsp;'}</span></div>`;
        })
        .join('')}</div>`;
    };

    const renderSharpCheck = (checked: boolean, size = 18) =>
      `<span class="slip-grid" style="display:inline-flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border:1.25px solid #000000;background:#ffffff;box-sizing:border-box;flex-shrink:0;"><span class="slip-val" style="font-family:Arial,sans-serif;font-size:${size - 2}px;font-weight:900;line-height:1;color:#000000;">${checked ? '✓' : ''}</span></span>`;

    const spacedAccountDigits = esc(state.accountNo)
      .split('')
      .join(' ');

    const frontHtml = `
      <div class="slip-frame" style="width:1568px;height:540px;background:#ffffff;font-family:'Times New Roman',Georgia,serif;color:#000000;padding:18px 26px;display:flex;gap:30px;box-sizing:border-box;">
        <!-- LEFT COUNTERFOIL (Customer Receipt Stub) -->
        <div style="width:392px;height:100%;box-sizing:border-box;">
          <table style="width:100%;height:100%;border-collapse:collapse;table-layout:fixed;border:1.25px solid #000000;">
            <colgroup>
              <col style="width:128px;" />
              <col style="width:34px;" />
              <col style="width:52px;" />
              <col style="width:48px;" />
              <col style="width:130px;" />
            </colgroup>
            <tbody>
              <!-- Stub Row 1: SBI Blue Badge + State Bank of India -->
              <tr style="height:36px;">
                <td colspan="5" class="slip-grid" style="border:1px solid #000000;padding:3px 8px;">
                  <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                    ${renderSbiBlueBannerBadge(true)}
                    <span class="slip-lbl" style="font-size:17.5px;font-weight:800;letter-spacing:0.1px;color:#000000;white-space:nowrap;">State Bank of India</span>
                  </div>
                </td>
              </tr>

              <!-- Stub Row 2: [Branch Value] | Branch | Date | [Date Value] -->
              <tr style="height:26px;">
                <td colspan="2" class="slip-grid" style="border:1px solid #000000;padding:2px 6px;text-align:center;font-weight:700;font-size:13px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">
                  <span class="slip-val">${esc(state.branch)}</span>
                </td>
                <td class="slip-grid slip-lbl" style="border:1px solid #000000;padding:2px 4px;text-align:center;font-weight:700;font-size:12px;">Branch</td>
                <td class="slip-grid slip-lbl" style="border:1px solid #000000;padding:2px 4px;text-align:center;font-weight:700;font-size:12px;">Date</td>
                <td class="slip-grid" style="border:1px solid #000000;padding:2px 6px;text-align:center;font-weight:700;font-size:12.5px;">
                  <span class="slip-val">${dateObj.full}</span>
                </td>
              </tr>

              <!-- Stub Row 3: Received | ₹ | Total -->
              <tr style="height:30px;">
                <td class="slip-grid slip-lbl" style="border:1px solid #000000;padding:2px 8px;font-size:14.5px;">Received</td>
                <td class="slip-grid slip-lbl" style="border:1px solid #000000;padding:0;text-align:center;font-family:Arial,sans-serif;font-size:21px;font-weight:700;">₹</td>
                <td colspan="3" class="slip-grid" style="border:1px solid #000000;padding:2px 8px;text-align:right;font-weight:800;font-size:15px;">
                  <span class="slip-val">${grandTotal > 0 ? fmtIn(grandTotal) : ''}</span>
                </td>
              </tr>

              <!-- Stub Row 4: From | Applicant Name -->
              <tr style="height:28px;">
                <td class="slip-grid slip-lbl" style="border:1px solid #000000;padding:2px 8px;font-size:14.5px;">From</td>
                <td colspan="4" class="slip-grid" style="border:1px solid #000000;padding:2px 8px;font-weight:700;font-size:14px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">
                  <span class="slip-val">${esc(state.name)}</span>
                </td>
              </tr>

              <!-- Stub Row 5: Remittance Notice -->
              <tr style="height:38px;">
                <td colspan="5" class="slip-grid slip-lbl" style="border:1px solid #000000;padding:3px 6px;font-size:12.5px;line-height:1.25;">
                  For Remittance of NEFT/RTGS by way of (i) Transfer (only NEFT), (ii)Cheque (NEFT/RTGS) USING
                </td>
              </tr>

              <!-- Stub Row 6: Cheque No. -->
              <tr style="height:25px;">
                <td colspan="2" class="slip-grid slip-lbl" style="border:1px solid #000000;padding:2px 8px;font-size:13.5px;">Cheque No.</td>
                <td colspan="3" class="slip-grid" style="border:1px solid #000000;padding:2px 8px;font-weight:700;font-size:13.5px;">
                  <span class="slip-val">${state.rtgsMode === 'chq' ? esc(state.rtgsChequeNo) : state.rtgsMode === 'trf' ? 'TRANSFER' : ''}</span>
                </td>
              </tr>

              <!-- Stub Row 7: Favouring -->
              <tr style="height:28px;">
                <td colspan="2" class="slip-grid slip-lbl" style="border:1px solid #000000;padding:2px 8px;font-size:13.5px;">Favouring</td>
                <td colspan="3" class="slip-grid" style="border:1px solid #000000;padding:2px 8px;font-weight:700;font-size:13px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">
                  <span class="slip-val">${esc(state.rtgsBenName)}</span>
                </td>
              </tr>

              <!-- Stub Row 8: A/C NO. -->
              <tr style="height:28px;">
                <td colspan="2" class="slip-grid slip-lbl" style="border:1px solid #000000;padding:2px 8px;font-size:13.5px;">A/C NO.</td>
                <td colspan="3" class="slip-grid" style="border:1px solid #000000;padding:2px 8px;font-weight:700;font-size:13.5px;">
                  <span class="slip-val">${esc(state.rtgsBenAccount)}</span>
                </td>
              </tr>

              <!-- Stub Row 9: IFSC CODE -->
              <tr style="height:28px;">
                <td colspan="2" class="slip-grid slip-lbl" style="border:1px solid #000000;padding:2px 8px;font-size:13.5px;">IFSC CODE</td>
                <td colspan="3" class="slip-grid" style="border:1px solid #000000;padding:2px 8px;font-weight:700;font-size:13.5px;">
                  <span class="slip-val">${esc(state.rtgsBenIfsc.toUpperCase())}</span>
                </td>
              </tr>

              <!-- Stub Row 10: Beneficiary Bank & Branch -->
              <tr style="height:40px;">
                <td colspan="2" class="slip-grid slip-lbl" style="border:1px solid #000000;padding:2px 8px;font-size:13.5px;line-height:1.2;">Beneficiary Bank<br/>&amp; Branch</td>
                <td colspan="3" class="slip-grid" style="border:1px solid #000000;padding:2px 8px;font-weight:700;font-size:12.5px;line-height:1.2;">
                  <span class="slip-val">${esc(state.rtgsBenBank)}</span>
                </td>
              </tr>

              <!-- Stub Row 11: Amount | ₹ | amt -->
              <tr style="height:27px;">
                <td class="slip-grid slip-lbl" style="border:1px solid #000000;padding:2px 8px;font-size:13.5px;">Amount</td>
                <td class="slip-grid slip-lbl" style="border:1px solid #000000;padding:0;text-align:center;font-family:Arial,sans-serif;font-size:20px;font-weight:700;">₹</td>
                <td colspan="3" class="slip-grid" style="border:1px solid #000000;padding:2px 8px;text-align:right;font-weight:700;font-size:14px;">
                  <span class="slip-val">${amt > 0 ? fmtIn(amt) : ''}</span>
                </td>
              </tr>

              <!-- Stub Row 12: Bank Charges | ₹ | chg -->
              <tr style="height:27px;">
                <td class="slip-grid slip-lbl" style="border:1px solid #000000;padding:2px 8px;font-size:13.5px;">Bank Charges</td>
                <td class="slip-grid slip-lbl" style="border:1px solid #000000;padding:0;text-align:center;font-family:Arial,sans-serif;font-size:20px;font-weight:700;">₹</td>
                <td colspan="3" class="slip-grid" style="border:1px solid #000000;padding:2px 8px;text-align:right;font-weight:700;font-size:14px;">
                  <span class="slip-val">${chg > 0 ? fmtIn(chg) : ''}</span>
                </td>
              </tr>

              <!-- Stub Row 13: Total | ₹ | grandTotal -->
              <tr style="height:28px;">
                <td class="slip-grid slip-lbl" style="border:1px solid #000000;padding:2px 8px;font-size:13.5px;">Total</td>
                <td class="slip-grid slip-lbl" style="border:1px solid #000000;padding:0;text-align:center;font-family:Arial,sans-serif;font-size:20px;font-weight:700;">₹</td>
                <td colspan="3" class="slip-grid" style="border:1px solid #000000;padding:2px 8px;text-align:right;font-weight:800;font-size:14.5px;">
                  <span class="slip-val">${grandTotal > 0 ? fmtIn(grandTotal) : ''}</span>
                </td>
              </tr>

              <!-- Stub Row 14: (Rupees | words -->
              <tr style="height:34px;">
                <td class="slip-grid slip-lbl" style="border:1px solid #000000;padding:2px 6px;font-size:13.5px;">(Rupees</td>
                <td colspan="4" class="slip-grid" style="border:1px solid #000000;padding:2px 6px;font-weight:700;font-size:11.5px;line-height:1.2;">
                  <span class="slip-val">${esc(words)}</span>
                </td>
              </tr>

              <!-- Stub Row 15: For office Use -->
              <tr style="height:20px;">
                <td colspan="5" class="slip-grid slip-lbl" style="border:1px solid #000000;padding:1px 6px;font-size:12.5px;">For office Use</td>
              </tr>

              <!-- Stub Row 16: UTR No. | Branch Manager -->
              <tr style="height:40px;">
                <td colspan="3" class="slip-grid slip-lbl" style="border:1px solid #000000;padding:4px 8px;vertical-align:top;font-size:13px;">UTR No.</td>
                <td colspan="2" class="slip-grid slip-lbl" style="border:1px solid #000000;padding:4px 8px;vertical-align:bottom;text-align:right;font-size:13px;">Branch Manager</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- RIGHT MAIN APPLICATION FORM -->
        <div class="slip-grid" style="flex:1;height:100%;border:1.25px solid #000000;display:flex;flex-direction:column;box-sizing:border-box;">
          <!-- Row 1: SBI + State Bank of India | Application for RTGS/NEFT Remittance | Date | Value -->
          <div class="slip-grid" style="display:flex;height:40px;border-bottom:1px solid #000000;box-sizing:border-box;">
            <div class="slip-grid" style="width:324px;border-right:1px solid #000000;padding:0 10px;display:flex;align-items:center;gap:10px;box-sizing:border-box;">
              ${renderSbiBlueBannerBadge(false)}
              <span class="slip-lbl" style="font-size:21px;font-weight:500;color:#000000;white-space:nowrap;">State Bank of India</span>
            </div>
            <div class="slip-grid slip-lbl" style="flex:1;border-right:1px solid #000000;padding:0 10px;display:flex;align-items:center;justify-content:center;font-size:21px;font-weight:800;font-style:italic;text-decoration:underline;white-space:nowrap;box-sizing:border-box;">
              Application for RTGS/NEFT Remittance
            </div>
            <div class="slip-grid slip-lbl" style="width:76px;border-right:1px solid #000000;display:flex;align-items:center;justify-content:center;font-size:19px;box-sizing:border-box;">
              Date
            </div>
            <div style="width:178px;padding:0 8px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14.5px;box-sizing:border-box;">
              <span class="slip-val">${dateObj.full}</span>
            </div>
          </div>

          <!-- Row 2: Branch | Value | [ ] | NEFT | [ ] | RTGS | Branch Code | Value -->
          <div class="slip-grid" style="display:flex;height:30px;border-bottom:1px solid #000000;box-sizing:border-box;">
            <div class="slip-grid slip-lbl" style="width:100px;border-right:1px solid #000000;padding:0 8px;display:flex;align-items:center;font-weight:800;font-size:17.5px;box-sizing:border-box;">
              Branch
            </div>
            <div class="slip-grid" style="width:254px;border-right:1px solid #000000;padding:0 8px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14.5px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;box-sizing:border-box;">
              <span class="slip-val">${esc(state.branch)}</span>
            </div>
            <div class="slip-grid" style="width:34px;border-right:1px solid #000000;display:flex;align-items:center;justify-content:center;box-sizing:border-box;">
              ${renderSharpCheck(state.rtgsType === 'neft', 20)}
            </div>
            <div class="slip-grid slip-lbl" style="width:126px;border-right:1px solid #000000;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:17.5px;box-sizing:border-box;">
              NEFT
            </div>
            <div class="slip-grid" style="width:34px;border-right:1px solid #000000;display:flex;align-items:center;justify-content:center;box-sizing:border-box;">
              ${renderSharpCheck(state.rtgsType === 'rtgs', 20)}
            </div>
            <div class="slip-grid slip-lbl" style="width:128px;border-right:1px solid #000000;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:17.5px;box-sizing:border-box;">
              RTGS
            </div>
            <div class="slip-grid slip-lbl" style="width:162px;border-right:1px solid #000000;padding:0 8px;display:flex;align-items:center;font-weight:800;font-size:17px;white-space:nowrap;box-sizing:border-box;">
              Branch Code
            </div>
            <div style="flex:1;padding:0 8px;display:flex;align-items:center;font-weight:700;font-size:14.5px;box-sizing:border-box;">
              <span class="slip-val">${esc(state.branchCode)}</span>
            </div>
          </div>

          <!-- Row 3: Please remit the sum of | ₹ | Amount | ₹ | Words -->
          <div class="slip-grid" style="display:flex;height:30px;border-bottom:1px solid #000000;box-sizing:border-box;">
            <div class="slip-grid slip-lbl" style="width:206px;border-right:1px solid #000000;padding:0 8px;display:flex;align-items:center;font-size:16px;white-space:nowrap;box-sizing:border-box;">
              Please remit the sum of
            </div>
            <div class="slip-grid slip-lbl" style="width:36px;border-right:1px solid #000000;display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif;font-size:21px;font-weight:700;box-sizing:border-box;">
              ₹
            </div>
            <div class="slip-grid" style="width:282px;border-right:1px solid #000000;padding:0 8px;display:flex;align-items:center;font-weight:800;font-size:15px;box-sizing:border-box;">
              <span class="slip-val">${amt > 0 ? fmtIn(amt) : ''}</span>
            </div>
            <div class="slip-grid slip-lbl" style="width:36px;border-right:1px solid #000000;display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif;font-size:21px;font-weight:700;box-sizing:border-box;">
              ₹
            </div>
            <div style="flex:1;padding:0 8px;display:flex;align-items:center;font-weight:700;font-size:13.5px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;box-sizing:border-box;">
              <span class="slip-val">${esc(amtWordsOnly)}</span>
            </div>
          </div>

          <!-- Row 4: By Debiting my our Account No. <digits> by way of [ ] Transfer (only NEFT) [ ] Cheque (NEFT/RTGS) -->
          <div class="slip-grid" style="display:flex;height:32px;border-bottom:1px solid #000000;padding:0 8px;align-items:center;justify-content:space-between;gap:10px;box-sizing:border-box;">
            <div style="display:flex;align-items:center;gap:14px;min-width:0;flex:1;">
              <span class="slip-lbl" style="font-size:17px;white-space:nowrap;">By Debiting my our Account No.</span>
              <span class="slip-val" style="font-weight:800;font-size:15px;letter-spacing:4px;white-space:nowrap;">${spacedAccountDigits}</span>
            </div>
            <div style="display:flex;align-items:center;gap:14px;flex-shrink:0;">
              <span class="slip-lbl" style="font-size:17px;white-space:nowrap;">by way of</span>
              <span style="display:inline-flex;align-items:center;gap:6px;">
                ${renderSharpCheck(state.rtgsMode === 'trf', 20)}
                <span class="slip-lbl" style="font-size:15px;white-space:nowrap;">Transfer (only NEFT)</span>
              </span>
              <span style="display:inline-flex;align-items:center;gap:6px;">
                ${renderSharpCheck(state.rtgsMode === 'chq', 20)}
                <span class="slip-lbl" style="font-size:15px;white-space:nowrap;">Cheque <span style="font-size:13px;">(NEFT/RTGS)</span></span>
              </span>
            </div>
          </div>

          <!-- Row 5: Using Cheque No. | Value | Dated | Value | For the total amount... -->
          <div class="slip-grid" style="display:flex;height:36px;border-bottom:1px solid #000000;box-sizing:border-box;">
            <div class="slip-grid slip-lbl" style="width:176px;border-right:1px solid #000000;padding:0 8px;display:flex;align-items:center;font-size:16.5px;white-space:nowrap;box-sizing:border-box;">
              Using Cheque No.
            </div>
            <div class="slip-grid" style="width:178px;border-right:1px solid #000000;padding:0 8px;display:flex;align-items:center;font-weight:700;font-size:14.5px;box-sizing:border-box;">
              <span class="slip-val">${state.rtgsMode === 'chq' ? esc(state.rtgsChequeNo) : ''}</span>
            </div>
            <div class="slip-grid slip-lbl" style="width:110px;border-right:1px solid #000000;display:flex;align-items:center;justify-content:center;font-size:16.5px;box-sizing:border-box;">
              Dated
            </div>
            <div class="slip-grid" style="width:138px;border-right:1px solid #000000;padding:0 8px;display:flex;align-items:center;font-weight:700;font-size:14px;box-sizing:border-box;">
              <span class="slip-val">${state.rtgsMode === 'chq' ? chqDateObj.full : ''}</span>
            </div>
            <div class="slip-lbl" style="flex:1;padding:0 8px;display:flex;align-items:center;font-size:12.2px;line-height:1.2;box-sizing:border-box;">
              For the total amount including your charges, as per the details given below:
            </div>
          </div>

          <!-- Row 6: Name of the Beneficiary -->
          <div class="slip-grid" style="display:flex;height:34px;border-bottom:1px solid #000000;box-sizing:border-box;">
            <div class="slip-grid slip-lbl" style="width:242px;border-right:1px solid #000000;padding:0 8px;display:flex;align-items:center;font-size:17px;box-sizing:border-box;">
              Name of the Beneficiary
            </div>
            <div style="flex:1;padding:0 10px;display:flex;align-items:center;font-weight:800;font-size:15.5px;box-sizing:border-box;">
              <span class="slip-val">${esc(state.rtgsBenName)}</span>
            </div>
          </div>

          <!-- Row 7: Beneficiary Bank & Branch -->
          <div class="slip-grid" style="display:flex;height:46px;border-bottom:1px solid #000000;box-sizing:border-box;">
            <div class="slip-grid slip-lbl" style="width:242px;border-right:1px solid #000000;padding:0 8px;display:flex;align-items:center;font-size:17px;line-height:1.2;box-sizing:border-box;">
              Beneficiary Bank &amp;<br/>Branch
            </div>
            <div style="flex:1;padding:0 10px;display:flex;align-items:center;font-weight:700;font-size:14.5px;box-sizing:border-box;">
              <span class="slip-val">${esc(state.rtgsBenBank)}</span>
            </div>
          </div>

          <!-- Row 8: IFSC CODE (11 Flush Grid Cells aligned with first 11 Account boxes + 7-part Right Spacer Box) -->
          <div class="slip-grid" style="display:flex;height:32px;border-bottom:1px solid #000000;box-sizing:border-box;">
            <div class="slip-grid slip-lbl" style="width:242px;border-right:1px solid #000000;padding:0 8px;display:flex;align-items:center;font-size:17px;box-sizing:border-box;">
              IFSC CODE:
            </div>
            <div style="flex:1;height:100%;display:flex;box-sizing:border-box;">
              <div class="slip-grid" style="flex:11;min-width:0;height:100%;border-right:1px solid #000000;box-sizing:border-box;">
                ${renderFlushGridCells(state.rtgsBenIfsc, 11, 14.5, true)}
              </div>
              <div style="flex:7;min-width:0;height:100%;">&nbsp;</div>
            </div>
          </div>

          <!-- Row 9: Beneficiary Account No. (18 Flush Grid Cells spanning full right side) -->
          <div class="slip-grid" style="display:flex;height:32px;border-bottom:1px solid #000000;box-sizing:border-box;">
            <div class="slip-grid slip-lbl" style="width:242px;border-right:1px solid #000000;padding:0 8px;display:flex;align-items:center;font-size:17px;box-sizing:border-box;">
              Beneficiary Account No.
            </div>
            <div style="flex:1;min-width:0;height:100%;box-sizing:border-box;">
              ${renderFlushGridCells(state.rtgsBenAccount, 18, 14.5, false)}
            </div>
          </div>

          <!-- Row 10: Amount (in Words) | ₹ | Words -->
          <div class="slip-grid" style="display:flex;height:30px;border-bottom:1px solid #000000;box-sizing:border-box;">
            <div class="slip-grid slip-lbl" style="width:242px;border-right:1px solid #000000;padding:0 8px;display:flex;align-items:center;font-size:16.5px;box-sizing:border-box;">
              Amount (in Words)
            </div>
            <div class="slip-grid slip-lbl" style="width:44px;border-right:1px solid #000000;display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif;font-size:21px;font-weight:700;box-sizing:border-box;">
              ₹
            </div>
            <div style="flex:1;padding:0 8px;display:flex;align-items:center;font-weight:700;font-size:13.5px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;box-sizing:border-box;">
              <span class="slip-val">${esc(words)}</span>
            </div>
          </div>

          <!-- Row 11: Amount (in Figures) | ₹ | Value | Charges ₹ | Value | Total ₹ | Value -->
          <div class="slip-grid" style="display:flex;height:31px;border-bottom:1px solid #000000;box-sizing:border-box;">
            <div class="slip-grid slip-lbl" style="width:242px;border-right:1px solid #000000;padding:0 8px;display:flex;align-items:center;font-size:16.5px;box-sizing:border-box;">
              Amount (in Figures)
            </div>
            <div class="slip-grid slip-lbl" style="width:44px;border-right:1px solid #000000;display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif;font-size:21px;font-weight:700;box-sizing:border-box;">
              ₹
            </div>
            <div class="slip-grid" style="width:176px;border-right:1px solid #000000;padding:0 8px;display:flex;align-items:center;justify-content:flex-end;font-weight:800;font-size:15px;box-sizing:border-box;">
              <span class="slip-val">${amt > 0 ? fmtIn(amt) : ''}</span>
            </div>
            <div class="slip-grid slip-lbl" style="width:118px;border-right:1px solid #000000;padding:0 8px;display:flex;align-items:center;font-size:16px;white-space:nowrap;box-sizing:border-box;">
              Charges &nbsp;₹
            </div>
            <div class="slip-grid" style="width:190px;border-right:1px solid #000000;padding:0 8px;display:flex;align-items:center;justify-content:flex-end;font-weight:700;font-size:15px;box-sizing:border-box;">
              <span class="slip-val">${chg > 0 ? fmtIn(chg) : ''}</span>
            </div>
            <div class="slip-grid slip-lbl" style="width:120px;border-right:1px solid #000000;padding:0 8px;display:flex;align-items:center;font-size:16px;white-space:nowrap;box-sizing:border-box;">
              Total &nbsp;₹
            </div>
            <div style="flex:1;padding:0 8px;display:flex;align-items:center;justify-content:flex-end;font-weight:800;font-size:15px;box-sizing:border-box;">
              <span class="slip-val">${grandTotal > 0 ? fmtIn(grandTotal) : ''}</span>
            </div>
          </div>

          <!-- Row 12: Name of the Applicant | Value | Address | Value -->
          <div class="slip-grid" style="display:flex;height:32px;border-bottom:1px solid #000000;box-sizing:border-box;">
            <div class="slip-grid slip-lbl" style="width:242px;border-right:1px solid #000000;padding:0 8px;display:flex;align-items:center;font-size:16.5px;box-sizing:border-box;">
              Name of the Applicant
            </div>
            <div class="slip-grid" style="width:336px;border-right:1px solid #000000;padding:0 8px;display:flex;align-items:center;font-weight:800;font-size:14.5px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;box-sizing:border-box;">
              <span class="slip-val">${esc(state.name)}</span>
            </div>
            <div class="slip-grid slip-lbl" style="width:90px;border-right:1px solid #000000;display:flex;align-items:center;justify-content:center;font-size:16.5px;box-sizing:border-box;">
              Address
            </div>
            <div style="flex:1;padding:0 8px;display:flex;align-items:center;font-weight:600;font-size:12.5px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;box-sizing:border-box;">
              <span class="slip-val">${esc(state.address)}</span>
            </div>
          </div>

          <!-- Row 13: Mobile No. | 10 Flush Boxes | Tel No. | Value | UTR No. & Date | Value -->
          <div class="slip-grid" style="display:flex;height:31px;border-bottom:1px solid #000000;box-sizing:border-box;">
            <div class="slip-grid slip-lbl" style="width:128px;border-right:1px solid #000000;padding:0 8px;display:flex;align-items:center;font-size:16.5px;box-sizing:border-box;">
              Mobile No.
            </div>
            <div class="slip-grid" style="width:238px;height:100%;border-right:1px solid #000000;box-sizing:border-box;">
              ${renderFlushGridCells(state.mobile, 10, 14.5, false)}
            </div>
            <div class="slip-grid slip-lbl" style="width:84px;border-right:1px solid #000000;display:flex;align-items:center;justify-content:center;font-size:16.5px;box-sizing:border-box;">
              Tel No.
            </div>
            <div class="slip-grid" style="width:156px;border-right:1px solid #000000;padding:0 8px;display:flex;align-items:center;font-weight:700;font-size:14px;box-sizing:border-box;">
              <span class="slip-val">${esc(state.tel)}</span>
            </div>
            <div class="slip-grid slip-lbl" style="width:166px;border-right:1px solid #000000;padding:0 8px;display:flex;align-items:center;font-size:16.5px;box-sizing:border-box;">
              UTR No. &amp; Date
            </div>
            <div style="flex:1;padding:0 8px;">&nbsp;</div>
          </div>

          <!-- Row 14: (for Office Use) | (Please see conditions on the reverse) | Signature of Applicant(s) | Blank Box -->
          <div style="display:flex;flex:1;box-sizing:border-box;">
            <div class="slip-grid slip-lbl" style="width:176px;border-right:1px solid #000000;display:flex;align-items:center;justify-content:center;font-size:17px;box-sizing:border-box;">
              (for Office Use)
            </div>
            <div class="slip-grid slip-lbl" style="width:342px;border-right:1px solid #000000;display:flex;align-items:center;justify-content:center;font-size:17px;box-sizing:border-box;">
              (Please see conditions on the reverse)
            </div>
            <div class="slip-grid slip-lbl" style="width:254px;border-right:1px solid #000000;display:flex;align-items:center;justify-content:center;font-size:17px;box-sizing:border-box;">
              Signature of Applicant(s)
            </div>
            <div style="flex:1;">&nbsp;</div>
          </div>
        </div>
      </div>`;

    const backHtml = `
      <div class="slip-frame" style="width:1568px;height:540px;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#000000;padding:42px 26px;display:flex;box-sizing:border-box;">
        <div style="width:422px;"></div>
        <div class="slip-grid slip-lbl" style="flex:1;border:1.25px solid #000000;display:flex;flex-direction:column;">
          <div style="border-bottom:1.25px solid #000000;padding:10px 14px;text-align:center;font-size:21px;font-weight:700;">Application for RTGS/NEFT Remittance</div>
          <div style="padding:14px 20px 12px 20px;flex:1;display:flex;flex-direction:column;justify-content:space-between;font-size:13.8px;line-height:1.48;text-align:justify;">
            <div>
              <div style="font-weight:700;margin-bottom:4px;">Conditions for Transfer</div>
              <div>1. All payment instructions be carefully checked by the remitter. As crediting the proceeds of the remittance is based on the beneficiary's account number, the name of the bank and its branch SBI shall not be responsible if these particulars are not provided correctly by the remitter.</div>
              <div>2. Applications/Message received after the business hours will be sent only the immediate next working day.</div>
              <div>3. SBI shall not be responsible for any delay in processing of the payment due to RBI/RTGS/NEFT system not being available/failure of internal communication system at the recipient bank/branch/incorrect information provided by the remitter/Any incorrect credit accorded by the recipient bank/branch due to incorrect information provided by the remitter.</div>
              <div>4. (i) Remitting branch shall not be liable for any loss or damage resulting from delay in transmission delivery or non-delivery of electronic message or any mistake, omission or error in transmission or delivery thereof or in encrypting/decrypting the message for any cause whatsoever or from misinterpretation when received or for the action of the destination bank or for any act beyond the control of State Bank of India.</div>
              <div style="padding-left:22px;">(ii) If the recipient branch is closed for any reason, the account shall be credited on the immediate next working day.</div>
              <div style="padding-left:22px;">(iii) Bank is free to recover charges in respect of remittance returned on account of faulty/inadequate information.</div>
              <div>5. I/We have fully read the terms and conditions of the RTGS/NEFT remittance and shall abide by the same.</div>
            </div>
            <div style="text-align:right;font-weight:600;padding-top:10px;">(Signature of applicant(s))</div>
          </div>
        </div>
      </div>`;

    return {
      title: 'SBI Application for RTGS / NEFT Remittance',
      orientation: 'landscape',
      width: 1568,
      height: 540,
      fontClass: 'slip-font-sans',
      frontHtml,
      backHtml,
      cashTotal: 0,
      chequeTotal: 0,
      grandTotal,
      requiresPanAlert: false,
      warning,
      pdfFilename: `SBI_RTGS_NEFT_${state.accountNo || 'Draft'}.pdf`,
    };
  }

  // ===========================================================================
  // 6. HDFC RTGS / NEFT REQUEST FORM (910 x 1316 Portrait — Official 92929/13.03.2026_M019)
  // ===========================================================================
  const amt = parseFloat(state.rtgsAmount) || 0;
  const words = amt > 0 ? numberToWordsIndian(amt) : '';
  const acctMismatch =
    Boolean(state.rtgsBenAccount && state.rtgsBenAccountConfirm) &&
    state.rtgsBenAccount !== state.rtgsBenAccountConfirm;
  const rtgsMinWarning =
    state.rtgsType === 'rtgs' && amt > 0 && amt < 200000
      ? 'RTGS requires a minimum remittance of ₹2,00,000. Switch to NEFT for smaller amounts.'
      : null;
  const hdfcIfscWarn =
    state.rtgsBenIfsc.trim() && !BANK_IFSC_REGEX.test(state.rtgsBenIfsc.trim().toUpperCase())
      ? 'Beneficiary IFSC must be 11 characters with "0" in the 5th position.'
      : null;
  const warning = acctMismatch
    ? 'Beneficiary Account Number and Re-Confirm Account Number do not match.'
    : rtgsMinWarning || hdfcIfscWarn;

  const nepalPurpose = state.rtgsNepalPurpose || '';
  const dmyPh = ['D', 'D', 'M', 'M', 'Y', 'Y', 'Y', 'Y'];

  const frontHtml = `
    <div class="slip-frame" style="width:910px;height:1316px;background:#ffffff;border:1.5px solid #0f172a;font-family:'DM Sans',Arial,sans-serif;color:#0f172a;padding:16px 28px 18px 28px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;position:relative;">
      <div>
        <!-- Header Row -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
          <div style="width:160px;"></div>
          <div class="slip-lbl" style="font-size:17px;font-weight:800;text-align:center;">RTGS / NEFT Request Form</div>
          <div style="text-align:right;">
            <span class="slip-lbl" style="display:inline-flex;align-items:center;gap:5px;">
              <svg width="16" height="16" viewBox="0 0 28 28"><rect x="0" y="0" width="28" height="28" fill="#ed232a"/><rect x="5" y="5" width="18" height="18" fill="#fff"/><rect x="0" y="11" width="28" height="6" fill="#fff"/><rect x="11" y="0" width="6" height="28" fill="#fff"/><rect x="9.5" y="9.5" width="9" height="9" fill="#004c8f"/></svg>
              <span style="font-size:13px;font-weight:900;color:#004c8f;">HDFC BANK</span>
            </span>
          </div>
        </div>

        <div style="display:flex;align-items:center;gap:120px;margin-bottom:3px;font-size:11.5px;font-weight:700;">
          <div style="display:flex;align-items:center;gap:6px;">${renderCheckbox(state.rtgsType === 'rtgs', 14)}<span class="slip-lbl">RTGS</span></div>
          <div style="display:flex;align-items:center;gap:6px;">${renderCheckbox(state.rtgsType === 'neft', 14)}<span class="slip-lbl">NEFT</span></div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:4px;font-size:11px;">
          <div class="slip-lbl" style="font-weight:800;">For RTGS / NEFT</div>
          <div>
            <span class="slip-lbl">Date of Request: </span>
            <span class="slip-grid" style="display:inline-block;min-width:130px;border-bottom:1px solid #0f172a;padding:0 6px;"><span class="slip-val" style="font-family:'JetBrains Mono',monospace;font-weight:700;">${dateObj.full}</span></span>
          </div>
        </div>

        <!-- Max Limit Table -->
        <table class="slip-lbl" style="width:100%;border-collapse:collapse;font-size:9.8px;margin-bottom:5px;">
          <tbody>
            <tr>
              <td colspan="2" style="padding:2.5px 8px;border:1px solid #0f172a;text-align:center;font-weight:800;">Maximum Limit for NEFT Transaction</td>
            </tr>
            <tr>
              <td style="padding:2px 8px;border:1px solid #0f172a;width:62%;">HDFC Bank Customer</td>
              <td style="padding:2px 8px;border:1px solid #0f172a;">No Limit</td>
            </tr>
            <tr>
              <td style="padding:2px 8px;border:1px solid #0f172a;">HDFC Bank Customer - Indo Nepal NEFT Remittance</td>
              <td style="padding:2px 8px;border:1px solid #0f172a;">via Account - Up to INR 200000/-</td>
            </tr>
            <tr>
              <td style="padding:2px 8px;border:1px solid #0f172a;">Non HDFC Bank Customer &amp; Indo Nepal NEFT Remittance</td>
              <td style="padding:2px 8px;border:1px solid #0f172a;">Up to INR 50,000/-</td>
            </tr>
            <tr>
              <td colspan="2" style="padding:2.5px 8px;border:1px solid #0f172a;">
                <span class="slip-lbl">Purpose of Remittance to Nepal - tick one (</span>
                <span style="display:inline-flex;align-items:center;gap:3px;">${renderCheckbox(nepalPurpose === 'family', 10)}<span class="slip-lbl">Family Maintenance</span></span>
                <span class="slip-lbl"> / </span>
                <span style="display:inline-flex;align-items:center;gap:3px;">${renderCheckbox(nepalPurpose === 'retirement', 10)}<span class="slip-lbl">Retirement Fund</span></span>
                <span class="slip-lbl"> / </span>
                <span style="display:inline-flex;align-items:center;gap:3px;">${renderCheckbox(nepalPurpose === 'pension', 10)}<span class="slip-lbl">Pension Fund</span></span>
                <span class="slip-lbl"> / </span>
                <span style="display:inline-flex;align-items:center;gap:3px;">${renderCheckbox(nepalPurpose === 'others', 10)}<span class="slip-lbl">Others </span><span class="slip-grid" style="display:inline-block;min-width:75px;border-bottom:1px solid #0f172a;padding:0 3px;"><span class="slip-val" style="font-weight:700;">${esc(state.rtgsNepalPurposeOther || '')}</span></span></span>
                <span class="slip-lbl">)</span>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Customer / Remitter Fields -->
        <div style="font-size:10.8px;display:flex;flex-direction:column;gap:3px;margin-bottom:5px;">
          <div style="display:flex;align-items:flex-end;gap:6px;">
            <span class="slip-lbl">Time</span>
            <span class="slip-grid" style="width:140px;border-bottom:1px solid #0f172a;min-height:14px;padding:0 4px;"><span class="slip-val" style="font-family:'JetBrains Mono',monospace;font-weight:700;">${esc(state.rtgsTime)}</span></span>
          </div>
          <div style="display:flex;align-items:flex-end;gap:6px;">
            <span class="slip-lbl" style="white-space:nowrap;">Customer's Name</span>
            <span class="slip-grid" style="flex:1;border-bottom:1px solid #0f172a;min-height:14px;padding:0 4px;"><span class="slip-val" style="font-weight:700;">${esc(state.name)}</span></span>
          </div>
          <div style="display:flex;align-items:flex-end;gap:5px;">
            <span class="slip-lbl" style="white-space:nowrap;">Account no</span>
            <span class="slip-grid" style="width:195px;border-bottom:1px solid #0f172a;min-height:14px;padding:0 4px;"><span class="slip-val" style="font-family:'JetBrains Mono',monospace;font-weight:700;">${esc(state.accountNo)}</span></span>
            <span class="slip-lbl" style="white-space:nowrap;">Chq no</span>
            <span class="slip-grid" style="width:115px;border-bottom:1px solid #0f172a;min-height:14px;padding:0 4px;"><span class="slip-val" style="font-family:'JetBrains Mono',monospace;font-weight:700;">${esc(state.rtgsChequeNo)}</span></span>
            <span class="slip-lbl" style="font-size:9.5px;white-space:nowrap;">favouring HDFC Bank Ltd for NEFT/RTGS (whichever applicable)</span>
          </div>
          <div style="display:flex;align-items:flex-end;gap:6px;">
            <span class="slip-lbl">Mobile No</span>
            <span class="slip-grid" style="width:240px;border-bottom:1px solid #0f172a;min-height:14px;padding:0 4px;"><span class="slip-val" style="font-family:'JetBrains Mono',monospace;font-weight:700;">${esc(state.mobile)}</span></span>
            <span class="slip-lbl">Tel No</span>
            <span class="slip-grid" style="flex:1;border-bottom:1px solid #0f172a;min-height:14px;padding:0 4px;"><span class="slip-val" style="font-family:'JetBrains Mono',monospace;">${esc(state.tel)}</span></span>
          </div>

          <div style="display:flex;align-items:center;gap:8px;margin-top:1px;">
            <span class="slip-lbl" style="white-space:nowrap;">Remitter Legal Entity Identifier Code (LEI)</span>
            ${renderDigitBoxes(state.rtgsLei, 20, 22, 17, 10)}
          </div>
          <div class="slip-lbl" style="font-size:9.2px;">(*Only applicable for Rs.50 cr &amp; above transaction for non-individual accounts)</div>

          <div style="display:flex;align-items:center;gap:10px;">
            <span class="slip-lbl">LEI Expiry Date:</span>
            ${renderDigitBoxes(`${leiExpObj.d}${leiExpObj.m}${leiExpObj.y}`, 8, 22, 17, 10, '#1e293b', dmyPh)}
          </div>

          <div style="display:flex;align-items:flex-end;gap:6px;">
            <span class="slip-lbl" style="white-space:nowrap;">Address of Remitter (Mandatory for Non HDFC Bank Customer)</span>
            <span class="slip-grid" style="flex:1;border-bottom:1px solid #0f172a;min-height:14px;padding:0 4px;"><span class="slip-val">${esc(state.address)}</span></span>
          </div>
          <div style="display:flex;align-items:flex-end;gap:6px;">
            <span class="slip-lbl">Email id</span>
            <span class="slip-grid" style="flex:1;border-bottom:1px solid #0f172a;min-height:14px;padding:0 4px;"><span class="slip-val">${esc(state.email)}</span></span>
          </div>
          <div style="display:flex;align-items:flex-end;gap:6px;">
            <span class="slip-lbl" style="white-space:nowrap;">In case of Non HDFC Bank Customer Amount of Cash Deposited Rs.</span>
            <span class="slip-grid" style="flex:1;border-bottom:1px solid #0f172a;min-height:14px;padding:0 4px;"><span class="slip-val" style="font-family:'JetBrains Mono',monospace;font-weight:700;">${esc(state.rtgsNonHdfcCash)}</span></span>
          </div>
        </div>

        <!-- Beneficiary Details -->
        <div class="slip-lbl" style="font-size:11.5px;font-weight:800;margin-bottom:3px;">Beneficiary details :</div>
        <div style="font-size:10.8px;display:flex;flex-direction:column;gap:3px;margin-bottom:5px;">
          <div style="display:flex;align-items:flex-end;gap:6px;">
            <span class="slip-lbl">Name</span>
            <span class="slip-grid" style="flex:1.3;border-bottom:1px solid #0f172a;min-height:14px;padding:0 4px;"><span class="slip-val" style="font-weight:800;">${esc(state.rtgsBenName)}</span></span>
            <span class="slip-lbl" style="white-space:nowrap;">Beneficiary Contact No.</span>
            <span class="slip-grid" style="flex:0.8;border-bottom:1px solid #0f172a;min-height:14px;padding:0 4px;"><span class="slip-val" style="font-family:'JetBrains Mono',monospace;">${esc(state.rtgsBenContact)}</span></span>
          </div>
          <div style="display:flex;align-items:flex-end;gap:6px;">
            <span class="slip-lbl">Address</span>
            <span class="slip-grid" style="flex:1;border-bottom:1px solid #0f172a;min-height:14px;padding:0 4px;"><span class="slip-val">${esc(state.rtgsBenAddress)}</span></span>
          </div>
          <div style="display:flex;align-items:flex-end;gap:6px;">
            <span class="slip-lbl" style="white-space:nowrap;">Account No :</span>
            <span class="slip-grid" style="flex:1;border-bottom:1px solid #0f172a;min-height:14px;padding:0 4px;"><span class="slip-val" style="font-family:'JetBrains Mono',monospace;font-weight:800;font-size:12px;">${esc(state.rtgsBenAccount)}</span></span>
          </div>
          <div style="display:flex;align-items:flex-end;gap:6px;">
            <span class="slip-lbl" style="white-space:nowrap;">Re-Confirm Account no:</span>
            <span class="slip-grid" style="flex:1;border-bottom:1px solid #0f172a;min-height:14px;padding:0 4px;"><span class="slip-val" style="font-family:'JetBrains Mono',monospace;font-weight:800;font-size:12px;">${esc(state.rtgsBenAccountConfirm)}</span></span>
          </div>
          <div style="display:flex;align-items:flex-end;gap:6px;">
            <span class="slip-lbl" style="white-space:nowrap;">Bank Name &amp; Branch :</span>
            <span class="slip-grid" style="flex:1.25;border-bottom:1px solid #0f172a;min-height:14px;padding:0 4px;"><span class="slip-val" style="font-weight:600;">${esc(state.rtgsBenBank)}</span></span>
            <span class="slip-lbl" style="white-space:nowrap;">IFSC Code</span>
            <span class="slip-grid" style="flex:0.75;border-bottom:1px solid #0f172a;min-height:14px;padding:0 4px;"><span class="slip-val" style="font-family:'JetBrains Mono',monospace;font-weight:800;">${esc(state.rtgsBenIfsc)}</span></span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="slip-lbl">A/c Type :</span>
            <span style="display:inline-flex;align-items:center;gap:4px;">${renderCheckbox(state.rtgsBenAcType === 'res', 12)}<span class="slip-lbl">Resident</span></span>
            <span style="display:inline-flex;align-items:center;gap:4px;">${renderCheckbox(state.rtgsBenAcType === 'nr', 12)}<span class="slip-lbl">Non Resident</span></span>
            <span style="display:inline-flex;align-items:center;gap:4px;">${renderCheckbox(state.rtgsBenAcType === 'fcra', 12)}<span class="slip-lbl">FCRA</span></span>
            <span class="slip-lbl" style="margin-left:10px;">Purpose</span>
            <span class="slip-grid" style="flex:1;border-bottom:1px solid #0f172a;min-height:14px;padding:0 4px;"><span class="slip-val">${esc(state.rtgsPurpose)}</span></span>
          </div>

          <div style="display:flex;align-items:center;gap:8px;margin-top:1px;">
            <span class="slip-lbl" style="white-space:nowrap;">Beneficiary Legal Entity Identifier Code (LEI)</span>
            ${renderDigitBoxes(state.rtgsBenLei, 20, 22, 17, 10)}
          </div>
          <div class="slip-lbl" style="font-size:9.2px;">(*Only applicable for Rs.50 cr &amp; above transaction for non-individual accounts)</div>

          <div style="display:flex;align-items:center;gap:10px;">
            <span class="slip-lbl">LEI Expiry Date:</span>
            ${renderDigitBoxes(`${benLeiExpObj.d}${benLeiExpObj.m}${benLeiExpObj.y}`, 8, 22, 17, 10, '#1e293b', dmyPh)}
          </div>

          <div style="display:flex;align-items:flex-end;gap:6px;">
            <span class="slip-lbl" style="white-space:nowrap;">Amount to be credited (in figures):</span>
            <span class="slip-grid" style="width:170px;border-bottom:1px solid #0f172a;min-height:15px;padding:0 4px;"><span class="slip-val" style="font-family:'JetBrains Mono',monospace;font-weight:800;font-size:12px;">${amt > 0 ? '₹ ' + fmtIn(amt) : ''}</span></span>
            <span class="slip-lbl" style="white-space:nowrap;">(In Words):</span>
            <span class="slip-grid" style="flex:1;border-bottom:1px solid #0f172a;min-height:15px;padding:0 4px;"><span class="slip-val" style="font-weight:700;font-size:10.5px;">${esc(words)}</span></span>
          </div>

          <div style="display:flex;align-items:flex-end;gap:6px;">
            <span class="slip-lbl">Remarks:</span>
            <span class="slip-grid" style="flex:1;border-bottom:1px solid #0f172a;min-height:14px;padding:0 4px;"><span class="slip-val">${esc(state.rtgsRemarks)}</span></span>
          </div>
        </div>

        <!-- Exact BANV Section -->
        <div style="font-size:8.8px;line-height:1.28;margin-bottom:5px;">
          <div class="slip-lbl" style="margin-bottom:2px;">
            <strong>Beneficiary Bank Account Name Verification (BANV) (Not applicable for Indo-Nepal Remittance):</strong> To ensure a smooth transaction, HDFC Bank requires you to confirm how the beneficiary's bank account name details should be verified. If you want HDFC Bank to process your transaction, then select either of one option.
          </div>
          <div style="display:flex;align-items:flex-start;gap:5px;margin-bottom:2px;">
            ${renderCheckbox(state.rtgsBanv === '1', 11)}
            <div class="slip-lbl">
              <strong>Option 1 – HDFC Bank to verify the beneficiary bank account name</strong><br/>
              I/We have not verified the beneficiary's bank account name and request HDFC Bank to verify the same. If the verification fails due to any reason whatsoever including but not limited to mismatch in beneficiary bank account name with the details provided hereinabove, I/We authorise HDFC Bank to cancel the transaction and not to process it.
            </div>
          </div>
          <div style="display:flex;align-items:flex-start;gap:5px;margin-bottom:3px;">
            ${renderCheckbox(state.rtgsBanv === '2', 11)}
            <div class="slip-lbl">
              <strong>Option 2 - Beneficiary bank account name is verified by the customer/remitter</strong><br/>
              I/We have verified the beneficiary bank account number, IFSC code and the same belongs to the intended beneficiary, details given hereinabove. I/We authorise HDFC Bank to transfer the funds as per the request and details mentioned hereinabove at my/our own risk and consequences, even if the beneficiary's bank account name verification is not successful at Bank's end due to any reason, I/We shall not hold HDFC Bank responsible and liable for such remittance.
            </div>
          </div>
          <div class="slip-lbl" style="font-size:10px;">
            <strong>I/we agree to terms and conditions mentioned overleaf.</strong> For Indo Nepal remittance. I/we declare that the purpose of remittance is for above selected purpose only.
          </div>
          <div class="slip-lbl" style="font-size:10px;margin-top:6px;">Signature of Authorized signatory</div>
        </div>

        <!-- Digital Arrest Dark Banner -->
        <div class="slip-lbl" style="background:#333333;color:#ffffff;padding:5px 12px;text-align:center;font-size:9.8px;font-weight:800;line-height:1.3;margin-bottom:5px;">
          THERE IS NO SUCH THING AS DIGITAL ARREST. PAUSE AND STAY CALM.<br/>
          REAL AUTHORITIES NEVER DEMAND MONEY ON VIDEO CALLS OR OVER TELEPHONE CALLS.<br/>
          TALK TO OUR STAFF FOR ANY ASSISTANCE
        </div>

        <!-- For bank Use only + 1st/2nd/3rd Signatories -->
        <div class="slip-lbl" style="display:flex;justify-content:space-between;font-size:10px;font-weight:700;margin-bottom:2px;padding-right:34px;">
          <span>For bank Use only</span>
          <span>1st Signatory</span>
          <span>2nd Signatory</span>
          <span>3rd signatory</span>
        </div>

        <div style="position:relative;padding-right:18px;margin-bottom:4px;">
          <table class="slip-lbl" style="width:100%;border-collapse:collapse;font-size:9.2px;">
            <tbody>
              <tr>
                <td style="padding:2px 6px;border:1px solid #0f172a;width:58%;">Processed by (Emp code and sign)</td>
                <td style="padding:2px 6px;border:1px solid #0f172a;">Authorized by (Emp code and sign)</td>
              </tr>
              <tr>
                <td style="padding:2px 6px;border:1px solid #0f172a;">DD / UTR No</td>
                <td style="padding:2px 6px;border:1px solid #0f172a;">Ref No</td>
              </tr>
              <tr>
                <td style="padding:2px 6px;border:1px solid #0f172a;">Charges Recovered Rs (applicable only for Non Customer):</td>
                <td style="padding:2px 6px;border:1px solid #0f172a;">Day end Checked by</td>
              </tr>
              <tr>
                <td style="padding:2px 6px;border:1px solid #0f172a;">Transaction Authorized by (2<sup>nd</sup> Level) (for amount &gt; 5 lacs).</td>
                <td style="padding:2px 6px;border:1px solid #0f172a;"></td>
              </tr>
              <tr>
                <td style="padding:2px 6px;border:1px solid #0f172a;">KYC documentation done by (only for Non-HDFC Bank Customers)</td>
                <td style="padding:2px 6px;border:1px solid #0f172a;"></td>
              </tr>
              <tr>
                <td style="padding:2px 6px;border:1px solid #0f172a;">
                  <div style="display:flex;align-items:center;gap:14px;">
                    <span>BANV Status</span>
                    <span style="display:inline-flex;align-items:center;gap:4px;">${renderCheckbox(false, 10)}Success</span>
                    <span style="display:inline-flex;align-items:center;gap:4px;">${renderCheckbox(false, 10)}Failed</span>
                  </div>
                </td>
                <td style="padding:2px 6px;border:1px solid #0f172a;"></td>
              </tr>
              <tr>
                <td colspan="2" style="padding:2px 6px;border:1px solid #0f172a;">Remark for BANV:</td>
              </tr>
            </tbody>
          </table>
          <div class="slip-lbl" style="position:absolute;right:0;top:12px;writing-mode:vertical-rl;transform:rotate(180deg);font-size:8.5px;color:#334155;">92929/13.03.2026_M019</div>
        </div>

        <!-- Clauses (1)-(9) -->
        <div class="slip-lbl" style="font-size:8.1px;line-height:1.22;text-align:justify;">
          <strong>RTGS / NEFT Terms and conditions:</strong> (1) I / We hereby authorize HDFC Bank Ltd. to carry out the RTGS/NEFT transaction as per details mentioned above (Tick the appropriate field). (2) I / We hereby agree that the aforesaid details including the IFSC code and the beneficiary account are correct. (3) I / We further acknowledge that HDFC Bank accepts no liability for any consequences arising out of erroneous details provided by me/us. (4) I / We authorize the bank to debit my / our account with the charges plus taxes as applicable for this transaction. (5) I / We agree that requests submitted after the cut off time will be sent in next batch or next working day as applicable. (6) I / we agree that the credit will be affected to the beneficiary account number as per the details mentioned above and subject to the applicable RBI guidelines (7) I / We also understand that the remitting Bank shall not be liable for any loss of damage arising or resulting from delay in transmission delivery or non-delivery of Electronic message or any mistake, omission, or error in transmission or delivery thereof or in deciphering the message from any cause whatsoever or from its misinterpretation received or the action of the destination Bank or any act or even beyond control. (8) I/We agree that incase of NEFT Transaction if we do not have an account with the bank, we will produce Original identification proof while giving the request. In case I/We submit form 60, we will also submit the address proof. (9) In case the RTGS and NEFT option is not ticked by us, I / We authorize you to execute the transaction <strong>less than Rupees Two Lacs through NEFT and greater than or equal to Rupees Two Lacs through RTGS</strong> and debit the charges as applicable.
        </div>
      </div>

      <!-- Bottom Perforated Customers Copy -->
      <div class="slip-grid" style="border-top:1.5px dashed #334155;padding-top:7px;display:flex;justify-content:space-between;align-items:flex-start;">
        <div style="font-size:9.8px;line-height:1.4;flex:1;padding-right:16px;">
          <div class="slip-lbl" style="font-weight:800;font-size:10.5px;">Customers Copy</div>
          <div>
            <span class="slip-lbl">Received application for RTGS / NEFT for an amount of Rs.</span>
            <span class="slip-grid" style="display:inline-block;min-width:110px;border-bottom:1px solid #0f172a;padding:0 4px;"><span class="slip-val" style="font-family:'JetBrains Mono',monospace;font-weight:700;">${amt > 0 ? fmtIn(amt) : ''}</span></span>
            <span class="slip-lbl"> vide Cash / Cheque number </span>
            <span class="slip-grid" style="display:inline-block;min-width:95px;border-bottom:1px solid #0f172a;padding:0 4px;"><span class="slip-val" style="font-family:'JetBrains Mono',monospace;font-weight:700;">${esc(state.rtgsChequeNo)}</span></span>
          </div>
          <div>
            <span class="slip-lbl">to be credited to Account number </span>
            <span class="slip-grid" style="display:inline-block;min-width:170px;border-bottom:1px solid #0f172a;padding:0 4px;"><span class="slip-val" style="font-family:'JetBrains Mono',monospace;font-weight:700;">${esc(state.rtgsBenAccount)}</span></span>
            <span class="slip-lbl"> of </span>
            <span class="slip-grid" style="display:inline-block;min-width:165px;border-bottom:1px solid #0f172a;padding:0 4px;"><span class="slip-val" style="font-weight:700;">${esc(state.rtgsBenBank || state.rtgsBenName)}</span></span>
          </div>
          <div>
            <span class="slip-lbl">Bank with IFSC Code </span>
            <span class="slip-grid" style="display:inline-block;min-width:130px;border-bottom:1px solid #0f172a;padding:0 4px;"><span class="slip-val" style="font-family:'JetBrains Mono',monospace;font-weight:700;">${esc(state.rtgsBenIfsc)}</span></span>
            <span class="slip-lbl">. Customers will be guided by the Terms and Conditions mentioned in the form.</span>
          </div>
          <div class="slip-lbl">HDFC Bank will accept no liability for any consequences arising out of erroneous details provided by the Customer.</div>
          <div class="slip-lbl" style="font-weight:800;font-size:10px;">Request for DD / RTGS and NEFT can also be placed using NetBanking</div>
        </div>

        <div class="slip-lbl" style="width:108px;display:flex;flex-direction:column;align-items:center;">
          <div style="width:50px;height:50px;border:1.25px solid #0f172a;border-radius:9999px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:11px;font-weight:700;line-height:1.1;margin-bottom:3px;">
            <span>Bank</span>
            <span>Seal</span>
          </div>
          <div style="font-size:10.5px;font-weight:800;">For HDFC Bank</div>
        </div>
      </div>
      <div class="slip-lbl" style="position:absolute;right:12px;bottom:4px;font-size:9px;font-weight:700;">PTO</div>
    </div>`;

    return {
      title: 'HDFC RTGS / NEFT Request Form (92929/13.03.2026_M019)',
      orientation: 'portrait',
      width: 910,
      height: 1316,
      fontClass: 'slip-font-sans',
      frontHtml,
      backHtml: null,
      cashTotal: 0,
      chequeTotal: 0,
      grandTotal: amt,
      requiresPanAlert: false,
      warning,
      pdfFilename: `HDFC_RTGS_NEFT_${state.accountNo || 'Draft'}.pdf`,
    };
  }
