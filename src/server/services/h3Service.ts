import { randomUUID } from 'node:crypto';

import type { Character } from '@/domain/character';
import { buildH3PerformancePrompt } from '@/domain/h3';

const serviceUrl = (process.env.H3_COMFYUI_URL || 'http://127.0.0.1:8188').replace(/\/$/, '');

const models = {
  audioVae: process.env.H3_AUDIO_VAE || 'minimax_h3_audio_vae_fp32.safetensors',
  clip: process.env.H3_CLIP_MODEL || 'qwen3vl_4b_int8_convrot.safetensors',
  clipProjection: process.env.H3_CLIP_PROJECTION || 'mmh3-4b-ClipProj-v3.1.safetensors',
  model: process.env.H3_MODEL || 'minimax_h3_fl2va_pruned_w4a8_mixed.safetensors',
  videoVae: process.env.H3_VIDEO_VAE || 'minimax_h3_video_vae_int8_convrot.safetensors',
};

type ComfyMedia = { filename: string; subfolder: string; type: string };

interface ComfyHistoryEntry {
  outputs?: Record<string, { audio?: ComfyMedia[]; images?: ComfyMedia[] }>;
  status?: {
    completed?: boolean;
    messages?: Array<[string, Record<string, unknown>]>;
    status_str?: string;
  };
}

const fetchComfy = async (path: string, init?: RequestInit, timeout = 10_000) => {
  try {
    return await fetch(`${serviceUrl}${path}`, {
      ...init,
      cache: 'no-store',
      signal: AbortSignal.timeout(timeout),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '无法连接服务';
    throw new Error(`H3 服务未启动（${message}）。请先运行 pnpm h3`);
  }
};

const extensionFor = (contentType: string) => {
  if (contentType.includes('jpeg')) return 'jpg';
  if (contentType.includes('webp')) return 'webp';
  return 'png';
};

const uploadReferenceImage = async (imageUrl: string, characterId: string) => {
  let parsedUrl: URL;
  try { parsedUrl = new URL(imageUrl); } catch { throw new Error('角色没有可用于 H3 演绎的有效头像'); }
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('H3 参考图只支持 HTTP 或 HTTPS 地址');

  const imageResponse = await fetch(parsedUrl, { cache: 'force-cache', signal: AbortSignal.timeout(20_000) });
  if (!imageResponse.ok) throw new Error(`下载角色头像失败：HTTP ${imageResponse.status}`);
  const contentType = imageResponse.headers.get('content-type') || 'image/png';
  if (!contentType.startsWith('image/')) throw new Error('角色头像地址没有返回图片');

  const form = new FormData();
  form.append('image', new Blob([await imageResponse.arrayBuffer()], { type: contentType }), `${characterId}.${extensionFor(contentType)}`);
  form.append('overwrite', 'true');
  form.append('subfolder', 'characteros-h3');
  form.append('type', 'input');
  const response = await fetchComfy('/upload/image', { body: form, method: 'POST' }, 30_000);
  if (!response.ok) throw new Error(`上传 H3 参考图失败：HTTP ${response.status}`);
  const payload = await response.json() as { name?: string; subfolder?: string };
  if (!payload.name) throw new Error('H3 服务没有返回参考图文件名');
  return payload.subfolder ? `${payload.subfolder}/${payload.name}` : payload.name;
};

const buildWorkflow = ({ image, line, character }: { image: string; line: string; character: Character }) => ({
  '1': { class_type: 'LoadImage', inputs: { image } },
  '2': { class_type: 'UNETLoader', inputs: { unet_name: models.model, weight_dtype: 'default' } },
  '3': { class_type: 'MiniMaxH3SigmaShift', inputs: { model: ['2', 0], shift_audio: 3, shift_video: 12 } },
  '4': {
    class_type: 'SpectrumApplyMiniMaxH3',
    inputs: {
      anchor_residual_feedback: false,
      audio_blend_weight: 0,
      blend_weight: 0.5,
      bootstrap_first_forecast: true,
      debug: false,
      degree: 1,
      enabled: true,
      flex_window: 0.75,
      history_storage: 'system_ram',
      max_history: 8,
      model: ['3', 0],
      offline_archive_storage: 'system_ram',
      offline_smoothing_replay: true,
      ridge_lambda: 0.1,
      selective_rollback_correction: false,
      tail_actual_steps: 1,
      warmup_steps: 1,
      window_size: 2,
    },
  },
  '5': { class_type: 'ModelAttentionBackend', inputs: { attention: 'comfy kitchen attention', model: ['4', 0] } },
  '6': {
    class_type: 'ClipProjLoader',
    inputs: {
      clip_name: models.clip,
      device: 'cuda:0',
      mode: 'resident',
      projection: models.clipProjection,
      type: 'auto',
    },
  },
  '7': { class_type: 'VAELoader', inputs: { vae_name: models.videoVae } },
  '8': { class_type: 'VAELoader', inputs: { vae_name: models.audioVae } },
  '9': {
    class_type: 'MiniMaxH3ImageToVideo',
    inputs: {
      clip: ['6', 0],
      first_frame: ['1', 0],
      height: 288,
      length: 73,
      prompt: buildH3PerformancePrompt({
        characterDescription: character.description,
        characterName: character.name,
        line,
        voiceProfile: character.voiceProfile,
      }),
      vae: ['7', 0],
      width: 512,
    },
  },
  '10': { class_type: 'RandomNoise', inputs: { noise_seed: Math.floor(Math.random() * 1_000_000_000_000_000) } },
  '11': { class_type: 'BasicScheduler', inputs: { denoise: 1, model: ['5', 0], scheduler: 'simple', steps: 12 } },
  '12': { class_type: 'KSamplerSelect', inputs: { sampler_name: 'res_multistep' } },
  '13': { class_type: 'BasicGuider', inputs: { conditioning: ['9', 0], model: ['5', 0] } },
  '14': {
    class_type: 'SamplerCustomAdvanced',
    inputs: { guider: ['13', 0], latent_image: ['9', 1], noise: ['10', 0], sampler: ['12', 0], sigmas: ['11', 0] },
  },
  '16': { class_type: 'VAEDecodeAudio', inputs: { samples: ['14', 0], vae: ['8', 0] } },
  '19': {
    class_type: 'SaveAudio',
    inputs: { audio: ['16', 0], filename_prefix: `CharacterOS/H3_${character.name}_${Date.now()}_audio` },
  },
});

const findExecutionError = (entry: ComfyHistoryEntry) => {
  const error = entry.status?.messages?.find(([type]) => type === 'execution_error')?.[1];
  return typeof error?.exception_message === 'string' ? error.exception_message : undefined;
};

export const h3Service = {
  async health() {
    const response = await fetchComfy('/system_stats');
    if (!response.ok) throw new Error(`H3 服务异常：HTTP ${response.status}`);
    return { ready: true, serviceUrl };
  },

  async media(filename: string, subfolder: string) {
    return fetchComfy(`/view?${new URLSearchParams({ filename, subfolder, type: 'output' })}`, undefined, 30_000);
  },

  async status(promptId: string) {
    const historyResponse = await fetchComfy(`/history/${encodeURIComponent(promptId)}`);
    if (!historyResponse.ok) throw new Error(`读取 H3 任务失败：HTTP ${historyResponse.status}`);
    const history = await historyResponse.json() as Record<string, ComfyHistoryEntry>;
    const entry = history[promptId];
    if (entry) {
      const executionError = findExecutionError(entry);
      if (executionError || entry.status?.status_str === 'error') {
        return { error: executionError || 'H3 工作流执行失败', status: 'failed' as const };
      }
      const audio = entry.outputs?.['19']?.audio?.[0];
      if (audio) return { audio, status: 'completed' as const };
      if (entry.status?.completed) return { error: 'H3 已结束，但没有生成音频', status: 'failed' as const };
      return { status: 'running' as const };
    }

    const queueResponse = await fetchComfy('/queue');
    if (!queueResponse.ok) throw new Error(`读取 H3 队列失败：HTTP ${queueResponse.status}`);
    const queue = await queueResponse.json() as { queue_pending?: unknown[][]; queue_running?: unknown[][] };
    const running = queue.queue_running?.some((item) => item[1] === promptId);
    const pending = queue.queue_pending?.some((item) => item[1] === promptId);
    if (running) return { status: 'running' as const };
    if (pending) return { status: 'queued' as const };
    return { error: 'H3 任务不存在或已被服务清理', status: 'failed' as const };
  },

  async submit(character: Character, line: string) {
    await this.health();
    const imageUrl = character.avatarUrl || character.coverUrl;
    if (!imageUrl) throw new Error('请先在角色设置中添加头像或立绘');
    const image = await uploadReferenceImage(imageUrl, character.id);
    const clientId = randomUUID();
    const response = await fetchComfy('/prompt', {
      body: JSON.stringify({ client_id: clientId, prompt: buildWorkflow({ character, image, line }) }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    }, 30_000);
    const payload = await response.json().catch(() => ({})) as { error?: { message?: string } | string; prompt_id?: string };
    if (!response.ok || !payload.prompt_id) {
      const detail = typeof payload.error === 'string' ? payload.error : payload.error?.message;
      throw new Error(detail || `提交 H3 任务失败：HTTP ${response.status}`);
    }
    return { promptId: payload.prompt_id };
  },
};
