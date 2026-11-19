import { useState } from 'react';

interface TulunaduFlagIconProps {
  /** Show a miniature flagpole mast with a stepped stand beside the flying flag */
  showMast?: boolean;
  /** Enable wind-flutter animation on the flag cloth (defaults to true when showMast is true) */
  flying?: boolean;
  /** Size preset for inline text vs. compact badge placement */
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Crisp miniature Tulunadu flag emblem (crimson field with white sun & crescent moon).
 * Uses the provided local Tulunadu flag asset with an exact vector SVG fallback.
 */
export function TulunaduFlagIcon({
  showMast = false,
  flying,
  size = 'sm',
  className = '',
}: TulunaduFlagIconProps) {
  const [imgFailed, setImgFailed] = useState(false);

  const isFlying = flying ?? showMast;
  const flagDimensions = size === 'md' ? 'w-[24px] h-[15px]' : 'w-[19px] h-[13px]';
  const poleHeight = size === 'md' ? 'h-[19px]' : 'h-[16px]';

  return (
    <span
      className={`inline-flex items-start shrink-0 select-none ${className}`}
      title="Tulunadu Flag — Mangalore (Kudla), Coastal Karnataka"
    >
      {showMast && (
        <span
          aria-hidden="true"
          className="relative z-10 inline-flex flex-col items-center shrink-0"
        >
          {/* Gold Finial */}
          <span className="w-[4px] h-[4px] rounded-full bg-gradient-to-br from-[#FDE047] via-[#F59E0B] to-[#B45309] border border-[#2F3E4E]/60 dark:border-amber-200/70 shadow-xs" />
          {/* Metallic Flagpole Mast */}
          <span
            className={`w-[2px] ${poleHeight} -mt-[0.5px] bg-gradient-to-r from-[#334155] via-[#64748B] to-[#1E293B] dark:from-slate-300 dark:via-slate-100 dark:to-slate-400`}
          />
          {/* Miniature Two-Tier Stepped Flag Stand */}
          <span className="w-[7px] h-[2px] -mt-[0.5px] rounded-t-[1.5px] bg-[#475569] dark:bg-slate-300 border-x border-t border-[#1E293B]/60 dark:border-slate-500" />
          <span className="w-[11px] h-[2.5px] rounded-t-[1.5px] rounded-b-[1px] bg-[#1E293B] dark:bg-slate-400 shadow-[0_1px_1.5px_rgba(0,0,0,0.3)]" />
        </span>
      )}

      <span
        className={`relative inline-flex items-center justify-center overflow-hidden ${
          showMast ? '-ml-[4px] mt-[4px] rounded-r-[3px] rounded-l-[1px]' : 'rounded-[2.5px]'
        } ${flagDimensions} bg-[#7B0000] border border-[#2F3E4E]/45 dark:border-white/30 shadow-[0_1.5px_3px_rgba(0,0,0,0.24)] shrink-0 ${
          isFlying ? 'tulu-flag-fly' : ''
        }`}
      >
        {imgFailed ? (
          <svg
            viewBox="0 0 30 20"
            className="w-full h-full block"
            role="img"
            aria-label="Tulunadu flag"
          >
            <rect width="30" height="20" fill="#7B0000" />
            <circle cx="9.2" cy="10" r="4.3" fill="#FFFFFF" />
            <path
              d="M16.8 6.4 A4.5 4.5 0 1 0 25.2 6.4 A3.7 3.7 0 1 1 16.8 6.4 Z"
              fill="#FFFFFF"
            />
          </svg>
        ) : (
          <img
            src="/assets/aistudio/image_04dc47b9.png"
            alt="Tulunadu flag"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover block"
          />
        )}
        {/* Travelling wind ripple & silk highlight */}
        {isFlying ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/25 to-black/20 tulu-flag-fold"
          />
        ) : (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-black/15"
          />
        )}
      </span>
    </span>
  );
}
