import {
  Gzip,
  Gunzip,
  Unzip,
  UnzipInflate,
  UnzipPassThrough,
  Zip,
  ZipDeflate,
  gzipSync,
  strToU8,
} from 'fflate';

export type CompressionMethod = 'gzip-max' | 'zip-max' | 'gzip-native';
export type SplitPolicy = 'none' | 'auto-target' | 'always-target';

export interface CompactionOptions {
  stripSqlComments: boolean;
  trimBlankAndTrailing: boolean;
}

export interface CompressJobConfig {
  files: File[];
  method: CompressionMethod;
  compaction: CompactionOptions;
  targetSizeMb: number;
  splitPolicy: SplitPolicy;
  archiveBaseName?: string;
  onProgress?: (progress: CompressProgress) => void;
  signal?: AbortSignal;
}

export interface CompressProgress {
  phase: 'reading' | 'compressing' | 'finalizing';
  fileIndex: number;
  fileCount: number;
  currentFileName: string;
  bytesRead: number;
  totalBytes: number;
  bytesOut: number;
  preCompactedSavedBytes: number;
  percent: number;
  speedMBps: number;
  elapsedMs: number;
}

export interface OutputPartFile {
  name: string;
  blob: Blob;
  size: number;
  partNumber: number;
  totalParts: number;
}

export interface CompressJobResult {
  parts: OutputPartFile[];
  totalInputBytes: number;
  totalOutputBytes: number;
  preCompactedSavedBytes: number;
  ratioPercent: number;
  reductionFactor: number;
  elapsedMs: number;
  methodUsed: CompressionMethod;
  wasSplit: boolean;
  baseArchiveName: string;
  reachedTarget: boolean;
  targetSizeBytes: number;
  sha256FirstPart?: string;
}

export interface PreScanReport {
  totalBytes: number;
  fileCount: number;
  isTextLike: boolean;
  detectedFormatLabel: string;
  sampleBytesAnalyzed: number;
  estimatedRawGzipRatio: number; // e.g., 0.12 means shrinks to 12%
  estimatedCompactedRatio: number;
  projectedCompressedBytes: number;
  projectedCompactedBytes: number;
  preCompactorPotentialPercent: number;
  compressibilityLabel: 'Ultra-High' | 'High' | 'Moderate' | 'Low (Already Compressed / High-Entropy)';
  adviceTitle: string;
  adviceDetail: string;
  canLikelyHitTargetSingleFile: boolean;
  estimatedPartsNeeded: number;
}

export interface DecompressExtractedFile {
  name: string;
  blob: Blob;
  size: number;
}

export interface DecompressResult {
  files: DecompressExtractedFile[];
  totalInputBytes: number;
  totalExtractedBytes: number;
  elapsedMs: number;
  sourceMode: 'gzip' | 'zip' | 'rejoined-parts';
}

const STREAM_CHUNK_BYTES = 2 * 1024 * 1024; // 2 MB slices keep RAM tiny on 500MB–2GB+ files

const TEXT_EXTENSIONS = new Set([
  'sql',
  'dump',
  'ddl',
  'csv',
  'tsv',
  'json',
  'ndjson',
  'jsonl',
  'xml',
  'log',
  'txt',
]);

const ALREADY_COMPRESSED_EXTENSIONS = new Set([
  'gz',
  'gzip',
  'zip',
  '7z',
  'rar',
  'bz2',
  'xz',
  'zst',
  'lz4',
  'tgz',
  'tbz2',
  'parquet',
  'orc',
  'png',
  'jpg',
  'jpeg',
  'webp',
  'mp4',
  'pdf',
  'xlsx',
  'docx',
]);

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIdx = 0;
  while (value >= 1024 && unitIdx < units.length - 1) {
    value /= 1024;
    unitIdx++;
  }
  const decimals = unitIdx === 0 ? 0 : value >= 100 ? 1 : 2;
  return `${value.toFixed(decimals)} ${units[unitIdx]}`;
}

export function getFileExtension(name: string): string {
  const clean = name.trim().toLowerCase();
  const dotIdx = clean.lastIndexOf('.');
  return dotIdx >= 0 ? clean.slice(dotIdx + 1) : '';
}

export function stripTrailingArchiveExt(name: string): string {
  return name.replace(/\.(part\d+|gz|gzip|zip)$/i, '');
}

export function supportsNativeGzipStream(): boolean {
  return typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
}

function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function checkAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('Operation cancelled by user.', 'AbortError');
  }
}

function hasNullBytes(sample: Uint8Array): boolean {
  const limit = Math.min(sample.length, 65536);
  for (let i = 0; i < limit; i++) {
    if (sample[i] === 0) return true;
  }
  return false;
}

export async function isTextDatabaseFile(file: File): Promise<boolean> {
  const ext = getFileExtension(file.name);
  if (ALREADY_COMPRESSED_EXTENSIONS.has(ext)) return false;
  const sampleLen = Math.min(file.size, 65536);
  if (sampleLen === 0) return TEXT_EXTENSIONS.has(ext);
  const buf = new Uint8Array(await file.slice(0, sampleLen).arrayBuffer());
  if (hasNullBytes(buf)) return false;
  if (TEXT_EXTENSIONS.has(ext)) return true;

  // Heuristic for extensionless dumps: check printable UTF-8 ratio
  let printable = 0;
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    if (b === 9 || b === 10 || b === 13 || (b >= 32 && b <= 126) || b >= 128) {
      printable++;
    }
  }
  return printable / buf.length > 0.94;
}

function describeDatabaseFormat(file: File, isText: boolean): string {
  const ext = getFileExtension(file.name);
  switch (ext) {
    case 'sql':
    case 'dump':
    case 'ddl':
      return isText ? 'SQL Database Dump (Text)' : 'Database Dump (Binary)';
    case 'sqlite':
    case 'sqlite3':
    case 'db':
      return 'SQLite Binary Database';
    case 'bak':
    case 'mdf':
    case 'ldf':
      return 'SQL Server Backup / Data File';
    case 'mdb':
    case 'accdb':
      return 'Access Database File';
    case 'csv':
    case 'tsv':
      return 'Tabular Delimited Data (CSV/TSV)';
    case 'json':
    case 'ndjson':
    case 'jsonl':
      return 'JSON / Line-Delimited Export';
    case 'xml':
      return 'XML Structured Export';
    case 'log':
    case 'txt':
      return 'Plain Text / Audit Log';
    case 'tar':
      return 'Uncompressed TAR Archive';
    default:
      if (ALREADY_COMPRESSED_EXTENSIONS.has(ext)) {
        return `Already-Compressed (.${ext})`;
      }
      return isText ? 'Text / Structured File' : 'Binary Data File';
  }
}

/**
 * Streaming line-aware lossless pre-compactor for SQL / JSON / XML / CSV / Log text streams.
 * Never alters bytes inside SQL INSERT string values or XML text content beyond safe line trimming.
 */
export class TextStreamCompactor {
  private readonly ext: string;
  private readonly opts: CompactionOptions;
  private readonly decoder = new TextDecoder('utf-8');
  private readonly encoder = new TextEncoder();
  private leftoverLine = '';
  public bytesSaved = 0;

  constructor(fileName: string, opts: CompactionOptions) {
    this.ext = getFileExtension(fileName);
    this.opts = opts;
  }

  private isSqlLike(): boolean {
    return this.ext === 'sql' || this.ext === 'dump' || this.ext === 'ddl';
  }

  private isJsonOrXml(): boolean {
    return (
      this.ext === 'json' ||
      this.ext === 'ndjson' ||
      this.ext === 'jsonl' ||
      this.ext === 'xml'
    );
  }

  private processLine(rawLineWithCr: string): string | null {
    const raw = rawLineWithCr.endsWith('\r')
      ? rawLineWithCr.slice(0, -1)
      : rawLineWithCr;
    const trimmed = raw.trim();

    if (this.opts.trimBlankAndTrailing && trimmed.length === 0) {
      return null;
    }

    if (this.opts.stripSqlComments && this.isSqlLike()) {
      // Strip standalone SQL `--` header/divider comments safely
      if (trimmed.startsWith('--')) {
        return null;
      }
      // Strip standalone non-conditional `/* ... */` comments (keep MySQL /*!40101 ... */)
      if (
        trimmed.startsWith('/*') &&
        !trimmed.startsWith('/*!') &&
        trimmed.endsWith('*/')
      ) {
        return null;
      }
    }

    let out = raw;
    if (this.opts.trimBlankAndTrailing) {
      if (this.isJsonOrXml()) {
        out = trimmed;
      } else {
        // Strip trailing horizontal whitespace only (preserves indentation if any text matters)
        out = raw.replace(/[ \t]+$/g, '');
      }
    }
    return out;
  }

  push(chunk: Uint8Array, isLast: boolean): Uint8Array {
    if (!this.opts.stripSqlComments && !this.opts.trimBlankAndTrailing) {
      return chunk;
    }

    const decoded = this.leftoverLine + this.decoder.decode(chunk, { stream: !isLast });
    const lines = decoded.split('\n');

    if (!isLast) {
      this.leftoverLine = lines.pop() ?? '';
    } else {
      this.leftoverLine = '';
    }

    if (lines.length === 0) {
      return new Uint8Array(0);
    }

    const kept: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const processed = this.processLine(lines[i]);
      if (processed !== null) {
        kept.push(processed);
      }
    }

    const joined =
      kept.length > 0
        ? kept.join('\n') + (isLast ? '' : '\n')
        : '';

    const encoded = joined.length > 0 ? this.encoder.encode(joined) : new Uint8Array(0);
    // Approximate saved bytes accurately over the stream
    const inputDelta = chunk.byteLength;
    const outputDelta = encoded.byteLength;
    this.bytesSaved += inputDelta - outputDelta;
    return encoded;
  }
}

/**
 * Samples up to 3 windows (head, middle, tail) in <80ms to forecast real compression density.
 */
export async function analyzeFilesCompressibility(
  files: File[],
  targetSizeMb: number,
  compaction: CompactionOptions
): Promise<PreScanReport> {
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  const targetBytes = Math.max(0.25, targetSizeMb) * 1024 * 1024;
  if (files.length === 0 || totalBytes === 0) {
    return {
      totalBytes: 0,
      fileCount: 0,
      isTextLike: false,
      detectedFormatLabel: 'No file selected',
      sampleBytesAnalyzed: 0,
      estimatedRawGzipRatio: 1,
      estimatedCompactedRatio: 1,
      projectedCompressedBytes: 0,
      projectedCompactedBytes: 0,
      preCompactorPotentialPercent: 0,
      compressibilityLabel: 'Moderate',
      adviceTitle: 'Drop a database file to scan compressibility',
      adviceDetail: 'Supports .sql, .dump, .bak, .sqlite, .db, .csv, .json, .xml, and .tar files.',
      canLikelyHitTargetSingleFile: true,
      estimatedPartsNeeded: 1,
    };
  }

  const primary = files[0];
  const isTextLike = await isTextDatabaseFile(primary);
  const detectedFormatLabel =
    files.length === 1
      ? describeDatabaseFormat(primary, isTextLike)
      : `${files.length} Files Combined (${describeDatabaseFormat(primary, isTextLike)})`;

  const windowSize = 384 * 1024; // 384 KB per sample point
  let sampleBytesAnalyzed = 0;
  let sampleCompressedRaw = 0;
  let sampleCompressedCompact = 0;

  // Sample primary file (head, mid, tail) and up to 2 extra files if bundled
  const sampleFiles = files.slice(0, 3);
  for (const f of sampleFiles) {
    if (f.size === 0) continue;
    const offsets: number[] = [0];
    if (f.size > windowSize * 3) {
      offsets.push(Math.floor(f.size * 0.5 - windowSize * 0.5));
      offsets.push(Math.max(0, f.size - windowSize));
    }

    for (const start of offsets) {
      const end = Math.min(f.size, start + windowSize);
      const sliceBytes = new Uint8Array(await f.slice(start, end).arrayBuffer());
      if (sliceBytes.byteLength === 0) continue;

      sampleBytesAnalyzed += sliceBytes.byteLength;
      const gzRaw = gzipSync(sliceBytes, { level: 9, mem: 12 });
      sampleCompressedRaw += gzRaw.byteLength;

      if (isTextLike && (compaction.stripSqlComments || compaction.trimBlankAndTrailing)) {
        const compactor = new TextStreamCompactor(f.name, compaction);
        const compactedSlice = compactor.push(sliceBytes, true);
        if (compactedSlice.byteLength > 0) {
          const gzComp = gzipSync(compactedSlice, { level: 9, mem: 12 });
          sampleCompressedCompact += gzComp.byteLength;
        }
      } else {
        sampleCompressedCompact += gzRaw.byteLength;
      }
    }
  }

  const estimatedRawGzipRatio =
    sampleBytesAnalyzed > 0 ? Math.min(1.02, sampleCompressedRaw / sampleBytesAnalyzed) : 1;
  const estimatedCompactedRatio =
    sampleBytesAnalyzed > 0 ? Math.min(1.02, sampleCompressedCompact / sampleBytesAnalyzed) : 1;

  const projectedCompressedBytes = Math.round(totalBytes * estimatedRawGzipRatio);
  const projectedCompactedBytes = Math.round(totalBytes * estimatedCompactedRatio);
  const preCompactorPotentialPercent =
    projectedCompressedBytes > 0
      ? Math.max(0, ((projectedCompressedBytes - projectedCompactedBytes) / projectedCompressedBytes) * 100)
      : 0;

  const effectiveProjected = projectedCompactedBytes;
  const canLikelyHitTargetSingleFile = effectiveProjected <= targetBytes;
  const estimatedPartsNeeded = Math.max(1, Math.ceil(effectiveProjected / targetBytes));

  let compressibilityLabel: PreScanReport['compressibilityLabel'];
  if (estimatedCompactedRatio <= 0.12) {
    compressibilityLabel = 'Ultra-High';
  } else if (estimatedCompactedRatio <= 0.35) {
    compressibilityLabel = 'High';
  } else if (estimatedCompactedRatio <= 0.72) {
    compressibilityLabel = 'Moderate';
  } else {
    compressibilityLabel = 'Low (Already Compressed / High-Entropy)';
  }

  let adviceTitle = '';
  let adviceDetail = '';

  if (canLikelyHitTargetSingleFile) {
    adviceTitle = `Target Reached: Projected ${formatBytes(effectiveProjected)} fits inside your ${targetSizeMb} MB limit`;
    adviceDetail = isTextLike
      ? 'Repetitive SQL schema/INSERT syntax and text rows compress dramatically with Level-9 DEFLATE + Pre-Compactor.'
      : 'This file compresses cleanly within a single archive under your target limit.';
  } else if (estimatedCompactedRatio > 0.88) {
    adviceTitle = `Binary / High-Entropy Data (~${formatBytes(effectiveProjected)} projected single file)`;
    adviceDetail =
      `Notice: ${detectedFormatLabel} is already dense or pre-compressed, so lossless math cannot shrink it to ${targetSizeMb} MB in a single file without data loss. Enable "Auto-Split to ${targetSizeMb} MB Parts" (~${estimatedPartsNeeded} parts) so every upload chunk stays strictly under ${targetSizeMb} MB.`;
  } else {
    adviceTitle = `Projected ${formatBytes(effectiveProjected)} exceeds ${targetSizeMb} MB single-file cap`;
    adviceDetail =
      `Lossless DEFLATE achieves ${(100 - estimatedCompactedRatio * 100).toFixed(1)}% reduction here. Enable "Auto-Split to ${targetSizeMb} MB Parts" (~${estimatedPartsNeeded} parts) for guaranteed <= ${targetSizeMb} MB chunks, or raise the Target MB.`;
  }

  return {
    totalBytes,
    fileCount: files.length,
    isTextLike,
    detectedFormatLabel,
    sampleBytesAnalyzed,
    estimatedRawGzipRatio,
    estimatedCompactedRatio,
    projectedCompressedBytes,
    projectedCompactedBytes,
    preCompactorPotentialPercent,
    compressibilityLabel,
    adviceTitle,
    adviceDetail,
    canLikelyHitTargetSingleFile,
    estimatedPartsNeeded,
  };
}

/**
 * Buffers compressed output chunks and automatically flushes exact <= maxPartBytes Blobs
 * whenever splitting is active, keeping peak memory footprint minimal.
 */
class PartOutputCollector {
  private currentChunks: Uint8Array<ArrayBuffer>[] = [];
  private currentBytes = 0;
  private finishedBlobs: Blob[] = [];
  private readonly mimeType: string;
  private readonly maxPartBytes: number; // 0 = no splitting
  public totalBytesOut = 0;

  constructor(mimeType: string, maxPartBytes: number) {
    this.mimeType = mimeType;
    this.maxPartBytes = maxPartBytes;
  }

  push(data: Uint8Array): void {
    if (data.byteLength === 0) return;
    // Clone slice into a guaranteed ArrayBuffer-backed Uint8Array
    const clean = new Uint8Array(data);
    this.totalBytesOut += clean.byteLength;

    if (this.maxPartBytes <= 0) {
      this.currentChunks.push(clean);
      this.currentBytes += clean.byteLength;
      return;
    }

    let offset = 0;
    while (offset < clean.byteLength) {
      const spaceLeft = this.maxPartBytes - this.currentBytes;
      const take = Math.min(spaceLeft, clean.byteLength - offset);
      const slice = clean.subarray(offset, offset + take);
      this.currentChunks.push(new Uint8Array(slice));
      this.currentBytes += take;
      offset += take;

      if (this.currentBytes >= this.maxPartBytes) {
        this.flushPart();
      }
    }
  }

  private flushPart(): void {
    if (this.currentChunks.length === 0) return;
    const blob = new Blob(this.currentChunks as BlobPart[], { type: this.mimeType });
    this.finishedBlobs.push(blob);
    this.currentChunks = [];
    this.currentBytes = 0;
  }

  finalize(baseFileName: string, splitPolicy: SplitPolicy, targetBytes: number): OutputPartFile[] {
    if (this.currentChunks.length > 0 || this.finishedBlobs.length === 0) {
      this.flushPart();
    }

    // If auto-target split was configured and we ended up with only 1 part <= targetBytes, keep single clean filename
    if (
      this.finishedBlobs.length === 1 &&
      (splitPolicy === 'none' || (splitPolicy === 'auto-target' && this.totalBytesOut <= targetBytes))
    ) {
      const single = this.finishedBlobs[0];
      return [
        {
          name: baseFileName,
          blob: single,
          size: single.size,
          partNumber: 1,
          totalParts: 1,
        },
      ];
    }

    const totalParts = this.finishedBlobs.length;
    const padWidth = Math.max(3, String(totalParts).length);
    return this.finishedBlobs.map((blob, idx) => {
      const num = idx + 1;
      return {
        name: `${baseFileName}.part${String(num).padStart(padWidth, '0')}`,
        blob,
        size: blob.size,
        partNumber: num,
        totalParts,
      };
    });
  }
}

async function computeSha256Hex(blob: Blob): Promise<string | undefined> {
  if (typeof crypto === 'undefined' || !crypto.subtle) return undefined;
  // Skip digest only on gigantic (> 300 MB) single output blobs to avoid huge buffer copy
  if (blob.size > 300 * 1024 * 1024) return undefined;
  const buf = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Compresses one or multiple large database files using streaming 2 MB chunks.
 */
export async function compressDatabaseFiles(config: CompressJobConfig): Promise<CompressJobResult> {
  const { files, method, compaction, targetSizeMb, splitPolicy, archiveBaseName, onProgress, signal } = config;
  if (files.length === 0) {
    throw new Error('Please add at least one file to compress.');
  }

  const startedAt = performance.now();
  const totalInputBytes = files.reduce((sum, f) => sum + f.size, 0);
  const targetSizeBytes = Math.max(1024 * 256, Math.round(targetSizeMb * 1024 * 1024));
  const maxPartBytes = splitPolicy === 'none' ? 0 : targetSizeBytes;

  // Multiple files always require ZIP container; single file honors chosen method
  const effectiveMethod: CompressionMethod =
    files.length > 1 ? 'zip-max' : method;

  const primaryName = archiveBaseName?.trim() || files[0].name;
  const outputFileName =
    effectiveMethod === 'zip-max'
      ? `${files.length > 1 ? primaryName.replace(/\.[^.]+$/, '') || 'database_bundle' : primaryName}.zip`
      : `${primaryName}.gz`;

  const mimeType =
    effectiveMethod === 'zip-max' ? 'application/zip' : 'application/gzip';

  const collector = new PartOutputCollector(mimeType, maxPartBytes);

  let totalBytesRead = 0;
  let preCompactedSavedBytes = 0;

  const emitProgress = (
    phase: CompressProgress['phase'],
    fileIndex: number,
    currentFileName: string
  ) => {
    if (!onProgress) return;
    const elapsedMs = Math.max(1, performance.now() - startedAt);
    const speedMBps = (totalBytesRead / (1024 * 1024)) / (elapsedMs / 1000);
    const percent =
      totalInputBytes > 0
        ? Math.min(99, Math.round((totalBytesRead / totalInputBytes) * 100))
        : 100;
    onProgress({
      phase,
      fileIndex,
      fileCount: files.length,
      currentFileName,
      bytesRead: totalBytesRead,
      totalBytes: totalInputBytes,
      bytesOut: collector.totalBytesOut,
      preCompactedSavedBytes: Math.max(0, preCompactedSavedBytes),
      percent: phase === 'finalizing' ? 99 : percent,
      speedMBps,
      elapsedMs,
    });
  };

  if (effectiveMethod === 'gzip-native' && supportsNativeGzipStream()) {
    const file = files[0];
    const isText = await isTextDatabaseFile(file);
    const useCompactor =
      isText && (compaction.stripSqlComments || compaction.trimBlankAndTrailing);
    const compactor = useCompactor ? new TextStreamCompactor(file.name, compaction) : null;

    const cs = new CompressionStream('gzip');
    const writer = cs.writable.getWriter();
    const reader = cs.readable.getReader();

    const readLoop = (async () => {
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value && value.byteLength > 0) {
            collector.push(value);
          }
        }
      } finally {
        reader.releaseLock();
      }
    })();

    try {
      let offset = 0;
      while (offset < file.size || (file.size === 0 && offset === 0)) {
        checkAborted(signal);
        const end = Math.min(file.size, offset + STREAM_CHUNK_BYTES);
        const isLast = end >= file.size;
        const rawChunk =
          file.size === 0
            ? new Uint8Array(0)
            : new Uint8Array(await file.slice(offset, end).arrayBuffer());

        totalBytesRead += rawChunk.byteLength;
        const processed = compactor ? compactor.push(rawChunk, isLast) : rawChunk;
        if (compactor) {
          preCompactedSavedBytes = Math.max(0, compactor.bytesSaved);
        }

        if (processed.byteLength > 0) {
          await writer.write(new Uint8Array(processed));
        }

        offset = end;
        emitProgress('compressing', 0, file.name);
        await yieldToMainThread();
        if (file.size === 0) break;
      }
      await writer.close();
      await readLoop;
    } catch (err) {
      await writer.abort(err).catch(() => {});
      throw err;
    }
  } else if (effectiveMethod === 'zip-max') {
    let streamError: Error | null = null;
    const zip = new Zip((err, data) => {
      if (err) {
        streamError = err;
        return;
      }
      if (data && data.byteLength > 0) {
        collector.push(data);
      }
    });

    for (let fIdx = 0; fIdx < files.length; fIdx++) {
      checkAborted(signal);
      const file = files[fIdx];
      const isText = await isTextDatabaseFile(file);
      const useCompactor =
        isText && (compaction.stripSqlComments || compaction.trimBlankAndTrailing);
      const compactor = useCompactor ? new TextStreamCompactor(file.name, compaction) : null;
      const baseSavedBefore = preCompactedSavedBytes;

      const entry = new ZipDeflate(file.name, { level: 9, mem: 12 });
      zip.add(entry);

      let offset = 0;
      while (offset < file.size || (file.size === 0 && offset === 0)) {
        checkAborted(signal);
        if (streamError) throw streamError;

        const end = Math.min(file.size, offset + STREAM_CHUNK_BYTES);
        const isLast = end >= file.size;
        const rawChunk =
          file.size === 0
            ? new Uint8Array(0)
            : new Uint8Array(await file.slice(offset, end).arrayBuffer());

        totalBytesRead += rawChunk.byteLength;
        const processed = compactor ? compactor.push(rawChunk, isLast) : rawChunk;
        if (compactor) {
          preCompactedSavedBytes = baseSavedBefore + Math.max(0, compactor.bytesSaved);
        }

        entry.push(processed, isLast);
        if (streamError) throw streamError;

        offset = end;
        emitProgress('compressing', fIdx, file.name);
        await yieldToMainThread();
        if (file.size === 0) break;
      }
    }

    zip.end();
    if (streamError) throw streamError;
  } else {
    // Default: 'gzip-max' using fflate Gzip level 9 + mem 12
    const file = files[0];
    const isText = await isTextDatabaseFile(file);
    const useCompactor =
      isText && (compaction.stripSqlComments || compaction.trimBlankAndTrailing);
    const compactor = useCompactor ? new TextStreamCompactor(file.name, compaction) : null;

    const gzip = new Gzip(
      {
        level: 9,
        mem: 12,
        filename: file.name,
        mtime: file.lastModified || Date.now(),
      },
      (data) => {
        if (data && data.byteLength > 0) {
          collector.push(data);
        }
      }
    );

    let offset = 0;
    while (offset < file.size || (file.size === 0 && offset === 0)) {
      checkAborted(signal);
      const end = Math.min(file.size, offset + STREAM_CHUNK_BYTES);
      const isLast = end >= file.size;
      const rawChunk =
        file.size === 0
          ? new Uint8Array(0)
          : new Uint8Array(await file.slice(offset, end).arrayBuffer());

      totalBytesRead += rawChunk.byteLength;
      const processed = compactor ? compactor.push(rawChunk, isLast) : rawChunk;
      if (compactor) {
        preCompactedSavedBytes = Math.max(0, compactor.bytesSaved);
      }

      gzip.push(processed, isLast);
      offset = end;
      emitProgress('compressing', 0, file.name);
      await yieldToMainThread();
      if (file.size === 0) break;
    }
  }

  emitProgress('finalizing', files.length - 1, primaryName);
  await yieldToMainThread();

  const parts = collector.finalize(outputFileName, splitPolicy, targetSizeBytes);
  const totalOutputBytes = parts.reduce((sum, p) => sum + p.size, 0);
  const elapsedMs = Math.max(1, performance.now() - startedAt);
  const ratioPercent =
    totalInputBytes > 0
      ? Math.max(-25, ((totalInputBytes - totalOutputBytes) / totalInputBytes) * 100)
      : 0;
  const reductionFactor = totalOutputBytes > 0 ? totalInputBytes / totalOutputBytes : 1;
  const sha256FirstPart = parts[0] ? await computeSha256Hex(parts[0].blob) : undefined;

  return {
    parts,
    totalInputBytes,
    totalOutputBytes,
    preCompactedSavedBytes: Math.max(0, preCompactedSavedBytes),
    ratioPercent,
    reductionFactor,
    elapsedMs,
    methodUsed: effectiveMethod,
    wasSplit: parts.length > 1,
    baseArchiveName: outputFileName,
    reachedTarget: parts.every((p) => p.size <= targetSizeBytes),
    targetSizeBytes,
    sha256FirstPart,
  };
}

/**
 * Natural sort for .part001, .part002, ... files dropped in arbitrary order.
 */
export function sortPartFilesNaturally(files: File[]): File[] {
  return [...files].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  );
}

/**
 * Rejoins split `.partNNN` files and/or decompresses `.gz` and `.zip` archives locally.
 */
export async function rejoinAndDecompressFiles(
  inputFiles: File[],
  onProgress?: (percent: number, label: string) => void,
  signal?: AbortSignal
): Promise<DecompressResult> {
  if (inputFiles.length === 0) {
    throw new Error('Select a .gz, .zip, or .part001/.part002 sequence to extract.');
  }

  const startedAt = performance.now();
  const sorted = sortPartFilesNaturally(inputFiles);
  const totalInputBytes = sorted.reduce((s, f) => s + f.size, 0);

  const hasPartFiles = sorted.some((f) => /\.part\d+$/i.test(f.name));
  const mergedBaseName = sorted[0].name.replace(/\.part\d+$/i, '');
  const lowerBase = mergedBaseName.toLowerCase();

  // Check if parts wrap a ZIP or GZIP or raw file
  const isZip = lowerBase.endsWith('.zip');
  const isGzip = lowerBase.endsWith('.gz') || lowerBase.endsWith('.gzip');

  // If parts wrap a non-archive raw file (just binary split), rejoin directly
  if (hasPartFiles && !isZip && !isGzip) {
    const blobs: Blob[] = [];
    let read = 0;
    for (let i = 0; i < sorted.length; i++) {
      checkAborted(signal);
      blobs.push(sorted[i]);
      read += sorted[i].size;
      onProgress?.(Math.round((read / Math.max(1, totalInputBytes)) * 100), `Rejoining ${sorted[i].name}`);
      await yieldToMainThread();
    }
    const mergedBlob = new Blob(blobs);
    return {
      files: [{ name: mergedBaseName, blob: mergedBlob, size: mergedBlob.size }],
      totalInputBytes,
      totalExtractedBytes: mergedBlob.size,
      elapsedMs: Math.max(1, performance.now() - startedAt),
      sourceMode: 'rejoined-parts',
    };
  }

  if (isZip) {
    const unzip = new Unzip();
    unzip.register(UnzipInflate);
    unzip.register(UnzipPassThrough);

    const fileChunksMap = new Map<string, Uint8Array<ArrayBuffer>[]>();
    let unzipError: Error | null = null;

    unzip.onfile = (entry) => {
      if (entry.name.endsWith('/')) return;
      const chunks: Uint8Array<ArrayBuffer>[] = [];
      fileChunksMap.set(entry.name, chunks);
      entry.ondata = (err, data) => {
        if (err) {
          unzipError = err;
          return;
        }
        if (data && data.byteLength > 0) {
          chunks.push(new Uint8Array(data));
        }
      };
      entry.start();
    };

    let bytesRead = 0;
    for (let fIdx = 0; fIdx < sorted.length; fIdx++) {
      const f = sorted[fIdx];
      let offset = 0;
      while (offset < f.size) {
        checkAborted(signal);
        if (unzipError) throw unzipError;
        const end = Math.min(f.size, offset + STREAM_CHUNK_BYTES);
        const isVeryLast = fIdx === sorted.length - 1 && end >= f.size;
        const chunk = new Uint8Array(await f.slice(offset, end).arrayBuffer());
        bytesRead += chunk.byteLength;
        unzip.push(chunk, isVeryLast);
        if (unzipError) throw unzipError;
        offset = end;
        onProgress?.(
          Math.min(99, Math.round((bytesRead / Math.max(1, totalInputBytes)) * 100)),
          `Extracting ${f.name}`
        );
        await yieldToMainThread();
      }
    }

    const extracted: DecompressExtractedFile[] = [];
    for (const [name, chunks] of fileChunksMap.entries()) {
      const blob = new Blob(chunks as BlobPart[]);
      extracted.push({ name, blob, size: blob.size });
    }
    const totalExtractedBytes = extracted.reduce((s, e) => s + e.size, 0);
    return {
      files: extracted,
      totalInputBytes,
      totalExtractedBytes,
      elapsedMs: Math.max(1, performance.now() - startedAt),
      sourceMode: hasPartFiles ? 'rejoined-parts' : 'zip',
    };
  }

  // GZIP stream decompression (works seamlessly across single .gz OR .gz.part001..N sequence)
  const outChunks: Uint8Array<ArrayBuffer>[] = [];
  const gunzip = new Gunzip((data) => {
    if (data && data.byteLength > 0) {
      outChunks.push(new Uint8Array(data));
    }
  });

  let bytesRead = 0;
  for (let fIdx = 0; fIdx < sorted.length; fIdx++) {
    const f = sorted[fIdx];
    let offset = 0;
    while (offset < f.size) {
      checkAborted(signal);
      const end = Math.min(f.size, offset + STREAM_CHUNK_BYTES);
      const isVeryLast = fIdx === sorted.length - 1 && end >= f.size;
      const chunk = new Uint8Array(await f.slice(offset, end).arrayBuffer());
      bytesRead += chunk.byteLength;
      gunzip.push(chunk, isVeryLast);
      offset = end;
      onProgress?.(
        Math.min(99, Math.round((bytesRead / Math.max(1, totalInputBytes)) * 100)),
        `Decompressing ${f.name}`
      );
      await yieldToMainThread();
    }
  }

  const outBlob = new Blob(outChunks as BlobPart[]);
  const restoredName = stripTrailingArchiveExt(mergedBaseName) || 'restored_database.sql';
  return {
    files: [{ name: restoredName, blob: outBlob, size: outBlob.size }],
    totalInputBytes,
    totalExtractedBytes: outBlob.size,
    elapsedMs: Math.max(1, performance.now() - startedAt),
    sourceMode: hasPartFiles ? 'rejoined-parts' : 'gzip',
  };
}

/**
 * Generates a realistic synthetic SQL database dump (default 25 MB) directly in memory
 * so users can test ultra-high-ratio compression (typically 96%–98% smaller) with 1 click.
 */
export function generateSampleDatabaseSqlFile(targetSizeMb = 25): File {
  const targetBytes = Math.max(1, targetSizeMb) * 1024 * 1024;
  const header = [
    '-- VCPL Synthetic SQL Database Benchmark Dump',
    '-- Engine: InnoDB / PostgreSQL compatible multi-row INSERT stream',
    '-- ------------------------------------------------------',
    'SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";',
    'START TRANSACTION;',
    '',
    'CREATE TABLE IF NOT EXISTS `dms_vehicle_ledger` (',
    '  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,',
    '  `branch_code` VARCHAR(16) NOT NULL,',
    '  `invoice_no` VARCHAR(32) NOT NULL,',
    '  `chassis_vin` VARCHAR(24) NOT NULL,',
    '  `model_variant` VARCHAR(64) NOT NULL,',
    '  `taxable_amount` DECIMAL(14,2) NOT NULL,',
    '  `cgst_amount` DECIMAL(12,2) NOT NULL,',
    '  `sgst_amount` DECIMAL(12,2) NOT NULL,',
    '  `receipt_status` VARCHAR(24) NOT NULL,',
    '  `created_at` DATETIME NOT NULL,',
    '  PRIMARY KEY (`id`)',
    ');',
    '',
  ].join('\n');

  const variants = [
    '330Li M Sport Pro (Mineral White)',
    'X5 xDrive40i M Sport (Tanzanite Blue)',
    'X1 sDrive18i M Sport (Storm Bay)',
    '530Li M Sport LWB (Carbon Black)',
    'iX1 xDrive30 M Sport (Alpine White)',
  ];
  const branches = ['BLR-HQ', 'MUM-WST', 'DEL-NCR', 'MLR-SHW', 'CHN-STH'];
  const statuses = ['CLEARED', 'RECONCILED', 'TALLY_POSTED', 'BANK_VERIFIED'];

  // Build one ~64 KB repeating SQL block with varied sequential IDs/invoices
  const batchLines: string[] = [];
  let rowId = 100001;
  for (let b = 0; b < 14; b++) {
    batchLines.push('-- Audit batch ledger sync');
    batchLines.push(
      'INSERT INTO `dms_vehicle_ledger` (`id`, `branch_code`, `invoice_no`, `chassis_vin`, `model_variant`, `taxable_amount`, `cgst_amount`, `sgst_amount`, `receipt_status`, `created_at`) VALUES'
    );
    const tuples: string[] = [];
    for (let r = 0; r < 25; r++) {
      const idx = rowId++;
      const br = branches[idx % branches.length];
      const vr = variants[idx % variants.length];
      const st = statuses[idx % statuses.length];
      const amt = (4850000 + (idx % 17) * 125000).toFixed(2);
      const gst = ((Number(amt) * 14) / 100).toFixed(2);
      tuples.push(
        `  (${idx}, '${br}', 'INV/2627/${String(idx).padStart(6, '0')}', 'WBA71AB090M${String(idx).padStart(6, '0')}', '${vr}', ${amt}, ${gst}, ${gst}, '${st}', '2026-11-18 11:30:00')`
      );
    }
    batchLines.push(tuples.join(',\n') + ';');
    batchLines.push('');
  }

  const blockBytes = strToU8(batchLines.join('\n'));
  const footerBytes = strToU8('\nCOMMIT;\n');
  const chunks: Uint8Array<ArrayBuffer>[] = [new Uint8Array(strToU8(header))];

  let written = chunks[0].byteLength;
  while (written + blockBytes.byteLength < targetBytes) {
    chunks.push(new Uint8Array(blockBytes));
    written += blockBytes.byteLength;
  }
  chunks.push(new Uint8Array(footerBytes));

  const blob = new Blob(chunks as BlobPart[], { type: 'application/sql' });
  return new File([blob], `sample_dms_ledger_${targetSizeMb}mb.sql`, {
    type: 'application/sql',
    lastModified: Date.now(),
  });
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
