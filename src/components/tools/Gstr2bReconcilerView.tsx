import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Printer,
  RotateCcw,
  Search,
  Upload,
  X,
} from 'lucide-react';
import { ToolCatalogItem } from '../../types/tools';
import {
  GstInvoiceRecord,
  Gstr2bReconcileResult,
  ReconcileRow,
  ReconcileStatus,
  downloadGstr2bSampleTemplates,
  exportReconciliationExcel,
  parseGstWorkbookFile,
  reconcileGstr2bVsTally,
} from '../../utils/gstr2bEngine';
import { formatINR } from '../../utils/numberToWords';
import {
  downloadBomCsv,
  downloadJsonFile,
  printHtmlDocument,
} from '../../utils/printReport';
import {
  RecoPeriodFilter,
  createDefaultRecoPeriodFilter,
  extractPeriodChoicesFromKeys,
  isDateKeyInRecoPeriod,
  parseTextDateToKey,
  resolveRecoPeriodBounds,
} from '../../utils/recoPeriodFilter';
import { FileDropZone } from './FileDropZone';
import { RecoPeriodFilterBar } from './RecoPeriodFilterBar';

interface Gstr2bReconcilerViewProps {
  tool?: ToolCatalogItem;
  onBack?: () => void;
}

const STATUS_BADGES: Record<ReconcileStatus, { label: string; cls: string }> = {
  EXACT_MATCH: { label: 'Exact Match', cls: 'bg-[#CEE5DC] text-emerald-900 border-[#2F3E4E]' },
  VALUE_MISMATCH: { label: 'Value Mismatch', cls: 'bg-[#F9C80E] text-[#2F3E4E] border-[#2F3E4E]' },
  ONLY_IN_2B: { label: 'Only in GSTR-2B', cls: 'bg-[#FFE1B3] text-[#2F3E4E] border-[#2F3E4E]' },
  ONLY_IN_TALLY: { label: 'Only in Tally', cls: 'bg-red-100 text-red-900 border-red-800' },
};

export const Gstr2bReconcilerView: React.FC<Gstr2bReconcilerViewProps> = ({ tool, onBack }) => {
  const [records2B, setRecords2B] = useState<GstInvoiceRecord[]>([]);
  const [recordsTally, setRecordsTally] = useState<GstInvoiceRecord[]>([]);
  const [file2BName, setFile2BName] = useState('');
  const [fileTallyName, setFileTallyName] = useState('');
  const [tolerance, setTolerance] = useState<number>(2);
  const [statusFilter, setStatusFilter] = useState<'ALL' | ReconcileStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [taxHeadSwapOnly, setTaxHeadSwapOnly] = useState(false);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [periodFilter, setPeriodFilter] = useState<RecoPeriodFilter>(() =>
    createDefaultRecoPeriodFilter()
  );
  const [errorMsg, setErrorMsg] = useState('');

  const handleClearAll = () => {
    setRecords2B([]);
    setRecordsTally([]);
    setFile2BName('');
    setFileTallyName('');
    setStatusFilter('ALL');
    setSearchQuery('');
    setTaxHeadSwapOnly(false);
    setSelectedRowId(null);
    setPeriodFilter(createDefaultRecoPeriodFilter());
    setErrorMsg('');
  };

  const availablePeriods = useMemo(() => {
    if (records2B.length === 0 && recordsTally.length === 0) return undefined;
    const keys = [
      ...records2B.map((r) => parseTextDateToKey(r.invoiceDate)),
      ...recordsTally.map((r) => parseTextDateToKey(r.invoiceDate)),
    ];
    return extractPeriodChoicesFromKeys(keys);
  }, [records2B, recordsTally]);

  const filteredInputs = useMemo(() => {
    const f2b = records2B.filter((r) =>
      isDateKeyInRecoPeriod(parseTextDateToKey(r.invoiceDate), periodFilter)
    );
    const ftally = recordsTally.filter((r) =>
      isDateKeyInRecoPeriod(parseTextDateToKey(r.invoiceDate), periodFilter)
    );
    return { f2b, ftally };
  }, [records2B, recordsTally, periodFilter]);

  const result: Gstr2bReconcileResult | null = useMemo(() => {
    if (records2B.length === 0 && recordsTally.length === 0) return null;
    return reconcileGstr2bVsTally(filteredInputs.f2b, filteredInputs.ftally, tolerance);
  }, [records2B.length, recordsTally.length, filteredInputs, tolerance]);

  const taxHeadSwapCount = useMemo(
    () => (result ? result.rows.filter((r) => r.taxHeadMismatch).length : 0),
    [result]
  );

  const visibleRows = useMemo(() => {
    if (!result) return [];
    const q = searchQuery.trim().toLowerCase();
    return result.rows.filter((r) => {
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (taxHeadSwapOnly && !r.taxHeadMismatch) return false;
      if (!q) return true;
      return (
        r.gstin.toLowerCase().includes(q) ||
        r.partyName.toLowerCase().includes(q) ||
        r.invoiceNo2B.toLowerCase().includes(q) ||
        r.invoiceNoTally.toLowerCase().includes(q)
      );
    });
  }, [result, statusFilter, taxHeadSwapOnly, searchQuery]);

  const inspectedRow: ReconcileRow | null = useMemo(
    () => (selectedRowId && result ? result.rows.find((r) => r.id === selectedRowId) || null : null),
    [selectedRowId, result]
  );

  const matchRatePct = useMemo(() => {
    if (!result || result.rows.length === 0) return 0;
    return (result.summary.exactCount / result.rows.length) * 100;
  }, [result]);

  const periodBounds = useMemo(() => resolveRecoPeriodBounds(periodFilter), [periodFilter]);

  const processFile2B = async (file: File) => {
    setErrorMsg('');
    try {
      const parsed = await parseGstWorkbookFile(file, '2B');
      if (parsed.length === 0) {
        setErrorMsg(`No B2B invoice rows found in ${file.name}. Verify GSTIN/Invoice columns or use our clean Excel template.`);
      }
      setRecords2B(parsed);
      setFile2BName(`${file.name} (${parsed.length} rows)`);
      setSelectedRowId(null);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to parse GSTR-2B file.');
    }
  };

  const handleUpload2B = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processFile2B(file);
    e.target.value = '';
  };

  const processFileTally = async (file: File) => {
    setErrorMsg('');
    try {
      const parsed = await parseGstWorkbookFile(file, 'Tally');
      if (parsed.length === 0) {
        setErrorMsg(`No purchase voucher rows found in ${file.name}. Verify GSTIN/Invoice columns or use our clean Excel template.`);
      }
      setRecordsTally(parsed);
      setFileTallyName(`${file.name} (${parsed.length} rows)`);
      setSelectedRowId(null);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to parse Tally Purchase Register.');
    }
  };

  const handleUploadTally = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processFileTally(file);
    e.target.value = '';
  };

  const exportCsvAudit = () => {
    if (!result) return;
    downloadBomCsv({
      filename: `GSTR2B_vs_Tally_Audit${periodBounds.isFiltered ? `_${periodBounds.shortLabel}` : ''}.csv`,
      headers: [
        'Status',
        'GSTIN',
        'Supplier Name',
        '2B Inv No',
        '2B Date',
        'Tally Inv No',
        'Tally Date',
        'Taxable 2B',
        'Taxable Tally',
        'IGST 2B',
        'IGST Tally',
        'CGST 2B',
        'CGST Tally',
        'SGST 2B',
        'SGST Tally',
        'Total Tax 2B',
        'Total Tax Tally',
        'Diff (2B - Tally)',
        'Tax Head Swap',
      ],
      rows: visibleRows.map((r) => [
        STATUS_BADGES[r.status].label,
        r.gstin,
        r.partyName,
        r.invoiceNo2B,
        r.date2B,
        r.invoiceNoTally,
        r.dateTally,
        r.taxable2B,
        r.taxableTally,
        r.igst2B,
        r.igstTally,
        r.cgst2B,
        r.cgstTally,
        r.sgst2B,
        r.sgstTally,
        r.totalTax2B,
        r.totalTaxTally,
        r.taxDiff,
        r.taxHeadMismatch ? 'IGST vs CGST/SGST' : 'OK',
      ]),
    });
  };

  const exportJsonAudit = () => {
    if (!result) return;
    downloadJsonFile(
      `GSTR2B_vs_Tally_Audit${periodBounds.isFiltered ? `_${periodBounds.shortLabel}` : ''}.json`,
      {
        period: periodBounds.label,
        tolerance,
        summary: result.summary,
        matchRatePct: Number(matchRatePct.toFixed(2)),
        rows: visibleRows,
      }
    );
  };

  const printAuditSummary = () => {
    if (!result) return;
    void printHtmlDocument({
      title: 'GSTR-2B vs Tally ITC Reconciliation Audit',
      bodyHtml: `
        <h1>GSTR-2B vs Tally Prime ITC Reconciliation</h1>
        <p>${periodBounds.isFiltered ? `Period: ${periodBounds.label} (${periodBounds.rangeText}) · ` : ''}Tolerance: ±₹${tolerance} · Match Rate: ${matchRatePct.toFixed(1)}%</p>
        <div class="kpi-grid">
          <div class="kpi-card"><div class="kpi-label">Eligible Matched ITC</div><div class="kpi-val">${formatINR(result.summary.eligibleItc)}</div></div>
          <div class="kpi-card"><div class="kpi-label">Missed ITC (Only 2B)</div><div class="kpi-val">${formatINR(result.summary.missedItc)}</div></div>
          <div class="kpi-card"><div class="kpi-label">Excess Claim Risk</div><div class="kpi-val">${formatINR(result.summary.excessClaimRisk)}</div></div>
          <div class="kpi-card"><div class="kpi-label">Mismatches</div><div class="kpi-val">${result.summary.mismatchCount}</div></div>
        </div>
        <table>
          <thead><tr><th>Status</th><th>GSTIN</th><th>Supplier</th><th>2B Inv</th><th>Tally Inv</th><th class="num">Tax (2B)</th><th class="num">Tax (Tally)</th><th class="num">Diff</th></tr></thead>
          <tbody>${visibleRows
            .map(
              (r) =>
                `<tr><td>${STATUS_BADGES[r.status].label}</td><td>${r.gstin}</td><td>${r.partyName}</td><td>${r.invoiceNo2B}</td><td>${r.invoiceNoTally}</td><td class="num">${formatINR(r.totalTax2B)}</td><td class="num">${formatINR(r.totalTaxTally)}</td><td class="num">${formatINR(r.taxDiff)}</td></tr>`
            )
            .join('')}</tbody>
        </table>
      `,
    });
  };

  return (
    <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#2F3E4E]/15">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] flex items-center gap-1.5">
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#2F3E4E]" />
            {tool?.categoryName || 'Tax & GST'} · {tool?.code || 'TX-02'}
          </span>
          <h1 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] mt-1">
            {tool?.title || 'GSTR-2B vs Tally Prime ITC Reconciler'}
          </h1>
          <p className="text-xs sm:text-sm text-[#475569] mt-0.5">
            {tool?.description ||
              'Match GST Portal GSTR-2B (Excel/JSON) against Tally Prime Purchase Register to spot missing ITC, excess claims & rounding diffs.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => downloadGstr2bSampleTemplates()}
            className="px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-emerald-700" />
            Download Template (.xlsx)
          </button>
          {(records2B.length > 0 || recordsTally.length > 0 || errorMsg) && (
            <button
              type="button"
              onClick={handleClearAll}
              className="px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white hover:bg-rose-50 text-xs font-bold text-rose-700 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Clear All
            </button>
          )}
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="px-3 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] cursor-pointer"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Dual Uploader */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative">
          <FileDropZone
            accept=".xlsx,.xls,.csv,.json"
            multiple={false}
            onFiles={(files) => {
              if (files[0]) void processFile2B(files[0]);
            }}
            className="rounded-2xl border-2 border-dashed border-[#2F3E4E]/45 hover:border-[#2F3E4E] bg-[#FEF2C8]/45 transition"
          >
            <label className="block p-6 text-center cursor-pointer">
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.json"
                onChange={handleUpload2B}
                className="hidden"
              />
              <Upload className="w-6 h-6 text-[#2F3E4E] mx-auto mb-2" />
              <p className="font-display font-bold text-sm text-[#2F3E4E]">
                1. Drag &amp; Drop or Upload GSTR-2B (.xlsx / .json / .csv)
              </p>
              <p className="text-xs text-[#475569] mt-1">
                {file2BName || 'GST Portal B2B JSON or Excel Workbook'}
              </p>
            </label>
          </FileDropZone>
          {records2B.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setRecords2B([]);
                setFile2BName('');
                setSelectedRowId(null);
              }}
              title="Clear GSTR-2B file"
              className="absolute top-3 right-3 px-2 py-1 rounded-lg border border-[#2F3E4E]/40 bg-white hover:bg-rose-50 text-rose-700 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>

        <div className="relative">
          <FileDropZone
            accept=".xlsx,.xls,.csv"
            multiple={false}
            onFiles={(files) => {
              if (files[0]) void processFileTally(files[0]);
            }}
            className="rounded-2xl border-2 border-dashed border-[#2F3E4E]/45 hover:border-[#2F3E4E] bg-[#CEE5DC]/35 transition"
          >
            <label className="block p-6 text-center cursor-pointer">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleUploadTally}
                className="hidden"
              />
              <Upload className="w-6 h-6 text-[#2F3E4E] mx-auto mb-2" />
              <p className="font-display font-bold text-sm text-[#2F3E4E]">
                2. Drag &amp; Drop or Upload Tally Register (.xlsx / .csv)
              </p>
              <p className="text-xs text-[#475569] mt-1">
                {fileTallyName || 'Tally Prime GST Purchase Voucher Export'}
              </p>
            </label>
          </FileDropZone>
          {recordsTally.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setRecordsTally([]);
                setFileTallyName('');
                setSelectedRowId(null);
              }}
              title="Clear Tally file"
              className="absolute top-3 right-3 px-2 py-1 rounded-lg border border-[#2F3E4E]/40 bg-white hover:bg-rose-50 text-rose-700 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FFE1B3] text-xs font-semibold text-[#2F3E4E] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {(records2B.length > 0 || recordsTally.length > 0) && (
        <RecoPeriodFilterBar
          value={periodFilter}
          onChange={setPeriodFilter}
          available={availablePeriods}
          matchedCount={filteredInputs.f2b.length + filteredInputs.ftally.length}
          totalCount={records2B.length + recordsTally.length}
          scopeHint="Filters GSTR-2B & Tally invoices by Invoice Date before reconciliation & export"
        />
      )}

      {result && (
        <div className="space-y-5">
          {/* KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
            <div className="p-4 rounded-xl bg-[#CEE5DC]/65 border-[1.5px] border-[#2F3E4E]">
              <p className="text-[11px] font-bold uppercase text-[#475569]">Eligible Matched ITC</p>
              <p className="font-mono tabular-nums font-extrabold text-lg text-[#2F3E4E] mt-1">
                {formatINR(result.summary.eligibleItc)}
              </p>
              <p className="text-xs text-[#475569]">{result.summary.exactCount} exact invoices</p>
            </div>

            <div className="p-4 rounded-xl bg-white border-[1.5px] border-[#2F3E4E]">
              <p className="text-[11px] font-bold uppercase text-[#475569]">ITC Match Rate</p>
              <p className="font-mono tabular-nums font-extrabold text-lg text-[#12805C] mt-1">
                {matchRatePct.toFixed(1)}%
              </p>
              <p className="text-xs text-[#475569]">{result.rows.length} unique invoices</p>
            </div>

            <div className="p-4 rounded-xl bg-[#F9C80E]/45 border-[1.5px] border-[#2F3E4E]">
              <p className="text-[11px] font-bold uppercase text-[#475569]">Value Mismatches</p>
              <p className="font-mono tabular-nums font-extrabold text-lg text-[#2F3E4E] mt-1">
                {result.summary.mismatchCount}
              </p>
              <p className="text-xs text-[#475569]">Tolerance: ±₹{tolerance}</p>
            </div>

            <div className="p-4 rounded-xl bg-[#FFE1B3]/75 border-[1.5px] border-[#2F3E4E]">
              <p className="text-[11px] font-bold uppercase text-[#475569]">Missed ITC (Only 2B)</p>
              <p className="font-mono tabular-nums font-extrabold text-lg text-[#2F3E4E] mt-1">
                {formatINR(result.summary.missedItc)}
              </p>
              <p className="text-xs text-[#475569]">{result.summary.only2BCount} unbooked bills</p>
            </div>

            <div className="p-4 rounded-xl bg-red-50 border-[1.5px] border-red-800">
              <p className="text-[11px] font-bold uppercase text-red-900">Excess Claim Risk</p>
              <p className="font-mono tabular-nums font-extrabold text-lg text-red-900 mt-1">
                {formatINR(result.summary.excessClaimRisk)}
              </p>
              <p className="text-xs text-red-800">{result.summary.onlyTallyCount} missing in 2B</p>
            </div>
          </div>

          {/* Search + Status Filters + Export Toolbar */}
          <div className="space-y-3 p-4 rounded-2xl bg-[#FEF2C8]/45 border-[1.5px] border-[#2F3E4E]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    ['ALL', `All (${result.rows.length})`],
                    ['EXACT_MATCH', `Matched (${result.summary.exactCount})`],
                    ['VALUE_MISMATCH', `Mismatch (${result.summary.mismatchCount})`],
                    ['ONLY_IN_2B', `Only 2B (${result.summary.only2BCount})`],
                    ['ONLY_IN_TALLY', `Only Tally (${result.summary.onlyTallyCount})`],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setStatusFilter(key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border-[1.5px] border-[#2F3E4E] cursor-pointer ${
                      statusFilter === key
                        ? 'bg-[#2F3E4E] text-[#FFFDF5]'
                        : 'bg-white text-[#2F3E4E] hover:bg-[#FEF2C8]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
                {taxHeadSwapCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setTaxHeadSwapOnly((v) => !v)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border-[1.5px] cursor-pointer ${
                      taxHeadSwapOnly
                        ? 'bg-rose-700 text-white border-rose-800'
                        : 'bg-white text-rose-800 border-rose-700 hover:bg-rose-50'
                    }`}
                  >
                    IGST ↔ CGST/SGST Swap ({taxHeadSwapCount})
                  </button>
                )}
              </div>

              <label className="text-xs font-bold text-[#2F3E4E] flex items-center gap-1.5">
                Rounding ±₹
                <select
                  value={tolerance}
                  onChange={(e) => setTolerance(Number(e.target.value))}
                  className="px-2 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white text-xs font-bold"
                >
                  <option value={0}>₹0 (Exact)</option>
                  <option value={1}>₹1</option>
                  <option value={2}>₹2</option>
                  <option value={5}>₹5</option>
                  <option value={10}>₹10</option>
                </select>
              </label>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2 border-t border-[#2F3E4E]/15">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search supplier name, GSTIN, or invoice number..."
                  className="w-full pl-9 pr-8 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white text-xs font-semibold text-[#2F3E4E]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#2F3E4E] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    exportReconciliationExcel(
                      result,
                      periodBounds.isFiltered
                        ? `${periodBounds.label} (${periodBounds.rangeText})`
                        : undefined,
                      periodBounds.isFiltered ? periodBounds.shortLabel : undefined
                    )
                  }
                  className="px-3.5 py-2 rounded-xl bg-[#2F3E4E] hover:bg-[#1E293B] text-[#FFFDF5] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> 6-Sheet Audit (.xlsx)
                </button>
                <button
                  type="button"
                  onClick={exportCsvAudit}
                  className="px-3 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] text-[#2F3E4E] text-xs font-bold cursor-pointer"
                >
                  CSV
                </button>
                <button
                  type="button"
                  onClick={exportJsonAudit}
                  className="px-3 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] text-[#2F3E4E] text-xs font-bold cursor-pointer"
                >
                  JSON
                </button>
                <button
                  type="button"
                  onClick={printAuditSummary}
                  className="px-3 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] text-[#2F3E4E] text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> Print
                </button>
              </div>
            </div>
          </div>

          {/* Inline Row Diff Inspector */}
          {inspectedRow && (
            <div className="p-4 rounded-2xl bg-white border-[1.5px] border-[#2F3E4E] shadow-[0_3px_0_#2F3E4E] space-y-3">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#2F3E4E]/15">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                    Invoice Tax Head Breakdown
                  </span>
                  <h3 className="font-display font-extrabold text-sm text-[#2F3E4E]">
                    {inspectedRow.partyName} · <span className="font-mono">{inspectedRow.gstin}</span>
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedRowId(null)}
                  className="px-2.5 py-1 rounded-lg border border-[#2F3E4E]/40 bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] inline-flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" /> Close Inspector
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs tabular-nums">
                <div className="p-3 rounded-xl bg-[#FEF2C8]/50 border border-[#2F3E4E]/20">
                  <div className="text-[10px] font-bold text-[#64748B] uppercase">Taxable Value</div>
                  <div className="font-mono font-bold text-[#2F3E4E] mt-1">2B: {formatINR(inspectedRow.taxable2B)}</div>
                  <div className="font-mono text-[#475569]">Tally: {formatINR(inspectedRow.taxableTally)}</div>
                </div>
                <div className="p-3 rounded-xl bg-[#FEF2C8]/50 border border-[#2F3E4E]/20">
                  <div className="text-[10px] font-bold text-[#64748B] uppercase">IGST</div>
                  <div className="font-mono font-bold text-[#2F3E4E] mt-1">2B: {formatINR(inspectedRow.igst2B)}</div>
                  <div className="font-mono text-[#475569]">Tally: {formatINR(inspectedRow.igstTally)}</div>
                </div>
                <div className="p-3 rounded-xl bg-[#FEF2C8]/50 border border-[#2F3E4E]/20">
                  <div className="text-[10px] font-bold text-[#64748B] uppercase">CGST</div>
                  <div className="font-mono font-bold text-[#2F3E4E] mt-1">2B: {formatINR(inspectedRow.cgst2B)}</div>
                  <div className="font-mono text-[#475569]">Tally: {formatINR(inspectedRow.cgstTally)}</div>
                </div>
                <div className="p-3 rounded-xl bg-[#FEF2C8]/50 border border-[#2F3E4E]/20">
                  <div className="text-[10px] font-bold text-[#64748B] uppercase">SGST</div>
                  <div className="font-mono font-bold text-[#2F3E4E] mt-1">2B: {formatINR(inspectedRow.sgst2B)}</div>
                  <div className="font-mono text-[#475569]">Tally: {formatINR(inspectedRow.sgstTally)}</div>
                </div>
                <div className="p-3 rounded-xl bg-[#CEE5DC]/60 border border-[#2F3E4E]/30">
                  <div className="text-[10px] font-bold text-[#64748B] uppercase">Invoice Dates</div>
                  <div className="font-mono font-bold text-[#2F3E4E] mt-1">2B: {inspectedRow.date2B || '—'}</div>
                  <div className="font-mono text-[#475569]">Tally: {inspectedRow.dateTally || '—'}</div>
                </div>
              </div>
            </div>
          )}

          {/* Results Table */}
          <div className="overflow-x-auto rounded-xl border-[1.5px] border-[#2F3E4E] bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#2F3E4E] text-[#FFFDF5]">
                <tr>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold">GSTIN &amp; Supplier</th>
                  <th className="px-4 py-3 font-bold">2B Inv No &amp; Date</th>
                  <th className="px-4 py-3 font-bold">Tally Inv No &amp; Date</th>
                  <th className="px-4 py-3 font-bold text-right">Taxable (2B / Tally)</th>
                  <th className="px-4 py-3 font-bold text-right">Tax (2B)</th>
                  <th className="px-4 py-3 font-bold text-right">Tax (Tally)</th>
                  <th className="px-4 py-3 font-bold text-right">Diff (2B - Tally)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2F3E4E]/15">
                {visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-xs text-[#64748B]">
                      No invoices match the current filters. Clear search or switch status filter above.
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((row) => {
                    const badge = STATUS_BADGES[row.status];
                    const isSelected = selectedRowId === row.id;
                    return (
                      <tr
                        key={row.id}
                        onClick={() => setSelectedRowId(isSelected ? null : row.id)}
                        title="Click to inspect CGST / SGST / IGST breakdown"
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-[#F9C80E]/25' : 'hover:bg-[#FEF2C8]/45'
                        }`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-bold ${badge.cls}`}
                          >
                            {row.status === 'EXACT_MATCH' && <CheckCircle2 className="w-3 h-3" />}
                            {badge.label}
                          </span>
                          {row.taxHeadMismatch && (
                            <div className="text-[10px] font-bold text-rose-700 mt-1">
                              IGST vs CGST/SGST Swap
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-[#2F3E4E]">{row.partyName}</div>
                          <div className="font-mono text-[11px] text-[#64748B]">{row.gstin}</div>
                        </td>
                        <td className="px-4 py-3 font-mono">
                          <div className="font-semibold text-[#2F3E4E]">{row.invoiceNo2B || '—'}</div>
                          <div className="text-[10px] text-[#64748B]">{row.date2B || '—'}</div>
                        </td>
                        <td className="px-4 py-3 font-mono">
                          <div className="font-semibold text-[#2F3E4E]">{row.invoiceNoTally || '—'}</div>
                          <div className="text-[10px] text-[#64748B]">{row.dateTally || '—'}</div>
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums text-right text-[11px]">
                          <div className="font-semibold text-[#2F3E4E]">{formatINR(row.taxable2B)}</div>
                          <div className="text-[#64748B]">{formatINR(row.taxableTally)}</div>
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums text-right">
                          <div className="font-semibold">{formatINR(row.totalTax2B)}</div>
                          {(row.igst2B > 0 || row.cgst2B > 0) && (
                            <div className="text-[10px] text-[#64748B]">
                              {row.igst2B > 0 ? `I:${Math.round(row.igst2B)}` : `C+S:${Math.round(row.cgst2B + row.sgst2B)}`}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums text-right">
                          <div className="font-semibold">{formatINR(row.totalTaxTally)}</div>
                          {(row.igstTally > 0 || row.cgstTally > 0) && (
                            <div className="text-[10px] text-[#64748B]">
                              {row.igstTally > 0 ? `I:${Math.round(row.igstTally)}` : `C+S:${Math.round(row.cgstTally + row.sgstTally)}`}
                            </div>
                          )}
                        </td>
                        <td
                          className={`px-4 py-3 font-mono tabular-nums text-right font-bold ${
                            Math.abs(row.taxDiff) <= tolerance
                              ? 'text-emerald-800'
                              : row.taxDiff < 0
                              ? 'text-red-700'
                              : 'text-[#2F3E4E]'
                          }`}
                        >
                          {row.taxDiff >= 0 ? `+${formatINR(row.taxDiff)}` : formatINR(row.taxDiff)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
