import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { URL } from 'url';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import log from 'electron-log';
import { AppConfig, applyCommandLineArgs, loadConfig, parseAddress, toLocalClientAddress, DEFAULT_CONFIG_PATH } from './config.js';
import { FileIndexService } from './indexer.js';
import { getFileInfo, getPreviewData } from './preview.js';

import os from 'os';

const DIST_RENDERER_PATH = path.join(__dirname, '..', 'renderer');
const IS_DEV = process.argv.includes('--dev');
const VITE_DEV_PORT = 6544;

const CIPHER_KEY = scryptSync('filehub-static-key', 'filehub-salt', 32);

function encryptPass(plain: string): string {
  if (!plain) return '';
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', CIPHER_KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + enc.toString('hex');
}

function decryptPass(stored: string): string {
  if (!stored || !stored.includes(':')) return stored;
  try {
    const [ivHex, encHex] = stored.split(':');
    const decipher = createDecipheriv('aes-256-cbc', CIPHER_KEY, Buffer.from(ivHex, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]).toString('utf8');
  } catch { return ''; }
}

const platform = os.platform();

let config: AppConfig = loadConfig();

function parseCommandLineArgs(): void {
  config = applyCommandLineArgs(config, process.argv.slice(2));
}

function sendJson(res: http.ServerResponse, statusCode: number, body: unknown): void {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(body));
}

function readJsonBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        resolve({});
      }
    });
  });
}

function getLanIp(): string {
  try {
    const interfaces = require('os').networkInterfaces();
    for (const iface of Object.values(interfaces) as any[]) {
      for (const addr of iface) {
        if (addr.family === 'IPv4' && !addr.internal) return addr.address;
      }
    }
  } catch {}
  return 'unknown';
}

function openFile(filePath: string): boolean {
  try {
    if (platform === 'win32') {
      spawn('cmd.exe', ['/c', 'start', '', filePath], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true
      }).unref();
    } else if (platform === 'darwin') {
      spawn('open', [filePath], {
        detached: true,
        stdio: 'ignore'
      }).unref();
    } else {
      spawn('xdg-open', [filePath], {
        detached: true,
        stdio: 'ignore'
      }).unref();
    }
    return true;
  } catch (error) {
    log.error('Failed to open file from web API:', error);
    return false;
  }
}

function openInExplorer(filePath: string): boolean {
  try {
    if (platform === 'win32') {
      spawn('explorer.exe', [`/select,${filePath}`], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true
      }).unref();
    } else if (platform === 'darwin') {
      spawn('open', ['-R', filePath], {
        detached: true,
        stdio: 'ignore'
      }).unref();
    } else {
      spawn('xdg-open', [path.dirname(filePath)], {
        detached: true,
        stdio: 'ignore'
      }).unref();
    }
    return true;
  } catch (error) {
    log.error('Failed to open explorer from web API:', error);
    return false;
  }
}

function openTerminal(workDir: string): boolean {
  try {
    if (platform === 'win32') {
      spawn('cmd.exe', ['/c', 'start', 'cmd', '/k', `cd /d "${workDir}"`], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
        shell: true
      }).unref();
    } else if (platform === 'darwin') {
      spawn('osascript', ['-e', `tell app "Terminal" to do script "cd '${workDir}'"`], {
        detached: true,
        stdio: 'ignore'
      }).unref();
    } else {
      spawn('x-terminal-emulator', ['-e', `cd "${workDir}" && $SHELL`], {
        detached: true,
        stdio: 'ignore'
      }).unref();
    }
    return true;
  } catch (error) {
    log.error('Failed to open terminal from web API:', error);
    return false;
  }
}

async function start(): Promise<void> {
  parseCommandLineArgs();

  const indexService = new FileIndexService(config);
  await indexService.initialize();

  const server = http.createServer(async (req, res) => {
    if (!req.url) {
      sendJson(res, 400, { error: 'Missing request URL.' });
      return;
    }

    if (req.method === 'OPTIONS') {
      sendJson(res, 204, {});
      return;
    }

    const remoteIp = req.socket.remoteAddress || '';
    const isLocalhost = remoteIp === '127.0.0.1' || remoteIp === '::1' || remoteIp === '::ffff:127.0.0.1';

    const lanEnabled = (config as any).lanEnabled ?? (getLanIp() !== 'unknown');

    if (!isLocalhost && !lanEnabled) {
      res.writeHead(403, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'LAN access disabled' }));
      return;
    }

    // Basic Auth for LAN requests
    if (!isLocalhost && (config as any).lanUser) {
      const auth = req.headers['authorization'] || '';
      const plainPass = decryptPass((config as any).lanPass || '');
      const expected = 'Basic ' + Buffer.from(`${(config as any).lanUser}:${plainPass}`).toString('base64');
      if (auth !== expected) {
        res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="FileHub"', 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }
    }

    const url = new URL(req.url, 'http://127.0.0.1');

    try {
      if (req.method === 'GET' && url.pathname === '/api/health') {
        sendJson(res, 200, { ok: true });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/status') {
        sendJson(res, 200, indexService.getStatus());
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/volumes') {
        sendJson(res, 200, indexService.getVolumes());
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/search') {
        const query = url.searchParams.get('query') || '';
        const maxResults = Number(url.searchParams.get('maxResults') || '100');
        const searchType = url.searchParams.get('searchType') || 'string';
        const searchInPath = url.searchParams.get('searchInPath') === 'true';
        sendJson(res, 200, indexService.search(query, maxResults, searchType, searchInPath));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/rebuild') {
        const body = await readJsonBody(req);
        const directories = Array.isArray(body.directories) ? body.directories : undefined;
        const result = await indexService.rebuildIndex(directories);
        sendJson(res, 200, result);
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/file-info') {
        const filePath = url.searchParams.get('path');
        if (!filePath) {
          sendJson(res, 400, { error: 'Missing path.' });
          return;
        }
        sendJson(res, 200, await getFileInfo(filePath));
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/preview') {
        const filePath = url.searchParams.get('path');
        if (!filePath) {
          sendJson(res, 400, { success: false, error: 'Missing path.' });
          return;
        }
        sendJson(res, 200, await getPreviewData(filePath));
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/file-stream') {
        const filePath = url.searchParams.get('path');
        if (!filePath || !fs.existsSync(filePath)) {
          sendJson(res, 404, { error: 'File not found.' });
          return;
        }
        const ext = path.extname(filePath).toLowerCase();
        const mime: Record<string, string> = {
          '.pdf': 'application/pdf',
          '.svg': 'image/svg+xml',
          '.doc': 'application/msword',
          '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          '.xls': 'application/vnd.ms-excel',
          '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          '.ppt': 'application/vnd.ms-powerpoint',
          '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          '.mp3': 'audio/mpeg',
          '.wav': 'audio/wav',
          '.ogg': 'audio/ogg',
          '.mp4': 'video/mp4',
          '.webm': 'video/webm',
          '.avi': 'video/x-msvideo',
          '.mkv': 'video/x-matroska',
          '.mov': 'video/quicktime',
        };
        const contentType = mime[ext] || 'application/octet-stream';
        const fileName = path.basename(filePath);
        const encodedFileName = encodeURIComponent(fileName);
        const isInline = contentType.startsWith('image/') || contentType.startsWith('audio/') || contentType.startsWith('video/') || contentType === 'application/pdf' || contentType.startsWith('text/') || contentType.includes('officedocument');
        const disposition = isInline ? 'inline' : 'attachment';
        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': fs.statSync(filePath).size,
          'Access-Control-Allow-Origin': '*',
          'Content-Disposition': `${disposition}; filename="${encodedFileName}"`,
        });
        fs.createReadStream(filePath).pipe(res);
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/open-file') {
        const body = await readJsonBody(req);
        const openMode = config.openMode ?? 'local';
        if (openMode === 'disabled') { sendJson(res, 200, { success: false }); return; }
        if (openMode === 'remote') {
          const fp = typeof body.path === 'string' ? body.path : null;
          sendJson(res, 200, fp ? { success: true, streamUrl: `/api/file-stream?path=${encodeURIComponent(fp)}` } : { success: false });
          return;
        }
        sendJson(res, 200, { success: typeof body.path === 'string' ? openFile(body.path) : false });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/open-in-explorer') {
        const body = await readJsonBody(req);
        if ((config.openMode ?? 'local') !== 'local') { sendJson(res, 200, { success: false }); return; }
        sendJson(res, 200, { success: typeof body.path === 'string' ? openInExplorer(body.path) : false });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/open-terminal') {
        const body = await readJsonBody(req);
        if ((config.openMode ?? 'local') !== 'local') { sendJson(res, 200, { success: false }); return; }
        sendJson(res, 200, { success: typeof body.workDir === 'string' ? openTerminal(body.workDir) : false });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/lan-info') {
        const lanIp = getLanIp();
        const port = parseAddress(config.address || '0.0.0.0:6543').port;
        const lanEnabled = (config as any).lanEnabled ?? (lanIp !== 'unknown');
        sendJson(res, 200, { ip: lanIp, port, lanEnabled, lanUser: (config as any).lanUser ?? '' });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/config') {
        sendJson(res, 200, config);
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/debug') {
        const info: Record<string, unknown> = {
          platform: platform,
          nodeVersion: process.version,
          indexStatus: indexService.getStatus(),
          indexedDirectories: config.indexedDirectories,
          excludePatterns: config.excludePatterns,
          address: config.address
        };
        
        if (platform !== 'win32' && platform !== 'darwin' && platform !== 'linux') {
          // Android - add Android-specific info
          const os = require('os');
          info.totalMemory = os.totalmem();
          info.freeMemory = os.freemem();
          info.cpus = os.cpus().length;
        } else {
          // Desktop Node.js
          const os = require('os');
          info.hostname = os.hostname();
          info.platformInfo = os.platform() + ' ' + os.release();
          info.uptime = os.uptime();
          info.totalMemory = os.totalmem();
          info.freeMemory = os.freemem();
        }
        
        sendJson(res, 200, info);
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/config') {
        const body = await readJsonBody(req);
        const newConfig = { ...config };
        
        if (Array.isArray(body.indexedDirectories)) {
          newConfig.indexedDirectories = body.indexedDirectories.map(String);
        }
        if (Array.isArray(body.excludePatterns)) {
          newConfig.excludePatterns = body.excludePatterns.map(String);
        }
        if (body.theme === 'light' || body.theme === 'dark') {
          newConfig.theme = body.theme;
        }
        if (typeof body.lanEnabled === 'boolean') (newConfig as any).lanEnabled = body.lanEnabled;
        if (typeof body.lanUser === 'string') (newConfig as any).lanUser = body.lanUser;
        if (!(newConfig as any).lanUser) {
          (newConfig as any).lanPass = '';
        } else if (typeof body.lanPass === 'string' && body.lanPass) {
          (newConfig as any).lanPass = encryptPass(body.lanPass);
        }

        const yaml = require('js-yaml');
        const yamlContent = yaml.dump({
          indexedDirectories: newConfig.indexedDirectories,
          useAdminMode: newConfig.useAdminMode,
          address: newConfig.address,
          excludePatterns: newConfig.excludePatterns,
          theme: newConfig.theme ?? 'dark',
          lanEnabled: (newConfig as any).lanEnabled ?? false,
          lanUser: (newConfig as any).lanUser ?? '',
          ...((newConfig as any).lanPass ? { lanPass: (newConfig as any).lanPass } : {})
        });
        
        const dirsChanged = JSON.stringify(config.indexedDirectories) !== JSON.stringify(newConfig.indexedDirectories);
        const excludeChanged = JSON.stringify(config.excludePatterns) !== JSON.stringify(newConfig.excludePatterns);

        fs.writeFileSync(DEFAULT_CONFIG_PATH, yamlContent, 'utf8');
        config = newConfig;
        
        indexService.updateConfig(config);
        
        if (dirsChanged || excludeChanged) {
          indexService.rebuildIndex().then(() => {
            log.info('Background index rebuild complete');
          }).catch((err) => {
            log.error('Background index rebuild failed:', err);
          });
        }

        sendJson(res, 200, { success: true, config: newConfig, indexing: dirsChanged || excludeChanged });
        return;
      }

      if (req.url) {
        if (IS_DEV) {
          const target = `http://127.0.0.1:${VITE_DEV_PORT}${req.url}`;
          const urlObj = new URL(target);
          const proxyReq = http.request({
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname + urlObj.search,
            method: req.method,
            headers: req.headers
          }, (proxyRes) => {
            res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
            proxyRes.pipe(res, { end: true });
          });
          req.pipe(proxyReq, { end: true });
          return;
        }

        const staticPath = url.pathname === '/' ? '/index.html' : url.pathname;
        const filePath = path.join(DIST_RENDERER_PATH, staticPath);
        const ext = path.extname(filePath).toLowerCase();
        const contentTypes: Record<string, string> = {
          '.html': 'text/html; charset=utf-8',
          '.js': 'application/javascript; charset=utf-8',
          '.mjs': 'application/javascript; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
          '.json': 'application/json; charset=utf-8',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.svg': 'image/svg+xml',
          '.ico': 'image/x-icon',
        };

        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const contentType = contentTypes[ext] || 'application/octet-stream';
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(fs.readFileSync(filePath));
          return;
        }

        const indexPath = path.join(DIST_RENDERER_PATH, 'index.html');
        if (fs.existsSync(indexPath)) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(fs.readFileSync(indexPath));
          return;
        }
      }

      sendJson(res, 404, { error: 'Not found.' });
    } catch (error: any) {
      log.error('Web API request failed:', error);
      sendJson(res, 500, { error: error.message || 'Internal server error.' });
    }
  });

  const { host, port } = process.env.WEB_API_HOST && process.env.WEB_API_PORT
    ? { host: process.env.WEB_API_HOST, port: Number(process.env.WEB_API_PORT) }
    : parseAddress(config.address);
  server.listen(port, host, () => {
    log.info(`Web API listening on http://${host}:${port}`);
  });
}

start().catch((error) => {
  log.error('Failed to start web server:', error);
  process.exit(1);
});
