import { describe, expect, it } from 'vitest';

import { toolService } from './toolService';

describe('toolService', () => {
  it('marks mutating tools as high risk', () => {
    expect(toolService.risk('create_note')).toBe('high');
    expect(toolService.risk('delete_note')).toBe('high');
  });

  it('marks read-only tools as low risk', () => {
    expect(toolService.risk('get_current_time')).toBe('low');
    expect(toolService.risk('list_notes')).toBe('low');
  });

  it('validates note content before execution', () => {
    expect(() => toolService.parseArguments('create_note', { content: '' })).toThrow();
    expect(toolService.parseArguments('create_note', { content: '准备面试演示' })).toEqual({ content: '准备面试演示' });
  });
});
