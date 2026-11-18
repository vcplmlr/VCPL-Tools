import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Sparkles,
  Upload,
} from 'lucide-react';
import { ToolCatalogItem } from '../../types/tools';
import {
  GstInvoiceRecord,
  Gstr2bReconcileResult,
  ReconcileStatus,
  downloadGstr2bSampleTemplates,
  exportReconciliationExcel,
  getSampleGstr2bAndTallyData,
  parseGstWorkbookFile,
  reconcileGstr2bVsTally,
} from '../../utils/gstr2bEngine';
import { formatINR } from '../../utils/numberToWords';
import { FileDropZone } from './FileDropZone';

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
  const [errorMsg, setErrorMsg] = useState('');

  const result: Gstr2bReconcileResult | null = useMemo(() => {
    if (records2B.length === 0 && recordsTally.length === 0) return null;
    return reconcileGstr2bVsTally(records2B, recordsTally, tolerance);
  }, [records2B, recordsTally, tolerance]);

  const visibleRows = useMemo(() => {
    if (!result) return [];
    if (statusFilter === 'ALL') return result.rows;
    return result.rows.filter((r) => r.status === statusFilter);
  }, [result, statusFilter]);

  const processFile2B = async (file: File) => {
    setErrorMsg('');
    try {
      const parsed = await parseGstWorkbookFile(file, '2B');
      if (parsed.length === 0) {
        setErrorMsg(`No B2B invoice rows found in ${file.name}. Verify GSTIN/Invoice columns or use our clean Excel template.`);
      }
      setRecords2B(parsed);
      setFile2BName(`${file.name} (${parsed.length} rows)`);
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
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to parse Tally Purchase Register.');
    }
  };

  const handleUploadTally = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processFileTally(file);
    e.target.value = '';
  };

  const loadSample = () => {
    setErrorMsg('');
    const { sample2B, sampleTally } = getSampleGstr2bAndTallyData();
    setRecords2B(sample2B);
    setRecordsTally(sampleTally);
    setFile2BName(`sample-gstr2b.xlsx (${sample2B.length} rows)`);
    setFileTallyName(`sample-tally-purchase.xlsx (${sampleTally.length} rows)`);
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
            Download Clean Template (.xlsx)
          </button>
          <button
            type="button"
            onClick={loadSample}
            className="px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Load Sample GST Data
          </button>
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
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FFE1B3] text-xs font-semibold text-[#2F3E4E] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {result && (
        <div className="space-y-5">
          {/* KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-[#CEE5DC]/65 border-[1.5px] border-[#2F3E4E]">
              <p className="text-[11px] font-bold uppercase text-[#475569]">Eligible Matched ITC</p>
              <p className="font-mono tabular-nums font-extrabold text-lg text-[#2F3E4E] mt-1">
                {formatINR(result.summary.eligibleItc)}
              </p>
              <p className="text-xs text-[#475569]">{result.summary.exactCount} exact invoices</p>
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

          {/* Controls */}
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
            </div>

            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-[#2F3E4E] flex items-center gap-1.5">
                Rounding ±₹
                <select
                  value={tolerance}
                  onChange={(e) => setTolerance(Number(e.target.value))}
                  className="px-2 py-1 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white text-xs font-bold"
                >
                  <option value={1}>₹1</option>
                  <option value={2}>₹2</option>
                  <option value={5}>₹5</option>
                  <option value={10}>₹10</option>
                </select>
              </label>

              <button
                type="button"
                onClick={() => exportReconciliationExcel(result)}
                className="px-4 py-2 rounded-xl bg-[#2F3E4E] hover:bg-[#1E293B] text-[#FFFDF5] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Export 6-Sheet Audit (.xlsx)
              </button>
            </div>
          </div>

          {/* Results Table */}
          <div className="overflow-x-auto rounded-xl border-[1.5px] border-[#2F3E4E] bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#2F3E4E] text-[#FFFDF5]">
                <tr>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold">GSTIN &amp; Supplier</th>
                  <th className="px-4 py-3 font-bold">2B Inv No</th>
                  <th className="px-4 py-3 font-bold">Tally Inv No</th>
                  <th className="px-4 py-3 font-bold text-right">Tax (2B)</th>
                  <th className="px-4 py-3 font-bold text-right">Tax (Tally)</th>
                  <th className="px-4 py-3 font-bold text-right">Diff (2B - Tally)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2F3E4E]/15">
                {visibleRows.map((row) => {
                  const badge = STATUS_BADGES[row.status];
                  return (
                    <tr key={row.id} className="hover:bg-[#FEF2C8]/45">
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
                      <td className="px-4 py-3 font-mono font-semibold">{row.invoiceNo2B}</td>
                      <td className="px-4 py-3 font-mono font-semibold">{row.invoiceNoTally}</td>
                      <td className="px-4 py-3 font-mono tabular-nums text-right">
                        {formatINR(row.totalTax2B)}
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums text-right">
                        {formatINR(row.totalTaxTally)}
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
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
