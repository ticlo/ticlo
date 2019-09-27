import {assert} from 'chai';
import {Uid} from '../Uid';

describe('Uid', function() {
  it('uid', function() {
    let uid = new Uid();

    assert.equal(uid.current, '0', 'initial value');
    assert.equal(uid.next(), '1', 'next value');
  });
});
