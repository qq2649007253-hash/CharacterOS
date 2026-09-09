import { knowledgeRepository } from '@/server/repositories/knowledgeRepository';
import { ollamaService } from '@/server/services/ollamaService';

export const embeddingIndexService = {
  async rebuild(characterId: string, signal?: AbortSignal) {
    const chunks = knowledgeRepository.listChunks(characterId);
    let indexed = 0;
    let model = process.env.OLLAMA_EMBED_MODEL || 'embeddinggemma';
    for (let offset = 0; offset < chunks.length; offset += 32) {
      const batch = chunks.slice(offset, offset + 32);
      const response = await ollamaService.embed(batch.map((chunk) => chunk.content), undefined, signal);
      model = response.model;
      batch.forEach((chunk, index) => knowledgeRepository.updateEmbedding(chunk.id, response.embeddings[index]));
      indexed += batch.length;
    }
    return { indexed, model, total: chunks.length };
  },

  status(characterId: string) {
    const chunks = knowledgeRepository.listChunks(characterId);
    return {
      embedded: chunks.filter((chunk) => Boolean(chunk.embeddingJson)).length,
      model: process.env.OLLAMA_EMBED_MODEL || 'embeddinggemma',
      total: chunks.length,
    };
  },
};
