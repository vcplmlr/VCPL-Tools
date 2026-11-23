import { BlogCategory } from '../types/blog';

export interface BlogTopicHeadMeta {
  category: BlogCategory;
  slug: string;
  shortLabel: string;
  subtitle: string;
  recommendedToolId: string;
  recommendedToolLabel: string;
}

export interface EditorialRoadmapItem {
  no: number;
  title: string;
  slug: string;
  category: BlogCategory;
  tier: 'Top 15 Priority' | 'Evergreen SEO' | 'High Search Potential';
  relatedToolId?: string;
}

export const BLOG_TOPIC_HEADS: BlogTopicHeadMeta[] = [
  {
    category: 'GST',
    slug: 'gst',
    shortLabel: 'GST Guide',
    subtitle: 'GSTR-1, GSTR-3B, GSTR-2B ITC, RCM, E-Invoice & GSTR-9',
    recommendedToolId: 'gstr1-return-prep',
    recommendedToolLabel: 'Open GSTR-1 Return Prep',
  },
  {
    category: 'Income Tax',
    slug: 'income-tax',
    shortLabel: 'Income Tax',
    subtitle: 'ITR Filing, Income-tax Act 2025, 26AS, AIS/TIS & Regimes',
    recommendedToolId: 'income-tax-fy-2026-27',
    recommendedToolLabel: 'Open FY 2026–27 Tax Calc',
  },
  {
    category: 'TDS & TCS',
    slug: 'tds-tcs',
    shortLabel: 'TDS & TCS',
    subtitle: 'Section Rates, Thresholds, Form 138/140/143 & TRACES',
    recommendedToolId: 'tds-tcs-toolkit',
    recommendedToolLabel: 'Open TDS & TCS Toolkit',
  },
  {
    category: 'PF & ESI',
    slug: 'pf-esi',
    shortLabel: 'PF, ESI & Payroll',
    subtitle: 'EPF ECR, ESIC Contributions, Karnataka PT, CTC & Gratuity',
    recommendedToolId: 'income-tax-fy-2026-27',
    recommendedToolLabel: 'Open Salary & Tax Calc',
  },
  {
    category: 'Accounting',
    slug: 'accounting',
    shortLabel: 'Accounting Entries',
    subtitle: 'Journal Entries, Tally Prime, BRS, Trial Balance & Closing',
    recommendedToolId: 'tds-26as-tally-reco',
    recommendedToolLabel: 'Open 26AS ⇄ Tally Reco',
  },
  {
    category: 'Excel Templates',
    slug: 'excel-templates',
    shortLabel: 'Excel & Automation',
    subtitle: 'XLOOKUP, BRS, GSTR-2B Matching & Audit Workbook Formats',
    recommendedToolId: 'form-26as-to-excel',
    recommendedToolLabel: 'Open 26AS Excel Convertor',
  },
  {
    category: 'ROC & MCA',
    slug: 'roc-mca',
    shortLabel: 'ROC & MCA',
    subtitle: 'AOC-4, MGT-7, LLP Form 8/11, DIR-3 KYC & Startup Filing',
    recommendedToolId: 'covering-letter-generator',
    recommendedToolLabel: 'Open Covering Letter Maker',
  },
  {
    category: 'Business & Career',
    slug: 'business-career',
    shortLabel: 'Business & Career',
    subtitle: 'Proprietorship vs Pvt Ltd, MSME Setup & Interview Q&As',
    recommendedToolId: 'resume-ats-builder',
    recommendedToolLabel: 'Open ATS Resume Builder',
  },
  {
    category: 'Banking & UPI',
    slug: 'banking-upi',
    shortLabel: 'Banking & UPI',
    subtitle: 'SBI/HDFC A4 Slips, 182,000+ RBI IFSC & NPCI UPI Standees',
    recommendedToolId: 'bank-slip-generator',
    recommendedToolLabel: 'Open Bank Slip Generator',
  },
  {
    category: 'PDF & Privacy',
    slug: 'pdf-privacy',
    shortLabel: 'PDF & Privacy',
    subtitle: 'Zero-Upload PDF Decrypt, Permanent Redaction & Browser OCR',
    recommendedToolId: 'pdf-unlocker',
    recommendedToolLabel: 'Open PDF Unlocker',
  },
  {
    category: 'Regional Tech',
    slug: 'regional-tech',
    shortLabel: 'Regional Tech',
    subtitle: 'Tulusiri Pro Baravu Script, Kannada Typing & Legacy Fonts',
    recommendedToolId: 'tulusiri-pro',
    recommendedToolLabel: 'Open Tulusiri Pro Studio',
  },
];

export const EDITORIAL_TOPICS_QUEUE: EditorialRoadmapItem[] = [
  // Top Priority & Live Pillars
  { no: 1, title: 'GST, ITR & TDS Due Dates 2026–27: Complete Tax Compliance Calendar for Accountants in India', slug: 'gst-itr-tds-due-dates-2026-27', category: 'GST', tier: 'Top 15 Priority', relatedToolId: 'gstr1-return-prep' },
  { no: 2, title: 'Complete TDS Sections and Rates Chart for FY 2026–27', slug: 'tds-sections-and-rates-chart-fy-2026-27', category: 'TDS & TCS', tier: 'Top 15 Priority', relatedToolId: 'tds-tcs-toolkit' },
  { no: 3, title: 'How to Reconcile GSTR-2B with Purchase Register in Excel', slug: 'gstr-2b-vs-purchase-register-reconciliation-excel', category: 'Excel Templates', tier: 'Top 15 Priority', relatedToolId: 'gstr2b-tally-reconciler' },
  { no: 4, title: 'How to Bifurcate Form 26AS TDS & TCS Schedules in Excel for Faster Tax Audit', slug: 'form-26as-tds-tcs-excel-reconciliation-guide', category: 'TDS & TCS', tier: 'Top 15 Priority', relatedToolId: 'form-26as-to-excel' },
  { no: 5, title: 'PF, ESI & Karnataka Professional Tax: Complete Payroll Compliance Guide', slug: 'pf-esi-and-karnataka-professional-tax-compliance-guide', category: 'PF & ESI', tier: 'Top 15 Priority' },

  // Remaining Daily Scheduled Knowledge Hub Queue (Published Daily 9:05 AM IST)
  { no: 6, title: '100 Most Important Journal Entries Every Accountant Should Know', slug: '100-most-important-journal-entries-accountants', category: 'Accounting', tier: 'Top 15 Priority', relatedToolId: 'tds-26as-tally-reco' },
  { no: 7, title: 'New Income-tax Act 2025: Complete Guide for Taxpayers and Accountants', slug: 'new-income-tax-act-2025-complete-accountant-guide', category: 'Income Tax', tier: 'Top 15 Priority', relatedToolId: 'income-tax-fy-2026-27' },
  { no: 8, title: 'Old Tax Regime vs New Tax Regime: Complete Comparison FY 2026–27', slug: 'old-tax-regime-vs-new-tax-regime-comparison', category: 'Income Tax', tier: 'Top 15 Priority', relatedToolId: 'income-tax-fy-2026-27' },
  { no: 9, title: 'GST Interest and Late Fee Calculator: Complete Guide', slug: 'gst-interest-and-late-fee-calculator-guide', category: 'GST', tier: 'Top 15 Priority', relatedToolId: 'gst-place-of-supply' },
  { no: 10, title: 'How to Prepare Bank Reconciliation Statement in Excel', slug: 'bank-reconciliation-statement-in-excel-guide', category: 'Excel Templates', tier: 'Top 15 Priority', relatedToolId: 'bank-statement-analyzer' },
  { no: 11, title: 'GST Annual Return GSTR-9 & GSTR-9C Complete Filing Guide', slug: 'gstr-9-and-gstr-9c-complete-filing-guide', category: 'GST', tier: 'Top 15 Priority', relatedToolId: 'gstr2b-tally-reconciler' },
  { no: 12, title: '50 Most Asked Accountant Interview Questions and Answers', slug: '50-most-asked-accountant-interview-questions-answers', category: 'Business & Career', tier: 'Top 15 Priority', relatedToolId: 'resume-ats-builder' },
  { no: 13, title: 'Complete GST Return Filing Guide for Beginners in India', slug: 'complete-gst-return-filing-guide-beginners-india', category: 'GST', tier: 'Evergreen SEO', relatedToolId: 'gstr1-return-prep' },
  { no: 14, title: 'GSTR-1 vs GSTR-3B: Differences, Due Dates and Filing Process', slug: 'gstr-1-vs-gstr-3b-differences-due-dates-filing', category: 'GST', tier: 'Evergreen SEO', relatedToolId: 'gstr1-return-prep' },
  { no: 15, title: 'GSTR-2A vs GSTR-2B: Complete Difference Explained', slug: 'gstr-2a-vs-gstr-2b-difference-explained', category: 'GST', tier: 'Evergreen SEO', relatedToolId: 'gstr2b-tally-reconciler' },
  { no: 16, title: 'How to Claim ITC Under GST: Eligibility, Conditions and Restrictions', slug: 'how-to-claim-itc-under-gst-eligibility-rules', category: 'GST', tier: 'Evergreen SEO', relatedToolId: 'gstr2b-tally-reconciler' },
  { no: 17, title: 'GST Input Tax Credit Reversal: Rules, Examples and Accounting Entries', slug: 'gst-input-tax-credit-reversal-rules-entries', category: 'GST', tier: 'Evergreen SEO' },
  { no: 18, title: 'GST on Expenses: Which Expenses Allow ITC and Which Do Not?', slug: 'gst-on-expenses-blocked-credits-section-17-5', category: 'GST', tier: 'Evergreen SEO' },
  { no: 19, title: 'Reverse Charge Mechanism (RCM) Under GST: Complete Guide', slug: 'reverse-charge-mechanism-rcm-under-gst-guide', category: 'GST', tier: 'Evergreen SEO' },
  { no: 20, title: 'E-Invoice Under GST: Applicability, Limits and Generation Process', slug: 'e-invoice-under-gst-applicability-limits-process', category: 'GST', tier: 'Evergreen SEO', relatedToolId: 'invoice-quotation-maker' },
  { no: 21, title: 'E-Way Bill Rules: Limits, Validity and Common Mistakes', slug: 'e-way-bill-rules-limits-validity-mistakes', category: 'GST', tier: 'Evergreen SEO' },
  { no: 22, title: 'GST Notice Reply: Types of Notices and How to Respond', slug: 'gst-notice-reply-types-and-response-guide', category: 'GST', tier: 'Evergreen SEO' },
  { no: 23, title: 'GST Refund Process: Export, Excess Payment and ITC Refund', slug: 'gst-refund-process-export-itc-excess-payment', category: 'GST', tier: 'Evergreen SEO' },
  { no: 24, title: 'GST Registration: Documents, Eligibility and Complete Process', slug: 'gst-registration-documents-eligibility-process', category: 'GST', tier: 'Evergreen SEO' },
  { no: 25, title: 'GST Composition Scheme vs Regular Scheme', slug: 'gst-composition-scheme-vs-regular-scheme', category: 'GST', tier: 'Evergreen SEO' },
  { no: 26, title: 'GST Reconciliation Between Books, GSTR-1, GSTR-3B and GSTR-2B', slug: 'gst-reconciliation-books-gstr1-gstr3b-gstr2b', category: 'GST', tier: 'Evergreen SEO', relatedToolId: 'gstr2b-tally-reconciler' },
  { no: 27, title: 'ITR-1 vs ITR-2 vs ITR-3 vs ITR-4: Which Form Should You File?', slug: 'itr-1-vs-itr-2-vs-itr-3-vs-itr-4-which-form', category: 'Income Tax', tier: 'High Search Potential', relatedToolId: 'income-tax-fy-2026-27' },
  { no: 28, title: 'AIS vs TIS vs Form 26AS: Differences Explained', slug: 'ais-vs-tis-vs-form-26as-differences-explained', category: 'Income Tax', tier: 'High Search Potential', relatedToolId: 'form-26as-to-excel' },
  { no: 29, title: 'Advance Tax Calculation with Practical Examples (FY 2026–27)', slug: 'advance-tax-calculation-examples-fy-2026-27', category: 'Income Tax', tier: 'High Search Potential', relatedToolId: 'income-tax-fy-2026-27' },
  { no: 30, title: 'Section 234A, 234B and 234C: Income Tax Interest Explained', slug: 'section-234a-234b-234c-income-tax-interest', category: 'Income Tax', tier: 'High Search Potential' },
  { no: 31, title: 'Tax Audit Under Income Tax: Applicability and Important Rules', slug: 'tax-audit-applicability-turnover-rules-india', category: 'Income Tax', tier: 'High Search Potential' },
  { no: 32, title: 'Presumptive Taxation: Sections 44AD, 44ADA and 44AE Explained', slug: 'presumptive-taxation-44ad-44ada-44ae-guide', category: 'Income Tax', tier: 'High Search Potential' },
  { no: 33, title: 'Capital Gains Tax: Property, Shares and Mutual Funds', slug: 'capital-gains-tax-property-shares-mutual-funds', category: 'Income Tax', tier: 'High Search Potential' },
  { no: 34, title: 'TDS on Rent, Contractor and Professional Fees: Practical Guide', slug: 'tds-on-rent-contractor-professional-fees-guide', category: 'TDS & TCS', tier: 'High Search Potential', relatedToolId: 'tds-tcs-toolkit' },
  { no: 35, title: 'TDS Return Filing: Form 138 and Form 140 Explained', slug: 'tds-return-filing-form-138-and-form-140-explained', category: 'TDS & TCS', tier: 'High Search Potential', relatedToolId: 'tds-tcs-toolkit' },
  { no: 36, title: 'How to Download Form 16 and Form 16A from TRACES', slug: 'how-to-download-form-16-and-form-16a-traces', category: 'TDS & TCS', tier: 'High Search Potential' },
  { no: 37, title: 'TDS vs TCS: Complete Difference with Practical Examples', slug: 'tds-vs-tcs-complete-difference-examples', category: 'TDS & TCS', tier: 'High Search Potential', relatedToolId: 'tcs-tax-calculator' },
  { no: 38, title: 'Purchase Entry & Sales Entry with GST (CGST, SGST, IGST Examples)', slug: 'purchase-and-sales-journal-entries-with-gst', category: 'Accounting', tier: 'Evergreen SEO' },
  { no: 39, title: 'TDS & TCS Journal Entries: Deduction, Payment and Year-End Examples', slug: 'tds-and-tcs-journal-entries-accounting-examples', category: 'Accounting', tier: 'Evergreen SEO' },
  { no: 40, title: 'Salary Journal Entries with PF, ESI, PT and TDS', slug: 'salary-journal-entries-pf-esi-pt-tds', category: 'Accounting', tier: 'Evergreen SEO' },
  { no: 41, title: '25 Essential Excel Formulas Every Accountant Must Know', slug: '25-essential-excel-formulas-for-accountants', category: 'Excel Templates', tier: 'Evergreen SEO' },
  { no: 42, title: 'Excel VLOOKUP vs XLOOKUP for Accounting Reconciliations', slug: 'excel-vlookup-vs-xlookup-for-accountants', category: 'Excel Templates', tier: 'Evergreen SEO' },
  { no: 43, title: 'ROC Annual Filing Due Dates: AOC-4 vs MGT-7 & LLP Form 8/11', slug: 'roc-annual-filing-aoc-4-mgt-7-llp-form-8-11', category: 'ROC & MCA', tier: 'High Search Potential' },
  { no: 44, title: 'DIR-3 KYC, MSME Form 1 & DPT-3: Companies Act Compliance Calendar', slug: 'dir-3-kyc-msme-form-1-dpt-3-mca-compliance', category: 'ROC & MCA', tier: 'High Search Potential' },
  { no: 45, title: 'EPF ECR Filing & Gratuity Calculation: Step-by-Step Guide', slug: 'epf-ecr-filing-and-gratuity-calculation-guide', category: 'PF & ESI', tier: 'High Search Potential' },
  { no: 46, title: 'Private Limited Company vs LLP vs Proprietorship in India', slug: 'private-limited-company-vs-llp-vs-proprietorship', category: 'Business & Career', tier: 'High Search Potential' },
  { no: 47, title: 'Month-End & Year-End Closing Process for Finance Departments', slug: 'month-end-and-year-end-closing-checklist-finance', category: 'Accounting', tier: 'Evergreen SEO' },
];
