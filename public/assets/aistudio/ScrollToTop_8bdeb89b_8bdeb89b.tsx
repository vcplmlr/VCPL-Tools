/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

export default function ScrollToTop() {
  const [scrollPercent, setScrollPercent] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      
      if (scrollHeight > 0) {
        const percent = Math.min(100, Math.max(0, Math.round((scrollTop / scrollHeight) * 100)));
        setScrollPercent(percent);
      }

      if (scrollTop > 120) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!isVisible) return null;

  // SVG circular progress parameters
  const size = 56;
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (scrollPercent / 100) * circumference;

  return (
    <div className="fixed bottom-6 right-6 z-40 transition-all duration-300 transform scale-100 animate-in fade-in zoom-in-95">
      <button
        type="button"
        onClick={scrollToTop}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        aria-label={`Scroll to top, currently at ${scrollPercent}%`}
        className="relative w-14 h-14 rounded-full bg-[#FAF8F2] border-[2.5px] border-[#0F172A] shadow-neo-btn hover:shadow-neo-lg transition-transform hover:-translate-y-1 active:translate-y-0.5 flex items-center justify-center cursor-pointer select-none group"
      >
        {/* SVG Circular Progress Ring */}
        <svg
          className="absolute inset-0 -rotate-90 pointer-events-none"
          width={size}
          height={size}
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="rgba(15, 23, 42, 0.12)"
            strokeWidth={strokeWidth}
          />
          {/* Progress circle in theme yellow */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="#FFB800"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-150 ease-out"
          />
        </svg>

        {/* Center Content: Percentage or Arrow */}
        <div className="relative z-10 flex flex-col items-center justify-center text-[#0F172A]">
          {isHovered ? (
            <ArrowUp className="w-5 h-5 stroke-[3] group-hover:animate-bounce" />
          ) : (
            <div className="flex flex-col items-center leading-none">
              <span className="text-[11px] font-black font-mono">
                {scrollPercent}%
              </span>
              <ArrowUp className="w-2.5 h-2.5 stroke-[3] mt-0.5" />
            </div>
          )}
        </div>
      </button>
    </div>
  );
}
