import { desc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

import { database } from '@/server/database/client';
import { notes } from '@/server/database/schema';

export const noteRepository = {
  create(characterId: string, content: string) {
    const now = new Date().toISOString();
    const note = { characterId, content, createdAt: now, id: randomUUID(), updatedAt: now };
    database.insert(notes).values(note).run();
    return note;
  },

  delete(id: string) {
    return database.delete(notes).where(eq(notes.id, id)).run().changes > 0;
  },

  findById(id: string) {
    return database.select().from(notes).where(eq(notes.id, id)).get();
  },

  list(characterId: string) {
    return database.select().from(notes).where(eq(notes.characterId, characterId)).orderBy(desc(notes.updatedAt)).all();
  },
};
