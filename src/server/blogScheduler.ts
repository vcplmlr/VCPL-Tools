import { GoogleGenAI, Type } from '@google/genai';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  BLOG_AUTHORS,
  BLOG_POSTS,
  estimatePostReadingStats,
} from '../data/blogPostsData.ts';
import { EDITORIAL_TOPICS_QUEUE, EditorialRoadmapItem } from '../data/blogTopicsHub.ts';
import { PUBLIC_TOOLS_CATALOG } from '../data/toolsCatalog.ts';
import { BlogArticleSection, BlogCategory, BlogCoverTheme, BlogPostItem } from '../types/blog.ts';
import { buildBlogCoverSvg } from '../utils/blogCoverSvg.ts';
import { DEFAULT_SITE_ORIGIN, getBlogPath } from '../utils/seoConfig.ts';
import { getDb } from './db.ts';

const LAUNCH_IST_DATE = '2026-11-23';
export const PUBLISH_HOUR_IST = 9;
export const PUBLISH_MINUTE_IST = 0;
export const PUBLISH_MINUTES_IST = PUBLISH_HOUR_IST * 60 + PUBLISH_MINUTE_IST; // 09:00 AM IST exact
const SCHEDULER_POLL_MS = 60_000;

const VERIFIED_TOOL_IDS = PUBLIC_TOOLS_CATALOG.map((t) => t.id);

const COVER_THEME_BY_CATEGORY: Record<BlogCategory, BlogCoverTheme> = {
  GST: 'gst',
  'Income Tax': 'tax',
  'TDS & TCS': 'tax',
  Accounting: 'calendar',
  'Excel Templates': 'tax',
  'PF & ESI': 'payroll',
  'ROC & MCA': 'calendar',
  'Business & Career': 'banking',
  'Banking & UPI': 'banking',
  'PDF & Privacy': 'pdf',
  'Regional Tech': 'tulu',
};

const AUTHOR_BY_CATEGORY: Record<BlogCategory, BlogPostItem['authorId']> = {
  GST: 'kaushik-bangera',
  'Income Tax': 'kaushik-bangera',
  'TDS & TCS': 'kaushik-bangera',
  Accounting: 'kaushik-bangera',
  'Excel Templates': 'kaushik-bangera',
  'PF & ESI': 'kaushik-bangera',
  'ROC & MCA': 'kaushik-bangera',
  'Business & Career': 'kaushik-bangera',
  'Banking & UPI': 'kaushik-bangera',
  'PDF & Privacy': 'arjun-bangera',
  'Regional Tech': 'kaushik-bangera',
};

export interface BlogSchedulerStatus {
  istDate: string;
  istTimeLabel: string;
  scheduleTimeIst: string;
  apiKeyConfigured: boolean;
  publishedToday: boolean;
  totalAutoPosts: number;
  totalAllPosts: number;
  pendingTopicsCount: number;
  nextTopic: { no: number; slug: string; title: string } | null;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastPublishedSlug: string | null;
  lastError: string | null;
  lastIndexNowStatus: string | null;
}

let catchUpInFlight: Promise<number> | null = null;
let schedulerStarted = false;
let missingKeyWarned = false;
let exactMorningTimer: ReturnType<typeof setTimeout> | null = null;

export function getIndexNowKey(): string {
  const configured = (process.env.INDEXNOW_KEY || '').trim();
  if (/^[a-zA-Z0-9-]{8,128}$/.test(configured)) {
    return configured;
  }
  const seed =
    process.env.VCPL_ADMIN_SECRET?.trim() ||
    process.env.PUBLIC_SITE_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    DEFAULT_SITE_ORIGIN;
  return crypto.createHash('sha256').update(`vcpl-indexnow:${seed}`).digest('hex').slice(0, 32);
}

export function resolvePublicSiteOrigin(): string {
  const candidates = [
    process.env.PUBLIC_SITE_URL,
    process.env.APP_URL,
    DEFAULT_SITE_ORIGIN,
  ];
  for (const raw of candidates) {
    const clean = (raw || '').trim().replace(/\/+$/, '');
    if (clean && /^https?:\/\//i.test(clean)) {
      return clean;
    }
  }
  return DEFAULT_SITE_ORIGIN;
}

export function getCurrentIstClock(now: Date = new Date()): {
  istDate: string;
  minutesSinceMidnight: number;
  hour: number;
  minute: number;
  second: number;
} {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '00';

  const year = get('year');
  const month = get('month');
  const day = get('day');
  let hour = Number.parseInt(get('hour'), 10);
  if (hour === 24) hour = 0;
  const minute = Number.parseInt(get('minute'), 10);
  const second = Number.parseInt(get('second'), 10);

  return {
    istDate: `${year}-${month}-${day}`,
    minutesSinceMidnight: hour * 60 + minute,
    hour,
    minute,
    second,
  };
}

function parseIsoDayNumber(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map((n) => Number.parseInt(n, 10));
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

function addIsoDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map((n) => Number.parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function formatDisplayDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map((n) => Number.parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function normalizeBlogId(raw: string, fallbackIndex: number): string {
  const clean = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return clean || `section-${fallbackIndex + 1}`;
}

function clampOnWordBoundary(text: string, maxLen: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  const sliced = clean.slice(0, maxLen);
  const lastSpace = sliced.lastIndexOf(' ');
  return (lastSpace > Math.floor(maxLen * 0.6) ? sliced.slice(0, lastSpace) : sliced).trim();
}

function formatSeoTitle(rawTitle: string | undefined, fallbackTitle: string): string {
  const candidate = (rawTitle || '').replace(/\s+/g, ' ').trim() || fallbackTitle;
  const withBrand = /vcpl tools/i.test(candidate) ? candidate : `${candidate} | VCPL Tools`;
  if (withBrand.length <= 60) return withBrand;
  const suffix = ' | VCPL Tools';
  const baseOnly = candidate.replace(/\s*[|\-–]\s*VCPL Tools.*$/i, '').trim();
  const maxBase = 60 - suffix.length;
  if (maxBase >= 22) {
    return `${clampOnWordBoundary(baseOnly, maxBase)}${suffix}`;
  }
  return clampOnWordBoundary(candidate, 60);
}

function formatSeoDescription(
  rawDesc: string | undefined,
  fallbackExcerpt: string,
  title: string
): string {
  const base = (rawDesc || fallbackExcerpt || title).replace(/\s+/g, ' ').trim();
  if (base.length <= 160) return base;
  return `${clampOnWordBoundary(base, 157)}.`;
}

function saveSchedulerState(patch: Partial<Record<string, unknown>>): void {
  try {
    const db = getDb();
    const existingRow = db
      .prepare(`SELECT value FROM app_settings WHERE key = 'blog_scheduler_status'`)
      .get() as { value?: string } | undefined;
    const prev = existingRow?.value ? (JSON.parse(existingRow.value) as Record<string, unknown>) : {};
    const next = { ...prev, ...patch };
    db.prepare(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES ('blog_scheduler_status', ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    ).run(JSON.stringify(next), new Date().toISOString());
  } catch {
    // Non-fatal state telemetry persistence
  }
}

function readSchedulerState(): Record<string, unknown> {
  try {
    const db = getDb();
    const row = db
      .prepare(`SELECT value FROM app_settings WHERE key = 'blog_scheduler_status'`)
      .get() as { value?: string } | undefined;
    return row?.value ? (JSON.parse(row.value) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function getAutoPublishedBlogPosts(): BlogPostItem[] {
  try {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT post_json FROM auto_blog_posts ORDER BY published_ist_date DESC, queue_no DESC`
      )
      .all() as Array<{ post_json?: string }>;

    const parsed: BlogPostItem[] = [];
    for (const row of rows) {
      if (!row.post_json) continue;
      try {
        const post = JSON.parse(row.post_json) as BlogPostItem;
        const resolvedAuthorId = AUTHOR_BY_CATEGORY[post.category] ?? 'kaushik-bangera';
        const resolvedProfile = BLOG_AUTHORS[resolvedAuthorId];
        parsed.push({
          ...post,
          authorId: resolvedAuthorId,
          author: resolvedProfile.name,
          authorRole: resolvedProfile.role,
        });
      } catch {
        // Ignore malformed row
      }
    }
    return parsed;
  } catch {
    return [];
  }
}

export function getAutoPublishedBlogPostBySlug(slug: string): BlogPostItem | undefined {
  try {
    const db = getDb();
    const row = db
      .prepare(`SELECT post_json FROM auto_blog_posts WHERE slug = ? LIMIT 1`)
      .get(slug) as { post_json?: string } | undefined;
    if (!row?.post_json) return undefined;
    const post = JSON.parse(row.post_json) as BlogPostItem;
    const resolvedAuthorId = AUTHOR_BY_CATEGORY[post.category] ?? 'kaushik-bangera';
    const resolvedProfile = BLOG_AUTHORS[resolvedAuthorId];
    return {
      ...post,
      authorId: resolvedAuthorId,
      author: resolvedProfile.name,
      authorRole: resolvedProfile.role,
    };
  } catch {
    return undefined;
  }
}

export function getAutoPublishedCoverSvg(slug: string): string | null {
  try {
    const db = getDb();
    const row = db
      .prepare(`SELECT cover_svg FROM auto_blog_posts WHERE slug = ? LIMIT 1`)
      .get(slug) as { cover_svg?: string } | undefined;
    return row?.cover_svg ? row.cover_svg : null;
  } catch {
    return null;
  }
}

function collectSiblingSlugs(category: BlogCategory, currentSlug: string): string[] {
  const dbSlugs = getAutoPublishedBlogPosts()
    .filter((p) => p.slug !== currentSlug)
    .map((p) => ({ slug: p.slug, category: p.category }));
  const staticSlugs = BLOG_POSTS.filter((p) => p.slug !== currentSlug).map((p) => ({
    slug: p.slug,
    category: p.category,
  }));
  const pool = [...dbSlugs, ...staticSlugs];
  const sameCategory = pool.filter((p) => p.category === category).map((p) => p.slug);
  const fallback = pool.map((p) => p.slug);
  return Array.from(new Set([...sameCategory, ...fallback])).slice(0, 3);
}

function sanitizeInternalLinks(text: string, validBlogSlugs: Set<string>, fallbackToolId: string): string {
  const validToolSet = new Set<string>(VERIFIED_TOOL_IDS);
  return text.replace(/\[([^\]]+)\]\((#(tool|blog):([^)]+))\)/g, (_full, label, _target, kind, id) => {
    if (kind === 'tool') {
      const resolvedId = validToolSet.has(id) ? id : fallbackToolId;
      return `[${label}](#tool:${resolvedId})`;
    }
    if (validBlogSlugs.has(id)) {
      return `[${label}](#blog:${id})`;
    }
    return label;
  });
}

async function notifySearchEnginesOfNewPost(post: BlogPostItem): Promise<string> {
  const origin = resolvePublicSiteOrigin();
  const host = new URL(origin).host;
  const key = getIndexNowKey();
  const keyLocation = `${origin}/${key}.txt`;
  const urlList = [
    `${origin}${getBlogPath(post.slug)}`,
    `${origin}/blog`,
    `${origin}/sitemap.xml`,
    `${origin}/rss.xml`,
  ];

  // Skip notifying live public search engines when running exclusively on localhost
  if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/i.test(host)) {
    const status = `Skipped IndexNow for local host (${host})`;
    saveSchedulerState({ lastIndexNowStatus: status });
    return status;
  }

  try {
    const response = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host, key, keyLocation, urlList }),
      signal: AbortSignal.timeout(6000),
    });
    const status = `IndexNow HTTP ${response.status} at ${new Date().toISOString()}`;
    saveSchedulerState({ lastIndexNowStatus: status });
    return status;
  } catch (err) {
    const status = `IndexNow notify error: ${err instanceof Error ? err.message : String(err)}`;
    saveSchedulerState({ lastIndexNowStatus: status });
    return status;
  }
}

interface GeneratedArticlePayload {
  seoTitle: string;
  seoDescription: string;
  excerpt: string;
  readTime: string;
  coverBadge: string;
  keywords: string[];
  keyTakeaways: string[];
  sections: Array<{
    id: string;
    heading: string;
    paragraphs: string[];
    bullets?: string[];
    proTip?: string;
    table?: {
      title: string;
      headers: string[];
      rows: string[][];
    };
    subsections?: Array<{
      id: string;
      heading: string;
      paragraphs: string[];
      bullets?: string[];
    }>;
  }>;
  faqs: Array<{
    question: string;
    answer: string;
  }>;
  conclusion: string[];
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateWithRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        const delayMs = 1500 * Math.pow(2, attempt - 1);
        await sleepMs(delayMs);
      }
    }
  }
  throw lastError;
}

async function generateArticleWithGemini(
  topic: EditorialRoadmapItem,
  slotIstDate: string
): Promise<BlogPostItem | null> {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    if (!missingKeyWarned) {
      missingKeyWarned = true;
      console.warn(
        '[VCPL Blog Scheduler] GEMINI_API_KEY is not configured in Settings > Secrets; pending daily articles await key configuration.'
      );
    }
    saveSchedulerState({
      apiKeyConfigured: false,
      lastAttemptAt: new Date().toISOString(),
      lastError: 'GEMINI_API_KEY is not configured in server secrets.',
    });
    return null;
  }
  missingKeyWarned = false;

  const authorId = AUTHOR_BY_CATEGORY[topic.category] ?? 'kaushik-bangera';
  const authorProfile = BLOG_AUTHORS[authorId];
  const coverTheme = COVER_THEME_BY_CATEGORY[topic.category] ?? 'tax';
  const defaultToolId =
    topic.relatedToolId && VERIFIED_TOOL_IDS.includes(topic.relatedToolId)
      ? topic.relatedToolId
      : 'gstr1-return-prep';
  const relatedToolIds = Array.from(
    new Set(
      [defaultToolId, 'tds-tcs-toolkit', 'form-26as-to-excel'].filter((id) =>
        VERIFIED_TOOL_IDS.includes(id)
      )
    )
  ).slice(0, 3);

  const availableBlogSlugs = Array.from(
    new Set([
      ...BLOG_POSTS.map((p) => p.slug),
      ...getAutoPublishedBlogPosts().map((p) => p.slug),
    ])
  ).filter((slug) => slug !== topic.slug);
  const validBlogSlugSet = new Set(availableBlogSlugs);

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });

  const prompt = [
    `You are ${authorProfile.name} (${authorProfile.role}), writing a comprehensive, 100% India-specific, E-E-A-T compliant guide for VCPL Tools adhering strictly to Google Search Essentials and Microsoft Bing Webmaster ranking protocols.`,
    `Article Title: ${topic.title}`,
    `Primary Category / Topic Head: ${topic.category}`,
    `Publish Date (IST): ${slotIstDate} (09:00 AM IST)`,
    `Target Audience: Indian Accountants, CA Firms, Tax Consultants, GST Practitioners, and Finance Managers.`,
    `Google & Bing SEO Ranking Requirements:`,
    `- seoTitle: 48 to 60 characters max, primary search keyword front-loaded, ending with " | VCPL Tools".`,
    `- seoDescription: 135 to 158 characters, clear benefit + "FY 2026-27" or Indian statutory context + actionable CTA.`,
    `- excerpt: 40 to 58 words formatted as a direct Featured Snippet answer summarizing the core solution clearly.`,
    `- keywords: 6 to 8 specific, realistic high-intent Indian search terms (no keyword stuffing).`,
    `- Content Depth & E-E-A-T: 1,600 to 2,200 words total aligned with FY 2026-27 Indian rules (GST Act, Income-tax Act 2025 & 1961 transition, TRACES Form 26AS / Form 138 / Form 140 / Form 143, EPF/ESIC, MCA, TallyPrime, Excel). Cite statutory sections and realistic INR numerical worked examples.`,
    `- Heading Hierarchy: 5 to 6 structured H2 sections with optional focused H3 subsections (subsections array) and scannable bullet checklists.`,
    `- Structured Data Tables: Include at least 2 detailed comparison, rate, journal-entry, or due-date tables inside sections.`,
    `- Internal Links (Verified Only): Include natural contextual links in prose using exact markdown syntax [Label](#tool:ID) or [Label](#blog:SLUG). Valid tool IDs: ${VERIFIED_TOOL_IDS.slice(0, 18).join(', ')}. Valid blog slugs: ${availableBlogSlugs.slice(0, 8).join(', ')}.`,
    `- FAQ Rich Snippets: Include 5 to 6 concise People-Also-Ask style questions & direct answers (40-80 words each) suitable for Google/Bing FAQPage Schema.org markup.`,
    `- Return clean JSON strictly matching the schema.`,
  ].join('\n');

  const response = await generateWithRetry(() =>
    ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            seoTitle: { type: Type.STRING },
            seoDescription: { type: Type.STRING },
            excerpt: { type: Type.STRING },
            readTime: { type: Type.STRING },
            coverBadge: { type: Type.STRING },
            keywords: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            keyTakeaways: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            sections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  heading: { type: Type.STRING },
                  paragraphs: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  bullets: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  proTip: { type: Type.STRING },
                  table: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      headers: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                      rows: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.ARRAY,
                          items: { type: Type.STRING },
                        },
                      },
                    },
                    required: ['title', 'headers', 'rows'],
                  },
                  subsections: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        heading: { type: Type.STRING },
                        paragraphs: {
                          type: Type.ARRAY,
                          items: { type: Type.STRING },
                        },
                        bullets: {
                          type: Type.ARRAY,
                          items: { type: Type.STRING },
                        },
                      },
                      required: ['id', 'heading', 'paragraphs'],
                    },
                  },
                },
                required: ['id', 'heading', 'paragraphs'],
              },
            },
            faqs: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  answer: { type: Type.STRING },
                },
                required: ['question', 'answer'],
              },
            },
            conclusion: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: [
            'seoTitle',
            'seoDescription',
            'excerpt',
            'readTime',
            'coverBadge',
            'keywords',
            'keyTakeaways',
            'sections',
            'faqs',
            'conclusion',
          ],
        },
      },
    })
  );

  const rawText = response.text?.trim();
  if (!rawText) {
    throw new Error(`Empty response from Gemini for slug "${topic.slug}"`);
  }

  const parsed = JSON.parse(rawText) as GeneratedArticlePayload;
  const dateLabel = formatDisplayDate(slotIstDate);
  const usedIds = new Set<string>();
  const claimUniqueId = (raw: string, fallbackIndex: number): string => {
    const base = normalizeBlogId(raw, fallbackIndex);
    let candidate = base;
    let n = 2;
    while (usedIds.has(candidate)) {
      candidate = `${base}-${n++}`;
    }
    usedIds.add(candidate);
    return candidate;
  };

  const normalizedSections: BlogArticleSection[] = (parsed.sections || []).map((sec, idx) => {
    const blocks: BlogArticleSection['blocks'] = [];
    if (
      sec.table &&
      Array.isArray(sec.table.headers) &&
      sec.table.headers.length > 0 &&
      Array.isArray(sec.table.rows) &&
      sec.table.rows.length > 0
    ) {
      const colCount = sec.table.headers.length;
      const safeRows = sec.table.rows.map((row) =>
        Array.from({ length: colCount }, (_, cIdx) =>
          sanitizeInternalLinks(String(row[cIdx] ?? '—'), validBlogSlugSet, defaultToolId)
        )
      );
      blocks.push({
        type: 'table',
        title: sec.table.title,
        headers: sec.table.headers.map((h) => String(h)),
        rows: safeRows,
      });
    }

    const subsections =
      Array.isArray(sec.subsections) && sec.subsections.length > 0
        ? sec.subsections
            .filter((sub) => sub?.heading && Array.isArray(sub.paragraphs))
            .map((sub, sIdx) => ({
              id: claimUniqueId(sub.id || sub.heading, idx * 10 + sIdx),
              heading: sub.heading.trim(),
              paragraphs: sub.paragraphs
                .filter(Boolean)
                .map((p) => sanitizeInternalLinks(p, validBlogSlugSet, defaultToolId)),
              bullets:
                Array.isArray(sub.bullets) && sub.bullets.length > 0
                  ? sub.bullets
                      .filter(Boolean)
                      .map((b) => sanitizeInternalLinks(b, validBlogSlugSet, defaultToolId))
                  : undefined,
            }))
        : undefined;

    return {
      id: claimUniqueId(sec.id || sec.heading, idx),
      heading: sec.heading.trim(),
      paragraphs: Array.isArray(sec.paragraphs)
        ? sec.paragraphs
            .filter(Boolean)
            .map((p) => sanitizeInternalLinks(p, validBlogSlugSet, defaultToolId))
        : [],
      bullets:
        Array.isArray(sec.bullets) && sec.bullets.length > 0
          ? sec.bullets
              .filter(Boolean)
              .map((b) => sanitizeInternalLinks(b, validBlogSlugSet, defaultToolId))
          : undefined,
      proTip: sec.proTip?.trim()
        ? sanitizeInternalLinks(sec.proTip.trim(), validBlogSlugSet, defaultToolId)
        : undefined,
      blocks: blocks.length > 0 ? blocks : undefined,
      subsections,
    };
  });

  const cleanExcerpt = (parsed.excerpt || topic.title).replace(/\s+/g, ' ').trim();
  const dedupKeywords = Array.from(
    new Set(
      (Array.isArray(parsed.keywords) ? parsed.keywords : [])
        .map((k) => String(k).trim())
        .filter(Boolean)
    )
  ).slice(0, 8);

  const post: BlogPostItem = {
    slug: topic.slug,
    title: topic.title,
    seoTitle: formatSeoTitle(parsed.seoTitle, topic.title),
    excerpt: cleanExcerpt,
    seoDescription: formatSeoDescription(parsed.seoDescription, cleanExcerpt, topic.title),
    category: topic.category,
    coverImage: `/blog/${topic.slug}.svg`,
    coverImageAlt: `${topic.title} — ${topic.category} practical reference guide cover on VCPL Tools`,
    coverTheme,
    coverBadge: (parsed.coverBadge || `${topic.category.toUpperCase()} GUIDE`).slice(0, 32),
    publishedIso: slotIstDate,
    publishedLabel: dateLabel,
    updatedIso: slotIstDate,
    updatedLabel: dateLabel,
    readTime: parsed.readTime?.trim() || '8 min read',
    authorId,
    author: authorProfile.name,
    authorRole: authorProfile.role,
    keywords: dedupKeywords.length > 0 ? dedupKeywords : [topic.title, topic.category, 'VCPL Tools'],
    relatedToolIds,
    relatedSlugs: collectSiblingSlugs(topic.category, topic.slug),
    keyTakeaways: Array.isArray(parsed.keyTakeaways)
      ? parsed.keyTakeaways
          .filter(Boolean)
          .slice(0, 6)
          .map((t) => sanitizeInternalLinks(t, validBlogSlugSet, defaultToolId))
      : [],
    sections: normalizedSections,
    faqs: Array.isArray(parsed.faqs) ? parsed.faqs.slice(0, 8) : [],
    conclusion: Array.isArray(parsed.conclusion)
      ? parsed.conclusion
          .filter(Boolean)
          .map((c) => sanitizeInternalLinks(c, validBlogSlugSet, defaultToolId))
      : undefined,
    disclaimer:
      'Editorial Reference Note: Verify applicability against current CBIC notifications, CBDT circulars, and TRACES schema rules before final statutory filing.',
  };

  post.readTime = estimatePostReadingStats(post).formattedTime;
  return post;
}

function savePublishedPost(post: BlogPostItem, queueNo: number): void {
  const db = getDb();
  const coverSvg = buildBlogCoverSvg(post);
  const nowIso = new Date().toISOString();

  db.prepare(
    `INSERT OR IGNORE INTO auto_blog_posts (slug, queue_no, published_ist_date, post_json, cover_svg, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(post.slug, queueNo, post.publishedIso, JSON.stringify(post), coverSvg, nowIso);

  // Best-effort disk copy inside public/blog for static serving
  try {
    const blogPublicDir = path.resolve(process.cwd(), 'public', 'blog');
    if (!fs.existsSync(blogPublicDir)) {
      fs.mkdirSync(blogPublicDir, { recursive: true });
    }
    fs.writeFileSync(path.join(blogPublicDir, `${post.slug}.svg`), coverSvg, 'utf8');
  } catch {
    // Non-fatal on read-only serverless filesystems; seoRoutes serves directly from SQLite fallback
  }

  saveSchedulerState({
    apiKeyConfigured: true,
    lastSuccessAt: nowIso,
    lastPublishedSlug: post.slug,
    lastError: null,
  });

  // Notify Microsoft Bing IndexNow & partner search engines cleanly in background
  void notifySearchEnginesOfNewPost(post);
}

export async function runScheduledBlogCatchUp(options?: {
  forceTodayIfBeforeNine?: boolean;
}): Promise<number> {
  if (catchUpInFlight) {
    return catchUpInFlight;
  }

  catchUpInFlight = (async () => {
    let newlyPublished = 0;
    try {
      const db = getDb();
      const { istDate: todayIstDate, minutesSinceMidnight } = getCurrentIstClock();
      const launchDay = parseIsoDayNumber(LAUNCH_IST_DATE);
      const todayDay = parseIsoDayNumber(todayIstDate);
      const maxElapsedOffset = todayDay - launchDay;

      if (maxElapsedOffset < 1) {
        return 0;
      }

      // Compute all daily 09:00 AM IST slots due from LAUNCH_IST_DATE + 1 up to today
      const dueSlotDates: string[] = [];
      for (let offset = 1; offset <= maxElapsedOffset; offset += 1) {
        const slotDate = addIsoDays(LAUNCH_IST_DATE, offset);
        const isPastDay = offset < maxElapsedOffset;
        const isTodayDue =
          offset === maxElapsedOffset &&
          (options?.forceTodayIfBeforeNine || minutesSinceMidnight >= PUBLISH_MINUTES_IST);
        if (isPastDay || isTodayDue) {
          dueSlotDates.push(slotDate);
        }
      }

      if (dueSlotDates.length === 0) {
        return 0;
      }

      const existingRows = db
        .prepare(`SELECT slug, published_ist_date FROM auto_blog_posts`)
        .all() as Array<{ slug: string; published_ist_date: string }>;

      const publishedSlugs = new Set<string>([
        ...BLOG_POSTS.map((p) => p.slug),
        ...existingRows.map((r) => r.slug),
      ]);
      const filledSlotDates = new Set<string>([
        ...existingRows.map((r) => r.published_ist_date),
        ...BLOG_POSTS.filter((p) => p.publishedIso > LAUNCH_IST_DATE).map((p) => p.publishedIso),
      ]);

      const missingSlotDates = dueSlotDates.filter((d) => !filledSlotDates.has(d));
      if (missingSlotDates.length === 0) {
        return 0;
      }

      const pendingTopics = EDITORIAL_TOPICS_QUEUE.filter((item) => !publishedSlugs.has(item.slug));
      if (pendingTopics.length === 0) {
        return 0;
      }

      saveSchedulerState({ lastAttemptAt: new Date().toISOString() });

      const pairsCount = Math.min(missingSlotDates.length, pendingTopics.length);
      for (let idx = 0; idx < pairsCount; idx += 1) {
        const slotDate = missingSlotDates[idx];
        const topic = pendingTopics[idx];

        try {
          const generatedPost = await generateArticleWithGemini(topic, slotDate);
          if (!generatedPost) {
            // API key absent; wait until GEMINI_API_KEY is configured in Settings > Secrets
            break;
          }
          savePublishedPost(generatedPost, topic.no);
          publishedSlugs.add(topic.slug);
          filledSlotDates.add(slotDate);
          newlyPublished += 1;
          console.log(
            `[VCPL Blog Scheduler] Auto-published #${topic.no} "${topic.slug}" for ${slotDate} (09:00 AM IST slot).`
          );
        } catch (err) {
          const errMessage = err instanceof Error ? err.message : String(err);
          saveSchedulerState({
            lastAttemptAt: new Date().toISOString(),
            lastError: errMessage,
          });
          console.error(
            `[VCPL Blog Scheduler] Failed publishing #${topic.no} "${topic.slug}" for ${slotDate}:`,
            err
          );
          break;
        }
      }
    } catch (err) {
      console.error('[VCPL Blog Scheduler] Catch-up check failed:', err);
    } finally {
      catchUpInFlight = null;
    }
    return newlyPublished;
  })();

  return catchUpInFlight;
}

export function getBlogSchedulerStatus(): BlogSchedulerStatus {
  const { istDate, hour, minute, second } = getCurrentIstClock();
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  const apiKeyConfigured = Boolean(apiKey && apiKey !== 'MY_GEMINI_API_KEY');
  const autoPosts = getAutoPublishedBlogPosts();
  const publishedSlugs = new Set<string>([
    ...BLOG_POSTS.map((p) => p.slug),
    ...autoPosts.map((p) => p.slug),
  ]);
  const publishedDates = new Set<string>([
    ...BLOG_POSTS.map((p) => p.publishedIso),
    ...autoPosts.map((p) => p.publishedIso),
  ]);
  const pendingTopics = EDITORIAL_TOPICS_QUEUE.filter((t) => !publishedSlugs.has(t.slug));
  const next = pendingTopics[0] ?? null;
  const saved = readSchedulerState();

  return {
    istDate,
    istTimeLabel: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')} IST`,
    scheduleTimeIst: '09:00 AM IST',
    apiKeyConfigured,
    publishedToday: publishedDates.has(istDate),
    totalAutoPosts: autoPosts.length,
    totalAllPosts: publishedSlugs.size,
    pendingTopicsCount: pendingTopics.length,
    nextTopic: next ? { no: next.no, slug: next.slug, title: next.title } : null,
    lastAttemptAt: typeof saved.lastAttemptAt === 'string' ? saved.lastAttemptAt : null,
    lastSuccessAt: typeof saved.lastSuccessAt === 'string' ? saved.lastSuccessAt : null,
    lastPublishedSlug: typeof saved.lastPublishedSlug === 'string' ? saved.lastPublishedSlug : null,
    lastError: typeof saved.lastError === 'string' ? saved.lastError : null,
    lastIndexNowStatus:
      typeof saved.lastIndexNowStatus === 'string' ? saved.lastIndexNowStatus : null,
  };
}

function scheduleNextExactMorningTrigger(): void {
  if (exactMorningTimer) {
    clearTimeout(exactMorningTimer);
    exactMorningTimer = null;
  }

  const { istDate, hour, minute, second } = getCurrentIstClock();
  const nowSecondsIst = hour * 3600 + minute * 60 + second;
  const targetSecondsIst = PUBLISH_HOUR_IST * 3600 + PUBLISH_MINUTE_IST * 60 + 2; // 09:00:02 IST
  let deltaSeconds = targetSecondsIst - nowSecondsIst;
  if (deltaSeconds <= 0) {
    // Next day 09:00:02 IST
    deltaSeconds += 86_400;
  }
  const delayMs = Math.max(5_000, deltaSeconds * 1000);

  exactMorningTimer = setTimeout(() => {
    void runScheduledBlogCatchUp().finally(() => {
      scheduleNextExactMorningTrigger();
    });
  }, delayMs);

  if (typeof exactMorningTimer.unref === 'function') {
    exactMorningTimer.unref();
  }

  const nextTargetDate = deltaSeconds > 86_400 - nowSecondsIst ? addIsoDays(istDate, 1) : istDate;
  console.log(
    `[VCPL Blog Scheduler] Next exact 09:00 AM IST trigger armed for ${nextTargetDate} (in ${Math.round(
      delayMs / 60_000
    )} min).`
  );
}

export function startBackendBlogScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;

  // Run initial missed-day catch-up check shortly after boot
  setTimeout(() => {
    void runScheduledBlogCatchUp();
  }, 4_000);

  // Arm precision exact-9:00-AM IST trigger
  scheduleNextExactMorningTrigger();

  // Safety heartbeat every 60s so 09:00 AM IST never misses even across clock/sleep drift
  const timer = setInterval(() => {
    void runScheduledBlogCatchUp();
  }, SCHEDULER_POLL_MS);

  if (typeof timer.unref === 'function') {
    timer.unref();
  }
}
