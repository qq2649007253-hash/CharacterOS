import { z } from 'zod';

export const createConversationSchema = z.object({
  characterId: z.string().min(1),
});

export interface Conversation {
  characterId: string;
  createdAt: string;
  id: string;
  title: string;
  updatedAt: string;
}

export interface PersistedMessage {
  citationsJson: string;
  content: string;
  conversationId: string;
  createdAt: string;
  id: string;
  role: 'assistant' | 'user';
}

export interface MessageCitation {
  documentId: string;
  score: number;
  title: string;
}

export interface ConversationPage { conversations: Conversation[]; nextCursor: string | null; }
