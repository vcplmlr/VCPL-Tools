import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { getAutoPublishedBlogPosts, getAutoPublishedCoverSvg } from './blogScheduler.ts';
import {
  DEFAULT_SITE_ORIGIN,
  buildRobotsTxtString,
  buildSitemapXmlString,
  getBlogPath,
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

function escapeXmlAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
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

  app.get('/blog/:slug.svg', (req, res, next) => {
    const slug = String(req.params.slug || '').trim().replace(/[^a-z0-9-]/gi, '');
    if (!slug) {
      next();
      return;
    }

    const staticSvgPath = path.resolve(process.cwd(), 'public', 'blog', `${slug}.svg`);
    if (fs.existsSync(staticSvgPath)) {
      res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.sendFile(staticSvgPath);
      return;
    }

    const dbSvg = getAutoPublishedCoverSvg(slug);
    if (dbSvg) {
      res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(dbSvg);
      return;
    }

    next();
  });

  app.get('/sitemap.xml', (req, res) => {
    const origin = resolveOrigin(req).replace(/\/+$/, '');
    let xml = buildSitemapXmlString(origin);
    const dynamicPosts = getAutoPublishedBlogPosts();

    if (dynamicPosts.length > 0) {
      const extraEntries = dynamicPosts
        .filter((post) => !xml.includes(`<loc>${escapeXmlAttr(`${origin}${getBlogPath(post.slug)}`)}</loc>`))
        .map((post) => {
          const postLoc = `${origin}${getBlogPath(post.slug)}`;
          const imgLoc = `${origin}${post.coverImage}`;
          return `  <url>\n    <loc>${escapeXmlAttr(postLoc)}</loc>\n    <lastmod>${escapeXmlAttr(
            post.updatedIso
          )}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.85</priority>\n    <image:image>\n      <image:loc>${escapeXmlAttr(
            imgLoc
          )}</image:loc>\n      <image:title>${escapeXmlAttr(
            post.title
          )}</image:title>\n    </image:image>\n  </url>`;
        });

      if (extraEntries.length > 0) {
        xml = xml.replace('</urlset>', `${extraEntries.join('\n')}\n</urlset>`);
      }
    }

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=900');
    res.send(xml);
  });
}
