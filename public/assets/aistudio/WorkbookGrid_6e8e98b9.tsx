import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  WORKBOOK_DATA,
  fmtCell,
  getEditText,
  getNumberFormat,
  parseCellInput,
  rcFromAddr,
} from '../engine/calculatorAdapter';
import { Book, colL, isErr, type XlScalar, type XlSheetData } from '../engine/xlEngine';

interface WorkbookGridProps {
  book: Book;
  revision: number;
  initialSheet?: string;
  onCommitCell: (sheetName: string, addr: string, value: XlScalar) => void;
  onCommitBatch: (updates: Array<{ sheetName: string; addr: string; value: XlScalar }>) => void;
}

const SHEET_LABELS: Record<string, string> = {
  'IT 2026-27': 'Tax Calculator (IT 2026-27)',
};

let stylesInjected = false;
function ensureWorkbookStyles() {
  if (stylesInjected || typeof document === 'undefined') return;
  stylesInjected = true;
  let css = '';
  WORKBOOK_DATA.styles.forEach((s, i) => {
    let r = `.wb-gridwrap .s${i}{`;
    if (s.fill) r += `background:#${s.fill};`;
    if (s.fg) r += `color:#${s.fg};`;
    if (s.b) r += 'font-weight:700;';
    if (s.i) r += 'font-style:italic;';
    if (s.al && s.al !== 'general') {
      r += `text-align:${s.al === 'centerContinuous' ? 'center' : s.al};`;
    }
    if (s.sz) r += `font-size:${(s.sz * 1.2).toFixed(1)}px;`;
    for (const c of s.bd || []) {
      const side = ({ t: 'top', r: 'right', b: 'bottom', l: 'left' } as Record<string, string>)[c];
      if (side) r += `border-${side}:1px solid #94a3b8;`;
    }
    r += '}';
    css += r;
  });
  const el = document.createElement('style');
  el.setAttribute('data-workbook-styles', '1');
  el.textContent = css;
  document.head.appendChild(el);
}

interface SheetMeta {
  st: Record<string, number>;
  unl: Set<string>;
  hc: Set<number>;
  hr: Set<number>;
  merge: Record<string, { rs: number; cs: number }>;
  cover: Set<string>;
}

function buildMeta(s: XlSheetData): SheetMeta {
  const m: SheetMeta = {
    st: s.st || {},
    unl: new Set(s.unl || []),
    hc: new Set(s.hc || []),
    hr: new Set(s.hr || []),
    merge: {},
    cover: new Set(),
  };
  for (const g of s.merges || []) {
    const [a, b] = g.split(':');
    const pa = /^([A-Z]+)(\d+)$/.exec(a);
    const pb = /^([A-Z]+)(\d+)$/.exec(b);
    if (!pa || !pb) continue;
    const c1 = rcFromAddr(a)[1];
    const r1 = +pa[2];
    const c2 = rcFromAddr(b)[1];
    const r2 = +pb[2];
    let rs = 0;
    let cs = 0;
    for (let r = r1; r <= r2; r++) if (!m.hr.has(r)) rs++;
    for (let c = c1; c <= c2; c++) if (!m.hc.has(c)) cs++;
    m.merge[a] = { rs, cs };
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        if (!(r === r1 && c === c1)) m.cover.add(colL(c) + r);
      }
    }
  }
  return m;
}

const escHtml = (t: string) =>
  String(t)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const WorkbookGrid: React.FC<WorkbookGridProps> = ({
  book,
  revision,
  initialSheet,
  onCommitCell,
  onCommitBatch,
}) => {
  const visibleSheets = useMemo(
    () => WORKBOOK_DATA.sheets.filter((s) => !s.hidden),
    [],
  );
  const orderedSheets = useMemo(() => {
    const main = visibleSheets.find((s) => s.name === 'IT 2026-27');
    const rest = visibleSheets.filter((s) => s.name !== 'IT 2026-27' && s.name !== 'Instructions');
    const instr = visibleSheets.find((s) => s.name === 'Instructions');
    return [main, ...rest, instr].filter((x): x is XlSheetData => Boolean(x));
  }, [visibleSheets]);

  const [activeSheetName, setActiveSheetName] = useState<string>(
    initialSheet && visibleSheets.some((s) => s.name === initialSheet)
      ? initialSheet
      : 'IT 2026-27',
  );

  useEffect(() => {
    if (initialSheet && visibleSheets.some((s) => s.name === initialSheet)) {
      setActiveSheetName(initialSheet);
    }
  }, [initialSheet, visibleSheets]);

  const hostRef = useRef<HTMLDivElement>(null);
  const tdMapRef = useRef<Map<string, HTMLTableCellElement>>(new Map());
  const bookRef = useRef(book);
  bookRef.current = book;
  const commitCellRef = useRef(onCommitCell);
  commitCellRef.current = onCommitCell;
  const commitBatchRef = useRef(onCommitBatch);
  commitBatchRef.current = onCommitBatch;

  const activeSheet = useMemo(
    () => orderedSheets.find((s) => s.name === activeSheetName) || orderedSheets[0],
    [orderedSheets, activeSheetName],
  );

  // Build HTML table and wire interactive inputs + drag-fill whenever active sheet changes
  useEffect(() => {
    ensureWorkbookStyles();
    const host = hostRef.current;
    if (!host || !activeSheet) return;

    const s = activeSheet;
    const m = buildMeta(s);
    const cols: number[] = [];
    for (let c = 1; c <= s.cols; c++) if (!m.hc.has(c)) cols.push(c);
    const wd = cols.map((c) => Math.round((s.cw[String(c)] || 8.43) * 7 + 5));

    let h =
      `<table class="g" style="width:${wd.reduce((a, b) => a + b, 0)}px"><colgroup>` +
      wd.map((w) => `<col style="width:${w}px">`).join('') +
      '</colgroup><tbody>';

    for (let r = 1; r <= s.rows; r++) {
      if (m.hr.has(r)) continue;
      const ht = s.rh[String(r)];
      h += `<tr${ht ? ` style="height:${Math.round(ht * 1.333)}px"` : ''}>`;
      let skip = 0;
      for (let ci = 0; ci < cols.length; ci++) {
        if (skip > 0) {
          skip--;
          continue;
        }
        const c = cols[ci];
        const a = colL(c) + r;
        if (m.cover.has(a)) continue;
        const raw = s.cells[a];
        const isF = typeof raw === 'string' && raw[0] === '=';
        const inp = m.unl.has(a);
        const si = m.st[a];
        const st = si != null ? WORKBOOK_DATA.styles[si] : null;
        let cls = si != null ? `s${si}` : '';
        let span = '';
        const mg = m.merge[a];
        if (mg) {
          if (mg.cs === 0 || mg.rs === 0) continue;
          if (mg.cs > 1) span += ` colspan="${mg.cs}"`;
          if (mg.rs > 1) span += ` rowspan="${mg.rs}"`;
        }
        if (st && st.wr) cls += ' w';
        const dyn = isF || inp;
        if (
          !mg &&
          !inp &&
          !(st && st.wr) &&
          raw != null &&
          (!st || !st.al || st.al === 'left' || st.al === 'general') &&
          (isF || typeof raw === 'string')
        ) {
          const v = isF ? bookRef.current.get(s.name, a) : raw;
          if (typeof v === 'string' && v.length > 6) {
            let k = 0;
            while (ci + k + 1 < cols.length && k < 14) {
              const na = colL(cols[ci + k + 1]) + r;
              if (s.cells[na] != null || m.unl.has(na) || m.cover.has(na) || m.merge[na]) break;
              k++;
            }
            if (k > 0) {
              span += ` colspan="${k + 1}"`;
              skip = k;
            }
          }
        }
        h +=
          `<td${cls ? ` class="${cls.trim()}"` : ''}${span}` +
          `${dyn ? ` data-a="${a}"${inp ? ' data-i="1"' : ''}` : ''}>`;
        if (!dyn) {
          const nf = getNumberFormat(s.name, a);
          h += raw == null ? '' : escHtml(fmtCell(raw as XlScalar, nf));
        }
        h += '</td>';
      }
      h += '</tr>';
    }
    h += '</tbody></table>';
    host.innerHTML = h;

    const tds = Array.from(host.querySelectorAll<HTMLTableCellElement>('td[data-a]'));
    const tdMap = new Map<string, HTMLTableCellElement>(tds.map((x) => [x.dataset.a!, x]));
    tdMapRef.current = tdMap;
    const inputs: Array<HTMLInputElement | HTMLSelectElement> = [];
    const dv = s.dv || {};

    const srcVal = (addr: string): XlScalar => {
      const [r, c] = rcFromAddr(addr);
      const raw = bookRef.current.raw(s.name, r, c);
      if (typeof raw === 'string' && raw[0] === '=') return bookRef.current.get(s.name, addr);
      return raw === undefined ? null : raw;
    };

    const fillFrom = (addr: string, k: string) => {
      const [r, c] = rcFromAddr(addr);
      let t: HTMLTableCellElement | undefined;
      if (k === 'd') {
        for (let rr = r - 1; rr >= 1 && !t; rr--) {
          const cand = tdMap.get(colL(c) + rr);
          if (cand && cand.dataset.i) t = cand;
        }
      } else {
        for (let cc = c - 1; cc >= 1 && !t; cc--) {
          const cand = tdMap.get(colL(cc) + r);
          if (cand && cand.dataset.i) t = cand;
        }
      }
      if (!t) return;
      const el = tdMap.get(addr)?.firstElementChild as HTMLInputElement | HTMLSelectElement | null;
      el?.blur();
      commitCellRef.current(s.name, addr, srcVal(t.dataset.a!));
      el?.focus();
    };

    for (const td of tds) {
      if (!td.dataset.i) continue;
      const a = td.dataset.a!;
      const nf = getNumberFormat(s.name, a);
      let el: HTMLInputElement | HTMLSelectElement;
      if (dv[a]) {
        const sel = document.createElement('select');
        for (const o of ['', ...dv[a]]) {
          const op = document.createElement('option');
          op.value = o;
          op.textContent = o;
          sel.appendChild(op);
        }
        el = sel;
      } else {
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.autocomplete = 'off';
        inp.inputMode = nf ? 'decimal' : 'text';
        el = inp;
      }
      el.dataset.a = a;
      td.appendChild(el);
      inputs.push(el);

      el.addEventListener('focus', () => {
        if (el instanceof HTMLInputElement) {
          el.value = getEditText(bookRef.current, s.name, a);
          el.select();
        }
      });

      const done = () => {
        const raw = el.value;
        if (el instanceof HTMLInputElement && String(raw).trim() === getEditText(bookRef.current, s.name, a)) {
          return;
        }
        const v = parseCellInput(s.name, a, raw);
        commitCellRef.current(s.name, a, v);
      };

      el.addEventListener('change', done);
      el.addEventListener('blur', () => {
        if (el instanceof HTMLInputElement) {
          el.value = fmtCell(bookRef.current.get(s.name, a), nf);
        }
      });
      el.addEventListener('keydown', (e: Event) => {
        const ke = e as KeyboardEvent;
        if ((ke.ctrlKey || ke.metaKey) && (ke.key === 'd' || ke.key === 'r')) {
          ke.preventDefault();
          fillFrom(a, ke.key);
          return;
        }
        if (ke.key === 'Enter') {
          ke.preventDefault();
          el.blur();
          const colLetter = a.replace(/\d+/g, '');
          const colInputs = inputs.filter((x) => (x.dataset.a || '').replace(/\d+/g, '') === colLetter);
          const idx = colInputs.indexOf(el);
          const nx = colInputs[idx + 1] || colInputs[idx];
          nx?.focus();
        }
      });
    }

    // Drag-to-fill corner handle
    const handle = document.createElement('div');
    handle.className = 'fh';
    handle.title = 'Drag across or down to copy value';
    host.appendChild(handle);

    let curTd: HTMLTableCellElement | null = null;
    let dragState: {
      a: string;
      pt: [number, number];
      list: HTMLTableCellElement[];
      timer: number;
    } | null = null;
    let hideTimer: number | undefined;

    const place = (td: HTMLTableCellElement) => {
      const r = td.getBoundingClientRect();
      const g = host.getBoundingClientRect();
      handle.style.left = `${r.right - g.left + host.scrollLeft - 6}px`;
      handle.style.top = `${r.bottom - g.top + host.scrollTop - 6}px`;
      handle.style.display = 'block';
    };

    const clearSel = () => host.querySelectorAll('td.fsel').forEach((x) => x.classList.remove('fsel'));

    const targets = (td: HTMLTableCellElement): HTMLTableCellElement[] => {
      if (!dragState) return [];
      const [sr, sc] = rcFromAddr(dragState.a);
      const [tr, tc] = rcFromAddr(td.dataset.a!);
      const out: HTMLTableCellElement[] = [];
      if (Math.abs(tr - sr) >= Math.abs(tc - sc)) {
        const st = tr > sr ? 1 : -1;
        for (let r = sr + st; st > 0 ? r <= tr : r >= tr; r += st) {
          const x = tdMap.get(colL(sc) + r);
          if (x && x.dataset.i) out.push(x);
        }
      } else {
        const st = tc > sc ? 1 : -1;
        for (let c = sc + st; st > 0 ? c <= tc : c >= tc; c += st) {
          const x = tdMap.get(colL(c) + sr);
          if (x && x.dataset.i) out.push(x);
        }
      }
      return out;
    };

    const upd = () => {
      if (!dragState) return;
      const el = document.elementFromPoint(dragState.pt[0], dragState.pt[1]);
      const td = el?.closest?.('td[data-a]') as HTMLTableCellElement | null;
      if (!td || !host.contains(td)) return;
      clearSel();
      dragState.list = targets(td);
      dragState.list.forEach((x) => x.classList.add('fsel'));
    };

    const autoScroll = () => {
      if (!dragState) return;
      const g = host.getBoundingClientRect();
      const [x, y] = dragState.pt;
      if (y > g.bottom - 28) host.scrollTop += 22;
      else if (y < g.top + 28) host.scrollTop -= 22;
      if (x > g.right - 28) host.scrollLeft += 22;
      else if (x < g.left + 28) host.scrollLeft -= 22;
      upd();
    };

    const onFocusIn = (e: FocusEvent) => {
      const td = (e.target as HTMLElement | null)?.closest?.('td[data-i]') as HTMLTableCellElement | null;
      if (!td) return;
      window.clearTimeout(hideTimer);
      curTd = td;
      place(td);
    };
    const onFocusOut = () => {
      hideTimer = window.setTimeout(() => {
        if (!dragState) handle.style.display = 'none';
      }, 200);
    };
    const onScroll = () => {
      if (curTd && handle.style.display === 'block') place(curTd);
    };
    const onPointerDown = (e: PointerEvent) => {
      if (!curTd) return;
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      dragState = {
        a: curTd.dataset.a!,
        pt: [e.clientX, e.clientY],
        list: [],
        timer: window.setInterval(autoScroll, 50),
      };
      const f = curTd.firstElementChild as HTMLInputElement | HTMLSelectElement | null;
      if (f && f.tagName === 'INPUT') f.blur();
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragState) return;
      dragState.pt = [e.clientX, e.clientY];
      upd();
    };
    const onPointerEnd = () => {
      if (!dragState) return;
      window.clearInterval(dragState.timer);
      const d = dragState;
      dragState = null;
      clearSel();
      if (d.list.length) {
        const v = srcVal(d.a);
        commitBatchRef.current(
          d.list.map((x) => ({ sheetName: s.name, addr: x.dataset.a!, value: v })),
        );
      }
      if (curTd) {
        place(curTd);
        const f = curTd.firstElementChild as HTMLInputElement | HTMLSelectElement | null;
        f?.focus();
      }
    };

    host.addEventListener('focusin', onFocusIn);
    host.addEventListener('focusout', onFocusOut);
    host.addEventListener('scroll', onScroll);
    handle.addEventListener('pointerdown', onPointerDown);
    handle.addEventListener('pointermove', onPointerMove);
    handle.addEventListener('pointerup', onPointerEnd);
    handle.addEventListener('pointercancel', onPointerEnd);

    return () => {
      window.clearTimeout(hideTimer);
      if (dragState) window.clearInterval(dragState.timer);
      host.removeEventListener('focusin', onFocusIn);
      host.removeEventListener('focusout', onFocusOut);
      host.removeEventListener('scroll', onScroll);
      handle.removeEventListener('pointerdown', onPointerDown);
      handle.removeEventListener('pointermove', onPointerMove);
      handle.removeEventListener('pointerup', onPointerEnd);
      handle.removeEventListener('pointercancel', onPointerEnd);
    };
  }, [activeSheet]);

  // Refresh cell values when revision or active sheet updates
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !activeSheet) return;
    const tds = Array.from(host.querySelectorAll<HTMLTableCellElement>('td[data-a]'));
    for (const td of tds) {
      const a = td.dataset.a!;
      const v = book.get(activeSheet.name, a);
      const nf = getNumberFormat(activeSheet.name, a);
      const el = td.firstElementChild;
      const stIdx = activeSheet.st[a];
      const hasAlign = stIdx != null && Boolean(WORKBOOK_DATA.styles[stIdx]?.al);
      if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) {
        if (document.activeElement !== el) {
          if (el instanceof HTMLSelectElement) {
            const sv = v == null ? '' : String(v);
            if (sv && !Array.from(el.options).some((o) => o.value === sv)) {
              const op = document.createElement('option');
              op.value = sv;
              op.textContent = sv;
              el.appendChild(op);
            }
            el.value = sv;
          } else {
            el.value = fmtCell(v, nf);
          }
        }
        if (!hasAlign) td.style.textAlign = typeof v === 'string' ? 'left' : 'right';
      } else {
        const text = fmtCell(v, nf);
        if (td.textContent !== text) td.textContent = text;
        td.classList.toggle('err', isErr(v));
        if (!hasAlign) td.style.textAlign = typeof v === 'string' ? 'left' : 'right';
      }
    }
  }, [book, revision, activeSheet]);

  return (
    <div className="space-y-3">
      {/* Sheet Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-2.5 dark:border-slate-800">
        {orderedSheets.map((sheet) => {
          const isActive = sheet.name === activeSheet?.name;
          return (
            <button
              key={sheet.name}
              type="button"
              onClick={() => setActiveSheetName(sheet.name)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                isActive
                  ? 'border border-slate-700 bg-orange-500 text-white shadow-[2px_2px_0px_#334155]'
                  : 'border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {SHEET_LABELS[sheet.name] || sheet.name}
            </button>
          );
        })}
      </div>

      {/* Hint bar */}
      <p className="text-xs text-slate-600 dark:text-slate-400">
        {activeSheet?.name === 'IT 2026-27'
          ? 'Enter numbers in the orange-outlined input cells. Press Enter to move down a column, Ctrl+D / Ctrl+R to fill from above/left, or drag the orange corner square across/down. All figures recalculate live.'
          : `Viewing "${SHEET_LABELS[activeSheet?.name || ''] || activeSheet?.name}" workbook sheet. Editable cells recalculate across the entire tax summary automatically.`}
      </p>

      {/* Grid Host */}
      <div ref={hostRef} className="wb-gridwrap" />
    </div>
  );
};
