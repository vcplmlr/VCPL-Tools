import { Fragment, MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bookmark,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Home,
  Layers,
  Lightbulb,
  Link2,
  List,
  Mail,
  MapPin,
  Maximize2,
  Minimize2,
  Printer,
  Search,
  Sparkles,
  Square,
  Terminal,
  Type,
  Volume2,
  Wrench,
  X,
} from 'lucide-react';
import {
  BLOG_AUTHORS,
  BLOG_CATEGORIES,
  BlogAuthorProfile,
  BlogCategory,
  BlogPostItem,
  estimatePostReadingStats,
  getAllBlogPosts,
  getBlogPostBySlug,
} from '../data/blogPostsData';
import { BLOG_TOPIC_HEADS } from '../data/blogTopicsHub';
import { getToolById } from '../data/toolsCatalog';
import { BlogContentBlock } from '../types/blog';
import { ToolCatalogItem } from '../types/tools';
import { getBlogPath, getToolPath } from '../utils/seoConfig';
import { AdSlot } from './AdSlot';
import { PasswordSecurityLab } from './PasswordSecurityLab';

interface BlogPageProps {
  activeSlug?: string;
  onSelectPost: (slug?: string) => void;
  onBackHome: () => void;
  onOpenTool: (tool: ToolCatalogItem) => void;
}

type FontScale = 'sm' | 'md' | 'lg';
type ReaderWidth = 'focused' | 'wide';
type ReaderTone = 'paper' | 'sepia' | 'contrast';
type BlogSortOrder = 'latest' | 'longest' | 'quickest';
type ReadingPaceWpm = 180 | 215 | 265;

interface TocEntry {
  id: string;
  label: string;
  level: 2 | 3;
}

const BOOKMARKS_STORAGE_KEY = 'vcpl_blog_bookmarks_v1';
const READER_PREFS_STORAGE_KEY = 'vcpl_blog_reader_prefs_v1';
const BLOG_POSTS_PER_PAGE = 6;

interface SavedReaderPrefs {
  fontScale: FontScale;
  readerWidth: ReaderWidth;
  readerTone: ReaderTone;
  readingPaceWpm: ReadingPaceWpm;
}

function loadSavedReaderPrefs(): SavedReaderPrefs {
  const defaults: SavedReaderPrefs = {
    fontScale: 'md',
    readerWidth: 'focused',
    readerTone: 'paper',
    readingPaceWpm: 215,
  };
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = window.localStorage.getItem(READER_PREFS_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<SavedReaderPrefs>;
    return {
      fontScale: parsed.fontScale === 'sm' || parsed.fontScale === 'md' || parsed.fontScale === 'lg' ? parsed.fontScale : 'md',
      readerWidth: parsed.readerWidth === 'focused' || parsed.readerWidth === 'wide' ? parsed.readerWidth : 'focused',
      readerTone: parsed.readerTone === 'paper' || parsed.readerTone === 'sepia' || parsed.readerTone === 'contrast' ? parsed.readerTone : 'paper',
      readingPaceWpm: parsed.readingPaceWpm === 180 || parsed.readingPaceWpm === 215 || parsed.readingPaceWpm === 265 ? parsed.readingPaceWpm : 215,
    };
  } catch {
    return defaults;
  }
}

async function copyTextWithFallback(text: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to execCommand fallback
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

function loadSavedBookmarks(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(BOOKMARKS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function RichProseText({
  text,
  onSelectPost,
  onOpenTool,
}: {
  text: string;
  onSelectPost: (slug?: string) => void;
  onOpenTool: (tool: ToolCatalogItem) => void;
}) {
  const tokenRegex = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|(https?:\/\/[^\s<)]+)/g;
  const parts: Array<
    | { kind: 'text'; value: string }
    | { kind: 'bold'; value: string }
    | { kind: 'url'; value: string }
    | { kind: 'link'; label: string; target: string }
  > = [];

  let lastIndex = 0;
  let match: RegExpExecArray | null = tokenRegex.exec(text);
  while (match !== null) {
    if (match.index > lastIndex) {
      parts.push({ kind: 'text', value: text.slice(lastIndex, match.index) });
    }
    if (match[1] && match[2]) {
      parts.push({ kind: 'link', label: match[1], target: match[2] });
    } else if (match[3]) {
      parts.push({ kind: 'bold', value: match[3] });
    } else if (match[4]) {
      parts.push({ kind: 'url', value: match[4] });
    }
    lastIndex = tokenRegex.lastIndex;
    match = tokenRegex.exec(text);
  }
  if (lastIndex < text.length) {
    parts.push({ kind: 'text', value: text.slice(lastIndex) });
  }

  return (
    <>
      {parts.map((part, idx) => {
        if (part.kind === 'text') {
          return <Fragment key={idx}>{part.value}</Fragment>;
        }
        if (part.kind === 'bold') {
          return (
            <strong key={idx} className="font-display font-extrabold text-[#2F3E4E] dark:text-slate-100">
              {part.value}
            </strong>
          );
        }
        if (part.kind === 'url') {
          return (
            <a
              key={idx}
              href={part.value}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs sm:text-[13px] font-semibold text-[#12805C] dark:text-[#F9C80E] underline underline-offset-2 hover:text-[#0B4F38] dark:hover:text-white break-all"
            >
              {part.value}
            </a>
          );
        }

        if (part.target.startsWith('#tool:')) {
          const toolId = part.target.slice('#tool:'.length);
          const tool = getToolById(toolId);
          if (tool) {
            const href = getToolPath(tool);
            return (
              <a
                key={`${toolId}-${idx}`}
                href={href}
                onClick={(e: MouseEvent<HTMLAnchorElement>) => {
                  e.preventDefault();
                  onOpenTool(tool);
                }}
                className="font-semibold text-[#12805C] dark:text-[#F9C80E] underline decoration-[#12805C]/45 dark:decoration-[#F9C80E]/55 decoration-2 underline-offset-3 hover:text-[#0B4F38] dark:hover:text-white transition-colors"
              >
                {part.label}
              </a>
            );
          }
          return <span key={idx}>{part.label}</span>;
        }

        if (part.target.startsWith('#blog:')) {
          const slug = part.target.slice('#blog:'.length);
          const linkedPost = getBlogPostBySlug(slug);
          if (linkedPost) {
            const href = getBlogPath(linkedPost.slug);
            return (
              <a
                key={`${slug}-${idx}`}
                href={href}
                onClick={(e: MouseEvent<HTMLAnchorElement>) => {
                  e.preventDefault();
                  onSelectPost(linkedPost.slug);
                }}
                className="font-semibold text-[#1D4ED8] dark:text-sky-300 underline decoration-sky-600/45 decoration-2 underline-offset-3 hover:text-[#1E3A8A] dark:hover:text-[#F9C80E] transition-colors"
              >
                {part.label}
              </a>
            );
          }
          return <span key={idx}>{part.label}</span>;
        }

        return (
          <a
            key={idx}
            href={part.target}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[#12805C] dark:text-[#F9C80E] underline underline-offset-2"
          >
            {part.label}
          </a>
        );
      })}
    </>
  );
}

function CodeBlockCard({
  filename,
  language,
  code,
}: {
  filename?: string;
  language: string;
  code: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="rounded-xl overflow-hidden border-[1.5px] border-[#2F3E4E] dark:border-slate-700 bg-[#0F172A] text-slate-100 shadow-[0_3px_0_#2F3E4E]/20">
      <div className="px-4 py-2.5 bg-[#1E293B] border-b border-slate-700/80 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 font-mono text-xs text-slate-200 truncate">
          <Terminal className="w-3.5 h-3.5 text-[#F9C80E] shrink-0" aria-hidden="true" />
          <span className="truncate">
            {filename ? `${filename} · ${language}` : language}
          </span>
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-mono font-bold text-slate-200 hover:text-white border border-slate-600 transition cursor-pointer whitespace-nowrap shrink-0"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Copy Code</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-xs sm:text-[13px] leading-relaxed font-mono text-slate-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function BlogContentBlockList({
  blocks,
  proseSizeClass,
  onSelectPost,
  onOpenTool,
}: {
  blocks?: BlogContentBlock[];
  proseSizeClass: string;
  onSelectPost: (slug?: string) => void;
  onOpenTool: (tool: ToolCatalogItem) => void;
}) {
  if (!blocks || blocks.length === 0) return null;

  return (
    <div className="space-y-4">
      {blocks.map((block, bIdx) => {
        if (block.type === 'paragraph') {
          return (
            <p key={bIdx} className={`${proseSizeClass} text-[#334155] dark:text-slate-200`}>
              <RichProseText
                text={block.text}
                onSelectPost={onSelectPost}
                onOpenTool={onOpenTool}
              />
            </p>
          );
        }

        if (block.type === 'label') {
          return (
            <p
              key={bIdx}
              className="font-display font-extrabold text-sm text-[#2F3E4E] dark:text-[#F9C80E] pt-1"
            >
              {block.text}
            </p>
          );
        }

        if (block.type === 'bullets') {
          return (
            <div key={bIdx} className="space-y-2">
              {block.title && (
                <p className="font-display font-extrabold text-sm text-[#2F3E4E] dark:text-slate-100">
                  {block.title}
                </p>
              )}
              <ul className="space-y-2">
                {block.items.map((item, i) => (
                  <li
                    key={i}
                    className={`flex items-start gap-2.5 ${proseSizeClass} text-[#334155] dark:text-slate-200 bg-white/80 dark:bg-[#0B1120] border border-[#2F3E4E]/15 dark:border-slate-700/80 rounded-xl px-4 py-2.5`}
                  >
                    <span className="w-2 h-2 rounded-full bg-[#12805C] dark:bg-[#F9C80E] shrink-0 mt-2.5" />
                    <span>
                      <RichProseText
                        text={item}
                        onSelectPost={onSelectPost}
                        onOpenTool={onOpenTool}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        }

        if (block.type === 'ordered') {
          return (
            <div key={bIdx} className="space-y-2">
              {block.title && (
                <p className="font-display font-extrabold text-sm text-[#2F3E4E] dark:text-slate-100">
                  {block.title}
                </p>
              )}
              <ol className="space-y-2">
                {block.items.map((item, i) => (
                  <li
                    key={i}
                    className={`flex items-start gap-3 ${proseSizeClass} text-[#334155] dark:text-slate-200 bg-white/80 dark:bg-[#0B1120] border border-[#2F3E4E]/15 dark:border-slate-700/80 rounded-xl px-4 py-2.5`}
                  >
                    <span className="w-5 h-5 rounded-md bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#F9C80E] dark:text-[#0F172A] font-mono text-[11px] font-extrabold flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span>
                      <RichProseText
                        text={item}
                        onSelectPost={onSelectPost}
                        onOpenTool={onOpenTool}
                      />
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          );
        }

        if (block.type === 'callout') {
          const isWarn = block.tone === 'warning';
          return (
            <div
              key={bIdx}
              className={`flex items-start gap-3 rounded-xl border p-4 text-xs sm:text-sm leading-relaxed ${
                isWarn
                  ? 'bg-[#FEF2C8]/90 dark:bg-amber-950/35 border-[#B45309]/40 dark:border-amber-600/60 text-[#2F3E4E] dark:text-amber-100'
                  : 'bg-[#CEE5DC]/55 dark:bg-emerald-950/40 border-[#12805C]/35 dark:border-emerald-700/60 text-[#2F3E4E] dark:text-emerald-100'
              }`}
            >
              <Lightbulb
                className={`w-4 h-4 shrink-0 mt-0.5 ${
                  isWarn ? 'text-[#B45309] dark:text-[#F9C80E]' : 'text-[#12805C] dark:text-[#F9C80E]'
                }`}
                aria-hidden="true"
              />
              <div>
                <strong className="font-display font-extrabold">{block.label}: </strong>
                <RichProseText
                  text={block.text}
                  onSelectPost={onSelectPost}
                  onOpenTool={onOpenTool}
                />
              </div>
            </div>
          );
        }

        if (block.type === 'code') {
          return (
            <CodeBlockCard
              key={bIdx}
              filename={block.filename}
              language={block.language}
              code={block.code}
            />
          );
        }

        return (
          <div key={bIdx} className="space-y-2">
            {block.title && (
              <p className="font-display font-extrabold text-sm text-[#2F3E4E] dark:text-[#F9C80E]">
                {block.title}
              </p>
            )}
            <div className="overflow-x-auto rounded-xl border-[1.5px] border-[#2F3E4E]/35 dark:border-slate-700 bg-white dark:bg-[#0B1120] shadow-xs">
              <table className="w-full border-collapse text-left text-xs sm:text-sm">
                <thead>
                  <tr className="bg-[#2F3E4E] dark:bg-slate-800 text-[#FFFDF5]">
                    {block.headers.map((header) => (
                      <th
                        key={header}
                        scope="col"
                        className="px-4 py-3 font-display font-extrabold text-xs uppercase tracking-wider whitespace-nowrap"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2F3E4E]/12 dark:divide-slate-800">
                  {block.rows.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className="odd:bg-[#FFFDF5] even:bg-[#FEF2C8]/30 dark:odd:bg-[#0B1120] dark:even:bg-[#131C2E]/70"
                    >
                      {row.map((cell, cIdx) => (
                        <td
                          key={cIdx}
                          className={`px-4 py-2.5 align-top leading-relaxed ${
                            cIdx === 0
                              ? 'font-semibold text-[#2F3E4E] dark:text-slate-100'
                              : 'text-[#334155] dark:text-slate-300'
                          }`}
                        >
                          <RichProseText
                            text={cell}
                            onSelectPost={onSelectPost}
                            onOpenTool={onOpenTool}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function resolveInitialTopicCategory(): 'All' | BlogCategory {
  if (typeof window === 'undefined') return 'All';
  const topicSlug = new URLSearchParams(window.location.search).get('topic');
  if (!topicSlug) return 'All';
  const matched = BLOG_TOPIC_HEADS.find((item) => item.slug === topicSlug);
  return matched ? matched.category : 'All';
}

function resolveInitialBlogPage(): number {
  if (typeof window === 'undefined') return 1;
  const raw = Number(new URLSearchParams(window.location.search).get('page'));
  return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1;
}

export function BlogPage({
  activeSlug,
  onSelectPost,
  onBackHome,
  onOpenTool,
}: BlogPageProps) {
  const [selectedCategory, setSelectedCategory] = useState<'All' | BlogCategory>(
    resolveInitialTopicCategory
  );
  const [selectedAuthorId, setSelectedAuthorId] = useState<BlogAuthorProfile['id'] | null>(null);
  const [sortOrder, setSortOrder] = useState<BlogSortOrder>('latest');
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState<number>(resolveInitialBlogPage);
  const [savedSlugs, setSavedSlugs] = useState<string[]>(loadSavedBookmarks);
  const [allPosts, setAllPosts] = useState<BlogPostItem[]>(() => getAllBlogPosts());

  // Reader Mode State (persisted across articles & sessions)
  const initialReaderPrefs = useMemo(loadSavedReaderPrefs, []);
  const [fontScale, setFontScale] = useState<FontScale>(initialReaderPrefs.fontScale);
  const [readerWidth, setReaderWidth] = useState<ReaderWidth>(initialReaderPrefs.readerWidth);
  const [readerTone, setReaderTone] = useState<ReaderTone>(initialReaderPrefs.readerTone);
  const [readingPaceWpm, setReadingPaceWpm] = useState<ReadingPaceWpm>(initialReaderPrefs.readingPaceWpm);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeHeadingId, setActiveHeadingId] = useState<string>('');
  const [mobileTocOpen, setMobileTocOpen] = useState(false);
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedSectionId, setCopiedSectionId] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const articleRef = useRef<HTMLElement | null>(null);
  const blogSectionRef = useRef<HTMLElement | null>(null);
  const didMountFiltersRef = useRef(false);
  const speechSessionRef = useRef(0);

  useEffect(() => {
    const syncPosts = () => {
      setAllPosts(getAllBlogPosts());
    };
    window.addEventListener('vcpl:blog-posts-updated', syncPosts);
    return () => window.removeEventListener('vcpl:blog-posts-updated', syncPosts);
  }, []);

  const activePost: BlogPostItem | undefined = useMemo(
    () => (activeSlug ? getBlogPostBySlug(activeSlug) : undefined),
    [activeSlug, allPosts]
  );

  // Sync URL ?topic=<slug> and ?page=<n> when viewing the blog index directory
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePop = () => {
      setSelectedCategory(resolveInitialTopicCategory());
      setCurrentPage(resolveInitialBlogPage());
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  useEffect(() => {
    if (!didMountFiltersRef.current) {
      didMountFiltersRef.current = true;
      return;
    }
    setCurrentPage(1);
  }, [selectedCategory, selectedAuthorId, showSavedOnly, searchQuery, sortOrder]);

  useEffect(() => {
    if (typeof window === 'undefined' || activeSlug) return;
    const url = new URL(window.location.href);
    if (!url.pathname.startsWith('/blog')) return;
    const topicMeta = BLOG_TOPIC_HEADS.find((t) => t.category === selectedCategory);
    const currentTopicParam = url.searchParams.get('topic');
    const desiredTopicParam = topicMeta ? topicMeta.slug : null;
    const currentPageParam = url.searchParams.get('page');
    const desiredPageParam = currentPage > 1 ? String(currentPage) : null;
    if (currentTopicParam === desiredTopicParam && currentPageParam === desiredPageParam) return;
    if (desiredTopicParam) {
      url.searchParams.set('topic', desiredTopicParam);
    } else {
      url.searchParams.delete('topic');
    }
    if (desiredPageParam) {
      url.searchParams.set('page', desiredPageParam);
    } else {
      url.searchParams.delete('page');
    }
    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(null, '', nextUrl);
  }, [activeSlug, selectedCategory, currentPage]);

  // Persist bookmarks & Reader Mode preferences
  useEffect(() => {
    try {
      window.localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(savedSlugs));
    } catch {
      // Ignore storage errors
    }
  }, [savedSlugs]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        READER_PREFS_STORAGE_KEY,
        JSON.stringify({ fontScale, readerWidth, readerTone, readingPaceWpm })
      );
    } catch {
      // Ignore storage errors
    }
  }, [fontScale, readerWidth, readerTone, readingPaceWpm]);

  const toggleBookmark = (slug: string) => {
    setSavedSlugs((prev) =>
      prev.includes(slug) ? prev.filter((item) => item !== slug) : [...prev, slug]
    );
  };

  // Stop speech synthesis cleanly on navigation or unmount
  useEffect(() => {
    setOpenFaqIdx(0);
    setMobileTocOpen(false);
    setCopiedLink(false);
    speechSessionRef.current += 1;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });

    return () => {
      speechSessionRef.current += 1;
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [activeSlug]);

  // Build Table of Contents items for active article
  const tocEntries = useMemo<TocEntry[]>(() => {
    if (!activePost) return [];
    const entries: TocEntry[] = [
      { id: 'key-takeaways', label: 'Key Practical Takeaways', level: 2 },
    ];
    for (const sec of activePost.sections) {
      entries.push({ id: sec.id, label: sec.heading, level: 2 });
      for (const sub of sec.subsections ?? []) {
        entries.push({ id: sub.id, label: sub.heading, level: 3 });
      }
    }
    if (activePost.faqs.length > 0) {
      entries.push({ id: 'article-faqs', label: 'Frequently Asked Questions', level: 2 });
    }
    if (activePost.conclusion && activePost.conclusion.length > 0) {
      entries.push({ id: 'article-conclusion', label: 'Conclusion', level: 2 });
    }
    if (activePost.relatedToolIds.length > 0) {
      entries.push({ id: 'featured-tools', label: 'Tools Featured in Guide', level: 2 });
    }
    const postAuthorName = BLOG_AUTHORS[activePost.authorId]?.name ?? activePost.author;
    entries.push({ id: 'author-profile', label: `About the Author – ${postAuthorName}`, level: 2 });
    return entries;
  }, [activePost]);

  // Track reading progress & scrollspy active heading
  useEffect(() => {
    if (!activePost) {
      setScrollProgress(0);
      setActiveHeadingId('');
      return;
    }

    const handleScroll = () => {
      const el = articleRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const totalReadable = Math.max(el.offsetHeight - window.innerHeight * 0.55, 1);
        const passed = Math.max(-rect.top, 0);
        const pct = Math.min(100, Math.max(0, Math.round((passed / totalReadable) * 100)));
        setScrollProgress(pct);
      }

      // Scrollspy for headings
      let currentId = tocEntries[0]?.id ?? '';
      for (const entry of tocEntries) {
        const target = document.getElementById(entry.id);
        if (target) {
          const top = target.getBoundingClientRect().top;
          if (top <= 140) {
            currentId = entry.id;
          }
        }
      }
      setActiveHeadingId(currentId);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activePost, tocEntries]);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setMobileTocOpen(false);
  };

  const handleToggleSpeak = () => {
    if (!activePost || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (isSpeaking) {
      speechSessionRef.current += 1;
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const plainChunks: string[] = [
      activePost.title,
      activePost.excerpt,
      'Key Practical Takeaways.',
      ...activePost.keyTakeaways,
    ];
    const pushBlocksText = (blocks?: BlogContentBlock[]) => {
      for (const block of blocks ?? []) {
        if (block.type === 'paragraph' || block.type === 'label') {
          plainChunks.push(block.text);
        } else if (block.type === 'bullets' || block.type === 'ordered') {
          if (block.title) plainChunks.push(block.title);
          plainChunks.push(...block.items);
        } else if (block.type === 'callout') {
          plainChunks.push(block.label, block.text);
        }
      }
    };
    for (const s of activePost.sections) {
      plainChunks.push(s.heading, ...s.paragraphs, ...(s.bullets ?? []));
      pushBlocksText(s.blocks);
      for (const sub of s.subsections ?? []) {
        plainChunks.push(sub.heading, ...sub.paragraphs, ...(sub.bullets ?? []));
        pushBlocksText(sub.blocks);
      }
    }
    if (activePost.conclusion) {
      plainChunks.push('Conclusion.', ...activePost.conclusion);
    }

    const normalizedSegments = plainChunks
      .map((chunk) =>
        chunk
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
          .replace(/\*\*([^*]+)\*\*/g, '$1')
          .replace(/\s+/g, ' ')
          .trim()
      )
      .filter(Boolean);

    // Split long paragraphs into <=240 char sentence batches so browsers don't stall on long utterances
    const speechQueue: string[] = [];
    for (const seg of normalizedSegments) {
      if (seg.length <= 240) {
        speechQueue.push(seg);
      } else {
        const sentences = seg.match(/[^.!?]+[.!?]*\s*/g) ?? [seg];
        let buffer = '';
        for (const s of sentences) {
          if ((buffer + s).length > 240 && buffer) {
            speechQueue.push(buffer.trim());
            buffer = s;
          } else {
            buffer += s;
          }
        }
        if (buffer.trim()) speechQueue.push(buffer.trim());
      }
    }

    const sessionId = speechSessionRef.current + 1;
    speechSessionRef.current = sessionId;
    window.speechSynthesis.cancel();
    setIsSpeaking(true);

    const speechRate = readingPaceWpm === 180 ? 0.9 : readingPaceWpm === 265 ? 1.18 : 1.0;
    let index = 0;

    const speakNext = () => {
      if (speechSessionRef.current !== sessionId || index >= speechQueue.length) {
        if (speechSessionRef.current === sessionId) setIsSpeaking(false);
        return;
      }
      const utterance = new SpeechSynthesisUtterance(speechQueue[index++]);
      utterance.lang = 'en-IN';
      utterance.rate = speechRate;
      utterance.onend = () => speakNext();
      utterance.onerror = () => {
        if (speechSessionRef.current === sessionId) setIsSpeaking(false);
      };
      window.speechSynthesis.speak(utterance);
    };

    speakNext();
  };

  const handleCopyShareLink = async () => {
    if (!activePost || typeof window === 'undefined') return;
    const shareUrl = `${window.location.origin}${getBlogPath(activePost.slug)}`;
    const ok = await copyTextWithFallback(shareUrl);
    if (ok) {
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2200);
    } else {
      setCopiedLink(false);
    }
  };

  const readingStatsBySlug = useMemo(() => {
    const map = new Map<string, ReturnType<typeof estimatePostReadingStats>>();
    for (const post of allPosts) {
      map.set(post.slug, estimatePostReadingStats(post, readingPaceWpm));
    }
    return map;
  }, [allPosts, readingPaceWpm]);

  const filteredPosts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const matched = allPosts.filter((post) => {
      const matchesCat =
        selectedCategory === 'All' ||
        post.category === selectedCategory ||
        Boolean(post.topicTags?.includes(selectedCategory));
      if (!matchesCat) return false;
      if (selectedAuthorId && post.authorId !== selectedAuthorId) return false;
      if (showSavedOnly && !savedSlugs.includes(post.slug)) return false;
      if (!q) return true;
      return (
        post.title.toLowerCase().includes(q) ||
        post.excerpt.toLowerCase().includes(q) ||
        post.category.toLowerCase().includes(q) ||
        Boolean(post.topicTags?.some((tag) => tag.toLowerCase().includes(q))) ||
        post.author.toLowerCase().includes(q) ||
        post.keywords.some((k) => k.toLowerCase().includes(q))
      );
    });

    if (sortOrder === 'longest') {
      return [...matched].sort(
        (a, b) =>
          (readingStatsBySlug.get(b.slug)?.minutes ?? 5) -
          (readingStatsBySlug.get(a.slug)?.minutes ?? 5)
      );
    }
    if (sortOrder === 'quickest') {
      return [...matched].sort(
        (a, b) =>
          (readingStatsBySlug.get(a.slug)?.minutes ?? 5) -
          (readingStatsBySlug.get(b.slug)?.minutes ?? 5)
      );
    }
    return matched;
  }, [
    allPosts,
    readingStatsBySlug,
    searchQuery,
    selectedCategory,
    selectedAuthorId,
    showSavedOnly,
    savedSlugs,
    sortOrder,
  ]);

  const liveCountsByCategory = useMemo(() => {
    const map = new Map<BlogCategory, number>();
    for (const head of BLOG_TOPIC_HEADS) {
      map.set(
        head.category,
        allPosts.filter(
          (p) => p.category === head.category || p.topicTags?.includes(head.category)
        ).length
      );
    }
    return map;
  }, [allPosts]);

  // ==========================
  // ARTICLE READER VIEW
  // ==========================
  if (activePost) {
    const currentIdx = allPosts.findIndex((p) => p.slug === activePost.slug);
    const prevPost = currentIdx > 0 ? allPosts[currentIdx - 1] : null;
    const nextPost =
      currentIdx >= 0 && currentIdx < allPosts.length - 1 ? allPosts[currentIdx + 1] : null;

    const relatedTools = activePost.relatedToolIds
      .map((id) => getToolById(id))
      .filter((t): t is ToolCatalogItem => Boolean(t));

    const relatedPosts = activePost.relatedSlugs
      .map((slug) => getBlogPostBySlug(slug))
      .filter((p): p is BlogPostItem => Boolean(p));

    const authorProfile = BLOG_AUTHORS[activePost.authorId];
    const baseStats =
      readingStatsBySlug.get(activePost.slug) ?? estimatePostReadingStats(activePost);
    const wordCount = baseStats.wordCount;
    const adjustedMinutes = Math.max(
      2,
      Math.ceil(
        wordCount / readingPaceWpm +
          (baseStats.codeLineCount * 1.8) / 60 +
          (baseStats.tableCount * 20) / 60
      )
    );
    const readingStats = {
      ...baseStats,
      minutes: adjustedMinutes,
      formattedTime: `${adjustedMinutes} min read`,
    };
    const remainingMinutes = Math.max(
      1,
      Math.ceil(readingStats.minutes * (1 - scrollProgress / 100))
    );
    const remainingLabel = scrollProgress >= 96 ? 'Finished' : `~${remainingMinutes} min left`;
    const isBookmarked = savedSlugs.includes(activePost.slug);
    const speechSupported =
      typeof window !== 'undefined' && 'speechSynthesis' in window;

    const handleCopySectionAnchor = async (sectionId: string) => {
      if (typeof window === 'undefined') return;
      const sectionUrl = `${window.location.origin}${getBlogPath(activePost.slug)}#${sectionId}`;
      const ok = await copyTextWithFallback(sectionUrl);
      if (ok) {
        setCopiedSectionId(sectionId);
        window.setTimeout(() => setCopiedSectionId(null), 1600);
      } else {
        setCopiedSectionId(null);
      }
    };

    const proseSizeClass =
      fontScale === 'sm'
        ? 'text-[14px] leading-[1.7]'
        : fontScale === 'lg'
        ? 'text-[17px] sm:text-[18px] leading-[1.82]'
        : 'text-[15px] sm:text-[16px] leading-[1.76]';

    const paperToneClass =
      readerTone === 'sepia'
        ? 'bg-[#FAF0D7] dark:bg-[#191610] text-[#2B2118] dark:text-[#F4EBD9]'
        : readerTone === 'contrast'
        ? 'bg-white dark:bg-[#020617] text-[#0F172A] dark:text-white'
        : 'bg-[#FFFDF5] dark:bg-[#131C2E] text-[#2F3E4E] dark:text-slate-100';

    const articleContainerWidth =
      readerWidth === 'wide' ? 'max-w-[1340px]' : 'max-w-[1160px]';

    return (
      <section className="w-full bg-[#CEE5DC] dark:bg-[#0B1120] min-h-[calc(100dvh-140px)] py-6 sm:py-9 transition-colors duration-200">
        {/* Top Fixed Scroll Progress Bar */}
        <div
          className="fixed top-0 left-0 right-0 z-40 h-1 bg-black/5 dark:bg-white/5 pointer-events-none no-print"
          role="progressbar"
          aria-label="Article reading progress"
          aria-valuenow={scrollProgress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-[#12805C] dark:bg-[#F9C80E] transition-[width] duration-150"
            style={{ width: `${scrollProgress}%` }}
          />
        </div>

        <div
          className={`${articleContainerWidth} mx-auto pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6 space-y-6`}
        >
          {/* Accessible Breadcrumbs */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <nav aria-label="Breadcrumb" className="min-w-0">
              <ol className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-[#334155] dark:text-slate-300">
                <li>
                  <button
                    type="button"
                    onClick={onBackHome}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#FFFDF5]/85 dark:bg-[#131C2E] border border-[#2F3E4E]/30 dark:border-slate-700 hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] dark:hover:text-[#0F172A] transition cursor-pointer"
                  >
                    <Home className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Home</span>
                  </button>
                </li>
                <li aria-hidden="true" className="text-[#64748B] dark:text-slate-500">
                  <ChevronRight className="w-3.5 h-3.5" />
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory('All');
                      setSelectedAuthorId(null);
                      onSelectPost(undefined);
                    }}
                    className="px-2 py-1 rounded-md hover:bg-[#FFFDF5] dark:hover:bg-slate-800 hover:underline underline-offset-4 cursor-pointer"
                  >
                    Blog
                  </button>
                </li>
                <li aria-hidden="true" className="text-[#64748B] dark:text-slate-500">
                  <ChevronRight className="w-3.5 h-3.5" />
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory(activePost.category);
                      setSelectedAuthorId(null);
                      onSelectPost(undefined);
                    }}
                    className="px-2 py-1 rounded-md hover:bg-[#FFFDF5] dark:hover:bg-slate-800 hover:underline underline-offset-4 text-[#12805C] dark:text-emerald-300 font-bold cursor-pointer"
                  >
                    {activePost.category}
                  </button>
                </li>
                <li aria-hidden="true" className="hidden sm:block text-[#64748B] dark:text-slate-500">
                  <ChevronRight className="w-3.5 h-3.5" />
                </li>
                <li
                  aria-current="page"
                  className="hidden sm:block font-bold text-[#2F3E4E] dark:text-slate-100 truncate max-w-[320px]"
                >
                  {activePost.title}
                </li>
              </ol>
            </nav>

            <span className="text-xs font-mono font-bold text-[#2F3E4E] dark:text-slate-300 tabular-nums shrink-0">
              {scrollProgress}% read · {remainingLabel} · {readingStats.formattedTime} ({readingPaceWpm} WPM) · {wordCount.toLocaleString()} words
            </span>
          </div>

          {/* Reading Options & Accessibility Control Bar */}
          <div className="bg-[#FEF2C8] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-xl px-4 py-2.5 shadow-[0_3px_0_#2F3E4E] dark:shadow-[0_3px_0_#020617] flex flex-wrap items-center justify-between gap-3 no-print">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-display font-extrabold uppercase tracking-wider text-[#2F3E4E] dark:text-[#F9C80E] mr-1">
                <Type className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Reader Mode</span>
              </span>

              {/* Font Size Selector */}
              <div
                className="inline-flex items-stretch h-8 rounded-lg border border-[#2F3E4E]/40 dark:border-slate-600 divide-x divide-[#2F3E4E]/20 dark:divide-slate-600 overflow-hidden bg-[#FFFDF5] dark:bg-[#0B1120]"
                role="group"
                aria-label="Article text size"
              >
                {(['sm', 'md', 'lg'] as FontScale[]).map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setFontScale(size)}
                    className={`px-2.5 inline-flex items-center text-[11px] font-mono font-bold uppercase cursor-pointer transition ${
                      fontScale === size
                        ? 'bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#F9C80E] dark:text-[#0F172A]'
                        : 'text-[#334155] dark:text-slate-300 hover:bg-[#FEF2C8] dark:hover:bg-slate-800'
                    }`}
                  >
                    {size === 'sm' ? 'A-' : size === 'lg' ? 'A+' : 'A'}
                  </button>
                ))}
              </div>

              {/* Surface Theme */}
              <div
                className="inline-flex items-stretch h-8 rounded-lg border border-[#2F3E4E]/40 dark:border-slate-600 divide-x divide-[#2F3E4E]/20 dark:divide-slate-600 overflow-hidden bg-[#FFFDF5] dark:bg-[#0B1120]"
                role="group"
                aria-label="Reading background tone"
              >
                {([
                  { id: 'paper', label: 'Cream' },
                  { id: 'sepia', label: 'Sepia' },
                  { id: 'contrast', label: 'Crisp' },
                ] as const).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setReaderTone(t.id)}
                    className={`px-2.5 inline-flex items-center text-[11px] font-display font-bold cursor-pointer transition ${
                      readerTone === t.id
                        ? 'bg-[#12805C] dark:bg-[#F9C80E] text-white dark:text-[#0F172A]'
                        : 'text-[#334155] dark:text-slate-300 hover:bg-[#FEF2C8] dark:hover:bg-slate-800'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Reading Pace WPM Calibrator */}
              <div
                className="inline-flex items-stretch h-8 rounded-lg border border-[#2F3E4E]/40 dark:border-slate-600 divide-x divide-[#2F3E4E]/20 dark:divide-slate-600 overflow-hidden bg-[#FFFDF5] dark:bg-[#0B1120]"
                role="group"
                aria-label="Reading pace speed"
              >
                {([
                  { wpm: 180 as const, label: 'Deep 180 WPM' },
                  { wpm: 215 as const, label: 'Std 215 WPM' },
                  { wpm: 265 as const, label: 'Fast 265 WPM' },
                ]).map((p) => (
                  <button
                    key={p.wpm}
                    type="button"
                    onClick={() => setReadingPaceWpm(p.wpm)}
                    className={`px-2.5 inline-flex items-center text-[11px] font-display font-bold cursor-pointer transition whitespace-nowrap tabular-nums ${
                      readingPaceWpm === p.wpm
                        ? 'bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#F9C80E] dark:text-[#0F172A]'
                        : 'text-[#334155] dark:text-slate-300 hover:bg-[#FEF2C8] dark:hover:bg-slate-800'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Width Toggle */}
              <button
                type="button"
                onClick={() =>
                  setReaderWidth((prev) => (prev === 'focused' ? 'wide' : 'focused'))
                }
                aria-pressed={readerWidth === 'wide'}
                aria-label={readerWidth === 'focused' ? 'Expand reading width' : 'Focus reading width'}
                className="hidden lg:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-[#2F3E4E]/40 dark:border-slate-600 bg-[#FFFDF5] dark:bg-[#0B1120] hover:bg-[#F9C80E]/35 text-[11px] font-bold text-[#2F3E4E] dark:text-slate-200 cursor-pointer whitespace-nowrap"
              >
                {readerWidth === 'focused' ? (
                  <>
                    <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Wide View</span>
                  </>
                ) : (
                  <>
                    <Minimize2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Focused Width</span>
                  </>
                )}
              </button>
            </div>

            {/* Action Buttons: Listen, Bookmark, Share, Print */}
            <div className="flex flex-wrap items-center gap-2">
              {speechSupported && (
                <button
                  type="button"
                  onClick={handleToggleSpeak}
                  className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-display font-bold transition cursor-pointer whitespace-nowrap ${
                    isSpeaking
                      ? 'bg-[#7D0B0B] text-[#FFFDF5] border-[#7D0B0B]'
                      : 'bg-[#FFFDF5] dark:bg-[#0B1120] text-[#2F3E4E] dark:text-slate-100 border-[#2F3E4E]/40 dark:border-slate-600 hover:bg-[#F9C80E]/40'
                  }`}
                >
                  {isSpeaking ? (
                    <>
                      <Square className="w-3 h-3 fill-current" aria-hidden="true" />
                      <span>Stop Audio</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Listen</span>
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => toggleBookmark(activePost.slug)}
                aria-pressed={isBookmarked}
                className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-display font-bold transition cursor-pointer whitespace-nowrap ${
                  isBookmarked
                    ? 'bg-[#F9C80E] text-[#0F172A] border-[#2F3E4E]'
                    : 'bg-[#FFFDF5] dark:bg-[#0B1120] text-[#2F3E4E] dark:text-slate-100 border-[#2F3E4E]/40 dark:border-slate-600 hover:bg-[#F9C80E]/40'
                }`}
              >
                <Bookmark
                  className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`}
                  aria-hidden="true"
                />
                <span>{isBookmarked ? 'Saved' : 'Save'}</span>
              </button>

              <button
                type="button"
                onClick={handleCopyShareLink}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#2F3E4E]/40 dark:border-slate-600 bg-[#FFFDF5] dark:bg-[#0B1120] hover:bg-[#F9C80E]/40 text-xs font-display font-bold text-[#2F3E4E] dark:text-slate-100 transition cursor-pointer whitespace-nowrap"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#12805C]" aria-hidden="true" />
                    <span>Link Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#2F3E4E]/40 dark:border-slate-600 bg-[#FFFDF5] dark:bg-[#0B1120] hover:bg-[#F9C80E]/40 text-xs font-display font-bold text-[#2F3E4E] dark:text-slate-100 transition cursor-pointer whitespace-nowrap"
              >
                <Printer className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Print Guide</span>
              </button>
            </div>
          </div>

          {/* Main Grid: Article Column + Sticky Desktop TOC Sidebar */}
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_290px] gap-7 items-start">
            {/* Article Paper */}
            <article
              ref={articleRef}
              className={`${paperToneClass} border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-5 sm:p-8 lg:p-10 shadow-[0_5px_0_#2F3E4E] dark:shadow-[0_5px_0_#020617] space-y-8 transition-colors`}
            >
              {/* Article Header */}
              <header className="space-y-4 pb-6 border-b border-[#2F3E4E]/15 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory(activePost.category);
                      setSelectedAuthorId(null);
                      onSelectPost(undefined);
                    }}
                    className="inline-flex items-center gap-1.5 font-display font-extrabold uppercase tracking-wider text-[#12805C] dark:text-[#F9C80E] hover:underline underline-offset-4 cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{activePost.category}</span>
                  </button>
                  <span aria-hidden="true" className="text-[#94A3B8]">
                    ·
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono font-semibold text-[#475569] dark:text-slate-300">
                    <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                    <time dateTime={activePost.publishedIso}>
                      Published {activePost.publishedLabel}
                    </time>
                  </span>
                  <span aria-hidden="true" className="text-[#94A3B8]">
                    ·
                  </span>
                  <span className="font-mono font-semibold text-[#475569] dark:text-slate-300">
                    Updated <time dateTime={activePost.updatedIso}>{activePost.updatedLabel}</time>
                  </span>
                  <span aria-hidden="true" className="text-[#94A3B8]">
                    ·
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono font-bold text-[#2F3E4E] dark:text-slate-200 tabular-nums">
                    <Clock className="w-3.5 h-3.5 text-[#12805C] dark:text-[#F9C80E]" aria-hidden="true" />
                    <span>
                      {readingStats.formattedTime} · {wordCount.toLocaleString()} words
                    </span>
                  </span>
                  {activePost.difficulty && (
                    <>
                      <span aria-hidden="true" className="text-[#94A3B8]">
                        ·
                      </span>
                      <span className="font-mono font-bold text-[#12805C] dark:text-[#F9C80E]">
                        {activePost.difficulty}
                      </span>
                    </>
                  )}
                </div>

                <h1 className="font-display font-extrabold text-[clamp(1.65rem,3.4vw,2.5rem)] leading-[1.14] text-[#2F3E4E] dark:text-slate-50 tracking-tight [text-wrap:balance]">
                  {activePost.title}
                </h1>

                <p className="text-sm sm:text-base leading-relaxed text-[#475569] dark:text-slate-300">
                  {activePost.excerpt}
                </p>

                {/* Author Byline Strip */}
                <div className="pt-1 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => scrollToSection('author-profile')}
                    className="inline-flex items-center gap-2.5 text-left group cursor-pointer"
                  >
                    {authorProfile.avatarUrl ? (
                      <img
                        src={authorProfile.avatarUrl}
                        alt={authorProfile.name}
                        width={32}
                        height={32}
                        className="w-8 h-8 rounded-full object-cover border border-[#2F3E4E] dark:border-[#F9C80E] shrink-0"
                      />
                    ) : (
                      <span className="w-8 h-8 rounded-full bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#F9C80E] dark:text-[#0F172A] font-display font-extrabold text-xs flex items-center justify-center shrink-0">
                        {authorProfile.initials}
                      </span>
                    )}
                    <span>
                      <span className="block font-display font-bold text-[#2F3E4E] dark:text-slate-100 group-hover:underline">
                        {activePost.author}
                      </span>
                      <span className="block text-[11px] text-[#64748B] dark:text-slate-400">
                        {activePost.authorRole}
                      </span>
                    </span>
                  </button>

                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#475569] dark:text-slate-400 font-mono tabular-nums">
                    <span>{activePost.sections.length} sections</span>
                    {readingStats.tableCount > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{readingStats.tableCount} tables</span>
                      </>
                    )}
                    {readingStats.codeLineCount > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{readingStats.codeLineCount} code lines</span>
                      </>
                    )}
                  </div>
                </div>
              </header>

              {/* Featured Themed Cover Image */}
              <figure className="space-y-2">
                <div className="rounded-xl overflow-hidden border-[1.5px] border-[#2F3E4E] dark:border-slate-700 bg-[#FEF2C8] dark:bg-[#0B1120] shadow-[0_3px_0_#2F3E4E] dark:shadow-none">
                  <img
                    src={activePost.coverImage}
                    alt={activePost.coverImageAlt}
                    width={1200}
                    height={630}
                    loading="eager"
                    className="w-full h-auto aspect-[1200/630] object-cover block"
                  />
                </div>
                <figcaption className="text-[11px] font-medium text-[#64748B] dark:text-slate-400 flex flex-wrap items-center justify-between gap-2 px-1">
                  <span>{activePost.coverImageAlt}</span>
                  <span className="font-mono uppercase">{activePost.coverBadge}</span>
                </figcaption>
              </figure>

              {/* Mobile / Tablet Collapsible Table of Contents */}
              <div className="lg:hidden rounded-xl border-[1.5px] border-[#2F3E4E]/35 dark:border-slate-700 bg-[#FEF2C8]/55 dark:bg-[#0B1120] overflow-hidden no-print">
                <button
                  type="button"
                  aria-expanded={mobileTocOpen}
                  onClick={() => setMobileTocOpen((v) => !v)}
                  className="w-full px-4 py-3 flex items-center justify-between gap-2 text-left font-display font-extrabold text-sm text-[#2F3E4E] dark:text-slate-100 cursor-pointer"
                >
                  <span className="inline-flex items-center gap-2">
                    <List className="w-4 h-4 text-[#12805C] dark:text-[#F9C80E]" aria-hidden="true" />
                    <span>Table of Contents ({tocEntries.length} Sections)</span>
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${mobileTocOpen ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  />
                </button>
                {mobileTocOpen && (
                  <nav aria-label="Mobile Table of Contents" className="px-4 pb-3 pt-1 border-t border-[#2F3E4E]/15 dark:border-slate-800">
                    <ul className="space-y-1.5">
                      {tocEntries.map((entry) => (
                        <li key={entry.id}>
                          <button
                            type="button"
                            onClick={() => scrollToSection(entry.id)}
                            className={`w-full text-left py-1 text-xs transition cursor-pointer ${
                              entry.level === 3 ? 'pl-4 text-[11px]' : 'font-semibold'
                            } ${
                              activeHeadingId === entry.id
                                ? 'text-[#12805C] dark:text-[#F9C80E] font-bold'
                                : 'text-[#334155] dark:text-slate-300 hover:text-[#2F3E4E] dark:hover:text-white'
                            }`}
                          >
                            {entry.level === 3 ? `↳ ${entry.label}` : entry.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </nav>
                )}
              </div>

              {/* Key Takeaways Box */}
              <aside
                id="key-takeaways"
                className="scroll-mt-24 rounded-xl bg-[#FEF2C8]/85 dark:bg-[#0B1120] border-[1.5px] border-[#2F3E4E]/35 dark:border-[#F9C80E]/40 p-5 space-y-3"
              >
                <div className="flex items-center gap-2 font-display font-extrabold text-sm text-[#2F3E4E] dark:text-[#F9C80E]">
                  <Sparkles className="w-4 h-4 text-[#B45309] dark:text-[#F9C80E]" aria-hidden="true" />
                  <h2>Key Practical Takeaways</h2>
                </div>
                <ul className="space-y-2">
                  {activePost.keyTakeaways.map((point) => (
                    <li
                      key={point}
                      className="flex items-start gap-2.5 text-xs sm:text-sm leading-relaxed text-[#334155] dark:text-slate-200"
                    >
                      <CheckCircle2
                        className="w-4 h-4 text-[#12805C] dark:text-emerald-400 shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      <span>
                        <RichProseText
                          text={point}
                          onSelectPost={onSelectPost}
                          onOpenTool={onOpenTool}
                        />
                      </span>
                    </li>
                  ))}
                </ul>
              </aside>

              {/* Main Article Content (H2 -> H3 + Text-Based Ads + Internal Anchor Text) */}
              <div className="space-y-8">
                {activePost.sections.map((section, idx) => (
                  <section
                    key={section.id}
                    id={section.id}
                    className="scroll-mt-24 space-y-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] dark:text-slate-50 tracking-tight [text-wrap:balance]">
                        {section.heading}
                      </h2>
                      <button
                        type="button"
                        onClick={() => handleCopySectionAnchor(section.id)}
                        aria-label={`Copy direct link to ${section.heading}`}
                        title="Copy section link"
                        className="p-1.5 rounded-lg text-[#64748B] hover:text-[#2F3E4E] dark:text-slate-400 dark:hover:text-[#F9C80E] hover:bg-[#FEF2C8]/70 dark:hover:bg-slate-800 transition cursor-pointer shrink-0 no-print"
                      >
                        {copiedSectionId === section.id ? (
                          <Check className="w-4 h-4 text-[#12805C] dark:text-emerald-400" aria-hidden="true" />
                        ) : (
                          <Link2 className="w-4 h-4" aria-hidden="true" />
                        )}
                      </button>
                    </div>

                    {section.paragraphs.map((para, pIdx) => (
                      <p
                        key={pIdx}
                        className={`${proseSizeClass} text-[#334155] dark:text-slate-200`}
                      >
                        <RichProseText
                          text={para}
                          onSelectPost={onSelectPost}
                          onOpenTool={onOpenTool}
                        />
                      </p>
                    ))}

                    {section.bullets && section.bullets.length > 0 && (
                      <ul className="space-y-2.5 pt-1">
                        {section.bullets.map((b, bIdx) => (
                          <li
                            key={bIdx}
                            className={`flex items-start gap-3 ${proseSizeClass} text-[#334155] dark:text-slate-200 bg-white/80 dark:bg-[#0B1120] border border-[#2F3E4E]/15 dark:border-slate-700/80 rounded-xl px-4 py-3`}
                          >
                            <span className="w-2 h-2 rounded-full bg-[#12805C] dark:bg-[#F9C80E] shrink-0 mt-2.5" />
                            <span>
                              <RichProseText
                                text={b}
                                onSelectPost={onSelectPost}
                                onOpenTool={onOpenTool}
                              />
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}

                    <BlogContentBlockList
                      blocks={section.blocks}
                      proseSizeClass={proseSizeClass}
                      onSelectPost={onSelectPost}
                      onOpenTool={onOpenTool}
                    />

                    {/* Optional H3 Subsections */}
                    {section.subsections?.map((sub) => (
                      <div
                        key={sub.id}
                        id={sub.id}
                        className="scroll-mt-24 pt-2 pl-3 sm:pl-4 border-l-2 border-[#2F3E4E]/20 dark:border-slate-700 space-y-3"
                      >
                        <h3 className="font-display font-extrabold text-base sm:text-lg text-[#2F3E4E] dark:text-slate-100">
                          {sub.heading}
                        </h3>
                        {sub.paragraphs.map((sp, spIdx) => (
                          <p
                            key={spIdx}
                            className={`${proseSizeClass} text-[#334155] dark:text-slate-300`}
                          >
                            <RichProseText
                              text={sp}
                              onSelectPost={onSelectPost}
                              onOpenTool={onOpenTool}
                            />
                          </p>
                        ))}
                        {sub.bullets && sub.bullets.length > 0 && (
                          <ul className="space-y-2">
                            {sub.bullets.map((sb, sbIdx) => (
                              <li
                                key={sbIdx}
                                className="flex items-start gap-2.5 text-xs sm:text-sm leading-relaxed text-[#334155] dark:text-slate-300"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-[#F9C80E] border border-[#2F3E4E] shrink-0 mt-2" />
                                <span>
                                  <RichProseText
                                    text={sb}
                                    onSelectPost={onSelectPost}
                                    onOpenTool={onOpenTool}
                                  />
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                        <BlogContentBlockList
                          blocks={sub.blocks}
                          proseSizeClass={proseSizeClass}
                          onSelectPost={onSelectPost}
                          onOpenTool={onOpenTool}
                        />
                      </div>
                    ))}

                    {section.proTip && (
                      <div className="flex items-start gap-3 rounded-xl bg-[#CEE5DC]/55 dark:bg-emerald-950/40 border border-[#12805C]/35 dark:border-emerald-700/60 p-4 text-xs sm:text-sm leading-relaxed text-[#2F3E4E] dark:text-emerald-100">
                        <Lightbulb
                          className="w-4 h-4 text-[#12805C] dark:text-[#F9C80E] shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                        <div>
                          <strong className="font-display font-extrabold">Workflow Pro Tip: </strong>
                          <RichProseText
                            text={section.proTip}
                            onSelectPost={onSelectPost}
                            onOpenTool={onOpenTool}
                          />
                        </div>
                      </div>
                    )}

                    {/* In-Between Text-Based Ad Units */}
                    {idx === 0 && (
                      <div className="pt-1">
                        <AdSlot
                          slotId={`vcpl-blog-text-top-${activePost.slug}`}
                          variant="text-inline"
                          contentContext={activePost.title}
                        />
                      </div>
                    )}
                    {idx === 1 && (
                      <div className="pt-1">
                        <AdSlot
                          slotId={`vcpl-blog-inarticle-${activePost.slug}`}
                          variant="in-article"
                          contentContext={activePost.category}
                        />
                      </div>
                    )}
                    {idx === 5 && (
                      <div className="pt-1">
                        <AdSlot
                          slotId={`vcpl-blog-text-mid-${activePost.slug}`}
                          variant="text-inline"
                          contentContext={activePost.title}
                        />
                      </div>
                    )}
                  </section>
                ))}
              </div>

              {activePost.hasPasswordLab && <PasswordSecurityLab />}

              {/* Per-Article Interactive FAQ Section (Synced with FAQPage Schema) */}
              {activePost.faqs.length > 0 && (
                <section
                  id="article-faqs"
                  className="scroll-mt-24 pt-6 border-t border-[#2F3E4E]/15 dark:border-slate-800 space-y-4"
                >
                  <div className="space-y-1">
                    <h2 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] dark:text-slate-50">
                      Frequently Asked Questions
                    </h2>
                    <p className="text-xs sm:text-sm text-[#475569] dark:text-slate-400">
                      Quick answers covering {activePost.category.toLowerCase()} deadlines, statutory
                      forms, and workflows.
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    {activePost.faqs.map((faq, idx) => {
                      const isOpen = openFaqIdx === idx;
                      return (
                        <div
                          key={faq.question}
                          className="rounded-xl border-[1.5px] border-[#2F3E4E]/30 dark:border-slate-700 bg-white/85 dark:bg-[#0B1120] overflow-hidden"
                        >
                          <button
                            type="button"
                            aria-expanded={isOpen}
                            onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                            className="w-full px-4 py-3.5 text-left flex items-center justify-between gap-3 font-display font-bold text-sm text-[#2F3E4E] dark:text-slate-100 hover:bg-[#FEF2C8]/60 dark:hover:bg-slate-800/70 transition cursor-pointer"
                          >
                            <span>{faq.question}</span>
                            <ChevronDown
                              className={`w-4 h-4 shrink-0 transition-transform ${
                                isOpen ? 'rotate-180 text-[#12805C] dark:text-[#F9C80E]' : ''
                              }`}
                              aria-hidden="true"
                            />
                          </button>
                          {isOpen && (
                            <div className="px-4 pb-4 pt-0 text-xs sm:text-sm leading-relaxed text-[#475569] dark:text-slate-300 border-t border-[#2F3E4E]/10 dark:border-slate-800/80">
                              <p className="pt-2.5">{faq.answer}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Conclusion & Statutory Disclaimer */}
              {(activePost.conclusion || activePost.disclaimer) && (
                <section
                  id="article-conclusion"
                  className="scroll-mt-24 pt-6 border-t border-[#2F3E4E]/15 dark:border-slate-800 space-y-4"
                >
                  {activePost.conclusion && activePost.conclusion.length > 0 && (
                    <div className="space-y-3">
                      <h2 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] dark:text-slate-50">
                        Conclusion
                      </h2>
                      {activePost.conclusion.map((para, cIdx) => (
                        <p key={cIdx} className={`${proseSizeClass} text-[#334155] dark:text-slate-200`}>
                          <RichProseText
                            text={para}
                            onSelectPost={onSelectPost}
                            onOpenTool={onOpenTool}
                          />
                        </p>
                      ))}
                    </div>
                  )}

                  {activePost.disclaimer && (
                    <aside className="rounded-xl bg-[#FEF2C8]/65 dark:bg-[#0B1120] border border-[#2F3E4E]/25 dark:border-slate-700 p-4 text-xs leading-relaxed text-[#475569] dark:text-slate-300">
                      <strong className="font-display font-extrabold text-[#2F3E4E] dark:text-[#F9C80E]">
                        Disclaimer:{' '}
                      </strong>
                      <span>{activePost.disclaimer}</span>
                    </aside>
                  )}
                </section>
              )}

              {/* Direct Launch Cards for Tools Covered in This Article */}
              {relatedTools.length > 0 && (
                <section
                  id="featured-tools"
                  className="scroll-mt-24 pt-6 border-t border-[#2F3E4E]/15 dark:border-slate-800 space-y-4"
                >
                  <div className="flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-[#2F3E4E] dark:text-[#F9C80E]" aria-hidden="true" />
                    <h2 className="font-display font-extrabold text-lg sm:text-xl text-[#2F3E4E] dark:text-slate-100">
                      Launch Tools Featured in This Guide
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {relatedTools.map((tool) => (
                      <a
                        key={tool.id}
                        href={getToolPath(tool)}
                        onClick={(e: MouseEvent<HTMLAnchorElement>) => {
                          e.preventDefault();
                          onOpenTool(tool);
                        }}
                        className="group text-left p-4 rounded-xl bg-[#FEF2C8]/65 dark:bg-[#0B1120] hover:bg-[#F9C80E]/35 dark:hover:bg-[#1A253B] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 shadow-[0_3px_0_#2F3E4E] dark:shadow-[0_3px_0_#020617] transition-all hover:-translate-y-0.5 flex flex-col justify-between gap-2.5"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[10px] font-extrabold px-2 py-0.5 rounded bg-[#2F3E4E] text-[#F9C80E]">
                              {tool.code}
                            </span>
                            <span className="text-[11px] font-semibold text-[#12805C] dark:text-emerald-400">
                              {tool.categoryName}
                            </span>
                          </div>
                          <div className="font-display font-extrabold text-sm text-[#2F3E4E] dark:text-slate-100">
                            {tool.title}
                          </div>
                          <p className="text-xs text-[#475569] dark:text-slate-300 line-clamp-2">
                            {tool.description}
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1 text-xs font-display font-extrabold text-[#2F3E4E] dark:text-[#F9C80E]">
                          <span>Open Tool</span>
                          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </a>
                    ))}
                  </div>
                </section>
              )}

              {/* Author E-E-A-T Profile Box */}
              <section
                id="author-profile"
                className="scroll-mt-24 pt-6 border-t border-[#2F3E4E]/15 dark:border-slate-800"
              >
                <div className="rounded-2xl bg-[#FEF2C8]/85 dark:bg-[#0B1120] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 p-5 sm:p-7 shadow-[0_3px_0_#2F3E4E]/15 flex flex-col sm:flex-row gap-5 items-start">
                  {authorProfile.avatarUrl ? (
                    <img
                      src={authorProfile.avatarUrl}
                      alt={authorProfile.name}
                      width={72}
                      height={72}
                      className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-2xl object-cover shrink-0 border-2 border-[#2F3E4E] dark:border-[#F9C80E]"
                    />
                  ) : (
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#F9C80E] dark:text-[#0F172A] font-display font-extrabold text-xl flex items-center justify-center shrink-0 border-2 border-[#2F3E4E]">
                      {authorProfile.initials}
                    </div>
                  )}
                  <div className="space-y-3.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-0.5">
                        <span className="block font-mono text-[11px] font-bold uppercase tracking-wider text-[#12805C] dark:text-[#F9C80E]">
                          {authorProfile.id === 'arjun-bangera'
                            ? 'Technical Author Profile'
                            : 'Editorial Author Profile'}
                        </span>
                        <h2 className="font-display font-extrabold text-lg sm:text-xl text-[#2F3E4E] dark:text-slate-50">
                          About the Author – {authorProfile.name}
                        </h2>
                        <p className="text-xs sm:text-[13px] font-bold text-[#334155] dark:text-slate-300">
                          {authorProfile.role}
                          {authorProfile.experienceLabel ? ` · ${authorProfile.experienceLabel}` : ''}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCategory('All');
                          setSelectedAuthorId(authorProfile.id);
                          setShowSavedOnly(false);
                          onSelectPost(undefined);
                        }}
                        className="px-4 py-2 rounded-lg bg-[#2F3E4E] dark:bg-[#F9C80E] hover:bg-[#12805C] dark:hover:bg-[#FDE047] text-[#FFFDF5] dark:text-[#0F172A] text-xs font-display font-bold transition cursor-pointer whitespace-nowrap"
                      >
                        Articles by {authorProfile.name.split(' ')[0]} →
                      </button>
                    </div>

                    <div className="space-y-2.5 text-xs sm:text-sm leading-relaxed text-[#334155] dark:text-slate-300">
                      {authorProfile.bio.split('\n\n').map((para, pIdx) => (
                        <p key={pIdx}>{para}</p>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-[#2F3E4E]/15 dark:border-slate-800 space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs font-medium text-[#2F3E4E] dark:text-slate-200">
                        {authorProfile.expertise.map((area) => (
                          <div key={area} className="inline-flex items-center gap-1.5">
                            <CheckCircle2
                              className="w-3.5 h-3.5 text-[#12805C] dark:text-[#F9C80E] shrink-0"
                              aria-hidden="true"
                            />
                            <span>{area}</span>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-[11px] font-medium text-[#475569] dark:text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-[#12805C] dark:text-[#F9C80E]" aria-hidden="true" />
                          <span>{authorProfile.location}</span>
                        </span>
                        <a
                          href={`mailto:${authorProfile.email}`}
                          className="inline-flex items-center gap-1 hover:text-[#2F3E4E] dark:hover:text-[#F9C80E] underline underline-offset-2"
                        >
                          <Mail className="w-3.5 h-3.5 text-[#12805C] dark:text-[#F9C80E]" aria-hidden="true" />
                          <span>{authorProfile.email}</span>
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </article>

            {/* Sticky Desktop Sidebar: Interactive Table of Contents + Text Ad + Quick Tool Jump */}
            <aside className="hidden lg:block sticky top-20 space-y-5 no-print">
              <div className="rounded-2xl bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 p-5 shadow-[0_4px_0_#2F3E4E] dark:shadow-[0_4px_0_#020617] space-y-3.5">
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#2F3E4E]/15 dark:border-slate-800">
                  <span className="inline-flex items-center gap-1.5 font-display font-extrabold text-sm text-[#2F3E4E] dark:text-slate-100">
                    <List className="w-4 h-4 text-[#12805C] dark:text-[#F9C80E]" aria-hidden="true" />
                    <span>Table of Contents</span>
                  </span>
                  <span className="font-mono text-[11px] font-bold text-[#12805C] dark:text-[#F9C80E] tabular-nums">
                    {scrollProgress}%
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-[#FEF2C8]/70 dark:bg-[#0B1120] border border-[#2F3E4E]/15 dark:border-slate-800 text-[11px] font-mono font-semibold text-[#2F3E4E] dark:text-slate-300 tabular-nums">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[#12805C] dark:text-[#F9C80E]" aria-hidden="true" />
                    <span>{readingStats.formattedTime}</span>
                  </span>
                  <span>{remainingLabel}</span>
                </div>

                <nav aria-label="Article Table of Contents">
                  <ul className="space-y-1.5">
                    {tocEntries.map((entry) => {
                      const isActive = activeHeadingId === entry.id;
                      return (
                        <li key={entry.id}>
                          <button
                            type="button"
                            onClick={() => scrollToSection(entry.id)}
                            className={`w-full text-left rounded-lg px-2.5 py-1.5 text-xs transition cursor-pointer ${
                              entry.level === 3 ? 'pl-5 text-[11px]' : 'font-semibold'
                            } ${
                              isActive
                                ? 'bg-[#FEF2C8] dark:bg-[#0B1120] text-[#12805C] dark:text-[#F9C80E] font-extrabold border-l-2 border-[#12805C] dark:border-[#F9C80E]'
                                : 'text-[#475569] dark:text-slate-300 hover:bg-[#FEF2C8]/50 dark:hover:bg-slate-800/60 hover:text-[#2F3E4E] dark:hover:text-white'
                            }`}
                          >
                            {entry.label}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </nav>

                <button
                  type="button"
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="w-full pt-2 border-t border-[#2F3E4E]/15 dark:border-slate-800 inline-flex items-center justify-center gap-1.5 text-xs font-display font-bold text-[#2F3E4E] dark:text-slate-300 hover:text-[#12805C] dark:hover:text-[#F9C80E] cursor-pointer"
                >
                  <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Back to Top</span>
                </button>
              </div>

              <AdSlot
                slotId={`vcpl-blog-sidebar-${activePost.slug}`}
                variant="text-inline"
                contentContext={activePost.category}
              />
            </aside>
          </div>

          {/* Previous / Next Post Cards with Featured Thumbnails */}
          <nav aria-label="Adjacent blog articles" className="grid grid-cols-1 sm:grid-cols-2 gap-4 no-print">
            {prevPost ? (
              <a
                href={getBlogPath(prevPost.slug)}
                onClick={(e: MouseEvent<HTMLAnchorElement>) => {
                  e.preventDefault();
                  onSelectPost(prevPost.slug);
                }}
                className="group p-4 rounded-2xl bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 hover:bg-[#FEF2C8] dark:hover:bg-[#1A253B] shadow-[0_3px_0_#2F3E4E] dark:shadow-[0_3px_0_#020617] transition flex items-center gap-3.5"
              >
                <img
                  src={prevPost.coverImage}
                  alt={prevPost.coverImageAlt}
                  width={120}
                  height={63}
                  loading="lazy"
                  className="hidden sm:block w-28 aspect-[1200/630] object-cover rounded-lg border border-[#2F3E4E]/30 bg-[#FEF2C8] shrink-0"
                />
                <div className="min-w-0 space-y-0.5">
                  <span className="inline-flex flex-wrap items-center gap-1 text-[11px] font-mono font-bold text-[#64748B] dark:text-slate-400 tabular-nums">
                    <ArrowLeft className="w-3 h-3" aria-hidden="true" /> Previous Guide · {prevPost.category} ·{' '}
                    {readingStatsBySlug.get(prevPost.slug)?.formattedTime ?? prevPost.readTime}
                  </span>
                  <div className="font-display font-extrabold text-sm text-[#2F3E4E] dark:text-slate-100 line-clamp-2 group-hover:text-[#12805C] dark:group-hover:text-[#F9C80E]">
                    {prevPost.title}
                  </div>
                </div>
              </a>
            ) : (
              <div />
            )}

            {nextPost && (
              <a
                href={getBlogPath(nextPost.slug)}
                onClick={(e: MouseEvent<HTMLAnchorElement>) => {
                  e.preventDefault();
                  onSelectPost(nextPost.slug);
                }}
                className="group p-4 rounded-2xl bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 hover:bg-[#FEF2C8] dark:hover:bg-[#1A253B] shadow-[0_3px_0_#2F3E4E] dark:shadow-[0_3px_0_#020617] transition flex items-center justify-between gap-3.5 text-left sm:text-right"
              >
                <div className="min-w-0 space-y-0.5 flex-1">
                  <span className="inline-flex flex-wrap items-center gap-1 text-[11px] font-mono font-bold text-[#64748B] dark:text-slate-400 sm:justify-end tabular-nums">
                    Next Guide · {nextPost.category} ·{' '}
                    {readingStatsBySlug.get(nextPost.slug)?.formattedTime ?? nextPost.readTime}{' '}
                    <ArrowRight className="w-3 h-3" aria-hidden="true" />
                  </span>
                  <div className="font-display font-extrabold text-sm text-[#2F3E4E] dark:text-slate-100 line-clamp-2 group-hover:text-[#12805C] dark:group-hover:text-[#F9C80E]">
                    {nextPost.title}
                  </div>
                </div>
                <img
                  src={nextPost.coverImage}
                  alt={nextPost.coverImageAlt}
                  width={120}
                  height={63}
                  loading="lazy"
                  className="hidden sm:block w-28 aspect-[1200/630] object-cover rounded-lg border border-[#2F3E4E]/30 bg-[#FEF2C8] shrink-0"
                />
              </a>
            )}
          </nav>

          {/* Related Guides Section */}
          {relatedPosts.length > 0 && (
            <section className="space-y-4 pt-2 no-print">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display font-extrabold text-lg sm:text-xl text-[#2F3E4E] dark:text-slate-50">
                  Related Guides You May Find Helpful
                </h2>
                <button
                  type="button"
                  onClick={() => onSelectPost(undefined)}
                  className="text-xs font-display font-bold text-[#12805C] dark:text-[#F9C80E] hover:underline cursor-pointer"
                >
                  Browse All {allPosts.length} Guides →
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {relatedPosts.map((rp) => (
                  <a
                    key={rp.slug}
                    href={getBlogPath(rp.slug)}
                    onClick={(e: MouseEvent<HTMLAnchorElement>) => {
                      e.preventDefault();
                      onSelectPost(rp.slug);
                    }}
                    className="group rounded-2xl bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 overflow-hidden shadow-[0_3px_0_#2F3E4E] dark:shadow-[0_3px_0_#020617] hover:-translate-y-0.5 hover:bg-white dark:hover:bg-[#1A253B] transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="aspect-[1200/630] w-full overflow-hidden bg-[#FEF2C8] dark:bg-[#0B1120] border-b border-[#2F3E4E]/20">
                        <img
                          src={rp.coverImage}
                          alt={rp.coverImageAlt}
                          width={1200}
                          height={630}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300 block"
                        />
                      </div>
                      <div className="p-5 space-y-2">
                        <span className="inline-block text-[11px] font-mono font-bold uppercase tracking-wider text-[#12805C] dark:text-[#F9C80E] tabular-nums">
                          {rp.category} ·{' '}
                          {readingStatsBySlug.get(rp.slug)?.formattedTime ?? rp.readTime} ·{' '}
                          {(readingStatsBySlug.get(rp.slug)?.wordCount ?? 0).toLocaleString()} words
                        </span>
                        <h3 className="font-display font-extrabold text-base leading-snug text-[#2F3E4E] dark:text-slate-100 group-hover:text-[#12805C] dark:group-hover:text-[#F9C80E] line-clamp-2">
                          {rp.title}
                        </h3>
                        <p className="text-xs sm:text-sm leading-relaxed text-[#475569] dark:text-slate-400 line-clamp-2">
                          {rp.excerpt}
                        </p>
                        <p className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 pt-1">
                          By {rp.author}
                        </p>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* Dismissible Anchor Ad at Reader Footer */}
          <AdSlot
            slotId={`vcpl-blog-anchor-${activePost.slug}`}
            variant="anchor"
            contentContext={activePost.title}
          />
        </div>
      </section>
    );
  }

  // ==========================
  // BLOG INDEX DIRECTORY VIEW
  // ==========================
  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / BLOG_POSTS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safePage - 1) * BLOG_POSTS_PER_PAGE;
  const paginatedPosts = filteredPosts.slice(pageStartIndex, pageStartIndex + BLOG_POSTS_PER_PAGE);
  const pageEndIndex = Math.min(pageStartIndex + paginatedPosts.length, filteredPosts.length);

  const goToBlogPage = (nextPage: number) => {
    const clamped = Math.max(1, Math.min(totalPages, nextPage));
    setCurrentPage(clamped);
    blogSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const pageNumbers = (() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: Array<number | 'ellipsis'> = [1];
    if (safePage > 3) pages.push('ellipsis');
    const start = Math.max(2, safePage - 1);
    const end = Math.min(totalPages - 1, safePage + 1);
    for (let p = start; p <= end; p++) pages.push(p);
    if (safePage < totalPages - 2) pages.push('ellipsis');
    pages.push(totalPages);
    return pages;
  })();

  const kaushikCount = allPosts.filter((p) => p.authorId === 'kaushik-bangera').length;
  const arjunCount = allPosts.filter((p) => p.authorId === 'arjun-bangera').length;
  const visibleCategories = BLOG_CATEGORIES.filter((cat) => {
    if (cat === 'All' || selectedCategory === cat) return true;
    return (liveCountsByCategory.get(cat) ?? 0) > 0;
  });
  const hasActiveFilters =
    selectedCategory !== 'All' ||
    selectedAuthorId !== null ||
    showSavedOnly ||
    searchQuery.trim().length > 0;
  const totalReadingMinutes = filteredPosts.reduce(
    (sum, p) => sum + (readingStatsBySlug.get(p.slug)?.minutes ?? 5),
    0
  );

  return (
    <section className="w-full bg-[#CEE5DC] dark:bg-[#0B1120] min-h-[calc(100dvh-140px)] py-8 md:py-12 transition-colors duration-200">
      <div className="max-w-[1400px] mx-auto pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6 space-y-8">
        {/* Top Breadcrumb Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Breadcrumb">
            <ol className="flex items-center gap-2 text-xs font-semibold text-[#334155] dark:text-slate-300">
              <li>
                <button
                  type="button"
                  onClick={onBackHome}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-[#FFFDF5] dark:bg-[#131C2E] hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] text-xs font-bold text-[#2F3E4E] dark:text-slate-100 dark:hover:text-[#0F172A] transition cursor-pointer whitespace-nowrap shrink-0"
                >
                  <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Back to Home</span>
                </button>
              </li>
              <li aria-hidden="true" className="hidden sm:block text-[#64748B] dark:text-slate-500">
                <ChevronRight className="w-3.5 h-3.5" />
              </li>
              <li
                aria-current="page"
                className="hidden sm:block font-bold text-[#2F3E4E] dark:text-slate-100"
              >
                Blog &amp; Practical Guides
              </li>
            </ol>
          </nav>

          <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-[#2F3E4E] dark:text-slate-200 tabular-nums">
            <Clock className="w-3.5 h-3.5 text-[#12805C] dark:text-[#F9C80E]" aria-hidden="true" />
            <span>
              {filteredPosts.length} {filteredPosts.length === 1 ? 'Article' : 'Articles'} · {totalReadingMinutes} min total reading
            </span>
          </span>
        </div>

        {/* Hero Header + Topic Filter + Author/Bookmark Controls + Search */}
        <header className="bg-[#FEF2C8] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-5 sm:p-7 shadow-[0_5px_0_#2F3E4E] dark:shadow-[0_5px_0_#020617] space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 text-[#12805C] dark:text-[#F9C80E] font-display font-extrabold text-xs uppercase tracking-wider">
                <BookOpen className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>VCPL Tools Blog · Workflows, Compliance &amp; Guides</span>
              </div>

              <h1 className="font-display font-extrabold text-[clamp(1.75rem,3.1vw,2.45rem)] leading-[1.15] text-[#2F3E4E] dark:text-slate-50 tracking-tight [text-wrap:balance]">
                Practical Guides for Tax, GST, Banking &amp; Offline Documents
              </h1>

              <p className="text-sm sm:text-[15px] leading-relaxed text-[#475569] dark:text-slate-300">
                In-depth walkthroughs on Form 26AS TDS/TCS Excel bifurcation, GSTR-1 JSON prep,
                GSTR-2B vs Tally matching, SBI &amp; HDFC banking slips, NPCI UPI QRs, and local
                browser security.
              </p>
            </div>

            <div className="w-full lg:w-[370px] shrink-0 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono font-bold text-[#475569] dark:text-slate-400 px-0.5">
                <span>
                  Kaushik ({kaushikCount}) · Arjun ({arjunCount})
                </span>
                <span className="tabular-nums text-[#12805C] dark:text-[#F9C80E]">
                  {filteredPosts.length}/{allPosts.length} showing
                </span>
              </div>

              <div className="relative w-full">
                <Search
                  className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B] dark:text-slate-400 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search articles, 26AS, GST, Argon2..."
                  aria-label="Search blog articles"
                  className="w-full h-11 pl-10 pr-9 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-[#FFFDF5] dark:bg-[#0B1120] shadow-[0_2px_0_#2F3E4E] dark:shadow-[0_2px_0_#020617] text-xs sm:text-sm font-medium text-[#2F3E4E] dark:text-slate-100 placeholder:text-[#64748B] dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2F3E4E] dark:focus:ring-[#F9C80E]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded text-[#64748B] dark:text-slate-400 hover:text-[#2F3E4E] dark:hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Category Filter Strip */}
          <div className="pt-4 border-t border-[#2F3E4E]/15 dark:border-slate-700/80 space-y-3.5">
            <div className="flex flex-wrap items-center gap-2">
              {visibleCategories.map((cat) => {
                const isSelected = selectedCategory === cat;
                const count =
                  cat === 'All' ? allPosts.length : liveCountsByCategory.get(cat) ?? 0;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-display font-bold border-[1.5px] transition-colors cursor-pointer whitespace-nowrap ${
                      isSelected
                        ? 'bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#F9C80E] dark:text-[#0F172A] border-[#2F3E4E] dark:border-[#F9C80E] shadow-[0_2px_0_#1E293B]'
                        : 'bg-[#FFFDF5] dark:bg-[#0B1120] text-[#2F3E4E] dark:text-slate-200 border-[#2F3E4E]/35 dark:border-slate-700 hover:bg-[#F9C80E]/45 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>{cat}</span>
                    <span
                      className={`font-mono text-[11px] tabular-nums ${
                        isSelected ? 'opacity-90' : 'text-[#64748B] dark:text-slate-400'
                      }`}
                    >
                      ({count})
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Dedicated Author, Sort & Bookmarks Toolbar */}
            <div className="pt-3.5 border-t border-[#2F3E4E]/12 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Author Attribution Filter */}
                <div
                  className="inline-flex items-stretch h-9 rounded-lg border-[1.5px] border-[#2F3E4E]/40 dark:border-slate-700 divide-x divide-[#2F3E4E]/20 dark:divide-slate-700 overflow-hidden bg-[#FFFDF5] dark:bg-[#0B1120]"
                  role="group"
                  aria-label="Filter articles by author"
                >
                  <button
                    type="button"
                    onClick={() => setSelectedAuthorId(null)}
                    className={`px-3 inline-flex items-center gap-1.5 text-xs font-display font-bold transition cursor-pointer whitespace-nowrap ${
                      selectedAuthorId === null
                        ? 'bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#F9C80E] dark:text-[#0F172A]'
                        : 'text-[#2F3E4E] dark:text-slate-200 hover:bg-[#FEF2C8] dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>All Authors</span>
                    <span className="font-mono text-[11px] opacity-80 tabular-nums">
                      ({allPosts.length})
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedAuthorId('kaushik-bangera')}
                    className={`px-3 inline-flex items-center gap-1.5 text-xs font-display font-bold transition cursor-pointer whitespace-nowrap ${
                      selectedAuthorId === 'kaushik-bangera'
                        ? 'bg-[#12805C] dark:bg-[#F9C80E] text-white dark:text-[#0F172A]'
                        : 'text-[#2F3E4E] dark:text-slate-200 hover:bg-[#FEF2C8] dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>Kaushik</span>
                    <span className="font-mono text-[11px] opacity-80 tabular-nums">
                      ({kaushikCount})
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedAuthorId('arjun-bangera')}
                    className={`px-3 inline-flex items-center gap-1.5 text-xs font-display font-bold transition cursor-pointer whitespace-nowrap ${
                      selectedAuthorId === 'arjun-bangera'
                        ? 'bg-[#12805C] dark:bg-[#F9C80E] text-white dark:text-[#0F172A]'
                        : 'text-[#2F3E4E] dark:text-slate-200 hover:bg-[#FEF2C8] dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>Arjun · Technical</span>
                    <span className="font-mono text-[11px] opacity-80 tabular-nums">
                      ({arjunCount})
                    </span>
                  </button>
                </div>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory('All');
                      setSelectedAuthorId(null);
                      setShowSavedOnly(false);
                      setSearchQuery('');
                    }}
                    className="inline-flex items-center gap-1 h-9 px-3 rounded-lg border-[1.5px] border-[#2F3E4E]/30 dark:border-slate-700 bg-white/75 dark:bg-[#0B1120] hover:bg-white dark:hover:bg-slate-800 text-xs font-display font-bold text-[#2F3E4E] dark:text-slate-200 transition cursor-pointer whitespace-nowrap"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Reset filters</span>
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Sort by Reading Time */}
                <div className="relative inline-flex items-center">
                  <select
                    aria-label="Sort articles"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as BlogSortOrder)}
                    className="appearance-none h-9 pl-3 pr-8 rounded-lg text-xs font-display font-bold border-[1.5px] border-[#2F3E4E]/40 dark:border-slate-700 bg-[#FFFDF5] dark:bg-[#0B1120] text-[#2F3E4E] dark:text-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#2F3E4E] dark:focus:ring-[#F9C80E]"
                  >
                    <option value="latest">Sort: Latest</option>
                    <option value="longest">Sort: Longest Read</option>
                    <option value="quickest">Sort: Quickest Read</option>
                  </select>
                  <ChevronDown
                    className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-[#475569] dark:text-slate-400 pointer-events-none"
                    aria-hidden="true"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setShowSavedOnly((v) => !v)}
                  aria-pressed={showSavedOnly}
                  className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-xs font-display font-bold border-[1.5px] transition cursor-pointer whitespace-nowrap ${
                    showSavedOnly
                      ? 'bg-[#F9C80E] text-[#0F172A] border-[#2F3E4E] shadow-[0_2px_0_#2F3E4E]'
                      : 'bg-[#FFFDF5] dark:bg-[#0B1120] text-[#2F3E4E] dark:text-slate-200 border-[#2F3E4E]/40 dark:border-slate-700 hover:bg-[#F9C80E]/45'
                  }`}
                >
                  <Bookmark
                    className={`w-3.5 h-3.5 ${showSavedOnly ? 'fill-current' : ''}`}
                    aria-hidden="true"
                  />
                  <span>Saved</span>
                  <span className="font-mono text-[11px] tabular-nums">
                    ({savedSlugs.length})
                  </span>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Accountant Knowledge Hub — Interactive Topic Heads Grid */}
        <section
          aria-label="Accountant Knowledge Hub Topic Heads"
          className="space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="inline-flex items-center gap-2 font-display font-extrabold text-base sm:text-lg text-[#2F3E4E] dark:text-slate-100">
              <Layers className="w-4 h-4 text-[#12805C] dark:text-[#F9C80E]" aria-hidden="true" />
              <span>Accountant Knowledge Hub · Topic Heads</span>
            </h2>
            <span className="text-xs font-mono font-semibold text-[#475569] dark:text-slate-300">
              {allPosts.length} Published Guides · {BLOG_TOPIC_HEADS.length} Topic Heads
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {BLOG_TOPIC_HEADS.map((topic) => {
              const isSelected = selectedCategory === topic.category;
              const liveCount = liveCountsByCategory.get(topic.category) ?? 0;
              const recTool = getToolById(topic.recommendedToolId);

              return (
                <div
                  key={topic.slug}
                  className={`rounded-xl border-[1.5px] p-4 transition-all flex flex-col justify-between gap-2.5 ${
                    isSelected
                      ? 'bg-[#FEF2C8] dark:bg-[#1E293B] border-[#2F3E4E] dark:border-[#F9C80E] shadow-[0_3px_0_#2F3E4E] dark:shadow-[0_3px_0_#F9C80E]'
                      : 'bg-[#FFFDF5] dark:bg-[#131C2E] border-[#2F3E4E]/45 dark:border-slate-700 hover:border-[#2F3E4E] dark:hover:border-slate-500 shadow-[0_2px_0_#2F3E4E]/20'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedCategory((prev) =>
                        prev === topic.category ? 'All' : topic.category
                      )
                    }
                    className="text-left space-y-1 cursor-pointer group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display font-extrabold text-sm text-[#2F3E4E] dark:text-slate-100 group-hover:text-[#12805C] dark:group-hover:text-[#F9C80E]">
                        {topic.shortLabel}
                      </span>
                      <span className="font-mono text-[11px] font-bold text-[#12805C] dark:text-[#F9C80E] whitespace-nowrap">
                        {liveCount} {liveCount === 1 ? 'Guide' : 'Guides'}
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-[#475569] dark:text-slate-300 line-clamp-2">
                      {topic.subtitle}
                    </p>
                  </button>

                  {recTool && (
                    <a
                      href={getToolPath(recTool)}
                      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
                        e.preventDefault();
                        onOpenTool(recTool);
                      }}
                      className="pt-2 border-t border-[#2F3E4E]/12 dark:border-slate-800 inline-flex items-center justify-between gap-1.5 text-[11px] font-display font-bold text-[#12805C] dark:text-emerald-300 hover:text-[#2F3E4E] dark:hover:text-[#F9C80E]"
                    >
                      <span className="inline-flex items-center gap-1 truncate">
                        <Wrench className="w-3 h-3 shrink-0" aria-hidden="true" />
                        <span className="truncate">{topic.recommendedToolLabel}</span>
                      </span>
                      <ArrowRight className="w-3 h-3 shrink-0" aria-hidden="true" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Empty State */}
        {filteredPosts.length === 0 ? (
          (() => {
            const activeTopicHead = BLOG_TOPIC_HEADS.find(
              (t) => t.category === selectedCategory
            );
            const activeTopicTool = activeTopicHead
              ? getToolById(activeTopicHead.recommendedToolId)
              : undefined;

            return (
              <div className="max-w-2xl mx-auto bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-6 sm:p-8 shadow-[0_4px_0_#2F3E4E] space-y-5">
                <div className="flex items-start gap-3">
                  <BookOpen
                    className="w-7 h-7 text-[#12805C] dark:text-[#F9C80E] shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <div className="space-y-1">
                    <h2 className="font-display font-extrabold text-lg text-[#2F3E4E] dark:text-slate-100">
                      {activeTopicHead && !searchQuery && !showSavedOnly
                        ? `${activeTopicHead.shortLabel} — Tools & Resources`
                        : 'No matching articles found'}
                    </h2>
                    <p className="text-xs sm:text-sm text-[#475569] dark:text-slate-300">
                      {activeTopicHead && !searchQuery && !showSavedOnly
                        ? `${activeTopicHead.subtitle}. Launch the recommended utility below or browse all guides across our Indian Accountant Knowledge Hub.`
                        : 'Try clearing your search filter or exploring all guides in our Indian Accountant Knowledge Hub.'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  {activeTopicTool && (
                    <a
                      href={getToolPath(activeTopicTool)}
                      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
                        e.preventDefault();
                        onOpenTool(activeTopicTool);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#12805C] text-white text-xs font-display font-extrabold hover:bg-[#0F6E4E] transition"
                    >
                      <Wrench className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{activeTopicHead?.recommendedToolLabel}</span>
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory('All');
                      setSelectedAuthorId(null);
                      setShowSavedOnly(false);
                      setSearchQuery('');
                    }}
                    className="px-4 py-2 rounded-lg bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#FFFDF5] dark:text-[#0F172A] text-xs font-display font-bold cursor-pointer"
                  >
                    Show All {allPosts.length} Guides
                  </button>
                </div>
              </div>
            );
          })()
        ) : (
          <div className="space-y-8">
            {/* Fixed-Count Blog Section Box with Page-Wise Pagination */}
            <section
              ref={blogSectionRef}
              aria-label="Published Blog Articles"
              className="scroll-mt-20 rounded-2xl bg-[#FEF2C8]/75 dark:bg-[#131C2E]/90 border-[1.5px] border-[#2F3E4E] dark:border-slate-700 p-5 sm:p-6 shadow-[0_5px_0_#2F3E4E] dark:shadow-[0_5px_0_#020617] space-y-5"
            >
              {/* Blog Section Box Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-[#2F3E4E]/15 dark:border-slate-700/80">
                <div className="space-y-0.5">
                  <h2 className="inline-flex items-center gap-2 font-display font-extrabold text-base sm:text-lg text-[#2F3E4E] dark:text-slate-100">
                    <BookOpen className="w-4 h-4 text-[#12805C] dark:text-[#F9C80E]" aria-hidden="true" />
                    <span>Published Blog Guides</span>
                  </h2>
                  <p className="text-xs font-mono text-[#475569] dark:text-slate-400 tabular-nums">
                    Showing {pageStartIndex + 1}–{pageEndIndex} of {filteredPosts.length}{' '}
                    {filteredPosts.length === 1 ? 'article' : 'articles'} · {BLOG_POSTS_PER_PAGE} per page
                  </p>
                </div>

                {totalPages > 1 && (
                  <div className="inline-flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-[#2F3E4E] dark:text-slate-300 tabular-nums mr-1">
                      Page {safePage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={safePage <= 1}
                      onClick={() => goToBlogPage(safePage - 1)}
                      aria-label="Previous blog page"
                      className="inline-flex items-center justify-center w-9 h-9 rounded-lg border-[1.5px] border-[#2F3E4E]/40 dark:border-slate-700 bg-[#FFFDF5] dark:bg-[#0B1120] text-[#2F3E4E] dark:text-slate-200 hover:bg-[#F9C80E]/55 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      disabled={safePage >= totalPages}
                      onClick={() => goToBlogPage(safePage + 1)}
                      aria-label="Next blog page"
                      className="inline-flex items-center justify-center w-9 h-9 rounded-lg border-[1.5px] border-[#2F3E4E]/40 dark:border-slate-700 bg-[#FFFDF5] dark:bg-[#0B1120] text-[#2F3E4E] dark:text-slate-200 hover:bg-[#F9C80E]/55 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>

              {/* Fixed-Number Grid of Blog Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {paginatedPosts.map((post, idx) => {
                  const isSaved = savedSlugs.includes(post.slug);
                  const isLeadOnFirstPage = safePage === 1 && idx === 0 && !hasActiveFilters;
                  return (
                    <article
                      key={post.slug}
                      className="group rounded-2xl bg-[#FFFDF5] dark:bg-[#0B1120] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 overflow-hidden shadow-[0_4px_0_#2F3E4E] dark:shadow-[0_4px_0_#020617] hover:-translate-y-0.5 hover:bg-white dark:hover:bg-[#1A253B] transition-all flex flex-col justify-between"
                    >
                      <div>
                        <a
                          href={getBlogPath(post.slug)}
                          onClick={(e: MouseEvent<HTMLAnchorElement>) => {
                            e.preventDefault();
                            onSelectPost(post.slug);
                          }}
                          className="block overflow-hidden bg-[#FEF2C8] dark:bg-[#0B1120] border-b border-[#2F3E4E]/20"
                        >
                          <img
                            src={post.coverImage}
                            alt={post.coverImageAlt}
                            width={1200}
                            height={630}
                            loading={idx < 3 ? 'eager' : 'lazy'}
                            className="w-full h-auto aspect-[1200/630] object-cover group-hover:scale-[1.02] transition-transform duration-300"
                          />
                        </a>

                        <div className="p-5 space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                            <span className="font-mono font-bold uppercase tracking-wider text-[#12805C] dark:text-[#F9C80E]">
                              {isLeadOnFirstPage ? 'Featured · ' : ''}
                              {post.articleType === 'technical' ? 'Technical' : post.category}
                            </span>
                            <span className="font-mono font-semibold text-[#64748B] dark:text-slate-400 tabular-nums">
                              {readingStatsBySlug.get(post.slug)?.formattedTime ?? post.readTime} ·{' '}
                              {(readingStatsBySlug.get(post.slug)?.wordCount ?? 0).toLocaleString()} words
                            </span>
                          </div>

                          <a
                            href={getBlogPath(post.slug)}
                            onClick={(e: MouseEvent<HTMLAnchorElement>) => {
                              e.preventDefault();
                              onSelectPost(post.slug);
                            }}
                            className="block"
                          >
                            <h3 className="font-display font-extrabold text-lg leading-snug text-[#2F3E4E] dark:text-slate-100 group-hover:text-[#12805C] dark:group-hover:text-[#F9C80E] transition-colors">
                              {post.title}
                            </h3>
                          </a>

                          <p className="text-xs sm:text-sm leading-relaxed text-[#475569] dark:text-slate-300 line-clamp-3">
                            {post.excerpt}
                          </p>
                        </div>
                      </div>

                      <div className="px-5 py-3.5 border-t border-[#2F3E4E]/15 dark:border-slate-800 flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setSelectedAuthorId(post.authorId)}
                          className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 hover:text-[#2F3E4E] dark:hover:text-[#F9C80E] truncate cursor-pointer"
                        >
                          By {post.author}
                        </button>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => toggleBookmark(post.slug)}
                            aria-label={isSaved ? 'Remove saved article' : 'Save article'}
                            className="p-1.5 rounded-md hover:bg-[#FEF2C8] dark:hover:bg-slate-800 text-[#64748B] dark:text-slate-400 cursor-pointer"
                          >
                            <Bookmark
                              className={`w-3.5 h-3.5 ${isSaved ? 'fill-current text-[#B45309] dark:text-[#F9C80E]' : ''}`}
                              aria-hidden="true"
                            />
                          </button>
                          <a
                            href={getBlogPath(post.slug)}
                            onClick={(e: MouseEvent<HTMLAnchorElement>) => {
                              e.preventDefault();
                              onSelectPost(post.slug);
                            }}
                            className="inline-flex items-center gap-1 text-xs font-display font-extrabold text-[#2F3E4E] dark:text-[#F9C80E]"
                          >
                            <span>Read Guide</span>
                            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                          </a>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* Page-Wise Pagination Controls Footer */}
              {totalPages > 1 && (
                <div className="pt-4 border-t border-[#2F3E4E]/15 dark:border-slate-700/80 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs font-mono font-semibold text-[#475569] dark:text-slate-400 tabular-nums">
                    Page {safePage} of {totalPages} · Showing {pageStartIndex + 1}–{pageEndIndex} of{' '}
                    {filteredPosts.length} blogs
                  </span>

                  <nav aria-label="Blog pagination" className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      disabled={safePage <= 1}
                      onClick={() => goToBlogPage(safePage - 1)}
                      className="inline-flex items-center gap-1 h-9 px-3 rounded-lg border-[1.5px] border-[#2F3E4E]/40 dark:border-slate-700 bg-[#FFFDF5] dark:bg-[#0B1120] text-xs font-display font-bold text-[#2F3E4E] dark:text-slate-200 hover:bg-[#F9C80E]/55 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Prev</span>
                    </button>

                    {pageNumbers.map((item, idx) =>
                      item === 'ellipsis' ? (
                        <span
                          key={`ellipsis-${idx}`}
                          className="px-1.5 text-xs font-mono font-bold text-[#64748B] dark:text-slate-400"
                        >
                          …
                        </span>
                      ) : (
                        <button
                          key={item}
                          type="button"
                          onClick={() => goToBlogPage(item)}
                          aria-current={item === safePage ? 'page' : undefined}
                          className={`inline-flex items-center justify-center min-w-[36px] h-9 px-2.5 rounded-lg border-[1.5px] text-xs font-mono font-bold transition cursor-pointer tabular-nums ${
                            item === safePage
                              ? 'bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#F9C80E] dark:text-[#0F172A] border-[#2F3E4E] dark:border-[#F9C80E] shadow-[0_2px_0_#1E293B]'
                              : 'bg-[#FFFDF5] dark:bg-[#0B1120] text-[#2F3E4E] dark:text-slate-200 border-[#2F3E4E]/35 dark:border-slate-700 hover:bg-[#F9C80E]/45 dark:hover:bg-slate-800'
                          }`}
                        >
                          {item}
                        </button>
                      )
                    )}

                    <button
                      type="button"
                      disabled={safePage >= totalPages}
                      onClick={() => goToBlogPage(safePage + 1)}
                      className="inline-flex items-center gap-1 h-9 px-3 rounded-lg border-[1.5px] border-[#2F3E4E]/40 dark:border-slate-700 bg-[#FFFDF5] dark:bg-[#0B1120] text-xs font-display font-bold text-[#2F3E4E] dark:text-slate-200 hover:bg-[#F9C80E]/55 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </nav>
                </div>
              )}
            </section>

            {/* Editorial Leaderboard Ad */}
            <AdSlot
              slotId="vcpl-blog-leaderboard"
              variant="leaderboard"
              label="Blog Directory Leaderboard · 728 × 90"
              contentContext="Indian Accounting, GST, Banking & Document Guides"
            />

            {/* Editorial & Technical Authors Directory Section */}
            <section
              aria-label="Publication Authors"
              className="pt-4 grid grid-cols-1 lg:grid-cols-2 gap-6"
            >
              {(['kaushik-bangera', 'arjun-bangera'] as const).map((authorKey) => {
                const profile = BLOG_AUTHORS[authorKey];
                const authorPosts = allPosts.filter((p) => p.authorId === authorKey);
                const authorArticleCount = authorPosts.length;
                const authorTotalMinutes = authorPosts.reduce(
                  (sum, p) => sum + (readingStatsBySlug.get(p.slug)?.minutes ?? 5),
                  0
                );

                return (
                  <div
                    key={profile.id}
                    className="rounded-2xl bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 p-6 shadow-[0_4px_0_#2F3E4E] dark:shadow-[0_4px_0_#020617] flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3.5">
                          {profile.avatarUrl ? (
                            <img
                              src={profile.avatarUrl}
                              alt={profile.name}
                              width={56}
                              height={56}
                              className="w-14 h-14 rounded-xl object-cover border-[1.5px] border-[#2F3E4E] dark:border-[#F9C80E] shrink-0"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-xl bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#F9C80E] dark:text-[#0F172A] font-display font-extrabold text-lg flex items-center justify-center shrink-0">
                              {profile.initials}
                            </div>
                          )}
                          <div>
                            <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#12805C] dark:text-[#F9C80E]">
                              {profile.id === 'arjun-bangera'
                                ? 'Technical & Security Articles'
                                : 'All Accounting, Tax & General Articles'}
                            </p>
                            <h2 className="font-display font-extrabold text-lg text-[#2F3E4E] dark:text-slate-100">
                              About the Author – {profile.name}
                            </h2>
                            <p className="text-xs text-[#475569] dark:text-slate-400">
                              {profile.role}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="block font-mono text-xs font-bold text-[#2F3E4E] dark:text-slate-300 tabular-nums">
                            {authorArticleCount} {authorArticleCount === 1 ? 'Article' : 'Articles'}
                          </span>
                          <span className="block font-mono text-[11px] text-[#12805C] dark:text-[#F9C80E] tabular-nums">
                            {authorTotalMinutes} min total read
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2 text-xs sm:text-[13px] leading-relaxed text-[#475569] dark:text-slate-300">
                        {profile.bio.split('\n\n').map((para, idx) => (
                          <p key={idx}>{para}</p>
                        ))}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[#2F3E4E]/15 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                      <span className="text-[11px] font-mono text-[#64748B] dark:text-slate-400">
                        {profile.expertise.slice(0, 2).join(' · ')}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCategory('All');
                          setSelectedAuthorId(profile.id);
                          window.scrollTo({top: 0, behavior: 'smooth'});
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#FFFDF5] dark:text-[#0F172A] text-xs font-display font-bold hover:bg-[#12805C] dark:hover:bg-[#FDE047] transition cursor-pointer whitespace-nowrap"
                      >
                        <span>Read {profile.name.split(' ')[0]}&apos;s Articles</span>
                        <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </section>
          </div>
        )}
      </div>
    </section>
  );
}
