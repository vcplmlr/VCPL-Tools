import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookmarkPlus,
  Check,
  Copy,
  Image as ImageIcon,
  Palette,
  Pipette,
  RefreshCw,
  Shuffle,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { ToolCatalogItem } from '../../types/tools';
import { FileDropZone } from './FileDropZone';

interface SwatchbookColorPickerViewProps {
  tool?: ToolCatalogItem;
}

interface HsvState {
  h: number;
  s: number;
  v: number;
  a: number;
}

type ExportFormat = 'css' | 'scss' | 'tw' | 'json';

const PALETTE_STORAGE_KEY = 'vcpl_swatchbook_palette_v1';

const clamp = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));
const R = Math.round;
const f1 = (x: number) => +x.toFixed(1);
const f3 = (x: number) => +x.toFixed(3);

function hsv2rgb(h: number, s: number, v: number): [number, number, number] {
  const ss = s / 100;
  const vv = v / 100;
  const fn = (n: number) => {
    const k = (n + h / 60) % 6;
    return vv - vv * ss * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [R(fn(5) * 255), R(fn(3) * 255), R(fn(1) * 255)];
}

function rgb2hsv(r: number, g: number, b: number): [number, number, number] {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const M = Math.max(rr, gg, bb);
  const m = Math.min(rr, gg, bb);
  const d = M - m;
  let h = 0;
  if (d) {
    h = M === rr ? ((gg - bb) / d) % 6 : M === gg ? (bb - rr) / d + 2 : (rr - gg) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, M ? (d / M) * 100 : 0, M * 100];
}

function rgb2hsl(r: number, g: number, b: number): [number, number, number] {
  const [h] = rgb2hsv(r, g, b);
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const M = Math.max(rr, gg, bb);
  const m = Math.min(rr, gg, bb);
  const d = M - m;
  const l = (M + m) / 2;
  return [h, d ? (d / (1 - Math.abs(2 * l - 1))) * 100 : 0, l * 100];
}

function hsl2rgb(h: number, s: number, l: number): [number, number, number] {
  const ss = s / 100;
  const ll = l / 100;
  const a = ss * Math.min(ll, 1 - ll);
  const fn = (n: number) => {
    const k = (n + h / 30) % 12;
    return ll - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [R(fn(0) * 255), R(fn(8) * 255), R(fn(4) * 255)];
}

function rgbToOklch(r: number, g: number, b: number): [number, number, number] {
  const lin = (c: number) => {
    const x = c / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  const [a, c, d] = [lin(r), lin(g), lin(b)];
  const l = Math.cbrt(0.4122214708 * a + 0.5363325363 * c + 0.0514459929 * d);
  const m = Math.cbrt(0.2119034982 * a + 0.6806995451 * c + 0.1073969566 * d);
  const s = Math.cbrt(0.0883024619 * a + 0.2817188376 * c + 0.6299787005 * d);
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    Math.hypot(A, B),
    ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360,
  ];
}

const toHex = (rgb: [number, number, number]): string =>
  '#' + rgb.map((x) => x.toString(16).padStart(2, '0')).join('');

const hexToRgb = (h: string): [number, number, number] => {
  const clean = h.replace('#', '');
  return [
    parseInt(clean.substring(0, 2), 16) || 0,
    parseInt(clean.substring(2, 4), 16) || 0,
    parseInt(clean.substring(4, 6), 16) || 0,
  ];
};

const luminance = (rgb: [number, number, number]): number => {
  const [r, g, b] = rgb.map((c) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrastRatio = (a: [number, number, number], b: [number, number, number]): number => {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

let parseCanvasCtx: CanvasRenderingContext2D | null = null;
function getParseCtx(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  if (!parseCanvasCtx) {
    parseCanvasCtx = document.createElement('canvas').getContext('2d');
  }
  return parseCanvasCtx;
}

function parseCssColor(raw: string): { rgb: [number, number, number]; a: number } | null {
  const ctx = getParseCtx();
  if (!ctx) return null;
  let str = raw.trim();
  if (!str) return null;
  if (/^[0-9a-f]{3,8}$/i.test(str)) str = '#' + str;
  ctx.fillStyle = '#000';
  ctx.fillStyle = str;
  const a = ctx.fillStyle;
  ctx.fillStyle = '#fff';
  ctx.fillStyle = str;
  if (a !== ctx.fillStyle) return null;
  if (a.startsWith('#')) {
    return { rgb: hexToRgb(a), a: 1 };
  }
  const nums = a.match(/[\d.]+/g)?.map(Number) ?? [];
  if (nums.length < 3) return null;
  return { rgb: [nums[0], nums[1], nums[2]], a: nums[3] ?? 1 };
}

export const SwatchbookColorPickerView: React.FC<SwatchbookColorPickerViewProps> = ({ tool }) => {
  const [hsv, setHsv] = useState<HsvState>({ h: 210, s: 70, v: 90, a: 1 });
  const [anyInput, setAnyInput] = useState<string>('#4599e6');
  const [anyInvalid, setAnyInvalid] = useState<boolean>(false);
  const [fgHex, setFgHex] = useState<string>('#ffffff');
  const [extracted, setExtracted] = useState<string[]>([]);
  const [palette, setPalette] = useState<string[]>(() => {
    try {
      const raw = window.localStorage.getItem(PALETTE_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
    } catch {
      return [];
    }
  });
  const [exportFormat, setExportFormat] = useState<ExportFormat>('css');
  const [toastMsg, setToastMsg] = useState<string>('');
  const [hasEyeDropper, setHasEyeDropper] = useState<boolean>(false);

  const svRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef<boolean>(false);
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setHasEyeDropper(typeof window !== 'undefined' && 'EyeDropper' in window);
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMsg(''), 1600);
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`Copied: ${text.slice(0, 32)}`);
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        showToast(`Copied: ${text.slice(0, 32)}`);
      } catch {
        showToast('Copy failed');
      }
    }
  };

  const rgb = useMemo(() => hsv2rgb(hsv.h, hsv.s, hsv.v), [hsv.h, hsv.s, hsv.v]);
  const hex = useMemo(() => toHex(rgb), [rgb]);
  const hasAlpha = hsv.a < 1;
  const alphaHex = useMemo(
    () => hex + (hasAlpha ? R(hsv.a * 255).toString(16).padStart(2, '0') : ''),
    [hex, hasAlpha, hsv.a]
  );

  useEffect(() => {
    if (!anyInvalid) {
      setAnyInput(alphaHex.toUpperCase());
    }
  }, [alphaHex, anyInvalid]);

  const [hh, ss, ll] = useMemo(() => rgb2hsl(rgb[0], rgb[1], rgb[2]), [rgb]);

  const formats = useMemo(() => {
    const [r, g, b] = rgb;
    const k = 1 - Math.max(r, g, b) / 255;
    const cm =
      k >= 1
        ? [0, 0, 0]
        : [r, g, b].map((x) => R(((1 - x / 255 - k) / (1 - k)) * 100));
    const [ol, oc, oh] = rgbToOklch(r, g, b);
    const A = f3(hsv.a);
    const H = R(hh);
    const Sx = R(ss);
    const Lx = R(ll);
    const a8 = R(hsv.a * 255)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();
    const hexUpper = hex.slice(1).toUpperCase();

    return [
      ['HEX', alphaHex.toUpperCase()],
      ['RGB', hasAlpha ? `rgba(${r}, ${g}, ${b}, ${A})` : `rgb(${r}, ${g}, ${b})`],
      ['HSL', hasAlpha ? `hsla(${H}, ${Sx}%, ${Lx}%, ${A})` : `hsl(${H}, ${Sx}%, ${Lx}%)`],
      ['HSV', `hsv(${R(hsv.h)}, ${R(hsv.s)}%, ${R(hsv.v)}%)`],
      ['CMYK', `cmyk(${cm[0]}%, ${cm[1]}%, ${cm[2]}%, ${R(k * 100)}%)`],
      ['OKLCH', `oklch(${f3(ol)} ${f3(oc)} ${f1(oh)}${hasAlpha ? ` / ${A}` : ''})`],
      ['CSS var', `--color: ${alphaHex};`],
      ['Tailwind', `bg-[${alphaHex}]`],
      ['Swift', `UIColor(red: ${f3(r / 255)}, green: ${f3(g / 255)}, blue: ${f3(b / 255)}, alpha: ${A})`],
      ['Flutter', `Color(0x${a8}${hexUpper})`],
      ['Android', `#${a8}${hexUpper}`],
      ['Decimal', String(r * 65536 + g * 256 + b)],
    ] as const;
  }, [rgb, hsv, hh, ss, ll, hex, alphaHex, hasAlpha]);

  const harmonies = useMemo(() => {
    const rot = (deg: number) => toHex(hsl2rgb((hh + deg + 360) % 360, ss, ll));
    return [
      { label: 'Complementary', colors: [0, 180].map(rot) },
      { label: 'Split Complementary', colors: [0, 150, 210].map(rot) },
      { label: 'Analogous', colors: [-30, 0, 30].map(rot) },
      { label: 'Triadic', colors: [0, 120, 240].map(rot) },
      { label: 'Tetradic', colors: [0, 90, 180, 270].map(rot) },
      { label: 'Square', colors: [0, 60, 180, 240].map(rot) },
      { label: 'Monochromatic', colors: [15, 30, 45, 60, 75].map((l) => toHex(hsl2rgb(hh, ss, l))) },
    ];
  }, [hh, ss, ll]);

  const scale = useMemo(() => {
    const steps = [95, 85, 75, 65, 55, 45, 35, 25, 15, 10, 5];
    return steps.map((l) => ({
      l,
      hex: toHex(hsl2rgb(hh, ss, l)),
    }));
  }, [hh, ss]);

  const fgRgb = useMemo(() => hexToRgb(fgHex), [fgHex]);
  const wcagRatio = useMemo(() => contrastRatio(rgb, fgRgb), [rgb, fgRgb]);

  const exportOutput = useMemo(() => {
    const list = palette.length ? palette : [hex];
    if (exportFormat === 'css') {
      return ':root {\n' + list.map((c, i) => `  --color-${i + 1}: ${c};`).join('\n') + '\n}';
    }
    if (exportFormat === 'scss') {
      return list.map((c, i) => `$color-${i + 1}: ${c};`).join('\n');
    }
    if (exportFormat === 'tw') {
      return (
        'module.exports = {\n  theme: { extend: { colors: {\n' +
        list.map((c, i) => `    'brand-${i + 1}': '${c}',`).join('\n') +
        '\n  } } }\n}'
      );
    }
    return JSON.stringify(
      list.map((c, i) => ({ name: `color-${i + 1}`, hex: c, rgb: hexToRgb(c) })),
      null,
      2
    );
  }, [palette, hex, exportFormat]);

  const heroFgColor = useMemo(() => {
    if (hsv.a < 0.5) return '#2F3E4E';
    return contrastRatio(rgb, [255, 255, 255]) >= contrastRatio(rgb, [0, 0, 0])
      ? '#FFFFFF'
      : '#111827';
  }, [hsv.a, rgb]);

  const loadColorValue = (colorStr: string) => {
    const parsed = parseCssColor(colorStr);
    if (!parsed) return;
    const [h, s, v] = rgb2hsv(parsed.rgb[0], parsed.rgb[1], parsed.rgb[2]);
    setHsv((prev) => ({
      h: s && v ? h : prev.h,
      s,
      v,
      a: 1,
    }));
    setAnyInvalid(false);
  };

  const updateSvFromPointer = (clientX: number, clientY: number) => {
    const el = svRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const s = clamp(((clientX - rect.left) / rect.width) * 100, 0, 100);
    const v = clamp(100 - ((clientY - rect.top) / rect.height) * 100, 0, 100);
    setHsv((prev) => ({ ...prev, s, v }));
    setAnyInvalid(false);
  };

  const handleRandomColor = () => {
    setHsv({
      h: Math.random() * 360,
      s: 40 + Math.random() * 60,
      v: 50 + Math.random() * 50,
      a: 1,
    });
    setAnyInvalid(false);
  };

  const handleEyeDropper = async () => {
    try {
      const EyeDropperCtor = (window as unknown as {
        EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> };
      }).EyeDropper;
      if (!EyeDropperCtor) return;
      const res = await new EyeDropperCtor().open();
      loadColorValue(res.sRGBHex);
    } catch {
      // Cancelled by user
    }
  };

  const persistPalette = (next: string[]) => {
    setPalette(next);
    try {
      window.localStorage.setItem(PALETTE_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota errors
    }
  };

  const handleSaveToPalette = () => {
    if (!palette.includes(hex)) {
      persistPalette([...palette, hex]);
    }
    showToast(`Saved ${hex.toUpperCase()}`);
  };

  const extractPaletteFromFile = (file: File) => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 64;
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.drawImage(im, 0, 0, 64, 64);
        const data = ctx.getImageData(0, 0, 64, 64).data;
        const buckets: Record<string, number> = {};
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 128) continue;
          const k = [data[i] >> 4, data[i + 1] >> 4, data[i + 2] >> 4].join(',');
          buckets[k] = (buckets[k] || 0) + 1;
        }
        const sorted = Object.entries(buckets)
          .sort((a, b) => b[1] - a[1])
          .map(([k]) => k.split(',').map((v) => Number(v) * 16 + 8) as [number, number, number]);
        const distinct: Array<[number, number, number]> = [];
        for (const col of sorted) {
          if (
            distinct.every(
              (o) => Math.hypot(o[0] - col[0], o[1] - col[1], o[2] - col[2]) > 60
            )
          ) {
            distinct.push(col);
          }
          if (distinct.length >= 8) break;
        }
        setExtracted(distinct.map(toHex));
      }
      URL.revokeObjectURL(url);
    };
    im.onerror = () => URL.revokeObjectURL(url);
    im.src = url;
  };

  const handleImagePalette = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) extractPaletteFromFile(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Live Hero Colour Band */}
      <div
        className="rounded-2xl border-[1.5px] border-[#2F3E4E] p-6 sm:p-8 shadow-[0_4px_0_#2F3E4E] transition-colors"
        style={{
          background: `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${hsv.a})`,
          color: heroFgColor,
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-black/15 backdrop-blur-xs text-[11px] font-display font-extrabold uppercase tracking-wider">
            <Palette className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{tool?.code || 'IM-11'} · Swatchbook Colour Studio</span>
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold opacity-90">
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            <span>100% Browser-Local</span>
          </span>
        </div>

        <h1 className="font-mono font-extrabold text-[clamp(2.2rem,6vw,4.5rem)] leading-none tracking-tight">
          {alphaHex.toUpperCase()}
        </h1>
        <p className="mt-2 font-mono text-xs sm:text-sm opacity-90">
          rgb({rgb[0]}, {rgb[1]}, {rgb[2]}) · hsl({R(hh)}, {R(ss)}%, {R(ll)}%)
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          {hasEyeDropper && (
            <button
              type="button"
              onClick={handleEyeDropper}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border-[1.5px] border-current text-xs font-bold hover:bg-black/10 transition cursor-pointer"
            >
              <Pipette className="w-3.5 h-3.5" />
              <span>Pick from Screen</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleRandomColor}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border-[1.5px] border-current text-xs font-bold hover:bg-black/10 transition cursor-pointer"
          >
            <Shuffle className="w-3.5 h-3.5" />
            <span>Random Colour</span>
          </button>
          <button
            type="button"
            onClick={handleSaveToPalette}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border-[1.5px] border-current text-xs font-bold hover:bg-black/10 transition cursor-pointer"
          >
            <BookmarkPlus className="w-3.5 h-3.5" />
            <span>Save to Palette</span>
          </button>
        </div>
      </div>

      {/* Picker + Code Formats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-5 lg:sticky lg:top-20 bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 shadow-[0_4px_0_#2F3E4E] space-y-4">
          <h2 className="font-display font-extrabold text-lg text-[#2F3E4E]">Interactive Picker</h2>

          <div
            ref={svRef}
            tabIndex={0}
            role="slider"
            aria-label="Saturation and brightness. Use arrow keys."
            aria-valuenow={R(hsv.s)}
            onPointerDown={(e) => {
              draggingRef.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
              updateSvFromPointer(e.clientX, e.clientY);
            }}
            onPointerMove={(e) => {
              if (draggingRef.current) updateSvFromPointer(e.clientX, e.clientY);
            }}
            onPointerUp={() => {
              draggingRef.current = false;
            }}
            onKeyDown={(e) => {
              const step = e.shiftKey ? 10 : 1;
              if (e.key === 'ArrowLeft') {
                e.preventDefault();
                setHsv((p) => ({ ...p, s: clamp(p.s - step, 0, 100) }));
              } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                setHsv((p) => ({ ...p, s: clamp(p.s + step, 0, 100) }));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setHsv((p) => ({ ...p, v: clamp(p.v + step, 0, 100) }));
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setHsv((p) => ({ ...p, v: clamp(p.v - step, 0, 100) }));
              }
            }}
            className="relative w-full aspect-[5/4] rounded-xl border border-[#2F3E4E] cursor-crosshair touch-none"
            style={{
              background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h}, 100%, 50%))`,
            }}
          >
            <div
              className="absolute w-5 h-5 -ml-2.5 -mt-2.5 rounded-full border-[3px] border-white shadow-[0_0_0_1.5px_#000,inset_0_0_0_1.5px_#000] pointer-events-none"
              style={{ left: `${hsv.s}%`, top: `${100 - hsv.v}%` }}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="sb-hue" className="text-xs font-bold text-[#475569]">
              Hue ({R(hsv.h)}°)
            </label>
            <input
              id="sb-hue"
              type="range"
              min={0}
              max={360}
              value={hsv.h}
              onChange={(e) => {
                setHsv((p) => ({ ...p, h: Number(e.target.value) }));
                setAnyInvalid(false);
              }}
              className="w-full h-3.5 rounded-lg appearance-none border border-[#2F3E4E] cursor-pointer"
              style={{
                background:
                  'linear-gradient(90deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
              }}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="sb-alpha" className="text-xs font-bold text-[#475569]">
              Opacity ({R(hsv.a * 100)}%)
            </label>
            <input
              id="sb-alpha"
              type="range"
              min={0}
              max={100}
              value={R(hsv.a * 100)}
              onChange={(e) => {
                setHsv((p) => ({ ...p, a: Number(e.target.value) / 100 }));
                setAnyInvalid(false);
              }}
              className="w-full h-3.5 rounded-lg appearance-none border border-[#2F3E4E] cursor-pointer"
              style={{
                background: `linear-gradient(90deg, transparent, ${hex}), repeating-conic-gradient(#cbd5e1 0 25%, #fff 0 50%) 0 0 / 12px 12px`,
              }}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="sb-any" className="text-xs font-bold text-[#475569]">
              Type any CSS colour (hex, rgb(), hsl(), oklch(), or colour name)
            </label>
            <input
              id="sb-any"
              type="text"
              value={anyInput}
              spellCheck={false}
              autoComplete="off"
              onChange={(e) => {
                const val = e.target.value;
                setAnyInput(val);
                const parsed = parseCssColor(val);
                if (!parsed) {
                  setAnyInvalid(true);
                } else {
                  setAnyInvalid(false);
                  const [h, s, v] = rgb2hsv(parsed.rgb[0], parsed.rgb[1], parsed.rgb[2]);
                  setHsv((prev) => ({
                    h: s && v ? h : prev.h,
                    s,
                    v,
                    a: parsed.a,
                  }));
                }
              }}
              onBlur={() => {
                setAnyInvalid(false);
                setAnyInput(alphaHex.toUpperCase());
              }}
              className={`w-full px-3 py-2 rounded-xl border-[1.5px] bg-white font-mono text-xs text-[#2F3E4E] focus:outline-none ${
                anyInvalid ? 'border-rose-600' : 'border-[#2F3E4E]'
              }`}
            />
          </div>
        </div>

        <div className="lg:col-span-7 bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 shadow-[0_4px_0_#2F3E4E] space-y-3 lg:max-h-[calc(100dvh-5.5rem)] lg:overflow-y-auto lg:pr-1">
          <div>
            <h2 className="font-display font-extrabold text-lg text-[#2F3E4E]">
              Formats &amp; Code
            </h2>
            <p className="text-xs text-[#475569]">Click any row to copy the value to clipboard.</p>
          </div>

          <div className="grid grid-cols-1 gap-1.5">
            {formats.map(([label, val]) => (
              <button
                key={label}
                type="button"
                onClick={() => copyText(val)}
                className="w-full px-3 py-2 rounded-xl border border-[#2F3E4E]/20 bg-white hover:border-[#2F3E4E] hover:bg-[#FEF2C8]/60 grid grid-cols-[78px_1fr_auto] items-center gap-2.5 text-left transition cursor-pointer"
              >
                <span className="text-xs font-bold text-[#64748B]">{label}</span>
                <span className="font-mono text-xs text-[#2F3E4E] break-all">{val}</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#2F3E4E]/75">
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Harmonies */}
      <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 shadow-[0_4px_0_#2F3E4E] space-y-4">
        <div>
          <h2 className="font-display font-extrabold text-lg text-[#2F3E4E]">Colour Harmonies</h2>
          <p className="text-xs text-[#475569]">
            Built by rotating hue angles. Click any swatch to load it.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {harmonies.map((group) => (
            <div key={group.label} className="space-y-1.5">
              <h3 className="text-xs font-bold text-[#475569]">{group.label}</h3>
              <div className="flex flex-wrap gap-2">
                {group.colors.map((c, idx) => (
                  <button
                    key={`${group.label}-${idx}`}
                    type="button"
                    onClick={() => loadColorValue(c)}
                    className="w-[78px] rounded-xl border border-[#2F3E4E]/45 bg-white overflow-hidden hover:-translate-y-0.5 transition cursor-pointer"
                  >
                    <div className="h-11 w-full" style={{ background: c }} />
                    <span className="block py-1 text-[10px] font-mono font-bold text-[#2F3E4E] text-center">
                      {c}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tints and Shades */}
      <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 shadow-[0_4px_0_#2F3E4E] space-y-3">
        <div>
          <h2 className="font-display font-extrabold text-lg text-[#2F3E4E]">Tints &amp; Shades</h2>
          <p className="text-xs text-[#475569]">
            Eleven lightness steps with matching hue and saturation from light to dark.
          </p>
        </div>

        <div className="grid grid-cols-11 rounded-xl overflow-hidden border-[1.5px] border-[#2F3E4E]">
          {scale.map((step) => (
            <button
              key={step.l}
              type="button"
              onClick={() => loadColorValue(step.hex)}
              title={step.hex}
              className="h-14 sm:h-16 flex items-center justify-center font-mono text-[10px] font-bold cursor-pointer hover:opacity-90"
              style={{
                background: step.hex,
                color: step.l > 50 ? '#111827' : '#FFFFFF',
              }}
            >
              <span className="hidden sm:inline">{step.hex.slice(1)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* WCAG Contrast Checker */}
      <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 shadow-[0_4px_0_#2F3E4E] space-y-4">
        <div>
          <h2 className="font-display font-extrabold text-lg text-[#2F3E4E]">
            WCAG Contrast Checker
          </h2>
          <p className="text-xs text-[#475569]">
            Your picked colour is the background. Choose a foreground text colour to verify AA/AAA
            compliance.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <label htmlFor="sb-fg" className="text-xs font-bold text-[#2F3E4E]">
                Text colour
              </label>
              <input
                id="sb-fg"
                type="color"
                value={fgHex}
                onChange={(e) => setFgHex(e.target.value)}
                className="w-11 h-9 rounded-lg border border-[#2F3E4E] bg-white p-0.5 cursor-pointer"
              />
              <button
                type="button"
                onClick={() => {
                  const best =
                    contrastRatio(rgb, [255, 255, 255]) >= contrastRatio(rgb, [0, 0, 0])
                      ? '#ffffff'
                      : '#000000';
                  setFgHex(best);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Use Best Black / White</span>
              </button>
            </div>

            <div className="font-display font-extrabold text-4xl text-[#2F3E4E] tabular-nums">
              {wcagRatio.toFixed(2)} : 1
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[
                { label: 'AA normal text', min: 4.5 },
                { label: 'AA large text', min: 3 },
                { label: 'AAA normal text', min: 7 },
                { label: 'AAA large text', min: 4.5 },
                { label: 'UI components', min: 3 },
              ].map((check) => {
                const pass = wcagRatio >= check.min;
                return (
                  <span
                    key={check.label}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                      pass ? 'bg-[#12805C] text-white' : 'bg-rose-600 text-white'
                    }`}
                  >
                    {check.label}: {pass ? 'Pass' : 'Fail'}
                  </span>
                );
              })}
            </div>
          </div>

          <div
            className="rounded-xl border-[1.5px] border-[#2F3E4E] p-5 min-h-[140px] flex flex-col justify-center space-y-2"
            style={{ background: hex, color: fgHex }}
          >
            <div className="font-display font-extrabold text-2xl">Large heading text</div>
            <p className="text-sm opacity-95">
              Body copy demonstrates how legible this colour combination feels at standard UI size.
            </p>
          </div>
        </div>
      </div>

      {/* Extract Palette from Image + Saved Palette Export */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <FileDropZone
          accept="image/*"
          multiple={false}
          onFiles={(files) => {
            if (files[0]) extractPaletteFromFile(files[0]);
          }}
          className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 shadow-[0_4px_0_#2F3E4E] space-y-4 transition-colors"
        >
          <div>
            <h2 className="font-display font-extrabold text-lg text-[#2F3E4E]">
              Palette from an Image
            </h2>
            <p className="text-xs text-[#475569]">
              Drag &amp; drop or choose any local image to extract dominant swatches directly in your browser.
            </p>
          </div>

          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border-[1.5px] border-dashed border-[#2F3E4E] bg-[#FEF2C8] hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] cursor-pointer">
            <ImageIcon className="w-4 h-4" />
            <span>Drop or Select Image File</span>
            <input type="file" accept="image/*" onChange={handleImagePalette} className="sr-only" />
          </label>

          {extracted.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {extracted.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => loadColorValue(c)}
                  className="w-[78px] rounded-xl border border-[#2F3E4E]/45 bg-white overflow-hidden cursor-pointer"
                >
                  <div className="h-11 w-full" style={{ background: c }} />
                  <span className="block py-1 text-[10px] font-mono font-bold text-[#2F3E4E]">
                    {c}
                  </span>
                </button>
              ))}
            </div>
          )}
        </FileDropZone>

        <div className="bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-5 shadow-[0_4px_0_#2F3E4E] space-y-4">
          <div>
            <h2 className="font-display font-extrabold text-lg text-[#2F3E4E]">
              Saved Palette &amp; Export
            </h2>
            <p className="text-xs text-[#475569]">
              {palette.length === 0
                ? 'No colours saved yet. Click "Save to Palette" above.'
                : `${palette.length} colour(s) saved locally in browser storage.`}
            </p>
          </div>

          {palette.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {palette.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => loadColorValue(c)}
                  className="w-[78px] rounded-xl border border-[#2F3E4E]/45 bg-white overflow-hidden cursor-pointer"
                >
                  <div className="h-11 w-full" style={{ background: c }} />
                  <span className="block py-1 text-[10px] font-mono font-bold text-[#2F3E4E]">
                    {c}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Export palette format"
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
              className="px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white text-xs font-bold text-[#2F3E4E]"
            >
              <option value="css">CSS variables</option>
              <option value="scss">SCSS</option>
              <option value="tw">Tailwind config</option>
              <option value="json">JSON</option>
            </select>

            <button
              type="button"
              onClick={() => copyText(exportOutput)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] bg-[#2F3E4E] text-xs font-bold text-[#F9C80E] cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Export</span>
            </button>

            <button
              type="button"
              disabled={palette.length === 0}
              onClick={() => persistPalette([])}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border-[1.5px] border-[#2F3E4E] bg-white hover:bg-rose-50 text-xs font-bold text-[#2F3E4E] disabled:opacity-45 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>

          <textarea
            readOnly
            aria-label="Export output"
            value={exportOutput}
            rows={5}
            className="w-full p-3 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white font-mono text-xs text-[#2F3E4E]"
          />
        </div>
      </div>

      {/* Inline Toast Feedback */}
      {toastMsg && (
        <div
          role="status"
          className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-[calc(100vw-2rem)] inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#2F3E4E] text-[#F9C80E] border border-[#F9C80E] shadow-lg text-xs font-bold text-center no-print"
        >
          <Check className="w-3.5 h-3.5" />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
};
