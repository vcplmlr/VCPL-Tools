import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { LEGAL_PAGES, LegalPageSlug } from '../data/legalPagesData.ts';
import { PUBLIC_TOOLS_CATALOG, TOOL_SECTION_HEADS } from '../data/toolsCatalog.ts';

const CATEGORY_SLUG_BY_FILTER: Record<string, string> = {
  Banking: 'bank-slips',
  'Tax & GST': 'tax-gst',
  'GST Utilities': 'gst-utilities',
  Calculator: 'calculator',
  'PDF Suite': 'pdf-tools',
  'Image Studio': 'image-tools',
  'Typing & Text': 'typing-text',
  Utilities: 'qr-utilities',
  VCPL: 'vcpl-tools',
  'Special Tools': 'special-tools',
  'Learn Tools': 'learn-tools',
};

function getToolRoutePath(tool: { id: string; category: string }): string {
  if (tool.id === 'rto-code-finder') return '/tools/rto-code-finder';
  if (tool.id === 'pin-code-finder') return '/tools/pin-code-finder';
  const catSlug = CATEGORY_SLUG_BY_FILTER[tool.category] || 'tools';
  return `/${catSlug}/${tool.id}`;
}

function getAllToolsRoutePath(filterKey: string): string {
  if (filterKey === 'All') return '/tools';
  return `/${CATEGORY_SLUG_BY_FILTER[filterKey] || 'tools'}`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

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
  return 'https://vcpltools.vercel.app';
}

export function buildSitemapXmlString(origin: string): string {
  const cleanOrigin = origin.replace(/\/+$/, '');
  const lastmod = new Date().toISOString().slice(0, 10);

  const entries: Array<{ loc: string; changefreq: string; priority: string }> = [
    { loc: `${cleanOrigin}/`, changefreq: 'weekly', priority: '1.0' },
    { loc: `${cleanOrigin}/tools`, changefreq: 'weekly', priority: '0.95' },
    { loc: `${cleanOrigin}/sitemap`, changefreq: 'weekly', priority: '0.75' },
    ...TOOL_SECTION_HEADS.map((head) => ({
      loc: `${cleanOrigin}${getAllToolsRoutePath(head.key)}`,
      changefreq: 'weekly',
      priority: '0.9',
    })),
    ...PUBLIC_TOOLS_CATALOG.map((tool) => ({
      loc: `${cleanOrigin}${getToolRoutePath(tool)}`,
      changefreq: 'monthly',
      priority: tool.featuredPrimary ? '0.85' : '0.8',
    })),
    ...(Object.keys(LEGAL_PAGES) as LegalPageSlug[]).map((slug) => ({
      loc: `${cleanOrigin}/${slug}`,
      changefreq: slug === 'faq' ? 'monthly' : 'yearly',
      priority: slug === 'faq' ? '0.65' : '0.55',
    })),
  ];

  const xmlRows = entries
    .map(
      (entry) =>
        `  <url>\n    <loc>${escapeXml(entry.loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${entry.changefreq}</changefreq>\n    <priority>${entry.priority}</priority>\n  </url>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${xmlRows}\n</urlset>\n`;
}

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
    const body = [
      'User-agent: Mediapartners-Google',
      'Allow: /',
      '',
      'User-agent: AdsBot-Google',
      'Allow: /',
      '',
      'User-agent: *',
      'Allow: /',
      'Disallow: /assets/aistudio/',
      'Disallow: /api/',
      'Disallow: /income-tax-fy-2026-27.html',
      'Disallow: /locked',
      'Disallow: /locked-tools',
      'Disallow: /404',
      'Disallow: /not-found',
      '',
      `Sitemap: ${origin}/sitemap.xml`,
      '',
    ].join('\n');

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
