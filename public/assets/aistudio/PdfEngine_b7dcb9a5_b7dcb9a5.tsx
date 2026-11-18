import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import JSZip from 'jszip';
import { encryptPDF } from '@pdfsmaller/pdf-encrypt';
import { decryptPDF } from '@pdfsmaller/pdf-decrypt';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

import {
  Upload,
  Download,
  FileText,
  Layers,
  Scissors,
  CheckCircle,
  AlertCircle,
  Trash2,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  PenTool,
  Stamp,
  Lock,
  Unlock,
  Eye,
  Plus,
  Image as ImageIcon,
  Edit,
  Maximize,
  Printer,
  Sliders,
  CheckSquare,
  Square,
  Hash,
  Info,
  Crop,
  Shield,
  FolderPlus,
  Sparkles,
  Archive,
  FileImage,
  Check
} from 'lucide-react';
import { Tool } from '../types';

interface PdfEngineProps {
  tool: Tool;
}

interface ConvertedPage {
  pageNum: number;
  dataUrl: string;
  width: number;
  height: number;
  sizeKb: number;
}

export const PdfEngine: React.FC<PdfEngineProps> = ({ tool }) => {
  // Determine tool classification
  const isPng =
    tool.id === 'pdf-to-png' ||
    tool.slug === 'pdf-to-png' ||
    tool.name.toLowerCase().includes('png');
  const imgFormat = isPng ? 'image/png' : 'image/jpeg';
  const imgExtension = isPng ? 'png' : 'jpg';

  const isMerger =
    tool.id === 'pdf-merger' ||
    tool.slug === 'pdf-merger' ||
    tool.id === 'multiple-pdfs-to-one' ||
    tool.slug === 'multiple-pdfs-to-one' ||
    tool.engineToolId === 'merger';
  const isImageToPdf =
    tool.id === 'image-to-pdf' ||
    tool.slug === 'image-to-pdf' ||
    tool.id === 'jpg-to-pdf' ||
    tool.slug === 'jpg-to-pdf' ||
    tool.id === 'png-to-pdf' ||
    tool.slug === 'png-to-pdf' ||
    tool.id === 'multiple-photos-to-pdf' ||
    tool.slug === 'multiple-photos-to-pdf' ||
    tool.engineToolId === 'img-to-pdf';
  const isPdfToImage =
    tool.id === 'pdf-to-jpg' ||
    tool.slug === 'pdf-to-jpg' ||
    tool.id === 'pdf-to-png' ||
    tool.slug === 'pdf-to-png' ||
    tool.id === 'pdf-to-image' ||
    tool.slug === 'pdf-to-image' ||
    tool.engineToolId === 'pdf-to-img' ||
    tool.engineToolId === 'pdf-to-image' ||
    tool.name.toLowerCase().includes('pdf to jpg') ||
    tool.name.toLowerCase().includes('pdf to png');
  const isSplitter =
    tool.id === 'pdf-splitter' ||
    tool.slug === 'pdf-splitter' ||
    tool.id === 'pdf-page-extractor' ||
    tool.slug === 'pdf-page-extractor' ||
    tool.engineToolId === 'splitter';
  const isDeleter = tool.id === 'pdf-page-deleter' || tool.slug === 'pdf-page-deleter';
  const isReorder = tool.id === 'pdf-page-reorder' || tool.slug === 'pdf-page-reorder';
  const isRotator = tool.id === 'pdf-page-rotator' || tool.slug === 'pdf-page-rotator';
  const isWatermark = tool.id === 'pdf-watermark-maker' || tool.slug === 'pdf-watermark-maker';
  const isNumbering = tool.id === 'pdf-page-numbering' || tool.slug === 'pdf-page-numbering';
  const isSigner = tool.id === 'pdf-signer' || tool.slug === 'pdf-signer' || tool.engineToolId === 'signer';
  const isFormFiller = tool.id === 'pdf-form-filler' || tool.slug === 'pdf-form-filler';
  const isMetadataViewer = tool.id === 'pdf-metadata-viewer' || tool.slug === 'pdf-metadata-viewer';
  const isMetadataEditor = tool.id === 'pdf-metadata-editor' || tool.slug === 'pdf-metadata-editor';
  const isCropper = tool.id === 'pdf-cropper' || tool.slug === 'pdf-cropper';
  const isPageSizeChanger =
    tool.id === 'pdf-page-size-changer' ||
    tool.slug === 'pdf-page-size-changer' ||
    tool.id === 'pdf-print-layout-maker' ||
    tool.slug === 'pdf-print-layout-maker';
  const isUnlocker = tool.id === 'pdf-unlocker' || tool.slug === 'pdf-unlocker';
  const isProtector = tool.id === 'pdf-password-protector' || tool.slug === 'pdf-password-protector';
  const isCompressor = tool.id === 'pdf-compressor' || tool.slug === 'pdf-compressor' || tool.engineToolId === 'compressor';

  // Single PDF Upload State
  const [file, setFile] = useState<File | null>(null);
  const [fileBytes, setFileBytes] = useState<ArrayBuffer | null>(null);
  const [fileSizeKb, setFileSizeKb] = useState<number>(0);
  const [pageCount, setPageCount] = useState<number>(0);
  const [pageThumbnails, setPageThumbnails] = useState<{ pageNum: number; dataUrl: string }[]>([]);

  // Multi PDF Upload State (for Merger & Multiple PDFs to One)
  const [mergeFiles, setMergeFiles] = useState<{ id: string; file: File; bytes: ArrayBuffer; sizeKb: number; pages: number }[]>([]);

  // Images for Image-to-PDF / PNG-to-PDF
  const [imgFiles, setImgFiles] = useState<{ id: string; file: File; url: string }[]>([]);
  const [imgOrientation, setImgOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [imgMargin, setImgMargin] = useState<number>(20); // pts

  // PDF to JPG / PNG State
  const [convertedPages, setConvertedPages] = useState<ConvertedPage[]>([]);
  const [imageDpi, setImageDpi] = useState<number>(200);
  const [convertingProgress, setConvertingProgress] = useState<{ current: number; total: number } | null>(null);
  const [isZipping, setIsZipping] = useState<boolean>(false);

  // Splitter & Extractor State
  const [splitRange, setSplitRange] = useState<string>('1');
  const [selectedPagesToExtract, setSelectedPagesToExtract] = useState<number[]>([]);

  // Page Deleter State
  const [selectedPagesToDelete, setSelectedPagesToDelete] = useState<number[]>([]);

  // Page Reorder State
  const [pageOrder, setPageOrder] = useState<number[]>([]);

  // Page Rotator State
  const [rotationAngle, setRotationAngle] = useState<number>(90);
  const [rotateTargetPage, setRotateTargetPage] = useState<'all' | number>('all');

  // Signer State
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [signPage, setSignPage] = useState<number>(1);
  const [signPosition, setSignPosition] = useState<'bottom-right' | 'bottom-center' | 'bottom-left' | 'center'>('bottom-right');
  const [sigInkColor, setSigInkColor] = useState<'#000000' | '#1e40af'>('#000000');
  const [sigPenWidth, setSigPenWidth] = useState<number>(3);
  const [isDrawingSig, setIsDrawingSig] = useState<boolean>(false);
  const sigPadRef = useRef<HTMLCanvasElement | null>(null);

  // Form Filler State
  const [formText, setFormText] = useState<string>('');
  const [formPage, setFormPage] = useState<number>(1);
  const [formPosX, setFormPosX] = useState<number>(60);
  const [formPosY, setFormPosY] = useState<number>(750);
  const [formFontSize, setFormFontSize] = useState<number>(12);

  // Watermark State
  const [watermarkText, setWatermarkText] = useState<string>('CONFIDENTIAL');
  const [watermarkOpacity, setWatermarkOpacity] = useState<number>(0.2);
  const [watermarkColor, setWatermarkColor] = useState<'grey' | 'red' | 'blue'>('grey');

  // Page Numbering State
  const [numberingFormat, setNumberingFormat] = useState<'page-x-of-y' | 'page-x' | 'bates'>('page-x-of-y');
  const [numberingPos, setNumberingPos] = useState<'bottom-center' | 'bottom-right' | 'top-right'>('bottom-center');
  const [numberingStart, setNumberingStart] = useState<number>(1);

  // Metadata State
  const [metaTitle, setMetaTitle] = useState<string>('');
  const [metaAuthor, setMetaAuthor] = useState<string>('');
  const [metaSubject, setMetaSubject] = useState<string>('');
  const [metaKeywords, setMetaKeywords] = useState<string>('');
  const [metaProducer, setMetaProducer] = useState<string>('');
  const [metaCreator, setMetaCreator] = useState<string>('');

  // Cropper State
  const [cropMarginPercent, setCropMarginPercent] = useState<number>(10);

  // Page Size Changer & Print Layout State
  const [targetPageSize, setTargetPageSize] = useState<'a4' | 'letter' | 'legal'>('a4');
  const [printMarginStyle, setPrintMarginStyle] = useState<'normal' | 'narrow' | 'wide'>('normal');

  // Password & Security State
  const [unlockPassword, setUnlockPassword] = useState<string>('');
  const [protectPassword, setProtectPassword] = useState<string>('');
  const [confirmProtectPassword, setConfirmProtectPassword] = useState<string>('');

  // Processing & Download State
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [outputSizeKb, setOutputSizeKb] = useState<number>(0);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const sanitizeWinAnsi = (text: string): string => {
    return (text || '')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/\u2022/g, '*')
      .replace(/\u20B9/g, 'Rs.')
      .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '');
  };

  // Reset tool state when navigating between tools
  useEffect(() => {
    resetAll();
  }, [tool.id]);

  const resetAll = () => {
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    imgFiles.forEach(item => URL.revokeObjectURL(item.url));
    setFile(null);
    setFileBytes(null);
    setFileSizeKb(0);
    setPageCount(0);
    setPageThumbnails([]);
    setMergeFiles([]);
    setImgFiles([]);
    setConvertedPages([]);
    setConvertingProgress(null);
    setSelectedPagesToDelete([]);
    setSelectedPagesToExtract([]);
    setSplitRange('1');
    setPageOrder([]);
    setSignatureDataUrl(null);
    setOutputUrl(null);
    setOutputSizeKb(0);
    setStatusMsg(null);
    setUnlockPassword('');
    setProtectPassword('');
    setConfirmProtectPassword('');
  };

  // Safe helper to obtain a fresh, valid Uint8Array that is never detached by web workers
  const getWorkingBytes = async (): Promise<Uint8Array | null> => {
    if (file) {
      try {
        const buf = await file.arrayBuffer();
        return new Uint8Array(buf);
      } catch (e) {
        console.warn('Could not re-read from File object, checking fallback:', e);
      }
    }
    if (fileBytes && fileBytes.byteLength > 0) {
      return new Uint8Array(fileBytes.slice(0));
    }
    return null;
  };

  // Generate thumbnails for visual page navigation
  const generateThumbnails = async (buffer: ArrayBuffer, total: number) => {
    try {
      // CLONE the buffer so worker transfer does not detach caller's buffer!
      const cloned = new Uint8Array(buffer.slice(0));
      const loadingTask = pdfjsLib.getDocument({ data: cloned });
      const pdf = await loadingTask.promise;
      const thumbs: { pageNum: number; dataUrl: string }[] = [];
      const maxPages = Math.min(total, 16); // Render thumbnails up to 16 pages for snappy UI

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
          await page.render({ canvasContext: ctx as any, viewport }).promise;
          thumbs.push({ pageNum: i, dataUrl: canvas.toDataURL('image/jpeg', 0.8) });
        }
      }
      setPageThumbnails(thumbs);
    } catch (err) {
      console.error('Thumbnail generation error:', err);
    }
  };

  // Dedicated High-Resolution PDF to Image Converter
  const convertBufferToImages = async (
    buffer: ArrayBuffer,
    totalCount?: number,
    dpi: number = imageDpi
  ) => {
    try {
      setIsProcessing(true);
      setConvertedPages([]);

      const scale = dpi / 72;
      // CLONE the buffer so worker transfer does not detach caller's buffer!
      const cloned = new Uint8Array(buffer.slice(0));
      const loadingTask = pdfjsLib.getDocument({ data: cloned });
      const pdfDoc = await loadingTask.promise;
      const total = totalCount || pdfDoc.numPages;
      const results: ConvertedPage[] = [];

      for (let i = 1; i <= total; i++) {
        setConvertingProgress({ current: i, total });
        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const ctx = canvas.getContext('2d');

        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          await page.render({
            canvasContext: ctx as any,
            viewport
          }).promise;

          const dataUrl = canvas.toDataURL(imgFormat, isPng ? undefined : 0.92);
          const approxKb = Math.round((dataUrl.length * 3) / 4 / 1024);

          results.push({
            pageNum: i,
            dataUrl,
            width: canvas.width,
            height: canvas.height,
            sizeKb: approxKb
          });
        }
      }

      setConvertedPages(results);
      setStatusMsg({
        type: 'success',
        text: `Successfully converted all ${total} page(s) into high-resolution ${imgExtension.toUpperCase()} images (${dpi} DPI)!`
      });
    } catch (err) {
      console.error(err);
      setStatusMsg({ type: 'error', text: `Failed to convert PDF pages to ${imgExtension.toUpperCase()}.` });
    } finally {
      setIsProcessing(false);
      setConvertingProgress(null);
    }
  };

  // Handle Single PDF Upload
  const handleSingleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploaded = e.target.files?.[0];
    if (!uploaded) return;

    if (uploaded.type !== 'application/pdf' && !uploaded.name.toLowerCase().endsWith('.pdf')) {
      setStatusMsg({ type: 'error', text: 'Please select a valid PDF file.' });
      return;
    }

    try {
      setIsProcessing(true);
      const buffer = await uploaded.arrayBuffer();
      setFile(uploaded);
      setFileBytes(buffer.slice(0));
      setFileSizeKb(Math.round(uploaded.size / 1024));

      let count = 1;
      try {
        const pdfDoc = await PDFDocument.load(buffer.slice(0), { ignoreEncryption: true });
        count = pdfDoc.getPageCount();
        setPageCount(count);
        setPageOrder(Array.from({ length: count }, (_, i) => i + 1));
        setSelectedPagesToDelete([]);
        setSelectedPagesToExtract([]);
        setSplitRange('1');
        setConvertedPages([]);

        setMetaTitle(pdfDoc.getTitle() || '');
        setMetaAuthor(pdfDoc.getAuthor() || '');
        setMetaSubject(pdfDoc.getSubject() || '');
        setMetaKeywords(pdfDoc.getKeywords() || '');
        setMetaProducer(pdfDoc.getProducer() || '');
        setMetaCreator(pdfDoc.getCreator() || '');

        if (pdfDoc.isEncrypted && !isUnlocker) {
          setStatusMsg({
            type: 'error',
            text: 'Notice: This PDF is password-protected or encrypted. Please unlock it first using the PDF Unlocker tool before performing edits.'
          });
        } else {
          setStatusMsg(null);
        }
      } catch (parseErr) {
        console.warn('PDF metadata read note:', parseErr);
        if (isUnlocker) {
          setStatusMsg({
            type: 'info',
            text: 'Locked PDF loaded. Enter your password below to unlock and export an unencrypted copy.'
          });
        } else {
          setStatusMsg({
            type: 'error',
            text: 'This PDF appears to be password-protected or encrypted. Please unlock it using the PDF Unlocker tool first.'
          });
        }
      }

      // Render visual thumbnails using cloned buffer
      generateThumbnails(buffer.slice(0), count);

      // Auto-convert immediately if PDF to JPG/PNG tool
      if (isPdfToImage) {
        convertBufferToImages(buffer.slice(0), count, imageDpi);
      }
    } catch (err) {
      console.error(err);
      setStatusMsg({
        type: 'error',
        text: 'Could not load PDF document. It may be encrypted with a password or damaged.'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Quick In-Memory Sample PDF Generator for Instant Testing
  const loadSampleDocument = async () => {
    try {
      setIsProcessing(true);
      const doc = await PDFDocument.create();
      const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
      const font = await doc.embedFont(StandardFonts.Helvetica);

      // Page 1
      const p1 = doc.addPage([595.28, 841.89]);
      p1.drawText('Sample Official Application Dossier', {
        x: 50,
        y: 780,
        size: 18,
        font: boldFont,
        color: rgb(0.1, 0.2, 0.5)
      });
      p1.drawText('Document ID: IND-GOV-2026-84920', {
        x: 50,
        y: 755,
        size: 11,
        font,
        color: rgb(0.4, 0.4, 0.4)
      });
      p1.drawText('This sample document is provided for testing client-side PDF conversions,', {
        x: 50,
        y: 710,
        size: 12,
        font
      });
      p1.drawText('splitting, page extraction, signing, watermarking, and compression.', {
        x: 50,
        y: 690,
        size: 12,
        font
      });
      p1.drawRectangle({
        x: 50,
        y: 530,
        width: 495,
        height: 120,
        borderColor: rgb(0.3, 0.5, 0.8),
        borderWidth: 1
      });
      p1.drawText('Candidate Name: Ramesh Kumar', { x: 70, y: 620, size: 12, font: boldFont });
      p1.drawText('Application Post: Assistant Section Officer (ASO)', { x: 70, y: 595, size: 11, font });
      p1.drawText('Verification Status: Certified Document Copy', {
        x: 70,
        y: 565,
        size: 11,
        font,
        color: rgb(0.1, 0.6, 0.2)
      });

      // Page 2
      const p2 = doc.addPage([595.28, 841.89]);
      p2.drawText('Annexure II: Marks Verification & Credentials', {
        x: 50,
        y: 780,
        size: 16,
        font: boldFont,
        color: rgb(0.1, 0.2, 0.5)
      });
      p2.drawText('University Board Examination Transcript Summary', {
        x: 50,
        y: 740,
        size: 12,
        font
      });
      p2.drawText('Semester 1: 82.4%  |  Semester 2: 85.1%  |  Semester 3: 88.0%', {
        x: 50,
        y: 700,
        size: 11,
        font
      });
      p2.drawText('Overall Grade: Distinction (First Class with Honours)', {
        x: 50,
        y: 670,
        size: 11,
        font: boldFont,
        color: rgb(0.1, 0.5, 0.2)
      });

      const bytes = await doc.save();
      const sampleBlob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
      const sampleFile = new File([sampleBlob], 'bharattools-sample-document.pdf', { type: 'application/pdf' });

      setFile(sampleFile);
      setFileBytes(bytes.slice(0).buffer as ArrayBuffer);
      setFileSizeKb(Math.round(sampleFile.size / 1024));
      setPageCount(2);
      setPageOrder([1, 2]);
      setSelectedPagesToDelete([]);
      setSelectedPagesToExtract([]);
      setSplitRange('1');
      setConvertedPages([]);
      setStatusMsg(null);

      generateThumbnails(bytes.slice(0).buffer as ArrayBuffer, 2);

      // Auto-convert sample immediately if PDF to JPG/PNG tool
      if (isPdfToImage) {
        convertBufferToImages(bytes.slice(0).buffer as ArrayBuffer, 2, imageDpi);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Multi-PDF Upload Handler (for Merger)
  const handleMergeFilesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newItems: { id: string; file: File; bytes: ArrayBuffer; sizeKb: number; pages: number }[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) {
        const bytes = await f.arrayBuffer();
        try {
          const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
          newItems.push({
            id: Math.random().toString(36).substring(2, 9),
            file: f,
            bytes,
            sizeKb: Math.round(f.size / 1024),
            pages: doc.getPageCount()
          });
        } catch {
          newItems.push({
            id: Math.random().toString(36).substring(2, 9),
            file: f,
            bytes,
            sizeKb: Math.round(f.size / 1024),
            pages: 1
          });
        }
      }
    }
    setMergeFiles(prev => [...prev, ...newItems]);
  };

  const moveMergeFile = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= mergeFiles.length) return;
    const updated = [...mergeFiles];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    setMergeFiles(updated);
  };

  const removeMergeFile = (id: string) => {
    setMergeFiles(prev => prev.filter(item => item.id !== id));
  };

  // Image to PDF Upload Handler
  const handleImageToPdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const items: { id: string; file: File; url: string }[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.type.startsWith('image/')) {
        items.push({
          id: Math.random().toString(36).substring(2, 9),
          file: f,
          url: URL.createObjectURL(f)
        });
      }
    }
    setImgFiles(prev => [...prev, ...items]);
  };

  // ==========================================
  // PDF PROCESSING ACTION IMPLEMENTATIONS
  // ==========================================

  // 1. PDF to JPG / PNG Converter
  const processPdfToImages = async () => {
    const bytes = await getWorkingBytes();
    if (!bytes) {
      setStatusMsg({ type: 'error', text: 'Please select a valid PDF file first.' });
      return;
    }
    await convertBufferToImages(bytes.buffer as ArrayBuffer, pageCount, imageDpi);
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
    if (convertedPages.length === 0) return;
    convertedPages.forEach((item, index) => {
      setTimeout(() => {
        downloadSingleImage(item.dataUrl, item.pageNum);
      }, index * 250);
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
    } catch (err) {
      console.error('ZIP generation error:', err);
      setStatusMsg({ type: 'error', text: 'Failed to create ZIP package. You can download pages individually.' });
    } finally {
      setIsZipping(false);
    }
  };

  // 2. PDF Compressor
  const processPdfCompressor = async () => {
    const bytes = await getWorkingBytes();
    if (!bytes) {
      setStatusMsg({ type: 'error', text: 'Please upload a PDF file to compress.' });
      return;
    }
    try {
      setIsProcessing(true);
      const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });

      // Compress by restructuring cross-references and packing objects into compressed streams
      const compressedBytes = await pdfDoc.save({ useObjectStreams: true });
      const blob = new Blob([compressedBytes as unknown as BlobPart], { type: 'application/pdf' });
      if (outputUrl) URL.revokeObjectURL(outputUrl);
      const url = URL.createObjectURL(blob);
      setOutputUrl(url);

      const finalKb = Math.round(blob.size / 1024);
      setOutputSizeKb(finalKb);
      const savings = Math.max(0, Math.round(((fileSizeKb - finalKb) / Math.max(fileSizeKb, 1)) * 100));

      setStatusMsg({
        type: 'success',
        text: `PDF optimized! Original: ${fileSizeKb} KB → Compressed: ${finalKb} KB (${savings}% reduction).`
      });
    } catch (err: any) {
      console.error(err);
      setStatusMsg({ type: 'error', text: err?.message || 'Failed to compress PDF.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. PDF Merger & Multiple PDFs to One
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
        copiedPages.forEach(p => mergedPdf.addPage(p));
      }

      const mergedBytes = await mergedPdf.save();
      const blob = new Blob([mergedBytes as unknown as BlobPart], { type: 'application/pdf' });
      if (outputUrl) URL.revokeObjectURL(outputUrl);
      setOutputUrl(URL.createObjectURL(blob));
      setOutputSizeKb(Math.round(blob.size / 1024));
      setStatusMsg({ type: 'success', text: `Successfully merged ${mergeFiles.length} PDF documents into one!` });
    } catch (err: any) {
      console.error(err);
      setStatusMsg({ type: 'error', text: err?.message || 'Failed to merge PDF files. Ensure files are not corrupted.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // 4. PDF Splitter & Page Extractor
  const processPdfSplitter = async () => {
    const bytes = await getWorkingBytes();
    if (!bytes) {
      setStatusMsg({ type: 'error', text: 'Please upload a PDF document first.' });
      return;
    }
    try {
      setIsProcessing(true);
      const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const total = srcDoc.getPageCount();

      const pageNumbersToExtract = new Set<number>();

      // Parse text range input (e.g. "1-2, 4")
      const parts = splitRange.split(',');
      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed.includes('-')) {
          const [startStr, endStr] = trimmed.split('-');
          const start = parseInt(startStr, 10);
          const end = parseInt(endStr, 10);
          if (!isNaN(start) && !isNaN(end)) {
            for (let i = Math.max(1, start); i <= Math.min(total, end); i++) {
              pageNumbersToExtract.add(i - 1);
            }
          }
        } else {
          const num = parseInt(trimmed, 10);
          if (!isNaN(num) && num >= 1 && num <= total) {
            pageNumbersToExtract.add(num - 1);
          }
        }
      }

      // Also include pages checked via thumbnail click
      selectedPagesToExtract.forEach(p => {
        if (p >= 1 && p <= total) pageNumbersToExtract.add(p - 1);
      });

      if (pageNumbersToExtract.size === 0) {
        setStatusMsg({ type: 'error', text: `Please specify valid page numbers between 1 and ${total}.` });
        setIsProcessing(false);
        return;
      }

      const splitDoc = await PDFDocument.create();
      const indices = Array.from(pageNumbersToExtract).sort((a, b) => a - b);
      const copied = await splitDoc.copyPages(srcDoc, indices);
      copied.forEach(p => splitDoc.addPage(p));

      const splitBytes = await splitDoc.save();
      const blob = new Blob([splitBytes as unknown as BlobPart], { type: 'application/pdf' });
      if (outputUrl) URL.revokeObjectURL(outputUrl);
      setOutputUrl(URL.createObjectURL(blob));
      setOutputSizeKb(Math.round(blob.size / 1024));
      setStatusMsg({ type: 'success', text: `Extracted ${indices.length} pages into a new clean PDF!` });
    } catch (err: any) {
      console.error(err);
      setStatusMsg({ type: 'error', text: err?.message || 'Failed to extract PDF pages.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // 5. Image / PNG to PDF Converter
  const processImageToPdf = async () => {
    if (imgFiles.length === 0) {
      setStatusMsg({ type: 'error', text: 'Please add at least one image file.' });
      return;
    }
    try {
      setIsProcessing(true);
      const pdfDoc = await PDFDocument.create();

      // Standard A4 dimensions: 595.28 x 841.89 points
      const isPortrait = imgOrientation === 'portrait';
      const pageWidth = isPortrait ? 595.28 : 841.89;
      const pageHeight = isPortrait ? 841.89 : 595.28;
      const margin = imgMargin;

      for (const item of imgFiles) {
        let embeddedImage;
        if (item.file.type === 'image/png') {
          const imgBuffer = await item.file.arrayBuffer();
          embeddedImage = await pdfDoc.embedPng(imgBuffer);
        } else if (item.file.type === 'image/jpeg' || item.file.type === 'image/jpg') {
          const imgBuffer = await item.file.arrayBuffer();
          embeddedImage = await pdfDoc.embedJpg(imgBuffer);
        } else {
          // Rasterize WEBP/BMP/SVG/other image formats to JPEG via offscreen canvas
          const imgEl = new Image();
          await new Promise<void>((resolve, reject) => {
            imgEl.onload = () => resolve();
            imgEl.onerror = () => reject(new Error(`Could not decode ${item.file.name}`));
            imgEl.src = item.url;
          });
          const c = document.createElement('canvas');
          c.width = imgEl.naturalWidth || imgEl.width;
          c.height = imgEl.naturalHeight || imgEl.height;
          const ctx = c.getContext('2d');
          if (!ctx) throw new Error('Canvas unavailable for image conversion');
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, c.width, c.height);
          ctx.drawImage(imgEl, 0, 0);
          const convertedBlob: Blob = await new Promise((resolve, reject) =>
            c.toBlob(b => (b ? resolve(b) : reject(new Error('Failed to encode image'))), 'image/jpeg', 0.92)
          );
          embeddedImage = await pdfDoc.embedJpg(await convertedBlob.arrayBuffer());
        }

        const page = pdfDoc.addPage([pageWidth, pageHeight]);
        const maxWidth = pageWidth - margin * 2;
        const maxHeight = pageHeight - margin * 2;
        const dims = embeddedImage.scaleToFit(maxWidth, maxHeight);

        page.drawImage(embeddedImage, {
          x: (pageWidth - dims.width) / 2,
          y: (pageHeight - dims.height) / 2,
          width: dims.width,
          height: dims.height
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
      if (outputUrl) URL.revokeObjectURL(outputUrl);
      setOutputUrl(URL.createObjectURL(blob));
      setOutputSizeKb(Math.round(blob.size / 1024));
      setStatusMsg({ type: 'success', text: `Generated standardized A4 PDF with ${imgFiles.length} pages!` });
    } catch (err: any) {
      console.error(err);
      setStatusMsg({ type: 'error', text: err?.message || 'Failed to convert images to PDF.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // 6. PDF Page Deleter
  const processPdfPageDeleter = async () => {
    const bytes = await getWorkingBytes();
    if (!bytes) return;
    if (selectedPagesToDelete.length === 0) {
      setStatusMsg({ type: 'error', text: 'Please select at least one page to delete.' });
      return;
    }
    if (selectedPagesToDelete.length >= pageCount) {
      setStatusMsg({ type: 'error', text: 'Cannot delete all pages in the PDF document.' });
      return;
    }

    try {
      setIsProcessing(true);
      const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const newDoc = await PDFDocument.create();

      const keepIndices = [];
      for (let i = 1; i <= pageCount; i++) {
        if (!selectedPagesToDelete.includes(i)) {
          keepIndices.push(i - 1);
        }
      }

      const copied = await newDoc.copyPages(srcDoc, keepIndices);
      copied.forEach(p => newDoc.addPage(p));

      const savedBytes = await newDoc.save();
      const blob = new Blob([savedBytes as unknown as BlobPart], { type: 'application/pdf' });
      if (outputUrl) URL.revokeObjectURL(outputUrl);
      setOutputUrl(URL.createObjectURL(blob));
      setOutputSizeKb(Math.round(blob.size / 1024));
      setStatusMsg({
        type: 'success',
        text: `Removed ${selectedPagesToDelete.length} page(s). New PDF has ${keepIndices.length} page(s)!`
      });
    } catch (err: any) {
      console.error(err);
      setStatusMsg({ type: 'error', text: err?.message || 'Failed to delete selected pages.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // 7. PDF Page Reorder
  const movePageInOrder = (idx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= pageOrder.length) return;
    const nextOrder = [...pageOrder];
    const temp = nextOrder[idx];
    nextOrder[idx] = nextOrder[targetIdx];
    nextOrder[targetIdx] = temp;
    setPageOrder(nextOrder);
  };

  const processPdfPageReorder = async () => {
    const bytes = await getWorkingBytes();
    if (!bytes) return;
    try {
      setIsProcessing(true);
      const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const newDoc = await PDFDocument.create();

      const zeroIndices = pageOrder.map(p => p - 1);
      const copied = await newDoc.copyPages(srcDoc, zeroIndices);
      copied.forEach(p => newDoc.addPage(p));

      const savedBytes = await newDoc.save();
      const blob = new Blob([savedBytes as unknown as BlobPart], { type: 'application/pdf' });
      if (outputUrl) URL.revokeObjectURL(outputUrl);
      setOutputUrl(URL.createObjectURL(blob));
      setOutputSizeKb(Math.round(blob.size / 1024));
      setStatusMsg({ type: 'success', text: 'Pages rearranged in your custom sequence successfully!' });
    } catch (err: any) {
      console.error(err);
      setStatusMsg({ type: 'error', text: err?.message || 'Failed to reorder PDF pages.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // 8. PDF Page Rotator
  const processPdfPageRotator = async () => {
    const bytes = await getWorkingBytes();
    if (!bytes) return;
    try {
      setIsProcessing(true);
      const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const pages = pdfDoc.getPages();

      if (rotateTargetPage === 'all') {
        pages.forEach(p => {
          const currentRot = p.getRotation().angle;
          p.setRotation(degrees((currentRot + rotationAngle) % 360));
        });
      } else {
        const targetIdx = Math.min(Math.max(1, rotateTargetPage), pages.length) - 1;
        const p = pages[targetIdx];
        const currentRot = p.getRotation().angle;
        p.setRotation(degrees((currentRot + rotationAngle) % 360));
      }

      const rotatedBytes = await pdfDoc.save();
      const blob = new Blob([rotatedBytes as unknown as BlobPart], { type: 'application/pdf' });
      if (outputUrl) URL.revokeObjectURL(outputUrl);
      setOutputUrl(URL.createObjectURL(blob));
      setOutputSizeKb(Math.round(blob.size / 1024));
      setStatusMsg({
        type: 'success',
        text: `Rotated ${rotateTargetPage === 'all' ? 'all pages' : `page ${rotateTargetPage}`} by ${rotationAngle}°!`
      });
    } catch (err: any) {
      console.error(err);
      setStatusMsg({ type: 'error', text: err?.message || 'Failed to rotate PDF pages.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // 9. PDF Watermark Maker
  const processPdfWatermark = async () => {
    const bytes = await getWorkingBytes();
    if (!bytes) {
      setStatusMsg({ type: 'error', text: 'Please upload a PDF document first.' });
      return;
    }
    try {
      setIsProcessing(true);
      const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      if (pdfDoc.isEncrypted) {
        setStatusMsg({
          type: 'error',
          text: 'This PDF document is encrypted or password-protected. Please unlock it using the PDF Unlocker tool before adding a watermark.'
        });
        return;
      }
      const pages = pdfDoc.getPages();
      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const colorVal =
        watermarkColor === 'red'
          ? rgb(0.85, 0.2, 0.2)
          : watermarkColor === 'blue'
          ? rgb(0.15, 0.35, 0.85)
          : rgb(0.55, 0.55, 0.55);

      const safeWatermark = sanitizeWinAnsi(watermarkText.trim()) || 'CONFIDENTIAL';
      pages.forEach(page => {
        const { width, height } = page.getSize();
        page.drawText(safeWatermark, {
          x: width / 4,
          y: height / 2,
          size: 42,
          font,
          color: colorVal,
          opacity: watermarkOpacity,
          rotate: degrees(45)
        });
      });

      const stampedBytes = await pdfDoc.save();
      const blob = new Blob([stampedBytes as unknown as BlobPart], { type: 'application/pdf' });
      if (outputUrl) URL.revokeObjectURL(outputUrl);
      setOutputUrl(URL.createObjectURL(blob));
      setOutputSizeKb(Math.round(blob.size / 1024));
      setStatusMsg({ type: 'success', text: `Watermark "${watermarkText || 'CONFIDENTIAL'}" stamped across all pages!` });
    } catch (err: any) {
      console.error('PDF Watermark error:', err);
      const msg = typeof err === 'string' ? err : err?.message || '';
      if (msg.toLowerCase().includes('encrypt') || msg.toLowerCase().includes('password')) {
        setStatusMsg({
          type: 'error',
          text: 'This PDF is password-protected. Please unlock it using the PDF Unlocker tool before adding a watermark.'
        });
      } else {
        setStatusMsg({ type: 'error', text: msg || 'Failed to apply watermark. The PDF structure may be corrupted or protected.' });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // 10. PDF Page Numbering
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

        if (numberingPos === 'bottom-right') {
          xPos = width - textWidth - 40;
          yPos = 25;
        } else if (numberingPos === 'top-right') {
          xPos = width - textWidth - 40;
          yPos = height - 35;
        }

        page.drawText(text, {
          x: xPos,
          y: yPos,
          size: 10,
          font,
          color: rgb(0.25, 0.25, 0.25)
        });
      });

      const numberedBytes = await pdfDoc.save();
      const blob = new Blob([numberedBytes as unknown as BlobPart], { type: 'application/pdf' });
      if (outputUrl) URL.revokeObjectURL(outputUrl);
      setOutputUrl(URL.createObjectURL(blob));
      setOutputSizeKb(Math.round(blob.size / 1024));
      setStatusMsg({ type: 'success', text: 'Official pagination added across all pages successfully!' });
    } catch (err: any) {
      console.error(err);
      setStatusMsg({ type: 'error', text: err?.message || 'Failed to add page numbers.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // 11. PDF Signer
  const processPdfSigner = async () => {
    const bytes = await getWorkingBytes();
    if (!bytes || !signatureDataUrl) {
      setStatusMsg({ type: 'error', text: 'Please draw or upload a signature first.' });
      return;
    }
    try {
      setIsProcessing(true);
      const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const total = pdfDoc.getPageCount();
      const targetPageNum = Math.min(Math.max(1, signPage), total) - 1;
      const page = pdfDoc.getPages()[targetPageNum];

      const sigImgBytes = await fetch(signatureDataUrl).then(res => res.arrayBuffer());
      const sigImage = await pdfDoc.embedPng(sigImgBytes);
      const sigDims = sigImage.scale(0.35);

      const { width, height } = page.getSize();
      let posX = width - sigDims.width - 40;
      let posY = 50;

      if (signPosition === 'bottom-center') {
        posX = (width - sigDims.width) / 2;
        posY = 50;
      } else if (signPosition === 'bottom-left') {
        posX = 40;
        posY = 50;
      } else if (signPosition === 'center') {
        posX = (width - sigDims.width) / 2;
        posY = (height - sigDims.height) / 2;
      }

      page.drawImage(sigImage, {
        x: posX,
        y: posY,
        width: sigDims.width,
        height: sigDims.height
      });

      const signedBytes = await pdfDoc.save();
      const blob = new Blob([signedBytes as unknown as BlobPart], { type: 'application/pdf' });
      if (outputUrl) URL.revokeObjectURL(outputUrl);
      setOutputUrl(URL.createObjectURL(blob));
      setOutputSizeKb(Math.round(blob.size / 1024));
      setStatusMsg({ type: 'success', text: `Signature stamped onto page ${signPage} successfully!` });
    } catch (err: any) {
      console.error(err);
      setStatusMsg({ type: 'error', text: err?.message || 'Failed to stamp signature onto PDF.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // 12. PDF Form Filler
  const processPdfFormFiller = async () => {
    const bytes = await getWorkingBytes();
    if (!bytes || !formText.trim()) {
      setStatusMsg({ type: 'error', text: 'Please enter text to stamp onto the form.' });
      return;
    }
    try {
      setIsProcessing(true);
      const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const targetIdx = Math.min(Math.max(1, formPage), pdfDoc.getPageCount()) - 1;
      const page = pdfDoc.getPages()[targetIdx];
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

      const safeFormText = sanitizeWinAnsi(formText) || ' ';
      page.drawText(safeFormText, {
        x: formPosX,
        y: formPosY,
        size: formFontSize,
        font,
        color: rgb(0, 0, 0)
      });

      const savedBytes = await pdfDoc.save();
      const blob = new Blob([savedBytes as unknown as BlobPart], { type: 'application/pdf' });
      if (outputUrl) URL.revokeObjectURL(outputUrl);
      setOutputUrl(URL.createObjectURL(blob));
      setOutputSizeKb(Math.round(blob.size / 1024));
      setStatusMsg({ type: 'success', text: `Form text stamped on page ${formPage}!` });
    } catch (err: any) {
      console.error(err);
      setStatusMsg({ type: 'error', text: err?.message || 'Failed to stamp form text.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // 13. PDF Metadata Editor
  const processPdfMetadataEditor = async () => {
    const bytes = await getWorkingBytes();
    if (!bytes) return;
    try {
      setIsProcessing(true);
      const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      pdfDoc.setTitle(metaTitle);
      pdfDoc.setAuthor(metaAuthor);
      pdfDoc.setSubject(metaSubject);
      pdfDoc.setKeywords(metaKeywords.split(',').map(k => k.trim()));

      const savedBytes = await pdfDoc.save();
      const blob = new Blob([savedBytes as unknown as BlobPart], { type: 'application/pdf' });
      if (outputUrl) URL.revokeObjectURL(outputUrl);
      setOutputUrl(URL.createObjectURL(blob));
      setOutputSizeKb(Math.round(blob.size / 1024));
      setStatusMsg({ type: 'success', text: 'Document metadata updated and saved!' });
    } catch (err: any) {
      console.error(err);
      setStatusMsg({ type: 'error', text: err?.message || 'Failed to update metadata.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // 14. PDF Cropper (Margin Trimmer)
  const processPdfCropper = async () => {
    const bytes = await getWorkingBytes();
    if (!bytes) return;
    try {
      setIsProcessing(true);
      const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const pages = pdfDoc.getPages();

      pages.forEach(p => {
        const { width, height } = p.getSize();
        const trimX = (width * cropMarginPercent) / 100;
        const trimY = (height * cropMarginPercent) / 100;
        p.setCropBox(trimX, trimY, width - 2 * trimX, height - 2 * trimY);
      });

      const savedBytes = await pdfDoc.save();
      const blob = new Blob([savedBytes as unknown as BlobPart], { type: 'application/pdf' });
      if (outputUrl) URL.revokeObjectURL(outputUrl);
      setOutputUrl(URL.createObjectURL(blob));
      setOutputSizeKb(Math.round(blob.size / 1024));
      setStatusMsg({ type: 'success', text: `Trimmed ${cropMarginPercent}% outer margin on all pages!` });
    } catch (err: any) {
      console.error(err);
      setStatusMsg({ type: 'error', text: err?.message || 'Failed to crop PDF margins.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // 15. PDF Page Size Changer & Print Layout Maker
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

      const margin = printMarginStyle === 'narrow' ? 20 : printMarginStyle === 'wide' ? 60 : 40;

      for (let i = 0; i < srcDoc.getPageCount(); i++) {
        const [embedded] = await newDoc.embedPdf(srcDoc, [i]);
        const scaleX = (targetWidth - margin * 2) / embedded.width;
        const scaleY = (targetHeight - margin * 2) / embedded.height;
        const scaleFactor = Math.min(scaleX, scaleY);
        const scaledWidth = embedded.width * scaleFactor;
        const scaledHeight = embedded.height * scaleFactor;
        const page = newDoc.addPage([targetWidth, targetHeight]);

        page.drawPage(embedded, {
          x: (targetWidth - scaledWidth) / 2,
          y: (targetHeight - scaledHeight) / 2,
          width: scaledWidth,
          height: scaledHeight
        });
      }

      const savedBytes = await newDoc.save();
      const blob = new Blob([savedBytes as unknown as BlobPart], { type: 'application/pdf' });
      if (outputUrl) URL.revokeObjectURL(outputUrl);
      setOutputUrl(URL.createObjectURL(blob));
      setOutputSizeKb(Math.round(blob.size / 1024));
      setStatusMsg({
        type: 'success',
        text: `Standardized ${srcDoc.getPageCount()} pages to ${targetPageSize.toUpperCase()} dimensions!`
      });
    } catch (err: any) {
      console.error(err);
      setStatusMsg({ type: 'error', text: err?.message || 'Failed to standardize PDF size.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // 16. PDF Unlocker
  const processPdfUnlocker = async () => {
    const bytes = await getWorkingBytes();
    if (!bytes) {
      setStatusMsg({ type: 'error', text: 'Please select a PDF file first.' });
      return;
    }
    if (!unlockPassword) {
      setStatusMsg({ type: 'error', text: 'Please enter the password to unlock this document.' });
      return;
    }

    try {
      setIsProcessing(true);
      const decryptedBytes = await decryptPDF(bytes, unlockPassword);

      const blob = new Blob([decryptedBytes as unknown as BlobPart], { type: 'application/pdf' });
      if (outputUrl) URL.revokeObjectURL(outputUrl);
      setOutputUrl(URL.createObjectURL(blob));
      setOutputSizeKb(Math.round(blob.size / 1024));

      setStatusMsg({
        type: 'success',
        text: `Document unlocked! Saved an unencrypted copy for easy archival.`
      });
    } catch (err: any) {
      console.error(err);
      setStatusMsg({
        type: 'error',
        text: err?.message?.includes('Incorrect password')
          ? 'Incorrect password. Please verify the document password and try again.'
          : (err?.message || 'Failed to unlock document. Please check the password.')
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // 17. PDF Password Protector
  const processPdfPasswordProtector = async () => {
    const bytes = await getWorkingBytes();
    if (!bytes) {
      setStatusMsg({ type: 'error', text: 'Please upload a PDF file first.' });
      return;
    }
    if (!protectPassword) {
      setStatusMsg({ type: 'error', text: 'Please enter a password to protect the PDF.' });
      return;
    }
    if (protectPassword !== confirmProtectPassword) {
      setStatusMsg({ type: 'error', text: 'Passwords do not match. Please re-enter.' });
      return;
    }

    try {
      setIsProcessing(true);
      // Pre-check if document is already protected
      try {
        const probeDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
        if (probeDoc.isEncrypted) {
          setStatusMsg({
            type: 'error',
            text: 'This PDF is already password-protected. Please use the PDF Unlocker tool first to remove the current password before encrypting.'
          });
          return;
        }
      } catch {
        // Continue to encrypt
      }

      const encryptedBytes = await encryptPDF(bytes, protectPassword, {
        allowPrinting: true,
        allowCopying: false,
        allowModifying: false
      });

      const blob = new Blob([encryptedBytes as unknown as BlobPart], { type: 'application/pdf' });
      if (outputUrl) URL.revokeObjectURL(outputUrl);
      setOutputUrl(URL.createObjectURL(blob));
      setOutputSizeKb(Math.round(blob.size / 1024));
      setStatusMsg({
        type: 'success',
        text: 'Document secured with AES-256 password protection! Password is now required to open the PDF.'
      });
    } catch (err: any) {
      console.error('PDF Password protection error:', err);
      const msg = typeof err === 'string' ? err : err?.message || '';
      if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('encrypt')) {
        setStatusMsg({
          type: 'error',
          text: 'This PDF is already password-protected. Please unlock it using the PDF Unlocker tool first before adding a new password.'
        });
      } else {
        setStatusMsg({ type: 'error', text: msg || 'Failed to process document protection. Please verify the document format.' });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Signature Drawing Pad Handlers
  const getSigCoords = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
    canvas: HTMLCanvasElement
  ) => {
    const rect = canvas.getBoundingClientRect();
    const touch = 'touches' in e ? (e.touches[0] || e.changedTouches[0]) : null;
    const clientX = touch ? touch.clientX : (e as React.MouseEvent<HTMLCanvasElement>).clientX;
    const clientY = touch ? touch.clientY : (e as React.MouseEvent<HTMLCanvasElement>).clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / Math.max(1, rect.width)),
      y: (clientY - rect.top) * (canvas.height / Math.max(1, rect.height))
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
    ctx.lineWidth = sigPenWidth;
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
    if (!canvas) return;
    setSignatureDataUrl(canvas.toDataURL('image/png'));
  };

  const clearSigPad = () => {
    const canvas = sigPadRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureDataUrl(null);
  };

  const handleDownload = () => {
    if (!outputUrl) return;
    const a = document.createElement('a');
    a.href = outputUrl;
    a.download = `${tool.slug}-document.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };



  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
      {/* Header Notice */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-slate-100 dark:border-slate-800">
        <div>
          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
            {tool.categoryName}
          </span>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
            {tool.name}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Engineered with 100% client-side PDF-lib & PDF.js WebAssembly. Your documents never touch external servers.
          </p>
        </div>

        {(file || mergeFiles.length > 0 || imgFiles.length > 0 || convertedPages.length > 0) && (
          <button
            type="button"
            onClick={resetAll}
            className="px-3.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
          >
            Reset Tool
          </button>
        )}
      </div>

      {/* TOOL INTERFACES */}

      {/* 1. PDF MERGER & MULTIPLE PDFS TO ONE */}
      {isMerger ? (
        <div className="space-y-6">
          <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-8 text-center bg-slate-50/50 dark:bg-slate-900/40">
            <input
              type="file"
              id="pdf-merge-input"
              multiple
              accept="application/pdf"
              onChange={handleMergeFilesUpload}
              className="hidden"
            />
            <label htmlFor="pdf-merge-input" className="cursor-pointer flex flex-col items-center">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3">
                <Layers className="w-7 h-7" />
              </div>
              <span className="text-base font-semibold text-slate-900 dark:text-white">
                Select PDF Files to Merge
              </span>
              <span className="text-xs text-slate-500 mt-1">
                Select multiple documents. Use arrows to change page order before merging.
              </span>
              <span className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm">
                Add PDF Files
              </span>
            </label>
          </div>

          {mergeFiles.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 px-1">
                <span>Selected Documents ({mergeFiles.length})</span>
                <span>Use arrows to reorder</span>
              </div>

              <div className="space-y-2">
                {mergeFiles.map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-mono font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="font-medium text-slate-900 dark:text-white truncate">
                        {item.file.name}
                      </span>
                      <span className="text-xs text-slate-400 shrink-0">
                        ({item.pages} pages · {item.sizeKb} KB)
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => moveMergeFile(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                        title="Move Up"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveMergeFile(idx, 'down')}
                        disabled={idx === mergeFiles.length - 1}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                        title="Move Down"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeMergeFile(item.id)}
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                        title="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={processPdfMerger}
                  disabled={isProcessing}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow flex items-center gap-2 cursor-pointer"
                >
                  {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                  Merge {mergeFiles.length} PDFs into Master Document
                </button>
              </div>
            </div>
          )}
        </div>
      ) : isImageToPdf ? (
        /* 2. IMAGE TO PDF & PNG TO PDF */
        <div className="space-y-6">
          <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-8 text-center bg-slate-50/50 dark:bg-slate-900/40">
            <input
              type="file"
              id="img-to-pdf-input"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageToPdfUpload}
              className="hidden"
            />
            <label htmlFor="img-to-pdf-input" className="cursor-pointer flex flex-col items-center">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3">
                <FileText className="w-7 h-7" />
              </div>
              <span className="text-base font-semibold text-slate-900 dark:text-white">
                Upload Scanned Images or Certificates
              </span>
              <span className="text-xs text-slate-500 mt-1">
                Converts JPG, PNG, and WEBP pictures into standardized ISO A4 PDF pages.
              </span>
              <span className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm">
                Add Images
              </span>
            </label>
          </div>

          {imgFiles.length > 0 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Page Orientation:</span>
                  <button
                    type="button"
                    onClick={() => setImgOrientation('portrait')}
                    className={`px-3 py-1.5 rounded-lg border font-medium cursor-pointer ${
                      imgOrientation === 'portrait' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-700'
                    }`}
                  >
                    Portrait (Vertical)
                  </button>
                  <button
                    type="button"
                    onClick={() => setImgOrientation('landscape')}
                    className={`px-3 py-1.5 rounded-lg border font-medium cursor-pointer ${
                      imgOrientation === 'landscape' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-700'
                    }`}
                  >
                    Landscape (Horizontal)
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Margins:</span>
                  <select
                    value={imgMargin}
                    onChange={e => setImgMargin(Number(e.target.value))}
                    className="px-2.5 py-1.5 border rounded-lg bg-white dark:bg-slate-800"
                  >
                    <option value={0}>No Margins (Edge-to-Edge)</option>
                    <option value={20}>Standard (15 mm / 20 pt)</option>
                    <option value={40}>Wide Border (30 pt)</option>
                  </select>
                </div>
              </div>

              {/* Uploaded Images Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {imgFiles.map((item, idx) => (
                  <div key={item.id} className="relative group border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden p-2 bg-slate-50 dark:bg-slate-800">
                    <img src={item.url} alt="Uploaded" className="w-full h-24 object-contain rounded" />
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 truncate block mt-1">Page {idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => {
                        URL.revokeObjectURL(item.url);
                        setImgFiles(prev => prev.filter(x => x.id !== item.id));
                      }}
                      className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={processImageToPdf}
                  disabled={isProcessing}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow flex items-center gap-2 cursor-pointer"
                >
                  {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  Generate Standard A4 PDF ({imgFiles.length} Pages)
                </button>
              </div>
            </div>
          )}
        </div>
      ) : !file ? (
        /* 3. SINGLE PDF UPLOAD WITH SAMPLE LOADER */
        <div className="space-y-6">
          <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-10 text-center bg-slate-50/50 dark:bg-slate-900/40">
            <input
              type="file"
              id="single-pdf-input"
              accept="application/pdf"
              onChange={handleSingleFileUpload}
              className="hidden"
            />
            <label htmlFor="single-pdf-input" className="cursor-pointer flex flex-col items-center">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4">
                <FileText className="w-8 h-8" />
              </div>
              <span className="text-base font-semibold text-slate-900 dark:text-white">
                Click to choose PDF or drag & drop
              </span>
              <span className="text-xs text-slate-500 mt-1 max-w-sm">
                Upload any PDF file. All rendering and cryptographic processing is performed locally inside your browser.
              </span>
              <span className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm">
                Select PDF Document
              </span>
            </label>
          </div>

          {/* Sample PDF Quick Loader for Instant Testing */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-slate-600 dark:text-slate-400 font-medium">
              Want to test right now without uploading your own document?
            </span>
            <button
              type="button"
              onClick={loadSampleDocument}
              className="px-3.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-500 rounded-lg text-slate-800 dark:text-slate-200 font-semibold cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              Load Sample 2-Page Document
            </button>
          </div>
        </div>
      ) : (
        /* 4. ACTIVE PDF PROCESSING STUDIO */
        <div className="space-y-6">
          {/* File Summary Header */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{file.name}</p>
                <p className="text-xs text-slate-500">
                  Size: <span className="font-semibold text-slate-700 dark:text-slate-300">{fileSizeKb} KB</span> · Total Pages: <span className="font-semibold text-slate-700 dark:text-slate-300">{pageCount}</span>
                </p>
              </div>
            </div>

            <label
              htmlFor="change-pdf-input"
              className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer hover:border-blue-500 transition-colors"
            >
              Choose Different PDF
              <input
                type="file"
                id="change-pdf-input"
                accept="application/pdf"
                onChange={handleSingleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* Visual Page Thumbnails Strip */}
          {pageThumbnails.length > 0 && !isPdfToImage && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Document Page Previews:</span>
                <span>{pageCount > pageThumbnails.length ? `Showing first ${pageThumbnails.length} of ${pageCount} pages` : `${pageCount} pages`}</span>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 pt-1">
                {pageThumbnails.map(thumb => {
                  const isExtractSelected = selectedPagesToExtract.includes(thumb.pageNum);
                  const isDeleteSelected = selectedPagesToDelete.includes(thumb.pageNum);

                  return (
                    <div
                      key={thumb.pageNum}
                      onClick={() => {
                        if (isSplitter) {
                          setSelectedPagesToExtract(prev =>
                            isExtractSelected ? prev.filter(x => x !== thumb.pageNum) : [...prev, thumb.pageNum]
                          );
                        } else if (isDeleter) {
                          setSelectedPagesToDelete(prev =>
                            isDeleteSelected ? prev.filter(x => x !== thumb.pageNum) : [...prev, thumb.pageNum]
                          );
                        }
                      }}
                      className={`relative shrink-0 w-24 rounded-lg border overflow-hidden p-1 bg-white dark:bg-slate-800 shadow-sm transition-all ${
                        isSplitter || isDeleter ? 'cursor-pointer hover:scale-105' : ''
                      } ${
                        isSplitter && isExtractSelected
                          ? 'ring-2 ring-blue-600 border-blue-600'
                          : isDeleter && isDeleteSelected
                          ? 'ring-2 ring-red-600 border-red-600 bg-red-50'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <img src={thumb.dataUrl} alt={`Page ${thumb.pageNum}`} className="w-full h-32 object-contain bg-white rounded" />
                      <div className="flex items-center justify-between mt-1 text-[10px] text-slate-600 dark:text-slate-300 font-semibold px-0.5">
                        <span>P. {thumb.pageNum}</span>
                        {isSplitter && isExtractSelected && <CheckCircle className="w-3 h-3 text-blue-600" />}
                        {isDeleter && isDeleteSelected && <Trash2 className="w-3 h-3 text-red-600" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* DEDICATED TOOL CONTROLS */}

          {/* A. PDF to JPG / PNG Converter */}
          {isPdfToImage ? (
            <div className="space-y-6">
              <div className="p-5 border border-slate-200 dark:border-slate-700 rounded-xl space-y-4 bg-white dark:bg-slate-800/40">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-blue-600" />
                      Convert Document Pages to {imgExtension.toUpperCase()} Pictures
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Renders every page into high-clarity {imgExtension.toUpperCase()} pictures with crisp white background fill.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-medium">Resolution:</span>
                    <select
                      value={imageDpi}
                      onChange={e => {
                        const newDpi = Number(e.target.value);
                        setImageDpi(newDpi);
                        if (fileBytes) {
                          convertBufferToImages(fileBytes, pageCount, newDpi);
                        }
                      }}
                      disabled={isProcessing}
                      className="px-2.5 py-1.5 text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                      <option value={150}>150 DPI (Fast / Screen)</option>
                      <option value={200}>200 DPI (Exam Standard - UPSC/SSC/IBPS)</option>
                      <option value={300}>300 DPI (Ultra High / Print)</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={processPdfToImages}
                    disabled={isProcessing}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow flex items-center gap-2 cursor-pointer"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        {convertingProgress
                          ? `Converting Page ${convertingProgress.current} of ${convertingProgress.total}...`
                          : 'Rendering Pages...'}
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        {convertedPages.length > 0 ? `Re-render All ${pageCount} Pages` : `Convert All ${pageCount} Pages to ${imgExtension.toUpperCase()}`}
                      </>
                    )}
                  </button>

                  {convertedPages.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={downloadAllAsZip}
                        disabled={isZipping || isProcessing}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow flex items-center gap-2 cursor-pointer"
                      >
                        {isZipping ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
                        Download All as ZIP (.zip)
                      </button>

                      <button
                        type="button"
                        onClick={downloadAllImages}
                        disabled={isProcessing}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow flex items-center gap-2 cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                        Download All as {imgExtension.toUpperCase()}s
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Gallery Grid */}
              {convertedPages.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      Converted Pages Preview ({convertedPages.length})
                    </span>
                    <span className="text-xs text-slate-500">
                      Click Download on any page to save individually
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {convertedPages.map(page => (
                      <div
                        key={page.pageNum}
                        className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3 flex flex-col justify-between"
                      >
                        <div>
                          <div className="relative aspect-[3/4] bg-white rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden flex items-center justify-center p-2 mb-2 shadow-inner">
                            <img
                              src={page.dataUrl}
                              alt={`Page ${page.pageNum}`}
                              className="max-h-full max-w-full object-contain shadow-sm"
                            />
                            <span className="absolute top-2 left-2 px-2 py-0.5 bg-slate-900/80 text-white text-[11px] font-bold rounded">
                              Page {page.pageNum}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-xs text-slate-500 mb-3 px-1">
                            <span>{page.width} × {page.height} px</span>
                            <span className="font-medium text-slate-700 dark:text-slate-300">~{page.sizeKb} KB</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => downloadSingleImage(page.dataUrl, page.pageNum)}
                          className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download Page {page.pageNum} ({imgExtension.toUpperCase()})
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : isSplitter ? (
            /* B. PDF Splitter & Page Extractor */
            <div className="p-5 border border-slate-200 dark:border-slate-700 rounded-xl space-y-4">
              <label className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Specify Page Numbers or Click Previews Above to Extract
              </label>
              <input
                type="text"
                value={splitRange}
                onChange={e => setSplitRange(e.target.value)}
                placeholder="e.g. 1-2, 4 or 1"
                className="w-full max-w-md px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
              <p className="text-xs text-slate-500">
                Total available pages in this document: 1 to {pageCount}. Use comma for individual pages and hyphen for ranges.
              </p>
              <button
                type="button"
                onClick={processPdfSplitter}
                disabled={isProcessing}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <Scissors className="w-4 h-4" />
                Extract Specified Pages into New PDF
              </button>
            </div>
          ) : isDeleter ? (
            /* C. PDF Page Deleter */
            <div className="p-5 border border-slate-200 dark:border-slate-700 rounded-xl space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-1">
                  Select Pages to Remove
                </label>
                <p className="text-xs text-slate-500">
                  Click the cards below for any blank pages or unnecessary covers to eliminate.
                </p>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-56 overflow-y-auto p-1">
                {Array.from({ length: pageCount }, (_, i) => i + 1).map(p => {
                  const isChecked = selectedPagesToDelete.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setSelectedPagesToDelete(prev =>
                          isChecked ? prev.filter(x => x !== p) : [...prev, p]
                        );
                      }}
                      className={`p-3 rounded-lg border text-xs font-bold flex flex-col items-center gap-1.5 transition-colors cursor-pointer ${
                        isChecked
                          ? 'bg-red-50 dark:bg-red-950/50 border-red-400 text-red-600 dark:text-red-400'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-400'
                      }`}
                    >
                      {isChecked ? <Trash2 className="w-4 h-4 text-red-600" /> : <FileText className="w-4 h-4 text-slate-400" />}
                      <span>Page {p}</span>
                      <span className="text-[10px] font-normal">{isChecked ? 'Delete' : 'Keep'}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={processPdfPageDeleter}
                  disabled={isProcessing || selectedPagesToDelete.length === 0}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete {selectedPagesToDelete.length} Selected Page(s) & Save
                </button>
                {selectedPagesToDelete.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedPagesToDelete([])}
                    className="text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
                  >
                    Clear selection
                  </button>
                )}
              </div>
            </div>
          ) : isReorder ? (
            /* D. PDF Page Reorder */
            <div className="p-5 border border-slate-200 dark:border-slate-700 rounded-xl space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-1">
                  Rearrange Document Sequence
                </label>
                <p className="text-xs text-slate-500">
                  Use Up/Down controls to place pages in your exact preferred sequence.
                </p>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto">
                {pageOrder.map((origPageNum, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        Original Document Page #{origPageNum}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => movePageInOrder(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1.5 rounded text-slate-500 hover:text-slate-800 disabled:opacity-30 cursor-pointer"
                        title="Move Up"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => movePageInOrder(idx, 'down')}
                        disabled={idx === pageOrder.length - 1}
                        className="p-1.5 rounded text-slate-500 hover:text-slate-800 disabled:opacity-30 cursor-pointer"
                        title="Move Down"
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
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Apply Custom Page Order & Save
              </button>
            </div>
          ) : isRotator ? (
            /* E. PDF Page Rotator */
            <div className="p-5 border border-slate-200 dark:border-slate-700 rounded-xl space-y-4">
              <label className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Select Rotation Angle & Target
              </label>

              <div className="flex flex-wrap gap-2">
                {[90, 180, 270].map(deg => (
                  <button
                    key={deg}
                    type="button"
                    onClick={() => setRotationAngle(deg)}
                    className={`px-4 py-2 rounded-lg text-xs font-medium border cursor-pointer ${
                      rotationAngle === deg
                        ? 'bg-blue-600 text-white border-blue-600 font-bold'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    Rotate {deg}°
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-600 dark:text-slate-400">Target:</span>
                <select
                  value={rotateTargetPage}
                  onChange={e => setRotateTargetPage(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                  className="px-3 py-1.5 border rounded-lg bg-white dark:bg-slate-800"
                >
                  <option value="all">Rotate All Pages</option>
                  {Array.from({ length: pageCount }, (_, i) => i + 1).map(p => (
                    <option key={p} value={p}>Only Page {p}</option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={processPdfPageRotator}
                disabled={isProcessing}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Apply Rotation
              </button>
            </div>
          ) : isWatermark ? (
            /* F. Watermark Maker */
            <div className="p-5 border border-slate-200 dark:border-slate-700 rounded-xl space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-1.5">
                  Watermark Text
                </label>
                <input
                  type="text"
                  value={watermarkText}
                  onChange={e => setWatermarkText(e.target.value)}
                  className="w-full max-w-md px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex flex-wrap gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-600 dark:text-slate-400">Color:</span>
                  {(['grey', 'red', 'blue'] as const).map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setWatermarkColor(c)}
                      className={`px-2.5 py-1 rounded border capitalize cursor-pointer ${
                        watermarkColor === c ? 'bg-blue-600 text-white font-bold' : 'bg-white dark:bg-slate-800'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-600 dark:text-slate-400">Opacity: {Math.round(watermarkOpacity * 100)}%</span>
                  <input
                    type="range"
                    min="0.05"
                    max="0.8"
                    step="0.05"
                    value={watermarkOpacity}
                    onChange={e => setWatermarkOpacity(Number(e.target.value))}
                    className="w-32 accent-blue-600"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={processPdfWatermark}
                disabled={isProcessing}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <Stamp className="w-4 h-4" />
                Apply Watermark to All Pages
              </button>
            </div>
          ) : isNumbering ? (
            /* G. Page Numbering */
            <div className="p-5 border border-slate-200 dark:border-slate-700 rounded-xl space-y-4">
              <label className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Pagination Format & Placement
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setNumberingFormat('page-x-of-y')}
                  className={`p-2.5 rounded-lg border text-center font-medium cursor-pointer ${
                    numberingFormat === 'page-x-of-y' ? 'bg-blue-600 text-white border-blue-600 font-bold' : 'bg-white dark:bg-slate-800'
                  }`}
                >
                  Page 1 of {pageCount}
                </button>
                <button
                  type="button"
                  onClick={() => setNumberingFormat('page-x')}
                  className={`p-2.5 rounded-lg border text-center font-medium cursor-pointer ${
                    numberingFormat === 'page-x' ? 'bg-blue-600 text-white border-blue-600 font-bold' : 'bg-white dark:bg-slate-800'
                  }`}
                >
                  Page 1
                </button>
                <button
                  type="button"
                  onClick={() => setNumberingFormat('bates')}
                  className={`p-2.5 rounded-lg border text-center font-medium cursor-pointer ${
                    numberingFormat === 'bates' ? 'bg-blue-600 text-white border-blue-600 font-bold' : 'bg-white dark:bg-slate-800'
                  }`}
                >
                  DOC-00001 (Bates)
                </button>
              </div>

              <div className="flex flex-wrap gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-600 dark:text-slate-400">Position:</span>
                  <select
                    value={numberingPos}
                    onChange={e => setNumberingPos(e.target.value as any)}
                    className="px-3 py-1.5 border rounded-lg bg-white dark:bg-slate-800"
                  >
                    <option value="bottom-center">Bottom Center</option>
                    <option value="bottom-right">Bottom Right Corner</option>
                    <option value="top-right">Top Right Header</option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={processPdfPageNumbering}
                disabled={isProcessing}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <Hash className="w-4 h-4" />
                Add Official Pagination
              </button>
            </div>
          ) : isSigner ? (
            /* H. PDF Signer */
            <div className="p-5 border border-slate-200 dark:border-slate-700 rounded-xl space-y-4">
              <label className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Draw or Upload Signature to Stamp
              </label>

              {/* Signature Drawing Canvas */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800 border rounded-xl space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 dark:text-slate-400">Ink:</span>
                    <button
                      type="button"
                      onClick={() => setSigInkColor('#000000')}
                      className={`w-5 h-5 rounded-full bg-black border ${sigInkColor === '#000000' ? 'ring-2 ring-blue-500' : ''}`}
                    />
                    <button
                      type="button"
                      onClick={() => setSigInkColor('#1e40af')}
                      className={`w-5 h-5 rounded-full bg-blue-700 border ${sigInkColor === '#1e40af' ? 'ring-2 ring-blue-500' : ''}`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={clearSigPad}
                    className="text-red-600 hover:underline cursor-pointer"
                  >
                    Clear Signature
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
                  className="w-full max-w-sm bg-white border rounded-lg cursor-crosshair touch-none shadow-inner"
                />
              </div>

              {/* Placement controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-slate-500 block mb-1">Target Page (1 to {pageCount}):</span>
                  <input
                    type="number"
                    min="1"
                    max={pageCount}
                    value={signPage}
                    onChange={e => setSignPage(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <span className="text-xs text-slate-500 block mb-1">Placement:</span>
                  <select
                    value={signPosition}
                    onChange={e => setSignPosition(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="bottom-right">Bottom Right Corner</option>
                    <option value="bottom-center">Bottom Center</option>
                    <option value="bottom-left">Bottom Left Corner</option>
                    <option value="center">Center of Page</option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={processPdfSigner}
                disabled={isProcessing || !signatureDataUrl}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <PenTool className="w-4 h-4" />
                Stamp Signature on Document
              </button>
            </div>
          ) : isFormFiller ? (
            /* I. PDF Form Filler */
            <div className="p-5 border border-slate-200 dark:border-slate-700 rounded-xl space-y-4">
              <label className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Type Text Overlay on Scanned Application Form
              </label>

              <div>
                <span className="text-xs text-slate-500 block mb-1">Text to Type:</span>
                <input
                  type="text"
                  value={formText}
                  onChange={e => setFormText(e.target.value)}
                  placeholder="e.g. Ramesh Kumar, 12/05/1998, or Application #48291"
                  className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-xs text-slate-500 block mb-1">Page (1-{pageCount}):</span>
                  <input
                    type="number"
                    min="1"
                    max={pageCount}
                    value={formPage}
                    onChange={e => setFormPage(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 text-xs border rounded-lg bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <span className="text-xs text-slate-500 block mb-1">X Offset (pts):</span>
                  <input
                    type="number"
                    value={formPosX}
                    onChange={e => setFormPosX(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 text-xs border rounded-lg bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <span className="text-xs text-slate-500 block mb-1">Y Offset (pts):</span>
                  <input
                    type="number"
                    value={formPosY}
                    onChange={e => setFormPosY(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 text-xs border rounded-lg bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <span className="text-xs text-slate-500 block mb-1">Font Size:</span>
                  <input
                    type="number"
                    value={formFontSize}
                    onChange={e => setFormFontSize(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 text-xs border rounded-lg bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={processPdfFormFiller}
                disabled={isProcessing}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <Edit className="w-4 h-4" />
                Stamp Text on Form
              </button>
            </div>
          ) : isMetadataViewer || isMetadataEditor ? (
            /* J. PDF Metadata Viewer & Editor */
            <div className="p-5 border border-slate-200 dark:border-slate-700 rounded-xl space-y-4">
              <label className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                {isMetadataEditor ? 'Edit Document Metadata Properties' : 'Inspect Hidden PDF Metadata'}
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block mb-1">Document Title:</span>
                  {isMetadataEditor ? (
                    <input
                      type="text"
                      value={metaTitle}
                      onChange={e => setMetaTitle(e.target.value)}
                      placeholder="e.g. UPSC CSE Application Dossier"
                      className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800"
                    />
                  ) : (
                    <p className="font-semibold p-2 bg-slate-50 dark:bg-slate-800 rounded border">
                      {metaTitle || '(Not set)'}
                    </p>
                  )}
                </div>

                <div>
                  <span className="text-slate-500 block mb-1">Author / Applicant:</span>
                  {isMetadataEditor ? (
                    <input
                      type="text"
                      value={metaAuthor}
                      onChange={e => setMetaAuthor(e.target.value)}
                      placeholder="e.g. Ramesh Kumar"
                      className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800"
                    />
                  ) : (
                    <p className="font-semibold p-2 bg-slate-50 dark:bg-slate-800 rounded border">
                      {metaAuthor || '(Not set)'}
                    </p>
                  )}
                </div>

                <div>
                  <span className="text-slate-500 block mb-1">Subject / Description:</span>
                  {isMetadataEditor ? (
                    <input
                      type="text"
                      value={metaSubject}
                      onChange={e => setMetaSubject(e.target.value)}
                      placeholder="e.g. Educational Verification"
                      className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800"
                    />
                  ) : (
                    <p className="font-semibold p-2 bg-slate-50 dark:bg-slate-800 rounded border">
                      {metaSubject || '(Not set)'}
                    </p>
                  )}
                </div>

                <div>
                  <span className="text-slate-500 block mb-1">Software Producer:</span>
                  <p className="font-semibold p-2 bg-slate-50 dark:bg-slate-800 rounded border text-slate-500">
                    {metaProducer || 'Standard PDF Engine'}
                  </p>
                </div>
              </div>

              {isMetadataEditor && (
                <button
                  type="button"
                  onClick={processPdfMetadataEditor}
                  disabled={isProcessing}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-sm mt-2"
                >
                  <Edit className="w-4 h-4" />
                  Save Updated Metadata
                </button>
              )}
            </div>
          ) : isCropper ? (
            /* K. PDF Cropper */
            <div className="p-5 border border-slate-200 dark:border-slate-700 rounded-xl space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-1">
                  Margin Trim: {cropMarginPercent}% on all edges
                </label>
                <p className="text-xs text-slate-500">
                  Trims excessive white margins from scanner feeds to optimize page density.
                </p>
              </div>

              <div className="flex gap-2">
                {[5, 10, 15, 20].map(pct => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setCropMarginPercent(pct)}
                    className={`px-4 py-2 rounded-lg text-xs font-medium border cursor-pointer ${
                      cropMarginPercent === pct ? 'bg-blue-600 text-white border-blue-600 font-bold' : 'bg-white dark:bg-slate-800'
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
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <Scissors className="w-4 h-4" />
                Apply Margin Trim & Save
              </button>
            </div>
          ) : isPageSizeChanger ? (
            /* L. Page Size Changer & Print Layout */
            <div className="p-5 border border-slate-200 dark:border-slate-700 rounded-xl space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-1">
                  Standardize Dimensions & Print Layout
                </label>
                <p className="text-xs text-slate-500">
                  Rescales mixed scanner pages to uniform ISO paper sizes with printer-safe margins.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setTargetPageSize('a4')}
                  className={`px-4 py-2.5 rounded-lg text-xs font-medium border cursor-pointer ${
                    targetPageSize === 'a4' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-800'
                  }`}
                >
                  <span className="font-bold block">ISO A4 (Standard)</span>
                  <span className="text-[10px] opacity-80">210 × 297 mm · Indian Exam Standard</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTargetPageSize('letter')}
                  className={`px-4 py-2.5 rounded-lg text-xs font-medium border cursor-pointer ${
                    targetPageSize === 'letter' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-800'
                  }`}
                >
                  <span className="font-bold block">US Letter</span>
                  <span className="text-[10px] opacity-80">8.5 × 11 in</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTargetPageSize('legal')}
                  className={`px-4 py-2.5 rounded-lg text-xs font-medium border cursor-pointer ${
                    targetPageSize === 'legal' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-800'
                  }`}
                >
                  <span className="font-bold block">US Legal</span>
                  <span className="text-[10px] opacity-80">8.5 × 14 in</span>
                </button>
              </div>

              <button
                type="button"
                onClick={processPdfPageSizeChanger}
                disabled={isProcessing}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <Maximize className="w-4 h-4" />
                Standardize Dimensions to {targetPageSize.toUpperCase()}
              </button>
            </div>
          ) : isUnlocker ? (
            /* M. PDF Unlocker */
            <div className="p-5 border border-slate-200 dark:border-slate-700 rounded-xl space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-1">
                  Enter Document Password
                </label>
                <p className="text-xs text-slate-500">
                  Provide authorized password for e-Aadhaar or bank statements to open and decrypt.
                </p>
              </div>
              <input
                type="password"
                value={unlockPassword}
                onChange={e => setUnlockPassword(e.target.value)}
                placeholder="Enter valid password..."
                className="w-full max-w-md px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
              <button
                type="button"
                onClick={processPdfUnlocker}
                disabled={isProcessing || !unlockPassword}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <Unlock className="w-4 h-4" />
                Verify Password & Decrypt
              </button>
            </div>
          ) : isProtector ? (
            /* N. PDF Password Protector */
            <div className="p-5 border border-slate-200 dark:border-slate-700 rounded-xl space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-1">
                  Set Document Security Password
                </label>
                <p className="text-xs text-slate-500">
                  Encrypt confidential marks cards and salary slips for authorized access.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
                <input
                  type="password"
                  value={protectPassword}
                  onChange={e => setProtectPassword(e.target.value)}
                  placeholder="Create encryption password..."
                  className="w-full px-3 py-2 text-xs border rounded-lg bg-white dark:bg-slate-800"
                />
                <input
                  type="password"
                  value={confirmProtectPassword}
                  onChange={e => setConfirmProtectPassword(e.target.value)}
                  placeholder="Confirm password..."
                  className="w-full px-3 py-2 text-xs border rounded-lg bg-white dark:bg-slate-800"
                />
              </div>

              <button
                type="button"
                onClick={processPdfPasswordProtector}
                disabled={isProcessing || !protectPassword}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <Lock className="w-4 h-4" />
                Encrypt & Lock PDF
              </button>
            </div>
          ) : isCompressor ? (
            /* O. PDF Compressor */
            <div className="p-5 border border-slate-200 dark:border-slate-700 rounded-xl space-y-4">
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-1">
                  Client-Side PDF Size Optimization
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Compress internal cross-reference streams and eliminate redundant binary objects for portal submission.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={processPdfCompressor}
                  disabled={isProcessing}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Compress PDF Now
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-slate-500">
              <p className="text-xs">Document loaded and verified. Select your preferred action above to process.</p>
            </div>
          )}
        </div>
      )}

      {/* Status Messages */}
      {statusMsg && (
        <div
          className={`mt-6 p-4 rounded-xl border flex items-center gap-3 text-xs ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : statusMsg.type === 'info'
              ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200'
              : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : statusMsg.type === 'info' ? (
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Download Action Banner (for PDF output tools) */}
      {outputUrl && !isPdfToImage && (
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-950 dark:text-blue-100">
              Processed Document Ready
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Final Size: {outputSizeKb} KB · PDF Document
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownload}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </button>
        </div>
      )}
    </div>
  );
};
