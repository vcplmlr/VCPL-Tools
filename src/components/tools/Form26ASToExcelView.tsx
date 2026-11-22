import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardPaste,
  Download,
  Eye,
  EyeOff,
  FileCode2,
  FileSpreadsheet,
  FileText,
  Info,
  Lock,
  Printer,
  RotateCcw,
  Search,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { ToolCatalogItem } from '../../types/tools';
import { emitGlobalProgress } from '../TopLoadingBar';
import { buildForm26ASWorkbook } from '../../utils/form26asExcelBuilder';
import {
  FISCAL_MONTH_ORDER,
  ParsedForm26AS,
  classify26ASTaxType,
  getFiscalMonthLabel,
  getFiscalQuarter,
  getSectionDescription,
  lookupSectionMeta,
  parseForm26ASLines,
  parseForm26ASTextFile,
  parseForm26ASWorkbookFile,
} from '../../utils/form26asParser';
import { formatINR } from '../../utils/numberToWords';
import { PdfPasswordError, extractTextFromPdf } from '../../utils/pdfExtractor';
import {
  downloadBomCsv,
  downloadJsonFile,
  downloadWordDocument,
  exportStructuredReportPdf,
  printHtmlDocument,
} from '../../utils/printReport';
import { FileDropZone } from './FileDropZone';

interface Form26ASToExcelViewProps {
  tool?: ToolCatalogItem;
  onBack?: () => void;
}

type PreviewTab =
  | 'executive'
  | 'tds'
  | 'tcs'
  | 'parties'
  | 'sections'
  | 'transactions'
  | 'audit'
  | 'challans';

interface ProgressState {
  pct: number;
  stage: string;
  detail?: string;
}

const calcEffRatePct = (tax: number, paid: number): string => {
  if (!paid || Math.abs(paid) < 0.01) return '0.00%';
  return `${((tax / paid) * 100).toFixed(2)}%`;
};

export const Form26ASToExcelView: React.FC<Form26ASToExcelViewProps> = ({ tool, onBack }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileSizeKb, setFileSizeKb] = useState<number>(0);
  const [fileName, setFileName] = useState<string>('');
  const [pdfPassword, setPdfPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const [showPasteBox, setShowPasteBox] = useState<boolean>(false);
  const [pastedText, setPastedText] = useState<string>('');

  const [includeExecutiveSummary, setIncludeExecutiveSummary] = useState<boolean>(true);
  const [includeSeparateTdsTcsSheets, setIncludeSeparateTdsTcsSheets] = useState<boolean>(true);
  const [includeCombinedSheet, setIncludeCombinedSheet] = useState<boolean>(true);
  const [includePartySheets, setIncludePartySheets] = useState<boolean>(false);
  const [includeSectionQuarterSummary, setIncludeSectionQuarterSummary] = useState<boolean>(true);
  const [includeAuditSheet, setIncludeAuditSheet] = useState<boolean>(true);

  const [parsed, setParsed] = useState<ParsedForm26AS | null>(null);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [progressState, setProgressState] = useState<ProgressState | null>(null);
  const [needsPassword, setNeedsPassword] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [statusMsg, setStatusMsg] = useState<string>('');

  const [activeTab, setActiveTab] = useState<PreviewTab>('executive');
  const [partyQuery, setPartyQuery] = useState<string>('');
  const [txQuery, setTxQuery] = useState<string>('');
  const [partFilter, setPartFilter] = useState<string>('ALL');
  const [quarterFilter, setQuarterFilter] = useState<string>('ALL');
  const [natureFilter, setNatureFilter] = useState<'ALL' | 'Credit' | 'Reversal'>('ALL');
  const [taxRoleFilter, setTaxRoleFilter] = useState<'ALL' | 'TDS' | 'TCS'>('ALL');
  const [bookingFilter, setBookingFilter] = useState<'ALL' | 'F' | 'OTHER'>('ALL');
  const [sectionRoleFilter, setSectionRoleFilter] = useState<'ALL' | 'TDS' | 'TCS'>('ALL');

  const isValidPan = (p: string) => /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(p.trim());

  const getFileBaseTag = (data: ParsedForm26AS) => {
    const safePan = data.pan && data.pan !== 'NOT DETECTED' ? data.pan : 'TAXPAYER';
    const fileYearTag =
      data.yearScheme === 'tax_year' ? `TY${data.taxYear}` : `AY${data.assessmentYear}`;
    return `Form26AS-${safePan}-${fileYearTag}`;
  };

  const getYearHeaderLabel = (data: ParsedForm26AS) =>
    data.yearScheme === 'tax_year'
      ? `Tax Year ${data.taxYear} (FY ${data.financialYear})`
      : `FY ${data.financialYear} · AY ${data.assessmentYear}`;

  const updateProgress = (pct: number, stage: string, detail?: string) => {
    const clamped = Math.min(100, Math.max(0, Math.round(pct)));
    setProgressState({ pct: clamped, stage, detail });
    emitGlobalProgress(true, clamped);
  };

  const finishProgress = () => {
    emitGlobalProgress(false, 100);
    window.setTimeout(() => {
      setProgressState(null);
    }, 350);
  };

  const runParseFile = async (file: File, passwordOverride?: string) => {
    setErrorMsg('');
    setStatusMsg('');
    setNeedsPassword(false);
    setIsParsing(true);
    updateProgress(8, 'Reading Form 26AS file locally...', file.name);

    try {
      const lowerName = file.name.toLowerCase();
      let data: ParsedForm26AS;
      let sourceLabel = 'TRACES PDF';

      if (lowerName.endsWith('.txt')) {
        sourceLabel = 'TRACES Text (.txt)';
        updateProgress(45, 'Parsing TRACES caret/text lines...', file.name);
        const rawText = await file.text();
        data = parseForm26ASTextFile(rawText, 'traces-txt');
      } else if (
        lowerName.endsWith('.xlsx') ||
        lowerName.endsWith('.xls') ||
        lowerName.endsWith('.csv')
      ) {
        sourceLabel = lowerName.endsWith('.csv') ? 'CSV Statement' : 'Excel Workbook';
        updateProgress(45, `Reading ${sourceLabel} sheets...`, file.name);
        const buf = await file.arrayBuffer();
        data = await parseForm26ASWorkbookFile(buf, file.name);
      } else {
        const buf = await file.arrayBuffer();
        updateProgress(12, 'Unlocking PDF document...', file.name);
        const { allLines, numPages } = await extractTextFromPdf(buf, {
          password: passwordOverride ?? pdfPassword,
          onProgress: (page, total) => {
            const pct = Math.round(14 + (page / Math.max(1, total)) * 74);
            updateProgress(
              pct,
              `Extracting Form 26AS PDF · Page ${page} of ${total}`,
              `${Math.round((page / Math.max(1, total)) * 100)}% of ${total} pages`
            );
          },
        });
        updateProgress(92, 'Reconciling Parties, TAN/PAN & Statutory Sections...', `${allLines.length} lines`);
        data = parseForm26ASLines(allLines, numPages, 'pdf');
      }

      updateProgress(100, 'Statement verified & ready', `${data.parties.length} parties · ${data.transactions.length} txns`);
      setParsed(data);
      setActiveTab('executive');
      setPartyQuery('');
      setTxQuery('');
      setPartFilter('ALL');
      setQuarterFilter('ALL');
      setNatureFilter('ALL');
      setTaxRoleFilter('ALL');
      setBookingFilter('ALL');
      setSectionRoleFilter('ALL');

      if (data.parties.length === 0 && data.transactions.length === 0 && data.challans.length === 0) {
        setErrorMsg(
          `No TDS/TCS deductor or collector entries were detected in this ${sourceLabel}. Ensure it is an official TRACES Form 26AS PDF/Text/Excel file (not a scanned image).`
        );
      } else {
        const verifiedCount = data.parties.filter((p) => p.verificationStatus === 'Verified').length;
        const panDetectedCount = data.parties.filter((p) => p.partyPan && p.partyPan !== '-').length;
        setStatusMsg(
          `Parsed ${sourceLabel} (${data.pageCount} page/sheet): ${data.parties.length} party account(s) [${verifiedCount}/${data.parties.length} verified · ${panDetectedCount} with PAN], ${data.transactions.length} transaction(s)${
            data.challans.length > 0 ? `, and ${data.challans.length} challan(s)` : ''
          }.`
        );
      }
    } catch (err) {
      if (err instanceof PdfPasswordError) {
        setNeedsPassword(true);
        setErrorMsg(err.message);
        setParsed(null);
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Unable to read Form 26AS file.');
      }
    } finally {
      setIsParsing(false);
      finishProgress();
    }
  };

  const handleSelectFile = async (file: File) => {
    setSelectedFile(file);
    setFileName(file.name);
    setFileSizeKb(Math.max(1, Math.round(file.size / 1024)));
    await runParseFile(file);
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleSelectFile(file);
    }
    e.target.value = '';
  };

  const handleParsePastedText = () => {
    const raw = pastedText.trim();
    if (!raw) {
      setErrorMsg('Paste TRACES Form 26AS text or caret (^) delimited lines before parsing.');
      return;
    }
    setErrorMsg('');
    setSelectedFile(null);
    setFileName('Pasted_TRACES_26AS_Text.txt');
    setFileSizeKb(Math.max(1, Math.round(raw.length / 1024)));
    setNeedsPassword(false);

    const data = parseForm26ASTextFile(raw, 'pasted-text');
    setParsed(data);
    setActiveTab('executive');
    setPartyQuery('');
    setTxQuery('');
    setPartFilter('ALL');
    setQuarterFilter('ALL');
    setNatureFilter('ALL');
    setTaxRoleFilter('ALL');
    setBookingFilter('ALL');
    setSectionRoleFilter('ALL');

    if (data.parties.length === 0 && data.transactions.length === 0 && data.challans.length === 0) {
      setErrorMsg(
        'Could not detect Form 26AS parties or transactions from the pasted text. Include TAN lines and transaction rows (or TRACES ^ caret-delimited lines).'
      );
    } else {
      setStatusMsg(
        `Parsed pasted data: ${data.parties.length} party account(s), ${data.transactions.length} transaction(s).`
      );
    }
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setFileName('');
    setFileSizeKb(0);
    setPdfPassword('');
    setPastedText('');
    setParsed(null);
    setNeedsPassword(false);
    setErrorMsg('');
    setStatusMsg('');
    setPartyQuery('');
    setTxQuery('');
    setPartFilter('ALL');
    setQuarterFilter('ALL');
    setNatureFilter('ALL');
    setTaxRoleFilter('ALL');
    setBookingFilter('ALL');
    setSectionRoleFilter('ALL');
    setProgressState(null);
  };

  const handleConvertToExcel = async (scope: 'all' | 'tds' | 'tcs' = 'all') => {
    if (
      !includeExecutiveSummary &&
      !includeSeparateTdsTcsSheets &&
      !includeCombinedSheet &&
      !includePartySheets &&
      !includeSectionQuarterSummary &&
      !includeAuditSheet
    ) {
      setErrorMsg('Select at least one Excel Output Structure option below before converting.');
      return;
    }

    if (!parsed) {
      if (selectedFile) {
        await runParseFile(selectedFile);
      } else {
        setErrorMsg('Please upload a Form 26AS file (PDF, TXT, Excel, or CSV) first.');
      }
      return;
    }

    if (parsed.transactions.length === 0 && parsed.challans.length === 0) {
      setErrorMsg('No extractable rows available to export.');
      return;
    }

    setErrorMsg('');
    setIsExporting(true);
    const scopeLabel =
      scope === 'tds' ? 'TDS-Only' : scope === 'tcs' ? 'TCS-Only' : 'Master Bifurcated';
    updateProgress(10, `Preparing ${scopeLabel} Excel workbook...`, `${parsed.transactions.length} txns`);
    try {
      const buffer = await buildForm26ASWorkbook(parsed, {
        includeExecutiveSummary,
        includeSeparateTdsTcsSheets,
        includeCombinedSheet,
        includePartySheets,
        includeSectionQuarterSummary,
        includeAuditSheet,
        taxScope: scope,
        onProgress: (pct, stage) => {
          updateProgress(pct, stage, `${parsed.parties.length} parties`);
        },
      });
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const suffix =
        scope === 'tds' ? '-TDS-Only' : scope === 'tcs' ? '-TCS-Only' : '-Bifurcated';
      a.download = `${getFileBaseTag(parsed)}${suffix}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.setTimeout(() => URL.revokeObjectURL(url), 1200);

      const sheetsIncluded = [
        includeExecutiveSummary ? 'Executive Summary' : '',
        includeSeparateTdsTcsSheets ? 'Separate TDS/TCS Schedules' : '',
        includeCombinedSheet ? '26AS Combined' : '',
        includePartySheets ? 'Party-wise Sheets' : '',
        includeSectionQuarterSummary ? 'Section, Quarter & Monthly Audit' : '',
        includeAuditSheet ? 'Audit & Exceptions' : '',
      ].filter(Boolean);

      setStatusMsg(`Exported ${scopeLabel} Excel (.xlsx): ${sheetsIncluded.join(' + ')}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to generate Excel workbook.');
    } finally {
      setIsExporting(false);
      finishProgress();
    }
  };

  const totals = useMemo(() => {
    const emptyRole = {
      parties: 0,
      txns: 0,
      revs: 0,
      grossPaid: 0,
      revPaid: 0,
      netPaid: 0,
      grossTax: 0,
      revTax: 0,
      netTax: 0,
      dep: 0,
      shortDiff: 0,
      official: undefined as number | undefined,
    };
    if (!parsed) {
      return {
        amountPaid: 0,
        taxDeducted: 0,
        tdsDeposited: 0,
        grossPaid: 0,
        reversalPaid: 0,
        grossTax: 0,
        reversalTax: 0,
        tdsTotal: 0,
        tcsTotal: 0,
        verifiedParties: 0,
        varianceParties: 0,
        missingPanParties: 0,
        reversalsCount: 0,
        officialReconStatus: 'none' as 'none' | 'matched' | 'diff',
        officialDiff: 0,
        tdsMetrics: { ...emptyRole },
        tcsMetrics: { ...emptyRole },
      };
    }

    const computeRoleMetrics = (role: 'TDS' | 'TCS') => {
      const roleTxs = parsed.transactions.filter((t) => classify26ASTaxType(t) === role);
      const roleParties = parsed.parties.filter((p) => classify26ASTaxType(p) === role);
      let grossPaid = 0;
      let revPaid = 0;
      let netPaid = 0;
      let grossTax = 0;
      let revTax = 0;
      let netTax = 0;
      let dep = 0;
      let revs = 0;
      roleTxs.forEach((tx) => {
        const isRev = tx.entryNature === 'Reversal' || tx.amountPaid < 0 || tx.taxDeducted < 0;
        if (isRev) {
          revs += 1;
          revPaid += tx.amountPaid;
          revTax += tx.taxDeducted;
        } else {
          grossPaid += tx.amountPaid;
          grossTax += tx.taxDeducted;
        }
        netPaid += tx.amountPaid;
        netTax += tx.taxDeducted;
        dep += tx.tdsDeposited;
      });
      const r2 = (n: number) => Number(n.toFixed(2));
      const nTax = r2(netTax);
      const nDep = r2(dep);
      return {
        parties: roleParties.length,
        txns: roleTxs.length,
        revs,
        grossPaid: r2(grossPaid),
        revPaid: r2(revPaid),
        netPaid: r2(netPaid),
        grossTax: r2(grossTax),
        revTax: r2(revTax),
        netTax: nTax,
        dep: nDep,
        shortDiff: r2(nTax - nDep),
        official:
          role === 'TDS'
            ? parsed.officialSummary?.summaryTds
            : parsed.officialSummary?.summaryTcs,
      };
    };

    const tdsMetrics = computeRoleMetrics('TDS');
    const tcsMetrics = computeRoleMetrics('TCS');

    const amountPaid = Number((tdsMetrics.netPaid + tcsMetrics.netPaid).toFixed(2));
    const taxDeducted = Number((tdsMetrics.netTax + tcsMetrics.netTax).toFixed(2));
    const tdsDeposited = Number((tdsMetrics.dep + tcsMetrics.dep).toFixed(2));
    const grossPaid = Number((tdsMetrics.grossPaid + tcsMetrics.grossPaid).toFixed(2));
    const reversalPaid = Number((tdsMetrics.revPaid + tcsMetrics.revPaid).toFixed(2));
    const grossTax = Number((tdsMetrics.grossTax + tcsMetrics.grossTax).toFixed(2));
    const reversalTax = Number((tdsMetrics.revTax + tcsMetrics.revTax).toFixed(2));
    const tdsTotal = tdsMetrics.netTax;
    const tcsTotal = tcsMetrics.netTax;

    const verifiedParties = parsed.parties.filter(
      (p) => p.verificationStatus === 'Verified'
    ).length;
    const varianceParties = parsed.parties.filter(
      (p) => p.verificationStatus === 'Subtotal Variance'
    ).length;
    const missingPanParties = parsed.parties.filter(
      (p) => !p.partyPan || p.partyPan === '-'
    ).length;
    const reversalsCount = parsed.transactions.filter(
      (t) =>
        t.entryNature === 'Reversal' ||
        t.amountPaid < 0 ||
        t.taxDeducted < 0 ||
        t.tdsDeposited < 0 ||
        /^(?:G|B)$/i.test(t.remarks.trim())
    ).length;

    let officialReconStatus: 'none' | 'matched' | 'diff' = 'none';
    let officialDiff = 0;
    const offTds = parsed.officialSummary?.summaryTds;
    const offTcs = parsed.officialSummary?.summaryTcs;
    if (offTds !== undefined || offTcs !== undefined) {
      const expectedTotal = Number(((offTds ?? 0) + (offTcs ?? 0)).toFixed(2));
      officialDiff = Number((expectedTotal - taxDeducted).toFixed(2));
      officialReconStatus = Math.abs(officialDiff) <= 1 ? 'matched' : 'diff';
    }

    return {
      amountPaid,
      taxDeducted,
      tdsDeposited,
      grossPaid,
      reversalPaid,
      grossTax,
      reversalTax,
      tdsTotal,
      tcsTotal,
      verifiedParties,
      varianceParties,
      missingPanParties,
      reversalsCount,
      officialReconStatus,
      officialDiff,
      tdsMetrics,
      tcsMetrics,
    };
  }, [parsed]);

  const sectionBreakdown = useMemo(() => {
    if (!parsed) return [];
    const map = new Map<
      string,
      {
        part: string;
        section: string;
        role: 'TDS' | 'TCS';
        txns: number;
        revs: number;
        grossPaid: number;
        revPaid: number;
        paid: number;
        tax: number;
        dep: number;
      }
    >();
    parsed.transactions.forEach((tx) => {
      const role = classify26ASTaxType(tx);
      const k = `${tx.part}::${tx.section}`;
      const isRev = tx.entryNature === 'Reversal' || tx.amountPaid < 0 || tx.taxDeducted < 0;
      const prev = map.get(k);
      if (prev) {
        prev.txns += 1;
        if (isRev) {
          prev.revs += 1;
          prev.revPaid = Number((prev.revPaid + tx.amountPaid).toFixed(2));
        } else {
          prev.grossPaid = Number((prev.grossPaid + tx.amountPaid).toFixed(2));
        }
        prev.paid = Number((prev.paid + tx.amountPaid).toFixed(2));
        prev.tax = Number((prev.tax + tx.taxDeducted).toFixed(2));
        prev.dep = Number((prev.dep + tx.tdsDeposited).toFixed(2));
      } else {
        map.set(k, {
          part: tx.part,
          section: tx.section,
          role,
          txns: 1,
          revs: isRev ? 1 : 0,
          grossPaid: isRev ? 0 : Number(tx.amountPaid.toFixed(2)),
          revPaid: isRev ? Number(tx.amountPaid.toFixed(2)) : 0,
          paid: Number(tx.amountPaid.toFixed(2)),
          tax: Number(tx.taxDeducted.toFixed(2)),
          dep: Number(tx.tdsDeposited.toFixed(2)),
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.tax - a.tax);
  }, [parsed]);

  const filteredSectionBreakdown = useMemo(() => {
    if (sectionRoleFilter === 'ALL') return sectionBreakdown;
    return sectionBreakdown.filter((s) => s.role === sectionRoleFilter);
  }, [sectionBreakdown, sectionRoleFilter]);

  const quarterBreakdown = useMemo(() => {
    if (!parsed) return [];
    const order = ['Q1 (Apr-Jun)', 'Q2 (Jul-Sep)', 'Q3 (Oct-Dec)', 'Q4 (Jan-Mar)', 'Other / Unspecified'];
    const map = new Map<
      string,
      { quarter: string; txns: number; revs: number; paid: number; tds: number; tcs: number; dep: number }
    >();
    order.forEach((q) =>
      map.set(q, { quarter: q, txns: 0, revs: 0, paid: 0, tds: 0, tcs: 0, dep: 0 })
    );
    parsed.transactions.forEach((tx) => {
      const q = getFiscalQuarter(tx.transactionDate);
      const item = map.get(q)!;
      item.txns += 1;
      if (tx.entryNature === 'Reversal' || tx.amountPaid < 0) item.revs += 1;
      item.paid = Number((item.paid + tx.amountPaid).toFixed(2));
      if (classify26ASTaxType(tx) === 'TCS') {
        item.tcs = Number((item.tcs + tx.taxDeducted).toFixed(2));
      } else {
        item.tds = Number((item.tds + tx.taxDeducted).toFixed(2));
      }
      item.dep = Number((item.dep + tx.tdsDeposited).toFixed(2));
    });
    return order
      .map((q) => map.get(q)!)
      .filter((q) => q.quarter !== 'Other / Unspecified' || q.txns > 0);
  }, [parsed]);

  const monthlyBreakdown = useMemo(() => {
    if (!parsed) return [];
    const monthQuarterMap: Record<string, string> = {
      Apr: 'Q1 (Apr-Jun)',
      May: 'Q1 (Apr-Jun)',
      Jun: 'Q1 (Apr-Jun)',
      Jul: 'Q2 (Jul-Sep)',
      Aug: 'Q2 (Jul-Sep)',
      Sep: 'Q2 (Jul-Sep)',
      Oct: 'Q3 (Oct-Dec)',
      Nov: 'Q3 (Oct-Dec)',
      Dec: 'Q3 (Oct-Dec)',
      Jan: 'Q4 (Jan-Mar)',
      Feb: 'Q4 (Jan-Mar)',
      Mar: 'Q4 (Jan-Mar)',
    };
    const allLabels = [...FISCAL_MONTH_ORDER, 'Unspecified'];
    const map = new Map<
      string,
      {
        month: string;
        quarter: string;
        tdsTxns: number;
        tdsPaid: number;
        tdsTax: number;
        tdsDep: number;
        tcsTxns: number;
        tcsPaid: number;
        tcsTax: number;
        tcsDep: number;
      }
    >();
    allLabels.forEach((m) =>
      map.set(m, {
        month: m,
        quarter: monthQuarterMap[m] || 'Other / Unspecified',
        tdsTxns: 0,
        tdsPaid: 0,
        tdsTax: 0,
        tdsDep: 0,
        tcsTxns: 0,
        tcsPaid: 0,
        tcsTax: 0,
        tcsDep: 0,
      })
    );
    parsed.transactions.forEach((tx) => {
      const m = getFiscalMonthLabel(tx.transactionDate);
      const row = map.get(m) ?? map.get('Unspecified')!;
      if (classify26ASTaxType(tx) === 'TCS') {
        row.tcsTxns += 1;
        row.tcsPaid = Number((row.tcsPaid + tx.amountPaid).toFixed(2));
        row.tcsTax = Number((row.tcsTax + tx.taxDeducted).toFixed(2));
        row.tcsDep = Number((row.tcsDep + tx.tdsDeposited).toFixed(2));
      } else {
        row.tdsTxns += 1;
        row.tdsPaid = Number((row.tdsPaid + tx.amountPaid).toFixed(2));
        row.tdsTax = Number((row.tdsTax + tx.taxDeducted).toFixed(2));
        row.tdsDep = Number((row.tdsDep + tx.tdsDeposited).toFixed(2));
      }
    });
    return allLabels
      .map((m) => map.get(m)!)
      .filter((m) => m.tdsTxns + m.tcsTxns > 0);
  }, [parsed]);

  const bookingStatusSummary = useMemo(() => {
    if (!parsed) return [];
    const order = ['Final (F)', 'Unmatched (U)', 'Overbooked (O)', 'Provisional (P)', 'Other'];
    const map = new Map<
      string,
      { status: string; tdsTxns: number; tdsTax: number; tcsTxns: number; tcsTax: number; dep: number }
    >();
    order.forEach((s) =>
      map.set(s, { status: s, tdsTxns: 0, tdsTax: 0, tcsTxns: 0, tcsTax: 0, dep: 0 })
    );
    parsed.transactions.forEach((tx) => {
      const raw = (tx.bookingStatus || '').trim().toUpperCase();
      const key =
        raw === 'F' || raw === 'FINAL' || raw === 'M' || raw === 'MATCHED'
          ? 'Final (F)'
          : raw === 'U' || raw === 'UNMATCHED'
            ? 'Unmatched (U)'
            : raw === 'O' || raw === 'OVERBOOKED'
              ? 'Overbooked (O)'
              : raw === 'P' || raw === 'PROVISIONAL'
                ? 'Provisional (P)'
                : 'Other';
      const item = map.get(key)!;
      if (classify26ASTaxType(tx) === 'TCS') {
        item.tcsTxns += 1;
        item.tcsTax = Number((item.tcsTax + tx.taxDeducted).toFixed(2));
      } else {
        item.tdsTxns += 1;
        item.tdsTax = Number((item.tdsTax + tx.taxDeducted).toFixed(2));
      }
      item.dep = Number((item.dep + tx.tdsDeposited).toFixed(2));
    });
    return order.map((s) => map.get(s)!).filter((x) => x.tdsTxns + x.tcsTxns > 0);
  }, [parsed]);

  const reversalTransactions = useMemo(() => {
    if (!parsed) return [];
    return parsed.transactions.filter(
      (t) =>
        t.entryNature === 'Reversal' ||
        t.amountPaid < 0 ||
        t.taxDeducted < 0 ||
        t.tdsDeposited < 0 ||
        /^(?:G|B)$/i.test(t.remarks.trim())
    );
  }, [parsed]);

  const shortDepositOrUnmatchedTxs = useMemo(() => {
    if (!parsed) return [];
    return parsed.transactions.filter((tx) => {
      const notFinal = !/^(?:F|M|Final|Matched)$/i.test((tx.bookingStatus || '').trim());
      const diff = Math.abs(tx.taxDeducted - tx.tdsDeposited) > 1;
      return notFinal || diff;
    });
  }, [parsed]);

  const rateVarianceTxs = useMemo(() => {
    if (!parsed) return [];
    return parsed.transactions.filter((tx) => {
      if (tx.entryNature === 'Reversal' || tx.amountPaid <= 0) return false;
      const meta = lookupSectionMeta(tx.section);
      if (meta.standardRatePct === null) return false;
      const effPct = (tx.taxDeducted / tx.amountPaid) * 100;
      return Math.abs(effPct - meta.standardRatePct) > 2.5;
    });
  }, [parsed]);

  const missingPanList = useMemo(() => {
    if (!parsed) return [];
    return parsed.parties.filter((p) => !p.partyPan || p.partyPan === '-');
  }, [parsed]);

  const tdsPartiesRaw = useMemo(
    () => (parsed ? parsed.parties.filter((p) => classify26ASTaxType(p) === 'TDS') : []),
    [parsed]
  );

  const tcsPartiesRaw = useMemo(
    () => (parsed ? parsed.parties.filter((p) => classify26ASTaxType(p) === 'TCS') : []),
    [parsed]
  );

  const filteredParties = useMemo(() => {
    if (!parsed) return [];
    const q = partyQuery.trim().toLowerCase();
    if (!q) return parsed.parties;
    return parsed.parties.filter((p) =>
      `${p.partyName} ${p.tan} ${p.partyPan} ${p.part}`.toLowerCase().includes(q)
    );
  }, [parsed, partyQuery]);

  const tdsParties = useMemo(() => {
    const q = partyQuery.trim().toLowerCase();
    if (!q) return tdsPartiesRaw;
    return tdsPartiesRaw.filter((p) =>
      `${p.partyName} ${p.tan} ${p.partyPan} ${p.part}`.toLowerCase().includes(q)
    );
  }, [tdsPartiesRaw, partyQuery]);

  const tcsParties = useMemo(() => {
    const q = partyQuery.trim().toLowerCase();
    if (!q) return tcsPartiesRaw;
    return tcsPartiesRaw.filter((p) =>
      `${p.partyName} ${p.tan} ${p.partyPan} ${p.part}`.toLowerCase().includes(q)
    );
  }, [tcsPartiesRaw, partyQuery]);

  const availableParts = useMemo(() => {
    if (!parsed) return [];
    return Array.from(new Set(parsed.transactions.map((t) => t.part)));
  }, [parsed]);

  const filteredTransactions = useMemo(() => {
    if (!parsed) return [];
    const q = txQuery.trim().toLowerCase();
    return parsed.transactions.filter((tx) => {
      if (taxRoleFilter !== 'ALL' && classify26ASTaxType(tx) !== taxRoleFilter) return false;
      if (partFilter !== 'ALL' && tx.part !== partFilter) return false;
      if (quarterFilter !== 'ALL' && getFiscalQuarter(tx.transactionDate) !== quarterFilter) return false;
      if (natureFilter !== 'ALL' && tx.entryNature !== natureFilter) return false;
      if (bookingFilter === 'F' && !/^(?:F|M|Final|Matched)$/i.test((tx.bookingStatus || '').trim())) {
        return false;
      }
      if (bookingFilter === 'OTHER' && /^(?:F|M|Final|Matched)$/i.test((tx.bookingStatus || '').trim())) {
        return false;
      }
      if (!q) return true;
      const monthLbl = getFiscalMonthLabel(tx.transactionDate);
      const hay = `${tx.txSrNo} ${tx.partyName} ${tx.tan} ${tx.partyPan} ${tx.section} ${tx.part} ${tx.transactionDate} ${monthLbl} ${tx.bookingStatus} ${tx.remarks}`.toLowerCase();
      return hay.includes(q);
    });
  }, [parsed, taxRoleFilter, partFilter, quarterFilter, natureFilter, bookingFilter, txQuery]);

  const filteredTotals = useMemo(() => {
    return {
      paid: filteredTransactions.reduce((s, t) => s + t.amountPaid, 0),
      tax: filteredTransactions.reduce((s, t) => s + t.taxDeducted, 0),
      dep: filteredTransactions.reduce((s, t) => s + t.tdsDeposited, 0),
    };
  }, [filteredTransactions]);

  const handleExportCsv = (scope: 'all' | 'tds' | 'tcs' = 'all') => {
    if (!parsed || parsed.transactions.length === 0) return;
    const rowsToExport =
      scope === 'all'
        ? parsed.transactions
        : parsed.transactions.filter(
            (tx) => classify26ASTaxType(tx) === (scope === 'tcs' ? 'TCS' : 'TDS')
          );
    if (rowsToExport.length === 0) {
      setErrorMsg(`No ${scope.toUpperCase()} transactions present to export as CSV.`);
      return;
    }
    const suffix = scope === 'tds' ? '-TDS-Only' : scope === 'tcs' ? '-TCS-Only' : '';
    const titlePrefix =
      scope === 'tds'
        ? 'FORM 26AS TDS (DEDUCTORS ONLY)'
        : scope === 'tcs'
          ? 'FORM 26AS TCS (COLLECTORS ONLY)'
          : 'FORM 26AS BIFURCATED STATEMENT';

    downloadBomCsv({
      filename: `${getFileBaseTag(parsed)}${suffix}.csv`,
      preambleLines: [
        [titlePrefix, parsed.assesseeName],
        [
          'PAN',
          parsed.pan,
          'Status',
          parsed.panStatus,
          'Period',
          getYearHeaderLabel(parsed),
          'Updated Till',
          parsed.dataUpdatedTill || '-',
        ],
      ],
      headers: [
        'Sr No',
        '26AS Ref',
        'Tax Category (TDS/TCS)',
        'Part',
        'Type',
        'Deductor / Collector Name',
        'TAN',
        'PAN of Party',
        'Section',
        '1961 Act Eq.',
        'Section Description',
        'Txn Date',
        'Month',
        'Fiscal Quarter',
        'Booking Status',
        'Booking Date',
        'Remarks',
        'Entry Nature',
        'Amount Paid / Basis',
        'Tax Deducted / Collected',
        'TDS / TCS Deposited',
        'Short Deposit Diff',
        'Effective Rate %',
      ],
      rows: rowsToExport.map((tx, idx) => {
        const meta = lookupSectionMeta(tx.section);
        return [
          idx + 1,
          tx.txSrNo || `${tx.srNo}`,
          classify26ASTaxType(tx),
          tx.part,
          tx.partyType,
          tx.partyName,
          tx.tan,
          tx.partyPan || '-',
          tx.section,
          meta.oldActEq,
          getSectionDescription(tx.section),
          tx.transactionDate,
          getFiscalMonthLabel(tx.transactionDate),
          tx.fiscalQuarter || getFiscalQuarter(tx.transactionDate),
          tx.bookingStatus,
          tx.bookingDate,
          tx.remarks,
          tx.entryNature || 'Credit',
          tx.amountPaid.toFixed(2),
          tx.taxDeducted.toFixed(2),
          tx.tdsDeposited.toFixed(2),
          (tx.taxDeducted - tx.tdsDeposited).toFixed(2),
          calcEffRatePct(tx.taxDeducted, tx.amountPaid),
        ];
      }),
    });
    setStatusMsg(
      `Exported ${scope === 'all' ? 'Consolidated' : scope.toUpperCase() + '-Only'} UTF-8 CSV (${rowsToExport.length} rows).`
    );
  };

  const handleExportJson = () => {
    if (!parsed) return;
    downloadJsonFile({
      filename: `${getFileBaseTag(parsed)}.json`,
      data: parsed,
    });
    setStatusMsg('Exported structured Form 26AS JSON payload.');
  };

  const handleExportPdfSummary = () => {
    if (!parsed) return;
    exportStructuredReportPdf({
      title: `FORM 26AS BIFURCATED AUDIT — ${parsed.assesseeName}`,
      subtitle: `PAN: ${parsed.pan} (${parsed.panStatus}) | ${getYearHeaderLabel(parsed)}${parsed.dataUpdatedTill ? ` | Updated: ${parsed.dataUpdatedTill}` : ''} | TDS Deductors: ${totals.tdsMetrics.parties} | TCS Collectors: ${totals.tcsMetrics.parties}`,
      filename: `${getFileBaseTag(parsed)}-Bifurcated-Audit.pdf`,
      orientation: 'landscape',
      kpis: [
        { label: `TDS Deducted (${totals.tdsMetrics.txns} txns)`, value: formatINR(totals.tdsTotal) },
        { label: `TCS Collected (${totals.tcsMetrics.txns} txns)`, value: formatINR(totals.tcsTotal) },
        { label: 'Total Net Paid / Basis', value: formatINR(totals.amountPaid) },
        { label: 'Total Deposited', value: formatINR(totals.tdsDeposited) },
      ],
      breakdown: sectionBreakdown.slice(0, 14).map((s) => {
        const meta = lookupSectionMeta(s.section);
        return {
          label: `[${s.role}] ${s.part} · Sec ${s.section} (Old ${meta.oldActEq}) · ${s.txns} txns (${s.revs} rev) — ${meta.description}`,
          value: `Net ${formatINR(s.paid)} | Tax ${formatINR(s.tax)} (${calcEffRatePct(s.tax, s.paid)})`,
        };
      }),
      table: {
        title: 'Bifurcated TDS Deductors & TCS Collectors Reconciliation Schedule',
        headers: ['Sr', 'Role', 'Part', 'Party Name', 'TAN', 'PAN', 'Txns', 'Rev', 'Net Basis', 'Tax', 'Rate %', 'Check'],
        rows: parsed.parties.map((p) => [
          p.srNo,
          classify26ASTaxType(p),
          p.part.replace(/\s*\(.*\)/, ''),
          p.partyName,
          p.tan,
          p.partyPan || '-',
          p.transactionCount,
          p.reversalCount,
          formatINR(p.extractedAmountPaid),
          formatINR(p.extractedTaxDeducted),
          calcEffRatePct(p.extractedTaxDeducted, p.extractedAmountPaid),
          p.verificationStatus,
        ]),
      },
      notes: [
        `TDS Only: Basis ${formatINR(totals.tdsMetrics.netPaid)} | Deducted ${formatINR(totals.tdsMetrics.netTax)} | Deposited ${formatINR(totals.tdsMetrics.dep)} (${totals.tdsMetrics.parties} deductors).`,
        `TCS Only: Basis ${formatINR(totals.tcsMetrics.netPaid)} | Collected ${formatINR(totals.tcsMetrics.netTax)} | Deposited ${formatINR(totals.tcsMetrics.dep)} (${totals.tcsMetrics.parties} collectors).`,
        `Verified ${totals.verifiedParties}/${parsed.parties.length} party subtotals. Missing PAN: ${totals.missingPanParties}. Short deposit variance: ${formatINR(totals.taxDeducted - totals.tdsDeposited)}.`,
      ],
    });
    setStatusMsg('Exported bifurcated vector A4 PDF Audit Report.');
  };

  const handleExportWord = async () => {
    if (!parsed) return;
    await downloadWordDocument({
      filename: `${getFileBaseTag(parsed)}-Bifurcated.docx`,
      title: `Form 26AS Bifurcated TDS & TCS Audit — ${parsed.assesseeName}`,
      subtitle: `PAN: ${parsed.pan} (${parsed.panStatus}) · ${getYearHeaderLabel(parsed)}${parsed.dataUpdatedTill ? ` · Updated ${parsed.dataUpdatedTill}` : ''}`,
      kpis: [
        { label: `TDS Deductors (${totals.tdsMetrics.parties})`, value: `${formatINR(totals.tdsTotal)} (${totals.tdsMetrics.txns} txns)` },
        { label: `TCS Collectors (${totals.tcsMetrics.parties})`, value: `${formatINR(totals.tcsTotal)} (${totals.tcsMetrics.txns} txns)` },
        { label: 'Consolidated Tax Claim', value: formatINR(totals.taxDeducted) },
        { label: 'Total Deposited', value: formatINR(totals.tdsDeposited) },
        { label: 'Verified Accounts', value: `${totals.verifiedParties}/${parsed.parties.length}` },
      ],
      breakdown: [
        ...sectionBreakdown.map((s) => {
          const meta = lookupSectionMeta(s.section);
          return {
            label: `[${s.role}] ${s.part} · Section ${s.section} (1961 Eq: ${meta.oldActEq}) · ${s.txns} txns`,
            value: `Net Basis ${formatINR(s.paid)} | Tax ${formatINR(s.tax)} (${calcEffRatePct(s.tax, s.paid)})`,
          };
        }),
        ...quarterBreakdown.map((q) => ({
          label: `Quarter ${q.quarter} (${q.txns} txns, ${q.revs} rev)`,
          value: `Basis ${formatINR(q.paid)} | TDS ${formatINR(q.tds)} | TCS ${formatINR(q.tcs)}`,
        })),
      ],
      table: {
        title: 'Bifurcated TDS Deductors & TCS Collectors Schedule',
        headers: ['Sr', 'Role', 'Part', 'Party Name', 'TAN', 'PAN', 'Txns', 'Basis Amt', 'Tax', 'Deposited', 'Rate %', 'Status'],
        rows: parsed.parties.map((p) => [
          p.srNo,
          classify26ASTaxType(p),
          p.part,
          p.partyName,
          p.tan,
          p.partyPan || '-',
          p.transactionCount,
          formatINR(p.extractedAmountPaid),
          formatINR(p.extractedTaxDeducted),
          formatINR(p.extractedTdsDeposited),
          calcEffRatePct(p.extractedTaxDeducted, p.extractedAmountPaid),
          p.verificationStatus,
        ]),
      },
      notes: [
        `TDS Paid/Credited: ${formatINR(totals.tdsMetrics.netPaid)} | TCS Purchase/Sale Basis: ${formatINR(totals.tcsMetrics.netPaid)}.`,
        `Gross Credits: ${formatINR(totals.grossPaid)} | Reversals (${totals.reversalsCount}): ${formatINR(totals.reversalPaid)}.`,
      ],
    });
    setStatusMsg('Exported bifurcated Word (.docx) Audit Summary.');
  };

  const handlePrintReport = async () => {
    if (!parsed) return;
    const partyRowsHtml = parsed.parties
      .map(
        (p) => `<tr>
          <td>${p.srNo}</td>
          <td><strong>${classify26ASTaxType(p)}</strong></td>
          <td>${p.part}</td>
          <td>${p.partyName}</td>
          <td><strong>${p.tan}</strong></td>
          <td>${p.partyPan || '-'}</td>
          <td class="num">${p.transactionCount}</td>
          <td class="num">${p.reversalCount}</td>
          <td class="num">${formatINR(p.extractedAmountPaid)}</td>
          <td class="num">${formatINR(p.extractedTaxDeducted)}</td>
          <td class="num">${formatINR(p.extractedTdsDeposited)}</td>
          <td class="num">${calcEffRatePct(p.extractedTaxDeducted, p.extractedAmountPaid)}</td>
          <td>${p.verificationStatus}</td>
        </tr>`
      )
      .join('');

    await printHtmlDocument({
      title: `PDF to Excel Convertor Form 26AS — ${parsed.assesseeName} (${parsed.pan})`,
      orientation: 'landscape',
      bodyHtml: `
        <h1>FORM 26AS BIFURCATED TDS & TCS AUDIT — ${parsed.assesseeName}</h1>
        <p><strong>PAN:</strong> ${parsed.pan} (${parsed.panStatus}) &nbsp;|&nbsp; <strong>Period:</strong> ${getYearHeaderLabel(parsed)} &nbsp;|&nbsp; <strong>Updated Till:</strong> ${parsed.dataUpdatedTill || '-'} &nbsp;|&nbsp; <strong>TDS Deductors:</strong> ${totals.tdsMetrics.parties} &nbsp;|&nbsp; <strong>TCS Collectors:</strong> ${totals.tcsMetrics.parties}</p>
        <div class="kpi-grid">
          <div class="kpi-card"><div class="kpi-label">TDS Deducted (${totals.tdsMetrics.parties} Parties)</div><div class="kpi-val">${formatINR(totals.tdsTotal)}</div></div>
          <div class="kpi-card"><div class="kpi-label">TCS Collected (${totals.tcsMetrics.parties} Parties)</div><div class="kpi-val">${formatINR(totals.tcsTotal)}</div></div>
          <div class="kpi-card"><div class="kpi-label">Combined Basis Amount</div><div class="kpi-val">${formatINR(totals.amountPaid)}</div></div>
          <div class="kpi-card"><div class="kpi-label">Total Deposited</div><div class="kpi-val">${formatINR(totals.tdsDeposited)}</div></div>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th><th>Role</th><th>Part</th><th>Deductor / Collector</th><th>TAN</th><th>PAN</th><th class="num">Txns</th><th class="num">Rev</th><th class="num">Basis Amt</th><th class="num">Tax Ded/Col</th><th class="num">Deposited</th><th class="num">Eff Rate</th><th>Check</th>
            </tr>
          </thead>
          <tbody>${partyRowsHtml}</tbody>
        </table>
      `,
    });
  };

  const isPdfSelected = !fileName || fileName.toLowerCase().endsWith('.pdf');

  return (
    <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-5 sm:p-8 space-y-5 transition-colors duration-200">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-[#2F3E4E]/15 dark:border-slate-700/80">
        <div className="space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B] dark:text-slate-400 font-semibold">
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#2F3E4E] dark:text-[#F9C80E]" aria-hidden="true" />
            <span>{tool?.categoryName || 'Tax & GST'}</span>
            <span aria-hidden="true">·</span>
            <span>{tool?.code || 'TX-01'}</span>
            <span aria-hidden="true">·</span>
            <span className="text-[#12805C] dark:text-emerald-400 font-bold">
              PDF · TXT · Excel · CSV Engine
            </span>
          </div>
          <h1 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] dark:text-slate-100">
            PDF to Excel Convertor Form 26AS
          </h1>
          <p className="text-xs sm:text-sm text-[#475569] dark:text-slate-300 leading-relaxed max-w-3xl">
            Bifurcated TRACES Form 26AS Analytics &amp; Excel Engine: converts PDF, Text (<code className="font-mono">.txt</code>),
            or Excel/CSV into separate <strong>TDS Deductor</strong> &amp; <strong>TCS Collector</strong> schedules, Executive TDS vs TCS Dashboards, Apr–Mar &amp; Q1–Q4 matrices, live{' '}
            <code className="font-mono font-semibold">SUMIFS</code> /{' '}
            <code className="font-mono font-semibold">SUBTOTAL</code> formulas, and statutory rate/reversal audits.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowPasteBox((prev) => !prev)}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] hover:bg-[#EBF5FF] dark:hover:bg-slate-800 text-xs font-bold text-[#2F3E4E] dark:text-slate-100 transition cursor-pointer whitespace-nowrap"
          >
            <ClipboardPaste className="w-3.5 h-3.5 shrink-0" />
            <span>{showPasteBox ? 'Hide Text Paste' : 'Paste Text / ^ Data'}</span>
          </button>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center min-h-[40px] px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] hover:bg-[#FEF2C8] dark:hover:bg-slate-800 text-xs font-bold text-[#2F3E4E] dark:text-slate-100 transition cursor-pointer whitespace-nowrap"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Info Banner */}
      <div className="rounded-xl border border-[#2F3E4E]/20 dark:border-sky-500/30 bg-[#EBF5FF] dark:bg-sky-950/35 px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-2.5 text-xs sm:text-[13px] text-[#1E3A5F] dark:text-sky-100">
        <div className="flex items-start md:items-center gap-2.5 min-w-0">
          <Info className="w-4 h-4 text-[#0369A1] dark:text-sky-400 shrink-0 mt-0.5 md:mt-0" aria-hidden="true" />
          <p className="leading-snug">
            Supports <strong>Tax Year (Income-tax Act, 2025 · Sec 1001–1092)</strong> &amp; <strong>FY / AY (1961 Act)</strong>,
            extracts both <strong>Deductor/Collector TAN &amp; PAN</strong>, paired reversals <code className="font-mono">(G/B)</code>, and reconciles Official Header Summary.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 font-display font-bold text-[#12805C] dark:text-emerald-400 whitespace-nowrap shrink-0">
          <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>100% Local Sandbox</span>
        </span>
      </div>

      {/* Determinate Progress Bar (Displayed during PDF Parsing or Excel Workbook Generation) */}
      {(isParsing || isExporting || progressState) && progressState && (
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressState.pct}
          className="rounded-xl border-[1.5px] border-[#2F3E4E]/30 dark:border-slate-600 bg-white dark:bg-[#0B1120] p-4 space-y-2.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 font-display font-bold text-[#2F3E4E] dark:text-slate-100">
              <span>{progressState.stage}</span>
              {progressState.detail && (
                <span className="font-sans font-normal text-[#64748B] dark:text-slate-400">
                  · {progressState.detail}
                </span>
              )}
            </div>
            <span className="font-mono font-extrabold text-[#1E3A5F] dark:text-[#F9C80E] tabular-nums">
              {progressState.pct}%
            </span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-[#2F3E4E]/15 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-[#1E3A5F] dark:bg-[#F9C80E] transition-[width] duration-200 ease-out"
              style={{ width: `${progressState.pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Optional Raw Text / Caret Paste Box */}
      {showPasteBox && (
        <div className="rounded-2xl border-[1.5px] border-[#2F3E4E]/30 dark:border-slate-600 bg-white dark:bg-[#0B1120] p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display font-bold text-sm text-[#2F3E4E] dark:text-slate-100">
                Paste TRACES Text File / Caret (^) / Tab Data
              </h2>
              <p className="text-xs text-[#64748B] dark:text-slate-400">
                Paste raw contents copied from a TRACES text export (<code className="font-mono">^</code> or <code className="font-mono">|</code> delimited) or Form 26AS PDF viewer.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleParsePastedText}
                className="inline-flex items-center gap-1.5 min-h-[36px] px-3.5 rounded-xl bg-[#1E3A5F] dark:bg-[#F9C80E] text-white dark:text-[#0F172A] text-xs font-bold cursor-pointer"
              >
                Parse Pasted Data
              </button>
              <button
                type="button"
                onClick={() => setPastedText('')}
                disabled={!pastedText}
                className="inline-flex items-center gap-1 min-h-[36px] px-3 rounded-xl border border-[#2F3E4E]/25 dark:border-slate-600 text-xs font-semibold text-[#475569] dark:text-slate-300 disabled:opacity-40 cursor-pointer"
              >
                Clear Text
              </button>
            </div>
          </div>
          <textarea
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            rows={6}
            placeholder="Paste TRACES Form 26AS text or ^ delimited rows here..."
            className="w-full p-3 rounded-xl border border-[#2F3E4E]/25 dark:border-slate-600 bg-[#FFFDF5] dark:bg-[#131C2E] font-mono text-xs text-[#2F3E4E] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
          />
        </div>
      )}

      {/* Card 1: Multi-Format File Dropzone + Password + Clear */}
      <div className="rounded-2xl border-[1.5px] border-[#2F3E4E]/25 dark:border-slate-700 bg-white dark:bg-[#0B1120] p-4 sm:p-5 space-y-4">
        <FileDropZone
          accept=".pdf,.txt,.xlsx,.xls,.csv,application/pdf,text/plain,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          multiple={false}
          onFiles={(files) => {
            if (files[0]) void handleSelectFile(files[0]);
          }}
          className="rounded-xl border-2 border-dashed border-[#2F3E4E]/35 dark:border-slate-600 hover:border-[#2F3E4E] dark:hover:border-[#F9C80E] bg-[#FFFDF5] dark:bg-[#131C2E]/70 transition"
        >
          <label className="block px-4 py-7 sm:py-8 text-center cursor-pointer">
            <input
              type="file"
              accept=".pdf,.txt,.xlsx,.xls,.csv,application/pdf,text/plain,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={handleFileInputChange}
              className="hidden"
            />
            <div className="w-11 h-11 mx-auto mb-3 rounded-xl bg-[#EBF5FF] dark:bg-slate-800 border border-[#2F3E4E]/20 dark:border-slate-600 flex items-center justify-center text-[#0369A1] dark:text-[#F9C80E]">
              <Upload className="w-5 h-5" />
            </div>
            <p className="font-display font-extrabold text-sm sm:text-base text-[#2F3E4E] dark:text-slate-100">
              {isParsing
                ? progressState?.stage || 'Reading Form 26AS file locally...'
                : 'Click to upload Form 26AS (PDF, TRACES .TXT, Excel, or CSV)'}
            </p>
            <p className="text-xs text-[#64748B] dark:text-slate-400 mt-1">
              or drag and drop it here · PDF / TXT / XLSX / XLS / CSV · zero server upload
            </p>

            {fileName && (
              <div className="mt-3.5 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#EBF5FF] dark:bg-sky-950/60 border border-[#0369A1]/35 dark:border-sky-500/40 text-xs font-mono font-bold text-[#0369A1] dark:text-sky-300 max-w-full">
                <FileText className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">
                  {fileName} ({fileSizeKb.toLocaleString()} KB)
                </span>
              </div>
            )}
          </label>
        </FileDropZone>

        {/* Password Row + Clear File */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          {isPdfSelected ? (
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
              <div
                className={`relative flex-1 min-w-[220px] max-w-sm ${
                  needsPassword ? 'ring-2 ring-amber-500 rounded-xl' : ''
                }`}
              >
                <Lock
                  className="w-4 h-4 text-[#64748B] dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={pdfPassword}
                  onChange={(e) => setPdfPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && selectedFile) {
                      e.preventDefault();
                      void runParseFile(selectedFile, pdfPassword);
                    }
                  }}
                  aria-label="PDF password if encrypted"
                  placeholder="PDF password if encrypted (e.g. DDMMYYYY)"
                  className="w-full min-h-[42px] pl-9 pr-10 rounded-xl border border-[#2F3E4E]/30 dark:border-slate-600 bg-[#FFFDF5] dark:bg-[#131C2E] text-xs sm:text-sm text-[#2F3E4E] dark:text-slate-100 placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide PDF password' : 'Show PDF password'}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-[#64748B] dark:text-slate-400 hover:text-[#2F3E4E] dark:hover:text-white cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {selectedFile && (needsPassword || pdfPassword.trim().length > 0) && (
                <button
                  type="button"
                  onClick={() => void runParseFile(selectedFile, pdfPassword)}
                  disabled={isParsing}
                  className="inline-flex items-center gap-1.5 min-h-[42px] px-3.5 rounded-xl bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#FFFDF5] dark:text-[#0F172A] text-xs font-bold cursor-pointer whitespace-nowrap disabled:opacity-60"
                >
                  <span>{isParsing ? 'Unlocking...' : 'Unlock & Parse'}</span>
                </button>
              )}
            </div>
          ) : (
            <p className="text-xs font-medium text-[#475569] dark:text-slate-400">
              Non-PDF structured source loaded · Ready for audit &amp; Excel conversion.
            </p>
          )}

          <button
            type="button"
            onClick={handleClearFile}
            disabled={!fileName && !parsed && !pdfPassword && !pastedText}
            className="inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3 rounded-lg text-xs font-semibold text-[#475569] dark:text-slate-300 hover:text-[#2F3E4E] dark:hover:text-white hover:bg-[#FEF2C8] dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer disabled:cursor-default whitespace-nowrap self-end sm:self-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Clear All</span>
          </button>
        </div>
      </div>

      {/* Card 2: Excel Output Structure & Multi-Format Export Controls */}
      <div className="rounded-2xl border-[1.5px] border-[#2F3E4E]/25 dark:border-slate-700 bg-white dark:bg-[#0B1120] p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display font-extrabold text-sm sm:text-base text-[#2F3E4E] dark:text-slate-100">
            Excel Output Structure &amp; Export Options
          </h2>
          {parsed && (
            <span className="text-xs font-semibold text-[#12805C] dark:text-emerald-400">
              Ready: {parsed.parties.length} party account(s) · {parsed.transactions.length} txn(s)
              {parsed.challans.length > 0 ? ` · ${parsed.challans.length} challan(s)` : ''}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <label className="flex items-start gap-3 p-3 rounded-xl border border-[#2F3E4E]/15 dark:border-slate-800 hover:bg-[#FFFDF5] dark:hover:bg-slate-900/60 cursor-pointer">
            <input
              type="checkbox"
              checked={includeExecutiveSummary}
              onChange={(e) => setIncludeExecutiveSummary(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-[#2F3E4E] text-[#1E3A5F] focus:ring-[#F9C80E] cursor-pointer shrink-0"
            />
            <div className="space-y-0.5">
              <span className="block font-display font-bold text-sm text-[#2F3E4E] dark:text-slate-100">
                Executive TDS vs TCS Dashboard
              </span>
              <span className="block text-xs text-[#64748B] dark:text-slate-400">
                Side-by-side TDS vs TCS split, Booking Status (<code className="font-mono">F/U/O/P</code>) &amp; Apr–Mar monthly matrix.
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 rounded-xl border border-[#2F3E4E]/15 dark:border-slate-800 hover:bg-[#FFFDF5] dark:hover:bg-slate-900/60 cursor-pointer">
            <input
              type="checkbox"
              checked={includeSeparateTdsTcsSheets}
              onChange={(e) => setIncludeSeparateTdsTcsSheets(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-[#2F3E4E] text-[#1E3A5F] focus:ring-[#F9C80E] cursor-pointer shrink-0"
            />
            <div className="space-y-0.5">
              <span className="block font-display font-bold text-sm text-[#2F3E4E] dark:text-slate-100">
                Separate TDS &amp; TCS Worksheets
              </span>
              <span className="block text-xs text-[#64748B] dark:text-slate-400">
                Dedicated <code className="font-mono">TDS - Deductors/Txns</code> &amp;{' '}
                <code className="font-mono">TCS - Collectors/Txns</code> tabs with live{' '}
                <code className="font-mono">SUMIFS</code>.
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 rounded-xl border border-[#2F3E4E]/15 dark:border-slate-800 hover:bg-[#FFFDF5] dark:hover:bg-slate-900/60 cursor-pointer">
            <input
              type="checkbox"
              checked={includeCombinedSheet}
              onChange={(e) => setIncludeCombinedSheet(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-[#2F3E4E] text-[#1E3A5F] focus:ring-[#F9C80E] cursor-pointer shrink-0"
            />
            <div className="space-y-0.5">
              <span className="block font-display font-bold text-sm text-[#2F3E4E] dark:text-slate-100">
                Combined Master (“26AS”)
              </span>
              <span className="block text-xs text-[#64748B] dark:text-slate-400">
                All deductors &amp; collectors (TAN + PAN), 26AS Ref, Gross/Reversal split &amp;{' '}
                <code className="font-mono">SUBTOTAL</code>.
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 rounded-xl border border-[#2F3E4E]/15 dark:border-slate-800 hover:bg-[#FFFDF5] dark:hover:bg-slate-900/60 cursor-pointer">
            <input
              type="checkbox"
              checked={includePartySheets}
              onChange={(e) => setIncludePartySheets(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-[#2F3E4E] text-[#1E3A5F] focus:ring-[#F9C80E] cursor-pointer shrink-0"
            />
            <div className="space-y-0.5">
              <span className="block font-display font-bold text-sm text-[#2F3E4E] dark:text-slate-100">
                Party-wise tabs + Party Summary
              </span>
              <span className="block text-xs text-[#64748B] dark:text-slate-400">
                Individual ledger worksheet per deductor/collector (TAN &amp; PAN) with back links.
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 rounded-xl border border-[#2F3E4E]/15 dark:border-slate-800 hover:bg-[#FFFDF5] dark:hover:bg-slate-900/60 cursor-pointer">
            <input
              type="checkbox"
              checked={includeSectionQuarterSummary}
              onChange={(e) => setIncludeSectionQuarterSummary(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-[#2F3E4E] text-[#1E3A5F] focus:ring-[#F9C80E] cursor-pointer shrink-0"
            />
            <div className="space-y-0.5">
              <span className="block font-display font-bold text-sm text-[#2F3E4E] dark:text-slate-100">
                Section, Quarter &amp; Monthly Audit
              </span>
              <span className="block text-xs text-[#64748B] dark:text-slate-400">
                Live <code className="font-mono">SUMIFS/COUNTIFS</code> across Sections (2025 &amp; 1961 Act), Q1–Q4 &amp; Apr–Mar.
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 rounded-xl border border-[#2F3E4E]/15 dark:border-slate-800 hover:bg-[#FFFDF5] dark:hover:bg-slate-900/60 cursor-pointer">
            <input
              type="checkbox"
              checked={includeAuditSheet}
              onChange={(e) => setIncludeAuditSheet(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-[#2F3E4E] text-[#1E3A5F] focus:ring-[#F9C80E] cursor-pointer shrink-0"
            />
            <div className="space-y-0.5">
              <span className="block font-display font-bold text-sm text-[#2F3E4E] dark:text-slate-100">
                Rate Variance &amp; Exceptions Audit
              </span>
              <span className="block text-xs text-[#64748B] dark:text-slate-400">
                Flags reversals <code className="font-mono">(G/B)</code>, rate deviations, missing PANs &amp; short deposits.
              </span>
            </div>
          </label>
        </div>

        {/* Export Button Bar */}
        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => void handleConvertToExcel('all')}
            disabled={isParsing || isExporting}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-[#1E3A5F] hover:bg-[#162C49] dark:bg-[#F9C80E] dark:hover:bg-[#FDE047] text-white dark:text-[#0F172A] font-display font-extrabold text-sm shadow-[0_3px_0_#0F172A] dark:shadow-[0_3px_0_#92400E] transition cursor-pointer whitespace-nowrap disabled:opacity-60"
          >
            <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{isExporting ? 'Generating Workbook...' : 'Master Bifurcated Excel (.xlsx)'}</span>
          </button>

          {parsed && (parsed.transactions.length > 0 || parsed.parties.length > 0) && (
            <>
              {(totals.tdsMetrics.parties > 0 || totals.tdsMetrics.txns > 0) && (
                <button
                  type="button"
                  onClick={() => void handleConvertToExcel('tds')}
                  disabled={isParsing || isExporting}
                  className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-xl border-[1.5px] border-[#0369A1] dark:border-sky-500/70 bg-[#EBF5FF] dark:bg-sky-950/50 hover:bg-[#DBEAFE] dark:hover:bg-sky-900/70 text-xs font-extrabold text-[#0369A1] dark:text-sky-300 transition cursor-pointer whitespace-nowrap disabled:opacity-60"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>TDS-Only Excel (.xlsx)</span>
                </button>
              )}

              {(totals.tcsMetrics.parties > 0 || totals.tcsMetrics.txns > 0) && (
                <button
                  type="button"
                  onClick={() => void handleConvertToExcel('tcs')}
                  disabled={isParsing || isExporting}
                  className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-xl border-[1.5px] border-[#12805C] dark:border-emerald-500/70 bg-[#CEE5DC]/55 dark:bg-emerald-950/50 hover:bg-[#CEE5DC] dark:hover:bg-emerald-900/70 text-xs font-extrabold text-[#12805C] dark:text-emerald-300 transition cursor-pointer whitespace-nowrap disabled:opacity-60"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>TCS-Only Excel (.xlsx)</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleExportCsv('all')}
                className="inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-xl border-[1.5px] border-[#2F3E4E]/35 dark:border-slate-600 bg-[#FFFDF5] dark:bg-slate-800/80 hover:bg-[#FEF2C8] dark:hover:bg-slate-700 text-xs font-bold text-[#2F3E4E] dark:text-slate-100 transition cursor-pointer whitespace-nowrap"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>All CSV</span>
              </button>

              {(totals.tdsMetrics.txns > 0) && (
                <button
                  type="button"
                  onClick={() => handleExportCsv('tds')}
                  className="inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-xl border-[1.5px] border-[#2F3E4E]/35 dark:border-slate-600 bg-[#FFFDF5] dark:bg-slate-800/80 hover:bg-[#EBF5FF] dark:hover:bg-slate-700 text-xs font-bold text-[#0369A1] dark:text-sky-300 transition cursor-pointer whitespace-nowrap"
                >
                  <span>TDS CSV</span>
                </button>
              )}

              {(totals.tcsMetrics.txns > 0) && (
                <button
                  type="button"
                  onClick={() => handleExportCsv('tcs')}
                  className="inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-xl border-[1.5px] border-[#2F3E4E]/35 dark:border-slate-600 bg-[#FFFDF5] dark:bg-slate-800/80 hover:bg-[#CEE5DC]/60 dark:hover:bg-slate-700 text-xs font-bold text-[#12805C] dark:text-emerald-300 transition cursor-pointer whitespace-nowrap"
                >
                  <span>TCS CSV</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleExportPdfSummary}
                className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E]/35 dark:border-slate-600 bg-[#FFFDF5] dark:bg-slate-800/80 hover:bg-[#FEF2C8] dark:hover:bg-slate-700 text-xs font-bold text-[#2F3E4E] dark:text-slate-100 transition cursor-pointer whitespace-nowrap"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>PDF Audit</span>
              </button>

              <button
                type="button"
                onClick={() => void handleExportWord()}
                className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E]/35 dark:border-slate-600 bg-[#FFFDF5] dark:bg-slate-800/80 hover:bg-[#FEF2C8] dark:hover:bg-slate-700 text-xs font-bold text-[#2F3E4E] dark:text-slate-100 transition cursor-pointer whitespace-nowrap"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Word (.docx)</span>
              </button>

              <button
                type="button"
                onClick={handleExportJson}
                className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E]/35 dark:border-slate-600 bg-[#FFFDF5] dark:bg-slate-800/80 hover:bg-[#FEF2C8] dark:hover:bg-slate-700 text-xs font-bold text-[#2F3E4E] dark:text-slate-100 transition cursor-pointer whitespace-nowrap"
              >
                <FileCode2 className="w-3.5 h-3.5" />
                <span>JSON</span>
              </button>

              <button
                type="button"
                onClick={() => void handlePrintReport()}
                className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E]/35 dark:border-slate-600 bg-[#FFFDF5] dark:bg-slate-800/80 hover:bg-[#FEF2C8] dark:hover:bg-slate-700 text-xs font-bold text-[#2F3E4E] dark:text-slate-100 transition cursor-pointer whitespace-nowrap"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Feedback Alerts */}
      {errorMsg && (
        <div
          role="alert"
          className="p-4 rounded-xl border-[1.5px] border-[#C85A32] dark:border-amber-500/60 bg-[#FFE1B3]/70 dark:bg-amber-950/50 text-xs sm:text-sm font-semibold text-[#2F3E4E] dark:text-amber-200 flex items-start gap-2.5"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#C85A32] dark:text-amber-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {statusMsg && !errorMsg && (
        <div
          role="status"
          className="p-3.5 rounded-xl border border-[#12805C] dark:border-emerald-600 bg-[#CEE5DC]/75 dark:bg-emerald-950/60 text-xs sm:text-sm font-semibold text-[#1E3A2F] dark:text-emerald-200 flex items-center gap-2.5"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0 text-[#12805C] dark:text-emerald-400" />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Parsed Audit Dashboard & Live Data Preview */}
      {parsed && (parsed.parties.length > 0 || parsed.challans.length > 0) && (
        <div className="space-y-4 pt-2">
          {/* 4-Column Bifurcated KPI Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-xl bg-[#FEF2C8]/75 dark:bg-[#0B1120] border-[1.5px] border-[#2F3E4E]/30 dark:border-slate-700">
              <div className="flex items-center justify-between gap-1">
                <p className="text-[11px] font-bold uppercase text-[#64748B] dark:text-slate-400">
                  {parsed.yearScheme === 'tax_year' ? 'PAN & Tax Year' : 'PAN & AY'}
                </p>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    isValidPan(parsed.pan)
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                      : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300'
                  }`}
                >
                  {isValidPan(parsed.pan) ? `PAN ${parsed.panStatus}` : 'Check PAN'}
                </span>
              </div>
              <p className="font-mono font-extrabold text-base text-[#2F3E4E] dark:text-slate-100 mt-1">
                {parsed.pan}
              </p>
              <p className="text-xs text-[#475569] dark:text-slate-400 truncate">
                {parsed.yearScheme === 'tax_year'
                  ? `TY ${parsed.taxYear} · ${parsed.assesseeName}`
                  : `FY ${parsed.financialYear} (AY ${parsed.assessmentYear}) · ${parsed.assesseeName}`}
              </p>
              {parsed.dataUpdatedTill && (
                <p className="text-[11px] text-[#64748B] dark:text-slate-400 mt-0.5">
                  Updated till {parsed.dataUpdatedTill}
                </p>
              )}
            </div>

            <div className="p-4 rounded-xl bg-[#EBF5FF]/85 dark:bg-sky-950/35 border-[1.5px] border-[#0369A1]/35 dark:border-sky-700/60">
              <div className="flex items-center justify-between gap-1">
                <p className="text-[11px] font-bold uppercase text-[#0369A1] dark:text-sky-300">
                  TDS (Deductors Only)
                </p>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-900 text-[#0369A1] dark:text-sky-200">
                  {totals.tdsMetrics.parties} Parties · {totals.tdsMetrics.txns} Txns
                </span>
              </div>
              <p className="font-mono tabular-nums font-extrabold text-base sm:text-lg text-[#1E3A5F] dark:text-sky-200 mt-1">
                {formatINR(totals.tdsMetrics.netTax)}
              </p>
              <p className="text-[11px] text-[#475569] dark:text-slate-300">
                Basis {formatINR(totals.tdsMetrics.netPaid)} · Dep {formatINR(totals.tdsMetrics.dep)} · Rate{' '}
                {calcEffRatePct(totals.tdsMetrics.netTax, totals.tdsMetrics.netPaid)}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#CEE5DC]/60 dark:bg-emerald-950/35 border-[1.5px] border-[#12805C]/35 dark:border-emerald-700/60">
              <div className="flex items-center justify-between gap-1">
                <p className="text-[11px] font-bold uppercase text-[#12805C] dark:text-emerald-300">
                  TCS (Collectors Only)
                </p>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900 text-[#12805C] dark:text-emerald-200">
                  {totals.tcsMetrics.parties} Parties · {totals.tcsMetrics.txns} Txns
                </span>
              </div>
              <p className="font-mono tabular-nums font-extrabold text-base sm:text-lg text-[#12805C] dark:text-emerald-300 mt-1">
                {formatINR(totals.tcsMetrics.netTax)}
              </p>
              <p className="text-[11px] text-[#475569] dark:text-slate-300">
                Basis {formatINR(totals.tcsMetrics.netPaid)} · Dep {formatINR(totals.tcsMetrics.dep)} · Rate{' '}
                {calcEffRatePct(totals.tcsMetrics.netTax, totals.tcsMetrics.netPaid)}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#F9C80E]/30 dark:bg-amber-950/35 border-[1.5px] border-[#2F3E4E]/30 dark:border-amber-700/50">
              <div className="flex items-center justify-between gap-1">
                <p className="text-[11px] font-bold uppercase text-[#64748B] dark:text-slate-400">
                  Consolidated Deposited
                </p>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900 text-amber-900 dark:text-amber-200">
                  {shortDepositOrUnmatchedTxs.length} Alerts
                </span>
              </div>
              <p className="font-mono tabular-nums font-extrabold text-base sm:text-lg text-[#2F3E4E] dark:text-[#F9C80E] mt-1">
                {formatINR(totals.tdsDeposited)}
              </p>
              <p className="text-[11px] text-[#475569] dark:text-slate-300">
                Claim {formatINR(totals.taxDeducted)} · Short {formatINR(Math.max(0, totals.taxDeducted - totals.tdsDeposited))} · Rev {totals.reversalsCount}
              </p>
            </div>
          </div>

          {/* Statement Cross-Check Verification Strip */}
          <div className="rounded-xl border border-[#2F3E4E]/20 dark:border-slate-700 bg-white dark:bg-[#0B1120] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`inline-flex items-center gap-1 font-bold ${
                  totals.varianceParties === 0
                    ? 'text-[#12805C] dark:text-emerald-400'
                    : 'text-[#C85A32] dark:text-amber-400'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {totals.verifiedParties}/{parsed.parties.length} Party Subtotals Verified
              </span>
              {totals.officialReconStatus === 'matched' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold">
                  Header Summary Exact Match (₹0.00 variance)
                </span>
              )}
              {totals.officialReconStatus === 'diff' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold">
                  Header Summary Diff: {formatINR(totals.officialDiff)}
                </span>
              )}
              {totals.reversalsCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 font-semibold">
                  {totals.reversalsCount} Reversal / G-B Adjusted
                </span>
              )}
              {rateVarianceTxs.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 font-semibold">
                  {rateVarianceTxs.length} Rate Deviation(s)
                </span>
              )}
              {totals.missingPanParties > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-semibold">
                  {totals.missingPanParties} Party PAN Missing (Only TAN)
                </span>
              )}
            </div>
            <span className="text-[#64748B] dark:text-slate-400">
              Click any party, month, or section row to drill into filtered ledger
            </span>
          </div>

          {/* Interactive Tab Switcher + Filters */}
          <div className="flex flex-col gap-3">
            <div
              role="tablist"
              aria-label="Extracted Form 26AS Views"
              className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#FEF2C8] dark:bg-[#0B1120] border border-[#2F3E4E]/20 dark:border-slate-700"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'executive'}
                onClick={() => setActiveTab('executive')}
                className={`min-h-[38px] px-3 rounded-lg text-xs font-display font-bold transition cursor-pointer whitespace-nowrap ${
                  activeTab === 'executive'
                    ? 'bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#FFFDF5] dark:text-[#0F172A]'
                    : 'text-[#475569] dark:text-slate-300 hover:text-[#2F3E4E] dark:hover:text-white'
                }`}
              >
                Executive TDS vs TCS
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'tds'}
                onClick={() => setActiveTab('tds')}
                className={`min-h-[38px] px-3 rounded-lg text-xs font-display font-bold transition cursor-pointer whitespace-nowrap ${
                  activeTab === 'tds'
                    ? 'bg-[#0369A1] text-white'
                    : 'text-[#0369A1] dark:text-sky-300 hover:bg-white/60 dark:hover:bg-slate-800'
                }`}
              >
                TDS Deductors ({tdsPartiesRaw.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'tcs'}
                onClick={() => setActiveTab('tcs')}
                className={`min-h-[38px] px-3 rounded-lg text-xs font-display font-bold transition cursor-pointer whitespace-nowrap ${
                  activeTab === 'tcs'
                    ? 'bg-[#12805C] text-white'
                    : 'text-[#12805C] dark:text-emerald-300 hover:bg-white/60 dark:hover:bg-slate-800'
                }`}
              >
                TCS Collectors ({tcsPartiesRaw.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'parties'}
                onClick={() => setActiveTab('parties')}
                className={`min-h-[38px] px-3 rounded-lg text-xs font-display font-bold transition cursor-pointer whitespace-nowrap ${
                  activeTab === 'parties'
                    ? 'bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#FFFDF5] dark:text-[#0F172A]'
                    : 'text-[#475569] dark:text-slate-300 hover:text-[#2F3E4E] dark:hover:text-white'
                }`}
              >
                All Parties ({parsed.parties.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'sections'}
                onClick={() => setActiveTab('sections')}
                className={`min-h-[38px] px-3 rounded-lg text-xs font-display font-bold transition cursor-pointer whitespace-nowrap ${
                  activeTab === 'sections'
                    ? 'bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#FFFDF5] dark:text-[#0F172A]'
                    : 'text-[#475569] dark:text-slate-300 hover:text-[#2F3E4E] dark:hover:text-white'
                }`}
              >
                Section, Quarter &amp; Monthly ({sectionBreakdown.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'transactions'}
                onClick={() => setActiveTab('transactions')}
                className={`min-h-[38px] px-3 rounded-lg text-xs font-display font-bold transition cursor-pointer whitespace-nowrap ${
                  activeTab === 'transactions'
                    ? 'bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#FFFDF5] dark:text-[#0F172A]'
                    : 'text-[#475569] dark:text-slate-300 hover:text-[#2F3E4E] dark:hover:text-white'
                }`}
              >
                Transactions ({parsed.transactions.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'audit'}
                onClick={() => setActiveTab('audit')}
                className={`min-h-[38px] px-3 rounded-lg text-xs font-display font-bold transition cursor-pointer whitespace-nowrap ${
                  activeTab === 'audit'
                    ? 'bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#FFFDF5] dark:text-[#0F172A]'
                    : 'text-[#475569] dark:text-slate-300 hover:text-[#2F3E4E] dark:hover:text-white'
                }`}
              >
                Audit &amp; Exceptions ({reversalTransactions.length + shortDepositOrUnmatchedTxs.length + rateVarianceTxs.length + missingPanList.length})
              </button>
              {parsed.challans.length > 0 && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'challans'}
                  onClick={() => setActiveTab('challans')}
                  className={`min-h-[38px] px-3 rounded-lg text-xs font-display font-bold transition cursor-pointer whitespace-nowrap ${
                    activeTab === 'challans'
                      ? 'bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#FFFDF5] dark:text-[#0F172A]'
                      : 'text-[#475569] dark:text-slate-300 hover:text-[#2F3E4E] dark:hover:text-white'
                  }`}
                >
                  Tax Paid Challans ({parsed.challans.length})
                </button>
              )}
            </div>

            {(activeTab === 'parties' || activeTab === 'tds' || activeTab === 'tcs') && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="relative">
                  <Search
                    className="w-3.5 h-3.5 text-[#64748B] dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={partyQuery}
                    onChange={(e) => setPartyQuery(e.target.value)}
                    placeholder={`Search ${activeTab === 'tds' ? 'TDS deductors' : activeTab === 'tcs' ? 'TCS collectors' : 'all parties'}, TAN, or PAN...`}
                    className="w-full sm:w-72 min-h-[38px] pl-8 pr-3 rounded-xl border border-[#2F3E4E]/25 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs text-[#2F3E4E] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
                  />
                </div>
                {activeTab === 'tds' && (
                  <span className="text-xs font-semibold text-[#0369A1] dark:text-sky-300">
                    Showing strictly TDS Deductor accounts · Click row for TDS ledger
                  </span>
                )}
                {activeTab === 'tcs' && (
                  <span className="text-xs font-semibold text-[#12805C] dark:text-emerald-300">
                    Showing strictly TCS Collector accounts · Click row for TCS ledger
                  </span>
                )}
              </div>
            )}

            {activeTab === 'sections' && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-[#475569] dark:text-slate-300">Filter Section Role:</span>
                {(['ALL', 'TDS', 'TCS'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setSectionRoleFilter(r)}
                    className={`min-h-[34px] px-3 rounded-lg text-xs font-bold border transition cursor-pointer ${
                      sectionRoleFilter === r
                        ? 'bg-[#1E3A5F] dark:bg-[#F9C80E] text-white dark:text-[#0F172A] border-[#1E3A5F] dark:border-[#F9C80E]'
                        : 'bg-white dark:bg-[#0B1120] text-[#475569] dark:text-slate-300 border-[#2F3E4E]/25 dark:border-slate-600'
                    }`}
                  >
                    {r === 'ALL' ? `All (${sectionBreakdown.length})` : `${r} Only (${sectionBreakdown.filter((s) => s.role === r).length})`}
                  </button>
                ))}
              </div>
            )}

            {activeTab === 'transactions' && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search
                    className="w-3.5 h-3.5 text-[#64748B] dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={txQuery}
                    onChange={(e) => setTxQuery(e.target.value)}
                    placeholder="Filter party, TAN, PAN, month..."
                    className="w-full sm:w-48 min-h-[38px] pl-8 pr-3 rounded-xl border border-[#2F3E4E]/25 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs text-[#2F3E4E] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
                  />
                </div>
                <select
                  value={taxRoleFilter}
                  onChange={(e) => setTaxRoleFilter(e.target.value as 'ALL' | 'TDS' | 'TCS')}
                  className="min-h-[38px] px-3 rounded-xl border border-[#2F3E4E]/25 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-semibold text-[#2F3E4E] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
                >
                  <option value="ALL">TDS &amp; TCS</option>
                  <option value="TDS">TDS Only</option>
                  <option value="TCS">TCS Only</option>
                </select>
                {availableParts.length > 1 && (
                  <select
                    value={partFilter}
                    onChange={(e) => setPartFilter(e.target.value)}
                    className="min-h-[38px] px-3 rounded-xl border border-[#2F3E4E]/25 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-semibold text-[#2F3E4E] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
                  >
                    <option value="ALL">All Parts</option>
                    {availableParts.map((part) => (
                      <option key={part} value={part}>
                        {part}
                      </option>
                    ))}
                  </select>
                )}
                <select
                  value={quarterFilter}
                  onChange={(e) => setQuarterFilter(e.target.value)}
                  className="min-h-[38px] px-3 rounded-xl border border-[#2F3E4E]/25 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-semibold text-[#2F3E4E] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
                >
                  <option value="ALL">All Quarters</option>
                  <option value="Q1 (Apr-Jun)">Q1 (Apr-Jun)</option>
                  <option value="Q2 (Jul-Sep)">Q2 (Jul-Sep)</option>
                  <option value="Q3 (Oct-Dec)">Q3 (Oct-Dec)</option>
                  <option value="Q4 (Jan-Mar)">Q4 (Jan-Mar)</option>
                </select>
                <select
                  value={natureFilter}
                  onChange={(e) => setNatureFilter(e.target.value as 'ALL' | 'Credit' | 'Reversal')}
                  className="min-h-[38px] px-3 rounded-xl border border-[#2F3E4E]/25 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-semibold text-[#2F3E4E] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
                >
                  <option value="ALL">Credits &amp; Reversals</option>
                  <option value="Credit">Credits Only</option>
                  <option value="Reversal">Reversals Only</option>
                </select>
                <select
                  value={bookingFilter}
                  onChange={(e) => setBookingFilter(e.target.value as 'ALL' | 'F' | 'OTHER')}
                  className="min-h-[38px] px-3 rounded-xl border border-[#2F3E4E]/25 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-semibold text-[#2F3E4E] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
                >
                  <option value="ALL">All Status (F/U/O/P)</option>
                  <option value="F">Final (F/Matched) Only</option>
                  <option value="OTHER">Unmatched / Non-Final</option>
                </select>
                {(txQuery ||
                  taxRoleFilter !== 'ALL' ||
                  partFilter !== 'ALL' ||
                  quarterFilter !== 'ALL' ||
                  natureFilter !== 'ALL' ||
                  bookingFilter !== 'ALL') && (
                  <button
                    type="button"
                    onClick={() => {
                      setTxQuery('');
                      setTaxRoleFilter('ALL');
                      setPartFilter('ALL');
                      setQuarterFilter('ALL');
                      setNatureFilter('ALL');
                      setBookingFilter('ALL');
                    }}
                    className="min-h-[38px] px-2.5 rounded-xl border border-[#2F3E4E]/25 dark:border-slate-600 text-xs font-semibold text-[#475569] dark:text-slate-300 hover:bg-[#FEF2C8] dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Tab 0: Executive TDS vs TCS Bifurcation Dashboard */}
          {activeTab === 'executive' && (
            <div className="space-y-4">
              {/* Side-by-side TDS vs TCS Comparison Matrix */}
              <div className="overflow-x-auto rounded-xl border-[1.5px] border-[#2F3E4E]/40 dark:border-slate-700 bg-white dark:bg-[#0B1120]">
                <div className="px-4 py-2.5 bg-[#1E3A5F] text-white flex flex-wrap items-center justify-between gap-2 text-xs font-display font-bold">
                  <span>1. Executive Bifurcation — TDS (Deductors) vs TCS (Collectors) Reconciliation</span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleConvertToExcel('tds')}
                      className="px-2.5 py-1 rounded bg-[#0369A1] hover:bg-sky-600 text-[11px] font-bold text-white cursor-pointer"
                    >
                      Export TDS Excel
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleConvertToExcel('tcs')}
                      className="px-2.5 py-1 rounded bg-[#12805C] hover:bg-emerald-600 text-[11px] font-bold text-white cursor-pointer"
                    >
                      Export TCS Excel
                    </button>
                  </div>
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#E8F0FE] dark:bg-slate-800 text-[#1E3A5F] dark:text-slate-100">
                    <tr>
                      <th className="px-3.5 py-2.5 font-bold">Metric / Financial Dimension</th>
                      <th className="px-3.5 py-2.5 font-bold text-right text-[#0369A1] dark:text-sky-300">TDS (Deductors)</th>
                      <th className="px-3.5 py-2.5 font-bold text-right text-[#12805C] dark:text-emerald-300">TCS (Collectors)</th>
                      <th className="px-3.5 py-2.5 font-bold text-right">Consolidated Total</th>
                      <th className="px-3.5 py-2.5 font-bold text-right">TDS Share %</th>
                      <th className="px-3.5 py-2.5 font-bold text-right">TCS Share %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2F3E4E]/10 dark:divide-slate-800">
                    {[
                      { label: 'Unique Parties (TAN Accounts)', tds: totals.tdsMetrics.parties, tcs: totals.tcsMetrics.parties, all: parsed.parties.length, kind: 'int' },
                      { label: 'Total Transactions', tds: totals.tdsMetrics.txns, tcs: totals.tcsMetrics.txns, all: parsed.transactions.length, kind: 'int' },
                      { label: 'Reversal / Rectification (G/B) Rows', tds: totals.tdsMetrics.revs, tcs: totals.tcsMetrics.revs, all: totals.reversalsCount, kind: 'int' },
                      { label: 'Gross Positive Credits / Basis', tds: totals.tdsMetrics.grossPaid, tcs: totals.tcsMetrics.grossPaid, all: totals.grossPaid, kind: 'inr' },
                      { label: 'Reversal Basis Impact (-)', tds: totals.tdsMetrics.revPaid, tcs: totals.tcsMetrics.revPaid, all: totals.reversalPaid, kind: 'inr' },
                      { label: 'Net Basis Amount (Paid / Recd)', tds: totals.tdsMetrics.netPaid, tcs: totals.tcsMetrics.netPaid, all: totals.amountPaid, kind: 'inr' },
                      { label: 'Gross Tax Deducted / Collected', tds: totals.tdsMetrics.grossTax, tcs: totals.tcsMetrics.grossTax, all: totals.grossTax, kind: 'inr' },
                      { label: 'Reversal Tax Impact (-)', tds: totals.tdsMetrics.revTax, tcs: totals.tcsMetrics.revTax, all: totals.reversalTax, kind: 'inr' },
                      { label: 'Net Tax Deducted / Collected (Claim)', tds: totals.tdsMetrics.netTax, tcs: totals.tcsMetrics.netTax, all: totals.taxDeducted, kind: 'inr', highlight: true },
                      { label: 'Tax Actually Deposited (26AS)', tds: totals.tdsMetrics.dep, tcs: totals.tcsMetrics.dep, all: totals.tdsDeposited, kind: 'inr', highlight: true },
                      { label: 'Short / Excess Deposit Diff', tds: totals.tdsMetrics.shortDiff, tcs: totals.tcsMetrics.shortDiff, all: Number((totals.taxDeducted - totals.tdsDeposited).toFixed(2)), kind: 'inr' },
                    ].map((row) => {
                      const fmtVal = (v: number) => (row.kind === 'int' ? v.toLocaleString() : formatINR(v));
                      const sharePct = (partVal: number) =>
                        row.all && Math.abs(row.all) > 0.01 ? `${((partVal / row.all) * 100).toFixed(1)}%` : '0.0%';
                      return (
                        <tr
                          key={row.label}
                          className={row.highlight ? 'bg-[#FEF2C8]/75 dark:bg-amber-950/25 font-bold' : 'hover:bg-[#FEF2C8]/35 dark:hover:bg-slate-800/40'}
                        >
                          <td className="px-3.5 py-2.5 font-semibold text-[#2F3E4E] dark:text-slate-100">{row.label}</td>
                          <td className="px-3.5 py-2.5 font-mono tabular-nums text-right text-[#0369A1] dark:text-sky-300">{fmtVal(row.tds)}</td>
                          <td className="px-3.5 py-2.5 font-mono tabular-nums text-right text-[#12805C] dark:text-emerald-300">{fmtVal(row.tcs)}</td>
                          <td className="px-3.5 py-2.5 font-mono tabular-nums text-right text-[#2F3E4E] dark:text-slate-100">{fmtVal(row.all)}</td>
                          <td className="px-3.5 py-2.5 font-mono tabular-nums text-right text-[#64748B] dark:text-slate-400">{sharePct(row.tds)}</td>
                          <td className="px-3.5 py-2.5 font-mono tabular-nums text-right text-[#64748B] dark:text-slate-400">{sharePct(row.tcs)}</td>
                        </tr>
                      );
                    })}
                    <tr className="bg-slate-50 dark:bg-slate-900/60">
                      <td className="px-3.5 py-2.5 font-semibold text-[#2F3E4E] dark:text-slate-100">Effective Blended Tax Rate %</td>
                      <td className="px-3.5 py-2.5 font-mono tabular-nums text-right font-bold text-[#0369A1] dark:text-sky-300">
                        {calcEffRatePct(totals.tdsMetrics.netTax, totals.tdsMetrics.netPaid)}
                      </td>
                      <td className="px-3.5 py-2.5 font-mono tabular-nums text-right font-bold text-[#12805C] dark:text-emerald-300">
                        {calcEffRatePct(totals.tcsMetrics.netTax, totals.tcsMetrics.netPaid)}
                      </td>
                      <td className="px-3.5 py-2.5 font-mono tabular-nums text-right font-bold text-[#2F3E4E] dark:text-slate-100">
                        {calcEffRatePct(totals.taxDeducted, totals.amountPaid)}
                      </td>
                      <td colSpan={2} className="px-3.5 py-2.5 text-right text-[11px] text-[#64748B] dark:text-slate-400">
                        Official Header: TDS {totals.tdsMetrics.official !== undefined ? formatINR(totals.tdsMetrics.official) : 'N/A'} · TCS{' '}
                        {totals.tcsMetrics.official !== undefined ? formatINR(totals.tcsMetrics.official) : 'N/A'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 2. Booking Status Audit + Quick Monthly Apr-Mar */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="overflow-x-auto rounded-xl border-[1.5px] border-[#2F3E4E]/40 dark:border-slate-700 bg-white dark:bg-[#0B1120]">
                  <div className="px-4 py-2.5 bg-[#EBF5FF] dark:bg-slate-800 border-b border-[#2F3E4E]/15 dark:border-slate-700 text-xs font-display font-bold text-[#1E3A5F] dark:text-slate-100">
                    2. TRACES Booking Status Breakdown (Final [F] vs Unmatched/Provisional)
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#1E3A5F] dark:bg-slate-800 text-white">
                      <tr>
                        <th className="px-3 py-2.5 font-bold">Booking Status</th>
                        <th className="px-3 py-2.5 font-bold text-right">TDS Txns</th>
                        <th className="px-3 py-2.5 font-bold text-right">TDS Tax</th>
                        <th className="px-3 py-2.5 font-bold text-right">TCS Txns</th>
                        <th className="px-3 py-2.5 font-bold text-right">TCS Tax</th>
                        <th className="px-3 py-2.5 font-bold text-right">Deposited</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2F3E4E]/10 dark:divide-slate-800">
                      {bookingStatusSummary.map((bk) => (
                        <tr
                          key={bk.status}
                          onClick={() => {
                            setBookingFilter(bk.status.startsWith('Final') ? 'F' : 'OTHER');
                            setTaxRoleFilter('ALL');
                            setPartFilter('ALL');
                            setTxQuery('');
                            setActiveTab('transactions');
                          }}
                          className="hover:bg-[#FEF2C8]/50 dark:hover:bg-slate-800/50 cursor-pointer"
                        >
                          <td className="px-3 py-2.5 font-bold text-[#2F3E4E] dark:text-slate-100">{bk.status}</td>
                          <td className="px-3 py-2.5 font-mono tabular-nums text-right text-[#475569] dark:text-slate-300">{bk.tdsTxns}</td>
                          <td className="px-3 py-2.5 font-mono tabular-nums text-right text-[#0369A1] dark:text-sky-300">{formatINR(bk.tdsTax)}</td>
                          <td className="px-3 py-2.5 font-mono tabular-nums text-right text-[#475569] dark:text-slate-300">{bk.tcsTxns}</td>
                          <td className="px-3 py-2.5 font-mono tabular-nums text-right text-[#12805C] dark:text-emerald-300">{formatINR(bk.tcsTax)}</td>
                          <td className="px-3 py-2.5 font-mono tabular-nums text-right font-bold text-[#2F3E4E] dark:text-slate-100">{formatINR(bk.dep)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="overflow-x-auto rounded-xl border-[1.5px] border-[#2F3E4E]/40 dark:border-slate-700 bg-white dark:bg-[#0B1120]">
                  <div className="px-4 py-2.5 bg-[#CEE5DC]/60 dark:bg-slate-800 border-b border-[#2F3E4E]/15 dark:border-slate-700 text-xs font-display font-bold text-[#1E3A2F] dark:text-slate-100">
                    3. Month-wise Apr–Mar TDS vs TCS Matrix (Click Month to Drill)
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#1E3A5F] dark:bg-slate-800 text-white">
                      <tr>
                        <th className="px-3 py-2.5 font-bold">Month</th>
                        <th className="px-3 py-2.5 font-bold text-right">TDS Tax</th>
                        <th className="px-3 py-2.5 font-bold text-right">TCS Tax</th>
                        <th className="px-3 py-2.5 font-bold text-right">Total Tax</th>
                        <th className="px-3 py-2.5 font-bold text-right">Deposited</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2F3E4E]/10 dark:divide-slate-800">
                      {monthlyBreakdown.map((m) => (
                        <tr
                          key={m.month}
                          onClick={() => {
                            setTxQuery(m.month === 'Unspecified' ? '' : `-${m.month}-`);
                            setTaxRoleFilter('ALL');
                            setPartFilter('ALL');
                            setQuarterFilter('ALL');
                            setActiveTab('transactions');
                          }}
                          className="hover:bg-[#FEF2C8]/50 dark:hover:bg-slate-800/50 cursor-pointer"
                        >
                          <td className="px-3 py-2 font-bold text-[#2F3E4E] dark:text-slate-100">
                            {m.month} <span className="text-[10px] font-normal text-[#64748B]">({m.quarter.slice(0, 2)})</span>
                          </td>
                          <td className="px-3 py-2 font-mono tabular-nums text-right text-[#0369A1] dark:text-sky-300">{formatINR(m.tdsTax)}</td>
                          <td className="px-3 py-2 font-mono tabular-nums text-right text-[#12805C] dark:text-emerald-300">{formatINR(m.tcsTax)}</td>
                          <td className="px-3 py-2 font-mono tabular-nums text-right font-semibold text-[#2F3E4E] dark:text-slate-100">{formatINR(m.tdsTax + m.tcsTax)}</td>
                          <td className="px-3 py-2 font-mono tabular-nums text-right font-bold text-[#12805C] dark:text-emerald-400">{formatINR(m.tdsDep + m.tcsDep)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Tab 0B & 0C: Separate TDS Deductors & TCS Collectors Views */}
          {(activeTab === 'tds' || activeTab === 'tcs') && (() => {
            const isTcsView = activeTab === 'tcs';
            const rows = isTcsView ? tcsParties : tdsParties;
            const roleLabel = isTcsView ? 'TCS Collectors (Part IV / VI / VII)' : 'TDS Deductors (Part I / II / III / IV)';
            return (
              <div className="overflow-x-auto rounded-xl border-[1.5px] border-[#2F3E4E]/40 dark:border-slate-700 bg-white dark:bg-[#0B1120]">
                <div
                  className={`px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs font-display font-bold text-white ${
                    isTcsView ? 'bg-[#0F4C5C]' : 'bg-[#1E3A5F]'
                  }`}
                >
                  <span>{roleLabel} — {rows.length} Party Account(s)</span>
                  <button
                    type="button"
                    onClick={() => void handleConvertToExcel(isTcsView ? 'tcs' : 'tds')}
                    className="px-2.5 py-1 rounded bg-white/15 hover:bg-white/25 text-[11px] font-bold text-white cursor-pointer"
                  >
                    Download {isTcsView ? 'TCS-Only' : 'TDS-Only'} .xlsx
                  </button>
                </div>
                {rows.length === 0 ? (
                  <p className="p-6 text-xs text-center text-[#64748B] dark:text-slate-400">
                    No {isTcsView ? 'TCS Collector' : 'TDS Deductor'} entries detected in this Form 26AS statement.
                  </p>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#E8F0FE] dark:bg-slate-800 text-[#1E3A5F] dark:text-slate-100">
                      <tr>
                        <th className="px-3 py-2.5 font-bold">#</th>
                        <th className="px-3 py-2.5 font-bold">Part</th>
                        <th className="px-3 py-2.5 font-bold">{isTcsView ? 'Collector Name' : 'Deductor Name'}</th>
                        <th className="px-3 py-2.5 font-bold">TAN</th>
                        <th className="px-3 py-2.5 font-bold">PAN</th>
                        <th className="px-3 py-2.5 font-bold text-right">Txns</th>
                        <th className="px-3 py-2.5 font-bold text-right">Rev</th>
                        <th className="px-3 py-2.5 font-bold text-right">Net Basis</th>
                        <th className="px-3 py-2.5 font-bold text-right">{isTcsView ? 'TCS Collected' : 'TDS Deducted'}</th>
                        <th className="px-3 py-2.5 font-bold text-right">Deposited</th>
                        <th className="px-3 py-2.5 font-bold text-right">Rate %</th>
                        <th className="px-3 py-2.5 font-bold text-center">Check</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2F3E4E]/10 dark:divide-slate-800">
                      {rows.map((party, idx) => (
                        <tr
                          key={`${party.part}-${party.tan}`}
                          onClick={() => {
                            setTaxRoleFilter(isTcsView ? 'TCS' : 'TDS');
                            setPartFilter(party.part);
                            setTxQuery(party.tan);
                            setQuarterFilter('ALL');
                            setNatureFilter('ALL');
                            setBookingFilter('ALL');
                            setActiveTab('transactions');
                          }}
                          className="hover:bg-[#FEF2C8]/55 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                        >
                          <td className="px-3 py-2.5 font-mono font-bold text-[#2F3E4E] dark:text-slate-200">{idx + 1}</td>
                          <td className="px-3 py-2.5 text-[#475569] dark:text-slate-300 whitespace-nowrap">{party.part}</td>
                          <td className="px-3 py-2.5 font-semibold text-[#2F3E4E] dark:text-slate-100">{party.partyName}</td>
                          <td className="px-3 py-2.5 font-mono font-bold text-[#0369A1] dark:text-[#F9C80E] whitespace-nowrap">{party.tan}</td>
                          <td className="px-3 py-2.5 font-mono text-[#475569] dark:text-slate-300 whitespace-nowrap">{party.partyPan || '-'}</td>
                          <td className="px-3 py-2.5 font-mono tabular-nums text-right">{party.transactionCount}</td>
                          <td className="px-3 py-2.5 font-mono tabular-nums text-right text-[#64748B]">{party.reversalCount > 0 ? party.reversalCount : '-'}</td>
                          <td className="px-3 py-2.5 font-mono tabular-nums text-right">{formatINR(party.extractedAmountPaid)}</td>
                          <td className="px-3 py-2.5 font-mono tabular-nums text-right font-semibold">{formatINR(party.extractedTaxDeducted)}</td>
                          <td className="px-3 py-2.5 font-mono tabular-nums text-right font-bold text-[#12805C] dark:text-emerald-400">{formatINR(party.extractedTdsDeposited)}</td>
                          <td className="px-3 py-2.5 font-mono tabular-nums text-right">{calcEffRatePct(party.extractedTaxDeducted, party.extractedAmountPaid)}</td>
                          <td className="px-3 py-2.5 text-center whitespace-nowrap">
                            <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold ${party.verificationStatus === 'Verified' ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300' : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300'}`}>
                              {party.verificationStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-[#FEF2C8]/85 dark:bg-slate-800/90 font-bold border-t-2 border-[#2F3E4E]/30 dark:border-slate-600">
                      <tr>
                        <td colSpan={5} className="px-3 py-2.5 text-[#2F3E4E] dark:text-slate-100">
                          {isTcsView ? 'TCS COLLECTORS' : 'TDS DEDUCTORS'} TOTAL ({rows.length} Accounts)
                        </td>
                        <td className="px-3 py-2.5 font-mono tabular-nums text-right">{rows.reduce((s, p) => s + p.transactionCount, 0)}</td>
                        <td className="px-3 py-2.5 font-mono tabular-nums text-right">{rows.reduce((s, p) => s + p.reversalCount, 0)}</td>
                        <td className="px-3 py-2.5 font-mono tabular-nums text-right">{formatINR(rows.reduce((s, p) => s + p.extractedAmountPaid, 0))}</td>
                        <td className="px-3 py-2.5 font-mono tabular-nums text-right">{formatINR(rows.reduce((s, p) => s + p.extractedTaxDeducted, 0))}</td>
                        <td className="px-3 py-2.5 font-mono tabular-nums text-right text-[#12805C] dark:text-emerald-400">{formatINR(rows.reduce((s, p) => s + p.extractedTdsDeposited, 0))}</td>
                        <td className="px-3 py-2.5 font-mono tabular-nums text-right">
                          {calcEffRatePct(rows.reduce((s, p) => s + p.extractedTaxDeducted, 0), rows.reduce((s, p) => s + p.extractedAmountPaid, 0))}
                        </td>
                        <td className="px-3 py-2.5 text-center text-[11px] text-[#12805C] dark:text-emerald-400">
                          {rows.filter((p) => p.verificationStatus === 'Verified').length}/{rows.length} OK
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            );
          })()}

          {/* Tab 1: All Parties Summary & Subtotal Cross-Check */}
          {activeTab === 'parties' && (
            <div className="overflow-x-auto rounded-xl border-[1.5px] border-[#2F3E4E]/40 dark:border-slate-700 bg-white dark:bg-[#0B1120]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#1E3A5F] dark:bg-slate-800 text-white">
                  <tr>
                    <th className="px-3 py-3 font-bold">#</th>
                    <th className="px-3 py-3 font-bold">Role</th>
                    <th className="px-3 py-3 font-bold">Part</th>
                    <th className="px-3 py-3 font-bold">Deductor / Collector</th>
                    <th className="px-3 py-3 font-bold">TAN</th>
                    <th className="px-3 py-3 font-bold">PAN of Party</th>
                    <th className="px-3 py-3 font-bold text-right">Txns</th>
                    <th className="px-3 py-3 font-bold text-right">Rev</th>
                    <th className="px-3 py-3 font-bold text-right">Net Paid</th>
                    <th className="px-3 py-3 font-bold text-right">Tax Ded/Col</th>
                    <th className="px-3 py-3 font-bold text-right">Deposited</th>
                    <th className="px-3 py-3 font-bold text-right">Rate %</th>
                    <th className="px-3 py-3 font-bold text-center">Check</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2F3E4E]/10 dark:divide-slate-800">
                  {filteredParties.map((party) => {
                    const role = classify26ASTaxType(party);
                    return (
                      <tr
                        key={`${party.part}-${party.tan}`}
                        onClick={() => {
                          setTaxRoleFilter(role);
                          setPartFilter(party.part);
                          setTxQuery(party.tan);
                          setQuarterFilter('ALL');
                          setNatureFilter('ALL');
                          setBookingFilter('ALL');
                          setActiveTab('transactions');
                        }}
                        title={`Click to view ${party.transactionCount} transaction(s) for ${party.partyName}`}
                        className="hover:bg-[#FEF2C8]/55 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                      >
                        <td className="px-3 py-3 font-mono font-bold text-[#2F3E4E] dark:text-slate-200">
                          {party.srNo}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                              role === 'TCS'
                                ? 'bg-emerald-100 dark:bg-emerald-950/80 text-[#12805C] dark:text-emerald-300'
                                : 'bg-sky-100 dark:bg-sky-950/80 text-[#0369A1] dark:text-sky-300'
                            }`}
                          >
                            {role}
                          </span>
                        </td>
                        <td className="px-3 py-3 font-medium text-[#475569] dark:text-slate-300 whitespace-nowrap">
                          {party.part}
                        </td>
                        <td className="px-3 py-3 font-semibold text-[#2F3E4E] dark:text-slate-100">
                          {party.partyName}
                        </td>
                        <td className="px-3 py-3 font-mono font-bold text-[#0369A1] dark:text-[#F9C80E] whitespace-nowrap">
                          {party.tan}
                        </td>
                        <td
                          className={`px-3 py-3 font-mono whitespace-nowrap ${
                            party.partyPan && party.partyPan !== '-'
                              ? 'font-semibold text-[#2F3E4E] dark:text-slate-200'
                              : 'text-[#94A3B8] dark:text-slate-500'
                          }`}
                        >
                          {party.partyPan || '-'}
                        </td>
                        <td className="px-3 py-3 font-mono tabular-nums text-right text-[#475569] dark:text-slate-300">
                          {party.transactionCount}
                        </td>
                        <td className="px-3 py-3 font-mono tabular-nums text-right text-[#64748B] dark:text-slate-400">
                          {party.reversalCount > 0 ? party.reversalCount : '-'}
                        </td>
                        <td className="px-3 py-3 font-mono tabular-nums text-right text-[#2F3E4E] dark:text-slate-200">
                          {formatINR(party.extractedAmountPaid)}
                        </td>
                        <td className="px-3 py-3 font-mono tabular-nums text-right font-semibold text-[#2F3E4E] dark:text-slate-100">
                          {formatINR(party.extractedTaxDeducted)}
                        </td>
                        <td className="px-3 py-3 font-mono tabular-nums text-right font-bold text-[#12805C] dark:text-emerald-400">
                          {formatINR(party.extractedTdsDeposited)}
                        </td>
                        <td className="px-3 py-3 font-mono tabular-nums text-right text-[#475569] dark:text-slate-300">
                          {calcEffRatePct(party.extractedTaxDeducted, party.extractedAmountPaid)}
                        </td>
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                              party.verificationStatus === 'Verified'
                                ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300'
                                : party.verificationStatus === 'Subtotal Variance'
                                  ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {party.verificationStatus}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-[#FEF2C8]/85 dark:bg-slate-800/90 font-bold border-t-2 border-[#2F3E4E]/30 dark:border-slate-600">
                  <tr>
                    <td colSpan={6} className="px-3 py-3 text-[#2F3E4E] dark:text-slate-100">
                      TOTAL ({filteredParties.length} Party Accounts)
                    </td>
                    <td className="px-3 py-3 font-mono tabular-nums text-right text-[#2F3E4E] dark:text-slate-100">
                      {filteredParties.reduce((s, p) => s + p.transactionCount, 0)}
                    </td>
                    <td className="px-3 py-3 font-mono tabular-nums text-right text-[#475569] dark:text-slate-300">
                      {filteredParties.reduce((s, p) => s + p.reversalCount, 0)}
                    </td>
                    <td className="px-3 py-3 font-mono tabular-nums text-right text-[#2F3E4E] dark:text-slate-100">
                      {formatINR(filteredParties.reduce((s, p) => s + p.extractedAmountPaid, 0))}
                    </td>
                    <td className="px-3 py-3 font-mono tabular-nums text-right text-[#2F3E4E] dark:text-slate-100">
                      {formatINR(filteredParties.reduce((s, p) => s + p.extractedTaxDeducted, 0))}
                    </td>
                    <td className="px-3 py-3 font-mono tabular-nums text-right text-[#12805C] dark:text-emerald-400">
                      {formatINR(filteredParties.reduce((s, p) => s + p.extractedTdsDeposited, 0))}
                    </td>
                    <td className="px-3 py-3 font-mono tabular-nums text-right text-[#2F3E4E] dark:text-slate-100">
                      {calcEffRatePct(
                        filteredParties.reduce((s, p) => s + p.extractedTaxDeducted, 0),
                        filteredParties.reduce((s, p) => s + p.extractedAmountPaid, 0)
                      )}
                    </td>
                    <td className="px-3 py-3 text-center text-[11px] text-[#12805C] dark:text-emerald-400">
                      {totals.verifiedParties}/{parsed.parties.length} OK
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Tab 2: Section-wise, Quarter-wise & Monthly Breakdown */}
          {activeTab === 'sections' && (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-xl border-[1.5px] border-[#2F3E4E]/40 dark:border-slate-700 bg-white dark:bg-[#0B1120]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#1E3A5F] dark:bg-slate-800 text-white">
                    <tr>
                      <th className="px-3 py-3 font-bold">Role</th>
                      <th className="px-3 py-3 font-bold">Part</th>
                      <th className="px-3 py-3 font-bold">Section</th>
                      <th className="px-3 py-3 font-bold">1961 Eq.</th>
                      <th className="px-3 py-3 font-bold">Statutory Description (IT Act 2025)</th>
                      <th className="px-3 py-3 font-bold text-right">Txns</th>
                      <th className="px-3 py-3 font-bold text-right">Rev</th>
                      <th className="px-3 py-3 font-bold text-right">Gross Credit</th>
                      <th className="px-3 py-3 font-bold text-right">Reversal</th>
                      <th className="px-3 py-3 font-bold text-right">Net Paid</th>
                      <th className="px-3 py-3 font-bold text-right">Net Tax</th>
                      <th className="px-3 py-3 font-bold text-right">Eff Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2F3E4E]/10 dark:divide-slate-800">
                    {filteredSectionBreakdown.map((sec) => {
                      const meta = lookupSectionMeta(sec.section);
                      return (
                        <tr
                          key={`${sec.part}-${sec.section}`}
                          onClick={() => {
                            setTaxRoleFilter(sec.role);
                            setPartFilter(sec.part);
                            setTxQuery(sec.section);
                            setQuarterFilter('ALL');
                            setNatureFilter('ALL');
                            setBookingFilter('ALL');
                            setActiveTab('transactions');
                          }}
                          className="hover:bg-[#FEF2C8]/50 dark:hover:bg-slate-800/50 cursor-pointer"
                        >
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                                sec.role === 'TCS'
                                  ? 'bg-emerald-100 dark:bg-emerald-950/80 text-[#12805C] dark:text-emerald-300'
                                  : 'bg-sky-100 dark:bg-sky-950/80 text-[#0369A1] dark:text-sky-300'
                              }`}
                            >
                              {sec.role}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-[#475569] dark:text-slate-300 whitespace-nowrap">
                            {sec.part}
                          </td>
                          <td className="px-3 py-2.5 font-mono font-bold text-[#0369A1] dark:text-[#F9C80E] whitespace-nowrap">
                            {sec.section}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[#64748B] dark:text-slate-400 whitespace-nowrap">
                            {meta.oldActEq}
                          </td>
                          <td className="px-3 py-2.5 text-[#2F3E4E] dark:text-slate-200">
                            <span className="font-medium">{meta.description}</span>
                            <span className="ml-1.5 text-[11px] text-[#64748B] dark:text-slate-400">
                              [{meta.statutoryRef}]
                            </span>
                          </td>
                          <td className="px-3 py-2.5 font-mono tabular-nums text-right text-[#475569] dark:text-slate-300">
                            {sec.txns}
                          </td>
                          <td className="px-3 py-2.5 font-mono tabular-nums text-right text-[#64748B] dark:text-slate-400">
                            {sec.revs > 0 ? sec.revs : '-'}
                          </td>
                          <td className="px-3 py-2.5 font-mono tabular-nums text-right text-[#475569] dark:text-slate-300">
                            {formatINR(sec.grossPaid)}
                          </td>
                          <td className="px-3 py-2.5 font-mono tabular-nums text-right text-rose-700 dark:text-rose-400">
                            {sec.revPaid !== 0 ? formatINR(sec.revPaid) : '-'}
                          </td>
                          <td className="px-3 py-2.5 font-mono tabular-nums text-right text-[#2F3E4E] dark:text-slate-200">
                            {formatINR(sec.paid)}
                          </td>
                          <td className="px-3 py-2.5 font-mono tabular-nums text-right font-bold text-[#12805C] dark:text-emerald-400">
                            {formatINR(sec.tax)}
                          </td>
                          <td className="px-3 py-2.5 font-mono tabular-nums text-right text-[#2F3E4E] dark:text-slate-200">
                            {calcEffRatePct(sec.tax, sec.paid)}
                            {meta.standardRatePct !== null ? (
                              <span className="block text-[10px] text-[#64748B] dark:text-slate-400">
                                std {meta.standardRatePct}%
                              </span>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="overflow-x-auto rounded-xl border-[1.5px] border-[#2F3E4E]/40 dark:border-slate-700 bg-white dark:bg-[#0B1120]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#1E3A5F] dark:bg-slate-800 text-white">
                    <tr>
                      <th className="px-3.5 py-3 font-bold">Fiscal Quarter</th>
                      <th className="px-3.5 py-3 font-bold text-right">Txns</th>
                      <th className="px-3.5 py-3 font-bold text-right">Reversals</th>
                      <th className="px-3.5 py-3 font-bold text-right">Net Paid / Received</th>
                      <th className="px-3.5 py-3 font-bold text-right">TDS (Deductors)</th>
                      <th className="px-3.5 py-3 font-bold text-right">TCS (Collectors)</th>
                      <th className="px-3.5 py-3 font-bold text-right">Total Deposited</th>
                      <th className="px-3.5 py-3 font-bold text-right">Eff Rate %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2F3E4E]/10 dark:divide-slate-800">
                    {quarterBreakdown.map((q) => (
                      <tr
                        key={q.quarter}
                        onClick={() => {
                          setQuarterFilter(q.quarter);
                          setTaxRoleFilter('ALL');
                          setPartFilter('ALL');
                          setTxQuery('');
                          setNatureFilter('ALL');
                          setBookingFilter('ALL');
                          setActiveTab('transactions');
                        }}
                        className="hover:bg-[#FEF2C8]/50 dark:hover:bg-slate-800/50 cursor-pointer"
                      >
                        <td className="px-3.5 py-2.5 font-bold text-[#2F3E4E] dark:text-slate-100">
                          {q.quarter}
                        </td>
                        <td className="px-3.5 py-2.5 font-mono tabular-nums text-right text-[#475569] dark:text-slate-300">
                          {q.txns}
                        </td>
                        <td className="px-3.5 py-2.5 font-mono tabular-nums text-right text-[#64748B] dark:text-slate-400">
                          {q.revs > 0 ? q.revs : '-'}
                        </td>
                        <td className="px-3.5 py-2.5 font-mono tabular-nums text-right text-[#2F3E4E] dark:text-slate-200">
                          {formatINR(q.paid)}
                        </td>
                        <td className="px-3.5 py-2.5 font-mono tabular-nums text-right font-semibold text-[#0369A1] dark:text-sky-300">
                          {formatINR(q.tds)}
                        </td>
                        <td className="px-3.5 py-2.5 font-mono tabular-nums text-right font-semibold text-[#12805C] dark:text-emerald-300">
                          {formatINR(q.tcs)}
                        </td>
                        <td className="px-3.5 py-2.5 font-mono tabular-nums text-right font-bold text-[#12805C] dark:text-emerald-400">
                          {formatINR(q.dep)}
                        </td>
                        <td className="px-3.5 py-2.5 font-mono tabular-nums text-right text-[#475569] dark:text-slate-300">
                          {calcEffRatePct(q.tds + q.tcs, q.paid)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {monthlyBreakdown.length > 0 && (
                <div className="overflow-x-auto rounded-xl border-[1.5px] border-[#2F3E4E]/40 dark:border-slate-700 bg-white dark:bg-[#0B1120]">
                  <div className="px-4 py-2.5 bg-[#EBF5FF] dark:bg-slate-800 border-b border-[#2F3E4E]/15 dark:border-slate-700 text-xs font-display font-bold text-[#1E3A5F] dark:text-slate-100">
                    Month-by-Month Apr–Mar Bifurcation (TDS vs TCS Monthly Cashflow)
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#1E3A5F] dark:bg-slate-800 text-white">
                      <tr>
                        <th className="px-3 py-2.5 font-bold">Month</th>
                        <th className="px-3 py-2.5 font-bold">Quarter</th>
                        <th className="px-3 py-2.5 font-bold text-right">TDS Txns</th>
                        <th className="px-3 py-2.5 font-bold text-right">TDS Basis</th>
                        <th className="px-3 py-2.5 font-bold text-right">TDS Deducted</th>
                        <th className="px-3 py-2.5 font-bold text-right">TCS Txns</th>
                        <th className="px-3 py-2.5 font-bold text-right">TCS Basis</th>
                        <th className="px-3 py-2.5 font-bold text-right">TCS Collected</th>
                        <th className="px-3 py-2.5 font-bold text-right">Total Deposited</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2F3E4E]/10 dark:divide-slate-800">
                      {monthlyBreakdown.map((m) => (
                        <tr
                          key={m.month}
                          onClick={() => {
                            setTxQuery(m.month === 'Unspecified' ? '' : `-${m.month}-`);
                            setTaxRoleFilter('ALL');
                            setPartFilter('ALL');
                            setQuarterFilter('ALL');
                            setActiveTab('transactions');
                          }}
                          className="hover:bg-[#FEF2C8]/50 dark:hover:bg-slate-800/50 cursor-pointer"
                        >
                          <td className="px-3 py-2 font-bold text-[#2F3E4E] dark:text-slate-100">{m.month}</td>
                          <td className="px-3 py-2 text-[#64748B] dark:text-slate-400">{m.quarter}</td>
                          <td className="px-3 py-2 font-mono tabular-nums text-right">{m.tdsTxns}</td>
                          <td className="px-3 py-2 font-mono tabular-nums text-right">{formatINR(m.tdsPaid)}</td>
                          <td className="px-3 py-2 font-mono tabular-nums text-right font-semibold text-[#0369A1] dark:text-sky-300">{formatINR(m.tdsTax)}</td>
                          <td className="px-3 py-2 font-mono tabular-nums text-right">{m.tcsTxns}</td>
                          <td className="px-3 py-2 font-mono tabular-nums text-right">{formatINR(m.tcsPaid)}</td>
                          <td className="px-3 py-2 font-mono tabular-nums text-right font-semibold text-[#12805C] dark:text-emerald-300">{formatINR(m.tcsTax)}</td>
                          <td className="px-3 py-2 font-mono tabular-nums text-right font-bold text-[#12805C] dark:text-emerald-400">{formatINR(m.tdsDep + m.tcsDep)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Detailed Transaction Ledger */}
          {activeTab === 'transactions' && (
            <div className="overflow-x-auto rounded-xl border-[1.5px] border-[#2F3E4E]/40 dark:border-slate-700 bg-white dark:bg-[#0B1120]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#1E3A5F] dark:bg-slate-800 text-white">
                  <tr>
                    <th className="px-2.5 py-3 font-bold">Ref</th>
                    <th className="px-2.5 py-3 font-bold">Role</th>
                    <th className="px-2.5 py-3 font-bold">Part</th>
                    <th className="px-2.5 py-3 font-bold">Party Name</th>
                    <th className="px-2.5 py-3 font-bold">TAN</th>
                    <th className="px-2.5 py-3 font-bold">PAN</th>
                    <th className="px-2.5 py-3 font-bold">Sec</th>
                    <th className="px-2.5 py-3 font-bold">Txn Date</th>
                    <th className="px-2.5 py-3 font-bold text-center">Status</th>
                    <th className="px-2.5 py-3 font-bold text-center">Rmk</th>
                    <th className="px-2.5 py-3 font-bold text-right">Basis Amt</th>
                    <th className="px-2.5 py-3 font-bold text-right">Tax</th>
                    <th className="px-2.5 py-3 font-bold text-right">Deposited</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2F3E4E]/10 dark:divide-slate-800">
                  {filteredTransactions.map((tx) => {
                    const isNeg = tx.entryNature === 'Reversal' || tx.amountPaid < 0 || tx.taxDeducted < 0;
                    const role = classify26ASTaxType(tx);
                    return (
                      <tr
                        key={tx.id}
                        className={`hover:bg-[#FEF2C8]/45 dark:hover:bg-slate-800/50 ${
                          isNeg ? 'bg-rose-50/40 dark:bg-rose-950/20' : ''
                        }`}
                      >
                        <td className="px-2.5 py-2.5 font-mono text-[#64748B] dark:text-slate-400 whitespace-nowrap">
                          {tx.txSrNo || tx.srNo}
                        </td>
                        <td className="px-2.5 py-2.5 whitespace-nowrap">
                          <span
                            className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              role === 'TCS'
                                ? 'bg-emerald-100 dark:bg-emerald-950/80 text-[#12805C] dark:text-emerald-300'
                                : 'bg-sky-100 dark:bg-sky-950/80 text-[#0369A1] dark:text-sky-300'
                            }`}
                          >
                            {role}
                          </span>
                        </td>
                        <td className="px-2.5 py-2.5 text-[#475569] dark:text-slate-300 whitespace-nowrap">
                          {tx.part.replace(/\s*\(.*\)/, '')}
                        </td>
                        <td className="px-2.5 py-2.5 font-semibold text-[#2F3E4E] dark:text-slate-100 max-w-[195px] truncate">
                          {tx.partyName}
                        </td>
                        <td className="px-2.5 py-2.5 font-mono font-bold text-[#2F3E4E] dark:text-[#F9C80E] whitespace-nowrap">
                          {tx.tan}
                        </td>
                        <td className="px-2.5 py-2.5 font-mono text-[#475569] dark:text-slate-300 whitespace-nowrap">
                          {tx.partyPan || '-'}
                        </td>
                        <td className="px-2.5 py-2.5 font-mono text-[#2F3E4E] dark:text-slate-200 whitespace-nowrap">
                          {tx.section}
                        </td>
                        <td className="px-2.5 py-2.5 font-mono text-[#475569] dark:text-slate-300 whitespace-nowrap">
                          {tx.transactionDate}
                        </td>
                        <td className="px-2.5 py-2.5 text-center font-mono font-bold text-[#12805C] dark:text-emerald-400">
                          {tx.bookingStatus}
                        </td>
                        <td className="px-2.5 py-2.5 text-center font-mono font-bold text-[#64748B] dark:text-slate-300">
                          {tx.remarks}
                        </td>
                        <td
                          className={`px-2.5 py-2.5 font-mono tabular-nums text-right ${
                            tx.amountPaid < 0
                              ? 'text-rose-700 dark:text-rose-400 font-semibold'
                              : 'text-[#2F3E4E] dark:text-slate-200'
                          }`}
                        >
                          {formatINR(tx.amountPaid)}
                        </td>
                        <td
                          className={`px-2.5 py-2.5 font-mono tabular-nums text-right font-semibold ${
                            tx.taxDeducted < 0
                              ? 'text-rose-700 dark:text-rose-400'
                              : 'text-[#2F3E4E] dark:text-slate-100'
                          }`}
                        >
                          {formatINR(tx.taxDeducted)}
                        </td>
                        <td
                          className={`px-2.5 py-2.5 font-mono tabular-nums text-right font-bold ${
                            tx.tdsDeposited < 0
                              ? 'text-rose-700 dark:text-rose-400'
                              : 'text-[#12805C] dark:text-emerald-400'
                          }`}
                        >
                          {formatINR(tx.tdsDeposited)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-[#FEF2C8]/85 dark:bg-slate-800/90 font-bold border-t-2 border-[#2F3E4E]/30 dark:border-slate-600">
                  <tr>
                    <td colSpan={10} className="px-2.5 py-2.5 text-[#2F3E4E] dark:text-slate-100">
                      FILTERED SUBTOTAL ({filteredTransactions.length} row(s))
                    </td>
                    <td className="px-2.5 py-2.5 font-mono tabular-nums text-right text-[#2F3E4E] dark:text-slate-100">
                      {formatINR(filteredTotals.paid)}
                    </td>
                    <td className="px-2.5 py-2.5 font-mono tabular-nums text-right text-[#2F3E4E] dark:text-slate-100">
                      {formatINR(filteredTotals.tax)}
                    </td>
                    <td className="px-2.5 py-2.5 font-mono tabular-nums text-right text-[#12805C] dark:text-emerald-400">
                      {formatINR(filteredTotals.dep)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Tab 4: Reversals, Statement Coverage & Missing PAN Audit */}
          {activeTab === 'audit' && (
            <div className="space-y-4">
              {/* Official Part I–XI Statement Coverage */}
              {parsed.partCoverage && parsed.partCoverage.length > 0 && (
                <div className="overflow-x-auto rounded-xl border-[1.5px] border-[#2F3E4E]/40 dark:border-slate-700 bg-white dark:bg-[#0B1120]">
                  <div className="px-4 py-2.5 bg-[#EBF5FF] dark:bg-slate-800 border-b border-[#2F3E4E]/15 dark:border-slate-700 text-xs font-display font-bold text-[#1E3A5F] dark:text-slate-100">
                    Statement Parts I – XI Coverage &amp; Official Header Summary Reconciliation
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#1E3A5F] dark:bg-slate-800 text-white">
                      <tr>
                        <th className="px-3.5 py-2.5 font-bold">Part</th>
                        <th className="px-3.5 py-2.5 font-bold">Form 26AS Section</th>
                        <th className="px-3.5 py-2.5 font-bold text-right">Parties</th>
                        <th className="px-3.5 py-2.5 font-bold text-right">Txns</th>
                        <th className="px-3.5 py-2.5 font-bold text-right">Amount Paid / Recd</th>
                        <th className="px-3.5 py-2.5 font-bold text-right">Tax Amount</th>
                        <th className="px-3.5 py-2.5 font-bold text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2F3E4E]/10 dark:divide-slate-800">
                      {parsed.partCoverage.map((pc) => (
                        <tr key={pc.part} className="hover:bg-[#FEF2C8]/45 dark:hover:bg-slate-800/40">
                          <td className="px-3.5 py-2.5 font-mono font-bold text-[#2F3E4E] dark:text-slate-100 whitespace-nowrap">
                            {pc.part}
                          </td>
                          <td className="px-3.5 py-2.5 text-[#475569] dark:text-slate-300">
                            {pc.title}
                          </td>
                          <td className="px-3.5 py-2.5 font-mono tabular-nums text-right text-[#475569] dark:text-slate-300">
                            {pc.partyCount}
                          </td>
                          <td className="px-3.5 py-2.5 font-mono tabular-nums text-right text-[#475569] dark:text-slate-300">
                            {pc.txCount}
                          </td>
                          <td className="px-3.5 py-2.5 font-mono tabular-nums text-right text-[#2F3E4E] dark:text-slate-200">
                            {formatINR(pc.amountPaid)}
                          </td>
                          <td className="px-3.5 py-2.5 font-mono tabular-nums text-right font-semibold text-[#12805C] dark:text-emerald-400">
                            {formatINR(pc.taxAmount)}
                          </td>
                          <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold ${
                                pc.hasTransactions
                                  ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                              }`}
                            >
                              {pc.hasTransactions ? 'Active' : 'No Transactions'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Short Deposit & Unmatched / Overbooked Exceptions */}
              {shortDepositOrUnmatchedTxs.length > 0 && (
                <div className="overflow-x-auto rounded-xl border-[1.5px] border-rose-500/40 bg-white dark:bg-[#0B1120]">
                  <div className="px-4 py-2.5 bg-rose-50 dark:bg-rose-950/40 border-b border-rose-500/20 text-xs font-display font-bold text-rose-900 dark:text-rose-200">
                    Short Deposit &amp; Non-Final Status Exceptions ({shortDepositOrUnmatchedTxs.length} Row(s) · Follow-up Required Before ITR Claim)
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#1E3A5F] dark:bg-slate-800 text-white">
                      <tr>
                        <th className="px-3 py-2.5 font-bold">Role</th>
                        <th className="px-3 py-2.5 font-bold">Party Name</th>
                        <th className="px-3 py-2.5 font-bold">TAN</th>
                        <th className="px-3 py-2.5 font-bold">Sec</th>
                        <th className="px-3 py-2.5 font-bold">Date</th>
                        <th className="px-3 py-2.5 font-bold text-center">Status</th>
                        <th className="px-3 py-2.5 font-bold text-right">Tax</th>
                        <th className="px-3 py-2.5 font-bold text-right">Deposited</th>
                        <th className="px-3 py-2.5 font-bold text-right">Short Diff</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2F3E4E]/10 dark:divide-slate-800">
                      {shortDepositOrUnmatchedTxs.map((tx) => (
                        <tr key={`short-${tx.id}`} className="hover:bg-[#FEF2C8]/45 dark:hover:bg-slate-800/40">
                          <td className="px-3 py-2 font-bold">{classify26ASTaxType(tx)}</td>
                          <td className="px-3 py-2 font-semibold text-[#2F3E4E] dark:text-slate-100">{tx.partyName}</td>
                          <td className="px-3 py-2 font-mono text-[#0369A1] dark:text-[#F9C80E]">{tx.tan}</td>
                          <td className="px-3 py-2 font-mono">{tx.section}</td>
                          <td className="px-3 py-2 font-mono">{tx.transactionDate}</td>
                          <td className="px-3 py-2 text-center font-mono font-bold text-amber-700 dark:text-amber-300">{tx.bookingStatus}</td>
                          <td className="px-3 py-2 font-mono tabular-nums text-right">{formatINR(tx.taxDeducted)}</td>
                          <td className="px-3 py-2 font-mono tabular-nums text-right">{formatINR(tx.tdsDeposited)}</td>
                          <td className="px-3 py-2 font-mono tabular-nums text-right font-bold text-rose-700 dark:text-rose-400">
                            {formatINR(tx.taxDeducted - tx.tdsDeposited)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Statutory Rate Deviation Check */}
              {rateVarianceTxs.length > 0 && (
                <div className="overflow-x-auto rounded-xl border-[1.5px] border-purple-500/40 bg-white dark:bg-[#0B1120]">
                  <div className="px-4 py-2.5 bg-purple-50 dark:bg-purple-950/35 border-b border-purple-500/20 text-xs font-display font-bold text-purple-900 dark:text-purple-200">
                    Statutory Rate Deviation Audit ({rateVarianceTxs.length} Row(s) &gt; 2.5% Variance vs Fixed Act Rate)
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#1E3A5F] dark:bg-slate-800 text-white">
                      <tr>
                        <th className="px-3 py-2.5 font-bold">Role</th>
                        <th className="px-3 py-2.5 font-bold">Party Name</th>
                        <th className="px-3 py-2.5 font-bold">Sec (1961 Eq)</th>
                        <th className="px-3 py-2.5 font-bold">Date</th>
                        <th className="px-3 py-2.5 font-bold text-right">Basis Amt</th>
                        <th className="px-3 py-2.5 font-bold text-right">Tax</th>
                        <th className="px-3 py-2.5 font-bold text-right">Actual %</th>
                        <th className="px-3 py-2.5 font-bold text-right">Std Rate %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2F3E4E]/10 dark:divide-slate-800">
                      {rateVarianceTxs.slice(0, 60).map((tx) => {
                        const meta = lookupSectionMeta(tx.section);
                        return (
                          <tr key={`rate-${tx.id}`} className="hover:bg-[#FEF2C8]/45 dark:hover:bg-slate-800/40">
                            <td className="px-3 py-2 font-bold">{classify26ASTaxType(tx)}</td>
                            <td className="px-3 py-2 font-semibold text-[#2F3E4E] dark:text-slate-100">{tx.partyName}</td>
                            <td className="px-3 py-2 font-mono">{tx.section} ({meta.oldActEq})</td>
                            <td className="px-3 py-2 font-mono">{tx.transactionDate}</td>
                            <td className="px-3 py-2 font-mono tabular-nums text-right">{formatINR(tx.amountPaid)}</td>
                            <td className="px-3 py-2 font-mono tabular-nums text-right">{formatINR(tx.taxDeducted)}</td>
                            <td className="px-3 py-2 font-mono tabular-nums text-right font-bold text-purple-700 dark:text-purple-300">
                              {calcEffRatePct(tx.taxDeducted, tx.amountPaid)}
                            </td>
                            <td className="px-3 py-2 font-mono tabular-nums text-right">{meta.standardRatePct}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Missing PAN Parties */}
              {missingPanList.length > 0 && (
                <div className="overflow-x-auto rounded-xl border-[1.5px] border-amber-500/40 bg-white dark:bg-[#0B1120]">
                  <div className="px-4 py-2.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-500/20 text-xs font-display font-bold text-amber-900 dark:text-amber-300">
                    Deductors / Collectors with Missing PAN in Form 26AS ({missingPanList.length} Account(s) · Only TAN Available)
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#1E3A5F] dark:bg-slate-800 text-white">
                      <tr>
                        <th className="px-3.5 py-2.5 font-bold">Part</th>
                        <th className="px-3.5 py-2.5 font-bold">Party Name</th>
                        <th className="px-3.5 py-2.5 font-bold">TAN</th>
                        <th className="px-3.5 py-2.5 font-bold text-right">Txns</th>
                        <th className="px-3.5 py-2.5 font-bold text-right">Net Paid</th>
                        <th className="px-3.5 py-2.5 font-bold text-right">Tax Ded/Col</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2F3E4E]/10 dark:divide-slate-800">
                      {missingPanList.map((p) => (
                        <tr key={`${p.part}-${p.tan}`} className="hover:bg-[#FEF2C8]/45 dark:hover:bg-slate-800/40">
                          <td className="px-3.5 py-2.5 text-[#475569] dark:text-slate-300">{p.part}</td>
                          <td className="px-3.5 py-2.5 font-semibold text-[#2F3E4E] dark:text-slate-100">{p.partyName}</td>
                          <td className="px-3.5 py-2.5 font-mono font-bold text-[#0369A1] dark:text-[#F9C80E]">{p.tan}</td>
                          <td className="px-3.5 py-2.5 font-mono tabular-nums text-right">{p.transactionCount}</td>
                          <td className="px-3.5 py-2.5 font-mono tabular-nums text-right">{formatINR(p.extractedAmountPaid)}</td>
                          <td className="px-3.5 py-2.5 font-mono tabular-nums text-right font-semibold">{formatINR(p.extractedTaxDeducted)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Reversal & Rectification Entries */}
              <div className="overflow-x-auto rounded-xl border-[1.5px] border-[#2F3E4E]/40 dark:border-slate-700 bg-white dark:bg-[#0B1120]">
                <div className="px-4 py-2.5 bg-rose-50/70 dark:bg-rose-950/30 border-b border-[#2F3E4E]/15 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-display font-bold text-rose-900 dark:text-rose-200">
                    Reversal &amp; Rectification Ledger ({reversalTransactions.length} Entries · G = Reprocessing, B = Rectification)
                  </span>
                  <span className="font-mono font-bold text-rose-800 dark:text-rose-300">
                    Reversal Tax Impact: {formatINR(totals.reversalTax)}
                  </span>
                </div>
                {reversalTransactions.length === 0 ? (
                  <p className="p-4 text-xs text-[#64748B] dark:text-slate-400">
                    No reversal or negative rectification rows present in this Form 26AS statement.
                  </p>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#1E3A5F] dark:bg-slate-800 text-white">
                      <tr>
                        <th className="px-3 py-2.5 font-bold">26AS Ref</th>
                        <th className="px-3 py-2.5 font-bold">Party Name</th>
                        <th className="px-3 py-2.5 font-bold">TAN</th>
                        <th className="px-3 py-2.5 font-bold">Sec</th>
                        <th className="px-3 py-2.5 font-bold">Txn Date</th>
                        <th className="px-3 py-2.5 font-bold text-center">Rmk</th>
                        <th className="px-3 py-2.5 font-bold text-right">Reversal Paid</th>
                        <th className="px-3 py-2.5 font-bold text-right">Reversal Tax</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2F3E4E]/10 dark:divide-slate-800">
                      {reversalTransactions.map((tx) => (
                        <tr key={tx.id} className="bg-rose-50/35 dark:bg-rose-950/15 hover:bg-rose-50/70 dark:hover:bg-rose-950/30">
                          <td className="px-3 py-2 font-mono font-bold text-[#2F3E4E] dark:text-slate-200">
                            {tx.txSrNo || tx.srNo}
                          </td>
                          <td className="px-3 py-2 font-semibold text-[#2F3E4E] dark:text-slate-100">
                            {tx.partyName}
                          </td>
                          <td className="px-3 py-2 font-mono text-[#0369A1] dark:text-[#F9C80E]">
                            {tx.tan}
                          </td>
                          <td className="px-3 py-2 font-mono text-[#2F3E4E] dark:text-slate-200">
                            {tx.section}
                          </td>
                          <td className="px-3 py-2 font-mono text-[#475569] dark:text-slate-300">
                            {tx.transactionDate}
                          </td>
                          <td className="px-3 py-2 text-center font-mono font-bold text-rose-700 dark:text-rose-300">
                            {tx.remarks}
                          </td>
                          <td className="px-3 py-2 font-mono tabular-nums text-right text-rose-700 dark:text-rose-400">
                            {formatINR(tx.amountPaid)}
                          </td>
                          <td className="px-3 py-2 font-mono tabular-nums text-right font-bold text-rose-700 dark:text-rose-400">
                            {formatINR(tx.taxDeducted)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* Tab 5: Tax Paid Challans */}
          {activeTab === 'challans' && parsed.challans.length > 0 && (
            <div className="overflow-x-auto rounded-xl border-[1.5px] border-[#2F3E4E]/40 dark:border-slate-700 bg-white dark:bg-[#0B1120]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#1E3A5F] dark:bg-slate-800 text-white">
                  <tr>
                    <th className="px-3.5 py-3 font-bold">#</th>
                    <th className="px-3.5 py-3 font-bold">BSR Code</th>
                    <th className="px-3.5 py-3 font-bold">Deposit Date</th>
                    <th className="px-3.5 py-3 font-bold">Challan Serial</th>
                    <th className="px-3.5 py-3 font-bold">Major / Minor</th>
                    <th className="px-3.5 py-3 font-bold text-right">Total Tax Paid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2F3E4E]/10 dark:divide-slate-800">
                  {parsed.challans.map((ch) => (
                    <tr key={ch.srNo} className="hover:bg-[#FEF2C8]/45 dark:hover:bg-slate-800/50">
                      <td className="px-3.5 py-3 font-mono font-bold text-[#2F3E4E] dark:text-slate-200">
                        {ch.srNo}
                      </td>
                      <td className="px-3.5 py-3 font-mono text-[#2F3E4E] dark:text-slate-100">
                        {ch.bsrCode}
                      </td>
                      <td className="px-3.5 py-3 font-mono text-[#475569] dark:text-slate-300">
                        {ch.depositDate}
                      </td>
                      <td className="px-3.5 py-3 font-mono text-[#2F3E4E] dark:text-slate-200">
                        {ch.challanSerial}
                      </td>
                      <td className="px-3.5 py-3 font-mono text-[#475569] dark:text-slate-300">
                        {ch.majorHead} / {ch.minorHead}
                      </td>
                      <td className="px-3.5 py-3 font-mono tabular-nums text-right font-bold text-[#12805C] dark:text-emerald-400">
                        {formatINR(ch.totalTax)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="p-3.5 rounded-xl bg-[#FEF2C8]/65 dark:bg-[#0B1120] border border-[#2F3E4E]/20 dark:border-slate-700 text-xs text-[#475569] dark:text-slate-300 flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#2F3E4E] dark:text-[#F9C80E] shrink-0" />
            <span>
              Extracted {parsed.rawLineCount.toLocaleString()} text lines across {parsed.pageCount}{' '}
              page(s)/sheet(s) locally. Always cross-verify final tax credits against AIS &amp; Form
              26AS before ITR filing.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
