import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Check,
  Columns2,
  Copy,
  Download,
  Eraser,
  FileText,
  GitCompareArrows,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Upload,
} from 'lucide-react';
import { ToolCatalogItem } from '../../types/tools';
import {
  CLEAN_PRESETS,
  type CleanOptions,
  type CleanPresetId,
  DEFAULT_CLEAN_OPTIONS,
  SAMPLE_AI_TEXT,
  cleanAiText,
  computeLineComparison,
} from '../../utils/aiTextCleanerEngine';

interface AiTextCleanerViewProps {
  tool: ToolCatalogItem;
}

const STORAGE_KEY = 'vcpl_ai_text_cleaner_opts_v1';

function loadSavedOptions(): CleanOptions {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CLEAN_OPTIONS;
    const parsed = JSON.parse(raw) as Partial<CleanOptions>;
    return { ...DEFAULT_CLEAN_OPTIONS, ...parsed };
  } catch {
    return DEFAULT_CLEAN_OPTIONS;
  }
}

export const AiTextCleanerView: React.FC<AiTextCleanerViewProps> = ({ tool }) => {
  const [inputText, setInputText] = useState<string>(SAMPLE_AI_TEXT);
  const [options, setOptions] = useState<CleanOptions>(() => loadSavedOptions());
  const [activePreset, setActivePreset] = useState<CleanPresetId | 'custom'>('plain');
  const [viewMode, setViewMode] = useState<'split' | 'compare'>('split');
  const [copied, setCopied] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>(
    'Paste text from ChatGPT, Claude, Gemini, or any editor. Cleans live in your browser while preserving your original meaning and wording.'
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
    } catch {
      // Ignore storage quota errors
    }
  }, [options]);

  const result = useMemo(() => cleanAiText(inputText, options), [inputText, options]);

  const lineDiff = useMemo(() => {
    if (viewMode !== 'compare') return [];
    return computeLineComparison(inputText, result.output);
  }, [inputText, result.output, viewMode]);

  const charsRemoved = Math.max(0, result.beforeStats.chars - result.afterStats.chars);

  const updateOption = <K extends keyof CleanOptions>(key: K, value: CleanOptions[K]) => {
    setActivePreset('custom');
    setOptions((prev) => ({ ...prev, [key]: value }));
  };

  const applyPreset = (presetId: CleanPresetId) => {
    const preset = CLEAN_PRESETS[presetId];
    setOptions({ ...DEFAULT_CLEAN_OPTIONS, ...preset.overrides });
    setActivePreset(presetId);
    setStatusMessage(`Applied "${preset.label}" cleaning preset (original wording preserved).`);
  };

  const handleCleanAll = () => {
    const allPreset = CLEAN_PRESETS.cleanAll;
    setOptions({ ...DEFAULT_CLEAN_OPTIONS, ...allPreset.overrides });
    setActivePreset('cleanAll');
    setStatusMessage(
      'Clean All enabled: AI filler, citations, Markdown, invisible characters, stray symbols, and spacing normalized locally.'
    );
  };

  const handleResetWorkspace = () => {
    setOptions(DEFAULT_CLEAN_OPTIONS);
    setActivePreset('plain');
    setInputText('');
    setStatusMessage('Workspace and cleaning rules reset to defaults.');
  };

  const handleResetOptionsOnly = () => {
    setOptions(DEFAULT_CLEAN_OPTIONS);
    setActivePreset('plain');
    setStatusMessage('Cleaning controls restored to default settings.');
  };

  const handleCopyOutput = async () => {
    if (!result.output) {
      setStatusMessage('Nothing to copy yet — paste or upload text first.');
      return;
    }
    try {
      await navigator.clipboard.writeText(result.output);
      setCopied(true);
      setStatusMessage(
        `Copied ${result.afterStats.chars.toLocaleString()} characters (${result.afterStats.words.toLocaleString()} words) to clipboard.`
      );
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setStatusMessage('Clipboard permission unavailable. Use Download (.txt) or select text manually.');
    }
  };

  const handleDownload = (ext: 'txt' | 'md') => {
    if (!result.output) {
      setStatusMessage('Nothing to download yet — paste or upload text first.');
      return;
    }
    const blob = new Blob([result.output], {
      type: ext === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vcpl-cleaned-text.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatusMessage(`Downloaded vcpl-cleaned-text.${ext}.`);
  };

  const handleUseOutputAsInput = () => {
    if (!result.output) return;
    setInputText(result.output);
    setStatusMessage('Moved cleaned output into input pane for another pass.');
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      setInputText(content);
      setStatusMessage(`Loaded "${file.name}" (${content.length.toLocaleString()} characters).`);
    } catch {
      setStatusMessage('Unable to read the selected file.');
    } finally {
      e.target.value = '';
    }
  };

  const ruleHitChips = [
    { label: 'Markdown', value: result.counts.md },
    { label: 'AI Filler', value: result.counts.filler },
    { label: 'Citations', value: result.counts.cite },
    { label: 'Invisible', value: result.counts.hidden },
    { label: 'Odd Spaces', value: result.counts.spaces },
    { label: 'Symbols', value: result.counts.symbols },
    { label: 'Emoji', value: result.counts.emoji },
    { label: 'Tables', value: result.counts.table },
    { label: 'Dashes', value: result.counts.punct },
  ].filter((c) => c.value > 0);

  return (
    <div className="space-y-5">
      {/* Top Hero / Controls Bar */}
      <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-5 sm:p-6 shadow-[0_4px_0_#2F3E4E] dark:shadow-[0_4px_0_#020617] space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#12805C] text-white text-[11px] font-display font-extrabold uppercase tracking-wider">
                NEW
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#CEE5DC] dark:bg-emerald-950/60 border border-[#12805C]/30 text-[#12805C] dark:text-emerald-300 text-[11px] font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                <span>100% Browser-Based · Preserves Original Meaning</span>
              </span>
              <span className="text-xs font-mono text-[#64748B] dark:text-slate-400">
                {tool.code} · {tool.categoryName}
              </span>
            </div>
            <h1 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] dark:text-slate-50 tracking-tight">
              VCPL AI Text Cleaner
            </h1>
            <p className="text-xs sm:text-sm text-[#475569] dark:text-slate-300 max-w-3xl">
              Remove AI chat filler, Markdown syntax, citations, invisible Unicode characters,
              unwanted symbols, and broken spacing without paraphrasing or rewriting a single word.
            </p>
          </div>

          {/* Primary Actions */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCleanAll}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[42px] rounded-xl border-[1.5px] text-xs font-display font-extrabold transition cursor-pointer shadow-[0_3px_0_#1E293B] ${
                activePreset === 'cleanAll'
                  ? 'bg-[#12805C] border-[#0A4F38] text-white'
                  : 'bg-[#F9C80E] hover:bg-[#FDE047] border-[#2F3E4E] text-[#2F3E4E]'
              }`}
            >
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              <span>Clean All</span>
            </button>

            <button
              type="button"
              onClick={handleResetOptionsOnly}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 min-h-[42px] rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] hover:bg-[#FEF2C8] dark:hover:bg-slate-800 text-xs font-bold text-[#2F3E4E] dark:text-slate-100 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Reset Rules</span>
            </button>

            <button
              type="button"
              onClick={handleResetWorkspace}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 min-h-[42px] rounded-xl border-[1.5px] border-[#9E2A2B]/60 bg-[#FEE2E2]/80 dark:bg-rose-950/50 hover:bg-[#FEE2E2] text-xs font-bold text-[#7D0B0B] dark:text-rose-200 transition cursor-pointer"
            >
              <Eraser className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Reset All</span>
            </button>
          </div>
        </div>

        {/* Presets Row + View Mode Switcher */}
        <div className="pt-3 border-t border-[#2F3E4E]/15 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-display font-extrabold uppercase tracking-wider text-[#64748B] dark:text-slate-400 mr-1">
              Presets:
            </span>
            {(['plain', 'email', 'linkedin', 'strict', 'markdownOnly'] as CleanPresetId[]).map(
              (presetId) => {
                const preset = CLEAN_PRESETS[presetId];
                const isActive = activePreset === presetId;
                return (
                  <button
                    key={presetId}
                    type="button"
                    title={preset.description}
                    onClick={() => applyPreset(presetId)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer ${
                      isActive
                        ? 'bg-[#2F3E4E] text-[#F9C80E] border-[#2F3E4E] dark:bg-[#F9C80E] dark:text-[#0F172A] dark:border-[#F9C80E]'
                        : 'bg-white dark:bg-[#0B1120] text-[#2F3E4E] dark:text-slate-200 border-[#2F3E4E]/25 dark:border-slate-700 hover:bg-[#FEF2C8] dark:hover:bg-slate-800'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              }
            )}
          </div>

          <div className="inline-flex items-center p-1 rounded-xl border-[1.5px] border-[#2F3E4E]/25 dark:border-slate-700 bg-[#FEF2C8]/60 dark:bg-[#0B1120] self-start md:self-auto">
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'split'
                  ? 'bg-[#2F3E4E] text-[#F9C80E] dark:bg-[#F9C80E] dark:text-[#0F172A]'
                  : 'text-[#475569] dark:text-slate-300'
              }`}
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span>Side-by-Side</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('compare')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'compare'
                  ? 'bg-[#2F3E4E] text-[#F9C80E] dark:bg-[#F9C80E] dark:text-[#0F172A]'
                  : 'text-[#475569] dark:text-slate-300'
              }`}
            >
              <GitCompareArrows className="w-3.5 h-3.5" />
              <span>Before &amp; After Diff</span>
            </button>
          </div>
        </div>
      </div>

      {/* Live Telemetry Bar: Words, Chars, Diff & Rules Applied */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E]/25 dark:border-slate-700 rounded-xl p-3">
          <p className="text-[10px] font-display font-extrabold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
            Input Words / Chars
          </p>
          <p className="font-mono font-extrabold text-sm text-[#2F3E4E] dark:text-slate-100 tabular-nums mt-0.5">
            {result.beforeStats.words.toLocaleString()}w · {result.beforeStats.chars.toLocaleString()}c
          </p>
        </div>

        <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#12805C]/40 rounded-xl p-3">
          <p className="text-[10px] font-display font-extrabold uppercase tracking-wider text-[#12805C] dark:text-emerald-400">
            Cleaned Words
          </p>
          <p className="font-mono font-extrabold text-sm text-[#12805C] dark:text-emerald-300 tabular-nums mt-0.5">
            {result.afterStats.words.toLocaleString()} words
          </p>
        </div>

        <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#12805C]/40 rounded-xl p-3">
          <p className="text-[10px] font-display font-extrabold uppercase tracking-wider text-[#12805C] dark:text-emerald-400">
            Cleaned Characters
          </p>
          <p className="font-mono font-extrabold text-sm text-[#2F3E4E] dark:text-slate-100 tabular-nums mt-0.5">
            {result.afterStats.chars.toLocaleString()} ({result.afterStats.charsNoSpaces.toLocaleString()} no sp)
          </p>
        </div>

        <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E]/25 dark:border-slate-700 rounded-xl p-3">
          <p className="text-[10px] font-display font-extrabold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
            Lines / Paragraphs
          </p>
          <p className="font-mono font-extrabold text-sm text-[#2F3E4E] dark:text-slate-100 tabular-nums mt-0.5">
            {result.afterStats.lines.toLocaleString()} / {result.afterStats.paragraphs.toLocaleString()}
          </p>
        </div>

        <div className="bg-[#FEF2C8] dark:bg-amber-950/35 border-[1.5px] border-[#B45309]/40 rounded-xl p-3">
          <p className="text-[10px] font-display font-extrabold uppercase tracking-wider text-[#B45309] dark:text-amber-300">
            Clutter Removed
          </p>
          <p className="font-mono font-extrabold text-sm text-[#92400E] dark:text-amber-200 tabular-nums mt-0.5">
            {charsRemoved.toLocaleString()} chars
          </p>
        </div>

        <div className="bg-[#CEE5DC]/70 dark:bg-emerald-950/35 border-[1.5px] border-[#12805C]/40 rounded-xl p-3">
          <p className="text-[10px] font-display font-extrabold uppercase tracking-wider text-[#12805C] dark:text-emerald-300">
            Rules Applied
          </p>
          <p className="font-mono font-extrabold text-sm text-[#12805C] dark:text-emerald-200 tabular-nums mt-0.5">
            {result.totalFixes.toLocaleString()} fixes
          </p>
        </div>
      </div>

      {/* Main Workspace Grid: Left Individual Cleaning Controls + Right Editor / Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Sidebar: Individual Cleaning Controls */}
        <aside
          aria-label="Individual text cleaning controls"
          className="lg:col-span-4 xl:col-span-3 bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-4 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-[#2F3E4E]/15 dark:border-slate-800 pb-2.5">
            <h2 className="font-display font-extrabold text-xs uppercase tracking-wider text-[#2F3E4E] dark:text-slate-100">
              Individual Cleaning Controls
            </h2>
            <button
              type="button"
              onClick={handleCleanAll}
              className="text-[11px] font-bold text-[#12805C] dark:text-emerald-400 hover:underline cursor-pointer"
            >
              Enable All
            </button>
          </div>

          {/* Group 1: AI Text Cleanup */}
          <div className="space-y-2">
            <p className="text-[11px] font-display font-extrabold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
              AI Text Cleanup
            </p>
            {(
              [
                ['filler', 'Opening & closing AI filler'],
                ['cites', 'Citation tokens [1], 【4†source】'],
                ['emoji', 'Remove emoji icons'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center justify-between gap-2 text-xs text-[#2F3E4E] dark:text-slate-200 cursor-pointer py-0.5">
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={options[key]}
                  onChange={(e) => updateOption(key, e.target.checked)}
                  className="w-4 h-4 accent-[#12805C] rounded cursor-pointer"
                />
              </label>
            ))}
          </div>

          {/* Group 2: Markdown Removal */}
          <div className="space-y-2 pt-2 border-t border-[#2F3E4E]/12 dark:border-slate-800">
            <p className="text-[11px] font-display font-extrabold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
              Markdown Removal
            </p>
            {(
              [
                ['headings', 'Headings (#, ##, ###)'],
                ['emph', 'Bold, italic & strikethrough'],
                ['quotes', 'Blockquotes (>)'],
                ['rules', 'Horizontal dividers (---)'],
                ['inlinecode', 'Inline code backticks (`)'],
                ['html', 'HTML tags (<p>, <b>, <br>)'],
                ['latex', 'LaTeX delimiters & math'],
                ['escapes', 'Backslash escapes (\\*, \\_)'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center justify-between gap-2 text-xs text-[#2F3E4E] dark:text-slate-200 cursor-pointer py-0.5">
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={options[key]}
                  onChange={(e) => updateOption(key, e.target.checked)}
                  className="w-4 h-4 accent-[#12805C] rounded cursor-pointer"
                />
              </label>
            ))}

            <div className="flex items-center justify-between gap-2 text-xs pt-1">
              <label htmlFor="cleaner-fences" className="text-[#2F3E4E] dark:text-slate-200">
                Code blocks
              </label>
              <select
                id="cleaner-fences"
                value={options.fences}
                onChange={(e) => updateOption('fences', e.target.value as CleanOptions['fences'])}
                className="px-2 py-1 rounded-lg border border-[#2F3E4E]/30 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-medium text-[#2F3E4E] dark:text-slate-100"
              >
                <option value="unwrap">Unwrap fences (keep code)</option>
                <option value="keep">Keep fences &amp; code</option>
                <option value="remove">Remove code blocks</option>
              </select>
            </div>

            <div className="flex items-center justify-between gap-2 text-xs">
              <label htmlFor="cleaner-links" className="text-[#2F3E4E] dark:text-slate-200">
                Links
              </label>
              <select
                id="cleaner-links"
                value={options.links}
                onChange={(e) => updateOption('links', e.target.value as CleanOptions['links'])}
                className="px-2 py-1 rounded-lg border border-[#2F3E4E]/30 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-medium text-[#2F3E4E] dark:text-slate-100"
              >
                <option value="text">Label only</option>
                <option value="both">Label (URL)</option>
                <option value="url">URL only</option>
              </select>
            </div>

            <div className="flex items-center justify-between gap-2 text-xs">
              <label htmlFor="cleaner-images" className="text-[#2F3E4E] dark:text-slate-200">
                Images
              </label>
              <select
                id="cleaner-images"
                value={options.images}
                onChange={(e) => updateOption('images', e.target.value as CleanOptions['images'])}
                className="px-2 py-1 rounded-lg border border-[#2F3E4E]/30 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-medium text-[#2F3E4E] dark:text-slate-100"
              >
                <option value="alt">Keep alt text</option>
                <option value="remove">Remove image tag</option>
              </select>
            </div>
          </div>

          {/* Group 3: Invisible Characters & Unwanted Symbols */}
          <div className="space-y-2 pt-2 border-t border-[#2F3E4E]/12 dark:border-slate-800">
            <p className="text-[11px] font-display font-extrabold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
              Invisible &amp; Unwanted Symbols
            </p>
            {(
              [
                ['hidden', 'Invisible chars (zero-width, BOM, bidi)'],
                ['spaces', 'Odd Unicode spaces to normal'],
                ['symbols', 'Unwanted symbols (★◆■, box lines, control)'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center justify-between gap-2 text-xs text-[#2F3E4E] dark:text-slate-200 cursor-pointer py-0.5">
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={options[key]}
                  onChange={(e) => updateOption(key, e.target.checked)}
                  className="w-4 h-4 accent-[#12805C] rounded cursor-pointer"
                />
              </label>
            ))}
          </div>

          {/* Group 4: Punctuation, Lists & Tables */}
          <div className="space-y-2 pt-2 border-t border-[#2F3E4E]/12 dark:border-slate-800">
            <p className="text-[11px] font-display font-extrabold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
              Punctuation, Lists &amp; Tables
            </p>
            <label className="flex items-center justify-between gap-2 text-xs text-[#2F3E4E] dark:text-slate-200 cursor-pointer py-0.5">
              <span>Curly quotes to straight</span>
              <input
                type="checkbox"
                checked={options.smart}
                onChange={(e) => updateOption('smart', e.target.checked)}
                className="w-4 h-4 accent-[#12805C] rounded cursor-pointer"
              />
            </label>
            <label className="flex items-center justify-between gap-2 text-xs text-[#2F3E4E] dark:text-slate-200 cursor-pointer py-0.5">
              <span>Ellipsis (…) to three dots (...)</span>
              <input
                type="checkbox"
                checked={options.ellipsis}
                onChange={(e) => updateOption('ellipsis', e.target.checked)}
                className="w-4 h-4 accent-[#12805C] rounded cursor-pointer"
              />
            </label>
            <label className="flex items-center justify-between gap-2 text-xs text-[#2F3E4E] dark:text-slate-200 cursor-pointer py-0.5">
              <span>Flatten nested list indent</span>
              <input
                type="checkbox"
                checked={options.indent}
                onChange={(e) => updateOption('indent', e.target.checked)}
                className="w-4 h-4 accent-[#12805C] rounded cursor-pointer"
              />
            </label>

            <div className="flex items-center justify-between gap-2 text-xs pt-1">
              <label htmlFor="cleaner-emdash" className="text-[#2F3E4E] dark:text-slate-200">
                Em/En dashes
              </label>
              <select
                id="cleaner-emdash"
                value={options.emdash}
                onChange={(e) => updateOption('emdash', e.target.value as CleanOptions['emdash'])}
                className="px-2 py-1 rounded-lg border border-[#2F3E4E]/30 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-medium text-[#2F3E4E] dark:text-slate-100"
              >
                <option value="comma">Comma (, )</option>
                <option value="hyphen">Hyphen ( - )</option>
                <option value="keep">Keep unchanged</option>
              </select>
            </div>

            <div className="flex items-center justify-between gap-2 text-xs">
              <label htmlFor="cleaner-bullets" className="text-[#2F3E4E] dark:text-slate-200">
                Bullet lists
              </label>
              <select
                id="cleaner-bullets"
                value={options.bullets}
                onChange={(e) => updateOption('bullets', e.target.value as CleanOptions['bullets'])}
                className="px-2 py-1 rounded-lg border border-[#2F3E4E]/30 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-medium text-[#2F3E4E] dark:text-slate-100"
              >
                <option value="dash">Dash (- )</option>
                <option value="dot">Bullet (• )</option>
                <option value="none">Strip markers</option>
                <option value="keep">Keep unchanged</option>
              </select>
            </div>

            <div className="flex items-center justify-between gap-2 text-xs">
              <label htmlFor="cleaner-numbers" className="text-[#2F3E4E] dark:text-slate-200">
                Numbered lists
              </label>
              <select
                id="cleaner-numbers"
                value={options.numbers}
                onChange={(e) => updateOption('numbers', e.target.value as CleanOptions['numbers'])}
                className="px-2 py-1 rounded-lg border border-[#2F3E4E]/30 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-medium text-[#2F3E4E] dark:text-slate-100"
              >
                <option value="keep">Keep numbers</option>
                <option value="remove">Remove numbers</option>
              </select>
            </div>

            <div className="flex items-center justify-between gap-2 text-xs">
              <label htmlFor="cleaner-tables" className="text-[#2F3E4E] dark:text-slate-200">
                Markdown tables
              </label>
              <select
                id="cleaner-tables"
                value={options.tables}
                onChange={(e) => updateOption('tables', e.target.value as CleanOptions['tables'])}
                className="px-2 py-1 rounded-lg border border-[#2F3E4E]/30 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-medium text-[#2F3E4E] dark:text-slate-100"
              >
                <option value="aligned">Aligned columns</option>
                <option value="tab">Tab separated</option>
                <option value="csv">Comma separated (CSV)</option>
              </select>
            </div>
          </div>

          {/* Group 5: Spacing & Paragraph Formatting */}
          <div className="space-y-2 pt-2 border-t border-[#2F3E4E]/12 dark:border-slate-800">
            <p className="text-[11px] font-display font-extrabold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
              Spacing &amp; Paragraphs
            </p>
            <label className="flex items-center justify-between gap-2 text-xs text-[#2F3E4E] dark:text-slate-200 cursor-pointer py-0.5">
              <span>Trim line ends &amp; double spaces</span>
              <input
                type="checkbox"
                checked={options.trim}
                onChange={(e) => updateOption('trim', e.target.checked)}
                className="w-4 h-4 accent-[#12805C] rounded cursor-pointer"
              />
            </label>
            <label className="flex items-center justify-between gap-2 text-xs text-[#2F3E4E] dark:text-slate-200 cursor-pointer py-0.5">
              <span>Join wrapped lines into paragraphs</span>
              <input
                type="checkbox"
                checked={options.join}
                onChange={(e) => updateOption('join', e.target.checked)}
                className="w-4 h-4 accent-[#12805C] rounded cursor-pointer"
              />
            </label>
            <label className="flex items-center justify-between gap-2 text-xs text-[#2F3E4E] dark:text-slate-200 cursor-pointer py-0.5">
              <span>Normalize leading/trailing breaks</span>
              <input
                type="checkbox"
                checked={options.normalizeParagraphs}
                onChange={(e) => updateOption('normalizeParagraphs', e.target.checked)}
                className="w-4 h-4 accent-[#12805C] rounded cursor-pointer"
              />
            </label>
            <div className="flex items-center justify-between gap-2 text-xs pt-1">
              <label htmlFor="cleaner-maxblank" className="text-[#2F3E4E] dark:text-slate-200">
                Max blank lines in a row
              </label>
              <input
                id="cleaner-maxblank"
                type="number"
                min={0}
                max={5}
                value={options.maxblank}
                onChange={(e) =>
                  updateOption('maxblank', Math.max(0, Math.min(5, Number(e.target.value) || 0)))
                }
                className="w-16 px-2 py-1 rounded-lg border border-[#2F3E4E]/30 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-mono text-center text-[#2F3E4E] dark:text-slate-100"
              />
            </div>
          </div>
        </aside>

        {/* Right Workspace: Input/Output Panes OR Before-and-After Diff */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-4">
          {viewMode === 'split' ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {/* Input Pane */}
              <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl overflow-hidden flex flex-col">
                <div className="px-4 py-3 border-b border-[#2F3E4E]/15 dark:border-slate-800 bg-[#FEF2C8]/55 dark:bg-[#0F172A] flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#2F3E4E] dark:text-[#F9C80E]" aria-hidden="true" />
                    <span className="font-display font-extrabold text-xs uppercase tracking-wider text-[#2F3E4E] dark:text-slate-100">
                      Original AI Text (Before)
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setInputText(SAMPLE_AI_TEXT);
                        setStatusMessage('Loaded sample AI response with Markdown, citations & symbols.');
                      }}
                      className="px-2.5 py-1 rounded-lg border border-[#2F3E4E]/25 dark:border-slate-600 bg-white dark:bg-[#131C2E] text-xs font-bold text-[#2F3E4E] dark:text-slate-200 hover:bg-[#F9C80E]/30 cursor-pointer"
                    >
                      Example
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#2F3E4E]/25 dark:border-slate-600 bg-white dark:bg-[#131C2E] text-xs font-bold text-[#2F3E4E] dark:text-slate-200 hover:bg-[#F9C80E]/30 cursor-pointer"
                    >
                      <Upload className="w-3 h-3" />
                      <span>Upload</span>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt,.md,.markdown,.html,.htm,text/*"
                      onChange={(e) => void handleUploadFile(e)}
                      className="sr-only"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setInputText('');
                        setStatusMessage('Cleared input text.');
                      }}
                      className="px-2.5 py-1 rounded-lg border border-[#2F3E4E]/25 dark:border-slate-600 bg-white dark:bg-[#131C2E] text-xs font-bold text-[#9E2A2B] dark:text-rose-300 hover:bg-[#FEE2E2]/60 cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  spellCheck={false}
                  placeholder="Paste AI output from ChatGPT, Claude, Gemini, or Copilot here..."
                  aria-label="Original AI text input"
                  className="w-full min-h-[430px] p-4 bg-transparent font-mono text-[13px] leading-relaxed text-[#2F3E4E] dark:text-slate-100 placeholder:text-[#94A3B8] focus:outline-none resize-y"
                />
              </div>

              {/* Output Pane */}
              <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#12805C] dark:border-emerald-500/60 rounded-2xl overflow-hidden flex flex-col">
                <div className="px-4 py-3 border-b border-[#12805C]/20 dark:border-slate-800 bg-[#CEE5DC]/55 dark:bg-emerald-950/35 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#12805C] dark:text-emerald-400" aria-hidden="true" />
                    <span className="font-display font-extrabold text-xs uppercase tracking-wider text-[#12805C] dark:text-emerald-300">
                      Cleaned Output (After)
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void handleCopyOutput()}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-[#12805C] hover:bg-[#0E6A4B] text-white text-xs font-bold cursor-pointer"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownload('txt')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#2F3E4E]/30 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-bold text-[#2F3E4E] dark:text-slate-200 hover:bg-[#FEF2C8] cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      <span>.TXT</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownload('md')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#2F3E4E]/30 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-bold text-[#2F3E4E] dark:text-slate-200 hover:bg-[#FEF2C8] cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      <span>.MD</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleUseOutputAsInput}
                      title="Move cleaned output into input pane"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#2F3E4E]/30 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-bold text-[#2F3E4E] dark:text-slate-200 hover:bg-[#FEF2C8] cursor-pointer"
                    >
                      <ArrowLeftRight className="w-3 h-3" />
                      <span>Re-clean</span>
                    </button>
                  </div>
                </div>
                <textarea
                  value={result.output}
                  readOnly
                  spellCheck={false}
                  placeholder="Cleaned text appears automatically here..."
                  aria-label="Cleaned text output"
                  className="w-full min-h-[430px] p-4 bg-transparent font-mono text-[13px] leading-relaxed text-[#2F3E4E] dark:text-slate-100 placeholder:text-[#94A3B8] focus:outline-none resize-y"
                />
              </div>
            </div>
          ) : (
            /* Before-and-After Line Comparison View */
            <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#2F3E4E]/15 dark:border-slate-800 bg-[#FEF2C8]/65 dark:bg-[#0F172A] flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <GitCompareArrows className="w-4 h-4 text-[#2F3E4E] dark:text-[#F9C80E]" />
                  <span className="font-display font-extrabold text-xs uppercase tracking-wider text-[#2F3E4E] dark:text-slate-100">
                    Before &amp; After Line Comparison
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCopyOutput()}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-[#12805C] text-white text-xs font-bold cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy Cleaned'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload('txt')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#2F3E4E]/30 dark:border-slate-600 bg-white dark:bg-[#131C2E] text-xs font-bold text-[#2F3E4E] dark:text-slate-100 cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download .TXT</span>
                  </button>
                </div>
              </div>

              <div className="max-h-[490px] overflow-y-auto divide-y divide-[#2F3E4E]/10 dark:divide-slate-800 font-mono text-xs">
                {lineDiff.length === 0 ? (
                  <p className="p-6 text-center text-[#64748B] dark:text-slate-400">
                    Paste or load text in Side-by-Side mode to inspect Before &amp; After line differences.
                  </p>
                ) : (
                  lineDiff.map((entry, idx) => (
                    <div
                      key={idx}
                      className={`px-4 py-1.5 flex items-start gap-3 ${
                        entry.kind === 'removed'
                          ? 'bg-[#FEE2E2]/70 dark:bg-rose-950/35 text-[#7D0B0B] dark:text-rose-200'
                          : entry.kind === 'added'
                          ? 'bg-[#CEE5DC]/65 dark:bg-emerald-950/35 text-[#12805C] dark:text-emerald-200'
                          : 'text-[#334155] dark:text-slate-300'
                      }`}
                    >
                      <span className="w-5 shrink-0 font-bold select-none">
                        {entry.kind === 'removed' ? '−' : entry.kind === 'added' ? '+' : ' '}
                      </span>
                      <span className="w-10 shrink-0 text-[10px] opacity-65 tabular-nums select-none">
                        {entry.kind === 'removed'
                          ? `B:${entry.beforeLineNo}`
                          : entry.kind === 'added'
                          ? `A:${entry.afterLineNo}`
                          : `${entry.afterLineNo}`}
                      </span>
                      <span className="whitespace-pre-wrap break-words flex-1">
                        {entry.text || ' '}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Cleanup Breakdown & Live Feedback */}
          <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E]/25 dark:border-slate-700 rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <p className="text-xs text-[#475569] dark:text-slate-300" aria-live="polite">
              {statusMessage}
            </p>
            {ruleHitChips.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                {ruleHitChips.map((chip) => (
                  <span
                    key={chip.label}
                    className="px-2 py-0.5 rounded-md bg-[#CEE5DC]/75 dark:bg-emerald-950/50 border border-[#12805C]/30 text-[11px] font-mono font-bold text-[#12805C] dark:text-emerald-300 tabular-nums"
                  >
                    {chip.label}: {chip.value}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
