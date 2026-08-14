import { NextResponse } from 'next/server';

import { ollamaService } from '@/server/services/ollamaService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = async () => {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const models = await ollamaService.listModels(controller.signal);
    return NextResponse.json({ latencyMs: Date.now() - startedAt, models, online: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Ollama unavailable',
        latencyMs: Date.now() - startedAt,
        models: [],
        online: false,
      },
      { status: 503 },
    );
  } finally {
    clearTimeout(timeout);
  }
};
