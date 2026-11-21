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
  ParsedForm26AS,
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

type PreviewTab = 'parties' | 'sections' | 'transactions' | 'audit' | 'challans';

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

  const [activeTab, setActiveTab] = useState<PreviewTab>('parties');
  const [partyQuery, setPartyQuery] = useState<string>('');
  const [txQuery, setTxQuery] = useState<string>('');
  const [partFilter, setPartFilter] = useState<string>('ALL');
  const [quarterFilter, setQuarterFilter] = useState<string>('ALL');
  const [natureFilter, setNatureFilter] = useState<'ALL' | 'Credit' | 'Reversal'>('ALL');

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
      setActiveTab('parties');
      setPartyQuery('');
      setTxQuery('');
      setPartFilter('ALL');
      setQuarterFilter('ALL');
      setNatureFilter('ALL');

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
    setActiveTab('parties');
    setPartyQuery('');
    setTxQuery('');
    setPartFilter('ALL');
    setQuarterFilter('ALL');
    setNatureFilter('ALL');

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
    setProgressState(null);
  };

  const handleConvertToExcel = async () => {
    if (
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
    updateProgress(10, 'Preparing Excel workbook...', `${parsed.transactions.length} transactions`);
    try {
      const buffer = await buildForm26ASWorkbook(parsed, {
        includeCombinedSheet,
        includePartySheets,
        includeSectionQuarterSummary,
        includeAuditSheet,
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
      a.download = `${getFileBaseTag(parsed)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.setTimeout(() => URL.revokeObjectURL(url), 1200);

      const sheetsIncluded = [
        includeCombinedSheet ? '26AS Combined (SUMIFS & SUBTOTAL)' : '',
        includePartySheets ? 'Party-wise + Party Summary' : '',
        includeSectionQuarterSummary ? 'Section & Quarter Audit' : '',
        includeAuditSheet ? 'Audit & Exceptions' : '',
      ].filter(Boolean);

      setStatusMsg(`Exported Excel workbook (${sheetsIncluded.join(' + ')}).`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to generate Excel workbook.');
    } finally {
      setIsExporting(false);
      finishProgress();
    }
  };

  const totals = useMemo(() => {
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
      };
    }
    const amountPaid = Number(
      parsed.transactions.reduce((acc, t) => acc + t.amountPaid, 0).toFixed(2)
    );
    const taxDeducted = Number(
      parsed.transactions.reduce((acc, t) => acc + t.taxDeducted, 0).toFixed(2)
    );
    const tdsDeposited = Number(
      parsed.transactions.reduce((acc, t) => acc + t.tdsDeposited, 0).toFixed(2)
    );
    const grossPaid = Number(
      parsed.transactions
        .filter((t) => t.entryNature !== 'Reversal')
        .reduce((acc, t) => acc + t.amountPaid, 0)
        .toFixed(2)
    );
    const reversalPaid = Number(
      parsed.transactions
        .filter((t) => t.entryNature === 'Reversal')
        .reduce((acc, t) => acc + t.amountPaid, 0)
        .toFixed(2)
    );
    const grossTax = Number(
      parsed.transactions
        .filter((t) => t.entryNature !== 'Reversal')
        .reduce((acc, t) => acc + t.taxDeducted, 0)
        .toFixed(2)
    );
    const reversalTax = Number(
      parsed.transactions
        .filter((t) => t.entryNature === 'Reversal')
        .reduce((acc, t) => acc + t.taxDeducted, 0)
        .toFixed(2)
    );
    const tdsTotal = Number(
      parsed.transactions
        .filter((t) => t.partyType !== 'Collector')
        .reduce((acc, t) => acc + t.taxDeducted, 0)
        .toFixed(2)
    );
    const tcsTotal = Number(
      parsed.transactions
        .filter((t) => t.partyType === 'Collector')
        .reduce((acc, t) => acc + t.taxDeducted, 0)
        .toFixed(2)
    );
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
    };
  }, [parsed]);

  const sectionBreakdown = useMemo(() => {
    if (!parsed) return [];
    const map = new Map<
      string,
      {
        part: string;
        section: string;
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
      if (tx.partyType === 'Collector') {
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

  const missingPanList = useMemo(() => {
    if (!parsed) return [];
    return parsed.parties.filter((p) => !p.partyPan || p.partyPan === '-');
  }, [parsed]);

  const filteredParties = useMemo(() => {
    if (!parsed) return [];
    const q = partyQuery.trim().toLowerCase();
    if (!q) return parsed.parties;
    return parsed.parties.filter((p) =>
      `${p.partyName} ${p.tan} ${p.partyPan} ${p.part}`.toLowerCase().includes(q)
    );
  }, [parsed, partyQuery]);

  const availableParts = useMemo(() => {
    if (!parsed) return [];
    return Array.from(new Set(parsed.transactions.map((t) => t.part)));
  }, [parsed]);

  const filteredTransactions = useMemo(() => {
    if (!parsed) return [];
    const q = txQuery.trim().toLowerCase();
    return parsed.transactions.filter((tx) => {
      if (partFilter !== 'ALL' && tx.part !== partFilter) return false;
      if (quarterFilter !== 'ALL' && getFiscalQuarter(tx.transactionDate) !== quarterFilter) return false;
      if (natureFilter !== 'ALL' && tx.entryNature !== natureFilter) return false;
      if (!q) return true;
      const hay = `${tx.txSrNo} ${tx.partyName} ${tx.tan} ${tx.partyPan} ${tx.section} ${tx.part} ${tx.transactionDate} ${tx.bookingStatus} ${tx.remarks}`.toLowerCase();
      return hay.includes(q);
    });
  }, [parsed, partFilter, quarterFilter, natureFilter, txQuery]);

  const filteredTotals = useMemo(() => {
    return {
      paid: filteredTransactions.reduce((s, t) => s + t.amountPaid, 0),
      tax: filteredTransactions.reduce((s, t) => s + t.taxDeducted, 0),
      dep: filteredTransactions.reduce((s, t) => s + t.tdsDeposited, 0),
    };
  }, [filteredTransactions]);

  const handleExportCsv = () => {
    if (!parsed || parsed.transactions.length === 0) return;
    downloadBomCsv({
      filename: `${getFileBaseTag(parsed)}.csv`,
      preambleLines: [
        ['FORM 26AS CONSOLIDATED STATEMENT', parsed.assesseeName],
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
        'Part',
        'Type',
        'Deductor / Collector Name',
        'TAN',
        'PAN of Party',
        'Section',
        '1961 Act Eq.',
        'Section Description',
        'Txn Date',
        'Fiscal Quarter',
        'Booking Status',
        'Booking Date',
        'Remarks',
        'Entry Nature',
        'Amount Paid / Credited',
        'Tax Deducted / Collected',
        'TDS / TCS Deposited',
        'Short Deposit Diff',
        'Effective Rate %',
      ],
      rows: parsed.transactions.map((tx, idx) => {
        const meta = lookupSectionMeta(tx.section);
        return [
          idx + 1,
          tx.txSrNo || `${tx.srNo}`,
          tx.part,
          tx.partyType,
          tx.partyName,
          tx.tan,
          tx.partyPan || '-',
          tx.section,
          meta.oldActEq,
          getSectionDescription(tx.section),
          tx.transactionDate,
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
    setStatusMsg('Exported UTF-8 Excel-ready CSV file (with Party PAN, 26AS Ref & Effective Rate %).');
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
      title: `FORM 26AS AUDIT SUMMARY — ${parsed.assesseeName}`,
      subtitle: `PAN: ${parsed.pan} (${parsed.panStatus}) | ${getYearHeaderLabel(parsed)}${parsed.dataUpdatedTill ? ` | Updated: ${parsed.dataUpdatedTill}` : ''} | Parties: ${parsed.parties.length} | Txns: ${parsed.transactions.length}`,
      filename: `${getFileBaseTag(parsed)}-Audit.pdf`,
      orientation: 'landscape',
      kpis: [
        { label: 'Net Paid / Credited', value: formatINR(totals.amountPaid) },
        { label: 'TDS (Part I / II)', value: formatINR(totals.tdsTotal) },
        { label: 'TCS (Part VI / VII)', value: formatINR(totals.tcsTotal) },
        { label: 'Total Deposited', value: formatINR(totals.tdsDeposited) },
      ],
      breakdown: sectionBreakdown.slice(0, 12).map((s) => {
        const meta = lookupSectionMeta(s.section);
        return {
          label: `${s.part} · Sec ${s.section} (Old ${meta.oldActEq}) · ${s.txns} txns (${s.revs} rev) — ${meta.description}`,
          value: `Net Paid ${formatINR(s.paid)} | Tax ${formatINR(s.tax)} (${calcEffRatePct(s.tax, s.paid)})`,
        };
      }),
      table: {
        title: 'Deductor / Collector Reconciliation Schedule (TAN & PAN Verified)',
        headers: ['Sr', 'Part', 'Party Name', 'TAN', 'PAN', 'Txns', 'Rev', 'Net Paid', 'Tax Ded/Col', 'Rate %', 'Check'],
        rows: parsed.parties.map((p) => [
          p.srNo,
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
        `Gross Credits: ${formatINR(totals.grossPaid)} (Tax ${formatINR(totals.grossTax)}) | Reversals (${totals.reversalsCount} rows): ${formatINR(totals.reversalPaid)} (Tax ${formatINR(totals.reversalTax)}).`,
        `Verified ${totals.verifiedParties}/${parsed.parties.length} party subtotals. Parties missing PAN: ${totals.missingPanParties}. Short deposit variance: ${formatINR(totals.taxDeducted - totals.tdsDeposited)}.`,
      ],
    });
    setStatusMsg('Exported vector A4 PDF Audit Report.');
  };

  const handleExportWord = async () => {
    if (!parsed) return;
    await downloadWordDocument({
      filename: `${getFileBaseTag(parsed)}-Summary.docx`,
      title: `Form 26AS Statement Audit — ${parsed.assesseeName}`,
      subtitle: `PAN: ${parsed.pan} (${parsed.panStatus}) · ${getYearHeaderLabel(parsed)}${parsed.dataUpdatedTill ? ` · Updated ${parsed.dataUpdatedTill}` : ''}`,
      kpis: [
        { label: 'Parties Extracted', value: `${parsed.parties.length} (${totals.verifiedParties} verified)` },
        { label: 'Total Transactions', value: `${parsed.transactions.length} (${totals.reversalsCount} reversals)` },
        { label: 'Net Amount Paid / Received', value: formatINR(totals.amountPaid) },
        { label: 'TDS + TCS Deducted / Collected', value: formatINR(totals.taxDeducted) },
        { label: 'TDS + TCS Deposited', value: formatINR(totals.tdsDeposited) },
      ],
      breakdown: [
        ...sectionBreakdown.map((s) => {
          const meta = lookupSectionMeta(s.section);
          return {
            label: `${s.part} · Section ${s.section} (1961 Eq: ${meta.oldActEq}) · ${s.txns} txns`,
            value: `Net Paid ${formatINR(s.paid)} | Tax ${formatINR(s.tax)} (${calcEffRatePct(s.tax, s.paid)})`,
          };
        }),
        ...quarterBreakdown.map((q) => ({
          label: `Quarter ${q.quarter} (${q.txns} txns, ${q.revs} rev)`,
          value: `Paid ${formatINR(q.paid)} | TDS ${formatINR(q.tds)} | TCS ${formatINR(q.tcs)}`,
        })),
      ],
      table: {
        title: 'Deductor & Collector Reconciliation Schedule (TAN & PAN)',
        headers: ['Sr', 'Part', 'Party Name', 'TAN', 'PAN', 'Txns', 'Amount Paid', 'Tax', 'Deposited', 'Rate %', 'Status'],
        rows: parsed.parties.map((p) => [
          p.srNo,
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
        `Gross Positive Credits: ${formatINR(totals.grossPaid)} | Reversals / Rectifications (${totals.reversalsCount}): ${formatINR(totals.reversalPaid)}.`,
        'Generated locally in browser via VCPL Tools Form 26AS Engine.',
      ],
    });
    setStatusMsg('Exported Word (.docx) Audit Summary.');
  };

  const handlePrintReport = async () => {
    if (!parsed) return;
    const partyRowsHtml = parsed.parties
      .map(
        (p) => `<tr>
          <td>${p.srNo}</td>
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
      title: `Form 26AS Audit — ${parsed.assesseeName} (${parsed.pan})`,
      orientation: 'landscape',
      bodyHtml: `
        <h1>FORM 26AS CONSOLIDATED AUDIT — ${parsed.assesseeName}</h1>
        <p><strong>PAN:</strong> ${parsed.pan} (${parsed.panStatus}) &nbsp;|&nbsp; <strong>Period:</strong> ${getYearHeaderLabel(parsed)} &nbsp;|&nbsp; <strong>Updated Till:</strong> ${parsed.dataUpdatedTill || '-'} &nbsp;|&nbsp; <strong>Parties:</strong> ${parsed.parties.length} &nbsp;|&nbsp; <strong>Txns:</strong> ${parsed.transactions.length}</p>
        <div class="kpi-grid">
          <div class="kpi-card"><div class="kpi-label">Net Paid / Received</div><div class="kpi-val">${formatINR(totals.amountPaid)}</div></div>
          <div class="kpi-card"><div class="kpi-label">Part I TDS Deducted</div><div class="kpi-val">${formatINR(totals.tdsTotal)}</div></div>
          <div class="kpi-card"><div class="kpi-label">Part VI TCS Collected</div><div class="kpi-val">${formatINR(totals.tcsTotal)}</div></div>
          <div class="kpi-card"><div class="kpi-label">Total Deposited</div><div class="kpi-val">${formatINR(totals.tdsDeposited)}</div></div>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th><th>Part</th><th>Deductor / Collector</th><th>TAN</th><th>PAN</th><th class="num">Txns</th><th class="num">Rev</th><th class="num">Net Paid</th><th class="num">Tax Ded/Col</th><th class="num">Deposited</th><th class="num">Eff Rate</th><th>Check</th>
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
            Form 26AS → Excel Workbook
          </h1>
          <p className="text-xs sm:text-sm text-[#475569] dark:text-slate-300 leading-relaxed max-w-3xl">
            Convert TRACES Annual Tax Statement (Form 26AS) PDF, Text (<code className="font-mono">.txt</code>),
            or Excel/CSV into structured audit workbooks extracting both <strong>TAN &amp; PAN</strong>, live{' '}
            <code className="font-mono font-semibold">SUMIFS</code> /{' '}
            <code className="font-mono font-semibold">SUBTOTAL</code> formulas, 2025 &amp; 1961 Act schedules, Q1–Q4 splits, and reversal audits.
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex items-start gap-3 p-3 rounded-xl border border-[#2F3E4E]/15 dark:border-slate-800 hover:bg-[#FFFDF5] dark:hover:bg-slate-900/60 cursor-pointer">
            <input
              type="checkbox"
              checked={includeCombinedSheet}
              onChange={(e) => setIncludeCombinedSheet(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-[#2F3E4E] text-[#1E3A5F] focus:ring-[#F9C80E] cursor-pointer shrink-0"
            />
            <div className="space-y-0.5">
              <span className="block font-display font-bold text-sm text-[#2F3E4E] dark:text-slate-100">
                Combined single sheet (“26AS”)
              </span>
              <span className="block text-xs text-[#64748B] dark:text-slate-400">
                All deductors (TAN + PAN), 26AS Ref, Gross/Reversal split &amp; live{' '}
                <code className="font-mono">SUMIFS</code> / <code className="font-mono">SUBTOTAL</code>.
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
                Party-wise sheets + hyperlinked Party Summary
              </span>
              <span className="block text-xs text-[#64748B] dark:text-slate-400">
                Individual ledger worksheet per deductor/collector (TAN &amp; PAN) with one-click back links.
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
                Section, Quarter &amp; Remark Audit sheet
              </span>
              <span className="block text-xs text-[#64748B] dark:text-slate-400">
                100% live <code className="font-mono">SUMIFS/COUNTIFS</code> across Sections (2025 &amp; 1961 Act), Quarters Q1–Q4 &amp; Remarks.
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
                Reversals, Missing PAN &amp; Exceptions Audit sheet
              </span>
              <span className="block text-xs text-[#64748B] dark:text-slate-400">
                Flags reversals <code className="font-mono">(G/B)</code>, missing Party PANs, short deposits &amp; subtotal mismatches.
              </span>
            </div>
          </label>
        </div>

        {/* Export Button Bar */}
        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => void handleConvertToExcel()}
            disabled={isParsing || isExporting}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-[#1E3A5F] hover:bg-[#162C49] dark:bg-[#F9C80E] dark:hover:bg-[#FDE047] text-white dark:text-[#0F172A] font-display font-extrabold text-sm shadow-[0_3px_0_#0F172A] dark:shadow-[0_3px_0_#92400E] transition cursor-pointer whitespace-nowrap disabled:opacity-60"
          >
            <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{isExporting ? 'Generating Workbook...' : 'Convert to Excel (.xlsx)'}</span>
          </button>

          {parsed && (parsed.transactions.length > 0 || parsed.parties.length > 0) && (
            <>
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E]/35 dark:border-slate-600 bg-[#FFFDF5] dark:bg-slate-800/80 hover:bg-[#FEF2C8] dark:hover:bg-slate-700 text-xs font-bold text-[#2F3E4E] dark:text-slate-100 transition cursor-pointer whitespace-nowrap"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>CSV (.csv)</span>
              </button>

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
          {/* 4-Column KPI Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
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

            <div className="p-4 rounded-xl bg-white dark:bg-[#0B1120] border-[1.5px] border-[#2F3E4E]/30 dark:border-slate-700">
              <p className="text-[11px] font-bold uppercase text-[#64748B] dark:text-slate-400">
                Net Paid / Received
              </p>
              <p className="font-mono tabular-nums font-extrabold text-base sm:text-lg text-[#2F3E4E] dark:text-slate-100 mt-1">
                {formatINR(totals.amountPaid)}
              </p>
              <p className="text-xs text-[#475569] dark:text-slate-400">
                Gross {formatINR(totals.grossPaid)} · {parsed.transactions.length} txns ({parsed.parties.length} parties)
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#CEE5DC]/60 dark:bg-emerald-950/35 border-[1.5px] border-[#2F3E4E]/30 dark:border-emerald-700/50">
              <p className="text-[11px] font-bold uppercase text-[#64748B] dark:text-slate-400">
                TDS + TCS Deducted
              </p>
              <p className="font-mono tabular-nums font-extrabold text-base sm:text-lg text-[#2F3E4E] dark:text-emerald-300 mt-1">
                {formatINR(totals.taxDeducted)}
              </p>
              <p className="text-xs text-[#12805C] dark:text-emerald-400 font-semibold">
                TDS {formatINR(totals.tdsTotal)} · TCS {formatINR(totals.tcsTotal)}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#F9C80E]/30 dark:bg-amber-950/35 border-[1.5px] border-[#2F3E4E]/30 dark:border-amber-700/50">
              <p className="text-[11px] font-bold uppercase text-[#64748B] dark:text-slate-400">
                TDS + TCS Deposited
              </p>
              <p className="font-mono tabular-nums font-extrabold text-base sm:text-lg text-[#2F3E4E] dark:text-[#F9C80E] mt-1">
                {formatINR(totals.tdsDeposited)}
              </p>
              <p className="text-xs text-[#475569] dark:text-slate-300">
                Eff Rate {calcEffRatePct(totals.taxDeducted, totals.amountPaid)} · Short{' '}
                {formatINR(Math.max(0, totals.taxDeducted - totals.tdsDeposited))}
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
              {totals.missingPanParties > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-semibold">
                  {totals.missingPanParties} Party PAN Missing (Only TAN)
                </span>
              )}
            </div>
            <span className="text-[#64748B] dark:text-slate-400">
              Click any party or section row to drill into transactions
            </span>
          </div>

          {/* Interactive Tab Switcher + Filters */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div
              role="tablist"
              aria-label="Extracted Form 26AS Views"
              className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#FEF2C8] dark:bg-[#0B1120] border border-[#2F3E4E]/20 dark:border-slate-700"
            >
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
                Party Summary ({parsed.parties.length})
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
                Section &amp; Quarter ({sectionBreakdown.length})
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
                All Transactions ({parsed.transactions.length})
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
                Reversals &amp; Audit ({reversalTransactions.length + missingPanList.length})
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

            {activeTab === 'parties' && (
              <div className="relative">
                <Search
                  className="w-3.5 h-3.5 text-[#64748B] dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={partyQuery}
                  onChange={(e) => setPartyQuery(e.target.value)}
                  placeholder="Search party name, TAN, or PAN..."
                  className="w-full sm:w-64 min-h-[38px] pl-8 pr-3 rounded-xl border border-[#2F3E4E]/25 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs text-[#2F3E4E] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
                />
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
                    placeholder="Filter party, TAN, PAN, ref..."
                    className="w-full sm:w-48 min-h-[38px] pl-8 pr-3 rounded-xl border border-[#2F3E4E]/25 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs text-[#2F3E4E] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
                  />
                </div>
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
                {(txQuery || partFilter !== 'ALL' || quarterFilter !== 'ALL' || natureFilter !== 'ALL') && (
                  <button
                    type="button"
                    onClick={() => {
                      setTxQuery('');
                      setPartFilter('ALL');
                      setQuarterFilter('ALL');
                      setNatureFilter('ALL');
                    }}
                    className="min-h-[38px] px-2.5 rounded-xl border border-[#2F3E4E]/25 dark:border-slate-600 text-xs font-semibold text-[#475569] dark:text-slate-300 hover:bg-[#FEF2C8] dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Tab 1: Party Summary & Subtotal Cross-Check */}
          {activeTab === 'parties' && (
            <div className="overflow-x-auto rounded-xl border-[1.5px] border-[#2F3E4E]/40 dark:border-slate-700 bg-white dark:bg-[#0B1120]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#1E3A5F] dark:bg-slate-800 text-white">
                  <tr>
                    <th className="px-3 py-3 font-bold">#</th>
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
                  {filteredParties.map((party) => (
                    <tr
                      key={`${party.part}-${party.tan}`}
                      onClick={() => {
                        setPartFilter(party.part);
                        setTxQuery(party.tan);
                        setQuarterFilter('ALL');
                        setNatureFilter('ALL');
                        setActiveTab('transactions');
                      }}
                      title={`Click to view ${party.transactionCount} transaction(s) for ${party.partyName}`}
                      className="hover:bg-[#FEF2C8]/55 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                    >
                      <td className="px-3 py-3 font-mono font-bold text-[#2F3E4E] dark:text-slate-200">
                        {party.srNo}
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
                  ))}
                </tbody>
                <tfoot className="bg-[#FEF2C8]/85 dark:bg-slate-800/90 font-bold border-t-2 border-[#2F3E4E]/30 dark:border-slate-600">
                  <tr>
                    <td colSpan={5} className="px-3 py-3 text-[#2F3E4E] dark:text-slate-100">
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

          {/* Tab 2: Section-wise & Quarter-wise Breakdown */}
          {activeTab === 'sections' && (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-xl border-[1.5px] border-[#2F3E4E]/40 dark:border-slate-700 bg-white dark:bg-[#0B1120]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#1E3A5F] dark:bg-slate-800 text-white">
                    <tr>
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
                    {sectionBreakdown.map((sec) => {
                      const meta = lookupSectionMeta(sec.section);
                      return (
                        <tr
                          key={`${sec.part}-${sec.section}`}
                          onClick={() => {
                            setPartFilter(sec.part);
                            setTxQuery(sec.section);
                            setQuarterFilter('ALL');
                            setNatureFilter('ALL');
                            setActiveTab('transactions');
                          }}
                          className="hover:bg-[#FEF2C8]/50 dark:hover:bg-slate-800/50 cursor-pointer"
                        >
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
                          setPartFilter('ALL');
                          setTxQuery('');
                          setNatureFilter('ALL');
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
                        <td className="px-3.5 py-2.5 font-mono tabular-nums text-right font-semibold text-[#2F3E4E] dark:text-slate-100">
                          {formatINR(q.tds)}
                        </td>
                        <td className="px-3.5 py-2.5 font-mono tabular-nums text-right font-semibold text-[#2F3E4E] dark:text-slate-100">
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
            </div>
          )}

          {/* Tab 3: Detailed Transaction Ledger */}
          {activeTab === 'transactions' && (
            <div className="overflow-x-auto rounded-xl border-[1.5px] border-[#2F3E4E]/40 dark:border-slate-700 bg-white dark:bg-[#0B1120]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#1E3A5F] dark:bg-slate-800 text-white">
                  <tr>
                    <th className="px-2.5 py-3 font-bold">Ref</th>
                    <th className="px-2.5 py-3 font-bold">Part</th>
                    <th className="px-2.5 py-3 font-bold">Party Name</th>
                    <th className="px-2.5 py-3 font-bold">TAN</th>
                    <th className="px-2.5 py-3 font-bold">PAN</th>
                    <th className="px-2.5 py-3 font-bold">Sec</th>
                    <th className="px-2.5 py-3 font-bold">Txn Date</th>
                    <th className="px-2.5 py-3 font-bold text-center">Status</th>
                    <th className="px-2.5 py-3 font-bold text-center">Rmk</th>
                    <th className="px-2.5 py-3 font-bold text-right">Amount Paid</th>
                    <th className="px-2.5 py-3 font-bold text-right">Deducted</th>
                    <th className="px-2.5 py-3 font-bold text-right">Deposited</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2F3E4E]/10 dark:divide-slate-800">
                  {filteredTransactions.map((tx) => {
                    const isNeg = tx.entryNature === 'Reversal' || tx.amountPaid < 0 || tx.taxDeducted < 0;
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
                    <td colSpan={9} className="px-2.5 py-2.5 text-[#2F3E4E] dark:text-slate-100">
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
