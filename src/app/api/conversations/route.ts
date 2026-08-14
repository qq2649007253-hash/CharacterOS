import { NextResponse } from 'next/server';

import { createConversationSchema } from '@/domain/conversation';
import { characterRepository } from '@/server/repositories/characterRepository';
import { conversationRepository } from '@/server/repositories/conversationRepository';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = (request: Request) => {
  const characterId = new URL(request.url).searchParams.get('characterId');
  if (!characterId) return NextResponse.json({ error: '缺少角色 ID' }, { status: 400 });
  return NextResponse.json({ conversations: conversationRepository.list(characterId) });
};

export const POST = async (request: Request) => {
  const parsed = createConversationSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: '创建请求不合法' }, { status: 400 });
  const character = characterRepository.findById(parsed.data.characterId);
  if (!character) return NextResponse.json({ error: '角色不存在' }, { status: 404 });
  const conversation = conversationRepository.create(character.id, character.greeting);
  return NextResponse.json({ conversation }, { status: 201 });
};
