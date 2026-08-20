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
  lore: '角色完整背景现在存入知识库',
  model: 'qwen2.5:7b',
  name: '测试角色',
  systemPrompt: '这是受保护的系统人设',
  updatedAt: '2026-01-01T00:00:00.000Z',
  voiceProfile: 'neutral',
};

describe('buildOllamaMessages', () => {
  it('places persona, retrieved knowledge and memory before persisted history', () => {
    const messages = buildOllamaMessages(character, {
      history: [{ content: '你好', role: 'user' }],
      knowledge: [{ content: '检索到的背景', documentId: 'doc-1', method: 'keyword', score: 4, title: '角色资料' }],
      memories: [{ content: '用户喜欢咖啡', kind: 'preference' }],
      toolResults: [{ name: 'get_current_time', result: { value: '2026年8月20日' } }],
    });
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain(character.systemPrompt);
    expect(messages[0].content).toContain('检索到的背景');
    expect(messages[0].content).toContain('用户喜欢咖啡');
    expect(messages[0].content).toContain('get_current_time');
    expect(messages[0].content).toContain('不得混入其他角色');
    expect(messages[1]).toEqual({ content: '你好', role: 'user' });
  });
});
