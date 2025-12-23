import {arrayEqual, deepEqual, shallowEqual} from '../Compare.js';

describe('Compare', function () {
  it('arrayEqual', function () {
    expect(arrayEqual([1, 2], [1, 2])).toBe(true);
    expect(arrayEqual([1, 2], [2, 1])).toBe(false);
    expect(arrayEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(arrayEqual([1, 2, 3], [1, 2])).toBe(false);
  });

  it('deepEqual', function () {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual(NaN, NaN)).toBe(true);
    expect(deepEqual(undefined, undefined)).toBe(true);
    expect(deepEqual('a', 'a')).toBe(true);
    expect(deepEqual(true, true)).toBe(true);
    expect(deepEqual([1, 'a'], [1, 'a'])).toBe(true);
    expect(deepEqual({a: 1}, {a: 1})).toBe(true);

    expect(deepEqual({a: {aa: 1}, b: [2]}, {a: {aa: 1}, b: [2]})).toBe(true);

    expect(deepEqual('a', 1)).toBe(false);
    expect(deepEqual(null, undefined)).toBe(false);
    expect(deepEqual([], {})).toBe(false);
    expect(deepEqual([1], [1, 1])).toBe(false);
    expect(deepEqual([1], [2])).toBe(false);
    expect(deepEqual({a: 1}, {a: 2})).toBe(false);
    expect(deepEqual({a: 1, b: 1}, {a: 1})).toBe(false);
    expect(deepEqual({a: 1}, {a: 1, b: undefined})).toBe(false);
  });

  it('deepEqual on circular ref', function () {
    // Test circular references
    const obj1: any = {};
    obj1.self = obj1;
    const obj2: any = {};
    obj2.self = obj2;
    expect(deepEqual(obj1, obj2)).toBe(true);

    const obj3: any = {};
    const obj4: any = {};
    obj3.other = obj4;
    obj4.other = obj3;
    const obj5: any = {};
    const obj6: any = {};
    obj5.other = obj6;
    obj6.other = obj5;
    expect(deepEqual(obj3, obj5)).toBe(true);

    const obj7: any = {};
    obj7.other = obj7;
    expect(deepEqual(obj7, obj3)).toBe(false);

    // Since we cache with left side as key, both obj3 and obj4 equal to obj7, so the result would be true.
    // This is probably not the desired behavior, but the goal is to prevent dead loop, not to 100% understand graph hierarchy.
    expect(deepEqual(obj3, obj7)).toBe(true);
  });

  it('shallowEqual', function () {
    expect(shallowEqual(1, 1)).toBe(true);
    expect(shallowEqual(NaN, NaN)).toBe(true);
    expect(shallowEqual(undefined, undefined)).toBe(true);
    expect(shallowEqual('a', 'a')).toBe(true);
    expect(shallowEqual(true, true)).toBe(true);
    expect(shallowEqual([1, 'a'], [1, 'a'])).toBe(true);
    expect(shallowEqual({a: 1}, {a: 1})).toBe(true);

    expect(shallowEqual({a: {aa: 1}, b: [2]}, {a: {aa: 1}, b: [2]})).toBe(false);

    expect(shallowEqual('a', 1)).toBe(false);
    expect(shallowEqual(null, undefined)).toBe(false);
    expect(shallowEqual([], {})).toBe(false);
    expect(shallowEqual([1], [1, 1])).toBe(false);
    expect(shallowEqual([1], [2])).toBe(false);
    expect(shallowEqual({a: 1}, {a: 2})).toBe(false);
    expect(shallowEqual({a: 1, b: 1}, {a: 1})).toBe(false);
    expect(shallowEqual({a: 1}, {a: 1, b: undefined})).toBe(false);
  });
});
