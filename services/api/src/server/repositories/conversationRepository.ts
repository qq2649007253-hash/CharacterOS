import { and, desc, eq, lt, or } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

import type { Conversation, PersistedMessage } from '@characteros/contracts/conversation';
import { database } from '@/server/database/client';
import { conversations, messages } from '@/server/database/schema';

export const conversationRepository = {
  addMessage(conversationId: string, role: PersistedMessage['role'], content: string, citationsJson = '') {
    const createdAt = new Date().toISOString();
    const message: PersistedMessage = { citationsJson, content, conversationId, createdAt, id: randomUUID(), role };
    database.insert(messages).values(message).run();
    database.update(conversations).set({ updatedAt: createdAt }).where(eq(conversations.id, conversationId)).run();
    return message;
  },

  create(characterId: string, greeting: string): Conversation {
    const now = new Date().toISOString();
    const conversation: Conversation = {
      characterId,
      createdAt: now,
      id: randomUUID(),
      title: '新对话',
      updatedAt: now,
    };
    database.insert(conversations).values(conversation).run();
    this.addMessage(conversation.id, 'assistant', greeting);
    return conversation;
  },

  findById(id: string) {
    return database.select().from(conversations).where(eq(conversations.id, id)).get();
  },

  findForCharacter(id: string, characterId: string) {
    return database
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, id), eq(conversations.characterId, characterId)))
      .get();
  },

  list(characterId: string, limit = 20, cursor?: { updatedAt: string; id: string }) {
    const rows = database.select().from(conversations)
      .where(and(eq(conversations.characterId, characterId), cursor ? or(
        lt(conversations.updatedAt, cursor.updatedAt),
        and(eq(conversations.updatedAt, cursor.updatedAt), lt(conversations.id, cursor.id)),
      ) : undefined))
      .orderBy(desc(conversations.updatedAt), desc(conversations.id))
      .limit(limit + 1).all();
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return { conversations: page, nextCursor: rows.length > limit && last
      ? Buffer.from(JSON.stringify({ updatedAt: last.updatedAt, id: last.id })).toString('base64url') : null };
  },

  listMessages(conversationId: string, limit = 40) {
    const recent = database
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(limit)
      .all();
    return recent.reverse();
  },

  renameFromFirstMessage(conversationId: string, content: string) {
    const title = content.replace(/\s+/g, ' ').slice(0, 24) || '新对话';
    database.update(conversations).set({ title }).where(eq(conversations.id, conversationId)).run();
  },
};
