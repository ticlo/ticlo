import {expect, describe, it} from 'vitest';
import '../CssSheet.js';
import {Flow, Root} from '@ticlo/core';
import {CssSheet, DisabledCssSheet} from '../../style/CssSheet.js';

describe('CssSheet', function () {
  it('create sheet', function () {
    const flow = new Flow();
    const block = flow.createBlock('sheet');
    block.setValue('#is', 'html:css-sheet');
    block.setValue('prefix', 'test-');
    block.setValue('enabled', true);

    Root.run();

    const output = block.getValue('#output') as CssSheet;
    expect(output).toBeDefined();
    expect(output.constructor.name).toBe('CssSheet');
    expect(typeof output.addRule).toBe('function');
  });

  it('disabled sheet', function () {
    const flow = new Flow();
    const block = flow.createBlock('sheet');
    block.setValue('#is', 'html:css-sheet');
    block.setValue('enabled', false);

    Root.run();

    const output = block.getValue('#output');
    expect(output).toBeInstanceOf(DisabledCssSheet);
  });
});
