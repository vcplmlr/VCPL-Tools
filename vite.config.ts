import fs from 'fs';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

function spa404FallbackPlugin() {
  return {
    name: 'vcpl-spa-404-fallback',
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist');
      const indexFile = path.join(distDir, 'index.html');
      const notFoundFile = path.join(distDir, '404.html');
      if (fs.existsSync(indexFile)) {
        fs.copyFileSync(indexFile, notFoundFile);
      }
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), spa404FallbackPlugin()],
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'lucide-react',
        'motion/react',
        'exceljs',
        'fflate',
        '@pdfsmaller/pdf-decrypt',
        '@pdfsmaller/pdf-encrypt',
        'html2canvas-pro',
        'jsbarcode',
        'jspdf',
        'jszip',
        'mammoth',
        'pdf-lib',
        'pdfjs-dist',
        'pptxgenjs',
        'qrcode',
        'tesseract.js',
        'xlsx',
      ],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
