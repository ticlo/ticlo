import {assert} from 'chai';
import '../Split';
import {Block} from '../../../block/Block';
import {Flow, Root} from '../../../block/Flow';

describe('Split', function () {
  it('basic split', function () {
    let flow = new Flow();

    let aBlock = flow.createBlock('a');
    aBlock.setValue('#is', 'split');
    assert.isUndefined(aBlock.getValue('#output'));

    aBlock.setValue('input', 'a,b, c');
    Root.run();
    assert.deepEqual(aBlock.getValue('#output'), ['a', 'b', ' c']);

    aBlock.setValue('separator', ',');
    Root.run();
    assert.deepEqual(aBlock.getValue('#output'), ['a', 'b', ' c']);

    Root.run();
    assert.deepEqual(aBlock.getValue('#output'), ['a', 'b', ' c']);

    aBlock.setValue('regExp', true);
    Root.run();
    assert.deepEqual(aBlock.getValue('#output'), ['a', 'b', ' c']);

    aBlock.setValue('separator', ', ?');
    Root.run();
    assert.deepEqual(aBlock.getValue('#output'), ['a', 'b', 'c']);
  });
});
