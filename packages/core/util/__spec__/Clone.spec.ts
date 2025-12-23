import {cloneToLevel, deepClone} from '../Clone.js';
import {DateTime} from 'luxon';

const data = {
  a: {
    b: {},
  },
};

describe('Clone', function () {
  it('basic clone', function () {
    expect(deepClone(data)).toEqual(data);
    expect(deepClone(data)).not.toBe(data);
  });
  it('clone to level', function () {
    expect(cloneToLevel(data, 0)).toBe(data);

    expect(cloneToLevel(data, 1)).not.toBe(data);
    expect(cloneToLevel(data, 1).a).toBe(data.a);

    expect(cloneToLevel(data, 2)).not.toBe(data);
    expect(cloneToLevel(data, 2).a).not.toBe(data.a);
    expect(cloneToLevel(data, 2).a.b).toBe(data.a.b);
  });

  it('clone DateTime', function () {
    const day = DateTime.now();
    const clone = deepClone(day);
    const clone1 = cloneToLevel(day, 1);

    expect(clone.equals(day)).toBeTruthy();
    expect(clone1.equals(day)).toBeTruthy();
  });
});
