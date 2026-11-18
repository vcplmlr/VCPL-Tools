import crypto from 'node:crypto';
import fs from 'node:fs';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import {defineConfig, Plugin} from 'vite';

const VIRTUAL_BUILD_META_ID = 'virtual:vcpl-build-meta';
const RESOLVED_VIRTUAL_BUILD_META_ID = '\0' + VIRTUAL_BUILD_META_ID;

function collectSourceFileStats(dirPath: string, rootDir: string, out: Array<{ rel: string; mtimeMs: number; size: number }>) {
  if (!fs.existsSync(dirPath)) return;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
    if (
      relPath === 'node_modules' ||
      relPath === 'dist' ||
      relPath.startsWith('.git') ||
      relPath.startsWith('public/assets/aistudio') ||
      relPath.startsWith('src/assets/images')
    ) {
      continue;
    }
    if (entry.isDirectory()) {
      collectSourceFileStats(fullPath, rootDir, out);
    } else if (entry.isFile()) {
      const stat = fs.statSync(fullPath);
      out.push({ rel: relPath, mtimeMs: stat.mtimeMs, size: stat.size });
    }
  }
}

function computeVcplBuildMeta(rootDir: string) {
  const files: Array<{ rel: string; mtimeMs: number; size: number }> = [];
  collectSourceFileStats(path.join(rootDir, 'src'), rootDir, files);
  collectSourceFileStats(path.join(rootDir, 'public'), rootDir, files);

  for (const rootFile of ['index.html', 'package.json', 'vercel.json']) {
    const p = path.join(rootDir, rootFile);
    if (fs.existsSync(p)) {
      const stat = fs.statSync(p);
      files.push({ rel: rootFile, mtimeMs: stat.mtimeMs, size: stat.size });
    }
  }

  files.sort((a, b) => a.rel.localeCompare(b.rel));

  let latestModifiedMs = 0;
  const hasher = crypto.createHash('sha256');
  for (const f of files) {
    if (f.mtimeMs > latestModifiedMs) {
      latestModifiedMs = f.mtimeMs;
    }
    hasher.update(`${f.rel}:${f.size}:${Math.floor(f.mtimeMs)};`);
  }

  // Include Vercel deploy SHA / build env if present so every deployment creates a fresh fingerprint
  const vercelSha = (process.env.VERCEL_GIT_COMMIT_SHA || '').trim();
  if (vercelSha) {
    hasher.update(`vercel:${vercelSha};`);
  }

  // Fallback to current clock if no files found, or ensure Vercel fresh clones reflect deploy time cleanly
  if (latestModifiedMs <= 0) {
    latestModifiedMs = Date.now();
  }

  // Count tools dynamically from TOOLS_CATALOG so adding tools automatically bumps the version
  let toolCount = 179;
  try {
    const catalogPath = path.join(rootDir, 'src', 'data', 'toolsCatalog.ts');
    if (fs.existsSync(catalogPath)) {
      const catalogRaw = fs.readFileSync(catalogPath, 'utf8');
      const startIdx = catalogRaw.indexOf('export const TOOLS_CATALOG');
      if (startIdx >= 0) {
        const tail = catalogRaw.slice(startIdx);
        const endMatch = tail.match(/\n\];/);
        const slice = endMatch && endMatch.index !== undefined ? tail.slice(0, endMatch.index) : tail;
        const matches = slice.match(/\n\s*id:\s*['"][^'"]+['"]/g);
        if (matches && matches.length > 0) {
          toolCount = matches.length;
        }
      }
    }
  } catch {
    // Fallback to baseline tool count
  }

  // Baseline major/minor from package.json if explicitly bumped above 0.0.0, else 2.4
  let baseMajor = 2;
  let baseMinor = 4;
  try {
    const pkgPath = path.join(rootDir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (typeof pkg.version === 'string' && pkg.version !== '0.0.0') {
      const parts = pkg.version.split('.').map(Number);
      if (Number.isFinite(parts[0]) && parts[0] > 0) {
        baseMajor = parts[0];
        baseMinor = Number.isFinite(parts[1]) ? parts[1] : 0;
      }
    }
  } catch {
    // Use default 2.4 baseline
  }

  const minor = baseMinor + Math.max(0, toolCount - 179);
  // Monotonically ascending revision from 2026-11-18 00:00 UTC based on latest update minute
  const baselineEpochMs = Date.UTC(2026, 10, 18, 0, 0, 0);
  const patch = Math.max(1, Math.floor((latestModifiedMs - baselineEpochMs) / 60_000));
  const buildHash = hasher.digest('hex').slice(0, 4).toUpperCase();

  const updatedDate = new Date(latestModifiedMs);
  const lastUpdatedIso = updatedDate.toISOString();
  const lastUpdatedDateIst = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(updatedDate);
  const lastUpdatedTimeIst = `${new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
    .format(updatedDate)
    .toUpperCase()} IST`;

  return {
    stableVersion: `v${baseMajor}.${minor}.${patch}`,
    nextGenVersion: `v${baseMajor}.${minor + 1}.0-beta`,
    buildHash,
    toolCount,
    lastUpdatedIso,
    lastUpdatedDateIst,
    lastUpdatedTimeIst,
  };
}

function vcplBuildMetadataPlugin(): Plugin {
  const rootDir = import.meta.dirname;
  return {
    name: 'vcpl-build-metadata',
    resolveId(id) {
      if (id === VIRTUAL_BUILD_META_ID) {
        return RESOLVED_VIRTUAL_BUILD_META_ID;
      }
      return null;
    },
    load(id) {
      if (id === RESOLVED_VIRTUAL_BUILD_META_ID) {
        const meta = computeVcplBuildMeta(rootDir);
        return `export const vcplBuildMeta = ${JSON.stringify(meta)};`;
      }
      return null;
    },
    handleHotUpdate({ server }) {
      const mod = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_BUILD_META_ID);
      if (mod) {
        server.moduleGraph.invalidateModule(mod);
      }
    },
  };
}

function spa404FallbackPlugin() {
  return {
    name: 'vcpl-spa-404-fallback',
    closeBundle() {
      const distDir = path.resolve(import.meta.dirname, 'dist');
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
    plugins: [react(), tailwindcss(), vcplBuildMetadataPlugin(), spa404FallbackPlugin()],
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
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
