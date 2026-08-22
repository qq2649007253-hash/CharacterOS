import { NextResponse } from 'next/server';
import { z } from 'zod';

import { selectH3PerformanceLine } from '@/domain/h3';
import { characterRepository } from '@/server/repositories/characterRepository';
import { h3Service } from '@/server/services/h3Service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const requestSchema = z.object({
  characterId: z.string().uuid(),
  text: z.string().trim().min(1).max(5000),
});

const promptIdSchema = z.string().uuid();

const mediaUrl = (media: { filename: string; subfolder: string }) => `/api/h3/media?${new URLSearchParams({
  filename: media.filename,
  subfolder: media.subfolder,
})}`;

export const GET = async (request: Request) => {
  const promptId = new URL(request.url).searchParams.get('promptId');
  try {
    if (!promptId) return NextResponse.json(await h3Service.health());
    const parsed = promptIdSchema.safeParse(promptId);
    if (!parsed.success) return NextResponse.json({ error: 'H3 任务 ID 不合法' }, { status: 400 });
    const result = await h3Service.status(parsed.data);
    if (result.status !== 'completed') return NextResponse.json(result);
    return NextResponse.json({
      audioUrl: mediaUrl(result.audio),
      status: result.status,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'H3 服务不可用' }, { status: 502 });
  }
};

export const POST = async (request: Request) => {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'H3 演绎请求不合法' }, { status: 400 });
  const character = characterRepository.findById(parsed.data.characterId);
  if (!character) return NextResponse.json({ error: '角色不存在' }, { status: 404 });
  const line = selectH3PerformanceLine(parsed.data.text);
  if (!line) return NextResponse.json({ error: '这条回复没有适合演绎的对白' }, { status: 400 });

  try {
    const job = await h3Service.submit(character, line);
    return NextResponse.json({ line, promptId: job.promptId, status: 'queued' }, { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'H3 任务提交失败' }, { status: 502 });
  }
};
