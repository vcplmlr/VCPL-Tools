import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  FileCode2,
  FileSpreadsheet,
  FileText,
  GitCompareArrows,
  KeyRound,
  Link2,
  Play,
  Printer,
  RotateCcw,
  Search,
  Trash2,
  Unlink2,
  X,
} from 'lucide-react';
import { ToolCatalogItem } from '../../types/tools';
import { filesToFileList } from '../../utils/fileDropUtils';
import { PdfPasswordError, extractTextFromPdf } from '../../utils/pdfExtractor';
import {
  downloadBomCsv,
  downloadJsonFile,
  downloadWordDocument,
  exportStructuredReportPdf,
  printHtmlDocument,
} from '../../utils/printReport';
import {
  BuiltRecoSheets,
  DeductorSummary,
  MN,
  PERIOD_LABELS,
  Parsed26ASFile,
  RawSheetData,
  RecoDateBasis,
  RecoFinFilter,
  RecoOptions,
  RecoPeriodCode,
  RecoRunResult,
  RecoScope,
  RecoState,
  TallyLedger,
  autoMapLedgers,
  buildDashboardData,
  buildPeriodLabel,
  buildProRecoExcelWorkbook,
  buildRecoSheets,
  dfmt,
  fmtIN,
  fyStart,
  merge26ASSources,
  parse26ASRows,
  parseTallySheets,
  parseXlsxBufferToSheets,
  periodRange,
  r2,
  runReco,
  statusCategory,
} from '../../utils/tds26asTallyRecoEngine';
import { emitGlobalProgress } from '../TopLoadingBar';
import { FileDropZone } from './FileDropZone';

interface Tds26asTallyRecoViewProps {
  tool?: ToolCatalogItem;
  onBack?: () => void;
}

type RecoTabId =
  | 'dash'
  | 'sum'
  | 'tva'
  | 'avt'
  | 'mis'
  | 'mA'
  | 'mT'
  | 'man'
  | 'gl'
  | 'pw'
  | 'bk'
  | 'warn';

interface UploadedTallySource {
  id: string;
  fileName: string;
  sheets: RawSheetData[];
}

interface Uploaded26Source {
  id: string;
  fileName: string;
  parsed: Parsed26ASFile;
}

interface PendingLockedPdf {
  fileName: string;
  buffer: ArrayBuffer;
}

const TAB_DEFS: { id: RecoTabId; label: string }[] = [
  { id: 'dash', label: 'Dashboard' },
  { id: 'sum', label: 'Summary' },
  { id: 'tva', label: 'Tally vs 26AS' },
  { id: 'avt', label: '26AS vs Tally' },
  { id: 'mis', label: 'Mismatches' },
  { id: 'mA', label: 'Missing in Tally' },
  { id: 'mT', label: 'Missing in 26AS' },
  { id: 'man', label: 'Manual Reco' },
  { id: 'gl', label: 'Ledger-wise Reco' },
  { id: 'pw', label: 'Period-wise' },
  { id: 'bk', label: 'Day Buckets' },
  { id: 'warn', label: 'Notes & Warnings' },
];

const FY_MONTH_OPTIONS = [
  { label: 'Apr', value: 0 },
  { label: 'May', value: 1 },
  { label: 'Jun', value: 2 },
  { label: 'Jul', value: 3 },
  { label: 'Aug', value: 4 },
  { label: 'Sep', value: 5 },
  { label: 'Oct', value: 6 },
  { label: 'Nov', value: 7 },
  { label: 'Dec', value: 8 },
  { label: 'Jan', value: 9 },
  { label: 'Feb', value: 10 },
  { label: 'Mar', value: 11 },
];

function statusBadgeClasses(status: string): string {
  const cat = statusCategory(status);
  if (cat === 'ok') {
    return 'bg-[#CEE5DC]/80 dark:bg-emerald-950/60 text-[#12805C] dark:text-emerald-300 border-[#12805C]/35 dark:border-emerald-700/50';
  }
  if (cat === 'er') {
    return 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-600/35 dark:border-rose-700/50';
  }
  return 'bg-[#FEF2C8] dark:bg-amber-950/50 text-[#9A5B00] dark:text-amber-300 border-[#9A5B00]/35 dark:border-amber-700/50';
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

const p2 = (n: number) => String(n).padStart(2, '0');
const monthChipLabel = (k: string) => `${MN[+k.slice(5) - 1]}-${k.slice(2, 4)}`;

export const Tds26asTallyRecoView: React.FC<Tds26asTallyRecoViewProps> = ({ tool }) => {
  // Uploaded Sources
  const [tallySources, setTallySources] = useState<UploadedTallySource[]>([]);
  const [sources26, setSources26] = useState<Uploaded26Source[]>([]);
  const [pendingLockedPdfs, setPendingLockedPdfs] = useState<PendingLockedPdf[]>([]);
  const [pdfPassword, setPdfPassword] = useState<string>('');
  const [showPdfPassword, setShowPdfPassword] = useState<boolean>(false);

  // Parsed State
  const [deds, setDeds] = useState<Record<string, DeductorSummary>>({});
  const [A26, setA26] = useState<RecoState['A26']>([]);
  const [nettedCount, setNettedCount] = useState<number>(0);
  const [badChecks, setBadChecks] = useState<string[]>([]);
  const [ledgers, setLedgers] = useState<TallyLedger[]>([]);
  const [tallyWarns, setTallyWarns] = useState<string[]>([]);
  const [ledgerMap, setLedgerMap] = useState<Record<string, string[]>>({});
  const [incMap, setIncMap] = useState<Record<string, boolean>>({});
  const [manLinks, setManLinks] = useState<Record<string, number>>({});
  const [baseFy, setBaseFy] = useState<number>(new Date().getFullYear());

  // Period & Options
  const [periodCode, setPeriodCode] = useState<RecoPeriodCode>('FY');
  const [selectedFy, setSelectedFy] = useState<number>(new Date().getFullYear());
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [mFrom, setMFrom] = useState<number>(0);
  const [mTo, setMTo] = useState<number>(11);
  const [asOnDate, setAsOnDate] = useState<string>('');
  const [nDaysOrMonths, setNDaysOrMonths] = useState<number>(30);
  const [fyFrom, setFyFrom] = useState<number>(new Date().getFullYear());
  const [fyTo, setFyTo] = useState<number>(new Date().getFullYear());
  const [qFrom, setQFrom] = useState<number>(0);
  const [qTo, setQTo] = useState<number>(3);
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set());

  const [basis, setBasis] = useState<RecoDateBasis>('txn');
  const [scope, setScope] = useState<RecoScope>('strict');
  const [bufDays, setBufDays] = useState<number>(10);
  const [finFilter, setFinFilter] = useState<RecoFinFilter>('');
  const [bktDays, setBktDays] = useState<number>(30);
  const [tol, setTol] = useState<number>(2);
  const [winDays, setWinDays] = useState<number>(45);

  // Results & Navigation
  const [recoResult, setRecoResult] = useState<RecoRunResult | null>(null);
  const [builtSheets, setBuiltSheets] = useState<BuiltRecoSheets | null>(null);
  const [activeTab, setActiveTab] = useState<RecoTabId>('dash');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedGroupNo, setSelectedGroupNo] = useState<number>(0);
  const [selectedManKeys, setSelectedManKeys] = useState<Set<string>>(new Set());

  // Status / Progress
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [progressInfo, setProgressInfo] = useState<{ pct: number; msg: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [bannerMsg, setBannerMsg] = useState<string>('');

  const resultsRef = useRef<HTMLDivElement | null>(null);
  const autoRunReadyRef = useRef<boolean>(false);

  const setProgress = useCallback((pct: number, msg: string) => {
    const clamped = Math.min(100, Math.max(0, Math.round(pct)));
    setProgressInfo({ pct: clamped, msg });
    emitGlobalProgress(true, clamped);
  }, []);

  const clearProgress = useCallback(() => {
    emitGlobalProgress(false, 100);
    window.setTimeout(() => setProgressInfo(null), 300);
  }, []);

  // Derive available FY list and all transaction dates
  const { fyList, minDate, maxDate, monthCountsA, monthCountsT, allMonthKeys } = useMemo(() => {
    const aCounts: Record<string, number> = {};
    const tCounts: Record<string, number> = {};
    const allDates: string[] = [];

    A26.filter((e) => finFilter !== 'F' || !e.st || e.st === 'F').forEach((e) => {
      const d = basis === 'book' && e.bd ? e.bd : e.td;
      if (d) {
        allDates.push(d);
        aCounts[d.slice(0, 7)] = (aCounts[d.slice(0, 7)] || 0) + 1;
      }
    });
    ledgers.forEach((l) =>
      l.entries.forEach((e) => {
        if (e.d) {
          allDates.push(e.d);
          const k = e.d.slice(0, 7);
          tCounts[k] = (tCounts[k] || 0) + 1;
        }
      })
    );
    allDates.sort();
    const fyOfDate = (d: string) => {
      const [y, m] = d.split('-').map(Number);
      return m >= 4 ? y : y - 1;
    };
    const fys: number[] = [];
    if (allDates.length) {
      const fa = fyOfDate(allDates[0]);
      const fb = fyOfDate(allDates[allDates.length - 1]);
      for (let y = fa; y <= fb; y++) fys.push(y);
    } else {
      fys.push(baseFy);
    }
    const keys = [...new Set([...Object.keys(aCounts), ...Object.keys(tCounts)])].sort();
    return {
      fyList: fys,
      minDate: allDates[0] || '',
      maxDate: allDates[allDates.length - 1] || '',
      monthCountsA: aCounts,
      monthCountsT: tCounts,
      allMonthKeys: keys,
    };
  }, [A26, ledgers, basis, finFilter, baseFy]);

  // Rebuild merged state whenever tallySources or sources26 change
  const rebuildMergedData = useCallback(
    (
      nextTallySources: UploadedTallySource[],
      next26Sources: Uploaded26Source[],
      preserveMapping: boolean
    ) => {
      const merged26 = merge26ASSources(next26Sources.map((s) => s.parsed));
      const allRawTally = nextTallySources.flatMap((s) => s.sheets);
      const parsedTally = parseTallySheets(allRawTally);

      setA26(merged26.entries);
      setDeds(merged26.deds);
      setNettedCount(merged26.netted);
      setBadChecks(merged26.bad);
      setLedgers(parsedTally.ledgers);
      setTallyWarns(parsedTally.warn);

      const detectedFy = fyStart(merged26.entries, parsedTally.ledgers);
      setBaseFy(detectedFy);

      if (merged26.entries.length || parsedTally.ledgers.length) {
        const ds = [
          ...merged26.entries.map((e) => e.td),
          ...parsedTally.ledgers.flatMap((l) => l.entries.map((e) => e.d)),
        ]
          .filter(Boolean)
          .sort();
        const fyOf = (d: string) => {
          const [y, m] = d.split('-').map(Number);
          return m >= 4 ? y : y - 1;
        };
        const minFy = ds.length ? fyOf(ds[0]) : detectedFy;
        const maxFy = ds.length ? fyOf(ds[ds.length - 1]) : detectedFy;

        setSelectedFy(detectedFy);
        setFyFrom(minFy);
        setFyTo(maxFy);
        if (ds.length) {
          setAsOnDate((prev) => prev || ds[ds.length - 1]);
          setCustomStart((prev) => prev || ds[0]);
          setCustomEnd((prev) => prev || ds[ds.length - 1]);
        }

        if (merged26.entries.length && parsedTally.ledgers.length) {
          const auto = autoMapLedgers(parsedTally.ledgers, merged26.deds, merged26.entries, tol);
          setLedgerMap((prev) => {
            if (!preserveMapping) return auto;
            const mergedMap: Record<string, string[]> = {};
            parsedTally.ledgers.forEach((l) => {
              mergedMap[l.name] = prev[l.name]?.length ? prev[l.name] : auto[l.name] || [];
            });
            return mergedMap;
          });
          setIncMap((prev) => {
            const nextInc: Record<string, boolean> = {};
            parsedTally.ledgers.forEach((l) => {
              nextInc[l.name] = prev[l.name] !== undefined ? prev[l.name] : true;
            });
            return nextInc;
          });
        }
      } else {
        setLedgerMap({});
        setIncMap({});
        setRecoResult(null);
        setBuiltSheets(null);
      }
    },
    [tol]
  );

  // Build RecoOptions snapshot
  const buildCurrentOptions = useCallback((): RecoOptions => {
    const codeForRange = periodCode === 'C' ? 'X' : periodCode;
    const fy = selectedFy || baseFy || new Date().getFullYear();
    const msArray = periodCode === 'MS' ? [...selectedMonths] : null;
    const per = periodRange(codeForRange, fy, customStart, customEnd, {
      m1: mFrom,
      m2: mTo,
      asOn: asOnDate || maxDate,
      days: nDaysOrMonths,
      ms: msArray,
      f1: fyFrom,
      f2: fyTo,
      q1: qFrom,
      q2: qTo,
    });
    return {
      code: periodCode,
      fy,
      per,
      ms: periodCode === 'MS' && selectedMonths.size ? new Set(selectedMonths) : null,
      basis,
      scope,
      buf: scope === 'buf' ? Math.max(0, bufDays || 0) : 0,
      fin: finFilter,
      tol: Math.max(0, tol || 0),
      win: Math.max(1, winDays || 45),
      bkt: Math.max(1, bktDays || 30),
      periodLabelText: PERIOD_LABELS[periodCode] || 'Selected period',
      fyList,
    };
  }, [
    periodCode,
    selectedFy,
    baseFy,
    selectedMonths,
    customStart,
    customEnd,
    mFrom,
    mTo,
    asOnDate,
    maxDate,
    nDaysOrMonths,
    fyFrom,
    fyTo,
    qFrom,
    qTo,
    basis,
    scope,
    bufDays,
    finFilter,
    tol,
    winDays,
    bktDays,
    fyList,
  ]);

  // Execute reconciliation
  const executeReconciliation = useCallback(
    (scrollIntoView = false) => {
      if (!A26.length && !ledgers.length) return;
      const o = buildCurrentOptions();
      const stateSnapshot: RecoState = {
        A26,
        deds,
        ledgers,
        map: ledgerMap,
        inc: incMap,
        man: manLinks,
        tw: tallySources.flatMap((s) => s.sheets),
        twarn: tallyWarns,
        files26: sources26.map((s) => s.parsed),
        netted: nettedCount,
        bad: badChecks,
        fy: o.fy,
      };
      const res = runReco(stateSnapshot, o);
      const sheets = buildRecoSheets(stateSnapshot, res);
      setRecoResult(res);
      setBuiltSheets(sheets);
      autoRunReadyRef.current = true;

      const firstAutoGroup = res.groups.find((g) => !g.manual);
      setSelectedGroupNo((prev) =>
        res.groups.some((g) => !g.manual && g.n === prev) ? prev : firstAutoGroup?.n || 0
      );

      if (scrollIntoView) {
        window.setTimeout(() => {
          resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 60);
      }
    },
    [
      A26,
      deds,
      ledgers,
      ledgerMap,
      incMap,
      manLinks,
      tallySources,
      tallyWarns,
      sources26,
      nettedCount,
      badChecks,
      buildCurrentOptions,
    ]
  );

  // Auto re-run immediately whenever both Tally & 26AS are loaded or any period / rule / mapping option changes
  useEffect(() => {
    if (A26.length > 0 && ledgers.length > 0) {
      executeReconciliation(false);
    }
  }, [executeReconciliation, A26.length, ledgers.length]);

  // Handle File Uploads
  const handleTallyFiles = async (fileList: FileList) => {
    setErrorMsg('');
    setBannerMsg('');
    setIsBusy(true);
    setProgress(15, 'Reading Tally ledger workbooks...');
    try {
      const files = Array.from(fileList);
      const added: UploadedTallySource[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const ab = await f.arrayBuffer();
        const shs = parseXlsxBufferToSheets(ab, f.name);
        added.push({
          id: `${f.name}-${Date.now()}-${i}`,
          fileName: f.name,
          sheets: shs,
        });
        setProgress(15 + ((i + 1) / files.length) * 75, `Parsed ${f.name} (${shs.length} sheet(s))`);
      }
      const nextTally = [...tallySources, ...added];
      setTallySources(nextTally);
      rebuildMergedData(nextTally, sources26, true);
      setBannerMsg(
        `Loaded ${added.length} Tally workbook(s) · ${added.reduce(
          (s, x) => s + x.sheets.length,
          0
        )} worksheet(s).`
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? `Could not parse Tally Excel: ${err.message}` : 'Failed to read Tally Excel file.'
      );
    } finally {
      setIsBusy(false);
      clearProgress();
    }
  };

  const parseSingle26ASBuffer = async (
    ab: ArrayBuffer,
    fileName: string,
    password?: string
  ): Promise<Parsed26ASFile> => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (ext === 'pdf') {
      const res = await extractTextFromPdf(ab, { password });
      const rows = res.allLines
        .map((ln) => ln.split(/\s+/).filter(Boolean))
        .filter((arr) => arr.length > 0);
      return parse26ASRows(rows, fileName);
    }
    if (ext === 'txt' || ext === 'csv') {
      const tx = new TextDecoder('utf-8').decode(ab);
      const sep = tx.includes('^') ? '^' : ',';
      const rows = tx
        .split(/\r?\n/)
        .map((l) =>
          l
            .split(sep)
            .map((x) => x.trim())
            .filter(Boolean)
        )
        .filter((arr) => arr.length > 0);
      return parse26ASRows(rows, fileName);
    }
    // xlsx / xls
    const shs = parseXlsxBufferToSheets(ab, fileName);
    const rows = shs
      .flatMap((s) =>
        s.rows.map((r) =>
          r
            .map((c) => (c == null ? '' : c instanceof Date ? dfmt(c.toISOString().slice(0, 10)) : String(c).trim()))
            .filter(Boolean)
        )
      )
      .filter((arr) => arr.length > 0);
    return parse26ASRows(rows, fileName);
  };

  const handle26ASFiles = async (fileList: FileList) => {
    setErrorMsg('');
    setBannerMsg('');
    setIsBusy(true);
    setProgress(15, 'Reading Form 26AS / ATS files...');
    try {
      const files = Array.from(fileList);
      const added: Uploaded26Source[] = [];
      const locked: PendingLockedPdf[] = [];

      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const ab = await f.arrayBuffer();
        try {
          const parsed = await parseSingle26ASBuffer(ab, f.name, pdfPassword);
          added.push({
            id: `${f.name}-${Date.now()}-${i}`,
            fileName: f.name,
            parsed,
          });
          setProgress(
            15 + ((i + 1) / files.length) * 75,
            `Parsed ${f.name} · ${parsed.entries.length} net entries`
          );
        } catch (err) {
          if (err instanceof PdfPasswordError) {
            locked.push({ fileName: f.name, buffer: ab });
          } else {
            throw err;
          }
        }
      }

      if (locked.length > 0) {
        setPendingLockedPdfs((prev) => [...prev, ...locked]);
        setErrorMsg(
          `${locked.length} PDF file(s) are password-protected (${locked
            .map((x) => x.fileName)
            .join(', ')}). Enter the PDF password below (usually PAN DOB/DOI in DDMMYYYY) and click Unlock.`
        );
      }

      if (added.length > 0) {
        const next26 = [...sources26, ...added];
        setSources26(next26);
        rebuildMergedData(tallySources, next26, true);
        setBannerMsg(
          `Loaded ${added.length} 26AS / ATS file(s) · ${added.reduce(
            (s, x) => s + x.parsed.entries.length,
            0
          )} net entries parsed.`
        );
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? `Could not parse 26AS file: ${err.message}` : 'Failed to parse 26AS file.'
      );
    } finally {
      setIsBusy(false);
      clearProgress();
    }
  };

  const handleUnlockLockedPdfs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingLockedPdfs.length) return;
    if (!pdfPassword.trim()) {
      setErrorMsg('Please enter the PDF password to unlock the protected 26AS / ATS file.');
      return;
    }
    setErrorMsg('');
    setIsBusy(true);
    setProgress(20, 'Unlocking password-protected 26AS PDF(s)...');
    try {
      const unlocked: Uploaded26Source[] = [];
      const stillLocked: PendingLockedPdf[] = [];

      for (let i = 0; i < pendingLockedPdfs.length; i++) {
        const item = pendingLockedPdfs[i];
        try {
          const parsed = await parseSingle26ASBuffer(item.buffer, item.fileName, pdfPassword);
          unlocked.push({
            id: `${item.fileName}-${Date.now()}-${i}`,
            fileName: item.fileName,
            parsed,
          });
        } catch (err) {
          if (err instanceof PdfPasswordError) {
            stillLocked.push(item);
            setErrorMsg(err.message);
          } else {
            throw err;
          }
        }
      }

      setPendingLockedPdfs(stillLocked);
      if (unlocked.length > 0) {
        const next26 = [...sources26, ...unlocked];
        setSources26(next26);
        rebuildMergedData(tallySources, next26, true);
        setBannerMsg(
          `Unlocked & parsed ${unlocked.length} PDF file(s) (${unlocked.reduce(
            (s, x) => s + x.parsed.entries.length,
            0
          )} net entries).`
        );
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'PDF unlock failed.');
    } finally {
      setIsBusy(false);
      clearProgress();
    }
  };

  const removeTallySource = (id: string) => {
    const nextTally = tallySources.filter((s) => s.id !== id);
    setTallySources(nextTally);
    rebuildMergedData(nextTally, sources26, true);
  };

  const remove26Source = (id: string) => {
    const next26 = sources26.filter((s) => s.id !== id);
    setSources26(next26);
    rebuildMergedData(tallySources, next26, true);
  };

  const handleClearAll = () => {
    setTallySources([]);
    setSources26([]);
    setPendingLockedPdfs([]);
    setPdfPassword('');
    setDeds({});
    setA26([]);
    setNettedCount(0);
    setBadChecks([]);
    setLedgers([]);
    setTallyWarns([]);
    setLedgerMap({});
    setIncMap({});
    setManLinks({});
    setSelectedMonths(new Set());
    setPeriodCode('FY');
    setCustomStart('');
    setCustomEnd('');
    setAsOnDate('');
    setMFrom(0);
    setMTo(11);
    setQFrom(0);
    setQTo(3);
    setRecoResult(null);
    setBuiltSheets(null);
    autoRunReadyRef.current = false;
    setSearchQuery('');
    setStatusFilter('');
    setSelectedManKeys(new Set());
    setErrorMsg('');
    setBannerMsg('Workspace cleared. Upload Tally ledger & Form 26AS / ATS files to begin.');
  };

  // Interactive Month/Quarter Picker Handlers
  const fyOfMonthKey = (k: string) => {
    const y = +k.slice(0, 4);
    const m = +k.slice(5);
    return m >= 4 ? y : y - 1;
  };

  const toggleMonthKeys = (keysToToggle: string[]) => {
    setSelectedMonths((prev) => {
      const next = new Set(prev);
      const allPresent = keysToToggle.every((k) => next.has(k));
      keysToToggle.forEach((k) => (allPresent ? next.delete(k) : next.add(k)));
      if (next.size > 0) {
        setPeriodCode('MS');
        const refKey = keysToToggle[0] || [...next].sort()[0];
        if (refKey) setSelectedFy(fyOfMonthKey(refKey));
      } else if (periodCode === 'MS') {
        setPeriodCode('FY');
      }
      return next;
    });
  };

  const applyQuickMonthPreset = (preset: 'last' | 'last3' | 'lastq' | 'lastfy' | 'all' | 'clear') => {
    if (!allMonthKeys.length) return;
    const lastK = allMonthKeys[allMonthKeys.length - 1];
    const mk = (y: number, i: number) => {
      const m = (3 + i) % 12;
      return `${m >= 3 ? y : y + 1}-${p2(m + 1)}`;
    };
    const latestFy = fyOfMonthKey(lastK);
    const next = new Set<string>();

    if (preset === 'last') {
      next.add(lastK);
    } else if (preset === 'last3') {
      allMonthKeys.slice(-3).forEach((k) => next.add(k));
    } else if (preset === 'lastq') {
      const m = +lastK.slice(5);
      const q = Math.floor(((m - 4 + 12) % 12) / 3);
      [0, 1, 2].forEach((j) => next.add(mk(latestFy, q * 3 + j)));
    } else if (preset === 'lastfy') {
      for (let i = 0; i < 12; i++) next.add(mk(latestFy, i));
    } else if (preset === 'all') {
      allMonthKeys.forEach((k) => next.add(k));
    }

    setSelectedMonths(next);
    if (preset === 'clear') {
      if (periodCode === 'MS') setPeriodCode('FY');
    } else {
      setPeriodCode('MS');
      setSelectedFy(latestFy);
    }
  };

  // Manual Reco Actions
  const handleLinkSelectedManual = () => {
    if (!selectedManKeys.size) return;
    const existingIds = Object.values(manLinks);
    const nextId = existingIds.length ? Math.max(...existingIds) + 1 : 1;
    setManLinks((prev) => {
      const next = { ...prev };
      selectedManKeys.forEach((k) => {
        next[k] = nextId;
      });
      return next;
    });
    setSelectedManKeys(new Set());
  };

  const handleUnlinkSelectedManual = () => {
    const idsToDrop = new Set(
      [...selectedManKeys].map((k) => manLinks[k]).filter((v): v is number => Boolean(v))
    );
    if (!idsToDrop.size) return;
    setManLinks((prev) => {
      const next: Record<string, number> = {};
      Object.entries(prev).forEach(([k, v]) => {
        if (!idsToDrop.has(v)) next[k] = v;
      });
      return next;
    });
    setSelectedManKeys(new Set());
  };

  // Deductor list sorted by name
  const sortedDedKeys = useMemo(
    () => Object.keys(deds).sort((a, b) => deds[a].name.localeCompare(deds[b].name)),
    [deds]
  );

  const mappedSummary = useMemo(() => {
    const mappedSet = new Set(Object.values(ledgerMap).flat());
    const mappedLedgers = ledgers.filter((l) => (ledgerMap[l.name] || []).length > 0).length;
    const unmappedDeds = sortedDedKeys.length - mappedSet.size;
    const manualLedgers = ledgers.filter((l) => incMap[l.name] === false).length;
    return { mappedLedgers, unmappedDeds, manualLedgers };
  }, [ledgerMap, ledgers, sortedDedKeys, incMap]);

  // Build active RecoState for exports
  const buildStateSnapshot = useCallback((): RecoState => {
    return {
      A26,
      deds,
      ledgers,
      map: ledgerMap,
      inc: incMap,
      man: manLinks,
      tw: tallySources.flatMap((s) => s.sheets),
      twarn: tallyWarns,
      files26: sources26.map((s) => s.parsed),
      netted: nettedCount,
      bad: badChecks,
      fy: selectedFy || baseFy,
    };
  }, [
    A26,
    deds,
    ledgers,
    ledgerMap,
    incMap,
    manLinks,
    tallySources,
    tallyWarns,
    sources26,
    nettedCount,
    badChecks,
    selectedFy,
    baseFy,
  ]);

  // Dashboard computed analytics
  const dashData = useMemo(() => {
    if (!recoResult || !builtSheets) return null;
    return buildDashboardData(buildStateSnapshot(), recoResult, builtSheets);
  }, [recoResult, builtSheets, buildStateSnapshot]);

  // Active Tab Table Data + Filtering
  const activeTableView = useMemo(() => {
    if (!builtSheets || !recoResult) {
      return { headers: [] as string[], rows: [] as (string | number | null)[][], statusColIdx: -1, statusOptions: [] as string[], groupHdr: null as [string, string | number][] | null };
    }
    if (activeTab === 'dash' || activeTab === 'warn' || activeTab === 'man') {
      return { headers: [] as string[], rows: [] as (string | number | null)[][], statusColIdx: -1, statusOptions: [] as string[], groupHdr: null as [string, string | number][] | null };
    }
    let headers: string[] = [];
    let allRows: (string | number | null)[][] = [];
    let groupHdr: [string, string | number][] | null = null;

    if (activeTab === 'gl') {
      const grpSheet =
        builtSheets.gl[selectedGroupNo] ||
        builtSheets.gl[recoResult.groups.find((g) => !g.manual)?.n || 0];
      if (grpSheet) {
        headers = grpSheet.h;
        allRows = grpSheet.d;
        groupHdr = grpSheet.hdr;
      }
    } else {
      const sheetObj = builtSheets[activeTab];
      if (sheetObj) {
        headers = sheetObj.h;
        allRows = sheetObj.d;
      }
    }

    const statusColIdx = headers.findIndex((h) => /^(Status|Category|Reason)$/.test(h));
    const statusOptions = [
      ...new Set(allRows.map((r) => (statusColIdx >= 0 ? String(r[statusColIdx] || '') : '')).filter(Boolean)),
    ];
    const q = searchQuery.trim().toLowerCase();
    const effectiveFilter = statusOptions.includes(statusFilter) ? statusFilter : '';
    const filtered = allRows.filter((r) => {
      if (effectiveFilter && String(r[statusColIdx] || '') !== effectiveFilter) return false;
      if (q && !r.map((x) => (x == null ? '' : String(x))).join(' ').toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });

    return {
      headers,
      rows: filtered,
      totalRows: allRows.length,
      statusColIdx,
      statusOptions,
      groupHdr,
    };
  }, [builtSheets, recoResult, activeTab, selectedGroupNo, searchQuery, statusFilter]);

  // Manual Reco Filtered Rows & Selection Totals
  const manualViewData = useMemo(() => {
    if (!builtSheets) return { rows: [], selected26: 0, selectedTally: 0 };
    const items = builtSheets.man.items;
    const q = searchQuery.trim().toLowerCase();
    const rows = items.filter((it) => {
      const st = manLinks[it.k] ? 'Matched manually' : 'Open';
      if (statusFilter && st !== statusFilter) return false;
      if (
        q &&
        ![it.grp, it.why, it.party, it.ref, it.src, dfmt(it.d)].join(' ').toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });

    let selected26 = 0;
    let selectedTally = 0;
    const itemByKey = new Map(items.map((i) => [i.k, i]));
    selectedManKeys.forEach((k) => {
      const item = itemByKey.get(k);
      if (item) {
        if (item.src === '26AS') selected26 += item.amt;
        else selectedTally += item.amt;
      }
    });

    return {
      rows,
      totalCount: items.length,
      selected26: r2(selected26),
      selectedTally: r2(selectedTally),
    };
  }, [builtSheets, manLinks, searchQuery, statusFilter, selectedManKeys]);

  // Export Handlers
  const handleExportProExcel = async () => {
    if (!recoResult || !builtSheets) return;
    setIsBusy(true);
    setProgress(10, 'Generating multi-sheet ExcelJS reconciliation workbook...');
    try {
      const buf = await buildProRecoExcelWorkbook(buildStateSnapshot(), recoResult, builtSheets, (pct) =>
        setProgress(pct, 'Building Dashboard, Manual Links formulas & Ledger sheets...')
      );
      const blob = new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      triggerBlobDownload(blob, `26AS_vs_Tally_Reco_${recoResult.o.code}_FY${recoResult.o.fy}.xlsx`);
      setBannerMsg('Downloaded styled Pro Excel (.xlsx) workbook with live COUNTIFS/SUMIFS formulas.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? `Excel export error: ${err.message}` : 'Excel export failed.');
    } finally {
      setIsBusy(false);
      clearProgress();
    }
  };

  const handleExportPdf = () => {
    if (!recoResult || !builtSheets || !dashData) return;
    const activeFooterRow = computeTableSummaryFooter(
      activeTab,
      activeTableView.headers,
      activeTableView.rows
    );

    const kpis = [
      { label: '26AS Total', value: `Rs. ${fmtIN(dashData.sA)}` },
      { label: 'Tally Debit Total', value: `Rs. ${fmtIN(dashData.sT)}` },
      { label: 'Difference (26AS - Tally)', value: `Rs. ${fmtIN(dashData.diff)}` },
      { label: 'Not in Tally / Not in 26AS', value: `Rs. ${fmtIN(dashData.miss)} / Rs. ${fmtIN(dashData.uT)}` },
      { label: 'Value Reconciled (Residual 0)', value: `${dashData.pct}% (Chk: Rs. ${fmtIN(dashData.chk)})` },
    ];
    const formatPdfRows = (hdrs: string[], srcRows: (string | number | null)[][], footer: (string | number | null)[] | null) => {
      const combined = footer ? [...srcRows, footer] : srcRows;
      return combined.map((r) =>
        r.map((v, ci) => {
          if (v == null || v === '') return '';
          if (typeof v === 'number') {
            return /^(Not in .*\(#\)|#|Section|Day gap)/.test(hdrs[ci] || '') ? String(v) : fmtIN(v);
          }
          return v;
        })
      );
    };

    const sumFooter = computeTableSummaryFooter('sum', builtSheets.sum.h, builtSheets.sum.d);
    const tableForPdf =
      activeTableView.headers.length > 0 && activeTableView.rows.length > 0
        ? {
            title: `${TAB_DEFS.find((t) => t.id === activeTab)?.label || 'Active View'} (${activeTableView.rows.length} rows)`,
            headers: activeTableView.headers,
            rows: formatPdfRows(activeTableView.headers, activeTableView.rows, activeFooterRow),
          }
        : {
            title: `Group-wise Reconciliation Summary (${builtSheets.sum.d.length} groups)`,
            headers: builtSheets.sum.h,
            rows: formatPdfRows(builtSheets.sum.h, builtSheets.sum.d, sumFooter),
          };

    exportStructuredReportPdf({
      title: `26AS vs Tally Debit Reconciliation Audit (${recoResult.o.code})`,
      subtitle: `${buildPeriodLabel(recoResult.o)} · 26AS Basis: ${
        recoResult.o.basis === 'book' ? 'Booking Date' : 'Transaction Date'
      } · Tally: Debit Only (Opening/Credit Excluded)`,
      filename: `26AS_Tally_Audit_${recoResult.o.code}_FY${recoResult.o.fy}.pdf`,
      orientation: 'landscape',
      kpis,
      notes: builtSheets.warn,
      table: tableForPdf,
    });
  };

  const handleExportWord = async () => {
    if (!recoResult || !builtSheets || !dashData) return;
    setIsBusy(true);
    setProgress(35, 'Building Word (.docx) reconciliation report...');
    try {
      const kpis = [
        { label: '26AS Total (Period)', value: `₹ ${fmtIN(dashData.sA)}` },
        { label: 'Tally Debit Total (Period)', value: `₹ ${fmtIN(dashData.sT)}` },
        { label: 'Difference (26AS − Tally)', value: `₹ ${fmtIN(dashData.diff)}` },
        { label: 'Pending: Not Booked in Tally', value: `₹ ${fmtIN(dashData.miss)}` },
        { label: 'Pending: In Tally, Not in 26AS', value: `₹ ${fmtIN(dashData.uT)}` },
        { label: 'Amount Mismatch / Rounding / Timing', value: `₹ ${fmtIN(dashData.misAmt)} / ₹ ${fmtIN(dashData.rnd)} / ₹ ${fmtIN(dashData.tim)}` },
        { label: '26AS Value Reconciled', value: `${dashData.pct}% (Residual: ₹ ${fmtIN(dashData.chk)})` },
      ];
      const sumFooter = computeTableSummaryFooter('sum', builtSheets.sum.h, builtSheets.sum.d);
      const sumWithTotal = sumFooter ? [...builtSheets.sum.d, sumFooter] : builtSheets.sum.d;
      await downloadWordDocument({
        title: `26AS ⇄ Tally Debit Ledger Reconciliation Report`,
        subtitle: `${buildPeriodLabel(recoResult.o)} | Date Basis: ${
          recoResult.o.basis === 'book' ? 'Date of Booking' : 'Transaction Date'
        } | Tally Debit Entries Only`,
        filename: `26AS_Tally_Reco_${recoResult.o.code}_FY${recoResult.o.fy}.docx`,
        kpis,
        table: {
          title: 'Group-wise Reconciliation Summary',
          headers: builtSheets.sum.h,
          rows: sumWithTotal.map((r) =>
            r.map((v, ci) =>
              v == null || v === ''
                ? ''
                : typeof v === 'number'
                  ? /^(Not in .*\(#\)|#|Section|Day gap)/.test(builtSheets.sum.h[ci] || '')
                    ? String(v)
                    : fmtIN(v)
                  : v
            )
          ),
        },
        notes: builtSheets.warn,
      });
    } finally {
      setIsBusy(false);
      clearProgress();
    }
  };

  const handleExportCsv = () => {
    if (!recoResult || !builtSheets) return;
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    let tag = activeTab;

    if (activeTab === 'man') {
      headers = ['#', 'Source', 'Group', 'Why listed', 'Date', 'Party / Ledger', 'Ref', 'Amount', 'Link #', 'Status'];
      const manRows = manualViewData.rows.map((it, idx) => [
        idx + 1,
        it.src,
        it.grp,
        it.why,
        dfmt(it.d),
        it.party,
        it.ref,
        it.amt,
        manLinks[it.k] ? `#${manLinks[it.k]}` : '',
        manLinks[it.k] ? 'Matched manually' : 'Open',
      ]);
      const totMan = r2(manualViewData.rows.reduce((s, x) => s + x.amt, 0));
      rows = manRows.length ? [...manRows, ['TOTAL', '', '', '', '', '', '', totMan, '', '']] : [];
    } else if (activeTableView.headers.length > 0) {
      headers = activeTableView.headers;
      const fRow = computeTableSummaryFooter(activeTab, activeTableView.headers, activeTableView.rows);
      const src = fRow ? [...activeTableView.rows, fRow] : activeTableView.rows;
      rows = src.map((r) => r.map((v) => (v == null ? '' : v)));
    } else {
      headers = builtSheets.sum.h;
      const fRow = computeTableSummaryFooter('sum', builtSheets.sum.h, builtSheets.sum.d);
      const src = fRow ? [...builtSheets.sum.d, fRow] : builtSheets.sum.d;
      rows = src.map((r) => r.map((v) => (v == null ? '' : v)));
      tag = 'sum';
    }

    downloadBomCsv({
      filename: `26AS_Tally_${tag}_${recoResult.o.code}_FY${recoResult.o.fy}.csv`,
      preambleLines: [
        ['26AS <-> Tally Debit Reconciliation', buildPeriodLabel(recoResult.o)],
        ['Generated', new Date().toLocaleString('en-IN')],
      ],
      headers,
      rows,
    });
  };

  const handlePrint = async () => {
    if (!recoResult || !builtSheets || !dashData) return;
    const targetHeaders =
      activeTableView.headers.length > 0 ? activeTableView.headers : builtSheets.sum.h;
    const rawRows =
      activeTableView.headers.length > 0 ? activeTableView.rows : builtSheets.sum.d;
    const fRow = computeTableSummaryFooter(
      activeTableView.headers.length > 0 ? activeTab : 'sum',
      targetHeaders,
      rawRows
    );
    const esc = (s: unknown) =>
      String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const bodyHtml = `
      <h1>26AS ⇄ Tally Debit Ledger Reconciliation Report</h1>
      <p style="margin:0 0 8px;color:#475569">${esc(buildPeriodLabel(recoResult.o))} · Basis: ${
        recoResult.o.basis === 'book' ? 'Date of booking' : 'Transaction date'
      } · Tally: Debit only (Opening/Credit excluded)</p>
      <div class="kpi-grid">
        <div class="kpi-card"><div class="kpi-label">26AS Total</div><div class="kpi-val">₹ ${fmtIN(dashData.sA)}</div></div>
        <div class="kpi-card"><div class="kpi-label">Tally Debit Total</div><div class="kpi-val">₹ ${fmtIN(dashData.sT)}</div></div>
        <div class="kpi-card"><div class="kpi-label">Net Difference</div><div class="kpi-val">₹ ${fmtIN(dashData.diff)}</div></div>
        <div class="kpi-card"><div class="kpi-label">Not in Tally / Not in 26AS</div><div class="kpi-val">₹ ${fmtIN(dashData.miss)} / ₹ ${fmtIN(dashData.uT)}</div></div>
      </div>
      <table>
        <thead><tr>${targetHeaders.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
        <tbody>
          ${rawRows
            .map(
              (r) =>
                `<tr>${r
                  .map((v, ci) =>
                    typeof v === 'number'
                      ? `<td class="num">${
                          /^(Not in .*\(#\)|#|Section|Day gap)/.test(targetHeaders[ci] || '') ? v : fmtIN(v)
                        }</td>`
                      : `<td>${esc(v)}</td>`
                  )
                  .join('')}</tr>`
            )
            .join('')}
        </tbody>
        ${
          fRow
            ? `<tfoot><tr style="font-weight:700;background:#f1f5f9">${fRow
                .map((v, ci) =>
                  typeof v === 'number'
                    ? `<td class="num">${
                        /^(Not in .*\(#\)|#|Section|Day gap)/.test(targetHeaders[ci] || '') ? v : fmtIN(v)
                      }</td>`
                    : `<td>${esc(v)}</td>`
                )
                .join('')}</tr></tfoot>`
            : ''
        }
      </table>
    `;
    await printHtmlDocument({
      title: `26AS vs Tally Reco · ${buildPeriodLabel(recoResult.o)}`,
      orientation: 'landscape',
      bodyHtml,
    });
  };

  const handleExportJson = () => {
    if (!recoResult || !builtSheets || !dashData) return;
    downloadJsonFile({
      filename: `26AS_Tally_Reco_${recoResult.o.code}_FY${recoResult.o.fy}.json`,
      data: {
        period: buildPeriodLabel(recoResult.o),
        options: {
          code: recoResult.o.code,
          fy: recoResult.o.fy,
          basis: recoResult.o.basis,
          scope: recoResult.o.scope,
          tolerance: recoResult.o.tol,
          windowDays: recoResult.o.win,
          tallyRule: 'Debit voucher entries only; Opening/Closing/Credit excluded',
        },
        kpis: {
          total26AS: dashData.sA,
          totalTallyDebit: dashData.sT,
          difference: dashData.diff,
          notBookedInTally: dashData.miss,
          inTallyNotIn26AS: dashData.uT,
          amountMismatchDiff: dashData.misAmt,
          roundingDiff: dashData.rnd,
          timingDiff: dashData.tim,
          manualDiff: dashData.manDiff,
          unexplainedResidual: dashData.chk,
          reconciledPct: dashData.pct,
        },
        groupSummary: builtSheets.sum.d,
        warnings: builtSheets.warn,
      },
    });
  };

  const isAllAutoSelected =
    ledgers.length > 0 && ledgers.every((l) => incMap[l.name] !== false);
  const canShowMapping = A26.length > 0 && ledgers.length > 0;
  const tabCounts: Partial<Record<RecoTabId, number>> = builtSheets
    ? {
        sum: builtSheets.sum.d.length,
        tva: builtSheets.tva.d.length,
        avt: builtSheets.avt.d.length,
        mis: builtSheets.mis.d.length,
        mA: builtSheets.mA.d.length,
        mT: builtSheets.mT.d.length,
        man: builtSheets.man.d.length,
        pw: builtSheets.pw.d.length,
        bk: builtSheets.bk.d.length,
        warn: builtSheets.warn.length,
      }
    : {};

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header Card */}
      <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-4 sm:p-5 shadow-[0_4px_0_#2F3E4E] dark:shadow-[0_4px_0_#020617]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <span className="w-11 h-11 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#F9C80E] text-[#2F3E4E] flex items-center justify-center shrink-0">
              <GitCompareArrows className="w-5 h-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display font-extrabold text-lg sm:text-xl text-[#2F3E4E] dark:text-slate-100 tracking-tight">
                  {tool?.title || '26AS ⇄ Tally Ledger Reco'}
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[#2F3E4E] text-[#F9C80E] dark:bg-[#F9C80E] dark:text-[#0F172A]">
                  {tool?.code || 'VC-14'}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#CEE5DC] text-[#12805C] dark:bg-emerald-950/60 dark:text-emerald-300 border border-[#12805C]/30">
                  100% Browser Offline
                </span>
              </div>
              <p className="text-xs sm:text-[13px] text-[#475569] dark:text-slate-300 mt-1">
                Reconcile Tally TDS/TCS asset ledgers (<strong>Debit voucher entries only</strong> · Opening/Closing &amp; Credit rows excluded) against Form 26AS / ATS (.pdf, .txt, .xlsx, .csv) with union-find grouping, G/B reversal netting, 18 period filters &amp; exact rupee proof.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {canShowMapping && (
              <button
                type="button"
                onClick={() => executeReconciliation(true)}
                disabled={isBusy}
                className="inline-flex items-center gap-1.5 px-3.5 h-9 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#2F3E4E] dark:bg-[#F9C80E] hover:bg-[#1E293B] dark:hover:bg-[#FDE047] text-xs font-bold text-[#F9C80E] dark:text-[#0F172A] transition cursor-pointer disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Run Reco</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleClearAll}
              disabled={isBusy}
              className="inline-flex items-center gap-1.5 px-3.5 h-9 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] hover:bg-rose-50 dark:hover:bg-rose-950/50 text-xs font-bold text-[#2F3E4E] dark:text-slate-200 hover:text-rose-700 dark:hover:text-rose-300 transition cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Clear All</span>
            </button>
          </div>
        </div>

        {/* Inline Progress Bar */}
        {progressInfo && (
          <div className="mt-4 p-3 rounded-xl bg-[#FEF2C8]/70 dark:bg-slate-800/80 border border-[#2F3E4E]/20 dark:border-slate-700">
            <div className="flex items-center justify-between text-xs font-bold text-[#2F3E4E] dark:text-slate-200 mb-1.5">
              <span>{progressInfo.msg}</span>
              <span className="font-mono tabular-nums">{progressInfo.pct}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-white/80 dark:bg-slate-900 overflow-hidden border border-[#2F3E4E]/20 dark:border-slate-700">
              <div
                className="h-full bg-[#12805C] dark:bg-[#F9C80E] transition-all duration-200"
                style={{ width: `${progressInfo.pct}%` }}
              />
            </div>
          </div>
        )}

        {/* Inline Error & Banner Messages */}
        {errorMsg && (
          <div className="mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-500/40 flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-200">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
            <div className="flex-1">{errorMsg}</div>
            <button
              type="button"
              onClick={() => setErrorMsg('')}
              aria-label="Dismiss error"
              className="text-rose-500 hover:text-rose-700 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {bannerMsg && (
          <div className="mt-3 p-3 rounded-xl bg-[#CEE5DC]/70 dark:bg-emerald-950/50 border border-[#12805C]/35 flex items-start gap-2.5 text-xs text-[#12805C] dark:text-emerald-200">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{bannerMsg}</div>
            <button
              type="button"
              onClick={() => setBannerMsg('')}
              aria-label="Dismiss notice"
              className="opacity-70 hover:opacity-100 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Step 1: Upload Files */}
      <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-4 sm:p-5 shadow-[0_4px_0_#2F3E4E] dark:shadow-[0_4px_0_#020617] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display font-extrabold text-sm sm:text-base text-[#2F3E4E] dark:text-slate-100">
            1 · Upload Tally Ledger Export &amp; Form 26AS / ATS Files
          </h2>
          <span className="text-[11px] font-semibold text-[#12805C] dark:text-emerald-300">
            Tally Debit balances only · Opening / B/F / Closing &amp; Credit entries excluded
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2.5">
            <FileDropZone
              accept=".xlsx,.xls"
              multiple
              disabled={isBusy}
              onFiles={(files) => {
                const fl = filesToFileList(files);
                if (fl.length) void handleTallyFiles(fl);
              }}
              className="border-[1.5px] border-dashed border-[#2F3E4E]/50 dark:border-slate-600 rounded-xl bg-white/70 dark:bg-[#0B1120] hover:border-[#2F3E4E] dark:hover:border-[#F9C80E] transition"
            >
              <label
                htmlFor="reco-tally-file-input"
                className="block p-5 text-center space-y-1.5 cursor-pointer"
              >
                <input
                  id="reco-tally-file-input"
                  type="file"
                  accept=".xlsx,.xls"
                  multiple
                  disabled={isBusy}
                  onChange={(e) => {
                    if (e.target.files?.length) void handleTallyFiles(e.target.files);
                    e.target.value = '';
                  }}
                  className="hidden"
                />
                <FileSpreadsheet className="w-7 h-7 mx-auto text-[#2F3E4E] dark:text-[#F9C80E]" />
                <p className="font-display font-bold text-xs sm:text-sm text-[#2F3E4E] dark:text-slate-100">
                  Upload Tally Ledger Excel (.xlsx / .xls)
                </p>
                <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                  Click to browse or drag &amp; drop · Multiple workbooks &amp; multi-sheet ledgers
                </p>
              </label>
            </FileDropZone>

            {tallySources.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tallySources.map((src) => (
                  <span
                    key={src.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#FEF2C8] dark:bg-slate-800 border border-[#2F3E4E]/25 dark:border-slate-600 text-[#2F3E4E] dark:text-slate-200"
                  >
                    <span>
                      Tally · {src.fileName} ({src.sheets.length} sheet{src.sheets.length === 1 ? '' : 's'})
                    </span>
                    <button
                      type="button"
                      onClick={() => removeTallySource(src.id)}
                      aria-label={`Remove ${src.fileName}`}
                      className="text-[#475569] hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2.5">
            <FileDropZone
              accept=".pdf,.txt,.csv,.xlsx,.xls"
              multiple
              disabled={isBusy}
              onFiles={(files) => {
                const fl = filesToFileList(files);
                if (fl.length) void handle26ASFiles(fl);
              }}
              className="border-[1.5px] border-dashed border-[#2F3E4E]/50 dark:border-slate-600 rounded-xl bg-white/70 dark:bg-[#0B1120] hover:border-[#2F3E4E] dark:hover:border-[#F9C80E] transition"
            >
              <label
                htmlFor="reco-26as-file-input"
                className="block p-5 text-center space-y-1.5 cursor-pointer"
              >
                <input
                  id="reco-26as-file-input"
                  type="file"
                  accept=".pdf,.txt,.csv,.xlsx,.xls"
                  multiple
                  disabled={isBusy}
                  onChange={(e) => {
                    if (e.target.files?.length) void handle26ASFiles(e.target.files);
                    e.target.value = '';
                  }}
                  className="hidden"
                />
                <FileText className="w-7 h-7 mx-auto text-[#12805C] dark:text-emerald-400" />
                <p className="font-display font-bold text-xs sm:text-sm text-[#2F3E4E] dark:text-slate-100">
                  Upload Form 26AS / ATS (.pdf / .txt / .xlsx / .csv)
                </p>
                <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                  Click to browse or drag &amp; drop · Handles Part I/II (TDS), Part VI (TCS) &amp; G/B reversals
                </p>
              </label>
            </FileDropZone>

            {sources26.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {sources26.map((src) => (
                  <span
                    key={src.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#CEE5DC]/75 dark:bg-emerald-950/60 border border-[#12805C]/30 dark:border-emerald-700/50 text-[#12805C] dark:text-emerald-200"
                  >
                    <span>
                      26AS · {src.fileName} ({src.parsed.entries.length} net)
                    </span>
                    <button
                      type="button"
                      onClick={() => remove26Source(src.id)}
                      aria-label={`Remove ${src.fileName}`}
                      className="opacity-75 hover:opacity-100 hover:text-rose-700 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Pending Password-Protected PDFs Prompt */}
        {pendingLockedPdfs.length > 0 && (
          <form
            onSubmit={handleUnlockLockedPdfs}
            className="p-3.5 rounded-xl bg-[#FEF2C8] dark:bg-amber-950/40 border-[1.5px] border-[#2F3E4E] dark:border-amber-500/50 flex flex-col sm:flex-row sm:items-center gap-3"
          >
            <div className="flex items-center gap-2 text-xs font-bold text-[#2F3E4E] dark:text-amber-200">
              <KeyRound className="w-4 h-4 shrink-0 text-[#B45309] dark:text-amber-300" />
              <span>
                Unlock {pendingLockedPdfs.length} PDF ({pendingLockedPdfs.map((p) => p.fileName).join(', ')}):
              </span>
            </div>
            <div className="relative flex-1 max-w-xs">
              <input
                type={showPdfPassword ? 'text' : 'password'}
                value={pdfPassword}
                onChange={(e) => setPdfPassword(e.target.value)}
                placeholder="Enter Form 26AS Password (DDMMYYYY)"
                className="w-full h-9 pl-3 pr-9 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-mono text-[#2F3E4E] dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => setShowPdfPassword((v) => !v)}
                aria-label={showPdfPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#2F3E4E] dark:text-slate-400 cursor-pointer"
              >
                {showPdfPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <button
              type="submit"
              disabled={isBusy}
              className="px-4 h-9 rounded-lg bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#F9C80E] dark:text-[#0F172A] text-xs font-bold cursor-pointer hover:opacity-95"
            >
              Unlock &amp; Parse PDF
            </button>
          </form>
        )}

        {/* Parsed Metrics Strip before mapping */}
        {(A26.length > 0 || ledgers.length > 0) && (
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className="px-2.5 py-1 rounded-lg bg-[#FEF2C8]/70 dark:bg-slate-800 border border-[#2F3E4E]/20 dark:border-slate-700 font-semibold text-[#2F3E4E] dark:text-slate-200 tabular-nums">
              26AS Net Entries: <strong>{A26.length}</strong> ({Object.keys(deds).length} deductors · {nettedCount} reversals netted)
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-[#CEE5DC]/60 dark:bg-emerald-950/40 border border-[#12805C]/25 dark:border-emerald-800/50 font-semibold text-[#12805C] dark:text-emerald-200 tabular-nums">
              Tally Ledgers: <strong>{ledgers.length}</strong> ({ledgers.reduce((s, l) => s + l.entries.length, 0)} vouchers)
            </span>
            {!canShowMapping && (
              <span className="text-[#B45309] dark:text-amber-300 font-semibold">
                Waiting for both Tally workbook and Form 26AS / ATS file to unlock reconciliation…
              </span>
            )}
          </div>
        )}
      </div>

      {/* Step 2: Reconciliation Options */}
      {(A26.length > 0 || ledgers.length > 0) && (
        <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-4 sm:p-5 shadow-[0_4px_0_#2F3E4E] dark:shadow-[0_4px_0_#020617] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display font-extrabold text-sm sm:text-base text-[#2F3E4E] dark:text-slate-100">
              2 · Reconciliation Period, Date Basis &amp; Matching Rules
            </h2>
            {minDate && maxDate && (
              <span className="text-[11px] font-mono text-[#64748B] dark:text-slate-400">
                Data Span: {dfmt(minDate)} → {dfmt(maxDate)}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#475569] dark:text-slate-400 mb-1">
                Period Mode
              </label>
              <select
                value={periodCode}
                onChange={(e) => {
                  const nextCode = e.target.value as RecoPeriodCode;
                  setPeriodCode(nextCode);
                  if (nextCode !== 'MS') {
                    setSelectedMonths(new Set());
                  }
                }}
                className="w-full h-9 px-2.5 rounded-lg border-[1.5px] border-[#2F3E4E]/40 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-semibold text-[#2F3E4E] dark:text-slate-100"
              >
                <option value="FY">Full financial year</option>
                <option value="Q1">Q1 (Apr–Jun)</option>
                <option value="Q2">Q2 (Jul–Sep)</option>
                <option value="Q3">Q3 (Oct–Dec)</option>
                <option value="Q4">Q4 (Jan–Mar)</option>
                <option value="H1">H1 (Apr–Sep)</option>
                <option value="H2">H2 (Oct–Mar)</option>
                <option value="M3">Apr</option>
                <option value="M4">May</option>
                <option value="M5">Jun</option>
                <option value="M6">Jul</option>
                <option value="M7">Aug</option>
                <option value="M8">Sep</option>
                <option value="M9">Oct</option>
                <option value="M10">Nov</option>
                <option value="M11">Dec</option>
                <option value="M0">Jan</option>
                <option value="M1">Feb</option>
                <option value="M2">Mar</option>
                <option value="MR">Month range…</option>
                <option value="QR">Quarter range… (e.g. Q1–Q3)</option>
                <option value="MS">★ Selected months / quarters (pick below)</option>
                <option value="YTD">Year-to-date (FY start → as-on date)</option>
                <option value="LD">Last N days (to as-on date)</option>
                <option value="LM">Last N months (to as-on date)</option>
                <option value="CQ">Current quarter (of as-on date)</option>
                <option value="PQ">Previous quarter (before as-on date)</option>
                <option value="FR">Multiple financial years…</option>
                <option value="CY">Calendar year (Jan–Dec)</option>
                <option value="C">Custom from – to dates…</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#475569] dark:text-slate-400 mb-1">
                Financial Year
              </label>
              <select
                value={selectedFy}
                onChange={(e) => setSelectedFy(+e.target.value)}
                className="w-full h-9 px-2.5 rounded-lg border-[1.5px] border-[#2F3E4E]/40 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-semibold text-[#2F3E4E] dark:text-slate-100"
              >
                {fyList.map((y) => (
                  <option key={y} value={y}>
                    FY {y}-{String(y + 1).slice(2)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#475569] dark:text-slate-400 mb-1">
                26AS Date Used for Period
              </label>
              <select
                value={basis}
                onChange={(e) => setBasis(e.target.value as RecoDateBasis)}
                className="w-full h-9 px-2.5 rounded-lg border-[1.5px] border-[#2F3E4E]/40 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-semibold text-[#2F3E4E] dark:text-slate-100"
              >
                <option value="txn">Transaction date</option>
                <option value="book">Date of booking</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#475569] dark:text-slate-400 mb-1">
                Matching Scope
              </label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as RecoScope)}
                className="w-full h-9 px-2.5 rounded-lg border-[1.5px] border-[#2F3E4E]/40 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-semibold text-[#2F3E4E] dark:text-slate-100"
              >
                <option value="strict">Strict – only transactions inside period</option>
                <option value="buf">Period + buffer days (cut-off timing)</option>
                <option value="all">Whole data, report selected period</option>
              </select>
            </div>

            {/* Conditional Period Inputs */}
            {periodCode === 'C' && (
              <div className="sm:col-span-2 grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-[#475569] dark:text-slate-400 mb-1">
                    Custom From Date
                  </label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg border-[1.5px] border-[#2F3E4E]/40 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs text-[#2F3E4E] dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#475569] dark:text-slate-400 mb-1">
                    Custom To Date
                  </label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg border-[1.5px] border-[#2F3E4E]/40 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs text-[#2F3E4E] dark:text-slate-100"
                  />
                </div>
              </div>
            )}

            {periodCode === 'MR' && (
              <div className="sm:col-span-2 grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-[#475569] dark:text-slate-400 mb-1">
                    From Month
                  </label>
                  <select
                    value={mFrom}
                    onChange={(e) => setMFrom(+e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg border-[1.5px] border-[#2F3E4E]/40 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-semibold text-[#2F3E4E] dark:text-slate-100"
                  >
                    {FY_MONTH_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#475569] dark:text-slate-400 mb-1">
                    To Month
                  </label>
                  <select
                    value={mTo}
                    onChange={(e) => setMTo(+e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg border-[1.5px] border-[#2F3E4E]/40 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-semibold text-[#2F3E4E] dark:text-slate-100"
                  >
                    {FY_MONTH_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {periodCode === 'FR' && (
              <div className="sm:col-span-2 grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-[#475569] dark:text-slate-400 mb-1">
                    From FY
                  </label>
                  <select
                    value={fyFrom}
                    onChange={(e) => setFyFrom(+e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg border-[1.5px] border-[#2F3E4E]/40 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-semibold text-[#2F3E4E] dark:text-slate-100"
                  >
                    {fyList.map((y) => (
                      <option key={y} value={y}>
                        FY {y}-{String(y + 1).slice(2)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#475569] dark:text-slate-400 mb-1">
                    To FY
                  </label>
                  <select
                    value={fyTo}
                    onChange={(e) => setFyTo(+e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg border-[1.5px] border-[#2F3E4E]/40 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-semibold text-[#2F3E4E] dark:text-slate-100"
                  >
                    {fyList.map((y) => (
                      <option key={y} value={y}>
                        FY {y}-{String(y + 1).slice(2)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {periodCode === 'QR' && (
              <div className="sm:col-span-2 grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-[#475569] dark:text-slate-400 mb-1">
                    From Quarter
                  </label>
                  <select
                    value={qFrom}
                    onChange={(e) => setQFrom(+e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg border-[1.5px] border-[#2F3E4E]/40 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-semibold text-[#2F3E4E] dark:text-slate-100"
                  >
                    <option value={0}>Q1 Apr–Jun</option>
                    <option value={1}>Q2 Jul–Sep</option>
                    <option value={2}>Q3 Oct–Dec</option>
                    <option value={3}>Q4 Jan–Mar</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#475569] dark:text-slate-400 mb-1">
                    To Quarter
                  </label>
                  <select
                    value={qTo}
                    onChange={(e) => setQTo(+e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg border-[1.5px] border-[#2F3E4E]/40 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-semibold text-[#2F3E4E] dark:text-slate-100"
                  >
                    <option value={0}>Q1 Apr–Jun</option>
                    <option value={1}>Q2 Jul–Sep</option>
                    <option value={2}>Q3 Oct–Dec</option>
                    <option value={3}>Q4 Jan–Mar</option>
                  </select>
                </div>
              </div>
            )}

            {['LD', 'YTD', 'LM', 'CQ', 'PQ'].includes(periodCode) && (
              <div className="sm:col-span-2 grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-[#475569] dark:text-slate-400 mb-1">
                    As-on Date
                  </label>
                  <input
                    type="date"
                    value={asOnDate}
                    onChange={(e) => setAsOnDate(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg border-[1.5px] border-[#2F3E4E]/40 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs text-[#2F3E4E] dark:text-slate-100"
                  />
                </div>
                {(periodCode === 'LD' || periodCode === 'LM') && (
                  <div>
                    <label className="block text-[11px] font-bold text-[#475569] dark:text-slate-400 mb-1">
                      N ({periodCode === 'LD' ? 'Days' : 'Months'})
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={nDaysOrMonths}
                      onChange={(e) => setNDaysOrMonths(Math.max(1, +e.target.value || 1))}
                      className="w-full h-9 px-2.5 rounded-lg border-[1.5px] border-[#2F3E4E]/40 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-mono text-[#2F3E4E] dark:text-slate-100"
                    />
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-[#475569] dark:text-slate-400 mb-1">
                Buffer Days (Period + Buffer)
              </label>
              <input
                type="number"
                min={0}
                value={bufDays}
                disabled={scope !== 'buf'}
                onChange={(e) => setBufDays(Math.max(0, +e.target.value || 0))}
                className="w-full h-9 px-2.5 rounded-lg border-[1.5px] border-[#2F3E4E]/40 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-mono text-[#2F3E4E] dark:text-slate-100 disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#475569] dark:text-slate-400 mb-1">
                26AS Entries Filter
              </label>
              <select
                value={finFilter}
                onChange={(e) => setFinFilter(e.target.value as RecoFinFilter)}
                className="w-full h-9 px-2.5 rounded-lg border-[1.5px] border-[#2F3E4E]/40 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-semibold text-[#2F3E4E] dark:text-slate-100"
              >
                <option value="">All booking statuses</option>
                <option value="F">Final-status only</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#475569] dark:text-slate-400 mb-1">
                Rounding Tolerance (₹)
              </label>
              <input
                type="number"
                min={0}
                step={0.5}
                value={tol}
                onChange={(e) => setTol(Math.max(0, +e.target.value || 0))}
                className="w-full h-9 px-2.5 rounded-lg border-[1.5px] border-[#2F3E4E]/40 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-mono text-[#2F3E4E] dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#475569] dark:text-slate-400 mb-1">
                Grouped Window / Bucket (Days)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min={1}
                  title="Date window for grouped matches (days)"
                  value={winDays}
                  onChange={(e) => setWinDays(Math.max(1, +e.target.value || 45))}
                  className="w-full h-9 px-2.5 rounded-lg border-[1.5px] border-[#2F3E4E]/40 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-mono text-[#2F3E4E] dark:text-slate-100"
                />
                <input
                  type="number"
                  min={1}
                  title="Day-bucket size for Day Buckets tab (days)"
                  value={bktDays}
                  onChange={(e) => setBktDays(Math.max(1, +e.target.value || 30))}
                  className="w-full h-9 px-2.5 rounded-lg border-[1.5px] border-[#2F3E4E]/40 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-mono text-[#2F3E4E] dark:text-slate-100"
                />
              </div>
            </div>
          </div>

          {/* Interactive Month / TDS Quarter Picker */}
          {allMonthKeys.length > 0 && (
            <div className="pt-3 border-t border-[#2F3E4E]/15 dark:border-slate-700 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-[#475569] dark:text-slate-300">
                  <strong className="text-[#2F3E4E] dark:text-slate-100">Pick months / TDS quarters:</strong> Click any month or Q1–Q4 (counts = 26AS · Tally). Latest tx:{' '}
                  <strong className="font-mono text-[#2F3E4E] dark:text-[#F9C80E]">
                    {monthChipLabel(allMonthKeys[allMonthKeys.length - 1])}
                  </strong>
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      ['last', 'Last month'],
                      ['last3', 'Last 3 months'],
                      ['lastq', 'Latest quarter'],
                      ['lastfy', 'Whole latest FY'],
                      ['all', 'All months'],
                      ['clear', 'Clear'],
                    ] as const
                  ).map(([code, lbl]) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => applyQuickMonthPreset(code)}
                      className="px-2.5 py-1 rounded-lg border border-[#2F3E4E]/25 dark:border-slate-600 bg-white dark:bg-[#0B1120] hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] text-[11px] font-semibold text-[#2F3E4E] dark:text-slate-200 dark:hover:text-[#0F172A] transition cursor-pointer"
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5 overflow-x-auto pb-1">
                {[...fyList].reverse().map((y) => {
                  const mk = (i: number) => {
                    const m = (3 + i) % 12;
                    return `${m >= 3 ? y : y + 1}-${p2(m + 1)}`;
                  };
                  return (
                    <div key={y} className="flex items-center gap-1.5 min-w-max">
                      <span className="font-mono font-bold text-[11px] text-[#2F3E4E] dark:text-slate-200 min-w-[78px]">
                        FY {y}-{String(y + 1).slice(2)}
                      </span>
                      {[0, 1, 2, 3].map((q) => {
                        const qMonths = [0, 1, 2].map((j) => mk(q * 3 + j));
                        const on = qMonths.every((k) => selectedMonths.has(k));
                        return (
                          <button
                            key={q}
                            type="button"
                            onClick={() => toggleMonthKeys(qMonths)}
                            className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition cursor-pointer ${
                              on
                                ? 'bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#F9C80E] dark:text-[#0F172A] border-[#2F3E4E] dark:border-[#F9C80E]'
                                : 'bg-[#FEF2C8]/70 dark:bg-slate-800 text-[#2F3E4E] dark:text-slate-200 border-[#2F3E4E]/25 dark:border-slate-600 hover:border-[#2F3E4E]'
                            }`}
                          >
                            Q{q + 1}
                          </button>
                        );
                      })}
                      <span className="w-2" />
                      {Array.from({ length: 12 }, (_, i) => {
                        const k = mk(i);
                        const n1 = monthCountsA[k] || 0;
                        const n2 = monthCountsT[k] || 0;
                        const on = selectedMonths.has(k);
                        const hasData = n1 > 0 || n2 > 0;
                        return (
                          <button
                            key={k}
                            type="button"
                            onClick={() => toggleMonthKeys([k])}
                            className={`px-2 py-0.5 rounded-lg border text-center leading-tight transition cursor-pointer ${
                              on
                                ? 'bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#F9C80E] dark:text-[#0F172A] border-[#2F3E4E] dark:border-[#F9C80E]'
                                : 'bg-white dark:bg-[#0B1120] text-[#2F3E4E] dark:text-slate-200 border-[#2F3E4E]/20 dark:border-slate-700 hover:border-[#2F3E4E]'
                            } ${!hasData && !on ? 'opacity-45' : ''}`}
                          >
                            <span className="block text-[11px] font-bold">{MN[+k.slice(5) - 1]}</span>
                            <span className="block text-[9px] font-mono opacity-80">
                              {n1}·{n2}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Tally Ledger <-> 26AS Deductor Mapping */}
      {canShowMapping && (
        <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-4 sm:p-5 shadow-[0_4px_0_#2F3E4E] dark:shadow-[0_4px_0_#020617] space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-display font-extrabold text-sm sm:text-base text-[#2F3E4E] dark:text-slate-100">
                3 · Tally Ledger ⇄ 26AS Deductor Mapping
              </h2>
              <p className="text-xs text-[#475569] dark:text-slate-400">
                {mappedSummary.mappedLedgers}/{ledgers.length} ledgers mapped · {mappedSummary.unmappedDeds} deductors without a ledger · {mappedSummary.manualLedgers} ledger(s) on manual reco
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const next: Record<string, boolean> = {};
                  ledgers.forEach((l) => {
                    next[l.name] = true;
                  });
                  setIncMap(next);
                }}
                className="px-3 h-8 rounded-lg border border-[#2F3E4E]/35 dark:border-slate-600 bg-white dark:bg-[#0B1120] hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] dark:text-slate-200 dark:hover:text-[#0F172A] transition cursor-pointer"
              >
                ☑ Select all for auto-reco
              </button>
              <button
                type="button"
                onClick={() => {
                  const next: Record<string, boolean> = {};
                  ledgers.forEach((l) => {
                    next[l.name] = false;
                  });
                  setIncMap(next);
                }}
                className="px-3 h-8 rounded-lg border border-[#2F3E4E]/35 dark:border-slate-600 bg-white dark:bg-[#0B1120] hover:bg-[#FEF2C8] dark:hover:bg-slate-800 text-xs font-bold text-[#2F3E4E] dark:text-slate-200 transition cursor-pointer"
              >
                ☐ Unselect all (manual only)
              </button>
              <button
                type="button"
                onClick={() => executeReconciliation(true)}
                className="inline-flex items-center gap-1.5 px-4 h-8 rounded-lg bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#F9C80E] dark:text-[#0F172A] text-xs font-extrabold cursor-pointer hover:opacity-95"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Run Reconciliation</span>
              </button>
            </div>
          </div>

          <div className="overflow-auto max-h-80 rounded-xl border border-[#2F3E4E]/25 dark:border-slate-700 bg-white dark:bg-[#0B1120]">
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 bg-[#FEF2C8] dark:bg-slate-800 text-[#2F3E4E] dark:text-slate-200 z-10">
                <tr>
                  <th className="p-2 text-center border-b border-[#2F3E4E]/20 dark:border-slate-700">
                    <label className="inline-flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isAllAutoSelected}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          const next: Record<string, boolean> = {};
                          ledgers.forEach((l) => {
                            next[l.name] = checked;
                          });
                          setIncMap(next);
                        }}
                      />
                      <span>Auto</span>
                    </label>
                  </th>
                  <th className="p-2 text-left border-b border-[#2F3E4E]/20 dark:border-slate-700">Tally Ledger</th>
                  <th className="p-2 text-left border-b border-[#2F3E4E]/20 dark:border-slate-700">Type</th>
                  <th className="p-2 text-right border-b border-[#2F3E4E]/20 dark:border-slate-700">Debit Vouchers</th>
                  <th className="p-2 text-right border-b border-[#2F3E4E]/20 dark:border-slate-700">Σ Tally Debit (₹)</th>
                  <th className="p-2 text-left border-b border-[#2F3E4E]/20 dark:border-slate-700">Primary 26AS Deductor / Collector</th>
                  <th className="p-2 text-left border-b border-[#2F3E4E]/20 dark:border-slate-700">2nd (Optional)</th>
                </tr>
              </thead>
              <tbody>
                {ledgers.map((l) => {
                  const mapped = ledgerMap[l.name] || [];
                  const tallySum = r2(l.entries.reduce((s, e) => s + e.amt, 0));
                  const isIncluded = incMap[l.name] !== false;
                  const updateSlot = (slotIdx: 0 | 1, val: string) => {
                    const slot0 = slotIdx === 0 ? val : mapped[0] || '';
                    const slot1 = slotIdx === 1 ? val : mapped[1] || '';
                    const unique = [...new Set([slot0, slot1].filter(Boolean))];
                    setLedgerMap((prev) => ({ ...prev, [l.name]: unique }));
                  };

                  return (
                    <tr
                      key={l.name}
                      className="border-b border-[#2F3E4E]/10 dark:border-slate-800 hover:bg-[#FFFDF5] dark:hover:bg-slate-800/40"
                    >
                      <td className="p-2 text-center">
                        <input
                          type="checkbox"
                          checked={isIncluded}
                          onChange={(e) =>
                            setIncMap((prev) => ({ ...prev, [l.name]: e.target.checked }))
                          }
                        />
                      </td>
                      <td className="p-2 font-semibold text-[#2F3E4E] dark:text-slate-100 whitespace-nowrap">
                        {l.name}
                      </td>
                      <td className="p-2">
                        <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-[#FEF2C8] dark:bg-slate-800 text-[#2F3E4E] dark:text-[#F9C80E]">
                          {l.typ}
                        </span>
                      </td>
                      <td className="p-2 text-right font-mono tabular-nums text-[#475569] dark:text-slate-300">
                        {l.entries.length}
                      </td>
                      <td className="p-2 text-right font-mono tabular-nums font-bold text-[#2F3E4E] dark:text-slate-100">
                        {fmtIN(tallySum)}
                      </td>
                      <td className="p-2">
                        <select
                          value={mapped[0] || ''}
                          onChange={(e) => updateSlot(0, e.target.value)}
                          className="w-full max-w-[300px] h-8 px-2 rounded-md border border-[#2F3E4E]/30 dark:border-slate-600 bg-white dark:bg-[#131C2E] text-xs text-[#2F3E4E] dark:text-slate-100"
                        >
                          <option value="">— none —</option>
                          {sortedDedKeys.map((dk) => (
                            <option key={dk} value={dk}>
                              {deds[dk].typ} · {deds[dk].name.slice(0, 44)} · {deds[dk].tan}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <select
                          value={mapped[1] || ''}
                          onChange={(e) => updateSlot(1, e.target.value)}
                          className="w-full max-w-[240px] h-8 px-2 rounded-md border border-[#2F3E4E]/30 dark:border-slate-600 bg-white dark:bg-[#131C2E] text-xs text-[#2F3E4E] dark:text-slate-100"
                        >
                          <option value="">— none —</option>
                          {sortedDedKeys.map((dk) => (
                            <option key={dk} value={dk}>
                              {deds[dk].typ} · {deds[dk].name.slice(0, 40)} · {deds[dk].tan}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="sticky bottom-0 bg-[#FEF2C8] dark:bg-slate-800 text-[#2F3E4E] dark:text-slate-100 font-bold border-t-[1.5px] border-[#2F3E4E]/30 dark:border-slate-600">
                <tr>
                  <td className="p-2 text-center">—</td>
                  <td className="p-2">TOTAL ({ledgers.length} ledgers)</td>
                  <td className="p-2">ALL</td>
                  <td className="p-2 text-right font-mono tabular-nums">
                    {ledgers.reduce((s, l) => s + l.entries.length, 0)}
                  </td>
                  <td className="p-2 text-right font-mono tabular-nums">
                    {fmtIN(r2(ledgers.reduce((s, l) => s + l.entries.reduce((a, e) => a + e.amt, 0), 0)))}
                  </td>
                  <td colSpan={2} className="p-2 text-[11px] font-medium text-[#475569] dark:text-slate-300">
                    Debit entries only · Opening &amp; credit rows excluded
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Step 4: Results Workbench */}
      {recoResult && builtSheets && dashData && (
        <div
          ref={resultsRef}
          className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-4 sm:p-5 shadow-[0_4px_0_#2F3E4E] dark:shadow-[0_4px_0_#020617] space-y-4"
        >
          {/* Results Header + Export Toolbar */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <div>
              <h2 className="font-display font-extrabold text-base sm:text-lg text-[#2F3E4E] dark:text-slate-100">
                4 · Results · {buildPeriodLabel(recoResult.o)}
              </h2>
              <p className="text-xs text-[#475569] dark:text-slate-400">
                Date Basis: <strong>{recoResult.o.basis === 'book' ? 'Booking date' : 'Transaction date'}</strong> · Scope:{' '}
                <strong>
                  {recoResult.o.scope === 'buf'
                    ? `PERIOD ±${recoResult.o.buf}d BUFFER`
                    : recoResult.o.scope === 'all'
                      ? 'WHOLE DATA (REPORT PERIOD)'
                      : 'STRICT'}
                </strong>{' '}
                · Filter: <strong>{recoResult.o.fin === 'F' ? 'Final-only' : 'All statuses'}</strong> · Tol:{' '}
                <strong>₹{recoResult.o.tol}</strong> · Window: <strong>{recoResult.o.win}d</strong> · Bucket: <strong>{recoResult.o.bkt}d</strong>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExportProExcel}
                disabled={isBusy}
                className="inline-flex items-center gap-1.5 px-3.5 h-9 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#12805C] hover:bg-[#0F6A4C] text-xs font-bold text-white transition cursor-pointer disabled:opacity-50"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Pro Excel (.xlsx)</span>
              </button>
              <button
                type="button"
                onClick={handleExportPdf}
                disabled={isBusy}
                className="inline-flex items-center gap-1.5 px-3 h-9 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] dark:text-slate-100 dark:hover:text-[#0F172A] transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>PDF Audit</span>
              </button>
              <button
                type="button"
                onClick={() => void handleExportWord()}
                disabled={isBusy}
                className="inline-flex items-center gap-1.5 px-3 h-9 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] dark:text-slate-100 dark:hover:text-[#0F172A] transition cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Word (.docx)</span>
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 px-3 h-9 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] dark:text-slate-100 dark:hover:text-[#0F172A] transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV (Tab)</span>
              </button>
              <button
                type="button"
                onClick={() => void handlePrint()}
                className="inline-flex items-center gap-1.5 px-3 h-9 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] dark:text-slate-100 dark:hover:text-[#0F172A] transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
              <button
                type="button"
                onClick={handleExportJson}
                className="inline-flex items-center gap-1.5 px-3 h-9 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] dark:text-slate-100 dark:hover:text-[#0F172A] transition cursor-pointer"
              >
                <FileCode2 className="w-3.5 h-3.5" />
                <span>JSON</span>
              </button>
            </div>
          </div>

          {/* KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5">
            {[
              { label: '26AS Total', val: `₹ ${fmtIN(dashData.sA)}`, tone: 'neutral' },
              { label: 'Tally Debit Total', val: `₹ ${fmtIN(dashData.sT)}`, tone: 'neutral' },
              {
                label: 'Difference (26AS − Tally)',
                val: `₹ ${fmtIN(dashData.diff)}`,
                tone: Math.abs(dashData.diff) <= tol ? 'ok' : 'warn',
              },
              {
                label: `Pending: Not in Tally (${dashData.cntMiss})`,
                val: `₹ ${fmtIN(dashData.miss)}`,
                tone: dashData.miss > 0 ? 'err' : 'ok',
              },
              {
                label: `Pending: Not in 26AS (${dashData.cntUT})`,
                val: `₹ ${fmtIN(dashData.uT)}`,
                tone: dashData.uT > 0 ? 'err' : 'ok',
              },
              {
                label: 'Groups Reconciled',
                val: `${dashData.G.filter((g) => g.status === 'Reconciled').length} / ${dashData.G.length}`,
                tone: 'ok',
              },
              {
                label: 'Manual Reco · Open',
                val: `${dashData.open.length} items`,
                tone: dashData.open.length > 0 ? 'warn' : 'ok',
              },
            ].map((k) => (
              <div
                key={k.label}
                className="rounded-xl p-3 bg-white dark:bg-[#0B1120] border border-[#2F3E4E]/20 dark:border-slate-700"
              >
                <span className="block text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                  {k.label}
                </span>
                <span
                  className={`block mt-1 font-mono font-extrabold text-sm sm:text-base tabular-nums ${
                    k.tone === 'ok'
                      ? 'text-[#12805C] dark:text-emerald-400'
                      : k.tone === 'err'
                        ? 'text-rose-600 dark:text-rose-400'
                        : k.tone === 'warn'
                          ? 'text-[#B45309] dark:text-amber-400'
                          : 'text-[#2F3E4E] dark:text-slate-100'
                  }`}
                >
                  {k.val}
                </span>
              </div>
            ))}
          </div>

          {/* Reconciliation Difference Proof Bridge */}
          <div className="p-3 rounded-xl bg-white dark:bg-[#0B1120] border border-[#2F3E4E]/20 dark:border-slate-700 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] font-mono tabular-nums text-[#2F3E4E] dark:text-slate-200">
            <span className="font-sans font-extrabold uppercase tracking-wider text-[10px] text-[#64748B] dark:text-slate-400">
              Reco Bridge Proof:
            </span>
            <span>
              <strong>Diff</strong> ₹{fmtIN(dashData.diff)}
            </span>
            <span>=</span>
            <span className="text-rose-700 dark:text-rose-300 font-semibold">
              +Not in Tally ₹{fmtIN(dashData.miss)}
            </span>
            <span className="text-rose-700 dark:text-rose-300 font-semibold">
              −Not in 26AS ₹{fmtIN(dashData.uT)}
            </span>
            {dashData.misAmt !== 0 && (
              <span className="text-[#B45309] dark:text-amber-300 font-semibold">
                {dashData.misAmt >= 0 ? '+' : ''}Amt Mismatch ₹{fmtIN(dashData.misAmt)}
              </span>
            )}
            {dashData.rnd !== 0 && (
              <span className="text-[#475569] dark:text-slate-300">
                {dashData.rnd >= 0 ? '+' : ''}Rounding ₹{fmtIN(dashData.rnd)}
              </span>
            )}
            {dashData.tim !== 0 && (
              <span className="text-[#475569] dark:text-slate-300">
                {dashData.tim >= 0 ? '+' : ''}Timing ₹{fmtIN(dashData.tim)}
              </span>
            )}
            {dashData.manDiff !== 0 && (
              <span className="text-[#B45309] dark:text-amber-300">
                {dashData.manDiff >= 0 ? '+' : ''}Manual ₹{fmtIN(dashData.manDiff)}
              </span>
            )}
            <span
              className={`ml-auto px-2 py-0.5 rounded-md border font-sans font-bold text-[10px] ${
                Math.abs(dashData.chk) < 0.01
                  ? 'bg-[#CEE5DC]/80 dark:bg-emerald-950/60 text-[#12805C] dark:text-emerald-300 border-[#12805C]/30'
                  : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-500/40'
              }`}
            >
              Unexplained Check: ₹ {fmtIN(dashData.chk)}
            </span>
          </div>

          {/* 12 Tabs Navigation */}
          <div className="flex flex-wrap gap-1.5 pt-1 border-t border-[#2F3E4E]/15 dark:border-slate-700">
            {TAB_DEFS.map((t) => {
              const count = tabCounts[t.id];
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(t.id);
                    setSearchQuery('');
                    setStatusFilter('');
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer ${
                    isActive
                      ? 'bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#F9C80E] dark:text-[#0F172A] border-[#2F3E4E] dark:border-[#F9C80E]'
                      : 'bg-white dark:bg-[#0B1120] text-[#475569] dark:text-slate-300 border-[#2F3E4E]/20 dark:border-slate-700 hover:border-[#2F3E4E] dark:hover:border-slate-500'
                  }`}
                >
                  {t.id === 'dash' && <BarChart3 className="w-3.5 h-3.5" />}
                  <span>{t.label}</span>
                  {count !== undefined && (
                    <span
                      className={`px-1.5 py-0.2 rounded font-mono text-[10px] ${
                        isActive
                          ? 'bg-white/15 dark:bg-black/15'
                          : 'bg-[#FEF2C8] dark:bg-slate-800 text-[#2F3E4E] dark:text-slate-300'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Filter / Search Bar (for non-dashboard tabs) */}
          {activeTab !== 'dash' && (
            <div className="flex flex-wrap items-center gap-2.5">
              {activeTab !== 'warn' && (
                <div className="relative flex-1 min-w-[200px] max-w-xs">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search deductor, TAN, ledger, voucher…"
                    className="w-full h-9 pl-8 pr-3 rounded-lg border border-[#2F3E4E]/30 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs text-[#2F3E4E] dark:text-slate-100"
                  />
                </div>
              )}

              {activeTab === 'man' && (
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-9 px-2.5 rounded-lg border border-[#2F3E4E]/30 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-semibold text-[#2F3E4E] dark:text-slate-100"
                >
                  <option value="">All statuses</option>
                  <option value="Open">Open</option>
                  <option value="Matched manually">Matched manually</option>
                </select>
              )}

              {activeTab !== 'man' && activeTab !== 'warn' && activeTableView.statusOptions.length > 0 && (
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-9 px-2.5 rounded-lg border border-[#2F3E4E]/30 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-semibold text-[#2F3E4E] dark:text-slate-100"
                >
                  <option value="">All statuses</option>
                  {activeTableView.statusOptions.map((stOpt) => (
                    <option key={stOpt} value={stOpt}>
                      {stOpt}
                    </option>
                  ))}
                </select>
              )}

              {activeTab === 'gl' && (
                <select
                  value={selectedGroupNo}
                  onChange={(e) => setSelectedGroupNo(+e.target.value)}
                  className="h-9 px-2.5 rounded-lg border border-[#2F3E4E]/30 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-semibold text-[#2F3E4E] dark:text-slate-100 max-w-md"
                >
                  {recoResult.groups
                    .filter((g) => !g.manual)
                    .map((g) => (
                      <option key={g.n} value={g.n}>
                        {g.n}. {g.title.slice(0, 56)} — {g.status}
                      </option>
                    ))}
                </select>
              )}

              {activeTab !== 'warn' && (
                <span className="text-xs font-mono text-[#64748B] dark:text-slate-400 ml-auto">
                  {activeTab === 'man'
                    ? `${manualViewData.rows.length} of ${manualViewData.totalCount} items`
                    : `${activeTableView.rows.length} of ${activeTableView.totalRows || 0} rows`}
                </span>
              )}
            </div>
          )}

          {/* TAB 1: DASHBOARD */}
          {activeTab === 'dash' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Donut Status Panel */}
                <div className="rounded-xl p-4 bg-white dark:bg-[#0B1120] border border-[#2F3E4E]/20 dark:border-slate-700">
                  <h3 className="font-display font-bold text-sm text-[#2F3E4E] dark:text-slate-100 mb-3">
                    Group Status Breakdown ({dashData.G.length} active groups)
                  </h3>
                  <div className="flex flex-wrap items-center gap-6">
                    {(() => {
                      const tot = dashData.G.length || 1;
                      const C = 2 * Math.PI * 52;
                      let off = 0;
                      const strokeFor = (status: string) => {
                        const c = statusCategory(status);
                        return c === 'ok' ? '#12805C' : c === 'er' ? '#DC2626' : '#D97706';
                      };
                      return (
                        <svg width="140" height="140" viewBox="0 0 140 140" className="shrink-0">
                          <circle
                            r="52"
                            cx="70"
                            cy="70"
                            fill="none"
                            stroke="currentColor"
                            className="text-slate-200 dark:text-slate-800"
                            strokeWidth="20"
                          />
                          {Object.entries(dashData.byS).map(([status, n]) => {
                            const L = (C * n) / tot;
                            const curOff = off;
                            off += L;
                            return (
                              <circle
                                key={status}
                                r="52"
                                cx="70"
                                cy="70"
                                fill="none"
                                stroke={strokeFor(status)}
                                strokeWidth="20"
                                strokeDasharray={`${L} ${C - L}`}
                                strokeDashoffset={-curOff}
                                transform="rotate(-90 70 70)"
                              />
                            );
                          })}
                          <text
                            x="70"
                            y="68"
                            textAnchor="middle"
                            className="fill-[#2F3E4E] dark:fill-slate-100 font-mono font-extrabold text-[19px]"
                          >
                            {dashData.pct}%
                          </text>
                          <text
                            x="70"
                            y="83"
                            textAnchor="middle"
                            className="fill-[#64748B] dark:fill-slate-400 text-[9px] font-bold uppercase"
                          >
                            Reconciled
                          </text>
                        </svg>
                      );
                    })()}
                    <div className="space-y-1.5 flex-1 min-w-[160px]">
                      {Object.entries(dashData.byS).map(([status, n]) => {
                        const cat = statusCategory(status);
                        const dot =
                          cat === 'ok'
                            ? 'bg-[#12805C]'
                            : cat === 'er'
                              ? 'bg-rose-600'
                              : 'bg-amber-600';
                        return (
                          <div key={status} className="flex items-center justify-between text-xs">
                            <span className="inline-flex items-center gap-2 text-[#2F3E4E] dark:text-slate-200">
                              <span className={`w-2.5 h-2.5 rounded-sm ${dot}`} />
                              <span>{status}</span>
                            </span>
                            <span className="font-mono font-bold text-[#2F3E4E] dark:text-slate-100">
                              {n}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Top 10 Differences */}
                <div className="rounded-xl p-4 bg-white dark:bg-[#0B1120] border border-[#2F3E4E]/20 dark:border-slate-700">
                  <h3 className="font-display font-bold text-sm text-[#2F3E4E] dark:text-slate-100 mb-3">
                    Top 10 Differences (26AS − Tally)
                  </h3>
                  {dashData.top.length === 0 ? (
                    <p className="text-xs text-[#12805C] dark:text-emerald-400 font-semibold">
                      Zero net difference across all groups in selected period.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {(() => {
                        const maxD = Math.max(1, ...dashData.top.map((g) => Math.abs(g.diff)));
                        return dashData.top.map((g) => (
                          <div
                            key={g.n}
                            className="grid grid-cols-[150px_1fr_105px] items-center gap-2 text-xs"
                          >
                            <span className="truncate text-[#2F3E4E] dark:text-slate-200" title={g.title}>
                              {g.title}
                            </span>
                            <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  g.diff > 0 ? 'bg-rose-600' : 'bg-amber-500'
                                }`}
                                style={{ width: `${Math.max(2, (Math.abs(g.diff) / maxD) * 100)}%` }}
                              />
                            </div>
                            <span className="text-right font-mono tabular-nums font-bold text-[#2F3E4E] dark:text-slate-100">
                              {fmtIN(g.diff)}
                            </span>
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </div>

                {/* Month-wise 26AS vs Tally */}
                <div className="rounded-xl p-4 bg-white dark:bg-[#0B1120] border border-[#2F3E4E]/20 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-display font-bold text-sm text-[#2F3E4E] dark:text-slate-100">
                      Month-wise Trend (Selected FY)
                    </h3>
                    <div className="flex items-center gap-3 text-[11px] font-semibold">
                      <span className="inline-flex items-center gap-1 text-[#1E3A5F] dark:text-sky-400">
                        <span className="w-2.5 h-2.5 rounded-sm bg-[#1E3A5F] dark:bg-sky-400" />
                        26AS
                      </span>
                      <span className="inline-flex items-center gap-1 text-[#12805C] dark:text-emerald-400">
                        <span className="w-2.5 h-2.5 rounded-sm bg-[#12805C] dark:bg-emerald-400" />
                        Tally
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {(() => {
                      const maxM = Math.max(
                        1,
                        ...dashData.months.flatMap((r) => [Number(r[3] || 0), Number(r[4] || 0)])
                      );
                      return dashData.months.map((r) => {
                        const aVal = Number(r[3] || 0);
                        const tVal = Number(r[4] || 0);
                        return (
                          <div
                            key={String(r[0])}
                            className="grid grid-cols-[54px_1fr_105px] items-center gap-2 text-[11px]"
                          >
                            <span className="font-semibold text-[#2F3E4E] dark:text-slate-200">
                              {r[0]} {r[10] === 'Reconciled' ? '✓' : r[10] === 'Mismatch' ? '✗' : ''}
                            </span>
                            <div className="space-y-1">
                              <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                <div
                                  className="h-full bg-[#1E3A5F] dark:bg-sky-400 rounded-full"
                                  style={{ width: `${aVal ? Math.max(2, (aVal / maxM) * 100) : 0}%` }}
                                />
                              </div>
                              <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                <div
                                  className="h-full bg-[#12805C] dark:bg-emerald-400 rounded-full"
                                  style={{ width: `${tVal ? Math.max(2, (tVal / maxM) * 100) : 0}%` }}
                                />
                              </div>
                            </div>
                            <span className="text-right font-mono tabular-nums text-[10px] leading-tight text-[#475569] dark:text-slate-300">
                              {fmtIN(aVal)}
                              <br />
                              {fmtIN(tVal)}
                            </span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* Section-wise 26AS */}
                <div className="rounded-xl p-4 bg-white dark:bg-[#0B1120] border border-[#2F3E4E]/20 dark:border-slate-700">
                  <h3 className="font-display font-bold text-sm text-[#2F3E4E] dark:text-slate-100 mb-3">
                    Section-wise 26AS (Red = Not Booked in Tally)
                  </h3>
                  {dashData.sec.length === 0 ? (
                    <p className="text-xs text-[#64748B] dark:text-slate-400">
                      No 26AS section activity in selected period.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {(() => {
                        const maxSec = Math.max(1, ...dashData.sec.map((s) => s[1]));
                        return dashData.sec.map(([sec, tot, unbooked]) => (
                          <div
                            key={sec}
                            className="grid grid-cols-[72px_1fr_105px] items-center gap-2 text-xs"
                          >
                            <span className="font-mono font-bold text-[#2F3E4E] dark:text-slate-100">
                              Sec {sec}
                            </span>
                            <div className="relative h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                              <div
                                className="h-full bg-[#1E3A5F] dark:bg-sky-500 rounded-full"
                                style={{ width: `${Math.max(2, (tot / maxSec) * 100)}%` }}
                              />
                              {unbooked > 0 && (
                                <div
                                  className="absolute top-0 left-0 h-full bg-rose-600 rounded-full"
                                  style={{ width: `${Math.max(2, (unbooked / maxSec) * 100)}%` }}
                                />
                              )}
                            </div>
                            <span className="text-right font-mono tabular-nums font-bold text-[#2F3E4E] dark:text-slate-100">
                              {fmtIN(tot)}
                            </span>
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 12: WARNINGS */}
          {activeTab === 'warn' && (
            <div className="space-y-2">
              {builtSheets.warn.map((wText, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border-l-4 border-l-amber-500 border border-[#2F3E4E]/15 dark:border-slate-700 bg-[#FEF2C8]/60 dark:bg-amber-950/30 text-xs text-[#2F3E4E] dark:text-amber-100 flex items-start gap-2.5"
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                  <span>{wText}</span>
                </div>
              ))}
            </div>
          )}

          {/* TAB 8: MANUAL RECO WORKBENCH */}
          {activeTab === 'man' && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-[#FEF2C8]/75 dark:bg-slate-800/80 border border-[#2F3E4E]/20 dark:border-slate-700 flex flex-wrap items-center gap-2.5 text-xs">
                <span className="font-bold text-[#2F3E4E] dark:text-slate-100">
                  Selected {selectedManKeys.size}
                </span>
                <span className="font-mono text-[#475569] dark:text-slate-300 tabular-nums">
                  26AS ₹ {fmtIN(manualViewData.selected26)} · Tally ₹ {fmtIN(manualViewData.selectedTally)} · Diff ₹{' '}
                  <strong className="text-[#2F3E4E] dark:text-[#F9C80E]">
                    {fmtIN(r2(manualViewData.selected26 - manualViewData.selectedTally))}
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={handleLinkSelectedManual}
                  disabled={!selectedManKeys.size}
                  className="inline-flex items-center gap-1 px-3 h-8 rounded-lg bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#F9C80E] dark:text-[#0F172A] font-bold cursor-pointer disabled:opacity-45"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span>Link as Manual Match</span>
                </button>
                <button
                  type="button"
                  onClick={handleUnlinkSelectedManual}
                  disabled={!selectedManKeys.size}
                  className="inline-flex items-center gap-1 px-3 h-8 rounded-lg border border-[#2F3E4E]/35 dark:border-slate-600 bg-white dark:bg-[#0B1120] font-semibold text-[#2F3E4E] dark:text-slate-200 cursor-pointer disabled:opacity-45"
                >
                  <Unlink2 className="w-3.5 h-3.5" />
                  <span>Unlink</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedManKeys((prev) => {
                      const next = new Set(prev);
                      manualViewData.rows.forEach((it) => next.add(it.k));
                      return next;
                    })
                  }
                  className="px-2.5 h-8 rounded-lg border border-[#2F3E4E]/25 dark:border-slate-600 bg-white dark:bg-[#0B1120] font-semibold text-[#2F3E4E] dark:text-slate-200 cursor-pointer"
                >
                  Select shown
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedManKeys(new Set())}
                  className="px-2.5 h-8 rounded-lg border border-[#2F3E4E]/25 dark:border-slate-600 bg-white dark:bg-[#0B1120] font-semibold text-[#2F3E4E] dark:text-slate-200 cursor-pointer"
                >
                  Clear selection
                </button>
              </div>

              <div className="overflow-auto max-h-[60vh] rounded-xl border border-[#2F3E4E]/25 dark:border-slate-700 bg-white dark:bg-[#0B1120]">
                <table className="w-full text-xs border-collapse">
                  <thead className="sticky top-0 bg-[#FEF2C8] dark:bg-slate-800 text-[#2F3E4E] dark:text-slate-100 z-10">
                    <tr>
                      <th className="p-2 border-b border-[#2F3E4E]/20 dark:border-slate-700"></th>
                      <th className="p-2 text-left border-b border-[#2F3E4E]/20 dark:border-slate-700">#</th>
                      <th className="p-2 text-left border-b border-[#2F3E4E]/20 dark:border-slate-700">Source</th>
                      <th className="p-2 text-left border-b border-[#2F3E4E]/20 dark:border-slate-700">Group</th>
                      <th className="p-2 text-left border-b border-[#2F3E4E]/20 dark:border-slate-700">Why listed</th>
                      <th className="p-2 text-left border-b border-[#2F3E4E]/20 dark:border-slate-700">Date</th>
                      <th className="p-2 text-left border-b border-[#2F3E4E]/20 dark:border-slate-700">Party / Ledger</th>
                      <th className="p-2 text-left border-b border-[#2F3E4E]/20 dark:border-slate-700">Ref</th>
                      <th className="p-2 text-right border-b border-[#2F3E4E]/20 dark:border-slate-700">Amount</th>
                      <th className="p-2 text-center border-b border-[#2F3E4E]/20 dark:border-slate-700">Link</th>
                      <th className="p-2 text-center border-b border-[#2F3E4E]/20 dark:border-slate-700">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {manualViewData.rows.map((it, idx) => {
                      const linkId = manLinks[it.k];
                      const stLabel = linkId ? 'Matched manually' : 'Open';
                      return (
                        <tr
                          key={it.k}
                          className="border-b border-[#2F3E4E]/10 dark:border-slate-800 hover:bg-[#FFFDF5] dark:hover:bg-slate-800/40"
                        >
                          <td className="p-2 text-center">
                            <input
                              type="checkbox"
                              checked={selectedManKeys.has(it.k)}
                              onChange={(e) => {
                                setSelectedManKeys((prev) => {
                                  const next = new Set(prev);
                                  if (e.target.checked) next.add(it.k);
                                  else next.delete(it.k);
                                  return next;
                                });
                              }}
                            />
                          </td>
                          <td className="p-2 font-mono">{idx + 1}</td>
                          <td className="p-2">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                it.src === '26AS'
                                  ? 'bg-[#FEF2C8] text-[#9A5B00] border-[#9A5B00]/30 dark:bg-amber-950/50 dark:text-amber-300'
                                  : 'bg-[#CEE5DC]/75 text-[#12805C] border-[#12805C]/30 dark:bg-emerald-950/50 dark:text-emerald-300'
                              }`}
                            >
                              {it.src}
                            </span>
                          </td>
                          <td className="p-2 whitespace-nowrap">{it.grp.slice(0, 38)}</td>
                          <td className="p-2 whitespace-nowrap">{it.why}</td>
                          <td className="p-2 whitespace-nowrap font-mono">{dfmt(it.d)}</td>
                          <td className="p-2 whitespace-nowrap">{it.party.slice(0, 38)}</td>
                          <td className="p-2 whitespace-nowrap font-mono">{it.ref}</td>
                          <td className="p-2 text-right font-mono tabular-nums font-bold">{fmtIN(it.amt)}</td>
                          <td className="p-2 text-center font-mono font-bold">
                            {linkId ? `#${linkId}` : ''}
                          </td>
                          <td className="p-2 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBadgeClasses(
                                linkId ? 'Matched manually' : 'Not in'
                              )}`}
                            >
                              {stLabel}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {manualViewData.rows.length === 0 && (
                      <tr>
                        <td colSpan={11} className="p-6 text-center text-[#64748B] dark:text-slate-400">
                          No manual or unreconciled items match your filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {manualViewData.rows.length > 0 && (
                    <tfoot className="sticky bottom-0 bg-[#FEF2C8] dark:bg-slate-800 text-[#2F3E4E] dark:text-slate-100 font-bold border-t-[1.5px] border-[#2F3E4E]/30 dark:border-slate-600 z-10">
                      <tr>
                        <td className="p-2" colSpan={5}>
                          TOTAL ({manualViewData.rows.length} items) · 26AS: ₹{' '}
                          {fmtIN(
                            r2(
                              manualViewData.rows
                                .filter((x) => x.src === '26AS')
                                .reduce((s, x) => s + x.amt, 0)
                            )
                          )}{' '}
                          | Tally Debit: ₹{' '}
                          {fmtIN(
                            r2(
                              manualViewData.rows
                                .filter((x) => x.src === 'Tally')
                                .reduce((s, x) => s + x.amt, 0)
                            )
                          )}
                        </td>
                        <td className="p-2" colSpan={3} />
                        <td className="p-2 text-right font-mono tabular-nums whitespace-nowrap">
                          {fmtIN(r2(manualViewData.rows.reduce((s, x) => s + x.amt, 0)))}
                        </td>
                        <td className="p-2" colSpan={2} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* DATA TABLE TABS */}
          {activeTab !== 'dash' && activeTab !== 'warn' && activeTab !== 'man' && (
            <div className="space-y-3">
              {activeTab === 'gl' && activeTableView.groupHdr && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-3 rounded-xl bg-white dark:bg-[#0B1120] border border-[#2F3E4E]/20 dark:border-slate-700 text-xs">
                  {activeTableView.groupHdr.map(([k, v], i) => (
                    <div key={i} className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-[#FFFDF5] dark:bg-slate-800/50">
                      <span className="text-[#64748B] dark:text-slate-400 truncate">{k}</span>
                      <strong className="font-mono tabular-nums text-[#2F3E4E] dark:text-slate-100 shrink-0">
                        {typeof v === 'number' ? fmtIN(v) : v}
                      </strong>
                    </div>
                  ))}
                </div>
              )}

              <div className="overflow-auto max-h-[62vh] rounded-xl border border-[#2F3E4E]/25 dark:border-slate-700 bg-white dark:bg-[#0B1120]">
                <table className="w-full text-xs border-collapse">
                  <thead className="sticky top-0 bg-[#FEF2C8] dark:bg-slate-800 text-[#2F3E4E] dark:text-slate-100 z-10">
                    <tr>
                      {activeTableView.headers.map((h, hi) => (
                        <th
                          key={hi}
                          className="p-2 text-left border-b border-[#2F3E4E]/20 dark:border-slate-700 whitespace-nowrap font-bold"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeTableView.rows.map((r, ri) => (
                      <tr
                        key={ri}
                        className="border-b border-[#2F3E4E]/10 dark:border-slate-800 hover:bg-[#FFFDF5] dark:hover:bg-slate-800/40"
                      >
                        {r.map((v, ci) => {
                          const colHdr = activeTableView.headers[ci] || '';
                          const isCount = /^(#|\s*#|Section|Day gap)/.test(colHdr);
                          if (ci === activeTableView.statusColIdx && v) {
                            return (
                              <td key={ci} className="p-2 whitespace-nowrap">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBadgeClasses(
                                    String(v)
                                  )}`}
                                >
                                  {String(v)}
                                </span>
                              </td>
                            );
                          }
                          if (typeof v === 'number') {
                            return (
                              <td
                                key={ci}
                                className="p-2 text-right font-mono tabular-nums whitespace-nowrap text-[#2F3E4E] dark:text-slate-100"
                              >
                                {isCount ? v : fmtIN(v)}
                              </td>
                            );
                          }
                          return (
                            <td
                              key={ci}
                              className="p-2 whitespace-nowrap text-[#2F3E4E] dark:text-slate-200"
                            >
                              {v ?? ''}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {activeTableView.rows.length === 0 && (
                      <tr>
                        <td
                          colSpan={Math.max(1, activeTableView.headers.length)}
                          className="p-6 text-center text-[#64748B] dark:text-slate-400"
                        >
                          No rows match the current filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {(() => {
                    const footerRow = computeTableSummaryFooter(
                      activeTab,
                      activeTableView.headers,
                      activeTableView.rows
                    );
                    if (!footerRow) return null;
                    return (
                      <tfoot className="sticky bottom-0 bg-[#FEF2C8] dark:bg-slate-800 text-[#2F3E4E] dark:text-slate-100 font-bold border-t-[1.5px] border-[#2F3E4E]/30 dark:border-slate-600 z-10">
                        <tr>
                          {footerRow.map((fv, fi) => {
                            const colHdr = activeTableView.headers[fi] || '';
                            const isCnt = /^(Not in .*\(#\)|#|Section|Day gap)/.test(colHdr);
                            return (
                              <td
                                key={fi}
                                className={`p-2 whitespace-nowrap ${
                                  typeof fv === 'number' ? 'text-right font-mono tabular-nums' : ''
                                }`}
                              >
                                {fv == null || fv === ''
                                  ? ''
                                  : typeof fv === 'number'
                                    ? isCnt
                                      ? fv
                                      : fmtIN(fv)
                                    : fv}
                              </td>
                            );
                          })}
                        </tr>
                      </tfoot>
                    );
                  })()}
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function computeTableSummaryFooter(
  tabId: RecoTabId,
  headers: string[],
  rows: (string | number | null)[][]
): (string | number | null)[] | null {
  if (!headers.length || !rows.length) return null;
  // On Period-wise tab, rows include overlapping Quarters/Half-Years/Full FY. Sum the 12 FY monthly rows if present.
  const targetRows =
    tabId === 'pw' && rows.length >= 12 ? rows.slice(0, 12) : rows;
  const label =
    tabId === 'pw' && rows.length >= 12 ? 'FY Months Σ (Apr–Mar)' : `TOTAL (${rows.length})`;
  const noSumCol = /^(#|Section|Day gap|Manual match)$/;
  return headers.map((h, ci) => {
    if (ci === 0) return label;
    if (noSumCol.test(String(h).trim())) return '';
    const hasNumeric = targetRows.some((r) => typeof r[ci] === 'number');
    if (!hasNumeric) return '';
    const sumVal = targetRows.reduce(
      (acc, r) => acc + (typeof r[ci] === 'number' ? (r[ci] as number) : 0),
      0
    );
    return /^(Not in .*\(#\))$/.test(String(h).trim()) ? Math.round(sumVal) : r2(sumVal);
  });
}
