import React, { useState } from 'react';
import ExcelJS from 'exceljs';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Sparkles,
  Upload,
} from 'lucide-react';
import { ToolCatalogItem } from '../../types/tools';
import { formatINR } from '../../utils/numberToWords';
import { extractTextFromPdf } from '../../utils/pdfExtractor';
import { FileDropZone } from './FileDropZone';

interface Form26ASToExcelViewProps {
  tool?: ToolCatalogItem;
  onBack?: () => void;
}

interface TdsDeductorRow {
  srNo: number;
  deductorName: string;
  tan: string;
  section: string;
  grossPaid: number;
  tdsDeducted: number;
  tdsDeposited: number;
}

interface Parsed26AS {
  pan: string;
  assessmentYear: string;
  financialYear: string;
  assesseeName: string;
  rows: TdsDeductorRow[];
  rawLineCount: number;
}

const SAMPLE_26AS: Parsed26AS = {
  pan: 'ABCDE1234F',
  assessmentYear: '2026-27',
  financialYear: '2025-26',
  assesseeName: 'RAJESH KUMAR SHARMA',
  rawLineCount: 48,
  rows: [
    {
      srNo: 1,
      deductorName: 'BHARAT TECH SOLUTIONS PVT LTD',
      tan: 'BLRB04821D',
      section: '192',
      grossPaid: 1450000,
      tdsDeducted: 162400,
      tdsDeposited: 162400,
    },
    {
      srNo: 2,
      deductorName: 'STATE BANK OF INDIA (TREASURY INTEREST)',
      tan: 'MUMS19204A',
      section: '194A',
      grossPaid: 68400,
      tdsDeducted: 6840,
      tdsDeposited: 6840,
    },
    {
      srNo: 3,
      deductorName: 'APEX ADVISORY & CONSULTING LLP',
      tan: 'DELA29011C',
      section: '194J',
      grossPaid: 120000,
      tdsDeducted: 12000,
      tdsDeposited: 12000,
    },
  ],
};

function parseForm26ASLines(lines: string[]): Parsed26AS {
  const joined = lines.join('\n');
  const panMatch = joined.match(/\b([A-Z]{5}[0-9]{4}[A-Z])\b/);
  const ayMatch = joined.match(/Assessment\s+Year\s*[:\-]?\s*(20\d{2}-\d{2})/i);
  const fyMatch = joined.match(/Financial\s+Year\s*[:\-]?\s*(20\d{2}-\d{2})/i);
  const nameMatch = joined.match(/Name\s+of\s+Assessee\s*[:\-]?\s*([A-Z\s.]{3,60})/i);

  const tanRegex = /\b([A-Z]{4}[0-9]{5}[A-Z])\b/;
  const rows: TdsDeductorRow[] = [];

  lines.forEach((line, idx) => {
    const tanMatch = line.match(tanRegex);
    if (!tanMatch) return;
    const tan = tanMatch[1];

    // Look for numeric amounts on this line or adjacent lines
    const windowText = [line, lines[idx + 1] || ''].join(' ');
    const numMatches = windowText.match(/\b\d[\d,]*\.\d{2}\b/g) || [];
    const nums = numMatches
      .map((s) => parseFloat(s.replace(/,/g, '')))
      .filter((n) => Number.isFinite(n));

    const secMatch = windowText.match(/\b(19[0-9][A-Z]{0,2}|206[A-Z]{1,2})\b/);
    const beforeTan = line.split(tan)[0].replace(/^\d+\s+/, '').trim();
    const deductorName =
      beforeTan.length >= 3 ? beforeTan : (lines[idx - 1] || 'DEDUCTOR').slice(0, 60);

    const grossPaid = nums[0] ?? 0;
    const tdsDeducted = nums[1] ?? nums[0] ?? 0;
    const tdsDeposited = nums[2] ?? tdsDeducted;

    rows.push({
      srNo: rows.length + 1,
      deductorName,
      tan,
      section: secMatch ? secMatch[1] : 'TDS',
      grossPaid,
      tdsDeducted,
      tdsDeposited,
    });
  });

  return {
    pan: panMatch ? panMatch[1] : 'NOT DETECTED',
    assessmentYear: ayMatch ? ayMatch[1] : '2026-27',
    financialYear: fyMatch ? fyMatch[1] : '2025-26',
    assesseeName: nameMatch ? nameMatch[1].trim() : 'TRACES TAXPAYER',
    rows,
    rawLineCount: lines.length,
  };
}

export const Form26ASToExcelView: React.FC<Form26ASToExcelViewProps> = ({ tool, onBack }) => {
  const [parsed, setParsed] = useState<Parsed26AS | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [isParsing, setIsParsing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const processPdfFile = async (file: File) => {
    setErrorMsg('');
    setFileName(file.name);
    setIsParsing(true);
    try {
      const buf = await file.arrayBuffer();
      const { allLines } = await extractTextFromPdf(buf);
      const data = parseForm26ASLines(allLines);
      if (data.rows.length === 0) {
        setErrorMsg(
          'No TAN/TDS deductor entries detected in this PDF. Make sure you upload an unencrypted TRACES Form 26AS PDF, or load the sample dataset below.'
        );
      }
      setParsed(data);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to read Form 26AS PDF file.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processPdfFile(file);
    e.target.value = '';
  };

  const isValidPan = (p: string) => /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(p.trim());
  const isValidTan = (t: string) => /^[A-Z]{4}[0-9]{5}[A-Z]$/.test(t.trim());

  const handleExportExcel = async () => {
    if (!parsed) return;
    const wb = new ExcelJS.Workbook();
    wb.creator = 'VCPL Tools';
    wb.calcProperties.fullCalcOnLoad = true;
    const INR_FMT = '₹#,##0.00';

    const styleHeader = (row: ExcelJS.Row, colCount: number) => {
      row.height = 24;
      for (let c = 1; c <= colCount; c++) {
        const cell = row.getCell(c);
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F3E4E' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
    };

    const summary = wb.addWorksheet('Taxpayer Summary', { views: [{ state: 'frozen', ySplit: 1 }] });
    summary.columns = [
      { header: 'Field', key: 'field', width: 32 },
      { header: 'Value', key: 'val', width: 38 },
      { header: 'Audit Note', key: 'note', width: 34 },
    ];
    styleHeader(summary.getRow(1), 3);

    const totalGross = parsed.rows.reduce((a, r) => a + r.grossPaid, 0);
    const totalDed = parsed.rows.reduce((a, r) => a + r.tdsDeducted, 0);
    const totalDep = parsed.rows.reduce((a, r) => a + r.tdsDeposited, 0);
    const partADataEnd = Math.max(2, parsed.rows.length + 1);

    const summaryEntries = [
      { field: 'Assessee Name', val: parsed.assesseeName, note: 'Extracted from Form 26AS header' },
      {
        field: 'PAN',
        val: parsed.pan,
        note: isValidPan(parsed.pan) ? 'Valid 10-char PAN format' : 'Verify PAN manually',
      },
      { field: 'Assessment Year', val: parsed.assessmentYear, note: '' },
      { field: 'Financial Year', val: parsed.financialYear, note: '' },
      {
        field: 'Deductors Found',
        val: { formula: `COUNTA('Part A - TDS Summary'!$C$2:$C$${partADataEnd})`, result: parsed.rows.length },
        note: '',
        fmt: '#,##0',
      },
      {
        field: 'Total Gross Paid / Credited (Rs)',
        val: { formula: `SUM('Part A - TDS Summary'!$E$2:$E$${partADataEnd})`, result: totalGross },
        note: '',
        fmt: INR_FMT,
      },
      {
        field: 'Total TDS Deducted (Rs)',
        val: { formula: `SUM('Part A - TDS Summary'!$F$2:$F$${partADataEnd})`, result: totalDed },
        note: '',
        fmt: INR_FMT,
      },
      {
        field: 'Total TDS Deposited (Rs)',
        val: { formula: `SUM('Part A - TDS Summary'!$G$2:$G$${partADataEnd})`, result: totalDep },
        note: Math.abs(totalDed - totalDep) > 1 ? 'Short deposit variance detected' : 'Matched 100%',
        fmt: INR_FMT,
      },
    ];
    summaryEntries.forEach((se) => {
      const r = summary.addRow([se.field, se.val, se.note]);
      r.getCell(1).font = { bold: true };
      if (se.fmt) {
        r.getCell(2).numFmt = se.fmt;
        r.getCell(2).alignment = { horizontal: 'right' };
      }
    });

    const partA = wb.addWorksheet('Part A - TDS Summary', { views: [{ state: 'frozen', ySplit: 1 }] });
    partA.columns = [
      { header: 'Sr No', key: 'srNo', width: 8 },
      { header: 'Name of Deductor', key: 'deductorName', width: 38 },
      { header: 'TAN', key: 'tan', width: 15, style: { numFmt: '@' } },
      { header: 'Section', key: 'section', width: 10 },
      { header: 'Amount Paid / Credited', key: 'grossPaid', width: 22 },
      { header: 'Tax Deducted', key: 'tdsDeducted', width: 18 },
      { header: 'TDS Deposited', key: 'tdsDeposited', width: 18 },
      { header: 'Short Deposit Diff', key: 'diff', width: 18 },
    ];
    styleHeader(partA.getRow(1), 8);

    parsed.rows.forEach((row) => {
      const rNum = partA.rowCount + 1;
      const added = partA.addRow([
        row.srNo,
        row.deductorName,
        row.tan,
        row.section,
        row.grossPaid,
        row.tdsDeducted,
        row.tdsDeposited,
        { formula: `ROUND(F${rNum}-G${rNum},2)`, result: Number((row.tdsDeducted - row.tdsDeposited).toFixed(2)) },
      ]);
      for (let c = 5; c <= 8; c++) {
        added.getCell(c).numFmt = INR_FMT;
        added.getCell(c).alignment = { horizontal: 'right' };
      }
    });

    if (parsed.rows.length > 0) {
      const lastR = parsed.rows.length + 1;
      const tot = partA.addRow([
        'TOTAL',
        `${parsed.rows.length} deductor(s)`,
        '',
        '',
        { formula: `SUM(E2:E${lastR})`, result: totalGross },
        { formula: `SUM(F2:F${lastR})`, result: totalDed },
        { formula: `SUM(G2:G${lastR})`, result: totalDep },
        { formula: `SUM(H2:H${lastR})`, result: Number((totalDed - totalDep).toFixed(2)) },
      ]);
      for (let c = 1; c <= 8; c++) {
        tot.getCell(c).font = { bold: true };
        tot.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2C8' } };
        if (c >= 5) tot.getCell(c).numFmt = INR_FMT;
      }
    }

    const auditSheet = wb.addWorksheet('TDS Short-Deposit Audit', { views: [{ state: 'frozen', ySplit: 1 }] });
    auditSheet.columns = [
      { header: 'TAN', key: 'tan', width: 15 },
      { header: 'Name of Deductor', key: 'deductorName', width: 38 },
      { header: 'Section', key: 'section', width: 10 },
      { header: 'TDS Deducted', key: 'tdsDeducted', width: 18 },
      { header: 'TDS Deposited', key: 'tdsDeposited', width: 18 },
      { header: 'Variance', key: 'variance', width: 16 },
      { header: 'Audit Status', key: 'status', width: 22 },
    ];
    styleHeader(auditSheet.getRow(1), 7);
    parsed.rows.forEach((row) => {
      const variance = Number((row.tdsDeducted - row.tdsDeposited).toFixed(2));
      const status = !isValidTan(row.tan)
        ? 'Check TAN Format'
        : Math.abs(variance) > 1
        ? 'Short Deposit Variance'
        : 'Matched';
      const added = auditSheet.addRow([
        row.tan,
        row.deductorName,
        row.section,
        row.tdsDeducted,
        row.tdsDeposited,
        variance,
        status,
      ]);
      for (let c = 4; c <= 6; c++) {
        added.getCell(c).numFmt = INR_FMT;
        added.getCell(c).alignment = { horizontal: 'right' };
      }
    });

    const out = await wb.xlsx.writeBuffer();
    const blob = new Blob([out], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `VCPL-Form26AS-${parsed.pan}-${parsed.assessmentYear}.xlsx`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const totalGross = parsed?.rows.reduce((a, r) => a + r.grossPaid, 0) ?? 0;
  const totalDeducted = parsed?.rows.reduce((a, r) => a + r.tdsDeducted, 0) ?? 0;
  const totalDeposited = parsed?.rows.reduce((a, r) => a + r.tdsDeposited, 0) ?? 0;
  const invalidTanCount = parsed?.rows.filter((r) => !isValidTan(r.tan)).length ?? 0;

  return (
    <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#2F3E4E]/15">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] flex items-center gap-1.5">
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#2F3E4E]" />
            {tool?.categoryName || 'Tax & GST'} · {tool?.code || 'TX-01'}
          </span>
          <h1 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] mt-1">
            {tool?.title || 'Form 26AS PDF to Excel Converter'}
          </h1>
          <p className="text-xs sm:text-sm text-[#475569] mt-0.5">
            {tool?.description ||
              'Extract TRACES Form 26AS TDS Part-A deductors, TAN numbers, and tax credits into clean multi-sheet Excel workbooks offline.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setErrorMsg('');
              setFileName('sample-form-26as-ay2026-27.pdf');
              setParsed(SAMPLE_26AS);
            }}
            className="px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Load Sample 26AS
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

      {/* Upload Dropzone */}
      <FileDropZone
        accept=".pdf,application/pdf"
        multiple={false}
        onFiles={(files) => {
          if (files[0]) void processPdfFile(files[0]);
        }}
        className="rounded-2xl border-2 border-dashed border-[#2F3E4E]/45 hover:border-[#2F3E4E] bg-[#FEF2C8]/45 transition"
      >
        <label className="block p-8 text-center cursor-pointer">
          <input type="file" accept=".pdf,application/pdf" onChange={handleFileUpload} className="hidden" />
          <Upload className="w-8 h-8 text-[#2F3E4E] mx-auto mb-2" />
          <p className="font-display font-bold text-sm sm:text-base text-[#2F3E4E]">
            {isParsing
              ? 'Extracting Form 26AS text locally...'
              : fileName
              ? `Loaded: ${fileName} (Drop another PDF to replace)`
              : 'Drag & Drop or Click to Upload TRACES Form 26AS PDF'}
          </p>
          <p className="text-xs text-[#475569] mt-1">
            100% browser-side PDF parsing — your PAN &amp; TDS statements never leave your device.
          </p>
        </label>
      </FileDropZone>

      {errorMsg && (
        <div className="p-4 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FFE1B3] text-xs font-semibold text-[#2F3E4E] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {parsed && (
        <div className="space-y-5">
          {/* Summary Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-[#FEF2C8]/75 border-[1.5px] border-[#2F3E4E]">
              <div className="flex items-center justify-between gap-1">
                <p className="text-[11px] font-bold uppercase text-[#64748B]">PAN &amp; AY</p>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    isValidPan(parsed.pan)
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {isValidPan(parsed.pan) ? 'PAN Valid' : 'Check PAN'}
                </span>
              </div>
              <p className="font-mono font-extrabold text-base text-[#2F3E4E] mt-1">{parsed.pan}</p>
              <p className="text-xs text-[#475569]">AY {parsed.assessmentYear}</p>
            </div>
            <div className="p-4 rounded-xl bg-white border-[1.5px] border-[#2F3E4E]">
              <p className="text-[11px] font-bold uppercase text-[#64748B]">Total Gross Paid</p>
              <p className="font-mono tabular-nums font-extrabold text-lg text-[#2F3E4E] mt-1">
                {formatINR(totalGross)}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-[#CEE5DC]/60 border-[1.5px] border-[#2F3E4E]">
              <p className="text-[11px] font-bold uppercase text-[#64748B]">TDS Deducted</p>
              <p className="font-mono tabular-nums font-extrabold text-lg text-[#2F3E4E] mt-1">
                {formatINR(totalDeducted)}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-[#F9C80E]/35 border-[1.5px] border-[#2F3E4E]">
              <p className="text-[11px] font-bold uppercase text-[#64748B]">TDS Deposited</p>
              <p className="font-mono tabular-nums font-extrabold text-lg text-[#2F3E4E] mt-1">
                {formatINR(totalDeposited)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-800 bg-[#CEE5DC] px-3 py-1.5 rounded-lg border border-[#2F3E4E]">
              <CheckCircle2 className="w-4 h-4" />
              <span>
                Assessee: {parsed.assesseeName} · {parsed.rows.length} Deductor(s) extracted
                {invalidTanCount > 0 ? ` · ${invalidTanCount} TAN check` : ''}
              </span>
            </div>

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={parsed.rows.length === 0}
              className="px-5 py-2.5 rounded-xl bg-[#2F3E4E] hover:bg-[#1E293B] text-[#FFFDF5] text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Download Multi-Sheet Excel (.xlsx)
            </button>
          </div>

          {/* Deductor Table */}
          {parsed.rows.length > 0 && (
            <div className="overflow-x-auto rounded-xl border-[1.5px] border-[#2F3E4E] bg-white">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#2F3E4E] text-[#FFFDF5]">
                  <tr>
                    <th className="px-4 py-3 font-bold">#</th>
                    <th className="px-4 py-3 font-bold">Deductor Name</th>
                    <th className="px-4 py-3 font-bold">TAN</th>
                    <th className="px-4 py-3 font-bold">Sec</th>
                    <th className="px-4 py-3 font-bold text-right">Amount Paid</th>
                    <th className="px-4 py-3 font-bold text-right">TDS Deducted</th>
                    <th className="px-4 py-3 font-bold text-right">TDS Deposited</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2F3E4E]/15">
                  {parsed.rows.map((row) => (
                    <tr key={row.srNo} className="hover:bg-[#FEF2C8]/45">
                      <td className="px-4 py-3 font-mono font-bold">{row.srNo}</td>
                      <td className="px-4 py-3 font-semibold text-[#2F3E4E]">{row.deductorName}</td>
                      <td className="px-4 py-3 font-mono font-bold text-[#2F3E4E]">{row.tan}</td>
                      <td className="px-4 py-3 font-mono">{row.section}</td>
                      <td className="px-4 py-3 font-mono tabular-nums text-right">
                        {formatINR(row.grossPaid)}
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums text-right font-semibold">
                        {formatINR(row.tdsDeducted)}
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums text-right font-bold text-emerald-800">
                        {formatINR(row.tdsDeposited)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="p-3.5 rounded-xl bg-[#FEF2C8]/65 border border-[#2F3E4E]/25 text-xs text-[#475569] flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#2F3E4E] shrink-0" />
            <span>
              Extracted {parsed.rawLineCount} text lines locally. Always cross-verify final tax credits against AIS &amp; Form 26AS before ITR filing.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
