import { useEffect, useRef, useState } from 'react';

export const GLOBAL_PROGRESS_EVENT = 'vcpl:loading-progress';

export interface GlobalProgressDetail {
  active: boolean;
  progress?: number; // 0..100
  source?: string;
}

export function emitGlobalProgress(
  active: boolean,
  progress?: number,
  source = 'default'
): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<GlobalProgressDetail>(GLOBAL_PROGRESS_EVENT, {
      detail: { active, progress, source },
    })
  );
}

interface TopLoadingBarProps {
  /** Increment whenever navigation, tool switch, or filter change occurs. */
  triggerKey: number;
}

type RunPhase = 'idle' | 'running' | 'finishing' | 'fading';

export function TopLoadingBar({ triggerKey }: TopLoadingBarProps) {
  const [visible, setVisible] = useState(false);
  const [ariaProgress, setAriaProgress] = useState(0);

  const barRef = useRef<HTMLDivElement | null>(null);
  const auraRef = useRef<HTMLSpanElement | null>(null);
  const pegCarrierRef = useRef<HTMLDivElement | null>(null);

  const rafRef = useRef<number | null>(null);
  const fadeTimerRef = useRef<number | null>(null);
  const activeSourcesRef = useRef<Map<string, number>>(new Map());

  const phaseRef = useRef<RunPhase>('idle');
  const progressRef = useRef(0);
  const runStartTimeRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const minNavFinishAtRef = useRef(0);
  const lastAriaEmitRef = useRef(0);

  const applyTransform = (pct: number) => {
    const clamped = Math.max(0, Math.min(100, pct));
    progressRef.current = clamped;
    const ratio = clamped / 100;
    const offsetPct = clamped - 100;

    if (barRef.current) {
      barRef.current.style.transform = `scale3d(${ratio}, 1, 1)`;
    }
    if (auraRef.current) {
      auraRef.current.style.transform = `scale3d(${ratio}, 1, 1)`;
    }
    if (pegCarrierRef.current) {
      pegCarrierRef.current.style.transform = `translate3d(${offsetPct}%, 0, 0)`;
    }

    const rounded = Math.round(clamped);
    if (Math.abs(rounded - lastAriaEmitRef.current) >= 10 || rounded === 100 || rounded === 0) {
      lastAriaEmitRef.current = rounded;
      setAriaProgress(rounded);
    }
  };

  const stopLoop = () => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const clearFadeTimer = () => {
    if (fadeTimerRef.current !== null) {
      window.clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  };

  const getHighestActiveFloor = () => {
    let highest = 0;
    activeSourcesRef.current.forEach((v) => {
      if (v > highest) highest = v;
    });
    return highest;
  };

  const startLoop = () => {
    if (rafRef.current !== null) return;
    lastFrameTimeRef.current = performance.now();

    const step = (now: number) => {
      const dtMs = Math.min(48, Math.max(4, now - lastFrameTimeRef.current));
      const dt = dtMs / 1000;
      lastFrameTimeRef.current = now;

      const phase = phaseRef.current;
      const cur = progressRef.current;

      if (phase === 'idle' || phase === 'fading') {
        rafRef.current = null;
        return;
      }

      if (phase === 'running') {
        // Compute smooth YouTube-like target curve:
        // Fast initial sweep (~0->58% in ~240ms), then silky logarithmic deceleration up to 92%
        const elapsed = Math.max(0, now - runStartTimeRef.current);
        const asymptoticCap =
          activeSourcesRef.current.size > 0
            ? Math.max(getHighestActiveFloor(), 93 * (1 - Math.exp(-elapsed / 650)))
            : 92 * (1 - Math.exp(-elapsed / 260));

        // Smoothly chase asymptoticCap so progress never jumps abruptly
        const chaseRate = cur < asymptoticCap ? (cur < 45 ? 11.5 : 6.2) : 0;
        let next = cur + (asymptoticCap - cur) * Math.min(1, dt * chaseRate);

        // Gentle baseline trickle while waiting on async tasks so bar feels alive
        if (next < 93.5 && next - cur < 0.015) {
          next = Math.min(93.5, cur + dt * (cur < 75 ? 4.5 : 1.4));
        }

        applyTransform(next);

        // If navigation-only (no external async tasks), transition seamlessly into finishing once minimum smooth glide time has passed
        if (activeSourcesRef.current.size === 0 && now >= minNavFinishAtRef.current) {
          phaseRef.current = 'finishing';
        }

        rafRef.current = window.requestAnimationFrame(step);
        return;
      }

      if (phase === 'finishing') {
        // Exponential glide to 100% — snappy yet ultra smooth
        const remaining = 100 - cur;
        if (remaining <= 0.35) {
          applyTransform(100);
          phaseRef.current = 'fading';
          rafRef.current = null;

          // Hold full glowing bar briefly just like YouTube before dissolving opacity
          clearFadeTimer();
          fadeTimerRef.current = window.setTimeout(() => {
            if (activeSourcesRef.current.size > 0) return;
            setVisible(false);
            fadeTimerRef.current = window.setTimeout(() => {
              if (activeSourcesRef.current.size > 0 || phaseRef.current !== 'fading') return;
              phaseRef.current = 'idle';
              applyTransform(0);
            }, 300);
          }, 95);
          return;
        }

        // Fast smooth finish (~160ms)
        const next = cur + remaining * Math.min(1, dt * 16);
        applyTransform(next);
        rafRef.current = window.requestAnimationFrame(step);
      }
    };

    rafRef.current = window.requestAnimationFrame(step);
  };

  const launchSmoothRun = (isNavigationRun: boolean, initialFloor = 0) => {
    clearFadeTimer();
    stopLoop();

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      phaseRef.current = 'fading';
      applyTransform(100);
      setVisible(true);
      fadeTimerRef.current = window.setTimeout(() => {
        if (activeSourcesRef.current.size > 0) return;
        setVisible(false);
        fadeTimerRef.current = window.setTimeout(() => {
          if (activeSourcesRef.current.size === 0) {
            phaseRef.current = 'idle';
            applyTransform(0);
          }
        }, 220);
      }, 180);
      return;
    }

    const now = performance.now();
    // Reset invisibly to 0% before painting so every run sweeps smoothly from left edge
    if (phaseRef.current === 'idle' || phaseRef.current === 'fading' || progressRef.current >= 95) {
      applyTransform(Math.max(2, initialFloor));
    } else if (initialFloor > progressRef.current) {
      // Keep advancing forward if already running
      applyTransform(progressRef.current);
    }

    runStartTimeRef.current = now;
    minNavFinishAtRef.current = isNavigationRun ? now + 380 : now;
    phaseRef.current = 'running';
    setVisible(true);
    startLoop();
  };

  const finishSmoothRun = () => {
    if (phaseRef.current === 'idle') return;
    if (activeSourcesRef.current.size > 0) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      clearFadeTimer();
      applyTransform(100);
      setVisible(true);
      phaseRef.current = 'fading';
      fadeTimerRef.current = window.setTimeout(() => {
        setVisible(false);
        fadeTimerRef.current = window.setTimeout(() => {
          phaseRef.current = 'idle';
          applyTransform(0);
        }, 220);
      }, 160);
      return;
    }

    phaseRef.current = 'finishing';
    setVisible(true);
    startLoop();
  };

  useEffect(() => {
    const handleExternalProgress = (event: Event) => {
      const custom = event as CustomEvent<GlobalProgressDetail>;
      const detail = custom.detail;
      if (!detail) return;

      const sourceKey = detail.source || 'default';

      if (detail.active) {
        const incoming =
          typeof detail.progress === 'number' && Number.isFinite(detail.progress)
            ? Math.min(95, Math.max(4, detail.progress))
            : 12;
        activeSourcesRef.current.set(sourceKey, incoming);

        if (phaseRef.current === 'idle' || phaseRef.current === 'fading') {
          launchSmoothRun(false, incoming);
        } else {
          phaseRef.current = 'running';
          clearFadeTimer();
          setVisible(true);
          startLoop();
        }
      } else {
        activeSourcesRef.current.delete(sourceKey);
        if (activeSourcesRef.current.size > 0) return;
        finishSmoothRun();
      }
    };

    window.addEventListener(GLOBAL_PROGRESS_EVENT, handleExternalProgress);
    return () => {
      window.removeEventListener(GLOBAL_PROGRESS_EVENT, handleExternalProgress);
      stopLoop();
      clearFadeTimer();
    };
  }, []);

  useEffect(() => {
    // Let active async sources stay in charge if already tracking a heavy operation
    if (activeSourcesRef.current.size > 0) return;
    launchSmoothRun(true, 0);
  }, [triggerKey]);

  return (
    <div
      role="progressbar"
      aria-label="Page and tool loading progress"
      aria-hidden={!visible}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={ariaProgress}
      className={`fixed top-0 left-0 right-0 h-[3.5px] z-[120] overflow-x-clip pointer-events-none no-print transition-opacity duration-300 ease-out bg-[#2F3E4E]/10 dark:bg-white/10 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Ambient VCPL Glow Reflection Under Bar (GPU scale3d) */}
      <span
        ref={auraRef}
        aria-hidden="true"
        className="vcpl-yt-glow-aura absolute inset-x-0 top-0 h-[8px] -translate-y-0.5 origin-left pointer-events-none will-change-transform"
        style={{ transform: 'scale3d(0, 1, 1)' }}
      />

      {/* Primary Gradient Track + Flowing Sheen (GPU scale3d) */}
      <div
        ref={barRef}
        className="vcpl-yt-bar relative h-full w-full origin-left will-change-transform"
        style={{ transform: 'scale3d(0, 1, 1)' }}
      />

      {/* Synchronized Glowing Comet Peg Carrier (GPU translate3d — never distorts dot) */}
      <div
        ref={pegCarrierRef}
        aria-hidden="true"
        className="absolute inset-0 w-full h-full pointer-events-none will-change-transform"
        style={{ transform: 'translate3d(-100%, 0, 0)' }}
      >
        <span className="vcpl-yt-peg absolute right-0 top-0 block h-full w-24 rounded-full bg-gradient-to-r from-transparent via-[#F9C80E]/90 to-[#FFFDF5] opacity-95" />
        <span className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#FFFDF5] shadow-[0_0_10px_2px_#F9C80E,0_0_20px_4px_#12805C,0_0_28px_5px_#9E2A2B]" />
      </div>
    </div>
  );
}
