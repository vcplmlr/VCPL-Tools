import React, { useEffect, useRef, useState } from 'react';
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import JSZip from 'jszip';
import { encryptPDF } from '@pdfsmaller/pdf-encrypt';
import { decryptPDF } from '@pdfsmaller/pdf-decrypt';
import {
  AlertCircle,
  Archive,
  ArrowDown,
  ArrowUp,
  CheckCircle,
  Download,
  Edit,
  FileText,
  Hash,
  Image as ImageIcon,
  Info,
  Layers,
  Lock,
  Maximize,
  PenTool,
  RefreshCw,
  Scissors,
  Stamp,
  Trash2,
  Unlock,
} from 'lucide-react';
import { ToolCatalogItem } from '../../types/tools';
import { ConvertedPdfPage, sanitizeWinAnsi } from '../../utils/pdfOperations';
import { FileDropZone } from './FileDropZone';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface PdfEngineViewProps {
  tool: ToolCatalogItem;
}

export const PdfEngineView: React.FC<PdfEngineViewProps> = ({ tool }) => {
  const getInitialFormat = (t: ToolCatalogItem): 'jpg' | 'png' | 'webp' => {
    if (t.id === 'pdf-to-webp' || t.title.toLowerCase().includes('webp')) return 'webp';
    if (t.id === 'pdf-to-png' || t.title.toLowerCase().includes('png')) return 'png';
    return 'jpg';
  };
  const [imageFormat, setImageFormat] = useState<'jpg' | 'png' | 'webp'>(() =>
    getInitialFormat(tool)
  );
  const isPng = imageFormat === 'png';
  const isWebp = imageFormat === 'webp';
  const imgFormat = isPng ? 'image/png' : isWebp ? 'image/webp' : 'image/jpeg';
  const imgExtension = isPng ? 'png' : isWebp ? 'webp' : 'jpg';

  const isMerger = tool.id === 'pdf-merger';
  const isImageToPdf =
    tool.id === 'image-to-pdf' ||
    tool.id === 'jpg-to-pdf' ||
    tool.id === 'png-to-pdf' ||
    tool.id === 'webp-to-pdf';
  const isPdfToImage =
    tool.id === 'pdf-to-jpg' || tool.id === 'pdf-to-png' || tool.id === 'pdf-to-webp';
  const isSplitter = tool.id === 'pdf-splitter';
  const isDeleter = tool.id === 'pdf-page-deleter';
  const isReorder = tool.id === 'pdf-page-reorder';
  const isRotator = tool.id === 'pdf-page-rotator';
  const isWatermark = tool.id === 'pdf-watermark-maker';
  const isNumbering = tool.id === 'pdf-page-numbering';
  const isSigner = tool.id === 'pdf-signer';
  const isFormFiller = tool.id === 'pdf-form-filler';
  const isMetadataViewer = tool.id === 'pdf-metadata-viewer';
  const isMetadataEditor = tool.id === 'pdf-metadata-editor';
  const isCropper = tool.id === 'pdf-cropper';
  const isPageSizeChanger = tool.id === 'pdf-page-size-changer';
  const isUnlocker = tool.id === 'pdf-unlocker';
  const isProtector = tool.id === 'pdf-password-protector';
  const isCompressor = tool.id === 'pdf-compressor';
  const isFlattenRepair = tool.id === 'pdf-flatten-repair';

  // Single PDF state
  const [file, setFile] = useState<File | null>(null);
  const [fileBytes, setFileBytes] = useState<ArrayBuffer | null>(null);
  const [fileSizeKb, setFileSizeKb] = useState<number>(0);
  const [pageCount, setPageCount] = useState<number>(0);
  const [pageThumbnails, setPageThumbnails] = useState<{ pageNum: number; dataUrl: string }[]>([]);

  // Merger state
  const [mergeFiles, setMergeFiles] = useState<
    { id: string; file: File; bytes: ArrayBuffer; sizeKb: number; pages: number }[]
  >([]);

  // Image to PDF state
  const [imgFiles, setImgFiles] = useState<{ id: string; file: File; url: string }[]>([]);
  const [imgOrientation, setImgOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [imgMargin, setImgMargin] = useState<number>(20);

  // PDF to JPG / PNG / WEBP state
  const [convertedPages, setConvertedPages] = useState<ConvertedPdfPage[]>([]);
  const [imageDpi, setImageDpi] = useState<number>(200);
  const [pdfImageRange, setPdfImageRange] = useState<string>('');
  const [convertingProgress, setConvertingProgress] = useState<{ current: number; total: number } | null>(
    null
  );
  const [isZipping, setIsZipping] = useState<boolean>(false);

  // Page ops state
  const [splitRange, setSplitRange] = useState<string>('1');
  const [selectedPagesToExtract, setSelectedPagesToExtract] = useState<number[]>([]);
  const [selectedPagesToDelete, setSelectedPagesToDelete] = useState<number[]>([]);
  const [pageOrder, setPageOrder] = useState<number[]>([]);
  const [rotationAngle, setRotationAngle] = useState<number>(90);
  const [rotateTargetPage, setRotateTargetPage] = useState<'all' | number>('all');

  // Signer state
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [signPage, setSignPage] = useState<number>(1);
  const [signPosition, setSignPosition] = useState<
    'bottom-right' | 'bottom-center' | 'bottom-left' | 'center'
  >('bottom-right');
  const [sigInkColor, setSigInkColor] = useState<'#000000' | '#1e40af'>('#000000');
  const [isDrawingSig, setIsDrawingSig] = useState<boolean>(false);
  const sigPadRef = useRef<HTMLCanvasElement | null>(null);

  // Form filler state
  const [formText, setFormText] = useState<string>('');
  const [formPage, setFormPage] = useState<number>(1);
  const [formPosX, setFormPosX] = useState<number>(60);
  const [formPosY, setFormPosY] = useState<number>(750);
  const [formFontSize, setFormFontSize] = useState<number>(12);

  // Watermark & numbering state
  const [watermarkText, setWatermarkText] = useState<string>('CONFIDENTIAL');
  const [watermarkOpacity, setWatermarkOpacity] = useState<number>(0.2);
  const [watermarkColor, setWatermarkColor] = useState<'grey' | 'red' | 'blue'>('grey');
  const [numberingFormat, setNumberingFormat] = useState<'page-x-of-y' | 'page-x' | 'bates'>(
    'page-x-of-y'
  );
  const [numberingPos, setNumberingPos] = useState<'bottom-center' | 'bottom-right' | 'top-right'>(
    'bottom-center'
  );
  const [numberingStart, setNumberingStart] = useState<number>(1);

  // Metadata state
  const [metaTitle, setMetaTitle] = useState<string>('');
  const [metaAuthor, setMetaAuthor] = useState<string>('');
  const [metaSubject, setMetaSubject] = useState<string>('');
  const [metaKeywords, setMetaKeywords] = useState<string>('');
  const [metaProducer, setMetaProducer] = useState<string>('');

  // Cropper & size changer state
  const [cropMarginPercent, setCropMarginPercent] = useState<number>(10);
  const [targetPageSize, setTargetPageSize] = useState<'a4' | 'letter' | 'legal'>('a4');

  // Security state
  const [unlockPassword, setUnlockPassword] = useState<string>('');
  const [protectPassword, setProtectPassword] = useState<string>('');
  const [confirmProtectPassword, setConfirmProtectPassword] = useState<string>('');

  // Processing state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [outputSizeKb, setOutputSizeKb] = useState<number>(0);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(
    null
  );

  const resetAll = () => {
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    imgFiles.forEach((item) => URL.revokeObjectURL(item.url));
    setFile(null);
    setFileBytes(null);
    setFileSizeKb(0);
    setPageCount(0);
    setPageThumbnails([]);
    setMergeFiles([]);
    setImgFiles([]);
    setConvertedPages([]);
    setPdfImageRange('');
    setConvertingProgress(null);
    setSelectedPagesToDelete([]);
    setSelectedPagesToExtract([]);
    setSplitRange('1');
    setPageOrder([]);
    setRotateTargetPage('all');
    setSignPage(1);
    setFormPage(1);
    setSignatureDataUrl(null);
    setOutputUrl(null);
    setOutputSizeKb(0);
    setStatusMsg(null);
    setUnlockPassword('');
    setProtectPassword('');
    setConfirmProtectPassword('');
  };

  useEffect(() => {
    resetAll();
    setImageFormat(getInitialFormat(tool));
  }, [tool.id]);

  const setOutputFromBytes = (bytes: Uint8Array) => {
    const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    setOutputUrl(URL.createObjectURL(blob));
    setOutputSizeKb(Math.max(1, Math.round(blob.size / 1024)));
    return Math.max(1, Math.round(blob.size / 1024));
  };

  const getWorkingBytes = async (): Promise<Uint8Array | null> => {
    if (file) {
      try {
        return new Uint8Array(await file.arrayBuffer());
      } catch (e) {
        console.warn('Could not re-read file:', e);
      }
    }
    if (fileBytes && fileBytes.byteLength > 0) {
      return new Uint8Array(fileBytes.slice(0));
    }
    return null;
  };

  const generateThumbnails = async (buffer: ArrayBuffer, total: number) => {
    try {
      const cloned = new Uint8Array(buffer.slice(0));
      const pdf = await pdfjsLib.getDocument({ data: cloned }).promise;
      const thumbs: { pageNum: number; dataUrl: string }[] = [];
      const maxPages = Math.min(total, 16);

      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 0.3 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: ctx as any, canvas, viewport } as any).promise;
          thumbs.push({ pageNum: i, dataUrl: canvas.toDataURL('image/jpeg', 0.8) });
        }
      }
      setPageThumbnails(thumbs);
    } catch (err) {
      console.error('Thumbnail generation error:', err);
    }
  };

  const parsePageIndices = (rangeStr: string, total: number): number[] => {
    const trimmedAll = rangeStr.trim();
    if (!trimmedAll) {
      return Array.from({ length: total }, (_, idx) => idx + 1);
    }
    const set = new Set<number>();
    for (const part of trimmedAll.split(',')) {
      const item = part.trim();
      if (!item) continue;
      if (item.includes('-')) {
        const [aStr, bStr] = item.split('-');
        const a = parseInt(aStr, 10);
        const b = parseInt(bStr, 10);
        if (!isNaN(a) && !isNaN(b)) {
          for (let p = Math.max(1, a); p <= Math.min(total, b); p++) set.add(p);
        }
      } else {
        const p = parseInt(item, 10);
        if (!isNaN(p) && p >= 1 && p <= total) set.add(p);
      }
    }
    return set.size > 0
      ? Array.from(set).sort((a, b) => a - b)
      : Array.from({ length: total }, (_, idx) => idx + 1);
  };

  const convertBufferToImages = async (
    buffer: ArrayBuffer,
    totalCount?: number,
    dpi = imageDpi,
    rangeOverride?: string
  ) => {
    try {
      setIsProcessing(true);
      setConvertedPages([]);
      const scale = dpi / 72;
      const cloned = new Uint8Array(buffer.slice(0));
      const pdfDoc = await pdfjsLib.getDocument({ data: cloned }).promise;
      const total = totalCount || pdfDoc.numPages;
      const pagesToRender = parsePageIndices(rangeOverride ?? pdfImageRange, total);
      const results: ConvertedPdfPage[] = [];

      for (let idx = 0; idx < pagesToRender.length; idx++) {
        const i = pagesToRender[idx];
        setConvertingProgress({ current: idx + 1, total: pagesToRender.length });
        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: ctx as any, canvas, viewport } as any).promise;
          const dataUrl = canvas.toDataURL(imgFormat, isPng ? undefined : 0.92);
          results.push({
            pageNum: i,
            dataUrl,
            width: canvas.width,
            height: canvas.height,
            sizeKb: Math.round((dataUrl.length * 3) / 4 / 1024),
          });
        }
      }

      setConvertedPages(results);
      setStatusMsg({
        type: 'success',
        text: `Converted ${results.length} page(s) to ${imgExtension.toUpperCase()} at ${dpi} DPI.`,
      });
    } catch (err) {
      console.error(err);
      setStatusMsg({ type: 'error', text: `Failed to convert PDF pages to ${imgExtension.toUpperCase()}.` });
    } finally {
      setIsProcessing(false);
      setConvertingProgress(null);
    }
  };

  const loadSinglePdfFile = async (uploaded: File) => {
    if (uploaded.type !== 'application/pdf' && !uploaded.name.toLowerCase().endsWith('.pdf')) {
      setStatusMsg({ type: 'error', text: 'Please select a valid PDF file.' });
      return;
    }

    try {
      setIsProcessing(true);
      const buffer = await uploaded.arrayBuffer();
      setFile(uploaded);
      setFileBytes(buffer.slice(0));
      setFileSizeKb(Math.max(1, Math.round(uploaded.size / 1024)));

      let count = 1;
      try {
        const pdfDoc = await PDFDocument.load(buffer.slice(0), { ignoreEncryption: true });
        count = pdfDoc.getPageCount();
        setPageCount(count);
        setPageOrder(Array.from({ length: count }, (_, i) => i + 1));
        setSelectedPagesToDelete([]);
        setSelectedPagesToExtract([]);
        setSplitRange('1');
        setRotateTargetPage('all');
        setSignPage(1);
        setFormPage(1);
        setConvertedPages([]);
        setMetaTitle(pdfDoc.getTitle() || '');
        setMetaAuthor(pdfDoc.getAuthor() || '');
        setMetaSubject(pdfDoc.getSubject() || '');
        setMetaKeywords(pdfDoc.getKeywords() || '');
        setMetaProducer(pdfDoc.getProducer() || '');

        if (pdfDoc.isEncrypted && !isUnlocker) {
          setStatusMsg({
            type: 'error',
            text: 'Notice: This PDF is password-protected. Unlock it first using the PDF Unlocker tool.',
          });
        } else {
          setStatusMsg(null);
        }
      } catch {
        setStatusMsg({
          type: isUnlocker ? 'info' : 'error',
          text: isUnlocker
            ? 'Locked PDF loaded. Enter the document password below to decrypt.'
            : 'This PDF appears encrypted. Use PDF Unlocker first before editing.',
        });
      }

      generateThumbnails(buffer.slice(0), count);
      if (isPdfToImage) convertBufferToImages(buffer.slice(0), count, imageDpi);
    } catch (err) {
      console.error(err);
      setStatusMsg({ type: 'error', text: 'Could not read this PDF document.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSingleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploaded = e.target.files?.[0];
    if (uploaded) await loadSinglePdfFile(uploaded);
    e.target.value = '';
  };

  const loadMergePdfFiles = async (files: File[]) => {
    if (!files.length) return;
    const newItems: { id: string; file: File; bytes: ArrayBuffer; sizeKb: number; pages: number }[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) {
        const bytes = await f.arrayBuffer();
        let pages = 1;
        try {
          const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
          pages = doc.getPageCount();
        } catch {
          pages = 1;
        }
        newItems.push({
          id: Math.random().toString(36).substring(2, 9),
          file: f,
          bytes,
          sizeKb: Math.max(1, Math.round(f.size / 1024)),
          pages,
        });
      }
    }
    setMergeFiles((prev) => [...prev, ...newItems]);
  };

  const handleMergeFilesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await loadMergePdfFiles(Array.from(e.target.files ?? []));
    e.target.value = '';
  };

  const moveMergeFile = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= mergeFiles.length) return;
    const updated = [...mergeFiles];
    [updated[index], updated[targetIdx]] = [updated[targetIdx], updated[index]];
    setMergeFiles(updated);
  };

  const loadImagesForPdf = (files: File[]) => {
    const items: { id: string; file: File; url: string }[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.type.startsWith('image/')) {
        items.push({
          id: Math.random().toString(36).substring(2, 9),
          file: f,
          url: URL.createObjectURL(f),
        });
      }
    }
    setImgFiles((prev) => [...prev, ...items]);
  };

  const handleImageToPdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    loadImagesForPdf(Array.from(e.target.files ?? []));
    e.target.value = '';
  };

  const downloadSingleImage = (dataUrl: string, pageNum: number) => {
    const baseName = file ? file.name.replace(/\.[^/.]+$/, '') : 'document';
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${baseName}-page-${pageNum}.${imgExtension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const downloadAllImages = () => {
    convertedPages.forEach((item, index) => {
      setTimeout(() => downloadSingleImage(item.dataUrl, item.pageNum), index * 250);
    });
  };

  const downloadAllAsZip = async () => {
    if (convertedPages.length === 0) return;
    setIsZipping(true);
    try {
      const zip = new JSZip();
      const baseName = file ? file.name.replace(/\.[^/.]+$/, '') : 'document';
      for (const p of convertedPages) {
        const commaIdx = p.dataUrl.indexOf(',');
        const base64Data = commaIdx !== -1 ? p.dataUrl.substring(commaIdx + 1) : p.dataUrl;
        zip.file(`${baseName}-page-${p.pageNum}.${imgExtension}`, base64Data, { base64: true });
      }
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseName}-${imgExtension}-pages.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setStatusMsg({ type: 'error', text: 'ZIP creation failed. Download individual pages below.' });
    } finally {
      setIsZipping(false);
    }
  };

  // Actions
  const processPdfCompressor = async () => {
    const bytes = await getWorkingBytes();
    if (!bytes) return;
    try {
      setIsProcessing(true);
      const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const compressedBytes = await pdfDoc.save({ useObjectStreams: true });
      const finalKb = setOutputFromBytes(compressedBytes);
      const savings = Math.max(0, Math.round(((fileSizeKb - finalKb) / Math.max(fileSizeKb, 1)) * 100));
      setStatusMsg({
        type: 'success',
        text: `PDF optimized! Original: ${fileSizeKb} KB → Compressed: ${finalKb} KB (${savings}% reduction).`,
      });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'Failed to compress PDF.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const processPdfMerger = async () => {
    if (mergeFiles.length < 2) {
      setStatusMsg({ type: 'error', text: 'Please add at least 2 PDF files to merge.' });
      return;
    }
    try {
      setIsProcessing(true);
      const mergedPdf = await PDFDocument.create();
      for (const item of mergeFiles) {
        const itemBytes = item.file ? await item.file.arrayBuffer() : item.bytes.slice(0);
        const srcDoc = await PDFDocument.load(itemBytes, { ignoreEncryption: true });
        const copiedPages = await mergedPdf.copyPages(srcDoc, srcDoc.getPageIndices());
        copiedPages.forEach((p) => mergedPdf.addPage(p));
      }
      setOutputFromBytes(await mergedPdf.save());
      setStatusMsg({ type: 'success', text: `Merged ${mergeFiles.length} PDF documents into one file.` });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'Failed to merge PDF files.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const processPdfSplitter = async () => {
    const bytes = await getWorkingBytes();
    if (!bytes) return;
    try {
      setIsProcessing(true);
      const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const total = srcDoc.getPageCount();
      const pageNumbers = new Set<number>();

      for (const part of splitRange.split(',')) {
        const trimmed = part.trim();
        if (trimmed.includes('-')) {
          const [sStr, eStr] = trimmed.split('-');
          const s = parseInt(sStr, 10);
          const e = parseInt(eStr, 10);
          if (!isNaN(s) && !isNaN(e)) {
            for (let i = Math.max(1, s); i <= Math.min(total, e); i++) pageNumbers.add(i - 1);
          }
        } else {
          const n = parseInt(trimmed, 10);
          if (!isNaN(n) && n >= 1 && n <= total) pageNumbers.add(n - 1);
        }
      }
      selectedPagesToExtract.forEach((p) => {
        if (p >= 1 && p <= total) pageNumbers.add(p - 1);
      });

      if (pageNumbers.size === 0) {
        setStatusMsg({ type: 'error', text: `Specify valid page numbers between 1 and ${total}.` });
        return;
      }

      const splitDoc = await PDFDocument.create();
      const indices = Array.from(pageNumbers).sort((a, b) => a - b);
      const copied = await splitDoc.copyPages(srcDoc, indices);
      copied.forEach((p) => splitDoc.addPage(p));
      setOutputFromBytes(await splitDoc.save());
      setStatusMsg({ type: 'success', text: `Extracted ${indices.length} page(s) into a new PDF.` });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'Failed to extract pages.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const processImageToPdf = async () => {
    if (imgFiles.length === 0) {
      setStatusMsg({ type: 'error', text: 'Please add at least one image.' });
      return;
    }
    try {
      setIsProcessing(true);
      const pdfDoc = await PDFDocument.create();
      const isPortrait = imgOrientation === 'portrait';
      const pageWidth = isPortrait ? 595.28 : 841.89;
      const pageHeight = isPortrait ? 841.89 : 595.28;

      for (const item of imgFiles) {
        let embeddedImage;
        if (item.file.type === 'image/png') {
          embeddedImage = await pdfDoc.embedPng(await item.file.arrayBuffer());
        } else if (item.file.type === 'image/jpeg' || item.file.type === 'image/jpg') {
          embeddedImage = await pdfDoc.embedJpg(await item.file.arrayBuffer());
        } else {
          const imgEl = new Image();
          await new Promise<void>((resolve, reject) => {
            imgEl.onload = () => resolve();
            imgEl.onerror = () => reject(new Error(`Could not decode ${item.file.name}`));
            imgEl.src = item.url;
          });
          const c = document.createElement('canvas');
          c.width = imgEl.naturalWidth || imgEl.width;
          c.height = imgEl.naturalHeight || imgEl.height;
          const ctx = c.getContext('2d')!;
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, c.width, c.height);
          ctx.drawImage(imgEl, 0, 0);
          const convertedBlob: Blob = await new Promise((resolve, reject) =>
            c.toBlob((b) => (b ? resolve(b) : reject(new Error('Image encode failed'))), 'image/jpeg', 0.92)
          );
          embeddedImage = await pdfDoc.embedJpg(await convertedBlob.arrayBuffer());
        }

        const page = pdfDoc.addPage([pageWidth, pageHeight]);
        const dims = embeddedImage.scaleToFit(pageWidth - imgMargin * 2, pageHeight - imgMargin * 2);
        page.drawImage(embeddedImage, {
          x: (pageWidth - dims.width) / 2,
          y: (pageHeight - dims.height) / 2,
          width: dims.width,
          height: dims.height,
        });
      }

      setOutputFromBytes(await pdfDoc.save());
      setStatusMsg({ type: 'success', text: `Generated A4 PDF from ${imgFiles.length} image(s).` });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'Failed to convert images to PDF.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const processPdfPageDeleter = async () => {
    const bytes = await getWorkingBytes();
    if (!bytes || selectedPagesToDelete.length === 0) return;
    if (selectedPagesToDelete.length >= pageCount) {
      setStatusMsg({ type: 'error', text: 'Cannot delete all pages from the document.' });
      return;
    }
    try {
      setIsProcessing(true);
      const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const newDoc = await PDFDocument.create();
      const keepIndices: number[] = [];
      for (let i = 1; i <= pageCount; i++) {
        if (!selectedPagesToDelete.includes(i)) keepIndices.push(i - 1);
      }
      const copied = await newDoc.copyPages(srcDoc, keepIndices);
      copied.forEach((p) => newDoc.addPage(p));
      setOutputFromBytes(await newDoc.save());
      setStatusMsg({
        type: 'success',
        text: `Removed ${selectedPagesToDelete.length} page(s). New PDF has ${keepIndices.length} page(s).`,
      });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'Failed to delete pages.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const movePageInOrder = (idx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= pageOrder.length) return;
    const nextOrder = [...pageOrder];
    [nextOrder[idx], nextOrder[targetIdx]] = [nextOrder[targetIdx], nextOrder[idx]];
    setPageOrder(nextOrder);
  };

  const processPdfPageReorder = async () => {
    const bytes = await getWorkingBytes();
    if (!bytes) return;
    try {
      setIsProcessing(true);
      const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const newDoc = await PDFDocument.create();
      const copied = await newDoc.copyPages(srcDoc, pageOrder.map((p) => p - 1));
      copied.forEach((p) => newDoc.addPage(p));
      setOutputFromBytes(await newDoc.save());
      setStatusMsg({ type: 'success', text: 'Pages rearranged successfully.' });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'Failed to reorder pages.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const processPdfPageRotator = async () => {
    const bytes = await getWorkingBytes();
    if (!bytes) return;
    try {
      setIsProcessing(true);
      const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const pages = pdfDoc.getPages();
      if (rotateTargetPage === 'all') {
        pages.forEach((p) => p.setRotation(degrees((p.getRotation().angle + rotationAngle) % 360)));
      } else {
        const p = pages[Math.min(Math.max(1, rotateTargetPage), pages.length) - 1];
        p.setRotation(degrees((p.getRotation().angle + rotationAngle) % 360));
      }
      setOutputFromBytes(await pdfDoc.save());
      setStatusMsg({
        type: 'success',
        text: `Rotated ${rotateTargetPage === 'all' ? 'all pages' : `page ${rotateTargetPage}`} by ${rotationAngle}°.`,
      });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'Failed to rotate PDF pages.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const processPdfWatermark = async () => {
    const bytes = await getWorkingBytes();
    if (!bytes) return;
    try {
      setIsProcessing(true);
      const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const colorVal =
        watermarkColor === 'red'
          ? rgb(0.85, 0.2, 0.2)
          : watermarkColor === 'blue'
          ? rgb(0.15, 0.35, 0.85)
          : rgb(0.5, 0.5, 0.5);
      const safeWatermark = sanitizeWinAnsi(watermarkText.trim()) || 'CONFIDENTIAL';
      pdfDoc.getPages().forEach((page) => {
        const { width, height } = page.getSize();
        page.drawText(safeWatermark, {
          x: width / 4,
          y: height / 2,
          size: 42,
          font,
          color: colorVal,
          opacity: watermarkOpacity,
          rotate: degrees(45),
        });
      });
      setOutputFromBytes(await pdfDoc.save());
      setStatusMsg({ type: 'success', text: `Watermark "${safeWatermark}" applied across all pages.` });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'Failed to apply watermark.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const processPdfPageNumbering = async () => {
    const bytes = await getWorkingBytes();
    if (!bytes) return;
    try {
      setIsProcessing(true);
      const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const pages = pdfDoc.getPages();
      const total = pages.length;
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

      pages.forEach((page, idx) => {
        const { width, height } = page.getSize();
        const curPage = numberingStart + idx;
        let text = `Page ${curPage} of ${total}`;
        if (numberingFormat === 'page-x') text = `Page ${curPage}`;
        if (numberingFormat === 'bates') text = `DOC-${String(curPage).padStart(5, '0')}`;
        const textWidth = font.widthOfTextAtSize(text, 10);
        let xPos = (width - textWidth) / 2;
        let yPos = 25;
        if (numberingPos === 'bottom-right') xPos = width - textWidth - 40;
        else if (numberingPos === 'top-right') {
          xPos = width - textWidth - 40;
          yPos = height - 35;
        }
        page.drawText(text, { x: xPos, y: yPos, size: 10, font, color: rgb(0.25, 0.25, 0.25) });
      });

      setOutputFromBytes(await pdfDoc.save());
      setStatusMsg({ type: 'success', text: 'Page numbering stamped across all pages.' });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'Failed to add page numbers.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const processPdfSigner = async () => {
    const bytes = await getWorkingBytes();
    if (!bytes || !signatureDataUrl) {
      setStatusMsg({ type: 'error', text: 'Please draw your signature first.' });
      return;
    }
    try {
      setIsProcessing(true);
      const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const targetIdx = Math.min(Math.max(1, signPage), pdfDoc.getPageCount()) - 1;
      const page = pdfDoc.getPages()[targetIdx];
      const sigImgBytes = await fetch(signatureDataUrl).then((res) => res.arrayBuffer());
      const sigImage = await pdfDoc.embedPng(sigImgBytes);
      const sigDims = sigImage.scale(0.35);
      const { width, height } = page.getSize();
      let posX = width - sigDims.width - 40;
      let posY = 50;
      if (signPosition === 'bottom-center') posX = (width - sigDims.width) / 2;
      else if (signPosition === 'bottom-left') posX = 40;
      else if (signPosition === 'center') {
        posX = (width - sigDims.width) / 2;
        posY = (height - sigDims.height) / 2;
      }
      page.drawImage(sigImage, { x: posX, y: posY, width: sigDims.width, height: sigDims.height });
      setOutputFromBytes(await pdfDoc.save());
      setStatusMsg({ type: 'success', text: `Signature stamped on page ${signPage}.` });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'Failed to stamp signature.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const processPdfFormFiller = async () => {
    const bytes = await getWorkingBytes();
    if (!bytes || !formText.trim()) {
      setStatusMsg({ type: 'error', text: 'Please enter text to stamp.' });
      return;
    }
    try {
      setIsProcessing(true);
      const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const targetIdx = Math.min(Math.max(1, formPage), pdfDoc.getPageCount()) - 1;
      const page = pdfDoc.getPages()[targetIdx];
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      page.drawText(sanitizeWinAnsi(formText) || ' ', {
        x: formPosX,
        y: formPosY,
        size: formFontSize,
        font,
        color: rgb(0, 0, 0),
      });
      setOutputFromBytes(await pdfDoc.save());
      setStatusMsg({ type: 'success', text: `Form text stamped on page ${formPage}.` });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'Failed to fill form.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const processPdfMetadataEditor = async () => {
    const bytes = await getWorkingBytes();
    if (!bytes) return;
    try {
      setIsProcessing(true);
      const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      pdfDoc.setTitle(metaTitle);
      pdfDoc.setAuthor(metaAuthor);
      pdfDoc.setSubject(metaSubject);
      pdfDoc.setKeywords(
        metaKeywords
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean)
      );
      setOutputFromBytes(await pdfDoc.save());
      setStatusMsg({ type: 'success', text: 'PDF metadata updated and saved.' });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'Failed to update metadata.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const processPdfCropper = async () => {
    const bytes = await getWorkingBytes();
    if (!bytes) return;
    try {
      setIsProcessing(true);
      const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      pdfDoc.getPages().forEach((p) => {
        const { width, height } = p.getSize();
        const trimX = (width * cropMarginPercent) / 100;
        const trimY = (height * cropMarginPercent) / 100;
        p.setCropBox(trimX, trimY, width - 2 * trimX, height - 2 * trimY);
      });
      setOutputFromBytes(await pdfDoc.save());
      setStatusMsg({ type: 'success', text: `Trimmed ${cropMarginPercent}% outer margins.` });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'Failed to crop PDF.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const processPdfPageSizeChanger = async () => {
    const bytes = await getWorkingBytes();
    if (!bytes) return;
    try {
      setIsProcessing(true);
      const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const newDoc = await PDFDocument.create();
      let targetWidth = 595.28;
      let targetHeight = 841.89;
      if (targetPageSize === 'letter') {
        targetWidth = 612;
        targetHeight = 792;
      } else if (targetPageSize === 'legal') {
        targetWidth = 612;
        targetHeight = 1008;
      }
      const margin = 40;
      for (let i = 0; i < srcDoc.getPageCount(); i++) {
        const [embedded] = await newDoc.embedPdf(srcDoc, [i]);
        const scaleFactor = Math.min(
          (targetWidth - margin * 2) / embedded.width,
          (targetHeight - margin * 2) / embedded.height
        );
        const scaledWidth = embedded.width * scaleFactor;
        const scaledHeight = embedded.height * scaleFactor;
        const page = newDoc.addPage([targetWidth, targetHeight]);
        page.drawPage(embedded, {
          x: (targetWidth - scaledWidth) / 2,
          y: (targetHeight - scaledHeight) / 2,
          width: scaledWidth,
          height: scaledHeight,
        });
      }
      setOutputFromBytes(await newDoc.save());
      setStatusMsg({
        type: 'success',
        text: `Standardized ${srcDoc.getPageCount()} pages to ${targetPageSize.toUpperCase()}.`,
      });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'Failed to resize PDF pages.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const processPdfUnlocker = async () => {
    const bytes = await getWorkingBytes();
    if (!bytes || !unlockPassword) {
      setStatusMsg({ type: 'error', text: 'Upload a PDF and enter its password first.' });
      return;
    }
    try {
      setIsProcessing(true);
      const decryptedBytes = await decryptPDF(bytes, unlockPassword);
      setOutputFromBytes(decryptedBytes);
      setStatusMsg({ type: 'success', text: 'PDF unlocked! Unencrypted copy is ready to download.' });
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: err?.message?.includes('Incorrect password')
          ? 'Incorrect password. Please verify and try again.'
          : err?.message || 'Failed to unlock PDF.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const processPdfPasswordProtector = async () => {
    const bytes = await getWorkingBytes();
    if (!bytes || !protectPassword) return;
    if (protectPassword !== confirmProtectPassword) {
      setStatusMsg({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    try {
      setIsProcessing(true);
      const encryptedBytes = await encryptPDF(bytes, protectPassword, {
        allowPrinting: true,
        allowCopying: false,
        allowModifying: false,
      });
      setOutputFromBytes(encryptedBytes);
      setStatusMsg({ type: 'success', text: 'PDF protected with AES-256 encryption.' });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'Failed to protect PDF.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const processPdfFlattenRepair = async () => {
    const bytes = await getWorkingBytes();
    if (!bytes) return;
    try {
      setIsProcessing(true);
      const pdfDoc = await PDFDocument.load(bytes, {
        ignoreEncryption: true,
        updateMetadata: false,
      });
      let formFlattened = false;
      try {
        const form = pdfDoc.getForm();
        if (form.getFields().length > 0) {
          form.flatten();
          formFlattened = true;
        }
      } catch {
        // Document had no AcroForm or non-standard fields; continue clean rebuild
      }
      const rebuiltBytes = await pdfDoc.save({ useObjectStreams: true });
      const finalKb = setOutputFromBytes(rebuiltBytes);
      setStatusMsg({
        type: 'success',
        text: formFlattened
          ? `Form fields flattened & PDF tables rebuilt cleanly (${finalKb} KB).`
          : `PDF cross-reference & object streams repaired cleanly (${finalKb} KB).`,
      });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'Failed to flatten or repair PDF.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Signature pad helpers
  const getSigCoords = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
    canvas: HTMLCanvasElement
  ) => {
    const rect = canvas.getBoundingClientRect();
    const touch = 'touches' in e ? e.touches[0] || e.changedTouches[0] : null;
    const clientX = touch ? touch.clientX : (e as React.MouseEvent<HTMLCanvasElement>).clientX;
    const clientY = touch ? touch.clientY : (e as React.MouseEvent<HTMLCanvasElement>).clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / Math.max(1, rect.width)),
      y: (clientY - rect.top) * (canvas.height / Math.max(1, rect.height)),
    };
  };

  const startDrawingSig = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = sigPadRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setIsDrawingSig(true);
    const { x, y } = getSigCoords(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const drawSig = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingSig) return;
    const canvas = sigPadRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getSigCoords(e, canvas);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = sigInkColor;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawingSig = () => {
    if (!isDrawingSig) return;
    setIsDrawingSig(false);
    const canvas = sigPadRef.current;
    if (canvas) setSignatureDataUrl(canvas.toDataURL('image/png'));
  };

  const clearSigPad = () => {
    const canvas = sigPadRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureDataUrl(null);
  };

  const handleDownload = () => {
    if (!outputUrl) return;
    const a = document.createElement('a');
    a.href = outputUrl;
    a.download = `${tool.id}-document.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-6 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-[#2F3E4E]/15">
        <div>
          <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
            {tool.categoryName} · {tool.code}
          </span>
          <h1 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] mt-1 tracking-tight">
            {tool.title}
          </h1>
          <p className="text-xs sm:text-sm text-[#475569] mt-0.5">
            100% browser-side PDF processing via pdf-lib &amp; PDF.js WebAssembly. Documents stay on your device.
          </p>
        </div>

        {(file || mergeFiles.length > 0 || imgFiles.length > 0 || convertedPages.length > 0) && (
          <button
            type="button"
            onClick={resetAll}
            className="px-3.5 py-2 text-xs font-bold text-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] rounded-lg cursor-pointer shrink-0"
          >
            Reset Tool
          </button>
        )}
      </div>

      {/* 1. PDF MERGER */}
      {isMerger ? (
        <div className="space-y-6">
          <FileDropZone
            accept="application/pdf,.pdf"
            multiple
            onFiles={(files) => {
              void loadMergePdfFiles(files);
            }}
            className="border-2 border-dashed border-[#2F3E4E]/45 rounded-2xl p-8 text-center bg-[#FEF2C8]/45 transition-colors"
          >
            <input
              type="file"
              id="pdf-merge-input"
              multiple
              accept="application/pdf"
              onChange={handleMergeFilesUpload}
              className="hidden"
            />
            <label htmlFor="pdf-merge-input" className="cursor-pointer flex flex-col items-center">
              <div className="w-14 h-14 rounded-2xl bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] text-[#2F3E4E] flex items-center justify-center mb-3">
                <Layers className="w-7 h-7" />
              </div>
              <span className="text-base font-bold text-[#2F3E4E]">
                Drag &amp; Drop or Select PDF Files to Merge
              </span>
              <span className="text-xs text-[#475569] mt-1">
                Drop two or more PDFs and reorder them below before combining.
              </span>
              <span className="mt-4 px-4 py-2 bg-[#2F3E4E] text-[#FFFDF5] text-xs font-bold rounded-lg">
                Add PDF Files
              </span>
            </label>
          </FileDropZone>

          {mergeFiles.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-[#2F3E4E]">
                <span>Selected Documents ({mergeFiles.length})</span>
                <span className="text-[#64748B]">Use arrows to reorder</span>
              </div>

              <div className="space-y-2">
                {mergeFiles.map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3.5 bg-white border-[1.5px] border-[#2F3E4E] rounded-xl text-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-6 h-6 rounded-full bg-[#FEF2C8] border border-[#2F3E4E] text-[#2F3E4E] text-xs font-mono font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="font-bold text-[#2F3E4E] truncate">{item.file.name}</span>
                      <span className="text-xs text-[#64748B] font-mono shrink-0">
                        ({item.pages}p · {item.sizeKb} KB)
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => moveMergeFile(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1.5 rounded text-[#2F3E4E] disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveMergeFile(idx, 'down')}
                        disabled={idx === mergeFiles.length - 1}
                        className="p-1.5 rounded text-[#2F3E4E] disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setMergeFiles((p) => p.filter((x) => x.id !== item.id))}
                        className="p-1.5 rounded text-red-700 hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={processPdfMerger}
                  disabled={isProcessing}
                  className="px-6 py-2.5 bg-[#2F3E4E] hover:bg-[#1E293B] disabled:opacity-50 text-[#FFFDF5] rounded-xl text-sm font-bold flex items-center gap-2 cursor-pointer"
                >
                  {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                  Merge {mergeFiles.length} PDFs
                </button>
              </div>
            </div>
          )}
        </div>
      ) : isImageToPdf ? (
        /* 2. IMAGE TO PDF */
        <div className="space-y-6">
          <FileDropZone
            accept="image/jpeg,image/png,image/webp"
            multiple
            onFiles={loadImagesForPdf}
            className="border-2 border-dashed border-[#2F3E4E]/45 rounded-2xl p-8 text-center bg-[#FEF2C8]/45 transition-colors"
          >
            <input
              type="file"
              id="img-to-pdf-input"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageToPdfUpload}
              className="hidden"
            />
            <label htmlFor="img-to-pdf-input" className="cursor-pointer flex flex-col items-center">
              <div className="w-14 h-14 rounded-2xl bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] text-[#2F3E4E] flex items-center justify-center mb-3">
                <ImageIcon className="w-7 h-7" />
              </div>
              <span className="text-base font-bold text-[#2F3E4E]">
                Drag &amp; Drop or Upload Scanned Images
              </span>
              <span className="text-xs text-[#475569] mt-1">Converts JPG, PNG, and WEBP into ISO A4 PDF pages.</span>
              <span className="mt-4 px-4 py-2 bg-[#2F3E4E] text-[#FFFDF5] text-xs font-bold rounded-lg">
                Add Images
              </span>
            </label>
          </FileDropZone>

          {imgFiles.length > 0 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#FEF2C8]/65 rounded-xl border-[1.5px] border-[#2F3E4E] text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#2F3E4E]">Orientation:</span>
                  <button
                    type="button"
                    onClick={() => setImgOrientation('portrait')}
                    className={`px-3 py-1.5 rounded-lg border border-[#2F3E4E] font-bold cursor-pointer ${
                      imgOrientation === 'portrait' ? 'bg-[#2F3E4E] text-[#FFFDF5]' : 'bg-white text-[#2F3E4E]'
                    }`}
                  >
                    Portrait
                  </button>
                  <button
                    type="button"
                    onClick={() => setImgOrientation('landscape')}
                    className={`px-3 py-1.5 rounded-lg border border-[#2F3E4E] font-bold cursor-pointer ${
                      imgOrientation === 'landscape' ? 'bg-[#2F3E4E] text-[#FFFDF5]' : 'bg-white text-[#2F3E4E]'
                    }`}
                  >
                    Landscape
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#2F3E4E]">Margins:</span>
                  <select
                    value={imgMargin}
                    onChange={(e) => setImgMargin(Number(e.target.value))}
                    className="px-2.5 py-1.5 border border-[#2F3E4E] rounded-lg bg-white font-semibold"
                  >
                    <option value={0}>No Margins</option>
                    <option value={20}>Standard (20 pt)</option>
                    <option value={40}>Wide Border (40 pt)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {imgFiles.map((item, idx) => (
                  <div
                    key={item.id}
                    className="relative group border-[1.5px] border-[#2F3E4E] rounded-xl overflow-hidden p-2 bg-white"
                  >
                    <img src={item.url} alt={`Upload ${idx + 1}`} className="w-full h-24 object-contain rounded" />
                    <span className="text-[11px] font-bold text-[#2F3E4E] truncate block mt-1">
                      Page {idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        URL.revokeObjectURL(item.url);
                        setImgFiles((prev) => prev.filter((x) => x.id !== item.id));
                      }}
                      className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-md cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={processImageToPdf}
                  disabled={isProcessing}
                  className="px-6 py-2.5 bg-[#2F3E4E] hover:bg-[#1E293B] disabled:opacity-50 text-[#FFFDF5] rounded-xl text-sm font-bold flex items-center gap-2 cursor-pointer"
                >
                  {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  Generate A4 PDF ({imgFiles.length} Pages)
                </button>
              </div>
            </div>
          )}
        </div>
      ) : !file ? (
        /* 3. SINGLE PDF UPLOADER */
        <div className="space-y-5">
          <FileDropZone
            accept="application/pdf,.pdf"
            multiple={false}
            onFiles={(files) => {
              if (files[0]) void loadSinglePdfFile(files[0]);
            }}
            className="border-2 border-dashed border-[#2F3E4E]/45 rounded-2xl p-10 text-center bg-[#FEF2C8]/45 transition-colors"
          >
            <input
              type="file"
              id="single-pdf-input"
              accept="application/pdf"
              onChange={handleSingleFileUpload}
              className="hidden"
            />
            <label htmlFor="single-pdf-input" className="cursor-pointer flex flex-col items-center">
              <div className="w-16 h-16 rounded-2xl bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] text-[#2F3E4E] flex items-center justify-center mb-4">
                <FileText className="w-8 h-8" />
              </div>
              <span className="text-base font-bold text-[#2F3E4E]">
                Drag &amp; Drop or Click to Choose PDF Document
              </span>
              <span className="text-xs text-[#475569] mt-1 max-w-sm">
                Drop any PDF document here. All rendering and encryption runs strictly inside your browser.
              </span>
              <span className="mt-4 px-4 py-2 bg-[#2F3E4E] text-[#FFFDF5] text-xs font-bold rounded-lg">
                Select PDF File
              </span>
            </label>
          </FileDropZone>
        </div>
      ) : (
        /* 4. ACTIVE STUDIO */
        <div className="space-y-6">
          <FileDropZone
            accept="application/pdf,.pdf"
            multiple={false}
            onFiles={(files) => {
              if (files[0]) void loadSinglePdfFile(files[0]);
            }}
            className="p-4 bg-[#FEF2C8]/75 rounded-xl border-[1.5px] border-[#2F3E4E] flex flex-wrap items-center justify-between gap-3 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#2F3E4E] text-[#FFFDF5] flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#2F3E4E]">{file.name}</p>
                <p className="text-xs text-[#475569] font-mono tabular-nums">
                  Size: <strong>{fileSizeKb} KB</strong> · Pages: <strong>{pageCount}</strong>
                </p>
              </div>
            </div>

            <label
              htmlFor="change-pdf-input"
              className="px-3.5 py-1.5 text-xs font-bold text-[#2F3E4E] bg-white border-[1.5px] border-[#2F3E4E] hover:bg-[#F9C80E] rounded-lg cursor-pointer"
            >
              Drop or Choose Different PDF
              <input
                type="file"
                id="change-pdf-input"
                accept="application/pdf"
                onChange={handleSingleFileUpload}
                className="hidden"
              />
            </label>
          </FileDropZone>

          {pageThumbnails.length > 0 && !isPdfToImage && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-[#475569]">
                <span className="font-bold text-[#2F3E4E]">Document Page Previews:</span>
                <span>{pageThumbnails.length} of {pageCount} shown</span>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 pt-1">
                {pageThumbnails.map((thumb) => {
                  const isExtractSelected = selectedPagesToExtract.includes(thumb.pageNum);
                  const isDeleteSelected = selectedPagesToDelete.includes(thumb.pageNum);
                  return (
                    <div
                      key={thumb.pageNum}
                      onClick={() => {
                        if (isSplitter) {
                          setSelectedPagesToExtract((prev) =>
                            isExtractSelected ? prev.filter((x) => x !== thumb.pageNum) : [...prev, thumb.pageNum]
                          );
                        } else if (isDeleter) {
                          setSelectedPagesToDelete((prev) =>
                            isDeleteSelected ? prev.filter((x) => x !== thumb.pageNum) : [...prev, thumb.pageNum]
                          );
                        }
                      }}
                      className={`relative shrink-0 w-24 rounded-lg border-[1.5px] overflow-hidden p-1 bg-white transition-all ${
                        isSplitter || isDeleter ? 'cursor-pointer hover:-translate-y-0.5' : ''
                      } ${
                        isSplitter && isExtractSelected
                          ? 'ring-2 ring-[#2F3E4E] border-[#2F3E4E] bg-[#CEE5DC]/50'
                          : isDeleter && isDeleteSelected
                          ? 'ring-2 ring-red-600 border-red-600 bg-red-50'
                          : 'border-[#2F3E4E]/35'
                      }`}
                    >
                      <img src={thumb.dataUrl} alt={`Page ${thumb.pageNum}`} className="w-full h-32 object-contain bg-white rounded" />
                      <div className="flex items-center justify-between mt-1 text-[10px] text-[#2F3E4E] font-bold px-0.5">
                        <span>P. {thumb.pageNum}</span>
                        {isSplitter && isExtractSelected && <CheckCircle className="w-3 h-3 text-emerald-700" />}
                        {isDeleter && isDeleteSelected && <Trash2 className="w-3 h-3 text-red-700" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tool Specific Panels */}
          {isPdfToImage ? (
            <div className="space-y-6">
              <div className="p-5 border-[1.5px] border-[#2F3E4E] rounded-xl space-y-4 bg-white">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-[#2F3E4E] flex items-center gap-2">
                      <ImageIcon className="w-4 h-4" /> Convert Document Pages to {imgExtension.toUpperCase()}
                    </h3>
                    <p className="text-xs text-[#475569] mt-0.5">
                      Renders crisp {imgExtension.toUpperCase()} images on clean white background.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-[#475569] font-bold">Format:</span>
                      <select
                        value={imageFormat}
                        onChange={(e) => setImageFormat(e.target.value as 'jpg' | 'png' | 'webp')}
                        disabled={isProcessing}
                        className="px-2.5 py-1.5 text-xs font-bold border border-[#2F3E4E] rounded-lg bg-white"
                      >
                        <option value="jpg">JPG</option>
                        <option value="png">PNG (Lossless)</option>
                        <option value="webp">WEBP (Modern)</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-[#475569] font-bold">Pages:</span>
                      <input
                        type="text"
                        value={pdfImageRange}
                        onChange={(e) => setPdfImageRange(e.target.value)}
                        placeholder={`All (1-${pageCount})`}
                        aria-label="Page range to convert"
                        className="w-28 px-2.5 py-1.5 text-xs font-mono border border-[#2F3E4E] rounded-lg bg-white"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-[#475569] font-bold">DPI:</span>
                      <select
                        value={imageDpi}
                        onChange={(e) => {
                          const dpi = Number(e.target.value);
                          setImageDpi(dpi);
                          if (fileBytes) convertBufferToImages(fileBytes, pageCount, dpi);
                        }}
                        disabled={isProcessing}
                        className="px-2.5 py-1.5 text-xs font-bold border border-[#2F3E4E] rounded-lg bg-white"
                      >
                        <option value={150}>150 DPI (Fast)</option>
                        <option value={200}>200 DPI (Exam Standard)</option>
                        <option value={300}>300 DPI (Print Quality)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileBytes && convertBufferToImages(fileBytes, pageCount, imageDpi)}
                    disabled={isProcessing}
                    className="px-5 py-2.5 bg-[#2F3E4E] text-[#FFFDF5] rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
                    {isProcessing && convertingProgress
                      ? `Rendering ${convertingProgress.current}/${convertingProgress.total}...`
                      : `Render ${pdfImageRange.trim() ? `Selected Pages (${pdfImageRange})` : `${pageCount} Pages`}`}
                  </button>

                  {convertedPages.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={downloadAllAsZip}
                        disabled={isZipping}
                        className="px-5 py-2.5 bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] text-[#2F3E4E] rounded-xl text-xs font-extrabold flex items-center gap-2 cursor-pointer"
                      >
                        <Archive className="w-4 h-4" /> Download All as ZIP
                      </button>
                      <button
                        type="button"
                        onClick={downloadAllImages}
                        className="px-4 py-2.5 bg-white border-[1.5px] border-[#2F3E4E] text-[#2F3E4E] rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer"
                      >
                        <Download className="w-4 h-4" /> Download Individually
                      </button>
                    </>
                  )}
                </div>
              </div>

              {convertedPages.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {convertedPages.map((page) => (
                    <div
                      key={page.pageNum}
                      className="bg-white border-[1.5px] border-[#2F3E4E] rounded-xl p-3 flex flex-col justify-between gap-2"
                    >
                      <div className="aspect-[3/4] bg-[#FEF2C8]/30 rounded-lg border border-[#2F3E4E]/20 flex items-center justify-center p-2">
                        <img src={page.dataUrl} alt={`Page ${page.pageNum}`} className="max-h-full max-w-full object-contain" />
                      </div>
                      <div className="flex justify-between text-[11px] font-mono text-[#475569]">
                        <span>Page {page.pageNum} · {page.width}×{page.height}</span>
                        <span>~{page.sizeKb} KB</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => downloadSingleImage(page.dataUrl, page.pageNum)}
                        className="w-full py-2 bg-[#2F3E4E] text-[#FFFDF5] text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" /> Save Page {page.pageNum} ({imgExtension.toUpperCase()})
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : isSplitter ? (
            <div className="p-5 border-[1.5px] border-[#2F3E4E] rounded-xl space-y-4 bg-white">
              <label className="block text-xs font-bold text-[#2F3E4E] uppercase">
                Specify Page Ranges or Click Thumbnails Above
              </label>
              <input
                type="text"
                value={splitRange}
                onChange={(e) => setSplitRange(e.target.value)}
                placeholder="e.g. 1-2, 4"
                className="w-full max-w-md px-3.5 py-2 text-sm border-[1.5px] border-[#2F3E4E] rounded-lg font-mono"
              />
              <button
                type="button"
                onClick={processPdfSplitter}
                disabled={isProcessing}
                className="px-5 py-2.5 bg-[#2F3E4E] text-[#FFFDF5] rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                <Scissors className="w-4 h-4" /> Extract Specified Pages
              </button>
            </div>
          ) : isDeleter ? (
            <div className="p-5 border-[1.5px] border-[#2F3E4E] rounded-xl space-y-4 bg-white">
              <label className="block text-xs font-bold text-[#2F3E4E] uppercase">Select Pages to Delete</label>
              <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 gap-2">
                {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => {
                  const isChecked = selectedPagesToDelete.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() =>
                        setSelectedPagesToDelete((prev) =>
                          isChecked ? prev.filter((x) => x !== p) : [...prev, p]
                        )
                      }
                      className={`p-2.5 rounded-lg border text-xs font-bold flex flex-col items-center gap-1 cursor-pointer ${
                        isChecked ? 'bg-red-50 border-red-600 text-red-700' : 'bg-[#FEF2C8]/45 border-[#2F3E4E]/35 text-[#2F3E4E]'
                      }`}
                    >
                      <span>Page {p}</span>
                      <span className="text-[10px]">{isChecked ? 'Delete' : 'Keep'}</span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={processPdfPageDeleter}
                disabled={isProcessing || selectedPagesToDelete.length === 0}
                className="px-5 py-2.5 bg-red-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" /> Delete {selectedPagesToDelete.length} Page(s) &amp; Save
              </button>
            </div>
          ) : isReorder ? (
            <div className="p-5 border-[1.5px] border-[#2F3E4E] rounded-xl space-y-4 bg-white">
              <label className="block text-xs font-bold text-[#2F3E4E] uppercase">Rearrange Page Sequence</label>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {pageOrder.map((origPageNum, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-[#FEF2C8]/45 border border-[#2F3E4E]/30 rounded-lg text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-[#2F3E4E] text-[#FFFDF5] font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="font-bold text-[#2F3E4E]">Original Page #{origPageNum}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => movePageInOrder(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1.5 rounded text-[#2F3E4E] disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => movePageInOrder(idx, 'down')}
                        disabled={idx === pageOrder.length - 1}
                        className="p-1.5 rounded text-[#2F3E4E] disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={processPdfPageReorder}
                disabled={isProcessing}
                className="px-5 py-2.5 bg-[#2F3E4E] text-[#FFFDF5] rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" /> Apply Custom Order &amp; Save
              </button>
            </div>
          ) : isRotator ? (
            <div className="p-5 border-[1.5px] border-[#2F3E4E] rounded-xl space-y-4 bg-white">
              <label className="block text-xs font-bold text-[#2F3E4E] uppercase">Rotation Angle &amp; Target</label>
              <div className="flex flex-wrap gap-2">
                {[90, 180, 270].map((deg) => (
                  <button
                    key={deg}
                    type="button"
                    onClick={() => setRotationAngle(deg)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold border border-[#2F3E4E] cursor-pointer ${
                      rotationAngle === deg ? 'bg-[#2F3E4E] text-[#FFFDF5]' : 'bg-white text-[#2F3E4E]'
                    }`}
                  >
                    Rotate {deg}°
                  </button>
                ))}
              </div>
              <select
                value={rotateTargetPage}
                onChange={(e) => setRotateTargetPage(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="px-3 py-2 border border-[#2F3E4E] rounded-lg bg-white text-xs font-semibold"
              >
                <option value="all">Rotate All Pages</option>
                {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
                  <option key={p} value={p}>Only Page {p}</option>
                ))}
              </select>
              <div>
                <button
                  type="button"
                  onClick={processPdfPageRotator}
                  disabled={isProcessing}
                  className="px-5 py-2.5 bg-[#2F3E4E] text-[#FFFDF5] rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" /> Apply Rotation
                </button>
              </div>
            </div>
          ) : isWatermark ? (
            <div className="p-5 border-[1.5px] border-[#2F3E4E] rounded-xl space-y-4 bg-white">
              <label className="block text-xs font-bold text-[#2F3E4E] uppercase">Watermark Text</label>
              <input
                type="text"
                value={watermarkText}
                onChange={(e) => setWatermarkText(e.target.value)}
                className="w-full max-w-md px-3.5 py-2 text-sm border-[1.5px] border-[#2F3E4E] rounded-lg"
              />
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold">Color:</span>
                  {(['grey', 'red', 'blue'] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setWatermarkColor(c)}
                      className={`px-3 py-1 rounded border border-[#2F3E4E] capitalize cursor-pointer font-bold ${
                        watermarkColor === c ? 'bg-[#2F3E4E] text-[#FFFDF5]' : 'bg-white'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">Opacity: {Math.round(watermarkOpacity * 100)}%</span>
                  <input
                    type="range"
                    min={0.05}
                    max={0.8}
                    step={0.05}
                    value={watermarkOpacity}
                    onChange={(e) => setWatermarkOpacity(Number(e.target.value))}
                    className="w-32 accent-[#2F3E4E]"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={processPdfWatermark}
                disabled={isProcessing}
                className="px-5 py-2.5 bg-[#2F3E4E] text-[#FFFDF5] rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                <Stamp className="w-4 h-4" /> Apply Watermark
              </button>
            </div>
          ) : isNumbering ? (
            <div className="p-5 border-[1.5px] border-[#2F3E4E] rounded-xl space-y-4 bg-white">
              <label className="block text-xs font-bold text-[#2F3E4E] uppercase">Pagination Format</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                {[
                  { key: 'page-x-of-y', label: `Page 1 of ${pageCount}` },
                  { key: 'page-x', label: 'Page 1' },
                  { key: 'bates', label: 'DOC-00001 (Bates)' },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setNumberingFormat(opt.key as 'page-x-of-y' | 'page-x' | 'bates')}
                    className={`p-2.5 rounded-lg border border-[#2F3E4E] font-bold cursor-pointer ${
                      numberingFormat === opt.key ? 'bg-[#2F3E4E] text-[#FFFDF5]' : 'bg-white text-[#2F3E4E]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-4 text-xs items-center">
                <select
                  value={numberingPos}
                  onChange={(e) => setNumberingPos(e.target.value as 'bottom-center' | 'bottom-right' | 'top-right')}
                  className="px-3 py-2 border border-[#2F3E4E] rounded-lg bg-white font-semibold"
                >
                  <option value="bottom-center">Bottom Center</option>
                  <option value="bottom-right">Bottom Right Corner</option>
                  <option value="top-right">Top Right Header</option>
                </select>
                <label className="flex items-center gap-2 font-bold">
                  Start #:
                  <input
                    type="number"
                    min={1}
                    value={numberingStart}
                    onChange={(e) => setNumberingStart(Math.max(1, Number(e.target.value) || 1))}
                    className="w-20 px-2.5 py-1.5 border border-[#2F3E4E] rounded-lg font-mono"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={processPdfPageNumbering}
                disabled={isProcessing}
                className="px-5 py-2.5 bg-[#2F3E4E] text-[#FFFDF5] rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                <Hash className="w-4 h-4" /> Add Page Numbers
              </button>
            </div>
          ) : isSigner ? (
            <div className="p-5 border-[1.5px] border-[#2F3E4E] rounded-xl space-y-4 bg-white">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold">Ink:</span>
                  <button
                    type="button"
                    onClick={() => setSigInkColor('#000000')}
                    className={`w-5 h-5 rounded-full bg-black border cursor-pointer ${sigInkColor === '#000000' ? 'ring-2 ring-[#F9C80E]' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setSigInkColor('#1e40af')}
                    className={`w-5 h-5 rounded-full bg-blue-700 border cursor-pointer ${sigInkColor === '#1e40af' ? 'ring-2 ring-[#F9C80E]' : ''}`}
                  />
                </div>
                <button type="button" onClick={clearSigPad} className="text-red-700 font-bold hover:underline cursor-pointer">
                  Clear Canvas
                </button>
              </div>

              <canvas
                ref={sigPadRef}
                width={400}
                height={130}
                onMouseDown={startDrawingSig}
                onMouseMove={drawSig}
                onMouseUp={stopDrawingSig}
                onMouseLeave={stopDrawingSig}
                onTouchStart={startDrawingSig}
                onTouchMove={drawSig}
                onTouchEnd={stopDrawingSig}
                className="w-full max-w-sm bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-lg cursor-crosshair touch-none"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md text-xs">
                <div>
                  <span className="font-bold block mb-1">Target Page (1-{pageCount})</span>
                  <input
                    type="number"
                    min={1}
                    max={pageCount}
                    value={signPage}
                    onChange={(e) => setSignPage(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-[#2F3E4E] rounded-lg"
                  />
                </div>
                <div>
                  <span className="font-bold block mb-1">Placement</span>
                  <select
                    value={signPosition}
                    onChange={(e) => setSignPosition(e.target.value as 'bottom-right' | 'bottom-center' | 'bottom-left' | 'center')}
                    className="w-full px-3 py-2 border border-[#2F3E4E] rounded-lg bg-white"
                  >
                    <option value="bottom-right">Bottom Right</option>
                    <option value="bottom-center">Bottom Center</option>
                    <option value="bottom-left">Bottom Left</option>
                    <option value="center">Center</option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={processPdfSigner}
                disabled={isProcessing || !signatureDataUrl}
                className="px-5 py-2.5 bg-[#2F3E4E] disabled:opacity-50 text-[#FFFDF5] rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                <PenTool className="w-4 h-4" /> Stamp Signature on PDF
              </button>
            </div>
          ) : isFormFiller ? (
            <div className="p-5 border-[1.5px] border-[#2F3E4E] rounded-xl space-y-4 bg-white">
              <label className="block text-xs font-bold text-[#2F3E4E] uppercase">Type Text Overlay</label>
              <input
                type="text"
                value={formText}
                onChange={(e) => setFormText(e.target.value)}
                placeholder="e.g. Ramesh Kumar"
                className="w-full px-3.5 py-2 text-xs border border-[#2F3E4E] rounded-lg"
              />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="font-bold block mb-1">Page (1-{pageCount})</span>
                  <input type="number" min={1} max={pageCount} value={formPage} onChange={(e) => setFormPage(Number(e.target.value))} className="w-full px-2.5 py-1.5 border border-[#2F3E4E] rounded-lg" />
                </div>
                <div>
                  <span className="font-bold block mb-1">X (pts)</span>
                  <input type="number" value={formPosX} onChange={(e) => setFormPosX(Number(e.target.value))} className="w-full px-2.5 py-1.5 border border-[#2F3E4E] rounded-lg" />
                </div>
                <div>
                  <span className="font-bold block mb-1">Y (pts)</span>
                  <input type="number" value={formPosY} onChange={(e) => setFormPosY(Number(e.target.value))} className="w-full px-2.5 py-1.5 border border-[#2F3E4E] rounded-lg" />
                </div>
                <div>
                  <span className="font-bold block mb-1">Size</span>
                  <input type="number" value={formFontSize} onChange={(e) => setFormFontSize(Number(e.target.value))} className="w-full px-2.5 py-1.5 border border-[#2F3E4E] rounded-lg" />
                </div>
              </div>
              <button
                type="button"
                onClick={processPdfFormFiller}
                disabled={isProcessing}
                className="px-5 py-2.5 bg-[#2F3E4E] text-[#FFFDF5] rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                <Edit className="w-4 h-4" /> Stamp Text on Form
              </button>
            </div>
          ) : isMetadataViewer || isMetadataEditor ? (
            <div className="p-5 border-[1.5px] border-[#2F3E4E] rounded-xl space-y-4 bg-white text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="font-bold block mb-1">Title</span>
                  {isMetadataEditor ? (
                    <input type="text" value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} className="w-full px-3 py-2 border border-[#2F3E4E] rounded-lg" />
                  ) : (
                    <p className="p-2 bg-[#FEF2C8]/45 rounded border border-[#2F3E4E]/25 font-semibold">{metaTitle || '(Not set)'}</p>
                  )}
                </div>
                <div>
                  <span className="font-bold block mb-1">Author</span>
                  {isMetadataEditor ? (
                    <input type="text" value={metaAuthor} onChange={(e) => setMetaAuthor(e.target.value)} className="w-full px-3 py-2 border border-[#2F3E4E] rounded-lg" />
                  ) : (
                    <p className="p-2 bg-[#FEF2C8]/45 rounded border border-[#2F3E4E]/25 font-semibold">{metaAuthor || '(Not set)'}</p>
                  )}
                </div>
                <div>
                  <span className="font-bold block mb-1">Subject</span>
                  {isMetadataEditor ? (
                    <input type="text" value={metaSubject} onChange={(e) => setMetaSubject(e.target.value)} className="w-full px-3 py-2 border border-[#2F3E4E] rounded-lg" />
                  ) : (
                    <p className="p-2 bg-[#FEF2C8]/45 rounded border border-[#2F3E4E]/25 font-semibold">{metaSubject || '(Not set)'}</p>
                  )}
                </div>
                <div>
                  <span className="font-bold block mb-1">Keywords / Producer</span>
                  {isMetadataEditor ? (
                    <input type="text" value={metaKeywords} onChange={(e) => setMetaKeywords(e.target.value)} placeholder="comma, separated" className="w-full px-3 py-2 border border-[#2F3E4E] rounded-lg" />
                  ) : (
                    <p className="p-2 bg-[#FEF2C8]/45 rounded border border-[#2F3E4E]/25 font-semibold">{metaProducer || 'Standard PDF Engine'}</p>
                  )}
                </div>
              </div>
              {isMetadataEditor && (
                <button
                  type="button"
                  onClick={processPdfMetadataEditor}
                  disabled={isProcessing}
                  className="px-5 py-2.5 bg-[#2F3E4E] text-[#FFFDF5] rounded-xl font-bold flex items-center gap-2 cursor-pointer"
                >
                  <Edit className="w-4 h-4" /> Save Metadata
                </button>
              )}
            </div>
          ) : isCropper ? (
            <div className="p-5 border-[1.5px] border-[#2F3E4E] rounded-xl space-y-4 bg-white">
              <label className="block text-xs font-bold text-[#2F3E4E] uppercase">
                Trim Margin: {cropMarginPercent}% on all edges
              </label>
              <div className="flex gap-2">
                {[5, 10, 15, 20].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setCropMarginPercent(pct)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold border border-[#2F3E4E] cursor-pointer ${
                      cropMarginPercent === pct ? 'bg-[#2F3E4E] text-[#FFFDF5]' : 'bg-white text-[#2F3E4E]'
                    }`}
                  >
                    Trim {pct}%
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={processPdfCropper}
                disabled={isProcessing}
                className="px-5 py-2.5 bg-[#2F3E4E] text-[#FFFDF5] rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                <Scissors className="w-4 h-4" /> Apply Margin Trim
              </button>
            </div>
          ) : isPageSizeChanger ? (
            <div className="p-5 border-[1.5px] border-[#2F3E4E] rounded-xl space-y-4 bg-white">
              <div className="flex flex-wrap gap-3 text-xs">
                {[
                  { key: 'a4', title: 'ISO A4 (210 × 297 mm)' },
                  { key: 'letter', title: 'US Letter (8.5 × 11 in)' },
                  { key: 'legal', title: 'US Legal (8.5 × 14 in)' },
                ].map((sz) => (
                  <button
                    key={sz.key}
                    type="button"
                    onClick={() => setTargetPageSize(sz.key as 'a4' | 'letter' | 'legal')}
                    className={`px-4 py-2.5 rounded-lg border border-[#2F3E4E] font-bold cursor-pointer ${
                      targetPageSize === sz.key ? 'bg-[#2F3E4E] text-[#FFFDF5]' : 'bg-white text-[#2F3E4E]'
                    }`}
                  >
                    {sz.title}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={processPdfPageSizeChanger}
                disabled={isProcessing}
                className="px-5 py-2.5 bg-[#2F3E4E] text-[#FFFDF5] rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                <Maximize className="w-4 h-4" /> Standardize to {targetPageSize.toUpperCase()}
              </button>
            </div>
          ) : isUnlocker ? (
            <div className="p-5 border-[1.5px] border-[#2F3E4E] rounded-xl space-y-4 bg-white">
              <input
                type="password"
                value={unlockPassword}
                onChange={(e) => setUnlockPassword(e.target.value)}
                placeholder="Enter PDF password..."
                className="w-full max-w-md px-3.5 py-2 text-sm border-[1.5px] border-[#2F3E4E] rounded-lg"
              />
              <div>
                <button
                  type="button"
                  onClick={processPdfUnlocker}
                  disabled={isProcessing || !unlockPassword}
                  className="px-5 py-2.5 bg-[#2F3E4E] disabled:opacity-50 text-[#FFFDF5] rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer"
                >
                  <Unlock className="w-4 h-4" /> Unlock &amp; Save Copy
                </button>
              </div>
            </div>
          ) : isProtector ? (
            <div className="p-5 border-[1.5px] border-[#2F3E4E] rounded-xl space-y-4 bg-white">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
                <input
                  type="password"
                  value={protectPassword}
                  onChange={(e) => setProtectPassword(e.target.value)}
                  placeholder="Create password..."
                  className="w-full px-3 py-2 text-xs border-[1.5px] border-[#2F3E4E] rounded-lg"
                />
                <input
                  type="password"
                  value={confirmProtectPassword}
                  onChange={(e) => setConfirmProtectPassword(e.target.value)}
                  placeholder="Confirm password..."
                  className="w-full px-3 py-2 text-xs border-[1.5px] border-[#2F3E4E] rounded-lg"
                />
              </div>
              <button
                type="button"
                onClick={processPdfPasswordProtector}
                disabled={isProcessing || !protectPassword}
                className="px-5 py-2.5 bg-[#2F3E4E] disabled:opacity-50 text-[#FFFDF5] rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                <Lock className="w-4 h-4" /> Encrypt &amp; Lock PDF
              </button>
            </div>
          ) : isCompressor ? (
            <div className="p-5 border-[1.5px] border-[#2F3E4E] rounded-xl space-y-4 bg-white">
              <p className="text-xs text-[#475569]">
                Re-packs cross-reference streams and object streams cleanly inside your browser with before/after size comparison.
              </p>
              <button
                type="button"
                onClick={processPdfCompressor}
                disabled={isProcessing}
                className="px-6 py-2.5 bg-[#2F3E4E] disabled:opacity-50 text-[#FFFDF5] rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" /> Compress PDF Now
              </button>
            </div>
          ) : isFlattenRepair ? (
            <div className="p-5 border-[1.5px] border-[#2F3E4E] rounded-xl space-y-4 bg-white">
              <p className="text-xs text-[#475569]">
                Flattens interactive AcroForm fields into permanent static page layers and rebuilds PDF object &amp; cross-reference tables cleanly.
              </p>
              <button
                type="button"
                onClick={processPdfFlattenRepair}
                disabled={isProcessing}
                className="px-6 py-2.5 bg-[#2F3E4E] disabled:opacity-50 text-[#FFFDF5] rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} /> Flatten &amp; Repair PDF
              </button>
            </div>
          ) : null}
        </div>
      )}

      {/* Status Notice */}
      {statusMsg && (
        <div
          className={`p-4 rounded-xl border-[1.5px] flex items-center gap-3 text-xs font-semibold ${
            statusMsg.type === 'success'
              ? 'bg-[#CEE5DC]/75 border-[#2F3E4E] text-[#2F3E4E]'
              : statusMsg.type === 'info'
              ? 'bg-[#FEF2C8] border-[#2F3E4E] text-[#2F3E4E]'
              : 'bg-red-50 border-red-600 text-red-800'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-700 shrink-0" />
          ) : statusMsg.type === 'info' ? (
            <Info className="w-4 h-4 text-[#2F3E4E] shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-700 shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Download Banner */}
      {outputUrl && !isPdfToImage && (
        <div className="p-4 bg-[#CEE5DC] border-[1.5px] border-[#2F3E4E] rounded-xl flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-[#2F3E4E]">Processed PDF Ready</p>
            <p className="text-xs text-[#475569] font-mono tabular-nums">
              Final Size: {outputSizeKb} KB · Local Browser Output
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownload}
            className="px-5 py-2.5 bg-[#2F3E4E] hover:bg-[#1E293B] text-[#FFFDF5] rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" /> Download PDF
          </button>
        </div>
      )}
    </div>
  );
};
