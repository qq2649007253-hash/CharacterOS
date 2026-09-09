

import { knowledgeDocumentInputSchema } from '@characteros/contracts/knowledge';
import { characterRepository } from '@/server/repositories/characterRepository';
import { knowledgeRepository } from '@/server/repositories/knowledgeRepository';
import { embeddingIndexService } from '@/server/services/embeddingIndexService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = async (_request: Request, context: { params: Promise<{ id: string }> }) => {
  const id = (await context.params).id;
  const character = characterRepository.findById(id);
  if (!character) return Response.json({ error: '角色不存在' }, { status: 404 });
  knowledgeRepository.ensureLoreDocument(id, character.lore);
  return Response.json({ documents: knowledgeRepository.list(id), index: embeddingIndexService.status(id) });
};

export const POST = async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const id = (await context.params).id;
  if (!characterRepository.findById(id)) return Response.json({ error: '角色不存在' }, { status: 404 });
  const parsed = knowledgeDocumentInputSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: '知识资料不合法' }, { status: 400 });
  const document = knowledgeRepository.create(id, parsed.data.title, parsed.data.content);
  return Response.json({ document }, { status: 201 });
};
