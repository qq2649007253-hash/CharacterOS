import { describe, expect, it } from 'vitest';

import { buildH3PerformancePrompt, selectH3PerformanceLine } from './h3';

describe('selectH3PerformanceLine', () => {
  it('selects one short spoken sentence', () => {
    expect(selectH3PerformanceLine('别磨蹭了，有话就直说吧。后面的内容不用演绎。'))
      .toBe('别磨蹭了，有话就直说吧。');
  });

  it('removes stage directions and clips a long reply at a natural pause', () => {
    expect(selectH3PerformanceLine('（轻轻叹气）这件事确实有点麻烦，不过我们可以先把最重要的问题解决掉。'))
      .toBe('这件事确实有点麻烦。');
  });

  it('returns an empty line for non-spoken formatting', () => {
    expect(selectH3PerformanceLine('（沉默）')).toBe('');
  });
});

describe('buildH3PerformancePrompt', () => {
  it('includes the exact line and emotion direction', () => {
    const prompt = buildH3PerformancePrompt({
      characterDescription: '行动果断的地火成员',
      characterName: '希儿',
      line: '有话就直说吧。',
      voiceProfile: 'cool',
    });
    expect(prompt).toContain('“有话就直说吧。”');
    expect(prompt).toContain('年轻冷峻、直接果断');
    expect(prompt).toContain('不要背景音乐');
  });
});

