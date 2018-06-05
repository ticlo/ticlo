import { assert } from "chai";
import { TJson } from '../TJson';

describe("TJson", () => {

  it('numbers', () => {
    let nanStr = '"\\u001bNaN"';
    let infStr = '"\\u001bInfinity"';
    let ninfStr = '"\\u001b-Infinity"';

    assert.isNaN(TJson.parse(nanStr), 'decode NaN');
    assert.equal(TJson.parse(infStr), Infinity, 'decode Infinity');
    assert.equal(TJson.parse(ninfStr), -Infinity, 'decode -Infinity');

    assert.equal(TJson.stringify(NaN), nanStr, 'encode NaN');
    assert.equal(TJson.stringify(Infinity), infStr, 'encode Infinity');
    assert.equal(TJson.stringify(-Infinity), ninfStr, 'encode -Infinity');
  });

});
