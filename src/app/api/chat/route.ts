import { NextResponse } from 'next/server';

import { chatRequestSchema } from '@/domain/chat';
import { characterRepository } from '@/server/repositories/characterRepository';
import { ollamaService } from '@/server/services/ollamaService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = async (request: Request) => {
  const parsed = chatRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: '聊天请求不合法', issues: parsed.error.issues }, { status: 400 });
  }
  const character = characterRepository.findById(parsed.data.characterId);
  if (!character) return NextResponse.json({ error: '角色不存在' }, { status: 404 });

  try {
    const ollamaStream = await ollamaService.streamChat(character, parsed.data, request.signal);
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let pending = '';
    const textStream = ollamaStream.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        flush(controller) {
          if (!pending.trim()) return;
          try {
            const chunk = JSON.parse(pending) as { message?: { content?: string } };
            if (chunk.message?.content) controller.enqueue(encoder.encode(chunk.message.content));
          } catch {}
        },
        transform(chunk, controller) {
          pending += decoder.decode(chunk, { stream: true });
          const lines = pending.split('\n');
          pending = lines.pop() || '';
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const item = JSON.parse(line) as { message?: { content?: string } };
              if (item.message?.content) controller.enqueue(encoder.encode(item.message.content));
            } catch {}
          }
        },
      }),
    );
    return new Response(textStream, {
      headers: { 'Cache-Control': 'no-cache', 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '模型调用失败' },
      { status: 502 },
    );
  }
};
