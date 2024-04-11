import {cloneToLevel, deepClone} from '../Clone';
import dayjs from 'dayjs';

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

  it('clone dayjs', function () {
    const day = dayjs();
    const clone = deepClone(day);
    const clone1 = cloneToLevel(day, 1);

    expect(clone).not.toBe(day);
    expect(clone1).not.toBe(day);

    expect(clone.isSame(day)).toBeTruthy();
    expect(clone1.isSame(day)).toBeTruthy();
  });
});
