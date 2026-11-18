/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

export const ScrollToTopButton: React.FC = () => {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight =
        document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const pct =
        docHeight > 0
          ? Math.min(100, Math.max(0, Math.round((scrollTop / docHeight) * 100)))
          : 0;

      setScrollProgress(pct);
      setIsVisible(scrollTop > 80);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  if (!isVisible) return null;

  // SVG circular progress calculation
  // Radius = 22, Circumference = 2 * PI * 22 ≈ 138.23
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (scrollProgress / 100) * circumference;

  return (
    <div
      className="fixed bottom-6 right-6 z-40 flex flex-col items-center animate-in fade-in zoom-in-90 duration-200"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Tooltip on hover */}
      {isHovered && (
        <div className="mb-2 px-2.5 py-1 rounded-lg bg-slate-900 text-white text-[10px] font-bold shadow-lg whitespace-nowrap animate-in fade-in slide-in-from-bottom-1 duration-150">
          Back to Top &bull; {scrollProgress}%
        </div>
      )}

      {/* Button with circular SVG progress ring and centered percentage */}
      <button
        type="button"
        onClick={scrollToTop}
        className="relative w-13 h-13 rounded-full bg-white hover:bg-slate-50 text-slate-800 shadow-xl border border-slate-200 flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer group focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        title={`Scroll to top (${scrollProgress}%)`}
        aria-label={`Scroll to top, page read ${scrollProgress}%`}
      >
        {/* Background track circle */}
        <svg
          className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none p-1"
          viewBox="0 0 52 52"
        >
          <circle
            cx="26"
            cy="26"
            r={radius}
            className="stroke-slate-100"
            strokeWidth="3"
            fill="none"
          />
          {/* Animated active progress stroke */}
          <circle
            cx="26"
            cy="26"
            r={radius}
            className="stroke-blue-600 transition-all duration-150 ease-out"
            strokeWidth="3.5"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="none"
          />
        </svg>

        {/* Middle of the button: Up arrow + Live Page View Percentage */}
        <div className="relative z-10 flex flex-col items-center justify-center -space-y-0.5 pointer-events-none select-none">
          <ArrowUp
            className={`w-3.5 h-3.5 text-blue-600 transition-transform duration-200 ${
              isHovered ? '-translate-y-0.5 text-blue-700' : ''
            }`}
          />
          <span className="text-[10px] font-black text-slate-800 font-mono tracking-tighter">
            {scrollProgress}%
          </span>
        </div>
      </button>
    </div>
  );
};
