import {expect} from 'vitest';
import '../Replace.js';
import {Flow, Root} from '../../../block/Flow.js';

describe('Replace', function () {
  it('replaces string search text', function () {
    const flow = new Flow();

    const aBlock = flow.createBlock('a');
    aBlock._load({'#is': 'replace', 'input': 'a-b-a', 'search': 'a', 'replacement': 'x'});
    Root.run();
    expect(aBlock.getValue('#output')).toBe('x-b-x');

    aBlock.setValue('search', 1);
    Root.run();
    expect(aBlock.getValue('#output')).toBe(undefined);
  });

  it('replaces regex matches', function () {
    const flow = new Flow();

    const aBlock = flow.createBlock('a');
    aBlock._load({'#is': 'replace-regex', 'input': 'a1 b22 c333', 'pattern': '\\d+', 'replacement': '#'});
    Root.run();
    expect(aBlock.getValue('#output')).toBe('a# b# c#');

    aBlock.setValue('flags', '');
    Root.run();
    expect(aBlock.getValue('#output')).toBe('a# b22 c333');

    aBlock.setValue('pattern', '[');
    Root.run();
    expect(aBlock.getValue('#output')).toBe(undefined);
  });
});
