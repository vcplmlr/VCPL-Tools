// Form Filler: type, tick, date, sign and add a photo to any PDF form on your phone, then save or send it.
// Nothing leaves the device. Pages are drawn with pdf.js; what you add is written into the original PDF with pdf-lib
// (so the form's own text stays sharp). A PDF with a password, or a photo of a paper form, is saved as page pictures.
import { makeMask, detectAt, combLetters } from './detect.js';

const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
const PDFLIB = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';
const MAX_PAGES = 60, MASK_SCALE = 2, FONT = 'Arimo';
const INKS = [{ name: 'Black', c: '#111418' }, { name: 'Blue', c: '#1D3FB0' }];
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const fmt = b => b >= 1e6 ? `${(b / 1e6).toFixed(2)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`;
const uid = () => Math.random().toString(36).slice(2, 10);

export const S = {
  name: '', kind: '', bytes: null, doc: null, password: null, imgSrc: null, pages: [], items: [], images: {},
  sel: null, editing: null, tool: 'text', ink: 0, zoom: 1, undo: [], masks: new Map(), demo: false,
};

// ---------------------------------------------------------------- small helpers
function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)?.dataset.ok) return res();
    const s = document.createElement('script'); s.src = src;
    s.onload = () => { s.dataset.ok = 1; res(); };
    s.onerror = () => rej(new Error('This needs the internet the first time. Check your connection and try again.'));
    document.head.appendChild(s);
  });
}
async function pdfjs() {
  await loadScript(PDFJS + 'pdf.min.js');
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js';
  return window.pdfjsLib;
}
let toastT;
function toast(t, ms = 2600) { const el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, ms); }
function busy(t) { $('busy').hidden = !t; if (t) $('busyText').textContent = t; }
function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("That picture can't be opened here. Try a JPG or a screenshot of it.")); i.src = src; }); }
function fileToImg(file) { const u = URL.createObjectURL(file); return loadImg(u).finally(() => setTimeout(() => URL.revokeObjectURL(u), 1000)); }
const today = () => { const d = new Date(); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; };
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
};

// session kept in IndexedDB, so a phone that reloads the tab (it happens when the camera opens) doesn't lose the form
const idb = {
  db: null,
  open() { return this.db ??= new Promise((res, rej) => { const r = indexedDB.open('formfiller', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
  async get(k) { try { const db = await this.open(); return await new Promise(res => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(null); }); } catch { return null; } },
  async put(k, v) { try { const db = await this.open(); db.transaction('kv', 'readwrite').objectStore('kv').put(v, k); } catch { /* private mode: no session */ } },
  async del(k) { try { const db = await this.open(); db.transaction('kv', 'readwrite').objectStore('kv').delete(k); } catch { } },
};
let saveT;
function saveSession() {
  if (S.demo) return;
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    const used = new Set(S.items.filter(i => i.type === 'img').map(i => i.imgId)), images = {};
    for (const id of used) images[id] = S.images[id].src;
    idb.put('session', { name: S.name, kind: S.kind, bytes: S.bytes, imgSrc: S.imgSrc, items: S.items, images, at: Date.now() });
  }, 600);
}

// ---------------------------------------------------------------- opening
async function openFile(file) {
  try {
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) await openPdf(new Uint8Array(await file.arrayBuffer()), file.name);
    else if (file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic)$/i.test(file.name)) await openImage(await fileToImg(file), file.name);
    else toast("That isn't a PDF or a photo.");
  } catch (e) { busy(''); toast(e.message || "That file can't be opened.", 4000); }
}

function askPassword(wrong) {
  return new Promise((res, rej) => {
    $('pwSay').textContent = wrong ? "That password didn't work. Try again." : "Type its password to open it. It's only used on this phone.";
    $('pw').value = ''; $('pwSheet').hidden = false; setTimeout(() => $('pw').focus(), 50);
    const done = ok => { $('pwSheet').hidden = true; $('pwGo').onclick = $('pwCancel').onclick = $('pw').onkeydown = null; ok ? res($('pw').value) : rej(new Error('cancel')); };
    $('pwGo').onclick = () => done(true); $('pwCancel').onclick = () => done(false);
    $('pw').onkeydown = e => { if (e.key === 'Enter') done(true); };
  });
}

async function openPdf(bytes, name, items = [], images = {}) {
  busy('Opening the form');
  const lib = await pdfjs();
  const task = lib.getDocument({ data: bytes.slice(), isEvalSupported: false });
  let password = null, cancelled = false;
  task.onPassword = (give, reason) => { busy(''); askPassword(reason === 2).then(pw => { password = pw; busy('Opening the form'); give(pw); }).catch(() => { cancelled = true; task.destroy(); }); };
  let doc;
  try { doc = await task.promise; } catch (e) { busy(''); if (cancelled) return; throw new Error("This PDF can't be opened. It may be damaged."); }
  if (doc.numPages > MAX_PAGES) { busy(''); throw new Error(`This PDF has ${doc.numPages} pages. Form Filler handles up to ${MAX_PAGES}.`); }
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i), vp = page.getViewport({ scale: 1 });
    pages.push({ i: i - 1, page, vp, w: vp.width, h: vp.height });
  }
  Object.assign(S, { name, kind: 'pdf', bytes, doc, password, imgSrc: null, pages, items, images: {}, undo: [], sel: null, editing: null });
  S.masks.clear();
  for (const [id, src] of Object.entries(images)) S.images[id] = { src, img: await loadImg(src) };
  busy(''); showEditor();
}

// a photo of a paper form: shadows removed, paper lifted to white, then it's a one-page form
async function openImage(img, name, items = [], images = {}, clean = true) {
  busy('Cleaning up the photo');
  const cap = 2200, s = Math.min(1, cap / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
  if (clean) cleanPaper(c);
  const src = c.toDataURL('image/jpeg', 0.9), pic = await loadImg(src), w = 595.28, h = w * c.height / c.width;
  Object.assign(S, { name: name.replace(/\.[^.]+$/, '') + '.pdf', kind: 'image', bytes: null, doc: null, password: null, imgSrc: src, pic,
    pages: [{ i: 0, w, h }], items, images: {}, undo: [], sel: null, editing: null });
  S.masks.clear();
  for (const [id, s2] of Object.entries(images)) S.images[id] = { src: s2, img: await loadImg(s2) };
  busy(''); showEditor();
}

// divide by the local paper brightness (removes shadows), then lift the paper to white
function cleanPaper(c) {
  const W = c.width, H = c.height, k = Math.max(8, Math.round(Math.max(W, H) / 24));
  const small = document.createElement('canvas'); small.width = Math.max(1, Math.round(W / k)); small.height = Math.max(1, Math.round(H / k));
  const sg = small.getContext('2d'); sg.imageSmoothingQuality = 'high'; sg.drawImage(c, 0, 0, small.width, small.height);
  const sd = sg.getImageData(0, 0, small.width, small.height), src = sd.data.slice(), sw = small.width, sh = small.height;
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    let r = 0, gg = 0, b = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const yy = clamp(y + dy, 0, sh - 1), xx = clamp(x + dx, 0, sw - 1), i = (yy * sw + xx) * 4;
      r = Math.max(r, src[i]); gg = Math.max(gg, src[i + 1]); b = Math.max(b, src[i + 2]);
    }
    const i = (y * sw + x) * 4; sd.data[i] = r; sd.data[i + 1] = gg; sd.data[i + 2] = b;
  }
  sg.putImageData(sd, 0, 0);
  const bgc = document.createElement('canvas'); bgc.width = W; bgc.height = H;
  const bg = bgc.getContext('2d'); bg.imageSmoothingQuality = 'high'; bg.drawImage(small, 0, 0, W, H);
  const g = c.getContext('2d'), im = g.getImageData(0, 0, W, H), d = im.data, p = bg.getImageData(0, 0, W, H).data;
  for (let i = 0; i < d.length; i += 4) for (let ch = 0; ch < 3; ch++) {
    const r = d[i + ch] / Math.max(24, p[i + ch]);
    d[i + ch] = r >= 0.86 ? 255 : Math.max(0, Math.round(255 * Math.pow(r / 0.86, 2.2)));
  }
  g.putImageData(im, 0, 0);
}

// ---------------------------------------------------------------- page drawing
let observer;
function showEditor() {
  $('land').hidden = true; $('ed').hidden = false; $('fname').textContent = S.name;
  const box = $('pages'); box.innerHTML = '';
  observer?.disconnect();
  observer = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) renderPage(S.pages[+e.target.dataset.i]); }), { rootMargin: '600px 0px' });
  for (const p of S.pages) {
    const el = document.createElement('div'); el.className = 'page'; el.dataset.i = p.i;
    el.innerHTML = `${S.pages.length > 1 ? `<span class="num">Page ${p.i + 1} of ${S.pages.length}</span>` : ''}<canvas class="pdf"></canvas><canvas class="ink"></canvas>`;
    Object.assign(p, { el, cv: el.querySelector('.pdf'), ink: el.querySelector('.ink'), drawn: 0 });
    box.appendChild(el); observer.observe(el);
  }
  layout(); setTool(S.tool); updateUndo(); hint();
  window.scrollTo(0, 0);
}
function layout() {
  const avail = Math.min(920, document.documentElement.clientWidth - 16);
  for (const p of S.pages) {
    p.css = avail * S.zoom / p.w;
    p.el.style.width = `${p.w * p.css}px`; p.el.style.height = `${p.h * p.css}px`;
    if (p.drawn) renderPage(p);
  }
  placeSel();
}
async function renderPage(p) {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  let scale = p.css * dpr;
  scale = Math.min(scale, 4096 / p.w, Math.sqrt(16e6 / (p.w * p.h)));
  if (Math.abs((p.drawn || 0) - scale) < 0.01) return;
  p.drawn = scale;
  const W = Math.round(p.w * scale), H = Math.round(p.h * scale);
  if (S.kind === 'pdf') {
    const off = document.createElement('canvas'); off.width = W; off.height = H;
    p.task?.cancel();
    p.task = p.page.render({ canvasContext: off.getContext('2d'), viewport: p.page.getViewport({ scale }) });
    try { await p.task.promise; } catch { return; }
    if (p.drawn !== scale) return;
    p.cv.width = W; p.cv.height = H; p.cv.getContext('2d').drawImage(off, 0, 0);
  } else {
    p.cv.width = W; p.cv.height = H;
    const g = p.cv.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(S.pic, 0, 0, W, H);
  }
  p.ink.width = W; p.ink.height = H; drawInk(p);
  if (!S.masks.has(p.i)) setTimeout(() => maskFor(p).catch(() => { }), 250);    // ready before the first tap
}
function drawInk(p) {
  if (!p.ink || !p.ink.width) return;
  const g = p.ink.getContext('2d'), k = p.ink.width / p.w;
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, p.ink.width, p.ink.height); g.setTransform(k, 0, 0, k, 0, 0);
  for (const it of S.items) if (it.page === p.i) drawItem(g, it);
}
const redraw = it => { const p = S.pages[it?.page]; if (p) drawInk(p); };
const redrawAll = () => S.pages.forEach(drawInk);

// one renderer for the screen, page pictures and the demo. Units: points, from the page's top-left.
function drawItem(g, it) {
  g.save(); g.fillStyle = g.strokeStyle = it.ink || INKS[0].c;
  if (it.type === 'text') {
    if (it.text) { g.font = `${it.size}px ${FONT}, Arial, Helvetica, sans-serif`; g.textBaseline = 'alphabetic'; g.fillText(it.text, it.x, it.y); }
  } else if (it.type === 'comb') {
    const { letters } = combLetters(it.text, it.cells);
    g.font = `${it.size}px ${FONT}, Arial, Helvetica, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    letters.forEach((ch, i) => { if (ch) { const c = it.cells[i]; g.fillText(ch, c.x + c.w / 2, it.y + it.h / 2 + it.size * 0.36); } });
  } else if (it.type === 'mark') {
    g.lineWidth = Math.max(0.9, it.w * 0.13); g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath();
    for (const [a, b] of markLines(it)) { g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); }
    g.stroke();
  } else if (it.type === 'img') {
    const im = S.images[it.imgId]?.img; if (im) { g.imageSmoothingQuality = 'high'; g.drawImage(im, it.x, it.y, it.w, it.h); }
  }
  g.restore();
}
function markLines(it) {
  const { x, y, w, h } = it;
  if (it.glyph === 'cross') return [[[x + w * 0.2, y + h * 0.2], [x + w * 0.8, y + h * 0.8]], [[x + w * 0.8, y + h * 0.2], [x + w * 0.2, y + h * 0.8]]];
  return [[[x + w * 0.16, y + h * 0.54], [x + w * 0.4, y + h * 0.78]], [[x + w * 0.4, y + h * 0.78], [x + w * 0.86, y + h * 0.2]]];
}
const measurer = document.createElement('canvas').getContext('2d');
function textW(text, size) { measurer.font = `${size}px ${FONT}, Arial, Helvetica, sans-serif`; return measurer.measureText(text).width; }
function bbox(it) {
  if (it.type === 'text') { const w = Math.max(18, textW(it.text || 'M', it.size)); return { x: it.x - 2, y: it.y - it.size * 0.92, w: w + 4, h: it.size * 1.22 }; }
  if (it.type === 'comb') { const a = it.cells[0], b = it.cells[it.cells.length - 1]; return { x: a.x - 1, y: it.y - 1, w: b.x + b.w - a.x + 2, h: it.h + 2 }; }
  return { x: it.x, y: it.y, w: it.w, h: it.h };
}

// ---------------------------------------------------------------- items + undo
function snapshot() { S.undo.push(JSON.stringify(S.items)); if (S.undo.length > 80) S.undo.shift(); updateUndo(); }
function updateUndo() { $('undo').disabled = !S.undo.length; }
function undo() {
  if (!S.undo.length) return;
  endEdit(false); select(null);
  S.items = JSON.parse(S.undo.pop()); updateUndo(); redrawAll(); saveSession();
}
function add(it) { snapshot(); it.id = uid(); it.ink ??= INKS[S.ink].c; S.items.push(it); redraw(it); saveSession(); return it; }
function remove(it) { S.items = S.items.filter(x => x !== it); redraw(it); saveSession(); }
function hitTest(p, x, y) {
  for (let k = S.items.length - 1; k >= 0; k--) {
    const it = S.items[k]; if (it.page !== p.i) continue;
    const b = bbox(it), pad = it.type === 'comb' ? 0 : 3;
    if (x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad) {
      if (it.type === 'comb') { const ok = it.cells.some(c => x >= c.x - 1 && x <= c.x + c.w + 1); if (!ok) continue; }
      return it;
    }
  }
  return null;
}

// ---------------------------------------------------------------- detection masks (what's printed on the page)
// cached as promises, so a tap during the background build waits for it instead of starting another
function maskFor(p) {
  if (S.masks.has(p.i)) { const m = S.masks.get(p.i); S.masks.delete(p.i); S.masks.set(p.i, m); return m; }
  const m = buildMask(p).catch(e => { S.masks.delete(p.i); throw e; });
  S.masks.set(p.i, m); if (S.masks.size > 6) S.masks.delete(S.masks.keys().next().value);
  return m;
}
async function buildMask(p) {
  const W = Math.round(p.w * MASK_SCALE), H = Math.round(p.h * MASK_SCALE), c = document.createElement('canvas');
  c.width = W; c.height = H; const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  if (S.kind === 'pdf') await p.page.render({ canvasContext: g, viewport: p.page.getViewport({ scale: MASK_SCALE }), intent: 'print' }).promise;
  else g.drawImage(S.pic, 0, 0, W, H);
  return makeMask(g.getImageData(0, 0, W, H));
}
async function detect(p, x, y, frame) { try { return detectAt(await maskFor(p), MASK_SCALE, x, y, frame); } catch { return { kind: 'free' }; } }

// ---------------------------------------------------------------- tapping the page
function pagePoint(p, cx, cy) { const r = p.el.getBoundingClientRect(); return [(cx - r.left) / p.css, (cy - r.top) / p.css]; }
$('pages').addEventListener('click', e => {
  const el = e.target.closest('.page'); if (!el || e.target.closest('.sel')) return;
  const p = S.pages[+el.dataset.i], [x, y] = pagePoint(p, e.clientX, e.clientY);
  tapAt(p, x, y);
});
export async function tapAt(p, x, y) {
  const hit = hitTest(p, x, y);
  if (hit) {
    if (hit.type === 'text' || hit.type === 'comb') { openBar(); startEdit(hit); } else { endEdit(); select(hit); }
    return;
  }
  // phones only open the keyboard for a field that's visible and focused inside the tap itself, so show it now
  const typing = S.tool === 'text' || S.tool === 'date';
  if (typing) { openBar(); $('field').value = ''; }
  endEdit(true, typing); select(null);
  return createAt(p, x, y);
}
function openBar() { $('tools').hidden = true; $('typing').hidden = false; if (!S.demo) $('field').focus(); placeDock(); }
export async function createAt(p, x, y, tool = S.tool) {
  if (tool === 'sign' || tool === 'photo') {
    const d = await detect(p, x, y, true), box = d.kind === 'box' && d.w > 30 && d.h > 20 ? d : null;
    return tool === 'sign' ? openSign({ p, x, y, box }) : openPhoto({ p, x, y, box });
  }
  const d = await detect(p, x, y, false);
  if (tool === 'tick' || tool === 'cross') {
    let b = null;
    if (d.kind === 'comb') { const c = d.cells[d.tap]; b = { x: c.x, y: d.y, w: c.w, h: d.h }; }
    else if (d.kind === 'box' && d.w < 40 && d.h < 40) b = d;
    const sz = b ? Math.min(b.w, b.h) * 0.92 : 12, cx = b ? b.x + b.w / 2 : x, cy = b ? b.y + b.h / 2 : y;
    const it = add({ type: 'mark', glyph: tool, page: p.i, x: cx - sz / 2, y: cy - sz / 2, w: sz, h: sz });
    select(it); return it;
  }
  let it;
  if (d.kind === 'comb') {
    const minW = Math.min(...d.cells.map(c => c.w));
    it = { type: 'comb', page: p.i, cells: d.cells, y: d.y, h: d.h, size: +Math.min(d.h * 0.64, minW * 0.9).toFixed(2), text: '' };
  } else if (d.kind === 'box') {
    const base = clamp(d.h * 0.52, 7, 12), tall = d.h > base * 2.6;
    it = { type: 'text', page: p.i, x: d.x + clamp(d.w * 0.04, 2.5, 5), y: tall ? d.y + base * 1.35 : d.y + d.h / 2 + base * 0.36, size: base, base, maxW: d.w - 6, text: '' };
  } else if (d.kind === 'line') {
    const len = d.x1 - d.x, start = len > 240 && x - d.x > 180 ? x - 4 : d.x + 2;
    it = { type: 'text', page: p.i, x: start, y: d.y - 2.2, size: 11, base: 11, maxW: d.x1 - start - 2, text: '' };
  } else {
    it = { type: 'text', page: p.i, x: x - 3, y: y + 4, size: 11, base: 11, text: '' };
  }
  if (tool === 'date') { it.text = today(); setTool('text'); }
  add(it); select(it); startEdit(it, true);
  return it;
}

// ---------------------------------------------------------------- selection box (move, resize, delete)
const sel = document.createElement('div'); sel.className = 'sel';
sel.innerHTML = `<button class="del" type="button" aria-label="Delete">×</button><button class="grow" type="button" aria-label="Resize"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 11l6-6M7 11h4V7"/></svg></button>`;
function select(it) { S.sel = it; placeSel(); }
function placeSel() {
  const it = S.sel;
  if (!it || !S.items.includes(it)) { S.sel = null; sel.remove(); return; }
  const p = S.pages[it.page], b = bbox(it), pad = 3;
  if (sel.parentNode !== p.el) p.el.appendChild(sel);
  Object.assign(sel.style, { left: `${(b.x) * p.css - pad}px`, top: `${(b.y) * p.css - pad}px`, width: `${b.w * p.css + pad * 2}px`, height: `${b.h * p.css + pad * 2}px` });
  sel.classList.toggle('edit', S.editing === it); sel.classList.toggle('fixed', it.type === 'comb');
  sel.querySelector('.grow').hidden = it.type === 'comb' || S.editing === it;   // while typing, the bar has everything
  sel.querySelector('.del').hidden = S.editing === it;
}
sel.querySelector('.del').addEventListener('click', e => { e.stopPropagation(); const it = S.sel; if (!it) return; snapshot(); endEdit(false); remove(it); select(null); });
let drag = null;
sel.addEventListener('pointerdown', e => {
  if (e.target.closest('.del')) return;
  const it = S.sel; if (!it) return;
  e.preventDefault(); sel.setPointerCapture(e.pointerId);
  const grow = !!e.target.closest('.grow'), b = bbox(it);
  drag = { it, grow, sx: e.clientX, sy: e.clientY, moved: false, start: JSON.stringify(it), b, x: it.x, y: it.y, w: it.w, h: it.h, size: it.size, base: it.base };
});
sel.addEventListener('pointermove', e => {
  if (!drag) return;
  const p = S.pages[drag.it.page], dx = (e.clientX - drag.sx) / p.css, dy = (e.clientY - drag.sy) / p.css, it = drag.it;
  if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 5) return;
  if (!drag.moved) { drag.moved = true; S.undo.push(JSON.stringify(S.items.map(x => x === it ? JSON.parse(drag.start) : x))); updateUndo(); }
  if (it.type === 'comb') return;
  if (drag.grow) {
    const f = clamp((drag.b.w + dx) / drag.b.w, 0.2, 8);
    if (it.type === 'text') { it.size = clamp(drag.size * f, 4, 60); it.base = it.size; delete it.maxW; }
    else { it.w = Math.max(6, drag.w * f); it.h = Math.max(6, drag.h * f); }
  } else { it.x = drag.x + dx; it.y = drag.y + dy; }
  redraw(it); placeSel();
});
sel.addEventListener('pointerup', () => {
  if (!drag) return;
  const { it, moved } = drag; drag = null;
  if (moved) { saveSession(); return; }
  if (it.type === 'text' || it.type === 'comb') startEdit(it);
});

// ---------------------------------------------------------------- typing bar
function startEdit(it, fresh = false) {
  if (S.editing && S.editing !== it) endEdit(true, true);
  if (!fresh && S.editing !== it) snapshot();
  S.editing = it; select(it);
  $('tools').hidden = true; $('typing').hidden = false;
  const f = $('field');
  if (fresh && f.value) { it.text = f.value; redraw(it); }          // typed before the boxes were found: keep it
  f.value = it.text; f.autocapitalize = it.type === 'comb' ? 'characters' : 'sentences';
  f.inputMode = /^\d\d\/\d\d\/\d{4}$/.test(it.text) ? 'text' : 'text';
  chips(); fit(it); placeDock();
  if (!S.demo) { f.focus(); const n = f.value.length; try { f.setSelectionRange(n, n); } catch { } }
  setTimeout(() => scrollToItem(it), 250);
}
export function typeInto(it, text) { it.text = text; fit(it); redraw(it); placeSel(); if (S.editing === it) $('field').value = text; }
function fit(it) {
  if (it.type === 'text' && it.maxW && it.text) {
    const w = textW(it.text, it.base); it.size = w > it.maxW ? Math.max(5, it.base * it.maxW / w) : it.base;
  }
  const warn = $('warn');
  if (it.type === 'comb') {
    const over = combLetters(it.text, it.cells).over;
    warn.hidden = !over; warn.textContent = over ? `Only ${it.cells.length} boxes here. The rest won't show.` : '';
  } else warn.hidden = true;
}
// stay: another field is about to be typed in, so keep the bar (and the keyboard) up
function endEdit(keep = true, stay = false) {
  const it = S.editing;
  if (!stay) { $('typing').hidden = true; $('tools').hidden = false; $('field').blur(); }
  if (!it) { placeDock(); return; }
  S.editing = null;
  if (!it.text.trim()) { S.items = S.items.filter(x => x !== it); redraw(it); if (S.sel === it) select(null); }
  else if (keep) placeSel();
  placeDock(); saveSession();
}
function scrollToItem(it) {
  const p = S.pages[it.page], b = bbox(it), r = p.el.getBoundingClientRect(), vv = window.visualViewport;
  const top = r.top + b.y * p.css, bottom = r.top + (b.y + b.h) * p.css, visible = (vv ? vv.height : innerHeight) - $('typing').offsetHeight - 10;
  if (bottom > visible || top < 70) window.scrollBy({ top: top - Math.min(visible * 0.4, 180), behavior: 'smooth' });
}
$('field').addEventListener('input', () => { const it = S.editing; if (it) { it.text = $('field').value; fit(it); redraw(it); placeSel(); } });
$('field').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); endEdit(); select(null); } });
$('doneTyping').addEventListener('click', () => { endEdit(); select(null); });
$('smaller').addEventListener('click', () => resizeText(1 / 1.12));
$('bigger').addEventListener('click', () => resizeText(1.12));
function resizeText(f) { const it = S.editing; if (!it) return; it.size = clamp(it.size * f, 4, 60); it.base = it.size; if (it.type === 'text') delete it.maxW; redraw(it); placeSel(); $('field').focus(); }

// keep the bar above the phone keyboard
function placeDock() {
  const vv = window.visualViewport, dock = document.querySelector('.dock');
  if (!vv) return;
  const gap = Math.max(0, innerHeight - vv.height - vv.offsetTop);
  dock.style.transform = gap > 40 && S.editing ? `translateY(${-gap}px)` : '';
}
window.visualViewport?.addEventListener('resize', placeDock);
window.visualViewport?.addEventListener('scroll', placeDock);

// ---------------------------------------------------------------- my details
const FIELDS = [['name', 'Full name', 1], ['father', "Father's name"], ['mother', "Mother's name"], ['dob', 'Date of birth', 0, 'DD/MM/YYYY'],
  ['mobile', 'Mobile', 0, '', 'tel'], ['email', 'Email', 1, '', 'email'], ['address', 'Address', 1], ['city', 'City'], ['state', 'State'], ['pin', 'PIN code', 0, '', 'numeric']];
const details = () => store.get('formfiller-details-v1', {});
function chips() {
  const d = details(), box = $('chips'); box.innerHTML = '';
  const add = (label, value) => { const b = document.createElement('button'); b.type = 'button'; b.innerHTML = `<b></b>`; b.querySelector('b').textContent = label; b.onclick = () => { if (S.editing) { snapshot(); typeInto(S.editing, value); $('field').focus(); } }; box.appendChild(b); };
  for (const [k, label] of FIELDS) if (d[k]) add(label === 'Full name' ? d[k] : label, d[k]);
  add('Today', today());
  const more = document.createElement('button'); more.type = 'button'; more.className = 'add';
  more.textContent = Object.keys(d).length ? 'Edit my details' : '+ Save my details'; more.onclick = openDetails; box.appendChild(more);
}
function openDetails() {
  const d = details(), box = $('fields'); box.innerHTML = '';
  for (const [k, label, wide, ph, mode] of FIELDS) {
    const l = document.createElement('label'); if (wide) l.className = 'wide';
    l.textContent = label; const i = document.createElement('input'); i.dataset.k = k; i.value = d[k] || ''; if (ph) i.placeholder = ph;
    if (mode) i.inputMode = mode; if (mode === 'email') i.type = 'email';
    l.appendChild(i); box.appendChild(l);
  }
  $('detailsSheet').hidden = false;
}
$('detailsCancel').onclick = () => { $('detailsSheet').hidden = true; };
$('detailsSave').onclick = () => {
  const d = {}; document.querySelectorAll('#fields input').forEach(i => { if (i.value.trim()) d[i.dataset.k] = i.value.trim(); });
  store.set('formfiller-details-v1', d); $('detailsSheet').hidden = true; chips(); toast('Saved on this phone');
};

// ---------------------------------------------------------------- signature
let signCtx = null, signTarget = null, signSnap = null;
function openSign(target) {
  signTarget = target; signSnap = null;
  $('signSheet').hidden = false; tab('draw');
  $('signSaved').hidden = !store.get('formfiller-sign-v1', null);
  setTimeout(clearPad, 30);
}
function tab(t) {
  document.querySelectorAll('#signSheet .tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  $('tabDraw').hidden = t !== 'draw'; $('tabSnap').hidden = t !== 'snap'; signUseState();
}
document.querySelectorAll('#signSheet .tabs button').forEach(b => b.addEventListener('click', () => tab(b.dataset.tab)));
let strokes = [], cur = null;
function clearPad() {
  const c = $('padCanvas'), r = c.getBoundingClientRect(), dpr = Math.min(3, devicePixelRatio || 1);
  c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr);
  signCtx = c.getContext('2d'); signCtx.setTransform(dpr, 0, 0, dpr, 0, 0); strokes = []; $('padSay').hidden = false;
  signSnap = null; $('snapPrev').hidden = true; $('snapPick').hidden = false; $('snapFile').value = '';
  signUseState();
}
function signUseState() { const drawTab = !$('tabDraw').hidden; $('signUse').disabled = drawTab ? !strokes.length : !signSnap; }
function padPt(e) { const r = $('padCanvas').getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
function paintStroke(g, pts) {
  g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = INKS[S.ink].c; g.lineWidth = 2.6; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) { const m = [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2]; g.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); }
  const l = pts[pts.length - 1]; g.lineTo(l[0], l[1]); g.stroke();
}
function repaint() { const c = $('padCanvas'); signCtx.save(); signCtx.setTransform(1, 0, 0, 1, 0, 0); signCtx.clearRect(0, 0, c.width, c.height); signCtx.restore(); strokes.forEach(s => paintStroke(signCtx, s)); }
$('padCanvas').addEventListener('pointerdown', e => { e.preventDefault(); $('padCanvas').setPointerCapture(e.pointerId); cur = [padPt(e)]; strokes.push(cur); $('padSay').hidden = true; });
$('padCanvas').addEventListener('pointermove', e => { if (!cur) return; cur.push(padPt(e)); repaint(); });
$('padCanvas').addEventListener('pointerup', () => { if (cur && cur.length === 1) cur.push([cur[0][0] + 0.5, cur[0][1] + 0.5]); cur = null; repaint(); signUseState(); });
$('signClear').onclick = clearPad;
$('signCancel').onclick = () => { $('signSheet').hidden = true; };
$('snapFile').addEventListener('change', async () => {
  const f = $('snapFile').files[0]; if (!f) return;
  try { busy('Cleaning the paper'); signSnap = inkOnly(await fileToImg(f), INKS[S.ink].c); }
  catch (e) { toast(e.message); } finally { busy(''); }
  if (!signSnap) { toast("Couldn't find a signature in that photo. Try it on plain white paper."); return; }
  const c = $('snapCanvas'), box = $('snapPrev'); box.hidden = false; $('snapPick').hidden = true;
  const r = box.getBoundingClientRect(); c.width = r.width * 2; c.height = r.height * 2;
  const g = c.getContext('2d'), s = Math.min(c.width * 0.9 / signSnap.width, c.height * 0.8 / signSnap.height);
  g.drawImage(signSnap, (c.width - signSnap.width * s) / 2, (c.height - signSnap.height * s) / 2, signSnap.width * s, signSnap.height * s);
  signUseState();
});
// a photo of a signature on paper: shadows removed, paper made see-through, the ink recoloured, trimmed to the ink
function inkOnly(img, color) {
  const cap = 1600, s = Math.min(1, cap / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
  cleanPaper(c);
  const im = g.getImageData(0, 0, c.width, c.height), d = im.data, [R, G, B] = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16));
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const i = (y * c.width + x) * 4, lum = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11, a = clamp((235 - lum) / 150, 0, 1);
    d[i] = R; d[i + 1] = G; d[i + 2] = B; d[i + 3] = Math.round(a * 255);
    if (a > 0.35) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) return null;
  g.putImageData(im, 0, 0);
  const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.04), o = document.createElement('canvas');
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(c.width - 1, x1 + pad); y1 = Math.min(c.height - 1, y1 + pad);
  o.width = x1 - x0 + 1; o.height = y1 - y0 + 1; o.getContext('2d').drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
  return o;
}
function trimmedPad() {
  const c = $('padCanvas'), g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return null;
  const pad = 6, o = document.createElement('canvas');
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(c.width - 1, x1 + pad); y1 = Math.min(c.height - 1, y1 + pad);
  o.width = x1 - x0 + 1; o.height = y1 - y0 + 1; o.getContext('2d').drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
  return o;
}
$('signUse').onclick = async () => {
  const c = $('tabDraw').hidden ? signSnap : trimmedPad(); if (!c) return;
  const src = c.toDataURL('image/png'); store.set('formfiller-sign-v1', src);
  $('signSheet').hidden = true; await placeImage(src, signTarget, 'sign');
};
$('signSaved').onclick = async () => { const src = store.get('formfiller-sign-v1', null); if (!src) return; $('signSheet').hidden = true; await placeImage(src, signTarget, 'sign'); };

export async function placeImage(src, { p, x, y, box }, kind) {
  const id = uid(), img = await loadImg(src); S.images[id] = { src, img };
  const ar = img.naturalWidth / img.naturalHeight;
  let w, h, X, Y;
  if (box && kind === 'photo') { w = box.w; h = box.h; X = box.x; Y = box.y; }
  else if (box) { const m = 0.1; w = Math.min(box.w * (1 - 2 * m), box.h * (1 - 2 * m) * ar); h = w / ar; X = box.x + (box.w - w) / 2; Y = box.y + (box.h - h) / 2; }
  else { w = kind === 'photo' ? 99 : 120; h = w / ar; if (kind === 'sign' && h > 50) { h = 50; w = h * ar; } X = x - w / 2; Y = y - h / 2; }
  const it = add({ type: 'img', kind, page: p.i, imgId: id, x: X, y: Y, w, h });
  select(it); setTool('text'); return it;                        // back to typing for the next field
}

// ---------------------------------------------------------------- photo (cropped to the form's photo box)
let photoTarget = null, crop = null;
function openPhoto(target) {
  photoTarget = target; crop = null;
  $('photoSheet').hidden = false; $('cropWrap').hidden = true; $('photoPick').hidden = false; $('photoUse').disabled = true; $('photoFile').value = '';
  const ar = target.box ? target.box.w / target.box.h : 35 / 45;
  $('photoSay').textContent = target.box ? "It's cut to fit the photo box on the form." : 'Tap inside the photo box on the form to fit it exactly. This one is passport size.';
  photoTarget.ar = ar;
}
$('photoCancel').onclick = () => { $('photoSheet').hidden = true; };
$('photoFile').addEventListener('change', async () => {
  const f = $('photoFile').files[0]; if (!f) return;
  let img; try { img = await fileToImg(f); } catch (e) { toast(e.message); return; }
  const wrap = $('crop'), W = Math.min(260, document.documentElement.clientWidth - 64), H = W / photoTarget.ar;
  wrap.style.width = `${W}px`; wrap.style.height = `${H}px`;
  const ci = $('cropImg'); ci.src = img.src;
  const base = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  crop = { img, W, H, base, z: 1, x: (W - img.naturalWidth * base) / 2, y: (H - img.naturalHeight * base) / 2 };
  $('cropZoom').value = 1; $('photoPick').hidden = true; $('cropWrap').hidden = false; $('photoUse').disabled = false; paintCrop();
});
function paintCrop() {
  const c = crop, s = c.base * c.z, w = c.img.naturalWidth * s, h = c.img.naturalHeight * s;
  c.x = clamp(c.x, c.W - w, 0); c.y = clamp(c.y, c.H - h, 0);
  $('cropImg').style.transform = `translate(${c.x}px, ${c.y}px) scale(${s})`;
}
$('cropZoom').addEventListener('input', () => {
  const c = crop; if (!c) return; const old = c.base * c.z, z = +$('cropZoom').value, s = c.base * z, cx = c.W / 2, cy = c.H / 2;
  c.x = cx - (cx - c.x) * s / old; c.y = cy - (cy - c.y) * s / old; c.z = z; paintCrop();
});
let pan = null;
$('crop').addEventListener('pointerdown', e => { if (!crop) return; e.preventDefault(); $('crop').setPointerCapture(e.pointerId); pan = { sx: e.clientX, sy: e.clientY, x: crop.x, y: crop.y }; });
$('crop').addEventListener('pointermove', e => { if (!pan) return; crop.x = pan.x + e.clientX - pan.sx; crop.y = pan.y + e.clientY - pan.sy; paintCrop(); });
$('crop').addEventListener('pointerup', () => { pan = null; });
$('photoUse').onclick = async () => {
  const c = crop; if (!c) return;
  const box = photoTarget.box, wPt = box ? box.w : 99, outW = Math.round(clamp(wPt / 72 * 300, 300, 900)), outH = Math.round(outW / photoTarget.ar);
  const o = document.createElement('canvas'); o.width = outW; o.height = outH;
  const g = o.getContext('2d'), k = outW / c.W, s = c.base * c.z;
  g.imageSmoothingQuality = 'high'; g.drawImage(c.img, c.x * k, c.y * k, c.img.naturalWidth * s * k, c.img.naturalHeight * s * k);
  $('photoSheet').hidden = true;
  await placeImage(o.toDataURL('image/jpeg', 0.9), photoTarget, 'photo');
};

// ---------------------------------------------------------------- tools, ink, zoom
function setTool(t) {
  S.tool = t;
  document.querySelectorAll('.tool[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
  hint();
}
const HINTS = { text: 'Tap a box or line to type', tick: 'Tap a box to tick it', cross: 'Tap a box to cross it', date: "Tap where today's date goes", sign: 'Tap the signature box', photo: 'Tap the photo box' };
let hintT;
function hint() { const h = $('hint'); h.textContent = HINTS[S.tool]; h.style.opacity = 1; clearTimeout(hintT); hintT = setTimeout(() => { h.style.opacity = 0; }, 3200); }
document.querySelectorAll('.tool[data-tool]').forEach(b => b.addEventListener('click', () => { endEdit(); setTool(b.dataset.tool); }));
function setInk(k) {
  S.ink = k; $('inkDot').style.background = INKS[k].c; $('inkName').textContent = INKS[k].name; store.set('formfiller-ink', k);
  if (S.sel && S.sel.type !== 'img') { snapshot(); S.sel.ink = INKS[k].c; redraw(S.sel); saveSession(); }
}
$('inkBtn').addEventListener('click', () => setInk((S.ink + 1) % INKS.length));
const ZOOMS = [1, 1.6, 2.4];
$('zoom').addEventListener('click', () => { S.zoom = ZOOMS[(ZOOMS.indexOf(S.zoom) + 1) % ZOOMS.length]; layout(); toast(S.zoom === 1 ? 'Fit to screen' : `Zoom ${S.zoom}×`, 1200); });
let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (!$('ed').hidden) layout(); }, 150); });
$('undo').addEventListener('click', undo);
$('back').addEventListener('click', () => { endEdit(); select(null); $('ed').hidden = true; $('land').hidden = false; checkResume(); window.scrollTo(0, 0); });

// ---------------------------------------------------------------- saving
// the page as a picture with your writing on it (for PDFs with a password, photos of forms and size limits)
async function pagePicture(p, scale) {
  const c = document.createElement('canvas'); c.width = Math.round(p.w * scale); c.height = Math.round(p.h * scale);
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  if (S.kind === 'pdf') await p.page.render({ canvasContext: g, viewport: p.page.getViewport({ scale }), intent: 'print' }).promise;
  else { g.imageSmoothingQuality = 'high'; g.drawImage(S.pic, 0, 0, c.width, c.height); }
  g.setTransform(scale, 0, 0, scale, 0, 0); for (const it of S.items) if (it.page === p.i) drawItem(g, it);
  return c;
}

// what you added, written into the original PDF. Each item is drawn in the page's on-screen frame (points from the
// top-left), mapped back into the PDF's own frame, so rotated pages and offset crop boxes come out right too.
async function vectorPdf() {
  await loadScript(PDFLIB);
  const { PDFDocument, StandardFonts, rgb, pushGraphicsState, popGraphicsState, concatTransformationMatrix, LineCapStyle } = window.PDFLib;
  const pdf = await PDFDocument.load(S.bytes, { updateMetadata: false });
  try { const form = pdf.getForm(); if (form.getFields().length) form.flatten(); } catch { /* no form, or one pdf-lib can't flatten */ }
  const font = await pdf.embedFont(StandardFonts.Helvetica), embedded = {};
  const color = hex => rgb(...[1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255));
  const encodable = t => { try { font.encodeText(t); return true; } catch { return false; } };
  const mul = (m, n) => [m[0] * n[0] + m[1] * n[2], m[0] * n[1] + m[1] * n[3], m[2] * n[0] + m[3] * n[2], m[2] * n[1] + m[3] * n[3], m[4] * n[0] + m[5] * n[2] + n[4], m[4] * n[1] + m[5] * n[3] + n[5]];
  const inv = m => { const d = m[0] * m[3] - m[1] * m[2]; return [m[3] / d, -m[1] / d, -m[2] / d, m[0] / d, (m[2] * m[5] - m[3] * m[4]) / d, (m[1] * m[4] - m[0] * m[5]) / d]; };
  const pages = pdf.getPages();
  for (const it of S.items) {
    const page = pages[it.page], toPdf = inv(S.pages[it.page].vp.transform);
    // local frame: origin at a point on screen, x right, y up (as PDF drawing expects)
    const at = (x, y, fn) => { page.pushOperators(pushGraphicsState(), concatTransformationMatrix(...mul([1, 0, 0, -1, x, y], toPdf))); fn(); page.pushOperators(popGraphicsState()); };
    const ink = color(it.ink || INKS[0].c);
    if (it.type === 'text' && it.text) {
      if (encodable(it.text)) at(it.x, it.y, () => page.drawText(it.text, { x: 0, y: 0, size: it.size, font, color: ink }));
      else { const pic = await textPicture(pdf, it); at(it.x, it.y + it.size * 0.3, () => page.drawImage(pic.img, { x: 0, y: 0, width: pic.w, height: pic.h })); }
    } else if (it.type === 'comb') {
      const { letters } = combLetters(it.text, it.cells);
      for (let i = 0; i < letters.length; i++) {
        const ch = letters[i]; if (!ch) continue;
        const c = it.cells[i], by = it.y + it.h / 2 + it.size * 0.36;
        if (encodable(ch)) { const w = font.widthOfTextAtSize(ch, it.size); at(c.x + c.w / 2 - w / 2, by, () => page.drawText(ch, { x: 0, y: 0, size: it.size, font, color: ink })); }
        else { const pic = await textPicture(pdf, { ...it, text: ch }); at(c.x + c.w / 2 - pic.w / 2, by + it.size * 0.3, () => page.drawImage(pic.img, { x: 0, y: 0, width: pic.w, height: pic.h })); }
      }
    } else if (it.type === 'mark') {
      const t = Math.max(0.9, it.w * 0.13);
      at(0, 0, () => { for (const [a, b] of markLines(it)) page.drawLine({ start: { x: a[0], y: -a[1] }, end: { x: b[0], y: -b[1] }, thickness: t, color: ink, lineCap: LineCapStyle.Round }); });
    } else if (it.type === 'img') {
      const src = S.images[it.imgId].src;
      let img = embedded[it.imgId];
      if (!img) { const bytes = await (await fetch(src)).arrayBuffer(); img = embedded[it.imgId] = src.startsWith('data:image/png') ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes); }
      at(it.x, it.y + it.h, () => page.drawImage(img, { x: 0, y: 0, width: it.w, height: it.h }));
    }
  }
  return new Blob([await pdf.save()], { type: 'application/pdf' });
}
// text the PDF's built-in font can't write (Hindi, ₹, emoji) goes in as a sharp picture of the text
async function textPicture(pdf, it) {
  const k = 8, w = textW(it.text, it.size) + 2, h = it.size * 1.35, c = document.createElement('canvas');
  c.width = Math.ceil(w * k); c.height = Math.ceil(h * k);
  const g = c.getContext('2d'); g.scale(k, k); g.fillStyle = it.ink || INKS[0].c; g.font = `${it.size}px ${FONT}, Arial, sans-serif`; g.textBaseline = 'alphabetic';
  g.fillText(it.text, 1, it.size * 1.05);
  const bytes = await (await fetch(c.toDataURL('image/png'))).arrayBuffer();
  return { img: await pdf.embedPng(bytes), w, h };
}

// ---------------------------------------------------------------- page pictures → PDF, and fitting a KB limit
const encode = (c, q) => new Promise(res => c.toBlob(res, 'image/jpeg', q));
function scaled(c, s) { if (s === 1) return c; const o = document.createElement('canvas'); o.width = Math.max(1, Math.round(c.width * s)); o.height = Math.max(1, Math.round(c.height * s)); const g = o.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, o.width, o.height); return o; }
async function buildPdf(pages) {
  const te = new TextEncoder(), chunks = [], offs = []; let pos = 0;
  const put = x => { const u = typeof x === 'string' ? te.encode(x) : x; chunks.push(u); pos += u.length; };
  const obj = (n, body) => { offs[n] = pos; put(`${n} 0 obj\n${body}\nendobj\n`); };
  put('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const n = pages.length, kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>'); obj(2, `<< /Type /Pages /Kids [${kids}] /Count ${n} >>`);
  for (let i = 0; i < n; i++) {
    const p = pages[i], a = 3 + i * 3, img = new Uint8Array(await p.jpg.arrayBuffer()), W = p.ptW.toFixed(2), H = p.ptH.toFixed(2);
    obj(a, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /I ${a + 1} 0 R >> >> /Contents ${a + 2} 0 R >>`);
    offs[a + 1] = pos; put(`${a + 1} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.length} >>\nstream\n`); put(img); put('\nendstream\nendobj\n');
    const content = `q ${W} 0 0 ${H} 0 0 cm /I Do Q`; obj(a + 2, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  }
  const total = 3 + n * 3, xref = pos; let x = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let i = 1; i < total; i++) x += `${String(offs[i]).padStart(10, '0')} 00000 n \n`;
  put(`${x}trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(chunks, { type: 'application/pdf' });
}
async function encodeAll(pics, s, q) { const out = []; for (const p of pics) { const c = scaled(p.canvas, s); out.push({ ...p, jpg: await encode(c, q), w: c.width, h: c.height }); } return out; }
const bytesOf = list => list.reduce((t, p) => t + p.jpg.size, 0);
async function pictures(scaleFor) {
  const out = [];
  for (const p of S.pages) { busy(`Preparing page ${p.i + 1} of ${S.pages.length}`); out.push({ canvas: await pagePicture(p, scaleFor(p)), ptW: p.w, ptH: p.h }); }
  return out;
}
async function picturePdf(q = 0.86) { const pics = await pictures(p => Math.min(2.2, 1754 / Math.max(p.w, p.h))); return buildPdf(await encodeAll(pics, 1, q)); }
async function fitPdf(maxBytes) {
  const pics = await pictures(p => Math.min(2.2, 1754 / Math.max(p.w, p.h)));
  const budget = Math.max(1, maxBytes - (240 + 620 * pics.length));
  for (const s of [1, 0.85, 0.72, 0.6, 0.5, 0.42, 0.35, 0.3, 0.25]) {
    busy(`Trying pages at ${Math.round(s * 100)}% size`);
    const mid = await encodeAll(pics, s, 0.6);
    if (bytesOf(mid) <= budget) {
      let lo = 0.6, hi = 0.92, best = mid;
      for (let i = 0; i < 5; i++) { const q = (lo + hi) / 2, t = await encodeAll(pics, s, q); if (bytesOf(t) <= budget) { lo = q; best = t; } else hi = q; }
      return buildPdf(best);
    }
  }
  const last = await encodeAll(pics, 0.25, 0.3);
  return bytesOf(last) <= budget ? buildPdf(last) : null;
}

// ---------------------------------------------------------------- result
let out = null;
const outName = () => `${(S.name.replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '') || 'form').slice(0, 40)}-filled.pdf`;
export async function saveForm() {
  endEdit(); select(null);
  if (!S.items.length) { toast('Nothing written yet. Tap the form to start.'); return; }
  busy('Saving your form');
  let blob = null, how = '';
  try {
    if (S.kind === 'pdf' && !S.password) { blob = await vectorPdf(); how = 'Original PDF, with your writing added'; }
  } catch (e) { console.warn('pdf-lib failed, saving page pictures', e); }
  try {
    if (!blob) { blob = await picturePdf(); how = S.kind === 'image' ? 'Saved from your photo' : 'Saved as pictures of the pages'; }
  } catch (e) { busy(''); toast("Couldn't save this one. " + (e.message || ''), 4000); return; }
  busy(''); showResult(blob, how);
}
async function showResult(blob, how, limit) {
  out = blob;
  $('outSize').firstChild.textContent = fmt(blob.size);
  $('outInfo').textContent = `${how} · ${S.pages.length} page${S.pages.length > 1 ? 's' : ''}`;
  const canShare = !!(navigator.canShare && navigator.canShare({ files: [new File([blob], outName(), { type: 'application/pdf' })] }));
  $('share').hidden = !canShare;
  const lc = $('limitChips'); lc.innerHTML = '';
  for (const kb of [100, 200, 300, 500, 1000]) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = kb >= 1000 ? 'Under 1 MB' : `Under ${kb} KB`;
    b.classList.toggle('on', limit === kb); b.onclick = () => shrink(kb); lc.appendChild(b);
  }
  $('limitWarn').hidden = true;
  const p = S.pages[0], thumb = await pagePicture(p, 260 * 2 / p.w), t = $('thumb');
  t.width = thumb.width; t.height = thumb.height; t.getContext('2d').drawImage(thumb, 0, 0);
  $('resultSheet').hidden = false;
}
async function shrink(kb) {
  if (out && out.size <= kb * 1000) { $('limitWarn').hidden = false; $('limitWarn').textContent = `It's already under ${kb >= 1000 ? '1 MB' : kb + ' KB'}.`; return; }
  const blob = await fitPdf(kb * 1000); busy('');
  if (!blob) { $('limitWarn').hidden = false; $('limitWarn').textContent = `${S.pages.length} pages can't fit in ${kb} KB and stay readable. Try a bigger limit.`; return; }
  showResult(blob, `Fitted under ${kb >= 1000 ? '1 MB' : kb + ' KB'} as page pictures`, kb);
}
$('download').onclick = () => { if (!out) return; const a = document.createElement('a'); a.href = URL.createObjectURL(out); a.download = outName(); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
$('share').onclick = () => { if (out) navigator.share({ files: [new File([out], outName(), { type: 'application/pdf' })] }).catch(() => { }); };
$('keepEditing').onclick = () => { $('resultSheet').hidden = true; };
$('save').addEventListener('click', saveForm);

// ---------------------------------------------------------------- start
$('open').addEventListener('change', () => { const f = $('open').files[0]; $('open').value = ''; if (f) openFile(f); });
export async function openSample() { const r = await fetch('sample.pdf'); return openPdf(new Uint8Array(await r.arrayBuffer()), 'Sample application form.pdf'); }
$('trySample').addEventListener('click', () => openSample().catch(e => { busy(''); toast(e.message); }));
async function checkResume() {
  const s = S.demo ? null : await idb.get('session');
  $('resume').hidden = !(s && s.items && s.items.length);
  if ($('resume').hidden) return;
  $('resumeName').textContent = s.name;
  const mins = Math.round((Date.now() - s.at) / 60000);
  $('resumeInfo').textContent = `${s.items.length} thing${s.items.length > 1 ? 's' : ''} filled · ${mins < 60 ? `${mins} min` : mins < 1440 ? `${Math.round(mins / 60)} h` : `${Math.round(mins / 1440)} days`} ago`;
  $('resumeGo').onclick = async () => {
    try {
      if (s.kind === 'pdf') await openPdf(s.bytes, s.name, s.items, s.images);
      else await openImage(await loadImg(s.imgSrc), s.name, s.items, s.images, false);
      S.imgSrc = s.imgSrc;
    } catch (e) { busy(''); toast(e.message); }
  };
  $('resumeDrop').onclick = () => { idb.del('session'); $('resume').hidden = true; };
}
setInk(clamp(+store.get('formfiller-ink', 0) || 0, 0, INKS.length - 1));
checkResume();
document.fonts?.load(`16px ${FONT}`).then(() => { if (!$('ed').hidden) redrawAll(); });
window.NP = { S, openFile, openSample, tapAt, createAt, typeInto, placeImage, saveForm, setTool, endEdit, select, layout, drawItem, pagePicture, redrawAll };
if (new URLSearchParams(location.search).has('demo')) import('./demo.js').then(m => m.start(window.NP)).catch(e => console.error(e));
