import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Info,
  Minimize2,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';
import { useEnterpriseAuth } from '../../context/EnterpriseAuthContext';
import { getFinancialCalculatorById } from '../../data/financialCalculators';
import { getToolArticle } from '../../data/toolArticlesData';
import {
  PUBLIC_TOOLS_CATALOG,
  VAULT_TOOLS_CATALOG,
  getToolsForCategory,
} from '../../data/toolsCatalog';
import { ToolCatalogItem, ToolFilterType } from '../../types/tools';
import { BankId } from '../../utils/bankSlipRenderers';
import { getToolFullPath } from '../../utils/seoRouting';
import { AdSlot } from '../AdSlot';
import { ToolArticleSection } from '../ToolArticleSection';
import { emitGlobalProgress } from '../TopLoadingBar';

const BajajReconciliationView = lazy(() =>
  import('./BajajReconciliationView').then((m) => ({ default: m.BajajReconciliationView }))
);
const BankSlipGeneratorView = lazy(() =>
  import('./BankSlipGeneratorView').then((m) => ({ default: m.BankSlipGeneratorView }))
);
const BmwClaimsReconcilerView = lazy(() =>
  import('./BmwClaimsReconcilerView').then((m) => ({ default: m.BmwClaimsReconcilerView }))
);
const BmwStatementReconcilerView = lazy(() =>
  import('./BmwStatementReconcilerView').then((m) => ({ default: m.BmwStatementReconcilerView }))
);
const BmwVendorLedgerReconcilerView = lazy(() =>
  import('./BmwVendorLedgerReconcilerView').then((m) => ({
    default: m.BmwVendorLedgerReconcilerView,
  }))
);
const CoveringLetterGeneratorView = lazy(() =>
  import('./CoveringLetterGeneratorView').then((m) => ({
    default: m.CoveringLetterGeneratorView,
  }))
);
const DbsPnlReportsView = lazy(() =>
  import('./DbsPnlReportsView').then((m) => ({ default: m.DbsPnlReportsView }))
);
const DmsTallyReconcilerView = lazy(() =>
  import('./DmsTallyReconcilerView').then((m) => ({ default: m.DmsTallyReconcilerView }))
);
const EmbeddedHtmlToolView = lazy(() =>
  import('./EmbeddedHtmlToolView').then((m) => ({ default: m.EmbeddedHtmlToolView }))
);
const ExamUtilityCalculatorView = lazy(() =>
  import('./ExamUtilityCalculatorView').then((m) => ({ default: m.ExamUtilityCalculatorView }))
);
const FinancialCalculatorView = lazy(() =>
  import('./FinancialCalculatorView').then((m) => ({ default: m.FinancialCalculatorView }))
);
const Form26ASToExcelView = lazy(() =>
  import('./Form26ASToExcelView').then((m) => ({ default: m.Form26ASToExcelView }))
);
const FuelReportGeneratorView = lazy(() =>
  import('./FuelReportGeneratorView').then((m) => ({ default: m.FuelReportGeneratorView }))
);
const Gstr1ReturnPrepView = lazy(() =>
  import('./Gstr1ReturnPrepView').then((m) => ({ default: m.Gstr1ReturnPrepView }))
);
const Gstr2bReconcilerView = lazy(() =>
  import('./Gstr2bReconcilerView').then((m) => ({ default: m.Gstr2bReconcilerView }))
);
const ImageStudioView = lazy(() =>
  import('./ImageStudioView').then((m) => ({ default: m.ImageStudioView }))
);
const IncentiveReportToolView = lazy(() =>
  import('./IncentiveReportToolView').then((m) => ({ default: m.IncentiveReportToolView }))
);
const IncomeTaxFy2627View = lazy(() =>
  import('./IncomeTaxFy2627View').then((m) => ({ default: m.IncomeTaxFy2627View }))
);
const InvoiceQuotationMakerView = lazy(() =>
  import('./InvoiceQuotationMakerView').then((m) => ({ default: m.InvoiceQuotationMakerView }))
);
const InvoiceToExcelView = lazy(() =>
  import('./InvoiceToExcelView').then((m) => ({ default: m.InvoiceToExcelView }))
);
const NumberToWordsView = lazy(() =>
  import('./NumberToWordsView').then((m) => ({ default: m.NumberToWordsView }))
);
const PartsBillingReconcilerView = lazy(() =>
  import('./PartsBillingReconcilerView').then((m) => ({
    default: m.PartsBillingReconcilerView,
  }))
);
const PdfConverterView = lazy(() =>
  import('./PdfConverterView').then((m) => ({ default: m.PdfConverterView }))
);
const PdfEngineView = lazy(() =>
  import('./PdfEngineView').then((m) => ({ default: m.PdfEngineView }))
);
const PdfFormFillerView = lazy(() =>
  import('./PdfFormFillerView').then((m) => ({ default: m.PdfFormFillerView }))
);
const RentPaymentLetterMakerView = lazy(() =>
  import('./RentPaymentLetterMakerView').then((m) => ({
    default: m.RentPaymentLetterMakerView,
  }))
);
const SwatchbookColorPickerView = lazy(() =>
  import('./SwatchbookColorPickerView').then((m) => ({
    default: m.SwatchbookColorPickerView,
  }))
);
const TaxCalculatorView = lazy(() =>
  import('./TaxCalculatorView').then((m) => ({ default: m.TaxCalculatorView }))
);
const TcsTaxCalculatorView = lazy(() =>
  import('./TcsTaxCalculatorView').then((m) => ({ default: m.TcsTaxCalculatorView }))
);
const TdsTcsToolkitView = lazy(() =>
  import('./TdsTcsToolkitView').then((m) => ({ default: m.TdsTcsToolkitView }))
);
const TextliftOcrProView = lazy(() =>
  import('./TextliftOcrProView').then((m) => ({ default: m.TextliftOcrProView }))
);
const TypingEngineView = lazy(() =>
  import('./TypingEngineView').then((m) => ({ default: m.TypingEngineView }))
);
const UnifiedCalculatorView = lazy(() =>
  import('./UnifiedCalculatorView').then((m) => ({ default: m.UnifiedCalculatorView }))
);
const BankDirectoryToolView = lazy(() =>
  import('./BankDirectoryToolView').then((m) => ({ default: m.BankDirectoryToolView }))
);
const TaxBankingExtraView = lazy(() =>
  import('./TaxBankingExtraView').then((m) => ({ default: m.TaxBankingExtraView }))
);
const PdfAdvancedSuiteView = lazy(() =>
  import('./PdfAdvancedSuiteView').then((m) => ({ default: m.PdfAdvancedSuiteView }))
);
const SpreadsheetStudioView = lazy(() =>
  import('./SpreadsheetStudioView').then((m) => ({ default: m.SpreadsheetStudioView }))
);
const ImageProSuiteView = lazy(() =>
  import('./ImageProSuiteView').then((m) => ({ default: m.ImageProSuiteView }))
);
const ProductivityDevSuiteView = lazy(() =>
  import('./ProductivityDevSuiteView').then((m) => ({ default: m.ProductivityDevSuiteView }))
);
const UtilityEngineView = lazy(() =>
  import('./UtilityEngineView').then((m) => ({ default: m.UtilityEngineView }))
);
const RtoCodeFinderView = lazy(() =>
  import('./RtoCodeFinderView').then((m) => ({ default: m.RtoCodeFinderView }))
);
const PinCodeFinderView = lazy(() =>
  import('./PinCodeFinderView').then((m) => ({ default: m.PinCodeFinderView }))
);
const DatabaseFileCompressorView = lazy(() =>
  import('./DatabaseFileCompressorView').then((m) => ({
    default: m.DatabaseFileCompressorView,
  }))
);
const TulusiriProView = lazy(() =>
  import('./TulusiriProView').then((m) => ({
    default: m.TulusiriProView,
  }))
);
const KeyboardShortcutsView = lazy(() =>
  import('./KeyboardShortcutsView').then((m) => ({
    default: m.KeyboardShortcutsView,
  }))
);
const TallyShortcutsView = lazy(() =>
  import('./TallyShortcutsView').then((m) => ({
    default: m.TallyShortcutsView,
  }))
);
const VcplRtgsNeftFormView = lazy(() =>
  import('./VcplRtgsNeftFormView').then((m) => ({
    default: m.VcplRtgsNeftFormView,
  }))
);
const Tds26asTallyRecoView = lazy(() =>
  import('./Tds26asTallyRecoView').then((m) => ({
    default: m.Tds26asTallyRecoView,
  }))
);
const GoogleWorkspaceSuiteView = lazy(() =>
  import('./GoogleWorkspaceSuiteView').then((m) => ({
    default: m.GoogleWorkspaceSuiteView,
  }))
);

function ToolEngineFallback({ title }: { title: string }) {
  useEffect(() => {
    emitGlobalProgress(true, 45, 'suspense-tool');
    return () => {
      emitGlobalProgress(false, 100, 'suspense-tool');
    };
  }, []);

  return (
    <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-8 sm:p-10 text-center space-y-3 shadow-[0_4px_0_#2F3E4E] dark:shadow-[0_4px_0_#020617] no-print">
      <div className="w-8 h-8 mx-auto rounded-full border-2 border-[#2F3E4E] dark:border-slate-600 border-t-[#F9C80E] animate-spin" />
      <p className="font-display font-extrabold text-sm text-[#2F3E4E] dark:text-slate-100">
        Loading {title}...
      </p>
      <p className="text-xs text-[#64748B] dark:text-slate-400">
        Preparing local browser engine (zero server uploads)
      </p>
    </div>
  );
}

interface ToolWorkspaceProps {
  tool: ToolCatalogItem;
  initialBank?: BankId;
  initialSubParam?: string;
  isRouteFullScreen?: boolean;
  isVaultUnlocked?: boolean;
  onToggleRouteFullScreen?: (full: boolean) => void;
  onSyncToolSubParam?: (subParam: string | null) => void;
  backLabel?: string;
  onClose: () => void;
  onOpenCategory?: (category: ToolFilterType) => void;
  onSelectTool: (toolId: string) => void;
  onOpenBankSlipWithBank: (bankId: BankId) => void;
  onOpenDisclaimer?: () => void;
  onOpenPortal?: () => void;
}

const TOOL_GROUPS = [
  'Banking',
  'Tax & GST',
  'Calculator',
  'PDF Suite',
  'Image Studio',
  'Typing & Text',
  'Utilities',
  'VCPL',
  'Special Tools',
  'Learn Tools',
] as const;

export const ToolWorkspace: React.FC<ToolWorkspaceProps> = ({
  tool,
  initialBank,
  initialSubParam,
  isRouteFullScreen = false,
  isVaultUnlocked = false,
  onToggleRouteFullScreen,
  onSyncToolSubParam,
  backLabel,
  onClose,
  onOpenCategory,
  onSelectTool,
  onOpenBankSlipWithBank,
  onOpenDisclaimer,
  onOpenPortal,
}) => {
  const { isAuthenticated, isSuperAdmin, requiresPasswordChange, hasPermission } =
    useEnterpriseAuth();

  const employeeDeniedView =
    isAuthenticated && !isSuperAdmin && !requiresPasswordChange && !hasPermission(tool.id, 'view');

  const effectiveVaultUnlocked =
    isVaultUnlocked ||
    isSuperAdmin ||
    (isAuthenticated && !requiresPasswordChange && hasPermission(tool.id, 'view'));

  const financialDefinition =
    tool.kind === 'financial-calc' ? getFinancialCalculatorById(tool.id) : undefined;
  const articleMeta = getToolArticle(tool);
  const siblingTools = useMemo(
    () => (tool.vaultOnly ? VAULT_TOOLS_CATALOG : getToolsForCategory(tool.category)),
    [tool.category, tool.vaultOnly]
  );
  const categoryCount = siblingTools.length;
  const activeSiblingRef = useRef<HTMLButtonElement | null>(null);
  const siblingScrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [workspaceResetNonce, setWorkspaceResetNonce] = useState(0);
  const [justResetTool, setJustResetTool] = useState(false);

  const handleResetActiveTool = useCallback(() => {
    setWorkspaceResetNonce((n) => n + 1);
    setJustResetTool(true);
    window.setTimeout(() => setJustResetTool(false), 1400);
  }, []);

  const currentSiblingIdx = useMemo(
    () => siblingTools.findIndex((t) => t.id === tool.id),
    [siblingTools, tool.id]
  );

  const updateScrollButtons = useCallback(() => {
    const el = siblingScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  const scrollSiblingBar = useCallback((delta: number) => {
    siblingScrollRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
  }, []);

  const handleStepSibling = useCallback(
    (direction: -1 | 1) => {
      if (siblingTools.length <= 1) return;
      const idx = currentSiblingIdx >= 0 ? currentSiblingIdx : 0;
      const nextIdx = (idx + direction + siblingTools.length) % siblingTools.length;
      onSelectTool(siblingTools[nextIdx].id);
    },
    [currentSiblingIdx, onSelectTool, siblingTools]
  );

  useEffect(() => {
    const container = siblingScrollRef.current;
    const activeEl = activeSiblingRef.current;
    if (container && activeEl) {
      const targetLeft =
        activeEl.offsetLeft - container.clientWidth / 2 + activeEl.offsetWidth / 2;
      container.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });
    }
    const timer = window.setTimeout(updateScrollButtons, 280);
    return () => window.clearTimeout(timer);
  }, [tool.id, updateScrollButtons]);

  useEffect(() => {
    updateScrollButtons();
    const el = siblingScrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateScrollButtons);
      return () => window.removeEventListener('resize', updateScrollButtons);
    }
    let rafId = 0;
    const scheduleUpdate = () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        updateScrollButtons();
      });
    };
    const ro = new ResizeObserver(scheduleUpdate);
    ro.observe(el);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [siblingTools.length, updateScrollButtons]);

  const showIndependentNotice =
    tool.category === 'Banking' ||
    tool.category === 'Tax & GST' ||
    tool.category === 'Calculator' ||
    tool.category === 'VCPL';

  if (employeeDeniedView) {
    return (
      <section className="w-full bg-[#FEF2C8] dark:bg-[#0B1120] py-12 min-h-[calc(100dvh-140px)] flex items-center">
        <div className="max-w-md mx-auto px-4 w-full">
          <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#9E2A2B] rounded-2xl p-6 text-center space-y-4">
            <ShieldAlert className="w-10 h-10 mx-auto text-[#9E2A2B]" />
            <h1 className="font-display font-extrabold text-xl text-[#2F3E4E] dark:text-slate-50">
              Tool Access Not Assigned
            </h1>
            <p className="text-xs text-[#475569] dark:text-slate-300 leading-relaxed">
              Your account does not currently have <strong>View Access</strong> for{' '}
              <strong>{tool.title}</strong> ({tool.code}). Please contact your Super Admin to assign
              permission for this module.
            </p>
            <div className="flex justify-center gap-2">
              {onOpenPortal && (
                <button
                  type="button"
                  onClick={onOpenPortal}
                  className="px-4 py-2 rounded-xl bg-[#2F3E4E] text-[#F9C80E] text-xs font-display font-extrabold cursor-pointer"
                >
                  Open Assigned Workspace
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-[#2F3E4E]/30 text-xs font-bold text-[#2F3E4E] dark:text-slate-200 cursor-pointer"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (isRouteFullScreen && (tool.kind === 'pdf-editor-advanced' || tool.kind === 'letterhead-invoice-maker')) {
    return (
      <Suspense fallback={<ToolEngineFallback title={tool.title} />}>
        <EmbeddedHtmlToolView
          tool={tool}
          isRouteFullScreen
          onExitRouteFullScreen={() => onToggleRouteFullScreen?.(false)}
        />
      </Suspense>
    );
  }

  return (
    <section
      className={`w-full bg-[#FEF2C8] dark:bg-[#0B1120] print:bg-white print:p-0 transition-colors duration-200 ${
        isRouteFullScreen ? 'py-3 min-h-[100dvh]' : 'py-4 sm:py-5 min-h-[calc(100dvh-140px)]'
      }`}
    >
      <div
        className={`${
          isRouteFullScreen ? 'max-w-[1600px]' : 'max-w-[1200px]'
        } mx-auto pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6 space-y-3.5 print:max-w-none print:p-0`}
      >
        {/* Unified Workspace Navigation & Category Switcher */}
        <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-xl overflow-hidden no-print">
          <div className="px-3.5 py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-[#FEF2C8] dark:bg-[#0B1120] hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] dark:text-slate-100 dark:hover:text-[#0F172A] transition cursor-pointer whitespace-nowrap shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{backLabel || 'Back to Tools'}</span>
              </button>

              {tool.vaultOnly ? (
                <button
                  type="button"
                  onClick={onClose}
                  title="Return to Locked Tools Vault"
                  className="inline-flex items-center gap-1.5 px-2.5 h-9 rounded-lg bg-[#9E2A2B] hover:bg-[#7D0B0B] text-[#FFFDF5] text-xs font-bold border border-[#7D0B0B] transition cursor-pointer whitespace-nowrap shrink-0"
                >
                  <span>Locked Vault ({categoryCount})</span>
                  <span className="text-[#F9C80E] font-mono text-[11px]">· {tool.code}</span>
                </button>
              ) : onOpenCategory ? (
                <button
                  type="button"
                  onClick={() => onOpenCategory(tool.category)}
                  title={`View all ${categoryCount} ${tool.category} tools`}
                  className="inline-flex items-center gap-1.5 px-2.5 h-9 rounded-lg bg-[#2F3E4E] dark:bg-slate-800 hover:bg-[#1E293B] dark:hover:bg-slate-700 text-[#FFFDF5] text-xs font-bold border border-transparent dark:border-slate-600 transition cursor-pointer whitespace-nowrap shrink-0"
                >
                  <span>
                    {tool.category === 'Special Tools' ? 'Special' : tool.category} ({categoryCount})
                  </span>
                  <span className="text-[#F9C80E] font-mono text-[11px]">· {tool.code}</span>
                </button>
              ) : (
                <span className="hidden sm:inline-flex items-center px-2.5 h-9 rounded-lg bg-[#2F3E4E] dark:bg-slate-800 text-[#FFFDF5] text-xs font-bold whitespace-nowrap shrink-0">
                  {tool.suite} · {tool.code}
                </span>
              )}

              <span
                title={tool.title}
                className="hidden lg:inline-block text-xs font-semibold text-[#475569] dark:text-slate-300 truncate pl-1"
              >
                {tool.title}
              </span>
            </div>

            {/* Prev/Next + Direct Tool Switcher Dropdown */}
            <div className="flex items-center gap-2 min-w-0 w-full md:w-auto md:justify-end">
              {siblingTools.length > 1 && (
                <div className="inline-flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleStepSibling(-1)}
                    title="Previous tool in suite"
                    aria-label="Previous tool"
                    className="inline-flex items-center justify-center w-9 h-9 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-[#FEF2C8] dark:bg-[#0B1120] hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] text-[#2F3E4E] dark:text-slate-100 dark:hover:text-[#0F172A] transition cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStepSibling(1)}
                    title="Next tool in suite"
                    aria-label="Next tool"
                    className="inline-flex items-center justify-center w-9 h-9 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-[#FEF2C8] dark:bg-[#0B1120] hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] text-[#2F3E4E] dark:text-slate-100 dark:hover:text-[#0F172A] transition cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2 min-w-0 flex-1 md:flex-initial md:w-[250px]">
                <label htmlFor="workspace-tool-switcher" className="sr-only">
                  Switch Tool
                </label>
                <select
                  id="workspace-tool-switcher"
                  value={tool.id}
                  onChange={(e) => onSelectTool(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-semibold text-[#2F3E4E] dark:text-slate-100 focus:outline-none truncate"
                >
                  {tool.vaultOnly ? (
                    <optgroup label="Locked Tools Vault">
                      {VAULT_TOOLS_CATALOG.map((item) => (
                        <option key={item.id} value={item.id}>
                          [{item.code}] {item.title}
                        </option>
                      ))}
                    </optgroup>
                  ) : (
                    TOOL_GROUPS.map((group) => (
                      <optgroup
                        key={group}
                        label={group === 'Special Tools' ? 'Special' : group}
                      >
                        {PUBLIC_TOOLS_CATALOG.filter((t) => t.category === group).map((item) => (
                          <option key={item.id} value={item.id}>
                            [{item.code}] {item.title}
                          </option>
                        ))}
                      </optgroup>
                    ))
                  )}
                </select>
              </div>

              <button
                type="button"
                onClick={handleResetActiveTool}
                title={`Clear and reset ${tool.title} inputs`}
                aria-label="Clear tool workspace"
                className="inline-flex items-center gap-1.5 px-2.5 h-9 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-[#FEF2C8] dark:bg-[#0B1120] hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] dark:text-slate-100 dark:hover:text-[#0F172A] transition cursor-pointer whitespace-nowrap shrink-0"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${justResetTool ? '-rotate-180 transition-transform duration-300' : ''}`} aria-hidden="true" />
                <span className="hidden sm:inline">{justResetTool ? 'Cleared' : 'Clear Tool'}</span>
              </button>

              {isRouteFullScreen ? (
                <button
                  type="button"
                  onClick={() => onToggleRouteFullScreen?.(false)}
                  title="Return to standard page view with guide & FAQs"
                  className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-[#F9C80E] bg-[#2F3E4E] dark:bg-[#F9C80E] hover:bg-[#1E293B] dark:hover:bg-[#FDE047] text-xs font-bold text-[#F9C80E] dark:text-[#0F172A] transition cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Minimize2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Exit Full Browser</span>
                </button>
              ) : (
                <a
                  href={getToolFullPath(tool)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Open ${tool.title} full browser workspace (${getToolFullPath(tool)})`}
                  className="inline-flex items-center gap-1.5 px-2.5 h-9 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] dark:text-slate-100 dark:hover:text-[#0F172A] transition whitespace-nowrap shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Full Tab</span>
                </a>
              )}
            </div>
          </div>

          {/* Integrated Sibling Tool Tabs */}
          {siblingTools.length > 1 && (
            <div
              aria-label={`${tool.category} quick tool switcher`}
              className="border-t border-[#2F3E4E]/15 dark:border-slate-800 bg-[#FEF2C8]/45 dark:bg-[#0F172A] px-3.5 py-2 flex items-center gap-2"
            >
              {(canScrollLeft || canScrollRight) && (
                <button
                  type="button"
                  onClick={() => scrollSiblingBar(-260)}
                  disabled={!canScrollLeft}
                  aria-label="Move previous in tools list"
                  title="Scroll tools list left"
                  className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#131C2E] hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] disabled:opacity-35 text-[#2F3E4E] dark:text-slate-200 dark:hover:text-[#0F172A] transition cursor-pointer disabled:cursor-default shrink-0"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              )}

              <div
                ref={siblingScrollRef}
                onScroll={updateScrollButtons}
                className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth"
              >
                <span className="text-[11px] font-display font-extrabold uppercase tracking-wider text-[#475569] dark:text-slate-400 pr-1 shrink-0">
                  {tool.vaultOnly
                    ? 'Locked Vault:'
                    : tool.category === 'Special Tools'
                    ? 'Special:'
                    : `${tool.category}:`}
                </span>
                {siblingTools.map((sibling) => {
                  const isCurrent = sibling.id === tool.id;
                  return (
                    <button
                      key={sibling.id}
                      ref={isCurrent ? activeSiblingRef : null}
                      type="button"
                      onClick={() => onSelectTool(sibling.id)}
                      aria-current={isCurrent ? 'page' : undefined}
                      className={`inline-flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-xs font-bold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        isCurrent
                          ? 'bg-[#F9C80E] text-[#2F3E4E] border-[#2F3E4E] shadow-[0_1px_0_#2F3E4E]'
                          : 'bg-white dark:bg-[#131C2E] text-[#475569] dark:text-slate-300 border-[#2F3E4E]/20 dark:border-slate-700 hover:bg-[#FFFDF5] dark:hover:bg-slate-800 hover:text-[#2F3E4E] dark:hover:text-white hover:border-[#2F3E4E]/50 dark:hover:border-slate-500'
                      }`}
                    >
                      <span className="font-mono text-[10px] opacity-75">{sibling.code}</span>
                      <span>{sibling.title}</span>
                    </button>
                  );
                })}
              </div>

              {(canScrollLeft || canScrollRight) && (
                <button
                  type="button"
                  onClick={() => scrollSiblingBar(260)}
                  disabled={!canScrollRight}
                  aria-label="Move next in tools list"
                  title="Scroll tools list right"
                  className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#131C2E] hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] disabled:opacity-35 text-[#2F3E4E] dark:text-slate-200 dark:hover:text-[#0F172A] transition cursor-pointer disabled:cursor-default shrink-0"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Independent Financial & Compliance Notice for Banking, Tax & GST, and Financial Calculators */}
        {showIndependentNotice && (
          <div className="bg-[#FFFDF5]/85 dark:bg-[#131C2E] border border-[#2F3E4E]/25 dark:border-slate-700 rounded-xl px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-[#475569] dark:text-slate-300 no-print">
            <div className="flex items-start sm:items-center gap-2 min-w-0">
              <Info className="w-3.5 h-3.5 text-[#2F3E4E] dark:text-[#F9C80E] shrink-0 mt-0.5 sm:mt-0" aria-hidden="true" />
              <p className="leading-snug">
                <strong className="text-[#2F3E4E] dark:text-slate-100">Independent Financial &amp; Compliance Utility Notice:</strong>{' '}
                VCPL Tools operates independently in your browser with zero affiliation to SBI, HDFC
                Bank, the Income Tax Department of India, GSTN, or statutory portals. All generated
                bank deposit slips, Form 26AS &amp; GSTR-2B reconciliations, and TDS/tax calculations
                are standardized preparation templates—independently verify all figures and challans
                before statutory filing or banking submission.
              </p>
            </div>
            {onOpenDisclaimer && (
              <a
                href="/disclaimer"
                onClick={(e) => {
                  e.preventDefault();
                  onOpenDisclaimer();
                }}
                className="font-bold text-[#2F3E4E] dark:text-[#F9C80E] underline underline-offset-2 hover:text-[#12805C] dark:hover:text-emerald-400 whitespace-nowrap shrink-0"
              >
                Read Disclaimer
              </a>
            )}
          </div>
        )}

        {/* Render Active Tool Engine (Lazy Code-Split Chunk) */}
        <Suspense fallback={<ToolEngineFallback title={tool.title} />}>
          <React.Fragment key={`${tool.id}-${workspaceResetNonce}`}>
          {tool.kind === 'bank-slip' && (
            <BankSlipGeneratorView
              initialBank={initialBank}
              defaultOpenBulk={Boolean(tool.defaultOpenBulk)}
              onBack={onClose}
            />
          )}

          {tool.kind === 'unified-calculator' && (
            <UnifiedCalculatorView onClose={onClose} />
          )}

          {tool.kind === 'financial-calc' && financialDefinition && (
            <FinancialCalculatorView
              calculator={financialDefinition}
              onSelectTool={onSelectTool}
            />
          )}

          {tool.kind === 'exam-utility-calc' && (
            <ExamUtilityCalculatorView tool={tool} />
          )}

          {tool.kind === 'tax-26as' && (
            <Form26ASToExcelView tool={tool} onBack={onClose} />
          )}

          {tool.kind === 'tax-gstr2b' && (
            <Gstr2bReconcilerView tool={tool} onBack={onClose} />
          )}

          {tool.kind === 'tax-invoice' && (
            <InvoiceToExcelView tool={tool} onBack={onClose} />
          )}

          {tool.kind === 'tax-invoice-maker' && (
            <InvoiceQuotationMakerView tool={tool} onBack={onClose} />
          )}

          {tool.kind === 'tax-regime' && (
            <TaxCalculatorView tool={tool} onBack={onClose} />
          )}

          {tool.kind === 'pdf-engine' && (
            <PdfEngineView tool={tool} />
          )}

          {tool.kind === 'pdf-converter' && (
            <PdfConverterView tool={tool} />
          )}

          {tool.kind === 'pdf-form-filler' && (
            <PdfFormFillerView tool={tool} />
          )}

          {tool.kind === 'image-studio' && (
            <ImageStudioView tool={tool} />
          )}

          {tool.kind === 'utility-engine' && (
            <UtilityEngineView tool={tool} />
          )}

          {tool.kind === 'number-to-words' && (
            <NumberToWordsView tool={tool} onBack={onClose} />
          )}

          {tool.kind === 'typing-engine' && (
            <TypingEngineView tool={tool} />
          )}

          {tool.kind === 'dms-tally-reconciler' && (
            <DmsTallyReconcilerView tool={tool} onBack={onClose} />
          )}

          {tool.kind === 'parts-billing-reconciler' && (
            <PartsBillingReconcilerView tool={tool} onBack={onClose} />
          )}

          {tool.kind === 'swatchbook-color-picker' && (
            <SwatchbookColorPickerView tool={tool} />
          )}

          {tool.kind === 'tds-tcs-toolkit' && (
            <TdsTcsToolkitView tool={tool} />
          )}

          {tool.kind === 'income-tax-fy2627' && (
            <IncomeTaxFy2627View tool={tool} onBack={onClose} />
          )}

          {tool.kind === 'incentive-report-tool' && (
            <IncentiveReportToolView
              key={tool.id}
              tool={tool}
              isVaultUnlocked={effectiveVaultUnlocked}
              onBack={onClose}
            />
          )}

          {tool.kind === 'pdf-editor-advanced' && (
            <EmbeddedHtmlToolView tool={tool} />
          )}

          {tool.kind === 'tcs-tax-calculator' && (
            <TcsTaxCalculatorView tool={tool} onBack={onClose} />
          )}

          {tool.kind === 'rent-payment-letter-maker' && (
            <RentPaymentLetterMakerView tool={tool} onBack={onClose} />
          )}

          {tool.kind === 'dbs-pnl-reports' && (
            <DbsPnlReportsView
              key={tool.id}
              tool={tool}
              isVaultUnlocked={effectiveVaultUnlocked}
              onBack={onClose}
            />
          )}

          {tool.kind === 'gstr1-return-prep' && (
            <Gstr1ReturnPrepView tool={tool} onBack={onClose} />
          )}

          {tool.kind === 'bmw-statement-reconciler' && (
            <BmwStatementReconcilerView
              key={tool.id}
              tool={tool}
              isVaultUnlocked={effectiveVaultUnlocked}
              onBack={onClose}
            />
          )}

          {tool.kind === 'bmw-vendor-ledger-reconciler' && (
            <BmwVendorLedgerReconcilerView
              key={tool.id}
              tool={tool}
              isVaultUnlocked={effectiveVaultUnlocked}
              onBack={onClose}
            />
          )}

          {tool.kind === 'bmw-claims-reconciler' && (
            <BmwClaimsReconcilerView
              key={tool.id}
              tool={tool}
              isVaultUnlocked={effectiveVaultUnlocked}
              onBack={onClose}
            />
          )}

          {tool.kind === 'vcpl-rtgs-neft-form' && (
            <VcplRtgsNeftFormView
              key={tool.id}
              tool={tool}
              isVaultUnlocked={effectiveVaultUnlocked}
              onBack={onClose}
            />
          )}

          {tool.kind === 'tds-26as-tally-reco' && (
            <Tds26asTallyRecoView
              key={tool.id}
              tool={tool}
              isVaultUnlocked={effectiveVaultUnlocked}
              onBack={onClose}
            />
          )}

          {tool.kind === 'bajaj-reconciliation-desk' && (
            <BajajReconciliationView
              key={tool.id}
              tool={tool}
              isVaultUnlocked={effectiveVaultUnlocked}
              onBack={onClose}
            />
          )}

          {tool.kind === 'fuel-report-generator' && (
            <FuelReportGeneratorView
              key={tool.id}
              tool={tool}
              isVaultUnlocked={effectiveVaultUnlocked}
              onBack={onClose}
            />
          )}

          {tool.kind === 'covering-letter-generator' && (
            <CoveringLetterGeneratorView
              key={tool.id}
              tool={tool}
              isVaultUnlocked={effectiveVaultUnlocked}
              onBack={onClose}
            />
          )}

          {tool.kind === 'letterhead-invoice-maker' && (
            <EmbeddedHtmlToolView tool={tool} />
          )}

          {tool.kind === 'textlift-ocr-pro' && (
            <TextliftOcrProView key={tool.id} tool={tool} />
          )}

          {tool.kind === 'bank-directory' && (
            <BankDirectoryToolView
              onLaunchSlipGenerator={onOpenBankSlipWithBank}
              initialIfsc={initialSubParam}
              onSyncUrlIfsc={onSyncToolSubParam}
            />
          )}

          {tool.kind === 'tax-banking-extra' && (
            <TaxBankingExtraView key={tool.id} tool={tool} />
          )}

          {tool.kind === 'pdf-advanced-suite' && (
            <PdfAdvancedSuiteView key={tool.id} tool={tool} />
          )}

          {tool.kind === 'spreadsheet-studio' && (
            <SpreadsheetStudioView key={tool.id} tool={tool} />
          )}

          {tool.kind === 'image-pro-suite' && (
            <ImageProSuiteView key={tool.id} tool={tool} />
          )}

          {tool.kind === 'productivity-dev-suite' && (
            <ProductivityDevSuiteView key={tool.id} tool={tool} />
          )}

          {tool.kind === 'rto-code-finder' && (
            <RtoCodeFinderView
              initialCode={initialSubParam}
              isVaultUnlocked={effectiveVaultUnlocked}
              onSyncUrlCode={onSyncToolSubParam}
              onBack={onClose}
            />
          )}

          {tool.kind === 'pin-code-finder' && (
            <PinCodeFinderView
              initialPincode={initialSubParam}
              onSyncUrlPincode={onSyncToolSubParam}
            />
          )}

          {tool.kind === 'database-file-compressor' && (
            <DatabaseFileCompressorView key={tool.id} tool={tool} onBack={onClose} />
          )}

          {tool.kind === 'tulusiri-pro' && (
            <TulusiriProView key={tool.id} tool={tool} onBack={onClose} />
          )}

          {tool.kind === 'keyboard-shortcuts' && (
            <KeyboardShortcutsView key={tool.id} tool={tool} />
          )}

          {tool.kind === 'tally-shortcuts' && (
            <TallyShortcutsView key={tool.id} tool={tool} />
          )}

          {tool.kind === 'google-workspace' && (
            <GoogleWorkspaceSuiteView key={tool.id} tool={tool} />
          )}
          </React.Fragment>
        </Suspense>

        {!isRouteFullScreen && (
          <>
            <AdSlot
              slotId={`vcpl-workspace-mid-${tool.code.toLowerCase()}`}
              variant="compact-strip"
              label={`Tool Workspace Partner Strip · ${tool.suite}`}
              contentContext={articleMeta.adTopic}
            />

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
              <div className="xl:col-span-8 min-w-0">
                <ToolArticleSection tool={tool} />
              </div>
              <div className="xl:col-span-4 space-y-4 xl:sticky xl:top-24 no-print">
                <AdSlot
                  slotId={`vcpl-workspace-sidebar-${tool.code.toLowerCase()}`}
                  variant="sidebar"
                  label="300 × 250 / 300 × 600 Tool Guide Sidebar"
                  contentContext={articleMeta.adTopic}
                />
              </div>
            </div>

            <AdSlot
              slotId={`vcpl-workspace-${tool.code.toLowerCase()}`}
              variant="workspace"
              label={`Tool Workspace Contextual Ad · ${tool.suite}`}
              contentContext={articleMeta.adTopic}
            />

            <AdSlot
              slotId={`vcpl-workspace-dual-${tool.code.toLowerCase()}`}
              variant="dual"
              contentContext={articleMeta.adTopic}
            />

            <AdSlot
              slotId={`vcpl-workspace-multiplex-${tool.code.toLowerCase()}`}
              variant="multiplex"
              contentContext={articleMeta.adTopic}
            />
          </>
        )}
      </div>
    </section>
  );
};
