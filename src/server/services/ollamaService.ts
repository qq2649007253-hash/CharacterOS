import type { ChatRequest } from '@/domain/chat';
import type { Character } from '@/domain/character';

const baseUrl = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');

interface OllamaModel {
  details?: { family?: string; parameter_size?: string; quantization_level?: string };
  modified_at?: string;
  name: string;
  size?: number;
}

export const buildOllamaMessages = (character: Character, request: ChatRequest) => [
  {
    content: [
      '[角色行为准则]',
      character.systemPrompt,
      character.lore && '[角色背景资料]',
      character.lore,
      '[一致性要求]',
      '只以当前角色身份表达，不得混入其他角色的身份、经历、阵营或人际关系。背景资料没有说明的剧情细节，必须回答“不确定”或说明资料不足，不得自行续写成官方事实。用户要求创作同人剧情时，要明确标注为非官方创作。',
    ]
      .filter(Boolean)
      .join('\n\n'),
    role: 'system' as const,
  },
  ...request.messages.map(({ content, role }) => ({ content, role })),
];

export const ollamaService = {
  async listModels(signal?: AbortSignal): Promise<OllamaModel[]> {
    const response = await fetch(`${baseUrl}/api/tags`, { cache: 'no-store', signal });
    if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}`);
    const data = (await response.json()) as { models?: OllamaModel[] };
    return data.models || [];
  },

  async streamChat(character: Character, request: ChatRequest, signal?: AbortSignal) {
    const response = await fetch(`${baseUrl}/api/chat`, {
      body: JSON.stringify({
        messages: buildOllamaMessages(character, request),
        model: character.model,
        stream: true,
      }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      signal,
    });
    if (!response.ok || !response.body) {
      throw new Error(`Ollama chat failed with HTTP ${response.status}`);
    }
    return response.body;
  },
};
