import { BlogPostItem } from '../types/blog.ts';

export const JOURNAL_ENTRIES_ACCOUNTANTS_POST: BlogPostItem = {
  slug: '100-most-important-journal-entries-accountants',
  title: '100 Most Important Journal Entries Every Accountant Should Know',
  seoTitle: '100 Important Journal Entries for Accountants | VCPL Tools',
  excerpt:
    'Complete Indian accounting reference of 100 essential journal entries across capital, fixed assets, purchases, sales, CGST/SGST/IGST & RCM, TDS/TCS, PF/ESI/PT payroll, banking, and year-end closing entries in Tally & Excel.',
  seoDescription:
    'Master 100 essential double-entry journal entries in India for GST (CGST, SGST, IGST, RCM), TDS/TCS, PF/ESI payroll, banking, depreciation & year-end closing.',
  category: 'Accounting',
  topicTags: ['GST', 'TDS & TCS', 'PF & ESI'],
  coverImage: '/blog/100-most-important-journal-entries-accountants.svg',
  coverImageAlt:
    '100 Most Important Journal Entries Every Accountant Should Know — Indian GST, TDS, Payroll and Year-End Closing Reference on VCPL Tools',
  coverTheme: 'calendar',
  coverBadge: '100 JOURNAL ENTRIES',
  publishedIso: '2026-11-24',
  publishedLabel: '24 Nov 2026',
  updatedIso: '2026-11-24',
  updatedLabel: '24 Nov 2026',
  readTime: '16 min read',
  authorId: 'kaushik-bangera',
  author: 'Kaushik Bangera',
  authorRole: 'Senior Accounting, Taxation & Compliance Practitioner',
  keywords: [
    '100 journal entries for accountants',
    'GST journal entries India CGST SGST IGST',
    'TDS and TCS journal entries Tally',
    'salary PF ESI PT journal entry',
    'year end closing adjustment entries India',
    'golden rules of accounting examples',
    'reverse charge RCM journal entry',
    'blocked ITC section 17(5) accounting entry',
  ],
  relatedToolIds: [
    'tds-26as-tally-reco',
    'gstr2b-tally-reconciler',
    'gstr1-return-prep',
    'tds-tcs-toolkit',
    'form-26as-to-excel',
  ],
  relatedSlugs: [
    'gst-itr-tds-due-dates-2026-27',
    'tds-sections-and-rates-chart-fy-2026-27',
    'pf-esi-and-karnataka-professional-tax-compliance-guide',
  ],
  keyTakeaways: [
    'Apply the Three Golden Rules (Personal, Real, Nominal) and Modern Balance-Sheet Equation (Assets + Expenses increase on Debit; Liabilities + Income + Capital increase on Credit) before passing any voucher in TallyPrime or Zoho Books.',
    'Segregate GST Input Credits (Input CGST, Input SGST, Input IGST) cleanly from Blocked Credits u/s 17(5) and Reverse Charge Mechanism (RCM) liabilities so [GSTR-2B vs Tally Reconciler](#tool:gstr2b-tally-reconciler) matches books rupee-for-rupee.',
    'Book TDS/TCS liabilities at the time of credit or payment—whichever is earlier—and verify deducted receivable balances quarterly with [26AS ⇄ Tally Reco](#tool:tds-26as-tally-reco) and [Form 26AS to Excel](#tool:form-26as-to-excel).',
    'Separate Employee Deductions (PF 12%, ESI 0.75%, PT, Salary TDS) from Employer Statutory Expenses (EPF/EPS 12% + Admin, ESI 3.25%) so Trial Balance statutory payables always tie to challan filings.',
  ],
  sections: [
    {
      id: 'golden-rules-and-modern-framework',
      heading: '1. Foundation: Golden Rules & Modern Debit–Credit Framework',
      paragraphs: [
        'Every accurate Trial Balance, Balance Sheet, and GST/Income Tax audit schedule starts with clean double-entry journal postings. Whether you pass vouchers in TallyPrime, Zoho Books, SAP, or Busy, every transaction impacts at least two ledgers so total Debits always equal total Credits.',
        'Accountants working on Indian books during FY 2026–27 must combine classical accounting principles with statutory Indian tax mechanics—splitting CGST/SGST vs IGST, booking Section 194C/194J/194I TDS deductions, isolating EPF/ESIC/PT payroll payables, and closing nominal accounts cleanly at 31 March.',
      ],
      blocks: [
        {
          type: 'table',
          title: 'Traditional Golden Rules vs Modern Accounting Classification',
          headers: ['Account Type', 'Examples in Indian Books', 'Debit Rule (+ / Entry)', 'Credit Rule (- / Entry)'],
          rows: [
            ['Personal Account', 'Debtors, Creditors, Bank, Capital, Drawings, Prepaid/Outstanding', 'Debit the Receiver', 'Credit the Giver'],
            ['Real Account', 'Cash, Plant & Machinery, Furniture, Land, Stock, Patents', 'Debit what comes in', 'Credit what goes out'],
            ['Nominal Account', 'Sales, Purchases, Rent, Salary, Interest, Depreciation, Bank Charges', 'Debit all Expenses & Losses', 'Credit all Incomes & Gains'],
            ['Modern Asset / Expense', 'Cash, Bank, Debtors, Fixed Assets, Purchases, Wages, Power', 'Increase (+)', 'Decrease (-)'],
            ['Modern Liability / Income / Equity', 'Capital, Loans, Creditors, GST Output, TDS Payable, Sales', 'Decrease (-)', 'Increase (+)'],
          ],
        },
      ],
      proTip:
        'Whenever a compound entry mixes a vendor bill, GST, and TDS (for example ₹1,00,000 professional fees + 18% GST - 10% TDS u/s 194J), always calculate TDS on the basic taxable value excluding GST (unless GST is not shown separately on the invoice per CBDT Circular 23/2017).',
    },
    {
      id: 'capital-assets-depreciation-1-15',
      heading: '2. Capital, Drawings, Fixed Assets & Depreciation (Entries 1–15)',
      paragraphs: [
        'Entries 1 to 15 cover business commencement, proprietor drawings, capital expenditure on machinery and computers, installation capitalization, asset disposal profit/loss, and Companies Act / Income-tax Act depreciation provisions.',
      ],
      blocks: [
        {
          type: 'table',
          title: 'Journal Entries 1–15: Capital, Fixed Assets & Depreciation',
          headers: ['#', 'Transaction Description', 'Debit Account (Dr.)', 'Credit Account (Cr.)', 'Practical Note'],
          rows: [
            ['1', 'Business started with cash', 'Cash A/c', 'Capital A/c', 'Owner equity infusion'],
            ['2', 'Capital introduced via bank NEFT/UPI', 'Bank A/c', 'Capital A/c', 'Preferred audit-trail mode'],
            ['3', 'Additional capital brought in as machinery', 'Machinery A/c', 'Capital A/c', 'Valued at fair market / invoice cost'],
            ['4', 'Cash withdrawn by proprietor for personal use', 'Drawings A/c', 'Cash A/c', 'Deducted from Capital at year-end'],
            ['5', 'Personal utility bill / life insurance paid via business bank', 'Drawings A/c', 'Bank A/c', 'Not deductible as business expense'],
            ['6', 'Goods withdrawn by owner for personal use', 'Drawings A/c', 'Purchases A/c + Input GST Reversal', 'Reverse ITC u/s 17(5)(h)'],
            ['7', 'Office furniture purchased by cheque (incl. installation)', 'Furniture & Fixtures A/c', 'Bank A/c', 'Capitalize put-to-use expenses'],
            ['8', 'Machinery bought on credit from equipment supplier', 'Machinery A/c + Input GST A/c', 'Asset Vendor A/c', 'Claim ITC on capital goods'],
            ['9', 'Freight & erection wages paid for new plant', 'Plant & Machinery A/c', 'Cash / Bank A/c', 'Capitalized into asset cost (AS-10)'],
            ['10', 'Computer / laptop bought for cash below ₹10,000', 'Office Equipment / Computer A/c', 'Cash A/c', 'Watch Section 40A(3) ₹10,000 cash cap'],
            ['11', 'Annual depreciation charged on fixed assets', 'Depreciation A/c', 'Fixed Asset A/c (or Accum. Dep.)', 'Non-cash P&L charge'],
            ['12', 'Old machinery sold for cash at book value', 'Cash / Bank A/c', 'Machinery A/c', 'No gain or loss'],
            ['13', 'Fixed asset sold at a profit', 'Bank A/c', 'Asset A/c + Profit on Sale of Asset A/c', 'P&L Other Income'],
            ['14', 'Fixed asset sold at a loss', 'Bank A/c + Loss on Sale of Asset A/c', 'Asset A/c', 'Charge loss to P&L'],
            ['15', 'Intangible asset / software license purchased', 'Software / Intangible Asset A/c + Input GST', 'Vendor / Bank A/c', 'Amortize over useful life'],
          ],
        },
      ],
    },
    {
      id: 'purchases-sales-discounts-returns-16-30',
      heading: '3. Purchases, Sales, Trade/Cash Discounts & Returns (Entries 16–30)',
      paragraphs: [
        'Entries 16 to 30 standardize inventory procurement, credit sales, trade vs cash discounts, Debit Notes (purchase returns), Credit Notes (sales returns), and free samples or abnormal stock losses. Coordinate outward invoicing and credit notes smoothly with [GSTR-1 Return Prep](#tool:gstr1-return-prep) and [GST Invoice & Quotation Maker](#tool:invoice-quotation-maker).',
      ],
      blocks: [
        {
          type: 'table',
          title: 'Journal Entries 16–30: Purchases, Sales, Discounts & Goods Returns',
          headers: ['#', 'Transaction Description', 'Debit Account (Dr.)', 'Credit Account (Cr.)', 'Practical Note'],
          rows: [
            ['16', 'Cash purchase of trading stock', 'Purchases A/c', 'Cash A/c', 'Record basic taxable value separately'],
            ['17', 'Credit purchase of raw material / goods', 'Purchases A/c', 'Sundry Creditor (Supplier) A/c', 'Match bill-by-bill aging'],
            ['18', 'Cash sales of goods over counter', 'Cash / UPI Clearing A/c', 'Sales A/c', 'Map UPI settlements via bank'],
            ['19', 'Credit sales raised via tax invoice', 'Sundry Debtor (Customer) A/c', 'Sales A/c', 'Check 15-digit GSTIN & POS'],
            ['20', 'Goods purchased with 10% Trade Discount', 'Purchases A/c (Net of Trade Disc.)', 'Supplier A/c', 'Trade discount is never recorded separately'],
            ['21', 'Payment to supplier within due date with Cash Discount', 'Supplier A/c', 'Bank A/c + Discount Received A/c', 'Cash discount is P&L income'],
            ['22', 'Receipt from customer allowing early-pay Cash Discount', 'Bank A/c + Discount Allowed A/c', 'Customer A/c', 'Cash discount is P&L expense'],
            ['23', 'Defective goods returned to supplier (Debit Note)', 'Supplier A/c', 'Purchase Return A/c + Input GST Reversal', 'Align with GSTR-2B CDNR'],
            ['24', 'Goods returned by customer (Credit Note)', 'Sales Return A/c + Output GST A/c', 'Customer A/c', 'Report in GSTR-1 Table 9B'],
            ['25', 'Carriage inward / freight paid on raw material purchase', 'Carriage Inward A/c', 'Cash / Bank A/c', 'Direct Trading A/c expense'],
            ['26', 'Carriage outward / delivery freight paid on sales', 'Freight Outward A/c', 'Bank / Transporter A/c', 'Indirect Selling expense'],
            ['27', 'Goods distributed as free marketing samples', 'Advertisement / Sales Promotion A/c', 'Purchases A/c + Input GST Reversal', 'ITC ineligible u/s 17(5)(h)'],
            ['28', 'Goods lost by fire or theft (uninsured)', 'Loss by Fire/Theft A/c', 'Purchases A/c + Input GST Reversal', 'Reverse ITC on lost/destroyed stock'],
            ['29', 'Goods lost by fire (insurance claim admitted)', 'Insurance Company A/c + Loss A/c', 'Purchases A/c + Input GST Reversal', 'Credit insurance receivable'],
            ['30', 'Opening stock transferred to Trading Account', 'Trading A/c', 'Opening Stock A/c', 'Part of Trading closing routine'],
          ],
        },
      ],
    },
    {
      id: 'gst-cgst-sgst-igst-rcm-31-50',
      heading: '4. GST Input, Output, Set-Off, RCM & Blocked Credit u/s 17(5) (Entries 31–50)',
      paragraphs: [
        'Clean GST ledger structuring prevents ITC mismatches and late interest under Section 50. Separate Input CGST/SGST/IGST from Output CGST/SGST/IGST, maintain distinct RCM Payable ledgers for GTA/legal services, and expense ineligible Section 17(5) GST directly into the underlying cost head. Always cross-verify monthly supplier credits inside [GSTR-2B vs Tally Reconciler](#tool:gstr2b-tally-reconciler).',
      ],
      blocks: [
        {
          type: 'table',
          title: 'Journal Entries 31–50: Indian GST Purchases, Sales, Set-Off & RCM',
          headers: ['#', 'GST Transaction', 'Debit Account (Dr.)', 'Credit Account (Cr.)', 'Compliance Rule'],
          rows: [
            ['31', 'Intra-state purchase (same state) @ 18% GST', 'Purchases (100) + Input CGST (9) + Input SGST (9)', 'Supplier A/c (118)', '9% CGST + 9% SGST'],
            ['32', 'Inter-state purchase (outside state) @ 18% GST', 'Purchases (100) + Input IGST (18)', 'Supplier A/c (118)', '18% IGST'],
            ['33', 'Intra-state sale @ 18% GST', 'Customer A/c (118)', 'Sales (100) + Output CGST (9) + Output SGST (9)', 'Report in GSTR-1 B2B/B2CS'],
            ['34', 'Inter-state sale @ 18% GST', 'Customer A/c (118)', 'Sales (100) + Output IGST (18)', 'Verify Place of Supply code'],
            ['35', 'Purchase of motor car / food / club membership (Blocked ITC)', 'Asset / Staff Welfare Expense A/c (118)', 'Vendor / Bank A/c (118)', 'Sec 17(5): do not debit Input GST'],
            ['36', 'GTA transport expense liable under RCM @ 5%', 'Freight Inward A/c (100)', 'Transporter A/c (100)', 'Step 1: Book freight bill'],
            ['37', 'Recording RCM GST liability on GTA / Advocate fees', 'Input GST RCM Claimable A/c (5)', 'Output GST RCM Payable A/c (5)', 'Pay RCM in cash via PMT-06'],
            ['38', 'Cash payment of RCM GST to Government', 'Output GST RCM Payable A/c (5)', 'Electronic Cash Ledger / Bank A/c (5)', 'Paid before claiming RCM ITC'],
            ['39', 'Transfer of paid RCM GST to eligible Input ITC pool', 'Input CGST/SGST or IGST A/c (5)', 'Input GST RCM Claimable A/c (5)', 'Claim after cash challan payment'],
            ['40', 'Deposit cash into GST Electronic Cash Ledger (PMT-06)', 'GST Electronic Cash Ledger A/c', 'Bank A/c', 'Challan CIN recorded'],
            ['41', 'Monthly GSTR-3B set-off: IGST Input vs IGST Output', 'Output IGST A/c', 'Input IGST A/c', 'Rule 88A: Exhaust IGST ITC first'],
            ['42', 'Utilization of excess IGST ITC against CGST/SGST Output', 'Output CGST / Output SGST A/c', 'Input IGST A/c', 'Any ratio after IGST output'],
            ['43', 'Utilization of Input CGST against Output CGST & IGST', 'Output CGST / Output IGST A/c', 'Input CGST A/c', 'CGST cannot pay SGST'],
            ['44', 'Utilization of Input SGST against Output SGST & IGST', 'Output SGST / Output IGST A/c', 'Input SGST A/c', 'SGST cannot pay CGST'],
            ['45', 'Net GST tax balance paid via Electronic Cash Ledger', 'Output CGST / SGST / IGST A/c', 'GST Electronic Cash Ledger A/c', 'Matches GSTR-3B cash paid'],
            ['46', 'GST interest or late fee paid on delayed return', 'GST Interest & Late Fee Expense A/c', 'Bank / Cash Ledger A/c', 'Non-creditable expense'],
            ['47', 'ITC reversed under Rule 37 (supplier unpaid > 180 days)', 'ITC Reversal / Pending Re-credit A/c', 'Input CGST/SGST/IGST A/c', 'Re-claimable on payment'],
            ['48', 'Purchase from Composition Dealer (no tax charged)', 'Purchases (Composition) A/c', 'Composition Supplier A/c', 'Bill of Supply—no Input GST'],
            ['49', 'Zero-rated export sale with LUT (without IGST payment)', 'Foreign Debtor A/c', 'Export Sales (LUT) A/c', 'Check shipping bill & BRC'],
            ['50', 'Import of goods paying IGST & BCD at Customs port', 'Purchases + Customs Duty + Input IGST A/c', 'Bank / CHA A/c', 'Claim IGST via ICEGATE BOE'],
          ],
        },
      ],
    },
    {
      id: 'tds-tcs-accounting-51-65',
      heading: '5. TDS & TCS Deduction, Payment & Form 26AS Adjustments (Entries 51–65)',
      paragraphs: [
        'Entries 51 to 65 handle both TDS Payable (deductions you make on vendor rent, contractor, professional, and commission bills—deposited by the 7th of next month under Challan 281 and reported in Form 140 / 138) and TDS/TCS Receivable (taxes deducted/collected by your customers or banks). Check exact threshold and rates inside our [TDS & TCS Toolkit (FY 2026-27)](#tool:tds-tcs-toolkit) and review our [TDS Sections & Rates Chart](#blog:tds-sections-and-rates-chart-fy-2026-27).',
      ],
      blocks: [
        {
          type: 'table',
          title: 'Journal Entries 51–65: TDS & TCS Accounting Entries',
          headers: ['#', 'TDS / TCS Scenario', 'Debit Account (Dr.)', 'Credit Account (Cr.)', 'Key Section / Rule'],
          rows: [
            ['51', 'Professional fees bill ₹50,000 + 18% GST with 10% TDS', 'Professional Fees (50,000) + Input GST (9,000)', 'Vendor (54,000) + TDS Payable u/s 194J (5,000)', 'TDS on basic ₹50,000'],
            ['52', 'Factory/office rent ₹60,000/mo + 18% GST with 10% TDS', 'Rent Expense (60,000) + Input GST (10,800)', 'Landlord (64,800) + TDS Payable u/s 194I(b) (6,000)', 'Threshold ₹50,000/month'],
            ['53', 'Contractor invoice ₹1,00,000 (Company/Firm) 2% TDS', 'Contract Expense (1,00,000) + Input GST (18,000)', 'Contractor (1,16,000) + TDS Payable u/s 194C (2,000)', '1% Individual/HUF; 2% Others'],
            ['54', 'Commission / brokerage bill ₹25,000 with 2% TDS', 'Commission Expense (25,000) + Input GST (4,500)', 'Agent (29,000) + TDS Payable u/s 194H (500)', 'Rate revised to 2%'],
            ['55', 'Advance paid to contractor before invoice receipt', 'Vendor Advance A/c (100)', 'Bank (98) + TDS Payable u/s 194C (2)', 'Deduct on advance or bill, earlier'],
            ['56', 'Monthly TDS Challan 281 remitted to Income Tax Dept', 'TDS Payable (Section-wise) A/c', 'Bank A/c', 'Due 7th of next month (30 Apr for Mar)'],
            ['57', 'Interest u/s 201(1A) or late fee u/s 234E paid on TDS', 'Statutory Interest / Late Fee A/c', 'Bank A/c', 'Disallowed u/s 37(1) for IT'],
            ['58', 'Customer deducts 10% TDS on your ₹1,00,000 service bill', 'Customer (1,08,000) + TDS Receivable A/c (10,000)', 'Service Income (1,00,000) + Output GST (18,000)', 'Match against Form 26AS'],
            ['59', 'Bank credits FD interest net of 10% TDS u/s 194A', 'Bank / Accrued Interest (9,000) + TDS Receivable (1,000)', 'FD Interest Income A/c (10,000)', 'Verify bank TAN in Form 26AS'],
            ['60', 'Vendor charges 1% TCS on motor vehicle > ₹10L u/s 206C(1F)', 'Vehicle Asset A/c + TCS Receivable A/c', 'Dealer / Bank A/c', 'TCS is asset—never expense'],
            ['61', 'Seller collects 0.1% TCS on scrap/minerals/goods', 'Customer A/c', 'Sales + Output GST + TCS Payable A/c', 'Deposit by 7th of next month'],
            ['62', 'TCS collected from buyer paid to Government', 'TCS Payable A/c', 'Bank A/c', 'Report in Form 143 / 27EQ'],
            ['63', 'Year-end adjustment: TDS/TCS Receivable set off vs Tax Provision', 'Provision for Income Tax A/c', 'TDS Receivable A/c + TCS Receivable A/c', 'Only after 26AS match'],
            ['64', 'Unclaimed or short-credit TDS written off after assessment', 'Sundry Balances Written Off A/c', 'TDS Receivable A/c', 'Avoid carrying stale TDS'],
            ['65', 'Income Tax Refund received with Section 244A interest', 'Bank A/c', 'Income Tax Refund Receivable + Int. on IT Refund A/c', '244A interest is taxable income'],
          ],
        },
      ],
    },
    {
      id: 'payroll-pf-esi-pt-gratuity-66-75',
      heading: '6. Payroll, Salary, EPF, ESIC, Karnataka PT & Gratuity (Entries 66–75)',
      paragraphs: [
        'Payroll journal entries require splitting gross salary expense from employer statutory contributions (EPF 12% + Admin/EDLI, ESIC 3.25%) and employee withholdings (EPF 12%, ESIC 0.75%, PT, Salary TDS). See our detailed rates and state slabs in [PF, ESI & Karnataka Professional Tax Payroll Guide](#blog:pf-esi-and-karnataka-professional-tax-compliance-guide).',
      ],
      blocks: [
        {
          type: 'table',
          title: 'Journal Entries 66–75: Salary, PF, ESI, PT & Gratuity Postings',
          headers: ['#', 'Payroll Transaction', 'Debit Account (Dr.)', 'Credit Account (Cr.)', 'Statutory Timeline'],
          rows: [
            ['66', 'Monthly salary accrual with PF, ESI, PT & TDS deductions', 'Salaries & Wages (Gross)', 'Salary Payable + EPF Emp. + ESIC Emp. + PT + TDS Payable', 'Pass on month-end closing'],
            ['67', 'Employer contribution to EPF (3.67%), EPS (8.33%) & EDLI/Admin', 'Employer PF Contribution A/c', 'EPF Payable (Employer) A/c', '12% + ~1% EDLI/Admin'],
            ['68', 'Employer contribution to ESIC @ 3.25% of gross wages', 'Employer ESIC Contribution A/c', 'ESIC Payable (Employer) A/c', 'For staff ≤ ₹21,000/mo'],
            ['69', 'Net salary disbursed via bank bulk NEFT / payroll', 'Salary Payable A/c', 'Bank A/c', 'Match bank salary batch'],
            ['70', 'EPF ECR combined challan paid (Employee + Employer)', 'EPF Payable (Emp.) + EPF Payable (Er.)', 'Bank A/c', 'Due 15th of next month'],
            ['71', 'ESIC monthly contribution challan paid', 'ESIC Payable (Emp.) + ESIC Payable (Er.)', 'Bank A/c', 'Due 15th of next month'],
            ['72', 'Karnataka Professional Tax (PT) monthly return payment', 'Professional Tax Payable A/c', 'Bank A/c', 'Due 20th of next month'],
            ['73', 'Salary advance / staff loan disbursed', 'Staff Advance / Loan A/c', 'Bank A/c', 'Recoverable asset'],
            ['74', 'EMI recovery of staff advance from monthly salary', 'Salary Payable / Salaries A/c', 'Staff Advance / Loan A/c', 'Deduction in payroll sheet'],
            ['75', 'Year-end employee bonus & gratuity provision created', 'Staff Bonus / Gratuity Expense A/c', 'Provision for Bonus / Gratuity A/c', 'Check Sec 43B actual payment rule'],
          ],
        },
      ],
    },
    {
      id: 'banking-loans-brs-76-88',
      heading: '7. Banking, Cheque Dishonour, Loans, EMI & BRS Adjustments (Entries 76–88)',
      paragraphs: [
        'Entries 76 to 88 keep your cashbook and Bank Reconciliation Statement (BRS) audit-ready—covering cash deposits, dishonoured cheques, credit card MDR charges, term loan EMI principal-vs-interest splits, and recurring bank charges. Prepare physical branch deposits accurately with [Bank Deposit & RTGS Slip Generator](#tool:bank-slip-generator).',
      ],
      blocks: [
        {
          type: 'table',
          title: 'Journal Entries 76–88: Banking, Loans, Cheques & BRS Adjustments',
          headers: ['#', 'Banking Transaction', 'Debit Account (Dr.)', 'Credit Account (Cr.)', 'BRS / Tax Tip'],
          rows: [
            ['76', 'Cash deposited into business current bank account', 'Bank A/c', 'Cash A/c', 'Contra voucher in Tally'],
            ['77', 'Cash withdrawn from bank for office petty cash', 'Cash / Petty Cash A/c', 'Bank A/c', 'Contra voucher in Tally'],
            ['78', 'Cheque received from customer & deposited same day', 'Bank A/c', 'Customer A/c', 'Track clearance date in BRS'],
            ['79', 'Customer cheque dishonoured / bounced by bank', 'Customer A/c', 'Bank A/c', 'Re-opens receivable + penalty if any'],
            ['80', 'Bank charges / SMS / NEFT fees + 18% GST debited', 'Bank Charges A/c + Input GST A/c', 'Bank A/c', 'Claim ITC if GSTIN is on bank stmt'],
            ['81', 'POS / Payment gateway settlement net of MDR + GST', 'Bank (Net) + MDR Charges + Input GST', 'UPI / Card Sales Clearing A/c', 'Do not book net amount as sales'],
            ['82', 'Fixed Deposit (FD) created from surplus bank funds', 'Fixed Deposit (Bank) A/c', 'Current Bank A/c', 'Asset reclassification'],
            ['83', 'Savings / Sweep-in bank interest credited by bank', 'Bank A/c', 'Bank Interest Income A/c', 'P&L Indirect Income'],
            ['84', 'Business term loan sanctioned & credited to bank', 'Bank A/c + Loan Processing Fee + Input GST', 'Term Loan A/c', 'Recognize gross loan principal'],
            ['85', 'Monthly loan EMI paid (Principal + Interest bifurcation)', 'Term Loan Principal A/c + Interest on Loan A/c', 'Bank A/c', 'Follow bank amortization schedule'],
            ['86', 'Foreign currency export receipt with exchange gain', 'Bank A/c', 'Foreign Debtor A/c + Forex Gain A/c', 'AS-11 / Ind AS 21 conversion'],
            ['87', 'Foreign import payment settled at higher FX rate', 'Foreign Vendor A/c + Forex Loss A/c', 'Bank A/c', 'Charge loss to P&L'],
            ['88', 'Unidentified direct credit found in bank statement', 'Bank A/c', 'Suspense / Unidentified Receipts A/c', 'Clear suspense before 31 March'],
          ],
        },
      ],
    },
    {
      id: 'year-end-closing-adjustments-89-100',
      heading: '8. Year-End Closing, Accruals, Provisions & Finalization (Entries 89–100)',
      paragraphs: [
        'Entries 89 to 100 complete statutory year-end closing on 31 March: accrual of March expenses paid in April, prepaid insurance allocation, unearned customer advances, bad debt write-offs, doubtful debt provisions, Income Tax provision, and closing transfer of Trading & Profit & Loss balances.',
      ],
      blocks: [
        {
          type: 'table',
          title: 'Journal Entries 89–100: Year-End Accruals, Provisions & Final Closing',
          headers: ['#', 'Closing / Adjustment Transaction', 'Debit Account (Dr.)', 'Credit Account (Cr.)', 'Audit Verification'],
          rows: [
            ['89', 'Outstanding expense accrued (e.g. March electricity/audit fee)', 'Electricity / Audit Fee A/c', 'Expenses Payable / Outstanding A/c', 'Deduct TDS on provision if applicable'],
            ['90', 'Prepaid insurance / AMC unexpired portion carried forward', 'Prepaid Expenses A/c', 'Insurance / AMC Expense A/c', 'Pro-rata days beyond 31 March'],
            ['91', 'Accrued FD interest earned up to 31 March (not yet credited)', 'Accrued Interest A/c', 'Interest Income A/c', 'Reconcile with AIS/26AS'],
            ['92', 'Advance received from customer for next-year services', 'Customer Advance / Unearned Revenue Adjustment', 'Unearned Income (Liability) A/c', 'Verify GST on service advances'],
            ['93', 'Closing inventory / stock recorded on 31 March', 'Closing Stock (Balance Sheet) A/c', 'Trading A/c', 'Lower of cost or NRV (AS-2)'],
            ['94', 'Irrecoverable debtor balance written off as Bad Debt', 'Bad Debts A/c', 'Sundry Debtor A/c', 'Ensure debtor ledger matches'],
            ['95', 'Provision for doubtful debts created on aged receivables', 'P&L / Provision for Bad Debts Exp. A/c', 'Provision for Doubtful Debts A/c', 'Disallowed u/s 36(1)(vii) Tax Calc'],
            ['96', 'Recovery of previously written-off bad debt', 'Bank A/c', 'Bad Debts Recovered A/c', 'Taxable income u/s 41(4)'],
            ['97', 'Direct expenses & purchases closed into Trading Account', 'Trading A/c', 'Purchases + Direct Expenses A/c', 'Yields Gross Profit'],
            ['98', 'Sales & direct closing stock transferred to Trading Account', 'Sales A/c', 'Trading A/c', 'Matches annual turnover'],
            ['99', 'Current income tax expense provided at year-end', 'Income Tax Expense (P&L) A/c', 'Provision for Income Tax A/c', 'Compute via FY Tax Calculator'],
            ['100', 'Net Profit transferred from Profit & Loss to Capital / Reserves', 'Profit & Loss A/c', 'Capital A/c / Reserves & Surplus A/c', 'Closes nominal ledger cycle'],
          ],
        },
      ],
      proTip:
        'Before finalizing entry #99 and #100 on 31 March, check our [FY 2026–27 Compliance Calendar](#blog:gst-itr-tds-due-dates-2026-27) and validate your tax liability in [Income Tax Calculator FY 2026–27](#tool:income-tax-fy-2026-27).',
    },
  ],
  faqs: [
    {
      question: 'Should TDS be calculated on the GST portion of a vendor invoice?',
      answer:
        'No. Per CBDT Circular No. 23/2017, where GST on services is indicated separately in the tax invoice, TDS is deducted only on the basic taxable value excluding GST. For example, on a ₹1,00,000 professional fee + ₹18,000 GST, 10% TDS u/s 194J is ₹10,000 (not ₹11,800).',
    },
    {
      question: 'How should blocked GST Input Tax Credit under Section 17(5) be booked in Tally?',
      answer:
        'Do not debit Input CGST/SGST/IGST for ineligible expenses like motor cars, food/beverages, or club memberships. Debit the full invoice value (taxable + GST) directly to the underlying asset or expense account so ITC is never accidentally claimed in GSTR-3B.',
    },
    {
      question: 'What is the difference between Trade Discount and Cash Discount in journal entries?',
      answer:
        'Trade Discount (volume or dealer discount agreed at invoicing) is deducted directly before recording Purchases or Sales and has no separate ledger. Cash Discount (prompt-payment incentive after billing) is booked separately in Discount Received or Discount Allowed accounts.',
    },
    {
      question: 'Why must Employer EPF/ESIC and Employee EPF/ESIC use separate accounting heads?',
      answer:
        'Employee EPF (12%) and ESIC (0.75%) are salary withholdings (not an extra expense above Gross Salary), whereas Employer EPF (12% + Admin/EDLI) and ESIC (3.25%) are additional company payroll costs charged to P&L before combining into the monthly challan payable.',
    },
    {
      question: 'When should accrued expenses booked on 31 March be reversed?',
      answer:
        'Outstanding expense provisions (#89) are either reversed on 1 April (opening reversal) so actual April vendor bills book cleanly, or knocked off directly against Expenses Payable when the final invoice arrives—while checking whether TDS was already required on 31 March.',
    },
  ],
  conclusion: [
    'Consistent double-entry journal postings eliminate 90% of year-end audit queries, GSTR-2B credit mismatches, and Form 26AS TDS variances. Bookmark these 100 entries for your accounting desk and validate monthly GST, TDS, and banking ledgers locally in your browser using VCPL Tools.',
  ],
  disclaimer:
    'Editorial Reference Note: Always confirm applicable GST Section 17(5) restrictions, RCM notifications, TDS threshold updates, and Companies Act / ICDS accounting treatments with current CBIC/CBDT notifications prior to statutory filing.',
};
