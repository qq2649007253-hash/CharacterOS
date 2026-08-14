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
  { content: character.systemPrompt, role: 'system' as const },
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
