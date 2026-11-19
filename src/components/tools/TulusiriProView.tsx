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
import '../../styles/baravu.css';

interface TulusiriProViewProps {
  tool?: ToolCatalogItem;
  onBack?: () => void;
}

type StudioTab =
  | 'write'
  | 'chart'
  | 'decode'
  | 'dict'
  | 'words'
  | 'sent'
  | 'learn'
  | 'quiz';

type InputMode = 'en' | 'tu';
type ScriptKey =
  | 'latin'
  | 'dev'
  | 'ben'
  | 'gur'
  | 'guj'
  | 'odi'
  | 'tam'
  | 'tel'
  | 'mal';

type SentenceCategory = 'All' | 'Common' | 'Family' | 'Travel';
type QuizMode = 'w' | 'd';

// ============================================================================
// BARAVU (TULU LIPI) <-> KANNADA CONVERSION ENGINE
// ============================================================================
const CN =
  'ಕkಖKಗgಘGಙZಚcಛCಜjಝJಞzಟqಠQಡwಢWಣNತtಥTದdಧDನnಪpಫPಬbಭBಮmಯyರrಲlವvಶSಷxಸsಹXhಳL';
const C: Record<string, string> = {};
const R: Record<string, string> = {};
for (let i = 0; i < CN.length; ) {
  const k = CN[i];
  let v = CN[i + 1];
  i += 2;
  if (v === 'X') {
    v = 'Xh';
    i++;
  }
  C[k] = v;
  R[v] = k;
}

const IV: Record<string, string> = {
  ಅ: 'XAA',
  ಆ: 'XAa',
  ಇ: 'XAi',
  ಈ: 'XAI',
  ಉ: 'XAu',
  ಊ: 'XAU',
  ಋ: 'XAR',
  ೠ: 'XARR',
  ಎ: 'eA',
  ಏ: 'EA',
  ಐ: 'eeA',
  ಒ: 'eAa',
  ಓ: 'FAa',
  ಔ: 'XAY',
};
const POST: Record<string, string> = {
  'ಾ': 'a',
  'ಿ': 'i',
  'ೀ': 'I',
  'ು': 'u',
  'ೂ': 'U',
  'ೃ': 'R',
  'ೄ': 'RR',
  'ೌ': 'Y',
};
const PRE: Record<string, string> = {
  'ೆ': 'e',
  'ೇ': 'E',
  'ೈ': 'ee',
  'ೊ': 'e',
  'ೋ': 'F',
};
const POSTX: Record<string, string> = {
  'ೊ': 'a',
  'ೋ': 'a',
};
const KD = '೦೧೨೩೪೫೬೭೮೯';

function kn2tu(t: string): string {
  let o = '';
  let i = 0;
  const n = t.length;
  const isC = (c: string | undefined): c is string =>
    typeof c === 'string' && Object.prototype.hasOwnProperty.call(C, c);

  while (i < n) {
    const c = t[i];
    if (t.startsWith('ಶ್ರೀ', i)) {
      o += 'SArXI';
      i += 4;
      continue;
    }
    if (t.startsWith('ಓಂ', i)) {
      o += 'FAamXA';
      i += 2;
      continue;
    }
    if (c in IV) {
      let s = IV[c];
      i++;
      if ((c === 'ಎ' || c === 'ಏ') && t[i] === '*') {
        s = c === 'ಎ' ? 'oA' : 'OA';
        i++;
      }
      o += s;
      continue;
    }
    if (isC(c)) {
      const cl = [C[c]];
      let hal = false;
      let rep = false;
      i++;
      while (t[i] === '್') {
        if (isC(t[i + 1])) {
          cl.push(C[t[i + 1]]);
          i += 2;
        } else {
          hal = true;
          i++;
          break;
        }
      }
      if (c === 'ರ' && cl.length > 1) {
        rep = true;
        cl.shift();
      }
      let s = cl.join('A');
      if (rep) s += 'f';
      if (hal) s += 'A';
      let pre = '';
      let post = '';
      const v = t[i];
      if (v in POST) {
        post = POST[v];
        i++;
      } else if (v in PRE) {
        pre = PRE[v];
        post = POSTX[v] || '';
        i++;
        if (t[i] === '*' && (v === 'ೆ' || v === 'ೇ')) {
          pre = v === 'ೆ' ? 'o' : 'O';
          i++;
        }
      }
      if (t[i] === '಼') i++;
      let m = '';
      if (t[i] === 'ಂ') {
        m = 'M';
        i++;
      } else if (t[i] === 'ಃ') {
        m = 'H';
        i++;
      }
      o += pre + s + post + m;
      continue;
    }
    if (c in POST) {
      o += POST[c];
      i++;
      continue;
    }
    if (c in PRE) {
      o += PRE[c] + (POSTX[c] || '');
      i++;
      continue;
    }
    if (c === 'ಂ') {
      o += 'M';
      i++;
      continue;
    }
    if (c === 'ಃ') {
      o += 'H';
      i++;
      continue;
    }
    if (c === '್') {
      o += 'A';
      i++;
      continue;
    }
    const d = KD.indexOf(c);
    if (d >= 0) {
      o += String(d);
      i++;
      continue;
    }
    if (c === '\u200c' || c === '\u200d') {
      i++;
      continue;
    }
    o += c;
    i++;
  }
  return o;
}

const IVL: [string, string][] = Object.entries(IV)
  .map(([k, v]): [string, string] => [v, k])
  .concat([
    ['oA', 'ಎ*'],
    ['OA', 'ಏ*'],
    ['SArXI', 'ಶ್ರೀ'],
    ['FAamXA', 'ಓಂ'],
  ])
  .sort((a, b) => b[0].length - a[0].length);

const PI: Record<string, string> = {
  a: 'ಾ',
  i: 'ಿ',
  I: 'ೀ',
  u: 'ು',
  U: 'ೂ',
  R: 'ೃ',
  RR: 'ೄ',
  Y: 'ೌ',
};

function tu2kn(t: string): string {
  let o = '';
  let i = 0;
  const n = t.length;
  const mc = (p: number): string | null =>
    t.startsWith('Xh', p) ? 'Xh' : t[p] && t[p] in R && t[p] !== 'X' ? t[p] : null;

  while (i < n) {
    let hit: [string, string] | null = null;
    for (const [k, v] of IVL) {
      if (t.startsWith(k, i)) {
        hit = [k, v];
        break;
      }
    }
    if (hit) {
      o += hit[1];
      i += hit[0].length;
      continue;
    }
    let p = i;
    let pre = '';
    if (t.startsWith('ee', p)) {
      pre = 'ee';
      p += 2;
    } else if (t[p] && 'eEFoO'.includes(t[p])) {
      pre = t[p];
      p++;
    }
    const f = mc(p);
    if (f) {
      const cl = [f];
      p += f.length;
      let hal = false;
      let rep = false;
      while (t[p] === 'A') {
        const g = mc(p + 1);
        if (g) {
          cl.push(g);
          p += 1 + g.length;
        } else {
          hal = true;
          p++;
          break;
        }
      }
      if (t[p] === 'f') {
        rep = true;
        p++;
      }
      let post = '';
      if (t.startsWith('RR', p)) {
        post = 'RR';
        p += 2;
      } else if (t[p] && 'aiIuURY'.includes(t[p])) {
        post = t[p];
        p++;
      }
      let sg = '';
      if (pre) {
        sg =
          pre === 'e'
            ? post === 'a'
              ? 'ೊ'
              : 'ೆ'
            : pre === 'F'
            ? 'ೋ'
            : pre === 'E'
            ? 'ೇ'
            : pre === 'ee'
            ? 'ೈ'
            : pre === 'o'
            ? 'ೆ*'
            : 'ೇ*';
        if (post && !(post === 'a' && (pre === 'e' || pre === 'F'))) {
          sg += PI[post] || '';
        }
      } else if (post) {
        sg = PI[post] || '';
      }
      let m = '';
      if (t[p] === 'M') {
        m = 'ಂ';
        p++;
      } else if (t[p] === 'H') {
        m = 'ಃ';
        p++;
      }
      o +=
        (rep ? 'ರ್' : '') +
        cl.map((x) => R[x]).join('್') +
        (hal ? '್' : '') +
        sg +
        m;
      i = p;
      continue;
    }
    if (pre) {
      o +=
        pre === 'e'
          ? 'ೆ'
          : pre === 'F'
          ? 'ೋ'
          : pre === 'E'
          ? 'ೇ'
          : pre === 'ee'
          ? 'ೈ'
          : pre === 'o'
          ? 'ೆ*'
          : 'ೇ*';
      i = p;
      continue;
    }
    if (t[i] === 'M') {
      o += 'ಂ';
      i++;
      continue;
    }
    if (t[i] === 'H') {
      o += 'ಃ';
      i++;
      continue;
    }
    if (/[0-9]/.test(t[i])) {
      o += KD[Number(t[i])];
      i++;
      continue;
    }
    o += t[i];
    i++;
  }
  return o;
}

// ============================================================================
// DATASETS: DICTIONARY (D), SARI TULU PAIRS (W), SENTENCES (S)
// ============================================================================
const D: [string, string, string, string][] = `ಅಬಡೆ|abade|ಹುರುಳಿ ಕಾಯಿ|A kind of bean
ಅಬದು|abadu|ಗೊರಸು|Hoof
ಅಬ್ಬೇಸೊ|abbeso|ಅಭ್ಯಾಸ|Study, practice
ಅಬೆ|abe|ಕುಟ್ಟುವುದು (ಭತ್ತ)|To pound rice
ಅಚ್ಚಿಬೆಲ್ಲೊ|accibello|ಅಚ್ಚು ಬೆಲ್ಲ|Jaggery cakes cast in moulds
ಅಡಕ್ಕತ್ತರಿ|adakkattari|ಅಡಿಕೆ ಕತ್ತರಿ|Scissors used to crush areca nuts
ಅಡಂಗಾಯಿ|adangayi|ಒಂದು ರೀತಿಯ ಉಪ್ಪಿನಕಾಯಿ|A kind of pickle
ಅಡ್ಡಬೇಲಿ|addabeli|ಅಡ್ಡ ಬೇಲಿ|Partition fence
ಅಡ್ಡದಂಡಿಗೆ|addadandige|ಪಲ್ಲಕ್ಕಿ|Open palanquin
ಅಡ್ಡಪುದರು|addapudaru|ಅಡ್ಡಹೆಸರು|Nickname
ಅಡಿಗೆ|adige|ಅಡುಗೆ; ಪದಾರ್ಥ|Cooking; a dish
ಅಡ್ಪಿಲು|adpilu|ಅಡುಗೆ ಮನೆ|Kitchen
ಅಜ್ಜ|ajja|ಅಜ್ಜ|Grandfather
ಅಜ್ಜಿ|ajji|ಅಜ್ಜಿ|Grandmother
ಅಕ್ಕ|akka|ಅಕ್ಕ; ಹಿರಿಯ ಮಹಿಳೆ|Elder sister; an elderly woman
ಅಕ್ಕರೆ|akkare|ಪ್ರೀತಿ, ಮಮತೆ|Affection, fondness
ಅಂಗಡಿ|angadi|ಅಂಗಡಿ|A shop
ಅಂಗಿ|angi|ಅಂಗಿ ಅಥವಾ ಶರ್ಟ್|A coat or shirt
ಅಂಜಲು|anjalu|ಅಂಜಲ್ ಮೀನು|Seer fish
ಅರಮನೆ|aramane|ಅರಮನೆ|Palace
ಅರಸು|arasu|ರಾಜ|King, monarch
ಅಪ್ಪೆ|appe|ತಾಯಿ|Mother
ಅಮ್ಮೆ|amme|ತಂದೆ|Father
ಅಣ್ಣೆ|anne|ಅಣ್ಣ|Elder brother
ಆನೆ|ane|ಆನೆ|Elephant
ಆಕಾಸೊ|akaso|ಆಕಾಶ|Sky
ಆಸ್ತಿ|asti|ಆಸ್ತಿ|Property
ಆಟಿ|ati|ಆಟಿ ಮಾಸ|Fourth solar month
ಇಲ್ಲು|illu|ಮನೆ|House
ಇರ್ಲು|irlu|ರಾತ್ರಿ|Night, darkness
ಇಟ್ಟಿಗೆ|ittige|ಇಟ್ಟಿಗೆ|Brick
ಇಮೆ|ime|ರೆಪ್ಪೆ|Eyelash
ಇಜಿನು|ijinu|ದಾಲ್ಚಿನ್ನಿ|Cinnamon
ಇರೆ|ire|ಎಲೆ|Leaf
ಈಟಿ|iti|ಈಟಿ|A spear
ಉಪ್ಪು|uppu|ಉಪ್ಪು|Salt
ಉನ್ಪು|unpu|ಅನ್ನ|Cooked rice
ಉರು|uru|ಗ್ರಾಮ|Village
ಉಂಗಿಲೊ|ungilo|ಉಂಗುರ|A ring
ಉಂಡೆ|unde|ಉಂಡೆ|Round sweetmeat
ಉಲ್ಲಾಯೆ|ullaye|ಒಡೆಯ|Master, lord
ಉಮಿಲು|umilu|ಸೊಳ್ಳೆ|Mosquito, gnat
ಸೊಲ್ಮೆಲು|solmelu|ನಮಸ್ಕಾರ / ವಂದನೆ|Greetings / thank you`
  .split('\n')
  .map((l) => l.split('|') as [string, string, string, string]);

const W: [string, string][] = `ಬೀಗರು|ಪೊದ್ದೆರ್
ಚಿಲ್ಲರೆ|ಚುಂಗುಡಿ
ನಾಣ್ಯ|ಪಾವೊಲಿ
ಪಂಕ್ತಿ|ಪಂತೆ*
ಗೊರಸು|ಅಬಡ್
ಬೆಲೆ|ಬಿಲೆ*
ಮಡಿಲು|ಮಟ್ಟೆಲ್
ಬಿಡುವು|ಪುರ್ಸೊತ್ತು
ದಾರಿದ್ರ್ಯ|ಜದ್ರ
ಅಸ್ಥಿಪಂಜರ|ಎಲ್ಕೊಟೆ
ಗುಂಡಿ|ಗುರಿ
ಆಭರಣ|ಪದ್ದೈಯ್
ತಲೆಹೊಟ್ಟು|ತುಗಲ್
ಪ್ರಾರ್ಥನೆ|ಸುಗಿಪು
ಮೈದಾನ|ಅಡ್ಕ
ಎಳ್ಳು|ಎಡ್ಮೆ*
ಕಿವುಡ|ಕೆಪ್ಪೆ
ಮೂಕ|ಪೊಟ್ಟೆ
ಗೆರೆ|ಗೀಟ್
ಉಸಿರು|ಸುಯಿಲ್
ಗುಡಿಸಲು|ಗುಡ್ಚಿಲ್
ಸೇವೆ|ಚಾಕ್ರಿ
ಹಸಿ|ಪಜ್ಜಿ
ಮೂಲೆ|ಕೋಂಟು
ಗಾಳಿ|ಕಾತ್
ವಾಸನೆ|ಮೂರಿ
ಸೊಂಟ|ಒಕ್ಕ
ಕಂಬ|ಕಮ್ಮ
ಹುಲಿ|ಪಿಲಿ
ಕರು|ಕಂಜಿ
ದನ|ಪತ್ತ
ಮೂಗು|ಮೂಂಕು
ಕಿವಿ|ಕೆಬಿ
ಬೆರಳು|ಬಿರೆಲ್
ತೋಟ|ದೋಟ
ತಲೆ|ಮಂಡೆ
ಕೋಳಿ|ಕೋರಿ`
  .split('\n')
  .map((l) => l.split('|') as [string, string]);

const S: [string, string, string, Exclude<SentenceCategory, 'All'>][] = `ಅಪ್ಪೆ , ಅಮ್ಮ|ಅಮ್ಮ|Mother|Family
ಅಮ್ಮೆ , ಪೊಪ್ಪ|ಅಪ್ಪ|Father|Family
ಯಾನು ಕಲೆದ್ಪೋತೆ|ನಾನು ಕಳೆದುಹೋಗಿದ್ದೇನೆ|I am lost|Common
ಹೋಟೆಲ್ ಓಲು ಉಂಡು?|ಹೋಟೆಲ್ ಎಲ್ಲಿ ಇದೆ?|Where is the hotel?|Travel
ಬಸ್ ನಿಲ್ದಾಣ ಓಲ್ ಉಂಡು?|ಬಸ್ ನಿಲ್ದಾಣ ಎಲ್ಲಿ?|Where is the bus stop?|Travel
ಈರ್ ಸಹಾಯ ಮಲ್ಪುವರ್?|ನೀವು ಸಹಾಯ ಮಾಡುತ್ತೀರಾ?|Can you help me?|Common
ಎಂಕ್ ಸಹಾಯ ಮಲ್ಪುಲೆ.|ನನಗೆ ಸಹಾಯ ಮಾಡಿ|Help me|Common
ಯೆಂಕ್ ಅವು ಬೊಡ್ಚಿ .|ನನಗೆ ಅದು ಬೇಡ|I don’t want that|Common
ಎಂಕ್ ಉಂದು ಬೋಡು.|ನನಗೆ ಇದು ಬೇಕು|I want this|Common
ಉಂದೆಕ್ ಯೆತ್?|ಇದು ಎಷ್ಟು?|How much is this?|Common
ಎಂಕ್ ಉಂದು ಇಷ್ಟ ಆಂಡ್|ನನಗೆ ಇಷ್ಟವಾಗಿದೆ|I like this|Common
ಉಂದು ಎಡ್ಡೆ ಉಂಡು|ಇದು ಚೆನ್ನಾಗಿದೆ|This is good|Common
ಎಂಕು ಗೊತ್ತು ಇಜ್ಜಿ.|ನನಗೆ ಗೊತ್ತಿಲ್ಲ|I don’t know|Common
ಯೆಂಕ್ ಬಾಜೆಲ್ ಆತ್ಂಡ್|ನನಗೆ ದಾಹವಾಗಿದೆ|I am thirsty|Common
ಯೆಂಕ್ ಬಡವು ಆತ್ಂಡ್|ನನಗೆ ಹಸಿವಾಗಿದೆ|I am hungry|Common
ಎಂಕ್ ನೀರ್ ಬೋಡು.|ನನಗೆ ನೀರು ಬೇಕು|I need water|Common
ಉಂದು ಎಂಚಿನ?|ಇದು ಏನು?|What is this?|Common
ಇರ್ನ ಪುದರ್ ಯೆಂಚ ?|ನಿಮ್ಮ ಹೆಸರು ಏನು?|What is your name?|Common
ಯೀರ್ ಎಂಚ ಉಲ್ಲರ್?|ನೀವು ಹೇಗಿದ್ದೀರಾ?|How are you?|Common
ಯಾನ್ ಹುಷಾರ್ ಉಲ್ಲೆ.|ನಾನು ಚೆನ್ನಾಗಿದ್ದೇನೆ|I am fine|Common
ಸೊಲ್ಮೆಲು|ಧನ್ಯವಾದಗಳು|Thank you|Common`
  .split('\n')
  .map(
    (l) =>
      l.split('|') as [string, string, string, Exclude<SentenceCategory, 'All'>]
  );

// ============================================================================
// PHONETIC TYPING, MULTI-SCRIPT CONVERSION & ROMANIZATION
// ============================================================================
const VW: Record<string, string> = {
  aa: 'ಆ',
  ai: 'ಐ',
  au: 'ಔ',
  ee: 'ಏ',
  ii: 'ಈ',
  oo: 'ಓ',
  uu: 'ಊ',
  RRu: 'ಋ',
  a: 'ಅ',
  e: 'ಎ',
  i: 'ಇ',
  o: 'ಒ',
  u: 'ಉ',
  A: 'ಆ',
  E: 'ಏ',
  I: 'ಈ',
  O: 'ಓ',
  U: 'ಊ',
};
const VS: Record<string, string> = {
  aa: 'ಾ',
  ai: 'ೈ',
  au: 'ೌ',
  ee: 'ೇ',
  ii: 'ೀ',
  oo: 'ೋ',
  uu: 'ೂ',
  RRu: 'ೃ',
  a: '',
  e: 'ೆ',
  i: 'ಿ',
  o: 'ೊ',
  u: 'ು',
  A: 'ಾ',
  E: 'ೇ',
  I: 'ೀ',
  O: 'ೋ',
  U: 'ೂ',
};
const CS: Record<string, string> = {
  kh: 'ಖ',
  gh: 'ಘ',
  ch: 'ಛ',
  jh: 'ಝ',
  Th: 'ಠ',
  Dh: 'ಢ',
  th: 'ಥ',
  dh: 'ಧ',
  ph: 'ಫ',
  bh: 'ಭ',
  sh: 'ಶ',
  Sh: 'ಷ',
  k: 'ಕ',
  g: 'ಗ',
  c: 'ಚ',
  j: 'ಜ',
  T: 'ಟ',
  D: 'ಡ',
  N: 'ಣ',
  t: 'ತ',
  d: 'ದ',
  n: 'ನ',
  p: 'ಪ',
  b: 'ಬ',
  m: 'ಮ',
  y: 'ಯ',
  r: 'ರ',
  l: 'ಲ',
  v: 'ವ',
  w: 'ವ',
  s: 'ಸ',
  h: 'ಹ',
  L: 'ಳ',
  S: 'ಶ',
  f: 'ಫ',
  z: 'ಜ',
  '~g': 'ಙ',
  '~j': 'ಞ',
};

function pick(s: string, i: number, T: Record<string, string>): string | null {
  for (const n of [3, 2, 1]) {
    const k = s.substr(i, n);
    if (k.length === n && Object.prototype.hasOwnProperty.call(T, k)) return k;
  }
  return null;
}

function phon(s: string): string {
  let o = '';
  let pend = false;
  let i = 0;
  while (i < s.length) {
    let k = pick(s, i, CS);
    if (k) {
      o += CS[k] + '್';
      pend = true;
      i += k.length;
      continue;
    }
    k = pick(s, i, VW);
    if (k) {
      if (pend) {
        o = o.slice(0, -1) + VS[k];
      } else {
        o += VW[k];
      }
      pend = false;
      i += k.length;
      continue;
    }
    if (s[i] === 'M' || s[i] === 'H') {
      if (pend) o = o.slice(0, -1);
      o += s[i] === 'M' ? 'ಂ' : 'ಃ';
      pend = false;
      i++;
      continue;
    }
    o += s[i];
    pend = false;
    i++;
  }
  return o;
}

const RC: Record<string, string> = {
  ಕ: 'k',
  ಖ: 'kh',
  ಗ: 'g',
  ಘ: 'gh',
  ಙ: 'ng',
  ಚ: 'ch',
  ಛ: 'chh',
  ಜ: 'j',
  ಝ: 'jh',
  ಞ: 'ny',
  ಟ: 'T',
  ಠ: 'Th',
  ಡ: 'D',
  ಢ: 'Dh',
  ಣ: 'N',
  ತ: 't',
  ಥ: 'th',
  ದ: 'd',
  ಧ: 'dh',
  ನ: 'n',
  ಪ: 'p',
  ಫ: 'ph',
  ಬ: 'b',
  ಭ: 'bh',
  ಮ: 'm',
  ಯ: 'y',
  ರ: 'r',
  ಲ: 'l',
  ವ: 'v',
  ಶ: 'sh',
  ಷ: 'Sh',
  ಸ: 's',
  ಹ: 'h',
  ಳ: 'L',
};
const RV: Record<string, string> = {
  ಅ: 'a',
  ಆ: 'aa',
  ಇ: 'i',
  ಈ: 'ii',
  ಉ: 'u',
  ಊ: 'uu',
  ಋ: 'ru',
  ೠ: 'ruu',
  ಎ: 'e',
  ಏ: 'ee',
  ಐ: 'ai',
  ಒ: 'o',
  ಓ: 'oo',
  ಔ: 'au',
};
const RS: Record<string, string> = {
  'ಾ': 'aa',
  'ಿ': 'i',
  'ೀ': 'ii',
  'ು': 'u',
  'ೂ': 'uu',
  'ೃ': 'ru',
  'ೆ': 'e',
  'ೇ': 'ee',
  'ೈ': 'ai',
  'ೊ': 'o',
  'ೋ': 'oo',
  'ೌ': 'au',
  'ಂ': 'm',
  'ಃ': 'h',
};

function kn2rom(t: string): string {
  let o = '';
  const a = [...t];
  for (let i = 0; i < a.length; i++) {
    const c = a[i];
    if (RC[c]) {
      const n = a[i + 1];
      if (n === '್') {
        o += RC[c];
        i++;
      } else if (RS[n] && n !== 'ಂ' && n !== 'ಃ') {
        o += RC[c] + RS[n];
        i++;
      } else {
        o += RC[c] + 'a';
      }
    } else if (RV[c]) {
      o += RV[c];
    } else if (RS[c]) {
      o += RS[c];
    } else if (c !== '*' && c !== '್') {
      o += c;
    }
  }
  return o;
}

function rom(t: string): string {
  return t.replace(/[\u0C80-\u0CFF*]+/g, kn2rom);
}

const PG: Record<string, string[]> = {
  Numbers: [...'1234567890'],
  Vowels: [...'ಅಆಇಈಉಊಋೠಎಏಐಒಓಔ', 'ಎ*', 'ಏ*'],
  Signs: [...'ಾಿೀುೂೃೄೆೇೈೊೋೌಂಃ್', 'ೆ*', 'ೇ*'],
  Consonants: [
    ...'ಕಖಗಘಙಚಛಜಝಞಟಠಡಢಣತಥದಧನಪಫಬಭಮಯರಲವಶಷಸಹಳ',
  ],
  'Joined & digits': ['ಕ್ಷ', 'ತ್ರ', 'ಜ್ಞ', 'ಶ್ರೀ', 'ಓಂ', ...'೦೧೨೩೪೫೬೭೮೯'],
};

const PG_NAMES: Record<string, string> = {
  Numbers: 'Tulu numbers (ಅಂಕೆ) 1-9, 0',
  Vowels: 'Vowels (ಸ್ವರ)',
  Signs: 'Vowel signs & marks (ಮಾತ್ರೆ)',
  Consonants: 'Consonants (ವ್ಯಂಜನ)',
  'Joined & digits': 'Joined letters & digits',
};

const NM: Record<string, string> = {
  harshith: 'ಹರ್ಷಿತ್',
  harshit: 'ಹರ್ಷಿತ್',
  harsha: 'ಹರ್ಷ',
  harshitha: 'ಹರ್ಷಿತಾ',
  kaushik: 'ಕೌಶಿಕ್',
  arjun: 'ಅರ್ಜುನ್',
  ramesh: 'ರಮೇಶ್',
  suresh: 'ಸುರೇಶ್',
  ganesh: 'ಗಣೇಶ್',
  mahesh: 'ಮಹೇಶ್',
  rajesh: 'ರಾಜೇಶ್',
  naresh: 'ನರೇಶ್',
  dinesh: 'ದಿನೇಶ್',
  prashanth: 'ಪ್ರಶಾಂತ್',
  prashant: 'ಪ್ರಶಾಂತ್',
  pradeep: 'ಪ್ರದೀಪ್',
  sandeep: 'ಸಂದೀಪ್',
  deepak: 'ದೀಪಕ್',
  rakshith: 'ರಕ್ಷಿತ್',
  rakshit: 'ರಕ್ಷಿತ್',
  sumith: 'ಸುಮಿತ್',
  sumit: 'ಸುಮಿತ್',
  nithin: 'ನಿತಿನ್',
  nitin: 'ನಿತಿನ್',
  sachin: 'ಸಚಿನ್',
  manjunath: 'ಮಂಜುನಾಥ್',
  krishna: 'ಕೃಷ್ಣ',
  shiva: 'ಶಿವ',
  vishnu: 'ವಿಷ್ಣು',
  lakshmi: 'ಲಕ್ಷ್ಮಿ',
  divya: 'ದಿವ್ಯ',
  pooja: 'ಪೂಜಾ',
  priya: 'ಪ್ರಿಯಾ',
  ananya: 'ಅನನ್ಯ',
  shreya: 'ಶ್ರೇಯಾ',
  karthik: 'ಕಾರ್ತಿಕ್',
  kartik: 'ಕಾರ್ತಿಕ್',
  kishore: 'ಕಿಶೋರ್',
  naveen: 'ನವೀನ್',
  vinay: 'ವಿನಯ್',
  ajay: 'ಅಜಯ್',
  vijay: 'ವಿಜಯ್',
  ravi: 'ರವಿ',
  anil: 'ಅನಿಲ್',
  sunil: 'ಸುನಿಲ್',
  santosh: 'ಸಂತೋಷ್',
  sharath: 'ಶರತ್',
  suhas: 'ಸುಹಾಸ್',
  mangaluru: 'ಮಂಗಳೂರು',
  mangalore: 'ಮಂಗಳೂರು',
  udupi: 'ಉಡುಪಿ',
  bengaluru: 'ಬೆಂಗಳೂರು',
  bangalore: 'ಬೆಂಗಳೂರು',
  karnataka: 'ಕರ್ನಾಟಕ',
  india: 'ಭಾರತ',
  tulu: 'ತುಳು',
  tulunadu: 'ತುಳುನಾಡು',
  kannada: 'ಕನ್ನಡ',
  english: 'ಇಂಗ್ಲಿಷ್',
  rama: 'ರಾಮ',
  sita: 'ಸೀತಾ',
  radha: 'ರಾಧಾ',
  kiran: 'ಕಿರಣ್',
  pavan: 'ಪವನ್',
  ashok: 'ಅಶೋಕ್',
  anand: 'ಆನಂದ್',
  lokesh: 'ಲೋಕೇಶ್',
  yogesh: 'ಯೋಗೇಶ್',
  umesh: 'ಉಮೇಶ್',
  ganapathi: 'ಗಣಪತಿ',
  doctor: 'ಡಾಕ್ಟರ್',
  hospital: 'ಹಾಸ್ಪಿಟಲ್',
  computer: 'ಕಂಪ್ಯೂಟರ್',
  mobile: 'ಮೊಬೈಲ್',
  phone: 'ಫೋನ್',
  water: 'ವಾಟರ್',
  mother: 'ಮದರ್',
  father: 'ಫಾದರ್',
  school: 'ಸ್ಕೂಲ್',
  hotel: 'ಹೋಟೆಲ್',
  bus: 'ಬಸ್',
  car: 'ಕಾರ್',
  train: 'ಟ್ರೈನ್',
  office: 'ಆಫೀಸ್',
  market: 'ಮಾರ್ಕೆಟ್',
  college: 'ಕಾಲೇಜ್',
  bank: 'ಬ್ಯಾಂಕ್',
  ticket: 'ಟಿಕೆಟ್',
  tea: 'ಟೀ',
  coffee: 'ಕಾಫಿ',
  hello: 'ಹಲೋ',
  sorry: 'ಸಾರಿ',
  please: 'ಪ್ಲೀಸ್',
  email: 'ಇಮೇಲ್',
  internet: 'ಇಂಟರ್ನೆಟ್',
  app: 'ಆ್ಯಪ್',
  thanks: 'ಥ್ಯಾಂಕ್ಸ್',
};

const EK: Record<string, string[]> = {
  water: ['ನೀರು'],
  mother: ['ಅಮ್ಮ'],
  father: ['ಅಪ್ಪ'],
  house: ['ಮನೆ'],
  home: ['ಮನೆ'],
  food: ['ಊಟ'],
  rice: ['ಅಕ್ಕಿ', 'ಅನ್ನ'],
  school: ['ಶಾಲೆ'],
  book: ['ಪುಸ್ತಕ'],
  friend: ['ಸ್ನೇಹಿತ'],
  love: ['ಪ್ರೀತಿ'],
  name: ['ಹೆಸರು'],
  hello: ['ನಮಸ್ಕಾರ'],
  thanks: ['ಧನ್ಯವಾದ'],
  thank: ['ಧನ್ಯವಾದ'],
  welcome: ['ಸ್ವಾಗತ'],
  good: ['ಒಳ್ಳೆಯ'],
  village: ['ಹಳ್ಳಿ'],
  city: ['ನಗರ'],
  sun: ['ಸೂರ್ಯ'],
  moon: ['ಚಂದ್ರ'],
  tree: ['ಮರ'],
  river: ['ನದಿ'],
  sea: ['ಸಮುದ್ರ'],
  day: ['ದಿನ'],
  night: ['ರಾತ್ರಿ'],
  morning: ['ಬೆಳಗ್ಗೆ'],
  evening: ['ಸಂಜೆ'],
  fire: ['ಬೆಂಕಿ'],
  milk: ['ಹಾಲು'],
  fish: ['ಮೀನು'],
  temple: ['ದೇವಸ್ಥಾನ'],
  god: ['ದೇವರು'],
  king: ['ರಾಜ'],
  queen: ['ರಾಣಿ'],
  child: ['ಮಗು'],
  boy: ['ಹುಡುಗ'],
  girl: ['ಹುಡುಗಿ'],
  woman: ['ಹೆಣ್ಣು', 'ಮಹಿಳೆ'],
  one: ['ಒಂದು'],
  two: ['ಎರಡು'],
  three: ['ಮೂರು'],
  four: ['ನಾಲ್ಕು'],
  five: ['ಐದು'],
  six: ['ಆರು'],
  seven: ['ಏಳು'],
  eight: ['ಎಂಟು'],
  nine: ['ಒಂಬತ್ತು'],
  ten: ['ಹತ್ತು'],
  yes: ['ಹೌದು'],
  no: ['ಇಲ್ಲ'],
  beautiful: ['ಸುಂದರ'],
  big: ['ದೊಡ್ಡ'],
  small: ['ಚಿಕ್ಕ'],
  new: ['ಹೊಸ'],
  old: ['ಹಳೆಯ'],
  money: ['ಹಣ'],
  time: ['ಸಮಯ'],
  life: ['ಜೀವನ'],
  world: ['ಪ್ರಪಂಚ'],
  language: ['ಭಾಷೆ'],
  sister: ['ಅಕ್ಕ', 'ತಂಗಿ'],
  brother: ['ಅಣ್ಣ', 'ತಮ್ಮ'],
  wife: ['ಹೆಂಡತಿ'],
  husband: ['ಗಂಡ'],
  teacher: ['ಶಿಕ್ಷಕ'],
  student: ['ವಿದ್ಯಾರ್ಥಿ'],
  doctor: ['ವೈದ್ಯ'],
};

const EM: Record<string, string[]> = {};
(() => {
  const add = (e: string, k: string) => {
    const clean = e
      .toLowerCase()
      .replace(/^(a|an|the|to) /, '')
      .trim();
    if (!/^[a-z' -]+$/.test(clean) || !k) return;
    if (!EM[clean]) EM[clean] = [];
    if (!EM[clean].includes(k)) EM[clean].push(k);
  };
  D.forEach((d) => {
    const ks = d[2]
      .split(/[\/,]/)
      .map((x) => x.trim())
      .filter((x) => /^[\u0C80-\u0CFF ]+$/.test(x));
    if (!ks.length || ks.length > 3) return;
    d[3].split(/[,\/;]/).forEach((e) => ks.forEach((k) => add(e, k)));
  });
  S.forEach((s) => {
    s[2].split(/[,\/;]/).forEach((e) => add(e, (s[1] || '').trim()));
  });
})();

const TK =
  /chh|ksh|sh|th|dh|ch|kh|gh|jh|ph|bh|ck|aa|ee|ii|oo|uu|ai|au|[a-z]/g;

interface TrlOptions {
  sh?: string;
  th?: string;
  t?: string;
  d?: string;
  dh?: string;
  la?: number;
  fa?: number;
  le?: number;
}

function trl(w: string, o: TrlOptions = {}): string {
  const tk = w.toLowerCase().match(TK) || [];
  let la = false;
  const out: string[] = [];
  tk.forEach((t, i) => {
    const p = tk[i - 1];
    const n = tk[i + 1];
    let r = t;
    if (t === 'sh') {
      const ret = o.sh ? o.sh === 'ಷ' : p === 'r' || Boolean(n && /^[ntm]/.test(n));
      r = ret ? 'Sh' : 'sh';
    } else if (t === 'th') r = o.th === 'ಥ' ? 'th' : 't';
    else if (t === 't') r = o.t === 'ಟ' ? 'T' : 't';
    else if (t === 'd') r = o.d === 'ಡ' ? 'D' : 'd';
    else if (t === 'dh') r = o.dh === 'ದ' ? 'd' : 'dh';
    else if (t === 'chh') r = 'ch';
    else if (t === 'ch') r = 'c';
    else if (t === 'ck') r = 'k';
    else if (t === 'ksh') r = 'kSh';
    else if (t === 'c') r = n && /^[eiy]/.test(n) ? 's' : 'k';
    else if (t === 'e' && n === 'sh') r = 'ee';
    else if (t === 'x') r = 'kSh';
    else if (t === 'q') r = 'k';
    else if (t === 'a' && o.la && !la) {
      la = true;
      r = 'aa';
    } else if ((t === 'e' || t === 'o') && o.le) r = t + t;
    out.push(r);
  });
  let s = out.join('');
  if (o.fa && /a$/.test(s) && !/aa$/.test(s)) s = s.replace(/a$/, 'aa');
  return phon(s);
}

const candsEnCache = new Map<string, [string, string][]>();
function candsEn(w: string, pm: boolean): [string, string][] {
  const lw = w.toLowerCase();
  const key = lw + (pm ? '1' : '0');
  if (candsEnCache.has(key)) return candsEnCache.get(key)!;
  const out: [string, string][] = [];
  const add = (k: string, t: string) => {
    if (k && !out.some((o) => o[0] === k)) out.push([k, t]);
  };
  const mean = [...(EK[lw] || []), ...(EM[lw] || [])];
  if (pm) mean.forEach((k) => add(k, 'meaning'));
  if (NM[lw]) add(NM[lw], 'common spelling');
  add(trl(lw), 'sounds like');
  mean.forEach((k) => add(k, 'meaning'));
  const tk: string[] = lw.match(TK) ?? [];
  const has = (t: string) => tk.includes(t);
  const V: TrlOptions[] = [];
  if (has('sh')) V.push({ sh: 'ಷ' }, { sh: 'ಶ' });
  if (has('th')) V.push({ th: 'ಥ' });
  if (has('t')) V.push({ t: 'ಟ' });
  if (has('d')) V.push({ d: 'ಡ' });
  if (has('t') || has('d')) V.push({ t: 'ಟ', d: 'ಡ' });
  if (has('dh')) V.push({ dh: 'ದ' });
  if (/a$/.test(lw) && !/aa$/.test(lw)) V.push({ fa: 1 });
  const fa = tk.indexOf('a');
  if (fa >= 0 && fa < tk.length - 1) V.push({ la: 1 });
  if (has('e') || has('o')) V.push({ le: 1 });
  V.forEach((o) => add(trl(lw, o), 'other spelling'));
  const r = out.slice(0, 8);
  candsEnCache.set(key, r);
  return r;
}

const WRE =
  /[A-Za-z]+|[\u0900-\u0C7F\u0D00-\u0D7F][\u0900-\u0C7F\u0D00-\u0D7F\u200c\u200d]*/g;

function scr(w: string): ScriptKey {
  const c = w.codePointAt(0) || 0;
  if (c < 0x0900) return 'latin';
  if (c < 0x0980) return 'dev';
  if (c < 0x0a00) return 'ben';
  if (c < 0x0a80) return 'gur';
  if (c < 0x0b00) return 'guj';
  if (c < 0x0b80) return 'odi';
  if (c < 0x0c00) return 'tam';
  if (c < 0x0c80) return 'tel';
  return 'mal';
}

const SCN: Record<ScriptKey, string> = {
  latin: 'Latin letters',
  dev: 'Devanagari',
  ben: 'Bengali script',
  gur: 'Gurmukhi',
  guj: 'Gujarati script',
  odi: 'Odia script',
  tam: 'Tamil script',
  tel: 'Telugu script',
  mal: 'Malayalam script',
};

const LGO: Record<ScriptKey, [string, string][]> = {
  latin: [
    ['en', 'English'],
    ['rm', 'Roman Kannada / Tulu / Hindi'],
  ],
  dev: [
    ['hi', 'Hindi'],
    ['mr', 'Marathi'],
    ['sa', 'Sanskrit'],
    ['ne', 'Nepali'],
  ],
  ben: [
    ['bn', 'Bengali'],
    ['as', 'Assamese'],
  ],
  gur: [['pa', 'Punjabi']],
  guj: [['gu', 'Gujarati']],
  odi: [['or', 'Odia']],
  tam: [['ta', 'Tamil']],
  tel: [['te', 'Telugu']],
  mal: [['ml', 'Malayalam']],
};

const RMK = new Set(
  'namaste namaskara namaskaram hegiddira hegide yenu enu alla illa beku ide idu adu nanna ninna nimma namma mane ooru uru kya hai nahi nahin mera meri tum aap hum kaise accha acha bahut kaun kyun naanu neenu avanu avalu banni tuluva ullar'.split(
    ' '
  )
);
const ENS = new Set(
  'the is are was and of to in for with that this you your it on be have not from but or my we they will can'.split(
    ' '
  )
);

const BS: Record<Exclude<ScriptKey, 'latin'>, number> = {
  dev: 0x0900,
  ben: 0x0980,
  gur: 0x0a00,
  guj: 0x0a80,
  odi: 0x0b00,
  tam: 0x0b80,
  tel: 0x0c00,
  mal: 0x0d00,
};

const SPX: Record<number, string> = {
  0x0ba9: 'ನ',
  0x0bb1: 'ರ',
  0x0bb4: 'ಳ',
  0x0d34: 'ಳ',
  0x0d31: 'ರ',
  0x0c31: 'ರ',
  0x0b5c: 'ಡ',
  0x0b5d: 'ಢ',
  0x0b5f: 'ಯ',
  0x0b71: 'ವ',
  0x09dc: 'ಡ',
  0x09dd: 'ಢ',
  0x09df: 'ಯ',
  0x0958: 'ಕ',
  0x0959: 'ಖ',
  0x095a: 'ಗ',
  0x095b: 'ಜ',
  0x095c: 'ಡ',
  0x095d: 'ಢ',
  0x095e: 'ಫ',
  0x095f: 'ಯ',
  0x0950: 'ಓಂ',
  0x0901: 'ಂ',
  0x0981: 'ಂ',
  0x0a70: 'ಂ',
  0x0a71: '',
  0x0964: '.',
  0x0965: '.',
  0x0911: 'ಒ',
  0x090d: 'ಎ',
  0x0945: 'ೆ',
  0x0949: 'ೊ',
  0x09ce: 'ತ್',
  0x0d7a: 'ಣ್',
  0x0d7b: 'ನ್',
  0x0d7c: 'ರ್',
  0x0d7d: 'ಲ್',
  0x0d7e: 'ಳ್',
  0x0d7f: 'ಕ್',
  0x0a91: 'ಒ',
  0x0ac9: 'ೊ',
  0x0a8d: 'ಎ',
  0x0ac5: 'ೆ',
  0x0a59: 'ಖ',
  0x0a5a: 'ಗ',
  0x0a5b: 'ಜ',
  0x0a5e: 'ಫ',
};
const TST: Record<string, string> = {
  க: 'ಗ',
  ச: 'ಜ',
  ட: 'ಡ',
  த: 'ದ',
  ப: 'ಬ',
};

function i2k(s: string, o: { tv?: 'in' | 'all' } = {}): string {
  let r = '';
  const a = [...s];
  a.forEach((ch, i) => {
    const c = ch.codePointAt(0) || 0;
    if (c === 0x200c || c === 0x200d) return;
    if (SPX[c] !== undefined) {
      r += SPX[c];
      return;
    }
    let sc: Exclude<ScriptKey, 'latin'> | null = null;
    for (const k of Object.keys(BS) as Exclude<ScriptKey, 'latin'>[]) {
      if (c >= BS[k] && c < BS[k] + 0x80) {
        sc = k;
        break;
      }
    }
    if (!sc) {
      r += ch;
      return;
    }
    const d = c - BS[sc];
    if (d >= 0x66 && d <= 0x6f) {
      r += String(d - 0x66);
      return;
    }
    if (sc === 'tam' && o.tv && TST[ch]) {
      const pv = a[i - 1];
      const vo =
        o.tv === 'all' ||
        (i > 0 && !(pv === '்' && !'ஙஞணநமன'.includes(a[i - 2] || '')));
      r += vo ? TST[ch] : String.fromCodePoint(c + 0x100);
      return;
    }
    r += String.fromCodePoint(0x0c80 + d);
  });
  return r;
}

function indicC(w: string, sc: Exclude<ScriptKey, 'latin'>, lg: string): [string, string][] {
  const out: [string, string][] = [];
  const add = (k: string, t: string) => {
    if (k && !out.some((o) => o[0] === k)) out.push([k, t]);
  };
  add(i2k(w), 'same sounds');
  if (
    sc === 'dev' &&
    (lg === 'hi' || lg === 'ne') &&
    /[\u0915-\u0939\u0958-\u095F]$/.test(w)
  ) {
    add(i2k(w) + '್', 'Hindi sound (no final a)');
  }
  if (sc === 'tam') {
    add(i2k(w, { tv: 'in' }), 'voiced inside word');
    add(i2k(w, { tv: 'all' }), 'all voiced');
  }
  return out;
}

function romanC(w: string): [string, string][] {
  const out: [string, string][] = [];
  const add = (k: string | undefined, t: string) => {
    if (k && !out.some((o) => o[0] === k)) out.push([k, t]);
  };
  const lw = w.toLowerCase();
  add(NM[lw], 'common spelling');
  add(phon(w), 'as typed');
  add(phon(lw), 'lowercase sounds');
  if (/a$/.test(lw) && !/aa$/.test(lw)) {
    add(phon(lw.replace(/a$/, 'aa')), 'long final a');
  }
  const ai = [...lw.matchAll(/a/g)].map((m) => m.index ?? 0);
  if (ai.length > 1) {
    const idx = ai[ai.length - 2];
    add(phon(lw.slice(0, idx) + 'aa' + lw.slice(idx + 1)), 'long a before last');
  }
  const lo = lw.replace(/e/g, 'ee').replace(/o/g, 'oo');
  add(phon(lo), 'long e / o');
  if (/a$/.test(lw) && !/aa$/.test(lw)) {
    add(phon(lo.replace(/a$/, 'aa')), 'long e / o / final a');
  }
  add(trl(lw), 'English sounds');
  return out;
}

const L_HL = [
  ...'ಅಆಇಈಉಊಋಎಏಐಒಓಔಕಖಗಘಙಚಛಜಝಞಟಠಡಢಣತಥದಧನಪಫಬಭಮಯರಲವಶಷಸಹಳ',
];
const L_IV = [0, 1, 3, 7, 16, 35];

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
  const [preferMeaning, setPreferMeaning] = useState<boolean>(() =>
    safeGetJson<string | number>('tp_pm', 0) === '1' || safeGetJson<number>('tp_pm', 0) === 1
  );
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

  const getCands = useCallback(
    (w: string): [string, string][] => {
      const sc = scr(w);
      if (sc !== 'latin') {
        return indicC(w, sc, effLang(sc));
      }
      if (effLang('latin') === 'rm') return romanC(w);
      return candsEn(w, preferMeaning);
    },
    [effLang, preferMeaning]
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

  const toKannadaText = useCallback(
    (raw: string): string =>
      convertOther
        ? raw.replace(/[^\u0C80-\u0CFF]+/g, translitSegment)
        : raw,
    [convertOther, translitSegment]
  );

  const kannadaResolved = useMemo(() => toKannadaText(text), [text, toKannadaText]);
  const romanPreview = useMemo(() => rom(kannadaResolved), [kannadaResolved]);
  const tuluCodeFull = useMemo(() => kn2tu(kannadaResolved), [kannadaResolved]);

  // Output display chunks (preserving non-Kannada styling when Other languages -> Tulu is off)
  const outputChunks = useMemo(() => {
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
  }, [convertOther, text, translitSegment]);

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
                <span>Special Tools</span>
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
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-display font-extrabold uppercase tracking-wider text-[#2F3E4E] dark:text-slate-200">
                  Tulu Lipi Preview (Baravu)
                </span>
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
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  aria-pressed={preferMeaning}
                  onClick={() => {
                    const next = !preferMeaning;
                    setPreferMeaning(next);
                    safeSetJson('tp_pm', next ? '1' : '0');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border-[1.5px] cursor-pointer ${
                    preferMeaning
                      ? 'bg-[#F9C80E] text-[#2F3E4E] border-[#2F3E4E]'
                      : 'bg-white dark:bg-[#0B1120] text-[#475569] dark:text-slate-300 border-[#2F3E4E]/30 dark:border-slate-700'
                  }`}
                >
                  Translate known words: {preferMeaning ? 'ON' : 'OFF'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOverrides({});
                    setLangChoice({});
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
                ? '1) Confirm the detected language. 2) Tap the right Kannada spelling for each word or type your own and press Enter.'
                : 'Type or paste text in any language (e.g. Harshith, राम, தமிழ், తెలుగు, മലയാളം) to review & confirm word spellings.'}
            </p>

            {convertOther && (
              <div className="space-y-2">
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
                          {overrides[k] ? '✓ chosen' : 'check'}
                        </span>
                      )}
                      {list.map(([kk, tag]) => (
                        <button
                          key={`${kk}-${tag}`}
                          type="button"
                          aria-pressed={kk === cur}
                          onClick={() => {
                            const next = { ...overrides, [k]: kk };
                            setOverrides(next);
                            safeSetJson('tp_ov', next);
                          }}
                          className={`inline-flex flex-col items-start px-3 py-1 rounded-xl border text-left transition cursor-pointer ${
                            kk === cur
                              ? 'bg-[#F9C80E] text-[#2F3E4E] border-[#2F3E4E]'
                              : 'bg-white dark:bg-[#0B1120] text-[#2F3E4E] dark:text-slate-200 border-[#2F3E4E]/25 dark:border-slate-700 hover:bg-[#FEF2C8] dark:hover:bg-slate-800'
                          }`}
                        >
                          <span className="text-sm font-semibold">{kk}</span>
                          <span className="tulu-lipi-font text-lg leading-tight">
                            {kn2tu(kk)}
                          </span>
                          <span className="text-[10px] opacity-75">{tag}</span>
                        </button>
                      ))}
                      <input
                        type="text"
                        value={customInputs[k] || ''}
                        onChange={(e) =>
                          setCustomInputs((prev) => ({ ...prev, [k]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const val = (customInputs[k] || '').trim();
                            if (val) {
                              const next = { ...overrides, [k]: val };
                              setOverrides(next);
                              safeSetJson('tp_ov', next);
                              setCustomInputs((prev) => ({ ...prev, [k]: '' }));
                            }
                          }
                        }}
                        placeholder="Other spelling…"
                        aria-label={`Custom Kannada spelling for ${w}`}
                        className="w-32 px-2.5 py-1.5 rounded-xl border border-[#2F3E4E]/30 dark:border-slate-600 bg-white dark:bg-[#0B1120] text-xs text-[#2F3E4E] dark:text-slate-100"
                      />
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
