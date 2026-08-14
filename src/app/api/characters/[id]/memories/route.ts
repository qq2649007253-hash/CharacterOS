import { NextResponse } from 'next/server';

import { characterRepository } from '@/server/repositories/characterRepository';
import { memoryRepository } from '@/server/repositories/memoryRepository';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = async (_request: Request, context: { params: Promise<{ id: string }> }) => {
  const id = (await context.params).id;
  if (!characterRepository.findById(id)) return NextResponse.json({ error: '角色不存在' }, { status: 404 });
  return NextResponse.json({ memories: memoryRepository.list(id) });
};
