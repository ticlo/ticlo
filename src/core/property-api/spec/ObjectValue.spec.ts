import {assert} from 'chai';

import {updateObjectValue} from '../ObjectValue';
import {Flow} from '../../block/Flow';

describe('ObjectValue', function () {
  it('updateObjectValue', function () {
    let flow = new Flow();

    updateObjectValue(flow, 'v', {a: 1});
    assert.deepEqual(flow.getValue('v'), {a: 1});
    updateObjectValue(flow, 'v', {b: 2});
    assert.deepEqual(flow.getValue('v'), {a: 1, b: 2});
    updateObjectValue(flow, 'v', {a: 3});
    assert.deepEqual(flow.getValue('v'), {a: 3, b: 2});

    let currentValue = flow.getValue('v');
    updateObjectValue(flow, 'v', {b: 2});
    assert.equal(flow.getValue('v'), currentValue, 'value should not change');
  });
});
