import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface ExtractedPdfPage {
  pageNumber: number;
  lines: string[];
  rawText: string;
}

export class PdfPasswordError extends Error {
  reason: 'need_password' | 'incorrect_password';

  constructor(reason: 'need_password' | 'incorrect_password', message: string) {
    super(message);
    this.name = 'PdfPasswordError';
    this.reason = reason;
  }
}

export async function extractTextFromPdf(
  buffer: ArrayBuffer,
  options?: { password?: string; onProgress?: (page: number, totalPages: number) => void }
): Promise<{
  pages: ExtractedPdfPage[];
  fullText: string;
  allLines: string[];
  numPages: number;
}> {
  const password = options?.password?.trim();
  const loadingTask = pdfjsLib.getDocument({
    data: buffer.slice(0),
    ...(password ? { password } : {}),
  });

  let pdf: pdfjsLib.PDFDocumentProxy;
  try {
    pdf = await loadingTask.promise;
  } catch (err: any) {
    if (err?.name === 'PasswordException') {
      if (err?.code === 2) {
        throw new PdfPasswordError(
          'incorrect_password',
          'Incorrect PDF password. For TRACES Form 26AS, enter your DOB/DOI (typically DDMMYYYY) and try again.'
        );
      }
      throw new PdfPasswordError(
        'need_password',
        'This PDF is password-protected. Enter the PDF password (typically DDMMYYYY) below to unlock and parse it locally.'
      );
    }
    throw err;
  }

  const pages: ExtractedPdfPage[] = [];
  const allLines: string[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    options?.onProgress?.(p, pdf.numPages);
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();

    interface PositionedItem {
      str: string;
      x: number;
      y: number;
      w: number;
      h: number;
    }

    const items: PositionedItem[] = [];
    for (const rawItem of content.items) {
      if ('str' in rawItem && rawItem.str) {
        const transform = rawItem.transform as number[];
        items.push({
          str: rawItem.str,
          x: transform?.[4] ?? 0,
          y: transform?.[5] ?? 0,
          w: typeof rawItem.width === 'number' ? rawItem.width : 0,
          h: Math.abs(transform?.[3] ?? transform?.[0] ?? 10),
        });
      }
    }

    // Group items by vertical line tolerance (within 3pt) top-to-bottom
    items.sort((a, b) => {
      if (Math.abs(a.y - b.y) > 3) return b.y - a.y;
      return a.x - b.x;
    });

    const lines: string[] = [];
    let currentY: number | null = null;
    let currentLineParts: PositionedItem[] = [];

    const flushLine = () => {
      if (currentLineParts.length === 0) return;
      currentLineParts.sort((a, b) => a.x - b.x);
      let joined = '';
      for (let idx = 0; idx < currentLineParts.length; idx++) {
        const cur = currentLineParts[idx];
        if (idx === 0) {
          joined = cur.str;
          continue;
        }
        const prev = currentLineParts[idx - 1];
        const prevEnd = prev.w > 0 ? prev.x + prev.w : prev.x;
        const gap = cur.x - prevEnd;
        const fontThreshold = Math.max(1.4, Math.min(prev.h || 10, cur.h || 10) * 0.16);
        const alreadySpaced = prev.str.endsWith(' ') || cur.str.startsWith(' ');
        if (!alreadySpaced && (prev.w <= 0 || gap > fontThreshold)) {
          joined += ' ' + cur.str;
        } else {
          joined += cur.str;
        }
      }
      const normalized = joined.replace(/\s+/g, ' ').trim();
      if (normalized) {
        lines.push(normalized);
        allLines.push(normalized);
      }
      currentLineParts = [];
    };

    for (const item of items) {
      if (currentY === null || Math.abs(item.y - currentY) <= 3) {
        if (currentY === null) currentY = item.y;
        currentLineParts.push(item);
      } else {
        flushLine();
        currentY = item.y;
        currentLineParts.push(item);
      }
    }
    flushLine();

    pages.push({
      pageNumber: p,
      lines,
      rawText: lines.join('\n'),
    });
  }

  return {
    pages,
    fullText: allLines.join('\n'),
    allLines,
    numPages: pdf.numPages,
  };
}
