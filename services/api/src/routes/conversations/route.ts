

import { createConversationSchema } from '@characteros/contracts/conversation';
import { characterRepository } from '@/server/repositories/characterRepository';
import { conversationRepository } from '@/server/repositories/conversationRepository';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = (request: Request) => {
  const params = new URL(request.url).searchParams;
  const characterId = params.get('characterId');
  if (!characterId) return Response.json({ error: '缺少角色 ID' }, { status: 400 });
  const rawLimit = params.get('limit') ?? '20';
  if (!/^\d+$/.test(rawLimit) || Number(rawLimit) < 1 || Number(rawLimit) > 50)
    return Response.json({ error: '每页数量需为 1–50' }, { status: 400 });
  let cursor: { updatedAt: string; id: string } | undefined;
  if (params.has('cursor')) {
    try {
      const raw = params.get('cursor')!;
      if (!raw || raw.length > 512 || !/^[A-Za-z0-9_-]+$/.test(raw)) throw new Error();
      const value = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
      if (typeof value.updatedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value.updatedAt)
        || !Number.isFinite(Date.parse(value.updatedAt)) || typeof value.id !== 'string' || value.id.length > 64 || !value.id) throw new Error();
      cursor = value;
    } catch { return Response.json({ error: '分页游标无效，请刷新列表' }, { status: 400 }); }
  }
  return Response.json(conversationRepository.list(characterId, Number(rawLimit), cursor));
};

export const POST = async (request: Request) => {
  const parsed = createConversationSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: '创建请求不合法' }, { status: 400 });
  const character = characterRepository.findById(parsed.data.characterId);
  if (!character) return Response.json({ error: '角色不存在' }, { status: 404 });
  const conversation = conversationRepository.create(character.id, character.greeting);
  return Response.json({ conversation }, { status: 201 });
};
