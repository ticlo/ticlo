import expect from 'expect';
import '../Split';
import {Block} from '../../../block/Block';
import {Flow, Root} from '../../../block/Flow';

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
