// Smart box, comb-cell, and rule detector ported to TypeScript for VCPL Smart PDF Form Filler.
// Inspects a binary dark mask (1 = ink, 0 = paper) drawn at `s` pixels per PDF point and classifies taps into:
//   - comb: row of letter boxes (with optional group breaks like DD / MM / YYYY)
//   - box: enclosed rectangular field or table cell
//   - line: solid or dotted horizontal baseline rule
//   - free: blank area

export interface DarkMask {
  m: Uint8Array;
  W: number;
  H: number;
}

export interface CombCell {
  x: number;
  w: number;
  brk: boolean;
}

export type DetectedTarget =
  | { kind: 'comb'; cells: CombCell[]; y: number; h: number; tap: number }
  | { kind: 'box'; x: number; y: number; w: number; h: number }
  | { kind: 'line'; x: number; x1: number; y: number }
  | { kind: 'free' };

interface ScannedRule {
  inner: number;
  outer: number;
  a: number;
  b: number;
}

export function makeMask(img: ImageData): DarkMask {
  const { data, width: W, height: H } = img;
  const m = new Uint8Array(W * H);
  for (let i = 0, j = 0; j < m.length; i += 4, j++) {
    m[j] = data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11 < 212 ? 1 : 0;
  }
  return { m, W, H };
}

const at = (M: DarkMask, x: number, y: number): boolean =>
  x >= 0 && y >= 0 && x < M.W && y < M.H && M.m[y * M.W + x] === 1;

function lineAt(
  M: DarkMask,
  x: number,
  y: number,
  minLen: number,
  s: number,
  solid: boolean
): [number, number] | null {
  const g = Math.max(2, Math.round(2.6 * s));
  if (!at(M, x, y)) {
    let f = -1;
    for (let d = 1; d <= g && f < 0; d++) {
      if (at(M, x - d, y)) f = x - d;
      else if (at(M, x + d, y)) f = x + d;
    }
    if (f < 0) return null;
    x = f;
  }
  let a = x;
  let b = x;
  let gap = 0;
  let n = 1;

  for (let xx = x - 1; xx >= 0; xx--) {
    if (at(M, xx, y)) {
      a = xx;
      gap = 0;
      n++;
    } else if (++gap > g) {
      break;
    }
  }
  gap = 0;
  for (let xx = x + 1; xx < M.W; xx++) {
    if (at(M, xx, y)) {
      b = xx;
      gap = 0;
      n++;
    } else if (++gap > g) {
      break;
    }
  }

  const len = b - a + 1;
  if (len < minLen || n < len * 0.17) return null;

  for (const pt of [1.5, 2.5]) {
    const off = Math.max(2, Math.round(pt * s));
    let above = 0;
    let below = 0;
    for (let xx = a; xx <= b; xx++) {
      if (at(M, xx, y - off)) above++;
      if (at(M, xx, y + off)) below++;
    }
    if (Math.max(above, below) > len * 0.25) return null;
  }

  if (solid && n < len * 0.85) return null;
  return [a, b];
}

function scanLine(
  M: DarkMask,
  x: number,
  y: number,
  dir: -1 | 1,
  maxDist: number,
  minLen: number,
  s: number,
  solid: boolean
): ScannedRule | null {
  for (let d = 0; d <= maxDist; d++) {
    const yy = y + dir * d;
    if (yy < 0 || yy >= M.H) return null;
    const r = lineAt(M, x, yy, minLen, s, solid);
    if (r) {
      let y2 = yy;
      while (Math.abs(y2 - yy) < 4 * s && lineAt(M, x, y2 + dir, minLen, s, solid)) {
        y2 += dir;
      }
      return { inner: yy, outer: y2, a: r[0], b: r[1] };
    }
  }
  return null;
}

function cover(M: DarkMask, col: number, T: number, B: number): number {
  let n = 0;
  for (let y = T; y <= B; y++) {
    if (at(M, col, y)) n++;
  }
  return n / (B - T + 1);
}

function scanSide(
  M: DarkMask,
  x: number,
  T: number,
  B: number,
  dir: -1 | 1,
  maxDist: number
): number | null {
  for (let d = 0; d <= maxDist; d++) {
    const c = x + dir * d;
    if (c < 0 || c >= M.W) return null;
    if (cover(M, c, T + 1, B - 1) >= 0.85) return c;
  }
  return null;
}

function combCells(
  M: DarkMask,
  L: number,
  R: number,
  T: number,
  B: number,
  s: number
): { a: number; b: number; brk: boolean }[] | null {
  const h = B - T;
  const w = R - L;
  if (h > 40 * s || w < h * 0.45 || w > h * 1.7) return null;

  const full = (c: number) => cover(M, c, T + 1, B - 1) >= 0.85;
  const topped = (a: number, b: number) => {
    let n = 0;
    for (let x = a; x <= b; x++) {
      if (at(M, x, T) || at(M, x, T - 1) || at(M, x, T + 1)) n++;
    }
    return n >= (b - a + 1) * 0.6;
  };
  const past = (c: number, dir: -1 | 1) => {
    while (c >= 0 && c < M.W && full(c)) c += dir;
    return c;
  };
  const nextEdge = (from: number, dir: -1 | 1, span: number) => {
    for (let d = 0; d <= span; d++) {
      const c = from + dir * d;
      if (c < 0 || c >= M.W) return -1;
      if (full(c)) return c;
    }
    return -1;
  };
  const near = (v: number) => Math.abs(v - w) <= Math.max(2, w * 0.25);

  const cells: { a: number; b: number; brk: boolean }[] = [{ a: L, b: R, brk: false }];

  // Rightwards scan
  let r = R;
  for (let k = 0; k < 80; k++) {
    const e = past(r, 1);
    const n = nextEdge(e, 1, Math.round(w * 5));
    if (n < 0) break;
    const gapW = n - e;
    if (near(gapW) && topped(e, n)) {
      cells.push({ a: e, b: n, brk: false });
      r = n;
      continue;
    }
    if (gapW <= w * 2.2) {
      const e2 = past(n, 1);
      const n2 = nextEdge(e2, 1, Math.round(w * 1.4));
      if (n2 < 0 || !near(n2 - e2) || !topped(e2, n2)) break;
      cells.push({ a: e2, b: n2, brk: gapW > w * 0.45 });
      r = n2;
      continue;
    }
    break;
  }

  // Leftwards scan within group
  let l = L;
  for (let k = 0; k < 80; k++) {
    const e = past(l, -1);
    const n = nextEdge(e, -1, Math.round(w * 1.5));
    if (n < 0) break;
    const gapW = e - n;
    if (near(gapW) && topped(n, e)) {
      cells.unshift({ a: n, b: e, brk: false });
      l = n;
      continue;
    }
    if (gapW <= w * 0.45) {
      const e2 = past(n, -1);
      const n2 = nextEdge(e2, -1, Math.round(w * 1.4));
      if (n2 < 0 || !near(e2 - n2) || !topped(n2, e2)) break;
      cells.unshift({ a: n2, b: e2, brk: false });
      l = n2;
      continue;
    }
    break;
  }

  if (cells.length < 2 && !(w < 24 * s && h < 24 * s)) return null;
  cells[0].brk = false;
  return cells;
}

export function detectAt(
  M: DarkMask,
  s: number,
  xp: number,
  yp: number,
  frame = false,
  inner = false
): DetectedTarget {
  const x = Math.round(xp * s);
  const y = Math.round(yp * s);
  const P = (v: number) => v / s;
  const minLen = Math.round((frame ? 24 : 9) * s);
  const reach = Math.round((frame ? 260 : 150) * s);

  const up = scanLine(M, x, y, -1, reach, minLen, s, frame);
  const dn = scanLine(M, x, y, 1, reach, minLen, s, frame);

  if (up && dn && dn.inner - up.inner >= 7 * s) {
    const T = up.inner;
    const B = dn.inner;
    const L = scanSide(M, x, T, B, -1, Math.round(420 * s));
    const R = scanSide(M, x, T, B, 1, Math.round(420 * s));
    if (L != null && R != null && R - L >= 6 * s) {
      const cells = combCells(M, L, R, T, B, s);
      if (cells) {
        const out: CombCell[] = cells.map((c) => ({
          x: P(c.a + 1),
          w: P(c.b - c.a - 1),
          brk: c.brk,
        }));
        const tap = out.findIndex((c) => xp >= c.x - 1 && xp <= c.x + c.w + 1);
        return {
          kind: 'comb',
          cells: out,
          y: P(T + 1),
          h: P(B - T - 1),
          tap: Math.max(0, tap),
        };
      }
      const slack = 3 * s;
      if (up.a <= L + slack && up.b >= R - slack && dn.a <= L + slack && dn.b >= R - slack) {
        return { kind: 'box', x: P(L + 1), y: P(T + 1), w: P(R - L - 1), h: P(B - T - 1) };
      }
    }
  }

  if (dn && dn.inner - y <= 24 * s) {
    if (!frame && !inner) {
      const r = detectAt(M, s, xp, P(dn.outer) + 4, false, true);
      if (r.kind === 'comb') return r;
    }
    return { kind: 'line', x: P(dn.a), x1: P(dn.b), y: P(dn.inner) };
  }

  if (up && y - up.inner <= 5 * s) {
    return { kind: 'line', x: P(up.a), x1: P(up.b), y: P(up.inner) };
  }

  return { kind: 'free' };
}

export function combLetters(
  text: string,
  cells: CombCell[]
): { letters: string[]; over: boolean } {
  let t = text.toUpperCase();
  const out = new Array<string>(cells.length).fill('');
  const groups = cells.some((c) => c.brk) && /[/.\-]/.test(t);

  if (!groups && t.length > cells.length) {
    const bare = t.replace(/[/.\-]/g, '');
    if (bare.length <= cells.length) t = bare;
  }

  let i = 0;
  for (const ch of t) {
    if (groups && /[/.\-]/.test(ch)) {
      let j = Math.max(0, i - 1) + 1;
      while (j < cells.length && !cells[j].brk) j++;
      i = j;
      continue;
    }
    if (i >= cells.length) return { letters: out, over: true };
    out[i++] = ch === ' ' ? '' : ch;
  }
  return { letters: out, over: false };
}
