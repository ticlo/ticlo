import {assert} from 'chai';

import {addOptionalProperty, moveOptionalProperty, removeOptionalProperty} from '../OptionalProperty';
import {Flow} from '../../block/Flow';

describe('Optional Property', function () {
  it('add remove OptionalProperty', function () {
    let flow = new Flow();

    // remove should do nothing when #optional is undefined
    removeOptionalProperty(flow, 'a');
    assert.isUndefined(flow.getValue('#optional'));

    addOptionalProperty(flow, 'a');
    assert.deepEqual(flow.getValue('#optional'), ['a']);
    assert.deepEqual(flow.getValue('@b-p'), ['a']);

    addOptionalProperty(flow, 'b');
    assert.deepEqual(flow.getValue('#optional'), ['a', 'b']);
    assert.deepEqual(flow.getValue('@b-p'), ['a', 'b']);

    // when prop name is same
    addOptionalProperty(flow, 'a');
    assert.deepEqual(flow.getValue('#optional'), ['a', 'b']);

    removeOptionalProperty(flow, 'b');
    assert.deepEqual(flow.getValue('#optional'), ['a']);
    assert.deepEqual(flow.getValue('@b-p'), ['a']);

    flow.setValue('a', 1);
    removeOptionalProperty(flow, 'a');
    assert.isUndefined(flow.getValue('#optional'));
    assert.isUndefined(flow.getValue('a'));
  });

  it('move OptionalProperty', function () {
    let flow = new Flow();

    moveOptionalProperty(flow, 'a', 'b');
    assert.isUndefined(flow.getValue('#optional'));

    moveOptionalProperty(flow, 'a', 'a');
    assert.isUndefined(flow.getValue('#optional'));

    flow.setValue('#optional', ['a', 'b']);

    moveOptionalProperty(flow, 'a', 'b');
    assert.deepEqual(flow.getValue('#optional'), ['b', 'a']);

    moveOptionalProperty(flow, 'a', 'b');
    assert.deepEqual(flow.getValue('#optional'), ['a', 'b']);

    moveOptionalProperty(flow, 'c', 'a');
    assert.deepEqual(flow.getValue('#optional'), ['c', 'a', 'b']);
    assert.deepEqual(flow.getValue('@b-p'), ['c']);
  });
});
