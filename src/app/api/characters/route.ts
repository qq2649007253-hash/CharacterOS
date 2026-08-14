import { NextResponse } from 'next/server';

import { characterInputSchema } from '@/domain/character';
import { characterRepository } from '@/server/repositories/characterRepository';

export const runtime = 'nodejs';

export const GET = async () => NextResponse.json({ items: characterRepository.findAll() });

export const POST = async (request: Request) => {
  const parsed = characterInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: '角色配置不合法', issues: parsed.error.issues }, { status: 400 });
  }
  return NextResponse.json(characterRepository.create(parsed.data), { status: 201 });
};
