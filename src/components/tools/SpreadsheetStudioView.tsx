import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import Tesseract from 'tesseract.js';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle,
  Copy,
  Download,
  FileSpreadsheet,
  Loader2,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import { ToolCatalogItem } from '../../types/tools';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface SpreadsheetStudioViewProps {
  tool: ToolCatalogItem;
}

function flattenJsonRow(obj: unknown, prefix = '', out: Record<string, unknown> = {}): Record<string, unknown> {
  if (obj === null || obj === undefined) {
    if (prefix) out[prefix] = '';
    return out;
  }
  if (typeof obj !== 'object') {
    if (prefix) out[prefix] = obj;
    return out;
  }
  if (Array.isArray(obj)) {
    out[prefix || 'items'] = obj
      .map((x) => (typeof x === 'object' ? JSON.stringify(x) : String(x)))
      .join(', ');
    return out;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      flattenJsonRow(v, key, out);
    } else if (Array.isArray(v)) {
      out[key] = v.map((x) => (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(', ');
    } else {
      out[key] = v ?? '';
    }
  }
  return out;
}

function escapeSqlVal(v: unknown): string {
  if (v === null || v === undefined || v === '') return 'NULL';
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

export const SpreadsheetStudioView: React.FC<SpreadsheetStudioViewProps> = ({ tool }) => {
  const [wb, setWb] = useState<XLSX.WorkBook | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [fileSizeKb, setFileSizeKb] = useState<number>(0);
  const [activeSheet, setActiveSheet] = useState<string>('');
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // Viewer / Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Multi-file merge state
  const [mergeFiles, setMergeFiles] = useState<{ name: string; wb: XLSX.WorkBook }[]>([]);
  const [mergeMode, setMergeMode] = useState<'sheets' | 'stack'>('sheets');

  // Compare state
  const [compareWbB, setCompareWbB] = useState<XLSX.WorkBook | null>(null);
  const [compareNameB, setCompareNameB] = useState<string>('');

  // Text input tools (csv-to-excel, json-to-excel)
  const [rawTextInput, setRawTextInput] = useState<string>(
    tool.id === 'json-to-excel'
      ? JSON.stringify(
          [
            { invoice: 'INV-101', party: { name: 'Kaveri Traders', gstin: '29AABCK1234F1Z2' }, amount: 42500 },
            { invoice: 'INV-102', party: { name: 'Coastal Auto', gstin: '27AACFC5678L1Z9' }, amount: 18900 },
          ],
          null,
          2
        )
      : 'Date,Party Name,GSTIN,Taxable Value,GST Amount\n2026-10-01,Kaveri Traders,29AABCK1234F1Z2,40000,7200\n2026-10-05,Coastal Auto,27AACFC5678L1Z9,16000,2880'
  );

  // Clean options
  const [cleanTrim, setCleanTrim] = useState(true);
  const [cleanEmptyRows, setCleanEmptyRows] = useState(true);
  const [cleanEmptyCols, setCleanEmptyCols] = useState(true);
  const [cleanDuplicates, setCleanDuplicates] = useState(true);

  // JSON format option
  const [jsonMode, setJsonMode] = useState<'objects' | 'matrix'>('objects');

  // Delimiter options
  const [csvDelimiter, setCsvDelimiter] = useState<',' | ';' | '\t' | '|'>(';');
  const [includeBom, setIncludeBom] = useState(true);

  // Column extractor options
  const [selectedCols, setSelectedCols] = useState<{ name: string; rename: string; enabled: boolean }[]>([]);

  // Output format for Markdown / SQL / HTML
  const [codeFormat, setCodeFormat] = useState<'markdown' | 'html' | 'sql'>('markdown');
  const [sqlTableName, setSqlTableName] = useState('records');

  // PDF & Image OCR extracted matrix
  const [extractedRows, setExtractedRows] = useState<string[][]>([]);

  useEffect(() => {
    setWb(null);
    setFileName('');
    setFileSizeKb(0);
    setActiveSheet('');
    setStatus(null);
    setSearchQuery('');
    setMergeFiles([]);
    setCompareWbB(null);
    setCompareNameB('');
    setSelectedCols([]);
    setExtractedRows([]);
    if (tool.id === 'json-to-excel') {
      setRawTextInput(
        JSON.stringify(
          [
            { invoice: 'INV-101', party: { name: 'Kaveri Traders', gstin: '29AABCK1234F1Z2' }, amount: 42500 },
            { invoice: 'INV-102', party: { name: 'Coastal Auto', gstin: '27AACFC5678L1Z9' }, amount: 18900 },
          ],
          null,
          2
        )
      );
    } else if (tool.id === 'csv-to-excel') {
      setRawTextInput(
        'Date,Party Name,GSTIN,Taxable Value,GST Amount\n2026-10-01,Kaveri Traders,29AABCK1234F1Z2,40000,7200\n2026-10-05,Coastal Auto,27AACFC5678L1Z9,16000,2880'
      );
    }
  }, [tool.id]);

  const sheetMatrix = useMemo<string[][]>(() => {
    if (!wb || !activeSheet || !wb.Sheets[activeSheet]) return [];
    const raw = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[activeSheet], { header: 1, defval: '' });
    return raw.map((r) => r.map((cell) => String(cell ?? '')));
  }, [wb, activeSheet]);

  const headers = useMemo(() => sheetMatrix[0] || [], [sheetMatrix]);
  const bodyRows = useMemo(() => sheetMatrix.slice(1), [sheetMatrix]);

  useEffect(() => {
    if (headers.length > 0) {
      setSelectedCols(headers.map((h, idx) => ({ name: h || `Col_${idx + 1}`, rename: h || `Col_${idx + 1}`, enabled: true })));
    }
  }, [headers]);

  const loadWorkbookFile = async (file: File) => {
    setStatus(null);
    try {
      const buf = await file.arrayBuffer();
      const parsed = XLSX.read(buf, { type: 'array' });
      if (!parsed.SheetNames.length) throw new Error('No worksheets detected.');
      setWb(parsed);
      setFileName(file.name);
      setFileSizeKb(Math.max(1, Math.round(file.size / 1024)));
      setActiveSheet(parsed.SheetNames[0]);
      setStatus({ type: 'success', text: `Loaded "${file.name}" (${parsed.SheetNames.length} sheet(s)).` });
    } catch (err) {
      setStatus({ type: 'error', text: err instanceof Error ? err.message : 'Unable to parse spreadsheet.' });
    }
  };

  const copyOut = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore clipboard errors
    }
  };

  const downloadBlob = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // -------------------------------------------------------------------------
  // PDF TABLE EXTRACTOR & IMAGE OCR TO EXCEL
  // -------------------------------------------------------------------------
  const handlePdfTableUpload = async (file: File) => {
    setBusy(true);
    setStatus(null);
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      const allRows: string[][] = [];
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const vp = page.getViewport({ scale: 1 });
        const tc = await page.getTextContent();
        const tokens: { str: string; x: number; y: number }[] = [];
        for (const item of tc.items as any[]) {
          if (!item?.str?.trim()) continue;
          const tx = item.transform || [1, 0, 0, 1, 0, 0];
          tokens.push({ str: item.str.trim(), x: tx[4] ?? 0, y: vp.height - (tx[5] ?? 0) });
        }
        tokens.sort((a, b) => a.y - b.y || a.x - b.x);
        const lines: { str: string; x: number; y: number }[][] = [];
        for (const tok of tokens) {
          const prev = lines[lines.length - 1];
          if (prev && Math.abs(prev[0].y - tok.y) <= 6) prev.push(tok);
          else lines.push([tok]);
        }
        for (const line of lines) {
          line.sort((a, b) => a.x - b.x);
          const cells: string[] = [];
          let cur = '';
          let prevX = -999;
          for (const t of line) {
            if (prevX !== -999 && t.x - prevX > 18) {
              if (cur.trim()) cells.push(cur.trim());
              cur = t.str;
            } else {
              cur = cur ? `${cur} ${t.str}` : t.str;
            }
            prevX = t.x + t.str.length * 4.2;
          }
          if (cur.trim()) cells.push(cur.trim());
          if (cells.length > 0) allRows.push(cells);
        }
      }
      setExtractedRows(allRows);
      setStatus({ type: 'success', text: `Extracted ${allRows.length} table row(s) from ${pdf.numPages} page(s).` });
    } catch (err) {
      setStatus({ type: 'error', text: err instanceof Error ? err.message : 'PDF extraction failed.' });
    } finally {
      setBusy(false);
    }
  };

  const handleImageTableOcr = async (file: File) => {
    setBusy(true);
    setStatus({ type: 'info', text: 'Running browser Tesseract OCR table detection...' });
    setFileName(file.name);
    try {
      const result = await Tesseract.recognize(file, 'eng');
      const dataAny = result.data as any;
      const words: Array<{ text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }> =
        dataAny?.words || [];
      let rows: string[][] = [];
      if (words.length > 0) {
        words.sort((a, b) => a.bbox.y0 - b.bbox.y0 || a.bbox.x0 - b.bbox.x0);
        const lineGroups: typeof words[] = [];
        for (const w of words) {
          const prev = lineGroups[lineGroups.length - 1];
          if (prev && Math.abs(prev[0].bbox.y0 - w.bbox.y0) <= 14) prev.push(w);
          else lineGroups.push([w]);
        }
        rows = lineGroups.map((grp) => {
          grp.sort((a, b) => a.bbox.x0 - b.bbox.x0);
          const cols: string[] = [];
          let buf = '';
          let prevEnd = -999;
          for (const w of grp) {
            if (prevEnd !== -999 && w.bbox.x0 - prevEnd > 24) {
              if (buf.trim()) cols.push(buf.trim());
              buf = w.text;
            } else {
              buf = buf ? `${buf} ${w.text}` : w.text;
            }
            prevEnd = w.bbox.x1;
          }
          if (buf.trim()) cols.push(buf.trim());
          return cols;
        });
      } else {
        rows = result.data.text
          .split(/\r?\n/)
          .filter((l) => l.trim())
          .map((l) => l.split(/\s{2,}|\t|\|/).map((c) => c.trim()));
      }
      setExtractedRows(rows);
      setStatus({ type: 'success', text: `OCR detected ${rows.length} row(s). Export ready.` });
    } catch (err) {
      setStatus({ type: 'error', text: err instanceof Error ? err.message : 'OCR table extraction failed.' });
    } finally {
      setBusy(false);
    }
  };

  if (tool.id === 'pdf-table-extractor' || tool.id === 'image-to-excel-table') {
    const isPdf = tool.id === 'pdf-table-extractor';
    return (
      <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#2F3E4E]/15">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] flex items-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#2F3E4E]" />
              {tool.categoryName} · {tool.code}
            </span>
            <h1 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] mt-1">{tool.title}</h1>
            <p className="text-xs sm:text-sm text-[#475569] mt-0.5">{tool.description}</p>
          </div>
          {extractedRows.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const outWb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(outWb, XLSX.utils.aoa_to_sheet(extractedRows), 'Extracted_Table');
                XLSX.writeFile(outWb, `${fileName.replace(/\.[^.]+$/, '') || 'table'}_extracted.xlsx`);
              }}
              className="px-4 py-2.5 rounded-xl bg-[#2F3E4E] hover:bg-[#1E293B] text-[#FFFDF5] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Download className="w-3.5 h-3.5" /> Download .XLSX
            </button>
          )}
        </div>

        <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-[#2F3E4E]/45 rounded-2xl bg-[#FEF2C8]/40 hover:bg-[#FEF2C8]/75 transition cursor-pointer text-center">
          {busy ? <Loader2 className="w-7 h-7 animate-spin text-[#2F3E4E] mb-2" /> : <UploadCloud className="w-7 h-7 text-[#2F3E4E] mb-2" />}
          <span className="text-sm font-bold text-[#2F3E4E]">
            {fileName ? `Loaded: ${fileName}` : isPdf ? 'Upload PDF with Tables (.PDF)' : 'Upload Table Screenshot or Scanned Image (PNG/JPG)'}
          </span>
          <input
            type="file"
            accept={isPdf ? '.pdf,application/pdf' : 'image/*'}
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                if (isPdf) void handlePdfTableUpload(f);
                else void handleImageTableOcr(f);
              }
            }}
          />
        </label>

        {status && (
          <div className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${status.type === 'error' ? 'bg-rose-50 border-rose-300 text-rose-800' : 'bg-[#CEE5DC]/60 border-[#2F3E4E]/30 text-[#2F3E4E]'}`}>
            {status.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4 text-emerald-700" />}
            <span>{status.text}</span>
          </div>
        )}

        {extractedRows.length > 0 && (
          <div className="rounded-xl border-[1.5px] border-[#2F3E4E] overflow-x-auto max-h-[420px] bg-white">
            <table className="w-full text-left text-xs">
              <tbody className="divide-y divide-[#2F3E4E]/15">
                {extractedRows.slice(0, 120).map((row, rIdx) => (
                  <tr key={rIdx} className={rIdx === 0 ? 'bg-[#FEF2C8] font-bold' : 'hover:bg-[#FEF2C8]/30'}>
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="py-2 px-3 border-r border-[#2F3E4E]/10 whitespace-nowrap">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // TEXT-BASED CONVERTERS: JSON TO EXCEL & CSV TO EXCEL
  // -------------------------------------------------------------------------
  if (tool.id === 'json-to-excel' || tool.id === 'csv-to-excel') {
    const isJson = tool.id === 'json-to-excel';

    const convertTextToSheet = () => {
      try {
        if (isJson) {
          const parsed = JSON.parse(rawTextInput);
          const arr = Array.isArray(parsed) ? parsed : [parsed];
          const flat = arr.map((item) => flattenJsonRow(item));
          const ws = XLSX.utils.json_to_sheet(flat);
          const outWb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(outWb, ws, 'JSON_Data');
          XLSX.writeFile(outWb, 'JSON_Export.xlsx');
          setStatus({ type: 'success', text: `Converted ${flat.length} JSON record(s) into Excel .XLSX!` });
        } else {
          const parsedWb = XLSX.read(rawTextInput, { type: 'string' });
          XLSX.writeFile(parsedWb, 'CSV_Export.xlsx');
          setStatus({ type: 'success', text: 'Converted CSV text into Excel .XLSX!' });
        }
      } catch (err) {
        setStatus({ type: 'error', text: err instanceof Error ? err.message : 'Conversion failed.' });
      }
    };

    return (
      <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="pb-5 border-b border-[#2F3E4E]/15">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] flex items-center gap-1.5">
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#2F3E4E]" />
            {tool.categoryName} · {tool.code}
          </span>
          <h1 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] mt-1">{tool.title}</h1>
          <p className="text-xs sm:text-sm text-[#475569] mt-0.5">{tool.description}</p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="px-4 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] cursor-pointer inline-flex items-center gap-1.5">
            <UploadCloud className="w-4 h-4" />
            <span>Upload {isJson ? '.JSON' : '.CSV'} File</span>
            <input
              type="file"
              accept={isJson ? '.json,application/json' : '.csv,.txt,text/csv'}
              className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setRawTextInput(await f.text());
                  setStatus({ type: 'info', text: `Loaded "${f.name}" into editor.` });
                }
              }}
            />
          </label>

          <button
            type="button"
            onClick={convertTextToSheet}
            className="px-5 py-2.5 rounded-xl bg-[#2F3E4E] hover:bg-[#1E293B] text-[#FFFDF5] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Convert &amp; Download .XLSX
          </button>
        </div>

        <textarea
          rows={12}
          value={rawTextInput}
          onChange={(e) => setRawTextInput(e.target.value)}
          className="w-full p-4 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white font-mono text-xs leading-relaxed"
        />

        {status && (
          <div className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${status.type === 'error' ? 'bg-rose-50 border-rose-300 text-rose-800' : 'bg-[#CEE5DC]/60 border-[#2F3E4E]/30 text-[#2F3E4E]'}`}>
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{status.text}</span>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // MERGE MULTIPLE SPREADSHEETS
  // -------------------------------------------------------------------------
  if (tool.id === 'merge-spreadsheets') {
    const handleMergeUpload = async (fileList: FileList) => {
      const added: { name: string; wb: XLSX.WorkBook }[] = [];
      for (const f of Array.from(fileList)) {
        const buf = await f.arrayBuffer();
        added.push({ name: f.name, wb: XLSX.read(buf, { type: 'array' }) });
      }
      setMergeFiles((prev) => [...prev, ...added]);
    };

    const runMerge = () => {
      if (mergeFiles.length === 0) return;
      const outWb = XLSX.utils.book_new();
      if (mergeMode === 'sheets') {
        mergeFiles.forEach((item, idx) => {
          item.wb.SheetNames.forEach((sName) => {
            const safeName = `${item.name.replace(/\.[^.]+$/, '').slice(0, 14)}_${sName}`.slice(0, 30) || `Sheet_${idx + 1}`;
            XLSX.utils.book_append_sheet(outWb, item.wb.Sheets[sName], safeName);
          });
        });
      } else {
        const combined: Record<string, unknown>[] = [];
        mergeFiles.forEach((item) => {
          const first = item.wb.SheetNames[0];
          if (first) {
            const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(item.wb.Sheets[first], { defval: '' });
            rows.forEach((r) => combined.push({ _Source_File: item.name, ...r }));
          }
        });
        XLSX.utils.book_append_sheet(outWb, XLSX.utils.json_to_sheet(combined), 'Merged_Master');
      }
      XLSX.writeFile(outWb, 'VCPL_Merged_Workbook.xlsx');
      setStatus({ type: 'success', text: `Merged ${mergeFiles.length} file(s) into VCPL_Merged_Workbook.xlsx!` });
    };

    return (
      <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="pb-5 border-b border-[#2F3E4E]/15">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] flex items-center gap-1.5">
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#2F3E4E]" />
            {tool.categoryName} · {tool.code}
          </span>
          <h1 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] mt-1">{tool.title}</h1>
          <p className="text-xs sm:text-sm text-[#475569] mt-0.5">{tool.description}</p>
        </div>

        <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-[#2F3E4E]/45 rounded-2xl bg-[#FEF2C8]/40 hover:bg-[#FEF2C8]/75 cursor-pointer text-center">
          <UploadCloud className="w-7 h-7 text-[#2F3E4E] mb-2" />
          <span className="text-sm font-bold text-[#2F3E4E]">Select Multiple Excel / CSV Files</span>
          <input
            type="file"
            multiple
            accept=".xlsx,.xls,.csv"
            className="sr-only"
            onChange={(e) => {
              if (e.target.files?.length) void handleMergeUpload(e.target.files);
            }}
          />
        </label>

        {mergeFiles.length > 0 && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setMergeMode('sheets')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold border-[1.5px] border-[#2F3E4E] cursor-pointer ${mergeMode === 'sheets' ? 'bg-[#F9C80E] text-[#2F3E4E]' : 'bg-white'}`}
              >
                Combine as Separate Tabs
              </button>
              <button
                type="button"
                onClick={() => setMergeMode('stack')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold border-[1.5px] border-[#2F3E4E] cursor-pointer ${mergeMode === 'stack' ? 'bg-[#F9C80E] text-[#2F3E4E]' : 'bg-white'}`}
              >
                Append Rows Into 1 Master Sheet
              </button>
              <button
                type="button"
                onClick={() => setMergeFiles([])}
                className="ml-auto px-3 py-2 rounded-xl border border-[#2F3E4E]/30 bg-white text-xs font-bold text-rose-700 cursor-pointer"
              >
                Clear List
              </button>
            </div>

            <div className="rounded-xl border-[1.5px] border-[#2F3E4E] bg-white divide-y divide-[#2F3E4E]/10 text-xs">
              {mergeFiles.map((m, idx) => (
                <div key={idx} className="px-4 py-2.5 flex items-center justify-between">
                  <span className="font-bold text-[#2F3E4E]">{m.name}</span>
                  <span className="font-mono text-[#64748B]">{m.wb.SheetNames.length} sheet(s)</span>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={runMerge}
              className="px-5 py-2.5 rounded-xl bg-[#2F3E4E] hover:bg-[#1E293B] text-[#FFFDF5] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4" /> Merge &amp; Download .XLSX
            </button>
          </div>
        )}

        {status && (
          <div className="p-3 rounded-xl bg-[#CEE5DC]/60 border border-[#2F3E4E]/30 text-xs font-semibold text-[#2F3E4E]">
            {status.text}
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // SINGLE SPREADSHEET WORKBENCH TOOLS (Viewer, CSV, JSON, Clean, Split, Compare, Compress, Delimiter, Columns, Markdown/SQL)
  // -------------------------------------------------------------------------
  const filteredBody = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return bodyRows;
    return bodyRows.filter((row) => row.some((cell) => cell.toLowerCase().includes(q)));
  }, [bodyRows, searchQuery]);

  const compareDiffs = useMemo(() => {
    if (!wb || !compareWbB || !activeSheet) return [];
    const sheetA = wb.Sheets[activeSheet];
    const sheetB = compareWbB.Sheets[compareWbB.SheetNames[0]];
    if (!sheetA || !sheetB) return [];
    const mA = XLSX.utils.sheet_to_json<unknown[]>(sheetA, { header: 1, defval: '' });
    const mB = XLSX.utils.sheet_to_json<unknown[]>(sheetB, { header: 1, defval: '' });
    const maxR = Math.max(mA.length, mB.length);
    const diffs: { row: number; col: number; valA: string; valB: string }[] = [];
    for (let r = 0; r < maxR; r++) {
      const rA = mA[r] || [];
      const rB = mB[r] || [];
      const maxC = Math.max(rA.length, rB.length);
      for (let c = 0; c < maxC; c++) {
        const a = String(rA[c] ?? '').trim();
        const b = String(rB[c] ?? '').trim();
        if (a !== b) diffs.push({ row: r + 1, col: c + 1, valA: a, valB: b });
      }
    }
    return diffs;
  }, [wb, compareWbB, activeSheet]);

  const generatedTextOutput = useMemo(() => {
    if (!wb || !activeSheet) return '';
    if (tool.id === 'excel-to-csv') {
      return XLSX.utils.sheet_to_csv(wb.Sheets[activeSheet]);
    }
    if (tool.id === 'csv-delimiter-utf8') {
      return XLSX.utils.sheet_to_csv(wb.Sheets[activeSheet], { FS: csvDelimiter });
    }
    if (tool.id === 'excel-to-json') {
      const data =
        jsonMode === 'objects'
          ? XLSX.utils.sheet_to_json(wb.Sheets[activeSheet], { defval: '' })
          : sheetMatrix;
      return JSON.stringify(data, null, 2);
    }
    if (tool.id === 'excel-to-markdown-sql') {
      if (sheetMatrix.length === 0) return '';
      const hdr = headers.map((h, i) => h || `col_${i + 1}`);
      if (codeFormat === 'markdown') {
        const top = `| ${hdr.join(' | ')} |`;
        const sep = `| ${hdr.map(() => '---').join(' | ')} |`;
        const lines = bodyRows.slice(0, 500).map((r) => `| ${hdr.map((_, i) => (r[i] ?? '').replace(/\|/g, '\\|')).join(' | ')} |`);
        return [top, sep, ...lines].join('\n');
      }
      if (codeFormat === 'html') {
        const ths = hdr.map((h) => `<th>${h}</th>`).join('');
        const trs = bodyRows
          .slice(0, 500)
          .map((r) => `    <tr>${hdr.map((_, i) => `<td>${r[i] ?? ''}</td>`).join('')}</tr>`)
          .join('\n');
        return `<table>\n  <thead>\n    <tr>${ths}</tr>\n  </thead>\n  <tbody>\n${trs}\n  </tbody>\n</table>`;
      }
      const colsSql = hdr.map((h) => `"${h.replace(/"/g, '')}"`).join(', ');
      return bodyRows
        .slice(0, 500)
        .map((r) => `INSERT INTO "${sqlTableName || 'records'}" (${colsSql}) VALUES (${hdr.map((_, i) => escapeSqlVal(r[i])).join(', ')});`)
        .join('\n');
    }
    return '';
  }, [wb, activeSheet, tool.id, csvDelimiter, jsonMode, sheetMatrix, headers, bodyRows, codeFormat, sqlTableName]);

  const handleActionDownload = async () => {
    if (!wb || !activeSheet) return;
    const base = fileName.replace(/\.[^.]+$/, '') || 'spreadsheet';

    if (tool.id === 'excel-to-csv') {
      downloadBlob(new Blob(['\uFEFF' + generatedTextOutput], { type: 'text/csv;charset=utf-8' }), `${base}_${activeSheet}.csv`);
      return;
    }
    if (tool.id === 'csv-delimiter-utf8') {
      const payload = (includeBom ? '\uFEFF' : '') + generatedTextOutput;
      downloadBlob(new Blob([payload], { type: 'text/csv;charset=utf-8' }), `${base}_formatted.csv`);
      return;
    }
    if (tool.id === 'excel-to-json') {
      downloadBlob(new Blob([generatedTextOutput], { type: 'application/json' }), `${base}_${activeSheet}.json`);
      return;
    }
    if (tool.id === 'excel-to-markdown-sql') {
      const ext = codeFormat === 'sql' ? 'sql' : codeFormat === 'html' ? 'html' : 'md';
      downloadBlob(new Blob([generatedTextOutput], { type: 'text/plain;charset=utf-8' }), `${base}.${ext}`);
      return;
    }
    if (tool.id === 'clean-spreadsheet') {
      let rows = sheetMatrix.map((r) => r.map((c) => (cleanTrim ? c.trim() : c)));
      if (cleanEmptyRows) rows = rows.filter((r) => r.some((c) => c !== ''));
      if (cleanEmptyCols && rows.length > 0) {
        const keepCols: number[] = [];
        for (let c = 0; c < rows[0].length; c++) {
          if (rows.some((r) => (r[c] ?? '') !== '')) keepCols.push(c);
        }
        rows = rows.map((r) => keepCols.map((c) => r[c] ?? ''));
      }
      if (cleanDuplicates && rows.length > 1) {
        const seen = new Set<string>();
        const deduped = [rows[0]];
        for (let i = 1; i < rows.length; i++) {
          const key = JSON.stringify(rows[i]);
          if (!seen.has(key)) {
            seen.add(key);
            deduped.push(rows[i]);
          }
        }
        rows = deduped;
      }
      const outWb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(outWb, XLSX.utils.aoa_to_sheet(rows), activeSheet);
      XLSX.writeFile(outWb, `${base}_cleaned.xlsx`);
      setStatus({ type: 'success', text: `Cleaned! Kept ${rows.length} row(s) (removed ${Math.max(0, sheetMatrix.length - rows.length)} blank/duplicate row(s)).` });
      return;
    }
    if (tool.id === 'split-excel-sheets') {
      setBusy(true);
      try {
        const zip = new JSZip();
        wb.SheetNames.forEach((s) => {
          const single = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(single, wb.Sheets[s], s);
          const bytes = XLSX.write(single, { type: 'array', bookType: 'xlsx' });
          zip.file(`${s.replace(/[^a-zA-Z0-9._-]+/g, '_')}.xlsx`, bytes);
        });
        const zBlob = await zip.generateAsync({ type: 'blob' });
        downloadBlob(zBlob, `${base}_sheets.zip`);
        setStatus({ type: 'success', text: `Split ${wb.SheetNames.length} worksheets into ZIP!` });
      } finally {
        setBusy(false);
      }
      return;
    }
    if (tool.id === 'compress-excel') {
      const compactWb = XLSX.utils.book_new();
      wb.SheetNames.forEach((s) => {
        const cleanData = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[s], { header: 1, defval: '' });
        XLSX.utils.book_append_sheet(compactWb, XLSX.utils.aoa_to_sheet(cleanData), s);
      });
      const bytes = XLSX.write(compactWb, { type: 'array', bookType: 'xlsx', compression: true });
      const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const newKb = Math.max(1, Math.round(blob.size / 1024));
      downloadBlob(blob, `${base}_compressed.xlsx`);
      setStatus({ type: 'success', text: `Compressed from ${fileSizeKb} KB -> ${newKb} KB!` });
      return;
    }
    if (tool.id === 'column-extractor') {
      const enabled = selectedCols
        .map((c, idx) => ({ ...c, origIdx: headers.indexOf(c.name) >= 0 ? headers.indexOf(c.name) : idx }))
        .filter((c) => c.enabled);
      if (enabled.length === 0) return;
      const outMatrix = [
        enabled.map((c) => c.rename || c.name),
        ...bodyRows.map((row) => enabled.map((c) => row[c.origIdx] ?? '')),
      ];
      const outWb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(outWb, XLSX.utils.aoa_to_sheet(outMatrix), 'Selected_Columns');
      XLSX.writeFile(outWb, `${base}_columns.xlsx`);
      setStatus({ type: 'success', text: `Exported ${enabled.length} selected & reordered column(s)!` });
      return;
    }
    if (tool.id === 'compare-spreadsheets' && compareDiffs.length > 0) {
      const outWb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        outWb,
        XLSX.utils.json_to_sheet(
          compareDiffs.map((d) => ({ Row: d.row, Column: d.col, 'Workbook A': d.valA, 'Workbook B': d.valB }))
        ),
        'Cell_Differences'
      );
      XLSX.writeFile(outWb, `${base}_diff_report.xlsx`);
    }
  };

  return (
    <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#2F3E4E]/15">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] flex items-center gap-1.5">
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#2F3E4E]" />
            {tool.categoryName} · {tool.code}
          </span>
          <h1 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] mt-1">{tool.title}</h1>
          <p className="text-xs sm:text-sm text-[#475569] mt-0.5">{tool.description}</p>
        </div>

        {wb && tool.id !== 'excel-csv-viewer' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleActionDownload()}
            className="px-4 py-2.5 rounded-xl bg-[#2F3E4E] hover:bg-[#1E293B] text-[#FFFDF5] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            {tool.id === 'split-excel-sheets'
              ? 'Split All Sheets (ZIP)'
              : tool.id === 'compress-excel'
              ? 'Compress & Download .XLSX'
              : tool.id === 'clean-spreadsheet'
              ? 'Clean & Download .XLSX'
              : tool.id === 'compare-spreadsheets'
              ? 'Download Diff Report (.XLSX)'
              : 'Download Output'}
          </button>
        )}
      </div>

      {/* Upload Box(es) */}
      <div className={`grid grid-cols-1 ${tool.id === 'compare-spreadsheets' ? 'md:grid-cols-2' : ''} gap-4`}>
        <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-[#2F3E4E]/45 rounded-2xl bg-[#FEF2C8]/40 hover:bg-[#FEF2C8]/75 cursor-pointer text-center">
          <UploadCloud className="w-7 h-7 text-[#2F3E4E] mb-2" />
          <span className="text-sm font-bold text-[#2F3E4E]">
            {fileName ? `File A: ${fileName} (${fileSizeKb} KB)` : 'Upload Excel or CSV File (.XLSX, .XLS, .CSV)'}
          </span>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void loadWorkbookFile(f);
            }}
          />
        </label>

        {tool.id === 'compare-spreadsheets' && (
          <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-[#2F3E4E]/45 rounded-2xl bg-[#CEE5DC]/40 hover:bg-[#CEE5DC]/75 cursor-pointer text-center">
            <UploadCloud className="w-7 h-7 text-[#2F3E4E] mb-2" />
            <span className="text-sm font-bold text-[#2F3E4E]">
              {compareNameB ? `File B: ${compareNameB}` : 'Upload Second Spreadsheet (File B to Compare)'}
            </span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) {
                  const buf = await f.arrayBuffer();
                  setCompareWbB(XLSX.read(buf, { type: 'array' }));
                  setCompareNameB(f.name);
                }
              }}
            />
          </label>
        )}
      </div>

      {status && (
        <div className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${status.type === 'error' ? 'bg-rose-50 border-rose-300 text-rose-800' : 'bg-[#CEE5DC]/60 border-[#2F3E4E]/30 text-[#2F3E4E]'}`}>
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-700" />
          <span>{status.text}</span>
        </div>
      )}

      {wb && (
        <div className="space-y-4">
          {/* Worksheet Switcher */}
          {wb.SheetNames.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-[#475569]">Worksheet:</span>
              {wb.SheetNames.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setActiveSheet(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                    activeSheet === s ? 'bg-[#F9C80E] border-[#2F3E4E] text-[#2F3E4E]' : 'bg-white border-[#2F3E4E]/25 text-[#475569]'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Tool-Specific Controls */}
          {tool.id === 'clean-spreadsheet' && (
            <div className="p-4 rounded-xl bg-[#FEF2C8]/65 border border-[#2F3E4E]/30 flex flex-wrap gap-4 text-xs font-bold text-[#2F3E4E]">
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={cleanTrim} onChange={(e) => setCleanTrim(e.target.checked)} />
                <span>Trim Spaces</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={cleanEmptyRows} onChange={(e) => setCleanEmptyRows(e.target.checked)} />
                <span>Drop Empty Rows</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={cleanEmptyCols} onChange={(e) => setCleanEmptyCols(e.target.checked)} />
                <span>Drop Empty Columns</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={cleanDuplicates} onChange={(e) => setCleanDuplicates(e.target.checked)} />
                <span>Remove Duplicate Rows</span>
              </label>
            </div>
          )}

          {tool.id === 'csv-delimiter-utf8' && (
            <div className="p-4 rounded-xl bg-[#FEF2C8]/65 border border-[#2F3E4E]/30 flex flex-wrap items-center gap-4 text-xs font-bold text-[#2F3E4E]">
              <span>Delimiter:</span>
              {[
                { val: ',' as const, label: 'Comma (,)' },
                { val: ';' as const, label: 'Semicolon (;)' },
                { val: '\t' as const, label: 'Tab (TSV)' },
                { val: '|' as const, label: 'Pipe (|)' },
              ].map((d) => (
                <button
                  key={d.label}
                  type="button"
                  onClick={() => setCsvDelimiter(d.val)}
                  className={`px-3 py-1 rounded-lg border cursor-pointer ${csvDelimiter === d.val ? 'bg-[#2F3E4E] text-[#FFFDF5]' : 'bg-white'}`}
                >
                  {d.label}
                </button>
              ))}
              <label className="inline-flex items-center gap-1.5 ml-auto cursor-pointer">
                <input type="checkbox" checked={includeBom} onChange={(e) => setIncludeBom(e.target.checked)} />
                <span>Include UTF-8 BOM (Excel India Safe)</span>
              </label>
            </div>
          )}

          {tool.id === 'excel-to-json' && (
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => setJsonMode('objects')}
                className={`px-3 py-1.5 rounded-lg border cursor-pointer ${jsonMode === 'objects' ? 'bg-[#2F3E4E] text-white' : 'bg-white'}`}
              >
                Array of Objects
              </button>
              <button
                type="button"
                onClick={() => setJsonMode('matrix')}
                className={`px-3 py-1.5 rounded-lg border cursor-pointer ${jsonMode === 'matrix' ? 'bg-[#2F3E4E] text-white' : 'bg-white'}`}
              >
                2D Matrix Arrays
              </button>
            </div>
          )}

          {tool.id === 'excel-to-markdown-sql' && (
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
              {(['markdown', 'html', 'sql'] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setCodeFormat(fmt)}
                  className={`px-3 py-1.5 rounded-lg border uppercase cursor-pointer ${codeFormat === fmt ? 'bg-[#2F3E4E] text-white' : 'bg-white'}`}
                >
                  {fmt}
                </button>
              ))}
              {codeFormat === 'sql' && (
                <input
                  type="text"
                  value={sqlTableName}
                  onChange={(e) => setSqlTableName(e.target.value)}
                  placeholder="SQL table name"
                  className="ml-2 px-3 py-1.5 rounded-lg border border-[#2F3E4E]/40 bg-white font-mono"
                />
              )}
            </div>
          )}

          {tool.id === 'column-extractor' && selectedCols.length > 0 && (
            <div className="p-4 rounded-xl bg-white border-[1.5px] border-[#2F3E4E] space-y-2 text-xs">
              <p className="font-bold text-[#2F3E4E]">Pick, Rename &amp; Reorder Columns:</p>
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {selectedCols.map((col, idx) => (
                  <div key={`${col.name}-${idx}`} className="flex items-center gap-2 p-2 rounded-lg bg-[#FEF2C8]/40">
                    <input
                      type="checkbox"
                      checked={col.enabled}
                      onChange={(e) =>
                        setSelectedCols((prev) => prev.map((c, i) => (i === idx ? { ...c, enabled: e.target.checked } : c)))
                      }
                    />
                    <span className="font-mono text-[#64748B] w-36 truncate">{col.name}</span>
                    <input
                      type="text"
                      value={col.rename}
                      onChange={(e) =>
                        setSelectedCols((prev) => prev.map((c, i) => (i === idx ? { ...c, rename: e.target.value } : c)))
                      }
                      className="flex-1 px-2 py-1 rounded border border-[#2F3E4E]/30 bg-white font-semibold"
                    />
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() =>
                        setSelectedCols((prev) => {
                          const next = [...prev];
                          [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                          return next;
                        })
                      }
                      className="p-1 rounded border bg-white disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === selectedCols.length - 1}
                      onClick={() =>
                        setSelectedCols((prev) => {
                          const next = [...prev];
                          [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                          return next;
                        })
                      }
                      className="p-1 rounded border bg-white disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tool.id === 'compare-spreadsheets' && compareWbB && (
            <div className="rounded-xl border-[1.5px] border-[#2F3E4E] bg-white p-4 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-[#2F3E4E]">
                  Cell Differences Found: <span className="font-mono text-rose-700">{compareDiffs.length}</span>
                </span>
                <Sparkles className="w-4 h-4 text-[#B45309]" />
              </div>
              {compareDiffs.length > 0 && (
                <div className="max-h-64 overflow-y-auto overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#2F3E4E] text-white">
                      <tr>
                        <th className="py-2 px-3">Row</th>
                        <th className="py-2 px-3">Col</th>
                        <th className="py-2 px-3">Workbook A</th>
                        <th className="py-2 px-3">Workbook B</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2F3E4E]/10">
                      {compareDiffs.slice(0, 100).map((d, idx) => (
                        <tr key={idx}>
                          <td className="py-1.5 px-3 font-mono">{d.row}</td>
                          <td className="py-1.5 px-3 font-mono">{d.col}</td>
                          <td className="py-1.5 px-3 bg-rose-50 text-rose-800">{d.valA || '—'}</td>
                          <td className="py-1.5 px-3 bg-emerald-50 text-emerald-800">{d.valB || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Code Preview for CSV / JSON / Delimiter / Markdown / SQL */}
          {generatedTextOutput ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-[#2F3E4E]">
                <span>Generated Output Preview</span>
                <button
                  type="button"
                  onClick={() => void copyOut(generatedTextOutput)}
                  className="px-3 py-1 rounded-lg border border-[#2F3E4E] bg-white inline-flex items-center gap-1 cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <textarea
                readOnly
                rows={10}
                value={generatedTextOutput.slice(0, 20000)}
                className="w-full p-3.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white font-mono text-xs"
              />
            </div>
          ) : (
            /* Live Interactive Table Preview */
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search cells..."
                  className="px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white w-full sm:w-72"
                />
                <span className="font-mono font-bold text-[#475569]">
                  {filteredBody.length} rows × {headers.length} columns
                </span>
              </div>
              <div className="rounded-xl border-[1.5px] border-[#2F3E4E] overflow-x-auto max-h-[400px] bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#2F3E4E] text-[#FFFDF5] sticky top-0">
                    <tr>
                      {headers.map((h, i) => (
                        <th key={i} className="py-2.5 px-3 font-semibold whitespace-nowrap">
                          {h || `Col ${i + 1}`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2F3E4E]/10">
                    {filteredBody.slice(0, 200).map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-[#FEF2C8]/35">
                        {headers.map((_, cIdx) => (
                          <td key={cIdx} className="py-2 px-3 whitespace-nowrap">
                            {row[cIdx] ?? ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
