import * as XLSX from 'xlsx';

// atob may not be available in all WebView Worker contexts
function base64ToUint8Array(b64: string): Uint8Array {
  if (typeof atob !== 'undefined') {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;
  const clean = b64.replace(/=+$/, '');
  const bytes = new Uint8Array((clean.length * 3) >> 2);
  let bi = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = lookup[clean.charCodeAt(i)], b = lookup[clean.charCodeAt(i + 1)];
    const c = lookup[clean.charCodeAt(i + 2)], d = lookup[clean.charCodeAt(i + 3)];
    bytes[bi++] = (a << 2) | (b >> 4);
    if (i + 2 < clean.length) bytes[bi++] = ((b & 0xf) << 4) | (c >> 2);
    if (i + 3 < clean.length) bytes[bi++] = ((c & 0x3) << 6) | d;
  }
  return bytes.slice(0, bi);
}

// Cache parsed workbook by base64 key to avoid re-parsing on sheet switch
let cachedKey = '';
let cachedWorkbook: ReturnType<typeof XLSX.read> | null = null;

self.onmessage = (e: MessageEvent) => {
  const { id, base64, sheetIndex, filter, maxRows } = e.data;
  try {
    // Re-parse only when file changes
    if (base64 !== cachedKey || !cachedWorkbook) {
      const bytes = base64ToUint8Array(base64);
      cachedWorkbook = XLSX.read(bytes, { type: 'array' });
      cachedKey = base64;
    }

    const workbook = cachedWorkbook;
    const sheetNames = workbook.SheetNames;
    const idx = Math.max(0, Math.min(sheetIndex ?? 0, sheetNames.length - 1));
    const sheetName = sheetNames[idx];
    const sheet = workbook.Sheets[sheetName];

    if (!sheet) {
      self.postMessage({ id, sheetNames, html: '<table></table>', truncated: false });
      return;
    }

    // Some sheets lack !ref (empty or corrupt) — sheet_to_html will crash without it
    if (!sheet['!ref']) {
      self.postMessage({ id, sheetNames, html: '<table><tr><td>(empty sheet)</td></tr></table>', truncated: false });
      return;
    }

    let html: string;
    try {
      html = XLSX.utils.sheet_to_html(sheet);
    } catch {
      self.postMessage({ id, sheetNames, html: '<table><tr><td>(unable to render sheet)</td></tr></table>', truncated: false });
      return;
    }
    const rowRegex = /<tr[\s\S]*?<\/tr>/gi;
    const allRows = html.match(rowRegex) ?? [];
    const header = allRows[0] ?? '';
    let dataRows = allRows.slice(1);

    if (filter) {
      const lc = filter.toLowerCase();
      dataRows = dataRows.filter(r => r.toLowerCase().includes(lc));
    }

    const limit = maxRows ?? 2000;
    const truncated = dataRows.length > limit;
    if (truncated) dataRows = dataRows.slice(0, limit);

    self.postMessage({ id, sheetNames, html: `<table>${header}${dataRows.join('')}</table>`, truncated });
  } catch (err: any) {
    self.postMessage({ id, error: err?.message ?? 'Parse error' });
  }
};
