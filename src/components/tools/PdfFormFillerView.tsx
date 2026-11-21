import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  AlertCircle,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Download,
  FilePlus2,
  FileText,
  History,
  Image as ImageIcon,
  Lock,
  PenTool,
  RotateCcw,
  Save,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Type,
  Upload,
  UserCheck,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { ToolCatalogItem } from '../../types/tools';
import { CombCell, DarkMask, DetectedTarget, combLetters, detectAt, makeMask } from '../../utils/formFillerDetect';
import {
  CombFormItem,
  FORM_FILLER_INKS,
  FORM_FILLER_MASK_SCALE,
  FORM_FILLER_MAX_PAGES,
  FormItem,
  FormPageMeta,
  FormToolType,
  ImgFormItem,
  LoadedFormImage,
  MY_DETAILS_FIELDS,
  MarkFormItem,
  StoredFormSession,
  TextFormItem,
  buildPictureFilledPdf,
  buildVectorFilledPdf,
  clampVal,
  cleanPaperCanvas,
  drawFormItem,
  extractSignatureInkCanvas,
  fileToHtmlImage,
  fitFilledPdfToMaxBytes,
  formFillerIdb,
  formItemBbox,
  formatBytesHuman,
  loadHtmlImage,
  measureFormTextWidth,
  todayDmy,
  uid,
} from '../../utils/formFillerPdf';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface PdfFormFillerViewProps {
  tool: ToolCatalogItem;
}

const LS_INK_KEY = 'vcpl-formfiller-ink-v1';
const LS_SIGN_KEY = 'vcpl-formfiller-sign-v1';
const LS_DETAILS_KEY = 'vcpl-formfiller-details-v1';
const ZOOM_STEPS = [1, 1.6, 2.4] as const;
const TARGET_KB_PRESETS = [
  { label: 'Under 100 KB', bytes: 100 * 1024 },
  { label: 'Under 200 KB', bytes: 200 * 1024 },
  { label: 'Under 300 KB', bytes: 300 * 1024 },
  { label: 'Under 500 KB', bytes: 500 * 1024 },
  { label: 'Under 1 MB', bytes: 1024 * 1024 },
] as const;

interface PendingPlacement {
  page: number;
  xp: number;
  yp: number;
  target: DetectedTarget;
}

interface ExportResultState {
  blob: Blob;
  previewUrl: string;
  fileName: string;
  mode: 'vector' | 'picture';
  targetBytes: number | null;
}

interface CropDraft {
  img: HTMLImageElement;
  aspect: number; // width / height
  placement: PendingPlacement;
}

export const PdfFormFillerView: React.FC<PdfFormFillerViewProps> = ({ tool }) => {
  // Document & Engine State
  const [docKind, setDocKind] = useState<'pdf' | 'image' | null>(null);
  const [docName, setDocName] = useState<string>('');
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [cleanPhotoSrc, setCleanPhotoSrc] = useState<string | null>(null);
  const [cleanPhotoEl, setCleanPhotoEl] = useState<HTMLImageElement | null>(null);
  const [pagesMeta, setPagesMeta] = useState<FormPageMeta[]>([]);
  const [items, setItems] = useState<FormItem[]>([]);
  const [undoStack, setUndoStack] = useState<FormItem[][]>([]);
  const [images, setImages] = useState<Record<string, LoadedFormImage>>({});

  // Preferences & Tools
  const [activeTool, setActiveTool] = useState<FormToolType>('text');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ink, setInk] = useState<string>(() => {
    try {
      return localStorage.getItem(LS_INK_KEY) || FORM_FILLER_INKS[0].c;
    } catch {
      return FORM_FILLER_INKS[0].c;
    }
  });
  const [zoomIdx, setZoomIdx] = useState<number>(0);
  const zoom = ZOOM_STEPS[zoomIdx];

  const [savedSignSrc, setSavedSignSrc] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LS_SIGN_KEY);
    } catch {
      return null;
    }
  });
  const [myDetails, setMyDetails] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem(LS_DETAILS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  // UI & Modal States
  const [isLoading, setIsLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState('Opening form...');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resumeSession, setResumeSession] = useState<StoredFormSession | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const [passwordPrompt, setPasswordPrompt] = useState<{
    bytes: Uint8Array;
    name: string;
    savedItems?: FormItem[];
    savedImages?: Record<string, string>;
    wrongPassword?: boolean;
  } | null>(null);
  const [passwordInput, setPasswordInput] = useState('');

  const [signModalOpen, setSignModalOpen] = useState(false);
  const [signTab, setSignTab] = useState<'draw' | 'photo'>('draw');
  const [signExtractedDataUrl, setSignExtractedDataUrl] = useState<string | null>(null);
  const [pendingPlacement, setPendingPlacement] = useState<PendingPlacement | null>(null);

  const [cropDraft, setCropDraft] = useState<CropDraft | null>(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffset, setCropOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [cropAspectIdx, setCropAspectIdx] = useState<number>(0);

  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailsDraft, setDetailsDraft] = useState<Record<string, string>>({});

  const [exportState, setExportState] = useState<ExportResultState | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  // Refs for DOM elements, PDF proxy, mask cache, and drag interactions
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const signPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const typeInputRef = useRef<HTMLInputElement | null>(null);
  const signPadRef = useRef<HTMLCanvasElement | null>(null);
  const cropCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const maskCacheRef = useRef<Map<number, Promise<DarkMask>>>(new Map());
  const baseCanvasRefs = useRef<Record<number, HTMLCanvasElement | null>>({});
  const inkCanvasRefs = useRef<Record<number, HTMLCanvasElement | null>>({});
  const layerRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const signDrawingRef = useRef<{ active: boolean; lastX: number; lastY: number; hasStroke: boolean }>({
    active: false,
    lastX: 0,
    lastY: 0,
    hasStroke: false,
  });

  const dragRef = useRef<{
    mode: 'move' | 'resize';
    itemId: string;
    pageIdx: number;
    startXp: number;
    startYp: number;
    origItem: FormItem;
  } | null>(null);

  const cropDragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  }>({ active: false, startX: 0, startY: 0, origX: 0, origY: 0 });

  // Load any previously saved IndexedDB form session on mount
  useEffect(() => {
    let mounted = true;
    formFillerIdb.get('last').then((s) => {
      if (mounted && s && s.name && (s.bytes || s.imgSrc)) {
        setResumeSession(s);
      }
    });
    return () => {
      mounted = false;
      pdfDocRef.current?.cleanup();
    };
  }, []);

  // Persist ink choice
  useEffect(() => {
    try {
      localStorage.setItem(LS_INK_KEY, ink);
    } catch {
      // Ignore storage failures
    }
  }, [ink]);

  // Auto-save active session to IndexedDB (debounced)
  useEffect(() => {
    if (!docKind || !docName) return;
    const timer = window.setTimeout(() => {
      const serImages: Record<string, string> = {};
      for (const [k, v] of Object.entries(images)) {
        serImages[k] = v.src;
      }
      formFillerIdb.put('last', {
        name: docName,
        kind: docKind,
        bytes: docKind === 'pdf' ? pdfBytes : null,
        imgSrc: docKind === 'image' ? cleanPhotoSrc : null,
        items,
        images: serImages,
        at: Date.now(),
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [docKind, docName, pdfBytes, cleanPhotoSrc, items, images]);

  // Selected item lookup
  const selectedItem = useMemo(
    () => items.find((it) => it.id === selectedId) ?? null,
    [items, selectedId]
  );

  const selectedCombOverflow = useMemo(() => {
    if (!selectedItem || selectedItem.type !== 'comb') return false;
    return combLetters(selectedItem.text, selectedItem.cells).over;
  }, [selectedItem]);

  const populatedDetailFields = useMemo(
    () => MY_DETAILS_FIELDS.filter((f) => Boolean(myDetails[f.key]?.trim())),
    [myDetails]
  );

  // Push snapshot onto Undo stack (max 80 entries)
  const pushUndo = useCallback((snapshot: FormItem[]) => {
    setUndoStack((prev) => [...prev.slice(-79), structuredClone(snapshot)]);
  }, []);

  const handleUndo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const previous = prev[prev.length - 1];
      setItems(previous);
      setSelectedId((cur) => (cur && previous.some((i) => i.id === cur) ? cur : null));
      return prev.slice(0, -1);
    });
  }, []);

  // Keyboard shortcuts (Undo Ctrl/Cmd+Z, Delete selected item)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inInput =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !inInput) {
        e.preventDefault();
        handleUndo();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && !inInput && selectedId) {
        e.preventDefault();
        pushUndo(items);
        setItems((prev) => prev.filter((it) => it.id !== selectedId));
        setSelectedId(null);
      } else if (e.key === 'Escape') {
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, items, pushUndo, selectedId]);

  // Rehydrate serialized image map
  const loadSavedImagesMap = async (rawMap?: Record<string, string>) => {
    const loaded: Record<string, LoadedFormImage> = {};
    if (!rawMap) return loaded;
    await Promise.all(
      Object.entries(rawMap).map(async ([k, src]) => {
        try {
          const img = await loadHtmlImage(src);
          loaded[k] = { src, img };
        } catch {
          // Skip broken image entry
        }
      })
    );
    return loaded;
  };

  // Open a PDF from bytes
  const openPdfDocument = useCallback(
    async (
      rawBytes: Uint8Array,
      fileName: string,
      password?: string,
      savedItems?: FormItem[],
      savedImages?: Record<string, string>
    ) => {
      setIsLoading(true);
      setLoadingLabel('Preparing form pages...');
      setErrorMsg(null);
      try {
        const bytesCopy = new Uint8Array(rawBytes);
        const task = pdfjsLib.getDocument({ data: bytesCopy, password });
        const doc = await task.promise;

        pdfDocRef.current?.cleanup();
        pdfDocRef.current = doc;
        maskCacheRef.current.clear();

        const totalPages = Math.min(doc.numPages, FORM_FILLER_MAX_PAGES);
        const metaList: FormPageMeta[] = [];
        for (let i = 0; i < totalPages; i++) {
          const page = await doc.getPage(i + 1);
          const vp = page.getViewport({ scale: 1 });
          metaList.push({
            i,
            w: vp.width,
            h: vp.height,
            page,
            vpTransform: Array.from(vp.transform),
          });
        }

        const loadedImgs = await loadSavedImagesMap(savedImages);

        setDocKind('pdf');
        setDocName(fileName);
        setPdfBytes(new Uint8Array(rawBytes));
        setCleanPhotoSrc(null);
        setCleanPhotoEl(null);
        setPagesMeta(metaList);
        setImages(loadedImgs);
        setItems(savedItems ? structuredClone(savedItems) : []);
        setUndoStack([]);
        setSelectedId(null);
        setZoomIdx(0);
        setPasswordPrompt(null);
        setPasswordInput('');

        if (doc.numPages > FORM_FILLER_MAX_PAGES) {
          setErrorMsg(
            `This PDF has ${doc.numPages} pages. Showing the first ${FORM_FILLER_MAX_PAGES} pages for smooth browser performance.`
          );
        }
      } catch (err: unknown) {
        const pdfErr = err as { name?: string; code?: number; message?: string };
        if (pdfErr?.name === 'PasswordException') {
          setPasswordPrompt({
            bytes: new Uint8Array(rawBytes),
            name: fileName,
            savedItems,
            savedImages,
            wrongPassword: pdfErr.code === pdfjsLib.PasswordResponses.INCORRECT_PASSWORD,
          });
        } else {
          setErrorMsg(pdfErr?.message || 'Unable to open this PDF file.');
        }
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Open a camera/scanned form photo and remove uneven paper lighting
  const openImageForm = useCallback(
    async (
      source: File | string,
      fileName: string,
      savedItems?: FormItem[],
      savedImages?: Record<string, string>
    ) => {
      setIsLoading(true);
      setLoadingLabel('Cleaning paper lighting & shadows...');
      setErrorMsg(null);
      try {
        let imgEl: HTMLImageElement;
        let finalSrc: string;

        if (typeof source === 'string') {
          finalSrc = source;
          imgEl = await loadHtmlImage(source);
        } else {
          const rawImg = await fileToHtmlImage(source);
          const maxDim = 2200;
          const sc = Math.min(1, maxDim / Math.max(rawImg.naturalWidth, rawImg.naturalHeight));
          const c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(rawImg.naturalWidth * sc));
          c.height = Math.max(1, Math.round(rawImg.naturalHeight * sc));
          const g = c.getContext('2d');
          if (g) {
            g.drawImage(rawImg, 0, 0, c.width, c.height);
            cleanPaperCanvas(c);
          }
          finalSrc = c.toDataURL('image/jpeg', 0.92);
          imgEl = await loadHtmlImage(finalSrc);
        }

        pdfDocRef.current?.cleanup();
        pdfDocRef.current = null;
        maskCacheRef.current.clear();

        const targetW = 595.28; // A4 reference width in points
        const targetH = (imgEl.naturalHeight / imgEl.naturalWidth) * targetW;
        const loadedImgs = await loadSavedImagesMap(savedImages);

        setDocKind('image');
        setDocName(fileName);
        setPdfBytes(null);
        setCleanPhotoSrc(finalSrc);
        setCleanPhotoEl(imgEl);
        setPagesMeta([{ i: 0, w: targetW, h: targetH }]);
        setImages(loadedImgs);
        setItems(savedItems ? structuredClone(savedItems) : []);
        setUndoStack([]);
        setSelectedId(null);
        setZoomIdx(0);
      } catch (err: unknown) {
        setErrorMsg(
          err instanceof Error ? err.message : 'Unable to process this form image.'
        );
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Unified file entry handler
  const handlePickedFile = async (file: File | undefined) => {
    if (!file) return;
    setErrorMsg(null);
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (isPdf) {
      const buf = new Uint8Array(await file.arrayBuffer());
      await openPdfDocument(buf, file.name);
    } else if (file.type.startsWith('image/')) {
      await openImageForm(file, file.name);
    } else {
      setErrorMsg('Please select a PDF document or a JPG / PNG form photo.');
    }
  };

  const handleResumeSavedSession = async () => {
    if (!resumeSession) return;
    if (resumeSession.kind === 'pdf' && resumeSession.bytes) {
      await openPdfDocument(
        resumeSession.bytes,
        resumeSession.name,
        undefined,
        resumeSession.items,
        resumeSession.images
      );
    } else if (resumeSession.kind === 'image' && resumeSession.imgSrc) {
      await openImageForm(
        resumeSession.imgSrc,
        resumeSession.name,
        resumeSession.items,
        resumeSession.images
      );
    }
  };

  const handleDiscardSavedSession = async () => {
    await formFillerIdb.del('last');
    setResumeSession(null);
  };

  // DarkMask getter (cached promise per page at FORM_FILLER_MASK_SCALE)
  const getPageMask = useCallback(
    (pageIdx: number): Promise<DarkMask> | null => {
      const existing = maskCacheRef.current.get(pageIdx);
      if (existing) return existing;

      const meta = pagesMeta[pageIdx];
      if (!meta) return null;

      const promise = (async () => {
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(meta.w * FORM_FILLER_MASK_SCALE));
        c.height = Math.max(1, Math.round(meta.h * FORM_FILLER_MASK_SCALE));
        const g = c.getContext('2d');
        if (!g) return makeMask(new ImageData(1, 1));
        g.fillStyle = '#fff';
        g.fillRect(0, 0, c.width, c.height);

        if (docKind === 'pdf' && meta.page) {
          const vp = meta.page.getViewport({ scale: FORM_FILLER_MASK_SCALE });
          await meta.page.render({ canvasContext: g as any, canvas: c, viewport: vp, intent: 'print' } as any)
            .promise;
        } else if (docKind === 'image' && cleanPhotoEl) {
          g.drawImage(cleanPhotoEl, 0, 0, c.width, c.height);
        }
        return makeMask(g.getImageData(0, 0, c.width, c.height));
      })();

      maskCacheRef.current.set(pageIdx, promise);
      return promise;
    },
    [cleanPhotoEl, docKind, pagesMeta]
  );

  // Render crisp base page canvases whenever pagesMeta or zoom changes
  useEffect(() => {
    if (!docKind || pagesMeta.length === 0) return;
    let cancelled = false;
    const renderScale = Math.min(3, (window.devicePixelRatio || 1) * zoom);

    pagesMeta.forEach(async (meta) => {
      const c = baseCanvasRefs.current[meta.i];
      if (!c) return;
      const targetW = Math.max(1, Math.round(meta.w * renderScale));
      const targetH = Math.max(1, Math.round(meta.h * renderScale));
      c.width = targetW;
      c.height = targetH;
      const g = c.getContext('2d');
      if (!g) return;
      g.fillStyle = '#fff';
      g.fillRect(0, 0, targetW, targetH);

      if (docKind === 'pdf' && meta.page) {
        const vp = meta.page.getViewport({ scale: renderScale });
        try {
          await meta.page.render({
            canvasContext: g as any,
            canvas: c,
            viewport: vp,
            intent: 'print',
          } as any).promise;
        } catch {
          // Ignore cancelled render on quick zoom change
        }
      } else if (docKind === 'image' && cleanPhotoEl && !cancelled) {
        g.imageSmoothingQuality = 'high';
        g.drawImage(cleanPhotoEl, 0, 0, targetW, targetH);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [cleanPhotoEl, docKind, pagesMeta, zoom]);

  // Render live ink overlay canvases whenever items, images, or zoom changes
  useEffect(() => {
    if (!docKind || pagesMeta.length === 0) return;
    const renderScale = Math.min(3, (window.devicePixelRatio || 1) * zoom);

    pagesMeta.forEach((meta) => {
      const c = inkCanvasRefs.current[meta.i];
      if (!c) return;
      const targetW = Math.max(1, Math.round(meta.w * renderScale));
      const targetH = Math.max(1, Math.round(meta.h * renderScale));
      if (c.width !== targetW || c.height !== targetH) {
        c.width = targetW;
        c.height = targetH;
      }
      const g = c.getContext('2d');
      if (!g) return;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, c.width, c.height);
      g.scale(renderScale, renderScale);
      for (const it of items) {
        if (it.page === meta.i) {
          drawFormItem(g, it, images);
        }
      }
    });
  }, [docKind, images, items, pagesMeta, zoom]);

  // Helper to update selected text item text with automatic maxW fit-to-box/line shrinking
  const updateSelectedTextValue = useCallback(
    (newText: string) => {
      if (!selectedId) return;
      setItems((prev) =>
        prev.map((it) => {
          if (it.id !== selectedId) return it;
          if (it.type === 'comb') {
            return { ...it, text: newText };
          }
          if (it.type === 'text') {
            let nextSize = it.base;
            if (it.maxW && newText) {
              const widthAtBase = measureFormTextWidth(newText, it.base);
              if (widthAtBase > it.maxW) {
                nextSize = clampVal((it.base * it.maxW) / widthAtBase, 6.5, it.base);
              }
            }
            return { ...it, text: newText, size: nextSize };
          }
          return it;
        })
      );
    },
    [selectedId]
  );

  // Step font size on text item
  const nudgeSelectedFontSize = (delta: number) => {
    if (!selectedItem || selectedItem.type !== 'text') return;
    pushUndo(items);
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== selectedItem.id || it.type !== 'text') return it;
        const nextBase = clampVal(it.base + delta, 6.5, 42);
        return { ...it, base: nextBase, size: nextBase };
      })
    );
  };

  // Focus typing bar input synchronously after creating or selecting a text/comb item
  const focusTypingInputSync = () => {
    window.requestAnimationFrame(() => {
      typeInputRef.current?.focus();
    });
  };

  // Register an image dataURL and create an ImgFormItem at placement
  const placeImageAtTarget = useCallback(
    async (dataUrl: string, kind: 'sign' | 'photo', placement: PendingPlacement) => {
      const img = await loadHtmlImage(dataUrl);
      const imgId = uid();
      setImages((prev) => ({ ...prev, [imgId]: { src: dataUrl, img } }));

      let x = placement.xp;
      let y = placement.yp;
      let w = kind === 'sign' ? 110 : 88;
      let h = (w * img.naturalHeight) / Math.max(1, img.naturalWidth);

      if (placement.target.kind === 'box') {
        const b = placement.target;
        const pad = Math.min(4, b.w * 0.06, b.h * 0.06);
        const availW = Math.max(16, b.w - pad * 2);
        const availH = Math.max(16, b.h - pad * 2);
        const scale = Math.min(availW / img.naturalWidth, availH / img.naturalHeight);
        w = img.naturalWidth * scale;
        h = img.naturalHeight * scale;
        x = b.x + (b.w - w) / 2;
        y = b.y + (b.h - h) / 2;
      } else {
        x = placement.xp - w / 2;
        y = placement.yp - h / 2;
      }

      const newItem: ImgFormItem = {
        id: uid(),
        type: 'img',
        kind,
        page: placement.page,
        imgId,
        x,
        y,
        w,
        h,
        ink,
      };
      pushUndo(items);
      setItems((prev) => [...prev, newItem]);
      setSelectedId(newItem.id);
    },
    [ink, items, pushUndo]
  );

  // Handle tapping onto blank form surface
  const handleSurfaceTap = async (pageIdx: number, xp: number, yp: number) => {
    const meta = pagesMeta[pageIdx];
    if (!meta) return;

    const maskPromise = getPageMask(pageIdx);
    const mask = maskPromise ? await maskPromise : null;
    const target: DetectedTarget = mask
      ? detectAt(mask, FORM_FILLER_MASK_SCALE, xp, yp)
      : { kind: 'free' };

    if (activeTool === 'text' || activeTool === 'date') {
      const initialText = activeTool === 'date' ? todayDmy() : '';
      let created: FormItem;

      if (target.kind === 'comb') {
        const cellH = target.h;
        const size = clampVal(cellH * 0.68, 7, 22);
        created = {
          id: uid(),
          type: 'comb',
          page: pageIdx,
          cells: target.cells,
          y: target.y,
          h: target.h,
          size,
          text: initialText,
          ink,
        } satisfies CombFormItem;
      } else if (target.kind === 'box') {
        const size = clampVal(target.h * 0.52, 8, 15);
        created = {
          id: uid(),
          type: 'text',
          page: pageIdx,
          x: target.x + 4,
          y: target.y + target.h * 0.68,
          size,
          base: size,
          maxW: Math.max(24, target.w - 8),
          text: initialText,
          ink,
        } satisfies TextFormItem;
      } else if (target.kind === 'line') {
        const size = 11;
        const startX = clampVal(xp - 6, target.x, Math.max(target.x, target.x1 - 24));
        created = {
          id: uid(),
          type: 'text',
          page: pageIdx,
          x: startX,
          y: target.y - 2.5,
          size,
          base: size,
          maxW: Math.max(36, target.x1 - startX),
          text: initialText,
          ink,
        } satisfies TextFormItem;
      } else {
        const size = 11;
        created = {
          id: uid(),
          type: 'text',
          page: pageIdx,
          x: xp,
          y: yp + 4,
          size,
          base: size,
          text: initialText,
          ink,
        } satisfies TextFormItem;
      }

      pushUndo(items);
      setItems((prev) => [...prev, created]);
      setSelectedId(created.id);
      if (activeTool === 'text') {
        focusTypingInputSync();
      } else {
        setActiveTool('text');
      }
      return;
    }

    if (activeTool === 'tick' || activeTool === 'cross') {
      let x = xp - 8;
      let y = yp - 8;
      let w = 16;
      let h = 16;

      if (target.kind === 'box') {
        const s = clampVal(Math.min(target.w, target.h) * 0.8, 10, 28);
        w = s;
        h = s;
        x = target.x + (target.w - w) / 2;
        y = target.y + (target.h - h) / 2;
      } else if (target.kind === 'comb') {
        const cell = target.cells[target.tap] || target.cells[0];
        const s = clampVal(Math.min(cell.w, target.h) * 0.8, 10, 24);
        w = s;
        h = s;
        x = cell.x + (cell.w - w) / 2;
        y = target.y + (target.h - h) / 2;
      }

      const markItem: MarkFormItem = {
        id: uid(),
        type: 'mark',
        glyph: activeTool,
        page: pageIdx,
        x,
        y,
        w,
        h,
        ink,
      };
      pushUndo(items);
      setItems((prev) => [...prev, markItem]);
      setSelectedId(markItem.id);
      return;
    }

    if (activeTool === 'sign') {
      const placement: PendingPlacement = { page: pageIdx, xp, yp, target };
      if (savedSignSrc) {
        await placeImageAtTarget(savedSignSrc, 'sign', placement);
        setActiveTool('text');
      } else {
        setPendingPlacement(placement);
        setSignExtractedDataUrl(null);
        setSignModalOpen(true);
      }
      return;
    }

    if (activeTool === 'photo') {
      setPendingPlacement({ page: pageIdx, xp, yp, target });
    }
  };

  // Page pointer down (either blank tap or start drag on selected item)
  const onLayerPointerDown = (e: React.PointerEvent<HTMLDivElement>, pageIdx: number) => {
    if (e.button !== 0) return;
    const layer = layerRefs.current[pageIdx];
    const meta = pagesMeta[pageIdx];
    if (!layer || !meta) return;

    const rect = layer.getBoundingClientRect();
    const xp = ((e.clientX - rect.left) / rect.width) * meta.w;
    const yp = ((e.clientY - rect.top) / rect.height) * meta.h;

    // Check if tapping on any existing item on this page (topmost first)
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (it.page !== pageIdx) continue;
      const bb = formItemBbox(it);
      if (xp >= bb.x - 3 && xp <= bb.x + bb.w + 3 && yp >= bb.y - 3 && yp <= bb.y + bb.h + 3) {
        e.stopPropagation();
        setSelectedId(it.id);
        pushUndo(items);
        dragRef.current = {
          mode: 'move',
          itemId: it.id,
          pageIdx,
          startXp: xp,
          startYp: yp,
          origItem: structuredClone(it),
        };
        if (it.type === 'text' || it.type === 'comb') {
          focusTypingInputSync();
        }
        return;
      }
    }

    // Clicked blank space
    if (selectedId && items.find((it) => it.id === selectedId && it.type === 'text' && !it.text)) {
      // Remove empty abandoned text box cleanly
      setItems((prev) => prev.filter((it) => !(it.id === selectedId && it.type === 'text' && !it.text)));
    }
    setSelectedId(null);
    if (activeTool === 'photo') {
      photoInputRef.current?.click();
    }
    handleSurfaceTap(pageIdx, xp, yp);
  };

  // Start corner resize drag on selected item
  const onResizeHandleDown = (e: React.PointerEvent<HTMLButtonElement>, it: FormItem) => {
    e.stopPropagation();
    e.preventDefault();
    const layer = layerRefs.current[it.page];
    const meta = pagesMeta[it.page];
    if (!layer || !meta) return;
    const rect = layer.getBoundingClientRect();
    const xp = ((e.clientX - rect.left) / rect.width) * meta.w;
    const yp = ((e.clientY - rect.top) / rect.height) * meta.h;

    pushUndo(items);
    dragRef.current = {
      mode: 'resize',
      itemId: it.id,
      pageIdx: it.page,
      startXp: xp,
      startYp: yp,
      origItem: structuredClone(it),
    };
  };

  // Global pointer move / up for smooth item dragging and resizing
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const layer = layerRefs.current[drag.pageIdx];
      const meta = pagesMeta[drag.pageIdx];
      if (!layer || !meta) return;

      const rect = layer.getBoundingClientRect();
      const xp = ((e.clientX - rect.left) / rect.width) * meta.w;
      const yp = ((e.clientY - rect.top) / rect.height) * meta.h;
      const dx = xp - drag.startXp;
      const dy = yp - drag.startYp;
      const orig = drag.origItem;

      setItems((prev) =>
        prev.map((it) => {
          if (it.id !== drag.itemId) return it;
          if (drag.mode === 'move') {
            if (orig.type === 'comb' && it.type === 'comb') {
              return {
                ...it,
                y: orig.y + dy,
                cells: orig.cells.map((c: CombCell) => ({ ...c, x: c.x + dx })),
              };
            }
            if (
              (orig.type === 'text' || orig.type === 'mark' || orig.type === 'img') &&
              (it.type === 'text' || it.type === 'mark' || it.type === 'img')
            ) {
              return { ...it, x: orig.x + dx, y: orig.y + dy };
            }
          } else if (drag.mode === 'resize') {
            if (orig.type === 'text' && it.type === 'text') {
              const nextSize = clampVal(orig.size + dy * 0.7, 6.5, 42);
              return { ...it, size: nextSize, base: nextSize };
            }
            if ((orig.type === 'mark' || orig.type === 'img') && (it.type === 'mark' || it.type === 'img')) {
              const ratio = orig.w / Math.max(1, orig.h);
              const nextW = Math.max(10, orig.w + dx);
              return { ...it, w: nextW, h: nextW / ratio };
            }
          }
          return it;
        })
      );
    };

    const onUp = () => {
      dragRef.current = null;
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [pagesMeta]);

  // Signature Pad helpers
  const clearSignPad = () => {
    const c = signPadRef.current;
    if (!c) return;
    const g = c.getContext('2d');
    g?.clearRect(0, 0, c.width, c.height);
    signDrawingRef.current.hasStroke = false;
  };

  const getPadCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = signPadRef.current!;
    const r = c.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * c.width,
      y: ((e.clientY - r.top) / r.height) * c.height,
    };
  };

  const onSignPadDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = signPadRef.current;
    if (!c) return;
    c.setPointerCapture(e.pointerId);
    const { x, y } = getPadCoords(e);
    signDrawingRef.current = { active: true, lastX: x, lastY: y, hasStroke: true };
  };

  const onSignPadMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!signDrawingRef.current.active) return;
    const c = signPadRef.current;
    if (!c) return;
    const g = c.getContext('2d');
    if (!g) return;
    const { x, y } = getPadCoords(e);
    g.strokeStyle = ink;
    g.lineWidth = 4.2;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(signDrawingRef.current.lastX, signDrawingRef.current.lastY);
    g.lineTo(x, y);
    g.stroke();
    signDrawingRef.current.lastX = x;
    signDrawingRef.current.lastY = y;
  };

  const onSignPadUp = () => {
    signDrawingRef.current.active = false;
  };

  const trimCanvasAlpha = (srcCanvas: HTMLCanvasElement): HTMLCanvasElement | null => {
    const g = srcCanvas.getContext('2d');
    if (!g) return null;
    const { width: W, height: H } = srcCanvas;
    const d = g.getImageData(0, 0, W, H).data;
    let x0 = W;
    let y0 = H;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (d[(y * W + x) * 4 + 3] > 8) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return null;
    const pad = 12;
    x0 = Math.max(0, x0 - pad);
    y0 = Math.max(0, y0 - pad);
    x1 = Math.min(W - 1, x1 + pad);
    y1 = Math.min(H - 1, y1 + pad);
    const out = document.createElement('canvas');
    out.width = x1 - x0 + 1;
    out.height = y1 - y0 + 1;
    out.getContext('2d')?.drawImage(srcCanvas, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
    return out;
  };

  const handleSaveSignature = async () => {
    let finalDataUrl: string | null = null;
    if (signTab === 'draw') {
      const c = signPadRef.current;
      if (!c) return;
      const trimmed = trimCanvasAlpha(c);
      if (!trimmed) {
        setErrorMsg('Please draw your signature before saving.');
        return;
      }
      finalDataUrl = trimmed.toDataURL('image/png');
    } else {
      finalDataUrl = signExtractedDataUrl;
      if (!finalDataUrl) {
        setErrorMsg('Please upload a photo of your signature on plain paper first.');
        return;
      }
    }

    try {
      localStorage.setItem(LS_SIGN_KEY, finalDataUrl);
    } catch {
      // Ignore storage limit errors
    }
    setSavedSignSrc(finalDataUrl);
    setSignModalOpen(false);

    if (pendingPlacement) {
      await placeImageAtTarget(finalDataUrl, 'sign', pendingPlacement);
      setPendingPlacement(null);
      setActiveTool('text');
    }
  };

  const handlePickSignPhoto = async (file: File | undefined) => {
    if (!file) return;
    try {
      const img = await fileToHtmlImage(file);
      const cleanCanvas = extractSignatureInkCanvas(img, ink);
      if (!cleanCanvas) {
        setErrorMsg('Could not detect ink strokes cleanly. Try a clearer photo on bright paper.');
        return;
      }
      setSignExtractedDataUrl(cleanCanvas.toDataURL('image/png'));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to process signature photo.');
    }
  };

  // Passport Photo Cropper helpers
  const CROP_ASPECTS = [
    { label: 'Passport (35:45)', ratio: 35 / 45 },
    { label: 'Box Fit', ratio: 0 }, // overridden by tapped box ratio
    { label: 'Square (1:1)', ratio: 1 },
    { label: 'Landscape (4:3)', ratio: 4 / 3 },
  ];

  const handlePickUserPhoto = async (file: File | undefined) => {
    if (!file) return;
    try {
      const img = await fileToHtmlImage(file);
      const boxRatio =
        pendingPlacement?.target.kind === 'box'
          ? pendingPlacement.target.w / Math.max(1, pendingPlacement.target.h)
          : 35 / 45;
      const placement: PendingPlacement = pendingPlacement ?? {
        page: 0,
        xp: (pagesMeta[0]?.w || 595) / 2,
        yp: (pagesMeta[0]?.h || 842) / 3,
        target: { kind: 'free' },
      };
      setCropAspectIdx(pendingPlacement?.target.kind === 'box' ? 1 : 0);
      setCropZoom(1);
      setCropOffset({ x: 0, y: 0 });
      setCropDraft({ img, aspect: boxRatio, placement });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not load image.');
    }
  };

  const effectiveCropAspect = useMemo(() => {
    if (!cropDraft) return 35 / 45;
    if (cropAspectIdx === 1) return cropDraft.aspect;
    return CROP_ASPECTS[cropAspectIdx]?.ratio || 35 / 45;
  }, [cropAspectIdx, cropDraft]);

  // Draw live crop preview whenever crop state changes
  useEffect(() => {
    const c = cropCanvasRef.current;
    if (!cropDraft || !c) return;
    const previewW = 280;
    const previewH = Math.round(previewW / effectiveCropAspect);
    c.width = previewW;
    c.height = previewH;
    const g = c.getContext('2d');
    if (!g) return;

    g.fillStyle = '#FFFFFF';
    g.fillRect(0, 0, previewW, previewH);

    const { img } = cropDraft;
    const baseScale = Math.max(previewW / img.naturalWidth, previewH / img.naturalHeight);
    const totalScale = baseScale * cropZoom;
    const drawW = img.naturalWidth * totalScale;
    const drawH = img.naturalHeight * totalScale;
    const dx = (previewW - drawW) / 2 + cropOffset.x;
    const dy = (previewH - drawH) / 2 + cropOffset.y;

    g.imageSmoothingQuality = 'high';
    g.drawImage(img, dx, dy, drawW, drawH);
  }, [cropDraft, cropOffset, cropZoom, effectiveCropAspect]);

  const handleConfirmPhotoCrop = async () => {
    if (!cropDraft) return;
    const outW = 600;
    const outH = Math.round(outW / effectiveCropAspect);
    const out = document.createElement('canvas');
    out.width = outW;
    out.height = outH;
    const g = out.getContext('2d');
    if (!g) return;
    g.fillStyle = '#FFFFFF';
    g.fillRect(0, 0, outW, outH);

    const { img } = cropDraft;
    const previewW = 280;
    const scaleRatio = outW / previewW;
    const baseScale = Math.max(outW / img.naturalWidth, outH / img.naturalHeight);
    const totalScale = baseScale * cropZoom;
    const drawW = img.naturalWidth * totalScale;
    const drawH = img.naturalHeight * totalScale;
    const dx = (outW - drawW) / 2 + cropOffset.x * scaleRatio;
    const dy = (outH - drawH) / 2 + cropOffset.y * scaleRatio;

    g.imageSmoothingQuality = 'high';
    g.drawImage(img, dx, dy, drawW, drawH);
    const dataUrl = out.toDataURL('image/jpeg', 0.92);

    const placement = cropDraft.placement;
    setCropDraft(null);
    setPendingPlacement(null);
    await placeImageAtTarget(dataUrl, 'photo', placement);
    setActiveTool('text');
  };

  // Render high-DPI composite page canvases (for image forms or KB-shrinking export)
  const renderCompositePages = async (): Promise<
    { canvas: HTMLCanvasElement; ptW: number; ptH: number }[]
  > => {
    const out: { canvas: HTMLCanvasElement; ptW: number; ptH: number }[] = [];
    const targetScale = 2.4;

    for (const meta of pagesMeta) {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(meta.w * targetScale));
      c.height = Math.max(1, Math.round(meta.h * targetScale));
      const g = c.getContext('2d');
      if (!g) continue;

      g.fillStyle = '#fff';
      g.fillRect(0, 0, c.width, c.height);

      if (docKind === 'pdf' && meta.page) {
        const vp = meta.page.getViewport({ scale: targetScale });
        await meta.page.render({
          canvasContext: g as any,
          canvas: c,
          viewport: vp,
          intent: 'print',
        } as any).promise;
      } else if (docKind === 'image' && cleanPhotoEl) {
        g.imageSmoothingQuality = 'high';
        g.drawImage(cleanPhotoEl, 0, 0, c.width, c.height);
      }

      g.save();
      g.scale(targetScale, targetScale);
      for (const it of items) {
        if (it.page === meta.i) {
          drawFormItem(g, it, images);
        }
      }
      g.restore();

      out.push({ canvas: c, ptW: meta.w, ptH: meta.h });
    }
    return out;
  };

  // Export PDF (Original Vector for PDFs, High-DPI Composite for Photos, or KB-limited)
  const runPdfExport = async (maxBytes: number | null = null) => {
    if (!docKind || pagesMeta.length === 0) return;
    setIsExporting(true);
    setExportStatus(maxBytes ? `Fitting PDF under ${formatBytesHuman(maxBytes)}...` : 'Building filled PDF...');
    setErrorMsg(null);

    try {
      let blob: Blob | null = null;
      let mode: 'vector' | 'picture' = 'picture';

      if (docKind === 'pdf' && pdfBytes && !maxBytes) {
        try {
          blob = await buildVectorFilledPdf(pdfBytes, items, pagesMeta, images);
          mode = 'vector';
        } catch {
          // Fallback cleanly to high-DPI page composition if pdf-lib refuses an unusual PDF stream
          const pics = await renderCompositePages();
          blob = await buildPictureFilledPdf(pics, 0.88);
          mode = 'picture';
        }
      } else {
        const pics = await renderCompositePages();
        if (maxBytes) {
          blob = await fitFilledPdfToMaxBytes(pics, maxBytes, (msg) => setExportStatus(msg));
          if (!blob) {
            setErrorMsg(
              `This form has too much page detail to fit cleanly inside ${formatBytesHuman(
                maxBytes
              )}. Try the next size option up.`
            );
            setIsExporting(false);
            setExportStatus(null);
            return;
          }
        } else {
          blob = await buildPictureFilledPdf(pics, 0.88);
        }
        mode = 'picture';
      }

      // Generate Page-1 thumbnail preview URL
      const thumb = document.createElement('canvas');
      const m0 = pagesMeta[0];
      thumb.width = Math.round(m0.w);
      thumb.height = Math.round(m0.h);
      const tg = thumb.getContext('2d');
      if (tg) {
        tg.fillStyle = '#fff';
        tg.fillRect(0, 0, thumb.width, thumb.height);
        if (baseCanvasRefs.current[0]) {
          tg.drawImage(baseCanvasRefs.current[0]!, 0, 0, thumb.width, thumb.height);
        }
        if (inkCanvasRefs.current[0]) {
          tg.drawImage(inkCanvasRefs.current[0]!, 0, 0, thumb.width, thumb.height);
        }
      }

      const stem = (docName || 'form').replace(/\.(pdf|png|jpe?g|webp)$/i, '');
      setExportState({
        blob,
        previewUrl: thumb.toDataURL('image/jpeg', 0.85),
        fileName: `${stem}-filled.pdf`,
        mode,
        targetBytes: maxBytes,
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'PDF generation failed.');
    } finally {
      setIsExporting(false);
      setExportStatus(null);
    }
  };

  const triggerDownload = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const handleSharePdf = async () => {
    if (!exportState) return;
    try {
      const file = new File([exportState.blob], exportState.fileName, { type: 'application/pdf' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: exportState.fileName });
      } else {
        triggerDownload(exportState.blob, exportState.fileName);
      }
    } catch {
      // User cancelled share dialog
    }
  };

  const canWebShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  // Hidden Shared File Inputs
  const sharedFileInputs = (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf,image/*"
        className="hidden"
        onChange={(e) => {
          handlePickedFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handlePickUserPhoto(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <input
        ref={signPhotoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handlePickSignPhoto(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </>
  );

  // ======================== LANDING VIEW ========================
  if (!docKind) {
    return (
      <div className="space-y-6">
        {sharedFileInputs}

        {/* Top Landing Workspace Card */}
        <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-6 sm:p-8 shadow-[0_4px_0_#2F3E4E]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#CEE5DC] border border-[#2F3E4E] text-[11px] font-bold text-[#2F3E4E]">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Smart Box &amp; Comb Auto-Detection</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#FEF2C8] border border-[#2F3E4E] text-[11px] font-bold text-[#2F3E4E]">
                  100% Client-Side
                </span>
              </div>

              <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-[#2F3E4E] tracking-tight">
                {tool.title}
              </h1>
              <p className="text-sm sm:text-[15px] text-[#475569] leading-relaxed">
                Open any Indian bank, scholarship, KYC, admission, or government PDF form — or snap
                a photo of a paper form. Tap any letter box row, grouped{' '}
                <span className="font-semibold text-[#2F3E4E]">DD / MM / YYYY</span> box, underline,
                checkbox, passport photo box, or signature box to fill and export cleanly in seconds.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setDetailsDraft({ ...myDetails });
                setDetailsModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FEF2C8] hover:bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] text-xs font-bold text-[#2F3E4E] shadow-[0_2px_0_#2F3E4E] transition cursor-pointer shrink-0"
            >
              <UserCheck className="w-4 h-4" />
              <span>
                My Details ({populatedDetailFields.length}/{MY_DETAILS_FIELDS.length})
              </span>
            </button>
          </div>

          {errorMsg && (
            <div className="mt-5 p-3.5 rounded-xl bg-[#FEE2E2] border border-[#991B1B]/40 text-xs font-semibold text-[#991B1B] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Drop Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              handlePickedFile(e.dataTransfer.files?.[0]);
            }}
            className={`mt-6 rounded-2xl border-2 border-dashed p-6 sm:p-10 text-center transition-colors ${
              isDragOver
                ? 'border-[#2F3E4E] bg-[#F9C80E]/20'
                : 'border-[#2F3E4E]/45 bg-[#FEF2C8]/45 hover:bg-[#FEF2C8]/70'
            }`}
          >
            <div className="mx-auto w-14 h-14 rounded-2xl bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] shadow-[0_3px_0_#2F3E4E] flex items-center justify-center text-[#2F3E4E]">
              <Upload className="w-6 h-6" />
            </div>

            <h2 className="mt-4 font-display font-bold text-lg text-[#2F3E4E]">
              Drop your PDF form or paper form photo here
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-[#475569]">
              Supports fillable or flat PDFs (even password-protected) and JPG / PNG camera photos
              with automatic paper lighting cleanup.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                disabled={isLoading}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#2F3E4E] hover:bg-[#1E293B] text-[#FFFDF5] border-[1.5px] border-[#2F3E4E] text-sm font-bold shadow-[0_3px_0_#1E293B] transition cursor-pointer disabled:opacity-60"
              >
                <FilePlus2 className="w-4 h-4" />
                <span>{isLoading ? loadingLabel : 'Open PDF or Form Photo'}</span>
              </button>
            </div>
          </div>

          {/* Resume IndexedDB Session Card */}
          {resumeSession && (
            <div className="mt-5 p-4 rounded-xl bg-[#CEE5DC]/55 border-[1.5px] border-[#2F3E4E] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-10 h-10 rounded-xl bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] flex items-center justify-center text-[#2F3E4E] shrink-0">
                  <History className="w-5 h-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-[#2F3E4E] uppercase tracking-wide">
                    Unfinished Draft Saved Locally
                  </p>
                  <p className="text-sm font-bold text-[#2F3E4E] truncate">{resumeSession.name}</p>
                  <p className="text-[11px] text-[#475569]">
                    {resumeSession.items.length} placed item
                    {resumeSession.items.length === 1 ? '' : 's'} · Saved{' '}
                    {new Date(resumeSession.at).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleResumeSavedSession}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2F3E4E] hover:bg-[#1E293B] text-[#FFFDF5] text-xs font-bold transition cursor-pointer"
                >
                  <span>Continue Draft</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleDiscardSavedSession}
                  title="Discard saved draft"
                  className="p-2 rounded-lg bg-[#FFFDF5] hover:bg-[#FEE2E2] border border-[#2F3E4E] text-[#2F3E4E] transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* 3-Step Workflow Strip */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <div className="p-4 rounded-xl bg-[#FEF2C8]/65 border border-[#2F3E4E]/35 space-y-1.5">
              <span className="inline-block px-2 py-0.5 rounded bg-[#2F3E4E] text-[#F9C80E] text-[10px] font-bold">
                STEP 01
              </span>
              <h3 className="font-display font-bold text-sm text-[#2F3E4E]">
                Smart Box &amp; Comb Detection
              </h3>
              <p className="text-xs text-[#475569] leading-relaxed">
                Tap inside letter grids or DD/MM/YYYY boxes and letters auto-align into every
                individual box cleanly.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#FEF2C8]/65 border border-[#2F3E4E]/35 space-y-1.5">
              <span className="inline-block px-2 py-0.5 rounded bg-[#2F3E4E] text-[#F9C80E] text-[10px] font-bold">
                STEP 02
              </span>
              <h3 className="font-display font-bold text-sm text-[#2F3E4E]">
                One-Tap Details, Sign &amp; Photo
              </h3>
              <p className="text-xs text-[#475569] leading-relaxed">
                Save your Name, DOB, Mobile, and Address once, extract crisp signatures from paper
                photos, and crop passport photos to fit boxes.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#FEF2C8]/65 border border-[#2F3E4E]/35 space-y-1.5">
              <span className="inline-block px-2 py-0.5 rounded bg-[#2F3E4E] text-[#F9C80E] text-[10px] font-bold">
                STEP 03
              </span>
              <h3 className="font-display font-bold text-sm text-[#2F3E4E]">
                Vector PDF &amp; KB Size Limiter
              </h3>
              <p className="text-xs text-[#475569] leading-relaxed">
                Export crisp vector PDFs or compress multi-page filled forms cleanly under 100 KB,
                200 KB, 300 KB, 500 KB, or 1 MB for portals.
              </p>
            </div>
          </div>
        </div>

        {/* Modals accessible even on Landing View (Password + My Details) */}
        {renderModals()}
      </div>
    );
  }

  // ======================== MODALS RENDERER ========================
  function renderModals() {
    return (
      <>
        {/* Password Prompt Modal */}
        {passwordPrompt && (
          <div className="fixed inset-0 z-50 bg-[#1E293B]/70 backdrop-blur-[2px] flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-[#FFFDF5] border-2 border-[#2F3E4E] rounded-2xl p-6 shadow-[0_8px_0_#2F3E4E] space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-10 h-10 rounded-xl bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] flex items-center justify-center text-[#2F3E4E]">
                    <Lock className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="font-display font-bold text-base text-[#2F3E4E]">
                      Password Required
                    </h3>
                    <p className="text-xs text-[#475569] truncate max-w-[260px]">
                      {passwordPrompt.name}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPasswordPrompt(null);
                    setPasswordInput('');
                  }}
                  className="p-1.5 rounded-lg hover:bg-[#FEF2C8] text-[#2F3E4E] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {passwordPrompt.wrongPassword && (
                <p className="text-xs font-bold text-[#991B1B] bg-[#FEE2E2] px-3 py-2 rounded-lg border border-[#991B1B]/30">
                  Incorrect password. Please try again.
                </p>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  openPdfDocument(
                    passwordPrompt.bytes,
                    passwordPrompt.name,
                    passwordInput,
                    passwordPrompt.savedItems,
                    passwordPrompt.savedImages
                  );
                }}
                className="space-y-3"
              >
                <input
                  type="password"
                  autoFocus
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter PDF password..."
                  className="w-full px-3.5 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white text-sm font-medium text-[#2F3E4E] focus:outline-none"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPasswordPrompt(null);
                      setPasswordInput('');
                    }}
                    className="px-4 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#2F3E4E] hover:bg-[#1E293B] text-[#FFFDF5] text-xs font-bold cursor-pointer"
                  >
                    Unlock &amp; Open
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* My Details Modal */}
        {detailsModalOpen && (
          <div className="fixed inset-0 z-50 bg-[#1E293B]/70 backdrop-blur-[2px] flex items-center justify-center p-4">
            <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-[#FFFDF5] border-2 border-[#2F3E4E] rounded-2xl p-6 shadow-[0_8px_0_#2F3E4E] space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display font-bold text-lg text-[#2F3E4E]">
                    My Saved Form Details
                  </h3>
                  <p className="text-xs text-[#475569]">
                    Stored only on this browser for one-tap filling inside any form field.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailsModalOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-[#FEF2C8] text-[#2F3E4E] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {MY_DETAILS_FIELDS.map((field) => (
                  <div key={field.key} className={field.wide ? 'sm:col-span-2' : ''}>
                    <label
                      htmlFor={`ff-det-${field.key}`}
                      className="block text-[11px] font-bold text-[#2F3E4E] mb-1"
                    >
                      {field.label}
                    </label>
                    <input
                      id={`ff-det-${field.key}`}
                      type="text"
                      inputMode={field.inputMode || 'text'}
                      value={detailsDraft[field.key] || ''}
                      placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                      onChange={(e) =>
                        setDetailsDraft((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E]/75 bg-white text-xs font-medium text-[#2F3E4E] focus:outline-none focus:border-[#2F3E4E]"
                    />
                  </div>
                ))}
              </div>

              <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[#2F3E4E]/15">
                <button
                  type="button"
                  onClick={() => setDetailsDraft({})}
                  className="px-3.5 py-2 rounded-lg text-xs font-bold text-[#991B1B] hover:bg-[#FEE2E2] cursor-pointer"
                >
                  Clear All
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDetailsModalOpen(false)}
                    className="px-4 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const cleaned: Record<string, string> = {};
                      for (const [k, v] of Object.entries(detailsDraft)) {
                        if (v.trim()) cleaned[k] = v.trim();
                      }
                      setMyDetails(cleaned);
                      try {
                        localStorage.setItem(LS_DETAILS_KEY, JSON.stringify(cleaned));
                      } catch {
                        // Ignore storage errors
                      }
                      setDetailsModalOpen(false);
                    }}
                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#2F3E4E] hover:bg-[#1E293B] text-[#FFFDF5] text-xs font-bold cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Locally</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Signature Modal (Draw or Extract from Paper Photo) */}
        {signModalOpen && (
          <div className="fixed inset-0 z-50 bg-[#1E293B]/70 backdrop-blur-[2px] flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-[#FFFDF5] border-2 border-[#2F3E4E] rounded-2xl p-6 shadow-[0_8px_0_#2F3E4E] space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display font-bold text-lg text-[#2F3E4E]">
                    Add Your Signature
                  </h3>
                  <p className="text-xs text-[#475569]">
                    Draw directly or upload a paper photo — paper background is stripped
                    automatically to transparent ink.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSignModalOpen(false);
                    setPendingPlacement(null);
                  }}
                  className="p-1.5 rounded-lg hover:bg-[#FEF2C8] text-[#2F3E4E] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex gap-2 p-1 rounded-xl bg-[#FEF2C8] border border-[#2F3E4E]/35">
                <button
                  type="button"
                  onClick={() => setSignTab('draw')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                    signTab === 'draw'
                      ? 'bg-[#2F3E4E] text-[#FFFDF5]'
                      : 'text-[#2F3E4E] hover:bg-[#FFFDF5]/70'
                  }`}
                >
                  Draw Signature Pad
                </button>
                <button
                  type="button"
                  onClick={() => setSignTab('photo')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                    signTab === 'photo'
                      ? 'bg-[#2F3E4E] text-[#FFFDF5]'
                      : 'text-[#2F3E4E] hover:bg-[#FFFDF5]/70'
                  }`}
                >
                  Snap / Upload Paper Photo
                </button>
              </div>

              {signTab === 'draw' ? (
                <div className="space-y-2">
                  <div className="relative rounded-xl border-[1.5px] border-[#2F3E4E] bg-white overflow-hidden">
                    <canvas
                      ref={signPadRef}
                      width={760}
                      height={300}
                      onPointerDown={onSignPadDown}
                      onPointerMove={onSignPadMove}
                      onPointerUp={onSignPadUp}
                      onPointerCancel={onSignPadUp}
                      className="w-full h-44 touch-none cursor-crosshair block"
                    />
                    <div className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-dashed border-[#94A3B8]" />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-[#475569]">
                    <span>Using active ink: {ink === FORM_FILLER_INKS[0].c ? 'Black' : 'Royal Blue'}</span>
                    <button
                      type="button"
                      onClick={clearSignPad}
                      className="font-bold text-[#2F3E4E] hover:underline cursor-pointer"
                    >
                      Clear Pad
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-xl border-[1.5px] border-dashed border-[#2F3E4E]/50 bg-white p-5 text-center space-y-3">
                    {signExtractedDataUrl ? (
                      <div className="space-y-2">
                        <img
                          src={signExtractedDataUrl}
                          alt="Extracted transparent signature preview"
                          className="mx-auto max-h-32 object-contain"
                        />
                        <p className="text-[11px] font-semibold text-[#12805C]">
                          Paper shadow removed &amp; transparent ink ready
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-[#475569]">
                        Sign on plain white paper and choose the photo — shadows and paper grayness
                        will be automatically erased.
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={() => signPhotoInputRef.current?.click()}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FEF2C8] hover:bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] text-xs font-bold text-[#2F3E4E] cursor-pointer"
                    >
                      <Camera className="w-4 h-4" />
                      <span>
                        {signExtractedDataUrl ? 'Pick Different Photo' : 'Choose Signature Photo'}
                      </span>
                    </button>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setSignModalOpen(false);
                    setPendingPlacement(null);
                  }}
                  className="px-4 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveSignature}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#2F3E4E] hover:bg-[#1E293B] text-[#FFFDF5] text-xs font-bold cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{pendingPlacement ? 'Save & Place Signature' : 'Save Signature'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Passport Photo Cropper Modal */}
        {cropDraft && (
          <div className="fixed inset-0 z-50 bg-[#1E293B]/70 backdrop-blur-[2px] flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-[#FFFDF5] border-2 border-[#2F3E4E] rounded-2xl p-6 shadow-[0_8px_0_#2F3E4E] space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display font-bold text-lg text-[#2F3E4E]">
                    Adjust &amp; Crop Photo
                  </h3>
                  <p className="text-xs text-[#475569]">
                    Drag the image to position and use the slider to zoom.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCropDraft(null);
                    setPendingPlacement(null);
                  }}
                  className="p-1.5 rounded-lg hover:bg-[#FEF2C8] text-[#2F3E4E] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {CROP_ASPECTS.map((opt, idx) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => {
                      setCropAspectIdx(idx);
                      setCropOffset({ x: 0, y: 0 });
                    }}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer ${
                      cropAspectIdx === idx
                        ? 'bg-[#2F3E4E] text-[#FFFDF5] border-[#2F3E4E]'
                        : 'bg-[#FEF2C8] text-[#2F3E4E] border-[#2F3E4E]/40'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="flex justify-center bg-[#1E293B]/10 rounded-xl p-3">
                <canvas
                  ref={cropCanvasRef}
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    cropDragRef.current = {
                      active: true,
                      startX: e.clientX,
                      startY: e.clientY,
                      origX: cropOffset.x,
                      origY: cropOffset.y,
                    };
                  }}
                  onPointerMove={(e) => {
                    if (!cropDragRef.current.active) return;
                    setCropOffset({
                      x: cropDragRef.current.origX + (e.clientX - cropDragRef.current.startX),
                      y: cropDragRef.current.origY + (e.clientY - cropDragRef.current.startY),
                    });
                  }}
                  onPointerUp={() => {
                    cropDragRef.current.active = false;
                  }}
                  className="max-h-64 rounded-lg border-2 border-[#2F3E4E] shadow-sm cursor-grab active:cursor-grabbing touch-none"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-[#2F3E4E]">
                  <span>Zoom</span>
                  <span>{cropZoom.toFixed(2)}×</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.05}
                  value={cropZoom}
                  onChange={(e) => setCropZoom(parseFloat(e.target.value))}
                  className="w-full accent-[#2F3E4E]"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCropDraft(null);
                    setPendingPlacement(null);
                  }}
                  className="px-4 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPhotoCrop}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#2F3E4E] hover:bg-[#1E293B] text-[#FFFDF5] text-xs font-bold cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Place Photo</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Export Result & Portal KB Limiter Modal */}
        {exportState && (
          <div className="fixed inset-0 z-50 bg-[#1E293B]/70 backdrop-blur-[2px] flex items-center justify-center p-4">
            <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto bg-[#FFFDF5] border-2 border-[#2F3E4E] rounded-2xl p-6 shadow-[0_8px_0_#2F3E4E] space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-10 h-10 rounded-xl bg-[#CEE5DC] border-[1.5px] border-[#2F3E4E] flex items-center justify-center text-[#2F3E4E]">
                    <CheckCircle2 className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="font-display font-bold text-lg text-[#2F3E4E]">
                      Filled PDF Ready
                    </h3>
                    <p className="text-xs text-[#475569] truncate max-w-[280px]">
                      {exportState.fileName}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setExportState(null)}
                  className="p-1.5 rounded-lg hover:bg-[#FEF2C8] text-[#2F3E4E] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Thumbnail + Metrics */}
              <div className="flex items-center gap-4 p-3.5 rounded-xl bg-[#FEF2C8]/65 border border-[#2F3E4E]/35">
                <img
                  src={exportState.previewUrl}
                  alt="Page 1 filled preview"
                  className="w-20 h-28 object-cover rounded-lg border border-[#2F3E4E] bg-white shrink-0"
                />
                <div className="space-y-1.5 min-w-0">
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#2F3E4E] text-[#F9C80E] text-[10px] font-bold">
                    {exportState.mode === 'vector' ? 'CRISP VECTOR PDF' : 'COMPRESSED IMAGE PDF'}
                  </div>
                  <p className="font-display font-extrabold text-xl text-[#2F3E4E]">
                    {formatBytesHuman(exportState.blob.size)}
                  </p>
                  <p className="text-[11px] text-[#475569]">
                    {pagesMeta.length} page{pagesMeta.length === 1 ? '' : 's'} ·{' '}
                    {items.length} filled field{items.length === 1 ? '' : 's'}
                  </p>
                </div>
              </div>

              {/* Portal Size Limit Controls */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-[#2F3E4E]">
                  <span className="inline-flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Portal File Size Limit (Optional)</span>
                  </span>
                  {isExporting && (
                    <span className="text-[11px] text-[#12805C]">{exportStatus}</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    disabled={isExporting}
                    onClick={() => runPdfExport(null)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer transition disabled:opacity-50 ${
                      exportState.targetBytes === null
                        ? 'bg-[#2F3E4E] text-[#FFFDF5] border-[#2F3E4E]'
                        : 'bg-[#FFFDF5] text-[#2F3E4E] border-[#2F3E4E]/45 hover:bg-[#FEF2C8]'
                    }`}
                  >
                    Original Quality
                  </button>
                  {TARGET_KB_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      disabled={isExporting}
                      onClick={() => runPdfExport(preset.bytes)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer transition disabled:opacity-50 ${
                        exportState.targetBytes === preset.bytes
                          ? 'bg-[#2F3E4E] text-[#FFFDF5] border-[#2F3E4E]'
                          : 'bg-[#FFFDF5] text-[#2F3E4E] border-[#2F3E4E]/45 hover:bg-[#FEF2C8]'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Download & Share CTAs */}
              <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-[#2F3E4E]/15">
                {canWebShare && (
                  <button
                    type="button"
                    onClick={handleSharePdf}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#FEF2C8] hover:bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] text-xs font-bold text-[#2F3E4E] cursor-pointer"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Share PDF</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => triggerDownload(exportState.blob, exportState.fileName)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#F9C80E] hover:bg-[#e8b909] border-[1.5px] border-[#2F3E4E] text-xs font-extrabold text-[#2F3E4E] shadow-[0_3px_0_#2F3E4E] cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download PDF</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // ======================== ACTIVE EDITOR VIEW ========================
  const TOOL_BUTTONS: {
    id: FormToolType;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    hint: string;
  }[] = [
    {
      id: 'text',
      label: 'Type',
      icon: Type,
      hint: 'Tap inside any letter box, underline, table cell, or blank area to type.',
    },
    {
      id: 'tick',
      label: 'Tick',
      icon: Check,
      hint: 'Tap any checkbox or option to stamp a crisp tick mark.',
    },
    {
      id: 'cross',
      label: 'Cross',
      icon: X,
      hint: 'Tap any checkbox or option to stamp a crisp cross mark.',
    },
    {
      id: 'date',
      label: 'Date',
      icon: Calendar,
      hint: `Tap any date box or line to stamp today's date (${todayDmy()}).`,
    },
    {
      id: 'sign',
      label: 'Sign',
      icon: PenTool,
      hint: savedSignSrc
        ? 'Tap anywhere to stamp your saved signature (or update it anytime).'
        : 'Tap where you want to sign — you can draw or upload a paper photo.',
    },
    {
      id: 'photo',
      label: 'Photo',
      icon: ImageIcon,
      hint: 'Tap the photo box on the form to pick, crop, and fit your passport photo.',
    },
  ];

  const activeToolMeta = TOOL_BUTTONS.find((t) => t.id === activeTool)!;

  return (
    <div className="space-y-4">
      {sharedFileInputs}
      {renderModals()}

      {/* Sticky Top Editor Controls */}
      <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-3 sm:p-4 shadow-[0_4px_0_#2F3E4E] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Left: Change File, Name, Ink Colour */}
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => {
                setDocKind(null);
                setSelectedId(null);
                formFillerIdb.get('last').then((s) => {
                  if (s && s.name && (s.bytes || s.imgSrc)) setResumeSession(s);
                });
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FEF2C8] hover:bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] text-xs font-bold text-[#2F3E4E] cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Change Form</span>
            </button>

            <div className="min-w-0 px-2.5 py-1 rounded-lg bg-[#FEF2C8]/70 border border-[#2F3E4E]/25 flex items-center gap-2">
              <span className="text-xs font-bold text-[#2F3E4E] truncate max-w-[180px] sm:max-w-[260px]">
                {docName}
              </span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#2F3E4E] text-[#FFFDF5] shrink-0">
                {pagesMeta.length}P
              </span>
            </div>

            {/* Ink Swatch Toggle */}
            <div
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[#2F3E4E]/35 bg-white"
              title="Switch pen ink colour"
            >
              <span className="text-[10px] font-bold text-[#475569] mr-0.5 hidden sm:inline">
                Ink:
              </span>
              {FORM_FILLER_INKS.map((swatch) => (
                <button
                  key={swatch.c}
                  type="button"
                  onClick={() => setInk(swatch.c)}
                  aria-label={`${swatch.name} ink`}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition ${
                    ink === swatch.c
                      ? 'bg-[#2F3E4E] text-[#FFFDF5]'
                      : 'text-[#2F3E4E] hover:bg-[#FEF2C8]'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full border border-white/60"
                    style={{ backgroundColor: swatch.c }}
                  />
                  <span>{swatch.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Right: Undo, Zoom, My Details, Save PDF */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={undoStack.length === 0}
              onClick={handleUndo}
              title="Undo last change (Ctrl/Cmd + Z)"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#FFFDF5] hover:bg-[#FEF2C8] border-[1.5px] border-[#2F3E4E] text-xs font-bold text-[#2F3E4E] disabled:opacity-40 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Undo</span>
            </button>

            <div className="inline-flex items-center rounded-lg border-[1.5px] border-[#2F3E4E] bg-white overflow-hidden">
              <button
                type="button"
                disabled={zoomIdx === 0}
                onClick={() => setZoomIdx((z) => Math.max(0, z - 1))}
                aria-label="Zoom out"
                className="px-2 py-1.5 hover:bg-[#FEF2C8] text-[#2F3E4E] disabled:opacity-40 cursor-pointer"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 text-[11px] font-bold text-[#2F3E4E] tabular-nums">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                disabled={zoomIdx === ZOOM_STEPS.length - 1}
                onClick={() => setZoomIdx((z) => Math.min(ZOOM_STEPS.length - 1, z + 1))}
                aria-label="Zoom in"
                className="px-2 py-1.5 hover:bg-[#FEF2C8] text-[#2F3E4E] disabled:opacity-40 cursor-pointer"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setDetailsDraft({ ...myDetails });
                setDetailsModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#CEE5DC] hover:bg-[#b8dacd] border-[1.5px] border-[#2F3E4E] text-xs font-bold text-[#2F3E4E] cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">My Details</span>
            </button>

            <button
              type="button"
              disabled={isExporting}
              onClick={() => runPdfExport(null)}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#F9C80E] hover:bg-[#e8b909] border-[1.5px] border-[#2F3E4E] text-xs font-extrabold text-[#2F3E4E] shadow-[0_2px_0_#2F3E4E] cursor-pointer disabled:opacity-60"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExporting ? 'Building...' : 'Save PDF'}</span>
            </button>
          </div>
        </div>

        {/* Tool Mode Selector Strip */}
        <div className="pt-2.5 border-t border-[#2F3E4E]/15 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {TOOL_BUTTONS.map((btn) => {
              const Icon = btn.icon;
              const isActive = activeTool === btn.id;
              return (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => setActiveTool(btn.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-[1.5px] text-xs font-bold transition cursor-pointer ${
                    isActive
                      ? 'bg-[#2F3E4E] text-[#F9C80E] border-[#2F3E4E] shadow-[0_2px_0_#1E293B]'
                      : 'bg-[#FFFDF5] hover:bg-[#FEF2C8] text-[#2F3E4E] border-[#2F3E4E]/45'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{btn.label}</span>
                </button>
              );
            })}

            {savedSignSrc && (
              <button
                type="button"
                onClick={() => {
                  setPendingPlacement(null);
                  setSignExtractedDataUrl(null);
                  setSignModalOpen(true);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-dashed border-[#2F3E4E]/50 text-[11px] font-bold text-[#475569] hover:text-[#2F3E4E] hover:bg-[#FEF2C8] cursor-pointer"
              >
                <span>Update Saved Sign</span>
              </button>
            )}
          </div>

          <p className="text-[11px] font-medium text-[#475569]">{activeToolMeta.hint}</p>
        </div>

        {/* Inline Typing Bar when Text or Comb Box Item is Selected */}
        {selectedItem && (selectedItem.type === 'text' || selectedItem.type === 'comb') && (
          <div className="p-3 rounded-xl bg-[#FEF2C8] border-[1.5px] border-[#2F3E4E] space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={typeInputRef}
                type="text"
                value={selectedItem.text}
                onChange={(e) => updateSelectedTextValue(e.target.value)}
                placeholder={
                  selectedItem.type === 'comb'
                    ? `Type up to ${selectedItem.cells.length} characters (auto-fills boxes)...`
                    : 'Type text for this field...'
                }
                className="flex-1 min-w-[200px] px-3.5 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white text-sm font-semibold text-[#2F3E4E] focus:outline-none"
              />

              {selectedItem.type === 'text' && (
                <div className="inline-flex items-center rounded-lg border-[1.5px] border-[#2F3E4E] bg-white overflow-hidden">
                  <button
                    type="button"
                    onClick={() => nudgeSelectedFontSize(-1)}
                    className="px-2.5 py-2 text-xs font-bold text-[#2F3E4E] hover:bg-[#FEF2C8] cursor-pointer"
                  >
                    A−
                  </button>
                  <span className="px-2 text-[11px] font-mono font-bold text-[#475569]">
                    {Math.round(selectedItem.size)}pt
                  </span>
                  <button
                    type="button"
                    onClick={() => nudgeSelectedFontSize(1)}
                    className="px-2.5 py-2 text-xs font-bold text-[#2F3E4E] hover:bg-[#FEF2C8] cursor-pointer"
                  >
                    A+
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  pushUndo(items);
                  setItems((prev) => prev.filter((it) => it.id !== selectedItem.id));
                  setSelectedId(null);
                }}
                title="Delete field"
                className="p-2 rounded-lg bg-[#FEE2E2] hover:bg-[#fecaca] border border-[#991B1B]/40 text-[#991B1B] cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="px-3.5 py-2 rounded-lg bg-[#2F3E4E] text-[#FFFDF5] text-xs font-bold cursor-pointer"
              >
                Done
              </button>
            </div>

            {selectedCombOverflow && selectedItem.type === 'comb' && (
              <p className="text-[11px] font-bold text-[#991B1B]">
                Heads up: text exceeds {selectedItem.cells.length} detected letter boxes. Extra
                letters are clipped cleanly.
              </p>
            )}

            {/* Quick-Fill Chips (Today Date + My Details) */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wide text-[#475569] mr-1">
                Quick Fill:
              </span>
              <button
                type="button"
                onClick={() => updateSelectedTextValue(todayDmy())}
                className="px-2.5 py-1 rounded-md bg-[#FFFDF5] hover:bg-[#F9C80E] border border-[#2F3E4E]/50 text-[11px] font-bold text-[#2F3E4E] cursor-pointer"
              >
                Today ({todayDmy()})
              </button>

              {populatedDetailFields.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => updateSelectedTextValue(myDetails[f.key])}
                  className="px-2.5 py-1 rounded-md bg-[#CEE5DC] hover:bg-[#F9C80E] border border-[#2F3E4E]/50 text-[11px] font-bold text-[#2F3E4E] cursor-pointer"
                >
                  {f.label}: {myDetails[f.key].slice(0, 18)}
                  {myDetails[f.key].length > 18 ? '…' : ''}
                </button>
              ))}

              <button
                type="button"
                onClick={() => {
                  setDetailsDraft({ ...myDetails });
                  setDetailsModalOpen(true);
                }}
                className="px-2.5 py-1 rounded-md border border-dashed border-[#2F3E4E]/60 text-[11px] font-bold text-[#2F3E4E] hover:bg-white cursor-pointer"
              >
                + Edit My Details
              </button>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 rounded-xl bg-[#FEE2E2] border border-[#991B1B]/40 text-xs font-semibold text-[#991B1B] flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {errorMsg}
            </span>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="p-1 rounded hover:bg-white/60 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Page Preview Desk */}
      <div className="rounded-2xl bg-[#2F3E4E]/10 border-[1.5px] border-[#2F3E4E] p-3 sm:p-6 overflow-hidden">
        <div className="flex flex-col items-center gap-6">
          {pagesMeta.map((meta) => {
            const pageItems = items.filter((it) => it.page === meta.i);
            const displayMaxW = Math.round(meta.w * zoom * 1.15);

            return (
              <div
                key={meta.i}
                className="relative w-full bg-white border border-[#2F3E4E]/45 rounded-lg shadow-[0_6px_24px_rgba(47,62,78,0.16)] overflow-visible select-none"
                style={{
                  maxWidth: `${displayMaxW}px`,
                  aspectRatio: `${meta.w} / ${meta.h}`,
                }}
              >
                <div className="absolute inset-0 rounded-lg overflow-hidden pointer-events-none">
                  {/* Page index pill badge */}
                  {pagesMeta.length > 1 && (
                    <span className="pointer-events-none absolute top-2 left-2 z-20 px-2 py-0.5 rounded bg-[#2F3E4E]/80 text-[#FFFDF5] text-[10px] font-mono font-bold">
                      Page {meta.i + 1} / {pagesMeta.length}
                    </span>
                  )}

                  {/* Base Form Canvas */}
                  <canvas
                    ref={(el) => {
                      baseCanvasRefs.current[meta.i] = el;
                    }}
                    className="absolute inset-0 w-full h-full block"
                  />

                  {/* Live Filled Ink Canvas */}
                  <canvas
                    ref={(el) => {
                      inkCanvasRefs.current[meta.i] = el;
                    }}
                    className="absolute inset-0 w-full h-full block pointer-events-none"
                  />
                </div>

                {/* Interactive Overlay Layer */}
                <div
                  ref={(el) => {
                    layerRefs.current[meta.i] = el;
                  }}
                  onPointerDown={(e) => onLayerPointerDown(e, meta.i)}
                  className="absolute inset-0 w-full h-full z-10 cursor-crosshair touch-pan-y"
                >
                  {pageItems.map((it) => {
                    const bb = formItemBbox(it);
                    const isSel = it.id === selectedId;
                    const leftPct = (bb.x / meta.w) * 100;
                    const topPct = (bb.y / meta.h) * 100;
                    const widthPct = (bb.w / meta.w) * 100;
                    const heightPct = (bb.h / meta.h) * 100;

                    return (
                      <div
                        key={it.id}
                        style={{
                          left: `${leftPct}%`,
                          top: `${topPct}%`,
                          width: `${widthPct}%`,
                          height: `${heightPct}%`,
                        }}
                        className={`absolute rounded-[3px] transition-colors ${
                          isSel
                            ? 'ring-2 ring-[#2F3E4E] bg-[#F9C80E]/15 cursor-move'
                            : 'hover:ring-1 hover:ring-[#2F3E4E]/50 cursor-pointer'
                        }`}
                      >
                        {isSel && (
                          <>
                            {/* Delete Item Badge */}
                            <button
                              type="button"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                pushUndo(items);
                                setItems((prev) => prev.filter((x) => x.id !== it.id));
                                setSelectedId(null);
                              }}
                              title="Remove field"
                              className="absolute -top-3 -right-3 w-5 h-5 rounded-full bg-[#2F3E4E] hover:bg-[#991B1B] text-[#FFFDF5] border border-white flex items-center justify-center shadow-sm cursor-pointer z-30"
                            >
                              <X className="w-3 h-3" />
                            </button>

                            {/* Corner Resize Handle (all items except comb grids) */}
                            {it.type !== 'comb' && (
                              <button
                                type="button"
                                onPointerDown={(e) => onResizeHandleDown(e, it)}
                                title="Drag to resize"
                                className="absolute -bottom-2 -right-2 w-4 h-4 rounded-full bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] cursor-nwse-resize shadow-sm z-30"
                              />
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
