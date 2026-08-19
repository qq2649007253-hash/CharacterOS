import type { RetrievedKnowledge } from '@/domain/knowledge';
import { knowledgeRepository } from '@/server/repositories/knowledgeRepository';
import { memoryRepository } from '@/server/repositories/memoryRepository';
import { ollamaService } from '@/server/services/ollamaService';

let embeddingUnavailableUntil = 0;

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

export const cosineSimilarity = (left: number[], right: number[]) => {
  if (!left.length || left.length !== right.length) return 0;
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] ** 2;
    rightMagnitude += right[index] ** 2;
  }
  if (!leftMagnitude || !rightMagnitude) return 0;
  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
};

const keywordResults = (characterId: string, query: string, limit: number): RetrievedKnowledge[] => {
  const titles = new Map(knowledgeRepository.list(characterId).map((document) => [document.id, document.title]));
  return knowledgeRepository
    .listChunks(characterId)
    .map((chunk) => ({
      content: chunk.content,
      documentId: chunk.documentId,
      method: 'keyword' as const,
      score: scoreText(query, chunk.searchText),
      title: titles.get(chunk.documentId) || '知识资料',
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
};

const hybridResults = async (characterId: string, query: string, limit: number, signal?: AbortSignal) => {
  if (Date.now() < embeddingUnavailableUntil) return undefined;
  const titles = new Map(knowledgeRepository.list(characterId).map((document) => [document.id, document.title]));
  const chunks = knowledgeRepository.listChunks(characterId).slice(0, 64);
  if (!chunks.length) return [];
  try {
    const missing = chunks.filter((chunk) => !chunk.embeddingJson);
    const { embeddings } = await ollamaService.embed([query, ...missing.map((chunk) => chunk.content)], undefined, signal);
    const queryEmbedding = embeddings[0];
    missing.forEach((chunk, index) => knowledgeRepository.updateEmbedding(chunk.id, embeddings[index + 1]));
    const newlyEmbedded = new Map(missing.map((chunk, index) => [chunk.id, embeddings[index + 1]]));
    const lexicalScores = chunks.map((chunk) => scoreText(query, chunk.searchText));
    const maxLexical = Math.max(1, ...lexicalScores);
    return chunks
      .map((chunk, index) => {
        const embedding = chunk.embeddingJson ? JSON.parse(chunk.embeddingJson) as number[] : newlyEmbedded.get(chunk.id) || [];
        const semantic = (cosineSimilarity(queryEmbedding, embedding) + 1) / 2;
        const lexical = lexicalScores[index] / maxLexical;
        return {
          content: chunk.content,
          documentId: chunk.documentId,
          method: 'hybrid' as const,
          score: Number((semantic * 0.68 + lexical * 0.32).toFixed(4)),
          semantic,
          title: titles.get(chunk.documentId) || '知识资料',
        };
      })
      .filter((item, index) => item.semantic >= 0.54 || lexicalScores[index] > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, limit)
      .map((item) => ({
        content: item.content,
        documentId: item.documentId,
        method: item.method,
        score: item.score,
        title: item.title,
      }));
  } catch {
    embeddingUnavailableUntil = Date.now() + 60_000;
    return undefined;
  }
};

export const retrievalService = {
  async knowledge(characterId: string, query: string, limit = 5, signal?: AbortSignal): Promise<RetrievedKnowledge[]> {
    return (await hybridResults(characterId, query, limit, signal)) ?? keywordResults(characterId, query, limit);
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
