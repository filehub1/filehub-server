import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/main/web-server.ts', 'src/main/config.ts', 'src/main/indexer.ts', 'src/main/preview.ts'],
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  outDir: 'dist/main',
  splitting: false,
  sourcemap: false,
  minify: false,
  dts: false,
  external: ['electron-log', 'flexsearch', 'xlsx', 'pdfjs-dist', 'prismjs', 'yauzl'],
});