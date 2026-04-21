import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs/promises';
import log from 'electron-log';

interface FileEntry {
  name: string;
  path: string;
  nameLower: string;
  size: number;
  created: number;
  modified: number;
  accessed: number;
  isDirectory: boolean;
  attributes: number;
}

interface SearchResult {
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

interface AppConfig {
  indexedDirectories: string[];
  useAdminMode: boolean;
  excludePatterns?: string[];
}

class TrieNode {
  children: Map<string, TrieNode> = new Map();
  files: FileEntry[] = [];
}

export class FileIndexService extends EventEmitter {
  private root: TrieNode = new TrieNode();
  private files: FileEntry[] = [];
  private isIndexing: boolean = false;
  private config: AppConfig;
  private addon: any = null;
  private nameIndex: Map<string, FileEntry[]> = new Map();
  private excludeMatchers: RegExp[] = [];
  
  constructor(config: AppConfig) {
    super();
    this.config = config;
    this.excludeMatchers = (config.excludePatterns || []).map((pattern) => this.createExcludeMatcher(pattern));
    this.tryLoadAddon();
  }

  public updateConfig(newConfig: AppConfig): void {
    this.config = newConfig;
    this.excludeMatchers = (newConfig.excludePatterns || []).map((pattern) => this.createExcludeMatcher(pattern));
  }

  private createExcludeMatcher(pattern: string): RegExp {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${escaped}$`, 'i');
  }

  private shouldExclude(entryName: string, fullPath: string): boolean {
    if (this.excludeMatchers.length === 0) {
      return false;
    }

    const normalizedPath = fullPath.replace(/\\/g, '/');
    return this.excludeMatchers.some((matcher) => matcher.test(entryName) || matcher.test(normalizedPath));
  }
  
  private tryLoadAddon(): void {
    try {
      const possiblePaths = [
        path.join(process.cwd(), 'src/addon/build/Release/everything_addon.node'),
        path.join(__dirname, '../../src/addon/build/Release/everything_addon.node')
      ];
      
      for (const addonPath of possiblePaths) {
        try {
          this.addon = require(addonPath);
          log.info('Native addon loaded from:', addonPath);
          return;
        } catch {
          continue;
        }
      }
      
      log.warn('Native addon not found, using fallback indexing');
    } catch (error) {
      log.warn('Failed to load native addon:', error);
    }
  }
  
  async initialize(): Promise<void> {
    await this.rebuildIndex();
  }
  
  async rebuildIndex(directories?: string[]): Promise<IndexStatus> {
    if (this.isIndexing) {
      const dirs = directories || this.config.indexedDirectories;
      return { status: 'indexing', fileCount: this.files.length, indexedDirectories: dirs };
    }
    
    const dirs = directories || this.config.indexedDirectories;
    this.isIndexing = true;
    this.config.indexedDirectories = dirs;
    
    const startTime = Date.now();
    log.info('Starting index rebuild for:', dirs);
    
    const newFiles: FileEntry[] = [];
    const newNameIndex: Map<string, FileEntry[]> = new Map();
    const newRoot = new TrieNode();
    
    try {
      for (const dir of dirs) {
        await this.indexDirectoryInto(dir, newFiles, newNameIndex, 0);
      }
      
      for (const file of newFiles) {
        this.insertIntoTrie(newRoot, file, 0);
      }
      
      this.files = newFiles;
      this.nameIndex = newNameIndex;
      this.root = newRoot;
      this.isIndexing = false;
      
      const duration = Date.now() - startTime;
      log.info(`Index rebuild complete: ${this.files.length} files in ${duration}ms`);
      
      this.emit('index-complete', { fileCount: this.files.length, duration });
      
      return {
        status: 'idle',
        fileCount: this.files.length,
        indexedDirectories: dirs
      };
    } catch (error) {
      log.error('Index rebuild failed:', error);
      this.isIndexing = false;
      throw error;
    }
  }
  
  private async indexDirectoryInto(dirPath: string, files: FileEntry[], nameIndex: Map<string, FileEntry[]>, depth: number): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (this.shouldExclude(entry.name, fullPath)) {
          continue;
        }
        
        try {
          const stats = await fs.stat(fullPath);
          
          const fileEntry: FileEntry = {
            name: entry.name,
            path: fullPath,
            nameLower: entry.name.toLowerCase(),
            size: stats.size,
            created: stats.birthtimeMs,
            modified: stats.mtimeMs,
            accessed: stats.atimeMs,
            isDirectory: entry.isDirectory(),
            attributes: 0
          };
          
          files.push(fileEntry);
          
          const firstChar = fileEntry.nameLower[0] || '';
          const existing = nameIndex.get(firstChar) || [];
          existing.push(fileEntry);
          nameIndex.set(firstChar, existing);
          
          if (depth % 100 === 0) {
            this.emit('index-progress', {
              current: files.length,
              total: files.length + 1000,
              currentDir: dirPath
            });
          }
          
          if (entry.isDirectory() && !entry.name.startsWith('.')) {
            await this.indexDirectoryInto(fullPath, files, nameIndex, depth + 1);
          }
        } catch (err) {
          continue;
        }
      }
    } catch (err) {
      log.warn('Failed to read directory:', dirPath, err);
    }
  }
  
  private insertIntoTrie(node: TrieNode, file: FileEntry, depth: number): void {
    if (depth >= file.nameLower.length) {
      node.files.push(file);
      return;
    }
    
    const char = file.nameLower[depth];
    if (!node.children.has(char)) {
      node.children.set(char, new TrieNode());
    }
    
    node.children.get(char)!.files.push(file);
    this.insertIntoTrie(node.children.get(char)!, file, depth + 1);
  }
  
  search(query: string, maxResults: number = 100, searchType: string = 'string', searchInPath: boolean = false): SearchResult[] {
    if (!query || query.trim() === '') {
      return [];
    }
    
    const startTime = Date.now();
    const queryTrimmed = query.trim();
    let results: SearchResult[] = [];
    
    if (searchType === 'regex') {
      try {
        const regex = new RegExp(queryTrimmed, 'i');
        const regexResults = this.files.filter(file =>
          regex.test(file.name) || (searchInPath && regex.test(file.path))
        );
        regexResults.sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
          return a.nameLower.length - b.nameLower.length;
        });
        results = regexResults.map(file => ({
          name: file.name,
          path: file.path,
          size: file.size,
          modified: file.modified,
          isDirectory: file.isDirectory
        }));
      } catch (e) {
        log.error('Invalid regex:', e);
        return [];
      }
    } else if (searchType === 'fuzzy') {
      const fuzzyResults = this.files.filter(file => {
        const target = searchInPath ? file.path.toLowerCase() : file.nameLower;
        return this.fuzzyMatch(target, queryTrimmed.toLowerCase());
      });
      results = fuzzyResults.map(file => ({
        name: file.name,
        path: file.path,
        size: file.size,
        modified: file.modified,
        isDirectory: file.isDirectory
      }));
    } else {
      const queryLower = queryTrimmed.toLowerCase();
      const queryParts = queryLower.split(/\s+/);
      
      const allFiles = this.files.filter(file => {
        const target = searchInPath ? file.path.toLowerCase() : file.nameLower;
        return queryParts.every(part => target.includes(part));
      });
      
      allFiles.sort((a, b) => {
        const aStarts = a.nameLower.startsWith(queryLower);
        const bStarts = b.nameLower.startsWith(queryLower);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        
        if (a.isDirectory !== b.isDirectory) {
          return a.isDirectory ? -1 : 1;
        }
        
        return a.nameLower.length - b.nameLower.length;
      });
      
      results = allFiles.map(file => ({
        name: file.name,
        path: file.path,
        size: file.size,
        modified: file.modified,
        isDirectory: file.isDirectory
      }));
    }
    
    results = results.slice(0, maxResults);
    
    const searchTime = Date.now() - startTime;
    log.info(`Search "${query}" (${searchType}${searchInPath ? '+path' : ''}) returned ${results.length} results in ${searchTime}ms`);
    
    return results;
  }
  
  fuzzyMatch(text: string, pattern: string): boolean {
    let patternIdx = 0;
    for (let i = 0; i < text.length && patternIdx < pattern.length; i++) {
      if (text[i] === pattern[patternIdx]) {
        patternIdx++;
      }
    }
    return patternIdx === pattern.length;
  }
  
  getStatus(): IndexStatus {
    return {
      status: this.isIndexing ? 'indexing' : 'idle',
      fileCount: this.files.length,
      indexedDirectories: this.config.indexedDirectories
    };
  }
  
  getVolumes(): string[] {
    try {
      if (this.addon?.getVolumes) {
        return this.addon.getVolumes();
      }
    } catch (error) {
      log.warn('Failed to get volumes:', error);
    }
    
    return ['C', 'D', 'E'];
  }
}