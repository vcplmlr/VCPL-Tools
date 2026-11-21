import { ToolCatalogItem } from '../types/tools';

export interface ToolArticleStep {
  stepTitle: string;
  detail: string;
}

export interface ToolArticleBenefit {
  title: string;
  detail: string;
}

export interface ToolArticleFaq {
  question: string;
  answer: string;
}

export interface ToolArticleData {
  toolId: string;
  seoTitle: string;
  seoDescription: string;
  adTopic: string;
  focusKeywords: string[];
  overview: string[];
  howToUse: ToolArticleStep[];
  keyBenefits: ToolArticleBenefit[];
  faqs: ToolArticleFaq[];
}

export const TOOL_ARTICLES: Record<string, ToolArticleData> = {
  'bank-slip-generator': {
    toolId: 'bank-slip-generator',
    seoTitle: 'SBI & HDFC Bank Deposit, DD & RTGS Slip Generator Online – VCPL Tools',
    seoDescription:
      'Generate A4 printable SBI and HDFC cash deposit slips, cheque pay-in slips, Demand Draft forms, and RTGS/NEFT challans locally in your browser.',
    adTopic: 'Business Banking & Cash Management Tools',
    focusKeywords: [
      'SBI deposit slip generator',
      'HDFC pay-in slip PDF',
      'RTGS NEFT challan print',
      'pre-printed bank slip alignment',
    ],
    overview: [
      'Preparing handwritten cash deposit slips, cheque pay-in forms, Demand Draft requisitions, and RTGS/NEFT challans slows down daily branch banking for accountants, retail cashiers, and business offices. The VCPL Tools Bank Deposit & RTGS Slip Generator produces structured, legible A4 print layouts modeled on State Bank of India (SBI) and HDFC Bank formats directly inside your browser.',
      'All beneficiary details, account numbers, cash denomination counts, and cheque particulars are computed in real time inside local browser memory—eliminating manual arithmetic errors, illegible handwriting, and unnecessary server uploads.',
    ],
    howToUse: [
      {
        stepTitle: 'Select Bank & Slip Format',
        detail:
          'Choose your bank template (SBI or HDFC) and select the slip type: Cash Deposit, Cheque Deposit, RTGS/NEFT Application, or Demand Draft (DD) form.',
      },
      {
        stepTitle: 'Enter Branch, Account & Depositor Details',
        detail:
          'Fill in the branch name, date, account number, account holder name, contact number, and PAN (required for high-value cash transactions).',
      },
      {
        stepTitle: 'Input Cash Denominations or Cheque/RTGS Rows',
        detail:
          'Enter currency note counts (₹500, ₹200, ₹100, ₹50, ₹20, ₹10) or cheque/UTR details. Totals and INR amounts in words are calculated automatically.',
      },
      {
        stepTitle: 'Choose Full Form or Pre-Printed Data-Only Mode',
        detail:
          'Select Standard A4 Layout for blank white paper, or switch to Pre-Printed Data-Only mode if feeding official pre-printed bank stationery into a printer.',
      },
      {
        stepTitle: 'Print or Export PDF',
        detail:
          'Preview both the Bank Copy and Customer Counterfoil side by side, then click Print A4 Slip or Download PDF for clean branch submission.',
      },
    ],
    keyBenefits: [
      {
        title: 'Automatic INR Denomination & Words Sync',
        detail:
          'Eliminates totalling mistakes between note counts, numeric figures, and Indian Rupees in words across both counterfoils.',
      },
      {
        title: 'Pre-Printed Stationery Data-Only Support',
        detail:
          'Hide template labels and borders with one click when printing onto physical pre-printed SBI or HDFC deposit slips.',
      },
      {
        title: '100% Browser-Local Privacy',
        detail:
          'Sensitive account numbers, PAN details, and payee names never leave your computer or touch external servers.',
      },
      {
        title: 'Reusable Saved Office Profiles',
        detail:
          'Save frequent company accounts locally in your browser to prepare repeat daily deposit slips in under 30 seconds.',
      },
    ],
    faqs: [
      {
        question: 'Are generated bank slips accepted at SBI and HDFC branches?',
        answer:
          'Generated slips follow standard counterfoil dimensions and fields for convenience, and Data-Only mode aligns onto official pre-printed slips. Always verify branch-specific requirements and verify all account numbers before submission.',
      },
      {
        question: 'Does VCPL Tools store my bank account number or PAN?',
        answer:
          'No. Every field you type stays exclusively in your browser memory during the session unless you voluntarily save a local profile on your own device.',
      },
      {
        question: 'Can I print multiple deposit slips on one A4 sheet?',
        answer:
          'Yes, you can adjust layout scaling or use the Bulk Excel Bank Slip Generator to batch-export up to 25 slips at once.',
      },
    ],
  },

  'bulk-excel-slips': {
    toolId: 'bulk-excel-slips',
    seoTitle: 'Bulk Excel Bank Slip Generator (Up to 25 Slips PDF/ZIP) – VCPL Tools',
    seoDescription:
      'Upload an Excel .XLSX spreadsheet to batch-generate up to 25 SBI and HDFC bank deposit or RTGS slips into a combined PDF or ZIP archive.',
    adTopic: 'Corporate Treasury & Bulk Accounting Software',
    focusKeywords: [
      'bulk bank slip generator',
      'excel to bank deposit slip',
      'batch pay-in slip PDF',
      'office accounting automation',
    ],
    overview: [
      'Finance teams, coaching institutes, and distributors frequently submit multiple RTGS, cheque, or cash deposits on the same banking day. Creating slips one by one wastes staff hours and increases transcription errors.',
      'The Bulk Excel Bank Slip Generator lets you download a structured .XLSX template, enter up to 25 deposit transactions in Microsoft Excel or Google Sheets, validate every row offline, and export a print-ready combined PDF or individual ZIP archive.',
    ],
    howToUse: [
      {
        stepTitle: 'Download the Standard Excel Template',
        detail:
          'Click Download Excel Template inside the bulk workspace to obtain the pre-formatted columns for bank, slip type, account number, and amounts.',
      },
      {
        stepTitle: 'Populate Up to 25 Transactions',
        detail:
          'Fill in your daily deposit, cheque, or RTGS entries in Excel and verify IFSC codes, dates, and beneficiary details.',
      },
      {
        stepTitle: 'Upload & Validate Spreadsheet Locally',
        detail:
          'Drop the .XLSX file into the workspace. Built-in validation flags missing account numbers, invalid IFSCs, or mismatched totals immediately.',
      },
      {
        stepTitle: 'Export Combined PDF or ZIP Package',
        detail:
          'Choose Export Combined PDF for continuous A4 printing, or download a ZIP bundle containing neatly named individual slip PDFs.',
      },
    ],
    keyBenefits: [
      {
        title: 'Batch 25 Slips in Seconds',
        detail:
          'Convert an entire day’s deposit register from Excel into uniform, legible slips in a single pass.',
      },
      {
        title: 'Pre-Export Row Validation',
        detail:
          'Catches incomplete account numbers, negative counts, and formatting errors before paper is printed.',
      },
      {
        title: 'Dual Export: Merged PDF or Individual ZIP',
        detail:
          'Print all slips at once from a single PDF or archive separate client PDFs inside a downloadable ZIP folder.',
      },
      {
        title: 'Zero Cloud Spreadsheet Upload',
        detail:
          'Excel parsing and PDF rendering execute strictly inside your browser using local JavaScript engines.',
      },
    ],
    faqs: [
      {
        question: 'How many slips can I generate in a single batch?',
        answer:
          'Up to 25 deposit, cheque, or RTGS slips per uploaded workbook to ensure smooth memory handling and fast PDF export inside any browser.',
      },
      {
        question: 'Can I mix SBI and HDFC entries in the same Excel sheet?',
        answer:
          'Yes. Specify the bank code per row in the template and the engine routes each slip to its corresponding bank layout automatically.',
      },
      {
        question: 'Is my vendor or payroll spreadsheet uploaded to a server?',
        answer:
          'No. The workbook is read directly in browser memory and discarded as soon as you close or refresh the page.',
      },
    ],
  },

  'bank-ifsc-finder': {
    toolId: 'bank-ifsc-finder',
    seoTitle: 'India IFSC, MICR & Bank Branch Code Finder – VCPL Tools',
    seoDescription:
      'Search 182,000+ verified Indian bank branches by 11-character IFSC code, bank name, branch, city, district, state, or 9-digit MICR code.',
    adTopic: 'Indian Banking Infrastructure, NEFT, RTGS & IFSC Lookup',
    focusKeywords: [
      'India IFSC code finder',
      'MICR code search India',
      'RBI bank branch directory',
      'amalgamated bank IFSC checker',
    ],
    overview: [
      'Verifying an accurate 11-character Indian Financial System Code (IFSC) and 9-digit MICR code before initiating NEFT, RTGS, IMPS, or cheque clearing prevents rejected transfers and settlement delays.',
      'The VCPL Tools India IFSC & MICR Code Finder indexes over 182,000 verified RBI/NPCI bank branches inside a fast SQLite FTS5 relational engine—complete with 11-character IFSC structure validation, amalgamated bank successor identification, state/district/city cascading filters, and CSV/Excel export.',
    ],
    howToUse: [
      {
        stepTitle: 'Search by IFSC, Bank Name, Branch, City, or MICR',
        detail:
          'Enter a full 11-character IFSC (e.g. SBIN0000001), bank name or abbreviation (SBI, HDFC, ICICI), branch locality, city, or 9-digit MICR code.',
      },
      {
        stepTitle: 'Validate RBI Format & Legacy Amalgamated Bank Codes',
        detail:
          'Inspect real-time RBI format validation (4-letter bank prefix + zero 5th character + 6-character branch code) and successor bank advisories for merged banks such as Syndicate Bank or Corporation Bank.',
      },
      {
        stepTitle: 'Filter, Copy, Print, or Export CSV / Excel',
        detail:
          'Refine matches by Bank, State, District, City, Bank Category, or Status, then copy branch details or export clean .CSV and .XLSX sheets.',
      },
    ],
    keyBenefits: [
      {
        title: '182,000+ Verified Indian Bank Branches',
        detail:
          'Covers Public Sector, Private Sector, Regional Rural, Small Finance, Payments, Co-operative, and Foreign banks across India.',
      },
      {
        title: 'Live RBI Syntax & Merger Safeguards',
        detail:
          'Separates inactive/historical records from active branches by default and highlights successor institutions for amalgamated bank prefixes.',
      },
      {
        title: 'One-Click Banking Slip Integration',
        detail:
          'Jump straight from verified branch lookup into the SBI or HDFC Bank Deposit & RTGS Slip Generator.',
      },
    ],
    faqs: [
      {
        question: 'Does passing 11-character IFSC format validation guarantee a branch is active?',
        answer:
          'No. Syntax validation confirms the code follows RBI formatting (4 alphabetic letters, 0 as the 5th character, and 6 alphanumeric characters). Always check that a matching Active branch record appears in the verified dataset and confirm with the recipient bank passbook or cheque leaf.',
      },
      {
        question: 'What happens if I search an old merged bank IFSC such as Syndicate Bank or Corporation Bank?',
        answer:
          'The finder automatically identifies amalgamated bank prefixes (such as SYNB -> Canara Bank or CORP -> Union Bank of India) and keeps historical records isolated from active default results.',
      },
    ],
  },

  'form-26as-to-excel': {
    toolId: 'form-26as-to-excel',
    seoTitle: 'TRACES Form 26AS PDF to Excel Converter (.XLSX) – VCPL Tools',
    seoDescription:
      'Extract TRACES Form 26AS TDS Part A, Part A1, TCS Part B, and Self-Assessment Tax details into structured Excel .XLSX audit sheets locally.',
    adTopic: 'Income Tax Filing & Chartered Accountancy Software',
    focusKeywords: [
      'Form 26AS PDF to Excel',
      'TRACES 26AS converter',
      'TDS reconciliation Excel',
      'client-side 26AS parser',
    ],
    overview: [
      'Chartered accountants, tax consultants, and salaried taxpayers routinely reconcile TRACES Form 26AS PDF statements against AIS, salary slips, and tally books. Manually copying multi-page Part A deductor tables from PDF into Excel is error-prone and time consuming.',
      'The Form 26AS PDF to Excel Converter reads your TRACES PDF locally inside your browser, extracts deductor names, TANs, section codes (such as 192, 194C, 194J, 194A), gross amounts, and TDS deposited, and builds an organized multi-sheet .XLSX workbook.',
    ],
    howToUse: [
      {
        stepTitle: 'Upload Your TRACES Form 26AS PDF',
        detail:
          'Select or drag your downloaded Form 26AS PDF file into the drop zone. If password-protected (typically PAN or DOB), unlock it first using the PDF Unlocker or enter credentials where prompted.',
      },
      {
        stepTitle: 'Review Parsed Summary & Deductor Tables',
        detail:
          'Inspect extracted Part A deductor totals, assessment year metadata, and section-wise TDS figures directly on screen.',
      },
      {
        stepTitle: 'Download Multi-Sheet Excel Audit Workbook',
        detail:
          'Click Export to .XLSX to download clean tabular worksheets ready for ITR preparation and client TDS reconciliation.',
      },
    ],
    keyBenefits: [
      {
        title: 'Clean Deductor & TAN Extraction',
        detail:
          'Separates deductor names, TAN numbers, transaction dates, and TDS amounts into proper numeric Excel columns.',
      },
      {
        title: 'Zero Server Exposure for Tax Files',
        detail:
          'Client PANs, income figures, and deductor statements stay completely inside your local browser memory.',
      },
      {
        title: 'Audit-Ready Section Totals',
        detail:
          'Eliminates manual SUM checks across dozens of 194J, 194C, and 194A entries during tax season.',
      },
    ],
    faqs: [
      {
        question: 'Are my PAN and income details uploaded anywhere?',
        answer:
          'No. PDF parsing and Excel generation happen strictly inside your browser via JavaScript—your Form 26AS never leaves your machine.',
      },
      {
        question: 'What if my Form 26AS PDF has a password?',
        answer:
          'If TRACES encrypted the PDF, use our browser-local PDF Unlocker tool first (typically your DOB in DDMMYYYY format) and then run the unlocked PDF here.',
      },
      {
        question: 'Should I verify totals against the Income Tax e-Filing Portal?',
        answer:
          'Yes. Always cross-verify extracted totals with the official TRACES / Income Tax Portal and AIS before filing returns.',
      },
    ],
  },

  'gstr2b-tally-reconciler': {
    toolId: 'gstr2b-tally-reconciler',
    seoTitle: 'GSTR-2B vs Tally Purchase Register ITC Reconciler (.XLSX) – VCPL Tools',
    seoDescription:
      'Compare GST Portal GSTR-2B JSON/Excel against Tally Purchase Register locally to spot exact matches, mismatches, and missing ITC.',
    adTopic: 'GST Compliance, ITC Audit & Accounting ERP',
    focusKeywords: [
      'GSTR-2B vs Tally reconciliation',
      'ITC mismatch tool Excel',
      'GSTR-2B JSON to Excel',
      'GST input tax credit audit',
    ],
    overview: [
      'Claiming accurate Input Tax Credit (ITC) under GST rules requires matching every supplier invoice reported in GSTR-2B against your Tally Purchase Register before filing GSTR-3B. Discrepancies in invoice numbers, tax amounts, or missing supplier filings can lead to ITC reversals and notices.',
      'The GSTR-2B vs Tally ITC Reconciler matches portal GSTR-2B exports against Tally purchase data inside your browser and generates a 6-sheet audit workbook categorizing Exact Matches, Value Mismatches, Only in GSTR-2B, and Only in Tally.',
    ],
    howToUse: [
      {
        stepTitle: 'Upload GSTR-2B Export File',
        detail:
          'Load the official GSTR-2B Excel or JSON file downloaded from the GST Portal.',
      },
      {
        stepTitle: 'Upload Tally Purchase Register Export',
        detail:
          'Select your exported Tally GST Purchase Register (.XLSX or .CSV) containing supplier GSTIN, invoice number, date, and CGST/SGST/IGST columns.',
      },
      {
        stepTitle: 'Configure Matching Tolerance & Run Reconciliation',
        detail:
          'Set rounding tolerance (for example ₹1 or ₹2) and click Reconcile to match normalized GSTINs and invoice numbers automatically.',
      },
      {
        stepTitle: 'Download 6-Sheet Audit Workbook',
        detail:
          'Review KPI cards on screen and export the color-coded Excel report for vendor follow-ups and GSTR-3B working papers.',
      },
    ],
    keyBenefits: [
      {
        title: 'Intelligent Invoice Normalization',
        detail:
          'Matches invoice numbers even when leading zeroes, hyphens, or slashes differ slightly between Tally and supplier GSTR-1 filings.',
      },
      {
        title: '6-Sheet Structured Audit Report',
        detail:
          'Separates Executive Summary, Exact Matches, Tax Mismatches, Missing in Books, and Missing in 2B for rapid CA review.',
      },
      {
        title: 'Confidential Client Books Stay Offline',
        detail:
          'Supplier lists, purchase turnover, and GSTIN ledgers remain strictly in browser memory with zero third-party server storage.',
      },
    ],
    faqs: [
      {
        question: 'Which file formats are accepted for GSTR-2B and Tally?',
        answer:
          'Both standard GST Portal Excel/JSON exports and Tally Prime/ERP9 Purchase Register .XLSX/.CSV sheets are supported.',
      },
      {
        question: 'Does it handle small rounding differences like ₹1?',
        answer:
          'Yes, you can specify a rupee tolerance threshold so minor paisa/rupee rounding differences are flagged cleanly rather than treated as missing invoices.',
      },
    ],
  },

  'invoice-to-excel': {
    toolId: 'invoice-to-excel',
    seoTitle: 'PDF Invoice to GST Audit Excel Converter (7-Sheet XLSX) – VCPL Tools',
    seoDescription:
      'Convert multi-page SAP, Tally, parts, or service PDF invoices into a 7-sheet GST Excel workbook with Executive Summary, HSN Table 12, and Audit Log.',
    adTopic: 'Automated Accounts Payable & GST E-Invoicing',
    focusKeywords: [
      'PDF invoice to Excel',
      'GST invoice extractor',
      'HSN Table 12 GSTR-1 Excel',
      'SAP Tally PDF invoice parser',
    ],
    overview: [
      'Entering dozens of multi-page vendor tax invoices line by line into Tally or Excel wastes valuable accounting hours and risks missed HSN codes or misread GST slabs. Standard PDF converters often scramble multi-page line items when HSN/SAC codes or tax rates wrap onto subsequent lines.',
      'The VCPL Tools Invoice to Excel Converter uses spatial PDF geometry parsing right in your browser to extract line items across all pages—including split HSN/SAC codes and tax sub-lines—and outputs a formula-driven 7-sheet audit workbook complete with GSTR-1 HSN Table 12 and automated reconciliation checks.',
    ],
    howToUse: [
      {
        stepTitle: 'Drop One or Multiple Tax Invoice PDFs',
        detail:
          'Select or drag multi-page GST invoice PDFs (SAP, Tally, parts, or service invoices) into the browser workspace.',
      },
      {
        stepTitle: 'Inspect Extracted Lines & Audit Warnings',
        detail:
          'Preview extracted SKU/part numbers, HSN/SAC codes, quantities, rates, discounts, CGST/SGST/IGST splits, and invoice-level validation status.',
      },
      {
        stepTitle: 'Download the 7-Sheet Audit Workbook (.XLSX)',
        detail:
          'Export the complete Excel workbook containing Executive Summary, All Pages Data, HSN Summary (GSTR-1 Table 12), Parties, Validation, GSTR-1 B2B Draft, and Raw PDF Pages.',
      },
    ],
    keyBenefits: [
      {
        title: 'Multi-Page & Wrapped HSN Extraction',
        detail:
          'Accurately preserves HSN/SAC codes and tax slabs even when invoice tables span across page breaks or wrap onto secondary lines.',
      },
      {
        title: '7-Sheet Formula-Driven Excel Output',
        detail:
          'Includes live SUBTOTAL formulas, Discount %, Effective GST %, Line Audit status, and GSTR-1 Table 12 HSN grouping.',
      },
      {
        title: 'Built-In Reconciliation Verification',
        detail:
          'Cross-checks computed line totals against printed PDF invoice totals and highlights any discrepancy in the Validation sheet.',
      },
      {
        title: '100% Private Document Parsing',
        detail:
          'Commercial invoices, customer pricing, and GSTINs are parsed locally with zero server upload.',
      },
    ],
    faqs: [
      {
        question: 'Can it extract multi-page invoices where HSN codes appear below item rows?',
        answer:
          'Yes. The spatial parser specifically stitches wrapped HSN/SAC sub-lines and tax rows across page boundaries without dropping line items.',
      },
      {
        question: 'Does it work on scanned image-only PDFs?',
        answer:
          'Text-selectable digital PDFs (generated from SAP, Tally, Zoho, or billing software) produce the highest accuracy. Scanned image-only PDFs without embedded text require OCR first.',
      },
      {
        question: 'Can I upload multiple invoice PDFs together?',
        answer:
          'Yes. Batch-drop multiple invoice PDFs to consolidate every line item, party GSTIN, and HSN summary into a single master workbook.',
      },
    ],
  },

  'invoice-quotation-maker': {
    toolId: 'invoice-quotation-maker',
    seoTitle: 'Free GST Tax Invoice, Proforma & Quotation Maker (A4 PDF + UPI QR) – VCPL Tools',
    seoDescription:
      'Generate A4 GST Tax Invoices, Proforma Invoices, and Quotations locally with automatic CGST/SGST vs IGST calculation, HSN summary, Excel quick-fill, signature upload, and embedded UPI QR codes.',
    adTopic: 'GST Billing Software, Invoicing & Small Business Accounting',
    focusKeywords: [
      'GST tax invoice maker',
      'proforma invoice generator India',
      'quotation PDF maker',
      'invoice with UPI QR code',
      'HSN SAC summary invoice',
    ],
    overview: [
      'Small businesses, freelancers, traders, and agencies often need clean Tally-style GST Tax Invoices, Proforma Invoices, and Quotations ready for A4 printing or instant WhatsApp/email sharing—without paying monthly SaaS subscriptions or uploading sensitive customer pricing to external servers.',
      'The VCPL GST Invoice & Quotation Maker saves your company profile, bank details, UPI ID, and authorised signature locally in your browser, detects buyer state codes from GSTIN automatically to split CGST + SGST vs IGST, renders an HSN/SAC tax summary with dynamic Scan-to-Pay UPI QR, and lets you import entire invoices from an Excel template.',
    ],
    howToUse: [
      {
        stepTitle: 'Choose Document Type & Set Up Company Profile',
        detail:
          'Pick Tax Invoice, Proforma Invoice, or Quotation, then enter your company GSTIN, state code, bank details, UPI ID, and signature once (saved in browser localStorage).',
      },
      {
        stepTitle: 'Fill Buyer & Line Items (or Import Excel)',
        detail:
          'Enter buyer GSTIN and items directly, or download the Excel template, fill rows offline, and upload it to auto-populate the entire A4 invoice preview.',
      },
      {
        stepTitle: 'Verify Live A4 Preview & Download PDF / Print',
        detail:
          'Inspect CGST/SGST vs IGST tax splits, HSN summary table, and embedded UPI QR code, then save locally, print A4, or download a high-resolution PDF.',
      },
    ],
    keyBenefits: [
      {
        title: 'Automatic CGST+SGST vs IGST Place-of-Supply',
        detail:
          'Extracts GST state codes automatically from buyer/seller GSTINs (all Indian states 01–99) and calculates HSN/SAC tax summaries cleanly.',
      },
      {
        title: 'Embedded Dynamic UPI Payment QR',
        detail:
          'Automatically generates an NPCI Scan-to-Pay QR right inside your invoice footer with optional exact invoice grand total.',
      },
      {
        title: 'Excel Quick-Fill & Local Saved History',
        detail:
          'Import bulk line items from .XLSX/.CSV and store company details, bank profile, and invoice drafts purely on your device.',
      },
    ],
    faqs: [
      {
        question: 'Where are my company details, signature, and saved invoices stored?',
        answer:
          'Everything stays strictly inside your browser localStorage. Nothing is uploaded to any server.',
      },
      {
        question: 'How does the UPI QR on the invoice work?',
        answer:
          'If you enter a UPI ID in your Bank Details, the invoice embeds a live NPCI upi://pay QR code. You can toggle whether the exact grand total amount is locked in the QR.',
      },
    ],
  },

  'unified-calculator': {
    toolId: 'unified-calculator',
    seoTitle: 'All-in-One Financial, Loan EMI, SIP, Income Tax & Exam Calculator – VCPL Tools',
    seoDescription:
      'Use one unified workspace for Standard Math, Loan EMI, SIP & Lumpsum, FD/PPF, FY 25-26 Income Tax, Marks, CGPA, Age & Date calculations.',
    adTopic: 'Personal Finance, Mutual Funds & Loan Advisory',
    focusKeywords: [
      'all in one calculator India',
      'home loan EMI calculator',
      'SIP CAGR calculator',
      'New vs Old tax regime FY 25-26',
    ],
    overview: [
      'Instead of switching between a dozen separate tabs for loan EMIs, mutual fund SIP projections, income tax comparisons, and student percentage/CGPA conversions, the VCPL Tools All-in-One Calculator unifies six core calculation engines inside one responsive interface.',
      'Designed specifically for Indian financial conventions (Lakhs, Crores, INR currency formatting, and FY 2025-26 New vs Old tax slabs) as well as everyday academic and date math, every result updates live as you adjust sliders or inputs.',
    ],
    howToUse: [
      {
        stepTitle: 'Choose Your Calculator Mode',
        detail:
          'Switch between Standard/Scientific Math, Loan & Home EMI, SIP & Wealth, FD/RD/PPF, Income Tax FY 25-26, or Exam, CGPA & Date utilities.',
      },
      {
        stepTitle: 'Adjust Amounts, Rates & Tenure',
        detail:
          'Enter principal, interest rate, tenure, step-up percentage, or salary deductions using numeric boxes or quick sliders.',
      },
      {
        stepTitle: 'Compare Breakdowns & Amortization Tables',
        detail:
          'Review total interest payable, wealth gained, year-by-year tax slab breakdowns, or exact age and working-day counts instantly.',
      },
    ],
    keyBenefits: [
      {
        title: 'Six Calculators in One Fast Hub',
        detail:
          'Eliminates tab clutter by combining scientific math, Indian financial planning, tax estimation, and academic utilities.',
      },
      {
        title: 'Indian Rupee Lakhs & Crores Formatting',
        detail:
          'Displays clear ₹ figures aligned with Indian banking and tax slab conventions.',
      },
      {
        title: 'Instant What-If Scenarios',
        detail:
          'Test loan prepayments, SIP step-ups, or New vs Old regime deductions instantaneously.',
      },
    ],
    faqs: [
      {
        question: 'Are Income Tax and EMI outputs official financial advice?',
        answer:
          'No. Calculator outputs are mathematical estimates for planning and informational comparison. Confirm final loan schedules with your bank and consult a Chartered Accountant before filing taxes.',
      },
      {
        question: 'Does the calculator save my salary or investment inputs?',
        answer:
          'No. All calculations happen dynamically in browser memory and are cleared when you close the tab.',
      },
    ],
  },

  'pdf-merger': {
    toolId: 'pdf-merger',
    seoTitle: 'Merge PDF Files Online Free & Private (Browser-Local) – VCPL Tools',
    seoDescription:
      'Combine multiple PDF documents into one ordered PDF file locally inside your browser with drag-and-drop reordering and zero file uploads.',
    adTopic: 'Document Management & Office PDF Productivity',
    focusKeywords: ['merge PDF offline', 'combine PDF browser', 'join multiple PDF files free'],
    overview: [
      'Government portals, bank loan applications, and GST audit submissions frequently require multiple separate PDFs—such as KYC proofs, invoices, or bank statements—to be combined into one continuous document.',
      'The VCPL Tools PDF Merger combines two or more PDF files directly inside your browser using local PDF assembly, letting you reorder files before exporting a single clean merged PDF without uploading confidential documents anywhere.',
    ],
    howToUse: [
      {
        stepTitle: 'Select or Drop Multiple PDF Files',
        detail:
          'Add two or more PDF documents from your computer or mobile device into the upload area.',
      },
      {
        stepTitle: 'Reorder Sequence as Needed',
        detail:
          'Arrange the order of your PDFs using the up/down controls so cover sheets, KYC forms, and annexures appear in the right sequence.',
      },
      {
        stepTitle: 'Merge & Download Combined PDF',
        detail:
          'Click Merge PDFs to assemble all pages cleanly and download the final combined file.',
      },
    ],
    keyBenefits: [
      {
        title: 'Zero File Size Upload Delay',
        detail:
          'Large statements and scanned PDFs merge locally at native device speed without waiting for cloud uploads.',
      },
      {
        title: 'Original Resolution Preserved',
        detail:
          'Text selectability, vector graphics, and embedded signatures remain intact.',
      },
      {
        title: 'Safe for Confidential KYC & Audit Packs',
        detail:
          'PAN cards, Aadhaar copies, and financial statements stay exclusively on your device.',
      },
    ],
    faqs: [
      {
        question: 'Is there a watermark added to merged PDFs?',
        answer:
          'No. VCPL Tools produces completely clean output PDFs with zero watermarks or branding.',
      },
      {
        question: 'Why does an encrypted PDF fail to merge?',
        answer:
          'Password-protected PDFs must be decrypted first using the PDF Unlocker tool before they can be combined with other files.',
      },
    ],
  },

  'pdf-splitter': {
    toolId: 'pdf-splitter',
    seoTitle: 'Split PDF & Extract Specific Pages Online Locally – VCPL Tools',
    seoDescription:
      'Extract exact page ranges or select individual pages from any PDF document directly in your browser with instant clean PDF export.',
    adTopic: 'Document Management & Office PDF Productivity',
    focusKeywords: ['split PDF pages', 'extract pages from PDF', 'browser PDF splitter'],
    overview: [
      'Whether you need to pull a single invoice page from a 100-page billing bundle or separate individual chapters from a scanned report, the VCPL Tools PDF Splitter extracts exact pages without uploading the entire file to external servers.',
    ],
    howToUse: [
      {
        stepTitle: 'Upload the Source PDF',
        detail:
          'Select any multi-page PDF document from your device.',
      },
      {
        stepTitle: 'Specify Page Ranges or Click Pages',
        detail:
          'Type ranges such as "1-3, 5, 8-10" or select individual page cards visually.',
      },
      {
        stepTitle: 'Extract & Download',
        detail:
          'Generate and save your new lightweight PDF containing only the selected pages.',
      },
    ],
    keyBenefits: [
      {
        title: 'Precision Page Selection',
        detail:
          'Extract single pages, non-contiguous selections, or multi-page ranges accurately.',
      },
      {
        title: 'Private In-Browser Processing',
        detail:
          'Full master documents never leave your device.',
      },
    ],
    faqs: [
      {
        question: 'Can I extract non-consecutive pages like pages 1, 4, and 9?',
        answer:
          'Yes. Enter comma-separated page numbers or ranges (for example, 1, 4, 7-9) to extract them into one new PDF.',
      },
    ],
  },

  'pdf-compressor': {
    toolId: 'pdf-compressor',
    seoTitle: 'Compress PDF Size for Government & Bank Portals – VCPL Tools',
    seoDescription:
      'Reduce heavy scanned PDF file sizes locally in your browser to meet strict 200 KB, 500 KB, or 2 MB upload limits on tax and government portals.',
    adTopic: 'Document Optimization & Portal Compliance Tools',
    focusKeywords: ['compress PDF under 500KB', 'reduce PDF file size', 'shrink scanned PDF'],
    overview: [
      'Indian banking, MCA, GST, scholarship, and job portals enforce strict upload size caps (often 200 KB, 500 KB, or 1 MB). The VCPL Tools PDF Compressor optimizes page rendering and structure right inside your browser so heavy scanned documents meet portal limits cleanly.',
    ],
    howToUse: [
      {
        stepTitle: 'Select Your Heavy PDF File',
        detail:
          'Load any oversized scanned PDF or exported document.',
      },
      {
        stepTitle: 'Select Compression Quality Preset',
        detail:
          'Pick balanced readability or high compression depending on your target KB/MB size limit.',
      },
      {
        stepTitle: 'Compress & Verify File Size',
        detail:
          'Inspect the before-and-after byte savings and download the compressed PDF.',
      },
    ],
    keyBenefits: [
      {
        title: 'Meet Strict Portal Upload Caps',
        detail:
          'Shrink multi-megabyte scans for seamless submission on government, university, and bank portals.',
      },
      {
        title: 'Before/After Size Preview',
        detail:
          'Verify exact KB reduction immediately before downloading.',
      },
    ],
    faqs: [
      {
        question: 'Should I check readability after heavy compression?',
        answer:
          'Yes. Always open the compressed PDF to ensure fine print, signatures, and stamp seals remain clearly legible before uploading to an official portal.',
      },
    ],
  },

  'image-to-pdf': {
    toolId: 'image-to-pdf',
    seoTitle: 'Convert JPG, PNG & WebP Images to A4 PDF Online – VCPL Tools',
    seoDescription:
      'Convert multiple JPG, PNG, or WebP photos and document scans into a clean A4 Portrait or Landscape PDF document locally in your browser.',
    adTopic: 'Document Scanning & Mobile Office Tools',
    focusKeywords: ['image to PDF converter', 'JPG to A4 PDF', 'photos to PDF offline'],
    overview: [
      'Turning phone photos of receipts, ID cards, handwritten notes, or bank cheques into a neat multi-page A4 PDF is effortless with the Image to PDF Converter. Images are fitted cleanly onto A4 Portrait or Landscape pages directly inside your browser.',
    ],
    howToUse: [
      {
        stepTitle: 'Upload JPG, PNG, or WebP Images',
        detail:
          'Add one or multiple photos in any order.',
      },
      {
        stepTitle: 'Configure Orientation & Margins',
        detail:
          'Select A4 Portrait or Landscape and adjust page fit margins.',
      },
      {
        stepTitle: 'Generate & Download PDF',
        detail:
          'Export a crisp multi-page PDF ready for email or portal upload.',
      },
    ],
    keyBenefits: [
      {
        title: 'Automatic A4 Page Scaling',
        detail:
          'Centers mixed-resolution phone photos neatly without awkward clipping.',
      },
      {
        title: 'Supports JPG, PNG & WebP',
        detail:
          'Works directly with screenshots, camera photos, and scanner exports.',
      },
    ],
    faqs: [
      {
        question: 'Can I combine 10 receipt photos into one single PDF?',
        answer:
          'Yes. Upload all images together, arrange their sequence, and export them as a single multi-page PDF.',
      },
    ],
  },

  'pdf-to-jpg': {
    toolId: 'pdf-to-jpg',
    seoTitle: 'PDF to JPG & PNG Image Converter (Up to 300 DPI + ZIP) – VCPL Tools',
    seoDescription:
      'Render PDF pages as sharp JPG or PNG images up to 300 DPI locally in your browser with single-page download or full ZIP export.',
    adTopic: 'Graphic Design & Document Publishing Utilities',
    focusKeywords: ['PDF to JPG 300 DPI', 'PDF to PNG converter', 'extract PDF pages as images'],
    overview: [
      'Need to embed a PDF certificate, invoice page, or brochure into a presentation, WhatsApp message, or social post? The PDF to Image Converter renders each PDF page into sharp JPG or PNG graphics at selectable DPI directly in your browser.',
    ],
    howToUse: [
      {
        stepTitle: 'Load Any PDF Document',
        detail:
          'Drop your single or multi-page PDF file into the converter.',
      },
      {
        stepTitle: 'Choose Format (JPG/PNG) & DPI Resolution',
        detail:
          'Pick PNG for sharp text/diagrams or JPG for smaller photo-friendly sizes up to 300 DPI.',
      },
      {
        stepTitle: 'Download Individual Images or All as ZIP',
        detail:
          'Save individual rendered pages or click Download All ZIP for multi-page documents.',
      },
    ],
    keyBenefits: [
      {
        title: 'Crisp Print-Grade DPI Rendering',
        detail:
          'Up to 300 DPI output keeps small invoice tables and signatures sharp.',
      },
      {
        title: 'One-Click Multi-Page ZIP Download',
        detail:
          'Export entire multi-page PDFs into organized image files effortlessly.',
      },
    ],
    faqs: [
      {
        question: 'Should I choose PNG or JPG?',
        answer:
          'Choose PNG for crisp text, tables, and diagrams; choose JPG when smaller file size is required.',
      },
    ],
  },

  'pdf-watermark-maker': {
    toolId: 'pdf-watermark-maker',
    seoTitle: 'Add Custom Text Watermark to PDF Offline – VCPL Tools',
    seoDescription:
      'Stamp diagonal CONFIDENTIAL, DRAFT, or COPY text watermarks onto every PDF page with custom opacity and color locally in your browser.',
    adTopic: 'Legal Document Security & Compliance Tools',
    focusKeywords: ['add watermark to PDF', 'PDF confidential stamp', 'browser PDF watermark'],
    overview: [
      'When sharing draft quotations, internal audit working papers, or KYC copies with third parties, stamping a clear diagonal watermark (such as CONFIDENTIAL, FOR KYC ONLY, or DRAFT) protects document intent.',
    ],
    howToUse: [
      {
        stepTitle: 'Select Your PDF File',
        detail:
          'Upload the PDF document requiring a watermark stamp.',
      },
      {
        stepTitle: 'Customize Text, Opacity & Color',
        detail:
          'Type your custom watermark phrase, set transparency so underlying text stays readable, and pick ink color.',
      },
      {
        stepTitle: 'Apply & Download Watermarked PDF',
        detail:
          'Stamp all pages instantly in browser memory and save the finished PDF.',
      },
    ],
    keyBenefits: [
      {
        title: 'Controlled Opacity Readability',
        detail:
          'Balances clear ownership marking while keeping underlying text and numbers legible.',
      },
      {
        title: 'Safe for KYC & Sensitive Quotes',
        detail:
          'Never uploads sensitive identity documents to third-party watermark servers.',
      },
    ],
    faqs: [
      {
        question: 'Can I use custom phrases like "FOR BANK LOAN KYC ONLY"?',
        answer:
          'Yes. Enter any custom phrase and adjust opacity and font scale before exporting.',
      },
    ],
  },

  'pdf-signer': {
    toolId: 'pdf-signer',
    seoTitle: 'Free Online PDF e-Signature Tool (Draw & Stamp Locally) – VCPL Tools',
    seoDescription:
      'Draw your smooth ink signature on a digital pad, position it on any PDF page, and download the signed PDF locally with zero uploads.',
    adTopic: 'Digital Contracts & Paperless Office Workflows',
    focusKeywords: ['sign PDF online free', 'draw signature on PDF', 'client-side PDF signer'],
    overview: [
      'Printing, signing with a pen, and rescanning single-page letters or authorization forms wastes paper and degrades print clarity. The PDF e-Signature Tool lets you draw a crisp ink signature inside your browser and stamp it cleanly onto your chosen page.',
    ],
    howToUse: [
      {
        stepTitle: 'Upload the PDF to Sign',
        detail:
          'Select your PDF agreement, declaration, or form.',
      },
      {
        stepTitle: 'Draw Your Signature on the Ink Pad',
        detail:
          'Use your mouse, trackpad, or touchscreen to draw a clean black or blue ink signature.',
      },
      {
        stepTitle: 'Position & Export Signed PDF',
        detail:
          'Select the target page and placement coordinates, then download your signed PDF.',
      },
    ],
    keyBenefits: [
      {
        title: 'No Printing or Rescanning Needed',
        detail:
          'Keep digital PDFs sharp and searchable while adding clean handwritten signatures.',
      },
      {
        title: 'Private Local Signature Pad',
        detail:
          'Your signature image and document remain strictly inside local browser memory.',
      },
    ],
    faqs: [
      {
        question: 'Is a drawn signature equivalent to an Aadhaar DSC digital certificate?',
        answer:
          'No. This tool places a visual ink signature stamp for everyday letters and acknowledgements; statutory filings requiring cryptographic Class-3 DSC or Aadhaar eSign still require official DSC tokens.',
      },
    ],
  },

  'pdf-unlocker': {
    toolId: 'pdf-unlocker',
    seoTitle: 'Unlock Password-Protected Bank Statement & e-Aadhaar PDFs – VCPL Tools',
    seoDescription:
      'Decrypt known-password bank statement, credit card, or e-Aadhaar PDFs locally in your browser so you can print, merge, or archive them easily.',
    adTopic: 'Banking Utility & Personal Document Tools',
    focusKeywords: ['unlock PDF password', 'decrypt bank statement PDF', 'remove PDF password offline'],
    overview: [
      'Monthly bank statements, credit card bills, and Form 26AS PDFs frequently require entering complex PAN or date-of-birth passwords every time you open or merge them. Once you supply the rightful password locally, the PDF Unlocker outputs a decrypted copy for convenient archiving or spreadsheet parsing.',
    ],
    howToUse: [
      {
        stepTitle: 'Select Your Password-Protected PDF',
        detail:
          'Upload the encrypted statement or official PDF file.',
      },
      {
        stepTitle: 'Enter the Document Password',
        detail:
          'Type the known password (for example your PAN or DOB combination) into the local prompt.',
      },
      {
        stepTitle: 'Decrypt & Save Unlocked PDF',
        detail:
          'Download an unencrypted copy ready for Form 26AS extraction, merging, or hassle-free viewing.',
      },
    ],
    keyBenefits: [
      {
        title: 'Passwords Never Leave Your Device',
        detail:
          'Decryption runs strictly inside your browser so your PAN/DOB passwords are never transmitted over the network.',
      },
      {
        title: 'Enables Merging & Excel Parsing',
        detail:
          'Makes statements compatible with PDF Merger, Splitter, and Form 26AS converters.',
      },
    ],
    faqs: [
      {
        question: 'Can this tool crack an unknown PDF password?',
        answer:
          'No. You must provide the legitimate document password to decrypt and save an unlocked copy.',
      },
    ],
  },

  'pdf-password-protector': {
    toolId: 'pdf-password-protector',
    seoTitle: 'Protect & Encrypt PDF with Password Offline – VCPL Tools',
    seoDescription:
      'Lock sensitive financial statements, invoices, or KYC PDFs with a user password directly inside your browser before sharing.',
    adTopic: 'Cybersecurity & Document Encryption Tools',
    focusKeywords: ['protect PDF with password', 'encrypt PDF offline', 'lock PDF file free'],
    overview: [
      'Before emailing salary slips, balance sheets, or KYC proofs over public networks, adding password protection provides an essential layer of access control. The PDF Password Protector locks your document locally inside your browser.',
    ],
    howToUse: [
      {
        stepTitle: 'Select the PDF to Protect',
        detail:
          'Load any unencrypted PDF document.',
      },
      {
        stepTitle: 'Set a Strong Access Password',
        detail:
          'Enter and confirm a secure password for opening the PDF.',
      },
      {
        stepTitle: 'Encrypt & Download Protected PDF',
        detail:
          'Save the locked PDF and share the password separately with the intended recipient.',
      },
    ],
    keyBenefits: [
      {
        title: 'Client-Side Encryption',
        detail:
          'Neither your unencrypted file nor your chosen password ever reaches a remote server.',
      },
      {
        title: 'Universal PDF Reader Support',
        detail:
          'Standard PDF protection compatible with Adobe Reader, Chrome, Edge, and mobile viewers.',
      },
    ],
    faqs: [
      {
        question: 'Can I recover a locked PDF if I forget the password?',
        answer:
          'No. Always retain an unencrypted backup or store your password securely in a password manager.',
      },
    ],
  },

  'multilingual-typing-test': {
    toolId: 'multilingual-typing-test',
    seoTitle: 'English, Hindi & Kannada Typing Speed Test (WPM & KDPH) – VCPL Tools',
    seoDescription:
      'Practice timed English (35 WPM), Hindi Devanagari (30 WPM), and Kannada typing tests with Net WPM, KDPH, and error accuracy metrics.',
    adTopic: 'Government Exam Prep, SSC & KPSC Skill Training',
    focusKeywords: [
      'English Hindi Kannada typing test',
      'SSC CPCT typing practice',
      'KPSC Kannada typing speed test',
      'WPM KDPH calculator',
    ],
    overview: [
      'Aspirants preparing for SSC CGL/CHSL, CPCT, High Court Clerk, and Karnataka KPSC typing skill exams need accurate practice environments tracking Gross WPM, Net WPM, Key Depressions Per Hour (KDPH), and character accuracy across English, Hindi, and Kannada.',
      'The Multilingual Typing Test brings timed practice passages in all three languages together in a distraction-free workspace.',
    ],
    howToUse: [
      {
        stepTitle: 'Select Language & Duration',
        detail:
          'Choose English, Hindi Devanagari, or Kannada, and set your preferred timed drill (1, 3, 5, or 10 minutes).',
      },
      {
        stepTitle: 'Type the Highlighted Passage',
        detail:
          'Begin typing inside the workspace. The timer starts automatically on your first keystroke and highlights correct vs mistyped characters live.',
      },
      {
        stepTitle: 'Review Net WPM, KDPH & Accuracy',
        detail:
          'Inspect your final speed score, keystrokes per hour, and accuracy percentage upon completion.',
      },
    ],
    keyBenefits: [
      {
        title: 'Exam-Style WPM & KDPH Metrics',
        detail:
          'Tracks Net WPM and Key Depressions Per Hour aligned with Indian clerical skill test benchmarks.',
      },
      {
        title: 'Three Regional & Official Languages',
        detail:
          'Switch seamlessly between English, Hindi Devanagari, and Kannada passages.',
      },
    ],
    faqs: [
      {
        question: 'How is Net WPM calculated?',
        answer:
          'Net WPM deducts uncorrected typing errors from your gross word speed per minute, giving an accurate measure of clean output.',
      },
    ],
  },

  'word-counter': {
    toolId: 'word-counter',
    seoTitle: 'Online Word, Character, Sentence & Essay Limit Counter – VCPL Tools',
    seoDescription:
      'Count words, characters with and without spaces, sentences, paragraphs, and reading time instantaneously inside your browser.',
    adTopic: 'Content Writing, SEO & Academic Tools',
    focusKeywords: ['word counter online', 'character limit checker', 'essay word count'],
    overview: [
      'Whether drafting descriptive exam essays, SEO meta descriptions, or social captions with strict character caps, the Word & Character Counter computes exact metrics instantaneously as you type or paste text.',
    ],
    howToUse: [
      {
        stepTitle: 'Paste or Type Your Text',
        detail:
          'Enter your draft directly into the editor area.',
      },
      {
        stepTitle: 'Review Live Counts & Reading Time',
        detail:
          'Monitor total words, characters (with/without spaces), sentences, paragraphs, and estimated reading duration.',
      },
    ],
    keyBenefits: [
      {
        title: 'Real-Time Character & Essay Limits',
        detail:
          'Prevents accidental truncation on exam portals, SEO snippets, and form text boxes.',
      },
      {
        title: 'Zero Draft Storage',
        detail:
          'Confidential emails and drafts never leave your browser.',
      },
    ],
    faqs: [
      {
        question: 'Does the tool count characters without spaces separately?',
        answer:
          'Yes, both total characters (including spaces) and characters excluding spaces are displayed side by side.',
      },
    ],
  },

  'case-converter': {
    toolId: 'case-converter',
    seoTitle: 'Text Case Converter (UPPER, lower, Title, camelCase) – VCPL Tools',
    seoDescription:
      'Transform text formatting between UPPERCASE, lowercase, Title Case, Sentence case, camelCase, snake_case, and clean whitespace instantly.',
    adTopic: 'Developer Utilities & Content Formatting',
    focusKeywords: ['text case converter', 'title case generator', 'uppercase to lowercase'],
    overview: [
      'Fix accidental Caps Lock blocks, standardize database column names, or format article headings cleanly in one click using 8 deterministic text transformations.',
    ],
    howToUse: [
      {
        stepTitle: 'Paste Unformatted Text',
        detail:
          'Paste headings, lists, or code identifiers into the input panel.',
      },
      {
        stepTitle: 'Click Target Case Mode',
        detail:
          'Choose UPPERCASE, lowercase, Title Case, Sentence case, camelCase, snake_case, or Trim Extra Spaces, then copy the result.',
      },
    ],
    keyBenefits: [
      {
        title: '8 Instant Formatting Modes',
        detail:
          'Covers both editorial copywriting and software naming conventions.',
      },
      {
        title: 'One-Click Clipboard Copy',
        detail:
          'Transfer clean formatted text straight into Word, Excel, or code editors.',
      },
    ],
    faqs: [
      {
        question: 'Can it strip double spaces and messy line breaks?',
        answer:
          'Yes, use the whitespace cleanup option before copying your text.',
      },
    ],
  },

  'qr-code-generator': {
    toolId: 'qr-code-generator',
    seoTitle: 'UPI QR Studio & Bank IFSC Payment QR Generator – VCPL Tools',
    seoDescription:
      'Create NPCI UPI payment QRs with quick VPA handles or Bank A/C + IFSC, set optional fixed amount & remarks, and download printable Counter Standee JPGs.',
    adTopic: 'Retail POS, Merchant UPI & Small Business Tools',
    focusKeywords: [
      'UPI QR code generator',
      'printable UPI standee',
      'merchant payment QR PNG',
      'bank IFSC UPI QR',
    ],
    overview: [
      'Shopkeepers, freelancers, and businesses can generate high-contrast NPCI UPI payment QR codes with 1-click bank handle pills (@okaxis, @okicici, @ybl, @paytm, @oksbi, @okhdfcbank) or Bank A/C + IFSC links, optional fixed INR amount, and remarks—plus export ready-to-print Counter Standee JPGs.',
    ],
    howToUse: [
      {
        stepTitle: 'Choose Mode (UPI ID or Bank A/C + IFSC)',
        detail:
          'Enter your UPI VPA and pick quick bank handles, or switch to Bank A/C + IFSC to construct an NPCI-standard settlement link.',
      },
      {
        stepTitle: 'Set Amount, Payee Name & Remarks',
        detail:
          'Leave amount blank for variable payer entry or enter a fixed rupee amount for faster retail checkout.',
      },
      {
        stepTitle: 'Copy URI, Download PNG, Share or Export Standee JPG',
        detail:
          'Copy the shareable upi://pay link, download crisp PNG matrices, share directly, or export a Counter Standee JPG for your shop desk.',
      },
    ],
    keyBenefits: [
      {
        title: '0% MDR Direct UPI Settlement',
        detail:
          'Encodes pure NPCI upi://pay links directly with zero intermediary fees or payment redirects.',
      },
      {
        title: 'Printable Counter Standee Export',
        detail:
          'Download a crisp 640×880px retail payment standee JPG displaying your business name, requested amount, and UPI ID.',
      },
    ],
    faqs: [
      {
        question: 'Why do some UPI apps warn on raw Bank A/C + IFSC QR codes?',
        answer:
          'Although <account>@<ifsc>.ifsc.npci is supported by NPCI, consumer apps may display an unverified caution. Using a standard VPA (e.g. name@okhdfcbank) works seamlessly across 100% of apps.',
      },
      {
        question: 'Do UPI QR codes created here expire?',
        answer:
          'No. Standard static UPI VPA QR codes remain valid as long as your bank UPI ID remains active.',
      },
    ],
  },

  'barcode-generator': {
    toolId: 'barcode-generator',
    seoTitle: 'Retail EAN-13, CODE128 & CODE39 Barcode Generator PNG – VCPL Tools',
    seoDescription:
      'Generate crisp scannable retail EAN-13, SKU CODE128, and warehouse CODE39 barcodes in PNG format directly inside your browser.',
    adTopic: 'Inventory Management, Retail & Logistics Systems',
    focusKeywords: ['CODE128 barcode generator', 'EAN-13 PNG generator', 'inventory SKU barcode'],
    overview: [
      'Print clean SKU labels for retail inventory, asset tags, or shipping cartons using industry-standard CODE128, EAN-13, and CODE39 barcode symbologies generated locally inside your browser.',
    ],
    howToUse: [
      {
        stepTitle: 'Select Symbology Format',
        detail:
          'Pick CODE128 for alphanumeric SKUs, EAN-13 for 12/13-digit retail products, or CODE39 for logistics tags.',
      },
      {
        stepTitle: 'Enter Code Value & Label Options',
        detail:
          'Type your product code and toggle human-readable text below the bars.',
      },
      {
        stepTitle: 'Download PNG Label',
        detail:
          'Save the high-contrast barcode PNG for printing onto adhesive labels or Excel invoices.',
      },
    ],
    keyBenefits: [
      {
        title: 'Instant Scannable Precision',
        detail:
          'Renders crisp pixel-aligned bars compatible with standard laser and camera barcode scanners.',
      },
      {
        title: 'Supports Retail & Warehouse Standards',
        detail:
          'Covers EAN-13, CODE128, and CODE39 inside one lightweight generator.',
      },
    ],
    faqs: [
      {
        question: 'Which format works best for internal store SKUs?',
        answer:
          'CODE128 is compact and supports letters, numbers, and hyphens, making it ideal for internal inventory SKUs.',
      },
    ],
  },

  'number-to-words': {
    toolId: 'number-to-words',
    seoTitle: 'Indian Rupees (INR) Number to Words Converter (Lakhs & Crores) – VCPL Tools',
    seoDescription:
      'Convert INR numeric amounts with Lakhs, Crores, and Paise into exact bank cheque and GST invoice wording instantly.',
    adTopic: 'Accounting, Billing & Financial Documentation',
    focusKeywords: ['INR number to words', 'rupees in words lakhs crores', 'cheque amount in words'],
    overview: [
      'Writing large Indian amounts correctly in Lakhs, Crores, and Paise on bank cheques, RTGS forms, and GST tax invoices avoids costly bank rejections. The INR Number to Words Converter turns any numeric figure into clean, standardized Indian currency phrasing instantly.',
    ],
    howToUse: [
      {
        stepTitle: 'Enter Any Numeric INR Amount',
        detail:
          'Type whole rupees or decimal paise (for example 1245678.50).',
      },
      {
        stepTitle: 'Pick Formatting Style & Copy Output',
        detail:
          'Switch between Cheque Style ("Rupees ... Only"), Title Case, or Uppercase and copy in one click.',
      },
    ],
    keyBenefits: [
      {
        title: 'Authentic Indian Numbering System',
        detail:
          'Formats Thousands, Lakhs, Crores, and Paise accurately—never confusing Millions with Lakhs.',
      },
      {
        title: 'Eliminates Cheque Rejection Errors',
        detail:
          'Verify exact spelling and wording before writing physical cheques or legal agreements.',
      },
    ],
    faqs: [
      {
        question: 'Does it support Paise decimals accurately?',
        answer:
          'Yes. Two-digit decimals are converted cleanly (for example, ".50" becomes "and Fifty Paise Only").',
      },
    ],
  },

  'password-generator': {
    toolId: 'password-generator',
    seoTitle: 'Cryptographic Random Password Generator (Web Crypto API) – VCPL Tools',
    seoDescription:
      'Generate strong random passwords locally using the browser Web Crypto API with configurable length, symbols, and zero network storage.',
    adTopic: 'Cybersecurity & Business Account Protection',
    focusKeywords: ['secure password generator', 'Web Crypto password generator', 'offline random password'],
    overview: [
      'Creating strong, non-repeating passwords for banking portals, GST logins, and corporate email accounts reduces credential stuffing risks. This tool uses your browser’s cryptographically secure `window.crypto.getRandomValues` engine—never predictable `Math.random()` and never sent over the internet.',
    ],
    howToUse: [
      {
        stepTitle: 'Configure Length & Character Sets',
        detail:
          'Choose password length (8 to 64 characters) and toggle uppercase, lowercase, numbers, and special symbols.',
      },
      {
        stepTitle: 'Generate & Copy Locally',
        detail:
          'Click Regenerate until satisfied, copy directly to your password manager, and clear clipboard after saving.',
      },
    ],
    keyBenefits: [
      {
        title: 'Hardware-Backed Web Crypto Entropy',
        detail:
          'Generates genuinely unpredictable random strings directly in local browser memory.',
      },
      {
        title: 'Zero History or Server Logging',
        detail:
          'Generated passwords are never saved, logged, or transmitted anywhere.',
      },
    ],
    faqs: [
      {
        question: 'Is it safe to generate banking passwords here?',
        answer:
          'Yes. Everything executes locally via the Web Crypto API, and nothing is stored or transmitted when you close the page.',
      },
    ],
  },
  'pdf-form-filler': {
    toolId: 'pdf-form-filler',
    seoTitle: 'Smart PDF & Photo Form Filler – Fill Bank, KYC & Application Forms | VCPL Tools',
    seoDescription:
      'Fill digital PDFs or camera photos of paper forms in your browser. Auto-detects comb letter boxes, DD/MM/YYYY grids, underlines, checkboxes, signatures, and passport photos with KB size-limit compression.',
    adTopic: 'PDF Form Filling, KYC Documentation & Portal Uploads',
    focusKeywords: [
      'smart pdf form filler',
      'fill paper form photo',
      'comb box pdf filler',
      'add signature and passport photo to pdf',
      'compress filled pdf under 200kb',
    ],
    overview: [
      'The Smart PDF & Photo Form Filler (PD-10) lets you complete Indian bank KYC forms, scholarship applications, admission booklets, and government PDFs directly inside your browser without printing or scanning back and forth.',
      'Unlike basic text stampers, tapping inside a row of character boxes or a DD / MM / YYYY grid automatically splits your letters cleanly across each individual box. You can also take a photo of a paper form—automatic paper lighting cleanup removes uneven shadows—and fit signatures or passport photos into any box.',
    ],
    howToUse: [
      {
        stepTitle: 'Open a PDF Form, Camera Photo, or Sample Form',
        detail:
          'Drop any multi-page PDF (even password-protected files) or a JPG/PNG photo of a printed form. Drafts auto-save locally in your browser so you can resume anytime.',
      },
      {
        stepTitle: 'Tap Boxes, Lines, Checkboxes, Signature & Photo Areas',
        detail:
          'Use Type, Tick, Cross, Date, Sign, and Photo modes. Tap letter grids to fill block characters automatically, or tap My Details chips for one-click Name, DOB, Mobile, and Address insertion.',
      },
      {
        stepTitle: 'Save Crisp Vector PDF or Shrink for Portal Upload Limits',
        detail:
          'Click Save PDF to export an exact vector-overlay PDF, or pick Under 100 KB, 200 KB, 300 KB, 500 KB, or 1 MB presets to satisfy strict upload portal limits.',
      },
    ],
    keyBenefits: [
      {
        title: 'Automatic Comb & Grouped Date Box Alignment',
        detail:
          'Detects individual letter cells and DD / MM / YYYY gaps automatically so block-letter entries never drift out of boxes.',
      },
      {
        title: 'Paper Photo Cleanup & Transparent Signature Extraction',
        detail:
          'Removes uneven lighting from camera form photos and strips paper grayness from photographed ink signatures.',
      },
      {
        title: 'Exact File-Size Portal Compression',
        detail:
          'Optimizes multi-page filled forms cleanly under common portal thresholds (100 KB – 1 MB) without leaving your device.',
      },
    ],
    faqs: [
      {
        question: 'Does it work on flat or scanned PDFs that do not have fillable fields?',
        answer:
          'Yes. Its built-in pixel geometry detector identifies comb letter grids, rectangular table cells, underlines, and checkboxes on any flat PDF or paper photo.',
      },
      {
        question: 'Are my Aadhaar, PAN, photo, or signature details uploaded anywhere?',
        answer:
          'Never. All PDF rendering, paper cleanup, signature extraction, Saved My Details storage, and PDF generation run 100% locally inside your browser.',
      },
    ],
  },

  'pdf-to-word': {
    toolId: 'pdf-to-word',
    seoTitle: 'PDF to Word (DOCX) Converter Online Free – VCPL Tools',
    seoDescription:
      'Convert PDF documents into editable Microsoft Word (.DOCX) locally in your browser while preserving headings, paragraphs, tables, and page breaks.',
    adTopic: 'PDF to Word Document Conversion & Office Productivity',
    focusKeywords: ['pdf to word', 'pdf to docx converter', 'editable word from pdf'],
    overview: [
      'Convert reports, agreements, invoices, and notices from static PDF files into fully editable Microsoft Word (.DOCX) documents without uploading private files to external servers.',
      'Our coordinate-aware PDF parser detects bold headings, normal paragraphs, multi-column tabular grids, and page breaks to generate clean Word sections and native Word tables.',
    ],
    howToUse: [
      { stepTitle: 'Drop Your PDF File', detail: 'Drag and drop any PDF file or click Browse Files inside the converter.' },
      { stepTitle: 'Inspect Extracted Preview', detail: 'Review detected page text and table counts once conversion completes.' },
      { stepTitle: 'Download Editable .DOCX', detail: 'Click Download Output File to save your Word document ready for editing.' },
    ],
    keyBenefits: [
      { title: 'Native Tables & Headings', detail: 'Coordinate clustering preserves multi-column tables and typographic hierarchy.' },
      { title: '100% Private Browser Parsing', detail: 'Zero server upload—ideal for contracts, audit reports, and financial filings.' },
    ],
    faqs: [
      {
        question: 'Does PDF to Word preserve tables and headings?',
        answer: 'Yes. Lines with larger or bold fonts become Word headings, and multi-column coordinate rows are exported as native Word tables.',
      },
    ],
  },

  'pdf-to-excel': {
    toolId: 'pdf-to-excel',
    seoTitle: 'PDF to Excel (XLSX) Table Extractor Online – VCPL Tools',
    seoDescription:
      'Extract PDF tables and structured columns into multi-sheet Excel (.XLSX) workbooks locally inside your browser.',
    adTopic: 'Financial Data Extraction & Excel Spreadsheets',
    focusKeywords: ['pdf to excel', 'pdf to xlsx', 'extract pdf table to excel'],
    overview: [
      'Convert tabular PDFs such as ledger extracts, price lists, and statements into clean Excel (.XLSX) sheets in seconds. Each PDF page becomes an organized worksheet alongside an All_Pages summary tab.',
    ],
    howToUse: [
      { stepTitle: 'Upload a Tabular PDF', detail: 'Select or drop your PDF document inside the converter dropzone.' },
      { stepTitle: 'Verify Column Grid Preview', detail: 'Inspect the extracted row/column preview directly in the workspace.' },
      { stepTitle: 'Download .XLSX Workbook', detail: 'Click Download to open the generated workbook in Excel, LibreOffice, or Google Sheets.' },
    ],
    keyBenefits: [
      { title: 'Coordinate Column Separation', detail: 'Automatically splits spaced numbers and descriptions into distinct spreadsheet columns.' },
      { title: 'Multi-Page Sheet Tabs', detail: 'Keeps individual page tabs plus a consolidated All_Pages sheet for large statements.' },
    ],
    faqs: [
      {
        question: 'Can I preview extracted rows before downloading?',
        answer: 'Yes, the first 25 extracted rows render in a live spreadsheet preview table immediately after conversion.',
      },
    ],
  },

  'image-bg-remover': {
    toolId: 'image-bg-remover',
    seoTitle: 'Image Background Remover (Normal & Advanced Alpha Matting) – VCPL Tools',
    seoDescription:
      'Remove photo backgrounds locally in your browser using Fast Normal Flood-Fill or Advanced CIELAB Alpha Matting with interactive Pick BG, Keep, and Erase brushes.',
    adTopic: 'AI-Grade Image Cutout & Graphic Design Tools',
    focusKeywords: ['image background remover', 'remove background transparent png', 'advanced alpha matting'],
    overview: [
      'Create transparent PNG or WEBP cutouts for product photos, ID portraits, signatures, and logos without server uploads or per-image limits.',
      'Choose Normal Mode for fast uniform background cleanup, or switch to Advanced Mode for CIELAB perceptual delta-E matching, Sobel edge barriers, fringe color decontamination, and interactive Pick BG, Keep, and Erase refinement brushes.',
    ],
    howToUse: [
      { stepTitle: 'Upload JPG, PNG, or WEBP Photo', detail: 'Drop any photo or logo into the Background Remover workspace.' },
      { stepTitle: 'Choose Normal or Advanced Mode', detail: 'Adjust Tolerance & Feather sliders, and use Pick BG to sample interior enclosed backgrounds.' },
      { stepTitle: 'Refine & Download Transparent PNG/WEBP', detail: 'Paint Keep or Erase strokes if needed and download your high-resolution transparent cutout.' },
    ],
    keyBenefits: [
      { title: 'Normal & Advanced Precision Engines', detail: 'Sobel edge-gradient detection protects sharp subject contours while feathering soft hair/edges.' },
      { title: 'Interactive Refinement Brushes', detail: 'Fine-tune cutouts directly on the canvas with live checkerboard, white, or dark backdrop previews.' },
    ],
    faqs: [
      {
        question: 'How does Advanced Mode differ from Normal Mode?',
        answer: 'Advanced Mode uses CIELAB perceptual color distance, Sobel edge-barrier weighting, soft alpha ramping, and fringe decontamination for cleaner subject edges compared to standard RGB flood fill.',
      },
    ],
  },

  'jpg-crop': {
    toolId: 'jpg-crop',
    seoTitle: 'Interactive JPG / PNG / WEBP Image Cropper Online – VCPL Tools',
    seoDescription:
      'Crop images online with drag-and-resize crop handles, Freeform, 1:1, 4:3, 16:9, 3:2, Portrait & Landscape presets, rotate, flip, and quality controls.',
    adTopic: 'Online Photo Editing & Image Cropping Tools',
    focusKeywords: ['jpg crop', 'png crop', 'webp crop', 'aspect ratio image cropper'],
    overview: [
      'Crop JPG, PNG, and WEBP images with pixel-accurate drag-and-resize handles, rule-of-thirds composition guides, and one-click aspect ratio presets including Square (1:1), 4:3, 16:9, 3:2, Portrait (3:4), and Landscape.',
    ],
    howToUse: [
      { stepTitle: 'Upload an Image', detail: 'Drop a JPG, PNG, or WEBP image into the interactive crop canvas.' },
      { stepTitle: 'Set Aspect Ratio & Drag Handles', detail: 'Choose Freeform or any aspect ratio, drag corners or interior frame, and rotate or flip if needed.' },
      { stepTitle: 'Apply & Download Crop', detail: 'Choose JPG, transparent PNG, or WEBP output, inspect the preview, and download at full quality.' },
    ],
    keyBenefits: [
      { title: '8-Handle Interactive Canvas', detail: 'Drag corners to resize cleanly within bounds or pan the crop rectangle smoothly.' },
      { title: 'Lossless PNG Transparency', detail: 'Export crisp PNG cutouts without unwanted white backgrounds.' },
    ],
    faqs: [
      {
        question: 'Does cropping reduce image quality?',
        answer: 'No. Crops are rendered at full natural image pixel resolution—only clipped to your chosen region—with selectable PNG lossless or high-quality JPG/WEBP encoding.',
      },
    ],
  },

  'dms-tally-reconciler': {
    toolId: 'dms-tally-reconciler',
    seoTitle: 'DMS vs Tally Voucher Reconciliation Tool (Multi-File Excel) – VCPL Tools',
    seoDescription:
      'Reconcile Dealer Management System (DMS) Excel/CSV exports against Tally ERP/Prime registers locally in your browser with fuzzy matching, prefix rules, and 7-sheet XLSX export.',
    adTopic: 'Automotive Dealership Accounting & ERP Reconciliation',
    focusKeywords: [
      'DMS vs Tally reconciliation',
      'dealer management system Tally audit',
      'Sales Purchase CN DN Excel match',
      'browser voucher reconciliation',
    ],
    overview: [
      'Dealerships, distributors, and multi-branch teams regularly export Sales, Purchase, Debit Note, and Credit Note registers from their DMS alongside Tally Prime/ERP9 daybooks. Comparing thousands of rows manually for missing vouchers, rounding variances, or invoice prefix mismatches takes hours of spreadsheet VLOOKUP cleanup.',
      'The VCPL Tools DMS vs Tally Reconciliation workspace parses multiple .XLSX, .XLS, or .CSV files on each side right inside your browser, auto-detects headers, applies optional prefix-to-category rules and fuzzy amount/date matching, and builds a downloadable 7-sheet Excel reconciliation workbook.',
    ],
    howToUse: [
      {
        stepTitle: 'Upload DMS & Tally Register Files',
        detail:
          'Drag or browse one or multiple Excel/CSV exports into Side 1 (DMS Report) and Side 2 (Tally Report). Override per-file voucher categories or column mappings if needed.',
      },
      {
        stepTitle: 'Select Voucher Types & Matching Rules',
        detail:
          'Check or uncheck Sales, Purchase, Debit Note, Credit Note, and Other categories, set rupee/date tolerances, and optionally enable Fuzzy Match or prefix normalization rules.',
      },
      {
        stepTitle: 'Reconcile, Filter & Export 7-Sheet Workbook',
        detail:
          'Click Reconcile Now to inspect Matched, Amount diff, Date diff, Type diff, Fuzzy match, Only in DMS, and Only in Tally cards, then export all sheets to Excel.',
      },
    ],
    keyBenefits: [
      {
        title: 'Multi-File Consolidation Per Side',
        detail:
          'Combine separate monthly or branch DMS spreadsheets against consolidated Tally registers in a single pass.',
      },
      {
        title: 'Smart Fuzzy Matching & Prefix Rules',
        detail:
          'Matches leftovers by amount and ±days when invoice prefixes differ between DMS and Tally entries.',
      },
      {
        title: '100% Client-Side Ledger Privacy',
        detail:
          'Confidential party names, sales turnover, and dealership registers never leave your browser.',
      },
    ],
    faqs: [
      {
        question: 'Can I upload multiple Excel files for DMS and Tally together?',
        answer:
          'Yes. Both dropzones support multiple .xlsx, .xls, and .csv files simultaneously, and you can set a per-file category override (for example Credit Note) next to each filename.',
      },
      {
        question: 'What sheets are included in the exported Excel workbook?',
        answer:
          'The downloaded DMS_vs_Tally_Reconciliation.xlsx file includes Summary, All, Matched, Differences, Fuzzy, Only in DMS, and Only in Tally worksheets.',
      },
    ],
  },

  'parts-billing-reconciler': {
    toolId: 'parts-billing-reconciler',
    seoTitle: 'Parts Billing vs Tally Reconciliation Tool (BMW DI / E5) – VCPL Tools',
    seoDescription:
      'Reconcile BMW Parts Billing Excel statements (Reference, DI, E5 adjustments) against single or multi-file Tally Purchase Registers locally with E5 anomaly flags, manual voucher linking, and 7-sheet XLSX export.',
    adTopic: 'Automotive Dealership Parts Accounting & Tally Audit',
    focusKeywords: [
      'Parts Billing vs Tally reconciliation',
      'BMW parts billing Tally audit',
      'DI E5 adjustment anomaly check',
      'Tally purchase register matcher',
    ],
    overview: [
      'Dealership accounts teams regularly audit OEM Parts Billing statements—containing DI gross invoice lines and E5 adjustment memos grouped by Reference—against Tally Purchase Registers and vendor ledgers. Manually matching multi-file Tally exports, catching missing bills, and spotting abnormal E5 adjustment percentages is slow and error-prone.',
      'The VCPL Tools Parts Billing vs Tally Reconciliation engine parses both files locally inside your browser, matches by Reference/Doc Number, tolerance-based Amount + Date Window, or one-click manual voucher linking, flags E5 percentage anomalies, and exports a clean 7-sheet Excel audit workbook.',
    ],
    howToUse: [
      {
        stepTitle: 'Upload BMW Parts Billing & Tally Register File(s)',
        detail:
          'Select your Parts Billing .xlsx/.csv statement and one or more Tally Purchase Register / Ledger exports, then confirm the Tally amount column.',
      },
      {
        stepTitle: 'Configure Filters, Tolerance & Manual Links',
        detail:
          'Optionally filter Tally Particulars (e.g. BMW), set rupee tolerance and date window, and use the Missing in Tally tab to manually link unmatched vouchers.',
      },
      {
        stepTitle: 'Review Date-Wise & Download 7-Sheet Workbook',
        detail:
          'Inspect Summary KPIs, Matched, Amount Differences, Missing in Tally, Only in Tally, and Date-wise tabs, then export Parts_Billing_vs_Tally_Reconciliation.xlsx.',
      },
    ],
    keyBenefits: [
      {
        title: 'Multi-Stage Reference, Amount & Manual Matching',
        detail:
          'Matches 8+ digit Reference/DI numbers automatically, falls back to amount + date-window matching, and lets you manually link remaining entries.',
      },
      {
        title: 'Automatic E5 Adjustment % Anomaly Detection',
        detail:
          'Computes median E5 adjustment percentage across invoices and flags rows with missing or deviating adjustment rates.',
      },
      {
        title: '100% Browser-Local Privacy',
        detail:
          'All parts billing invoices, ledger narrations, and tax totals remain strictly inside browser memory.',
      },
    ],
    faqs: [
      {
        question: 'Can I upload multiple Tally Purchase Register and Ledger files together?',
        answer:
          'Yes. The Tally Register upload field supports selecting multiple .xlsx, .xls, or .csv files at once and merges them into a single reconciliation pass.',
      },
      {
        question: 'What sheets are included in the exported Excel report?',
        answer:
          'The downloaded Parts_Billing_vs_Tally_Reconciliation.xlsx workbook includes Summary, All BMW, Matched, Amount Differences, Missing in Tally, Only in Tally, and Date-wise sheets.',
      },
    ],
  },

  'swatchbook-color-picker': {
    toolId: 'swatchbook-color-picker',
    seoTitle: 'Swatchbook – Advanced Colour Picker (HEX, RGB, OKLCH, WCAG & Palettes) – VCPL Tools',
    seoDescription:
      'Pick colours from interactive HSV canvas or screen eyedropper, convert across HEX/RGB/HSL/CMYK/OKLCH/Tailwind, check WCAG contrast, extract palettes from images, and export CSS/JSON.',
    adTopic: 'UI Design, CSS Styling & Brand Colour Accessibility',
    focusKeywords: [
      'advanced colour picker',
      'OKLCH CSS color converter',
      'WCAG contrast checker',
      'extract colour palette from image',
    ],
    overview: [
      'Swatchbook is an all-in-one browser colour workbench for designers and frontend developers. Sample colours via the 2D HSV picker, screen EyeDropper, or any typed CSS colour string—including hex, rgb(), hsl(), oklch(), and CSS named colours.',
      'Instantly copy 12 developer formats (HEX, RGB, HSL, HSV, CMYK, OKLCH, CSS vars, Tailwind, Swift, Flutter, Android, Decimal), inspect 7 colour harmonies and 11-step tint scales, test WCAG AA/AAA contrast compliance, pull dominant swatches from images locally, and export saved palettes.',
    ],
    howToUse: [
      {
        stepTitle: 'Pick, Type, or Sample a Colour',
        detail:
          'Drag inside the Saturation/Brightness canvas, adjust Hue & Opacity sliders, click Random Colour, or type any CSS colour expression.',
      },
      {
        stepTitle: 'Inspect Formats, Harmonies & WCAG Contrast',
        detail:
          'Click any of the 12 format rows to copy, explore Complementary/Triadic/Monochromatic chips, or verify text readability ratios.',
      },
      {
        stepTitle: 'Extract from Images & Export Saved Palettes',
        detail:
          'Upload any photo to pull dominant colours locally, save swatches to your browser palette, and copy CSS, SCSS, Tailwind config, or JSON output.',
      },
    ],
    keyBenefits: [
      {
        title: '12 Instant Copyable Code Formats',
        detail: 'Includes modern perceptual OKLCH, CMYK, Tailwind classes, Swift UIColor, and Flutter/Android hex codes.',
      },
      {
        title: 'WCAG AA & AAA Accessibility Checker',
        detail: 'Live contrast ratio testing with automatic Best Black / White text selector and live UI preview.',
      },
    ],
    faqs: [
      {
        question: 'Does Swatchbook upload images when extracting colour palettes?',
        answer: 'No. Image pixel quantization runs completely inside an HTML5 Canvas in your browser.',
      },
      {
        question: 'Where is my saved palette stored?',
        answer: 'Your saved colour chips remain locally in your browser localStorage.',
      },
    ],
  },

  'tds-tcs-toolkit': {
    toolId: 'tds-tcs-toolkit',
    seoTitle: 'TDS & TCS Toolkit (Tax Year 2026-27 / Income-tax Act 2025) – VCPL Tools',
    seoDescription:
      'Calculate TDS for Tax Year 2026-27 (AY 2027-28) using PAN 4th-letter rules, Section 392/393/394 codes, threshold catch-ups, GST exclusions, bill ledger, and searchable TDS/TCS charts.',
    adTopic: 'Indian Income Tax, TDS/TCS Compliance & Accounts Payable',
    focusKeywords: [
      'TDS calculator 2026-27',
      'Income-tax Act 2025 Section 393 394',
      '194C 194J 194H TDS rate chart',
      'TDS deposit due date calculator',
    ],
    overview: [
      'Built for Indian accounts payable teams, Chartered Accountants, and businesses transitioning to Tax Year 2026-27 (AY 2027-28) under the Income-tax Act, 2025, this toolkit combines a threshold-aware TDS calculator with searchable TDS & TCS rate charts and Old-to-New section mappings.',
      'Enter the payee PAN to auto-detect Individual/HUF vs Company/Firm rates, exclude GST cleanly when shown separately, track cumulative invoices via the built-in bill ledger with automatic catch-up calculations, apply Section 197 lower deduction rates, and determine exact challan deposit due dates.',
    ],
    howToUse: [
      {
        stepTitle: 'Enter Payee PAN & Nature of Payment',
        detail:
          'Provide the 10-character PAN (to resolve 4th-letter entity type) and choose the payment section (e.g. 194C, 194J, 194I, 194H).',
      },
      {
        stepTitle: 'Add Invoice Amount, GST & Earlier Payments',
        detail:
          'Specify invoice value, toggle GST inclusion/exclusion, enter prior year-to-date payments or Section 197 rate, and set payment date.',
      },
      {
        stepTitle: 'Review TDS, Deposit Date & Browse Rate Charts',
        detail:
          'Check net payable, add bills to the running payee ledger, or switch tabs to browse 2026-27 TDS/TCS rate tables and Section 392/393/394 mappings.',
      },
    ],
    keyBenefits: [
      {
        title: 'Income-tax Act, 2025 Codes & Mappings',
        detail: 'Maps legacy sections (192–206C) directly to new Sections 392, 393, and 394 and renumbered return forms (138, 140, 143, 144).',
      },
      {
        title: 'GST Exclusion & Running Bill Ledger',
        detail: 'Automatically excludes separate GST from TDS base, optionally deducts 2% Govt GST-TDS, and catches up earlier bills when yearly thresholds cross.',
      },
    ],
    faqs: [
      {
        question: 'Is TDS deducted on the GST component of an invoice?',
        answer:
          'When GST is shown separately on the invoice, TDS is calculated on the taxable value before GST while GST is still paid in full to the vendor.',
      },
      {
        question: 'What rate applies if PAN is missing or inoperative?',
        answer:
          'The toolkit automatically applies the higher of twice the normal rate or 20% (5% for Sections 194Q and 194O) whenever PAN is missing, invalid, or inoperative.',
      },
    ],
  },

  'income-tax-fy-2026-27': {
    toolId: 'income-tax-fy-2026-27',
    seoTitle: 'Income Tax Calculator FY 2026-27 (AY 2027-28) Old vs New Regime – VCPL Tools',
    seoDescription:
      'Complete 10-tab Excel formula workbook (v29.0) and Break-Even Deduction Planner for salaried individuals in FY 2026-27 (AY 2027-28). Compare Old vs New Tax Regimes locally.',
    adTopic: 'Indian Income Tax Filing, NPS & Salary Tax Optimization',
    focusKeywords: [
      'Income Tax Calculator FY 2026-27',
      'AY 2027-28 tax regime comparison',
      'Section 87A 12 lakh rebate calculator',
      'Old vs New regime break-even planner',
    ],
    overview: [
      'Built for Indian salaried employees and pensioners planning Financial Year 2026-27 (Assessment Year 2027-28), the VCPL Tools Income Tax Calculator FY 2026-27 combines the complete 10-tab Excel formula workbook (v29.0) with an interactive Break-Even & Marginal Rate Planner.',
      'Enter monthly Apr–Mar salary components, HRA rent paid, PF/VPF, perquisites, NSC accrued interest, stock dividends, Indian & foreign equity capital gains, property/debt MF gains, bank interest, and advance tax/TDS directly inside your browser with automatic localStorage persistence and portable JSON backup.',
    ],
    howToUse: [
      {
        stepTitle: 'Fill Personal Details & Salary Sheet',
        detail:
          'Enter Name, Date of Birth (for senior/super-senior slab logic), and remaining financial year months on Summary, then input monthly or annual figures in yellow cells inside the Tax Calculator tab.',
      },
      {
        stepTitle: 'Add Special Income & Perquisite Tabs',
        detail:
          'Use dedicated sheets for Perquisites, NSC Accrued Int, Dividends, Capital Gains (Equity, Foreign Eq, Property & Debt MF), and Bank Interest / Tax Paid.',
      },
      {
        stepTitle: 'Run Break-Even Planner & Export/Print',
        detail:
          'Switch to the Break-Even & Savings Planner tab to test salary presets, HRA Metro/Non-Metro rules, 80CCD(2) Employer NPS, and next-₹1L marginal tax rates—or export a portable JSON backup anytime.',
      },
    ],
    keyBenefits: [
      {
        title: '10-Tab Formula-Accurate Excel Engine (v29.0)',
        detail:
          'Replicates every cross-sheet Excel formula including Section 87A marginal relief, surcharge marginal relief, HRA 10(13A), perquisite valuation, and Cost Inflation Index.',
      },
      {
        title: 'Binary-Search Break-Even & Cashflow Diagnostics',
        detail:
          'Pinpoints the exact additional Old-Regime deductions needed to beat the New Tax Regime and detects Section 87A cliff effects around ₹12,00,000 taxable income.',
      },
    ],
    faqs: [
      {
        question: 'Does the Income Tax Calculator FY 2026-27 save my entries automatically?',
        answer:
          'Yes. Workbook entries automatically persist inside your browser localStorage, and you can also copy or load a portable JSON backup using the Save / Load button without uploading any financial data to a server.',
      },
      {
        question: 'Are capital gains and bank interest included in the regime comparison?',
        answer:
          'Yes. Dedicated workbook tabs for Equity Capital Gains, Foreign Equity, Property & Debt Mutual Funds, Dividends, and Bank Interest & Advance Tax feed automatically into Summary.',
      },
    ],
  },

  'pdf-editor-advanced': {
    toolId: 'pdf-editor-advanced',
    seoTitle: 'PDF Editor Advanced (Edit Text, OCR, Redact & Organize) – VCPL Tools',
    seoDescription:
      'Create blank PDFs or edit existing PDF text in its original font, Type/Draw/Upload transparent signatures, build custom stamps, Find & Replace, auto-detect & fill AcroForms, attach files, run OCR, and organize pages locally.',
    adTopic: 'PDF Document Editing, AcroForms, Signatures & Local Security',
    focusKeywords: [
      'PDF Editor Advanced',
      'Edit PDF text original font',
      'Browser PDF OCR',
      'PDF Form Builder & Signature Studio',
    ],
    overview: [
      'PDF Editor Advanced v3.0 brings full desktop-grade PDF editing directly into your browser without uploading files to external servers. Open any digital or scanned PDF—or start from a blank A4/Letter PDF—click existing text to edit in place while preserving embedded fonts, or run Tesseract OCR on scans.',
      'Upgraded editing studios include a floating context toolbar, Find & Replace across pages (including links), a Type/Draw/Upload Signature Studio with automatic background transparency and browser vault, a Custom Stamp Builder with Date/Author presets, an expanded AcroForm Builder (Text, Comb Boxes, Multiline, Checkbox, Grouped Radio, Dropdown, Signature Box) with Fill Mode & underscore auto-detection, URL/Email/Phone/Page hyperlinks, colour eyedropper, repeat-on-all-pages, visual edit history, external PDF page insertion, and embedded file attachments.',
    ],
    howToUse: [
      {
        stepTitle: 'Open a PDF or Create a Blank A4 / Letter PDF',
        detail:
          'Drag and drop any PDF, click Choose PDF file, or launch a blank A4 or Letter canvas directly inside the workspace.',
      },
      {
        stepTitle: 'Edit Text, Find & Replace, Annotate & Stamp',
        detail:
          'Click text to rewrite in its original font, press Ctrl+F for Find & Replace across pages, use the floating context toolbar, sample page colours with Eyedropper, or build custom dated Stamps and Signatures saved in your browser.',
      },
      {
        stepTitle: 'Build or Fill Interactive AcroForms & Hyperlinks',
        detail:
          'Draw Text, Multiline, Comb, Checkbox, Radio, Dropdown, or Signature fields—or click Detect Fields on blank forms—then switch to Fill Mode to fill directly on the page.',
      },
      {
        stepTitle: 'Organize, Attach Supporting Files, Verify & Download',
        detail:
          'Reorder, rotate, or insert external PDF pages, attach supporting documents inside the PDF, inspect Visual Undo History, Preview side-by-side, and Download.',
      },
    ],
    keyBenefits: [
      {
        title: 'Original-Font Stream Editing + Signature & Stamp Studios',
        detail:
          'Rewrites digital PDF text inside the underlying content stream while offering Type/Draw/Upload transparent signatures and custom dated stamps stored locally in your browser.',
      },
      {
        title: 'Full AcroForm Builder, Find/Replace, Attachments & Page Insertion',
        detail:
          'Combines interactive form authoring & fill mode, Ctrl+F replace across pages, embedded file attachments, OCR, redaction, watermarks, and page insertion in one offline workspace.',
      },
    ],
    faqs: [
      {
        question: 'Are my PDFs uploaded anywhere when using PDF Editor Advanced?',
        answer:
          'No. Rendering, text editing, page organization, and PDF export run locally inside your browser using PDF.js and pdf-lib.',
      },
      {
        question: 'Can I edit scanned PDFs as well as digital text PDFs?',
        answer:
          'Yes. Scanned pages can be processed with built-in OCR (Run OCR on current page or all pages) so recognized lines become clickable and editable.',
      },
    ],
  },

  'incentive-report-tool': {
    toolId: 'incentive-report-tool',
    seoTitle: 'Incentive Report Tool (Tally Ledger PDFs & Deal-Sheet VIN Audit) – VCPL Tools',
    seoDescription:
      'Reconcile incentive Excel sheets with Tally ledger PDFs and deal-sheet screenshots or PDFs locally. Generate Review, Ledger_Lines, Checks, Unmatched & SC_Summary Excel tabs.',
    adTopic: 'Automotive Dealership Incentive Reconciliation & Tally Audit',
    focusKeywords: [
      'Incentive Report Tool',
      'Tally ledger PDF reconciliation',
      'Deal sheet VIN margin audit',
      'VCPL discount incentive Excel',
    ],
    overview: [
      'The Incentive Report Tool automates monthly dealership incentive workbook preparation by reconciling your incentive sheet (.xlsx, .xls, .csv, or pasted Excel grid) against customer Tally ledgers (PDF, Excel/CSV, TXT, or ledger screenshots) and deal-sheet screenshots or PDFs.',
      'Built-in browser OCR automatically extracts VIN, Customer Name, VCPL Discount, and Total Retained Margin from pasted screenshots and scanned PDFs. Hover your cursor over any upload box and press Ctrl+V to drop payloads straight into that placement, verify Dr/Cr balance checks, and export Excel (.XLSX), PDF Audit Reports, and PNG Summary Cards.',
    ],
    howToUse: [
      {
        stepTitle: 'Hover Any Box & Paste (Ctrl+V) or Upload Multi-Format Files',
        detail:
          'Keep your mouse cursor over Box 1 (Excel/CSV), Box 2 (Tally PDF/XLSX/CSV/IMG), or Box 3 (Multiple Deal-Sheet Screenshots/PDFs) and press Ctrl+V or click Paste/Upload.',
      },
      {
        stepTitle: 'Auto-OCR & Pre-Flight Verification',
        detail:
          'Browser OCR extracts VIN, VCPL Discount, and Total Retained Margin from screenshots and scanned PDFs while verifying Tally Dr=Cr balances and sheet columns.',
      },
      {
        stepTitle: 'Configure Margin Limit & Custom Rules',
        detail:
          'Set the margin threshold (default ₹50,000), name-match percentage, BSI/EW default text, and optional custom regex rules, then click Generate & Verify Report.',
      },
      {
        stepTitle: 'Edit Inline & Export Excel, PDF, or PNG Report',
        detail:
          'Inspect High/Medium/Missing confidence badges, edit cells inline, copy the Deals Matrix to Excel, or download Filled .XLSX, PDF Audit Report, and Summary .PNG.',
      },
    ],
    keyBenefits: [
      {
        title: 'Multi-Format Input & Cursor-Targeted Paste',
        detail:
          'Accepts .xlsx, .xls, .csv, .pdf, .txt, and multiple screenshots/images with hover-targeted Ctrl+V box placement and automatic browser OCR.',
      },
      {
        title: 'Excel, PDF & PNG Audit Reporting',
        detail:
          'Exports 6-tab .XLSX workbooks, paginated A4 PDF Audit Reports, shareable PNG Executive Summary Cards, and TSV Excel clipboard copies.',
      },
    ],
    faqs: [
      {
        question: 'Do I need to upload an existing Excel template to run the tool?',
        answer:
          'No. Uploading an .xlsx file is optional—if omitted, you can paste the Excel table or let the tool build a fresh incentive sheet directly from your ledgers and deal sheets.',
      },
      {
        question: 'How does the tool detect aftersales ledgers and Dr/Cr discrepancies?',
        answer:
          'Ledger files with "Aftersales" or "Service" in the filename classify spare/service vouchers as accessories, and the Checks sheet automatically verifies whether each ledger’s debits and credits balance.',
      },
    ],
  },

  'tcs-tax-calculator': {
    toolId: 'tcs-tax-calculator',
    seoTitle: 'TCS & Tax Calculator (Bidirectional GST & TCS Split) – VCPL Tools',
    seoDescription:
      'Calculate TCS and GST both ways instantly. Convert Sale value ↔ Total incl. TCS and Base ↔ Amount incl. Tax with CGST+SGST and IGST breakdown in Indian numbering.',
    adTopic: 'GST Billing, TCS Compliance & Accounting Workflows',
    focusKeywords: [
      'TCS calculator India',
      'reverse GST calculator',
      'CGST SGST IGST split calculator',
      'sale value to total incl TCS',
    ],
    overview: [
      'The TCS & Tax Calculator (TX-07) gives accountants, billing executives, and dealership finance teams a fast two-way calculator for both Tax Collected at Source (TCS) and GST.',
      'Instead of solving reverse percentages manually on a desk calculator, switch between Sale value → Total and Total → Sale value for TCS, or Base ↔ Amount incl. Tax for GST with instant Same-state (CGST + SGST) and Interstate (IGST) breakdowns formatted in Indian lakhs and crores.',
    ],
    howToUse: [
      {
        stepTitle: 'Pick TCS Calculator or Tax / GST Calculator',
        detail:
          'Select the primary tab at the top depending on whether you are computing TCS on a vehicle/sale invoice or GST tax splits.',
      },
      {
        stepTitle: 'Choose Direction & Rate',
        detail:
          'Pick forward or reverse mode (e.g. Total → Sale value or Amount incl. tax → Base), enter the amount and choose a standard slab (0.25%–28%) or custom percentage.',
      },
      {
        stepTitle: 'Copy Individual Figures or Full Summary',
        detail:
          'Click Copy next to any row to paste exact 2-decimal values straight into Tally or DMS billing fields, or copy the full breakdown at once.',
      },
    ],
    keyBenefits: [
      {
        title: 'True Bidirectional Precision',
        detail:
          'Automatically backs out taxable base from tax-inclusive totals without rounding drift between CGST and SGST.',
      },
      {
        title: 'Indian Lakh / Crore Formatting',
        detail:
          'Displays every figure in clean en-IN tabular format ready for immediate verification.',
      },
    ],
    faqs: [
      {
        question: 'How are CGST and SGST split when GST divides unevenly?',
        answer:
          'CGST is rounded to 2 decimal places and SGST equals total tax minus CGST so CGST + SGST always reconciles exactly to the total GST.',
      },
      {
        question: 'Can I enter a custom TCS or GST rate?',
        answer:
          'Yes. Type any TCS percentage directly or choose "Custom…" in the GST Tax Rate dropdown.',
      },
    ],
  },

  'rent-payment-letter-maker': {
    toolId: 'rent-payment-letter-maker',
    seoTitle: 'Rent Payment Letter Maker – Advanced (A4 Letterhead & TDS/GST Audit) – VCPL Tools',
    seoDescription:
      'Create printable A4 commercial rent payment letters with customizable letterhead margins, reverse Taxable/Total/Net TDS & GST checks, Indian words, and saved company defaults.',
    adTopic: 'Corporate Accounts Payable, TDS 194-I & Office Administration',
    focusKeywords: [
      'rent payment letter maker',
      'TDS 194-I rent letter PDF',
      'reverse rent GST TDS calculator',
      'A4 letterhead rent intimation',
    ],
    overview: [
      'Rent Payment Letter Maker – Advanced (VC-04) prepares clean, Times New Roman A4 rent remittance intimation letters formatted specifically to print onto pre-printed corporate letterheads.',
      'Enter whichever figure you have—Taxable Rent, Invoice Total incl. GST, or Net Bank Transfer Payable—and the tool derives taxable rent, CGST+SGST or IGST, TDS deduction, Indian English rupee words, and runs live compliance and PAN/GSTIN/TAN format checks.',
    ],
    howToUse: [
      {
        stepTitle: 'Enter Month, Amount Type & Bank Reference',
        detail:
          'Select whether your entered amount is Taxable rent, Total incl. GST, or Net payable, then enter Rent Month, Payment Date, and UTR/Bank Ref No.',
      },
      {
        stepTitle: 'Verify Tax Settings & Calculation Checks',
        detail:
          'Adjust TDS %, GST % (CGST+SGST, IGST, or No GST), TDS basis (excl. GST or Rent+GST), rounding mode, and inspect the live Calculation Check panel.',
      },
      {
        stepTitle: 'Save Party Defaults & Print / Save as PDF',
        detail:
          'Save your landlord address, PAN/GSTIN, company TAN/GSTIN, letterhead top/bottom spacing (mm), and signature image locally, then click Print / Save as PDF.',
      },
    ],
    keyBenefits: [
      {
        title: 'Pre-Printed Letterhead Calibration',
        detail:
          'Configure Top and Bottom blank spacing in millimetres (default 45 mm top, 18 mm bottom) so the printed text aligns cleanly under your company header.',
      },
      {
        title: 'Automatic Reverse & Compliance Checks',
        detail:
          'Validates PAN, GSTIN, and TAN patterns, warns on Section 194-I GST-inclusive TDS or back-calculated agreements, and verifies Net reconciliation.',
      },
    ],
    faqs: [
      {
        question: 'Where are my landlord, company, and signature details stored?',
        answer:
          'Clicking Save landlord & company details stores them only inside your own browser localStorage—no details are ever uploaded to a server.',
      },
      {
        question: 'How do I export a clean PDF without browser URLs in the margins?',
        answer:
          'Click Print / Save as PDF, select "Save as PDF" as the destination, and untick "Headers and footers" in the browser print options.',
      },
    ],
  },

  'dbs-pnl-reports': {
    toolId: 'dbs-pnl-reports',
    seoTitle: 'DBS P&L and Reports Tool (Departmental P&L & Model Margins) – VCPL Tools',
    seoDescription:
      'Analyze BMW dealer DBS ZIP or CSV monthly exports locally. View Summary, P&L, Departmental P&L, NV Model Margins, Revenue & Expense Analysis, Trial Balance Checks & download 7-sheet .XLSX reports.',
    adTopic: 'Automotive Dealership P&L Reporting & Financial Analysis',
    focusKeywords: [
      'DBS P&L Reports Tool',
      'BMW dealer DBS CSV P&L',
      'Departmental P&L Excel',
      'New Vehicle Model Series Margin',
    ],
    overview: [
      'The DBS P&L and Reports Tool transforms monthly BMW dealer DBS exports (.zip archives, nested .zip packages, or tab-separated .csv files) directly into structured financial statements inside your browser.',
      'It automatically maps income, expense, and balance-sheet stock accounts across all six dealership departments (New Vehicles, Used Vehicles, Service, Body & Paint, Parts, and Admin / Back Office) and exports a formatted 7-sheet .XLSX workbook.',
    ],
    howToUse: [
      {
        stepTitle: 'Unlock with Your Authorized Passcode',
        detail:
          'Enter the 6-digit dealership passcode to unlock the workspace before uploading financial exports.',
      },
      {
        stepTitle: 'Drop Monthly DBS .ZIP or .CSV Export',
        detail:
          'Drag and drop or click to choose the monthly DBS export file (even nested zip archives up to 4 levels deep).',
      },
      {
        stepTitle: 'Inspect 7 Interactive Tabs & Toggle Stock Adjustment',
        detail:
          'Switch between Summary, P&L, Dept P&L, NV Models, Revenue Analysis, Expense Analysis, and Trial Balance Checks, and toggle stock adjustment inclusion live.',
      },
      {
        stepTitle: 'Copy Tab, Print, or Download 7-Sheet Excel (.XLSX)',
        detail:
          'Copy any tab directly into Excel, print cleanly, or click Download Excel Report (.XLSX) to export all statements and raw PL_Data.',
      },
    ],
    keyBenefits: [
      {
        title: 'Automatic Stock Adjustment & Profit Reconciliation',
        detail:
          'Accounts for balance-sheet stock movement against booked DBS P&L purchases and flags any unexplained balance-sheet variance or trial balance gap.',
      },
      {
        title: 'New Vehicle Series Margin & 3 Series + M Series Rollup',
        detail:
          'Computes net sales, discounts, purchases, stock delta, and margin % across 2/3/5/7/M/X/iX1 model series.',
      },
    ],
    faqs: [
      {
        question: 'Does the DBS file leave my computer when generating reports?',
        answer:
          'No. ZIP unpacking, CSV parsing, departmental P&L math, and .XLSX workbook generation all execute 100% locally inside your browser.',
      },
      {
        question: 'Why does the tool include a stock adjustment checkbox?',
        answer:
          'Monthly DBS P&L accounts record vehicle and spare purchases without a closing stock journal entry, so including stock-account movement reflects true cost of sales.',
      },
    ],
  },

  'gstr1-return-prep': {
    toolId: 'gstr1-return-prep',
    seoTitle: 'GSTR-1 Return Preparation Tool (V2.2 Excel/CSV to Portal JSON) – VCPL Tools',
    seoDescription:
      'Prepare and validate Form GSTR-1 locally in your browser. Upload V2.2 Excel workbooks or section CSVs, paste rows from Excel, fix red validation errors, and export GST portal JSON.',
    adTopic: 'GST Filing, GSTR-1 Offline JSON & Indirect Tax Compliance',
    focusKeywords: [
      'GSTR-1 Return Preparation Tool',
      'GSTR-1 Excel to JSON converter',
      'GSTR-1 V2.2 workbook validator',
      'B2B B2CL B2CS CDNR CDNUR Exports JSON',
    ],
    overview: [
      'The GSTR-1 Return Preparation Tool validates Form GSTR-1 V2.2 Excel workbooks and section CSV files directly inside your browser—covering B2B/SEZ/DE, B2CL, B2CS, CDNR, CDNUR, and Exports without uploading taxpayer invoice records to any server.',
      'You can download blank V2.2 Excel templates, paste multi-cell blocks directly from Microsoft Excel into the interactive audit grid, auto-fill Place of Supply from 15-digit recipient GSTIN state codes, fix highlighted validation rows, and generate ready-to-upload GSTR-1 portal JSON.',
    ],
    howToUse: [
      {
        stepTitle: 'Enter GSTIN & Return Period (MMYYYY)',
        detail:
          'Provide the taxpayer GSTIN and 6-digit MMYYYY filing period so invoice dates, B2CL interstate thresholds, and CGST/SGST vs IGST splits are checked accurately.',
      },
      {
        stepTitle: 'Upload V2.2 Workbook / CSVs or Paste From Excel',
        detail:
          'Drop a GSTR-1 V2.2 .xlsx/.xls workbook or section CSVs (b2b.csv, b2cl.csv, b2cs.csv, cdnr.csv, cdnur.csv, exp.csv), or paste cells straight from Excel into any grid row.',
      },
      {
        stepTitle: 'Fix Red Error Rows & Generate Portal JSON',
        detail:
          'Inspect row-level errors in each section tab, or keep "Leave out rows with errors" enabled, then click Generate GSTR-1 JSON to download GSTR1_{GSTIN}_{MMYYYY}.json.',
      },
    ],
    keyBenefits: [
      {
        title: 'Auto State-Code PoS & Multi-Row Fill Controls',
        detail:
          'Typing or pasting a valid recipient GSTIN auto-fills Place of Supply when blank, and Fill Column lets you populate all rows or blank cells in one click.',
      },
      {
        title: 'Period-Aware B2CL & Duplicate Document Checks',
        detail:
          'Automatically checks ₹1,00,000 (Aug 2024+) vs ₹2,50,000 B2CL invoice thresholds, duplicate invoice/note numbers, SEZWOP/EXPWOP zero-IGST rules, and GST portal 19,000-item / 5 MB upload limits.',
      },
    ],
    faqs: [
      {
        question: 'Does any invoice or buyer GSTIN data get uploaded to a server?',
        answer:
          'No. SheetJS Excel/CSV parsing, row validation, tax rate splits, and GST portal JSON serialization all run 100% locally inside your browser.',
      },
      {
        question: 'Can I paste directly from Microsoft Excel into the GSTR-1 grid?',
        answer:
          'Yes. Copy one or multiple columns/rows in Excel and paste into any cell inside the grid—new rows are added automatically to fit pasted lines.',
      },
    ],
  },

  'bmw-statement-reconciler': {
    toolId: 'bmw-statement-reconciler',
    seoTitle: 'Customer Ledger (Purchase Only) Tool (Passcode-Locked) – VCPL Tools',
    seoDescription:
      'Reconcile multi-quarter BMW Statements of Account against Tally ledger exports locally inside your browser with 4-tier matching, open-item aging, continuity checks & 14-sheet XLSX export.',
    adTopic: 'Automotive Dealership Accounting & Ledger Reconciliation',
    focusKeywords: [
      'Customer Ledger (Purchase Only)',
      'BMW Statement vs Tally Reconciliation',
      'BMW statement of account Tally match',
      'DL DI E4 E5 F4 reconciliation',
      'dealership ledger audit Excel',
    ],
    overview: [
      'Customer Ledger (Purchase Only) (VC-06) cross-checks multi-quarter BMW India Statements of Account against single or multi-sheet Tally ledger exports directly inside your browser, keeping sensitive dealer account statements offline on your device.',
      'Across 4 matching tiers—Reference + Amount, Amount + Date Window, Reference Only (Amount Differs), and Multi-Line Group Matches—it explains the exact closing balance difference, identifies open items aged 0–90+ days, checks closing-vs-opening continuity across statements, and exports all 14 views to Excel.',
    ],
    howToUse: [
      {
        stepTitle: 'Unlock Workspace & Upload BMW Statements',
        detail:
          'Enter the authorized 6-digit dealership passcode, then select one or multiple BMW Statement of Account Excel files (.xlsx/.xls) across any quarter or dealer code.',
      },
      {
        stepTitle: 'Upload Tally Ledger Exports & Verify Column Mapping',
        detail:
          'Select your Tally ledger Excel file(s), confirm the auto-detected Date, Particulars, Voucher, Reference, Debit & Credit columns, and toggle which sheets to include.',
      },
      {
        stepTitle: 'Reconcile, Inspect 14 Tabs & Export Excel / CSV / PDF',
        detail:
          'Click Reconcile to audit Summary, Reconciliation Statement, Only in BMW (with likely TDS/invoice/payment causes), Only in Tally, Open Items Aging, Duplicates, and export the full 14-sheet .xlsx workbook.',
      },
    ],
    keyBenefits: [
      {
        title: 'Statement Continuity & Opening Balance Audit',
        detail:
          'Verifies closing vs next-statement opening balances and flags missing or overlapping calendar days automatically across uploaded BMW statements.',
      },
      {
        title: '14 Interactive Audit Views With Sort & Search',
        detail:
          'Filter any tab live by invoice no., amount, VIN, or narration, sort any column ascending/descending, and export individual tabs as CSV or all 14 views as a formatted Excel report.',
      },
    ],
    faqs: [
      {
        question: 'Does the tool auto-lock when I leave or refresh the page?',
        answer:
          'Yes. For dealership security, VC-06 resets its passcode lock automatically whenever you refresh the browser or navigate away from the workspace.',
      },
      {
        question: 'Are BMW statements or Tally vouchers uploaded to a server?',
        answer:
          'No. SheetJS parsing, matching logic, aging math, and Excel report export all run 100% locally in your browser.',
      },
    ],
  },

  'fuel-report-generator': {
    toolId: 'fuel-report-generator',
    seoTitle: 'Monthly Fuel Report Generator (IOCL XTRAPOWER / Easy Fuel) – VCPL Tools',
    seoDescription:
      'Passcode-locked IOCL Easy Fuel & XTRAPOWER monthly Sale report generator — upload either PDF or Excel with drag-and-drop, Qty × Price & CCMS SALE audit checks, and live SUM/SUMIF Excel formulas.',
    adTopic: 'Fleet Fuel Expense Audit & Dealership Accounting',
    focusKeywords: [
      'Monthly Fuel Report Generator',
      'IOCL Easy Fuel PDF Excel report',
      'IOCL XTRAPOWER CCMS SALE reconciliation',
      'fleet petrol diesel monthly statement Excel',
    ],
    overview: [
      'Monthly Fuel Report Generator (VC-07) is a passcode-protected dealership workspace that transforms either IOCL XTRAPOWER / Easy Fuel Statement PDFs or Transaction Details Excel/CSV downloads into the standardized monthly accounting report directly inside your browser.',
      'Drag and drop either a PDF or an Excel workbook (or both for automatic CCMS SALE cross-verification). It auto-detects rows, filters strictly for Txn Type = "Sale" (excluding recharge, allocation, and incentive rows), sorts chronologically by Txn ID, runs automated Qty × Price and status checks, and exports a clean .xlsx workbook with live SUM and SUMIF formulas.',
    ],
    howToUse: [
      {
        stepTitle: 'Unlock with Authorized Passcode',
        detail:
          'Enter the 6-digit dealership passcode to unlock the VC-07 Monthly Fuel Report workspace. The workspace auto-locks cleanly when refreshed or closed.',
      },
      {
        stepTitle: 'Drag & Drop Either IOCL PDF or Excel File (or Both)',
        detail:
          'Drop or select either an IOCL Statement/Transaction PDF or an Easy Fuel .xlsx/.xls/.csv export. Either file alone generates the full report; uploading both cross-verifies PDF CCMS SALE against the Excel total.',
      },
      {
        stepTitle: 'Review Audit Checks & Download <Mon YY> - report.xlsx',
        detail:
          'Inspect PETROL / DIESEL / product-wise quantities and amounts, verify zero Qty × Price or CCMS variances, and download the formula-linked .xlsx or CSV file.',
      },
    ],
    keyBenefits: [
      {
        title: 'Flexible PDF or Excel Standalone Generation',
        detail:
          'Works directly from either PDF statements or Excel transaction exports — plus full drag-and-drop upload — producing standardized Calibri-formatted XLSX reports with live SUM and SUMIF formulas.',
      },
      {
        title: 'Passcode Security & Automated Audit Checks',
        detail:
          'Protected by the 6-digit VCPL passcode gate and flags duplicate Txn IDs, non-PT statuses, missing fields, out-of-period dates, Qty × RSP mismatches, and CCMS SALE variances in seconds.',
      },
    ],
    faqs: [
      {
        question: 'Can I generate the report using only the IOCL PDF without Excel?',
        answer:
          'Yes. You can drag and drop or upload either a Statement/Transaction PDF or an Excel/CSV export independently to generate the formatted monthly report and download the .xlsx workbook.',
      },
      {
        question: 'Does my IOCL fuel Excel or PDF leave my computer?',
        answer:
          'No. Excel parsing, PDF extraction, passcode verification, sanity checks, and ExcelJS workbook generation all execute 100% locally in your browser.',
      },
    ],
  },

  'covering-letter-generator': {
    toolId: 'covering-letter-generator',
    seoTitle: 'Covering Letter Generator (Tally Ledger PDF & OCR to Word/A4) – VCPL Tools',
    seoDescription:
      'Drag & drop Tally customer ledger PDFs, receipt vouchers, registration certificates, and screenshots to auto-extract payment schedules, audit checks, and export A4 Print/PDF or Word (.doc) covering letters.',
    adTopic: 'Vehicle Dealership Documentation & Customer Accounting',
    focusKeywords: [
      'Covering Letter Generator',
      'Tally ledger PDF covering letter',
      'Varsha Cars covering letter Word export',
      'vehicle delivery payment receipt schedule',
    ],
    overview: [
      'Covering Letter Generator (VC-08) is a passcode-protected dealership workspace that streamlines post-delivery customer documentation by reading Tally customer ledger PDFs, receipt vouchers, RC/TR certificates, sale contracts, and scanned screenshots directly inside your browser.',
      'It automatically compiles customer details, car model & colour, VIN/engine reference, loan disbursement breakdowns, and payment rows sorted chronologically—flagging cash limit, third-party payer, bank-date mismatch, and closing balance checks before exporting a clean A4 Print/PDF or Microsoft Word (.doc) covering letter.',
    ],
    howToUse: [
      {
        stepTitle: 'Unlock with Authorized Passcode',
        detail:
          'Enter the 6-digit dealership passcode to unlock the VC-08 Covering Letter Generator workspace. The workspace locks automatically when closed or refreshed.',
      },
      {
        stepTitle: 'Drag & Drop Tally Ledger PDFs or Screenshots',
        detail:
          'Drop or select digital Tally customer ledger PDFs, receipt vouchers, RC/TR copies, or screenshots. Digital PDFs parse instantly while scanned pages and images run through local Tesseract OCR.',
      },
      {
        stepTitle: 'Review Audit Flags, Confirm & Export Print/PDF or Word (.doc)',
        detail:
          'Inspect extracted customer details, VIN/HP hypothecation, third-party payer or Sec 269ST cash alerts, compare against optional on-road price, tick verification, and export A4 Print/PDF or Word (.doc).',
      },
    ],
    keyBenefits: [
      {
        title: 'Digital PDF + Scanned OCR Extraction',
        detail:
          'Combines instant coordinate-based PDF text extraction with local browser OCR for scanned documents and receipt screenshots.',
      },
      {
        title: 'Passcode Security & Ledger Audit Checks',
        detail:
          'Protected by the 6-digit VCPL passcode gate and audits closing balances, bank clearance dates, loan net disbursements, and Rs. 2,00,000 cash thresholds before exporting Cambria A4 letters or .doc files.',
      },
    ],
    faqs: [
      {
        question: 'Does the tool auto-lock when I leave or refresh the page?',
        answer:
          'Yes. For dealership security, VC-08 resets its passcode lock automatically whenever you refresh or navigate away from the workspace.',
      },
      {
        question: 'Are customer ledger PDFs or screenshots uploaded anywhere?',
        answer:
          'No. Passcode verification, PDF parsing, Tesseract OCR, ledger reconciliation, and Word (.doc) generation all run 100% locally in your browser.',
      },
      {
        question: 'Why are the Print and Download Word buttons disabled initially?',
        answer:
          'As a safety check, tick "I have checked the amounts, dates and receipt numbers" under Amount Confirmation after reviewing the extracted schedule to enable export.',
      },
    ],
  },

  'letterhead-invoice-maker': {
    toolId: 'letterhead-invoice-maker',
    seoTitle: 'Letterhead Invoice Maker (Tally PDF on Company Letterhead + Seal) – VCPL Tools',
    seoDescription:
      'Overlay Tally PDF invoices cleanly between your company letterhead header and footer, auto-remove white background from signature & seal images above Authorised Signatory, and download one print-ready PDF.',
    adTopic: 'Invoicing, Company Letterhead & PDF Document Automation',
    focusKeywords: [
      'Letterhead Invoice Maker',
      'Tally invoice on company letterhead PDF',
      'Signature seal above Authorised Signatory',
      'Add letterhead and stamp to PDF invoice',
    ],
    overview: [
      'Letterhead Invoice Maker (VC-09) converts plain Tally or ERP PDF invoices into branded company letterhead documents right inside your browser—with zero file uploads and no passcode required.',
      'It automatically detects the header and footer heights of your uploaded letterhead (PDF or PNG/JPG/WEBP scan), isolates clean horizontal gaps between invoice lines so multi-page or tall invoices split cleanly without slicing text, strips white background from your signature & seal image, and positions it right above the “Authorised Signatory” label with interactive drag and slider controls.',
    ],
    howToUse: [
      {
        stepTitle: 'Upload Letterhead & Optional Signature/Seal',
        detail:
          'Drop or choose your company letterhead (PDF or PNG/JPG/WEBP scan) and optionally upload your signature and round seal image. White paper backgrounds on the signature are removed automatically.',
      },
      {
        stepTitle: 'Add One or Many Tally Invoice PDFs',
        detail:
          'Drop single or multiple Tally invoice PDFs. Each invoice is placed cleanly between your letterhead header and footer using Smart, Flow, or Keep pagination.',
      },
      {
        stepTitle: 'Nudge Signature & Download Combined PDF',
        detail:
          'Drag the dashed signature box directly on the live A4 preview (or adjust size, margins, and X/Y offsets) and click Download PDF to save one invoice or all invoices combined.',
      },
    ],
    keyBenefits: [
      {
        title: 'Smart Header, Footer & Signatory Detection',
        detail:
          'Auto-measures letterhead header/footer bounds and locates “Authorised Signatory” text coordinates so every invoice and stamp lands accurately.',
      },
      {
        title: '100% Browser-Local & Direct PDF Export',
        detail:
          'Optionally remembers your letterhead, signature, and slider preferences inside your browser localStorage while generating vector-crisp PDFs ready for print or email.',
      },
    ],
    faqs: [
      {
        question: 'Does Letterhead Invoice Maker require a passcode?',
        answer:
          'No. Letterhead Invoice Maker (VC-09) opens directly without any passcode lock and runs 100% locally in your browser.',
      },
      {
        question: 'What happens if my invoice is longer than the letterhead body space?',
        answer:
          'In Smart or Flow mode, the tool scans horizontal line gaps (ignoring full-height table borders) to split pages cleanly between rows without cutting text.',
      },
      {
        question: 'Can I reuse my company letterhead and signature next time?',
        answer:
          'Yes. Keep "Remember letterhead, signature & settings in this browser" checked to save them locally in your browser storage, or uncheck it anytime to wipe saved copies.',
      },
    ],
  },

  'textlift-ocr-pro': {
    toolId: 'textlift-ocr-pro',
    seoTitle: 'Textlift OCR Pro (Image, Screenshot & PDF OCR to Text, GST Entities & Excel) – VCPL Tools',
    seoDescription:
      'Extract text, GSTIN/PAN/IFSC/VIN entities, confidence heatmaps & Excel tables from photos, screenshots, and scanned multi-page PDFs 100% locally with zero passcode.',
    adTopic: 'OCR, Document Digitization & GST Invoice Extraction',
    focusKeywords: [
      'Textlift OCR Pro',
      'Image to text OCR browser',
      'PDF OCR to Excel XLSX',
      'GSTIN PAN VIN extractor OCR',
      'Hindi Kannada English OCR offline',
    ],
    overview: [
      'Textlift OCR Pro (VC-10 · Box 19) transforms photos, phone camera scans, screenshots, and scanned multi-page PDFs into editable text, structured GST/banking entities, and Excel (.XLSX) workbooks cleanly inside your browser—with zero server uploads and no passcode required.',
      'Unlike simple single-image readers, Textlift OCR Pro includes live canvas DSP enhancement (auto contrast stretch, Otsu B&W thresholding, 3×3 sharpening, dark-mode inversion, 90° rotation, ±15° deskew), drag-to-crop ROI selection, 25+ OCR language scripts (English, Hindi, Kannada, Tamil, Telugu, and more), a word-level confidence heatmap with inline correction, automatic detection of GSTIN, PAN, IFSC, VIN/Chassis, HSN/SAC, Invoice numbers & INR totals, and multi-sheet Excel export.',
    ],
    howToUse: [
      {
        stepTitle: 'Drop Images/PDFs or Paste Screenshot',
        detail:
          'Drag JPG, PNG, WebP, BMP, AVIF photos or PDF files into the dropzone, or press Ctrl/Cmd + V anywhere to paste a screenshot.',
      },
      {
        stepTitle: 'Pick a Smart Preset, Language Script & Optional ROI Crop',
        detail:
          'Choose one-click profiles such as GST Invoice & Tally, Bank Slip & Stamp, Dark UI, or EN + HI + KN. Optionally adjust Contrast, Otsu B&W Threshold, Deskew, or drag a crop rectangle on the live DSP preview.',
      },
      {
        stepTitle: 'Extract, Inspect Entities/Heatmap & Export .XLSX / .CSV / .TXT',
        detail:
          'Click Extract Text, then switch between Text Editor (with Regex Find & Replace), Confidence Heatmap, GST & Business Entities, and Editable Table Grid before downloading Excel (.XLSX), CSV, TXT, Markdown, or JSON.',
      },
    ],
    keyBenefits: [
      {
        title: 'Live Canvas DSP & Drag-to-Crop ROI',
        detail:
          'Preview grayscale normalization, Otsu thresholding, edge sharpening, inversion, and region-of-interest cropping in real time before running OCR.',
      },
      {
        title: 'Automatic GST, Banking & Vehicle Entity Parsing',
        detail:
          'Surfaces clickable GSTIN, PAN, IFSC, 17-character VIN/Chassis, HSN/SAC, Invoice No., INR currency amounts, emails, and +91 phone numbers automatically.',
      },
      {
        title: 'Editable Table Grid & Batch Multi-File Excel Workbook',
        detail:
          'Detects tabular columns into an editable grid and exports both single-file and multi-file Batch .XLSX summary workbooks locally with zero uploads.',
      },
    ],
    faqs: [
      {
        question: 'Does Textlift OCR Pro require any passcode?',
        answer:
          'No. Textlift OCR Pro (VC-10) is completely open access in both Box 19 on the homepage and inside the VCPL Tools suite.',
      },
      {
        question: 'Does it work on scanned image PDFs and searchable digital PDFs?',
        answer:
          'Yes. In Auto mode it extracts native PDF text layers at 100% accuracy and automatically runs canvas-rendered Tesseract OCR on scanned pages—or switch PDF Strategy to Force OCR anytime.',
      },
      {
        question: 'Are my confidential GST invoices, bank slips, or customer PDFs uploaded anywhere?',
        answer:
          'Never. Both PDF rendering and Tesseract OCR run completely inside your local browser session. The browser only fetches static OCR language data caches on first use of a new script.',
      },
    ],
  },

  'bmw-vendor-ledger-reconciler': {
    toolId: 'bmw-vendor-ledger-reconciler',
    seoTitle: 'BMW Vendor Ledger Reconciliation (SAP vs Tally Bridge & Claims) – VCPL Tools',
    seoDescription:
      'Passcode-locked BMW SAP vendor ledger vs multi-sheet Tally ledger reconciliation with opening-to-closing bridge, payment subset matching, TDS analysis, ageing & ExcelJS exports.',
    adTopic: 'Automotive Dealership Accounting & SAP Ledger Reconciliation',
    focusKeywords: [
      'BMW Vendor Ledger Reconciliation',
      'BMW SAP vendor ledger Tally match',
      'Opening to closing bridge BMW Tally',
      'BMW warranty claim code check Excel',
    ],
    overview: [
      'BMW Vendor Ledger Reconciliation (VC-11) is a passcode-protected dealership reconciliation engine that cross-checks BMW India SAP vendor ledger exports against any number of Tally ledger sheets and warranty claim details completely offline in your browser.',
      'It reconciles both directions (BMW → Tally and Tally → BMW), computes a full opening-to-closing receivable bridge explaining every rupee of difference, matches single or combined payment receipts (subset sum), isolates prior-period/accrual items and TDS deductions, checks claim codes against credited amounts, and exports 16-sheet styled ExcelJS workbooks.',
    ],
    howToUse: [
      {
        stepTitle: 'Unlock with Authorized 6-Digit Passcode',
        detail:
          'Enter the 6-digit dealership passcode to unlock VC-11. The workspace automatically re-locks when you refresh or leave the page.',
      },
      {
        stepTitle: 'Upload BMW Vendor Ledger, Tally Ledgers & Optional Claim Details',
        detail:
          'Drop your BMW SAP ledger export (.xlsx/.xls/.csv), one or more Tally ledger files (all ledger sheets are read automatically), and optional BMW warranty claim workbooks.',
      },
      {
        stepTitle: 'Set Tolerances, Reconcile & Download Styled ExcelJS Workbooks',
        detail:
          'Adjust amount tolerance, invoice window, and payment window if needed, click Run reconciliation, inspect the Consolidated, Bridge, Ledger-wise & 10 detail tabs, and export Full, Summary, Exceptions Excel or CSV.',
      },
    ],
    keyBenefits: [
      {
        title: 'Complete Opening → Closing Receivable Bridge',
        detail:
          'Breaks closing differences into opening variance, invoice amount differences, TDS deducted by BMW, prior-period accruals, unbooked payments, and Tally-only entries down to 0.00 unexplained.',
      },
      {
        title: 'Multi-Sheet Tally & Payment Subset Matching',
        detail:
          'Combines all uploaded Tally ledger sheets automatically and matches single or combined receipts against BMW KZ payment lines.',
      },
    ],
    faqs: [
      {
        question: 'Does BMW Vendor Ledger Reconciliation auto-lock on refresh?',
        answer:
          'Yes. For dealership data privacy, VC-11 is gated by the 6-digit VCPL passcode and resets automatically whenever the page reloads.',
      },
      {
        question: 'Are SAP ledgers or Tally exports uploaded to any server?',
        answer:
          'No. SheetJS parsing, reconciliation math, subset payment matching, and ExcelJS workbook generation all execute locally in your browser.',
      },
    ],
  },

  'bmw-claims-reconciler': {
    toolId: 'bmw-claims-reconciler',
    seoTitle: 'BMW Claims Reconciler (DMS Invoices vs Credit/Debit Notes & Warranty Tracker) – VCPL Tools',
    seoDescription:
      'Passcode-locked BMW warranty claims reconciliation engine matching DMS Service Invoices, Credit Memos, Debit Notes & multi-sheet claim trackers with multi-claim split sheets & ExcelJS export.',
    adTopic: 'Automotive Dealership Warranty Claims & DMS Audit',
    focusKeywords: [
      'BMW Claims Reconciler',
      'DMS invoices vs warranty claims Excel',
      'BMW credit note reconciliation',
      'multi-claim invoice split audit',
    ],
    overview: [
      'BMW Claims Reconciler (VC-12) is a passcode-protected dealership audit workbench that links DMS Service Invoices, Service Credit Memos, Debit Notes, and multi-month Warranty Claim trackers directly inside your browser.',
      'It auto-detects and maps Excel headers across files, supports Bill-To filtering and Bajaj EW toggles, prevents double counting when BMW Credit Notes repeat across split claim lines, detects possible VIN re-bills/duplicates, filters every tab globally by date period, and exports formatted multi-sheet ExcelJS reports with live SUBTOTAL formulas.',
    ],
    howToUse: [
      {
        stepTitle: 'Unlock Workspace & Drop Your Excel Exports',
        detail:
          'Enter the 6-digit dealership passcode, then drop DMS Service Invoices (required) plus optional Credit Memos, Debit Notes, and Warranty Claim / Credit tracker files.',
      },
      {
        stepTitle: 'Verify Column Mappings & Reconciliation Options',
        detail:
          'Review the auto-detected column dropdowns under each uploaded card, adjust ₹ tolerance, pending-days alert, Bill-To filter, RO fallback, and repeated-CN deduplication.',
      },
      {
        stepTitle: 'Explore Dashboard, Drill-Down Tabs & Export ExcelJS Reports',
        detail:
          'Use the Dashboard charts, Register, Multi-Claim, Exceptions, BMW CN Recon, and Audit tabs—filter by period or inline search, add manual remarks, and export Period, All Dates, Multi-Claim, or Exceptions workbooks.',
      },
    ],
    keyBenefits: [
      {
        title: 'Multi-Claim & Repeated Credit Note Deduplication',
        detail:
          'Automatically handles invoices carrying 2, 3, or 4+ claim lines with dedicated split sheets and avoids double-counting identical BMW CN credits.',
      },
      {
        title: 'Live SUBTOTAL ExcelJS Workbooks & Saved Remarks',
        detail:
          'Exports multi-tab formatted Excel workbooks with colored status badges and SUBTOTAL(109) total rows while preserving manual invoice remarks and options locally.',
      },
    ],
    faqs: [
      {
        question: 'Does BMW Claims Reconciler send any DMS or warranty files online?',
        answer:
          'Never. All spreadsheet parsing, RO/VIN/CN matching, period filtering, and ExcelJS workbook exports run 100% locally in your browser.',
      },
      {
        question: 'Why does the Multi-Claim tab group rows by invoice?',
        answer:
          'When multiple warranty claims link to a single DMS invoice, grouping by invoice clarifies total billed vs total claimed/approved/credited without double-counting the invoice value.',
      },
    ],
  },

  'rto-code-finder': {
    toolId: 'rto-code-finder',
    seoTitle: 'India RTO Code Finder – Search All Indian RTO Codes | VCPL Tools',
    seoDescription:
      'Find Indian Regional Transport Office (RTO) codes, office locations, states and registration authorities using vehicle registration codes.',
    adTopic: 'Indian Vehicle Registration & Transport Compliance',
    focusKeywords: [
      'India RTO code finder',
      'vehicle registration authority lookup',
      'Indian number plate RTO prefix',
      'state-wise RTO directory',
    ],
    overview: [
      'The India RTO Code Finder (UT-43) is an admin-passcode-protected directory utility that helps authorized dealership documentation teams, compliance officers, and vehicle administrators identify Regional Transport Offices (RTOs), District Transport Offices (DTOs), and Registering & Licensing Authorities (RLAs) across all 36 Indian States and Union Territories.',
      'Access is gated by the 6-digit admin passcode and automatically re-locks on page refresh or navigation exit. Once unlocked, searches, code normalisations (such as KA19, KA-19, or KA 19), and vehicle registration prefix extractions execute rapidly without external third-party API lookups.',
    ],
    howToUse: [
      {
        stepTitle: 'Unlock with the 6-Digit Admin Passcode',
        detail:
          'Enter the authorized 6-digit admin passcode on the lock screen to open the India RTO Code Finder workspace. Use the Lock Tool button or refresh to re-lock anytime.',
      },
      {
        stepTitle: 'Enter an RTO Code, City, State, or Full Plate',
        detail:
          'Type any normalised or unformatted RTO code (KA19, MH-12, DL 01), city (Mangaluru, Kochi), district, state name, or full vehicle registration number (KA19AB1234).',
      },
      {
        stepTitle: 'Filter by State, UT, District, or Status',
        detail:
          'Combine Region Type, State/UT, District, RTO Code, and Active/Historical status filters to narrow results immediately.',
      },
      {
        stepTitle: 'Copy, Favourite, or Share Verified RTO Details',
        detail:
          'Inspect verified office metadata, copy either the RTO code or complete office summary, bookmark favourites locally, or share a direct RTO URL.',
      },
      {
        stepTitle: 'Browse the 36-State & UT Directory',
        detail:
          'Select any of India’s 28 States or 8 Union Territories in the State-Wise Directory to view its verified RTOs and search within that state.',
      },
    ],
    keyBenefits: [
      {
        title: 'Automatic Code & Plate Normalisation',
        detail:
          'Recognises hyphenated, spaced, and compact formats (KA19, KA-19, KA 19) plus historical prefixes like OR, UA, TS, and DN.',
      },
      {
        title: 'Strict Non-Fabrication Policy',
        detail:
          'Displays only verified records, marks unavailable street addresses transparently as Not available, and never guesses unconfirmed sequential numbers.',
      },
      {
        title: 'Offline Browser Persistence',
        detail:
          'Remembers your favourite RTO codes, recent lookups, and search history locally without logins or servers.',
      },
      {
        title: 'Direct Shareable RTO URLs',
        detail:
          'Supports direct links such as /tools/rto-code-finder/KA-19 for fast team sharing.',
      },
    ],
    faqs: [
      {
        question: 'Does entering a full vehicle number plate show owner details?',
        answer:
          'No. The parser only extracts the State and RTO prefix (for example, KA-19 from KA19AB1234) to identify the registering office. It does not query Vahan or retrieve owner or RC data.',
      },
      {
        question: 'Are all 36 Indian States and Union Territories included?',
        answer:
          'Yes. All 28 States and 8 Union Territories are represented in the directory with verified RTO records and live record counts.',
      },
      {
        question: 'Why does Address show "Not available" for some RTOs?',
        answer:
          'VCPL Tools only displays verified information and intentionally marks unverified street addresses as Not available rather than guessing.',
      },
    ],
  },

  'pin-code-finder': {
    toolId: 'pin-code-finder',
    seoTitle: 'India PIN Code Finder – Search All Indian Post Offices | VCPL Tools',
    seoDescription:
      'Search Indian Postal Index Numbers (PIN codes), post offices, delivery statuses, taluks, divisions, circles, and complete postal addresses across India.',
    adTopic: 'India Post Directory, Logistics & Address Verification',
    focusKeywords: [
      'India PIN code finder',
      'India Post post office lookup',
      'PIN code by district and state',
      'post office delivery status',
    ],
    overview: [
      'The India PIN Code Finder helps individuals, courier desks, e-commerce operations, and KYC verification teams look up accurate 6-digit Indian Postal Index Numbers (PIN) and every post office mapped under each code.',
      'Backed by a 157,000+ record SQLite FTS5 postal database organized across Indian States, Union Territories, Postal Circles, Divisions, and Districts, you can inspect office type (HO/SO/BO), delivery vs non-delivery status, taluk details, and export filtered lists directly.',
    ],
    howToUse: [
      {
        stepTitle: 'Search by 6-Digit PIN, Post Office, Village, or District',
        detail:
          'Enter any 6-digit Indian PIN code (e.g. 575001 or 110001) or type a locality, post office, taluk, town, or district name with live autocomplete.',
      },
      {
        stepTitle: 'View Every Post Office Sharing a PIN Code',
        detail:
          'When searching a 6-digit PIN code, inspect all mapped Head Offices, Sub Offices, and Branch Offices along with delivery status and expandable circle/division metadata.',
      },
      {
        stepTitle: 'Filter, Browse State Directories & Export Results',
        detail:
          'Filter by State/UT, District, Post Office Type, or Delivery Status, and copy addresses or export results in CSV, Excel (.XLSX), or printable layout.',
      },
    ],
    keyBenefits: [
      {
        title: 'Multi-Office Mapping per PIN Code',
        detail:
          'Displays every verified post office mapped to a searched PIN code rather than stopping at a single entry.',
      },
      {
        title: 'Strict Verified-Only Field Policy',
        detail:
          'Displays "Not Available" transparently wherever optional telephone or taluk records are missing instead of guessing.',
      },
      {
        title: 'State-Wise & District-Wise Exploration',
        detail:
          'Browse unique PIN counts and post office totals across States, UTs, and Districts interactively.',
      },
    ],
    faqs: [
      {
        question: 'Why do multiple post offices appear for a single 6-digit PIN code?',
        answer:
          'In India Post, one 6-digit PIN code serves a delivery Sub Office or Head Office together with several nearby Branch Offices or Non-Delivery town offices.',
      },
      {
        question: 'Why does the database show "Not Available" for some contact numbers or taluks?',
        answer:
          'Official open datasets do not publish phone lines for every rural branch post office. VCPL Tools marks unavailable fields explicitly rather than fabricating data.',
      },
    ],
  },
  'database-file-compressor': {
    toolId: 'database-file-compressor',
    seoTitle: 'Database & Large-File Ultra Compressor (500MB to 10MB Stream) | VCPL Tools',
    seoDescription:
      'Compress large 500MB–2GB+ SQL, DUMP, BAK, SQLite, CSV, and JSON database backups in your browser with Level-9 DEFLATE streaming, lossless SQL pre-compaction, and target-size volume splitting.',
    adTopic: 'Database Backup Compression & Archiving Utilities',
    focusKeywords: [
      'database file compressor',
      'compress 500mb sql file to 10mb',
      'browser gzip stream compressor',
      'sql dump pre-compactor',
      'split zip archive 10mb parts',
      'sqlite backup compression',
    ],
    overview: [
      'The Database & Large-File Ultra Compressor (UT-45) is engineered for compressing heavy database exports (.sql, .dump, .bak, .sqlite, .db, .mdf, .csv, .json, .xml) directly inside your browser without uploading confidential schema or customer records to external servers.',
      'Unlike basic ZIP utilities that freeze or crash browser tabs on 500 MB+ files, UT-45 reads inputs in 2 MB slices via File.slice(), estimates your final size up front with a 3-point entropy pre-scan, strips safe redundant SQL comment lines and whitespace before Level-9 DEFLATE, and can automatically split outputs into exact <= 10 MB (or custom MB) volume parts.',
    ],
    howToUse: [
      {
        stepTitle: 'Select Your Database or Large Data File(s)',
        detail:
          'Drag and drop one or more large .sql, .dump, .bak, .sqlite, .csv, or .json files to analyze compressibility and run local streaming compression.',
      },
      {
        stepTitle: 'Review the Instant Compressibility Pre-Scan & Target Limit',
        detail:
          'The engine samples head, middle, and tail windows in milliseconds to forecast exact Level-9 GZIP/ZIP density against your Target Size (e.g., 10 MB). Enable Auto-Split if binary or high-entropy backups require <= 10 MB upload chunks.',
      },
      {
        stepTitle: 'Stream Compress & Download (or Verify Round-Trip Extraction)',
        detail:
          'Run the 2 MB chunked stream, download your .gz, .zip, or .part001+ files, and optionally verify 100% lossless restoration using the built-in Decompress / Rejoin tab.',
      },
    ],
    keyBenefits: [
      {
        title: 'Crash-Free 500 MB+ Chunked Streaming',
        detail:
          'Processes large files in 2 MB slices with cooperative UI yielding and live MB/s throughput, preventing out-of-memory browser crashes.',
      },
      {
        title: '90%–98% SQL / Text Shrinkage',
        detail:
          'Combines a safe lossless SQL/JSON/XML pre-compactor with Level-9 DEFLATE (mem 12) so 500 MB SQL dumps frequently drop into the 10–25 MB range.',
      },
      {
        title: 'Target-Size Volume Splitting & Browser Rejoiner',
        detail:
          'Automatically splits oversized or high-entropy binary archives into exact <= 10 MB parts and restores them cleanly inside the Decompress / Rejoin tab.',
      },
    ],
    faqs: [
      {
        question: 'Can every 500 MB file really be compressed down to 10 MB?',
        answer:
          'Plaintext database exports (.sql dumps, .csv ledgers, .json, .xml) contain massive structural repetition and routinely compress 90%–98% (500 MB down to 10–25 MB). Already-compressed or encrypted binary files (.zip, compressed .bak, media blobs) cannot be shrunk 50x losslessly by any algorithm—for those, Auto-Split divides the output cleanly into <= 10 MB parts.',
      },
      {
        question: 'Are my database backups uploaded anywhere?',
        answer:
          'Never. Every slice read, SQL pre-compaction, GZIP/ZIP compression, SHA-256 check, and decompression runs 100% locally in your browser.',
      },
      {
        question: 'Does the SQL pre-compactor modify data inside INSERT values?',
        answer:
          'No. It only strips standalone `--` comment lines, standalone non-conditional `/* ... */` header lines (while preserving MySQL `/*!...*/` hints), blank lines, and trailing whitespace—keeping every row value intact.',
      },
    ],
  },
  'tulusiri-pro': {
    toolId: 'tulusiri-pro',
    seoTitle: 'Tulusiri Pro – Offline Tulu Lipi Studio (Beta Testing) | Special – VCPL Tools',
    seoDescription:
      'Convert English, Kannada, Hindi, Tamil, Telugu & Malayalam into Tulu Lipi (Baravu font), decode legacy Baravu text, export PNG posters, browse Tulu dictionary words, and practice handwriting locally.',
    adTopic: 'Tulu Lipi, Language Learning & Regional Utility Suites',
    focusKeywords: [
      'Tulusiri Pro',
      'Tulu Lipi Studio',
      'Baravu font converter',
      'Learn Tulu online',
      'Kannada to Tulu Lipi',
      'Special VCPL',
    ],
    overview: [
      'Tulusiri Pro – Tulu Lipi Studio (SP-01) is the flagship module under Special on VCPL Tools, currently released in Beta Testing. It brings an offline Tulu script (Baravu) writing studio, phonetic Nudi-style input, multi-script transliteration, legacy Baravu decoder, dictionary, and interactive learning suite right into your browser with zero account sign-ups.',
      'Whether you want to compose greeting posters in traditional Tulu Lipi, convert names or sentences from English, Kannada, Devanagari, Tamil, Telugu, or Malayalam, verify individual word spellings, or trace Baravu characters by hand on a canvas guide, everything executes 100% locally on your device.',
    ],
    howToUse: [
      {
        stepTitle: 'Choose Input Mode & Write',
        detail:
          'Type in standard English/Kannada/Indian scripts or switch to Nudi-style phonetic typing (using * after ೆ / ೇ / ಎ / ಏ for special Tulu vowels). Confirm detected language and tap preferred word spellings below the editor.',
      },
      {
        stepTitle: 'Copy Baravu Code or Export PNG / Poster',
        detail:
          'Copy the legacy Baravu code directly into design apps with the Baravu font installed, or click Copy as Image, Download PNG, or Download Poster to render crisp graphics immediately.',
      },
      {
        stepTitle: 'Explore Decode, Dictionary, Sari Tulu & Practice Tabs',
        detail:
          'Switch across Lipi Chart, Decode, Dictionary, Sari Tulu flip cards, Sentences, Learn (flashcards + handwriting practice), and Quiz to deepen your Tulu Lipi fluency.',
      },
    ],
    keyBenefits: [
      {
        title: 'Embedded Offline Baravu Font Engine',
        detail:
          'The authentic Baravu OpenType font is bundled directly inside the studio so Tulu glyphs render cleanly across previews, canvas exports, and tracing guides without separate installs.',
      },
      {
        title: 'Local Drafts, Bookmarks & Learning Streak',
        detail:
          'Saved dictionary words, custom spelling preferences, spaced-repetition intervals, and quiz best streaks persist privately in browser localStorage.',
      },
    ],
    faqs: [
      {
        question: 'Why is Tulusiri Pro marked as Beta Testing?',
        answer:
          'We are continuously expanding the multi-script transliteration rules, regional Tulu vocabulary, and phonetic mappings. Always verify final spellings and pronunciation before publishing print posters.',
      },
      {
        question: 'Can I download Tulu Lipi text as an image?',
        answer:
          'Yes. Use Download PNG for a clean cream-background export or Download Poster for a high-contrast Tulunadu crimson-and-gold framed graphic.',
      },
    ],
  },
  'keyboard-shortcuts-guide': {
    toolId: 'keyboard-shortcuts-guide',
    seoTitle: 'Keyboard Shortcuts Guide (Windows Laptop, Desktop & MacBook) | Learn Tools – VCPL Tools',
    seoDescription:
      'Complete side-by-side keyboard shortcuts guide with plain-English explanations for Windows/Linux laptops, desktops, and Apple MacBooks.',
    adTopic: 'Keyboard Shortcuts, Typing Productivity & Office Learning',
    focusKeywords: [
      'Keyboard shortcuts Windows Mac',
      'MacBook keyboard shortcuts',
      'Laptop desktop shortcuts',
      'Typing shortcuts guide',
      'Learn Tools VCPL',
    ],
    overview: [
      'Keyboard Shortcuts Guide (LN-01) brings together essential everyday, text-editing, file-management, browser, screenshot, Excel/Word, and Function-key (F1–F12) shortcuts in one searchable reference.',
      'Designed for both normal Windows/Linux laptops & desktop keyboards and Apple MacBooks, every shortcut includes plain-English explanations, Mac modifier equivalents (⌘ Command = Ctrl, ⌥ Option = Alt), and printable cheat-sheet support.',
    ],
    howToUse: [
      {
        stepTitle: 'Choose Platform View',
        detail:
          'Select Compare Both, Windows / Laptop & Desktop, or MacBook / macOS to focus on your keyboard layout.',
      },
      {
        stepTitle: 'Filter by Category or Search',
        detail:
          'Pick Essentials, Typing & Text, Desktop & File Manager, Screenshots, Browser, Office, or Function Keys—or type any action or key.',
      },
      {
        stepTitle: 'Copy or Print Cheat Sheet',
        detail:
          'Click Copy on any shortcut card or Print Cheat Sheet for a quick desk reference.',
      },
    ],
    keyBenefits: [
      {
        title: 'Side-by-Side Laptop & MacBook Clarity',
        detail:
          'Eliminates confusion when switching between office Windows PCs and personal MacBooks.',
      },
      {
        title: 'Plain-English Practical Tips',
        detail:
          'Explains exactly when and why each shortcut saves time during typing, spreadsheet work, and file organization.',
      },
    ],
    faqs: [
      {
        question: 'How do Windows Ctrl and Alt map on a MacBook keyboard?',
        answer:
          'On a MacBook, Command (⌘) works like Ctrl for most everyday actions (Copy, Paste, Save, Find), while Option (⌥) behaves like Alt and handles word-by-word cursor jumps.',
      },
    ],
  },
  'tally-shortcuts-guide': {
    toolId: 'tally-shortcuts-guide',
    seoTitle: 'TallyPrime & Tally.ERP 9 Complete Shortcuts Guide | Learn Tools – VCPL Tools',
    seoDescription:
      'Searchable TallyPrime and Tally.ERP 9 shortcuts reference covering F4–F9 vouchers, Credit/Debit Notes, Alt+G Go To, GST reports, and print/export keys.',
    adTopic: 'TallyPrime Shortcuts, Accounting & GST Learning',
    focusKeywords: [
      'TallyPrime shortcuts',
      'Tally ERP 9 shortcuts',
      'Tally voucher keys',
      'Tally GST report shortcuts',
      'Learn Tools VCPL',
    ],
    overview: [
      'TallyPrime & Tally.ERP 9 Shortcuts Guide (LN-02) organizes essential accounting shortcuts across voucher entry, on-the-fly ledger creation (Alt+C), GST analysis, report filtering, and export/e-Invoice workflows.',
      'Each card displays both TallyPrime and Tally.ERP 9 keys side-by-side and flags shortcuts updated in TallyPrime (such as Credit Note Alt+F6, Debit Note Alt+F5, and Alt+G Go To).',
    ],
    howToUse: [
      {
        stepTitle: 'Select Edition Focus',
        detail:
          'View TallyPrime + ERP 9 together or filter specifically to TallyPrime or Tally.ERP 9 keys.',
      },
      {
        stepTitle: 'Browse Accounting Categories',
        detail:
          'Filter by Global Navigation, Vouchers, Power Actions, Reports & GST, or Print & E-Compliance.',
      },
      {
        stepTitle: 'Search & Print Desk Guide',
        detail:
          'Search any shortcut like Alt+G, Alt+2, or Credit Note and print a clean office reference sheet.',
      },
    ],
    keyBenefits: [
      {
        title: 'TallyPrime Migration Clarity',
        detail:
          'Clearly marks keys that changed from Tally.ERP 9 so accountants adapt quickly without mistakes.',
      },
      {
        title: 'GST & Audit Aware Notes',
        detail:
          'Includes practical tips like preferring Alt+X (Cancel) over Alt+D (Delete) for issued GST invoices.',
      },
    ],
    faqs: [
      {
        question: 'Why are Credit Note and Debit Note different in TallyPrime?',
        answer:
          'TallyPrime standardized secondary accounting notes to Alt+F6 (Credit Note) and Alt+F5 (Debit Note), replacing Ctrl+F8 and Ctrl+F9 from Tally.ERP 9.',
      },
    ],
  },
  'vcpl-rtgs-neft-form': {
    toolId: 'vcpl-rtgs-neft-form',
    seoTitle: 'VCPL Bulk Bank Transfer Form – Same Bank (SBI) & NEFT/RTGS Request Letter | VCPL Tools',
    seoDescription:
      'Generate A4 Same Bank (SBI intra-bank Payment Transfer Request Letter) & NEFT/RTGS bank request letters with built-in Varsha Cars letterhead, saved accounts, INR words, Excel batch upload, Word/PDF/Excel exports & cheque copy slot.',
    adTopic: 'Same Bank Transfer, RTGS & NEFT Request Letter & Corporate Remittance',
    focusKeywords: [
      'VCPL Bulk Bank Transfer Form',
      'Same Bank Transfer Payment Request Letter',
      'SBI intra bank transfer letter',
      'NEFT RTGS request letter generator',
      'Indian Rupees in words bank letter',
    ],
    overview: [
      'VCPL Bulk Bank Transfer Form (VC-13) builds bank-ready A4 request letters for Same Bank Transfers (SBI intra-bank Payment Transfer Request Letter) as well as single or multi-beneficiary NEFT and RTGS remittances directly in your browser.',
      'It ships with built-in Varsha Cars Pvt. Ltd. Mangalore letterhead & BMW roundel header (or pre-printed paper / custom upload), saved SBI & HDFC accounts with 4-digit quick lookup, Indian Lakhs/Crores words conversion, mode-aware Excel beneficiary batch upload, and direct A4 PDF, Word (.docx), Excel (.xlsx), CSV, Print, and HTML exports.',
    ],
    howToUse: [
      {
        stepTitle: 'Choose Mode & Source Bank Account',
        detail:
          'Switch between Same Bank Transfer (Payment Transfer Request Letter) and NEFT / RTGS modes, then select a saved VCPL SBI/HDFC preset or enter the last 4 digits.',
      },
      {
        stepTitle: 'Add Cheque Info & Beneficiaries',
        detail:
          'Enter cheque number, cheque date, and edit beneficiary rows inline, or upload a filled Excel (.xlsx / .csv) sheet.',
      },
      {
        stepTitle: 'Export A4 PDF, Word, Excel, CSV, HTML or Print',
        detail:
          'Verify the live scaled A4 preview with automatic INR words, optionally attach a cheque copy image, and print or download in your preferred document format.',
      },
    ],
    keyBenefits: [
      {
        title: 'Same Bank Letterhead + NEFT / RTGS in One Workspace',
        detail:
          'Produces the clean 4-column Same Bank SBI Payment Transfer Request Letter (S.N, ACCOUNT NAME, ACCOUNT NUMBER, AMOUNT + TOTAL) or the 7-column NEFT/RTGS table automatically.',
      },
      {
        title: 'Excel Batch Upload & Multi-Format Export',
        detail:
          'Download mode-specific Excel templates, fill vendor rows offline, upload back, and export to A4 PDF, Word (.docx), Excel (.xlsx), UTF-8 CSV, HTML, or Print.',
      },
    ],
    faqs: [
      {
        question: 'How does Same Bank Transfer mode differ from NEFT / RTGS mode?',
        answer:
          'Same Bank Transfer formats an intra-bank Payment Transfer Request Letter with Varsha Cars letterhead, Applicant (Remitter) Section A, a crisp 4-column Beneficiary Table (S.N, ACCOUNT NAME, ACCOUNT NUMBER, AMOUNT + TOTAL), and Amount in Words without unnecessary IFSC columns.',
      },
      {
        question: 'Can I print on pre-printed Varsha Cars letterhead paper?',
        answer:
          'Yes. Switch Letterhead Header to Blank Pre-Printed Paper and adjust Blank Top Space (mm) so the A4 printout leaves exact room for your physical letterhead.',
      },
    ],
  },
  'tds-26as-tally-reco': {
    toolId: 'tds-26as-tally-reco',
    seoTitle: '26AS ⇄ Tally Ledger Reco – Form 26AS & ATS vs Tally TDS/TCS Reconciliation | VCPL Tools',
    seoDescription:
      'Reconcile Form 26AS and ATS (.pdf, .txt, .xlsx, .csv) against multi-sheet Tally TDS/TCS asset ledgers with automatic union-find mapping, G/B reversal netting, 18 period filters, SVG dashboard & ExcelJS formulas.',
    adTopic: 'Form 26AS Tally TDS TCS Ledger Reconciliation & Audit',
    focusKeywords: [
      '26AS to Tally ledger reconciliation',
      'Form 26AS vs Tally TDS reco',
      'ATS PDF Tally reconciliation',
      'TDSTCS ledger matching tool',
      'ExcelJS 26AS reconciliation formulas',
    ],
    overview: [
      '26AS ⇄ Tally Ledger Reco (VC-14) compares your Form 26AS / Annual Tax Statement (ATS) entries from TRACES (.pdf including password-protected files, .txt, .xlsx, or .csv) against multi-sheet Tally TDS & TCS asset ledger exports.',
      'Only current-period transactions are reconciled (Tally opening and closing balances are ignored cleanly), reversal pairs marked G/B are netted automatically, and results export to a styled multi-sheet ExcelJS workbook with live COUNTIFS/SUMIFS formulas on Manual Links.',
    ],
    howToUse: [
      {
        stepTitle: 'Upload Tally Ledgers & Form 26AS / ATS Files',
        detail:
          'Drop one or more Tally ledger Excel exports (.xlsx/.xls) and one or more Form 26AS/ATS files (.pdf, .txt, .xlsx, .csv) to begin.',
      },
      {
        stepTitle: 'Choose Period, Date Basis & Ledger Mapping',
        detail:
          'Select any of 18 period modes (or pick custom months/quarters interactively), verify auto-mapped Tally Ledger <-> 26AS Deductor pairs, and untick any ledger for Manual Reco.',
      },
      {
        stepTitle: 'Inspect 12 Views & Export Pro ExcelJS Workbook',
        detail:
          'Review the SVG Dashboard, Group Summary, Missing entries, Mismatches, link items interactively on Manual Reco, and export to Pro Excel (.xlsx), PDF Audit, Word (.docx), CSV, Print, or JSON.',
      },
    ],
    keyBenefits: [
      {
        title: 'Intelligent Multi-Pass Matching & Union-Find Grouping',
        detail:
          'Handles exact matches, rounding tolerance, many-to-one / one-to-many grouped subset sums, near-amount flags, and multi-ledger or multi-deductor groups cleanly.',
      },
      {
        title: 'Live Formula ExcelJS Workbook & Password PDF Support',
        detail:
          'Exports Dashboard, Group Summary, Detail tabs, Manual Reco dropdowns, live COUNTIFS/SUMIFS Manual Links, Period-wise, Day Buckets, and per-group Ledger sheets.',
      },
    ],
    faqs: [
      {
        question: 'Can I upload a password-protected Form 26AS PDF directly?',
        answer:
          'Yes. If an uploaded 26AS/ATS PDF is encrypted, an inline password unlock bar appears right below the upload cards so you can enter the password (e.g. DDMMYYYY) and unlock it locally in your browser.',
      },
      {
        question: 'Does the tool use Tally opening or closing balances in the reconciliation?',
        answer:
          'No. Opening Balance / B/F and Closing Balance rows are stripped during Tally parsing so only actual transactions within your selected period range are reconciled.',
      },
    ],
  },
  'bajaj-reconciliation-desk': {
    toolId: 'bajaj-reconciliation-desk',
    seoTitle: 'Bajaj Reconciliation Desk – Claim Payments, GST Tracker, DMS & Tally Audit | VCPL Tools',
    seoDescription:
      'Reconcile Bajaj Allianz claim payment sheets and cheque reports against DMS invoices, credit notes, Tally registers, and bank statements locally in your browser with GST ageing and Excel export.',
    adTopic: 'Insurance Claims Reconciliation, Dealership Accounting & GST Audit',
    focusKeywords: [
      'Bajaj reconciliation desk',
      'Bajaj Allianz claim payment reconciliation',
      'Bajaj GST hold release tracker',
      'DMS vs Tally Bajaj claims audit',
      'dealership insurance warranty reco',
    ],
    overview: [
      'Bajaj Reconciliation Desk (VC-15) consolidates Bajaj Allianz Insurance and Extended Warranty claim payment reports, cheque / NEFT sheets, DMS service invoices, DMS credit notes, Tally day-book / credit-note registers, and optional bank statements into one 9-tab audit workspace.',
      'Uploaded files are classified automatically by column headers—even if dropped into another zone—then cross-checked across 27 automated High, Medium, and Info audit rules with full multi-sheet Excel (.xlsx) and filtered CSV exports.',
    ],
    howToUse: [
      {
        stepTitle: 'Drop Bajaj Claim, Cheque, DMS, Tally & Bank Files',
        detail:
          'Upload .xlsx, .xls, .csv, or .pdf reports into slots 1–3. Auto-detection sorts claim payments, cheque reports, DMS invoices, credit notes, Tally registers, and bank statements automatically.',
      },
      {
        stepTitle: 'Configure TDS, Tolerance, Product Map & Ageing Buckets',
        detail:
          'Adjust standard TDS %, rounding tolerance, warranty keyword (_EW_), product-to-segment mapping, and ageing buckets (30,60,90) in the Options panel.',
      },
      {
        stepTitle: 'Inspect 9 Audit Views & Export Excel / CSV',
        detail:
          'Review Summary KPIs, drill down from Audit findings into Exceptions, inspect GST Tracker ageing and UTR / Bank tallies, and download the complete 9-sheet Excel workbook.',
      },
    ],
    keyBenefits: [
      {
        title: 'GST Hold & Release Ageing Tracker',
        detail:
          'Matches Pay App claim payments with G-suffix GST release rows to pinpoint pending GST, over-releases, and ageing beyond configured buckets.',
      },
      {
        title: '27 Automated Dealership Audit Checks',
        detail:
          'Flags math discrepancies, non-standard bill numbers, missing UTR receipts in Tally, unbilled claims, possible re-bills, and DMS vs Tally variances.',
      },
    ],
    faqs: [
      {
        question: 'What happens if I drop a Tally or DMS file in the Bajaj Claim zone?',
        answer:
          'Each sheet is detected by its column headings rather than upload slot, so misplaced sheets are automatically routed to their proper zone and tagged as auto-moved.',
      },
      {
        question: 'Can I export the complete reconciliation workbook offline?',
        answer:
          'Yes. Click Export Excel to download a multi-sheet .xlsx workbook containing Summary, Bajaj_Master, Bajaj Insurance, Bajaj Warranty, GST_Tracker, UTR_Bank, Tally_DMS_Reco, Exceptions, and Audit.',
      },
    ],
  },
};

export function getToolArticle(tool: ToolCatalogItem): ToolArticleData {
  if (TOOL_ARTICLES[tool.id]) {
    return TOOL_ARTICLES[tool.id];
  }

  return {
    toolId: tool.id,
    seoTitle: `${tool.title} – VCPL Tools`,
    seoDescription: tool.description,
    adTopic: `${tool.categoryName} & Office Productivity`,
    focusKeywords: tool.keywords ?? [tool.title, tool.suite, tool.categoryName],
    overview: [
      `${tool.title} (${tool.code}) is part of the ${tool.suite} workspace on VCPL Tools. It is built to streamline everyday ${tool.categoryName.toLowerCase()} tasks cleanly inside your web browser without unnecessary account sign-ups or server file uploads.`,
    ],
    howToUse: [
      {
        stepTitle: 'Provide Your Input Data or Document',
        detail: `Load your file or enter values directly inside the ${tool.title} workspace above.`,
      },
      {
        stepTitle: 'Configure Output Settings',
        detail: 'Adjust format options, presets, or layout preferences as needed.',
      },
      {
        stepTitle: 'Export, Print, or Copy Results',
        detail: 'Verify your output and download, print, or copy it directly for your workflow.',
      },
    ],
    keyBenefits: [
      {
        title: 'Browser-Local Execution',
        detail: 'Runs directly in your browser for fast turnaround and enhanced document control.',
      },
      {
        title: 'Clean Professional Output',
        detail: 'Designed for Indian office, tax, banking, and academic workflows.',
      },
    ],
    faqs: [
      {
        question: `Is ${tool.title} free to use?`,
        answer: 'Yes. All tools in the VCPL Tools workspace are free to use without registration.',
      },
    ],
  };
}
