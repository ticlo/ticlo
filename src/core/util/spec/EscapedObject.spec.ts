import expect from 'expect';
import {decodeUnknown, EscapedObject} from '../EscapedObject';

describe('EscapedObject', function () {
  const encodedString = '"\\u001b:title"';
  it('basic', function () {
    let esc = new EscapedObject('title');
    expect(JSON.stringify(esc)).toBe(encodedString);

    expect(decodeUnknown(JSON.parse(encodedString)).title).toBe('title');
  });
});
