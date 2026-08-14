import { describe, expect, it } from 'vitest';

import type { Character } from '@/domain/character';

import { buildOllamaMessages } from './ollamaService';

const character: Character = {
  avatarUrl: '',
  coverUrl: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  description: '',
  greeting: '你好',
  id: 'character-1',
  model: 'qwen2.5:7b',
  name: '测试角色',
  systemPrompt: '这是受保护的系统人设',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('buildOllamaMessages', () => {
  it('always places the persisted persona before conversation history', () => {
    const messages = buildOllamaMessages(character, {
      characterId: character.id,
      messages: [{ content: '你好', role: 'user' }],
    });
    expect(messages).toEqual([
      { content: character.systemPrompt, role: 'system' },
      { content: '你好', role: 'user' },
    ]);
  });
});
