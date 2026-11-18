import React, { useState } from 'react';
import { Banknote, Info, RotateCcw } from 'lucide-react';
import { ToolCatalogItem } from '../../types/tools';
import { formatINRPlain, numberToWordsIndian } from '../../utils/numberToWords';
import {
  downloadExcelWorkbook,
  downloadJsonFile,
  downloadWordDocument,
  exportStructuredReportPdf,
  printHtmlDocument,
} from '../../utils/printReport';
import { ToolExportBar } from './ToolExportBar';

interface NumberToWordsViewProps {
  tool?: ToolCatalogItem;
  onBack?: () => void;
}

const PRESET_AMOUNTS = ['1000', '12500', '50000', '149999', '1234567.50', '10000000'];

export const NumberToWordsView: React.FC<NumberToWordsViewProps> = ({ tool, onBack }) => {
  const [rawAmount, setRawAmount] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const numericValue = parseFloat(rawAmount.replace(/,/g, ''));
  const isValid = Number.isFinite(numericValue) && numericValue > 0;
  const words = isValid ? numberToWordsIndian(numericValue) : '';
  const formattedDigits = isValid ? formatINRPlain(numericValue) : '0.00';

  const handleCopy = async () => {
    if (!words) return;
    try {
      await navigator.clipboard.writeText(words);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked
    }
  };

  return (
    <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#2F3E4E]/15">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] flex items-center gap-1.5">
            <Banknote className="w-3.5 h-3.5 text-[#2F3E4E]" />
            {tool?.categoryName || 'Utilities'} · {tool?.code || 'UT-09'}
          </span>
          <h1 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] mt-1">
            {tool?.title || 'Indian Rupees Number to Words Converter'}
          </h1>
          <p className="text-xs sm:text-sm text-[#475569] mt-0.5">
            {tool?.description ||
              'Convert INR amounts with Lakhs, Crores & Paise into RBI cheque and GST invoice ready words.'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setRawAmount('')}
            className="px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Clear
          </button>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] cursor-pointer whitespace-nowrap"
            >
              Close
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-2xl bg-[#FEF2C8]/55 border-[1.5px] border-[#2F3E4E] space-y-3">
            <label htmlFor="inr-words-input" className="block text-xs font-bold text-[#2F3E4E]">
              Enter Amount in Rupees (₹)
            </label>
            <input
              id="inr-words-input"
              type="text"
              inputMode="decimal"
              value={rawAmount}
              onChange={(e) => setRawAmount(e.target.value)}
              placeholder="e.g. 245000.50"
              className="w-full px-4 py-3 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white font-mono text-lg font-extrabold text-[#2F3E4E] focus:outline-none"
            />

            <div>
              <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block mb-2">
                Quick Cheque Presets
              </span>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_AMOUNTS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setRawAmount(preset)}
                    className="px-2.5 py-1 rounded-lg border border-[#2F3E4E] bg-white hover:bg-[#F9C80E] text-xs font-mono font-bold text-[#2F3E4E] cursor-pointer"
                  >
                    ₹{preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#FFE1B3]/55 border-[1.5px] border-[#2F3E4E] space-y-1.5 text-xs text-[#2F3E4E]">
            <p className="font-bold flex items-center gap-1.5">
              <Info className="w-4 h-4" /> RBI Cheque &amp; Banking Rules
            </p>
            <p className="text-[#475569] leading-relaxed">
              Always end cheque words with <strong>&ldquo;Only&rdquo;</strong> immediately after the amount and draw a line through blank space. Cash deposits above ₹49,999 require PAN or Form 60.
            </p>
          </div>
        </div>

        <div className="lg:col-span-7 lg:sticky lg:top-20 space-y-4">
          <div className="p-6 rounded-2xl bg-white border-[1.5px] border-[#2F3E4E] shadow-[0_4px_0_#2F3E4E] space-y-4">
            <div className="flex items-center justify-between border-b border-[#2F3E4E]/15 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                Cheque-Ready Output
              </span>
              <span className="font-mono tabular-nums font-extrabold text-sm px-2.5 py-1 rounded-lg bg-[#CEE5DC] border border-[#2F3E4E] text-[#2F3E4E]">
                ₹ {formattedDigits}/-
              </span>
            </div>

            <div className="p-4 rounded-xl bg-[#FEF2C8]/65 border border-[#2F3E4E]/35 min-h-[92px] flex items-center">
              <p className="font-display font-bold text-base sm:text-lg text-[#2F3E4E] leading-snug">
                {words || 'Enter a positive INR amount to generate Indian English cheque words.'}
              </p>
            </div>

            <span className="text-xs text-[#64748B] block">
              Standard Indian Numbering: Crores · Lakhs · Thousands · Paise
            </span>

            <ToolExportBar
              onClear={() => setRawAmount('')}
              onCopy={() => void handleCopy()}
              copied={copied}
              copyLabel="Copy Words"
              disabled={!words}
              onExcel={() => {
                downloadExcelWorkbook({
                  filename: 'INR_Amount_In_Words.xlsx',
                  sheets: [
                    {
                      name: 'Amount_In_Words',
                      headers: ['Numeric Amount', 'Formatted INR', 'Amount in Words'],
                      rows: [[numericValue, `₹ ${formattedDigits}/-`, words]],
                    },
                  ],
                });
              }}
              onWord={() => {
                void downloadWordDocument({
                  filename: 'INR_Cheque_Amount_Slip.docx',
                  title: 'Indian Rupees Cheque & Invoice Amount Slip',
                  subtitle: `Numeric Value: ₹ ${formattedDigits}/-`,
                  kpis: [
                    { label: 'Formatted Figure', value: `₹ ${formattedDigits}/-` },
                    { label: 'Cheque Words', value: words },
                  ],
                  sections: [
                    {
                      heading: 'Cheque-Ready Wording',
                      body: words,
                    },
                  ],
                });
              }}
              onJson={() => {
                downloadJsonFile('INR_Amount_In_Words.json', {
                  numericValue,
                  formatted: `₹ ${formattedDigits}/-`,
                  words,
                });
              }}
              onPdf={() => {
                exportStructuredReportPdf({
                  title: 'INR Amount in Words Slip',
                  subtitle: `Formatted Figure: Rs. ${formattedDigits}/-`,
                  filename: 'INR_Amount_In_Words.pdf',
                  kpis: [{ label: 'Amount in Figures', value: `Rs. ${formattedDigits}/-` }],
                  table: {
                    title: 'Cheque & Invoice Wording',
                    headers: ['Field', 'Value'],
                    rows: [
                      ['Amount in Figures', `Rs. ${formattedDigits}/-`],
                      ['Amount in Words', words],
                    ],
                  },
                });
              }}
              onPrint={() => {
                void printHtmlDocument({
                  title: 'INR Cheque Amount Slip',
                  bodyHtml: `
                    <h1>INR Cheque &amp; Invoice Amount Slip</h1>
                    <div class="kpi-grid">
                      <div class="kpi-card"><div class="kpi-label">Amount in Figures</div><div class="kpi-val">₹ ${formattedDigits}/-</div></div>
                    </div>
                    <p style="font-size:15px;font-weight:700;padding:12px;border:1px solid #cbd5e1;border-radius:8px;background:#fffdf5;">${words}</p>
                  `,
                });
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
