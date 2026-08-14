import { describe, expect, it } from 'vitest';

import { scoreText, terms } from './retrievalService';

describe('retrievalService', () => {
  it('creates Chinese n-grams for natural-language retrieval', () => {
    expect(terms('三月七为什么喜欢摄影')).toContain('摄影');
    expect(terms('三月七为什么喜欢摄影')).toContain('三月七');
  });

  it('ranks related knowledge above unrelated text', () => {
    const query = '三月七为什么喜欢摄影';
    expect(scoreText(query, '三月七喜欢用摄影记录旅途')).toBeGreaterThan(
      scoreText(query, '银狼来自朋克洛德'),
    );
  });
});
