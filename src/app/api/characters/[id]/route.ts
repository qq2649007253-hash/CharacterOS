import { NextResponse } from 'next/server';

import { characterPatchSchema } from '@/domain/character';
import { characterRepository } from '@/server/repositories/characterRepository';

export const runtime = 'nodejs';

interface Context {
  params: Promise<{ id: string }>;
}

export const GET = async (_request: Request, { params }: Context) => {
  const character = characterRepository.findById((await params).id);
  return character
    ? NextResponse.json(character)
    : NextResponse.json({ error: '角色不存在' }, { status: 404 });
};

export const PATCH = async (request: Request, { params }: Context) => {
  const parsed = characterPatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: '更新内容不合法', issues: parsed.error.issues }, { status: 400 });
  }
  const character = characterRepository.update((await params).id, parsed.data);
  return character
    ? NextResponse.json(character)
    : NextResponse.json({ error: '角色不存在' }, { status: 404 });
};

export const DELETE = async (_request: Request, { params }: Context) =>
  characterRepository.delete((await params).id)
    ? new NextResponse(null, { status: 204 })
    : NextResponse.json({ error: '角色不存在' }, { status: 404 });
