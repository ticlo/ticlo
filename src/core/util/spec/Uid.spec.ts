import expect from 'expect';
import {Uid} from '../Uid';

describe('Uid', function () {
  it('uid', function () {
    let uid = new Uid();

    expect(uid.current).toEqual('0');
    expect(uid.next()).toEqual('1');
    expect(uid.next(2)).toEqual('10');
  });
});
