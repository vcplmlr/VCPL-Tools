import React, { useCallback, useEffect, useRef, useState } from 'react';
import JSZip from 'jszip';
import {
  AlertCircle,
  Archive,
  CheckCircle,
  Crop,
  Download,
  Eraser,
  FlipHorizontal,
  FlipVertical,
  Image as ImageIcon,
  Info,
  Layers,
  Minimize2,
  Paintbrush,
  Pipette,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Sliders,
  Sparkles,
  Stamp,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { ToolCatalogItem } from '../../types/tools';
import {
  CropRect,
  ImageOutputFormat,
  canvasToBlob,
  loadImageElement,
  removeImageBackground,
  renderTransformedCrop,
  resizeOrConvertImage,
} from '../../utils/imageProcessing';

interface ImageStudioViewProps {
  tool: ToolCatalogItem;
}

type AspectPreset = 'free' | '1:1' | '4:3' | '16:9' | '3:2' | 'portrait' | 'landscape';

interface BatchResultItem {
  id: string;
  originalName: string;
  outputName: string;
  originalSize: number;
  finalSize: number;
  width: number;
  height: number;
  url: string;
  blob: Blob;
}

interface ResolutionAudit {
  id: string;
  name: string;
  sizeBytes: number;
  mimeType: string;
  width: number;
  height: number;
  megapixels: string;
  aspectRatio: string;
  hasAlpha: boolean;
  previewUrl: string;
}

const ASPECT_RATIOS: { id: AspectPreset; label: string; ratio: number | null }[] = [
  { id: 'free', label: 'Freeform', ratio: null },
  { id: '1:1', label: '1:1 Square', ratio: 1 },
  { id: '4:3', label: '4:3', ratio: 4 / 3 },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '3:2', label: '3:2', ratio: 3 / 2 },
  { id: 'portrait', label: 'Portrait 3:4', ratio: 3 / 4 },
  { id: 'landscape', label: 'Landscape 16:10', ratio: 16 / 10 },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getRatioLabel(w: number, h: number): string {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const d = gcd(w, h) || 1;
  const rw = Math.round(w / d);
  const rh = Math.round(h / d);
  if (rw > 40 || rh > 40) return `${(w / Math.max(1, h)).toFixed(2)}:1`;
  return `${rw}:${rh}`;
}

export const ImageStudioView: React.FC<ImageStudioViewProps> = ({ tool }) => {
  const isCropTool =
    tool.id === 'jpg-crop' || tool.id === 'png-crop' || tool.id === 'webp-crop';
  const isResizeTool = tool.id === 'image-resize';
  const isCompressTool = tool.id === 'image-compress';
  const isConverterTool = tool.id === 'image-converter';
  const isBgRemover = tool.id === 'image-bg-remover';
  const isRotateFlipTool = tool.id === 'image-rotate-flip';
  const isWatermarkTool = tool.id === 'image-watermark';
  const isResolutionChecker = tool.id === 'image-resolution-checker';

  const defaultFormat: ImageOutputFormat =
    tool.id === 'png-crop' || isBgRemover
      ? 'png'
      : tool.id === 'webp-crop'
      ? 'webp'
      : 'jpeg';

  // Common state
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(
    null
  );
  const [outputFormat, setOutputFormat] = useState<ImageOutputFormat>(defaultFormat);
  const [quality, setQuality] = useState<number>(88);
  const [matteColor, setMatteColor] = useState<string>('#FFFFFF');
  const [batchResults, setBatchResults] = useState<BatchResultItem[]>([]);
  const [isZipping, setIsZipping] = useState(false);

  // Interactive Cropper state
  const [cropSrcUrl, setCropSrcUrl] = useState<string | null>(null);
  const [cropPreviewUrl, setCropPreviewUrl] = useState<string | null>(null);
  const [cropImgEl, setCropImgEl] = useState<HTMLImageElement | null>(null);
  const [cropNaturalDims, setCropNaturalDims] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [cropRect, setCropRect] = useState<CropRect>({ x: 0, y: 0, width: 100, height: 100 });
  const [aspectPreset, setAspectPreset] = useState<AspectPreset>('free');
  const [rotateDeg, setRotateDeg] = useState<number>(0);
  const [flipH, setFlipH] = useState<boolean>(false);
  const [flipV, setFlipV] = useState<boolean>(false);
  const [cropResult, setCropResult] = useState<{ url: string; blob: Blob; w: number; h: number } | null>(
    null
  );
  const cropBoxContainerRef = useRef<HTMLDivElement | null>(null);
  const dragModeRef = useRef<{
    type: 'move' | 'nw' | 'ne' | 'sw' | 'se' | null;
    startX: number;
    startY: number;
    origRect: CropRect;
  }>({ type: null, startX: 0, startY: 0, origRect: { x: 0, y: 0, width: 100, height: 100 } });

  // Resize & Compress state
  const [resizeWidth, setResizeWidth] = useState<number>(1200);
  const [resizeHeight, setResizeHeight] = useState<number>(800);
  const [lockAspect, setLockAspect] = useState<boolean>(true);
  const [sourceAspectRatio, setSourceAspectRatio] = useState<number>(1.5);
  const [compressMaxWidth, setCompressMaxWidth] = useState<number>(0);

  // Watermark state
  const [wmText, setWmText] = useState<string>('CONFIDENTIAL');
  const [wmOpacity, setWmOpacity] = useState<number>(0.35);
  const [wmFontSize, setWmFontSize] = useState<number>(36);
  const [wmColor, setWmColor] = useState<string>('#2F3E4E');
  const [wmPosition, setWmPosition] = useState<'center' | 'bottom-right' | 'bottom-left' | 'tiled'>(
    'bottom-right'
  );

  // Resolution checker state
  const [resolutionAudits, setResolutionAudits] = useState<ResolutionAudit[]>([]);

  // Background Remover (Normal & Advanced) state
  const [bgMode, setBgMode] = useState<'normal' | 'advanced'>('advanced');
  const [bgTolerance, setBgTolerance] = useState<number>(38);
  const [bgFeather, setBgFeather] = useState<number>(2);
  const [bgPreviewBackdrop, setBgPreviewBackdrop] = useState<'checker' | 'white' | 'dark'>(
    'checker'
  );
  const [bgBrushTool, setBgBrushTool] = useState<'eyedropper' | 'keep' | 'erase'>('eyedropper');
  const [brushSize, setBrushSize] = useState<number>(22);
  const [bgSeedPoints, setBgSeedPoints] = useState<{ x: number; y: number }[]>([]);
  const [bgSrcUrl, setBgSrcUrl] = useState<string | null>(null);
  const [bgImgEl, setBgImgEl] = useState<HTMLImageElement | null>(null);
  const [bgResultUrl, setBgResultUrl] = useState<string | null>(null);
  const [bgResultBlob, setBgResultBlob] = useState<Blob | null>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const keepMaskRef = useRef<Uint8Array | null>(null);
  const eraseMaskRef = useRef<Uint8Array | null>(null);
  const isPaintingBgRef = useRef<boolean>(false);

  const resetAll = useCallback(() => {
    batchResults.forEach((r) => URL.revokeObjectURL(r.url));
    resolutionAudits.forEach((a) => URL.revokeObjectURL(a.previewUrl));
    if (cropSrcUrl) URL.revokeObjectURL(cropSrcUrl);
    if (cropResult?.url) URL.revokeObjectURL(cropResult.url);
    if (bgSrcUrl) URL.revokeObjectURL(bgSrcUrl);
    if (bgResultUrl) URL.revokeObjectURL(bgResultUrl);

    setFiles([]);
    setBatchResults([]);
    setResolutionAudits([]);
    setCropSrcUrl(null);
    setCropImgEl(null);
    setCropResult(null);
    setRotateDeg(0);
    setFlipH(false);
    setFlipV(false);
    setAspectPreset('free');

    setBgSrcUrl(null);
    setBgImgEl(null);
    setBgResultUrl(null);
    setBgResultBlob(null);
    setBgSeedPoints([]);
    keepMaskRef.current = null;
    eraseMaskRef.current = null;
    setStatus(null);
    setOutputFormat(
      tool.id === 'png-crop' || tool.id === 'image-bg-remover'
        ? 'png'
        : tool.id === 'webp-crop'
        ? 'webp'
        : 'jpeg'
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool.id]);

  useEffect(() => {
    resetAll();
  }, [tool.id, resetAll]);

  // Build exact transformed preview image whenever rotation or flip changes so crop overlay stays 1:1
  useEffect(() => {
    if (!cropImgEl || !cropSrcUrl) {
      setCropPreviewUrl(null);
      return;
    }
    if (rotateDeg === 0 && !flipH && !flipV) {
      setCropPreviewUrl(cropSrcUrl);
      return;
    }

    let cancelled = false;
    let generatedUrl: string | null = null;

    const srcW = cropImgEl.naturalWidth || cropImgEl.width;
    const srcH = cropImgEl.naturalHeight || cropImgEl.height;
    const swap = Math.abs(rotateDeg % 180) === 90;
    const targetW = swap ? srcH : srcW;
    const targetH = swap ? srcW : srcH;
    const scale = Math.min(1, 1400 / Math.max(1, targetW, targetH));

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(targetW * scale));
    canvas.height = Math.max(1, Math.round(targetH * scale));
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      setCropPreviewUrl(cropSrcUrl);
      return;
    }

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotateDeg * Math.PI) / 180);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    ctx.drawImage(
      cropImgEl,
      -(srcW * scale) / 2,
      -(srcH * scale) / 2,
      srcW * scale,
      srcH * scale
    );

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        generatedUrl = url;
        setCropPreviewUrl(url);
      },
      'image/png'
    );

    return () => {
      cancelled = true;
      if (generatedUrl) URL.revokeObjectURL(generatedUrl);
    };
  }, [cropImgEl, cropSrcUrl, rotateDeg, flipH, flipV]);

  // Compute effective transformed dimensions for Cropper
  const getTransformedBounds = (img: HTMLImageElement, deg: number) => {
    const srcW = img.naturalWidth || img.width;
    const srcH = img.naturalHeight || img.height;
    const swap = Math.abs(deg % 180) === 90;
    return { w: swap ? srcH : srcW, h: swap ? srcW : srcH };
  };

  // Run Background Remover pass
  const runBgRemoval = useCallback(
    async (
      img: HTMLImageElement,
      mode: 'normal' | 'advanced',
      tol: number,
      feather: number,
      seeds: { x: number; y: number }[],
      outFmt: ImageOutputFormat
    ) => {
      setIsProcessing(true);
      try {
        const { canvas, width, height } = await removeImageBackground(img, {
          mode,
          tolerance: tol,
          feather,
          seedPoints: seeds,
          keepMask: keepMaskRef.current,
          eraseMask: eraseMaskRef.current,
          maskWidth: img.naturalWidth || img.width,
          maskHeight: img.naturalHeight || img.height,
        });

        const previewCanvas = bgCanvasRef.current;
        if (previewCanvas) {
          previewCanvas.width = width;
          previewCanvas.height = height;
          const pCtx = previewCanvas.getContext('2d');
          if (pCtx) {
            pCtx.clearRect(0, 0, width, height);
            pCtx.drawImage(canvas, 0, 0);
          }
        }

        const effectiveFmt: ImageOutputFormat = outFmt === 'jpeg' ? 'png' : outFmt;
        const blob = await canvasToBlob(canvas, effectiveFmt, quality / 100);
        setBgResultUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
        setBgResultBlob(blob);
        setStatus({
          type: 'success',
          text: `${mode === 'advanced' ? 'Advanced AI-Edge Alpha Matting' : 'Normal Flood-Fill'} complete (${width}×${height}px · ${formatBytes(blob.size)}).`,
        });
      } catch (err: any) {
        setStatus({ type: 'error', text: err?.message || 'Background removal failed.' });
      } finally {
        setIsProcessing(false);
      }
    },
    [quality]
  );

  // Trigger live re-run when BG parameters change
  useEffect(() => {
    if (isBgRemover && bgImgEl) {
      const id = window.setTimeout(() => {
        runBgRemoval(bgImgEl, bgMode, bgTolerance, bgFeather, bgSeedPoints, outputFormat);
      }, 60);
      return () => window.clearTimeout(id);
    }
  }, [isBgRemover, bgImgEl, bgMode, bgTolerance, bgFeather, bgSeedPoints, outputFormat, runBgRemoval]);

  const handleFilesSelected = async (incomingList: FileList | File[]) => {
    const valid = Array.from(incomingList).filter((f) => f.type.startsWith('image/'));
    if (valid.length === 0) {
      setStatus({ type: 'error', text: 'Please upload valid image files (JPG, PNG, WEBP, GIF, BMP).' });
      return;
    }
    setStatus(null);

    if (isCropTool) {
      const first = valid[0];
      setFiles([first]);
      if (cropSrcUrl) URL.revokeObjectURL(cropSrcUrl);
      if (cropResult?.url) URL.revokeObjectURL(cropResult.url);
      const url = URL.createObjectURL(first);
      setCropSrcUrl(url);
      setRotateDeg(0);
      setFlipH(false);
      setFlipV(false);
      setCropResult(null);
      try {
        const img = await loadImageElement(url);
        setCropImgEl(img);
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        setCropNaturalDims({ w, h });
        setCropRect({
          x: Math.round(w * 0.1),
          y: Math.round(h * 0.1),
          width: Math.round(w * 0.8),
          height: Math.round(h * 0.8),
        });
      } catch (err: any) {
        setStatus({ type: 'error', text: err?.message || 'Could not load image.' });
      }
      return;
    }

    if (isBgRemover) {
      const first = valid[0];
      setFiles([first]);
      if (bgSrcUrl) URL.revokeObjectURL(bgSrcUrl);
      const url = URL.createObjectURL(first);
      setBgSrcUrl(url);
      setBgSeedPoints([]);
      try {
        const img = await loadImageElement(url);
        const total = (img.naturalWidth || img.width) * (img.naturalHeight || img.height);
        keepMaskRef.current = new Uint8Array(total);
        eraseMaskRef.current = new Uint8Array(total);
        setBgImgEl(img);
      } catch (err: any) {
        setStatus({ type: 'error', text: err?.message || 'Could not load image.' });
      }
      return;
    }

    if (isResolutionChecker) {
      resolutionAudits.forEach((a) => URL.revokeObjectURL(a.previewUrl));
      setFiles(valid);
      setIsProcessing(true);
      try {
        const audits: ResolutionAudit[] = [];
        for (const f of valid) {
          const url = URL.createObjectURL(f);
          const img = await loadImageElement(url);
          const w = img.naturalWidth || img.width;
          const h = img.naturalHeight || img.height;
          const c = document.createElement('canvas');
          c.width = Math.min(200, w);
          c.height = Math.min(200, h);
          const ctx = c.getContext('2d')!;
          ctx.drawImage(img, 0, 0, c.width, c.height);
          const pixels = ctx.getImageData(0, 0, c.width, c.height).data;
          let hasAlpha = false;
          for (let i = 3; i < pixels.length; i += 4) {
            if (pixels[i] < 252) {
              hasAlpha = true;
              break;
            }
          }
          audits.push({
            id: Math.random().toString(36).slice(2, 9),
            name: f.name,
            sizeBytes: f.size,
            mimeType: f.type || 'image/*',
            width: w,
            height: h,
            megapixels: ((w * h) / 1_000_000).toFixed(2),
            aspectRatio: getRatioLabel(w, h),
            hasAlpha,
            previewUrl: url,
          });
        }
        setResolutionAudits(audits);
        setStatus({ type: 'success', text: `Inspected ${audits.length} image(s).` });
      } catch (err: any) {
        setStatus({ type: 'error', text: err?.message || 'Resolution check failed.' });
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    // Batch tools (Resize, Compress, Format Converter, Rotate/Flip, Watermark)
    setFiles(valid);
    if (isResizeTool && valid[0]) {
      const url = URL.createObjectURL(valid[0]);
      try {
        const img = await loadImageElement(url);
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        setResizeWidth(w);
        setResizeHeight(h);
        setSourceAspectRatio(w / Math.max(1, h));
      } finally {
        URL.revokeObjectURL(url);
      }
    }
    setStatus({
      type: 'info',
      text: `${valid.length} image(s) queued. Adjust settings below and click Process.`,
    });
  };

  // Cropper drag & resize handlers
  const handleAspectPreset = (preset: AspectPreset) => {
    setAspectPreset(preset);
    const found = ASPECT_RATIOS.find((a) => a.id === preset);
    if (!found || !found.ratio || !cropImgEl) return;
    const bounds = getTransformedBounds(cropImgEl, rotateDeg);
    const ratio = found.ratio;
    let newW = cropRect.width;
    let newH = Math.round(newW / ratio);
    if (newH > bounds.h) {
      newH = bounds.h;
      newW = Math.round(newH * ratio);
    }
    if (newW > bounds.w) {
      newW = bounds.w;
      newH = Math.round(newW / ratio);
    }
    setCropRect({
      x: Math.max(0, Math.min(bounds.w - newW, cropRect.x)),
      y: Math.max(0, Math.min(bounds.h - newH, cropRect.y)),
      width: Math.max(20, newW),
      height: Math.max(20, newH),
    });
  };

  const applyCropRotation = (delta: number) => {
    if (!cropImgEl) return;
    const nextDeg = (rotateDeg + delta + 360) % 360;
    setRotateDeg(nextDeg);
    const bounds = getTransformedBounds(cropImgEl, nextDeg);
    setCropNaturalDims(bounds);
    setCropRect({
      x: Math.round(bounds.w * 0.1),
      y: Math.round(bounds.h * 0.1),
      width: Math.round(bounds.w * 0.8),
      height: Math.round(bounds.h * 0.8),
    });
  };

  const startCropPointer = (
    e: React.PointerEvent,
    type: 'move' | 'nw' | 'ne' | 'sw' | 'se'
  ) => {
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragModeRef.current = {
      type,
      startX: e.clientX,
      startY: e.clientY,
      origRect: { ...cropRect },
    };
  };

  const moveCropPointer = (e: React.PointerEvent) => {
    const mode = dragModeRef.current;
    if (!mode.type || !cropBoxContainerRef.current) return;
    const rectEl = cropBoxContainerRef.current.getBoundingClientRect();
    const scaleX = cropNaturalDims.w / Math.max(1, rectEl.width);
    const scaleY = cropNaturalDims.h / Math.max(1, rectEl.height);
    const dx = (e.clientX - mode.startX) * scaleX;
    const dy = (e.clientY - mode.startY) * scaleY;
    const orig = mode.origRect;
    const minSize = 24;
    const ratio = ASPECT_RATIOS.find((a) => a.id === aspectPreset)?.ratio ?? null;

    if (mode.type === 'move') {
      const nx = Math.max(0, Math.min(cropNaturalDims.w - orig.width, orig.x + dx));
      const ny = Math.max(0, Math.min(cropNaturalDims.h - orig.height, orig.y + dy));
      setCropRect({ ...orig, x: Math.round(nx), y: Math.round(ny) });
      return;
    }

    let nx = orig.x;
    let ny = orig.y;
    let nw = orig.width;
    let nh = orig.height;

    if (mode.type === 'se') {
      nw = Math.max(minSize, Math.min(cropNaturalDims.w - orig.x, orig.width + dx));
      nh = ratio
        ? nw / ratio
        : Math.max(minSize, Math.min(cropNaturalDims.h - orig.y, orig.height + dy));
    } else if (mode.type === 'sw') {
      const maxDx = orig.width - minSize;
      const clampedDx = Math.max(-orig.x, Math.min(maxDx, dx));
      nx = orig.x + clampedDx;
      nw = orig.width - clampedDx;
      nh = ratio
        ? nw / ratio
        : Math.max(minSize, Math.min(cropNaturalDims.h - orig.y, orig.height + dy));
    } else if (mode.type === 'ne') {
      nw = Math.max(minSize, Math.min(cropNaturalDims.w - orig.x, orig.width + dx));
      if (ratio) {
        nh = nw / ratio;
        ny = Math.max(0, orig.y + orig.height - nh);
      } else {
        const maxDy = orig.height - minSize;
        const clampedDy = Math.max(-orig.y, Math.min(maxDy, dy));
        ny = orig.y + clampedDy;
        nh = orig.height - clampedDy;
      }
    } else if (mode.type === 'nw') {
      const maxDx = orig.width - minSize;
      const clampedDx = Math.max(-orig.x, Math.min(maxDx, dx));
      nx = orig.x + clampedDx;
      nw = orig.width - clampedDx;
      if (ratio) {
        nh = nw / ratio;
        ny = Math.max(0, orig.y + orig.height - nh);
      } else {
        const maxDy = orig.height - minSize;
        const clampedDy = Math.max(-orig.y, Math.min(maxDy, dy));
        ny = orig.y + clampedDy;
        nh = orig.height - clampedDy;
      }
    }

    if (ny + nh > cropNaturalDims.h) {
      nh = cropNaturalDims.h - ny;
      if (ratio) nw = nh * ratio;
    }

    setCropRect({
      x: Math.round(nx),
      y: Math.round(ny),
      width: Math.max(minSize, Math.round(nw)),
      height: Math.max(minSize, Math.round(nh)),
    });
  };

  const endCropPointer = () => {
    dragModeRef.current.type = null;
  };

  const handleGenerateCrop = async () => {
    if (!cropImgEl) return;
    setIsProcessing(true);
    setStatus(null);
    try {
      const res = await renderTransformedCrop(cropImgEl, cropRect, {
        rotateDeg,
        flipH,
        flipV,
        format: outputFormat,
        quality: quality / 100,
        backgroundColor: outputFormat === 'jpeg' ? matteColor : undefined,
      });
      if (cropResult?.url) URL.revokeObjectURL(cropResult.url);
      setCropResult({ url: res.url, blob: res.blob, w: res.width, h: res.height });
      setStatus({
        type: 'success',
        text: `Cropped image ready (${res.width}×${res.height}px · ${formatBytes(res.blob.size)}).`,
      });
    } catch (err: any) {
      setStatus({ type: 'error', text: err?.message || 'Failed to crop image.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Batch processing handler
  const handleRunBatch = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    setStatus(null);
    batchResults.forEach((r) => URL.revokeObjectURL(r.url));

    try {
      const out: BatchResultItem[] = [];
      const ext = outputFormat === 'jpeg' ? 'jpg' : outputFormat;

      for (const f of files) {
        const res = await resizeOrConvertImage(f, {
          targetWidth: isResizeTool ? resizeWidth : undefined,
          targetHeight: isResizeTool ? resizeHeight : undefined,
          maxWidth: isCompressTool && compressMaxWidth > 0 ? compressMaxWidth : undefined,
          format: outputFormat,
          quality: quality / 100,
          rotateDeg: isRotateFlipTool ? rotateDeg : 0,
          flipH: isRotateFlipTool ? flipH : false,
          flipV: isRotateFlipTool ? flipV : false,
          matteColor,
          watermark: isWatermarkTool
            ? {
                text: wmText,
                opacity: wmOpacity,
                fontSize: wmFontSize,
                color: wmColor,
                position: wmPosition,
              }
            : undefined,
        });

        const base = f.name.replace(/\.[^/.]+$/, '');
        out.push({
          id: Math.random().toString(36).slice(2, 9),
          originalName: f.name,
          outputName: `${base}-${tool.id}.${ext}`,
          originalSize: res.originalSize,
          finalSize: res.finalSize,
          width: res.width,
          height: res.height,
          url: res.url,
          blob: res.blob,
        });
      }

      setBatchResults(out);
      const totalOrig = out.reduce((s, r) => s + r.originalSize, 0);
      const totalFinal = out.reduce((s, r) => s + r.finalSize, 0);
      const deltaPct =
        totalOrig > 0 ? Math.round(((totalOrig - totalFinal) / totalOrig) * 100) : 0;
      setStatus({
        type: 'success',
        text:
          isCompressTool && deltaPct > 0
            ? `Compressed ${out.length} image(s): ${formatBytes(totalOrig)} → ${formatBytes(totalFinal)} (${deltaPct}% smaller).`
            : `Processed ${out.length} image(s) in ${ext.toUpperCase()} format.`,
      });
    } catch (err: any) {
      setStatus({ type: 'error', text: err?.message || 'Image batch processing failed.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadBatchZip = async () => {
    if (batchResults.length === 0) return;
    setIsZipping(true);
    try {
      const zip = new JSZip();
      batchResults.forEach((item) => zip.file(item.outputName, item.blob));
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${tool.id}-batch.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsZipping(false);
    }
  };

  // Interactive BG Remover pointer handler (Eyedropper / Keep / Erase Brush)
  const handleBgCanvasPointer = (e: React.PointerEvent<HTMLCanvasElement>, isStart: boolean) => {
    if (!bgImgEl || !bgCanvasRef.current) return;
    const canvas = bgCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(canvas.width - 1, Math.round(((e.clientX - rect.left) / rect.width) * canvas.width)));
    const y = Math.max(0, Math.min(canvas.height - 1, Math.round(((e.clientY - rect.top) / rect.height) * canvas.height)));

    if (bgBrushTool === 'eyedropper') {
      if (isStart) {
        setBgSeedPoints((prev) => [...prev.slice(-6), { x, y }]);
      }
      return;
    }

    if (isStart) isPaintingBgRef.current = true;
    if (!isPaintingBgRef.current) return;

    const w = canvas.width;
    const h = canvas.height;
    const radius = Math.max(2, Math.round((brushSize * w) / Math.max(1, rect.width)));
    const keep = keepMaskRef.current;
    const erase = eraseMaskRef.current;
    if (!keep || !erase) return;

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue;
        const px = x + dx;
        const py = y + dy;
        if (px < 0 || px >= w || py < 0 || py >= h) continue;
        const p = py * w + px;
        if (bgBrushTool === 'keep') {
          keep[p] = 1;
          erase[p] = 0;
        } else {
          erase[p] = 1;
          keep[p] = 0;
        }
      }
    }

    // Immediate live visual feedback on canvas
    const ctx = canvas.getContext('2d');
    if (ctx) {
      if (bgBrushTool === 'erase') {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(bgImgEl, 0, 0, w, h);
        ctx.restore();
      }
    }
  };

  const handleBgPointerEnd = () => {
    if (isPaintingBgRef.current && bgImgEl) {
      isPaintingBgRef.current = false;
      runBgRemoval(bgImgEl, bgMode, bgTolerance, bgFeather, bgSeedPoints, outputFormat);
    }
  };

  return (
    <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-6 sm:p-8 space-y-6">
      {/* Tool Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-[#2F3E4E]/15">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#CEE5DC] border-[1.5px] border-[#2F3E4E] text-[#2F3E4E] flex items-center justify-center shrink-0 mt-0.5">
            {isCropTool ? (
              <Crop className="w-5 h-5" />
            ) : isBgRemover ? (
              <Sparkles className="w-5 h-5" />
            ) : isCompressTool ? (
              <Minimize2 className="w-5 h-5" />
            ) : isWatermarkTool ? (
              <Stamp className="w-5 h-5" />
            ) : (
              <ImageIcon className="w-5 h-5" />
            )}
          </div>
          <div>
            <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
              {tool.categoryName} · {tool.code}
            </span>
            <h1 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] mt-0.5 tracking-tight">
              {tool.title}
            </h1>
            <p className="text-xs sm:text-sm text-[#475569] mt-0.5">{tool.description}</p>
          </div>
        </div>

        {(files.length > 0 || cropSrcUrl || bgSrcUrl) && (
          <button
            type="button"
            onClick={resetAll}
            className="px-3.5 py-2 text-xs font-bold text-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] rounded-lg cursor-pointer shrink-0 inline-flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Tool</span>
          </button>
        )}
      </div>

      {/* Upload Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files?.length) handleFilesSelected(e.dataTransfer.files);
        }}
        className={`border-2 border-dashed rounded-2xl p-7 text-center transition-colors ${
          isDragging
            ? 'border-[#1D4ED8] bg-[#CEE5DC]/55'
            : 'border-[#2F3E4E]/40 bg-[#FEF2C8]/45'
        }`}
      >
        <input
          type="file"
          id="image-studio-input"
          multiple={!isCropTool && !isBgRemover}
          accept="image/*"
          onChange={(e) => e.target.files && handleFilesSelected(e.target.files)}
          className="hidden"
        />

        <div className="mx-auto w-11 h-11 rounded-xl bg-white border-[1.5px] border-[#2F3E4E] flex items-center justify-center text-[#2F3E4E] mb-2.5">
          <UploadCloud className="w-5 h-5" />
        </div>
        <p className="font-display font-bold text-sm sm:text-base text-[#2F3E4E]">
          {isCropTool || isBgRemover
            ? 'Drag & drop an image (JPG, JPEG, PNG, WEBP)'
            : 'Drag & drop single or multiple images (JPG, PNG, WEBP, GIF, BMP)'}
        </p>
        <p className="text-xs text-[#475569] mt-1">
          Client-side HTML5 Canvas engine · Full quality &amp; transparency preserved
        </p>
        <label
          htmlFor="image-studio-input"
          className="mt-4 px-5 py-2.5 bg-[#2F3E4E] hover:bg-[#1E293B] text-[#FFFDF5] rounded-xl text-xs sm:text-sm font-bold cursor-pointer inline-flex items-center gap-2"
        >
          <UploadCloud className="w-4 h-4" />
          <span>{files.length > 0 ? 'Replace / Add Images' : 'Browse Images'}</span>
        </label>
      </div>

      {/* 1. INTERACTIVE CROP WORKSPACE */}
      {isCropTool && cropSrcUrl && cropImgEl && (
        <div className="space-y-5">
          {/* Aspect Ratio & Transform Toolbar */}
          <div className="p-4 bg-white border-[1.5px] border-[#2F3E4E] rounded-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {ASPECT_RATIOS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleAspectPreset(preset.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border border-[#2F3E4E] transition-colors cursor-pointer ${
                      aspectPreset === preset.id
                        ? 'bg-[#2F3E4E] text-[#FFFDF5]'
                        : 'bg-[#FEF2C8]/50 text-[#2F3E4E] hover:bg-[#F9C80E]'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => applyCropRotation(-90)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] inline-flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> 90°
                </button>
                <button
                  type="button"
                  onClick={() => applyCropRotation(90)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] inline-flex items-center gap-1 cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5" /> 90°
                </button>
                <button
                  type="button"
                  onClick={() => setFlipH((p) => !p)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border border-[#2F3E4E] inline-flex items-center gap-1 cursor-pointer ${
                    flipH ? 'bg-[#2F3E4E] text-[#FFFDF5]' : 'bg-white'
                  }`}
                >
                  <FlipHorizontal className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setFlipV((p) => !p)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border border-[#2F3E4E] inline-flex items-center gap-1 cursor-pointer ${
                    flipV ? 'bg-[#2F3E4E] text-[#FFFDF5]' : 'bg-white'
                  }`}
                >
                  <FlipVertical className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Interactive Crop Canvas Area */}
            <div className="flex justify-center bg-[#1E293B] rounded-xl p-4 overflow-hidden">
              <div
                ref={cropBoxContainerRef}
                onPointerMove={moveCropPointer}
                onPointerUp={endCropPointer}
                className="relative block select-none touch-none max-w-full"
                style={{
                  aspectRatio: `${cropNaturalDims.w} / ${Math.max(1, cropNaturalDims.h)}`,
                  width: `min(100%, calc(460px * ${cropNaturalDims.w} / ${Math.max(1, cropNaturalDims.h)}))`,
                  maxHeight: '460px',
                }}
              >
                <img
                  src={cropPreviewUrl || cropSrcUrl}
                  alt="Crop source"
                  className="w-full h-full object-contain block pointer-events-none"
                />

                {/* Interactive Draggable Crop Frame */}
                <div
                  onPointerDown={(e) => startCropPointer(e, 'move')}
                  style={{
                    left: `${(cropRect.x / Math.max(1, cropNaturalDims.w)) * 100}%`,
                    top: `${(cropRect.y / Math.max(1, cropNaturalDims.h)) * 100}%`,
                    width: `${(cropRect.width / Math.max(1, cropNaturalDims.w)) * 100}%`,
                    height: `${(cropRect.height / Math.max(1, cropNaturalDims.h)) * 100}%`,
                    boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.55)',
                  }}
                  className="absolute border-2 border-[#F9C80E] cursor-move"
                >
                  {/* Rule of thirds guide lines */}
                  <div className="absolute inset-x-0 top-1/3 border-t border-white/35 pointer-events-none" />
                  <div className="absolute inset-x-0 top-2/3 border-t border-white/35 pointer-events-none" />
                  <div className="absolute inset-y-0 left-1/3 border-l border-white/35 pointer-events-none" />
                  <div className="absolute inset-y-0 left-2/3 border-l border-white/35 pointer-events-none" />

                  {/* Corner Resize Handles */}
                  <div
                    onPointerDown={(e) => startCropPointer(e, 'nw')}
                    className="absolute -top-2 -left-2 w-4 h-4 bg-[#F9C80E] border-2 border-[#2F3E4E] rounded-sm cursor-nwse-resize"
                  />
                  <div
                    onPointerDown={(e) => startCropPointer(e, 'ne')}
                    className="absolute -top-2 -right-2 w-4 h-4 bg-[#F9C80E] border-2 border-[#2F3E4E] rounded-sm cursor-nesw-resize"
                  />
                  <div
                    onPointerDown={(e) => startCropPointer(e, 'sw')}
                    className="absolute -bottom-2 -left-2 w-4 h-4 bg-[#F9C80E] border-2 border-[#2F3E4E] rounded-sm cursor-nesw-resize"
                  />
                  <div
                    onPointerDown={(e) => startCropPointer(e, 'se')}
                    className="absolute -bottom-2 -right-2 w-4 h-4 bg-[#F9C80E] border-2 border-[#2F3E4E] rounded-sm cursor-nwse-resize"
                  />
                </div>
              </div>
            </div>

            {/* Output Settings & Apply Button */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <span className="font-mono font-bold text-[#2F3E4E] tabular-nums">
                  Crop Area: {cropRect.width} × {cropRect.height} px
                </span>
                <label className="flex items-center gap-1.5 font-bold text-[#2F3E4E]">
                  <span>Format:</span>
                  <select
                    value={outputFormat}
                    onChange={(e) => setOutputFormat(e.target.value as ImageOutputFormat)}
                    className="px-2.5 py-1.5 rounded-lg border border-[#2F3E4E] bg-white"
                  >
                    <option value="jpeg">JPG</option>
                    <option value="png">PNG (Transparent-Ready)</option>
                    <option value="webp">WEBP</option>
                  </select>
                </label>
                {outputFormat !== 'png' && (
                  <label className="flex items-center gap-2 font-bold text-[#2F3E4E]">
                    <span>Quality: {quality}%</span>
                    <input
                      type="range"
                      min={30}
                      max={100}
                      value={quality}
                      onChange={(e) => setQuality(Number(e.target.value))}
                    />
                  </label>
                )}
              </div>

              <button
                type="button"
                onClick={handleGenerateCrop}
                disabled={isProcessing}
                className="px-5 py-2.5 bg-[#2F3E4E] hover:bg-[#1E293B] text-[#FFFDF5] rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
              >
                <Crop className="w-4 h-4" />
                <span>Apply Crop &amp; Preview</span>
              </button>
            </div>
          </div>

          {cropResult && (
            <div className="p-5 bg-[#CEE5DC] border-[1.5px] border-[#2F3E4E] rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <img
                  src={cropResult.url}
                  alt="Cropped preview"
                  className="w-20 h-20 object-contain rounded-lg border border-[#2F3E4E] bg-white"
                />
                <div>
                  <p className="text-sm font-extrabold text-[#2F3E4E]">Cropped Output Ready</p>
                  <p className="text-xs text-[#334155] font-mono tabular-nums mt-0.5">
                    {cropResult.w} × {cropResult.h} px · {formatBytes(cropResult.blob.size)}
                  </p>
                </div>
              </div>
              <a
                href={cropResult.url}
                download={`${files[0]?.name.replace(/\.[^/.]+$/, '') || 'cropped'}-crop.${outputFormat === 'jpeg' ? 'jpg' : outputFormat}`}
                className="px-5 py-2.5 bg-[#2F3E4E] hover:bg-[#1E293B] text-[#FFFDF5] rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Download {outputFormat === 'jpeg' ? 'JPG' : outputFormat.toUpperCase()}</span>
              </a>
            </div>
          )}
        </div>
      )}

      {/* 2. IMAGE BACKGROUND REMOVER (NORMAL & ADVANCED) */}
      {isBgRemover && bgSrcUrl && (
        <div className="space-y-5">
          <div className="p-5 bg-white border-[1.5px] border-[#2F3E4E] rounded-xl space-y-5">
            {/* Mode Switcher: Normal vs Advanced */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="inline-flex p-1 bg-[#FEF2C8] border border-[#2F3E4E] rounded-xl">
                <button
                  type="button"
                  onClick={() => setBgMode('normal')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    bgMode === 'normal' ? 'bg-[#2F3E4E] text-[#FFFDF5]' : 'text-[#2F3E4E]'
                  }`}
                >
                  Normal Mode (Fast Edge Flood)
                </button>
                <button
                  type="button"
                  onClick={() => setBgMode('advanced')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    bgMode === 'advanced' ? 'bg-[#2F3E4E] text-[#FFFDF5]' : 'text-[#2F3E4E]'
                  }`}
                >
                  Advanced Mode (CIELAB Edge Matting)
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-bold text-[#475569]">Backdrop:</span>
                {(['checker', 'white', 'dark'] as const).map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBgPreviewBackdrop(b)}
                    className={`px-2.5 py-1 rounded border border-[#2F3E4E] font-semibold capitalize cursor-pointer ${
                      bgPreviewBackdrop === b ? 'bg-[#F9C80E] text-[#2F3E4E]' : 'bg-white'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            {/* Sliders & Interactive Brush Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#2F3E4E]/15">
                <label className="font-bold text-[#2F3E4E] flex justify-between mb-1">
                  <span>Color Tolerance</span>
                  <span className="font-mono">{bgTolerance}</span>
                </label>
                <input
                  type="range"
                  min={8}
                  max={110}
                  value={bgTolerance}
                  onChange={(e) => setBgTolerance(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#2F3E4E]/15">
                <label className="font-bold text-[#2F3E4E] flex justify-between mb-1">
                  <span>Edge Feathering</span>
                  <span className="font-mono">{bgFeather} px</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={6}
                  value={bgFeather}
                  onChange={(e) => setBgFeather(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#2F3E4E]/15 space-y-1.5">
                <div className="font-bold text-[#2F3E4E]">Interactive Canvas Tool</div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setBgBrushTool('eyedropper')}
                    className={`px-2.5 py-1 rounded border border-[#2F3E4E] font-bold inline-flex items-center gap-1 cursor-pointer ${
                      bgBrushTool === 'eyedropper' ? 'bg-[#2F3E4E] text-[#FFFDF5]' : 'bg-white'
                    }`}
                  >
                    <Pipette className="w-3 h-3" /> Pick BG
                  </button>
                  <button
                    type="button"
                    onClick={() => setBgBrushTool('keep')}
                    className={`px-2.5 py-1 rounded border border-[#2F3E4E] font-bold inline-flex items-center gap-1 cursor-pointer ${
                      bgBrushTool === 'keep' ? 'bg-[#2F3E4E] text-[#FFFDF5]' : 'bg-white'
                    }`}
                  >
                    <Paintbrush className="w-3 h-3" /> Keep
                  </button>
                  <button
                    type="button"
                    onClick={() => setBgBrushTool('erase')}
                    className={`px-2.5 py-1 rounded border border-[#2F3E4E] font-bold inline-flex items-center gap-1 cursor-pointer ${
                      bgBrushTool === 'erase' ? 'bg-[#2F3E4E] text-[#FFFDF5]' : 'bg-white'
                    }`}
                  >
                    <Eraser className="w-3 h-3" /> Erase
                  </button>
                </div>
                {bgBrushTool !== 'eyedropper' && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[11px]">Brush {brushSize}px</span>
                    <input
                      type="range"
                      min={6}
                      max={64}
                      value={brushSize}
                      onChange={(e) => setBrushSize(Number(e.target.value))}
                      className="flex-1"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Side-by-Side Original & Live Cutout Canvas */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <p className="text-xs font-bold text-[#475569]">Original Image</p>
                <div className="border border-[#2F3E4E]/25 rounded-xl bg-[#F8FAFC] p-3 flex items-center justify-center min-h-[260px]">
                  <img src={bgSrcUrl} alt="Original" className="max-h-[340px] object-contain" />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#2F3E4E]">
                    Cutout Preview ({bgBrushTool === 'eyedropper' ? 'Click background to sample' : 'Paint to refine'})
                  </span>
                  {bgSeedPoints.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setBgSeedPoints([])}
                      className="text-[11px] font-bold underline text-[#1D4ED8] cursor-pointer"
                    >
                      Reset Picked Points
                    </button>
                  )}
                </div>
                <div
                  className="border border-[#2F3E4E]/25 rounded-xl p-3 flex items-center justify-center min-h-[260px]"
                  style={{
                    backgroundColor:
                      bgPreviewBackdrop === 'white'
                        ? '#FFFFFF'
                        : bgPreviewBackdrop === 'dark'
                        ? '#0F172A'
                        : '#F1F5F9',
                    backgroundImage:
                      bgPreviewBackdrop === 'checker'
                        ? 'linear-gradient(45deg, #CBD5E1 25%, transparent 25%), linear-gradient(-45deg, #CBD5E1 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #CBD5E1 75%), linear-gradient(-45deg, transparent 75%, #CBD5E1 75%)'
                        : undefined,
                    backgroundSize: '18px 18px',
                    backgroundPosition: '0 0, 0 9px, 9px -9px, -9px 0',
                  }}
                >
                  <canvas
                    ref={bgCanvasRef}
                    onPointerDown={(e) => handleBgCanvasPointer(e, true)}
                    onPointerMove={(e) => handleBgCanvasPointer(e, false)}
                    onPointerUp={handleBgPointerEnd}
                    onPointerLeave={handleBgPointerEnd}
                    className="max-h-[340px] max-w-full object-contain cursor-crosshair touch-none"
                  />
                </div>
              </div>
            </div>

            {bgResultUrl && bgResultBlob && (
              <div className="p-4 bg-[#CEE5DC] border-[1.5px] border-[#2F3E4E] rounded-xl flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3 text-xs">
                  <span className="font-bold text-[#2F3E4E]">
                    Transparent Cutout Ready · {formatBytes(bgResultBlob.size)}
                  </span>
                  <select
                    value={outputFormat === 'jpeg' ? 'png' : outputFormat}
                    onChange={(e) => setOutputFormat(e.target.value as ImageOutputFormat)}
                    className="px-2.5 py-1 rounded border border-[#2F3E4E] bg-white font-bold"
                  >
                    <option value="png">Transparent PNG</option>
                    <option value="webp">Transparent WEBP</option>
                  </select>
                </div>
                <a
                  href={bgResultUrl}
                  download={`${files[0]?.name.replace(/\.[^/.]+$/, '') || 'cutout'}-nobg.${outputFormat === 'webp' ? 'webp' : 'png'}`}
                  className="px-5 py-2.5 bg-[#2F3E4E] hover:bg-[#1E293B] text-[#FFFDF5] rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Cutout</span>
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. BATCH TOOLS (Resize, Compress, Format Converter, Rotate/Flip, Watermark) */}
      {(isResizeTool || isCompressTool || isConverterTool || isRotateFlipTool || isWatermarkTool) &&
        files.length > 0 && (
          <div className="p-5 bg-white border-[1.5px] border-[#2F3E4E] rounded-xl space-y-5">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#2F3E4E]/15">
              <span className="text-xs font-bold text-[#2F3E4E] flex items-center gap-2">
                <Sliders className="w-4 h-4" />
                {files.length} Image(s) Loaded
              </span>
              <span className="text-xs font-mono text-[#475569] tabular-nums">
                Total Input: {formatBytes(files.reduce((s, f) => s + f.size, 0))}
              </span>
            </div>

            {isResizeTool && (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div>
                    <label className="font-bold text-[#2F3E4E] block mb-1">Width (px)</label>
                    <input
                      type="number"
                      min={1}
                      max={10000}
                      value={resizeWidth}
                      onChange={(e) => {
                        const w = Math.max(1, Number(e.target.value));
                        setResizeWidth(w);
                        if (lockAspect) setResizeHeight(Math.max(1, Math.round(w / sourceAspectRatio)));
                      }}
                      className="w-full px-3 py-2 border border-[#2F3E4E] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-[#2F3E4E] block mb-1">Height (px)</label>
                    <input
                      type="number"
                      min={1}
                      max={10000}
                      value={resizeHeight}
                      onChange={(e) => {
                        const h = Math.max(1, Number(e.target.value));
                        setResizeHeight(h);
                        if (lockAspect) setResizeWidth(Math.max(1, Math.round(h * sourceAspectRatio)));
                      }}
                      className="w-full px-3 py-2 border border-[#2F3E4E] rounded-lg"
                    />
                  </div>
                  <label className="flex items-center gap-2 py-2 font-bold text-[#2F3E4E] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={lockAspect}
                      onChange={(e) => setLockAspect(e.target.checked)}
                    />
                    <span>Lock Aspect Ratio</span>
                  </label>
                </div>

                <div className="flex flex-wrap gap-2">
                  {[
                    { label: '1920×1080 HD', w: 1920, h: 1080 },
                    { label: '1080×1080 Square', w: 1080, h: 1080 },
                    { label: '1200×630 Social', w: 1200, h: 630 },
                    { label: '800×600 Web', w: 800, h: 600 },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        setLockAspect(false);
                        setResizeWidth(p.w);
                        setResizeHeight(p.h);
                      }}
                      className="px-3 py-1.5 rounded-lg border border-[#2F3E4E]/40 bg-[#FEF2C8]/60 hover:bg-[#F9C80E] font-semibold cursor-pointer"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isCompressTool && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="font-bold text-[#2F3E4E] flex justify-between mb-1">
                    <span>Compression Quality</span>
                    <span className="font-mono">{quality}%</span>
                  </label>
                  <input
                    type="range"
                    min={10}
                    max={100}
                    value={quality}
                    onChange={(e) => setQuality(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#2F3E4E] block mb-1">
                    Max Width Cap (0 = Keep Original)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={8000}
                    value={compressMaxWidth}
                    onChange={(e) => setCompressMaxWidth(Math.max(0, Number(e.target.value)))}
                    className="w-full px-3 py-2 border border-[#2F3E4E] rounded-lg"
                  />
                </div>
              </div>
            )}

            {isRotateFlipTool && (
              <div className="flex flex-wrap items-center gap-3 text-xs">
                {[0, 90, 180, 270].map((deg) => (
                  <button
                    key={deg}
                    type="button"
                    onClick={() => setRotateDeg(deg)}
                    className={`px-3.5 py-2 rounded-lg border border-[#2F3E4E] font-bold cursor-pointer ${
                      rotateDeg === deg ? 'bg-[#2F3E4E] text-[#FFFDF5]' : 'bg-white'
                    }`}
                  >
                    Rotate {deg}°
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setFlipH((p) => !p)}
                  className={`px-3.5 py-2 rounded-lg border border-[#2F3E4E] font-bold inline-flex items-center gap-1.5 cursor-pointer ${
                    flipH ? 'bg-[#2F3E4E] text-[#FFFDF5]' : 'bg-white'
                  }`}
                >
                  <FlipHorizontal className="w-3.5 h-3.5" /> Flip Horizontal
                </button>
                <button
                  type="button"
                  onClick={() => setFlipV((p) => !p)}
                  className={`px-3.5 py-2 rounded-lg border border-[#2F3E4E] font-bold inline-flex items-center gap-1.5 cursor-pointer ${
                    flipV ? 'bg-[#2F3E4E] text-[#FFFDF5]' : 'bg-white'
                  }`}
                >
                  <FlipVertical className="w-3.5 h-3.5" /> Flip Vertical
                </button>
              </div>
            )}

            {isWatermarkTool && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="font-bold text-[#2F3E4E] block mb-1">Watermark Text</label>
                  <input
                    type="text"
                    value={wmText}
                    onChange={(e) => setWmText(e.target.value)}
                    className="w-full px-3 py-2 border border-[#2F3E4E] rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#2F3E4E] block mb-1">Placement</label>
                  <select
                    value={wmPosition}
                    onChange={(e) => setWmPosition(e.target.value as any)}
                    className="w-full px-3 py-2 border border-[#2F3E4E] rounded-lg bg-white"
                  >
                    <option value="bottom-right">Bottom Right</option>
                    <option value="bottom-left">Bottom Left</option>
                    <option value="center">Center Diagonal</option>
                    <option value="tiled">Tiled Grid</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-[#2F3E4E] block mb-1">
                    Opacity ({Math.round(wmOpacity * 100)}%)
                  </label>
                  <input
                    type="range"
                    min={0.1}
                    max={0.9}
                    step={0.05}
                    value={wmOpacity}
                    onChange={(e) => setWmOpacity(Number(e.target.value))}
                    className="w-full mt-2"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#2F3E4E] block mb-1">Text Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={wmColor}
                      onChange={(e) => setWmColor(e.target.value)}
                      className="w-10 h-9 rounded border border-[#2F3E4E]"
                    />
                    <input
                      type="number"
                      min={14}
                      max={120}
                      value={wmFontSize}
                      onChange={(e) => setWmFontSize(Number(e.target.value))}
                      className="w-full px-2.5 py-2 border border-[#2F3E4E] rounded-lg"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Common Output Format & Quality */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-[#2F3E4E]/15 text-xs">
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 font-bold text-[#2F3E4E]">
                  <span>Output Format:</span>
                  <select
                    value={outputFormat}
                    onChange={(e) => setOutputFormat(e.target.value as ImageOutputFormat)}
                    className="px-3 py-1.5 rounded-lg border border-[#2F3E4E] bg-white"
                  >
                    <option value="jpeg">JPG / JPEG</option>
                    <option value="png">PNG (Lossless / Alpha)</option>
                    <option value="webp">WEBP (Modern Compressed)</option>
                  </select>
                </label>

                {outputFormat === 'jpeg' && (
                  <label className="flex items-center gap-1.5 font-bold text-[#2F3E4E]">
                    <span>Alpha Fill:</span>
                    <input
                      type="color"
                      value={matteColor}
                      onChange={(e) => setMatteColor(e.target.value)}
                      className="w-7 h-7 rounded border border-[#2F3E4E]"
                    />
                  </label>
                )}

                {outputFormat !== 'png' && !isCompressTool && (
                  <label className="flex items-center gap-2 font-bold text-[#2F3E4E]">
                    <span>Quality: {quality}%</span>
                    <input
                      type="range"
                      min={20}
                      max={100}
                      value={quality}
                      onChange={(e) => setQuality(Number(e.target.value))}
                    />
                  </label>
                )}
              </div>

              <button
                type="button"
                onClick={handleRunBatch}
                disabled={isProcessing}
                className="px-5 py-2.5 bg-[#2F3E4E] hover:bg-[#1E293B] text-[#FFFDF5] rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
              >
                {isProcessing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Layers className="w-4 h-4" />
                )}
                <span>Process {files.length} Image(s)</span>
              </button>
            </div>
          </div>
        )}

      {/* Batch Results List */}
      {batchResults.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display font-bold text-base text-[#2F3E4E]">
              Processed Outputs ({batchResults.length})
            </h3>
            {batchResults.length > 1 && (
              <button
                type="button"
                onClick={handleDownloadBatchZip}
                disabled={isZipping}
                className="px-4 py-2 bg-[#F9C80E] hover:bg-[#FFE1B3] text-[#2F3E4E] border-[1.5px] border-[#2F3E4E] rounded-xl text-xs font-extrabold inline-flex items-center gap-2 cursor-pointer"
              >
                <Archive className="w-4 h-4" />
                <span>Download All as ZIP</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {batchResults.map((item) => {
              const savedPct = Math.round(
                ((item.originalSize - item.finalSize) / Math.max(1, item.originalSize)) * 100
              );
              return (
                <div
                  key={item.id}
                  className="bg-white border-[1.5px] border-[#2F3E4E] rounded-xl p-3.5 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={item.url}
                      alt={item.outputName}
                      className="w-16 h-16 object-contain rounded-lg border border-[#2F3E4E]/20 bg-[#F8FAFC] shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#2F3E4E] truncate">{item.outputName}</p>
                      <p className="text-[11px] text-[#475569] font-mono tabular-nums mt-0.5">
                        {item.width}×{item.height}px
                      </p>
                      <p className="text-[11px] font-mono tabular-nums text-[#334155] mt-0.5">
                        {formatBytes(item.originalSize)} → <strong>{formatBytes(item.finalSize)}</strong>
                        {savedPct > 0 ? ` (-${savedPct}%)` : ''}
                      </p>
                    </div>
                  </div>

                  <a
                    href={item.url}
                    download={item.outputName}
                    className="px-3.5 py-2 bg-[#2F3E4E] hover:bg-[#1E293B] text-[#FFFDF5] rounded-lg text-xs font-bold inline-flex items-center gap-1.5 shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Save</span>
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. IMAGE RESOLUTION CHECKER */}
      {isResolutionChecker && resolutionAudits.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {resolutionAudits.map((audit) => (
            <div
              key={audit.id}
              className="bg-white border-[1.5px] border-[#2F3E4E] rounded-xl p-4 flex gap-4 items-start"
            >
              <img
                src={audit.previewUrl}
                alt={audit.name}
                className="w-20 h-20 object-contain rounded-lg border border-[#2F3E4E]/20 bg-[#F8FAFC] shrink-0"
              />
              <div className="space-y-1 text-xs min-w-0 flex-1">
                <p className="font-bold text-[#2F3E4E] truncate">{audit.name}</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1 font-mono text-[11px] text-[#334155]">
                  <span>Dimensions: <strong>{audit.width}×{audit.height}</strong></span>
                  <span>Aspect: <strong>{audit.aspectRatio}</strong></span>
                  <span>Megapixels: <strong>{audit.megapixels} MP</strong></span>
                  <span>Size: <strong>{formatBytes(audit.sizeBytes)}</strong></span>
                  <span>Alpha Channel: <strong>{audit.hasAlpha ? 'Yes' : 'No'}</strong></span>
                  <span>300 DPI Print: <strong>{(audit.width / 300).toFixed(1)}×{(audit.height / 300).toFixed(1)} in</strong></span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Status Banner */}
      {status && (
        <div
          className={`p-4 rounded-xl border-[1.5px] flex items-center gap-3 text-xs font-semibold ${
            status.type === 'success'
              ? 'bg-[#CEE5DC]/75 border-[#2F3E4E] text-[#2F3E4E]'
              : status.type === 'info'
              ? 'bg-[#FEF2C8] border-[#2F3E4E] text-[#2F3E4E]'
              : 'bg-red-50 border-red-600 text-red-800'
          }`}
        >
          {status.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-700 shrink-0" />
          ) : status.type === 'info' ? (
            <Info className="w-4 h-4 text-[#2F3E4E] shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-700 shrink-0" />
          )}
          <span>{status.text}</span>
        </div>
      )}
    </div>
  );
};
