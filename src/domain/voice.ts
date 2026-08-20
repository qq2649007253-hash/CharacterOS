export const VOICE_PROFILE_IDS = ['bright', 'mature', 'mysterious', 'playful', 'steady', 'cool', 'neutral'] as const;

export type VoiceProfileId = typeof VOICE_PROFILE_IDS[number];

interface VoiceProfile {
  description: string;
  label: string;
  pitch: number;
  rate: number;
  voiceKeywords: readonly string[];
}

export const VOICE_PROFILES: Record<VoiceProfileId, VoiceProfile> = {
  bright: {
    description: '轻快活泼，适合开朗、元气型角色',
    label: '元气明快',
    pitch: 1.2,
    rate: 1.1,
    voiceKeywords: ['xiaoyi', 'huihui', 'female', '女'],
  },
  mature: {
    description: '温暖从容，适合成熟可靠型角色',
    label: '成熟温暖',
    pitch: 0.88,
    rate: 0.91,
    voiceKeywords: ['xiaoxiao', 'huihui', 'female', '女'],
  },
  mysterious: {
    description: '低缓优雅，适合神秘克制型角色',
    label: '优雅神秘',
    pitch: 0.78,
    rate: 0.85,
    voiceKeywords: ['xiaoxiao', 'huihui', 'female', '女'],
  },
  playful: {
    description: '节奏轻快，适合机灵俏皮型角色',
    label: '俏皮灵动',
    pitch: 1.1,
    rate: 1.14,
    voiceKeywords: ['xiaoyi', 'huihui', 'female', '女'],
  },
  steady: {
    description: '沉着清晰，适合冷静负责型角色',
    label: '沉稳清晰',
    pitch: 0.96,
    rate: 0.94,
    voiceKeywords: ['xiaoxiao', 'huihui', 'female', '女'],
  },
  cool: {
    description: '干脆利落，适合直接果断型角色',
    label: '冷峻利落',
    pitch: 0.92,
    rate: 1.04,
    voiceKeywords: ['xiaoyi', 'huihui', 'female', '女'],
  },
  neutral: {
    description: '自然平衡，适合通用角色',
    label: '自然中性',
    pitch: 1,
    rate: 1,
    voiceKeywords: ['xiaoxiao', 'xiaoyi', 'huihui', 'female', '女'],
  },
};
