import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { createRequire } from 'module';

const _require = createRequire(import.meta.url);

const address = (() => {
  try {
    const yaml = _require('js-yaml');
    const cfgPath = path.join(os.homedir(), '.filehub');
    if (fs.existsSync(cfgPath)) {
      const cfg: any = yaml.load(fs.readFileSync(cfgPath, 'utf8'));
      const addr: string = cfg?.serviceAddress || cfg?.address || '127.0.0.1:3000';
      const [host, port] = addr.split(':');
      return `http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}`;
    }
  } catch { /* ignore */ }
  return 'http://127.0.0.1:3000';
})();

export default defineConfig({
  plugins: [react()],
  root: 'src/renderer',
  base: './',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
  },
  server: {
    host: '0.0.0.0',
    port: 6544,
    proxy: {
      '/api': {
        target: address,
        changeOrigin: true
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer'),
    },
  },
});
