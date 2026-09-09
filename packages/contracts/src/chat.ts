import { z } from 'zod';

export const chatRequestSchema = z.object({
  characterId: z.string().min(1),
  content: z.string().trim().min(1).max(20_000),
  conversationId: z.string().min(1),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
