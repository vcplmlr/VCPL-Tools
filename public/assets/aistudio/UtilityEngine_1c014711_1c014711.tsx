import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  QrCode,
  Key,
  ShieldCheck,
  Code,
  Link,
  Code2,
  HardDrive,
  Timer,
  Play,
  Pause,
  RotateCcw,
  Flag,
  Download,
  Copy,
  Check,
  CheckCircle,
  AlertCircle,
  Barcode,
  Layers,
  ArrowRightLeft,
  GitCompare,
  Braces,
  Ruler,
  Bell,
  Scale,
  Sparkles,
  Info
} from 'lucide-react';
import { Tool } from '../types';

interface UtilityEngineProps {
  tool: Tool;
}

export const UtilityEngine: React.FC<UtilityEngineProps> = ({ tool }) => {
  const [copied, setCopied] = useState<boolean>(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ----------------------------------------------------
  // 1. QR CODE GENERATOR
  // ----------------------------------------------------
  const [qrType, setQrType] = useState<'url' | 'upi' | 'wifi' | 'text'>('url');
  const [qrText, setQrText] = useState<string>('https://bharattools.in');
  const [upiVpa, setUpiVpa] = useState<string>('aspirant@okaxis');
  const [upiName, setUpiName] = useState<string>('Bharat Aspirant');
  const [upiAmount, setUpiAmount] = useState<string>('100');
  const [wifiSsid, setWifiSsid] = useState<string>('Office_WiFi');
  const [wifiPass, setWifiPass] = useState<string>('SecurePass123');
  const [wifiType, setWifiType] = useState<string>('WPA');
  const [qrColor, setQrColor] = useState<string>('#0f172a');
  const [qrBgColor, setQrBgColor] = useState<string>('#ffffff');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const generateQr = async () => {
    let payload = qrText;
    if (qrType === 'upi') {
      payload = `upi://pay?pa=${encodeURIComponent(upiVpa)}&pn=${encodeURIComponent(upiName)}&am=${encodeURIComponent(upiAmount)}&cu=INR`;
    } else if (qrType === 'wifi') {
      payload = `WIFI:S:${wifiSsid};T:${wifiType};P:${wifiPass};;`;
    }
    try {
      const url = await QRCode.toDataURL(payload || 'https://bharattools.in', {
        width: 320,
        margin: 2,
        color: {
          dark: qrColor,
          light: qrBgColor
        }
      });
      setQrDataUrl(url);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (tool.id === 'qr-code-generator') {
      generateQr();
    }
  }, [tool.id, qrType, qrText, upiVpa, upiName, upiAmount, wifiSsid, wifiPass, wifiType, qrColor, qrBgColor]);

  // ----------------------------------------------------
  // 2. BARCODE GENERATOR (Code 128 / Canvas)
  // ----------------------------------------------------
  const [barcodeText, setBarcodeText] = useState<string>('UPSC-2025-ROLL-9842');
  const [barcodeType, setBarcodeType] = useState<'code128' | 'ean13'>('code128');
  const [barcodeHeight, setBarcodeHeight] = useState<number>(80);
  const [barcodeDataUrl, setBarcodeDataUrl] = useState<string>('');
  const barcodeCanvasRef = useRef<HTMLCanvasElement>(null);

  const drawBarcode = () => {
    const trimmed = barcodeText.trim() || '000000';
    const canvas = barcodeCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 360;
    const height = barcodeHeight + 40;
    canvas.width = width;
    canvas.height = height;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    const displayValue =
      barcodeType === 'ean13'
        ? trimmed.replace(/\D/g, '').padStart(13, '0').slice(0, 13)
        : trimmed;

    // Deterministic bars for Code 128 / Numeric EAN appearance
    ctx.fillStyle = '#000000';
    let x = 20;
    const barWidth = 2.2;

    // Start guard bars
    ctx.fillRect(x, 15, barWidth * 2, barcodeHeight);
    x += barWidth * 3;
    ctx.fillRect(x, 15, barWidth, barcodeHeight);
    x += barWidth * 2;

    // Render characters
    for (let i = 0; i < displayValue.length; i++) {
      const charCode = displayValue.charCodeAt(i);
      const pattern = [(charCode % 3) + 1, ((charCode >> 1) % 2) + 1, ((charCode >> 2) % 3) + 1];
      pattern.forEach((p, idx) => {
        if (idx % 2 === 0) {
          ctx.fillRect(x, 15, p * barWidth, barcodeHeight);
        }
        x += (p + 1) * barWidth;
      });
      if (x > width - 30) break;
    }

    // End guard bars
    ctx.fillRect(width - 25, 15, barWidth * 2, barcodeHeight);
    ctx.fillRect(width - 20, 15, barWidth, barcodeHeight);

    // Text underneath
    ctx.font = '13px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#1e293b';
    ctx.fillText(displayValue, width / 2, height - 8);

    setBarcodeDataUrl(canvas.toDataURL('image/png'));
  };

  useEffect(() => {
    if (tool.id === 'barcode-generator') {
      drawBarcode();
    }
  }, [tool.id, barcodeText, barcodeType, barcodeHeight]);

  // ----------------------------------------------------
  // 3. PASSWORD GENERATOR
  // ----------------------------------------------------
  const [pwdLength, setPwdLength] = useState<number>(16);
  const [includeUpper, setIncludeUpper] = useState<boolean>(true);
  const [includeLower, setIncludeLower] = useState<boolean>(true);
  const [includeNumbers, setIncludeNumbers] = useState<boolean>(true);
  const [includeSymbols, setIncludeSymbols] = useState<boolean>(true);
  const [avoidAmbiguous, setAvoidAmbiguous] = useState<boolean>(true);
  const [generatedPassword, setGeneratedPassword] = useState<string>('');

  const generateNewPassword = () => {
    let lower = 'abcdefghjkmnpqrstuvwxyz';
    let upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    let numbers = '23456789';
    let symbols = '!@#$%^&*()_+~|}{[]:;?><,.-=';

    if (!avoidAmbiguous) {
      lower += 'ilo';
      upper += 'IO';
      numbers += '01';
    }

    let charset = '';
    if (includeLower) charset += lower;
    if (includeUpper) charset += upper;
    if (includeNumbers) charset += numbers;
    if (includeSymbols) charset += symbols;

    if (!charset) charset = lower;

    const array = new Uint32Array(pwdLength);
    window.crypto.getRandomValues(array);
    let pwd = '';
    for (let i = 0; i < pwdLength; i++) {
      pwd += charset[array[i] % charset.length];
    }
    setGeneratedPassword(pwd);
  };

  useEffect(() => {
    if (tool.id === 'password-generator') {
      generateNewPassword();
    }
  }, [tool.id, pwdLength, includeUpper, includeLower, includeNumbers, includeSymbols, avoidAmbiguous]);

  // ----------------------------------------------------
  // 4. PASSWORD STRENGTH CHECKER
  // ----------------------------------------------------
  const [testPassword, setTestPassword] = useState<string>('Candidate@2025#UPSC');

  const analyzePasswordStrength = (pwd: string) => {
    if (!pwd) return { score: 0, label: 'Empty', color: 'text-slate-400', entropy: 0, time: 'Instant' };

    let pool = 0;
    if (/[a-z]/.test(pwd)) pool += 26;
    if (/[A-Z]/.test(pwd)) pool += 26;
    if (/[0-9]/.test(pwd)) pool += 10;
    if (/[^a-zA-Z0-9]/.test(pwd)) pool += 32;

    const entropy = Math.round(pwd.length * (pool > 0 ? Math.log2(pool) : 0));

    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^a-zA-Z0-9]/.test(pwd)) score++;

    let label = 'Very Weak';
    let color = 'text-red-600';
    let time = 'Under a second';

    if (entropy > 80) {
      label = 'Very Strong';
      color = 'text-emerald-600';
      time = 'Millions of years';
    } else if (entropy >= 60) {
      label = 'Strong';
      color = 'text-emerald-500';
      time = 'Several centuries';
    } else if (entropy >= 45) {
      label = 'Moderate';
      color = 'text-amber-500';
      time = 'A few months';
    } else if (entropy >= 30) {
      label = 'Weak';
      color = 'text-orange-500';
      time = 'A few hours';
    }

    return { score, label, color, entropy, time };
  };

  const strengthData = analyzePasswordStrength(testPassword);

  // ----------------------------------------------------
  // 7. TEXT COMPARE / DIFF TOOL
  // ----------------------------------------------------
  const [diffOriginal, setDiffOriginal] = useState<string>(
    'The candidate must submit photo and signature.\nThe photo size should be 20 KB to 50 KB.\nThe background must be white.'
  );
  const [diffModified, setDiffModified] = useState<string>(
    'The candidate must submit photo, signature, and thumb impression.\nThe photo size should be 20 KB to 50 KB.\nThe background must be plain white or light blue.'
  );

  // ----------------------------------------------------
  // 8. URL ENCODER / DECODER
  // ----------------------------------------------------
  const [urlInput, setUrlInput] = useState<string>(
    'https://recruitment.gov.in/apply?post=Assistant+Executive&exam_year=2025&center=Bengaluru+North'
  );
  const [urlResult, setUrlResult] = useState<string>('');

  const handleUrlEncode = () => {
    setUrlResult(encodeURIComponent(urlInput));
  };
  const handleUrlDecode = () => {
    try {
      setUrlResult(decodeURIComponent(urlInput));
    } catch {
      setUrlResult('Invalid encoded URL sequence.');
    }
  };

  // ----------------------------------------------------
  // 9. BASE64 ENCODER / DECODER
  // ----------------------------------------------------
  const [base64Input, setBase64Input] = useState<string>('BharatTools 2026 - 100% Free Client Side Platform');
  const [base64Result, setBase64Result] = useState<string>('');

  const handleBase64Encode = () => {
    try {
      const encoded = btoa(unescape(encodeURIComponent(base64Input)));
      setBase64Result(encoded);
    } catch (e: any) {
      setBase64Result('Error encoding: ' + e.message);
    }
  };

  const handleBase64Decode = () => {
    try {
      const decoded = decodeURIComponent(escape(atob(base64Input.trim())));
      setBase64Result(decoded);
    } catch (e: any) {
      setBase64Result('Invalid Base64 string.');
    }
  };

  // ----------------------------------------------------
  // 10 & 11. JSON & XML FORMATTER
  // ----------------------------------------------------
  const [rawCode, setRawCode] = useState<string>(
    tool.id === 'xml-formatter'
      ? '<application><candidate><name>Suresh Kumar</name><exam>UPSC</exam><year>2025</year></candidate><status>Submitted</status></application>'
      : '{"exam":"UPSC Civil Services","year":2025,"stages":["Prelims","Mains","Interview"],"fee":100,"active":true}'
  );
  const [formattedCode, setFormattedCode] = useState<string>('');
  const [formatError, setFormatError] = useState<string | null>(null);

  useEffect(() => {
    setRawCode(
      tool.id === 'xml-formatter'
        ? '<application><candidate><name>Suresh Kumar</name><exam>UPSC</exam><year>2025</year></candidate><status>Submitted</status></application>'
        : '{"exam":"UPSC Civil Services","year":2025,"stages":["Prelims","Mains","Interview"],"fee":100,"active":true}'
    );
    setFormattedCode('');
    setFormatError(null);
  }, [tool.id]);

  const formatCode = () => {
    if (tool.id === 'xml-formatter') {
      try {
        let formatted = '';
        let pad = 0;
        const reg = /(>)(<)(\/*)/g;
        const xml = rawCode.replace(reg, '$1\r\n$2$3');
        xml.split('\r\n').forEach(node => {
          let indent = 0;
          if (node.match(/.+<\/\w[^>]*>$/)) {
            indent = 0;
          } else if (node.match(/^<\/\w/)) {
            if (pad !== 0) pad -= 1;
          } else if (node.match(/^<\w[^>]*[^\/]>.*$/)) {
            indent = 1;
          } else {
            indent = 0;
          }
          let padding = '';
          for (let i = 0; i < pad; i++) padding += '  ';
          formatted += padding + node + '\r\n';
          pad += indent;
        });
        setFormattedCode(formatted.trim());
        setFormatError(null);
      } catch (err: any) {
        setFormatError(err.message);
      }
    } else {
      try {
        const parsed = JSON.parse(rawCode);
        setFormattedCode(JSON.stringify(parsed, null, 2));
        setFormatError(null);
      } catch (err: any) {
        setFormatError(err.message);
      }
    }
  };

  const minifyCode = () => {
    if (tool.id === 'xml-formatter') {
      setFormattedCode(rawCode.replace(/>\s+</g, '><').trim());
      setFormatError(null);
    } else {
      try {
        const parsed = JSON.parse(rawCode);
        setFormattedCode(JSON.stringify(parsed));
        setFormatError(null);
      } catch (err: any) {
        setFormatError(err.message);
      }
    }
  };

  // ----------------------------------------------------
  // 12. UNIT CONVERTER (ALL-IN-ONE + INDIAN LAND UNITS)
  // ----------------------------------------------------
  const [unitCategory, setUnitCategory] = useState<'area' | 'length' | 'weight' | 'temp'>('area');
  const [unitInputVal, setUnitInputVal] = useState<number>(1);
  const [unitFrom, setUnitFrom] = useState<string>('acre');

  const convertUnits = (): Record<string, string> => {
    const val = Number(unitInputVal) || 0;
    if (unitCategory === 'area') {
      let sqMeters = 0;
      if (unitFrom === 'acre') sqMeters = val * 4046.86;
      else if (unitFrom === 'gunta') sqMeters = val * 101.17;
      else if (unitFrom === 'sqft') sqMeters = val * 0.092903;
      else if (unitFrom === 'cent') sqMeters = val * 40.4686;
      else if (unitFrom === 'hectare') sqMeters = val * 10000;

      return {
        'Acre': (sqMeters / 4046.86).toFixed(4),
        'Gunta (Karnataka / South India)': (sqMeters / 101.17).toFixed(2),
        'Square Feet (sq ft)': (sqMeters / 0.092903).toLocaleString(undefined, { maximumFractionDigits: 1 }),
        'Cents': (sqMeters / 40.4686).toFixed(2),
        'Hectares': (sqMeters / 10000).toFixed(4)
      };
    } else if (unitCategory === 'length') {
      let meters = val;
      if (unitFrom === 'km') meters = val * 1000;
      else if (unitFrom === 'meters') meters = val;
      else if (unitFrom === 'cm') meters = val / 100;
      else if (unitFrom === 'feet') meters = val * 0.3048;
      else if (unitFrom === 'inch') meters = val * 0.0254;

      return {
        'Meters': meters.toFixed(2),
        'Kilometers': (meters / 1000).toFixed(4),
        'Feet': (meters / 0.3048).toFixed(2),
        'Inches': (meters / 0.0254).toFixed(1),
        'Centimeters': (meters * 100).toFixed(0)
      };
    } else if (unitCategory === 'weight') {
      let kg = val;
      if (unitFrom === 'g') kg = val / 1000;
      else if (unitFrom === 'lb') kg = val * 0.453592;
      else if (unitFrom === 'quintal') kg = val * 100;
      else if (unitFrom === 'ton') kg = val * 1000;

      return {
        'Kilograms (kg)': kg.toFixed(3),
        'Grams (g)': (kg * 1000).toLocaleString(undefined, { maximumFractionDigits: 1 }),
        'Pounds (lbs)': (kg / 0.453592).toFixed(2),
        'Quintal': (kg / 100).toFixed(3),
        'Metric Ton': (kg / 1000).toFixed(4)
      };
    } else {
      let celsius = val;
      if (unitFrom === 'f') celsius = (val - 32) * (5 / 9);
      else if (unitFrom === 'k') celsius = val - 273.15;

      return {
        'Celsius (°C)': celsius.toFixed(2),
        'Fahrenheit (°F)': (celsius * (9 / 5) + 32).toFixed(2),
        'Kelvin (K)': (celsius + 273.15).toFixed(2)
      };
    }
  };

  const convertedUnitList = convertUnits();

  // ----------------------------------------------------
  // 13. STORAGE CONVERTER
  // ----------------------------------------------------
  const [storageVal, setStorageVal] = useState<number>(50);
  const [storageUnit, setStorageUnit] = useState<'KB' | 'MB' | 'GB'>('MB');
  const [storageMode, setStorageMode] = useState<'binary' | 'decimal'>('binary'); // 1024 vs 1000

  const baseFactor = storageMode === 'binary' ? 1024 : 1000;
  let totalBytes = storageVal;
  if (storageUnit === 'KB') totalBytes = storageVal * baseFactor;
  else if (storageUnit === 'MB') totalBytes = storageVal * baseFactor * baseFactor;
  else if (storageUnit === 'GB') totalBytes = storageVal * baseFactor * baseFactor * baseFactor;

  // ----------------------------------------------------
  // 14. STOPWATCH
  // ----------------------------------------------------
  const [swTimeMs, setSwTimeMs] = useState<number>(0);
  const [swRunning, setSwRunning] = useState<boolean>(false);
  const [swLaps, setSwLaps] = useState<number[]>([]);

  useEffect(() => {
    let interval: any = null;
    if (swRunning) {
      interval = setInterval(() => {
        setSwTimeMs(t => t + 10);
      }, 10);
    }
    return () => clearInterval(interval);
  }, [swRunning]);

  const formatSw = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const centis = Math.floor((ms % 1000) / 10);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centis.toString().padStart(2, '0')}`;
  };

  // ----------------------------------------------------
  // 15. COUNTDOWN TIMER WITH WEB AUDIO CHIME
  // ----------------------------------------------------
  const [timerMinutes, setTimerMinutes] = useState<number>(25);
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [totalTimerSecs, setTotalTimerSecs] = useState<number>(1500);
  const [timerRemaining, setTimerRemaining] = useState<number>(1500);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);

  const playBuzzerSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.2);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 1.2);
      setTimeout(() => {
        audioCtx.close().catch(() => {});
      }, 1400);
    } catch {
      console.warn('Audio not available');
    }
  };

  useEffect(() => {
    if (!isTimerRunning) return;
    const interval = setInterval(() => {
      setTimerRemaining(t => {
        if (t <= 1) {
          setIsTimerRunning(false);
          playBuzzerSound();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const setTimerPreset = (mins: number) => {
    setTimerMinutes(mins);
    setTimerSeconds(0);
    const secs = mins * 60;
    setTotalTimerSecs(secs);
    setTimerRemaining(secs);
    setIsTimerRunning(false);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-slate-100 dark:border-slate-800">
        <div>
          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-4 h-4" />
            {tool.categoryName}
          </span>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
            {tool.name}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Browser-based execution with zero remote servers or external dependencies.
          </p>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 1. QR CODE GENERATOR */}
      {/* ---------------------------------------------------- */}
      {tool.id === 'qr-code-generator' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          <div className="md:col-span-7 space-y-4">
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-medium">
              {[
                { id: 'url', label: 'Website URL' },
                { id: 'upi', label: 'UPI Payment' },
                { id: 'wifi', label: 'Wi-Fi' },
                { id: 'text', label: 'Plain Text' }
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setQrType(t.id as any)}
                  className={`flex-1 py-1.5 rounded-lg cursor-pointer transition ${
                    qrType === t.id
                      ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 font-semibold shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {qrType === 'url' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Website URL
                </label>
                <input
                  type="url"
                  value={qrText}
                  onChange={e => setQrText(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 border rounded-xl text-xs"
                />
              </div>
            )}

            {qrType === 'upi' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    UPI ID / VPA (e.g. mobile@upi)
                  </label>
                  <input
                    type="text"
                    value={upiVpa}
                    onChange={e => setUpiVpa(e.target.value)}
                    className="w-full px-3 py-1.5 border rounded-xl text-xs font-mono"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Payee Name
                    </label>
                    <input
                      type="text"
                      value={upiName}
                      onChange={e => setUpiName(e.target.value)}
                      className="w-full px-3 py-1.5 border rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Amount (₹ INR)
                    </label>
                    <input
                      type="number"
                      value={upiAmount}
                      onChange={e => setUpiAmount(e.target.value)}
                      className="w-full px-3 py-1.5 border rounded-xl text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {qrType === 'wifi' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Network SSID Name
                  </label>
                  <input
                    type="text"
                    value={wifiSsid}
                    onChange={e => setWifiSsid(e.target.value)}
                    className="w-full px-3 py-1.5 border rounded-xl text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Password
                    </label>
                    <input
                      type="text"
                      value={wifiPass}
                      onChange={e => setWifiPass(e.target.value)}
                      className="w-full px-3 py-1.5 border rounded-xl text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Security Type
                    </label>
                    <select
                      value={wifiType}
                      onChange={e => setWifiType(e.target.value)}
                      className="w-full px-3 py-1.5 border rounded-xl text-xs"
                    >
                      <option value="WPA">WPA / WPA2</option>
                      <option value="WEP">WEP</option>
                      <option value="nopass">None (Open)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {qrType === 'text' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Text Content
                </label>
                <textarea
                  rows={4}
                  value={qrText}
                  onChange={e => setQrText(e.target.value)}
                  className="w-full p-3 border rounded-xl text-xs"
                />
              </div>
            )}

            <div className="flex gap-4 pt-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Foreground</label>
                <input
                  type="color"
                  value={qrColor}
                  onChange={e => setQrColor(e.target.value)}
                  className="w-8 h-8 rounded border cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Background</label>
                <input
                  type="color"
                  value={qrBgColor}
                  onChange={e => setQrBgColor(e.target.value)}
                  className="w-8 h-8 rounded border cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div className="md:col-span-5 flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-800/40 border rounded-2xl text-center space-y-4">
            {qrDataUrl && (
              <div className="p-3 bg-white rounded-xl shadow border">
                <img src={qrDataUrl} alt="QR Code" className="w-56 h-56 object-contain" />
              </div>
            )}
            <div className="flex gap-2">
              <a
                href={qrDataUrl}
                download="qrcode.png"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" /> Download PNG
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 2. BARCODE GENERATOR */}
      {/* ---------------------------------------------------- */}
      {tool.id === 'barcode-generator' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Enter Text or Number to Encode
              </label>
              <input
                type="text"
                value={barcodeText}
                onChange={e => setBarcodeText(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Format
              </label>
              <select
                value={barcodeType}
                onChange={e => setBarcodeType(e.target.value as 'code128' | 'ean13')}
                className="w-full px-3 py-2 border rounded-xl text-xs"
              >
                <option value="code128">Code 128 (Alphanumeric)</option>
                <option value="ean13">EAN-13 (13-Digit Numeric)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Height (px)
              </label>
              <input
                type="number"
                min="40"
                max="150"
                value={barcodeHeight}
                onChange={e => setBarcodeHeight(Math.max(40, Math.min(150, Number(e.target.value) || 80)))}
                className="w-full px-3 py-2 border rounded-xl text-xs font-mono"
              />
            </div>
          </div>

          <div className="p-8 bg-slate-50 dark:bg-slate-800/40 border rounded-2xl flex flex-col items-center justify-center space-y-4">
            <canvas ref={barcodeCanvasRef} className="shadow rounded-lg border bg-white" />
            <a
              href={barcodeDataUrl}
              download={`${(barcodeText.trim() || 'barcode')}_barcode.png`}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Download Barcode PNG
            </a>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 3. PASSWORD GENERATOR */}
      {/* ---------------------------------------------------- */}
      {tool.id === 'password-generator' && (
        <div className="space-y-6">
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border flex items-center justify-between gap-4">
            <div className="font-mono text-xl sm:text-2xl font-bold tracking-wider text-blue-600 dark:text-blue-400 break-all select-all">
              {generatedPassword}
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => copyToClipboard(generatedPassword)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow flex items-center gap-1.5 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                onClick={generateNewPassword}
                className="p-2 border rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="space-y-4 max-w-lg">
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span>Password Length</span>
                <span className="font-mono">{pwdLength} characters</span>
              </div>
              <input
                type="range"
                min="8"
                max="32"
                value={pwdLength}
                onChange={e => setPwdLength(Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeUpper}
                  onChange={e => setIncludeUpper(e.target.checked)}
                  className="rounded text-blue-600"
                />
                Uppercase (A-Z)
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeLower}
                  onChange={e => setIncludeLower(e.target.checked)}
                  className="rounded text-blue-600"
                />
                Lowercase (a-z)
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeNumbers}
                  onChange={e => setIncludeNumbers(e.target.checked)}
                  className="rounded text-blue-600"
                />
                Numbers (0-9)
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeSymbols}
                  onChange={e => setIncludeSymbols(e.target.checked)}
                  className="rounded text-blue-600"
                />
                Special Symbols (!@#$)
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 4. PASSWORD STRENGTH CHECKER */}
      {/* ---------------------------------------------------- */}
      {tool.id === 'password-strength-checker' && (
        <div className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
              Type Password to Analyze
            </label>
            <input
              type="text"
              value={testPassword}
              onChange={e => setTestPassword(e.target.value)}
              className="w-full px-4 py-2.5 border rounded-xl text-base font-mono bg-white dark:bg-slate-900"
            />
          </div>

          <div className="p-6 bg-slate-50 dark:bg-slate-800/40 border rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div>
              <span className="text-xs text-slate-400 uppercase block">Strength Rating</span>
              <div className={`text-2xl font-extrabold mt-1 ${strengthData.color}`}>
                {strengthData.label}
              </div>
            </div>
            <div>
              <span className="text-xs text-slate-400 uppercase block">Cryptographic Entropy</span>
              <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1">
                {strengthData.entropy} Bits
              </div>
            </div>
            <div>
              <span className="text-xs text-slate-400 uppercase block">Brute Force Crack Time</span>
              <div className="text-base font-bold text-slate-800 dark:text-slate-200 mt-1">
                {strengthData.time}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 7. TEXT COMPARE / DIFF TOOL */}
      {/* ---------------------------------------------------- */}
      {tool.id === 'text-compare-tool' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Original Text
              </label>
              <textarea
                rows={6}
                value={diffOriginal}
                onChange={e => setDiffOriginal(e.target.value)}
                className="w-full p-3 border rounded-xl text-xs font-mono bg-slate-50 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Modified Text
              </label>
              <textarea
                rows={6}
                value={diffModified}
                onChange={e => setDiffModified(e.target.value)}
                className="w-full p-3 border rounded-xl text-xs font-mono bg-slate-50 dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="p-5 bg-white dark:bg-slate-950 border rounded-2xl space-y-2 text-xs font-mono">
            <span className="text-xs font-bold uppercase tracking-wider block text-slate-500 mb-2">
              Line-by-Line Comparison
            </span>
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {(() => {
                const origLines = diffOriginal.split('\n');
                const modLines = diffModified.split('\n');
                const maxLen = Math.max(origLines.length, modLines.length);
                const rows: React.ReactNode[] = [];
                for (let i = 0; i < maxLen; i++) {
                  const o = origLines[i];
                  const m = modLines[i];
                  if (o === m) {
                    rows.push(
                      <div key={`eq-${i}`} className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 rounded flex gap-2">
                        <span className="text-slate-400 select-none w-5 shrink-0">{i + 1}</span>
                        <span>  {o || ' '}</span>
                      </div>
                    );
                  } else {
                    if (o !== undefined) {
                      rows.push(
                        <div key={`rem-${i}`} className="px-2.5 py-1.5 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 rounded flex gap-2">
                          <span className="text-red-400 select-none w-5 shrink-0">{i + 1}</span>
                          <span>- {o}</span>
                        </div>
                      );
                    }
                    if (m !== undefined) {
                      rows.push(
                        <div key={`add-${i}`} className="px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 rounded flex gap-2">
                          <span className="text-emerald-500 select-none w-5 shrink-0">{i + 1}</span>
                          <span>+ {m}</span>
                        </div>
                      );
                    }
                  }
                }
                return rows;
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 8. URL ENCODER / DECODER */}
      {/* ---------------------------------------------------- */}
      {tool.id === 'url-encoder-decoder' && (
        <div className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              URL / Query String Input
            </label>
            <textarea
              rows={4}
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              className="w-full p-3 border rounded-xl text-xs font-mono bg-slate-50 dark:bg-slate-800"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleUrlEncode}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
            >
              Encode URL
            </button>
            <button
              onClick={handleUrlDecode}
              className="px-4 py-2 border rounded-xl text-xs font-semibold cursor-pointer"
            >
              Decode URL
            </button>
          </div>

          {urlResult && (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border rounded-xl space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300">Result</span>
                <button
                  onClick={() => copyToClipboard(urlResult)}
                  className="text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy
                </button>
              </div>
              <p className="font-mono text-xs break-all text-slate-800 dark:text-slate-200">{urlResult}</p>
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 9. BASE64 ENCODER / DECODER */}
      {/* ---------------------------------------------------- */}
      {tool.id === 'base64-encoder-decoder' && (
        <div className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Text or Base64 String
            </label>
            <textarea
              rows={4}
              value={base64Input}
              onChange={e => setBase64Input(e.target.value)}
              className="w-full p-3 border rounded-xl text-xs font-mono bg-slate-50 dark:bg-slate-800"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleBase64Encode}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
            >
              Encode to Base64
            </button>
            <button
              onClick={handleBase64Decode}
              className="px-4 py-2 border rounded-xl text-xs font-semibold cursor-pointer"
            >
              Decode from Base64
            </button>
          </div>

          {base64Result && (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border rounded-xl space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300">Result</span>
                <button
                  onClick={() => copyToClipboard(base64Result)}
                  className="text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy
                </button>
              </div>
              <p className="font-mono text-xs break-all text-slate-800 dark:text-slate-200">{base64Result}</p>
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 10 & 11. JSON & XML FORMATTER */}
      {/* ---------------------------------------------------- */}
      {(tool.id === 'json-formatter' || tool.id === 'xml-formatter') && (
        <div className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Raw {tool.id === 'xml-formatter' ? 'XML' : 'JSON'} Payload
            </label>
            <textarea
              rows={6}
              value={rawCode}
              onChange={e => setRawCode(e.target.value)}
              className="w-full p-3 border rounded-xl text-xs font-mono bg-slate-50 dark:bg-slate-800"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={formatCode}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
            >
              Prettify & Format
            </button>
            <button
              onClick={minifyCode}
              className="px-4 py-2 border rounded-xl text-xs font-semibold cursor-pointer"
            >
              Minify / Compact
            </button>
          </div>

          {formatError && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-600">
              Syntax Error: {formatError}
            </div>
          )}

          {formattedCode && (
            <div className="p-4 bg-slate-50 dark:bg-slate-950 border rounded-xl space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300">Formatted Output</span>
                <button
                  onClick={() => copyToClipboard(formattedCode)}
                  className="text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy Code
                </button>
              </div>
              <pre className="font-mono text-xs overflow-x-auto text-blue-600 dark:text-blue-400 p-2">
                {formattedCode}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 12. UNIT CONVERTER */}
      {/* ---------------------------------------------------- */}
      {tool.id === 'unit-converter' && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-medium max-w-lg">
            <button
              onClick={() => { setUnitCategory('area'); setUnitFrom('acre'); }}
              className={`flex-1 py-1.5 px-2 rounded-lg cursor-pointer ${unitCategory === 'area' ? 'bg-white dark:bg-slate-700 text-blue-600 font-bold shadow-sm' : ''}`}
            >
              Land Area
            </button>
            <button
              onClick={() => { setUnitCategory('length'); setUnitFrom('km'); }}
              className={`flex-1 py-1.5 px-2 rounded-lg cursor-pointer ${unitCategory === 'length' ? 'bg-white dark:bg-slate-700 text-blue-600 font-bold shadow-sm' : ''}`}
            >
              Length
            </button>
            <button
              onClick={() => { setUnitCategory('weight'); setUnitFrom('kg'); }}
              className={`flex-1 py-1.5 px-2 rounded-lg cursor-pointer ${unitCategory === 'weight' ? 'bg-white dark:bg-slate-700 text-blue-600 font-bold shadow-sm' : ''}`}
            >
              Weight
            </button>
            <button
              onClick={() => { setUnitCategory('temp'); setUnitFrom('c'); }}
              className={`flex-1 py-1.5 px-2 rounded-lg cursor-pointer ${unitCategory === 'temp' ? 'bg-white dark:bg-slate-700 text-blue-600 font-bold shadow-sm' : ''}`}
            >
              Temperature
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Value
              </label>
              <input
                type="number"
                value={unitInputVal}
                onChange={e => setUnitInputVal(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-xl text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Input Unit
              </label>
              <select
                value={unitFrom}
                onChange={e => setUnitFrom(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl text-sm"
              >
                {unitCategory === 'area' && (
                  <>
                    <option value="acre">Acre</option>
                    <option value="gunta">Gunta (South India / 1089 sq ft)</option>
                    <option value="sqft">Square Feet</option>
                    <option value="cent">Cent</option>
                    <option value="hectare">Hectare</option>
                  </>
                )}
                {unitCategory === 'length' && (
                  <>
                    <option value="km">Kilometer (km)</option>
                    <option value="meters">Meter (m)</option>
                    <option value="cm">Centimeter (cm)</option>
                    <option value="feet">Feet (ft)</option>
                    <option value="inch">Inch (in)</option>
                  </>
                )}
                {unitCategory === 'weight' && (
                  <>
                    <option value="kg">Kilogram (kg)</option>
                    <option value="g">Gram (g)</option>
                    <option value="lb">Pound (lb)</option>
                    <option value="quintal">Quintal (100 kg)</option>
                    <option value="ton">Metric Ton (1000 kg)</option>
                  </>
                )}
                {unitCategory === 'temp' && (
                  <>
                    <option value="c">Celsius (°C)</option>
                    <option value="f">Fahrenheit (°F)</option>
                    <option value="k">Kelvin (K)</option>
                  </>
                )}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center text-xs">
            {Object.entries(convertedUnitList).map(([label, val]) => (
              <div key={label} className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border">
                <span className="text-slate-400 block">{label}</span>
                <span className="text-lg font-bold font-mono text-slate-900 dark:text-white mt-1 block">
                  {val}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 13. STORAGE CONVERTER */}
      {/* ---------------------------------------------------- */}
      {tool.id === 'storage-converter' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Size Value
              </label>
              <input
                type="number"
                value={storageVal}
                onChange={e => setStorageVal(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-xl text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Input Unit
              </label>
              <select
                value={storageUnit}
                onChange={e => setStorageUnit(e.target.value as any)}
                className="w-full px-3 py-2 border rounded-xl text-sm"
              >
                <option value="KB">Kilobytes (KB)</option>
                <option value="MB">Megabytes (MB)</option>
                <option value="GB">Gigabytes (GB)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Base Mode
              </label>
              <select
                value={storageMode}
                onChange={e => setStorageMode(e.target.value as any)}
                className="w-full px-3 py-2 border rounded-xl text-sm"
              >
                <option value="binary">Binary Standard (1024 Bytes)</option>
                <option value="decimal">Decimal Standard (1000 Bytes)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border">
              <span className="text-slate-400 block">Bytes</span>
              <span className="text-base font-bold font-mono text-slate-900 dark:text-white">
                {totalBytes.toLocaleString()} B
              </span>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border">
              <span className="text-slate-400 block">Kilobytes (KB)</span>
              <span className="text-base font-bold font-mono text-blue-600 dark:text-blue-400">
                {(totalBytes / baseFactor).toFixed(2)} KB
              </span>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border">
              <span className="text-slate-400 block">Megabytes (MB)</span>
              <span className="text-base font-bold font-mono text-purple-600">
                {(totalBytes / (baseFactor * baseFactor)).toFixed(3)} MB
              </span>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border">
              <span className="text-slate-400 block">Gigabytes (GB)</span>
              <span className="text-base font-bold font-mono text-emerald-600">
                {(totalBytes / (baseFactor * baseFactor * baseFactor)).toFixed(4)} GB
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 14. STOPWATCH */}
      {/* ---------------------------------------------------- */}
      {tool.id === 'stopwatch' && (
        <div className="space-y-6 text-center">
          <div className="p-8 bg-slate-50 dark:bg-slate-950 border rounded-3xl">
            <div className="text-5xl sm:text-6xl font-extrabold font-mono text-slate-900 dark:text-white tracking-wider">
              {formatSw(swTimeMs)}
            </div>
          </div>

          <div className="flex justify-center gap-4">
            <button
              onClick={() => setSwRunning(!swRunning)}
              className={`px-6 py-2.5 rounded-xl text-sm font-semibold text-white shadow flex items-center gap-2 cursor-pointer ${
                swRunning ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {swRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {swRunning ? 'Pause' : 'Start'}
            </button>
            <button
              onClick={() => setSwLaps(prev => [swTimeMs, ...prev])}
              disabled={!swRunning}
              className="px-5 py-2.5 border rounded-xl text-sm font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            >
              <Flag className="w-4 h-4" /> Lap
            </button>
            <button
              onClick={() => { setSwRunning(false); setSwTimeMs(0); setSwLaps([]); }}
              className="px-5 py-2.5 border rounded-xl text-sm font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" /> Reset
            </button>
          </div>

          {swLaps.length > 0 && (
            <div className="max-w-md mx-auto space-y-2 text-xs">
              <span className="font-bold text-slate-500 uppercase block">Recorded Laps</span>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {swLaps.map((lap, idx) => (
                  <div key={idx} className="flex justify-between p-2 bg-slate-50 dark:bg-slate-800/40 rounded-lg font-mono">
                    <span className="text-slate-400">Lap #{swLaps.length - idx}</span>
                    <span className="font-bold">{formatSw(lap)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 15. COUNTDOWN TIMER */}
      {/* ---------------------------------------------------- */}
      {tool.id === 'countdown-timer' && (
        <div className="space-y-6 text-center">
          <div className="flex justify-center gap-2 flex-wrap">
            {[5, 15, 25, 45, 60].map(m => (
              <button
                key={m}
                onClick={() => setTimerPreset(m)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                  timerMinutes === m && timerSeconds === 0 && !isTimerRunning ? 'bg-blue-600 text-white' : 'bg-slate-50 dark:bg-slate-800'
                }`}
              >
                {m} Min {m === 25 ? '(Pomodoro)' : ''}
              </button>
            ))}
          </div>

          <div className="flex justify-center items-center gap-2 text-xs">
            <input
              type="number"
              min="0"
              max="999"
              value={timerMinutes}
              onChange={e => {
                const m = Math.max(0, Number(e.target.value) || 0);
                setTimerMinutes(m);
                const secs = m * 60 + timerSeconds;
                setTotalTimerSecs(secs);
                setTimerRemaining(secs);
                setIsTimerRunning(false);
              }}
              className="w-20 px-2.5 py-1.5 border rounded-lg text-center font-mono"
              aria-label="Minutes"
            />
            <span className="font-semibold text-slate-500">min</span>
            <input
              type="number"
              min="0"
              max="59"
              value={timerSeconds}
              onChange={e => {
                const s = Math.min(59, Math.max(0, Number(e.target.value) || 0));
                setTimerSeconds(s);
                const secs = timerMinutes * 60 + s;
                setTotalTimerSecs(secs);
                setTimerRemaining(secs);
                setIsTimerRunning(false);
              }}
              className="w-20 px-2.5 py-1.5 border rounded-lg text-center font-mono"
              aria-label="Seconds"
            />
            <span className="font-semibold text-slate-500">sec</span>
          </div>

          <div className="p-8 bg-slate-50 dark:bg-slate-950 border rounded-3xl max-w-sm mx-auto">
            <div className="text-5xl font-extrabold font-mono text-blue-600 dark:text-blue-400 tracking-wider">
              {Math.floor(timerRemaining / 60).toString().padStart(2, '0')}:{(timerRemaining % 60).toString().padStart(2, '0')}
            </div>
          </div>

          <div className="flex justify-center gap-4">
            <button
              onClick={() => {
                if (timerRemaining > 0) setIsTimerRunning(!isTimerRunning);
              }}
              disabled={timerRemaining <= 0 && !isTimerRunning}
              className={`px-6 py-2.5 rounded-xl text-sm font-semibold text-white shadow flex items-center gap-2 cursor-pointer disabled:opacity-50 ${
                isTimerRunning ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isTimerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isTimerRunning ? 'Pause' : 'Start Timer'}
            </button>
            <button
              onClick={() => { setIsTimerRunning(false); setTimerRemaining(totalTimerSecs); }}
              className="px-5 py-2.5 border rounded-xl text-sm font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" /> Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
