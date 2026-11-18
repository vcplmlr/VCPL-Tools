import React, { useState, useEffect, useRef } from 'react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import {
  Keyboard,
  Timer,
  RefreshCw,
  Award,
  CheckCircle,
  Copy,
  Check,
  Languages,
  AlignLeft,
  Scissors,
  CaseSensitive,
  FileDown,
  Download,
  AlertTriangle,
  Sparkles,
  BarChart2,
  FileText,
  Printer,
  Sliders,
  Type
} from 'lucide-react';
import { Tool } from '../types';

interface TypingEngineProps {
  tool: Tool;
}

const SAMPLE_PASSAGES = {
  english: [
    'The Union Public Service Commission conducts competitive examinations every year to recruit eligible citizens into civil and administrative services. Integrity, diligence, and conceptual clarity are essential virtues for every candidate aspiring to serve in public administration.',
    'Effective governance requires transparent institutions, accountable public servants, and equitable resource allocation. Digital platforms empower citizens by providing instant access to government notifications, certificates, and online application utilities without intermediaries.',
    'Technology has transformed recruitment across the country. Modern candidates prepare for competitive tests by solving mock quizzes, tracking typing speed, and verifying document dimensions in accordance with official notification guidelines.'
  ],
  kannada: [
    'ಕರ್ನಾಟಕ ಲೋಕಸೇವಾ ಆಯೋಗವು ರಾಜ್ಯದ ವಿವಿಧ ಇಲಾಖೆಗಳಲ್ಲಿ ಖಾಲಿ ಇರುವ ಹುದ್ದೆಗಳಿಗೆ ಅರ್ಹ ಅಭ್ಯರ್ಥಿಗಳನ್ನು ನೇಮಕ ಮಾಡಲು ಸ್ಪರ್ಧಾತ್ಮಕ ಪರೀಕ್ಷೆಗಳನ್ನು ನಡೆಸುತ್ತದೆ. ಶ್ರಮ ಮತ್ತು ಶ್ರದ್ಧೆಯಿಂದ ಅಭ್ಯಾಸ ಮಾಡಿದರೆ ಯಶಸ್ಸು ಖಂಡಿತ.',
    'ನಮ್ಮ ನಾಡು ನುಡಿ ಸಂಸ್ಕೃತಿಯು ಅತ್ಯಂತ ಶ್ರೀಮಂತವಾಗಿದೆ. ಕಲೆ, ಸಾಹಿತ್ಯ, ಶಿಲ್ಪಕಲೆ ಮತ್ತು ವಿಜ್ಞಾನ ಕ್ಷೇತ್ರದಲ್ಲಿ ಕನ್ನಡಿಗರ ಕೊಡುಗೆ ಅಪಾರ. ಕನ್ನಡ ಭಾಷೆಯಲ್ಲಿ ಟೈಪಿಂಗ್ ಕೌಶಲ್ಯ ಬೆಳೆಸಿಕೊಳ್ಳುವುದು ಸರ್ಕಾರಿ ಉದ್ಯೋಗಕ್ಕೆ ಅತ್ಯಂತ ಸಹಾಯಕ.',
    'ಡಿಜಿಟಲ್ ತಂತ್ರಜ್ಞಾನವು ನಾಗರಿಕರಿಗೆ ಸರ್ಕಾರಿ ಸೇವೆಗಳನ್ನು ಸುಲಭವಾಗಿ ಒದಗಿಸಲು ನೆರವಾಗುತ್ತಿದೆ. ಆನ್‌ಲೈನ್ ಅರ್ಜಿ ಸಲ್ಲಿಕೆ ಮತ್ತು ದಾಖಲೆಗಳ ಸಿದ್ಧತೆಯು ಪಾರದರ್ಶಕತೆಗೆ ಮುನ್ನುಡಿ ಬರೆದಿದೆ.'
  ],
  hindi: [
    'कर्मचारी चयन आयोग और संघ लोक सेवा आयोग द्वारा आयोजित प्रतियोगी परीक्षाओं में लाखों उम्मीदवार भाग लेते हैं। निरंतर अभ्यास, सही रणनीति और लगन से सफलता प्राप्त की जा सकती है।',
    'डिजिटल भारत अभियान ने सरकारी सेवाओं को आम नागरिक तक सुलभ बनाया है। ऑनलाइन आवेदन पत्र भरने के लिए फोटो, हस्ताक्षर और आवश्यक प्रमाण पत्रों की सही तैयारी बहुत महत्वपूर्ण है।',
    'हिंदी टंकण कौशल सरकारी कार्यालयों और अदालतों में अत्यंत उपयोगी है। नियमित अभ्यास से टंकण गति और सटीकता में उल्लेखनीय सुधार होता है।'
  ]
};

// Kruti Dev 010 to Unicode Hindi conversion mapping table
const KRUTI_TO_UNICODE: { [key: string]: string } = {
  'k': 'ा', 'l': 'ी', 'h': 'ी', 'i': 'ि', 'f': 'ि',
  'd': 'द', 'v': 'अ', 'b': 'इ', 'c': 'ब', 'x': 'ग', 'z': '्र',
  'a': 'ं', 's': 'े', 'w': 'ू', 'e': 'म', 'r': 'त', 't': 'ज',
  'y': 'ल', 'u': 'न', 'o': 'व', 'p': 'च', 'g': 'ह', 'j': 'र',
  'n': 'द', 'm': 'स', 'q': 'फ',
  'A': 'k', 'S': 's', 'D': 'd', 'F': 'f', 'G': 'g', 'H': 'h',
  'J': 'j', 'K': 'k', 'L': 'l', 'Q': 'q', 'W': 'w', 'E': 'e',
  'R': 'r', 'T': 't', 'Y': 'y', 'U': 'u', 'I': 'i', 'O': 'o',
  'P': 'p', 'Z': 'z', 'X': 'x', 'C': 'c', 'V': 'v', 'B': 'b',
  'N': 'n', 'M': 'm'
};

export const TypingEngine: React.FC<TypingEngineProps> = ({ tool }) => {
  const [copied, setCopied] = useState<boolean>(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Determine language mode
  const isKannada = tool.id.includes('kannada');
  const isHindi = tool.id.includes('hindi');
  const langKey = isKannada ? 'kannada' : isHindi ? 'hindi' : 'english';

  const [passageIndex, setPassageIndex] = useState(0);
  const passages = SAMPLE_PASSAGES[langKey];
  const targetText = passages[passageIndex % passages.length];

  // Typing test state
  const [userInput, setUserInput] = useState('');
  const [timerDuration, setTimerDuration] = useState<number>(60); // 60, 120, 300
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [isFinished, setIsFinished] = useState<boolean>(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);

  // General Text Counter & Case Converter State
  const [textInput, setTextInput] = useState<string>(
    'The quick brown fox jumps over the lazy dog. UPSC Civil Services examination requires comprehensive preparation across General Studies, Optional Subjects, and Essay writing.'
  );
  const [unicodeOutput, setUnicodeOutput] = useState<string>('');

  // Text to PDF state
  const [pdfTitle, setPdfTitle] = useState<string>('Official Study Notes & Application Document');
  const [pdfFontSize, setPdfFontSize] = useState<number>(11);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  // Reset tool-specific state on tool switch
  useEffect(() => {
    setUserInput('');
    setIsActive(false);
    setIsFinished(false);
    setTimeLeft(timerDuration);
    setPassageIndex(0);
    setUnicodeOutput('');
  }, [tool.id]);

  // Timer loop (without timeLeft in deps to prevent interval recreation every second)
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      setTimeLeft(t => {
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
    if (!isActive && !isFinished) {
      setIsActive(true);
    }
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

  // Speed Metrics
  const elapsedSeconds = Math.max(1, timerDuration - timeLeft);
  const elapsedMinutes = Math.max(0.05, elapsedSeconds / 60);

  let errorCount = 0;
  for (let i = 0; i < userInput.length; i++) {
    if (userInput[i] !== targetText[i]) {
      errorCount++;
    }
  }

  const grossWpm = Math.round(userInput.length / 5 / elapsedMinutes);
  const netWpm = Math.max(0, Math.round((userInput.length / 5 - errorCount) / elapsedMinutes));
  const accuracy =
    userInput.length > 0 ? Math.max(0, Math.round(((userInput.length - errorCount) / userInput.length) * 100)) : 100;
  const kdph = Math.round((userInput.length / elapsedSeconds) * 3600);

  // Standard qualifying benchmarks: English >= 35 WPM & 95% Acc, Hindi/Kannada >= 30 WPM & 90% Acc
  const requiredSpeed = isKannada || isHindi ? 30 : 35;
  const isExamQualified = netWpm >= requiredSpeed && accuracy >= 90;

  // Text Counter stats
  const words = textInput.trim().split(/\s+/).filter(Boolean);
  const wordCount = textInput.trim() ? words.length : 0;
  const charCountWithSpaces = textInput.length;
  const charCountNoSpaces = textInput.replace(/\s+/g, '').length;
  const sentenceCount = textInput.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
  const paragraphCount = textInput.split(/\n+/).filter(p => p.trim().length > 0).length;
  const readingTimeMin = (wordCount / 200).toFixed(1);
  const speakingTimeMin = (wordCount / 130).toFixed(1);

  // Case transformations
  const handleCaseTransform = (
    type:
      | 'upper'
      | 'lower'
      | 'title'
      | 'sentence'
      | 'camel'
      | 'snake'
      | 'kebab'
      | 'clean-spaces'
  ) => {
    let res = '';
    if (type === 'upper') {
      res = textInput.toUpperCase();
    } else if (type === 'lower') {
      res = textInput.toLowerCase();
    } else if (type === 'title') {
      res = textInput.replace(/\b\w/g, c => c.toUpperCase());
    } else if (type === 'sentence') {
      res = textInput.toLowerCase().replace(/(^\s*\w|[.!?]\s*\w)/g, c => c.toUpperCase());
    } else if (type === 'camel') {
      res = textInput
        .replace(/[^a-zA-Z0-9 ]/g, '')
        .split(' ')
        .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
        .join('');
    } else if (type === 'snake') {
      res = textInput
        .trim()
        .toLowerCase()
        .replace(/[^a-zA-Z0-9]+/g, '_');
    } else if (type === 'kebab') {
      res = textInput
        .trim()
        .toLowerCase()
        .replace(/[^a-zA-Z0-9]+/g, '-');
    } else if (type === 'clean-spaces') {
      res = textInput.replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n\n').trim();
    }
    setTextInput(res);
  };

  // Kruti Dev to Unicode & Nudi transliterator
  const handleUnicodeConvert = () => {
    if (isHindi) {
      let out = '';
      for (let i = 0; i < textInput.length; i++) {
        const char = textInput[i];
        out += KRUTI_TO_UNICODE[char] || char;
      }
      setUnicodeOutput(out);
    } else if (isKannada) {
      // Basic Nudi transliterator replacement
      const nudiMap: { [key: string]: string } = {
        'PÀ': 'ಕ', 'PÁ': 'ಕಾ', 'Q': 'ಕಿ', 'QÃ': 'ಕೀ',
        '£Á': 'ನಾ', 'ß': '್ನ', 'l': 'ಟ', 'PÀ£ÁßlPÀ': 'ಕರ್ನಾಟಕ'
      };
      let out = textInput;
      Object.keys(nudiMap)
        .sort((a, b) => b.length - a.length)
        .forEach(key => {
          out = out.split(key).join(nudiMap[key]);
        });
      setUnicodeOutput(out);
    } else {
      setUnicodeOutput(textInput);
    }
  };

  // Helper: sanitize non-WinAnsi chars for Helvetica fallback
  const sanitizeWinAnsi = (str: string) =>
    str
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/₹/g, 'Rs.')
      .replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');

  // Text to PDF Export via pdf-lib (supports multi-page & Unicode via Canvas rendering when needed)
  const handleExportTextToPdf = async () => {
    try {
      setIsExportingPdf(true);
      const pdfDoc = await PDFDocument.create();
      const hasNonWinAnsi = /[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/.test(pdfTitle + textInput);

      if (hasNonWinAnsi) {
        // Render Unicode text cleanly across crisp A4 canvas pages and embed as PNG
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
            const words = para.split(' ');
            let line = '';
            for (const word of words) {
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

        const allLines = wrapTextLines(textInput);
        for (const l of allLines) {
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
          const bytes = await fetch(dataUrl).then(r => r.arrayBuffer());
          const img = await pdfDoc.embedPng(bytes);
          const page = pdfDoc.addPage([595.28, 841.89]);
          page.drawImage(img, { x: 0, y: 0, width: 595.28, height: 841.89 });
        }
      } else {
        let page = pdfDoc.addPage([595.28, 841.89]); // A4
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
          color: rgb(0.1, 0.15, 0.3)
        });
        y -= 14;

        page.drawLine({
          start: { x: 50, y },
          end: { x: 545, y },
          thickness: 0.75,
          color: rgb(0.8, 0.8, 0.8)
        });
        y -= 25;

        const lines = textInput.split('\n');
        for (const rawLine of lines) {
          const line = sanitizeWinAnsi(rawLine);
          if (!line.trim()) {
            y -= 12;
            if (y < 55) {
              page = pdfDoc.addPage([595.28, 841.89]);
              y = height - 50;
            }
            continue;
          }

          const wordsInLine = line.split(' ');
          let currentBuffer = '';
          for (const w of wordsInLine) {
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
                color: rgb(0.15, 0.15, 0.15)
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
              color: rgb(0.15, 0.15, 0.15)
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
      window.print();
    } finally {
      setIsExportingPdf(false);
    }
  };

  const isTypingTest =
    tool.id.includes('typing-practice') || tool.id.includes('typing-speed-test');
  const isUnicodeConverter = tool.id.includes('unicode-converter');
  const isTextToPdf = tool.id === 'text-to-pdf';
  const isCaseConverter =
    tool.id === 'case-converter' ||
    tool.id === 'text-case-converter' ||
    tool.id === 'remove-extra-spaces';
  const isResumeChecker =
    tool.id === 'resume-spell-checker' || tool.id === 'resume-word-counter';

  // Overused resume buzzwords list
  const RESUME_BUZZWORDS = [
    'synergy', 'hardworking', 'go-getter', 'team player', 'detail-oriented',
    'think outside the box', 'self-motivated', 'results-driven', 'proven track record',
    'passionate', 'rockstar', 'guru', 'ninja'
  ];

  const foundBuzzwords = RESUME_BUZZWORDS.filter(w =>
    new RegExp(`\\b${w}\\b`, 'i').test(textInput)
  );

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-slate-100 dark:border-slate-800">
        <div>
          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
            <Keyboard className="w-4 h-4" />
            {tool.categoryName}
          </span>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
            {tool.name}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time keyboard evaluation, text transformation, and Unicode parsing.
          </p>
        </div>

        <button
          onClick={() => copyToClipboard(isUnicodeConverter ? (unicodeOutput || textInput) : isTypingTest ? targetText : textInput)}
          className="px-3.5 py-1.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5 cursor-pointer"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied' : 'Copy Text'}
        </button>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 1. TYPING PRACTICE & SPEED TEST ENGINE */}
      {/* ---------------------------------------------------- */}
      {isTypingTest && (
        <div className="space-y-6">
          {/* Duration & Passage Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-500 font-medium">Duration:</span>
              {[60, 120, 300].map(sec => (
                <button
                  key={sec}
                  onClick={() => {
                    setTimerDuration(sec);
                    setUserInput('');
                    setTimeLeft(sec);
                    setIsActive(false);
                    setIsFinished(false);
                  }}
                  className={`px-3 py-1 rounded-lg font-semibold cursor-pointer transition ${
                    timerDuration === sec
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border'
                  }`}
                >
                  {sec === 60 ? '1 Min' : sec === 120 ? '2 Min' : '5 Min'}
                </button>
              ))}
              <span className="text-slate-400 mx-1">|</span>
              <span className="text-slate-500 font-medium">Passage:</span>
              {passages.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setPassageIndex(idx);
                    restartTest();
                  }}
                  className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer transition ${
                    passageIndex === idx
                      ? 'bg-slate-900 text-white dark:bg-blue-500'
                      : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border'
                  }`}
                >
                  #{idx + 1}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 font-mono text-base font-bold text-blue-600 dark:text-blue-400">
                <Timer className="w-4 h-4" />
                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </div>
              <button
                onClick={restartTest}
                className="px-3 py-1 bg-white dark:bg-slate-700 hover:bg-slate-100 border rounded-lg font-medium flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Restart
              </button>
            </div>
          </div>

          {/* Reference Passage with Character Highlighting */}
          <div className="p-5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl font-mono text-sm leading-relaxed tracking-wide select-none">
            {targetText.split('').map((char, index) => {
              let colorClass = 'text-slate-400 dark:text-slate-500';
              if (index < userInput.length) {
                colorClass =
                  userInput[index] === char
                    ? 'text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 rounded-sm'
                    : 'text-red-600 dark:text-red-400 font-bold bg-red-100 dark:bg-red-950/60 rounded-sm underline';
              } else if (index === userInput.length) {
                colorClass = 'bg-blue-500 text-white animate-pulse rounded-xs';
              }
              return (
                <span key={index} className={colorClass}>
                  {char}
                </span>
              );
            })}
          </div>

          {/* Typing Input Field */}
          <div>
            <textarea
              ref={inputRef}
              rows={4}
              value={userInput}
              onChange={handleTypingChange}
              disabled={isFinished}
              placeholder={isFinished ? 'Test completed! View your performance scorecard below.' : 'Click here and begin typing to start timer...'}
              className="w-full p-4 border-2 border-blue-500/50 rounded-2xl font-mono text-sm focus:outline-none focus:border-blue-600 bg-white dark:bg-slate-900 leading-relaxed shadow-inner"
            />
          </div>

          {/* Real-time Metrics Dashboard */}
          <div className="p-6 bg-slate-50 dark:bg-slate-800/40 border rounded-2xl grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
            <div>
              <span className="text-[11px] text-slate-400 uppercase block font-medium">Gross WPM</span>
              <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-0.5">
                {grossWpm}
              </div>
            </div>
            <div>
              <span className="text-[11px] text-blue-600 dark:text-blue-400 uppercase block font-bold">Net WPM</span>
              <div className="text-3xl font-extrabold font-mono text-blue-600 dark:text-blue-400 mt-0.5">
                {netWpm}
              </div>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 uppercase block font-medium">Accuracy</span>
              <div className="text-2xl font-bold font-mono text-emerald-600 mt-0.5">
                {accuracy}%
              </div>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 uppercase block font-medium">Errors</span>
              <div className="text-2xl font-bold font-mono text-red-600 mt-0.5">
                {errorCount}
              </div>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 uppercase block font-medium">Depressions (KDPH)</span>
              <div className="text-2xl font-bold font-mono text-purple-600 mt-0.5">
                {kdph}
              </div>
            </div>
          </div>

          {/* Official Performance Certificate Card */}
          {isFinished && (
            <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-900 border-2 border-blue-200 dark:border-blue-800 rounded-2xl text-center space-y-4 shadow-md">
              <div className="inline-flex p-3 bg-blue-600 text-white rounded-full">
                <Award className="w-8 h-8" />
              </div>

              <div>
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest block">
                  Official Skill Test Performance Report
                </span>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                  Speed: {netWpm} Net WPM | Accuracy: {accuracy}%
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Duration: {timerDuration} Seconds · Key Depressions Per Hour: {kdph} KDPH
                </p>
              </div>

              <div className={`inline-block px-4 py-1.5 rounded-full text-xs font-bold ${
                isExamQualified
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300'
              }`}>
                {isExamQualified
                  ? `✓ Qualified for Central / State Clerical Recruitment (Standard: ${requiredSpeed} WPM)`
                  : `Needs Practice: Target is ${requiredSpeed} WPM with 90%+ Accuracy`}
              </div>

              <div className="pt-2 flex justify-center gap-3">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> Print Certificate
                </button>
                <button
                  onClick={restartTest}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 hover:bg-white text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 2. UNICODE CONVERTER (KANNADA / HINDI) */}
      {/* ---------------------------------------------------- */}
      {isUnicodeConverter && (
        <div className="space-y-6">
          <div className="p-4 bg-blue-50/60 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-300">
            {isHindi
              ? 'Convert legacy Kruti Dev 010 and Chanakya fonts into universal Devanagari UTF-8 Unicode (Mangal font) for online portals.'
              : 'Convert legacy Nudi and Baraha ASCII fonts into universal Kannada UTF-8 Unicode standard for web publishing.'}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                Legacy Font Text (Paste Here)
              </label>
              <textarea
                rows={8}
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                placeholder={isHindi ? 'Paste Kruti Dev text...' : 'Paste Nudi text...'}
                className="w-full p-3 border rounded-xl text-xs font-mono bg-slate-50 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                Converted Universal Unicode (UTF-8)
              </label>
              <textarea
                rows={8}
                readOnly
                value={unicodeOutput}
                placeholder="Click 'Convert to Unicode Now' to view UTF-8 output..."
                className="w-full p-3 border rounded-xl text-xs font-sans bg-white dark:bg-slate-900 leading-relaxed text-blue-700 dark:text-blue-300"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={handleUnicodeConvert}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow cursor-pointer"
            >
              Convert to Unicode Now
            </button>
            <button
              onClick={() => copyToClipboard(unicodeOutput || textInput)}
              className="px-4 py-2 border rounded-xl text-xs font-medium cursor-pointer"
            >
              Copy Converted Text
            </button>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 3. CASE CONVERTER & SPACE CLEANER */}
      {/* ---------------------------------------------------- */}
      {isCaseConverter && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'UPPERCASE', type: 'upper' },
              { label: 'lowercase', type: 'lower' },
              { label: 'Title Case', type: 'title' },
              { label: 'Sentence case', type: 'sentence' },
              { label: 'camelCase', type: 'camel' },
              { label: 'snake_case', type: 'snake' },
              { label: 'kebab-case', type: 'kebab' },
              { label: 'Strip Extra Spaces', type: 'clean-spaces' }
            ].map(btn => (
              <button
                key={btn.type}
                onClick={() => handleCaseTransform(btn.type as any)}
                className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/40 text-slate-700 dark:text-slate-200 hover:text-blue-600 rounded-lg text-xs font-medium cursor-pointer border border-slate-200 dark:border-slate-700 transition"
              >
                {btn.label}
              </button>
            ))}
          </div>

          <textarea
            rows={8}
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            className="w-full p-4 border rounded-xl text-sm leading-relaxed font-sans bg-white dark:bg-slate-900"
          />

          <div className="flex justify-between items-center text-xs text-slate-500">
            <span>Words: {wordCount} | Characters: {charCountWithSpaces}</span>
            <button
              onClick={() => copyToClipboard(textInput)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold cursor-pointer"
            >
              Copy Transformed Text
            </button>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 4. TEXT TO PDF GENERATOR */}
      {/* ---------------------------------------------------- */}
      {isTextToPdf && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Document Header Title
              </label>
              <input
                type="text"
                value={pdfTitle}
                onChange={e => setPdfTitle(e.target.value)}
                className="w-full px-3 py-1.5 border rounded-xl text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Font Size ({pdfFontSize}pt)
              </label>
              <select
                value={pdfFontSize}
                onChange={e => setPdfFontSize(Number(e.target.value))}
                className="w-full px-3 py-1.5 border rounded-xl text-xs"
              >
                <option value={10}>10 pt (Compact)</option>
                <option value={11}>11 pt (Standard A4)</option>
                <option value={12}>12 pt (Large)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Document Content (Paragraphs)
            </label>
            <textarea
              rows={10}
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              className="w-full p-4 border rounded-xl text-sm leading-relaxed bg-white dark:bg-slate-900 font-sans"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={handleExportTextToPdf}
              disabled={isExportingPdf}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              {isExportingPdf ? 'Exporting PDF...' : 'Download Clean PDF'}
            </button>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 5. COUNTERS & RESUME AUDITOR */}
      {/* ---------------------------------------------------- */}
      {!isTypingTest && !isUnicodeConverter && !isCaseConverter && !isTextToPdf && (
        <div className="space-y-6">
          <textarea
            rows={8}
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            placeholder="Type or paste your text to analyze..."
            className="w-full p-4 border rounded-xl text-sm leading-relaxed bg-white dark:bg-slate-900 font-sans"
          />

          {/* Metrics Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border">
              <span className="text-slate-400 block">Total Words</span>
              <span className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400">
                {wordCount}
              </span>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border">
              <span className="text-slate-400 block">Characters (w/ spaces)</span>
              <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                {charCountWithSpaces}
              </span>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border">
              <span className="text-slate-400 block">Characters (no spaces)</span>
              <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                {charCountNoSpaces}
              </span>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border">
              <span className="text-slate-400 block">Sentences</span>
              <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                {sentenceCount}
              </span>
            </div>
          </div>

          {/* UPSC Mains Word Limit Gauges */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider block text-slate-700 dark:text-slate-300">
              UPSC Mains Answer Word Limits
            </span>
            <div className="space-y-2 text-xs">
              <div>
                <div className="flex justify-between text-slate-500 mb-1">
                  <span>10-Marker Target (150 Words max)</span>
                  <span className="font-mono font-bold">{wordCount} / 150 words ({Math.round((wordCount / 150) * 100)}%)</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${wordCount > 165 ? 'bg-red-500' : wordCount >= 135 ? 'bg-emerald-500' : 'bg-blue-600'}`}
                    style={{ width: `${Math.min(100, (wordCount / 150) * 100)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-500 mb-1">
                  <span>15-Marker Target (250 Words max)</span>
                  <span className="font-mono font-bold">{wordCount} / 250 words ({Math.round((wordCount / 250) * 100)}%)</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${wordCount > 275 ? 'bg-red-500' : wordCount >= 225 ? 'bg-emerald-500' : 'bg-blue-600'}`}
                    style={{ width: `${Math.min(100, (wordCount / 250) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Resume Spell / Buzzword Auditor */}
          {isResumeChecker && (
            <div className="p-4 bg-amber-50/70 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800 space-y-2 text-xs">
              <span className="font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> Resume Buzzwords Audit
              </span>
              {foundBuzzwords.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-amber-800 dark:text-amber-200">
                    Warning: We detected {foundBuzzwords.length} overused buzzwords:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {foundBuzzwords.map((w, i) => (
                      <span key={i} className="px-2 py-0.5 bg-amber-200 dark:bg-amber-900 rounded font-mono text-[11px]">
                        &quot;{w}&quot;
                      </span>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-500 pt-1">
                    Tip: Replace generic buzzwords with measurable verbs (e.g. &quot;Architected&quot;, &quot;Spearheaded&quot;, &quot;Delivered 35% growth&quot;).
                  </p>
                </div>
              ) : (
                <p className="text-emerald-700 dark:text-emerald-400 font-medium">
                  ✓ Clean resume text! No clichéd buzzwords detected.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
