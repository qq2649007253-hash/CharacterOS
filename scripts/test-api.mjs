import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
const directory = await mkdtemp(path.join(tmpdir(), 'characteros-api-test-'));
const socket = net.createServer();
await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
const port = socket.address().port;
await new Promise(resolve => socket.close(resolve));
const child = spawn(process.execPath, ['services/api/dist/server.cjs'], { env: { ...process.env, API_PORT: String(port), CHARACTEROS_DATA_DIR: directory }, stdio: 'pipe' });
let logs = ''; child.stderr.on('data', chunk => { logs += chunk; });
const base = `http://127.0.0.1:${port}`;
let sessionCookie = '';
const request = (route, method = 'GET', body) => fetch(`${base}${route}`, { method, headers: { 'Content-Type': 'application/json', Cookie: sessionCookie }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
try {
  for (let i = 0; i < 80; i++) {
    if (child.exitCode !== null) throw new Error(logs);
    if (await fetch(`${base}/health`).then(r => r.ok).catch(() => false)) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal((await request('/api/characters')).status, 401);
  const legacyDb = new Database(path.join(directory, 'characteros.db'));
  legacyDb.prepare("INSERT INTO characters(id,name,greeting,system_prompt,model,created_at,updated_at) VALUES ('legacy-before-login','旧角色','你好','测试','test','2020','2020')").run(); legacyDb.close();
  const setup = await request('/api/auth/setup', 'POST', { username: 'testadmin', password: 'test-password-234' });
  assert.equal(setup.status, 200); sessionCookie = setup.headers.get('set-cookie').split(';')[0];
  assert.equal((await request('/api/characters/legacy-before-login')).status, 200);
  assert.equal((await request('/health')).status, 200);
  assert.equal((await request('/missing')).status, 404);
  assert.equal((await request('/api/characters', 'PUT', {})).status, 405);
  assert.equal((await request('/api/characters', 'POST', {})).status, 400);
  assert.equal((await fetch(`${base}/api/characters`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: sessionCookie }, body: '{' })).status, 400);
  assert.equal((await fetch(`${base}/api/characters`, { headers: { Origin: 'https://example.com' } })).status, 403);
  const created = await request('/api/characters', 'POST', { name: '隔离测试角色', greeting: '你好', systemPrompt: '你是测试角色', model: 'test' });
  assert.equal(created.status, 201);
  const character = await created.json();
  assert.equal((await (await request(`/api/characters/${character.id}`)).json()).name, '隔离测试角色');
  assert.equal((await request(`/api/characters/${character.id}`, 'PATCH', { description: '独立服务验证' })).status, 200);
  const conversationResponse = await request('/api/conversations', 'POST', { characterId: character.id });
  assert.equal(conversationResponse.status, 201);
  const { conversation } = await conversationResponse.json();
  assert.equal((await request(`/api/conversations/${conversation.id}`)).status, 200);
  // Same timestamps exercise the ID tie-breaker, using only the isolated database.
  const fixture = new Database(path.join(directory, 'characteros.db'));
  try {
    fixture.transaction(() => {
      const insert = fixture.prepare('INSERT INTO conversations (id, character_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)');
      for (let i = 0; i < 45; i++) insert.run('page-' + String(i).padStart(3, '0'), character.id, '分页测试', '2020-01-01T00:00:00.000Z', '2020-01-01T00:00:00.000Z');
    })();
  } finally { fixture.close(); }
  const first = await (await request('/api/conversations?characterId=' + character.id)).json();
  assert.equal(first.conversations.length, 20); assert.ok(first.nextCursor);
  const newer = await (await request('/api/conversations', 'POST', { characterId: character.id })).json();
  const ids = first.conversations.map(item => item.id);
  let cursor = first.nextCursor;
  while (cursor) {
    const page = await (await request('/api/conversations?characterId=' + character.id + '&cursor=' + encodeURIComponent(cursor))).json();
    assert.ok(page.conversations.length <= 20);
    ids.push(...page.conversations.map(item => item.id)); cursor = page.nextCursor;
  }
  assert.equal(ids.length, 46); assert.equal(new Set(ids).size, 46);
  assert.ok(!ids.includes(newer.conversation.id));
  const fresh = await (await request('/api/conversations?characterId=' + character.id)).json();
  assert.ok(fresh.conversations.some(item => item.id === newer.conversation.id));
  const empty = await (await request('/api/conversations?characterId=missing')).json();
  assert.equal(empty.error, '角色不存在');
  for (const query of ['limit=0', 'limit=51', 'limit=abc', 'cursor=invalid'])
    assert.equal((await request('/api/conversations?characterId=' + character.id + '&' + query)).status, 400);
  assert.equal((await request('/api/chat', 'POST', { characterId: 'missing', conversationId: conversation.id, content: '你好' })).status, 404);
  assert.equal((await request('/api/tts', 'POST', { text: '' })).status, 400);
  const adminCookie = sessionCookie;
  const admin = (await (await request('/api/auth/me')).json()).user;
  assert.equal((await request('/api/auth/setup', 'POST', { username: 'secondadmin', password: 'test-password-234' })).status, 409);
  assert.equal((await request('/api/auth/register', 'POST', { username: 'memberone', password: 'test-password-234', role: 'admin' })).status, 400);
  const registration = await request('/api/auth/register', 'POST', { username: 'memberone', password: 'test-password-234' });
  assert.equal(registration.status, 200); const member = (await registration.json()).user; assert.equal(member.role, 'user');
  sessionCookie = registration.headers.get('set-cookie').split(';')[0]; const memberCookie = sessionCookie;
  assert.equal((await request('/api/admin/users')).status, 403);
  assert.equal((await request('/api/evaluations')).status, 403);
  assert.equal((await request('/api/observability/runs')).status, 403);
  assert.equal((await request('/api/admin/users', 'PATCH', { id: member.id, role: 'admin', disabled: false })).status, 403);
  assert.equal((await request(`/api/characters/${character.id}`)).status, 404);
  assert.equal((await request(`/api/characters/${character.id}`, 'PATCH', { name: '被修改' })).status, 404);
  assert.equal((await request(`/api/characters/${character.id}/memories`)).status, 404);
  assert.equal((await request(`/api/conversations/${conversation.id}`)).status, 404);
  assert.equal((await request('/api/chat', 'POST', { characterId: character.id, conversationId: conversation.id, content: '越权' })).status, 404);
  const starter = (await (await request('/api/characters')).json()).items;
  assert.equal(starter.length, 3);
  assert.equal((await (await request('/api/characters')).json()).items.length, 3);
  assert.deepEqual(starter.map(c => c.name).sort(), ['苏晚','许知遥','夏栀'].sort());
  sessionCookie = adminCookie;
  const shared = await (await request(`/api/characters/${character.id}/share`, 'POST', {})).json();
  assert.ok(shared.token);
  sessionCookie = memberCookie;
  assert.equal((await request(`/api/characters/${character.id}/share`, 'POST', {})).status, 404);
  const snapshot = (await (await request('/api/shares/' + shared.token)).json()).character;
  assert.ok(!('ownerId' in snapshot)); assert.ok(!('id' in snapshot)); assert.ok(!('messages' in snapshot));
  const importedResponse = await request('/api/shares/' + shared.token, 'POST', {});
  assert.equal(importedResponse.status, 201); const imported = (await importedResponse.json()).character;
  assert.notEqual(imported.id, character.id);
  assert.equal((await request(`/api/characters/${imported.id}`)).status, 200);
  sessionCookie = adminCookie;
  assert.equal((await request(`/api/characters/${imported.id}`)).status, 404);
  assert.equal((await request(`/api/characters/${character.id}/share`, 'DELETE')).status, 200);
  sessionCookie = memberCookie;
  assert.equal((await request('/api/shares/' + shared.token)).status, 404);
  assert.equal((await request(`/api/characters/${imported.id}`)).status, 200);
  await request(`/api/characters/${starter[0].id}`, 'DELETE');
  assert.equal((await (await request('/api/characters')).json()).items.some(c => c.id === starter[0].id), false);
  const own = await (await request('/api/characters', 'POST', { name: '我的角色', greeting: '你好', systemPrompt: '测试', model: 'test' })).json();
  assert.equal((await request(`/api/characters/${own.id}`)).status, 200);
  assert.equal((await request('/api/auth/logout', 'POST', {})).status, 200);
  assert.equal((await request('/api/characters')).status, 401);
  assert.equal((await request('/api/auth/login', 'POST', { username: 'memberone', password: 'wrong-password-234' })).status, 401);
  const login = await request('/api/auth/login', 'POST', { username: 'memberone', password: 'test-password-234' });
  assert.equal(login.status, 200); const freshCookie = login.headers.get('set-cookie').split(';')[0]; assert.notEqual(freshCookie, memberCookie);
  sessionCookie = adminCookie;
  assert.equal((await request(`/api/characters/${own.id}`)).status, 404);
  assert.equal((await request('/api/admin/users', 'PATCH', { id: admin.id, role: 'user', disabled: true })).status, 400);
  assert.equal((await request('/api/admin/users', 'PATCH', { id: member.id, role: 'user', disabled: true })).status, 200);
  sessionCookie = freshCookie;
  assert.equal((await request('/api/characters')).status, 401);
  assert.equal((await request('/api/auth/login', 'POST', { username: 'memberone', password: 'test-password-234' })).status, 401);
  sessionCookie = adminCookie;
  const accounts = await (await request('/api/admin/users')).json();
  assert.ok(accounts.users.every(user => !('password_hash' in user)));
  assert.equal((await request(`/api/characters/${character.id}`, 'DELETE')).status, 204);
  assert.equal((await request(`/api/characters/${character.id}`)).status, 404);
  console.log('Independent API HTTP smoke checks passed (authentication, ownership, role permissions, CRUD and pagination; isolated database).');
} finally {
  child.kill();
  if (child.exitCode === null) await new Promise(resolve => child.once('exit', resolve));
  const relative = path.relative(tmpdir(), directory);
  if (relative.startsWith('characteros-api-test-') && !relative.includes(path.sep)) await rm(directory, { recursive: true, force: true });
}

