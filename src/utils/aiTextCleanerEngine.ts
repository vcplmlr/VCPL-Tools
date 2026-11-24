export type CleanPresetId =
  | 'cleanAll'
  | 'plain'
  | 'email'
  | 'linkedin'
  | 'strict'
  | 'markdownOnly';

export type CodeFenceMode = 'unwrap' | 'keep' | 'remove';
export type LinkMode = 'text' | 'both' | 'url';
export type ImageMode = 'alt' | 'remove';
export type BulletMode = 'dash' | 'dot' | 'none' | 'keep';
export type NumberedListMode = 'keep' | 'remove';
export type TableMode = 'aligned' | 'tab' | 'csv';
export type EmDashMode = 'comma' | 'hyphen' | 'keep';

export interface CleanOptions {
  // AI Text Cleanup
  filler: boolean;
  cites: boolean;
  emoji: boolean;
  // Markdown Removal
  headings: boolean;
  emph: boolean;
  quotes: boolean;
  rules: boolean;
  inlinecode: boolean;
  fences: CodeFenceMode;
  links: LinkMode;
  images: ImageMode;
  html: boolean;
  latex: boolean;
  escapes: boolean;
  // Invisible Characters & Unwanted Symbols
  hidden: boolean;
  spaces: boolean;
  symbols: boolean;
  // Punctuation, Lists & Tables
  smart: boolean;
  emdash: EmDashMode;
  ellipsis: boolean;
  bullets: BulletMode;
  numbers: NumberedListMode;
  indent: boolean;
  tables: TableMode;
  // Spacing & Paragraph Formatting
  trim: boolean;
  maxblank: number;
  join: boolean;
  normalizeParagraphs: boolean;
}

export interface CleanCounts {
  md: number;
  table: number;
  filler: number;
  emoji: number;
  hidden: number;
  spaces: number;
  symbols: number;
  cite: number;
  punct: number;
  spacing: number;
}

export interface TextStats {
  words: number;
  chars: number;
  charsNoSpaces: number;
  lines: number;
  paragraphs: number;
}

export interface CleanResult {
  output: string;
  counts: CleanCounts;
  beforeStats: TextStats;
  afterStats: TextStats;
  totalFixes: number;
}

export interface LineDiffEntry {
  kind: 'same' | 'removed' | 'added';
  text: string;
  beforeLineNo?: number;
  afterLineNo?: number;
}

export const DEFAULT_CLEAN_OPTIONS: CleanOptions = {
  filler: true,
  cites: true,
  emoji: true,
  headings: true,
  emph: true,
  quotes: true,
  rules: true,
  inlinecode: true,
  fences: 'unwrap',
  links: 'text',
  images: 'alt',
  html: true,
  latex: true,
  escapes: true,
  hidden: true,
  spaces: true,
  symbols: true,
  smart: true,
  emdash: 'comma',
  ellipsis: true,
  bullets: 'dash',
  numbers: 'keep',
  indent: false,
  tables: 'aligned',
  trim: true,
  maxblank: 1,
  join: false,
  normalizeParagraphs: true,
};

export const CLEAN_PRESETS: Record<
  CleanPresetId,
  { label: string; description: string; overrides: Partial<CleanOptions> }
> = {
  cleanAll: {
    label: 'Clean All',
    description:
      'Turns on every AI, Markdown, invisible-char, stray-symbol, citation, smart-quote & spacing cleaner.',
    overrides: {
      filler: true,
      cites: true,
      emoji: true,
      headings: true,
      emph: true,
      quotes: true,
      rules: true,
      inlinecode: true,
      fences: 'unwrap',
      links: 'text',
      images: 'alt',
      html: true,
      latex: true,
      escapes: true,
      hidden: true,
      spaces: true,
      symbols: true,
      smart: true,
      emdash: 'comma',
      ellipsis: true,
      bullets: 'dash',
      numbers: 'keep',
      indent: true,
      tables: 'aligned',
      trim: true,
      maxblank: 1,
      join: true,
      normalizeParagraphs: true,
    },
  },
  plain: {
    label: 'Plain Text',
    description: 'Balanced clean plain text with crisp dashes and readable structure.',
    overrides: {},
  },
  email: {
    label: 'Email Ready',
    description: 'Clean paragraphs, dash bullets, aligned columns & standard punctuation for email.',
    overrides: {
      bullets: 'dash',
      emdash: 'comma',
      tables: 'aligned',
      maxblank: 1,
      join: false,
    },
  },
  linkedin: {
    label: 'LinkedIn / Social',
    description: 'Bullet dots (•), clean paragraph breaks, no Markdown clutter or AI filler.',
    overrides: {
      bullets: 'dot',
      emdash: 'comma',
      maxblank: 1,
      numbers: 'keep',
      emoji: false,
    },
  },
  strict: {
    label: 'Strict Clean',
    description: 'Strips bullet/number prefixes, joins wrapped lines, removes decorative symbols.',
    overrides: {
      bullets: 'none',
      numbers: 'remove',
      indent: true,
      join: true,
      emdash: 'comma',
      fences: 'unwrap',
      links: 'text',
      symbols: true,
    },
  },
  markdownOnly: {
    label: 'Markdown Only',
    description: 'Removes Markdown & HTML formatting while keeping emoji, citations & punctuation.',
    overrides: {
      filler: false,
      emoji: false,
      smart: false,
      emdash: 'keep',
      ellipsis: false,
      hidden: false,
      spaces: false,
      symbols: false,
      cites: false,
    },
  },
};

export const SAMPLE_AI_TEXT = `Certainly! Here's a quick release checklist for the operations team 🚀

### Key Guidelines

**Rule 1:** Always send *concise* updates—avoid vague claims 💡
**Rule 2:** Verify ~~draft~~ figures against Tally & Form 26AS [1]【4†source】

> Note: Never alter the original invoice wording…

---

| Task | Owner | Due |
|---|---|---|
| Reconcile GSTR-2B | **Asha** | Mon |
| Verify RTGS Slips | Ravi | Wed |

1. Review the [compliance handbook](https://example.com/handbook)
2. Run \`npm run check\` before release
   ◆ Confirm invisible spaces\u200B and stray symbols ★ are cleared
   - Archive signed voucher PDF

\`\`\`ts
const netAmount = taxableValue + gstTotal;
\`\`\`

Formula check: \\(A = \\pi r^2\\) — it’s “verified” for filing.

I hope this helps! Let me know if you'd like me to expand any section. 🎉`;

const FILL_CLOSE =
  /^(i hope (this|that) helps|hope (this|that) helps|let me know|feel free|would you like|do you want me|if you(?:'d| would) like|if you want|want me to|is there anything|happy to (help|adjust|tweak)|i can also|just let me know)/i;

export function computeTextStats(text: string): TextStats {
  const normalized = text.replace(/\r\n?/g, '\n');
  const trimmed = normalized.trim();
  if (!trimmed) {
    return {
      words: 0,
      chars: normalized.length,
      charsNoSpaces: normalized.replace(/\s/g, '').length,
      lines: normalized ? normalized.split('\n').length : 0,
      paragraphs: 0,
    };
  }
  const wordMatches = trimmed.match(/\S+/g);
  return {
    words: wordMatches ? wordMatches.length : 0,
    chars: normalized.length,
    charsNoSpaces: normalized.replace(/\s/g, '').length,
    lines: normalized.split('\n').length,
    paragraphs: trimmed.split(/\n{2,}/).filter((p) => p.trim().length > 0).length,
  };
}

export function cleanAiText(source: string, options: CleanOptions): CleanResult {
  const counts: CleanCounts = {
    md: 0,
    table: 0,
    filler: 0,
    emoji: 0,
    hidden: 0,
    spaces: 0,
    symbols: 0,
    cite: 0,
    punct: 0,
    spacing: 0,
  };

  const beforeStats = computeTextStats(source);
  let t = String(source || '').replace(/\r\n?/g, '\n');

  const rep = (
    re: RegExp,
    replacement: string | ((...args: string[]) => string),
    key: keyof CleanCounts
  ) => {
    t = t.replace(re, (...args: unknown[]) => {
      counts[key] += 1;
      if (typeof replacement === 'function') {
        return replacement(...(args as string[]));
      }
      return replacement.replace(/\$(\d)/g, (_m, n) => String(args[Number(n)] ?? ''));
    });
  };

  // 1. Invisible characters first so subsequent pattern matching is clean
  if (options.hidden) {
    rep(/[\u200B-\u200F\u2060\uFEFF\u00AD\u202A-\u202E\u2066-\u2069]/g, '', 'hidden');
  }

  // 2. Odd Unicode spaces -> standard ASCII space
  if (options.spaces) {
    rep(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ', 'spaces');
  }

  // 3. Stash code blocks & inline code so internal characters are preserved when requested
  const stash: string[] = [];
  const keep = (val: string) => {
    stash.push(val);
    return `\u0001${stash.length - 1}\u0002`;
  };

  if (options.fences !== 'keep') {
    t = t.replace(
      /(^|\n)[ \t]*(```|~~~)[^\n]*\n([\s\S]*?)\n?[ \t]*\2[ \t]*(?=\n|$)/g,
      (_m, a: string, _fence: string, body: string) => {
        counts.md += 1;
        if (options.fences === 'remove') return a;
        return a + keep(body);
      }
    );
  } else {
    t = t.replace(
      /(^|\n)[ \t]*(```|~~~)[^\n]*\n([\s\S]*?)\n?[ \t]*\2[ \t]*(?=\n|$)/g,
      (full) => keep(full)
    );
  }

  if (options.inlinecode) {
    t = t.replace(/`([^`\n]+)`/g, (_m, code: string) => {
      counts.md += 1;
      return keep(code);
    });
  }

  // 4. HTML tags
  if (options.html) {
    t = t.replace(/<br\s*\/?>/gi, '\n');
    rep(/<\/?[a-z][a-z0-9-]*(\s[^<>]*)?>/gi, '', 'md');
  }

  // 5. AI citation tokens ([1], 【4†source】, ChatGPT contentReference)
  if (options.cites) {
    rep(/[\ue200][^\ue201]*[\ue201]/g, '', 'cite');
    rep(/【[^】]*】/g, '', 'cite');
    rep(/:?contentReference\[[^\]]*\]\{[^}]*\}/g, '', 'cite');
    rep(/[ \t]?\[\d{1,3}(?:[,\u2013-]\s?\d{1,3})*\](?!\()/g, '', 'cite');
  }

  // 6. Markdown tables
  const linesArr = t.split('\n');
  const outLines: string[] = [];
  const splitCells = (line: string) =>
    line
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split(/(?<!\\)\|/)
      .map((cell) => cell.trim().replace(/\\\|/g, '|'));

  let idx = 0;
  while (idx < linesArr.length) {
    if (
      /^\s*\|.*\|?\s*$/.test(linesArr[idx]) &&
      linesArr[idx].includes('|') &&
      idx + 1 < linesArr.length &&
      /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(linesArr[idx + 1])
    ) {
      const rows = [splitCells(linesArr[idx])];
      idx += 2;
      while (idx < linesArr.length && /^\s*\|/.test(linesArr[idx])) {
        rows.push(splitCells(linesArr[idx]));
        idx += 1;
      }
      counts.table += 1;
      if (options.tables === 'tab') {
        rows.forEach((r) => outLines.push(r.join('\t')));
      } else if (options.tables === 'csv') {
        rows.forEach((r) =>
          outLines.push(
            r
              .map((c) => (/[",]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c))
              .join(',')
          )
        );
      } else {
        const widths: number[] = [];
        rows.forEach((r) =>
          r.forEach((c, colIdx) => {
            const plain = c.replace(/\*\*|__|`/g, '');
            widths[colIdx] = Math.max(widths[colIdx] || 0, plain.length);
          })
        );
        const tableLines = rows.map((r) =>
          r
            .map((c, colIdx) => {
              const plain = c.replace(/\*\*|__|`/g, '');
              return colIdx === r.length - 1
                ? plain
                : plain + ' '.repeat(Math.max(0, (widths[colIdx] || 0) - plain.length));
            })
            .join('   ')
        );
        outLines.push(keep(tableLines.join('\n')));
      }
    } else {
      outLines.push(linesArr[idx]);
      idx += 1;
    }
  }
  t = outLines.join('\n');

  // 7. Markdown block syntax
  if (options.headings) {
    rep(/^[ \t]{0,3}#{1,6}[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/gm, '$1', 'md');
  }
  if (options.rules) {
    rep(/^[ \t]*([-*_])([ \t]*\1){2,}[ \t]*$/gm, '', 'md');
  }
  if (options.quotes) {
    rep(/^[ \t]*(?:>[ \t]?)+/gm, '', 'md');
  }

  // 8. Markdown images & links
  t = t.replace(/!\[([^\]]*)\]\(([^)\s]*)(?:\s+"[^"]*")?\)/g, (_m, alt: string) => {
    counts.md += 1;
    return options.images === 'alt' ? alt : '';
  });
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_m, label: string, url: string) => {
    counts.md += 1;
    if (options.links === 'url') return url;
    if (options.links === 'both' && label !== url) return `${label} (${url})`;
    return label;
  });
  t = t.replace(/<(https?:\/\/[^>\s]+)>/g, '$1');

  // 9. Inline emphasis (bold, italic, strikethrough)
  if (options.emph) {
    let before = '';
    do {
      before = t;
      t = t.replace(/(\*\*\*|___)(?=\S)([\s\S]+?)(?<=\S)\1/g, (_m, _a, inner: string) => {
        counts.md += 1;
        return inner;
      });
      t = t.replace(/(\*\*|__)(?=\S)([\s\S]+?)(?<=\S)\1/g, (_m, _a, inner: string) => {
        counts.md += 1;
        return inner;
      });
      t = t.replace(/(?<![\w*\\])\*(?=[^\s*])([^*\n]+?)(?<=[^\s*])\*(?![\w*])/g, (_m, inner: string) => {
        counts.md += 1;
        return inner;
      });
      t = t.replace(/(?<![\w\\])_(?=[^\s_])([^_\n]+?)(?<=[^\s_])_(?![\w])/g, (_m, inner: string) => {
        counts.md += 1;
        return inner;
      });
      t = t.replace(/~~(?=\S)([^~\n]+?)(?<=\S)~~/g, (_m, inner: string) => {
        counts.md += 1;
        return inner;
      });
    } while (t !== before);
  }

  // 10. LaTeX delimiters
  if (options.latex) {
    rep(/\$\$([\s\S]+?)\$\$/g, '$1', 'md');
    rep(/\\\[([\s\S]+?)\\\]/g, '$1', 'md');
    rep(/\\\((.+?)\\\)/g, '$1', 'md');
    t = t
      .replace(/\\times/g, '×')
      .replace(/\\cdot/g, '·')
      .replace(/\\leq?/g, '≤')
      .replace(/\\geq?/g, '≥')
      .replace(/\\neq/g, '≠')
      .replace(/\\approx/g, '≈')
      .replace(/\\pm/g, '±')
      .replace(/\\rightarrow|\\to/g, '->')
      .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)')
      .replace(/\\text\{([^{}]*)\}/g, '$1');
  }

  // 11. Lists (handle ornamental bullet glyphs before general symbol removal so list formatting works)
  const flattenIndent = options.indent;
  t = t.replace(
    /^([ \t]*)(?:[-*+\u2022\u25E6\u25AA\u2023\u25C6\u25CF\u25A0\u2726\u27A4])[ \t]+(\[[ xX]\][ \t]+)?/gm,
    (full, sp: string, checkbox?: string) => {
      const prefix = flattenIndent ? '' : sp;
      const box = checkbox ? `${checkbox.trim()} ` : '';
      if (options.bullets === 'keep') return full;
      const marker =
        options.bullets === 'dash' ? '- ' : options.bullets === 'dot' ? '• ' : '';
      return `${prefix}${marker}${box}`;
    }
  );
  if (options.numbers === 'remove') {
    t = t.replace(/^([ \t]*)\d{1,3}[.)][ \t]+/gm, (_m, sp: string) => (flattenIndent ? '' : sp));
  } else if (flattenIndent) {
    t = t.replace(/^[ \t]+(?=\d{1,3}[.)][ \t])/gm, '');
  }

  // 12. Markdown backslash escapes
  if (options.escapes) {
    t = t.replace(/\\([\\`*_{}[\]()#+\-.!>~|])/g, '$1');
  }

  // 13. Emoji removal
  if (options.emoji) {
    rep(
      /(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|[\u20E3\uFE0F\u200D])+[ \t]?/gu,
      '',
      'emoji'
    );
  }

  // 14. Unwanted decorative symbols, box-drawing & replacement chars (excluding bullet dot • if chosen)
  if (options.symbols) {
    rep(/[\uFFFD\u0000\u0003-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '', 'symbols');
    rep(/[★☆✦✧❖◆◇■□●○◉◈▪▫➤➢➣➔➜➝➞✴✳❇❈※‖†‡¦¨¸¬¯°²³¹º]+/g, '', 'symbols');
    rep(/[\u2500-\u257F]/g, '', 'symbols');
  }

  // 15. AI opening/closing filler sentences
  if (options.filler) {
    const paragraphs = t.replace(/^\s+/, '').split(/\n{2,}/);
    if (paragraphs.length > 1) {
      const firstLines = paragraphs[0].split('\n');
      const first = firstLines[0].trim();
      let drop = false;
      const openMatch = first.match(
        /^(certainly|sure|absolutely|of course|great question|good question|got it|okay|ok|alright|no problem|great|excellent)[!.,]\s*/i
      );
      if (openMatch) {
        const remainder = first.slice(openMatch[0].length);
        if (!remainder) drop = true;
        else if (/^(here(?:'s| is| are)|below is)/i.test(remainder) && /[:.]$/.test(remainder)) {
          drop = true;
        } else {
          firstLines[0] = remainder;
        }
        counts.filler += 1;
      } else if (/^(here(?:'s| is| are)|below is)/i.test(first) && /:$/.test(first) && first.length < 140) {
        drop = true;
        counts.filler += 1;
      }
      if (drop) firstLines.shift();
      if (firstLines.join('').trim()) {
        paragraphs[0] = firstLines.join('\n');
      } else {
        paragraphs.shift();
      }
    }
    while (
      paragraphs.length > 1 &&
      FILL_CLOSE.test(paragraphs[paragraphs.length - 1].trim().split('\n')[0]) &&
      paragraphs[paragraphs.length - 1].length < 400
    ) {
      paragraphs.pop();
      counts.filler += 1;
    }
    t = paragraphs.join('\n\n');
  }

  // 16. Punctuation normalization
  if (options.smart) {
    t = t
      .replace(/[\u2018\u2019\u201A\u2032]/g, "'")
      .replace(/[\u201C\u201D\u201E\u2033]/g, '"');
  }
  if (options.ellipsis) {
    t = t.replace(/\u2026/g, '...');
  }
  if (options.emdash === 'comma') {
    rep(/[ \t]*\u2014[ \t]*/g, ', ', 'punct');
  } else if (options.emdash === 'hyphen') {
    rep(/[ \t]*\u2014[ \t]*/g, ' - ', 'punct');
  }
  if (options.emdash !== 'keep') {
    t = t.replace(/\u2013/g, '-');
  }

  // 17. Paragraph formatting: join wrapped lines
  if (options.join) {
    t = t
      .split(/\n{2,}/)
      .map((para) => {
        const paraLines = para.split('\n');
        if (
          paraLines.some(
            (l) =>
              /^\s*([-\u2022*+]|\d{1,3}[.)])\s/.test(l) ||
              /\t|\s{3,}\S/.test(l) ||
              /\u0001/.test(l)
          )
        ) {
          return para;
        }
        return paraLines.map((l) => l.trim()).join(' ');
      })
      .join('\n\n');
  }

  // 18. Spacing & blank-line cleanup
  if (options.trim) {
    const beforeTrim = t;
    t = t.replace(/[ \t]+$/gm, '').replace(/([^\s])[ \t]{2,}(?=\S)/g, '$1 ');
    if (t !== beforeTrim) counts.spacing += 1;
  }

  const maxBlank = Math.max(0, Math.min(5, Number(options.maxblank) || 0));
  const beforeBlank = t;
  t = t.replace(new RegExp(`\\n{${maxBlank + 2},}`, 'g'), '\n'.repeat(maxBlank + 1));
  if (t !== beforeBlank) counts.spacing += 1;

  if (options.normalizeParagraphs) {
    t = t.replace(/^\s*\n+/, '').replace(/\s+$/, '');
  }

  // Restore stashed code blocks & aligned tables
  t = t.replace(/\u0001(\d+)\u0002/g, (_m, n: string) => stash[Number(n)] ?? '');

  const afterStats = computeTextStats(t);
  const totalFixes = Object.values(counts).reduce((sum, n) => sum + n, 0);

  return {
    output: t,
    counts,
    beforeStats,
    afterStats,
    totalFixes,
  };
}

/**
 * Simple LCS line diff between Before and After text for the Before-and-After comparison view.
 * Bounded safely on very large inputs so browser UI stays instantaneous.
 */
export function computeLineComparison(beforeText: string, afterText: string): LineDiffEntry[] {
  const a = beforeText.replace(/\r\n?/g, '\n').split('\n');
  const b = afterText.replace(/\r\n?/g, '\n').split('\n');

  const maxLines = 350;
  const aSlice = a.slice(0, maxLines);
  const bSlice = b.slice(0, maxLines);
  const m = aSlice.length;
  const n = bSlice.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] =
        aSlice[i] === bSlice[j]
          ? 1 + dp[i + 1][j + 1]
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const entries: LineDiffEntry[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (aSlice[i] === bSlice[j]) {
      entries.push({
        kind: 'same',
        text: bSlice[j],
        beforeLineNo: i + 1,
        afterLineNo: j + 1,
      });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      entries.push({ kind: 'removed', text: aSlice[i], beforeLineNo: i + 1 });
      i += 1;
    } else {
      entries.push({ kind: 'added', text: bSlice[j], afterLineNo: j + 1 });
      j += 1;
    }
  }
  while (i < m) {
    entries.push({ kind: 'removed', text: aSlice[i], beforeLineNo: i + 1 });
    i += 1;
  }
  while (j < n) {
    entries.push({ kind: 'added', text: bSlice[j], afterLineNo: j + 1 });
    j += 1;
  }

  return entries;
}
