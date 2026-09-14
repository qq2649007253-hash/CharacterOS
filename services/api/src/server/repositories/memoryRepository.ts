import { desc, eq, inArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

import { database } from '@/server/database/client';
import { memories } from '@/server/database/schema';

export type MemoryKind = 'event' | 'fact' | 'preference' | 'relationship';

export const memoryRepository = {
  create(characterId: string, conversationId: string, kind: MemoryKind, content: string, confidence = 70) {
    const now = new Date().toISOString();
    const memory = {
      characterId,
      confidence,
      content,
      conversationId,
      createdAt: now,
      id: randomUUID(),
      kind,
      lastAccessedAt: now,
      updatedAt: now,
    };
    database.insert(memories).values(memory).run();
    return memory;
  },

  list(characterId: string, limit = 100) {
    return database
      .select()
      .from(memories)
      .where(eq(memories.characterId, characterId))
      .orderBy(desc(memories.updatedAt))
      .limit(limit)
      .all();
  },

  touch(ids: string[]) {
    if (!ids.length) return;
    const now = new Date().toISOString();
    const uniqueIds = [...new Set(ids)];
    database.transaction((transaction) => {
      for (let offset = 0; offset < uniqueIds.length; offset += 500) {
        transaction.update(memories).set({ lastAccessedAt: now })
          .where(inArray(memories.id, uniqueIds.slice(offset, offset + 500))).run();
      }
    });
  },
};
