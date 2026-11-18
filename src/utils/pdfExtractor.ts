import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface ExtractedPdfPage {
  pageNumber: number;
  lines: string[];
  rawText: string;
}

export async function extractTextFromPdf(buffer: ArrayBuffer): Promise<{
  pages: ExtractedPdfPage[];
  fullText: string;
  allLines: string[];
}> {
  const loadingTask = pdfjsLib.getDocument({ data: buffer.slice(0) });
  const pdf = await loadingTask.promise;

  const pages: ExtractedPdfPage[] = [];
  const allLines: string[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();

    interface PositionedItem {
      str: string;
      x: number;
      y: number;
    }

    const items: PositionedItem[] = [];
    for (const rawItem of content.items) {
      if ('str' in rawItem && rawItem.str) {
        const transform = rawItem.transform as number[];
        items.push({
          str: rawItem.str,
          x: transform?.[4] ?? 0,
          y: transform?.[5] ?? 0,
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
      const joined = currentLineParts
        .map((it) => it.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (joined) {
        lines.push(joined);
        allLines.push(joined);
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
  };
}
