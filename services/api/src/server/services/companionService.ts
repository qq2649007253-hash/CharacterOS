import defaults from '@characteros/contracts/defaultCompanions.json';
import { characterInputSchema } from '@characteros/contracts/character';
import { sqlite } from '@/server/database/client';
import { characterRepository } from '@/server/repositories/characterRepository';
import { ownerId } from './identity';
sqlite.exec('CREATE TABLE IF NOT EXISTS companion_initializations (user_id TEXT PRIMARY KEY)');
export function ensureCompanions() {
  sqlite.transaction(() => {
    const user = ownerId();
    if (sqlite.prepare('SELECT 1 FROM companion_initializations WHERE user_id=?').get(user)) return;
    const existing = new Set(characterRepository.findAll().map(c => c.name));
    for (const seed of defaults) if (!existing.has(seed.name)) characterRepository.create(characterInputSchema.parse(seed));
    sqlite.prepare('INSERT INTO companion_initializations VALUES (?)').run(user);
  })();
}
