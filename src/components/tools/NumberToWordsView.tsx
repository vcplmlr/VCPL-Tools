import React, { useMemo, useState } from 'react';
import { Banknote, Info, ListChecks, RotateCcw } from 'lucide-react';
import { ToolCatalogItem } from '../../types/tools';
import {
  formatINRPlain,
  integerToWordsIndian,
  numberToWordsIndian,
} from '../../utils/numberToWords';
import {
  downloadBomCsv,
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

const PRESET_AMOUNTS = ['1000', '12500', '49999', '149999', '1234567.50', '10000000'];

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function belowThousandIntl(num: number): string {
  const h = Math.floor(num / 100);
  const rem = num % 100;
  const parts: string[] = [];
  if (h > 0) parts.push(`${ONES[h]} Hundred`);
  if (rem > 0) {
    if (rem < 20) parts.push(ONES[rem]);
    else {
      const t = Math.floor(rem / 10);
      const o = rem % 10;
      parts.push(o > 0 ? `${TENS[t]} ${ONES[o]}` : TENS[t]);
    }
  }
  return parts.join(' ');
}

function integerToWordsInternational(amount: number): string {
  let n = Math.floor(Math.abs(amount));
  if (!Number.isFinite(n) || n === 0) return 'Zero';
  const scales = ['', 'Thousand', 'Million', 'Billion', 'Trillion'];
  const chunks: string[] = [];
  let idx = 0;
  while (n > 0 && idx < scales.length) {
    const rem = n % 1000;
    if (rem > 0) {
      const seg = belowThousandIntl(rem);
      chunks.unshift(scales[idx] ? `${seg} ${scales[idx]}` : seg);
    }
    n = Math.floor(n / 1000);
    idx += 1;
  }
  return chunks.join(' ').trim();
}

function formatWordsWithOptions(
  amount: number,
  opts: {
    system: 'indian' | 'international';
    caseStyle: 'title' | 'upper' | 'sentence';
    includeRupees: boolean;
    includeOnly: boolean;
    paiseFraction: boolean;
  }
): string {
  if (!Number.isFinite(amount) || amount <= 0) return '';
  const whole = Math.floor(amount);
  const paise = Math.round((amount - whole) * 100);
  const baseWords =
    opts.system === 'indian' ? integerToWordsIndian(whole) : integerToWordsInternational(whole);

  const pieces: string[] = [];
  if (whole > 0) {
    pieces.push(opts.includeRupees ? `${baseWords} Rupees` : baseWords);
  }
  if (paise > 0) {
    if (opts.paiseFraction) {
      pieces.push(`${String(paise).padStart(2, '0')}/100`);
    } else {
      const pWords = belowThousandIntl(paise);
      pieces.push(`${pWords} Paise`);
    }
  }
  let raw = pieces.join(' and ');
  if (opts.includeOnly && raw) raw = `${raw} Only`;

  if (opts.caseStyle === 'upper') return raw.toUpperCase();
  if (opts.caseStyle === 'sentence') {
    const low = raw.toLowerCase();
    return low.charAt(0).toUpperCase() + low.slice(1);
  }
  return raw;
}

export const NumberToWordsView: React.FC<NumberToWordsViewProps> = ({ tool, onBack }) => {
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [rawAmount, setRawAmount] = useState<string>('');
  const [system, setSystem] = useState<'indian' | 'international' | 'both'>('indian');
  const [caseStyle, setCaseStyle] = useState<'title' | 'upper' | 'sentence'>('title');
  const [includeRupees, setIncludeRupees] = useState(true);
  const [includeOnly, setIncludeOnly] = useState(true);
  const [paiseFraction, setPaiseFraction] = useState(false);
  const [payeeName, setPayeeName] = useState('');
  const [batchInput, setBatchInput] = useState('');
  const [copied, setCopied] = useState(false);

  const numericValue = parseFloat(rawAmount.replace(/,/g, ''));
  const isValid = Number.isFinite(numericValue) && numericValue > 0;

  const indianWords = isValid
    ? formatWordsWithOptions(numericValue, {
        system: 'indian',
        caseStyle,
        includeRupees,
        includeOnly,
        paiseFraction,
      })
    : '';
  const internationalWords = isValid
    ? formatWordsWithOptions(numericValue, {
        system: 'international',
        caseStyle,
        includeRupees,
        includeOnly,
        paiseFraction,
      })
    : '';

  const primaryWords = system === 'international' ? internationalWords : indianWords;
  const formattedDigits = isValid ? formatINRPlain(numericValue) : '0.00';

  const breakdown = useMemo(() => {
    if (!isValid) return null;
    const whole = Math.floor(numericValue);
    const paise = Math.round((numericValue - whole) * 100);
    return {
      crores: Math.floor(whole / 10000000),
      lakhs: Math.floor((whole % 10000000) / 100000),
      thousands: Math.floor((whole % 100000) / 1000),
      units: whole % 1000,
      paise,
    };
  }, [isValid, numericValue]);

  const batchResults = useMemo(() => {
    const lines = batchInput
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    return lines.map((line, idx) => {
      const n = parseFloat(line.replace(/[₹,\s]/g, ''));
      const valid = Number.isFinite(n) && n > 0;
      return {
        idx: idx + 1,
        raw: line,
        numeric: valid ? n : 0,
        formatted: valid ? `₹ ${formatINRPlain(n)}/-` : 'Invalid',
        indian: valid
          ? formatWordsWithOptions(n, {
              system: 'indian',
              caseStyle,
              includeRupees,
              includeOnly,
              paiseFraction,
            })
          : '—',
        international: valid
          ? formatWordsWithOptions(n, {
              system: 'international',
              caseStyle,
              includeRupees,
              includeOnly,
              paiseFraction,
            })
          : '—',
      };
    });
  }, [batchInput, caseStyle, includeRupees, includeOnly, paiseFraction]);

  const handleClear = () => {
    setRawAmount('');
    setPayeeName('');
    setBatchInput('');
  };

  const handleCopy = async (textOverride?: string) => {
    const txt =
      textOverride ??
      (mode === 'batch'
        ? batchResults.map((r) => `${r.formatted}\t${r.indian}`).join('\n')
        : system === 'both'
        ? `Indian: ${indianWords}\nInternational: ${internationalWords}`
        : primaryWords);
    if (!txt) return;
    try {
      await navigator.clipboard.writeText(txt);
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

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="inline-flex rounded-xl border-[1.5px] border-[#2F3E4E] bg-white p-0.5">
            <button
              type="button"
              onClick={() => setMode('single')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                mode === 'single' ? 'bg-[#2F3E4E] text-[#F9C80E]' : 'text-[#2F3E4E]'
              }`}
            >
              Single &amp; Cheque
            </button>
            <button
              type="button"
              onClick={() => setMode('batch')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer ${
                mode === 'batch' ? 'bg-[#2F3E4E] text-[#F9C80E]' : 'text-[#2F3E4E]'
              }`}
            >
              <ListChecks className="w-3.5 h-3.5" /> Batch ({batchResults.length})
            </button>
          </div>
          <button
            type="button"
            onClick={handleClear}
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

      {/* Formatting Controls Bar */}
      <div className="p-4 rounded-2xl bg-[#FEF2C8]/55 border-[1.5px] border-[#2F3E4E] flex flex-wrap items-center gap-3 text-xs font-bold text-[#2F3E4E]">
        <div className="flex items-center gap-1.5">
          <span className="text-[#475569]">System:</span>
          {(['indian', 'international', 'both'] as const).map((sys) => (
            <button
              key={sys}
              type="button"
              onClick={() => setSystem(sys)}
              className={`px-2.5 py-1 rounded-lg border border-[#2F3E4E] capitalize cursor-pointer ${
                system === sys ? 'bg-[#2F3E4E] text-[#F9C80E]' : 'bg-white'
              }`}
            >
              {sys === 'both' ? 'Both Side-by-Side' : sys}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[#475569]">Case:</span>
          {(
            [
              ['title', 'Title Case'],
              ['upper', 'UPPERCASE'],
              ['sentence', 'Sentence'],
            ] as const
          ).map(([cKey, cLbl]) => (
            <button
              key={cKey}
              type="button"
              onClick={() => setCaseStyle(cKey)}
              className={`px-2.5 py-1 rounded-lg border border-[#2F3E4E] cursor-pointer ${
                caseStyle === cKey ? 'bg-[#F9C80E] text-[#2F3E4E]' : 'bg-white'
              }`}
            >
              {cLbl}
            </button>
          ))}
        </div>

        <label className="inline-flex items-center gap-1.5 cursor-pointer ml-auto">
          <input
            type="checkbox"
            checked={includeRupees}
            onChange={(e) => setIncludeRupees(e.target.checked)}
            className="w-4 h-4 accent-[#2F3E4E]"
          />
          <span>&ldquo;Rupees&rdquo;</span>
        </label>
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={includeOnly}
            onChange={(e) => setIncludeOnly(e.target.checked)}
            className="w-4 h-4 accent-[#2F3E4E]"
          />
          <span>&ldquo;Only&rdquo;</span>
        </label>
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={paiseFraction}
            onChange={(e) => setPaiseFraction(e.target.checked)}
            className="w-4 h-4 accent-[#2F3E4E]"
          />
          <span>Paise as 50/100</span>
        </label>
      </div>

      {mode === 'single' ? (
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
                <label htmlFor="cheque-payee-input" className="block text-xs font-bold text-[#2F3E4E] mb-1">
                  Payee Name (Optional for Cheque Preview)
                </label>
                <input
                  id="cheque-payee-input"
                  type="text"
                  value={payeeName}
                  onChange={(e) => setPayeeName(e.target.value)}
                  placeholder="e.g. Varsha Cars Private Limited"
                  className="w-full px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white text-xs font-bold text-[#2F3E4E]"
                />
              </div>

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

            {breakdown && (
              <div className="p-4 rounded-2xl bg-white border-[1.5px] border-[#2F3E4E] space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] block">
                  Indian Place-Value Breakdown
                </span>
                <div className="grid grid-cols-5 gap-1.5 text-center font-mono">
                  {[
                    ['Crores', breakdown.crores],
                    ['Lakhs', breakdown.lakhs],
                    ['Thous.', breakdown.thousands],
                    ['Units', breakdown.units],
                    ['Paise', breakdown.paise],
                  ].map(([lbl, val]) => (
                    <div key={String(lbl)} className="p-2 rounded-lg bg-[#FEF2C8]/65 border border-[#2F3E4E]/25">
                      <div className="text-[10px] font-sans font-bold text-[#64748B]">{lbl}</div>
                      <div className="text-sm font-extrabold text-[#2F3E4E]">{val}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                  {system === 'international'
                    ? 'International Format Output'
                    : system === 'both'
                    ? 'Indian + International Output'
                    : 'Cheque-Ready Output'}
                </span>
                <span className="font-mono tabular-nums font-extrabold text-sm px-2.5 py-1 rounded-lg bg-[#CEE5DC] border border-[#2F3E4E] text-[#2F3E4E]">
                  ₹ {formattedDigits}/-
                </span>
              </div>

              {(system === 'indian' || system === 'both') && (
                <div className="p-4 rounded-xl bg-[#FEF2C8]/65 border border-[#2F3E4E]/35 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                    Indian System (Crores · Lakhs)
                  </span>
                  <p className="font-display font-bold text-base sm:text-lg text-[#2F3E4E] leading-snug">
                    {indianWords || 'Enter a positive INR amount to generate Indian English cheque words.'}
                  </p>
                </div>
              )}

              {(system === 'international' || system === 'both') && (
                <div className="p-4 rounded-xl bg-[#CEE5DC]/45 border border-[#2F3E4E]/35 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                    International System (Billions · Millions)
                  </span>
                  <p className="font-display font-bold text-base sm:text-lg text-[#2F3E4E] leading-snug">
                    {internationalWords || 'Enter a positive amount to generate Million/Billion words.'}
                  </p>
                </div>
              )}

              {/* Visual Account-Payee Cheque Strip */}
              {isValid && (
                <div className="p-4 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FFFDF5] relative overflow-hidden space-y-2.5">
                  <div className="flex items-center justify-between text-[10px] font-mono font-bold text-[#64748B]">
                    <span className="px-2 py-0.5 border border-[#2F3E4E] bg-[#FEF2C8] text-[#2F3E4E]">
                      A/C PAYEE ONLY
                    </span>
                    <span>CTS-2010 CHEQUE PREVIEW</span>
                  </div>
                  <div className="text-xs font-semibold text-[#2F3E4E] border-b border-dashed border-[#2F3E4E]/40 pb-1">
                    <span className="text-[#64748B] mr-2">PAY:</span>
                    <span className="font-bold">{payeeName.trim() || '______________________________'}</span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-xs font-bold text-[#2F3E4E] flex-1 leading-relaxed border-b border-dashed border-[#2F3E4E]/40 pb-1">
                      <span className="text-[#64748B] font-semibold mr-2">RUPEES:</span>
                      {primaryWords}
                    </div>
                    <div className="px-3 py-1.5 border-[1.5px] border-[#2F3E4E] bg-[#CEE5DC]/50 font-mono font-extrabold text-sm text-[#2F3E4E] shrink-0">
                      ₹ {formattedDigits}/-
                    </div>
                  </div>
                </div>
              )}

              <ToolExportBar
                onClear={handleClear}
                onCopy={() => void handleCopy()}
                copied={copied}
                copyLabel="Copy Words"
                disabled={!primaryWords}
                onExcel={() => {
                  downloadExcelWorkbook({
                    filename: 'INR_Amount_In_Words.xlsx',
                    sheets: [
                      {
                        name: 'Amount_In_Words',
                        headers: ['Numeric Amount', 'Formatted INR', 'Indian Words', 'International Words'],
                        rows: [[numericValue, `₹ ${formattedDigits}/-`, indianWords, internationalWords]],
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
                      { label: 'Indian Words', value: indianWords },
                    ],
                    sections: [
                      { heading: 'Cheque-Ready Wording (Indian)', body: indianWords },
                      { heading: 'International Wording', body: internationalWords },
                    ],
                  });
                }}
                onJson={() => {
                  downloadJsonFile('INR_Amount_In_Words.json', {
                    numericValue,
                    formatted: `₹ ${formattedDigits}/-`,
                    indianWords,
                    internationalWords,
                    standardIndianDefault: numberToWordsIndian(numericValue),
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
                      headers: ['System', 'Words'],
                      rows: [
                        ['Amount in Figures', `Rs. ${formattedDigits}/-`],
                        ['Indian System', indianWords],
                        ['International System', internationalWords],
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
                      <p style="font-size:15px;font-weight:700;padding:12px;border:1px solid #cbd5e1;border-radius:8px;background:#fffdf5;"><strong>Indian:</strong> ${indianWords}</p>
                      <p style="font-size:14px;font-weight:600;padding:12px;border:1px solid #cbd5e1;border-radius:8px;"><strong>International:</strong> ${internationalWords}</p>
                    `,
                  });
                }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-5 space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="batch-amounts-box" className="text-xs font-bold text-[#2F3E4E]">
                  Paste Amounts (One Per Line)
                </label>
              </div>
              <textarea
                id="batch-amounts-box"
                rows={10}
                value={batchInput}
                onChange={(e) => setBatchInput(e.target.value)}
                placeholder={'12500\n49999\n148520.75\n2500000'}
                className="w-full p-3.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white font-mono text-xs font-bold text-[#2F3E4E]"
              />
            </div>

            <div className="lg:col-span-7 space-y-3">
              <div className="rounded-xl border-[1.5px] border-[#2F3E4E] bg-white overflow-x-auto max-h-80">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#2F3E4E] text-[#FFFDF5] sticky top-0">
                    <tr>
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Figure</th>
                      <th className="px-3 py-2">
                        {system === 'international' ? 'International Words' : 'Indian Words'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2F3E4E]/15">
                    {batchResults.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-[#64748B]">
                          Paste amounts on the left to convert an entire invoice / cheque schedule at once.
                        </td>
                      </tr>
                    ) : (
                      batchResults.map((row) => (
                        <tr key={row.idx} className="hover:bg-[#FEF2C8]/40">
                          <td className="px-3 py-2 font-mono text-[#64748B]">{row.idx}</td>
                          <td className="px-3 py-2 font-mono font-bold whitespace-nowrap">{row.formatted}</td>
                          <td className="px-3 py-2 font-semibold text-[#2F3E4E]">
                            {system === 'international' ? row.international : row.indian}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <ToolExportBar
                onClear={() => setBatchInput('')}
                onCopy={() => void handleCopy()}
                copied={copied}
                copyLabel="Copy All"
                disabled={batchResults.length === 0}
                onExcel={() => {
                  downloadExcelWorkbook({
                    filename: 'Batch_INR_Words.xlsx',
                    sheets: [
                      {
                        name: 'Batch_Words',
                        headers: ['#', 'Formatted Figure', 'Indian Words', 'International Words'],
                        rows: batchResults.map((r) => [r.idx, r.formatted, r.indian, r.international]),
                      },
                    ],
                  });
                }}
                onCsv={() => {
                  downloadBomCsv({
                    filename: 'Batch_INR_Words.csv',
                    headers: ['#', 'Formatted Figure', 'Indian Words', 'International Words'],
                    rows: batchResults.map((r) => [r.idx, r.formatted, r.indian, r.international]),
                  });
                }}
                onJson={() => downloadJsonFile('Batch_INR_Words.json', batchResults)}
                onPdf={() => {
                  exportStructuredReportPdf({
                    title: 'Batch INR Amount in Words Schedule',
                    filename: 'Batch_INR_Words.pdf',
                    table: {
                      title: 'Converted Figures',
                      headers: ['#', 'Amount', 'Words'],
                      rows: batchResults.map((r) => [String(r.idx), r.formatted, r.indian]),
                    },
                  });
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
