import {assert} from 'chai';
import '../Join';
import {Block} from '../../../block/Block';
import {Flow, Root} from '../../../block/Flow';

describe('Join', function () {
  it('basic join', function () {
    let flow = new Flow();

    let aBlock = flow.createBlock('a');
    aBlock._load({
      '#is': 'join',
      '0': 2,
      '1': 'a',
    });

    Root.run();

    assert.equal(aBlock.getValue('#output'), '2a');

    aBlock.setValue('0', null);

    Root.run();
    assert.equal(aBlock.getValue('#output'), undefined);

    aBlock.setValue('0', ['b', 'c']);

    Root.run();
    assert.equal(aBlock.getValue('#output'), 'bca');

    aBlock.setValue('separator', ',');

    Root.run();
    assert.equal(aBlock.getValue('#output'), 'b,c,a');

    aBlock.setValue('[]', 1);

    Root.run();
    assert.equal(aBlock.getValue('#output'), 'b,c');

    aBlock.setValue('[]', 0);
    Root.run();
    assert.equal(aBlock.getValue('#output'), '');
  });
});
