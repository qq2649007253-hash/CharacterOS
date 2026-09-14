import { randomBytes } from 'node:crypto';
import { characterInputSchema } from '@characteros/contracts/character';
import { characterRepository } from '@/server/repositories/characterRepository';
import { sqlite } from '@/server/database/client';
import { ownerId } from './identity';
sqlite.exec(`CREATE TABLE IF NOT EXISTS character_shares (token TEXT PRIMARY KEY, owner_id TEXT NOT NULL, character_id TEXT NOT NULL UNIQUE REFERENCES characters(id) ON DELETE CASCADE, snapshot TEXT NOT NULL);`);
export function manageShare(id: string, method: string) {
  const character = characterRepository.findById(id);
  if (!character) return Response.json({ error: '角色不存在' }, { status: 404 });
  if (method === 'DELETE') { sqlite.prepare('DELETE FROM character_shares WHERE character_id=? AND owner_id=?').run(id, ownerId()); return Response.json({ ok: true }); }
  if (method === 'GET') { const row = sqlite.prepare('SELECT token FROM character_shares WHERE character_id=? AND owner_id=?').get(id, ownerId()); return Response.json(row || { token: null }); }
  const snapshot = characterInputSchema.parse(character);
  const token = randomBytes(24).toString('base64url');
  sqlite.prepare('INSERT INTO character_shares VALUES (?,?,?,?) ON CONFLICT(character_id) DO UPDATE SET token=excluded.token,snapshot=excluded.snapshot').run(token, ownerId(), id, JSON.stringify(snapshot));
  return Response.json({ token });
}
export function receiveShare(token: string, method: string) {
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) return Response.json({ error: '分享无效或已撤销' }, { status: 404 });
  const row = sqlite.prepare('SELECT snapshot FROM character_shares WHERE token=?').get(token) as { snapshot: string } | undefined;
  if (!row) return Response.json({ error: '分享无效或已撤销' }, { status: 404 });
  const snapshot = characterInputSchema.parse(JSON.parse(row.snapshot));
  if (method === 'GET') return Response.json({ character: snapshot });
  return Response.json({ character: characterRepository.create(snapshot) }, { status: 201 });
}
