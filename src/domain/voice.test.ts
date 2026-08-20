import { describe, expect, it } from 'vitest';

import { VOICE_PROFILE_IDS, VOICE_PROFILES } from './voice';

describe('voice profiles', () => {
  it('defines a safe, distinct synthesis profile for every selectable id', () => {
    expect(Object.keys(VOICE_PROFILES)).toEqual([...VOICE_PROFILE_IDS]);
    const signatures = new Set<string>();
    for (const profile of Object.values(VOICE_PROFILES)) {
      expect(profile.pitch).toBeGreaterThanOrEqual(0.5);
      expect(profile.pitch).toBeLessThanOrEqual(1.5);
      expect(profile.rate).toBeGreaterThanOrEqual(0.5);
      expect(profile.rate).toBeLessThanOrEqual(1.5);
      signatures.add(`${profile.pitch}:${profile.rate}`);
    }
    expect(signatures.size).toBe(VOICE_PROFILE_IDS.length);
  });
});
