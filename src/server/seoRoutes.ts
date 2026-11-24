import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {
  BLOG_AUTHORS,
  estimatePostWordCount,
  getAllBlogPosts,
  getBlogPostBySlug,
  mergeDynamicBlogPosts,
} from '../data/blogPostsData.ts';
import { LEGAL_PAGES, LegalPageSlug, SITE_CONTACT } from '../data/legalPagesData.ts';
import { PUBLIC_TOOLS_CATALOG, TOOL_CATEGORIES, getToolById } from '../data/toolsCatalog.ts';
import { BlogPostItem } from '../types/blog.ts';
import {
  DEFAULT_SITE_ORIGIN,
  buildRobotsTxtString,
  buildRssFeedXmlString,
  buildSitemapXmlString,
  getAllToolsPath,
  getBlogPath,
  getLegalPath,
  getToolPath,
} from '../utils/seoConfig.ts';
import { parseLocationToRoute } from '../utils/seoRouting.ts';
import {
  getAutoPublishedBlogPostBySlug,
  getAutoPublishedBlogPosts,
  getAutoPublishedCoverSvg,
  getIndexNowKey,
  runScheduledBlogCatchUp,
} from './blogScheduler.ts';

export function resolveRequestOrigin(req: express.Request): string {
  const envUrl = (process.env.PUBLIC_SITE_URL || process.env.APP_URL || '')
    .trim()
    .replace(/\/+$/, '');
  if (envUrl && /^https?:\/\//i.test(envUrl)) {
    return envUrl;
  }
  const protoHeader = (req.headers['x-forwarded-proto'] as string | undefined)
    ?.split(',')[0]
    ?.trim();
  const protocol = protoHeader || req.protocol || 'https';
  const host =
    (req.headers['x-forwarded-host'] as string | undefined)?.split(',')[0]?.trim() ||
    req.get('host');
  if (host) {
    return `${protocol}://${host}`;
  }
  return DEFAULT_SITE_ORIGIN;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toIstIsoTimestamp(isoDate: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(isoDate) ? `${isoDate}T09:00:00+05:30` : isoDate;
}

function resolvePostWithDb(slug: string): BlogPostItem | undefined {
  return getAutoPublishedBlogPostBySlug(slug) ?? getBlogPostBySlug(slug);
}

export function injectServerSideSeoIntoHtml(
  html: string,
  requestPath: string,
  requestSearch: string,
  origin: string
): string {
  const cleanOrigin = origin.replace(/\/+$/, '');
  const autoPosts = getAutoPublishedBlogPosts();
  if (autoPosts.length > 0) {
    mergeDynamicBlogPosts(autoPosts);
  }

  // Handle dynamic DB-published /blog/:slug paths even if parseLocationToRoute ran before cache
  const route = parseLocationToRoute(requestPath, requestSearch);
  const pathSegments = requestPath.replace(/\/+$/, '').toLowerCase().split('/').filter(Boolean);
  const resolvedBlogSlug =
    route.view === 'blog'
      ? route.slug
      : pathSegments.length === 2 && pathSegments[0] === 'blog'
        ? pathSegments[1]
        : undefined;
  const activeBlogPost = resolvedBlogSlug ? resolvePostWithDb(resolvedBlogSlug) : undefined;

  let canonicalPath = requestPath || '/';
  let title = 'VCPL Tools – Free Offline Banking, GST, PDF & Calc Suite';
  let description =
    'Generate SBI & HDFC bank slips, reconcile Form 26AS & GSTR-2B, edit PDFs, generate verified NPCI UPI QRs, and run calculations locally in your browser.';
  let keywords =
    'VCPL Tools, UPI QR Generator, Bank Deposit Slip Generator, GST Invoice Maker, PDF Tools, IFSC Code Finder, Form 26AS Excel, GSTR-2B Reconciler';
  let robots = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
  let ogType = 'website';
  let ogImage = `${cleanOrigin}/og-card.svg`;
  let ogImageAlt = 'VCPL Tools — Free Offline Browser Utilities for Banking, GST, PDF & Finance';
  let noscriptHtml = '';
  let articleMetaTags = '';
  const breadcrumbItems: Array<{ name: string; item: string }> = [
    { name: 'Home', item: `${cleanOrigin}/` },
  ];

  const ldGraph: Record<string, unknown>[] = [
    {
      '@type': 'WebSite',
      name: 'VCPL Tools',
      alternateName: 'VCPL Browser Utility Suite',
      url: `${cleanOrigin}/`,
      inLanguage: 'en-IN',
      potentialAction: {
        '@type': 'SearchAction',
        target: `${cleanOrigin}/tools?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': 'Organization',
      name: 'VCPL Tools',
      url: `${cleanOrigin}/`,
      logo: {
        '@type': 'ImageObject',
        url: `${cleanOrigin}/favicon.svg`,
      },
      founder: {
        '@type': 'Person',
        name: 'Arjun Bangera',
        email: SITE_CONTACT.developerEmail,
        jobTitle: 'Designer & Lead Developer',
      },
      contributor: {
        '@type': 'Person',
        name: 'Kaushik Bangera',
        email: SITE_CONTACT.ideationEmail,
        jobTitle: 'Product Ideas & Tool Requirements Architect',
      },
    },
  ];

  if (activeBlogPost) {
    canonicalPath = getBlogPath(activeBlogPost.slug);
    title = activeBlogPost.seoTitle || `${activeBlogPost.title} | VCPL Tools`;
    description = activeBlogPost.seoDescription || activeBlogPost.excerpt;
    keywords = [...activeBlogPost.keywords, activeBlogPost.category, 'VCPL Tools'].join(', ');
    ogType = 'article';
    ogImage = `${cleanOrigin}${activeBlogPost.coverImage}`;
    ogImageAlt = activeBlogPost.coverImageAlt;

    const pubIso = toIstIsoTimestamp(activeBlogPost.publishedIso);
    const modIso = toIstIsoTimestamp(activeBlogPost.updatedIso);
    articleMetaTags = [
      `<meta property="article:published_time" content="${escapeHtml(pubIso)}" />`,
      `<meta property="article:modified_time" content="${escapeHtml(modIso)}" />`,
      `<meta property="article:section" content="${escapeHtml(activeBlogPost.category)}" />`,
      `<meta property="article:author" content="${escapeHtml(activeBlogPost.author)}" />`,
    ].join('\n    ');

    breadcrumbItems.push(
      { name: 'Blog', item: `${cleanOrigin}/blog` },
      { name: activeBlogPost.category, item: `${cleanOrigin}/blog` },
      { name: activeBlogPost.title, item: `${cleanOrigin}${canonicalPath}` }
    );

    const authorProfile = BLOG_AUTHORS[activeBlogPost.authorId];
    ldGraph.push({
      '@type': 'BlogPosting',
      headline: activeBlogPost.title,
      alternativeHeadline: title,
      description,
      datePublished: pubIso,
      dateModified: modIso,
      wordCount: estimatePostWordCount(activeBlogPost),
      articleSection: activeBlogPost.category,
      keywords,
      inLanguage: 'en-IN',
      isAccessibleForFree: true,
      image: [
        {
          '@type': 'ImageObject',
          url: ogImage,
          width: 1200,
          height: 630,
          caption: ogImageAlt,
        },
      ],
      speakable: {
        '@type': 'SpeakableSpecification',
        cssSelector: ['h1', '#key-takeaways'],
      },
      author: {
        '@type': 'Person',
        name: authorProfile?.name ?? activeBlogPost.author,
        jobTitle: authorProfile?.role ?? activeBlogPost.authorRole,
        email: authorProfile?.email,
        url: `${cleanOrigin}/blog`,
        knowsAbout: authorProfile?.expertise,
      },
      publisher: {
        '@type': 'Organization',
        name: 'VCPL Tools',
        url: `${cleanOrigin}/`,
        logo: {
          '@type': 'ImageObject',
          url: `${cleanOrigin}/favicon.svg`,
          width: 512,
          height: 512,
        },
      },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': `${cleanOrigin}${canonicalPath}`,
      },
    });

    if (activeBlogPost.faqs.length > 0) {
      ldGraph.push({
        '@type': 'FAQPage',
        mainEntity: activeBlogPost.faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
      });
    }

    const sectionSummaryHtml = activeBlogPost.sections
      .map(
        (s) =>
          `<section><h2>${escapeHtml(s.heading)}</h2>${s.paragraphs
            .slice(0, 2)
            .map((p) => `<p>${escapeHtml(p)}</p>`)
            .join('')}</section>`
      )
      .join('');
    noscriptHtml = `<noscript><article><h1>${escapeHtml(activeBlogPost.title)}</h1><p>${escapeHtml(
      description
    )}</p><p>By ${escapeHtml(activeBlogPost.author)} · Published ${escapeHtml(
      activeBlogPost.publishedLabel
    )}</p>${sectionSummaryHtml}</article></noscript>`;
  } else if (route.view === 'blog') {
    const posts = getAllBlogPosts();
    canonicalPath = '/blog';
    title = `Blog & Practical Guides (${posts.length} Articles) | VCPL Tools`;
    description =
      'Daily 9:00 AM IST practical guides on Indian GST, Income-tax Act 2025, TDS/TCS, Tally reconciliations, PF/ESI payroll, and client-side banking utilities.';
    breadcrumbItems.push({ name: 'Blog', item: `${cleanOrigin}/blog` });
    ldGraph.push({
      '@type': 'Blog',
      name: 'VCPL Tools Blog & Guides',
      url: `${cleanOrigin}/blog`,
      description,
      inLanguage: 'en-IN',
      blogPost: posts.slice(0, 30).map((post) => ({
        '@type': 'BlogPosting',
        headline: post.title,
        url: `${cleanOrigin}${getBlogPath(post.slug)}`,
        image: `${cleanOrigin}${post.coverImage}`,
        datePublished: toIstIsoTimestamp(post.publishedIso),
        dateModified: toIstIsoTimestamp(post.updatedIso),
        author: { '@type': 'Person', name: post.author },
      })),
    });
    noscriptHtml = `<noscript><main><h1>VCPL Tools Blog &amp; Practical Guides</h1><ul>${posts
      .slice(0, 25)
      .map(
        (p) =>
          `<li><a href="${escapeHtml(getBlogPath(p.slug))}">${escapeHtml(p.title)}</a> (${escapeHtml(
            p.publishedIso
          )})</li>`
      )
      .join('')}</ul></main></noscript>`;
  } else if (route.view === 'tool') {
    const tool = getToolById(route.toolId);
    if (tool) {
      canonicalPath = getToolPath(tool);
      title = `${tool.title} (${tool.statusLabel}) | VCPL Tools`;
      description = `${tool.description} Runs 100% locally in your browser on VCPL Tools.`;
      keywords = [tool.title, tool.categoryName, tool.suite, ...(tool.keywords ?? []), 'VCPL Tools'].join(
        ', '
      );
      if (tool.vaultOnly) {
        robots = 'noindex, nofollow';
      }
      breadcrumbItems.push(
        { name: tool.categoryName, item: `${cleanOrigin}${getAllToolsPath(tool.category)}` },
        { name: tool.title, item: `${cleanOrigin}${canonicalPath}` }
      );
      ldGraph.push({
        '@type': 'WebApplication',
        name: tool.title,
        url: `${cleanOrigin}${canonicalPath}`,
        image: ogImage,
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'All',
        description,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
      });
    }
  } else if (route.view === 'all-tools') {
    canonicalPath = getAllToolsPath(route.filter);
    if (route.filter === 'All') {
      title = `All ${PUBLIC_TOOLS_CATALOG.length} Free Browser Tools Directory | VCPL Tools`;
      description = `Browse all ${PUBLIC_TOOLS_CATALOG.length} client-side VCPL Tools across Banking Slips, Tax & GST, PDF Suite, Image Studio, Calculators, Google Workspace & QR Utilities.`;
      breadcrumbItems.push({ name: 'All Tools', item: `${cleanOrigin}${canonicalPath}` });
    } else {
      const catMeta = TOOL_CATEGORIES.find((c) => c.filterKey === route.filter);
      title = `${catMeta?.name ?? route.filter} | VCPL Tools`;
      description = `Use client-side ${catMeta?.name ?? route.filter} tools privately in your browser on VCPL Tools.`;
      breadcrumbItems.push(
        { name: 'All Tools', item: `${cleanOrigin}/tools` },
        { name: catMeta?.name ?? route.filter, item: `${cleanOrigin}${canonicalPath}` }
      );
    }
  } else if (route.view === 'legal') {
    const page = LEGAL_PAGES[route.slug as LegalPageSlug];
    if (page) {
      canonicalPath = getLegalPath(route.slug as LegalPageSlug);
      title = `${page.title} | VCPL Tools`;
      description = page.subtitle;
      ogType = 'article';
      breadcrumbItems.push({ name: page.navTitle, item: `${cleanOrigin}${canonicalPath}` });
    }
  } else if (route.view === 'locked' || route.view === 'not-found') {
    robots = 'noindex, nofollow';
  }

  ldGraph.push({
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbItems.map((entry, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: entry.name,
      item: entry.item,
    })),
  });

  const canonicalUrl = `${cleanOrigin}${canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`}`;
  const ldJsonPayload = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': ldGraph,
  }).replace(/</g, '\\u003c');

  let out = html;
  out = out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  out = out.replace(
    /<meta\s+name="description"[\s\S]*?\/>/i,
    `<meta name="description" content="${escapeHtml(description)}" />`
  );
  out = out.replace(
    /<meta\s+name="keywords"[\s\S]*?\/>/i,
    `<meta name="keywords" content="${escapeHtml(keywords)}" />`
  );
  out = out.replace(
    /<meta\s+name="robots"[\s\S]*?\/>/i,
    `<meta name="robots" content="${escapeHtml(robots)}" />\n    <meta name="googlebot" content="${escapeHtml(
      robots
    )}" />\n    <meta name="bingbot" content="${escapeHtml(robots)}" />`
  );
  out = out.replace(
    /<meta\s+property="og:type"[\s\S]*?\/>/i,
    `<meta property="og:type" content="${escapeHtml(ogType)}" />`
  );
  out = out.replace(
    /<meta\s+property="og:title"[\s\S]*?\/>/i,
    `<meta property="og:title" content="${escapeHtml(title)}" />`
  );
  out = out.replace(
    /<meta\s+property="og:description"[\s\S]*?\/>/i,
    `<meta property="og:description" content="${escapeHtml(description)}" />`
  );
  out = out.replace(
    /<meta\s+property="og:url"[\s\S]*?\/>/i,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`
  );
  out = out.replace(
    /<meta\s+property="og:image"\s+content="[^"]*"\s*\/>/i,
    `<meta property="og:image" content="${escapeHtml(ogImage)}" />`
  );
  out = out.replace(
    /<meta\s+property="og:image:alt"[\s\S]*?\/>/i,
    `<meta property="og:image:alt" content="${escapeHtml(ogImageAlt)}" />`
  );
  out = out.replace(
    /<meta\s+name="twitter:title"[\s\S]*?\/>/i,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`
  );
  out = out.replace(
    /<meta\s+name="twitter:description"[\s\S]*?\/>/i,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`
  );
  out = out.replace(
    /<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/>/i,
    `<meta name="twitter:image" content="${escapeHtml(ogImage)}" />`
  );
  out = out.replace(
    /<meta\s+name="twitter:image:alt"[\s\S]*?\/>/i,
    `<meta name="twitter:image:alt" content="${escapeHtml(ogImageAlt)}" />`
  );
  out = out.replace(
    /<link\s+id="vcpl-canonical"[\s\S]*?\/>/i,
    `<link id="vcpl-canonical" rel="canonical" href="${escapeHtml(canonicalUrl)}" />`
  );
  if (articleMetaTags) {
    out = out.replace('</head>', `    ${articleMetaTags}\n  </head>`);
  }
  out = out.replace(
    /<script id="vcpl-ld-json" type="application\/ld\+json">[\s\S]*?<\/script>/i,
    `<script id="vcpl-ld-json" type="application/ld+json">${ldJsonPayload}</script>`
  );
  if (noscriptHtml) {
    out = out.replace('<div id="root"></div>', `<div id="root"></div>\n    ${noscriptHtml}`);
  }
  return out;
}

export { buildSitemapXmlString };

export function registerSeoAndAdSenseRoutes(app: express.Express): void {
  const indexNowKey = getIndexNowKey();

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

  // Microsoft Bing / IndexNow domain ownership verification file
  app.get(`/${indexNowKey}.txt`, (_req, res) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(indexNowKey);
  });

  app.get('/robots.txt', (req, res) => {
    const origin = resolveRequestOrigin(req);
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

  app.get(['/rss.xml', '/feed.xml'], (req, res) => {
    void runScheduledBlogCatchUp();
    const origin = resolveRequestOrigin(req).replace(/\/+$/, '');
    const dynamicPosts = getAutoPublishedBlogPosts();
    const rss = buildRssFeedXmlString(origin, dynamicPosts);
    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=900');
    res.send(rss);
  });

  app.get('/sitemap.xml', (req, res) => {
    void runScheduledBlogCatchUp();
    const origin = resolveRequestOrigin(req).replace(/\/+$/, '');
    const dynamicPosts = getAutoPublishedBlogPosts();
    const xml = buildSitemapXmlString(origin, undefined, dynamicPosts);

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=900');
    res.send(xml);
  });
}
