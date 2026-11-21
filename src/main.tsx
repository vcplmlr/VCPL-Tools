import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const RELOAD_STORAGE_KEY = 'vcpl_chunk_reload_at';
const RELOAD_COOLDOWN_MS = 10_000;

function recoverFromStaleChunkError(): void {
  try {
    const lastReloadAt = Number(window.sessionStorage.getItem(RELOAD_STORAGE_KEY) || '0');
    const now = Date.now();
    if (!Number.isFinite(lastReloadAt) || now - lastReloadAt > RELOAD_COOLDOWN_MS) {
      window.sessionStorage.setItem(RELOAD_STORAGE_KEY, String(now));
      window.location.reload();
    }
  } catch {
    // Ignore storage restrictions
  }
}

function isChunkHtmlOrFetchError(message: string): boolean {
  const msg = message.toLowerCase();
  return (
    msg.includes("unexpected token '<'") ||
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('importing a module script failed') ||
    msg.includes('error loading dynamically imported module')
  );
}

// Recover cleanly if a stale lazy chunk or Vite dep hash resolves to HTML after a rebuild/restart
window.addEventListener('vite:preloadError', () => {
  recoverFromStaleChunkError();
});

window.addEventListener('error', (event) => {
  if (typeof event.message === 'string' && isChunkHtmlOrFetchError(event.message)) {
    recoverFromStaleChunkError();
  }
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const msg =
    typeof reason === 'string'
      ? reason
      : reason && typeof reason === 'object' && 'message' in reason
        ? String((reason as { message?: unknown }).message || '')
        : '';
  if (msg && isChunkHtmlOrFetchError(msg)) {
    recoverFromStaleChunkError();
  }
});

createRoot(document.getElementById('root')!).render(<App />);

