import * as XLSX from 'xlsx';

function escapeCsvCell(val: unknown): string {
  const str = val === null || val === undefined ? '' : String(val);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function downloadCsvFile(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][]
): void {
  const lines = [headers.map(escapeCsvCell).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCsvCell).join(','));
  }
  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadExcelFile(
  filename: string,
  sheetName: string,
  headers: string[],
  rows: (string | number | null | undefined)[][]
): void {
  const aoa = [headers, ...rows.map((r) => r.map((c) => c ?? ''))];
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  worksheet['!cols'] = headers.map((h, colIdx) => {
    let maxLen = h.length;
    for (let r = 0; r < Math.min(rows.length, 200); r += 1) {
      const cellLen = String(rows[r][colIdx] ?? '').length;
      if (cellLen > maxLen) maxLen = cellLen;
    }
    return { wch: Math.min(Math.max(maxLen + 3, 12), 48) };
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  const finalName = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  XLSX.writeFile(workbook, finalName);
}

export function printStructuredTable(
  title: string,
  subtitle: string,
  headers: string[],
  rows: (string | number | null | undefined)[][]
): void {
  const escapeHtml = (input: unknown) =>
    String(input ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { font-family: system-ui, -apple-system, sans-serif; color: #1e293b; margin: 24px; font-size: 12px; }
      h1 { font-size: 18px; margin: 0 0 4px 0; color: #2F3E4E; }
      p { margin: 0 0 14px 0; color: #475569; font-size: 11px; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #2F3E4E; color: #FFFDF5; text-align: left; padding: 6px 8px; font-size: 11px; }
      td { border: 1px solid #cbd5e1; padding: 6px 8px; vertical-align: top; word-break: break-word; }
      tr:nth-child(even) td { background: #f8fafc; }
      @media print { body { margin: 12px; } }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(subtitle)} · Generated via VCPL Tools</p>
    <table>
      <thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
      <tbody>
        ${rows
          .map(
            (r) =>
              `<tr>${r.map((cell) => `<td>${escapeHtml(cell || 'Not Available')}</td>`).join('')}</tr>`
          )
          .join('')}
      </tbody>
    </table>
  </body>
</html>`;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();
    window.setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } finally {
        window.setTimeout(() => {
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        }, 1500);
      }
    }, 150);
  }
}

export async function shareOrCopyLink(
  title: string,
  text: string,
  url: string
): Promise<'shared' | 'copied' | 'failed'> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text, url });
      return 'shared';
    } catch {
      // Fall through to clipboard copy
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}
