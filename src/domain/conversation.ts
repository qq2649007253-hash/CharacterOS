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
  content: string;
  conversationId: string;
  createdAt: string;
  id: string;
  role: 'assistant' | 'user';
}
