import fs from 'node:fs';
import path from 'node:path';
import { PUBLIC_TOOLS_CATALOG, getToolsForCategory } from '../src/data/toolsCatalog';
import {
  DEFAULT_SITE_ORIGIN,
  buildRobotsTxtString,
  buildSitemapXmlString,
  getAllCanonicalSitemapUrls,
} from '../src/utils/seoConfig';
import { parseLocationToRoute } from '../src/utils/seoRouting';

export function syncAllSeoArtifacts(rootDir: string = process.cwd()): {
  urlCount: number;
  toolCount: number;
  pdfToolCount: number;
  sitemapUpdated: boolean;
  robotsUpdated: boolean;
  ogCardUpdated: boolean;
} {
  const origin =
    (process.env.PUBLIC_SITE_URL || '').trim().replace(/\/+$/, '') || DEFAULT_SITE_ORIGIN;
  const publicDir = path.join(rootDir, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // 1. Validate every canonical sitemap URL parses back to a valid non-404 route
  const canonicalUrls = getAllCanonicalSitemapUrls(origin);
  const brokenRoutes: string[] = [];
  for (const entry of canonicalUrls) {
    const pathname = new URL(entry.loc).pathname;
    const parsed = parseLocationToRoute(pathname, '');
    if (parsed.view === 'not-found') {
      brokenRoutes.push(pathname);
    }
  }
  if (brokenRoutes.length > 0) {
    throw new Error(`SEO sync failed: unparseable canonical routes: ${brokenRoutes.join(', ')}`);
  }

  // 2. Sync public/sitemap.xml (preserve existing file if URLs & priorities match except <lastmod>, else update with today's date)
  const sitemapPath = path.join(publicDir, 'sitemap.xml');
  const nextSitemapXml = buildSitemapXmlString(origin);
  const prevSitemapXml = fs.existsSync(sitemapPath) ? fs.readFileSync(sitemapPath, 'utf8') : '';
  const stripLastmod = (xml: string) => xml.replace(/<lastmod>.*?<\/lastmod>/g, '<lastmod>DATE</lastmod>');
  let sitemapUpdated = false;
  if (!prevSitemapXml || stripLastmod(prevSitemapXml) !== stripLastmod(nextSitemapXml)) {
    fs.writeFileSync(sitemapPath, nextSitemapXml, 'utf8');
    sitemapUpdated = true;
  }

  // 3. Sync public/robots.txt
  const robotsPath = path.join(publicDir, 'robots.txt');
  const nextRobotsTxt = buildRobotsTxtString(origin);
  const prevRobotsTxt = fs.existsSync(robotsPath) ? fs.readFileSync(robotsPath, 'utf8') : '';
  let robotsUpdated = false;
  if (prevRobotsTxt !== nextRobotsTxt) {
    fs.writeFileSync(robotsPath, nextRobotsTxt, 'utf8');
    robotsUpdated = true;
  }

  // 4. Sync tool counts inside public/og-card.svg
  const toolCount = PUBLIC_TOOLS_CATALOG.length;
  const pdfToolCount = getToolsForCategory('PDF Suite').length;
  const ogCardPath = path.join(publicDir, 'og-card.svg');
  let ogCardUpdated = false;
  if (fs.existsSync(ogCardPath)) {
    const prevSvg = fs.readFileSync(ogCardPath, 'utf8');
    const nextSvg = prevSvg
      .replace(/\b\d+\+ OFFLINE TOOLS\b/g, `${toolCount}+ OFFLINE TOOLS`)
      .replace(/\b\d+\+? PDF Utilities\b/g, `${pdfToolCount} PDF Utilities`);
    if (nextSvg !== prevSvg) {
      fs.writeFileSync(ogCardPath, nextSvg, 'utf8');
      ogCardUpdated = true;
    }
  }

  return {
    urlCount: canonicalUrls.length,
    toolCount,
    pdfToolCount,
    sitemapUpdated,
    robotsUpdated,
    ogCardUpdated,
  };
}

const isDirectRun =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1] &&
  process.argv[1].endsWith('sync-seo.ts');

if (isDirectRun) {
  const result = syncAllSeoArtifacts();
  console.log(
    `[SEO Sync] Verified ${result.urlCount} canonical URLs (${result.toolCount} tools, ${result.pdfToolCount} PDF tools). ` +
      `Updated: sitemap.xml=${result.sitemapUpdated}, robots.txt=${result.robotsUpdated}, og-card.svg=${result.ogCardUpdated}`
  );
}
