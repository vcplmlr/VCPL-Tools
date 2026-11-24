import { BLOG_POSTS } from '../data/blogPostsData.ts';
import { LEGAL_PAGES, LegalPageSlug } from '../data/legalPagesData.ts';
import { PUBLIC_TOOLS_CATALOG, TOOL_CATEGORIES, TOOL_SECTION_HEADS } from '../data/toolsCatalog.ts';
import type { BlogPostItem } from '../types/blog.ts';
import { ToolCatalogItem, ToolFilterType } from '../types/tools.ts';

export const DEFAULT_SITE_ORIGIN = 'https://vcpl-tools.vercel.app';

export const CATEGORY_SLUG_BY_FILTER: Record<Exclude<ToolFilterType, 'All'>, string> = {
  Banking: 'bank-slips',
  'Tax & GST': 'tax-gst',
  Calculator: 'calculator',
  'PDF Suite': 'pdf-tools',
  'Image Studio': 'image-tools',
  'Typing & Text': 'typing-text',
  Utilities: 'qr-utilities',
  VCPL: 'vcpl-tools',
  'Special Tools': 'special-tools',
  'Learn Tools': 'learn-tools',
};

export const FILTER_BY_CATEGORY_SLUG: Record<string, ToolFilterType> = Object.entries(
  CATEGORY_SLUG_BY_FILTER
).reduce<Record<string, ToolFilterType>>((acc, [filter, slug]) => {
  acc[slug] = filter as ToolFilterType;
  return acc;
}, {});

export const ROBOTS_DISALLOW_PATHS: string[] = [
  '/assets/aistudio/',
  '/api/',
  '/income-tax-fy-2026-27.html',
  '/locked',
  '/locked-tools',
  '/portal',
  '/login',
  '/super-admin',
  '/change-password',
  '/400',
  '/401',
  '/403',
  '/404',
  '/408',
  '/410',
  '/429',
  '/500',
  '/502',
  '/503',
  '/504',
  '/not-found',
  '/error/',
  '/errors/',
  '/status/',
];

export function getCategoryUrlSlug(filter: ToolFilterType): string {
  if (filter === 'All') return 'tools';
  return CATEGORY_SLUG_BY_FILTER[filter];
}

export function getAllToolsPath(filter: ToolFilterType = 'All'): string {
  if (filter === 'All') return '/tools';
  return `/${CATEGORY_SLUG_BY_FILTER[filter]}`;
}

export function getToolPath(tool: Pick<ToolCatalogItem, 'id' | 'category'>): string {
  if (tool.id === 'rto-code-finder') {
    return '/tools/rto-code-finder';
  }
  if (tool.id === 'pin-code-finder') {
    return '/tools/pin-code-finder';
  }
  const categorySlug = CATEGORY_SLUG_BY_FILTER[tool.category];
  return `/${categorySlug}/${tool.id}`;
}

export function getToolFullPath(tool: Pick<ToolCatalogItem, 'id' | 'category'>): string {
  return `${getToolPath(tool)}/full`;
}

export function getLegalPath(slug: LegalPageSlug): string {
  return `/${slug}`;
}

export function getBlogPath(slug?: string): string {
  return slug ? `/blog/${slug}` : '/blog';
}

export interface SitemapUrlEntry {
  loc: string;
  changefreq: 'daily' | 'weekly' | 'monthly' | 'yearly';
  priority: string;
  lastmod?: string;
  image?: { loc: string; title: string };
}

export function getAllCanonicalSitemapUrls(
  origin: string = DEFAULT_SITE_ORIGIN,
  extraPosts: BlogPostItem[] = []
): SitemapUrlEntry[] {
  const cleanOrigin = origin.replace(/\/+$/, '');
  const seen = new Set<string>();
  const combinedPostsMap = new Map<string, BlogPostItem>();
  for (const post of [...extraPosts, ...BLOG_POSTS]) {
    if (post?.slug && !combinedPostsMap.has(post.slug)) {
      combinedPostsMap.set(post.slug, post);
    }
  }
  const combinedPosts = Array.from(combinedPostsMap.values()).sort((a, b) =>
    b.updatedIso.localeCompare(a.updatedIso)
  );
  const latestBlogIso = combinedPosts[0]?.updatedIso;

  const rawEntries: SitemapUrlEntry[] = [
    { loc: `${cleanOrigin}/`, changefreq: 'weekly', priority: '1.0', lastmod: latestBlogIso },
    { loc: `${cleanOrigin}/tools`, changefreq: 'weekly', priority: '0.95' },
    { loc: `${cleanOrigin}/blog`, changefreq: 'daily', priority: '0.9', lastmod: latestBlogIso },
    { loc: `${cleanOrigin}/sitemap`, changefreq: 'weekly', priority: '0.75' },
    ...TOOL_SECTION_HEADS.map((head) => ({
      loc: `${cleanOrigin}${getAllToolsPath(head.key)}`,
      changefreq: 'weekly' as const,
      priority: '0.9',
    })),
    ...PUBLIC_TOOLS_CATALOG.map((tool) => ({
      loc: `${cleanOrigin}${getToolPath(tool)}`,
      changefreq: 'monthly' as const,
      priority: tool.featuredPrimary ? '0.85' : '0.8',
    })),
    ...combinedPosts.map((post) => ({
      loc: `${cleanOrigin}${getBlogPath(post.slug)}`,
      changefreq: 'weekly' as const,
      priority: '0.85',
      lastmod: post.updatedIso,
      image: {
        loc: `${cleanOrigin}${post.coverImage}`,
        title: post.title,
      },
    })),
    ...(Object.keys(LEGAL_PAGES) as LegalPageSlug[]).map((slug) => ({
      loc: `${cleanOrigin}${getLegalPath(slug)}`,
      changefreq: slug === 'faq' ? ('monthly' as const) : ('yearly' as const),
      priority: slug === 'faq' ? '0.65' : '0.55',
    })),
  ];

  return rawEntries.filter((entry) => {
    if (seen.has(entry.loc)) return false;
    seen.add(entry.loc);
    return true;
  });
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildSitemapXmlString(
  origin: string = DEFAULT_SITE_ORIGIN,
  lastmod: string = new Date().toISOString().slice(0, 10),
  extraPosts: BlogPostItem[] = []
): string {
  const entries = getAllCanonicalSitemapUrls(origin, extraPosts);
  const xmlRows = entries
    .map((entry) => {
      const rowLastmod = entry.lastmod ?? lastmod;
      const imageXml = entry.image
        ? `\n    <image:image>\n      <image:loc>${escapeXml(entry.image.loc)}</image:loc>\n      <image:title>${escapeXml(entry.image.title)}</image:title>\n    </image:image>`
        : '';
      return `  <url>\n    <loc>${escapeXml(entry.loc)}</loc>\n    <lastmod>${escapeXml(
        rowLastmod
      )}</lastmod>\n    <changefreq>${entry.changefreq}</changefreq>\n    <priority>${
        entry.priority
      }</priority>${imageXml}\n  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${xmlRows}\n</urlset>\n`;
}

function toRfc2822IstDate(isoDate: string): string {
  const clean = isoDate.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return new Date().toUTCString();
  }
  const dt = new Date(`${clean}T09:00:00+05:30`);
  return Number.isNaN(dt.getTime()) ? new Date().toUTCString() : dt.toUTCString();
}

export function buildRssFeedXmlString(
  origin: string = DEFAULT_SITE_ORIGIN,
  extraPosts: BlogPostItem[] = []
): string {
  const cleanOrigin = origin.replace(/\/+$/, '');
  const seen = new Set<string>();
  const posts = [...extraPosts, ...BLOG_POSTS]
    .filter((post) => {
      if (!post?.slug || seen.has(post.slug)) return false;
      seen.add(post.slug);
      return true;
    })
    .sort((a, b) => b.publishedIso.localeCompare(a.publishedIso))
    .slice(0, 50);

  const lastBuildDate = posts[0]
    ? toRfc2822IstDate(posts[0].updatedIso || posts[0].publishedIso)
    : new Date().toUTCString();

  const itemsXml = posts
    .map((post) => {
      const link = `${cleanOrigin}${getBlogPath(post.slug)}`;
      const imgUrl = `${cleanOrigin}${post.coverImage}`;
      const tagsXml = [post.category, ...(post.topicTags ?? []), ...post.keywords.slice(0, 4)]
        .filter(Boolean)
        .map((tag) => `      <category>${escapeXml(tag)}</category>`)
        .join('\n');

      return `  <item>
    <title>${escapeXml(post.title)}</title>
    <link>${escapeXml(link)}</link>
    <guid isPermaLink="true">${escapeXml(link)}</guid>
    <pubDate>${escapeXml(toRfc2822IstDate(post.publishedIso))}</pubDate>
    <dc:creator>${escapeXml(post.author)}</dc:creator>
    <description>${escapeXml(post.seoDescription || post.excerpt)}</description>
${tagsXml}
    <media:content url="${escapeXml(imgUrl)}" medium="image" type="image/svg+xml" width="1200" height="630" />
  </item>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
  <title>VCPL Tools – Daily Indian Accounting, Tax &amp; Banking Blog</title>
  <link>${escapeXml(`${cleanOrigin}/blog`)}</link>
  <atom:link href="${escapeXml(`${cleanOrigin}/rss.xml`)}" rel="self" type="application/rss+xml" />
  <description>Daily 9:00 AM IST practical guides on GST, Income-tax Act 2025, TDS/TCS, Tally reconciliations, PF/ESI payroll, and client-side utilities.</description>
  <language>en-in</language>
  <lastBuildDate>${escapeXml(lastBuildDate)}</lastBuildDate>
  <ttl>60</ttl>
${itemsXml}
</channel>
</rss>
`;
}

export function buildRobotsTxtString(origin: string = DEFAULT_SITE_ORIGIN): string {
  const cleanOrigin = origin.replace(/\/+$/, '');
  return [
    'User-agent: Googlebot',
    'Allow: /',
    '',
    'User-agent: Bingbot',
    'Allow: /',
    '',
    'User-agent: msnbot',
    'Allow: /',
    '',
    'User-agent: Mediapartners-Google',
    'Allow: /',
    '',
    'User-agent: AdsBot-Google',
    'Allow: /',
    '',
    'User-agent: *',
    'Allow: /',
    ...ROBOTS_DISALLOW_PATHS.map((p) => `Disallow: ${p}`),
    '',
    '# Sitemaps & Daily RSS Discovery',
    `Sitemap: ${cleanOrigin}/sitemap.xml`,
    '',
  ].join('\n');
}
