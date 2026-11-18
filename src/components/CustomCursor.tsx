import { useEffect, useRef, useState } from 'react';

export function CustomCursor() {
  const [enabled, setEnabled] = useState(false);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const arrowRef = useRef<HTMLDivElement | null>(null);
  const arrowScaleRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);
  const ringScaleRef = useRef<HTMLDivElement | null>(null);
  const ringCircleRef = useRef<SVGCircleElement | null>(null);

  const targetPos = useRef({ x: -100, y: -100 });
  const ringPos = useRef({ x: -100, y: -100 });
  const rafId = useRef<number | null>(null);

  const stateRef = useRef({
    visible: false,
    textInput: false,
    hovering: false,
    pressed: false,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const evaluate = () => {
      const shouldEnable = finePointer.matches && !reducedMotion.matches;
      setEnabled(shouldEnable);
      document.documentElement.classList.toggle('vcpl-custom-cursor', shouldEnable);
    };

    evaluate();
    finePointer.addEventListener('change', evaluate);
    reducedMotion.addEventListener('change', evaluate);

    return () => {
      document.documentElement.classList.remove('vcpl-custom-cursor');
      finePointer.removeEventListener('change', evaluate);
      reducedMotion.removeEventListener('change', evaluate);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const syncVisualState = () => {
      const { visible, textInput, hovering, pressed } = stateRef.current;

      if (rootRef.current) {
        rootRef.current.style.opacity = visible && !textInput ? '1' : '0';
      }

      if (ringScaleRef.current) {
        const ringTransform = pressed
          ? 'translate(-50%, -50%) scale(0.75)'
          : hovering
          ? 'translate(-50%, -50%) scale(1.25)'
          : 'translate(-50%, -50%) scale(1)';
        ringScaleRef.current.style.transform = ringTransform;
      }

      if (arrowScaleRef.current) {
        const arrowTransform = pressed
          ? 'translate(-3px, -3px) scale(0.9)'
          : hovering
          ? 'translate(-3px, -3px) scale(1.1)'
          : 'translate(-3px, -3px) scale(1)';
        arrowScaleRef.current.style.transform = arrowTransform;
      }

      if (ringCircleRef.current) {
        ringCircleRef.current.style.stroke = hovering ? '#12805C' : '#2F3E4E';
      }
    };

    const animateRing = () => {
      const dx = targetPos.current.x - ringPos.current.x;
      const dy = targetPos.current.y - ringPos.current.y;

      ringPos.current.x += dx * 0.24;
      ringPos.current.y += dy * 0.24;

      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${ringPos.current.x}px, ${ringPos.current.y}px, 0)`;
      }

      if (Math.abs(dx) < 0.25 && Math.abs(dy) < 0.25) {
        ringPos.current.x = targetPos.current.x;
        ringPos.current.y = targetPos.current.y;
        if (ringRef.current) {
          ringRef.current.style.transform = `translate3d(${ringPos.current.x}px, ${ringPos.current.y}px, 0)`;
        }
        rafId.current = null;
        return;
      }

      rafId.current = window.requestAnimationFrame(animateRing);
    };

    const scheduleRing = () => {
      if (rafId.current === null) {
        rafId.current = window.requestAnimationFrame(animateRing);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      targetPos.current.x = e.clientX;
      targetPos.current.y = e.clientY;

      if (arrowRef.current) {
        arrowRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      }

      if (ringPos.current.x < -50) {
        ringPos.current.x = e.clientX;
        ringPos.current.y = e.clientY;
        if (ringRef.current) {
          ringRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
        }
      }

      const target = e.target as HTMLElement | null;
      const isText = Boolean(
        target?.closest(
          'input[type="text"], input[type="email"], input[type="number"], input[type="search"], input[type="password"], textarea, [data-ribbon-stage="true"]'
        )
      );
      const isHover = !isText && Boolean(
        target?.closest(
          'a, button, select, summary, [role="button"], [role="tab"], input[type="checkbox"], input[type="radio"], input[type="file"], label'
        )
      );

      if (
        !stateRef.current.visible ||
        stateRef.current.textInput !== isText ||
        stateRef.current.hovering !== isHover
      ) {
        stateRef.current.visible = true;
        stateRef.current.textInput = isText;
        stateRef.current.hovering = isHover;
        syncVisualState();
      }

      scheduleRing();
    };

    const handleMouseDown = () => {
      stateRef.current.pressed = true;
      syncVisualState();
    };
    const handleMouseUp = () => {
      stateRef.current.pressed = false;
      syncVisualState();
    };
    const handleMouseLeave = () => {
      stateRef.current.visible = false;
      syncVisualState();
    };
    const handleMouseEnter = () => {
      stateRef.current.visible = true;
      syncVisualState();
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mousedown', handleMouseDown, { passive: true });
    window.addEventListener('mouseup', handleMouseUp, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
      if (rafId.current !== null) {
        window.cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
    };
  }, [enabled]);

  if (!enabled) {
    return null;
  }

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      style={{ opacity: 0 }}
      className="fixed inset-0 pointer-events-none z-[9999] no-print transition-opacity duration-150"
    >
      {/* Trailing segmented circular arc ring matching theme */}
      <div
        ref={ringRef}
        className="fixed top-0 left-0 will-change-transform"
        style={{ transform: 'translate3d(-100px, -100px, 0)' }}
      >
        <div
          ref={ringScaleRef}
          style={{ transform: 'translate(-50%, -50%) scale(1)' }}
          className="transition-transform duration-150 ease-out"
        >
          <svg
            width="42"
            height="42"
            viewBox="0 0 42 42"
            fill="none"
            className="animate-spin-slow drop-shadow-[0_2px_4px_rgba(47,62,78,0.18)]"
          >
            <circle
              ref={ringCircleRef}
              cx="21"
              cy="21"
              r="17"
              stroke="#2F3E4E"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeDasharray="62 45"
            />
            <circle
              cx="21"
              cy="21"
              r="17"
              stroke="#F9C80E"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeDasharray="20 87"
              strokeDashoffset="-68"
            />
          </svg>
        </div>
      </div>

      {/* Crisp tilted pointer arrow */}
      <div
        ref={arrowRef}
        className="fixed top-0 left-0 will-change-transform"
        style={{ transform: 'translate3d(-100px, -100px, 0)' }}
      >
        <div
          ref={arrowScaleRef}
          style={{ transform: 'translate(-3px, -3px) scale(1)' }}
          className="transition-transform duration-100 ease-out"
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 28 28"
            fill="none"
            className="drop-shadow-[0_3px_5px_rgba(47,62,78,0.28)]"
          >
            <defs>
              <linearGradient id="vcplCursorGrad" x1="3" y1="3" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#F9C80E" />
                <stop offset="45%" stopColor="#2F3E4E" />
                <stop offset="100%" stopColor="#1E293B" />
              </linearGradient>
            </defs>
            <path
              d="M4.2 3.2L22.6 12.1C23.5 12.5 23.4 13.8 22.4 14.1L14.8 16.3L11.7 23.6C11.3 24.5 10 24.5 9.7 23.5L3.3 4.6C3 3.7 3.5 2.9 4.2 3.2Z"
              fill="url(#vcplCursorGrad)"
              stroke="#FFFDF5"
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
