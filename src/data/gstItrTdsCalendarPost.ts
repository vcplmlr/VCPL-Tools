import { BlogPostItem } from '../types/blog.ts';

export const GST_ITR_TDS_CALENDAR_POST: BlogPostItem = {
  slug: 'gst-itr-tds-due-dates-2026-27',
  title: 'GST, ITR & TDS Due Dates 2026–27: Complete Tax Compliance Calendar for Accountants in India',
  seoTitle: 'GST, ITR & TDS Due Dates 2026–27: Complete Tax Compliance Calendar for Accountants in India',
  excerpt:
    'Complete monthly and quarterly Indian tax compliance calendar for FY 2026–27 and AY 2026–27—covering GSTR-1, GSTR-3B, QRMP PMT-06, ITR deadlines, Income-tax Act 2025 TDS/TCS forms, advance tax, penalties & checklists.',
  seoDescription:
    'Check all GST, ITR, TDS and TCS due dates for FY 2026–27 in India. Complete monthly and quarterly tax compliance calendar, return deadlines, penalties and important accountant reminders, updated November 2026.',
  category: 'GST',
  topicTags: ['Income Tax', 'TDS & TCS'],
  coverImage: '/blog/gst-itr-tds-due-dates-2026-27.svg',
  coverImageAlt:
    'GST, ITR and TDS Due Dates 2026-27 Complete Tax Compliance Calendar for Indian Accountants by VCPL Tools',
  coverTheme: 'calendar',
  coverBadge: 'FY 2026–27 TAX CALENDAR',
  publishedIso: '2026-11-23',
  publishedLabel: '23 Nov 2026',
  updatedIso: '2026-11-23',
  updatedLabel: '23 Nov 2026',
  readTime: '14 min read',
  authorId: 'kaushik-bangera',
  author: 'Kaushik Bangera',
  authorRole: 'Product Architecture & Compliance Workflows',
  keywords: [
    'GST ITR TDS due dates 2026–27',
    'GST return filing due dates 2026',
    'Income tax return due date AY 2026–27',
    'TDS payment due dates 2026–27',
    'TDS return filing calendar',
    'GSTR-1 and GSTR-3B due dates',
    'Accountant compliance calendar India',
    'GST annual return due date 2026',
    'Advance tax due dates FY 2026–27',
    'Monthly tax compliance calendar India',
    'GST late fees and TDS penalties',
  ],
  relatedToolIds: [
    'gstr1-return-prep',
    'gstr2b-tally-reconciler',
    'form-26as-to-excel',
    'tds-26as-tally-reco',
    'tds-tcs-toolkit',
    'income-tax-fy-2026-27',
  ],
  relatedSlugs: [
    'form-26as-tds-tcs-excel-reconciliation-guide',
    'gstr-1-return-prep-and-gstr2b-tally-itc-matching',
  ],
  keyTakeaways: [
    'Income earned in FY 2025–26 is still assessed under the Income-tax Act, 1961 for AY 2026–27 (belated ITR deadline: 31 December 2026), while FY 2026–27 transactions from 1 April 2026 follow the Income-tax Act, 2025.',
    'New FY 2026–27 TDS/TCS statements replace Forms 24Q, 26Q, 27EQ, and 26QB–QE with Form 138, Form 140, Form 143, and Form 141 under Income-tax Rules, 2026.',
    'Prioritize 25 Nov PMT-06, 30 Nov Transfer Pricing ITR, 15 Dec Advance Tax (75%), and 31 Dec GSTR-9 / GSTR-9C / Belated ITR deadlines before year-end.',
    'Prepare error-free filings locally in your browser with [GSTR-1 Return Prep](#tool:gstr1-return-prep), [GSTR-2B vs Tally Reconciler](#tool:gstr2b-tally-reconciler), and [PDF to Excel Convertor Form 26AS](#tool:form-26as-to-excel).',
  ],
  sections: [
    {
      id: 'overview-and-tax-act-transition',
      heading: 'Overview: Managing FY 2026–27 Statutory Compliance & Income-tax Act Transition',
      paragraphs: [
        'Tax compliance is one of the most important responsibilities of accountants, tax consultants, Chartered Accountants and finance professionals in India. Businesses must regularly comply with GST returns, income tax return filing, TDS/TCS payments, advance tax instalments and various other statutory requirements.',
        'Missing a statutory due date can result in late fees, interest, penalties, loss of eligible tax credits and unnecessary notices from government departments. With the introduction of the Income-tax Act, 2025, effective from 1 April 2026, tax professionals also need to understand the transition between the Income-tax Act, 1961 and the new Income-tax Act, 2025.',
        'This comprehensive guide covers the important GST, ITR, TDS and TCS due dates for FY 2026–27, along with pending deadlines for FY 2025–26, monthly and quarterly compliance requirements, applicable penalties and practical accounting checklists. Whether you maintain accounts for a private limited company, partnership firm, proprietorship, LLP or individual taxpayer, pair this calendar with our offline [Tax & GST Reconciliation Suite](#tool:gstr2b-tally-reconciler) and [Income Tax Calculator FY 2026–27](#tool:income-tax-fy-2026-27) to stay compliant.',
      ],
    },
    {
      id: 'tax-due-dates-at-a-glance',
      heading: '1. Important Tax Compliance Due Dates at a Glance',
      paragraphs: [
        'The following are the major recurring statutory deadlines every accountant should monitor.',
      ],
      blocks: [
        {
          type: 'table',
          headers: ['Compliance', 'Normal due date'],
          rows: [
            ['GSTR-1 – Monthly', '11th of next month'],
            ['GSTR-3B – Monthly', '20th of next month'],
            ['GSTR-1 – QRMP', '13th after quarter'],
            ['GSTR-3B – QRMP', '22nd or 24th after quarter'],
            ['PMT-06 – QRMP', '25th of next month'],
            ['GSTR-7 – GST TDS', '10th of next month'],
            ['GSTR-8 – GST TCS', '10th of next month'],
            ['GSTR-6 – ISD', '13th of next month'],
            ['GSTR-5 – Non-resident taxable person', '13th of next month'],
            ['TDS payment', '7th of next month'],
            ['March TDS payment', '30 April for non-government deductors'],
            ['Quarterly TDS statement', '31 July, 31 October, 31 January, 31 May'],
            ['Quarterly TCS statement', '31 July, 31 October, 31 January, 31 May'],
            ['Advance tax', '15 June, 15 September, 15 December, 15 March'],
            ['GSTR-9', '31 December following FY'],
            ['GSTR-9C', '31 December following FY, where applicable'],
            ['GSTR-4', '30 June following FY'],
          ],
        },
        {
          type: 'callout',
          tone: 'warning',
          label: 'Important Reminder',
          text: 'These are normal statutory dates, not a guarantee that a particular deadline has not been extended. Always check the latest government notification and the applicable return period.',
        },
      ],
    },
    {
      id: 'gst-return-due-dates-fy-2026-27',
      heading: '2. GST Return Filing Due Dates for FY 2026–27',
      paragraphs: [
        'Goods and Services Tax (GST) compliance is a regular responsibility for registered businesses. Accountants must reconcile sales, purchases, input tax credit, reverse charge mechanism, electronic cash ledger and electronic credit ledger before filing returns.',
        'The applicable GST return depends on the taxpayer\'s registration category, turnover, filing frequency and business activity.',
      ],
      subsections: [
        {
          id: 'gstr-1-monthly-due-dates',
          heading: '2.1 GSTR-1 Due Dates – Monthly Filing',
          paragraphs: [
            'GSTR-1 is a statement of outward supplies containing details of sales invoices, debit notes, credit notes, exports and other applicable outward transactions. It is generally filed by regular taxpayers filing monthly returns.',
            '**Normal due date: 11th of the following month.** Prepare and validate B2B, B2CS, CDNR, and HSN Table 12 totals upfront using [GSTR-1 Return Prep](#tool:gstr1-return-prep).',
          ],
          blocks: [
            {
              type: 'table',
              headers: ['Tax period', 'GSTR-1 due date'],
              rows: [
                ['April 2026', '11 May 2026'],
                ['May 2026', '11 June 2026'],
                ['June 2026', '11 July 2026'],
                ['July 2026', '11 August 2026'],
                ['August 2026', '11 September 2026'],
                ['September 2026', '11 October 2026'],
                ['October 2026', '11 November 2026'],
                ['November 2026', '11 December 2026'],
                ['December 2026', '11 January 2027'],
                ['January 2027', '11 February 2027'],
                ['February 2027', '11 March 2027'],
                ['March 2027', '11 April 2027'],
              ],
            },
            {
              type: 'bullets',
              title: "Accountant's checklist before filing GSTR-1:",
              items: [
                'Verify sales invoices and invoice numbering.',
                'Check B2B and B2C transactions.',
                'Verify GSTIN of customers.',
                'Reconcile debit notes and credit notes.',
                'Check export and SEZ transactions.',
                'Verify applicable HSN-wise summary.',
                'Check amendments to previous-period invoices.',
                'Verify e-invoice and e-way bill records wherever applicable.',
                'Reconcile sales with accounting software.',
              ],
            },
          ],
        },
        {
          id: 'gstr-3b-monthly-due-dates',
          heading: '2.2 GSTR-3B Due Dates – Monthly Filing',
          paragraphs: [
            'GSTR-3B is a summary GST return used to declare tax liability, eligible ITC, reversals, interest and late fees. Regular monthly taxpayers generally file GSTR-3B by the 20th of the succeeding month.',
          ],
          blocks: [
            {
              type: 'table',
              headers: ['Tax period', 'GSTR-3B due date'],
              rows: [
                ['April 2026', '20 May 2026'],
                ['May 2026', '20 June 2026'],
                ['June 2026', '20 July 2026'],
                ['July 2026', '20 August 2026'],
                ['August 2026', '20 September 2026'],
                ['September 2026', '20 October 2026'],
                ['October 2026', '20 November 2026'],
                ['November 2026', '20 December 2026'],
                ['December 2026', '20 January 2027'],
                ['January 2027', '20 February 2027'],
                ['February 2027', '20 March 2027'],
                ['March 2027', '20 April 2027'],
              ],
            },
            {
              type: 'ordered',
              title: 'Important accountant responsibilities:',
              items: [
                'Reconcile GSTR-1 with books of accounts.',
                'Reconcile purchase register with GSTR-2B (run instant matching in [GSTR-2B vs Tally Reconciler](#tool:gstr2b-tally-reconciler)).',
                'Identify eligible and ineligible ITC.',
                'Verify reverse charge liabilities.',
                'Check ITC reversals and reclaims.',
                'Reconcile electronic credit and cash ledgers.',
                'Verify tax liability under CGST, SGST, IGST and cess.',
                'Pay applicable interest and late fees.',
                'File the return and download the acknowledgement.',
              ],
            },
            {
              type: 'paragraph',
              text: 'GSTR-3B generally cannot be revised after filing, so proper verification before submission is essential.',
            },
          ],
        },
        {
          id: 'qrmp-scheme-quarterly-gst',
          heading: '2.3 QRMP Scheme – Quarterly GST Returns',
          paragraphs: [
            'The Quarterly Return Monthly Payment (QRMP) scheme is available to eligible regular taxpayers with aggregate annual turnover up to ₹5 crore, subject to the prescribed conditions.',
          ],
          blocks: [
            {
              type: 'bullets',
              title: 'Under QRMP:',
              items: [
                'GSTR-1 is filed quarterly.',
                'GSTR-3B is filed quarterly.',
                'GST payment is made monthly through Form PMT-06 for the first two months of the quarter.',
                'IFF can be used for furnishing eligible B2B invoice details during the first two months.',
              ],
            },
            {
              type: 'table',
              title: 'GSTR-1 quarterly due dates',
              headers: ['Quarter', 'Period', 'Due date'],
              rows: [
                ['Q1', 'April–June 2026', '13 July 2026'],
                ['Q2', 'July–September 2026', '13 October 2026'],
                ['Q3', 'October–December 2026', '13 January 2027'],
                ['Q4', 'January–March 2027', '13 April 2027'],
              ],
            },
            {
              type: 'table',
              title: 'GSTR-3B quarterly due dates',
              headers: ['Quarter', 'Period', 'Due date'],
              rows: [
                ['Q1', 'April–June 2026', '22 or 24 July 2026'],
                ['Q2', 'July–September 2026', '22 or 24 October 2026'],
                ['Q3', 'October–December 2026', '22 or 24 January 2027'],
                ['Q4', 'January–March 2027', '22 or 24 April 2027'],
              ],
            },
            {
              type: 'paragraph',
              text: 'The 22nd and 24th dates depend on the state or Union Territory grouping prescribed for QRMP taxpayers.',
            },
            {
              type: 'table',
              title: 'PMT-06 monthly payment schedule',
              headers: ['Month', 'Tax payment due date'],
              rows: [
                ['April 2026', '25 May 2026'],
                ['May 2026', '25 June 2026'],
                ['July 2026', '25 August 2026'],
                ['August 2026', '25 September 2026'],
                ['October 2026', '25 November 2026'],
                ['November 2026', '25 December 2026'],
                ['January 2027', '25 February 2027'],
                ['February 2027', '25 March 2027'],
              ],
            },
            {
              type: 'paragraph',
              text: 'The third month of each quarter is generally covered through the quarterly GSTR-3B payment rather than a separate PMT-06 payment.',
            },
          ],
        },
        {
          id: 'other-important-gst-returns',
          heading: '2.4 Other Important GST Return Due Dates',
          paragraphs: [
            'Apart from GSTR-1 and GSTR-3B, accountants should monitor the following GST forms.',
          ],
          blocks: [
            {
              type: 'table',
              headers: ['GST Form', 'Purpose', 'Normal due date'],
              rows: [
                ['GSTR-5', 'Non-resident taxable persons', '13th of next month'],
                ['GSTR-5A', 'OIDAR service providers', '20th of next month'],
                ['GSTR-6', 'Input Service Distributor', '13th of next month'],
                ['GSTR-7', 'GST TDS return', '10th of next month'],
                ['GSTR-8', 'GST TCS return', '10th of next month'],
                ['CMP-08', 'Composition tax payment statement', '18th after quarter'],
                ['GSTR-4', 'Composition annual return', '30 June following FY'],
                ['ITC-04', 'Job work details', 'Periodically, as applicable'],
                ['GSTR-9', 'Annual GST return', '31 December following FY'],
                ['GSTR-9C', 'Reconciliation statement', '31 December following FY, where applicable'],
              ],
            },
            {
              type: 'paragraph',
              text: 'GSTR-5 and GSTR-5A have specific applicability and special rules. Taxpayers should verify their actual filing period and statutory provisions before applying the normal dates.',
            },
          ],
        },
        {
          id: 'gst-annual-return-fy-2025-26',
          heading: '2.5 GST Annual Return Due Dates – FY 2025–26',
          paragraphs: [
            'The annual GST return is an important year-end compliance requirement.',
          ],
          blocks: [
            {
              type: 'table',
              headers: ['Form', 'Applicability', 'Due date'],
              rows: [
                [
                  'GSTR-9',
                  'Applicable regular taxpayers, generally those exceeding ₹2 crore aggregate turnover',
                  '31 December 2026',
                ],
                [
                  'GSTR-9C',
                  'Taxpayers with aggregate turnover exceeding ₹5 crore',
                  '31 December 2026',
                ],
                ['GSTR-4', 'Composition taxpayers', '30 June 2026'],
              ],
            },
            {
              type: 'paragraph',
              text: 'For FY 2025–26, accountants should begin preparing annual GST reconciliation well before December. You can review our [GSTR-1 & GSTR-2B Tally ITC Matching Walkthrough](#blog:gstr-1-return-prep-and-gstr2b-tally-itc-matching) to streamline multi-month reconciliations.',
            },
            {
              type: 'bullets',
              title: 'Important reconciliation areas include:',
              items: [
                'Turnover as per financial statements versus GSTR-1.',
                'Tax liability as per books versus GSTR-3B.',
                'ITC claimed versus GSTR-2B.',
                'ITC reversals and ineligible credits.',
                'Reverse charge liability.',
                'Credit notes and debit notes.',
                'Advances and adjustments.',
                'Exempt, nil-rated and non-GST supplies.',
                'Differences in tax payments.',
                'HSN summary and other annual return disclosures.',
              ],
            },
            {
              type: 'paragraph',
              text: 'GSTR-9 and GSTR-9C applicability must be checked against the relevant exemptions and notifications.',
            },
          ],
        },
      ],
    },
    {
      id: 'itr-due-dates-ay-2026-27',
      heading: '3. Income Tax Return (ITR) Due Dates for AY 2026–27',
      paragraphs: [
        'Income tax return filing is another major statutory responsibility. For income earned during FY 2025–26, taxpayers must file their returns under the Income-tax Act, 1961, selecting Assessment Year 2026–27.',
        'The Income-tax Act, 2025 became effective from 1 April 2026. However, it does not mean that income earned during FY 2025–26 must be reported under the new Act. When estimating tax slabs and liabilities for FY 2026–27 under the updated regime, use [Income Tax Calculator FY 2026–27](#tool:income-tax-fy-2026-27).',
      ],
      subsections: [
        {
          id: 'itr-original-due-dates-ay-2026-27',
          heading: '3.1 ITR Filing Due Dates – AY 2026–27',
          paragraphs: [],
          blocks: [
            {
              type: 'table',
              headers: ['Taxpayer category', 'Original due date'],
              rows: [
                ['Individuals not requiring tax audit – ITR-1 and ITR-2', '31 July 2026'],
                ['Non-audit business/professional cases and applicable trusts', '31 August 2026'],
                ['Tax audit cases', '31 October 2026, subsequently extended to 21 November 2026'],
                ['Transfer pricing cases requiring Form 3CEB', '30 November 2026'],
              ],
            },
            {
              type: 'callout',
              tone: 'info',
              label: 'Important CBDT extension',
              text: 'Through Circular No. 07/2026 dated 28 September 2026, CBDT extended the ITR filing due date for specified audit cases from 31 October 2026 to 21 November 2026. The corresponding tax audit report deadline for those cases was extended from 30 September 2026 to 21 October 2026. As of 23 November 2026, these extended deadlines have passed.',
            },
          ],
        },
        {
          id: 'belated-itr-ay-2026-27',
          heading: '3.2 Belated ITR Filing Due Date – AY 2026–27',
          paragraphs: [
            'Taxpayers who missed the original return filing deadline may still be eligible to file a belated return.',
            '**Last date: 31 December 2026**, or completion of assessment, whichever is earlier.',
          ],
          bullets: [
            '₹1,000 where total income does not exceed ₹5 lakh (under Section 234F of the Income-tax Act, 1961).',
            '₹5,000 in other cases. Additional interest may apply depending on the taxpayer\'s tax liability and circumstances.',
          ],
        },
        {
          id: 'revised-itr-ay-2026-27',
          heading: '3.3 Revised ITR Due Date – AY 2026–27',
          paragraphs: [
            'If an individual or business discovers mistakes or omissions in an already-filed return, a revised return may be filed under Section 139(5) of the Income-tax Act, 1961.',
            'For AY 2026–27, the applicable revised return deadline is generally before 31 March 2027 or completion of assessment, whichever is earlier, subject to the applicable amended provisions. Accountants should verify the latest statutory position before filing.',
          ],
        },
        {
          id: 'itr-forms-applicability',
          heading: '3.4 ITR Forms and Their Applicability',
          paragraphs: [
            'The applicable form should always be selected based on the taxpayer\'s actual income sources, eligibility and statutory conditions:',
          ],
          blocks: [
            {
              type: 'table',
              headers: ['ITR Form', 'General applicability'],
              rows: [
                ['ITR-1', 'Eligible resident individuals with specified income'],
                ['ITR-2', 'Individuals and HUFs without business/professional income'],
                ['ITR-3', 'Individuals and HUFs having business/professional income'],
                ['ITR-4', 'Eligible presumptive taxation taxpayers'],
                ['ITR-5', 'Firms, LLPs, AOPs, BOIs and specified entities'],
                ['ITR-6', 'Companies other than companies claiming exemption under Section 11'],
                ['ITR-7', 'Specified trusts, institutions and other eligible entities'],
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'tds-payment-due-dates-fy-2026-27',
      heading: '4. TDS Payment Due Dates for FY 2026–27',
      paragraphs: [
        'Tax Deducted at Source (TDS) is a mandatory tax collection mechanism under which specified persons deduct tax while making or crediting certain payments—such as salary payments, contractor payments, professional fees, commission and brokerage, rent, interest payments and other specified transactions.',
        'The deductor must deposit the deducted amount within the prescribed period and file the applicable TDS statement. Verify deduction rates and threshold limits quickly with [TDS & TCS Toolkit (FY 2026-27)](#tool:tds-tcs-toolkit).',
      ],
      subsections: [
        {
          id: 'monthly-tds-payment-calendar',
          heading: '4.1 Monthly TDS Payment Calendar',
          paragraphs: [
            'For non-government deductors, the general due date is the 7th day of the succeeding month.',
          ],
          blocks: [
            {
              type: 'table',
              headers: ['Month of deduction', 'TDS payment due date'],
              rows: [
                ['April 2026', '7 May 2026'],
                ['May 2026', '7 June 2026'],
                ['June 2026', '7 July 2026'],
                ['July 2026', '7 August 2026'],
                ['August 2026', '7 September 2026'],
                ['September 2026', '7 October 2026'],
                ['October 2026', '7 November 2026'],
                ['November 2026', '7 December 2026'],
                ['December 2026', '7 January 2027'],
                ['January 2027', '7 February 2027'],
                ['February 2027', '7 March 2027'],
                ['March 2027', '30 April 2027'],
              ],
            },
            {
              type: 'ordered',
              title: 'Special cases:',
              items: [
                'Government deductors depositing tax without production of a challan generally deposit it on the same day.',
                'March TDS for non-government deductors is generally payable by 30 April.',
                'Specified challan-cum-statement transactions have their own filing and payment timelines.',
              ],
            },
          ],
        },
        {
          id: 'quarterly-tds-return-filing',
          heading: '4.2 Quarterly TDS Return Filing Due Dates',
          paragraphs: [
            'Quarterly TDS statements are important for reporting deductions made during the relevant quarter. For FY 2026–27, the general filing schedule is:',
          ],
          blocks: [
            {
              type: 'table',
              headers: ['Quarter', 'Period', 'Due date'],
              rows: [
                ['Q1', 'April–June 2026', '31 July 2026'],
                ['Q2', 'July–September 2026', '31 October 2026'],
                ['Q3', 'October–December 2026', '31 January 2027'],
                ['Q4', 'January–March 2027', '31 May 2027'],
              ],
            },
          ],
        },
        {
          id: 'new-tds-form-numbers-2025-act',
          heading: '4.3 New TDS Form Numbers Under the Income-tax Act, 2025',
          paragraphs: [
            'The new Income-tax Act and Income-tax Rules, 2026 introduce revised forms. Some important form mappings are:',
          ],
          blocks: [
            {
              type: 'table',
              headers: ['Previous form', 'New form', 'Purpose'],
              rows: [
                ['Form 24Q', 'Form 138', 'Salary TDS statement'],
                ['Form 26Q', 'Form 140', 'TDS on non-salary payments to residents'],
                ['Form 27EQ', 'Form 143', 'Quarterly TCS statement'],
                ['Forms 26QB, 26QC, 26QD and 26QE', 'Form 141', 'Specified challan-cum-statements'],
              ],
            },
            {
              type: 'paragraph',
              text: 'For FY 2026–27 transactions, accountants must use the applicable new forms and section references rather than automatically carrying forward the old section numbers. For example, TDS obligations arising on payments or credits from 1 April 2026 are governed by the relevant provisions of Section 393 of the Income-tax Act, 2025. TCS is governed by the applicable provisions of Section 394.',
            },
          ],
        },
        {
          id: 'tds-compliance-checklist',
          heading: '4.4 TDS Compliance Checklist for Accountants',
          paragraphs: ['Before filing quarterly TDS statements, verify:'],
          bullets: [
            'TAN and deductor details.',
            'PAN of all deductees.',
            'Nature of payment.',
            'Applicable TDS rate and threshold applicability.',
            'Date of deduction and date of payment to the government.',
            'Challan identification number (CIN), BSR code and challan serial number.',
            'Amount deducted and deposited.',
            'Lower or nil deduction certificates, wherever applicable, plus previous-quarter corrections.',
            'Reconciliation with Form 26AS and TRACES records using [PDF to Excel Convertor Form 26AS](#tool:form-26as-to-excel) and [26AS ⇄ Tally Reco](#tool:tds-26as-tally-reco).',
          ],
        },
      ],
    },
    {
      id: 'tcs-return-and-payment-due-dates',
      heading: '5. TCS Return and Payment Due Dates',
      paragraphs: [
        'Tax Collected at Source (TCS) applies to specified transactions and categories of sellers or collectors under the applicable income tax provisions—including specified sales of goods, scrap, alcoholic liquor, overseas tour packages and other prescribed transactions.',
      ],
      subsections: [
        {
          id: 'tcs-payment-due-dates',
          heading: '5.1 TCS Payment Due Dates',
          paragraphs: [
            'The general monthly TCS payment deadline is the 7th of the following month for non-government collectors. For March collections, the general deadline is 7 April.',
          ],
        },
        {
          id: 'quarterly-tcs-return-filing',
          heading: '5.2 Quarterly TCS Return Filing',
          paragraphs: [
            'The applicable quarterly TCS statement is filed using Form 143 under the Income-tax Act, 2025. Accountants should reconcile TCS collected, deposited and reported in quarterly statements—see our [Form 26AS TDS & TCS Excel Bifurcation Guide](#blog:form-26as-tds-tcs-excel-reconciliation-guide)—to ensure proper credit is available to the collectees.',
          ],
          blocks: [
            {
              type: 'table',
              headers: ['Quarter', 'Period', 'Filing due date'],
              rows: [
                ['Q1', 'April–June 2026', '31 July 2026'],
                ['Q2', 'July–September 2026', '31 October 2026'],
                ['Q3', 'October–December 2026', '31 January 2027'],
                ['Q4', 'January–March 2027', '31 May 2027'],
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'advance-tax-due-dates-fy-2026-27',
      heading: '6. Advance Tax Due Dates for FY 2026–27',
      paragraphs: [
        'Advance tax is payable by taxpayers whose estimated net tax liability after eligible TDS/TCS credits is ₹10,000 or more, subject to applicable exceptions. For FY 2026–27, advance tax payments are governed by the Income-tax Act, 2025.',
      ],
      blocks: [
        {
          type: 'table',
          title: 'Advance Tax Instalment Calendar',
          headers: ['Instalment', 'Due date', 'Cumulative percentage'],
          rows: [
            ['First instalment', '15 June 2026', '15%'],
            ['Second instalment', '15 September 2026', '45%'],
            ['Third instalment', '15 December 2026', '75%'],
            ['Fourth instalment', '15 March 2027', '100%'],
          ],
        },
        {
          type: 'paragraph',
          text: 'These percentages are cumulative, not separate additional percentages. For example, if the total estimated advance tax liability is ₹1,00,000:',
        },
        {
          type: 'bullets',
          items: [
            'By 15 June: ₹15,000.',
            'By 15 September: ₹45,000 in total.',
            'By 15 December: ₹75,000 in total.',
            'By 15 March: ₹1,00,000 in total.',
          ],
        },
        {
          type: 'paragraph',
          text: 'Eligible presumptive taxpayers under Section 58 generally pay the entire advance tax by 15 March.',
        },
        {
          type: 'callout',
          tone: 'warning',
          label: 'Important Advance Tax Interest Note',
          text: 'Interest for default or deferment of advance tax can apply under Sections 424 and 425 of the Income-tax Act, 2025.',
        },
      ],
    },
    {
      id: 'gst-itr-tds-penalties-and-late-fees',
      heading: '7. Important GST and Income Tax Penalties and Late Fees',
      paragraphs: [
        'Accountants should not only remember filing dates but also understand the financial consequences of missing them.',
      ],
      subsections: [
        {
          id: 'gst-late-fees-and-interest',
          heading: '7.1 GST Late Fees and Interest',
          paragraphs: [
            'For GSTR-3B, the general late fee is calculated under the applicable provisions of the CGST and SGST Acts, with different limits for nil returns and other returns. The commonly applicable general late fee is ₹50 per day in total for returns with tax liability and ₹20 per day in total for nil returns, subject to applicable statutory caps and exemptions.',
          ],
          blocks: [
            {
              type: 'table',
              headers: ['Compliance', 'General consequence'],
              rows: [
                ['Delayed GSTR-1', 'Applicable late fee under GST law'],
                ['Delayed GSTR-3B', 'Applicable late fee and interest'],
                ['Delayed GST tax payment', 'Interest generally at 18% per annum, where applicable'],
                ['Incorrect ITC claim', 'Reversal and applicable interest or other consequences'],
                ['Non-compliance with GST provisions', 'Additional penalties depending on the violation'],
              ],
            },
          ],
        },
        {
          id: 'tds-late-filing-fee',
          heading: '7.2 TDS Late Filing Fee',
          paragraphs: [
            'Under the old Income-tax Act, 1961, Section 234E provides a late filing fee of ₹200 per day for delayed TDS statements, subject to the maximum amount of TDS deductible or collectible. For FY 2026–27, check the corresponding provisions under the Income-tax Act, 2025.',
          ],
        },
        {
          id: 'tds-and-tcs-interest',
          heading: '7.3 TDS and TCS Interest',
          paragraphs: [
            'Common interest consequences under the previous Act include the following, and the applicable provisions under the new Act must be used for FY 2026–27 transactions:',
          ],
          bullets: [
            'TDS not deducted: generally 1% per month or part of a month.',
            'TDS deducted but not deposited: generally 1.5% per month or part of a month.',
          ],
        },
        {
          id: 'late-itr-filing-fee',
          heading: '7.4 Late ITR Filing Fee',
          paragraphs: [
            'Additional interest may apply depending on the tax payable and the circumstances of the delayed return.',
          ],
          blocks: [
            {
              type: 'table',
              headers: ['Total income', 'General late filing fee'],
              rows: [
                ['Up to ₹5 lakh', '₹1,000'],
                ['Above ₹5 lakh', '₹5,000'],
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'november-december-2026-calendar',
      heading: '8. Important Accountant Compliance Calendar – November and December 2026',
      paragraphs: [
        'As of 23 November 2026, the following are the immediate deadlines accountants should prioritise. Always check for subsequent extensions and the applicable taxpayer category.',
      ],
      blocks: [
        {
          type: 'table',
          headers: ['Date', 'Compliance', 'Particulars'],
          rows: [
            ['25 November 2026', 'PMT-06', 'QRMP GST payment for October'],
            ['30 November 2026', 'ITR', 'Transfer pricing cases, subject to applicability'],
            ['7 December 2026', 'TDS/TCS payment', 'November 2026 deductions and collections'],
            ['10 December 2026', 'GSTR-7', 'November GST TDS return'],
            ['10 December 2026', 'GSTR-8', 'November GST TCS return'],
            ['11 December 2026', 'GSTR-1', 'November monthly return'],
            ['13 December 2026', 'IFF', 'November QRMP invoice furnishing, optional'],
            ['15 December 2026', 'Advance tax', 'Third instalment for FY 2026–27'],
            ['20 December 2026', 'GSTR-3B', 'November monthly return'],
            ['25 December 2026', 'PMT-06', 'QRMP GST payment for November'],
            ['31 December 2026', 'GSTR-9', 'Annual return for FY 2025–26, where applicable'],
            ['31 December 2026', 'GSTR-9C', 'Reconciliation statement for FY 2025–26, where applicable'],
            ['31 December 2026', 'Belated ITR', 'AY 2026–27, subject to assessment completion'],
          ],
        },
      ],
    },
    {
      id: 'monthly-quarterly-yearly-checklist',
      heading: '9. Monthly Accounting and Tax Compliance Checklist',
      paragraphs: [
        'An accountant should maintain a structured monthly compliance routine rather than wait until the last few days of the month.',
      ],
      subsections: [
        {
          id: 'checklist-every-month',
          heading: 'Every Month (GST, TDS/TCS & Accounting)',
          paragraphs: [],
          blocks: [
            {
              type: 'bullets',
              title: 'GST Monthly Routine:',
              items: [
                'Prepare monthly sales register and purchase register.',
                'Reconcile GSTR-2B with purchase register and reconcile GSTR-1 with GSTR-3B.',
                'Verify RCM transactions and review ITC eligibility.',
                'Check GST payment and electronic ledger balances, then file applicable GST returns.',
              ],
            },
            {
              type: 'bullets',
              title: 'TDS/TCS Monthly Routine:',
              items: [
                'Review salary and vendor payments and identify transactions liable for TDS.',
                'Check TDS rates and thresholds, deduct and deposit TDS, and reconcile challans.',
                'Check TCS applicability and update TDS/TCS ledgers.',
              ],
            },
            {
              type: 'bullets',
              title: 'General Accounting Routine:',
              items: [
                'Complete bank reconciliation and reconcile customer and supplier balances.',
                'Review outstanding receivables, payables and expense classifications.',
                'Review fixed asset additions, loan and interest balances, and cash/bank balances.',
                'Prepare monthly profit and loss statements.',
              ],
            },
          ],
        },
        {
          id: 'checklist-every-quarter',
          heading: 'Every Quarter',
          paragraphs: [],
          bullets: [
            'File applicable quarterly GST returns, quarterly TDS statements and quarterly TCS statements.',
            'Reconcile GST ITC and review advance tax estimates and tax provisions.',
            'Verify vendor PAN, compliance information and statutory liabilities.',
          ],
        },
        {
          id: 'checklist-every-financial-year',
          heading: 'Every Financial Year',
          paragraphs: [],
          bullets: [
            'Complete year-end ledger scrutiny, reconcile GST turnover and prepare annual GST reconciliation.',
            'Verify tax audit applicability, complete income tax computation and review depreciation.',
            'Reconcile TDS and Form 26AS (and review AIS and TIS).',
            'Prepare financial statements, file applicable annual returns and complete tax audit and other applicable audit requirements.',
          ],
        },
      ],
    },
    {
      id: 'official-government-tax-portals',
      heading: '10. Important Government Websites for Accountants',
      paragraphs: [
        'Accountants should use official government portals to verify statutory dates, download returns, make payments and check compliance status.',
      ],
      blocks: [
        {
          type: 'table',
          headers: ['Portal', 'Purpose', 'Website'],
          rows: [
            ['GST Portal', 'GST returns and payments', 'https://www.gst.gov.in/'],
            ['Income Tax e-Filing', 'ITR filing and income tax payments', 'https://www.incometax.gov.in/'],
            ['TRACES', 'TDS/TCS statements and certificates', 'https://www.tdscpc.gov.in/'],
            ['CBIC', 'GST notifications and legal updates', 'https://cbic.gov.in/'],
            ['CBIC Tax Information Portal', 'GST Acts and Rules', 'https://taxinformation.cbic.gov.in/'],
            ['Protean', 'PAN, TAN and TDS utilities', 'https://www.protean-tinpan.com/'],
            ['MCA', 'Company and LLP statutory filings', 'https://www.mca.gov.in/'],
            ['EPFO', 'Provident Fund compliance', 'https://www.epfindia.gov.in/'],
            ['ESIC', 'Employee State Insurance compliance', 'https://www.esic.gov.in/'],
          ],
        },
      ],
    },
    {
      id: 'practical-advice-avoid-missing-due-dates',
      heading: '11. Important Advice for Accountants: How to Avoid Missing Due Dates',
      paragraphs: [
        'Managing multiple clients and different statutory deadlines can become challenging, especially for accountants working in CA firms, private companies and independent accounting practices. The following practices improve compliance management:',
      ],
      blocks: [
        {
          type: 'ordered',
          items: [
            '**Maintain a central compliance calendar:** Create one master calendar for all GST, income tax and TDS obligations.',
            '**Maintain separate client-wise trackers:** Record each client\'s GSTIN, PAN, TAN, filing frequency, return applicability and filing status.',
            '**Complete reconciliation before the due date:** Avoid waiting until the final day to reconcile sales, purchases, ITC and TDS.',
            '**Maintain payment and filing acknowledgements:** Save challans, ARN numbers, return acknowledgements and payment confirmations.',
            '**Check government notifications regularly:** Statutory dates may be extended or modified through official notifications and circulars.',
            '**Track pending compliance separately:** Maintain a list of pending returns, tax payments, notices, mismatches and corrections.',
            '**Prepare for annual returns throughout the year:** Do not wait until December to start preparing GSTR-9 and GSTR-9C reconciliation.',
          ],
        },
      ],
    },
  ],
  faqs: [
    {
      question: 'Q1. What is the GSTR-1 due date every month?',
      answer:
        'The normal GSTR-1 due date for monthly filers is the 11th of the succeeding month.',
    },
    {
      question: 'Q2. What is the GSTR-3B due date every month?',
      answer:
        'The normal GSTR-3B due date for monthly filers is the 20th of the succeeding month.',
    },
    {
      question: 'Q3. What is the GSTR-3B due date for QRMP taxpayers?',
      answer:
        'It is generally the 22nd or 24th of the month succeeding the quarter, depending on the applicable state or Union Territory group.',
    },
    {
      question: 'Q4. What is the TDS payment due date?',
      answer:
        'The general TDS payment due date is the 7th of the succeeding month for non-government deductors, with special rules for March and specified transactions.',
    },
    {
      question: 'Q5. What is the quarterly TDS return due date?',
      answer:
        'The general quarterly deadlines are 31 July, 31 October, 31 January and 31 May.',
    },
    {
      question: 'Q6. What is the ITR filing due date for FY 2025–26?',
      answer:
        'For AY 2026–27, the normal deadline was 31 July for ITR-1 and ITR-2 eligible cases and 31 August for specified non-audit business and trust cases. Specified audit cases received an extension to 21 November 2026.',
    },
    {
      question: 'Q7. What is the last date for filing a belated ITR for AY 2026–27?',
      answer:
        'Generally, 31 December 2026 or completion of assessment, whichever is earlier.',
    },
    {
      question: 'Q8. What is the GSTR-9 due date for FY 2025–26?',
      answer:
        'The normal statutory due date is 31 December 2026, subject to applicability and any subsequent extension.',
    },
    {
      question: 'Q9. What is the advance tax due date for December 2026?',
      answer:
        'The third advance tax instalment for FY 2026–27 is due on 15 December 2026.',
    },
    {
      question: 'Q10. Is the Income-tax Act, 2025 applicable to FY 2025–26?',
      answer:
        'No. Income earned during FY 2025–26 is assessed under the Income-tax Act, 1961. Income earned from 1 April 2026 falls under the Income-tax Act, 2025.',
    },
    {
      question: 'Q11. What are the new TDS forms under the Income-tax Act, 2025?',
      answer:
        'Some important replacements include Form 138 for salary TDS statements, Form 140 for non-salary resident TDS statements, Form 143 for TCS statements and Form 141 for specified challan-cum-statements.',
    },
    {
      question: 'Q12. Is GSTR-9 mandatory for every GST-registered business?',
      answer:
        'No. Exemptions and turnover thresholds apply. Generally, taxpayers with aggregate turnover exceeding ₹2 crore are required to file GSTR-9, subject to applicable notifications.',
    },
    {
      question: 'Q13. Who needs to file GSTR-9C?',
      answer:
        'Registered taxpayers whose aggregate turnover exceeds ₹5 crore in the relevant financial year are generally required to furnish GSTR-9C, subject to applicable provisions.',
    },
  ],
  conclusion: [
    'GST, income tax, TDS and TCS compliance are essential responsibilities for every accounting and finance department in India. A properly maintained compliance calendar helps accountants complete statutory filings on time, avoid unnecessary penalties, maintain accurate financial records and ensure that businesses remain tax compliant.',
    'With the transition to the Income-tax Act, 2025, tax professionals must also pay attention to the new forms, updated section references and applicable tax-year requirements. Bookmark this page and revisit it regularly for important GST, ITR and TDS deadline updates.',
  ],
  disclaimer:
    'This article is intended for general informational and educational purposes. Due dates are based on the statutory framework and government information available as of 23 November 2026. Actual filing deadlines may change through subsequent notifications, circulars or orders. Applicability, exemptions, tax rates and penalties depend on the individual taxpayer\'s circumstances. Always verify the latest information on the official GST, CBIC and Income Tax Department portals before making tax payments or filing returns.',
};
