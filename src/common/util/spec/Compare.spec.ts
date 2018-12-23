import {assert} from "chai";
import {arrayEqual} from '../Compare';

describe("Compare", function () {

  it('arrayEqual', function () {
    assert.isTrue(arrayEqual([1, 2], [1, 2]));
    assert.isFalse(arrayEqual([1, 2], [2, 1]));
    assert.isFalse(arrayEqual([1, 2], [1, 2, 3]));
    assert.isFalse(arrayEqual([1, 2, 3], [1, 2]));
  });
});