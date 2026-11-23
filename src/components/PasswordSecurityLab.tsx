import {useEffect, useMemo, useState} from 'react';
import {AlertTriangle, Eye, EyeOff, Lock, ShieldCheck} from 'lucide-react';

function estimateCharsetPool(value: string): number {
  let pool = 0;
  if (/[a-z]/.test(value)) pool += 26;
  if (/[A-Z]/.test(value)) pool += 26;
  if (/[0-9]/.test(value)) pool += 10;
  if (/[^a-zA-Z0-9\s]/.test(value)) pool += 33;
  if (/\s/.test(value)) pool += 1;
  return Math.max(pool, 1);
}

function formatCrackEstimate(entropyBits: number, memoryMiB: number, iterations: number): string {
  const guessesPerSecond = Math.max(250, Math.round(48000 / ((memoryMiB / 32) * iterations)));
  const totalSpace = Math.pow(2, Math.min(entropyBits, 96));
  const seconds = (totalSpace * 0.5) / guessesPerSecond;

  if (seconds < 60) return `${Math.max(1, Math.round(seconds))} seconds`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} hours`;
  if (seconds < 86400 * 365) return `${Math.round(seconds / 86400)} days`;
  const years = seconds / (86400 * 365);
  if (years < 1000) return `${Math.round(years)} years`;
  if (years < 1_000_000) return `${Math.round(years / 1000)}K years`;
  return '1M+ years';
}

export function PasswordSecurityLab() {
  const [sampleInput, setSampleInput] = useState('timber-vault-horizon-49');
  const [showText, setShowText] = useState(false);
  const [memoryMiB, setMemoryMiB] = useState<32 | 64 | 128>(64);
  const [timeCost, setTimeCost] = useState<2 | 3 | 4>(3);
  const [shaDigestHex, setShaDigestHex] = useState<string>('');

  const normalized = useMemo(() => sampleInput.normalize('NFKC'), [sampleInput]);
  const nfkcChanged = normalized !== sampleInput;

  const entropyBits = useMemo(() => {
    if (!normalized) return 0;
    const pool = estimateCharsetPool(normalized);
    return Math.round(normalized.length * Math.log2(pool));
  }, [normalized]);

  useEffect(() => {
    let active = true;
    async function computePrehash() {
      if (!normalized || typeof window === 'undefined' || !window.crypto?.subtle) {
        if (active) setShaDigestHex('—');
        return;
      }
      const encoded = new TextEncoder().encode(`vcpl-demo-pepper:${normalized}`);
      const buffer = await window.crypto.subtle.digest('SHA-256', encoded);
      const hex = Array.from(new Uint8Array(buffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      if (active) setShaDigestHex(hex);
    }
    void computePrehash();
    return () => {
      active = false;
    };
  }, [normalized]);

  const strengthAssessment = useMemo(() => {
    if (normalized.length === 0) {
      return {
        label: 'Awaiting Input',
        tone: 'text-[#64748B] dark:text-slate-400',
        pass: false,
      };
    }
    if (normalized.length < 12) {
      return {
        label: 'Below 12-Char Minimum',
        tone: 'text-[#B91C1C] dark:text-red-400',
        pass: false,
      };
    }
    if (entropyBits < 60) {
      return {
        label: 'Moderate Entropy',
        tone: 'text-[#B45309] dark:text-amber-300',
        pass: true,
      };
    }
    return {
      label: 'Strong Passphrase',
      tone: 'text-[#12805C] dark:text-emerald-400',
      pass: true,
    };
  }, [normalized.length, entropyBits]);

  const crackEstimate = useMemo(
    () => formatCrackEstimate(entropyBits, memoryMiB, timeCost),
    [entropyBits, memoryMiB, timeCost]
  );

  return (
    <div className="my-6 bg-[#FEF2C8]/65 dark:bg-[#0B1120] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-5 sm:p-6 shadow-[0_3px_0_#2F3E4E]/20 space-y-5 no-print">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#2F3E4E]/15 dark:border-slate-800 pb-4">
        <div className="flex items-start gap-2.5">
          <Lock className="w-4 h-4 text-[#12805C] dark:text-[#F9C80E] mt-1 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#12805C] dark:text-[#F9C80E]">
              Interactive Technical Lab · By Arjun Bangera
            </p>
            <h3 className="font-display font-extrabold text-base text-[#2F3E4E] dark:text-slate-100 mt-0.5">
              Argon2id Cost, NFKC Normalization &amp; Pre-Hash Simulator
            </h3>
          </div>
        </div>
        <span className="text-[11px] font-mono text-[#475569] dark:text-slate-400">
          Runs locally via Web Crypto API · Zero uploads
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
        <div className="md:col-span-6">
          <label
            htmlFor="vcpl-lab-password-input"
            className="block text-xs font-display font-bold text-[#2F3E4E] dark:text-slate-200 mb-1.5"
          >
            Test Candidate Passphrase
          </label>
          <div className="relative">
            <input
              id="vcpl-lab-password-input"
              type={showText ? 'text' : 'password'}
              value={sampleInput}
              onChange={(e) => setSampleInput(e.target.value)}
              placeholder="Enter sample passphrase..."
              className="w-full pr-10 pl-3.5 py-2.5 text-xs sm:text-sm font-mono bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E]/45 dark:border-slate-600 rounded-xl text-[#2F3E4E] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#12805C] dark:focus:ring-[#F9C80E]"
            />
            <button
              type="button"
              onClick={() => setShowText((s) => !s)}
              aria-label={showText ? 'Hide sample passphrase' : 'Reveal sample passphrase'}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-[#475569] dark:text-slate-400 hover:text-[#2F3E4E] dark:hover:text-white cursor-pointer"
            >
              {showText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="md:col-span-3">
          <span className="block text-xs font-display font-bold text-[#2F3E4E] dark:text-slate-200 mb-1.5">
            Memory Cost (m)
          </span>
          <div className="grid grid-cols-3 gap-1 p-1 bg-[#FFFDF5] dark:bg-[#131C2E] rounded-xl border border-[#2F3E4E]/35 dark:border-slate-700">
            {([32, 64, 128] as const).map((mem) => (
              <button
                key={mem}
                type="button"
                onClick={() => setMemoryMiB(mem)}
                className={`py-1.5 text-xs font-mono font-bold rounded-lg transition-colors cursor-pointer ${
                  memoryMiB === mem
                    ? 'bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#F9C80E] dark:text-[#0F172A]'
                    : 'text-[#475569] dark:text-slate-300 hover:bg-[#FEF2C8] dark:hover:bg-slate-800'
                }`}
              >
                {mem}M
              </button>
            ))}
          </div>
        </div>

        <div className="md:col-span-3">
          <span className="block text-xs font-display font-bold text-[#2F3E4E] dark:text-slate-200 mb-1.5">
            Iterations (t)
          </span>
          <div className="grid grid-cols-3 gap-1 p-1 bg-[#FFFDF5] dark:bg-[#131C2E] rounded-xl border border-[#2F3E4E]/35 dark:border-slate-700">
            {([2, 3, 4] as const).map((passes) => (
              <button
                key={passes}
                type="button"
                onClick={() => setTimeCost(passes)}
                className={`py-1.5 text-xs font-mono font-bold rounded-lg transition-colors cursor-pointer ${
                  timeCost === passes
                    ? 'bg-[#12805C] dark:bg-[#F9C80E] text-white dark:text-[#0F172A]'
                    : 'text-[#475569] dark:text-slate-300 hover:bg-[#FEF2C8] dark:hover:bg-slate-800'
                }`}
              >
                t={passes}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-3 border-t border-[#2F3E4E]/15 dark:border-slate-800">
        <div>
          <p className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400">Policy Status</p>
          <p className={`mt-1 text-xs sm:text-sm font-display font-extrabold flex items-center gap-1.5 ${strengthAssessment.tone}`}>
            {strengthAssessment.pass ? (
              <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
            )}
            <span>{strengthAssessment.label}</span>
          </p>
        </div>

        <div>
          <p className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400">
            Length &amp; Entropy
          </p>
          <p className="mt-1 text-xs sm:text-sm font-mono tabular-nums font-bold text-[#2F3E4E] dark:text-slate-100">
            {normalized.length} chars · ~{entropyBits} bits
          </p>
        </div>

        <div>
          <p className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400">
            Argon2id GPU Resistance
          </p>
          <p className="mt-1 text-xs sm:text-sm font-mono tabular-nums font-bold text-[#2F3E4E] dark:text-slate-100">
            {crackEstimate}
          </p>
        </div>

        <div>
          <p className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400">
            NFKC Normalization
          </p>
          <p className="mt-1 text-xs sm:text-sm font-mono font-bold text-[#2F3E4E] dark:text-slate-100">
            {nfkcChanged ? 'Bytes normalized' : 'Canonical UTF-8'}
          </p>
        </div>
      </div>

      <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border border-[#2F3E4E]/25 dark:border-slate-700 rounded-xl p-3.5">
        <p className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 mb-1">
          Local Web Crypto Pre-Hash Digest (SHA-256 Simulation Prior to Argon2id)
        </p>
        <p className="font-mono text-xs text-[#2F3E4E] dark:text-emerald-300 break-all tabular-nums">
          {shaDigestHex || 'Computing...'}
        </p>
      </div>
    </div>
  );
}
