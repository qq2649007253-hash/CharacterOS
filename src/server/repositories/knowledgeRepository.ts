import { asc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

import type { KnowledgeDocument } from '@/domain/knowledge';
import { database } from '@/server/database/client';
import { knowledgeChunks, knowledgeDocuments } from '@/server/database/schema';

const normalize = (value: string) => value.toLocaleLowerCase().replace(/\s+/g, ' ').trim();

const splitIntoChunks = (content: string, maxLength = 480) => {
  const sections = content.split(/(?<=[。！？!?\n])/).map((item) => item.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = '';
  for (const section of sections) {
    if (current && current.length + section.length > maxLength) {
      chunks.push(current);
      current = '';
    }
    if (section.length > maxLength) {
      for (let offset = 0; offset < section.length; offset += maxLength - 80) {
        chunks.push(section.slice(offset, offset + maxLength));
      }
    } else {
      current += `${current ? '\n' : ''}${section}`;
    }
  }
  if (current) chunks.push(current);
  return chunks;
};

const chunkValues = (documentId: string, characterId: string, content: string) =>
  splitIntoChunks(content).map((chunk, position) => ({
    characterId,
    content: chunk,
    documentId,
    id: randomUUID(),
    position,
    searchText: normalize(chunk),
  }));

export const knowledgeRepository = {
  create(characterId: string, title: string, content: string, source = 'manual'): KnowledgeDocument {
    const now = new Date().toISOString();
    const document: KnowledgeDocument = {
      characterId,
      content,
      createdAt: now,
      id: randomUUID(),
      source,
      title,
      updatedAt: now,
    };
    database.transaction((transaction) => {
      transaction.insert(knowledgeDocuments).values(document).run();
      const chunks = chunkValues(document.id, characterId, content);
      if (chunks.length) transaction.insert(knowledgeChunks).values(chunks).run();
    });
    return document;
  },

  delete(id: string) {
    return database.transaction((transaction) => {
      transaction.delete(knowledgeChunks).where(eq(knowledgeChunks.documentId, id)).run();
      return transaction.delete(knowledgeDocuments).where(eq(knowledgeDocuments.id, id)).run().changes > 0;
    });
  },

  ensureLoreDocument(characterId: string, lore: string) {
    const existing = database
      .select()
      .from(knowledgeDocuments)
      .where(eq(knowledgeDocuments.characterId, characterId))
      .all()
      .find((document) => document.source === 'character-lore');
    if (!lore.trim()) return existing;
    if (existing) {
      if (existing.content === lore) return existing;
      const updatedAt = new Date().toISOString();
      database.transaction((transaction) => {
        transaction.update(knowledgeDocuments).set({ content: lore, updatedAt }).where(eq(knowledgeDocuments.id, existing.id)).run();
        transaction.delete(knowledgeChunks).where(eq(knowledgeChunks.documentId, existing.id)).run();
        const chunks = chunkValues(existing.id, characterId, lore);
        if (chunks.length) transaction.insert(knowledgeChunks).values(chunks).run();
      });
      return { ...existing, content: lore, updatedAt };
    }
    return this.create(characterId, '角色背景资料', lore, 'character-lore');
  },

  list(characterId: string) {
    return database
      .select()
      .from(knowledgeDocuments)
      .where(eq(knowledgeDocuments.characterId, characterId))
      .orderBy(asc(knowledgeDocuments.createdAt))
      .all();
  },

  listChunks(characterId: string) {
    return database
      .select()
      .from(knowledgeChunks)
      .where(eq(knowledgeChunks.characterId, characterId))
      .all();
  },
};
