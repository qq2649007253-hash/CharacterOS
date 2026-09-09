import assert from 'node:assert/strict';
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
const request = (route, method = 'GET', body) => fetch(`${base}${route}`, { method, headers: { 'Content-Type': 'application/json' }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
try {
  for (let i = 0; i < 80; i++) {
    if (child.exitCode !== null) throw new Error(logs);
    if (await fetch(`${base}/health`).then(r => r.ok).catch(() => false)) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal((await request('/health')).status, 200);
  assert.equal((await request('/missing')).status, 404);
  assert.equal((await request('/api/characters', 'PUT', {})).status, 405);
  assert.equal((await request('/api/characters', 'POST', {})).status, 400);
  assert.equal((await fetch(`${base}/api/characters`, { method: 'POST', body: '{' })).status, 400);
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
  assert.equal((await request('/api/chat', 'POST', { characterId: 'missing', conversationId: conversation.id, content: '你好' })).status, 404);
  assert.equal((await request('/api/tts', 'POST', { text: '' })).status, 400);
  assert.equal((await request(`/api/characters/${character.id}`, 'DELETE')).status, 204);
  assert.equal((await request(`/api/characters/${character.id}`)).status, 404);
  console.log('Independent API HTTP smoke checks passed (15 assertions, isolated database).');
} finally {
  child.kill();
  if (child.exitCode === null) await new Promise(resolve => child.once('exit', resolve));
  const relative = path.relative(tmpdir(), directory);
  if (relative.startsWith('characteros-api-test-') && !relative.includes(path.sep)) await rm(directory, { recursive: true, force: true });
}

