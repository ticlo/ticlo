import { assert } from "chai";
import { Json } from '../Json';

describe("TJson", () => {

  it('numbers', () => {
    let nanStr = '"\\u001bNaN"';
    let infStr = '"\\u001bInfinity"';
    let ninfStr = '"\\u001b-Infinity"';

    assert.isNaN(Json.parse(nanStr), 'decode NaN');
    assert.equal(Json.parse(infStr), Infinity, 'decode Infinity');
    assert.equal(Json.parse(ninfStr), -Infinity, 'decode -Infinity');

    assert.equal(Json.stringify(NaN), nanStr, 'encode NaN');
    assert.equal(Json.stringify(Infinity), infStr, 'encode Infinity');
    assert.equal(Json.stringify(-Infinity), ninfStr, 'encode -Infinity');
  });

});
