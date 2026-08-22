import type { VoiceProfileId } from './voice';

const MAX_PERFORMANCE_CHARACTERS = 16;

const removeStageDirections = (value: string) => value
  .replace(/```[\s\S]*?```/g, ' ')
  .replace(/`[^`]*`/g, ' ')
  .replace(/\*\*([^*]+)\*\*/g, '$1')
  .replace(/\*[^*]+\*/g, ' ')
  .replace(/[（(][^（）()]{0,80}[）)]/g, ' ')
  .replace(/^\s*(?:[-–—•]|\d+[.、])\s*/gm, '')
  .replace(/\s+/g, ' ')
  .trim();

const clipByCodePoint = (value: string, maximum: number) => Array.from(value).slice(0, maximum).join('');

export const selectH3PerformanceLine = (reply: string) => {
  const cleaned = removeStageDirections(reply);
  if (!cleaned) return '';

  const sentence = cleaned.match(/^.*?[。！？!?~～](?=\s|$|[^”’」』])/u)?.[0]
    || cleaned.split(/[\n。！？!?~～]/u)[0]
    || cleaned;
  const candidate = Array.from(sentence).length > MAX_PERFORMANCE_CHARACTERS
    ? sentence.split(/[，,；;：:]/u)[0] || sentence
    : sentence;
  const clipped = clipByCodePoint(candidate.trim(), MAX_PERFORMANCE_CHARACTERS).replace(/[，,；;：:\s]+$/u, '');
  if (!clipped) return '';
  return /[。！？!?~～]$/u.test(clipped) ? clipped : `${clipped}。`;
};

const VOICE_DIRECTIONS: Record<VoiceProfileId, string> = {
  bright: '年轻明亮、活泼真诚，语速轻快，情绪自然上扬',
  mature: '成熟温暖、从容可靠，语速稍缓，表达有安定感',
  mysterious: '低缓优雅、克制神秘，语气从容并留有少量停顿',
  playful: '年轻俏皮、机灵灵动，节奏轻快但吐字清楚',
  steady: '沉着清晰、理性可靠，语气坚定而不过分严肃',
  cool: '年轻冷峻、直接果断，带一点克制的不耐烦但不粗鲁',
  neutral: '年轻自然、情绪真实，语速适中且吐字清楚',
};

export const buildH3PerformancePrompt = ({
  characterDescription,
  characterName,
  line,
  voiceProfile,
}: {
  characterDescription: string;
  characterName: string;
  line: string;
  voiceProfile: VoiceProfileId;
}) => [
  `画面中的女性角色是${characterName}，${characterDescription || '保持参考图中的外貌、服饰与气质'}。`,
  '固定近景镜头，角色自然呼吸、轻微眨眼和小幅度头部动作，嘴型与中文对白同步，保持参考图主体和画风稳定。',
  `声音为${VOICE_DIRECTIONS[voiceProfile]}，像真实对话，不要播音腔，不要夸张喊叫。`,
  `她只说一次这句中文：“${line}”`,
  '不要说其他内容，不要旁白，不要字幕，不要背景音乐，不要环境音和音效。',
].join('');
