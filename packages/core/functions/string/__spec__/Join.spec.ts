import {expect} from 'vitest';
import '../Join.js';
import {Block} from '../../../block/Block.js';
import {Flow, Root} from '../../../block/Flow.js';

describe('Join', function () {
  it('basic join', function () {
    const flow = new Flow();

    const aBlock = flow.createBlock('a');
    aBlock._load({
      '#is': 'join',
      '0': 2,
      '1': 'a',
    });

    Root.run();

    expect(aBlock.getValue('#output')).toBe('2a');

    aBlock.setValue('0', null);

    Root.run();
    expect(aBlock.getValue('#output')).toBe(undefined);

    aBlock.setValue('0', ['b', 'c']);

    Root.run();
    expect(aBlock.getValue('#output')).toBe('bca');

    aBlock.setValue('separator', ',');

    Root.run();
    expect(aBlock.getValue('#output')).toBe('b,c,a');

    aBlock.setValue('[]', 1);

    Root.run();
    expect(aBlock.getValue('#output')).toBe('b,c');

    aBlock.setValue('[]', 0);
    Root.run();
    expect(aBlock.getValue('#output')).toBe('');
  });
});
