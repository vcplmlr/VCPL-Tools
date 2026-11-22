import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, Eye, EyeOff, KeyRound, Lock, Unlock } from 'lucide-react';

interface ToolPasscodeGateProps {
  toolCode: string;
  toolTitle: string;
  sessionKey: string;
  verifyWithServerAdminAuth?: boolean;
  bypassGate?: boolean;
  description?: string;
  onBack?: () => void;
  children: (controls: { lockTool: () => void }) => React.ReactNode;
}

export const ToolPasscodeGate: React.FC<ToolPasscodeGateProps> = ({
  toolCode,
  toolTitle,
  sessionKey,
  verifyWithServerAdminAuth = false,
  bypassGate = false,
  description = 'This tool is locked for authorized dealership access only. Enter the 6-digit passcode to unlock.',
  onBack,
  children,
}) => {
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [setupRequired, setSetupRequired] = useState<boolean>(false);
  const [pinDigits, setPinDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [showPin, setShowPin] = useState(false);
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const pinRefs = useRef<Array<HTMLInputElement | null>>([]);

  // Clear any legacy session/local/cookie unlock remnants on mount
  useEffect(() => {
    try {
      window.sessionStorage.removeItem(sessionKey);
      window.localStorage.removeItem(sessionKey);
    } catch {
      // Ignore storage errors
    }
  }, [sessionKey]);

  useEffect(() => {
    if (bypassGate || isUnlocked) return;
    let active = true;
    const statusUrl = verifyWithServerAdminAuth
      ? '/api/admin/status'
      : '/api/tool-passcode/status';
    void fetch(statusUrl)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { configured?: boolean } | null) => {
        if (active && data && typeof data.configured === 'boolean') {
          setSetupRequired(!data.configured);
        }
      })
      .catch(() => {
        // Ignore status check error
      });
    return () => {
      active = false;
    };
  }, [bypassGate, isUnlocked, verifyWithServerAdminAuth]);

  const tryUnlock = useCallback(
    async (candidate: string) => {
      if (isVerifying) return;
      if (!/^\d{6}$/.test(candidate)) {
        setPinError('Please enter all 6 numeric digits of the passcode.');
        return;
      }

      setIsVerifying(true);
      setPinError('');
      try {
        const claimUrl = verifyWithServerAdminAuth
          ? '/api/admin/claim'
          : '/api/tool-passcode/claim';
        const authUrl = verifyWithServerAdminAuth
          ? '/api/admin/auth'
          : '/api/tool-passcode/verify';
        const endpoint = setupRequired ? claimUrl : authUrl;

        let res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ passcode: candidate }),
        });

        let payload = (await res.json().catch(() => null)) as {
          code?: string;
          error?: string;
        } | null;

        if (
          res.status === 409 &&
          (payload?.code === 'ADMIN_SETUP_REQUIRED' ||
            payload?.code === 'TOOL_PASSCODE_SETUP_REQUIRED')
        ) {
          setSetupRequired(true);
          res = await fetch(claimUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ passcode: candidate }),
          });
          payload = (await res.json().catch(() => null)) as {
            code?: string;
            error?: string;
          } | null;
        }

        if (res.ok) {
          setSetupRequired(false);
          setIsUnlocked(true);
          setPinError('');
          setPinDigits(['', '', '', '', '', '']);
          return;
        }

        if (res.status === 429) {
          setPinError('Too many attempts. Please wait a moment and try again.');
          return;
        }

        setPinError(
          payload?.error ||
            (verifyWithServerAdminAuth
              ? 'Incorrect admin passcode. Access denied.'
              : 'Incorrect 6-digit passcode. Access denied.')
        );
      } catch {
        setPinError('Unable to reach verification server. Please check connection and retry.');
      } finally {
        setIsVerifying(false);
      }
    },
    [isVerifying, setupRequired, verifyWithServerAdminAuth]
  );

  const lockTool = useCallback(() => {
    setIsUnlocked(false);
    setPinDigits(['', '', '', '', '', '']);
    setPinError('');
    try {
      window.sessionStorage.removeItem(sessionKey);
      window.localStorage.removeItem(sessionKey);
    } catch {
      // Ignore storage errors
    }
  }, [sessionKey]);

  // Auto-lock on browser refresh, navigation exit, or bfcache pagehide
  useEffect(() => {
    const handleExit = () => {
      lockTool();
    };
    window.addEventListener('pagehide', handleExit);
    window.addEventListener('beforeunload', handleExit);
    return () => {
      window.removeEventListener('pagehide', handleExit);
      window.removeEventListener('beforeunload', handleExit);
    };
  }, [lockTool]);

  useEffect(() => {
    if (!bypassGate && !isUnlocked) {
      const id = window.setTimeout(() => pinRefs.current[0]?.focus(), 60);
      return () => window.clearTimeout(id);
    }
  }, [bypassGate, isUnlocked]);

  if (bypassGate || isUnlocked) {
    return <>{children({ lockTool })}</>;
  }

  const enteredPin = pinDigits.join('');
  return (
    <div className="py-6 sm:py-10">
      <div className="max-w-md mx-auto bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-600 rounded-2xl p-6 sm:p-7 shadow-[0_6px_0_#2F3E4E] dark:shadow-[0_6px_0_#020617] space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-xl bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] flex items-center justify-center text-[#2F3E4E] shrink-0 shadow-[0_2px_0_#2F3E4E]">
              <Lock className="w-5 h-5" aria-hidden="true" />
            </span>
            <div>
              <span className="inline-block px-2 py-0.5 rounded bg-[#CEE5DC] border border-[#2F3E4E] text-[10px] font-mono font-bold text-[#2F3E4E]">
                {toolCode} · Restricted Access
              </span>
              <h2 className="font-display font-extrabold text-lg sm:text-xl text-[#2F3E4E] dark:text-slate-100 mt-1">
                {toolTitle}
              </h2>
            </div>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-[#475569] dark:text-slate-300 leading-relaxed">
          {description}
        </p>

        {setupRequired && (
          <div className="rounded-xl border border-[#2F3E4E]/25 dark:border-amber-400/40 bg-[#FEF2C8]/75 dark:bg-amber-950/40 px-3.5 py-2.5 text-xs font-medium text-[#2F3E4E] dark:text-amber-200">
            <strong className="font-bold">Initial Setup:</strong> Enter your authorized 6-digit{' '}
            {verifyWithServerAdminAuth ? 'admin' : 'tool'} passcode to activate and unlock.
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void tryUnlock(enteredPin);
          }}
          className="space-y-4"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-bold text-[#2F3E4E] dark:text-slate-200 uppercase tracking-wider inline-flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-[#B45309] dark:text-[#F9C80E]" aria-hidden="true" />
                <span>6-Digit Passcode</span>
              </label>
              <button
                type="button"
                onClick={() => setShowPin((s) => !s)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#475569] dark:text-slate-300 hover:text-[#2F3E4E] dark:hover:text-white cursor-pointer"
              >
                {showPin ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Hide</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Show</span>
                  </>
                )}
              </button>
            </div>

            <div
              className="grid grid-cols-6 gap-2"
              onPaste={(e) => {
                const pasted = e.clipboardData
                  .getData('text/plain')
                  .replace(/\D/g, '')
                  .slice(0, 6);
                if (!pasted) return;
                e.preventDefault();
                const next = Array.from({ length: 6 }, (_, i) => pasted[i] || '');
                setPinDigits(next);
                setPinError('');
                if (pasted.length === 6) {
                  void tryUnlock(pasted);
                } else {
                  pinRefs.current[Math.min(pasted.length, 5)]?.focus();
                }
              }}
            >
              {pinDigits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => {
                    pinRefs.current[idx] = el;
                  }}
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={1}
                  aria-label={`Passcode digit ${idx + 1}`}
                  value={digit}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '');
                    setPinError('');
                    if (!raw) {
                      setPinDigits((prev) => prev.map((d, i) => (i === idx ? '' : d)));
                      return;
                    }
                    const ch = raw.slice(-1);
                    const next = pinDigits.map((d, i) => (i === idx ? ch : d));
                    setPinDigits(next);
                    if (idx < 5) {
                      pinRefs.current[idx + 1]?.focus();
                    } else {
                      const joined = next.join('');
                      if (joined.length === 6) void tryUnlock(joined);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !pinDigits[idx] && idx > 0) {
                      pinRefs.current[idx - 1]?.focus();
                    } else if (e.key === 'ArrowLeft' && idx > 0) {
                      pinRefs.current[idx - 1]?.focus();
                    } else if (e.key === 'ArrowRight' && idx < 5) {
                      pinRefs.current[idx + 1]?.focus();
                    }
                  }}
                  className={`h-12 w-full rounded-xl border-[1.5px] text-center font-mono text-lg font-extrabold text-[#2F3E4E] dark:text-slate-100 bg-white dark:bg-[#0B1120] focus:outline-none focus:ring-2 focus:ring-[#F9C80E] ${
                    pinError ? 'border-rose-600 bg-rose-50/40' : 'border-[#2F3E4E] dark:border-slate-600'
                  }`}
                />
              ))}
            </div>
          </div>

          {pinError && (
            <div className="rounded-xl border border-rose-700/35 bg-rose-50 px-3.5 py-2.5 flex items-center gap-2 text-xs font-semibold text-rose-900">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-700" aria-hidden="true" />
              <span>{pinError}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="submit"
              disabled={enteredPin.length < 6 || isVerifying}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-[#F9C80E] hover:bg-[#eab308] text-xs sm:text-sm font-display font-extrabold text-[#2F3E4E] shadow-[0_3px_0_#2F3E4E] transition cursor-pointer disabled:opacity-50"
            >
              <Unlock className="w-4 h-4" aria-hidden="true" />
              <span>
                {isVerifying
                  ? 'Verifying...'
                  : setupRequired
                    ? 'Activate & Unlock Tool'
                    : 'Unlock Tool'}
              </span>
            </button>

            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] hover:bg-[#FEF2C8] dark:hover:bg-slate-800 text-xs font-bold text-[#2F3E4E] dark:text-slate-100 transition cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Back</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
