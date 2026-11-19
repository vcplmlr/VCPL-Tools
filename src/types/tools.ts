export type ToolFilterType =
  | 'All'
  | 'Banking'
  | 'Tax & GST'
  | 'GST Utilities'
  | 'Calculator'
  | 'PDF Suite'
  | 'Image Studio'
  | 'Typing & Text'
  | 'Utilities'
  | 'VCPL'
  | 'Special Tools'
  | 'Learn Tools';

export type ToolKind =
  | 'bank-slip'
  | 'unified-calculator'
  | 'financial-calc'
  | 'exam-utility-calc'
  | 'tax-26as'
  | 'tax-gstr2b'
  | 'tax-invoice'
  | 'tax-invoice-maker'
  | 'tax-regime'
  | 'pdf-engine'
  | 'pdf-converter'
  | 'pdf-form-filler'
  | 'image-studio'
  | 'utility-engine'
  | 'number-to-words'
  | 'typing-engine'
  | 'dms-tally-reconciler'
  | 'parts-billing-reconciler'
  | 'swatchbook-color-picker'
  | 'tds-tcs-toolkit'
  | 'income-tax-fy2627'
  | 'pdf-editor-advanced'
  | 'incentive-report-tool'
  | 'tcs-tax-calculator'
  | 'rent-payment-letter-maker'
  | 'dbs-pnl-reports'
  | 'gstr1-return-prep'
  | 'bmw-statement-reconciler'
  | 'fuel-report-generator'
  | 'covering-letter-generator'
  | 'letterhead-invoice-maker'
  | 'textlift-ocr-pro'
  | 'bank-directory'
  | 'tax-banking-extra'
  | 'pdf-advanced-suite'
  | 'spreadsheet-studio'
  | 'image-pro-suite'
  | 'productivity-dev-suite'
  | 'rto-code-finder'
  | 'pin-code-finder'
  | 'database-file-compressor'
  | 'tulusiri-pro'
  | 'keyboard-shortcuts'
  | 'tally-shortcuts';

export interface ToolCatalogItem {
  id: string;
  code: string;
  suite: string;
  suiteAccent: string;
  category: Exclude<ToolFilterType, 'All'>;
  alsoInCategories?: Exclude<ToolFilterType, 'All'>[];
  categoryName: string;
  kind: ToolKind;
  title: string;
  description: string;
  priorityStars: number;
  statusLabel: string;
  featuredPrimary?: boolean;
  defaultOpenBulk?: boolean;
  embedHtmlPath?: string;
  keywords?: string[];
}

export interface CategoryItem {
  id: string;
  name: string;
  filterKey: ToolFilterType;
  countLabel: string;
  iconName:
    | 'landmark'
    | 'calculator'
    | 'indian-rupee'
    | 'graduation-cap'
    | 'sliders'
    | 'file-spreadsheet'
    | 'search'
    | 'receipt'
    | 'file-text'
    | 'image'
    | 'keyboard'
    | 'building-2'
    | 'sparkles';
}

export interface CalculatorInputOption {
  label: string;
  value: string;
}

export interface CalculatorInput {
  id: string;
  label: string;
  type: 'number' | 'select' | 'date' | 'text';
  defaultValue: number | string;
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
  suffix?: string;
  tooltip?: string;
  placeholder?: string;
  options?: CalculatorInputOption[];
}

export interface BreakdownRow {
  label: string;
  value: string;
  isTotal?: boolean;
  color?: string;
}

export interface ChartSegment {
  label: string;
  value: number;
  color: string;
}

export interface ChartData {
  type: 'donut' | 'bar';
  title?: string;
  segments: ChartSegment[];
}

export interface ScheduleData {
  title: string;
  headers: string[];
  rows: (string | number)[][];
}

export interface CalculationResult {
  primaryLabel: string;
  primaryValue: string;
  secondaryLabel?: string;
  secondaryValue?: string;
  summary?: string;
  breakdown: BreakdownRow[];
  chart?: ChartData;
  schedule?: ScheduleData;
  assumptions?: string[];
}

export interface CalculatorFaq {
  question: string;
  answer: string;
}

export interface FinancialCalculatorDefinition {
  id: string;
  slug: string;
  name: string;
  categoryId: string;
  shortDesc: string;
  inputs: CalculatorInput[];
  calculate: (inputs: Record<string, number | string>) => CalculationResult;
  formulaLatex?: string;
  formulaExplanation: string;
  practicalExample: string;
  faqs: CalculatorFaq[];
  disclaimer?: string;
}

export interface BankDirectoryRecord {
  code: string;
  ifsc: string | null;
  micr: string | null;
  iin: string | null;
  ach_credit: boolean;
  ach_debit: boolean;
  apbs: boolean;
  nach_debit: boolean;
  type: string;
  upi?: boolean;
}
