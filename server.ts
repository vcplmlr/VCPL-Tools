import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from './src/server/db.ts';
import { seedRtoIfEmpty } from './src/server/importers.ts';
import { createApiRouter, warmDirectoryCache } from './src/server/routes.ts';
import { registerSeoAndAdSenseRoutes } from './src/server/seoRoutes.ts';

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
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir, { index: false }));
    app.get('*', (req, res) => {
      if (
        req.path.startsWith('/api/') ||
        req.path.startsWith('/assets/') ||
        /\.(?:js|mjs|cjs|css|map|json|wasm|svg|png|jpe?g|webp|gif|ico|woff2?|ttf|pdf)$/i.test(
          req.path
        )
      ) {
        res.status(404).type('text/plain').send('Not found');
        return;
      }
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Production build not found. Run npm run build first.');
      }
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`VCPL Tools server running on http://0.0.0.0:${port}`);
    warmDirectoryCache();
  });
}

startServer().catch((err) => {
  console.error('Server startup failed:', err);
  process.exit(1);
});
