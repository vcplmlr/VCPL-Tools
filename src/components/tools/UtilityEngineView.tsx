import React, { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import {
  Check,
  Code,
  Copy,
  Download,
  Flag,
  KeyRound,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { ToolCatalogItem } from '../../types/tools';
import {
  downloadBomCsv,
  downloadExcelWorkbook,
  downloadJsonFile,
  downloadWordDocument,
  exportStructuredReportPdf,
  printHtmlDocument,
} from '../../utils/printReport';
import { QrUpiStudioView } from './QrUpiStudioView';
import { ToolExportBar } from './ToolExportBar';

interface UtilityEngineViewProps {
  tool: ToolCatalogItem;
}

const LENGTH_UNITS: Record<string, { label: string; toMeter: number }> = {
  m: { label: 'Meters (m)', toMeter: 1 },
  km: { label: 'Kilometers (km)', toMeter: 1000 },
  cm: { label: 'Centimeters (cm)', toMeter: 0.01 },
  mm: { label: 'Millimeters (mm)', toMeter: 0.001 },
  ft: { label: 'Feet (ft)', toMeter: 0.3048 },
  in: { label: 'Inches (in)', toMeter: 0.0254 },
  mi: { label: 'Miles (mi)', toMeter: 1609.344 },
};

const WEIGHT_UNITS: Record<string, { label: string; toKg: number }> = {
  kg: { label: 'Kilograms (kg)', toKg: 1 },
  g: { label: 'Grams (g)', toKg: 0.001 },
  lb: { label: 'Pounds (lb)', toKg: 0.453592 },
  oz: { label: 'Ounces (oz)', toKg: 0.0283495 },
  quintal: { label: 'Quintals (q)', toKg: 100 },
  ton: { label: 'Metric Tons (t)', toKg: 1000 },
};

const STORAGE_UNITS: Record<string, { label: string; bytes: number }> = {
  B: { label: 'Bytes (B)', bytes: 1 },
  KB: { label: 'Kilobytes (KB - 1024)', bytes: 1024 },
  MB: { label: 'Megabytes (MB)', bytes: 1024 ** 2 },
  GB: { label: 'Gigabytes (GB)', bytes: 1024 ** 3 },
  TB: { label: 'Terabytes (TB)', bytes: 1024 ** 4 },
};

function formatDurationMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  const centis = Math.floor((ms % 1000) / 10);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
}

export const UtilityEngineView: React.FC<UtilityEngineViewProps> = ({ tool }) => {
  const [copied, setCopied] = useState(false);

  // Barcode state
  const [barcodeText, setBarcodeText] = useState('');
  const [barcodeFormat, setBarcodeFormat] = useState<'CODE128' | 'EAN13' | 'CODE39'>('CODE128');
  const [barcodeError, setBarcodeError] = useState('');
  const barcodeSvgRef = useRef<SVGSVGElement | null>(null);

  // Password generator & strength state
  const [pwLength, setPwLength] = useState(16);
  const [pwUpper, setPwUpper] = useState(true);
  const [pwLower, setPwLower] = useState(true);
  const [pwNumbers, setPwNumbers] = useState(true);
  const [pwSymbols, setPwSymbols] = useState(true);
  const [generatedPw, setGeneratedPw] = useState('');
  const [checkPwInput, setCheckPwInput] = useState('');

  // Text & Dev state
  const [devInput, setDevInput] = useState('');
  const [devOutput, setDevOutput] = useState('');
  const [devError, setDevError] = useState('');
  const [diffLeft, setDiffLeft] = useState('');
  const [diffRight, setDiffRight] = useState('');

  // Converter state
  const [unitCategory, setUnitCategory] = useState<'length' | 'weight' | 'temp'>('length');
  const [unitVal, setUnitVal] = useState<string>('');
  const [fromUnit, setFromUnit] = useState<string>('km');
  const [toUnit, setToUnit] = useState<string>('mi');
  const [storageVal, setStorageVal] = useState<string>('');
  const [storageUnit, setStorageUnit] = useState<string>('GB');

  // Stopwatch & Timer state
  const [swMs, setSwMs] = useState(0);
  const [swRunning, setSwRunning] = useState(false);
  const [laps, setLaps] = useState<number[]>([]);
  const [cdMinutes, setCdMinutes] = useState(5);
  const [cdRemainingSec, setCdRemainingSec] = useState(300);
  const [cdRunning, setCdRunning] = useState(false);

  const copyText = async (txt: string) => {
    try {
      await navigator.clipboard.writeText(txt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Ignore clipboard failures
    }
  };

  useEffect(() => {
    setDevOutput('');
    setDevError('');
  }, [tool.id]);

  // Barcode effect
  useEffect(() => {
    if (tool.id !== 'barcode-generator' || !barcodeSvgRef.current) return;
    setBarcodeError('');
    if (!barcodeText.trim()) {
      barcodeSvgRef.current.innerHTML = '';
      return;
    }
    try {
      JsBarcode(barcodeSvgRef.current, barcodeText.trim(), {
        format: barcodeFormat,
        lineColor: '#2F3E4E',
        width: 2,
        height: 80,
        displayValue: true,
        background: '#FFFFFF',
      });
    } catch (err: any) {
      setBarcodeError(err?.message || 'Invalid characters for selected barcode standard.');
    }
  }, [tool.id, barcodeText, barcodeFormat]);

  // Stopwatch interval
  useEffect(() => {
    if (!swRunning) return;
    const start = Date.now() - swMs;
    const id = window.setInterval(() => {
      setSwMs(Date.now() - start);
    }, 50);
    return () => window.clearInterval(id);
  }, [swRunning]);

  // Countdown interval
  useEffect(() => {
    if (!cdRunning) return;
    const id = window.setInterval(() => {
      setCdRemainingSec((prev) => {
        if (prev <= 1) {
          setCdRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [cdRunning]);

  const generateRandomPassword = () => {
    const sets: string[] = [];
    if (pwUpper) sets.push('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    if (pwLower) sets.push('abcdefghijklmnopqrstuvwxyz');
    if (pwNumbers) sets.push('0123456789');
    if (pwSymbols) sets.push('!@#$%^&*()-_=+[]{}');
    const pool = sets.join('') || 'abcdefghijklmnopqrstuvwxyz0123456789';
    const arr = new Uint32Array(pwLength);
    window.crypto.getRandomValues(arr);
    let out = '';
    for (let i = 0; i < pwLength; i++) {
      out += pool[arr[i] % pool.length];
    }
    setGeneratedPw(out);
    setCheckPwInput(out);
  };

  const evaluateStrength = (pw: string) => {
    if (!pw) return { score: 0, label: 'Enter Password' };
    let score = 0;
    if (pw.length >= 8) score += 20;
    if (pw.length >= 12) score += 20;
    if (/[a-z]/.test(pw)) score += 15;
    if (/[A-Z]/.test(pw)) score += 15;
    if (/[0-9]/.test(pw)) score += 15;
    if (/[^A-Za-z0-9]/.test(pw)) score += 15;
    const label =
      score >= 85 ? 'Very Strong' : score >= 65 ? 'Strong' : score >= 40 ? 'Moderate' : 'Weak';
    return { score, label };
  };

  const renderToolContent = () => {
    if (tool.id === 'qr-code-generator') {
      return <QrUpiStudioView />;
    }

    if (tool.id === 'barcode-generator') {
      const downloadBarcodePng = async () => {
        if (!barcodeSvgRef.current || barcodeError || !barcodeText.trim()) return;
        const svgStr = new XMLSerializer().serializeToString(barcodeSvgRef.current);
        const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        const img = new Image();
        await new Promise<void>((res) => {
          img.onload = () => res();
          img.src = url;
        });
        const c = document.createElement('canvas');
        c.width = img.width || 420;
        c.height = img.height || 140;
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        const a = document.createElement('a');
        a.href = c.toDataURL('image/png');
        a.download = `barcode-${barcodeText || 'vcpl'}.png`;
        a.click();
      };

      return (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#2F3E4E] mb-1">Barcode Data Value</label>
              <input
                type="text"
                value={barcodeText}
                onChange={(e) => setBarcodeText(e.target.value)}
                placeholder="Enter SKU, serial, or EAN-13 code..."
                className="w-full px-3.5 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white font-mono text-sm font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#2F3E4E] mb-1">Standard</label>
              <select
                value={barcodeFormat}
                onChange={(e) => setBarcodeFormat(e.target.value as 'CODE128' | 'EAN13' | 'CODE39')}
                className="w-full px-3.5 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white text-sm font-bold"
              >
                <option value="CODE128">CODE 128 (Alphanumeric SKU / Tracking)</option>
                <option value="EAN13">EAN-13 (12 or 13 Numeric Digits)</option>
                <option value="CODE39">CODE 39 (Logistics &amp; Inventory)</option>
              </select>
            </div>
          </div>

          {barcodeError && (
            <p className="text-xs font-bold text-red-700 bg-red-50 border border-red-700 p-3 rounded-xl">
              {barcodeError}
            </p>
          )}

          <div className="p-6 rounded-2xl bg-white border-[1.5px] border-[#2F3E4E] flex flex-col items-center gap-4">
            <svg ref={barcodeSvgRef} />
            {!barcodeText.trim() && (
              <p className="text-xs text-[#64748B]">Enter a barcode value above to generate scannable SVG &amp; PNG output.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={Boolean(barcodeError) || !barcodeText.trim()}
                onClick={downloadBarcodePng}
                className="px-4 py-2 rounded-xl bg-[#2F3E4E] text-[#FFFDF5] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-3.5 h-3.5" /> Download PNG
              </button>
              <button
                type="button"
                onClick={() => {
                  setBarcodeText('');
                  setBarcodeError('');
                }}
                className="px-4 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] text-[#2F3E4E] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Clear
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (tool.id === 'password-generator' || tool.id === 'password-strength-checker') {
      const targetPw = tool.id === 'password-generator' ? generatedPw : checkPwInput;
      const strength = evaluateStrength(targetPw);

      return (
        <div className="space-y-5">
          {tool.id === 'password-generator' ? (
            <div className="p-5 rounded-2xl bg-[#FEF2C8]/55 border-[1.5px] border-[#2F3E4E] space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  readOnly
                  value={generatedPw}
                  placeholder="Click Generate to create a cryptographically strong password"
                  className="flex-1 px-4 py-3 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white font-mono text-base font-bold text-[#2F3E4E]"
                />
                <button
                  type="button"
                  onClick={generateRandomPassword}
                  className="px-4 py-2.5 rounded-xl bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] text-xs font-bold text-[#2F3E4E] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" /> Generate
                </button>
                <button
                  type="button"
                  disabled={!generatedPw}
                  onClick={() => copyText(generatedPw)}
                  className="px-4 py-2.5 rounded-xl bg-[#2F3E4E] text-[#FFFDF5] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-45"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-[#2F3E4E]">
                <label className="flex items-center gap-2">
                  Length: {pwLength}
                  <input
                    type="range"
                    min={8}
                    max={40}
                    value={pwLength}
                    onChange={(e) => setPwLength(Number(e.target.value))}
                    className="accent-[#2F3E4E]"
                  />
                </label>
                {[
                  ['Uppercase A-Z', pwUpper, setPwUpper],
                  ['Lowercase a-z', pwLower, setPwLower],
                  ['Numbers 0-9', pwNumbers, setPwNumbers],
                  ['Symbols !@#', pwSymbols, setPwSymbols],
                ].map(([lbl, checked, setter]) => (
                  <label key={String(lbl)} className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(checked)}
                      onChange={(e) => (setter as React.Dispatch<React.SetStateAction<boolean>>)(e.target.checked)}
                      className="w-4 h-4 accent-[#2F3E4E]"
                    />
                    {String(lbl)}
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-[#2F3E4E] mb-1">
                Test Password Strength Locally (Never Sent Online)
              </label>
              <input
                type="text"
                value={checkPwInput}
                onChange={(e) => setCheckPwInput(e.target.value)}
                placeholder="Type any password to evaluate entropy & rules..."
                className="w-full px-4 py-3 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white font-mono text-base font-bold text-[#2F3E4E]"
              />
            </div>
          )}

          <div className="p-5 rounded-2xl bg-white border-[1.5px] border-[#2F3E4E] space-y-3">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="flex items-center gap-1.5 text-[#2F3E4E]">
                <ShieldCheck className="w-4 h-4" /> Security Score: {strength.score}/100
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-[#CEE5DC] border border-[#2F3E4E] text-[#2F3E4E]">
                {strength.label}
              </span>
            </div>
            <div className="w-full h-3 rounded-full bg-[#FEF2C8] border border-[#2F3E4E] overflow-hidden">
              <div
                className="h-full bg-[#2F3E4E] transition-all"
                style={{ width: `${strength.score}%` }}
              />
            </div>
          </div>

          <ToolExportBar
            onClear={() => {
              setGeneratedPw('');
              setCheckPwInput('');
            }}
            onCopy={() => void copyText(targetPw)}
            copied={copied}
            disabled={!targetPw}
            onJson={() => {
              downloadJsonFile('Password_Audit.json', { length: targetPw.length, score: strength.score, rating: strength.label });
            }}
          />
        </div>
      );
    }

    if (tool.id === 'text-compare-tool') {
      const leftLines = diffLeft.split('\n');
      const rightLines = diffRight.split('\n');
      const maxLen = Math.max(leftLines.length, rightLines.length);

      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#2F3E4E] mb-1">Original Text</label>
              <textarea
                rows={6}
                value={diffLeft}
                onChange={(e) => setDiffLeft(e.target.value)}
                placeholder="Paste original text lines here..."
                className="w-full p-3 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#2F3E4E] mb-1">Modified Text</label>
              <textarea
                rows={6}
                value={diffRight}
                onChange={(e) => setDiffRight(e.target.value)}
                placeholder="Paste modified text lines here..."
                className="w-full p-3 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white font-mono text-xs"
              />
            </div>
          </div>

          <div className="rounded-xl border-[1.5px] border-[#2F3E4E] bg-white overflow-hidden">
            <div className="bg-[#2F3E4E] text-[#FFFDF5] px-4 py-2 text-xs font-bold">
              Line-by-Line Comparison ({maxLen} lines)
            </div>
            <div className="divide-y divide-[#2F3E4E]/15 font-mono text-xs max-h-96 overflow-y-auto">
              {Array.from({ length: maxLen }).map((_, idx) => {
                const l = leftLines[idx] ?? '';
                const r = rightLines[idx] ?? '';
                const same = l === r;
                return (
                  <div
                    key={idx}
                    className={`grid grid-cols-1 md:grid-cols-2 gap-2 px-4 py-2 ${
                      same ? 'bg-white' : 'bg-[#F9C80E]/25'
                    }`}
                  >
                    <div className={same ? 'text-[#475569]' : 'text-red-800 font-bold'}>
                      <span className="text-[#64748B] mr-2">{idx + 1}.</span>
                      {l || '∅'}
                    </div>
                    <div className={same ? 'text-[#475569]' : 'text-emerald-800 font-bold'}>
                      <span className="text-[#64748B] mr-2">{idx + 1}.</span>
                      {r || '∅'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <ToolExportBar
            onClear={() => {
              setDiffLeft('');
              setDiffRight('');
            }}
            onExcel={() => {
              downloadExcelWorkbook({
                filename: 'Text_Diff_Comparison.xlsx',
                sheets: [
                  {
                    name: 'Line_Diff',
                    headers: ['Line #', 'Original', 'Modified', 'Status'],
                    rows: Array.from({ length: maxLen }).map((_, i) => {
                      const l = leftLines[i] ?? '';
                      const r = rightLines[i] ?? '';
                      return [i + 1, l, r, l === r ? 'Match' : 'Changed'];
                    }),
                  },
                ],
              });
            }}
            onCsv={() => {
              downloadBomCsv({
                filename: 'Text_Diff_Comparison.csv',
                headers: ['Line #', 'Original', 'Modified', 'Status'],
                rows: Array.from({ length: maxLen }).map((_, i) => {
                  const l = leftLines[i] ?? '';
                  const r = rightLines[i] ?? '';
                  return [i + 1, l, r, l === r ? 'Match' : 'Changed'];
                }),
              });
            }}
            onWord={() => {
              void downloadWordDocument({
                filename: 'Text_Diff_Comparison.docx',
                title: 'Text Comparison Audit',
                table: {
                  title: `Line-by-Line Comparison (${maxLen} lines)`,
                  headers: ['#', 'Original', 'Modified', 'Status'],
                  rows: Array.from({ length: maxLen }).map((_, i) => {
                    const l = leftLines[i] ?? '';
                    const r = rightLines[i] ?? '';
                    return [String(i + 1), l || '—', r || '—', l === r ? 'Same' : 'Diff'];
                  }),
                },
              });
            }}
            onJson={() => {
              downloadJsonFile('Text_Diff_Comparison.json', {
                lines: Array.from({ length: maxLen }).map((_, i) => ({
                  line: i + 1,
                  original: leftLines[i] ?? '',
                  modified: rightLines[i] ?? '',
                  same: (leftLines[i] ?? '') === (rightLines[i] ?? ''),
                })),
              });
            }}
            onPdf={() => {
              exportStructuredReportPdf({
                title: 'Text Comparison Report',
                filename: 'Text_Diff_Comparison.pdf',
                table: {
                  title: 'Line Differences',
                  headers: ['#', 'Original', 'Modified', 'Status'],
                  rows: Array.from({ length: maxLen }).map((_, i) => {
                    const l = leftLines[i] ?? '';
                    const r = rightLines[i] ?? '';
                    return [String(i + 1), l || '-', r || '-', l === r ? 'Same' : 'Changed'];
                  }),
                },
              });
            }}
            onPrint={() => {
              void printHtmlDocument({
                title: 'Text Diff Comparison',
                bodyHtml: `
                  <h1>Line-by-Line Comparison</h1>
                  <table>
                    <thead><tr><th>#</th><th>Original</th><th>Modified</th><th>Status</th></tr></thead>
                    <tbody>${Array.from({ length: maxLen }).map((_, i) => {
                      const l = leftLines[i] ?? '';
                      const r = rightLines[i] ?? '';
                      return `<tr><td>${i + 1}</td><td>${l}</td><td>${r}</td><td>${l === r ? 'Match' : 'Changed'}</td></tr>`;
                    }).join('')}</tbody>
                  </table>
                `,
              });
            }}
          />
        </div>
      );
    }

    if (
      tool.id === 'url-encoder-decoder' ||
      tool.id === 'base64-encoder-decoder' ||
      tool.id === 'json-formatter' ||
      tool.id === 'xml-formatter'
    ) {
      const runTransform = (mode: 'encode' | 'decode') => {
        setDevError('');
        try {
          if (tool.id === 'url-encoder-decoder') {
            setDevOutput(mode === 'encode' ? encodeURIComponent(devInput) : decodeURIComponent(devInput));
          } else if (tool.id === 'base64-encoder-decoder') {
            if (mode === 'encode') {
              const bytes = new TextEncoder().encode(devInput);
              const bin = Array.from(bytes, (b) => String.fromCharCode(b)).join('');
              setDevOutput(btoa(bin));
            } else {
              const bin = atob(devInput.trim());
              const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
              setDevOutput(new TextDecoder().decode(bytes));
            }
          } else if (tool.id === 'json-formatter') {
            const parsed = JSON.parse(devInput);
            setDevOutput(mode === 'encode' ? JSON.stringify(parsed, null, 2) : JSON.stringify(parsed));
          } else if (tool.id === 'xml-formatter') {
            const compact = devInput.replace(/>\s+</g, '><').trim();
            if (mode === 'decode') {
              setDevOutput(compact);
            } else {
              let indent = 0;
              const formatted = compact
                .replace(/(>)(<)(\/*)/g, '$1\n$2$3')
                .split('\n')
                .map((line) => {
                  if (line.match(/^<\/\w/)) indent = Math.max(0, indent - 1);
                  const pad = '  '.repeat(indent);
                  if (line.match(/^<\w[^>]*[^/]>.*$/) && !line.includes('</')) indent += 1;
                  return `${pad}${line}`;
                })
                .join('\n');
              setDevOutput(formatted);
            }
          }
        } catch (err: any) {
          setDevError(err?.message || 'Could not process input.');
        }
      };

      const isFormatter = tool.id === 'json-formatter' || tool.id === 'xml-formatter';

      return (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => runTransform('encode')}
              className="px-4 py-2 rounded-xl bg-[#2F3E4E] text-[#FFFDF5] text-xs font-bold cursor-pointer"
            >
              {isFormatter ? 'Prettify / Format (2 Spaces)' : 'Encode'}
            </button>
            <button
              type="button"
              onClick={() => runTransform('decode')}
              className="px-4 py-2 rounded-xl bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] text-[#2F3E4E] text-xs font-bold cursor-pointer"
            >
              {isFormatter ? 'Minify / Compact' : 'Decode'}
            </button>
            <button
              type="button"
              onClick={() => copyText(devOutput || devInput)}
              className="px-4 py-2 rounded-xl bg-white border-[1.5px] border-[#2F3E4E] text-[#2F3E4E] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              Copy Output
            </button>
            <button
              type="button"
              onClick={() => {
                setDevInput('');
                setDevOutput('');
                setDevError('');
              }}
              className="px-4 py-2 rounded-xl bg-[#FEF2C8] border-[1.5px] border-[#2F3E4E] text-[#2F3E4E] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Clear
            </button>
          </div>

          {devError && (
            <p className="text-xs font-bold text-red-700 bg-red-50 border border-red-700 p-3 rounded-xl">
              {devError}
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#2F3E4E] mb-1">Input Payload</label>
              <textarea
                rows={8}
                value={devInput}
                onChange={(e) => setDevInput(e.target.value)}
                placeholder="Paste your JSON, XML, URL, or Base64 payload here..."
                className="w-full p-3 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#2F3E4E] mb-1">Processed Result</label>
              <textarea
                rows={8}
                readOnly
                value={devOutput}
                placeholder="Click Format / Encode above to preview output..."
                className="w-full p-3 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8]/45 font-mono text-xs"
              />
            </div>
          </div>

          <ToolExportBar
            onClear={() => {
              setDevInput('');
              setDevOutput('');
              setDevError('');
            }}
            onCopy={() => void copyText(devOutput || devInput)}
            copied={copied}
            disabled={!(devOutput || devInput)}
            onJson={() => {
              downloadJsonFile(`${tool.id}.json`, { input: devInput, output: devOutput });
            }}
          />
        </div>
      );
    }

    if (tool.id === 'unit-converter') {
      const n = parseFloat(unitVal) || 0;
      let converted = 0;
      if (unitCategory === 'length') {
        const f = LENGTH_UNITS[fromUnit] || LENGTH_UNITS.km;
        const t = LENGTH_UNITS[toUnit] || LENGTH_UNITS.mi;
        converted = (n * f.toMeter) / t.toMeter;
      } else if (unitCategory === 'weight') {
        const f = WEIGHT_UNITS[fromUnit] || WEIGHT_UNITS.kg;
        const t = WEIGHT_UNITS[toUnit] || WEIGHT_UNITS.lb;
        converted = (n * f.toKg) / t.toKg;
      } else {
        let c = n;
        if (fromUnit === 'F') c = ((n - 32) * 5) / 9;
        else if (fromUnit === 'K') c = n - 273.15;
        if (toUnit === 'F') converted = (c * 9) / 5 + 32;
        else if (toUnit === 'K') converted = c + 273.15;
        else converted = c;
      }

      const unitOptions =
        unitCategory === 'length'
          ? Object.entries(LENGTH_UNITS).map(([k, v]) => ({ k, label: v.label }))
          : unitCategory === 'weight'
          ? Object.entries(WEIGHT_UNITS).map(([k, v]) => ({ k, label: v.label }))
          : [
              { k: 'C', label: 'Celsius (°C)' },
              { k: 'F', label: 'Fahrenheit (°F)' },
              { k: 'K', label: 'Kelvin (K)' },
            ];

      return (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['length', 'Length', 'km', 'mi'],
                ['weight', 'Weight & Mass', 'kg', 'lb'],
                ['temp', 'Temperature', 'C', 'F'],
              ] as const
            ).map(([cat, label, defFrom, defTo]) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setUnitCategory(cat);
                  setFromUnit(defFrom);
                  setToUnit(defTo);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold border-[1.5px] border-[#2F3E4E] cursor-pointer ${
                  unitCategory === cat ? 'bg-[#2F3E4E] text-[#FFFDF5]' : 'bg-white text-[#2F3E4E]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end p-5 rounded-2xl bg-[#FEF2C8]/50 border-[1.5px] border-[#2F3E4E]">
            <div>
              <label className="block text-xs font-bold text-[#2F3E4E] mb-1">Value</label>
              <input
                type="number"
                value={unitVal}
                onChange={(e) => setUnitVal(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white font-mono text-base font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#2F3E4E] mb-1">From Unit</label>
              <select
                value={fromUnit}
                onChange={(e) => setFromUnit(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white text-xs font-bold"
              >
                {unitOptions.map((o) => (
                  <option key={o.k} value={o.k}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#2F3E4E] mb-1">To Unit</label>
              <select
                value={toUnit}
                onChange={(e) => setToUnit(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white text-xs font-bold"
              >
                {unitOptions.map((o) => (
                  <option key={o.k} value={o.k}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-[#CEE5DC]/55 border-[1.5px] border-[#2F3E4E] text-center">
            <p className="text-xs font-bold uppercase text-[#475569]">Converted Output</p>
            <p className="font-mono tabular-nums font-extrabold text-3xl text-[#2F3E4E] mt-1">
              {Number(converted.toFixed(4))} {toUnit}
            </p>
          </div>

          <ToolExportBar
            onClear={() => setUnitVal('')}
            onCopy={() => void copyText(`${Number(converted.toFixed(4))} ${toUnit}`)}
            copied={copied}
            onExcel={() => {
              downloadExcelWorkbook({
                filename: `Unit_Conversion_${unitCategory}.xlsx`,
                sheets: [
                  {
                    name: 'Conversion',
                    headers: ['Category', 'Input Value', 'From', 'Converted Value', 'To'],
                    rows: [[unitCategory, n, fromUnit, Number(converted.toFixed(4)), toUnit]],
                  },
                ],
              });
            }}
            onJson={() => {
              downloadJsonFile(`Unit_Conversion_${unitCategory}.json`, { unitCategory, input: n, fromUnit, converted: Number(converted.toFixed(4)), toUnit });
            }}
            onPdf={() => {
              exportStructuredReportPdf({
                title: 'Unit Conversion Result',
                filename: `Unit_Conversion_${unitCategory}.pdf`,
                kpis: [
                  { label: 'Input', value: `${n} ${fromUnit}` },
                  { label: 'Converted', value: `${Number(converted.toFixed(4))} ${toUnit}` },
                ],
              });
            }}
          />
        </div>
      );
    }

    if (tool.id === 'storage-converter') {
      const n = parseFloat(storageVal) || 0;
      const baseBytes = n * (STORAGE_UNITS[storageUnit]?.bytes || 1);

      return (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 rounded-2xl bg-[#FEF2C8]/50 border-[1.5px] border-[#2F3E4E]">
            <div>
              <label className="block text-xs font-bold text-[#2F3E4E] mb-1">Data Size</label>
              <input
                type="number"
                value={storageVal}
                onChange={(e) => setStorageVal(e.target.value)}
                placeholder="0"
                className="w-full px-3.5 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white font-mono text-base font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#2F3E4E] mb-1">Unit</label>
              <select
                value={storageUnit}
                onChange={(e) => setStorageUnit(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white text-xs font-bold"
              >
                {Object.entries(STORAGE_UNITS).map(([k, u]) => (
                  <option key={k} value={k}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {Object.entries(STORAGE_UNITS).map(([k, u]) => (
              <div key={k} className="p-4 rounded-xl bg-white border-[1.5px] border-[#2F3E4E]">
                <p className="text-[11px] font-bold text-[#64748B]">{k}</p>
                <p className="font-mono tabular-nums font-extrabold text-sm text-[#2F3E4E] mt-1 break-all">
                  {(baseBytes / u.bytes).toLocaleString('en-IN', { maximumFractionDigits: 4 })}
                </p>
              </div>
            ))}
          </div>

          <ToolExportBar
            onClear={() => setStorageVal('')}
            onExcel={() => {
              downloadExcelWorkbook({
                filename: 'Storage_Unit_Conversion.xlsx',
                sheets: [
                  {
                    name: 'Storage_Units',
                    headers: ['Unit', 'Label', 'Equivalent Value'],
                    rows: Object.entries(STORAGE_UNITS).map(([k, u]) => [k, u.label, Number((baseBytes / u.bytes).toFixed(4))]),
                  },
                ],
              });
            }}
            onJson={() => {
              downloadJsonFile(
                'Storage_Unit_Conversion.json',
                Object.fromEntries(Object.entries(STORAGE_UNITS).map(([k, u]) => [k, baseBytes / u.bytes]))
              );
            }}
          />
        </div>
      );
    }

    if (tool.id === 'stopwatch') {
      return (
        <div className="space-y-5 text-center">
          <div className="p-8 rounded-2xl bg-[#FEF2C8]/65 border-[1.5px] border-[#2F3E4E]">
            <p className="font-mono tabular-nums font-extrabold text-5xl sm:text-6xl text-[#2F3E4E]">
              {formatDurationMs(swMs)}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => setSwRunning((r) => !r)}
                className="px-5 py-2.5 rounded-xl bg-[#2F3E4E] text-[#FFFDF5] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                {swRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {swRunning ? 'Pause' : 'Start'}
              </button>
              <button
                type="button"
                onClick={() => setLaps((prev) => [swMs, ...prev])}
                className="px-5 py-2.5 rounded-xl bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] text-[#2F3E4E] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Flag className="w-4 h-4" /> Lap
              </button>
              <button
                type="button"
                onClick={() => {
                  setSwRunning(false);
                  setSwMs(0);
                  setLaps([]);
                }}
                className="px-5 py-2.5 rounded-xl bg-white border-[1.5px] border-[#2F3E4E] text-[#2F3E4E] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" /> Reset
              </button>
            </div>
          </div>

          {laps.length > 0 && (
            <>
              <div className="max-w-md mx-auto rounded-xl border-[1.5px] border-[#2F3E4E] bg-white divide-y divide-[#2F3E4E]/15 text-xs max-h-60 overflow-y-auto">
                {laps.map((lapMs, idx) => (
                  <div key={idx} className="px-4 py-2.5 flex justify-between font-mono font-bold">
                    <span>Lap #{laps.length - idx}</span>
                    <span>{formatDurationMs(lapMs)}</span>
                  </div>
                ))}
              </div>
              <ToolExportBar
                onClear={() => setLaps([])}
                onExcel={() => {
                  downloadExcelWorkbook({
                    filename: 'Stopwatch_Laps.xlsx',
                    sheets: [
                      {
                        name: 'Laps',
                        headers: ['Lap #', 'Time'],
                        rows: laps.map((ms, i) => [laps.length - i, formatDurationMs(ms)]),
                      },
                    ],
                  });
                }}
                onCsv={() => {
                  downloadBomCsv({
                    filename: 'Stopwatch_Laps.csv',
                    headers: ['Lap #', 'Time'],
                    rows: laps.map((ms, i) => [laps.length - i, formatDurationMs(ms)]),
                  });
                }}
                onJson={() => {
                  downloadJsonFile('Stopwatch_Laps.json', laps.map((ms, i) => ({ lap: laps.length - i, time: formatDurationMs(ms) })));
                }}
              />
            </>
          )}
        </div>
      );
    }

    // Countdown timer
    const mins = Math.floor(cdRemainingSec / 60);
    const secs = cdRemainingSec % 60;
    return (
      <div className="space-y-5 text-center">
        <div className="p-8 rounded-2xl bg-[#CEE5DC]/55 border-[1.5px] border-[#2F3E4E]">
          <p className="font-mono tabular-nums font-extrabold text-5xl sm:text-6xl text-[#2F3E4E]">
            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {[1, 5, 10, 15, 25, 60].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setCdRunning(false);
                  setCdMinutes(m);
                  setCdRemainingSec(m * 60);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border border-[#2F3E4E] cursor-pointer ${
                  cdMinutes === m ? 'bg-[#F9C80E] text-[#2F3E4E]' : 'bg-white text-[#2F3E4E]'
                }`}
              >
                {m} Min
              </button>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => setCdRunning((r) => !r)}
              className="px-5 py-2.5 rounded-xl bg-[#2F3E4E] text-[#FFFDF5] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              {cdRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {cdRunning ? 'Pause' : 'Start Timer'}
            </button>
            <button
              type="button"
              onClick={() => {
                setCdRunning(false);
                setCdRemainingSec(cdMinutes * 60);
              }}
              className="px-5 py-2.5 rounded-xl bg-white border-[1.5px] border-[#2F3E4E] text-[#2F3E4E] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" /> Reset
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-6 sm:p-8 space-y-6">
      <div className="pb-5 border-b border-[#2F3E4E]/15">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] flex items-center gap-1.5">
          {tool.id.includes('password') ? (
            <KeyRound className="w-3.5 h-3.5 text-[#2F3E4E]" />
          ) : tool.id.includes('json') || tool.id.includes('xml') || tool.id.includes('url') || tool.id.includes('base64') ? (
            <Code className="w-3.5 h-3.5 text-[#2F3E4E]" />
          ) : (
            <Wrench className="w-3.5 h-3.5 text-[#2F3E4E]" />
          )}
          {tool.categoryName} · {tool.code}
        </span>
        <h1 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] mt-1">
          {tool.title}
        </h1>
        <p className="text-xs sm:text-sm text-[#475569] mt-0.5">{tool.description}</p>
      </div>

      {renderToolContent()}
    </div>
  );
};
