import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type ExcelJS from 'exceljs';
import html2canvas from 'html2canvas-pro';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCopy,
  ClipboardPaste,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Loader2,
  Lock,
  Play,
  RefreshCw,
  RotateCcw,
  ScanText,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  X,
  ZoomIn,
} from 'lucide-react';
import { ToolCatalogItem } from '../../types/tools';
import { ToolPasscodeGate } from './ToolPasscodeGate';
import {
  buildDealEvidence,
  buildDealsMatrixRows,
  cellTxt,
  DATEF,
  dealFromText,
  DealRecord,
  DealSheetShot,
  exportPdfAuditReport,
  fmtDate,
  GeneratedReportResult,
  HM,
  IDX,
  INR_FMT,
  inspectTemplatePreview,
  IRF,
  LedgerCheck,
  LedgerLine,
  loadWorkbookFromInput,
  nameScore,
  norm,
  NUMF,
  parseCustomRules,
  ParsedLedger,
  parseImageLedgerFile,
  parseLines,
  parsePdfLedgerFile,
  parseSpreadsheetDealSheets,
  parseSpreadsheetLedgerFile,
  ReviewItem,
  runSerializedOcr,
  TemplateSheetPreview,
} from '../../utils/incentiveReconEngine';
import * as pdfjsLib from 'pdfjs-dist';

interface IncentiveReportToolViewProps {
  tool?: ToolCatalogItem;
  onBack?: () => void;
}

const STORAGE_KEY = 'incRules';
type TargetBox = 1 | 2 | 3;

export const IncentiveReportToolView: React.FC<IncentiveReportToolViewProps> = ({ tool, onBack }) => {
  return (
    <ToolPasscodeGate
      toolCode={tool?.code ?? 'VC-03'}
      toolTitle={tool?.title ?? 'Incentive Report Tool'}
      sessionKey="vcpl_incentive_unlocked_v1"
      passcode="202627"
      description="This tool is locked for authorized dealership reconciliation only. Enter the 6-digit passcode to unlock."
      onBack={onBack}
    >
      {({ lockTool }) => <IncentiveReportWorkspace tool={tool} lockTool={lockTool} />}
    </ToolPasscodeGate>
  );
};

const IncentiveReportWorkspace: React.FC<{ tool?: ToolCatalogItem; lockTool: () => void }> = ({
  tool,
  lockTool,
}) => {

  // Box cursor/focus targeting for effortless Ctrl+V placement
  const [hoveredBox, setHoveredBox] = useState<TargetBox | null>(null);
  const [activeBox, setActiveBox] = useState<TargetBox>(3);
  const [pasteFeedback, setPasteFeedback] = useState<{ box: TargetBox; msg: string; kind: 'ok' | 'info' } | null>(
    null
  );

  // Box 1: Incentive Excel / CSV / Pasted Grid
  const [tplFile, setTplFile] = useState<File | null>(null);
  const [pt1, setPt1] = useState('');
  const [tplPreview, setTplPreview] = useState<TemplateSheetPreview | null>(null);

  // Box 2: Tally Ledgers (PDF, XLSX, XLS, CSV, TXT, Images/OCR, Pasted Text)
  const [ledgers, setLedgers] = useState<ParsedLedger[]>([]);
  const [ledgerBusyMsg, setLedgerBusyMsg] = useState('');

  // Box 3: Deal-Sheet Files (Images, Screenshots, PDFs, Excel/CSV, Text)
  const [shots, setShots] = useState<DealSheetShot[]>([]);
  const [shotBusyMsg, setShotBusyMsg] = useState('');
  const [autoOcr, setAutoOcr] = useState(true);

  // Optional raw paste/edit drawer
  const [showPasteBox, setShowPasteBox] = useState(false);
  const [pn, setPn] = useState('');
  const [pa, setPa] = useState(false);
  const [pt2, setPt2] = useState('');
  const [pt3, setPt3] = useState('');

  // Preview modals
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [ocrTextModal, setOcrTextModal] = useState<{ title: string; text: string } | null>(null);

  // Rule Options
  const [savedOpts] = useState<Record<string, unknown>>(() => {
    try {
      return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}') as Record<string, unknown>;
    } catch {
      return {};
    }
  });
  const [lim, setLim] = useState<number>(() => Number(savedOpts.lim ?? 50000));
  const [thr, setThr] = useState<number>(() => Number(savedOpts.thr ?? 60));
  const [ovr, setOvr] = useState<boolean>(() => Boolean(savedOpts.ovr ?? false));
  const [irf, setIrf] = useState<boolean>(() => Boolean(savedOpts.irf ?? false));
  const [oNone, setONone] = useState<string>(() => String(savedOpts.o_none ?? 'FOC'));
  const [oSpares, setOSpares] = useState<boolean>(() =>
    savedOpts.o_spares === undefined ? true : Boolean(savedOpts.o_spares)
  );
  const [oRules, setORules] = useState<string>(() => String(savedOpts.o_rules ?? ''));
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Generation & output state
  const [isRunning, setIsRunning] = useState(false);
  const [statusLog, setStatusLog] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [result, setResult] = useState<GeneratedReportResult | null>(null);
  const [showChecksDetail, setShowChecksDetail] = useState(false);
  const [copySuccess, setCopySuccess] = useState('');
  const [exportingPng, setExportingPng] = useState(false);

  // Output table filters & edits
  const [onlyAttention, setOnlyAttention] = useState(true);
  const [confFilter, setConfFilter] = useState<string>('');
  const [searchQ, setSearchQ] = useState('');
  const [editTick, setEditTick] = useState(0);

  const outRef = useRef<HTMLDivElement | null>(null);
  const reportCardRef = useRef<HTMLDivElement | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);

  const notifyPaste = useCallback((box: TargetBox, msg: string, kind: 'ok' | 'info' = 'ok') => {
    setPasteFeedback({ box, msg, kind });
    if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = window.setTimeout(() => setPasteFeedback(null), 5000);
  }, []);

  // Persist rule preferences
  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          lim,
          thr,
          o_none: oNone,
          o_spares: oSpares,
          o_rules: oRules,
          ovr,
          irf,
        })
      );
    } catch {
      // Ignore storage error
    }
  }, [lim, thr, oNone, oSpares, oRules, ovr, irf]);

  // Keep live Box 1 preview updated whenever tplFile or pt1 changes
  useEffect(() => {
    let cancelled = false;
    void inspectTemplatePreview(tplFile, pt1).then((preview) => {
      if (!cancelled) setTplPreview(preview);
    });
    return () => {
      cancelled = true;
    };
  }, [tplFile, pt1]);

  // --- Box 1 Handler: Files (.xlsx, .xls, .csv, .tsv) or Images (OCR table) ---
  const handleBox1Files = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      setErrorMsg('');
      const f = files[0];
      if (/\.(xlsx|xls|csv|tsv)$/i.test(f.name)) {
        setTplFile(f);
        notifyPaste(1, `Loaded "${f.name}" into Box 1 (Incentive Sheet).`);
        return;
      }
      if (f.type.startsWith('image/')) {
        notifyPaste(1, `Running OCR on "${f.name}" for Box 1…`, 'info');
        try {
          const text = await runSerializedOcr(f);
          const cleaned = text
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean)
            .join('\n');
          if (cleaned) {
            setTplFile(null);
            setPt1(cleaned);
            setShowPasteBox(true);
            notifyPaste(1, `OCR text placed into Box 1. Verify column headers if needed.`);
          }
        } catch {
          setErrorMsg('Could not read text from screenshot pasted into Box 1.');
        }
        return;
      }
      if (/\.txt$/i.test(f.name)) {
        const text = await f.text();
        setTplFile(null);
        setPt1(text);
        notifyPaste(1, `Loaded text grid "${f.name}" into Box 1.`);
        return;
      }
      setErrorMsg('Box 1 accepts .xlsx, .xls, .csv, .tsv, or pasted Excel grid cells.');
    },
    [notifyPaste]
  );

  // --- Box 2 Handler: Tally Ledgers (PDF, XLSX, XLS, CSV, TXT, Images/OCR) ---
  const addLedgerFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      setErrorMsg('');
      const added: ParsedLedger[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        try {
          if (/\.pdf$/i.test(f.name)) {
            setLedgerBusyMsg(`Parsing ledger PDF (${i + 1}/${files.length}): ${f.name}…`);
            const parsed = await parsePdfLedgerFile(f, autoOcr, (msg) => setLedgerBusyMsg(msg));
            added.push(parsed);
          } else if (/\.(xlsx|xls|csv)$/i.test(f.name)) {
            setLedgerBusyMsg(`Parsing Tally Excel/CSV (${i + 1}/${files.length}): ${f.name}…`);
            const parsed = await parseSpreadsheetLedgerFile(f);
            added.push(parsed);
          } else if (/\.txt$/i.test(f.name)) {
            setLedgerBusyMsg(`Parsing ledger text (${i + 1}/${files.length}): ${f.name}…`);
            const txt = await f.text();
            const parsed = parseLines(
              txt.replace(/\t/g, ' ').split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
              f.name,
              undefined,
              'text'
            );
            added.push(parsed);
          } else if (f.type.startsWith('image/')) {
            setLedgerBusyMsg(`OCR reading ledger screenshot (${i + 1}/${files.length})…`);
            const parsed = await parseImageLedgerFile(f, (msg) => setLedgerBusyMsg(`${f.name}: ${msg}`));
            added.push(parsed);
          }
        } catch (err) {
          setErrorMsg(
            `Could not parse ledger "${f.name}": ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
      setLedgerBusyMsg('');
      if (added.length) {
        setLedgers((prev) => {
          const map = new Map(prev.map((l) => [l.file, l]));
          added.forEach((l) => map.set(l.file, l));
          return [...map.values()];
        });
        notifyPaste(2, `Added ${added.length} Tally ledger(s) into Box 2.`);
      }
    },
    [autoOcr, notifyPaste]
  );

  // --- Box 3 Handler: Deal-Sheet Files (Images, Screenshots, PDFs, Excel/CSV, TXT) ---
  const addDealSheetFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      setErrorMsg('');
      setShotBusyMsg(`Reading ${files.length} deal-sheet file(s)…`);
      const added: DealSheetShot[] = [];
      const ocrTargets: Array<{ id: string; source: File | HTMLCanvasElement; name: string }> = [];

      for (const f of files) {
        if (f.type.startsWith('image/')) {
          const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const url = URL.createObjectURL(f);
          added.push({
            id,
            name: f.name,
            url,
            sourceKind: 'image',
            vin: '',
            cust: '',
            vcpl: '',
            mar: '',
            ocrStatus: autoOcr ? 'pending' : 'skipped',
          });
          if (autoOcr) ocrTargets.push({ id, source: f, name: f.name });
        } else if (/\.pdf$/i.test(f.name)) {
          try {
            const pdf = await pdfjsLib.getDocument({ data: await f.arrayBuffer() }).promise;
            for (let p = 1; p <= pdf.numPages; p++) {
              const pg = await pdf.getPage(p);
              const vp = pg.getViewport({ scale: 1.8 });
              const cv = document.createElement('canvas');
              cv.width = vp.width;
              cv.height = vp.height;
              const ctx = cv.getContext('2d');
              if (ctx) {
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, cv.width, cv.height);
                await pg.render({ canvasContext: ctx, viewport: vp, canvas: cv }).promise;
              }
              const tc = await pg.getTextContent();
              const text = tc.items
                .map((i) => ('str' in i ? i.str : ''))
                .join(' ')
                .replace(/\s+/g, ' ')
                .trim();

              const id = `${Date.now()}-${p}-${Math.random().toString(36).slice(2, 7)}`;
              const pageName = f.name + (pdf.numPages > 1 ? ` p${p}` : '');
              const hasDigitalText = text.length >= 20;

              if (hasDigitalText) {
                const parsed = dealFromText(text);
                added.push({
                  id,
                  name: pageName,
                  url: cv.toDataURL('image/png'),
                  sourceKind: 'pdf',
                  vin: parsed.vin,
                  cust: parsed.cust,
                  vcpl: parsed.vcpl,
                  mar: parsed.mar,
                  ocrStatus: 'done',
                  rawText: text,
                });
              } else {
                added.push({
                  id,
                  name: pageName,
                  url: cv.toDataURL('image/png'),
                  sourceKind: 'pdf-ocr',
                  vin: '',
                  cust: '',
                  vcpl: '',
                  mar: '',
                  ocrStatus: autoOcr ? 'pending' : 'skipped',
                });
                if (autoOcr) ocrTargets.push({ id, source: cv, name: pageName });
              }
            }
          } catch (err) {
            setErrorMsg(
              `Could not open PDF "${f.name}": ${err instanceof Error ? err.message : String(err)}`
            );
          }
        } else if (/\.(xlsx|xls|csv)$/i.test(f.name)) {
          try {
            const parsedShots = await parseSpreadsheetDealSheets(f);
            added.push(...parsedShots);
          } catch (err) {
            setErrorMsg(
              `Could not parse spreadsheet "${f.name}": ${err instanceof Error ? err.message : String(err)}`
            );
          }
        } else if (/\.txt$/i.test(f.name)) {
          const text = await f.text();
          const parsed = dealFromText(text);
          added.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: f.name,
            url: '',
            sourceKind: 'text',
            vin: parsed.vin,
            cust: parsed.cust,
            vcpl: parsed.vcpl,
            mar: parsed.mar,
            ocrStatus: 'done',
            rawText: text,
          });
        }
      }

      if (added.length) {
        setShots((prev) => [...prev, ...added]);
        notifyPaste(3, `Added ${added.length} deal sheet(s) into Box 3.`);
      }
      setShotBusyMsg('');

      // Run OCR sequentially on queued images / scanned PDF pages
      if (ocrTargets.length > 0) {
        for (let i = 0; i < ocrTargets.length; i++) {
          const item = ocrTargets[i];
          setShotBusyMsg(`OCR reading deal sheet ${i + 1}/${ocrTargets.length}: ${item.name}…`);
          setShots((prev) =>
            prev.map((s) => (s.id === item.id ? { ...s, ocrStatus: 'running' } : s))
          );
          try {
            const text = await runSerializedOcr(item.source);
            const parsed = dealFromText(text);
            setShots((prev) =>
              prev.map((s) =>
                s.id === item.id
                  ? {
                      ...s,
                      vin: s.vin || parsed.vin,
                      cust: s.cust || parsed.cust,
                      vcpl: s.vcpl || parsed.vcpl,
                      mar: s.mar || parsed.mar,
                      rawText: text,
                      ocrStatus: 'done',
                    }
                  : s
              )
            );
          } catch {
            setShots((prev) =>
              prev.map((s) => (s.id === item.id ? { ...s, ocrStatus: 'error' } : s))
            );
          }
        }
        setShotBusyMsg('');
      }
    },
    [autoOcr, notifyPaste]
  );

  // Manual Re-OCR for a specific deal-sheet row or all blank rows
  const handleReOcrShot = async (shot: DealSheetShot) => {
    if (!shot.url) return;
    setShotBusyMsg(`Re-running OCR on ${shot.name}…`);
    setShots((prev) => prev.map((s) => (s.id === shot.id ? { ...s, ocrStatus: 'running' } : s)));
    try {
      const text = await runSerializedOcr(shot.url);
      const parsed = dealFromText(text);
      setShots((prev) =>
        prev.map((s) =>
          s.id === shot.id
            ? {
                ...s,
                vin: parsed.vin || s.vin,
                cust: parsed.cust || s.cust,
                vcpl: parsed.vcpl || s.vcpl,
                mar: parsed.mar || s.mar,
                rawText: text,
                ocrStatus: 'done',
              }
            : s
        )
      );
    } catch {
      setShots((prev) => prev.map((s) => (s.id === shot.id ? { ...s, ocrStatus: 'error' } : s)));
    } finally {
      setShotBusyMsg('');
    }
  };

  // Convert clipboard HTML table into clean TSV if copied directly from Excel/Sheets
  const extractTabularFromClipboard = (html: string, plain: string): string => {
    if (html && /<table/i.test(html)) {
      try {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const rows = [...doc.querySelectorAll('tr')];
        if (rows.length > 0) {
          return rows
            .map((tr) =>
              [...tr.querySelectorAll('th,td')]
                .map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim())
                .join('\t')
            )
            .filter(Boolean)
            .join('\n');
        }
      } catch {
        // Fallback to plain text
      }
    }
    return plain;
  };

  // Unified Targeted Paste Router (Files, Multiple Screenshots/Images, Excel Grids, Ledger Text, Deal Text)
  const routePastePayloadToBox = useCallback(
    async (target: TargetBox, files: File[], plainText: string, htmlText: string) => {
      setActiveBox(target);
      setErrorMsg('');

      // Rename generic 'image.png' screenshots uniquely so multiple pastes never collide
      const normalizedFiles = files.map((f, idx) =>
        f.type.startsWith('image/') && (!f.name || f.name === 'image.png' || f.name === 'blob')
          ? new File([f], `screenshot-${Date.now()}-${idx + 1}.png`, {
              type: f.type || 'image/png',
            })
          : f
      );

      // Route based on hovered / targeted box
      if (target === 1) {
        if (normalizedFiles.length > 0) {
          await handleBox1Files(normalizedFiles);
          return;
        }
        const grid = extractTabularFromClipboard(htmlText, plainText).trim();
        if (grid) {
          setTplFile(null);
          setPt1(grid);
          const rowCount = grid.split(/\r?\n/).filter((l) => l.trim()).length;
          notifyPaste(1, `Pasted ${rowCount} row(s) of Excel/CSV data directly into Box 1.`);
          return;
        }
      }

      if (target === 2) {
        if (normalizedFiles.length > 0) {
          await addLedgerFiles(normalizedFiles);
          return;
        }
        const txt = plainText.trim();
        if (txt) {
          const lines = txt
            .replace(/\t/g, ' ')
            .split(/\r?\n/)
            .map((s) => s.replace(/\s+/g, ' ').trim())
            .filter(Boolean);
          const parsed = parseLines(
            lines,
            `Pasted Ledger #${ledgers.length + 1}`,
            /after ?sales|service/i.test(txt),
            'text'
          );
          if (!parsed.rows.length) {
            setErrorMsg(
              'Pasted text into Box 2 did not match voucher lines (need date / Dr or Cr / particulars / amount). Open Paste Raw Text to inspect.'
            );
            setPt2(txt);
            setShowPasteBox(true);
            return;
          }
          if (parsed.header) {
            parsed.file = `${parsed.header.slice(0, 38)} (pasted)`;
          }
          setLedgers((prev) => [...prev, parsed]);
          notifyPaste(2, `Pasted ledger (${parsed.rows.length} vouchers) into Box 2.`);
          return;
        }
      }

      if (target === 3) {
        if (normalizedFiles.length > 0) {
          await addDealSheetFiles(normalizedFiles);
          return;
        }
        const txt = plainText.trim();
        if (txt) {
          // Check if pasted text is multi-row TSV deal table
          const lines = txt.split(/\r?\n/).filter((l) => l.trim());
          const tsvWithVins = lines.filter((l) => l.includes('\t') && /W[A-Z0-9]{16}/i.test(l));
          if (tsvWithVins.length > 1) {
            const newShots: DealSheetShot[] = tsvWithVins.map((rowStr, idx) => {
              const p = dealFromText(rowStr);
              return {
                id: `${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
                name: `pasted row #${idx + 1}`,
                url: '',
                sourceKind: 'text',
                vin: p.vin,
                cust: p.cust,
                vcpl: p.vcpl,
                mar: p.mar,
                ocrStatus: 'done',
                rawText: rowStr,
              };
            });
            setShots((prev) => [...prev, ...newShots]);
            notifyPaste(3, `Pasted ${newShots.length} deal-sheet rows into Box 3.`);
            return;
          }

          const parsed = dealFromText(txt);
          setShots((prev) => [
            ...prev,
            {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              name: `pasted text #${prev.length + 1}`,
              url: '',
              sourceKind: 'text',
              vin: parsed.vin,
              cust: parsed.cust,
              vcpl: parsed.vcpl,
              mar: parsed.mar,
              ocrStatus: 'done',
              rawText: txt,
            },
          ]);
          notifyPaste(3, `Pasted deal-sheet text into Box 3.`);
        }
      }
    },
    [addDealSheetFiles, addLedgerFiles, handleBox1Files, ledgers.length, notifyPaste]
  );

  // Global keyboard Ctrl+V handler — routes strictly to hoveredBox first, then activeBox
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') return;

      const dt = e.clipboardData;
      if (!dt) return;

      const files: File[] = [...(dt.files || [])];
      if (!files.length && dt.items) {
        for (const item of [...dt.items]) {
          if (item.kind === 'file') {
            const f = item.getAsFile();
            if (f) files.push(f);
          }
        }
      }

      const plainText = dt.getData('text/plain') || '';
      const htmlText = dt.getData('text/html') || '';
      if (!files.length && !plainText.trim() && !htmlText.trim()) return;

      e.preventDefault();
      const targetBox: TargetBox = hoveredBox ?? activeBox;
      void routePastePayloadToBox(targetBox, files, plainText, htmlText);
    };

    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [activeBox, hoveredBox, routePastePayloadToBox]);

  // Explicit "Paste Here" button on each Box using Clipboard API with graceful Ctrl+V fallback
  const handleBoxPasteButton = async (box: TargetBox) => {
    setActiveBox(box);
    setHoveredBox(box);
    setErrorMsg('');

    try {
      if (navigator.clipboard && 'read' in navigator.clipboard) {
        const items = await navigator.clipboard.read();
        const files: File[] = [];
        let plainText = '';
        let htmlText = '';

        for (let idx = 0; idx < items.length; idx++) {
          const item = items[idx];
          const imgType = item.types.find((t) => t.startsWith('image/'));
          if (imgType) {
            const blob = await item.getType(imgType);
            const ext = imgType.split('/')[1] || 'png';
            files.push(
              new File([blob], `pasted-${Date.now()}-${idx + 1}.${ext}`, { type: imgType })
            );
          } else {
            if (item.types.includes('text/html')) {
              htmlText = await (await item.getType('text/html')).text();
            }
            if (item.types.includes('text/plain')) {
              plainText = await (await item.getType('text/plain')).text();
            }
          }
        }

        if (files.length > 0 || plainText.trim() || htmlText.trim()) {
          await routePastePayloadToBox(box, files, plainText, htmlText);
          return;
        }
      }

      if (navigator.clipboard && navigator.clipboard.readText) {
        const txt = await navigator.clipboard.readText();
        if (txt.trim()) {
          await routePastePayloadToBox(box, [], txt, '');
          return;
        }
      }

      notifyPaste(
        box,
        `Clipboard is empty or ready — keep your cursor on Box ${box} and press Ctrl+V.`,
        'info'
      );
    } catch {
      notifyPaste(
        box,
        `Box ${box} is selected! Keep mouse cursor here and press Ctrl+V (Cmd+V on Mac) to paste.`,
        'info'
      );
    }
  };

  const handleAddLedgerText = () => {
    if (!pt2.trim()) return;
    const lines = pt2
      .replace(/\t/g, ' ')
      .split(/\r?\n/)
      .map((s) => s.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    const parsed = parseLines(
      lines,
      `${pn.trim() || `Pasted ledger #${ledgers.length + 1}`}${pa ? ' Aftersales' : ''} (pasted)`,
      pa,
      'text'
    );
    if (!parsed.rows.length) {
      setErrorMsg(
        'No voucher lines were found in pasted ledger text. Each voucher must be on one line (date, Dr/Cr, particulars, voucher no., amount).'
      );
      return;
    }
    parsed.header = pn.trim() || parsed.header;
    setLedgers((prev) => [...prev, parsed]);
    setPt2('');
    setPn('');
    setErrorMsg('');
    notifyPaste(2, `Added pasted ledger (${parsed.rows.length} lines) to Box 2.`);
  };

  const handleAddDealText = () => {
    if (!pt3.trim()) return;
    const parsed = dealFromText(pt3);
    setShots((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: `pasted text #${prev.length + 1}`,
        url: '',
        sourceKind: 'text',
        vin: parsed.vin,
        cust: parsed.cust,
        vcpl: parsed.vcpl,
        mar: parsed.mar,
        ocrStatus: 'done',
        rawText: pt3,
      },
    ]);
    setPt3('');
    notifyPaste(3, 'Added deal-sheet text row to Box 3.');
  };

  const handleResetAll = () => {
    setTplFile(null);
    setPt1('');
    setTplPreview(null);
    setLedgers([]);
    setShots([]);
    setPt2('');
    setPt3('');
    setPn('');
    setPa(false);
    setResult(null);
    setErrorMsg('');
    setStatusLog('');
    setPasteFeedback(null);
  };

  // Pre-flight verification metrics computed live from uploaded/pasted files
  const preflight = useMemo(() => {
    const balancedCount = ledgers.filter((l) => l.balanced).length;
    const unbalancedCount = ledgers.filter((l) => !l.balanced).length;
    const totalVoucherLines = ledgers.reduce((sum, l) => sum + l.rows.length, 0);
    const vinsExtracted = shots.filter((s) => s.vin.trim().length > 0).length;
    const marginsExtracted = shots.filter((s) => s.mar.trim() !== '').length;
    const scanningCount = shots.filter((s) => s.ocrStatus === 'running' || s.ocrStatus === 'pending').length;
    return {
      balancedCount,
      unbalancedCount,
      totalVoucherLines,
      vinsExtracted,
      marginsExtracted,
      scanningCount,
    };
  }, [ledgers, shots]);

  const handleGenerate = async () => {
    setErrorMsg('');
    setIsRunning(true);
    setStatusLog('Preparing incentive sheet & ledgers…');

    try {
      const customRules = parseCustomRules(oRules);
      const thrRatio = (Number(thr) || 60) / 100;
      const marginLimit = Number(lim) || 50000;

      const loadedLedgers = ledgers;
      const { wb, ws, isFromInput } = await loadWorkbookFromInput(tplFile, pt1);

      const hdr: Record<string, number> = {};
      ws.getRow(1).eachCell({ includeEmpty: false }, (c, colNum) => {
        const k = norm(cellTxt(c.value));
        if (HM[k]) hdr[HM[k]] = colNum;
        if (IDX[k]) hdr[IDX[k]] = colNum;
      });

      const activeShots = shots.filter((m) => m.vin || m.cust);
      const deals: DealRecord[] = [];

      if (isFromInput) {
        if (!hdr.vin || !hdr.customer) {
          setErrorMsg('The Incentive Sheet needs “VIN” and “Delivered To” column headers.');
          setIsRunning(false);
          setStatusLog('');
          return;
        }
        for (let r = 2; r <= ws.rowCount; r++) {
          const v = cellTxt(ws.getCell(r, hdr.vin).value).trim().toUpperCase();
          const c = cellTxt(ws.getCell(r, hdr.customer).value).trim();
          if (v && c) {
            deals.push({
              row: r,
              vin: v,
              cust: c,
              sc: hdr.sc ? cellTxt(ws.getCell(r, hdr.sc).value) : '',
              ev: {},
              nl: 0,
            });
          }
        }
      } else {
        activeShots.forEach((m) => {
          deals.push({
            row: 0,
            vin: m.vin,
            cust: m.cust || '(name from ledger)',
            sc: '',
            ev: {},
            nl: 0,
          });
        });
        loadedLedgers
          .filter((x) => !x.after)
          .forEach((x) => {
            if (
              !deals.some(
                (d) =>
                  nameScore(d.cust, x.header) >= thrRatio ||
                  nameScore(d.cust, x.file) >= thrRatio
              )
            ) {
              deals.push({
                row: 0,
                vin: '',
                cust: x.header || x.file,
                sc: '',
                ev: {},
                nl: 0,
              });
            }
          });
        deals.forEach((d, i) => {
          d.row = i + 2;
          if (hdr.vin) ws.getCell(d.row, hdr.vin).value = d.vin;
          if (hdr.customer) ws.getCell(d.row, hdr.customer).value = d.cust;
          if (hdr.sc) ws.getCell(d.row, hdr.sc).value = d.sc;
          ws.getCell(d.row, 1).value = i + 1;
        });
      }

      if (deals.length === 0) {
        setErrorMsg(
          'No customers or deals found to process. Upload/paste an Incentive Sheet, Tally Ledgers, or Deal-Sheet screenshots first.'
        );
        setIsRunning(false);
        setStatusLog('');
        return;
      }

      setStatusLog('Matching ledgers & building audit workbook…');

      const usedL = new Set<string>();
      const review: ReviewItem[] = [];
      const allLines: Array<[string, string, string, Date | null, string, string, string, string, number, string]> = [];

      for (const d of deals) {
        const scr = shots.find(
          (m) =>
            (m.vin && d.vin && m.vin === d.vin) ||
            (!d.vin && m.cust && nameScore(d.cust, m.cust) >= thrRatio)
        );
        const names = [d.cust, scr?.cust].filter(Boolean) as string[];
        const mine = loadedLedgers.filter((x) =>
          names.some(
            (n) =>
              Math.max(
                nameScore(n, x.header),
                nameScore(n, x.file.replace(/\.(pdf|xlsx|xls|csv|txt|png|jpg|jpeg|webp)$/i, ''))
              ) >= thrRatio
          )
        );
        mine.forEach((x) => usedL.add(x.id));

        const seen = new Set<string>();
        const uniq: LedgerLine[] = [];
        mine.forEach((x) =>
          x.rows.forEach((l) => {
            const key = `${l.vno}|${l.amt}|${l.part}`;
            if (!seen.has(key)) {
              seen.add(key);
              uniq.push({ ...l });
            }
          })
        );

        const ev = uniq.length ? buildDealEvidence(uniq, customRules, oNone, oSpares) : {};
        d.ev = ev;
        d.nl = mine.length;

        uniq.forEach((l) =>
          allLines.push([
            d.vin,
            d.cust,
            l.src,
            l.date,
            l.vno,
            l.vt,
            l.part,
            l.side,
            l.amt,
            l.f || 'other',
          ])
        );

        if (scr) {
          if (scr.vcpl !== '') {
            ev.vcpl_discount = [Number(scr.vcpl), `Deal sheet ${scr.name}`, 'High', ''];
          }
          if (scr.mar !== '') {
            ev.margin_flag = [
              Number(scr.mar) < marginLimit ? 'Less 50K' : 'Above 50K',
              `Total retained margin ${Number(scr.mar).toLocaleString('en-IN')}`,
              'High',
              `Limit ${marginLimit.toLocaleString('en-IN')}`,
            ];
          }
        }

        for (const [f, col] of Object.entries(hdr)) {
          if (Object.values(IDX).includes(f) || !ev[f] || (IRF.has(f) && !irf)) continue;
          const v = ev[f][0];
          if (v === '' || v == null) continue;
          const cell = ws.getCell(d.row, col);
          if (cell.value != null && cell.value !== '' && !ovr) continue;
          cell.value = v;
          if (v instanceof Date) cell.numFmt = 'dd-mm-yyyy';
          else if (typeof v === 'number') cell.numFmt = INR_FMT;
        }

        for (const f of Object.values(HM)) {
          if (!(f in hdr) || (IRF.has(f) && !irf)) continue;
          const e = ev[f];
          review.push({
            row: d.row,
            col: hdr[f],
            cust: d.cust,
            f,
            v: e ? (e[0] instanceof Date ? fmtDate(e[0]) : String(e[0])) : '',
            c: e ? e[2] : 'Missing',
            n: e
              ? `${e[1]}${e[3] ? ` — ${e[3]}` : ''}`
              : `Not found in ${['vcpl_discount', 'margin_flag'].includes(f) ? 'deal-sheet values' : 'ledger'}`,
          });
        }
      }

      ['Review', 'Ledger_Lines', 'Unmatched', 'Checks', 'SC_Summary'].forEach((name) => {
        const existing = wb.getWorksheet(name);
        if (existing) wb.removeWorksheet(existing.id);
      });

      const styleHead = (sheet: ExcelJS.Worksheet, cols: string[]) => {
        sheet.addRow(cols);
        const r = sheet.getRow(1);
        r.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Arial' };
        r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } };
        sheet.views = [{ state: 'frozen', ySplit: 1 }];
      };

      const rv = wb.addWorksheet('Review');
      styleHead(rv, ['Customer', 'Field', 'Value', 'Confidence', 'Evidence and note']);
      review.forEach((r) => rv.addRow([r.cust, r.f, r.v, r.c, r.n]));
      [28, 18, 22, 12, 90].forEach((w, i) => {
        rv.getColumn(i + 1).width = w;
      });

      const ll = wb.addWorksheet('Ledger_Lines');
      styleHead(ll, [
        'VIN',
        'Customer',
        'File',
        'Date',
        'Voucher No',
        'Voucher Type',
        'Particulars',
        'Dr/Cr',
        'Amount',
        'Classified as',
      ]);
      allLines.forEach((r) => {
        const row = ll.addRow(r);
        row.getCell(4).numFmt = 'dd-mm-yyyy';
        row.getCell(9).numFmt = INR_FMT;
      });
      [20, 26, 36, 12, 20, 16, 50, 7, 15, 14].forEach((w, i) => {
        ll.getColumn(i + 1).width = w;
      });

      const um = wb.addWorksheet('Unmatched');
      styleHead(um, ['Type', 'Detail']);
      loadedLedgers
        .filter((x) => !usedL.has(x.id))
        .forEach((x) =>
          um.addRow(['Ledger matched no customer', `${x.file} (header: ${x.header || 'none'})`])
        );
      const dealVins = new Set(deals.map((d) => d.vin));
      shots
        .filter((m) => m.vin && !dealVins.has(m.vin))
        .forEach((m) => um.addRow(['Deal-sheet VIN not in list', m.vin]));
      um.getColumn(1).width = 38;
      um.getColumn(2).width = 70;

      const checks: LedgerCheck[] = loadedLedgers.map((x) => ({
        file: x.file,
        n: x.rows.length,
        dr: x.drTotal,
        cr: x.crTotal,
        ok: x.balanced,
        sourceKind: x.sourceKind,
      }));

      const alerts: Array<['High' | 'Medium', string]> = [];
      const fmtN = (v: number) => v.toLocaleString('en-IN');

      checks.forEach((c) => {
        if (!c.n) alerts.push(['High', `No voucher lines could be read from ${c.file}`]);
        else if (!c.ok)
          alerts.push([
            'High',
            `${c.file}: debits (${fmtN(c.dr)}) and credits (${fmtN(c.cr)}) differ, so a line may have been missed. Compare with source file.`,
          ]);
      });

      const seenV: Record<string, boolean> = {};
      deals.forEach((d) => {
        if (d.vin && seenV[d.vin]) alerts.push(['High', `Duplicate VIN ${d.vin} in the list`]);
        if (d.vin) seenV[d.vin] = true;
        if (!d.nl) alerts.push(['High', `No ledger matched for ${d.cust}`]);
        const e = d.ev || {};
        if (
          e.booking_date &&
          e.trpr_date &&
          e.trpr_date[0] instanceof Date &&
          e.booking_date[0] instanceof Date &&
          e.trpr_date[0] < e.booking_date[0]
        ) {
          alerts.push(['Medium', `${d.cust}: TR/PR date is before the booking date`]);
        }
        if (
          !e.margin_flag &&
          !(hdr.margin_flag && ws.getCell(d.row, hdr.margin_flag).value)
        ) {
          alerts.push([
            'Medium',
            `${d.cust}: no Total Retained Margin entered, so the margin flag is blank`,
          ]);
        }
      });

      const ck = wb.addWorksheet('Checks');
      styleHead(ck, ['Severity', 'Check']);
      alerts.forEach((a) => ck.addRow(a));
      checks.forEach((c) =>
        ck.addRow([c.ok ? 'OK' : 'High', `${c.file}: ${c.n} lines, Dr ${fmtN(c.dr)}, Cr ${fmtN(c.cr)}`])
      );
      ck.getColumn(1).width = 12;
      ck.getColumn(2).width = 110;

      if (hdr.sc) {
        const sc = wb.addWorksheet('SC_Summary');
        styleHead(sc, [
          'Sold By',
          'Cars sold',
          'Margin below limit',
          'Margin above limit',
          'Total VCPL discount',
        ]);
        const last = Math.max(ws.rowCount, ...deals.map((d) => d.row));
        const colL = (n: number) => ws.getColumn(n).letter;
        const rg = (n: number) => `'${ws.name}'!$${colL(n)}$2:$${colL(n)}$${last}`;
        const names = [...new Set(deals.map((d) => String(d.sc || '').trim()))];
        names.forEach((s, i) => {
          const r = i + 2;
          sc.addRow([
            s,
            { formula: `COUNTIF(${rg(hdr.sc)},A${r})` },
            hdr.margin_flag
              ? { formula: `COUNTIFS(${rg(hdr.sc)},A${r},${rg(hdr.margin_flag)},"Less*")` }
              : '',
            hdr.margin_flag
              ? { formula: `COUNTIFS(${rg(hdr.sc)},A${r},${rg(hdr.margin_flag)},"Above*")` }
              : '',
            hdr.vcpl_discount
              ? { formula: `SUMIF(${rg(hdr.sc)},A${r},${rg(hdr.vcpl_discount)})` }
              : '',
          ]);
          sc.getCell(r, 5).numFmt = INR_FMT;
        });
        const t = names.length + 2;
        sc.addRow([
          'Total',
          ...[2, 3, 4, 5].map((c) => ({
            formula: `SUM(${sc.getColumn(c).letter}2:${sc.getColumn(c).letter}${t - 1})`,
          })),
        ]);
        sc.getRow(t).font = { bold: true };
        sc.getCell(t, 5).numFmt = INR_FMT;
        [20, 12, 18, 18, 20].forEach((w, i) => {
          sc.getColumn(i + 1).width = w;
        });
      }

      wb.calcProperties = { fullCalcOnLoad: true };

      setResult({
        wb,
        ws,
        hdr,
        rv,
        review,
        deals,
        alerts,
        checks,
        unmatched: um.rowCount - 1,
        usedL: usedL.size,
        total: loadedLedgers.length,
      });
      setStatusLog('');
      window.setTimeout(() => {
        outRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to generate incentive report.');
      setStatusLog('');
    } finally {
      setIsRunning(false);
    }
  };

  const handleReviewCellChange = (idx: number, rawVal: string) => {
    if (!result) return;
    const item = result.review[idx];
    const s = rawVal.trim();
    let v: string | number | Date | null = s || null;

    if (s && DATEF.has(item.f)) {
      const m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
      if (!m) {
        setErrorMsg('Please use date format dd-mm-yyyy (for example 27-11-2025).');
        return;
      }
      v = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
    } else if (s && NUMF.has(item.f)) {
      const n = Number(s.replace(/,/g, ''));
      if (!Number.isFinite(n)) {
        setErrorMsg('Please enter a valid number for numeric fields.');
        return;
      }
      v = n;
    }

    setErrorMsg('');
    const cell = result.ws.getCell(item.row, item.col);
    cell.value = v;
    cell.numFmt = v instanceof Date ? 'dd-mm-yyyy' : typeof v === 'number' ? INR_FMT : 'General';
    item.v = s;
    item.c = 'Edited';
    setEditTick((t) => t + 1);
  };

  const handleDownloadExcel = async () => {
    if (!result) return;
    result.review.forEach((x, i) => {
      const row = result.rv.getRow(i + 2);
      row.getCell(3).value = x.v;
      row.getCell(4).value = x.c;
    });
    const buffer = await result.wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Incentive_report_filled.xlsx';
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const scSummary = useMemo(() => {
    if (!result) return [];
    const map: Record<string, { n: number; l: number; a: number; v: number }> = {};
    result.deals.forEach((d) => {
      const key = String(d.sc || '').trim() || '(no name)';
      const rec = (map[key] = map[key] || { n: 0, l: 0, a: 0, v: 0 });
      rec.n++;
      const flag = result.hdr.margin_flag
        ? cellTxt(result.ws.getCell(d.row, result.hdr.margin_flag).value)
        : '';
      if (/less/i.test(flag)) rec.l++;
      else if (/above/i.test(flag)) rec.a++;
      const vcpl = result.hdr.vcpl_discount
        ? Number(result.ws.getCell(d.row, result.hdr.vcpl_discount).value)
        : 0;
      if (vcpl > 0) rec.v += vcpl;
    });
    return Object.entries(map).sort((a, b) => b[1].n - a[1].n);
  }, [result, editTick]);

  const dealsMatrix = useMemo(() => {
    if (!result) return [];
    return buildDealsMatrixRows(result);
  }, [result, editTick]);

  const maxScCount = useMemo(
    () => Math.max(1, ...scSummary.map(([, o]) => o.n)),
    [scSummary]
  );

  const visibleReviewRows = useMemo(() => {
    if (!result) return [];
    const q = searchQ.trim().toLowerCase();
    return result.review
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => {
        if (onlyAttention && (item.c === 'High' || item.c === 'Edited')) return false;
        if (confFilter && item.c !== confFilter) return false;
        if (q && !`${item.cust} ${item.f} ${item.n}`.toLowerCase().includes(q)) return false;
        return true;
      });
  }, [result, onlyAttention, confFilter, searchQ, editTick]);

  const handleDownloadPdfReport = () => {
    if (!result) return;
    exportPdfAuditReport({
      result,
      scSummary,
      marginLimit: Number(lim) || 50000,
      thr: Number(thr) || 60,
    });
  };

  const handleDownloadReportImage = async () => {
    if (!reportCardRef.current) return;
    setExportingPng(true);
    try {
      const canvas = await html2canvas(reportCardRef.current, {
        scale: 2,
        backgroundColor: '#FFFDF5',
        useCORS: true,
      });
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Incentive_Audit_Summary.png';
      a.click();
    } finally {
      setExportingPng(false);
    }
  };

  const handleCopySummaryForExcel = async () => {
    if (!dealsMatrix.length) return;
    const headers = [
      'Customer',
      'VIN',
      'Sold By',
      'Booking Date',
      'Booking Amount',
      'TR/PR Date',
      'VCPL Discount',
      'Accessories Amt',
      'BSI',
      'EW',
      'Margin Flag',
      'Ledgers Matched',
    ];
    const rows = dealsMatrix.map((r) => [
      r.cust,
      r.vin,
      r.sc,
      r.bookingDate,
      r.bookingAmt,
      r.trprDate,
      r.vcplDisc,
      r.accAmt,
      r.bsi,
      r.ew,
      r.marginFlag,
      String(r.ledgersMatched),
    ]);
    const tsv = [headers.join('\t'), ...rows.map((r) => r.join('\t'))].join('\n');
    const html = `<table><thead><tr>${headers
      .map((h) => `<th>${h}</th>`)
      .join('')}</tr></thead><tbody>${rows
      .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`)
      .join('')}</tbody></table>`;

    try {
      if (navigator.clipboard && 'write' in navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/plain': new Blob([tsv], { type: 'text/plain' }),
            'text/html': new Blob([html], { type: 'text/html' }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(tsv);
      }
      setCopySuccess('Copied deals matrix! Press Ctrl+V in Excel.');
    } catch {
      setCopySuccess('Clipboard unavailable—use Download Filled Excel (.XLSX).');
    }
    window.setTimeout(() => setCopySuccess(''), 4000);
  };

  const boxClass = (box: TargetBox, isReady: boolean) => {
    const isHover = hoveredBox === box;
    const isActive = activeBox === box;
    if (isHover) {
      return 'rounded-xl border-2 border-[#2F3E4E] ring-2 ring-[#F9C80E] bg-[#FEF2C8]/55 p-4 sm:p-5 transition-all shadow-[0_3px_0_#2F3E4E]';
    }
    if (isReady) {
      return 'rounded-xl border-2 border-dashed border-[#12805C] bg-[#CEE5DC]/25 p-4 sm:p-5 transition-all';
    }
    if (isActive) {
      return 'rounded-xl border-2 border-dashed border-[#2F3E4E] bg-[#FEF2C8]/25 p-4 sm:p-5 transition-all';
    }
    return 'rounded-xl border-2 border-dashed border-[#2F3E4E]/45 bg-white p-4 sm:p-5 transition-all';
  };

  const targetBadge = (box: TargetBox) => {
    if (hoveredBox === box) {
      return (
        <span className="px-2 py-0.5 rounded-md bg-[#F9C80E] border border-[#2F3E4E] text-[10px] font-extrabold text-[#2F3E4E] whitespace-nowrap">
          Cursor Target · Ctrl+V
        </span>
      );
    }
    if (activeBox === box) {
      return (
        <span className="px-2 py-0.5 rounded-md bg-[#2F3E4E] text-[10px] font-bold text-[#F9C80E] whitespace-nowrap">
          Selected · Ctrl+V
        </span>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header Banner Card */}
      <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 sm:p-6 shadow-[0_4px_0_#2F3E4E] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-[#CEE5DC] border border-[#2F3E4E] text-[11px] font-mono font-bold text-[#2F3E4E]">
              {tool?.code ?? 'VC-03'} · Smart Recon &amp; OCR
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-[#F9C80E] border border-[#2F3E4E] text-[11px] font-bold text-[#2F3E4E]">
              100% Browser-Local
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#2F3E4E] text-[11px] font-bold text-[#F9C80E]">
              <Lock className="w-3 h-3" aria-hidden="true" />
              <span>Passcode Unlocked</span>
            </span>
          </div>
          <h2 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E]">
            {tool?.title ?? 'Incentive Report Tool'}
          </h2>
          <p className="text-xs sm:text-sm text-[#475569] leading-relaxed max-w-3xl">
            Keep your mouse cursor over Box 1, Box 2, or Box 3 and press <kbd className="px-1.5 py-0.5 rounded bg-[#FEF2C8] border border-[#2F3E4E]/40 font-mono text-[11px]">Ctrl+V</kbd> (or click Paste) to drop multiple screenshots, PDFs, Excel/CSV, or text directly into that box. Built-in OCR reads screenshots automatically.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={lockTool}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#2F3E4E] hover:bg-[#1E293B] text-xs font-bold text-[#F9C80E] transition cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Lock Tool</span>
          </button>
          <button
            type="button"
            onClick={handleResetAll}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Reset Workspace</span>
          </button>
        </div>
      </div>

      {/* 3-Step Targeted Upload + Paste Card */}
      <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 sm:p-6 shadow-[0_4px_0_#2F3E4E] space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* BOX 1: Incentive Sheet */}
          <div
            className={boxClass(1, Boolean(tplFile || pt1.trim()))}
            onMouseEnter={() => setHoveredBox(1)}
            onMouseLeave={() => setHoveredBox((b) => (b === 1 ? null : b))}
            onClick={() => setActiveBox(1)}
            onDragOver={(e) => {
              e.preventDefault();
              setHoveredBox(1);
            }}
            onDrop={(e) => {
              e.preventDefault();
              void handleBox1Files([...e.dataTransfer.files]);
            }}
          >
            <div className="flex items-start justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-[#F9C80E] border border-[#2F3E4E] flex items-center justify-center text-xs font-extrabold text-[#2F3E4E] shrink-0">
                  1
                </span>
                <div>
                  <span className="font-display font-extrabold text-sm text-[#2F3E4E] block">
                    Incentive Sheet
                  </span>
                  <span className="text-[11px] text-[#64748B]">.xlsx · .xls · .csv · Paste cells</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {targetBadge(1)}
                {(tplFile || tplPreview?.isValid) && (
                  <CheckCircle2 className="w-4 h-4 text-[#12805C] shrink-0" />
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] cursor-pointer transition">
                <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>{tplFile ? 'Replace Sheet' : 'Upload File'}</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,.tsv,.txt,image/*"
                  onChange={(e) => {
                    void handleBox1Files([...(e.target.files || [])]);
                    e.target.value = '';
                  }}
                  className="sr-only"
                />
              </label>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleBoxPasteButton(1);
                }}
                title="Paste Excel rows, CSV, or file into Box 1"
                className="inline-flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] cursor-pointer transition shrink-0"
              >
                <ClipboardPaste className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Paste</span>
              </button>
            </div>

            {tplPreview ? (
              <div className="mt-2.5 rounded-lg border border-[#2F3E4E]/20 bg-white/90 px-2.5 py-2 text-[11px] space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-[#2F3E4E] truncate">{tplPreview.sourceName}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTplFile(null);
                      setPt1('');
                    }}
                    className="text-[#9E2A2B] font-bold hover:underline shrink-0 cursor-pointer"
                  >
                    clear
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold">
                  <span className="px-1.5 py-0.5 rounded bg-[#FEF2C8] text-[#2F3E4E]">
                    {tplPreview.rowCount} deal rows
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded ${
                      tplPreview.hasVin
                        ? 'bg-[#CEE5DC] text-[#0F5132]'
                        : 'bg-rose-100 text-rose-900'
                    }`}
                  >
                    VIN {tplPreview.hasVin ? '✓' : '✗'}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded ${
                      tplPreview.hasCustomer
                        ? 'bg-[#CEE5DC] text-[#0F5132]'
                        : 'bg-rose-100 text-rose-900'
                    }`}
                  >
                    Delivered To {tplPreview.hasCustomer ? '✓' : '✗'}
                  </span>
                </div>
              </div>
            ) : (
              <p className="mt-2.5 text-[11px] font-medium text-[#475569] leading-relaxed">
                Optional. Hover here + Ctrl+V to paste Excel rows directly, or leave empty to build from ledgers &amp; deal sheets.
              </p>
            )}
          </div>

          {/* BOX 2: Tally Ledgers (Multi-Format) */}
          <div
            className={boxClass(2, ledgers.length > 0)}
            onMouseEnter={() => setHoveredBox(2)}
            onMouseLeave={() => setHoveredBox((b) => (b === 2 ? null : b))}
            onClick={() => setActiveBox(2)}
            onDragOver={(e) => {
              e.preventDefault();
              setHoveredBox(2);
            }}
            onDrop={(e) => {
              e.preventDefault();
              void addLedgerFiles([...e.dataTransfer.files]);
            }}
          >
            <div className="flex items-start justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-[#CEE5DC] border border-[#2F3E4E] flex items-center justify-center text-xs font-extrabold text-[#2F3E4E] shrink-0">
                  2
                </span>
                <div>
                  <span className="font-display font-extrabold text-sm text-[#2F3E4E] block">
                    Tally Ledgers
                  </span>
                  <span className="text-[11px] text-[#64748B]">PDF · XLSX · CSV · TXT · Images</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {targetBadge(2)}
                {ledgers.length > 0 && <CheckCircle2 className="w-4 h-4 text-[#12805C] shrink-0" />}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] cursor-pointer transition">
                <FileText className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Add Ledgers</span>
                <input
                  type="file"
                  accept=".pdf,application/pdf,.xlsx,.xls,.csv,.txt,image/*"
                  multiple
                  onChange={(e) => {
                    void addLedgerFiles([...(e.target.files || [])]);
                    e.target.value = '';
                  }}
                  className="sr-only"
                />
              </label>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleBoxPasteButton(2);
                }}
                title="Paste Tally ledger screenshot, PDF, Excel, or text into Box 2"
                className="inline-flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] cursor-pointer transition shrink-0"
              >
                <ClipboardPaste className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Paste</span>
              </button>
            </div>

            {ledgerBusyMsg && (
              <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-[#2F3E4E]">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#12805C]" />
                <span className="truncate">{ledgerBusyMsg}</span>
              </div>
            )}

            {ledgers.length === 0 ? (
              <p className="mt-2.5 text-[11px] font-medium text-[#475569] leading-relaxed">
                Supports PDF, Excel/CSV exports, TXT, or pasted ledger screenshots (OCR). Toggle “AS” for Aftersales.
              </p>
            ) : (
              <div className="mt-2.5 max-h-28 overflow-y-auto space-y-1.5 text-[11px] pr-1">
                {ledgers.map((l) => (
                  <div
                    key={l.id}
                    className="flex items-center justify-between gap-1.5 rounded-lg border border-[#2F3E4E]/15 bg-white px-2 py-1"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span
                          className={`px-1 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                            l.balanced
                              ? 'bg-[#CEE5DC] text-[#0F5132]'
                              : 'bg-rose-100 text-rose-900'
                          }`}
                          title={`Dr ₹${l.drTotal.toLocaleString('en-IN')} / Cr ₹${l.crTotal.toLocaleString('en-IN')}`}
                        >
                          {l.balanced ? 'Dr=Cr' : `${l.rows.length}L!`}
                        </span>
                        <span className="truncate font-semibold text-[#2F3E4E]" title={l.header || l.file}>
                          {l.file}
                        </span>
                      </div>
                    </div>
                    <label
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-[#475569] shrink-0 cursor-pointer"
                      title="Mark as Aftersales / Service ledger"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={l.after}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setLedgers((prev) =>
                            prev.map((item) =>
                              item.id === l.id
                                ? {
                                    ...item,
                                    after: checked,
                                    rows: item.rows.map((r) => ({ ...r, after: checked })),
                                  }
                                : item
                            )
                          );
                        }}
                      />
                      <span>AS</span>
                    </label>
                    {l.previewUrl && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setModalImage(l.previewUrl || null);
                        }}
                        title="Enlarge ledger screenshot"
                        className="text-[#2F3E4E] hover:text-[#12805C] cursor-pointer shrink-0"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLedgers((prev) => prev.filter((item) => item.id !== l.id));
                      }}
                      className="text-[#9E2A2B] hover:underline font-bold shrink-0 cursor-pointer text-[10px]"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* BOX 3: Deal-Sheet Files & Multiple Screenshots */}
          <div
            className={boxClass(3, shots.length > 0)}
            onMouseEnter={() => setHoveredBox(3)}
            onMouseLeave={() => setHoveredBox((b) => (b === 3 ? null : b))}
            onClick={() => setActiveBox(3)}
            onDragOver={(e) => {
              e.preventDefault();
              setHoveredBox(3);
            }}
            onDrop={(e) => {
              e.preventDefault();
              void addDealSheetFiles([...e.dataTransfer.files]);
            }}
          >
            <div className="flex items-start justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-[#FFE1B3] border border-[#2F3E4E] flex items-center justify-center text-xs font-extrabold text-[#2F3E4E] shrink-0">
                  3
                </span>
                <div>
                  <span className="font-display font-extrabold text-sm text-[#2F3E4E] block">
                    Deal Sheets &amp; Screenshots
                  </span>
                  <span className="text-[11px] text-[#64748B]">PNG · JPG · PDF · XLSX · CSV</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {targetBadge(3)}
                {shots.length > 0 && <CheckCircle2 className="w-4 h-4 text-[#12805C] shrink-0" />}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] cursor-pointer transition">
                <ImageIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Add Screenshots</span>
                <input
                  type="file"
                  accept="image/*,.pdf,application/pdf,.xlsx,.xls,.csv,.txt"
                  multiple
                  onChange={(e) => {
                    void addDealSheetFiles([...(e.target.files || [])]);
                    e.target.value = '';
                  }}
                  className="sr-only"
                />
              </label>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleBoxPasteButton(3);
                }}
                title="Paste multiple deal-sheet screenshots, PDFs, or text into Box 3"
                className="inline-flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] cursor-pointer transition shrink-0"
              >
                <ClipboardPaste className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Paste</span>
              </button>
            </div>

            {shotBusyMsg ? (
              <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-[#2F3E4E]">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#12805C]" />
                <span className="truncate">{shotBusyMsg}</span>
              </div>
            ) : (
              <p className="mt-2.5 text-[11px] font-medium text-[#475569] leading-relaxed">
                {shots.length > 0
                  ? `${shots.length} deal sheet(s) queued — ${preflight.vinsExtracted} VINs & ${preflight.marginsExtracted} margins extracted.`
                  : 'Hover here & press Ctrl+V repeatedly to paste multiple screenshots. OCR extracts VIN, VCPL Disc & Margin.'}
              </p>
            )}
          </div>
        </div>

        {/* Live Cursor Placement Confirmation Toast */}
        {pasteFeedback && (
          <div
            className={`rounded-xl border px-3.5 py-2 flex items-center justify-between gap-2 text-xs font-bold ${
              pasteFeedback.kind === 'ok'
                ? 'border-[#12805C]/40 bg-[#CEE5DC]/60 text-[#0F5132]'
                : 'border-[#B45309]/35 bg-[#FEF2C8] text-[#78350F]'
            }`}
          >
            <span>
              Box {pasteFeedback.box}: {pasteFeedback.msg}
            </span>
            <button
              type="button"
              onClick={() => setPasteFeedback(null)}
              className="text-[11px] underline cursor-pointer"
            >
              dismiss
            </button>
          </div>
        )}

        {/* Paste Raw Text & Auto-OCR Bar */}
        <div className="border-t border-[#2F3E4E]/15 pt-3.5 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setShowPasteBox((p) => !p)}
            className="inline-flex items-center gap-2 text-xs font-bold text-[#2F3E4E] hover:text-[#12805C] cursor-pointer"
          >
            <ClipboardPaste className="w-4 h-4" aria-hidden="true" />
            <span>
              {showPasteBox
                ? 'Hide Manual Raw Text Editor'
                : 'Open Manual Raw Text Editor (Excel Grid, Ledger Text, Deal Text)'}
            </span>
          </button>

          <label className="inline-flex items-center gap-2 text-xs font-bold text-[#2F3E4E] cursor-pointer">
            <input
              type="checkbox"
              checked={autoOcr}
              onChange={(e) => setAutoOcr(e.target.checked)}
            />
            <ScanText className="w-3.5 h-3.5 text-[#12805C]" aria-hidden="true" />
            <span>Auto-OCR Screenshots &amp; Scanned PDFs</span>
          </label>
        </div>

        {showPasteBox && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-1">
            <div className="rounded-xl border border-[#2F3E4E]/25 bg-white p-4 space-y-2">
              <h3 className="font-display font-bold text-xs text-[#2F3E4E]">
                Box 1: Raw Excel / CSV Grid
              </h3>
              <p className="text-[11px] text-[#64748B]">
                Include header row (VIN, Delivered To, Sold By…). Used when no sheet file is loaded.
              </p>
              <textarea
                rows={4}
                value={pt1}
                onChange={(e) => {
                  setTplFile(null);
                  setPt1(e.target.value);
                }}
                placeholder="Paste tab-separated Excel cells..."
                className="w-full rounded-lg border border-[#2F3E4E]/35 bg-[#FFFDF5] p-2 text-xs text-[#2F3E4E]"
              />
            </div>

            <div className="rounded-xl border border-[#2F3E4E]/25 bg-white p-4 space-y-2">
              <h3 className="font-display font-bold text-xs text-[#2F3E4E]">
                Box 2: Paste Tally Ledger Text
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={pn}
                  onChange={(e) => setPn(e.target.value)}
                  placeholder="Customer name"
                  className="flex-1 min-w-[140px] rounded-lg border border-[#2F3E4E]/35 bg-[#FFFDF5] px-2.5 py-1.5 text-xs text-[#2F3E4E]"
                />
                <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#2F3E4E]">
                  <input
                    type="checkbox"
                    checked={pa}
                    onChange={(e) => setPa(e.target.checked)}
                  />
                  <span>Aftersales</span>
                </label>
              </div>
              <textarea
                rows={3}
                value={pt2}
                onChange={(e) => setPt2(e.target.value)}
                placeholder="27-Nov-25 Cr Life Tax Paid Journal JV/2526/11/248 14,26,238.00"
                className="w-full rounded-lg border border-[#2F3E4E]/35 bg-[#FFFDF5] p-2 text-xs text-[#2F3E4E]"
              />
              <button
                type="button"
                onClick={handleAddLedgerText}
                className="px-3 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] cursor-pointer"
              >
                Add Ledger Text
              </button>
            </div>

            <div className="rounded-xl border border-[#2F3E4E]/25 bg-white p-4 space-y-2">
              <h3 className="font-display font-bold text-xs text-[#2F3E4E]">
                Box 3: Paste Deal-Sheet Text
              </h3>
              <p className="text-[11px] text-[#64748B]">
                Paste deal-sheet text containing VIN, Customer Name, VCPL Discount, and Retained Margin.
              </p>
              <textarea
                rows={4}
                value={pt3}
                onChange={(e) => setPt3(e.target.value)}
                placeholder="Paste deal-sheet text..."
                className="w-full rounded-lg border border-[#2F3E4E]/35 bg-[#FFFDF5] p-2 text-xs text-[#2F3E4E]"
              />
              <button
                type="button"
                onClick={handleAddDealText}
                className="px-3 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] cursor-pointer"
              >
                Add Deal Sheet
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Deal-Sheet Values & OCR Verification Table */}
      {shots.length > 0 && (
        <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 sm:p-6 shadow-[0_4px_0_#2F3E4E] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display font-extrabold text-base text-[#2F3E4E]">
                Deal-Sheet Values &amp; OCR Extraction ({shots.length})
              </h3>
              <p className="text-xs text-[#475569] mt-0.5">
                Click any thumbnail to zoom. OCR auto-fills VIN, Customer, VCPL Discount, and Total Retained Margin. Verify or edit inline.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const blanks = shots.filter(
                    (s) => s.url && (!s.vin || !s.mar)
                  );
                  blanks.forEach((s) => void handleReOcrShot(s));
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Re-OCR Blanks</span>
              </button>
              <button
                type="button"
                onClick={() => setShots([])}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white hover:bg-rose-50 text-xs font-bold text-[#9E2A2B] cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Remove All</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#2F3E4E]/25 bg-white">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#FEF2C8] border-b border-[#2F3E4E]/25 text-[#2F3E4E]">
                  <th className="py-2.5 px-3 font-bold">Preview</th>
                  <th className="py-2.5 px-3 font-bold">VIN</th>
                  <th className="py-2.5 px-3 font-bold">Customer (if no Excel)</th>
                  <th className="py-2.5 px-3 font-bold">VCPL Discount ₹</th>
                  <th className="py-2.5 px-3 font-bold">Total Retained Margin ₹</th>
                  <th className="py-2.5 px-3 font-bold">OCR / Verify</th>
                  <th className="py-2.5 px-3 font-bold text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {shots.map((shot, i) => (
                  <tr key={shot.id} className="border-b border-[#2F3E4E]/10 last:border-0">
                    <td className="py-2.5 px-3 align-top">
                      {shot.url ? (
                        <button
                          type="button"
                          onClick={() => setModalImage(shot.url)}
                          className="group relative block rounded-lg overflow-hidden border border-[#2F3E4E]/35 cursor-zoom-in"
                          title="Click to enlarge deal sheet"
                        >
                          <img
                            src={shot.url}
                            alt={shot.name}
                            className="w-24 h-16 object-cover"
                          />
                          <span className="absolute bottom-1 right-1 p-1 rounded bg-[#2F3E4E]/80 text-white">
                            <ZoomIn className="w-3 h-3" />
                          </span>
                        </button>
                      ) : (
                        <span className="inline-block px-2 py-1 rounded bg-[#FEF2C8] text-[10px] font-mono font-bold text-[#2F3E4E]">
                          {shot.sourceKind}
                        </span>
                      )}
                      <span className="block mt-1 text-[10px] text-[#64748B] truncate max-w-[115px]">
                        {shot.name}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 align-top">
                      <input
                        type="text"
                        value={shot.vin}
                        onChange={(e) => {
                          const val = e.target.value.trim().toUpperCase();
                          setShots((prev) =>
                            prev.map((s, idx) => (idx === i ? { ...s, vin: val } : s))
                          );
                        }}
                        placeholder="WBA…"
                        className="w-full min-w-[155px] px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/35 bg-[#FFFDF5] font-mono text-xs text-[#2F3E4E]"
                      />
                    </td>
                    <td className="py-2.5 px-3 align-top">
                      <input
                        type="text"
                        value={shot.cust}
                        onChange={(e) => {
                          const val = e.target.value;
                          setShots((prev) =>
                            prev.map((s, idx) => (idx === i ? { ...s, cust: val } : s))
                          );
                        }}
                        placeholder="Customer name"
                        className="w-full min-w-[145px] px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/35 bg-[#FFFDF5] text-xs text-[#2F3E4E]"
                      />
                    </td>
                    <td className="py-2.5 px-3 align-top">
                      <input
                        type="number"
                        value={shot.vcpl}
                        onChange={(e) => {
                          const val = e.target.value;
                          setShots((prev) =>
                            prev.map((s, idx) => (idx === i ? { ...s, vcpl: val } : s))
                          );
                        }}
                        placeholder="0"
                        className="w-full min-w-[105px] px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/35 bg-[#FFFDF5] font-mono text-xs text-[#2F3E4E]"
                      />
                    </td>
                    <td className="py-2.5 px-3 align-top">
                      <input
                        type="number"
                        value={shot.mar}
                        onChange={(e) => {
                          const val = e.target.value;
                          setShots((prev) =>
                            prev.map((s, idx) => (idx === i ? { ...s, mar: val } : s))
                          );
                        }}
                        placeholder="0"
                        className="w-full min-w-[115px] px-2.5 py-1.5 rounded-lg border border-[#2F3E4E]/35 bg-[#FFFDF5] font-mono text-xs text-[#2F3E4E]"
                      />
                    </td>
                    <td className="py-2.5 px-3 align-top whitespace-nowrap">
                      {shot.ocrStatus === 'running' || shot.ocrStatus === 'pending' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#FEF2C8] text-[#78350F] text-[10px] font-bold">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>OCR…</span>
                        </span>
                      ) : shot.vin && shot.mar ? (
                        <span className="inline-block px-2 py-0.5 rounded bg-[#CEE5DC] text-[#0F5132] text-[10px] font-bold">
                          ✓ VIN + Margin
                        </span>
                      ) : shot.vin || shot.cust ? (
                        <span className="inline-block px-2 py-0.5 rounded bg-[#FEF2C8] text-[#78350F] text-[10px] font-bold">
                          Partial
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded bg-rose-100 text-rose-900 text-[10px] font-bold">
                          Verify
                        </span>
                      )}
                      {shot.rawText && (
                        <button
                          type="button"
                          onClick={() =>
                            setOcrTextModal({ title: shot.name, text: shot.rawText || '' })
                          }
                          className="mt-1 flex items-center gap-1 text-[10px] font-bold text-[#2F3E4E] hover:text-[#12805C] cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View Text</span>
                        </button>
                      )}
                    </td>
                    <td className="py-2.5 px-3 align-top text-right space-y-1">
                      {shot.url && (
                        <button
                          type="button"
                          onClick={() => void handleReOcrShot(shot)}
                          className="block ml-auto text-[11px] font-bold text-[#2F3E4E] hover:underline cursor-pointer"
                        >
                          Re-OCR
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShots((prev) => prev.filter((_, idx) => idx !== i))}
                        className="block ml-auto text-[11px] font-bold text-[#9E2A2B] hover:underline cursor-pointer"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pre-Flight Verification & Action Card */}
      <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 sm:p-6 shadow-[0_4px_0_#2F3E4E] space-y-4">
        {/* Live Pre-Flight Verification Strip */}
        <div className="rounded-xl border border-[#2F3E4E]/25 bg-white p-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#12805C] shrink-0" aria-hidden="true" />
            <span className="text-xs font-extrabold text-[#2F3E4E]">Pre-Flight Verification:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
            <span className="px-2.5 py-1 rounded-lg border border-[#2F3E4E]/20 bg-[#FFFDF5] text-[#2F3E4E]">
              Sheet:{' '}
              {tplPreview
                ? tplPreview.isValid
                  ? `${tplPreview.rowCount} rows ✓`
                  : 'Missing VIN/Delivered To ✗'
                : 'Auto-build from Ledgers'}
            </span>
            <span
              className={`px-2.5 py-1 rounded-lg border ${
                preflight.unbalancedCount > 0
                  ? 'border-amber-700/35 bg-amber-50 text-amber-900'
                  : 'border-[#2F3E4E]/20 bg-[#CEE5DC]/40 text-[#0F5132]'
              }`}
            >
              Ledgers: {ledgers.length} ({preflight.totalVoucherLines} vouchers ·{' '}
              {preflight.balancedCount} Dr=Cr
              {preflight.unbalancedCount > 0 ? ` · ${preflight.unbalancedCount} warn` : ''})
            </span>
            <span className="px-2.5 py-1 rounded-lg border border-[#2F3E4E]/20 bg-[#FEF2C8]/60 text-[#2F3E4E]">
              Deal Sheets: {shots.length} ({preflight.vinsExtracted} VINs ·{' '}
              {preflight.marginsExtracted} margins
              {preflight.scanningCount > 0 ? ` · ${preflight.scanningCount} scanning` : ''})
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div>
            <label htmlFor="inc-lim" className="block text-[11px] font-bold text-[#475569] mb-1">
              Margin Limit (₹)
            </label>
            <input
              id="inc-lim"
              type="number"
              value={lim}
              onChange={(e) => setLim(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white font-mono text-xs font-semibold text-[#2F3E4E]"
            />
          </div>

          <div>
            <label htmlFor="inc-thr" className="block text-[11px] font-bold text-[#475569] mb-1">
              Customer Name Match ≥ (%)
            </label>
            <input
              id="inc-thr"
              type="number"
              min={30}
              max={100}
              value={thr}
              onChange={(e) => setThr(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white font-mono text-xs font-semibold text-[#2F3E4E]"
            />
          </div>

          <label className="flex items-center gap-2 rounded-lg border border-[#2F3E4E]/25 bg-white px-3 py-2.5 text-xs font-semibold text-[#2F3E4E] cursor-pointer">
            <input type="checkbox" checked={ovr} onChange={(e) => setOvr(e.target.checked)} />
            <span>Overwrite filled cells</span>
          </label>

          <label className="flex items-center gap-2 rounded-lg border border-[#2F3E4E]/25 bg-white px-3 py-2.5 text-xs font-semibold text-[#2F3E4E] cursor-pointer">
            <input type="checkbox" checked={irf} onChange={(e) => setIrf(e.target.checked)} />
            <span>Fill finance &amp; insurance</span>
          </label>
        </div>

        {/* Advanced Rules Toggle */}
        <div className="border-t border-[#2F3E4E]/15 pt-3">
          <button
            type="button"
            onClick={() => setShowAdvanced((s) => !s)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2F3E4E] hover:text-[#12805C] cursor-pointer"
          >
            <Settings2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{showAdvanced ? 'Hide Advanced Rules' : 'Advanced Classification Rules'}</span>
          </button>

          {showAdvanced && (
            <div className="mt-3 rounded-xl border border-[#2F3E4E]/25 bg-white p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-4">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#2F3E4E]">
                  <span>If BSI or EW is not billed, write:</span>
                  <select
                    value={oNone}
                    onChange={(e) => setONone(e.target.value)}
                    className="rounded-lg border border-[#2F3E4E]/40 bg-[#FFFDF5] px-2.5 py-1.5 text-xs font-bold text-[#2F3E4E]"
                  >
                    <option value="FOC">FOC</option>
                    <option value="">leave blank</option>
                    <option value="No">No</option>
                  </select>
                </label>

                <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#2F3E4E] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={oSpares}
                    onChange={(e) => setOSpares(e.target.checked)}
                  />
                  <span>Count “Sale of Spares” as accessories</span>
                </label>
              </div>

              <div>
                <p className="text-[11px] text-[#475569] mb-1.5">
                  Extra ledger keywords (one per line as <code className="font-mono">field=regex</code>
                  , e.g. <code className="font-mono">accessories=GA sale|accessory</code>). Rules are
                  saved automatically on this device.
                </p>
                <textarea
                  rows={3}
                  value={oRules}
                  onChange={(e) => setORules(e.target.value)}
                  placeholder="accessories=GA sale|accessory"
                  className="w-full rounded-lg border border-[#2F3E4E]/35 bg-[#FFFDF5] p-2.5 font-mono text-xs text-[#2F3E4E]"
                />
              </div>
            </div>
          )}
        </div>

        {/* Action & Multi-Format Export Bar */}
        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <button
            type="button"
            disabled={isRunning}
            onClick={handleGenerate}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#F9C80E] hover:bg-[#eab308] text-xs sm:text-sm font-display font-extrabold text-[#2F3E4E] shadow-[0_3px_0_#2F3E4E] transition cursor-pointer disabled:opacity-50"
          >
            <Play className="w-4 h-4 fill-current" aria-hidden="true" />
            <span>{isRunning ? 'Reconciling…' : 'Generate & Verify Report'}</span>
          </button>

          {result && (
            <>
              <button
                type="button"
                onClick={handleDownloadExcel}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#2F3E4E] hover:bg-[#1E293B] text-xs font-bold text-[#F9C80E] shadow-[0_3px_0_#1E293B] transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Excel (.XLSX)</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadPdfReport}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] transition cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                <span>PDF Audit Report</span>
              </button>

              <button
                type="button"
                disabled={exportingPng}
                onClick={handleDownloadReportImage}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#CEE5DC] hover:bg-[#b5d9cb] text-xs font-bold text-[#2F3E4E] transition cursor-pointer disabled:opacity-60"
              >
                <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{exportingPng ? 'Rendering PNG…' : 'Summary Image (.PNG)'}</span>
              </button>

              <button
                type="button"
                onClick={handleCopySummaryForExcel}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] transition cursor-pointer"
              >
                <ClipboardCopy className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Copy Matrix to Excel</span>
              </button>
            </>
          )}

          {statusLog && <span className="text-xs font-semibold text-[#475569]">{statusLog}</span>}
          {copySuccess && (
            <span className="text-xs font-bold text-[#12805C]">{copySuccess}</span>
          )}
        </div>

        {errorMsg && (
          <div className="rounded-xl border border-rose-700/40 bg-rose-50 px-4 py-3 flex items-start gap-2.5 text-xs text-rose-900">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-700" aria-hidden="true" />
            <p className="font-semibold">{errorMsg}</p>
          </div>
        )}
      </div>

      {/* Output Dashboard */}
      {result && (
        <div ref={outRef} className="space-y-6">
          {/* Capturable Visual Report Card (KPIs + SC Summary) */}
          <div
            ref={reportCardRef}
            className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 sm:p-6 shadow-[0_4px_0_#2F3E4E] space-y-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2F3E4E]/15 pb-3">
              <div>
                <h3 className="font-display font-extrabold text-base sm:text-lg text-[#2F3E4E]">
                  Reconciliation Executive Summary
                </h3>
                <p className="text-[11px] text-[#64748B]">
                  Margin Limit ₹{Number(lim).toLocaleString('en-IN')} · Name Match ≥ {thr}%
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-md bg-[#CEE5DC] border border-[#2F3E4E]/30 text-[11px] font-mono font-bold text-[#2F3E4E]">
                {new Date().toLocaleDateString('en-IN')}
              </span>
            </div>

            {/* 5 Summary KPI Tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                ['Cars Processed', String(result.deals.length)],
                ['Ledgers Matched', `${result.usedL} / ${result.total}`],
                [
                  'To Verify (Medium)',
                  String(result.review.filter((x) => x.c === 'Medium').length),
                ],
                [
                  'Missing Fields',
                  String(result.review.filter((x) => x.c === 'Missing').length),
                ],
                ['Audit Alerts', String(result.alerts.length)],
              ].map(([label, val]) => (
                <div
                  key={label}
                  className="bg-white border-[1.5px] border-[#2F3E4E] rounded-xl px-4 py-3 shadow-[0_2px_0_#2F3E4E]"
                >
                  <span className="block text-[11px] font-semibold text-[#64748B]">{label}</span>
                  <strong className="block mt-1 font-display font-extrabold text-lg text-[#2F3E4E] tabular-nums">
                    {val}
                  </strong>
                </div>
              ))}
            </div>

            {/* Sales Consultant Breakdown */}
            {scSummary.length > 0 && (
              <div className="space-y-3 pt-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-display font-extrabold text-sm text-[#2F3E4E]">
                    Breakdown by Sales Consultant
                  </h4>
                  <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-[#475569]">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-[#e45757]" /> Below limit
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-[#12805C]" /> Above limit
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-[#94A3B8]" /> Margin unknown
                    </span>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {scSummary.map(([name, o]) => (
                    <div
                      key={name}
                      className="grid grid-cols-1 md:grid-cols-[150px_1fr_280px] gap-2 md:gap-4 items-center text-xs"
                    >
                      <span className="font-bold text-[#2F3E4E] truncate">{name}</span>
                      <div className="flex h-3.5 rounded-full overflow-hidden border border-[#2F3E4E]/35 bg-[#FEF2C8]">
                        <div
                          style={{ width: `${(o.l / maxScCount) * 100}%` }}
                          className="bg-[#e45757]"
                        />
                        <div
                          style={{ width: `${(o.a / maxScCount) * 100}%` }}
                          className="bg-[#12805C]"
                        />
                        <div
                          style={{ width: `${((o.n - o.l - o.a) / maxScCount) * 100}%` }}
                          className="bg-[#94A3B8]"
                        />
                      </div>
                      <span className="font-mono text-[11px] text-[#475569] tabular-nums">
                        {o.n} cars · {o.l} below limit · VCPL ₹{o.v.toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Live Reconciled Deals Matrix */}
          {dealsMatrix.length > 0 && (
            <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 sm:p-6 shadow-[0_4px_0_#2F3E4E] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-display font-extrabold text-base text-[#2F3E4E]">
                    Reconciled Deals Matrix ({dealsMatrix.length})
                  </h3>
                  <p className="text-xs text-[#475569]">
                    Live view of reconciled rows. Edits below immediately sync here and into Excel / PDF exports.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-[#2F3E4E]/25 bg-white">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#FEF2C8] border-b border-[#2F3E4E]/25 text-[#2F3E4E]">
                      <th className="py-2 px-3 font-bold">Customer</th>
                      <th className="py-2 px-3 font-bold">VIN</th>
                      <th className="py-2 px-3 font-bold">Sold By</th>
                      <th className="py-2 px-3 font-bold">Booking Dt</th>
                      <th className="py-2 px-3 font-bold">Booking ₹</th>
                      <th className="py-2 px-3 font-bold">TR/PR Dt</th>
                      <th className="py-2 px-3 font-bold">VCPL Disc ₹</th>
                      <th className="py-2 px-3 font-bold">Acc Amt ₹</th>
                      <th className="py-2 px-3 font-bold">BSI / EW</th>
                      <th className="py-2 px-3 font-bold">Margin</th>
                      <th className="py-2 px-3 font-bold text-center">Ledgers</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dealsMatrix.map((d) => (
                      <tr key={d.row} className="border-b border-[#2F3E4E]/10 last:border-0">
                        <td className="py-2 px-3 font-bold text-[#2F3E4E]">{d.cust}</td>
                        <td className="py-2 px-3 font-mono text-[11px] text-[#475569]">{d.vin || '-'}</td>
                        <td className="py-2 px-3 text-[#2F3E4E]">{d.sc}</td>
                        <td className="py-2 px-3 font-mono text-[11px]">{d.bookingDate}</td>
                        <td className="py-2 px-3 font-mono text-[11px] tabular-nums">{d.bookingAmt}</td>
                        <td className="py-2 px-3 font-mono text-[11px]">{d.trprDate}</td>
                        <td className="py-2 px-3 font-mono text-[11px] tabular-nums">{d.vcplDisc}</td>
                        <td className="py-2 px-3 font-mono text-[11px] tabular-nums">{d.accAmt}</td>
                        <td className="py-2 px-3 text-[11px]">
                          {d.bsi} / {d.ew}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                              /less/i.test(d.marginFlag)
                                ? 'bg-rose-100 text-rose-900'
                                : /above/i.test(d.marginFlag)
                                ? 'bg-[#CEE5DC] text-[#0F5132]'
                                : 'bg-[#FEF2C8] text-[#78350F]'
                            }`}
                          >
                            {d.marginFlag}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center font-mono font-bold">{d.ledgersMatched}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Checks & Alerts */}
          <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 sm:p-6 shadow-[0_4px_0_#2F3E4E] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display font-extrabold text-base text-[#2F3E4E]">
                Audit Checks ({result.alerts.length}{' '}
                {result.alerts.length === 1 ? 'alert' : 'alerts'})
              </h3>
              {result.checks.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowChecksDetail((s) => !s)}
                  className="text-xs font-bold text-[#2F3E4E] underline underline-offset-2 hover:text-[#12805C] cursor-pointer"
                >
                  {showChecksDetail
                    ? 'Hide Ledger Balance Checks'
                    : `Show Ledger Balance Checks (${result.checks.length})`}
                </button>
              )}
            </div>

            {result.alerts.length === 0 ? (
              <div className="rounded-xl border border-[#12805C]/30 bg-[#CEE5DC]/50 px-3.5 py-2.5 text-xs font-semibold text-[#0F5132]">
                All balance and margin checks passed cleanly.
              </div>
            ) : (
              <div className="space-y-1.5">
                {result.alerts.map(([sev, msg], i) => (
                  <div
                    key={i}
                    className={`rounded-xl border px-3.5 py-2 text-xs font-medium ${
                      sev === 'High'
                        ? 'border-rose-700/35 bg-rose-50 text-rose-900'
                        : 'border-amber-700/35 bg-amber-50 text-amber-900'
                    }`}
                  >
                    {msg}
                  </div>
                ))}
              </div>
            )}

            {showChecksDetail && result.checks.length > 0 && (
              <div className="pt-2 border-t border-[#2F3E4E]/15 space-y-1">
                {result.checks.map((c) => (
                  <p key={c.file} className="text-[11px] font-mono text-[#475569]">
                    {c.ok ? '✓' : '✗'} [{c.sourceKind || 'pdf'}] {c.file}: {c.n} lines · Dr ₹
                    {c.dr.toLocaleString('en-IN')} · Cr ₹{c.cr.toLocaleString('en-IN')}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Editable Review Table */}
          <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 sm:p-6 shadow-[0_4px_0_#2F3E4E] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display font-extrabold text-base text-[#2F3E4E]">
                  Inline Review &amp; Cell Editor
                </h3>
                <p className="text-xs text-[#475569]">
                  Edit any value directly below. Updated cells are written into the exported Excel &amp; PDF and marked as Edited.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2F3E4E] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={onlyAttention}
                    onChange={(e) => setOnlyAttention(e.target.checked)}
                  />
                  <span>Needs attention only</span>
                </label>

                <select
                  value={confFilter}
                  onChange={(e) => setConfFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white text-xs font-bold text-[#2F3E4E]"
                >
                  <option value="">All confidence</option>
                  <option value="Missing">Missing</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Edited">Edited</option>
                </select>

                <div className="relative">
                  <Search
                    className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#64748B]"
                    aria-hidden="true"
                  />
                  <input
                    type="text"
                    value={searchQ}
                    onChange={(e) => setSearchQ(e.target.value)}
                    placeholder="Search customer or field…"
                    className="pl-8 pr-3 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white text-xs text-[#2F3E4E]"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[#2F3E4E]/25 bg-white">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#FEF2C8] border-b border-[#2F3E4E]/25 text-[#2F3E4E]">
                    <th className="py-2.5 px-3 font-bold">Customer</th>
                    <th className="py-2.5 px-3 font-bold">Field</th>
                    <th className="py-2.5 px-3 font-bold">Value (Editable)</th>
                    <th className="py-2.5 px-3 font-bold">Confidence</th>
                    <th className="py-2.5 px-3 font-bold">Evidence &amp; Note</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleReviewRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 px-4 text-center text-[#64748B]">
                        Nothing to show under the current filter. Uncheck “Needs attention only” to
                        inspect all verified fields.
                      </td>
                    </tr>
                  ) : (
                    visibleReviewRows.map(({ item, idx }) => (
                      <tr
                        key={`${item.row}-${item.col}-${idx}`}
                        className="border-b border-[#2F3E4E]/10 last:border-0"
                      >
                        <td className="py-2 px-3 font-semibold text-[#2F3E4E]">{item.cust}</td>
                        <td className="py-2 px-3 font-mono text-[11px] text-[#475569]">{item.f}</td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            defaultValue={item.v}
                            key={`${idx}-${item.v}-${item.c}`}
                            onBlur={(e) => {
                              if (e.target.value !== item.v) {
                                handleReviewCellChange(idx, e.target.value);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            className="w-full min-w-[130px] px-2.5 py-1 rounded-lg border border-[#2F3E4E]/35 bg-[#FFFDF5] text-xs font-semibold text-[#2F3E4E]"
                          />
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${
                              item.c === 'High'
                                ? 'bg-[#CEE5DC] text-[#0F5132] border-[#12805C]/30'
                                : item.c === 'Medium'
                                ? 'bg-[#FEF2C8] text-[#78350F] border-[#B45309]/30'
                                : item.c === 'Edited'
                                ? 'bg-[#E0E7FF] text-[#1E3A8A] border-[#1D4ED8]/30'
                                : 'bg-rose-100 text-rose-900 border-rose-700/30'
                            }`}
                          >
                            {item.c}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-[#475569]">{item.n}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Enlarge Deal-Sheet / Ledger Image Modal */}
      {modalImage && (
        <div
          className="fixed inset-0 z-50 bg-[#2F3E4E]/80 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setModalImage(null)}
        >
          <div
            className="relative max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl border-2 border-[#2F3E4E] bg-[#FFFDF5] p-3 flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setModalImage(null)}
              aria-label="Close enlarged preview"
              className="absolute top-3 right-3 z-10 inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[#2F3E4E] text-[#F9C80E] cursor-pointer shadow-sm"
            >
              <X className="w-4 h-4" />
            </button>
            <img
              src={modalImage}
              alt="Enlarged document preview"
              className="max-w-full max-h-[calc(90vh-1.5rem)] w-auto h-auto object-contain rounded-xl"
            />
          </div>
        </div>
      )}

      {/* Inspect OCR Extracted Raw Text Modal */}
      {ocrTextModal && (
        <div
          className="fixed inset-0 z-50 bg-[#2F3E4E]/80 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setOcrTextModal(null)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border-2 border-[#2F3E4E] bg-[#FFFDF5] p-5 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-display font-extrabold text-sm text-[#2F3E4E]">
                Extracted Text: {ocrTextModal.title}
              </h4>
              <button
                type="button"
                onClick={() => setOcrTextModal(null)}
                aria-label="Close extracted text"
                className="w-8 h-8 rounded-lg bg-[#2F3E4E] text-[#F9C80E] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <pre className="max-h-96 overflow-auto rounded-xl border border-[#2F3E4E]/25 bg-white p-3 text-xs font-mono text-[#2F3E4E] whitespace-pre-wrap">
              {ocrTextModal.text}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
