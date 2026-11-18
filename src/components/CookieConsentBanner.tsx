import { useState } from 'react';
import { Check, ShieldCheck, SlidersHorizontal, Trash2, X } from 'lucide-react';
import {
  AdConsentMode,
  CONSENT_UPDATED_EVENT,
  COOKIE_CONSENT_STORAGE_KEY,
  syncAdSenseConsent,
} from '../config/adsense';

export { COOKIE_CONSENT_STORAGE_KEY };

interface CookieConsentBannerProps {
  isOpen: boolean;
  onClose: () => void;
  onClearAllLocalData: () => void;
}

export function CookieConsentBanner({
  isOpen,
  onClose,
  onClearAllLocalData,
}: CookieConsentBannerProps) {
  const [clearedFeedback, setClearedFeedback] = useState(false);

  if (!isOpen) return null;

  const savePreference = (mode: AdConsentMode) => {
    try {
      window.localStorage.setItem(
        COOKIE_CONSENT_STORAGE_KEY,
        JSON.stringify({
          mode,
          updatedAt: new Date().toISOString(),
        })
      );
    } catch {
      // Ignore storage errors in restricted browsing contexts
    }
    syncAdSenseConsent(mode);
    window.dispatchEvent(new CustomEvent(CONSENT_UPDATED_EVENT, { detail: { mode } }));
    setClearedFeedback(false);
    onClose();
  };

  const handleClearData = () => {
    onClearAllLocalData();
    syncAdSenseConsent('essential');
    window.dispatchEvent(new CustomEvent(CONSENT_UPDATED_EVENT, { detail: { mode: 'essential' } }));
    setClearedFeedback(true);
    window.setTimeout(() => {
      setClearedFeedback(false);
    }, 3000);
  };

  return (
    <aside
      role="dialog"
      aria-label="Cookie, Advertising & Privacy Preferences"
      className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-[max(0.75rem,env(safe-area-inset-left))] right-[max(0.75rem,env(safe-area-inset-right))] sm:bottom-[max(1rem,env(safe-area-inset-bottom))] sm:left-[max(1rem,env(safe-area-inset-left))] sm:right-[max(1rem,env(safe-area-inset-right))] z-[60] no-print"
    >
      <div className="max-w-[1360px] mx-auto max-h-[78dvh] overflow-y-auto bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl shadow-[0_6px_0_#2F3E4E] dark:shadow-[0_6px_0_#020617] px-4 py-3.5 sm:px-5 sm:py-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left Icon + Privacy & AdSense Consent Copy */}
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-[#F9C80E] border-[1.5px] border-[#2F3E4E] shadow-[0_2px_0_#2F3E4E] text-[#2F3E4E] flex items-center justify-center shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5" aria-hidden="true" />
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <h2 className="font-display font-extrabold text-sm sm:text-[15px] text-[#2F3E4E] dark:text-slate-100">
                  Privacy, Storage &amp; Ad Preferences
                </h2>
                <span aria-hidden="true" className="text-[#64748B] dark:text-slate-500">
                  ·
                </span>
                <span className="text-xs font-bold text-[#12805C] dark:text-emerald-400">
                  Zero File Uploads
                </span>
                {clearedFeedback && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-[#12805C] dark:text-emerald-300 bg-[#CEE5DC] dark:bg-emerald-950/70 border border-[#2F3E4E]/30 dark:border-emerald-700/60 px-2 py-0.5 rounded-md">
                    <Check className="w-3 h-3" aria-hidden="true" />
                    Local data cleared
                  </span>
                )}
              </div>

              <p className="text-xs leading-relaxed text-[#475569] dark:text-slate-300 max-w-4xl">
                Every PDF, tax reconciliation, bank slip, and image is processed 100% locally in
                your browser—your files never leave your device. To keep all tools free, our
                advertising partners (including Google AdSense) may use cookies to serve relevant ads.
                Choose <strong className="text-[#2F3E4E] dark:text-slate-100">Essential Only</strong>{' '}
                for non-personalized ads &amp; local preferences only (DPDP Act, 2023), or{' '}
                <strong className="text-[#2F3E4E] dark:text-slate-100">Accept All</strong>.
              </p>
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex flex-wrap items-center justify-end gap-2 shrink-0 w-full lg:w-auto">
            <button
              type="button"
              onClick={handleClearData}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg bg-[#FEF2C8] dark:bg-[#0B1120] hover:bg-[#FFE1B3] dark:hover:bg-slate-800 border-[1.5px] border-[#2F3E4E] dark:border-slate-600 text-xs font-bold text-[#2F3E4E] dark:text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F3E4E] dark:focus-visible:ring-[#F9C80E]"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Clear Data</span>
            </button>

            <button
              type="button"
              onClick={() => savePreference('essential')}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg bg-[#FFFDF5] dark:bg-slate-800 hover:bg-[#CEE5DC] dark:hover:bg-slate-700 border-[1.5px] border-[#2F3E4E] dark:border-slate-600 text-xs font-bold text-[#2F3E4E] dark:text-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F3E4E] dark:focus-visible:ring-[#F9C80E]"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Essential Only</span>
            </button>

            <button
              type="button"
              onClick={() => savePreference('accepted')}
              className="inline-flex items-center justify-center px-3.5 py-2 min-h-[40px] rounded-lg bg-[#2F3E4E] dark:bg-[#F9C80E] hover:bg-[#1E293B] dark:hover:bg-[#FDE047] border-[1.5px] border-[#2F3E4E] dark:border-[#F9C80E] shadow-[0_2px_0_#1E293B] text-xs font-bold text-[#F9C80E] dark:text-[#0F172A] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F3E4E] dark:focus-visible:ring-[#F9C80E]"
            >
              Accept All Ads &amp; Prefs
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close privacy and cookie notice"
              className="inline-flex items-center justify-center w-10 h-10 rounded-lg text-[#475569] dark:text-slate-400 hover:text-[#2F3E4E] dark:hover:text-white hover:bg-[#FEF2C8] dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
