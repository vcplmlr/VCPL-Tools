import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, Eye, EyeOff, KeyRound, Lock, Unlock } from 'lucide-react';

interface ToolPasscodeGateProps {
  toolCode: string;
  toolTitle: string;
  sessionKey: string;
  passcode?: string;
  verifyWithServerAdminAuth?: boolean;
  description?: string;
  onBack?: () => void;
  children: (controls: { lockTool: () => void }) => React.ReactNode;
}

export const ToolPasscodeGate: React.FC<ToolPasscodeGateProps> = ({
  toolCode,
  toolTitle,
  sessionKey,
  passcode = '202627',
  verifyWithServerAdminAuth = false,
  description = 'This tool is locked for authorized dealership access only. Enter the 6-digit passcode to unlock.',
  onBack,
  children,
}) => {
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
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

  const tryUnlock = useCallback(
    async (candidate: string) => {
      if (isVerifying) return;
      if (!verifyWithServerAdminAuth) {
        if (candidate === passcode) {
          setIsUnlocked(true);
          setPinError('');
          setPinDigits(['', '', '', '', '', '']);
        } else {
          setPinError('Incorrect passcode. Please check and try again.');
        }
        return;
      }

      setIsVerifying(true);
      setPinError('');
      try {
        const res = await fetch('/api/admin/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ passcode: candidate }),
        });

        if (res.ok) {
          setIsUnlocked(true);
          setPinError('');
          setPinDigits(['', '', '', '', '', '']);
          return;
        }

        if (res.status === 401 || res.status === 403 || res.status === 429) {
          setPinError(
            res.status === 429
              ? 'Too many attempts. Please wait a moment and try again.'
              : 'Incorrect admin passcode. Access denied.'
          );
          return;
        }

        // Static / API-less fallback check
        if (candidate === passcode) {
          setIsUnlocked(true);
          setPinError('');
          setPinDigits(['', '', '', '', '', '']);
        } else {
          setPinError('Incorrect admin passcode. Access denied.');
        }
      } catch {
        // Offline / static build fallback
        if (candidate === passcode) {
          setIsUnlocked(true);
          setPinError('');
          setPinDigits(['', '', '', '', '', '']);
        } else {
          setPinError('Incorrect admin passcode. Access denied.');
        }
      } finally {
        setIsVerifying(false);
      }
    },
    [isVerifying, passcode, verifyWithServerAdminAuth]
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
    if (!isUnlocked) {
      const id = window.setTimeout(() => pinRefs.current[0]?.focus(), 60);
      return () => window.clearTimeout(id);
    }
  }, [isUnlocked]);

  if (!isUnlocked) {
    const enteredPin = pinDigits.join('');
    return (
      <div className="py-6 sm:py-10">
        <div className="max-w-md mx-auto bg-[#FFFDF5] border-[1.5px] border-[#2F3E4E] rounded-2xl p-6 sm:p-7 shadow-[0_6px_0_#2F3E4E] space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="w-11 h-11 rounded-xl bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] flex items-center justify-center text-[#2F3E4E] shrink-0 shadow-[0_2px_0_#2F3E4E]">
                <Lock className="w-5 h-5" aria-hidden="true" />
              </span>
              <div>
                <span className="inline-block px-2 py-0.5 rounded bg-[#CEE5DC] border border-[#2F3E4E] text-[10px] font-mono font-bold text-[#2F3E4E]">
                  {toolCode} · Restricted Access
                </span>
                <h2 className="font-display font-extrabold text-lg sm:text-xl text-[#2F3E4E] mt-1">
                  {toolTitle}
                </h2>
              </div>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-[#475569] leading-relaxed">{description}</p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void tryUnlock(enteredPin);
            }}
            className="space-y-4"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-bold text-[#2F3E4E] uppercase tracking-wider inline-flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-[#B45309]" aria-hidden="true" />
                  <span>6-Digit Passcode</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowPin((s) => !s)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#475569] hover:text-[#2F3E4E] cursor-pointer"
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
                    className={`h-12 w-full rounded-xl border-[1.5px] text-center font-mono text-lg font-extrabold text-[#2F3E4E] bg-white focus:outline-none focus:ring-2 focus:ring-[#F9C80E] ${
                      pinError ? 'border-rose-600 bg-rose-50/40' : 'border-[#2F3E4E]'
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
                <span>{isVerifying ? 'Verifying...' : 'Unlock Tool'}</span>
              </button>

              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] bg-white hover:bg-[#FEF2C8] text-xs font-bold text-[#2F3E4E] transition cursor-pointer"
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
  }

  return <>{children({ lockTool })}</>;
};
