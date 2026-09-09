import type { Character } from '@characteros/contracts/character';
import type { PersistedMessage } from '@characteros/contracts/conversation';
import type { RetrievedKnowledge } from '@characteros/contracts/knowledge';

const baseUrl = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');

interface OllamaModel {
  details?: { family?: string; parameter_size?: string; quantization_level?: string };
  modified_at?: string;
  name: string;
  size?: number;
}

interface PromptContext {
  history: Pick<PersistedMessage, 'content' | 'role'>[];
  knowledge: RetrievedKnowledge[];
  memories: Array<{ content: string; kind: string }>;
  toolResults?: Array<{ name: string; result: unknown }>;
}

export const buildOllamaMessages = (character: Character, context: PromptContext) => [
  {
    content: [
      '[角色行为准则]',
      character.systemPrompt,
      context.knowledge.length > 0 && '[本轮检索到的角色知识]',
      ...context.knowledge.map((item, index) => `${index + 1}.（${item.title}）${item.content}`),
      context.memories.length > 0 && '[与当前用户有关的长期记忆]',
      ...context.memories.map((memory, index) => `${index + 1}. [${memory.kind}] ${memory.content}`),
      Boolean(context.toolResults?.length) && '[本轮工具执行结果]',
      ...(context.toolResults || []).map((item) => `${item.name}: ${JSON.stringify(item.result)}`),
      '[一致性要求]',
      '只以当前角色身份表达，不得混入其他角色的身份、经历、阵营或人际关系。回答角色设定问题时，以检索资料为准；资料没有说明的细节必须坦诚不确定，不得自行续写成官方事实。长期记忆只用于保持与用户交流的一致性，不得把推测写成事实。只有看到工具执行结果时，才能声称操作已经完成。用户要求创作同人剧情时，要明确标注为非官方创作。',
    ]
      .filter(Boolean)
      .join('\n\n'),
    role: 'system' as const,
  },
  ...context.history.map(({ content, role }) => ({ content, role })),
];

export const ollamaService = {
  async embed(inputs: string[], model = process.env.OLLAMA_EMBED_MODEL || 'embeddinggemma', signal?: AbortSignal) {
    const response = await fetch(`${baseUrl}/api/embed`, {
      body: JSON.stringify({ input: inputs, model }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      signal,
    });
    if (!response.ok) throw new Error(`Ollama embedding failed with HTTP ${response.status}`);
    const result = (await response.json()) as { embeddings?: number[][]; model?: string };
    if (!result.embeddings || result.embeddings.length !== inputs.length) throw new Error('Ollama embedding response is incomplete');
    return { embeddings: result.embeddings, model: result.model || model };
  },

  async complete(model: string, messages: Array<{ content: string; role: string }>, signal?: AbortSignal) {
    const response = await fetch(`${baseUrl}/api/chat`, {
      body: JSON.stringify({ format: 'json', messages, model, stream: false }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      signal,
    });
    if (!response.ok) throw new Error(`Ollama completion failed with HTTP ${response.status}`);
    const result = (await response.json()) as { message?: { content?: string } };
    return result.message?.content || '';
  },

  async completeText(model: string, messages: Array<{ content: string; role: string }>, signal?: AbortSignal) {
    const response = await fetch(`${baseUrl}/api/chat`, {
      body: JSON.stringify({ messages, model, stream: false }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      signal,
    });
    if (!response.ok) throw new Error(`Ollama completion failed with HTTP ${response.status}`);
    const result = (await response.json()) as { message?: { content?: string } };
    return result.message?.content || '';
  },

  async listModels(signal?: AbortSignal): Promise<OllamaModel[]> {
    const response = await fetch(`${baseUrl}/api/tags`, { cache: 'no-store', signal });
    if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}`);
    const data = (await response.json()) as { models?: OllamaModel[] };
    return data.models || [];
  },

  async streamChat(character: Character, context: PromptContext, signal?: AbortSignal) {
    const response = await fetch(`${baseUrl}/api/chat`, {
      body: JSON.stringify({
        messages: buildOllamaMessages(character, context),
        model: character.model,
        stream: true,
      }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      signal,
    });
    if (!response.ok || !response.body) throw new Error(`Ollama chat failed with HTTP ${response.status}`);
    return response.body;
  },
};
