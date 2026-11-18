import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  KeyRound,
  Lock,
  Scissors,
  ShieldCheck,
  Volume2,
  VolumeX,
  XCircle,
} from 'lucide-react';
import { VcplBrandLogo } from './VcplBrandLogo';

export type CuttingToolId = 'knife' | 'scissors' | 'cutter';

export interface LaunchRecord {
  launched: boolean;
  launchedAtIso: string;
  toolUsed: CuttingToolId;
}

export const OFFICIAL_LAUNCH_STORAGE_KEY = 'vcpl_official_launch_v1';

// SHA-256 hex digest of default 6-digit launch passcode (fallback when running purely static on Vercel)
const DEFAULT_LAUNCH_CODE_SHA256 =
  '21cbf45b96fe70d7c5838a9e02517e30568908185fd5b6491a28c77e75c3447d';

const CUTTING_TOOLS: Array<{
  id: CuttingToolId;
  label: string;
  actionLabel: string;
}> = [
  { id: 'knife', label: 'Ceremonial Knife', actionLabel: 'Click ribbon with Knife to Cut' },
  { id: 'scissors', label: 'Golden Scissors', actionLabel: 'Click ribbon with Scissors to Cut' },
  { id: 'cutter', label: 'Precision Cutter', actionLabel: 'Click ribbon with Cutter to Cut' },
];

const CONFETTI_PIECES = [
  { left: '46%', top: '46%', tx: '-220px', ty: '-130px', rot: '-260deg', color: '#F9C80E', delay: '0s' },
  { left: '48%', top: '48%', tx: '-160px', ty: '140px', rot: '220deg', color: '#B91C1C', delay: '0.03s' },
  { left: '50%', top: '45%', tx: '10px', ty: '-170px', rot: '310deg', color: '#12805C', delay: '0.02s' },
  { left: '52%', top: '48%', tx: '190px', ty: '-120px', rot: '280deg', color: '#F9C80E', delay: '0.04s' },
  { left: '53%', top: '50%', tx: '240px', ty: '120px', rot: '-210deg', color: '#FFFDF5', delay: '0.01s' },
  { left: '49%', top: '50%', tx: '-95px', ty: '-165px', rot: '-180deg', color: '#FF9933', delay: '0.05s' },
  { left: '51%', top: '49%', tx: '110px', ty: '165px', rot: '260deg', color: '#12805C', delay: '0.03s' },
  { left: '47%', top: '51%', tx: '-260px', ty: '45px', rot: '-300deg', color: '#F9C80E', delay: '0.06s' },
  { left: '54%', top: '47%', tx: '270px', ty: '-40px', rot: '340deg', color: '#B91C1C', delay: '0.05s' },
  { left: '50%', top: '52%', tx: '-40px', ty: '190px', rot: '185deg', color: '#F9C80E', delay: '0.07s' },
  { left: '48%', top: '46%', tx: '70px', ty: '-145px', rot: '-240deg', color: '#FFFDF5', delay: '0.04s' },
  { left: '52%', top: '51%', tx: '-140px', ty: '110px', rot: '295deg', color: '#FF9933', delay: '0.06s' },
];

async function sha256Hex(input: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const data = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return '';
}

function playCeremonyAudio(kind: 'snip' | 'error' | 'unlock', enabled: boolean) {
  if (!enabled || typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    if (kind === 'error') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.18);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.21);
      return;
    }

    if (kind === 'unlock') {
      [523.25, 659.25, 783.99].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.06);
        gain.gain.setValueAtTime(0.08, now + i * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.06);
        osc.stop(now + i * 0.06 + 0.24);
      });
      return;
    }

    // Crisp metallic blade slice + warm celebratory fanfare chord
    const bladeOsc = ctx.createOscillator();
    const bladeGain = ctx.createGain();
    bladeOsc.type = 'sawtooth';
    bladeOsc.frequency.setValueAtTime(1400, now);
    bladeOsc.frequency.exponentialRampToValueAtTime(320, now + 0.14);
    bladeGain.gain.setValueAtTime(0.11, now);
    bladeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    bladeOsc.connect(bladeGain);
    bladeGain.connect(ctx.destination);
    bladeOsc.start(now);
    bladeOsc.stop(now + 0.17);

    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + 0.14 + idx * 0.055);
      gain.gain.setValueAtTime(0.09, now + 0.14 + idx * 0.055);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + 0.14 + idx * 0.055);
      osc.stop(now + 0.88);
    });
  } catch {
    // Ignore browser audio autoplay restrictions
  }
}

function CuttingToolSvg({
  tool,
  className = 'w-10 h-10',
}: {
  tool: CuttingToolId;
  className?: string;
}) {
  if (tool === 'scissors') {
    return (
      <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
        {/* Golden Ceremonial Inauguration Scissors */}
        <g transform="rotate(-24 32 32)">
          <path
            d="M14 28 L52 20 L55 24 L20 33 Z"
            fill="#E2E8F0"
            stroke="#1E293B"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M14 36 L52 44 L55 40 L20 31 Z"
            fill="#CBD5E1"
            stroke="#1E293B"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle cx="28" cy="32" r="3" fill="#F9C80E" stroke="#1E293B" strokeWidth="1.6" />
          <circle cx="12" cy="24" r="6.5" fill="none" stroke="#F9C80E" strokeWidth="4" />
          <circle cx="12" cy="24" r="6.5" fill="none" stroke="#1E293B" strokeWidth="1.2" />
          <circle cx="12" cy="40" r="6.5" fill="none" stroke="#F9C80E" strokeWidth="4" />
          <circle cx="12" cy="40" r="6.5" fill="none" stroke="#1E293B" strokeWidth="1.2" />
        </g>
      </svg>
    );
  }

  if (tool === 'cutter') {
    return (
      <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
        {/* Precision Architectural Utility Scalpel */}
        <g transform="rotate(-38 32 32)">
          <path
            d="M44 26 L58 31 L44 37 Z"
            fill="#F8FAFC"
            stroke="#1E293B"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <rect
            x="10"
            y="25"
            width="34"
            height="13"
            rx="4"
            fill="#2F3E4E"
            stroke="#F9C80E"
            strokeWidth="2"
          />
          <line x1="18" y1="29" x2="36" y2="29" stroke="#F9C80E" strokeWidth="2" strokeLinecap="round" />
          <line x1="18" y1="34" x2="32" y2="34" stroke="#CEE5DC" strokeWidth="1.6" strokeLinecap="round" />
        </g>
      </svg>
    );
  }

  // Default: Ceremonial Knife (Gold-hilted polished blade)
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <g transform="rotate(-35 32 32)">
        {/* Polished Steel Blade */}
        <path
          d="M28 24 L59 29 C55 36 46 39 28 38 Z"
          fill="#F8FAFC"
          stroke="#1E293B"
          strokeWidth="2.1"
          strokeLinejoin="round"
        />
        <path d="M31 27.5 L53 30.2" stroke="#94A3B8" strokeWidth="1.4" strokeLinecap="round" />
        {/* Gold Bolster Guard */}
        <rect
          x="24"
          y="21"
          width="5"
          height="20"
          rx="2"
          fill="#F9C80E"
          stroke="#1E293B"
          strokeWidth="1.8"
        />
        {/* Slate & Brass Handle */}
        <rect
          x="6"
          y="25.5"
          width="18"
          height="11"
          rx="4"
          fill="#2F3E4E"
          stroke="#1E293B"
          strokeWidth="1.8"
        />
        <circle cx="12" cy="31" r="1.6" fill="#F9C80E" />
        <circle cx="18" cy="31" r="1.6" fill="#F9C80E" />
      </g>
    </svg>
  );
}

interface RibbonCuttingLaunchGateProps {
  onLaunchComplete: (record: LaunchRecord) => void;
}

export function RibbonCuttingLaunchGate({ onLaunchComplete }: RibbonCuttingLaunchGateProps) {
  const [selectedTool, setSelectedTool] = useState<CuttingToolId>('knife');
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isArmed, setIsArmed] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [shakeKnot, setShakeKnot] = useState(false);
  const [cutPhase, setCutPhase] = useState<'tied' | 'slicing' | 'launched'>('tied');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number; inside: boolean }>({
    x: 0,
    y: 0,
    inside: false,
  });
  const [istClock, setIstClock] = useState('');

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const stageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const updateClock = () => {
      try {
        const formatted = new Intl.DateTimeFormat('en-IN', {
          timeZone: 'Asia/Kolkata',
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
          .format(new Date())
          .toUpperCase();
        setIstClock(`${formatted} IST`);
      } catch {
        setIstClock(new Date().toLocaleTimeString());
      }
    };
    updateClock();
    const timer = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const codeString = useMemo(() => digits.join(''), [digits]);

  const verifyCode = useCallback(
    async (candidate: string): Promise<boolean> => {
      if (!/^\d{6}$/.test(candidate)) {
        setErrorMsg('Enter all 6 numeric digits of your official launch passcode.');
        return false;
      }

      setIsVerifying(true);
      setErrorMsg('');

      try {
        let verified = false;

        try {
          const resp = await fetch('/api/launch/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: candidate }),
          });
          const contentType = resp.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const payload = (await resp.json()) as { ok?: boolean; error?: string };
            if (resp.ok && payload.ok) {
              verified = true;
            } else {
              setErrorMsg(
                payload.error || 'Incorrect 6-digit launch code. Please verify and try again.'
              );
              setIsArmed(false);
              playCeremonyAudio('error', soundEnabled);
              setIsVerifying(false);
              return false;
            }
          } else {
            // Static deployment (e.g. Vercel without /api/): verify cryptographically via SHA-256
            const digest = await sha256Hex(candidate);
            const envOverride = (import.meta.env.VITE_LAUNCH_CODE || '').trim();
            const targetHash = envOverride
              ? await sha256Hex(envOverride)
              : DEFAULT_LAUNCH_CODE_SHA256;
            verified = digest === targetHash;
          }
        } catch {
          const digest = await sha256Hex(candidate);
          const envOverride = (import.meta.env.VITE_LAUNCH_CODE || '').trim();
          const targetHash = envOverride
            ? await sha256Hex(envOverride)
            : DEFAULT_LAUNCH_CODE_SHA256;
          verified = digest === targetHash;
        }

        if (verified) {
          setIsArmed(true);
          setErrorMsg('');
          playCeremonyAudio('unlock', soundEnabled);
          return true;
        } else {
          setIsArmed(false);
          setErrorMsg('Incorrect 6-digit launch code. Please check and try again.');
          playCeremonyAudio('error', soundEnabled);
          return false;
        }
      } finally {
        setIsVerifying(false);
      }
    },
    [soundEnabled]
  );

  // Auto-verify smoothly when all 6 digits are filled
  useEffect(() => {
    if (codeString.length === 6 && !isArmed && cutPhase === 'tied') {
      void verifyCode(codeString);
    }
  }, [codeString, isArmed, cutPhase, verifyCode]);

  const handleDigitChange = (index: number, raw: string) => {
    const clean = raw.replace(/\D/g, '');
    if (!clean) {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      setIsArmed(false);
      setErrorMsg('');
      return;
    }

    if (clean.length > 1) {
      const pasted = clean.slice(0, 6).split('');
      const next = ['', '', '', '', '', ''];
      for (let i = 0; i < pasted.length; i += 1) {
        next[i] = pasted[i];
      }
      setDigits(next);
      setIsArmed(false);
      setErrorMsg('');
      const focusIdx = Math.min(pasted.length, 5);
      inputRefs.current[focusIdx]?.focus();
      return;
    }

    const next = [...digits];
    next[index] = clean;
    setDigits(next);
    setIsArmed(false);
    setErrorMsg('');
    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    } else if (e.key === 'Enter') {
      if (isArmed) {
        triggerRibbonCut();
      } else {
        void verifyCode(codeString);
      }
    }
  };

  const triggerRibbonCut = useCallback(() => {
    if (cutPhase !== 'tied') return;

    if (!isArmed) {
      setShakeKnot(true);
      setErrorMsg(
        codeString.length === 6
          ? 'Please verify your 6-digit launch code before cutting the ribbon.'
          : 'Enter your 6-digit official launch passcode first to unlock the blade.'
      );
      playCeremonyAudio('error', soundEnabled);
      const firstEmpty = digits.findIndex((d) => !d);
      inputRefs.current[firstEmpty >= 0 ? firstEmpty : 0]?.focus();
      window.setTimeout(() => setShakeKnot(false), 500);
      return;
    }

    setCutPhase('slicing');
    playCeremonyAudio('snip', soundEnabled);

    const record: LaunchRecord = {
      launched: true,
      launchedAtIso: new Date().toISOString(),
      toolUsed: selectedTool,
    };

    window.setTimeout(() => {
      setCutPhase('launched');
    }, 620);

    window.setTimeout(() => {
      onLaunchComplete(record);
    }, 1550);
  }, [cutPhase, isArmed, codeString.length, digits, soundEnabled, selectedTool, onLaunchComplete]);

  const activeToolMeta = CUTTING_TOOLS.find((t) => t.id === selectedTool) || CUTTING_TOOLS[0];

  const handleStageMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    setHoverPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      inside: true,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="vcpl-launch-heading"
      className={`fixed inset-0 z-50 overflow-y-auto transition-opacity duration-500 ${
        cutPhase === 'launched' ? 'opacity-95' : 'opacity-100'
      } bg-[#FEF2C8] dark:bg-[#0B1120] text-[#2F3E4E] dark:text-slate-100`}
      style={{
        backgroundImage:
          'radial-gradient(rgba(47, 62, 78, 0.08) 1px, transparent 1px)',
        backgroundSize: '22px 22px',
      }}
    >
      {/* Marigold Top Architectural Accent Bar */}
      <div className="w-full h-1.5 bg-[#F9C80E] border-b border-[#2F3E4E]" aria-hidden="true" />

      <div className="min-h-[calc(100vh-6px)] max-w-[1160px] mx-auto px-4 sm:px-8 py-6 sm:py-10 flex flex-col justify-between gap-6">
        {/* Top Row: Brand Logo + Sound Control */}
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <VcplBrandLogo variant="header" className="h-8 sm:h-10" />
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-xs font-mono tabular-nums text-[#475569] dark:text-slate-300">
              {istClock}
            </span>
            <button
              type="button"
              onClick={() => setSoundEnabled((s) => !s)}
              aria-label={soundEnabled ? 'Mute ceremony sound' : 'Enable ceremony sound'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FFFDF5] dark:bg-slate-800 border-[1.5px] border-[#2F3E4E]/25 dark:border-slate-600 text-xs font-semibold text-[#2F3E4E] dark:text-slate-200 hover:border-[#2F3E4E] transition-colors cursor-pointer whitespace-nowrap"
            >
              {soundEnabled ? (
                <Volume2 className="w-3.5 h-3.5 text-[#12805C] dark:text-emerald-400" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 text-[#64748B]" />
              )}
              <span>{soundEnabled ? 'Sound On' : 'Muted'}</span>
            </button>
          </div>
        </header>

        {/* Centerpiece: Coming Soon Hero + Instrument Selector + 6-Digit Code + Tied Ribbon */}
        <main className="my-auto py-2 space-y-7 text-center">
          <div className="max-w-2xl mx-auto space-y-3">
            <p className="text-xs sm:text-sm font-mono uppercase tracking-[0.18em] text-[#B45309] dark:text-[#F9C80E] font-bold">
              Coming Soon · Grand Ribbon Cutting Ceremony
            </p>
            <h1
              id="vcpl-launch-heading"
              className="font-display font-extrabold tracking-tight text-[#2F3E4E] dark:text-[#FFFDF5] leading-[1.08]"
              style={{ fontSize: 'clamp(2rem, 4.4vw, 3.35rem)', textWrap: 'balance' }}
            >
              Official Inauguration of VCPL Tools
            </h1>
            <p className="text-sm sm:text-base text-[#475569] dark:text-slate-300 leading-relaxed max-w-xl mx-auto">
              179+ private browser-based banking, GST, Form 26AS, PDF &amp; calculation tools.
              Verify the 6-digit launch code, select your blade, and click the tied ribbon to
              officially open the website.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-xs font-mono tabular-nums text-[#64748B] dark:text-slate-400 pt-1">
              <span>Launch Date: 19 Nov 2026</span>
              <span aria-hidden="true">·</span>
              <span>Mangalore, Bharat</span>
              <span aria-hidden="true">·</span>
              <span>100% Client-Side Suite</span>
            </div>
          </div>

          {/* Cutting Instrument Selector & 6-Digit Launch Verification Box */}
          <div className="max-w-xl mx-auto bg-[#FFFDF5] dark:bg-[#111827] border-2 border-[#2F3E4E] dark:border-slate-600 rounded-2xl p-5 sm:p-6 shadow-[0_6px_0_#2F3E4E] dark:shadow-[0_6px_0_#020617] space-y-5">
            {/* Step 1: Select Cutting Option */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-[#475569] dark:text-slate-300">
                <span>1. Select Cutting Option</span>
                <span className="font-mono text-[11px] text-[#B45309] dark:text-[#F9C80E]">
                  Active: {activeToolMeta.label}
                </span>
              </div>
              <div
                role="radiogroup"
                aria-label="Ribbon cutting instrument"
                className="grid grid-cols-3 gap-2"
              >
                {CUTTING_TOOLS.map((tool) => {
                  const active = selectedTool === tool.id;
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setSelectedTool(tool.id)}
                      className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl border-[1.5px] text-xs font-display font-bold transition-all cursor-pointer whitespace-nowrap ${
                        active
                          ? 'bg-[#F9C80E] text-[#2F3E4E] border-[#2F3E4E] shadow-[0_2px_0_#2F3E4E]'
                          : 'bg-[#FEF2C8]/50 dark:bg-slate-800/80 text-[#2F3E4E] dark:text-slate-200 border-[#2F3E4E]/20 dark:border-slate-700 hover:border-[#2F3E4E]'
                      }`}
                    >
                      <CuttingToolSvg tool={tool.id} className="w-5 h-5 shrink-0" />
                      <span className="truncate">{tool.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: 6-Digit Launch Verification Code */}
            <div className="space-y-2.5 pt-2 border-t border-[#2F3E4E]/12 dark:border-slate-700">
              <div className="flex items-center justify-between text-xs font-semibold text-[#475569] dark:text-slate-300">
                <label htmlFor="launch-otp-0" className="inline-flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-[#B45309] dark:text-[#F9C80E]" />
                  <span>2. Enter 6-Digit Official Launch Code</span>
                </label>
                <span className="inline-flex items-center gap-1 text-[11px] font-mono">
                  {isArmed ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#12805C] dark:text-emerald-400" />
                      <span className="text-[#12805C] dark:text-emerald-400 font-bold">
                        Blade Armed
                      </span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3 h-3 text-[#64748B]" />
                      <span className="text-[#64748B] dark:text-slate-400">Locked</span>
                    </>
                  )}
                </span>
              </div>

              <div className="flex items-center justify-center gap-2 sm:gap-2.5">
                {digits.map((digit, idx) => (
                  <input
                    key={idx}
                    id={`launch-otp-${idx}`}
                    ref={(el) => {
                      inputRefs.current[idx] = el;
                    }}
                    type="password"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    aria-label={`Launch code digit ${idx + 1} of 6`}
                    value={digit}
                    disabled={cutPhase !== 'tied'}
                    onChange={(e) => handleDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                    className={`w-10 h-12 sm:w-12 sm:h-13 text-center text-lg sm:text-xl font-mono font-extrabold tabular-nums rounded-xl border-2 transition-all focus:outline-none ${
                      isArmed
                        ? 'bg-[#CEE5DC]/45 dark:bg-emerald-950/60 border-[#12805C] text-[#12805C] dark:text-emerald-300'
                        : errorMsg
                        ? 'bg-red-50 dark:bg-red-950/30 border-[#B91C1C] text-[#B91C1C] dark:text-red-300'
                        : 'bg-white dark:bg-slate-900 border-[#2F3E4E]/35 dark:border-slate-600 text-[#2F3E4E] dark:text-white focus:border-[#2F3E4E] dark:focus:border-[#F9C80E] focus:ring-2 focus:ring-[#F9C80E]/50'
                    }`}
                  />
                ))}
              </div>

              {errorMsg && (
                <p
                  role="alert"
                  className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-[#B91C1C] dark:text-red-400"
                >
                  <XCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </p>
              )}

              {isArmed && cutPhase === 'tied' && (
                <p className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-[#12805C] dark:text-emerald-400">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Code verified! {activeToolMeta.actionLabel}.</span>
                </p>
              )}

              {!isArmed && (
                <button
                  type="button"
                  disabled={isVerifying || codeString.length < 6}
                  onClick={() => void verifyCode(codeString)}
                  className="mt-1 inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-[#2F3E4E] hover:bg-[#1E293B] disabled:opacity-45 text-[#FFFDF5] font-display font-bold text-xs sm:text-sm transition-all cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
                >
                  <KeyRound className="w-4 h-4 text-[#F9C80E]" />
                  <span>{isVerifying ? 'Verifying Code...' : 'Verify 6-Digit Code'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Step 3: Interactive Tied Ceremonial Ribbon Stage */}
          <div
            ref={stageRef}
            data-ribbon-stage="true"
            onMouseMove={handleStageMouseMove}
            onMouseLeave={() => setHoverPos((p) => ({ ...p, inside: false }))}
            onClick={triggerRibbonCut}
            role="button"
            tabIndex={0}
            aria-label={
              isArmed
                ? `Cut the ceremonial ribbon with ${activeToolMeta.label} to officially launch VCPL Tools`
                : 'Ceremonial ribbon tied — enter 6-digit code first to unlock cutting'
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                triggerRibbonCut();
              }
            }}
            className={`relative w-full py-12 sm:py-16 select-none overflow-hidden rounded-2xl border-2 border-dashed transition-colors ${
              isArmed
                ? 'border-[#12805C]/55 bg-[#FFFDF5]/55 dark:bg-slate-900/50 cursor-none'
                : 'border-[#2F3E4E]/25 dark:border-slate-700 bg-[#FFFDF5]/35 dark:bg-slate-900/30 cursor-pointer'
            }`}
          >
            {/* Confetti Burst Particles on Cut */}
            {cutPhase !== 'tied' && (
              <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
                {CONFETTI_PIECES.map((c, idx) => (
                  <span
                    key={idx}
                    className="vcpl-confetti-piece absolute w-2.5 h-3.5 rounded-xs"
                    style={
                      {
                        left: c.left,
                        top: c.top,
                        backgroundColor: c.color,
                        animationDelay: c.delay,
                        '--tx': c.tx,
                        '--ty': c.ty,
                        '--rot': c.rot,
                      } as React.CSSProperties
                    }
                  />
                ))}
              </div>
            )}

            {/* Left Half of Tied Crimson & Gold Ribbon */}
            <div
              className={`absolute left-0 top-1/2 -translate-y-1/2 w-1/2 h-11 sm:h-14 flex items-center ${
                cutPhase === 'tied'
                  ? 'vcpl-ribbon-idle'
                  : 'vcpl-ribbon-part-left'
              }`}
              aria-hidden="true"
            >
              <div
                className="w-full h-full border-y-[3px] border-[#F9C80E] shadow-[0_6px_14px_rgba(153,27,27,0.35)] relative overflow-hidden"
                style={{
                  background:
                    'linear-gradient(180deg, #DC2626 0%, #B91C1C 48%, #7F1D1D 100%)',
                }}
              >
                <div className="absolute inset-x-0 top-1.5 h-px bg-[#FEF2C8]/35" />
                <div className="w-full h-full flex items-center justify-end pr-12 sm:pr-20">
                  <span className="font-display font-extrabold text-[10px] sm:text-xs tracking-[0.26em] uppercase text-[#FEF2C8]/90 whitespace-nowrap">
                    VCPL TOOLS
                  </span>
                </div>
              </div>
            </div>

            {/* Right Half of Tied Crimson & Gold Ribbon */}
            <div
              className={`absolute right-0 top-1/2 -translate-y-1/2 w-1/2 h-11 sm:h-14 flex items-center ${
                cutPhase === 'tied'
                  ? 'vcpl-ribbon-idle'
                  : 'vcpl-ribbon-part-right'
              }`}
              aria-hidden="true"
            >
              <div
                className="w-full h-full border-y-[3px] border-[#F9C80E] shadow-[0_6px_14px_rgba(153,27,27,0.35)] relative overflow-hidden"
                style={{
                  background:
                    'linear-gradient(180deg, #DC2626 0%, #B91C1C 48%, #7F1D1D 100%)',
                }}
              >
                <div className="absolute inset-x-0 top-1.5 h-px bg-[#FEF2C8]/35" />
                <div className="w-full h-full flex items-center justify-start pl-12 sm:pl-20">
                  <span className="font-display font-extrabold text-[10px] sm:text-xs tracking-[0.26em] uppercase text-[#FEF2C8]/90 whitespace-nowrap">
                    GRAND LAUNCH
                  </span>
                </div>
              </div>
            </div>

            {/* Center Sculpted Ribbon Bow & Cutting Target */}
            <div
              className={`relative z-10 mx-auto w-36 h-28 flex items-center justify-center ${
                shakeKnot
                  ? 'vcpl-ribbon-shake'
                  : cutPhase !== 'tied'
                  ? 'vcpl-bow-burst'
                  : ''
              }`}
            >
              <svg viewBox="0 0 160 120" className="w-36 h-28 drop-shadow-[0_6px_12px_rgba(0,0,0,0.3)]" aria-hidden="true">
                {/* Flowing Bow Tails */}
                <path
                  d="M74 64 L44 112 L58 104 L68 114 L80 68 Z"
                  fill="#991B1B"
                  stroke="#F9C80E"
                  strokeWidth="2"
                />
                <path
                  d="M86 64 L116 112 L102 104 L92 114 L80 68 Z"
                  fill="#991B1B"
                  stroke="#F9C80E"
                  strokeWidth="2"
                />
                {/* Left Satin Bow Loop */}
                <path
                  d="M76 58 C46 22, 16 26, 20 58 C24 88, 52 84, 76 62 Z"
                  fill="#DC2626"
                  stroke="#F9C80E"
                  strokeWidth="2.4"
                />
                <path
                  d="M66 56 C48 40, 34 44, 34 58 C34 72, 48 70, 66 60 Z"
                  fill="#991B1B"
                  opacity="0.55"
                />
                {/* Right Satin Bow Loop */}
                <path
                  d="M84 58 C114 22, 144 26, 140 58 C136 88, 108 84, 84 62 Z"
                  fill="#DC2626"
                  stroke="#F9C80E"
                  strokeWidth="2.4"
                />
                <path
                  d="M94 56 C112 40, 126 44, 126 58 C126 72, 112 70, 94 60 Z"
                  fill="#991B1B"
                  opacity="0.55"
                />
                {/* Center Gold-Trimmed Satin Knot */}
                <rect
                  x="68"
                  y="44"
                  width="24"
                  height="30"
                  rx="8"
                  fill="#B91C1C"
                  stroke="#F9C80E"
                  strokeWidth="2.8"
                />
                {/* Dashed Cut Line When Armed */}
                {isArmed && (
                  <line
                    x1="80"
                    y1="14"
                    x2="80"
                    y2="104"
                    stroke="#FFFDF5"
                    strokeWidth="2.2"
                    strokeDasharray="5 4"
                  />
                )}
              </svg>

              {/* Animated Blade Slash Overlay on Click */}
              {cutPhase === 'slicing' && (
                <div className="vcpl-blade-slash pointer-events-none absolute inset-0 flex items-center justify-center">
                  <CuttingToolSvg tool={selectedTool} className="w-16 h-16 drop-shadow-lg" />
                </div>
              )}
            </div>

            {/* Launched Celebration Message Inside Stage */}
            {cutPhase === 'launched' && (
              <div className="relative z-20 -mt-10 animate-bounce space-y-1">
                <p className="font-display font-extrabold text-xl sm:text-2xl text-[#12805C] dark:text-emerald-400">
                  Ribbon Cut — VCPL Tools Officially Launched!
                </p>
                <p className="text-xs font-mono text-[#475569] dark:text-slate-300">
                  Opening all 179+ utilities...
                </p>
              </div>
            )}

            {/* Floating Knife / Scissors / Cutter Following Pointer Inside Armed Stage */}
            {hoverPos.inside && cutPhase === 'tied' && (
              <div
                className="pointer-events-none absolute z-30 transition-transform duration-75"
                style={{
                  left: hoverPos.x - 10,
                  top: hoverPos.y - 36,
                }}
                aria-hidden="true"
              >
                <CuttingToolSvg
                  tool={selectedTool}
                  className={`w-12 h-12 drop-shadow-[0_4px_10px_rgba(0,0,0,0.35)] ${
                    isArmed ? 'opacity-100 scale-110' : 'opacity-65 grayscale'
                  }`}
                />
              </div>
            )}

            {/* Explicit Accessible Cut Trigger Below Ribbon */}
            {cutPhase === 'tied' && (
              <div className="relative z-20 mt-2">
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FFFDF5] dark:bg-slate-800 border-[1.5px] border-[#2F3E4E] dark:border-slate-600 shadow-[0_2px_0_#2F3E4E] text-xs sm:text-sm font-display font-bold text-[#2F3E4E] dark:text-[#F9C80E]">
                  {isArmed ? (
                    <>
                      <Scissors className="w-4 h-4 text-[#12805C] dark:text-emerald-400" />
                      <span>Click Ribbon Here with {activeToolMeta.label} to Cut &amp; Launch</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5 text-[#B45309] dark:text-[#F9C80E]" />
                      <span>Ribbon Tied · Verify 6-Digit Code Above Before Cutting</span>
                    </>
                  )}
                </span>
              </div>
            )}
          </div>
        </main>

        {/* Quiet Footer Line */}
        <footer className="text-center text-xs text-[#64748B] dark:text-slate-400">
          VCPL Tools · Engineered in Mangalore, Bharat · Zero Server File Uploads
        </footer>
      </div>
    </div>
  );
}
