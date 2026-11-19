import { memo } from 'react';
import {
  AlignLeft,
  ArrowRight,
  Barcode,
  Calculator,
  Crop,
  Database,
  Eraser,
  FileBadge,
  FileCode2,
  FileSpreadsheet,
  FileText,
  Fuel,
  GitCompareArrows,
  Hash,
  Image,
  IndianRupee,
  KeyRound,
  Keyboard,
  Landmark,
  Lock,
  Minimize2,
  PenTool,
  Presentation,
  QrCode,
  Receipt,
  RefreshCw,
  RotateCw,
  ScanText,
  Scissors,
  SlidersHorizontal,
  Sparkles,
  Stamp,
  Type,
  Unlock,
  Wrench,
} from 'lucide-react';
import { ToolCatalogItem } from '../types/tools';

interface ToolCardProps {
  tool: ToolCatalogItem;
  onOpenTool: (tool: ToolCatalogItem) => void;
  variant?: 'default' | 'wide';
}

function getToolIcon(id: string) {
  switch (id) {
    case 'bank-slip-generator':
    case 'bank-ifsc-finder':
    case 'gst-place-of-supply':
      return Landmark;
    case 'bulk-excel-slips':
    case 'excel-csv-viewer':
    case 'excel-to-csv':
    case 'csv-to-excel':
    case 'excel-to-json':
    case 'json-to-excel':
    case 'clean-spreadsheet':
    case 'merge-spreadsheets':
    case 'split-excel-sheets':
    case 'compare-spreadsheets':
    case 'compress-excel':
    case 'csv-delimiter-utf8':
    case 'column-extractor':
    case 'excel-to-markdown-sql':
    case 'pdf-table-extractor':
    case 'image-to-excel-table':
      return FileSpreadsheet;
    case 'form-26as-to-excel':
    case 'docx-viewer':
    case 'rich-text-studio':
    case 'txt-to-pdf':
    case 'text-sorter-deduper':
    case 'resume-ats-builder':
    case 'pdf-organize':
    case 'pdf-extract-pages':
    case 'pdf-reverse-pages':
    case 'pdf-nup':
    case 'pdf-alternate-mix':
    case 'pdf-booklet':
    case 'pdf-insert-blank':
    case 'pdf-header-footer':
    case 'pdf-bookmarks':
    case 'pdf-fillable-builder':
    case 'pdf-strip-metadata':
    case 'pdf-to-pdfa':
    case 'pdf-repair':
    case 'pdf-remove-annotations':
    case 'pdf-rename-content':
    case 'pdf-executive-summarizer':
    case 'pdf-page-size-changer':
    case 'markdown-studio':
    case 'lorem-ipsum-generator':
    case 'email-signature-generator':
      return FileText;
    case 'gstr2b-tally-reconciler':
    case 'tcs-tax-calculator':
    case 'bank-statement-analyzer':
    case 'business-expense-manager':
      return Receipt;
    case 'dms-tally-reconciler':
    case 'bmw-statement-reconciler':
    case 'pdf-compare':
    case 'text-compare-tool':
    case 'unit-converter':
    case 'storage-converter':
    case 'world-clock-converter':
    case 'world-country-atlas':
      return GitCompareArrows;
    case 'fuel-report-generator':
      return Fuel;
    case 'invoice-to-excel':
    case 'invoice-quotation-maker':
    case 'incentive-report-tool':
    case 'dbs-pnl-reports':
    case 'gstr1-return-prep':
    case 'pdf-to-excel':
    case 'excel-to-pdf':
    case 'pdf-to-csv':
    case 'invoice-ocr-extractor':
      return FileSpreadsheet;
    case 'unified-calculator':
      return Calculator;
    case 'pdf-to-ppt':
    case 'ppt-to-pdf':
    case 'create-presentation':
    case 'images-to-ppt':
      return Presentation;
    case 'pdf-to-html':
    case 'html-to-pdf':
    case 'json-formatter':
    case 'xml-formatter':
    case 'url-encoder-decoder':
    case 'base64-encoder-decoder':
    case 'css-js-minifier':
    case 'html-to-image':
      return FileCode2;
    case 'pdf-merger':
    case 'pdf-to-word':
    case 'word-to-pdf':
    case 'pdf-to-text':
    case 'pdf-to-rtf':
    case 'pdf-metadata-editor':
    case 'pdf-flatten-repair':
    case 'rent-payment-letter-maker':
    case 'covering-letter-generator':
      return FileText;
    case 'letterhead-invoice-maker':
      return FileBadge;
    case 'textlift-ocr-pro':
    case 'ocr-scanned-pdf':
    case 'image-to-text-ocr':
    case 'scan-to-pdf':
    case 'pdf-scan-cleanup':
    case 'exam-doc-scanner':
    case 'exam-portal-checker':
    case 'handwritten-declaration-maker':
      return ScanText;
    case 'pdf-splitter':
    case 'pdf-cropper':
    case 'pdf-page-deleter':
    case 'pdf-split-half':
    case 'pdf-split-size':
    case 'pdf-split-bookmarks':
    case 'pdf-split-text':
    case 'image-grid-splitter':
      return Scissors;
    case 'pdf-compressor':
    case 'image-compress':
    case 'image-signature-resizer':
      return Minimize2;
    case 'pdf-page-rotator':
    case 'image-rotate-flip':
    case 'pdf-flip-mirror':
    case 'pdf-deskew':
      return RotateCw;
    case 'pdf-page-reorder':
    case 'image-converter':
    case 'image-heic-converter':
    case 'kruti-nudi-unicode':
    case 'unix-timestamp-converter':
    case 'slug-filename-cleaner':
      return RefreshCw;
    case 'pdf-page-numbering':
    case 'pdf-bates-numbering':
    case 'uuid-generator':
    case 'hash-checksum-generator':
      return Hash;
    case 'image-to-pdf':
    case 'jpg-to-pdf':
    case 'png-to-pdf':
    case 'webp-to-pdf':
    case 'pdf-to-jpg':
    case 'pdf-to-png':
    case 'pdf-to-webp':
    case 'image-resize':
    case 'image-resolution-checker':
    case 'pdf-extract-images':
    case 'pdf-to-grayscale':
    case 'pdf-invert-colors':
    case 'image-filters-studio':
    case 'image-upscaler':
    case 'image-passport-sheet':
    case 'image-dpi-changer':
    case 'image-collage-maker':
    case 'image-meme-generator':
    case 'govt-exam-photo-studio':
    case 'id-card-merger':
      return Image;
    case 'jpg-crop':
    case 'png-crop':
    case 'webp-crop':
      return Crop;
    case 'image-bg-remover':
    case 'image-color-bg-remover':
    case 'image-exif-cleaner':
    case 'image-blur-privacy':
    case 'pdf-redact':
      return Eraser;
    case 'pdf-watermark-maker':
    case 'image-watermark':
      return Stamp;
    case 'pdf-signer':
    case 'pdf-editor-advanced':
      return PenTool;
    case 'pdf-unlocker':
      return Unlock;
    case 'pdf-password-protector':
    case 'password-strength-checker':
      return Lock;
    case 'multilingual-typing-test':
    case 'keyboard-shortcuts-guide':
      return Keyboard;
    case 'tally-shortcuts-guide':
      return Calculator;
    case 'word-counter':
      return AlignLeft;
    case 'case-converter':
      return Type;
    case 'qr-code-generator':
    case 'upi-merchant-validator':
    case 'vcard-visiting-card-qr':
    case 'review-qr-poster':
    case 'shop-payment-poster':
      return QrCode;
    case 'barcode-generator':
      return Barcode;
    case 'number-to-words':
    case 'income-tax-fy-2026-27':
      return IndianRupee;
    case 'password-generator':
    case 'stopwatch':
    case 'countdown-timer':
      return KeyRound;
    case 'database-file-compressor':
      return Database;
    case 'tulusiri-pro':
      return Sparkles;
    default:
      return SlidersHorizontal;
  }
}

function getSuiteIconBg(category: ToolCatalogItem['category']): string {
  switch (category) {
    case 'Banking':
      return 'bg-[#FFE1B3] dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-400/40';
    case 'Tax & GST':
      return 'bg-[#CEE5DC] dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-400/40';
    case 'GST Utilities':
      return 'bg-[#CEE5DC] dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-400/40';
    case 'Calculator':
      return 'bg-[#F9C80E] dark:text-[#0F172A] dark:border-[#F9C80E]';
    case 'PDF Suite':
      return 'bg-[#FEF2C8] dark:bg-slate-800 dark:text-amber-200 dark:border-slate-600';
    case 'Image Studio':
      return 'bg-[#FFE1B3] dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-400/40';
    case 'Typing & Text':
      return 'bg-[#E0E7FF] dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-400/40';
    case 'Utilities':
      return 'bg-[#CEE5DC] dark:bg-teal-500/20 dark:text-teal-300 dark:border-teal-400/40';
    case 'VCPL':
      return 'bg-[#F9C80E] dark:text-[#0F172A] dark:border-[#F9C80E]';
    case 'Special Tools':
      return 'bg-[#FEE2E2] text-[#7D0B0B] dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-500/40';
    case 'Learn Tools':
      return 'bg-[#CEE5DC] text-[#12805C] dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-500/40';
  }
}

export const ToolCard = memo(function ToolCard({ tool, onOpenTool, variant = 'default' }: ToolCardProps) {
  const Icon = getToolIcon(tool.id);
  const iconBg = getSuiteIconBg(tool.category);
  const isWide = variant === 'wide';

  return (
    <article
      onClick={() => onOpenTool(tool)}
      className={`group rounded-2xl bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 flex flex-col justify-between transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_4px_0_#2F3E4E] dark:hover:shadow-[0_4px_0_#020617] hover:bg-white dark:hover:bg-[#1A253B] dark:hover:border-[#F9C80E]/65 cursor-pointer ${
        isWide ? 'p-6' : 'p-5'
      }`}
    >
      <div>
        {/* Header: Icon Tile + Unboxed Suite & Code Metadata */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className={`w-10 h-10 rounded-xl border-[1.5px] border-[#2F3E4E] ${iconBg} text-[#2F3E4E] flex items-center justify-center shrink-0 transition-transform duration-150 group-hover:scale-105`}
            >
              <Icon className="w-[18px] h-[18px]" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-[#64748B] dark:text-slate-400">
                <span
                  className="font-display font-bold truncate dark:brightness-125"
                  style={{ color: tool.suiteAccent }}
                >
                  {tool.suite}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono font-semibold text-[#475569] dark:text-slate-300 tabular-nums shrink-0">
                  {tool.code}
                </span>
              </div>
              <p className="text-[11px] font-medium text-[#64748B] dark:text-slate-400 truncate mt-0.5">
                {tool.categoryName}
              </p>
            </div>
          </div>

          {tool.statusLabel.toLowerCase().includes('upgrading') ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#FEF2C8] dark:bg-amber-500/20 border border-[#B45309]/40 dark:border-amber-400/40 text-[#B45309] dark:text-amber-300 font-display font-extrabold text-[10px] uppercase tracking-wider shrink-0">
              <Wrench className="w-3 h-3" aria-hidden="true" />
              <span>Upgrading</span>
            </span>
          ) : tool.statusLabel.toLowerCase().includes('beta') ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#FEF3C7] dark:bg-amber-500/20 border border-[#B45309]/40 dark:border-amber-400/40 text-[#92400E] dark:text-amber-300 font-display font-extrabold text-[10px] uppercase tracking-wider shrink-0">
              <span>Beta</span>
            </span>
          ) : null}
        </div>

        {/* Title */}
        <h3
          className={`font-display font-bold text-[#2F3E4E] dark:text-slate-100 tracking-tight leading-snug mb-2 ${
            isWide ? 'text-lg' : 'text-base'
          }`}
        >
          {tool.title}
        </h3>

        {/* Description */}
        <p className="text-[13px] leading-relaxed text-[#475569] dark:text-slate-300 line-clamp-3 mb-5">
          {tool.description}
        </p>
      </div>

      {/* Footer: Unboxed Status + Crisp Launch Button */}
      <div className="pt-3.5 border-t border-[#2F3E4E]/12 dark:border-slate-700/80 flex items-center justify-between gap-3">
        <span
          className={`inline-flex items-center gap-1 text-xs truncate ${
            tool.statusLabel.toLowerCase().includes('upgrading')
              ? 'font-bold text-[#B45309] dark:text-amber-400'
              : tool.statusLabel.toLowerCase().includes('beta')
              ? 'font-bold text-[#B45309] dark:text-amber-400'
              : tool.statusLabel.toLowerCase().includes('passcode locked')
              ? 'font-bold text-[#2F3E4E] dark:text-slate-200'
              : 'font-medium text-[#475569] dark:text-slate-400'
          }`}
        >
          {tool.statusLabel.toLowerCase().includes('passcode locked') && (
            <Lock className="w-3 h-3 shrink-0 text-[#B45309] dark:text-amber-400" aria-hidden="true" />
          )}
          {tool.statusLabel.toLowerCase().includes('upgrading') && (
            <Wrench className="w-3 h-3 shrink-0 text-[#B45309] dark:text-amber-400" aria-hidden="true" />
          )}
          <span className="truncate">{tool.statusLabel}</span>
        </span>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenTool(tool);
          }}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border-[1.5px] border-[#2F3E4E] dark:border-slate-600 transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F3E4E] dark:focus-visible:ring-[#F9C80E] ${
            tool.featuredPrimary
              ? 'bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#FFFDF5] dark:text-[#0F172A] hover:bg-[#1E293B] dark:hover:bg-[#FDE047] dark:border-[#F9C80E]'
              : 'bg-[#FFFDF5] dark:bg-slate-800 text-[#2F3E4E] dark:text-slate-100 group-hover:bg-[#2F3E4E] dark:group-hover:bg-[#F9C80E] group-hover:text-[#FFFDF5] dark:group-hover:text-[#0F172A] dark:group-hover:border-[#F9C80E]'
          }`}
        >
          <span>
            {tool.statusLabel.toLowerCase().includes('passcode locked')
              ? 'Unlock Tool'
              : tool.statusLabel.toLowerCase().includes('upgrading')
              ? 'View Status'
              : 'Open Tool'}
          </span>
          <ArrowRight className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
        </button>
      </div>
    </article>
  );
});
