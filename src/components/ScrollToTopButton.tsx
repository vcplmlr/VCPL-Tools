import React, { useEffect, useState } from 'react';
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

  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (scrollProgress / 100) * circumference;

  return (
    <div
      className="fixed z-40 flex flex-col items-center no-print"
      style={{
        bottom: 'max(1.25rem, env(safe-area-inset-bottom))',
        right: 'max(1.25rem, env(safe-area-inset-right))',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isHovered && (
        <div className="mb-2 px-2.5 py-1 rounded-lg bg-[#2F3E4E] text-[#FFFDF5] text-[10px] font-bold whitespace-nowrap border border-[#2F3E4E]">
          Back to Top &bull; {scrollProgress}%
        </div>
      )}

      <button
        type="button"
        onClick={scrollToTop}
        className="relative w-13 h-13 rounded-full bg-[#FFFDF5] hover:bg-[#FEF2C8] text-[#2F3E4E] border-[1.5px] border-[#2F3E4E] shadow-[0_3px_0_#2F3E4E] flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F3E4E]"
        title={`Scroll to top (${scrollProgress}%)`}
        aria-label={`Scroll to top, page read ${scrollProgress}%`}
      >
        <svg
          className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none p-1"
          viewBox="0 0 52 52"
        >
          <circle
            cx="26"
            cy="26"
            r={radius}
            className="stroke-[#2F3E4E]/15"
            strokeWidth="3"
            fill="none"
          />
          <circle
            cx="26"
            cy="26"
            r={radius}
            className="stroke-[#2F3E4E] transition-all duration-150 ease-out"
            strokeWidth="3.5"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="none"
          />
        </svg>

        <div className="relative z-10 flex flex-col items-center justify-center -space-y-0.5 pointer-events-none select-none">
          <ArrowUp
            className={`w-3.5 h-3.5 text-[#2F3E4E] transition-transform duration-200 ${
              isHovered ? '-translate-y-0.5' : ''
            }`}
          />
          <span className="text-[10px] font-extrabold text-[#2F3E4E] font-mono tabular-nums tracking-tighter">
            {scrollProgress}%
          </span>
        </div>
      </button>
    </div>
  );
};
