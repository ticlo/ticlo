import {describe, expect, it} from 'vitest';
import {AssertFunction} from '../Assert.ts';
import {Root} from '@ticlo/core';

describe('AssertFunction', () => {
  it('distinguishes match-once from always-match', () => {
    const fn = new AssertFunction({_sync: false} as any);

    fn.inputChanged({_name: 'matchMode', _value: 'match-once'} as any, 'match-once');
    expect(fn._alwaysMatch).toBe(false);

    fn.inputChanged({_name: 'matchMode', _value: 'always-match'} as any, 'always-match');
    expect(fn._alwaysMatch).toBe(true);
  });

  it('skips copying actual values in readonly property commands', () => {
    const root = new Root();
    try {
      const block = root.createBlock('assert');
      block._load({'#is': 'test:assert', 'expect0': 1, 'actual0': 2});
      block.executeCommand('copyFromActual', {property: 'expect0'}, true);
      expect(block.getValue('expect0')).toBe(1);
      block.executeCommand('copyFromActual', {property: 'expect0'});
      expect(block.getValue('expect0')).toBe(2);
    } finally {
      root.destroy();
    }
  });
});
