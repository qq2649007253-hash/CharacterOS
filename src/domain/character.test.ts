import { describe, expect, it } from 'vitest';

import { characterInputSchema, characterPatchSchema } from './character';

const validCharacter = {
  avatarUrl: '',
  coverUrl: '',
  description: '测试角色',
  greeting: '你好',
  lore: '角色背景资料',
  model: 'qwen2.5:7b',
  name: '爱莉希雅',
  systemPrompt: '保持温柔而真诚的表达。',
  voiceProfile: 'bright',
};

describe('character input', () => {
  it('accepts a complete character definition', () => {
    expect(characterInputSchema.parse(validCharacter)).toEqual(validCharacter);
  });

  it('rejects an empty name', () => {
    expect(characterInputSchema.safeParse({ ...validCharacter, name: '' }).success).toBe(false);
  });

  it('requires at least one field in a patch', () => {
    expect(characterPatchSchema.safeParse({}).success).toBe(false);
    expect(characterPatchSchema.safeParse({ description: '更新' }).success).toBe(true);
  });

  it('rejects an unknown voice profile', () => {
    expect(characterInputSchema.safeParse({ ...validCharacter, voiceProfile: 'original-clone' }).success).toBe(false);
  });
});
