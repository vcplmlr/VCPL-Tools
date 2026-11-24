import 'dotenv/config';
import express from 'express';
import { getDb } from '../src/server/db.ts';
import { seedRtoIfEmpty } from '../src/server/importers.ts';
import { createApiRouter } from '../src/server/routes.ts';
import { registerSeoAndAdSenseRoutes } from '../src/server/seoRoutes.ts';

let initialized = false;
function ensureInitialized() {
  if (initialized) return;
  try {
    getDb();
    seedRtoIfEmpty();
  } catch (err) {
    console.warn('[VCPL Vercel Serverless] Directory SQLite warm-up warning:', err);
  }
  initialized = true;
}

ensureInitialized();

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '25mb' }));

registerSeoAndAdSenseRoutes(app);
app.use('/api', createApiRouter());

export default app;
