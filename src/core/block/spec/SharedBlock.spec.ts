import {assert} from 'chai';
import {Job, Root, SharedBlock} from '../Job';

describe('SharedBlock', function() {
  it('basic', function() {
    let data = {'#is': '', '#shared': {'#is': ''}};

    let job1 = new Job();
    job1.load(data);
    let sharedBlock: SharedBlock = job1.getValue('#shared');
    assert.instanceOf(sharedBlock, SharedBlock);
    assert.equal(sharedBlock._source, data['#shared']);

    let job2 = new Job();
    job2.load(data);
    assert.equal(job2.getValue('#shared'), sharedBlock);

    job1.destroy();
    assert.isFalse(sharedBlock._destroyed);
    job2.destroy();
    assert.isTrue(sharedBlock._destroyed);
  });
});
