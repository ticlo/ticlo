import {expect} from 'vitest';
import {decodeUnknown, NoSerialize} from '../NoSerialize.ts';

describe('EscapedObject', function () {
  const encodedString = '"\\b:title"';
  it('basic', function () {
    const esc = new NoSerialize('title');
    expect(JSON.stringify(esc)).toBe(encodedString);

    expect(decodeUnknown(JSON.parse(encodedString)).title).toBe('title');
  });
});
