import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  GitCompareArrows,
  RotateCcw,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import { ToolCatalogItem } from '../../types/tools';
import {
  CATS,
  CategoryOverride,
  FIELDS,
  FieldKey,
  ReconRow,
  ReconStatus,
  STATUS_ORDER,
  SideKey,
  SideState,
  UploadedSheetFile,
  VoucherCategory,
  assessAmountColumn,
  autoIdx,
  buildSideEntries,
  extractSheetHeadersAndRows,
  formatExcelDate,
  formatMoney,
  parsePrefixRules,
  reconcileEntries,
} from '../../utils/dmsTallyEngine';
import {
  RecoPeriodFilter,
  createDefaultRecoPeriodFilter,
  excelSerialToKey,
  extractPeriodChoicesFromKeys,
  isDateKeyInRecoPeriod,
  resolveRecoPeriodBounds,
} from '../../utils/recoPeriodFilter';
import { RecoPeriodFilterBar } from './RecoPeriodFilterBar';

interface DmsTallyReconcilerViewProps {
  tool?: ToolCatalogItem;
  onBack?: () => void;
}

const STATUS_BADGE_STYLES: Record<ReconStatus, { badge: string; border: string }> = {
  Matched: {
    badge: 'bg-emerald-100 text-emerald-900 border-emerald-700/40',
    border: '#047857',
  },
  'Amount diff': {
    badge: 'bg-red-100 text-red-900 border-red-700/40',
    border: '#b91c1c',
  },
  'Date diff': {
    badge: 'bg-amber-100 text-amber-900 border-amber-700/40',
    border: '#b45309',
  },
  'Type diff': {
    badge: 'bg-purple-100 text-purple-900 border-purple-700/40',
    border: '#6d28d9',
  },
  'Fuzzy match': {
    badge: 'bg-blue-100 text-blue-900 border-blue-700/40',
    border: '#1d4ed8',
  },
  'Only in DMS': {
    badge: 'bg-rose-100 text-rose-900 border-rose-700/40',
    border: '#b91c1c',
  },
  'Only in Tally': {
    badge: 'bg-orange-100 text-orange-900 border-orange-700/40',
    border: '#b91c1c',
  },
};

function createInitialSideState(): SideState {
  return {
    files: [],
    map: {},
    inc: new Set<VoucherCategory>(CATS),
  };
}

function detectMapFromFiles(
  files: UploadedSheetFile[],
  existingMap: Partial<Record<FieldKey, string>> = {},
  forceReDetect = false
): Partial<Record<FieldKey, string>> {
  const nextMap: Partial<Record<FieldKey, string>> = forceReDetect ? {} : { ...existingMap };
  const allHeaders = new Set(files.flatMap((f) => f.headers).filter(Boolean));
  const primaryFile = files[0];
  if (!primaryFile) return {};

  FIELDS.forEach(([k]) => {
    const current = nextMap[k];
    const currentStillValid =
      current === '__NONE__' || (Boolean(current) && allHeaders.has(current as string));

    if (forceReDetect || current === undefined || (!currentStillValid && files.length > 0)) {
      let picked = '';
      for (const f of files) {
        const idx = autoIdx(f.headers, k, f.rows);
        if (idx >= 0 && f.headers[idx]) {
          picked = f.headers[idx];
          break;
        }
      }
      nextMap[k] = picked;
    } else if (current === '' && (k === 'amt' || k === 'amt2' || k === 'vno')) {
      // If an earlier file lacked a match (e.g., File 1 had no Credit column, File 2 does), detect it now
      for (const f of files) {
        const idx = autoIdx(f.headers, k, f.rows);
        if (idx >= 0 && f.headers[idx]) {
          nextMap[k] = f.headers[idx];
          break;
        }
      }
    }
  });

  if (nextMap.amt && nextMap.amt2 && nextMap.amt === nextMap.amt2) {
    nextMap.amt2 = '';
  }

  return nextMap;
}

export const DmsTallyReconcilerView: React.FC<DmsTallyReconcilerViewProps> = ({ tool }) => {
  const [dmsState, setDmsState] = useState<SideState>(createInitialSideState);
  const [tallyState, setTallyState] = useState<SideState>(createInitialSideState);
  const [dragOverSide, setDragOverSide] = useState<SideKey | null>(null);

  // Matching Rules state
  const [amtTol, setAmtTol] = useState<number>(1);
  const [dateTol, setDateTol] = useState<number>(0);
  const [fuzzyEnabled, setFuzzyEnabled] = useState<boolean>(true);
  const [fuzzyDays, setFuzzyDays] = useState<number>(3);
  const [fuzzySameType, setFuzzySameType] = useState<boolean>(true);
  const [ignorePrefix, setIgnorePrefix] = useState<boolean>(false);
  const [prefixRulesText, setPrefixRulesText] = useState<string>('');

  // Results & UI state
  const [periodFilter, setPeriodFilter] = useState<RecoPeriodFilter>(() =>
    createDefaultRecoPeriodFilter()
  );
  const [results, setResults] = useState<ReconRow[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<'All' | ReconStatus>('All');
  const [typeFilter, setTypeFilter] = useState<string>('All types');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const parsedPrefixRules = useMemo(() => parsePrefixRules(prefixRulesText), [prefixRulesText]);

  const dmsAmtAssessment = useMemo(
    () => assessAmountColumn(dmsState.map.amt, dmsState.files),
    [dmsState.map.amt, dmsState.files]
  );

  const tallyAmtAssessment = useMemo(
    () => assessAmountColumn(tallyState.map.amt, tallyState.files),
    [tallyState.map.amt, tallyState.files]
  );

  const rawEntriesPreview = useMemo(() => {
    const safeBuild = (side: SideKey, s: SideState) => {
      if (s.files.length === 0) return [];
      try {
        return buildSideEntries(side, s, true, ignorePrefix, parsedPrefixRules);
      } catch {
        return [];
      }
    };
    return {
      dmsAll: safeBuild('dms', dmsState),
      tallyAll: safeBuild('tally', tallyState),
    };
  }, [dmsState, tallyState, ignorePrefix, parsedPrefixRules]);

  const availablePeriods = useMemo(() => {
    if (rawEntriesPreview.dmsAll.length === 0 && rawEntriesPreview.tallyAll.length === 0) {
      return undefined;
    }
    const keys = [
      ...rawEntriesPreview.dmsAll.map((e) => excelSerialToKey(e.date)),
      ...rawEntriesPreview.tallyAll.map((e) => excelSerialToKey(e.date)),
    ];
    return extractPeriodChoicesFromKeys(keys);
  }, [rawEntriesPreview]);

  const periodEntryCounts = useMemo(() => {
    const dmsActive = rawEntriesPreview.dmsAll.filter((e) => dmsState.inc.has(e.cat));
    const tallyActive = rawEntriesPreview.tallyAll.filter((e) => tallyState.inc.has(e.cat));
    const dmsIn = dmsActive.filter((e) =>
      isDateKeyInRecoPeriod(excelSerialToKey(e.date), periodFilter)
    ).length;
    const tallyIn = tallyActive.filter((e) =>
      isDateKeyInRecoPeriod(excelSerialToKey(e.date), periodFilter)
    ).length;
    return {
      matched: dmsIn + tallyIn,
      total: dmsActive.length + tallyActive.length,
    };
  }, [rawEntriesPreview, dmsState.inc, tallyState.inc, periodFilter]);

  const sideCounts = useMemo(() => {
    const compute = (entries: typeof rawEntriesPreview.dmsAll) => {
      const counts: Record<VoucherCategory, number> = {
        Sales: 0,
        Purchase: 0,
        'Debit Note': 0,
        'Credit Note': 0,
        Other: 0,
      };
      entries.forEach((entry) => {
        if (isDateKeyInRecoPeriod(excelSerialToKey(entry.date), periodFilter)) {
          counts[entry.cat]++;
        }
      });
      return counts;
    };

    return {
      dms: compute(rawEntriesPreview.dmsAll),
      tally: compute(rawEntriesPreview.tallyAll),
    };
  }, [rawEntriesPreview, periodFilter]);

  const handleLoadFiles = async (side: SideKey, fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setErrorMsg('');

    const loadedFiles: UploadedSheetFile[] = [];
    const failedNames: string[] = [];

    for (const f of Array.from(fileList)) {
      try {
        const buffer = await f.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });

        // Pick the first non-empty sheet (usually Sheet 0)
        let chosenSheet: XLSX.WorkSheet | undefined;
        let extracted: { headers: string[]; rows: unknown[][] } = { headers: [], rows: [] };
        for (const sheetName of wb.SheetNames) {
          const sheet = wb.Sheets[sheetName];
          if (!sheet) continue;
          const candidate = extractSheetHeadersAndRows(sheet);
          if (candidate.headers.length > 0 && candidate.rows.length > 0) {
            chosenSheet = sheet;
            extracted = candidate;
            break;
          }
          if (!chosenSheet && candidate.headers.length > 0) {
            chosenSheet = sheet;
            extracted = candidate;
          }
        }

        if (!chosenSheet) {
          failedNames.push(`${f.name} (no readable sheet data found)`);
          continue;
        }

        loadedFiles.push({
          id: `${f.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: f.name,
          headers: extracted.headers,
          rows: extracted.rows,
          ov: 'Auto',
        });
      } catch {
        failedNames.push(f.name);
      }
    }

    if (failedNames.length > 0) {
      setErrorMsg(
        `Could not read: ${failedNames.join(', ')}. Please verify it is a valid .xlsx, .xls, or .csv workbook.`
      );
    }

    if (loadedFiles.length === 0) return;

    const updater = (prev: SideState): SideState => {
      const nextFiles = [...prev.files, ...loadedFiles];
      const nextMap = detectMapFromFiles(nextFiles, prev.map, false);
      return {
        ...prev,
        files: nextFiles,
        map: nextMap,
      };
    };

    if (side === 'dms') {
      setDmsState(updater);
    } else {
      setTallyState(updater);
    }
  };

  const handleRemoveFile = (side: SideKey, fileId: string) => {
    const updater = (prev: SideState): SideState => {
      const nextFiles = prev.files.filter((f) => f.id !== fileId);
      return {
        ...prev,
        files: nextFiles,
        map: detectMapFromFiles(nextFiles, prev.map, false),
      };
    };
    if (side === 'dms') setDmsState(updater);
    else setTallyState(updater);
  };

  const handleAutoDetectSide = (side: SideKey) => {
    const updater = (prev: SideState): SideState => ({
      ...prev,
      map: detectMapFromFiles(prev.files, prev.map, true),
    });
    if (side === 'dms') setDmsState(updater);
    else setTallyState(updater);
  };

  const handleOverrideChange = (side: SideKey, fileId: string, ov: CategoryOverride) => {
    const updater = (prev: SideState): SideState => ({
      ...prev,
      files: prev.files.map((f) => (f.id === fileId ? { ...f, ov } : f)),
    });
    if (side === 'dms') setDmsState(updater);
    else setTallyState(updater);
  };

  const handleToggleCategory = (side: SideKey, cat: VoucherCategory) => {
    const updater = (prev: SideState): SideState => {
      const nextInc = new Set(prev.inc);
      if (nextInc.has(cat)) nextInc.delete(cat);
      else nextInc.add(cat);
      return { ...prev, inc: nextInc };
    };
    if (side === 'dms') setDmsState(updater);
    else setTallyState(updater);
  };

  const handleMapChange = (side: SideKey, field: FieldKey, value: string) => {
    const updater = (prev: SideState): SideState => ({
      ...prev,
      map: { ...prev.map, [field]: value || '__NONE__' },
    });
    if (side === 'dms') setDmsState(updater);
    else setTallyState(updater);
  };

  const handleResetAll = () => {
    setDmsState(createInitialSideState());
    setTallyState(createInitialSideState());
    setPeriodFilter(createDefaultRecoPeriodFilter());
    setResults(null);
    setStatusFilter('All');
    setTypeFilter('All types');
    setSearchQuery('');
    setErrorMsg('');
  };

  const executeReconciliationWithFilter = (activePeriod: RecoPeriodFilter) => {
    const A = buildSideEntries('dms', dmsState, false, ignorePrefix, parsedPrefixRules).filter(
      (e) => isDateKeyInRecoPeriod(excelSerialToKey(e.date), activePeriod)
    );
    const B = buildSideEntries('tally', tallyState, false, ignorePrefix, parsedPrefixRules).filter(
      (e) => isDateKeyInRecoPeriod(excelSerialToKey(e.date), activePeriod)
    );

    const res = reconcileEntries(A, B, {
      amtTol: Number(amtTol) || 0,
      dateTol: Number(dateTol) || 0,
      fuzzyEnabled,
      fuzzyDays: Number(fuzzyDays) || 0,
      fuzzySameType,
    });

    setResults(res);
  };

  const runReconciliation = () => {
    if (dmsState.files.length === 0 || tallyState.files.length === 0) {
      setErrorMsg('Upload at least one DMS file and one Tally file before reconciling.');
      return;
    }
    setErrorMsg('');
    executeReconciliationWithFilter(periodFilter);
    setStatusFilter('All');
    setTypeFilter('All types');
  };

  const handlePeriodChange = (nextPeriod: RecoPeriodFilter) => {
    setPeriodFilter(nextPeriod);
    if (results !== null && dmsState.files.length > 0 && tallyState.files.length > 0) {
      executeReconciliationWithFilter(nextPeriod);
    }
  };

  const summaryStats = useMemo(() => {
    if (!results) return null;
    const cnt: Record<ReconStatus, number> = {
      Matched: 0,
      'Amount diff': 0,
      'Date diff': 0,
      'Type diff': 0,
      'Fuzzy match': 0,
      'Only in DMS': 0,
      'Only in Tally': 0,
    };
    const sum: Record<ReconStatus, number> = {
      Matched: 0,
      'Amount diff': 0,
      'Date diff': 0,
      'Type diff': 0,
      'Fuzzy match': 0,
      'Only in DMS': 0,
      'Only in Tally': 0,
    };

    let totalA = 0;
    let totalB = 0;

    results.forEach((r) => {
      cnt[r.status]++;
      sum[r.status] += Math.abs(r.diff || 0);
      totalA += r.a || 0;
      totalB += r.b || 0;
    });

    const activeCats = CATS.filter((c) => results.some((r) => r.cat === c));
    const catBreakdown = activeCats.map((c) => {
      const items = results.filter((r) => r.cat === c);
      const a = items.reduce((s, r) => s + (r.a || 0), 0);
      const b = items.reduce((s, r) => s + (r.b || 0), 0);
      return {
        cat: c,
        dmsCount: items.filter((r) => r.a != null).length,
        dmsAmt: a,
        tallyCount: items.filter((r) => r.b != null).length,
        tallyAmt: b,
        diff: a - b,
      };
    });

    return { cnt, sum, totalA, totalB, activeCats, catBreakdown };
  }, [results]);

  const filteredResults = useMemo(() => {
    if (!results) return [];
    const q = searchQuery.toLowerCase().trim();
    return results.filter((r) => {
      if (statusFilter !== 'All' && r.status !== statusFilter) return false;
      if (typeFilter !== 'All types' && r.cat !== typeFilter) return false;
      if (q) {
        const hay = [r.vd, r.vt, r.party, r.notes].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [results, statusFilter, typeFilter, searchQuery]);

  const handleExportExcel = () => {
    if (!results) return;
    const headers = [
      'Status',
      'Type',
      'DMS voucher',
      'Tally voucher',
      'DMS date',
      'Tally date',
      'Party',
      'DMS Total amount',
      'Tally Total amount',
      'Difference',
      'Notes',
    ];
    const rowValues = (r: ReconRow) => [
      r.status,
      r.cat,
      r.vd,
      r.vt,
      formatExcelDate(r.dd),
      formatExcelDate(r.dt),
      r.party,
      r.a,
      r.b,
      r.diff,
      r.notes,
    ];

    const wb = XLSX.utils.book_new();
    const pBounds = resolveRecoPeriodBounds(periodFilter);
    const summaryRows: unknown[][] = [
      ['Period Filter', pBounds.isFiltered ? `${pBounds.label} (${pBounds.rangeText})` : 'All dates'],
      ['Include Undated Rows', periodFilter.includeUndated ? 'Yes' : 'No'],
      [],
      ['Status', 'Count', 'Abs difference'],
    ];
    STATUS_ORDER.forEach((s) => {
      const matching = results.filter((r) => r.status === s);
      summaryRows.push([
        s,
        matching.length,
        matching.reduce((x, r) => x + Math.abs(r.diff || 0), 0),
      ]);
    });

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), 'Summary');
    const appendSheet = (name: string, list: ReconRow[]) => {
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([headers, ...list.map(rowValues)]),
        name
      );
    };

    appendSheet('All', results);
    appendSheet(
      'Matched',
      results.filter((r) => r.status === 'Matched')
    );
    appendSheet(
      'Differences',
      results.filter((r) => ['Amount diff', 'Date diff', 'Type diff'].includes(r.status))
    );
    appendSheet(
      'Fuzzy',
      results.filter((r) => r.status === 'Fuzzy match')
    );
    appendSheet(
      'Only in DMS',
      results.filter((r) => r.status === 'Only in DMS')
    );
    appendSheet(
      'Only in Tally',
      results.filter((r) => r.status === 'Only in Tally')
    );

    XLSX.writeFile(
      wb,
      `DMS_vs_Tally_Reconciliation${pBounds.isFiltered ? `_${pBounds.shortLabel}` : ''}.xlsx`
    );
  };

  const renderSidePanel = (side: SideKey) => {
    const state = side === 'dms' ? dmsState : tallyState;
    const counts = sideCounts[side];
    const assessment = side === 'dms' ? dmsAmtAssessment : tallyAmtAssessment;
    const uniqueHeaders = Array.from(
      new Set(state.files.flatMap((f) => f.headers).filter(Boolean))
    );
    const isDragOver = dragOverSide === side;
    const mappedAmt = state.map.amt && state.map.amt !== '__NONE__' ? state.map.amt : '';
    const mappedAmt2 = state.map.amt2 && state.map.amt2 !== '__NONE__' ? state.map.amt2 : '';

    return (
      <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 shadow-[0_4px_0_#2F3E4E] space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display font-extrabold text-base text-[#2F3E4E] flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[#2F3E4E] text-[#F9C80E] text-xs font-mono font-bold inline-flex items-center justify-center shrink-0">
              {side === 'dms' ? '1' : '2'}
            </span>
            <span>{side === 'dms' ? 'DMS Report' : 'Tally Report'}</span>
          </h2>
          <span className="text-[11px] font-medium text-[#64748B]">Multiple files allowed</span>
        </div>

        {/* Dropzone */}
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverSide(side);
          }}
          onDragLeave={() => setDragOverSide(null)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOverSide(null);
            void handleLoadFiles(side, e.dataTransfer.files);
          }}
          className={`flex flex-col items-center justify-center gap-1.5 border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
            isDragOver
              ? 'border-[#12805C] bg-[#CEE5DC]/50 text-[#2F3E4E]'
              : 'border-[#2F3E4E]/35 bg-[#FEF2C8]/45 hover:bg-[#FEF2C8] text-[#475569]'
          }`}
        >
          <Upload className="w-5 h-5 text-[#2F3E4E]" />
          <span className="text-xs sm:text-sm font-bold text-[#2F3E4E]">
            Drop files here or click to browse
          </span>
          <span className="text-[11px] text-[#64748B]">Supports .xlsx, .xls, .csv</span>
          <input
            type="file"
            multiple
            accept=".xlsx,.xls,.csv"
            hidden
            onChange={(e) => {
              void handleLoadFiles(side, e.target.files);
              e.target.value = '';
            }}
          />
        </label>

        {/* Uploaded Files List */}
        {state.files.length > 0 && (
          <div className="divide-y divide-[#2F3E4E]/15 border border-[#2F3E4E]/20 rounded-xl bg-white overflow-hidden">
            {state.files.map((f) => (
              <div
                key={f.id}
                className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs"
              >
                <span className="font-bold text-[#2F3E4E] flex-1 min-w-[130px] break-all">
                  {f.name}
                </span>
                <span className="text-[#64748B] font-mono tabular-nums shrink-0">
                  {f.rows.length} rows
                </span>
                <select
                  aria-label={`Voucher category override for ${f.name}`}
                  value={f.ov}
                  onChange={(e) =>
                    handleOverrideChange(side, f.id, e.target.value as CategoryOverride)
                  }
                  className="px-2 py-1 rounded-md border border-[#2F3E4E]/35 bg-[#FFFDF5] text-xs font-semibold text-[#2F3E4E]"
                >
                  <option value="Auto">Auto</option>
                  {CATS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => handleRemoveFile(side, f.id)}
                  title="Remove file"
                  aria-label={`Remove ${f.name}`}
                  className="p-1 rounded-md border border-[#2F3E4E]/25 bg-[#FEF2C8]/60 hover:bg-red-100 text-[#2F3E4E] hover:text-red-800 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Active Total Amount Column Status & Guard */}
        {state.files.length > 0 && (
          <div
            className={`rounded-xl border px-3 py-2.5 text-xs space-y-1.5 ${
              assessment?.warning || !mappedAmt
                ? 'bg-amber-50 border-amber-700/60 text-amber-950'
                : 'bg-[#CEE5DC]/35 border-[#12805C]/35 text-[#2F3E4E]'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-semibold">
                {assessment?.warning || !mappedAmt ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#12805C] shrink-0" />
                )}
                <span>Total Amount column:</span>
                <span className="font-mono font-bold">
                  {mappedAmt || 'Not detected'}
                  {mappedAmt2 ? ` (+ ${mappedAmt2})` : ''}
                </span>
              </div>
              {assessment?.suggestedTotalHeader && (
                <button
                  type="button"
                  onClick={() => handleMapChange(side, 'amt', assessment.suggestedTotalHeader!)}
                  className="px-2 py-0.5 rounded-md bg-amber-900 hover:bg-amber-950 text-white text-[11px] font-bold cursor-pointer"
                >
                  Switch to {assessment.suggestedTotalHeader}
                </button>
              )}
            </div>
            {assessment?.warning && (
              <p className="text-[11px] text-amber-900 leading-snug">{assessment.warning}</p>
            )}
            {!mappedAmt && (
              <p className="text-[11px] text-amber-900 leading-snug">
                No Total Amount column was detected automatically. Select the Grand Total / Invoice
                Total column below.
              </p>
            )}
          </div>
        )}

        {/* Include Voucher Types */}
        <div className="space-y-2">
          <div className="text-xs font-bold text-[#2F3E4E]">Include voucher types</div>
          <div className="flex flex-wrap gap-x-3.5 gap-y-2">
            {CATS.map((cat) => (
              <label
                key={cat}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#2F3E4E] cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={state.inc.has(cat)}
                  onChange={() => handleToggleCategory(side, cat)}
                  className="accent-[#2F3E4E] rounded cursor-pointer"
                />
                <span>{cat}</span>
                <span className="text-[#64748B] font-mono text-[11px] tabular-nums">
                  ({counts[cat]})
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Column Mapping Collapsible */}
        <details className="border-t border-[#2F3E4E]/15 pt-2.5">
          <summary className="text-xs font-semibold text-[#475569] hover:text-[#2F3E4E] cursor-pointer select-none flex items-center justify-between">
            <span>Column mapping (Total-to-Total auto-detected)</span>
          </summary>
          <div className="space-y-3 mt-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {FIELDS.map(([key, label]) => {
                const rawVal = state.map[key] ?? '';
                const selectVal = rawVal === '__NONE__' ? '' : rawVal;
                return (
                  <label
                    key={key}
                    className="flex flex-col gap-1 text-[11px] font-semibold text-[#475569]"
                  >
                    <span>{label}</span>
                    <select
                      value={selectVal}
                      onChange={(e) => handleMapChange(side, key, e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/35 bg-white text-xs text-[#2F3E4E] font-medium"
                    >
                      <option value="">— none —</option>
                      {uniqueHeaders.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </div>
            {state.files.length > 0 && (
              <button
                type="button"
                onClick={() => handleAutoDetectSide(side)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#2F3E4E]/30 bg-white hover:bg-[#FEF2C8] text-[11px] font-bold text-[#2F3E4E] cursor-pointer"
              >
                <Wand2 className="w-3 h-3" />
                <span>Re-auto-detect Total columns</span>
              </button>
            )}
          </div>
        </details>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Tool Header Card */}
      <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-6 shadow-[0_4px_0_#2F3E4E] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#0F766E]">
            <GitCompareArrows className="w-4 h-4" />
            <span>
              {tool?.categoryName || 'VCPL Tools'} · {tool?.code || 'VC-01'}
            </span>
          </div>
          <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-[#2F3E4E] tracking-tight">
            {tool?.title || 'DMS vs Tally Reconciliation'}
          </h1>
          <p className="text-sm text-[#475569] max-w-2xl leading-relaxed">
            Upload one or many Excel/CSV files on each side, verify both Total Amount (incl. Tax)
            columns, and reconcile Sales, Purchase, Debit Note &amp; Credit Note registers offline.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {(dmsState.files.length > 0 || tallyState.files.length > 0 || results) && (
            <button
              type="button"
              onClick={handleResetAll}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset All</span>
            </button>
          )}
        </div>
      </div>

      {/* Dismissible Inline Validation / Read Error Alert */}
      {errorMsg && (
        <div
          role="alert"
          className="bg-red-50 border-[1.5px] border-red-800 rounded-xl p-4 flex items-center justify-between gap-3 text-xs sm:text-sm text-red-900 font-semibold"
        >
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-700" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg('')}
            aria-label="Dismiss error"
            className="p-1 rounded hover:bg-red-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Upload Sides Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {renderSidePanel('dms')}
        {renderSidePanel('tally')}
      </div>

      {/* Matching Rules Card */}
      <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 sm:p-6 shadow-[0_4px_0_#2F3E4E] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display font-extrabold text-base text-[#2F3E4E]">Matching rules</h2>
          {dmsState.files.length > 0 && tallyState.files.length > 0 && (
            <span className="text-[11px] font-semibold text-[#475569] bg-[#FEF2C8]/75 border border-[#2F3E4E]/20 rounded-lg px-2.5 py-1">
              Comparing Total:{' '}
              <strong className="font-mono text-[#2F3E4E]">
                {dmsState.map.amt && dmsState.map.amt !== '__NONE__' ? dmsState.map.amt : 'Unmapped'}
              </strong>{' '}
              vs{' '}
              <strong className="font-mono text-[#2F3E4E]">
                {tallyState.map.amt && tallyState.map.amt !== '__NONE__'
                  ? tallyState.map.amt
                  : 'Unmapped'}
              </strong>
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-xs sm:text-sm text-[#2F3E4E] font-medium">
          <label className="inline-flex items-center gap-2">
            <span>Amount tolerance ₹</span>
            <input
              type="number"
              value={amtTol}
              min={0}
              step={0.5}
              onChange={(e) => setAmtTol(parseFloat(e.target.value) || 0)}
              className="w-20 px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/40 bg-white font-mono text-xs font-bold text-[#2F3E4E]"
            />
          </label>

          <label className="inline-flex items-center gap-2">
            <span>Date tolerance (days)</span>
            <input
              type="number"
              value={dateTol}
              min={0}
              onChange={(e) => setDateTol(parseInt(e.target.value, 10) || 0)}
              className="w-16 px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/40 bg-white font-mono text-xs font-bold text-[#2F3E4E]"
            />
          </label>

          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={fuzzyEnabled}
              onChange={(e) => setFuzzyEnabled(e.target.checked)}
              className="accent-[#2F3E4E] cursor-pointer"
            />
            <span>Fuzzy match leftovers (amount + date, ignore voucher no.)</span>
          </label>

          <label className="inline-flex items-center gap-2">
            <span>Fuzzy ± days</span>
            <input
              type="number"
              value={fuzzyDays}
              min={0}
              onChange={(e) => setFuzzyDays(parseInt(e.target.value, 10) || 0)}
              className="w-16 px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/40 bg-white font-mono text-xs font-bold text-[#2F3E4E]"
            />
          </label>

          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={fuzzySameType}
              onChange={(e) => setFuzzySameType(e.target.checked)}
              className="accent-[#2F3E4E] cursor-pointer"
            />
            <span>Fuzzy must be same type</span>
          </label>

          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={ignorePrefix}
              onChange={(e) => setIgnorePrefix(e.target.checked)}
              className="accent-[#2F3E4E] cursor-pointer"
            />
            <span>Ignore voucher prefix/leading zeros (match on trailing digits)</span>
          </label>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[#2F3E4E]/15">
          <label className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs sm:text-sm font-medium text-[#2F3E4E] flex-1">
            <span className="shrink-0">Voucher prefix → type rules (optional)</span>
            <input
              type="text"
              value={prefixRulesText}
              onChange={(e) => setPrefixRulesText(e.target.value)}
              placeholder="VMSC=Credit Note, VMPC=Credit Note"
              className="w-full sm:max-w-xs px-3 py-1.5 rounded-lg border border-[#2F3E4E]/40 bg-white text-xs text-[#2F3E4E] placeholder:text-[#94A3B8]"
            />
          </label>

          <button
            type="button"
            onClick={runReconciliation}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#2F3E4E] hover:bg-[#1E293B] text-[#FFFDF5] border-[1.5px] border-[#2F3E4E] shadow-[0_3px_0_#1E293B] text-sm font-bold cursor-pointer transition-all hover:-translate-y-0.5 shrink-0"
          >
            <CheckCircle2 className="w-4 h-4 text-[#F9C80E]" />
            <span>Reconcile Now</span>
          </button>
        </div>
      </div>

      {/* Advanced Period & Date Filter */}
      {(dmsState.files.length > 0 || tallyState.files.length > 0) && (
        <RecoPeriodFilterBar
          value={periodFilter}
          onChange={handlePeriodChange}
          available={availablePeriods}
          matchedCount={periodEntryCounts.matched}
          totalCount={periodEntryCounts.total}
          scopeHint="Filters both DMS & Tally vouchers by date; auto-updates results if reconciled"
        />
      )}

      {/* Results Section */}
      {results && summaryStats && (
        <div className="space-y-6">
          {/* Interactive Status Filter Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
            <button
              type="button"
              onClick={() => setStatusFilter('All')}
              className={`text-left bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] border-l-4 border-l-[#1D4ED8] rounded-xl p-3 transition-all cursor-pointer ${
                statusFilter === 'All'
                  ? 'ring-2 ring-[#2F3E4E] shadow-[0_3px_0_#2F3E4E] -translate-y-0.5'
                  : 'hover:bg-white'
              }`}
            >
              <span className="block text-[11px] font-medium text-[#64748B]">All entries</span>
              <strong className="block font-display font-extrabold text-xl text-[#2F3E4E] tabular-nums mt-0.5">
                {results.length}
              </strong>
            </button>

            {STATUS_ORDER.map((status) => {
              const isSelected = statusFilter === status;
              const style = STATUS_BADGE_STYLES[status];
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  style={{ borderLeftColor: style.border }}
                  className={`text-left bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] border-l-4 rounded-xl p-3 transition-all cursor-pointer ${
                    isSelected
                      ? 'ring-2 ring-[#2F3E4E] shadow-[0_3px_0_#2F3E4E] -translate-y-0.5'
                      : 'hover:bg-white'
                  }`}
                >
                  <span className="block text-[11px] font-medium text-[#64748B] truncate">
                    {status}
                  </span>
                  <strong className="block font-display font-extrabold text-xl text-[#2F3E4E] tabular-nums mt-0.5">
                    {summaryStats.cnt[status]}
                  </strong>
                  {status !== 'Matched' && (
                    <span className="block text-[11px] font-mono text-[#64748B] tabular-nums truncate mt-0.5">
                      ₹ {formatMoney(summaryStats.sum[status])}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Summary by Voucher Type */}
          <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 shadow-[0_4px_0_#2F3E4E] space-y-3">
            <h2 className="font-display font-extrabold text-base text-[#2F3E4E]">
              Summary by voucher type
            </h2>
            <div className="overflow-x-auto border border-[#2F3E4E]/20 rounded-xl bg-white">
              <table className="w-full text-xs border-collapse">
                <thead className="bg-[#FEF2C8]/75 text-[#475569] border-b border-[#2F3E4E]/20">
                  <tr>
                    <th className="py-2.5 px-3 text-left font-bold">Type</th>
                    <th className="py-2.5 px-3 text-right font-bold">DMS count</th>
                    <th className="py-2.5 px-3 text-right font-bold">DMS amount</th>
                    <th className="py-2.5 px-3 text-right font-bold">Tally count</th>
                    <th className="py-2.5 px-3 text-right font-bold">Tally amount</th>
                    <th className="py-2.5 px-3 text-right font-bold">Difference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2F3E4E]/10">
                  {summaryStats.catBreakdown.map((row) => (
                    <tr key={row.cat} className="hover:bg-[#FEF2C8]/30">
                      <td className="py-2 px-3 font-semibold text-[#2F3E4E]">{row.cat}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums">
                        {row.dmsCount}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums">
                        {formatMoney(row.dmsAmt)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums">
                        {row.tallyCount}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums">
                        {formatMoney(row.tallyAmt)}
                      </td>
                      <td
                        className={`py-2 px-3 text-right font-mono font-bold tabular-nums ${
                          Math.abs(row.diff) > 1 ? 'text-red-700' : 'text-emerald-700'
                        }`}
                      >
                        {formatMoney(row.diff)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-[#FEF2C8]/50 font-bold text-[#2F3E4E] border-t-2 border-[#2F3E4E]/25">
                    <td className="py-2.5 px-3">Total</td>
                    <td />
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {formatMoney(summaryStats.totalA)}
                    </td>
                    <td />
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {formatMoney(summaryStats.totalB)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {formatMoney(summaryStats.totalA - summaryStats.totalB)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Search, Filter & Export Toolbar + Detailed Table */}
          <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 shadow-[0_4px_0_#2F3E4E] space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search voucher no., party, notes…"
                aria-label="Search reconciliation results"
                className="flex-1 min-w-[180px] px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white text-xs sm:text-sm text-[#2F3E4E] placeholder:text-[#64748B]"
              />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                aria-label="Filter results by voucher type"
                className="px-3 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white text-xs sm:text-sm font-semibold text-[#2F3E4E]"
              >
                <option value="All types">All types</option>
                {summaryStats.activeCats.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleExportExcel}
                className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-[#12805C] hover:bg-[#0E6A4C] text-white border-[1.5px] border-[#2F3E4E] text-xs sm:text-sm font-bold cursor-pointer shrink-0"
              >
                <Download className="w-4 h-4" />
                <span>Export to Excel</span>
              </button>
            </div>

            <div className="overflow-auto max-h-[65vh] border border-[#2F3E4E]/20 rounded-xl bg-white">
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 z-10 bg-[#FEF2C8] text-[#2F3E4E] border-b border-[#2F3E4E]/20">
                  <tr>
                    <th className="py-2.5 px-3 text-left font-bold whitespace-nowrap">Status</th>
                    <th className="py-2.5 px-3 text-left font-bold whitespace-nowrap">Type</th>
                    <th className="py-2.5 px-3 text-left font-bold whitespace-nowrap">
                      DMS voucher
                    </th>
                    <th className="py-2.5 px-3 text-left font-bold whitespace-nowrap">
                      Tally voucher
                    </th>
                    <th className="py-2.5 px-3 text-left font-bold whitespace-nowrap">DMS date</th>
                    <th className="py-2.5 px-3 text-left font-bold whitespace-nowrap">
                      Tally date
                    </th>
                    <th className="py-2.5 px-3 text-left font-bold whitespace-nowrap">Party</th>
                    <th className="py-2.5 px-3 text-right font-bold whitespace-nowrap">DMS ₹</th>
                    <th className="py-2.5 px-3 text-right font-bold whitespace-nowrap">Tally ₹</th>
                    <th className="py-2.5 px-3 text-right font-bold whitespace-nowrap">Diff</th>
                    <th className="py-2.5 px-3 text-left font-bold whitespace-nowrap">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2F3E4E]/10">
                  {filteredResults.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-[#64748B]">
                        No rows match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredResults.slice(0, 1500).map((r, idx) => (
                      <tr key={`${r.vd}-${r.vt}-${idx}`} className="hover:bg-[#FEF2C8]/30">
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold border ${STATUS_BADGE_STYLES[r.status].badge}`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap font-medium text-[#2F3E4E]">
                          {r.cat}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap font-mono">{r.vd}</td>
                        <td className="py-2 px-3 whitespace-nowrap font-mono">{r.vt}</td>
                        <td className="py-2 px-3 whitespace-nowrap font-mono text-[#475569]">
                          {formatExcelDate(r.dd)}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap font-mono text-[#475569]">
                          {formatExcelDate(r.dt)}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap text-[#2F3E4E]">{r.party}</td>
                        <td className="py-2 px-3 whitespace-nowrap text-right font-mono tabular-nums">
                          {formatMoney(r.a)}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap text-right font-mono tabular-nums">
                          {formatMoney(r.b)}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap text-right font-mono font-semibold tabular-nums">
                          {formatMoney(r.diff)}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap text-[#475569]">{r.notes}</td>
                      </tr>
                    ))
                  )}
                  {filteredResults.length > 1500 && (
                    <tr>
                      <td colSpan={11} className="py-3 px-3 text-center text-xs text-[#64748B]">
                        Showing first 1500 of {filteredResults.length}. Export to Excel for all rows.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!results && (
        <div className="bg-[#FFFDF5] border-[1.5px] border-dashed border-[#2F3E4E]/45 rounded-2xl p-8 text-center space-y-2">
          <FileSpreadsheet className="w-8 h-8 mx-auto text-[#0F766E]" />
          <p className="font-display font-bold text-sm text-[#2F3E4E]">
            Upload both DMS &amp; Tally spreadsheets above to start reconciliation
          </p>
          <p className="text-xs text-[#64748B]">
            Supports multiple files per side, Total-to-Total tax-inclusive column matching, and
            7-sheet Excel export.
          </p>
        </div>
      )}
    </div>
  );
};
