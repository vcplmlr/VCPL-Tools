import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Calculator,
  Check,
  Copy,
  Printer,
  Search,
  X,
} from 'lucide-react';
import { ToolCatalogItem } from '../../types/tools';

interface TallyShortcutsViewProps {
  tool?: ToolCatalogItem;
}

type TallyEditionFilter = 'all' | 'prime' | 'erp9';

interface TallyShortcutItem {
  id: string;
  category:
    | 'Global Navigation & Company'
    | 'Accounting & Inventory Vouchers'
    | 'Voucher Entry Power Actions'
    | 'Reports, Audit & GST'
    | 'Print, Export & E-Compliance';
  action: string;
  explanation: string;
  primeKeys: string[];
  erp9Keys: string[];
  changedInPrime?: boolean;
  note?: string;
}

const TALLY_CATEGORIES: TallyShortcutItem['category'][] = [
  'Global Navigation & Company',
  'Accounting & Inventory Vouchers',
  'Voucher Entry Power Actions',
  'Reports, Audit & GST',
  'Print, Export & E-Compliance',
];

const TALLY_SHORTCUTS: TallyShortcutItem[] = [
  // 1. Global Navigation & Company
  {
    id: 'tally-accept-save',
    category: 'Global Navigation & Company',
    action: 'Accept & Save Screen / Voucher / Master',
    explanation:
      'Saves the current voucher, ledger, or configuration screen instantly without pressing Enter through every remaining field.',
    primeKeys: ['Ctrl', 'A'],
    erp9Keys: ['Ctrl', 'A'],
  },
  {
    id: 'tally-goto',
    category: 'Global Navigation & Company',
    action: 'Go To / Switch To Any Report or Master',
    explanation:
      'Jumps directly to Balance Sheet, GSTR-1, Trial Balance, or Create Ledger from anywhere without losing your unsaved voucher.',
    primeKeys: ['Alt', 'G (Go To) / Ctrl+G (Switch To)'],
    erp9Keys: ['Gateway Menu Navigation'],
    changedInPrime: true,
    note: 'Signature TallyPrime feature for instant multi-tasking',
  },
  {
    id: 'tally-company-menu',
    category: 'Global Navigation & Company',
    action: 'Company Menu (Select, Shut, Alter, Create)',
    explanation:
      'Opens the Company dropdown to switch companies, shut an active company, or edit GSTIN/address details.',
    primeKeys: ['Alt', 'K'],
    erp9Keys: ['Alt', 'F3 / F1'],
    changedInPrime: true,
  },
  {
    id: 'tally-date-period',
    category: 'Global Navigation & Company',
    action: 'Change Voucher Date vs Financial Period',
    explanation:
      'F2 changes the active transaction or report date; Alt+F2 shifts the full From–To financial period.',
    primeKeys: ['F2 (Date) / Alt+F2 (Period)'],
    erp9Keys: ['F2 (Date) / Alt+F2 (Period)'],
  },
  {
    id: 'tally-features-config',
    category: 'Global Navigation & Company',
    action: 'Company Features (F11) & Screen Configurations (F12)',
    explanation:
      'F11 toggles GST, TDS, Payroll, and Inventory features; F12 customizes visible fields on the active screen.',
    primeKeys: ['F11 / F12'],
    erp9Keys: ['F11 / F12'],
  },
  {
    id: 'tally-calculator',
    category: 'Global Navigation & Company',
    action: 'Open Tally Bottom Calculator Panel',
    explanation:
      'Opens the built-in calculator panel inside Tally; Alt+C inside an amount field pulls the calculated answer directly into the field.',
    primeKeys: ['Ctrl', 'N'],
    erp9Keys: ['Ctrl', 'N'],
  },
  {
    id: 'tally-data-backup',
    category: 'Global Navigation & Company',
    action: 'Backup, Restore & Split Data Menu',
    explanation:
      'Quick access to Company Data management for safe daily backups or financial-year splits.',
    primeKeys: ['Alt', 'Y'],
    erp9Keys: ['Alt', 'F3 > Backup / Restore'],
    changedInPrime: true,
  },

  // 2. Accounting & Inventory Vouchers
  {
    id: 'tally-contra',
    category: 'Accounting & Inventory Vouchers',
    action: 'Contra Voucher (Cash ↔ Bank Transfers)',
    explanation:
      'Records cash deposits into bank, cash withdrawals from bank, or transfers between your own bank accounts.',
    primeKeys: ['F4'],
    erp9Keys: ['F4'],
  },
  {
    id: 'tally-payment',
    category: 'Accounting & Inventory Vouchers',
    action: 'Payment Voucher (Outward Cash / Bank Paid)',
    explanation:
      'Records supplier settlements, salary, rent, tax challans, or expenses paid via cash, cheque, NEFT, or UPI.',
    primeKeys: ['F5'],
    erp9Keys: ['F5'],
  },
  {
    id: 'tally-receipt',
    category: 'Accounting & Inventory Vouchers',
    action: 'Receipt Voucher (Inward Cash / Bank Received)',
    explanation:
      'Records money received from customers, advances, interest credits, or capital inflows.',
    primeKeys: ['F6'],
    erp9Keys: ['F6'],
  },
  {
    id: 'tally-journal',
    category: 'Accounting & Inventory Vouchers',
    action: 'Journal Voucher (Adjustments & Depreciation)',
    explanation:
      'Records non-cash entries such as TDS deductions, depreciation, provisions, GST ITC adjustments, and closing entries.',
    primeKeys: ['F7'],
    erp9Keys: ['F7'],
  },
  {
    id: 'tally-sales-purchase',
    category: 'Accounting & Inventory Vouchers',
    action: 'Sales Voucher (F8) & Purchase Voucher (F9)',
    explanation:
      'Creates customer tax invoices (F8) or records supplier purchase bills (F9) with automatic GST ledger calculation.',
    primeKeys: ['F8 (Sales) / F9 (Purchase)'],
    erp9Keys: ['F8 (Sales) / F9 (Purchase)'],
  },
  {
    id: 'tally-credit-note',
    category: 'Accounting & Inventory Vouchers',
    action: 'Credit Note (Sales Return / Discount Given)',
    explanation:
      'Issues a GST credit note for sales returns or rate reductions to a customer.',
    primeKeys: ['Alt', 'F6'],
    erp9Keys: ['Ctrl', 'F8'],
    changedInPrime: true,
    note: 'TallyPrime moved Credit Note from Ctrl+F8 to Alt+F6',
  },
  {
    id: 'tally-debit-note',
    category: 'Accounting & Inventory Vouchers',
    action: 'Debit Note (Purchase Return / Short Claim)',
    explanation:
      'Records a debit note against a supplier for returned stock or purchase rate differences.',
    primeKeys: ['Alt', 'F5'],
    erp9Keys: ['Ctrl', 'F9'],
    changedInPrime: true,
    note: 'TallyPrime moved Debit Note from Ctrl+F9 to Alt+F5',
  },
  {
    id: 'tally-other-vouchers',
    category: 'Accounting & Inventory Vouchers',
    action: 'Other Vouchers (Sales/Purchase Order, Delivery Note, Stock Journal)',
    explanation:
      'Lists additional vouchers and lets you activate inactive voucher types on demand.',
    primeKeys: ['F10 (or Alt+F7 Stock Journal)'],
    erp9Keys: ['Alt+F4/F5/F7/F8'],
    changedInPrime: true,
  },
  {
    id: 'tally-change-mode',
    category: 'Accounting & Inventory Vouchers',
    action: 'Change Voucher Mode (Item Invoice ↔ Accounting ↔ As Voucher)',
    explanation:
      'Switches a Sales or Purchase screen between Item Invoice, Accounting Invoice, or Dr/Cr Voucher mode.',
    primeKeys: ['Ctrl', 'H'],
    erp9Keys: ['Alt', 'I / Ctrl+V'],
    changedInPrime: true,
  },

  // 3. Voucher Entry Power Actions
  {
    id: 'tally-alt-c',
    category: 'Voucher Entry Power Actions',
    action: 'Create Ledger / Stock Item / Unit On-The-Fly',
    explanation:
      'Creates a new party ledger, GST ledger, or stock item right from the voucher field without exiting.',
    primeKeys: ['Alt', 'C'],
    erp9Keys: ['Alt', 'C'],
  },
  {
    id: 'tally-ctrl-enter',
    category: 'Voucher Entry Power Actions',
    action: 'Alter Master Directly from Cursor Field',
    explanation:
      'Opens the selected ledger or stock item in Edit mode (e.g., to fix GSTIN or HSN code) while inside a voucher.',
    primeKeys: ['Ctrl', 'Enter'],
    erp9Keys: ['Ctrl', 'Enter'],
  },
  {
    id: 'tally-duplicate',
    category: 'Voucher Entry Power Actions',
    action: 'Duplicate Existing Voucher (Day Book / Register)',
    explanation:
      'Clones a selected monthly entry like rent or salary so you only update the date and save.',
    primeKeys: ['Alt', '2'],
    erp9Keys: ['Alt', '2'],
  },
  {
    id: 'tally-insert-add',
    category: 'Voucher Entry Power Actions',
    action: 'Insert (Alt+I) or Add (Alt+A) Voucher in Register',
    explanation:
      'Inserts a new voucher before the highlighted row or appends one cleanly in Day Book / Ledgers.',
    primeKeys: ['Alt', 'I / Alt+A'],
    erp9Keys: ['Alt', 'I / Alt+A'],
  },
  {
    id: 'tally-delete-cancel',
    category: 'Voucher Entry Power Actions',
    action: 'Delete (Alt+D) vs Cancel Voucher (Alt+X)',
    explanation:
      'Alt+D removes an entry completely; Alt+X marks an invoice as Cancelled while preserving the serial number for GST audit.',
    primeKeys: ['Alt', 'D (Delete) / Alt+X (Cancel)'],
    erp9Keys: ['Alt', 'D / Alt+X'],
    note: 'Always prefer Alt+X (Cancel) over Alt+D for issued GST tax invoices',
  },
  {
    id: 'tally-repeat-narration',
    category: 'Voucher Entry Power Actions',
    action: 'Repeat Previous Voucher Narration',
    explanation:
      'Copies the narration text from the last voucher of the same type—saves retyping repetitive remarks.',
    primeKeys: ['Ctrl', 'R'],
    erp9Keys: ['Ctrl', 'R'],
  },
  {
    id: 'tally-more-details',
    category: 'Voucher Entry Power Actions',
    action: 'More Details (e-Invoice, E-Way Bill, Party GST, Dispatch)',
    explanation:
      'Opens additional optional fields for the active voucher without cluttering your normal F12 entry layout.',
    primeKeys: ['Ctrl', 'I'],
    erp9Keys: ['F12 Sub-options'],
    changedInPrime: true,
  },

  // 4. Reports, Audit & GST
  {
    id: 'tally-detailed-view',
    category: 'Reports, Audit & GST',
    action: 'Expand Detailed View in Any Report',
    explanation:
      'Expands collapsed ledger groups in Balance Sheet, P&L, Stock Summary, and GST reports to show sub-ledgers.',
    primeKeys: ['Alt', 'F5 (or Alt+F1)'],
    erp9Keys: ['Alt', 'F1'],
    changedInPrime: true,
  },
  {
    id: 'tally-gst-analysis',
    category: 'Reports, Audit & GST',
    action: 'View GST Tax Analysis Breakup Inside Invoice',
    explanation:
      'Displays exact CGST, SGST, IGST, and Cess rate breakup per stock item/service right before saving an invoice.',
    primeKeys: ['Ctrl', 'O (Related Reports) > GST Tax Analysis'],
    erp9Keys: ['Alt', 'A'],
    changedInPrime: true,
  },
  {
    id: 'tally-stat-adjustment',
    category: 'Reports, Audit & GST',
    action: 'GST / TDS Statutory Adjustment in Journal',
    explanation:
      'Marks Journal vouchers properly for GST ITC Reversal, Reverse Charge (RCM), or Tax Liability Increase.',
    primeKeys: ['Alt', 'J'],
    erp9Keys: ['Alt', 'J'],
  },
  {
    id: 'tally-basis-values',
    category: 'Reports, Audit & GST',
    action: 'Basis of Values & Change View in Reports',
    explanation:
      'Ctrl+B adjusts calculation basis (e.g., include/exclude pending orders); Ctrl+H flips report layout (Monthly/Summary).',
    primeKeys: ['Ctrl', 'B / Ctrl+H'],
    erp9Keys: ['F12 Configure / F5/F6'],
    changedInPrime: true,
  },
  {
    id: 'tally-column-compare',
    category: 'Reports, Audit & GST',
    action: 'Add Comparison Column (Alt+C) & Auto Column (Alt+N)',
    explanation:
      'Compare multiple months, quarters, or companies side-by-side in Balance Sheet, P&L, and Ledgers.',
    primeKeys: ['Alt', 'C / Alt+N'],
    erp9Keys: ['Alt', 'C / Alt+N'],
  },
  {
    id: 'tally-remove-restore-line',
    category: 'Reports, Audit & GST',
    action: 'Hide Line (Ctrl+R) & Restore Hidden Lines (Ctrl+U / Alt+S)',
    explanation:
      'Temporarily removes selected rows from view when reconciling long ledgers; restore without altering books.',
    primeKeys: ['Ctrl', 'R / Ctrl+U'],
    erp9Keys: ['Alt', 'R / Alt+U'],
    changedInPrime: true,
  },

  // 5. Print, Export & E-Compliance
  {
    id: 'tally-print',
    category: 'Print, Export & E-Compliance',
    action: 'Print Current Invoice / Report',
    explanation:
      'Opens the print preview & configure modal for invoices, ledgers, Balance Sheet, or deposit registers.',
    primeKeys: ['Ctrl', 'P (or Alt+P)'],
    erp9Keys: ['Alt', 'P'],
  },
  {
    id: 'tally-export',
    category: 'Print, Export & E-Compliance',
    action: 'Export to Excel, PDF, XML, or GST JSON',
    explanation:
      'Exports any report, ledger, or GSTR-1 JSON return file ready for portal upload or Excel reconciliation.',
    primeKeys: ['Ctrl', 'E (or Alt+E)'],
    erp9Keys: ['Alt', 'E'],
  },
  {
    id: 'tally-email',
    category: 'Print, Export & E-Compliance',
    action: 'Email Invoice or Ledger Statement',
    explanation:
      'Sends the active invoice or party statement PDF directly from configured SMTP email.',
    primeKeys: ['Ctrl', 'M (or Alt+M)'],
    erp9Keys: ['Alt', 'M'],
  },
  {
    id: 'tally-einvoice-exchange',
    category: 'Print, Export & E-Compliance',
    action: 'Exchange Menu (Generate e-Invoice & e-Way Bill)',
    explanation:
      'Opens the Data Exchange hub to push/pull IRN e-Invoices, e-Way Bills, and Connected GST reconciliations.',
    primeKeys: ['Alt', 'Z'],
    erp9Keys: ['Not Native (Export JSON)'],
    changedInPrime: true,
  },
];

function TallyKeyCaps({ keys, variant }: { keys: string[]; variant: 'prime' | 'erp9' }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {keys.map((k, idx) => (
        <React.Fragment key={`${k}-${idx}`}>
          {idx > 0 && (
            <span className="text-[10px] font-bold text-[#64748B] dark:text-slate-400">+</span>
          )}
          <kbd
            className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-mono font-bold shadow-[0_1.5px_0_rgba(47,62,78,0.35)] whitespace-nowrap ${
              variant === 'prime'
                ? 'bg-[#CEE5DC]/80 dark:bg-emerald-950/70 border-[#12805C]/45 dark:border-emerald-500/50 text-[#124E3B] dark:text-emerald-200'
                : 'bg-[#FEF2C8] dark:bg-amber-950/50 border-[#B45309]/35 dark:border-amber-500/45 text-[#78350F] dark:text-amber-200'
            }`}
          >
            {k}
          </kbd>
        </React.Fragment>
      ))}
    </div>
  );
}

export const TallyShortcutsView: React.FC<TallyShortcutsViewProps> = ({ tool }) => {
  const [editionFilter, setEditionFilter] = useState<TallyEditionFilter>('all');
  const [activeCategory, setActiveCategory] = useState<'All' | TallyShortcutItem['category']>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return TALLY_SHORTCUTS.filter((item) => {
      if (activeCategory !== 'All' && item.category !== activeCategory) return false;
      if (!q) return true;
      return (
        item.action.toLowerCase().includes(q) ||
        item.explanation.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.primeKeys.join(' ').toLowerCase().includes(q) ||
        item.erp9Keys.join(' ').toLowerCase().includes(q) ||
        (item.note?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [activeCategory, searchQuery]);

  const handleCopy = async (item: TallyShortcutItem) => {
    const text = `${item.action}\nTallyPrime: ${item.primeKeys.join(' + ')}\nTally.ERP 9: ${item.erp9Keys.join(' + ')}\n${item.explanation}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(item.id);
      window.setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Clipboard blocked
    }
  };

  return (
    <div className="space-y-5">
      {/* Header Card */}
      <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-5 sm:p-6 shadow-[0_4px_0_#2F3E4E] dark:shadow-[0_4px_0_#020617] space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-display font-extrabold uppercase tracking-wider">
              <span className="px-2 py-0.5 rounded bg-[#2F3E4E] text-[#F9C80E]">
                {tool?.code || 'LN-02'}
              </span>
              <span className="px-2 py-0.5 rounded bg-[#CEE5DC] dark:bg-emerald-950/70 text-[#12805C] dark:text-emerald-300 border border-[#2F3E4E]/30 dark:border-emerald-500/40">
                Learn Tools · Accounting
              </span>
              <span className="px-2 py-0.5 rounded bg-[#F9C80E] text-[#2F3E4E] border border-[#2F3E4E]/30">
                {TALLY_SHORTCUTS.length} Tally Shortcuts
              </span>
            </div>

            <h2 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] dark:text-slate-50 tracking-tight flex items-center gap-2">
              <Calculator className="w-6 h-6 text-[#12805C] dark:text-[#F9C80E] shrink-0" aria-hidden="true" />
              <span>TallyPrime &amp; Tally.ERP 9 Complete Shortcuts Guide</span>
            </h2>
            <p className="text-xs sm:text-sm text-[#475569] dark:text-slate-300 max-w-3xl">
              Essential TallyPrime and Tally.ERP 9 voucher, GST audit, ledger, and report shortcut
              keys—highlighting keys that changed in TallyPrime.
            </p>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="no-print inline-flex items-center gap-2 px-4 py-2 min-h-[40px] rounded-xl bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#FFFDF5] dark:text-[#0F172A] border-[1.5px] border-[#2F3E4E] text-xs font-display font-bold shadow-[0_2px_0_#1A242F] hover:-translate-y-0.5 transition-all cursor-pointer shrink-0"
          >
            <Printer className="w-4 h-4" aria-hidden="true" />
            <span>Print Tally Guide</span>
          </button>
        </div>

        {/* Gateway Quick-Key Cheat Bar */}
        <div className="rounded-xl bg-[#CEE5DC]/55 dark:bg-[#0B1120] border-[1.5px] border-[#2F3E4E]/25 dark:border-slate-700 p-3.5 sm:p-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
          <span className="inline-flex items-center gap-1.5 font-display font-extrabold text-[#2F3E4E] dark:text-[#F9C80E]">
            <BookOpen className="w-4 h-4" aria-hidden="true" />
            <span>Gateway Quick Letters:</span>
          </span>
          <span className="text-[#334155] dark:text-slate-300">
            <strong className="font-mono">V</strong> Vouchers ·{' '}
            <strong className="font-mono">K</strong> Day Book ·{' '}
            <strong className="font-mono">B</strong> Balance Sheet ·{' '}
            <strong className="font-mono">P</strong> Profit &amp; Loss ·{' '}
            <strong className="font-mono">D &gt; A &gt; L</strong> Ledger ·{' '}
            <strong className="font-mono">D &gt; G</strong> GST Reports
          </span>
        </div>

        {/* Edition Filter & Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Tally Edition View">
            {[
              { id: 'all' as TallyEditionFilter, label: 'Compare Prime + ERP 9' },
              { id: 'prime' as TallyEditionFilter, label: 'TallyPrime Focus' },
              { id: 'erp9' as TallyEditionFilter, label: 'Tally.ERP 9 Focus' },
            ].map(({ id, label }) => {
              const active = editionFilter === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setEditionFilter(id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-display font-bold border-[1.5px] transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#F9C80E] dark:text-[#0F172A] border-[#2F3E4E] dark:border-[#F9C80E]'
                      : 'bg-[#FFFDF5] dark:bg-[#0B1120] text-[#2F3E4E] dark:text-slate-200 border-[#2F3E4E]/30 dark:border-slate-700 hover:bg-[#FEF2C8] dark:hover:bg-slate-800'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B] pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Tally key or voucher (e.g. Alt+G, Credit Note, F8)..."
              aria-label="Search Tally shortcuts"
              className="w-full pl-9 pr-8 py-2 rounded-xl border-[1.5px] border-[#2F3E4E]/40 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs sm:text-sm text-[#2F3E4E] dark:text-slate-100 placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear Tally search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-[#64748B] hover:text-[#2F3E4E] dark:hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[#2F3E4E]/15 dark:border-slate-800">
          {(['All', ...TALLY_CATEGORIES] as const).map((cat) => {
            const active = activeCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-[#F9C80E] text-[#2F3E4E] border-[#2F3E4E]'
                    : 'bg-[#FFFDF5] dark:bg-[#0B1120] text-[#475569] dark:text-slate-300 border-[#2F3E4E]/25 dark:border-slate-700 hover:bg-[#FEF2C8] dark:hover:bg-slate-800'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Shortcuts Grid */}
      {filteredItems.length === 0 ? (
        <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-8 text-center space-y-2">
          <p className="font-display font-bold text-sm text-[#2F3E4E] dark:text-slate-100">
            No Tally shortcuts matched &ldquo;{searchQuery}&rdquo;.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setActiveCategory('All');
            }}
            className="text-xs font-bold text-[#12805C] dark:text-[#F9C80E] underline cursor-pointer"
          >
            Reset search &amp; filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item) => {
            const isCopied = copiedId === item.id;
            return (
              <article
                key={item.id}
                className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3.5 shadow-[0_3px_0_rgba(47,62,78,0.2)] dark:shadow-[0_3px_0_#020617]"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#12805C] dark:text-emerald-300 bg-[#CEE5DC]/65 dark:bg-emerald-950/60 px-2 py-0.5 rounded">
                        {item.category}
                      </span>
                      {item.changedInPrime && (
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#92400E] dark:text-amber-300 bg-[#FEF3C7] dark:bg-amber-950/60 px-2 py-0.5 rounded border border-[#F59E0B]/40">
                          Updated in Prime
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleCopy(item)}
                      title="Copy Tally shortcut"
                      className="no-print inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[#2F3E4E]/25 dark:border-slate-700 hover:bg-[#FEF2C8] dark:hover:bg-slate-800 text-[11px] font-semibold text-[#475569] dark:text-slate-300 cursor-pointer shrink-0"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3 h-3 text-[#12805C]" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>

                  <h3 className="font-display font-extrabold text-sm sm:text-base text-[#2F3E4E] dark:text-slate-50 leading-snug">
                    {item.action}
                  </h3>

                  <p className="text-xs leading-relaxed text-[#475569] dark:text-slate-300">
                    {item.explanation}
                  </p>
                </div>

                <div className="pt-3 border-t border-[#2F3E4E]/15 dark:border-slate-800 space-y-2">
                  {(editionFilter === 'all' || editionFilter === 'prime') && (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-[#12805C] dark:text-emerald-300">
                        TallyPrime:
                      </span>
                      <TallyKeyCaps keys={item.primeKeys} variant="prime" />
                    </div>
                  )}

                  {(editionFilter === 'all' || editionFilter === 'erp9') && (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-[#92400E] dark:text-amber-300">
                        Tally.ERP 9:
                      </span>
                      <TallyKeyCaps keys={item.erp9Keys} variant="erp9" />
                    </div>
                  )}

                  {item.note && (
                    <p className="text-[11px] font-medium text-[#64748B] dark:text-slate-400 bg-[#FEF2C8]/60 dark:bg-[#0B1120] rounded-lg px-2.5 py-1.5 border border-[#2F3E4E]/15 dark:border-slate-800">
                      Note: {item.note}
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
