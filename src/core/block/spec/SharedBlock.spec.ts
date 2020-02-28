import {assert} from 'chai';
import {Job, Root} from '../Job';
import {SharedBlock} from '../SharedBlock';

describe('SharedBlock', function() {
  it('basic', function() {
    let job = new Job();
    let data = {'#is': '', '#shared': {'#is': ''}};
    job.load(data);
    let sharedBlock: SharedBlock = job.getValue('#shared');
    assert.instanceOf(sharedBlock, SharedBlock);
    assert.equal(sharedBlock._source, data['#shared']);

    job.destroy();
    assert.isTrue(sharedBlock._destroyed);
  });
});
