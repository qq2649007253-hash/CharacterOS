import { z } from 'zod';

export const chatRequestSchema = z.object({
  characterId: z.string().min(1),
  messages: z
    .array(
      z.object({
        content: z.string().min(1).max(20_000),
        role: z.enum(['assistant', 'user']),
      }),
    )
    .min(1)
    .max(40),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
