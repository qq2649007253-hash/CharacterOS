import { z } from 'zod';

export const knowledgeDocumentInputSchema = z.object({
  content: z.string().trim().min(1).max(100_000),
  title: z.string().trim().min(1).max(120),
});

export interface KnowledgeDocument {
  characterId: string;
  content: string;
  createdAt: string;
  id: string;
  source: string;
  title: string;
  updatedAt: string;
}

export interface RetrievedKnowledge {
  content: string;
  documentId: string;
  method: 'hybrid' | 'keyword';
  score: number;
  title: string;
}
