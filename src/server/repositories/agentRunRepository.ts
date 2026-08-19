import { desc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

import type { AgentRun, AgentRunStatus } from '@/domain/observability';
import { database } from '@/server/database/client';
import { agentRuns } from '@/server/database/schema';

export const agentRunRepository = {
  create(conversationId: string, characterId: string, input: string, model: string): AgentRun {
    const run: AgentRun = {
      characterId,
      completedAt: '',
      conversationId,
      createdAt: new Date().toISOString(),
      error: '',
      id: randomUUID(),
      input,
      knowledgeHits: 0,
      latencyMs: 0,
      memoryHits: 0,
      model,
      output: '',
      retrievalMethod: 'none',
      status: 'running',
      toolCallId: '',
    };
    database.insert(agentRuns).values(run).run();
    return run;
  },

  findByToolCall(toolCallId: string) {
    return database.select().from(agentRuns).where(eq(agentRuns.toolCallId, toolCallId)).get();
  },

  list(limit = 100) {
    return database.select().from(agentRuns).orderBy(desc(agentRuns.createdAt)).limit(limit).all();
  },

  update(id: string, patch: Partial<Omit<AgentRun, 'id' | 'createdAt'>>) {
    database.update(agentRuns).set(patch).where(eq(agentRuns.id, id)).run();
    return database.select().from(agentRuns).where(eq(agentRuns.id, id)).get();
  },

  finish(id: string, status: Exclude<AgentRunStatus, 'running'>, startedAt: number, patch: Partial<AgentRun> = {}) {
    return this.update(id, {
      ...patch,
      completedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      status,
    });
  },
};
