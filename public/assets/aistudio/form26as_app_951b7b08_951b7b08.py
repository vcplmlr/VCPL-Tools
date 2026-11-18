#!/usr/bin/env python3
"""
Form 26AS  ->  Excel : upload & convert page (runs on your own computer, nothing is uploaded to the internet)

Start:
    python3 form26as_app.py            (Windows:  python form26as_app.py   or double-click start_26as_converter.bat)
A browser tab opens at http://127.0.0.1:8765  -> choose the PDF, tick the options, click Convert, download the Excel.

Needs: Python 3.8+, openpyxl, and either pdfplumber (pip install pdfplumber) or poppler's pdftotext.
Keep this file in the same folder as form26as_to_excel.py.
"""
import json
import os
import re
import sys
import tempfile
import threading
import uuid
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, quote, urlparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import form26as_to_excel as core  # noqa: E402

MAX_UPLOAD = 100 * 1024 * 1024
RESULTS = {}  # token -> (filename, bytes)

PAGE = """<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Form 26AS to Excel</title>
<style>
  :root { --bg:#f4f6f9; --card:#fff; --ink:#1b2430; --muted:#5d6b7c; --brand:#1f4e78; --ok:#1b7f3b; --bad:#b42318; --line:#dde3ea; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#12161c; --card:#1b212a; --ink:#e8edf3; --muted:#9aa7b6; --brand:#6aa9e0; --ok:#4cc27a; --bad:#ff7b72; --line:#2c3541; }
  }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif; }
  main { max-width:680px; margin:0 auto; padding:32px 16px 48px; }
  h1 { font-size:24px; margin:0 0 4px; }
  .sub { color:var(--muted); margin:0 0 24px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:20px; margin-bottom:16px; }
  #drop { border:2px dashed var(--line); border-radius:10px; padding:32px 16px; text-align:center; cursor:pointer; transition:.15s; }
  #drop.over, #drop:hover { border-color:var(--brand); background:rgba(31,78,120,.06); }
  #drop strong { display:block; font-size:17px; }
  #fname { margin-top:8px; color:var(--brand); font-weight:600; word-break:break-all; }
  label.opt { display:flex; gap:12px; align-items:flex-start; padding:10px 0; cursor:pointer; }
  label.opt + label.opt { border-top:1px solid var(--line); }
  label.opt input { width:20px; height:20px; margin-top:3px; accent-color:var(--brand); }
  label.opt span small { display:block; color:var(--muted); font-size:14px; }
  button { font:inherit; font-weight:600; border:0; border-radius:8px; padding:12px 22px; background:var(--brand); color:#fff; cursor:pointer; }
  button:disabled { opacity:.45; cursor:not-allowed; }
  #status { margin-top:12px; color:var(--muted); }
  .ok { color:var(--ok); font-weight:600; } .bad { color:var(--bad); font-weight:600; }
  table { border-collapse:collapse; width:100%; margin:8px 0 12px; font-size:15px; }
  td, th { text-align:left; padding:6px 8px; border-bottom:1px solid var(--line); }
  th { color:var(--muted); font-weight:600; }
  td.n, th.n { text-align:right; font-variant-numeric:tabular-nums; }
  a.dl { display:inline-block; text-decoration:none; background:var(--ok); color:#fff; padding:12px 22px; border-radius:8px; font-weight:600; }
  ul.warn { margin:8px 0; padding-left:20px; color:var(--bad); }
  .hide { display:none; }
</style></head>
<body><main>
  <h1>Form 26AS &rarr; Excel</h1>
  <p class="sub">Upload your Annual Tax Statement (TRACES PDF). The file stays on this computer.</p>

  <div class="card">
    <div id="drop" tabindex="0">
      <strong>Click to choose the 26AS PDF</strong>
      <span class="sub">or drag and drop it here</span>
      <div id="fname"></div>
    </div>
    <input id="file" type="file" accept="application/pdf,.pdf" class="hide">
  </div>

  <div class="card">
    <strong>What do you want in the Excel?</strong>
    <label class="opt"><input type="checkbox" id="combined" checked>
      <span>Combined single sheet<small>All parties and all transactions together in one sheet (filterable).</small></span></label>
    <label class="opt"><input type="checkbox" id="partywise">
      <span>Party-wise sheets<small>A separate sheet for every deductor / collector, plus a clickable Party Summary sheet. You can tick both options.</small></span></label>
    <div style="margin-top:14px"><button id="go" disabled>Convert to Excel</button></div>
    <div id="status"></div>
  </div>

  <div class="card hide" id="result"></div>
</main>
<script>
const $ = id => document.getElementById(id);
let chosen = null;
const drop = $('drop'), fileIn = $('file'), go = $('go');

function setFile(f) {
  if (!f) return;
  if (!/\\.pdf$/i.test(f.name)) { $('status').innerHTML = '<span class="bad">Please choose a PDF file.</span>'; return; }
  chosen = f; $('fname').textContent = f.name + '  (' + (f.size/1024).toFixed(0) + ' KB)';
  go.disabled = false; $('status').textContent = ''; $('result').classList.add('hide');
}
drop.onclick = () => fileIn.click();
drop.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') fileIn.click(); };
fileIn.onchange = () => setFile(fileIn.files[0]);
['dragenter','dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave','drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', e => setFile(e.dataTransfer.files[0]));

function esc(s) { return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

go.onclick = async () => {
  if (!chosen) return;
  const combined = $('combined').checked, partywise = $('partywise').checked;
  if (!combined && !partywise) { $('status').innerHTML = '<span class="bad">Tick at least one option.</span>'; return; }
  go.disabled = true; $('status').textContent = 'Converting... large files can take a few seconds.';
  $('result').classList.add('hide');
  try {
    const q = new URLSearchParams({ combined: combined ? 1 : 0, partywise: partywise ? 1 : 0, filename: chosen.name });
    const r = await fetch('/convert?' + q, { method: 'POST', body: chosen });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Conversion failed');
    $('status').textContent = '';
    let h = '<strong>' + esc(j.assessee) + '</strong> &nbsp;<span class="sub">' + esc(j.pan) + ' &middot; AY ' + esc(j.assessment_year) + '</span>';
    h += '<table><tr><th></th><th class="n">Parties</th><th class="n">Rows</th><th class="n">Amount</th><th class="n">Tax</th></tr>';
    for (const t of ['TDS','TCS']) { const s = j.totals[t];
      h += '<tr><td>' + t + '</td><td class="n">' + s.parties + '</td><td class="n">' + s.rows + '</td><td class="n">' + s.amount + '</td><td class="n">' + s.tax + '</td></tr>'; }
    h += '</table>';
    h += j.verified
      ? '<p class="ok">&#10003; Verified: every party\\'s rows add up to the totals printed in the PDF.</p>'
      : '<p class="bad">Verification found differences:</p><ul class="warn">' + j.problems.map(p => '<li>' + esc(p) + '</li>').join('') + '</ul>';
    if (j.warnings.length) h += '<ul class="warn">' + j.warnings.map(p => '<li>' + esc(p) + '</li>').join('') + '</ul>';
    h += '<p class="sub">Workbook contains ' + j.sheets + ' sheet' + (j.sheets === 1 ? '' : 's') + '.</p>';
    h += '<a class="dl" href="/download/' + j.token + '">Download Excel</a>';
    $('result').innerHTML = h; $('result').classList.remove('hide');
  } catch (e) {
    $('status').innerHTML = '<span class="bad">' + esc(e.message) + '</span>';
  } finally { go.disabled = false; }
};
</script></body></html>
"""


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body, ctype="application/json", extra=None):
        if isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def _json(self, code, obj):
        self._send(code, json.dumps(obj))

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/":
            return self._send(200, PAGE, "text/html; charset=utf-8")
        m = re.match(r"^/download/([0-9a-f]{32})$", path)
        if m and m.group(1) in RESULTS:
            name, data = RESULTS[m.group(1)]
            return self._send(
                200, data,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                {"Content-Disposition": f"attachment; filename*=UTF-8''{quote(name)}"},
            )
        self._json(404, {"error": "Not found"})

    def do_POST(self):
        u = urlparse(self.path)
        if u.path != "/convert":
            return self._json(404, {"error": "Not found"})
        q = parse_qs(u.query)
        combined = q.get("combined", ["1"])[0] == "1"
        partywise = q.get("partywise", ["0"])[0] == "1"
        orig = os.path.basename(q.get("filename", ["statement.pdf"])[0])
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_UPLOAD:
            return self._json(400, {"error": "Empty or too large file (limit 100 MB)."})
        data = self.rfile.read(length)
        if not data.startswith(b"%PDF"):
            return self._json(400, {"error": "That file is not a PDF."})
        with tempfile.TemporaryDirectory() as tmp:
            pdf = os.path.join(tmp, "in.pdf")
            xlsx = os.path.join(tmp, "out.xlsx")
            with open(pdf, "wb") as f:
                f.write(data)
            try:
                res = core.convert(pdf, xlsx, combined=combined, partywise=partywise)
            except (ValueError, RuntimeError) as e:
                return self._json(400, {"error": str(e)})
            except Exception as e:  # unexpected parsing problem
                return self._json(500, {"error": f"Unexpected error while converting: {e}"})
            with open(xlsx, "rb") as f:
                blob = f.read()
        token = uuid.uuid4().hex
        base = re.sub(r"\.pdf$", "", orig, flags=re.I) or "statement"
        suffix = "_26AS" + ("_partywise" if partywise and not combined else "")
        RESULTS[token] = (f"{base}{suffix}.xlsx", blob)
        while len(RESULTS) > 10:  # keep memory small
            RESULTS.pop(next(iter(RESULTS)))
        res["token"] = token
        self._json(200, res)

    def log_message(self, fmt, *args):
        pass  # quiet console


def main():
    port = 8765
    open_browser = True
    for a in sys.argv[1:]:
        if a == "--no-browser":
            open_browser = False
        elif a.isdigit():
            port = int(a)
    try:
        srv = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    except OSError:
        sys.exit(f"Port {port} is busy. Close the other copy or run:  python form26as_app.py {port + 1}")
    url = f"http://127.0.0.1:{port}"
    print(f"26AS converter running at {url}   (press Ctrl+C to stop)")
    if open_browser:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
