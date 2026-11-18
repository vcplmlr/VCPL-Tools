import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Recover once per session if a stale lazy chunk URL resolves to HTML after a rebuild
window.addEventListener('vite:preloadError', () => {
  try {
    const key = 'vcpl_chunk_reload_once';
    if (!window.sessionStorage.getItem(key)) {
      window.sessionStorage.setItem(key, '1');
      window.location.reload();
    }
  } catch {
    // Ignore storage restrictions
  }
});

createRoot(document.getElementById('root')!).render(<App />);
