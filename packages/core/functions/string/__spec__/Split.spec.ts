import {expect} from 'vitest';
import '../Split.js';
import {Block} from '../../../block/Block.js';
import {Flow, Root} from '../../../block/Flow.js';

describe('Split', function () {
  it('basic split', function () {
    let flow = new Flow();

    let aBlock = flow.createBlock('a');
    aBlock.setValue('#is', 'split');
    expect(aBlock.getValue('#output')).not.toBeDefined();

    aBlock.setValue('input', 'a,b, c');
    Root.run();
    expect(aBlock.getValue('#output')).toEqual(['a', 'b', ' c']);

    aBlock.setValue('separator', ',');
    Root.run();
    expect(aBlock.getValue('#output')).toEqual(['a', 'b', ' c']);

    Root.run();
    expect(aBlock.getValue('#output')).toEqual(['a', 'b', ' c']);

    aBlock.setValue('regExp', true);
    Root.run();
    expect(aBlock.getValue('#output')).toEqual(['a', 'b', ' c']);

    aBlock.setValue('separator', ', ?');
    Root.run();
    expect(aBlock.getValue('#output')).toEqual(['a', 'b', 'c']);
  });
});
