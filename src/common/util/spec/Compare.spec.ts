import {assert} from "chai";
import {compareArray} from '../Compare';

describe("Compare", function () {

  it('compareArray', function () {
    assert.isTrue(compareArray([1, 2], [1, 2]));
    assert.isFalse(compareArray([1, 2], [2, 1]));
    assert.isFalse(compareArray([1, 2], [1, 2, 3]));
    assert.isFalse(compareArray([1, 2, 3], [1, 2]));
  });
});