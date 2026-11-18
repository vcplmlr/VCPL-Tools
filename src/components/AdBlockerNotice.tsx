import { useEffect } from 'react';
import { CheckCircle2, Lock, RefreshCw, RotateCw, ShieldAlert } from 'lucide-react';

interface AdBlockerNoticeProps {
  isRechecking: boolean;
  stillBlockedAfterRetry: boolean;
  onRecheck: () => void;
}

export function AdBlockerNotice({
  isRechecking,
  stillBlockedAfterRetry,
  onRecheck,
}: AdBlockerNoticeProps) {
  // Lock background page scroll while tools are locked behind this modal
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="vcpl-adblock-modal-title"
      aria-describedby="vcpl-adblock-modal-desc"
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-[#1E293B]/75 backdrop-blur-md no-print"
    >
      <div className="w-full max-w-[520px] bg-[#FFFDF5] text-[#2F3E4E] border-2 border-[#2F3E4E] rounded-2xl shadow-[0_10px_0_#2F3E4E,0_24px_54px_rgba(15,23,42,0.45)] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Top Marigold Accent Header */}
        <div className="bg-[#2F3E4E] text-[#FFFDF5] px-5 py-3.5 border-b-2 border-[#1E293B] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-9 h-9 rounded-xl bg-[#F9C80E] border-[1.5px] border-[#1E293B] text-[#2F3E4E] flex items-center justify-center shrink-0 shadow-[0_2px_0_#1E293B]">
              <ShieldAlert className="w-5 h-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <span className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#F9C80E]">
                VCPL Tools Access Protection
              </span>
              <h2
                id="vcpl-adblock-modal-title"
                className="font-display font-extrabold text-base sm:text-lg leading-tight text-[#FFFDF5]"
              >
                Ad Blocker Detected
              </h2>
            </div>
          </div>

          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1E293B] border border-[#F9C80E]/50 text-[10px] font-mono font-bold text-[#F9C80E] shrink-0 whitespace-nowrap">
            <Lock className="w-3 h-3" aria-hidden="true" />
            <span>Tools Locked</span>
          </span>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-4">
          <p
            id="vcpl-adblock-modal-desc"
            className="text-sm leading-relaxed text-[#2F3E4E]"
          >
            Our tools are disabled while an ad blocker is active.{' '}
            <strong className="font-bold">VCPL Tools</strong> provides 100% free, zero-server
            banking, GST, tax, PDF, and calculator utilities supported strictly by non-intrusive
            ads. Please disable or pause your ad blocker for this site to unlock and use all tools.
          </p>

          {/* 3-Step Quick Instructions */}
          <div className="rounded-xl bg-[#FEF2C8] border-[1.5px] border-[#2F3E4E] p-3.5 sm:p-4 space-y-2">
            <div className="text-[11px] font-display font-extrabold uppercase tracking-wider text-[#2F3E4E]">
              How to Unlock Immediately
            </div>
            <ol className="space-y-1.5 text-xs text-[#2F3E4E] leading-snug list-decimal list-inside">
              <li>
                Click your ad blocker extension icon (uBlock Origin, AdBlock, AdGuard, or Brave
                Shields) in your browser toolbar.
              </li>
              <li>
                Select <strong>Pause on this site</strong> or turn shields <strong>Off</strong> for
                this domain.
              </li>
              <li>
                Access unlocks <strong>automatically</strong> within 1 second—or click{' '}
                <strong>Check &amp; Unlock Tools</strong> below.
              </li>
            </ol>
          </div>

          {/* Live Auto-Check Status Feedback */}
          {stillBlockedAfterRetry && !isRechecking ? (
            <div
              role="alert"
              className="rounded-xl bg-[#FEE2E2] border border-[#B42318]/40 px-3.5 py-2.5 text-xs font-semibold text-[#991B1B]"
            >
              Ad blocker is still active. Please turn off or whitelist this site in your browser
              extension or Shields, then wait 1 second or reload.
            </div>
          ) : (
            <div className="rounded-xl bg-[#CEE5DC]/75 border border-[#2F3E4E]/35 px-3.5 py-2.5 flex items-center gap-2 text-xs font-semibold text-[#2F3E4E]">
              <CheckCircle2 className="w-4 h-4 text-[#12805C] shrink-0" aria-hidden="true" />
              <span>
                Live detection is watching—as soon as your ad blocker is turned off, all tools
                unlock automatically.
              </span>
            </div>
          )}

          {/* Action Buttons (No Dismiss Button) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
            <button
              type="button"
              disabled={isRechecking}
              onClick={onRecheck}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-[#F9C80E] hover:bg-[#FFE1B3] disabled:opacity-75 text-[#2F3E4E] border-[1.5px] border-[#2F3E4E] shadow-[0_3px_0_#2F3E4E] font-display font-extrabold text-xs sm:text-sm transition cursor-pointer whitespace-nowrap"
            >
              <RefreshCw
                className={`w-4 h-4 ${isRechecking ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>{isRechecking ? 'Checking Ad Blocker...' : 'Check & Unlock Tools'}</span>
            </button>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-xl bg-white hover:bg-[#FEF2C8] text-[#2F3E4E] border-[1.5px] border-[#2F3E4E] shadow-[0_2px_0_#2F3E4E] font-display font-bold text-xs transition cursor-pointer whitespace-nowrap"
            >
              <RotateCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Reload Page</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
