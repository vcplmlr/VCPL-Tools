import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface ConvertedPdfPage {
  pageNum: number;
  dataUrl: string;
  width: number;
  height: number;
  sizeKb: number;
}

export function sanitizeWinAnsi(text: string): string {
  return (text || '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2022/g, '*')
    .replace(/\u20B9/g, 'Rs.')
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '');
}

export async function createSamplePdfBytes(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const font = await doc.embedFont(StandardFonts.Helvetica);

  const p1 = doc.addPage([595.28, 841.89]);
  p1.drawText('Sample Official Application Dossier', {
    x: 50,
    y: 780,
    size: 18,
    font: boldFont,
    color: rgb(0.18, 0.24, 0.31),
  });
  p1.drawText('Document ID: VCPL-DOC-2026-84920', {
    x: 50,
    y: 755,
    size: 11,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });
  p1.drawText('This sample document is provided for testing client-side PDF conversions,', {
    x: 50,
    y: 710,
    size: 12,
    font,
  });
  p1.drawText('splitting, page extraction, signing, watermarking, and compression.', {
    x: 50,
    y: 690,
    size: 12,
    font,
  });
  p1.drawRectangle({
    x: 50,
    y: 530,
    width: 495,
    height: 120,
    borderColor: rgb(0.18, 0.24, 0.31),
    borderWidth: 1,
  });
  p1.drawText('Candidate Name: Ramesh Kumar', { x: 70, y: 620, size: 12, font: boldFont });
  p1.drawText('Application Post: Assistant Section Officer (ASO)', { x: 70, y: 595, size: 11, font });
  p1.drawText('Verification Status: Certified Document Copy', {
    x: 70,
    y: 565,
    size: 11,
    font,
    color: rgb(0.1, 0.5, 0.2),
  });

  const p2 = doc.addPage([595.28, 841.89]);
  p2.drawText('Annexure II: Marks Verification & Credentials', {
    x: 50,
    y: 780,
    size: 16,
    font: boldFont,
    color: rgb(0.18, 0.24, 0.31),
  });
  p2.drawText('University Board Examination Transcript Summary', {
    x: 50,
    y: 740,
    size: 12,
    font,
  });
  p2.drawText('Semester 1: 82.4%  |  Semester 2: 85.1%  |  Semester 3: 88.0%', {
    x: 50,
    y: 700,
    size: 11,
    font,
  });
  p2.drawText('Overall Grade: Distinction (First Class with Honours)', {
    x: 50,
    y: 670,
    size: 11,
    font: boldFont,
    color: rgb(0.1, 0.5, 0.2),
  });

  return doc.save();
}
