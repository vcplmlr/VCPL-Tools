import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { startBackendBlogScheduler } from './src/server/blogScheduler.ts';
import { getDb } from './src/server/db.ts';
import { seedRtoIfEmpty } from './src/server/importers.ts';
import { createApiRouter, warmDirectoryCache } from './src/server/routes.ts';
import {
  injectServerSideSeoIntoHtml,
  registerSeoAndAdSenseRoutes,
  resolveRequestOrigin,
} from './src/server/seoRoutes.ts';

const STATIC_EXT_REGEX =
  /\.(?:js|mjs|cjs|css|map|json|wasm|svg|png|jpe?g|webp|gif|ico|woff2?|ttf|pdf|xml|txt)$/i;

function resolveCliFlag(flag: string): string | undefined {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === flag && args[i + 1] && !args[i + 1].startsWith('-')) {
      return args[i + 1];
    }
    if (arg.startsWith(`${flag}=`)) {
      return arg.slice(flag.length + 1);
    }
  }
  return undefined;
}

function resolveServerPort(): number {
  const cliPort = Number(resolveCliFlag('--port'));
  if (Number.isInteger(cliPort) && cliPort > 0 && cliPort <= 65535) {
    return cliPort;
  }
  const envPortRaw = process.env.PORT?.trim();
  const nginxPortRaw = process.env.NGINX_PORT?.trim();
  if (envPortRaw && (!nginxPortRaw || envPortRaw !== nginxPortRaw)) {
    const envPort = Number(envPortRaw);
    if (Number.isInteger(envPort) && envPort > 0 && envPort <= 65535) {
      return envPort;
    }
  }
  const defaultPort = Number(process.env.DEFAULT_APP_PORT);
  if (Number.isInteger(defaultPort) && defaultPort > 0 && defaultPort <= 65535) {
    return defaultPort;
  }
  return 3000;
}

function resolveServerHost(): string {
  const cliHost = resolveCliFlag('--host')?.trim();
  if (cliHost && cliHost !== 'true') {
    return cliHost;
  }
  return '0.0.0.0';
}

async function startServer() {
  // Initialize SQLite database & schema synchronously (<20ms)
  getDb();

  const app = express();
  app.set('trust proxy', 1);
  const port = resolveServerPort();
  const host = resolveServerHost();

  // Support chunked CSV/XLSX/JSON bulk import payloads up to 25 MB
  app.use(express.json({ limit: '25mb' }));

  registerSeoAndAdSenseRoutes(app);
  app.use('/api', createApiRouter());

  if (process.env.NODE_ENV !== 'production') {
    const disableHmr = process.env.DISABLE_HMR === 'true';
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: !disableHmr,
        ws: disableHmr ? (false as const) : undefined,
        watch: disableHmr ? null : {},
      },
      appType: 'custom',
    });
    app.use(vite.middlewares);

    app.get('*', async (req, res, next) => {
      if (
        req.path.startsWith('/api/') ||
        req.path.startsWith('/assets/') ||
        STATIC_EXT_REGEX.test(req.path)
      ) {
        res.status(404).type('text/plain').send('Not found');
        return;
      }

      try {
        const indexPath = path.resolve(process.cwd(), 'index.html');
        const template = fs.readFileSync(indexPath, 'utf8');
        const transformed = await vite.transformIndexHtml(req.originalUrl, template);
        const searchIdx = req.originalUrl.indexOf('?');
        const search = searchIdx >= 0 ? req.originalUrl.slice(searchIdx) : '';
        const origin = resolveRequestOrigin(req);
        const html = injectServerSideSeoIntoHtml(transformed, req.path, search, origin);
        res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8').send(html);
      } catch (err) {
        vite.ssrFixStacktrace(err as Error);
        next(err);
      }
    });
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir, { index: false }));
    app.get('*', (req, res) => {
      if (
        req.path.startsWith('/api/') ||
        req.path.startsWith('/assets/') ||
        STATIC_EXT_REGEX.test(req.path)
      ) {
        res.status(404).type('text/plain').send('Not found');
        return;
      }
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        const rawHtml = fs.readFileSync(indexFile, 'utf8');
        const searchIdx = req.originalUrl.indexOf('?');
        const search = searchIdx >= 0 ? req.originalUrl.slice(searchIdx) : '';
        const origin = resolveRequestOrigin(req);
        const html = injectServerSideSeoIntoHtml(rawHtml, req.path, search, origin);
        res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8').send(html);
      } else {
        res.status(404).send('Production build not found. Run npm run build first.');
      }
    });
  }

  app.listen(port, host, () => {
    console.log(`VCPL Tools server running on http://${host}:${port}`);
    setImmediate(() => {
      try {
        seedRtoIfEmpty();
      } catch (err) {
        console.error('Baseline RTO dataset seed failed:', err);
      }
      warmDirectoryCache();
      startBackendBlogScheduler();
    });
  });
}

startServer().catch((err) => {
  console.error('Server startup failed:', err);
  process.exit(1);
});
