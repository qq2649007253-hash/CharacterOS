import { asc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

import type { ToolCallRecord, ToolCallStatus, ToolName, ToolRisk } from '@/domain/tool';
import { database } from '@/server/database/client';
import { toolCalls } from '@/server/database/schema';

export const toolCallRepository = {
  create(conversationId: string, characterId: string, toolName: ToolName, argumentsJson: string, risk: ToolRisk) {
    const now = new Date().toISOString();
    const record: ToolCallRecord = {
      argumentsJson,
      characterId,
      conversationId,
      createdAt: now,
      error: '',
      id: randomUUID(),
      resultJson: '',
      risk,
      status: risk === 'high' ? 'pending' : 'running',
      toolName,
      updatedAt: now,
    };
    database.insert(toolCalls).values(record).run();
    return record;
  },

  findById(id: string) {
    return database.select().from(toolCalls).where(eq(toolCalls.id, id)).get();
  },

  list(conversationId: string) {
    return database.select().from(toolCalls).where(eq(toolCalls.conversationId, conversationId)).orderBy(asc(toolCalls.createdAt)).all();
  },

  update(id: string, patch: { error?: string; resultJson?: string; status: ToolCallStatus }) {
    database.update(toolCalls).set({ ...patch, updatedAt: new Date().toISOString() }).where(eq(toolCalls.id, id)).run();
    return this.findById(id);
  },
};
