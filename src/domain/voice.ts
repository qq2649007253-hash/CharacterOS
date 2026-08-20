export const VOICE_PROFILE_IDS = ['bright', 'mature', 'mysterious', 'playful', 'steady', 'cool', 'neutral'] as const;

export type VoiceProfileId = typeof VOICE_PROFILE_IDS[number];

interface VoiceProfile {
  description: string;
  kokoroVoice: string;
  label: string;
  rate: number;
}

export const VOICE_PROFILES: Record<VoiceProfileId, VoiceProfile> = {
  bright: {
    description: '轻快活泼，适合开朗、元气型角色',
    kokoroVoice: 'zf_001',
    label: '元气明快',
    rate: 1.08,
  },
  mature: {
    description: '温暖从容，适合成熟可靠型角色',
    kokoroVoice: 'zf_027',
    label: '成熟温暖',
    rate: 0.92,
  },
  mysterious: {
    description: '低缓优雅，适合神秘克制型角色',
    kokoroVoice: 'zf_042',
    label: '优雅神秘',
    rate: 0.86,
  },
  playful: {
    description: '节奏轻快，适合机灵俏皮型角色',
    kokoroVoice: 'zf_007',
    label: '俏皮灵动',
    rate: 1.12,
  },
  steady: {
    description: '沉着清晰，适合冷静负责型角色',
    kokoroVoice: 'zf_059',
    label: '沉稳清晰',
    rate: 0.94,
  },
  cool: {
    description: '干脆利落，适合直接果断型角色',
    kokoroVoice: 'zf_079',
    label: '冷峻利落',
    rate: 1.02,
  },
  neutral: {
    description: '自然平衡，适合通用角色',
    kokoroVoice: 'zf_099',
    label: '自然中性',
    rate: 1,
  },
};
