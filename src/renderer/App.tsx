import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Prism from 'prismjs';
import { 
  FileText, FileJson, FileCode, FileImage, FileVideo, FileAudio, 
  FileArchive, FileSpreadsheet, File, Folder, Search, LayoutTemplate,
  Settings, HelpCircle, RefreshCw, X, Plus, Terminal, ExternalLink,
  ChevronDown, Copy, Check, Maximize2, Minimize2, Link, Download, WrapText, Share2
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-markup-templating';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-ruby';
import 'prismjs/components/prism-php';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-powershell';
import 'prismjs/components/prism-batch';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-toml';
import 'prismjs/components/prism-docker';
import 'prismjs/components/prism-diff';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-markdown';
import 'prismjs/themes/prism-tomorrow.css';

interface FileSearchResult {
  name: string;
  path: string;
  size: number;
  modified: number;
  isDirectory: boolean;
}

interface IndexStatus {
  status: 'idle' | 'indexing' | 'not_initialized';
  fileCount: number;
  indexedDirectories: string[];
}

interface IndexProgress {
  current: number;
  total: number;
  currentDir: string;
}

interface FileInfo {
  size: number;
  created: number;
  modified: number;
  accessed: number;
  isDirectory: boolean;
  extension: string;
}

interface PreviewData {
  success: boolean;
  data?: string;
  ext?: string;
  error?: string;
  contentEncoding?: 'base64' | 'utf8' | 'stream';
  streamUrl?: string;
  truncated?: boolean;
}

interface Tab {
  id: number;
  query: string;
  results: FileSearchResult[];
  selectedIndex: number;
  previewFile: FileSearchResult | null;
  previewContent: string | null;
  previewEncoding: 'base64' | 'utf8' | 'stream' | null;
  previewType: 'image' | 'text' | 'video' | 'audio' | 'pdf' | 'xlsx' | 'code' | 'ppt' | 'none' | 'midi';
  fileInfo: FileInfo | null;
  previewLoading: boolean;
  previewError: string | null;
  previewTruncated: boolean;
  searchType: 'string' | 'fuzzy' | 'regex';
  mdView: 'reader' | 'code';
}

type PreviewType = 'image' | 'text' | 'video' | 'audio' | 'pdf' | 'xlsx' | 'code' | 'ppt' | 'none' | 'midi';

const TEXT_PREVIEW_EXTENSIONS = ['txt', 'text', 'md', 'mdx', 'rst', 'adoc', 'tex', 'json', 'jsonc', 'json5', 'js', 'mjs', 'cjs', 'ts', 'mts', 'cts', 'jsx', 'tsx', 'css', 'scss', 'sass', 'less', 'html', 'htm', 'xhtml', 'xml', 'yml', 'yaml', 'toml', 'ini', 'cfg', 'conf', 'config', 'cnf', 'log', 'out', 'err', 'properties', 'prop', 'sh', 'bash', 'zsh', 'fish', 'bat', 'cmd', 'ps1', 'psm1', 'py', 'pyw', 'java', 'c', 'cc', 'cpp', 'cxx', 'h', 'hh', 'hpp', 'hxx', 'cs', 'fs', 'vb', 'go', 'rs', 'rb', 'php', 'swift', 'kt', 'kts', 'scala', 'sql', 'csv', 'tsv', 'env', 'lua', 'r', 'graphql', 'gql', 'proto', 'dart', 'erl', 'ex', 'exs', 'clj', 'groovy', 'gradle', 'dockerfile', 'vue', 'svelte', 'lock'];
const CODE_EXTENSIONS = ['js', 'mjs', 'cjs', 'ts', 'mts', 'cts', 'jsx', 'tsx', 'py', 'java', 'c', 'cc', 'cpp', 'cxx', 'h', 'hh', 'hpp', 'hxx', 'cs', 'fs', 'vb', 'go', 'rs', 'rb', 'php', 'swift', 'kt', 'kts', 'sql', 'html', 'htm', 'xml', 'css', 'scss', 'sass', 'less', 'json', 'jsonc', 'json5', 'yaml', 'yml', 'toml', 'md', 'mdx', 'sh', 'bash', 'zsh', 'fish', 'bat', 'cmd', 'ps1', 'psm1', 'lua', 'r', 'scala', 'graphql', 'gql', 'proto', 'dart', 'groovy', 'gradle', 'vue', 'svelte', 'ini', 'cfg', 'conf', 'config', 'log', 'env', 'dockerfile', 'properties', 'diff', 'patch'];
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'ico', 'svg'];
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'avi', 'mkv', 'mov', 'wmv'];
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma'];
const MIDI_EXTENSIONS = ['mid', 'midi'];
const PDF_EXTENSIONS = ['pdf'];
const XLSX_EXTENSIONS = ['xlsx', 'xls'];
const PPT_EXTENSIONS = ['ppt', 'pptx'];
const OFFICE_EXTENSIONS = ['doc', 'docx'];
const TEXT_PREVIEW_FILENAMES = ['dockerfile', 'makefile', 'cmakelists.txt', 'license', 'licence', 'readme', 'readme.md', '.gitignore', '.gitattributes', '.editorconfig', '.npmrc', '.yarnrc', '.yarnrc.yml', '.prettierrc', '.prettierrc.json', '.prettierrc.js', '.prettierrc.cjs', '.eslintrc', '.eslintrc.js', '.eslintrc.cjs', '.eslintrc.json', '.eslintrc.yml', '.babelrc', '.babelrc.json', '.nvmrc', '.node-version'];

const API_BASE: string = (typeof window !== 'undefined' && (window as any).__FILEHUB_API_BASE__) || '';

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(API_BASE + path);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(API_BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

interface AppConfig {
  indexedDirectories: string[];
  useAdminMode: boolean;
  address: string;
  excludePatterns: string[];
  theme?: 'dark' | 'light';
  lanEnabled?: boolean;
}

function isLocalBrowserClient(): boolean {
  if ((window as any).__FILEHUB_IS_LOCAL__) return true;
  const host = window.location.hostname;
  return host === '127.0.0.1' || host === 'localhost';
}

function isAndroidWebView(): boolean {
  return /Android/.test(navigator.userAgent) && /wv/.test(navigator.userAgent);
}

function getMimeTypeFromExt(ext: string): string {
  const e = ext.toLowerCase();
  const map: Record<string, string> = {
    'html': 'text/html', 'htm': 'text/html',
    'txt': 'text/plain', 'text': 'text/plain',
    'json': 'application/json', 'js': 'application/javascript',
    'css': 'text/css', 'xml': 'application/xml',
    'md': 'text/markdown', 'mdown': 'text/markdown',
    'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
    'gif': 'image/gif', 'webp': 'image/webp', 'bmp': 'image/bmp',
    'svg': 'image/svg+xml', 'ico': 'image/x-icon',
    'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'ogg': 'audio/ogg',
    'flac': 'audio/flac', 'aac': 'audio/aac', 'm4a': 'audio/mp4',
    'mp4': 'video/mp4', 'webm': 'video/webm',
    'avi': 'video/x-msvideo', 'mkv': 'video/x-matroska',
    'mov': 'video/quicktime', 'wmv': 'video/x-ms-wmv',
    'pdf': 'application/pdf',
    'zip': 'application/zip', 'rar': 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
    'tar': 'application/x-tar', 'gz': 'application/gzip',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'apk': 'application/vnd.android.package-archive',
    'kt': 'text/plain', 'kts': 'text/plain',
    'ts': 'text/plain', 'tsx': 'text/plain', 'jsx': 'text/plain',
    'yaml': 'text/plain', 'yml': 'text/plain',
    'toml': 'text/plain', 'ini': 'text/plain', 'cfg': 'text/plain',
  };
  return map[e] || '';
}

function isAndroidApp(): boolean {
  return navigator.userAgent.includes('FileHub');
}

function isAndroid(): boolean {
  return /Android/.test(navigator.userAgent);
}

function getRemoteOpenEnabled(): boolean {
  if (isAndroidApp()) return true;
  const saved = localStorage.getItem('filehub-remote-open');
  console.log('remoteOpen saved:', saved);
  return saved !== 'false';
}

function canBrowserView(ext: string): boolean {
  const mime = getMimeTypeFromExt(ext);
  if (!mime) return false;
  if (mime.startsWith('image/') || mime.startsWith('audio/') || mime.startsWith('video/')) return true;
  if (mime === 'application/pdf') return true;
  if (mime === 'text/html' || mime === 'text/plain') return true;
  if (mime.includes('office') || mime.includes('document') || mime.includes('sheet') || mime.includes('presentation')) return true;
  return false;
}

const browserFallbackAPI = {
  search: async (query: string, maxResults?: number, searchType?: string, searchInPath?: boolean) => {
    const params = new URLSearchParams({
      query,
      maxResults: String(maxResults ?? 100),
      searchType: searchType ?? 'string',
      searchInPath: String(searchInPath ?? false)
    });
    const res = await apiGet<any>(`/api/search?${params.toString()}`);
    return Array.isArray(res) ? res : (res?.results ?? []);
  },
  getIndexStatus: async () => {
    const res = await apiGet<any>('/api/status');
    return { status: res.status, fileCount: res.fileCount, indexedDirectories: res.indexedDirectories || [] };
  },
  rebuildIndex: async (directories?: string[]) => apiPost<any>('/api/rebuild', { directories }),
  getConfig: async () => apiGet<AppConfig>('/api/config'),
  saveConfig: async (config: Partial<AppConfig>) => apiPost<{ success: boolean; config: AppConfig }>('/api/config', config),
  openFile: async (filePath: string) => {
    const ext = filePath.split('.').pop() || '';
    const isLocal = isLocalBrowserClient() || isAndroidApp() || isAndroid();
    if (!isLocal) {
      if (!getRemoteOpenEnabled()) { return false; }
      // LAN client: open via browser (downloads/opens locally on client)
      window.open(API_BASE + `/api/file-stream?path=${encodeURIComponent(filePath)}`, '_blank');
      return true;
    }
    const result = await apiPost<{ success: boolean; streamUrl?: string }>('/api/open-file', { path: filePath });
    if (result.streamUrl) {
      window.open(API_BASE + result.streamUrl, '_blank');
      return true;
    }
    return result.success;
  },
  openInExplorer: async (filePath: string) => {
    if (!isLocalBrowserClient()) return false;
    const result = await apiPost<{ success: boolean }>('/api/open-in-explorer', { path: filePath });
    return result.success;
  },
  openTerminal: async (workDir: string) => {
    if (!isLocalBrowserClient()) return false;
    const result = await apiPost<{ success: boolean }>('/api/open-terminal', { workDir });
    return result.success;
  },
  getVolumes: async () => apiGet<string[]>('/api/volumes'),
  selectDirectory: async () => null,
  readFile: async () => null,
  getFileInfo: async (filePath: string) => {
    const params = new URLSearchParams({ path: filePath });
    return apiGet<FileInfo | null>(`/api/file-info?${params.toString()}`);
  },
  getPreviewData: async (filePath: string) => {
    const params = new URLSearchParams({ path: filePath });
    return apiGet<PreviewData>(`/api/preview?${params.toString()}`);
  },
  onIndexProgress: () => () => {},
  onIndexComplete: () => () => {},
  onOpenSettings: () => () => {}
};

let tabIdCounter = 1;

const PDFViewerBase64: React.FC<{ base64Data: string }> = ({ base64Data }) => {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);
  const pdfDocRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const binary = atob(base64Data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
        if (cancelled) return;
        pdfDocRef.current = pdf;
        setNumPages(pdf.numPages);
        setCurrentPage(1);
        setError(null);
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to load PDF');
      }
    })();
    return () => { cancelled = true; };
  }, [base64Data]);

  useEffect(() => {
    if (!pdfDocRef.current || numPages === 0) return;
    const timer = setTimeout(async () => {
      try {
        if (renderTaskRef.current) { renderTaskRef.current.cancel(); renderTaskRef.current = null; }
        const page = await pdfDocRef.current.getPage(currentPage);
        if (!canvasRef.current) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        const viewport = page.getViewport({ scale: scale * dpr });
        const canvas = canvasRef.current;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / dpr}px`;
        canvas.style.height = `${viewport.height / dpr}px`;
        const task = page.render({ canvasContext: canvas.getContext('2d')!, viewport });
        renderTaskRef.current = task;
        await task.promise;
        renderTaskRef.current = null;
      } catch (e: any) {
        if (e?.name !== 'RenderingCancelledException') setError(e.message || 'Render failed');
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [currentPage, scale, numPages]);

  const pinchRef = useRef<{ dist: number } | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const bindPinch = (el: HTMLDivElement | null) => {
    (canvasContainerRef as any).current = el;
    if (!el) return;
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const newDist = Math.hypot(dx, dy);
        const ratio = newDist / pinchRef.current.dist;
        pinchRef.current.dist = newDist;
        setScale(s => +Math.max(0.5, Math.min(3, s * ratio)).toFixed(2));
      }
    };
    el.addEventListener('touchmove', onTouchMove, { passive: false });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = { dist: Math.hypot(dx, dy) };
    }
  };

  const handleTouchEnd = () => { pinchRef.current = null; };
  if (!numPages) return <div className="preview-loading">Loading PDF...</div>;

  return (
    <div className={`pdf-viewer${fullscreen ? ' pdf-fullscreen' : ''}`}>
      <div className="pdf-toolbar">
        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}>‹</button>
        <span>{currentPage} / {numPages}</span>
        <button onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))} disabled={currentPage >= numPages}>›</button>
        <button onClick={() => setScale(s => +(Math.max(0.5, s - 0.2).toFixed(1)))}>−</button>
        <span>{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale(s => +(Math.min(3, s + 0.2).toFixed(1)))}>+</button>
        <button onClick={() => setScale(1.2)} title="Reset zoom">↺</button>
        <button onClick={() => setFullscreen(f => !f)} title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'} style={{ marginLeft: 'auto' }}>
          {fullscreen ? '⊠' : '⛶'}
        </button>
      </div>
      <div ref={bindPinch} className="pdf-canvas-container"
        onWheel={(e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); setScale(s => +(Math.max(0.5, Math.min(3, s + (e.deltaY > 0 ? -0.1 : 0.1))).toFixed(1))); } }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
};

const createEmptyTab = (): Tab => ({
  id: tabIdCounter++,
  query: '',
  results: [],
  selectedIndex: 0,
  previewFile: null,
  previewContent: null,
  previewEncoding: null,
  previewType: 'none',
  fileInfo: null,
  previewLoading: false,
  previewError: null,
  previewTruncated: false,
  searchType: 'string',
  mdView: 'reader'
});

const App: React.FC = () => {
  const electronAPI = window.electronAPI ?? browserFallbackAPI;
  const isElectronRuntime = Boolean(window.electronAPI);
  const isDotnetRuntime = isElectronRuntime;
  const [tabs, setTabs] = useState<Tab[]>([createEmptyTab()]);
  const [activeTabId, setActiveTabId] = useState(tabs[0].id);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [debugEnabled, setDebugEnabled] = useState(() => localStorage.getItem('filehub-debug') === 'true');
  const [debugData, setDebugData] = useState<any>(null);
  const [mode, setMode] = useState<'command' | 'search'>('search');
  const [status, setStatus] = useState<IndexStatus | null>(null);
  const [progress, setProgress] = useState<IndexProgress | null>(null);
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexedDirs, setIndexedDirs] = useState<string[]>([]);
  const [isPreviewMobileExpanded, setIsPreviewMobileExpanded] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);
  const [copiedContent, setCopiedContent] = useState(false);
  const [previewSearch, setPreviewSearch] = useState('');
  const [wordWrap, setWordWrap] = useState(true);
  const [pdfViewer, setPdfViewer] = useState<'builtin' | 'browser'>(() => (localStorage.getItem('filehub-pdf-viewer') as any) || 'builtin');
  const [officeView, setOfficeView] = useState<'plain' | 'rich'>(() => (localStorage.getItem('filehub-office-view') as any) || 'rich');
  const [textLineLimit, setTextLineLimit] = useState<number>(() => parseInt(localStorage.getItem('filehub-text-line-limit') || '20000', 10));
  const [scrollExpand, setScrollExpand] = useState(() => localStorage.getItem('filehub-scroll-expand') === 'true');
  const [searchInPath, setSearchInPath] = useState(() => localStorage.getItem('filehub-search-in-path') === 'true');
  const [maxResults, setMaxResults] = useState<number>(() => parseInt(localStorage.getItem('filehub-max-results') || '500', 10));
  const [bgMediaPlay, setBgMediaPlay] = useState(() => localStorage.getItem('filehub-bg-media-play') === 'true');
  const [mdReader, setMdReader] = useState(() => localStorage.getItem('filehub-md-reader') !== 'false');
  const [xlsxMaxMb, setXlsxMaxMb] = useState(50);
  const [textSelect, setTextSelect] = useState(() => localStorage.getItem('filehub-text-select') !== 'false');
  const [lanUser, setLanUser] = useState('');
  const [lanPass, setLanPass] = useState('');
  const [lanInfo, setLanInfo] = useState<{ ip: string; port: number; lanEnabled?: boolean } | null>({ ip: 'unknown', port: 0, lanEnabled: false });
  const [activeLineIndex, setActiveLineIndex] = useState<number | null>(null);
  
  const [excludePatterns, setExcludePatterns] = useState('');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('filehub-theme') as 'dark' | 'light') || 'dark');
  const [remoteOpenEnabled, setRemoteOpenEnabled] = useState(() => localStorage.getItem('filehub-remote-open') !== 'false');

  useEffect(() => {
    document.body.classList.toggle('light-theme', theme === 'light');
  }, [theme]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const appRef = useRef<HTMLDivElement>(null);
  const previewSearchRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const modeRef = useRef(mode);
  const tabsRef = useRef(tabs);
  const [previewWidth, setPreviewWidth] = useState(50);
  const previewPanelRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const mediaStableRef = useRef<HTMLDivElement>(null);
  const handleMediaPlayPause = useCallback(() => {
    const els = document.querySelectorAll<HTMLMediaElement>('video, audio');
    for (const el of els) {
      if (el.paused) { el.play(); return; }
      else { el.pause(); return; }
    }
    fetch(API_BASE + '/api/midi/play', { method: 'POST' }).catch(() => {});
  }, []);

  const handleMediaPlay = useCallback(() => {
    const el = document.querySelector<HTMLMediaElement>('video, audio');
    if (el) el.play();
    else fetch(API_BASE + '/api/midi/play', { method: 'POST' }).catch(() => {});
  }, []);

  const handleMediaPause = useCallback(() => {
    document.querySelectorAll<HTMLMediaElement>('video, audio').forEach(el => el.pause());
  }, []);

  const handleMediaStop = useCallback(() => {
    document.querySelectorAll<HTMLMediaElement>('video, audio').forEach(el => { el.pause(); el.currentTime = 0; });
    fetch(API_BASE + '/api/midi/stop').catch(() => {});
  }, []);
  
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);
  
  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[tabs.length - 1];
  
  useEffect(() => {
    loadStatus();
    loadConfig();
    apiGet<{ ip: string; port: number }>('/api/lan-info').then(setLanInfo).catch(() => {});

    const unsubProgress = electronAPI.onIndexProgress((prog) => {
      setProgress(prog);
      setIsIndexing(true);
    });

    const unsubComplete = electronAPI.onIndexComplete((_stats) => {
      setIsIndexing(false);
      setProgress(null);
      loadStatus();
    });

    // Web/Android mode: poll until indexing completes (no IPC events)
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    if (!window.electronAPI) {
      pollTimer = setInterval(async () => {
        try {
          const s = await electronAPI.getIndexStatus();
          setStatus(s);
          if (s.indexedDirectories) setIndexedDirs(s.indexedDirectories);
          if (s.status !== 'indexing') {
            clearInterval(pollTimer!);
            pollTimer = null;
          }
        } catch {}
      }, 1000);
    }

    inputRef.current?.focus();

    const onFocus = () => appRef.current?.focus();
    window.addEventListener('focus', onFocus);

    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === 'filehub-focus') appRef.current?.focus();
    };
    window.addEventListener('message', onMsg);

    return () => {
      unsubProgress();
      unsubComplete();
      if (pollTimer) clearInterval(pollTimer);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('message', onMsg);
    };
  }, []);

  const loadConfig = async () => {
    try {
      const cfg = await electronAPI.getConfig();
      setExcludePatterns(cfg.excludePatterns?.join(', ') || '');
      if (cfg.indexedDirectories) {
        setIndexedDirs(cfg.indexedDirectories);
      }
      if (cfg.theme) {
        setTheme(cfg.theme);
        localStorage.setItem('filehub-theme', cfg.theme);
      }
      if (cfg.lanEnabled !== undefined) {
        setLanInfo(prev => prev ? { ...prev, lanEnabled: cfg.lanEnabled } : { ip: 'unknown', port: 0, lanEnabled: cfg.lanEnabled });
      }
      if (cfg.xlsxMaxMb !== undefined) setXlsxMaxMb(cfg.xlsxMaxMb);
      if ((cfg as any).lanUser !== undefined) setLanUser((cfg as any).lanUser);
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  };

  const saveConfig = async () => {
    const excludeList = excludePatterns.split(',').map(s => s.trim()).filter(Boolean);
    setShowSettings(false);
    setStatusMessage('⚙️ Saving...');
    try {
      const result = await electronAPI.saveConfig({
        indexedDirectories: indexedDirs,
        excludePatterns: excludeList,
        theme,
        xlsxMaxMb,
        lanUser,
        ...(lanPass ? { lanPass } : {})
      } as any);
      if ((result as any)?.indexing === false) {
        setStatusMessage('⚙️ Saved');
        setTimeout(() => setStatusMessage(null), 2000);
      } else {
        const polling = setInterval(async () => {
          try {
            const s = await electronAPI.getIndexStatus();
            setStatus(s);
            if (s.status !== 'indexing') {
              clearInterval(polling);
              setIsIndexing(false);
              setStatusMessage('⚙️ Saved');
              setTimeout(() => setStatusMessage(null), 2000);
            }
          } catch {}
        }, 500);
      }
    } catch (error) {
      console.error('Failed to save config:', error);
      setStatusMessage(null);
    }
  };
  
  const loadStatus = async () => {
    try {
      const s = await electronAPI.getIndexStatus();
      setStatus(s);
      if (s.indexedDirectories) {
        setIndexedDirs(s.indexedDirectories);
      }
    } catch (error) {
      console.error('Failed to load status:', error);
    }
  };

  useEffect(() => {
    if (!isResizing) return;

    const panel = previewPanelRef.current;
    if (panel) panel.style.transition = 'none';

    const handleMouseMove = (e: MouseEvent) => {
      if (!panel) return;
      const container = panel.parentElement;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const w = Math.max(15, Math.min(80, 100 - ((e.clientX - rect.left) / rect.width) * 100));
      panel.style.width = `${w}%`;
    };

    const handleMouseUp = (e: MouseEvent) => {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      if (panel) {
        panel.style.transition = '';
        const container = panel.parentElement;
        if (container) {
          const rect = container.getBoundingClientRect();
          const w = Math.max(15, Math.min(80, 100 - ((e.clientX - rect.left) / rect.width) * 100));
          setPreviewWidth(w);
        }
      }
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);
  
  const updateTab = useCallback((tabId: number, updates: Partial<Tab>) => {
    setTabs(prev => prev.map(tab =>
      tab.id === tabId ? { ...tab, ...updates } : tab
    ));
  }, []);
  
  const updateActiveTab = useCallback((updates: Partial<Tab>) => {
    updateTab(activeTabId, updates);
  }, [activeTabId, updateTab]);
  
  const performSearch = useCallback(async (searchQuery: string, tabId: number, searchType: 'string' | 'fuzzy' | 'regex') => {
    if (!searchQuery.trim()) {
      updateTab(tabId, { results: [], selectedIndex: 0 });
      return;
    }
    
    try {
      const res = await electronAPI.search(searchQuery, maxResults, searchType, searchInPath);
      updateTab(tabId, { results: res, selectedIndex: 0 });
      if (res.length > 0) {
        const first = res[0];
        const type = getPreviewType(first.name);
        // Don't auto-load media — user must explicitly select
        if (type !== 'audio' && type !== 'video' && type !== 'midi') {
          loadPreviewForTab(first, tabId);
        }
      }
    } catch (error) {
      console.error('Search failed:', error);
      updateTab(tabId, { results: [], selectedIndex: 0 });
    }
  }, [electronAPI, updateTab, searchInPath]);
  
  const loadPreviewForTab = async (file: FileSearchResult, tabId: number = activeTabId) => {
    if (file.isDirectory) return;

    // Already loaded or loading this file — don't restart
    const existingTab = tabsRef.current.find(t => t.id === tabId);
    if (existingTab?.previewFile?.path === file.path && (existingTab.previewContent !== null || existingTab.previewLoading)) return;

    setPreviewSearch('');
    updateTab(tabId, {
      previewFile: file,
      previewLoading: true,
      previewContent: null,
      previewEncoding: null,
      previewType: 'none',
      previewError: null,
      previewTruncated: false,
      fileInfo: null
    });
    setIsPreviewMobileExpanded(false);
    setIsMaximized(false);
    setActiveLineIndex(null);
    
    try {
      const [previewData, info]: [PreviewData, FileInfo | null] = await Promise.all([
        electronAPI.getPreviewData(file.path),
        electronAPI.getFileInfo(file.path)
      ]);
      const detectedPreviewType = getPreviewType(file.name);
      const resolvedPreviewType = previewData.success
        ? (detectedPreviewType === 'none' && previewData.contentEncoding === 'utf8' ? 'text' : detectedPreviewType)
        : detectedPreviewType;
      
      updateTab(tabId, { 
        previewContent: previewData.success
          ? (previewData.contentEncoding === 'stream' ? (previewData.streamUrl ?? null) : (previewData.data ?? null))
          : null,
        previewEncoding: previewData.success ? (previewData.contentEncoding || null) : null,
        previewError: previewData.success ? null : (previewData.error || 'No preview available'),
        previewTruncated: Boolean(previewData.truncated),
        fileInfo: info,
        previewType: resolvedPreviewType,
        mdView: mdReader ? 'reader' : 'code'
      });
    } catch (error) {
      console.error('Failed to load preview:', error);
      updateTab(tabId, { previewType: 'none' });
    } finally {
      updateTab(tabId, { previewLoading: false });
    }
  };
  
  const closePreview = () => {
    updateActiveTab({
      previewFile: null,
      previewContent: null,
      previewEncoding: null,
      previewType: 'none',
      fileInfo: null,
      previewError: null,
      previewTruncated: false
    });
    setIsPreviewMobileExpanded(false);
    setIsMaximized(false);
    setActiveLineIndex(null);
  };
  
  const openFile = (filePath: string) => {
    browserFallbackAPI.openFile(filePath).catch(err => {
      console.error('Failed to open file:', err);
    });
  };

  const copyToClipboard = async (text: string) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  };

  const handleCopyPath = async () => {
    if (!activeTab.previewFile) return;
    await copyToClipboard(activeTab.previewFile.path);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2000);
  };

  const handleCopyContent = async () => {
    if (!activeTab.previewContent) return;
    await copyToClipboard(activeTab.previewContent);
    setCopiedContent(true);
    setTimeout(() => setCopiedContent(false), 2000);
  };

  const handlePreviewMouseUp = async () => {
    const selection = window.getSelection();
    const text = selection?.toString();
    if (text && text.trim().length > 0) {
      await copyToClipboard(text);
    }
  };

  const handleDownload = () => {
    if (!activeTab.previewFile) return;
    const a = document.createElement('a');
    if (activeTab.previewEncoding === 'base64' && activeTab.previewContent) {
      a.href = `data:${getMimeType(activeTab.previewFile.name)};base64,${activeTab.previewContent}`;
    } else if (activeTab.previewContent) {
      const blob = new Blob([activeTab.previewContent], { type: 'text/plain' });
      a.href = URL.createObjectURL(blob);
    } else {
      a.href = API_BASE + `/api/file-stream?path=${encodeURIComponent(activeTab.previewFile.path)}`;
    }
    a.download = activeTab.previewFile.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleShare = async () => {
    if (!activeTab.previewFile) return;
    const file = activeTab.previewFile;
    try {
      await apiPost('/api/share-file', { path: file.path });
    } catch {
      // fallback: copy LAN URL or path
      const lanUrl = lanInfo && lanInfo.ip !== 'unknown' && lanInfo.ip !== 'disabled'
        ? `http://${lanInfo.ip}:${lanInfo.port}/api/file-stream?path=${encodeURIComponent(file.path)}`
        : file.path;
      await copyToClipboard(lanUrl);
    }
  };

  const showInExplorer = (filePath: string) => {
    void electronAPI.openInExplorer(filePath);
  };
  
  const rebuildIndex = async () => {
    setIsIndexing(true);
    try {
      await electronAPI.rebuildIndex();
      // Electron: IPC events handle completion. Web/Android: poll until done.
      if (!window.electronAPI) {
        const poll = setInterval(async () => {
          try {
            const s = await electronAPI.getIndexStatus();
            setStatus(s);
            if (s.status !== 'indexing') {
              clearInterval(poll);
              setIsIndexing(false);
              setProgress(null);
            }
          } catch {}
        }, 800);
      }
    } catch (error) {
      console.error('Rebuild index failed:', error);
      setIsIndexing(false);
    }
  };
  
  const addDirectory = async () => {
    const dir = window.prompt('Enter directory path:');
    if (dir && dir.trim() && !indexedDirs.includes(dir.trim())) {
      const newDirs = [...indexedDirs, dir.trim()];
      setIndexedDirs(newDirs);
      setIsIndexing(true);
      electronAPI.rebuildIndex(newDirs);
    }
  };
  
  const removeDirectory = (dir: string) => {
    if (indexedDirs.length <= 1) return;
    const newDirs = indexedDirs.filter(d => d !== dir);
    setIndexedDirs(newDirs);
    electronAPI.rebuildIndex(newDirs);
  };
  
  const handleThemeChange = (newTheme: 'dark' | 'light') => {
    setTheme(newTheme);
    localStorage.setItem('filehub-theme', newTheme);
  };

  const handleExcludeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setExcludePatterns(e.target.value);
    localStorage.setItem('filehub-exclude', e.target.value);
  };
  
  const createTab = () => {
    const newTab = createEmptyTab();
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
    inputRef.current?.focus();
  };
  
  const closeTab = (tabId: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (tabs.length === 1) return;
    
    const tabIndex = tabs.findIndex(t => t.id === tabId);
    const newTabs = tabs.filter(t => t.id !== tabId);
    
    if (activeTabId === tabId) {
      const newActiveIndex = Math.min(tabIndex, newTabs.length - 1);
      setActiveTabId(newTabs[newActiveIndex].id);
    }
    
    setTabs(newTabs);
  };
  
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };
  
  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString() + ' ' + 
           new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  const getFileIcon = (result: FileSearchResult): React.ReactNode => {
    if (result.isDirectory) return <Folder size={24} color="#3b82f6" />;
    const ext = result.name.split('.').pop()?.toLowerCase() || '';
    
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) return <FileImage size={24} color="#10b981" />;
    if (['mp3', 'wav', 'ogg', 'mid', 'midi'].includes(ext)) return <FileAudio size={24} color="#f59e0b" />;
    if (['mp4', 'avi', 'mkv', 'webm'].includes(ext)) return <FileVideo size={24} color="#ef4444" />;
    if (['zip', 'rar', '7z', 'tar'].includes(ext)) return <FileArchive size={24} color="#8b5cf6" />;
    if (['xls', 'xlsx', 'csv'].includes(ext)) return <FileSpreadsheet size={24} color="#10b981" />;
    if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'html', 'css'].includes(ext)) return <FileCode size={24} color="#3b82f6" />;
    if (['json', 'yml', 'yaml', 'xml'].includes(ext)) return <FileJson size={24} color="#f59e0b" />;
    if (['txt', 'md', 'doc', 'docx', 'pdf'].includes(ext)) return <FileText size={24} color="#64748b" />;
    
    return <File size={24} color="#a1a1aa" />;
  };
  
  const getPreviewType = (filename: string): PreviewType => {
    const lower = filename.toLowerCase();
    const ext = lower.split('.').pop()?.toLowerCase() || '';
    if (TEXT_PREVIEW_FILENAMES.includes(lower)) return 'code';
    if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
    if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
    if (AUDIO_EXTENSIONS.includes(ext)) return 'audio';
    if (MIDI_EXTENSIONS.includes(ext)) return 'midi';
    if (PDF_EXTENSIONS.includes(ext)) return 'pdf';
    if (XLSX_EXTENSIONS.includes(ext)) return 'xlsx';
    if (PPT_EXTENSIONS.includes(ext)) return 'ppt';
    if (OFFICE_EXTENSIONS.includes(ext)) return 'text';
    if (CODE_EXTENSIONS.includes(ext)) return 'code';
    if (TEXT_PREVIEW_EXTENSIONS.includes(ext)) return 'text';
    return 'none';
  };
  
  const getMimeType = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const mimeTypes: Record<string, string> = {
      'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'gif': 'image/gif',
      'webp': 'image/webp', 'bmp': 'image/bmp', 'svg': 'image/svg+xml',
      'mp4': 'video/mp4', 'webm': 'video/webm', 'avi': 'video/x-msvideo',
      'mkv': 'video/x-matroska', 'mov': 'video/quicktime',
      'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'ogg': 'audio/ogg', 'flac': 'audio/flac',
      'pdf': 'application/pdf'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  };
  
  const renderPreview = () => {
    if (activeTab.previewLoading) {
      return <div className="preview-loading">Loading...</div>;
    }
    
    if (activeTab.previewError) {
      return <div className="preview-no-support">{activeTab.previewError}</div>;
    }

    if (activeTab.previewType === 'none' || (!activeTab.previewContent && activeTab.previewType !== 'midi')) {
      return <div className="preview-no-support">No preview available</div>;
    }
    
    const dataUrl = `data:${getMimeType(activeTab.previewFile?.name || '')};base64,${activeTab.previewContent}`;
    const rawText = activeTab.previewEncoding === 'utf8'
      ? activeTab.previewContent
      : '';  // binary types handle their own decoding
    const allLines = rawText ? rawText.split('\n') : [];
    const limitedText = previewSearch && rawText
      ? rawText.split('\n').filter((l: string) => l.toLowerCase().includes(previewSearch.toLowerCase())).join('\n')
      : allLines.slice(0, textLineLimit).join('\n');
    const textContent = limitedText;
    const isTextTruncated = !previewSearch && allLines.length > textLineLimit;
    
    switch (activeTab.previewType) {
      case 'image':
        return <ImagePreview base64Data={activeTab.previewContent!} filename={activeTab.previewFile?.name || ''} />;
      case 'video':
        if (activeTab.previewEncoding === 'stream') return <MediaSlot tabId={activeTab.id} stableRef={mediaStableRef} className="preview-video" bgPlay={bgMediaPlay} />;
        return <MediaPreview base64Data={activeTab.previewContent!} type="video" />;
      case 'audio':
        if (activeTab.previewEncoding === 'stream') return <MediaSlot tabId={activeTab.id} stableRef={mediaStableRef} className="preview-audio" bgPlay={bgMediaPlay} />;
        return <MediaPreview base64Data={activeTab.previewContent!} type="audio" />;
      case 'midi':
        return <MidiPlayer src={activeTab.previewContent!} />;
      case 'pdf':
        if (pdfViewer === 'browser') {
          return <BrowserPdfViewer filePath={activeTab.previewFile!.path} />;
        }
        return <PDFViewerBase64 base64Data={activeTab.previewContent!} />;
      case 'xlsx':
        return <XlsxViewer base64={activeTab.previewContent!} filter={previewSearch} officeView={officeView} />;
      case 'ppt':
        if (officeView === 'rich') {
          return <PptViewer text={textContent} />;
        }
        return <TextWithLineNumbers text={textContent} wordWrap={wordWrap} truncated={isTextTruncated} totalLines={allLines.length} />;
      case 'text': {
        const fileExt = activeTab.previewFile?.name.split('.').pop()?.toLowerCase() || '';
        if (officeView === 'rich' && fileExt === 'csv') {
          return <CsvViewer text={textContent} />;
        }
        if (officeView === 'rich' && ['doc', 'docx'].includes(fileExt)) {
          return <DocViewer text={textContent} wordWrap={wordWrap} />;
        }
        return <TextWithLineNumbers text={textContent} wordWrap={wordWrap} truncated={isTextTruncated} totalLines={allLines.length} />;
      }
      case 'code': {
        const ext = activeTab.previewFile?.name.split('.').pop()?.toLowerCase() || 'text';
        // Markdown reader mode
        if (activeTab.mdView === 'reader' && (ext === 'md' || ext === 'mdx') && !previewSearch) {
          return <MarkdownViewer text={textContent} />;
        }
        try {
          const ext = activeTab.previewFile?.name.split('.').pop()?.toLowerCase() || 'text';
          const prismLanguage = getPrismLanguage(ext);
          const grammar = Prism.languages[prismLanguage] || Prism.languages.plain;
          const highlighted = Prism.highlight(textContent, grammar, prismLanguage);
          const lines = highlighted.split('\n');
          return (
            <pre className={`preview-code language-${prismLanguage} ${wordWrap ? 'wrap' : 'no-wrap'}`}>
              <code className={`language-${prismLanguage} ${wordWrap ? 'wrap' : 'no-wrap'}`}>
                {lines.map((line, index) => (
                  <div 
                    className={`preview-code-line ${activeLineIndex === index ? 'active-line' : ''}`} 
                    key={index}
                    onClick={() => {
                      const txt = textContent.split('\n')[index];
                      copyToClipboard(txt);
                      setActiveLineIndex(index);
                    }}
                    title="Click to copy line"
                    style={{ cursor: 'pointer' }}
                  >
                    <span className="preview-code-gutter">{index + 1}</span>
                    <span
                      className="preview-code-content"
                      dangerouslySetInnerHTML={{ __html: line || ' ' }}
                    />
                  </div>
                ))}
              </code>
            </pre>
          );
        } catch {
          return <pre className={`preview-text ${wordWrap ? 'wrap' : 'no-wrap'}`}>{textContent}</pre>;
        }
      }
      default:
        return <div className="preview-no-support">Preview not supported</div>;
    }
  };

  const getPrismLanguage = (ext: string): string => {
    const languageMap: Record<string, string> = {
      js: 'javascript',
      mjs: 'javascript',
      cjs: 'javascript',
      jsx: 'jsx',
      ts: 'typescript',
      mts: 'typescript',
      cts: 'typescript',
      tsx: 'tsx',
      py: 'python',
      cs: 'csharp',
      cpp: 'cpp',
      cxx: 'cpp',
      hpp: 'cpp',
      hh: 'cpp',
      h: 'c',
      cc: 'cpp',
      sh: 'bash',
      bash: 'bash',
      zsh: 'bash',
      fish: 'bash',
      bat: 'batch',
      cmd: 'batch',
      ps1: 'powershell',
      psm1: 'powershell',
      yml: 'yaml',
      md: 'markdown',
      mdx: 'markdown',
      html: 'markup',
      htm: 'markup',
      xml: 'markup',
      svg: 'markup',
      jsonc: 'json',
      json5: 'json',
      scss: 'css',
      sass: 'css',
      less: 'css',
      gql: 'graphql',
      dockerfile: 'docker',
      properties: 'properties',
      prop: 'properties',
      diff: 'diff',
      patch: 'diff'
    };

    return languageMap[ext] || ext;
  };
  
  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const currentTabId = activeTab.id;
    const currentSearchType = activeTab.searchType;
    updateTab(currentTabId, { query: value });
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(value, currentTabId, currentSearchType);
    }, 50);
  };
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Don't intercept keys when preview filter input is focused
    if ((e.target as HTMLElement).classList.contains('preview-search-input')) return;

    if (showHelp) {
      setShowHelp(false);
      return;
    }
    
    if (showSettings) {
      if (e.key === 'Escape') {
        setShowSettings(false);
      }
      return;
    }
    
    const tabKeys = ['1', '2', '3', '4', '5', '6', '7', '8'];
    if (tabKeys.includes(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const index = parseInt(e.key) - 1;
      if (index < tabs.length) {
        setActiveTabId(tabs[index].id);
        setTimeout(() => resultsRef.current?.focus(), 0);
      }
      return;
    }
    
    switch (e.key) {
      case 'j':
      case 'ArrowDown':
        e.preventDefault();
        const newIndex1 = Math.min(activeTab.selectedIndex + 1, activeTab.results.length - 1);
        updateActiveTab({ selectedIndex: newIndex1 });
        if (activeTab.results.length > 0) {
          loadPreviewForTab(activeTab.results[newIndex1]);
        }
        break;
      case 'k':
      case 'ArrowUp':
        e.preventDefault();
        const newIndex2 = Math.max(activeTab.selectedIndex - 1, 0);
        updateActiveTab({ selectedIndex: newIndex2 });
        if (activeTab.results.length > 0) {
          loadPreviewForTab(activeTab.results[newIndex2]);
        }
        break;
      case 'h':
        e.preventDefault();
        if (activeTab.results.length > 0) {
          closePreview();
        }
        break;
      case 'l':
      case 'Enter':
        e.preventDefault();
        if (activeTab.results.length > 0) {
          openFile(activeTab.results[activeTab.selectedIndex].path);
        }
        break;
      case 'o':
        e.preventDefault();
        if (activeTab.results.length > 0) {
          const selected = activeTab.results[activeTab.selectedIndex];
          if (activeTab.previewFile?.path === selected.path) {
            closePreview();
          } else {
            loadPreviewForTab(selected);
          }
        }
        break;
      case 'f':
        e.preventDefault();
        if (previewSearchRef.current) {
          previewSearchRef.current.focus();
        }
        break;
      case 'O':
        e.preventDefault();
        if (activeTab.results.length > 0) {
          showInExplorer(activeTab.results[activeTab.selectedIndex].path);
        }
        break;
      case 'Escape':
        if (activeTab.previewFile) {
          closePreview();
        } else {
          setMode('command');
          if (tabs.length > 1) {
            closeTab(activeTabId);
          }
        }
        break;
      case 'q':
        if (activeTab.previewFile) {
          closePreview();
        } else if (activeTab.query || activeTab.results.length > 0) {
          updateActiveTab({
            query: '',
            results: [],
            selectedIndex: 0,
            previewFile: null,
            previewContent: null,
            previewEncoding: null,
            previewType: 'none',
            fileInfo: null,
            previewError: null,
            previewTruncated: false
          });
        } else if (tabs.length > 1) {
          closeTab(activeTabId);
        }
        break;
      case '?':
        e.preventDefault();
        setShowHelp(true);
        break;
      case 'r':
        e.preventDefault();
        rebuildIndex();
        break;
      case 's':
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          setShowSettings(!showSettings);
        }
        break;
      case 't':
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          createTab();
        }
        break;
      case 'w':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          closeTab(activeTabId);
        }
        break;
      case 'g':
        if (e.shiftKey) {
          e.preventDefault();
          updateActiveTab({ selectedIndex: activeTab.results.length - 1 });
          if (activeTab.results.length > 0) {
            loadPreviewForTab(activeTab.results[activeTab.results.length - 1]);
          }
        } else {
          e.preventDefault();
          updateActiveTab({ selectedIndex: 0 });
          if (activeTab.results.length > 0) {
            loadPreviewForTab(activeTab.results[0]);
          }
        }
        resultsRef.current?.focus();
        break;
      case 'G':
        e.preventDefault();
        updateActiveTab({ selectedIndex: activeTab.results.length - 1 });
        if (activeTab.results.length > 0) {
          loadPreviewForTab(activeTab.results[activeTab.results.length - 1]);
        }
        resultsRef.current?.focus();
        break;
      case '/':
        e.preventDefault();
        setMode('search');
        inputRef.current?.focus();
        break;
      case '!':
        e.preventDefault();
        {
          const selectedFile = activeTab.results[activeTab.selectedIndex];
          if (selectedFile) {
            const p = selectedFile.path;
            const workDir = selectedFile.isDirectory ? p : p.substring(0, Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\')));
            electronAPI.openTerminal(workDir || p);
          }
        }
        break;
      case '\\':
        e.preventDefault();
        {
          const types: Array<'string' | 'fuzzy' | 'regex'> = ['string', 'fuzzy', 'regex'];
          const currentIndex = types.indexOf(activeTab.searchType);
          const nextIndex = (currentIndex + 1) % types.length;
          updateActiveTab({ searchType: types[nextIndex] });
        }
        break;
      case 'p':
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          handleMediaPlayPause();
        }
        break;
    }
  }, [activeTab, tabs, activeTabId, showHelp, showSettings]);

  // Handle media keys from Android hardware keyboard
  useEffect(() => {
    const onMediaPlayPause = () => handleMediaPlayPause();
    const onMediaPlay = () => handleMediaPlay();
    const onMediaPause = () => handleMediaPause();
    const onMediaStop = () => handleMediaStop();

    window.addEventListener('media-play-pause', onMediaPlayPause);
    window.addEventListener('media-play', onMediaPlay);
    window.addEventListener('media-pause', onMediaPause);
    window.addEventListener('media-stop', onMediaStop);

    return () => {
      window.removeEventListener('media-play-pause', onMediaPlayPause);
      window.removeEventListener('media-play', onMediaPlay);
      window.removeEventListener('media-pause', onMediaPause);
      window.removeEventListener('media-stop', onMediaStop);
    };
  }, [handleMediaPlayPause, handleMediaPlay, handleMediaPause, handleMediaStop]);
  
  useEffect(() => {
    if (activeTab.selectedIndex >= 0 && resultsRef.current && activeTab.results.length > 0) {
      const element = resultsRef.current.children[activeTab.selectedIndex] as HTMLElement;
      if (element) {
        element.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [activeTab.selectedIndex]);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setMode('command');
      resultsRef.current?.focus();
      return;
    }
    
    const currentMode = modeRef.current;
    if (currentMode === 'command') {
      const commandKeys = ['j', 'k', 'h', 'l', 'g', 'G', 'ArrowDown', 'ArrowUp', 'Enter'];
      if (commandKeys.includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
      } else {
        e.stopPropagation();
      }
      
      switch (e.key) {
        case 'j':
        case 'ArrowDown':
          {
            const newIndex = Math.min(activeTab.selectedIndex + 1, activeTab.results.length - 1);
            updateActiveTab({ selectedIndex: newIndex });
            if (activeTab.results.length > 0) {
              loadPreviewForTab(activeTab.results[newIndex]);
            }
          }
          break;
        case 'k':
        case 'ArrowUp':
          {
            const newIndex = Math.max(activeTab.selectedIndex - 1, 0);
            updateActiveTab({ selectedIndex: newIndex });
            if (activeTab.results.length > 0) {
              loadPreviewForTab(activeTab.results[newIndex]);
            }
          }
          break;
        case 'h':
          if (activeTab.results.length > 0) {
            closePreview();
          }
          break;
        case 'l':
        case 'Enter':
          if (activeTab.results.length > 0) {
            openFile(activeTab.results[activeTab.selectedIndex].path);
          }
          break;
        case 'g':
          if (e.shiftKey) {
            updateActiveTab({ selectedIndex: Math.max(0, activeTab.results.length - 1) });
            if (activeTab.results.length > 0) {
              loadPreviewForTab(activeTab.results[activeTab.results.length - 1]);
            }
          } else {
            updateActiveTab({ selectedIndex: 0 });
            if (activeTab.results.length > 0) {
              loadPreviewForTab(activeTab.results[0]);
            }
          }
          break;
        case 'G':
          updateActiveTab({ selectedIndex: Math.max(0, activeTab.results.length - 1) });
          if (activeTab.results.length > 0) {
            loadPreviewForTab(activeTab.results[activeTab.results.length - 1]);
          }
          break;
        case 'p':
          e.preventDefault();
          handleMediaPlayPause();
          break;
      }
      return;
    }
    
    e.stopPropagation();
    setMode('search');
  };

  return (
    <div ref={appRef} className="app" tabIndex={0} onKeyDown={handleKeyDown}>
      <header className="header">
        <div className="tab-bar">
          {tabs.map((tab, index) => (
            <div 
              key={tab.id}
              className={`tab ${tab.id === activeTabId ? 'active' : ''}`}
              onClick={() => setActiveTabId(tab.id)}
            >
              <span className="tab-number">{index + 1}</span>
              <span className="tab-title">{tab.query || 'New Tab'}</span>
              {tabs.length > 1 && (
                <button className="tab-close" onClick={(e) => closeTab(tab.id, e)}><X size={14} /></button>
              )}
            </div>
          ))}
          <button className="tab-new" onClick={createTab} title="New Tab (t)"><Plus size={16} /></button>
        </div>
      </header>
      
      <div className="search-bar" onClick={() => inputRef.current?.focus()}>
        <div className="search-container">
          <div className="search-icon-wrapper">
             <Search size={18} />
          </div>
          <input
            ref={inputRef}
            type="text"
            className="search-input"
            placeholder="Type to search... (press / to focus)"
            value={activeTab.query}
            onChange={handleQueryChange}
            onKeyDown={handleInputKeyDown}
            onFocus={() => { setMode('search'); modeRef.current = 'search'; }}
            onBlur={() => { setMode('command'); modeRef.current = 'command'; }}
            disabled={status?.status === 'indexing'}
          />
        </div>
        <select 
          className="search-type-select"
          value={activeTab.searchType}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            const newType = e.target.value as 'string' | 'fuzzy' | 'regex';
            updateActiveTab({ searchType: newType });
            if (activeTab.query.trim()) {
              performSearch(activeTab.query, activeTab.id, newType);
            }
          }}
        >
          <option value="string">String</option>
          <option value="fuzzy">Fuzzy</option>
          <option value="regex">Regex</option>
        </select>
        <div className="search-info">
          {statusMessage && status?.status !== 'indexing' && (
            <span className="indexing-info">{statusMessage}</span>
          )}
          {status?.status === 'indexing' && (
            <div className="indexing-progress">
              <div className="indexing-spinner" />
              <span className="indexing-label">
                {progress ? `Indexing ${progress.current.toLocaleString()} files…` : 'Building index…'}
              </span>
              {progress?.currentDir && (
                <span className="indexing-dir" title={progress.currentDir}>{progress.currentDir}</span>
              )}
            </div>
          )}
          {status && status?.status !== 'indexing' && (
            <span className="file-count">
              {(status.fileCount ?? 0).toLocaleString()} files | {activeTab.results.length} results
            </span>
          )}
        </div>
      </div>

      {showSettings && (
        <div className="help-panel settings-panel">
          <h3>Settings</h3>

          <SettingsSection title="Indexed Directories" icon={<Folder size={14} />}>
            <div className="dir-list">
              {indexedDirs.length === 0 ? (
                <div className="empty-dirs text-muted">No directories indexed.</div>
              ) : (
                indexedDirs.map((dir, i) => (
                  <div key={i} className="dir-item">
                    <span>{dir}</span>
                    {indexedDirs.length > 1 && (
                      <button className="btn-remove" onClick={() => removeDirectory(dir)} title="Remove">×</button>
                    )}
                  </div>
                ))
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input id="new-dir-input" type="text" placeholder="Enter directory path..."
                style={{ flex: 1, padding: '8px 12px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px', fontSize: 13, outline: 'none' }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const input = e.target as HTMLInputElement;
                    if (input.value.trim() && !indexedDirs.includes(input.value.trim())) {
                      const newDirs = [...indexedDirs, input.value.trim()];
                      setIndexedDirs(newDirs);
                      setIsIndexing(true);
                      electronAPI.rebuildIndex(newDirs);
                      input.value = '';
                    }
                  }
                }} />
              <button onClick={() => {
                const input = document.getElementById('new-dir-input') as HTMLInputElement;
                if (input.value.trim() && !indexedDirs.includes(input.value.trim())) {
                  const newDirs = [...indexedDirs, input.value.trim()];
                  setIndexedDirs(newDirs);
                  setIsIndexing(true);
                  electronAPI.rebuildIndex(newDirs);
                  input.value = '';
                }
              }} style={{ padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>Add</button>
            </div>
          </SettingsSection>

          <SettingsSection title="General Preferences" icon={<Settings size={14} />} defaultOpen={false}>
            <div className="settings-row">
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>Exclude Patterns (comma separated)</label>
              <input type="text" value={excludePatterns} onChange={handleExcludeChange}
                style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px', fontSize: 13, outline: 'none' }}
                placeholder="node_modules, .git, dist, build, coverage" />
            </div>
            <div className="settings-row" style={{ marginTop: 12 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>PDF Viewer</label>
              <select value={pdfViewer} onChange={(e) => { const v = e.target.value as 'builtin' | 'browser'; setPdfViewer(v); localStorage.setItem('filehub-pdf-viewer', v); }}
                style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px', fontSize: 13, outline: 'none', cursor: 'pointer' }}>
                <option value="builtin">Built-in Viewer (default)</option>
                <option value="browser">Browser PDF Viewer</option>
              </select>
            </div>
            <div className="settings-row" style={{ marginTop: 12 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>Office / CSV Viewer</label>
              <select value={officeView} onChange={(e) => { const v = e.target.value as 'plain' | 'rich'; setOfficeView(v); localStorage.setItem('filehub-office-view', v); }}
                style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px', fontSize: 13, outline: 'none', cursor: 'pointer' }}>
                <option value="rich">Rich View (default) — table / slides / paragraphs</option>
                <option value="plain">Plain Text</option>
              </select>
            </div>
            <div className="settings-row" style={{ marginTop: 12 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>Text Preview Line Limit</label>
              <input type="number" min={100} max={500000} value={textLineLimit}
                onChange={(e) => { const v = Math.max(100, parseInt(e.target.value) || 20000); setTextLineLimit(v); localStorage.setItem('filehub-text-line-limit', String(v)); }}
                style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px', fontSize: 13, outline: 'none' }} />
            <div className="settings-row" style={{ marginTop: 12 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>Max Search Results</label>
              <input type="number" min={10} max={10000} value={maxResults}
                onChange={(e) => { const v = Math.max(10, parseInt(e.target.value) || 500); setMaxResults(v); localStorage.setItem('filehub-max-results', String(v)); }}
                style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px', fontSize: 13, outline: 'none' }} />
            </div>

            </div>
            <div className="settings-row" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" id="scroll-expand" checked={scrollExpand} onChange={e => { setScrollExpand(e.target.checked); localStorage.setItem('filehub-scroll-expand', String(e.target.checked)); }} style={{ cursor: 'pointer' }} />
              <label htmlFor="scroll-expand" style={{ fontSize: 13, cursor: 'pointer' }}>Scroll to expand/collapse preview (mobile)</label>
            </div>
            <div className="settings-row" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" id="remote-open" checked={remoteOpenEnabled} onChange={e => { setRemoteOpenEnabled(e.target.checked); localStorage.setItem('filehub-remote-open', String(e.target.checked)); }} style={{ cursor: 'pointer' }} />
              <label htmlFor="remote-open" style={{ fontSize: 13, cursor: 'pointer' }}>Allow remote double-click to open files</label>
            </div>
            <div className="settings-row" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" id="search-in-path" checked={searchInPath} onChange={e => { setSearchInPath(e.target.checked); localStorage.setItem('filehub-search-in-path', String(e.target.checked)); }} style={{ cursor: 'pointer' }} />
              <label htmlFor="search-in-path" style={{ fontSize: 13, cursor: 'pointer' }}>Search in full path (slower)</label>
            </div>
            <div className="settings-row" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" id="text-select" checked={textSelect}
                onChange={e => { setTextSelect(e.target.checked); localStorage.setItem('filehub-text-select', String(e.target.checked)); }} style={{ cursor: 'pointer' }} />
              <label htmlFor="text-select" style={{ fontSize: 13, cursor: 'pointer' }}>Allow text selection in preview</label>
            </div>
            <div className="settings-row" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" id="md-reader" checked={mdReader}
                onChange={e => { setMdReader(e.target.checked); localStorage.setItem('filehub-md-reader', String(e.target.checked)); }} style={{ cursor: 'pointer' }} />
              <label htmlFor="md-reader" style={{ fontSize: 13, cursor: 'pointer' }}>Markdown reader mode by default (render .md as formatted text)</label>
            </div>
            <div className="settings-row" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" id="debug-mode" checked={debugEnabled} onChange={e => { setDebugEnabled(e.target.checked); localStorage.setItem('filehub-debug', String(e.target.checked)); }} style={{ cursor: 'pointer' }} />
              <label htmlFor="debug-mode" style={{ fontSize: 13, cursor: 'pointer' }}>Enable Debug Mode</label>
            </div>
          </SettingsSection>

          <SettingsSection title="Appearance" icon={<LayoutTemplate size={14} />}>
            <div className="settings-row">
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>Application Theme</label>
              <select value={theme} onChange={(e) => handleThemeChange(e.target.value as 'dark' | 'light')}
                style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px', fontSize: 13, outline: 'none', cursor: 'pointer' }}>
                <option value="dark">Dark Theme</option>
                <option value="light">Light Theme</option>
              </select>
            </div>
          </SettingsSection>

          {lanInfo && (
            <SettingsSection title="LAN Access" icon={<Share2 size={14} />} defaultOpen={false}>
              {(isAndroidWebView() || isLocalBrowserClient()) && (
                <div className="settings-row" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="checkbox" id="lan-enabled" checked={!!lanInfo.lanEnabled}
                    onChange={async (e) => {
                      const enabled = e.target.checked;
                      setLanInfo(prev => prev ? { ...prev, lanEnabled: enabled } : prev);
                      await electronAPI.saveConfig({ lanEnabled: enabled } as any);
                      setTimeout(() => apiGet<{ ip: string; port: number; lanEnabled?: boolean }>('/api/lan-info').then(setLanInfo).catch(() => {}), 600);
                    }} style={{ cursor: 'pointer' }} />
                  <label htmlFor="lan-enabled" style={{ fontSize: 13, cursor: 'pointer' }}>Enable LAN access (allow other devices on Wi-Fi)</label>
                </div>
              )}
              <div className="settings-row" style={{ marginTop: 12 }}>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>LAN Username (leave empty to disable auth)</label>
                <input type="text" value={lanUser} onChange={e => setLanUser(e.target.value)}
                  placeholder="username"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 4, fontSize: 13 }} />
              </div>
              <div className="settings-row" style={{ marginTop: 8 }}>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>LAN Password</label>
                <input type="password" value={lanPass} onChange={e => setLanPass(e.target.value)}
                  placeholder="leave empty to keep current"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 4, fontSize: 13 }} />
              </div>
              {lanInfo.lanEnabled && (
                lanInfo.ip === 'unknown' || lanInfo.ip === 'disabled' ? (
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '8px 0 0' }}>LAN IP not detected. Make sure Wi-Fi is connected.</p>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                      <code style={{ flex: 1, padding: '8px 12px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 4, fontSize: 13, color: 'var(--accent)', wordBreak: 'break-all' }}>
                        http://{lanInfo.ip}:{lanInfo.port}
                      </code>
                      <button onClick={() => copyToClipboard(`http://${lanInfo.ip}:${lanInfo.port}`)}
                        style={{ padding: '8px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 4, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13 }}>Copy</button>
                    </div>
                    <QRCode url={`http://${lanInfo.ip}:${lanInfo.port}`} />
                  </>
                )
              )}
            </SettingsSection>
          )}

          <SettingsSection title="Advanced Options" icon={<Settings size={14} />} defaultOpen={false}>
            <div className="settings-row" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" id="bg-media-play" checked={bgMediaPlay}
                onChange={e => { setBgMediaPlay(e.target.checked); localStorage.setItem('filehub-bg-media-play', String(e.target.checked)); }} style={{ cursor: 'pointer' }} />
              <label htmlFor="bg-media-play" style={{ fontSize: 13, cursor: 'pointer' }}>
                Background media playback — keep audio/video playing when switching tabs
                <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {isAndroidWebView() ? 'Supported on this device.' : 'Android WebView only. Desktop browsers block background media playback at the browser level.'}
                </span>
              </label>
            </div>
            <div className="settings-row" style={{ marginTop: 12 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>
                XLSX max file size (MB)
                <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Large files may cause black screen on low-memory devices.</span>
              </label>
              <input type="number" min={1} max={200} value={xlsxMaxMb}
                onChange={e => setXlsxMaxMb(Math.max(1, Math.min(200, parseInt(e.target.value) || 50)))}
                style={{ width: 80, padding: '6px 10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 4, fontSize: 13 }} />
            </div>
          </SettingsSection>

          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <button onClick={() => { saveConfig(); setShowSettings(false); }} style={{ flex: 1, padding: '10px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14 }}>Save</button>
            <button onClick={() => setShowSettings(false)} style={{ flex: 1, padding: '10px 16px', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14 }}>Close</button>
          </div>
        </div>
      )}
      
      {showHelp && (
        <div className="help-panel">
          <h3>Keyboard Shortcuts</h3>
          <div className="help-grid">
            <div className="help-section">
              <h4>Navigation</h4>
              <div className="help-item"><kbd>j</kbd> / <kbd>↓</kbd> <span>Move down</span></div>
              <div className="help-item"><kbd>k</kbd> / <kbd>↑</kbd> <span>Move up</span></div>
              <div className="help-item"><kbd>h</kbd> <span>Close preview</span></div>
              <div className="help-item"><kbd>g</kbd> <span>Go to top</span></div>
              <div className="help-item"><kbd>G</kbd> <span>Go to bottom</span></div>
            </div>
            <div className="help-section">
              <h4>Actions</h4>
              <div className="help-item"><kbd>l</kbd> / <kbd>Enter</kbd> <span>Open file</span></div>
              <div className="help-item"><kbd>o</kbd> <span>Toggle preview</span></div>
              <div className="help-item"><kbd>f</kbd> <span>Focus filter (when available)</span></div>
              <div className="help-item"><kbd>O</kbd> <span>Open in explorer</span></div>
              <div className="help-item"><kbd>!</kbd> <span>Open terminal</span></div>
              <div className="help-item"><kbd>r</kbd> <span>Rebuild index</span></div>
            </div>
            <div className="help-section">
              <h4>Search</h4>
              <div className="help-item"><kbd>/</kbd> <span>Focus search</span></div>
              <div className="help-item"><kbd>\</kbd> <span>Toggle search type</span></div>
              <div className="help-item"><kbd>↑</kbd> / <kbd>↓</kbd> <span>Navigate & switch to command</span></div>
            </div>
            <div className="help-section">
              <h4>Tabs</h4>
              <div className="help-item"><kbd>1</kbd>-<kbd>8</kbd> <span>Switch tabs</span></div>
              <div className="help-item"><kbd>t</kbd> <span>New tab</span></div>
              <div className="help-item"><kbd>Ctrl+w</kbd> <span>Close tab</span></div>
              <div className="help-item"><kbd>s</kbd> <span>Settings</span></div>
              <div className="help-item"><kbd>q</kbd> / <kbd>Esc</kbd> <span>Quit/Close</span></div>
              <div className="help-item"><kbd>?</kbd> <span>Show this help</span></div>
            </div>
          </div>
          <button className="btn-close-help" onClick={() => setShowHelp(false)}>Press any key to close</button>
        </div>
      )}

      {showDebug && debugData && (
        <div className="help-panel" style={{ maxHeight: '80vh', overflow: 'auto' }}>
          <h3 style={{ color: '#f59e0b' }}>🐛 Debug Info</h3>
          <div style={{ marginBottom: 12 }}>
            {debugData.androidSdk !== undefined ? (
              <>
                <strong>Android SDK:</strong> {debugData.androidSdk}<br/>
                <strong>MANAGE_EXTERNAL_STORAGE:</strong> {String(debugData.isExternalStorageManager)}<br/>
                <strong>Storage dir exists:</strong> {String(debugData.storageDirExists)}<br/>
                <strong>Storage dir canRead:</strong> {String(debugData.storageDirCanRead)}<br/>
              </>
            ) : (
              <>
                <strong>Platform:</strong> {debugData.platform}<br/>
                <strong>Node.js:</strong> {debugData.nodeVersion}<br/>
                {debugData.hostname && <><strong>Hostname:</strong> {debugData.hostname}<br/></>}
                {debugData.platformInfo && <><strong>OS:</strong> {debugData.platformInfo}<br/></>}
                {debugData.uptime && <><strong>Uptime:</strong> {Math.floor(Number(debugData.uptime) / 3600)}h<br/></>}
                {debugData.totalMemory && <><strong>Total Memory:</strong> {Math.floor(Number(debugData.totalMemory) / 1024 / 1024 / 1024)} GB<br/></>}
                {debugData.freeMemory && <><strong>Free Memory:</strong> {Math.floor(Number(debugData.freeMemory) / 1024 / 1024 / 1024)} GB<br/></>}
              </>
            )}
            {debugData.indexStatus && <>
              <strong>Index status:</strong> {debugData.indexStatus.status}<br/>
              <strong>File count:</strong> {debugData.indexStatus.fileCount}<br/>
              <strong>Indexed dirs:</strong> {JSON.stringify(debugData.indexStatus.indexedDirectories)}<br/>
            </>}
            {debugData.error && <span style={{ color: 'red' }}>Error: {debugData.error}</span>}
          </div>
          <strong>Logs:</strong>
          <pre style={{ fontSize: 11, maxHeight: 300, overflow: 'auto', background: 'var(--bg-primary)', padding: 8, borderRadius: 4, marginTop: 4 }}>
            {debugData.logs?.join('\n') || '(no logs)'}
          </pre>
          <button className="btn-close-help" onClick={() => setShowDebug(false)}>Close</button>
        </div>
      )}
      
      <div className="main-content">
        <div className="results-container" ref={resultsRef} tabIndex={0}>
          {activeTab.results.map((result, index) => (
            <div
              key={result.path}
              className={`result-item ${index === activeTab.selectedIndex ? 'selected' : ''} ${activeTab.previewFile?.path === result.path ? 'previewing' : ''}`}
              onClick={() => {
                updateActiveTab({ selectedIndex: index });
                loadPreviewForTab(result);
              }}
              onDoubleClick={() => openFile(result.path)}
            >
              <span className="file-icon">{getFileIcon(result)}</span>
              <div className="result-info">
                <div className="result-name">{result.name}</div>
                <div className="result-path">{result.path}</div>
              </div>
              <div className="result-meta">
                {!result.isDirectory && <span className="file-size">{formatSize(result.size)}</span>}
                <span className="file-date">{formatDate(result.modified)}</span>
              </div>
            </div>
          ))}
          
{activeTab.query && activeTab.results.length === 0 && status?.status !== 'indexing' && (
            <span className="no-results">
              No results for "{activeTab.query}"
            </span>
          )}
          
          {!activeTab.query && status?.status === 'indexing' && (
            <div className="empty-state">
              <div className="indexing-icon-anim">
                <RefreshCw size={52} strokeWidth={1.5} />
              </div>
              <p>Building index…</p>
              {progress && (
                <>
                  <p className="hint">{progress.current.toLocaleString()} files scanned</p>
                  {progress.currentDir && <p className="indexing-dir-center" title={progress.currentDir}>{progress.currentDir}</p>}
                  <div className="indexing-bar-wrap">
                    <div className="indexing-bar-fill" />
                  </div>
                </>
              )}
            </div>
          )}

          {!activeTab.query && status?.status !== 'indexing' && (
            <div className="empty-state">
              <div className="empty-icon"><Search size={64} strokeWidth={1} /></div>
              <p>Start typing to search</p>
              <p className="hint">Press <kbd>?</kbd> for keyboard shortcuts</p>
            </div>
          )}
        </div>
        
        {/* Stable media container — only for stream media, preserves playback across tab switches */}
        <div ref={mediaStableRef} style={{ position: 'fixed', left: '-9999px', top: 0, width: 300, height: 50, pointerEvents: 'none', zIndex: -1 }}>
          {tabs.filter(t => (t.previewType === 'video' || t.previewType === 'audio') && t.previewContent && t.previewEncoding === 'stream').map(tab => (
            <div key={`stable-${tab.id}`} data-tab-id={tab.id}>
              {tab.previewType === 'video'
                ? <video src={tab.previewContent!} controls />
                : <audio src={tab.previewContent!} controls />}
            </div>
          ))}
        </div>

        {activeTab.previewFile && (
          <div
            className={`preview-panel ${isPreviewMobileExpanded ? 'mobile-expanded' : ''} ${isMaximized ? 'maximized' : ''}`}
            ref={previewPanelRef}
            style={{ width: isMaximized ? '100%' : `${previewWidth}%`, transition: 'width 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)' }}
          >
            {isResizing && <div style={{ position: 'absolute', inset: 0, zIndex: 10 }} />}
            <div 
              className={`preview-resize-handle ${isResizing ? 'dragging' : ''}`}
              style={{ display: isMaximized ? 'none' : '' }}
            onMouseDown={() => { setIsResizing(true); document.body.style.userSelect = 'none'; document.body.style.cursor = 'col-resize'; }}
            onMouseUp={() => { document.body.style.userSelect = ''; document.body.style.cursor = ''; }}
            />
            <div className="preview-header">
              <div className="preview-title">
                <span className="file-icon">{getFileIcon(activeTab.previewFile)}</span>
                <span className="preview-filename">{activeTab.previewFile.name}</span>
              </div>
              <div className="preview-actions">
                {(activeTab.previewType === 'code' || activeTab.previewType === 'text') && activeTab.previewContent && (
                  <>
                    {activeTab.previewType === 'code' && ['md','mdx'].includes(activeTab.previewFile?.name.split('.').pop()?.toLowerCase() || '') && (
                      <button className="btn-preview" onClick={() => updateActiveTab({ mdView: activeTab.mdView === 'reader' ? 'code' : 'reader' })} title="Toggle Markdown Reader">
                        <FileText size={14} color={activeTab.mdView === 'reader' ? 'var(--accent)' : 'inherit'} />
                      </button>
                    )}
                    <button className="btn-preview" onClick={() => setWordWrap(!wordWrap)} title="Toggle Word Wrap">
                      <WrapText size={14} color={wordWrap ? 'var(--accent)' : 'inherit'} />
                    </button>
                    <button className="btn-preview" onClick={handleCopyContent} title="Copy Content">
                      {copiedContent ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                    </button>
                  </>
                )}
                {!isAndroidWebView() && (
                  <button className="btn-preview" onClick={handleDownload} title="Download File">
                    <Download size={14} />
                  </button>
                )}
                <button className="btn-preview" onClick={handleShare} title="Share / Copy Path">
                  <Share2 size={14} />
                </button>
                <button className="btn-preview" onClick={handleCopyPath} title="Copy Path">
                  {copiedPath ? <Check size={14} color="#10b981" /> : <Link size={14} />}
                </button>
                <button className="btn-preview hide-on-mobile" onClick={() => openFile(activeTab.previewFile!.path)} title="Open (l)">
                  <ExternalLink size={14} />
                </button>
                <button className="btn-preview hide-on-mobile" onClick={() => showInExplorer(activeTab.previewFile!.path)} title="Explorer (O)">
                  <Folder size={14} />
                </button>
                <button className="btn-preview" onClick={() => {
                  if (window.innerWidth <= 800) setIsPreviewMobileExpanded(v => !v);
                  else setIsMaximized(v => !v);
                }} title={(isMaximized || isPreviewMobileExpanded) ? "Restore View" : "Maximize View"}>
                  {(isMaximized || isPreviewMobileExpanded) ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>
                <button className="btn-preview btn-close" onClick={closePreview} title="Close (q)">
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="preview-meta hide-on-mobile">
              {activeTab.fileInfo && (
                <>
                  <span>{formatSize(activeTab.fileInfo.size)}</span>
                  <span>Modified: {formatDate(activeTab.fileInfo.modified)}</span>
                  <span>Type: {activeTab.previewType.toUpperCase()}</span>
                  {activeTab.previewTruncated && <span>Preview truncated</span>}
                </>
              )}
            </div>
            {['text','code','ppt','xlsx'].includes(activeTab.previewType) && (
              <div className="preview-search-bar">
                <input
                  ref={previewSearchRef}
                  className="preview-search-input"
                  type="text"
                  placeholder="Filter..."
                  value={previewSearch}
                  onChange={e => setPreviewSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Escape') { setPreviewSearch(''); appRef.current?.focus(); } }}
                />
                {previewSearch && (
                  <button className="preview-search-clear" onClick={() => setPreviewSearch('')}>×</button>
                )}
              </div>
            )}
            <div 
              className={`preview-content${textSelect ? '' : ' no-select'}`}
              onMouseUp={handlePreviewMouseUp}
              onScrollCapture={(e) => {
                if (scrollExpand && window.innerWidth <= 800) {
                  const target = e.target as HTMLDivElement;
                  const isScrollable = target.scrollHeight > target.clientHeight + 10;
                  if (target.scrollTop > 30 && !isPreviewMobileExpanded) {
                    setIsPreviewMobileExpanded(true);
                  } else if (isScrollable && target.scrollTop <= 5 && isPreviewMobileExpanded) {
                    setIsPreviewMobileExpanded(false);
                  }
                }
              }}
            >
              {renderPreview()}
            </div>
          </div>
        )}
      </div>
      
      <footer className="footer">
        <div className="footer-status">
          <span className="mode-indicator">{mode === 'search' ? '🔍 SEARCH' : '📋 COMMAND'}</span>
          <div className="footer-actions">
            <button
              className="btn-icon"
              onClick={rebuildIndex}
disabled={status?.status === 'indexing'}
              title="Rebuild Index (r)"
            >
              <RefreshCw size={16} />
            </button>
            <button
              className="btn-icon"
              onClick={() => setShowSettings(!showSettings)}
              title="Settings (s)"
            >
              <Settings size={16} />
            </button>
            <button
              className="btn-icon"
              onClick={() => setShowHelp(true)}
              title="Help (?)"
            >
              <HelpCircle size={16} />
            </button>
            {debugEnabled && (
              <button
                className="btn-icon"
                onClick={async () => {
                  try {
                    const resp = await fetch(API_BASE + '/api/debug');
                    const contentType = resp.headers.get('content-type');
                    if (contentType?.includes('application/json')) {
                      const data = await resp.json();
                      setDebugData(data);
                    } else {
                      const text = await resp.text();
                      setDebugData({ error: `Non-JSON response: ${text.slice(0,200)}` });
                    }
                  } catch (e: any) {
                    setDebugData({ error: e.message });
                  }
                  setShowDebug(true);
                }}
                title="Debug"
                style={{ color: '#f59e0b' }}
              >
                🐛
              </button>
            )}
          </div>
          <span className="footer-brand">filehub</span>
        </div>
      </footer>
    </div>
  );
};

export default App;

let mdWorkerInstance: Worker | null = null;
function getMdWorker() {
  if (!mdWorkerInstance) mdWorkerInstance = new Worker(new URL('./markdownWorker.ts', import.meta.url), { type: 'module' });
  return mdWorkerInstance;
}

function MarkdownViewer({ text }: { text: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const reqIdRef = useRef(0);

  useEffect(() => {
    setHtml(null);
    const id = ++reqIdRef.current;
    const worker = getMdWorker();
    const handler = (e: MessageEvent) => {
      if (e.data.id !== id) return;
      worker.removeEventListener('message', handler);
      if (!e.data.error) setHtml(e.data.html);
    };
    worker.addEventListener('message', handler);
    worker.postMessage({ id, text });
    return () => worker.removeEventListener('message', handler);
  }, [text]);

  if (!html) return <div className="preview-loading">Rendering…</div>;
  return <div className="markdown-body" dangerouslySetInnerHTML={{ __html: html }} />;
}

function QRCode({ url }: { url: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    import('qrcode').then(QR => {
      if (canvasRef.current) QR.toCanvas(canvasRef.current, url, { width: 160, margin: 2 });
    });
  }, [url]);
  return <canvas ref={canvasRef} style={{ display: 'block', margin: '10px auto', borderRadius: 4 }} />;
}

function SettingsSection({ title, icon, defaultOpen = true, children }: { title: string; icon?: React.ReactNode; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="settings-section" style={{ padding: 0, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--bg-secondary)', border: 'none', borderBottom: open ? '1px solid var(--border-color)' : 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13, fontWeight: 600, textAlign: 'left' }}
      >
        {icon}
        <span style={{ flex: 1 }}>{title}</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', transition: 'transform 0.2s', display: 'inline-block', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
      </button>
      {open && <div style={{ padding: '12px 14px' }}>{children}</div>}
    </div>
  );
}

function ImagePreview({ base64Data, filename }: { base64Data: string; filename: string }) {
  const [scale, setScale] = useState(1);
  const ext = filename.split('.').pop()?.toLowerCase() || 'png';
  const mimeMap: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', svg: 'image/svg+xml', ico: 'image/x-icon' };
  const isSvgUtf8 = base64Data.startsWith('<svg') || base64Data.includes('xmlns');
  const src = isSvgUtf8
    ? `data:image/svg+xml;utf8,${encodeURIComponent(base64Data)}`
    : `data:${mimeMap[ext] || 'image/png'};base64,${base64Data}`;

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setScale(s => Math.min(4, Math.max(0.2, s + (e.deltaY > 0 ? -0.1 : 0.1))));
  };

  return (
    <div className="preview-image-container" onWheel={handleWheel}>
      <img src={src} alt={filename} className="preview-image" style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }} />
    </div>
  );
}

function BrowserPdfViewer({ filePath }: { filePath: string }) {
  const [src, setSrc] = React.useState<string>('');
  React.useEffect(() => {
    // Use data URL to avoid nested iframe cross-origin issues (e.g. VSCode webview)
    fetch(`${API_BASE}/api/file-stream?path=${encodeURIComponent(filePath)}`)
      .then(r => r.blob())
      .then(blob => setSrc(URL.createObjectURL(blob)))
      .catch(() => setSrc(`${API_BASE}/api/file-stream?path=${encodeURIComponent(filePath)}`));
    return () => { if (src.startsWith('blob:')) URL.revokeObjectURL(src); };
  }, [filePath]);
  return src ? <iframe src={src} className="preview-pdf" title="PDF Preview" /> : null;
}

function CsvViewer({ text }: { text: string }) {
  const rows = text.trim().split('\n').map(r => r.split(',').map(c => c.replace(/^"|"$/g, '').trim()));
  return (
    <div className="office-table-container">
      <table className="office-table">
        <thead><tr>{rows[0]?.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
        <tbody>{rows.slice(1).map((row, i) => <tr key={i}>{row.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

const XLSX_MAX_ROWS = 2000;
let xlsxWorkerInstance: Worker | null = null;
function getXlsxWorker() {
  if (!xlsxWorkerInstance) {
    xlsxWorkerInstance = new Worker(new URL('./xlsxWorker.ts', import.meta.url), { type: 'module' });
  }
  return xlsxWorkerInstance;
}

function MidiPlayer({ src }: { src: string }) {
  // src is a stream URL like /api/file-stream?path=...
  // Extract the file path to pass to the native MIDI API
  const filePath = useMemo(() => {
    try { return new URL(src, location.href).searchParams.get('path') ?? src; }
    catch { return src; }
  }, [src]);

  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const call = async (action: string) => {
    const url = action === 'play'
      ? API_BASE + `/api/midi/play?path=${encodeURIComponent(filePath)}`
      : API_BASE + `/api/midi/${action}`;
    const res = await fetch(url);
    return res.json();
  };

  const startPoll = () => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const s = await (await fetch(API_BASE + '/api/midi/status')).json();
        setPlaying(s.playing);
        setPosition(s.position);
        setDuration(s.duration);
        if (!s.playing) stopPoll();
      } catch {}
    }, 500);
  };

  const stopPoll = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  useEffect(() => {
    // On mount, check if this file is already playing (e.g. returning to tab)
    fetch(API_BASE + '/api/midi/status').then(r => r.json()).then(s => {
      if (s.path === filePath && s.playing) {
        setPlaying(true);
        setPosition(s.position);
        setDuration(s.duration);
        startPoll();
      }
    }).catch(() => {});
    return () => stopPoll();
  }, [filePath]);

  const handlePlay = async () => {
    try {
      setError(null);
      const r = await call('play');
      if (r.error) { setError(r.error); return; }
      setPlaying(true);
      startPoll();
    } catch (e: any) { setError(e.message); }
  };

  const handlePause = async () => {
    await call('pause');
    setPlaying(false);
    stopPoll();
  };

  const handleStop = async () => {
    await call('stop');
    setPlaying(false);
    setPosition(0);
    stopPoll();
  };

  const fmt = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <FileAudio size={48} color="#f59e0b" strokeWidth={1} />
      {error && <div style={{ color: 'var(--error, #ef4444)', fontSize: 13 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 12 }}>
        {!playing
          ? <button onClick={handlePlay} style={{ padding: '8px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}>▶ Play</button>
          : <button onClick={handlePause} style={{ padding: '8px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}>⏸ Pause</button>
        }
        <button onClick={handleStop} style={{ padding: '8px 20px', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}>⏹ Stop</button>
      </div>
      {duration > 0 && (
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{fmt(position)} / {fmt(duration)}</div>
      )}
    </div>
  );
}

function XlsxViewer({ base64, filter, officeView }: { base64: string; filter?: string; officeView: string }) {
  const [activeSheet, setActiveSheet] = useState(0);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [html, setHtml] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqIdRef = useRef(0);
  const tabsBarRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // Scroll active sheet tab into view after content loads
  useEffect(() => {
    if (!tabsBarRef.current) return;
    const active = tabsBarRef.current.querySelector('.sheet-tab.active') as HTMLElement | null;
    active?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [html, activeSheet]);

  useEffect(() => {
    setHtml(null);
    setError(null);
    const id = ++reqIdRef.current;
    const worker = getXlsxWorker();
    const handler = (e: MessageEvent) => {
      if (e.data.id !== id) return;
      worker.removeEventListener('message', handler);
      if (e.data.error) { setError(e.data.error); return; }
      setSheetNames(e.data.sheetNames);
      setHtml(e.data.html);
      setTruncated(e.data.truncated);
      // Reset scroll to top when sheet content changes
      if (tableRef.current) tableRef.current.scrollTop = 0;
    };
    worker.addEventListener('message', handler);
    worker.postMessage({ id, base64, sheetIndex: activeSheet, filter, maxRows: XLSX_MAX_ROWS });
    return () => worker.removeEventListener('message', handler);
  }, [base64, activeSheet, filter]);

  if (error) return <div className="preview-no-support">Unable to parse Excel file: {error}</div>;
  if (!html) return <div className="preview-loading">Parsing spreadsheet…</div>;

  return (
    <div className="office-viewer">
      {sheetNames.length > 1 && (
        <div ref={tabsBarRef} className="office-sheet-tabs">
          {sheetNames.map((name, i) => (
            <button key={i} className={`sheet-tab${i === activeSheet ? ' active' : ''}`} onClick={() => setActiveSheet(i)}>{name}</button>
          ))}
        </div>
      )}
      <div ref={tableRef} className="office-table-container" dangerouslySetInnerHTML={{ __html: html }} />
      {truncated && <div className="preview-truncated-note">Showing first {XLSX_MAX_ROWS} rows. Use filter to narrow results.</div>}
    </div>
  );
}

function PptViewer({ text }: { text: string }) {
  const slides = text.split('\x00SLIDE\x00').map(s => s.trim()).filter(Boolean);
  return (
    <div className="ppt-viewer">
      {slides.map((slide, i) => (
        <div key={i} className="ppt-slide">
          <div className="ppt-slide-num">Slide {i + 1}</div>
          <pre className="ppt-slide-content">{slide}</pre>
        </div>
      ))}
    </div>
  );
}

function DocViewer({ text, wordWrap }: { text: string; wordWrap: boolean }) {
  const paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  return (
    <div className={`doc-viewer ${wordWrap ? 'wrap' : 'no-wrap'}`}>
      {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
    </div>
  );
}

function MediaSlot({ tabId, stableRef, className, bgPlay }: { tabId: number; stableRef: React.RefObject<HTMLDivElement | null>; className: string; bgPlay: boolean }) {
  const slotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const slot = slotRef.current;
    const stable = stableRef.current;
    if (!slot || !stable) return;

    const container = stable.querySelector(`[data-tab-id="${tabId}"]`) as HTMLElement | null;
    if (!container) return;

    const mediaEl = container.firstElementChild as HTMLMediaElement | null;
    if (!mediaEl) return;

    const wasPlaying = !mediaEl.paused;

    // Move media element into the slot (DOM move preserves playback state)
    mediaEl.className = className;
    slot.appendChild(mediaEl);
    if (wasPlaying) mediaEl.play().catch(() => {});

    return () => {
      const stillPlaying = !mediaEl.paused;
      container.appendChild(mediaEl);
      mediaEl.className = '';

      if (stillPlaying && bgPlay) {
        // Re-attach pause listener to fight browser auto-pause on visibility change
        const onPause = () => {
          if (document.visibilityState === 'hidden') {
            mediaEl.play().catch(() => {});
          } else {
            mediaEl.removeEventListener('pause', onPause);
          }
        };
        mediaEl.addEventListener('pause', onPause);
        mediaEl.play().catch(() => {});
      }
    };
  }, [tabId, className, bgPlay]);

  return <div ref={slotRef} style={{ width: '100%', height: '100%' }} />;
}

function MediaPreview({ base64Data, type }: { base64Data: string; type: 'video' | 'audio' }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const mimeType = type === 'video' ? 'video/mp4' : 'audio/mpeg';

  useEffect(() => {
    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [base64Data, mimeType]);

  if (!blobUrl) return <div className="preview-loading">Loading...</div>;
  if (type === 'video') return <video src={blobUrl} controls className="preview-video" />;
  return <audio src={blobUrl} controls className="preview-audio" />;
}

function TextWithLineNumbers({ text, wordWrap, truncated, totalLines }: { text: string; wordWrap: boolean; truncated?: boolean; totalLines?: number }) {
  const lines = text.split('\n');
  return (
    <div className="text-lined-container">
      <pre className={`preview-code ${wordWrap ? 'wrap' : 'no-wrap'}`}>
        <code>
          {lines.map((line, i) => (
            <div className="preview-code-line" key={i}>
              <span className="preview-code-gutter">{i + 1}</span>
              <span className="preview-code-content">{line || ' '}</span>
            </div>
          ))}
          {truncated && (
            <div className="preview-truncated-notice">
              … showing first {lines.length.toLocaleString()} of {totalLines?.toLocaleString()} lines
            </div>
          )}
        </code>
      </pre>
    </div>
  );
}
