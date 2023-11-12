import expect from 'expect';
import {arrayEqual, deepEqual, shallowEqual} from '../Compare';

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
