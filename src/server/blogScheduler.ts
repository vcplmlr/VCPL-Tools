import { GoogleGenAI, Type } from '@google/genai';
import fs from 'node:fs';
import path from 'node:path';
import { BLOG_AUTHORS, BLOG_POSTS } from '../data/blogPostsData.ts';
import { EDITORIAL_TOPICS_QUEUE, EditorialRoadmapItem } from '../data/blogTopicsHub.ts';
import { BlogArticleSection, BlogCategory, BlogCoverTheme, BlogPostItem } from '../types/blog.ts';
import { buildBlogCoverSvg } from '../utils/blogCoverSvg.ts';
import { getDb } from './db.ts';

const LAUNCH_IST_DATE = '2026-11-23';
const PUBLISH_HOUR_IST = 9;
const PUBLISH_MINUTE_IST = 5;
const PUBLISH_MINUTES_IST = PUBLISH_HOUR_IST * 60 + PUBLISH_MINUTE_IST; // 09:05 AM IST
const SCHEDULER_POLL_MS = 60_000;

const VERIFIED_TOOL_IDS = [
  'gstr1-return-prep',
  'gstr2b-tally-reconciler',
  'form-26as-to-excel',
  'tds-26as-tally-reco',
  'tds-tcs-toolkit',
  'income-tax-fy-2026-27',
  'invoice-to-excel',
  'gst-place-of-supply',
  'bank-statement-analyzer',
  'covering-letter-generator',
  'resume-ats-builder',
  'invoice-quotation-maker',
  'tcs-tax-calculator',
  'bank-slip-generator',
  'pdf-unlocker',
] as const;

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

let catchUpInFlight: Promise<number> | null = null;
let schedulerStarted = false;
let missingKeyWarned = false;

export function getCurrentIstClock(now: Date = new Date()): {
  istDate: string;
  minutesSinceMidnight: number;
} {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
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

  return {
    istDate: `${year}-${month}-${day}`,
    minutesSinceMidnight: hour * 60 + minute,
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
  }>;
  faqs: Array<{
    question: string;
    answer: string;
  }>;
  conclusion: string[];
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
        '[VCPL Blog Scheduler] GEMINI_API_KEY is not configured; waiting for secret to publish pending daily articles.'
      );
    }
    return null;
  }
  missingKeyWarned = false;

  const authorId = AUTHOR_BY_CATEGORY[topic.category] ?? 'kaushik-bangera';
  const authorProfile = BLOG_AUTHORS[authorId];
  const coverTheme = COVER_THEME_BY_CATEGORY[topic.category] ?? 'tax';
  const defaultToolId = topic.relatedToolId || 'gstr1-return-prep';
  const relatedToolIds = Array.from(
    new Set(
      [defaultToolId, 'tds-tcs-toolkit', 'form-26as-to-excel'].filter((id) =>
        (VERIFIED_TOOL_IDS as readonly string[]).includes(id)
      )
    )
  ).slice(0, 3);

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });

  const prompt = [
    `You are ${authorProfile.name} (${authorProfile.role}), writing a comprehensive, 100% India-specific, SEO-optimized accounting & tax reference guide for VCPL Tools.`,
    `Article Title: ${topic.title}`,
    `Primary Category / Topic Head: ${topic.category}`,
    `Publish Date (IST): ${slotIstDate}`,
    `Target Audience: Indian Accountants, CA Firms, Tax Consultants, GST Practitioners, and Finance Managers.`,
    `Requirements:`,
    `- Write deep, practical, authoritative guidance (around 1,500–2,000 words total) aligned with Indian statutory rules for FY 2026-27 (GST Act, Income-tax Act, TRACES Form 26AS / Form 138 / Form 140 / Form 143, EPF/ESIC, MCA, Tally Prime, Excel).`,
    `- Include 5 to 6 rich H2 sections with clear step-by-step explanations, practical examples with INR figures, compliance pitfalls, and journal/Excel workflows where relevant.`,
    `- Include at least 2 structured comparison/reference tables inside sections.`,
    `- Include subtle internal anchor links inside prose using EXACT markdown syntax like [GSTR-1 Return Prep Tool](#tool:${defaultToolId}) or [Complete Tax Compliance Calendar 2026-27](#blog:gst-itr-tds-due-dates-2026-27) using ONLY verified tool IDs (${VERIFIED_TOOL_IDS.join(', ')}) or verified blog slug (#blog:gst-itr-tds-due-dates-2026-27, #blog:tds-sections-and-rates-chart-fy-2026-27, #blog:gstr-2b-vs-purchase-register-reconciliation-excel).`,
    `- Include 5 realistic practitioner FAQs and a concise actionable conclusion.`,
    `- Return clean JSON strictly matching the schema.`,
  ].join('\n');

  const response = await ai.models.generateContent({
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
  });

  const rawText = response.text?.trim();
  if (!rawText) {
    throw new Error(`Empty response from Gemini for slug "${topic.slug}"`);
  }

  const parsed = JSON.parse(rawText) as GeneratedArticlePayload;
  const dateLabel = formatDisplayDate(slotIstDate);

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
        Array.from({ length: colCount }, (_, cIdx) => String(row[cIdx] ?? '—'))
      );
      blocks.push({
        type: 'table',
        title: sec.table.title,
        headers: sec.table.headers.map((h) => String(h)),
        rows: safeRows,
      });
    }

    return {
      id: normalizeBlogId(sec.id || sec.heading, idx),
      heading: sec.heading,
      paragraphs: Array.isArray(sec.paragraphs) ? sec.paragraphs.filter(Boolean) : [],
      bullets: Array.isArray(sec.bullets) && sec.bullets.length > 0 ? sec.bullets : undefined,
      proTip: sec.proTip?.trim() ? sec.proTip.trim() : undefined,
      blocks: blocks.length > 0 ? blocks : undefined,
    };
  });

  const post: BlogPostItem = {
    slug: topic.slug,
    title: topic.title,
    seoTitle: parsed.seoTitle?.trim() || `${topic.title} | VCPL Tools`,
    excerpt: parsed.excerpt?.trim() || topic.title,
    seoDescription: parsed.seoDescription?.trim() || parsed.excerpt?.trim() || topic.title,
    category: topic.category,
    coverImage: `/blog/${topic.slug}.svg`,
    coverImageAlt: `${topic.title} — ${topic.category} reference guide cover for Indian accountants on VCPL Tools`,
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
    keywords: Array.isArray(parsed.keywords) && parsed.keywords.length > 0
      ? parsed.keywords.slice(0, 10)
      : [topic.title, topic.category, 'VCPL Tools'],
    relatedToolIds,
    relatedSlugs: collectSiblingSlugs(topic.category, topic.slug),
    keyTakeaways: Array.isArray(parsed.keyTakeaways)
      ? parsed.keyTakeaways.filter(Boolean).slice(0, 6)
      : [],
    sections: normalizedSections,
    faqs: Array.isArray(parsed.faqs) ? parsed.faqs.slice(0, 8) : [],
    conclusion: Array.isArray(parsed.conclusion) ? parsed.conclusion.filter(Boolean) : undefined,
    disclaimer:
      'Editorial Reference Note: Verify applicability against current CBIC notifications, CBDT circulars, and TRACES schema rules before final statutory filing.',
  };

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
}

export async function runScheduledBlogCatchUp(): Promise<number> {
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

      // Compute all daily 09:05 AM IST slots due from LAUNCH_IST_DATE + 1 up to today
      const dueSlotDates: string[] = [];
      for (let offset = 1; offset <= maxElapsedOffset; offset += 1) {
        const slotDate = addIsoDays(LAUNCH_IST_DATE, offset);
        const isPastDay = offset < maxElapsedOffset;
        const isTodayDue = offset === maxElapsedOffset && minutesSinceMidnight >= PUBLISH_MINUTES_IST;
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
      const filledSlotDates = new Set<string>(existingRows.map((r) => r.published_ist_date));

      const missingSlotDates = dueSlotDates.filter((d) => !filledSlotDates.has(d));
      if (missingSlotDates.length === 0) {
        return 0;
      }

      const pendingTopics = EDITORIAL_TOPICS_QUEUE.filter((item) => !publishedSlugs.has(item.slug));
      if (pendingTopics.length === 0) {
        return 0;
      }

      const pairsCount = Math.min(missingSlotDates.length, pendingTopics.length);
      for (let idx = 0; idx < pairsCount; idx += 1) {
        const slotDate = missingSlotDates[idx];
        const topic = pendingTopics[idx];

        try {
          const generatedPost = await generateArticleWithGemini(topic, slotDate);
          if (!generatedPost) {
            // API key absent or skipped cleanly; wait until next poll
            break;
          }
          savePublishedPost(generatedPost, topic.no);
          publishedSlugs.add(topic.slug);
          filledSlotDates.add(slotDate);
          newlyPublished += 1;
          console.log(
            `[VCPL Blog Scheduler] Auto-published #${topic.no} "${topic.slug}" for ${slotDate} (09:05 AM IST slot).`
          );
        } catch (err) {
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

export function startBackendBlogScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;

  // Run initial missed-day catch-up check shortly after boot
  setTimeout(() => {
    void runScheduledBlogCatchUp();
  }, 4_000);

  // Check every 60s so 09:05 AM IST triggers silently in backend even across continuous uptime
  const timer = setInterval(() => {
    void runScheduledBlogCatchUp();
  }, SCHEDULER_POLL_MS);

  if (typeof timer.unref === 'function') {
    timer.unref();
  }
}
