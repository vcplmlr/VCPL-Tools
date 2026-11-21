import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  BookOpen,
  Check,
  ClipboardPaste,
  Copy,
  Download,
  Eraser,
  FileImage,
  Grid3X3,
  HelpCircle,
  Image as ImageIcon,
  Keyboard as KeyboardIcon,
  Languages,
  Layers,
  Mic,
  MicOff,
  PenTool,
  RotateCcw,
  Search,
  Sparkles,
  Star,
  Trash2,
  Volume2,
} from 'lucide-react';
import { ToolCatalogItem } from '../../types/tools';
import { TulunaduFlagIcon } from '../TulunaduFlagIcon';
import {
  D,
  ENS,
  InputMode,
  LGO,
  L_HL,
  L_IV,
  NM,
  PG,
  PG_NAMES,
  QuizMode,
  RMK,
  S,
  SCN,
  ScriptKey,
  SentenceCategory,
  StudioTab,
  TranslationPreference,
  W,
  WRE,
  candsEn,
  indicC,
  kn2rom,
  kn2tu,
  phon,
  resolveCustomSpellingInput,
  rom,
  romanC,
  scr,
  tu2kn,
} from '../../utils/tulusiriEngine';
import '../../styles/baravu.css';

interface TulusiriProViewProps {
  tool?: ToolCatalogItem;
  onBack?: () => void;
}

function safeGetJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed == null ? fallback : (parsed as T);
  } catch {
    return fallback;
  }
}

function safeSetJson(key: string, val: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(val));
  } catch {
    // ignore storage errors
  }
}

const getDayNum = () => Math.floor(Date.now() / 864e5);
const getIsoDay = (n: number) => new Date(n * 864e5).toISOString().slice(0, 10);

function pickRandomDistinct<T>(arr: T[], n: number, exclude: T): T[] {
  const r: T[] = [];
  while (r.length < n && r.length < arr.length - 1) {
    const x = arr[Math.floor(Math.random() * arr.length)];
    if (x !== exclude && !r.includes(x)) r.push(x);
  }
  return r;
}

const TABS_META: {
  id: StudioTab;
  label: string;
  Icon: typeof PenTool;
}[] = [
  { id: 'write', label: 'Write', Icon: PenTool },
  { id: 'chart', label: 'Lipi Chart', Icon: Grid3X3 },
  { id: 'decode', label: 'Decode', Icon: Layers },
  { id: 'dict', label: 'Dictionary', Icon: BookOpen },
  { id: 'words', label: 'Sari Tulu', Icon: Sparkles },
  { id: 'sent', label: 'Sentences', Icon: Languages },
  { id: 'learn', label: 'Learn', Icon: Award },
  { id: 'quiz', label: 'Quiz', Icon: HelpCircle },
];

export const TulusiriProView: React.FC<TulusiriProViewProps> = ({ tool }) => {
  const [activeTab, setActiveTab] = useState<StudioTab>('write');

  // Write studio state
  const [text, setText] = useState<string>('');
  const [mode, setMode] = useState<InputMode>('en');
  const [convertOther, setConvertOther] = useState<boolean>(true);
  const [translationPref, setTranslationPref] = useState<TranslationPreference>(() => {
    const saved = safeGetJson<string | number>('tp_pm', 'gt');
    if (saved === '2' || saved === 2 || saved === 'tu') return 'tu';
    if (saved === '0' || saved === 0 || saved === 'sound') return 'sound';
    if (saved === '1' || saved === 1 || saved === 'kn') return 'gt';
    if (saved === 'gt') return 'gt';
    return 'gt';
  });
  const [fontSize, setFontSize] = useState<number>(34);
  const [showKeyboard, setShowKeyboard] = useState<boolean>(true);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const [overrides, setOverrides] = useState<Record<string, string>>(() =>
    safeGetJson<Record<string, string>>('tp_ov', {})
  );
  const [langChoice, setLangChoice] = useState<Record<string, string>>(() =>
    safeGetJson<Record<string, string>>('tp_lg', {})
  );
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});
  const [expandedWords, setExpandedWords] = useState<Record<string, boolean>>({});

  // Live Google Translate + Google Input Tools state
  const [googleEnabled, setGoogleEnabled] = useState<boolean>(true);
  const [googleLoading, setGoogleLoading] = useState<boolean>(false);
  const [googleData, setGoogleData] = useState<{
    queryKey: string;
    translatedText: string;
    romanization: string;
    detectedLang: string;
    alternatives: { kn: string; tag: string }[];
    wordSuggestions: Record<string, { kn: string; tag: string }[]>;
  } | null>(null);
  const [sentenceChoice, setSentenceChoice] = useState<string | null>(null);
  const [useWordByWord, setUseWordByWord] = useState<boolean>(false);
  const googleCacheRef = useRef<
    Map<
      string,
      {
        queryKey: string;
        translatedText: string;
        romanization: string;
        detectedLang: string;
        alternatives: { kn: string; tag: string }[];
        wordSuggestions: Record<string, { kn: string; tag: string }[]>;
      }
    >
  >(new Map());

  // Nudi phonetic composing buffer refs
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const nudiBufRef = useRef({ buf: '', base: '', tail: '', lastV: '', lastC: -1 });

  // Voice dictation
  const srRef = useRef<any>(null);
  const [dictatingLang, setDictatingLang] = useState<'' | 'en-IN' | 'kn-IN'>('');
  const speechSupported =
    typeof window !== 'undefined' &&
    Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  // Decode tab
  const [decodeInput, setDecodeInput] = useState<string>('');

  // Dictionary tab
  const [dictQuery, setDictQuery] = useState<string>('');
  const [dictFilter, setDictFilter] = useState<string>('All');
  const [favorites, setFavorites] = useState<string[]>(() =>
    safeGetJson<string[]>('tp_fav', [])
  );

  // Sari Tulu (Words) tab
  const [wordsQuery, setWordsQuery] = useState<string>('');
  const [flippedWordIdx, setFlippedWordIdx] = useState<Record<number, boolean>>({});

  // Sentences tab
  const [sentQuery, setSentQuery] = useState<string>('');
  const [sentCat, setSentCat] = useState<SentenceCategory>('All');

  // Learn tab (streak + flashcards + handwriting)
  const [streakDays, setStreakDays] = useState<number>(1);
  const [srState, setSrState] = useState<Record<string, { box: number; due: number }>>(() =>
    safeGetJson<Record<string, { box: number; due: number }>>('tp_sr', {})
  );
  const [flashCard, setFlashCard] = useState<[string, string, string, string] | null>(null);
  const [flashShowAnswer, setFlashShowAnswer] = useState<boolean>(false);
  const [hwIdx, setHwIdx] = useState<number>(0);
  const hwCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const hwDrawingRef = useRef<boolean>(false);

  // Quiz tab
  const [quizMode, setQuizMode] = useState<QuizMode>('w');
  const [quizScore, setQuizScore] = useState<number>(0);
  const [quizCount, setQuizCount] = useState<number>(0);
  const [quizStreak, setQuizStreak] = useState<number>(0);
  const [quizBest, setQuizBest] = useState<number>(() => {
    try {
      return Number(window.localStorage.getItem('tp_best') || 0) || 0;
    } catch {
      return 0;
    }
  });
  const [quizQuestion, setQuizQuestion] = useState<{
    item: [string, string] | [string, string, string, string];
    options: ([string, string] | [string, string, string, string])[];
  } | null>(null);
  const [quizSelectedIdx, setQuizSelectedIdx] = useState<number | null>(null);

  const flashTimerRef = useRef<number | null>(null);
  const triggerNotice = useCallback((msg: string) => {
    setStatusNotice(msg);
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setStatusNotice(null), 1800);
  }, []);

  // Init streak once
  useEffect(() => {
    const todayNum = getDayNum();
    const todayIso = getIsoDay(todayNum);
    const st = safeGetJson<{ d: string; n: number }>('tp_st', { d: '', n: 0 });
    if (st.d !== todayIso) {
      const nextCount = st.d === getIsoDay(todayNum - 1) ? st.n + 1 : 1;
      const updated = { d: todayIso, n: nextCount };
      safeSetJson('tp_st', updated);
      setStreakDays(nextCount);
    } else {
      setStreakDays(Math.max(1, st.n));
    }
  }, []);

  // Cleanup speech recognition on unmount
  useEffect(() => {
    return () => {
      if (srRef.current) {
        try {
          srRef.current.stop();
        } catch {
          // ignore
        }
      }
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    };
  }, []);

  // Auto-detect latin script mode
  const autoLatinLang = useMemo(() => {
    let r = 0;
    let e = 0;
    (text.toLowerCase().match(/[a-z]+/g) || []).forEach((w) => {
      if (RMK.has(w)) r++;
      if (ENS.has(w)) e++;
    });
    return r > 0 && r >= e ? 'rm' : 'en';
  }, [text]);

  const effLang = useCallback(
    (sc: ScriptKey): string => {
      if (langChoice[sc]) return langChoice[sc];
      return sc === 'latin' ? autoLatinLang : LGO[sc][0][0];
    },
    [autoLatinLang, langChoice]
  );

  // Script counts & distinct words for language confirmation + candidate verifier
  const { scriptCounts, distinctWords } = useMemo(() => {
    const cnt: Partial<Record<ScriptKey, number>> = {};
    const ws: string[] = [];
    (text.match(WRE) || []).forEach((w) => {
      const s = scr(w);
      cnt[s] = (cnt[s] || 0) + 1;
      const lw = w.toLowerCase();
      if (!ws.some((x) => x.toLowerCase() === lw)) ws.push(w);
    });
    return { scriptCounts: cnt, distinctWords: ws };
  }, [text]);

  const nonKannadaText = useMemo(
    () => text.replace(/[\u0C80-\u0CFF\u200c\u200d*]+/g, ' ').replace(/\s+/g, ' ').trim(),
    [text]
  );

  const activeSourceLang = useMemo(() => {
    const scripts = Object.keys(scriptCounts) as ScriptKey[];
    if (scripts.length === 1) {
      return effLang(scripts[0]);
    }
    if (scripts.length === 0) return 'en';
    if (scripts.includes('latin') && scripts.length === 1) {
      return effLang('latin');
    }
    return 'auto';
  }, [effLang, scriptCounts]);

  const googleQueryKey = `${activeSourceLang}|${nonKannadaText}`;

  useEffect(() => {
    setSentenceChoice(null);
  }, [googleQueryKey]);

  useEffect(() => {
    if (!convertOther || !googleEnabled || mode !== 'en' || !nonKannadaText) {
      setGoogleLoading(false);
      return;
    }

    const cachedClient = googleCacheRef.current.get(googleQueryKey);
    if (cachedClient) {
      setGoogleData(cachedClient);
      setGoogleLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setGoogleLoading(true);
      try {
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            text: nonKannadaText,
            sourceLang: activeSourceLang,
            words: distinctWords.slice(0, 12),
          }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          ok?: boolean;
          rateLimited?: boolean;
          translatedText?: string;
          romanization?: string;
          detectedLang?: string;
          alternatives?: { kn: string; tag: string }[];
          wordSuggestions?: Record<string, { kn: string; tag: string }[]>;
        };
        if (data?.ok) {
          const entry = {
            queryKey: googleQueryKey,
            translatedText: data.translatedText || '',
            romanization: data.romanization || '',
            detectedLang: data.detectedLang || activeSourceLang,
            alternatives: Array.isArray(data.alternatives) ? data.alternatives : [],
            wordSuggestions: data.wordSuggestions || {},
          };
          if (!data.rateLimited) {
            if (googleCacheRef.current.size >= 120) {
              const oldest = googleCacheRef.current.keys().next().value;
              if (oldest) googleCacheRef.current.delete(oldest);
            }
            googleCacheRef.current.set(googleQueryKey, entry);
          }
          setGoogleData(entry);
        }
      } catch (err) {
        if ((err as Error)?.name !== 'AbortError') {
          // Quietly keep local engine active if offline
        }
      } finally {
        if (!controller.signal.aborted) {
          setGoogleLoading(false);
        }
      }
    }, 450);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [activeSourceLang, convertOther, distinctWords, googleEnabled, googleQueryKey, mode, nonKannadaText]);

  const getCands = useCallback(
    (w: string): [string, string][] => {
      const sc = scr(w);
      const localCands: [string, string][] =
        sc !== 'latin'
          ? indicC(w, sc, effLang(sc))
          : effLang('latin') === 'rm'
          ? romanC(w)
          : candsEn(w, translationPref);

      const gWordList =
        googleEnabled && googleData?.queryKey === googleQueryKey
          ? googleData.wordSuggestions[w.toLowerCase()] || []
          : [];

      if (gWordList.length === 0) return localCands;

      const merged: [string, string][] = [];
      const addMerged = (kk: string, tag: string) => {
        const clean = kk.trim();
        if (!clean || merged.some((m) => m[0] === clean)) return;
        merged.push([clean, tag]);
      };

      if (translationPref === 'tu') {
        localCands
          .filter(([, tag]) => tag === 'Tulu word')
          .forEach(([kk, tag]) => addMerged(kk, tag));
        gWordList.forEach((g) => addMerged(g.kn, g.tag));
        localCands.forEach(([kk, tag]) => addMerged(kk, tag));
      } else if (translationPref === 'sound' || effLang('latin') === 'rm') {
        gWordList
          .filter((g) => g.tag.toLowerCase().includes('phonetic') || g.tag.toLowerCase().includes('input'))
          .forEach((g) => addMerged(g.kn, g.tag));
        localCands
          .filter(([, tag]) => tag === 'recommended' || tag === 'phonetic' || tag === 'common spelling')
          .forEach(([kk, tag]) => addMerged(kk, tag));
        gWordList.forEach((g) => addMerged(g.kn, g.tag));
        localCands.forEach(([kk, tag]) => addMerged(kk, tag));
      } else {
        // 'gt' / 'kn' mode: Google Translate results first, then Input Tools + local dictionary/phonetics
        gWordList.forEach((g) => addMerged(g.kn, g.tag));
        localCands.forEach(([kk, tag]) => addMerged(kk, tag));
      }

      return merged.slice(0, 14);
    },
    [effLang, googleData, googleEnabled, googleQueryKey, translationPref]
  );

  const getChosen = useCallback(
    (w: string): string => {
      const k = w.toLowerCase();
      return overrides[k] || (getCands(w)[0] || [w])[0];
    },
    [getCands, overrides]
  );

  const translitSegment = useCallback(
    (segment: string): string =>
      segment.replace(WRE, (w) =>
        mode === 'tu' && scr(w) === 'latin'
          ? phon(w.replace(/x/g, 'kSh').replace(/q/g, 'k'))
          : getChosen(w)
      ),
    [getChosen, mode]
  );

  const hasCurrentWordOverride = useMemo(
    () => distinctWords.some((w) => Boolean(overrides[w.toLowerCase()])),
    [distinctWords, overrides]
  );

  const activeGoogleFullTranslation = useMemo(() => {
    if (
      !convertOther ||
      !googleEnabled ||
      mode !== 'en' ||
      useWordByWord ||
      activeSourceLang === 'rm' ||
      (translationPref !== 'gt' && translationPref !== 'kn') ||
      !googleData ||
      googleData.queryKey !== googleQueryKey ||
      !googleData.translatedText
    ) {
      return '';
    }
    // For multi-word sentences, use full-sentence Google Translate unless user explicitly switched to Pick Word-by-Word;
    // for a single word, honor its word-level override immediately.
    if (distinctWords.length === 1 && hasCurrentWordOverride) return '';
    return sentenceChoice || googleData.translatedText;
  }, [
    activeSourceLang,
    convertOther,
    distinctWords.length,
    googleData,
    googleEnabled,
    googleQueryKey,
    hasCurrentWordOverride,
    mode,
    sentenceChoice,
    translationPref,
    useWordByWord,
  ]);

  const toKannadaText = useCallback(
    (raw: string): string => {
      if (!convertOther) return raw;
      if (activeGoogleFullTranslation && raw === text) {
        if (!/[\u0C80-\u0CFF]/.test(raw)) {
          return activeGoogleFullTranslation;
        }
      }
      return raw.replace(/[^\u0C80-\u0CFF]+/g, translitSegment);
    },
    [activeGoogleFullTranslation, convertOther, text, translitSegment]
  );

  const kannadaResolved = useMemo(() => toKannadaText(text), [text, toKannadaText]);
  const romanPreview = useMemo(() => rom(kannadaResolved), [kannadaResolved]);
  const tuluCodeFull = useMemo(() => kn2tu(kannadaResolved), [kannadaResolved]);

  // Output display chunks (preserving non-Kannada styling when Other languages -> Tulu is off)
  const outputChunks = useMemo(() => {
    if (convertOther && activeGoogleFullTranslation && !/[\u0C80-\u0CFF]/.test(text)) {
      return [{ key: 0, isLatin: false, val: kn2tu(activeGoogleFullTranslation) }];
    }
    const tokens =
      text.match(/[\u0C80-\u0CFF][\u0C80-\u0CFF\u200c\u200d*]*|[^\u0C80-\u0CFF]+/g) ||
      [];
    return tokens.map((r, idx) => {
      if (/^[\u0C80-\u0CFF]/.test(r)) {
        return { key: idx, isLatin: false, val: kn2tu(r) };
      }
      if (convertOther) {
        return { key: idx, isLatin: false, val: kn2tu(translitSegment(r)) };
      }
      return { key: idx, isLatin: true, val: r };
    });
  }, [activeGoogleFullTranslation, convertOther, text, translitSegment]);

  // Helper to insert/delete inside textarea
  const insertAtCursor = useCallback((str: string) => {
    const ta = textareaRef.current;
    if (!ta) {
      setText((prev) => prev + str);
      return;
    }
    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? ta.value.length;
    const nextVal = ta.value.slice(0, start) + str + ta.value.slice(end);
    setText(nextVal);
    nudiBufRef.current.buf = '';
    window.requestAnimationFrame(() => {
      ta.focus();
      const pos = start + str.length;
      ta.setSelectionRange(pos, pos);
    });
  }, []);

  const backspaceAtCursor = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) {
      setText((prev) => [...prev].slice(0, -1).join(''));
      return;
    }
    let start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? ta.value.length;
    if (start === end && start > 0) {
      start = [...ta.value.slice(0, start)].slice(0, -1).join('').length;
    }
    const nextVal = ta.value.slice(0, start) + ta.value.slice(end);
    setText(nextVal);
    nudiBufRef.current.buf = '';
    window.requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start, start);
    });
  }, []);

  // Nudi-style phonetic typing interceptor
  const handleTextareaBeforeInput = useCallback(
    (e: React.FormEvent<HTMLTextAreaElement>) => {
      if (mode !== 'tu') return;
      const nativeEv = e.nativeEvent as InputEvent;
      const ta = textareaRef.current;
      if (!ta) return;
      const st = nudiBufRef.current;
      const ok =
        ta.selectionStart === st.lastC &&
        ta.selectionEnd === st.lastC &&
        ta.value === st.lastV;

      const applyNudi = (nextBuf: string) => {
        const converted = phon(nextBuf);
        const nextText = st.base + converted + st.tail;
        const pos = st.base.length + converted.length;
        st.buf = nextBuf;
        st.lastV = nextText;
        st.lastC = pos;
        setText(nextText);
        window.requestAnimationFrame(() => {
          ta.setSelectionRange(pos, pos);
        });
      };

      if (
        nativeEv.inputType === 'insertText' &&
        /^[A-Za-z~]$/.test(nativeEv.data || '')
      ) {
        nativeEv.preventDefault();
        if (!ok || !st.buf) {
          st.base = ta.value.slice(0, ta.selectionStart ?? ta.value.length);
          st.tail = ta.value.slice(ta.selectionEnd ?? ta.value.length);
          st.buf = '';
        }
        applyNudi(st.buf + (nativeEv.data || ''));
      } else if (
        nativeEv.inputType === 'deleteContentBackward' &&
        ok &&
        st.buf
      ) {
        nativeEv.preventDefault();
        applyNudi(st.buf.slice(0, -1));
      }
    },
    [mode]
  );

  // Copy utility
  const copyString = useCallback(
    async (val: string, label: string) => {
      if (!val.trim()) {
        triggerNotice('Type some text first');
        return;
      }
      try {
        await navigator.clipboard.writeText(val);
        triggerNotice(`${label} copied`);
      } catch {
        try {
          const t = document.createElement('textarea');
          t.value = val;
          document.body.appendChild(t);
          t.select();
          document.execCommand('copy');
          t.remove();
          triggerNotice(`${label} copied`);
        } catch {
          triggerNotice('Clipboard access blocked');
        }
      }
    },
    [triggerNotice]
  );

  const handlePaste = useCallback(async () => {
    try {
      const clip = await navigator.clipboard.readText();
      if (clip) {
        insertAtCursor(clip);
        triggerNotice('Pasted from clipboard');
      } else {
        triggerNotice('Clipboard is empty');
      }
    } catch {
      triggerNotice('Press Ctrl+V inside the text box');
      textareaRef.current?.focus();
    }
  }, [insertAtCursor, triggerNotice]);

  // Speech dictation
  const toggleMic = useCallback(
    (lang: 'en-IN' | 'kn-IN') => {
      const SR =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SR) {
        triggerNotice('Voice input is not supported in this browser');
        return;
      }
      if (srRef.current) {
        srRef.current.stop();
        srRef.current = null;
        setDictatingLang('');
        return;
      }
      try {
        const rec = new SR();
        rec.lang = lang;
        rec.continuous = true;
        rec.interimResults = false;
        rec.onresult = (ev: any) => {
          for (let i = ev.resultIndex; i < ev.results.length; i++) {
            if (ev.results[i].isFinal) {
              const transcript = (ev.results[i][0]?.transcript || '').trim();
              if (transcript) {
                setText((prev) =>
                  prev && !/\s$/.test(prev) ? `${prev} ${transcript}` : `${prev}${transcript}`
                );
              }
            }
          }
        };
        rec.onend = () => {
          srRef.current = null;
          setDictatingLang('');
        };
        rec.onerror = (ev: any) => {
          srRef.current = null;
          setDictatingLang('');
          triggerNotice(
            ev?.error === 'not-allowed' || ev?.error === 'service-not-allowed'
              ? 'Please allow microphone permission'
              : 'Voice input unavailable'
          );
        };
        srRef.current = rec;
        rec.start();
        setDictatingLang(lang);
      } catch {
        srRef.current = null;
        setDictatingLang('');
        triggerNotice('Voice input unavailable');
      }
    },
    [triggerNotice]
  );

  // Text-to-speech preview (Kannada voice fallback)
  const speakKannada = useCallback(
    (str: string) => {
      try {
        const u = new SpeechSynthesisUtterance(str.replace(/\*/g, ''));
        u.lang = 'kn-IN';
        u.rate = 0.85;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
      } catch {
        triggerNotice('Browser speech voice unavailable');
      }
    },
    [triggerNotice]
  );

  // Canvas image / poster generator
  const renderExportBlob = useCallback(
    async (isPoster: boolean): Promise<Blob | null> => {
      await document.fonts.load('40px Baravu');
      const t = kn2tu(toKannadaText(text));
      if (!t.trim()) return null;

      const Wmax = isPoster ? 1000 : 900;
      const fs = fontSize + (isPoster ? 24 : 8);
      const lh = fs * 1.5;
      const pd = isPoster ? 90 : 40;
      const c = document.createElement('canvas');
      const x = c.getContext('2d');
      if (!x) return null;

      const setWordSpacing = () => {
        try {
          (x as CanvasRenderingContext2D & { wordSpacing?: string }).wordSpacing = `${
            fs * 0.45
          }px`;
        } catch {
          // ignore unsupported browser property
        }
      };

      x.font = `${fs}px Baravu`;
      setWordSpacing();

      const lines: string[] = [];
      t.split('\n').forEach((para) => {
        let line = '';
        para.split(' ').forEach((word) => {
          const next = line ? `${line} ${word}` : word;
          if (x.measureText(next).width > Wmax && line) {
            lines.push(line);
            line = word;
          } else {
            line = next;
          }
        });
        lines.push(line);
      });

      c.width = Wmax + pd * 2;
      c.height = Math.max(
        isPoster ? 600 : 0,
        Math.ceil(lines.length * lh + pd * 2 + (isPoster ? 56 : 0))
      );

      if (isPoster) {
        const grad = x.createLinearGradient(0, 0, c.width, c.height);
        grad.addColorStop(0, '#7D0B0B');
        grad.addColorStop(1, '#4A0909');
        x.fillStyle = grad;
        x.fillRect(0, 0, c.width, c.height);
        x.strokeStyle = '#F9C80E';
        x.lineWidth = 6;
        x.strokeRect(24, 24, c.width - 48, c.height - 48);
      } else {
        x.fillStyle = '#FFFDF5';
        x.fillRect(0, 0, c.width, c.height);
      }

      x.fillStyle = isPoster ? '#FFFFFF' : '#2F3E4E';
      x.font = `${fs}px Baravu`;
      setWordSpacing();
      x.textBaseline = 'top';
      x.textAlign = isPoster ? 'center' : 'left';

      const y0 = isPoster ? (c.height - lines.length * lh - 30) / 2 : pd;
      lines.forEach((line, i) => {
        x.fillText(line, isPoster ? c.width / 2 : pd, y0 + i * lh);
      });

      if (isPoster) {
        x.font = 'bold 20px system-ui';
        try {
          (x as CanvasRenderingContext2D & { wordSpacing?: string }).wordSpacing = '0px';
        } catch {
          // ignore
        }
        x.fillStyle = '#F9C80E';
        x.fillText('Tulusiri Pro · Tulu Lipi Studio', c.width / 2, c.height - 66);
      }

      return new Promise((resolve) => c.toBlob((blob) => resolve(blob), 'image/png'));
    },
    [fontSize, text, toKannadaText]
  );

  const handleCopyImage = useCallback(async () => {
    try {
      const blob = await renderExportBlob(false);
      if (!blob) {
        triggerNotice('Type something first');
        return;
      }
      if (typeof ClipboardItem === 'undefined') {
        triggerNotice('Image clipboard not supported here — use Download PNG');
        return;
      }
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      triggerNotice('Tulu Lipi PNG copied to clipboard');
    } catch {
      triggerNotice('Use Download PNG if clipboard image is blocked');
    }
  }, [renderExportBlob, triggerNotice]);

  const handleDownloadPng = useCallback(
    async (isPoster: boolean) => {
      try {
        const blob = await renderExportBlob(isPoster);
        if (!blob) {
          triggerNotice('Type something first');
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = isPoster ? 'tulu-poster.png' : 'tulu-lipi.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        triggerNotice(isPoster ? 'Poster downloaded' : 'PNG downloaded');
      } catch {
        triggerNotice('Unable to generate image');
      }
    },
    [renderExportBlob, triggerNotice]
  );

  // Word of the day
  const wordOfDay = useMemo(() => D[getDayNum() % D.length], []);

  // Flashcard helpers
  const loadNextFlashcard = useCallback(
    (srMap: Record<string, { box: number; due: number }>, prevCard: [string, string, string, string] | null) => {
      const n = getDayNum();
      const due = D.filter((d) => srMap[d[1]] && srMap[d[1]].due <= n);
      const fresh = D.filter((d) => !srMap[d[1]]);
      const pool = due.length ? due : fresh;
      const p2 = pool.length > 1 ? pool.filter((d) => d !== prevCard) : pool;
      const chosen = p2.length ? p2[Math.floor(Math.random() * p2.length)] : null;
      setFlashCard(chosen);
      setFlashShowAnswer(false);
    },
    []
  );

  useEffect(() => {
    loadNextFlashcard(srState, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flashStats = useMemo(() => {
    const n = getDayNum();
    const dueCount = D.filter((d) => srState[d[1]] && srState[d[1]].due <= n).length;
    const freshCount = D.filter((d) => !srState[d[1]]).length;
    const learnedCount = Object.values(srState).filter((x) => x.box >= 3).length;
    return { dueCount, freshCount, learnedCount };
  }, [srState]);

  const gradeFlashcard = useCallback(
    (g: 0 | 1 | 2) => {
      if (!flashCard) return;
      const key = flashCard[1];
      const curBox = srState[key]?.box || 0;
      const nextBox = g === 0 ? 0 : Math.min(5, curBox + g);
      const nextSr = {
        ...srState,
        [key]: { box: nextBox, due: getDayNum() + (g === 0 ? 0 : L_IV[nextBox]) },
      };
      setSrState(nextSr);
      safeSetJson('tp_sr', nextSr);
      loadNextFlashcard(nextSr, flashCard);
    },
    [flashCard, loadNextFlashcard, srState]
  );

  // Handwriting canvas drawing
  const drawHwGuide = useCallback(() => {
    const canvas = hwCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#FFFDF5';
    ctx.fillRect(0, 0, 320, 320);
    ctx.strokeStyle = 'rgba(47, 62, 78, 0.1)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(160, 12);
    ctx.lineTo(160, 308);
    ctx.moveTo(12, 160);
    ctx.lineTo(308, 160);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(125, 11, 11, 0.18)';
    ctx.font = '210px Baravu';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(kn2tu(L_HL[hwIdx]), 160, 168);
  }, [hwIdx]);

  useEffect(() => {
    if (activeTab !== 'learn') return;
    drawHwGuide();
    document.fonts.load('40px Baravu').then(drawHwGuide, drawHwGuide);
  }, [activeTab, drawHwGuide]);

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = hwCanvasRef.current;
    if (!canvas) return [0, 0];
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) * 320) / r.width, ((e.clientY - r.top) * 320) / r.height];
  };

  // Quiz helpers
  const nextQuizQuestion = useCallback((m: QuizMode) => {
    const src = m === 'w' ? W : D;
    const item = src[Math.floor(Math.random() * src.length)];
    const wrong = pickRandomDistinct<(typeof src)[number]>(src, 3, item);
    const options = [item, ...wrong].sort(() => Math.random() - 0.5);
    setQuizQuestion({ item, options });
    setQuizSelectedIdx(null);
  }, []);

  useEffect(() => {
    nextQuizQuestion(quizMode);
  }, [nextQuizQuestion, quizMode]);

  const handleQuizAnswer = (idx: number) => {
    if (!quizQuestion || quizSelectedIdx !== null) return;
    setQuizSelectedIdx(idx);
    setQuizCount((c) => c + 1);
    const isCorrect = quizQuestion.options[idx] === quizQuestion.item;
    if (isCorrect) {
      setQuizScore((s) => s + 1);
      setQuizStreak((prev) => {
        const next = prev + 1;
        if (next > quizBest) {
          setQuizBest(next);
          try {
            window.localStorage.setItem('tp_best', String(next));
          } catch {
            // ignore
          }
        }
        return next;
      });
    } else {
      setQuizStreak(0);
    }
  };

  // Dictionary filters
  const dictFirstLetters = useMemo(
    () => ['All', 'Saved', ...new Set(D.map((d) => d[0][0]))],
    []
  );

  const filteredDict = useMemo(() => {
    const q = dictQuery.trim().toLowerCase();
    const favSet = new Set(favorites);
    return D.filter(
      (d) =>
        (!q || d.join(' ').toLowerCase().includes(q)) &&
        (dictFilter === 'All' ||
          (dictFilter === 'Saved' ? favSet.has(d[1]) : d[0][0] === dictFilter))
    );
  }, [dictFilter, dictQuery, favorites]);

  const toggleFavoriteWord = useCallback(
    (romanKey: string) => {
      const next = favorites.includes(romanKey)
        ? favorites.filter((x) => x !== romanKey)
        : [...favorites, romanKey];
      setFavorites(next);
      safeSetJson('tp_fav', next);
    },
    [favorites]
  );

  // Sari Tulu filtered
  const filteredWords = useMemo(() => {
    const q = wordsQuery.trim().toLowerCase();
    return W.filter((w) => !q || w.join(' ').toLowerCase().includes(q));
  }, [wordsQuery]);

  // Sentences filtered
  const filteredSentences = useMemo(() => {
    const q = sentQuery.trim().toLowerCase();
    return S.filter(
      (s) =>
        (sentCat === 'All' || s[3] === sentCat) &&
        (!q || s.join(' ').toLowerCase().includes(q))
    );
  }, [sentCat, sentQuery]);

  return (
    <div className="space-y-5">
      {/* Tool Header & Navigation Bar */}
      <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-4 sm:p-5 shadow-[0_4px_0_#2F3E4E] dark:shadow-[0_4px_0_#020617]">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-[#2F3E4E]/15 dark:border-slate-700/80">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-display font-extrabold uppercase tracking-wider">
              <span className="px-2 py-0.5 rounded bg-[#2F3E4E] text-[#F9C80E]">
                {tool?.code || 'SP-01'}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#FEE2E2] dark:bg-rose-950/70 text-[#7D0B0B] dark:text-rose-200 border border-[#2F3E4E] dark:border-rose-500/40">
                <TulunaduFlagIcon size="sm" />
                <span>Special</span>
              </span>
              <span className="px-2 py-0.5 rounded bg-[#B45309] text-[#FFFDF5] border border-[#2F3E4E] dark:border-amber-400/50">
                Beta Testing
              </span>
            </div>

            <h1 className="font-display font-extrabold text-xl sm:text-2xl text-[#2F3E4E] dark:text-slate-50 tracking-tight flex flex-wrap items-baseline gap-2">
              <span
                className="tulu-lipi-font text-2xl sm:text-3xl font-normal text-[#7D0B0B] dark:text-[#F9C80E]"
                aria-hidden="true"
              >
                tuLusiri
              </span>
              <span>Tulusiri Pro – Tulu Lipi Studio</span>
            </h1>

            <p className="text-xs sm:text-sm text-[#475569] dark:text-slate-300 leading-relaxed">
              Tulu Lipi converter, Baravu decoder, poster export &amp; learning suite.
            </p>
          </div>

          {statusNotice && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#CEE5DC] dark:bg-emerald-950/70 border-[1.5px] border-[#2F3E4E] dark:border-emerald-500/50 text-xs font-bold text-[#12805C] dark:text-emerald-300 shrink-0">
              <Check className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{statusNotice}</span>
            </div>
          )}
        </div>

        {/* Studio Navigation Tabs */}
        <div
          role="tablist"
          aria-label="Tulusiri Pro Studio Sections"
          className="pt-4 flex flex-wrap items-center gap-2"
        >
          {TABS_META.map(({ id, label, Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-xl text-xs font-display font-bold border-[1.5px] transition-all cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#FFFDF5] dark:text-[#0F172A] border-[#2F3E4E] dark:border-[#F9C80E] shadow-[0_2px_0_#1E293B]'
                    : 'bg-[#FFFDF5] dark:bg-[#0B1120] text-[#2F3E4E] dark:text-slate-200 border-[#2F3E4E]/30 dark:border-slate-700 hover:bg-[#FEF2C8] dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* =================================================================== */}
      {/* TAB 1: WRITE STUDIO                                                 */}
      {/* =================================================================== */}
      {activeTab === 'write' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Input Column */}
            <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-4 sm:p-5 space-y-3 shadow-[0_3px_0_#2F3E4E] dark:shadow-[0_3px_0_#020617]">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  aria-pressed={mode === 'en'}
                  onClick={() => {
                    setMode('en');
                    nudiBufRef.current.buf = '';
                    textareaRef.current?.focus();
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border-[1.5px] transition-colors cursor-pointer ${
                    mode === 'en'
                      ? 'bg-[#F9C80E] text-[#2F3E4E] border-[#2F3E4E]'
                      : 'bg-white dark:bg-[#0B1120] text-[#475569] dark:text-slate-300 border-[#2F3E4E]/25 dark:border-slate-700 hover:bg-[#FEF2C8] dark:hover:bg-slate-800'
                  }`}
                >
                  English as typed
                </button>
                <button
                  type="button"
                  aria-pressed={mode === 'tu'}
                  onClick={() => {
                    setMode('tu');
                    nudiBufRef.current.buf = '';
                    textareaRef.current?.focus();
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border-[1.5px] transition-colors cursor-pointer ${
                    mode === 'tu'
                      ? 'bg-[#F9C80E] text-[#2F3E4E] border-[#2F3E4E]'
                      : 'bg-white dark:bg-[#0B1120] text-[#475569] dark:text-slate-300 border-[#2F3E4E]/25 dark:border-slate-700 hover:bg-[#FEF2C8] dark:hover:bg-slate-800'
                  }`}
                >
                  Tulu typing (Nudi-style)
                </button>
                <button
                  type="button"
                  aria-pressed={convertOther}
                  onClick={() => setConvertOther((v) => !v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border-[1.5px] transition-colors cursor-pointer ${
                    convertOther
                      ? 'bg-[#CEE5DC] dark:bg-emerald-500/25 text-[#12805C] dark:text-emerald-300 border-[#2F3E4E] dark:border-emerald-500/40'
                      : 'bg-white dark:bg-[#0B1120] text-[#475569] dark:text-slate-300 border-[#2F3E4E]/25 dark:border-slate-700'
                  }`}
                >
                  Other languages → Tulu: {convertOther ? 'ON' : 'OFF'}
                </button>
                <button
                  type="button"
                  onClick={handlePaste}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border-[1.5px] border-[#2F3E4E]/30 dark:border-slate-700 bg-white dark:bg-[#0B1120] text-[#2F3E4E] dark:text-slate-200 hover:bg-[#FEF2C8] dark:hover:bg-slate-800 cursor-pointer"
                >
                  <ClipboardPaste className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Paste</span>
                </button>
                {speechSupported && (
                  <>
                    <button
                      type="button"
                      onClick={() => toggleMic('en-IN')}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border-[1.5px] cursor-pointer ${
                        dictatingLang === 'en-IN'
                          ? 'bg-[#7D0B0B] text-white border-[#7D0B0B]'
                          : 'bg-white dark:bg-[#0B1120] text-[#2F3E4E] dark:text-slate-200 border-[#2F3E4E]/30 dark:border-slate-700'
                      }`}
                    >
                      {dictatingLang === 'en-IN' ? (
                        <MicOff className="w-3.5 h-3.5" aria-hidden="true" />
                      ) : (
                        <Mic className="w-3.5 h-3.5" aria-hidden="true" />
                      )}
                      <span>English</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleMic('kn-IN')}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border-[1.5px] cursor-pointer ${
                        dictatingLang === 'kn-IN'
                          ? 'bg-[#7D0B0B] text-white border-[#7D0B0B]'
                          : 'bg-white dark:bg-[#0B1120] text-[#2F3E4E] dark:text-slate-200 border-[#2F3E4E]/30 dark:border-slate-700'
                      }`}
                    >
                      {dictatingLang === 'kn-IN' ? (
                        <MicOff className="w-3.5 h-3.5" aria-hidden="true" />
                      ) : (
                        <Mic className="w-3.5 h-3.5" aria-hidden="true" />
                      )}
                      <span>ಕನ್ನಡ</span>
                    </button>
                  </>
                )}
              </div>

              <label
                htmlFor="tulusiri-kn-input"
                className="block text-xs font-medium text-[#475569] dark:text-slate-300 leading-relaxed"
              >
                {mode === 'en'
                  ? 'Type or paste text in any language: Kannada, English, Hindi, Tamil, Telugu, Malayalam & more. Confirm words below for instant Tulu Lipi.'
                  : 'Phonetic typing: ka = ಕ, T = ಟ, D = ಡ, N = ಣ, L = ಳ, sh = ಶ, Sh = ಷ, aa = ಆ, M = ಂ. Add * after ೆ or ೇ for Tulu vowels.'}
              </label>

              <textarea
                id="tulusiri-kn-input"
                ref={textareaRef}
                rows={5}
                value={text}
                onBeforeInput={handleTextareaBeforeInput}
                onChange={(e) => {
                  setText(e.target.value);
                  nudiBufRef.current.buf = '';
                }}
                placeholder="Type or paste text in any language… / ಇಲ್ಲಿ ಬರೆಯಿರಿ…"
                className="w-full rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-[#2F3E4E] dark:text-slate-100 p-3 text-base leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
              />

              {/* Quick sample snippets */}
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="font-semibold text-[#64748B] dark:text-slate-400">Try:</span>
                {[
                  'ಸೊಲ್ಮೆಲು',
                  'ತುಳುನಾಡು',
                  'ಯೀರ್ ಎಂಚ ಉಲ್ಲರ್?',
                  'Tulunadu',
                  'Namaskara',
                ].map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => setText(sample)}
                    className="px-2 py-0.5 rounded-md bg-[#FEF2C8] dark:bg-slate-800 border border-[#2F3E4E]/25 dark:border-slate-600 text-[#2F3E4E] dark:text-slate-200 font-medium hover:bg-[#F9C80E] dark:hover:text-[#0F172A] cursor-pointer"
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </div>

            {/* Output Column */}
            <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-4 sm:p-5 space-y-3 shadow-[0_3px_0_#2F3E4E] dark:shadow-[0_3px_0_#020617]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-display font-extrabold uppercase tracking-wider text-[#2F3E4E] dark:text-slate-200">
                    Tulu Lipi Preview (Baravu)
                  </span>
                  {convertOther && mode === 'en' && googleEnabled && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                        googleLoading
                          ? 'bg-[#FEF3C7] text-[#92400E] border-[#F59E0B]/40'
                          : googleData?.queryKey === googleQueryKey && googleData.translatedText
                          ? 'bg-[#CEE5DC] dark:bg-emerald-500/20 text-[#12805C] dark:text-emerald-300 border-[#12805C]/30'
                          : 'bg-white dark:bg-[#0B1120] text-[#475569] dark:text-slate-300 border-[#2F3E4E]/20'
                      }`}
                    >
                      {googleLoading
                        ? 'Google Translating…'
                        : googleData?.queryKey === googleQueryKey && googleData.translatedText
                        ? `Google Translate (${googleData.detectedLang} → kn)`
                        : 'Google Translate Ready'}
                    </span>
                  )}
                </div>
                <label className="inline-flex items-center gap-2 text-xs text-[#475569] dark:text-slate-300 font-medium">
                  <span>Size ({fontSize}px)</span>
                  <input
                    type="range"
                    min={20}
                    max={72}
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    className="w-24 accent-[#7D0B0B] dark:accent-[#F9C80E]"
                  />
                </label>
              </div>

              <div
                aria-live="polite"
                style={{ fontSize: `${fontSize}px` }}
                className="tulu-lipi-font min-h-[144px] rounded-xl border-[1.5px] border-dashed border-[#C8870A] dark:border-[#F9C80E]/60 bg-white dark:bg-[#0B1120] text-[#2F3E4E] dark:text-slate-50 p-4 leading-snug break-words whitespace-pre-wrap"
              >
                {outputChunks.length === 0 ? (
                  <span className="font-sans text-sm text-[#94A3B8] dark:text-slate-500">
                    Your Tulu Lipi script renders here live…
                  </span>
                ) : (
                  outputChunks.map((ch) =>
                    ch.isLatin ? (
                      <span
                        key={ch.key}
                        className="font-sans text-[0.65em] tracking-normal [word-spacing:normal]"
                      >
                        {ch.val}
                      </span>
                    ) : (
                      <React.Fragment key={ch.key}>{ch.val}</React.Fragment>
                    )
                  )
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#475569] dark:text-slate-300 bg-[#FEF2C8]/60 dark:bg-slate-800/60 px-3 py-2 rounded-lg border border-[#2F3E4E]/15 dark:border-slate-700">
                <div className="min-w-0 break-words">
                  {kannadaResolved && kannadaResolved !== text && (
                    <span className="mr-3">
                      <strong className="text-[#2F3E4E] dark:text-slate-100">Kannada:</strong>{' '}
                      {kannadaResolved}
                    </span>
                  )}
                  <span>
                    <strong className="text-[#2F3E4E] dark:text-slate-100">Sounds:</strong>{' '}
                    {romanPreview || '—'}
                  </span>
                </div>
                {kannadaResolved.trim() && (
                  <button
                    type="button"
                    onClick={() => speakKannada(kannadaResolved)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white dark:bg-[#0B1120] border border-[#2F3E4E]/30 dark:border-slate-600 text-[11px] font-bold text-[#2F3E4E] dark:text-slate-100 hover:bg-[#F9C80E] dark:hover:text-[#0F172A] shrink-0 cursor-pointer"
                  >
                    <Volume2 className="w-3 h-3" aria-hidden="true" />
                    <span>Listen</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5 bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-3.5 shadow-[0_3px_0_#2F3E4E] dark:shadow-[0_3px_0_#020617]">
            <button
              type="button"
              onClick={() => copyString(tuluCodeFull, 'Tulu code')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#7D0B0B] hover:bg-[#600707] text-white border-[1.5px] border-[#2F3E4E] text-xs font-bold shadow-[0_2px_0_#2F3E4E] cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Copy Tulu Code</span>
            </button>
            <button
              type="button"
              onClick={() => copyString(kannadaResolved, 'Kannada text')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-[#0B1120] hover:bg-[#FEF2C8] dark:hover:bg-slate-800 text-[#2F3E4E] dark:text-slate-100 border-[1.5px] border-[#2F3E4E] dark:border-slate-600 text-xs font-bold cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Copy Kannada</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setText('');
                nudiBufRef.current.buf = '';
                textareaRef.current?.focus();
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-[#0B1120] hover:bg-rose-50 dark:hover:bg-rose-950/40 text-[#2F3E4E] dark:text-slate-100 border-[1.5px] border-[#2F3E4E] dark:border-slate-600 text-xs font-bold cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Clear</span>
            </button>
            <button
              type="button"
              onClick={handleCopyImage}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-[#0B1120] hover:bg-[#FEF2C8] dark:hover:bg-slate-800 text-[#2F3E4E] dark:text-slate-100 border-[1.5px] border-[#2F3E4E] dark:border-slate-600 text-xs font-bold cursor-pointer"
            >
              <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Copy as Image</span>
            </button>
            <button
              type="button"
              onClick={() => handleDownloadPng(false)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-[#0B1120] hover:bg-[#FEF2C8] dark:hover:bg-slate-800 text-[#2F3E4E] dark:text-slate-100 border-[1.5px] border-[#2F3E4E] dark:border-slate-600 text-xs font-bold cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Download PNG</span>
            </button>
            <button
              type="button"
              onClick={() => handleDownloadPng(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F9C80E] hover:bg-[#FDE047] text-[#2F3E4E] border-[1.5px] border-[#2F3E4E] text-xs font-bold cursor-pointer"
            >
              <FileImage className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Download Poster</span>
            </button>
            <button
              type="button"
              aria-pressed={showKeyboard}
              onClick={() => setShowKeyboard((k) => !k)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 text-xs font-bold cursor-pointer ml-auto ${
                showKeyboard
                  ? 'bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#FFFDF5] dark:text-[#0F172A]'
                  : 'bg-white dark:bg-[#0B1120] text-[#2F3E4E] dark:text-slate-100'
              }`}
            >
              <KeyboardIcon className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{showKeyboard ? 'Hide Keyboard' : 'Show Keyboard'}</span>
            </button>
          </div>

          {/* Any-Language Word Verifier */}
          <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong className="font-display text-sm text-[#2F3E4E] dark:text-slate-100">
                Any language → Kannada → Tulu: Confirm Spellings
              </strong>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  aria-pressed={googleEnabled}
                  onClick={() => setGoogleEnabled((g) => !g)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border-[1.5px] cursor-pointer ${
                    googleEnabled
                      ? 'bg-[#CEE5DC] dark:bg-emerald-500/20 text-[#12805C] dark:text-emerald-300 border-[#2F3E4E] dark:border-emerald-500/40'
                      : 'bg-white dark:bg-[#0B1120] text-[#475569] dark:text-slate-300 border-[#2F3E4E]/30 dark:border-slate-700'
                  }`}
                >
                  Google Translator: {googleEnabled ? 'ON' : 'OFF'}
                </button>
                <div
                  role="group"
                  aria-label="Word conversion preference"
                  className="inline-flex rounded-lg border-[1.5px] border-[#2F3E4E]/30 dark:border-slate-700 bg-white dark:bg-[#0B1120] p-0.5"
                >
                  {(
                    [
                      ['gt', 'Google Translate', 'gt'],
                      ['sound', 'Sounds / Phonetic', '0'],
                      ['tu', 'Sari Tulu Word', '2'],
                    ] as [TranslationPreference, string, string][]
                  ).map(([prefKey, prefLabel, storeVal]) => (
                    <button
                      key={prefKey}
                      type="button"
                      aria-pressed={translationPref === prefKey || (prefKey === 'gt' && translationPref === 'kn')}
                      onClick={() => {
                        setTranslationPref(prefKey);
                        setUseWordByWord(false);
                        safeSetJson('tp_pm', storeVal);
                      }}
                      className={`px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                        translationPref === prefKey || (prefKey === 'gt' && translationPref === 'kn')
                          ? 'bg-[#F9C80E] text-[#2F3E4E] border border-[#2F3E4E]'
                          : 'text-[#475569] dark:text-slate-300 hover:bg-[#FEF2C8] dark:hover:bg-slate-800 border border-transparent'
                      }`}
                    >
                      {prefLabel}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setOverrides({});
                    setLangChoice({});
                    setExpandedWords({});
                    setSentenceChoice(null);
                    setUseWordByWord(false);
                    safeSetJson('tp_ov', {});
                    safeSetJson('tp_lg', {});
                    triggerNotice('Saved word choices cleared');
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold border-[1.5px] border-[#2F3E4E]/30 dark:border-slate-700 bg-white dark:bg-[#0B1120] text-[#475569] dark:text-slate-300 hover:bg-[#FEF2C8] dark:hover:bg-slate-800 cursor-pointer"
                >
                  Forget my choices
                </button>
              </div>
            </div>

            <p className="text-xs text-[#475569] dark:text-slate-400">
              {!convertOther
                ? 'Turn on “Other languages → Tulu” above to convert non-Kannada text automatically.'
                : distinctWords.length
                ? '1) Confirm the detected language. 2) Review Google Translate sentence alternatives or tap any Kannada/Tulu suggestion per word (expand “+ more” for up to 14 options), or type Kannada / English phonetics (e.g. cherri).'
                : 'Type or paste text in any language (e.g. cherry, good morning, how are you, Harshith, नमस्ते, வணக்கம்) for instant Google Translate + Tulu Lipi.'}
            </p>

            {convertOther && (
              <div className="space-y-2">
                {/* Google Translate Full Sentence Card (when 2+ words & Google data present) */}
                {googleEnabled &&
                  distinctWords.length > 1 &&
                  activeSourceLang !== 'rm' &&
                  googleData?.queryKey === googleQueryKey &&
                  googleData.alternatives.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#2F3E4E]/12 dark:border-slate-700/80">
                      <span className="font-bold text-xs text-[#12805C] dark:text-emerald-400 min-w-[84px]">
                        Full Sentence
                      </span>
                      {googleData.alternatives.slice(0, 5).map((alt) => {
                        const isActive =
                          Boolean(activeGoogleFullTranslation) &&
                          (sentenceChoice || googleData.translatedText) === alt.kn;
                        return (
                          <button
                            key={alt.kn}
                            type="button"
                            aria-pressed={isActive}
                            onClick={() => {
                              setUseWordByWord(false);
                              setSentenceChoice(alt.kn);
                              // Clear word overrides so full-sentence Google Translate displays cleanly
                              const nextOv = { ...overrides };
                              distinctWords.forEach((w) => delete nextOv[w.toLowerCase()]);
                              setOverrides(nextOv);
                              safeSetJson('tp_ov', nextOv);
                            }}
                            className={`inline-flex flex-col items-start px-3 py-1 rounded-xl border text-left transition cursor-pointer ${
                              isActive
                                ? 'bg-[#F9C80E] text-[#2F3E4E] border-[#2F3E4E] shadow-xs'
                                : 'bg-white dark:bg-[#0B1120] text-[#2F3E4E] dark:text-slate-200 border-[#2F3E4E]/25 dark:border-slate-700 hover:bg-[#FEF2C8] dark:hover:bg-slate-800'
                            }`}
                          >
                            <span className="text-xs font-semibold">{alt.kn}</span>
                            <span className="tulu-lipi-font text-base leading-tight">
                              {kn2tu(alt.kn)}
                            </span>
                            <span className="text-[10px] opacity-75">{alt.tag}</span>
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        aria-pressed={useWordByWord || !activeGoogleFullTranslation}
                        onClick={() => setUseWordByWord(true)}
                        className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border cursor-pointer ${
                          useWordByWord || !activeGoogleFullTranslation
                            ? 'bg-[#2F3E4E] text-white border-[#2F3E4E] dark:bg-[#F9C80E] dark:text-[#0F172A]'
                            : 'bg-white dark:bg-[#0B1120] text-[#475569] dark:text-slate-300 border-[#2F3E4E]/25 dark:border-slate-700'
                        }`}
                      >
                        Pick Word-by-Word
                      </button>
                    </div>
                  )}

                {/* Language rows */}
                {(Object.keys(scriptCounts) as ScriptKey[]).map((sc) => {
                  const ok = Boolean(langChoice[sc]);
                  const cur = effLang(sc);
                  const count = scriptCounts[sc] || 0;
                  return (
                    <div
                      key={sc}
                      className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#2F3E4E]/12 dark:border-slate-700/80 text-xs"
                    >
                      <span className="font-bold text-[#2F3E4E] dark:text-slate-100 min-w-[76px]">
                        Language
                      </span>
                      <span className="text-[#475569] dark:text-slate-400">
                        {SCN[sc]} · {count} {count > 1 ? 'words' : 'word'} ·{' '}
                        {ok ? '✓ confirmed' : 'detected automatically'}:
                      </span>
                      {LGO[sc].map(([id, nm]) => {
                        const pressed = ok && id === cur;
                        return (
                          <button
                            key={id}
                            type="button"
                            aria-pressed={pressed}
                            onClick={() => {
                              const next = { ...langChoice, [sc]: id };
                              setLangChoice(next);
                              safeSetJson('tp_lg', next);
                            }}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border cursor-pointer ${
                              pressed
                                ? 'bg-[#F9C80E] text-[#2F3E4E] border-[#2F3E4E]'
                                : 'bg-white dark:bg-[#0B1120] text-[#2F3E4E] dark:text-slate-200 border-[#2F3E4E]/25 dark:border-slate-700'
                            }`}
                          >
                            {id === cur ? (ok ? '✓ ' : 'Yes, ') : ''}
                            {nm}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}

                {/* Word candidate rows */}
                {distinctWords.slice(0, 40).map((w) => {
                  const k = w.toLowerCase();
                  const c = getCands(w);
                  const cur = getChosen(w);
                  const flag = c.length > 1 && !NM[k] && !overrides[k];
                  const list = c.slice();
                  if (overrides[k] && !list.some((o) => o[0] === overrides[k])) {
                    list.unshift([overrides[k], 'your spelling']);
                  }
                  const isExpanded = Boolean(expandedWords[k]);
                  let visibleList = isExpanded ? list : list.slice(0, 6);
                  if (!isExpanded && !visibleList.some(([kk]) => kk === cur)) {
                    const chosenItem = list.find(([kk]) => kk === cur);
                    if (chosenItem) {
                      visibleList = [chosenItem, ...visibleList.slice(0, 5)];
                    }
                  }
                  const hiddenCount = Math.max(0, list.length - visibleList.length);
                  const rawCustom = customInputs[k] || '';
                  const resolvedCustom = resolveCustomSpellingInput(rawCustom);
                  const applyCustom = () => {
                    if (!resolvedCustom) return;
                    setUseWordByWord(true);
                    const next = { ...overrides, [k]: resolvedCustom };
                    setOverrides(next);
                    safeSetJson('tp_ov', next);
                    setCustomInputs((prev) => ({ ...prev, [k]: '' }));
                  };

                  return (
                    <div
                      key={w}
                      className="flex flex-wrap items-center gap-2 pt-2.5 border-t border-[#2F3E4E]/12 dark:border-slate-700/80"
                    >
                      <span className="font-bold text-sm text-[#2F3E4E] dark:text-slate-100 min-w-[84px]">
                        {w}
                      </span>
                      {(overrides[k] || flag) && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            overrides[k]
                              ? 'bg-[#CEE5DC] text-[#12805C]'
                              : 'bg-[#FEF3C7] text-[#92400E]'
                          }`}
                        >
                          {overrides[k] ? '✓ chosen' : 'pick best'}
                        </span>
                      )}
                      {visibleList.map(([kk, tag]) => {
                        const isSpecialTag =
                          tag.startsWith('Google') ||
                          tag === 'Tulu word' ||
                          tag === 'Kannada meaning' ||
                          tag === 'recommended' ||
                          tag === 'standard spelling' ||
                          tag === 'your spelling';
                        return (
                          <button
                            key={`${kk}-${tag}`}
                            type="button"
                            aria-pressed={kk === cur}
                            onClick={() => {
                              setUseWordByWord(true);
                              const next = { ...overrides, [k]: kk };
                              setOverrides(next);
                              safeSetJson('tp_ov', next);
                            }}
                            className={`inline-flex flex-col items-start px-3 py-1 rounded-xl border text-left transition cursor-pointer ${
                              kk === cur
                                ? 'bg-[#F9C80E] text-[#2F3E4E] border-[#2F3E4E] shadow-xs'
                                : 'bg-white dark:bg-[#0B1120] text-[#2F3E4E] dark:text-slate-200 border-[#2F3E4E]/25 dark:border-slate-700 hover:bg-[#FEF2C8] dark:hover:bg-slate-800'
                            }`}
                          >
                            <span className="text-sm font-semibold">{kk}</span>
                            <span className="tulu-lipi-font text-lg leading-tight">
                              {kn2tu(kk)}
                            </span>
                            <span
                              className={`text-[10px] leading-tight mt-0.5 ${
                                kk === cur
                                  ? 'font-bold text-[#2F3E4E]'
                                  : isSpecialTag
                                  ? 'font-semibold text-[#12805C] dark:text-emerald-400'
                                  : 'opacity-75'
                              }`}
                            >
                              {tag}
                            </span>
                          </button>
                        );
                      })}
                      {list.length > 6 && (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedWords((prev) => ({ ...prev, [k]: !prev[k] }))
                          }
                          className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold border border-dashed border-[#2F3E4E]/35 dark:border-slate-600 bg-white/70 dark:bg-[#0B1120] text-[#2F3E4E] dark:text-slate-200 hover:bg-[#FEF2C8] dark:hover:bg-slate-800 cursor-pointer"
                        >
                          {isExpanded
                            ? 'Show fewer'
                            : `+ ${hiddenCount} more ${hiddenCount === 1 ? 'option' : 'options'}`}
                        </button>
                      )}
                      <div className="inline-flex items-center gap-1.5">
                        <input
                          type="text"
                          value={rawCustom}
                          onChange={(e) =>
                            setCustomInputs((prev) => ({ ...prev, [k]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              applyCustom();
                            }
                          }}
                          placeholder="Other / phonetic…"
                          aria-label={`Custom Kannada or phonetic spelling for ${w}`}
                          className="w-36 px-2.5 py-1.5 rounded-xl border border-[#2F3E4E]/30 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs text-[#2F3E4E] dark:text-slate-100"
                        />
                        {rawCustom.trim() && resolvedCustom && (
                          <button
                            type="button"
                            onClick={applyCustom}
                            title={`Apply ${resolvedCustom}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#12805C] hover:bg-[#0f6b4d] text-white text-[11px] font-bold cursor-pointer"
                          >
                            <span>Apply: {resolvedCustom}</span>
                            <span className="tulu-lipi-font text-sm leading-none">
                              {kn2tu(resolvedCustom)}
                            </span>
                          </button>
                        )}
                      </div>
                      {overrides[k] && (
                        <button
                          type="button"
                          onClick={() => {
                            const next = { ...overrides };
                            delete next[k];
                            setOverrides(next);
                            safeSetJson('tp_ov', next);
                          }}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold border border-[#2F3E4E]/25 dark:border-slate-700 text-[#475569] dark:text-slate-300 hover:bg-rose-50 cursor-pointer"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  );
                })}
                {distinctWords.length > 40 && (
                  <p className="text-xs text-[#64748B] dark:text-slate-400">
                    Showing the first 40 distinct words.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Virtual Lipi Keyboard */}
          {showKeyboard && (
            <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#2F3E4E]/15 dark:border-slate-700">
                <span className="font-display font-bold text-sm text-[#2F3E4E] dark:text-slate-100">
                  Interactive Tulu Lipi Keyboard (Tap glyph to insert)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => insertAtCursor(' ')}
                    className="px-3.5 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-bold text-[#2F3E4E] dark:text-slate-100 hover:bg-[#FEF2C8] dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Space
                  </button>
                  <button
                    type="button"
                    onClick={backspaceAtCursor}
                    className="px-3.5 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-bold text-[#2F3E4E] dark:text-slate-100 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {Object.keys(PG).map((sec) => (
                <div key={sec} className="space-y-2">
                  <h3 className="text-xs font-display font-extrabold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                    {PG_NAMES[sec]}
                  </h3>
                  <div className="grid grid-cols-5 sm:grid-cols-9 md:grid-cols-12 gap-1.5">
                    {PG[sec].map((ch) => (
                      <button
                        key={ch}
                        type="button"
                        aria-label={ch}
                        onPointerDown={(e) => e.preventDefault()}
                        onClick={() => insertAtCursor(ch)}
                        className="h-14 rounded-xl bg-[#FEF2C8]/55 dark:bg-[#0B1120] hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] border border-[#2F3E4E]/25 dark:border-slate-700 text-[#2F3E4E] dark:text-slate-100 dark:hover:text-[#0F172A] flex flex-col items-center justify-center transition-colors cursor-pointer"
                      >
                        <span className="tulu-lipi-font text-2xl leading-none">
                          {kn2tu(ch)}
                        </span>
                        <span className="text-[10px] text-[#64748B] dark:text-slate-400 mt-0.5">
                          {/^[\u0C82\u0C83\u0CBE-\u0CCD]/.test(ch) ? `◌${ch}` : ch}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-[#64748B] dark:text-slate-400">
            Tulu code is the legacy text that the Baravu OpenType font reads. Paste it into any app
            that has the Baravu font installed, or download a high-resolution PNG/Poster directly.
          </p>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: LIPI CHART                                                   */}
      {/* =================================================================== */}
      {activeTab === 'chart' && (
        <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-4 sm:p-5 space-y-5">
          <p className="text-xs sm:text-sm text-[#475569] dark:text-slate-300">
            Tap any character card to append it directly to your Write editor.
          </p>
          {Object.keys(PG).map((sec) => (
            <div key={sec} className="space-y-2.5">
              <h3 className="font-display font-bold text-sm text-[#2F3E4E] dark:text-slate-100 border-b border-[#2F3E4E]/15 dark:border-slate-700 pb-1.5">
                {PG_NAMES[sec]}
              </h3>
              <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-10 gap-2">
                {PG[sec].map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => {
                      insertAtCursor(ch);
                      setActiveTab('write');
                    }}
                    className="rounded-xl p-2.5 bg-white dark:bg-[#0B1120] hover:bg-[#F9C80E] dark:hover:bg-[#F9C80E] border-[1.5px] border-[#2F3E4E]/25 dark:border-slate-700 text-[#2F3E4E] dark:text-slate-100 dark:hover:text-[#0F172A] text-center transition-colors cursor-pointer"
                  >
                    <div className="tulu-lipi-font text-3xl leading-tight">
                      {kn2tu(ch)}
                    </div>
                    <div className="text-xs font-bold mt-1">
                      {/^[\u0C82\u0C83\u0CBE-\u0CCD]/.test(ch) ? `◌${ch}` : ch}
                    </div>
                    <div className="text-[11px] opacity-70">{kn2rom(ch) || '—'}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: DECODE                                                       */}
      {/* =================================================================== */}
      {activeTab === 'decode' && (
        <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="tulusiri-decode-input"
              className="block text-xs font-bold text-[#2F3E4E] dark:text-slate-200"
            >
              Paste legacy Baravu-font encoded text to decode into Kannada &amp; verify glyphs
            </label>
            <textarea
              id="tulusiri-decode-input"
              rows={4}
              value={decodeInput}
              onChange={(e) => setDecodeInput(e.target.value)}
              placeholder="Paste Baravu legacy ASCII code (e.g. semAlu)…"
              className="tulu-lipi-font w-full rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-[#2F3E4E] dark:text-slate-100 p-3 text-2xl focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="text-xs font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                Decoded Kannada Script
              </div>
              <div className="min-h-[120px] rounded-xl border-[1.5px] border-dashed border-[#C8870A] dark:border-[#F9C80E]/60 bg-white dark:bg-[#0B1120] text-[#2F3E4E] dark:text-slate-100 p-4 text-xl font-medium whitespace-pre-wrap break-words">
                {tu2kn(decodeInput) || '—'}
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="text-xs font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                Baravu Tulu Lipi Preview
              </div>
              <div className="tulu-lipi-font min-h-[120px] rounded-xl border-[1.5px] border-dashed border-[#C8870A] dark:border-[#F9C80E]/60 bg-white dark:bg-[#0B1120] text-[#2F3E4E] dark:text-slate-100 p-4 text-3xl whitespace-pre-wrap break-words">
                {decodeInput || '—'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 4: DICTIONARY                                                   */}
      {/* =================================================================== */}
      {activeTab === 'dict' && (
        <div className="space-y-4">
          <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-4 space-y-3">
            <div className="relative">
              <Search
                className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={dictQuery}
                onChange={(e) => setDictQuery(e.target.value)}
                placeholder="Search Tulu, Kannada or English meanings…"
                aria-label="Search Tulu dictionary"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-sm text-[#2F3E4E] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {dictFirstLetters.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setDictFilter(k)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold border cursor-pointer ${
                    dictFilter === k
                      ? 'bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#FFFDF5] dark:text-[#0F172A] border-[#2F3E4E] dark:border-[#F9C80E]'
                      : 'bg-white dark:bg-[#0B1120] text-[#2F3E4E] dark:text-slate-200 border-[#2F3E4E]/25 dark:border-slate-700'
                  }`}
                >
                  {k}
                </button>
              ))}
              <span className="ml-auto text-xs font-mono font-semibold text-[#64748B] dark:text-slate-400">
                {filteredDict.length} of {D.length} words
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredDict.map((d) => {
              const isSaved = favorites.includes(d[1]);
              return (
                <div
                  key={`${d[0]}-${d[1]}`}
                  className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-4 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="tulu-lipi-font text-3xl text-[#7D0B0B] dark:text-[#F9C80E]">
                      {kn2tu(d[0])}
                    </div>
                    <div className="font-bold text-sm text-[#2F3E4E] dark:text-slate-100">
                      {d[0]}{' '}
                      <span className="font-mono text-xs text-[#64748B] dark:text-slate-400">
                        /{d[1]}/
                      </span>
                    </div>
                    <div className="text-sm text-[#2F3E4E] dark:text-slate-200">{d[2]}</div>
                    <div className="text-xs text-[#64748B] dark:text-slate-400">{d[3]}</div>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-[#2F3E4E]/12 dark:border-slate-700/70">
                    <button
                      type="button"
                      onClick={() => speakKannada(d[0])}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#2F3E4E]/30 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-bold text-[#2F3E4E] dark:text-slate-200 hover:bg-[#FEF2C8] cursor-pointer"
                    >
                      <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Listen</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleFavoriteWord(d[1])}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-bold cursor-pointer ${
                        isSaved
                          ? 'bg-[#F9C80E] text-[#2F3E4E] border-[#2F3E4E]'
                          : 'bg-white dark:bg-[#0B1120] text-[#475569] dark:text-slate-300 border-[#2F3E4E]/30 dark:border-slate-600'
                      }`}
                    >
                      <Star
                        className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`}
                        aria-hidden="true"
                      />
                      <span>{isSaved ? 'Saved' : 'Save'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 5: SARI TULU (TAP TO FLIP)                                      */}
      {/* =================================================================== */}
      {activeTab === 'words' && (
        <div className="space-y-4">
          <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-4 space-y-2">
            <div className="relative">
              <Search
                className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={wordsQuery}
                onChange={(e) => setWordsQuery(e.target.value)}
                placeholder="Search common borrowed vs authentic Tulu words…"
                aria-label="Search Sari Tulu words"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-sm text-[#2F3E4E] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
              />
            </div>
            <p className="text-xs text-[#64748B] dark:text-slate-400">
              Tap any card to flip between commonly confused Kannada-borrowed words and authentic
              Sari Tulu equivalents.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredWords.map((w, idx) => {
              const flipped = Boolean(flippedWordIdx[idx]);
              return (
                <button
                  key={`${w[0]}-${w[1]}`}
                  type="button"
                  onClick={() =>
                    setFlippedWordIdx((prev) => ({ ...prev, [idx]: !prev[idx] }))
                  }
                  className={`text-left rounded-2xl p-4 min-h-[136px] border-[1.5px] transition-all cursor-pointer flex flex-col justify-between ${
                    flipped
                      ? 'bg-[#CEE5DC]/60 dark:bg-emerald-950/40 border-[#12805C] dark:border-emerald-500/60 shadow-[0_3px_0_#12805C]'
                      : 'bg-[#FFFDF5] dark:bg-[#131C2E] border-[#2F3E4E] dark:border-slate-700 hover:-translate-y-0.5 hover:shadow-[0_3px_0_#2F3E4E]'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider">
                    <span
                      className={
                        flipped
                          ? 'text-[#12805C] dark:text-emerald-400'
                          : 'text-[#B91C1C] dark:text-rose-400'
                      }
                    >
                      {flipped ? '✓ Correct Sari Tulu' : 'Common Mistake (Tap to reveal)'}
                    </span>
                  </div>
                  <div className="tulu-lipi-font text-3xl text-[#2F3E4E] dark:text-slate-100 my-1">
                    {kn2tu(flipped ? w[1] : w[0])}
                  </div>
                  <div className="font-bold text-sm text-[#2F3E4E] dark:text-slate-200">
                    {flipped ? w[1] : w[0]}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 6: SENTENCES                                                    */}
      {/* =================================================================== */}
      {activeTab === 'sent' && (
        <div className="space-y-4">
          <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-4 space-y-3">
            <div className="relative">
              <Search
                className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={sentQuery}
                onChange={(e) => setSentQuery(e.target.value)}
                placeholder="Search everyday Tulu sentences…"
                aria-label="Search sentences"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-sm text-[#2F3E4E] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#F9C80E]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(['All', 'Common', 'Family', 'Travel'] as SentenceCategory[]).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSentCat(cat)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold border cursor-pointer ${
                    sentCat === cat
                      ? 'bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#FFFDF5] dark:text-[#0F172A] border-[#2F3E4E] dark:border-[#F9C80E]'
                      : 'bg-white dark:bg-[#0B1120] text-[#2F3E4E] dark:text-slate-200 border-[#2F3E4E]/25 dark:border-slate-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredSentences.map((s, idx) => (
              <div
                key={`${s[0]}-${idx}`}
                className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-4 flex flex-col justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#FEF2C8] dark:bg-slate-800 text-[#2F3E4E] dark:text-slate-300 border border-[#2F3E4E]/20">
                      {s[3]}
                    </span>
                  </div>
                  <div className="tulu-lipi-font text-2xl sm:text-3xl text-[#7D0B0B] dark:text-[#F9C80E] pt-1">
                    {kn2tu(s[0])}
                  </div>
                  <div className="font-bold text-sm text-[#2F3E4E] dark:text-slate-100">
                    {s[0]}
                  </div>
                  <div className="text-sm text-[#334155] dark:text-slate-200">{s[1]}</div>
                  <div className="text-xs text-[#64748B] dark:text-slate-400">{s[2]}</div>
                </div>
                <div className="pt-2 border-t border-[#2F3E4E]/12 dark:border-slate-700/70">
                  <button
                    type="button"
                    onClick={() => speakKannada(s[0])}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#2F3E4E]/30 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-bold text-[#2F3E4E] dark:text-slate-200 hover:bg-[#FEF2C8] cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Listen</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 7: LEARN (WORD OF THE DAY + FLASHCARDS + HANDWRITING)           */}
      {/* =================================================================== */}
      {activeTab === 'learn' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-4">
            {/* Word of the day */}
            <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-5 space-y-2 shadow-[0_3px_0_#2F3E4E] dark:shadow-[0_3px_0_#020617]">
              <div className="flex items-center justify-between gap-2">
                <strong className="font-display text-sm text-[#2F3E4E] dark:text-slate-100">
                  Word of the Day
                </strong>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#F9C80E] text-[#2F3E4E] border border-[#2F3E4E]">
                  {streakDays} {streakDays === 1 ? 'day' : 'day streak'}
                </span>
              </div>
              <div className="tulu-lipi-font text-4xl sm:text-5xl text-[#7D0B0B] dark:text-[#F9C80E] py-1">
                {kn2tu(wordOfDay[0])}
              </div>
              <div className="text-sm font-medium text-[#2F3E4E] dark:text-slate-200">
                {wordOfDay[0]} /{wordOfDay[1]}/ · {wordOfDay[2]} · {wordOfDay[3]}
              </div>
            </div>

            {/* Spaced-repetition flashcards */}
            <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-5 space-y-3 shadow-[0_3px_0_#2F3E4E] dark:shadow-[0_3px_0_#020617]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="font-display text-sm text-[#2F3E4E] dark:text-slate-100">
                  Spaced-Repetition Flashcards
                </strong>
                <span className="text-xs font-mono text-[#64748B] dark:text-slate-400">
                  {flashStats.dueCount} due · {flashStats.freshCount} new · {flashStats.learnedCount} learned
                </span>
              </div>

              {flashCard ? (
                <>
                  <div className="tulu-lipi-font text-4xl sm:text-5xl text-[#2F3E4E] dark:text-slate-50 py-2">
                    {kn2tu(flashCard[0])}
                  </div>
                  <div className="text-base font-bold text-[#2F3E4E] dark:text-slate-100">
                    {flashCard[0]}
                  </div>
                  {flashShowAnswer && (
                    <div className="text-sm text-[#475569] dark:text-slate-300 bg-[#FEF2C8]/70 dark:bg-slate-800/70 p-2.5 rounded-lg border border-[#2F3E4E]/15">
                      /{flashCard[1]}/ · {flashCard[2]} · {flashCard[3]}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {!flashShowAnswer ? (
                      <button
                        type="button"
                        onClick={() => setFlashShowAnswer(true)}
                        className="px-4 py-2 rounded-xl bg-[#7D0B0B] text-white text-xs font-bold border border-[#2F3E4E] cursor-pointer"
                      >
                        Show Answer
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => gradeFlashcard(0)}
                          className="px-3.5 py-2 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border border-rose-400 text-xs font-bold cursor-pointer"
                        >
                          Again
                        </button>
                        <button
                          type="button"
                          onClick={() => gradeFlashcard(1)}
                          className="px-3.5 py-2 rounded-xl bg-[#F9C80E] text-[#2F3E4E] border border-[#2F3E4E] text-xs font-bold cursor-pointer"
                        >
                          Good
                        </button>
                        <button
                          type="button"
                          onClick={() => gradeFlashcard(2)}
                          className="px-3.5 py-2 rounded-xl bg-[#CEE5DC] dark:bg-emerald-950/60 text-[#12805C] dark:text-emerald-300 border border-[#12805C] text-xs font-bold cursor-pointer"
                        >
                          Easy
                        </button>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-[#12805C] dark:text-emerald-400 font-semibold">
                  All flashcards reviewed for today! Come back tomorrow.
                </p>
              )}
            </div>
          </div>

          {/* Handwriting Canvas */}
          <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-5 space-y-3 shadow-[0_3px_0_#2F3E4E] dark:shadow-[0_3px_0_#020617]">
            <div className="flex items-center justify-between gap-2">
              <strong className="font-display text-sm text-[#2F3E4E] dark:text-slate-100">
                Handwriting Practice
              </strong>
              <span className="text-xs text-[#64748B] dark:text-slate-400">
                Trace over the faint Tulu Lipi glyph
              </span>
            </div>

            <div className="flex justify-center">
              <canvas
                ref={hwCanvasRef}
                width={320}
                height={320}
                onPointerDown={(e) => {
                  hwDrawingRef.current = true;
                  e.currentTarget.setPointerCapture(e.pointerId);
                  const ctx = hwCanvasRef.current?.getContext('2d');
                  if (!ctx) return;
                  const [x, y] = getCanvasPoint(e);
                  ctx.strokeStyle = '#2F3E4E';
                  ctx.lineWidth = 7;
                  ctx.lineCap = 'round';
                  ctx.lineJoin = 'round';
                  ctx.beginPath();
                  ctx.moveTo(x, y);
                  ctx.lineTo(x + 0.1, y + 0.1);
                  ctx.stroke();
                }}
                onPointerMove={(e) => {
                  if (!hwDrawingRef.current) return;
                  const ctx = hwCanvasRef.current?.getContext('2d');
                  if (!ctx) return;
                  const [x, y] = getCanvasPoint(e);
                  ctx.lineTo(x, y);
                  ctx.stroke();
                }}
                onPointerUp={() => {
                  hwDrawingRef.current = false;
                }}
                onPointerCancel={() => {
                  hwDrawingRef.current = false;
                }}
                className="max-w-full border-[1.5px] border-dashed border-[#C8870A] rounded-2xl touch-none bg-[#FFFDF5] cursor-crosshair"
              />
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => setHwIdx((i) => (i + L_HL.length - 1) % L_HL.length)}
                className="px-3.5 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-bold text-[#2F3E4E] dark:text-slate-100 hover:bg-[#FEF2C8] cursor-pointer"
              >
                Previous
              </button>
              <span className="font-display font-extrabold text-xl text-[#2F3E4E] dark:text-slate-100">
                {L_HL[hwIdx]} ({kn2rom(L_HL[hwIdx])})
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={drawHwGuide}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border-[1.5px] border-[#2F3E4E] dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs font-bold text-[#2F3E4E] dark:text-slate-100 hover:bg-rose-50 cursor-pointer"
                >
                  <Eraser className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Clear</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHwIdx((i) => (i + 1) % L_HL.length)}
                  className="px-3.5 py-1.5 rounded-lg bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#FFFDF5] dark:text-[#0F172A] text-xs font-bold border-[1.5px] border-[#2F3E4E] dark:border-[#F9C80E] cursor-pointer"
                >
                  Next Letter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 8: QUIZ                                                         */}
      {/* =================================================================== */}
      {activeTab === 'quiz' && (
        <div className="bg-[#FFFDF5] dark:bg-[#131C2E] border-[1.5px] border-[#2F3E4E] dark:border-slate-700 rounded-2xl p-5 space-y-4 shadow-[0_3px_0_#2F3E4E] dark:shadow-[0_3px_0_#020617]">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#2F3E4E]/15 dark:border-slate-700">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                aria-pressed={quizMode === 'w'}
                onClick={() => {
                  setQuizMode('w');
                  setQuizScore(0);
                  setQuizCount(0);
                  setQuizStreak(0);
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border-[1.5px] cursor-pointer ${
                  quizMode === 'w'
                    ? 'bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#FFFDF5] dark:text-[#0F172A] border-[#2F3E4E] dark:border-[#F9C80E]'
                    : 'bg-white dark:bg-[#0B1120] text-[#2F3E4E] dark:text-slate-200 border-[#2F3E4E]/30 dark:border-slate-700'
                }`}
              >
                Sari Tulu Words
              </button>
              <button
                type="button"
                aria-pressed={quizMode === 'd'}
                onClick={() => {
                  setQuizMode('d');
                  setQuizScore(0);
                  setQuizCount(0);
                  setQuizStreak(0);
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border-[1.5px] cursor-pointer ${
                  quizMode === 'd'
                    ? 'bg-[#2F3E4E] dark:bg-[#F9C80E] text-[#FFFDF5] dark:text-[#0F172A] border-[#2F3E4E] dark:border-[#F9C80E]'
                    : 'bg-white dark:bg-[#0B1120] text-[#2F3E4E] dark:text-slate-200 border-[#2F3E4E]/30 dark:border-slate-700'
                }`}
              >
                Dictionary Meanings
              </button>
            </div>

            <div className="text-xs font-mono font-bold text-[#475569] dark:text-slate-300">
              Score {quizScore} of {quizCount} · Streak {quizStreak} · Best streak {quizBest}
            </div>
          </div>

          {quizQuestion && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-[#64748B] dark:text-slate-400">
                  {quizMode === 'w'
                    ? 'Which is the correct Sari Tulu word for this Kannada word?'
                    : 'What does this Tulu word mean?'}
                </p>
                <div className="tulu-lipi-font text-4xl sm:text-5xl text-[#7D0B0B] dark:text-[#F9C80E] mt-2">
                  {kn2tu(quizQuestion.item[0])}
                </div>
                <div className="font-bold text-lg text-[#2F3E4E] dark:text-slate-100 mt-1">
                  {quizMode === 'w'
                    ? quizQuestion.item[0]
                    : `${quizQuestion.item[0]} /${quizQuestion.item[1]}/`}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {quizQuestion.options.map((opt, idx) => {
                  const isCorrectOpt = opt === quizQuestion.item;
                  const isChosen = quizSelectedIdx === idx;
                  let styleCls =
                    'bg-white dark:bg-[#0B1120] text-[#2F3E4E] dark:text-slate-100 border-[#2F3E4E]/30 dark:border-slate-700 hover:bg-[#FEF2C8] dark:hover:bg-slate-800';
                  if (quizSelectedIdx !== null) {
                    if (isCorrectOpt) {
                      styleCls =
                        'bg-[#12805C] text-white border-[#12805C]';
                    } else if (isChosen) {
                      styleCls = 'bg-[#B91C1C] text-white border-[#B91C1C]';
                    }
                  }
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleQuizAnswer(idx)}
                      className={`p-3.5 rounded-xl border-[1.5px] text-left transition-colors cursor-pointer ${styleCls}`}
                    >
                      {quizMode === 'w' ? (
                        <div className="flex items-center gap-3">
                          <span className="tulu-lipi-font text-2xl">{kn2tu(opt[1])}</span>
                          <span className="font-bold text-sm">{opt[1]}</span>
                        </div>
                      ) : (
                        <span className="font-medium text-sm">{opt[3]}</span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => nextQuizQuestion(quizMode)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#7D0B0B] hover:bg-[#600707] text-white border-[1.5px] border-[#2F3E4E] text-xs font-bold cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Next Question</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer attribution */}
      <p className="text-[11px] text-[#64748B] dark:text-slate-400 leading-relaxed">
        Listen buttons use your browser&apos;s Kannada voice synthesis where available, so Tulu
        sounds are approximate. Draft overrides and flashcard progress stay strictly inside your
        browser storage on this device.
      </p>
    </div>
  );
};
