export type RecoPeriodMode = 'all' | 'fy' | 'quarter' | 'half' | 'month' | 'custom';
export type RecoQuarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';
export type RecoHalf = 'H1' | 'H2';

export interface RecoPeriodFilter {
  mode: RecoPeriodMode;
  fy: string; // Indian FY format e.g. '2025-26' (Apr 2025 - Mar 2026)
  quarter: RecoQuarter;
  half: RecoHalf;
  month: string; // 'YYYY-MM'
  from: string; // 'YYYY-MM-DD'
  to: string; // 'YYYY-MM-DD'
  includeUndated: boolean;
}

const MONTH_NAMES_MAP: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const MONTH_SHORT = [
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

export function makeDateKey(year: number, month1To12: number, day1To31: number): number | null {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month1To12) ||
    !Number.isInteger(day1To31) ||
    year < 1900 ||
    year > 2199 ||
    month1To12 < 1 ||
    month1To12 > 12 ||
    day1To31 < 1 ||
    day1To31 > 31
  ) {
    return null;
  }
  return year * 10000 + month1To12 * 100 + day1To31;
}

export function localDateToKey(d: Date | null | undefined): number | null {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
  return makeDateKey(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export function utcDateToKey(d: Date | null | undefined): number | null {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
  return makeDateKey(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function utcMsToKey(ms: number | null | undefined): number | null {
  if (ms == null || !Number.isFinite(ms)) return null;
  return utcDateToKey(new Date(ms));
}

export function excelSerialToKey(serial: number | null | undefined): number | null {
  if (serial == null || !Number.isFinite(serial) || serial < 1) return null;
  const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 864e5);
  return utcDateToKey(d);
}

export function isoToDateKey(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const m = String(iso).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return makeDateKey(Number(m[1]), Number(m[2]), Number(m[3]));
}

export function parseTextDateToKey(val: unknown): number | null {
  if (val == null || val === '') return null;
  if (val instanceof Date) return localDateToKey(val);
  if (typeof val === 'number') {
    if (val > 20000 && val < 80000) return excelSerialToKey(val);
    return null;
  }

  const s = String(val).trim();
  if (!s) return null;

  // YYYY-MM-DD or YYYY/MM/DD
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\b|T)/);
  if (m) return makeDateKey(Number(m[1]), Number(m[2]), Number(m[3]));

  // DD-MMM-YYYY / DD MMM YY
  m = s.match(/^(\d{1,2})[-/. ]([A-Za-z]{3})[a-z]*[-/. ,]*(\d{2,4})$/);
  if (m) {
    const mon = MONTH_NAMES_MAP[m[2].toLowerCase()];
    if (mon) {
      let y = Number(m[3]);
      if (y < 100) y += y >= 70 ? 1900 : 2000;
      return makeDateKey(y, mon, Number(m[1]));
    }
  }

  // DD-MM-YYYY or DD/MM/YYYY
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (m) {
    let y = Number(m[3]);
    if (y < 100) y += y >= 70 ? 1900 : 2000;
    return makeDateKey(y, Number(m[2]), Number(m[1]));
  }

  return null;
}

export function dateKeyToIso(key: number | null | undefined): string {
  if (key == null || !Number.isFinite(key)) return '';
  const y = Math.floor(key / 10000);
  const m = Math.floor((key % 10000) / 100);
  const d = key % 100;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function dateKeyToDisplay(key: number | null | undefined): string {
  if (key == null || !Number.isFinite(key)) return '';
  const y = Math.floor(key / 10000);
  const m = Math.floor((key % 10000) / 100);
  const d = key % 100;
  return `${String(d).padStart(2, '0')}-${String(m).padStart(2, '0')}-${String(y).padStart(4, '0')}`;
}

export function getIndianFyStartYear(year: number, month1To12: number): number {
  return month1To12 >= 4 ? year : year - 1;
}

export function formatFyLabel(startYear: number): string {
  const nextShort = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}-${nextShort}`;
}

export function parseFyStartYear(fy: string | null | undefined): number | null {
  if (!fy) return null;
  const m = String(fy).trim().match(/^(\d{4})\s*-\s*(\d{2}|\d{4})$/);
  if (!m) return null;
  return Number(m[1]);
}

export function getCurrentIndianFy(): string {
  const now = new Date();
  return formatFyLabel(getIndianFyStartYear(now.getFullYear(), now.getMonth() + 1));
}

export function getCurrentIndianQuarter(): RecoQuarter {
  const m = new Date().getMonth() + 1;
  if (m >= 4 && m <= 6) return 'Q1';
  if (m >= 7 && m <= 9) return 'Q2';
  if (m >= 10 && m <= 12) return 'Q3';
  return 'Q4';
}

export function getIndianFyFromKey(key: number): string {
  const y = Math.floor(key / 10000);
  const m = Math.floor((key % 10000) / 100);
  return formatFyLabel(getIndianFyStartYear(y, m));
}

export function getQuarterFromKey(key: number): RecoQuarter {
  const m = Math.floor((key % 10000) / 100);
  if (m >= 4 && m <= 6) return 'Q1';
  if (m >= 7 && m <= 9) return 'Q2';
  if (m >= 10 && m <= 12) return 'Q3';
  return 'Q4';
}

export function getMonthFromKey(key: number): string {
  const y = Math.floor(key / 10000);
  const m = Math.floor((key % 10000) / 100);
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}`;
}

export function formatMonthDisplay(ym: string): string {
  const m = String(ym).match(/^(\d{4})-(\d{2})$/);
  if (!m) return ym;
  const monIdx = Number(m[2]) - 1;
  return `${MONTH_SHORT[monIdx] || m[2]} ${m[1]}`;
}

export function createDefaultRecoPeriodFilter(): RecoPeriodFilter {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return {
    mode: 'all',
    fy: getCurrentIndianFy(),
    quarter: getCurrentIndianQuarter(),
    half: now.getMonth() + 1 >= 4 && now.getMonth() + 1 <= 9 ? 'H1' : 'H2',
    month: ym,
    from: '',
    to: '',
    includeUndated: false,
  };
}

export interface ResolvedPeriodBounds {
  startKey: number | null;
  endKey: number | null;
  label: string;
  shortLabel: string;
  rangeText: string;
  isFiltered: boolean;
}

const QUARTER_TEXT: Record<RecoQuarter, string> = {
  Q1: 'Q1 (Apr–Jun)',
  Q2: 'Q2 (Jul–Sep)',
  Q3: 'Q3 (Oct–Dec)',
  Q4: 'Q4 (Jan–Mar)',
};

const HALF_TEXT: Record<RecoHalf, string> = {
  H1: 'H1 (Apr–Sep)',
  H2: 'H2 (Oct–Mar)',
};

export function resolveRecoPeriodBounds(filter: RecoPeriodFilter): ResolvedPeriodBounds {
  if (filter.mode === 'all') {
    return {
      startKey: null,
      endKey: null,
      label: 'All dates',
      shortLabel: 'All dates',
      rangeText: 'No date restriction',
      isFiltered: false,
    };
  }

  if (filter.mode === 'fy') {
    const sy = parseFyStartYear(filter.fy) ?? getIndianFyStartYear(new Date().getFullYear(), new Date().getMonth() + 1);
    const fyName = formatFyLabel(sy);
    const startKey = makeDateKey(sy, 4, 1)!;
    const endKey = makeDateKey(sy + 1, 3, 31)!;
    return {
      startKey,
      endKey,
      label: `FY ${fyName}`,
      shortLabel: `FY_${fyName}`,
      rangeText: `${dateKeyToDisplay(startKey)} to ${dateKeyToDisplay(endKey)}`,
      isFiltered: true,
    };
  }

  if (filter.mode === 'quarter') {
    const sy = parseFyStartYear(filter.fy) ?? getIndianFyStartYear(new Date().getFullYear(), new Date().getMonth() + 1);
    const fyName = formatFyLabel(sy);
    let startKey: number;
    let endKey: number;
    if (filter.quarter === 'Q1') {
      startKey = makeDateKey(sy, 4, 1)!;
      endKey = makeDateKey(sy, 6, 30)!;
    } else if (filter.quarter === 'Q2') {
      startKey = makeDateKey(sy, 7, 1)!;
      endKey = makeDateKey(sy, 9, 30)!;
    } else if (filter.quarter === 'Q3') {
      startKey = makeDateKey(sy, 10, 1)!;
      endKey = makeDateKey(sy, 12, 31)!;
    } else {
      startKey = makeDateKey(sy + 1, 1, 1)!;
      endKey = makeDateKey(sy + 1, 3, 31)!;
    }
    return {
      startKey,
      endKey,
      label: `FY ${fyName} · ${QUARTER_TEXT[filter.quarter]}`,
      shortLabel: `FY_${fyName}_${filter.quarter}`,
      rangeText: `${dateKeyToDisplay(startKey)} to ${dateKeyToDisplay(endKey)}`,
      isFiltered: true,
    };
  }

  if (filter.mode === 'half') {
    const sy = parseFyStartYear(filter.fy) ?? getIndianFyStartYear(new Date().getFullYear(), new Date().getMonth() + 1);
    const fyName = formatFyLabel(sy);
    const startKey =
      filter.half === 'H1' ? makeDateKey(sy, 4, 1)! : makeDateKey(sy, 10, 1)!;
    const endKey =
      filter.half === 'H1' ? makeDateKey(sy, 9, 30)! : makeDateKey(sy + 1, 3, 31)!;
    return {
      startKey,
      endKey,
      label: `FY ${fyName} · ${HALF_TEXT[filter.half]}`,
      shortLabel: `FY_${fyName}_${filter.half}`,
      rangeText: `${dateKeyToDisplay(startKey)} to ${dateKeyToDisplay(endKey)}`,
      isFiltered: true,
    };
  }

  if (filter.mode === 'month') {
    const m = String(filter.month || '').match(/^(\d{4})-(\d{2})$/);
    if (m) {
      const y = Number(m[1]);
      const mon = Number(m[2]);
      const lastDay = new Date(Date.UTC(y, mon, 0)).getUTCDate();
      const startKey = makeDateKey(y, mon, 1)!;
      const endKey = makeDateKey(y, mon, lastDay)!;
      return {
        startKey,
        endKey,
        label: `Month: ${formatMonthDisplay(filter.month)}`,
        shortLabel: filter.month,
        rangeText: `${dateKeyToDisplay(startKey)} to ${dateKeyToDisplay(endKey)}`,
        isFiltered: true,
      };
    }
    return {
      startKey: null,
      endKey: null,
      label: 'Month (not selected)',
      shortLabel: 'All',
      rangeText: 'Select a month',
      isFiltered: false,
    };
  }

  // Custom date range
  let startKey = isoToDateKey(filter.from);
  let endKey = isoToDateKey(filter.to);
  if (startKey != null && endKey != null && startKey > endKey) {
    const tmp = startKey;
    startKey = endKey;
    endKey = tmp;
  }
  const hasAny = startKey != null || endKey != null;
  const fromTxt = startKey != null ? dateKeyToDisplay(startKey) : 'Start';
  const toTxt = endKey != null ? dateKeyToDisplay(endKey) : 'End';
  return {
    startKey,
    endKey,
    label: hasAny ? `Custom: ${fromTxt} to ${toTxt}` : 'Custom dates (open)',
    shortLabel: hasAny
      ? `${startKey ? dateKeyToIso(startKey) : 'start'}_to_${endKey ? dateKeyToIso(endKey) : 'end'}`
      : 'Custom',
    rangeText: hasAny ? `${fromTxt} to ${toTxt}` : 'Select From / To dates',
    isFiltered: hasAny,
  };
}

export function isDateKeyInRecoPeriod(
  key: number | null | undefined,
  filter: RecoPeriodFilter
): boolean {
  if (filter.mode === 'all') return true;
  const bounds = resolveRecoPeriodBounds(filter);
  if (!bounds.isFiltered) return true;
  if (key == null) return filter.includeUndated;
  if (bounds.startKey != null && key < bounds.startKey) return false;
  if (bounds.endKey != null && key > bounds.endKey) return false;
  return true;
}

export interface AvailablePeriodChoices {
  fys: string[];
  months: string[];
  minIso: string;
  maxIso: string;
}

export function extractPeriodChoicesFromKeys(
  keys: Array<number | null | undefined>
): AvailablePeriodChoices {
  const fySet = new Set<string>();
  const monthSet = new Set<string>();
  let minKey: number | null = null;
  let maxKey: number | null = null;

  for (const k of keys) {
    if (k == null) continue;
    fySet.add(getIndianFyFromKey(k));
    monthSet.add(getMonthFromKey(k));
    if (minKey == null || k < minKey) minKey = k;
    if (maxKey == null || k > maxKey) maxKey = k;
  }

  // Always offer current & previous Indian FY alongside detected FYs
  const curStart = getIndianFyStartYear(new Date().getFullYear(), new Date().getMonth() + 1);
  fySet.add(formatFyLabel(curStart));
  fySet.add(formatFyLabel(curStart - 1));
  fySet.add(formatFyLabel(curStart - 2));

  const fys = [...fySet].sort((a, b) => (parseFyStartYear(b) ?? 0) - (parseFyStartYear(a) ?? 0));
  const months = [...monthSet].sort();

  return {
    fys,
    months,
    minIso: minKey != null ? dateKeyToIso(minKey) : '',
    maxIso: maxKey != null ? dateKeyToIso(maxKey) : '',
  };
}
