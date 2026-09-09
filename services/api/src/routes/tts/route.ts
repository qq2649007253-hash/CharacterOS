
import { z } from 'zod';

import { VOICE_ID_PATTERN, resolveOnlineVoice, VOICE_PROFILES } from '@characteros/contracts/voice';
import { characterRepository } from '@/server/repositories/characterRepository';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const requestSchema = z.object({
  characterId: z.string().uuid().optional(),
  text: z.string().trim().min(1).max(3000),
  voiceId: z.string().regex(VOICE_ID_PATTERN).optional(),
}).refine((value) => value.characterId || value.voiceId, '需要角色或语音 ID');

const serviceUrl = process.env.EDGE_TTS_URL || 'http://127.0.0.1:9891';

export const GET = async () => {
  try {
    const response = await fetch(`${serviceUrl}/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    const payload = await response.json();
    return Response.json(payload, { status: response.status });
  } catch {
    return Response.json({ error: '语音服务未启动', voices: [] }, { status: 503 });
  }
};

export const POST = async (request: Request) => {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: '语音请求不合法' }, { status: 400 });

  let speed = 1;
  let voiceId = parsed.data.voiceId;
  if (parsed.data.characterId) {
    const character = characterRepository.findById(parsed.data.characterId);
    if (!character) return Response.json({ error: '角色不存在' }, { status: 404 });
    const profile = VOICE_PROFILES[character.voiceProfile];
    speed = profile.rate;
    voiceId = resolveOnlineVoice(character.voiceProfile, voiceId || character.voiceId);
  }
  if (voiceId) voiceId = resolveOnlineVoice('neutral', voiceId);
  if (!voiceId) return Response.json({ error: '语音 ID 缺失' }, { status: 400 });

  try {
    const response = await fetch(`${serviceUrl}/tts`, {
      body: JSON.stringify({
        speed,
        text: parsed.data.text,
        voice: voiceId,
      }),
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(90_000)]),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(payload.error || `Online speech HTTP ${response.status}`);
    }
    const audio = await response.arrayBuffer();
    if (!response.headers.get('content-type')?.startsWith('audio/') || audio.byteLength < 44) throw new Error('语音服务返回了无效音频');
    return new Response(audio, {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'audio/mpeg',
        'X-Character-Voice': voiceId,
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : '未知错误';
    return Response.json(
      { error: `在线语音暂时不可用：${detail}。请先运行 pnpm tts` },
      { status: 502 },
    );
  }
};
