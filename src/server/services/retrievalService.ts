import type { RetrievedKnowledge } from '@/domain/knowledge';
import { knowledgeRepository } from '@/server/repositories/knowledgeRepository';
import { memoryRepository } from '@/server/repositories/memoryRepository';

export const terms = (value: string) => {
  const normalized = value.toLocaleLowerCase();
  const latin = normalized.match(/[a-z0-9_]{2,}/g) || [];
  const chineseRuns = normalized.match(/[\u3400-\u9fff]+/g) || [];
  const chinese = chineseRuns.flatMap((run) => {
    const result = [run];
    for (let size = 2; size <= Math.min(4, run.length); size += 1) {
      for (let index = 0; index <= run.length - size; index += 1) result.push(run.slice(index, index + size));
    }
    return result;
  });
  return [...new Set([...latin, ...chinese])];
};

export const scoreText = (query: string, value: string) => {
  const text = value.toLocaleLowerCase();
  return terms(query).reduce(
    (score, term) => score + (text.includes(term) ? Math.max(1, term.length - 1) : 0),
    0,
  );
};

export const retrievalService = {
  knowledge(characterId: string, query: string, limit = 5): RetrievedKnowledge[] {
    const titles = new Map(knowledgeRepository.list(characterId).map((document) => [document.id, document.title]));
    return knowledgeRepository
      .listChunks(characterId)
      .map((chunk) => ({
        content: chunk.content,
        documentId: chunk.documentId,
        score: scoreText(query, chunk.searchText),
        title: titles.get(chunk.documentId) || '知识资料',
      }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);
  },

  memories(characterId: string, query: string, limit = 6) {
    const ranked = memoryRepository
      .list(characterId)
      .map((memory) => ({ ...memory, score: scoreText(query, memory.content) + memory.confidence / 100 }))
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);
    memoryRepository.touch(ranked.map((memory) => memory.id));
    return ranked;
  },
};
