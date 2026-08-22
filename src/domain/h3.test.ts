import { describe, expect, it } from 'vitest';

import { buildH3PerformancePrompt, h3FrameLengthForLine, selectH3PerformanceLine, splitH3PerformanceLines } from './h3';

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

describe('splitH3PerformanceLines', () => {
  it('keeps the complete reply and splits it on sentence boundaries', () => {
    const lines = splitH3PerformanceLines('别担心，这件事交给我就好。我们现在就出发！');
    expect(lines).toEqual(['别担心，这件事交给我就好。', '我们现在就出发！']);
    expect(lines.join('')).toBe('别担心，这件事交给我就好。我们现在就出发！');
  });

  it('splits a long sentence at a natural pause without dropping words', () => {
    const reply = '这是一段很长的回复，我们需要把它完整地分成几个能够自然朗读的部分，同时不能丢掉后面的聊天内容。';
    const lines = splitH3PerformanceLines(reply);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join('').replace('，同时', '同时')).toContain('不能丢掉后面的聊天内容。');
  });
});

describe('h3FrameLengthForLine', () => {
  it('allocates more time to longer dialogue and stays within H3 limits', () => {
    const short = h3FrameLengthForLine('有话直说。');
    const long = h3FrameLengthForLine('这段对白明显更长，需要给角色留下足够的时间自然地把整句话说完。');
    expect(short).toBeGreaterThanOrEqual(124);
    expect(long).toBeGreaterThan(short);
    expect(long).toBeLessThanOrEqual(362);
    expect(short % 17).toBe(5);
    expect(long % 17).toBe(5);
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
