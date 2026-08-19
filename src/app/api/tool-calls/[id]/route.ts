import { NextResponse } from 'next/server';

import { toolApprovalSchema, type ToolName } from '@/domain/tool';
import { characterRepository } from '@/server/repositories/characterRepository';
import { conversationRepository } from '@/server/repositories/conversationRepository';
import { toolCallRepository } from '@/server/repositories/toolCallRepository';
import { toolService } from '@/server/services/toolService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const PATCH = async (request: Request, context: RouteContext<'/api/tool-calls/[id]'>) => {
  const id = (await context.params).id;
  const toolCall = toolCallRepository.findById(id);
  if (!toolCall) return NextResponse.json({ error: '工具调用不存在' }, { status: 404 });
  if (toolCall.status !== 'pending') return NextResponse.json({ error: '该工具调用已经处理' }, { status: 409 });
  const parsed = toolApprovalSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: '审批请求不合法' }, { status: 400 });

  if (parsed.data.action === 'reject') {
    const updated = toolCallRepository.update(id, { status: 'rejected' });
    conversationRepository.addMessage(toolCall.conversationId, 'assistant', '好的，我不会执行这项操作。');
    return NextResponse.json({ toolCall: updated });
  }

  const character = characterRepository.findById(toolCall.characterId);
  if (!character) return NextResponse.json({ error: '角色不存在' }, { status: 404 });
  toolCallRepository.update(id, { status: 'running' });
  try {
    const arguments_ = toolService.parseArguments(
      toolCall.toolName as ToolName,
      JSON.parse(toolCall.argumentsJson) as Record<string, unknown>,
    );
    const result = await toolService.execute(toolCall.toolName as ToolName, arguments_, character.id);
    const updated = toolCallRepository.update(id, { resultJson: JSON.stringify(result), status: 'completed' });
    conversationRepository.addMessage(toolCall.conversationId, 'assistant', '操作已经获得批准并执行完成。');
    return NextResponse.json({ result, toolCall: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : '工具执行失败';
    const updated = toolCallRepository.update(id, { error: message, status: 'failed' });
    conversationRepository.addMessage(toolCall.conversationId, 'assistant', `工具执行失败：${message}`);
    return NextResponse.json({ error: message, toolCall: updated }, { status: 500 });
  }
};
