import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { z } from 'zod';
import { sqlite } from '@/server/database/client';
import { identity, type User } from './identity';
const derive = promisify(scrypt);
const credentials = z.object({ username: z.string().trim().regex(/^[a-zA-Z0-9_]{3,32}$/), password: z.string().min(10).max(128) }).strict();
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const cookie = (value: string, age = 604800) => `characteros_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${process.env.CHARACTEROS_SECURE_COOKIE === '1' ? '; Secure' : ''}`;
const token = (request: Request) => (request.headers.get('cookie') || '').split(';').map(s => s.trim()).find(s => s.startsWith('characteros_session='))?.slice(20) || '';
function current(request: Request): User | undefined {
  return sqlite.prepare('SELECT u.id,u.username,u.role,u.disabled FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.disabled=0').get(digest(token(request)), Date.now()) as User | undefined;
}
function session(user: User) {
  const value = randomBytes(32).toString('base64url');
  sqlite.prepare('DELETE FROM sessions WHERE expires_at<=?').run(Date.now());
  sqlite.prepare('INSERT INTO sessions VALUES (?,?,?)').run(digest(value), user.id, Date.now() + 604800000);
  return Response.json({ user }, { headers: { 'Set-Cookie': cookie(value), 'Cache-Control': 'no-store' } });
}
let attempts = 0; let resetAt = 0; let hashing = 0;
export async function authAction(request: Request, action: string) {
  if (action === 'me' && request.method === 'GET') return Response.json({ user: current(request) || null, needsSetup: !sqlite.prepare('SELECT 1 FROM users LIMIT 1').get() }, { headers: { 'Cache-Control': 'no-store' } });
  if (action === 'logout' && request.method === 'POST') { sqlite.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(token(request))); return Response.json({ ok: true }, { headers: { 'Set-Cookie': cookie('', 0) } }); }
  if (!['login','register','setup'].includes(action) || request.method !== 'POST') return Response.json({ error: '接口不存在' }, { status: 404 });
  if (Date.now() > resetAt) { attempts = 0; resetAt = Date.now() + 900000; }
  if (++attempts > 40 || hashing >= 2) return Response.json({ error: '尝试过于频繁，请稍后再试' }, { status: 429 });
  const parsed = credentials.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: '用户名需 3–32 位字母、数字或下划线；密码需 10–128 位' }, { status: 400 });
  const { username, password } = parsed.data;
  hashing++;
  try {
    if (action === 'login') {
      const user = sqlite.prepare('SELECT * FROM users WHERE username=?').get(username) as (User & { password_hash: string }) | undefined;
      const [salt, expected] = (user?.password_hash || `${'0'.repeat(32)}:${'0'.repeat(128)}`).split(':');
      const actual = await derive(password, salt, 64) as Buffer;
      if (!user || user.disabled || !timingSafeEqual(actual, Buffer.from(expected, 'hex'))) return Response.json({ error: '用户名或密码错误' }, { status: 401 });
      return session({ id: user.id, username: user.username, role: user.role, disabled: user.disabled });
    }
    const salt = randomBytes(16).toString('hex');
    const hash = `${salt}:${(await derive(password, salt, 64) as Buffer).toString('hex')}`;
    const result = sqlite.transaction(() => {
      const exists = !!sqlite.prepare('SELECT 1 FROM users LIMIT 1').get();
      if ((action === 'setup') === exists) return null;
      if (sqlite.prepare('SELECT 1 FROM users WHERE username=?').get(username)) return null;
      const user: User = { id: randomUUID(), username, role: action === 'setup' ? 'admin' : 'user', disabled: 0 };
      sqlite.prepare('INSERT INTO users VALUES (?,?,?,?,0)').run(user.id, username, hash, user.role);
      if (action === 'setup') sqlite.prepare('UPDATE characters SET owner_id=? WHERE owner_id IS NULL').run(user.id);
      return user;
    })();
    return result ? session(result) : Response.json({ error: '账号已存在或初始化状态已变化，请刷新后重试' }, { status: 409 });
  } finally { hashing--; }
}
export async function adminUsers(request: Request) {
  if (request.method === 'POST') {
    const parsed = credentials.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: '用户名或密码格式无效' }, { status: 400 });
    if (hashing >= 2) return Response.json({ error: '请稍后再试' }, { status: 429 });
    hashing++;
    try {
      const salt = randomBytes(16).toString('hex');
      const hash = salt + ':' + (await derive(parsed.data.password, salt, 64) as Buffer).toString('hex');
      if (sqlite.prepare('SELECT 1 FROM users WHERE username=?').get(parsed.data.username)) return Response.json({ error: '账号已存在' }, { status: 409 });
      sqlite.prepare('INSERT INTO users VALUES (?,?,?,?,0)').run(randomUUID(), parsed.data.username, hash, 'user');
      return Response.json({ ok: true }, { status: 201 });
    } finally { hashing--; }
  }
  if (request.method === 'GET') return Response.json({ users: sqlite.prepare('SELECT id,username,role,disabled FROM users ORDER BY username LIMIT 500').all() });
  const parsed = z.object({ id: z.string(), role: z.enum(['admin','user']), disabled: z.boolean() }).strict().safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: '账号参数无效' }, { status: 400 });
  if (parsed.data.id === identity.getStore()?.id) return Response.json({ error: '不能修改自己的管理权限或停用自己' }, { status: 400 });
  const result = sqlite.transaction(() => {
    const result = sqlite.prepare('UPDATE users SET role=?,disabled=? WHERE id=?').run(parsed.data.role, Number(parsed.data.disabled), parsed.data.id);
    sqlite.prepare('DELETE FROM sessions WHERE user_id=?').run(parsed.data.id);
    return result;
  })();
  return result.changes ? Response.json({ ok: true }) : Response.json({ error: '账号不存在' }, { status: 404 });
}
export async function authorize(request: Request, invoke: () => Promise<Response> | Response): Promise<Response> {
  const url = new URL(request.url); const pathname = url.pathname.replace(/\/$/, '');
  if (!['GET','HEAD'].includes(request.method) && !request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return Response.json({ error: '需要 JSON 请求' }, { status: 415 });
  if (pathname.startsWith('/api/auth/')) return invoke();
  const user = current(request);
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 });
  if (pathname.startsWith('/api/admin/') || pathname.startsWith('/api/observability/') || pathname === '/api/evaluations') {
    if (user.role !== 'admin') return Response.json({ error: '需要管理员权限' }, { status: 403 });
  } else {
    let characterId = url.searchParams.get('characterId');
    let conversationId: string | undefined;
    const characterMatch = pathname.match(/^\/api\/characters\/([^/]+)/);
    if (characterMatch) characterId = decodeURIComponent(characterMatch[1]);
    const conversationMatch = pathname.match(/^\/api\/conversations\/([^/]+)/);
    if (conversationMatch) conversationId = decodeURIComponent(conversationMatch[1]);
    if (request.method !== 'GET') {
      const text = await request.clone().text();
      const body = text ? JSON.parse(text) : {};
      if (!body || typeof body !== 'object' || (body.characterId && typeof body.characterId !== 'string') || (body.conversationId && typeof body.conversationId !== 'string')) return Response.json({ error: '请求参数无效' }, { status: 400 });
      if (body.characterId) characterId = body.characterId;
      if (body.conversationId) conversationId = body.conversationId;
    }
    const toolMatch = pathname.match(/^\/api\/tool-calls\/([^/]+)/);
    if (toolMatch) {
      const tool = sqlite.prepare('SELECT character_id FROM tool_calls WHERE id=?').get(decodeURIComponent(toolMatch[1])) as { character_id: string } | undefined;
      if (!tool) return Response.json({ error: '记录不存在' }, { status: 404 });
      // Never allow body identifiers to override the resource addressed by the URL.
      characterId = tool.character_id;
    }
    if (characterMatch) characterId = decodeURIComponent(characterMatch[1]);
    if (conversationMatch) conversationId = decodeURIComponent(conversationMatch[1]);
    if (conversationId) {
      const row = sqlite.prepare('SELECT c.owner_id FROM conversations v JOIN characters c ON c.id=v.character_id WHERE v.id=?').get(conversationId) as { owner_id: string } | undefined;
      if (!row || row.owner_id !== user.id) return Response.json({ error: '对话不存在' }, { status: 404 });
    }
    if (characterId) {
      const row = sqlite.prepare('SELECT owner_id FROM characters WHERE id=?').get(characterId) as { owner_id: string } | undefined;
      if (!row || row.owner_id !== user.id) return Response.json({ error: '角色不存在' }, { status: 404 });
    }
  }
  return identity.run(user, invoke);
}
