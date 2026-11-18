export type TimingMode = 'emi' | 'calendar';
export type ImpactStrategy = 'reduce-tenure' | 'reduce-emi';
export type ScheduleGranularity = 'monthly' | 'fy' | 'calendar';

export interface RateChangeEvent {
  id: string;
  timingMode: TimingMode;
  emiNumber: number;
  calendarMonth: string; // YYYY-MM
  newRate: number;
  impactStrategy: 'global' | ImpactStrategy;
  note: string;
}

export interface PrepaymentEvent {
  id: string;
  timingMode: TimingMode;
  emiNumber: number;
  calendarMonth: string; // YYYY-MM
  amount: number;
  penaltyPct: number;
  impactStrategy: 'global' | ImpactStrategy;
  note: string;
}

export interface HomeLoanSimulationInput {
  principal: number;
  annualRate: number;
  tenureMonths: number;
  startMonth: string; // YYYY-MM
  moratoriumMonths: number;
  annualEmiStepUpPct: number;
  extraMonthlyPrincipal: number;
  extraAnnualEmiEnabled: boolean; // 1 extra EMI every 12 months
  extraAnnualEmiMonth: number; // 1-12 calendar month (e.g. 4 = April)
  globalStrategy: ImpactStrategy;
  rateChanges: RateChangeEvent[];
  prepayments: PrepaymentEvent[];
}

export interface MonthlyLoanRow {
  emiNo: number;
  calendarMonth: string; // YYYY-MM
  calendarLabel: string; // e.g. Apr 2025
  financialYear: string; // e.g. FY 2025-26
  calendarYear: number;
  loanYear: number;
  annualRate: number;
  openingBalance: number;
  emiPaid: number;
  principalPaid: number;
  interestPaid: number;
  prepaymentPaid: number;
  penaltyPaid: number;
  totalOutflow: number;
  closingBalance: number;
  events: string[];
}

export interface AggregatedLoanRow {
  periodLabel: string;
  monthsCount: number;
  avgRate: number;
  openingBalance: number;
  totalEmiPaid: number;
  principalPaid: number;
  interestPaid: number;
  prepaymentPaid: number;
  penaltyPaid: number;
  totalOutflow: number;
  closingBalance: number;
  sec24bEligibleInterest: number;
  sec80cEligiblePrincipal: number;
  eventsCount: number;
}

export interface HomeLoanSimulationResult {
  initialEmi: number;
  finalEmi: number;
  baselineTotalInterest: number;
  baselineTotalPayment: number;
  baselineMonths: number;
  baselineEndLabel: string;

  actualTotalInterest: number;
  actualTotalPrincipalPaid: number;
  actualTotalPrepayments: number;
  actualTotalPenalty: number;
  actualTotalOutflow: number;
  actualMonths: number;
  actualEndLabel: string;

  interestSaved: number;
  monthsSaved: number;
  interestToPrincipalRatio: number;

  monthlyRows: MonthlyLoanRow[];
  fyRows: AggregatedLoanRow[];
  calendarYearRows: AggregatedLoanRow[];
  loanYearRows: AggregatedLoanRow[];
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function parseYearMonth(ym: string): { year: number; month: number } {
  const m = /^(\d{4})-(\d{1,2})$/.exec((ym || '').trim());
  if (!m) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }
  const year = Math.min(2100, Math.max(1980, parseInt(m[1], 10)));
  const month = Math.min(12, Math.max(1, parseInt(m[2], 10)));
  return { year, month };
}

export function addMonthsToYearMonth(
  startYm: string,
  offsetMonths: number
): { ym: string; label: string; year: number; month: number; fy: string } {
  const base = parseYearMonth(startYm);
  const totalMonths = base.year * 12 + (base.month - 1) + offsetMonths;
  const year = Math.floor(totalMonths / 12);
  const month = (totalMonths % 12) + 1;
  const ym = `${year}-${String(month).padStart(2, '0')}`;
  const label = `${MONTH_NAMES[month - 1]} ${year}`;
  const fyStart = month >= 4 ? year : year - 1;
  const fy = `FY ${fyStart}-${String((fyStart + 1) % 100).padStart(2, '0')}`;
  return { ym, label, year, month, fy };
}

/**
 * Converts a calendar month (YYYY-MM) into 1-based EMI index relative to Loan Start Month.
 */
export function calendarMonthToEmiNumber(startYm: string, targetYm: string): number {
  const s = parseYearMonth(startYm);
  const t = parseYearMonth(targetYm);
  return (t.year - s.year) * 12 + (t.month - s.month) + 1;
}

/**
 * Converts a 1-based EMI index back to YYYY-MM calendar month.
 */
export function emiNumberToCalendarMonth(startYm: string, emiNumber: number): string {
  const safeIdx = Math.max(1, Math.round(emiNumber));
  return addMonthsToYearMonth(startYm, safeIdx - 1).ym;
}

export function computeStandardEmi(
  principal: number,
  annualRate: number,
  months: number
): number {
  const P = Math.max(0, principal);
  const n = Math.max(1, Math.round(months));
  const r = Math.max(0, annualRate) / 12 / 100;
  if (P === 0) return 0;
  if (r === 0) return P / n;
  const pow = Math.pow(1 + r, n);
  return (P * r * pow) / (pow - 1);
}

export function formatInrExact(n: number): string {
  if (!Number.isFinite(n)) return '₹0';
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

export function formatMonthsAsDuration(months: number): string {
  const abs = Math.max(0, Math.round(months));
  const yrs = Math.floor(abs / 12);
  const rem = abs % 12;
  if (yrs === 0) return `${rem} Mo${rem === 1 ? '' : 's'}`;
  if (rem === 0) return `${yrs} Yr${yrs === 1 ? '' : 's'}`;
  return `${yrs} Yr${yrs === 1 ? '' : 's'} ${rem} Mo${rem === 1 ? '' : 's'}`;
}

export function simulateHomeLoan(input: HomeLoanSimulationInput): HomeLoanSimulationResult {
  const principal = Math.max(0, input.principal || 0);
  const baseRate = Math.max(0, input.annualRate || 0);
  const totalTenure = Math.max(1, Math.min(480, Math.round(input.tenureMonths || 240)));
  const moratorium = Math.max(0, Math.min(36, Math.round(input.moratoriumMonths || 0)));

  // 1. Baseline computation (no rate changes, no prepayments, no step-up)
  const baselineEmi = computeStandardEmi(principal, baseRate, totalTenure);
  let baseBal = principal;
  let baselineTotalInterest = 0;
  let baseMonths = 0;
  while (baseBal > 0.5 && baseMonths < totalTenure + 240) {
    baseMonths++;
    const interest = baseBal * (baseRate / 12 / 100);
    const princ = Math.min(baseBal, Math.max(0, baselineEmi - interest));
    baseBal = Math.max(0, baseBal - princ);
    baselineTotalInterest += interest;
    if (baseMonths >= totalTenure && baseBal < 1) {
      baseBal = 0;
      break;
    }
  }
  const baselineTotalPayment = principal + baselineTotalInterest;
  const baselineEndLabel = addMonthsToYearMonth(
    input.startMonth,
    Math.max(0, baseMonths + moratorium - 1)
  ).label;

  // 2. Map events to exact 1-based EMI index
  const rateChangeMap = new Map<number, RateChangeEvent[]>();
  for (const rc of input.rateChanges) {
    const resolvedEmi =
      rc.timingMode === 'calendar'
        ? calendarMonthToEmiNumber(input.startMonth, rc.calendarMonth)
        : Math.round(rc.emiNumber);
    if (resolvedEmi >= 1 && resolvedEmi <= 600) {
      const list = rateChangeMap.get(resolvedEmi) || [];
      list.push(rc);
      rateChangeMap.set(resolvedEmi, list);
    }
  }

  const prepaymentMap = new Map<number, PrepaymentEvent[]>();
  for (const pp of input.prepayments) {
    if (pp.amount <= 0) continue;
    const resolvedEmi =
      pp.timingMode === 'calendar'
        ? calendarMonthToEmiNumber(input.startMonth, pp.calendarMonth)
        : Math.round(pp.emiNumber);
    if (resolvedEmi >= 1 && resolvedEmi <= 600) {
      const list = prepaymentMap.get(resolvedEmi) || [];
      list.push(pp);
      prepaymentMap.set(resolvedEmi, list);
    }
  }

  // 3. Simulate month-by-month with moratorium, rate changes, prepayments, and step-up
  let balance = principal;
  let currentRate = baseRate;
  let currentEmi = computeStandardEmi(principal, currentRate, totalTenure);
  const initialEmi = currentEmi;

  let actualTotalInterest = 0;
  let actualTotalPrincipalPaid = 0;
  let actualTotalPrepayments = 0;
  let actualTotalPenalty = 0;
  let finalEmi = currentEmi;

  const monthlyRows: MonthlyLoanRow[] = [];
  const MAX_SIM_MONTHS = 600;

  for (let m = 1; m <= MAX_SIM_MONTHS; m++) {
    if (balance <= 0.01) break;

    const cal = addMonthsToYearMonth(input.startMonth, m - 1);
    const loanYear = Math.ceil(m / 12);
    const events: string[] = [];
    const openingBalance = balance;

    // Apply rate change at start of this EMI month if scheduled
    const rcs = rateChangeMap.get(m);
    if (rcs && rcs.length > 0) {
      for (const rc of rcs) {
        const oldRate = currentRate;
        currentRate = Math.max(0, rc.newRate);
        const strategy =
          rc.impactStrategy === 'global' ? input.globalStrategy : rc.impactStrategy;
        const remainingNominalMonths = Math.max(1, totalTenure + moratorium - m + 1);
        if (strategy === 'reduce-emi') {
          currentEmi = computeStandardEmi(balance, currentRate, remainingNominalMonths);
        } else {
          // Keep EMI same unless it's no longer enough to cover monthly interest (negative amortization guard)
          const minCover = balance * (currentRate / 12 / 100) + 100;
          if (currentEmi < minCover) {
            currentEmi = computeStandardEmi(balance, currentRate, remainingNominalMonths);
            events.push(
              `Rate ${oldRate.toFixed(2)}% -> ${currentRate.toFixed(2)}% (EMI raised to cover interest${rc.note ? `: ${rc.note}` : ''})`
            );
            continue;
          }
        }
        events.push(
          `Rate ${oldRate.toFixed(2)}% -> ${currentRate.toFixed(2)}%${rc.note ? ` (${rc.note})` : ''}`
        );
      }
    }

    // Annual EMI step-up at start of Loan Year 2, 3, ...
    if (
      input.annualEmiStepUpPct > 0 &&
      m > moratorium + 1 &&
      (m - moratorium - 1) % 12 === 0
    ) {
      currentEmi = currentEmi * (1 + input.annualEmiStepUpPct / 100);
      events.push(`Annual EMI Step-Up (+${input.annualEmiStepUpPct}%)`);
    }

    const rMonthly = currentRate / 12 / 100;
    const interestForMonth = balance * rMonthly;

    let emiPaid = 0;
    let regularPrincipal = 0;

    if (m <= moratorium) {
      // Pre-EMI moratorium period: interest only, principal untouched
      emiPaid = interestForMonth;
      regularPrincipal = 0;
      events.push('Moratorium (Pre-EMI Interest Only)');
    } else {
      const scheduledDue = Math.min(balance + interestForMonth, currentEmi);
      emiPaid = scheduledDue;
      regularPrincipal = Math.max(0, scheduledDue - interestForMonth);
      finalEmi = currentEmi;
    }

    balance = Math.max(0, balance - regularPrincipal);
    actualTotalInterest += interestForMonth;
    actualTotalPrincipalPaid += regularPrincipal;

    // Prepayments & recurring extras
    let prepaymentPaid = 0;
    let penaltyPaid = 0;

    if (balance > 0 && input.extraMonthlyPrincipal > 0 && m > moratorium) {
      const extra = Math.min(balance, input.extraMonthlyPrincipal);
      balance = Math.max(0, balance - extra);
      prepaymentPaid += extra;
      actualTotalPrepayments += extra;
      actualTotalPrincipalPaid += extra;
    }

    if (
      balance > 0 &&
      input.extraAnnualEmiEnabled &&
      cal.month === input.extraAnnualEmiMonth &&
      m > moratorium
    ) {
      const bonusEmi = Math.min(balance, currentEmi);
      balance = Math.max(0, balance - bonusEmi);
      prepaymentPaid += bonusEmi;
      actualTotalPrepayments += bonusEmi;
      actualTotalPrincipalPaid += bonusEmi;
      events.push('Annual 13th EMI Prepayment');
    }

    const pps = prepaymentMap.get(m);
    if (pps && pps.length > 0 && balance > 0) {
      let lastPpStrategy: ImpactStrategy = input.globalStrategy;
      for (const pp of pps) {
        if (balance <= 0) break;
        const applied = Math.min(balance, Math.max(0, pp.amount));
        const penalty = applied * (Math.max(0, pp.penaltyPct) / 100);
        balance = Math.max(0, balance - applied);
        prepaymentPaid += applied;
        penaltyPaid += penalty;
        actualTotalPrepayments += applied;
        actualTotalPrincipalPaid += applied;
        actualTotalPenalty += penalty;
        lastPpStrategy =
          pp.impactStrategy === 'global' ? input.globalStrategy : pp.impactStrategy;
        events.push(
          `Prepayment ${formatInrExact(applied)}${pp.note ? ` (${pp.note})` : ''}`
        );
      }

      if (balance > 0 && lastPpStrategy === 'reduce-emi') {
        const remainingMonths = Math.max(1, totalTenure + moratorium - m);
        currentEmi = computeStandardEmi(balance, currentRate, remainingMonths);
      }
    }

    if (balance < 0.5) {
      balance = 0;
    }

    const totalOutflow = emiPaid + prepaymentPaid + penaltyPaid;

    monthlyRows.push({
      emiNo: m,
      calendarMonth: cal.ym,
      calendarLabel: cal.label,
      financialYear: cal.fy,
      calendarYear: cal.year,
      loanYear,
      annualRate: currentRate,
      openingBalance,
      emiPaid,
      principalPaid: regularPrincipal,
      interestPaid: interestForMonth,
      prepaymentPaid,
      penaltyPaid,
      totalOutflow,
      closingBalance: balance,
      events,
    });
  }

  const aggregateBy = (keyFn: (row: MonthlyLoanRow) => string): AggregatedLoanRow[] => {
    const groups = new Map<string, MonthlyLoanRow[]>();
    for (const row of monthlyRows) {
      const k = keyFn(row);
      const list = groups.get(k);
      if (list) list.push(row);
      else groups.set(k, [row]);
    }

    const aggregated: AggregatedLoanRow[] = [];
    for (const [label, list] of groups.entries()) {
      const principalPaid = list.reduce((s, r) => s + r.principalPaid, 0);
      const interestPaid = list.reduce((s, r) => s + r.interestPaid, 0);
      const prepaymentPaid = list.reduce((s, r) => s + r.prepaymentPaid, 0);
      const penaltyPaid = list.reduce((s, r) => s + r.penaltyPaid, 0);
      const totalEmiPaid = list.reduce((s, r) => s + r.emiPaid, 0);
      const totalOutflow = list.reduce((s, r) => s + r.totalOutflow, 0);
      const avgRate = list.reduce((s, r) => s + r.annualRate, 0) / list.length;
      const eventsCount = list.reduce((s, r) => s + r.events.length, 0);

      aggregated.push({
        periodLabel: label,
        monthsCount: list.length,
        avgRate,
        openingBalance: list[0].openingBalance,
        totalEmiPaid,
        principalPaid,
        interestPaid,
        prepaymentPaid,
        penaltyPaid,
        totalOutflow,
        closingBalance: list[list.length - 1].closingBalance,
        sec24bEligibleInterest: Math.min(200000, interestPaid),
        sec80cEligiblePrincipal: Math.min(150000, principalPaid + prepaymentPaid),
        eventsCount,
      });
    }
    return aggregated;
  };

  const actualMonths = monthlyRows.length;
  const actualEndLabel =
    actualMonths > 0 ? monthlyRows[actualMonths - 1].calendarLabel : baselineEndLabel;
  const actualTotalOutflow =
    actualTotalPrincipalPaid + actualTotalInterest + actualTotalPenalty;

  return {
    initialEmi,
    finalEmi,
    baselineTotalInterest,
    baselineTotalPayment,
    baselineMonths: baseMonths + moratorium,
    baselineEndLabel,
    actualTotalInterest,
    actualTotalPrincipalPaid,
    actualTotalPrepayments,
    actualTotalPenalty,
    actualTotalOutflow,
    actualMonths,
    actualEndLabel,
    interestSaved: Math.max(0, baselineTotalInterest - actualTotalInterest),
    monthsSaved: Math.max(0, baseMonths + moratorium - actualMonths),
    interestToPrincipalRatio: principal > 0 ? (actualTotalInterest / principal) * 100 : 0,
    monthlyRows,
    fyRows: aggregateBy((r) => r.financialYear),
    calendarYearRows: aggregateBy((r) => String(r.calendarYear)),
    loanYearRows: aggregateBy((r) => `Year ${r.loanYear}`),
  };
}
