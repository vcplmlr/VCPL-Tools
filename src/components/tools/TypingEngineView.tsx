import React, { useEffect, useRef, useState } from 'react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import mammoth from 'mammoth';
import {
  AlertTriangle,
  Award,
  Bold,
  Check,
  Copy,
  Download,
  FileText,
  Italic,
  Keyboard,
  List,
  ListOrdered,
  Printer,
  RefreshCw,
  RotateCcw,
  Timer,
  Underline,
  UploadCloud,
} from 'lucide-react';
import { ToolCatalogItem } from '../../types/tools';
import {
  downloadBomCsv,
  downloadExcelWorkbook,
  downloadJsonFile,
  downloadWordDocument,
  exportElementToPdf,
  exportStructuredReportPdf,
  printHtmlDocument,
  printTargetElement,
} from '../../utils/printReport';
import { FileDropZone } from './FileDropZone';
import { ToolExportBar } from './ToolExportBar';

interface TypingEngineViewProps {
  tool: ToolCatalogItem;
}

type TypingLanguage = 'english' | 'hindi' | 'kannada';

const TYPING_LANGUAGE_OPTIONS: Array<{
  key: TypingLanguage;
  label: string;
  shortLabel: string;
  benchmark: number;
  hint: string;
}> = [
  { key: 'english', label: 'English (35 WPM)', shortLabel: 'English', benchmark: 35, hint: 'SSC / Bank / Court' },
  { key: 'hindi', label: 'Hindi हिन्दी (30 WPM)', shortLabel: 'Hindi', benchmark: 30, hint: 'SSC / CPCT Devanagari' },
  { key: 'kannada', label: 'Kannada ಕನ್ನಡ (30 WPM)', shortLabel: 'Kannada', benchmark: 30, hint: 'KPSC / State Exam' },
];

const SAMPLE_PASSAGES = {
  english: [
    'The Union Public Service Commission conducts competitive examinations every year to recruit eligible citizens into civil and administrative services. Integrity, diligence, and conceptual clarity are essential virtues for every candidate aspiring to serve in public administration.',
    'Effective governance requires transparent institutions, accountable public servants, and equitable resource allocation. Digital platforms empower citizens by providing instant access to government notifications, certificates, and online application utilities without intermediaries.',
    'Technology has transformed recruitment across the country. Modern candidates prepare for competitive tests by solving mock quizzes, tracking typing speed, and verifying document dimensions in accordance with official notification guidelines.',
  ],
  kannada: [
    'ಕರ್ನಾಟಕ ಲೋಕಸೇವಾ ಆಯೋಗವು ರಾಜ್ಯದ ವಿವಿಧ ಇಲಾಖೆಗಳಲ್ಲಿ ಖಾಲಿ ಇರುವ ಹುದ್ದೆಗಳಿಗೆ ಅರ್ಹ ಅಭ್ಯರ್ಥಿಗಳನ್ನು ನೇಮಕ ಮಾಡಲು ಸ್ಪರ್ಧಾತ್ಮಕ ಪರೀಕ್ಷೆಗಳನ್ನು ನಡೆಸುತ್ತದೆ. ಶ್ರಮ ಮತ್ತು ಶ್ರದ್ಧೆಯಿಂದ ಅಭ್ಯಾಸ ಮಾಡಿದರೆ ಯಶಸ್ಸು ಖಂಡಿತ.',
    'ನಮ್ಮ ನಾಡು ನುಡಿ ಸಂಸ್ಕೃತಿಯು ಅತ್ಯಂತ ಶ್ರೀಮಂತವಾಗಿದೆ. ಕಲೆ, ಸಾಹಿತ್ಯ, ಶಿಲ್ಪಕಲೆ ಮತ್ತು ವಿಜ್ಞಾನ ಕ್ಷೇತ್ರದಲ್ಲಿ ಕನ್ನಡಿಗರ ಕೊಡುಗೆ ಅಪಾರ. ಕನ್ನಡ ಭಾಷೆಯಲ್ಲಿ ಟೈಪಿಂಗ್ ಕೌಶಲ್ಯ ಬೆಳೆಸಿಕೊಳ್ಳುವುದು ಸರ್ಕಾರಿ ಉದ್ಯೋಗಕ್ಕೆ ಅತ್ಯಂತ ಸಹಾಯಕ.',
    'ಡಿಜಿಟಲ್ ತಂತ್ರಜ್ಞಾನವು ನಾಗರಿಕರಿಗೆ ಸರ್ಕಾರಿ ಸೇವೆಗಳನ್ನು ಸುಲಭವಾಗಿ ಒದಗಿಸಲು ನೆರವಾಗುತ್ತಿದೆ. ಆನ್‌ಲೈನ್ ಅರ್ಜಿ ಸಲ್ಲಿಕೆ ಮತ್ತು ದಾಖಲೆಗಳ ಸಿದ್ಧತೆಯು ಪಾರದರ್ಶಕತೆಗೆ ಮುನ್ನುಡಿ ಬರೆದಿದೆ.',
  ],
  hindi: [
    'कर्मचारी चयन आयोग और संघ लोक सेवा आयोग द्वारा आयोजित प्रतियोगी परीक्षाओं में लाखों उम्मीदवार भाग लेते हैं। निरंतर अभ्यास, सही रणनीति और लगन से सफलता प्राप्त की जा सकती है।',
    'डिजिटल भारत अभियान ने सरकारी सेवाओं को आम नागरिक तक सुलभ बनाया है। ऑनलाइन आवेदन पत्र भरने के लिए फोटो, हस्ताक्षर और आवश्यक प्रमाण पत्रों की सही तैयारी बहुत महत्वपूर्ण है।',
    'हिंदी टंकण कौशल सरकारी कार्यालयों और अदालतों में अत्यंत उपयोगी है। नियमित अभ्यास से टंकण गति और सटीकता में उल्लेखनीय सुधार होता है।',
  ],
};

const KRUTI_TO_UNICODE: Record<string, string> = {
  k: 'ा', l: 'ी', h: 'ी', i: 'ि', f: 'ि',
  d: 'द', v: 'अ', b: 'इ', c: 'ब', x: 'ग', z: '्र',
  a: 'ं', s: 'े', w: 'ू', e: 'म', r: 'त', t: 'ज',
  y: 'ल', u: 'न', o: 'व', p: 'च', g: 'ह', j: 'र',
  n: 'द', m: 'स', q: 'फ',
  A: 'k', S: 's', D: 'd', F: 'f', G: 'g', H: 'h',
  J: 'j', K: 'k', L: 'l', Q: 'q', W: 'w', E: 'e',
  R: 'r', T: 't', Y: 'y', U: 'u', I: 'i', O: 'o',
  P: 'p', Z: 'z', X: 'x', C: 'c', V: 'v', B: 'b',
  N: 'n', M: 'm',
};

const RESUME_BUZZWORDS = [
  'synergy', 'hardworking', 'go-getter', 'team player', 'detail-oriented',
  'think outside the box', 'self-motivated', 'results-driven', 'proven track record',
  'passionate', 'rockstar', 'guru', 'ninja',
];

export const TypingEngineView: React.FC<TypingEngineViewProps> = ({ tool }) => {
  const [copied, setCopied] = useState<boolean>(false);

  const copyToClipboard = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const initialLang: TypingLanguage = tool.id.includes('kannada')
    ? 'kannada'
    : tool.id.includes('hindi')
      ? 'hindi'
      : 'english';

  const [selectedLang, setSelectedLang] = useState<TypingLanguage>(initialLang);
  const isKannada = selectedLang === 'kannada';
  const isHindi = selectedLang === 'hindi';
  const langKey = selectedLang;

  const [passageIndex, setPassageIndex] = useState(0);
  const [useCustomPassage, setUseCustomPassage] = useState(false);
  const [customPassageText, setCustomPassageText] = useState('');
  const passages = SAMPLE_PASSAGES[langKey];
  const targetText =
    useCustomPassage && customPassageText.trim()
      ? customPassageText.trim()
      : passages[passageIndex % passages.length];

  const [userInput, setUserInput] = useState('');
  const [timerDuration, setTimerDuration] = useState<number>(60);
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [textInput, setTextInput] = useState<string>('');
  const [unicodeOutput, setUnicodeOutput] = useState<string>('');
  const [pdfTitle, setPdfTitle] = useState<string>('');
  const [pdfFontSize, setPdfFontSize] = useState<number>(11);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  // Kruti/Nudi converter script mode
  const [unicodeScript, setUnicodeScript] = useState<'hindi' | 'kannada'>('hindi');

  // Rich Text Studio & Print refs state
  const richEditorRef = useRef<HTMLDivElement | null>(null);
  const typingCertRef = useRef<HTMLDivElement | null>(null);
  const docxPrintRef = useRef<HTMLDivElement | null>(null);
  const resumePrintRef = useRef<HTMLDivElement | null>(null);
  const [richPlainText, setRichPlainText] = useState<string>('');

  // DOCX Viewer state
  const [docxFileName, setDocxFileName] = useState<string>('');
  const [docxHtml, setDocxHtml] = useState<string>('');
  const [docxRawText, setDocxRawText] = useState<string>('');
  const [docxError, setDocxError] = useState<string>('');

  // Text Sorter & Deduper state
  const [sorterInput, setSorterInput] = useState<string>('');
  const [linePrefix, setLinePrefix] = useState<string>('');
  const [lineSuffix, setLineSuffix] = useState<string>('');

  // Case Converter Find & Replace state
  const [findTerm, setFindTerm] = useState<string>('');
  const [replaceTerm, setReplaceTerm] = useState<string>('');

  // ATS Resume / Letter Builder state
  const [resumeName, setResumeName] = useState<string>('');
  const [resumeRole, setResumeRole] = useState<string>('');
  const [resumeContact, setResumeContact] = useState<string>('');
  const [resumeSummary, setResumeSummary] = useState<string>('');
  const [resumeExperience, setResumeExperience] = useState<string>('');
  const [resumeSkills, setResumeSkills] = useState<string>('');
  const [docTemplateType, setDocTemplateType] = useState<'resume' | 'cover' | 'resignation'>('resume');

  useEffect(() => {
    const nextLang: TypingLanguage = tool.id.includes('kannada')
      ? 'kannada'
      : tool.id.includes('hindi')
        ? 'hindi'
        : 'english';
    setSelectedLang(nextLang);
    setUserInput('');
    setIsActive(false);
    setIsFinished(false);
    setTimeLeft(60);
    setTimerDuration(60);
    setPassageIndex(0);
    setUnicodeOutput('');
    setDocxError('');
  }, [tool.id]);

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          setIsActive(false);
          setIsFinished(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isActive]);

  const handleTypingChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (!isActive && !isFinished) setIsActive(true);
    setUserInput(val);
    if (val.length >= targetText.length) {
      setIsActive(false);
      setIsFinished(true);
    }
  };

  const restartTest = () => {
    setUserInput('');
    setTimeLeft(timerDuration);
    setIsActive(false);
    setIsFinished(false);
    if (inputRef.current) inputRef.current.focus();
  };

  const handleLanguageSwitch = (lang: TypingLanguage) => {
    setSelectedLang(lang);
    setUseCustomPassage(false);
    setPassageIndex(0);
    setUserInput('');
    setTimeLeft(timerDuration);
    setIsActive(false);
    setIsFinished(false);
    if (inputRef.current) inputRef.current.focus();
  };

  const handleResetAllSubTools = () => {
    setUserInput('');
    setIsActive(false);
    setIsFinished(false);
    setTimeLeft(timerDuration);
    setUseCustomPassage(false);
    setCustomPassageText('');
    setTextInput('');
    setUnicodeOutput('');
    setPdfTitle('');
    setFindTerm('');
    setReplaceTerm('');
    setRichPlainText('');
    if (richEditorRef.current) richEditorRef.current.innerHTML = '';
    setDocxFileName('');
    setDocxHtml('');
    setDocxRawText('');
    setDocxError('');
    setSorterInput('');
    setLinePrefix('');
    setLineSuffix('');
    setResumeName('');
    setResumeRole('');
    setResumeContact('');
    setResumeSummary('');
    setResumeExperience('');
    setResumeSkills('');
  };

  const elapsedSeconds = Math.max(1, timerDuration - timeLeft);
  const elapsedMinutes = Math.max(0.05, elapsedSeconds / 60);

  let errorCount = 0;
  for (let i = 0; i < userInput.length; i++) {
    if (userInput[i] !== targetText[i]) errorCount++;
  }

  const grossWpm = Math.round(userInput.length / 5 / elapsedMinutes);
  const netWpm = Math.max(0, Math.round((userInput.length / 5 - errorCount) / elapsedMinutes));
  const accuracy =
    userInput.length > 0
      ? Math.max(0, Math.round(((userInput.length - errorCount) / userInput.length) * 100))
      : 100;
  const kdph = Math.round((userInput.length / elapsedSeconds) * 3600);

  const requiredSpeed = isKannada || isHindi ? 30 : 35;
  const isExamQualified = netWpm >= requiredSpeed && accuracy >= 90;

  const words = textInput.trim().split(/\s+/).filter(Boolean);
  const wordCount = textInput.trim() ? words.length : 0;
  const charCountWithSpaces = textInput.length;
  const charCountNoSpaces = textInput.replace(/\s+/g, '').length;
  const sentenceCount = textInput.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;
  const paragraphCount = textInput.split(/\n+/).filter((p) => p.trim().length > 0).length;
  const readingTimeMin = (wordCount / 200).toFixed(1);
  const speakingTimeMin = (wordCount / 130).toFixed(1);

  const handleCaseTransform = (
    type: 'upper' | 'lower' | 'title' | 'sentence' | 'camel' | 'snake' | 'kebab' | 'clean-spaces'
  ) => {
    let res = '';
    if (type === 'upper') res = textInput.toUpperCase();
    else if (type === 'lower') res = textInput.toLowerCase();
    else if (type === 'title') res = textInput.replace(/\b\w/g, (c) => c.toUpperCase());
    else if (type === 'sentence')
      res = textInput.toLowerCase().replace(/(^\s*\w|[.!?]\s*\w)/g, (c) => c.toUpperCase());
    else if (type === 'camel') {
      res = textInput
        .replace(/[^a-zA-Z0-9 ]/g, '')
        .split(' ')
        .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
        .join('');
    } else if (type === 'snake') res = textInput.trim().toLowerCase().replace(/[^a-zA-Z0-9]+/g, '_');
    else if (type === 'kebab') res = textInput.trim().toLowerCase().replace(/[^a-zA-Z0-9]+/g, '-');
    else if (type === 'clean-spaces')
      res = textInput.replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n\n').trim();
    setTextInput(res);
  };

  const handleUnicodeConvert = () => {
    const activeScript = tool.id === 'kruti-nudi-unicode' ? unicodeScript : isHindi ? 'hindi' : 'kannada';
    if (activeScript === 'hindi') {
      let out = '';
      for (let i = 0; i < textInput.length; i++) {
        out += KRUTI_TO_UNICODE[textInput[i]] || textInput[i];
      }
      setUnicodeOutput(out);
    } else if (activeScript === 'kannada') {
      const nudiMap: Record<string, string> = {
        'PÀ': 'ಕ', 'PÁ': 'ಕಾ', Q: 'ಕಿ', 'QÃ': 'ಕೀ',
        '£Á': 'ನಾ', ß: '್ನ', l: 'ಟ', 'PÀ£ÁßlPÀ': 'ಕರ್ನಾಟಕ',
      };
      let out = textInput;
      Object.keys(nudiMap)
        .sort((a, b) => b.length - a.length)
        .forEach((key) => {
          out = out.split(key).join(nudiMap[key]);
        });
      setUnicodeOutput(out);
    } else {
      setUnicodeOutput(textInput);
    }
  };

  const sanitizeWinAnsi = (str: string) =>
    str
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/₹/g, 'Rs.')
      .replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');

  const handleExportTextToPdf = async () => {
    try {
      setIsExportingPdf(true);
      const pdfDoc = await PDFDocument.create();
      const hasNonWinAnsi = /[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/.test(pdfTitle + textInput);

      if (hasNonWinAnsi) {
        const scale = 2;
        const pageW = 595 * scale;
        const pageH = 842 * scale;
        const margin = 50 * scale;
        const maxTextW = pageW - margin * 2;
        const lineHeight = (pdfFontSize + 6) * scale;

        const createCanvasPage = (includeHeader: boolean) => {
          const canvas = document.createElement('canvas');
          canvas.width = pageW;
          canvas.height = pageH;
          const ctx = canvas.getContext('2d')!;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, pageW, pageH);
          let curY = margin;
          if (includeHeader) {
            ctx.fillStyle = '#1e293b';
            ctx.font = `bold ${15 * scale}px sans-serif`;
            ctx.fillText(pdfTitle || 'Document', margin, curY + 14 * scale);
            curY += 26 * scale;
            ctx.strokeStyle = '#cbd5e1';
            ctx.lineWidth = scale;
            ctx.beginPath();
            ctx.moveTo(margin, curY);
            ctx.lineTo(pageW - margin, curY);
            ctx.stroke();
            curY += 24 * scale;
          }
          ctx.fillStyle = '#1e293b';
          ctx.font = `${pdfFontSize * scale}px sans-serif`;
          return { canvas, ctx, curY };
        };

        let { canvas, ctx, curY } = createCanvasPage(true);
        const pages: HTMLCanvasElement[] = [canvas];

        const wrapTextLines = (raw: string) => {
          const wrapped: string[] = [];
          for (const para of raw.split('\n')) {
            if (!para.trim()) {
              wrapped.push('');
              continue;
            }
            let line = '';
            for (const word of para.split(' ')) {
              const test = line ? `${line} ${word}` : word;
              if (ctx.measureText(test).width > maxTextW && line) {
                wrapped.push(line);
                line = word;
              } else {
                line = test;
              }
            }
            if (line) wrapped.push(line);
          }
          return wrapped;
        };

        for (const l of wrapTextLines(textInput)) {
          if (curY > pageH - margin) {
            const next = createCanvasPage(false);
            canvas = next.canvas;
            ctx = next.ctx;
            curY = next.curY;
            pages.push(canvas);
          }
          if (l) ctx.fillText(l, margin, curY);
          curY += lineHeight;
        }

        for (const pCanvas of pages) {
          const dataUrl = pCanvas.toDataURL('image/png');
          const bytes = await fetch(dataUrl).then((r) => r.arrayBuffer());
          const img = await pdfDoc.embedPng(bytes);
          const page = pdfDoc.addPage([595.28, 841.89]);
          page.drawImage(img, { x: 0, y: 0, width: 595.28, height: 841.89 });
        }
      } else {
        let page = pdfDoc.addPage([595.28, 841.89]);
        const { width, height } = page.getSize();
        const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const maxWidth = width - 100;
        let y = height - 50;

        page.drawText(sanitizeWinAnsi(pdfTitle || 'Document'), {
          x: 50,
          y,
          size: 14,
          font: fontBold,
          color: rgb(0.18, 0.24, 0.31),
        });
        y -= 14;
        page.drawLine({
          start: { x: 50, y },
          end: { x: 545, y },
          thickness: 0.75,
          color: rgb(0.8, 0.8, 0.8),
        });
        y -= 25;

        for (const rawLine of textInput.split('\n')) {
          const line = sanitizeWinAnsi(rawLine);
          if (!line.trim()) {
            y -= 12;
            if (y < 55) {
              page = pdfDoc.addPage([595.28, 841.89]);
              y = height - 50;
            }
            continue;
          }
          let currentBuffer = '';
          for (const w of line.split(' ')) {
            const candidate = currentBuffer ? `${currentBuffer} ${w}` : w;
            if (fontRegular.widthOfTextAtSize(candidate, pdfFontSize) > maxWidth && currentBuffer) {
              if (y < 55) {
                page = pdfDoc.addPage([595.28, 841.89]);
                y = height - 50;
              }
              page.drawText(currentBuffer, {
                x: 50,
                y,
                size: pdfFontSize,
                font: fontRegular,
                color: rgb(0.15, 0.15, 0.15),
              });
              y -= pdfFontSize + 5;
              currentBuffer = w;
            } else {
              currentBuffer = candidate;
            }
          }
          if (currentBuffer) {
            if (y < 55) {
              page = pdfDoc.addPage([595.28, 841.89]);
              y = height - 50;
            }
            page.drawText(currentBuffer, {
              x: 50,
              y,
              size: pdfFontSize,
              font: fontRegular,
              color: rgb(0.15, 0.15, 0.15),
            });
            y -= pdfFontSize + 7;
          }
        }
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${(pdfTitle || 'document').replace(/\s+/g, '_')}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const isTypingTest =
    tool.id === 'multilingual-typing-test' ||
    tool.id.includes('typing-practice') ||
    tool.id.includes('typing-speed-test');
  const isUnicodeConverter =
    tool.id.includes('unicode-converter') || tool.id === 'kruti-nudi-unicode';
  const isTextToPdf = tool.id === 'text-to-pdf' || tool.id === 'txt-to-pdf';
  const isRichTextStudio = tool.id === 'rich-text-studio';
  const isDocxViewer = tool.id === 'docx-viewer';
  const isTextSorter = tool.id === 'text-sorter-deduper';
  const isResumeBuilder = tool.id === 'resume-ats-builder';
  const isCaseConverter =
    tool.id === 'case-converter' ||
    tool.id === 'text-case-converter' ||
    tool.id === 'remove-extra-spaces';
  const isResumeChecker =
    tool.id === 'resume-spell-checker' || tool.id === 'resume-word-counter';

  const foundBuzzwords = RESUME_BUZZWORDS.filter((w) =>
    new RegExp(`\\b${w}\\b`, 'i').test(isResumeBuilder ? `${resumeSummary} ${resumeExperience}` : textInput)
  );

  const exportLinesToDocx = async (lines: string[], filename: string) => {
    const doc = new Document({
      sections: [
        {
          children: lines.map(
            (line) =>
              new Paragraph({
                children: [new TextRun({ text: line, size: 22 })],
              })
          ),
        },
      ],
    });
    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleSortTransform = (
    op: 'az' | 'za' | 'length' | 'numeric' | 'reverse' | 'dedupe' | 'trim' | 'empty' | 'number' | 'affix'
  ) => {
    let lines = sorterInput.split('\n');
    if (op === 'az') lines.sort((a, b) => a.localeCompare(b));
    else if (op === 'za') lines.sort((a, b) => b.localeCompare(a));
    else if (op === 'length') lines.sort((a, b) => a.length - b.length);
    else if (op === 'numeric') lines.sort((a, b) => parseFloat(a) - parseFloat(b));
    else if (op === 'reverse') lines.reverse();
    else if (op === 'dedupe') lines = Array.from(new Set(lines));
    else if (op === 'trim') lines = lines.map((l) => l.trim().replace(/\s+/g, ' '));
    else if (op === 'empty') lines = lines.filter((l) => l.trim().length > 0);
    else if (op === 'number') lines = lines.map((l, i) => `${i + 1}. ${l}`);
    else if (op === 'affix') lines = lines.map((l) => `${linePrefix}${l}${lineSuffix}`);
    setSorterInput(lines.join('\n'));
  };

  return (
    <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-[#2F3E4E]/15 no-print">
        <div>
          <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider flex items-center gap-1.5">
            <Keyboard className="w-3.5 h-3.5 text-[#2F3E4E]" />
            {tool.categoryName} · {tool.code}
          </span>
          <h1 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] mt-1 tracking-tight">
            {tool.title}
          </h1>
          <p className="text-xs sm:text-sm text-[#475569] mt-0.5">{tool.description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleResetAllSubTools}
            className="px-3.5 py-2 border-[1.5px] border-[#2F3E4E] bg-[#FFE1B3] hover:bg-[#F9C80E] rounded-xl text-xs font-bold text-[#2F3E4E] flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Clear / Reset
          </button>
          <button
            type="button"
            onClick={() =>
              copyToClipboard(
                isUnicodeConverter ? unicodeOutput || textInput : isTypingTest ? targetText : textInput
              )
            }
            className="px-3.5 py-2 border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] rounded-xl text-xs font-bold text-[#2F3E4E] flex items-center gap-1.5 cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy Text'}
          </button>
        </div>
      </div>

      {isTypingTest && (
        <div className="space-y-5">
          {/* Unified Language Selector: English · Hindi · Kannada */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border-[1.5px] border-[#2F3E4E] no-print">
            <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Select typing language">
              <span className="text-xs font-bold text-[#475569] mr-1">Language:</span>
              {TYPING_LANGUAGE_OPTIONS.map((opt) => {
                const active = selectedLang === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => handleLanguageSwitch(opt.key)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border border-[#2F3E4E] transition cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-[#2F3E4E] text-[#FFFDF5]'
                        : 'bg-[#FEF2C8]/65 text-[#2F3E4E] hover:bg-[#F9C80E]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <span className="text-[11px] font-semibold text-[#475569] tabular-nums">
              Target: {requiredSpeed} WPM · 90%+ Accuracy
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#FEF2C8]/75 p-3.5 rounded-xl border-[1.5px] border-[#2F3E4E] text-xs no-print">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[#475569] font-bold">Duration:</span>
              {[60, 120, 300, 600].map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => {
                    setTimerDuration(sec);
                    setUserInput('');
                    setTimeLeft(sec);
                    setIsActive(false);
                    setIsFinished(false);
                  }}
                  className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer border border-[#2F3E4E] transition ${
                    timerDuration === sec
                      ? 'bg-[#2F3E4E] text-[#FFFDF5]'
                      : 'bg-white text-[#2F3E4E] hover:bg-[#F9C80E]'
                  }`}
                >
                  {sec === 60 ? '1 Min' : sec === 120 ? '2 Min' : sec === 300 ? '5 Min' : '10 Min'}
                </button>
              ))}
              <span className="text-[#64748B] mx-1">|</span>
              <span className="text-[#475569] font-bold">Passage:</span>
              {passages.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setUseCustomPassage(false);
                    setPassageIndex(idx);
                    restartTest();
                  }}
                  className={`px-2.5 py-1.5 rounded-lg font-bold cursor-pointer border border-[#2F3E4E] transition ${
                    !useCustomPassage && passageIndex === idx
                      ? 'bg-[#F9C80E] text-[#2F3E4E]'
                      : 'bg-white text-[#2F3E4E] hover:bg-[#FEF2C8]'
                  }`}
                >
                  #{idx + 1}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setUseCustomPassage((v) => !v);
                  restartTest();
                }}
                className={`px-2.5 py-1.5 rounded-lg font-bold cursor-pointer border border-[#2F3E4E] transition ${
                  useCustomPassage
                    ? 'bg-[#2F3E4E] text-[#F9C80E]'
                    : 'bg-white text-[#2F3E4E] hover:bg-[#FEF2C8]'
                }`}
              >
                Custom Passage
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 font-mono tabular-nums text-base font-bold text-[#2F3E4E]">
                <Timer className="w-4 h-4" />
                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </div>
              <button
                type="button"
                onClick={restartTest}
                className="px-3 py-1.5 bg-white hover:bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] rounded-lg font-bold flex items-center gap-1 cursor-pointer text-[#2F3E4E]"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Restart
              </button>
            </div>
          </div>

          {useCustomPassage && (
            <div className="p-3.5 bg-white border-[1.5px] border-[#2F3E4E] rounded-xl space-y-2 no-print">
              <div className="flex items-center justify-between gap-2 text-xs font-bold text-[#2F3E4E]">
                <span>Paste Your Custom Practice Passage</span>
                {customPassageText && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomPassageText('');
                      restartTest();
                    }}
                    className="px-2.5 py-1 rounded-md border border-[#2F3E4E] bg-[#FFE1B3] text-[11px] font-bold cursor-pointer"
                  >
                    Clear Custom Text
                  </button>
                )}
              </div>
              <textarea
                rows={3}
                value={customPassageText}
                onChange={(e) => {
                  setCustomPassageText(e.target.value);
                  setUserInput('');
                  setIsActive(false);
                  setIsFinished(false);
                  setTimeLeft(timerDuration);
                }}
                placeholder="Paste any legal, editorial, or exam passage here to practice typing it cleanly..."
                className="w-full p-2.5 rounded-lg border border-[#2F3E4E]/35 bg-[#FFFDF5] text-xs font-sans"
              />
            </div>
          )}

          <div
            className={`p-5 bg-white border-[1.5px] border-[#2F3E4E] rounded-2xl text-sm sm:text-[15px] leading-relaxed tracking-wide select-none no-print ${
              selectedLang === 'english' ? 'font-mono' : 'font-sans'
            }`}
          >
            {targetText.split('').map((char, index) => {
              let colorClass = 'text-[#64748B]';
              if (index < userInput.length) {
                colorClass =
                  userInput[index] === char
                    ? 'text-emerald-800 font-bold bg-[#CEE5DC]/75 rounded-xs'
                    : 'text-red-700 font-bold bg-red-100 rounded-xs underline';
              } else if (index === userInput.length) {
                colorClass = 'bg-[#F9C80E] text-[#2F3E4E] underline decoration-2 rounded-xs font-bold';
              }
              return (
                <span key={index} className={colorClass}>
                  {char}
                </span>
              );
            })}
          </div>

          <textarea
            ref={inputRef}
            rows={4}
            value={userInput}
            onChange={handleTypingChange}
            disabled={isFinished}
            placeholder={
              isFinished
                ? 'Test completed! View your performance scorecard below.'
                : selectedLang === 'hindi'
                  ? 'यहाँ क्लिक करें और हिंदी (Devanagari) टाइपिंग शुरू करें...'
                  : selectedLang === 'kannada'
                    ? 'ಇಲ್ಲಿ ಕ್ಲಿಕ್ ಮಾಡಿ ಮತ್ತು ಕನ್ನಡ ಟೈಪಿಂಗ್ ಪ್ರಾರಂಭಿಸಿ...'
                    : 'Click here and begin typing to start timer...'
            }
            className={`w-full p-4 border-[1.5px] border-[#2F3E4E] rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F9C80E] bg-white leading-relaxed no-print ${
              selectedLang === 'english' ? 'font-mono' : 'font-sans'
            }`}
          />

          <div className="p-5 bg-[#FEF2C8]/65 border-[1.5px] border-[#2F3E4E] rounded-2xl grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
            <div>
              <span className="text-[11px] text-[#64748B] uppercase block font-bold">Gross WPM</span>
              <div className="text-2xl font-bold font-mono tabular-nums text-[#2F3E4E] mt-0.5">{grossWpm}</div>
            </div>
            <div>
              <span className="text-[11px] text-[#2F3E4E] uppercase block font-extrabold">Net WPM</span>
              <div className="text-3xl font-extrabold font-mono tabular-nums text-[#2F3E4E] mt-0.5">{netWpm}</div>
            </div>
            <div>
              <span className="text-[11px] text-[#64748B] uppercase block font-bold">Accuracy</span>
              <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-0.5">{accuracy}%</div>
            </div>
            <div>
              <span className="text-[11px] text-[#64748B] uppercase block font-bold">Errors</span>
              <div className="text-2xl font-bold font-mono tabular-nums text-red-700 mt-0.5">{errorCount}</div>
            </div>
            <div>
              <span className="text-[11px] text-[#64748B] uppercase block font-bold">KDPH</span>
              <div className="text-2xl font-bold font-mono tabular-nums text-[#2F3E4E] mt-0.5">{kdph}</div>
            </div>
          </div>

          {isFinished && (
            <div
              ref={typingCertRef}
              className="p-6 bg-[#CEE5DC]/65 border-[1.5px] border-[#2F3E4E] rounded-2xl text-center space-y-4"
            >
              <div className="inline-flex p-3 bg-[#2F3E4E] text-[#F9C80E] rounded-full">
                <Award className="w-8 h-8" />
              </div>

              <div>
                <span className="text-xs font-bold text-[#2F3E4E] uppercase tracking-widest block">
                  VCPL Tools · Skill Test Performance Report
                </span>
                <h3 className="text-xl font-display font-extrabold text-[#2F3E4E] mt-1">
                  Speed: {netWpm} Net WPM | Accuracy: {accuracy}%
                </h3>
                <p className="text-xs text-[#475569] mt-1 font-mono tabular-nums">
                  Duration: {timerDuration} Seconds · Key Depressions Per Hour: {kdph} KDPH
                </p>
              </div>

              <div
                className={`inline-block px-4 py-1.5 rounded-lg text-xs font-bold border border-[#2F3E4E] ${
                  isExamQualified ? 'bg-[#FFFDF5] text-emerald-800' : 'bg-[#FEF2C8] text-[#2F3E4E]'
                }`}
              >
                {isExamQualified
                  ? `Qualified for Central / State Clerical Recruitment (Benchmark: ${requiredSpeed} WPM)`
                  : `Needs Practice: Target is ${requiredSpeed} WPM with 90%+ Accuracy`}
              </div>

              <div className="pt-2 flex flex-wrap justify-center gap-3 no-print">
                <button
                  type="button"
                  onClick={() => {
                    void printTargetElement({
                      element: typingCertRef.current,
                      title: 'Typing_Skill_Test_Certificate',
                      prepareClone: (clone) => {
                        clone.style.margin = '14mm auto';
                        clone.style.maxWidth = '560px';
                      },
                    });
                  }}
                  className="px-4 py-2 bg-[#2F3E4E] hover:bg-[#1E293B] text-[#FFFDF5] text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> Print Certificate
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void exportElementToPdf({
                      element: typingCertRef.current,
                      filename: 'Typing_Skill_Test_Certificate.pdf',
                      backgroundColor: '#CEE5DC',
                    });
                  }}
                  className="px-4 py-2 bg-[#F9C80E] hover:bg-[#FFE1B3] border-[1.5px] border-[#2F3E4E] text-[#2F3E4E] text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Save PDF
                </button>
                <button
                  type="button"
                  onClick={restartTest}
                  className="px-4 py-2 bg-white border-[1.5px] border-[#2F3E4E] hover:bg-[#FEF2C8] text-[#2F3E4E] text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {isUnicodeConverter && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#FEF2C8]/75 rounded-xl border-[1.5px] border-[#2F3E4E]/30 text-xs text-[#2F3E4E]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold">Source Script:</span>
              <button
                type="button"
                onClick={() => setUnicodeScript('hindi')}
                className={`px-3 py-1 rounded-lg border border-[#2F3E4E] font-bold cursor-pointer ${
                  unicodeScript === 'hindi' ? 'bg-[#2F3E4E] text-[#FFFDF5]' : 'bg-white text-[#2F3E4E]'
                }`}
              >
                Hindi (Kruti Dev 010 → Mangal)
              </button>
              <button
                type="button"
                onClick={() => setUnicodeScript('kannada')}
                className={`px-3 py-1 rounded-lg border border-[#2F3E4E] font-bold cursor-pointer ${
                  unicodeScript === 'kannada' ? 'bg-[#2F3E4E] text-[#FFFDF5]' : 'bg-white text-[#2F3E4E]'
                }`}
              >
                Kannada (Nudi / Baraha → UTF-8)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#2F3E4E] uppercase mb-1.5">
                Legacy Font Text (Paste Here)
              </label>
              <textarea
                rows={8}
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={isHindi ? 'Paste Kruti Dev text...' : 'Paste Nudi text...'}
                className="w-full p-3.5 border-[1.5px] border-[#2F3E4E] rounded-xl text-xs font-mono bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#2F3E4E] uppercase mb-1.5">
                Converted Universal Unicode (UTF-8)
              </label>
              <textarea
                rows={8}
                readOnly
                value={unicodeOutput}
                placeholder="Click 'Convert to Unicode Now' to view UTF-8 output..."
                className="w-full p-3.5 border-[1.5px] border-[#2F3E4E] rounded-xl text-xs font-sans bg-white leading-relaxed text-[#2F3E4E]"
              />
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={handleUnicodeConvert}
              className="px-5 py-2.5 bg-[#2F3E4E] hover:bg-[#1E293B] text-[#FFFDF5] rounded-xl text-xs font-bold cursor-pointer"
            >
              Convert to Unicode Now
            </button>
          </div>
          <ToolExportBar
            onClear={() => {
              setTextInput('');
              setUnicodeOutput('');
            }}
            onCopy={() => copyToClipboard(unicodeOutput || textInput)}
            copied={copied}
            onWord={() => void exportLinesToDocx((unicodeOutput || textInput).split('\n'), 'unicode-converted.docx')}
            onJson={() => downloadJsonFile({ script: unicodeScript, legacyText: textInput, unicodeOutput }, 'unicode-converted.json')}
            onPdf={() =>
              void exportStructuredReportPdf({
                title: 'Unicode Conversion Output',
                sections: [{ title: unicodeScript.toUpperCase(), paragraphs: (unicodeOutput || textInput).split('\n').filter(Boolean) }],
                filename: 'unicode-converted.pdf',
              })
            }
            disabled={!(unicodeOutput || textInput).trim()}
          />
        </div>
      )}

      {isCaseConverter && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'UPPERCASE', type: 'upper' },
              { label: 'lowercase', type: 'lower' },
              { label: 'Title Case', type: 'title' },
              { label: 'Sentence case', type: 'sentence' },
              { label: 'camelCase', type: 'camel' },
              { label: 'snake_case', type: 'snake' },
              { label: 'kebab-case', type: 'kebab' },
              { label: 'Strip Extra Spaces', type: 'clean-spaces' },
            ].map((btn) => (
              <button
                key={btn.type}
                type="button"
                onClick={() =>
                  handleCaseTransform(
                    btn.type as
                      | 'upper' | 'lower' | 'title' | 'sentence'
                      | 'camel' | 'snake' | 'kebab' | 'clean-spaces'
                  )
                }
                className="px-3.5 py-2 bg-white hover:bg-[#F9C80E] text-[#2F3E4E] rounded-lg text-xs font-bold cursor-pointer border-[1.5px] border-[#2F3E4E] transition"
              >
                {btn.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center bg-[#FEF2C8]/65 p-3 rounded-xl border border-[#2F3E4E]/30 text-xs">
            <input
              type="text"
              value={findTerm}
              onChange={(e) => setFindTerm(e.target.value)}
              placeholder="Find text..."
              className="px-3 py-1.5 rounded-lg border border-[#2F3E4E] bg-white font-mono"
            />
            <input
              type="text"
              value={replaceTerm}
              onChange={(e) => setReplaceTerm(e.target.value)}
              placeholder="Replace with..."
              className="px-3 py-1.5 rounded-lg border border-[#2F3E4E] bg-white font-mono"
            />
            <button
              type="button"
              disabled={!findTerm}
              onClick={() => {
                if (!findTerm) return;
                setTextInput((prev) => prev.split(findTerm).join(replaceTerm));
              }}
              className="px-3 py-1.5 rounded-lg bg-[#2F3E4E] text-[#FFFDF5] font-bold cursor-pointer disabled:opacity-45"
            >
              Replace All
            </button>
            <button
              type="button"
              onClick={() => {
                setFindTerm('');
                setReplaceTerm('');
              }}
              className="px-3 py-1.5 rounded-lg border border-[#2F3E4E] bg-white text-[#2F3E4E] font-bold cursor-pointer"
            >
              Clear Find/Replace
            </button>
          </div>

          <textarea
            rows={8}
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Type or paste text to transform case or strip extra spaces..."
            className="w-full p-4 border-[1.5px] border-[#2F3E4E] rounded-xl text-sm leading-relaxed font-sans bg-white"
          />

          <div className="flex flex-wrap justify-between items-center gap-3 text-xs font-semibold text-[#475569]">
            <span className="font-mono tabular-nums">
              Words: {wordCount} | Characters: {charCountWithSpaces} | Paragraphs: {paragraphCount}
            </span>
          </div>
          <ToolExportBar
            onClear={() => setTextInput('')}
            onCopy={() => copyToClipboard(textInput)}
            copied={copied}
            onWord={() => void exportLinesToDocx(textInput.split('\n'), 'transformed-text.docx')}
            onJson={() => downloadJsonFile({ wordCount, charCountWithSpaces, charCountNoSpaces, text: textInput }, 'transformed-text.json')}
            disabled={!textInput.trim()}
          />
        </div>
      )}

      {isTextToPdf && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-[#2F3E4E] uppercase mb-1">
                Document Header Title
              </label>
              <input
                type="text"
                value={pdfTitle}
                onChange={(e) => setPdfTitle(e.target.value)}
                placeholder="e.g. Official Study Notes & Memorandum"
                className="w-full px-3.5 py-2 bg-white border-[1.5px] border-[#2F3E4E] rounded-xl text-xs font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#2F3E4E] uppercase mb-1">
                Font Size ({pdfFontSize}pt)
              </label>
              <select
                value={pdfFontSize}
                onChange={(e) => setPdfFontSize(Number(e.target.value))}
                className="w-full px-3.5 py-2 bg-white border-[1.5px] border-[#2F3E4E] rounded-xl text-xs font-semibold"
              >
                <option value={10}>10 pt (Compact)</option>
                <option value={11}>11 pt (Standard A4)</option>
                <option value={12}>12 pt (Large)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#2F3E4E] uppercase mb-1">
              Document Content (Supports English &amp; Unicode Indic Scripts)
            </label>
            <textarea
              rows={10}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Paste or type document text here to generate a clean A4 PDF or Word file..."
              className="w-full p-4 border-[1.5px] border-[#2F3E4E] rounded-xl text-sm leading-relaxed bg-white font-sans"
            />
          </div>

          <ToolExportBar
            onClear={() => {
              setPdfTitle('');
              setTextInput('');
            }}
            onCopy={() => copyToClipboard(textInput)}
            copied={copied}
            onWord={() => void exportLinesToDocx([pdfTitle || 'Document', '', ...textInput.split('\n')], `${(pdfTitle || 'document').replace(/\s+/g, '_')}.docx`)}
            onJson={() => downloadJsonFile({ title: pdfTitle, fontSize: pdfFontSize, text: textInput }, `${(pdfTitle || 'document').replace(/\s+/g, '_')}.json`)}
            onPdf={() => void handleExportTextToPdf()}
            onPrint={() => void printHtmlDocument({ title: pdfTitle || 'Document', bodyHtml: `<h1>${pdfTitle || 'Document'}</h1><pre style="white-space:pre-wrap;font-family:sans-serif;">${textInput.replace(/</g, '&lt;')}</pre>` })}
            disabled={isExportingPdf || !textInput.trim()}
          />
        </div>
      )}

      {isRichTextStudio && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-1.5 p-2.5 bg-[#FEF2C8]/75 border-[1.5px] border-[#2F3E4E] rounded-xl">
            <button type="button" onClick={() => document.execCommand('bold')} className="p-2 rounded-lg bg-white border border-[#2F3E4E]/40 hover:bg-[#F9C80E] cursor-pointer" title="Bold"><Bold className="w-3.5 h-3.5" /></button>
            <button type="button" onClick={() => document.execCommand('italic')} className="p-2 rounded-lg bg-white border border-[#2F3E4E]/40 hover:bg-[#F9C80E] cursor-pointer" title="Italic"><Italic className="w-3.5 h-3.5" /></button>
            <button type="button" onClick={() => document.execCommand('underline')} className="p-2 rounded-lg bg-white border border-[#2F3E4E]/40 hover:bg-[#F9C80E] cursor-pointer" title="Underline"><Underline className="w-3.5 h-3.5" /></button>
            <button type="button" onClick={() => document.execCommand('formatBlock', false, 'h2')} className="px-2.5 py-1.5 rounded-lg bg-white border border-[#2F3E4E]/40 hover:bg-[#F9C80E] text-xs font-bold cursor-pointer">H2</button>
            <button type="button" onClick={() => document.execCommand('insertUnorderedList')} className="p-2 rounded-lg bg-white border border-[#2F3E4E]/40 hover:bg-[#F9C80E] cursor-pointer" title="Bullets"><List className="w-3.5 h-3.5" /></button>
            <button type="button" onClick={() => document.execCommand('insertOrderedList')} className="p-2 rounded-lg bg-white border border-[#2F3E4E]/40 hover:bg-[#F9C80E] cursor-pointer" title="Numbered"><ListOrdered className="w-3.5 h-3.5" /></button>
          </div>
          <div
            ref={richEditorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={(e) => setRichPlainText(e.currentTarget.innerText || '')}
            aria-label="Rich Text Document Editor"
            className="min-h-[260px] p-5 bg-white border-[1.5px] border-[#2F3E4E] rounded-xl text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
          />
          <div className="text-xs">
            <span className="font-mono font-bold text-[#475569]">
              Words: {richPlainText.trim() ? richPlainText.trim().split(/\s+/).length : 0} · Chars: {richPlainText.length}
            </span>
          </div>
          <ToolExportBar
            onClear={() => {
              if (richEditorRef.current) richEditorRef.current.innerHTML = '';
              setRichPlainText('');
            }}
            onCopy={() => copyToClipboard(richEditorRef.current?.innerText || richPlainText)}
            copied={copied}
            onWord={() => void exportLinesToDocx((richEditorRef.current?.innerText || richPlainText).split('\n'), 'rich-document.docx')}
            onJson={() => downloadJsonFile({ html: richEditorRef.current?.innerHTML || '', plainText: richEditorRef.current?.innerText || richPlainText }, 'rich-document.json')}
            onPdf={() => void exportElementToPdf({ element: richEditorRef.current, filename: 'rich-document.pdf' })}
            onPrint={() => void printHtmlDocument({ title: 'Rich Text Document', bodyHtml: richEditorRef.current?.innerHTML || '' })}
            disabled={!richPlainText.trim()}
            extraActions={
              <button
                type="button"
                disabled={!richPlainText.trim()}
                onClick={() => {
                  const html = `<!doctype html><html><meta charset="utf-8"><body>${richEditorRef.current?.innerHTML || ''}</body></html>`;
                  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'rich-document.html';
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                }}
                className="px-3 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white text-xs font-bold cursor-pointer disabled:opacity-45 whitespace-nowrap"
              >
                .HTML
              </button>
            }
          />
        </div>
      )}

      {isDocxViewer && (
        <div className="space-y-4">
          <div className="no-print">
            <FileDropZone
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              multiple={false}
              className="rounded-2xl border-[1.5px] border-dashed border-[#2F3E4E] bg-[#FEF2C8]/45 hover:bg-[#FEF2C8]/75 transition cursor-pointer"
            onFiles={async (files) => {
              const f = files[0];
              if (!f) return;
              setDocxError('');
              try {
                const buf = await f.arrayBuffer();
                const htmlRes = await mammoth.convertToHtml({ arrayBuffer: buf });
                const txtRes = await mammoth.extractRawText({ arrayBuffer: buf });
                setDocxFileName(f.name);
                setDocxHtml(htmlRes.value);
                setDocxRawText(txtRes.value);
              } catch (err: any) {
                setDocxError(err?.message || 'Unable to parse .DOCX archive.');
              }
            }}
          >
            <label className="flex flex-col items-center justify-center p-6 text-center cursor-pointer gap-2">
              <UploadCloud className="w-7 h-7 text-[#2F3E4E]" />
              <span className="text-xs sm:text-sm font-bold text-[#2F3E4E]">
                {docxFileName
                  ? `Loaded Word File: ${docxFileName}`
                  : 'Drop a Microsoft Word (.DOCX) document to preview cleanly'}
              </span>
              <span className="text-[11px] text-[#64748B]">
                Renders headings, tables, bold styling &amp; lists offline via Mammoth.js
              </span>
              <input
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  setDocxError('');
                  try {
                    const buf = await f.arrayBuffer();
                    const htmlRes = await mammoth.convertToHtml({ arrayBuffer: buf });
                    const txtRes = await mammoth.extractRawText({ arrayBuffer: buf });
                    setDocxFileName(f.name);
                    setDocxHtml(htmlRes.value);
                    setDocxRawText(txtRes.value);
                  } catch (err: any) {
                    setDocxError(err?.message || 'Unable to parse .DOCX archive.');
                  }
                }}
              />
            </label>
          </FileDropZone>
          </div>
          {docxError && <div className="p-3 bg-red-50 border border-red-700 text-red-800 rounded-xl text-xs font-bold no-print">{docxError}</div>}
          {docxHtml && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs no-print">
                <span className="font-mono font-bold text-[#2F3E4E]">
                  Words: {docxRawText.trim() ? docxRawText.trim().split(/\s+/).length : 0}
                </span>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => copyToClipboard(docxRawText)} className="px-3 py-1.5 rounded-lg border border-[#2F3E4E] bg-white font-bold cursor-pointer">Copy Plain Text</button>
                  <button
                    type="button"
                    onClick={() => {
                      void exportElementToPdf({
                        element: docxPrintRef.current,
                        filename: `${(docxFileName || 'document').replace(/\.docx?$/i, '')}.pdf`,
                      });
                    }}
                    className="px-3 py-1.5 rounded-lg border border-[#2F3E4E] bg-[#F9C80E] text-[#2F3E4E] font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> Save PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void printTargetElement({
                        element: docxPrintRef.current,
                        title: docxFileName || 'Word_Document',
                        prepareClone: (clone) => {
                          clone.style.border = '0';
                          clone.style.padding = '0';
                        },
                      });
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#2F3E4E] text-[#FFFDF5] font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" /> Print Document
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDocxFileName('');
                      setDocxHtml('');
                      setDocxRawText('');
                      setDocxError('');
                    }}
                    className="px-3 py-1.5 rounded-lg border border-[#2F3E4E] bg-[#FFE1B3] hover:bg-[#F9C80E] text-[#2F3E4E] font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Clear Word File
                  </button>
                </div>
              </div>
              <div
                ref={docxPrintRef}
                className="p-6 bg-white border-[1.5px] border-[#2F3E4E] rounded-2xl text-sm leading-relaxed space-y-3 overflow-hidden break-words [&_table]:block [&_table]:overflow-x-auto print:border-0 print:p-0 print:overflow-visible"
                dangerouslySetInnerHTML={{ __html: docxHtml }}
              />
            </div>
          )}
        </div>
      )}

      {isTextSorter && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'az', label: 'Sort A → Z' },
              { id: 'za', label: 'Sort Z → A' },
              { id: 'length', label: 'Sort by Length' },
              { id: 'numeric', label: 'Sort Numeric' },
              { id: 'dedupe', label: 'Remove Duplicates' },
              { id: 'trim', label: 'Trim Spaces' },
              { id: 'empty', label: 'Strip Empty Lines' },
              { id: 'reverse', label: 'Reverse Order' },
              { id: 'number', label: 'Add 1. 2. 3.' },
            ].map((btn) => (
              <button
                key={btn.id}
                type="button"
                onClick={() => handleSortTransform(btn.id as any)}
                className="px-3 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] cursor-pointer"
              >
                {btn.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center bg-[#FEF2C8]/65 p-3 rounded-xl border border-[#2F3E4E]/30 text-xs">
            <input type="text" value={linePrefix} onChange={(e) => setLinePrefix(e.target.value)} placeholder="Prefix each line (e.g. - )" className="px-3 py-1.5 rounded-lg border border-[#2F3E4E] bg-white font-mono" />
            <input type="text" value={lineSuffix} onChange={(e) => setLineSuffix(e.target.value)} placeholder="Suffix each line (e.g. ,)" className="px-3 py-1.5 rounded-lg border border-[#2F3E4E] bg-white font-mono" />
            <button type="button" onClick={() => handleSortTransform('affix')} className="px-3 py-1.5 rounded-lg bg-[#2F3E4E] text-[#FFFDF5] font-bold cursor-pointer">Apply Prefix &amp; Suffix</button>
          </div>
          <textarea rows={9} value={sorterInput} onChange={(e) => setSorterInput(e.target.value)} placeholder="Paste lines of text or list items here (one item per line)..." className="w-full p-4 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white font-mono text-xs" />
          <div className="text-xs font-mono font-bold text-[#475569]">
            Lines: {sorterInput ? sorterInput.split('\n').length : 0} · Unique: {sorterInput ? new Set(sorterInput.split('\n')).size : 0}
          </div>
          <ToolExportBar
            onClear={() => {
              setSorterInput('');
              setLinePrefix('');
              setLineSuffix('');
            }}
            onCopy={() => copyToClipboard(sorterInput)}
            copied={copied}
            onExcel={() => downloadExcelWorkbook('Sorted_List.xlsx', [{ name: 'List', rows: [['#', 'Line'], ...sorterInput.split('\n').map((l, i) => [i + 1, l])] }])}
            onCsv={() => downloadBomCsv(['Line'], sorterInput.split('\n').map((l) => [l]), 'Sorted_List.csv')}
            onWord={() => void exportLinesToDocx(sorterInput.split('\n'), 'Sorted_List.docx')}
            onJson={() => downloadJsonFile(sorterInput.split('\n'), 'Sorted_List.json')}
            disabled={!sorterInput.trim()}
          />
        </div>
      )}

      {isResumeBuilder && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2 items-center justify-between no-print">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs font-bold text-[#2F3E4E]">Template:</span>
              {[
                { id: 'resume', label: 'ATS Single-Column Resume' },
                { id: 'cover', label: 'Job Cover Letter' },
                { id: 'resignation', label: 'Formal Resignation Letter' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setDocTemplateType(t.id as any)}
                  className={`px-3 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] text-xs font-bold cursor-pointer ${
                    docTemplateType === t.id ? 'bg-[#F9C80E]' : 'bg-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start print:block">
            <div className="space-y-3 bg-white p-4 rounded-xl border-[1.5px] border-[#2F3E4E] text-xs lg:max-h-[calc(100dvh-5.5rem)] lg:overflow-y-auto lg:pr-1.5 no-print print:max-h-none print:overflow-visible">
              <div>
                <label className="block font-bold mb-1">Full Name</label>
                <input value={resumeName} onChange={(e) => setResumeName(e.target.value)} placeholder="e.g. Rohan Kulkarni" className="w-full px-3 py-1.5 rounded-lg border border-[#2F3E4E]" />
              </div>
              <div>
                <label className="block font-bold mb-1">Target Role / Designation</label>
                <input value={resumeRole} onChange={(e) => setResumeRole(e.target.value)} placeholder="e.g. Senior Accounts & GST Executive" className="w-full px-3 py-1.5 rounded-lg border border-[#2F3E4E]" />
              </div>
              <div>
                <label className="block font-bold mb-1">City · Phone · Email</label>
                <input value={resumeContact} onChange={(e) => setResumeContact(e.target.value)} placeholder="City · +91 Phone · email@example.com" className="w-full px-3 py-1.5 rounded-lg border border-[#2F3E4E]" />
              </div>
              <div>
                <label className="block font-bold mb-1">{docTemplateType === 'resume' ? 'Professional Summary' : 'Opening Paragraph'}</label>
                <textarea rows={3} value={resumeSummary} onChange={(e) => setResumeSummary(e.target.value)} placeholder="Enter brief profile summary or opening statement..." className="w-full p-2.5 rounded-lg border border-[#2F3E4E]" />
              </div>
              <div>
                <label className="block font-bold mb-1">{docTemplateType === 'resume' ? 'Key Achievements & Experience' : 'Body & Notice Details'}</label>
                <textarea rows={4} value={resumeExperience} onChange={(e) => setResumeExperience(e.target.value)} placeholder="• Key impact, achievements, or formal notice details..." className="w-full p-2.5 rounded-lg border border-[#2F3E4E]" />
              </div>
              <div>
                <label className="block font-bold mb-1">Core Skills / Sign-Off</label>
                <input value={resumeSkills} onChange={(e) => setResumeSkills(e.target.value)} placeholder="Skill 1 · Skill 2 · Skill 3" className="w-full px-3 py-1.5 rounded-lg border border-[#2F3E4E]" />
              </div>
            </div>
            <div className="lg:sticky lg:top-20 space-y-3 print:static">
              <div
                ref={resumePrintRef}
                className="bg-white p-6 rounded-xl border-[1.5px] border-[#2F3E4E] space-y-3 font-sans text-xs text-[#1E293B] overflow-hidden print:border-0 print:p-0"
              >
                <div className="border-b-2 border-[#2F3E4E] pb-2">
                  <h2 className="font-display text-lg font-extrabold text-[#2F3E4E]">{resumeName || 'Your Name'}</h2>
                  <div className="font-bold text-[#475569]">{resumeRole || 'Target Designation'}</div>
                  <div className="text-[11px] text-[#64748B] mt-0.5">{resumeContact || 'City · Phone · Email'}</div>
                </div>
                <div>
                  <div className="font-bold uppercase tracking-wider text-[10px] text-[#2F3E4E] mb-1">
                    {docTemplateType === 'resume' ? 'Professional Profile' : docTemplateType === 'cover' ? 'Application Statement' : 'Resignation Notice'}
                  </div>
                  <p className="leading-relaxed">{resumeSummary || 'Your summary appears here...'}</p>
                </div>
                <div>
                  <div className="font-bold uppercase tracking-wider text-[10px] text-[#2F3E4E] mb-1">
                    {docTemplateType === 'resume' ? 'Experience & Impact' : 'Details'}
                  </div>
                  <div className="whitespace-pre-line leading-relaxed">{resumeExperience || 'Your experience or letter details appear here...'}</div>
                </div>
                <div>
                  <div className="font-bold uppercase tracking-wider text-[10px] text-[#2F3E4E] mb-1">Core Competencies</div>
                  <p className="font-semibold">{resumeSkills || 'Core competencies appear here...'}</p>
                </div>
              </div>
              <ToolExportBar
                onClear={() => {
                  setResumeName('');
                  setResumeRole('');
                  setResumeContact('');
                  setResumeSummary('');
                  setResumeExperience('');
                  setResumeSkills('');
                }}
                onCopy={() => copyToClipboard([resumeName, resumeRole, resumeContact, '', resumeSummary, '', resumeExperience, '', resumeSkills].filter(Boolean).join('\n'))}
                copied={copied}
                onWord={() =>
                  exportLinesToDocx(
                    [resumeName, resumeRole, resumeContact, '', 'SUMMARY', resumeSummary, '', 'EXPERIENCE / DETAILS', ...resumeExperience.split('\n'), '', 'SKILLS', resumeSkills],
                    `${(resumeName || 'Document').replace(/\s+/g, '_')}_ATS.docx`
                  )
                }
                onJson={() => downloadJsonFile({ docTemplateType, resumeName, resumeRole, resumeContact, resumeSummary, resumeExperience, resumeSkills }, `${(resumeName || 'Document').replace(/\s+/g, '_')}_ATS.json`)}
                onPdf={() => {
                  void exportElementToPdf({
                    element: resumePrintRef.current,
                    filename: `${(resumeName || 'Document').replace(/\s+/g, '_')}_ATS.pdf`,
                  });
                }}
                onPrint={() => {
                  void printTargetElement({
                    element: resumePrintRef.current,
                    title: `${(resumeName || 'Document').replace(/\s+/g, '_')}_${docTemplateType}`,
                    prepareClone: (clone) => {
                      clone.style.position = 'static';
                      clone.style.border = '0';
                      clone.style.padding = '8mm';
                    },
                  });
                }}
                disabled={!resumeName.trim() && !resumeSummary.trim() && !resumeExperience.trim()}
              />
            </div>
          </div>
        </div>
      )}

      {!isTypingTest && !isUnicodeConverter && !isCaseConverter && !isTextToPdf && !isRichTextStudio && !isDocxViewer && !isTextSorter && !isResumeBuilder && (
        <div className="space-y-6">
          <textarea
            rows={8}
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Type or paste your text to analyze..."
            className="w-full p-4 border-[1.5px] border-[#2F3E4E] rounded-xl text-sm leading-relaxed bg-white font-sans"
          />

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center text-xs">
            <div className="p-3.5 bg-[#FEF2C8]/75 rounded-xl border-[1.5px] border-[#2F3E4E]">
              <span className="text-[#475569] font-semibold block">Total Words</span>
              <span className="text-2xl font-bold font-mono tabular-nums text-[#2F3E4E]">{wordCount}</span>
            </div>
            <div className="p-3.5 bg-white rounded-xl border border-[#2F3E4E]/30">
              <span className="text-[#475569] font-semibold block">Chars (w/ spaces)</span>
              <span className="text-2xl font-bold font-mono tabular-nums text-[#2F3E4E]">
                {charCountWithSpaces}
              </span>
            </div>
            <div className="p-3.5 bg-white rounded-xl border border-[#2F3E4E]/30">
              <span className="text-[#475569] font-semibold block">Chars (no spaces)</span>
              <span className="text-2xl font-bold font-mono tabular-nums text-[#2F3E4E]">
                {charCountNoSpaces}
              </span>
            </div>
            <div className="p-3.5 bg-white rounded-xl border border-[#2F3E4E]/30">
              <span className="text-[#475569] font-semibold block">Sentences</span>
              <span className="text-2xl font-bold font-mono tabular-nums text-[#2F3E4E]">
                {sentenceCount}
              </span>
            </div>
            <div className="p-3.5 bg-white rounded-xl border border-[#2F3E4E]/30">
              <span className="text-[#475569] font-semibold block">Read Time</span>
              <span className="text-xl font-bold font-mono tabular-nums text-[#2F3E4E]">
                {readingTimeMin}m
              </span>
            </div>
            <div className="p-3.5 bg-white rounded-xl border border-[#2F3E4E]/30">
              <span className="text-[#475569] font-semibold block">Speak Time</span>
              <span className="text-xl font-bold font-mono tabular-nums text-[#2F3E4E]">
                {speakingTimeMin}m
              </span>
            </div>
          </div>

          <div className="p-5 bg-[#FEF2C8]/60 rounded-2xl border-[1.5px] border-[#2F3E4E] space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider block text-[#2F3E4E]">
              UPSC Mains Answer Word Limits
            </span>
            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between text-[#475569] mb-1">
                  <span>10-Marker Target (150 Words max)</span>
                  <span className="font-mono tabular-nums font-bold text-[#2F3E4E]">
                    {wordCount} / 150 words ({Math.round((wordCount / 150) * 100)}%)
                  </span>
                </div>
                <div className="w-full bg-white border border-[#2F3E4E]/25 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${
                      wordCount > 165 ? 'bg-red-600' : wordCount >= 135 ? 'bg-emerald-600' : 'bg-[#2F3E4E]'
                    }`}
                    style={{ width: `${Math.min(100, (wordCount / 150) * 100)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[#475569] mb-1">
                  <span>15-Marker Target (250 Words max)</span>
                  <span className="font-mono tabular-nums font-bold text-[#2F3E4E]">
                    {wordCount} / 250 words ({Math.round((wordCount / 250) * 100)}%)
                  </span>
                </div>
                <div className="w-full bg-white border border-[#2F3E4E]/25 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${
                      wordCount > 275 ? 'bg-red-600' : wordCount >= 225 ? 'bg-emerald-600' : 'bg-[#2F3E4E]'
                    }`}
                    style={{ width: `${Math.min(100, (wordCount / 250) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {isResumeChecker && (
            <div className="p-4 bg-[#FFE1B3]/65 rounded-xl border-[1.5px] border-[#2F3E4E] space-y-2 text-xs">
              <span className="font-bold text-[#2F3E4E] flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> Resume Buzzwords Audit
              </span>
              {foundBuzzwords.length > 0 ? (
                <div className="space-y-1.5">
                  <p className="text-[#2F3E4E]">
                    Detected {foundBuzzwords.length} overused cliché buzzword(s):
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {foundBuzzwords.map((w, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 bg-[#FFFDF5] border border-[#2F3E4E] rounded font-mono text-[11px] font-bold"
                      >
                        &ldquo;{w}&rdquo;
                      </span>
                    ))}
                  </div>
                  <p className="text-[11px] text-[#475569] pt-1">
                    Tip: Replace generic buzzwords with measurable action verbs (e.g. &ldquo;Architected&rdquo;, &ldquo;Spearheaded&rdquo;, &ldquo;Delivered 35% growth&rdquo;).
                  </p>
                </div>
              ) : (
                <p className="text-emerald-800 font-bold">
                  Clean resume text! No clichéd buzzwords detected.
                </p>
              )}
            </div>
          )}
          <ToolExportBar
            onClear={() => setTextInput('')}
            onCopy={() => copyToClipboard(textInput)}
            copied={copied}
            onExcel={() =>
              downloadExcelWorkbook('Word_Counter_Audit.xlsx', [
                {
                  name: 'Metrics',
                  rows: [
                    ['Metric', 'Value'],
                    ['Words', wordCount],
                    ['Characters (with spaces)', charCountWithSpaces],
                    ['Characters (no spaces)', charCountNoSpaces],
                    ['Sentences', sentenceCount],
                    ['Paragraphs', paragraphCount],
                    ['Read Time (min)', readingTimeMin],
                    ['Speak Time (min)', speakingTimeMin],
                  ],
                },
              ])
            }
            onWord={() => void exportLinesToDocx(textInput.split('\n'), 'word-audit-text.docx')}
            onJson={() => downloadJsonFile({ wordCount, charCountWithSpaces, charCountNoSpaces, sentenceCount, paragraphCount, readingTimeMin, speakingTimeMin, foundBuzzwords, textInput }, 'word-audit.json')}
            onPdf={() =>
              void exportStructuredReportPdf({
                title: 'Word Count & Text Audit',
                sections: [
                  {
                    title: 'Summary Metrics',
                    rows: [
                      { label: 'Total Words', value: String(wordCount) },
                      { label: 'Characters (w/ spaces)', value: String(charCountWithSpaces) },
                      { label: 'Sentences', value: String(sentenceCount) },
                    ],
                  },
                ],
                filename: 'word-audit.pdf',
              })
            }
            disabled={!textInput.trim()}
          />
        </div>
      )}
    </div>
  );
};
