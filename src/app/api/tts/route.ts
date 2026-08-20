import { NextResponse } from 'next/server';
import { z } from 'zod';

import { VOICE_PROFILES } from '@/domain/voice';
import { characterRepository } from '@/server/repositories/characterRepository';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const requestSchema = z.object({
  characterId: z.string().uuid(),
  text: z.string().trim().min(1).max(3000),
});

const serviceUrl = process.env.KOKORO_TTS_URL || 'http://127.0.0.1:9890';

export const POST = async (request: Request) => {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: '语音请求不合法' }, { status: 400 });
  const character = characterRepository.findById(parsed.data.characterId);
  if (!character) return NextResponse.json({ error: '角色不存在' }, { status: 404 });

  const profile = VOICE_PROFILES[character.voiceProfile];
  try {
    const response = await fetch(`${serviceUrl}/tts`, {
      body: JSON.stringify({
        speed: profile.rate,
        text: parsed.data.text,
        voice: profile.kokoroVoice,
      }),
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      signal: AbortSignal.timeout(90_000),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(payload.error || `Kokoro TTS HTTP ${response.status}`);
    }
    return new Response(await response.arrayBuffer(), {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'audio/wav',
        'X-Character-Voice': profile.kokoroVoice,
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : '未知错误';
    return NextResponse.json(
      { error: `本地语音服务不可用：${detail}。请先运行 pnpm tts` },
      { status: 502 },
    );
  }
};
