import type { Character } from '@characteros/contracts/character';
import { memoryRepository, type MemoryKind } from '@/server/repositories/memoryRepository';
import { ollamaService } from '@/server/services/ollamaService';

const validKinds = new Set<MemoryKind>(['event', 'fact', 'preference', 'relationship']);

export const memoryService = {
  async extract(character: Character, conversationId: string, userContent: string, assistantContent: string) {
    const prompt = [
      '你是长期记忆提取器。只记录用户明确透露、未来对话仍有价值的信息。',
      '不要记录角色设定、常识、临时问题、模型猜测、密码或其他认证信息。',
      '输出 JSON：{"memories":[{"kind":"fact|preference|relationship|event","content":"第三人称简短事实","confidence":70}]}。没有则输出空数组，最多3条。',
      `用户：${userContent}`,
      `${character.name}：${assistantContent}`,
    ].join('\n');
    try {
      const raw = await ollamaService.complete(character.model, [{ content: prompt, role: 'user' }]);
      const parsed = JSON.parse(raw) as { memories?: Array<{ confidence?: number; content?: string; kind?: string }> };
      const existing = memoryRepository.list(character.id).map((memory) => memory.content);
      for (const item of parsed.memories?.slice(0, 3) || []) {
        const content = item.content?.trim();
        if (!content || !validKinds.has(item.kind as MemoryKind) || existing.includes(content)) continue;
        memoryRepository.create(
          character.id,
          conversationId,
          item.kind as MemoryKind,
          content,
          Math.max(1, Math.min(100, Math.round(item.confidence || 70))),
        );
      }
    } catch (error) {
      console.warn('Long-term memory extraction skipped:', error);
    }
  },
};
