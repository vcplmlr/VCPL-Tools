import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Cpu,
  Database,
  Download,
  FileArchive,
  FileCheck2,
  FolderArchive,
  Gauge,
  HardDrive,
  Info,
  Layers,
  Minimize2,
  Play,
  RefreshCw,
  Scissors,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { ToolCatalogItem } from '../../types/tools';
import {
  CompactionOptions,
  CompressJobResult,
  CompressionMethod,
  CompressProgress,
  DecompressResult,
  PreScanReport,
  SplitPolicy,
  analyzeFilesCompressibility,
  compressDatabaseFiles,
  formatBytes,
  rejoinAndDecompressFiles,
  sortPartFilesNaturally,
  supportsNativeGzipStream,
  triggerBlobDownload,
} from '../../utils/dbCompressorEngine';
import { FileDropZone } from './FileDropZone';

interface DatabaseFileCompressorViewProps {
  tool: ToolCatalogItem;
  onBack?: () => void;
}

type ActiveTab = 'compress' | 'decompress';

const TARGET_PRESETS_MB = [5, 10, 25, 50, 100];

export const DatabaseFileCompressorView: React.FC<DatabaseFileCompressorViewProps> = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('compress');

  // Compress tab state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [method, setMethod] = useState<CompressionMethod>('gzip-max');
  const [targetSizeMb, setTargetSizeMb] = useState<number>(10);
  const [splitPolicy, setSplitPolicy] = useState<SplitPolicy>('auto-target');
  const [compaction, setCompaction] = useState<CompactionOptions>({
    stripSqlComments: true,
    trimBlankAndTrailing: true,
  });

  const [preScan, setPreScan] = useState<PreScanReport | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const [isCompressing, setIsCompressing] = useState(false);
  const [progress, setProgress] = useState<CompressProgress | null>(null);
  const [compressResult, setCompressResult] = useState<CompressJobResult | null>(null);
  const [compressError, setCompressError] = useState<string | null>(null);

  // Decompress / Rejoin tab state
  const [extractInputFiles, setExtractInputFiles] = useState<File[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState<{ percent: number; label: string } | null>(
    null
  );
  const [extractResult, setExtractResult] = useState<DecompressResult | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const nativeSupported = useMemo(() => supportsNativeGzipStream(), []);

  const totalInputBytes = useMemo(
    () => selectedFiles.reduce((sum, f) => sum + f.size, 0),
    [selectedFiles]
  );

  // Multiple files require ZIP container
  const effectiveMethod: CompressionMethod =
    selectedFiles.length > 1 ? 'zip-max' : method;

  // Run fast 3-point entropy pre-scan whenever files, target MB, or compaction options change
  useEffect(() => {
    let cancelled = false;
    if (selectedFiles.length === 0) {
      setPreScan(null);
      return;
    }

    setIsScanning(true);
    analyzeFilesCompressibility(selectedFiles, targetSizeMb, compaction)
      .then((report) => {
        if (!cancelled) {
          setPreScan(report);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreScan(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsScanning(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedFiles, targetSizeMb, compaction]);

  const handleAddFiles = useCallback((files: File[]) => {
    setCompressError(null);
    setCompressResult(null);
    setSelectedFiles((prev) => {
      const existingKeys = new Set(prev.map((f) => `${f.name}-${f.size}-${f.lastModified}`));
      const unique = files.filter((f) => !existingKeys.has(`${f.name}-${f.size}-${f.lastModified}`));
      return [...prev, ...unique];
    });
  }, []);

  const handleRemoveFile = useCallback((index: number) => {
    setSelectedFiles((prev) => prev.filter((_, idx) => idx !== index));
    setCompressResult(null);
  }, []);

  const handleClearFiles = useCallback(() => {
    setSelectedFiles([]);
    setCompressResult(null);
    setCompressError(null);
    setPreScan(null);
  }, []);

  const handleStartCompression = useCallback(async () => {
    if (selectedFiles.length === 0 || isCompressing) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsCompressing(true);
    setCompressError(null);
    setCompressResult(null);
    setProgress({
      phase: 'reading',
      fileIndex: 0,
      fileCount: selectedFiles.length,
      currentFileName: selectedFiles[0].name,
      bytesRead: 0,
      totalBytes: totalInputBytes,
      bytesOut: 0,
      preCompactedSavedBytes: 0,
      percent: 0,
      speedMBps: 0,
      elapsedMs: 0,
    });

    try {
      const result = await compressDatabaseFiles({
        files: selectedFiles,
        method: effectiveMethod,
        compaction,
        targetSizeMb,
        splitPolicy,
        signal: controller.signal,
        onProgress: (p) => setProgress(p),
      });
      setCompressResult(result);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setCompressError('Compression cancelled. Your original files were not modified.');
      } else {
        setCompressError(
          err instanceof Error ? err.message : 'Compression failed unexpectedly.'
        );
      }
    } finally {
      abortControllerRef.current = null;
      setIsCompressing(false);
    }
  }, [
    selectedFiles,
    isCompressing,
    totalInputBytes,
    effectiveMethod,
    compaction,
    targetSizeMb,
    splitPolicy,
  ]);

  const handleCancelOperation = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const handleDownloadAllParts = useCallback(() => {
    if (!compressResult) return;
    compressResult.parts.forEach((part, idx) => {
      setTimeout(() => {
        triggerBlobDownload(part.blob, part.name);
      }, idx * 250);
    });
  }, [compressResult]);

  const handleVerifyInExtractTab = useCallback(() => {
    if (!compressResult) return;
    const filesForVerify = compressResult.parts.map(
      (part) => new File([part.blob], part.name, { type: part.blob.type })
    );
    setExtractInputFiles(filesForVerify);
    setExtractResult(null);
    setExtractError(null);
    setActiveTab('decompress');
  }, [compressResult]);

  // Decompress handlers
  const handleAddExtractFiles = useCallback((files: File[]) => {
    setExtractError(null);
    setExtractResult(null);
    setExtractInputFiles((prev) => {
      const existing = new Set(prev.map((f) => `${f.name}-${f.size}`));
      const fresh = files.filter((f) => !existing.has(`${f.name}-${f.size}`));
      return sortPartFilesNaturally([...prev, ...fresh]);
    });
  }, []);

  const handleStartExtraction = useCallback(async () => {
    if (extractInputFiles.length === 0 || isExtracting) return;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsExtracting(true);
    setExtractError(null);
    setExtractResult(null);
    setExtractProgress({ percent: 0, label: 'Initializing stream...' });

    try {
      const res = await rejoinAndDecompressFiles(
        extractInputFiles,
        (percent, label) => setExtractProgress({ percent, label }),
        controller.signal
      );
      setExtractResult(res);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setExtractError('Extraction cancelled.');
      } else {
        setExtractError(
          err instanceof Error
            ? err.message
            : 'Unable to extract archive. Make sure all .part files are present and uncorrupted.'
        );
      }
    } finally {
      abortControllerRef.current = null;
      setIsExtracting(false);
    }
  }, [extractInputFiles, isExtracting]);

  const handleCopyText = useCallback((key: string, value: string) => {
    navigator.clipboard?.writeText(value).then(() => {
      setCopiedCmd(key);
      setTimeout(() => setCopiedCmd(null), 1800);
    });
  }, []);

  const sortedExtractFiles = useMemo(
    () => sortPartFilesNaturally(extractInputFiles),
    [extractInputFiles]
  );

  return (
    <div className="space-y-6">
      {/* Top Architecture Banner */}
      <div className="rounded-2xl bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] p-5 sm:p-6 shadow-[0_4px_0_#2F3E4E]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#CEE5DC] border border-[#2F3E4E] text-[#2F3E4E] font-display font-extrabold text-[11px] uppercase tracking-wider">
              <Database className="w-3.5 h-3.5" />
              Streaming 2 MB Chunk Engine · Zero Server Upload
            </div>
            <h2 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E]">
              Database & Large-File Ultra Compressor
            </h2>
            <p className="text-xs sm:text-sm text-[#475569] max-w-3xl leading-relaxed">
              Compress massive <strong>.sql, .dump, .bak, .sqlite, .db, .csv, .json, .xml</strong>{' '}
              backups locally using Level-9 DEFLATE streaming, lossless SQL/text pre-compaction,
              and optional target-size volume splitting (e.g., <strong>500 MB &rarr; 10 MB</strong>).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('compress')}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] font-display font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                activeTab === 'compress'
                  ? 'bg-[#F9C80E] text-[#2F3E4E] shadow-[0_3px_0_#2F3E4E]'
                  : 'bg-white text-[#475569] hover:bg-[#FEF2C8]/60'
              }`}
            >
              <Minimize2 className="w-4 h-4" />
              Compress File
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('decompress')}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] font-display font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                activeTab === 'decompress'
                  ? 'bg-[#F9C80E] text-[#2F3E4E] shadow-[0_3px_0_#2F3E4E]'
                  : 'bg-white text-[#475569] hover:bg-[#FEF2C8]/60'
              }`}
            >
              <FolderArchive className="w-4 h-4" />
              Decompress / Rejoin
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'compress' ? (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: Dropzone, Selected Files & Entropy Advisor */}
          <div className="xl:col-span-7 space-y-5">
            <div className="rounded-2xl bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] p-5 shadow-[0_4px_0_#2F3E4E] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display font-extrabold text-sm uppercase tracking-wider text-[#2F3E4E] flex items-center gap-2">
                  <Upload className="w-4 h-4 text-[#B45309]" />
                  1. Select Database or Large Data File(s)
                </h3>
              </div>

              <FileDropZone
                multiple
                disabled={isCompressing}
                onFiles={handleAddFiles}
                className="rounded-2xl border-2 border-dashed border-[#2F3E4E]/40 bg-white hover:border-[#2F3E4E] transition-colors p-6 text-center"
              >
                {({ isDragActive }) => (
                  <label className="block cursor-pointer space-y-3">
                    <input
                      type="file"
                      multiple
                      disabled={isCompressing}
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          handleAddFiles(Array.from(e.target.files));
                          e.target.value = '';
                        }
                      }}
                    />
                    <div className="w-12 h-12 mx-auto rounded-2xl bg-[#FEF2C8] border-[1.5px] border-[#2F3E4E] flex items-center justify-center">
                      <Upload className="w-5 h-5 text-[#2F3E4E]" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-display font-extrabold text-sm text-[#2F3E4E]">
                        {isDragActive
                          ? 'Release to Queue Database File(s)'
                          : 'Drop 500 MB+ Database Dump or Archive Here'}
                      </p>
                      <p className="text-xs text-[#64748B]">
                        Supports .sql, .dump, .bak, .sqlite, .db, .mdf, .csv, .json, .xml, .tar, or any binary file
                      </p>
                    </div>
                    <div>
                      <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] shadow-[0_2px_0_#2F3E4E] font-display font-bold text-xs text-[#2F3E4E]">
                        Select Database File(s)
                      </span>
                    </div>
                    <p className="text-[11px] font-mono text-[#64748B]">
                      Processed 100% locally in 2 MB chunks — zero network uploads, works offline
                    </p>
                  </label>
                )}
              </FileDropZone>

              {selectedFiles.length > 0 && (
                <div className="space-y-2.5 pt-2">
                  <div className="flex items-center justify-between text-xs font-display font-bold text-[#2F3E4E]">
                    <span>
                      Queued Input ({selectedFiles.length}{' '}
                      {selectedFiles.length === 1 ? 'file' : 'files'} ·{' '}
                      <span className="font-mono text-[#B45309]">
                        {formatBytes(totalInputBytes)}
                      </span>
                      )
                    </span>
                    <button
                      type="button"
                      onClick={handleClearFiles}
                      disabled={isCompressing}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#B91C1C] hover:underline cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Clear All
                    </button>
                  </div>

                  <div className="divide-y divide-[#2F3E4E]/15 rounded-xl border border-[#2F3E4E]/30 bg-white overflow-hidden max-h-60 overflow-y-auto">
                    {selectedFiles.map((file, idx) => (
                      <div
                        key={`${file.name}-${file.size}-${idx}`}
                        className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <HardDrive className="w-4 h-4 text-[#475569] shrink-0" />
                          <span className="font-mono font-semibold text-[#2F3E4E] truncate">
                            {file.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-[#FEF2C8] border border-[#2F3E4E]/20 text-[#2F3E4E] tabular-nums">
                            {formatBytes(file.size)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(idx)}
                            disabled={isCompressing}
                            aria-label={`Remove ${file.name}`}
                            className="text-[#64748B] hover:text-[#B91C1C] cursor-pointer disabled:opacity-40"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Instant Entropy & 500MB -> 10MB Compressibility Pre-Scan */}
            {selectedFiles.length > 0 && (
              <div className="rounded-2xl bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] p-5 shadow-[0_4px_0_#2F3E4E] space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display font-extrabold text-sm uppercase tracking-wider text-[#2F3E4E] flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-[#047857]" />
                    Instant Compressibility Pre-Scan
                  </h3>
                  {isScanning ? (
                    <span className="text-[11px] font-mono text-[#64748B] flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Sampling file...
                    </span>
                  ) : (
                    preScan && (
                      <span
                        className={`px-2.5 py-0.5 rounded-lg border border-[#2F3E4E] text-[11px] font-display font-extrabold ${
                          preScan.compressibilityLabel === 'Ultra-High' ||
                          preScan.compressibilityLabel === 'High'
                            ? 'bg-[#CEE5DC] text-[#2F3E4E]'
                            : preScan.compressibilityLabel === 'Moderate'
                            ? 'bg-[#FEF2C8] text-[#92400E]'
                            : 'bg-[#FFE4E6] text-[#9F1239]'
                        }`}
                      >
                        {preScan.compressibilityLabel}
                      </span>
                    )
                  )}
                </div>

                {preScan && (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 rounded-xl bg-white border border-[#2F3E4E]/25">
                        <div className="text-[10px] font-display font-bold uppercase text-[#64748B]">
                          Detected Format
                        </div>
                        <div className="text-xs font-display font-extrabold text-[#2F3E4E] mt-1 leading-snug">
                          {preScan.detectedFormatLabel}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-white border border-[#2F3E4E]/25">
                        <div className="text-[10px] font-display font-bold uppercase text-[#64748B]">
                          Input Size
                        </div>
                        <div className="font-mono text-sm font-extrabold text-[#2F3E4E] mt-1 tabular-nums">
                          {formatBytes(preScan.totalBytes)}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-white border border-[#2F3E4E]/25">
                        <div className="text-[10px] font-display font-bold uppercase text-[#64748B]">
                          Est. Compressed
                        </div>
                        <div className="font-mono text-sm font-extrabold text-[#047857] mt-1 tabular-nums">
                          ~{formatBytes(preScan.projectedCompactedBytes)}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-white border border-[#2F3E4E]/25">
                        <div className="text-[10px] font-display font-bold uppercase text-[#64748B]">
                          Est. Reduction
                        </div>
                        <div className="font-mono text-sm font-extrabold text-[#B45309] mt-1 tabular-nums">
                          {Math.max(0, 100 - preScan.estimatedCompactedRatio * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>

                    <div
                      className={`p-3.5 rounded-xl border-[1.5px] flex items-start gap-3 text-xs leading-relaxed ${
                        preScan.canLikelyHitTargetSingleFile
                          ? 'bg-[#CEE5DC]/55 border-[#047857] text-[#1E293B]'
                          : 'bg-[#FEF2C8]/80 border-[#B45309] text-[#1E293B]'
                      }`}
                    >
                      {preScan.canLikelyHitTargetSingleFile ? (
                        <CheckCircle2 className="w-4 h-4 text-[#047857] shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p className="font-display font-extrabold text-[#2F3E4E]">
                          {preScan.adviceTitle}
                        </p>
                        <p className="text-[#475569] mt-0.5">{preScan.adviceDetail}</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Progress & Output Card */}
            {(isCompressing || progress || compressError || compressResult) && (
              <div className="rounded-2xl bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] p-5 shadow-[0_4px_0_#2F3E4E] space-y-4">
                {isCompressing && progress && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 text-[#B45309] animate-spin" />
                        <span className="font-display font-extrabold text-sm text-[#2F3E4E]">
                          {progress.phase === 'finalizing'
                            ? 'Finalizing archive checksum & parts...'
                            : `Streaming (${progress.fileIndex + 1}/${progress.fileCount}): ${progress.currentFileName}`}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleCancelOperation}
                        className="px-3 py-1 rounded-lg border border-[#B91C1C] text-[#B91C1C] hover:bg-[#FEE2E2] font-display font-bold text-xs cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>

                    <div className="w-full h-3.5 rounded-full bg-[#E2E8F0] border border-[#2F3E4E] overflow-hidden">
                      <div
                        className="h-full bg-[#F9C80E] transition-all duration-150"
                        style={{ width: `${Math.max(3, progress.percent)}%` }}
                      />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
                      <div className="px-3 py-2 rounded-lg bg-white border border-[#2F3E4E]/20">
                        <span className="text-[#64748B] block text-[10px]">PROCESSED</span>
                        <strong className="text-[#2F3E4E]">
                          {formatBytes(progress.bytesRead)} / {formatBytes(progress.totalBytes)}
                        </strong>
                      </div>
                      <div className="px-3 py-2 rounded-lg bg-white border border-[#2F3E4E]/20">
                        <span className="text-[#64748B] block text-[10px]">WRITTEN OUT</span>
                        <strong className="text-[#047857]">
                          {formatBytes(progress.bytesOut)}
                        </strong>
                      </div>
                      <div className="px-3 py-2 rounded-lg bg-white border border-[#2F3E4E]/20">
                        <span className="text-[#64748B] block text-[10px]">THROUGHPUT</span>
                        <strong className="text-[#2F3E4E]">
                          {progress.speedMBps.toFixed(1)} MB/s
                        </strong>
                      </div>
                      <div className="px-3 py-2 rounded-lg bg-white border border-[#2F3E4E]/20">
                        <span className="text-[#64748B] block text-[10px]">PRE-COMPACTED</span>
                        <strong className="text-[#B45309]">
                          {formatBytes(progress.preCompactedSavedBytes)}
                        </strong>
                      </div>
                    </div>
                  </div>
                )}

                {compressError && (
                  <div className="p-3.5 rounded-xl bg-[#FFE4E6] border border-[#BE123C] text-xs text-[#881337] flex items-start gap-2.5">
                    <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span className="font-semibold">{compressError}</span>
                  </div>
                )}

                {compressResult && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-[#047857]" />
                        <h4 className="font-display font-extrabold text-base text-[#2F3E4E]">
                          Compression Complete in {(compressResult.elapsedMs / 1000).toFixed(2)}s
                        </h4>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-lg border border-[#2F3E4E] font-mono text-xs font-extrabold ${
                          compressResult.reachedTarget
                            ? 'bg-[#CEE5DC] text-[#2F3E4E]'
                            : 'bg-[#FEF2C8] text-[#92400E]'
                        }`}
                      >
                        {compressResult.reachedTarget
                          ? `Fits Target <= ${targetSizeMb} MB`
                          : `Output > ${targetSizeMb} MB`}
                      </span>
                    </div>

                    {/* Result Hero Numbers */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 rounded-xl bg-white border border-[#2F3E4E]/25">
                        <span className="text-[10px] font-display font-bold uppercase text-[#64748B]">
                          Original Input
                        </span>
                        <div className="font-mono text-sm font-extrabold text-[#2F3E4E] mt-1">
                          {formatBytes(compressResult.totalInputBytes)}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-[#CEE5DC]/50 border border-[#047857]">
                        <span className="text-[10px] font-display font-bold uppercase text-[#047857]">
                          Final Compressed
                        </span>
                        <div className="font-mono text-sm font-extrabold text-[#2F3E4E] mt-1">
                          {formatBytes(compressResult.totalOutputBytes)}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-white border border-[#2F3E4E]/25">
                        <span className="text-[10px] font-display font-bold uppercase text-[#64748B]">
                          Space Reduced
                        </span>
                        <div className="font-mono text-sm font-extrabold text-[#047857] mt-1">
                          {compressResult.ratioPercent.toFixed(1)}% (
                          {compressResult.reductionFactor.toFixed(1)}x)
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-white border border-[#2F3E4E]/25">
                        <span className="text-[10px] font-display font-bold uppercase text-[#64748B]">
                          Output Parts
                        </span>
                        <div className="font-mono text-sm font-extrabold text-[#2F3E4E] mt-1">
                          {compressResult.parts.length}{' '}
                          {compressResult.parts.length === 1 ? 'file' : 'split parts'}
                        </div>
                      </div>
                    </div>

                    {compressResult.preCompactedSavedBytes > 0 && (
                      <div className="text-xs text-[#475569] bg-white px-3.5 py-2 rounded-xl border border-[#2F3E4E]/20 flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-[#B45309] shrink-0" />
                        <span>
                          Lossless DB Pre-Compactor stripped{' '}
                          <strong className="font-mono text-[#2F3E4E]">
                            {formatBytes(compressResult.preCompactedSavedBytes)}
                          </strong>{' '}
                          of redundant SQL comments, blank lines & trailing spaces prior to DEFLATE.
                        </span>
                      </div>
                    )}

                    {/* Download Parts List */}
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-display font-extrabold text-xs uppercase tracking-wider text-[#2F3E4E]">
                          Download Ready ({compressResult.parts.length})
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleVerifyInExtractTab}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-[#FEF2C8] border border-[#2F3E4E] font-display font-bold text-[11px] text-[#2F3E4E] cursor-pointer"
                          >
                            <FileCheck2 className="w-3.5 h-3.5 text-[#047857]" />
                            Verify Round-Trip Extract
                          </button>
                          {compressResult.parts.length > 1 && (
                            <button
                              type="button"
                              onClick={handleDownloadAllParts}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F9C80E] hover:bg-[#eab308] border border-[#2F3E4E] font-display font-bold text-[11px] text-[#2F3E4E] cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Download All {compressResult.parts.length} Parts
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="divide-y divide-[#2F3E4E]/15 rounded-xl border border-[#2F3E4E]/30 bg-white overflow-hidden max-h-72 overflow-y-auto">
                        {compressResult.parts.map((part) => (
                          <div
                            key={part.name}
                            className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <FileArchive className="w-4 h-4 text-[#047857] shrink-0" />
                              <span className="font-mono font-bold text-[#2F3E4E] truncate">
                                {part.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="font-mono text-[11px] font-semibold text-[#475569] tabular-nums">
                                {formatBytes(part.size)}
                              </span>
                              <button
                                type="button"
                                onClick={() => triggerBlobDownload(part.blob, part.name)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F9C80E] hover:bg-[#facc15] border border-[#2F3E4E] font-display font-bold text-[11px] text-[#2F3E4E] cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5" />
                                Save
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {compressResult.wasSplit && (
                      <div className="p-3.5 rounded-xl bg-white border border-[#2F3E4E]/30 space-y-2 text-xs">
                        <div className="font-display font-extrabold text-[#2F3E4E] flex items-center gap-1.5">
                          <Info className="w-3.5 h-3.5 text-[#B45309]" />
                          How to Rejoin Split Parts Later
                        </div>
                        <p className="text-[#475569]">
                          Use our <strong>Decompress / Rejoin</strong> tab above directly in the
                          browser, or merge in terminal:
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-[11px]">
                          <div className="p-2 rounded-lg bg-[#F8FAFC] border border-[#2F3E4E]/20 flex items-center justify-between gap-2">
                            <code className="truncate">
                              copy /b &quot;{compressResult.baseArchiveName}.part*&quot; &quot;
                              {compressResult.baseArchiveName}&quot;
                            </code>
                            <button
                              type="button"
                              onClick={() =>
                                handleCopyText(
                                  'win',
                                  `copy /b "${compressResult.baseArchiveName}.part*" "${compressResult.baseArchiveName}"`
                                )
                              }
                              className="px-2 py-0.5 rounded bg-white border border-[#2F3E4E]/30 text-[10px] font-bold shrink-0 cursor-pointer"
                            >
                              {copiedCmd === 'win' ? 'Copied' : 'Win'}
                            </button>
                          </div>
                          <div className="p-2 rounded-lg bg-[#F8FAFC] border border-[#2F3E4E]/20 flex items-center justify-between gap-2">
                            <code className="truncate">
                              cat &quot;{compressResult.baseArchiveName}.part&quot;* &gt; &quot;
                              {compressResult.baseArchiveName}&quot;
                            </code>
                            <button
                              type="button"
                              onClick={() =>
                                handleCopyText(
                                  'nix',
                                  `cat "${compressResult.baseArchiveName}.part"* > "${compressResult.baseArchiveName}"`
                                )
                              }
                              className="px-2 py-0.5 rounded bg-white border border-[#2F3E4E]/30 text-[10px] font-bold shrink-0 cursor-pointer"
                            >
                              {copiedCmd === 'nix' ? 'Copied' : 'Mac/Linux'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {compressResult.sha256FirstPart && (
                      <div className="text-[11px] font-mono text-[#64748B] truncate">
                        SHA-256 ({compressResult.parts[0]?.name}): {compressResult.sha256FirstPart}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Compression Engine Controls */}
          <div className="xl:col-span-5 xl:sticky xl:top-20 xl:max-h-[calc(100dvh-5.5rem)] xl:overflow-y-auto xl:pr-2 xl:pb-2 vcpl-slim-scroll space-y-5">
            <div className="rounded-2xl bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] p-5 shadow-[0_4px_0_#2F3E4E] space-y-5">
              <h3 className="font-display font-extrabold text-sm uppercase tracking-wider text-[#2F3E4E] flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#2F3E4E]" />
                2. Compression Engine & Target Size
              </h3>

              {/* Engine Mode Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-display font-bold text-[#2F3E4E]">
                  Compression Algorithm & Container
                </label>
                <div className="space-y-2">
                  {[
                    {
                      id: 'gzip-max' as CompressionMethod,
                      title: 'Max-Ratio GZIP (.gz · Level 9)',
                      desc: 'Highest single-file DEFLATE density (mem 12). Best for 500 MB SQL dumps -> smallest .gz.',
                      disabled: selectedFiles.length > 1,
                    },
                    {
                      id: 'zip-max' as CompressionMethod,
                      title: 'Universal ZIP Archive (.zip · Level 9)',
                      desc: 'Opens natively on Windows & macOS; bundles 1 or multiple database files together.',
                      disabled: false,
                    },
                    {
                      id: 'gzip-native' as CompressionMethod,
                      title: 'High-Speed Native GZIP Stream (.gz)',
                      desc: nativeSupported
                        ? 'Hardware-accelerated browser C++ zlib stream for huge 1 GB+ raw files.'
                        : 'Not supported in this browser (use Max-Ratio GZIP above).',
                      disabled: selectedFiles.length > 1 || !nativeSupported,
                    },
                  ].map((opt) => {
                    const active = effectiveMethod === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={opt.disabled || isCompressing}
                        onClick={() => setMethod(opt.id)}
                        className={`w-full text-left p-3 rounded-xl border-[1.5px] transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                          active
                            ? 'bg-[#FEF2C8] border-[#2F3E4E] shadow-[0_2px_0_#2F3E4E]'
                            : 'bg-white border-[#2F3E4E]/25 hover:border-[#2F3E4E]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-display font-extrabold text-xs text-[#2F3E4E]">
                            {opt.title}
                          </span>
                          {active && (
                            <span className="px-2 py-0.5 rounded bg-[#F9C80E] border border-[#2F3E4E] text-[10px] font-display font-extrabold text-[#2F3E4E]">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#475569] mt-1 leading-snug">{opt.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Target Size Goal & Split Policy */}
              <div className="space-y-2.5 pt-2 border-t border-[#2F3E4E]/15">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-display font-bold text-[#2F3E4E] flex items-center gap-1.5">
                    <Scissors className="w-3.5 h-3.5 text-[#B45309]" />
                    Target Size Limit (MB)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      max={4096}
                      step={1}
                      value={targetSizeMb}
                      disabled={isCompressing}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (Number.isFinite(val) && val >= 1) {
                          setTargetSizeMb(Math.min(4096, Math.round(val)));
                        }
                      }}
                      className="w-20 px-2.5 py-1 rounded-lg border border-[#2F3E4E] bg-white font-mono text-xs font-bold text-right text-[#2F3E4E]"
                    />
                    <span className="font-mono text-xs font-bold text-[#64748B]">MB</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {TARGET_PRESETS_MB.map((mb) => (
                    <button
                      key={mb}
                      type="button"
                      disabled={isCompressing}
                      onClick={() => setTargetSizeMb(mb)}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-mono font-bold cursor-pointer transition-colors ${
                        targetSizeMb === mb
                          ? 'bg-[#2F3E4E] text-white border-[#2F3E4E]'
                          : 'bg-white text-[#2F3E4E] border-[#2F3E4E]/30 hover:bg-[#FEF2C8]'
                      }`}
                    >
                      {mb} MB
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-1.5 pt-1">
                  {[
                    {
                      id: 'auto-target' as SplitPolicy,
                      label: `Auto-Split into <= ${targetSizeMb} MB parts ONLY if compressed size exceeds ${targetSizeMb} MB`,
                    },
                    {
                      id: 'none' as SplitPolicy,
                      label: 'Single Archive Only (never split output)',
                    },
                    {
                      id: 'always-target' as SplitPolicy,
                      label: `Always Split into exact <= ${targetSizeMb} MB volume parts`,
                    },
                  ].map((sp) => (
                    <label
                      key={sp.id}
                      className="flex items-start gap-2 text-[11px] text-[#2F3E4E] cursor-pointer py-1"
                    >
                      <input
                        type="radio"
                        name="splitPolicy"
                        checked={splitPolicy === sp.id}
                        disabled={isCompressing}
                        onChange={() => setSplitPolicy(sp.id)}
                        className="mt-0.5 accent-[#2F3E4E]"
                      />
                      <span className="leading-snug">{sp.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Lossless DB Pre-Compactor */}
              <div className="space-y-2 pt-2 border-t border-[#2F3E4E]/15">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-display font-bold text-[#2F3E4E] flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#047857]" />
                    Lossless DB Text Pre-Compactor
                  </span>
                  {preScan && (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-white border border-[#2F3E4E]/25 text-[#475569]">
                      {preScan.isTextLike ? 'Text Stream Active' : 'Binary Safe Skip'}
                    </span>
                  )}
                </div>

                <label className="flex items-start gap-2 text-xs text-[#2F3E4E] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={compaction.stripSqlComments}
                    disabled={isCompressing}
                    onChange={(e) =>
                      setCompaction((c) => ({ ...c, stripSqlComments: e.target.checked }))
                    }
                    className="mt-0.5 accent-[#2F3E4E]"
                  />
                  <span>
                    Strip standalone SQL comment lines (<code>-- ...</code> &amp; banners, keeps{' '}
                    <code>/*!...*/</code> hints)
                  </span>
                </label>

                <label className="flex items-start gap-2 text-xs text-[#2F3E4E] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={compaction.trimBlankAndTrailing}
                    disabled={isCompressing}
                    onChange={(e) =>
                      setCompaction((c) => ({ ...c, trimBlankAndTrailing: e.target.checked }))
                    }
                    className="mt-0.5 accent-[#2F3E4E]"
                  />
                  <span>Trim blank lines, trailing spaces &amp; JSON/XML indentation</span>
                </label>
              </div>

              {/* Run Button */}
              <button
                type="button"
                onClick={handleStartCompression}
                disabled={selectedFiles.length === 0 || isCompressing}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-[#F9C80E] hover:bg-[#facc15] active:translate-y-0.5 border-[1.5px] border-[#2F3E4E] shadow-[0_4px_0_#2F3E4E] font-display font-extrabold text-sm text-[#2F3E4E] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
              >
                <Play className="w-4 h-4 fill-current" />
                {isCompressing
                  ? `Compressing (${progress?.percent ?? 0}%)...`
                  : selectedFiles.length === 0
                  ? 'Add a File Above to Compress'
                  : `Compress Now (${formatBytes(totalInputBytes)})`}
              </button>

              {/* Physics / Privacy Clarification */}
              <div className="p-3 rounded-xl bg-[#CEE5DC]/45 border border-[#2F3E4E]/25 text-[11px] text-[#334155] leading-relaxed flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-[#047857] shrink-0 mt-0.5" />
                <span>
                  <strong>Honest Compression Science:</strong> Plaintext SQL, CSV, JSON, &amp; XML
                  backups commonly shrink <strong>90%–98%</strong> (500 MB &rarr; 10–25 MB). Already
                  compressed or encrypted binary files (`.zip`, `.bak` compressed, `.sqlite` BLOBs)
                  cannot shrink 50x losslessly—use <strong>Auto-Split</strong> to guarantee every
                  output chunk stays under <strong>{targetSizeMb} MB</strong>.
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* DECOMPRESS & REJOIN TAB */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 rounded-2xl bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] p-5 shadow-[0_4px_0_#2F3E4E] space-y-4">
            <h3 className="font-display font-extrabold text-sm uppercase tracking-wider text-[#2F3E4E] flex items-center gap-2">
              <Archive className="w-4 h-4 text-[#047857]" />
              Select .GZ, .ZIP, or Split .PART001 / .PART002 Files
            </h3>

            <FileDropZone
              multiple
              disabled={isExtracting}
              onFiles={handleAddExtractFiles}
              className="rounded-2xl border-2 border-dashed border-[#2F3E4E]/40 bg-white hover:border-[#2F3E4E] transition-colors p-6 text-center"
            >
              {({ isDragActive }) => (
                <label className="block cursor-pointer space-y-3">
                  <input
                    type="file"
                    multiple
                    disabled={isExtracting}
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        handleAddExtractFiles(Array.from(e.target.files));
                        e.target.value = '';
                      }
                    }}
                  />
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-[#CEE5DC] border-[1.5px] border-[#2F3E4E] flex items-center justify-center">
                    <FolderArchive className="w-5 h-5 text-[#2F3E4E]" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-display font-extrabold text-sm text-[#2F3E4E]">
                      {isDragActive
                        ? 'Release Archive or Parts Here'
                        : 'Drop Compressed Archive or All Split .part Files'}
                    </p>
                    <p className="text-xs text-[#64748B]">
                      Supports single .gz / .zip archives or multi-part .part001, .part002 sequences (auto-sorted)
                    </p>
                  </div>
                  <div>
                    <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] shadow-[0_2px_0_#2F3E4E] font-display font-bold text-xs text-[#2F3E4E]">
                      Select Archive / Split Parts
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-[#64748B]">
                    100% browser-local streaming extraction &amp; binary part rejoining
                  </p>
                </label>
              )}
            </FileDropZone>

            {sortedExtractFiles.length > 0 && (
              <div className="space-y-2.5 pt-2">
                <div className="flex items-center justify-between text-xs font-display font-bold text-[#2F3E4E]">
                  <span>
                    Part / Archive Sequence ({sortedExtractFiles.length}{' '}
                    {sortedExtractFiles.length === 1 ? 'file' : 'files'})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setExtractInputFiles([]);
                      setExtractResult(null);
                      setExtractError(null);
                    }}
                    disabled={isExtracting}
                    className="text-[11px] text-[#B91C1C] hover:underline cursor-pointer"
                  >
                    Clear Queue
                  </button>
                </div>

                <div className="divide-y divide-[#2F3E4E]/15 rounded-xl border border-[#2F3E4E]/30 bg-white overflow-hidden max-h-64 overflow-y-auto">
                  {sortedExtractFiles.map((f, i) => (
                    <div
                      key={`${f.name}-${i}`}
                      className="flex items-center justify-between gap-3 px-3.5 py-2 text-xs"
                    >
                      <span className="font-mono font-semibold text-[#2F3E4E] truncate">
                        {i + 1}. {f.name}
                      </span>
                      <span className="font-mono text-[11px] text-[#475569] shrink-0">
                        {formatBytes(f.size)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleStartExtraction}
              disabled={sortedExtractFiles.length === 0 || isExtracting}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#F9C80E] hover:bg-[#facc15] border-[1.5px] border-[#2F3E4E] shadow-[0_3px_0_#2F3E4E] font-display font-extrabold text-sm text-[#2F3E4E] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FolderArchive className="w-4 h-4" />
              {isExtracting
                ? `${extractProgress?.label ?? 'Extracting'} (${extractProgress?.percent ?? 0}%)`
                : 'Rejoin & Extract Original Database File'}
            </button>

            {extractError && (
              <div className="p-3.5 rounded-xl bg-[#FFE4E6] border border-[#BE123C] text-xs text-[#881337] flex items-start gap-2">
                <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="font-semibold">{extractError}</span>
              </div>
            )}
          </div>

          <div className="lg:col-span-5 lg:sticky lg:top-20 rounded-2xl bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] p-5 shadow-[0_4px_0_#2F3E4E] space-y-4">
            <h3 className="font-display font-extrabold text-sm uppercase tracking-wider text-[#2F3E4E] flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-[#047857]" />
              Extracted Output Files
            </h3>

            {!extractResult ? (
              <div className="p-6 rounded-xl bg-white border border-dashed border-[#2F3E4E]/30 text-center text-xs text-[#64748B] space-y-1.5">
                <Database className="w-6 h-6 mx-auto text-[#94A3B8]" />
                <p className="font-display font-bold text-[#2F3E4E]">
                  No extracted files yet
                </p>
                <p>
                  Drop your <code>.gz</code>, <code>.zip</code>, or split <code>.part001+</code>{' '}
                  files on the left and click Extract to recover the full database file.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-[#CEE5DC]/60 border border-[#047857] text-xs text-[#1E293B] flex items-center justify-between">
                  <span className="font-display font-bold">
                    Restored {extractResult.files.length}{' '}
                    {extractResult.files.length === 1 ? 'file' : 'files'} in{' '}
                    {(extractResult.elapsedMs / 1000).toFixed(2)}s
                  </span>
                  <span className="font-mono font-extrabold text-[#047857]">
                    {formatBytes(extractResult.totalExtractedBytes)}
                  </span>
                </div>

                <div className="divide-y divide-[#2F3E4E]/15 rounded-xl border border-[#2F3E4E]/30 bg-white overflow-hidden max-h-80 overflow-y-auto">
                  {extractResult.files.map((item) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-mono font-bold text-[#2F3E4E] truncate">
                          {item.name}
                        </div>
                        <div className="font-mono text-[11px] text-[#64748B]">
                          {formatBytes(item.size)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => triggerBlobDownload(item.blob, item.name)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F9C80E] hover:bg-[#facc15] border border-[#2F3E4E] font-display font-bold text-[11px] text-[#2F3E4E] shrink-0 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Save
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
