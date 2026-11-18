import { useCallback, useEffect, useRef, useState } from 'react';

export type AdBlockStatus = 'checking' | 'clear' | 'blocked';

const AD_SCRIPT_PROBE_TOKEN = '__vcplAdsProbeLoaded';
const NETWORK_PROBE_TIMEOUT_MS = 4500;
const CONFIRMATION_DELAY_MS = 400;

declare global {
  interface Window {
    __vcplAdsProbeLoaded?: boolean;
  }
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isEnvironmentReadyForCheck(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  if (!document.body || !document.head) return false;
  if (document.visibilityState !== 'visible') return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  return true;
}

/**
 * Checks whether cosmetic filters (uBlock Origin, AdBlock Plus, AdGuard,
 * Brave Shields, Opera Blocker, etc.) hide, collapse, or remove standard ad probes
 * or rendered [data-ad-slot] elements on the page.
 */
async function detectCosmeticAdBlock(): Promise<boolean> {
  if (!isEnvironmentReadyForCheck()) return false;

  // 1. Check any already-mounted [data-ad-slot] elements directly
  // Only flag display: none applied directly to the slot element (ignore ancestor layout/animations)
  const mountedSlots = Array.from(document.querySelectorAll<HTMLElement>('[data-ad-slot]'));
  for (const slot of mountedSlots) {
    if (!slot.isConnected) continue;
    if (slot.closest('[hidden], .hidden')) continue;
    const style = window.getComputedStyle(slot);
    if (style.display === 'none') {
      return true;
    }
  }

  // 2. Inject offscreen multi-selector cosmetic bait elements
  const container = document.createElement('div');
  container.setAttribute('aria-hidden', 'true');
  container.style.cssText = [
    'position: fixed',
    'left: -9999px',
    'top: -9999px',
    'width: 360px',
    'height: 300px',
    'opacity: 1',
    'pointer-events: none',
    'overflow: hidden',
    'z-index: -1',
  ].join(';');

  const baitOne = document.createElement('div');
  baitOne.className = 'adsbox ad-banner pub_300x250 pub_728x90 text-ad textAd ad-placement';
  baitOne.style.cssText = 'display:block;width:300px;height:250px;';
  baitOne.innerHTML = '&nbsp;';

  const baitTwo = document.createElement('ins');
  baitTwo.className = 'adsbygoogle';
  baitTwo.setAttribute('data-ad-client', 'ca-pub-0000000000000000');
  baitTwo.style.cssText = 'display:block;width:300px;height:250px;';
  baitTwo.innerHTML = '&nbsp;';

  const baitThree = document.createElement('div');
  baitThree.id = 'google_ads_frame1';
  baitThree.className = 'ad-unit sponsored-ad banner_ad dfp-ad ad-container';
  baitThree.setAttribute('data-ad-slot', 'vcpl-probe-slot');
  baitThree.style.cssText = 'display:block;width:300px;height:100px;';
  baitThree.innerHTML = '&nbsp;';

  container.appendChild(baitOne);
  container.appendChild(baitTwo);
  container.appendChild(baitThree);
  document.body.appendChild(container);

  try {
    // Allow browser layout + extension content scripts to apply cosmetic rules
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
    await waitMs(80);

    // If the tab became hidden mid-check, layout measurements aren't reliable
    if (!isEnvironmentReadyForCheck()) {
      return false;
    }

    const probes = [baitOne, baitTwo, baitThree];
    for (const el of probes) {
      if (!document.body.contains(el)) {
        return true;
      }
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        parseFloat(style.opacity || '1') === 0 ||
        rect.height < 10 ||
        rect.width < 10 ||
        el.offsetHeight < 10
      ) {
        return true;
      }
    }

    const containerStyle = window.getComputedStyle(container);
    if (
      containerStyle.display === 'none' ||
      containerStyle.visibility === 'hidden' ||
      container.offsetHeight < 10
    ) {
      return true;
    }

    return false;
  } finally {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
}

/**
 * Probes same-origin /ads.js via dynamic <script> tag execution.
 * Only flags blocked on explicit script.onerror or if onload finishes without
 * executing the probe token (extension noop redirect).
 * Timeouts on busy CPUs are treated as inconclusive (true) rather than false positives.
 */
async function probeScriptExecution(cacheBuster: string): Promise<boolean> {
  if (typeof document === 'undefined' || !document.head) return true;

  window.__vcplAdsProbeLoaded = false;

  return new Promise<boolean>((resolve) => {
    const script = document.createElement('script');
    script.setAttribute('data-vcpl-probe', 'true');
    let settled = false;

    const finish = (loaded: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
      resolve(loaded);
    };

    const timer = window.setTimeout(() => {
      // Timed out waiting for main-thread/script execution: treat as inconclusive, not blocked
      finish(true);
    }, NETWORK_PROBE_TIMEOUT_MS);

    script.async = true;
    script.src = `/ads.js?s=${cacheBuster}`;
    script.onload = () => {
      finish(window.__vcplAdsProbeLoaded === true);
    };
    script.onerror = () => {
      finish(false);
    };

    document.head.appendChild(script);
  });
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin',
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timer);
  }
}

async function verifyOriginBaseline(cacheBuster: string): Promise<boolean> {
  try {
    const baselineRes = await fetchWithTimeout(`/robots.txt?cb=${cacheBuster}`, NETWORK_PROBE_TIMEOUT_MS);
    if (!baselineRes.ok) return false;
    const contentType = (baselineRes.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('text/html')) return false;
    const text = await baselineRes.text();
    return text.includes('User-agent');
  } catch {
    return false;
  }
}

async function detectNetworkAdBlock(): Promise<boolean> {
  if (!isEnvironmentReadyForCheck()) {
    return false;
  }

  const cacheBuster = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  try {
    const adRes = await fetchWithTimeout(`/ads.js?cb=${cacheBuster}`, NETWORK_PROBE_TIMEOUT_MS);
    const contentType = (adRes.headers.get('content-type') || '').toLowerCase();

    if (adRes.ok && !contentType.includes('text/html')) {
      const body = await adRes.text();
      if (body.includes(AD_SCRIPT_PROBE_TOKEN)) {
        // Network fetch succeeded with real probe payload; verify <script> tag execution isn't neutered
        const scriptOk = await probeScriptExecution(cacheBuster);
        if (scriptOk) {
          return false;
        }
        return await verifyOriginBaseline(`${cacheBuster}-s`);
      }
    }

    // Response returned 403/blocked/redirected/empty body; verify same-origin baseline is genuinely reachable
    return await verifyOriginBaseline(`${cacheBuster}-r`);
  } catch (err) {
    // Aborted/timed-out requests indicate slow CPU/network or navigation, not an ad blocker
    if (err instanceof DOMException && err.name === 'AbortError') {
      return false;
    }
    // Immediate network failure (e.g., ERR_BLOCKED_BY_CLIENT): confirm origin is online via /robots.txt
    if (!isEnvironmentReadyForCheck()) {
      return false;
    }
    return await verifyOriginBaseline(`${cacheBuster}-e`);
  }
}

async function runFullAdBlockCheck(): Promise<boolean> {
  if (!isEnvironmentReadyForCheck()) {
    return false;
  }
  const [cosmeticBlocked, networkBlocked] = await Promise.all([
    detectCosmeticAdBlock(),
    detectNetworkAdBlock(),
  ]);
  return cosmeticBlocked || networkBlocked;
}

export function useAdBlockerDetector() {
  const [status, setStatus] = useState<AdBlockStatus>('checking');
  const [isRechecking, setIsRechecking] = useState(false);
  const [stillBlockedAfterRetry, setStillBlockedAfterRetry] = useState(false);
  const checkInFlightRef = useRef(false);
  const statusRef = useRef<AdBlockStatus>('checking');
  const isMountedRef = useRef(true);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const performCheck = useCallback(async (isManualRetry = false): Promise<boolean> => {
    if (checkInFlightRef.current) return statusRef.current === 'clear';
    if (!isManualRetry && !isEnvironmentReadyForCheck()) {
      return statusRef.current !== 'blocked';
    }

    checkInFlightRef.current = true;
    if (isManualRetry) {
      setIsRechecking(true);
    }

    try {
      const [firstBlocked] = await Promise.all([
        runFullAdBlockCheck(),
        isManualRetry ? waitMs(350) : Promise.resolve(),
      ]);

      let confirmedBlocked = firstBlocked;

      // Require two consecutive positive detections before transitioning into 'blocked'
      // so transient mount races, HMR reloads, or tab-wake socket hiccups never flash the modal.
      if (firstBlocked && statusRef.current !== 'blocked' && !isManualRetry) {
        await waitMs(CONFIRMATION_DELAY_MS);
        if (!isMountedRef.current || !isEnvironmentReadyForCheck()) {
          confirmedBlocked = false;
        } else {
          confirmedBlocked = await runFullAdBlockCheck();
        }
      }

      if (!isMountedRef.current) {
        return !confirmedBlocked;
      }

      const nextStatus: AdBlockStatus = confirmedBlocked ? 'blocked' : 'clear';
      statusRef.current = nextStatus;
      setStatus(nextStatus);

      if (isManualRetry) {
        setStillBlockedAfterRetry(confirmedBlocked);
      } else if (!confirmedBlocked) {
        setStillBlockedAfterRetry(false);
      }

      return !confirmedBlocked;
    } finally {
      checkInFlightRef.current = false;
      if (isManualRetry && isMountedRef.current) {
        setIsRechecking(false);
      }
    }
  }, []);

  // Wait for document load & initial hydration settle before running first check
  useEffect(() => {
    let initialTimer: number | null = null;
    const scheduleInitialCheck = () => {
      initialTimer = window.setTimeout(() => {
        void performCheck(false);
      }, 650);
    };

    if (document.readyState === 'complete') {
      scheduleInitialCheck();
    } else {
      const onLoad = () => {
        scheduleInitialCheck();
      };
      window.addEventListener('load', onLoad, { once: true });
      return () => {
        window.removeEventListener('load', onLoad);
        if (initialTimer !== null) window.clearTimeout(initialTimer);
      };
    }

    return () => {
      if (initialTimer !== null) window.clearTimeout(initialTimer);
    };
  }, [performCheck]);

  // Event-driven revalidation (focus, online, tab wake, extension <style> injection)
  useEffect(() => {
    let revalidateTimer: number | null = null;
    const scheduleRevalidate = (delayMs: number) => {
      if (revalidateTimer !== null) window.clearTimeout(revalidateTimer);
      revalidateTimer = window.setTimeout(() => {
        if (document.visibilityState === 'visible') {
          void performCheck(false);
        }
      }, delayMs);
    };

    const handleRevalidate = () => {
      if (document.visibilityState === 'visible') {
        scheduleRevalidate(300);
      }
    };

    window.addEventListener('focus', handleRevalidate);
    window.addEventListener('online', handleRevalidate);
    document.addEventListener('visibilitychange', handleRevalidate);

    // Watch for extension-injected cosmetic <style> tags (ignore Vite dev style updates)
    const observer =
      typeof MutationObserver !== 'undefined' && document.head
        ? new MutationObserver((mutations) => {
            const hasExtensionStyle = mutations.some((m) =>
              Array.from(m.addedNodes).some((n) => {
                if (n instanceof HTMLStyleElement) {
                  return !n.hasAttribute('data-vite-dev-id');
                }
                return n instanceof HTMLLinkElement && n.rel === 'stylesheet';
              })
            );
            if (!hasExtensionStyle) return;
            scheduleRevalidate(450);
          })
        : null;

    if (observer && document.head) {
      observer.observe(document.head, { childList: true });
    }

    return () => {
      window.removeEventListener('focus', handleRevalidate);
      window.removeEventListener('online', handleRevalidate);
      document.removeEventListener('visibilitychange', handleRevalidate);
      if (observer) observer.disconnect();
      if (revalidateTimer !== null) window.clearTimeout(revalidateTimer);
    };
  }, [performCheck]);

  // Adaptive polling: 1.5s when blocked for quick auto-unlock, 5s when clear for low overhead
  useEffect(() => {
    const intervalMs = status === 'blocked' ? 1500 : 5000;
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void performCheck(false);
      }
    }, intervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [performCheck, status]);

  const recheckAdBlocker = useCallback(() => performCheck(true), [performCheck]);

  return {
    status,
    isRechecking,
    stillBlockedAfterRetry,
    recheckAdBlocker,
  };
}
