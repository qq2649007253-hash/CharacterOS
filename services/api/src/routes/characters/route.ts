

import { ensureCompanions } from '@/server/services/companionService';
import { characterInputSchema } from '@characteros/contracts/character';
import { characterRepository } from '@/server/repositories/characterRepository';

export const runtime = 'nodejs';

export const GET = async () => { ensureCompanions(); return Response.json({ items: characterRepository.findAll() }); };

export const POST = async (request: Request) => {
  const parsed = characterInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: '角色配置不合法', issues: parsed.error.issues }, { status: 400 });
  }
  return Response.json(characterRepository.create(parsed.data), { status: 201 });
};
