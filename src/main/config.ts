import fs from 'fs';
import path from 'path';
import log from 'electron-log';

export interface AppConfig {
  indexedDirectories: string[];
  useAdminMode: boolean;
  address: string;
  excludePatterns: string[];
  theme?: 'dark' | 'light';
  openMode?: 'local' | 'remote' | 'disabled';
}

const DEFAULT_CONFIG: AppConfig = {
  indexedDirectories: [process.cwd()],
  useAdminMode: false,
  address: '0.0.0.0:6543',
  excludePatterns: []
};

export const DEFAULT_CONFIG_PATH = path.join(process.cwd(), 'filehub.yml');

function parseYamlConfig(content: string): Partial<AppConfig> {
  const yaml = require('js-yaml');
  const parsed = yaml.load(content);
  return typeof parsed === 'object' && parsed !== null ? parsed as Partial<AppConfig> : {};
}

function normalizeAddress(address: string | undefined, fallback: string): string {
  if (!address || !address.trim()) {
    return fallback;
  }

  const trimmed = address.trim();
  const match = trimmed.match(/^([^:]+):(\d{1,5})$/);
  if (!match) {
    return fallback;
  }

  const port = Number(match[2]);
  if (!Number.isFinite(port) || port <= 0 || port > 65535) {
    return fallback;
  }

  return `${match[1]}:${port}`;
}

export function parseAddress(address: string): { host: string; port: number } {
  const normalized = normalizeAddress(address, DEFAULT_CONFIG.address);
  const separatorIndex = normalized.lastIndexOf(':');
  return {
    host: normalized.slice(0, separatorIndex),
    port: Number(normalized.slice(separatorIndex + 1))
  };
}

export function toLocalClientAddress(address: string): string {
  const { host, port } = parseAddress(address);
  const clientHost = host === '0.0.0.0' || host === '::' ? '127.0.0.1' : host;
  return `${clientHost}:${port}`;
}

export function loadConfig(): AppConfig {
  let loaded: Partial<AppConfig> = {};

  if (fs.existsSync(DEFAULT_CONFIG_PATH)) {
    try {
      loaded = parseYamlConfig(fs.readFileSync(DEFAULT_CONFIG_PATH, 'utf8'));
      log.info(`Loaded config from ${DEFAULT_CONFIG_PATH}`);
    } catch (error) {
      log.error(`Failed to parse config file ${DEFAULT_CONFIG_PATH}:`, error);
    }
  }

  const indexedDirectories = Array.isArray(loaded.indexedDirectories) && loaded.indexedDirectories.length > 0
    ? loaded.indexedDirectories.map((value) => String(value))
    : DEFAULT_CONFIG.indexedDirectories;

  const useAdminMode = typeof loaded.useAdminMode === 'boolean'
    ? loaded.useAdminMode
    : DEFAULT_CONFIG.useAdminMode;

  const address = typeof (loaded as any).address === 'string'
    ? String((loaded as any).address)
    : DEFAULT_CONFIG.address;
  const excludePatterns = Array.isArray((loaded as any).excludePatterns)
    ? (loaded as any).excludePatterns.map((value: unknown) => String(value))
    : DEFAULT_CONFIG.excludePatterns;

  const theme = (loaded as any).theme === 'light' ? 'light' : 'dark';
  const rawOpenMode = (loaded as any).openMode;
  const openMode: AppConfig['openMode'] = ['local', 'remote', 'disabled'].includes(rawOpenMode)
    ? rawOpenMode : 'local';

  return {
    indexedDirectories,
    useAdminMode,
    address: normalizeAddress(address, DEFAULT_CONFIG.address),
    excludePatterns,
    theme,
    openMode
  };
}

export function applyCommandLineArgs(config: AppConfig, args: string[]): AppConfig {
  const nextConfig: AppConfig = {
    ...config,
    indexedDirectories: [...config.indexedDirectories]
  };

  for (const arg of args) {
    if (arg.startsWith('--dir=')) {
      nextConfig.indexedDirectories = [arg.replace('--dir=', '')];
    } else if (arg === '--admin') {
      nextConfig.useAdminMode = true;
    } else if (arg.startsWith('--address=')) {
      nextConfig.address = normalizeAddress(arg.replace('--address=', ''), nextConfig.address);
    }
  }

  return nextConfig;
}
