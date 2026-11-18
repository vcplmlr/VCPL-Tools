import React, { useCallback, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCopy,
  Download,
  FileArchive,
  FileSpreadsheet,
  FileText,
  Lock,
  Printer,
  RotateCcw,
  Upload,
} from 'lucide-react';
import { ToolCatalogItem } from '../../types/tools';
import { exportElementToPdf, printTargetElement } from '../../utils/printReport';
import { ToolPasscodeGate } from './ToolPasscodeGate';

interface DbsPnlReportsViewProps {
  tool?: ToolCatalogItem;
  onBack?: () => void;
}

const DEPT: Record<string, string> = {
  '00': 'Admin / Back Office',
  '01': 'New Vehicles',
  '02': 'Used Vehicles',
  '03': 'Service',
  '04': 'Body & Paint',
  '05': 'Parts',
};

const DEPTS = [
  'New Vehicles',
  'Used Vehicles',
  'Service',
  'Body & Paint',
  'Parts',
  'Admin / Back Office',
] as const;

const GN: Record<string, string> = {
  '400': 'Vehicle sales (new cars)',
  '410': 'Discounts on cars',
  '420': 'Sales: used cars / labour / spares / accessories',
  '430': 'Other vehicle income (430)',
  '440': 'Facilitation charges, payouts & other vehicle income',
  '443': 'Service provided under agreement',
  '450': 'Service packages (BSI) revenue',
  '460': 'Insurance & finance commissions',
  '463': 'Other commissions',
  '470': 'RSA / BMW Secure commission & parts support',
  '480': 'BMW support income',
  '483': 'BMW support income (Joy)',
  '81x': 'Interest on cars (40% GST), net debit',
  '87x': 'Other income & BMW un-billed accruals',
  '88x': 'Other (88x)',
  '520': 'Direct costs (520)',
  '530': 'Freight & delivery costs',
  '533': 'Direct costs (533)',
  '540': 'Co-dealer incentives, USL interest, job work & consumables',
  '550': 'BSI / BRI package costs',
  '621': 'Sales / service incentives',
  '625': 'FOC allowed',
  '629': 'Staff welfare, maintenance & security',
  '63x': 'Salaries, wages & overtime',
  '641': 'Business promotion & events',
  '651': 'Demo fuel / refurbishment',
  '657': 'Interest on cars / spares',
  '659': 'Other dept. costs (659)',
  '671': 'Training',
  '672': 'Conveyance & travelling',
  '711': 'PF contributions',
  '712': 'Admin (712)',
  '713': 'Back-office incentives',
  '731': 'IT, internet & computer maintenance',
  '741': 'Rent',
  '743': 'Repairs, maintenance & VAS vendor',
  '744': 'Electricity & generator fuel',
  '746': 'Admin (746)',
  '753': 'Vehicle running, PDI, claims & vehicle insurance',
  '760': 'Professional & BMW system charges',
  '762': 'Admin (762)',
  '764': 'Insurance on assets',
  '766': 'Printing, postage, communication & office',
  '767': 'Bank charges',
  '768': 'Admin (768)',
  '769': 'General, ESIC, RTO, shared electricity',
  '779': 'Admin (779)',
  '782': 'Interest on directors unsecured loan',
  '786': 'Interest on car loan',
  '920': 'Purchases (cars / spares / paints) net of incentives',
  '923': 'Purchases (923)',
};

const OTHER = 'Other / unallocated';
const SERIES = ['2 Series', '3 Series', '5 Series', '7 Series', 'M Series', 'X1', 'X3', 'X5', 'X6', 'X7', 'iX1', OTHER];
const SMAP: Record<string, string> = {
  '2 series': '2 Series',
  '2 tourer series': '2 Series',
  '3 series': '3 Series',
  '5 series': '5 Series',
  '7 series': '7 Series',
  'm series': 'M Series',
  x1: 'X1',
  x3: 'X3',
  x5: 'X5',
  x6: 'X6',
  x7: 'X7',
  ix1: 'iX1',
};

const MONTHS = [
  '',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const seriesOf = (p: string) => (p ? SMAP[p.trim().toLowerCase()] || OTHER : '');

function lineOf(g: string, d: string): string | null {
  if (['400', '420', '450'].includes(g)) return 'Sales & service revenue';
  if (g === '410') return 'Discounts & allowances';
  if (['430', '440', '443', '460', '463', '470'].includes(g))
    return 'F&I, commissions & other operating income';
  if (['480', '483'].includes(g)) return 'BMW support & incentive income';
  if (g === '87x' && d.includes('Un Billed Revenue')) return 'BMW un-billed revenue accruals';
  if (['81x', '87x', '88x'].includes(g)) return 'Other income / (expense), net';
  if (['920', '923'].includes(g))
    return d.includes('Incentive')
      ? 'BMW incentives netted in purchases'
      : 'Purchases (cost of sales, as booked)';
  if (['520', '530', '533', '540', '550'].includes(g)) return 'Direct & variable selling costs';
  if (['621', '63x'].includes(g)) return 'Salaries, wages & incentives';
  if (['625', '629'].includes(g)) return 'Staff welfare, maintenance & security';
  if (g === '641') return 'Marketing & business promotion';
  if (g === '651') return 'Demo vehicle running costs';
  if (g === '657') return 'Interest on stock (cars / spares)';
  if (['659', '671', '672'].includes(g)) return 'Training, travel & conveyance';
  if (['711', '712', '713'].includes(g)) return 'Statutory contributions & back-office staff';
  if (g === '731') return 'IT & computer expenses';
  if (g === '741') return 'Rent';
  if (g === '743') return 'Repairs, maintenance & VAS vendor';
  if (g === '744') return 'Electricity & generator fuel';
  if (g === '753') return 'Vehicle running, PDI & internal claims';
  if (['760', '762'].includes(g)) return 'Professional & BMW system charges';
  if (g === '764') return 'Insurance on assets';
  if (g === '766') return 'Office, printing & communication';
  if (['767', '768'].includes(g)) return 'Bank charges';
  if (['769', '779', '746'].includes(g)) return 'General & other expenses';
  if (['782', '786'].includes(g)) return 'Interest & finance charges';
  return null;
}

type SpecItem =
  | ['hdr', string]
  | ['rev' | 'cost' | 'stock' | 'gp' | 'gc' | 'dc' | 'op' | 'np', string]
  | ['sum' | 'tot', string, string[]];

const SPEC: SpecItem[] = [
  ['hdr', 'REVENUE'],
  ['rev', 'Sales & service revenue'],
  ['rev', 'Discounts & allowances'],
  ['sum', 'Net sales', ['Sales & service revenue', 'Discounts & allowances']],
  ['rev', 'F&I, commissions & other operating income'],
  ['rev', 'BMW support & incentive income'],
  [
    'tot',
    'TOTAL OPERATING REVENUE',
    [
      'Net sales',
      'F&I, commissions & other operating income',
      'BMW support & incentive income',
    ],
  ],
  ['hdr', 'COST OF SALES'],
  ['cost', 'Purchases (cost of sales, as booked)'],
  ['cost', 'BMW incentives netted in purchases'],
  ['stock', 'Change in stock (balance-sheet stock accounts)'],
  [
    'tot',
    'TOTAL COST OF SALES',
    [
      'Purchases (cost of sales, as booked)',
      'BMW incentives netted in purchases',
      'Change in stock (balance-sheet stock accounts)',
    ],
  ],
  ['gp', 'GROSS PROFIT'],
  ['hdr', 'DIRECT & VARIABLE COSTS'],
  ['cost', 'Direct & variable selling costs'],
  ['gc', 'GROSS CONTRIBUTION'],
  ['hdr', 'DEPARTMENTAL EXPENSES'],
  ['cost', 'Salaries, wages & incentives'],
  ['cost', 'Staff welfare, maintenance & security'],
  ['cost', 'Marketing & business promotion'],
  ['cost', 'Demo vehicle running costs'],
  ['cost', 'Interest on stock (cars / spares)'],
  ['cost', 'Training, travel & conveyance'],
  [
    'tot',
    'Total departmental expenses',
    [
      'Salaries, wages & incentives',
      'Staff welfare, maintenance & security',
      'Marketing & business promotion',
      'Demo vehicle running costs',
      'Interest on stock (cars / spares)',
      'Training, travel & conveyance',
    ],
  ],
  ['dc', 'DEPARTMENTAL CONTRIBUTION'],
  ['hdr', 'ADMIN & OVERHEAD EXPENSES'],
  ['cost', 'Statutory contributions & back-office staff'],
  ['cost', 'IT & computer expenses'],
  ['cost', 'Rent'],
  ['cost', 'Repairs, maintenance & VAS vendor'],
  ['cost', 'Electricity & generator fuel'],
  ['cost', 'Vehicle running, PDI & internal claims'],
  ['cost', 'Professional & BMW system charges'],
  ['cost', 'Insurance on assets'],
  ['cost', 'Office, printing & communication'],
  ['cost', 'Bank charges'],
  ['cost', 'General & other expenses'],
  ['cost', 'Interest & finance charges'],
  [
    'tot',
    'Total admin & overheads',
    [
      'Statutory contributions & back-office staff',
      'IT & computer expenses',
      'Rent',
      'Repairs, maintenance & VAS vendor',
      'Electricity & generator fuel',
      'Vehicle running, PDI & internal claims',
      'Professional & BMW system charges',
      'Insurance on assets',
      'Office, printing & communication',
      'Bank charges',
      'General & other expenses',
      'Interest & finance charges',
    ],
  ],
  ['op', 'OPERATING PROFIT'],
  ['hdr', 'OTHER INCOME / (EXPENSE)'],
  ['rev', 'BMW un-billed revenue accruals'],
  ['rev', 'Other income / (expense), net'],
  ['tot', 'Net other income', ['BMW un-billed revenue accruals', 'Other income / (expense), net']],
  ['np', 'NET PROFIT BEFORE DEPRECIATION & TAX'],
];

interface RawDbsRow {
  code: string;
  ledger: string;
  cls: string;
  base: string;
  group: string;
  dcode: string;
  prod: string;
  op: number;
  clg: number;
}

interface PlEntry extends RawDbsRow {
  dept: string;
  line: string;
  impact: number;
  series: string;
}

interface StockEntry {
  dept: string;
  series: string;
  mov: number;
}

interface DbsDataset {
  fileName: string;
  pl: PlEntry[];
  stock: StockEntry[];
  bsMov: number;
  tbMov: number;
  unmapped: string[];
  month: string;
  year: string;
  dealer: string;
  n: number;
}

interface StmtRow {
  kind: SpecItem[0];
  label: string;
  v: number[];
}

const TABS = [
  'Summary',
  'P&L',
  'Dept P&L',
  'NV Models',
  'Revenue Analysis',
  'Expense Analysis',
  'Checks',
] as const;
type TabKey = (typeof TABS)[number];

async function collectCsvEntries(
  buf: ArrayBuffer,
  name: string,
  out: Array<{ name: string; text: string }>,
  depth: number
): Promise<void> {
  if (depth > 4) return;
  const lower = name.toLowerCase();
  if (lower.endsWith('.zip')) {
    const z = await JSZip.loadAsync(buf);
    for (const f of Object.values(z.files)) {
      if (f.dir) continue;
      const l = f.name.toLowerCase();
      if (l.endsWith('.zip')) {
        await collectCsvEntries(await f.async('arraybuffer'), f.name, out, depth + 1);
      } else if (l.endsWith('.csv') || l.endsWith('.txt')) {
        out.push({ name: f.name, text: await f.async('string') });
      }
    }
  } else {
    out.push({ name, text: new TextDecoder('utf-8').decode(buf) });
  }
}

function parseDbsText(text: string): {
  rows: RawDbsRow[];
  month: string;
  year: string;
  dealer: string;
} {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim());
  const head = lines[0].split('\t').map((s) => s.trim());
  const ix = (n: string) => head.indexOf(n);
  const need = [
    'Line Identifier',
    'Description',
    'OP Amount',
    'Clg Amount',
    'Account Class',
    'Base Account',
  ];
  for (const n of need) {
    if (ix(n) < 0) {
      throw new Error(
        `Column "${n}" not found. This does not look like a DBS data file (tab-separated with a header row).`
      );
    }
  }
  const c = {
    li: ix('Line Identifier'),
    de: ix('Description'),
    op: ix('OP Amount'),
    cl: ix('Clg Amount'),
    cls: ix('Account Class'),
    ba: ix('Base Account'),
    pr: ix('Product-Code'),
    mo: ix('Month'),
    yr: ix('Year'),
    dn: ix('Dealer No.'),
  };
  const rows: RawDbsRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const p = lines[i].split('\t');
    if (p.length < head.length - 2) continue;
    const base = (p[c.ba] || '').trim();
    rows.push({
      code: p[c.li].split('|')[0],
      ledger: p[c.de].split('|')[0].trim(),
      cls: p[c.cls].trim(),
      base,
      group: base.slice(5),
      dcode: base.slice(2, 4),
      prod: c.pr >= 0 ? (p[c.pr] || '').trim() : '',
      op: parseFloat(p[c.op]) || 0,
      clg: parseFloat(p[c.cl]) || 0,
    });
  }
  const first = (lines[1] || '').split('\t');
  return {
    rows,
    month: c.mo >= 0 ? first[c.mo] || '' : '',
    year: c.yr >= 0 ? first[c.yr] || '' : '',
    dealer: c.dn >= 0 ? first[c.dn] || '' : '',
  };
}

function buildDataset(
  parsed: ReturnType<typeof parseDbsText>,
  fileName: string
): DbsDataset {
  const pl: PlEntry[] = [];
  const stock: StockEntry[] = [];
  let bsMov = 0;
  let tbMov = 0;
  const unmapped: string[] = [];

  for (const r of parsed.rows) {
    tbMov += r.clg - r.op;
    if (r.cls === 'Income' || r.cls === 'Expenses') {
      const dept = DEPT[r.dcode] || 'Admin / Back Office';
      const line = lineOf(r.group, r.ledger);
      if (!line) {
        if (r.clg !== 0) unmapped.push(`${r.group} ${r.ledger}`);
        continue;
      }
      pl.push({
        ...r,
        dept,
        line,
        impact: -r.clg,
        series: dept === 'New Vehicles' ? seriesOf(r.prod) : '',
      });
    } else {
      bsMov += r.clg - r.op;
      const sd = (
        {
          '0100x141': 'New Vehicles',
          '0100x142': 'Used Vehicles',
          '0100x143': 'Parts',
        } as Record<string, string>
      )[r.base];
      if (sd && (r.op !== 0 || r.clg !== 0)) {
        const k = r.ledger.split('Stock-').pop()?.trim().toLowerCase() || '';
        stock.push({
          dept: sd,
          series: sd === 'New Vehicles' ? SMAP[k] || OTHER : '',
          mov: r.clg - r.op,
        });
      }
    }
  }

  return {
    fileName,
    pl,
    stock,
    bsMov,
    tbMov,
    unmapped,
    month: parsed.month,
    year: parsed.year,
    dealer: parsed.dealer,
    n: parsed.rows.length,
  };
}

const fmt = (n: number | null | undefined): string => {
  if (n == null || Number.isNaN(n)) return '';
  if (Math.abs(n) < 0.5) return '-';
  const s = Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  return n < 0 ? `(${s})` : s;
};

const pct = (a: number, b: number): string => (b ? `${((a / b) * 100).toFixed(1)}%` : '-');
const lakh = (n: number): string =>
  (n / 100000).toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const DbsPnlReportsView: React.FC<DbsPnlReportsViewProps> = ({ tool, onBack }) => {
  const [data, setData] = useState<DbsDataset | null>(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [includeStock, setIncludeStock] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('Summary');
  const [copyMsg, setCopyMsg] = useState('');
  const tableContainerRef = useRef<HTMLDivElement | null>(null);

  const period = useMemo(() => {
    if (!data) return '';
    const mNum = parseInt(data.month, 10);
    return `${MONTHS[mNum] || `Month ${data.month}`} ${data.year}`.trim();
  }, [data]);

  const handleFile = useCallback(async (file: File) => {
    setErrorMsg('');
    setStatusMsg(`Reading ${file.name}…`);
    try {
      const out: Array<{ name: string; text: string }> = [];
      await collectCsvEntries(await file.arrayBuffer(), file.name, out, 0);
      const ok = out.filter((o) => o.text.indexOf('Line Identifier') >= 0);
      if (!ok.length) {
        throw new Error(
          'No DBS data CSV found in this file. Expected a tab-separated file with a "Line Identifier" column.'
        );
      }
      const built = buildDataset(parseDbsText(ok[0].text), ok[0].name);
      if (!built.pl.length) {
        throw new Error('The file was read but has no Income or Expenses rows.');
      }
      setData(built);
      setActiveTab('Summary');
      const mNum = parseInt(built.month, 10);
      const per = `${MONTHS[mNum] || `Month ${built.month}`} ${built.year}`.trim();
      setStatusMsg(
        `Loaded ${ok[0].name}: ${built.n.toLocaleString('en-IN')} rows (${per}).`
      );
    } catch (err) {
      setData(null);
      setStatusMsg('');
      setErrorMsg(err instanceof Error ? err.message : 'Failed to parse DBS file.');
    }
  }, []);

  const stockMult = includeStock ? 1 : 0;

  const agg = useCallback(
    (line: string, dept: string | null) => {
      if (!data) return 0;
      return data.pl.reduce(
        (s, r) => (r.line === line && (!dept || r.dept === dept) ? s + r.impact : s),
        0
      );
    },
    [data]
  );

  const stockMov = useCallback(
    (dept: string | null) => {
      if (!data) return 0;
      return data.stock.reduce((s, r) => (!dept || r.dept === dept ? s + r.mov : s), 0);
    },
    [data]
  );

  const buildStatement = useCallback(
    (depts: Array<string | null>) => {
      const out: StmtRow[] = [];
      const idx: Record<string, StmtRow> = {};
      for (const sp of SPEC) {
        const k = sp[0];
        const label = sp[1];
        const row: StmtRow = { kind: k, label, v: [] };
        idx[label] = row;
        if (k !== 'hdr') {
          const parts = k === 'sum' || k === 'tot' ? sp[2] : [];
          depts.forEach((d, j) => {
            let v = 0;
            if (k === 'rev') v = agg(label, d);
            else if (k === 'cost') v = -agg(label, d);
            else if (k === 'stock') v = -stockMov(d) * stockMult;
            else if (k === 'sum' || k === 'tot') v = parts.reduce((s, x) => s + idx[x].v[j], 0);
            else if (k === 'gp')
              v = idx['TOTAL OPERATING REVENUE'].v[j] - idx['TOTAL COST OF SALES'].v[j];
            else if (k === 'gc')
              v = idx['GROSS PROFIT'].v[j] - idx['Direct & variable selling costs'].v[j];
            else if (k === 'dc')
              v = idx['GROSS CONTRIBUTION'].v[j] - idx['Total departmental expenses'].v[j];
            else if (k === 'op')
              v = idx['DEPARTMENTAL CONTRIBUTION'].v[j] - idx['Total admin & overheads'].v[j];
            else if (k === 'np')
              v = idx['OPERATING PROFIT'].v[j] + idx['Net other income'].v[j];
            row.v.push(v);
          });
        }
        out.push(row);
      }
      return { rows: out, idx };
    },
    [agg, stockMov, stockMult]
  );

  const totalStmt = useMemo(() => (data ? buildStatement([null]) : null), [data, buildStatement]);
  const deptStmt = useMemo(
    () => (data ? buildStatement([...DEPTS, null]) : null),
    [data, buildStatement]
  );

  const nvModelsData = useMemo(() => {
    if (!data) return null;
    const rows = SERIES.map((s) => {
      const sum = (g: string) =>
        data.pl.reduce(
          (a, r) => (r.dept === 'New Vehicles' && r.group === g && r.series === s ? a + r.impact : a),
          0
        );
      const sales = sum('400');
      const disc = sum('410');
      const purch = -data.pl.reduce(
        (a, r) =>
          r.dept === 'New Vehicles' &&
          r.line === 'Purchases (cost of sales, as booked)' &&
          r.series === s
            ? a + r.impact
            : a,
        0
      );
      const stk =
        -data.stock.reduce(
          (a, r) => (r.dept === 'New Vehicles' && r.series === s ? a + r.mov : a),
          0
        ) * stockMult;
      const net = sales + disc;
      const cogs = purch + stk;
      return { s, sales, disc, net, purch, stk, cogs, m: net - cogs };
    });
    const keys = ['sales', 'disc', 'net', 'purch', 'stk', 'cogs', 'm'] as const;
    const tot: Record<string, number | string> = { s: 'TOTAL NEW VEHICLES' };
    const comb: Record<string, number | string> = { s: '3 Series + M Series combined' };
    keys.forEach((k) => {
      tot[k] = rows.reduce((a, r) => a + r[k], 0);
      comb[k] = rows[1][k] + rows[4][k];
    });
    return {
      rows,
      tot: tot as (typeof rows)[number],
      comb: comb as (typeof rows)[number],
    };
  }, [data, stockMult]);

  const buildAnalysis = useCallback(
    (cls: 'Income' | 'Expenses') => {
      if (!data) return { rows: [], tot: [], all: 0 };
      const groups = [
        ...new Set(data.pl.filter((r) => r.cls === cls).map((r) => r.group)),
      ].sort((a, b) => a.replace('x', '~').localeCompare(b.replace('x', '~')));
      const rows: Array<{ g: string; name: string; v: number[]; t: number }> = [];
      for (const g of groups) {
        const v = DEPTS.map((d) =>
          data.pl.reduce(
            (s, r) =>
              r.cls === cls && r.group === g && r.dept === d
                ? s + (cls === 'Income' ? r.impact : -r.impact)
                : s,
            0
          )
        );
        const t = v.reduce((a, b) => a + b, 0);
        if (v.every((x) => Math.abs(x) < 0.005)) continue;
        rows.push({ g, name: GN[g] || g, v, t });
      }
      const tot = DEPTS.map((_, j) => rows.reduce((s, r) => s + r.v[j], 0));
      return { rows, tot, all: tot.reduce((a, b) => a + b, 0) };
    },
    [data]
  );

  const revenueAnalysis = useMemo(() => buildAnalysis('Income'), [buildAnalysis]);
  const expenseAnalysis = useMemo(() => buildAnalysis('Expenses'), [buildAnalysis]);

  const handleExportXlsx = () => {
    if (!data || !totalStmt || !deptStmt || !nvModelsData) return;
    const wb = XLSX.utils.book_new();
    const add = (n: string, aoa: unknown[][], w: number[]) => {
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = w.map((x) => ({ wch: x }));
      XLSX.utils.book_append_sheet(wb, ws, n);
    };
    const sAoa = (heads: string[], rows: StmtRow[], withPct: boolean): unknown[][] => {
      const base = withPct
        ? rows.find((r) => r.label === 'TOTAL OPERATING REVENUE')?.v[0] || 0
        : 0;
      const a: unknown[][] = [
        ['Particulars (INR)', ...heads, ...(withPct ? ['% of operating revenue'] : [])],
      ];
      rows.forEach((r) =>
        a.push(
          r.kind === 'hdr'
            ? [r.label]
            : [
                r.label,
                ...r.v.map((x) => Math.round(x * 100) / 100),
                ...(withPct ? [base ? r.v[0] / base : 0] : []),
              ]
        )
      );
      return a;
    };

    const booked = data.pl.reduce((s, r) => s + r.impact, 0);
    const npVal = totalStmt.rows.find((r) => r.kind === 'np')?.v[0] || 0;
    add(
      'Summary',
      [
        [`DBS P&L report - ${period}`],
        [`Dealer ${data.dealer}`],
        ['Stock adjustment included', includeStock ? 'Yes' : 'No'],
        [],
        ['Net profit as per DBS P&L accounts', booked],
        ['Net change in stock accounts', stockMov(null)],
        ['Net profit after stock adjustment', booked + stockMov(null)],
        ['Net movement in balance-sheet accounts', data.bsMov],
        ['Unexplained difference', booked + stockMov(null) - data.bsMov],
        [],
        ['Net profit shown in this report', npVal],
      ],
      [48, 18]
    );
    add('P&L', sAoa(['Amount'], totalStmt.rows, true), [52, 18, 16]);
    add('Dept P&L', sAoa([...DEPTS, 'Total'], deptStmt.rows, false), [52, ...Array(7).fill(18)]);
    add(
      'NV Models',
      [
        [
          'Model series',
          'Car sales',
          'Discounts',
          'Net sales',
          'Purchases',
          'Stock decrease (+)',
          'Cost of sales',
          'Vehicle margin',
          'Margin %',
        ],
        ...[...nvModelsData.rows, nvModelsData.tot, nvModelsData.comb].map((r) => [
          r.s,
          r.sales,
          r.disc,
          r.net,
          r.purch,
          r.stk,
          r.cogs,
          r.m,
          r.net ? r.m / r.net : 0,
        ]),
      ],
      [34, ...Array(8).fill(16)]
    );

    const revSheet = revenueAnalysis;
    const expSheet = expenseAnalysis;
    add(
      'Revenue Analysis',
      [
        ['Group', 'Account group', ...DEPTS, 'Total'],
        ...revSheet.rows.map((r) => [r.g, r.name, ...r.v, r.t]),
        ['', 'TOTAL', ...revSheet.tot, revSheet.all],
      ],
      [9, 52, ...Array(7).fill(18)]
    );
    add(
      'Expense Analysis',
      [
        ['Group', 'Account group', ...DEPTS, 'Total'],
        ...expSheet.rows.map((r) => [r.g, r.name, ...r.v, r.t]),
        ['', 'TOTAL', ...expSheet.tot, expSheet.all],
      ],
      [9, 52, ...Array(7).fill(18)]
    );
    add(
      'PL_Data',
      [
        [
          'Account code',
          'Ledger',
          'Class',
          'Department',
          'Group',
          'P&L line',
          'Series',
          'DBS closing (Dr+/Cr-)',
          'Profit impact',
        ],
        ...data.pl.map((r) => [
          r.code,
          r.ledger,
          r.cls,
          r.dept,
          r.group,
          r.line,
          r.series,
          r.clg,
          r.impact,
        ]),
      ],
      [24, 44, 10, 20, 8, 40, 16, 18, 16]
    );

    XLSX.writeFile(
      wb,
      `DBS_PnL_Report_${data.year}_${String(data.month).padStart(2, '0')}.xlsx`
    );
  };

  const handleCopyCurrentTable = async () => {
    const tables = tableContainerRef.current?.querySelectorAll('table');
    if (!tables || tables.length === 0) return;
    const tsvBlocks: string[] = [];
    tables.forEach((tbl) => {
      const rows = [...tbl.querySelectorAll('tr')].map((tr) =>
        [...tr.querySelectorAll('th,td')]
          .map((cell) => (cell.textContent || '').replace(/\s+/g, ' ').trim())
          .join('\t')
      );
      tsvBlocks.push(rows.join('\n'));
    });
    try {
      await navigator.clipboard.writeText(tsvBlocks.join('\n\n'));
      setCopyMsg(`Copied "${activeTab}" tab for Excel!`);
      window.setTimeout(() => setCopyMsg(''), 3500);
    } catch {
      setCopyMsg('Clipboard unavailable — use Download Excel Report.');
      window.setTimeout(() => setCopyMsg(''), 3500);
    }
  };

  const renderAmountCell = (n: number, key: React.Key) => (
    <td
      key={key}
      className={`py-1.5 px-3 text-right font-mono tabular-nums whitespace-nowrap border-b border-[#2F3E4E]/10 ${
        n < -0.5 ? 'text-[#9E2A2B] font-semibold' : 'text-[#2F3E4E]'
      }`}
    >
      {fmt(n)}
    </td>
  );

  const renderStatementTable = (heads: string[], rows: StmtRow[], withPct: boolean) => {
    const base = withPct
      ? rows.find((r) => r.label === 'TOTAL OPERATING REVENUE')?.v[0] || 0
      : 0;
    const totalCols = heads.length + 1 + (withPct ? 1 : 0);

    return (
      <div className="overflow-x-auto rounded-xl border border-[#2F3E4E]/25 bg-white">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-[#2F3E4E] text-[#FFFDF5]">
              <th className="py-2.5 px-3 text-left font-bold min-w-[250px]">
                Particulars (INR)
              </th>
              {heads.map((h) => (
                <th key={h} className="py-2.5 px-3 text-right font-bold whitespace-nowrap">
                  {h}
                </th>
              ))}
              {withPct && (
                <th className="py-2.5 px-3 text-right font-bold whitespace-nowrap">
                  % of op. revenue
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, rIdx) => {
              if (r.kind === 'hdr') {
                return (
                  <tr key={`${r.label}-${rIdx}`} className="bg-[#FEF2C8] border-y border-[#2F3E4E]/20">
                    <td
                      colSpan={totalCols}
                      className="py-2 px-3 text-left font-display font-extrabold text-[11px] uppercase tracking-wider text-[#2F3E4E]"
                    >
                      {r.label}
                    </td>
                  </tr>
                );
              }
              const isTot = ['tot', 'gp', 'gc', 'dc', 'op'].includes(r.kind);
              const isNp = r.kind === 'np';
              const isSum = r.kind === 'sum';

              return (
                <tr
                  key={`${r.label}-${rIdx}`}
                  className={
                    isNp
                      ? 'bg-[#CEE5DC]/65 font-extrabold border-t-2 border-[#2F3E4E] border-b-4 border-double'
                      : isTot
                      ? 'bg-[#FEF2C8]/55 font-bold border-t border-[#2F3E4E]/35'
                      : isSum
                      ? 'bg-[#FFFDF5] font-semibold'
                      : 'hover:bg-[#FFFDF5]'
                  }
                >
                  <td className="py-1.5 px-3 text-left text-[#2F3E4E] border-b border-[#2F3E4E]/10 min-w-[250px]">
                    {r.label}
                  </td>
                  {r.v.map((val, cIdx) => renderAmountCell(val, cIdx))}
                  {withPct && (
                    <td className="py-1.5 px-3 text-right font-mono tabular-nums text-[#475569] border-b border-[#2F3E4E]/10 whitespace-nowrap">
                      {pct(r.v[0], base)}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <ToolPasscodeGate
      toolCode={tool?.code ?? 'VC-05'}
      toolTitle={tool?.title ?? 'DBS P&L and Reports Tool'}
      sessionKey="vcpl_dbs_pnl_unlocked_v1"
      passcode="202627"
      description="This BMW dealer financial P&L tool is protected by passcode access. Enter the 6-digit passcode to unlock."
      onBack={onBack}
    >
      {({ lockTool }) => (
        <div className="space-y-6">
          {/* Header Banner Card */}
          <div className="print:hidden bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 sm:p-6 shadow-[0_4px_0_#2F3E4E] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-[#CEE5DC] border border-[#2F3E4E] text-[11px] font-mono font-bold text-[#2F3E4E]">
                  {tool?.code ?? 'VC-05'} · Dealer Financial Reporting
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-[#F9C80E] border border-[#2F3E4E] text-[11px] font-bold text-[#2F3E4E]">
                  100% Browser-Local
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#2F3E4E] text-[11px] font-bold text-[#F9C80E]">
                  <Lock className="w-3 h-3" aria-hidden="true" />
                  <span>Passcode Unlocked</span>
                </span>
              </div>
              <h2 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E]">
                {tool?.title ?? 'DBS P&L and Reports Tool'}
              </h2>
              <p className="text-xs sm:text-sm text-[#475569] leading-relaxed max-w-3xl">
                BMW dealer DBS monthly data in (.ZIP, nested .ZIP, or .CSV) → Statement P&amp;L,
                Departmental P&amp;L, New Vehicle Model Margins, Revenue/Expense Analysis &amp;
                7-tab Excel export.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={lockTool}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#2F3E4E] hover:bg-[#1E293B] text-xs font-bold text-[#F9C80E] transition cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Lock Tool</span>
              </button>
              {data && (
                <button
                  type="button"
                  onClick={() => {
                    setData(null);
                    setStatusMsg('');
                    setErrorMsg('');
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Clear Data</span>
                </button>
              )}
            </div>
          </div>

          {/* Dropzone Card */}
          <div className="print:hidden bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 sm:p-6 shadow-[0_4px_0_#2F3E4E] space-y-4">
            <label
              onDragEnter={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const f = e.dataTransfer.files?.[0];
                if (f) void handleFile(f);
              }}
              className={`block rounded-xl border-2 border-dashed p-6 sm:p-8 text-center cursor-pointer transition-colors ${
                isDragging
                  ? 'border-[#2F3E4E] bg-[#FEF2C8]'
                  : data
                  ? 'border-[#12805C] bg-[#CEE5DC]/25'
                  : 'border-[#2F3E4E]/45 bg-white hover:bg-[#FEF2C8]/45'
              }`}
            >
              <div className="mx-auto w-11 h-11 rounded-xl bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] flex items-center justify-center text-[#2F3E4E] mb-3">
                {data ? (
                  <FileArchive className="w-5 h-5" aria-hidden="true" />
                ) : (
                  <Upload className="w-5 h-5" aria-hidden="true" />
                )}
              </div>
              <p className="font-display font-extrabold text-sm sm:text-base text-[#2F3E4E]">
                {data
                  ? `Loaded: ${data.fileName} (Drop or click to replace)`
                  : 'Drop the DBS file here, or click to choose'}
              </p>
              <p className="text-xs text-[#64748B] mt-1">
                Accepts the .zip you download (even zip inside zip) or the tab-separated .CSV directly
              </p>
              <input
                type="file"
                accept=".zip,.csv,.CSV,.ZIP,.txt"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                  e.target.value = '';
                }}
                className="sr-only"
              />
            </label>

            {statusMsg && (
              <div className="rounded-xl border border-[#12805C]/30 bg-[#CEE5DC]/50 px-3.5 py-2.5 flex items-center gap-2 text-xs font-bold text-[#0F5132]">
                <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{statusMsg}</span>
              </div>
            )}

            {errorMsg && (
              <div className="rounded-xl border border-rose-700/40 bg-rose-50 px-3.5 py-2.5 flex items-center gap-2 text-xs font-semibold text-rose-900">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-700" aria-hidden="true" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* Interactive Reports Workspace */}
          {data && totalStmt && deptStmt && nvModelsData && (
            <div className="space-y-4">
              {/* Action Controls Bar */}
              <div className="print:hidden bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-4 shadow-[0_3px_0_#2F3E4E] flex flex-wrap items-center justify-between gap-3">
                <label className="inline-flex items-center gap-2 text-xs font-bold text-[#2F3E4E] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeStock}
                    onChange={(e) => setIncludeStock(e.target.checked)}
                  />
                  <span>Include stock adjustment in cost of sales</span>
                </label>

                <div className="flex flex-wrap items-center gap-2">
                  {copyMsg && (
                    <span className="text-xs font-bold text-[#12805C] mr-1">{copyMsg}</span>
                  )}
                  <button
                    type="button"
                    onClick={handleCopyCurrentTable}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] transition cursor-pointer"
                  >
                    <ClipboardCopy className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Copy Tab to Excel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void exportElementToPdf({
                        element: tableContainerRef.current,
                        filename: `DBS_PnL_${activeTab.replace(/\s+/g, '_')}_${period.replace(/\s+/g, '_')}.pdf`,
                        orientation: 'landscape',
                      });
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#CEE5DC] hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] transition cursor-pointer whitespace-nowrap"
                  >
                    <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Save PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void printTargetElement({
                        element: tableContainerRef.current,
                        title: `DBS_PnL_${activeTab}_${period}`,
                        orientation: 'landscape',
                      });
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] transition cursor-pointer whitespace-nowrap"
                  >
                    <Printer className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Print This Tab</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportXlsx}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#2F3E4E] hover:bg-[#1E293B] text-xs font-bold text-[#F9C80E] shadow-[0_2px_0_#1E293B] transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Download Excel Report (.XLSX)</span>
                  </button>
                </div>
              </div>

              {/* Tabs + Content Panel */}
              <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl overflow-hidden shadow-[0_4px_0_#2F3E4E]">
                <div
                  role="tablist"
                  className="print:hidden flex flex-wrap gap-1.5 bg-[#FEF2C8] border-b-[1.5px] border-[#2F3E4E] px-4 pt-3 pb-0"
                >
                  {TABS.map((t) => {
                    const selected = t === activeTab;
                    return (
                      <button
                        key={t}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        onClick={() => setActiveTab(t)}
                        className={`px-3.5 py-2 rounded-t-xl border-x-[1.5px] border-t-[1.5px] text-xs font-display font-extrabold transition cursor-pointer -mb-[1.5px] ${
                          selected
                            ? 'bg-[#FFFDF5] border-[#2F3E4E] text-[#2F3E4E] border-b-[1.5px] border-b-[#FFFDF5]'
                            : 'bg-[#F5E7B8]/70 border-transparent text-[#475569] hover:text-[#2F3E4E] hover:bg-[#FFFDF5]/60'
                        }`}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>

                <div ref={tableContainerRef} className="p-5 sm:p-6 space-y-5">
                  {activeTab === 'Summary' && (() => {
                    const g = (lbl: string) => totalStmt.idx[lbl]?.v[0] || 0;
                    const rev = g('TOTAL OPERATING REVENUE');
                    const gp = g('GROSS PROFIT');
                    const dc = g('DEPARTMENTAL CONTRIBUTION');
                    const ovh = g('Total admin & overheads');
                    const np = g('NET PROFIT BEFORE DEPRECIATION & TAX');
                    const booked = data.pl.reduce((s, r) => s + r.impact, 0);
                    const sm = stockMov(null);
                    const adj = booked + sm;

                    const getDeptRow = (lbl: string) =>
                      deptStmt.rows.find((r) => r.label === lbl)?.v || [];

                    return (
                      <>
                        <div>
                          <h3 className="font-display font-extrabold text-lg text-[#2F3E4E]">
                            Summary — {period}
                          </h3>
                          <p className="text-xs text-[#64748B]">
                            Dealer {data.dealer} · amounts in INR
                          </p>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                          {[
                            ['Operating revenue', rev],
                            ['Gross profit', gp],
                            ['Departmental contribution', dc],
                            ['Admin & overheads', ovh],
                            ['Net profit before dep. & tax', np],
                          ].map(([lbl, val]) => (
                            <div
                              key={String(lbl)}
                              className="bg-white border-[1.5px] border-[#2F3E4E] rounded-xl p-3.5 shadow-[0_2px_0_#2F3E4E]"
                            >
                              <span className="block text-[11px] font-semibold text-[#64748B]">
                                {lbl}
                              </span>
                              <strong className="block mt-1 font-display font-extrabold text-base sm:text-lg text-[#2F3E4E] tabular-nums">
                                {fmt(Number(val))}
                              </strong>
                              <span className="block text-[10px] font-mono text-[#64748B] mt-0.5">
                                INR {lakh(Number(val))} lakh · {pct(Number(val), rev)}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="space-y-2">
                          <h4 className="font-display font-extrabold text-sm text-[#2F3E4E]">
                            Profit Reconciliation
                          </h4>
                          <div className="overflow-x-auto rounded-xl border border-[#2F3E4E]/25 bg-white">
                            <table className="w-full border-collapse text-xs">
                              <tbody>
                                <tr>
                                  <td className="py-2 px-3 text-[#2F3E4E] border-b border-[#2F3E4E]/10">
                                    Net profit as per DBS P&amp;L accounts (Income less Expenses)
                                  </td>
                                  {renderAmountCell(booked, 'booked')}
                                </tr>
                                <tr>
                                  <td className="py-2 px-3 text-[#2F3E4E] border-b border-[#2F3E4E]/10">
                                    Net change in stock accounts (decrease reduces profit)
                                  </td>
                                  {renderAmountCell(sm, 'sm')}
                                </tr>
                                <tr className="bg-[#FEF2C8]/55 font-bold">
                                  <td className="py-2 px-3 text-[#2F3E4E] border-b border-[#2F3E4E]/10">
                                    Net profit after stock adjustment
                                  </td>
                                  {renderAmountCell(adj, 'adj')}
                                </tr>
                                <tr>
                                  <td className="py-2 px-3 text-[#2F3E4E] border-b border-[#2F3E4E]/10">
                                    Net movement in all balance-sheet accounts (should equal profit if books are complete)
                                  </td>
                                  {renderAmountCell(data.bsMov, 'bs')}
                                </tr>
                                <tr>
                                  <td className="py-2 px-3 text-[#2F3E4E]">Unexplained difference</td>
                                  {renderAmountCell(adj - data.bsMov, 'diff')}
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <h4 className="font-display font-extrabold text-sm text-[#2F3E4E]">
                            Department Snapshot
                          </h4>
                          <div className="overflow-x-auto rounded-xl border border-[#2F3E4E]/25 bg-white">
                            <table className="w-full border-collapse text-xs">
                              <thead>
                                <tr className="bg-[#2F3E4E] text-[#FFFDF5]">
                                  <th className="py-2.5 px-3 text-left font-bold">Department</th>
                                  <th className="py-2.5 px-3 text-right font-bold">Operating revenue</th>
                                  <th className="py-2.5 px-3 text-right font-bold">Gross profit</th>
                                  <th className="py-2.5 px-3 text-right font-bold">Gross profit %</th>
                                  <th className="py-2.5 px-3 text-right font-bold">
                                    Contribution after dept. costs
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {DEPTS.slice(0, 5).map((d, j) => {
                                  const dRev = getDeptRow('TOTAL OPERATING REVENUE')[j] || 0;
                                  const dGp = getDeptRow('GROSS PROFIT')[j] || 0;
                                  const dDc = getDeptRow('DEPARTMENTAL CONTRIBUTION')[j] || 0;
                                  return (
                                    <tr key={d} className="hover:bg-[#FFFDF5]">
                                      <td className="py-2 px-3 text-left font-semibold text-[#2F3E4E] border-b border-[#2F3E4E]/10">
                                        {d}
                                      </td>
                                      {renderAmountCell(dRev, 'rev')}
                                      {renderAmountCell(dGp, 'gp')}
                                      <td className="py-2 px-3 text-right font-mono text-[#475569] border-b border-[#2F3E4E]/10">
                                        {pct(dGp, dRev)}
                                      </td>
                                      {renderAmountCell(dDc, 'dc')}
                                    </tr>
                                  );
                                })}
                                <tr>
                                  <td className="py-2 px-3 text-left text-[#475569] border-b border-[#2F3E4E]/10">
                                    Admin overheads less other income (not allocated)
                                  </td>
                                  <td className="border-b border-[#2F3E4E]/10" />
                                  <td className="border-b border-[#2F3E4E]/10" />
                                  <td className="border-b border-[#2F3E4E]/10" />
                                  {renderAmountCell(
                                    getDeptRow('NET PROFIT BEFORE DEPRECIATION & TAX')[5] || 0,
                                    'adm'
                                  )}
                                </tr>
                                <tr className="bg-[#CEE5DC]/55 font-extrabold border-t border-[#2F3E4E]">
                                  <td className="py-2 px-3 text-left text-[#2F3E4E]">
                                    Total / net profit
                                  </td>
                                  {renderAmountCell(rev, 'trev')}
                                  {renderAmountCell(gp, 'tgp')}
                                  <td className="py-2 px-3 text-right font-mono text-[#2F3E4E]">
                                    {pct(gp, rev)}
                                  </td>
                                  {renderAmountCell(np, 'tnp')}
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <div className="rounded-xl border border-[#B45309]/35 bg-[#FEF2C8] p-3.5 text-xs text-[#78350F] leading-relaxed">
                          <strong>How to read this:</strong> P&amp;L ledgers in the DBS file have
                          zero opening balances, so closing amounts are treated as one month. The DBS
                          P&amp;L accounts hold purchases but no stock-change entry, so the tool adds
                          the movement in the stock accounts to cost of sales. Untick the stock
                          checkbox above to see the P&amp;L exactly as extracted. Profit is before
                          depreciation, tax, and year-end provisions.
                        </div>

                        {data.unmapped.length > 0 && (
                          <div className="rounded-xl border border-rose-700/35 bg-rose-50 p-3.5 text-xs text-rose-900">
                            <strong>Unmapped accounts:</strong> These P&amp;L accounts have balances
                            but are not in the mapping: {data.unmapped.slice(0, 10).join('; ')}
                          </div>
                        )}
                      </>
                    );
                  })()}

                  {activeTab === 'P&L' && (
                    <>
                      <div>
                        <h3 className="font-display font-extrabold text-lg text-[#2F3E4E]">
                          Profit &amp; Loss Statement — {period}
                        </h3>
                        <p className="text-xs text-[#64748B]">
                          Dealer {data.dealer} · stock adjustment{' '}
                          {includeStock ? 'included' : 'not included'}
                        </p>
                      </div>
                      {renderStatementTable(['Amount'], totalStmt.rows, true)}
                    </>
                  )}

                  {activeTab === 'Dept P&L' && (
                    <>
                      <div>
                        <h3 className="font-display font-extrabold text-lg text-[#2F3E4E]">
                          Departmental P&amp;L — {period}
                        </h3>
                        <p className="text-xs text-[#64748B]">
                          Dealer {data.dealer} · department taken from the account code
                        </p>
                      </div>
                      {renderStatementTable([...DEPTS, 'Total'], deptStmt.rows, false)}
                      <p className="text-xs text-[#64748B]">
                        Admin / Back Office carries shared overheads (rent, utilities, finance costs)
                        and is not allocated to departments.
                      </p>
                    </>
                  )}

                  {activeTab === 'NV Models' && (
                    <>
                      <div>
                        <h3 className="font-display font-extrabold text-lg text-[#2F3E4E]">
                          New Vehicle Margin by Model Series — {period}
                        </h3>
                        <p className="text-xs text-[#64748B]">
                          Dealer {data.dealer} · sales, discounts, purchases and stock movement
                        </p>
                      </div>
                      <div className="overflow-x-auto rounded-xl border border-[#2F3E4E]/25 bg-white">
                        <table className="w-full border-collapse text-xs">
                          <thead>
                            <tr className="bg-[#2F3E4E] text-[#FFFDF5]">
                              <th className="py-2.5 px-3 text-left font-bold">Model series</th>
                              <th className="py-2.5 px-3 text-right font-bold">Car sales</th>
                              <th className="py-2.5 px-3 text-right font-bold">Discounts</th>
                              <th className="py-2.5 px-3 text-right font-bold">Net sales</th>
                              <th className="py-2.5 px-3 text-right font-bold">Purchases</th>
                              <th className="py-2.5 px-3 text-right font-bold">
                                Stock dec (+) / inc (-)
                              </th>
                              <th className="py-2.5 px-3 text-right font-bold">Cost of sales</th>
                              <th className="py-2.5 px-3 text-right font-bold">Vehicle margin</th>
                              <th className="py-2.5 px-3 text-right font-bold">Margin %</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[
                              ...nvModelsData.rows.map((r) => ({ r, cls: '' })),
                              { r: nvModelsData.tot, cls: 'tot' },
                              { r: nvModelsData.comb, cls: 'calc' },
                            ].map(({ r, cls }) => (
                              <tr
                                key={r.s}
                                className={
                                  cls === 'tot'
                                    ? 'bg-[#CEE5DC]/55 font-extrabold border-t border-[#2F3E4E]'
                                    : cls === 'calc'
                                    ? 'bg-[#FEF2C8]/65 font-bold'
                                    : 'hover:bg-[#FFFDF5]'
                                }
                              >
                                <td className="py-2 px-3 text-left text-[#2F3E4E] border-b border-[#2F3E4E]/10 font-semibold">
                                  {r.s}
                                </td>
                                {[r.sales, r.disc, r.net, r.purch, r.stk, r.cogs, r.m].map(
                                  (v, i) => renderAmountCell(v, i)
                                )}
                                <td className="py-2 px-3 text-right font-mono text-[#475569] border-b border-[#2F3E4E]/10">
                                  {pct(r.m, r.net)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-xs text-[#64748B]">
                        &ldquo;Other / unallocated&rdquo; holds the generic Discounts on Cars ledger
                        and purchases not tagged to a series. M-series cars usually sit in the 3
                        Series stock account, so read the combined row.
                      </p>
                    </>
                  )}

                  {(activeTab === 'Revenue Analysis' || activeTab === 'Expense Analysis') && (() => {
                    const isRev = activeTab === 'Revenue Analysis';
                    const a = isRev ? revenueAnalysis : expenseAnalysis;
                    return (
                      <>
                        <div>
                          <h3 className="font-display font-extrabold text-lg text-[#2F3E4E]">
                            {activeTab} — {period}
                          </h3>
                          <p className="text-xs text-[#64748B]">
                            Dealer {data.dealer} ·{' '}
                            {isRev
                              ? 'credits positive, debits negative'
                              : 'as booked in DBS, before stock adjustment'}
                          </p>
                        </div>
                        <div className="overflow-x-auto rounded-xl border border-[#2F3E4E]/25 bg-white">
                          <table className="w-full border-collapse text-xs">
                            <thead>
                              <tr className="bg-[#2F3E4E] text-[#FFFDF5]">
                                <th className="py-2.5 px-3 text-left font-bold min-w-[240px]">
                                  Account group
                                </th>
                                {DEPTS.map((d) => (
                                  <th key={d} className="py-2.5 px-3 text-right font-bold whitespace-nowrap">
                                    {d}
                                  </th>
                                ))}
                                <th className="py-2.5 px-3 text-right font-bold">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {a.rows.map((r) => (
                                <tr key={r.g} className="hover:bg-[#FFFDF5]">
                                  <td className="py-1.5 px-3 text-left text-[#2F3E4E] border-b border-[#2F3E4E]/10">
                                    <span className="font-mono font-bold text-[#475569] mr-1.5">
                                      {r.g}
                                    </span>
                                    {r.name}
                                  </td>
                                  {r.v.map((val, i) => renderAmountCell(val, i))}
                                  {renderAmountCell(r.t, 't')}
                                </tr>
                              ))}
                              <tr className="bg-[#CEE5DC]/55 font-extrabold border-t border-[#2F3E4E]">
                                <td className="py-2 px-3 text-left text-[#2F3E4E]">TOTAL</td>
                                {a.tot.map((val, i) => renderAmountCell(val, i))}
                                {renderAmountCell(a.all, 'all')}
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </>
                    );
                  })()}

                  {activeTab === 'Checks' && (() => {
                    const inc = data.pl
                      .filter((r) => r.cls === 'Income')
                      .reduce((s, r) => s + r.impact, 0);
                    const exp = data.pl
                      .filter((r) => r.cls === 'Expenses')
                      .reduce((s, r) => s + r.clg, 0);
                    const sm = stockMov(null);
                    return (
                      <>
                        <div>
                          <h3 className="font-display font-extrabold text-lg text-[#2F3E4E]">
                            Checks — {period}
                          </h3>
                          <p className="text-xs text-[#64748B]">
                            Dealer {data.dealer} · data and trial balance tie-out
                          </p>
                        </div>
                        <div className="overflow-x-auto rounded-xl border border-[#2F3E4E]/25 bg-white">
                          <table className="w-full border-collapse text-xs">
                            <tbody>
                              <tr>
                                <td className="py-2 px-3 text-[#2F3E4E] border-b border-[#2F3E4E]/10">
                                  Rows read from file
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-[#2F3E4E] border-b border-[#2F3E4E]/10">
                                  {data.n.toLocaleString('en-IN')}
                                </td>
                              </tr>
                              <tr>
                                <td className="py-2 px-3 text-[#2F3E4E] border-b border-[#2F3E4E]/10">
                                  P&amp;L ledgers used
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-[#2F3E4E] border-b border-[#2F3E4E]/10">
                                  {data.pl.length}
                                </td>
                              </tr>
                              <tr>
                                <td className="py-2 px-3 text-[#2F3E4E] border-b border-[#2F3E4E]/10">
                                  Total income (net credit)
                                </td>
                                {renderAmountCell(inc, 'inc')}
                              </tr>
                              <tr>
                                <td className="py-2 px-3 text-[#2F3E4E] border-b border-[#2F3E4E]/10">
                                  Total expenses (net debit)
                                </td>
                                {renderAmountCell(exp, 'exp')}
                              </tr>
                              <tr>
                                <td className="py-2 px-3 text-[#2F3E4E] border-b border-[#2F3E4E]/10">
                                  Trial balance movement, all accounts (0 if complete)
                                </td>
                                {renderAmountCell(data.tbMov, 'tb')}
                              </tr>
                              <tr>
                                <td className="py-2 px-3 text-[#2F3E4E] border-b border-[#2F3E4E]/10">
                                  Stock accounts movement
                                </td>
                                {renderAmountCell(sm, 'sm')}
                              </tr>
                              <tr className="bg-[#FEF2C8]/55 font-bold">
                                <td className="py-2 px-3 text-[#2F3E4E]">
                                  Trial balance gap left after stock movement
                                </td>
                                {renderAmountCell(data.tbMov - sm, 'gap')}
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        <p className="text-xs text-[#64748B]">
                          If the trial balance gap equals the stock movement, the only missing piece
                          is the stock entry, which this tool adds.
                        </p>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {!data && !errorMsg && (
            <div className="print:hidden bg-[#FFFDF5]/80 border border-[#2F3E4E]/25 rounded-2xl p-5 flex items-center gap-3 text-xs text-[#475569]">
              <FileSpreadsheet className="w-5 h-5 text-[#0F766E] shrink-0" aria-hidden="true" />
              <span>
                Upload a monthly BMW DBS export (.zip or tab-separated .csv) above to inspect Summary,
                P&amp;L, Departmental P&amp;L, New Vehicle Model Margins, Revenue/Expense Analysis,
                and export a formatted 7-sheet .XLSX workbook.
              </span>
            </div>
          )}
        </div>
      )}
    </ToolPasscodeGate>
  );
};
