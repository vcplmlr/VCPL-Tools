import { BlogPostItem } from '../types/blog';

export const TDS_RATES_POST: BlogPostItem = {
  slug: 'tds-sections-and-rates-chart-fy-2026-27',
  title: 'Complete TDS Sections and Rates Chart for FY 2026–27 (Accountant Reference Guide)',
  seoTitle: 'Complete TDS Sections & Rates Chart FY 2026–27 | VCPL Tools Guide',
  excerpt:
    'Quick-reference TDS section chart, deduction rates, threshold limits, Income-tax Act 2025 Form 138/140/141 mappings, payment due dates, and practical accountant journal notes for FY 2026–27.',
  seoDescription:
    'Check complete TDS sections, rates, exemption thresholds, Income-tax Act 2025 form replacements (Form 138, 140, 141), and payment due dates for FY 2026–27 in India.',
  category: 'TDS & TCS',
  topicTags: ['Income Tax', 'Accounting'],
  coverImage: '/blog/tds-sections-and-rates-chart-fy-2026-27.svg',
  coverImageAlt:
    'Complete TDS Sections and Rates Chart FY 2026-27 reference banner showing Section 393, Forms 138 and 140, and deduction percentages',
  coverTheme: 'tax',
  coverBadge: 'TDS RATES FY 2026–27',
  publishedIso: '2026-11-23',
  publishedLabel: '23 Nov 2026',
  updatedIso: '2026-11-23',
  updatedLabel: '23 Nov 2026',
  readTime: '9 min read',
  authorId: 'kaushik-bangera',
  author: 'Kaushik Bangera',
  authorRole: 'Product Architecture & Compliance Workflows',
  keywords: [
    'Complete TDS sections and rates chart FY 2026-27',
    'TDS rates FY 2026-27 India',
    'Section 393 Income-tax Act 2025 TDS',
    'Form 138 Form 140 TDS statement',
    'TDS payment due dates 2026-27',
  ],
  relatedToolIds: ['tds-tcs-toolkit', 'form-26as-to-excel', 'tds-26as-tally-reco'],
  relatedSlugs: [
    'gst-itr-tds-due-dates-2026-27',
    'form-26as-tds-tcs-excel-reconciliation-guide',
  ],
  keyTakeaways: [
    'From 1 April 2026 (FY 2026–27), TDS provisions move under Section 393 of the Income-tax Act, 2025, with quarterly statements filed via Form 138 (Salary), Form 140 (Resident Non-Salary), and Form 141 (Challan-cum-Statement).',
    'Always compute TDS on the taxable invoice value excluding GST when GST is shown separately on the vendor bill.',
    'Check PAN validity and deduct 20% higher TDS where valid PAN is missing, then verify deductions using [TDS & TCS Toolkit (FY 2026-27)](#tool:tds-tcs-toolkit).',
  ],
  sections: [
    {
      id: 'tds-transition-2025-act',
      heading: '1. Understanding the Income-tax Act, 2025 TDS Framework for FY 2026–27',
      paragraphs: [
        'Every accounts payable and payroll team deducts Tax Deducted at Source (TDS) at the time of credit or payment—whichever is earlier—for contractor bills, professional retainers, rent, brokerage, interest, and property purchases. While FY 2025–26 returns (AY 2026–27) remain governed by the Income-tax Act, 1961, transactions occurring from 1 April 2026 onwards fall under the Income-tax Act, 2025 (with consolidated TDS rules under Section 393 and TCS under Section 394).',
        'Before generating vendor vouchers or payroll challans, verify exact deduction percentages and threshold rules inside our [TDS & TCS Toolkit (FY 2026-27)](#tool:tds-tcs-toolkit) and cross-check full compliance dates inside our [GST, ITR & TDS Due Dates 2026–27 Calendar](#blog:gst-itr-tds-due-dates-2026-27).',
      ],
      blocks: [
        {
          type: 'table',
          title: 'Key TDS & TCS Statement Form Mapping (FY 2026–27)',
          headers: ['Legacy Form (1961 Act)', 'New Form (2025 Act / Rules 2026)', 'Statement Scope'],
          rows: [
            ['Form 24Q', 'Form 138', 'Quarterly Salary TDS Statement'],
            ['Form 26Q', 'Form 140', 'Quarterly Resident Non-Salary TDS Statement'],
            ['Form 27EQ', 'Form 143', 'Quarterly TCS Collection Statement'],
            ['Forms 26QB / 26QC / 26QD / 26QE', 'Form 141', 'Property, Individual Rent & Specified Challan-cum-Statements'],
          ],
        },
      ],
    },
    {
      id: 'tds-sections-and-rates-reference-table',
      heading: '2. Quick-Reference TDS Sections & Deduction Rates (Resident Payments)',
      paragraphs: [
        'Accountants working on day-to-day Tally or ERP bill booking frequently refer to the standard domestic payment categories below. Note that actual Finance Act limits and threshold revisions notified for the relevant assessment year should always be confirmed on TRACES / Income Tax portals.',
      ],
      blocks: [
        {
          type: 'table',
          headers: ['Payment Nature', 'Traditional Ref.', 'Standard TDS Rate', 'Key Accountant Check'],
          rows: [
            ['Salary to Employees', 'Sec 192 (Act 2025: Sec 393)', 'Average Slab Rate', 'Obtain investment declaration & regime choice (Old vs New)'],
            ['Interest other than Securities (Banks / Others)', 'Sec 194A', '10%', 'Check higher threshold for banks / senior citizens vs ₹5,000/₹10,000 others'],
            ['Contractor / Sub-Contractor (Individual / HUF)', 'Sec 194C', '1%', 'Applies to single contract & aggregate annual contractor bills'],
            ['Contractor / Sub-Contractor (Company / Firm / LLP)', 'Sec 194C', '2%', 'Verify transport GTA PAN exemptions where declaration provided'],
            ['Commission or Brokerage', 'Sec 194H', '2% (reduced from 5%)', 'Verify revised Finance Act rate applicable for current period'],
            ['Rent of Plant, Machinery & Equipment', 'Sec 194I(a)', '2%', 'Confirm asset classification vs service contract'],
            ['Rent of Land, Building or Furniture', 'Sec 194I(b)', '10%', 'Exclude GST portion shown separately on tax invoice'],
            ['Purchase of Immovable Property', 'Sec 194-IA', '1%', 'Applicable where consideration / stamp duty ≥ ₹50 lakh; file Form 141'],
            ['Fees for Technical Services / Royalty / Call Centre', 'Sec 194J(a)', '2%', 'Distinguish technical support (2%) vs professional consultancy (10%)'],
            ['Professional Services (CA, Legal, Audit, Medical, Architecture)', 'Sec 194J(b)', '10%', 'Audit & consultancy retainers generally attract 10%'],
            ['Purchase of Goods (Buyer turnover > ₹10 Cr)', 'Sec 194Q', '0.1%', 'Applies on purchases exceeding ₹50 lakh from a single seller in FY'],
            ['Non-Furnishing of PAN / Inoperative PAN', 'Sec 206AA', '20% (or 5% for 194Q/194O)', 'Validate PAN status on Income Tax / TRACES before booking invoice'],
          ],
        },
        {
          type: 'callout',
          tone: 'warning',
          label: 'Statutory Verification Reminder',
          text: 'Thresholds (such as updated Finance Act interest, rent monthly vs annual ceilings, and commission caps) are subject to periodic budget amendments. Always validate active rates and deductor limits in TRACES / Income-tax Act, 2025 notifications before bulk voucher deduction.',
        },
      ],
    },
    {
      id: 'tds-calculation-and-gst-treatment',
      heading: '3. How Accountants Compute TDS on Vendor Invoices With GST',
      paragraphs: [
        'A common mistake among junior accounts executives is deducting TDS on the gross invoice total including CGST, SGST, or IGST. Under CBDT circular guidelines, when the GST component is separately indicated on the invoice, TDS is deducted solely on the basic taxable value excluding GST.',
      ],
      blocks: [
        {
          type: 'bullets',
          title: 'Worked Example — Professional Audit Bill (10% TDS + 18% GST):',
          items: [
            'Basic Audit Fee (Taxable Value): ₹50,000',
            'Add IGST @ 18%: ₹9,000 → Gross Invoice Total: ₹59,000',
            'TDS Deduction @ 10% on ₹50,000 (excluding GST): ₹5,000',
            'Net Payable to Consultant Bank Account: ₹59,000 − ₹5,000 = ₹54,000',
          ],
        },
      ],
      proTip:
        'After quarterly TRACES filings, export Form 26AS PDFs and split Part A (TDS) and Part B (TCS) instantly with [PDF to Excel Convertor Form 26AS](#tool:form-26as-to-excel) and match books inside [26AS ⇄ Tally Reco](#tool:tds-26as-tally-reco).',
    },
    {
      id: 'tds-due-dates-and-late-fees',
      heading: '4. Monthly Payment, Quarterly Return & Late Penalty Summary',
      paragraphs: [
        'Keep monthly challan deposits and quarterly statement due dates tight to avoid non-deduction or late-payment interest:',
      ],
      blocks: [
        {
          type: 'table',
          headers: ['Compliance Event', 'Due Date', 'Consequence of Delay'],
          rows: [
            ['Monthly TDS Payment (Apr–Feb)', '7th of Next Month', 'Interest @ 1.5% per month or part of month once deducted'],
            ['March Month TDS Payment (Non-Govt)', '30 April', 'Interest @ 1.5% per month from date of deduction'],
            ['Quarterly TDS Return (Q1–Q4)', '31 Jul, 31 Oct, 31 Jan, 31 May', 'Late filing fee ₹200/day capped at TDS amount'],
            ['TDS Not Deducted at Credit/Payment', 'At Invoice / Payment', 'Interest @ 1% per month + potential 30% expense disallowance'],
          ],
        },
      ],
    },
  ],
  faqs: [
    {
      question: 'Is TDS calculated on the GST amount included in a vendor invoice?',
      answer:
        'No. Wherever GST is separately mentioned on the invoice, TDS must be calculated strictly on the taxable value excluding GST.',
    },
    {
      question: 'Which TDS forms replace Form 24Q and Form 26Q in FY 2026–27?',
      answer:
        'Under the Income-tax Act, 2025 and Income-tax Rules, 2026, Form 138 replaces Form 24Q (Salary TDS) and Form 140 replaces Form 26Q (Resident Non-Salary TDS).',
    },
    {
      question: 'What is the difference between 2% and 10% under technical vs professional fees?',
      answer:
        'Fees for technical services, royalty, and call-centre operations generally attract 2% TDS, whereas independent professional consultancy services (CA, legal, medical, engineering, architecture) attract 10% TDS.',
    },
    {
      question: 'When is TDS deducted—on invoice booking date or bank payment date?',
      answer:
        'TDS is deductible on the date of credit to the vendor/expense account OR actual payment—whichever event occurs earlier.',
    },
    {
      question: 'What happens if a vendor fails to submit a valid PAN?',
      answer:
        'Under higher-TDS rules (legacy Section 206AA), the deductor must deduct TDS at 20% (or the statutory rate, whichever is higher; 5% in specified e-commerce/goods purchase cases).',
    },
  ],
  disclaimer:
    'Rates and section mappings are summarized for general accountant reference as of 23 November 2026. Statutory thresholds, section numbering under the Income-tax Act, 2025, and Finance Act amendments should always be confirmed against official TRACES / Income Tax Department notifications prior to tax deduction or challan deposit.',
};
