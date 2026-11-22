import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_SITE_ORIGIN,
  buildRobotsTxtString,
  buildSitemapXmlString,
} from '../utils/seoConfig.ts';

function resolveOrigin(req: express.Request): string {
  const envUrl = (process.env.APP_URL || '').trim().replace(/\/+$/, '');
  if (envUrl && /^https?:\/\//i.test(envUrl)) {
    return envUrl;
  }
  const protoHeader = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim();
  const protocol = protoHeader || req.protocol || 'https';
  const host = (req.headers['x-forwarded-host'] as string | undefined)?.split(',')[0]?.trim() || req.get('host');
  if (host) {
    return `${protocol}://${host}`;
  }
  return DEFAULT_SITE_ORIGIN;
}

export { buildSitemapXmlString };

export function registerSeoAndAdSenseRoutes(app: express.Express): void {
  app.get('/ads.txt', (_req, res) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    const staticAdsPath = path.resolve(process.cwd(), 'public', 'ads.txt');
    if (fs.existsSync(staticAdsPath)) {
      res.sendFile(staticAdsPath);
      return;
    }

    res.send('google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0\n');
  });

  app.get('/robots.txt', (req, res) => {
    const origin = resolveOrigin(req);
    const body = buildRobotsTxtString(origin);

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(body);
  });

  app.get('/sitemap.xml', (req, res) => {
    const origin = resolveOrigin(req);
    const xml = buildSitemapXmlString(origin);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(xml);
  });
}
