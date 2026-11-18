import { FinancialCalculatorDefinition } from '../types/tools';

function fmtRupee(n: number): string {
  if (!Number.isFinite(n)) return '₹0';
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

function calculateEmiSchedule(principal: number, annualRate: number, tenureYears: number) {
  const months = Math.max(1, Math.round(tenureYears * 12));
  const r = annualRate / 12 / 100;
  let emi = 0;
  if (r === 0) {
    emi = principal / months;
  } else {
    const pow = Math.pow(1 + r, months);
    emi = (principal * r * pow) / (pow - 1);
  }

  let balance = principal;
  let totalInterest = 0;
  const yearlyRows: (string | number)[][] = [];
  let yrPrincipal = 0;
  let yrInterest = 0;

  for (let m = 1; m <= months; m++) {
    const interest = balance * r;
    const princ = Math.min(balance, emi - interest);
    balance = Math.max(0, balance - princ);
    totalInterest += interest;
    yrPrincipal += princ;
    yrInterest += interest;

    if (m % 12 === 0 || m === months) {
      const yearNum = Math.ceil(m / 12);
      yearlyRows.push([
        `Year ${yearNum}`,
        fmtRupee(yrPrincipal),
        fmtRupee(yrInterest),
        fmtRupee(yrPrincipal + yrInterest),
        fmtRupee(balance),
      ]);
      yrPrincipal = 0;
      yrInterest = 0;
    }
  }

  const totalPayment = principal + totalInterest;
  return { emi, totalInterest, totalPayment, yearlyRows };
}

function makeEmiCalculator(config: {
  id: string;
  name: string;
  shortDesc: string;
  defaultPrincipal: number;
  maxPrincipal: number;
  stepPrincipal: number;
  defaultRate: number;
  defaultYears: number;
  maxYears: number;
  exampleText: string;
}): FinancialCalculatorDefinition {
  return {
    id: config.id,
    slug: config.id,
    name: config.name,
    categoryId: 'financial',
    shortDesc: config.shortDesc,
    inputs: [
      {
        id: 'principal',
        label: 'Loan Amount',
        type: 'number',
        defaultValue: config.defaultPrincipal,
        min: 10000,
        max: config.maxPrincipal,
        step: config.stepPrincipal,
        prefix: '₹',
      },
      {
        id: 'rate',
        label: 'Annual Interest Rate',
        type: 'number',
        defaultValue: config.defaultRate,
        min: 1,
        max: 30,
        step: 0.1,
        suffix: '% p.a.',
      },
      {
        id: 'tenure',
        label: 'Loan Tenure',
        type: 'number',
        defaultValue: config.defaultYears,
        min: 1,
        max: config.maxYears,
        step: 1,
        suffix: 'Yrs',
      },
    ],
    calculate: (inputs) => {
      const P = Math.max(0, Number(inputs.principal) || 0);
      const R = Math.max(0, Number(inputs.rate) || 0);
      const Y = Math.max(1, Number(inputs.tenure) || 1);
      const { emi, totalInterest, totalPayment, yearlyRows } = calculateEmiSchedule(P, R, Y);

      return {
        primaryLabel: 'Monthly EMI',
        primaryValue: fmtRupee(emi),
        secondaryLabel: 'Total Payable Amount',
        secondaryValue: fmtRupee(totalPayment),
        summary: `At ${R}% p.a. over ${Y} years (${Y * 12} monthly installments), total interest outgo is ${fmtRupee(totalInterest)}.`,
        breakdown: [
          { label: 'Principal Loan Amount', value: fmtRupee(P), color: '#2F3E4E' },
          { label: 'Total Interest Payable', value: fmtRupee(totalInterest), color: '#D97706' },
          { label: 'Interest Share of Total', value: totalPayment > 0 ? `${((totalInterest / totalPayment) * 100).toFixed(1)}%` : '0%' },
          { label: 'Total Payment (Principal + Interest)', value: fmtRupee(totalPayment), isTotal: true },
        ],
        chart: {
          type: 'donut',
          title: 'Principal vs Total Interest',
          segments: [
            { label: 'Principal Amount', value: P, color: '#2F3E4E' },
            { label: 'Total Interest', value: totalInterest, color: '#F9C80E' },
          ],
        },
        schedule: {
          title: 'Yearly Amortization Schedule',
          headers: ['Year', 'Principal Paid', 'Interest Paid', 'Total Paid', 'Closing Balance'],
          rows: yearlyRows,
        },
        assumptions: [
          'Interest compounds monthly on a reducing-balance schedule.',
          'Assumes fixed rate across the selected tenure; excludes processing fees.',
        ],
      };
    },
    formulaLatex: 'EMI = [P × r × (1 + r)^n] / [(1 + r)^n - 1]',
    formulaExplanation:
      'P is the principal loan amount, r is the monthly interest rate (annual rate ÷ 12 ÷ 100), and n is the total number of monthly installments (tenure in years × 12).',
    practicalExample: config.exampleText,
    faqs: [
      {
        question: 'Does prepayment reduce my total interest?',
        answer:
          'Yes. Making partial principal prepayments early in the tenure lowers the outstanding reducing balance, directly shrinking future interest components.',
      },
      {
        question: 'Is this calculated on flat or reducing balance?',
        answer:
          'All major Indian banks (SBI, HDFC, ICICI, Axis) compute retail loan EMIs on a monthly reducing-balance basis, which this calculator follows.',
      },
    ],
  };
}

export const FINANCIAL_CALCULATORS: FinancialCalculatorDefinition[] = [
  makeEmiCalculator({
    id: 'emi-calculator',
    name: 'Loan EMI Calculator',
    shortDesc: 'Compute exact monthly installments, interest outgo, and yearly amortization for any loan.',
    defaultPrincipal: 1000000,
    maxPrincipal: 20000000,
    stepPrincipal: 25000,
    defaultRate: 9.0,
    defaultYears: 5,
    maxYears: 30,
    exampleText: 'For a ₹10,00,000 loan at 9.0% p.a. over 5 years, the monthly EMI is ₹20,758 and total interest is ₹2,45,501.',
  }),
  makeEmiCalculator({
    id: 'home-loan-emi-calculator',
    name: 'Home Loan EMI Calculator',
    shortDesc: 'Plan long-tenure housing loan EMIs up to 30 years with full principal-vs-interest breakdown.',
    defaultPrincipal: 5000000,
    maxPrincipal: 50000000,
    stepPrincipal: 100000,
    defaultRate: 8.5,
    defaultYears: 20,
    maxYears: 30,
    exampleText: 'A ₹50,00,000 home loan at 8.5% for 20 years results in an EMI of ₹43,391 and total interest of ₹54,13,879.',
  }),
  makeEmiCalculator({
    id: 'car-loan-emi-calculator',
    name: 'Car Loan EMI Calculator',
    shortDesc: 'Estimate auto loan monthly payments for 1 to 7 year vehicle financing terms.',
    defaultPrincipal: 800000,
    maxPrincipal: 10000000,
    stepPrincipal: 25000,
    defaultRate: 9.2,
    defaultYears: 5,
    maxYears: 8,
    exampleText: 'An ₹8,00,000 car loan at 9.2% for 5 years has a monthly EMI of ₹16,685.',
  }),
  makeEmiCalculator({
    id: 'personal-loan-emi-calculator',
    name: 'Personal Loan EMI Calculator',
    shortDesc: 'Quickly verify unsecured personal loan EMIs and total borrowing cost.',
    defaultPrincipal: 300000,
    maxPrincipal: 5000000,
    stepPrincipal: 10000,
    defaultRate: 11.5,
    defaultYears: 3,
    maxYears: 7,
    exampleText: 'A ₹3,00,000 personal loan at 11.5% for 3 years costs ₹9,893 per month.',
  }),
  {
    id: 'sip-calculator',
    slug: 'sip-calculator',
    name: 'Mutual Fund SIP Calculator',
    categoryId: 'financial',
    shortDesc: 'Project future mutual fund corpus with monthly SIP compounding and annual step-up option.',
    inputs: [
      { id: 'monthly', label: 'Monthly SIP Amount', type: 'number', defaultValue: 10000, min: 500, max: 500000, step: 500, prefix: '₹' },
      { id: 'rate', label: 'Expected Annual Return', type: 'number', defaultValue: 12, min: 1, max: 30, step: 0.5, suffix: '% p.a.' },
      { id: 'years', label: 'Investment Horizon', type: 'number', defaultValue: 15, min: 1, max: 40, step: 1, suffix: 'Yrs' },
      { id: 'stepUp', label: 'Annual SIP Step-Up', type: 'number', defaultValue: 0, min: 0, max: 25, step: 1, suffix: '% / yr' },
    ],
    calculate: (inputs) => {
      let monthlySip = Math.max(0, Number(inputs.monthly) || 0);
      const r = (Number(inputs.rate) || 0) / 12 / 100;
      const years = Math.max(1, Number(inputs.years) || 1);
      const stepUp = Math.max(0, Number(inputs.stepUp) || 0) / 100;

      let totalInvested = 0;
      let corpus = 0;
      const rows: (string | number)[][] = [];

      for (let y = 1; y <= years; y++) {
        for (let m = 1; m <= 12; m++) {
          totalInvested += monthlySip;
          corpus = (corpus + monthlySip) * (1 + r);
        }
        rows.push([
          `Year ${y}`,
          fmtRupee(monthlySip),
          fmtRupee(totalInvested),
          fmtRupee(corpus - totalInvested),
          fmtRupee(corpus),
        ]);
        monthlySip = monthlySip * (1 + stepUp);
      }
      const wealthGain = Math.max(0, corpus - totalInvested);

      return {
        primaryLabel: 'Estimated Maturity Value',
        primaryValue: fmtRupee(corpus),
        secondaryLabel: 'Total Wealth Gained',
        secondaryValue: fmtRupee(wealthGain),
        summary: `Investing over ${years} years accumulates ${fmtRupee(corpus)} against ${fmtRupee(totalInvested)} invested.`,
        breakdown: [
          { label: 'Total Amount Invested', value: fmtRupee(totalInvested), color: '#2F3E4E' },
          { label: 'Estimated Capital Gains', value: fmtRupee(wealthGain), color: '#16A34A' },
          { label: 'Wealth Multiplier', value: totalInvested > 0 ? `${(corpus / totalInvested).toFixed(2)}×` : '0×' },
          { label: 'Projected Corpus', value: fmtRupee(corpus), isTotal: true },
        ],
        chart: {
          type: 'donut',
          title: 'Invested Capital vs Wealth Gain',
          segments: [
            { label: 'Invested Amount', value: totalInvested, color: '#2F3E4E' },
            { label: 'Estimated Returns', value: wealthGain, color: '#16A34A' },
          ],
        },
        schedule: {
          title: 'Year-by-Year SIP Growth',
          headers: ['Year', 'Monthly SIP', 'Cumulative Invested', 'Total Gain', 'Year-End Value'],
          rows,
        },
      };
    },
    formulaLatex: 'FV = P × [((1 + i)^n - 1) / i] × (1 + i)',
    formulaExplanation:
      'Monthly SIP contributions compound at monthly rate i = (annual return / 12 / 100) assuming investment at the start of each month.',
    practicalExample: 'A ₹10,000 monthly SIP at 12% p.a. for 15 years invests ₹18,00,000 and grows to approximately ₹50,45,760.',
    faqs: [
      {
        question: 'What does Annual SIP Step-Up mean?',
        answer:
          'Step-up automatically increases your monthly SIP by a fixed percentage each year (e.g., 10% annually as income grows).',
      },
    ],
  },
  {
    id: 'swp-calculator',
    slug: 'swp-calculator',
    name: 'SWP Withdrawal Calculator',
    categoryId: 'financial',
    shortDesc: 'Simulate Systematic Withdrawal Plan cashflows and remaining corpus balance over time.',
    inputs: [
      { id: 'corpus', label: 'Initial Investment Corpus', type: 'number', defaultValue: 2500000, min: 100000, max: 50000000, step: 50000, prefix: '₹' },
      { id: 'withdrawal', label: 'Monthly Withdrawal', type: 'number', defaultValue: 20000, min: 1000, max: 500000, step: 1000, prefix: '₹' },
      { id: 'rate', label: 'Expected Annual Return', type: 'number', defaultValue: 9, min: 1, max: 20, step: 0.5, suffix: '% p.a.' },
      { id: 'years', label: 'Withdrawal Period', type: 'number', defaultValue: 10, min: 1, max: 40, step: 1, suffix: 'Yrs' },
    ],
    calculate: (inputs) => {
      const initial = Math.max(0, Number(inputs.corpus) || 0);
      const monthlyW = Math.max(0, Number(inputs.withdrawal) || 0);
      const r = (Number(inputs.rate) || 0) / 12 / 100;
      const years = Math.max(1, Number(inputs.years) || 1);

      let bal = initial;
      let totalWithdrawn = 0;
      let depletedYear: number | null = null;
      const rows: (string | number)[][] = [];

      for (let y = 1; y <= years; y++) {
        let yrWithdrawn = 0;
        let yrInterest = 0;
        for (let m = 1; m <= 12; m++) {
          if (bal <= 0) break;
          const interest = bal * r;
          bal += interest;
          yrInterest += interest;
          const actualW = Math.min(bal, monthlyW);
          bal -= actualW;
          yrWithdrawn += actualW;
          totalWithdrawn += actualW;
          if (bal <= 0 && depletedYear === null) depletedYear = y;
        }
        rows.push([`Year ${y}`, fmtRupee(yrWithdrawn), fmtRupee(yrInterest), fmtRupee(bal)]);
      }

      return {
        primaryLabel: 'Final Corpus Balance',
        primaryValue: fmtRupee(bal),
        secondaryLabel: 'Total Cash Withdrawn',
        secondaryValue: fmtRupee(totalWithdrawn),
        summary: depletedYear
          ? `Corpus depletes in Year ${depletedYear} at ${fmtRupee(monthlyW)}/month.`
          : `You withdraw ${fmtRupee(totalWithdrawn)} over ${years} years and retain ${fmtRupee(bal)}.`,
        breakdown: [
          { label: 'Initial Corpus', value: fmtRupee(initial), color: '#2F3E4E' },
          { label: 'Total Amount Withdrawn', value: fmtRupee(totalWithdrawn), color: '#D97706' },
          { label: 'Ending Balance', value: fmtRupee(bal), isTotal: true, color: '#16A34A' },
        ],
        chart: {
          type: 'donut',
          title: 'Cash Withdrawn vs Remaining Corpus',
          segments: [
            { label: 'Total Withdrawn', value: totalWithdrawn, color: '#F9C80E' },
            { label: 'Remaining Corpus', value: Math.max(0, bal), color: '#16A34A' },
          ],
        },
        schedule: {
          title: 'Yearly SWP Cashflow',
          headers: ['Year', 'Annual Withdrawal', 'Interest Earned', 'Closing Corpus'],
          rows,
        },
      };
    },
    formulaLatex: 'Balance_m = Balance_{m-1} × (1 + r/12) - Monthly Withdrawal',
    formulaExplanation: 'Each month your remaining mutual fund corpus earns market returns before deducting the monthly withdrawal.',
    practicalExample: 'A ₹25 Lakh corpus earning 9% p.a. with ₹20,000 monthly withdrawals leaves ~₹21.2 Lakh after 10 years.',
    faqs: [
      {
        question: 'When is SWP better than an FD?',
        answer: 'SWP only taxes the capital gains portion of each redeemed unit rather than taxing the full interest payout every year.',
      },
    ],
  },
  {
    id: 'ppf-calculator',
    slug: 'ppf-calculator',
    name: 'PPF Calculator (15-Year Tax-Free)',
    categoryId: 'financial',
    shortDesc: 'Calculate Public Provident Fund maturity amount and annual EEE tax-free compounding.',
    inputs: [
      { id: 'yearly', label: 'Yearly PPF Deposit', type: 'number', defaultValue: 150000, min: 500, max: 150000, step: 500, prefix: '₹' },
      { id: 'rate', label: 'PPF Interest Rate', type: 'number', defaultValue: 7.1, min: 5, max: 10, step: 0.1, suffix: '% p.a.' },
      { id: 'years', label: 'Investment Tenure', type: 'number', defaultValue: 15, min: 15, max: 35, step: 5, suffix: 'Yrs' },
    ],
    calculate: (inputs) => {
      const rawYearly = Math.max(0, Number(inputs.yearly) || 0);
      const annual = rawYearly > 0 ? Math.min(150000, Math.max(500, rawYearly)) : 0;
      const rate = (Number(inputs.rate) || 0) / 100;
      const years = Math.max(1, Number(inputs.years) || 15);
      let bal = 0;
      let invested = 0;
      const rows: (string | number)[][] = [];

      for (let y = 1; y <= years; y++) {
        invested += annual;
        const interest = (bal + annual) * rate;
        bal = bal + annual + interest;
        rows.push([`Year ${y}`, fmtRupee(annual), fmtRupee(interest), fmtRupee(bal)]);
      }
      const totalInterest = bal - invested;

      return {
        primaryLabel: 'PPF Maturity Value',
        primaryValue: fmtRupee(bal),
        secondaryLabel: 'Tax-Free Interest Earned',
        secondaryValue: fmtRupee(totalInterest),
        breakdown: [
          { label: 'Total Deposit', value: fmtRupee(invested), color: '#2F3E4E' },
          { label: 'Total Interest (EEE Tax-Free)', value: fmtRupee(totalInterest), color: '#16A34A' },
          { label: 'Maturity Corpus', value: fmtRupee(bal), isTotal: true },
        ],
        chart: {
          type: 'donut',
          segments: [
            { label: 'Principal Deposited', value: invested, color: '#2F3E4E' },
            { label: 'Tax-Free Interest', value: totalInterest, color: '#16A34A' },
          ],
        },
        schedule: {
          title: 'Yearly PPF Balance Sheet',
          headers: ['Year', 'Deposit', 'Interest', 'Closing Balance'],
          rows,
        },
      };
    },
    formulaLatex: 'F = P × [((1 + i)^n - 1) / i] × (1 + i)',
    formulaExplanation: 'Assumes deposits are made before the 5th of April each financial year so full-year interest accrues.',
    practicalExample: 'Depositing ₹1,50,000 annually for 15 years at 7.1% yields ₹40,68,209 completely tax-free.',
    faqs: [{ question: 'What is the maximum annual PPF deposit?', answer: '₹1,50,000 per financial year under Section 80C.' }],
  },
  {
    id: 'fd-calculator',
    slug: 'fd-calculator',
    name: 'Fixed Deposit (FD) Calculator',
    categoryId: 'financial',
    shortDesc: 'Calculate quarterly-compounded bank FD maturity value and interest yield.',
    inputs: [
      { id: 'principal', label: 'Deposit Amount', type: 'number', defaultValue: 500000, min: 5000, max: 50000000, step: 5000, prefix: '₹' },
      { id: 'rate', label: 'FD Interest Rate', type: 'number', defaultValue: 7.25, min: 2, max: 15, step: 0.05, suffix: '% p.a.' },
      { id: 'years', label: 'Tenure (Years)', type: 'number', defaultValue: 5, min: 1, max: 15, step: 1, suffix: 'Yrs' },
      {
        id: 'freq',
        label: 'Compounding Frequency',
        type: 'select',
        defaultValue: '4',
        options: [
          { label: 'Quarterly (Standard Bank FD)', value: '4' },
          { label: 'Monthly', value: '12' },
          { label: 'Half-Yearly', value: '2' },
          { label: 'Yearly', value: '1' },
        ],
      },
    ],
    calculate: (inputs) => {
      const P = Math.max(0, Number(inputs.principal) || 0);
      const R = Math.max(0, Number(inputs.rate) || 0) / 100;
      const T = Math.max(1, Number(inputs.years) || 1);
      const n = Number(inputs.freq) || 4;
      const maturity = P > 0 ? P * Math.pow(1 + R / n, n * T) : 0;
      const interest = maturity - P;

      const rows: (string | number)[][] = [];
      for (let y = 1; y <= T; y++) {
        const val = P * Math.pow(1 + R / n, n * y);
        rows.push([`Year ${y}`, fmtRupee(val - P), fmtRupee(val)]);
      }

      return {
        primaryLabel: 'Maturity Amount',
        primaryValue: fmtRupee(maturity),
        secondaryLabel: 'Total Interest Earned',
        secondaryValue: fmtRupee(interest),
        breakdown: [
          { label: 'Principal Deposited', value: fmtRupee(P), color: '#2F3E4E' },
          { label: 'Compound Interest', value: fmtRupee(interest), color: '#16A34A' },
          { label: 'Effective Annual Yield', value: `${((Math.pow(1 + R / n, n) - 1) * 100).toFixed(2)}%` },
          { label: 'Maturity Value', value: fmtRupee(maturity), isTotal: true },
        ],
        chart: {
          type: 'donut',
          segments: [
            { label: 'Principal', value: P, color: '#2F3E4E' },
            { label: 'Interest', value: interest, color: '#F9C80E' },
          ],
        },
        schedule: {
          title: 'Year-End FD Value',
          headers: ['Year', 'Cumulative Interest', 'Balance'],
          rows,
        },
      };
    },
    formulaLatex: 'A = P × (1 + r/n)^(n × t)',
    formulaExplanation: 'Indian commercial banks compound term deposits quarterly (n = 4).',
    practicalExample: '₹5,00,000 invested at 7.25% p.a. compounded quarterly for 5 years grows to ₹7,16,133.',
    faqs: [{ question: 'Is TDS applicable on FD interest?', answer: 'Yes, TDS of 10% applies if annual FD interest exceeds ₹40,000 (₹50,000 for senior citizens).' }],
  },
  {
    id: 'rd-calculator',
    slug: 'rd-calculator',
    name: 'Recurring Deposit (RD) Calculator',
    categoryId: 'financial',
    shortDesc: 'Compute quarterly-compounded bank/Post Office RD maturity value from monthly installments.',
    inputs: [
      { id: 'monthly', label: 'Monthly Deposit', type: 'number', defaultValue: 5000, min: 500, max: 500000, step: 500, prefix: '₹' },
      { id: 'rate', label: 'RD Interest Rate', type: 'number', defaultValue: 6.8, min: 2, max: 14, step: 0.1, suffix: '% p.a.' },
      { id: 'months', label: 'Tenure (Months)', type: 'number', defaultValue: 60, min: 6, max: 120, step: 6, suffix: 'Mos' },
    ],
    calculate: (inputs) => {
      const P = Math.max(0, Number(inputs.monthly) || 0);
      const r = (Number(inputs.rate) || 0) / 100;
      const months = Math.max(1, Number(inputs.months) || 12);

      let maturity = 0;
      for (let m = 0; m < months; m++) {
        const remYears = (months - m) / 12;
        maturity += P * Math.pow(1 + r / 4, 4 * remYears);
      }
      const invested = P * months;
      const interest = maturity - invested;

      return {
        primaryLabel: 'RD Maturity Value',
        primaryValue: fmtRupee(maturity),
        secondaryLabel: 'Total Interest Earned',
        secondaryValue: fmtRupee(interest),
        breakdown: [
          { label: 'Total Monthly Deposits', value: fmtRupee(invested), color: '#2F3E4E' },
          { label: 'Quarterly Compounded Interest', value: fmtRupee(interest), color: '#16A34A' },
          { label: 'Maturity Value', value: fmtRupee(maturity), isTotal: true },
        ],
        chart: {
          type: 'donut',
          segments: [
            { label: 'Invested', value: invested, color: '#2F3E4E' },
            { label: 'Interest', value: interest, color: '#16A34A' },
          ],
        },
      };
    },
    formulaLatex: 'M = Σ [P × (1 + r/4)^(4 × t_i)]',
    formulaExplanation: 'Each monthly installment earns interest compounded quarterly until the maturity month.',
    practicalExample: '₹5,000/month for 60 months at 6.8% p.a. invests ₹3,00,000 and matures at ₹3,57,384.',
    faqs: [{ question: 'Can I close an RD early?', answer: 'Most banks permit premature withdrawal with a 0.5%–1.0% interest penalty.' }],
  },
  {
    id: 'compound-interest-calculator',
    slug: 'compound-interest-calculator',
    name: 'Compound Interest Calculator',
    categoryId: 'financial',
    shortDesc: 'Calculate exponential growth with flexible annual, half-yearly, quarterly, or monthly compounding.',
    inputs: [
      { id: 'principal', label: 'Principal Amount', type: 'number', defaultValue: 100000, min: 1000, max: 10000000, step: 1000, prefix: '₹' },
      { id: 'rate', label: 'Annual Interest Rate', type: 'number', defaultValue: 10, min: 1, max: 40, step: 0.25, suffix: '% p.a.' },
      { id: 'years', label: 'Duration (Years)', type: 'number', defaultValue: 10, min: 1, max: 40, step: 1, suffix: 'Yrs' },
      {
        id: 'freq',
        label: 'Compounding Interval',
        type: 'select',
        defaultValue: '1',
        options: [
          { label: 'Annually (1×)', value: '1' },
          { label: 'Half-Yearly (2×)', value: '2' },
          { label: 'Quarterly (4×)', value: '4' },
          { label: 'Monthly (12×)', value: '12' },
        ],
      },
    ],
    calculate: (inputs) => {
      const P = Math.max(0, Number(inputs.principal) || 0);
      const r = (Number(inputs.rate) || 0) / 100;
      const t = Math.max(1, Number(inputs.years) || 1);
      const n = Number(inputs.freq) || 1;

      const amount = P * Math.pow(1 + r / n, n * t);
      const ci = amount - P;
      const rows: (string | number)[][] = [];
      for (let y = 1; y <= t; y++) {
        const yAmt = P * Math.pow(1 + r / n, n * y);
        rows.push([`Year ${y}`, fmtRupee(yAmt - P), fmtRupee(yAmt)]);
      }

      return {
        primaryLabel: 'Total Maturity Amount',
        primaryValue: fmtRupee(amount),
        secondaryLabel: 'Compound Interest',
        secondaryValue: fmtRupee(ci),
        breakdown: [
          { label: 'Principal', value: fmtRupee(P), color: '#2F3E4E' },
          { label: 'Compound Interest', value: fmtRupee(ci), color: '#16A34A' },
          { label: 'Final Amount', value: fmtRupee(amount), isTotal: true },
        ],
        chart: {
          type: 'donut',
          segments: [
            { label: 'Principal', value: P, color: '#2F3E4E' },
            { label: 'Interest', value: ci, color: '#16A34A' },
          ],
        },
        schedule: {
          title: 'Yearly Compounding Table',
          headers: ['Year', 'Interest Accrued', 'Closing Balance'],
          rows,
        },
      };
    },
    formulaLatex: 'A = P × (1 + r/n)^(n × t)',
    formulaExplanation: 'Compounding calculates interest on both principal and previously accumulated interest.',
    practicalExample: '₹1,00,000 at 10% compounded annually for 10 years grows to ₹2,59,374.',
    faqs: [{ question: 'How does compounding frequency affect returns?', answer: 'Higher compounding frequency (monthly vs annual) yields slightly higher effective annual return.' }],
  },
  {
    id: 'simple-interest-calculator',
    slug: 'simple-interest-calculator',
    name: 'Simple Interest Calculator',
    categoryId: 'financial',
    shortDesc: 'Compute flat linear interest on principal across years without compounding.',
    inputs: [
      { id: 'principal', label: 'Principal Sum', type: 'number', defaultValue: 100000, min: 1000, max: 10000000, step: 1000, prefix: '₹' },
      { id: 'rate', label: 'Rate of Interest', type: 'number', defaultValue: 8, min: 0.5, max: 40, step: 0.25, suffix: '% p.a.' },
      { id: 'years', label: 'Time Period', type: 'number', defaultValue: 5, min: 1, max: 40, step: 1, suffix: 'Yrs' },
    ],
    calculate: (inputs) => {
      const P = Math.max(0, Number(inputs.principal) || 0);
      const R = Math.max(0, Number(inputs.rate) || 0);
      const T = Math.max(1, Number(inputs.years) || 1);
      const SI = (P * R * T) / 100;
      const total = P + SI;

      return {
        primaryLabel: 'Total Payable / Maturity',
        primaryValue: fmtRupee(total),
        secondaryLabel: 'Simple Interest',
        secondaryValue: fmtRupee(SI),
        breakdown: [
          { label: 'Principal Amount', value: fmtRupee(P), color: '#2F3E4E' },
          { label: 'Simple Interest (P×R×T/100)', value: fmtRupee(SI), color: '#D97706' },
          { label: 'Monthly Equivalent Interest', value: fmtRupee(SI / (T * 12)) },
          { label: 'Grand Total', value: fmtRupee(total), isTotal: true },
        ],
        chart: {
          type: 'donut',
          segments: [
            { label: 'Principal', value: P, color: '#2F3E4E' },
            { label: 'Simple Interest', value: SI, color: '#F9C80E' },
          ],
        },
      };
    },
    formulaLatex: 'SI = (P × R × T) / 100',
    formulaExplanation: 'Simple interest applies only to the original principal amount for each time period.',
    practicalExample: '₹1,00,000 at 8% for 5 years earns ₹40,000 simple interest for a total of ₹1,40,000.',
    faqs: [{ question: 'Where is simple interest commonly used?', answer: 'Short-term promissory notes, agricultural advances, and certain education loan moratorium periods.' }],
  },
  {
    id: 'salary-in-hand-calculator',
    slug: 'salary-in-hand-calculator',
    name: 'Salary In-Hand Calculator (India)',
    categoryId: 'financial',
    shortDesc: 'Estimate monthly take-home pay from CTC after EPF, Professional Tax, and New Regime income tax.',
    inputs: [
      { id: 'ctc', label: 'Annual CTC Package', type: 'number', defaultValue: 1200000, min: 150000, max: 20000000, step: 25000, prefix: '₹' },
      { id: 'basicPct', label: 'Basic Salary Share of CTC', type: 'number', defaultValue: 40, min: 25, max: 60, step: 5, suffix: '%' },
      { id: 'pfRate', label: 'Employee EPF Deduction', type: 'number', defaultValue: 12, min: 0, max: 12, step: 1, suffix: '% Basic' },
      { id: 'pt', label: 'Annual Professional Tax', type: 'number', defaultValue: 2400, min: 0, max: 2500, step: 200, prefix: '₹' },
    ],
    calculate: (inputs) => {
      const ctc = Math.max(0, Number(inputs.ctc) || 0);
      const basic = ctc * (Math.max(0, Number(inputs.basicPct) || 0) / 100);
      const empPf = basic * (Math.max(0, Number(inputs.pfRate) || 0) / 100);
      const employerPf = empPf;
      const grossSalary = Math.max(0, ctc - employerPf);
      const stdDeduction = grossSalary > 0 ? Math.min(grossSalary, 75000) : 0;
      const taxable = Math.max(0, grossSalary - stdDeduction);

      // FY 2025-26 New Tax Regime Slabs with 87A rebate up to ₹12L taxable
      let slabTax = 0;
      if (taxable > 1200000) {
        const slabs: [number, number][] = [
          [400000, 0],
          [800000, 0.05],
          [1200000, 0.1],
          [1600000, 0.15],
          [2000000, 0.2],
          [2400000, 0.25],
          [Infinity, 0.3],
        ];
        let prev = 0;
        for (const [limit, rate] of slabs) {
          if (taxable > prev) {
            slabTax += (Math.min(taxable, limit) - prev) * rate;
            prev = limit;
          }
        }
      }
      const totalTax = slabTax * 1.04; // 4% Health & Education Cess
      const pt = Math.max(0, Number(inputs.pt) || 0);
      const annualInHand = Math.max(0, grossSalary - empPf - totalTax - pt);
      const monthlyInHand = annualInHand / 12;

      return {
        primaryLabel: 'Estimated Monthly In-Hand',
        primaryValue: fmtRupee(monthlyInHand),
        secondaryLabel: 'Annual Net Take-Home',
        secondaryValue: fmtRupee(annualInHand),
        summary: `New Tax Regime FY 2025–26 estimate including ₹75,000 standard deduction and 4% cess.`,
        breakdown: [
          { label: 'Annual Gross (CTC − Employer PF)', value: fmtRupee(grossSalary), color: '#2F3E4E' },
          { label: 'Employee EPF Deduction', value: `− ${fmtRupee(empPf)}`, color: '#D97706' },
          { label: 'Income Tax + 4% Cess', value: `− ${fmtRupee(totalTax)}`, color: '#DC2626' },
          { label: 'Professional Tax', value: `− ${fmtRupee(pt)}` },
          { label: 'Monthly Take-Home Salary', value: fmtRupee(monthlyInHand), isTotal: true, color: '#16A34A' },
        ],
        chart: {
          type: 'donut',
          segments: [
            { label: 'Net In-Hand', value: annualInHand, color: '#16A34A' },
            { label: 'Employee EPF', value: empPf, color: '#2F3E4E' },
            { label: 'Income Tax & Cess', value: totalTax, color: '#F9C80E' },
          ],
        },
      };
    },
    formulaLatex: 'Monthly In-Hand = (Gross − Employee PF − Income Tax − PT) ÷ 12',
    formulaExplanation: 'Applies FY 2025–26 New Regime slabs (zero tax up to ₹12 Lakh taxable income under Sec 87A) with ₹75,000 standard deduction.',
    practicalExample: 'On a ₹12,00,000 CTC with 40% Basic and 12% EPF, take-home is ~₹90,000/month with zero income tax.',
    faqs: [{ question: 'Is Employer PF deducted from CTC?', answer: 'Yes, Employer EPF is part of Cost-to-Company and does not form part of monthly cash payout.' }],
  },
  {
    id: 'gratuity-calculator',
    slug: 'gratuity-calculator',
    name: 'Gratuity Calculator',
    categoryId: 'financial',
    shortDesc: 'Compute statutory severance gratuity under the Payment of Gratuity Act, 1972.',
    inputs: [
      { id: 'salary', label: 'Last Drawn Basic + DA (Monthly)', type: 'number', defaultValue: 60000, min: 5000, max: 1000000, step: 1000, prefix: '₹' },
      { id: 'years', label: 'Completed Years of Service', type: 'number', defaultValue: 7, min: 1, max: 45, step: 1, suffix: 'Yrs' },
    ],
    calculate: (inputs) => {
      const salary = Math.max(0, Number(inputs.salary) || 0);
      const years = Math.max(0, Number(inputs.years) || 0);
      const gratuity = (15 * salary * years) / 26;
      const eligible = years >= 5;

      return {
        primaryLabel: 'Estimated Gratuity Payable',
        primaryValue: fmtRupee(gratuity),
        secondaryLabel: 'Statutory Eligibility',
        secondaryValue: eligible ? 'Eligible (≥ 5 Yrs)' : 'Below 5 Yrs',
        summary: eligible
          ? 'Eligible for statutory tax exemption up to ₹20,00,000 under Section 10(10).'
          : 'Requires 5 years of continuous service (4 yrs 240 days rounded up) unless death/disability.',
        breakdown: [
          { label: 'Last Drawn Basic + DA', value: fmtRupee(salary) },
          { label: 'Completed Years', value: `${years} Years` },
          { label: 'Formula Applied', value: '(15 × Salary × Years) ÷ 26' },
          { label: 'Total Gratuity Amount', value: fmtRupee(gratuity), isTotal: true, color: '#16A34A' },
        ],
      };
    },
    formulaLatex: 'Gratuity = (15 × Last Drawn Basic+DA × Years) ÷ 26',
    formulaExplanation: '26 represents working days in a month, and 15 days of wages are paid per completed year of service.',
    practicalExample: 'With Basic+DA of ₹60,000 after 7 years of service: (15 × 60,000 × 7) / 26 = ₹2,42,308.',
    faqs: [{ question: 'Are 6+ extra months rounded up?', answer: 'Yes, service exceeding 6 months in the last year is rounded up to the next full year.' }],
  },
  {
    id: 'pension-calculator',
    slug: 'pension-calculator',
    name: 'NPS & Monthly Pension Calculator',
    categoryId: 'financial',
    shortDesc: 'Project retirement wealth and monthly pension annuity from National Pension System contributions.',
    inputs: [
      { id: 'monthly', label: 'Monthly NPS Contribution', type: 'number', defaultValue: 8000, min: 500, max: 200000, step: 500, prefix: '₹' },
      { id: 'curAge', label: 'Current Age', type: 'number', defaultValue: 30, min: 18, max: 58, step: 1, suffix: 'Yrs' },
      { id: 'retAge', label: 'Retirement Age', type: 'number', defaultValue: 60, min: 45, max: 70, step: 1, suffix: 'Yrs' },
      { id: 'rate', label: 'Expected NPS Return', type: 'number', defaultValue: 10, min: 5, max: 16, step: 0.5, suffix: '% p.a.' },
      { id: 'annuityPct', label: 'Corpus Allocated to Annuity', type: 'number', defaultValue: 40, min: 40, max: 100, step: 5, suffix: '%' },
    ],
    calculate: (inputs) => {
      const P = Math.max(0, Number(inputs.monthly) || 0);
      const curA = Math.max(18, Number(inputs.curAge) || 30);
      const retA = Math.max(curA + 1, Number(inputs.retAge) || 60);
      const years = Math.max(1, retA - curA);
      const r = Math.max(0, Number(inputs.rate) || 0) / 12 / 100;
      const n = years * 12;
      const corpus = P === 0 ? 0 : r === 0 ? P * n : P * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
      const invested = P * n;
      const annuityShare = Math.min(1, Math.max(0, Number(inputs.annuityPct) || 40) / 100);
      const annuityCorpus = corpus * annuityShare;
      const lumpSum = corpus - annuityCorpus;
      const monthlyPension = (annuityCorpus * 0.065) / 12;

      return {
        primaryLabel: 'Estimated Monthly Pension',
        primaryValue: fmtRupee(monthlyPension),
        secondaryLabel: 'Lump Sum Tax-Free Withdrawal',
        secondaryValue: fmtRupee(lumpSum),
        summary: `Assumes 6.5% p.a. annuity yield on ${Math.round(annuityShare * 100)}% of your ${fmtRupee(corpus)} retirement corpus.`,
        breakdown: [
          { label: 'Total Contribution', value: fmtRupee(invested), color: '#2F3E4E' },
          { label: 'Total Corpus at Retirement', value: fmtRupee(corpus), color: '#16A34A' },
          { label: `Lump Sum (${100 - Math.round(annuityShare * 100)}%)`, value: fmtRupee(lumpSum) },
          { label: `Annuity Allocation (${Math.round(annuityShare * 100)}%)`, value: fmtRupee(annuityCorpus) },
          { label: 'Monthly Pension (@ 6.5%)', value: fmtRupee(monthlyPension), isTotal: true },
        ],
        chart: {
          type: 'donut',
          segments: [
            { label: 'Tax-Free Lump Sum', value: lumpSum, color: '#16A34A' },
            { label: 'Annuity Purchase', value: annuityCorpus, color: '#2F3E4E' },
          ],
        },
      };
    },
    formulaLatex: 'Monthly Pension = (Corpus × Annuity% × Annuity Rate) ÷ 12',
    formulaExplanation: 'Per PFRDA NPS exit rules, at least 40% of the corpus must purchase an annuity plan while up to 60% can be withdrawn tax-free.',
    practicalExample: 'Contributing ₹8,000/month from age 30 to 60 at 10% builds ~₹1.82 Cr corpus and ~₹39,400/month pension.',
    faqs: [{ question: 'Can I allocate more than 40% to annuity?', answer: 'Yes, allocating a higher percentage increases guaranteed monthly pension payouts.' }],
  },
  {
    id: 'retirement-pension-calculator',
    slug: 'retirement-pension-calculator',
    name: 'Retirement Corpus & Planner',
    categoryId: 'financial',
    shortDesc: 'Compute inflation-adjusted retirement corpus target needed to sustain monthly expenses.',
    inputs: [
      { id: 'curAge', label: 'Current Age', type: 'number', defaultValue: 32, min: 18, max: 60, step: 1, suffix: 'Yrs' },
      { id: 'retAge', label: 'Target Retirement Age', type: 'number', defaultValue: 60, min: 40, max: 70, step: 1, suffix: 'Yrs' },
      { id: 'monthlyExp', label: 'Current Monthly Expense', type: 'number', defaultValue: 50000, min: 10000, max: 1000000, step: 5000, prefix: '₹' },
      { id: 'inflation', label: 'Annual Inflation', type: 'number', defaultValue: 6, min: 2, max: 12, step: 0.5, suffix: '% p.a.' },
      { id: 'returnRate', label: 'Pre-Retirement Return', type: 'number', defaultValue: 11, min: 5, max: 18, step: 0.5, suffix: '% p.a.' },
    ],
    calculate: (inputs) => {
      const curA = Math.max(18, Number(inputs.curAge) || 32);
      const retA = Math.max(curA + 1, Number(inputs.retAge) || 60);
      const yearsToRet = Math.max(1, retA - curA);
      const monthlyExp = Math.max(0, Number(inputs.monthlyExp) || 0);
      const inf = Math.max(0, Number(inputs.inflation) || 0) / 100;
      const preRet = Math.max(0, Number(inputs.returnRate) || 0) / 12 / 100;

      const futureMonthlyExp = monthlyExp * Math.pow(1 + inf, yearsToRet);
      // 25x annual expense rule for 25–30 year retirement horizon
      const targetCorpus = futureMonthlyExp * 12 * 25;
      const months = yearsToRet * 12;
      const requiredSip =
        targetCorpus === 0
          ? 0
          : preRet === 0
          ? targetCorpus / months
          : targetCorpus / (((Math.pow(1 + preRet, months) - 1) / preRet) * (1 + preRet));

      return {
        primaryLabel: 'Target Retirement Corpus',
        primaryValue: fmtRupee(targetCorpus),
        secondaryLabel: 'Required Monthly SIP',
        secondaryValue: fmtRupee(requiredSip),
        summary: `At ${(inf * 100).toFixed(1)}% inflation, today's ${fmtRupee(monthlyExp)}/month will equal ${fmtRupee(futureMonthlyExp)}/month at retirement.`,
        breakdown: [
          { label: 'Years to Retirement', value: `${yearsToRet} Years` },
          { label: 'Future Monthly Expense at Retirement', value: fmtRupee(futureMonthlyExp), color: '#D97706' },
          { label: 'Required Target Corpus (25× Annual)', value: fmtRupee(targetCorpus), isTotal: true, color: '#2F3E4E' },
          { label: 'Monthly SIP Needed Today', value: fmtRupee(requiredSip), color: '#16A34A' },
        ],
      };
    },
    formulaLatex: 'Future Expense = Present Expense × (1 + inflation)^years',
    formulaExplanation: 'Projects your monthly lifestyle cost at retirement and applies a 25× annual corpus rule (4% safe withdrawal benchmark).',
    practicalExample: '₹50,000 monthly expense today grows to ₹2.55 Lakh/month in 28 years at 6% inflation.',
    faqs: [{ question: 'Why adjust expenses for inflation?', answer: 'Purchasing power halves roughly every 12 years at 6% inflation, making unadjusted targets severely short.' }],
  },
];

export function getFinancialCalculatorById(id: string): FinancialCalculatorDefinition {
  return FINANCIAL_CALCULATORS.find((c) => c.id === id) || FINANCIAL_CALCULATORS[0];
}
