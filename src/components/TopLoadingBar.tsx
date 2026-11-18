import { useEffect, useRef, useState } from 'react';

interface TopLoadingBarProps {
  /** Increment whenever navigation, tool switch, or filter change occurs. */
  triggerKey: number;
}

export function TopLoadingBar({ triggerKey }: TopLoadingBarProps) {
  const [scaleX, setScaleX] = useState(0);
  const [visible, setVisible] = useState(false);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    const clearTimers = () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current = [];
    };

    clearTimers();

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      setVisible(true);
      setScaleX(1);
      timersRef.current.push(
        window.setTimeout(() => {
          setVisible(false);
          setScaleX(0);
        }, 220)
      );
      return clearTimers;
    }

    setVisible(true);
    setScaleX(0.08);

    const t1 = window.setTimeout(() => setScaleX(0.45), 40);
    const t2 = window.setTimeout(() => setScaleX(0.82), 160);
    const t3 = window.setTimeout(() => setScaleX(1), 320);
    const t4 = window.setTimeout(() => setVisible(false), 540);
    const t5 = window.setTimeout(() => setScaleX(0), 760);

    timersRef.current = [t1, t2, t3, t4, t5];

    return clearTimers;
  }, [triggerKey]);

  return (
    <div
      aria-hidden="true"
      className={`fixed top-0 left-0 right-0 h-[6px] z-[80] pointer-events-none no-print transition-opacity duration-200 bg-[#2F3E4E]/10 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div
        className="h-full w-full origin-left bg-gradient-to-r from-[#2F3E4E] via-[#F9C80E] to-[#12805C] transition-transform duration-200 ease-out relative shadow-[0_2px_10px_rgba(249,200,14,0.6)]"
        style={{ transform: `scaleX(${scaleX})` }}
      >
        <span className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-r from-transparent to-[#FFFDF5]" />
      </div>
    </div>
  );
}
