import {describe, expect, it} from 'vitest';
import {AssertFunction} from '../Assert.js';

describe('AssertFunction', () => {
  it('distinguishes match-once from always-match', () => {
    const fn = new AssertFunction({_sync: false} as any);

    fn.inputChanged({_name: 'matchMode', _value: 'match-once'} as any, 'match-once');
    expect(fn._alwaysMatch).toBe(false);

    fn.inputChanged({_name: 'matchMode', _value: 'always-match'} as any, 'always-match');
    expect(fn._alwaysMatch).toBe(true);
  });
});
