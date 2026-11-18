import React, { useState, useMemo } from 'react';
import { ArrowLeft, SpellCheck, Copy, Check, BookOpen, Info } from 'lucide-react';
import { formatINR, numberToWordsIndian } from '../../utils/numberToWords';
import {
  AdRectanglePair,
  AdSlot,
  ResponsiveAdBanner,
  SmartlinkBanner,
} from '../ads/AdSlot';
import { ContextualAdWidget } from '../ads/ContextualAdWidget';
import { useViewportBand } from '../ads/useViewportBand';

interface NumberToWordsToolProps {
  onBack: () => void;
}

export const NumberToWordsTool: React.FC<NumberToWordsToolProps> = ({ onBack }) => {
  const band = useViewportBand();
  const [numInput, setNumInput] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const num = useMemo(() => {
    return parseFloat(numInput.replace(/,/g, '')) || 0;
  }, [numInput]);

  const words = useMemo(() => {
    if (!numInput.trim()) return '';
    return numberToWordsIndian(num);
  }, [num, numInput]);

  const handleCopy = () => {
    if (!words) return;
    navigator.clipboard.writeText(words);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col lg:flex-row items-start gap-7">
        <div className="flex-1 min-w-0 w-full">
      {/* Top Header */}
      <div className="pb-6 border-b border-slate-200">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-2 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to All Tools
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
            <SpellCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                Number to Words Converter (Indian Rupees &amp; Lakhs)
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
                BETA · v1.0.0
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Convert numbers into formal Indian Lakhs &amp; Crores currency format for cheques, invoices &amp; contracts.
            </p>
          </div>
        </div>
      </div>

      {/* Safety Notice & RBI Cheque Caution Strip */}
      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-start sm:items-center gap-2">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
          <span>
            <strong>BETA v1.0.0 Cheque Writing Protocol:</strong> Always append the word <em>&quot;Only&quot;</em> after the amount in words and cross bearer cheques with <em>&quot;A/C Payee Only&quot;</em> to prevent unauthorized additions.
          </span>
        </div>
        <span className="text-[11px] font-semibold text-amber-800 whitespace-nowrap shrink-0">
          RBI Standard
        </span>
      </div>

      {/* Input & Output Box */}
      <div className="mt-8 bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            Enter Amount in Indian Rupees (₹)
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg">
              ₹
            </span>
            <input
              type="text"
              value={numInput}
              onChange={(e) => setNumInput(e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="Enter amount"
              className="w-full pl-9 pr-4 py-3.5 text-xl sm:text-2xl font-mono font-bold text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
          <span className="text-xs text-slate-500 font-mono mt-1.5 block">
            Formatted: {formatINR(num)}
          </span>
        </div>

        {/* Output Card */}
        <div className="p-6 rounded-2xl bg-amber-50/50 border border-amber-200/80 relative space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
              Amount in Words (Cheque Writing Standard)
            </span>
            {words && (
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 rounded-lg border border-slate-300 shadow-xs transition-colors cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy Words
                  </>
                )}
              </button>
            )}
          </div>

          <p className="text-base sm:text-xl font-serif italic text-slate-900 font-medium leading-relaxed">
            {words ? `"${words}"` : <span className="text-slate-400 not-italic font-sans text-sm">Enter an amount above to see words formatted in Indian currency standard.</span>}
          </p>

          <div className="text-[11px] text-amber-800/80 pt-2 border-t border-amber-200/60 flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5 shrink-0" />
            <span>Always end cheque descriptions with "ONLY" to prevent fraudulent alterations.</span>
          </div>
        </div>
      </div>

      {/* Mid 468x60 / 320x50 Banner */}
      <ResponsiveAdBanner
        desktopSlot="tool_mid_banner_468"
        tabletSlot="tool_mid_banner_468"
        mobileSlot="tool_mid_mobile_320"
        className="my-6"
      />

      {/* Cheque Writing Guide Section */}
      <div className="mt-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-emerald-700" />
          <h3 className="text-sm font-bold text-slate-900">
            RBI Cheque Writing Guidelines &amp; Best Practices
          </h3>
        </div>
        <ul className="space-y-2 text-xs text-slate-600 list-disc list-inside leading-relaxed">
          <li><strong>Zero Leading Gaps:</strong> Start writing the name of payee and amount words immediately adjacent to the printed prefixes "Pay" and "Rupees" with no space in between.</li>
          <li><strong>Crossing:</strong> Double-cross with "A/C PAYEE ONLY" between two parallel transverse lines on the top left corner to prevent bearer cash withdrawal.</li>
          <li><strong>Amount in Words match Figures:</strong> If there is a dispute, the amount stated in words takes legal precedence over the figures under Section 18 of the Negotiable Instruments Act.</li>
        </ul>
      </div>

      {/* Contextual Books & Education Partner Directory */}
      <ContextualAdWidget initialCategory="books" title="Recommended Books & Financial Literature" className="mt-8" />

      {/* Bottom Smartlink & Dual 300x250 Rectangles */}
      <div className="mt-6 space-y-5 no-print">
        <SmartlinkBanner slotId="tool_smartlink" />
        <AdRectanglePair leftSlot="tool_bottom_rect_1" rightSlot="tool_bottom_rect_2" />
      </div>
        </div>

        {(band === 'desktop' || band === 'wide') && (
          <aside
            className="w-[160px] shrink-0 sticky top-24 self-start space-y-4 no-print"
            aria-label="Number to Words sidebar skyscraper"
          >
            <AdSlot slotId="tool_rail_160x300" />
            <AdSlot slotId="tool_rail_160x300_2" />
          </aside>
        )}
      </div>
    </div>
  );
};
