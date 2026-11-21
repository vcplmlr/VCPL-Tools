import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle,
  Copy,
  Download,
  FileCode2,
  FileSpreadsheet,
  FileText,
  Presentation,
  RefreshCw,
  RotateCcw,
  UploadCloud,
} from 'lucide-react';
import { ToolCatalogItem } from '../../types/tools';
import {
  convertDocxToHtmlAndPdf,
  convertExcelToPdfBlob,
  convertPdfToDocx,
  convertPdfToExcelBlob,
  convertPdfToPptxBlob,
  convertPdfToTextFormats,
  renderHtmlToPdfBlob,
} from '../../utils/documentConverters';

interface PdfConverterViewProps {
  tool: ToolCatalogItem;
}

function sanitizeBaseName(name: string): string {
  return (
    name
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'converted-document'
  );
}

export const PdfConverterView: React.FC<PdfConverterViewProps> = ({ tool }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(
    null
  );

  // Output state
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [outputFilename, setOutputFilename] = useState<string>('');
  const [outputSizeKb, setOutputSizeKb] = useState<number>(0);

  // Previews
  const [previewText, setPreviewText] = useState<string>('');
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [copiedPreview, setCopiedPreview] = useState<boolean>(false);
  const [htmlInput, setHtmlInput] = useState<string>('');

  const isHtmlToPdf = tool.id === 'html-to-pdf';
  const isWordToPdf = tool.id === 'word-to-pdf';
  const isExcelToPdf = tool.id === 'excel-to-pdf';

  const acceptAttr = isWordToPdf
    ? '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    : isExcelToPdf
    ? '.xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv'
    : isHtmlToPdf
    ? '.html,.htm,text/html'
    : 'application/pdf,.pdf';

  const formatHint = isWordToPdf
    ? 'Word (.DOCX)'
    : isExcelToPdf
    ? 'Excel / CSV (.XLSX, .XLS, .CSV)'
    : isHtmlToPdf
    ? 'HTML (.HTML, .HTM) or paste markup'
    : 'PDF Document (.PDF)';

  const clearOutput = () => {
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    setOutputUrl(null);
    setOutputFilename('');
    setOutputSizeKb(0);
    setPreviewText('');
    setPreviewRows([]);
    setPreviewHtml('');
  };

  useEffect(() => {
    clearOutput();
    setFile(null);
    setStatus(null);
    setProgress(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool.id]);

  const setFinalBlob = (blob: Blob, filename: string) => {
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    const url = URL.createObjectURL(blob);
    setOutputUrl(url);
    setOutputFilename(filename);
    setOutputSizeKb(Math.max(1, Math.round(blob.size / 1024)));
  };

  const processFile = async (targetFile: File) => {
    clearOutput();
    setStatus(null);
    setIsProcessing(true);
    setProgress(null);

    const base = sanitizeBaseName(targetFile.name);

    try {
      const buffer = await targetFile.arrayBuffer();

      switch (tool.id) {
        case 'pdf-to-word': {
          const { blob, pages, tableCount } = await convertPdfToDocx(buffer, (c, t) =>
            setProgress({ current: c, total: t })
          );
          setFinalBlob(blob, `${base}.docx`);
          setPreviewText(pages.map((p) => `--- Page ${p.pageNumber} ---\n${p.rawText}`).join('\n\n'));
          setStatus({
            type: 'success',
            text: `Converted ${pages.length} page(s) to Word (.DOCX) with ${tableCount} structured table(s) detected.`,
          });
          break;
        }
        case 'word-to-pdf': {
          const { html, pdfBlob, pageCount } = await convertDocxToHtmlAndPdf(buffer);
          setFinalBlob(pdfBlob, `${base}.pdf`);
          setPreviewHtml(html);
          setStatus({
            type: 'success',
            text: `Converted Word document into a formatted PDF (~${pageCount} page(s)).`,
          });
          break;
        }
        case 'pdf-to-excel': {
          const { blob, previewRows: rows, sheetCount, rowCount } = await convertPdfToExcelBlob(
            buffer,
            (c, t) => setProgress({ current: c, total: t })
          );
          setFinalBlob(blob, `${base}.xlsx`);
          setPreviewRows(rows);
          setStatus({
            type: 'success',
            text: `Extracted ${rowCount} row(s) across ${sheetCount} worksheet(s) into .XLSX.`,
          });
          break;
        }
        case 'excel-to-pdf': {
          const { blob, sheetNames, previewRows: rows } = await convertExcelToPdfBlob(buffer);
          setFinalBlob(blob, `${base}.pdf`);
          setPreviewRows(rows);
          setStatus({
            type: 'success',
            text: `Converted ${sheetNames.length} Excel sheet(s) into a printable landscape PDF.`,
          });
          break;
        }
        case 'pdf-to-ppt': {
          const { blob, slideCount } = await convertPdfToPptxBlob(buffer, (c, t) =>
            setProgress({ current: c, total: t })
          );
          setFinalBlob(blob, `${base}.pptx`);
          setStatus({
            type: 'success',
            text: `Created PowerPoint (.PPTX) deck with ${slideCount} widescreen slide(s) and extracted speaker notes.`,
          });
          break;
        }
        case 'pdf-to-text': {
          const { blob, previewText: txt, pageCount } = await convertPdfToTextFormats(
            buffer,
            'txt',
            (c, t) => setProgress({ current: c, total: t })
          );
          setFinalBlob(blob, `${base}.txt`);
          setPreviewText(txt);
          setStatus({
            type: 'success',
            text: `Extracted plain text from ${pageCount} PDF page(s).`,
          });
          break;
        }
        case 'pdf-to-html': {
          const { blob, previewText: htmlStr, pageCount } = await convertPdfToTextFormats(
            buffer,
            'html',
            (c, t) => setProgress({ current: c, total: t })
          );
          setFinalBlob(blob, `${base}.html`);
          setPreviewText(htmlStr);
          setStatus({
            type: 'success',
            text: `Converted ${pageCount} PDF page(s) into semantic HTML5.`,
          });
          break;
        }
        case 'pdf-to-csv': {
          const { blob, previewText: csv, pageCount } = await convertPdfToTextFormats(
            buffer,
            'csv',
            (c, t) => setProgress({ current: c, total: t })
          );
          setFinalBlob(blob, `${base}.csv`);
          setPreviewText(csv);
          setStatus({
            type: 'success',
            text: `Extracted tabular CSV rows from ${pageCount} PDF page(s).`,
          });
          break;
        }
        case 'pdf-to-rtf': {
          const { blob, previewText: rtfText, pageCount } = await convertPdfToTextFormats(
            buffer,
            'rtf',
            (c, t) => setProgress({ current: c, total: t })
          );
          setFinalBlob(blob, `${base}.rtf`);
          setPreviewText(rtfText);
          setStatus({
            type: 'success',
            text: `Generated Rich Text Format (.RTF) from ${pageCount} PDF page(s).`,
          });
          break;
        }
        case 'html-to-pdf': {
          const text = new TextDecoder().decode(buffer);
          setHtmlInput(text);
          const pdfBlob = await renderHtmlToPdfBlob(text);
          setFinalBlob(pdfBlob, `${base}.pdf`);
          setStatus({
            type: 'success',
            text: `Converted ${targetFile.name} into a multi-page A4 PDF.`,
          });
          break;
        }
      }
    } catch (err: any) {
      setStatus({
        type: 'error',
        text: err?.message || 'Conversion failed. Please verify the uploaded file format.',
      });
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  };

  const handleFileChange = (incoming?: File | null) => {
    if (!incoming) return;
    setFile(incoming);
    processFile(incoming);
  };

  const handleConvertHtmlText = async () => {
    if (!htmlInput.trim()) {
      setStatus({ type: 'error', text: 'Please enter or upload HTML markup first.' });
      return;
    }
    clearOutput();
    setIsProcessing(true);
    setStatus(null);
    try {
      const pdfBlob = await renderHtmlToPdfBlob(htmlInput);
      setFinalBlob(pdfBlob, 'html-document.pdf');
      setStatus({ type: 'success', text: 'Rendered HTML markup into a multi-page A4 PDF.' });
    } catch (err: any) {
      setStatus({ type: 'error', text: err?.message || 'Failed to render HTML to PDF.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const renderHeaderIcon = () => {
    if (tool.id.includes('excel')) return <FileSpreadsheet className="w-5 h-5" />;
    if (tool.id.includes('ppt')) return <Presentation className="w-5 h-5" />;
    if (tool.id.includes('html')) return <FileCode2 className="w-5 h-5" />;
    return <FileText className="w-5 h-5" />;
  };

  return (
    <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-6 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-[#2F3E4E]/15">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FEF2C8] border-[1.5px] border-[#2F3E4E] text-[#2F3E4E] flex items-center justify-center shrink-0 mt-0.5">
            {renderHeaderIcon()}
          </div>
          <div>
            <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
              {tool.categoryName} · {tool.code}
            </span>
            <h1 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] mt-0.5 tracking-tight">
              {tool.title}
            </h1>
            <p className="text-xs sm:text-sm text-[#475569] mt-0.5">{tool.description}</p>
          </div>
        </div>

        {(file || outputUrl || previewText || previewHtml || previewRows.length > 0 || (isHtmlToPdf && htmlInput)) && (
          <button
            type="button"
            onClick={() => {
              clearOutput();
              setFile(null);
              setStatus(null);
              if (isHtmlToPdf) setHtmlInput('');
            }}
            className="px-3.5 py-2 text-xs font-bold text-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] rounded-lg cursor-pointer shrink-0 inline-flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Tool</span>
          </button>
        )}
      </div>

      {/* Upload Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const dropped = e.dataTransfer.files?.[0];
          if (dropped) handleFileChange(dropped);
        }}
        className={`border-2 border-dashed rounded-2xl p-8 text-center transition-colors ${
          isDragging
            ? 'border-[#1D4ED8] bg-[#CEE5DC]/50'
            : 'border-[#2F3E4E]/40 bg-[#FEF2C8]/45'
        }`}
      >
        <input
          type="file"
          id="converter-file-input"
          accept={acceptAttr}
          onChange={(e) => handleFileChange(e.target.files?.[0])}
          className="hidden"
        />

        <div className="mx-auto w-12 h-12 rounded-xl bg-white border-[1.5px] border-[#2F3E4E] flex items-center justify-center text-[#2F3E4E] mb-3">
          <UploadCloud className="w-6 h-6" />
        </div>

        <p className="font-display font-bold text-base text-[#2F3E4E]">
          {file ? file.name : `Drag & drop your ${formatHint} file here`}
        </p>
        <p className="text-xs text-[#475569] mt-1">
          100% browser-side conversion · Zero server file retention
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <label
            htmlFor="converter-file-input"
            className="px-5 py-2.5 bg-[#2F3E4E] hover:bg-[#1E293B] text-[#FFFDF5] rounded-xl text-xs sm:text-sm font-bold cursor-pointer inline-flex items-center gap-2"
          >
            <UploadCloud className="w-4 h-4" />
            <span>{file ? 'Upload Another File' : 'Browse File'}</span>
          </label>

          {file && !isProcessing && (
            <button
              type="button"
              onClick={() => processFile(file)}
              className="px-4 py-2.5 bg-white hover:bg-[#F9C80E] text-[#2F3E4E] border-[1.5px] border-[#2F3E4E] rounded-xl text-xs sm:text-sm font-bold cursor-pointer inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Re-Convert</span>
            </button>
          )}
        </div>
      </div>

      {/* Direct HTML Editor for HTML to PDF */}
      {isHtmlToPdf && (
        <div className="p-5 bg-white border-[1.5px] border-[#2F3E4E] rounded-xl space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="html-source-editor" className="text-xs font-bold text-[#2F3E4E] uppercase">
              HTML Markup Input
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setHtmlInput('')}
                className="px-2.5 py-1.5 bg-white hover:bg-[#FFE1B3] text-[#2F3E4E] border border-[#2F3E4E] rounded-lg text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Clear Markup
              </button>
              <button
                type="button"
                onClick={handleConvertHtmlText}
                disabled={isProcessing}
                className="px-4 py-1.5 bg-[#2F3E4E] hover:bg-[#1E293B] text-[#FFFDF5] rounded-lg text-xs font-bold cursor-pointer"
              >
                Convert HTML to PDF
              </button>
            </div>
          </div>
          <textarea
            id="html-source-editor"
            rows={8}
            value={htmlInput}
            onChange={(e) => setHtmlInput(e.target.value)}
            className="w-full p-3 font-mono text-xs bg-[#F8FAFC] border border-[#2F3E4E]/30 rounded-lg text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#2F3E4E]"
          />
        </div>
      )}

      {/* Progress Bar */}
      {isProcessing && (
        <div className="p-4 rounded-xl bg-white border-[1.5px] border-[#2F3E4E] flex items-center gap-3 text-xs font-semibold text-[#2F3E4E]">
          <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
          <span>
            {progress
              ? `Processing page ${progress.current} of ${progress.total}...`
              : 'Converting document in your browser...'}
          </span>
        </div>
      )}

      {/* Status Notice */}
      {status && (
        <div
          className={`p-4 rounded-xl border-[1.5px] flex items-center gap-3 text-xs font-semibold ${
            status.type === 'success'
              ? 'bg-[#CEE5DC]/75 border-[#2F3E4E] text-[#2F3E4E]'
              : status.type === 'info'
              ? 'bg-[#FEF2C8] border-[#2F3E4E] text-[#2F3E4E]'
              : 'bg-red-50 border-red-600 text-red-800'
          }`}
        >
          {status.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-700 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-700 shrink-0" />
          )}
          <span>{status.text}</span>
        </div>
      )}

      {/* Download Output Card */}
      {outputUrl && (
        <div className="p-5 bg-[#CEE5DC] border-[1.5px] border-[#2F3E4E] rounded-xl flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-extrabold text-[#2F3E4E]">{outputFilename}</p>
            <p className="text-xs text-[#334155] font-mono tabular-nums mt-0.5">
              Output Size: {outputSizeKb} KB · Ready for download
            </p>
          </div>
          <a
            href={outputUrl}
            download={outputFilename}
            className="px-5 py-2.5 bg-[#2F3E4E] hover:bg-[#1E293B] text-[#FFFDF5] rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>Download Output</span>
          </a>
        </div>
      )}

      {/* Previews */}
      {previewRows.length > 0 && (
        <div className="bg-white border-[1.5px] border-[#2F3E4E] rounded-xl p-4 space-y-2 overflow-x-auto">
          <p className="text-xs font-bold text-[#2F3E4E]">
            Extracted Spreadsheet Preview (First {previewRows.length} rows)
          </p>
          <table className="w-full text-xs border-collapse">
            <tbody>
              {previewRows.map((row, rIdx) => (
                <tr key={rIdx} className={rIdx === 0 ? 'bg-[#FEF2C8] font-bold' : 'border-t border-[#2F3E4E]/15'}>
                  {row.slice(0, 8).map((cell, cIdx) => (
                    <td key={cIdx} className="px-2.5 py-1.5 border-r border-[#2F3E4E]/10 max-w-[200px] truncate">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {previewText && (
        <div className="bg-white border-[1.5px] border-[#2F3E4E] rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-[#2F3E4E]">Extracted Output Preview</p>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(previewText);
                setCopiedPreview(true);
                setTimeout(() => setCopiedPreview(false), 1600);
              }}
              className="px-2.5 py-1 rounded-lg border border-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#F9C80E] text-[11px] font-bold text-[#2F3E4E] inline-flex items-center gap-1 cursor-pointer"
            >
              {copiedPreview ? <Check className="w-3 h-3 text-emerald-700" /> : <Copy className="w-3 h-3" />}
              <span>{copiedPreview ? 'Copied' : 'Copy Extracted Text'}</span>
            </button>
          </div>
          <pre className="text-xs font-mono text-[#334155] whitespace-pre-wrap break-words bg-[#F8FAFC] p-3 rounded-lg border border-[#2F3E4E]/15">
            {previewText.slice(0, 8000)}
          </pre>
        </div>
      )}

      {previewHtml && (
        <div className="bg-white border-[1.5px] border-[#2F3E4E] rounded-xl p-4 space-y-2">
          <p className="text-xs font-bold text-[#2F3E4E]">Parsed Word Document Preview</p>
          <div
            className="prose prose-sm max-w-none bg-[#F8FAFC] p-4 rounded-lg border border-[#2F3E4E]/15 text-xs text-[#1E293B] overflow-hidden break-words [&_table]:block [&_table]:overflow-x-auto"
            dangerouslySetInnerHTML={{
              __html: previewHtml.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ''),
            }}
          />
        </div>
      )}
    </div>
  );
};
