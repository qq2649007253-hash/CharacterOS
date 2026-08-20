import { z } from 'zod';

import { VOICE_PROFILE_IDS } from './voice';

const characterFields = {
  avatarUrl: z.string().max(2048),
  coverUrl: z.string().max(2048),
  description: z.string().trim().max(240),
  greeting: z.string().trim().min(1).max(500),
  lore: z.string().trim().max(20_000),
  model: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(64),
  systemPrompt: z.string().trim().min(1).max(20_000),
  voiceProfile: z.enum(VOICE_PROFILE_IDS),
};

export const characterInputSchema = z.object({
  ...characterFields,
  avatarUrl: characterFields.avatarUrl.default(''),
  coverUrl: characterFields.coverUrl.default(''),
  description: characterFields.description.default(''),
  lore: characterFields.lore.default(''),
  voiceProfile: characterFields.voiceProfile.default('neutral'),
});

export const characterPatchSchema = z.object(characterFields).partial().refine(
  (value) => Object.keys(value).length > 0,
  '至少需要修改一个字段',
);

export type CharacterInput = z.infer<typeof characterInputSchema>;

export interface Character extends CharacterInput {
  createdAt: string;
  id: string;
  updatedAt: string;
}
