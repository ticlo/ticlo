import {expect, describe, it} from 'vitest';
import '../CreateStyle.js';
import {Flow, Root} from '@ticlo/core';

describe('CreateStyle', function () {
  it('basic style', function () {
    const flow = new Flow();
    const block = flow.createBlock('style');
    block.setValue('#is', 'html:create-style');
    block.setValue('#optional', ['color', 'fontSize']);
    block.setValue('color', 'red');
    block.setValue('fontSize', '12px');

    Root.run();

    const output = block.getValue('#output') as Record<string, any>;
    expect(output).toBeDefined();
    expect(output.color).toBe('red');
    expect(output.fontSize).toBe('12px');
  });
});
