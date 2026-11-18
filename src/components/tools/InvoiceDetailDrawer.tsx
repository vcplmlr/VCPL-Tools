import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { InvoiceRecord, ValidationIssue } from '../../types/invoice';
import { formatINR } from '../../utils/numberToWords';
import { invoiceComputedTotal, lineTaxTotal } from '../../utils/invoiceValidation';

interface InvoiceDetailDrawerProps {
  invoice: InvoiceRecord | null;
  issues: ValidationIssue[];
  onClose: () => void;
  onUpdateField: (fid: number, field: keyof InvoiceRecord, value: string | number) => void;
  onAddLine: (fid: number) => void;
  onDeleteLine: (fid: number, lineIdx: number) => void;
  onDeleteInvoice: (fid: number) => void;
}

const HEADER_FIELDS: Array<{
  key: keyof InvoiceRecord;
  label: string;
  numeric?: boolean;
  fullWidth?: boolean;
}> = [
  { key: 'no', label: 'Invoice No' },
  { key: 'date', label: 'Invoice Date' },
  { key: 'cust', label: 'Customer / Buyer' },
  { key: 'cgst', label: 'Customer GSTIN' },
  { key: 'sup', label: 'Supplier / Seller' },
  { key: 'sgst', label: 'Supplier GSTIN' },
  { key: 'pos', label: 'Place of Supply' },
  { key: 'roundOff', label: 'Round Off (INR)', numeric: true },
  { key: 'amt', label: 'Printed Amount (INR)', numeric: true },
  { key: 'ord', label: 'Order / PO No' },
  { key: 'irn', label: 'IRN (64-char hash)', fullWidth: true },
];

export const InvoiceDetailDrawer: React.FC<InvoiceDetailDrawerProps> = ({
  invoice,
  issues,
  onClose,
  onUpdateField,
  onAddLine,
  onDeleteLine,
  onDeleteInvoice,
}) => {
  const [renderingPdf, setRenderingPdf] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [renderedPages, setRenderedPages] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(0);
  const canvasBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPdfError('');
    setRenderedPages(0);
    setTotalPages(0);
    if (canvasBoxRef.current) {
      canvasBoxRef.current.innerHTML = '';
    }
  }, [invoice?.fid]);

  if (!invoice) return null;

  const hasErr = issues.some((x) => x.sev === 'err');
  const statusLabel =
    issues.length === 0
      ? 'All checks passed'
      : `${issues.length} audit issue${issues.length > 1 ? 's' : ''}`;

  const handleRenderPreview = async () => {
    if (!invoice.pdfBuffer || !canvasBoxRef.current) return;
    setRenderingPdf(true);
    setPdfError('');
    canvasBoxRef.current.innerHTML = '';
    try {
      const pdf = await pdfjsLib.getDocument({
        data: new Uint8Array(invoice.pdfBuffer.slice(0)),
        password: invoice.pdfPassword,
      }).promise;
      const limit = Math.min(pdf.numPages, 8);
      setTotalPages(pdf.numPages);
      for (let p = 1; p <= limit; p++) {
        const page = await pdf.getPage(p);
        const viewport = page.getViewport({ scale: 1.3 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.className = 'w-full rounded-lg border border-[#2F3E4E]/25 bg-white mb-3';
        canvasBoxRef.current.appendChild(canvas);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        }
        setRenderedPages(p);
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      setPdfError(e?.message || 'Unable to render PDF pages.');
    } finally {
      setRenderingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="fixed inset-0 bg-[#2F3E4E]/50 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        aria-label="Invoice detail inspector"
        className="relative z-10 w-full max-w-2xl bg-[#FFFDF5] border-l-[1.5px] border-[#2F3E4E] h-full flex flex-col shadow-2xl"
      >
        {/* Top Bar */}
        <div className="px-6 py-4 bg-[#FEF2C8] border-b border-[#2F3E4E]/20 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-display font-extrabold text-lg sm:text-xl text-[#2F3E4E] truncate">
              {invoice.no}
            </h2>
            <p className="text-xs text-[#475569] truncate mt-0.5">
              {invoice.sup || 'Supplier'} <span aria-hidden="true">→</span>{' '}
              {invoice.cust || 'Customer'}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#475569] mt-2 font-medium">
              <span
                className={`inline-flex items-center gap-1 font-bold ${
                  hasErr
                    ? 'text-rose-700'
                    : issues.length > 0
                      ? 'text-amber-700'
                      : 'text-emerald-700'
                }`}
              >
                {hasErr ? (
                  <AlertCircle className="w-3.5 h-3.5" />
                ) : issues.length > 0 ? (
                  <AlertTriangle className="w-3.5 h-3.5" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                {statusLabel}
              </span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{invoice.items.length} line(s)</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{invoice.pages.length} page(s)</span>
              <span aria-hidden="true">·</span>
              <span>{invoice.parserMode}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono font-bold text-[#2F3E4E] tabular-nums">
                {formatINR(invoiceComputedTotal(invoice))}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="p-2 rounded-lg border border-[#2F3E4E]/30 bg-white hover:bg-[#F9C80E] text-[#2F3E4E] cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Validation Issues for this Invoice */}
          {issues.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                Audit Findings
              </h3>
              <div className="border border-[#2F3E4E]/25 rounded-xl bg-white divide-y divide-[#2F3E4E]/10">
                {issues.map((iss, idx) => (
                  <div key={idx} className="p-3 flex items-start gap-2.5 text-xs">
                    {iss.sev === 'err' ? (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <span className="font-bold text-[#2F3E4E]">{iss.chk}</span>
                      <p className="text-[#475569] mt-0.5">{iss.msg}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invoice Metadata Editor */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
              Invoice Metadata
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {HEADER_FIELDS.map((f) => {
                const rawVal = invoice[f.key];
                return (
                  <label
                    key={String(f.key)}
                    className={`block ${f.fullWidth ? 'sm:col-span-2' : ''}`}
                  >
                    <span className="block text-[11px] font-semibold text-[#475569] mb-1">
                      {f.label}
                    </span>
                    <input
                      type={f.numeric ? 'number' : 'text'}
                      step={f.numeric ? '0.01' : undefined}
                      value={rawVal === undefined || rawVal === null ? '' : String(rawVal)}
                      onChange={(e) =>
                        onUpdateField(
                          invoice.fid,
                          f.key,
                          f.numeric ? parseFloat(e.target.value) || 0 : e.target.value
                        )
                      }
                      className={`w-full px-3 py-1.5 rounded-lg border border-[#2F3E4E]/30 bg-white text-xs text-[#2F3E4E] focus:outline-none focus:border-[#2F3E4E] ${
                        f.numeric ? 'font-mono tabular-nums text-right' : ''
                      }`}
                    />
                  </label>
                );
              })}
            </div>
          </div>

          {/* Line Items Summary Table */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                Line Items ({invoice.items.length})
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onAddLine(invoice.fid)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#2F3E4E] bg-[#CEE5DC] hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Line</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteInvoice(invoice.fid)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-300 bg-rose-50 hover:bg-rose-100 text-xs font-bold text-rose-700 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Invoice</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto border border-[#2F3E4E]/25 rounded-xl bg-white">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#2F3E4E] text-[#FFFDF5]">
                  <tr>
                    <th className="py-2 px-2.5 font-semibold">#</th>
                    <th className="py-2 px-2.5 font-semibold">HSN</th>
                    <th className="py-2 px-2.5 font-semibold">Description</th>
                    <th className="py-2 px-2.5 font-semibold text-right">Qty</th>
                    <th className="py-2 px-2.5 font-semibold text-right">Taxable</th>
                    <th className="py-2 px-2.5 font-semibold text-right">Rate</th>
                    <th className="py-2 px-2.5 font-semibold text-right">Tax</th>
                    <th className="py-2 px-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {invoice.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-[#FEF2C8]/30">
                      <td className="py-2 px-2.5 font-mono tabular-nums text-[#64748B]">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-2.5 font-mono">{item.hsn || '—'}</td>
                      <td className="py-2 px-2.5 max-w-[180px] truncate" title={item.desc}>
                        {item.desc}
                      </td>
                      <td className="py-2 px-2.5 font-mono tabular-nums text-right">
                        {item.qty}
                      </td>
                      <td className="py-2 px-2.5 font-mono tabular-nums text-right">
                        {item.net.toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-2 px-2.5 font-mono tabular-nums text-right">
                        {+(item.rate * 100).toFixed(2)}%
                      </td>
                      <td className="py-2 px-2.5 font-mono tabular-nums text-right">
                        {lineTaxTotal(item).toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-2 px-2 text-right">
                        <button
                          type="button"
                          onClick={() => onDeleteLine(invoice.fid, idx)}
                          aria-label={`Delete line ${idx + 1}`}
                          className="p-1 text-rose-600 hover:text-rose-800 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Side-by-Side PDF Page Preview */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
              Original PDF Preview
            </h3>
            {invoice.pdfBuffer ? (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleRenderPreview}
                  disabled={renderingPdf}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] cursor-pointer disabled:opacity-50"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>
                    {renderingPdf
                      ? `Rendering page ${renderedPages}/${totalPages || invoice.pages.length}...`
                      : renderedPages > 0
                        ? 'Re-render PDF Pages'
                        : `Render PDF Pages (${invoice.pages.length})`}
                  </span>
                </button>
                {pdfError && (
                  <p className="text-xs text-rose-700 font-medium">{pdfError}</p>
                )}
                <div ref={canvasBoxRef} />
                {totalPages > 8 && renderedPages === 8 && (
                  <p className="text-xs text-[#64748B]">
                    Showing first 8 of {totalPages} pages.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-[#64748B]">
                PDF canvas preview is available for uploaded PDF files (not sample or JSON restored sessions).
              </p>
            )}
          </div>

          {/* Extracted Raw Page Text */}
          <div className="space-y-2">
            <details className="border border-[#2F3E4E]/20 rounded-xl bg-white p-3">
              <summary className="text-xs font-bold text-[#2F3E4E] cursor-pointer select-none">
                Inspect Extracted Page-Wise Raw Text ({invoice.pages.length} page(s))
              </summary>
              <pre className="mt-3 p-3 rounded-lg bg-[#FEF2C8]/30 border border-[#2F3E4E]/15 text-[11px] font-mono text-[#2F3E4E] overflow-x-auto max-h-64 whitespace-pre">
                {invoice.pages
                  .map(
                    (p) =>
                      `── Page ${p.n} ──\n` +
                      p.rows.map((r) => r.join('  |  ')).join('\n')
                  )
                  .join('\n\n')}
              </pre>
            </details>
          </div>
        </div>
      </aside>
    </div>
  );
};
