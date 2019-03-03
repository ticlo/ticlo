import {assert} from "chai";
import {arrayEqual, deepEqual} from '../Compare';

describe("Compare", function () {

  it('arrayEqual', function () {
    assert.isTrue(arrayEqual([1, 2], [1, 2]));
    assert.isFalse(arrayEqual([1, 2], [2, 1]));
    assert.isFalse(arrayEqual([1, 2], [1, 2, 3]));
    assert.isFalse(arrayEqual([1, 2, 3], [1, 2]));
  });

  it('deepEqual', function () {
    assert.isTrue(deepEqual(1, 1));
    assert.isTrue(deepEqual(NaN, NaN));
    assert.isTrue(deepEqual(undefined, undefined));
    assert.isTrue(deepEqual('a', 'a'));
    assert.isTrue(deepEqual(true, true));
    assert.isTrue(deepEqual([1, 'a'], [1, 'a']));
    assert.isTrue(deepEqual({a: 1}, {a: 1}));

    assert.isFalse(deepEqual('a', 1));
    assert.isFalse(deepEqual(null, undefined));
    assert.isFalse(deepEqual([], {}));
    assert.isFalse(deepEqual([1], [1, 1]));
    assert.isFalse(deepEqual([1], [2]));
    assert.isFalse(deepEqual({a: 1}, {a: 2}));
    assert.isFalse(deepEqual({a: 1, b: 1}, {a: 1}));
    assert.isFalse(deepEqual({a: 1}, {a: 1, b: undefined}));
  });
});