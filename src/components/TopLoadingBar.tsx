import { useEffect, useRef, useState } from 'react';

export const GLOBAL_PROGRESS_EVENT = 'vcpl:loading-progress';

export interface GlobalProgressDetail {
  active: boolean;
  progress?: number; // 0..100
}

export function emitGlobalProgress(active: boolean, progress?: number): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<GlobalProgressDetail>(GLOBAL_PROGRESS_EVENT, {
      detail: { active, progress },
    })
  );
}

interface TopLoadingBarProps {
  /** Increment whenever navigation, tool switch, or filter change occurs. */
  triggerKey: number;
}

export function TopLoadingBar({ triggerKey }: TopLoadingBarProps) {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const [externalActive, setExternalActive] = useState(false);
  const timersRef = useRef<number[]>([]);

  const clearTimers = () => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  };

  useEffect(() => {
    const handleExternalProgress = (event: Event) => {
      const custom = event as CustomEvent<GlobalProgressDetail>;
      const detail = custom.detail;
      if (!detail) return;

      clearTimers();

      if (detail.active) {
        setExternalActive(true);
        setVisible(true);
        const pct =
          typeof detail.progress === 'number' && Number.isFinite(detail.progress)
            ? Math.min(100, Math.max(4, detail.progress))
            : 25;
        setProgress(pct);
      } else {
        setProgress(100);
        setExternalActive(false);
        timersRef.current.push(
          window.setTimeout(() => {
            setVisible(false);
            setProgress(0);
          }, 260)
        );
      }
    };

    window.addEventListener(GLOBAL_PROGRESS_EVENT, handleExternalProgress);
    return () => {
      window.removeEventListener(GLOBAL_PROGRESS_EVENT, handleExternalProgress);
      clearTimers();
    };
  }, []);

  useEffect(() => {
    if (externalActive) return;

    clearTimers();

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      setVisible(true);
      setProgress(100);
      timersRef.current.push(
        window.setTimeout(() => {
          setVisible(false);
          setProgress(0);
        }, 180)
      );
      return clearTimers;
    }

    setVisible(true);
    setProgress(14);

    const t1 = window.setTimeout(() => setProgress(52), 50);
    const t2 = window.setTimeout(() => setProgress(86), 160);
    const t3 = window.setTimeout(() => setProgress(100), 290);
    const t4 = window.setTimeout(() => setVisible(false), 480);
    const t5 = window.setTimeout(() => setProgress(0), 680);

    timersRef.current = [t1, t2, t3, t4, t5];

    return clearTimers;
  }, [triggerKey, externalActive]);

  return (
    <div
      role="progressbar"
      aria-hidden={!visible}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress)}
      className={`fixed top-0 left-0 right-0 h-[3px] z-[80] pointer-events-none no-print transition-opacity duration-200 bg-[#2F3E4E]/15 dark:bg-slate-800 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div
        className="h-full bg-[#1E3A5F] dark:bg-[#F9C80E] transition-[width] duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
