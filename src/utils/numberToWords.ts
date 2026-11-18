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

const TENS = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety',
];

function convertBelowHundred(num: number): string {
  if (num === 0) return '';
  if (num < 20) return ONES[num];
  const ten = Math.floor(num / 10);
  const one = num % 10;
  return one > 0 ? `${TENS[ten]} ${ONES[one]}` : TENS[ten];
}

function convertBelowThousand(num: number): string {
  if (num === 0) return '';
  const hundred = Math.floor(num / 100);
  const rest = num % 100;
  const parts: string[] = [];
  if (hundred > 0) parts.push(`${ONES[hundred]} Hundred`);
  if (rest > 0) parts.push(convertBelowHundred(rest));
  return parts.join(' ');
}

export function integerToWordsIndian(amount: number): string {
  const n = Math.floor(Math.abs(amount));
  if (!Number.isFinite(n) || n === 0) return 'Zero';

  const parts: string[] = [];

  const crore = Math.floor(n / 10000000);
  const remAfterCrore = n % 10000000;
  if (crore > 0) {
    parts.push(`${crore >= 100 ? integerToWordsIndian(crore) : convertBelowHundred(crore)} Crore`);
  }

  const lakh = Math.floor(remAfterCrore / 100000);
  const remAfterLakh = remAfterCrore % 100000;
  if (lakh > 0) {
    parts.push(`${convertBelowHundred(lakh)} Lakh`);
  }

  const thousand = Math.floor(remAfterLakh / 1000);
  const remAfterThousand = remAfterLakh % 1000;
  if (thousand > 0) {
    parts.push(`${convertBelowHundred(thousand)} Thousand`);
  }

  if (remAfterThousand > 0) {
    parts.push(convertBelowThousand(remAfterThousand));
  }

  return parts.join(' ').trim();
}

export function numberToWordsIndian(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return '';
  const whole = Math.floor(amount);
  const paise = Math.round((amount - whole) * 100);

  const rupeesWords = whole > 0 ? `${integerToWordsIndian(whole)} Rupees` : '';
  const paiseWords = paise > 0 ? `${convertBelowHundred(paise)} Paise` : '';

  if (rupeesWords && paiseWords) {
    return `${rupeesWords} and ${paiseWords} Only`;
  }
  if (rupeesWords) {
    return `${rupeesWords} Only`;
  }
  if (paiseWords) {
    return `${paiseWords} Only`;
  }
  return '';
}

export function formatINR(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(safe);
}

export function formatINRPlain(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
}
