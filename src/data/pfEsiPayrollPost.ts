import { BlogPostItem } from '../types/blog.ts';

export const PF_ESI_PAYROLL_POST: BlogPostItem = {
  slug: 'pf-esi-and-karnataka-professional-tax-compliance-guide',
  title: 'PF, ESI & Karnataka Professional Tax: Complete Monthly Payroll Compliance Guide',
  seoTitle: 'PF, ESI & Karnataka Professional Tax Guide: Rates, Due Dates & Calculation | VCPL Tools',
  excerpt:
    'Complete HR & accountant handbook covering EPF 12% employee/employer EPF-EPS split, ESIC 0.75% + 3.25% rules, Karnataka Professional Tax slabs, CTC vs Net Salary, and monthly ECR due dates.',
  seoDescription:
    'Master monthly Indian payroll compliance: EPF & EPS contribution breakdown, ESIC ₹21,000 ceiling & 0.75%/3.25% rates, Karnataka Professional Tax due dates, and CTC salary structure.',
  category: 'PF & ESI',
  topicTags: ['Accounting', 'Business & Career'],
  coverImage: '/blog/pf-esi-and-karnataka-professional-tax-compliance-guide.svg',
  coverImageAlt:
    'VCPL Tools Payroll Compliance guide visual illustrating EPF 12%, ESIC 3.25%, and Karnataka Professional Tax monthly filing deadlines',
  coverTheme: 'payroll',
  coverBadge: 'PF · ESI · PAYROLL',
  publishedIso: '2026-11-23',
  publishedLabel: '23 Nov 2026',
  updatedIso: '2026-11-23',
  updatedLabel: '23 Nov 2026',
  readTime: '8 min read',
  authorId: 'kaushik-bangera',
  author: 'Kaushik Bangera',
  authorRole: 'Senior Accounting, Taxation & Compliance Practitioner',
  keywords: [
    'PF calculation employee employer contribution',
    'ESI calculation eligibility rates due dates',
    'Karnataka Professional Tax slabs due date',
    'EPF ECR filing monthly due date 15th',
    'CTC vs Gross Salary vs Net Salary',
  ],
  relatedToolIds: ['income-tax-fy-2026-27', 'tds-tcs-toolkit', 'covering-letter-generator'],
  relatedSlugs: [
    'gst-itr-tds-due-dates-2026-27',
    'tds-sections-and-rates-chart-fy-2026-27',
  ],
  keyTakeaways: [
    'Employee EPF contribution is 12% of PF wages (Basic + DA), while the employer 12% splits into 8.33% EPS (capped at ₹15,000 wage ceiling = ₹1,250/month) and the balance 3.67%+ into EPF, plus EDLI & Admin charges.',
    'ESIC applies to eligible establishments for employees earning gross wages up to ₹21,000/month (₹25,000 for PwD) at 0.75% employee + 3.25% employer.',
    'Both EPF monthly ECR challan and ESIC monthly contribution are due by the 15th of the next month, while Karnataka Professional Tax (PT) monthly returns are generally due by the 20th.',
  ],
  sections: [
    {
      id: 'monthly-payroll-due-dates-table',
      heading: '1. Monthly Payroll Statutory Due Dates Calendar (PF, ESI, PT & Salary TDS)',
      paragraphs: [
        'Finance teams and HR payroll executives must align salary disbursement with four separate statutory portals—EPFO Unified Portal, ESIC Portal, State Commercial Tax / Professional Tax Portal, and TRACES/Income Tax Challan 281.',
        'Coordinate payroll deductions cleanly alongside [TDS & TCS Toolkit (FY 2026-27)](#tool:tds-tcs-toolkit) and [Income Tax Calculator FY 2026–27](#tool:income-tax-fy-2026-27).',
      ],
      blocks: [
        {
          type: 'table',
          headers: ['Payroll Compliance', 'Portal', 'Monthly Due Date', 'Key Rule'],
          rows: [
            ['Salary TDS Payment (Challan)', 'Income Tax e-Filing', '7th of Next Month', '30 April for March month deductions (non-govt)'],
            ['EPF ECR Upload & Payment', 'EPFO Unified Portal', '15th of Next Month', 'Mandatory UAN KYC & Aadhar-seeded verification'],
            ['ESIC Contribution Payment', 'ESIC Employer Portal', '15th of Next Month', 'Covers eligible staff with gross wages ≤ ₹21,000'],
            ['Karnataka Professional Tax (PT)', 'e-Prerana / Kar Commercial Tax', '20th of Next Month', 'Check state exemption threshold & ₹200/₹300 rules'],
          ],
        },
      ],
    },
    {
      id: 'epf-contribution-breakdown',
      heading: '2. EPF Contribution Breakdown: Employee vs Employer (EPF, EPS & EDLI)',
      paragraphs: [
        'Under the Employees\' Provident Funds and Miscellaneous Provisions Act, establishments employing 20 or more employees generally register for EPF. Standard PF calculation uses Basic Pay + Dearness Allowance (up to the ₹15,000 statutory wage ceiling, or actual wages if opted voluntarily).',
      ],
      blocks: [
        {
          type: 'table',
          title: 'Standard 12% EPF Split (Non-Exempt Establishment)',
          headers: ['Account / Head', 'Employee Share', 'Employer Share', 'Remarks'],
          rows: [
            ['A/c No. 1 — EPF Account', '12.00%', '3.67% (plus excess above EPS cap)', 'Goes to employee PF retirement balance'],
            ['A/c No. 10 — EPS Pension', '—', '8.33% (max ₹1,250 on ₹15,000 cap)', 'Restricted to statutory ₹15,000 ceiling'],
            ['A/c No. 2 — EPF Admin Charges', '—', '0.50%', 'Employer administrative expense'],
            ['A/c No. 21 — EDLI Insurance', '—', '0.50%', 'Employees Deposit Linked Insurance'],
            ['Total Employer Outflow', '12.00%', '13.00% Total', 'Employer EDLI/Admin excluded from employee take-home'],
          ],
        },
      ],
    },
    {
      id: 'esic-eligibility-and-rates',
      heading: '3. ESIC Contribution Rates, ₹21,000 Ceiling & Contribution Periods',
      paragraphs: [
        'Employees\' State Insurance (ESIC) provides medical, sickness, maternity, and disability benefits to covered employees in factories and notified commercial establishments (typically 10+ employees depending on state notification).',
      ],
      blocks: [
        {
          type: 'bullets',
          items: [
            '**Wage Eligibility Ceiling:** Monthly gross salary up to ₹21,000 (₹25,000 for persons with disability). If an employee crosses ₹21,000 mid-contribution period (Apr–Sep or Oct–Mar), ESIC continues until the end of that 6-month contribution block.',
            '**Employee Contribution:** 0.75% of gross monthly wages (rounded up to next rupee).',
            '**Employer Contribution:** 3.25% of gross monthly wages.',
            '**Due Date:** Monthly challan filing and online payment by the 15th of the succeeding month.',
          ],
        },
      ],
    },
    {
      id: 'karnataka-professional-tax-and-ctc',
      heading: '4. Karnataka Professional Tax & Understanding CTC vs Gross vs Net Salary',
      paragraphs: [
        'Headquartered in Mangalore, Coastal Karnataka, VCPL teams routinely handle Karnataka Professional Tax (PT) deductions alongside EPF/ESIC. In Karnataka, registered employers (PTRC) deduct monthly PT from eligible employees earning threshold salary (currently ₹25,000+ monthly salary attracting ₹200/month under Karnataka PT amendments, subject to latest Gazette updates) and remit by the 20th of the following month.',
        'Accountants preparing salary sheets should keep three salary figures clearly distinct to avoid employee confusion and accounting reconciliation errors:',
      ],
      blocks: [
        {
          type: 'table',
          title: 'Salary Example: CTC vs Gross vs Net Take-Home (Illustration on ₹30,000 Basic / ₹42,000 Gross)',
          headers: ['Salary Component', 'Monthly (₹)', 'Treatment in Payroll Ledger'],
          rows: [
            ['Gross Salary (Basic + HRA + Allowances)', '₹42,000', 'Debited to Salary & Wages Expense'],
            ['Employer EPF + Admin (on ₹15,000 cap)', '₹1,950', 'Part of CTC; Credited to EPF Payable (not Gross)'],
            ['Total Cost to Company (CTC)', '₹43,950', 'Gross Salary + Employer Statutory Benefits'],
            ['Less: Employee EPF @ 12% (on ₹15,000 cap)', '(₹1,800)', 'Credited to EPF Payable Liability'],
            ['Less: Karnataka Professional Tax', '(₹200)', 'Credited to PT Payable Liability'],
            ['Net Take-Home Bank Transfer', '₹40,000', 'Credited to Bank / Salary Payable (subject to TDS if taxable)'],
          ],
        },
      ],
      proTip:
        'Check annual salary tax liability under the New vs Old Regime directly inside [Income Tax Calculator FY 2026–27](#tool:income-tax-fy-2026-27) before finalizing monthly Form 138 Salary TDS deductions.',
    },
  ],
  faqs: [
    {
      question: 'What is the monthly due date for EPF ECR and ESIC challan payments?',
      answer:
        'Both EPF monthly ECR filing/payment and ESIC monthly contribution payment are due by the 15th of the succeeding month.',
    },
    {
      question: 'Why is Employer EPS restricted to ₹1,250/month?',
      answer:
        '8.33% pension contribution (EPS) is calculated up to the statutory ₹15,000 PF wage ceiling (8.33% × ₹15,000 = ₹1,250). Any remaining employer share above ₹1,250 shifts into EPF Account No. 1.',
    },
    {
      question: 'What happens if an ESIC-covered employee gets a salary increment above ₹21,000?',
      answer:
        'ESIC deduction continues until the ongoing 6-month contribution period (April–September or October–March) ends, and stops from the start of the next contribution cycle.',
    },
    {
      question: 'When is Karnataka Professional Tax (PTRC) monthly return due?',
      answer:
        'Monthly Professional Tax statement and payment in Karnataka are due by the 20th of the following month.',
    },
    {
      question: 'Is Employer PF included in Gross Salary or CTC?',
      answer:
        'Employer PF/ESIC is included in Cost to Company (CTC), NOT in Gross Salary or Net Take-Home Pay.',
    },
  ],
  disclaimer:
    'EPF, ESIC, and State Professional Tax wage ceilings and exemption slabs are subject to Central Government and State Gazette notifications. Always verify active contribution parameters on EPFO, ESIC, and respective State Commercial Tax portals.',
};
