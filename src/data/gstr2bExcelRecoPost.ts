import { BlogPostItem } from '../types/blog.ts';

export const GSTR2B_EXCEL_RECO_POST: BlogPostItem = {
  slug: 'gstr-2b-vs-purchase-register-reconciliation-excel',
  title: 'How to Reconcile GSTR-2B with Purchase Register in Excel (Step-by-Step Guide)',
  seoTitle: 'How to Reconcile GSTR-2B with Purchase Register in Excel | VCPL Tools',
  excerpt:
    'Learn the practical Excel workflow (XLOOKUP, SUMIFS, invoice normalization, and 5-bucket mismatch tagging) alongside automated browser matching for accurate GSTR-3B ITC claims.',
  seoDescription:
    'Step-by-step Excel guide to reconcile Form GSTR-2B with your Tally purchase register, fix invoice format mismatches, classify missing ITC, and claim accurate GST credit.',
  category: 'Excel Templates',
  topicTags: ['GST', 'Accounting'],
  coverImage: '/blog/gstr-2b-vs-purchase-register-reconciliation-excel.svg',
  coverImageAlt:
    'Excel reconciliation blueprint showing GSTR-2B vs Tally Purchase Register XLOOKUP matching and ITC difference buckets',
  coverTheme: 'gst',
  coverBadge: 'EXCEL GSTR-2B MATCHING',
  publishedIso: '2026-11-23',
  publishedLabel: '23 Nov 2026',
  updatedIso: '2026-11-23',
  updatedLabel: '23 Nov 2026',
  readTime: '7 min read',
  authorId: 'kaushik-bangera',
  author: 'Kaushik Bangera',
  authorRole: 'Product Architecture & Compliance Workflows',
  keywords: [
    'How to reconcile GSTR-2B with purchase register in Excel',
    'GSTR-2B reconciliation Excel formula',
    'GST ITC matching Tally vs 2B',
    'XLOOKUP GSTR-2B reconciliation',
  ],
  relatedToolIds: ['gstr2b-tally-reconciler', 'invoice-to-excel', 'gstr1-return-prep'],
  relatedSlugs: [
    'gstr-1-return-prep-and-gstr2b-tally-itc-matching',
    'gst-itr-tds-due-dates-2026-27',
  ],
  keyTakeaways: [
    'Before writing Excel lookup formulas, strip hyphens, slashes, leading zeros, and uppercase GSTIN+Invoice composite keys.',
    'Classify every variance into five actionable audit buckets: Exact Match, Tolerance/Rounding Match, Missing in GSTR-2B, Missing in Books, and Tax Difference.',
    'Skip fragile manual VLOOKUP debugging by running local matching inside [GSTR-2B vs Tally Reconciler](#tool:gstr2b-tally-reconciler) in seconds.',
  ],
  sections: [
    {
      id: 'preparing-2b-and-purchase-sheets',
      heading: '1. Preparing GSTR-2B Excel Download & Tally Purchase Register',
      paragraphs: [
        'Under GST rules, eligible Input Tax Credit (ITC) claimed in Form GSTR-3B cannot exceed credit reflected in auto-drafted Form GSTR-2B. Preparing clean input sheets is half the battle:',
        'Start by exporting your monthly GSTR-2B B2B & CDNR tables from the GST portal, and export your TallyPrime Purchase Register with GSTIN/UIN, Voucher Date, Supplier Invoice No., Taxable Value, IGST, CGST, and SGST columns. If you also need to extract supplier PDF bills cleanly into Excel rows, run [PDF Invoice to Excel (HSN Summary Maker)](#tool:invoice-to-excel) first.',
      ],
      blocks: [
        {
          type: 'bullets',
          title: 'Step 1 — Create Normalized Composite Keys in Both Sheets:',
          items: [
            '**Clean Invoice String:** Remove spaces, `/`, `-`, and leading zeros (e.g. `=UPPER(SUBSTITUTE(SUBSTITUTE(TRIM(C2),"-",""),"/",""))`).',
            '**Build Unique Key:** Combine `Supplier GSTIN + "|" + Clean Invoice No` so two vendors sharing invoice number `001` never collide.',
            '**Convert Credit Notes:** Ensure CDNR notes carry negative values when totaling net eligible ITC.',
          ],
        },
      ],
    },
    {
      id: 'excel-formulas-for-gst-matching',
      heading: '2. Core Excel Formulas: SUMIFS & XLOOKUP Audit Columns',
      paragraphs: [
        'Use `SUMIFS` rather than plain `VLOOKUP` whenever multiple tax-rate rows share the same supplier invoice number (for example, 5% + 18% items billed on one tax invoice):',
      ],
      blocks: [
        {
          type: 'table',
          title: 'Essential Excel Reconciliation Formulas',
          headers: ['Audit Check Column', 'Recommended Excel Formula Pattern', 'Purpose'],
          rows: [
            ['Normalized Key', '=UPPER(TRIM(B2))&"|"&SUBSTITUTE(SUBSTITUTE(C2,"/",""),"-","")', 'Matches vendor GSTIN + invoice despite punctuation variance'],
            ['2B Total Tax in Books Sheet', '=SUMIFS(\'2B\'!$J:$J, \'2B\'!$A:$A, A2)', 'Pulls total GST reflected in GSTR-2B for that invoice key'],
            ['Tax Variance (Books − 2B)', '=ROUND(D2 - E2, 2)', 'Isolates rupee differences (e.g. ₹1 rounding vs short posting)'],
            ['Audit Status Tag', '=IF(E2=0,"Missing in 2B",IF(ABS(F2)<=2,"Matched (Tol)","Mismatch"))', 'Auto-classifies review priority before GSTR-3B filing'],
          ],
        },
      ],
      proTip:
        'Don\'t want to build multi-tab helper formulas manually? Upload both your GSTR-2B and Tally Excel sheets inside [GSTR-2B vs Tally Reconciler](#tool:gstr2b-tally-reconciler) for instant fuzzy key normalization, tolerance checks, and downloadable multi-sheet Excel audit reports right in browser RAM.',
    },
    {
      id: 'five-reconciliation-buckets',
      heading: '3. Resolving the 5 GSTR-2B Reconciliation Buckets Before GSTR-3B',
      paragraphs: [
        'Once your reconciliation columns populate, follow this resolution checklist ahead of the 20th monthly (or 22nd/24th QRMP) GSTR-3B due date:',
      ],
      blocks: [
        {
          type: 'table',
          headers: ['Status Bucket', 'What It Means', 'Accountant Action'],
          rows: [
            ['1. Exact / Rounding Match', 'Books and 2B match within ±₹1–₹2 rounding', 'Approve full eligible ITC (verify non-blocked Section 17(5) nature)'],
            ['2. Missing in GSTR-2B', 'Invoice recorded in Tally; supplier did not file GSTR-1/IFF', 'Hold ITC temporarily in "ITC Deferred Ledger"; notify vendor before next cycle'],
            ['3. Missing in Books', 'Present in GSTR-2B; absent in Tally Purchase Register', 'Verify missing purchase/expense bills, bank charges, or wrong-GSTIN posting'],
            ['4. Tax / Taxable Mismatch', 'Invoice matches but IGST vs CGST/SGST or rate differs', 'Verify original tax invoice and raise debit note / entry correction'],
            ['5. Ineligible / RCM Tag', 'Section 17(5) blocked credits or Reverse Charge items', 'Exclude blocked credit in Table 4(B) of GSTR-3B'],
          ],
        },
      ],
    },
  ],
  faqs: [
    {
      question: 'Why should I use SUMIFS instead of VLOOKUP for GSTR-2B matching?',
      answer:
        'Multi-rate invoices often appear across multiple rows in GSTR-2B or Tally. VLOOKUP only captures the first row match, whereas SUMIFS sums every tax line belonging to the same GSTIN + Invoice Key.',
    },
    {
      question: 'Can I claim ITC in GSTR-3B if a supplier invoice is missing in GSTR-2B?',
      answer:
        'No. Under current GST provisions (Section 16(2)(aa)), ITC can be availed only to the extent it appears in Form GSTR-2B after the supplier furnishes GSTR-1/IFF.',
    },
    {
      question: 'How do I match invoices when Tally has "INV/26-27/05" and GSTR-2B has "INV262705"?',
      answer:
        'Normalize invoice numbers by removing hyphens, slashes, and spaces, or use VCPL Tools\' GSTR-2B vs Tally Reconciler which strips punctuation and leading zeros automatically.',
    },
    {
      question: 'Does VCPL GSTR-2B vs Tally Reconciler upload purchase data to a server?',
      answer:
        'No. All Excel file parsing, invoice fuzzy matching, and reconciliation exports run 100% locally in your browser memory.',
    },
  ],
  disclaimer:
    'Always verify final ITC eligibility rules under Section 16, Section 17(5), and CGST Rules 36(4) / 37A before submitting Form GSTR-3B or Form GSTR-9.',
};
