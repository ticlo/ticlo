import {assert} from 'chai';
import '../Join';
import {Block} from '../../../../block/Block';
import {Job, Root} from '../../../../block/Job';

describe('Join', function() {
  it('basic join', function() {
    let job = new Job();

    let aBlock = job.createBlock('a');
    aBlock._load({
      '#is': 'join',
      '0': 2,
      '1': 'a'
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

    aBlock.setValue('#len', 1);

    Root.run();
    assert.equal(aBlock.getValue('#output'), 'b,c');

    aBlock.setValue('#len', 0);
    Root.run();
    assert.equal(aBlock.getValue('#output'), undefined);
  });
});
