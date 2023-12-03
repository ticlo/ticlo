import {expect} from 'vitest';
import {Uid} from '../Uid';

describe('Uid', function () {
  it('uid', function () {
    let uid = new Uid();

    expect(uid.current).toBe('0');
    expect(uid.next()).toBe('1');
    expect(uid.next(2)).toBe('10');
  });
});
