import {assert} from 'chai';
import {arrayEqual, deepEqual, shallowEqual} from '../Compare';

describe('Compare', function() {
  it('arrayEqual', function() {
    assert.isTrue(arrayEqual([1, 2], [1, 2]));
    assert.isFalse(arrayEqual([1, 2], [2, 1]));
    assert.isFalse(arrayEqual([1, 2], [1, 2, 3]));
    assert.isFalse(arrayEqual([1, 2, 3], [1, 2]));
  });

  it('deepEqual', function() {
    assert.isTrue(deepEqual(1, 1));
    assert.isTrue(deepEqual(NaN, NaN));
    assert.isTrue(deepEqual(undefined, undefined));
    assert.isTrue(deepEqual('a', 'a'));
    assert.isTrue(deepEqual(true, true));
    assert.isTrue(deepEqual([1, 'a'], [1, 'a']));
    assert.isTrue(deepEqual({a: 1}, {a: 1}));

    assert.isTrue(deepEqual({a: {aa: 1}, b: [2]}, {a: {aa: 1}, b: [2]}));

    assert.isFalse(deepEqual('a', 1));
    assert.isFalse(deepEqual(null, undefined));
    assert.isFalse(deepEqual([], {}));
    assert.isFalse(deepEqual([1], [1, 1]));
    assert.isFalse(deepEqual([1], [2]));
    assert.isFalse(deepEqual({a: 1}, {a: 2}));
    assert.isFalse(deepEqual({a: 1, b: 1}, {a: 1}));
    assert.isFalse(deepEqual({a: 1}, {a: 1, b: undefined}));
  });

  it('shallowEqual', function() {
    assert.isTrue(shallowEqual(1, 1));
    assert.isTrue(shallowEqual(NaN, NaN));
    assert.isTrue(shallowEqual(undefined, undefined));
    assert.isTrue(shallowEqual('a', 'a'));
    assert.isTrue(shallowEqual(true, true));
    assert.isTrue(shallowEqual([1, 'a'], [1, 'a']));
    assert.isTrue(shallowEqual({a: 1}, {a: 1}));

    assert.isFalse(shallowEqual({a: {aa: 1}, b: [2]}, {a: {aa: 1}, b: [2]}));

    assert.isFalse(shallowEqual('a', 1));
    assert.isFalse(shallowEqual(null, undefined));
    assert.isFalse(shallowEqual([], {}));
    assert.isFalse(shallowEqual([1], [1, 1]));
    assert.isFalse(shallowEqual([1], [2]));
    assert.isFalse(shallowEqual({a: 1}, {a: 2}));
    assert.isFalse(shallowEqual({a: 1, b: 1}, {a: 1}));
    assert.isFalse(shallowEqual({a: 1}, {a: 1, b: undefined}));
  });
});
