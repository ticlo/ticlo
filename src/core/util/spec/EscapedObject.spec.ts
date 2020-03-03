import {assert} from 'chai';
import {decodeUnknown, EscapedObject} from '../EscapedObject';

describe('EscapedObject', function() {
  const encodedString = '"\\u001b:title"';
  it('basic', function() {
    let esc = new EscapedObject('title');
    assert.equal(JSON.stringify(esc), encodedString);

    assert.equal(decodeUnknown(JSON.parse(encodedString)).title, 'title');
  });
});
