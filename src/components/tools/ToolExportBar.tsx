import React from 'react';
import {
  Check,
  Copy,
  FileCode2,
  FileSpreadsheet,
  FileText,
  Printer,
  RotateCcw,
} from 'lucide-react';

interface ToolExportBarProps {
  title?: string;
  onClear?: () => void;
  clearLabel?: string;
  onCopy?: () => void;
  copied?: boolean;
  copyLabel?: string;
  onPdf?: () => void;
  onExcel?: () => void;
  onCsv?: () => void;
  onWord?: () => void;
  onJson?: () => void;
  onPrint?: () => void;
  disabled?: boolean;
  extraActions?: React.ReactNode;
}

export const ToolExportBar: React.FC<ToolExportBarProps> = ({
  title = 'Actions & Export',
  onClear,
  clearLabel = 'Clear',
  onCopy,
  copied = false,
  copyLabel = 'Copy',
  onPdf,
  onExcel,
  onCsv,
  onWord,
  onJson,
  onPrint,
  disabled = false,
  extraActions,
}) => {
  return (
    <div className="bg-[#FFFDF5] dark:bg-[#0F172A] border-[1.5px] border-[#2F3E4E] dark:border-slate-600 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 no-print">
      <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#475569] dark:text-slate-300 px-1 whitespace-nowrap">
        {title}
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-500 bg-[#FFE1B3] dark:bg-amber-950/70 hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] dark:text-amber-200 dark:hover:text-[#0F172A] cursor-pointer whitespace-nowrap shrink-0 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{clearLabel}</span>
          </button>
        )}

        {onCopy && (
          <button
            type="button"
            onClick={onCopy}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-500 bg-white dark:bg-[#1E293B] hover:bg-[#FEF2C8] dark:hover:bg-slate-700 text-xs font-bold text-[#2F3E4E] dark:text-slate-100 cursor-pointer disabled:opacity-45 whitespace-nowrap shrink-0 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : copyLabel}</span>
          </button>
        )}

        {onExcel && (
          <button
            type="button"
            onClick={onExcel}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-500 bg-[#CEE5DC] dark:bg-emerald-950/70 hover:bg-[#b5d9ca] dark:hover:bg-emerald-900 text-xs font-bold text-[#2F3E4E] dark:text-emerald-200 cursor-pointer disabled:opacity-45 whitespace-nowrap shrink-0 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Excel</span>
          </button>
        )}

        {onCsv && (
          <button
            type="button"
            onClick={onCsv}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-500 bg-white dark:bg-[#1E293B] hover:bg-[#CEE5DC] dark:hover:bg-slate-700 text-xs font-bold text-[#2F3E4E] dark:text-slate-100 cursor-pointer disabled:opacity-45 whitespace-nowrap shrink-0 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
        )}

        {onWord && (
          <button
            type="button"
            onClick={onWord}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-500 bg-[#E0F2FE] dark:bg-sky-950/70 hover:bg-[#bae6fd] dark:hover:bg-sky-900 text-xs font-bold text-[#0F172A] dark:text-sky-200 cursor-pointer disabled:opacity-45 whitespace-nowrap shrink-0 transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Word</span>
          </button>
        )}

        {onJson && (
          <button
            type="button"
            onClick={onJson}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-500 bg-white dark:bg-[#1E293B] hover:bg-[#FEF2C8] dark:hover:bg-slate-700 text-xs font-bold text-[#2F3E4E] dark:text-slate-100 cursor-pointer disabled:opacity-45 whitespace-nowrap shrink-0 transition-colors"
          >
            <FileCode2 className="w-3.5 h-3.5" />
            <span>JSON</span>
          </button>
        )}

        {onPdf && (
          <button
            type="button"
            onClick={onPdf}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-500 bg-[#F9C80E] hover:bg-[#fde047] text-xs font-bold text-[#2F3E4E] cursor-pointer disabled:opacity-45 whitespace-nowrap shrink-0 transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Save PDF</span>
          </button>
        )}

        {onPrint && (
          <button
            type="button"
            onClick={onPrint}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-500 bg-[#2F3E4E] dark:bg-slate-100 hover:bg-[#1E293B] dark:hover:bg-white text-xs font-bold text-[#FFFDF5] dark:text-[#0F172A] cursor-pointer disabled:opacity-45 whitespace-nowrap shrink-0 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
        )}

        {extraActions}
      </div>
    </div>
  );
};
