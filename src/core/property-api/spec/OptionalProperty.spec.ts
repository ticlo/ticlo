import {assert} from 'chai';

import {addOptionalProperty, moveOptionalProperty, removeOptionalProperty} from '../OptionalProperty';
import {Job} from '../../block/Block';

describe('Optional Property', function() {
  it('add remove OptionalProperty', function() {
    let job = new Job();

    // remove should do nothing when #optional is undefined
    removeOptionalProperty(job, 'a');
    assert.isUndefined(job.getValue('#optional'));

    addOptionalProperty(job, 'a');
    assert.deepEqual(job.getValue('#optional'), ['a']);
    assert.deepEqual(job.getValue('@b-p'), ['a']);

    addOptionalProperty(job, 'b');
    assert.deepEqual(job.getValue('#optional'), ['a', 'b']);
    assert.deepEqual(job.getValue('@b-p'), ['a', 'b']);

    // when prop name is same
    addOptionalProperty(job, 'a');
    assert.deepEqual(job.getValue('#optional'), ['a', 'b']);

    removeOptionalProperty(job, 'b');
    assert.deepEqual(job.getValue('#optional'), ['a']);
    assert.deepEqual(job.getValue('@b-p'), ['a']);

    removeOptionalProperty(job, 'a');
    assert.isUndefined(job.getValue('#optional'));
  });

  it('move OptionalProperty', function() {
    let job = new Job();

    moveOptionalProperty(job, 'a', 'b');
    assert.isUndefined(job.getValue('#optional'));

    moveOptionalProperty(job, 'a', 'a');
    assert.isUndefined(job.getValue('#optional'));

    job.setValue('#optional', ['a', 'b']);

    moveOptionalProperty(job, 'a', 'b');
    assert.deepEqual(job.getValue('#optional'), ['b', 'a']);

    moveOptionalProperty(job, 'a', 'b');
    assert.deepEqual(job.getValue('#optional'), ['a', 'b']);

    moveOptionalProperty(job, 'c', 'a');
    assert.deepEqual(job.getValue('#optional'), ['c', 'a', 'b']);
    assert.deepEqual(job.getValue('@b-p'), ['c']);
  });
});
