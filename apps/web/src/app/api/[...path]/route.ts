export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function proxy(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== request.headers.get('host')) return Response.json({ error: '请求来源不匹配' }, { status: 403 });
  const { path } = await context.params;
  const base = process.env.CHARACTEROS_API_URL || 'http://127.0.0.1:4318';
  const url = new URL(`/api/${path.map(encodeURIComponent).join('/')}`, base);
  url.search = new URL(request.url).search;
  try {
    const headers = new Headers(request.headers);
    for (const name of ['origin', 'host', 'connection', 'content-length', 'transfer-encoding']) headers.delete(name);
    const response = await fetch(url, { method: request.method, headers, signal: request.signal, cache: 'no-store', ...(request.method !== 'GET' && request.method !== 'HEAD' ? { body: await request.arrayBuffer() } : {}) });
    const resultHeaders = new Headers(response.headers);
    for (const name of ['connection', 'transfer-encoding', 'content-encoding', 'content-length']) resultHeaders.delete(name);
    return new Response(response.body, { status: response.status, headers: resultHeaders });
  } catch {
    return Response.json({ error: '暂时无法连接服务，请确认 CharacterOS 后端已启动。' }, { status: 502 });
  }
}
export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE, proxy as HEAD, proxy as OPTIONS };

