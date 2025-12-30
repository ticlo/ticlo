import {expect} from 'vitest';
import {decodeUnknown, NoSerialize} from '../NoSerialize.js';

describe('EscapedObject', function () {
  const encodedString = '"͢:title"';
  it('basic', function () {
    const esc = new NoSerialize('title');
    expect(JSON.stringify(esc)).toBe(encodedString);

    expect(decodeUnknown(JSON.parse(encodedString)).title).toBe('title');
  });
});
