import {expect} from 'vitest';
import '../Slice.js';
import {Flow, Root} from '../../../block/Flow.js';

describe('Slice', function () {
  it('slices string input', function () {
    const flow = new Flow();

    const aBlock = flow.createBlock('a');
    aBlock.setValue('#is', 'slice');
    expect(aBlock.getValue('#output')).not.toBeDefined();

    aBlock.setValue('input', 'abcdef');
    Root.run();
    expect(aBlock.getValue('#output')).toBe('abcdef');

    aBlock.setValue('start', 2);
    Root.run();
    expect(aBlock.getValue('#output')).toBe('cdef');

    aBlock.setValue('end', 4);
    Root.run();
    expect(aBlock.getValue('#output')).toBe('cd');

    aBlock.setValue('start', -3);
    aBlock.setValue('end', -1);
    Root.run();
    expect(aBlock.getValue('#output')).toBe('de');

    aBlock.setValue('input', 123);
    Root.run();
    expect(aBlock.getValue('#output')).toBe(undefined);
  });

  it('substrings string input', function () {
    const flow = new Flow();

    const aBlock = flow.createBlock('a');
    aBlock.setValue('#is', 'substring');
    aBlock.setValue('input', 'abcdef');
    aBlock.setValue('start', 4);
    aBlock.setValue('end', 2);
    Root.run();
    expect(aBlock.getValue('#output')).toBe('cd');

    aBlock.setValue('start', -2);
    aBlock.setValue('end', 3);
    Root.run();
    expect(aBlock.getValue('#output')).toBe('abc');

    aBlock.setValue('input', 123);
    Root.run();
    expect(aBlock.getValue('#output')).toBe(undefined);
  });
});
