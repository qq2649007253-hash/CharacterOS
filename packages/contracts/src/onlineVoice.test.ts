import { describe, expect, it } from 'vitest';
import { resolveOnlineVoice, VOICE_ID_PATTERN } from './voice';
describe('online voice migration',()=>{
 it('maps legacy voices to available online voices',()=>{
  expect(resolveOnlineVoice('mature','zf_099')).toBe('zh-CN-XiaoxiaoNeural');
  expect(resolveOnlineVoice('steady','zf_007')).toBe('zh-CN-XiaoyiNeural');
 });
 it('preserves a supported explicit selection and rejects arbitrary voices',()=>{
  expect(resolveOnlineVoice('mature','zh-CN-XiaoyiNeural')).toBe('zh-CN-XiaoyiNeural');
  expect(VOICE_ID_PATTERN.test('zh-CN-XiaoyiNeural')).toBe(true);
  expect(VOICE_ID_PATTERN.test('arbitrary-provider-voice')).toBe(false);
 });
});
