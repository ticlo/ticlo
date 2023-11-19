import expect from 'expect';

import {updateObjectValue} from '../ObjectValue';
import {Flow} from '../../block/Flow';

describe('ObjectValue', function () {
  it('updateObjectValue', function () {
    let flow = new Flow();

    updateObjectValue(flow, 'v', {a: 1});
    expect(flow.getValue('v')).toEqual({a: 1});
    updateObjectValue(flow, 'v', {b: 2});
    expect(flow.getValue('v')).toEqual({a: 1, b: 2});
    updateObjectValue(flow, 'v', {a: 3});
    expect(flow.getValue('v')).toEqual({a: 3, b: 2});

    let currentValue = flow.getValue('v');
    updateObjectValue(flow, 'v', {b: 2});
    expect(flow.getValue('v')).toBe(currentValue);
  });
});
