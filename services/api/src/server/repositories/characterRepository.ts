import { and, desc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

import type { Character, CharacterInput } from '@characteros/contracts/character';
import { database } from '@/server/database/client';
import { ownerId } from '@/server/services/identity';
import { characters } from '@/server/database/schema';

export const characterRepository = {
  create(input: CharacterInput): Character {
    const now = new Date().toISOString();
    const character: Character = { ...input, createdAt: now, id: randomUUID(), updatedAt: now };
    database.insert(characters).values({ ...character, ownerId: ownerId() }).run();
    return character;
  },

  delete(id: string): boolean {
    return database.delete(characters).where(and(eq(characters.id, id), eq(characters.ownerId, ownerId()))).run().changes > 0;
  },

  findAll(): Character[] {
    return database.select().from(characters).where(eq(characters.ownerId, ownerId())).orderBy(desc(characters.updatedAt)).all();
  },

  findById(id: string): Character | undefined {
    return database.select().from(characters).where(eq(characters.id, id)).get();
  },

  update(id: string, patch: Partial<CharacterInput>): Character | undefined {
    const updatedAt = new Date().toISOString();
    const result = database
      .update(characters)
      .set({ ...patch, updatedAt })
      .where(eq(characters.id, id))
      .run();
    return result.changes ? this.findById(id) : undefined;
  },
};
