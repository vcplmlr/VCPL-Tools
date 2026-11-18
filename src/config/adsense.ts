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

export function openCookiePreferences(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OPEN_COOKIE_BANNER_EVENT));
}
