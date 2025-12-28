import {expect} from 'vitest';
import {decodeUnknown, EscapedObject} from '../EscapedObject.js';

describe('EscapedObject', function () {
  const encodedString = '"͢:title"';
  it('basic', function () {
    const esc = new EscapedObject('title');
    expect(JSON.stringify(esc)).toBe(encodedString);

    expect(decodeUnknown(JSON.parse(encodedString)).title).toBe('title');
  });
});
