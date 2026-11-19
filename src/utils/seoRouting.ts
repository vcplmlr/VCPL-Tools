import { FAQ_ITEMS } from '../components/FaqSection';
import {
  ERROR_PAGES_CONFIG,
  HttpErrorCode,
  parseHttpErrorCode,
} from '../data/errorPagesData';
import { LEGAL_PAGES, LegalPageSlug, SITE_CONTACT } from '../data/legalPagesData';
import { RTO_BY_CODE } from '../data/rtoDatabase';
import {
  TOOL_CATEGORIES,
  TOOLS_CATALOG,
  getToolById,
  getToolsForCategory,
} from '../data/toolsCatalog';
import { ToolCatalogItem, ToolFilterType } from '../types/tools';
import { normalizeRtoCodeInput } from './rtoSearch';

export const CATEGORY_SLUG_BY_FILTER: Record<Exclude<ToolFilterType, 'All'>, string> = {
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

const FILTER_BY_CATEGORY_SLUG: Record<string, ToolFilterType> = Object.entries(
  CATEGORY_SLUG_BY_FILTER
).reduce<Record<string, ToolFilterType>>((acc, [filter, slug]) => {
  acc[slug] = filter as ToolFilterType;
  return acc;
}, {});

export type ParsedRoute =
  | { view: 'home' }
  | { view: 'all-tools'; filter: ToolFilterType; initialQuery?: string }
  | { view: 'tool'; toolId: string; fullScreen?: boolean; subParam?: string }
  | { view: 'legal'; slug: LegalPageSlug }
  | { view: 'sitemap' }
  | { view: 'not-found'; path: string; statusCode?: HttpErrorCode };

const ERROR_SLUG_ALIASES: Record<string, HttpErrorCode> = {
  'bad-request': 400,
  unauthorized: 401,
  forbidden: 403,
  'not-found': 404,
  'request-timeout': 408,
  timeout: 408,
  gone: 410,
  'rate-limit': 429,
  'too-many-requests': 429,
  'server-error': 500,
  'internal-server-error': 500,
  error: 500,
  'bad-gateway': 502,
  maintenance: 503,
  unavailable: 503,
  'service-unavailable': 503,
  'gateway-timeout': 504,
};

export function getCategoryUrlSlug(filter: ToolFilterType): string {
  if (filter === 'All') return 'tools';
  return CATEGORY_SLUG_BY_FILTER[filter];
}

export function getAllToolsPath(filter: ToolFilterType = 'All'): string {
  if (filter === 'All') return '/tools';
  return `/${CATEGORY_SLUG_BY_FILTER[filter]}`;
}

export function getToolPath(tool: ToolCatalogItem): string {
  if (tool.id === 'rto-code-finder') {
    return '/tools/rto-code-finder';
  }
  if (tool.id === 'pin-code-finder') {
    return '/tools/pin-code-finder';
  }
  const categorySlug = CATEGORY_SLUG_BY_FILTER[tool.category];
  return `/${categorySlug}/${tool.id}`;
}

export function getToolFullPath(tool: ToolCatalogItem): string {
  return `${getToolPath(tool)}/full`;
}

export function getLegalPath(slug: LegalPageSlug): string {
  return `/${slug}`;
}

export function parseLocationToRoute(pathname: string, search: string): ParsedRoute {
  let initialQuery: string | undefined;
  let codeParam: string | undefined;
  let wantsFull = false;
  try {
    const params = new URLSearchParams(search);
    const fullParam = params.get('full') ?? params.get('fullscreen') ?? params.get('mode');
    wantsFull = fullParam === '1' || fullParam === 'true' || fullParam === 'full';
    const rawCode = (
      params.get('code') ??
      params.get('pincode') ??
      params.get('pin') ??
      params.get('ifsc')
    )?.trim();
    if (rawCode) {
      codeParam = rawCode.toUpperCase();
    }
    const toolParam = params.get('tool');
    if (toolParam) {
      if (getToolById(toolParam)) {
        return {
          view: 'tool',
          toolId: toolParam,
          fullScreen: wantsFull,
          subParam: codeParam,
        };
      }
      return { view: 'not-found', path: `${pathname}${search}` };
    }
    const qParam = params.get('q')?.trim();
    if (qParam) {
      initialQuery = qParam;
    }
    const statusParam = parseHttpErrorCode(params.get('status') ?? params.get('error'));
    if (statusParam) {
      return { view: 'not-found', path: `${pathname}${search}`, statusCode: statusParam };
    }
  } catch {
    // Ignore invalid search params
  }

  const normalized = pathname.replace(/\/+$/, '').toLowerCase() || '/';
  if (normalized === '/' || normalized === '/index.html') {
    if (initialQuery) {
      return { view: 'all-tools', filter: 'All', initialQuery };
    }
    return { view: 'home' };
  }

  const segments = normalized.split('/').filter(Boolean);

  if (segments.length === 1) {
    const seg = segments[0];
    const numericError = parseHttpErrorCode(seg);
    if (numericError) {
      return { view: 'not-found', path: pathname, statusCode: numericError };
    }
    if (seg in ERROR_SLUG_ALIASES) {
      return { view: 'not-found', path: pathname, statusCode: ERROR_SLUG_ALIASES[seg] };
    }
    if (
      seg === 'sitemap' ||
      seg === 'site-map' ||
      seg === 'sitemap.html' ||
      seg === 'html-sitemap'
    ) {
      return { view: 'sitemap' };
    }
    if (seg === 'tools' || seg === 'all-tools') {
      return { view: 'all-tools', filter: 'All', initialQuery };
    }
    if (seg === 'learn') {
      return {
        view: 'all-tools',
        filter: 'Learn Tools',
        initialQuery,
      };
    }
    if (FILTER_BY_CATEGORY_SLUG[seg]) {
      return {
        view: 'all-tools',
        filter: FILTER_BY_CATEGORY_SLUG[seg],
        initialQuery,
      };
    }
    if (seg === 'suggest-tool') {
      return { view: 'legal', slug: 'faq' };
    }
    if (seg in LEGAL_PAGES) {
      return { view: 'legal', slug: seg as LegalPageSlug };
    }
    const directTool = getToolById(seg);
    if (directTool) {
      return { view: 'tool', toolId: directTool.id, fullScreen: wantsFull };
    }
    if (seg === 'income-tax-fy-2026-27.html') {
      return { view: 'tool', toolId: 'income-tax-fy-2026-27', fullScreen: true };
    }
  }

  if (segments.length === 2) {
    const [catSlug, toolSlug] = segments;
    if (catSlug === 'error' || catSlug === 'errors' || catSlug === 'status') {
      const codeFromSeg = parseHttpErrorCode(toolSlug) ?? ERROR_SLUG_ALIASES[toolSlug];
      if (codeFromSeg) {
        return { view: 'not-found', path: pathname, statusCode: codeFromSeg };
      }
    }
    if (catSlug === 'tools' && toolSlug === 'ifsc-code-finder') {
      return {
        view: 'tool',
        toolId: 'bank-ifsc-finder',
        fullScreen: wantsFull,
        subParam: codeParam,
      };
    }
    const tool = getToolById(toolSlug);
    if (tool && (CATEGORY_SLUG_BY_FILTER[tool.category] === catSlug || catSlug === 'tools')) {
      return {
        view: 'tool',
        toolId: tool.id,
        fullScreen: wantsFull,
        subParam: codeParam,
      };
    }
    if (tool) {
      return {
        view: 'tool',
        toolId: tool.id,
        fullScreen: wantsFull,
        subParam: codeParam,
      };
    }
  }

  if (segments.length === 3) {
    const [firstSeg, toolSlug, thirdSeg] = segments;
    if (thirdSeg === 'full' || thirdSeg === 'fullscreen' || thirdSeg === 'standalone') {
      const tool = getToolById(toolSlug);
      if (tool) {
        return { view: 'tool', toolId: tool.id, fullScreen: true, subParam: codeParam };
      }
    }
    if (toolSlug === 'rto-code-finder' && (firstSeg === 'tools' || firstSeg === 'qr-utilities')) {
      return {
        view: 'tool',
        toolId: 'rto-code-finder',
        fullScreen: wantsFull,
        subParam: decodeURIComponent(thirdSeg).toUpperCase(),
      };
    }
    if (toolSlug === 'pin-code-finder' && (firstSeg === 'tools' || firstSeg === 'qr-utilities')) {
      return {
        view: 'tool',
        toolId: 'pin-code-finder',
        fullScreen: wantsFull,
        subParam: decodeURIComponent(thirdSeg).toUpperCase(),
      };
    }
    if (
      (toolSlug === 'ifsc-code-finder' || toolSlug === 'bank-ifsc-finder') &&
      (firstSeg === 'tools' || firstSeg === 'bank-slips')
    ) {
      return {
        view: 'tool',
        toolId: 'bank-ifsc-finder',
        fullScreen: wantsFull,
        subParam: decodeURIComponent(thirdSeg).toUpperCase(),
      };
    }
    if (firstSeg === 'assets' && toolSlug === 'aistudio') {
      const matched = TOOLS_CATALOG.find(
        (t) => t.embedHtmlPath && t.embedHtmlPath.toLowerCase().endsWith('/' + thirdSeg)
      );
      if (matched) {
        return { view: 'tool', toolId: matched.id, fullScreen: true };
      }
    }
  }

  return { view: 'not-found', path: pathname };
}

function setMetaContent(selector: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    const nameMatch = selector.match(/meta\[name="([^"]+)"\]/);
    const propMatch = selector.match(/meta\[property="([^"]+)"\]/);
    if (nameMatch || propMatch) {
      el = document.createElement('meta');
      if (nameMatch) el.setAttribute('name', nameMatch[1]);
      if (propMatch) el.setAttribute('property', propMatch[1]);
      document.head.appendChild(el);
    }
  }
  if (el) el.setAttribute('content', content);
}

export function applySeoForRoute(route: ParsedRoute) {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  const origin = window.location.origin;
  let path = '/';
  let title = 'VCPL Tools – Free Offline Banking, GST, PDF & Calc Suite';
  let description =
    'Generate SBI & HDFC bank slips, reconcile Form 26AS & GSTR-2B, edit PDFs, and run calculations locally. Designed by Arjun Bangera; ideas by Kaushik Bangera.';
  let keywords =
    'VCPL Tools, Bank Deposit Slip Generator, GST Invoice Maker, PDF to Word, PDF to Excel, Image Background Remover, Form 26AS to Excel, GSTR-2B Reconciler, Arjun Bangera, Kaushik Bangera';
  let robots =
    'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
  const breadcrumbItems: Array<{ name: string; item: string }> = [
    { name: 'Home', item: `${origin}/` },
  ];

  let listedTools: ToolCatalogItem[] | null = null;
  let includeFaqSchema = false;

  if (route.view === 'home') {
    includeFaqSchema = true;
  } else if (route.view === 'all-tools') {
    path = getAllToolsPath(route.filter);
    includeFaqSchema = true;
    if (route.filter === 'All') {
      listedTools = TOOLS_CATALOG;
      title = `All ${TOOLS_CATALOG.length} Free Browser Tools Directory | VCPL Tools`;
      description = `Browse all ${TOOLS_CATALOG.length} client-side VCPL Tools across Banking Slips, Tax & GST, GST Utilities, PDF Suite, Image Studio, Typing & Text, Calculators, and QR Utilities.`;
      breadcrumbItems.push({ name: 'All Tools', item: `${origin}${path}` });
    } else {
      const catMeta = TOOL_CATEGORIES.find((c) => c.filterKey === route.filter);
      listedTools = getToolsForCategory(route.filter);
      const count = listedTools.length;
      title = `${catMeta?.name ?? route.filter} (${count} Tools Free Offline) | VCPL Tools`;
      description = `Use all ${count} browser-based ${catMeta?.name ?? route.filter} tools privately with instant download, print & Excel export—zero server uploads.`;
      keywords = `${catMeta?.name ?? route.filter}, ${route.filter} tools, VCPL Tools, Arjun Bangera, Kaushik Bangera`;
      breadcrumbItems.push(
        { name: 'All Tools', item: `${origin}/tools` },
        { name: catMeta?.name ?? route.filter, item: `${origin}${path}` }
      );
    }
  } else if (route.view === 'tool') {
    const tool = getToolById(route.toolId);
    if (tool) {
      path = getToolPath(tool);
      const catPath = getAllToolsPath(tool.category);
      if (tool.id === 'rto-code-finder') {
        const normCode = route.subParam ? normalizeRtoCodeInput(route.subParam) : null;
        const matchedRto = normCode ? RTO_BY_CODE.get(normCode) : undefined;
        if (matchedRto) {
          path = `/tools/rto-code-finder/${matchedRto.code}`;
          title = `${matchedRto.code} RTO Code – ${matchedRto.officeName}, ${matchedRto.state} | VCPL Tools`;
          description = `Verified RTO details for ${matchedRto.code}: ${matchedRto.officeName}, District ${matchedRto.district}, City ${matchedRto.city}, ${matchedRto.state} (${matchedRto.stateCode}).`;
        } else {
          title = 'India RTO Code Finder – Search All Indian RTO Codes | VCPL Tools';
          description =
            'Find Indian Regional Transport Office (RTO) codes, office locations, states and registration authorities using vehicle registration codes.';
        }
      } else if (tool.id === 'pin-code-finder') {
        const cleanPin = route.subParam?.trim();
        if (cleanPin && /^[1-9]\d{5}$/.test(cleanPin)) {
          path = `/tools/pin-code-finder/${cleanPin}`;
          title = `${cleanPin} PIN Code – Post Offices, District & State Details | VCPL Tools`;
          description = `Look up all verified India Post offices mapped to PIN code ${cleanPin}, including delivery status, taluk, division, circle, and postal address.`;
        } else {
          title = 'India PIN Code Finder – Search All Indian PIN Codes & Post Offices | VCPL Tools';
          description =
            'Search Indian PIN codes, post offices, delivery status, taluks, districts, and postal addresses across India.';
        }
      } else if (tool.id === 'bank-ifsc-finder') {
        const cleanIfsc = route.subParam?.trim().toUpperCase();
        if (cleanIfsc && /^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleanIfsc)) {
          path = `/tools/ifsc-code-finder/${cleanIfsc}`;
          title = `${cleanIfsc} IFSC Code – Bank Branch, MICR & Address Details | VCPL Tools`;
          description = `Verify IFSC code ${cleanIfsc} including bank name, branch address, 9-digit MICR, city, district, state, NEFT/RTGS/IMPS/UPI support, and RBI validation.`;
        } else {
          title = 'India IFSC Code Finder – Search All Indian Bank Branches & MICR Codes | VCPL Tools';
          description =
            'Find 11-character Indian bank IFSC codes, branch addresses, 9-digit MICR codes, and RBI amalgamated bank details across India.';
        }
      } else {
        title = `${tool.title} (${tool.statusLabel}) | VCPL Tools`;
        description = `${tool.description} Runs 100% locally in your browser on VCPL Tools.`;
      }
      keywords = [
        tool.title,
        tool.categoryName,
        tool.suite,
        ...(tool.keywords ?? []),
        'VCPL Tools',
        'Arjun Bangera',
        'Kaushik Bangera',
      ].join(', ');
      breadcrumbItems.push(
        { name: tool.categoryName, item: `${origin}${catPath}` },
        { name: tool.title, item: `${origin}${path}` }
      );
    }
  } else if (route.view === 'legal') {
    const page = LEGAL_PAGES[route.slug];
    if (page) {
      path = getLegalPath(route.slug);
      title = `${page.title} | VCPL Tools`;
      description = page.subtitle;
      if (route.slug === 'faq') {
        includeFaqSchema = true;
      }
      breadcrumbItems.push({ name: page.navTitle, item: `${origin}${path}` });
    }
  } else if (route.view === 'sitemap') {
    path = '/sitemap';
    listedTools = TOOLS_CATALOG;
    title = `HTML & XML Sitemap (${TOOLS_CATALOG.length} Tools) | VCPL Tools`;
    description = `Complete site directory and XML sitemap for all ${TOOLS_CATALOG.length} browser-based utilities, suites, and policy pages on VCPL Tools.`;
    keywords = 'VCPL Tools sitemap, XML sitemap, all browser tools index, Arjun Bangera, Kaushik Bangera';
    breadcrumbItems.push({ name: 'Sitemap', item: `${origin}${path}` });
  } else if (route.view === 'not-found') {
    const errorCode = route.statusCode ?? 404;
    const errorMeta = ERROR_PAGES_CONFIG[errorCode] ?? ERROR_PAGES_CONFIG[404];
    path = route.path || `/${errorMeta.code}`;
    title = `${errorMeta.code} – ${errorMeta.shortTitle} | VCPL Tools`;
    description = `${errorMeta.headline} ${errorMeta.description} Explore all ${TOOLS_CATALOG.length} client-side banking, tax, PDF, image, and calculator utilities.`;
    robots = 'noindex, nofollow';
  }

  const canonicalUrl =
    route.view === 'tool' && route.fullScreen
      ? `${origin}${getToolPath(getToolById(route.toolId) ?? TOOLS_CATALOG[0])}`
      : `${origin}${path}`;
  const currentUrl =
    route.view === 'tool' && route.fullScreen
      ? `${origin}${getToolFullPath(getToolById(route.toolId) ?? TOOLS_CATALOG[0])}`
      : canonicalUrl;
  const ogImageUrl = `${origin}/og-card.svg`;
  const ogType = route.view === 'legal' ? 'article' : 'website';

  document.title = title;
  setMetaContent('meta[name="description"]', description);
  setMetaContent('meta[name="keywords"]', keywords);
  setMetaContent('meta[name="robots"]', robots);
  setMetaContent('meta[property="og:site_name"]', 'VCPL Tools');
  setMetaContent('meta[property="og:locale"]', 'en_IN');
  setMetaContent('meta[property="og:type"]', ogType);
  setMetaContent('meta[property="og:title"]', title);
  setMetaContent('meta[property="og:description"]', description);
  setMetaContent('meta[property="og:url"]', currentUrl);
  setMetaContent('meta[property="og:image"]', ogImageUrl);
  setMetaContent('meta[property="og:image:alt"]', `${title} — VCPL Tools`);
  setMetaContent('meta[name="twitter:card"]', 'summary_large_image');
  setMetaContent('meta[name="twitter:title"]', title);
  setMetaContent('meta[name="twitter:description"]', description);
  setMetaContent('meta[name="twitter:image"]', ogImageUrl);
  setMetaContent('meta[name="twitter:image:alt"]', `${title} — VCPL Tools`);

  const canonicalLink = document.getElementById('vcpl-canonical') as HTMLLinkElement | null;
  if (canonicalLink) {
    canonicalLink.href = canonicalUrl;
  }

  const ldScript = document.getElementById('vcpl-ld-json');
  if (ldScript) {
    const activeToolObj = route.view === 'tool' ? getToolById(route.toolId) : undefined;
    const graph: Record<string, unknown>[] = [
      {
        '@type': 'WebSite',
        name: 'VCPL Tools',
        alternateName: 'VCPL Browser Utility Suite',
        url: `${origin}/`,
        inLanguage: 'en-IN',
        potentialAction: {
          '@type': 'SearchAction',
          target: `${origin}/tools?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'Organization',
        name: 'VCPL Tools',
        url: `${origin}/`,
        logo: `${origin}/favicon.svg`,
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
        contactPoint: {
          '@type': 'ContactPoint',
          email: SITE_CONTACT.ideationEmail,
          telephone: SITE_CONTACT.whatsappDisplay,
          contactType: 'customer support',
          areaServed: 'IN',
          availableLanguage: ['en', 'hi', 'kn'],
        },
      },
      {
        '@type': 'WebApplication',
        name: activeToolObj?.title ?? 'VCPL Tools',
        url: canonicalUrl,
        image: ogImageUrl,
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'All',
        description,
        creator: {
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
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'INR',
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbItems.map((entry, idx) => ({
          '@type': 'ListItem',
          position: idx + 1,
          name: entry.name,
          item: entry.item,
        })),
      },
    ];

    if (listedTools && listedTools.length > 0) {
      graph.push({
        '@type': 'CollectionPage',
        name: title,
        url: canonicalUrl,
        description,
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: listedTools.length,
          itemListElement: listedTools.slice(0, TOOLS_CATALOG.length).map((tool, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: tool.title,
            url: `${origin}${getToolPath(tool)}`,
          })),
        },
      });
    }

    if (includeFaqSchema) {
      graph.push({
        '@type': 'FAQPage',
        mainEntity: FAQ_ITEMS.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
      });
    }

    ldScript.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': graph,
    });
  }
}
