export type AdConsentMode = 'essential' | 'accepted';

export type AdSlotVariant =
  | 'leaderboard'
  | 'billboard'
  | 'inline'
  | 'in-article'
  | 'workspace'
  | 'compact-strip'
  | 'dual'
  | 'triple'
  | 'sidebar'
  | 'multiplex'
  | 'anchor';

export const COOKIE_CONSENT_STORAGE_KEY = 'vcpl_cookie_consent_v1';
export const CONSENT_UPDATED_EVENT = 'vcpl:consent-updated';
export const OPEN_COOKIE_BANNER_EVENT = 'vcpl:open-cookie-banner';

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>> & {
      requestNonPersonalizedAds?: 0 | 1;
      pauseAdRequests?: 0 | 1;
    };
  }
}

function readViteEnv(key: string): string {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    return (env?.[key] ?? '').trim();
  } catch {
    return '';
  }
}

export const ADSENSE_CLIENT_ID = readViteEnv('VITE_ADSENSE_CLIENT');

export function isValidAdSenseClient(clientId: string): boolean {
  return /^ca-pub-\d{10,20}$/.test(clientId);
}

export function isValidAdSenseSlot(slotId: string): boolean {
  return /^\d{6,16}$/.test(slotId);
}

const SLOT_ENV_BY_VARIANT: Record<AdSlotVariant, string> = {
  leaderboard: readViteEnv('VITE_ADSENSE_SLOT_LEADERBOARD'),
  billboard: readViteEnv('VITE_ADSENSE_SLOT_BILLBOARD'),
  'in-article': readViteEnv('VITE_ADSENSE_SLOT_INARTICLE'),
  inline: readViteEnv('VITE_ADSENSE_SLOT_INLINE'),
  workspace: readViteEnv('VITE_ADSENSE_SLOT_WORKSPACE'),
  'compact-strip': readViteEnv('VITE_ADSENSE_SLOT_LEADERBOARD'),
  dual: readViteEnv('VITE_ADSENSE_SLOT_RECTANGLE'),
  triple: readViteEnv('VITE_ADSENSE_SLOT_RECTANGLE'),
  sidebar: readViteEnv('VITE_ADSENSE_SLOT_SIDEBAR'),
  multiplex: readViteEnv('VITE_ADSENSE_SLOT_MULTIPLEX'),
  anchor: readViteEnv('VITE_ADSENSE_SLOT_ANCHOR'),
};

export function getStoredConsentMode(): AdConsentMode | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { mode?: string };
    if (parsed.mode === 'essential' || parsed.mode === 'accepted') {
      return parsed.mode;
    }
    return null;
  } catch {
    return null;
  }
}

export function syncAdSenseConsent(mode: AdConsentMode | null): void {
  if (typeof window === 'undefined') return;
  const queue = (window.adsbygoogle = window.adsbygoogle || []);
  queue.requestNonPersonalizedAds = mode === 'accepted' ? 0 : 1;
}

let adSenseScriptRequested = false;

export function ensureAdSenseInitialized(): boolean {
  if (typeof document === 'undefined' || typeof window === 'undefined') return false;
  if (!isValidAdSenseClient(ADSENSE_CLIENT_ID)) return false;

  syncAdSenseConsent(getStoredConsentMode());

  let meta = document.querySelector<HTMLMetaElement>('meta[name="google-adsense-account"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'google-adsense-account';
    meta.content = ADSENSE_CLIENT_ID;
    document.head.appendChild(meta);
  } else if (meta.content !== ADSENSE_CLIENT_ID) {
    meta.content = ADSENSE_CLIENT_ID;
  }

  if (!adSenseScriptRequested && !document.querySelector('script[data-vcpl-adsense="true"]')) {
    adSenseScriptRequested = true;
    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(
      ADSENSE_CLIENT_ID
    )}`;
    script.setAttribute('data-vcpl-adsense', 'true');
    document.head.appendChild(script);
  }

  return true;
}

export function openCookiePreferences(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OPEN_COOKIE_BANNER_EVENT));
}

export interface ResolvedAdUnit {
  isLiveAdSense: boolean;
  adClient: string;
  adSlotNumericId: string;
  adFormat: 'auto' | 'fluid' | 'rectangle' | 'vertical' | 'horizontal' | 'autorelaxed';
  adLayout?: 'in-article';
  fullWidthResponsive: boolean;
  minHeightClass: string;
}

export function resolveAdUnit(variant: AdSlotVariant, explicitAdSenseSlot?: string): ResolvedAdUnit {
  const numericSlot =
    (explicitAdSenseSlot && isValidAdSenseSlot(explicitAdSenseSlot) ? explicitAdSenseSlot : '') ||
    (isValidAdSenseSlot(SLOT_ENV_BY_VARIANT[variant]) ? SLOT_ENV_BY_VARIANT[variant] : '');

  const isLive = isValidAdSenseClient(ADSENSE_CLIENT_ID) && isValidAdSenseSlot(numericSlot);

  switch (variant) {
    case 'billboard':
      return {
        isLiveAdSense: isLive,
        adClient: ADSENSE_CLIENT_ID,
        adSlotNumericId: numericSlot,
        adFormat: 'horizontal',
        fullWidthResponsive: true,
        minHeightClass: 'min-h-[120px] sm:min-h-[250px]',
      };
    case 'leaderboard':
      return {
        isLiveAdSense: isLive,
        adClient: ADSENSE_CLIENT_ID,
        adSlotNumericId: numericSlot,
        adFormat: 'horizontal',
        fullWidthResponsive: true,
        minHeightClass: 'min-h-[60px] sm:min-h-[90px]',
      };
    case 'compact-strip':
      return {
        isLiveAdSense: isLive,
        adClient: ADSENSE_CLIENT_ID,
        adSlotNumericId: numericSlot,
        adFormat: 'horizontal',
        fullWidthResponsive: true,
        minHeightClass: 'min-h-[54px] sm:min-h-[90px]',
      };
    case 'in-article':
      return {
        isLiveAdSense: isLive,
        adClient: ADSENSE_CLIENT_ID,
        adSlotNumericId: numericSlot,
        adFormat: 'fluid',
        adLayout: 'in-article',
        fullWidthResponsive: true,
        minHeightClass: 'min-h-[110px]',
      };
    case 'sidebar':
      return {
        isLiveAdSense: isLive,
        adClient: ADSENSE_CLIENT_ID,
        adSlotNumericId: numericSlot,
        adFormat: 'vertical',
        fullWidthResponsive: false,
        minHeightClass: 'min-h-[250px] xl:min-h-[300px]',
      };
    case 'dual':
    case 'triple':
      return {
        isLiveAdSense: isLive,
        adClient: ADSENSE_CLIENT_ID,
        adSlotNumericId: numericSlot,
        adFormat: 'rectangle',
        fullWidthResponsive: true,
        minHeightClass: 'min-h-[250px]',
      };
    case 'multiplex':
      return {
        isLiveAdSense: isLive,
        adClient: ADSENSE_CLIENT_ID,
        adSlotNumericId: numericSlot,
        adFormat: 'autorelaxed',
        fullWidthResponsive: true,
        minHeightClass: 'min-h-[220px]',
      };
    case 'anchor':
      return {
        isLiveAdSense: isLive,
        adClient: ADSENSE_CLIENT_ID,
        adSlotNumericId: numericSlot,
        adFormat: 'horizontal',
        fullWidthResponsive: true,
        minHeightClass: 'min-h-[54px]',
      };
    case 'workspace':
    case 'inline':
    default:
      return {
        isLiveAdSense: isLive,
        adClient: ADSENSE_CLIENT_ID,
        adSlotNumericId: numericSlot,
        adFormat: 'auto',
        fullWidthResponsive: true,
        minHeightClass: 'min-h-[90px]',
      };
  }
}
