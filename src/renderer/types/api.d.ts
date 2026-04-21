interface FileInfo {
  size: number;
  created: number;
  modified: number;
  accessed: number;
  isDirectory: boolean;
  extension: string;
}

interface ElectronAPI {
  search: (query: string, maxResults?: number, searchType?: string) => Promise<any[]>;
  getIndexStatus: () => Promise<any>;
  rebuildIndex: (directories?: string[]) => Promise<any>;
  getConfig: () => Promise<any>;
  saveConfig: (config: any) => Promise<{ success: boolean; config: any; indexing?: boolean }>;
  openFile: (filePath: string) => Promise<boolean>;
  openInExplorer: (filePath: string) => Promise<boolean>;
  openTerminal: (workDir: string) => Promise<boolean>;
  getVolumes: () => Promise<string[]>;
  selectDirectory: () => Promise<string | null>;
  readFile: (filePath: string) => Promise<string | null>;
  getFileInfo: (filePath: string) => Promise<FileInfo | null>;
  getPreviewData: (filePath: string) => Promise<{ success: boolean; data?: string; ext?: string; error?: string; contentEncoding?: 'base64' | 'utf8'; truncated?: boolean }>;
  onIndexProgress: (callback: (data: any) => void) => () => void;
  onIndexComplete: (callback: (data: any) => void) => () => void;
  onOpenSettings: (callback: () => void) => () => void;
}

interface PreviewData {
  success: boolean;
  data?: string;
  ext?: string;
  error?: string;
  contentEncoding?: 'base64' | 'utf8';
  truncated?: boolean;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
