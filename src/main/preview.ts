import fs from 'fs';
import path from 'path';
import log from 'electron-log';

const TEXT_PREVIEW_EXTENSIONS = new Set([
  '.txt', '.text', '.md', '.mdx', '.rst', '.adoc', '.tex',
  '.json', '.jsonc', '.json5', '.js', '.mjs', '.cjs', '.ts', '.mts', '.cts', '.jsx', '.tsx',
  '.css', '.scss', '.sass', '.less', '.html', '.htm', '.xhtml', '.xml',
  '.yml', '.yaml', '.toml', '.ini', '.cfg', '.conf', '.config', '.cnf',
  '.log', '.out', '.err', '.properties', '.prop', '.env', '.env.local', '.env.development', '.env.production',
  '.sh', '.bash', '.zsh', '.fish', '.bat', '.cmd', '.ps1', '.psm1',
  '.py', '.pyw', '.java', '.c', '.cc', '.cpp', '.cxx', '.h', '.hh', '.hpp', '.hxx',
  '.cs', '.fs', '.vb', '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.kts', '.scala',
  '.sql', '.csv', '.tsv', '.lua', '.r', '.graphql', '.gql', '.proto', '.dart', '.erl', '.ex', '.exs',
  '.clj', '.groovy', '.gradle', '.dockerfile', '.vue', '.svelte', '.lock'
]);

const TEXT_PREVIEW_FILENAMES = new Set([
  'dockerfile', 'makefile', 'cmakelists.txt', 'license', 'licence', 'readme', 'readme.md',
  '.gitignore', '.gitattributes', '.editorconfig', '.npmrc', '.yarnrc', '.yarnrc.yml',
  '.prettierrc', '.prettierrc.json', '.prettierrc.js', '.prettierrc.cjs',
  '.eslintrc', '.eslintrc.js', '.eslintrc.cjs', '.eslintrc.json', '.eslintrc.yml',
  '.babelrc', '.babelrc.json', '.nvmrc', '.node-version'
]);

const BINARY_PREVIEW_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.ico', '.svg',
  '.mp4', '.webm', '.avi', '.mkv', '.mov', '.wmv',
  '.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a', '.wma',
  '.pdf', '.xlsx', '.xls'
]);

const MAX_TEXT_PREVIEW_BYTES = 256 * 1024;
const MAX_BINARY_PREVIEW_BYTES = 50 * 1024 * 1024;

export interface PreviewResponse {
  success: boolean;
  data?: string;
  ext?: string;
  error?: string;
  contentEncoding?: 'base64' | 'utf8';
  truncated?: boolean;
}

export interface FileInfoResponse {
  size: number;
  created: number;
  modified: number;
  accessed: number;
  isDirectory: boolean;
  extension: string;
}

function decodeTextPreview(buffer: Buffer): string {
  if (buffer.length >= 2) {
    const bom16le = buffer[0] === 0xff && buffer[1] === 0xfe;
    const bom16be = buffer[0] === 0xfe && buffer[1] === 0xff;
    if (bom16le || bom16be) {
      return buffer.toString('utf16le').replace(/\u0000/g, '');
    }
  }

  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.toString('utf8');
  }

  const utf8 = buffer.toString('utf8');
  const suspiciousNulls = (utf8.match(/\u0000/g) || []).length;
  if (suspiciousNulls > 0 && suspiciousNulls > utf8.length / 8) {
    return buffer.toString('utf16le').replace(/\u0000/g, '');
  }

  return utf8;
}

function isProbablyText(buffer: Buffer): boolean {
  if (buffer.length === 0) return true;

  let suspicious = 0;
  for (const byte of buffer) {
    if (byte === 0) return false;
    const isTab = byte === 9;
    const isLf = byte === 10;
    const isCr = byte === 13;
    const isPrintableAscii = byte >= 32 && byte <= 126;
    const isExtended = byte >= 128;
    if (!isTab && !isLf && !isCr && !isPrintableAscii && !isExtended) {
      suspicious += 1;
    }
  }

  return suspicious / buffer.length < 0.02;
}

function shouldTreatAsText(filePath: string, ext: string, sample: Buffer): boolean {
  const filename = path.basename(filePath).toLowerCase();
  if (TEXT_PREVIEW_EXTENSIONS.has(ext) || TEXT_PREVIEW_FILENAMES.has(filename)) {
    return true;
  }

  if (ext === '.svg') return false;

  return isProbablyText(sample);
}

function readPreviewSample(filePath: string, size: number): Buffer {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buffer = Buffer.alloc(size);
    const bytesRead = fs.readSync(fd, buffer, 0, size, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    fs.closeSync(fd);
  }
}

function stripXmlToText(xml: string): string {
  return xml
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<w:br\/>/g, '\n')
    .replace(/<w:p[^>]*>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<a:br\/>/g, '\n')
    .replace(/<a:p[^>]*>/g, '\n')
    .replace(/<\/a:p>/g, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function readZipEntryText(zipfile: any, entry: any): Promise<string> {
  return new Promise((resolve, reject) => {
    zipfile.openReadStream(entry, (streamError: Error | null, readStream: NodeJS.ReadableStream) => {
      if (streamError || !readStream) {
        reject(streamError);
        return;
      }

      const chunks: Buffer[] = [];
      readStream.on('data', (chunk: Buffer) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      readStream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      readStream.on('error', reject);
    });
  });
}

function extractOpenXmlText(filePath: string, ext: string): Promise<string | null> {
  const yauzl = require('yauzl');

  return new Promise((resolve) => {
    yauzl.open(filePath, { lazyEntries: true }, (openError: Error | null, zipfile: any) => {
      if (openError || !zipfile) {
        if (openError) log.warn('Open XML preview extraction failed:', openError);
        resolve(null);
        return;
      }

      const targetEntry = ext === '.docx' ? 'word/document.xml' : null;
      const slideEntries: Array<{ fileName: string; text: string }> = [];
      let settled = false;

      const finish = (value: string | null) => {
        if (settled) return;
        settled = true;
        zipfile.close();
        resolve(value);
      };

      zipfile.on('entry', async (entry: any) => {
        try {
          if (ext === '.docx') {
            if (entry.fileName === targetEntry) {
              const text = await readZipEntryText(zipfile, entry);
              finish(text);
              return;
            }
            zipfile.readEntry();
            return;
          }

          if (ext === '.pptx') {
            if (/^ppt\/slides\/slide\d+\.xml$/i.test(entry.fileName)) {
              const text = await readZipEntryText(zipfile, entry);
              slideEntries.push({ fileName: entry.fileName, text });
            }
            zipfile.readEntry();
            return;
          }

          zipfile.readEntry();
        } catch (entryError) {
          log.warn('Open XML entry extraction failed:', entryError);
          finish(null);
        }
      });

      zipfile.on('end', () => {
        if (ext === '.pptx' && slideEntries.length > 0) {
          slideEntries.sort((a, b) => a.fileName.localeCompare(b.fileName, undefined, { numeric: true }));
          finish(slideEntries.map((item) => item.text).join('\x00SLIDE\x00'));
          return;
        }
        finish(null);
      });

      zipfile.on('error', (zipError: Error) => {
        log.warn('Open XML zip read failed:', zipError);
        finish(null);
      });

      zipfile.readEntry();
    });
  });
}

function extractLegacyOfficeText(filePath: string, ext: string): string | null {
  const { spawnSync } = require('child_process');
  const psScript = `
    $ErrorActionPreference = 'Stop'
    $file = $args[0]
    $ext = $args[1]

    try {
      if ($ext -in @('.doc', '.docx')) {
        $word = New-Object -ComObject Word.Application
        $word.Visible = $false
        $doc = $word.Documents.Open($file, $false, $true)
        try { $doc.Content.Text } finally { $doc.Close($false); $word.Quit() }
      } elseif ($ext -eq '.ppt') {
        $powerpoint = New-Object -ComObject PowerPoint.Application
        $presentation = $powerpoint.Presentations.Open($file, $false, $false, $false)
        try {
          $text = foreach ($slide in $presentation.Slides) {
            foreach ($shape in $slide.Shapes) {
              if ($shape.HasTextFrame -and $shape.TextFrame.HasText) {
                $shape.TextFrame.TextRange.Text
              }
            }
          }
          $text -join "\`n"
        } finally { $presentation.Close(); $powerpoint.Quit() }
      }
    } catch {
      exit 0
    }
  `;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psScript, filePath, ext], {
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 10 * 1024 * 1024
  });

  if (result.status !== 0 || result.error) return null;
  const stdout = (result.stdout || '').trim();
  return stdout || null;
}

export async function getPreviewData(filePath: string): Promise<PreviewResponse> {
  const ext = path.extname(filePath).toLowerCase();

  try {
    const stat = fs.statSync(filePath);
    const sample = readPreviewSample(filePath, MAX_TEXT_PREVIEW_BYTES);

    if (shouldTreatAsText(filePath, ext, sample)) {
      const truncated = stat.size > MAX_TEXT_PREVIEW_BYTES;
      const text = decodeTextPreview(sample);
      return { success: true, data: text, ext, contentEncoding: 'utf8', truncated };
    }

    if (ext === '.docx' || ext === '.pptx') {
      const xmlText = await extractOpenXmlText(filePath, ext);
      if (xmlText) {
        return { success: true, data: stripXmlToText(xmlText), ext, contentEncoding: 'utf8' };
      }
    }

    if (ext === '.doc' || ext === '.ppt') {
      const officeText = extractLegacyOfficeText(filePath, ext);
      if (officeText) {
        return { success: true, data: officeText, ext, contentEncoding: 'utf8' };
      }
      return { success: false, error: 'Office preview requires Microsoft Office or a newer Open XML format.', ext };
    }

    if (BINARY_PREVIEW_EXTENSIONS.has(ext)) {
      if (stat.size > MAX_BINARY_PREVIEW_BYTES) {
        return { success: false, error: `File is too large to preview (${Math.round(stat.size / 1024 / 1024)} MB).`, ext };
      }
      const data = fs.readFileSync(filePath);
      if (ext === '.svg') {
        return { success: true, data: data.toString('utf8'), ext, contentEncoding: 'utf8' };
      }
      return { success: true, data: data.toString('base64'), ext, contentEncoding: 'base64' };
    }

    return { success: false, error: 'Preview is not supported for this file type.', ext };
  } catch (error: any) {
    log.error('Failed to read preview file:', error);
    return { success: false, error: error.message };
  }
}

export async function getFileInfo(filePath: string): Promise<FileInfoResponse | null> {
  try {
    const stats = await fs.promises.stat(filePath);
    return {
      size: stats.size,
      created: stats.birthtime.getTime(),
      modified: stats.mtime.getTime(),
      accessed: stats.atime.getTime(),
      isDirectory: stats.isDirectory(),
      extension: path.extname(filePath).toLowerCase()
    };
  } catch (error) {
    log.error('Failed to get file info:', error);
    return null;
  }
}
