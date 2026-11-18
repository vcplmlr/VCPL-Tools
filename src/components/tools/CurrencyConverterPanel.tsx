import React, { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  RefreshCw,
} from 'lucide-react';
import {
  downloadBomCsv,
  downloadExcelWorkbook,
  downloadJsonFile,
  downloadWordDocument,
  exportStructuredReportPdf,
  printHtmlDocument,
} from '../../utils/printReport';
import { ToolExportBar } from './ToolExportBar';

interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  defaultPerUsd: number;
}

const CURRENCIES: CurrencyInfo[] = [
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', defaultPerUsd: 86.25 },
  { code: 'USD', name: 'US Dollar', symbol: '$', defaultPerUsd: 1.0 },
  { code: 'EUR', name: 'Euro', symbol: '€', defaultPerUsd: 0.92 },
  { code: 'GBP', name: 'British Pound', symbol: '£', defaultPerUsd: 0.78 },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', defaultPerUsd: 3.6725 },
  { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼', defaultPerUsd: 3.75 },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', defaultPerUsd: 1.34 },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', defaultPerUsd: 1.54 },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', defaultPerUsd: 1.41 },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', defaultPerUsd: 152.4 },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', defaultPerUsd: 0.88 },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', defaultPerUsd: 7.24 },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', defaultPerUsd: 7.78 },
  { code: 'QAR', name: 'Qatari Riyal', symbol: 'QAR', defaultPerUsd: 3.64 },
  { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'KD', defaultPerUsd: 0.308 },
  { code: 'OMR', name: 'Omani Rial', symbol: 'OMR', defaultPerUsd: 0.385 },
  { code: 'BHD', name: 'Bahraini Dinar', symbol: 'BD', defaultPerUsd: 0.376 },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', defaultPerUsd: 4.44 },
  { code: 'THB', name: 'Thai Baht', symbol: '฿', defaultPerUsd: 34.1 },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩', defaultPerUsd: 1410 },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', defaultPerUsd: 1.69 },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', defaultPerUsd: 18.2 },
];

export const CurrencyConverterPanel: React.FC = () => {
  const [amountInput, setAmountInput] = useState<string>('');
  const numericAmount = Math.max(0, Number(amountInput) || 0);
  const [fromCode, setFromCode] = useState<string>('USD');
  const [toCode, setToCode] = useState<string>('INR');
  const [bankSpreadPct, setBankSpreadPct] = useState<number>(0);
  const [customRateOverride, setCustomRateOverride] = useState<string>('');

  const [ratesPerUsd, setRatesPerUsd] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    CURRENCIES.forEach((c) => {
      map[c.code] = c.defaultPerUsd;
    });
    return map;
  });
  const [rateSourceLabel, setRateSourceLabel] = useState<string>('Built-in Reference Rates');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [copiedResult, setCopiedResult] = useState<boolean>(false);

  const handleRefreshLiveRates = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const resp = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!resp.ok) throw new Error('Rate fetch failed');
      const data = await resp.json();
      if (data && data.rates && typeof data.rates === 'object') {
        const next: Record<string, number> = { ...ratesPerUsd };
        CURRENCIES.forEach((c) => {
          const val = Number(data.rates[c.code]);
          if (Number.isFinite(val) && val > 0) {
            next[c.code] = val;
          }
        });
        setRatesPerUsd(next);
        const nowStr = new Date().toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
        });
        setRateSourceLabel(`Live Spot Rates (Updated ${nowStr})`);
      }
    } catch {
      setRateSourceLabel('Offline Reference Rates (Live endpoint unreachable)');
    } finally {
      setIsRefreshing(false);
    }
  };

  const fromCurrency = CURRENCIES.find((c) => c.code === fromCode) || CURRENCIES[1];
  const toCurrency = CURRENCIES.find((c) => c.code === toCode) || CURRENCIES[0];

  const midMarketRate = useMemo(() => {
    const rFrom = ratesPerUsd[fromCode] || 1;
    const rTo = ratesPerUsd[toCode] || 1;
    return rTo / rFrom;
  }, [ratesPerUsd, fromCode, toCode]);

  const parsedCustom = Number(customRateOverride);
  const baseUnitRate =
    customRateOverride.trim() !== '' && Number.isFinite(parsedCustom) && parsedCustom > 0
      ? parsedCustom
      : midMarketRate;

  const effectiveRate = baseUnitRate * (1 - Math.max(0, bankSpreadPct) / 100);
  const convertedAmount = numericAmount * effectiveRate;
  const inverseRate = effectiveRate > 0 ? 1 / effectiveRate : 0;

  const matrixRows = useMemo(() => {
    const rFrom = ratesPerUsd[fromCode] || 1;
    return CURRENCIES.filter((c) => c.code !== fromCode).map((c) => {
      const unitRate = (ratesPerUsd[c.code] || 1) / rFrom;
      const eff = unitRate * (1 - Math.max(0, bankSpreadPct) / 100);
      return {
        code: c.code,
        name: c.name,
        symbol: c.symbol,
        unitRate: eff,
        converted: numericAmount * eff,
      };
    });
  }, [ratesPerUsd, fromCode, numericAmount, bankSpreadPct]);

  const handleSwap = () => {
    setFromCode(toCode);
    setToCode(fromCode);
    setCustomRateOverride('');
  };

  const handleClear = () => {
    setAmountInput('');
    setBankSpreadPct(0);
    setCustomRateOverride('');
  };

  const handleCopy = async () => {
    const text = `${numericAmount} ${fromCode} = ${convertedAmount.toFixed(2)} ${toCode} (1 ${fromCode} = ${effectiveRate.toFixed(4)} ${toCode})`;
    await navigator.clipboard.writeText(text);
    setCopiedResult(true);
    window.setTimeout(() => setCopiedResult(false), 1600);
  };

  const handleExportCsv = () => {
    downloadBomCsv({
      filename: `currency-conversion-${fromCode}-matrix.csv`,
      preambleLines: [
        ['Currency Conversion Matrix — VCPL Tools'],
        ['Source Amount', numericAmount, 'Base Currency', fromCode],
        ['Target Currency', toCode, 'Converted Value', Number(convertedAmount.toFixed(4))],
        ['Effective Rate', Number(effectiveRate.toFixed(6)), 'Bank Markup %', bankSpreadPct],
        ['Rate Feed', rateSourceLabel],
      ],
      headers: ['Target Code', 'Currency Name', 'Symbol', `1 ${fromCode} Rate`, `Converted (${numericAmount} ${fromCode})`],
      rows: matrixRows.map((r) => [
        r.code,
        r.name,
        r.symbol,
        Number(r.unitRate.toFixed(6)),
        Number(r.converted.toFixed(2)),
      ]),
    });
  };

  const handleExportExcel = () => {
    downloadExcelWorkbook({
      filename: `currency-conversion-${fromCode}-matrix.xlsx`,
      sheets: [
        {
          name: 'FX Conversion Matrix',
          preambleLines: [
            ['Currency Conversion Report — VCPL Tools'],
            ['Input Amount', numericAmount, 'From', fromCode],
            ['Converted Amount', Number(convertedAmount.toFixed(4)), 'To', toCode],
            ['Effective Rate', Number(effectiveRate.toFixed(6)), 'Markup %', bankSpreadPct],
            ['Source', rateSourceLabel],
          ],
          headers: ['Code', 'Currency', 'Symbol', `1 ${fromCode} Rate`, `Converted (${numericAmount} ${fromCode})`],
          rows: matrixRows.map((r) => [
            r.code,
            r.name,
            r.symbol,
            Number(r.unitRate.toFixed(6)),
            Number(r.converted.toFixed(2)),
          ]),
        },
      ],
    });
  };

  const handleExportWord = () => {
    void downloadWordDocument({
      filename: `currency-conversion-${fromCode}-${toCode}.docx`,
      title: `Currency Conversion Report (${fromCode} to ${toCode})`,
      subtitle: `${rateSourceLabel} · Bank/Card Markup: ${bankSpreadPct}%`,
      kpis: [
        { label: `Input (${fromCode})`, value: `${fromCurrency.symbol} ${numericAmount.toLocaleString('en-IN')}` },
        { label: `Converted (${toCode})`, value: `${toCurrency.symbol} ${convertedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
        { label: 'Effective FX Rate', value: `1 ${fromCode} = ${effectiveRate.toFixed(4)} ${toCode}` },
        { label: 'Inverse Rate', value: `1 ${toCode} = ${inverseRate.toFixed(4)} ${fromCode}` },
      ],
      table: {
        title: `21-Currency Conversion Matrix (Base: ${numericAmount} ${fromCode})`,
        headers: ['Code', 'Currency', `Rate (1 ${fromCode})`, 'Converted Value'],
        rows: matrixRows.map((r) => [
          r.code,
          r.name,
          r.unitRate.toFixed(4),
          `${r.symbol} ${r.converted.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        ]),
      },
    });
  };

  const handleExportJson = () => {
    downloadJsonFile({
      filename: `currency-conversion-${fromCode}-${toCode}.json`,
      data: {
        fromCode,
        toCode,
        inputAmount: numericAmount,
        convertedAmount: Number(convertedAmount.toFixed(4)),
        effectiveRate,
        inverseRate,
        bankSpreadPct,
        rateSourceLabel,
        matrix: matrixRows,
      },
    });
  };

  const handleSavePdf = () => {
    exportStructuredReportPdf({
      title: `Currency Conversion Report (${fromCode} to ${toCode})`,
      subtitle: `${rateSourceLabel} | Bank/Card Markup: ${bankSpreadPct}%`,
      filename: `currency-conversion-${fromCode}-${toCode}.pdf`,
      kpis: [
        { label: `Input (${fromCode})`, value: `${fromCurrency.symbol} ${numericAmount.toLocaleString('en-IN')}` },
        { label: `Converted (${toCode})`, value: `${toCurrency.symbol} ${convertedAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` },
        { label: 'Effective FX Rate', value: `1 ${fromCode} = ${effectiveRate.toFixed(4)} ${toCode}` },
        { label: 'Inverse Rate', value: `1 ${toCode} = ${inverseRate.toFixed(4)} ${fromCode}` },
      ],
      table: {
        title: `Multi-Currency Conversion Matrix (Base: ${numericAmount} ${fromCode})`,
        headers: ['Code', 'Currency', `Rate (1 ${fromCode})`, 'Converted Value'],
        rows: matrixRows.map((r) => [
          r.code,
          r.name,
          r.unitRate.toFixed(4),
          `${r.symbol} ${r.converted.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        ]),
      },
    });
  };

  const handlePrint = () => {
    const esc = (v: string | number) =>
      String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const rowsHtml = matrixRows
      .map(
        (r) =>
          `<tr><td><strong>${esc(r.code)}</strong></td><td>${esc(r.name)}</td><td class="num">${r.unitRate.toFixed(4)}</td><td class="num"><strong>${esc(r.symbol)} ${r.converted.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td></tr>`
      )
      .join('');

    void printHtmlDocument({
      title: `Currency Conversion — ${fromCode} to ${toCode}`,
      bodyHtml: `
        <div style="border-bottom:2px solid #0f172a;padding-bottom:8px;margin-bottom:10px;">
          <h1 style="font-size:17px;">Currency Exchange &amp; Multi-Currency Conversion Sheet</h1>
          <p style="margin:0;color:#475569;font-size:11px;">${esc(rateSourceLabel)} · Bank/Card Markup: ${bankSpreadPct}%</p>
        </div>
        <div class="kpi-grid" style="grid-template-columns:repeat(3,minmax(0,1fr));">
          <div class="kpi-card">
            <div class="kpi-label">Source Amount</div>
            <div class="kpi-val">${esc(fromCurrency.symbol)} ${numericAmount.toLocaleString('en-IN')} ${esc(fromCode)}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Converted Total</div>
            <div class="kpi-val">${esc(toCurrency.symbol)} ${convertedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${esc(toCode)}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Effective Rate</div>
            <div class="kpi-val">1 ${esc(fromCode)} = ${effectiveRate.toFixed(4)} ${esc(toCode)}</div>
          </div>
        </div>
        <table>
          <thead><tr><th>Code</th><th>Currency</th><th>Rate (1 ${esc(fromCode)})</th><th>Converted Value</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      `,
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left: Converter Controls */}
      <div className="lg:col-span-5 bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-6 shadow-[0_4px_0_#2F3E4E] space-y-5 no-print">
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#2F3E4E]/15">
          <div>
            <h2 className="font-display font-extrabold text-base text-[#2F3E4E]">
              Currency &amp; Forex Converter
            </h2>
            <p className="text-[11px] text-[#64748B]">{rateSourceLabel}</p>
          </div>
          <button
            type="button"
            onClick={handleRefreshLiveRates}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#2F3E4E] bg-[#CEE5DC] hover:bg-[#bddbd0] text-xs font-bold text-[#2F3E4E] cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Updating...' : 'Live Rates'}</span>
          </button>
        </div>

        <div className="space-y-2">
          <label htmlFor="fx-amount" className="block text-xs font-bold text-[#2F3E4E]">
            Amount ({fromCode})
          </label>
          <input
            id="fx-amount"
            type="number"
            min={0}
            step={100}
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            placeholder="Enter amount to convert..."
            className="w-full px-3.5 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white font-mono text-lg font-bold text-[#2F3E4E]"
          />
          <div className="flex flex-wrap gap-1.5">
            {[100, 500, 1000, 10000, 100000].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setAmountInput(String(preset))}
                className="px-2.5 py-1 rounded-lg border border-[#2F3E4E]/30 bg-white hover:bg-[#FEF2C8] font-mono text-[11px] font-bold cursor-pointer"
              >
                {preset.toLocaleString('en-IN')}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-11 gap-2 items-end">
          <div className="col-span-5">
            <label htmlFor="fx-from" className="block text-xs font-bold text-[#2F3E4E] mb-1">
              From
            </label>
            <select
              id="fx-from"
              value={fromCode}
              onChange={(e) => {
                setFromCode(e.target.value);
                setCustomRateOverride('');
              }}
              className="w-full px-2.5 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white text-xs font-bold text-[#2F3E4E]"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-1 flex justify-center">
            <button
              type="button"
              onClick={handleSwap}
              aria-label="Swap currencies"
              className="w-9 h-9 rounded-lg border border-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#F9C80E] flex items-center justify-center cursor-pointer"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-[#2F3E4E]" />
            </button>
          </div>

          <div className="col-span-5">
            <label htmlFor="fx-to" className="block text-xs font-bold text-[#2F3E4E] mb-1">
              To
            </label>
            <select
              id="fx-to"
              value={toCode}
              onChange={(e) => {
                setToCode(e.target.value);
                setCustomRateOverride('');
              }}
              className="w-full px-2.5 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white text-xs font-bold text-[#2F3E4E]"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Real-World Bank / Card Forex Markup & Custom Rate Override */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#2F3E4E]/15">
          <div>
            <label htmlFor="fx-spread" className="block text-[11px] font-bold text-[#475569] mb-1">
              Bank / Card Markup %
            </label>
            <input
              id="fx-spread"
              type="number"
              min={0}
              max={10}
              step={0.25}
              value={bankSpreadPct}
              onChange={(e) => setBankSpreadPct(Math.max(0, Number(e.target.value) || 0))}
              className="w-full px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/40 bg-white font-mono text-xs font-bold"
            />
          </div>
          <div>
            <label htmlFor="fx-custom" className="block text-[11px] font-bold text-[#475569] mb-1">
              Custom Rate (Optional)
            </label>
            <input
              id="fx-custom"
              type="number"
              min={0}
              step={0.01}
              value={customRateOverride}
              onChange={(e) => setCustomRateOverride(e.target.value)}
              placeholder={midMarketRate.toFixed(4)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/40 bg-white font-mono text-xs font-bold"
            />
          </div>
        </div>
      </div>

      {/* Right: Conversion Output & Multi-Currency Matrix */}
      <div className="lg:col-span-7 space-y-5">
        <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-6 shadow-[0_4px_0_#2F3E4E] space-y-4">
          <div className="p-5 rounded-xl bg-[#CEE5DC] border-[1.5px] border-[#2F3E4E] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#2F3E4E]/80 block">
                {numericAmount.toLocaleString('en-IN')} {fromCurrency.name} equals
              </span>
              <span className="font-mono text-3xl sm:text-4xl font-extrabold text-[#2F3E4E] tabular-nums block mt-1">
                {toCurrency.symbol}{' '}
                {convertedAmount.toLocaleString('en-IN', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                <span className="text-lg font-bold">{toCode}</span>
              </span>
            </div>

            <div className="sm:text-right text-xs font-mono font-bold text-[#2F3E4E] space-y-1">
              <div>
                1 {fromCode} = {effectiveRate.toFixed(4)} {toCode}
              </div>
              <div className="text-[#475569]">
                1 {toCode} = {inverseRate.toFixed(4)} {fromCode}
              </div>
            </div>
          </div>

          <ToolExportBar
            title="21-Currency Comparison Matrix"
            onClear={handleClear}
            onCopy={handleCopy}
            copied={copiedResult}
            onExcel={handleExportExcel}
            onCsv={handleExportCsv}
            onWord={handleExportWord}
            onJson={handleExportJson}
            onPdf={handleSavePdf}
            onPrint={handlePrint}
          />

          <div className="overflow-x-auto max-h-[360px] rounded-xl border border-[#2F3E4E]/20 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-[#FEF2C8] border-b border-[#2F3E4E]/20">
                <tr>
                  <th className="py-2.5 px-3 font-extrabold text-[#2F3E4E]">Currency</th>
                  <th className="py-2.5 px-3 font-extrabold text-[#2F3E4E] text-right">
                    1 {fromCode}
                  </th>
                  <th className="py-2.5 px-3 font-extrabold text-[#2F3E4E] text-right">
                    Converted Value
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {matrixRows.map((r) => (
                  <tr
                    key={r.code}
                    onClick={() => setToCode(r.code)}
                    className={`cursor-pointer hover:bg-[#FEF2C8]/40 ${
                      r.code === toCode ? 'bg-[#CEE5DC]/45 font-bold' : ''
                    }`}
                  >
                    <td className="py-2 px-3 text-[#2F3E4E]">
                      <span className="font-mono font-bold">{r.code}</span>{' '}
                      <span className="text-[#475569]">· {r.name}</span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-[#475569]">
                      {r.unitRate.toFixed(4)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums font-bold text-[#2F3E4E]">
                      {r.symbol}{' '}
                      {r.converted.toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
