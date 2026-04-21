import { marked } from 'marked';

marked.setOptions({ breaks: true, gfm: true } as any);

self.onmessage = (e: MessageEvent) => {
  const { id, text } = e.data;
  try {
    const html = marked.parse(text) as string;
    self.postMessage({ id, html });
  } catch (err: any) {
    self.postMessage({ id, error: err?.message ?? 'Parse error' });
  }
};
