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

async function startServer() {
  // Initialize SQLite database, indexes, and baseline RTO table
  getDb();
  seedRtoIfEmpty();

  const app = express();
  const port = Number(process.env.PORT) || 3000;

  // Support chunked CSV/XLSX/JSON bulk import payloads up to 25 MB
  app.use(express.json({ limit: '25mb' }));

  registerSeoAndAdSenseRoutes(app);
  app.use('/api', createApiRouter());

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
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

  app.listen(port, '0.0.0.0', () => {
    console.log(`VCPL Tools server running on http://0.0.0.0:${port}`);
    warmDirectoryCache();
    startBackendBlogScheduler();
  });
}

startServer().catch((err) => {
  console.error('Server startup failed:', err);
  process.exit(1);
});
