import { NextResponse } from 'next/server';

import { evaluationRequestSchema } from '@/domain/observability';
import { characterRepository } from '@/server/repositories/characterRepository';
import { evaluationRepository } from '@/server/repositories/evaluationRepository';
import { evaluationService } from '@/server/services/evaluationService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = () => NextResponse.json({ evaluations: evaluationRepository.list() });

export const POST = async (request: Request) => {
  const parsed = evaluationRequestSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: '评测请求不合法' }, { status: 400 });
  const character = characterRepository.findById(parsed.data.characterId);
  if (!character) return NextResponse.json({ error: '角色不存在' }, { status: 404 });
  try {
    return NextResponse.json({ evaluations: await evaluationService.run(character, request.signal) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '角色评测失败' },
      { status: 502 },
    );
  }
};
