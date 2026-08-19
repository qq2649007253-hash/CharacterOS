import { NextResponse } from 'next/server';

import { conversationRepository } from '@/server/repositories/conversationRepository';
import { toolCallRepository } from '@/server/repositories/toolCallRepository';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = async (_request: Request, context: { params: Promise<{ id: string }> }) => {
  const conversation = conversationRepository.findById((await context.params).id);
  if (!conversation) return NextResponse.json({ error: '会话不存在' }, { status: 404 });
  return NextResponse.json({
    conversation,
    messages: conversationRepository.listMessages(conversation.id, 200),
    toolCalls: toolCallRepository.list(conversation.id),
  });
};
