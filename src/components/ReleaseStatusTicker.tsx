import { CheckCircle2, Construction, Sparkles } from 'lucide-react';

interface ReleaseStatusTickerProps {
  className?: string;
}

function TickerSequence({ copyIndex }: { copyIndex: number }) {
  return (
    <div
      className="flex items-center gap-7 pr-7 shrink-0"
      aria-hidden={copyIndex > 0 ? true : undefined}
    >
      {/* Segment 1: Core 10-Box Spotlight Tools — Stable & 100% Working */}
      <span className="inline-flex items-center gap-2 text-xs sm:text-[13px] font-medium text-[#FEF2C8] whitespace-nowrap">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#12805C] text-[#FFFDF5] border border-[#CEE5DC]/40 font-display font-extrabold text-[10px] uppercase tracking-wider">
          <CheckCircle2 className="w-3 h-3 shrink-0" aria-hidden="true" />
          <span>100% Working &amp; Stable</span>
        </span>
        <span>
          <strong className="text-white font-bold">Main Spotlight Tools (Boxes 01–08, 11–12, 18–24):</strong>{' '}
          Bank Deposit Slip Generator, Form 26AS, GSTR-2B, PDF Invoice to Excel (HSN Summary Maker),
          All-in-One Calculator, GST Invoice &amp; Quotation Maker, DMS vs Tally, Parts Billing
          vs Tally Reconciliation, TCS &amp; Tax Calculator, Rent Payment Letter Maker, Letterhead Invoice Maker, Textlift OCR Pro, BMW Vendor Ledger Reconciliation, BMW Claims Reconciler, VCPL Bulk Bank Transfer Form, 26AS ⇄ Tally Ledger Reco &amp; Bajaj Reconciliation Desk are{' '}
          <strong className="text-[#CEE5DC] font-semibold">
            100% tested and ready for daily work
          </strong>
          .
        </span>
      </span>

      <span className="text-[#F9C80E] font-bold select-none" aria-hidden="true">
        ◆
      </span>

      {/* Segment 2: Beta Testing / Under Construction */}
      <span className="inline-flex items-center gap-2 text-xs sm:text-[13px] font-medium text-[#FEF2C8] whitespace-nowrap">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F9C80E] text-[#2F3E4E] border border-[#FFE1B3] font-display font-extrabold text-[10px] uppercase tracking-wider">
          <Construction className="w-3 h-3 shrink-0" aria-hidden="true" />
          <span>Beta Testing</span>
        </span>
        <span>
          <strong className="text-white font-bold">Box 09: Income Tax Calculator FY 2026-27 (v2.0.8)</strong>,{' '}
          <strong className="text-white font-bold">Box 10: PDF Editor Advanced (v3.0)</strong>,{' '}
          <strong className="text-white font-bold">Box 13: Incentive Report Tool</strong>,{' '}
          <strong className="text-white font-bold">Box 14: DBS P&amp;L &amp; Reports Tool</strong>,{' '}
          <strong className="text-white font-bold">Box 15: Customer Ledger (Purchase Only)</strong>,{' '}
          <strong className="text-white font-bold">Box 16: Monthly Fuel Report Generator</strong>,{' '}
          <strong className="text-white font-bold">Box 17: Covering Letter Generator</strong>,{' '}
          <strong className="text-white font-bold">GSTR-1 Return Prep</strong>,{' '}
          PDF to JPG, Document Converters, Image Studio &amp; extra utilities are in{' '}
          <strong className="text-[#F9C80E] font-semibold">
            Beta Testing &amp; Active Development
          </strong>{' '}
          with regular accuracy updates.
        </span>
      </span>

      <span className="text-[#CEE5DC] font-bold select-none" aria-hidden="true">
        ◆
      </span>
    </div>
  );
}

export function ReleaseStatusTicker({ className = '' }: ReleaseStatusTickerProps) {
  return (
    <div
      role="region"
      aria-label="Tool release status notice"
      className={`vcpl-marquee-wrap max-w-[1400px] mx-auto rounded-2xl bg-[#2F3E4E] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 shadow-[0_4px_0_#1E293B] dark:shadow-[0_4px_0_#020617] overflow-hidden flex items-stretch ${className}`}
    >
      {/* Left Fixed Pill Badge */}
      <div className="relative z-10 flex items-center gap-2 px-3.5 sm:px-4 py-2.5 bg-[#1E293B] dark:bg-[#0B1120] border-r border-[#FEF2C8]/20 dark:border-slate-700 shrink-0">
        <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34D399] opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#34D399]" />
        </span>
        <Sparkles className="w-3.5 h-3.5 text-[#F9C80E] hidden sm:block shrink-0" aria-hidden="true" />
        <span className="font-display font-extrabold text-[10px] sm:text-[11px] uppercase tracking-wider text-[#F9C80E] whitespace-nowrap">
          Suite Status
        </span>
      </div>

      {/* Seamless Marquee Viewport with Soft Side Fade Masks */}
      <div className="relative flex-1 min-w-0 overflow-hidden py-2.5 flex items-center">
        <div
          className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-[#2F3E4E] dark:from-[#131C2E] to-transparent z-10"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#2F3E4E] dark:from-[#131C2E] to-transparent z-10"
          aria-hidden="true"
        />

        <div className="vcpl-marquee-track flex flex-nowrap items-center w-max">
          <TickerSequence copyIndex={0} />
          <TickerSequence copyIndex={1} />
        </div>
      </div>
    </div>
  );
}
