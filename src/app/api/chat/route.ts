import { NextResponse } from 'next/server';

import { chatRequestSchema } from '@/domain/chat';
import { agentRunRepository } from '@/server/repositories/agentRunRepository';
import { characterRepository } from '@/server/repositories/characterRepository';
import { conversationRepository } from '@/server/repositories/conversationRepository';
import { knowledgeRepository } from '@/server/repositories/knowledgeRepository';
import { memoryService } from '@/server/services/memoryService';
import { ollamaService } from '@/server/services/ollamaService';
import { retrievalService } from '@/server/services/retrievalService';
import { toolCallRepository } from '@/server/repositories/toolCallRepository';
import { toolPlannerService } from '@/server/services/toolPlannerService';
import { toolService } from '@/server/services/toolService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = async (request: Request) => {
  const parsed = chatRequestSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: '聊天请求不合法', issues: parsed.error.issues }, { status: 400 });

  const { characterId, content, conversationId } = parsed.data;
  const character = characterRepository.findById(characterId);
  if (!character) return NextResponse.json({ error: '角色不存在' }, { status: 404 });
  const conversation = conversationRepository.findForCharacter(conversationId, characterId);
  if (!conversation) return NextResponse.json({ error: '会话不存在或不属于该角色' }, { status: 404 });

  knowledgeRepository.ensureLoreDocument(character.id, character.lore);
  const existingMessages = conversationRepository.listMessages(conversation.id, 39);
  if (existingMessages.filter((message) => message.role === 'user').length === 0) {
    conversationRepository.renameFromFirstMessage(conversation.id, content);
  }
  conversationRepository.addMessage(conversation.id, 'user', content);
  const startedAt = Date.now();
  const agentRun = agentRunRepository.create(conversation.id, character.id, content, character.model);
  const history = [...existingMessages, { content, role: 'user' as const }];
  const knowledge = await retrievalService.knowledge(character.id, content, 5, request.signal);
  const relevantMemories = retrievalService.memories(character.id, content);
  agentRunRepository.update(agentRun.id, {
    knowledgeHits: knowledge.length,
    memoryHits: relevantMemories.length,
    retrievalMethod: knowledge[0]?.method || 'none',
  });
  const citationsJson = JSON.stringify(knowledge.map(({ documentId, score, title }) => ({ documentId, score, title })));
  const citationsHeader = Buffer.from(citationsJson, 'utf8').toString('base64url');
  const toolResults: Array<{ name: string; result: unknown }> = [];
  let activeToolCallId = '';

  const decision = await toolPlannerService.decide(character, content, request.signal);
  if (decision.type === 'tool') {
    try {
      const arguments_ = toolService.parseArguments(decision.tool, decision.arguments);
      const risk = toolService.risk(decision.tool);
      const toolCall = toolCallRepository.create(
        conversation.id,
        character.id,
        decision.tool,
        JSON.stringify(arguments_),
        risk,
      );
      activeToolCallId = toolCall.id;
      if (risk === 'high') {
        const message = `我准备调用工具「${decision.tool}」，该操作会修改本地数据，需要你批准后才能执行。`;
        conversationRepository.addMessage(conversation.id, 'assistant', message);
        agentRunRepository.finish(agentRun.id, 'awaiting_approval', startedAt, {
          knowledgeHits: knowledge.length,
          memoryHits: relevantMemories.length,
          output: message,
          retrievalMethod: knowledge[0]?.method || 'none',
          toolCallId: toolCall.id,
        });
        return NextResponse.json(
          { message, toolCall, type: 'approval_required' },
          {
            headers: {
              'X-Knowledge-Hits': String(knowledge.length),
              'X-Knowledge-Sources': citationsHeader,
              'X-Memory-Hits': String(relevantMemories.length),
              'X-Agent-Run-Id': agentRun.id,
            },
            status: 202,
          },
        );
      }
      try {
        const result = await toolService.execute(decision.tool, arguments_, character.id);
        toolCallRepository.update(toolCall.id, { resultJson: JSON.stringify(result), status: 'completed' });
        toolResults.push({ name: decision.tool, result });
      } catch (error) {
        const message = error instanceof Error ? error.message : '工具执行失败';
        toolCallRepository.update(toolCall.id, { error: message, status: 'failed' });
        toolResults.push({ name: decision.tool, result: { error: message } });
      }
    } catch {
      toolResults.push({ name: decision.tool, result: { error: '工具参数不合法，本轮没有执行操作' } });
    }
  }

  try {
    const ollamaStream = await ollamaService.streamChat(
      character,
      { history, knowledge, memories: relevantMemories, toolResults },
      request.signal,
    );
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let pending = '';
    let assistantContent = '';
    const emit = (value: string, controller: TransformStreamDefaultController<Uint8Array>) => {
      assistantContent += value;
      controller.enqueue(encoder.encode(value));
    };
    const textStream = ollamaStream.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        async flush(controller) {
          if (pending.trim()) {
            try {
              const chunk = JSON.parse(pending) as { message?: { content?: string } };
              if (chunk.message?.content) emit(chunk.message.content, controller);
            } catch {}
          }
          if (assistantContent.trim()) {
            conversationRepository.addMessage(conversation.id, 'assistant', assistantContent, citationsJson);
            await memoryService.extract(character, conversation.id, content, assistantContent);
            agentRunRepository.finish(agentRun.id, 'completed', startedAt, {
              knowledgeHits: knowledge.length,
              memoryHits: relevantMemories.length,
              output: assistantContent,
              retrievalMethod: knowledge[0]?.method || 'none',
              toolCallId: activeToolCallId,
            });
          }
        },
        transform(chunk, controller) {
          pending += decoder.decode(chunk, { stream: true });
          const lines = pending.split('\n');
          pending = lines.pop() || '';
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const item = JSON.parse(line) as { message?: { content?: string } };
              if (item.message?.content) emit(item.message.content, controller);
            } catch {}
          }
        },
      }),
    );
    return new Response(textStream, {
      headers: {
        'Cache-Control': 'no-cache',
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Knowledge-Hits': String(knowledge.length),
        'X-Knowledge-Sources': citationsHeader,
        'X-Memory-Hits': String(relevantMemories.length),
        'X-Agent-Run-Id': agentRun.id,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '模型调用失败';
    agentRunRepository.finish(agentRun.id, 'failed', startedAt, {
      error: message,
      knowledgeHits: knowledge.length,
      memoryHits: relevantMemories.length,
      retrievalMethod: knowledge[0]?.method || 'none',
      toolCallId: activeToolCallId,
    });
    return NextResponse.json(
      { error: message },
      { status: 502 },
    );
  }
};
