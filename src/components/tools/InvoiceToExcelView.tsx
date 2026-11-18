import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  ChevronDown,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Redo2,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  Undo2,
  Upload,
  X,
} from 'lucide-react';
import { ToolCatalogItem } from '../../types/tools';
import {
  InvoiceLineItem,
  InvoiceRecord,
  InvoiceSettings,
} from '../../types/invoice';
import { formatINR } from '../../utils/numberToWords';
import {
  parsePastedInvoiceText,
  readPdfInvoiceFile,
  round2,
} from '../../utils/invoiceParser';
import {
  aggregateHsnOnly,
  aggregateInvoices,
  aggregateMonthlyTrend,
  aggregateParties,
  autoFixInvoices,
  buildSampleInvoices,
  invoiceComputedTotal,
  invoiceNetTotal,
  invoiceTaxTotal,
  lineTaxTotal,
  validateInvoices,
} from '../../utils/invoiceValidation';
import {
  buildFlatMatrix,
  buildInvoiceWorkbookBuffer,
  serializeDelimited,
} from '../../utils/invoiceExcelBuilder';
import { InvoiceDetailDrawer } from './InvoiceDetailDrawer';

interface InvoiceToExcelViewProps {
  tool?: ToolCatalogItem;
  onBack?: () => void;
}

type WorkspaceTab = 'ov' | 'li' | 'iv' | 'hs' | 'rt' | 'pt' | 'vd';

interface FileQueueChip {
  fid: number;
  name: string;
  status: string;
  state: 'loading' | 'ok' | 'warn' | 'err';
}

interface PasswordPromptState {
  fileName: string;
  isRetry: boolean;
  resolve: (pw: string | null) => void;
}

const SLAB_PALETTE = [
  '#2F3E4E',
  '#F9C80E',
  '#12805C',
  '#3B82F6',
  '#D97706',
  '#DC2626',
  '#7C3AED',
  '#64748B',
];

const formatCompactINR = (val: number): string => {
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2)} L`;
  if (abs >= 1e3) return `${sign}₹${(abs / 1e3).toFixed(1)}k`;
  return `${sign}₹${abs.toFixed(0)}`;
};

const fmtNum = (val: number, decimals = 2): string =>
  (Number(val) || 0).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

const fmtPct = (rateDecimal: number): string =>
  `${+(rateDecimal * 100).toFixed(2)}%`;

const cloneInvoices = (list: InvoiceRecord[]): InvoiceRecord[] =>
  list.map((v) => ({
    ...v,
    items: v.items.map((i) => ({ ...i })),
  }));

export const InvoiceToExcelView: React.FC<InvoiceToExcelViewProps> = ({
  tool,
  onBack,
}) => {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [undoStack, setUndoStack] = useState<InvoiceRecord[][]>([]);
  const [redoStack, setRedoStack] = useState<InvoiceRecord[][]>([]);
  const [fileChips, setFileChips] = useState<FileQueueChip[]>([]);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('ov');
  const [searchQuery, setSearchQuery] = useState('');
  const [valFilter, setValFilter] = useState<'all' | 'err' | 'warn'>('all');
  const [drawerFid, setDrawerFid] = useState<number | null>(null);
  const [showLimit, setShowLimit] = useState(200);
  const [sortState, setSortState] = useState<
    Record<string, { col: string; dir: 1 | -1 }>
  >({});

  const [settings, setSettings] = useState<InvoiceSettings>({
    tol: 1,
    includePagesInExcel: true,
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showPasteBox, setShowPasteBox] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'info' | 'ok' | 'err';
    text: string;
  } | null>(null);
  const [passwordPrompt, setPasswordPrompt] =
    useState<PasswordPromptState | null>(null);
  const [passwordInput, setPasswordInput] = useState('');

  const nextFidRef = useRef(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const pushUndoSnapshot = useCallback((snapshot: InvoiceRecord[]) => {
    setUndoStack((prev) => [...prev.slice(-49), cloneInvoices(snapshot)]);
    setRedoStack([]);
  }, []);

  const handleUndo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setInvoices((curr) => {
        setRedoStack((r) => [...r, cloneInvoices(curr)]);
        return last;
      });
      return prev.slice(0, -1);
    });
  }, []);

  const handleRedo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const next = prev[prev.length - 1];
      setInvoices((curr) => {
        setUndoStack((u) => [...u, cloneInvoices(curr)]);
        return next;
      });
      return prev.slice(0, -1);
    });
  }, []);

  // Validation & Aggregations
  const validation = useMemo(
    () => validateInvoices(invoices, settings.tol),
    [invoices, settings.tol]
  );

  const agg = useMemo(() => aggregateInvoices(invoices), [invoices]);
  const parties = useMemo(() => aggregateParties(invoices), [invoices]);
  const topHsn = useMemo(() => aggregateHsnOnly(invoices).slice(0, 6), [invoices]);
  const monthlyTrend = useMemo(() => aggregateMonthlyTrend(invoices), [invoices]);

  const invoiceStatus = useCallback(
    (fid: number): 'ok' | 'warn' | 'err' => {
      const list = validation.byInvoice.get(fid) || [];
      if (list.some((x) => x.sev === 'err')) return 'err';
      return list.length > 0 ? 'warn' : 'ok';
    },
    [validation]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName || '';
      const isEditing =
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) ||
        (e.target as HTMLElement)?.isContentEditable;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !isEditing) {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if (e.key === 'Escape') {
        setShowExportMenu(false);
        setShowSettings(false);
        setDrawerFid(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleUndo, handleRedo]);

  // Close export dropdown on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(e.target as Node)
      ) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const requestPasswordModal = (
    fileName: string,
    isRetry: boolean
  ): Promise<string | null> => {
    return new Promise((resolve) => {
      setPasswordInput('');
      setPasswordPrompt({ fileName, isRetry, resolve });
    });
  };

  const processFiles = async (files: File[]) => {
    const jsonFiles = files.filter((f) => /\.json$/i.test(f.name));
    const pdfFiles = files.filter(
      (f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name)
    );

    if (jsonFiles.length === 0 && pdfFiles.length === 0) {
      setStatusBanner({
        type: 'err',
        text: 'Please choose PDF invoice files or a saved InvoiceXL (.json) session.',
      });
      return;
    }

    // Restore JSON sessions
    for (const jf of jsonFiles) {
      try {
        const raw = JSON.parse(await jf.text()) as { invs?: InvoiceRecord[] };
        if (!raw || !Array.isArray(raw.invs)) throw new Error('Invalid session');
        pushUndoSnapshot(invoices);
        const restored: InvoiceRecord[] = [];
        const newChips: FileQueueChip[] = [];
        for (const item of raw.invs) {
          if (!item || !Array.isArray(item.items)) continue;
          const id = nextFidRef.current++;
          const rec: InvoiceRecord = {
            ...item,
            fid: id,
            key: `ses|${id}`,
            file: item.file || jf.name,
            pages: item.pages || [],
            roundOff: item.roundOff || 0,
            cess: item.cess || 0,
            parserMode: item.parserMode || 'Session Restored',
          };
          restored.push(rec);
          newChips.push({
            fid: id,
            name: rec.file,
            status: `${rec.items.length} line(s) restored`,
            state: 'ok',
          });
        }
        setInvoices((prev) => [...prev, ...restored]);
        setFileChips((prev) => [...prev, ...newChips]);
        setStatusBanner({
          type: 'ok',
          text: `Restored ${restored.length} invoice(s) from saved session.`,
        });
      } catch {
        setStatusBanner({
          type: 'err',
          text: `Could not restore “${jf.name}” — invalid session JSON.`,
        });
      }
    }

    if (pdfFiles.length === 0) return;

    let addedCount = 0;
    const newlyParsed: InvoiceRecord[] = [];

    for (const file of pdfFiles) {
      const dedupeKey = `${file.name}|${file.size}|${file.lastModified}`;
      if (invoices.some((v) => v.key === dedupeKey)) {
        setStatusBanner({
          type: 'info',
          text: `“${file.name}” is already loaded in this workspace.`,
        });
        continue;
      }

      const fid = nextFidRef.current++;
      setFileChips((prev) => [
        ...prev,
        { fid, name: file.name, status: 'Queued...', state: 'loading' },
      ]);

      try {
        const buffer = await file.arrayBuffer();
        const { invoice, passwordUsed } = await readPdfInvoiceFile(
          buffer,
          file.name,
          (msg) => {
            setFileChips((prev) =>
              prev.map((c) => (c.fid === fid ? { ...c, status: msg } : c))
            );
          },
          requestPasswordModal
        );

        const fullRec: InvoiceRecord = {
          ...invoice,
          fid,
          key: dedupeKey,
          pdfBuffer: buffer,
          pdfPassword: passwordUsed,
        };
        newlyParsed.push(fullRec);
        addedCount++;
        setFileChips((prev) =>
          prev.map((c) =>
            c.fid === fid
              ? {
                  ...c,
                  status: `${fullRec.pages.length} page(s) · ${fullRec.items.length} line(s) · ${fullRec.parserMode}`,
                  state: 'ok',
                }
              : c
          )
        );
      } catch (err: unknown) {
        const e = err as { message?: string };
        setFileChips((prev) =>
          prev.map((c) =>
            c.fid === fid
              ? {
                  ...c,
                  status: e?.message || 'Extraction failed',
                  state: 'err',
                }
              : c
          )
        );
      }
    }

    if (newlyParsed.length > 0) {
      pushUndoSnapshot(invoices);
      setInvoices((prev) => [...prev, ...newlyParsed]);
      setStatusBanner({
        type: 'ok',
        text: `Extracted ${addedCount} PDF invoice(s) into unified format. Review tabs or export Excel workbook.`,
      });
    }
  };

  const handleLoadSamples = () => {
    pushUndoSnapshot(invoices);
    const samples = buildSampleInvoices(nextFidRef.current);
    nextFidRef.current += samples.length + 1;
    setInvoices((prev) => [...prev, ...samples]);
    setFileChips((prev) => [
      ...prev,
      ...samples.map((s) => ({
        fid: s.fid,
        name: s.file,
        status: `1 page · ${s.items.length} line(s) · ${s.parserMode}`,
        state: 'ok' as const,
      })),
    ]);
    setStatusBanner({
      type: 'ok',
      text: 'Loaded 6 multi-format sample invoices (including deliberate audit cases to demonstrate validation checks).',
    });
  };

  const handleParsePasted = () => {
    if (!pasteText.trim()) return;
    const fid = nextFidRef.current++;
    const parsed = parsePastedInvoiceText(
      pasteText,
      `Pasted-Invoice-${invoices.length + 1}.txt`
    );
    if (parsed.items.length === 0) {
      setStatusBanner({
        type: 'err',
        text: 'No invoice amounts could be identified in pasted text.',
      });
      return;
    }
    const rec: InvoiceRecord = {
      ...parsed,
      fid,
      key: `paste|${fid}`,
    };
    pushUndoSnapshot(invoices);
    setInvoices((prev) => [...prev, rec]);
    setFileChips((prev) => [
      ...prev,
      {
        fid,
        name: rec.file,
        status: `${rec.items.length} line(s) extracted from text`,
        state: 'ok',
      },
    ]);
    setPasteText('');
    setShowPasteBox(false);
    setStatusBanner({
      type: 'ok',
      text: `Extracted invoice ${rec.no} from pasted text.`,
    });
  };

  const handleUpdateLineCell = (
    fid: number,
    lineIdx: number,
    field: keyof InvoiceLineItem,
    rawValue: string
  ) => {
    pushUndoSnapshot(invoices);
    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.fid !== fid) return inv;
        const nextItems = inv.items.map((item, idx) => {
          if (idx !== lineIdx) return item;
          const next = { ...item };
          if (field === 'hsn') {
            next.hsn = rawValue.replace(/\D/g, '');
          } else if (field === 'desc' || field === 'uom' || field === 'mat') {
            next[field] = rawValue;
          } else if (field === 'rate') {
            next.rate = round2(parseFloat(rawValue) || 0) / 100;
          } else {
            const numVal = parseFloat(rawValue.replace(/,/g, '')) || 0;
            (next as unknown as Record<string, number>)[field] = numVal;
            if (field === 'net') next.gross = round2(next.net + next.disc);
            if (field === 'qty' || field === 'price') {
              next.gross = round2(next.qty * next.price);
            }
          }
          return next;
        });
        return { ...inv, items: nextItems };
      })
    );
  };

  const handleUpdateInvoiceField = (
    fid: number,
    field: keyof InvoiceRecord,
    value: string | number
  ) => {
    pushUndoSnapshot(invoices);
    setInvoices((prev) =>
      prev.map((inv) => (inv.fid === fid ? { ...inv, [field]: value } : inv))
    );
  };

  const handleAddLine = (fid: number) => {
    pushUndoSnapshot(invoices);
    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.fid !== fid) return inv;
        const newLine: InvoiceLineItem = {
          item: String(inv.items.length + 1),
          mat: '',
          desc: 'New line item',
          hsn: '',
          qty: 1,
          uom: 'Nos.',
          price: 0,
          gross: 0,
          disc: 0,
          net: 0,
          rate: 0.18,
          IGST: 0,
          CGST: 0,
          SGST: 0,
          cessRate: 0,
          cessAmt: 0,
        };
        return { ...inv, items: [...inv.items, newLine] };
      })
    );
  };

  const handleDeleteLine = (fid: number, lineIdx: number) => {
    pushUndoSnapshot(invoices);
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.fid === fid
          ? { ...inv, items: inv.items.filter((_, idx) => idx !== lineIdx) }
          : inv
      )
    );
  };

  const handleDeleteInvoice = (fid: number) => {
    pushUndoSnapshot(invoices);
    setInvoices((prev) => prev.filter((inv) => inv.fid !== fid));
    setFileChips((prev) => prev.filter((c) => c.fid !== fid));
    if (drawerFid === fid) setDrawerFid(null);
    setStatusBanner({
      type: 'info',
      text: 'Invoice removed from workspace. Press Ctrl+Z or click Undo to restore.',
    });
  };

  const handleClearAll = () => {
    pushUndoSnapshot(invoices);
    setInvoices([]);
    setFileChips([]);
    setDrawerFid(null);
    setStatusBanner(null);
  };

  const handleAutoFixInvoices = () => {
    const { updated, fixedCount, summary } = autoFixInvoices(invoices);
    if (fixedCount > 0) {
      pushUndoSnapshot(invoices);
      setInvoices(updated);
      setStatusBanner({ type: 'ok', text: `${summary} (Ctrl+Z to undo)` });
    } else {
      setStatusBanner({ type: 'info', text: summary });
    }
  };

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const handleExportExcel = async () => {
    if (invoices.length === 0) return;
    setIsExporting(true);
    try {
      const { buffer, sheetNames } = await buildInvoiceWorkbookBuffer(
        invoices,
        settings
      );
      const stamp = new Date().toISOString().slice(0, 10);
      triggerDownload(
        new Blob([buffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
        `VCPL-Invoice-Audit-${stamp}.xlsx`
      );
      setStatusBanner({
        type: 'ok',
        text: `Downloaded Excel workbook (${sheetNames.length} formula-linked sheets: ${sheetNames.join(', ')}).`,
      });
    } catch (err: unknown) {
      const e = err as { message?: string };
      setStatusBanner({
        type: 'err',
        text: e?.message || 'Excel export failed.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleSecondaryExport = async (mode: 'csv' | 'tsv' | 'json') => {
    setShowExportMenu(false);
    if (invoices.length === 0) return;
    const stamp = new Date().toISOString().slice(0, 10);

    if (mode === 'csv') {
      const matrix = buildFlatMatrix(invoices);
      const csv = '\uFEFF' + serializeDelimited(matrix, ',');
      triggerDownload(
        new Blob([csv], { type: 'text/csv;charset=utf-8' }),
        `VCPL-Invoice-LineItems-${stamp}.csv`
      );
      setStatusBanner({ type: 'ok', text: 'CSV line-item export downloaded.' });
    } else if (mode === 'tsv') {
      const tsv = serializeDelimited(buildFlatMatrix(invoices), '\t');
      await navigator.clipboard.writeText(tsv);
      setStatusBanner({
        type: 'ok',
        text: 'Copied all line items to clipboard — paste straight into Excel or Google Sheets.',
      });
    } else {
      const cleanInvs = invoices.map(({ pdfBuffer, pdfPassword, ...rest }) => rest);
      const jsonBlob = new Blob(
        [
          JSON.stringify({
            app: 'VCPL-InvoiceXL',
            v: 2,
            savedAt: new Date().toISOString(),
            invs: cleanInvs,
          }),
        ],
        { type: 'application/json' }
      );
      triggerDownload(jsonBlob, `VCPL-InvoiceXL-session-${stamp}.json`);
      setStatusBanner({ type: 'ok', text: 'Workspace session saved as JSON.' });
    }
  };

  const toggleSort = (tabKey: string, col: string) => {
    setSortState((prev) => {
      const cur = prev[tabKey];
      if (cur && cur.col === col) {
        return { ...prev, [tabKey]: { col, dir: cur.dir === 1 ? -1 : 1 } };
      }
      return { ...prev, [tabKey]: { col, dir: 1 } };
    });
  };

  // Derived Totals for KPIs & Overview
  const totals = agg.tot;
  const totalAllTax = round2(
    totals.IGST + totals.CGST + totals.SGST + totals.cessAmt
  );
  const totalRoundOff = round2(
    invoices.reduce((s, v) => s + (v.roundOff || 0), 0)
  );
  const grandTotal = round2(totals.net + totalAllTax + totalRoundOff);
  const issueInvoiceCount = useMemo(
    () => invoices.filter((v) => invoiceStatus(v.fid) !== 'ok').length,
    [invoices, invoiceStatus]
  );
  const healthPct =
    invoices.length > 0
      ? Math.round((100 * (invoices.length - issueInvoiceCount)) / invoices.length)
      : 100;

  // Filtered & Sorted datasets for tabs
  const qLower = searchQuery.trim().toLowerCase();

  const lineRows = useMemo(() => {
    const all = invoices.flatMap((v) =>
      v.items.map((item, idx) => ({ v, item, idx }))
    );
    const filtered = qLower
      ? all.filter(({ v, item }) =>
          [v.no, v.cust, v.sup, item.hsn, item.desc, item.mat]
            .join(' ')
            .toLowerCase()
            .includes(qLower)
        )
      : all;
    const s = sortState.li;
    if (!s) return filtered;
    return [...filtered].sort((a, b) => {
      const getVal = (r: typeof a): string | number => {
        switch (s.col) {
          case 'no':
            return r.v.no;
          case 'hsn':
            return r.item.hsn;
          case 'desc':
            return r.item.desc;
          case 'qty':
            return r.item.qty;
          case 'net':
            return r.item.net;
          case 'rate':
            return r.item.rate;
          case 'tax':
            return lineTaxTotal(r.item);
          case 'tot':
            return r.item.net + lineTaxTotal(r.item);
          default:
            return r.v.no;
        }
      };
      const av = getVal(a);
      const bv = getVal(b);
      if (typeof av === 'number' && typeof bv === 'number') {
        return (av - bv) * s.dir;
      }
      return String(av).localeCompare(String(bv), undefined, { numeric: true }) * s.dir;
    });
  }, [invoices, qLower, sortState.li]);

  const filteredInvoices = useMemo(() => {
    const list = qLower
      ? invoices.filter((v) =>
          [v.no, v.cust, v.sup, v.cgst, v.sgst, v.file]
            .join(' ')
            .toLowerCase()
            .includes(qLower)
        )
      : invoices;
    const s = sortState.iv;
    if (!s) return list;
    return [...list].sort((a, b) => {
      const getVal = (v: InvoiceRecord): string | number => {
        switch (s.col) {
          case 'no':
            return v.no;
          case 'cust':
            return v.cust;
          case 'net':
            return invoiceNetTotal(v);
          case 'tax':
            return invoiceTaxTotal(v);
          case 'amt':
            return v.amt;
          default:
            return v.no;
        }
      };
      const av = getVal(a);
      const bv = getVal(b);
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * s.dir;
      return String(av).localeCompare(String(bv), undefined, { numeric: true }) * s.dir;
    });
  }, [invoices, qLower, sortState.iv]);

  const activeDrawerInvoice = useMemo(
    () => invoices.find((v) => v.fid === drawerFid) || null,
    [invoices, drawerFid]
  );

  // Donut gradient for Overview
  const slabSlices = useMemo(() => {
    let acc = 0;
    const denom = totalAllTax || 1;
    return agg.rate.map((g, idx) => {
      const taxSum = round2(g.IGST + g.CGST + g.SGST + g.cessAmt);
      const start = (acc / denom) * 100;
      acc += taxSum;
      const end = (acc / denom) * 100;
      return {
        label: `GST ${fmtPct(g.rate)}`,
        val: taxSum,
        color: SLAB_PALETTE[idx % SLAB_PALETTE.length],
        start,
        end,
      };
    });
  }, [agg.rate, totalAllTax]);

  const conicGradient =
    slabSlices.length > 0 && totalAllTax > 0
      ? `conic-gradient(${slabSlices
          .map((s) => `${s.color} ${s.start.toFixed(2)}% ${s.end.toFixed(2)}%`)
          .join(', ')})`
      : 'conic-gradient(#E2E8F0 0% 100%)';

  const errorCount = validation.issues.filter((x) => x.sev === 'err').length;
  const warningCount = validation.issues.length - errorCount;

  return (
    <div
      onDragEnter={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setIsDragging(true);
        }
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) e.preventDefault();
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setIsDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        const dropped = Array.from(e.dataTransfer.files || []);
        if (dropped.length > 0) processFiles(dropped);
      }}
      className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 sm:p-7 space-y-6"
    >
      {/* Top Studio Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[#2F3E4E]/15">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium text-[#64748B]">
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#2F3E4E]" />
            <span>{tool?.categoryName || 'Tax & GST Audit'}</span>
            <span aria-hidden="true">·</span>
            <span>{tool?.code || 'TX-03'}</span>
            <span aria-hidden="true">·</span>
            <span>Multi-Format Invoice Engine</span>
          </div>
          <h1 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E]">
            {tool?.title || 'Invoice PDF to Audit Excel Studio'}
          </h1>
          <p className="text-xs sm:text-sm text-[#475569] max-w-3xl">
            Drop any PDF invoice layout — multi-page SAP/ERP parts lists, Tally GST vehicle or
            service bills, or commercial invoices. Columns, HSN codes, discounts, Cess, and tax
            splits normalize into one standardized formula-linked Excel workbook.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
            className="p-2 rounded-xl border-[1.5px] border-[#2F3E4E]/30 bg-white hover:bg-[#FEF2C8] text-[#2F3E4E] disabled:opacity-35 cursor-pointer disabled:cursor-default"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            title="Redo (Ctrl+Shift+Z)"
            aria-label="Redo"
            className="p-2 rounded-xl border-[1.5px] border-[#2F3E4E]/30 bg-white hover:bg-[#FEF2C8] text-[#2F3E4E] disabled:opacity-35 cursor-pointer disabled:cursor-default"
          >
            <Redo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowSettings((s) => !s)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border-[1.5px] border-[#2F3E4E]/30 bg-white hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] cursor-pointer whitespace-nowrap"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>
          <button
            type="button"
            onClick={handleLoadSamples}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] cursor-pointer whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Load Sample Batch</span>
          </button>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] cursor-pointer whitespace-nowrap"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Inline Settings Bar */}
      {showSettings && (
        <div className="p-4 rounded-xl bg-[#FEF2C8]/65 border border-[#2F3E4E] flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-2 text-xs font-semibold text-[#2F3E4E]">
              <span>Reconciliation Tolerance (₹):</span>
              <input
                type="number"
                min={0}
                step={0.5}
                value={settings.tol}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    tol: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
                className="w-20 px-2.5 py-1 rounded-lg border border-[#2F3E4E] bg-white font-mono tabular-nums text-right text-xs"
              />
            </label>

            <label className="flex items-center gap-2 text-xs font-semibold text-[#2F3E4E] cursor-pointer">
              <input
                type="checkbox"
                checked={settings.includePagesInExcel}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    includePagesInExcel: e.target.checked,
                  }))
                }
                className="accent-[#2F3E4E] w-4 h-4"
              />
              <span>Include dedicated Raw PDF Pages sheet in Excel workbook</span>
            </label>
          </div>

          <button
            type="button"
            onClick={() => setShowSettings(false)}
            className="text-xs font-bold text-[#2F3E4E] underline cursor-pointer"
          >
            Done
          </button>
        </div>
      )}

      {/* Dropzone & Controls */}
      <div className="space-y-3">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,application/pdf,.json,application/json"
          onChange={(e) => {
            const list = Array.from(e.target.files || []);
            if (list.length > 0) processFiles(list);
            e.target.value = '';
          }}
          className="hidden"
        />

        <div
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
          }}
          className={`border-2 border-dashed rounded-2xl p-6 transition-colors cursor-pointer flex flex-col sm:flex-row items-center justify-between gap-4 ${
            isDragging
              ? 'border-[#2F3E4E] bg-[#F9C80E]/30'
              : 'border-[#2F3E4E]/45 bg-[#FEF2C8]/45 hover:bg-[#FEF2C8]/75'
          }`}
        >
          <div className="flex items-center gap-4 text-left">
            <div className="w-12 h-12 rounded-xl bg-white border-[1.5px] border-[#2F3E4E] text-[#2F3E4E] flex items-center justify-center shrink-0">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#2F3E4E]">
                Drop any PDF invoices here, or click to browse multiple files
              </p>
              <p className="text-xs text-[#475569] mt-0.5">
                Supports multi-page SAP/BMW, Tally GST, Service, Parts, &amp; Password-Protected
                PDFs, plus saved .JSON sessions
              </p>
            </div>
          </div>

          <div
            className="flex flex-wrap items-center gap-2 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 rounded-lg bg-[#2F3E4E] hover:bg-[#1E293B] text-[#FFFDF5] text-xs font-bold cursor-pointer whitespace-nowrap"
            >
              Add PDF / Session
            </button>
            <button
              type="button"
              onClick={() => setShowPasteBox((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] cursor-pointer whitespace-nowrap"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{showPasteBox ? 'Hide Text Box' : 'Paste Text'}</span>
            </button>
          </div>
        </div>

        {/* Optional Text Paste Area */}
        {showPasteBox && (
          <div className="p-4 rounded-xl bg-white border-[1.5px] border-[#2F3E4E] space-y-2.5">
            <label
              htmlFor="invoice-raw-paste"
              className="block text-xs font-bold text-[#2F3E4E]"
            >
              Paste Raw Invoice Text
            </label>
            <textarea
              id="invoice-raw-paste"
              rows={4}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste invoice text containing Invoice No, Date, GSTIN, line amounts, CGST/SGST/IGST..."
              className="w-full p-2.5 rounded-lg border border-[#2F3E4E]/30 text-xs text-[#2F3E4E] focus:outline-none focus:border-[#2F3E4E]"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleParsePasted}
                className="px-4 py-1.5 rounded-lg bg-[#2F3E4E] text-[#FFFDF5] text-xs font-bold cursor-pointer"
              >
                Extract Text Invoice
              </button>
            </div>
          </div>
        )}

        {/* File Queue Chips Accordion */}
        {fileChips.length > 0 && (
          <details
            open={fileChips.some((c) => c.state === 'err' || c.state === 'loading')}
            className="border border-[#2F3E4E]/25 rounded-xl bg-white px-4 py-2.5"
          >
            <summary className="text-xs font-bold text-[#2F3E4E] cursor-pointer select-none flex items-center justify-between">
              <span>
                Uploaded Files Queue ({fileChips.length} loaded
                {fileChips.some((c) => c.state === 'err')
                  ? ` · ${fileChips.filter((c) => c.state === 'err').length} failed`
                  : ''}
                )
              </span>
            </summary>
            <div className="mt-2.5 grid gap-1.5 max-h-48 overflow-y-auto">
              {fileChips.map((chip) => {
                const invSt = invoices.some((v) => v.fid === chip.fid)
                  ? invoiceStatus(chip.fid)
                  : chip.state;
                return (
                  <div
                    key={chip.fid}
                    className="flex items-center justify-between gap-3 px-3 py-1.5 rounded-lg border border-[#2F3E4E]/15 bg-[#FEF2C8]/25 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {chip.state === 'err' || invSt === 'err' ? (
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      ) : invSt === 'warn' ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      )}
                      <span className="font-semibold text-[#2F3E4E] truncate max-w-[220px]">
                        {chip.name}
                      </span>
                      <span className="text-[#475569] truncate">{chip.status}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteInvoice(chip.fid)}
                      aria-label={`Remove ${chip.name}`}
                      className="p-1 text-[#64748B] hover:text-rose-700 cursor-pointer shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </details>
        )}
      </div>

      {/* Status Banner */}
      {statusBanner && (
        <div
          className={`px-4 py-3 rounded-xl border text-xs font-medium flex items-center justify-between gap-3 ${
            statusBanner.type === 'err'
              ? 'bg-rose-50 border-rose-300 text-rose-800'
              : statusBanner.type === 'ok'
                ? 'bg-[#CEE5DC]/65 border-[#2F3E4E] text-[#2F3E4E]'
                : 'bg-[#FEF2C8]/65 border-[#2F3E4E]/40 text-[#2F3E4E]'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusBanner.type === 'err' ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700" />
            )}
            <span>{statusBanner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            aria-label="Dismiss status message"
            className="text-current opacity-70 hover:opacity-100 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Data Dashboard or Empty State */}
      {invoices.length === 0 ? (
        <div className="py-12 px-6 rounded-2xl border border-[#2F3E4E]/20 bg-white text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-[#FEF2C8] border border-[#2F3E4E]/30 flex items-center justify-center mx-auto text-[#2F3E4E]">
            <FolderOpen className="w-6 h-6" />
          </div>
          <h2 className="font-display font-bold text-base text-[#2F3E4E]">
            Ready for multi-format PDF invoice batch processing
          </h2>
          <p className="text-xs text-[#64748B] max-w-md mx-auto leading-relaxed">
            Upload invoices from different dealers, ERPs, or formats together. Every invoice is
            validated for GSTIN checksums, HSN/SAC codes, intra/inter-state tax rules, and
            exported in a single unified Excel workbook.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* 6 KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3.5 rounded-xl bg-white border border-[#2F3E4E]/25">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B] block">
                Invoices
              </span>
              <span className="font-mono tabular-nums text-xl font-extrabold text-[#2F3E4E] block mt-0.5">
                {invoices.length}
              </span>
              <span className="text-[11px] text-[#64748B] tabular-nums">
                {totals.n} line items
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-[#2F3E4E]/25">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B] block">
                Total Quantity
              </span>
              <span className="font-mono tabular-nums text-xl font-extrabold text-[#2F3E4E] block mt-0.5">
                {totals.qty.toLocaleString('en-IN')}
              </span>
              <span className="text-[11px] text-[#64748B]">across all PDFs</span>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-[#2F3E4E]/25">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B] block">
                Taxable Value
              </span>
              <span className="font-mono tabular-nums text-xl font-extrabold text-[#2F3E4E] block mt-0.5">
                {formatCompactINR(totals.net)}
              </span>
              <span className="text-[11px] text-[#64748B] font-mono tabular-nums truncate block">
                {formatINR(totals.net)}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-[#2F3E4E]/25">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B] block">
                Total Tax
              </span>
              <span className="font-mono tabular-nums text-xl font-extrabold text-[#2F3E4E] block mt-0.5">
                {formatCompactINR(totalAllTax)}
              </span>
              <span className="text-[11px] text-[#64748B] truncate block">
                IGST {formatCompactINR(totals.IGST)} · C/S{' '}
                {formatCompactINR(totals.CGST + totals.SGST)}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F9C80E]/45 border border-[#2F3E4E]">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#2F3E4E] block">
                Grand Total
              </span>
              <span className="font-mono tabular-nums text-xl font-extrabold text-[#2F3E4E] block mt-0.5">
                {formatCompactINR(grandTotal)}
              </span>
              <span className="text-[11px] text-[#2F3E4E] font-mono tabular-nums truncate block">
                avg {formatCompactINR(grandTotal / invoices.length)} / inv
              </span>
            </div>

            <div
              className={`p-3.5 rounded-xl border ${
                healthPct >= 90
                  ? 'bg-[#CEE5DC]/65 border-emerald-700/35 text-emerald-900'
                  : healthPct >= 60
                    ? 'bg-amber-50 border-amber-400 text-amber-900'
                    : 'bg-rose-50 border-rose-400 text-rose-900'
              }`}
            >
              <span className="text-[11px] font-semibold uppercase tracking-wide block opacity-80">
                Data Health
              </span>
              <span className="font-mono tabular-nums text-xl font-extrabold block mt-0.5">
                {healthPct}%
              </span>
              <span className="text-[11px] font-medium block">
                {issueInvoiceCount === 0
                  ? 'All checks passed'
                  : `${issueInvoiceCount} invoice(s) need review`}
              </span>
            </div>
          </div>

          {/* Navigation Tabs + Search */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#2F3E4E]/20 pb-2">
            <nav className="flex flex-wrap items-center gap-1" aria-label="Invoice audit views">
              {(
                [
                  ['ov', 'Overview', ''],
                  ['li', 'Line Items', `${totals.n}`],
                  ['iv', 'Invoices', `${invoices.length}`],
                  ['hs', 'HSN', `${agg.hsn.length}`],
                  ['rt', 'Tax Slabs', `${agg.rate.length}`],
                  ['pt', 'Parties', `${parties.length}`],
                  [
                    'vd',
                    'Validation',
                    validation.issues.length > 0 ? `${validation.issues.length}` : 'OK',
                  ],
                ] as const
              ).map(([key, label, badge]) => {
                const isOn = activeTab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setActiveTab(key);
                      setShowLimit(200);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap ${
                      isOn
                        ? 'bg-[#2F3E4E] text-[#FFFDF5]'
                        : 'text-[#475569] hover:bg-[#FEF2C8] hover:text-[#2F3E4E]'
                    }`}
                  >
                    <span>{label}</span>
                    {badge && (
                      <span
                        className={`text-[10px] font-mono tabular-nums px-1.5 py-0.2 rounded ${
                          isOn
                            ? 'bg-white/20 text-white'
                            : key === 'vd' && errorCount > 0
                              ? 'bg-rose-100 text-rose-800'
                              : key === 'vd' && warningCount > 0
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-[#FEF2C8] text-[#2F3E4E]'
                        }`}
                      >
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {activeTab !== 'ov' && activeTab !== 'vd' && (
              <div className="flex items-center gap-2 bg-white border border-[#2F3E4E]/35 rounded-lg px-2.5 py-1.5 min-w-[230px]">
                <Search className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowLimit(200);
                  }}
                  placeholder="Filter invoices, HSN, customer..."
                  className="w-full text-xs text-[#2F3E4E] bg-transparent focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* TAB 1: OVERVIEW DASHBOARD */}
          {activeTab === 'ov' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Tax by GST Slab Donut */}
              <div className="p-4 rounded-xl bg-white border border-[#2F3E4E]/25 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  Tax by GST Slab
                </h3>
                <div className="flex flex-wrap items-center gap-6">
                  <div
                    className="w-36 h-36 rounded-full grid place-items-center shrink-0 border border-[#2F3E4E]/15"
                    style={{ background: conicGradient }}
                  >
                    <div className="w-24 h-24 rounded-full bg-white flex flex-col items-center justify-center text-center border border-[#2F3E4E]/15">
                      <span className="font-mono font-extrabold text-sm text-[#2F3E4E] tabular-nums">
                        {formatCompactINR(totalAllTax)}
                      </span>
                      <span className="text-[10px] text-[#64748B]">total tax</span>
                    </div>
                  </div>
                  <ul className="flex-1 min-w-[180px] space-y-1.5 text-xs">
                    {slabSlices.map((s) => (
                      <li key={s.label} className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-[#2F3E4E]">
                          <span
                            className="w-2.5 h-2.5 rounded-xs shrink-0"
                            style={{ background: s.color }}
                          />
                          <span>{s.label}</span>
                        </span>
                        <span className="font-mono tabular-nums font-bold text-[#2F3E4E]">
                          {formatCompactINR(s.val)}{' '}
                          <span className="text-[#64748B] font-normal">
                            ({totalAllTax ? Math.round((s.val / totalAllTax) * 100) : 0}%)
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Tax Composition */}
              <div className="p-4 rounded-xl bg-white border border-[#2F3E4E]/25 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  Tax Composition (IGST / CGST / SGST / Cess)
                </h3>
                <div className="h-3.5 rounded-lg overflow-hidden bg-slate-100 flex">
                  {[
                    { label: 'IGST', val: totals.IGST, color: '#2F3E4E' },
                    { label: 'CGST', val: totals.CGST, color: '#12805C' },
                    { label: 'SGST', val: totals.SGST, color: '#F9C80E' },
                    { label: 'Cess', val: totals.cessAmt, color: '#D97706' },
                  ].map((c) => (
                    <div
                      key={c.label}
                      style={{
                        width: `${totalAllTax > 0 ? (c.val / totalAllTax) * 100 : 0}%`,
                        background: c.color,
                      }}
                    />
                  ))}
                </div>
                <ul className="space-y-2 text-xs pt-1">
                  {[
                    { label: 'IGST', val: totals.IGST, color: '#2F3E4E' },
                    { label: 'CGST', val: totals.CGST, color: '#12805C' },
                    { label: 'SGST', val: totals.SGST, color: '#F9C80E' },
                    { label: 'Cess', val: totals.cessAmt, color: '#D97706' },
                  ].map((c) => (
                    <li key={c.label} className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-[#2F3E4E]">
                        <span
                          className="w-2.5 h-2.5 rounded-xs shrink-0"
                          style={{ background: c.color }}
                        />
                        <span>{c.label}</span>
                      </span>
                      <span className="font-mono tabular-nums font-bold text-[#2F3E4E]">
                        {formatINR(c.val)}{' '}
                        <span className="text-[#64748B] font-normal">
                          ({totalAllTax > 0 ? Math.round((c.val / totalAllTax) * 100) : 0}%)
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Monthly Trend */}
              <div className="p-4 rounded-xl bg-white border border-[#2F3E4E]/25 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  Monthly Trend (by Invoice Date)
                </h3>
                {(() => {
                  const maxVal = Math.max(
                    1,
                    ...monthlyTrend.map((m) => m.net + m.tax)
                  );
                  return (
                    <div className="flex items-end gap-3 h-40 pt-4 overflow-x-auto">
                      {monthlyTrend.map((m) => (
                        <div
                          key={m.label}
                          title={`${m.label} · Taxable ${formatINR(m.net)} · Tax ${formatINR(m.tax)}`}
                          className="flex-1 min-w-[54px] flex flex-col items-center gap-1 h-full justify-end"
                        >
                          <span className="text-[10px] font-mono tabular-nums font-bold text-[#2F3E4E]">
                            {formatCompactINR(m.net + m.tax)}
                          </span>
                          <div className="w-full max-w-[44px] h-24 rounded-t-md bg-slate-100 overflow-hidden flex flex-col-reverse">
                            <div
                              style={{ height: `${(m.net / maxVal) * 100}%` }}
                              className="bg-[#2F3E4E]"
                            />
                            <div
                              style={{ height: `${(m.tax / maxVal) * 100}%` }}
                              className="bg-[#F9C80E]"
                            />
                          </div>
                          <span className="text-[10px] text-[#64748B] whitespace-nowrap">
                            {m.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
                <div className="flex items-center gap-4 text-[11px] text-[#64748B]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#2F3E4E]" />
                    Taxable Value
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#F9C80E]" />
                    Total Tax
                  </span>
                </div>
              </div>

              {/* Data Health & Top Audit Issues */}
              <div className="p-4 rounded-xl bg-white border border-[#2F3E4E]/25 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                    Validation Summary
                  </h3>
                  <div className="flex items-center gap-2.5">
                    {validation.issues.length > 0 && (
                      <button
                        type="button"
                        onClick={handleAutoFixInvoices}
                        className="px-2 py-0.5 rounded bg-[#2F3E4E] hover:bg-[#1E293B] text-[#FFFDF5] text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3" />
                        Auto-Fix
                      </button>
                    )}
                    {validation.issues.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('vd')}
                        className="text-xs font-bold text-[#2F3E4E] underline cursor-pointer"
                      >
                        Review all ({validation.issues.length})
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-900">
                    <div className="font-mono text-lg font-extrabold tabular-nums">
                      {invoices.filter((v) => invoiceStatus(v.fid) === 'ok').length}
                    </div>
                    <div className="text-[11px] font-medium">Clean</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-amber-50 text-amber-900">
                    <div className="font-mono text-lg font-extrabold tabular-nums">
                      {invoices.filter((v) => invoiceStatus(v.fid) === 'warn').length}
                    </div>
                    <div className="text-[11px] font-medium">Warnings</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-rose-50 text-rose-900">
                    <div className="font-mono text-lg font-extrabold tabular-nums">
                      {invoices.filter((v) => invoiceStatus(v.fid) === 'err').length}
                    </div>
                    <div className="text-[11px] font-medium">Errors</div>
                  </div>
                </div>

                {validation.issues.length === 0 ? (
                  <p className="text-xs text-emerald-800 font-medium pt-1">
                    Every uploaded invoice passed all GSTIN, rate slab, and total checks.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-200 max-h-40 overflow-y-auto">
                    {validation.issues.slice(0, 4).map((iss, idx) => (
                      <div key={idx} className="py-2 flex items-start gap-2 text-xs">
                        {iss.sev === 'err' ? (
                          <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        )}
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => setDrawerFid(iss.invoiceFid)}
                            className="font-bold text-[#2F3E4E] underline cursor-pointer mr-1.5"
                          >
                            {iss.invoiceNo}
                          </button>
                          <span className="font-semibold text-[#475569]">{iss.chk}</span>
                          <p className="text-[11px] text-[#64748B] truncate">{iss.msg}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Top HSN */}
              <div className="p-4 rounded-xl bg-white border border-[#2F3E4E]/25 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  Top HSN / SAC by Taxable Value
                </h3>
                {(() => {
                  const mx = Math.max(1, ...topHsn.map((x) => x.net));
                  return (
                    <div className="space-y-2">
                      {topHsn.map((h) => (
                        <div
                          key={h.hsn}
                          className="grid grid-cols-[minmax(90px,42%)_1fr_auto] items-center gap-2.5 text-xs"
                        >
                          <span className="truncate text-[#2F3E4E]" title={`${h.hsn} · ${h.desc}`}>
                            <span className="font-mono font-bold">{h.hsn}</span> · {h.desc}
                          </span>
                          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              style={{ width: `${(h.net / mx) * 100}%` }}
                              className="h-full bg-[#2F3E4E] rounded-full"
                            />
                          </div>
                          <span className="font-mono tabular-nums font-bold text-[#2F3E4E]">
                            {formatCompactINR(h.net)}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Top Customers */}
              <div className="p-4 rounded-xl bg-white border border-[#2F3E4E]/25 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  Top Customers by Taxable Value
                </h3>
                {(() => {
                  const topP = parties.slice(0, 6);
                  const mx = Math.max(1, ...topP.map((x) => x.net));
                  return (
                    <div className="space-y-2">
                      {topP.map((p) => (
                        <div
                          key={p.name}
                          className="grid grid-cols-[minmax(90px,42%)_1fr_auto] items-center gap-2.5 text-xs"
                        >
                          <span className="truncate font-medium text-[#2F3E4E]" title={p.name}>
                            {p.name}
                          </span>
                          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              style={{ width: `${(p.net / mx) * 100}%` }}
                              className="h-full bg-[#12805C] rounded-full"
                            />
                          </div>
                          <span className="font-mono tabular-nums font-bold text-[#2F3E4E]">
                            {formatCompactINR(p.net)}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* TAB 2: LINE ITEMS (INLINE EDITABLE) */}
          {activeTab === 'li' && (
            <div className="space-y-3">
              <div className="overflow-x-auto border-[1.5px] border-[#2F3E4E] rounded-xl bg-white max-h-[60vh]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#2F3E4E] text-[#FFFDF5] sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-2.5 font-semibold whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => toggleSort('li', 'no')}
                          className="inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>Invoice</span>
                          <ArrowUpDown className="w-3 h-3 opacity-70" />
                        </button>
                      </th>
                      <th className="py-2.5 px-2 font-semibold whitespace-nowrap">Date</th>
                      <th className="py-2.5 px-2 font-semibold whitespace-nowrap">Customer</th>
                      <th className="py-2.5 px-2 font-semibold whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => toggleSort('li', 'hsn')}
                          className="inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>HSN</span>
                          <ArrowUpDown className="w-3 h-3 opacity-70" />
                        </button>
                      </th>
                      <th className="py-2.5 px-2 font-semibold whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => toggleSort('li', 'desc')}
                          className="inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>Description</span>
                          <ArrowUpDown className="w-3 h-3 opacity-70" />
                        </button>
                      </th>
                      <th className="py-2.5 px-2 font-semibold text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => toggleSort('li', 'qty')}
                          className="inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>Qty</span>
                        </button>
                      </th>
                      <th className="py-2.5 px-2 font-semibold text-right whitespace-nowrap">
                        Unit Price
                      </th>
                      <th className="py-2.5 px-2 font-semibold text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => toggleSort('li', 'net')}
                          className="inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>Taxable</span>
                        </button>
                      </th>
                      <th className="py-2.5 px-2 font-semibold text-right whitespace-nowrap">
                        Rate %
                      </th>
                      <th className="py-2.5 px-2 font-semibold text-right whitespace-nowrap">
                        IGST
                      </th>
                      <th className="py-2.5 px-2 font-semibold text-right whitespace-nowrap">
                        CGST
                      </th>
                      <th className="py-2.5 px-2 font-semibold text-right whitespace-nowrap">
                        SGST
                      </th>
                      <th className="py-2.5 px-2 font-semibold text-right whitespace-nowrap">
                        Cess
                      </th>
                      <th className="py-2.5 px-2 font-semibold text-right whitespace-nowrap">
                        Line Total
                      </th>
                      <th className="py-2.5 px-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {lineRows.slice(0, showLimit).map(({ v, item, idx }) => (
                      <tr key={`${v.fid}-${idx}`} className="hover:bg-[#FEF2C8]/30">
                        <td className="py-1.5 px-2.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setDrawerFid(v.fid)}
                            className="font-mono font-bold text-[#2F3E4E] underline cursor-pointer"
                          >
                            {v.no}
                          </button>
                        </td>
                        <td className="py-1.5 px-2 whitespace-nowrap text-[#475569]">
                          {v.date}
                        </td>
                        <td
                          className="py-1.5 px-2 max-w-[140px] truncate text-[#2F3E4E]"
                          title={v.cust}
                        >
                          {v.cust}
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            defaultValue={item.hsn}
                            onBlur={(e) => {
                              if (e.target.value !== item.hsn) {
                                handleUpdateLineCell(v.fid, idx, 'hsn', e.target.value);
                              }
                            }}
                            className="w-20 px-1.5 py-1 border border-slate-300 rounded font-mono text-xs"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            defaultValue={item.desc}
                            onBlur={(e) => {
                              if (e.target.value !== item.desc) {
                                handleUpdateLineCell(v.fid, idx, 'desc', e.target.value);
                              }
                            }}
                            className="w-44 px-1.5 py-1 border border-slate-300 rounded text-xs"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="number"
                            defaultValue={item.qty}
                            onBlur={(e) => {
                              if (Number(e.target.value) !== item.qty) {
                                handleUpdateLineCell(v.fid, idx, 'qty', e.target.value);
                              }
                            }}
                            className="w-14 px-1.5 py-1 border border-slate-300 rounded font-mono tabular-nums text-right text-xs"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="number"
                            step="0.01"
                            defaultValue={item.price}
                            onBlur={(e) => {
                              if (Number(e.target.value) !== item.price) {
                                handleUpdateLineCell(v.fid, idx, 'price', e.target.value);
                              }
                            }}
                            className="w-24 px-1.5 py-1 border border-slate-300 rounded font-mono tabular-nums text-right text-xs"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="number"
                            step="0.01"
                            defaultValue={item.net}
                            onBlur={(e) => {
                              if (Number(e.target.value) !== item.net) {
                                handleUpdateLineCell(v.fid, idx, 'net', e.target.value);
                              }
                            }}
                            className="w-24 px-1.5 py-1 border border-slate-300 rounded font-mono tabular-nums text-right text-xs font-semibold"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="number"
                            step="0.5"
                            defaultValue={+(item.rate * 100).toFixed(2)}
                            onBlur={(e) => {
                              const curPct = +(item.rate * 100).toFixed(2);
                              if (Number(e.target.value) !== curPct) {
                                handleUpdateLineCell(v.fid, idx, 'rate', e.target.value);
                              }
                            }}
                            className="w-14 px-1.5 py-1 border border-slate-300 rounded font-mono tabular-nums text-right text-xs"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="number"
                            step="0.01"
                            defaultValue={item.IGST}
                            onBlur={(e) => {
                              if (Number(e.target.value) !== item.IGST) {
                                handleUpdateLineCell(v.fid, idx, 'IGST', e.target.value);
                              }
                            }}
                            className="w-20 px-1.5 py-1 border border-slate-300 rounded font-mono tabular-nums text-right text-xs"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="number"
                            step="0.01"
                            defaultValue={item.CGST}
                            onBlur={(e) => {
                              if (Number(e.target.value) !== item.CGST) {
                                handleUpdateLineCell(v.fid, idx, 'CGST', e.target.value);
                              }
                            }}
                            className="w-20 px-1.5 py-1 border border-slate-300 rounded font-mono tabular-nums text-right text-xs"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="number"
                            step="0.01"
                            defaultValue={item.SGST}
                            onBlur={(e) => {
                              if (Number(e.target.value) !== item.SGST) {
                                handleUpdateLineCell(v.fid, idx, 'SGST', e.target.value);
                              }
                            }}
                            className="w-20 px-1.5 py-1 border border-slate-300 rounded font-mono tabular-nums text-right text-xs"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="number"
                            step="0.01"
                            defaultValue={item.cessAmt}
                            onBlur={(e) => {
                              if (Number(e.target.value) !== item.cessAmt) {
                                handleUpdateLineCell(v.fid, idx, 'cessAmt', e.target.value);
                              }
                            }}
                            className="w-20 px-1.5 py-1 border border-slate-300 rounded font-mono tabular-nums text-right text-xs"
                          />
                        </td>
                        <td className="py-1.5 px-2 font-mono tabular-nums font-bold text-right text-[#2F3E4E] whitespace-nowrap">
                          {fmtNum(item.net + lineTaxTotal(item))}
                        </td>
                        <td className="p-1 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteLine(v.fid, idx)}
                            aria-label="Delete line item"
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

              {lineRows.length > showLimit && (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setShowLimit((s) => s + 200)}
                    className="px-4 py-1.5 rounded-lg bg-[#FEF2C8] border border-[#2F3E4E] text-xs font-bold text-[#2F3E4E] cursor-pointer"
                  >
                    Show {Math.min(200, lineRows.length - showLimit)} more (
                    {lineRows.length - showLimit} remaining)
                  </button>
                </div>
              )}
              <p className="text-[11px] text-[#64748B]">
                Edit any cell inline — blur or Tab saves automatically (Ctrl+Z to undo). Click any
                Invoice No to open full metadata &amp; original PDF preview.
              </p>
            </div>
          )}

          {/* TAB 3: INVOICES */}
          {activeTab === 'iv' && (
            <div className="overflow-x-auto border-[1.5px] border-[#2F3E4E] rounded-xl bg-white max-h-[60vh]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#2F3E4E] text-[#FFFDF5] sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Status</th>
                    <th className="py-2.5 px-3 font-semibold">Invoice</th>
                    <th className="py-2.5 px-3 font-semibold">Date</th>
                    <th className="py-2.5 px-3 font-semibold">Customer</th>
                    <th className="py-2.5 px-3 font-semibold">Customer GSTIN</th>
                    <th className="py-2.5 px-3 font-semibold">Format</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Lines</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Taxable</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Tax</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Computed</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Printed</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Diff</th>
                    <th className="py-2.5 px-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredInvoices.map((v) => {
                    const st = invoiceStatus(v.fid);
                    const cmp = invoiceComputedTotal(v);
                    const diff = round2(cmp - v.amt);
                    const issCount = (validation.byInvoice.get(v.fid) || []).length;
                    return (
                      <tr
                        key={v.fid}
                        onClick={() => setDrawerFid(v.fid)}
                        className="hover:bg-[#FEF2C8]/40 cursor-pointer"
                      >
                        <td className="py-2 px-3 whitespace-nowrap">
                          {st === 'err' ? (
                            <span className="inline-flex items-center gap-1 text-rose-700 font-bold">
                              <AlertCircle className="w-3.5 h-3.5" />
                              {issCount} Err
                            </span>
                          ) : st === 'warn' ? (
                            <span className="inline-flex items-center gap-1 text-amber-700 font-bold">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              {issCount} Warn
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              OK
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-[#2F3E4E] underline whitespace-nowrap">
                          {v.no}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">{v.date || '—'}</td>
                        <td className="py-2 px-3 max-w-[180px] truncate" title={v.cust}>
                          {v.cust || '—'}
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px]">{v.cgst || '—'}</td>
                        <td className="py-2 px-3 text-[#475569] whitespace-nowrap">
                          {v.parserMode}
                        </td>
                        <td className="py-2 px-3 font-mono tabular-nums text-right">
                          {v.items.length}
                        </td>
                        <td className="py-2 px-3 font-mono tabular-nums text-right">
                          {fmtNum(invoiceNetTotal(v))}
                        </td>
                        <td className="py-2 px-3 font-mono tabular-nums text-right">
                          {fmtNum(invoiceTaxTotal(v))}
                        </td>
                        <td className="py-2 px-3 font-mono tabular-nums text-right font-semibold">
                          {fmtNum(cmp)}
                        </td>
                        <td className="py-2 px-3 font-mono tabular-nums text-right">
                          {fmtNum(v.amt)}
                        </td>
                        <td
                          className={`py-2 px-3 font-mono tabular-nums text-right font-bold ${
                            Math.abs(diff) > settings.tol ? 'text-rose-700' : 'text-emerald-700'
                          }`}
                        >
                          {fmtNum(diff)}
                        </td>
                        <td
                          className="py-2 px-2 text-right"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteInvoice(v.fid);
                          }}
                        >
                          <button
                            type="button"
                            aria-label={`Delete invoice ${v.no}`}
                            className="p-1 text-rose-600 hover:text-rose-800 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 4: HSN SUMMARY */}
          {activeTab === 'hs' && (
            <div className="overflow-x-auto border-[1.5px] border-[#2F3E4E] rounded-xl bg-white max-h-[60vh]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#2F3E4E] text-[#FFFDF5] sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">HSN/SAC</th>
                    <th className="py-2.5 px-3 font-semibold">Description</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Rate</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Lines</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Qty</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Taxable</th>
                    <th className="py-2.5 px-3 font-semibold text-right">IGST</th>
                    <th className="py-2.5 px-3 font-semibold text-right">CGST</th>
                    <th className="py-2.5 px-3 font-semibold text-right">SGST</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Cess</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {agg.hsn
                    .filter(
                      (g) =>
                        !qLower ||
                        `${g.hsn} ${g.desc}`.toLowerCase().includes(qLower)
                    )
                    .map((g) => {
                      const t = g.IGST + g.CGST + g.SGST + g.cessAmt;
                      return (
                        <tr key={`${g.hsn}-${g.rate}`} className="hover:bg-[#FEF2C8]/30">
                          <td className="py-2 px-3 font-mono font-bold text-[#2F3E4E]">
                            {g.hsn}
                          </td>
                          <td className="py-2 px-3 max-w-[240px] truncate" title={g.desc}>
                            {g.desc}
                          </td>
                          <td className="py-2 px-3 font-mono tabular-nums text-right">
                            {fmtPct(g.rate)}
                          </td>
                          <td className="py-2 px-3 font-mono tabular-nums text-right">{g.n}</td>
                          <td className="py-2 px-3 font-mono tabular-nums text-right">{g.qty}</td>
                          <td className="py-2 px-3 font-mono tabular-nums text-right">
                            {fmtNum(g.net)}
                          </td>
                          <td className="py-2 px-3 font-mono tabular-nums text-right">
                            {fmtNum(g.IGST)}
                          </td>
                          <td className="py-2 px-3 font-mono tabular-nums text-right">
                            {fmtNum(g.CGST)}
                          </td>
                          <td className="py-2 px-3 font-mono tabular-nums text-right">
                            {fmtNum(g.SGST)}
                          </td>
                          <td className="py-2 px-3 font-mono tabular-nums text-right">
                            {fmtNum(g.cessAmt)}
                          </td>
                          <td className="py-2 px-3 font-mono tabular-nums font-bold text-right">
                            {fmtNum(g.net + t)}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 5: TAX SLABS */}
          {activeTab === 'rt' && (
            <div className="overflow-x-auto border-[1.5px] border-[#2F3E4E] rounded-xl bg-white max-h-[60vh]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#2F3E4E] text-[#FFFDF5] sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Tax Slab</th>
                    <th className="py-2.5 px-3 font-semibold text-right">HSN Codes</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Lines</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Qty</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Taxable</th>
                    <th className="py-2.5 px-3 font-semibold text-right">IGST</th>
                    <th className="py-2.5 px-3 font-semibold text-right">CGST</th>
                    <th className="py-2.5 px-3 font-semibold text-right">SGST</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Cess</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Total Tax</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {agg.rate.map((g) => {
                    const t = g.IGST + g.CGST + g.SGST + g.cessAmt;
                    return (
                      <tr key={g.rate} className="hover:bg-[#FEF2C8]/30">
                        <td className="py-2 px-3 font-bold text-[#2F3E4E]">
                          GST {fmtPct(g.rate)}
                        </td>
                        <td className="py-2 px-3 font-mono tabular-nums text-right">
                          {g.hsnCodes.size}
                        </td>
                        <td className="py-2 px-3 font-mono tabular-nums text-right">{g.n}</td>
                        <td className="py-2 px-3 font-mono tabular-nums text-right">{g.qty}</td>
                        <td className="py-2 px-3 font-mono tabular-nums text-right">
                          {fmtNum(g.net)}
                        </td>
                        <td className="py-2 px-3 font-mono tabular-nums text-right">
                          {fmtNum(g.IGST)}
                        </td>
                        <td className="py-2 px-3 font-mono tabular-nums text-right">
                          {fmtNum(g.CGST)}
                        </td>
                        <td className="py-2 px-3 font-mono tabular-nums text-right">
                          {fmtNum(g.SGST)}
                        </td>
                        <td className="py-2 px-3 font-mono tabular-nums text-right">
                          {fmtNum(g.cessAmt)}
                        </td>
                        <td className="py-2 px-3 font-mono tabular-nums text-right">
                          {fmtNum(t)}
                        </td>
                        <td className="py-2 px-3 font-mono tabular-nums font-bold text-right">
                          {fmtNum(g.net + t)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 6: PARTIES */}
          {activeTab === 'pt' && (
            <div className="overflow-x-auto border-[1.5px] border-[#2F3E4E] rounded-xl bg-white max-h-[60vh]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#2F3E4E] text-[#FFFDF5] sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Customer</th>
                    <th className="py-2.5 px-3 font-semibold">GSTIN</th>
                    <th className="py-2.5 px-3 font-semibold">State</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Invoices</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Lines</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Taxable</th>
                    <th className="py-2.5 px-3 font-semibold text-right">IGST</th>
                    <th className="py-2.5 px-3 font-semibold text-right">CGST</th>
                    <th className="py-2.5 px-3 font-semibold text-right">SGST</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Cess</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {parties
                    .filter(
                      (p) =>
                        !qLower ||
                        `${p.name} ${p.gstin} ${p.state}`
                          .toLowerCase()
                          .includes(qLower)
                    )
                    .map((p) => {
                      const t = p.IGST + p.CGST + p.SGST + p.cessAmt;
                      return (
                        <tr key={p.name} className="hover:bg-[#FEF2C8]/30">
                          <td className="py-2 px-3 font-bold text-[#2F3E4E]">{p.name}</td>
                          <td className="py-2 px-3 font-mono text-[11px]">{p.gstin || '—'}</td>
                          <td className="py-2 px-3 text-[#475569]">{p.state || '—'}</td>
                          <td className="py-2 px-3 font-mono tabular-nums text-right">
                            {p.invoiceIds.size}
                          </td>
                          <td className="py-2 px-3 font-mono tabular-nums text-right">
                            {p.lines}
                          </td>
                          <td className="py-2 px-3 font-mono tabular-nums text-right">
                            {fmtNum(p.net)}
                          </td>
                          <td className="py-2 px-3 font-mono tabular-nums text-right">
                            {fmtNum(p.IGST)}
                          </td>
                          <td className="py-2 px-3 font-mono tabular-nums text-right">
                            {fmtNum(p.CGST)}
                          </td>
                          <td className="py-2 px-3 font-mono tabular-nums text-right">
                            {fmtNum(p.SGST)}
                          </td>
                          <td className="py-2 px-3 font-mono tabular-nums text-right">
                            {fmtNum(p.cessAmt)}
                          </td>
                          <td className="py-2 px-3 font-mono tabular-nums font-bold text-right">
                            {fmtNum(p.net + t)}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 7: VALIDATION AUDIT LOG */}
          {activeTab === 'vd' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {(
                    [
                      ['all', `All (${validation.issues.length})`],
                      ['err', `Errors (${errorCount})`],
                      ['warn', `Warnings (${warningCount})`],
                    ] as const
                  ).map(([k, lbl]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setValFilter(k)}
                      className={`px-3 py-1 rounded-lg border text-xs font-bold cursor-pointer ${
                        valFilter === k
                          ? 'bg-[#2F3E4E] text-[#FFFDF5] border-[#2F3E4E]'
                          : 'bg-white text-[#475569] border-[#2F3E4E]/25 hover:bg-[#FEF2C8]'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>

                {validation.issues.length > 0 && (
                  <button
                    type="button"
                    onClick={handleAutoFixInvoices}
                    className="px-3.5 py-1.5 rounded-lg bg-[#2F3E4E] hover:bg-[#1E293B] text-[#FFFDF5] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    1-Click Auto-Fix GST Issues
                  </button>
                )}
              </div>

              {validation.issues.length === 0 ? (
                <div className="p-8 rounded-xl border border-[#2F3E4E]/20 bg-white text-center space-y-2">
                  <CheckCircle2 className="w-7 h-7 text-emerald-700 mx-auto" />
                  <p className="text-sm font-bold text-[#2F3E4E]">
                    All audit checks passed across every invoice
                  </p>
                </div>
              ) : (
                <div className="border-[1.5px] border-[#2F3E4E] rounded-xl bg-white divide-y divide-slate-200 max-h-[58vh] overflow-y-auto">
                  {validation.issues
                    .filter((x) => valFilter === 'all' || x.sev === valFilter)
                    .map((iss, idx) => (
                      <div key={idx} className="p-3.5 flex items-start gap-3 text-xs">
                        {iss.sev === 'err' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold shrink-0">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Error
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold shrink-0">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Warning
                          </span>
                        )}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-[#2F3E4E]">{iss.chk}</span>
                            <span aria-hidden="true">·</span>
                            <button
                              type="button"
                              onClick={() => setDrawerFid(iss.invoiceFid)}
                              className="font-mono font-bold text-[#2F3E4E] underline cursor-pointer"
                            >
                              {iss.invoiceNo}
                            </button>
                            <span className="text-[#64748B]">({iss.file})</span>
                          </div>
                          <p className="text-[#475569] mt-0.5">{iss.msg}</p>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Bottom Standardized Export Action Bar */}
          <div className="pt-4 border-t border-[#2F3E4E]/15 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClearAll}
                className="px-4 py-2 rounded-xl border border-rose-300 bg-white hover:bg-rose-50 text-xs font-bold text-rose-700 cursor-pointer"
              >
                Clear All
              </button>
              <span className="text-xs text-[#64748B] hidden sm:inline tabular-nums">
                {invoices.length} invoice(s) · {totals.n} line items · Grand Total{' '}
                {formatINR(grandTotal)}
              </span>
            </div>

            <div className="relative flex items-center" ref={exportMenuRef}>
              <button
                type="button"
                onClick={handleExportExcel}
                disabled={isExporting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-l-xl bg-[#2F3E4E] hover:bg-[#1E293B] text-[#FFFDF5] text-sm font-bold cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                <Download className="w-4 h-4" />
                <span>
                  {isExporting ? 'Building Excel...' : 'Download Unified Excel (.XLSX)'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setShowExportMenu((v) => !v)}
                aria-label="More export options"
                className="px-2.5 py-2.5 rounded-r-xl bg-[#2F3E4E] hover:bg-[#1E293B] text-[#FFFDF5] border-l border-white/20 cursor-pointer"
              >
                <ChevronDown className="w-4 h-4" />
              </button>

              {showExportMenu && (
                <div className="absolute right-0 bottom-full mb-2 w-64 bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-xl shadow-xl p-1.5 z-30">
                  <button
                    type="button"
                    onClick={() => handleSecondaryExport('csv')}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] cursor-pointer block"
                  >
                    Line Items as CSV
                    <span className="block text-[11px] font-normal text-[#64748B]">
                      Flat table, one row per invoice line
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSecondaryExport('tsv')}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] cursor-pointer flex items-center justify-between"
                  >
                    <span>
                      Copy TSV for Excel
                      <span className="block text-[11px] font-normal text-[#64748B]">
                        Paste straight into Excel or Sheets
                      </span>
                    </span>
                    <Copy className="w-3.5 h-3.5 text-[#64748B]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSecondaryExport('json')}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] cursor-pointer block"
                  >
                    Save Session (.JSON)
                    <span className="block text-[11px] font-normal text-[#64748B]">
                      Restore later with all manual edits
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Password Unlock Modal for Encrypted PDFs */}
      {passwordPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2F3E4E]/50">
          <div className="w-full max-w-md bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-6 space-y-4 shadow-2xl">
            <h3 className="font-display font-bold text-base text-[#2F3E4E]">
              Password Required
            </h3>
            <p className="text-xs text-[#475569]">
              <span className="font-bold text-[#2F3E4E]">{passwordPrompt.fileName}</span> is
              password-protected
              {passwordPrompt.isRetry ? ' — the previous password was incorrect.' : '.'}
            </p>
            <input
              type="password"
              autoFocus
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  passwordPrompt.resolve(passwordInput);
                  setPasswordPrompt(null);
                }
              }}
              placeholder="Enter PDF password..."
              className="w-full px-3 py-2 rounded-lg border border-[#2F3E4E] bg-white text-sm text-[#2F3E4E] focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  passwordPrompt.resolve(null);
                  setPasswordPrompt(null);
                }}
                className="px-3.5 py-1.5 rounded-lg border border-[#2F3E4E]/30 bg-white text-xs font-bold text-[#2F3E4E] cursor-pointer"
              >
                Skip File
              </button>
              <button
                type="button"
                onClick={() => {
                  passwordPrompt.resolve(passwordInput);
                  setPasswordPrompt(null);
                }}
                className="px-4 py-1.5 rounded-lg bg-[#2F3E4E] text-[#FFFDF5] text-xs font-bold cursor-pointer"
              >
                Unlock PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Side-by-Side Invoice Detail & PDF Preview Drawer */}
      <InvoiceDetailDrawer
        invoice={activeDrawerInvoice}
        issues={
          activeDrawerInvoice
            ? validation.byInvoice.get(activeDrawerInvoice.fid) || []
            : []
        }
        onClose={() => setDrawerFid(null)}
        onUpdateField={handleUpdateInvoiceField}
        onAddLine={handleAddLine}
        onDeleteLine={handleDeleteLine}
        onDeleteInvoice={handleDeleteInvoice}
      />
    </div>
  );
};
