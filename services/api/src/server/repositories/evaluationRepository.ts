import { desc } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

import type { EvaluationRecord } from '@characteros/contracts/observability';
import { database } from '@/server/database/client';
import { evaluations } from '@/server/database/schema';

export const evaluationRepository = {
  create(input: Omit<EvaluationRecord, 'createdAt' | 'id'>): EvaluationRecord {
    const record = { ...input, createdAt: new Date().toISOString(), id: randomUUID() };
    database.insert(evaluations).values(record).run();
    return record;
  },

  list(limit = 100) {
    return database.select().from(evaluations).orderBy(desc(evaluations.createdAt)).limit(limit).all();
  },
};
