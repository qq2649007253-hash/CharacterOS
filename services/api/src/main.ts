import { createServer } from 'node:http';
import { once } from 'node:events';
import path from 'node:path';

process.env.CHARACTEROS_DATA_DIR ||= path.resolve(__dirname, '../../../data');
type Handler = (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response> | Response;

async function start() {
  const { routes } = await import('./routes.generated');
  const { authorize } = await import('./server/services/authService');
  const server = createServer(async (incoming, outgoing) => {
    const controller = new AbortController();
    incoming.on('aborted', () => controller.abort());
    outgoing.on('close', () => { if (!outgoing.writableEnded) controller.abort(); });
    try {
      const url = new URL(incoming.url || '/', 'http://127.0.0.1');
      const origin = incoming.headers.origin;
      if (origin && (new URL(origin).host !== incoming.headers.host || !['http:', 'https:'].includes(new URL(origin).protocol))) {
        outgoing.writeHead(403).end(); return;
      }
      if (url.pathname === '/health') { outgoing.writeHead(200, { 'content-type': 'application/json' }).end('{"status":"ok"}'); return; }
      let match: RegExpMatchArray | null = null;
      const route = routes.find((item) => {
        match = url.pathname.match(new RegExp(`^${item.path.replace(/\[\w+\]/g, '([^/]+)')}/?$`));
        return !!match;
      });
      let response: Response;
      const method = incoming.method || 'GET';
      const handler = route && (route.handlers as Record<string, unknown>)[method] as Handler | undefined;
      if (!route) response = Response.json({ error: '接口不存在' }, { status: 404 });
      else if (!handler) response = Response.json({ error: '不支持此请求方式' }, { status: 405 });
      else {
        const chunks: Buffer[] = []; let size = 0;
        for await (const chunk of incoming) {
          size += chunk.length;
          if (size > 2 * 1024 * 1024) { outgoing.writeHead(413).end(); return; }
          chunks.push(chunk);
        }
        const params: Record<string, string> = {};
        Array.from(route.path.matchAll(/\[(\w+)\]/g)).forEach((item, index) => { params[item[1]] = decodeURIComponent(match![index + 1]); });
        const headers = new Headers();
        for (const [key, value] of Object.entries(incoming.headers)) if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
        const request = new Request(url, { method, headers, signal: controller.signal, ...(method !== 'GET' && method !== 'HEAD' ? { body: Buffer.concat(chunks) } : {}) });
        response = await authorize(request, () => handler(request, { params: Promise.resolve(params) }));
        response.headers.set('Cache-Control', 'no-store');
      }
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      if (response.body) {
        const reader = response.body.getReader();
        try {
          while (!controller.signal.aborted) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!outgoing.write(value)) await once(outgoing, 'drain', { signal: controller.signal });
          }
        } finally { await reader.cancel().catch(() => {}); }
      }
      outgoing.end();
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error('API request failed', error instanceof Error ? error.message : 'unknown');
      if (!outgoing.headersSent) outgoing.writeHead(error instanceof SyntaxError || error instanceof URIError ? 400 : 500, { 'content-type': 'application/json' });
      outgoing.end(JSON.stringify({ error: '请求处理失败，请稍后重试' }));
    }
  });
  server.listen(Number(process.env.API_PORT || 4318), '127.0.0.1', () => console.log(`CharacterOS API ready on ${process.env.API_PORT || 4318}`));
}
void start();

