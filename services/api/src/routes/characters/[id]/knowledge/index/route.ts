

import { characterRepository } from '@/server/repositories/characterRepository';
import { embeddingIndexService } from '@/server/services/embeddingIndexService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const id = (await context.params).id;
  if (!characterRepository.findById(id)) return Response.json({ error: '角色不存在' }, { status: 404 });
  try {
    return Response.json({ index: await embeddingIndexService.rebuild(id, request.signal) });
  } catch (error) {
    const detail = error instanceof Error ? error.message : '未知错误';
    return Response.json(
      { error: `向量索引创建失败，请确认 Ollama 正在运行并已安装 embeddinggemma（${detail}）` },
      { status: 502 },
    );
  }
};

