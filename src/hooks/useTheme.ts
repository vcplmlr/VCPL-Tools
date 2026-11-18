import { useCallback, useEffect, useState } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';

export const THEME_STORAGE_KEY = 'vcpl_theme_preference_v1';

function clearLegacyStoredTheme() {
  try {
    window.localStorage.removeItem(THEME_STORAGE_KEY);
  } catch {
    // Ignore storage access restrictions
  }
}

function resolveIsDark(preference: ThemePreference): boolean {
  if (typeof window === 'undefined') return false;
  if (preference === 'dark') return true;
  if (preference === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function useTheme() {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() =>
    resolveIsDark('system') ? 'dark' : 'light'
  );

  useEffect(() => {
    clearLegacyStoredTheme();
  }, []);

  const applyTheme = useCallback((pref: ThemePreference) => {
    const isDark = resolveIsDark(pref);
    document.documentElement.classList.toggle('dark', isDark);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', isDark ? '#0B1120' : '#2F3E4E');
    }
    setResolvedTheme(isDark ? 'dark' : 'light');
  }, []);

  const setPreference = useCallback(
    (next: ThemePreference) => {
      setPreferenceState(next);
      applyTheme(next);
    },
    [applyTheme]
  );

  useEffect(() => {
    applyTheme(preference);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = () => {
      if (preference === 'system') {
        applyTheme('system');
      }
    };

    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, [preference, applyTheme]);

  return { preference, resolvedTheme, setPreference };
}
