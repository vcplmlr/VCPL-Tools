// ============================================================================
// TULUSIRI PRO ENGINE:
// - BARAVU (TULU LIPI) <-> KANNADA CONVERSION
// - MULTILINGUAL (ENGLISH / ROMAN / INDIC) -> KANNADA -> TULU TRANSLITERATION
// - CURATED ENGLISH -> KANNADA / TULU DICTIONARY & MULTI-SUGGESTION ENGINE
// ============================================================================

export type StudioTab =
  | 'write'
  | 'chart'
  | 'decode'
  | 'dict'
  | 'words'
  | 'sent'
  | 'learn'
  | 'quiz';

export type InputMode = 'en' | 'tu';
export type TranslationPreference = 'gt' | 'sound' | 'kn' | 'tu';
export type ScriptKey =
  | 'latin'
  | 'dev'
  | 'ben'
  | 'gur'
  | 'guj'
  | 'odi'
  | 'tam'
  | 'tel'
  | 'mal';

export type SentenceCategory = 'All' | 'Common' | 'Family' | 'Travel';
export type QuizMode = 'w' | 'd';

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

export function kn2tu(t: string): string {
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

export function tu2kn(t: string): string {
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
export const D: [string, string, string, string][] = `ಅಬಡೆ|abade|ಹುರುಳಿ ಕಾಯಿ|A kind of bean
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
ಊರು|ooru|ಗ್ರಾಮ / ಊರು|Village, hometown
ಉಂಗಿಲೊ|ungilo|ಉಂಗುರ|A ring
ಉಂಡೆ|unde|ಉಂಡೆ|Round sweetmeat
ಉಲ್ಲಾಯೆ|ullaye|ಒಡೆಯ|Master, lord
ಉಮಿಲು|umilu|ಸೊಳ್ಳೆ|Mosquito, gnat
ಸೊಲ್ಮೆಲು|solmelu|ನಮಸ್ಕಾರ / ವಂದನೆ|Greetings / thank you`
  .split('\n')
  .map((l) => l.split('|') as [string, string, string, string]);

export const W: [string, string][] = `ಬೀಗರು|ಪೊದ್ದೆರ್
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

export const S: [string, string, string, Exclude<SentenceCategory, 'All'>][] = `ಅಪ್ಪೆ, ಪೊಪ್ಪ|ಅಮ್ಮ, ಅಪ್ಪ|Mother|Family
ಅಮ್ಮೆ, ಅಪ್ಪೆ|ಅಪ್ಪ, ಅಮ್ಮ|Father|Family
ಯಾನ್ ಕಲೆದ್ ಪೋತೆ|ನಾನು ಕಳೆದುಹೋಗಿದ್ದೇನೆ|I am lost|Common
ಹೋಟೆಲ್ ಓಲು ಉಂಡು?|ಹೋಟೆಲ್ ಎಲ್ಲಿ ಇದೆ?|Where is the hotel?|Travel
ಬಸ್ ನಿಲ್ದಾಣ ಓಲ್ ಉಂಡು?|ಬಸ್ ನಿಲ್ದಾಣ ಎಲ್ಲಿ?|Where is the bus stop?|Travel
ಈರ್ ಸಹಾಯ ಮಲ್ಪುವರ್?|ನೀವು ಸಹಾಯ ಮಾಡುತ್ತೀರಾ?|Can you help me?|Common
ಎಂಕ್ ಸಹಾಯ ಮಲ್ಪುಲೆ.|ನನಗೆ ಸಹಾಯ ಮಾಡಿ|Help me|Common
ಯೆಂಕ್ ಅವು ಬೊಡ್ಚಿ.|ನನಗೆ ಅದು ಬೇಡ|I don’t want that|Common
ಎಂಕ್ ಉಂದು ಬೋಡು.|ನನಗೆ ಇದು ಬೇಕು|I want this|Common
ಉಂದೆಕ್ ಯೆತ್?|ಇದು ಎಷ್ಟು?|How much is this?|Common
ಎಂಕ್ ಉಂದು ಇಷ್ಟ ಆಂಡ್|ನನಗೆ ಇದು ಇಷ್ಟವಾಗಿದೆ|I like this|Common
ಉಂದು ಎಡ್ಡೆ ಉಂಡು|ಇದು ಚೆನ್ನಾಗಿದೆ|This is good|Common
ಎಂಕ್ ಗೊತ್ತು ಇಜ್ಜಿ.|ನನಗೆ ಗೊತ್ತಿಲ್ಲ|I don’t know|Common
ಯೆಂಕ್ ಬಾಜೆಲ್ ಆತ್ಂಡ್|ನನಗೆ ದಾಹವಾಗಿದೆ|I am thirsty|Common
ಯೆಂಕ್ ಬಡವು ಆತ್ಂಡ್|ನನಗೆ ಹಸಿವಾಗಿದೆ|I am hungry|Common
ಎಂಕ್ ನೀರ್ ಬೋಡು.|ನನಗೆ ನೀರು ಬೇಕು|I need water|Common
ಉಂದು ಎಂಚಿನ?|ಇದು ಏನು?|What is this?|Common
ಇರ್ನ ಪುದರ್ ದಾದ?|ನಿಮ್ಮ ಹೆಸರು ಏನು?|What is your name?|Common
ಯೀರ್ ಎಂಚ ಉಲ್ಲರ್?|ನೀವು ಹೇಗಿದ್ದೀರಾ?|How are you?|Common
ಯಾನ್ ಹುಷಾರ್ ಉಲ್ಲೆ.|ನಾನು ಚೆನ್ನಾಗಿದ್ದೇನೆ|I am fine|Common
ಸೊಲ್ಮೆಲು|ಧನ್ಯವಾದಗಳು|Thank you|Common`
  .split('\n')
  .map(
    (l) =>
      l.split('|') as [string, string, string, Exclude<SentenceCategory, 'All'>]
  );

// ============================================================================
// PHONETIC TYPING (NUDI-STYLE), ROMANIZATION & KANNADA HELPERS
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

export function phon(s: string): string {
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

export function kn2rom(t: string): string {
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

export function rom(t: string): string {
  return t.replace(/[\u0C80-\u0CFF*]+/g, kn2rom);
}

export const PG: Record<string, string[]> = {
  Numbers: [...'1234567890'],
  Vowels: [...'ಅಆಇಈಉಊಋೠಎಏಐಒಓಔ', 'ಎ*', 'ಏ*'],
  Signs: [...'ಾಿೀುೂೃೄೆೇೈೊೋೌಂಃ್', 'ೆ*', 'ೇ*'],
  Consonants: [
    ...'ಕಖಗಘಙಚಛಜಝಞಟಠಡಢಣತಥದಧನಪಫಬಭಮಯರಲವಶಷಸಹಳ',
  ],
  'Joined & digits': ['ಕ್ಷ', 'ತ್ರ', 'ಜ್ಞ', 'ಶ್ರೀ', 'ಓಂ', ...'೦೧೨೩೪೫೬೭೮೯'],
};

export const PG_NAMES: Record<string, string> = {
  Numbers: 'Tulu numbers (ಅಂಕೆ) 1-9, 0',
  Vowels: 'Vowels (ಸ್ವರ)',
  Signs: 'Vowel signs & marks (ಮಾತ್ರೆ)',
  Consonants: 'Consonants (ವ್ಯಂಜನ)',
  'Joined & digits': 'Joined letters & digits',
};

// ============================================================================
// CURATED LEXICON: COMMON WORDS / NAMES (NM), ENGLISH->KANNADA (EK), ENGLISH->TULU (ETU)
// ============================================================================
export const NM: Record<string, string> = {
  // Fruits & everyday foods (including cherry -> ಚೆರ್ರಿ!)
  cherry: 'ಚೆರ್ರಿ',
  cherries: 'ಚೆರ್ರೀಸ್',
  berry: 'ಬೆರ್ರಿ',
  berries: 'ಬೆರ್ರೀಸ್',
  strawberry: 'ಸ್ಟ್ರಾಬೆರಿ',
  blueberry: 'ಬ್ಲೂಬೆರಿ',
  raspberry: 'ರಾಸ್ಪ್‌ಬೆರಿ',
  blackberry: 'ಬ್ಲ್ಯಾಕ್‌ಬೆರಿ',
  cranberry: 'ಕ್ರ್ಯಾನ್‌ಬೆರಿ',
  apple: 'ಆಪಲ್',
  mango: 'ಮ್ಯಾಂಗೋ',
  banana: 'ಬನಾನಾ',
  orange: 'ಆರೆಂಜ್',
  grape: 'ಗ್ರೇಪ್',
  grapes: 'ಗ್ರೇಪ್ಸ್',
  pineapple: 'ಪೈನಾಪಲ್',
  watermelon: 'ವಾಟರ್‌ಮೆಲನ್',
  papaya: 'ಪಪ್ಪಾಯ',
  guava: 'ಪೇರಳೆ',
  lemon: 'ಲೆಮನ್',
  coconut: 'ತೆಂಗಿನಕಾಯಿ',
  jackfruit: 'ಹಲಸು',
  cashew: 'ಗೋಡಂಬಿ',
  pomegranate: 'ದಾಳಿಂಬೆ',
  kiwi: 'ಕಿವಿ',
  peach: 'ಪೀಚ್',
  pear: 'ಪಿಯರ್',
  plum: 'ಪ್ಲಮ್',
  guavafruit: 'ಪೇರಳೆ',
  tomato: 'ಟೊಮೆಟೊ',
  potato: 'ಆಲೂಗಡ್ಡೆ',
  onion: 'ಈರುಳ್ಳಿ',
  garlic: 'ಬೆಳ್ಳುಳ್ಳಿ',
  ginger: 'ಶುಂಠಿ',
  chilli: 'ಮೆಣಸು',
  chili: 'ಮೆಣಸು',
  carrot: 'ಕ್ಯಾರೆಟ್',
  cake: 'ಕೇಕ್',
  bread: 'ಬ್ರೆಡ್',
  butter: 'ಬಟರ್',
  cheese: 'ಚೀಸ್',
  cream: 'ಕ್ರೀಮ್',
  ice: 'ಐಸ್',
  icecream: 'ಐಸ್‌ಕ್ರೀಮ್',
  chocolate: 'ಚಾಕೋಲೇಟ್',
  sugar: 'ಶುಗರ್',
  sweet: 'ಸ್ವೀಟ್',
  pizza: 'ಪಿಜ್ಜಾ',
  burger: 'ಬರ್ಗರ್',
  biryani: 'ಬಿರಿಯಾನಿ',
  dosa: 'ದೋಸೆ',
  idli: 'ಇಡ್ಲಿ',
  vada: 'ವಡೆ',
  sambar: 'ಸಾಂಬಾರ್',
  chutney: 'ಚಟ್ನಿ',
  tea: 'ಟೀ',
  coffee: 'ಕಾಫಿ',
  milk: 'ಮಿಲ್ಕ್',
  juice: 'ಜ್ಯೂಸ್',

  // Names & Coastal / Indian Places
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
  mangaluru: 'ಮಂಗಳೂರು',
  mangalore: 'ಮಂಗಳೂರು',
  kudla: 'ಕುಡ್ಲ',
  udupi: 'ಉಡುಪಿ',
  kasaragod: 'ಕಾಸರಗೋಡು',
  puttur: 'ಪುತ್ತೂರು',
  bantwal: 'ಬಂಟ್ವಾಳ',
  sullia: 'ಸುಳ್ಯ',
  kundapura: 'ಕುಂದಾಪುರ',
  karkala: 'ಕಾರ್ಕಳ',
  moodabidri: 'ಮೂಡಬಿದ್ರೆ',
  bengaluru: 'ಬೆಂಗಳೂರು',
  bangalore: 'ಬೆಂಗಳೂರು',
  mysuru: 'ಮೈಸೂರು',
  mysore: 'ಮೈಸೂರು',
  karnataka: 'ಕರ್ನಾಟಕ',
  kerala: 'ಕೇರಳ',
  india: 'ಭಾರತ',
  bharat: 'ಭಾರತ',
  tulu: 'ತುಳು',
  tulunadu: 'ತುಳುನಾಡು',
  tulusiri: 'ತುಳುಸಿರಿ',
  solmelu: 'ಸೊಲ್ಮೆಲು',
  namaskara: 'ನಮಸ್ಕಾರ',
  namaste: 'ನಮಸ್ತೆ',
  yencha: 'ಎಂಚ',
  encha: 'ಎಂಚ',
  bodu: 'ಬೋಡು',
  bodchi: 'ಬೊಡ್ಚಿ',
  appe: 'ಅಪ್ಪೆ',
  amme: 'ಅಮ್ಮೆ',
  kukku: 'ಕುಕ್ಕು',
  neer: 'ನೀರ್',
  illu: 'ಇಲ್ಲು',
  pudar: 'ಪುದರ್',
  edde: 'ಎಡ್ಡೆ',
  moke: 'ಮೋಕೆ',
  porlu: 'ಪೊರ್ಲು',
  kannada: 'ಕನ್ನಡ',
  english: 'ಇಂಗ್ಲಿಷ್',
  hindi: 'ಹಿಂದಿ',
  tamil: 'ತಮಿಳು',
  telugu: 'ತೆಲುಗು',
  malayalam: 'ಮಲಯಾಳಂ',

  // Common everyday English nouns & loanwords
  doctor: 'ಡಾಕ್ಟರ್',
  hospital: 'ಹಾಸ್ಪಿಟಲ್',
  computer: 'ಕಂಪ್ಯೂಟರ್',
  laptop: 'ಲ್ಯಾಪ್‌ಟಾಪ್',
  mobile: 'ಮೊಬೈಲ್',
  phone: 'ಫೋನ್',
  water: 'ವಾಟರ್',
  mother: 'ಮದರ್',
  father: 'ಫಾದರ್',
  family: 'ಫ್ಯಾಮಿಲಿ',
  friend: 'ಫ್ರೆಂಡ್',
  school: 'ಸ್ಕೂಲ್',
  hotel: 'ಹೋಟೆಲ್',
  bus: 'ಬಸ್',
  car: 'ಕಾರ್',
  bike: 'ಬೈಕ್',
  auto: 'ಆಟೋ',
  train: 'ಟ್ರೈನ್',
  station: 'ಸ್ಟೇಶನ್',
  airport: 'ಏರ್‌ಪೋರ್ಟ್',
  office: 'ಆಫೀಸ್',
  market: 'ಮಾರ್ಕೆಟ್',
  shop: 'ಶಾಪ್',
  store: 'ಸ್ಟೋರ್',
  college: 'ಕಾಲೇಜ್',
  bank: 'ಬ್ಯಾಂಕ್',
  ticket: 'ಟಿಕೆಟ್',
  money: 'ಮನಿ',
  price: 'ಪ್ರೈಸ್',
  bill: 'ಬಿಲ್',
  invoice: 'ಇನ್‌ವಾಯ್ಸ್',
  hello: 'ಹಲೋ',
  hi: 'ಹಾಯ್',
  sorry: 'ಸಾರಿ',
  please: 'ಪ್ಲೀಸ್',
  welcome: 'ವೆಲ್‌ಕಮ್',
  thank: 'ಥ್ಯಾಂಕ್',
  thanks: 'ಥ್ಯಾಂಕ್ಸ್',
  happy: 'ಹ್ಯಾಪಿ',
  birthday: 'ಬರ್ತ್‌ಡೇ',
  festival: 'ಫೆಸ್ಟಿವಲ್',
  love: 'ಲವ್',
  heart: 'ಹಾರ್ಟ್',
  story: 'ಸ್ಟೋರಿ',
  song: 'ಸಾಂಗ್',
  music: 'ಮ್ಯೂಸಿಕ್',
  movie: 'ಮೂವಿ',
  photo: 'ಫೋಟೋ',
  video: 'ವೀಡಿಯೋ',
  camera: 'ಕ್ಯಾಮೆರಾ',
  email: 'ಇಮೇಲ್',
  internet: 'ಇಂಟರ್ನೆಟ್',
  website: 'ವೆಬ್‌ಸೈಟ್',
  software: 'ಸಾಫ್ಟ್‌ವೇರ್',
  app: 'ಆ್ಯಪ್',
  google: 'ಗೂಗಲ್',
  time: 'ಟೈಮ್',
  today: 'ಟುಡೇ',
  morning: 'ಮಾರ್ನಿಂಗ್',
  night: 'ನೈಟ್',
  good: 'ಗುಡ್',
  super: 'ಸೂಪರ್',
  nice: 'ನೈಸ್',
  best: 'ಬೆಸ್ಟ್',
  green: 'ಗ್ರೀನ್',
  red: 'ರೆಡ್',
  blue: 'ಬ್ಲೂ',
  yellow: 'ಯೆಲ್ಲೋ',
  white: 'ವೈಟ್',
  black: 'ಬ್ಲ್ಯಾಕ್',
  city: 'ಸಿಟಿ',
  village: 'ವಿಲೇಜ್',
  home: 'ಹೋಮ್',
  house: 'ಹೌಸ್',
  room: 'ರೂಮ್',
  door: 'ಡೋರ್',
  table: 'ಟೇಬಲ್',
  chair: 'ಚೇರ್',
  book: 'ಬುಕ್',
  paper: 'ಪೇಪರ್',
  pen: 'ಪೆನ್',
  teacher: 'ಟೀಚರ್',
  student: 'ಸ್ಟೂಡೆಂಟ್',
  class: 'ಕ್ಲಾಸ್',
  work: 'ವರ್ಕ್',
  job: 'ಜಾಬ್',
  business: 'ಬ್ಯುಸಿನೆಸ್',
  company: 'ಕಂಪನಿ',
  party: 'ಪಾರ್ಟಿ',
  wedding: 'ವೆಡ್ಡಿಂಗ್',
  marriage: 'ಮ್ಯಾರೇಜ್',
  flower: 'ಫ್ಲವರ್',
  garden: 'ಗಾರ್ಡನ್',
  road: 'ರೋಡ್',
  street: 'ಸ್ಟ್ರೀಟ್',
  river: 'ರಿವರ್',
  beach: 'ಬೀಚ್',
  sea: 'ಸೀ',
  sun: 'ಸನ್',
  moon: 'ಮೂನ್',
  star: 'ಸ್ಟಾರ್',
  sky: 'ಸ್ಕೈ',
  rain: 'ರೈನ್',
  cloud: 'ಕ್ಲೌಡ್',
  wind: 'ವಿಂಡ್',
  fire: 'ಫೈರ್',
  light: 'ಲೈಟ್',
  boy: 'ಬಾಯ್',
  girl: 'ಗರ್ಲ್',
  baby: 'ಬೇಬಿ',
  child: 'ಚೈಲ್ಡ್',
  man: 'ಮ್ಯಾನ್',
  woman: 'ವುಮನ್',
  brother: 'ಬ್ರದರ್',
  sister: 'ಸಿಸ್ಟರ್',
  son: 'ಸನ್',
  daughter: 'ಡಾಟರ್',
  ok: 'ಓಕೆ',
  okay: 'ಓಕೆ',
  yes: 'ಯೆಸ್',
  no: 'ನೋ',
  world: 'ವರ್ಲ್ಡ್',
  future: 'ಫ್ಯೂಚರ್',
  nature: 'ನೇಚರ್',
  culture: 'ಕಲ್ಚರ್',
  picture: 'ಪಿಕ್ಚರ್',
  knowledge: 'ನಾಲೆಡ್ಜ್',
  mountain: 'ಮೌಂಟೇನ್',
  ocean: 'ಓಷನ್',
  engine: 'ಎಂಜಿನ್',
  machine: 'ಮಷೀನ್',
  cinema: 'ಸಿನಿಮಾ',
  cricket: 'ಕ್ರಿಕೆಟ್',
  biscuit: 'ಬಿಸ್ಕೆಟ್',
  pepper: 'ಪೆಪ್ಪರ್',
  great: 'ಗ್ರೇಟ್',
  awesome: 'ಆಸಮ್',
  wonderful: 'ವಂಡರ್‌ಫುಲ್',
  country: 'ಕಂಟ್ರಿ',
  people: 'ಪೀಪಲ್',
  person: 'ಪರ್ಸನ್',
  running: 'ರನ್ನಿಂಗ್',
  walking: 'ವಾಕಿಂಗ್',
  talking: 'ಟಾಕಿಂಗ್',
  looking: 'ಲುಕಿಂಗ್',
  working: 'ವರ್ಕಿಂಗ್',
  reading: 'ರೀಡಿಂಗ್',
  writing: 'ರೈಟಿಂಗ್',
  hungry: 'ಹಂಗ್ರಿ',
  thirsty: 'ಥರ್ಸ್ಟಿ',
  tired: 'ಟೈಯರ್ಡ್',
  better: 'ಬೆಟರ್',
  fine: 'ಫೈನ್',
  what: 'ವಾಟ್',
  where: 'ವೇರ್',
  when: 'ವೆನ್',
  how: 'ಹೌ',
  why: 'ವೈ',
  which: 'ವಿಚ್',
  this: 'ದಿಸ್',
  that: 'ದ್ಯಾಟ್',
  these: 'ದೀಸ್',
  those: 'ದೋಸ್',
};

// English -> Kannada native dictionary meanings
export const EK: Record<string, string[]> = {
  cherry: ['ಚೆರ್ರಿ'],
  apple: ['ಸೇಬು', 'ಆಪಲ್'],
  mango: ['ಮಾವು', 'ಮಾವಿನ ಹಣ್ಣು'],
  banana: ['ಬಾಳೆಹಣ್ಣು'],
  orange: ['ಕಿತ್ತಳೆ'],
  grape: ['ದ್ರಾಕ್ಷಿ'],
  grapes: ['ದ್ರಾಕ್ಷಿ'],
  coconut: ['ತೆಂಗಿನಕಾಯಿ', 'ತೆಂಗು'],
  water: ['ನೀರು'],
  mother: ['ಅಮ್ಮ', 'ತಾಯಿ'],
  father: ['ಅಪ್ಪ', 'ತಂದೆ'],
  parents: ['ತಂದೆ ತಾಯಿ'],
  family: ['ಕುಟುಂಬ'],
  house: ['ಮನೆ'],
  home: ['ಮನೆ'],
  food: ['ಊಟ', 'ಆಹಾರ'],
  rice: ['ಅಕ್ಕಿ', 'ಅನ್ನ'],
  milk: ['ಹಾಲು'],
  salt: ['ಉಪ್ಪು'],
  sugar: ['ಸಕ್ಕರೆ'],
  honey: ['ಜೇನು'],
  coffee: ['ಕಾಫಿ'],
  tea: ['ಚಹಾ', 'ಟೀ'],
  fish: ['ಮೀನು'],
  chicken: ['ಕೋಳಿ'],
  egg: ['ಮೊಟ್ಟೆ'],
  school: ['ಶಾಲೆ'],
  book: ['ಪುಸ್ತಕ'],
  friend: ['ಸ್ನೇಹಿತ', 'ಗೆಳೆಯ'],
  love: ['ಪ್ರೀತಿ', 'ಮಮತೆ'],
  name: ['ಹೆಸರು'],
  hello: ['ನಮಸ್ಕಾರ'],
  hi: ['ನಮಸ್ಕಾರ'],
  thanks: ['ಧನ್ಯವಾದಗಳು', 'ಧನ್ಯವಾದ'],
  thank: ['ಧನ್ಯವಾದ'],
  sorry: ['ಕ್ಷಮಿಸಿ'],
  please: ['ದಯವಿಟ್ಟು'],
  welcome: ['ಸ್ವಾಗತ'],
  good: ['ಒಳ್ಳೆಯ', 'ಚೆನ್ನಾಗಿದೆ'],
  happy: ['ಸಂತೋಷ', 'ಖುಷಿ'],
  sad: ['ದುಃಖ'],
  village: ['ಹಳ್ಳಿ', 'ಗ್ರಾಮ'],
  city: ['ನಗರ', 'ಪಟ್ಟಣ'],
  road: ['ರಸ್ತೆ', 'ದಾರಿ'],
  sun: ['ಸೂರ್ಯ'],
  moon: ['ಚಂದ್ರ'],
  star: ['ನಕ್ಷತ್ರ'],
  sky: ['ಆಕಾಶ'],
  rain: ['ಮಳೆ'],
  wind: ['ಗಾಳಿ'],
  tree: ['ಮರ'],
  flower: ['ಹೂವು'],
  leaf: ['ಎಲೆ'],
  river: ['ನದಿ'],
  sea: ['ಸಮುದ್ರ'],
  stone: ['ಕಲ್ಲು'],
  day: ['ದಿನ'],
  night: ['ರಾತ್ರಿ'],
  morning: ['ಬೆಳಗ್ಗೆ'],
  evening: ['ಸಂಜೆ'],
  today: ['ಇಂದು', 'ಇವತ್ತು'],
  tomorrow: ['ನಾಳೆ'],
  yesterday: ['ನಿನ್ನೆ'],
  fire: ['ಬೆಂಕಿ'],
  temple: ['ದೇವಸ್ಥಾನ'],
  god: ['ದೇವರು'],
  king: ['ರಾಜ'],
  queen: ['ರಾಣಿ'],
  child: ['ಮಗು'],
  baby: ['ಮಗು'],
  boy: ['ಹುಡುಗ'],
  girl: ['ಹುಡುಗಿ'],
  man: ['ಗಂಡಸು', 'ಮನುಷ್ಯ'],
  woman: ['ಹೆಂಗಸು', 'ಮಹಿಳೆ'],
  dog: ['ನಾಯಿ'],
  cat: ['ಬೆಕ್ಕು'],
  cow: ['ಹಸು', 'ದನ'],
  tiger: ['ಹುಲಿ'],
  bird: ['ಹಕ್ಕಿ'],
  head: ['ತಲೆ'],
  eye: ['ಕಣ್ಣು'],
  ear: ['ಕಿವಿ'],
  nose: ['ಮೂಗು'],
  hand: ['ಕೈ'],
  heart: ['ಹೃದಯ'],
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
  hot: ['ಬಿಸಿ'],
  cold: ['ತಣ್ಣನೆ', 'ಚಳಿ'],
  red: ['ಕೆಂಪು'],
  white: ['ಬಿಳಿ'],
  black: ['ಕಪ್ಪು'],
  green: ['ಹಸಿರು'],
  yellow: ['ಹಳದಿ'],
  blue: ['ನೀಲಿ'],
  money: ['ಹಣ', 'ದುಡ್ಡು'],
  time: ['ಸಮಯ'],
  life: ['ಜೀವನ'],
  world: ['ಪ್ರಪಂಚ'],
  language: ['ಭಾಷೆ'],
  sister: ['ಅಕ್ಕ', 'ತಂಗಿ'],
  brother: ['ಅಣ್ಣ', 'ತಮ್ಮ'],
  wife: ['ಹೆಂಡತಿ'],
  husband: ['ಗಂಡ'],
  teacher: ['ಶಿಕ್ಷಕ', 'ಗುರು'],
  student: ['ವಿದ್ಯಾರ್ಥಿ'],
  doctor: ['ವೈದ್ಯ'],
  work: ['ಕೆಲಸ'],
  help: ['ಸಹಾಯ'],
  come: ['ಬನ್ನಿ', 'ಬಾ'],
  go: ['ಹೋಗಿ', 'ಹೋಗು'],
  eat: ['ತಿನ್ನು', 'ಊಟ ಮಾಡು'],
  drink: ['ಕುಡಿ'],
  sleep: ['ನಿದ್ರೆ'],
  read: ['ಓದು'],
  write: ['ಬರೆ'],
  learn: ['ಕಲಿ'],
  running: ['ಓಡುವುದು'],
  walking: ['ನಡೆಯುವುದು'],
  talking: ['ಮಾತನಾಡುವುದು'],
  looking: ['ನೋಡುವುದು'],
  working: ['ಕೆಲಸ ಮಾಡುವುದು'],
  reading: ['ಓದುವುದು'],
  writing: ['ಬರೆಯುವುದು'],
  hungry: ['ಹಸಿವು'],
  thirsty: ['ದಾಹ'],
  tired: ['ದಣಿವು'],
  great: ['ಮಹಾನ್', 'ಅದ್ಭುತ'],
  awesome: ['ಅದ್ಭುತ'],
  wonderful: ['ಅದ್ಭುತ', 'ಆಶ್ಚರ್ಯಕರ'],
  future: ['ಭವಿಷ್ಯ'],
  nature: ['ಪ್ರಕೃತಿ'],
  culture: ['ಸಂಸ್ಕೃತಿ'],
  knowledge: ['ಜ್ಞಾನ'],
  mountain: ['ಬೆಟ್ಟ', 'ಪರ್ವತ'],
  ocean: ['ಸಾಗರ'],
  country: ['ದೇಶ'],
  people: ['ಜನರು'],
  person: ['ವ್ಯಕ್ತಿ'],
  what: ['ಏನು'],
  where: ['ಎಲ್ಲಿ'],
  when: ['ಯಾವಾಗ'],
  how: ['ಹೇಗೆ'],
  why: ['ಏಕೆ'],
  which: ['ಯಾವುದು'],
  this: ['ಇದು'],
  that: ['ಅದು'],
  these: ['ಇವು'],
  those: ['ಅವು'],
};

// English -> Authentic Tulu (Sari Tulu) dictionary
export const ETU: Record<string, string[]> = {
  water: ['ನೀರ್'],
  mother: ['ಅಪ್ಪೆ'],
  father: ['ಅಮ್ಮೆ', 'ಪೊಪ್ಪ'],
  family: ['ಕುಟುಂಬ'],
  house: ['ಇಲ್ಲು'],
  home: ['ಇಲ್ಲು'],
  kitchen: ['ಅಡ್ಪಿಲು'],
  food: ['ಉನ್ಪು', 'ತಿನ್ಪಿನ'],
  rice: ['ಅರಿ', 'ಉನ್ಪು'],
  milk: ['ಪೇರ್'],
  salt: ['ಉಪ್ಪು'],
  jaggery: ['ಬೆಲ್ಲೊ'],
  mango: ['ಕುಕ್ಕು'],
  banana: ['ಬಾರೆದ ಪರ್ಂದ್'],
  coconut: ['ತಾರಾಯಿ'],
  jackfruit: ['ಪೆಲಕಾಯಿ'],
  fish: ['ಮೀನ್'],
  chicken: ['ಕೋರಿ'],
  egg: ['ತೆತ್ತಿ'],
  friend: ['ದೋಸ್ತಿ', 'ಗೆಳೆಯೆ'],
  love: ['ಮೋಕೆ', 'ಅಕ್ಕರೆ'],
  affection: ['ಅಕ್ಕರೆ'],
  name: ['ಪುದರ್'],
  nickname: ['ಅಡ್ಡಪುದರ್'],
  hello: ['ಸೊಲ್ಮೆಲು', 'ನಮಸ್ಕಾರ'],
  hi: ['ಸೊಲ್ಮೆಲು'],
  thanks: ['ಸೊಲ್ಮೆಲು'],
  thank: ['ಸೊಲ್ಮೆಲು'],
  welcome: ['ಎಡ್ಡೆ ಬರವು'],
  good: ['ಎಡ್ಡೆ'],
  happy: ['ಸಂತೋಸೊ', 'ಖುಷಿ'],
  beautiful: ['ಪೊರ್ಲು'],
  big: ['ಮಲ್ಲ'],
  small: ['ಎಲ್ಯ'],
  new: ['ಪೊಸ'],
  old: ['ಪರ'],
  hot: ['ಬೆಚ್ಚ'],
  cold: ['ಚಳಿ'],
  village: ['ಊರು'],
  city: ['ಪೇಂಟೆ', 'ಕುಡ್ಲ'],
  road: ['ಸಾದಿ'],
  sun: ['ಸೂರ್ಯೆ'],
  moon: ['ತಿಂಗೊಲು'],
  sky: ['ಆಕಾಸೊ'],
  rain: ['ಬರ್ಸ'],
  wind: ['ಕಾತ್'],
  tree: ['ಮರ'],
  flower: ['ಪೂ'],
  leaf: ['ಇರೆ'],
  river: ['ತುದೆ'],
  sea: ['ಕಡಲ್'],
  stone: ['ಕಲ್ಲ್'],
  day: ['ದಿನ'],
  night: ['ಇರ್ಲ್'],
  morning: ['ಕಾಂಡೆ'],
  evening: ['ಬಯ್ಯ'],
  today: ['ಇನಿ'],
  tomorrow: ['ಎಲ್ಯೆ'],
  yesterday: ['ಕೋಡೆ'],
  fire: ['ತೂ'],
  temple: ['ದೇವಸ್ಥಾನೊ'],
  god: ['ದೇವೆರ್'],
  king: ['ಅರಸು'],
  child: ['ಬಾಲೆ'],
  baby: ['ಬಾಲೆ'],
  boy: ['ಆಣ್'],
  girl: ['ಪೊಣ್ಣು'],
  man: ['ಆಣ್'],
  woman: ['ಪೊಣ್ಣು'],
  dog: ['ನಾಯಿ'],
  cat: ['ಪುಚ್ಚೆ'],
  cow: ['ಪತ್ತ', 'ಪೆತ್ತ'],
  calf: ['ಕಂಜಿ'],
  tiger: ['ಪಿಲಿ'],
  bird: ['ಪಕ್ಕಿ'],
  mosquito: ['ಉಮಿಲು'],
  head: ['ಮಂಡೆ'],
  eye: ['ಕಣ್ಣ್'],
  ear: ['ಕೆಬಿ'],
  nose: ['ಮೂಂಕು'],
  hand: ['ಕೈ'],
  finger: ['ಬಿರೆಲ್'],
  heart: ['ತಿಗಲೆ'],
  one: ['ಒಂಜಿ'],
  two: ['ರಡ್ಡ್'],
  three: ['ಮೂಜಿ'],
  four: ['ನಾಲ್'],
  five: ['ಐನ್'],
  six: ['ಆಜಿ'],
  seven: ['ಏಳ್'],
  eight: ['ಎಣ್ಮ'],
  nine: ['ಒರ್ಂಬ'],
  ten: ['ಪತ್ತ್'],
  yes: ['ಅಂದ್'],
  no: ['ಇಜ್ಜಿ', 'ಅತ್ತ್'],
  money: ['ಕಾಸ್'],
  coin: ['ಪಾವೊಲಿ'],
  language: ['ಬಾಸೆ'],
  sister: ['ಪಲಿ', 'ತಂಗಡಿ'],
  brother: ['ಅಣ್ಣೆ', 'ಮೆಗ್ಗೆ'],
  work: ['ಬೇಲೆ'],
  help: ['ಸಹಾಯೊ'],
  come: ['ಬಲೆ'],
  go: ['ಪೋಲೆ'],
  language_tulu: ['ತುಳು'],
  cherry: ['ಚೆರ್ರಿ'],
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

// ============================================================================
// CONTEXT-AWARE ENGLISH -> KANNADA PHONETIC TRANSLITERATION ENGINE
// ============================================================================
export interface EnPhoneticOptions {
  t?: 'T' | 't';
  d?: 'D' | 'd';
  sh?: 'sh' | 'Sh';
  ch?: 'c' | 'ch' | 'k';
  th?: 't' | 'th' | 'd';
  dh?: 'dh' | 'd';
  doubleConsonant?: boolean;
  openAStyle?: 'ya' | 'aa' | 'a';
  oStyle?: 'aa' | 'o';
  uStyle?: 'a' | 'u';
  eeStyle?: 'ii' | 'ee';
  ooStyle?: 'uu' | 'oo' | 'u';
  aiStyle?: 'ee' | 'ai';
  finalYStyle?: 'i' | 'ii';
  fa?: boolean;
  le?: boolean;
}

const VOWEL_CHARS = new Set(['a', 'e', 'i', 'o', 'u']);

export function englishToPhoneticKannada(
  rawWord: string,
  o: EnPhoneticOptions = {}
): string {
  const lw = rawWord.toLowerCase().replace(/[^a-z]/g, '');
  if (!lw) return '';

  const tChar = o.t || 'T';
  const dChar = o.d || 'D';
  const shChar = o.sh || 'sh';
  const chChar = o.ch || 'c';
  const thChar = o.th || 't';
  const dhChar = o.dh || 'dh';
  const keepDouble = o.doubleConsonant !== undefined ? o.doubleConsonant : true;
  const openA = o.openAStyle || 'ya';
  const oSound = o.oStyle || 'aa';
  const uSound = o.uStyle || 'a';
  const eeSound = o.eeStyle || 'ii';
  const ooSound = o.ooStyle || 'uu';
  const aiSound = o.aiStyle || 'ee';
  const finalY = o.finalYStyle || 'i';

  const len = lw.length;
  const parts: string[] = [];
  let i = 0;

  // Detect magic-E ending on root (e.g. name, time, home, phone, cake, rice, page, mobile)
  // Exclude Consonant + le# (apple, bottle), while allowing Vowel + C + le# (mobile, smile, file)
  const isConsonantLe =
    len >= 4 && lw.endsWith('le') && !VOWEL_CHARS.has(lw[len - 3]);
  const hasSilentFinalE =
    len >= 4 &&
    lw.endsWith('e') &&
    !lw.endsWith('ee') &&
    !lw.endsWith('ie') &&
    !lw.endsWith('ye') &&
    !isConsonantLe &&
    !VOWEL_CHARS.has(lw[len - 2]);

  const prevWasVowel = (idx: number) =>
    idx > 0 && VOWEL_CHARS.has(lw[idx - 1]);

  while (i < len) {
    const rem = lw.slice(i);

    // 1. Word-end multi-letter English suffixes
    if (rem === 'tion' || rem === 'tions') {
      parts.push(shChar + 'an' + (rem.endsWith('s') ? 's' : ''));
      break;
    }
    if (rem === 'sion' || rem === 'sions') {
      parts.push(shChar + 'an' + (rem.endsWith('s') ? 's' : ''));
      break;
    }
    if (rem === 'ture' || rem === 'tures') {
      parts.push('car' + (rem.endsWith('s') ? 's' : ''));
      break;
    }
    if (rem === 'sure' || rem === 'sures') {
      parts.push('jar' + (rem.endsWith('s') ? 's' : ''));
      break;
    }
    if (rem === 'dge' && i >= 1) {
      parts.push('j');
      break;
    }
    if (rem === 'ere' && i >= 2) {
      parts.push('eer');
      break;
    }
    if (rem === 'ment') {
      parts.push('men' + tChar);
      break;
    }
    if (rem === 'ness') {
      parts.push('nes');
      break;
    }
    if (rem === 'ful') {
      parts.push('ful');
      break;
    }
    if (rem === 'ous') {
      parts.push('as');
      break;
    }
    if (rem === 'ies' && i >= 2) {
      parts.push(finalY === 'ii' ? 'iis' : 'iis');
      break;
    }
    if ((rem === 'ey' || rem === 'ie') && i >= 2) {
      parts.push(finalY);
      break;
    }
    if (rem === 'ly' && i >= 2) {
      parts.push('l' + finalY);
      break;
    }
    if (rem === 'ry' && i >= 2 && !VOWEL_CHARS.has(lw[i - 1])) {
      parts.push('r' + finalY);
      break;
    }
    if (rem === 'y' && i === len - 1) {
      const hasPriorVowel = /[aeiou]/.test(lw.slice(0, i));
      if (i >= 2 && hasPriorVowel) {
        parts.push(finalY);
      } else {
        parts.push('ai');
      }
      break;
    }
    // -nge# (orange -> ಆರೆಂಜ್, change -> ಚೇಂಜ್)
    if (rem === 'nge' && i >= 1) {
      parts.push('Mj');
      break;
    }
    // Consonant + le# (apple -> ಆಪಲ್, table -> ಟೇಬಲ್)
    if (rem === 'le' && i >= 2 && !VOWEL_CHARS.has(lw[i - 1])) {
      parts.push('al');
      break;
    }
    // -er / -or / -ar at word end after consonant in multi-syllable word
    if (
      (rem === 'er' || rem === 'or' || rem === 'ar') &&
      i >= 2 &&
      !VOWEL_CHARS.has(lw[i - 1]) &&
      /[aeiou]/.test(lw.slice(0, i))
    ) {
      parts.push('ar');
      break;
    }
    // Silent final -e (already accounted for by preceding vowel)
    if (hasSilentFinalE && i === len - 1) {
      break;
    }

    // 2. Word-initial silent combos
    if (i === 0 && rem.startsWith('kn')) {
      parts.push('n');
      i += 2;
      continue;
    }
    if (i === 0 && rem.startsWith('wr')) {
      parts.push('r');
      i += 2;
      continue;
    }

    // 3. Three-letter clusters
    if (rem.startsWith('eau')) {
      parts.push('yuu');
      i += 3;
      continue;
    }
    if (rem.startsWith('igh')) {
      parts.push('ai');
      i += 3;
      continue;
    }
    if (rem.startsWith('ksh')) {
      parts.push('kSh');
      i += 3;
      continue;
    }
    if (rem.startsWith('chh')) {
      parts.push('ch');
      i += 3;
      continue;
    }
    if (rem.startsWith('sch')) {
      parts.push('sk');
      i += 3;
      continue;
    }

    // 4. Two-letter vowel digraphs
    if (rem.startsWith('ee')) {
      parts.push(eeSound);
      i += 2;
      continue;
    }
    if (rem.startsWith('ea')) {
      parts.push(o.eeStyle ? o.eeStyle : 'ii');
      i += 2;
      continue;
    }
    if (rem.startsWith('oo')) {
      parts.push(ooSound);
      i += 2;
      continue;
    }
    if (rem.startsWith('oa')) {
      parts.push('oo');
      i += 2;
      continue;
    }
    if (rem.startsWith('ai') || rem.startsWith('ay')) {
      parts.push(aiSound);
      i += 2;
      continue;
    }
    if (rem.startsWith('au') || rem.startsWith('aw')) {
      parts.push(o.ooStyle === 'oo' ? 'au' : 'aa');
      i += 2;
      continue;
    }
    if (rem.startsWith('ou') || rem.startsWith('ow')) {
      // 'ow' at word end is frequently long 'o' (show, window, yellow)
      if (rem === 'ow' && i >= 2) {
        parts.push('oo');
      } else {
        parts.push('au');
      }
      i += 2;
      continue;
    }
    if (rem.startsWith('oi') || rem.startsWith('oy')) {
      parts.push('aay');
      i += 2;
      continue;
    }

    // 5. Two-letter consonant digraphs
    if (rem.startsWith('sh')) {
      parts.push(shChar);
      i += 2;
      continue;
    }
    if (rem.startsWith('ch')) {
      parts.push(chChar);
      i += 2;
      continue;
    }
    if (rem.startsWith('th')) {
      parts.push(thChar);
      i += 2;
      continue;
    }
    if (rem.startsWith('dh')) {
      parts.push(dhChar);
      i += 2;
      continue;
    }
    if (rem.startsWith('ph')) {
      parts.push('f');
      i += 2;
      continue;
    }
    if (rem.startsWith('wh')) {
      parts.push('v');
      i += 2;
      continue;
    }
    if (rem.startsWith('qu')) {
      parts.push('kv');
      i += 2;
      continue;
    }
    if (rem.startsWith('ck')) {
      parts.push('k');
      i += 2;
      continue;
    }
    if (rem.startsWith('kh')) {
      parts.push('kh');
      i += 2;
      continue;
    }
    if (rem.startsWith('gh')) {
      parts.push('gh');
      i += 2;
      continue;
    }
    if (rem.startsWith('bh')) {
      parts.push('bh');
      i += 2;
      continue;
    }
    if (rem.startsWith('jh')) {
      parts.push('jh');
      i += 2;
      continue;
    }
    if (rem.startsWith('ng')) {
      const after = lw[i + 2];
      if (after && 'eiy'.includes(after)) {
        parts.push('Mj');
      } else {
        parts.push(i + 2 === len || !VOWEL_CHARS.has(after) ? 'Mg' : 'ng');
      }
      i += 2;
      continue;
    }

    // 6. Double consonants (rr, pp, ll, ss, tt, dd, etc.)
    const ch = lw[i];
    const next = lw[i + 1];
    if (!VOWEL_CHARS.has(ch) && ch === next) {
      const atEnd = i + 2 === len;
      const mapChar =
        ch === 't'
          ? tChar
          : ch === 'd'
          ? dChar
          : ch === 'c'
          ? 'k'
          : ch === 'v' || ch === 'w'
          ? 'v'
          : ch;
      if (atEnd || !keepDouble) {
        parts.push(mapChar);
      } else {
        parts.push(mapChar + mapChar);
      }
      i += 2;
      continue;
    }

    // 7. Single vowels with English syllabic awareness
    if (ch === 'a') {
      // -ation / -asion / -ature -> long e, or open vowel before Cle# (table -> ಟೇಬಲ್)
      if (
        rem.startsWith('ation') ||
        rem.startsWith('asion') ||
        rem.startsWith('ature') ||
        (isConsonantLe && i === len - 4 && !VOWEL_CHARS.has(next))
      ) {
        parts.push('ee');
      } else if (hasSilentFinalE && i === len - 3 && !VOWEL_CHARS.has(next)) {
        parts.push('ee');
      } else if (rem.startsWith('alk')) {
        parts.push('aa');
        // skip silent 'l' in walk/talk/chalk
        parts.push('k');
        i += 3;
        continue;
      } else if (i > 0 && lw[i - 1] === 'w' && next && !VOWEL_CHARS.has(next)) {
        parts.push('aa');
      } else if (next === 'r' && (!lw[i + 2] || !VOWEL_CHARS.has(lw[i + 2]))) {
        parts.push('aa');
      } else if (
        next === 'l' &&
        (lw[i + 2] === 'l' || (lw[i + 2] && !VOWEL_CHARS.has(lw[i + 2])))
      ) {
        parts.push('aa');
      } else if (
        i > 0 &&
        next &&
        !VOWEL_CHARS.has(next) &&
        lw[i + 2] &&
        !VOWEL_CHARS.has(lw[i + 2]) &&
        openA === 'ya'
      ) {
        parts.push('yaa');
      } else if (
        i > 0 &&
        next &&
        !VOWEL_CHARS.has(next) &&
        i + 2 === len &&
        openA === 'ya'
      ) {
        parts.push('yaa');
      } else if (openA === 'aa') {
        parts.push('aa');
      } else {
        parts.push(i === 0 ? 'aa' : 'a');
      }
      i++;
      continue;
    }

    if (ch === 'e') {
      if (hasSilentFinalE && i === len - 3 && !VOWEL_CHARS.has(next)) {
        parts.push('ii');
      } else if (o.le) {
        parts.push('ee');
      } else {
        parts.push('e');
      }
      i++;
      continue;
    }

    if (ch === 'i') {
      if (hasSilentFinalE && i === len - 3 && !VOWEL_CHARS.has(next)) {
        parts.push('ai');
      } else if (next === 'r' && (!lw[i + 2] || !VOWEL_CHARS.has(lw[i + 2]))) {
        parts.push('a');
      } else {
        parts.push('i');
      }
      i++;
      continue;
    }

    if (ch === 'o') {
      if (hasSilentFinalE && i === len - 3 && !VOWEL_CHARS.has(next)) {
        parts.push('oo');
      } else if (o.le) {
        parts.push('oo');
      } else if (
        next &&
        !VOWEL_CHARS.has(next) &&
        next !== 'r' &&
        (i + 2 === len || !VOWEL_CHARS.has(lw[i + 2]))
      ) {
        parts.push(oSound === 'aa' ? 'aa' : 'o');
      } else {
        parts.push('o');
      }
      i++;
      continue;
    }

    if (ch === 'u') {
      if (
        (hasSilentFinalE && i === len - 3 && !VOWEL_CHARS.has(next)) ||
        rem.startsWith('uture') ||
        rem.startsWith('usic')
      ) {
        parts.push(i > 0 && !prevWasVowel(i) ? 'yuu' : 'uu');
      } else if (next === 'r' && (!lw[i + 2] || !VOWEL_CHARS.has(lw[i + 2]))) {
        parts.push('a');
      } else if (
        next &&
        !VOWEL_CHARS.has(next) &&
        (i + 2 === len || !VOWEL_CHARS.has(lw[i + 2])) &&
        uSound === 'a'
      ) {
        parts.push('a');
      } else {
        parts.push('u');
      }
      i++;
      continue;
    }

    // 8. Single consonants
    if (ch === 'c') {
      parts.push(next && 'eiy'.includes(next) ? 's' : 'k');
    } else if (ch === 'g') {
      parts.push(next && 'eiy'.includes(next) && i > 0 ? 'j' : 'g');
    } else if (ch === 't') {
      parts.push(tChar);
    } else if (ch === 'd') {
      parts.push(dChar);
    } else if (ch === 'x') {
      parts.push('ks');
    } else if (ch === 'q') {
      parts.push('k');
    } else if (ch === 'w') {
      parts.push('v');
    } else {
      parts.push(ch);
    }
    i++;
  }

  let s = parts.join('');
  if (o.fa && /a$/.test(s) && !/aa$/.test(s)) {
    s = s.replace(/a$/, 'aa');
  }
  return phon(s);
}

// ============================================================================
// MEANING LOOKUP WITH SIMPLE ENGLISH INFLECTION NORMALIZATION
// ============================================================================
function collectEnglishMeanings(
  lw: string,
  dict: Record<string, string[]>
): string[] {
  const results: string[] = [];
  const pushAll = (arr?: string[]) => {
    if (!arr) return;
    for (const item of arr) {
      if (item && !results.includes(item)) results.push(item);
    }
  };
  pushAll(dict[lw]);

  // Basic English stem fallbacks (cherries -> cherry, houses -> house, apples -> apple)
  if (lw.endsWith('ies') && lw.length > 4) {
    pushAll(dict[lw.slice(0, -3) + 'y']);
  }
  if (lw.endsWith('es') && lw.length > 3) {
    pushAll(dict[lw.slice(0, -2)]);
  }
  if (lw.endsWith('s') && lw.length > 3) {
    pushAll(dict[lw.slice(0, -1)]);
  }
  if (lw.endsWith('ing') && lw.length > 5) {
    pushAll(dict[lw.slice(0, -3)]);
    pushAll(dict[lw.slice(0, -3) + 'e']);
  }
  if (lw.endsWith('ed') && lw.length > 4) {
    pushAll(dict[lw.slice(0, -2)]);
    pushAll(dict[lw.slice(0, -1)]);
  }
  return results;
}

// ============================================================================
// CANDIDATE SUGGESTIONS ENGINE (MORE ACCURATE + MORE SUGGESTIONS TO PICK)
// ============================================================================
const candsEnCache = new Map<string, [string, string][]>();

export function candsEn(
  w: string,
  pref: TranslationPreference | boolean
): [string, string][] {
  const mode: TranslationPreference =
    pref === true ? 'kn' : pref === false ? 'sound' : pref;
  const lw = w.toLowerCase();
  const key = `${lw}:${mode}`;
  if (candsEnCache.has(key)) return candsEnCache.get(key)!;

  const out: [string, string][] = [];
  const add = (k: string | undefined, tag: string) => {
    if (!k) return;
    const clean = k.trim();
    if (!clean || out.some((item) => item[0] === clean)) return;
    out.push([clean, tag]);
  };

  const tuluMeans = collectEnglishMeanings(lw, ETU);
  const knMeans = [
    ...collectEnglishMeanings(lw, EK),
    ...collectEnglishMeanings(lw, EM),
  ];

  // 1. Order top-priority candidates based on Translation Preference mode
  if (mode === 'tu') {
    tuluMeans.forEach((k) => add(k, 'Tulu word'));
    knMeans.forEach((k) => add(k, 'Kannada meaning'));
    if (NM[lw]) add(NM[lw], 'standard spelling');
  } else if (mode === 'kn' || mode === 'gt') {
    knMeans.forEach((k) => add(k, 'Kannada meaning'));
    tuluMeans.forEach((k) => add(k, 'Tulu word'));
    if (NM[lw]) add(NM[lw], 'standard spelling');
  } else {
    if (NM[lw]) add(NM[lw], 'recommended');
  }

  // 2. Primary English phonetic transliteration
  add(englishToPhoneticKannada(lw), NM[lw] ? 'phonetic' : 'recommended');

  // 3. Meanings (when in sound mode, still offer Tulu & Kannada meanings right after phonetic!)
  if (mode === 'sound') {
    tuluMeans.forEach((k) => add(k, 'Tulu word'));
    knMeans.forEach((k) => add(k, 'Kannada meaning'));
  }

  // 4. Rich phonetic / spelling variants so user always has accurate alternatives
  const variantConfigs: [EnPhoneticOptions, string][] = [
    [{ doubleConsonant: false }, 'short spelling'],
    [{ finalYStyle: 'ii' }, 'long final i'],
    [{ t: 't', d: 'd' }, 'dental t / d'],
    [{ t: 'T', d: 'D', oStyle: 'o' }, 'o vowel'],
    [{ openAStyle: 'aa' }, 'long a vowel'],
    [{ openAStyle: 'a' }, 'short a vowel'],
    [{ uStyle: 'u' }, 'u sound'],
    [{ eeStyle: 'ee' }, 'e sound'],
    [{ ooStyle: 'oo' }, 'o / oo sound'],
    [{ aiStyle: 'ai' }, 'ai sound'],
    [{ sh: 'Sh' }, 'retroflex Sh'],
    [{ ch: 'ch' }, 'aspirated ch'],
    [{ ch: 'k' }, 'hard k sound'],
    [{ th: 'th' }, 'aspirated th'],
    [{ dh: 'd' }, 'soft d'],
    [{ le: true }, 'long e / o'],
    [{ fa: true }, 'long final a'],
  ];

  for (const [opts, tag] of variantConfigs) {
    add(englishToPhoneticKannada(lw, opts), tag);
  }

  // 5. Also include literal Nudi-style phonetic interpretation as fallback
  if (/^[a-z]+$/.test(lw)) {
    add(phon(lw), 'Nudi literal');
  }

  const res = out.slice(0, 12);
  candsEnCache.set(key, res);
  return res;
}

// ============================================================================
// MULTILINGUAL SCRIPT DETECTION & INDIC/ROMAN CANDIDATE ENGINE
// ============================================================================
export const WRE =
  /[A-Za-z]+|[\u0900-\u0C7F\u0D00-\u0D7F][\u0900-\u0C7F\u0D00-\u0D7F\u200c\u200d]*/g;

export function scr(w: string): ScriptKey {
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

export const SCN: Record<ScriptKey, string> = {
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

export const LGO: Record<ScriptKey, [string, string][]> = {
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

export const RMK = new Set(
  'namaste namaskara namaskaram solmelu hegiddira hegide yenu enu alla illa beku ide idu adu nanna ninna nimma namma mane ooru uru illu kya hai nahi nahin mera meri tum aap hum kaise accha acha bahut kaun kyun naanu neenu yaan eer irna avanu avalu banni tuluva tulunadu kudla ullar yencha encha bodu bodchi appe amme anne akka kukku neer peer uppu unpu puddar pudar edde moke porlu malle elya'.split(
    ' '
  )
);
export const ENS = new Set(
  'the is are was and of to in for with that this you your it on be have not from but or my we they will can what where how'.split(
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

export function i2k(s: string, o: { tv?: 'in' | 'all' } = {}): string {
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

export function indicC(
  w: string,
  sc: Exclude<ScriptKey, 'latin'>,
  lg: string
): [string, string][] {
  const out: [string, string][] = [];
  const add = (k: string, t: string) => {
    if (k && !out.some((o) => o[0] === k)) out.push([k, t]);
  };
  const direct = i2k(w);
  add(direct, 'same sounds');
  if (
    sc === 'dev' &&
    (lg === 'hi' || lg === 'ne' || lg === 'mr') &&
    /[\u0915-\u0939\u0958-\u095F]$/.test(w)
  ) {
    add(direct + '್', 'Hindi sound (no final a)');
  }
  if (sc === 'mal' && w.endsWith('ം')) {
    add(direct.slice(0, -1) + 'ಮ್', 'Malayalam final -m');
  }
  if (sc === 'tam') {
    add(i2k(w, { tv: 'in' }), 'voiced inside word');
    add(i2k(w, { tv: 'all' }), 'all voiced');
  }
  if (direct.includes('ಂ')) {
    add(direct.replace(/ಂ$/, 'ಮ್'), 'final -m');
  }
  return out;
}

export function romanC(w: string): [string, string][] {
  const out: [string, string][] = [];
  const add = (k: string | undefined, t: string) => {
    if (k && !out.some((o) => o[0] === k)) out.push([k, t]);
  };
  const lw = w.toLowerCase();
  add(NM[lw], 'common spelling');
  add(phon(w), 'as typed');
  add(phon(lw), 'lowercase sounds');
  add(englishToPhoneticKannada(lw), 'English sounds');
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
  if (/l/.test(lw)) {
    add(phon(lw.replace(/l/g, 'L')), 'retroflex L (ಳ)');
  }
  if (/n/.test(lw)) {
    add(phon(lw.replace(/n/g, 'N')), 'retroflex N (ಣ)');
  }
  return out.slice(0, 10);
}

/**
 * Converts user-typed custom text in "Other spelling…" into Kannada if the user
 * typed Latin/phonetic characters instead of Kannada script, so non-Kannada
 * users can type phonetic spellings like "cherri" -> "ಚೆರ್ರಿ" directly!
 */
export function resolveCustomSpellingInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/[\u0C80-\u0CFF]/.test(trimmed)) return trimmed;
  if (/^[a-zA-Z~ ]+$/.test(trimmed)) {
    const words = trimmed.split(/\s+/).filter(Boolean);
    return words
      .map((w) => {
        const lw = w.toLowerCase();
        if (NM[lw]) return NM[lw];
        // If user used Nudi uppercase markers (T, D, N, L, Sh, M, I, U, A) use direct phon()
        if (/[TDNLSMIUAE]/.test(w) || w.includes('~')) return phon(w);
        // Otherwise use English-friendly transliteration so "cherri" -> "ಚೆರ್ರಿ"!
        return englishToPhoneticKannada(lw);
      })
      .join(' ');
  }
  return trimmed;
}

export const L_HL = [
  ...'ಅಆಇಈಉಊಋಎಏಐಒಓಔಕಖಗಘಙಚಛಜಝಞಟಠಡಢಣತಥದಧನಪಫಬಭಮಯರಲವಶಷಸಹಳ',
];
export const L_IV = [0, 1, 3, 7, 16, 35];
